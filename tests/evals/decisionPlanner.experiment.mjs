/**
 * Decision-model planner experiment: runs the commands + plan golden sets through
 * decisionPlanner.js against a local System One endpoint, and compares with the
 * LLM planner baseline in results/latest.json. No chat LLM needed — `chat` steps
 * are scored by presence only. Each run is appended to results/experiments.json
 * (shown in the Evals app's Experiments tab).
 *
 * Usage:  uv run scripts/decision_server.py --model <hf-id>   (in another terminal)
 *         node tests/evals/decisionPlanner.experiment.mjs
 *   or, in-process with the browser engine (onnxruntime-web, no Python):
 *         VELA_DIR=models/vela3.1-onnx/pico-150m [VELA_FILE=onnx/model.onnx] node tests/evals/decisionPlanner.experiment.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

// Same headless shims as runNode.js so the app registry imports under Node.
const g = /** @type {any} */ (globalThis);
g.window ??= g;
g.document ??= { createElement: () => ({ set innerHTML(_v) {}, textContent: '', innerText: '' }), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
g.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
g.sessionStorage ??= g.localStorage;

const { appRegistry } = await import('../../src/js/apps/index.js');
const { planWithDecisions, routeWithDecisions } = await import('../../src/js/assistant/engine/decisionPlanner.js');
const { COMMANDS_DATASET } = await import('./datasets/commands.js');
const { PLANS_DATASET } = await import('./datasets/plans.js');
const { ROUTING_DATASET } = await import('./datasets/routing.js');
const { summariseRouting } = await import('./harness/scoreRouting.js');
const { buildRow, summariseCommands } = await import('./harness/scoreCommands.js');
const { scorePlan } = await import('./harness/scorePlan.js');
const { snapshotConfig, latencyStats } = await import('../../src/js/apps/evals/experiment.js');

const ENDPOINT = process.env.DECISION_URL ?? 'http://127.0.0.1:8765/v1/systemone';
const apps = appRegistry.launchable();
const ms = { commands: [], plan: [] };
let suite = 'commands';
let server = {};
const vela = process.env.VELA_DIR && await (await import('../../src/js/assistant/engine/vela.js')).loadVela({
    baseUrl: process.env.VELA_DIR.replace(/\/?$/, '/'), file: process.env.VELA_FILE,
    fetchFn: async (path) => new Response(await readFile(path)),
});

async function decide(state, questions) {
    if (vela) {
        server = { model: vela.model, device: `onnxruntime-web·${vela.device}·${(process.env.VELA_FILE ?? 'onnx/model_quantized.onnx').split('/').pop()}` };
        return vela.decide(state, questions);
    }
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state, questions }) });
    if (!res.ok) throw new Error(`System One ${res.status}: ${await res.text()}`);
    const { answers, model, device } = await res.json();
    server = { model, device };
    for (const [id, a] of Object.entries(answers)) if (a.error) throw new Error(`${id}: ${a.error}`);
    return answers;
}

async function plan(text, activeApp) {
    const t0 = performance.now();
    const out = await planWithDecisions(text, { decide, apps, activeApp });
    ms[suite].push(performance.now() - t0);
    return out ?? [];
}

const rows = [];
const t0 = performance.now();
const routeMs = [];
const routeRows = [];
for (const c of ROUTING_DATASET) {
    const t = performance.now();
    const predicted = await routeWithDecisions(c.input, { decide });
    routeMs.push(performance.now() - t);
    routeRows.push({ input: c.input, expected: c.expected, predicted, correct: predicted === c.expected, tags: c.tags ?? [] });
}
const routing = summariseRouting(routeRows);
for (const c of COMMANDS_DATASET) rows.push(buildRow(c, await plan(c.input, c.activeApp)));
const commands = summariseCommands(rows);
suite = 'plan';
const planSuite = await scorePlan(PLANS_DATASET, (text, _history, activeApp) => plan(text, activeApp));
const runtimeMs = performance.now() - t0;

const { config, configKey } = snapshotConfig({
    model: null, planner: server.model ?? 'unknown', backend: `decision·${server.device ?? '?'}`, reasoning: 'none', language: 'en', repeats: 1,
});
const by = { model: config.planner };
const scorecard = {
    generatedAt: new Date().toISOString(), source: 'decision-planner', config, configKey, runtimeMs,
    suites: {
        routing: { ...routing, ...by, latency: latencyStats(routeMs) },
        commands: { ...commands, ...by, latency: latencyStats(ms.commands) },
        plan: { ...planSuite, ...by, latency: latencyStats(ms.plan) },
    },
};
const expPath = new URL('./results/experiments.json', import.meta.url);
const runs = existsSync(expPath) ? JSON.parse(readFileSync(expPath, 'utf8')) : [];
writeFileSync(expPath, JSON.stringify([...runs, scorecard].slice(-50), null, 2) + '\n');

const base = JSON.parse(readFileSync(new URL('./results/latest.json', import.meta.url), 'utf8'));
const llm = base.suites;
const pct = (x) => (x == null ? '  n/a' : `${(x * 100).toFixed(0)}%`.padStart(5));
const sorted = [...ms].sort((a, b) => a - b);

console.log(`\nDecision planner (${configKey}) vs LLM planner (${base.config?.model})`);
console.log(`  routing accuracy      ${pct(routing.accuracy)}  vs ${pct(llm.routing?.accuracy)}`);
console.log(`  commands exactMatch   ${pct(commands.exactMatch)}  vs ${pct(llm.commands?.exactMatch)}`);
console.log(`  commands actionF1     ${pct(commands.actionF1)}  vs ${pct(llm.commands?.actionF1)}`);
console.log(`  plan planExactMatch   ${pct(planSuite.planExactMatch)}  vs ${pct(llm.plan?.planExactMatch)}`);
console.log(`  plan turnExactMatch   ${pct(planSuite.turnExactMatch)}  vs ${pct(llm.plan?.turnExactMatch)}`);
console.log(`  latency p50 / plan    ${Math.round(sorted[sorted.length >> 1])}ms  vs ${Math.round(llm.commands?.latency?.p50Ms ?? NaN)}ms`);

const fails = [
    ...routing.failures.map((f) => `  [route] "${f.input}"  expected ${f.expected}  got ${f.predicted}`),
    ...rows.filter((r) => !r.exact).map((r) => `  [cmd]  "${r.input}"  expected ${r.expected}  got ${r.predicted}`),
    ...planSuite.failures.flatMap((f) => f.turns.filter((t) => !t.exact).map((t) => `  [plan] ${f.id}  expected ${t.expected}  got ${t.predicted}`)),
];
console.log(fails.length ? `\nFailures:\n${fails.join('\n')}` : '\nNo failures.');
console.log(`\nSaved run to tests/evals/results/experiments.json (${runs.length + 1} runs).`);
