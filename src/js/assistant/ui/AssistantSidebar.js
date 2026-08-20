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
const MIC_SVG = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.6"/>
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="12" y1="17.5" x2="12" y2="21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`;
const STOP_SVG = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/>
    </svg>`;
const BOT_ICON = `<img src="${new URL('../../../../assets/icons/sakura.svg', import.meta.url).href}" alt="" width="46" height="46">`;

export class AssistantSidebar {
    /**
     * @param {{
     *   onSubmit:    (text: string) => void,
     *   onMicToggle: () => void,
     *   onRetry?:    (text: string, update: (partial: string) => void) => void,
     * }} opts
     */
    constructor({ onSubmit, onMicToggle, onRetry }) {
        this._onSubmit    = onSubmit;
        this._onMicToggle = onMicToggle;
        this._onRetry     = onRetry;
        this._panel       = document.getElementById('assistantSidebar');
        this._messages    = document.getElementById('asstMessages');
        this._input       = null;
        this._micBtn      = null;
        this._sendBtn     = null;
        this._isOpen      = false;
        this._activeTab   = 'assistant';
        this._streaming   = false;
        this._lastUserText = '';
        this._setup();
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    open(tab) {
        if (tab) this.showTab(tab);
        this._panel?.classList.add('asst-open');
        this._isOpen = true;
        if (this._activeTab === 'assistant') {
            // preventScroll: focusing must not scroll the (off-screen) desktop into view
            setTimeout(() => this._input?.focus({ preventScroll: true }), 50);
        }
    }

    close() {
        this._panel?.classList.remove('asst-open');
        this._isOpen = false;
    }

    /**
     * Toggle the sidebar. With a tab: open to it if closed, switch to it if open
     * on another tab, or close if it's already the active tab.
     */
    toggle(tab = 'assistant') {
        if (!this._isOpen) { this.open(tab); return; }
        if (this._activeTab === tab) { this.close(); return; }
        this.showTab(tab);
    }

    get isOpen() { return this._isOpen; }

    get activeTab() { return this._activeTab; }

    /** Switch the visible tab pane. */
    showTab(tab) {
        if (tab !== 'assistant' && tab !== 'notifications') return;
        this._activeTab = tab;
        this._panel?.setAttribute('data-tab', tab);
        this._tabs?.forEach(btn => btn.classList.toggle('asst-tab-active', btn.dataset.asstTab === tab));
        this._panes?.forEach(p => { p.hidden = p.dataset.asstPane !== tab; });
        if (tab === 'notifications') {
            // Viewing notifications clears the unread indicator.
            document.dispatchEvent(new CustomEvent('andreos:notifications-viewed'));
        } else if (this._isOpen) {
            setTimeout(() => this._input?.focus({ preventScroll: true }), 30);
        }
    }

    /** Remove the current streaming bubble if it was never filled (e.g. a
     *  "thinking" placeholder that's being replaced by a plan). */
    discardStream() {
        this._activeStreamBubble?.remove();
        this._activeStreamBubble = null;
    }

    /** Clear all messages and restore the welcome placeholder. */
    clear() {
        if (!this._messages) return;
        this._messages.innerHTML = `
            <div class="asst-welcome">
                <div class="asst-welcome-icon">${BOT_ICON}</div>
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
        if (role === 'user') {
            this._lastUserText = text;
            const row = document.createElement('div');
            row.className = 'asst-user-row';
            row.appendChild(bubble);
            this._attachRetry(row, text);
            this._messages?.appendChild(row);
        } else {
            bubble._answerText = text; // clean text for retry/history
            this._messages?.appendChild(bubble);
        }
        this._scroll();
        return bubble;
    }

    /**
     * Add an always-visible retry control below a user question. Retrying drops
     * every message after this question (its answer and any later turns) and
     * rebuilds the assistant's memory from what remains, since we're rewinding
     * the conversation to this point, then regenerates the answer.
     */
    _attachRetry(row, userText) {
        if (!userText || !this._onRetry) return;
        const btn = document.createElement('button');
        btn.className = 'asst-retry';
        btn.title = 'Retry';
        btn.setAttribute('aria-label', 'Retry this question');
        btn.textContent = '↻';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._streaming) return;

            // Remove everything after this question (its answer + later turns).
            let node = row.nextElementSibling;
            while (node) { const n = node.nextElementSibling; node.remove(); node = n; }

            // Rebuild memory from the surviving transcript (ends at this question).
            const history = [];
            this._messages?.querySelectorAll('.asst-bubble').forEach((b) => {
                const r = b.classList.contains('asst-bubble-user') ? 'user'
                    : b.classList.contains('asst-bubble-assistant') ? 'assistant' : null;
                if (r) history.push({ role: r, content: (b._answerText ?? b.textContent ?? '').trim() });
            });

            const update = this.startStreamMessage('assistant');
            this._onRetry(userText, update, history);
        });
        row.appendChild(btn);
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
        const bubble = this.appendMessage(role, '');
        this._timedBubble = bubble; // stamped with its inference runtime on generation-end
        this._activeStreamBubble = bubble; // tracked so an unused "thinking" bubble can be discarded

        // One-line working status (e.g. "Generating response…") shown before the
        // first token; removed automatically once real content streams in.
        const status = document.createElement('div');
        status.className = 'asst-status';
        status.style.display = 'none';
        const think = document.createElement('details');
        think.className = 'asst-think';
        think.style.display = 'none';
        think.innerHTML = '<summary>💭 Reasoning</summary><div class="asst-think-body"></div>';
        const answer = document.createElement('div');
        answer.className = 'asst-answer';
        answer.textContent = '▋';
        bubble.append(status, think, answer);
        const thinkBody = think.querySelector('.asst-think-body');

        const update = (text) => {
            const { reasoning, answer: ans } = this._splitThink(text || '');
            if (ans.trim() || reasoning.trim()) status.style.display = 'none'; // tokens arrived
            if (reasoning.trim()) {
                think.style.display = '';
                thinkBody.textContent = reasoning;
                think.open = !ans; // expanded while thinking, collapsed once answering
            } else {
                think.style.display = 'none';
            }
            answer.textContent = ans;
            bubble._answerText = ans; // clean answer for retry/history
            this._scroll();
        };
        // Set the working-status line in place; a falsy label hides it.
        update.setStatus = (label) => {
            if (!label) { status.style.display = 'none'; return; }
            status.style.display = '';
            status.innerHTML = '<span class="asst-status-spinner"></span><span class="asst-status-label"></span>';
            status.querySelector('.asst-status-label').textContent = label;
            answer.textContent = ''; // hide the bare cursor while the status shows
            this._scroll();
        };
        return update;
    }

    /** Split a Qwen-style `<think>…</think>` reasoning block from the answer. */
    _splitThink(text) {
        const open = text.indexOf('<think>');
        if (open === -1) return { reasoning: '', answer: text };
        const close = text.indexOf('</think>', open);
        if (close === -1) return { reasoning: text.slice(open + 7), answer: '' };
        const reasoning = text.slice(open + 7, close);
        const answer = (text.slice(0, open) + text.slice(close + 8)).trim();
        return { reasoning, answer };
    }

    /** Append a small "took N ms/s" runtime tag under the timed reply. */
    _stampTiming() {
        if (this._genStart != null) {
            // Command/plan runs discard the streaming bubble, so fall back to the
            // last assistant reply (e.g. the "✓ Done" bubble) — a command still took time.
            let target = this._timedBubble;
            if (!target || !target.isConnected) {
                const bubbles = this._messages?.querySelectorAll('.asst-bubble-assistant');
                target = bubbles?.length ? bubbles[bubbles.length - 1] : null;
            }
            if (target) {
                const ms = performance.now() - this._genStart;
                const tag = document.createElement('div');
                tag.className = 'asst-meta';
                tag.textContent = ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
                target.appendChild(tag);
                this._scroll();
            }
        }
        this._timedBubble = null;
        this._genStart = null;
    }

    /**
     * Render a plan as a live checklist block, distinct from chat bubbles.
     * Each step starts pending (○); the returned controller flips steps to a
     * spinner while running, then ✓ (done), ✗ (failed) or ⊘ (skipped).
     * @param {string[]} steps human-readable step descriptions
     * @returns {{ setActive:(i:number)=>void, setDone:(i:number)=>void,
     *            setFailed:(i:number)=>void, setSkipped:(i:number)=>void }}
     */
    startPlan(steps = []) {
        this._messages?.querySelector('.asst-welcome')?.remove();

        const block = document.createElement('div');
        block.className = 'asst-plan';

        const header = document.createElement('div');
        header.className = 'asst-plan-header';
        header.innerHTML = '<span class="asst-plan-title">📋 Plan</span>';
        block.appendChild(header);

        const list = document.createElement('ol');
        list.className = 'asst-plan-list';

        const items = steps.map(text => {
            const li = document.createElement('li');
            li.className = 'asst-plan-step';
            li.dataset.status = 'pending';

            const marker = document.createElement('span');
            marker.className = 'asst-plan-marker';
            marker.textContent = '○';

            const label = document.createElement('span');
            label.className = 'asst-plan-label';
            label.textContent = text;

            li.append(marker, label);
            list.appendChild(li);
            return { li, marker };
        });

        block.appendChild(list);
        this._messages?.appendChild(block);
        this._scroll();

        const set = (i, status, markerHtml) => {
            const it = items[i];
            if (!it) return;
            it.li.dataset.status = status;
            it.marker.innerHTML = markerHtml;
            this._scroll();
        };

        return {
            setActive:  (i) => set(i, 'active',  '<span class="asst-plan-spinner"></span>'),
            setDone:    (i) => set(i, 'done',    '✓'),
            setFailed:  (i) => set(i, 'failed',  '✗'),
            setSkipped: (i) => set(i, 'skipped', '⊘'),
        };
    }

    /**
     * Reflect the current voice-engine state on the mic button.
     * @param {'idle'|'loading'|'ready'|'recording'|'processing'|'error'} state
     */
    setMicState(state) {
        if (!this._micBtn) return;
        this._micBtn.dataset.micState = state;

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
                // Animated "thinking" dots instead of a static icon
                iconEl.innerHTML = '<span class="asst-mic-dots"><i></i><i></i><i></i></span>';
            } else if (state === 'recording') {
                iconEl.innerHTML = STOP_SVG;
            } else {
                iconEl.innerHTML = MIC_SVG;
            }
        }
        this._micBtn.title = TITLES[state] ?? 'Voice input';

        // Swap the text field for an inline status while loading the model or
        // recording, so the user knows to wait / that we're listening.
        const busy = state === 'recording' || state === 'loading';
        if (this._listeningEl) {
            this._listeningEl.hidden = !busy;
            this._listeningEl.dataset.state = state;
            const textEl = this._listeningEl.querySelector('.asst-listening-text');
            if (textEl) {
                textEl.textContent = state === 'loading' ? 'Preparing model…' : 'Listening…';
            }
        }
        if (this._input) {
            this._input.style.display = busy ? 'none' : '';
            // Disable text input while the two channels could clash
            this._input.disabled = busy || state === 'processing';
        }
    }

    // ── Private ────────────────────────────────────────────────────────────────

    _setup() {
        if (!this._panel) return;
        this._input  = this._panel.querySelector('.asst-input');
        this._micBtn = this._panel.querySelector('.asst-mic-btn');
        this._inputRow = this._panel.querySelector('.asst-input-row');
        if (this._inputRow && !this._inputRow.querySelector('.asst-ring')) {
            // Compositor-animated status ring; toggled via [data-busy] in CSS.
            const ring = document.createElement('div');
            ring.className = 'asst-ring';
            ring.setAttribute('aria-hidden', 'true');
            ring.innerHTML = '<div class="asst-ring-spin"></div>';
            this._inputRow.prepend(ring);
        }
        this._listeningEl = this._panel.querySelector('.asst-listening');
        this._tabs   = Array.from(this._panel.querySelectorAll('.asst-tab'));
        this._panes  = Array.from(this._panel.querySelectorAll('.asst-pane'));
        const sendBtn  = this._panel.querySelector('.asst-send-btn');
        const closeBtn = this._panel.querySelector('.asst-close');
        const clearBtn = this._panel.querySelector('.asst-clear');
        this._sendBtn = sendBtn;

        this._tabs.forEach(btn => btn.addEventListener('click', e => {
            e.stopPropagation();
            this.showTab(btn.dataset.asstTab);
        }));

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
            if (this._streaming) window.OSAssistant?.stopGeneration?.();
            else submit();
        });
        this._micBtn?.addEventListener('click', e => { e.stopPropagation(); this._onMicToggle(); });
        closeBtn?.addEventListener('click',  () => this.close());
        // Clear aborts any in-flight generation first, then wipes the transcript.
        clearBtn?.addEventListener('click',  e => {
            e.stopPropagation();
            window.OSAssistant?.stopGeneration?.();
            this.clear();
            this._input?.focus();
        });

        // Reflect generation lifecycle on the send/stop button, and time answers.
        document.addEventListener('andreos:generation-start', () => { this._genStart = performance.now(); this._setStreaming(true); });
        document.addEventListener('andreos:generation-end',   () => { this._stampTiming(); this._setStreaming(false); });

        // Keep _isOpen in sync if an external caller removes the class directly
        new MutationObserver(() => {
            this._isOpen = this._panel.classList.contains('asst-open');
        }).observe(this._panel, { attributes: true, attributeFilter: ['class'] });
    }

    /**
     * Flow-animate the composer border, VSCode-Copilot style.
     * @param {'working'|'waiting'|null} state blue while replying, amber while
     *        awaiting confirmation, off when idle.
     */
    setComposerState(state) {
        if (!this._inputRow) return;
        if (state === 'working' || state === 'waiting') this._inputRow.dataset.busy = state;
        else delete this._inputRow.dataset.busy;
    }

    /** Toggle the send button between ↑ (send) and ■ (stop generating). */
    _setStreaming(on) {
        this._streaming = on;
        this._messages?.classList.toggle('asst-streaming', on);
        this.setComposerState(on ? 'working' : null);
        if (!this._sendBtn) return;
        this._sendBtn.classList.toggle('asst-send-stop', on);
        this._sendBtn.textContent = on ? '■' : '↑';
        this._sendBtn.title = on ? 'Stop generating' : 'Send';
    }

    _scroll() {
        if (this._messages) this._messages.scrollTop = this._messages.scrollHeight;
    }
}
