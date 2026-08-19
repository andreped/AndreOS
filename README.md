# AndreOS

An interactive desktop OS experience serving as my personal portfolio — built entirely with vanilla HTML, CSS, and JavaScript.

Demo is available at https://andreped.dev.

## Stack

- **Frontend:** Vanilla HTML · CSS · JavaScript
- **Build tool:** [Vite](https://vitejs.dev/)
- **AI chat (GPU):** [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) — user-selectable LLM on WebGPU (default: Qwen3.5-2B), run in a Web Worker
- **AI chat (CPU):** [@wllama/wllama](https://github.com/ngxson/wllama) — llama.cpp/WASM backend for a no-GPU option (same Qwen3.5-2B, GGUF Q4_K_M)
- **Voice commands:** [@xenova/transformers](https://github.com/xenova/transformers.js) + ONNX Runtime Web — Whisper in a Web Worker; model and language configurable
- **Browser requirement:** Chrome 113+, Edge 113+, or Safari 18+ (macOS Sequoia / iOS 18) for GPU AI chat (WebGPU). The CPU model needs no WebGPU; voice works in any browser with `MediaRecorder` + WASM support

---

## Features

<details open>
<summary><strong>OS Assistant</strong> — in-browser LLM chat, no API key needed</summary>

Runs entirely on WebGPU. Configurable model (Settings → AI Engine):

| Model | Size | Notes |
|---|---|---|
| SmolLM2 135M | ~265 MB | Fastest, English only |
| Qwen2.5 1.5B | ~1 GB | Multilingual · Norwegian ✓ |
| Llama 3.2 3B | ~2 GB | Multilingual · Meta |
| **Qwen3.5 2B** *(default)* | ~1.4 GB | Newest · 201 languages · optional **reasoning** |
| Qwen3.5 2B **(CPU)** | ~1.8 GB | Same model on CPU (llama.cpp/WASM) — no GPU needed |

**Reasoning models:** Qwen3.5 can think step-by-step before answering. A **Reasoning effort** selector (Settings → AI Engine) offers `None / Low / Medium / High` — higher means deeper reasoning and a larger token budget, `None` skips thinking for the fastest reply. When it reasons, the thinking is shown in a collapsible block in the OS Assistant, and repetition penalties + a loop-breaker keep the small model from getting stuck. Qwen3.5 isn't in web-llm's bundled list yet, so it's registered as a custom MLC model (see `CUSTOM_MODELS` in [Settings.js](src/js/platform/services/Settings.js)).

</details>

<details open>
<summary><strong>CPU inference</strong> — run the assistant without a GPU</summary>

Pick **Qwen3.5 2B (CPU)** in Settings → AI Engine to run the same model on the CPU via
[wllama](https://github.com/ngxson/wllama) (llama.cpp compiled to WASM) instead of WebGPU.

- **Why:** WebGPU inference contends with the OS compositor for the single GPU, which can jank the whole desktop on macOS. The CPU backend keeps the desktop responsive.
- **Tradeoff:** slower first token (prefill-bound). Needs cross-origin isolation (COOP + COEP) for multithreading — set automatically in the build/preview headers.
- **Prompt compression:** on the CPU path the assistant retrieves only the relevant bio sections (BM25) instead of injecting a ~1,200-token system prompt, and skips the router for plainly conversational text to keep the KV cache warm.

See [docs/architecture/cpu-inference.md](docs/architecture/cpu-inference.md) and [prompt-compression.md](docs/architecture/prompt-compression.md).

</details>

<details open>
<summary><strong>Voice commands</strong> — click 🎤 to control the OS by speech</summary>

| Intent | English | Norwegian |
|---|---|---|
| Open app | `"open resume"`, `"ask André"` | `"åpne CV"`, `"snakk med André"` |
| Close window | `"close window"` | `"lukk vinduet"` |
| Show desktop | `"show desktop"` | `"vis skrivebordet"` |
| Web search | `"search the web for X"`, `"go to github.com"` | — |
| Desktop search | `"search for pathology"` | — |
| Multi-step | `"open chat and ask which day is it"` | — |
| Help | `"help"` | `"hjelp"` |

Compound commands are parsed by the LLM when loaded. Whisper model and language are configurable in Settings → Speech.

</details>

<details open>
<summary><strong>Deep links</strong> — open any app or start a chat directly from a URL</summary>

Apps can be opened directly via URL query parameters — useful for sharing a specific view or linking to the portfolio with a pre-opened app.

| Parameter | Values | Description |
|---|---|---|
| `app` | `about`, `resume`, `projects`, `contact`, `social`, `browser`, `research`, `ironflow`, `game`, `chat`, `settings` | Open the specified app on load |
| `chat` | `1` | Open the OS Assistant sidebar on load |
| `ask` | any string | Open the sidebar and auto-submit a message to the assistant |

**Examples**

```
# Open the About Me window
https://andreped.dev/?app=about

# Open the Research app
https://andreped.dev/?app=research

# Open the browser
https://andreped.dev/?app=browser

# Open Resume with the OS Assistant sidebar
https://andreped.dev/?app=resume&chat=1

# Open only the OS Assistant sidebar
https://andreped.dev/?chat=1

# Ask the assistant a question on load
https://andreped.dev/?ask=Tell%20me%20about%20Andr%C3%A9%27s%20research

# Open the Research app, navigate to the 40th paper, and summarise it
# (requires the AI model to be loaded first — open the OS Assistant once to cache it)
https://andreped.dev/?ask=Open%20research%2C%20open%2040th%20paper%2C%20and%20summarize%20important%20topics%20in%20paper

# Casual, multi-step phrasing — pull up his research, open a paper, and get the gist
https://andreped.dev/?ask=Can%20you%20pull%20up%20his%20research%2C%20open%20the%20second%20paper%2C%20and%20give%20me%20the%20gist%20of%20it
```



The URL is cleaned up after the windows open, so refreshing the page returns to the normal desktop.

</details>

<details>
<summary><strong>RAG over research papers</strong> — chat answers draw from André's actual publications</summary>

A BM25 index is built over ~50 publications (titles + abstracts) from André's [Google Scholar profile](https://scholar.google.com/citations?user=U20zUHQAAAAJ) on page load. When a question is actually about André's research, the top matching papers are injected into the chat context — no extra model needed, zero RAM overhead. (Retrieval is skipped for unrelated questions to keep the prompt small.)

</details>

<details>
<summary><strong>BM25 search</strong> — taskbar search includes apps, content, and publications</summary>

The 🔍 search uses a pure-JS BM25 engine with prefix matching. It searches app entries, content sections, and André's publication abstracts. On mobile, tapping 🔍 opens a macOS Spotlight-style overlay centred on screen.

</details>

<details>
<summary><strong>Settings</strong> — AI model, speech model, and language preferences</summary>

All preferences persist in `localStorage`. Configure via the ⚙️ Settings app or the **EN / NO** taskbar button (updates both transcription and LLM language at once).

- **AI Engine:** LLM model selector · reasoning effort (None / Low / Medium / High) · response language (Auto / EN / NO)
- **Speech:** Whisper Tiny / Base / Small · transcription language · AI command parsing toggle

</details>

<details>
<summary><strong>In-browser evals</strong> — score the assistant live, in the browser</summary>

The **Evals** app scores the assistant (retrieval, resolution, routing, commands, multi-shot plans, RAGAS-style answers) using the *same* scorers as the Node harness (`npm run eval`). Deterministic suites run instantly; the LLM suites run against the real loaded model.

- **Live run** with per-sample progress; **Stop** halts a run mid-flight, and closing the app cancels it too (no background inference left running).
- Runs in the background without blocking the desktop — see [docs/architecture/background-workers.md](docs/architecture/background-workers.md).

</details>

---

## Getting started

<details open>
<summary><strong>Development</strong></summary>

```bash
git clone https://github.com/andreped/AndreOS.git
cd AndreOS/
npm install
npm start          # or: npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> Opening `index.html` directly as a file will not work for the AI chat feature — the Vite dev server is required to set the correct security headers for WebGPU.

</details>

<details>
<summary><strong>Production build</strong></summary>

```bash
npm run build
```

Output goes to `dist/`. The result is a fully static folder with no server-side dependencies.

</details>

<details>
<summary><strong>Deployment</strong></summary>

[Cloudflare Pages](https://pages.cloudflare.com/) is the recommended host — free tier, global CDN, and supports the custom response headers required for WebGPU.

1. Push your code to GitHub
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Configure:

   | Field | Value |
   |---|---|
   | Build command | `npm run build` |
   | Build output directory | `dist` |

4. Click **Deploy**

The `public/_headers` file sets the required COOP/COEP headers automatically.

> **GitHub Pages** does not support custom response headers — the OS Assistant AI feature will not work there without a workaround.

</details>

<details>
<summary><strong>Strava feed (free, no API)</strong></summary>

The **Strava** app shows André's activity history (and the OS Assistant can answer questions about it) **without** Strava's paid API. A weekly GitHub Action reuses your own session cookie to fetch your activities, caches them in **Cloudflare Workers KV**, and serves them via a Pages Function — fully free and static.

See **[docs/strava-feed.md](docs/strava-feed.md)** for how it works and the one-time setup.

</details>

<details>
<summary><strong>Experiment store (eval runs over time)</strong></summary>

The **Evals** app's **Experiments** tab reads a log of past runs — each tagged
with its config (model, backend, reasoning, language) plus metrics and runtime —
from a **Cloudflare D1** database. It's an MLflow-style run log without the
MLflow server: **reads are public**, and **publishing** happens from your machine
or CI (never the browser) so the write token never ships to a client.

See **[docs/architecture/experiment-store.md](docs/architecture/experiment-store.md)** for the data model, API, and one-time setup.

</details>

---

## Architecture notes

Short design docs for the trickier subsystems:

- [CPU inference](docs/architecture/cpu-inference.md) — the wllama backend and how it differs from WebGPU
- [Prompt compression](docs/architecture/prompt-compression.md) — retrieval instead of a big system prompt (TTFT on CPU)
- [Background work](docs/architecture/background-workers.md) — workers, non-blocking evals, cancellable pipeline
- [Assistant & evals](docs/architecture/assistant-evals-architecture.md) — the assistant pipeline and eval suites
- [Experiment store](docs/architecture/experiment-store.md) — persisting & comparing eval runs across configs (Cloudflare D1)

---

## Acknowledgements

- **[Justinianus2001 (Hoang Le Ngoc)](https://github.com/Justinianus2001/my-portfolio)** — the original desktop portfolio template this project is based on. The core window management, taskbar, audio system, and visual design all originate from his work.
- **[MLC AI / web-llm](https://github.com/mlc-ai/web-llm)** — WebGPU-powered in-browser LLM runtime powering the OS Assistant.
- **[wllama](https://github.com/ngxson/wllama)** — llama.cpp compiled to WebAssembly, powering the CPU inference backend.
- **[Google Scholar](https://scholar.google.com/citations?user=U20zUHQAAAAJ)** — scraped weekly (via a proxy) into Cloudflare KV; powers the Research window and RAG index.
