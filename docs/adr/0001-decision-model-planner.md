# ADR 0001 — A decision model routes and plans; the chat model only writes answers

- **Status:** Accepted (opt-in via Settings → Command planner; default still the chat model)
- **Date:** 2026-11-18
- **Details:** [docs/architecture/decision-models.md](../architecture/decision-models.md)

## Context

Every assistant turn starts with two *decisions* before any answer is written:
**routing** (is this an OS command or a question?) and **planning** (which actions,
in which order). Both were done by the chat LLM generating text/JSON from long
few-shot prompts. That is slow (a full prefill per call, worst on CPU), fragile
(malformed or empty JSON), and the prompts had drifted into containing the eval
cases verbatim.

*Decision models* (e.g. vLLM Semantic Router's Decision / Vela families) don't
generate: given a context and a question with candidate options, they return a
probability per option. Routing and planning are exactly that shape.

## Decision

1. **Route and plan with a decision model**, `vllm-sr/vela3.1-pico-150m`, through
   `routeWithDecisions` / `planWithDecisions` ([decisionPlanner.js](../../src/js/assistant/engine/decisionPlanner.js)).
   The model only *picks* (route, action, app, site); slots (URL, paper number,
   query) come from the request text; `chat` steps go to the chat LLM unchanged.
2. **Run it in the browser with onnxruntime-web**, no server and no Python at
   runtime ([vela.js](../../src/js/assistant/engine/vela.js)): WebGPU when available,
   WASM (CPU) otherwise. Falls back to the chat model if it fails to load.
3. **Ship our own ONNX export** from [huggingface.co/andreped/vela3.1-onnx](https://huggingface.co/andreped/vela3.1-onnx)
   (one folder per variant), produced by [export_vela_web.py](../../scripts/export_vela_web.py)
   with a parity check against the PyTorch package.
   - **WebGPU file:** `model_fp16w.onnx` — weights *stored* fp16, math fp32.
   - **CPU file:** `model_quantized.onnx` — dynamic int8, with RoPE, attention, MLP
     down-projections and the readout heads kept fp32.
4. **Expose it as a setting**, and label every reply in the UI with who handled it
   (⚡ Quick action vs 🧠 the AI).
5. **Score it like any other planner:** evals record the model per suite and the
   median time per call, so planners can be compared per task.

## Findings (why)

Eval sets are small (28 routing cases, 14 commands, 9 multi-turn conversations);
read as indications. Apple M4 Pro, Chrome; score · median time per call.

| Planner | Where | Routing | Commands | Plans | All three |
|---|---|---|---|---|---|
| **vela3.1-pico-150m** | browser · WebGPU | **100% · 37 ms** | **93% · 170 ms** | **89% · 86 ms** | **6.1 s** |
| vela3.1-pico-150m | browser · WASM (CPU) | 100% · 223 ms | 93% · 1.4 s | 89% · 835 ms | 50.7 s |
| vela3.1-pico-380m | browser · WebGPU | 96% · 51 ms | 79% · 284 ms | 56% · 286 ms | 11.4 s |
| Qwen3.5 2B (prompted) | browser · WebGPU (Aug 2026) | 96% · 614 ms | 100% · 2.6 s | 100% · 2.7 s | — |
| Qwen3.5 2B (prompted) | native GPU (Ollama) | 96% · 376 ms | 86% · 658 ms | 78% · 653 ms | 37.7 s |
| Qwen3.5 2B (prompted) | native CPU (Ollama) | 93% · 837 ms | 86% · 1.65 s | 78% · 1.47 s | 85.5 s |
| Qwen2.5 1.5B (prompted) | browser · WebGPU (Aug 2026) | 75% · 291 ms | 93% · 1.5 s | 44% · 1.5 s | — |
| Llama 3.2 3B (prompted) | browser · WebGPU (Aug 2026) | 64% · 568 ms | 50% · 2.8 s | 0% · 2.7 s | — |

- **Much faster where it runs.** In the browser on WebGPU, the decision model routes
  ~17× and plans ~15–30× faster than Qwen3.5 2B doing the same tasks by prompting
  (614 ms vs 37 ms; 2.6–2.7 s vs 86–170 ms). Even against Qwen running *natively* on
  the GPU it is ~10× faster at routing and ~4–8× at planning, and on CPU it still
  finishes all suites ~1.7× sooner.
- **About as accurate, without eval leakage.** Qwen3.5 2B scored 100 % on commands and
  plans in the browser, but its prompts contain eval inputs as few-shot examples; the
  decision model's option descriptions deliberately don't.
- **Small model wins.** pico-150m beats pico-380m on our tasks and is a third of the
  download. 380m is more sensitive to option wording: the prompt change below moved
  its commands from 57% to 79% but its plans from 67% to 56%.
- **Option text matters more than examples.** Decision models are encoders: they
  match the request against option text rather than learning from in-context
  examples, so adding example pairs does little. What helped, tuned on a separate dev
  set ([plannerDev.js](../../tests/evals/datasets/plannerDev.js), 27 fresh phrasings)
  and only then checked on the test sets:
  - describing every app from the registry (catalog subtitle + voice keywords);
  - meaningful option names (`browse:web`, `search:andreos` instead of a bare `search`);
  - taking the in-app search bar only when the request has an explicit search word;
  - describing info requests ("tell me …", "give me …", "list …") under `chat`;
  - skipping `open_paper` when the text has no paper number, and reading a bare
    number ("paper 44") as one.

  Each guard falls back to the next-best option. Dev went from 17 to 27 of 28; on the
  test sets pico-150m plans rose from 78% to 89% (WebGPU) and from 67% to 89% (CPU),
  with commands unchanged at 93% ("show skills" now goes to chat). The longer options
  cost time on CPU (commands median 0.75 s → 1.4 s), much less on WebGPU. Flattening
  every step into one question was worse (79% commands, 44% plans): app keywords
  pulled questions away from `chat`.
- **Other decision models tried** (Python reference server, CPU): d3-edge 86 % / 67 %
  (commands / plans) at 4.7 s per plan, d3-lite 79 % / 67 % at 11 s,
  Decision-1.0-Sol-2B 86 % / 56 % at 11.5 s, Decision-1.0-Kai-0.6B 43 % / 22 %.
- **Precision matters on WebGPU.** Full fp16 *compute* flips decisions on
  onnxruntime-web's WebGPU backend (max |Δp| 0.8) while the same file is fine on CPU;
  fp16-stored weights with fp32 math are exact (|Δp| ≤ 0.0003). 4-bit weights flipped
  decisions too. Naive int8 flipped decisions until the sensitive layers stayed fp32.
- **Decisions run before the answer**, so the decision model and the chat model never
  compete for the device within a turn; on CPU the decision model adds
  ~0.2 s per message (routing) and ~0.6–1.2 s per command (planning).

## Alternatives considered

- **Keep the LLM planner** — slower, needs eval-tuned few-shot prompts, and its
  JSON can be malformed; kept as the default and as a fallback.
- **A Python decision server** — used only as a reference to benchmark models; not
  acceptable at runtime (the site is static).
- **WebLLM for the decision model** — would need a new MLC model definition and a
  custom output path for an encoder, and is WebGPU-only (no CPU fallback).
- **Larger decision models** (pico-380m, vela3.1-fast, d3-*) — bigger downloads,
  no better (or worse) on our tasks; d3-* are also slow on CPU.

## Consequences

- ➕ Routing and planning are fast and deterministic, on any device; the chat model's
  GPU time and context are reserved for answers.
- ➕ Accuracy no longer depends on few-shot examples drawn from the eval set.
- ➖ An extra download (~210 MB CPU / ~305 MB WebGPU, cached after first use) and
  ~600 MB of GPU memory on WebGPU next to the chat model.
- ➖ Slot filling and request splitting use English-only text patterns; Norwegian
  routing works, Norwegian multi-step plans don't yet. The planner sees the focused
  window but not the conversation history.
- ➖ Two planners to maintain and evaluate (shared prompts in [llmPlanner.js](../../src/js/assistant/engine/llmPlanner.js)).

## Follow-ups

- Make the decision model the default planner once a live run of the default setup is committed.
- Decide whether to keep the decision model on CPU when the chat model uses the GPU
  (saves ~600 MB of GPU memory for ~0.2–1.2 s per message), or offer it as a setting.
- Grow the dev and test sets (paraphrases, Norwegian, follow-ups): with 14 commands
  and 9 plans, one case moves a score by 7–11 points.
- Give the planner the previous turn as context. The remaining plan failure is a
  follow-up ("what about his skills?").
- Consider falling back to the chat model when the top decision is not confident.
