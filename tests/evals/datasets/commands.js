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
 *
 * `no` is the Norwegian (Bokmål) input, or an override object when the
 * expected target is language-dependent (web search terms); see localize.js.
 */

/** @type {{ input: string, no: string|object, expectedActions: Array<object>, activeApp?: string, tags?: string[] }[]} */
export const COMMANDS_DATASET = [
    // ── Single open ─────────────────────────────────────────────────────────
    { input: 'open research', no: 'åpne forskning', expectedActions: [{ a: 'open', t: 'research' }], tags: ['open'] },
    { input: 'open the resume', no: 'åpne CV-en', expectedActions: [{ a: 'open', t: 'resume' }], tags: ['open'] },
    { input: 'show skills', no: 'vis ferdigheter', expectedActions: [{ a: 'open', t: 'skills' }], tags: ['open'] },
    { input: 'open contact', no: 'åpne kontakt', expectedActions: [{ a: 'open', t: 'contact' }], tags: ['open'] },

    // ── Window management ───────────────────────────────────────────────────
    { input: 'close this window', no: 'lukk dette vinduet', expectedActions: [{ a: 'close' }], tags: ['window'] },
    { input: 'minimize', no: 'minimer', expectedActions: [{ a: 'minimize' }], tags: ['window'] },
    { input: 'show desktop', no: 'vis skrivebordet', expectedActions: [{ a: 'desktop' }], tags: ['window'] },

    // ── Browse / search ─────────────────────────────────────────────────────
    { input: 'go to github.com', no: 'gå til github.com', expectedActions: [{ a: 'browse', t: 'github.com' }], tags: ['browse'] },
    {
        input: 'search the web for digital pathology',
        no: { input: 'søk på nettet etter digital patologi', expectedActions: [{ a: 'browse', t: 'digital patologi' }] },
        expectedActions: [{ a: 'browse', t: 'digital pathology' }],
        tags: ['browse'],
    },

    // ── Open + ask (the money case: right app, then a question) ──────────────
    {
        input: 'open resume and tell me about his experience',
        no: 'åpne CV-en og fortell meg om erfaringen hans',
        expectedActions: [{ a: 'open', t: 'resume' }, { a: 'chat', t: 'tell me about his experience' }],
        tags: ['compound', 'open', 'chat'],
    },
    {
        input: 'open projects and summarize the highlights',
        no: 'åpne prosjekter og oppsummer høydepunktene',
        expectedActions: [{ a: 'open', t: 'projects' }, { a: 'chat', t: 'summarize the highlights' }],
        tags: ['compound', 'open', 'chat'],
    },

    // ── Research: numbered paper + follow-up ────────────────────────────────
    {
        input: 'open research, open the 3rd paper, and summarize it',
        no: 'åpne forskning, åpne den 3. artikkelen, og oppsummer den',
        expectedActions: [{ a: 'open', t: 'research' }, { a: 'open_paper', n: 3 }, { a: 'chat', t: 'summarize this paper' }],
        activeApp: 'research',
        tags: ['compound', 'research', 'open_paper', 'chat'],
    },
    {
        input: 'open the fifth paper',
        no: 'åpne den femte artikkelen',
        expectedActions: [{ a: 'open_paper', n: 5 }],
        activeApp: 'research',
        tags: ['research', 'open_paper'],
    },

    // ── Multi-open ──────────────────────────────────────────────────────────
    {
        input: 'open resume and then open research',
        no: 'åpne CV-en og så åpne forskning',
        expectedActions: [{ a: 'open', t: 'resume' }, { a: 'open', t: 'research' }],
        tags: ['compound', 'open'],
    },
];
