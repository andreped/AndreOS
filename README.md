# AndreOS

An interactive desktop OS experience serving as my personal portfolio — built entirely with vanilla HTML, CSS, and JavaScript.

## Stack

- **Frontend:** Vanilla HTML · CSS · JavaScript
- **Build tool:** [Vite](https://vitejs.dev/)
- **AI chat (in-browser):** [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) — SmolLM2-135M running on WebGPU
- **Voice dictation (in-browser):** [@xenova/transformers](https://github.com/xenova/transformers.js) + [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html) — Whisper base (multilingual) running in a Web Worker; model cached via browser Cache API after first load (~74 MB)
- **Browser requirement:** Chrome / Edge 113+ for the AI chat feature (WebGPU); Voice dictation works in any browser with `MediaRecorder` and WASM support (Chrome, Edge, Firefox, Safari 16+)

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

[Cloudflare Pages](https://pages.cloudflare.com/) is the recommended host — free tier, global CDN, and supports the custom response headers required for the AI chat feature (WebGPU).

1. Push your code to GitHub
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git**
3. Select the `AndreOS` repo and configure:

   | Field | Value |
   |---|---|
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Deploy command | *(leave empty)* |

4. Click **Deploy**

The `public/_headers` file in this repo automatically sets the required COOP/COEP headers on every deploy — no extra configuration needed.

> **GitHub Pages** does not support custom response headers, so the **Ask André** AI feature will not work there without a workaround.

</details>

---

## Voice Dictation

Click the mic icon (🎤) in the taskbar system tray to activate voice control. On first use, the Whisper base model (~74 MB) is downloaded and cached — subsequent loads are instant.

**Supported commands (English and Norwegian):**

| Intent | English examples | Norwegian examples |
|---|---|---|
| Open app | `"open resume"`, `"show projects"`, `"ask André"` | `"åpne CV"`, `"prosjekter"`, `"snakk med André"` |
| Close window | `"close window"`, `"shut down"` | `"lukk vinduet"`, `"avslutt"` |
| Minimize | `"minimize window"` | `"minimer vinduet"` |
| Show desktop | `"show desktop"` | `"vis skrivebordet"` |
| Help | `"help"`, `"list commands"` | `"hjelp"`, `"kommandoer"` |

**Technical details:**
- Runs entirely in the browser via a Web Worker — no server, no API key
- Model: `Xenova/whisper-base` (multilingual, supports English + Norwegian + 97 others)
- ONNX Runtime Web in single-threaded mode — no `SharedArrayBuffer`/COEP requirement
- Audio decoded and resampled to 16 kHz mono `Float32Array` before inference
- Model cached in browser Cache API

---

## Acknowledgements

- **[Justinianus2001 (Hoang Le Ngoc)](https://github.com/Justinianus2001/my-portfolio)** — the original desktop portfolio template this project is based on. The core window management, taskbar, audio system, and visual design all originate from his work.

- **[MLC AI / web-llm](https://github.com/mlc-ai/web-llm)** — the WebGPU-powered in-browser LLM runtime that powers the **Ask André** chat feature.
