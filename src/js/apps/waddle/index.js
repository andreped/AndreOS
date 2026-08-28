import { render } from './content.js';
import { setupWaddleWindow } from './window.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'waddle', name: 'Waddle', title: 'Waddle', icon: '🐧', iconSvg: new URL('../../../../assets/icons/waddle.svg', import.meta.url).href, kind: 'game',
    window: { width: 960, height: 680, render, setup: (el) => setupWaddleWindow(el) },
    searchable: true,
    search: { icon: '🐧', subtitle: 'Play Waddle (playtest)', keywords: 'waddle game penguin play playtest demo' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'waddle',
    match: /waddle|penguin|pingvin/,
    voiceKeywords: ['waddle', 'play waddle', 'open waddle', 'penguin', 'pingvin'],
};
