import { render } from './content.js';
import { makeContentContext } from '../../assistant/retrieval/contentContext.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'skills', name: 'Skills', title: 'Skills.exe', icon: '⚙️', iconSvg: new URL('../../../../assets/icons/code.svg', import.meta.url).href, kind: 'content',
    window: { width: 700, height: 500, render },
    // Not surfaced in desktop search (matches previous behaviour).
    searchable: false,
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'skills',
    context: makeContentContext({ name: catalog.title, render }),
    match: /skill|tech|stack|ferdigh/,
    voiceKeywords: [
        'skills', 'technologies', 'tech stack', 'programming languages', 'tools', 'competence',
        'ferdigheter', 'teknologier', 'kompetanse',
    ],
};
