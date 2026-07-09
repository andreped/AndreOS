/**
 * Shared retrieval helpers for on-screen context.
 *
 * Splits text into overlapping chunks and builds a small BM25 index so the
 * assistant can be fed only the passages relevant to a question, keeping the
 * prompt small for the in-browser model. Used by every app context provider.
 */
import { BM25 } from './BM25.js';

/** Split text into overlapping ~140-word chunks for retrieval. */
export function chunkText(text, size = 140, overlap = 30) {
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

/**
 * Build a retrieval index over a block of text.
 * @param {string} text
 * @returns {{ text: string, chunks: string[], bm25: BM25|null }}
 */
export function makeIndex(text) {
    const chunks = chunkText(text);
    let bm25 = null;
    if (chunks.length > 1) {
        bm25 = new BM25();
        chunks.forEach((c, i) => bm25.addDocument(String(i), c));
        bm25.build();
    }
    return { text, chunks, bm25 };
}
