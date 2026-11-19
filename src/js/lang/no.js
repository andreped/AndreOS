/**
 * Norwegian (Bokmål) — every static, language-specific string the assistant needs.
 * Same shape as ./en.js; see ./index.js.
 */
export default {
    id: 'no',
    name: 'Norwegian',
    nativeName: 'Norsk',
    short: 'NO',
    whisper: 'norwegian',
    reply: 'Always respond in Norwegian (Bokmål).',
    // tl;dr: keyword heuristic — misses Norwegian with none of these words; swap for a real detector if that bites.
    markers: /[æøå]|\b(og|meg|hans|han|hva|hvem|hvor|hvilke|hvorfor|vis|lukk|minimer|sorter|filtrer|finn|fortell|forklar|oppsummer|den|det|denne|er|til|med|om|kan|du|jeg|la|oss|bytt|heller|gi|ta|kult|artikkel\w*|vinduet|skrivebordet)\b/i,

    roles: { user: 'Bruker', assistant: 'Assistent' },

    router: (histCtx, msg) => `Du er intensjonsruteren i AndreOS. Klassifiser brukerens siste melding som "command" eller "direct".
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

    planner: (histCtx, msg, appIds) => `Du er kommandoplanleggeren i AndreOS. Gjør forespørselen om til en JSON-liste med handlinger som, kjørt i rekkefølge, oppfyller den.
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

    voice: {
        close:    ['lukk vinduet', 'lukk appen', 'avslutt', 'steng'],
        minimize: ['minimer vinduet', 'skjul vinduet'],
        desktop:  ['vis skrivebordet', 'skjul alle vinduer'],
        help:     ['hjelp', 'kommandoer', 'hva kan du gjøre'],
        compound: ['og spør', 'og si', 'og åpne', 'og fortell', ' spør ', ' si ', ' fortell '],
        osVerbs:   ['åpne', 'lukk', 'vis', 'søk', 'minimer', 'naviger', 'gå\\s+til'],
        openVerbs: ['åpne', 'vis'],
        and:       ['og'],
        askVerbs:  ['spør', 'si', 'fortell', 'send'],
        chatVerbs: ['spør'],
        helpExamples: ['"åpne CV"', '"snakk med André"', '"prosjekter"', '"lukk vinduet"', '"minimer vinduet"', '"vis skrivebordet"'],
    },
};
