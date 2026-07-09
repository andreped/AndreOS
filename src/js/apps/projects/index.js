import { render } from './content.js';
import { makeContentContext } from '../../assistant/retrieval/contentContext.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'projects', name: 'Projects', title: 'Projects', icon: '📁', kind: 'content',
    window: { width: 800, height: 600, render },
    searchable: true,
    search: { icon: '📁', subtitle: 'Open-source and research projects', keywords: 'projects github open source software' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'projects',
    context: makeContentContext({ name: catalog.title, render }),
    match: /project|portfolio|prosjekt/,
    voiceKeywords: [
        'projects', 'portfolio', 'open source', 'what have you built',
        'prosjekter', 'hva har du bygget',
    ],
};
