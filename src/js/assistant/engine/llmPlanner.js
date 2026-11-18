/**
 * llmPlanner.js — the chat-model router and planner prompts, shared by chat.js
 * and the CLI planner experiment (tests/evals/decisionPlanner.experiment.mjs),
 * so both run exactly the same prompts. Pure: no engine, no DOM.
 */

const histLines = (history, n) => history.slice(-n)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

// Classification doesn't benefit from reasoning and loops with it — keep it fast/deterministic.
export const ROUTER_GEN  = { maxTokens: 8,   temperature: 0,   think: false };
export const PLANNER_GEN = { maxTokens: 150, temperature: 0.1, think: false };

export function routerPrompt(text, history = []) {
    const histCtx = histLines(history, 4);
    return `You are AndreOS's intent router. Classify the user's latest message as "command" or "direct".
- "command" = an OS action: open/show/close/minimize a named app or window; show desktop; browse or search the web; open a numbered paper; or act on the current app (sort, filter, find papers). Includes non-English, e.g. Norwegian ("åpne", "lukk", "vis").
- "direct" = a question or conversation to answer about André (bio, career, research, skills, opinions). A question about what/where/how he worked is "direct" even if it opens with "show me" or "tell me" (nothing gets opened).
${histCtx ? `Recent conversation:\n${histCtx}\n` : ''}Reply with ONLY "command" or "direct".
Examples:
"open research" → command
"show me the projects app" → command
"show desktop" → command
"go to github.com" → command
"take me to his github" → command
"search the web for medical imaging" → command
"sort by most cited" → command
"filter to only journals" → command
"find pathology papers" → command
"lukk vinduet" → command
"who is André?" → direct
"tell me about his work" → direct
"show me what he worked on at SINTEF" → direct
"what programming languages does he know?" → direct
"can you tell me about his projects" → direct
Message: "${text.replace(/"/g, "'")}"`;
}

/** @returns {'command'|'direct'} */
export const parseRoute = (out) => (String(out).toLowerCase().includes('command') ? 'command' : 'direct');

export function plannerPrompt(text, history = [], appIds = []) {
    const histCtx = histLines(history, 6);
    return `You are AndreOS's command planner. Turn the request into a JSON array of actions that, run in order, fulfil it.
Apps (use with "open"): ${appIds.join(', ')}
Actions:
  {"a":"open","t":"<app>"}         open one of the apps listed above
  {"a":"open_paper","n":<number>}  open a specific numbered paper in the Research app
  {"a":"close"} | {"a":"minimize"} | {"a":"desktop"}   window management
  {"a":"browse","t":"<url-or-web-query>"}   open the web browser (external sites, or "search the web for …")
  {"a":"search","t":"<query>"}     type into the AndreOS desktop/taskbar search bar
  {"a":"chat","t":"<message>"}     answer a question or do a task about André (needs no OS action)
Rules:
- The apps listed above are ALWAYS {"a":"open","t":"<app>"} — for "open/show/pull up/see/switch to/what about <app>". Never {"a":"browse"} an app, and never {"a":"open","t":"chat"}.
- "desktop"/"show the desktop"/"back to the desktop" → {"a":"desktop"}. "close"/"minimize" are OS actions too. These are NOT apps — never {"a":"open","t":"desktop"}.
- Follow-ups that switch apps ("what about his skills?", "actually his projects", "switch to resume") → {"a":"open"} for that app.
- External websites are ALWAYS {"a":"browse"} (never {"a":"open"}). If the user gives an explicit URL or domain (e.g. "github.com", "example.org/x"), browse it VERBATIM — never rewrite it. Only a bare service name maps to André's profile: github → github.com/andreped, linkedin → linkedin.com/in/andré-pedersen, scholar → his Google Scholar. Also "search/look/google … on the web" → {"a":"browse"} with the query. Only use {"a":"search"} to search AndreOS itself.
- "his research", "his publications", "his papers" mean the Research app → {"a":"open","t":"research"}. Never web-browse for these; only github/linkedin/scholar/personal sites are {"a":"browse"}.
- A bare question, follow-up, or task about André ("summarise it", "what is it about?", "tell me about his experience", "what's his background") → a single {"a":"chat","t":"…"}. Rewrite pronouns from the conversation so the message stands alone. Do NOT return an empty array for these.
- COMPOUND requests that pair an action with a question/task (joined by "and", "then", "&", a comma, etc. — e.g. "open the 2nd paper AND summarise it", "open research and tell me about it") MUST output BOTH: the OS action(s) FOLLOWED by a trailing {"a":"chat"}. Never stop after the open — dropping the final chat is the most common mistake. Phrases like "summarise/summary of it", "give me a summary", "explain it", "what is it about", "the gist of it" are the chat step.
- Add a trailing {"a":"chat"} ONLY when the request itself asks a question or task. A plain "open X" has no chat.
- Plan the LATEST request only. Any earlier conversation is context for resolving references ("it", "that paper", "the 3rd one") — never skip an action or return an empty array just because something was already opened earlier.
Examples:
"open research" → [{"a":"open","t":"research"}]
"show me the projects" → [{"a":"open","t":"projects"}]
"what about his skills?" → [{"a":"open","t":"skills"}]
"show desktop" → [{"a":"desktop"}]
"ok show the desktop" → [{"a":"desktop"}]
"open the 3rd paper" → [{"a":"open_paper","n":3}]
"summarise it for me" → [{"a":"chat","t":"summarise this paper"}]
"open the ninth paper and give me a summary of the paper" → [{"a":"open_paper","n":9},{"a":"chat","t":"summarise this paper"}]
"open the second paper and summarise it" → [{"a":"open_paper","n":2},{"a":"chat","t":"summarise this paper"}]
"what is it about?" → [{"a":"chat","t":"what is this about"}]
"pop open his github page" → [{"a":"browse","t":"github.com/andreped"}]
"go to github.com" → [{"a":"browse","t":"github.com"}]
"show me his publications" → [{"a":"open","t":"research"}]
"search the web for digital pathology" → [{"a":"browse","t":"digital pathology"}]
"open resume and tell me about his experience" → [{"a":"open","t":"resume"},{"a":"chat","t":"tell me about his experience"}]
"open research, open 40th paper, and summarize important topics" → [{"a":"open","t":"research"},{"a":"open_paper","n":40},{"a":"chat","t":"summarize important topics in this paper"}]
Multi-turn example (earlier turns already ran — still plan the latest request):
  [earlier: user "open research" → assistant "Opened research."]
  "open the 3rd paper" → [{"a":"open_paper","n":3}]
Reply with ONLY the JSON array for the latest request.${histCtx ? `\nEarlier conversation (context only — do not re-plan it):\n${histCtx}` : ''}
Request: "${text.replace(/"/g, "'")}"`;
}

/** First JSON array in the model output → non-empty actions, else null. Throws on malformed JSON. */
export function parsePlan(raw) {
    const jsonMatch = String(raw).match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return null;
    const actions = JSON.parse(jsonMatch[0]);
    return Array.isArray(actions) && actions.length > 0 ? actions : null;
}
