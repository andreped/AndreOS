import { getResumeContent } from '../../content/AppContent.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'resume', name: 'Resume', title: 'Resume.pdf', icon: '📄', kind: 'content',
    window: { width: 700, height: 600, render: getResumeContent },
    searchable: true,
    search: { icon: '📄', subtitle: 'Work experience, education, certifications', keywords: 'resume cv work job experience degree dips sintef ntnu' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'resume',
    match: /resume|^cv$|curriculum|jobberfaring/,
    voiceKeywords: [
        'resume', 'curriculum vitae', 'work experience', 'career', 'experience',
        ' cv ',
        'åpne cv', 'vis cv', 'jobberfaring', 'erfaring',
    ],
};
