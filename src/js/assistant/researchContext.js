/**
 * researchContext.js — pure, window-agnostic resolver for research-app commands.
 *
 * When the Research window is focused, these phrasings ("open the second one",
 * "sort by most cited", "summarise it") are resolved deterministically — before
 * the LLM planner runs. Extracted so both the live assistant
 * (VoiceCommandManager._parseContextual) and the plan evals resolve them
 * identically, instead of the eval forcing the LLM to plan turns production never
 * sends to it.
 *
 * @param {string} rawText
 * @returns {{ intent: string, args: object, label: string } | null}
 */
export function resolveResearchIntent(rawText) {
    const t = rawText.toLowerCase().replace(/[.,!?]/g, ' ');

    // ── Open the Nth paper ──────────────────────────────────────────────────
    const ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
                       sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
    // Accept a broad set of verbs ("see"/"view"/"pull up"…) and also a bare
    // "the second one" — while Research is focused these mean "open that paper".
    const nthMatch =
        t.match(/(?:open|show|see|view|read|select|expand|check|pull\s+up|bring\s+up|load|go\s+to|jump\s+to)\s+(?:the\s+)?(\w+)\s+(?:paper|article|publication|item|result|one)/i)
        || t.match(/^(?:the\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+)(?:st|nd|rd|th)?\s+(?:paper|article|publication|item|result|one)\b/i);
    if (nthMatch) {
        const raw = nthMatch[1].toLowerCase();
        const n   = ORDINALS[raw] ?? (parseInt(raw) || null);
        if (n) return { intent: 'research_open_nth', args: { n }, label: `Open paper #${n}` };
    }
    // "open number 5" / "select 3"
    const numMatch = t.match(/(?:open|show|select|expand)\s+(?:number|item|paper|article|publication)?\s*(\d+)/i);
    if (numMatch) {
        const n = parseInt(numMatch[1]);
        if (n > 0) return { intent: 'research_open_nth', args: { n }, label: `Open paper #${n}` };
    }

    // ── Sort ────────────────────────────────────────────────────────────────
    if (/sort\s+by\s+cit|most\s+cited|by\s+citation/.test(t))
        return { intent: 'research_sort', args: { sort: 'cited' }, label: 'Sort by citations' };
    if (/sort\s+by\s+(?:date|newest|latest|recent)|newest|latest|most\s+recent/.test(t))
        return { intent: 'research_sort', args: { sort: 'date' }, label: 'Sort by newest' };
    if (/sort\s+by\s+(?:oldest|earliest|year)|oldest|earliest/.test(t))
        return { intent: 'research_sort', args: { sort: 'asc' }, label: 'Sort by oldest' };

    // ── Filter by type ────────────────────────────────────────────────────────
    if (/show\s+all|reset\s+filter|clear\s+filter|all\s+types/.test(t))
        return { intent: 'research_filter', args: { type: 'all' }, label: 'Show all types' };
    if (/journal/.test(t) && /show|filter|only/.test(t))
        return { intent: 'research_filter', args: { type: 'journal-article' }, label: 'Filter: journals' };
    if (/conference|proceedings/.test(t) && /show|filter|only/.test(t))
        return { intent: 'research_filter', args: { type: 'proceedings-article' }, label: 'Filter: conferences' };
    if (/preprint/.test(t) && /show|filter|only/.test(t))
        return { intent: 'research_filter', args: { type: 'preprint' }, label: 'Filter: preprints' };
    if (/book\s+chapter/.test(t) && /show|filter|only/.test(t))
        return { intent: 'research_filter', args: { type: 'book-chapter' }, label: 'Filter: book chapters' };

    // ── List categories ───────────────────────────────────────────────────────
    if (/(?:what|list|show|which)\s+(?:categor|filter|type|option)/.test(t))
        return { intent: 'research_categories', args: {}, label: 'List categories' };

    // ── Search within research ────────────────────────────────────────────────
    const searchMatch = rawText.match(/(?:search|find|look)\s+(?:for\s+)?(.+)/i);
    if (searchMatch) {
        const query = searchMatch[1].trim();
        if (query.length > 2)
            return { intent: 'research_search', args: { query }, label: `Search: "${query.slice(0, 30)}"` };
    }

    // ── Research question (conversational) — route to sidebar chat ────────────
    // Caught before the LLM action parser so it can't hallucinate OS commands
    // from natural-language research questions.
    if (/summarize|explain|describe|analys[ei]|tell\s+me\s+about|what\s+is|what\s+does|how\s+does|why\s+is|compare|discuss|abstract|conclusion/.test(t) ||
        /(?:next|previous|prev|last|this|the\s+selected)\s+paper/.test(t)) {
        return { intent: 'research_question', args: { query: rawText }, label: 'Ask about paper' };
    }

    return null;
}
