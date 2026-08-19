/**
 * Cloudflare Pages Function — GET /api/pdf?u=<publisher PDF url>
 *
 * Same-origin PDF proxy: fetches a publication's PDF server-side (no browser CORS
 * wall) and streams it back, so pdf.js can render + extract text from any publisher.
 *
 * SSRF guard: we only proxy https URLs that actually appear in our own Scholar feed
 * (KV `publications`) — so this can't be turned into an open proxy. Responses are
 * edge-cached (Cache API) so repeat views don't re-hit the publisher.
 */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * Rewrite a known OA landing-page URL to its direct-PDF endpoint (mirrors
 * scripts/fetch-scholar-pdfs.mjs). Scholar's pdfUrl is often the HTML article page.
 */
function directPdfUrl(url) {
    try {
        const u = new URL(url);
        const h = u.hostname;
        if (h.endsWith('frontiersin.org')) return url.replace(/\/full\/?$/, '/pdf');
        if (h.endsWith('journals.plos.org') && /\/article$/.test(u.pathname)) {
            const id = u.searchParams.get('id');
            if (id) return `${u.origin}${u.pathname}/file?id=${id}&type=printable`;
        }
        if (h.endsWith('mdpi.com') && !/\/pdf$/.test(u.pathname)) return url.replace(/\/?$/, '/pdf');
    } catch { /* fall through */ }
    return url;
}

export async function onRequestGet(context) {
    const { request, env, waitUntil } = context;
    const u = new URL(request.url).searchParams.get('u');
    if (!u) return new Response('missing ?u', { status: 400 });

    const cache = caches.default;
    const cacheKey = new Request(request.url, request);
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    let target;
    try { target = new URL(u); } catch { return new Response('bad url', { status: 400 }); }
    if (target.protocol !== 'https:') return new Response('https only', { status: 400 });
    if (!(await inFeed(env, u))) return new Response('not in feed', { status: 403 });

    let upstream;
    try {
        upstream = await fetch(directPdfUrl(target.href), {
            headers: { 'user-agent': UA, accept: 'application/pdf,*/*' },
            redirect: 'follow',
            signal: AbortSignal.timeout(30_000),
        });
    } catch {
        return new Response('upstream fetch failed', { status: 502 });
    }
    if (!upstream.ok) return new Response(`upstream ${upstream.status}`, { status: 502 });

    const buf = await upstream.arrayBuffer();
    // Reject HTML landing pages — only stream real PDFs.
    if (new TextDecoder().decode(buf.slice(0, 5)) !== '%PDF-') {
        return new Response('not a pdf', { status: 415 });
    }

    const res = new Response(buf, {
        headers: {
            'content-type': 'application/pdf',
            'cache-control': 'public, max-age=86400',
        },
    });
    waitUntil(cache.put(cacheKey, res.clone()));
    return res;
}

/** True when `url` is a pdfUrl/publisherUrl of some paper in the KV feed. */
async function inFeed(env, url) {
    if (!env.SCHOLAR_KV) return false;
    const raw = await env.SCHOLAR_KV.get('publications');
    if (!raw) return false;
    try {
        const feed = JSON.parse(raw);
        return (feed.papers || []).some((p) => p.pdfUrl === url || p.publisherUrl === url);
    } catch {
        return false;
    }
}
