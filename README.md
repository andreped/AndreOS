# AndreOS

An interactive desktop OS experience serving as my personal portfolio — built entirely with vanilla HTML, CSS, and JavaScript.

## Stack

- **Frontend:** Vanilla HTML · CSS · JavaScript
- **Build tool:** [Vite](https://vitejs.dev/)
- **AI (in-browser):** [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) — SmolLM2-135M running on WebGPU
- **Browser requirement:** Chrome / Edge 113+ for the AI chat feature (WebGPU)

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

## Acknowledgements

- **[Justinianus2001 (Hoang Le Ngoc)](https://github.com/Justinianus2001/my-portfolio)** — the original desktop portfolio template this project is based on. The core window management, taskbar, audio system, and visual design all originate from his work.

- **[MLC AI / web-llm](https://github.com/mlc-ai/web-llm)** — the WebGPU-powered in-browser LLM runtime that powers the **Ask André** chat feature.
