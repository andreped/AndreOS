import { getBrowserContent } from '../../content/AppContent.js';

/** @type {import('./AppRegistry.js').AppManifest} */
export const browserApp = {
    id:    'browser',
    name:  'Browser',
    title: 'Browser',
    icon:  '🌐',
    kind:  'browser',
    window: { width: 960, height: 680, render: getBrowserContent, startUrl: 'https://yep.com' },
    searchable: true,
    search: { icon: '🌐', subtitle: 'Browse the web', keywords: 'browser internet web navigate' },
};
