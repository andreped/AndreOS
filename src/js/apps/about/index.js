import { render } from './content.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'about', name: 'About Me', title: 'About Me.txt', icon: '👤', kind: 'content',
    window: { width: 600, height: 500, render },
    searchable: true,
    search: { icon: '👤', subtitle: 'Who André Pedersen is', keywords: 'about andre pedersen background bio profile' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'about',
    match: /about|bio|om\s+meg/,
    voiceKeywords: [
        'open about', 'about me', 'about andre', 'who are you', 'who is andre', 'tell me about',
        'om meg', 'hvem er du', 'hvem er andre',
    ],
};
