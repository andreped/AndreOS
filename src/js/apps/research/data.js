/**
 * Shared Google Scholar publications store.
 *
 * Both the Research window and the assistant's RAG index read from here, so the
 * feed is fetched once and cached for the session. Source order: the live
 * KV-backed Pages Function, then the static dev fallback.
 */
const SOURCES = ['/api/scholar-feed', '/scholar/publications.json'];
const PDF_MANIFEST_SOURCES = ['/api/scholar-pdf-manifest', '/scholar/pdf-manifest.json'];

let _profile = null;
let _papers = [];
let _loading = null;

export function getProfile() { return _profile; }
export function getPapers() { return _papers; }

/** Upgrade http→https (mixed-content) and prefer the canonical arxiv host. */
function normalizePdf(url) {
    if (!url) return null;
    return url.replace(/^http:\/\//i, 'https://').replace('://export.arxiv.org/', '://arxiv.org/');
}

/** R2/URL-safe key for a citation id — matches the download script + Function. */
const pdfKey = (id) => id.replace(/[^\w.-]/g, '_');

/** Mark papers whose PDF we rehost in R2 with a same-origin `localPdf` url. */
async function applyLocalPdfs() {
    for (const url of PDF_MANIFEST_SOURCES) {
        try {
            const res = await fetch(url, { headers: { accept: 'application/json' } });
            if (!res.ok) continue;
            const stored = new Set(Object.keys((await res.json())?.papers || {}));
            if (!stored.size) continue;
            _papers = _papers.map((p) => (stored.has(p.id) ? { ...p, localPdf: `/scholar-pdf/${pdfKey(p.id)}` } : p));
            return;
        } catch { /* try next source */ }
    }
    // manifest optional — external links still work
}

/** Fetch + cache the feed once. Safe to call repeatedly (dedupes in-flight). */
export function ensureLoaded() {
    if (_papers.length) return Promise.resolve({ profile: _profile, papers: _papers });
    if (_loading) return _loading;
    _loading = (async () => {
        for (const url of SOURCES) {
            try {
                const res = await fetch(url, { headers: { accept: 'application/json' } });
                if (!res.ok) continue;
                const data = await res.json();
                const papers = Array.isArray(data?.papers) ? data.papers : [];
                if (papers.length) {
                    _profile = data.profile ?? null;
                    _papers = papers.map((p) => ({ ...p, pdfUrl: normalizePdf(p.pdfUrl) }));
                    await applyLocalPdfs();
                    break;
                }
            } catch { /* try next source */ }
        }
        _loading = null;
        return { profile: _profile, papers: _papers };
    })();
    return _loading;
}
