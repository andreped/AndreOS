/**
 * VoiceEngine
 *
 * Owns the Whisper Web Worker lifecycle, microphone access (MediaRecorder),
 * and audio decoding/resampling to 16 kHz Float32Array. This is a pure
 * data-pipeline layer — no knowledge of app commands or UI state.
 *
 * Callbacks (all optional):
 *   onReady()                            — model loaded and ready
 *   onProgress({ file, progress })       — download progress per file (0–100)
 *   onTranscript(text: string)           — transcription result
 *   onError(message: string)             — any failure
 */
export class VoiceEngine {
    /**
     * @param {{
     *   onReady?:      () => void,
     *   onProgress?:   (p: { file: string, progress: number }) => void,
     *   onTranscript?: (text: string) => void,
     *   onError?:      (message: string) => void,
     * }} opts
     */
    constructor({ onReady, onProgress, onTranscript, onError, model } = {}) {
        this._onReady      = onReady      ?? (() => {});
        this._onProgress   = onProgress   ?? (() => {});
        this._onTranscript = onTranscript ?? (() => {});
        this._onError      = onError      ?? (() => {});
        this._model         = model ?? 'Xenova/whisper-base';
        this._currentLang   = null;

        this._worker        = null;
        this._ready         = false;
        this._recording     = false;
        this._mediaRecorder = null;
        this._audioChunks   = [];
        this._stream        = null;
    }

    // ── Public read-only state ─────────────────────────────────────────────────

    get isReady()     { return this._ready; }
    get isRecording() { return this._recording; }

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    /**
     * Spawn the Whisper worker and begin model loading.
     * Models are cached in the browser's Cache API — subsequent loads are instant.
     * Safe to call once; subsequent calls are no-ops.
     */
    async init() {
        if (this._worker) return;

        this._worker = new Worker(
            new URL('./whisper.worker.js', import.meta.url),
            { type: 'module' }
        );

        this._worker.addEventListener('message', ({ data }) => this._onWorkerMessage(data));
        this._worker.addEventListener('error', (e) =>
            this._onError(`Worker failed to load: ${e.message ?? e.type}`)
        );
        this._worker.postMessage({ type: 'load', model: this._model });
    }

    /** Release all resources (worker + any open mic stream). */
    destroy() {
        this.stopRecording();
        this._worker?.terminate();
        this._worker  = null;
        this._ready   = false;
    }

    // ── Recording API ──────────────────────────────────────────────────────────

    /**
     * Request mic access and begin recording.
     * @param {{ language?: string }} opts
     */
    async startRecording({ language } = {}) {
        this._currentLang = language ?? null;
        if (this._recording || !this._ready) return;

        try {
            this._stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount:     1,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });
        } catch (err) {
            this._onError(`Microphone access denied: ${err.message}`);
            return;
        }

        this._audioChunks   = [];
        this._mediaRecorder = new MediaRecorder(this._stream);

        this._mediaRecorder.addEventListener('dataavailable', (e) => {
            if (e.data.size > 0) this._audioChunks.push(e.data);
        });

        this._mediaRecorder.addEventListener('stop', () => this._processAudio());

        this._mediaRecorder.start();
        this._recording = true;
    }

    /** Stop recording and trigger transcription. */
    stopRecording() {
        if (!this._recording) return;
        this._recording = false;
        this._mediaRecorder?.stop();
        this._stream?.getTracks().forEach(t => t.stop());
        this._stream        = null;
        this._mediaRecorder = null;
    }

    // ── Private ────────────────────────────────────────────────────────────────

    _onWorkerMessage(data) {
        switch (data.type) {
            case 'ready':
                this._ready = true;
                this._onReady();
                break;
            case 'progress':
                // Only forward file-download progress events (not initiate/done)
                if (data.status === 'progress' && data.file) {
                    this._onProgress({ file: data.file, progress: data.progress ?? 0 });
                }
                break;
            case 'result':
                this._onTranscript(data.text);
                break;
            case 'error':
                this._onError(data.message);
                break;
        }
    }

    /**
     * Decode the recorded blob, resample to 16 kHz mono Float32Array,
     * and transfer it to the worker for transcription (zero-copy).
     */
    async _processAudio() {
        if (this._audioChunks.length === 0) return;

        const mimeType = this._mediaRecorder?.mimeType ?? 'audio/webm';
        const blob     = new Blob(this._audioChunks, { type: mimeType });
        this._audioChunks = [];

        try {
            const arrayBuffer = await blob.arrayBuffer();

            // AudioContext with sampleRate:16000 auto-resamples the decoded audio
            const audioCtx = new AudioContext({ sampleRate: 16_000 });
            const decoded  = await audioCtx.decodeAudioData(arrayBuffer);
            audioCtx.close();

            // .slice() produces an owned copy so we can transfer the buffer
            const samples = decoded.getChannelData(0).slice();

            this._worker.postMessage(
                { type: 'transcribe', audio: samples, language: this._currentLang },
                [samples.buffer]            // zero-copy transfer to worker
            );
        } catch (err) {
            this._onError(`Audio processing failed: ${err.message}`);
        }
    }
}
