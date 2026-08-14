// mlc.worker.js — runs the WebLLM engine off the main thread.
//
// All tokenization and the WebGPU command encoding/submission that WebLLM does
// per dispatch happen here instead of on the UI thread. The main thread only
// exchanges messages with this worker, so the page stays responsive while the
// model prefills/decodes. (GPU *occupancy* is unchanged — this offloads the
// CPU-side submission work, not the GPU compute.)
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);
