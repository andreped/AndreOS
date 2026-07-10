/**
 * scoreRouting.js — metrics for the intent router (command vs direct).
 *
 * The router decides whether an utterance is an OS *command* or a direct
 * *ask* (conversation). We treat 'command' as the positive class and report
 * accuracy plus a full confusion matrix, per-class precision/recall/F1, and a
 * per-tag breakdown so weak categories are visible.
 */
import { routeLabel } from './normalize.js';

/**
 * @typedef {{ input: string, expected: 'command'|'direct', tags?: string[] }} RoutingCase
 * @typedef {{ input: string, expected: string, predicted: string, correct: boolean, tags: string[] }} RoutingRow
 */

/**
 * @param {RoutingCase[]} dataset
 * @param {(input: string) => ('command'|'direct')} predict  synchronous predictor
 * @returns {ReturnType<typeof summariseRouting>}
 */
export function scoreRouting(dataset, predict) {
    const rows = dataset.map((c) => {
        const predicted = routeLabel(predict(c.input));
        const expected = routeLabel(c.expected);
        return { input: c.input, expected, predicted, correct: predicted === expected, tags: c.tags ?? [] };
    });
    return summariseRouting(rows);
}

/**
 * Build the summary from already-predicted rows. Used by the async in-browser
 * path where predictions come from the LLM.
 * @param {RoutingRow[]} rows
 */
export function summariseRouting(rows) {
    const n = rows.length || 1;
    const correct = rows.filter((r) => r.correct).length;

    // Confusion matrix (positive = command)
    const tp = rows.filter((r) => r.expected === 'command' && r.predicted === 'command').length;
    const fp = rows.filter((r) => r.expected === 'direct' && r.predicted === 'command').length;
    const fn = rows.filter((r) => r.expected === 'command' && r.predicted === 'direct').length;
    const tn = rows.filter((r) => r.expected === 'direct' && r.predicted === 'direct').length;

    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

    return {
        suite: 'routing',
        total: rows.length,
        accuracy: correct / n,
        precision,
        recall,
        f1,
        confusion: { tp, fp, fn, tn },
        byTag: tagBreakdown(rows),
        failures: rows.filter((r) => !r.correct).map((r) => ({ input: r.input, expected: r.expected, predicted: r.predicted })),
    };
}

/** Accuracy grouped by tag. */
function tagBreakdown(rows) {
    /** @type {Record<string, { total: number, correct: number }>} */
    const acc = {};
    for (const r of rows) {
        for (const tag of r.tags.length ? r.tags : ['untagged']) {
            acc[tag] ??= { total: 0, correct: 0 };
            acc[tag].total += 1;
            if (r.correct) acc[tag].correct += 1;
        }
    }
    return Object.fromEntries(
        Object.entries(acc).map(([tag, v]) => [tag, { total: v.total, accuracy: v.correct / v.total }]),
    );
}
