/**
 * ResearchWindow
 *
 * Fetches André's publications from OpenAlex (free, open scholarly API),
 * caches the result in localStorage for 24 hours, then renders a searchable,
 * sortable list of papers with stats.
 *
 * OpenAlex author ID: A5090654106  (André Pedersen, SINTEF / NTNU)
 * Scholar profile:  https://scholar.google.com/citations?user=U20zUHQAAAAJ
 */

const AUTHOR_ID = 'A5090654106';
const CACHE_KEY = 'andreOS_research_v2';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const AUTHOR_URL = `https://api.openalex.org/authors/${AUTHOR_ID}?select=works_count,cited_by_count,summary_stats`;
const WORKS_URL  =
    `https://api.openalex.org/works` +
    `?filter=author.id:${AUTHOR_ID}` +
    `&sort=publication_date:desc` +
    `&per_page=50` +
    `&select=id,title,publication_year,cited_by_count,doi,primary_location,type,open_access,abstract_inverted_index`;

// ── Data fetching ─────────────────────────────────────────────────────────────

async function loadData() {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
        try {
            const { ts, data } = JSON.parse(raw);
            if (Date.now() - ts < CACHE_TTL) return data;
        } catch {
            // corrupt cache — refetch
        }
    }

    const [aRes, wRes] = await Promise.all([
        fetch(AUTHOR_URL),
        fetch(WORKS_URL),
    ]);

    if (!aRes.ok) throw new Error(`Author fetch failed (${aRes.status})`);
    if (!wRes.ok) throw new Error(`Works fetch failed (${wRes.status})`);

    const [author, works] = await Promise.all([aRes.json(), wRes.json()]);

    const data = {
        worksCount: author.works_count   ?? 0,
        citations:  author.cited_by_count ?? 0,
        hIndex:     author.summary_stats?.h_index ?? '–',
        papers:     works.results ?? [],
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    return data;
}

// ── Abstract reconstruction ─────────────────────────────────────────────────

function reconstructAbstract(invertedIndex) {
    if (!invertedIndex || typeof invertedIndex !== 'object') return null;
    const positions = [];
    for (const [word, idxList] of Object.entries(invertedIndex)) {
        for (const pos of idxList) {
            positions[pos] = word;
        }
    }
    const text = positions.filter(Boolean).join(' ').trim();
    return text.length > 0 ? text : null;
}

// ── Rendering helpers ─────────────────────────────────────────────────────────

function typeLabel(type) {
    switch (type) {
        case 'journal-article':     return 'Journal';
        case 'proceedings-article': return 'Conference';
        case 'book-chapter':        return 'Book Chapter';
        case 'preprint':            return 'Preprint';
        case 'dataset':             return 'Dataset';
        default:                    return type ?? '';
    }
}

function renderPaper(p) {
    const doi   = p.doi ? (p.doi.startsWith('https') ? p.doi : `https://doi.org/${p.doi}`) : null;
    const venue = p.primary_location?.source?.display_name ?? '';
    const oaUrl = p.open_access?.oa_url ?? null;
    const type  = typeLabel(p.type);
    const cite  = p.cited_by_count ?? 0;
    const title = p.title ?? 'Untitled';

    const titleEl = doi
        ? `<a href="${doi}" target="_blank" rel="noopener noreferrer">${title}</a>`
        : `<span>${title}</span>`;

    const oaBadge = oaUrl
        ? `<a href="${oaUrl}" target="_blank" rel="noopener noreferrer" class="paper-oa-badge" title="Open Access PDF">OA</a>`
        : '';

    const abstract = reconstructAbstract(p.abstract_inverted_index);

    return `
        <div class="research-paper" data-year="${p.publication_year ?? 0}" data-citations="${cite}">
            <div class="paper-header">
                <div class="paper-title">${titleEl}${oaBadge}</div>
                <div class="paper-meta">
                    <span class="paper-year">${p.publication_year ?? '?'}</span>
                    ${venue ? `<span class="paper-venue" title="${venue}">${venue}</span>` : ''}
                    ${type  ? `<span class="paper-type">${type}</span>` : ''}
                    <span class="paper-cites">${cite} citation${cite !== 1 ? 's' : ''}</span>
                    ${abstract ? `<span class="paper-expand-btn" title="Show abstract">▼</span>` : ''}
                </div>
            </div>
            ${abstract ? `<div class="paper-abstract" hidden>${abstract}</div>` : ''}
        </div>`;
}

function applyFilters(listEl, papers, query, sort) {
    const q = query.trim().toLowerCase();

    let filtered = q
        ? papers.filter(p =>
            (p.title ?? '').toLowerCase().includes(q) ||
            (p.primary_location?.source?.display_name ?? '').toLowerCase().includes(q))
        : [...papers];

    if      (sort === 'cited') filtered.sort((a, b) => (b.cited_by_count ?? 0) - (a.cited_by_count ?? 0));
    else if (sort === 'asc')   filtered.sort((a, b) => (a.publication_year ?? 0) - (b.publication_year ?? 0));
    // 'date' (default) is already sorted desc by the API

    listEl.innerHTML = filtered.length
        ? filtered.map(renderPaper).join('')
        : '<p class="research-empty">No publications match your search.</p>';
}

// ── Public setup entry-point ──────────────────────────────────────────────────

export function setupResearchWindow(winEl) {
    const statusEl = winEl.querySelector('.research-status');
    const bodyEl   = winEl.querySelector('.research-body');
    const statsEl  = winEl.querySelector('.research-stats');
    const listEl   = winEl.querySelector('.research-list');
    const searchEl = winEl.querySelector('.research-search');
    const sortEl   = winEl.querySelector('.research-sort');

    if (!statusEl || !bodyEl) return;

    loadData()
        .then(data => {
            statsEl.innerHTML = `
                <div class="stats-row">
                    <span class="stat-pill"><strong>${data.worksCount}</strong> publications</span>
                    <span class="stat-dot">·</span>
                    <span class="stat-pill"><strong>${data.citations}</strong> citations</span>
                    <span class="stat-dot">·</span>
                    <span class="stat-pill">h-index <strong>${data.hIndex}</strong></span>
                </div>
                <div class="stats-row stats-row--right">
                    <span class="stats-source">via OpenAlex (undercounts vs. Scholar)</span>
                    <a href="https://scholar.google.com/citations?user=U20zUHQAAAAJ"
                       target="_blank" rel="noopener noreferrer" class="scholar-link">
                        Google Scholar ↗
                    </a>
                </div>`;

            applyFilters(listEl, data.papers, '', 'cited');
            statusEl.style.display = 'none';
            bodyEl.style.display   = 'flex';

            searchEl.addEventListener('input',  () => applyFilters(listEl, data.papers, searchEl.value, sortEl.value));
            sortEl.addEventListener('change',   () => applyFilters(listEl, data.papers, searchEl.value, sortEl.value));

            // Abstract expand/collapse via event delegation
            listEl.addEventListener('click', (e) => {
                const card = e.target.closest('.research-paper');
                if (!card) return;
                // Don't intercept clicks on links
                if (e.target.closest('a')) return;

                const abstractEl = card.querySelector('.paper-abstract');
                const btn        = card.querySelector('.paper-expand-btn');
                if (!abstractEl) return;

                const expanded = !abstractEl.hidden;
                abstractEl.hidden = expanded;
                if (btn) btn.textContent = expanded ? '\u25bc' : '\u25b2';
                card.classList.toggle('paper-expanded', !expanded);
            });
        })
        .catch(err => {
            statusEl.innerHTML = `
                <div class="research-error">
                    <p>⚠️ Could not load publications.</p>
                    <p>${err.message}</p>
                    <button class="research-retry">Retry</button>
                </div>`;
            statusEl.querySelector('.research-retry')?.addEventListener('click', () => {
                localStorage.removeItem(CACHE_KEY);
                statusEl.innerHTML = `
                    <div class="research-loading">
                        <div class="research-spinner"></div>
                        <p>Loading publications…</p>
                    </div>`;
                setupResearchWindow(winEl);
            });
        });
}
