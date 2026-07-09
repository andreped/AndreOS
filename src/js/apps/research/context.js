/**
 * Research context provider — holds the paper the user is currently viewing so
 * the assistant can answer questions about it without being told which paper.
 *
 * The Research window sets the paper on selection (and its extracted full text
 * when available); the assistant reads getContextBlock(query) via the active
 * app's context provider. When full text is present it is chunked and indexed
 * with BM25 so only the relevant passages are fed to the model.
 */
import { chunkText } from '../../assistant/retrieval/retrieval.js';
import { BM25 } from '../../assistant/retrieval/BM25.js';

let _paper  = null; // { title, abstract, fullText, year, url }
let _bm25   = null;
let _chunks = [];

export const researchContext = {
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
     * LLM-ready block describing the paper on screen, or '' when none.
     * Always includes the title page, plus BM25-retrieved passages for the
     * query; falls back to the abstract when no full text is available.
     * @param {string} query
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
            add(0);
            if (_bm25 && query) {
                _bm25.search(query, 3).filter(h => h.score > 0).forEach(h => add(Number(h.id)));
            }
            body  = picked.sort((a, b) => a - b).map(i => _chunks[i]).join('\n…\n');
            label = 'excerpts from the full text (the first excerpt is the title page)';
        }
        if (!body) { body = (_paper.abstract || '').trim(); label = 'abstract'; }
        if (!body) return '';

        const yr = _paper.year ? ` (${_paper.year})` : '';
        return `## Paper the user is currently viewing\n` +
            `Title: "${_paper.title}"${yr}\n` +
            `${label}:\n${body}\n\n` +
            `When the user says "this paper", "the article", "it", etc., they mean the paper above. ` +
            `Answer strictly from the excerpts above. If a detail is not present in them, say you don't have it rather than guessing.`;
    },
};
