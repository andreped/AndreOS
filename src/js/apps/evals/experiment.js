/**
 * Experiment helpers — the small, pure pieces that turn one eval run into an
 * MLflow-style "run": a config snapshot (params), latency stats (metrics), and a
 * timer to measure single-shot inference. Kept framework-free so the Node
 * self-check (tests/evals/experiment.selfcheck.mjs) exercises the same code the
 * browser Evals app runs.
 */

/** Headline metric per suite — mirrors SUITE_META, but usable outside the app
 *  (the Pages Function reads this shape to store queryable columns). */
export const HEADLINE_METRIC = {
    retrieval: 'hit3',
    resolution: 'accuracy',
    integrity: 'pass',
    routing: 'accuracy',
    commands: 'exactMatch',
    plan: 'planExactMatch',
    answers: 'ragas',
};

/**
 * Snapshot the run's configuration (the "params" of the experiment) and derive a
 * stable key so runs with the same config group together across time. `model` is
 * the chat model (answers); `planner` the model that routes/plans, when different.
 */
export function snapshotConfig({ model, planner, backend, reasoning, language, repeats }) {
    const config = { model, planner: planner && planner !== model ? planner : undefined, backend, reasoning, language, repeats };
    const configKey = `${model ?? 'no-chat'}${config.planner ? `·planner:${config.planner}` : ''}·${backend}·r:${reasoning}·${language}`;
    return { config, configKey };
}

/**
 * Which model produced each suite's predictions. Routing/commands/plan come from
 * the planner (a decision model or the chat model); answers from the chat model;
 * the deterministic suites use no model at all. Older scorecards fall back to config.
 */
export function suiteModel(key, scorecard) {
    const s = scorecard?.suites?.[key];
    if (s?.model) return s.model;
    const { model, planner } = scorecard?.config ?? {};
    return { retrieval: 'BM25 keyword search', resolution: 'rules (app registry)', integrity: 'static check',
        routing: planner ?? model, commands: planner ?? model, plan: planner ?? model, answers: model }[key] ?? null;
}

/** p50/p95/mean/min/max over an array of millisecond samples (null if empty). */
export function latencyStats(samples) {
    const arr = (samples ?? []).filter((n) => Number.isFinite(n));
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const q = (p) => s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))];
    return {
        n: s.length,
        meanMs: s.reduce((a, b) => a + b, 0) / s.length,
        p50Ms: q(0.5),
        p95Ms: q(0.95),
        minMs: s[0],
        maxMs: s[s.length - 1],
    };
}

/**
 * Per-suite single-shot timer. `run(suite, fn)` times one model call and buckets
 * its duration under that suite; `summary()` reduces each bucket to latencyStats.
 * Uses performance.now() when available, Date.now() otherwise (both expose .now).
 */
export function makeTimer() {
    const clock = globalThis.performance ?? Date;
    const bySuite = {};
    return {
        async run(suite, fn) {
            const t0 = clock.now();
            try { return await fn(); }
            finally { (bySuite[suite] ??= []).push(clock.now() - t0); }
        },
        summary() {
            const out = {};
            for (const [k, v] of Object.entries(bySuite)) out[k] = latencyStats(v);
            return out;
        },
    };
}

/** Flatten a scorecard's headline metrics into a compact { suite: number } map. */
export function headlineMetrics(scorecard) {
    const out = {};
    for (const [suite, metric] of Object.entries(HEADLINE_METRIC)) {
        const s = scorecard?.suites?.[suite];
        if (s && !s.skipped && typeof s[metric] === 'number') out[suite] = s[metric];
    }
    return out;
}
