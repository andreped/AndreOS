/**
 * Fetches your own recent Strava activities using a stored session cookie and
 * writes them to public/strava/activities.json (consumed by the Strava app).
 *
 * This performs NO login automation: you log in once in a real browser and
 * provide the resulting cookies via the STRAVA_COOKIE env var (a GitHub Actions
 * secret in CI). Include the long-lived `strava_remember_token` (+
 * `strava_remember_id`) so this survives week-to-week.
 *
 * Why two steps: the internal `training_activities` XHR endpoint returns 401
 * when the short-lived `_strava4_session` is stale — it does NOT honour the
 * remember cookie. A normal page load to /dashboard DOES honour it and mints a
 * fresh session cookie, which we then reuse for the activities request.
 *
 * Requires Node 18.14+ (global fetch + Headers.getSetCookie). Run locally with:
 *   STRAVA_COOKIE='strava_remember_id=…; strava_remember_token=…' node scripts/fetch-strava.mjs
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const COOKIE = process.env.STRAVA_COOKIE;
const PER_PAGE = Number(process.env.STRAVA_PER_PAGE || 50);
const MAX_PAGES = Number(process.env.STRAVA_MAX_PAGES || 500); // safety cap
const OUT = path.resolve('public/strava/activities.json');
const pageUrl = (page) => `https://www.strava.com/athlete/training_activities?per_page=${PER_PAGE}&page=${page}`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

if (!COOKIE) {
    console.error('✖ STRAVA_COOKIE is not set.');
    process.exit(1);
}

/** Parse a "a=1; b=2" cookie string into a Map. */
function parseCookies(str) {
    const map = new Map();
    for (const part of str.split(';')) {
        const i = part.indexOf('=');
        if (i === -1) continue;
        const name = part.slice(0, i).trim();
        if (name) map.set(name, part.slice(i + 1).trim());
    }
    return map;
}

/** Fold an array of Set-Cookie header values into a cookie Map. */
function applySetCookies(map, setCookies) {
    for (const sc of setCookies) {
        const first = sc.split(';', 1)[0];
        const i = first.indexOf('=');
        if (i === -1) continue;
        map.set(first.slice(0, i).trim(), first.slice(i + 1).trim());
    }
    return map;
}

const serialise = (map) => [...map].map(([k, v]) => `${k}=${v}`).join('; ');

/**
 * Follow /dashboard redirects with the remember cookie so Strava re-authenticates
 * and sets a fresh `_strava4_session`. Returns the accumulated cookie Map.
 */
async function warmSession(cookies) {
    let url = 'https://www.strava.com/dashboard';
    for (let hop = 0; hop < 5; hop++) {
        const res = await fetch(url, {
            redirect: 'manual',
            headers: {
                cookie: serialise(cookies),
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'user-agent': UA,
            },
        });
        applySetCookies(cookies, res.headers.getSetCookie?.() ?? []);

        const location = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && location) {
            const next = new URL(location, url).href;
            if (/\/login|\/onboarding/.test(next)) {
                throw new Error('Redirected to login — the remember cookie is invalid/expired. Refresh STRAVA_COOKIE.');
            }
            url = next;
            continue;
        }
        break;
    }
    return cookies;
}

/**
 * Map one raw dashboard model to the tidy, public-safe shape the app expects.
 * The training_activities endpoint returns human-formatted strings (e.g. moving
 * time "52m 56s", distance "4.28 km") plus numeric `*_raw` fields — always use
 * the raw ones. Sport lives in `sport_type` (there is no plain `type`).
 */
function normalise(m) {
    return {
        id: m.id,
        name: m.name,
        type: m.sport_type ?? m.type,
        distance: m.distance_raw,              // metres
        movingTime: m.moving_time_raw,         // seconds
        elapsedTime: m.elapsed_time_raw,       // seconds
        elevationGain: m.elevation_gain_raw,   // metres
        sufferScore: m.suffer_score ?? undefined,
        private: m.private || undefined,
        startDate: m.start_date
            ?? (m.start_date_local_raw ? new Date(m.start_date_local_raw * 1000).toISOString() : undefined),
    };
}

/** Fetch one page of activities. Returns the raw models array (may be empty). */
async function fetchPage(cookies, page) {
    const res = await fetch(pageUrl(page), {
        headers: {
            cookie: serialise(cookies),
            accept: 'text/javascript, application/json, */*',
            'x-requested-with': 'XMLHttpRequest',
            'user-agent': UA,
            referer: 'https://www.strava.com/athlete/training',
        },
    });

    if (res.status === 401 || res.status === 302) {
        throw new Error('Session rejected after warm-up — the remember cookie is likely expired. Refresh STRAVA_COOKIE.');
    }
    if (!res.ok) throw new Error(`Unexpected status ${res.status} on page ${page}`);

    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('Response was not JSON (probably a login page). Refresh STRAVA_COOKIE.');
    }
    return Array.isArray(data) ? data : (data.models || []);
}

/** Load the previously-stored feed (for incremental fetches). Empty on miss. */
async function loadExisting() {
    const p = process.env.EXISTING_PATH;
    if (!p || process.env.STRAVA_FULL === '1') return [];
    try {
        const data = JSON.parse(await readFile(p, 'utf8'));
        return Array.isArray(data) ? data : (data.models || data.activities || []);
    } catch {
        return [];
    }
}

async function main() {
    const existing = await loadExisting();
    const existingIds = new Set(existing.map((a) => a.id));
    const cookies = await warmSession(parseCookies(COOKIE));

    const collected = [];
    const seen = new Set();
    for (let page = 1; page <= MAX_PAGES; page++) {
        const models = await fetchPage(cookies, page);
        if (page === 1) {
            if (!models.length) throw new Error('No activities returned (cookie may be invalid).');
            console.log('First activity keys:', Object.keys(models[0]).join(', '));
        }
        // Page size may be capped below PER_PAGE, so page count isn't a reliable
        // "done" signal. Stop when a page brings nothing new (empty, or the page
        // param being ignored → repeats).
        const fresh = models.filter((m) => !seen.has(m.id));
        if (!fresh.length) break;
        for (const m of fresh) seen.add(m.id);
        collected.push(...fresh);
        // Incremental: the feed is newest-first, so once a page reaches an
        // activity we already have, everything older is known — stop early.
        if (existingIds.size && fresh.some((m) => existingIds.has(m.id))) break;
    }

    // Merge fetched over existing (fetched wins for edited activities), newest first.
    const byId = new Map();
    for (const a of existing) byId.set(a.id, a);
    for (const m of collected) byId.set(m.id, normalise(m));
    const activities = [...byId.values()]
        .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    await mkdir(path.dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify(activities, null, 2) + '\n');
    const added = activities.length - existing.length;
    console.log(`✓ ${existing.length ? `+${Math.max(0, added)} new, ` : ''}${activities.length} total → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
    console.error(`✖ ${err.message}`);
    process.exit(1);
});
