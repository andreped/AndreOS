/**
 * plannerSuites.js — score a router + planner on the routing / commands / plan
 * golden sets, timing every call. Runs unchanged in Node (planner experiment
 * CLI) and the browser (WebGPU decision-model runs), so both produce the same
 * scorecard for results/experiments.json.
 */
import { ROUTING_DATASET } from '../datasets/routing.js';
import { COMMANDS_DATASET } from '../datasets/commands.js';
import { PLANS_DATASET } from '../datasets/plans.js';
import { summariseRouting } from './scoreRouting.js';
import { buildRow, summariseCommands } from './scoreCommands.js';
import { scorePlan } from './scorePlan.js';
import { snapshotConfig, latencyStats } from '../../../src/js/apps/evals/experiment.js';

/**
 * @param {{ route: (text: string) => Promise<'command'|'direct'>,
 *           plan: (text: string, activeApp?: string, history?: object[]) => Promise<Array<object>|null> }} fns
 * @param {{ model: string|null, planner: string, backend: string, source: string }
 *         | (() => { model: string|null, planner: string, backend: string, source: string })} cfg
 *        `model` = chat model (null if none); a function is read after the runs (e.g. a server reports its model)
 */
export async function runPlannerSuites({ route, plan }, cfg) {
    const ms = { routing: [], commands: [], plan: [] };
    const time = async (suite, fn) => {
        const t = performance.now();
        try { return await fn(); } finally { ms[suite].push(performance.now() - t); }
    };
    const t0 = performance.now();

    const routeRows = [];
    for (const c of ROUTING_DATASET) {
        const predicted = await time('routing', () => route(c.input));
        routeRows.push({ input: c.input, expected: c.expected, predicted, correct: predicted === c.expected, tags: c.tags ?? [] });
    }
    const rows = [];
    for (const c of COMMANDS_DATASET) rows.push(buildRow(c, (await time('commands', () => plan(c.input, c.activeApp, []))) ?? []));
    const planSuite = await scorePlan(PLANS_DATASET, async (text, history, activeApp) => (await time('plan', () => plan(text, activeApp, history))) ?? []);

    const { model, planner, backend, source } = typeof cfg === 'function' ? cfg() : cfg;
    const { config, configKey } = snapshotConfig({ model, planner, backend, reasoning: 'none', language: 'en', repeats: 1 });
    const by = { model: planner };
    return {
        rows,
        scorecard: {
            generatedAt: new Date().toISOString(), source, config, configKey, runtimeMs: performance.now() - t0,
            suites: {
                routing: { ...summariseRouting(routeRows), ...by, latency: latencyStats(ms.routing) },
                commands: { ...summariseCommands(rows), ...by, latency: latencyStats(ms.commands) },
                plan: { ...planSuite, ...by, latency: latencyStats(ms.plan) },
            },
        },
    };
}
