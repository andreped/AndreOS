import { render } from './content.js';
import { setupEvalsWindow } from './window.js';

/**
 * Evals — an in-OS dashboard for the assistant's quality scorecard.
 *
 * Shows the committed deterministic scorecard (retrieval / resolution /
 * integrity, written by `npm run eval` and CI) and can run every suite live in
 * the browser — including the LLM routing + command-parsing evals against the
 * real Ask André engine.
 */

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'evals', name: 'Evals', title: 'Assistant Evals', icon: '🧪', kind: 'evals',
    window: { width: 860, height: 640, render, setup: (el) => setupEvalsWindow(el) },
    searchable: true,
    search: { icon: '🧪', subtitle: 'Assistant quality scorecard & benchmarks', keywords: 'evals eval benchmark metrics quality test assistant score' },
};

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'evals',
    match: /eval|benchmark|scorecard|metric|assistant\s+quality/,
    voiceKeywords: ['evals', 'evaluations', 'benchmark', 'scorecard', 'assistant quality', 'metrics'],
};
