/**
 * ActiveContext
 *
 * Holds the research paper the user is currently viewing in the Research app,
 * so the assistant (Ask André / OS Assistant) can answer questions about it
 * without being explicitly told which paper is meant.
 *
 * When full text is available it is chunked and indexed with BM25, so the
 * assistant is fed only the passages relevant to each question rather than the
 * whole paper — keeping the prompt small for the in-browser model.
 *
 * The Research window sets the active paper on selection and clears it when
 * closed; chat.js reads getContextBlock(query) when building the system prompt.
 */

import { BM25 } from './BM25.js';

let _paper  = null; // { title, abstract, fullText, year, url }
let _bm25   = null;
let _chunks = [];

/** Split text into overlapping ~140-word chunks for retrieval. */
function chunkText(text, size = 140, overlap = 30) {
    const words  = text.split(/\s+/).filter(Boolean);
    const chunks = [];
    const step   = Math.max(1, size - overlap);
    for (let i = 0; i < words.length; i += step) {
        const chunk = words.slice(i, i + size).join(' ').trim();
        if (chunk) chunks.push(chunk);
        if (i + size >= words.length) break;
    }
    return chunks;
}

export const ActiveContext = {
    /**
     * @param {{ title: string, abstract?: string, fullText?: string, year?: number, url?: string }} paper
     */
    setPaper(paper) {
        _paper  = paper ?? null;
        _bm25   = null;
        _chunks = [];
    },

    /** Attach extracted full text (async result) and build a BM25 chunk index. */
    setFullText(url, fullText) {
        if (!_paper || _paper.url !== url || !fullText) return;
        _paper.fullText = fullText;
        _chunks = chunkText(fullText);
        if (_chunks.length) {
            _bm25 = new BM25();
            _chunks.forEach((c, i) => _bm25.addDocument(String(i), c));
            _bm25.build();
        }
    },

    clear() { _paper = null; _bm25 = null; _chunks = []; },

    get() { return _paper; },

    /**
     * LLM-ready context block describing the paper on screen, or '' when none.
     * Always includes the paper head (title / authors / abstract intro) so
     * metadata questions work, plus the BM25-retrieved passages for the query.
     * Falls back to the abstract when no full text is available.
     * @param {string} query — the user's message, used for passage retrieval
     * @returns {string}
     */
    getContextBlock(query = '') {
        if (!_paper) return '';

        let body  = '';
        let label = '';

        if (_chunks.length) {
            const picked = [];
            const seen   = new Set();
            const add = (i) => {
                if (i >= 0 && i < _chunks.length && !seen.has(i)) { seen.add(i); picked.push(i); }
            };

            // Always include the first chunk — the title page holds the title,
            // author list and abstract intro, which no keyword query would match.
            add(0);

            // Then the passages most relevant to the question.
            if (_bm25 && query) {
                _bm25.search(query, 3).filter(h => h.score > 0).forEach(h => add(Number(h.id)));
            }

            body  = picked.sort((a, b) => a - b).map(i => _chunks[i]).join('\n…\n');
            label = 'excerpts from the full text (the first excerpt is the title page)';
        }

        if (!body) {
            body  = (_paper.abstract || '').trim();
            label = 'abstract';
        }
        if (!body) return '';

        const yr = _paper.year ? ` (${_paper.year})` : '';
        return `## Paper the user is currently viewing\n` +
            `Title: "${_paper.title}"${yr}\n` +
            `${label}:\n${body}\n\n` +
            `When the user says "this paper", "the article", "it", etc., they mean the paper above. ` +
            `Answer strictly from the excerpts above. If a detail (e.g. an author name or number) ` +
            `is not present in them, say you don't have that detail rather than guessing.`;
    },
};

