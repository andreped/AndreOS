/**
 * llmPlanner.js — the chat-model router and planner prompts, shared by chat.js
 * and the CLI planner experiment (tests/evals/decisionPlanner.experiment.mjs),
 * so both run exactly the same prompts. Pure: no engine, no DOM.
 *
 * The prompt text lives per language in src/js/lang/; it is picked per message by
 * default (`auto`). The action schema, app ids and router labels stay English so
 * parsing is language-independent.
 */
import { LANGUAGES, language, detectLanguage } from '../../lang/index.js';

const histLines = (history, n, roles) => history.slice(-n)
    .map(m => `${m.role === 'user' ? roles.user : roles.assistant}: ${m.content}`)
    .join('\n');
const quote = (text) => text.replace(/"/g, "'");
const pick = (text, lang) => language(lang === 'auto' ? detectLanguage(text) : lang);

export const PROMPT_LANGUAGES = ['auto', ...LANGUAGES.map((l) => l.id)];

/** Prompt language for a message: the planners do best when prompt and input language match. */
export const promptLanguage = detectLanguage;

// Classification doesn't benefit from reasoning and loops with it — keep it fast/deterministic.
export const ROUTER_GEN  = { maxTokens: 8,   temperature: 0,   think: false };
export const PLANNER_GEN = { maxTokens: 150, temperature: 0.1, think: false };

export function routerPrompt(text, history = [], lang = 'auto') {
    const l = pick(text, lang);
    return l.router(histLines(history, 4, l.roles), quote(text));
}

/** @returns {'command'|'direct'} */
export const parseRoute = (out) => (String(out).toLowerCase().includes('command') ? 'command' : 'direct');

export function plannerPrompt(text, history = [], appIds = [], lang = 'auto') {
    const l = pick(text, lang);
    return l.planner(histLines(history, 6, l.roles), quote(text), appIds);
}

/** First JSON array in the model output → non-empty actions, else null. Throws on malformed JSON. */
export function parsePlan(raw) {
    const jsonMatch = String(raw).match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return null;
    const actions = JSON.parse(jsonMatch[0]);
    return Array.isArray(actions) && actions.length > 0 ? actions : null;
}
