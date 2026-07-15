import { render } from './content.js';
import { setupGameWindow } from './window.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'game', name: 'Cast Arena', title: 'Cast Arena', icon: '🎮', iconSvg: 'assets/icons/cast-arena.svg', kind: 'game',
    window: { width: 960, height: 680, render, setup: (el) => setupGameWindow(el) },
    searchable: true,
    search: { icon: '🎮', subtitle: 'Play Cast Arena', keywords: 'game cast arena play' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'game',
    match: /game|cast|arena|spill/,
    voiceKeywords: ['game', 'play game', 'cast arena', 'play cast', 'spill', 'spille spill', 'cast arena'],
};
