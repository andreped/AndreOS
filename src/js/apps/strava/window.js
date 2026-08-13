/**
 * Fills a Strava window's feed. Reads from `/api/strava-feed` (a Cloudflare
 * Pages Function backed by Workers KV, refreshed weekly by CI), falling back to
 * a static `/strava/activities.json` for local dev. Strava's raw dashboard/API
 * arrays are also accepted — normaliseActivity() in content.js maps either shape.
 */
import { activityCardHTML, STRAVA_PROFILE_URL } from './content.js';

const SOURCES = ['/api/strava-feed', '/strava/activities.json'];
const MAX_ITEMS = 15;

export function setupStravaWindow(winEl) {
    const feed = winEl.querySelector('[data-strava-feed]');
    if (feed) loadFeed(feed);
}

/** Try each source in turn; the first that yields activities wins. */
async function fetchActivities() {
    for (const url of SOURCES) {
        try {
            const res = await fetch(url, { headers: { accept: 'application/json' } });
            if (!res.ok) continue;
            const data = await res.json();
            // Accept a bare array, or a `{ models|activities: [...] }` wrapper.
            const list = Array.isArray(data) ? data : (data.models || data.activities || []);
            if (list.length) return list;
        } catch { /* try next source */ }
    }
    return null;
}

async function loadFeed(feed) {
    const list = await fetchActivities();
    if (!list) { feed.innerHTML = setupHint(); return; }
    feed.innerHTML = list.slice(0, MAX_ITEMS).map(activityCardHTML).join('');
}

function setupHint() {
    return `
        <div class="strava-notice">
            <p class="strava-notice-emoji">🏃</p>
            <h4>Connect your activities</h4>
            <p>Drop your own <code>activities.json</code> into
               <code>public/strava/</code> and this feed fills with real cards.
               Export it from Strava, or copy it from your logged-in dashboard.</p>
            <a class="strava-profile-btn" href="${STRAVA_PROFILE_URL}" target="_blank" rel="noopener noreferrer">Open Strava profile ↗</a>
        </div>`;
}
