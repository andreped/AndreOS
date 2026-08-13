import { render } from './content.js';
import { setupStravaWindow } from './window.js';
import { stravaContext } from './context.js';
import { ensureLoaded } from './data.js';

// Warm the activity cache at boot so the assistant has the full dataset ready,
// even before the Strava window is opened.
ensureLoaded();

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'strava', name: 'Strava', title: 'Strava', icon: '🏃', iconSvg: new URL('../../../../assets/icons/strava.svg', import.meta.url).href, kind: 'content',
    window: { width: 460, height: 720, render, setup: (el) => { ensureLoaded(); setupStravaWindow(el); } },
    searchable: true,
    search: { icon: '🏃', subtitle: 'Latest running & cycling activities', keywords: 'strava running cycling ride run activities fitness workout training feed' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'strava',
    match: /strava/,
    context: stravaContext,
    voiceKeywords: [
        'strava', 'open strava', 'my activities', 'running', 'cycling',
        'aktiviteter', 'løping', 'sykling',
    ],
};
