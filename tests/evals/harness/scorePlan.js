/**
 * scorePlan.js — metrics for *multi-shot* planning (does it plan right over a
 * whole conversation?).
 *
 * The `commands` suite scores a single utterance in isolation. Real assistant
 * use is a dialogue: "open research" → "now open the 3rd one" → "summarise it".
 * Each turn's correct plan depends on the ones before it (the model is given the
 * running history). This suite scores a whole conversation: for every turn we
 * compare the predicted action plan against the golden plan, then feed a
 * synthesised assistant reply back into the history for the next turn — exactly
 * as the live assistant would.
 *
 * Reuses `buildRow` from scoreCommands so a single turn is scored identically to
 * a single-shot command (same normalisation, same F1).
 *
 * Metrics:
 *   • planExactMatch — fraction of *conversations* where every turn was exact
 *                      (the headline: did the assistant get the whole plan right?)
 *   • turnExactMatch — fraction of *turns* that were exact (partial credit)
 *   • turnF1         — mean per-turn action F1
 */
import { buildRow, summariseCommands } from './scoreCommands.js';
import { actionSeq } from './normalize.js';

/**
 * @typedef {{ user: string, expectedActions: Array<object>, activeApp?: string }} PlanTurn
 * @typedef {{ id?: string, tags?: string[], turns: PlanTurn[] }} PlanCase
 */

/**
 * A default assistant-reply synthesiser: turns an action plan into a short
 * acknowledgement so the model gets realistic conversation history. Keeps the
 * `chat` message wording when present (that is the part the user actually reads).
 * @param {Array<object>} actions
 * @returns {string}
 */
export function renderAssistantTurn(actions) {
    if (!Array.isArray(actions) || !actions.length) return 'Okay.';
    const parts = [];
    for (const a of actions) {
        switch (String(a?.a ?? '').toLowerCase()) {
            case 'open':       parts.push(`Opened ${a.t}.`); break;
            case 'open_paper': parts.push(`Opened paper ${a.n}.`); break;
            case 'close':      parts.push('Closed the window.'); break;
            case 'minimize':   parts.push('Minimised the window.'); break;
            case 'desktop':    parts.push('Showing the desktop.'); break;
            case 'browse':     parts.push(`Navigating to ${a.t}.`); break;
            case 'search':     parts.push(`Searching for ${a.t}.`); break;
            case 'chat':       parts.push(String(a.t ?? '')); break;
        }
    }
    return parts.filter(Boolean).join(' ') || 'Done.';
}

/**
 * Score one conversation, driving the predictor turn-by-turn with accumulating
 * history.
 * @param {PlanCase} c
 * @param {(userText: string, history: {role:string,content:string}[], activeApp?: string) => (Array<object>|Promise<Array<object>>)} predict
 * @returns {Promise<{ id: string, tags: string[], turns: ReturnType<typeof buildRow>[], planExact: boolean, turnF1: number }>}
 */
export async function scorePlanCase(c, predict) {
    const history = [];
    const turnRows = [];
    for (const turn of c.turns) {
        const predicted = (await predict(turn.user, history.slice(), turn.activeApp)) ?? [];
        const row = buildRow({ input: turn.user, expectedActions: turn.expectedActions, tags: c.tags }, predicted);
        turnRows.push(row);
        history.push({ role: 'user', content: turn.user });
        history.push({ role: 'assistant', content: renderAssistantTurn(predicted) });
    }
    const planExact = turnRows.every((r) => r.exact);
    const turnF1 = turnRows.length ? turnRows.reduce((s, r) => s + r.f1, 0) / turnRows.length : 0;
    return { id: c.id ?? c.turns[0]?.user ?? '?', tags: c.tags ?? [], turns: turnRows, planExact, turnF1 };
}

/**
 * Summarise scored conversations. `extra` allows the runner to fold in
 * nondeterminism fields (stability, passAtK) computed across repeated runs.
 * @param {Awaited<ReturnType<typeof scorePlanCase>>[]} cases
 * @param {object} [extra]
 */
export function summarisePlan(cases, extra = {}) {
    const nConv = cases.length || 1;
    const allTurnRows = cases.flatMap((c) => c.turns);
    const turnSummary = summariseCommands(allTurnRows);

    const planExact = cases.filter((c) => c.planExact).length;

    return {
        suite: 'plan',
        total: cases.length,          // conversations
        turns: allTurnRows.length,    // individual turns
        planExactMatch: planExact / nConv,
        turnExactMatch: turnSummary.exactMatch,
        turnF1: turnSummary.actionF1,
        byTag: tagBreakdown(cases),
        failures: cases
            .filter((c) => !c.planExact)
            .map((c) => ({
                id: c.id,
                turns: c.turns.map((t) => ({ expected: t.expected, predicted: t.predicted, exact: t.exact })),
            })),
        ...extra,
    };
}

/** Convenience: score a whole dataset with an async per-turn predictor. */
export async function scorePlan(dataset, predict, extra = {}) {
    const cases = [];
    for (const c of dataset) cases.push(await scorePlanCase(c, predict));
    return summarisePlan(cases, extra);
}

function tagBreakdown(cases) {
    /** @type {Record<string, { total: number, exact: number }>} */
    const acc = {};
    for (const c of cases) {
        for (const tag of c.tags.length ? c.tags : ['untagged']) {
            acc[tag] ??= { total: 0, exact: 0 };
            acc[tag].total += 1;
            acc[tag].exact += c.planExact ? 1 : 0;
        }
    }
    return Object.fromEntries(
        Object.entries(acc).map(([tag, v]) => [tag, { total: v.total, planExactMatch: v.exact / v.total }]),
    );
}

// Re-export so callers can key predictions by the same canonical action string.
export { actionSeq };
