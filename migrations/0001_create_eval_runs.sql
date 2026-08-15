-- Eval experiment store (Cloudflare D1 / SQLite).
--
-- One row per eval run — the MLflow "run" record: config (params), headline
-- metrics + timings, and the full scorecard JSON blob for the app to render on
-- demand. Read publicly by /api/evals; written only with the EVALS_WRITE_TOKEN.
--
-- Apply:  wrangler d1 migrations apply andreos_evals   (remote: add --remote)

CREATE TABLE IF NOT EXISTS eval_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT    NOT NULL,          -- scorecard.generatedAt (ISO)
    source      TEXT    NOT NULL,          -- browser | node | ci
    config_key  TEXT    NOT NULL,          -- groups runs of the same config
    model       TEXT,                      -- e.g. Qwen3.5-2B-q4f16_1-MLC
    backend     TEXT,                      -- webgpu | wllama-cpu | node
    reasoning   TEXT,                      -- none | low | medium | high
    language    TEXT,                      -- auto | en | no
    repeats     INTEGER,                   -- LLM samples per case
    runtime_ms  REAL,                      -- overall wall-clock of the run
    metrics     TEXT    NOT NULL,          -- JSON: { suite: headlineNumber }
    scorecard   TEXT    NOT NULL           -- full scorecard JSON
);

CREATE INDEX IF NOT EXISTS idx_eval_runs_config  ON eval_runs (config_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eval_runs_created ON eval_runs (created_at DESC);
