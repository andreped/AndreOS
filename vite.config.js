import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dev-only endpoint that lets the in-browser Evals app persist a run straight to
 * the repo file on disk (a browser can't write files itself). POST
 * `/__evals/save` with `{ scorecard, entry }` → writes tests/evals/results/
 * latest.json and appends to history.json, matching runNode.js's format.
 * Only active under `vite dev` (apply: 'serve'); never part of a production build.
 */
function evalsSavePlugin() {
    const RESULTS_DIR = path.resolve(__dirname, 'tests/evals/results');
    return {
        name: 'evals-save',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use('/__evals/save', (req, res, next) => {
                if (req.method !== 'POST') return next();
                let body = '';
                req.on('data', (chunk) => { body += chunk; });
                req.on('end', () => {
                    try {
                        const { scorecard, entry } = JSON.parse(body || '{}');
                        if (!scorecard) throw new Error('missing scorecard');
                        fs.mkdirSync(RESULTS_DIR, { recursive: true });
                        fs.writeFileSync(path.join(RESULTS_DIR, 'latest.json'), JSON.stringify(scorecard, null, 2) + '\n');

                        const historyPath = path.join(RESULTS_DIR, 'history.json');
                        let history = [];
                        try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch { history = []; }
                        if (entry) history.push(entry);
                        fs.writeFileSync(historyPath, JSON.stringify(history.slice(-100), null, 2) + '\n');

                        res.statusCode = 200;
                        res.setHeader('content-type', 'application/json');
                        res.end(JSON.stringify({ ok: true }));
                    } catch (err) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ ok: false, error: String(err) }));
                    }
                });
            });

            // Dev-only publish proxy: forwards a scorecard to the cloud experiment
            // store using EVALS_ENDPOINT + EVALS_WRITE_TOKEN from the dev server's
            // env (.env). The token stays in Node — it never reaches the browser —
            // so the one-click UI publish is as safe as the CLI script, and only
            // exists under `vite dev`.
            server.middlewares.use('/__evals/publish', (req, res, next) => {
                if (req.method !== 'POST') return next();
                let body = '';
                req.on('data', (chunk) => { body += chunk; });
                req.on('end', async () => {
                    try { process.loadEnvFile(path.resolve(__dirname, '.env')); } catch { /* no .env — use real env */ }
                    const endpoint = process.env.EVALS_ENDPOINT;
                    const token = process.env.EVALS_WRITE_TOKEN;
                    if (!endpoint || !token) {
                        res.statusCode = 200;
                        res.end(JSON.stringify({ ok: false, reason: 'no-credentials' }));
                        return;
                    }
                    try {
                        const upstream = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                            body: body || '{}',
                        });
                        const text = await upstream.text();
                        res.statusCode = upstream.status;
                        res.setHeader('content-type', 'application/json');
                        res.end(text || JSON.stringify({ ok: upstream.ok }));
                    } catch (err) {
                        res.statusCode = 502;
                        res.end(JSON.stringify({ ok: false, reason: String(err) }));
                    }
                });
            });

            // Dev-only read proxy: forwards a GET (with its query string) to the
            // cloud store's public read endpoint, server-side, so the Experiments
            // tab works under `vite dev` — where /api isn't served and a direct
            // cross-origin fetch to the deployed Function would be CORS-blocked.
            server.middlewares.use('/__evals/list', async (req, res, next) => {
                if (req.method !== 'GET') return next();
                try { process.loadEnvFile(path.resolve(__dirname, '.env')); } catch { /* no .env — use real env */ }
                const endpoint = process.env.EVALS_ENDPOINT;
                if (!endpoint) {
                    res.statusCode = 200;
                    res.end(JSON.stringify({ ok: false, reason: 'no-credentials', runs: [] }));
                    return;
                }
                const q = req.url.indexOf('?');
                const qs = q >= 0 ? req.url.slice(q) : '';
                try {
                    const upstream = await fetch(endpoint + qs);
                    const text = await upstream.text();
                    res.statusCode = upstream.status;
                    res.setHeader('content-type', 'application/json');
                    res.end(text);
                } catch (err) {
                    res.statusCode = 502;
                    res.end(JSON.stringify({ ok: false, reason: String(err), runs: [] }));
                }
            });
        },
    };
}

/**
 * Dev-only mirror of functions/api/pdf.js: GET `/api/pdf?u=<url>` fetches the
 * publisher PDF server-side (no CORS) and streams it back, so the Research app's
 * reader works under `vite dev`. SSRF-guarded: only https URLs present in the
 * static feed (public/scholar/publications.json) are proxied.
 */
function pdfProxyPlugin() {
    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
    const FEED = path.resolve(__dirname, 'public/scholar/publications.json');
    // Mirrors scripts/fetch-scholar-pdfs.mjs: turn OA landing pages into direct-PDF URLs.
    const directPdfUrl = (url) => {
        try {
            const u = new URL(url);
            const h = u.hostname;
            if (h.endsWith('frontiersin.org')) return url.replace(/\/full\/?$/, '/pdf');
            if (h.endsWith('journals.plos.org') && /\/article$/.test(u.pathname)) {
                const id = u.searchParams.get('id');
                if (id) return `${u.origin}${u.pathname}/file?id=${id}&type=printable`;
            }
            if (h.endsWith('mdpi.com') && !/\/pdf$/.test(u.pathname)) return url.replace(/\/?$/, '/pdf');
        } catch { /* fall through */ }
        return url;
    };
    return {
        name: 'pdf-proxy',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use('/api/pdf', async (req, res, next) => {
                if (req.method !== 'GET') return next();
                const u = new URL(req.url, 'http://localhost').searchParams.get('u');
                const fail = (code, msg) => { res.statusCode = code; res.end(msg); };
                if (!u) return fail(400, 'missing ?u');

                let target;
                try { target = new URL(u); } catch { return fail(400, 'bad url'); }
                if (target.protocol !== 'https:') return fail(400, 'https only');

                let allowed = false;
                try {
                    const feed = JSON.parse(fs.readFileSync(FEED, 'utf8'));
                    allowed = (feed.papers || []).some((p) => p.pdfUrl === u || p.publisherUrl === u);
                } catch { /* no feed → deny */ }
                if (!allowed) return fail(403, 'not in feed');

                try {
                    const upstream = await fetch(directPdfUrl(target.href), {
                        headers: { 'user-agent': UA, accept: 'application/pdf,*/*' },
                        redirect: 'follow',
                        signal: AbortSignal.timeout(30_000),
                    });
                    if (!upstream.ok) return fail(502, `upstream ${upstream.status}`);
                    const buf = Buffer.from(await upstream.arrayBuffer());
                    if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return fail(415, 'not a pdf');
                    res.statusCode = 200;
                    res.setHeader('content-type', 'application/pdf');
                    res.setHeader('cache-control', 'public, max-age=86400');
                    res.end(buf);
                } catch (err) {
                    fail(502, `upstream fetch failed: ${err.message}`);
                }
            });
        },
    };
}

export default defineConfig({
    plugins: [evalsSavePlugin(), pdfProxyPlugin()],
    // Prevent Vite from pre-bundling @xenova/transformers.
    // The library uses import.meta.url internally to resolve ONNX WASM file
    // paths; pre-bundling rewrites those URLs and breaks the lookup.
    optimizeDeps: {
        exclude: ['@xenova/transformers', 'onnxruntime-web'],
    },
    root: '.',
    server: {
        port: 3000,
        // The Evals app imports tests/evals/results/*.json, and in dev it can
        // save runs back to those files. Ignore them in the watcher so a save
        // doesn't trigger an HMR full-reload that would wipe the desktop.
        watch: {
            ignored: ['**/tests/evals/results/**'],
        },
        // COEP credentialless enables SharedArrayBuffer → wllama runs multi-threaded
        // (single-thread CPU inference of a 2B is unusably slow). Matches prod
        // (_headers) and preview. credentialless is the least-breaking COEP variant,
        // but the Browser app's cross-origin iframes may be affected in dev.
        headers: {
            'Cross-Origin-Opener-Policy':   'same-origin',
            'Cross-Origin-Embedder-Policy': 'credentialless',
        },
    },
    preview: {
        port: 4173,
        // Production preview still needs credentialless for SharedArrayBuffer.
        // NOTE: test iframe compatibility on your chosen host after deploying.
        headers: {
            'Cross-Origin-Opener-Policy':   'same-origin',
            'Cross-Origin-Embedder-Policy': 'credentialless',
        },
    },
});
