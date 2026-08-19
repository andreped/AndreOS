/**
 * Scrapes a Google Scholar profile (list + per-paper detail pages) and writes
 * public/scholar/publications.json (consumed by the Research app).
 *
 * There is NO official free Scholar API, so this reads the public profile HTML
 * directly — the same pages a browser loads. It paginates the article list with
 * the `cstart`/`pagesize` params, then visits each paper's citation page to pull
 * the abstract ("Description") and a PDF/publisher link.
 *
 * Scholar aggressively rate-limits/CAPTCHAs scrapers. To stay under the radar
 * this runs weekly (not on every push), sends a real desktop UA, sleeps with
 * jitter between requests, and is incremental: papers already present (with an
 * abstract) in the previous feed are not re-fetched. On a 429/CAPTCHA it backs
 * off exponentially (~5s→120s) and retries; only after RETRIES does it fail loudly.
 * Progress is shown as a tqdm-style bar with ETA on stderr.
 *
 * Requires Node 18+ (global fetch). Run locally with:
 *   node scripts/fetch-scholar.mjs                 # user U20zUHQAAAAJ by default
 *   SCHOLAR_USER=XXXX node scripts/fetch-scholar.mjs
 *
 * tl;dr: HTML is parsed with targeted regex against Scholar's long-stable `gsc_`
 * class names rather than a DOM parser — no new dependency; upgrade to a parser
 * if Scholar changes its markup.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const USER      = process.env.SCHOLAR_USER || 'U20zUHQAAAAJ';
const PAGE_SIZE = Number(process.env.SCHOLAR_PAGE_SIZE || 100); // Scholar caps at 100
const MAX_PAGES = Number(process.env.SCHOLAR_MAX_PAGES || 20);  // safety cap (≤2000 papers)
const DELAY_MS  = Number(process.env.SCHOLAR_DELAY_MS || 2500); // base politeness between requests
const RETRIES   = Number(process.env.SCHOLAR_RETRIES || 6);     // 429 backoff attempts per request
const DETAILS   = process.env.SCHOLAR_DETAILS !== '0';          // fetch per-paper abstract/PDF
const OUT       = path.resolve('public/scholar/publications.json');
const BASE      = 'https://scholar.google.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const listUrl   = (cstart) => `${BASE}/citations?hl=en&user=${USER}&cstart=${cstart}&pagesize=${PAGE_SIZE}`;
const detailUrl = (citeId) => `${BASE}/citations?view_op=view_citation&hl=en&user=${USER}&citation_for_view=${citeId}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sleep DELAY_MS plus 0–DELAY_MS random jitter, so requests look less robotic. */
const politeSleep = () => sleep(DELAY_MS + Math.floor(Math.random() * DELAY_MS));

/** Truncate a string for single-line progress output. */
const truncate = (s = '', n = 48) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Format seconds as M:SS (tqdm-style). */
function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/**
 * Minimal tqdm-style progress bar. On a TTY it redraws one line in place with a
 * bar, count, elapsed<ETA and rate; in CI (no TTY) it prints a line every few
 * items so logs stay readable. `note` is shown as a postfix (e.g. the paper title).
 */
function makeProgress(total, label) {
    const start = Date.now();
    const isTTY = process.stderr.isTTY;
    const width = 22;
    return {
        update(done, note = '') {
            const frac = total ? done / total : 1;
            const elapsed = (Date.now() - start) / 1000;
            const rate = done > 0 ? elapsed / done : 0; // s/it
            const eta = rate * (total - done);
            const filled = Math.round(frac * width);
            const bar = '█'.repeat(filled) + ' '.repeat(width - filled);
            const pct = String(Math.round(frac * 100)).padStart(3);
            const line = `${label}: ${pct}%|${bar}| ${done}/${total} [${mmss(elapsed)}<${mmss(eta)}, ${rate.toFixed(1)}s/it] ${note}`;
            if (isTTY) {
                process.stderr.write('\r\x1b[K' + truncate(line, (process.stderr.columns || 120) - 1));
            } else if (done === total || done % 5 === 0) {
                process.stderr.write(line + '\n');
            }
        },
        done() { if (isTTY) process.stderr.write('\n'); },
    };
}

/** Decode the handful of HTML entities Scholar emits. */
function decode(s = '') {
    return s
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Strip tags + collapse whitespace + decode entities. */
const clean = (html = '') => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** GET a Scholar page as text, retrying 429/CAPTCHA with exponential backoff. */
async function getHtml(url) {
    for (let attempt = 0; ; attempt++) {
        const res = await fetch(url, {
            headers: {
                'user-agent': UA,
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'accept-language': 'en-US,en;q=0.9',
            },
        });
        const html = await res.text();
        const blocked = res.status === 429 || /unusual traffic|not a robot|\/sorry\/index/i.test(html);
        if (blocked) {
            if (attempt >= RETRIES) {
                throw new Error(`Scholar CAPTCHA / rate-limit after ${RETRIES} retries. Try again later or from a different IP.`);
            }
            // Exponential backoff with jitter: ~5s, 10s, 20s, 40s, 80s, capped at 120s.
            const wait = Math.min(120_000, 5_000 * 2 ** attempt) + Math.floor(Math.random() * 2_000);
            process.stderr.write(`\n  ⚠ rate-limited, backing off ${mmss(wait / 1000)} (retry ${attempt + 1}/${RETRIES})…\n`);
            await sleep(wait);
            continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return html;
    }
}

/** Parse the profile header + citation stats from a list page's HTML. */
function parseProfile(html) {
    const name = clean((html.match(/id="gsc_prf_in">(.*?)<\/div>/s) || [])[1] || '');
    const affiliation = clean((html.match(/class="gsc_prf_il"[^>]*>(.*?)<\/div>/s) || [])[1] || '');
    // Stats cells appear in order: citations(all,since), h(all,since), i10(all,since).
    const std = [...html.matchAll(/class="gsc_rsb_std">(\d+)</g)].map((m) => Number(m[1]));
    return {
        name,
        affiliation,
        citations: std[0] ?? 0,
        hIndex:    std[2] ?? 0,
        i10Index:  std[4] ?? 0,
    };
}

/** Parse one page of article rows. Returns an array (empty when no more rows). */
function parseRows(html) {
    const rows = [];
    // Each article is a <tr class="gsc_a_tr"> … </tr>. Split on the marker.
    const chunks = html.split('class="gsc_a_tr"').slice(1);
    for (const chunk of chunks) {
        const idm = chunk.match(/citation_for_view=([\w-]+:[\w-]+)/);
        if (!idm) continue;
        const id = idm[1];
        const title = clean((chunk.match(/class="gsc_a_at"[^>]*>(.*?)<\/a>/s) || [])[1] || 'Untitled');
        const grays = [...chunk.matchAll(/class="gs_gray">(.*?)<\/div>/gs)].map((m) => m[1]);
        const authors = clean(grays[0] || '');
        let venue = clean((grays[1] || '').replace(/<span class="gs_oph">.*?<\/span>/g, ''));
        venue = venue.replace(/,?\s*\d{4}\s*$/, '').trim(); // drop trailing ", 2022"
        const citations = Number((chunk.match(/class="gsc_a_ac[^"]*"[^>]*>(\d+)</) || [])[1] || 0);
        const year = Number((chunk.match(/class="gsc_a_h[^"]*"[^>]*>(\d{4})</) || [])[1] || 0) || null;
        rows.push({ id, title, authors, venue, citations, year });
    }
    return rows;
}

/** Fetch a paper's detail page and extract abstract + PDF/publisher links. */
async function fetchDetail(citeId) {
    const html = await getHtml(detailUrl(citeId));
    // The "[PDF] host" chip at the top links to the free full text when present.
    const pdfUrl = decode((html.match(/id="gsc_oci_title_gg"[\s\S]*?href="([^"]+)"/) || [])[1] || '') || null;
    const publisherUrl = decode((html.match(/class="gsc_oci_title_link"[^>]*href="([^"]+)"/) || [])[1] || '') || null;

    // The abstract sits in <div class="gsc_oci_value"><div class="gsh_csp">…</div></div>.
    // Match by that structural class, not the "Description" label — Scholar localizes
    // labels (e.g. "Beskrivelse" in Norwegian) based on account/IP, so label text is unreliable.
    let abstract = clean((html.match(/class="gsh_csp"[^>]*>(.*?)<\/div>/s) || [])[1] || '') || null;
    if (!abstract) {
        // Fallback: the description is the longest value cell on the page.
        const values = [...html.matchAll(/class="gsc_oci_value">(.*?)<\/div>/gs)].map((m) => clean(m[1]));
        abstract = values.sort((a, b) => b.length - a.length)[0] || null;
        if (abstract && abstract.length < 80) abstract = null; // guard: not a real abstract
    }
    return { pdfUrl, publisherUrl, abstract };
}

/** Load the previous feed for incremental detail fetching. Empty on miss. */
async function loadExisting() {
    const p = process.env.EXISTING_PATH;
    if (!p || process.env.SCHOLAR_FULL === '1') return { papers: [] };
    try {
        const data = JSON.parse(await readFile(p, 'utf8'));
        return data && Array.isArray(data.papers) ? data : { papers: [] };
    } catch {
        return { papers: [] };
    }
}

async function main() {
    const existing = await loadExisting();
    const prevById = new Map(existing.papers.map((p) => [p.id, p]));

    // 1) Paginate the article list.
    const rows = [];
    let profile = null;
    for (let page = 0; page < MAX_PAGES; page++) {
        process.stderr.write(`Listing papers… page ${page + 1} (${rows.length} so far)\r`);
        const html = await getHtml(listUrl(page * PAGE_SIZE));
        if (page === 0) profile = parseProfile(html);
        const pageRows = parseRows(html);
        if (!pageRows.length) break;
        rows.push(...pageRows);
        if (pageRows.length < PAGE_SIZE) break; // last page
        await politeSleep();
    }
    if (!rows.length) throw new Error('No papers parsed — Scholar markup may have changed or the profile is empty.');
    console.log(`✓ ${rows.length} papers listed (${profile?.name || '?'})`);

    // 2) Enrich with abstract + PDF from each detail page (incremental).
    const toFetch = rows.filter((r) => DETAILS && !prevById.get(r.id)?.abstract).length;
    console.log(`  ${toFetch} need fetching, ${rows.length - toFetch} reused from previous feed`);
    const prog = makeProgress(rows.length, 'Abstracts');
    const papers = [];
    let i = 0;
    for (const row of rows) {
        prog.update(i, truncate(row.title, 44));
        const prev = prevById.get(row.id);
        let detail = { pdfUrl: prev?.pdfUrl ?? null, publisherUrl: prev?.publisherUrl ?? null, abstract: prev?.abstract ?? null };
        // Only hit the network when we don't already have an abstract for this paper.
        if (DETAILS && !detail.abstract) {
            try {
                detail = await fetchDetail(row.id);
                await politeSleep();
            } catch (err) {
                process.stderr.write(`\n  ⚠ detail failed for ${row.id}: ${err.message}\n`);
            }
        }
        papers.push({
            id: row.id,
            title: row.title,
            authors: row.authors,
            venue: row.venue,
            year: row.year,
            citations: row.citations,
            scholarUrl: detailUrl(row.id),
            pdfUrl: detail.pdfUrl,
            publisherUrl: detail.publisherUrl,
            abstract: detail.abstract,
        });
        prog.update(++i, truncate(row.title, 44));
    }
    prog.done();

    const feed = { profile, updatedAt: new Date().toISOString(), papers };
    await mkdir(path.dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify(feed, null, 2) + '\n');
    const withAbs = papers.filter((p) => p.abstract).length;
    console.log(`✓ ${papers.length} papers (${withAbs} with abstracts) → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
    console.error(`✖ ${err.message}`);
    process.exit(1);
});
