# CPU inference (wllama)

A second, **CPU-only** LLM backend alongside the default WebGPU one. Selectable in
Settings → AI Engine.

## What it is
- Engine: [wllama](https://github.com/ngxson/wllama) (llama.cpp → WASM), GGUF **Q4_K_M**.
- Model: `Qwen3.5-2B-GGUF` — same base weights as the GPU default, just CPU-quantised.
- Adapter ([`wllama-engine.js`](../../src/js/assistant/engine/wllama-engine.js)) exposes the *exact* interface WebLLM does (`chat.completions.create` streaming + `interruptGenerate` + `unload`), so chat, sidebar, and evals need no changes.

## Non-obvious config (all in the adapter)
- **`n_gpu_layers: 0`** — wllama v3 auto-offloads to WebGPU otherwise, which defeats the point *and* crashes on its unstable WebGPU ggml path (`ggml_backend_webgpu_synchronize → abort`, unrecoverable until refresh).
- **`n_threads = hardwareConcurrency − 1`** — needs `crossOriginIsolated` (SharedArrayBuffer). Without COOP + **COEP: credentialless** headers it silently falls back to 1 thread → ~10× slower.
- **`reasoning: false` + `enable_thinking: false`** — Qwen3.5 is a thinking model; otherwise it burns the whole token budget inside `<think>` and returns empty content.

## GPU vs CPU
| | GPU (WebLLM) | CPU (wllama) |
|---|---|---|
| Speed | Fast prefill + decode | Slow prefill (TTFT), decent decode |
| Desktop | Contends with the OS compositor → whole-desktop jank (single GPU on macOS) | Keeps desktop responsive |
| Needs | WebGPU (Chrome/Edge/Safari 18+) | Cross-origin isolation for threads |

## Cleanup
Switching models calls `unloadEngine()` → frees the previous engine **and** its
workers, timeout-raced so a busy CPU worker can't hang "Restart AI".

## Discussion topics
- COEP: credentialless enables threads but can affect cross-origin iframes (Browser app).
- TTFT is dominated by **prefill**, not the model — see [prompt-compression](./prompt-compression.md).
- First token is cold (full prefill); follow-ups can hit a warm KV cache.
- No agentic tool-calling on CPU: extra round-trips = extra prefills.
