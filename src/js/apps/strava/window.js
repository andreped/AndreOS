/**
 * Fills a Strava window's feed from `/strava/activities.json` (a file you own,
 * living in the `public/` folder). Strava's raw dashboard/API arrays are also
 * accepted — normaliseActivity() in content.js maps either shape.
 */
import { activityCardHTML, STRAVA_PROFILE_URL } from './content.js';

const DATA_URL = '/strava/activities.json';
const MAX_ITEMS = 15;

export function setupStravaWindow(winEl) {
    const feed = winEl.querySelector('[data-strava-feed]');
    if (feed) loadFeed(feed);
}

async function loadFeed(feed) {
    try {
        const res = await fetch(DATA_URL, { headers: { accept: 'application/json' } });
        if (res.status === 404) { feed.innerHTML = setupHint(); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        // Accept a bare array, or Strava's dashboard `{ models: [...] }` wrapper.
        const list = Array.isArray(data) ? data : (data.models || data.activities || []);
        if (!list.length) { feed.innerHTML = emptyState(); return; }

        feed.innerHTML = list.slice(0, MAX_ITEMS).map(activityCardHTML).join('');
    } catch {
        feed.innerHTML = setupHint();
    }
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

function emptyState() {
    return `
        <div class="strava-notice">
            <p class="strava-notice-emoji">🏁</p>
            <h4>No activities yet</h4>
            <p>The activities file is empty. Add some entries to see them here.</p>
            <a class="strava-profile-btn" href="${STRAVA_PROFILE_URL}" target="_blank" rel="noopener noreferrer">Open Strava ↗</a>
        </div>`;
}
