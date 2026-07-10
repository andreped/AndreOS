/**
 * commands.js — golden set for the command parser ("does it do the right thing?").
 *
 * `expectedActions` uses the exact action schema the parser emits (chat.js
 * `parseCommand`):
 *   {"a":"open","t":"<app>"} | {"a":"open_paper","n":<int>} | {"a":"close"} |
 *   {"a":"minimize"} | {"a":"desktop"} | {"a":"browse","t":"…"} |
 *   {"a":"search","t":"…"} | {"a":"chat","t":"…"}
 *
 * Scoring: `chat` matches by presence (wording is never scored); `open`/
 * `open_paper`/`browse`/`search` match by target. `activeApp` records which app
 * is focused when the utterance is spoken (context for the model).
 */

/** @type {{ input: string, expectedActions: Array<object>, activeApp?: string, tags?: string[] }[]} */
export const COMMANDS_DATASET = [
    // ── Single open ─────────────────────────────────────────────────────────
    { input: 'open research', expectedActions: [{ a: 'open', t: 'research' }], tags: ['open'] },
    { input: 'open the resume', expectedActions: [{ a: 'open', t: 'resume' }], tags: ['open'] },
    { input: 'show skills', expectedActions: [{ a: 'open', t: 'skills' }], tags: ['open'] },
    { input: 'open contact', expectedActions: [{ a: 'open', t: 'contact' }], tags: ['open'] },

    // ── Window management ───────────────────────────────────────────────────
    { input: 'close this window', expectedActions: [{ a: 'close' }], tags: ['window'] },
    { input: 'minimize', expectedActions: [{ a: 'minimize' }], tags: ['window'] },
    { input: 'show desktop', expectedActions: [{ a: 'desktop' }], tags: ['window'] },

    // ── Browse / search ─────────────────────────────────────────────────────
    { input: 'go to github.com', expectedActions: [{ a: 'browse', t: 'github.com' }], tags: ['browse'] },
    { input: 'search the web for digital pathology', expectedActions: [{ a: 'browse', t: 'digital pathology' }], tags: ['browse'] },

    // ── Open + ask (the money case: right app, then a question) ──────────────
    {
        input: 'open resume and tell me about his experience',
        expectedActions: [{ a: 'open', t: 'resume' }, { a: 'chat', t: 'tell me about his experience' }],
        tags: ['compound', 'open', 'chat'],
    },
    {
        input: 'open projects and summarize the highlights',
        expectedActions: [{ a: 'open', t: 'projects' }, { a: 'chat', t: 'summarize the highlights' }],
        tags: ['compound', 'open', 'chat'],
    },

    // ── Research: numbered paper + follow-up ────────────────────────────────
    {
        input: 'open research, open the 3rd paper, and summarize it',
        expectedActions: [{ a: 'open', t: 'research' }, { a: 'open_paper', n: 3 }, { a: 'chat', t: 'summarize this paper' }],
        activeApp: 'research',
        tags: ['compound', 'research', 'open_paper', 'chat'],
    },
    {
        input: 'open the fifth paper',
        expectedActions: [{ a: 'open_paper', n: 5 }],
        activeApp: 'research',
        tags: ['research', 'open_paper'],
    },

    // ── Multi-open ──────────────────────────────────────────────────────────
    {
        input: 'open resume and then open research',
        expectedActions: [{ a: 'open', t: 'resume' }, { a: 'open', t: 'research' }],
        tags: ['compound', 'open'],
    },
];
