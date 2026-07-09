/**
 * SearchOverlay
 *
 * Renders a live search dropdown below the taskbar search box.
 * Indexes all apps and key content sections; opens the matching
 * window when a result is selected.
 *
 * App entries come from the App Registry (the single source of truth); the
 * content entries below are curated sub-sections within those apps.
 */
import { appRegistry } from '../../apps/registry/AppRegistry.js';

/** App-level search entries, built from the registry at query time. */
function appSearchEntries() {
    return appRegistry.searchable().map(m => ({
        type: 'app', fileType: m.id,
        icon:  m.search?.icon ?? m.icon,
        label: m.title,
        subtitle: m.search?.subtitle ?? '',
        keywords: m.search?.keywords ?? '',
    }));
}

const CONTENT_INDEX = [
    // ── Content — About ───────────────────────────────────────────────────
    { type: 'content', fileType: 'about', icon: '🏥', label: 'Healthcare AI',       subtitle: 'AI-augmented software for Norwegian hospitals at DIPS AS',        keywords: 'healthcare hospital ai norway dips oslo clinical' },
    { type: 'content', fileType: 'about', icon: '🎓', label: 'PhD & Publications',  subtitle: '30+ peer-reviewed papers, 500+ citations, h-index 15',            keywords: 'phd publications research papers citations scholar ntnu' },
    { type: 'content', fileType: 'about', icon: '🧬', label: 'Computational Pathology', subtitle: 'Deep learning for medical imaging and digital pathology',      keywords: 'pathology deep learning medical imaging segmentation classification' },

    // ── Content — Resume ──────────────────────────────────────────────────
    { type: 'content', fileType: 'resume', icon: '🧠', label: 'Senior AI Engineer',      subtitle: 'DIPS AS, Oslo — Pasientsamtale, DIPS AI cloud platform',     keywords: 'senior ai engineer dips oslo current job pasientsamtale' },
    { type: 'content', fileType: 'resume', icon: '💼', label: 'Sopra Steria',             subtitle: 'ML Engineer — Equinor chatbot, LLMs, Oct 2023–May 2025',     keywords: 'sopra steria equinor chatbot llm machine learning trondheim' },
    { type: 'content', fileType: 'resume', icon: '🔬', label: 'SINTEF Research Scientist', subtitle: 'FastPathology, Raidionics, gradient-accumulator, torchstain', keywords: 'sintef research scientist fastpathology raidionics open source' },
    { type: 'content', fileType: 'resume', icon: '🎓', label: 'PhD — NTNU',               subtitle: 'Medical Technology, AI for Computational Pathology, 2019–2023', keywords: 'phd ntnu trondheim medical technology 2023 degree' },
    { type: 'content', fileType: 'resume', icon: '🎓', label: 'MSc — UiT',                subtitle: 'Applied Physics & Mathematics, ML & Statistics, 2014–2019',  keywords: 'msc uit tromsø physics mathematics machine learning statistics' },
    { type: 'content', fileType: 'resume', icon: '☁️', label: 'Azure Certifications',     subtitle: 'AI Engineer, Data Scientist, Data Fundamentals — Microsoft',  keywords: 'azure certification microsoft cloud engineer scientist' },
    { type: 'content', fileType: 'resume', icon: '📚', label: 'Teaching & Supervision',   subtitle: 'Supervised 5 MSc students; TA for UiT physics courses',       keywords: 'teaching supervision ntnu msc ta university assistant' },

    // ── Content — Projects ────────────────────────────────────────────────
    { type: 'content', fileType: 'projects', icon: '🏥', label: 'DIPS KI',              subtitle: 'Cloud AI platform live in two Norwegian health regions',         keywords: 'dips ki cloud platform health regions production live' },
    { type: 'content', fileType: 'projects', icon: '🔬', label: 'FastPathology',         subtitle: 'Open-source C++/Qt5 deep learning platform for digital pathology', keywords: 'fastpathology c++ qt5 open source pathology deep learning' },
    { type: 'content', fileType: 'projects', icon: '🧠', label: 'Raidionics',            subtitle: 'Clinical software for automatic brain tumour segmentation',       keywords: 'raidionics brain tumour segmentation clinical devops' },
    { type: 'content', fileType: 'projects', icon: '📦', label: 'gradient-accumulator', subtitle: 'Python/TensorFlow library for gradient accumulation',             keywords: 'gradient accumulator python tensorflow library pypi' },
    { type: 'content', fileType: 'projects', icon: '🎨', label: 'torchstain',            subtitle: 'Stain normalisation library for PyTorch/TF/NumPy',               keywords: 'torchstain stain normalisation pytorch tensorflow numpy' },
];

export class SearchOverlay {
    /**
     * @param {(fileType: string) => void} openFileCb
     */
    constructor(openFileCb) {
        this._openFileCb = openFileCb;
        this._activeIdx  = -1;
        this._results    = [];
        this._dropdown   = null;
        this._input      = null;
        this._searchBox  = null;
        this._build();
    }

    // ── Setup ─────────────────────────────────────────────────────────────

    _build() {
        this._searchBox = document.querySelector('.search-box');
        if (!this._searchBox) return;

        this._input = this._searchBox.querySelector('.search-input');

        // Desktop dropdown — anchored above the taskbar search box
        const dd = document.createElement('div');
        dd.className = 'search-results-dropdown';
        dd.setAttribute('role', 'listbox');
        document.body.appendChild(dd);
        this._dropdown = dd;

        // Mobile spotlight overlay — a free-floating card centred on screen
        const spotlight = document.createElement('div');
        spotlight.className = 'mobile-spotlight';
        spotlight.innerHTML = `
            <div class="mobile-spotlight-card">
                <div class="mobile-spotlight-bar">
                    <span class="mobile-spotlight-icon">🔍</span>
                    <input class="mobile-spotlight-input" type="search"
                           placeholder="Search…" autocomplete="off" spellcheck="false">
                    <button class="mobile-spotlight-close">✕</button>
                </div>
                <div class="mobile-spotlight-results"></div>
            </div>
        `;
        document.body.appendChild(spotlight);
        this._spotlight        = spotlight;
        this._spotlightInput   = spotlight.querySelector('.mobile-spotlight-input');
        this._spotlightResults = spotlight.querySelector('.mobile-spotlight-results');

        this._wireEvents();
    }

    _wireEvents() {
        const { _input: input, _searchBox: box } = this;
        if (!input) return;

        // ── Desktop events (focus-driven) ──────────────────────────────────
        input.addEventListener('focus', () => box.classList.add('focused'));
        input.addEventListener('blur',  () => {
            box.classList.remove('focused');
            setTimeout(() => this._hide(), 150);
        });

        input.addEventListener('input', (e) => {
            const q = e.target.value.trim();
            if (!q) { this._hide(); return; }
            this._results   = this._search(q.toLowerCase());
            this._activeIdx = -1;
            this._render();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown')  { e.preventDefault(); this._moveFocus(1);  return; }
            if (e.key === 'ArrowUp')    { e.preventDefault(); this._moveFocus(-1); return; }
            if (e.key === 'Enter')      { e.preventDefault(); this._selectActive(); return; }
            if (e.key === 'Escape')     { this._hide(); input.value = ''; input.blur(); }
        });

        // ── Mobile spotlight events ────────────────────────────────────────
        // Tapping the search icon opens the spotlight overlay (not the taskbar input)
        box.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                this._openSpotlight();
            } else if (document.activeElement !== input) {
                input.focus();
            }
        });

        const si = this._spotlightInput;
        si.addEventListener('input', (e) => {
            const q = e.target.value.trim();
            this._results   = q ? this._search(q.toLowerCase()) : [];
            this._activeIdx = -1;
            this._renderSpotlight();
        });
        si.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { this._closeSpotlight(); }
            if (e.key === 'Enter')  { this._selectActive(); }
        });

        this._spotlight.addEventListener('mousedown', (e) => {
            // Close when tapping the backdrop (outside the card)
            if (e.target === this._spotlight) this._closeSpotlight();
        });
        this._spotlight.querySelector('.mobile-spotlight-close')
            .addEventListener('click', () => this._closeSpotlight());

        document.addEventListener('click', (e) => {
            if (!this._searchBox.contains(e.target) && !this._dropdown.contains(e.target)) {
                this._hide();
            }
        });
    }

    // ── Search ────────────────────────────────────────────────────────────

    _search(query) {
        const index   = [...appSearchEntries(), ...CONTENT_INDEX];
        const static_ = index.filter(({ label, subtitle, keywords }) =>
            `${label} ${subtitle} ${keywords}`.toLowerCase().includes(query)
        );
        const papers = window.AndreChat?.searchPapers(query) ?? [];
        return [...static_, ...papers];
    }

    // ── Render ────────────────────────────────────────────────────────────

    _render() {
        if (!this._dropdown) return;

        const rect    = this._searchBox.getBoundingClientRect();
        const isMobile = window.innerWidth <= 768 && this._searchBox.classList.contains('focused');

        if (isMobile) {
            // Spotlight mode: dropdown floats below the centred card
            const cardWidth = Math.min(window.innerWidth * 0.92, 400);
            this._dropdown.style.top    = (rect.bottom + 8) + 'px';
            this._dropdown.style.left   = '50%';
            this._dropdown.style.width  = cardWidth + 'px';
            this._dropdown.style.bottom = 'auto';
        } else {
            // Desktop: dropdown anchored above the taskbar search box
            this._dropdown.style.left   = rect.left + 'px';
            this._dropdown.style.width  = Math.max(rect.width, 320) + 'px';
            this._dropdown.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
            this._dropdown.style.top    = 'auto';
        }

        if (this._results.length === 0) {
            this._dropdown.innerHTML =
                `<div class="search-no-results">No results for "<em>${this._escHtml(this._input.value)}</em>"</div>`;
            this._dropdown.classList.add('open');
            return;
        }

        const apps    = this._results.filter(r => r.type === 'app');
        const content = this._results.filter(r => r.type === 'content');
        const papers  = this._results.filter(r => r.type === 'paper');
        let flatIdx = 0;
        let html = '';

        if (apps.length) {
            html += `<div class="search-group-label">Apps</div>`;
            apps.forEach(r => { html += this._itemHtml(r, flatIdx++); });
        }
        if (content.length) {
            html += `<div class="search-group-label">Content</div>`;
            content.forEach(r => { html += this._itemHtml(r, flatIdx++); });
        }
        if (papers.length) {
            html += `<div class="search-group-label">Publications</div>`;
            papers.forEach(r => { html += this._itemHtml(r, flatIdx++); });
        }

        this._dropdown.innerHTML = html;
        this._dropdown.classList.add('open');

        this._dropdown.querySelectorAll('.search-result-item').forEach((el) => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this._openResult(this._results[Number(el.dataset.idx)]);
            });
            el.addEventListener('mouseenter', () => {
                this._activeIdx = Number(el.dataset.idx);
                this._highlightActive();
            });
        });
    }

    _itemHtml(item, idx) {
        const appTag = item.type === 'content'
            ? `<span class="search-result-app-tag">${item.fileType}</span>`
            : '';
        return `
            <div class="search-result-item" role="option" data-idx="${idx}">
                <span class="search-result-icon">${item.icon}</span>
                <div class="search-result-text">
                    <div class="search-result-label-row">
                        <span class="search-result-label">${this._escHtml(item.label)}</span>
                        ${appTag}
                    </div>
                    <span class="search-result-subtitle">${this._escHtml(item.subtitle)}</span>
                </div>
            </div>`;
    }

    // ── Navigation ────────────────────────────────────────────────────────

    _moveFocus(dir) {
        if (!this._isOpen() || this._results.length === 0) return;
        this._activeIdx = Math.max(0, Math.min(this._results.length - 1, this._activeIdx + dir));
        this._highlightActive();
    }

    _highlightActive() {
        this._dropdown.querySelectorAll('.search-result-item').forEach((el) => {
            el.classList.toggle('active', Number(el.dataset.idx) === this._activeIdx);
        });
        this._dropdown.querySelector('.search-result-item.active')?.scrollIntoView({ block: 'nearest' });
    }

    _selectActive() {
        const result = this._activeIdx >= 0 ? this._results[this._activeIdx] : this._results[0];
        if (result) this._openResult(result);
    }

    _openResult(item) {
        if (!item) return;
        this._openFileCb(item.fileType);
        this._hide();
        this._closeSpotlight();
        if (this._input) { this._input.value = ''; this._input.blur(); }
    }

    // ── Mobile spotlight ──────────────────────────────────────────────────

    _openSpotlight() {
        this._spotlight.classList.add('open');
        this._results = [];
        this._spotlightResults.innerHTML = '';
        setTimeout(() => this._spotlightInput.focus(), 50);
    }

    _closeSpotlight() {
        this._spotlight.classList.remove('open');
        this._spotlightInput.value = '';
        this._spotlightResults.innerHTML = '';
        this._results = [];
    }

    _renderSpotlight() {
        const el = this._spotlightResults;
        if (!this._results.length) {
            el.innerHTML = `<div class="search-no-results">No results for "<em>${this._escHtml(this._spotlightInput.value)}</em>"</div>`;
            return;
        }
        const apps    = this._results.filter(r => r.type === 'app');
        const content = this._results.filter(r => r.type === 'content');
        const papers  = this._results.filter(r => r.type === 'paper');
        let flat = 0, html = '';
        if (apps.length)    { html += `<div class="search-group-label">Apps</div>`;         apps.forEach(r => { html += this._itemHtml(r, flat++); }); }
        if (content.length) { html += `<div class="search-group-label">Content</div>`;      content.forEach(r => { html += this._itemHtml(r, flat++); }); }
        if (papers.length)  { html += `<div class="search-group-label">Publications</div>`; papers.forEach(r => { html += this._itemHtml(r, flat++); }); }
        el.innerHTML = html;
        el.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this._openResult(this._results[Number(item.dataset.idx)]);
            });
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    _hide()   { this._dropdown?.classList.remove('open'); }
    _isOpen() { return this._dropdown?.classList.contains('open') ?? false; }

    _escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
