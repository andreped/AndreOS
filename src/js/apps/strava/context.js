/**
 * Strava assistant context provider.
 *
 * The feed is a few hundred structured rows — too many to dump into the prompt,
 * and pure text retrieval can't sum distances or count sessions. Instead this
 * precomputes a compact analytics digest (totals, per-sport breakdown, rolling
 * time windows, records, recent rows) that the LLM can reason over directly.
 * When the query names a sport or year, a focused section for it is appended.
 */
import { normaliseActivity, formatDistance, formatDuration, typeLabel } from './content.js';
import { getActivities, ensureLoaded } from './data.js';

const round = (n, d = 0) => {
    const p = 10 ** d;
    return Math.round(n * p) / p;
};

/** Sum distance/time/elevation over a set of normalised activities. */
function rollup(acts) {
    let dist = 0, time = 0, elev = 0;
    for (const a of acts) {
        dist += a.distance || 0;
        time += a.movingTime || 0;
        elev += a.elevationGain || 0;
    }
    return {
        count: acts.length,
        km: round(dist / 1000, 1),
        hours: round(time / 3600, 1),
        elevM: Math.round(elev),
    };
}

const line = (label, r) =>
    `${label}: ${r.count} activities, ${r.km} km, ${r.hours} h moving${r.elevM ? `, ${r.elevM} m climb` : ''}`;

/** A one-line summary of a single activity. */
function activityLine(a) {
    const bits = [typeLabel(a.type)];
    if (a.distance > 0) bits.push(formatDistance(a.distance));
    bits.push(formatDuration(a.movingTime));
    const date = a.startDate ? new Date(a.startDate).toISOString().slice(0, 10) : '';
    return `- ${a.name} — ${bits.join(', ')}${date ? ` (${date})` : ''}`;
}

/** Group activities by sport, sorted by frequency. */
function bySport(acts) {
    const map = new Map();
    for (const a of acts) {
        const key = a.type || 'Other';
        (map.get(key) || map.set(key, []).get(key)).push(a);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

export const stravaContext = {
    getContextBlock(query = '') {
        const raw = getActivities();
        if (!raw.length) {
            ensureLoaded(); // warm the cache for the next turn
            // Return a block rather than '' so the model doesn't invent numbers.
            return `## André's Strava activity data\n` +
                `The activity data is still loading. If asked for totals or stats, say the data is ` +
                `still loading and to try again in a moment — do not guess any numbers.`;
        }

        const acts = raw
            .map(normaliseActivity)
            .filter((a) => a.startDate && !Number.isNaN(new Date(a.startDate).getTime()))
            .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        if (!acts.length) return '';

        const now = Date.now();
        const since = (days) => acts.filter((a) => now - new Date(a.startDate).getTime() <= days * 86_400_000);
        const yearOf = (a) => new Date(a.startDate).getUTCFullYear();

        const first = acts[acts.length - 1].startDate.slice(0, 10);
        const last = acts[0].startDate.slice(0, 10);

        const sportLines = bySport(acts)
            .map(([type, group]) => `- ${line(typeLabel(type), rollup(group))}`)
            .join('\n');

        const maxBy = (sel) => acts.reduce((best, a) => (sel(a) > sel(best) ? a : best), acts[0]);
        const longestDist = maxBy((a) => a.distance || 0);
        const longestTime = maxBy((a) => a.movingTime || 0);
        const mostClimb = maxBy((a) => a.elevationGain || 0);

        let block =
            `## André's Strava activity data (${acts.length} activities, ${first} → ${last})\n` +
            `The user is viewing their Strava feed. Answer questions about their training strictly from the data below.\n\n` +
            `### Totals\n${line('All time', rollup(acts))}\n\n` +
            `### Recent windows\n` +
            `${line('Last 7 days', rollup(since(7)))}\n` +
            `${line('Last 30 days', rollup(since(30)))}\n` +
            `${line('Last 365 days', rollup(since(365)))}\n\n` +
            `### By sport\n${sportLines}\n\n` +
            `### Records\n` +
            `- Longest distance: ${longestDist.name} (${formatDistance(longestDist.distance)})\n` +
            `- Longest duration: ${longestTime.name} (${formatDuration(longestTime.movingTime)})\n` +
            `- Most elevation: ${mostClimb.name} (${Math.round(mostClimb.elevationGain)} m)\n\n` +
            `### Most recent\n${acts.slice(0, 10).map(activityLine).join('\n')}`;

        // Focused section when the query names a specific year or sport.
        const q = query.toLowerCase();
        const yearMatch = q.match(/\b(20\d{2})\b/);
        const sportEntry = bySport(acts).find(([type]) =>
            q.includes(type.toLowerCase()) || q.includes(typeLabel(type).toLowerCase()));

        if (yearMatch) {
            const y = Number(yearMatch[1]);
            const inYear = acts.filter((a) => yearOf(a) === y);
            if (inYear.length) block += `\n\n### ${y}\n${line(String(y), rollup(inYear))}`;
        }
        if (sportEntry) {
            const [type, group] = sportEntry;
            block += `\n\n### ${typeLabel(type)} detail\n${line('Total', rollup(group))}\n` +
                group.slice(0, 8).map(activityLine).join('\n');
        }

        return block;
    },
};
