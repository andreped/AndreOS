/**
 * resolution.js — golden set for app-name resolution (AssistantRegistry.resolveId).
 *
 * The assistant must map a spoken/typed app name to the correct app id before
 * it can open or act on it. `expected: null` means the phrase should NOT resolve
 * to any app (avoids false positives).
 */

/** @type {{ input: string, expected: string|null, tags?: string[] }[]} */
export const RESOLUTION_DATASET = [
    { input: 'research', expected: 'research' },
    { input: 'publications', expected: 'research' },
    { input: 'papers', expected: 'research' },
    { input: 'forskning', expected: 'research', tags: ['norwegian'] },
    { input: 'resume', expected: 'resume' },
    { input: 'cv', expected: 'resume', tags: ['alias'] },
    { input: 'projects', expected: 'projects' },
    { input: 'skills', expected: 'skills' },
    { input: 'contact', expected: 'contact' },
    { input: 'settings', expected: 'settings' },
    { input: 'preferences', expected: 'settings', tags: ['alias'] },
    { input: 'innstillinger', expected: 'settings', tags: ['norwegian'] },
    { input: 'about', expected: 'about' },
    { input: 'ask andre', expected: 'chat' },
    { input: 'browser', expected: 'browser' },
    // Negative cases — must not resolve to an app.
    { input: 'the weather in Oslo', expected: null, tags: ['negative'] },
    { input: 'banana', expected: null, tags: ['negative'] },
];
