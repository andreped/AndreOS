import { getSettingsContent } from '../../content/AppContent.js';

/** @type {import('./AppRegistry.js').AppManifest} */
export const settingsApp = {
    id:    'settings',
    name:  'Settings',
    title: 'Settings',
    icon:  '⚙️',
    kind:  'settings',
    window: { width: 720, height: 600, render: getSettingsContent },
    searchable: true,
    search: { icon: '⚙️', subtitle: 'AI model, voice commands, preferences', keywords: 'settings model ai voice preferences configure' },
};
