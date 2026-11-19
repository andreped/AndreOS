/**
 * Self-check for the language registry (src/js/lang/). Runnable: node tests/evals/lang.selfcheck.mjs
 * Guards the things that break when a language is added: missing fields, overlapping detection
 * markers, prompts that don't render, and voice help examples that don't line up.
 */
import assert from 'node:assert/strict';
import { LANGUAGES, language, detectLanguage, replyInstruction, voicePhrases } from '../../src/js/lang/index.js';
import { routerPrompt, plannerPrompt, PROMPT_LANGUAGES } from '../../src/js/assistant/engine/llmPlanner.js';
import { evalDatasets, EVAL_LANGUAGES } from './datasets/localize.js';

const REQUIRED = ['id', 'name', 'nativeName', 'short', 'whisper', 'reply'];

for (const l of LANGUAGES) {
    for (const f of REQUIRED) assert.ok(l[f], `${l.id ?? '?'}: missing ${f}`);
    assert.equal(language(l.id).id, l.id);
    assert.equal(replyInstruction(l.id), `\n\n${l.reply}`);
    if (l.id !== 'en') assert.ok(l.markers instanceof RegExp, `${l.id}: needs detection markers`);
    for (const p of ['router', 'planner']) assert.equal(typeof language(l.id)[p], 'function', `${l.id}: ${p}`);
    assert.ok(routerPrompt('xyz', [{ role: 'user', content: 'hi' }], l.id).includes('"xyz"'), `${l.id}: router quotes the message`);
    assert.ok(plannerPrompt('xyz', [], ['research'], l.id).includes('research'), `${l.id}: planner lists apps`);
}
assert.equal(new Set(LANGUAGES.map((l) => l.id)).size, LANGUAGES.length, 'unique ids');
assert.equal(replyInstruction('auto'), '', 'auto adds no reply instruction');
assert.deepEqual(PROMPT_LANGUAGES, ['auto', ...LANGUAGES.map((l) => l.id)]);

// Help examples are zipped by index across languages, so they must line up.
const help = LANGUAGES.map((l) => l.voice?.helpExamples).filter(Boolean);
assert.ok(help.every((h) => h.length === help[0].length), 'helpExamples line up across languages');
assert.ok(voicePhrases('close').length >= LANGUAGES.length, 'every language has close phrases');

// Detection: every router/planner eval input must be detected as its own language.
for (const lang of EVAL_LANGUAGES) {
    const ds = evalDatasets(lang);
    const texts = [...ds.routing.map((c) => c.input), ...ds.commands.map((c) => c.input), ...ds.plans.flatMap((c) => c.turns.map((t) => t.user))];
    const wrong = texts.filter((t) => detectLanguage(t) !== lang);
    assert.deepEqual(wrong, [], `${lang}: misdetected inputs`);
}

console.log(`✅ lang.selfcheck: ${LANGUAGES.length} languages OK`);
