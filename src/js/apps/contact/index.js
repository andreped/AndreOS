import { render } from './content.js';
import { makeContentContext } from '../../assistant/retrieval/contentContext.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'contact', name: 'Contact', title: 'Contact.txt', icon: '✉️', iconSvg: 'assets/icons/mail.svg', kind: 'content',
    window: { width: 500, height: 400, render },
    searchable: true,
    search: { icon: '✉️', subtitle: 'Get in touch with André', keywords: 'contact email reach out message' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'contact',
    context: makeContentContext({ name: catalog.title, render }),
    match: /contact|email|kontakt/,
    voiceKeywords: [
        'contact', 'email', 'reach out', 'get in touch', 'hire',
        'kontakt', 'epost', 'ta kontakt',
    ],
};
