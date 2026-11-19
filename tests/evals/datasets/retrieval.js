/**
 * retrieval.js — golden set for BM25 paper retrieval.
 *
 * Each query lists the ids (from fixtureCorpus.js) that a good retriever should
 * surface. These are natural questions a visitor might ask "Ask André", where
 * the right publication(s) should be pulled into the RAG context. `no` is the
 * Norwegian (Bokmål) query against the same English corpus; see localize.js.
 */

/** @type {{ query: string, no: string, relevant: string[], tags?: string[] }[]} */
export const RETRIEVAL_DATASET = [
    { query: 'software for deep learning on whole slide images', no: 'programvare for dyp læring på helsnittbilder', relevant: ['fastpathology'], tags: ['pathology'] },
    { query: 'breast cancer segmentation in histopathology', no: 'segmentering av brystkreft i histopatologi', relevant: ['h2g-net'], tags: ['pathology', 'segmentation'] },
    { query: 'brain tumour segmentation from MRI', no: 'segmentering av hjernesvulst fra MR', relevant: ['raidionics'], tags: ['segmentation', 'neuro'] },
    { query: 'gradient accumulation for large batch training tensorflow', no: 'gradientakkumulering for trening med store batcher i tensorflow', relevant: ['gradient-accumulator'], tags: ['tooling'] },
    { query: 'stain normalization for histopathology images', no: 'fargenormalisering av histopatologiske bilder', relevant: ['torchstain'], tags: ['pathology', 'tooling'] },
    { query: 'automatic liver segmentation from CT', no: 'automatisk segmentering av lever fra CT', relevant: ['livermask'], tags: ['segmentation'] },
    { query: 'reduce annotation cost semi supervised tissue classification', no: 'redusere annoteringskostnad med semi-veiledet vevsklassifisering', relevant: ['semi-supervised-wsi'], tags: ['pathology'] },
    { query: 'generating clinical notes from patient conversations', no: 'generere kliniske notater fra pasientsamtaler', relevant: ['clinical-nlp-summary'], tags: ['nlp'] },
    { query: 'gigapixel image segmentation neural network', no: 'segmentering av gigapikselbilder med nevrale nettverk', relevant: ['h2g-net', 'fastpathology'], tags: ['pathology', 'segmentation'] },
    { query: 'norwegian speech to structured summary', no: 'norsk tale til strukturert sammendrag', relevant: ['clinical-nlp-summary'], tags: ['nlp'] },
];
