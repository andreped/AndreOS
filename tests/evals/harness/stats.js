/**
 * stats.js — aggregation helpers for the *nondeterministic* (LLM) suites.
 *
 * Real language-model calls are not reproducible: the same prompt can yield a
 * different label, a different action plan, or a differently-worded answer on
 * every run. Scoring a single sample once is therefore misleading — a suite can
 * look great (or terrible) by luck.
 *
 * The LLM runners repeat each sample `REPEATS` times and use these helpers to
 * summarise the spread, so the scorecard reports not just *how good* but *how
 * stable* the assistant is:
 *
 *   • mean / stdev  — central tendency and run-to-run variance of a metric
 *   • majority      — the modal categorical label + how consistent runs were
 *   • mode          — the modal object (e.g. the most common action plan)
 *   • pass@k        — did *any* of the k runs succeed (best-case capability)
 *
 * Pure and side-effect free — shared by Node self-tests and the browser app.
 */

/** Arithmetic mean (0 for an empty list). */
export function mean(xs) {
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Population standard deviation (0 for < 2 samples). */
export function stdev(xs) {
    if (xs.length < 2) return 0;
    const m = mean(xs);
    return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/**
 * Most common categorical label across runs, with a consistency score
 * (fraction of runs that agreed with the winner). Ties break by first-seen.
 * @param {string[]} labels
 * @returns {{ label: string|null, consistency: number }}
 */
export function majority(labels) {
    if (!labels.length) return { label: null, consistency: 0 };
    const counts = new Map();
    for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
    let best = null;
    let bestN = -1;
    for (const l of labels) {
        const n = counts.get(l);
        if (n > bestN) { best = l; bestN = n; }
    }
    return { label: best, consistency: bestN / labels.length };
}

/**
 * Most common *object* across runs, keyed by a stable string. Returns the
 * representative item and its consistency. Used to pick the modal action plan.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} keyFn
 * @returns {{ item: T|null, consistency: number }}
 */
export function mode(items, keyFn) {
    if (!items.length) return { item: null, consistency: 0 };
    const counts = new Map();
    const byKey = new Map();
    for (const it of items) {
        const k = keyFn(it);
        counts.set(k, (counts.get(k) ?? 0) + 1);
        if (!byKey.has(k)) byKey.set(k, it);
    }
    let bestKey = null;
    let bestN = -1;
    for (const it of items) {
        const k = keyFn(it);
        const n = counts.get(k);
        if (n > bestN) { bestKey = k; bestN = n; }
    }
    return { item: byKey.get(bestKey), consistency: bestN / items.length };
}

/** 1 if any run passed, else 0 (best-of-k capability). */
export function passAtK(bools) {
    return bools.some(Boolean) ? 1 : 0;
}

/** Run an async predictor k times, collecting all outputs in order. */
export async function repeat(fn, k) {
    const out = [];
    for (let i = 0; i < k; i++) out.push(await fn(i));
    return out;
}

/** Round to `d` decimals. */
export function round(x, d = 3) {
    const p = 10 ** d;
    return typeof x === 'number' ? Math.round(x * p) / p : x;
}

/**
 * Aggregate a list of per-run scored rows into per-field {mean, std}.
 * @param {Record<string, number>[]} runs
 * @param {string[]} fields
 * @returns {Record<string, { mean: number, std: number }>}
 */
export function aggregateNumericRuns(runs, fields) {
    const out = {};
    for (const f of fields) {
        const xs = runs.map((r) => Number(r[f]) || 0);
        out[f] = { mean: mean(xs), std: stdev(xs) };
    }
    return out;
}
