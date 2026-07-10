/**
 * answers.js — golden set for RAGAS-style answer quality (scoreAnswers.js).
 *
 * These are direct "ask André" questions with a curated **reference answer** and
 * the facts a good answer should contain. Unlike the other datasets, this one
 * grades the free-text the model writes — so it carries the material the scorer
 * needs to approximate RAGAS facets *lexically* (no judge model, fully
 * reproducible):
 *
 *   • reference       — a model answer (drives correctness via token-set F1)
 *   • keyPoints       — the facts a correct answer must surface (correctness +
 *                       relevancy via keyword coverage)
 *   • groundTruth     — extra true facts that count as "grounded" for
 *                       faithfulness even if not in the reference wording
 *   • mustNotContain  — tell-tale hallucinations; if present, faithfulness is
 *                       hard-capped (e.g. claiming the wrong employer/university)
 *
 * All facts come from andre-profile.js (the assistant's own system prompt), so a
 * faithful model *can* score well. `activeApp` optionally sets viewing context.
 */

/** @type {import('../harness/scoreAnswers.js').AnswerCase[]} */
export const ANSWERS_DATASET = [
    {
        id: 'who-is-andre',
        question: 'Who is André?',
        reference:
            'André Pedersen is a Norwegian Senior AI Engineer and researcher with a PhD in Medical Technology, ' +
            'specialising in applied machine learning, medical imaging, and production AI systems for healthcare.',
        keyPoints: ['Senior AI Engineer', 'Norwegian', 'medical imaging', 'healthcare'],
        groundTruth: ['PhD in Medical Technology', 'over eight years experience', 'researcher', 'machine learning'],
        mustNotContain: ['data scientist at Google', 'professor at MIT'],
        tags: ['bio'],
    },
    {
        id: 'current-role',
        question: 'Where does André work now?',
        reference:
            'André is a Senior AI Engineer at DIPS AS in Oslo, where he builds AI-powered software for Norwegian hospitals.',
        keyPoints: ['DIPS', 'Senior AI Engineer', 'Oslo'],
        groundTruth: ['Norwegian hospitals', 'Pasientsamtale', 'DIPS AI', 'since May 2025'],
        mustNotContain: ['Google', 'Microsoft', 'SINTEF now', 'currently at Sopra Steria'],
        tags: ['bio', 'career'],
    },
    {
        id: 'education',
        question: 'What is his educational background?',
        reference:
            'He holds a PhD in Medical Technology (AI for computational pathology) from NTNU Trondheim, and an MSc in ' +
            'Applied Physics and Mathematics from UiT Tromsø.',
        keyPoints: ['PhD', 'NTNU', 'MSc', 'UiT'],
        groundTruth: ['computational pathology', 'Applied Physics and Mathematics', 'Tromsø', 'Medical Technology'],
        mustNotContain: ['Stanford', 'Oxford', 'PhD from MIT'],
        tags: ['education'],
    },
    {
        id: 'fastpathology',
        question: 'What is FastPathology?',
        reference:
            'FastPathology is an open-source C++/Qt5 desktop platform for running deep learning on whole-slide images ' +
            'in digital pathology, which André was a key developer on at SINTEF.',
        keyPoints: ['open-source', 'digital pathology', 'deep learning'],
        groundTruth: ['C++', 'Qt5', 'whole-slide images', 'SINTEF', 'IEEE Access'],
        mustNotContain: ['commercial product', 'written in Java'],
        tags: ['research-question', 'projects'],
        activeApp: 'research',
    },
    {
        id: 'programming-languages',
        question: 'What programming languages does André know?',
        reference:
            'His primary language is Python, and he also works in C++, C#, and JavaScript/TypeScript, among others.',
        keyPoints: ['Python', 'C++', 'TypeScript'],
        groundTruth: ['C#', 'JavaScript', 'Dart', 'primary language'],
        mustNotContain: ['only knows Python', 'does not code'],
        tags: ['skills'],
    },
    {
        id: 'publication-count',
        question: 'How many publications does André have?',
        reference:
            'André has over 30 peer-reviewed publications with more than 500 citations and an h-index of 15.',
        keyPoints: ['30', 'citations', 'h-index'],
        groundTruth: ['peer-reviewed', '500 citations', 'h-index 15'],
        mustNotContain: ['no publications', 'two papers'],
        tags: ['research-question'],
    },
    {
        id: 'consulting-availability',
        question: 'Is there information about him being available for consulting?',
        reference:
            "The portfolio does not state his consulting availability; you can reach out to him directly via email at andrped94@gmail.com to ask.",
        keyPoints: ['contact', 'email'],
        groundTruth: ["don't have that information", 'andrped94@gmail.com', 'reach out'],
        mustNotContain: ['available for $500 per hour', 'not available at all'],
        tags: ['contact', 'abstain'],
    },
    {
        id: 'healthcare-focus',
        question: 'Why does André work on healthcare AI?',
        reference:
            'André specialises in applied machine learning and medical imaging, building production AI systems that help ' +
            'Norwegian hospitals — combining his PhD research in medical technology with real-world clinical deployment.',
        keyPoints: ['medical imaging', 'healthcare', 'hospitals'],
        groundTruth: ['production AI systems', 'clinical', 'medical technology', 'Norwegian'],
        mustNotContain: ['works in finance', 'builds video games'],
        tags: ['bio', 'research-question'],
    },
];
