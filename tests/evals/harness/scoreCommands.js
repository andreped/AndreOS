/**
 * scoreCommands.js — metrics for the command parser (does it do the right thing?).
 *
 * Given an utterance, the parser emits an ordered action sequence. We score:
 *   • exactMatch  — predicted sequence equals the golden sequence (order-sensitive)
 *   • actionF1    — multiset precision/recall/F1 over individual action keys
 *                   (credits getting most actions right even if one is off)
 *   • targetAcc   — of the `open`/`open_paper` actions expected, how many were hit
 *                   (i.e. did it target the right app / paper?)
 *
 * Free-text `chat` messages are matched by presence only (see normalize.js).
 */
import { actionSeq, multiset } from './normalize.js';

/**
 * @typedef {{ input: string, expectedActions: Array<object>, activeApp?: string, tags?: string[] }} CommandCase
 */

/**
 * @param {CommandCase[]} dataset
 * @param {(input: string) => (Array<object>|Promise<Array<object>>)} predict
 * @returns {Promise<ReturnType<typeof summariseCommands>>}
 */
export async function scoreCommands(dataset, predict) {
    const rows = [];
    for (const c of dataset) {
        const predictedActions = (await predict(c.input)) ?? [];
        rows.push(buildRow(c, predictedActions));
    }
    return summariseCommands(rows);
}

/**
 * Compute a scored row from a case and the predicted actions.
 * @param {CommandCase} c
 * @param {Array<object>} predictedActions
 */
export function buildRow(c, predictedActions) {
    const expected = actionSeq(c.expectedActions);
    const predicted = actionSeq(predictedActions);

    const exact = expected.length === predicted.length && expected.every((k, i) => k === predicted[i]);
    const { precision, recall, f1 } = multisetF1(predicted, expected);

    // Target accuracy: fraction of expected open/open_paper targets that appear.
    const wantedTargets = expected.filter((k) => k.startsWith('open:') || k.startsWith('open_paper:'));
    const predSet = multiset(predicted);
    const hitTargets = wantedTargets.filter((k) => (predSet.get(k) ?? 0) > 0).length;
    const targetAcc = wantedTargets.length ? hitTargets / wantedTargets.length : null;

    return {
        input: c.input,
        tags: c.tags ?? [],
        expected,
        predicted,
        exact,
        f1,
        precision,
        recall,
        targetAcc,
    };
}

/**
 * @param {ReturnType<typeof buildRow>[]} rows
 */
export function summariseCommands(rows) {
    const n = rows.length || 1;
    const exactMatches = rows.filter((r) => r.exact).length;
    const avg = (sel) => rows.reduce((s, r) => s + sel(r), 0) / n;

    const targeted = rows.filter((r) => r.targetAcc !== null);
    const targetAcc = targeted.length
        ? targeted.reduce((s, r) => s + r.targetAcc, 0) / targeted.length
        : null;

    return {
        suite: 'commands',
        total: rows.length,
        exactMatch: exactMatches / n,
        actionF1: avg((r) => r.f1),
        precision: avg((r) => r.precision),
        recall: avg((r) => r.recall),
        targetAccuracy: targetAcc,
        byTag: tagBreakdown(rows),
        failures: rows
            .filter((r) => !r.exact)
            .map((r) => ({ input: r.input, expected: r.expected, predicted: r.predicted, f1: round(r.f1) })),
    };
}

/** Multiset precision/recall/F1 over action keys. */
function multisetF1(predicted, expected) {
    const P = multiset(predicted);
    const E = multiset(expected);
    let overlap = 0;
    for (const [k, c] of P) overlap += Math.min(c, E.get(k) ?? 0);
    const precision = predicted.length ? overlap / predicted.length : expected.length ? 0 : 1;
    const recall = expected.length ? overlap / expected.length : 1;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { precision, recall, f1 };
}

function tagBreakdown(rows) {
    /** @type {Record<string, { total: number, exact: number, f1: number }>} */
    const acc = {};
    for (const r of rows) {
        for (const tag of r.tags.length ? r.tags : ['untagged']) {
            acc[tag] ??= { total: 0, exact: 0, f1: 0 };
            acc[tag].total += 1;
            acc[tag].exact += r.exact ? 1 : 0;
            acc[tag].f1 += r.f1;
        }
    }
    return Object.fromEntries(
        Object.entries(acc).map(([tag, v]) => [
            tag,
            { total: v.total, exactMatch: v.exact / v.total, actionF1: v.f1 / v.total },
        ]),
    );
}

const round = (x) => Math.round(x * 1000) / 1000;
