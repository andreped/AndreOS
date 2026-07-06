/**
 * Whisper Web Worker
 *
 * Loads the Xenova/whisper-base multilingual model via @xenova/transformers
 * and performs automatic speech recognition (ASR) off the main thread.
 *
 * @xenova/transformers is imported at runtime from CDN via a dynamic import
 * so that Vite never pre-bundles it (which would mangle the library's internal
 * import.meta.url paths that ONNX Runtime uses to locate its own .wasm files).
 * The /* @vite-ignore *\/ comment tells Vite to leave the import unresolved
 * at build time.
 *
 * Model is ~74 MB and is cached in the browser's Cache API after first load.
 * Supports English and Norwegian (and 97 other languages).
 *
 * Messages in:
 *   { type: 'load' }
 *   { type: 'transcribe', audio: Float32Array }   — 16 kHz mono
 *
 * Messages out:
 *   { type: 'progress', status, file?, progress? } — download/init progress
 *   { type: 'ready' }                              — model loaded and ready
 *   { type: 'result',  text: string }              — transcription complete
 *   { type: 'error',   message: string }           — any failure
 */

const TRANSFORMERS_CDN =
    'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';

let _pipeline = null;

self.addEventListener('message', async ({ data }) => {
    switch (data.type) {
        case 'load':       await _loadModel(data.model);                    break;
        case 'transcribe': await _transcribe(data.audio, data.language);    break;
    }
});

async function _loadModel(modelId = 'Xenova/whisper-base') {
    try {
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
    if (!_pipeline) {
        self.postMessage({ type: 'error', message: 'Model not loaded' });
        return;
    }
    try {
        const opts = { task: 'transcribe' };
        if (language && language !== 'auto') opts.language = language;
        const result = await _pipeline(audio, opts);
        self.postMessage({ type: 'result', text: (result.text ?? '').trim() });
    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
}
