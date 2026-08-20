/**
 * OnboardingTour
 *
 * A scripted first-visit demo. A fake cursor hovers and clicks each app icon
 * to open it (About, then Research), advancing closes the previous app —
 * except Research, which is kept open to show that the assistant can answer
 * questions about whatever app is in focus. The finale offers to download the
 * private in-browser model once and run a live query end to end.
 *
 * Gated by localStorage['andreos:onboarded'] so it runs once. Call start()
 * (e.g. from Settings) to replay it on demand.
 *
 * All desktop side effects flow through the injected `actions`, so the shell
 * layer stays decoupled from the assistant/windowing internals.
 */
const SEEN_KEY = 'andreos:onboarded';

const LIVE_QUERY = 'open ninth paper, summarize abstract';

const STEPS = [
    {
        kind:  'app',
        icon:  'about',
        app:   'about',
        title: 'Start with About',
        body:  'Watch — it opens the About app so you can read André\u2019s background. Every step drives the real desktop.',
    },
    {
        kind:       'app',
        icon:       'research',
        app:        'research',
        closeBefore: 'about',
        title:      'Then his Research',
        body:       'Same move on the Research app. We\u2019ll leave this one open for the next step.',
    },
    {
        kind:    'context',
        prefill: 'Summarise the research I\u2019m looking at',
        title:   'Ask about what you\u2019re viewing',
        body:    'The assistant sees whichever app is in focus. With Research open you can ask about it directly — and the same works across the other apps, plus it can run actions for you.',
    },
    {
        kind:    'live',
        app:     'research',
        query:   LIVE_QUERY,
        prefill: LIVE_QUERY,
        title:   'See it for real',
        body:    'Run a live query end to end. This downloads the private in-browser model once (nothing leaves your device), then opens the ninth paper and summarises the abstract.',
        cta:     'Run it live',
    },
];

/**
 * Pick where the info card sits relative to the spotlighted target: the first
 * side with room, preferring below → above → right → left, then clamped into
 * the viewport. Pure geometry so it can be checked without a DOM.
 * @param {{left:number,right:number,top:number,bottom:number,width:number,height:number}} r
 * @returns {{top:number,left:number}}
 */
export function placeCard(r, cw, ch, vw, vh, gap = 14, m = 12) {
    const clamp = (v, max) => Math.max(m, Math.min(v, max - m));
    if (vh - r.bottom >= ch + gap + m) {
        return { top: r.bottom + gap, left: clamp(r.left + r.width / 2 - cw / 2, vw - cw) };
    }
    if (r.top >= ch + gap + m) {
        return { top: r.top - gap - ch, left: clamp(r.left + r.width / 2 - cw / 2, vw - cw) };
    }
    if (vw - r.right >= cw + gap + m) {
        return { left: r.right + gap, top: clamp(r.top + r.height / 2 - ch / 2, vh - ch) };
    }
    if (r.left >= cw + gap + m) {
        return { left: r.left - gap - cw, top: clamp(r.top + r.height / 2 - ch / 2, vh - ch) };
    }
    return { top: clamp(r.bottom + gap, vh - ch), left: clamp(r.left + r.width / 2 - cw / 2, vw - cw) };
}

export class OnboardingTour {
    /**
     * @param {{
     *   openApp:          (appType: string) => HTMLElement|null,
     *   closeApp:         (appType: string) => void,
     *   prefillAssistant: (text: string) => HTMLElement|null,
     *   runLiveQuery:     (query: string) => void,
     * }} actions
     */
    constructor(actions = {}) {
        this._actions = actions;
        this._step = 0;
        this._els = null;                       // overlay DOM once active
        this._targetEl = null;                  // element being spotlighted
        this._settle = null;                    // reposition timer after open animations
        this._timers = [];                      // pending scripted-animation timers
        this._busy     = false;
        this._onResize = () => this._position();
        this._onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); this._end(); return; }
            const tag = document.activeElement?.tagName ?? '';
            const editable = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
            if (!editable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this._advance(); }
        };
    }

    /** Run the tour only if the visitor hasn't seen it before. */
    maybeStart() {
        try { if (localStorage.getItem(SEEN_KEY)) return; } catch { /* private mode */ }
        this.start();
    }

    /** Run the tour now, regardless of the seen flag. */
    start() {
        if (this._els) return;                  // already running
        this._step = 0;
        this._build();
        this._render();
        window.addEventListener('resize', this._onResize);
        document.addEventListener('keydown', this._onKey);
    }

    // ── internals ────────────────────────────────────────────────────────────

    _build() {
        const overlay   = document.createElement('div');
        overlay.className = 'tour-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const highlight = document.createElement('div');
        highlight.className = 'tour-highlight';

        const card = document.createElement('div');
        card.className = 'tour-card';
        card.innerHTML = `
            <div class="tour-card-title"></div>
            <div class="tour-card-body"></div>
            <div class="tour-card-footer">
                <div class="tour-dots"></div>
                <div class="tour-actions">
                    <button type="button" class="tour-skip">Skip</button>
                    <button type="button" class="tour-next"></button>
                </div>
            </div>`;

        const cursor = document.createElement('div');
        cursor.className = 'tour-cursor';
        cursor.innerHTML = `
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M5 3l14 8-6 1.6L9.6 19 5 3z" fill="#fff" stroke="rgba(0,0,0,0.55)" stroke-width="1.2" stroke-linejoin="round"/>
            </svg>`;
        // Park the cursor near the bottom-centre before its first move.
        cursor.style.left = `${window.innerWidth / 2}px`;
        cursor.style.top  = `${window.innerHeight - 80}px`;

        overlay.append(highlight, card, cursor);
        document.body.appendChild(overlay);

        card.querySelector('.tour-skip').addEventListener('click', () => this._end());
        card.querySelector('.tour-next').addEventListener('click', () => this._advance());

        this._els = { overlay, highlight, card, cursor };
    }

    _render() {
        const step = STEPS[this._step];
        const { card } = this._els;
        const last = this._step === STEPS.length - 1;

        card.querySelector('.tour-card-title').textContent = step.title;
        card.querySelector('.tour-card-body').textContent  = step.body;
        card.querySelector('.tour-next').textContent = last ? (step.cta || 'Done') : 'Next';
        card.querySelector('.tour-dots').innerHTML = STEPS
            .map((_, i) => `<span class="tour-dot${i === this._step ? ' active' : ''}"></span>`)
            .join('');

        if (step.closeBefore) this._actions.closeApp?.(step.closeBefore);
        this._hideCursor();
        this._setBusy(true);

        if (step.kind === 'app') {
            this._demoOpenApp(step);
        } else {
            // context / live — open the sidebar with the example question drafted.
            this._targetEl = this._actions.prefillAssistant?.(step.prefill) ?? null;
            this._reposition();
            // sidebar.open() schedules input.focus() after 50 ms; wait longer so
            // Next button wins the focus race and the prefilled query can't be
            // accidentally submitted with the same keypress that advanced the tour.
            this._timer(() => this._setBusy(false), 100);
        }
    }

    /** Fake-cursor hover + click on the desktop icon, then open its window. */
    _demoOpenApp(step) {
        const iconEl = document.querySelector(`.desktop-icon[data-file="${step.icon}"]`);
        if (!iconEl) {
            this._targetEl = this._actions.openApp?.(step.app) ?? null;
            this._reposition();
            this._setBusy(false);
            return;
        }
        this._targetEl = iconEl;                // spotlight the icon while the cursor approaches
        this._reposition();
        this._moveCursorTo(iconEl, () => {
            iconEl.classList.add('tour-poke');
            this._clickCursor(iconEl, () => {
                iconEl.classList.remove('tour-poke');
                this._hideCursor();
                this._targetEl = this._actions.openApp?.(step.app) ?? iconEl;
                this._reposition();
                this._setBusy(false);
            });
        });
    }

    // ── fake cursor ────────────────────────────────────────────────────────────

    _moveCursorTo(el, done) {
        const c = this._els.cursor;
        const r = el.getBoundingClientRect();
        c.classList.add('on');
        c.style.left = `${r.left + r.width / 2}px`;
        c.style.top  = `${r.top + r.height / 2}px`;
        this._timer(done, 720);
    }

    _clickCursor(el, done) {
        const c = this._els.cursor;
        c.classList.add('click');
        const r = el.getBoundingClientRect();
        const ripple = document.createElement('div');
        ripple.className = 'tour-ripple';
        ripple.style.left = `${r.left + r.width / 2}px`;
        ripple.style.top  = `${r.top + r.height / 2}px`;
        this._els.overlay.appendChild(ripple);
        this._timer(() => ripple.remove(), 600);
        this._timer(() => { c.classList.remove('click'); done(); }, 340);
    }

    _hideCursor() { this._els?.cursor.classList.remove('on'); }

    _timer(fn, ms) { this._timers.push(setTimeout(fn, ms)); }

    _reposition() {
        this._position();
        clearTimeout(this._settle);
        this._settle = setTimeout(() => this._position(), 560);
    }

    _position() {
        if (!this._els || !this._targetEl?.isConnected) return;
        const r = this._targetEl.getBoundingClientRect();
        const { highlight, card } = this._els;

        const pad = 8;
        highlight.style.left   = `${r.left - pad}px`;
        highlight.style.top    = `${r.top - pad}px`;
        highlight.style.width  = `${r.width + pad * 2}px`;
        highlight.style.height = `${r.height + pad * 2}px`;

        const cw = card.offsetWidth  || 300;
        const ch = card.offsetHeight || 160;
        const { top, left } = placeCard(r, cw, ch, window.innerWidth, window.innerHeight);

        card.style.top  = `${top}px`;
        card.style.left = `${left}px`;
    }

    _setBusy(busy) {
        this._busy = busy;
        if (!this._els) return;
        const btn = this._els.card.querySelector('.tour-next');
        btn.disabled = busy;
        if (!busy) btn.focus();
    }

    _advance() {
        if (this._busy) return;
        if (this._step < STEPS.length - 1) {
            this._step++;
            this._render();
            return;
        }
        // Final step: kick off the live download + query, then close the tour.
        const step = STEPS[this._step];
        if (step.kind === 'live') this._actions.runLiveQuery?.(step.query, step.app);
        this._end();
    }

    _end() {
        this._busy = false;
        try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ }
        clearTimeout(this._settle);
        this._timers.forEach(clearTimeout);
        this._timers = [];
        document.querySelector('.desktop-icon.tour-poke')?.classList.remove('tour-poke');
        window.removeEventListener('resize', this._onResize);
        document.removeEventListener('keydown', this._onKey);
        this._els?.overlay.remove();
        this._els = null;
        this._targetEl = null;
    }
}
