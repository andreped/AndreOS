import { render } from './content.js';
import { setupChatWindow } from './window.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'chat', name: 'Ask André', title: 'Ask André', icon: '💬', iconSvg: new URL('../../../../assets/icons/chat.svg', import.meta.url).href, kind: 'chat',
    window: { width: 500, height: 600, render, setup: (el) => setupChatWindow(el) },
    searchable: true,
    search: { icon: '💬', subtitle: 'Chat with an AI version of André', keywords: 'chat ai ask question andre' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'chat',
    match: /^chats?$|ask\s+andr|snakk\s+med/,
    voiceKeywords: [
        'chat', 'ask andre', 'talk to andre', 'ai chat', 'question for andre',
        'snakk med andre', 'still spørsmål', 'spørsmål til andre', 'chat med andre',
    ],
};
