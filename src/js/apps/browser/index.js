import { render } from './content.js';
import { setupBrowserWindow } from './window.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'browser', name: 'Browser', title: 'Browser', icon: '🌐', iconSvg: 'assets/icons/browser.svg', kind: 'browser',
    window: {
        width: 960, height: 680, render, startUrl: 'https://yep.com',
        setup: (el, wd) => setupBrowserWindow(el, wd.startUrl ?? 'https://andreped.dev'),
    },
    searchable: true,
    search: { icon: '🌐', subtitle: 'Browse the web', keywords: 'browser internet web navigate' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'browser',
    match: /browser|internet|nettleser/,
    voiceKeywords: ['browser', 'open internet', 'navigate to', 'browse', 'nettleser', 'internett'],
};
