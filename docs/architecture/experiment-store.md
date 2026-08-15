# Experiment store (eval runs over time)

> How AndreOS persists and compares eval runs across configs — an MLflow-style
> run log with **no MLflow server** (which can't run on Cloudflare). The Evals
> app reads it; publishing happens from a trusted place, never the browser.

---

## The idea

Each live run in the **Evals** app is one *experiment run*: the quality metrics
we already score, plus the **config** it ran under (model, backend, reasoning,
language) and **timings** (single-shot inference latency + overall runtime).
Runs are stored in **Cloudflare D1** (SQLite) and grouped by config so you can
compare, e.g., Qwen 2B on WebGPU vs CPU vs Qwen 4B with reasoning on.

This mirrors MLflow's data model — `experiment → run → {params, metrics, tags}` —
without running MLflow itself. MLflow's tracking server needs a long-lived
Python process + filesystem, which Cloudflare Pages/Workers don't provide; and
since the visualization lives in the Evals app's **Experiments** tab, the MLflow
UI isn't needed either.

## Data model

One row per run in `eval_runs` (schema:
[migrations/0001_create_eval_runs.sql](../../migrations/0001_create_eval_runs.sql)):

| Column | Purpose |
|---|---|
| `config_key`, `model`, `backend`, `reasoning`, `language`, `repeats` | the run's config (MLflow "params"); `config_key` groups runs |
| `metrics` | JSON of headline numbers per suite (routing accuracy, commands exact, …) |
| `runtime_ms` | overall wall-clock of the run |
| `scorecard` | the full scorecard JSON, rendered on demand when a row is opened |

`config` snapshot, latency stats, and the per-suite timer are pure helpers in
[src/js/apps/evals/experiment.js](../../src/js/apps/evals/experiment.js)
(self-checked by `npm run eval:experiment`).

## Read/write API

A single Pages Function, [functions/api/evals.js](../../functions/api/evals.js):

- `GET /api/evals` → recent runs (summary rows); `?configKey=` filters; `?id=`
  returns one run's full scorecard. **Public — no token.**
- `POST /api/evals` → store a run. **Requires** `Authorization: Bearer
  <EVALS_WRITE_TOKEN>` and fails closed if the token isn't configured.

## Why publish from CI/local, not the browser

Any credential the browser holds can be read from the browser (DevTools,
network tab, XSS), so there's no safe way to embed a write token client-side.
Instead the browser only **reads**; publishing runs from a trusted place (your
machine or CI) where the token is a real secret. `EVALS_WRITE_TOKEN` is just a
random string you invent (`openssl rand -hex 32`) — server-side it lives as a
Pages secret, and it never touches shipped code or a browser.

## One-time setup

1. Create the database and apply the schema:

   ```sh
   npx wrangler login
   npx wrangler d1 create andreos_evals
   npx wrangler d1 migrations apply andreos_evals --remote
   ```

   `wrangler` needs a config file to resolve the DB; a **gitignored**
   `wrangler.jsonc` with the `EVALS_DB` binding + `database_id` is enough (the
   Pages runtime binding is set in the dashboard, below). Alternatively, skip the
   CLI and paste the schema into the D1 **Console** in the dashboard.

2. In the Pages project → **Settings → Functions**:
   - **D1 database bindings**: bind the database as `EVALS_DB`.
   - **Environment variables (secret)**: set `EVALS_WRITE_TOKEN` to your random string.

   Then redeploy so the Function picks up the binding.

## Publishing a run

Run the evals live in the app, then publish the scorecard — either the one
`vite dev` auto-saves to `tests/evals/results/latest.json`, or the app's
**Export** download:

```sh
EVALS_ENDPOINT=https://<your-site>/api/evals \
EVALS_WRITE_TOKEN=<same-token> \
npm run eval:publish -- tests/evals/results/latest.json
```

The script ([scripts/publish-eval.mjs](../../scripts/publish-eval.mjs)) reads a
local `.env` if present, so you can keep `EVALS_ENDPOINT` / `EVALS_WRITE_TOKEN`
there instead of typing them each time. In CI, pass them as secrets. Runs are
never stored in the repo.
