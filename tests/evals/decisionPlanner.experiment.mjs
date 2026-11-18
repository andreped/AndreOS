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
 *   or, LLM only (the app's router/planner prompts, llmPlanner.js) on a local Ollama model:
 *         LLM_MODEL=qwen3.5:2b [LLM_CPU=1] [OLLAMA_URL=http://127.0.0.1:11434] node tests/evals/decisionPlanner.experiment.mjs
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
const { routerPrompt, parseRoute, ROUTER_GEN, plannerPrompt, parsePlan, PLANNER_GEN } = await import('../../src/js/assistant/engine/llmPlanner.js');
const { runPlannerSuites } = await import('./harness/plannerSuites.js');

const ENDPOINT = process.env.DECISION_URL ?? 'http://127.0.0.1:8765/v1/systemone';
const apps = appRegistry.launchable();
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

// LLM-only mode: same prompts and generation settings as chat.js, served by Ollama.
const LLM = process.env.LLM_MODEL;
const LLM_CPU = !!process.env.LLM_CPU; // num_gpu: 0 → no layers offloaded, pure CPU
async function complete(prompt, { maxTokens, temperature, think }) {
    const res = await fetch(`${process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434'}/api/chat`, {
        method: 'POST',
        body: JSON.stringify({ model: LLM, messages: [{ role: 'user', content: prompt }], stream: false, think, options: { temperature, num_predict: maxTokens, ...(LLM_CPU && { num_gpu: 0 }) } }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    return (await res.json()).message.content;
}
async function llmPlan(text, history) {
    try { return parsePlan(await complete(plannerPrompt(text, history, apps.map((a) => a.id)), PLANNER_GEN)); }
    catch { return null; } // malformed JSON counts as no plan, as in the app
}

// DEV=1: score only the tuning set (datasets/plannerDev.js) and save nothing.
if (process.env.DEV) {
    const { PLANNER_DEV_DATASET } = await import('./datasets/plannerDev.js');
    const { buildRow } = await import('./harness/scoreCommands.js');
    const devRows = [];
    for (const c of PLANNER_DEV_DATASET) devRows.push(buildRow(c, (await (LLM ? llmPlan(c.input, []) : planWithDecisions(c.input, { decide, apps, activeApp: c.activeApp }))) ?? []));
    const ok = devRows.filter((r) => r.exact).length;
    console.log(`Dev set: ${ok}/${devRows.length} exact`);
    for (const r of devRows.filter((r) => !r.exact)) console.log(`  "${r.input}"  expected ${r.expected}  got ${r.predicted}`);
    process.exit(0);
}

const { scorecard, rows } = await runPlannerSuites(LLM ? {
    route: (text) => complete(routerPrompt(text), ROUTER_GEN).then(parseRoute),
    plan: (text, _activeApp, history) => llmPlan(text, history),
} : {
    route: (text) => routeWithDecisions(text, { decide }),
    plan: (text, activeApp) => planWithDecisions(text, { decide, apps, activeApp }),
}, () => (LLM
    ? { model: LLM, planner: LLM, backend: LLM_CPU ? 'ollama·cpu' : 'ollama', source: 'llm-planner' }
    : { model: null, planner: server.model ?? 'unknown', backend: `decision·${server.device ?? '?'}`, source: 'decision-planner' }));
const { configKey, runtimeMs, suites: { routing, commands, plan: planSuite } } = scorecard;

const expPath = new URL('./results/experiments.json', import.meta.url);
const runs = existsSync(expPath) ? JSON.parse(readFileSync(expPath, 'utf8')) : [];
writeFileSync(expPath, JSON.stringify([...runs, scorecard].slice(-50), null, 2) + '\n');

const base = JSON.parse(readFileSync(new URL('./results/latest.json', import.meta.url), 'utf8'));
const llm = base.suites;
const pct = (x) => (x == null ? '  n/a' : `${(x * 100).toFixed(0)}%`.padStart(5));
const p50 = (k) => `${Math.round(scorecard.suites[k].latency?.p50Ms ?? NaN)}ms`.padStart(7);

console.log(`\nPlanner (${configKey}) vs LLM planner (${base.config?.model}) — score, then median time per call`);
console.log(`  routing accuracy      ${pct(routing.accuracy)}  vs ${pct(llm.routing?.accuracy)}   ${p50('routing')}`);
console.log(`  commands exactMatch   ${pct(commands.exactMatch)}  vs ${pct(llm.commands?.exactMatch)}   ${p50('commands')}`);
console.log(`  commands actionF1     ${pct(commands.actionF1)}  vs ${pct(llm.commands?.actionF1)}`);
console.log(`  plan planExactMatch   ${pct(planSuite.planExactMatch)}  vs ${pct(llm.plan?.planExactMatch)}   ${p50('plan')}`);
console.log(`  plan turnExactMatch   ${pct(planSuite.turnExactMatch)}  vs ${pct(llm.plan?.turnExactMatch)}`);
console.log(`  total runtime         ${(runtimeMs / 1000).toFixed(1)}s`);

const fails = [
    ...routing.failures.map((f) => `  [route] "${f.input}"  expected ${f.expected}  got ${f.predicted}`),
    ...rows.filter((r) => !r.exact).map((r) => `  [cmd]  "${r.input}"  expected ${r.expected}  got ${r.predicted}`),
    ...planSuite.failures.flatMap((f) => f.turns.filter((t) => !t.exact).map((t) => `  [plan] ${f.id}  expected ${t.expected}  got ${t.predicted}`)),
];
console.log(fails.length ? `\nFailures:\n${fails.join('\n')}` : '\nNo failures.');
console.log(`\nSaved run to tests/evals/results/experiments.json (${runs.length + 1} runs).`);
