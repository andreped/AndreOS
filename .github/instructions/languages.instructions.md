---
applyTo: "src/js/lang/**,src/js/assistant/**,src/js/platform/services/Settings.js,src/js/platform/shell/LangButton.js,src/js/apps/settings/**,src/js/apps/evals/**,tests/evals/**"
---
# Working with languages (English, Norwegian, …)

All static, language-specific text lives in **`src/js/lang/`**, one file per
language (`en.js`, `no.js`), registered in `src/js/lang/index.js`. Never hard-code
a language's strings, phrase lists or `'en'`/`'no'` lists elsewhere: import from
the registry (`LANGUAGES`, `language(id)`, `detectLanguage`, `replyInstruction`,
`voicePhrases`). Settings pills, the taskbar language button, the Evals picker
and the voice keyword layer are all generated from it.

## What a language file holds
| Field | Used by |
|---|---|
| `id`, `name`, `nativeName`, `short` | Settings, taskbar button, Evals app |
| `whisper` | transcription language name (Settings → Speech) |
| `reply` | appended to the answer prompt when Settings → LLM language is this language |
| `markers` | `detectLanguage()` — regex marking a message as this language (English is the fallback, so `en` has none) |
| `roles`, `router`, `planner` | router/planner prompts (`assistant/engine/llmPlanner.js`) |
| `voice.*` | keyword layer (`assistant/voice/VoiceCommandManager.js`); `*Verbs` and `and` are **regex fragments** |

Prompts and other fields a language leaves out fall back to English.

## Rules
- **Prompts follow the message, not the setting.** `routerPrompt`/`plannerPrompt`
  default to `auto` = `detectLanguage(text)`. A mismatched prompt costs points in both
  directions (docs/adr/0003-language-matched-planner-prompts.md). Don't switch the
  prompt on the Settings language.
- **Output contracts stay English** in every language: router labels
  `command`/`direct`, the action schema and app ids. Only wording, rules and examples
  are translated.
- **Change every language together.** A rule or example added to one language's
  `router`/`planner` belongs in all of them.
- **Keep the English prompts byte-stable** unless you mean to change them; their
  scores are the baseline for every earlier eval run.
- **Don't copy eval cases into prompt examples.** Tune on
  `tests/evals/datasets/plannerDev.js`.
- `voice.helpExamples` are zipped by index across languages, so keep them the same
  length and order.
- Not localized yet (English-only, leave as is unless the task is to localize it):
  `assistant/researchContext.js`, the web/desktop-search and open-then-open regexes in
  `VoiceCommandManager._parseCompound`, `decisionPlanner.js` option text, and the
  answer prompt/profile in `andre-profile.js`. Per-app `voiceKeywords` stay in each
  app's `index.js` (mixed languages in one list).
- Model-specific language codes stay with the model (e.g. `LANG_IDS` in
  `assistant/voice/nemotron.js`).

## Adding a language
1. Copy `src/js/lang/no.js` to `src/js/lang/<id>.js` and translate every field.
2. Add it to `LANGUAGES` in `src/js/lang/index.js`.
3. Evals: add a `<id>` translation to every row of `tests/evals/datasets/`
   `routing.js`, `commands.js`, `plans.js` (per turn), `retrieval.js`, `resolution.js`
   (a string, or an override object when the expected target changes too), then add
   `<id>` to `EVAL_LANGUAGES` in `tests/evals/datasets/localize.js`. A missing
   translation throws.
4. Check: `npm run eval:lang` (fields, unique ids, overlapping detection markers,
   prompts render) and `npm run eval`. Benchmark the prompts:
   `LLM_MODEL=qwen3.5:2b EVAL_LANG=<id> node tests/evals/decisionPlanner.experiment.mjs`.

## Evals and languages
- Golden rows keep English text plus one field per language (`no: …`);
  `evalDatasets(lang)` in `tests/evals/datasets/localize.js` picks one.
- Runs record `config.evalLang` and `config.promptLang`. English adds no config-key
  suffix (old runs read as English); others add `·eval:<id>` / `·prompt:<id>`.
  Read them with `evalLangOf()` / `promptLangOf()` in `src/js/apps/evals/experiment.js`.
- CLI switches: `EVAL_LANG=<id>`, `PROMPT_LANG=en|no|auto` (default `auto`).
- Details: docs/architecture/prompts.md and docs/architecture/assistant-evals-architecture.md §6c.
