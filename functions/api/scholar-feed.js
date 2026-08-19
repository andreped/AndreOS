/**
 * Cloudflare Pages Function — GET /api/scholar-feed
 *
 * Serves the Google Scholar publications feed from Workers KV. The weekly
 * GitHub Action writes the JSON to KV (key `publications`); this reads it back
 * for the Research app.
 *
 * Requires a KV binding named `SCHOLAR_KV` on the Pages project
 * (Settings → Functions → KV namespace bindings).
 */
export async function onRequestGet({ env }) {
    if (!env.SCHOLAR_KV) {
        return json({ ok: false, reason: 'unbound' }, 200, 30);
    }

    const stored = await env.SCHOLAR_KV.get('publications');
    if (!stored) {
        return json({ ok: false, reason: 'empty' }, 200, 30);
    }

    // Stored value is already the feed JSON — pass it through.
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
