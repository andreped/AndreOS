/**
 * RAGEngine
 *
 * Builds a BM25 index over André's publications (titles + abstracts) fetched
 * from OpenAlex, then exposes a query() method that returns a formatted
 * context string ready to inject into the chat system prompt.
 *
 * - Reads the existing ResearchWindow cache (localStorage) when available.
 * - Falls back to a lightweight OpenAlex fetch when the cache is cold.
 * - Never overwrites the shared ResearchWindow cache.
 */

import { BM25 } from './BM25.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const SHARED_CACHE_KEY = 'andreOS_research_v2';    // written by ResearchWindow
const RAG_CACHE_KEY    = 'andreOS_rag_v1';         // own lightweight cache
const CACHE_TTL        = 24 * 60 * 60 * 1000;      // 24 h

const AUTHOR_ID = 'A5090654106';
const WORKS_URL =
    `https://api.openalex.org/works` +
    `?filter=author.id:${AUTHOR_ID}` +
    `&sort=publication_date:desc` +
    `&per_page=50` +
    `&select=id,title,publication_year,cited_by_count,doi,type,abstract_inverted_index`;

// Chars of abstract snippet included per paper in the LLM context block.
// Keep short — SmolLM2-135M has a limited context window.
const ABSTRACT_SNIPPET_LEN = 220;

// Minimum BM25 score to include a result (avoids injecting noise)
const MIN_SCORE = 0.3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function reconstructAbstract(invertedIndex) {
    if (!invertedIndex || typeof invertedIndex !== 'object') return null;
    const positions = [];
    for (const [word, idxList] of Object.entries(invertedIndex)) {
        for (const pos of idxList) positions[pos] = word;
    }
    const text = positions.filter(Boolean).join(' ').trim();
    return text.length > 0 ? text : null;
}

/** Try to get raw paper array from any available cache, null if nothing valid. */
function readCache() {
    // 1. Prefer the shared ResearchWindow cache (likely already warm)
    try {
        const raw = localStorage.getItem(SHARED_CACHE_KEY);
        if (raw) {
            const { ts, data } = JSON.parse(raw);
            if (Date.now() - ts < CACHE_TTL && Array.isArray(data?.papers)) {
                return data.papers;
            }
        }
    } catch {}

    // 2. Fall back to own RAG cache
    try {
        const raw = localStorage.getItem(RAG_CACHE_KEY);
        if (raw) {
            const { ts, papers } = JSON.parse(raw);
            if (Date.now() - ts < CACHE_TTL && Array.isArray(papers)) {
                return papers;
            }
        }
    } catch {}

    return null;
}

async function fetchPapers() {
    const cached = readCache();
    if (cached) return cached;

    const res = await fetch(WORKS_URL);
    if (!res.ok) throw new Error(`OpenAlex fetch failed (${res.status})`);
    const json = await res.json();
    const papers = json.results ?? [];

    // Persist to own cache so we don't fetch again within 24 h
    try {
        localStorage.setItem(RAG_CACHE_KEY, JSON.stringify({ ts: Date.now(), papers }));
    } catch {}

    return papers;
}

// ── RAGEngine class ───────────────────────────────────────────────────────────

export class RAGEngine {
    constructor() {
        this._bm25    = null;
        this._papers  = [];  // [{ id, title, abstract, year, doi }]
        this._ready   = false;
        this._loading = false;
    }

    /**
     * Fetch papers and build the BM25 index.
     * Safe to call multiple times — subsequent calls are no-ops.
     * @param {{ onReady?: (paperCount: number) => void }} opts
     */
    async init({ onReady } = {}) {
        if (this._ready || this._loading) return;
        this._loading = true;
        try {
            const rawPapers = await fetchPapers();
            const bm25      = new BM25();
            const enriched  = [];

            for (const p of rawPapers) {
                const title    = (p.title ?? '').replace(/\s+/g, ' ').trim();
                const abstract = reconstructAbstract(p.abstract_inverted_index) ?? '';
                bm25.addDocument(p.id, `${title}. ${abstract}`);
                enriched.push({ id: p.id, title, abstract, year: p.publication_year, doi: p.doi });
            }

            bm25.build();
            this._bm25   = bm25;
            this._papers = enriched;
            this._ready  = true;
            console.log(`[RAGEngine] Index built over ${enriched.length} papers ✓`);
            onReady?.(enriched.length);
        } catch (err) {
            console.warn('[RAGEngine] init failed:', err);
        } finally {
            this._loading = false;
        }
    }

    /**
     * Returns top-k matching papers as plain objects — for use by SearchOverlay.
     * Each result has the same shape as a SEARCH_INDEX entry so the overlay
     * can render it without special-casing.
     * @param {string} query
     * @param {number} k
     * @returns {{ type: string, fileType: string, icon: string, label: string, subtitle: string, doi: string|null }[]}
     */
    searchPapers(query, k = 5) {
        if (!this._ready || !query?.trim()) return [];
        const results = this._bm25.search(query, k).filter(r => r.score >= MIN_SCORE);
        return results.map(({ id }) => {
            const p = this._papers.find(x => x.id === id);
            if (!p) return null;
            const title   = p.title.length > 72 ? p.title.slice(0, 70) + '…' : p.title;
            const snippet = p.abstract ? p.abstract.slice(0, 90) + (p.abstract.length > 90 ? '…' : '') : '';
            const subtitle = snippet ? `${p.year ?? '?'} · ${snippet}` : String(p.year ?? '?');
            return { type: 'paper', fileType: 'research', icon: '📄', label: title, subtitle, doi: p.doi ?? null };
        }).filter(Boolean);
    }

    /**
     * Retrieve the top-k most relevant papers for a query and return a
     * formatted context string ready to append to the LLM system prompt.
     * Returns null when the engine is not ready or no relevant papers found.
     *
     * @param {string} query
     * @param {number} k
     * @returns {string|null}
     */
    query(query, k = 3) {
        if (!this._ready || !query?.trim()) return null;

        const results = this._bm25.search(query, k).filter(r => r.score >= MIN_SCORE);
        if (results.length === 0) return null;

        const lines = results.map(({ id }) => {
            const p = this._papers.find(x => x.id === id);
            if (!p) return null;
            const snippet = p.abstract
                ? p.abstract.slice(0, ABSTRACT_SNIPPET_LEN) +
                  (p.abstract.length > ABSTRACT_SNIPPET_LEN ? '…' : '')
                : '(abstract not available)';
            const doi = p.doi
                ? (p.doi.startsWith('http') ? p.doi : `https://doi.org/${p.doi}`)
                : null;
            const ref = doi ? ` [${doi}]` : '';
            return `• "${p.title}" (${p.year ?? '?'})${ref}\n  ${snippet}`;
        }).filter(Boolean);

        return lines.length ? lines.join('\n\n') : null;
    }
}
