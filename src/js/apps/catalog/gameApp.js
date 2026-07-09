import { getGameContent } from '../../content/AppContent.js';

/** @type {import('./AppRegistry.js').AppManifest} */
export const gameApp = {
    id:    'game',
    name:  'Cast Arena',
    title: 'Cast Arena',
    icon:  '🎮',
    kind:  'game',
    window: { width: 960, height: 680, render: getGameContent },
    searchable: true,
    search: { icon: '🎮', subtitle: 'Play Cast Arena', keywords: 'game cast arena play' },
};
