/**
 * vela.js — System One decisions in the browser (or Node) with a Vela 3.1 pico
 * ONNX export (scripts/export_vela_web.py): WASM (int8) by default, WebGPU (fp16)
 * on request. `decide(state, questions)` returns System One `answers`, so it is
 * a drop-in for the Python decision server in decisionPlanner.js.
 * tl;dr: fp16 on onnxruntime-web's WebGPU EP flips decisions (max |dp| 0.8; the same
 * file on CPU: 0.001; fp32 on WebGPU: exact), so WebGPU isn't the default until that's fixed.
 */
import * as ort from 'onnxruntime-web';
import { Tokenizer } from '@huggingface/tokenizers';

// The browser build doesn't bundle ORT's wasm (see vite.config.js); fetch the matching version from the CDN.
if (!globalThis.process?.versions?.node) ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;

// render31 (the source package's renderer), ported as-is.
const text = (x) => (x == null ? '' : typeof x === 'string' ? x : JSON.stringify(x));

function options(q) {
    if (q.type === 'noul') {
        const c = q.criteria ?? {};
        return { no: text(c.false), yes: text(c.true) };
    }
    const c = q.criteria;
    if (Array.isArray(c) && c.length) return Object.fromEntries(c.map((n) => [String(n), '']));
    if (c && typeof c === 'object' && Object.keys(c).length) return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, text(v)]));
    throw new Error(`a ${q.type} question needs criteria`);
}

// Large model files survive reloads in the Cache API; plain fetch where it's absent (Node).
async function cachedFetch(url) {
    if (typeof caches === 'undefined' || !/^https?:/.test(url)) return fetch(url);
    const cache = await caches.open('andreos-vela');
    const hit = await cache.match(url);
    if (hit) return hit;
    const res = await fetch(url);
    if (res.ok) await cache.put(url, res.clone());
    return res;
}

/**
 * @param {{ baseUrl: string, device?: 'auto'|'webgpu'|'wasm', file?: string,
 *           fetchFn?: (url: string) => Promise<Response> }} opts
 * @returns {Promise<{ decide: (state: any, questions: object) => Promise<Record<string, any>>,
 *                     device: string, model: string, encode: Function }>}
 */
export async function loadVela({ baseUrl, device = 'wasm', file, fetchFn = cachedFetch }) {
    const get = async (f) => {
        const res = await fetchFn(baseUrl + f);
        if (!res.ok) throw new Error(`Vela: ${f} → HTTP ${res.status}`);
        return res;
    };
    const [cfg, tokJson, tokCfg] = await Promise.all(
        ['config.json', 'tokenizer.json', 'tokenizer_config.json'].map((f) => get(f).then((r) => r.json())));
    const tok = new Tokenizer(tokJson, tokCfg);
    const M = cfg.markers;

    const gpu = device === 'webgpu'
        || (device === 'auto' && !file && !!(await globalThis.navigator?.gpu?.requestAdapter().catch(() => null)));
    const open = async (useGpu) => {
        const bytes = new Uint8Array(await (await get(file ?? (useGpu ? cfg.files.webgpu : cfg.files.wasm))).arrayBuffer());
        return ort.InferenceSession.create(bytes, { executionProviders: [useGpu ? 'webgpu' : 'wasm'] });
    };
    let session, backend = gpu ? 'webgpu' : 'wasm';
    try { session = await open(gpu); }
    catch (err) {
        if (!gpu) throw err;
        console.warn('[Vela] WebGPU session failed, falling back to WASM:', err);
        session = await open(false); backend = 'wasm';
    }

    const ids = (s) => (s ? tok.encode(s, { add_special_tokens: false }).ids : []);

    /** [BOS] [Q] instructions ([O] name[: description])* [SEP_SCHEMA] [SEG_user] state [EOS] */
    function encode(state, q, stateIds = ids(text(state))) {
        const opts = options(q);
        const x = [cfg.bos_token_id, M['[Q]'], ...ids(text(q.instructions))];
        const optPos = [];
        for (const [n, d] of Object.entries(opts)) { optPos.push(x.length); x.push(M['[O]'], ...ids(d ? `${n}: ${d}` : n)); }
        x.push(M['[SEP_SCHEMA]']);
        const ps = x.length;
        x.push(M['[SEG_user]'], ...stateIds);
        const pe = x.length;
        x.push(cfg.eos_token_id);
        return { ids: x, optPos, names: Object.keys(opts), pool: [ps, pe] };
    }

    const i64 = (a, dims) => new ort.Tensor('int64', BigInt64Array.from(a, BigInt), dims);

    async function decide(state, questions) {
        const stateIds = ids(text(state));
        const answers = {};
        // One question per forward; WebGPU sessions don't run concurrently anyway.
        for (const [k, q] of Object.entries(questions)) {
            if (q?.type !== 'choice' && q?.type !== 'noul') {
                answers[k] = { type: q?.type, error: 'invalid_question', message: `unsupported question type ${q?.type} (choice, noul)` };
                continue;
            }
            let r;
            try { r = encode(state, q, stateIds); }
            catch (err) { answers[k] = { type: q.type, error: 'invalid_question', message: err.message }; continue; }
            const { logits } = await session.run({
                input_ids: i64(r.ids, [1, r.ids.length]), opt_pos: i64(r.optPos, [r.optPos.length]), pool: i64(r.pool, [2]),
            });
            const z = Array.from(logits.data);
            const max = Math.max(...z);
            const e = z.map((v) => Math.exp(v - max));
            const sum = e.reduce((a, b) => a + b, 0);
            const p = Object.fromEntries(r.names.map((n, i) => [n, e[i] / sum]));
            answers[k] = q.type === 'noul'
                ? { type: 'noul', noul: p.yes }
                : { type: 'choice', choice: r.names.reduce((a, b) => (p[b] > p[a] ? b : a)), probabilities: p };
        }
        return answers;
    }

    return { decide, encode, device: backend, model: cfg.source ?? cfg.model };
}
