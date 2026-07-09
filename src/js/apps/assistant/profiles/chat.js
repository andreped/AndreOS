/** @type {import('../AssistantRegistry.js').AssistantProfile} */
export const chatProfile = {
    appId: 'chat',
    match: /^chats?$|ask\s+andr|snakk\s+med/,
    voiceKeywords: [
        'chat', 'ask andre', 'talk to andre', 'ai chat', 'question for andre',
        'snakk med andre', 'still spørsmål', 'spørsmål til andre', 'chat med andre',
    ],
};
