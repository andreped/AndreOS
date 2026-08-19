/**
 * Cloudflare Pages Function — GET /scholar-pdf/:id
 *
 * Streams an open-access PDF from R2 (bucket binding `SCHOLAR_PDFS`, key `<id>.pdf`)
 * on the same origin as the app, so pdf.js can render it and extract text without the
 * cross-origin CORS wall that blocks publisher-hosted PDFs.
 *
 * Class B (read) budget guard: responses are cached at Cloudflare's edge with an
 * immutable, 1-year Cache-Control and re-served from the Cache API, so repeat views
 * hit the cache and never touch R2. PDFs are content-addressed by citation id, so
 * `immutable` is safe.
 */
export async function onRequestGet(context) {
    const { request, params, env, waitUntil } = context;
    if (!env.SCHOLAR_PDFS) return new Response('R2 not bound', { status: 503 });

    const cache = caches.default;
    const cacheKey = new Request(request.url, request);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const key = `${params.id}.pdf`;
    const obj = await env.SCHOLAR_PDFS.get(key);
    if (!obj) {
        return new Response('Not found', { status: 404, headers: { 'cache-control': 'public, max-age=300' } });
    }

    const res = new Response(obj.body, {
        headers: {
            'content-type': 'application/pdf',
            'cache-control': 'public, max-age=31536000, immutable',
            etag: obj.httpEtag,
        },
    });
    // Populate the edge cache so subsequent reads skip R2 entirely.
    waitUntil(cache.put(cacheKey, res.clone()));
    return res;
}
