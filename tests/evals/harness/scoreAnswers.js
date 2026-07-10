/**
 * scoreAnswers.js — RAGAS-style quality metrics for free-text answers.
 *
 * The other suites score the assistant's *decisions* (route, plan, retrieval).
 * This one scores what the user actually reads: the answer "Ask André" writes.
 * It is modelled on RAGAS, which decomposes answer quality into independent
 * facets rather than one fuzzy "is it good?" score:
 *
 *   • faithfulness   — is the answer grounded in the provided context, or did it
 *                      hallucinate? (content tokens supported by reference +
 *                      curated ground-truth facts + the actually-retrieved RAG
 *                      context). `mustNotContain` phrases hard-cap this.
 *   • correctness    — does it match the reference answer? (token-set F1 blended
 *                      with coverage of the expected key points / facts).
 *   • relevancy      — does it actually address *this* question, or drift?
 *                      (key-point recall blended with question/answer overlap).
 *   • ragas          — the headline: the mean of the three facets.
 *
 * IMPORTANT: these are deliberately *lexical* proxies (see text.js) so they are
 * fully reproducible and need no judge model or embeddings. They approximate the
 * semantic quantities RAGAS measures — ideal for tracking regressions of a tiny
 * on-device model, honest about being approximate. An optional `judge` hook is
 * left for a future LLM-as-judge upgrade without changing the suite shape.
 *
 * Pure & shared by the Node self-tests and the in-browser Evals app.
 */
import { tokenSet, contentTokens, setF1, coverage, keywordCoverage, containsPhrase } from './text.js';

/**
 * @typedef {{
 *   id?: string,
 *   question: string,
 *   reference: string,
 *   keyPoints?: string[],
 *   groundTruth?: string[],
 *   mustNotContain?: string[],
 *   activeApp?: string,
 *   tags?: string[],
 * }} AnswerCase
 */

/**
 * Score a single generated answer against its golden case.
 * @param {AnswerCase} c
 * @param {string} generated              the model's answer
 * @param {string} [retrievedContext]     the RAG context actually fed to the model
 * @returns {{
 *   id: string, question: string, tags: string[], generated: string,
 *   faithfulness: number, correctness: number, relevancy: number, ragas: number,
 *   hallucinated: boolean, banned: string[],
 * }}
 */
export function scoreAnswerRow(c, generated, retrievedContext = '') {
    const gen = String(generated ?? '');
    const genSet = tokenSet(gen);
    const genContent = contentTokens(gen);

    const keyPoints = c.keyPoints ?? [];

    // ── correctness: match the reference answer ──────────────────────────────
    const refF1 = setF1(genSet, tokenSet(c.reference ?? '')).f1;
    const kpCoverage = keyPoints.length ? keywordCoverage(gen, keyPoints) : refF1;
    const correctness = 0.5 * refF1 + 0.5 * kpCoverage;

    // ── faithfulness: grounded in the supplied context (no hallucination) ────
    const supportSet = tokenSet(
        [c.reference ?? '', ...(c.groundTruth ?? []), retrievedContext].join(' '),
    );
    let faithfulness = genContent.length ? coverage(new Set(genContent), supportSet) : 0;
    const banned = (c.mustNotContain ?? []).filter((p) => containsPhrase(gen, p));
    const hallucinated = banned.length > 0;
    if (hallucinated) faithfulness = Math.min(faithfulness, 0.15);

    // ── relevancy: does it address this question? ────────────────────────────
    const questionSet = tokenSet(`${c.question} ${keyPoints.join(' ')}`);
    const relevancy = 0.5 * kpCoverage + 0.5 * setF1(genSet, questionSet).f1;

    const ragas = (correctness + faithfulness + relevancy) / 3;

    return {
        id: c.id ?? c.question,
        question: c.question,
        tags: c.tags ?? [],
        generated: gen,
        faithfulness,
        correctness,
        relevancy,
        ragas,
        hallucinated,
        banned,
    };
}

/**
 * Summarise scored answer rows. `extra` lets the runner fold in nondeterminism
 * fields (stability, passAtK) measured across repeated generations.
 * @param {ReturnType<typeof scoreAnswerRow>[]} rows
 * @param {object} [extra]
 * @param {number} [min]   ragas threshold used only to flag failures
 */
export function summariseAnswers(rows, extra = {}, min = 0.4) {
    const n = rows.length || 1;
    const avg = (sel) => rows.reduce((s, r) => s + sel(r), 0) / n;
    const hallucinated = rows.filter((r) => r.hallucinated).length;

    return {
        suite: 'answers',
        total: rows.length,
        ragas: avg((r) => r.ragas),
        faithfulness: avg((r) => r.faithfulness),
        correctness: avg((r) => r.correctness),
        relevancy: avg((r) => r.relevancy),
        hallucinationRate: hallucinated / n,
        byTag: tagBreakdown(rows),
        failures: rows
            .filter((r) => r.ragas < min)
            .map((r) => ({
                id: r.id,
                ragas: round(r.ragas),
                faithfulness: round(r.faithfulness),
                correctness: round(r.correctness),
                relevancy: round(r.relevancy),
                hallucinated: r.hallucinated || undefined,
                generated: r.generated.slice(0, 160),
            })),
        ...extra,
    };
}

/** Convenience: score a whole dataset with an async answer generator. */
export async function scoreAnswers(dataset, generate, extra = {}, min = 0.4) {
    const rows = [];
    for (const c of dataset) {
        const { text, context } = normaliseGen(await generate(c));
        rows.push(scoreAnswerRow(c, text, context));
    }
    return summariseAnswers(rows, extra, min);
}

function normaliseGen(out) {
    if (typeof out === 'string') return { text: out, context: '' };
    return { text: out?.text ?? '', context: out?.context ?? '' };
}

function tagBreakdown(rows) {
    /** @type {Record<string, { total: number, ragas: number, faithfulness: number }>} */
    const acc = {};
    for (const r of rows) {
        for (const tag of r.tags.length ? r.tags : ['untagged']) {
            acc[tag] ??= { total: 0, ragas: 0, faithfulness: 0 };
            acc[tag].total += 1;
            acc[tag].ragas += r.ragas;
            acc[tag].faithfulness += r.faithfulness;
        }
    }
    return Object.fromEntries(
        Object.entries(acc).map(([tag, v]) => [
            tag,
            { total: v.total, ragas: v.ragas / v.total, faithfulness: v.faithfulness / v.total },
        ]),
    );
}

const round = (x) => Math.round(x * 1000) / 1000;
