# Background work (workers & non-blocking UI)

Keep heavy work off the UI thread so the OS stays responsive.

## Inference in a Worker
- WebLLM runs in [`mlc.worker.js`](../../src/js/assistant/engine/mlc.worker.js): all
  tokenization + per-dispatch WebGPU command submission (the batch-1 bottleneck) stays off
  the main thread.
- wllama spawns its own worker pool (see [cpu-inference](./cpu-inference.md)).
- Net: the page keeps painting while the model runs.

## Evals that don't block the user
- The live-run loop yields between samples so the UI can update mid-run.
- `requestAnimationFrame` **freezes in a background tab** → a run would hard-stall until
  refocus. Fixed by falling back to `setTimeout` when `document.hidden`
  ([`evals/window.js`](../../src/js/apps/evals/window.js)), so runs keep progressing in the background.

## Cancellable pipeline
The sidebar shows a "thinking" indicator + Stop button the instant you send — *before*
routing — and Stop aborts the whole router→parser→answer pipeline, not just the final stream.

## DEV probe
A `longtask` PerformanceObserver logs main-thread blocked time per generation
([`chat.js`](../../src/js/assistant/engine/chat.js)). Big number = CPU/main-thread bound (a
worker helps); ~0 while the UI still hitches = GPU occupancy starving the compositor (a
worker can't fix that). Enabled in `vite dev`.

## Takeaway
Off-thread compute fixes *main-thread* jank. It does **not** fix GPU contention — only
moving inference to CPU (or a smaller prompt/model) frees the shared GPU for the compositor.
