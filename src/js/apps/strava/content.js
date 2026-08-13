/**
 * Strava app window content — renders your own activities as native cards.
 *
 * Strava's data API is gated behind a paid subscription, but this app doesn't
 * need it: it reads a small `activities.json` that *you* own (exported from your
 * account or copied from your logged-in dashboard). The feed itself is fetched
 * and injected at runtime by `setupStravaWindow` in window.js from
 * `/strava/activities.json` (in the `public/` folder).
 */

export const STRAVA_PROFILE_URL = 'https://www.strava.com/athletes/162707092';

const STRAVA_MARK = `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>`;

/** Emoji glyph per Strava sport type. */
const TYPE_ICON = {
    Run: '🏃', TrailRun: '🏃', VirtualRun: '🏃',
    Ride: '🚴', VirtualRide: '🚴', MountainBikeRide: '🚵', GravelRide: '🚴', EBikeRide: '🚴',
    Swim: '🏊',
    Hike: '🥾', Walk: '🚶',
    WeightTraining: '🏋️', Workout: '💪', Crossfit: '🤸', HighIntensityIntervalTraining: '🔥', Pilates: '🧘',
    RockClimbing: '🧗', Climbing: '🧗', Bouldering: '🧗',
    StairStepper: '🪜', Elliptical: '🌀', VirtualRow: '🚣', Rowing: '🚣',
    Soccer: '⚽', Football: '⚽', Tennis: '🎾', TableTennis: '🏓', Badminton: '🏸', Squash: '🎾', Racquetball: '🎾', Basketball: '🏀', Volleyball: '🏐',
    AlpineSki: '⛷️', BackcountrySki: '🎿', NordicSki: '🎿', RollerSki: '🎿', Snowboard: '🏂', Snowshoe: '🥾', IceSkate: '⛸️',
    Kayaking: '🛶', Canoeing: '🛶', StandUpPaddling: '🏄', Surfing: '🏄', Windsurf: '🏄', Kitesurf: '🪁', Sail: '⛵', Swimming: '🏊',
    InlineSkate: '🛼', Skateboard: '🛹', Handcycle: '🚲', Wheelchair: '🦽', Golf: '⛳', Yoga: '🧘',
};

export function typeIcon(type) {
    return TYPE_ICON[type] || '💪';
}

/** Human-friendly sport label, e.g. "MountainBikeRide" → "Mountain Bike Ride". */
export function typeLabel(type) {
    return String(type || 'Activity').replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function formatDistance(metres) {
    if (!metres) return '—';
    const km = metres / 1000;
    return km >= 1 ? `${km.toFixed(2)} km` : `${Math.round(metres)} m`;
}

export function formatDuration(seconds) {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
}

export function formatElevation(metres) {
    if (!metres) return '—';
    return `${Math.round(metres)} m`;
}

/** Average pace (min/km) for foot sports, otherwise average speed (km/h). */
export function formatPaceOrSpeed(type, speedMps) {
    if (!speedMps) return '—';
    const footSports = /Run|Walk|Hike/.test(type || '');
    if (footSports) {
        const secPerKm = 1000 / speedMps;
        const m = Math.floor(secPerKm / 60);
        const s = Math.round(secPerKm % 60);
        return `${m}:${String(s).padStart(2, '0')} /km`;
    }
    return `${(speedMps * 3.6).toFixed(1)} km/h`;
}

export function formatDate(iso) {
    if (!iso) return '';
    const hasTime = typeof iso === 'string' && iso.includes('T');
    let d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        // Legacy "Wed, M/D/YYYY" strings — drop the weekday prefix and retry.
        d = new Date(String(iso).replace(/^[A-Za-z]{3,},?\s*/, ''));
    }
    if (Number.isNaN(d.getTime())) return String(iso);
    // startDate encodes the activity's *local* wall-clock time as UTC, so format
    // in UTC to show the time it actually started, regardless of viewer timezone.
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    let day;
    if (diffDays === 0) day = 'Today';
    else if (diffDays === 1) day = 'Yesterday';
    else if (diffDays > 0 && diffDays < 7) day = `${diffDays} days ago`;
    else day = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return hasTime ? `${day} · ${time}` : day;
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

/**
 * Normalise one raw entry into the shape the card renderer expects. Accepts
 * both the tidy exported shape (camelCase) and Strava's raw dashboard JSON
 * (snake_case from /athlete/training_activities or the v3 API).
 */
export function normaliseActivity(a) {
    const distance = a.distance ?? a.distance_raw;
    const movingTime = a.movingTime ?? a.moving_time_raw ?? a.moving_time;
    const start = a.startDate ?? a.start_date_local ?? a.start_date
        ?? (a.start_date_local_raw ? a.start_date_local_raw * 1000 : undefined);
    return {
        id: a.id,
        name: a.name,
        type: a.type ?? a.sport_type,
        distance,
        movingTime,
        elapsedTime: a.elapsedTime ?? a.elapsed_time_raw ?? a.elapsed_time,
        elevationGain: a.elevationGain ?? a.elevation_gain_raw ?? a.elevation_gain ?? a.total_elevation_gain,
        averageSpeed: a.averageSpeed ?? a.average_speed
            ?? (distance && movingTime ? distance / movingTime : undefined),
        sufferScore: a.sufferScore ?? a.suffer_score ?? undefined,
        startDate: typeof start === 'number' ? new Date(start).toISOString() : start,
    };
}

/** Build the HTML for a single normalised activity. */
export function activityCardHTML(raw) {
    const a = normaliseActivity(raw);
    const href = a.id ? `https://www.strava.com/activities/${a.id}` : STRAVA_PROFILE_URL;
    const isFoot = /Run|Walk|Hike/.test(a.type || '');
    const hasDistance = a.distance > 0;

    // Only show stats that make sense for this sport (a strength session has no
    // distance or pace), so the card stays informative instead of full of dashes.
    const stats = [];
    if (hasDistance) stats.push({ label: 'Distance', value: formatDistance(a.distance) });
    stats.push({ label: 'Time', value: formatDuration(a.movingTime) });
    if (hasDistance) stats.push({ label: isFoot ? 'Pace' : 'Speed', value: formatPaceOrSpeed(a.type, a.averageSpeed) });
    if (a.elevationGain > 0) stats.push({ label: 'Elev', value: formatElevation(a.elevationGain) });
    if (a.sufferScore) stats.push({ label: 'Effort', value: String(Math.round(a.sufferScore)) });

    return `
        <a class="strava-card" href="${href}" target="_blank" rel="noopener noreferrer">
            <div class="strava-card-head">
                <span class="strava-type-icon">${typeIcon(a.type)}</span>
                <div class="strava-card-meta">
                    <h4>${escapeHtml(a.name)}</h4>
                    <span class="strava-card-sub">${escapeHtml(typeLabel(a.type))} · ${formatDate(a.startDate)}</span>
                </div>
            </div>
            <div class="strava-card-stats">
                ${stats.slice(0, 4).map((s) => `
                    <div class="strava-stat">
                        <span class="strava-stat-value">${s.value}</span>
                        <span class="strava-stat-label">${s.label}</span>
                    </div>`).join('')}
            </div>
        </a>
    `;
}

/** The static window shell. The feed body is filled in by setupStravaWindow. */
export function render() {
    const skeletons = Array.from({ length: 4 }, () => `
        <div class="strava-card strava-skeleton">
            <div class="strava-card-head">
                <span class="strava-sk-dot"></span>
                <div class="strava-card-meta">
                    <span class="strava-sk-line strava-sk-line--title"></span>
                    <span class="strava-sk-line strava-sk-line--sub"></span>
                </div>
            </div>
            <div class="strava-card-stats">
                ${Array.from({ length: 4 }, () => '<span class="strava-sk-line strava-sk-line--stat"></span>').join('')}
            </div>
        </div>`).join('');

    return `
        <div class="strava-app">
            <div class="strava-header">
                <div class="strava-brand">
                    <span class="strava-logo">${STRAVA_MARK}</span>
                    <div>
                        <h3>Strava</h3>
                        <span class="strava-tagline">Latest activities</span>
                    </div>
                </div>
                <a class="strava-profile-btn" href="${STRAVA_PROFILE_URL}" target="_blank" rel="noopener noreferrer">
                    View profile ↗
                </a>
            </div>
            <div class="strava-feed" data-strava-feed>
                ${skeletons}
            </div>
        </div>
    `;
}
