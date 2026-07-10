/**
 * scoreRetrieval.js — metrics for BM25 paper retrieval.
 *
 * For each query we know the set of relevant document ids. From a ranked list
 * of predicted ids we compute the standard IR metrics:
 *   • hit@1 / hit@3 — was a relevant doc in the top 1 / top 3
 *   • recall@k      — fraction of relevant docs retrieved in top k
 *   • MRR           — mean reciprocal rank of the first relevant hit
 */

/**
 * @typedef {{ query: string, relevant: string[], tags?: string[] }} RetrievalCase
 */

/**
 * @param {RetrievalCase[]} dataset
 * @param {(query: string, k: number) => string[]} retrieve  returns ranked doc ids
 * @param {number} k
 */
export function scoreRetrieval(dataset, retrieve, k = 5) {
    const rows = dataset.map((c) => buildRetrievalRow(c, retrieve, k));
    return summariseRetrieval(rows, k);
}

/**
 * Score a single retrieval case. Exposed so callers that want per-sample
 * progress (the in-browser Evals app) can iterate and report as they go, while
 * still summarising with the shared logic below.
 * @param {RetrievalCase} c
 * @param {(query: string, k: number) => string[]} retrieve
 * @param {number} k
 */
export function buildRetrievalRow(c, retrieve, k = 5) {
    const ranked = retrieve(c.query, k) ?? [];
    const relevant = new Set(c.relevant);
    const firstHit = ranked.findIndex((id) => relevant.has(id)); // -1 if none
    const retrievedRelevant = ranked.filter((id) => relevant.has(id)).length;
    return {
        query: c.query,
        tags: c.tags ?? [],
        ranked,
        expected: c.relevant,
        hit1: ranked.length > 0 && relevant.has(ranked[0]),
        hit3: ranked.slice(0, 3).some((id) => relevant.has(id)),
        recall: relevant.size ? retrievedRelevant / relevant.size : 0,
        rr: firstHit >= 0 ? 1 / (firstHit + 1) : 0,
    };
}

/** @param {ReturnType<typeof scoreRetrieval>['_rows']} rows */
export function summariseRetrieval(rows, k = 5) {
    const n = rows.length || 1;
    const avg = (sel) => rows.reduce((s, r) => s + sel(r), 0) / n;
    return {
        suite: 'retrieval',
        total: rows.length,
        k,
        hit1: avg((r) => (r.hit1 ? 1 : 0)),
        hit3: avg((r) => (r.hit3 ? 1 : 0)),
        recall: avg((r) => r.recall),
        mrr: avg((r) => r.rr),
        failures: rows
            .filter((r) => !r.hit3)
            .map((r) => ({ query: r.query, expected: r.expected, ranked: r.ranked.slice(0, 3) })),
    };
}
