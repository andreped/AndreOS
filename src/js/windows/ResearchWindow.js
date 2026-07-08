/**
 * ResearchWindow
 *
 * Fetches André's publications from OpenAlex (free, open scholarly API),
 * caches the result in localStorage for 24 hours, then renders a searchable,
 * sortable Finder-style master-detail view: a list of papers on the left and
 * an embedded PDF reader on the right.
 *
 * Selecting a paper loads its open-access PDF (when available) and registers it
 * as the "active paper" so the assistant can answer questions about it.
 *
 * OpenAlex author ID: A5090654106  (André Pedersen, SINTEF / NTNU)
 * Scholar profile:  https://scholar.google.com/citations?user=U20zUHQAAAAJ
 */

import { ActiveContext } from '../system/ActiveContext.js';

const AUTHOR_ID = 'A5090654106';
const CACHE_KEY = 'andreOS_research_v3'; // v3: added best_oa_location to the query
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const AUTHOR_URL = `https://api.openalex.org/authors/${AUTHOR_ID}?select=works_count,cited_by_count,summary_stats`;
const WORKS_URL  =
    `https://api.openalex.org/works` +
    `?filter=author.id:${AUTHOR_ID}` +
    `&sort=publication_date:desc` +
    `&per_page=50` +
    `&select=id,title,publication_year,cited_by_count,doi,primary_location,best_oa_location,type,open_access,abstract_inverted_index`;

/**
 * Resolve the best *direct* PDF URL for a work. OpenAlex spreads this across
 * several fields — the direct file often lives in best_oa_location.pdf_url even
 * when open_access.oa_url is null (or points at a landing page).
 * @param {object} p
 * @returns {string|null}
 */
function resolvePdfUrl(p) {
    const url = p.best_oa_location?.pdf_url
        || p.primary_location?.pdf_url
        || p.open_access?.oa_url
        || null;
    // Upgrade http→https so the fetch isn't blocked as mixed content in prod,
    // and prefer the canonical arxiv.org host over the export mirror.
    if (!url) return null;
    return url.replace(/^http:\/\//i, 'https://').replace('://export.arxiv.org/', '://arxiv.org/');
}

// ── PDF full-text extraction (best-effort) ────────────────────────────────────
// Cross-origin PDFs are frequently CORS-blocked; when extraction fails we simply
// keep the abstract as the assistant's context. pdf.js is loaded from CDN on
// demand so it never bloats the main bundle.
const PDFJS_VERSION = '4.7.76';
const PDFJS_CDN    = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const PDFJS_WORKER = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

let _pdfjsPromise = null;
function loadPdfjs() {
    if (!_pdfjsPromise) {
        _pdfjsPromise = import(/* @vite-ignore */ PDFJS_CDN).then((mod) => {
            mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
            return mod;
        });
    }
    return _pdfjsPromise;
}

async function extractPdfText(doc, { maxChars = 40000, maxPages = 30 } = {}) {
    let text = '';
    const pages = Math.min(doc.numPages, maxPages);
    for (let i = 1; i <= pages; i++) {
        const page    = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(it => it.str).join(' ') + '\n';
        if (text.length >= maxChars) break;
    }
    return text.replace(/\s+/g, ' ').slice(0, maxChars).trim();
}

/**
 * Load a PDF document with pdf.js. Fetching the bytes ourselves means no
 * browser "download" prompt and no X-Frame-Options issues — it works whenever
 * the host allows CORS (arXiv, most repositories).
 * @param {string} url
 * @returns {Promise<object>} the pdf.js document
 */
async function loadPdfDoc(url) {
    const pdfjs = await loadPdfjs();
    return pdfjs.getDocument({ url, withCredentials: false }).promise;
}

/**
 * Render the cached PDF document's pages into the window's canvas container at
 * the current zoom scale. Width is measured from the viewer (always laid out)
 * so it's correct even while the canvas is hidden during loading.
 * @param {HTMLElement} winEl
 * @param {{ isCurrent?: () => boolean, maxPages?: number }} opts
 */
async function renderPdfPages(winEl, { isCurrent = () => true, maxPages = 30 } = {}) {
    const doc       = winEl._pdfDoc;
    const container = winEl.querySelector('.research-pdf-canvas');
    if (!doc || !container) return;

    const dpr   = window.devicePixelRatio || 1;
    const scale = winEl._pdfScale || 1;
    // Fit-to-width from the canvas's own inner content box (clientWidth already
    // excludes the scrollbar), × zoom. Measuring the canvas — not the viewer —
    // keeps pages within bounds so they stay centred.
    const cs   = getComputedStyle(container);
    const padX = parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0');
    const avail = Math.max(240, container.clientWidth - padX);
    const width = avail * scale;

    container.innerHTML = '';
    const pages = Math.min(doc.numPages, maxPages);
    for (let i = 1; i <= pages; i++) {
        if (!isCurrent()) break;
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const view = page.getViewport({ scale: (width / base.width) * dpr });

        const canvas = document.createElement('canvas');
        canvas.className   = 'research-pdf-page';
        canvas.width       = view.width;
        canvas.height      = view.height;
        canvas.style.width = width + 'px';
        container.appendChild(canvas);

        await page.render({ canvasContext: canvas.getContext('2d'), viewport: view }).promise;
    }
}

/** Adjust the PDF zoom by delta and re-render from the cached document. */
function setZoom(winEl, delta) {
    if (!winEl._pdfDoc || winEl._pdfState !== 'ready') return;
    winEl._pdfScale = Math.min(3, Math.max(0.5, (winEl._pdfScale || 1) + delta));
    updateZoomLabel(winEl);
    const token = winEl._pdfToken;
    renderPdfPages(winEl, { isCurrent: () => winEl._pdfToken === token });
}

function updateZoomLabel(winEl) {
    const el = winEl.querySelector('.research-zoom-level');
    if (el) el.textContent = Math.round((winEl._pdfScale || 1) * 100) + '%';
}


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
    const venue = p.primary_location?.source?.display_name ?? '';
    const type  = typeLabel(p.type);
    const cite  = p.cited_by_count ?? 0;
    const title = (p.title ?? 'Untitled').replace(/\s+/g, ' ').trim();
    const hasOa = !!resolvePdfUrl(p);

    return `
        <div class="research-paper" data-id="${p.id}" data-year="${p.publication_year ?? 0}" data-citations="${cite}">
            <div class="paper-row-title">${title}</div>
            <div class="paper-meta">
                <span class="paper-year">${p.publication_year ?? '?'}</span>
                ${venue ? `<span class="paper-venue" title="${venue}">${venue}</span>` : ''}
                ${type  ? `<span class="paper-type">${type}</span>` : ''}
                <span class="paper-cites">${cite} cite${cite !== 1 ? 's' : ''}</span>
                ${hasOa ? `<span class="paper-oa-dot" title="Open-access PDF available">OA</span>` : ''}
            </div>
        </div>`;
}

/**
 * Apply the current detail view (PDF vs Abstract) based on winEl state.
 * winEl._detailView: 'pdf' | 'abstract'
 * winEl._pdfState:   'loading' | 'ready' | 'blocked' | 'none'
 */
function applyDetailView(winEl) {
    const view  = winEl._detailView || 'pdf';
    const state = winEl._pdfState   || 'loading';
    const q = (s) => winEl.querySelector(s);

    winEl.querySelectorAll('.research-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.view === view));

    const pdfMode = view === 'pdf';
    const canvas  = q('.research-pdf-canvas');
    const loading = q('.research-pdf-loading');
    const blocked = q('.research-pdf-blocked');
    const none    = q('.research-pdf-none');
    const abs     = q('.research-abstract-view');
    const zoom    = q('.research-pdf-zoom');

    if (abs)     abs.hidden = pdfMode;
    if (canvas)  canvas.style.display  = (pdfMode && (state === 'ready' || state === 'loading')) ? 'block' : 'none';
    if (loading) loading.style.display = (pdfMode && state === 'loading') ? 'flex'  : 'none';
    if (blocked) blocked.hidden = !(pdfMode && state === 'blocked');
    if (none)    none.hidden    = !(pdfMode && state === 'none');
    if (zoom)    zoom.hidden    = !(pdfMode && state === 'ready');
}

/**
 * Show a paper in the right-hand detail panel: render its OA PDF (with an
 * automatic fallback to the abstract), register it as the active assistant
 * context, and kick off best-effort full-text extraction.
 * @param {HTMLElement} winEl
 * @param {object}      paper
 */
function selectPaper(winEl, paper) {
    const listEl = winEl.querySelector('.research-list');
    listEl?.querySelectorAll('.research-paper').forEach(el =>
        el.classList.toggle('selected', el.dataset.id === paper.id));

    const detail  = winEl.querySelector('.research-detail');
    const empty   = winEl.querySelector('.research-detail-empty');
    const titleEl = winEl.querySelector('.research-detail-title');
    const doiLink = winEl.querySelector('.research-detail-doi');
    const newtab  = winEl.querySelector('.research-detail-newtab');
    const canvas  = winEl.querySelector('.research-pdf-canvas');
    const blockA  = winEl.querySelector('.research-pdf-blocked-link');
    const absMeta = winEl.querySelector('.research-abstract-meta');
    const absText = winEl.querySelector('.research-abstract-text');

    if (empty)  empty.hidden  = true;
    if (detail) detail.hidden = false;

    const title    = (paper.title ?? 'Untitled').replace(/\s+/g, ' ').trim();
    const doi      = paper.doi ? (paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`) : null;
    const pdfUrl   = resolvePdfUrl(paper);
    const abstract = reconstructAbstract(paper.abstract_inverted_index) ?? '';
    const venue    = paper.primary_location?.source?.display_name ?? '';

    if (titleEl) titleEl.textContent = title;
    if (doiLink) { doiLink.hidden = !doi; if (doi) doiLink.href = doi; }
    if (newtab)  { newtab.hidden = !(pdfUrl || doi); newtab.href = pdfUrl || doi || '#'; }
    if (blockA && pdfUrl) blockA.href = pdfUrl;

    // Abstract tab content
    if (absMeta) {
        absMeta.innerHTML = [
            paper.publication_year,
            venue,
            typeLabel(paper.type),
            `${paper.cited_by_count ?? 0} citations`,
        ].filter(Boolean).map(s => `<span>${s}</span>`).join('');
    }
    if (absText) absText.textContent = abstract || 'No abstract is available for this publication.';

    // Register active context immediately (abstract-based); full text fills in later
    ActiveContext.setPaper({ title, abstract, year: paper.publication_year, url: pdfUrl ?? doi ?? paper.id });

    // Reset viewer; a monotonic token guards against out-of-order renders
    if (canvas) canvas.innerHTML = '';
    const token = (winEl._pdfToken = (winEl._pdfToken ?? 0) + 1);
    const isCurrent = () => winEl._pdfToken === token;

    if (pdfUrl && canvas) {
        winEl._pdfState   = 'loading';
        winEl._detailView = 'pdf';
        winEl._pdfScale   = 1;
        winEl._pdfDoc     = null;
        applyDetailView(winEl);
        updateZoomLabel(winEl);

        // Load once, then render pages (zoom re-renders from the cached doc).
        loadPdfDoc(pdfUrl)
            .then(async (doc) => {
                if (!isCurrent()) return;
                winEl._pdfDoc = doc;
                await renderPdfPages(winEl, { isCurrent });
                if (!isCurrent()) return;
                winEl._pdfState = 'ready';
                applyDetailView(winEl);
                try {
                    const txt = await extractPdfText(doc);
                    if (txt && isCurrent()) ActiveContext.setFullText(pdfUrl, txt);
                } catch {}
            })
            .catch(() => {
                if (!isCurrent()) return;
                // CORS-blocked or unreadable → fall back to the abstract
                winEl._pdfState   = 'blocked';
                winEl._detailView = 'abstract';
                applyDetailView(winEl);
            });
    } else {
        // No open-access PDF — fall back to the abstract
        winEl._pdfState   = 'none';
        winEl._detailView = 'abstract';
        applyDetailView(winEl);
    }
}

function applyFilters(listEl, papers, query, sort, typeFilter = 'all', selectedId = null) {
    const q = query.trim().toLowerCase();

    let filtered = q
        ? papers.filter(p =>
            (p.title ?? '').toLowerCase().includes(q) ||
            (p.primary_location?.source?.display_name ?? '').toLowerCase().includes(q))
        : [...papers];

    if (typeFilter !== 'all') {
        filtered = filtered.filter(p => (p.type ?? '') === typeFilter);
    }

    if      (sort === 'cited') filtered.sort((a, b) => (b.cited_by_count ?? 0) - (a.cited_by_count ?? 0));
    else if (sort === 'asc')   filtered.sort((a, b) => (a.publication_year ?? 0) - (b.publication_year ?? 0));
    // 'date' (default) is already sorted desc by the API

    listEl.innerHTML = filtered.length
        ? filtered.map(renderPaper).join('')
        : '<p class="research-empty">No publications match your search.</p>';

    // Preserve the current selection highlight across re-renders
    if (selectedId) {
        listEl.querySelector(`.research-paper[data-id="${CSS.escape(selectedId)}"]`)?.classList.add('selected');
    }
}

// ── Public setup entry-point ──────────────────────────────────────────────────

export function setupResearchWindow(winEl) {
    const statusEl = winEl.querySelector('.research-status');
    const bodyEl   = winEl.querySelector('.research-body');
    const statsEl  = winEl.querySelector('.research-stats');
    const listEl    = winEl.querySelector('.research-list');
    const searchEl  = winEl.querySelector('.research-search');
    const sortEl    = winEl.querySelector('.research-sort');
    const filtersEl = winEl.querySelector('.research-filters');

    if (!statusEl || !bodyEl) return;

    // Track the currently-selected paper so highlight survives search/sort
    let selectedId = null;
    const papersById = new Map();

    loadData()
        .then(data => {
            data.papers.forEach(p => papersById.set(p.id, p));
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

            // Build type-filter pills from the actual data
            let activeType = 'all';
            const typeCounts = {};
            for (const p of data.papers) {
                const t = p.type ?? '';
                if (t) typeCounts[t] = (typeCounts[t] ?? 0) + 1;
            }
            const typeOrder = ['journal-article','proceedings-article','preprint','book-chapter','dissertation','dataset'];
            const presentTypes = typeOrder.filter(t => typeCounts[t]);

            if (filtersEl && presentTypes.length > 1) {
                const allBtn = `<button class="type-pill active" data-type="all">All <span class="type-pill-count">${data.papers.length}</span></button>`;
                const typeBtns = presentTypes.map(t =>
                    `<button class="type-pill" data-type="${t}">${typeLabel(t)} <span class="type-pill-count">${typeCounts[t]}</span></button>`
                ).join('');
                filtersEl.innerHTML = allBtn + typeBtns;

                filtersEl.addEventListener('click', (e) => {
                    const btn = e.target.closest('.type-pill');
                    if (!btn) return;
                    filtersEl.querySelectorAll('.type-pill').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activeType = btn.dataset.type;
                    applyFilters(listEl, data.papers, searchEl.value, sortEl.value, activeType, selectedId);
                });
            }

            applyFilters(listEl, data.papers, '', 'cited', 'all', selectedId);
            statusEl.style.display = 'none';
            bodyEl.style.display   = 'flex';

            searchEl.addEventListener('input',  () => applyFilters(listEl, data.papers, searchEl.value, sortEl.value, activeType, selectedId));
            sortEl.addEventListener('change',   () => applyFilters(listEl, data.papers, searchEl.value, sortEl.value, activeType, selectedId));

            // ── Voice command API ──────────────────────────────────────────
            window.__ResearchApp = {
                /** Select and open the Nth visible paper (1-based). */
                openPaper(n) {
                    const rows = listEl.querySelectorAll('.research-paper');
                    const row  = rows[n - 1];
                    if (!row) return false;
                    const paper = papersById.get(row.dataset.id);
                    if (!paper) return false;
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    selectedId = paper.id;
                    selectPaper(winEl, paper);
                    return true;
                },
                /** Change sort order. Values: 'cited' | 'date' | 'asc' */
                setSort(value) {
                    if (!sortEl) return;
                    sortEl.value = value;
                    sortEl.dispatchEvent(new Event('change'));
                },
                /** Click a type-filter pill. Value: 'all' | 'journal-article' | etc. */
                setFilter(type) {
                    const pill = filtersEl?.querySelector(`.type-pill[data-type="${type}"]`);
                    if (pill) pill.click();
                },
                /** Set the search input and trigger filtering. */
                search(query) {
                    if (!searchEl) return;
                    searchEl.value = query;
                    searchEl.dispatchEvent(new Event('input'));
                    searchEl.focus();
                },
                /** Return available filter types as a human-readable string. */
                getCategories() {
                    if (!filtersEl) return 'All';
                    return [...filtersEl.querySelectorAll('.type-pill[data-type]')]
                        .map(p => p.dataset.type === 'all' ? 'All' : p.childNodes[0]?.textContent?.trim() ?? p.dataset.type)
                        .join(', ');
                },
                /** Current visible paper count. */
                getPaperCount() {
                    return listEl.querySelectorAll('.research-paper').length;
                },
            };

            // Row selection → load paper into the detail panel
            listEl.addEventListener('click', (e) => {
                const row = e.target.closest('.research-paper');
                if (!row || e.target.closest('a')) return;
                const paper = papersById.get(row.dataset.id);
                if (!paper) return;
                selectedId = paper.id;
                selectPaper(winEl, paper);
            });

            // PDF / Abstract tab switching
            winEl.querySelector('.research-detail-tabs')?.addEventListener('click', (e) => {
                const tab = e.target.closest('.research-tab');
                if (!tab) return;
                winEl._detailView = tab.dataset.view;
                applyDetailView(winEl);
            });

            // PDF zoom controls
            winEl.querySelector('.research-zoom-in') ?.addEventListener('click', (e) => { e.stopPropagation(); setZoom(winEl, +0.2); });
            winEl.querySelector('.research-zoom-out')?.addEventListener('click', (e) => { e.stopPropagation(); setZoom(winEl, -0.2); });

            // Auto-select the first (most-cited) paper so the reader isn't empty
            const firstRow = listEl.querySelector('.research-paper');
            if (firstRow) {
                const first = papersById.get(firstRow.dataset.id);
                if (first) { selectedId = first.id; selectPaper(winEl, first); }
            }

            // Clear the active assistant context when the window is closed
            const observer = new MutationObserver(() => {
                if (!document.contains(winEl)) {
                    ActiveContext.clear();
                    clearTimeout(winEl._pdfBlockedTimer);
                    observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
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
