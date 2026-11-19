/**
 * resolution.js — golden set for app-name resolution (AssistantRegistry.resolveId).
 *
 * The assistant must map a spoken/typed app name to the correct app id before
 * it can open or act on it. `expected: null` means the phrase should NOT resolve
 * to any app (avoids false positives). `no` is the Norwegian (Bokmål) input;
 * see localize.js.
 */

/** @type {{ input: string, no: string, expected: string|null, tags?: string[] }[]} */
export const RESOLUTION_DATASET = [
    { input: 'research', no: 'forskning', expected: 'research' },
    { input: 'publications', no: 'publikasjoner', expected: 'research' },
    { input: 'papers', no: 'artikler', expected: 'research' },
    { input: 'resume', no: 'cv', expected: 'resume' },
    { input: 'cv', no: 'CV-en', expected: 'resume', tags: ['alias'] },
    { input: 'projects', no: 'prosjekter', expected: 'projects' },
    { input: 'skills', no: 'ferdigheter', expected: 'skills' },
    { input: 'contact', no: 'kontakt', expected: 'contact' },
    { input: 'settings', no: 'innstillinger', expected: 'settings' },
    { input: 'preferences', no: 'preferanser', expected: 'settings', tags: ['alias'] },
    { input: 'about', no: 'om meg', expected: 'about' },
    { input: 'browser', no: 'nettleser', expected: 'browser' },
    // Negative cases — must not resolve to an app.
    { input: 'ask andre', no: 'spør andré', expected: null, tags: ['negative'] },
    { input: 'the weather in Oslo', no: 'været i Oslo', expected: null, tags: ['negative'] },
    { input: 'banana', no: 'banan', expected: null, tags: ['negative'] },
];
