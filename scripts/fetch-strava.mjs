/**
 * Fetches your own recent Strava activities using a stored session cookie and
 * writes them to public/strava/activities.json (consumed by the Strava app).
 *
 * This performs NO login automation: you log in once in a real browser and
 * provide the resulting session cookie via the STRAVA_COOKIE env var (a GitHub
 * Actions secret in CI). The script simply reuses that authenticated session to
 * read your own data from the same endpoint Strava's web dashboard uses.
 *
 * Requires Node 18+ (global fetch). Run locally with:
 *   STRAVA_COOKIE='_strava4_session=…' node scripts/fetch-strava.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const COOKIE = process.env.STRAVA_COOKIE;
const PER_PAGE = Number(process.env.STRAVA_PER_PAGE || 20);
const OUT = path.resolve('public/strava/activities.json');
const ENDPOINT = `https://www.strava.com/athlete/training_activities?per_page=${PER_PAGE}&page=1`;

if (!COOKIE) {
    console.error('✖ STRAVA_COOKIE is not set.');
    process.exit(1);
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

async function main() {
    const res = await fetch(ENDPOINT, {
        headers: {
            cookie: COOKIE,
            accept: 'text/javascript, application/json, */*',
            'x-requested-with': 'XMLHttpRequest',
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            referer: 'https://www.strava.com/athlete/training',
        },
    });

    if (res.status === 401 || res.status === 302) {
        throw new Error('Session cookie rejected/expired — refresh the STRAVA_COOKIE secret.');
    }
    if (!res.ok) throw new Error(`Unexpected status ${res.status}`);

    const data = await res.json();
    const models = Array.isArray(data) ? data : (data.models || []);
    if (!models.length) throw new Error('No activities returned (cookie may be invalid).');

    const activities = models.map(normalise);
    await mkdir(path.dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify(activities, null, 2) + '\n');
    console.log(`✓ Wrote ${activities.length} activities to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
    console.error(`✖ ${err.message}`);
    process.exit(1);
});
