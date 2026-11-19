# ADR 0003 — Router/planner prompts follow the language of each message

- **Status:** Accepted (default for the chat-model router/planner)
- **Date:** 2026-11-19
- **Details:** [docs/architecture/prompts.md](../architecture/prompts.md) · [evals §6c](../architecture/assistant-evals-architecture.md)

## Context

The chat model's router and planner prompts ([llmPlanner.js](../../src/js/assistant/engine/llmPlanner.js))
were English only, with a single Norwegian example. Visitors write in English and Norwegian. To measure
the effect of language, the golden sets for routing, commands, plans, retrieval and resolution got
Norwegian (Bokmål) translations ([localize.js](../../tests/evals/datasets/localize.js)), so the same
cases can be run in either language.

## Decision

1. **One prompt per task per language.** The router and the planner each have an English and a
   Norwegian prompt. The Norwegian prompts are translations with Norwegian examples, plus one rule
   mapping Norwegian app names to app ids (forskning → research, CV → resume, …). The action schema,
   app ids and the `command`/`direct` labels stay English, so parsing doesn't change.
2. **Pick the prompt per message (`auto`, the default).** `promptLanguage(text)` is a keyword check
   (æ/ø/å or common Norwegian words). `chat.js` calls the prompts without a language, so it gets `auto`.
3. **The English prompts are unchanged** (byte-identical), so earlier English results stay comparable.
4. **Record the prompt language in every run:** `config.promptLang`, plus a `·prompt:<lang>` suffix on
   the config key when it isn't `en` (runs from before this ADR read as `en`).

## Findings (why)

`qwen3.5:2b` via Ollama, CLI planner experiment, one run per row
(`LLM_MODEL=qwen3.5:2b EVAL_LANG=… PROMPT_LANG=… node tests/evals/decisionPlanner.experiment.mjs`):

| Inputs | Prompt | Routing | Commands exact | Plan exact |
|---|---|---|---|---|
| en | en | 96% | 86% | 78% |
| en | no | 85% | 86% | 67% |
| no | en *(before)* | 69% | 50% | 22% |
| no | no | 85% | 93% | 56% |
| en | **auto** | 96% | 93% | 78% |
| no | **auto** | 85% | 93% | 56% |

- **An English prompt on Norwegian input fails badly.** "åpne CV-en" went to LinkedIn, "vis ferdigheter"
  became a chat, "vis skrivebordet" / "minimer" / "lukk dette vinduet" returned nothing, and the router
  sent most Norwegian questions to `command`.
- **A Norwegian prompt on English input costs points too** (routing −11, plans −11): it turned English
  questions into commands and put Norwegian words into search queries ("digital patologi").
  So a fixed prompt from the language *setting* is the wrong switch — the prompt must match the message.
- **`auto` matches the best fixed prompt for each input language.** The detector picked the right
  language for every routing, command and plan input in both sets (87 + 87); it only misses bare
  nouns ("forskning", "kontakt"), which never reach these prompts.

## Consequences

- ➕ Norwegian commands go from 50% to 93% exact, plans from 22% to 56%, with no cost for English.
- ➖ Two prompts per task to keep in sync. Change both together and run both input languages.
- ➖ The detector is a heuristic: a Norwegian message using none of its words gets the English prompt.
- ➖ Norwegian multi-turn plans (56%) still trail English (78%); failures are casual phrasing
  ("la meg se den andre") and close vs minimize.

## Caveats

- **Small sets:** one case moves commands ~7 points and plans ~11. These are single runs on one model.
- **Leakage:** both prompts' examples overlap with the test cases (already true for English), so absolute
  scores are optimistic. The en-vs-no comparison is like for like.
- **Answers** (RAGAS) is not translated yet; a Norwegian Evals-app run skips it.
- The **decision-model planner** (vela) still uses English option text and English-only slot filling;
  this ADR covers the chat-model prompts only.
