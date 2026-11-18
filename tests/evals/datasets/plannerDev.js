/**
 * plannerDev.js — a *development* set for tuning planner prompts / option wording.
 *
 * Tune on this set, report on the test sets (commands.js, plans.js, routing.js),
 * so prompt changes can't simply memorise the eval cases. Phrasings here are
 * deliberately different from the test sets. Not used by any scorecard.
 */

/** @type {{ input: string, expectedActions: Array<object>, activeApp?: string, tags?: string[] }[]} */
export const PLANNER_DEV_DATASET = [
    // ── Open apps (varied phrasing) ──────────────────────────────────────────
    { input: 'bring up the about me page', expectedActions: [{ a: 'open', t: 'about' }], tags: ['open'] },
    { input: 'can I see his CV?', expectedActions: [{ a: 'open', t: 'resume' }], tags: ['open'] },
    { input: 'I want to look at his open-source work', expectedActions: [{ a: 'open', t: 'projects' }], tags: ['open'] },
    { input: 'check out his skill set', expectedActions: [{ a: 'open', t: 'skills' }], tags: ['open'] },
    { input: 'pull up his publications', expectedActions: [{ a: 'open', t: 'research' }], tags: ['open'] },
    { input: 'show his strava runs', expectedActions: [{ a: 'open', t: 'strava' }], tags: ['open'] },
    { input: 'launch the system monitor', expectedActions: [{ a: 'open', t: 'monitor' }], tags: ['open'] },
    { input: 'open settings', expectedActions: [{ a: 'open', t: 'settings' }], tags: ['open'] },
    { input: 'let me play cast arena', expectedActions: [{ a: 'open', t: 'game' }], tags: ['open'] },
    { input: 'contact info please', expectedActions: [{ a: 'open', t: 'contact' }], tags: ['open'] },
    { input: 'now his projects instead', expectedActions: [{ a: 'open', t: 'projects' }], activeApp: 'skills', tags: ['open', 'switch'] },
    { input: 'åpne innstillinger', expectedActions: [{ a: 'open', t: 'settings' }], tags: ['open', 'norwegian'] },

    // ── Window management ────────────────────────────────────────────────────
    { input: 'shut this window', expectedActions: [{ a: 'close' }], activeApp: 'resume', tags: ['window'] },
    { input: 'hide this window', expectedActions: [{ a: 'minimize' }], activeApp: 'projects', tags: ['window'] },
    { input: 'go to the home screen', expectedActions: [{ a: 'desktop' }], tags: ['window'] },

    // ── External sites / web ─────────────────────────────────────────────────
    { input: 'visit his linkedin profile', expectedActions: [{ a: 'browse', t: 'linkedin.com/in/andr%C3%A9-pedersen' }], tags: ['browse'] },
    { input: 'his google scholar page', expectedActions: [{ a: 'browse', t: 'scholar.google.com/citations?user=U20zUHQAAAAJ' }], tags: ['browse'] },
    { input: 'show me his code on github', expectedActions: [{ a: 'browse', t: 'github.com/andreped' }], tags: ['browse'] },
    { input: 'go to arxiv.org', expectedActions: [{ a: 'browse', t: 'arxiv.org' }], tags: ['browse'] },
    { input: 'search online for whole slide imaging', expectedActions: [{ a: 'browse', t: 'whole slide imaging' }], tags: ['browse'] },

    // ── Papers ───────────────────────────────────────────────────────────────
    { input: 'show paper number 4', expectedActions: [{ a: 'open_paper', n: 4 }], activeApp: 'research', tags: ['paper'] },

    // ── Questions (answered by the chat model) ───────────────────────────────
    { input: 'where did he do his PhD?', expectedActions: [{ a: 'chat', t: 'where did he do his PhD' }], tags: ['chat'] },
    { input: 'summarise his most cited paper', expectedActions: [{ a: 'chat', t: 'summarise his most cited paper' }], tags: ['chat'] },
    { input: 'what is this app about?', expectedActions: [{ a: 'chat', t: 'what is this app about' }], activeApp: 'histolite', tags: ['chat'] },

    // ── Compound ─────────────────────────────────────────────────────────────
    { input: 'open the projects app and tell me which one is most popular', expectedActions: [{ a: 'open', t: 'projects' }, { a: 'chat', t: 'which project is most popular' }], tags: ['compound'] },
    { input: 'open his resume then close it', expectedActions: [{ a: 'open', t: 'resume' }, { a: 'close' }], tags: ['compound'] },
    { input: 'Open research app, paper 44, give me author list', expectedActions: [{ a: 'open', t: 'research' }, { a: 'open_paper', n: 44 }, { a: 'chat', t: 'give me the author list' }], tags: ['compound', 'paper'] },

    // ── Filler ───────────────────────────────────────────────────────────────
    { input: 'thanks!', expectedActions: [], tags: ['none'] },
];
