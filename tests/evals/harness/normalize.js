/**
 * normalize.js — canonical forms for scoring.
 *
 * The assistant's command parser emits action objects in a compact schema
 * (see chat.js `parseCommand`). To compare a predicted action sequence against
 * a golden one fairly, we reduce each action to a stable string key. Free-text
 * fields that a small model can never reproduce verbatim (a `chat` message, a
 * search string) are matched by *kind*, not exact wording.
 *
 * Shared by the Node harness and the in-browser Evals app so both compute
 * identical metrics.
 */

/**
 * Reduce a single action object to a canonical comparison key.
 * @param {{a?: string, t?: string, n?: number}} action
 * @returns {string}
 */
export function actionKey(action) {
    if (!action || typeof action !== 'object') return 'invalid';
    const a = String(action.a ?? '').toLowerCase().trim();
    switch (a) {
        // Target apps/urls matter → include the (normalised) target.
        case 'open':
        case 'browse':
        case 'search':
            return `${a}:${String(action.t ?? '').toLowerCase().trim()}`;
        case 'open_paper':
            return `open_paper:${Number(action.n)}`;
        // Free-text message: only its presence is scored, not its wording.
        case 'chat':
            return 'chat';
        // Nullary OS actions.
        case 'close':
        case 'minimize':
        case 'desktop':
            return a;
        default:
            return a || 'invalid';
    }
}

/**
 * Canonicalise a whole action sequence to an array of keys.
 * @param {Array<object>} actions
 * @returns {string[]}
 */
export function actionSeq(actions) {
    return Array.isArray(actions) ? actions.map(actionKey) : [];
}

/** Normalise a routing label to 'command' | 'direct'. */
export function routeLabel(value) {
    const v = String(value ?? '').toLowerCase();
    return v.includes('command') ? 'command' : 'direct';
}

/** Multiset (label → count) for order-independent comparison. */
export function multiset(keys) {
    const m = new Map();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
}
