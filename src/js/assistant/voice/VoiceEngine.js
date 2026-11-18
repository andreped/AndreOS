/**
 * VoiceEngine
 *
 * Owns the speech Web Worker lifecycle and microphone capture. Mic audio is
 * downsampled to 16 kHz mono and streamed to the worker while recording, so
 * streaming models (Nemotron) report partial transcripts as you speak.
 *
 * Callbacks (all optional):
 *   onReady()                            — model loaded and ready
 *   onProgress({ file, progress })       — download progress per file (0–100)
 *   onPartial(text: string)              — running transcript while recording
 *   onTranscript(text: string)           — final transcription result
 *   onError(message: string)             — any failure
 */

// Taps raw mic samples off the audio thread.
const TAP_WORKLET = `registerProcessor('pcm-tap', class extends AudioWorkletProcessor {
    process([input]) { if (input[0]) this.port.postMessage(input[0].slice()); return true; }
});`;

export class VoiceEngine {
    /**
     * @param {{
     *   onReady?:      () => void,
     *   onProgress?:   (p: { file: string, progress: number }) => void,
     *   onPartial?:    (text: string) => void,
     *   onTranscript?: (text: string) => void,
     *   onError?:      (message: string) => void,
     * }} opts
     */
    constructor({ onReady, onProgress, onPartial, onTranscript, onError, model } = {}) {
        this._onReady      = onReady      ?? (() => {});
        this._onProgress   = onProgress   ?? (() => {});
        this._onPartial    = onPartial    ?? (() => {});
        this._onTranscript = onTranscript ?? (() => {});
        this._onError      = onError      ?? (() => {});
        this._model         = model ?? 'Xenova/whisper-base';

        this._worker        = null;
        this._ready         = false;
        this._recording     = false;
        this._stream        = null;
        this._ctx           = null;
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
     * @param {{ language?: string, realtime?: boolean }} opts  realtime=false buffers until stop
     */
    async startRecording({ language, realtime = true } = {}) {
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

        try {
            // Native-rate context: Firefox can't feed a mic stream into a 16 kHz one.
            this._ctx = new AudioContext();
            const url = URL.createObjectURL(new Blob([TAP_WORKLET], { type: 'text/javascript' }));
            await this._ctx.audioWorklet.addModule(url);
            URL.revokeObjectURL(url);
            const tap = new AudioWorkletNode(this._ctx, 'pcm-tap');
            const down = this._downsampler(this._ctx.sampleRate);
            let buf = [];
            tap.port.onmessage = ({ data }) => {
                buf.push(...down(data));
                if (realtime && buf.length >= 1600) { this._send(buf); buf = []; } // ~100 ms per message
            };
            this._flush = () => { if (buf.length) this._send(buf); buf = []; };
            this._ctx.createMediaStreamSource(this._stream).connect(tap);
        } catch (err) {
            this._releaseMic();
            this._onError(`Audio capture failed: ${err.message}`);
            return;
        }

        this._worker.postMessage({ type: 'start', language: language ?? null });
        this._cancelled = false;
        this._recording = true;
    }

    /** Stop recording and trigger the final transcription. */
    stopRecording() {
        if (!this._recording) return;
        this._recording = false;
        this._flush?.();
        this._releaseMic();
        this._worker?.postMessage({ type: 'end' });
    }

    /** Stop recording (or a pending transcription) and drop its result. */
    cancelRecording() {
        this._recording = false;
        this._cancelled = true;
        this._releaseMic();
        this._worker?.postMessage({ type: 'cancel' });
    }

    _send(samples) {
        const audio = Float32Array.from(samples);
        this._worker?.postMessage({ type: 'chunk', audio }, [audio.buffer]);
    }

    _releaseMic() {
        this._stream?.getTracks().forEach(t => t.stop());
        this._ctx?.close();
        this._stream = null;
        this._ctx    = null;
        this._flush  = null;
    }

    /** Box-filter downsampler to 16 kHz that carries its phase across chunks. */
    _downsampler(rate) {
        const r = rate / 16_000;
        let acc = 0, n = 0, pos = 0;
        return (x) => {
            const out = [];
            for (let i = 0; i < x.length; i++) {
                acc += x[i]; n++;
                if (++pos >= r) { out.push(acc / n); acc = 0; n = 0; pos -= r; }
            }
            return out;
        };
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
            case 'partial':
                if (!this._cancelled) this._onPartial(data.text);
                break;
            case 'result':
                if (!this._cancelled) this._onTranscript(data.text);
                break;
            case 'error':
                this._onError(data.message);
                break;
        }
    }
}
