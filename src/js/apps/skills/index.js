import { getSkillsContent } from '../../content/AppContent.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'skills', name: 'Skills', title: 'Skills.exe', icon: '⚙️', kind: 'content',
    window: { width: 700, height: 500, render: getSkillsContent },
    // Not surfaced in desktop search (matches previous behaviour).
    searchable: false,
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'skills',
    match: /skill|tech|stack|ferdigh/,
    voiceKeywords: [
        'skills', 'technologies', 'tech stack', 'programming languages', 'tools', 'competence',
        'ferdigheter', 'teknologier', 'kompetanse',
    ],
};
