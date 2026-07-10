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
 */

/** @type {{ id: string, tags?: string[], turns: { user: string, expectedActions: Array<object>, activeApp?: string }[] }[]} */
export const PLANS_DATASET = [
    // ── Open, drill into a paper, then ask — the canonical research flow ──────
    {
        id: 'research-drilldown',
        tags: ['multishot', 'research', 'context-carryover'],
        turns: [
            { user: 'open the research app', expectedActions: [{ a: 'open', t: 'research' }] },
            { user: 'open the 3rd paper', expectedActions: [{ a: 'open_paper', n: 3 }], activeApp: 'research' },
            { user: 'summarise it for me', expectedActions: [{ a: 'chat', t: 'summarise this paper' }], activeApp: 'research' },
        ],
    },

    // ── Follow-up that only makes sense with history ("the resume" → resume) ──
    {
        id: 'resume-then-ask',
        tags: ['multishot', 'open', 'context-carryover'],
        turns: [
            { user: 'open his resume', expectedActions: [{ a: 'open', t: 'resume' }] },
            { user: 'now tell me about his experience', expectedActions: [{ a: 'chat', t: 'tell me about his experience' }], activeApp: 'resume' },
        ],
    },

    // ── Switching apps mid-conversation ──────────────────────────────────────
    {
        id: 'projects-to-skills',
        tags: ['multishot', 'open', 'switch'],
        turns: [
            { user: 'show me the projects', expectedActions: [{ a: 'open', t: 'projects' }] },
            { user: 'what about his skills?', expectedActions: [{ a: 'open', t: 'skills' }], activeApp: 'projects' },
            { user: 'close this', expectedActions: [{ a: 'close' }], activeApp: 'skills' },
        ],
    },

    // ── Browse then window management ────────────────────────────────────────
    {
        id: 'github-then-desktop',
        tags: ['multishot', 'browse', 'window'],
        turns: [
            { user: 'take me to his github', expectedActions: [{ a: 'browse', t: 'github.com/andreped' }] },
            { user: 'ok show the desktop', expectedActions: [{ a: 'desktop' }] },
        ],
    },

    // ── A pronoun that must resolve to the previously opened paper ────────────
    {
        id: 'paper-pronoun',
        tags: ['multishot', 'research', 'open_paper', 'context-carryover'],
        turns: [
            { user: 'open research and open the fifth paper', expectedActions: [{ a: 'open', t: 'research' }, { a: 'open_paper', n: 5 }] },
            { user: 'what is it about?', expectedActions: [{ a: 'chat', t: 'what is this paper about' }], activeApp: 'research' },
        ],
    },
];
