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
        },
    };
}

export default defineConfig({
    plugins: [evalsSavePlugin()],
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
        // No COEP needed on localhost — Chrome/Edge allow SharedArrayBuffer there
        // without cross-origin isolation. Removing it restores iframe compatibility.
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
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
