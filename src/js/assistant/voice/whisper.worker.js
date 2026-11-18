/**
 * Speech-to-text Web Worker
 *
 * Runs Nemotron 3.5 ASR (./nemotron.js, onnxruntime-web) or a Whisper model
 * via @xenova/transformers, off the main thread.
 *
 * @xenova/transformers is imported at runtime from CDN via a dynamic import
 * so that Vite never pre-bundles it (which would mangle the library's internal
 * import.meta.url paths that ONNX Runtime uses to locate its own .wasm files).
 * The /* @vite-ignore *\/ comment tells Vite to leave the import unresolved
 * at build time.
 *
 * Messages in:
 *   { type: 'load', model }
 *   { type: 'start', language }                   — begin an utterance
 *   { type: 'chunk', audio: Float32Array }        — 16 kHz mono, while recording
 *   { type: 'end' }                               — finish and transcribe
 *   { type: 'cancel' }                            — drop the utterance, no result
 *
 * Messages out:
 *   { type: 'progress', status, file?, progress? } — download/init progress
 *   { type: 'ready' }                              — model loaded and ready
 *   { type: 'partial', text: string }              — running transcript (Nemotron only)
 *   { type: 'result',  text: string }              — transcription complete
 *   { type: 'error',   message: string }           — any failure
 */

const TRANSFORMERS_CDN =
    'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';

let _pipeline = null;
let _nemotron = null;
let _rec      = null; // current utterance: Nemotron stream session, or buffered chunks for Whisper

self.addEventListener('message', async ({ data }) => {
    switch (data.type) {
        case 'load':  await _loadModel(data.model); break;
        case 'start': _start(data.language);        break;
        case 'chunk': _chunk(data.audio);           break;
        case 'end':   await _end();                 break;
        case 'cancel': if (_rec) _rec.cancelled = true; _rec = null; break;
    }
});

function _start(language) {
    _rec = { language, chunks: [], session: _nemotron?.stream(language || 'auto'), last: '', failed: false };
}

function _chunk(audio) {
    const rec = _rec;
    if (!rec) return;
    if (!rec.session) { rec.chunks.push(audio); return; }
    rec.session.push(audio).then((text) => {
        if (rec === _rec && text !== rec.last) { rec.last = text; self.postMessage({ type: 'partial', text }); }
    }).catch((err) => {
        if (!rec.failed) { rec.failed = true; self.postMessage({ type: 'error', message: err.message }); }
    });
}

async function _end() {
    const rec = _rec;
    if (!rec || rec.failed) return;
    const post = (msg) => { if (!rec.cancelled) self.postMessage(msg); };
    try {
        if (rec.session) post({ type: 'result', text: await rec.session.end() });
        else {
            const audio = new Float32Array(rec.chunks.reduce((n, c) => n + c.length, 0));
            rec.chunks.reduce((o, c) => (audio.set(c, o), o + c.length), 0);
            post({ type: 'result', text: await _transcribe(audio, rec.language) });
        }
    } catch (err) {
        if (!rec.failed) post({ type: 'error', message: err.message });
    }
    if (_rec === rec) _rec = null;
}

async function _loadModel(modelId = 'Xenova/whisper-base') {
    try {
        if (modelId.includes('nemotron')) {
            const { loadNemotron } = await import('./nemotron.js');
            _nemotron = await loadNemotron({
                onProgress: ({ file, progress }) => self.postMessage({ type: 'progress', status: 'progress', file, progress }),
            });
            self.postMessage({ type: 'ready' });
            return;
        }

        // Dynamic import with @vite-ignore so the CDN URL is resolved at
        // runtime — Vite will not try to bundle or rewrite this path.
        const { pipeline, env } = await import(/* @vite-ignore */ TRANSFORMERS_CDN);

        // Don't try to load models from the local dev server's /models/ path —
        // always fetch from Hugging Face. Without this, @xenova/transformers
        // requests http://localhost/models/... which Vite serves as index.html,
        // causing JSON.parse to throw "Unexpected token '<'".
        env.allowLocalModels = false;

        // Run ONNX single-threaded — avoids SharedArrayBuffer / COEP requirement.
        env.backends.onnx.wasm.numThreads = 1;

        _pipeline = await pipeline(
            'automatic-speech-recognition',
            modelId,
            {
                progress_callback: (p) => self.postMessage({ type: 'progress', ...p }),
            }
        );
        self.postMessage({ type: 'ready' });
    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
}

async function _transcribe(audio, language) {
    if (!_pipeline) throw new Error('Model not loaded');
    if (!audio.length) return '';
    const opts = { task: 'transcribe' };
    if (language && language !== 'auto') opts.language = language;
    const result = await _pipeline(audio, opts);
    return (result.text ?? '').trim();
}
