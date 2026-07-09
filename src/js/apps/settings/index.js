import { render } from './content.js';
import { setupSettingsWindow } from './window.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'settings', name: 'Settings', title: 'Settings', icon: '⚙️', kind: 'settings',
    window: { width: 720, height: 600, render, setup: (el) => setupSettingsWindow(el) },
    searchable: true,
    search: { icon: '⚙️', subtitle: 'AI model, voice commands, preferences', keywords: 'settings model ai voice preferences configure' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'settings',
    match: /setting|preference|option|configur|innstilling|instilling|preferanse/,
    voiceKeywords: [
        'settings', 'preferences', 'configuration', 'options', 'configure',
        'innstillinger', 'instillinger', 'preferanser', 'valg',
    ],
};
