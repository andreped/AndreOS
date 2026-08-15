/**
 * Cloudflare Pages Function — /api/evals
 *
 * The experiment store's read/write API (an MLflow-lite backend, no server).
 *   • GET  /api/evals               → recent runs (summary rows, newest first)
 *   • GET  /api/evals?configKey=…   → recent runs for one config
 *   • GET  /api/evals?id=123        → the full scorecard JSON for one run
 *   • POST /api/evals               → store a run (body = scorecard JSON)
 *
 * Requires a D1 binding named `EVALS_DB` (Settings → Functions → D1 bindings)
 * with the schema in migrations/0001_create_eval_runs.sql. Writes require
 * `Authorization: Bearer <EVALS_WRITE_TOKEN>`; reads are public.
 */

const HEADLINE_METRIC = {
    retrieval: 'hit3',
    resolution: 'accuracy',
    integrity: 'pass',
    routing: 'accuracy',
    commands: 'exactMatch',
    plan: 'planExactMatch',
    answers: 'ragas',
};

export async function onRequestGet({ request, env }) {
    if (!env.EVALS_DB) return json({ ok: false, reason: 'unbound', runs: [] }, 200, 30);

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
        const row = await env.EVALS_DB.prepare('SELECT scorecard FROM eval_runs WHERE id = ?')
            .bind(Number(id)).first();
        if (!row) return json({ ok: false, reason: 'not-found' }, 404, 0);
        return new Response(row.scorecard, {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' },
        });
    }

    const configKey = url.searchParams.get('configKey');
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 200));
    const cols = 'id, created_at, source, config_key, model, backend, reasoning, language, repeats, runtime_ms, metrics';
    const stmt = configKey
        ? env.EVALS_DB.prepare(`SELECT ${cols} FROM eval_runs WHERE config_key = ? ORDER BY created_at DESC LIMIT ?`).bind(configKey, limit)
        : env.EVALS_DB.prepare(`SELECT ${cols} FROM eval_runs ORDER BY created_at DESC LIMIT ?`).bind(limit);

    const { results } = await stmt.all();
    const runs = (results ?? []).map((r) => ({ ...r, metrics: safeParse(r.metrics) }));
    return json({ ok: true, runs }, 200, 30);
}

export async function onRequestPost({ request, env }) {
    if (!env.EVALS_DB) return json({ ok: false, reason: 'unbound' }, 503, 0);

    // Fail closed: no configured token → no writes (keeps the endpoint from being
    // an open door). With a token, require an exact Bearer match.
    if (!env.EVALS_WRITE_TOKEN) return json({ ok: false, reason: 'write-disabled' }, 403, 0);
    if (request.headers.get('authorization') !== `Bearer ${env.EVALS_WRITE_TOKEN}`) {
        return json({ ok: false, reason: 'unauthorized' }, 401, 0);
    }

    let scorecard;
    try { scorecard = await request.json(); } catch { return json({ ok: false, reason: 'bad-json' }, 400, 0); }
    if (!scorecard?.suites || !scorecard?.config) return json({ ok: false, reason: 'invalid-scorecard' }, 400, 0);

    const cfg = scorecard.config;
    const metrics = {};
    for (const [suite, metric] of Object.entries(HEADLINE_METRIC)) {
        const s = scorecard.suites[suite];
        if (s && !s.skipped && typeof s[metric] === 'number') metrics[suite] = s[metric];
    }

    const res = await env.EVALS_DB.prepare(
        `INSERT INTO eval_runs
            (created_at, source, config_key, model, backend, reasoning, language, repeats, runtime_ms, metrics, scorecard)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        scorecard.generatedAt ?? new Date().toISOString(),
        scorecard.source ?? 'browser',
        scorecard.configKey ?? '',
        cfg.model ?? null,
        cfg.backend ?? null,
        cfg.reasoning ?? null,
        cfg.language ?? null,
        cfg.repeats ?? null,
        typeof scorecard.runtimeMs === 'number' ? scorecard.runtimeMs : null,
        JSON.stringify(metrics),
        JSON.stringify(scorecard),
    ).run();

    return json({ ok: true, id: res.meta?.last_row_id ?? null }, 200, 0);
}

function safeParse(s) {
    try { return JSON.parse(s); } catch { return {}; }
}

function json(body, status, maxAge) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
        },
    });
}
