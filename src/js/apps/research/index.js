import { getResearchContent } from '../../content/AppContent.js';
import { setupResearchWindow } from './window.js';

/**
 * Research — the reference example of an app that declares rich, in-app
 * capabilities the assistant can drive. Capability handlers call the app's
 * runtime API (exposed by the window as `window.__ResearchApp`).
 */

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'research', name: 'Research', title: 'Research', icon: '🔬', kind: 'research',
    window: { width: 1040, height: 660, render: getResearchContent, setup: (el) => setupResearchWindow(el) },
    searchable: false, // publications are added to search dynamically via RAG
};

/** Convenience: the live Research window API, or null if not open yet. */
const api = () => /** @type {any} */ (window).__ResearchApp ?? null;

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'research',
    match: /research|paper|publication|science|forskning/,
    voiceKeywords: [
        'research', 'publications', 'papers', 'science', 'scientific work',
        'forskning', 'publikasjoner', 'artikler', 'vitenskapelig',
    ],
    ready: () => !!api(),

    capabilities: [
        {
            id: 'openPaper', scope: 'when-active',
            description: 'Open the Nth paper in the current list.',
            params: { n: 'integer (1-based index)' },
            examples: ['open the 3rd paper', 'show paper number 5'],
            invoke: ({ n }, ctx) => {
                const ok = api()?.openPaper(n);
                if (!ok) ctx.notify(`No paper #${n} in current list`, 'warning');
                return { ok: !!ok };
            },
        },
        {
            id: 'sort', scope: 'when-active',
            description: 'Sort papers by citations, newest, or oldest.',
            params: { by: "'cited' | 'date' | 'asc'" },
            examples: ['sort by most cited', 'show newest first', 'oldest first'],
            invoke: ({ by }) => { api()?.setSort(by); return { ok: true }; },
        },
        {
            id: 'filter', scope: 'when-active',
            description: 'Filter papers by publication type.',
            params: { type: "'all' | 'journal-article' | 'proceedings-article' | 'preprint' | 'book-chapter'" },
            examples: ['show only journals', 'filter conferences', 'show all types'],
            invoke: ({ type }) => { api()?.setFilter(type); return { ok: true }; },
        },
        {
            id: 'search', scope: 'when-active',
            description: 'Search within the publication list.',
            params: { query: 'search text' },
            examples: ['search for segmentation', 'find pathology papers'],
            invoke: ({ query }) => { api()?.search(query); return { ok: true }; },
        },
        {
            id: 'categories', scope: 'when-active',
            description: 'List the available publication categories.',
            examples: ['what categories are there', 'list filters'],
            invoke: (_args, ctx) => {
                const cats = api()?.getCategories() ?? 'Research not open';
                ctx.notify(`📋 Available categories: ${cats}`, 'info');
                return { ok: true };
            },
        },
    ],
};
