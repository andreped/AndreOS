/**
 * Shared Strava activity store.
 *
 * Both the window (feed UI) and the assistant context provider read from here,
 * so the data is fetched once and cached. Source order: the live KV-backed
 * Pages Function, then the static dev fallback.
 */
const SOURCES = ['/api/strava-feed', '/strava/activities.json'];

let _activities = [];
let _loading = null;

export function getActivities() {
    return _activities;
}

export function setActivities(list) {
    _activities = Array.isArray(list) ? list : [];
}

/** Fetch + cache the feed once. Safe to call repeatedly (dedupes in-flight). */
export function ensureLoaded() {
    if (_activities.length) return Promise.resolve(_activities);
    if (_loading) return _loading;
    _loading = (async () => {
        for (const url of SOURCES) {
            try {
                const res = await fetch(url, { headers: { accept: 'application/json' } });
                if (!res.ok) continue;
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data.models || data.activities || []);
                if (list.length) { _activities = list; break; }
            } catch { /* try next source */ }
        }
        _loading = null;
        return _activities;
    })();
    return _loading;
}
