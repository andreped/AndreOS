/**
 * VoiceCommandManager
 *
 * Owns the command registry, intent parsing, and action dispatch.
 * Uses VoiceEngine for recording/transcription and NotificationManager
 * for user feedback. Knows nothing about rendering — that lives in
 * VoiceMicButton.
 *
 * State machine:
 *   idle → loading → ready ⇄ recording → processing → ready
 *                         ↘ error
 *
 * Usage:
 *   const vcm = new VoiceCommandManager({ windowManager, notifications, onStateChange });
 *   await vcm.toggleRecording();   // first call loads the model; subsequent calls toggle mic
 */
import { VoiceEngine }       from './VoiceEngine.js';
import { isVoiceAIEnabled, getWhisperModel, getTranscribeLang } from '../../platform/services/Settings.js';
import { appRegistry }       from '../../apps/registry/AppRegistry.js';
import { assistantRegistry } from '../registry/AssistantRegistry.js';

// Notification-column mic icon — matches the sidebar's transcription mic.
const MIC_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.6"/>
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="12" y1="17.5" x2="12" y2="21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;
import { ActionDispatcher }  from '../registry/ActionDispatcher.js';
import { resolveResearchIntent } from '../researchContext.js';

/**
 * OS-level voice commands (window management + help).
 * App-open commands are generated from the App Registry at match time
 * (see `_parse()`), so adding a new app never touches this file.
 *
 * @type {Array<{ intent: string, args?: Record<string,string>, keywords: string[] }>}
 */
const COMMAND_REGISTRY = [
    // ── App-open commands come from the App Registry (see _parse) ──
    // ── Window management ──────────────────────────────────────────────────────
    {
        intent: 'close',
        keywords: [
            'close window', 'close this', 'close app', 'shut down',
            'lukk vinduet', 'lukk appen', 'avslutt', 'steng',
        ],
    },
    {
        intent: 'minimize',
        keywords: [
            'minimize window', 'minimise window', 'hide window',
            'minimer vinduet', 'skjul vinduet',
        ],
    },
    {
        intent: 'desktop',
        keywords: [
            'show desktop', 'clear desktop', 'hide all windows',
            'vis skrivebordet', 'skjul alle vinduer',
        ],
    },
    {
        intent: 'help',
        keywords: [
            'help', 'voice commands', 'what can you do', 'list commands',
            'hjelp', 'kommandoer', 'hva kan du gjøre',
        ],
    },
];

/**
 * Returns true if the utterance starts with a recognised OS action verb
 * (after stripping common filler phrases). Used to gate _parseLLM so
 * conversational questions never reach the OS-command LLM pipeline.
 *
 * Examples that pass:  "open resume", "close window", "search for X"
 * Examples that fail:  "can you summarize", "what is", "tell me about"
 */
function _looksLikeOSCommand(rawText) {
    const OS_VERBS = /^(?:open|close|show|hide|minimize|maximise|maximize|navigate|go\s+to|search|sort|filter|browse|launch|select|find|start|stop|turn|display|åpne|lukk|vis|søk|minimer|naviger|gå\s+til)\b/i;
    const FILLER   = /^(?:can\s+you|could\s+you|please|hey|just|would\s+you|will\s+you)\s+/i;
    const stripped = rawText.trim().replace(FILLER, '').trim();
    return OS_VERBS.test(stripped);
}

export class VoiceCommandManager {
    /**
     * @param {{
     *   windowManager:    import('../../platform/windowing/WindowManager.js').WindowManager,
     *   notifications:    import('../../platform/services/NotificationManager.js').NotificationManager,
     *   onStateChange?:   (state: 'idle'|'loading'|'ready'|'recording'|'processing'|'error') => void,
     *   onMessage?:       (role: 'user'|'assistant'|'system', text: string) => void,
     *   onStreamMessage?: (role: 'assistant') => (text: string) => void,
     *   onPlan?:          (steps: string[]) => object,
     *   isSidebarOpen?:   () => boolean,
 *   openSidebar?:     () => void,
     * }} opts
     */
    constructor({ windowManager, notifications, onStateChange, onMessage, onStreamMessage, onPlan, isSidebarOpen, openSidebar, onDiscardStream }) {
        this._windowManager   = windowManager;
        this._notifications   = notifications;
        this._onStateChange   = onStateChange   ?? (() => {});
        this._onMessage       = onMessage       ?? (() => {});
        this._onStreamMessage = onStreamMessage ?? null;
        this._onDiscardStream = onDiscardStream ?? (() => {});
        this._onPlan          = onPlan          ?? null;
        this._isSidebarOpen   = isSidebarOpen   ?? (() => false);
        this._openSidebar     = openSidebar     ?? (() => {});
        this._loadStarted = false;
        this._liveCardId  = 'voice-model-load';
        this._history     = [];   // { role: 'user'|'assistant', content: string }[]
        this._aborted     = false; // set when the user stops generation mid-plan

        // The user pressing Stop aborts generation and any queued plan steps.
        document.addEventListener('andreos:assistant-abort', () => { this._aborted = true; });

        // Executes OS actions + app capabilities uniformly (reads the registry).
        this._actions = new ActionDispatcher({ windowManager, notifications });

        this._engine = this._buildEngine();
    }

    /**
     * Show a transient status toast — but skip it when the assistant sidebar
     * is open, since the same feedback is already shown inline there.
     * @param {string} message
     * @param {'info'|'success'|'warning'|'error'} type
     */
    _feedback(message, type = 'info') {
        if (this._isSidebarOpen()) return;
        this._notifications.show(message, type);
    }

    _buildEngine() {
        return new VoiceEngine({
            onReady:      ()    => this._onModelReady(),
            onProgress:   (p)   => this._onModelProgress(p),
            onTranscript: (t)   => this._onTranscript(t),
            onError:      (msg) => this._onEngineError(msg),
            model:        getWhisperModel(),
        });
    }

    get state() { return this._state; }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Lazily load the Whisper model.
     * Downloads ~74 MB on first use; subsequent loads hit the browser cache.
     * Idempotent — safe to call multiple times.
     */
    async loadModel() {
        if (this._loadStarted) return;
        this._loadStarted = true;
        this._setState('loading');
        this._notifications.createLive(
            this._liveCardId,
            'Voice Commands',
            'Downloading Whisper base model (~74 MB) — cached after first use',
            MIC_ICON
        );
        await this._engine.init();
    }

    /**
     * Toggle recording on/off.
     *   • First call (idle): loads model then waits for onReady.
     *   • ready → recording → processing → ready on each subsequent pair.
     */
    async toggleRecording() {
        if (this._state === 'loading' || this._state === 'processing') return;

        if (!this._loadStarted) {
            // First click: kick off the model download and remember that the user
            // wants to record — we auto-start once the model reports ready.
            this._startOnReady = true;
            await this.loadModel();
            return;
        }

        if (this._state === 'recording') {
            this._setState('processing');
            this._engine.stopRecording();
        } else if (this._state === 'ready') {
            this._setState('recording');
            await this._engine.startRecording({ language: getTranscribeLang() });
        }
    }

    destroy() {
        this._engine.destroy();
    }

    /**
     * Submit text directly through the same pipeline as a voice transcript.
     * Used by the OS Assistant sidebar text input.
     * Safe to call regardless of voice-model load state.
     * @param {string} text
     */
    async submitText(text) {
        if (!text?.trim()) return;
        if (this._state === 'recording' || this._state === 'processing') return;
        await this._onTranscript(text, { fromVoice: false });
    }

    /** Reload the voice engine with new settings (called when settings change). */
    reloadVoiceEngine() {
        this._engine.destroy();
        this._engine       = this._buildEngine();
        this._loadStarted  = false;
        this._startOnReady = false;
        if (this._state !== 'idle') this._setState('idle');
    }

    // ── Private: engine callbacks ──────────────────────────────────────────────

    _onModelReady() {
        this._notifications.completeLive(
            this._liveCardId,
            'Voice Commands',
            'Whisper ready — click the mic and speak a command',
            MIC_ICON,
            'success'
        );
        this._setState('ready');

        // Auto-start recording if the user clicked the mic to speak (the first
        // click only had time to load the model).
        if (this._startOnReady) {
            this._startOnReady = false;
            this.toggleRecording();
        }
    }

    _onModelProgress({ file, progress }) {
        const filename = file.split('/').pop();
        const pct      = Math.round(progress);
        this._notifications.updateLive(this._liveCardId, pct, `Loading ${filename} — ${pct}%`);
    }

    async _onTranscript(text, { fromVoice = true } = {}) {
        if (!text) {
            if (fromVoice) this._setState('ready');
            return;
        }
        this._aborted = false; // fresh request — clear any earlier stop

        // Show the user's words in the sidebar immediately
        this._onMessage('user', text);
        this._addHistory('user', text);

        // Ring the composer for the whole working window (routing, planning,
        // command execution, streaming) — not just token streaming.
        window.OSAssistant?.markBusy?.(true);
        try {
            await this._routeTranscript(text, { fromVoice });
        } finally {
            window.OSAssistant?.markBusy?.(false);
        }
    }

    async _routeTranscript(text, { fromVoice = true } = {}) {
        const heard = text.length > 45 ? text.slice(0, 43) + '…' : text;

        // 0. Context-aware commands (active window) — fast, no LLM needed.
        //    Kept as a pre-step because these reference UI state the LLM can't see.
        const contextual = this._parseContextual(text);
        if (contextual) {
            if (contextual.intent === 'research_question') {
                this._feedback(`🎤 Heard: "${heard}"`, 'info');
                await this._streamToSidebar(contextual.args.query);
            } else {
                this._feedback(`🎤 Heard: "${heard}"\n↳ ${contextual.label}`, 'success');
                this._dispatch(contextual);
                const reply = `✓ ${contextual.label}`;
                this._onMessage('assistant', reply);
                this._addHistory('assistant', reply);
            }
            if (fromVoice) this._setState('ready');
            return;
        }

        // 0b. Explicit "ask <assistant> <question>" → always a direct chat.
        //     Runs before the LLM router so this phrasing can never be
        //     misrouted into an "open app" command by the tiny model.
        const askShortcut = this._parseChatShortcut(text);
        if (askShortcut) {
            this._feedback(`🎤 Heard: "${heard}"`, 'info');
            await this._streamToSidebar(askShortcut);
            if (fromVoice) this._setState('ready');
            return;
        }

        // 1. Two-step LLM path (when model is loaded) ─────────────────────────
        //    Call 1: route — decide "command" vs "direct response"
        //    Call 2: if command, parse into an action sequence using history
        //    A "thinking" bubble + Stop button show immediately (before routing),
        //    so slow CPU classification isn't an invisible dead wait.
        if (window.OSAssistant?.currentModelId && window.OSAssistant?.routeIntent) {
            this._beginThinking();
            try {
                // On the CPU backend the router + parser passes each add a full
                // prefill AND evict the KV cache, so the next turn re-prefills the
                // whole system prompt. For plainly conversational text, skip them and
                // answer directly — keeping the cached prefix warm across turns (so
                // only the first message is slow). GPU routing is cheap, so it's
                // gated to CPU only. Eval suites call routeIntent/parseCommand
                // directly, so their scores are unaffected.
                const skipRouting = window.OSAssistant.isCpuBackend && !_looksLikeOSCommand(text);
                if (!skipRouting) this._thinkingUpdate?.setStatus?.('Understanding your request…');
                const route = skipRouting ? 'direct' : await window.OSAssistant.routeIntent(text, this._history);
                if (this._aborted) { if (fromVoice) this._setState('ready'); return; }

                if (route !== null) {
                    if (route === 'command') {
                        this._thinkingUpdate?.setStatus?.('Planning the steps…');
                        const actions = await window.OSAssistant.parseCommand(text, this._history);
                        if (this._aborted) { if (fromVoice) this._setState('ready'); return; }
                        if (actions?.length) {
                            this._discardThinking(); // a plan replaces the thinking bubble
                            // Record the plan in history (for LLM context) but render
                            // it as a live checklist block instead of a chat bubble.
                            const planText = actions
                                .map((a, i) => `${i + 1}. ${this._describeSingleAction(a)}`)
                                .join('\n');
                            this._addHistory('assistant', `📋 Plan:\n${planText}`);

                            await this._executeSequence(actions, { showPlan: true });
                            if (!actions.some(a => a.a === 'chat')) {
                                const reply = `✓ Done`;
                                this._onMessage('assistant', reply);
                                this._addHistory('assistant', reply);
                            }
                            if (fromVoice) this._setState('ready');
                            return;
                        }
                        // parseCommand returned null — treat as direct response
                    }

                    // "direct" or command parse failed → stream conversational response
                    await this._streamToSidebar(text);
                    if (fromVoice) this._setState('ready');
                    return;
                }
                // route === null → engine not ready, fall through to keyword fallback
            } finally {
                this._endThinking();
            }
        }

        // 2. Fallback: LLM not loaded — keyword/regex pipeline ─────────────────

        // 2a. Fast keyword registry (includes chat-message shortcut)
        const match = this._parse(text);
        if (match) {
            if (match.intent === 'chat_message') {
                this._feedback(`🎤 Heard: "${heard}"`, 'info');
                await this._streamToSidebar(match.args.text);
            } else {
                this._feedback(`🎤 Heard: "${heard}"\n↳ ${match.label}`, 'success');
                this._dispatch(match);
                const reply = `✓ ${match.label}`;
                this._onMessage('assistant', reply);
                this._addHistory('assistant', reply);
            }
            if (fromVoice) this._setState('ready');
            return;
        }

        // 2b. Rule-based compound parser
        const compound = this._parseCompound(text);
        if (compound) {
            const intent = this._describeActions(compound);
            this._feedback(`🎤 Heard: "${heard}"\n↳ ${intent}`, 'success');
            await this._executeSequence(compound);
            if (!compound.some(a => a.a === 'chat')) {
                const reply = `✓ ${intent}`;
                this._onMessage('assistant', reply);
                this._addHistory('assistant', reply);
            }
            if (fromVoice) this._setState('ready');
            return;
        }

        // 2c. Heuristic-gated LLM intent parse (legacy edge-case handler)
        if (_looksLikeOSCommand(text)) {
            const actions = await this._parseLLM(text);
            if (actions?.some(a => a.a !== 'chat')) {
                const intent = this._describeActions(actions);
                this._feedback(`🤖 Heard: "${heard}"\n↳ ${intent}`, 'success');
                await this._executeSequence(actions);
                if (!actions.some(a => a.a === 'chat')) {
                    const reply = `✓ ${intent}`;
                    this._onMessage('assistant', reply);
                    this._addHistory('assistant', reply);
                }
                if (fromVoice) this._setState('ready');
                return;
            }
        }

        // 2d. Conversational fallback
        await this._streamToSidebar(text);
        if (fromVoice) this._setState('ready');
    }

    _addHistory(role, content) {
        this._history.push({ role, content });
        if (this._history.length > 20) this._history.shift();
    }

    /**
     * Re-run a question after the sidebar rewound the conversation to it.
     * `history` is the surviving transcript (ending at this question) and becomes
     * the new memory; the regenerated answer streams into `update`.
     * @param {string} text
     * @param {(partial: string) => void} update
     * @param {{role:string, content:string}[]} history
     */
    async retryQuery(text, update, history) {
        if (Array.isArray(history)) this._history = history.slice(-20);
        if (!window.OSAssistant?.querySidebar) {
            update('The AI model is still loading — please try again in a moment.');
            return;
        }
        update.setStatus?.('Generating response…');
        await window.OSAssistant.querySidebar(text, update, (full) => {
            const reply = full || 'No response.';
            update(reply);
            this._addHistory('assistant', reply);
        });
    }

    _onEngineError(message) {
        this._startOnReady = false;
        this._notifications.show(`Voice error: ${message}`, 'error');
        this._setState(this._engine.isReady ? 'ready' : 'error');
    }

    /**
     * Answer a conversational query. Streams the reply into the assistant
     * sidebar, opening it first if it isn't already visible.
     * @param {string} text
     */
    async _streamToSidebar(text) {
        // Make sure the sidebar is visible so the streamed reply is seen.
        if (!this._isSidebarOpen()) this._openSidebar();

        if (window.OSAssistant?.querySidebar) {
            // Reuse the pipeline's "thinking" bubble if it's still unclaimed,
            // otherwise start a fresh streaming bubble.
            let update = null;
            if (this._thinkingUpdate && !this._thinkingClaimed) {
                update = this._thinkingUpdate;
                this._thinkingClaimed = true;
            } else if (this._onStreamMessage) {
                update = this._onStreamMessage('assistant');
            }
            if (update) {
                update.setStatus?.('Generating response…');
                await window.OSAssistant.querySidebar(text, update, update);
            } else {
                await window.OSAssistant.querySidebar(
                    text,
                    null,
                    (full) => this._onMessage('assistant', full || 'No response.')
                );
            }
        } else {
            this._onMessage('assistant', 'The AI model is still loading — please try again in a moment.');
        }
    }

    // ── Sidebar "thinking" lifecycle ─────────────────────────────────────────
    // Shows an immediate placeholder + Stop button for the whole router→parser→
    // answer pipeline, so slow CPU classification isn't an invisible wait.

    _beginThinking() {
        if (!this._isSidebarOpen()) this._openSidebar();
        window.OSAssistant?.markBusy?.(true);
        this._thinkingUpdate  = this._onStreamMessage ? this._onStreamMessage('assistant') : null;
        this._thinkingClaimed = false;
        this._thinkingUpdate?.setStatus?.('Thinking…');
    }

    /** Drop the thinking bubble (e.g. a plan is about to replace it). */
    _discardThinking() {
        if (this._thinkingUpdate && !this._thinkingClaimed) this._onDiscardStream();
        this._thinkingUpdate = null;
    }

    _endThinking() {
        // Unclaimed and not explicitly discarded → remove the stray placeholder.
        if (this._thinkingUpdate && !this._thinkingClaimed) this._onDiscardStream();
        this._thinkingUpdate  = null;
        this._thinkingClaimed = false;
        window.OSAssistant?.markBusy?.(false);
    }

    // ── Private: context-aware commands (active window) ──────────────────────

    _parseContextual(rawText) {
        const activeWin   = this._windowManager.windows.find(w => w.id === this._windowManager.activeWindowId);
        const activeTitle = activeWin?.title ?? '';
        if (activeTitle === 'Research') return resolveResearchIntent(rawText);
        return null;
    }

    // ── Private: rule-based compound parser ──────────────────────────────────────────

    _parseCompound(rawText) {
        const t = rawText.toLowerCase().replace(/[.,!?]/g, ' ').trim();

        // "open browser and search (for) X" — must come before generic "search for" check
        const openBrowserSearch = t.match(
            /(?:open|show|launch)\s+browser[\w\s]*?\s+and\s+search\s+(?:for\s+)?(.+)/i
        );
        if (openBrowserSearch && openBrowserSearch[1].trim().length > 1) {
            return [{ a: 'browse', t: openBrowserSearch[1].trim() }];
        }

        // Web / browser search or navigation
        const webSearch = t.match(
            /(?:search\s+(?:the\s+)?web\s+(?:for)?|search\s+online(?:\s+for)?|browse\s+to|go\s+to|navigate\s+to)\s+(.+)/i
        );
        if (webSearch && webSearch[1].trim().length > 1) {
            return [{ a: 'browse', t: webSearch[1].trim() }];
        }

        // Desktop search: "search for X" (uses the taskbar search bar, not the browser)
        const desktopSearch = t.match(/\bsearch\s+for\s+(.+)/i);
        if (desktopSearch && desktopSearch[1].trim().length > 1) {
            return [{ a: 'search', t: desktopSearch[1].trim() }];
        }

        // "open [app] and/,  ask/say/tell [message]" — English + Norwegian verbs
        // Accepts both "and ask" and comma-separated "open X, ask Y"
        const openAsk = t.match(
            /(?:open|show|launch|åpne|vis) +([ \w]+?) *(?:, *(?:and +)?|and +|og +)(?:ask|say|tell|send|message|spør|si|fortell|send) +(.+)/i
        );
        if (openAsk) {
            const app = this._resolveApp(openAsk[1].trim());
            const msg = openAsk[2].trim();
            if (app && msg.length > 2) {
                return [{ a: 'open', t: app }, { a: 'chat', t: msg }];
            }
        }

        // "open [app] and (then) open [app2]"
        const openOpen = t.match(
            /(?:open|show|launch)\s+([\w\s]+?)\s+(?:and\s+(?:then\s+)?|then\s+)(?:open|show|launch)\s+([\w\s]+)/i
        );
        if (openOpen) {
            const app1 = this._resolveApp(openOpen[1].trim());
            const app2 = this._resolveApp(openOpen[2].trim());
            if (app1 && app2) return [{ a: 'open', t: app1 }, { a: 'open', t: app2 }];
        }

        return null;
    }

    _resolveApp(name) {
        return assistantRegistry.resolveId(name);
    }

    // ── Private: LLM command parsing ───────────────────────────────────────────

    async _parseLLM(text) {
        if (!isVoiceAIEnabled()) return null;
        try {
            return await window.OSAssistant?.parseCommand(text) ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Convert a parsed action sequence into a human-readable description.
     * @param {Array<{a:string,t?:string}>} actions
     * @returns {string}
     */
    _describeSingleAction(a) {
        switch (a.a) {
            case 'open':      return `Open ${appRegistry.label(a.t)}`;
            case 'open_paper': return `Open paper #${a.n}`;
            case 'close':    return 'Close window';
            case 'minimize': return 'Minimize window';
            case 'desktop':  return 'Show desktop';
            case 'chat': {
                const msg = a.t ?? '';
                return `Ask: "${msg.length > 50 ? msg.slice(0, 48) + '…' : msg}"`;
            }
            case 'search': return `Search: "${(a.t ?? '').slice(0, 40)}"`;
            case 'browse': {
                const q = a.t ?? '';
                return /^https?:\/\//i.test(q) ? `Browse to ${q.slice(0, 40)}` : `Search web: "${q.slice(0, 40)}"`;
            }
            default: return a.a;
        }
    }

    _describeActions(actions) {
        return actions.map(a => this._describeSingleAction(a)).join(' → ');
    }

    /**
     * Execute a sequence of AI-parsed actions with a short delay between steps.
     * @param {Array<{a:string,t?:string}>} actions
     * @param {{ showPlan?: boolean }} [opts] when showPlan is set the steps are
     *        rendered as a live checklist block that updates as each step runs.
     */
    async _executeSequence(actions, { showPlan = false } = {}) {
        // When the sidebar is open and the sequence includes a chat reply,
        // drop any redundant “open chat” step — the answer streams inline.
        const hasChat = actions.some(a => a.a === 'chat');
        const steps = (hasChat && this._isSidebarOpen())
            ? actions.filter(a => !(a.a === 'open' && a.t === 'chat'))
            : actions;

        // Render a live plan checklist (distinct from chat bubbles) when asked.
        const plan = (showPlan && this._onPlan && steps.length)
            ? this._onPlan(steps.map(a => this._describeSingleAction(a)))
            : null;

        for (let i = 0; i < steps.length; i++) {
            const act = steps[i];
            if (this._aborted) {
                // User pressed Stop — mark this and every remaining step skipped.
                if (plan) for (let j = i; j < steps.length; j++) plan.setSkipped(j);
                break;
            }
            plan?.setActive(i);
            try {
                switch (act.a) {
                    case 'open':
                        this._actions.openApp(act.t);
                        break;
                    case 'close':
                        this._actions.closeActive();
                        break;
                    case 'minimize':
                        this._actions.minimizeActive();
                        break;
                    case 'desktop':
                        this._actions.showDesktop();
                        break;
                    case 'open_paper': {
                        // Wait for the Research app to finish loading its paper list.
                        await this._actions.waitForApp('research');
                        await this._actions.runCapability('research', 'openPaper', { n: act.n });
                        break;
                    }
                    case 'chat': {
                        // Before streaming, check if the text contains a contextual
                        // command (e.g. "open 40th paper") that needs the now-active
                        // window. Wait for the app to finish loading, dispatch the
                        // contextual action, then stream the follow-up question.
                        const ctxMatch = this._parseContextual(act.t ?? '');
                        if (ctxMatch && ctxMatch.intent !== 'research_question') {
                            await this._actions.waitForApp('research');
                            this._dispatch(ctxMatch);
                            const ctxReply = `✓ ${ctxMatch.label}`;
                            this._onMessage('assistant', ctxReply);
                            this._addHistory('assistant', ctxReply);
                            await new Promise(r => setTimeout(r, 600));
                        }
                        await this._streamToSidebar(act.t ?? '');
                        break;
                    }
                    case 'search':
                        this._actions.desktopSearch(act.t ?? '');
                        break;
                    case 'browse':
                        await this._actions.browse(act.t ?? '');
                        break;
                }
                plan?.setDone(i);
            } catch {
                plan?.setFailed(i);
            }
            // Pause between steps so each window has time to open and become active
            if (steps.length > 1) await new Promise(r => setTimeout(r, 700));
        }
    }

    // ── Private: command parsing ───────────────────────────────────────────────

    /**
     * Detect an explicit "ask <assistant> <question>" phrasing and return the
     * bare question, or null. Recognises André plus the assistant's brand
     * names (chat, assistant, os assistant, bot), in English and Norwegian.
     * No ^ anchor — Whisper sometimes prepends whitespace; [\s,]+ tolerates the
     * comma Whisper often inserts ("Ask chat, …"); andr[^\s,]+ matches any
     * Whisper rendering (André, Andrea, Andrés…) including accents \w misses.
     * @param {string} rawText
     * @returns {string|null}
     */
    _parseChatShortcut(rawText) {
        const m = rawText.match(
            /(?:ask|tell|message|spør)\s+(?:andr[^\s,]+|chat|(?:os\s+)?assistant|bot)[\s,]+(.+)/i
        );
        const message = m?.[1].trim();
        return message && message.length > 2 ? message : null;
    }

    /**
     * Map a raw transcript to the first matching COMMAND_REGISTRY entry.
     * @param {string} rawText
     * @returns {{ intent: string, args: object, label: string } | null}
     */
    _parse(rawText) {
        // ── Chat message shortcut: "ask <assistant> <question>" ────────────────
        // Checked before the keyword registry so the full question is preserved.
        const shortcut = this._parseChatShortcut(rawText);
        if (shortcut) {
            const preview = shortcut.length > 40 ? shortcut.slice(0, 40) + '…' : shortcut;
            return { intent: 'chat_message', args: { text: shortcut }, label: `Ask: "${preview}"` };
        }

        // Normalise: lowercase, collapse punctuation to spaces
        const text = ` ${rawText.toLowerCase().replace(/[.,!?]/g, ' ')} `;

        // Compound-command signals — skip keyword matching and let the LLM
        // parse multi-step intent ("open chat and ask X", "open research then show Y")
        const COMPOUND_SIGNALS = [
            'and ask', 'and say', 'and tell', 'and send', 'and search',
            'and then', 'then open', 'then ask', 'then show', 'then close',
            'after that', 'followed by',
            'og spør', 'og si', 'og åpne', 'og fortell', // Norwegian
            'go to', 'navigate to', 'browse to', 'search for', 'search the web', 'search online',
            // Comma-separated compound: "open X, ask Y" (comma → space after normalise)
            ' ask ', ' say ', ' tell ',
            ' spør ', ' si ', ' fortell ', // Norwegian comma-separated
        ];
        if (COMPOUND_SIGNALS.some(s => text.includes(s))) return null;

        const APP_LABELS = {
            about: 'About Me', resume: 'Resume', projects: 'Projects',
            skills: 'Skills', contact: 'Contact', social: 'Social Links',
            browser: 'Browser', game: 'Cast Arena', research: 'Research',
            settings: 'Settings',
        };

        // App-open commands come from the registry; OS commands are local.
        const registry = [...assistantRegistry.openCommands(), ...COMMAND_REGISTRY];
        for (const cmd of registry) {
            if (cmd.keywords.some(kw => text.includes(kw))) {
                const label = cmd.args?.fileType
                    ? `Open ${appRegistry.label(cmd.args.fileType)}`
                    : cmd.intent;
                return { intent: cmd.intent, args: cmd.args ?? {}, label };
            }
        }
        return null;
    }

    // ── Private: action dispatch ───────────────────────────────────────────────

    _dispatch({ intent, args }) {
        switch (intent) {
            case 'open':
                this._actions.openApp(args.fileType);
                break;

            case 'close':
                if (!this._actions.closeActive())
                    this._notifications.show('No active window to close', 'info');
                break;

            case 'minimize':
                if (!this._actions.minimizeActive())
                    this._notifications.show('No active window to minimize', 'info');
                break;

            case 'chat_message':
                this._streamToSidebar(args.text);
                break;

            case 'desktop':
                this._actions.showDesktop();
                break;

            case 'research_open_nth':
                this._actions.runCapability('research', 'openPaper', { n: args.n });
                break;
            case 'research_sort':
                this._actions.runCapability('research', 'sort', { by: args.sort });
                break;
            case 'research_filter':
                this._actions.runCapability('research', 'filter', { type: args.type });
                break;
            case 'research_search':
                this._actions.runCapability('research', 'search', { query: args.query });
                break;
            case 'research_categories':
                this._actions.runCapability('research', 'categories', {});
                break;

            case 'help':
                this._showHelp();
                break;
        }
    }

    _showHelp() {
        const lines = [
            '"open resume" / "åpne CV"',
            '"open chat" / "snakk med André"',
            '"open projects" / "prosjekter"',
            '"close window" / "lukk vinduet"',
            '"minimize window" / "minimer vinduet"',
            '"show desktop" / "vis skrivebordet"',
        ];
        this._notifications.push(
            'Voice Commands',
            lines.join('  ·  '),
            MIC_ICON,
            'info'
        );
    }

    _setState(state) {
        this._state = state;
        this._onStateChange(state);
    }
}
