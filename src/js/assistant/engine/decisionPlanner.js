/**
 * decisionPlanner.js — route and plan OS actions with a decision model (System One
 * format) instead of having the chat LLM generate JSON. The decision model only
 * *picks* among candidates (action kind, app, website); slots come from the
 * request text, and `chat` steps are left for the regular LLM to answer.
 *
 * Returns the same action schema as chat.js `parseCommand`, or null.
 */
import { resolveResearchIntent } from '../researchContext.js';
import { assistantRegistry } from '../registry/AssistantRegistry.js';
import { ANDRE_INFO } from './andre-profile.js';

// Examples deliberately not taken from the eval sets, so the scores measure generalisation.
const ACTIONS = {
    open:             'Open, show, pull up or switch to one of the AndreOS apps, e.g. "bring up his CV", "let me look at the contact app", "actually, the publications instead"',
    open_paper:       'Open one specific paper by its number or position in the publication list, e.g. "the 7th paper", "show me the first one"',
    close:            'Close the current window, e.g. "close it", "get rid of this"',
    minimize:         'Minimize, hide or shrink the current window without closing it',
    desktop:          'Go back to or show the desktop',
    'browse:web':     'Visit any other website, or search the internet / Google for a topic, e.g. "go to example.org", "google transformers", "look up X on the web"',
    'search:andreos': 'Type a query into the AndreOS search bar; only when the visitor explicitly says to search AndreOS itself',
    chat:             'Answer a question (who, what, where, when, why, how, which), give requested information ("tell me …", "give me …", "list …") or do a writing task, about André or about what is on screen, e.g. "how long has he been at DIPS?", "explain this paper", "give me a short summary"',
    none:             'Only an acknowledgement with no request in it, e.g. "ok", "nice", "thank you"',
};

const bare = (url) => url.replace(/^https?:\/\/(www\.)?/, '');
const SITES = {
    github:   [bare(ANDRE_INFO.github),   "André's GitHub profile or code"],
    linkedin: [bare(ANDRE_INFO.linkedin), "André's LinkedIn profile"],
    scholar:  [bare(ANDRE_INFO.scholar),  "André's Google Scholar profile"],
};

const SITE_OPTIONS = Object.fromEntries(Object.entries(SITES).map(([k, [url, d]]) => [`browse:${k}`, `Visit ${d} (external website ${url})`]));

/** App options described by the catalog subtitle plus the assistant profile's voice keywords. */
const appOptions = (apps) => Object.fromEntries(apps.map((a) => [a.id, [
    `${a.name} app`, a.search?.subtitle, assistantRegistry.get(a.id)?.voiceKeywords?.slice(0, 6).join(', '),
].filter(Boolean).join('; ')]));

// The LLM router's definitions (chat.js routeIntent); examples deliberately not taken from the eval sets.
const ROUTE = {
    type: 'choice',
    instructions: 'Is the visitor asking the AndreOS assistant to perform an OS action, or asking something to be answered?',
    criteria: {
        command: 'An OS action: open, show, close or minimize an app or window, show the desktop, browse or search the web, open a numbered paper, or act on the current app (sort, filter or find papers), e.g. "open the skills app", "go to linkedin", "sort by year"',
        direct:  'A question or conversation to answer about André (bio, career, research, skills, opinions), e.g. "where did he study?", "what is his thesis about?", "show me how he got into AI"',
    },
};

/** @returns {Promise<'command'|'direct'>} */
export async function routeWithDecisions(text, { decide, activeApp }) {
    const state = `${activeApp ? `Focused window: ${activeApp}\n` : ''}Visitor said: "${text}"`;
    return (await decide(state, { route: ROUTE })).route.choice;
}

/**
 * @param {string} text  the user's latest request
 * @param {{ decide: (state: string, questions: object) => Promise<Record<string, any>>,
 *           apps: { id: string, name: string, search?: { subtitle?: string } }[],
 *           activeApp?: string }} opts  `decide` returns System One `answers`
 * @returns {Promise<Array<object>|null>}
 */
export async function planWithDecisions(text, { decide, apps, activeApp }) {
    const action = { type: 'choice', instructions: 'What should the AndreOS assistant do for this request?', criteria: { ...ACTIONS, ...SITE_OPTIONS } };
    const app = { type: 'choice', instructions: 'Which AndreOS app does the request refer to?', criteria: appOptions(apps) };
    // tl;dr: naive conjunction split — "search for cats and dogs" becomes two steps.
    // Upgrade path: ask a Noul per split point ("is this a separate request?").
    const clauses = text.split(/\s*,\s*(?:and\s+|then\s+)*|\s+(?:and\s+then|and|then)\s+/i).map(s => s.trim()).filter(Boolean);

    const steps = [];
    for (const clause of clauses) {
        const state = `${activeApp ? `Focused window: ${activeApp}\n` : ''}Visitor said: "${clause}"`;
        // One forward per question, so the app question is only asked for `open`.
        const { choice, probabilities: p = { [choice]: 1 } } = (await decide(state, { action })).action;
        const n = resolveResearchIntent(clause)?.args?.n ?? Number(clause.match(/\d+/)?.[0]);
        // Skip options the text can't support (no paper number; search bar without a search cue) and take the runner-up.
        const [kind, target] = (Object.keys(p).sort((a, b) => p[b] - p[a]).find((k) =>
            (k !== 'search:andreos' || /\b(search|find|look\s+up|søk|finn)\b/i.test(clause)) && (k !== 'open_paper' || n)) ?? choice).split(':');
        if (kind === 'none') continue;
        if (kind === 'open') steps.push({ a: 'open', t: (await decide(state, { app })).app.choice });
        else if (kind === 'open_paper') {
            if (n) steps.push({ a: 'open_paper', n });
        } else if (kind === 'browse') {
            const url = clause.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i)?.[0];
            steps.push({ a: 'browse', t: url ?? SITES[target]?.[0] ?? webQuery(clause) });
        } else if (kind === 'search') steps.push({ a: 'search', t: webQuery(clause) });
        else if (kind === 'chat') steps.push({ a: 'chat', t: clause });
        else steps.push({ a: kind });
    }
    return steps.length ? steps : null;
}

const webQuery = (clause) => clause
    .replace(/^.*?\b(?:search|look\s+up|google|find)\b\s*(?:the\s+web|online|the\s+internet)?\s*(?:for\s+)?/i, '')
    .replace(/\s+(?:on|in)\s+the\s+web$/i, '')
    .trim() || clause;
