/**
 * Cloudflare Pages Function — GET /api/scholar-pdf-manifest
 *
 * Serves the PDF manifest from Workers KV (key `pdf-manifest`, binding `SCHOLAR_KV`).
 * The weekly PDF job writes it after uploading PDFs to R2; the app reads it to know
 * which papers have a same-origin PDF at /scholar-pdf/<id>. Kept in KV (not the repo)
 * so CI never commits data back to the codebase.
 */
export async function onRequestGet({ env }) {
    if (!env.SCHOLAR_KV) {
        return json({ papers: {} }, 200, 30);
    }

    const stored = await env.SCHOLAR_KV.get('pdf-manifest');
    if (!stored) {
        return json({ papers: {} }, 200, 30);
    }

    return new Response(stored, {
        status: 200,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=300',
        },
    });
}

function json(body, status, maxAge) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': `public, max-age=${maxAge}`,
        },
    });
}
