/** @type {import('../AssistantRegistry.js').AssistantProfile} */
export const settingsProfile = {
    appId: 'settings',
    match: /setting|preference|option|configur|innstilling|instilling|preferanse/,
    voiceKeywords: [
        'settings', 'preferences', 'configuration', 'options', 'configure',
        'innstillinger', 'instillinger', 'preferanser', 'valg',
    ],
};
