/**
 * Parity self-check for the in-browser Vela engine (src/js/assistant/engine/vela.js):
 * rendering + tokenisation must reproduce the PyTorch package's ids exactly, and
 * the ONNX probabilities must match its reference answers (parity.json).
 * Runnable: node tests/evals/vela.selfcheck.mjs [model dir]   (default models/vela3.1-onnx/pico-150m)
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { loadVela } from '../../src/js/assistant/engine/vela.js';

const dir = (process.argv[2] ?? 'models/vela3.1-onnx/pico-150m').replace(/\/?$/, '/');
if (!existsSync(dir + 'parity.json')) {
    console.log(`⏭  vela.selfcheck: no export at ${dir} (run scripts/export_vela_web.py) — skipped`);
    process.exit(0);
}
const fetchFn = async (path) => new Response(await readFile(path));
const parity = JSON.parse(await readFile(dir + 'parity.json', 'utf8'));

// tl;dr: int8 tolerance is empirical (dynamic quantisation); fp32 should be ~exact.
for (const [file, tol] of [['onnx/model_quantized.onnx', 0.15], ['onnx/model.onnx', 1e-3]]) {
    // tl;dr: WASM memory tops out at 4 GB, so >1 GB fp32 references (pico-380m) can't load; their int8 still runs.
    if (!existsSync(dir + file) || statSync(dir + file).size > 1e9) { console.log(`  ${file}: skipped (missing or too large for WASM)`); continue; }
    const vela = await loadVela({ baseUrl: dir, file, fetchFn });
    let worst = 0;
    for (const c of parity) {
        const answers = await vela.decide(c.state, c.questions);
        for (const [k, q] of Object.entries(c.questions)) {
            assert.deepEqual(vela.encode(c.state, q).ids, c.ids[k], `ids differ for ${k} in ${JSON.stringify(c.state)}`);
            const ref = c.answers[k], got = answers[k];
            if (q.type === 'noul') {
                worst = Math.max(worst, Math.abs(got.noul - ref.noul));
                if (Math.abs(ref.noul - 0.5) > 0.15) assert.equal(got.noul > 0.5, ref.noul > 0.5, `noul flipped for ${k}`);
            } else {
                for (const n of Object.keys(ref.probabilities)) worst = Math.max(worst, Math.abs(got.probabilities[n] - ref.probabilities[n]));
                assert.equal(got.choice, ref.choice, `choice flipped for ${k}`);
            }
        }
    }
    assert.ok(worst <= tol, `${file}: max |dp| ${worst.toFixed(4)} > ${tol}`);
    console.log(`  ${file}: ids exact, choices match, max |dp| ${worst.toFixed(4)}`);
}
console.log('✅ vela.selfcheck: all assertions passed');
