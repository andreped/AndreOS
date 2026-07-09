import { getChatContent } from '../../content/AppContent.js';

/** @type {import('./AppRegistry.js').AppManifest} */
export const chatApp = {
    id:    'chat',
    name:  'Ask André',
    title: 'Ask André',
    icon:  '💬',
    kind:  'chat',
    window: { width: 500, height: 600, render: getChatContent },
    searchable: true,
    search: { icon: '💬', subtitle: 'Chat with an AI version of André', keywords: 'chat ai ask question andre' },
};
