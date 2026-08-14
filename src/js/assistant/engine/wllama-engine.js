// wllama-engine.js — CPU (llama.cpp / WASM) inference adapter.
//
// Wraps wllama in the exact tiny surface chat.js already uses from WebLLM:
//   engine.chat.completions.create({ messages, stream, max_tokens, … })
//        → async iterable of { choices: [{ delta: { content } }] }
//   engine.interruptGenerate()
//   engine.unload()   ← frees the model AND wllama's workers/wasm heap, so
//                        switching models doesn't leave a second model resident.
// wllama's OAI-compatible chunk shape is identical to WebLLM's, so the chat
// window, sidebar, and the eval harness need no changes.
import { Wllama } from '@wllama/wllama/esm/index.js';
import wllamaWasmUrl from '@wllama/wllama/esm/wasm/wllama.wasm?url';

/**
 * @param {string} modelUrl  URL to a GGUF file (Q4_K_M recommended).
 * @param {{ onProgress?: (frac: number) => void, contextSize?: number }} [opts]
 */
export async function createWllamaEngine(modelUrl, { onProgress, contextSize = 4096 } = {}) {
    const wllama = new Wllama({ default: wllamaWasmUrl }, { suppressNativeLog: true });
    // Threads only work when the page is cross-origin isolated (SharedArrayBuffer).
    // Without it wllama is forced to 1 thread → prefill is ~10x slower.
    const isolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
    const nThreads = isolated ? Math.max(1, (navigator.hardwareConcurrency || 4) - 1) : 1;
    console.log(`[wllama] crossOriginIsolated=${isolated}, hardwareConcurrency=${navigator.hardwareConcurrency}, n_threads=${nThreads}`);
    await wllama.loadModelFromUrl(modelUrl, {
        n_ctx: contextSize,
        // Force pure CPU: wllama v3 otherwise auto-offloads all layers to WebGPU,
        // which defeats this backend's purpose (frees the GPU for the compositor)
        // AND crashes on wllama's unstable WebGPU ggml path (ggml_backend_webgpu
        // _synchronize → abort). 0 = no GPU layers.
        n_gpu_layers: 0,
        n_threads: nThreads,
        // Keep any <think> tags inside delta.content (don't split them into a
        // separate reasoning field) so chat.js's stripThink handles them exactly
        // like it does for the WebLLM path.
        reasoning: false,
        progressCallback: ({ loaded, total }) => onProgress?.(total ? loaded / total : 0),
    });

    let abort = null;

    return {
        chat: {
            completions: {
                async create({ messages, max_tokens, temperature, top_p, frequency_penalty, presence_penalty, extra_body }) {
                    abort = new AbortController();
                    const inner = await wllama.createChatCompletion({
                        messages,
                        stream: true,
                        max_tokens,
                        temperature,
                        top_p,
                        penalty_freq: frequency_penalty,
                        penalty_present: presence_penalty,
                        // Thinking models (Qwen3.5) otherwise burn the whole token
                        // budget in <think> and return empty content. Mirror the
                        // WebLLM path's enable_thinking flag (default off).
                        chat_template_kwargs: { enable_thinking: extra_body?.enable_thinking ?? false },
                        abortSignal: abort.signal,
                    });
                    // Swallow the abort so stop/loop-break ends the stream cleanly,
                    // matching WebLLM (whose interruptGenerate finishes, not throws).
                    return (async function* () {
                        try { for await (const chunk of inner) yield chunk; }
                        catch (err) {
                            if (err?.name !== 'WllamaAbortError' && err?.name !== 'AbortError') throw err;
                        }
                    })();
                },
            },
        },
        interruptGenerate() { try { abort?.abort(); } catch { /* ignore */ } },
        unload() { return wllama.exit(); },
    };
}
