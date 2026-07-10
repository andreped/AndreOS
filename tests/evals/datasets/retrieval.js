/**
 * retrieval.js — golden set for BM25 paper retrieval.
 *
 * Each query lists the ids (from fixtureCorpus.js) that a good retriever should
 * surface. These are natural questions a visitor might ask "Ask André", where
 * the right publication(s) should be pulled into the RAG context.
 */

/** @type {{ query: string, relevant: string[], tags?: string[] }[]} */
export const RETRIEVAL_DATASET = [
    { query: 'software for deep learning on whole slide images', relevant: ['fastpathology'], tags: ['pathology'] },
    { query: 'breast cancer segmentation in histopathology', relevant: ['h2g-net'], tags: ['pathology', 'segmentation'] },
    { query: 'brain tumour segmentation from MRI', relevant: ['raidionics'], tags: ['segmentation', 'neuro'] },
    { query: 'gradient accumulation for large batch training tensorflow', relevant: ['gradient-accumulator'], tags: ['tooling'] },
    { query: 'stain normalization for histopathology images', relevant: ['torchstain'], tags: ['pathology', 'tooling'] },
    { query: 'automatic liver segmentation from CT', relevant: ['livermask'], tags: ['segmentation'] },
    { query: 'reduce annotation cost semi supervised tissue classification', relevant: ['semi-supervised-wsi'], tags: ['pathology'] },
    { query: 'generating clinical notes from patient conversations', relevant: ['clinical-nlp-summary'], tags: ['nlp'] },
    { query: 'gigapixel image segmentation neural network', relevant: ['h2g-net', 'fastpathology'], tags: ['pathology', 'segmentation'] },
    { query: 'norwegian speech to structured summary', relevant: ['clinical-nlp-summary'], tags: ['nlp'] },
];
