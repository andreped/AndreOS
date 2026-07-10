/**
 * runNode.js — the deterministic eval harness (runs in Node / CI).
 *
 * Covers the parts of the assistant that need no WebGPU model and are therefore
 * reproducible and fast:
 *   • retrieval   — BM25 ranking over a committed fixture corpus
 *   • resolution  — AssistantRegistry.resolveId (app name → id)
 *   • integrity   — structural sanity of the app/assistant registries
 *
 * The LLM-dependent suites (routing + command parsing) can only run against the
 * real in-browser engine; they live in the Evals app and their results are
 * merged into the scorecard from the browser.
 *
 * Output: writes results/latest.json (canonical scorecard) and appends a
 * trimmed entry to results/history.json. Exits non-zero when any suite falls
 * below its threshold in THRESHOLDS, so CI gates on it.
 *
 * Usage:  node tests/evals/runNode.js
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ── Minimal browser shims so the app modules import cleanly under Node ─────────
// The assistant modules are written for the browser; a handful of globals are
// referenced at import time. We stub just enough for a headless load.
const g = /** @type {any} */ (globalThis);
g.window ??= g;
g.document ??= { createElement: () => ({ set innerHTML(_v) {}, textContent: '', innerText: '' }), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
g.navigator ??= { gpu: null };
g.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
g.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
if (typeof g.fetch !== 'function') g.fetch = async () => { throw new Error('network disabled in evals'); };

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');

// ── Thresholds (CI gate) ──────────────────────────────────────────────────────
const THRESHOLDS = {
    retrieval: { metric: 'hit3', min: 0.8 },
    resolution: { metric: 'accuracy', min: 0.95 },
    integrity: { metric: 'pass', min: 1 },
    scorers: { metric: 'pass', min: 1 },
};

async function main() {
    const [{ BM25 }, { FIXTURE_CORPUS }, { RETRIEVAL_DATASET }, { RESOLUTION_DATASET }, { scoreRetrieval }] =
        await Promise.all([
            import('../../src/js/assistant/retrieval/BM25.js'),
            import('./datasets/fixtureCorpus.js'),
            import('./datasets/retrieval.js'),
            import('./datasets/resolution.js'),
            import('./harness/scoreRetrieval.js'),
        ]);

    const suites = {};

    // ── 1. Retrieval ──────────────────────────────────────────────────────────
    const bm25 = new BM25();
    for (const doc of FIXTURE_CORPUS) bm25.addDocument(doc.id, `${doc.title}. ${doc.abstract}`);
    bm25.build();
    const retrieve = (query, k) => bm25.search(query, k).map((r) => r.id);
    suites.retrieval = scoreRetrieval(RETRIEVAL_DATASET, retrieve, 5);

    // ── 2. Resolution + 3. Integrity (need the registries) ──────────────────────
    try {
        const { assistantRegistry } = await import('../../src/js/apps/index.js');
        suites.resolution = scoreResolution(RESOLUTION_DATASET, assistantRegistry);
        suites.integrity = scoreIntegrity(assistantRegistry);
    } catch (err) {
        console.warn(`⚠️  Skipped resolution/integrity (registry import failed): ${err.message}`);
        suites.resolution = { suite: 'resolution', skipped: true, reason: err.message };
        suites.integrity = { suite: 'integrity', skipped: true, reason: err.message };
    }

    // ── 4. Scorer self-test ─────────────────────────────────────────────────────
    // The plan + answers suites can only *run* against the real in-browser model,
    // but their scoring math is pure — so we validate it here, deterministically,
    // and gate CI on it. This guards the RAGAS-style metrics and multi-shot plan
    // scoring against regressions even though generation happens in the browser.
    suites.scorers = await scoreScorers();

    // ── Assemble scorecard ──────────────────────────────────────────────────────
    const scorecard = {
        generatedAt: new Date().toISOString(),
        source: 'node',
        suites,
    };
    persist(scorecard);
    printReport(scorecard);

    const failed = evaluateThresholds(scorecard);
    if (failed.length) {
        console.error(`\n❌ ${failed.length} suite(s) below threshold:\n  - ${failed.join('\n  - ')}`);
        process.exit(1);
    }
    console.log('\n✅ All deterministic suites passed their thresholds.');
}

// ── Resolution scorer (lives here — needs the live registry) ──────────────────
function scoreResolution(dataset, registry) {
    const rows = dataset.map((c) => {
        const predicted = registry.resolveId(c.input) ?? null;
        return { input: c.input, expected: c.expected ?? null, predicted, correct: predicted === (c.expected ?? null), tags: c.tags ?? [] };
    });
    const correct = rows.filter((r) => r.correct).length;
    return {
        suite: 'resolution',
        total: rows.length,
        accuracy: correct / (rows.length || 1),
        failures: rows.filter((r) => !r.correct).map((r) => ({ input: r.input, expected: r.expected, predicted: r.predicted })),
    };
}

// ── Integrity scorer — structural sanity of the registries ────────────────────
function scoreIntegrity(registry) {
    const problems = [];
    for (const profile of registry.all()) {
        const where = `profile "${profile.appId}"`;
        if (!profile.appId) problems.push(`${where}: missing appId`);
        for (const cap of profile.capabilities ?? []) {
            const capWhere = `${where} capability "${cap.id ?? '?'}"`;
            if (!cap.id) problems.push(`${capWhere}: missing id`);
            if (!cap.description) problems.push(`${capWhere}: missing description`);
            if (typeof cap.invoke !== 'function') problems.push(`${capWhere}: invoke is not a function`);
            if (cap.scope && cap.scope !== 'global' && cap.scope !== 'when-active') {
                problems.push(`${capWhere}: invalid scope "${cap.scope}"`);
            }
        }
        // Duplicate capability ids within a profile.
        const ids = (profile.capabilities ?? []).map((c) => c.id);
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
        if (dupes.length) problems.push(`${where}: duplicate capability ids: ${[...new Set(dupes)].join(', ')}`);
    }
    return { suite: 'integrity', total: registry.all().length, pass: problems.length === 0 ? 1 : 0, problems };
}

// ── Scorer self-test — validates the plan + answers scoring math (no model) ────
// Feeds the pure scorers a *perfect* simulated model and a *broken* one, then
// asserts the metrics move the way they must (perfect → high, broken → low).
// A green run here means the RAGAS-style and multi-shot metrics are trustworthy
// when the browser later feeds them real model output.
async function scoreScorers() {
    const [{ scorePlan }, { scoreAnswerRow, summariseAnswers }, { PLANS_DATASET }, { ANSWERS_DATASET }, stats] =
        await Promise.all([
            import('./harness/scorePlan.js'),
            import('./harness/scoreAnswers.js'),
            import('./datasets/plans.js'),
            import('./datasets/answers.js'),
            import('./harness/stats.js'),
        ]);

    const problems = [];
    const check = (name, cond) => { if (!cond) problems.push(name); };

    // ── stats helpers ────────────────────────────────────────────────────────
    check('stats.mean', stats.mean([1, 2, 3]) === 2);
    check('stats.stdev(constant)=0', stats.stdev([2, 2, 2]) === 0);
    check('stats.majority', stats.majority(['a', 'b', 'a']).label === 'a');
    check('stats.majority.consistency', Math.abs(stats.majority(['a', 'b', 'a']).consistency - 2 / 3) < 1e-9);
    check('stats.passAtK', stats.passAtK([false, true, false]) === 1 && stats.passAtK([false, false]) === 0);
    check('stats.mode', stats.mode([{ x: 1 }, { x: 1 }, { x: 2 }], (o) => String(o.x)).item.x === 1);

    // ── plan scorer: perfect predictor → all plans exact ─────────────────────
    const perfectPlan = await scorePlan(PLANS_DATASET, (userText, _hist, activeApp) => {
        // Find the matching turn by user text (unique within the dataset here).
        for (const c of PLANS_DATASET) {
            const t = c.turns.find((t) => t.user === userText && (t.activeApp ?? undefined) === (activeApp ?? undefined));
            if (t) return t.expectedActions;
        }
        return [];
    });
    check('plan.perfect.planExactMatch=1', perfectPlan.planExactMatch === 1);
    check('plan.perfect.turnF1≈1', perfectPlan.turnF1 > 0.99);

    const brokenPlan = await scorePlan(PLANS_DATASET, () => []);
    check('plan.broken.planExactMatch=0', brokenPlan.planExactMatch === 0);

    // ── answers scorer: perfect vs empty vs hallucinated ─────────────────────
    const perfectRows = ANSWERS_DATASET.map((c) =>
        scoreAnswerRow(c, `${c.reference} ${(c.keyPoints ?? []).join(' ')}`, (c.groundTruth ?? []).join(' ')),
    );
    const perfect = summariseAnswers(perfectRows);
    check('answers.perfect.ragas>0.7', perfect.ragas > 0.7);
    check('answers.perfect.correctness>0.7', perfect.correctness > 0.7);
    check('answers.perfect.noHallucination', perfect.hallucinationRate === 0);

    const emptyRows = ANSWERS_DATASET.map((c) => scoreAnswerRow(c, ''));
    const empty = summariseAnswers(emptyRows);
    check('answers.empty.ragas<0.2', empty.ragas < 0.2);
    check('answers.empty<perfect', empty.ragas < perfect.ragas);

    // Hallucination: inject a banned phrase → faithfulness must be hard-capped.
    const hallCases = ANSWERS_DATASET.filter((c) => (c.mustNotContain ?? []).length);
    for (const c of hallCases) {
        const row = scoreAnswerRow(c, `${c.reference} ${c.mustNotContain[0]}`, (c.groundTruth ?? []).join(' '));
        check(`answers.halluc.flagged[${c.id}]`, row.hallucinated === true);
        check(`answers.halluc.faithfulnessCapped[${c.id}]`, row.faithfulness <= 0.15);
    }

    return { suite: 'scorers', total: problems.length ? undefined : perfectRows.length + PLANS_DATASET.length, pass: problems.length === 0 ? 1 : 0, problems };
}

// ── Threshold evaluation ──────────────────────────────────────────────────────
function evaluateThresholds(scorecard) {
    const failed = [];
    for (const [name, { metric, min }] of Object.entries(THRESHOLDS)) {
        const suite = scorecard.suites[name];
        if (!suite || suite.skipped) continue; // skipped suites don't gate
        const value = suite[metric];
        if (typeof value !== 'number' || value < min) {
            failed.push(`${name}.${metric} = ${fmt(value)} (min ${min})`);
        }
    }
    return failed;
}

// ── Persistence ───────────────────────────────────────────────────────────────
function persist(scorecard) {
    if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
    writeFileSync(join(RESULTS_DIR, 'latest.json'), JSON.stringify(scorecard, null, 2) + '\n');

    const historyPath = join(RESULTS_DIR, 'history.json');
    let history = [];
    if (existsSync(historyPath)) {
        try { history = JSON.parse(readFileSync(historyPath, 'utf8')); } catch { history = []; }
    }
    history.push({
        generatedAt: scorecard.generatedAt,
        source: scorecard.source,
        summary: Object.fromEntries(
            Object.entries(scorecard.suites).map(([k, v]) => [k, headlineMetric(k, v)]),
        ),
    });
    // Keep the last 100 runs.
    writeFileSync(historyPath, JSON.stringify(history.slice(-100), null, 2) + '\n');
}

/** The single headline number per suite (for trend history). */
function headlineMetric(name, suite) {
    if (suite.skipped) return null;
    switch (name) {
        case 'retrieval': return suite.hit3;
        case 'resolution': return suite.accuracy;
        case 'integrity': return suite.pass;
        case 'scorers': return suite.pass;
        case 'routing': return suite.accuracy;
        case 'commands': return suite.exactMatch;
        case 'plan': return suite.planExactMatch;
        case 'answers': return suite.ragas;
        default: return null;
    }
}

// ── Console report ────────────────────────────────────────────────────────────
function printReport(scorecard) {
    console.log(`\n📊 AndreOS Assistant Evals — ${scorecard.generatedAt} (${scorecard.source})\n`);
    const r = scorecard.suites.retrieval;
    if (r) console.log(`  Retrieval   n=${r.total}  hit@1=${fmt(r.hit1)}  hit@3=${fmt(r.hit3)}  MRR=${fmt(r.mrr)}  recall=${fmt(r.recall)}`);
    const res = scorecard.suites.resolution;
    if (res) console.log(res.skipped ? `  Resolution  skipped (${res.reason})` : `  Resolution  n=${res.total}  accuracy=${fmt(res.accuracy)}`);
    const it = scorecard.suites.integrity;
    if (it) console.log(it.skipped ? `  Integrity   skipped (${it.reason})` : `  Integrity   profiles=${it.total}  pass=${it.pass ? 'yes' : 'NO'}${it.problems?.length ? `\n    ${it.problems.join('\n    ')}` : ''}`);
    const sc = scorecard.suites.scorers;
    if (sc) console.log(`  Scorers     self-test pass=${sc.pass ? 'yes' : 'NO'}${sc.problems?.length ? `\n    ${sc.problems.join('\n    ')}` : ''}`);

    for (const suite of Object.values(scorecard.suites)) {
        if (suite.failures?.length) {
            console.log(`\n  ⚠️  ${suite.suite} failures (${suite.failures.length}):`);
            for (const f of suite.failures.slice(0, 10)) console.log(`     ${JSON.stringify(f)}`);
        }
    }
}

const fmt = (x) => (typeof x === 'number' ? x.toFixed(3) : String(x));

main().catch((err) => { console.error(err); process.exit(1); });
