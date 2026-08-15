/**
 * Self-check for the experiment helpers (src/js/apps/evals/experiment.js).
 * Pure logic only — no browser, no model. Runnable: node tests/evals/experiment.selfcheck.mjs
 */
import assert from 'node:assert/strict';
import { snapshotConfig, latencyStats, makeTimer, headlineMetrics } from '../../src/js/apps/evals/experiment.js';

// snapshotConfig — stable key + params round-trip
{
    const { config, configKey } = snapshotConfig({
        model: 'Qwen3.5-2B-q4f16_1-MLC', backend: 'webgpu', reasoning: 'none', language: 'en', repeats: 3,
    });
    assert.equal(configKey, 'Qwen3.5-2B-q4f16_1-MLC·webgpu·r:none·en');
    assert.equal(config.backend, 'webgpu');
    assert.equal(config.repeats, 3);
}

// latencyStats — percentiles, mean, extrema; empty → null
{
    assert.equal(latencyStats([]), null);
    assert.equal(latencyStats([NaN, undefined]), null);
    const s = latencyStats([10, 20, 30, 40, 100]);
    assert.equal(s.n, 5);
    assert.equal(s.minMs, 10);
    assert.equal(s.maxMs, 100);
    assert.equal(s.meanMs, 40);
    assert.equal(s.p50Ms, 30);
    assert.equal(s.p95Ms, 100);
}

// makeTimer — buckets durations per suite and reduces to stats
{
    const timer = makeTimer();
    const r = await timer.run('routing', async () => 42);
    assert.equal(r, 42, 'run() returns the fn result');
    await timer.run('routing', async () => 0);
    const sum = timer.summary();
    assert.equal(sum.routing.n, 2);
    assert.ok(sum.routing.meanMs >= 0);
    assert.equal(sum.commands, undefined, 'unused suites absent');
}

// headlineMetrics — pulls the headline number per suite, skips skipped/missing
{
    const scorecard = {
        suites: {
            routing: { accuracy: 0.9 },
            commands: { exactMatch: 0.6 },
            answers: { skipped: true, reason: 'no model' },
            plan: { planExactMatch: 0.5 },
        },
    };
    const m = headlineMetrics(scorecard);
    assert.deepEqual(m, { routing: 0.9, commands: 0.6, plan: 0.5 });
}

console.log('✅ experiment.selfcheck: all assertions passed');
