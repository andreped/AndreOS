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
import { writeFile, mkdir } from 'node:fs/promises';
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

/** Map one raw dashboard model to the tidy, public-safe shape the app expects. */
function normalise(m) {
    return {
        id: m.id,
        name: m.name,
        type: m.type,
        distance: m.distance,                 // metres
        movingTime: m.moving_time,            // seconds
        elapsedTime: m.elapsed_time,          // seconds
        elevationGain: m.elevation_gain,      // metres
        startDate: m.start_date_local
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

async function main() {
    const cookies = await warmSession(parseCookies(COOKIE));

    const all = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
        const models = await fetchPage(cookies, page);
        if (page === 1) {
            if (!models.length) throw new Error('No activities returned (cookie may be invalid).');
            console.log('First activity keys:', Object.keys(models[0]).join(', '));
        }
        all.push(...models);
        if (models.length < PER_PAGE) break; // last page reached
    }

    const activities = all.map(normalise);
    await mkdir(path.dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify(activities, null, 2) + '\n');
    console.log(`✓ Wrote ${activities.length} activities to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
    console.error(`✖ ${err.message}`);
    process.exit(1);
});
