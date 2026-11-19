/**
 * llmPlanner.js — the chat-model router and planner prompts, shared by chat.js
 * and the CLI planner experiment (tests/evals/decisionPlanner.experiment.mjs),
 * so both run exactly the same prompts. Pure: no engine, no DOM.
 *
 * Each task has one prompt per language (`en`, `no`), picked per message by default
 * (`auto`); the action schema, app ids and router labels stay English so parsing is
 * language-independent.
 */

const ROLE = { en: { user: 'User', assistant: 'Assistant' }, no: { user: 'Bruker', assistant: 'Assistent' } };
const histLines = (history, n, lang) => history.slice(-n)
    .map(m => `${m.role === 'user' ? ROLE[lang].user : ROLE[lang].assistant}: ${m.content}`)
    .join('\n');
const quote = (text) => text.replace(/"/g, "'");

export const PROMPT_LANGUAGES = ['auto', 'en', 'no'];

// tl;dr: keyword heuristic — misses Norwegian with none of these words; swap for a real detector if that bites.
const NO_WORDS = /[æøå]|\b(og|meg|hans|han|hva|hvem|hvor|hvilke|hvorfor|vis|lukk|minimer|sorter|filtrer|finn|fortell|forklar|oppsummer|den|det|denne|er|til|med|om|kan|du|jeg|la|oss|bytt|heller|gi|ta|kult|artikkel\w*|vinduet|skrivebordet)\b/i;

/** Prompt language for a message: the planners do best when prompt and input language match. */
export const promptLanguage = (text) => (NO_WORDS.test(String(text)) ? 'no' : 'en');

// Classification doesn't benefit from reasoning and loops with it — keep it fast/deterministic.
export const ROUTER_GEN  = { maxTokens: 8,   temperature: 0,   think: false };
export const PLANNER_GEN = { maxTokens: 150, temperature: 0.1, think: false };

const ROUTER = {
    en: (histCtx, msg) => `You are AndreOS's intent router. Classify the user's latest message as "command" or "direct".
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
Message: "${msg}"`,

    no: (histCtx, msg) => `Du er intensjonsruteren i AndreOS. Klassifiser brukerens siste melding som "command" eller "direct".
- "command" = en OS-handling: åpne/vise/lukke/minimere en navngitt app eller et vindu; vise skrivebordet; surfe eller søke på nettet; åpne en nummerert artikkel; eller gjøre noe i den aktive appen (sortere, filtrere, finne artikler). Gjelder også engelsk, f.eks. "open", "close", "show".
- "direct" = et spørsmål eller en samtale som skal besvares om André (bakgrunn, karriere, forskning, ferdigheter, meninger). Et spørsmål om hva/hvor/hvordan han jobbet er "direct" selv om det begynner med "vis meg" eller "fortell meg" (ingenting åpnes).
${histCtx ? `Nylig samtale:\n${histCtx}\n` : ''}Svar KUN med "command" eller "direct".
Eksempler:
"åpne forskning" → command
"vis meg prosjekt-appen" → command
"vis skrivebordet" → command
"gå til github.com" → command
"ta meg til GitHub-en hans" → command
"søk på nettet etter medisinsk bildebehandling" → command
"sorter etter flest siteringer" → command
"filtrer til bare tidsskrifter" → command
"finn patologiartikler" → command
"close the window" → command
"hvem er André?" → direct
"fortell meg om arbeidet hans" → direct
"vis meg hva han jobbet med hos SINTEF" → direct
"hvilke programmeringsspråk kan han?" → direct
"kan du fortelle meg om prosjektene hans" → direct
Melding: "${msg}"`,
};

export function routerPrompt(text, history = [], lang = 'auto') {
    const l = lang === 'auto' ? promptLanguage(text) : lang;
    return ROUTER[l](histLines(history, 4, l), quote(text));
}

/** @returns {'command'|'direct'} */
export const parseRoute = (out) => (String(out).toLowerCase().includes('command') ? 'command' : 'direct');

const PLANNER = {
    en: (histCtx, msg, appIds) => `You are AndreOS's command planner. Turn the request into a JSON array of actions that, run in order, fulfil it.
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
Request: "${msg}"`,

    no: (histCtx, msg, appIds) => `Du er kommandoplanleggeren i AndreOS. Gjør forespørselen om til en JSON-liste med handlinger som, kjørt i rekkefølge, oppfyller den.
Apper (brukes med "open"): ${appIds.join(', ')}
Handlinger:
  {"a":"open","t":"<app>"}         åpne en av appene over
  {"a":"open_paper","n":<tall>}    åpne en bestemt nummerert artikkel i Research-appen
  {"a":"close"} | {"a":"minimize"} | {"a":"desktop"}   vindusbehandling
  {"a":"browse","t":"<url-eller-nettsøk>"}   åpne nettleseren (eksterne nettsider, eller "søk på nettet etter …")
  {"a":"search","t":"<søk>"}       skriv i søkefeltet på AndreOS-skrivebordet/oppgavelinjen
  {"a":"chat","t":"<melding>"}     svar på et spørsmål eller gjør en oppgave om André (trenger ingen OS-handling)
Regler:
- Appene over er ALLTID {"a":"open","t":"<app>"} — for "åpne/vis/hent opp/se/bytt til/hva med <app>". Bruk app-id-en fra listen også når brukeren sier det norske navnet (forskning → research, CV → resume, prosjekter → projects, ferdigheter → skills, kontakt → contact, innstillinger → settings). Aldri {"a":"browse"} en app, og aldri {"a":"open","t":"chat"}.
- "skrivebord"/"vis skrivebordet"/"tilbake til skrivebordet" → {"a":"desktop"}. "lukk"/"minimer" er også OS-handlinger. Dette er IKKE apper — aldri {"a":"open","t":"desktop"}.
- Oppfølginger som bytter app ("hva med ferdighetene hans?", "heller prosjektene hans", "bytt til CV-en") → {"a":"open"} for den appen.
- Eksterne nettsider er ALLTID {"a":"browse"} (aldri {"a":"open"}). Gir brukeren en eksplisitt URL eller et domene (f.eks. "github.com", "example.org/x"), surf til den ORDRETT — skriv den aldri om. Bare et tjenestenavn alene peker til Andrés profil: github → github.com/andreped, linkedin → linkedin.com/in/andré-pedersen, scholar → hans Google Scholar. "søk/let/google … på nettet" → {"a":"browse"} med søket. Bruk {"a":"search"} kun for å søke i AndreOS selv.
- "forskningen hans", "publikasjonene hans", "artiklene hans" betyr Research-appen → {"a":"open","t":"research"}. Aldri surf på nettet for disse; bare github/linkedin/scholar/personlige nettsider er {"a":"browse"}.
- Et rent spørsmål, en oppfølging eller en oppgave om André ("oppsummer den", "hva handler den om?", "fortell meg om erfaringen hans", "hva er bakgrunnen hans") → én {"a":"chat","t":"…"}. Skriv om pronomen fra samtalen så meldingen står alene. Returner IKKE en tom liste for disse.
- SAMMENSATTE forespørsler som kombinerer en handling med et spørsmål/en oppgave (bundet med "og", "så", "deretter", "&", komma osv. — f.eks. "åpne den 2. artikkelen OG oppsummer den", "åpne forskning og fortell meg om den") MÅ gi BEGGE: OS-handlingen(e) ETTERFULGT av en avsluttende {"a":"chat"}. Stopp aldri etter åpningen — å glemme den siste chat-en er den vanligste feilen. Uttrykk som "oppsummer den", "gi meg et sammendrag", "forklar den", "hva handler den om", "hovedpoengene" er chat-steget.
- Legg til en avsluttende {"a":"chat"} KUN når forespørselen selv stiller et spørsmål eller gir en oppgave. Et rent "åpne X" har ingen chat.
- Planlegg KUN den SISTE forespørselen. Tidligere samtale er kontekst for å tolke referanser ("den", "den artikkelen", "den 3.") — hopp aldri over en handling eller returner en tom liste bare fordi noe allerede ble åpnet tidligere.
Eksempler:
"åpne forskning" → [{"a":"open","t":"research"}]
"vis meg prosjektene" → [{"a":"open","t":"projects"}]
"hva med ferdighetene hans?" → [{"a":"open","t":"skills"}]
"vis skrivebordet" → [{"a":"desktop"}]
"ok, vis skrivebordet" → [{"a":"desktop"}]
"åpne den 3. artikkelen" → [{"a":"open_paper","n":3}]
"oppsummer den for meg" → [{"a":"chat","t":"oppsummer denne artikkelen"}]
"åpne den niende artikkelen og gi meg et sammendrag av den" → [{"a":"open_paper","n":9},{"a":"chat","t":"oppsummer denne artikkelen"}]
"åpne den andre artikkelen og oppsummer den" → [{"a":"open_paper","n":2},{"a":"chat","t":"oppsummer denne artikkelen"}]
"hva handler den om?" → [{"a":"chat","t":"hva handler denne om"}]
"åpne GitHub-siden hans" → [{"a":"browse","t":"github.com/andreped"}]
"gå til github.com" → [{"a":"browse","t":"github.com"}]
"vis meg publikasjonene hans" → [{"a":"open","t":"research"}]
"søk på nettet etter digital patologi" → [{"a":"browse","t":"digital patologi"}]
"åpne CV-en og fortell meg om erfaringen hans" → [{"a":"open","t":"resume"},{"a":"chat","t":"fortell meg om erfaringen hans"}]
"åpne forskning, åpne den 40. artikkelen, og oppsummer viktige temaer" → [{"a":"open","t":"research"},{"a":"open_paper","n":40},{"a":"chat","t":"oppsummer viktige temaer i denne artikkelen"}]
Eksempel med flere runder (tidligere runder er allerede utført — planlegg likevel den siste forespørselen):
  [tidligere: bruker "åpne forskning" → assistent "Åpnet research."]
  "åpne den 3. artikkelen" → [{"a":"open_paper","n":3}]
Svar KUN med JSON-listen for den siste forespørselen.${histCtx ? `\nTidligere samtale (kun kontekst — ikke planlegg den på nytt):\n${histCtx}` : ''}
Forespørsel: "${msg}"`,
};

export function plannerPrompt(text, history = [], appIds = [], lang = 'auto') {
    const l = lang === 'auto' ? promptLanguage(text) : lang;
    return PLANNER[l](histLines(history, 6, l), quote(text), appIds);
}

/** First JSON array in the model output → non-empty actions, else null. Throws on malformed JSON. */
export function parsePlan(raw) {
    const jsonMatch = String(raw).match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return null;
    const actions = JSON.parse(jsonMatch[0]);
    return Array.isArray(actions) && actions.length > 0 ? actions : null;
}
