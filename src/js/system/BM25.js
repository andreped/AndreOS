/**
 * BM25 — Okapi BM25 retrieval for small in-browser corpora.
 * No dependencies, no external model, negligible memory footprint.
 */

const STOPWORDS = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
    'from','as','is','was','are','were','be','been','being','have','has','had',
    'do','does','did','will','would','could','should','may','might','shall',
    'this','that','these','those','it','its','we','our','i','my','he','she',
    'they','their','you','your','not','no','nor','so','yet','both','either',
    'about','which','when','what','who','how','all','each','more','also','can',
    'into','than','then','just','over','such','very','used','using','between',
]);

function tokenize(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

export class BM25 {
    /**
     * @param {{ k1?: number, b?: number }} opts
     *   k1 — term frequency saturation (default 1.5)
     *   b  — length normalisation (default 0.75)
     */
    constructor({ k1 = 1.5, b = 0.75 } = {}) {
        this.k1    = k1;
        this.b     = b;
        this.docs  = [];        // [{ id, tokens, len }]
        this.df    = new Map(); // term → number of docs containing it
        this.avgdl = 0;
    }

    /** Add a document to the corpus. Call build() after all documents are added. */
    addDocument(id, text) {
        const tokens = tokenize(text);
        this.docs.push({ id, tokens, len: tokens.length });
        const unique = new Set(tokens);
        for (const t of unique) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }

    /** Finalise average document length. Must be called before search(). */
    build() {
        this.avgdl = this.docs.length
            ? this.docs.reduce((s, d) => s + d.len, 0) / this.docs.length
            : 0;
    }

    /**
     * Return the top-k document IDs ranked by BM25 score.
     * The last query term is matched as a prefix so live-as-you-type search
     * returns results before the user finishes typing a word.
     * @param {string} query
     * @param {number} k
     * @returns {{ id: string, score: number }[]}
     */
    search(query, k = 5) {
        const qTerms = tokenize(query);
        const N      = this.docs.length;
        const scores = new Float64Array(N);

        qTerms.forEach((term, ti) => {
            const isLastTerm = ti === qTerms.length - 1;

            // For the last (possibly incomplete) term use prefix matching;
            // for all other terms require an exact token match.
            const matchingTerms = isLastTerm
                ? [...this.df.keys()].filter(t => t.startsWith(term))
                : (this.df.has(term) ? [term] : []);

            for (const matchedTerm of matchingTerms) {
                const df = this.df.get(matchedTerm);
                // Robertson-Sparck Jones IDF with smoothing
                const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

                for (let i = 0; i < N; i++) {
                    const d  = this.docs[i];
                    const tf = d.tokens.reduce((n, t) => n + (t === matchedTerm ? 1 : 0), 0);
                    if (tf === 0) continue;
                    const num = tf * (this.k1 + 1);
                    const den = tf + this.k1 * (1 - this.b + this.b * d.len / this.avgdl);
                    scores[i] += idf * (num / den);
                }
            }
        });

        const results = [];
        for (let i = 0; i < N; i++) {
            if (scores[i] > 0) results.push({ id: this.docs[i].id, score: scores[i] });
        }
        return results.sort((a, b) => b.score - a.score).slice(0, k);
    }
}
