import { render } from './content.js';
import { makeContentContext } from '../../assistant/retrieval/contentContext.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'resume', name: 'Resume', title: 'Resume.pdf', icon: '📄', iconSvg: 'assets/icons/document.svg', kind: 'content',
    window: { width: 700, height: 600, render },
    searchable: true,
    search: { icon: '📄', subtitle: 'Work experience, education, certifications', keywords: 'resume cv work job experience degree dips sintef ntnu' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'resume',
    context: makeContentContext({ name: catalog.title, render }),
    match: /resume|^cv$|curriculum|jobberfaring/,
    voiceKeywords: [
        'resume', 'curriculum vitae', 'work experience', 'career', 'experience',
        ' cv ',
        'åpne cv', 'vis cv', 'jobberfaring', 'erfaring',
    ],
};
