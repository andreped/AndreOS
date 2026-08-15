/**
 * Publish an eval scorecard to the cloud experiment store (Cloudflare D1).
 *
 * Run from a trusted place — your machine or CI — so the write token never
 * touches a browser. Reads are public; only publishing needs the token.
 *
 *   EVALS_ENDPOINT=https://<your-site>/api/evals \
 *   EVALS_WRITE_TOKEN=… \
 *   node scripts/publish-eval.mjs [path/to/scorecard.json]
 *
 * Defaults to tests/evals/results/latest.json — what a live run in `vite dev`
 * auto-saves, or what the Evals app's Export button downloads.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env if present (local runs); CI passes the vars directly in the environment.
try { process.loadEnvFile(join(__dirname, '..', '.env')); } catch { /* no .env — use real env */ }

const endpoint = process.env.EVALS_ENDPOINT;
const token = process.env.EVALS_WRITE_TOKEN;
if (!endpoint || !token) {
    console.error('Set EVALS_ENDPOINT and EVALS_WRITE_TOKEN before publishing.');
    process.exit(1);
}

const path = process.argv[2]
    ? resolve(process.argv[2])
    : join(__dirname, '..', 'tests/evals/results/latest.json');

let scorecard;
try { scorecard = JSON.parse(readFileSync(path, 'utf8')); }
catch (err) { console.error(`Could not read scorecard at ${path}: ${err.message}`); process.exit(1); }

// Deterministic Node runs carry no config; only browser experiment runs do.
if (!scorecard?.config || !scorecard?.suites) {
    console.error('Scorecard is missing config/suites — publish a browser experiment run.');
    process.exit(1);
}

const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(scorecard),
});
const body = await res.json().catch(() => ({}));
if (!res.ok || !body.ok) {
    console.error(`Publish failed (${res.status}): ${body.reason ?? 'unknown'}`);
    process.exit(1);
}
console.log(`✅ Published run #${body.id} (${scorecard.configKey}) to ${endpoint}`);
