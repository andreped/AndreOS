/**
 * nemotron.js — NVIDIA Nemotron 3.5 ASR Streaming (0.6B cache-aware FastConformer-RNNT,
 * 40 locales incl. nb-NO) on onnxruntime-web. The onnx-community int4 export targets
 * onnxruntime-genai, so its NeMo log-mel front-end and greedy RNN-T loop are reimplemented
 * here. Audio is consumed in 560 ms chunks, so `stream()` yields text while you speak.
 * Runs in a worker or in Node (tests/evals/nemotron.selfcheck.mjs).
 */
import * as ort from 'onnxruntime-web';

// The browser build doesn't bundle ORT's wasm (see vite.config.js); fetch the matching version from the CDN.
if (!globalThis.process?.versions?.node) ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;

export const NEMOTRON_MODEL = 'onnx-community/nemotron-3.5-asr-streaming-0.6b-onnx-int4';
const HF_BASE = `https://huggingface.co/${NEMOTRON_MODEL}/resolve/main/`;

// Indices into NeMo's prompt_dictionary (nvidia/nemotron-3.5-asr-streaming-0.6b processor_config.json).
const LANG_IDS = { auto: 101, english: 0, en: 0, 'en-US': 0, norwegian: 103, no: 103, nb: 103, 'nb-NO': 103 };

// librosa.filters.mel (Slaney scale + Slaney norm), as NeMo's preprocessor uses.
const hzToMel = (f) => (f < 1000 ? f / (200 / 3) : 15 + Math.log(f / 1000) / (Math.log(6.4) / 27));
const melToHz = (m) => (m < 15 ? m * (200 / 3) : 1000 * Math.exp((m - 15) * (Math.log(6.4) / 27)));
function melFilters(nMels, nFft, sr) {
    const bins = nFft / 2 + 1, top = hzToMel(sr / 2);
    const pts = Array.from({ length: nMels + 2 }, (_, i) => melToHz((top * i) / (nMels + 1)));
    const fb = new Float32Array(nMels * bins);
    for (let m = 0; m < nMels; m++) {
        const [lo, c, hi] = [pts[m], pts[m + 1], pts[m + 2]];
        for (let k = 0; k < bins; k++) {
            const f = (k * sr) / nFft;
            fb[m * bins + k] = Math.max(0, Math.min((f - lo) / (c - lo), (hi - f) / (hi - c))) * (2 / (hi - lo));
        }
    }
    return fb;
}

// In-place radix-2 complex FFT.
function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let cr = 1, ci = 0;
            for (let k = 0; k < len / 2; k++) {
                const a = i + k, b = a + len / 2;
                const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
                re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
                [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
            }
        }
    }
}

/**
 * Incremental NeMo log-mel front-end (pre-emphasis, centred zero-padded STFT, periodic=False
 * Hann, power spectrum, Slaney mel, log(x + 2^-24)); frames match a single whole-utterance pass.
 */
export function melFrontend(cfg) {
    const { fft_size: N, hop_length: hop, win_length: W, num_mels: M, sample_rate: sr, preemph, log_eps } = cfg;
    const win = new Float32Array(N), off = (N - W) / 2;
    for (let i = 0; i < W; i++) win[off + i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (W - 1));
    const fb = melFilters(M, N, sr), bins = N / 2 + 1;
    const re = new Float32Array(N), im = new Float32Array(N);
    let buf = new Float32Array(0), base = 0, total = 0, prev = 0, n = 0; // buf[0] is sample `base`

    const frame = (c) => {
        for (let i = 0; i < N; i++) {
            const s = c - N / 2 + i;
            re[i] = s >= base && s < total ? buf[s - base] * win[i] : 0;
            im[i] = 0;
        }
        fft(re, im);
        const out = new Float32Array(M);
        for (let m = 0; m < M; m++) {
            let e = 0;
            for (let k = 0; k < bins; k++) e += fb[m * bins + k] * (re[k] * re[k] + im[k] * im[k]);
            out[m] = Math.log(e + log_eps);
        }
        return out;
    };

    return {
        push(x) {
            const y = new Float32Array(x.length);
            for (let i = 0; i < x.length; i++) { y[i] = x[i] - (total + i === 0 ? 0 : preemph) * (i ? x[i - 1] : prev); }
            if (x.length) prev = x[x.length - 1];
            const keep = Math.max(0, n * hop - N / 2 - base);
            const next = new Float32Array(buf.length - keep + y.length);
            next.set(buf.subarray(keep)); next.set(y, buf.length - keep);
            buf = next; base += keep; total += y.length;
        },
        /** Frames whose window is complete (all remaining ones when `final`). */
        pull(final = false) {
            const frames = [];
            const last = final ? Math.floor(total / hop) : Math.floor((total - N / 2) / hop);
            for (; n <= last; n++) frames.push(frame(n * hop));
            return frames;
        },
    };
}

// Cache API storage for the ~790 MB of weights, with download progress; plain fetch in Node.
async function download(url, onProgress) {
    const cache = typeof caches !== 'undefined' && /^https?:/.test(url) ? await caches.open('andreos-nemotron') : null;
    let res = await cache?.match(url);
    if (!res) {
        res = await fetch(url);
        if (!res.ok) throw new Error(`Nemotron: ${url} → HTTP ${res.status}`);
        cache?.put(url, res.clone()).catch((err) => console.warn('[Nemotron] cache put failed:', err));
    }
    const total = +res.headers.get('content-length') || 0;
    if (!res.body || !total) return new Uint8Array(await res.arrayBuffer());
    const reader = res.body.getReader(), parts = [];
    let got = 0;
    for (let r; !(r = await reader.read()).done;) {
        parts.push(r.value); got += r.value.length;
        onProgress?.(Math.min(100, (100 * got) / total));
    }
    const out = new Uint8Array(got);
    for (let i = 0, o = 0; i < parts.length; o += parts[i++].length) out.set(parts[i], o);
    return out;
}

/**
 * @param {{ baseUrl?: string, device?: 'auto'|'webgpu'|'wasm',
 *           fetchBytes?: (url: string, onProgress?: (pct: number) => void) => Promise<Uint8Array>,
 *           onProgress?: (p: { file: string, progress: number }) => void }} opts
 */
export async function loadNemotron({ baseUrl = HF_BASE, device = 'auto', fetchBytes = download, onProgress } = {}) {
    const get = (f) => fetchBytes(baseUrl + f, (progress) => onProgress?.({ file: f, progress }));
    const json = async (f) => JSON.parse(new TextDecoder().decode(await get(f)));
    const [{ model: cfg }, vocabBytes] = await Promise.all([json('genai_config.json'), get('vocab.txt')]);
    const vocab = new TextDecoder().decode(vocabBytes).split('\n');

    const open = async (name, ep) => {
        const [graph, data] = await Promise.all([get(`${name}.onnx`), get(`${name}.onnx.data`)]);
        return ort.InferenceSession.create(graph, { executionProviders: [ep], externalData: [{ path: `${name}.onnx.data`, data }] });
    };
    // The small LSTM decoder + joint run on WASM: one tiny call per emitted token beats GPU round-trips.
    const [decoder, joint] = [await open('decoder', 'wasm'), await open('joint', 'wasm')];
    const gpu = device === 'webgpu'
        || (device === 'auto' && !globalThis.process?.versions?.node && !!(await globalThis.navigator?.gpu?.requestAdapter().catch(() => null)));
    let encoder, backend = gpu ? 'webgpu' : 'wasm';
    try { encoder = await open('encoder', backend); }
    catch (err) {
        if (!gpu) throw err;
        console.warn('[Nemotron] WebGPU session failed, falling back to WASM:', err);
        encoder = await open('encoder', backend = 'wasm');
    }

    const E = cfg.encoder.hidden_size, H = cfg.decoder.hidden_size, L = cfg.decoder.num_hidden_layers;
    const M = cfg.num_mels, PRE = cfg.pre_encode_cache_size, CHUNK = cfg.chunk_samples / cfg.hop_length;
    const f32 = (a, dims) => new ort.Tensor('float32', a, dims);
    const i64 = (a, dims = [a.length]) => new ort.Tensor('int64', BigInt64Array.from(a, BigInt), dims);

    /** One streaming session: push 16 kHz mono Float32 audio, read the running transcript. */
    function stream(language = 'auto') {
        const lang = i64([typeof language === 'number' ? language : LANG_IDS[language] ?? LANG_IDS.auto]);
        const fe = melFrontend(cfg);
        // tl;dr: speech in the very first chunk often decodes to nothing (worst for nb-NO), so prime with
        // 0.5 s of silence. Empirical (tests/evals/nemotron.selfcheck.mjs); a NeMo-exact first chunk might fix it properly.
        fe.push(new Float32Array(cfg.sample_rate / 2));
        const pending = [], ids = [];
        let pre = new Float32Array(PRE * M); // pre-encode cache: the last PRE mel frames of the previous chunk
        let cache = {
            cache_last_channel: f32(new Float32Array(cfg.encoder.num_hidden_layers * cfg.left_context * E), [1, cfg.encoder.num_hidden_layers, cfg.left_context, E]),
            cache_last_time: f32(new Float32Array(cfg.encoder.num_hidden_layers * E * cfg.conv_context), [1, cfg.encoder.num_hidden_layers, E, cfg.conv_context]),
            cache_last_channel_len: i64([0]),
        };
        let g = null, h = f32(new Float32Array(L * H), [L, 1, H]), c = f32(new Float32Array(L * H), [L, 1, H]);
        let queue = Promise.resolve();

        const predict = async (token) => {
            const out = await decoder.run({ targets: i64([token], [1, 1]), h_in: h, c_in: c });
            g = f32(out.decoder_output.data, [1, 1, H]); h = out.h_out; c = out.c_out;
        };

        const encode = async (frames, valid) => {
            const x = new Float32Array((PRE + CHUNK) * M);
            x.set(pre);
            frames.forEach((f, i) => x.set(f, (PRE + i) * M));
            pre = x.slice(CHUNK * M);
            const out = await encoder.run({ audio_signal: f32(x, [1, PRE + CHUNK, M]), length: i64([PRE + valid]), lang_id: lang, ...cache });
            cache = { cache_last_channel: out.cache_last_channel_next, cache_last_time: out.cache_last_time_next, cache_last_channel_len: out.cache_last_channel_len_next };
            if (!g) await predict(cfg.blank_id);
            const T = Number(out.encoded_lengths.data[0]), enc = out.outputs.data;
            // Greedy RNN-T: emit up to max_symbols_per_step tokens per encoder frame, advance on blank.
            for (let t = 0; t < T; t++) {
                const f = f32(enc.slice(t * E, (t + 1) * E), [1, 1, E]);
                for (let s = 0; s < cfg.max_symbols_per_step; s++) {
                    const z = (await joint.run({ encoder_output: f, decoder_output: g })).joint_output.data;
                    let k = 0;
                    for (let i = 1; i < z.length; i++) if (z[i] > z[k]) k = i;
                    if (k === cfg.blank_id) break;
                    ids.push(k);
                    await predict(k);
                }
            }
        };

        const run = (final) => (queue = queue.then(async () => {
            pending.push(...fe.pull(final));
            while (pending.length >= CHUNK) await encode(pending.splice(0, CHUNK), CHUNK);
            if (final && pending.length) { const n = pending.length; await encode(pending.splice(0), n); }
            return text();
        }));

        const text = () => ids.map((i) => vocab[i]).join('')
            .replace(/<[a-z]{2}-[A-Z]{2}>|<unk>/g, '').replace(/▁/g, ' ').replace(/\s+/g, ' ').trim();

        return {
            /** Feed audio; resolves to the transcript so far once all complete chunks are decoded. */
            push(samples) { fe.push(samples); return run(false); },
            /** Flush the tail (call once); resolves to the final transcript. */
            end() { return run(true); },
        };
    }

    async function transcribe(audio, language) {
        const s = stream(language);
        s.push(audio);
        return s.end();
    }

    return { stream, transcribe, device: backend, model: NEMOTRON_MODEL };
}
