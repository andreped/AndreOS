/**
 * Context provider for static content apps (About, Resume, Projects, …).
 *
 * Produces an LLM-ready block describing what the user is viewing, with the
 * most query-relevant passages retrieved via BM25. The app's rendered HTML is
 * indexed lazily on first use and cached (the content is static).
 */
import { makeIndex } from './retrieval.js';

/** Strip HTML to plain text (decodes entities, drops tags). */
function htmlToText(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {{ name: string, render: () => string }} opts
 *   name   — the window title shown to the model (e.g. "About Me.txt")
 *   render — the app's content factory
 * @returns {{ getContextBlock: (query?: string) => string }}
 */
export function makeContentContext({ name, render }) {
    let index = null; // lazily built, then cached

    const ensure = () => {
        if (index) return index;
        const text = htmlToText(render());
        index = text ? makeIndex(text) : { text: '', chunks: [], bm25: null };
        return index;
    };

    return {
        getContextBlock(query = '') {
            const { text, chunks, bm25 } = ensure();
            if (!text) return '';

            let excerpt;
            if (bm25 && query) {
                const hits = bm25.search(query, 4).filter(h => h.score > 0);
                excerpt = hits.length
                    ? hits.map(h => chunks[parseInt(h.id)]).join('\n…\n')
                    : text.slice(0, 900);
            } else {
                excerpt = text.slice(0, 900);
            }

            return `## App currently open: ${name}\n` +
                `The user is viewing the following content:\n${excerpt}\n\n` +
                `"This page", "here", "this section", etc. refer to the ${name} content above.`;
        },
    };
}
