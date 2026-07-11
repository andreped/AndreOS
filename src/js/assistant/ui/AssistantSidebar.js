/**
 * AssistantSidebar
 *
 * A right-side slide-in panel that combines a streaming chat interface with
 * a mic button for voice input. Text submissions and voice transcripts both
 * flow through VoiceCommandManager — OS commands are executed, everything
 * else is answered by the LLM inline.
 *
 * Hidden on mobile (≤768 px) via CSS — voice commands are available there
 * through the taskbar mic button instead.
 */
export class AssistantSidebar {
    /**
     * @param {{
     *   onSubmit:    (text: string) => void,
     *   onMicToggle: () => void,
     * }} opts
     */
    constructor({ onSubmit, onMicToggle }) {
        this._onSubmit    = onSubmit;
        this._onMicToggle = onMicToggle;
        this._panel       = document.getElementById('assistantSidebar');
        this._messages    = document.getElementById('asstMessages');
        this._input       = null;
        this._micBtn      = null;
        this._sendBtn     = null;
        this._isOpen      = false;
        this._streaming   = false;
        this._setup();
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    open() {
        // Only one panel open at a time
        document.getElementById('notificationCenter')?.classList.remove('nc-open');
        this._panel?.classList.add('asst-open');
        this._isOpen = true;
        // preventScroll: focusing must not scroll the (off-screen) desktop into view
        setTimeout(() => this._input?.focus({ preventScroll: true }), 50);
    }

    close() {
        this._panel?.classList.remove('asst-open');
        this._isOpen = false;
    }

    toggle() { this._isOpen ? this.close() : this.open(); }

    get isOpen() { return this._isOpen; }

    /** Clear all messages and restore the welcome placeholder. */
    clear() {
        if (!this._messages) return;
        this._messages.innerHTML = `
            <div class="asst-welcome">
                <div class="asst-welcome-icon">🤖</div>
                <div class="asst-welcome-text">Ask me anything about André, or give a command — open an app, search the web, and more.</div>
                <div class="asst-welcome-hint">Try: "open resume" · "tell me about André's research"</div>
            </div>`;
    }

    /**
     * Append a finished message bubble.
     * @param {'user'|'assistant'|'system'} role
     * @param {string} text
     * @returns {HTMLElement} the bubble element
     */
    appendMessage(role, text = '') {
        this._messages?.querySelector('.asst-welcome')?.remove();
        const bubble = document.createElement('div');
        bubble.className = `asst-bubble asst-bubble-${role}`;
        bubble.textContent = text;
        this._messages?.appendChild(bubble);
        this._scroll();
        return bubble;
    }

    /**
     * Create an empty streaming bubble and return a function to update it
     * as tokens arrive. Caller should call the returned function with the
     * full accumulated text on each chunk, then once more with the final
     * text on completion.
     * @param {'assistant'} role
     * @returns {(text: string) => void}
     */
    startStreamMessage(role = 'assistant') {
        const bubble = this.appendMessage(role, '▋');
        return (text) => {
            bubble.textContent = text || '';
            this._scroll();
        };
    }

    /**
     * Reflect the current voice-engine state on the mic button.
     * @param {'idle'|'loading'|'ready'|'recording'|'processing'|'error'} state
     */
    setMicState(state) {
        if (!this._micBtn) return;
        this._micBtn.dataset.micState = state;

        const ICONS = {
            idle:       '🎤',
            loading:    '⏳',
            ready:      '🎤',
            recording:  '⏹',
            processing: '⚙️',
            error:      '🚫',
        };
        const TITLES = {
            idle:       'Click to load voice model',
            loading:    'Loading Whisper model…',
            ready:      'Click to speak',
            recording:  'Listening… click to stop',
            processing: 'Transcribing…',
            error:      'Voice unavailable',
        };

        const iconEl = this._micBtn.querySelector('.asst-mic-icon');
        if (iconEl) {
            if (state === 'processing') {
                // Animated "thinking" dots instead of a static gear
                iconEl.innerHTML = '<span class="asst-mic-dots"><i></i><i></i><i></i></span>';
            } else {
                iconEl.textContent = ICONS[state] ?? '🎤';
            }
        }
        this._micBtn.title = TITLES[state] ?? 'Voice input';

        // Disable text input while recording so the two channels don't clash
        if (this._input) {
            this._input.disabled = state === 'recording' || state === 'processing';
        }
    }

    // ── Private ────────────────────────────────────────────────────────────────

    _setup() {
        if (!this._panel) return;
        this._input  = this._panel.querySelector('.asst-input');
        this._micBtn = this._panel.querySelector('.asst-mic-btn');
        const sendBtn  = this._panel.querySelector('.asst-send-btn');
        const closeBtn = this._panel.querySelector('.asst-close');
        const clearBtn = this._panel.querySelector('.asst-clear');
        this._sendBtn = sendBtn;

        const submit = () => {
            const text = this._input?.value?.trim();
            if (!text) return;
            this._input.value = '';
            this._onSubmit(text);
        };

        this._input?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
        });
        this._input?.addEventListener('click',     e => e.stopPropagation());
        this._input?.addEventListener('mousedown', e => e.stopPropagation());
        // While a response is streaming the send button becomes a stop button.
        sendBtn?.addEventListener('click',  e => {
            e.stopPropagation();
            if (this._streaming) window.AndreChat?.stopGeneration?.();
            else submit();
        });
        this._micBtn?.addEventListener('click', e => { e.stopPropagation(); this._onMicToggle(); });
        closeBtn?.addEventListener('click',  () => this.close());
        // Clear aborts any in-flight generation first, then wipes the transcript.
        clearBtn?.addEventListener('click',  e => {
            e.stopPropagation();
            window.AndreChat?.stopGeneration?.();
            this.clear();
            this._input?.focus();
        });

        // Reflect generation lifecycle on the send/stop button.
        document.addEventListener('andreos:generation-start', () => this._setStreaming(true));
        document.addEventListener('andreos:generation-end',   () => this._setStreaming(false));

        // Keep _isOpen in sync if an external caller removes the class directly
        new MutationObserver(() => {
            this._isOpen = this._panel.classList.contains('asst-open');
        }).observe(this._panel, { attributes: true, attributeFilter: ['class'] });
    }

    /** Toggle the send button between ↑ (send) and ■ (stop generating). */
    _setStreaming(on) {
        this._streaming = on;
        if (!this._sendBtn) return;
        this._sendBtn.classList.toggle('asst-send-stop', on);
        this._sendBtn.textContent = on ? '■' : '↑';
        this._sendBtn.title = on ? 'Stop generating' : 'Send';
    }

    _scroll() {
        if (this._messages) this._messages.scrollTop = this._messages.scrollHeight;
    }
}
