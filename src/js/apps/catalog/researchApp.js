import { getResearchContent } from '../../content/AppContent.js';

/**
 * Research catalog entry. The app's assistant-driven actions (open paper, sort,
 * filter, …) are declared separately in `../assistant/profiles/research.js`.
 * @type {import('./AppRegistry.js').AppManifest}
 */
export const researchApp = {
    id:    'research',
    name:  'Research',
    title: 'Research',
    icon:  '🔬',
    kind:  'research',
    window: { width: 1040, height: 660, render: getResearchContent },
    searchable: false, // publications are added to search dynamically via RAG
};
