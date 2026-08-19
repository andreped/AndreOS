/**
 * Downloads open-access PDFs for the Scholar feed and stages them for upload to
 * Cloudflare R2. Companion to fetch-scholar.mjs — runs as its own (heavier,
 * flakier) weekly job so a bad publisher download never fails the metadata feed.
 *
 * Guardrails so we NEVER exceed R2's free tier:
 *  - OA allowlist: only genuinely open-access hosts are rehosted (copyright + trust).
 *  - Per-file cap (MAX_PDF_MB): skip anything larger, so one huge scan can't blow storage.
 *  - Total budget (MAX_TOTAL_MB): hard stop well under R2's 10 GB free storage.
 *  - Incremental via a committed manifest (public/scholar/pdf-manifest.json): we never
 *    list the bucket (a Class A op) and never re-download — only new PDFs are fetched.
 *  - Content is validated as a real PDF (%PDF magic) before staging, so we don't store HTML.
 *
 * The workflow uploads OUT_DIR/*.pdf to R2 and commits the updated manifest; the app
 * reads the manifest to know which papers have a same-origin PDF.
 *
 * Run locally (writes to OUT_DIR, no upload):
 *   node --env-file=.env scripts/fetch-scholar-pdfs.mjs
 *
 * tl;dr: best-effort — many publisher "pdf" links are actually HTML landing pages or
 * bot-walled, so coverage is partial; those stay external "Open ↗" links in the app.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const FEED_PATH     = process.env.FEED_PATH || 'public/scholar/publications.json';
const MANIFEST_PATH = process.env.MANIFEST_PATH || 'public/scholar/pdf-manifest.json';
const OUT_DIR       = process.env.PDF_OUT_DIR || 'pdfs_out';
const MAX_PDF_MB    = Number(process.env.MAX_PDF_MB || 25);    // per-file cap
const MAX_TOTAL_MB  = Number(process.env.MAX_TOTAL_MB || 8000); // hard budget < 10 GB free
const DELAY_MS      = Number(process.env.PDF_DELAY_MS || 1000);
const PROXY_KEY     = process.env.SCRAPERAPI_KEY || '';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Hosts we consider safe to rehost: fully open-access publishers/repositories.
// Conservative on purpose — mixed-OA hosts (nature.com, ieee, sciencedirect) are excluded
// because we can't tell OA from paywalled by URL alone.
const OA_HOSTS = [
    'arxiv.org',
    'journals.plos.org',
    'frontiersin.org',
    'mdpi.com',
    'pmc.ncbi.nlm.nih.gov',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proxied = (url) => (PROXY_KEY ? `https://api.scraperapi.com/?api_key=${PROXY_KEY}&url=${encodeURIComponent(url)}` : url);

/** R2 object key base for a citation id — filesystem/URL-safe, matches the app + Function. */
const keyFor = (id) => id.replace(/[^\w.-]/g, '_');

const isOaHost = (url) => {
    try {
        const h = new URL(url).hostname;
        return OA_HOSTS.some((oa) => h === oa || h.endsWith('.' + oa));
    } catch {
        return false;
    }
};

const mmss = (sec) => {
    sec = Math.max(0, Math.round(sec));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

/** Fetch a URL as bytes; returns a Buffer or null. Tries direct, then proxy. */
async function download(url) {
    for (const target of PROXY_KEY ? [url, proxied(url)] : [url]) {
        try {
            const res = await fetch(target, {
                headers: { 'user-agent': UA, accept: 'application/pdf,*/*' },
                signal: AbortSignal.timeout(PROXY_KEY ? 90_000 : 30_000),
            });
            if (!res.ok) continue;
            const buf = Buffer.from(await res.arrayBuffer());
            // Validate it's actually a PDF, not an HTML landing page.
            if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') continue;
            return buf;
        } catch { /* try next */ }
    }
    return null;
}

async function loadJson(p, fallback) {
    try {
        return JSON.parse(await readFile(p, 'utf8'));
    } catch {
        return fallback;
    }
}

async function main() {
    const feed = await loadJson(FEED_PATH, null);
    const papers = feed && Array.isArray(feed.papers) ? feed.papers : [];
    if (!papers.length) throw new Error(`No papers in ${FEED_PATH}`);

    const manifest = await loadJson(MANIFEST_PATH, { updatedAt: null, totalBytes: 0, papers: {} });
    manifest.papers ??= {};
    manifest.totalBytes ??= 0;

    // Candidates: OA host, has a pdf url, not already stored.
    const candidates = papers.filter(
        (p) => p.pdfUrl && isOaHost(p.pdfUrl) && !manifest.papers[p.id],
    );
    console.log(`${papers.length} papers, ${candidates.length} OA PDFs to try (${Object.keys(manifest.papers).length} already stored)`);

    await mkdir(OUT_DIR, { recursive: true });

    const start = Date.now();
    let stored = 0, skipped = 0;
    for (let i = 0; i < candidates.length; i++) {
        const p = candidates[i];
        const eta = i > 0 ? mmss(((Date.now() - start) / 1000 / i) * (candidates.length - i)) : '?';
        process.stderr.write(`[${i + 1}/${candidates.length}] ETA ${eta}  ${p.title.slice(0, 50)}\n`);

        const buf = await download(p.pdfUrl);
        await sleep(DELAY_MS);
        if (!buf) { skipped++; continue; }

        const sizeMb = buf.length / 1e6;
        if (sizeMb > MAX_PDF_MB) {
            console.warn(`  ⚠ ${sizeMb.toFixed(1)} MB > ${MAX_PDF_MB} MB cap — skipped`);
            skipped++;
            continue;
        }
        if ((manifest.totalBytes + buf.length) / 1e6 > MAX_TOTAL_MB) {
            console.warn(`  ⚠ budget ${MAX_TOTAL_MB} MB reached — stopping (storage guard)`);
            break;
        }

        const key = keyFor(p.id);
        await writeFile(path.join(OUT_DIR, `${key}.pdf`), buf);
        manifest.papers[p.id] = buf.length;
        manifest.totalBytes += buf.length;
        stored++;
    }

    manifest.updatedAt = new Date().toISOString();
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`✓ staged ${stored} new PDFs (${skipped} skipped) → ${OUT_DIR}/`);
    console.log(`  manifest: ${Object.keys(manifest.papers).length} PDFs, ${(manifest.totalBytes / 1e6).toFixed(1)} MB total`);
}

main().catch((err) => {
    console.error(`✖ ${err.message}`);
    process.exit(1);
});
