# AndreOS

An interactive desktop OS experience serving as my personal portfolio — built entirely with vanilla HTML, CSS, and JavaScript.

## Stack

- **Frontend:** Vanilla HTML · CSS · JavaScript
- **Build tool:** [Vite](https://vitejs.dev/)
- **AI chat:** [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) — user-selectable LLM running on WebGPU (default: Qwen2.5-1.5B)
- **Voice commands:** [@xenova/transformers](https://github.com/xenova/transformers.js) + ONNX Runtime Web — Whisper in a Web Worker; model and language configurable
- **Browser requirement:** Chrome / Edge 113+ for AI chat (WebGPU); voice works in any browser with `MediaRecorder` + WASM support

---

## Features

<details open>
<summary><strong>Ask André</strong> — in-browser LLM chat, no API key needed</summary>

Runs entirely on WebGPU. Configurable model (Settings → AI Engine):

| Model | Size | Notes |
|---|---|---|
| SmolLM2 135M | ~265 MB | Fastest, English only |
| **Qwen2.5 1.5B** *(default)* | ~1 GB | Multilingual · Norwegian ✓ |
| Llama 3.2 1B | ~800 MB | Multilingual · Compact |
| Llama 3.2 3B | ~2 GB | Best quality |

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

<details>
<summary><strong>RAG over research papers</strong> — chat answers draw from André's actual publications</summary>

A BM25 index is built over ~50 publications (titles + abstracts) fetched from [OpenAlex](https://openalex.org/) on page load. Top matching papers are automatically injected into the chat context — no extra model needed, zero RAM overhead.

</details>

<details>
<summary><strong>BM25 search</strong> — taskbar search includes apps, content, and publications</summary>

The 🔍 search uses a pure-JS BM25 engine with prefix matching. It searches app entries, content sections, and André's publication abstracts. On mobile, tapping 🔍 opens a macOS Spotlight-style overlay centred on screen.

</details>

<details>
<summary><strong>Settings</strong> — AI model, speech model, and language preferences</summary>

All preferences persist in `localStorage`. Configure via the ⚙️ Settings app or the **EN / NO** taskbar button (updates both transcription and LLM language at once).

- **AI Engine:** LLM model selector · response language (Auto / EN / NO)
- **Speech:** Whisper Tiny / Base / Small · transcription language · AI command parsing toggle

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

> **GitHub Pages** does not support custom response headers — the Ask André AI feature will not work there without a workaround.

</details>

---

## Acknowledgements

- **[Justinianus2001 (Hoang Le Ngoc)](https://github.com/Justinianus2001/my-portfolio)** — the original desktop portfolio template this project is based on. The core window management, taskbar, audio system, and visual design all originate from his work.
- **[MLC AI / web-llm](https://github.com/mlc-ai/web-llm)** — WebGPU-powered in-browser LLM runtime powering Ask André.
- **[OpenAlex](https://openalex.org/)** — open scholarly API used for the Research window and RAG index.
