/**
 * localize.js — pick one language of the bilingual golden sets.
 *
 * Rows are written in English with a Norwegian (Bokmål) translation in `no`:
 * either the translated input string, or an object of field overrides when the
 * expectation changes with the language too (e.g. a web-search target).
 */
import { RETRIEVAL_DATASET } from './retrieval.js';
import { RESOLUTION_DATASET } from './resolution.js';
import { ROUTING_DATASET } from './routing.js';
import { COMMANDS_DATASET } from './commands.js';
import { PLANS_DATASET } from './plans.js';

export const EVAL_LANGUAGES = ['en', 'no'];

/** Dataset language for a Settings LLM language ('auto' or a language id). */
export const evalLanguage = (setting) => (EVAL_LANGUAGES.includes(setting) ? setting : 'en');

function pick(rows, lang, field) {
    if (lang === 'en') return rows;
    return rows.map((c) => {
        const t = c[lang];
        if (t == null) throw new Error(`Missing "${lang}" translation for ${JSON.stringify(c[field])}`);
        return typeof t === 'object' ? { ...c, ...t } : { ...c, [field]: t };
    });
}

export function evalDatasets(lang = 'en') {
    return {
        retrieval: pick(RETRIEVAL_DATASET, lang, 'query'),
        resolution: pick(RESOLUTION_DATASET, lang, 'input'),
        routing: pick(ROUTING_DATASET, lang, 'input'),
        commands: pick(COMMANDS_DATASET, lang, 'input'),
        plans: PLANS_DATASET.map((c) => ({ ...c, turns: pick(c.turns, lang, 'user') })),
    };
}
