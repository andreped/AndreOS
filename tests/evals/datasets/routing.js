/**
 * routing.js — golden set for the intent router (command vs direct "ask").
 *
 * `expected: 'command'` → an OS action (open/close/navigate/sort…).
 * `expected: 'direct'`  → a question/conversation that should be answered by
 *                         "Ask André", not turned into an OS command.
 *
 * Tags group cases so the scorecard shows which categories are weak. Add rows
 * freely — this is the single source of truth for routing quality.
 */

/** @type {{ input: string, expected: 'command'|'direct', tags?: string[] }[]} */
export const ROUTING_DATASET = [
    // ── Clear commands ──────────────────────────────────────────────────────
    { input: 'open research', expected: 'command', tags: ['open'] },
    { input: 'open the resume', expected: 'command', tags: ['open'] },
    { input: 'show me the projects app', expected: 'command', tags: ['open'] },
    { input: 'close this window', expected: 'command', tags: ['window'] },
    { input: 'minimize the window', expected: 'command', tags: ['window'] },
    { input: 'show desktop', expected: 'command', tags: ['window'] },
    { input: 'go to github.com', expected: 'command', tags: ['browse'] },
    { input: 'search the web for medical imaging', expected: 'command', tags: ['browse'] },
    { input: 'sort by most cited', expected: 'command', tags: ['research-action'] },
    { input: 'open the third paper', expected: 'command', tags: ['research-action'] },
    { input: 'filter to only journals', expected: 'command', tags: ['research-action'] },
    { input: 'åpne forskning', expected: 'command', tags: ['open', 'norwegian'] },
    { input: 'lukk vinduet', expected: 'command', tags: ['window', 'norwegian'] },

    // ── Clear direct asks ───────────────────────────────────────────────────
    { input: 'who is André?', expected: 'direct', tags: ['bio'] },
    { input: 'tell me about his experience', expected: 'direct', tags: ['bio'] },
    { input: 'what does André do at DIPS?', expected: 'direct', tags: ['bio'] },
    { input: 'summarize his PhD research', expected: 'direct', tags: ['research-question'] },
    { input: 'what programming languages does he know?', expected: 'direct', tags: ['skills'] },
    { input: 'how many publications does he have?', expected: 'direct', tags: ['research-question'] },
    { input: 'is he available for consulting?', expected: 'direct', tags: ['contact'] },
    { input: 'explain what FastPathology is', expected: 'direct', tags: ['research-question'] },
    { input: 'why did he move into healthcare AI?', expected: 'direct', tags: ['bio'] },
    { input: 'fortell meg om utdanningen hans', expected: 'direct', tags: ['bio', 'norwegian'] },

    // ── Ambiguous / tricky (the router should still get these) ───────────────
    { input: 'can you tell me about his projects', expected: 'direct', tags: ['tricky', 'bio'] },
    { input: 'find pathology papers', expected: 'command', tags: ['tricky', 'research-action'] },
    { input: 'what can you do?', expected: 'direct', tags: ['tricky', 'meta'] },
    { input: 'show me what he worked on at SINTEF', expected: 'direct', tags: ['tricky', 'bio'] },
    { input: 'take me to his github', expected: 'command', tags: ['tricky', 'browse'] },
];
