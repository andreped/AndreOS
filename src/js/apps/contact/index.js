import { getContactContent } from '../../content/AppContent.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'contact', name: 'Contact', title: 'Contact.txt', icon: '✉️', kind: 'content',
    window: { width: 500, height: 400, render: getContactContent },
    searchable: true,
    search: { icon: '✉️', subtitle: 'Get in touch with André', keywords: 'contact email reach out message' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'contact',
    match: /contact|email|kontakt/,
    voiceKeywords: [
        'contact', 'email', 'reach out', 'get in touch', 'hire',
        'kontakt', 'epost', 'ta kontakt',
    ],
};
