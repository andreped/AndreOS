/**
 * Self-check for the experiment helpers (src/js/apps/evals/experiment.js).
 * Pure logic only — no browser, no model. Runnable: node tests/evals/experiment.selfcheck.mjs
 */
import assert from 'node:assert/strict';
import { snapshotConfig, latencyStats, makeTimer, headlineMetrics, suiteModel, suiteLatency, evalLangOf, promptLangOf } from '../../src/js/apps/evals/experiment.js';

// snapshotConfig — stable key + params round-trip
{
    const { config, configKey } = snapshotConfig({
        model: 'Qwen3.5-2B-q4f16_1-MLC', backend: 'webgpu', reasoning: 'none', language: 'en', repeats: 3,
    });
    assert.equal(configKey, 'Qwen3.5-2B-q4f16_1-MLC·webgpu·r:none·en');
    assert.equal(config.backend, 'webgpu');
    assert.equal(config.repeats, 3);
    assert.equal(config.evalLang, 'en');
}

// evalLang — Norwegian runs get their own key; keyless/old runs read as English
{
    const sc = snapshotConfig({ model: 'm', backend: 'webgpu', reasoning: 'none', language: 'auto', evalLang: 'no' });
    assert.equal(sc.configKey, 'm·webgpu·r:none·auto·eval:no');
    assert.equal(evalLangOf(sc), 'no');
    assert.equal(evalLangOf({ config_key: sc.configKey }), 'no', 'cloud row');
    assert.equal(evalLangOf({ configKey: 'm·webgpu·r:none·en' }), 'en', 'pre-bilingual run');
    assert.equal(evalLangOf({}), 'en', 'node scorecard');
    const both = snapshotConfig({ model: 'm', backend: 'b', reasoning: 'none', language: 'en', evalLang: 'no', promptLang: 'no' });
    assert.equal(both.configKey, 'm·b·r:none·en·prompt:no·eval:no');
    assert.equal(evalLangOf(both), 'no', 'eval suffix stays last');
    assert.equal(promptLangOf(both), 'no');
    assert.equal(promptLangOf({ configKey: 'm·b·r:none·en' }), 'en', 'pre-bilingual run');
}

// snapshotConfig + suiteModel — a separate planner is keyed and attributed per suite
{
    const { config, configKey } = snapshotConfig({
        model: 'Qwen3.5-2B-q4f16_1-MLC', planner: 'vela3.1-pico-150m', backend: 'webgpu', reasoning: 'none', language: 'en', repeats: 3,
    });
    assert.equal(configKey, 'Qwen3.5-2B-q4f16_1-MLC·planner:vela3.1-pico-150m·webgpu·r:none·en');
    assert.equal(suiteModel('routing', { config }), 'vela3.1-pico-150m');
    assert.equal(suiteModel('plan', { config }), 'vela3.1-pico-150m');
    assert.equal(suiteModel('answers', { config }), 'Qwen3.5-2B-q4f16_1-MLC');
    assert.equal(suiteModel('retrieval', { config }), 'BM25 keyword search');
    assert.equal(snapshotConfig({ model: 'x', planner: 'x', backend: 'b', reasoning: 'none', language: 'en' }).config.planner, undefined, 'same model → no planner');
    assert.equal(suiteModel('commands', { config, suites: { commands: { model: 'override' } } }), 'override', 'per-suite model wins');
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
    assert.deepEqual(suiteLatency({ suites: { routing: { latency: { p50Ms: 12 } }, answers: { skipped: true, latency: { p50Ms: 9 } }, plan: {} } }),
        { routing: 12 }, 'p50 per suite, skipped/missing omitted');
}

console.log('✅ experiment.selfcheck: all assertions passed');
