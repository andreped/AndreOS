/**
 * Evals app window logic.
 *
 * Two modes feed the same scorecard UI:
 *   • Committed  — imports tests/evals/results/latest.json (what CI last wrote)
 *                  and history.json for the trend sparklines.
 *   • Live       — re-runs every suite in the browser. The deterministic suites
 *                  (retrieval / resolution / integrity) run instantly; the
 *                  LLM suites (routing / commands) call the real Ask André
 *                  engine (window.AndreChat) and only run once the model is
 *                  loaded. A live run can be downloaded as JSON to commit.
 *
 * The scorers are the exact same modules the Node harness uses, so committed
 * and live numbers are directly comparable.
 */
import { BM25 } from '../../assistant/retrieval/BM25.js';
import { assistantRegistry } from '../../assistant/registry/AssistantRegistry.js';
import { ActiveContext } from '../../assistant/retrieval/ActiveContext.js';

import { FIXTURE_CORPUS } from '../../../../tests/evals/datasets/fixtureCorpus.js';
import { RETRIEVAL_DATASET } from '../../../../tests/evals/datasets/retrieval.js';
import { RESOLUTION_DATASET } from '../../../../tests/evals/datasets/resolution.js';
import { ROUTING_DATASET } from '../../../../tests/evals/datasets/routing.js';
import { COMMANDS_DATASET } from '../../../../tests/evals/datasets/commands.js';
import { PLANS_DATASET } from '../../../../tests/evals/datasets/plans.js';
import { ANSWERS_DATASET } from '../../../../tests/evals/datasets/answers.js';

import { buildRetrievalRow, summariseRetrieval } from '../../../../tests/evals/harness/scoreRetrieval.js';
import { summariseRouting } from '../../../../tests/evals/harness/scoreRouting.js';
import { buildRow, summariseCommands } from '../../../../tests/evals/harness/scoreCommands.js';
import { scorePlanCase, summarisePlan } from '../../../../tests/evals/harness/scorePlan.js';
import { scoreAnswerRow, summariseAnswers } from '../../../../tests/evals/harness/scoreAnswers.js';
import { routeLabel } from '../../../../tests/evals/harness/normalize.js';
import { mean, stdev, majority, mode, passAtK, repeat } from '../../../../tests/evals/harness/stats.js';

// How many times each LLM sample is re-run to measure nondeterminism. Real
// model calls vary run-to-run, so a single sample is misleading — we repeat and
// report both the central metric and its run-to-run stability. Deterministic
// suites ignore this (their output never changes).
const REPEATS = 3;

// ── Per-suite display config (headline metric, threshold, description) ─────────
const SUITE_META = {
    retrieval:  { label: 'Retrieval',  metric: 'hit3',         fmt: 'pct', min: 0.8,  desc: 'BM25 paper ranking',        subs: [['hit@1', 'hit1', 'pct'], ['MRR', 'mrr', 'num'], ['recall', 'recall', 'pct']] },
    resolution: { label: 'Resolution', metric: 'accuracy',     fmt: 'pct', min: 0.95, desc: 'App name → id',              subs: [] },
    integrity:  { label: 'Integrity',  metric: 'pass',         fmt: 'bool', min: 1,   desc: 'Registry structure',        subs: [['profiles', 'total', 'int']] },
    routing:    { label: 'Routing',    metric: 'accuracy',     fmt: 'pct', min: 0.8,  desc: 'Command vs ask (LLM)',       subs: [['precision', 'precision', 'pct'], ['recall', 'recall', 'pct'], ['stability', 'stability', 'pct'], ['pass@k', 'passAtK', 'pct']] },
    commands:   { label: 'Commands',   metric: 'exactMatch',   fmt: 'pct', min: 0.6,  desc: 'Right actions · single-shot (LLM)', subs: [['action F1', 'actionF1', 'num'], ['target acc', 'targetAccuracy', 'pct'], ['stability', 'stability', 'pct'], ['pass@k', 'passAtK', 'pct']] },
    plan:       { label: 'Plan',       metric: 'planExactMatch', fmt: 'pct', min: 0.5, desc: 'Right plan · multi-shot (LLM)', subs: [['turn exact', 'turnExactMatch', 'pct'], ['turn F1', 'turnF1', 'num'], ['stability', 'stability', 'pct'], ['pass@k', 'passAtK', 'pct']] },
    answers:    { label: 'Answers',    metric: 'ragas',        fmt: 'pct', min: 0.4,  desc: 'RAGAS-style answer quality (LLM)', subs: [['faithful', 'faithfulness', 'pct'], ['correct', 'correctness', 'pct'], ['relevant', 'relevancy', 'pct'], ['halluc.', 'hallucinationRate', 'pct'], ['stability', 'stability', 'pct']] },
};
const SUITE_ORDER = ['routing', 'commands', 'plan', 'answers', 'retrieval', 'resolution', 'integrity'];

// A visitor's own runs are kept privately in localStorage (never committed to the
// repo). Only the trend history is stored — the default view on open is always the
// committed latest.json, so everyone sees the published, canonical results first.
const LS_HISTORY = 'andreos:evals:history';

export function setupEvalsWindow(winEl) {
    const grid       = winEl.querySelector('#evals-grid');
    const failuresEl = winEl.querySelector('#evals-failures');
    const scTabsEl   = winEl.querySelector('#evals-sc-tabs');
    const metricsView  = winEl.querySelector('#evals-sc-metrics');
    const failuresView = winEl.querySelector('#evals-sc-failures');
    const statusEl   = winEl.querySelector('#evals-status');
    const sourceEl   = winEl.querySelector('#evals-source');
    const runBtn     = winEl.querySelector('#evals-run');
    const exportBtn  = winEl.querySelector('#evals-export');
    const copyBtn    = winEl.querySelector('#evals-copy');
    const jsonEl     = winEl.querySelector('#evals-json');
    const datasetEl  = winEl.querySelector('#evals-dataset');
    const dsTabsEl   = winEl.querySelector('#evals-ds-tabs');
    const runIndicator = winEl.querySelector('#evals-run-indicator');

    // Run-panel elements
    const runEmpty    = winEl.querySelector('#evals-run-empty');
    const runProgress = winEl.querySelector('#evals-run-progress');
    const suiteTabsEl = winEl.querySelector('#evals-suite-tabs');
    const followBtn   = winEl.querySelector('#evals-follow');
    const parentName  = winEl.querySelector('#evals-parent-name');
    const parentCnt   = winEl.querySelector('#evals-parent-cnt');
    const parentFill  = winEl.querySelector('#evals-parent-fill');
    const childName   = winEl.querySelector('#evals-child-name');
    const childCnt    = winEl.querySelector('#evals-child-cnt');
    const childFill   = winEl.querySelector('#evals-child-fill');
    const checklist   = winEl.querySelector('#evals-checklist');
    const checklistHead = winEl.querySelector('#evals-checklist-head');

    let current = null;   // the scorecard currently on screen
    let history = [];     // trend history
    let running = false;
    let dsActiveIdx = 0;  // which dataset the Dataset tab is showing
    let scView = 'metrics'; // Scorecard sub-view: 'metrics' | 'failures'

    // ── Tabs ────────────────────────────────────────────────────────────────
    const tabs   = [...winEl.querySelectorAll('.evals-tab')];
    const panels = [...winEl.querySelectorAll('.evals-panel')];
    function activateTab(name) {
        tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
        panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
        if (name === 'json') paintJson();
    }
    tabs.forEach((t) => t.addEventListener('click', (e) => { e.stopPropagation(); activateTab(t.dataset.tab); }));
    paintDataset();

    dsTabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ds]');
        if (!btn) return;
        e.stopPropagation();
        dsActiveIdx = Number(btn.dataset.ds);
        paintDataset();
    });

    scTabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sc]');
        if (!btn) return;
        e.stopPropagation();
        scView = btn.dataset.sc;
        renderScorecardTabs();
    });
    renderScorecardTabs();

    function renderScorecardTabs() {
        const failCount = current
            ? SUITE_ORDER.reduce((n, k) => n + (current.suites[k]?.failures?.length ?? 0), 0)
            : 0;
        scTabsEl.innerHTML =
            `<button class="eval-suite-tab${scView === 'metrics' ? ' active' : ''}" data-sc="metrics">Metrics</button>`
          + `<button class="eval-suite-tab${scView === 'failures' ? ' active' : ''}" data-sc="failures">Failures${failCount ? ` (${failCount})` : ''}</button>`;
        metricsView.style.display  = scView === 'metrics'  ? '' : 'none';
        failuresView.style.display = scView === 'failures' ? '' : 'none';
    }

    // ── Load results ─────────────────────────────────────────────────────────
    // Default view = the committed latest.json (the published, canonical results).
    // A visitor's own runs live only in localStorage and feed the trend sparklines;
    // they never override the default on open and are never persisted to the repo.
    (async () => {
        let committedHistory = [];
        try {
            const [{ default: latest }, hist] = await Promise.all([
                import('../../../../tests/evals/results/latest.json'),
                import('../../../../tests/evals/results/history.json').catch(() => ({ default: [] })),
            ]);
            committedHistory = hist.default ?? [];
            current = latest;
        } catch { /* no committed scorecard yet */ }

        // Merge the visitor's private local runs into the trend history only.
        try {
            const localHistory = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
            history = [...committedHistory, ...(Array.isArray(localHistory) ? localHistory : [])];
        } catch { history = committedHistory; }

        if (current) paint();
        else statusEl.textContent = 'No results yet — click “Run live evals”.';
    })();

    // ── Live-run state + reporter (drives the Run panel) ───────────────────────
    // runState keeps every suite's labels + per-sample statuses, so the user can
    // navigate between suites (even mid-run) and toggle “follow” the running one.
    let runState = null;

    function renderSuiteTabs() {
        if (!runState) { suiteTabsEl.innerHTML = ''; return; }
        suiteTabsEl.innerHTML = runState.suites.map((s, i) => {
            const active = i === runState.activeIdx ? ' active' : '';
            return `<button class="eval-suite-tab${active}" data-status="${s.status}" data-idx="${i}">`
                + `<span class="eval-suite-dot"></span>${SUITE_META[s.key].label}</button>`;
        }).join('');
    }

    function renderFollowBtn() {
        const active = !!(runState && runState.follow);
        followBtn.textContent = active ? '👁 Following' : '👁 Follow run';
        followBtn.classList.toggle('secondary', !active);
        followBtn.style.display = (runState && runState.runningIdx >= 0) ? '' : 'none';
    }

    function renderViewedSuite() {
        if (!runState) return;
        const s = runState.suites[runState.activeIdx];
        const meta = SUITE_META[s.key];
        const total = s.labels.length;
        const done = s.statuses.filter((x) => x === 'pass' || x === 'fail' || x === 'skip').length;
        childName.textContent = `${meta.label} — ${meta.desc}`;
        childCnt.textContent = `${done} / ${total}`;
        childFill.style.width = `${total ? (done / total) * 100 : 0}%`;
        childFill.classList.toggle('done', s.status === 'done');
        checklistHead.textContent = checklistHeadText(s);
        checklist.innerHTML = s.labels.map((l, i) => chkItem(i, l, s.statuses[i])).join('');
    }

    function updateParent(fraction = 0) {
        if (!runState) return;
        const total = runState.total || 1;
        parentFill.style.width = `${Math.min(100, ((runState.completed + fraction) / total) * 100)}%`;
        const cur = Math.min(runState.completed + (runState.runningIdx >= 0 ? 1 : 0), total);
        parentCnt.textContent = `${cur} / ${total}`;
        parentName.textContent = runState.runningIdx >= 0
            ? SUITE_META[runState.suites[runState.runningIdx].key].label
            : (runState.completed >= total ? 'complete' : '');
    }

    function viewSuite(idx) {
        if (!runState) return;
        runState.activeIdx = idx;
        renderSuiteTabs();
        renderViewedSuite();
    }

    suiteTabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-idx]');
        if (!btn || !runState) return;
        e.stopPropagation();
        runState.follow = false;
        viewSuite(Number(btn.dataset.idx));
        renderFollowBtn();
    });

    followBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!runState) return;
        runState.follow = true;
        if (runState.runningIdx >= 0) viewSuite(runState.runningIdx);
        renderFollowBtn();
    });

    const reporter = {
        onStatus: (msg) => { statusEl.textContent = msg; },
        onInit(descs) {
            runState = {
                suites: descs.map((d) => ({
                    key: d.key, labels: d.samples,
                    statuses: d.samples.map(() => 'pending'),
                    status: 'pending', reason: null,
                })),
                total: descs.length, completed: 0, runningIdx: -1, activeIdx: 0, follow: true,
            };
            renderSuiteTabs();
            renderFollowBtn();
            viewSuite(0);
            updateParent(0);
        },
        onSuiteStart(idx) {
            runState.runningIdx = idx;
            const s = runState.suites[idx];
            s.status = 'running';
            if (s.labels.length) s.statuses[0] = 'running';
            renderSuiteTabs();
            renderFollowBtn();
            if (runState.follow) viewSuite(idx);
            else if (runState.activeIdx === idx) renderViewedSuite();
            updateParent(0);
            statusEl.textContent = `Running ${SUITE_META[s.key].label}… (suite ${idx + 1}/${runState.total})`;
        },
        onSample(idx, i, status) {
            const s = runState.suites[idx];
            s.statuses[i] = status;
            const hasNext = i + 1 < s.labels.length;
            if (hasNext) s.statuses[i + 1] = 'running';
            if (runState.activeIdx === idx) {
                setChk(checklist, i, status);
                if (hasNext) setChk(checklist, i + 1, 'running');
                childCnt.textContent = `${i + 1} / ${s.labels.length}`;
                childFill.style.width = `${((i + 1) / s.labels.length) * 100}%`;
                checklistHead.textContent = checklistHeadText(s);
            }
            updateParent((i + 1) / s.labels.length);
        },
        onSuiteSkip(idx, reason) {
            const s = runState.suites[idx];
            s.status = 'skip'; s.reason = reason;
            s.statuses = s.labels.map(() => 'skip');
            renderSuiteTabs();
            if (runState.activeIdx === idx) renderViewedSuite();
            updateParent(0);
        },
        onSuiteDone(idx) {
            runState.suites[idx].status = 'done';
            runState.completed = idx + 1;
            renderSuiteTabs();
            if (runState.activeIdx === idx) renderViewedSuite();
            updateParent(0);
        },
        onAllDone() {
            runState.runningIdx = -1;
            parentFill.classList.add('done');
            renderFollowBtn();
            updateParent(0);
        },
    };

    // ── Buttons ─────────────────────────────────────────────────────────────
    // Record a run's headline metrics in the visitor's private local trend only.
    function persistRun(entry) {
        try {
            const stored = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
            const arr = Array.isArray(stored) ? stored : [];
            arr.push(entry);
            localStorage.setItem(LS_HISTORY, JSON.stringify(arr.slice(-100)));
        } catch { /* storage full/blocked — non-fatal */ }
    }

    runBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (running) return;
        running = true;
        runBtn.disabled = true;
        runIndicator.style.display = 'inline-block';
        runEmpty.style.display = 'none';
        runProgress.style.display = ''; // let CSS drive the flex column layout
        activateTab('run');
        try {
            current = await runLive(reporter);
            reporter.onAllDone();
            const entry = historyEntry(current);
            history = [...history, entry];
            persistRun(entry);
            paint();
            statusEl.textContent = summaryLine(current);
            if (import.meta.env.DEV) await saveToDiskDev(current, entry);
        } catch (err) {
            statusEl.textContent = `Run failed: ${err.message}`;
        } finally {
            running = false;
            runBtn.disabled = false;
            runIndicator.style.display = 'none';
        }
    });

    copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!current) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(current, null, 2));
            copyBtn.textContent = '✓ Copied';
            setTimeout(() => { copyBtn.textContent = '⧉ Copy'; }, 1500);
        } catch { /* clipboard blocked — ignore */ }
    });

    // Export the current scorecard as latest.json (same format runNode.js writes).
    // Anyone can download it to inspect; a developer drops it into
    // tests/evals/results/ to publish (in dev mode this is saved automatically).
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!current) return;
        const blob = new Blob([JSON.stringify(current, null, 2) + '\n'], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'latest.json';
        a.click();
        URL.revokeObjectURL(a.href);
        exportBtn.textContent = '✓ Downloaded';
        setTimeout(() => { exportBtn.textContent = '⬇ Export'; }, 2000);
    });

    // In `vite dev` on localhost, save runs straight to the repo file on disk via
    // a dev-only server endpoint (browsers can't write files themselves). No-op
    // in a production build, where import.meta.env.DEV is false.
    async function saveToDiskDev(scorecard, entry) {
        try {
            const res = await fetch('/__evals/save', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scorecard, entry }),
            });
            if (res.ok) statusEl.textContent = `${summaryLine(scorecard)} · saved to tests/evals/results/latest.json`;
        } catch { /* dev endpoint unavailable — ignore */ }
    }

    // ── Render ──────────────────────────────────────────────────────────────
    function paint() {
        if (!current) return;
        const when = new Date(current.generatedAt).toLocaleString();
        sourceEl.textContent = `· ${current.source} · ${when}`;
        if (!running) statusEl.textContent = summaryLine(current);

        grid.innerHTML = SUITE_ORDER
            .filter((k) => current.suites[k])
            .map((k) => cardHtml(k, current.suites[k], history))
            .join('');

        const failsHtml = SUITE_ORDER
            .map((k) => current.suites[k])
            .filter((s) => s && s.failures?.length)
            .map(failureTable)
            .join('');
        failuresEl.innerHTML = failsHtml || '<div class="eval-empty">No failing samples in this run 🎉</div>';
        renderScorecardTabs();
        paintJson();
    }

    function paintJson() {
        jsonEl.textContent = current ? JSON.stringify(current, null, 2) : '{}';
    }

    function paintDataset() {
        dsTabsEl.innerHTML = DATASET_SECTIONS.map((s, i) =>
            `<button class="eval-suite-tab${i === dsActiveIdx ? ' active' : ''}" data-ds="${i}">${s.title}</button>`,
        ).join('');
        datasetEl.innerHTML = dsSectionHtml(DATASET_SECTIONS[dsActiveIdx]);
    }

    function cardHtml(key, suite, hist) {
        const meta = SUITE_META[key];
        if (suite.skipped) {
            return `<div class="eval-card"><h3>${meta.label}</h3><div class="eval-desc">${meta.desc}</div>
                <div class="eval-metric"><span class="val" style="color:var(--text-faint)">—</span></div>
                <span class="eval-badge na">not run</span>
                <div class="eval-sub">${escapeHtml(suite.reason ?? 'skipped')}</div></div>`;
        }
        const value = suite[meta.metric];
        const pass  = typeof value === 'number' && value >= meta.min;
        const badge = meta.fmt === 'bool'
            ? (value ? '<span class="eval-badge pass">PASS</span>' : '<span class="eval-badge fail">FAIL</span>')
            : `<span class="eval-badge ${pass ? 'pass' : 'fail'}">${pass ? 'PASS' : 'BELOW'} · min ${fmtVal(meta.min, meta.fmt)}</span>`;

        const subs = meta.subs
            .filter(([, field]) => suite[field] != null)
            .map(([lbl, field, f]) => `<span><b>${fmtVal(suite[field], f)}</b> ${lbl}</span>`)
            .join('');

        return `
        <div class="eval-card">
            <h3>${meta.label}</h3>
            <div class="eval-desc">${meta.desc} · n=${suite.total ?? '?'}</div>
            <div class="eval-metric">
                <span class="val" style="color:${pass ? 'var(--text-strong)' : '#f87171'}">${fmtVal(value, meta.fmt)}</span>
                <span class="lbl">${meta.metric}</span>
            </div>
            ${badge}
            ${subs ? `<div class="eval-sub">${subs}</div>` : ''}
            ${trendHtml(key, hist)}
        </div>`;
    }

    function trendHtml(key, hist) {
        const vals = hist.map((h) => h.summary?.[key]).filter((v) => typeof v === 'number');
        if (vals.length < 2) return '';
        const bars = vals.slice(-16).map((v) => `<div class="bar" style="height:${Math.max(6, v * 100)}%"></div>`).join('');
        return `<div class="eval-trend" title="last ${Math.min(16, vals.length)} runs">${bars}</div>`;
    }
}

// ── Live run: every suite in the browser, with per-sample progress ────────────
const raf = () => new Promise((r) => requestAnimationFrame(() => r()));

async function runLive(reporter) {
    const suites = {};
    const chat = /** @type {any} */ (window).AndreChat;
    const engineReady = !!chat && chat.currentModelId != null;
    const runners = buildRunners(chat);

    reporter.onInit(runners.map((r) => ({ key: r.key, samples: r.samples })));

    for (let idx = 0; idx < runners.length; idx++) {
        const rn = runners[idx];
        reporter.onSuiteStart(idx);
        if (rn.needsModel && !engineReady) {
            const reason = 'Open “Ask André” to load the AI model first';
            suites[rn.key] = { suite: rn.key, skipped: true, reason };
            reporter.onSuiteSkip(idx, reason);
            await raf();
            continue;
        }
        suites[rn.key] = await rn.run((i, status) => reporter.onSample(idx, i, status));
        reporter.onSuiteDone(idx);
    }
    reporter.onStatus('Done.');
    return { generatedAt: new Date().toISOString(), source: 'browser', suites };
}

/** Ordered suite runners — deterministic suites first (instant), model suites last. */
function buildRunners(chat) {
    return [
        { key: 'retrieval',  samples: RETRIEVAL_DATASET.map((c) => c.query), run: retrievalRunner },
        { key: 'resolution', samples: RESOLUTION_DATASET.map((c) => c.input), run: resolutionRunner },
        { key: 'integrity',  samples: ['Registry structure & capabilities'], run: integrityRunner },
        { key: 'routing',  needsModel: true, samples: ROUTING_DATASET.map((c) => c.input),  run: (emit) => routingRunner(emit, chat) },
        { key: 'commands', needsModel: true, samples: COMMANDS_DATASET.map((c) => c.input), run: (emit) => commandsRunner(emit, chat) },
        { key: 'plan',     needsModel: true, samples: PLANS_DATASET.map((c) => c.id),       run: (emit) => planRunner(emit, chat) },
        { key: 'answers',  needsModel: true, samples: ANSWERS_DATASET.map((c) => c.question), run: (emit) => answersRunner(emit, chat) },
    ];
}

async function retrievalRunner(emit) {
    const bm25 = new BM25();
    for (const d of FIXTURE_CORPUS) bm25.addDocument(d.id, `${d.title}. ${d.abstract}`);
    bm25.build();
    const retrieve = (q, k) => bm25.search(q, k).map((r) => r.id);
    const rows = [];
    for (let i = 0; i < RETRIEVAL_DATASET.length; i++) {
        const row = buildRetrievalRow(RETRIEVAL_DATASET[i], retrieve, 5);
        rows.push(row);
        emit(i, row.hit3 ? 'pass' : 'fail');
        await raf();
    }
    return summariseRetrieval(rows, 5);
}

async function resolutionRunner(emit) {
    const rows = [];
    for (let i = 0; i < RESOLUTION_DATASET.length; i++) {
        const c = RESOLUTION_DATASET[i];
        const predicted = assistantRegistry.resolveId(c.input) ?? null;
        const correct = predicted === (c.expected ?? null);
        rows.push({ input: c.input, expected: c.expected ?? null, predicted, correct });
        emit(i, correct ? 'pass' : 'fail');
        await raf();
    }
    const correct = rows.filter((r) => r.correct).length;
    return {
        suite: 'resolution',
        total: rows.length,
        accuracy: correct / (rows.length || 1),
        failures: rows.filter((r) => !r.correct).map((r) => ({ input: r.input, expected: r.expected, predicted: r.predicted })),
    };
}

async function integrityRunner(emit) {
    const result = scoreIntegrity(assistantRegistry);
    emit(0, result.pass ? 'pass' : 'fail');
    await raf();
    return result;
}

async function routingRunner(emit, chat) {
    const rows = [];
    const consistencies = [];
    const passAtKs = [];
    for (let i = 0; i < ROUTING_DATASET.length; i++) {
        const c = ROUTING_DATASET[i];
        const expected = routeLabel(c.expected);
        // Repeat to expose nondeterminism: take the majority label, and record
        // how consistent the runs were + whether any run got it right (pass@k).
        const labels = await repeat(async () => routeLabel(await chat.routeIntent(c.input, [])), REPEATS);
        const { label: predicted, consistency } = majority(labels);
        const correct = predicted === expected;
        consistencies.push(consistency);
        passAtKs.push(passAtK(labels.map((l) => l === expected)));
        rows.push({ input: c.input, expected, predicted, correct, tags: c.tags ?? [] });
        emit(i, correct ? 'pass' : 'fail');
        await raf();
    }
    return summariseRouting(rows, { stability: mean(consistencies), passAtK: mean(passAtKs), repeats: REPEATS });
}

async function commandsRunner(emit, chat) {
    const rows = [];
    const stabilities = [];
    const passAtKs = [];
    for (let i = 0; i < COMMANDS_DATASET.length; i++) {
        const c = COMMANDS_DATASET[i];
        // Repeat, score each run, then take the modal action plan as the
        // representative. Stability = how often the modal plan recurred.
        const runs = await repeat(async () => buildRow(c, (await chat.parseCommand(c.input, [])) ?? []), REPEATS);
        const { item: row, consistency } = mode(runs, (r) => r.predicted.join('|'));
        stabilities.push(consistency);
        passAtKs.push(passAtK(runs.map((r) => r.exact)));
        rows.push(row);
        emit(i, row.exact ? 'pass' : 'fail');
        await raf();
    }
    return summariseCommands(rows, { stability: mean(stabilities), passAtK: mean(passAtKs), repeats: REPEATS });
}

// ── Multi-shot planning: whole conversations, history carried across turns ────
async function planRunner(emit, chat) {
    const predictTurn = (userText, history) => chat.parseCommand(userText, history);
    const cases = [];
    const stabilities = [];
    const passAtKs = [];
    for (let i = 0; i < PLANS_DATASET.length; i++) {
        const c = PLANS_DATASET[i];
        // Repeat the whole conversation; take the modal plan-correctness outcome.
        const runs = await repeat(() => scorePlanCase(c, predictTurn), REPEATS);
        const { item: rep, consistency } = mode(runs, (r) => String(r.planExact));
        stabilities.push(consistency);
        passAtKs.push(passAtK(runs.map((r) => r.planExact)));
        cases.push(rep);
        emit(i, rep.planExact ? 'pass' : 'fail');
        await raf();
    }
    return summarisePlan(cases, { stability: mean(stabilities), passAtK: mean(passAtKs), repeats: REPEATS });
}

// ── RAGAS-style answer quality: score the free text the model writes ──────────
async function answersRunner(emit, chat) {
    const min = SUITE_META.answers.min;
    // The answer suite is expensive (full RAG generation per case) and its
    // metric moves slowly, so a single pass is enough — no 3× repeats here.
    const ANSWERS_REPEATS = 1;
    const rows = [];
    const stabilities = [];
    const passAtKs = [];
    for (let i = 0; i < ANSWERS_DATASET.length; i++) {
        const c = ANSWERS_DATASET[i];
        ActiveContext.setActiveApp(c.activeApp ?? null);
        // Repeat generation; average each RAGAS facet and measure run-to-run
        // stability of the headline (1 − stdev of ragas).
        const runs = await repeat(async () => {
            const out = (await chat.answer(c.question)) ?? { text: '', context: '' };
            return scoreAnswerRow(c, out.text, out.context);
        }, ANSWERS_REPEATS);
        const avgRow = {
            ...runs[0],
            faithfulness: mean(runs.map((r) => r.faithfulness)),
            correctness:  mean(runs.map((r) => r.correctness)),
            relevancy:    mean(runs.map((r) => r.relevancy)),
            ragas:        mean(runs.map((r) => r.ragas)),
            hallucinated: runs.filter((r) => r.hallucinated).length > runs.length / 2,
        };
        stabilities.push(1 - stdev(runs.map((r) => r.ragas)));
        passAtKs.push(passAtK(runs.map((r) => r.ragas >= min)));
        rows.push(avgRow);
        emit(i, avgRow.ragas >= min ? 'pass' : 'fail');
        await raf();
    }
    ActiveContext.setActiveApp(null);
    return summariseAnswers(rows, { stability: mean(stabilities), passAtK: mean(passAtKs), repeats: ANSWERS_REPEATS }, min);
}

// ── Checklist item helpers (per-sample progress rows) ─────────────────────────
function chkItem(i, label, status) {
    return `<div class="eval-chk" data-status="${status}" data-i="${i}">
        <span class="eval-chk-box">${boxIcon(status)}</span>
        <span class="eval-chk-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
    </div>`;
}

function setChk(container, i, status) {
    const el = container.querySelector(`[data-i="${i}"]`);
    if (!el) return;
    el.dataset.status = status;
    const box = el.querySelector('.eval-chk-box');
    if (box) box.textContent = boxIcon(status);
}

function boxIcon(status) {
    return status === 'pass' ? '✓' : status === 'fail' ? '✕'
        : status === 'running' ? '↻' : status === 'skip' ? '–' : '○';
}

/** Checklist header text: suite label + live "passed/processed (pct%) passed". */
function checklistHeadText(s) {
    const meta = SUITE_META[s.key];
    const total = s.labels.length;
    if (s.status === 'skip') return `${meta.label} · skipped — ${s.reason}`;
    const passed = s.statuses.filter((x) => x === 'pass').length;
    const processed = s.statuses.filter((x) => x === 'pass' || x === 'fail').length;
    const tail = processed ? ` · ${passed}/${processed} (${Math.round((passed / processed) * 100)}%) passed` : '';
    return `${meta.label} · ${total} sample${total === 1 ? '' : 's'}${tail}`;
}

// ── Registry integrity scorer (mirrors runNode.js) ────────────────────────────
function scoreIntegrity(registry) {
    const problems = [];
    for (const profile of registry.all()) {
        for (const cap of profile.capabilities ?? []) {
            const w = `${profile.appId}.${cap.id ?? '?'}`;
            if (!cap.id) problems.push(`${w}: missing id`);
            if (!cap.description) problems.push(`${w}: missing description`);
            if (typeof cap.invoke !== 'function') problems.push(`${w}: invoke not a function`);
        }
    }
    return { suite: 'integrity', total: registry.all().length, pass: problems.length === 0 ? 1 : 0, problems };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function historyEntry(scorecard) {
    return {
        generatedAt: scorecard.generatedAt,
        source: scorecard.source,
        summary: Object.fromEntries(
            Object.entries(scorecard.suites).map(([k, v]) => [k, v.skipped ? null : v[SUITE_META[k]?.metric]]),
        ),
    };
}

function summaryLine(scorecard) {
    const parts = SUITE_ORDER
        .filter((k) => scorecard.suites[k] && !scorecard.suites[k].skipped)
        .map((k) => `${SUITE_META[k].label} ${fmtVal(scorecard.suites[k][SUITE_META[k].metric], SUITE_META[k].fmt)}`);
    return parts.join('   ·   ') || 'No suites recorded.';
}

function failureTable(suite) {
    const rows = suite.failures.slice(0, 15).map((f) => {
        const cells = Object.entries(f).map(([k, v]) => `${k}=<code>${escapeHtml(JSON.stringify(v))}</code>`).join('  ');
        return `<tr><td>${cells}</td></tr>`;
    }).join('');
    return `<div class="eval-section-title" style="font-size:11px;color:var(--text-faint)">${suite.suite} (${suite.failures.length})</div>
        <table class="eval-fail-table"><tbody>${rows}</tbody></table>`;
}

// ── Dataset inspector ─ renders the golden datasets that drive each suite ──────
const DATASET_SECTIONS = [
    { title: 'Routing', desc: 'command vs ask', rows: () => ROUTING_DATASET, cols: [
        ['Input', (c) => escapeHtml(c.input)],
        ['Expected', (c) => `<code>${c.expected}</code>`],
        ['Tags', (c) => dsTags(c.tags)],
    ] },
    { title: 'Commands', desc: 'right actions · single-shot', rows: () => COMMANDS_DATASET, cols: [
        ['Input', (c) => escapeHtml(c.input)],
        ['Expected actions', (c) => `<code>${escapeHtml(JSON.stringify(c.expectedActions))}</code>`],
        ['Tags', (c) => dsTags(c.tags)],
    ] },
    { title: 'Plan', desc: 'right plan · multi-shot', rows: () => PLANS_DATASET, cols: [
        ['Conversation', (c) => `<code>${escapeHtml(c.id)}</code>`],
        ['Turns', (c) => c.turns.map((t, i) => `${i + 1}. ${escapeHtml(t.user)} → <code>${escapeHtml(JSON.stringify(t.expectedActions))}</code>`).join('<br>')],
        ['Tags', (c) => dsTags(c.tags)],
    ] },
    { title: 'Answers', desc: 'RAGAS-style answer quality', rows: () => ANSWERS_DATASET, cols: [
        ['Question', (c) => escapeHtml(c.question)],
        ['Reference', (c) => escapeHtml(c.reference)],
        ['Key points', (c) => (c.keyPoints ?? []).map((k) => `<code>${escapeHtml(k)}</code>`).join(' ')],
        ['Tags', (c) => dsTags(c.tags)],
    ] },
    { title: 'Retrieval', desc: 'BM25 paper ranking', rows: () => RETRIEVAL_DATASET, cols: [
        ['Query', (c) => escapeHtml(c.query)],
        ['Relevant docs', (c) => c.relevant.map((id) => `<code>${escapeHtml(id)}</code>`).join(' ')],
        ['Tags', (c) => dsTags(c.tags)],
    ] },
    { title: 'Resolution', desc: 'app name → id', rows: () => RESOLUTION_DATASET, cols: [
        ['Input', (c) => escapeHtml(c.input)],
        ['Expected', (c) => (c.expected == null ? '<code>null</code>' : `<code>${escapeHtml(c.expected)}</code>`)],
        ['Tags', (c) => dsTags(c.tags)],
    ] },
    { title: 'Fixture corpus', desc: 'offline retrieval corpus', rows: () => FIXTURE_CORPUS, cols: [
        ['ID', (c) => `<code>${escapeHtml(c.id)}</code>`],
        ['Title', (c) => escapeHtml(c.title)],
    ] },
];

function dsSectionHtml(s) {
    const rows = s.rows();
    const head = `<tr>${s.cols.map(([h]) => `<th>${h}</th>`).join('')}</tr>`;
    const body = rows.map((r) => `<tr>${s.cols.map(([, fn]) => `<td>${fn(r)}</td>`).join('')}</tr>`).join('');
    return `<div class="eval-ds-section">
        <div class="eval-ds-head"><h3>${s.title}</h3><span class="cnt">${rows.length} samples</span><span class="desc">· ${s.desc}</span></div>
        <table class="eval-ds-table"><thead>${head}</thead><tbody>${body}</tbody></table>
    </div>`;
}

function dsTags(tags) {
    return (tags ?? []).map((t) => `<span class="eval-ds-tag">${escapeHtml(t)}</span>`).join('');
}

function fmtVal(v, fmt) {
    if (v == null) return '—';
    if (fmt === 'pct') return `${Math.round(v * 100)}%`;
    if (fmt === 'num') return v.toFixed(2);
    if (fmt === 'int') return String(v);
    if (fmt === 'bool') return v ? 'PASS' : 'FAIL';
    return String(v);
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
