/**
 * VoiceMicButton
 *
 * Self-contained taskbar mic button. Creates its own DOM element and inserts
 * it immediately before a given sibling element (the notification bell by default).
 *
 * Visual states (CSS-driven via data-voice-state attribute):
 *   idle        — dim mic, "click to load"
 *   loading     — pulsing mic, model downloading
 *   ready       — bright mic, "click to speak"
 *   recording   — red mic + animated ripple ring
 *   processing  — spinning mic, transcribing
 *   error       — dim red, unavailable
 */
export class VoiceMicButton {
    /** @param {{ onToggle: () => void }} opts */
    constructor({ onToggle }) {
        this._onToggle = onToggle;
        this._el       = this._createElement();
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /** Insert this button immediately before siblingEl in the DOM. */
    mount(siblingEl) {
        siblingEl?.parentElement?.insertBefore(this._el, siblingEl);
    }

    /**
     * Update the button's visual state.
     * @param {'idle'|'loading'|'ready'|'recording'|'processing'|'error'} state
     */
    setState(state) {
        this._el.dataset.voiceState = state;

        const TITLES = {
            idle:       'Voice Commands — click to load Whisper model',
            loading:    'Voice Commands — loading Whisper model…',
            ready:      'Voice Commands — click mic to speak',
            recording:  'Voice Commands — listening… click to stop',
            processing: 'Voice Commands — processing…',
            error:      'Voice Commands — unavailable',
        };
        this._el.title = TITLES[state] ?? 'Voice Commands';

        // Show ripple ring only while recording
        this._el.querySelector('.voice-mic-ripple').style.display =
            state === 'recording' ? 'block' : 'none';
    }

    // ── Private ────────────────────────────────────────────────────────────────

    _createElement() {
        const el = document.createElement('div');
        el.className          = 'voice-mic-btn';
        el.dataset.voiceState = 'idle';
        el.title              = 'Voice Commands — click to load Whisper model';
        el.setAttribute('role',       'button');
        el.setAttribute('aria-label', 'Voice Commands');

        // Microphone SVG — matches the size of other tray icons
        el.innerHTML = `
            <svg class="voice-mic-icon" viewBox="0 0 24 24" fill="none"
                 xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor"/>
                <path d="M5 11a7 7 0 0 0 14 0"
                      stroke="currentColor" stroke-width="1.8"
                      stroke-linecap="round" fill="none"/>
                <line x1="12" y1="18" x2="12" y2="22"
                      stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <line x1="8"  y1="22" x2="16" y2="22"
                      stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            <span class="voice-mic-ripple" style="display:none" aria-hidden="true"></span>
        `;

        el.addEventListener('click', () => this._onToggle());
        return el;
    }
}
