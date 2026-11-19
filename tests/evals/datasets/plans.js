/**
 * plans.js — golden set for *multi-shot* planning (scorePlan.js).
 *
 * Where `commands.js` scores one utterance in isolation, each case here is a
 * whole **conversation**: an ordered list of turns. The assistant sees the
 * running history on every turn, so later turns rely on context established by
 * earlier ones ("open the 3rd one", "now summarise it"). A case only counts as a
 * planning success when *every* turn's action plan is correct.
 *
 * Turn schema mirrors commands.js (`expectedActions` uses the same action
 * schema): {"a":"open","t":"<app>"} | {"a":"open_paper","n":<int>} | {"a":"close"}
 * | {"a":"minimize"} | {"a":"desktop"} | {"a":"browse","t":"…"} |
 * {"a":"search","t":"…"} | {"a":"chat","t":"…"}. `chat` matches by presence only.
 *
 * `activeApp` records which app is focused at that turn (context for the model).
 * `no` on each turn is the Norwegian (Bokmål) utterance; see localize.js.
 */

/** @type {{ id: string, tags?: string[], turns: { user: string, no: string, expectedActions: Array<object>, activeApp?: string }[] }[]} */
export const PLANS_DATASET = [
    // ── Open, drill into a paper, then ask — the canonical research flow ──────
    {
        id: 'research-drilldown',
        tags: ['multishot', 'research', 'context-carryover'],
        turns: [
            { user: 'open the research app', no: 'åpne forskningsappen', expectedActions: [{ a: 'open', t: 'research' }] },
            { user: 'open the 3rd paper', no: 'åpne den 3. artikkelen', expectedActions: [{ a: 'open_paper', n: 3 }], activeApp: 'research' },
            { user: 'summarise it for me', no: 'oppsummer den for meg', expectedActions: [{ a: 'chat', t: 'summarise this paper' }], activeApp: 'research' },
        ],
    },

    // ── Follow-up that only makes sense with history ("the resume" → resume) ──
    {
        id: 'resume-then-ask',
        tags: ['multishot', 'open', 'context-carryover'],
        turns: [
            { user: 'open his resume', no: 'åpne CV-en hans', expectedActions: [{ a: 'open', t: 'resume' }] },
            { user: 'now tell me about his experience', no: 'fortell meg nå om erfaringen hans', expectedActions: [{ a: 'chat', t: 'tell me about his experience' }], activeApp: 'resume' },
        ],
    },

    // ── Switching apps mid-conversation ──────────────────────────────────────
    {
        id: 'projects-to-skills',
        tags: ['multishot', 'open', 'switch'],
        turns: [
            { user: 'show me the projects', no: 'vis meg prosjektene', expectedActions: [{ a: 'open', t: 'projects' }] },
            { user: 'what about his skills?', no: 'hva med ferdighetene hans?', expectedActions: [{ a: 'open', t: 'skills' }], activeApp: 'projects' },
            { user: 'close this', no: 'lukk denne', expectedActions: [{ a: 'close' }], activeApp: 'skills' },
        ],
    },

    // ── Browse then window management ────────────────────────────────────────
    {
        id: 'github-then-desktop',
        tags: ['multishot', 'browse', 'window'],
        turns: [
            { user: 'take me to his github', no: 'ta meg til GitHub-en hans', expectedActions: [{ a: 'browse', t: 'github.com/andreped' }] },
            { user: 'ok show the desktop', no: 'ok, vis skrivebordet', expectedActions: [{ a: 'desktop' }] },
        ],
    },

    // ── A pronoun that must resolve to the previously opened paper ────────────
    {
        id: 'paper-pronoun',
        tags: ['multishot', 'research', 'open_paper', 'context-carryover'],
        turns: [
            { user: 'open research and open the fifth paper', no: 'åpne forskning og åpne den femte artikkelen', expectedActions: [{ a: 'open', t: 'research' }, { a: 'open_paper', n: 5 }] },
            { user: 'what is it about?', no: 'hva handler den om?', expectedActions: [{ a: 'chat', t: 'what is this paper about' }], activeApp: 'research' },
        ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Paraphrase set — the SAME plans a real visitor would phrase casually.
    // Verbs and framing vary, filler words creep in, and follow-ups lean on
    // pronouns ("the second one", "give me the gist", "back to the desktop").
    // The key app/target noun is still present so a small model can resolve it;
    // the challenge is the loose phrasing and the context-carryover.
    // ─────────────────────────────────────────────────────────────────────────

    // ── research-drilldown, phrased loosely ──────────────────────────────────
    {
        id: 'research-drilldown-casual',
        tags: ['multishot', 'research', 'context-carryover', 'paraphrase'],
        turns: [
            { user: 'can you pull up his research for me?', no: 'kan du hente opp forskningen hans for meg?', expectedActions: [{ a: 'open', t: 'research' }] },
            { user: 'let me see the second one', no: 'la meg se den andre', expectedActions: [{ a: 'open_paper', n: 2 }], activeApp: 'research' },
            { user: 'give me the gist of it', no: 'gi meg hovedpoengene', expectedActions: [{ a: 'chat', t: 'summarise this paper' }], activeApp: 'research' },
        ],
    },

    // ── resume then a follow-up question with no explicit noun ────────────────
    {
        id: 'resume-then-ask-casual',
        tags: ['multishot', 'open', 'context-carryover', 'paraphrase'],
        turns: [
            { user: "let's open up his résumé", no: 'la oss åpne CV-en hans', expectedActions: [{ a: 'open', t: 'resume' }] },
            { user: 'so what has he been working on lately?', no: 'så hva har han jobbet med i det siste?', expectedActions: [{ a: 'chat', t: 'what has he been working on lately' }], activeApp: 'resume' },
        ],
    },

    // ── browse to github (canonical path) then window management ──────────────
    {
        id: 'github-then-desktop-casual',
        tags: ['multishot', 'browse', 'window', 'paraphrase'],
        turns: [
            { user: 'pop open his github page', no: 'åpne GitHub-siden hans', expectedActions: [{ a: 'browse', t: 'github.com/andreped' }] },
            { user: 'cool, take me back to the desktop', no: 'kult, ta meg tilbake til skrivebordet', expectedActions: [{ a: 'desktop' }] },
        ],
    },

    // ── switch apps mid-conversation, casual phrasing ────────────────────────
    {
        id: 'projects-to-skills-casual',
        tags: ['multishot', 'open', 'switch', 'paraphrase'],
        turns: [
            { user: "let's see his projects", no: 'la oss se prosjektene hans', expectedActions: [{ a: 'open', t: 'projects' }] },
            { user: 'actually switch to his skills', no: 'bytt heller til ferdighetene hans', expectedActions: [{ a: 'open', t: 'skills' }], activeApp: 'projects' },
            { user: 'ok close it', no: 'ok, lukk den', expectedActions: [{ a: 'close' }], activeApp: 'skills' },
        ],
    },
];
