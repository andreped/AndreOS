/**
 * Self-check for the in-browser Nemotron 3.5 ASR engine (src/js/assistant/voice/nemotron.js):
 * transcribes English + Norwegian commands synthesised with macOS `say`, both in one pass and
 * streamed in 100 ms pushes (which must agree), and checks the key words come back.
 * Runnable: node tests/evals/nemotron.selfcheck.mjs [model dir]   (default /tmp/nemo35, a download of
 * huggingface.co/onnx-community/nemotron-3.5-asr-streaming-0.6b-onnx-int4)
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadNemotron } from '../../src/js/assistant/voice/nemotron.js';

const dir = (process.argv[2] ?? '/tmp/nemo35').replace(/\/?$/, '/');
if (!existsSync(dir + 'encoder.onnx.data') || process.platform !== 'darwin') {
    console.log(`⏭  nemotron.selfcheck: needs the ONNX export at ${dir} and macOS \`say\` — skipped`);
    process.exit(0);
}

const CASES = [
    ['english', 'Samantha', 'Open the research app and show me the settings', ['open', 'research', 'settings']],
    // nb-NO is a weak "broad-coverage" locale (and `say`'s Nora voice is hard for it): check robust words only.
    ['norwegian', 'Nora', 'Søk etter publikasjoner om kunstig intelligens og medisinsk bildebehandling', ['kunstig', 'bildebehandling']],
    ['auto', 'Nora', 'Spør André hva han jobber med', ['andr']],
];

function wav(text, voice) {
    const path = `/tmp/nemotron-selfcheck-${voice}-${text.length}.wav`;
    execFileSync('say', ['-v', voice, '-o', path, '--data-format=LEI16@16000', text]);
    return readFile(path).then((b) => {
        const at = b.indexOf('data') + 8;
        const pcm = new Int16Array(b.buffer.slice(b.byteOffset + at, b.byteOffset + b.length - ((b.length - at) % 2)));
        return Float32Array.from(pcm, (s) => s / 32768);
    });
}

const t0 = performance.now();
const asr = await loadNemotron({ baseUrl: dir, fetchBytes: async (p) => new Uint8Array(await readFile(p)) });
console.log(`  loaded on ${asr.device} in ${((performance.now() - t0) / 1000).toFixed(1)} s`);

for (const [lang, voice, text, words] of CASES) {
    const audio = await wav(text, voice);
    const t = performance.now();
    const once = await asr.transcribe(audio, lang);
    const secs = (performance.now() - t) / 1000;

    const s = asr.stream(lang);
    for (let i = 0; i < audio.length; i += 1600) s.push(audio.subarray(i, i + 1600));
    const streamed = await s.end();

    console.log(`  [${lang}] "${once}" (${(audio.length / 16000).toFixed(1)} s audio in ${secs.toFixed(2)} s)`);
    assert.equal(streamed, once, 'streamed pushes must match a single pass');
    const got = once.toLowerCase();
    for (const w of words) assert.ok(got.includes(w), `[${lang}] missing "${w}" in "${once}"`);
}
console.log('✅ nemotron.selfcheck: all assertions passed');
