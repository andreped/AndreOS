/**
 * text.js — tiny, dependency-free text utilities for answer scoring.
 *
 * These power the RAGAS-style answer metrics (scoreAnswers.js). They are
 * deliberately *lexical* (token overlap, keyword coverage) rather than
 * embedding-based, so the exact same numbers can be computed in Node/CI and in
 * the browser with no model download and full reproducibility. They are proxies
 * for the semantic quantities RAGAS measures — good enough to track regressions,
 * honest about being approximate.
 *
 * Shared by the Node harness and the in-browser Evals app.
 */

// A compact bilingual (English + Norwegian) stop-word set. Removing these keeps
// scoring focused on content words so filler doesn't inflate overlap.
const STOP = new Set(
    (
        'a an the of to in on at for and or but is are was were be been being it its ' +
        'this that these those with as by from into about over under above below not no ' +
        'he she they his her their your you i we our do does did can could will would ' +
        'should may might must if then than so such also more most very much many any ' +
        'og i på til en et som er for av med det den de har ikke å om at han hun vi du jeg ' +
        'kan skal vil være blir hans hennes deres denne dette disse'
    ).split(/\s+/),
);

/**
 * Lowercase, strip punctuation (keeping letters/numbers across languages via the
 * Unicode property escapes), and split into tokens.
 * @param {string} s
 * @returns {string[]}
 */
export function tokenize(s) {
    return String(s ?? '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

/** Content tokens: tokens with stop-words and single characters removed. */
export function contentTokens(s) {
    return tokenize(s).filter((t) => t.length > 1 && !STOP.has(t));
}

/** Set of content tokens. */
export function tokenSet(s) {
    return new Set(contentTokens(s));
}

/**
 * Precision / recall / F1 between two token sets (order-independent).
 * @param {Set<string>} a  candidate
 * @param {Set<string>} b  reference
 */
export function setF1(a, b) {
    if (!a.size && !b.size) return { precision: 1, recall: 1, f1: 1 };
    if (!a.size || !b.size) return { precision: 0, recall: 0, f1: 0 };
    let overlap = 0;
    for (const t of a) if (b.has(t)) overlap += 1;
    const precision = overlap / a.size;
    const recall = overlap / b.size;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { precision, recall, f1 };
}

/**
 * Fraction of `needle` tokens that are present in `haystack`.
 * @param {Set<string>} needle
 * @param {Set<string>} haystack
 */
export function coverage(needle, haystack) {
    if (!needle.size) return 0;
    let hit = 0;
    for (const t of needle) if (haystack.has(t)) hit += 1;
    return hit / needle.size;
}

/**
 * Fraction of expected key phrases that appear in `text`. A phrase counts as
 * present when *all* of its content tokens appear in the text (subset match),
 * which tolerates word-order and inflection differences a small model produces.
 * @param {string} text
 * @param {string[]} phrases
 * @returns {number} 0..1 (1 when there are no phrases to cover)
 */
export function keywordCoverage(text, phrases) {
    const list = (phrases ?? []).filter(Boolean);
    if (!list.length) return 1;
    const present = tokenSet(text);
    let matched = 0;
    for (const phrase of list) {
        const need = contentTokens(phrase);
        if (need.length && need.every((t) => present.has(t))) matched += 1;
    }
    return matched / list.length;
}

/**
 * Strict contiguous-phrase match on the *full* token stream (stop-words kept).
 * Unlike keywordCoverage, this requires the phrase's exact token sequence to
 * appear — used for hallucination markers where "no publications" must not be
 * satisfied by the common word "publications" alone.
 * @param {string} text
 * @param {string} phrase
 * @returns {boolean}
 */
export function containsPhrase(text, phrase) {
    const t = tokenize(text);
    const p = tokenize(phrase);
    if (!p.length) return false;
    for (let i = 0; i + p.length <= t.length; i++) {
        let ok = true;
        for (let j = 0; j < p.length; j++) {
            if (t[i + j] !== p[j]) { ok = false; break; }
        }
        if (ok) return true;
    }
    return false;
}
