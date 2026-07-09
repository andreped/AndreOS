/**
 * Assistant profiles for the static content apps — how the AI recognises them
 * from natural language. These apps expose no in-app actions, so they carry
 * only name-matching and open-keywords (no capabilities).
 */

/** @type {import('../AssistantRegistry.js').AssistantProfile[]} */
export const contentProfiles = [
    {
        appId: 'about',
        match: /about|bio|om\s+meg/,
        voiceKeywords: [
            'open about', 'about me', 'about andre', 'who are you', 'who is andre', 'tell me about',
            'om meg', 'hvem er du', 'hvem er andre',
        ],
    },
    {
        appId: 'resume',
        match: /resume|^cv$|curriculum|jobberfaring/,
        voiceKeywords: [
            'resume', 'curriculum vitae', 'work experience', 'career', 'experience',
            ' cv ',
            'åpne cv', 'vis cv', 'jobberfaring', 'erfaring',
        ],
    },
    {
        appId: 'projects',
        match: /project|portfolio|prosjekt/,
        voiceKeywords: [
            'projects', 'portfolio', 'open source', 'what have you built',
            'prosjekter', 'hva har du bygget',
        ],
    },
    {
        appId: 'skills',
        match: /skill|tech|stack|ferdigh/,
        voiceKeywords: [
            'skills', 'technologies', 'tech stack', 'programming languages', 'tools', 'competence',
            'ferdigheter', 'teknologier', 'kompetanse',
        ],
    },
    {
        appId: 'contact',
        match: /contact|email|kontakt/,
        voiceKeywords: [
            'contact', 'email', 'reach out', 'get in touch', 'hire',
            'kontakt', 'epost', 'ta kontakt',
        ],
    },
    {
        appId: 'social',
        match: /social|linkedin/,
        voiceKeywords: [
            'social links', 'linkedin', 'google scholar', 'social media',
            'sosiale lenker', 'sosiale medier',
        ],
    },
];
