/**
 * routing.js — golden set for the intent router (command vs direct "ask").
 *
 * `expected: 'command'` → an OS action (open/close/navigate/sort…).
 * `expected: 'direct'`  → a question/conversation that should be answered by
 *                         "Ask André", not turned into an OS command.
 *
 * Tags group cases so the scorecard shows which categories are weak. Add rows
 * freely — this is the single source of truth for routing quality.
 *
 * `no` is the Norwegian (Bokmål) input; see localize.js.
 */

/** @type {{ input: string, no: string, expected: 'command'|'direct', tags?: string[] }[]} */
export const ROUTING_DATASET = [
    // ── Clear commands ──────────────────────────────────────────────────────
    { input: 'open research', no: 'åpne forskning', expected: 'command', tags: ['open'] },
    { input: 'open the resume', no: 'åpne CV-en', expected: 'command', tags: ['open'] },
    { input: 'show me the projects app', no: 'vis meg prosjekt-appen', expected: 'command', tags: ['open'] },
    { input: 'close this window', no: 'lukk dette vinduet', expected: 'command', tags: ['window'] },
    { input: 'minimize the window', no: 'minimer vinduet', expected: 'command', tags: ['window'] },
    { input: 'show desktop', no: 'vis skrivebordet', expected: 'command', tags: ['window'] },
    { input: 'go to github.com', no: 'gå til github.com', expected: 'command', tags: ['browse'] },
    { input: 'search the web for medical imaging', no: 'søk på nettet etter medisinsk bildebehandling', expected: 'command', tags: ['browse'] },
    { input: 'sort by most cited', no: 'sorter etter flest siteringer', expected: 'command', tags: ['research-action'] },
    { input: 'open the third paper', no: 'åpne den tredje artikkelen', expected: 'command', tags: ['research-action'] },
    { input: 'filter to only journals', no: 'filtrer til bare tidsskrifter', expected: 'command', tags: ['research-action'] },

    // ── Clear direct asks ───────────────────────────────────────────────────
    { input: 'who is André?', no: 'hvem er André?', expected: 'direct', tags: ['bio'] },
    { input: 'tell me about his experience', no: 'fortell meg om erfaringen hans', expected: 'direct', tags: ['bio'] },
    { input: 'what does André do at DIPS?', no: 'hva gjør André hos DIPS?', expected: 'direct', tags: ['bio'] },
    { input: 'summarize his PhD research', no: 'oppsummer doktorgradsforskningen hans', expected: 'direct', tags: ['research-question'] },
    { input: 'what programming languages does he know?', no: 'hvilke programmeringsspråk kan han?', expected: 'direct', tags: ['skills'] },
    { input: 'how many publications does he have?', no: 'hvor mange publikasjoner har han?', expected: 'direct', tags: ['research-question'] },
    { input: 'is he available for consulting?', no: 'er han tilgjengelig for konsulentoppdrag?', expected: 'direct', tags: ['contact'] },
    { input: 'explain what FastPathology is', no: 'forklar hva FastPathology er', expected: 'direct', tags: ['research-question'] },
    { input: 'why did he move into healthcare AI?', no: 'hvorfor gikk han over til KI i helsevesenet?', expected: 'direct', tags: ['bio'] },
    { input: 'tell me about his education', no: 'fortell meg om utdanningen hans', expected: 'direct', tags: ['bio'] },

    // ── Ambiguous / tricky (the router should still get these) ───────────────
    { input: 'can you tell me about his projects', no: 'kan du fortelle meg om prosjektene hans', expected: 'direct', tags: ['tricky', 'bio'] },
    { input: 'find pathology papers', no: 'finn patologiartikler', expected: 'command', tags: ['tricky', 'research-action'] },
    { input: 'what can you do?', no: 'hva kan du gjøre?', expected: 'direct', tags: ['tricky', 'meta'] },
    { input: 'show me what he worked on at SINTEF', no: 'vis meg hva han jobbet med hos SINTEF', expected: 'direct', tags: ['tricky', 'bio'] },
    { input: 'take me to his github', no: 'ta meg til GitHub-en hans', expected: 'command', tags: ['tricky', 'browse'] },
];
