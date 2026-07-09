import { getSocialContent } from '../../content/AppContent.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'social', name: 'Social Links', title: 'Social Links', icon: '🔗', kind: 'content',
    window: { width: 600, height: 500, render: getSocialContent },
    searchable: true,
    search: { icon: '🔗', subtitle: 'GitHub, LinkedIn, Google Scholar and more', keywords: 'social github linkedin twitter scholar publications links' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'social',
    match: /social|linkedin/,
    voiceKeywords: [
        'social links', 'linkedin', 'google scholar', 'social media',
        'sosiale lenker', 'sosiale medier',
    ],
};
