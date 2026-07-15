import { render } from './content.js';

/** @type {import('../registry/AppRegistry.js').AppManifest} */
export const catalog = {
    id: 'histolite', name: 'HistoLite', title: 'HistoLite', icon: '🔬', iconSvg: new URL('../../../../assets/icons/histolite.svg', import.meta.url).href, kind: 'browser',
    window: { width: 1000, height: 720, render, setup: setupHistoLiteWindow },
    searchable: true,
    search: { icon: '🔬', subtitle: 'Digital pathology web app', keywords: 'histolite pathology histology digital slide microscope whole slide imaging' },
};

/**
 * The embedded viewer sizes its canvas on load, but the window is still playing
 * its open animation then, so it paints to a zero-size viewport (blank until you
 * interact). Nudge the iframe's size once the window has settled to force the
 * viewer to recompute its dimensions and repaint.
 * @param {HTMLElement} el
 */
function setupHistoLiteWindow(el) {
    const iframe = el.querySelector('.histolite-iframe');
    if (!iframe) return;
    const nudge = () => {
        iframe.style.width = '99.9%';
        requestAnimationFrame(() => { iframe.style.width = ''; });
    };
    setTimeout(nudge, 650);
    iframe.addEventListener('load', () => setTimeout(nudge, 150));
}

/** @type {import('../../assistant/registry/AssistantRegistry.js').AssistantProfile} */
export const profile = {
    appId: 'histolite',
    match: /histolite|pathology|histology/,
    voiceKeywords: ['histolite', 'open histolite', 'pathology', 'histology'],
};
