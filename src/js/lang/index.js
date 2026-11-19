/**
 * Language registry — the one place to add a language.
 *
 * Each language is one file (./en.js, ./no.js) holding all of its static strings:
 * labels, the Whisper language name, the reply instruction, detection markers,
 * router/planner prompts and voice phrases. To add a language:
 *   1. copy ./no.js to ./<id>.js and translate it;
 *   2. add it to LANGUAGES below;
 *   3. (evals) add `<id>` translations to the golden sets and to EVAL_LANGUAGES in
 *      tests/evals/datasets/localize.js.
 * Fields a language leaves out fall back to English.
 */
import en from './en.js';
import no from './no.js';

export const LANGUAGES = [en, no];

const BY_ID = Object.fromEntries(LANGUAGES.map((l) => [l.id, { ...en, ...l }]));

/** A language by id, falling back to English. */
export const language = (id) => BY_ID[id] ?? en;

/** Language of a message: the first language whose markers match, else English. */
export const detectLanguage = (text) => LANGUAGES.find((l) => l.markers?.test(String(text)))?.id ?? 'en';

/** System-prompt suffix for a reply-language setting ('auto' adds nothing, so the model mirrors the visitor). */
export const replyInstruction = (setting) => (BY_ID[setting] ? `\n\n${BY_ID[setting].reply}` : '');

/** One voice phrase list across all languages, e.g. every language's "close" phrases. */
export const voicePhrases = (key) => LANGUAGES.flatMap((l) => l.voice?.[key] ?? []);
