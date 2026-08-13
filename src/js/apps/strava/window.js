/**
 * Fills a Strava window's feed. Reads from `/api/strava-feed` (a Cloudflare
 * Pages Function backed by Workers KV, refreshed weekly by CI), falling back to
 * a static `/strava/activities.json` for local dev. Strava's raw dashboard/API
 * arrays are also accepted — normaliseActivity() in content.js maps either shape.
 */
import { activityCardHTML, STRAVA_PROFILE_URL } from './content.js';
import { ensureLoaded } from './data.js';

const BATCH_SIZE = 20;

export function setupStravaWindow(winEl) {
    const feed = winEl.querySelector('[data-strava-feed]');
    if (feed) loadFeed(feed);
}

async function loadFeed(feed) {
    const list = await ensureLoaded();
    if (!list.length) { feed.innerHTML = setupHint(); return; }
    renderInfinite(feed, list);
}

/** Render the feed in batches, appending more as a sentinel scrolls into view. */
function renderInfinite(feed, list) {
    feed.innerHTML = '';
    const sentinel = document.createElement('div');
    sentinel.className = 'strava-sentinel';
    feed.appendChild(sentinel);

    let rendered = 0;
    const renderMore = () => {
        const next = list.slice(rendered, rendered + BATCH_SIZE);
        if (!next.length) return;
        sentinel.insertAdjacentHTML('beforebegin', next.map(activityCardHTML).join(''));
        rendered += next.length;
        if (rendered >= list.length) {
            observer.disconnect();
            sentinel.remove();
        }
    };

    const observer = new IntersectionObserver(
        (entries) => { if (entries.some((e) => e.isIntersecting)) renderMore(); },
        { root: feed, rootMargin: '300px' },
    );
    observer.observe(sentinel);
    renderMore(); // first batch (observer fills the rest as needed)
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
