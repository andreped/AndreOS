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
import { VoiceEngine }       from '../system/VoiceEngine.js';
import { isVoiceAIEnabled, getWhisperModel, getTranscribeLang } from '../system/Settings.js';

/**
 * Command registry — English and Norwegian keywords per intent.
 * Entries are tested in order; first keyword match wins.
 *
 * @type {Array<{ intent: string, args?: Record<string,string>, keywords: string[] }>}
 */
const COMMAND_REGISTRY = [
    // ── Open windows ───────────────────────────────────────────────────────────
    {
        intent: 'open', args: { fileType: 'about' },
        keywords: [
            'open about', 'about me', 'about andre', 'who are you', 'who is andre', 'tell me about',
            'om meg', 'hvem er du', 'hvem er andre',
        ],
    },
    {
        intent: 'open', args: { fileType: 'resume' },
        keywords: [
            'resume', 'curriculum vitae', 'work experience', 'career', 'experience',
            ' cv ',  // surrounded by spaces to avoid matching "csv" etc.
            'åpne cv', 'vis cv', 'jobberfaring', 'erfaring',
        ],
    },
    {
        intent: 'open', args: { fileType: 'projects' },
        keywords: [
            'projects', 'portfolio', 'open source', 'what have you built',
            'prosjekter', 'hva har du bygget',
        ],
    },
    {
        intent: 'open', args: { fileType: 'skills' },
        keywords: [
            'skills', 'technologies', 'tech stack', 'programming languages', 'tools', 'competence',
            'ferdigheter', 'teknologier', 'kompetanse',
        ],
    },
    {
        intent: 'open', args: { fileType: 'contact' },
        keywords: [
            'contact', 'email', 'reach out', 'get in touch', 'hire',
            'kontakt', 'epost', 'ta kontakt',
        ],
    },
    {
        intent: 'open', args: { fileType: 'social' },
        keywords: [
            'social links', 'linkedin', 'google scholar', 'social media',
            'sosiale lenker', 'sosiale medier',
        ],
    },
    {
        intent: 'open', args: { fileType: 'browser' },
        keywords: [
            'browser', 'open internet', 'navigate to', 'browse',
            'nettleser', 'internett',
        ],
    },
    {
        intent: 'open', args: { fileType: 'chat' },
        keywords: [
            'chat', 'ask andre', 'talk to andre', 'ai chat', 'question for andre',
            'snakk med andre', 'still spørsmål', 'spørsmål til andre', 'chat med andre',
        ],
    },
    {
        intent: 'open', args: { fileType: 'game' },
        keywords: [
            'game', 'play game', 'cast arena', 'play cast',
            'spill', 'spille spill', 'cast arena',
        ],
    },
    {
        intent: 'open', args: { fileType: 'research' },
        keywords: [
            'research', 'publications', 'papers', 'science', 'scientific work',
            'forskning', 'publikasjoner', 'artikler', 'vitenskapelig',
        ],
    },
    {
        intent: 'open', args: { fileType: 'settings' },
        keywords: [
            'settings', 'preferences', 'configuration', 'options', 'configure',
            'innstillinger', 'instillinger', 'preferanser', 'valg',
        ],
    },

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
     *   windowManager:    import('../desktop/WindowManager.js').WindowManager,
     *   notifications:    import('./NotificationManager.js').NotificationManager,
     *   onStateChange?:   (state: 'idle'|'loading'|'ready'|'recording'|'processing'|'error') => void,
     *   onMessage?:       (role: 'user'|'assistant'|'system', text: string) => void,
     *   onStreamMessage?: (role: 'assistant') => (text: string) => void,
     *   isSidebarOpen?:   () => boolean,
     * }} opts
     */
    constructor({ windowManager, notifications, onStateChange, onMessage, onStreamMessage, isSidebarOpen }) {
        this._windowManager   = windowManager;
        this._notifications   = notifications;
        this._onStateChange   = onStateChange   ?? (() => {});
        this._onMessage       = onMessage       ?? (() => {});
        this._onStreamMessage = onStreamMessage ?? null;
        this._isSidebarOpen   = isSidebarOpen   ?? (() => false);

        this._state       = 'idle';
        this._loadStarted = false;
        this._liveCardId  = 'voice-model-load';

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
            '🎤'
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
        this._engine      = this._buildEngine();
        this._loadStarted = false;
        if (this._state !== 'idle') this._setState('idle');
    }

    // ── Private: engine callbacks ──────────────────────────────────────────────

    _onModelReady() {
        this._notifications.completeLive(
            this._liveCardId,
            'Voice Commands',
            'Whisper ready — click the mic and speak a command',
            '🎤',
            'success'
        );
        this._setState('ready');
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

        // Show the user's words in the sidebar immediately
        this._onMessage('user', text);

        const heard = text.length > 45 ? text.slice(0, 43) + '…' : text;

        // 1. Fast keyword registry (includes chat-message shortcut)
        const match = this._parse(text);
        if (match) {
            if (match.intent === 'chat_message') {
                // Conversational shortcut (“ask André X”) → answer inline in sidebar
                this._feedback(`🎤 Heard: "${heard}"`, 'info');
                await this._streamToSidebar(match.args.text);
            } else {
                this._feedback(`🎤 Heard: "${heard}"\n↳ ${match.label}`, 'success');
                this._dispatch(match);
                this._onMessage('assistant', `✓ ${match.label}`);
            }
            if (fromVoice) this._setState('ready');
            return;
        }

        // 1.5. Context-aware commands (active window)
        const contextual = this._parseContextual(text);
        if (contextual) {
            const heard = text.length > 45 ? text.slice(0, 43) + '…' : text;
            if (contextual.intent === 'research_question') {
                // Conversational research query — stream via sidebar, same as chat
                this._feedback(`🎤 Heard: "${heard}"`, 'info');
                await this._streamToSidebar(contextual.args.query);
            } else {
                this._feedback(`🎤 Heard: "${heard}"\n↳ ${contextual.label}`, 'success');
                this._dispatch(contextual);
                this._onMessage('assistant', `✓ ${contextual.label}`);
            }
            if (fromVoice) this._setState('ready');
            return;
        }

        // 2. Rule-based compound parser
        const compound = this._parseCompound(text);
        if (compound) {
            const intent = this._describeActions(compound);
            this._feedback(`🎤 Heard: "${heard}"\n↳ ${intent}`, 'success');
            await this._executeSequence(compound);
            // A chat reply is its own output — don't add a redundant “✓ …” confirmation
            if (!compound.some(a => a.a === 'chat')) this._onMessage('assistant', `✓ ${intent}`);
            if (fromVoice) this._setState('ready');
            return;
        }

        // 3. LLM intent parse — ONLY for utterances that look like OS commands.
        //    Gate with an action-verb check first: conversational questions,
        //    questions starting with "can you / what / how / why / summarize…"
        //    skip straight to the conversational fallback. This prevents the
        //    small LLM from hallucinating OS actions for natural language input.
        if (_looksLikeOSCommand(text)) {
            const actions = await this._parseLLM(text);
            if (actions?.some(a => a.a !== 'chat')) {
                const intent = this._describeActions(actions);
                this._feedback(`🤖 Heard: "${heard}"\n↳ ${intent}`, 'success');
                await this._executeSequence(actions);
                if (!actions.some(a => a.a === 'chat')) this._onMessage('assistant', `✓ ${intent}`);
                if (fromVoice) this._setState('ready');
                return;
            }
        }

        // 4. Conversational fallback — stream LLM reply into sidebar
        await this._streamToSidebar(text);
        if (fromVoice) this._setState('ready');
    }
    _onEngineError(message) {
        this._notifications.show(`Voice error: ${message}`, 'error');
        this._setState(this._engine.isReady ? 'ready' : 'error');
    }

    /**
     * Answer a conversational query. When the assistant sidebar is open the
     * reply streams inline there; otherwise (e.g. voice command with the
     * sidebar closed) it opens the “Ask André” window instead.
     * @param {string} text
     */
    async _streamToSidebar(text) {
        // Sidebar not visible → use the Ask André window so the reply is seen
        if (!this._isSidebarOpen()) {
            if (window.AndreChat) window.AndreChat.injectMessage(text);
            else this._windowManager.openFile('chat');
            return;
        }

        if (window.AndreChat?.querySidebar) {
            if (this._onStreamMessage) {
                const update = this._onStreamMessage('assistant');
                await window.AndreChat.querySidebar(text, update, update);
            } else {
                await window.AndreChat.querySidebar(
                    text,
                    null,
                    (full) => this._onMessage('assistant', full || 'No response.')
                );
            }
        } else {
            this._onMessage('assistant', 'The AI model isn\'t loaded yet — open Ask André to load it first.');
        }
    }

    // ── Private: context-aware commands (active window) ──────────────────────

    _parseContextual(rawText) {
        const activeWin   = this._windowManager.windows.find(w => w.id === this._windowManager.activeWindowId);
        const activeTitle = activeWin?.title ?? '';
        const t = rawText.toLowerCase().replace(/[.,!?]/g, ' ');

        if (activeTitle === 'Research') {
            // ── Open the Nth paper ──────────────────────────────────────────
            const ORDINALS = { first:1,second:2,third:3,fourth:4,fifth:5,
                               sixth:6,seventh:7,eighth:8,ninth:9,tenth:10 };
            const nthMatch = t.match(/(?:open|show|select|expand|read)\s+(?:the\s+)?(\w+)\s+(?:paper|article|publication|item|result|one)/i);
            if (nthMatch) {
                const raw = nthMatch[1].toLowerCase();
                const n   = ORDINALS[raw] ?? (parseInt(raw) || null);
                if (n) return { intent: 'research_open_nth', args: { n }, label: `Open paper #${n}` };
            }
            // "open number 5" / "select 3"
            const numMatch = t.match(/(?:open|show|select|expand)\s+(?:number|item|paper|article|publication)?\s*(\d+)/i);
            if (numMatch) {
                const n = parseInt(numMatch[1]);
                if (n > 0) return { intent: 'research_open_nth', args: { n }, label: `Open paper #${n}` };
            }

            // ── Sort ────────────────────────────────────────────────────────
            if (/sort\s+by\s+cit|most\s+cited|by\s+citation/.test(t))
                return { intent: 'research_sort', args: { sort: 'cited' }, label: 'Sort by citations' };
            if (/sort\s+by\s+(?:date|newest|latest|recent)|newest|latest|most\s+recent/.test(t))
                return { intent: 'research_sort', args: { sort: 'date' }, label: 'Sort by newest' };
            if (/sort\s+by\s+(?:oldest|earliest|year)|oldest|earliest/.test(t))
                return { intent: 'research_sort', args: { sort: 'asc' }, label: 'Sort by oldest' };

            // ── Filter by type ──────────────────────────────────────────────
            if (/show\s+all|reset\s+filter|clear\s+filter|all\s+types/.test(t))
                return { intent: 'research_filter', args: { type: 'all' }, label: 'Show all types' };
            if (/journal/.test(t) && /show|filter|only/.test(t))
                return { intent: 'research_filter', args: { type: 'journal-article' }, label: 'Filter: journals' };
            if (/conference|proceedings/.test(t) && /show|filter|only/.test(t))
                return { intent: 'research_filter', args: { type: 'proceedings-article' }, label: 'Filter: conferences' };
            if (/preprint/.test(t) && /show|filter|only/.test(t))
                return { intent: 'research_filter', args: { type: 'preprint' }, label: 'Filter: preprints' };
            if (/book\s+chapter/.test(t) && /show|filter|only/.test(t))
                return { intent: 'research_filter', args: { type: 'book-chapter' }, label: 'Filter: book chapters' };

            // ── List categories ─────────────────────────────────────────────
            if (/(?:what|list|show|which)\s+(?:categor|filter|type|option)/.test(t))
                return { intent: 'research_categories', args: {}, label: 'List categories' };

            // ── Search within research ──────────────────────────────────────
            const searchMatch = rawText.match(/(?:search|find|look)\s+(?:for\s+)?(.+)/i);
            if (searchMatch) {
                const query = searchMatch[1].trim();
                if (query.length > 2)
                    return { intent: 'research_search', args: { query }, label: `Search: "${query.slice(0,30)}"` };
            }

            // ── Research question (conversational) — route to sidebar ────────
            // Catch BEFORE the LLM action parser so it can't hallucinate OS
            // commands from natural language research questions.
            if (/summarize|explain|describe|analys[ei]|tell\s+me\s+about|what\s+is|what\s+does|how\s+does|why\s+is|compare|discuss|abstract|conclusion/.test(t) ||
                /(?:next|previous|prev|last|this|the\s+selected)\s+paper/.test(t)) {
                return { intent: 'research_question', args: { query: rawText }, label: 'Ask about paper' };
            }
        }

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
        const n = name.toLowerCase().trim();
        if (/^chats?$|ask\s+andr|snakk\s+med/.test(n))              return 'chat';
        if (/research|paper|publication|science|forskning/.test(n))   return 'research';
        if (/resume|^cv$|curriculum|jobberfaring/.test(n))            return 'resume';
        if (/about|bio|om\s+meg/.test(n))                            return 'about';
        if (/project|portfolio|prosjekt/.test(n))                     return 'projects';
        if (/skill|tech|stack|ferdigh/.test(n))                       return 'skills';
        if (/contact|email|kontakt/.test(n))                          return 'contact';
        if (/social|linkedin/.test(n))                                return 'social';
        if (/browser|internet|nettleser/.test(n))                     return 'browser';
        if (/game|cast|arena|spill/.test(n))                          return 'game';
        if (/setting|preference|option|configur|innstilling|instilling|preferanse/.test(n)) return 'settings';
        return null;
    }

    // ── Private: LLM command parsing ───────────────────────────────────────────

    async _parseLLM(text) {
        if (!isVoiceAIEnabled()) return null;
        try {
            return await window.AndreChat?.parseCommand(text) ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Convert a parsed action sequence into a human-readable description.
     * @param {Array<{a:string,t?:string}>} actions
     * @returns {string}
     */
    _describeActions(actions) {
        const APP_LABELS = {
            about: 'About Me', resume: 'Resume', projects: 'Projects',
            skills: 'Skills', contact: 'Contact', social: 'Social Links',
            browser: 'Browser', chat: 'Ask André', game: 'Cast Arena', research: 'Research',
            settings: 'Settings',
        };
        return actions.map(a => {
            switch (a.a) {
                case 'open':     return `Open ${APP_LABELS[a.t] ?? a.t}`;
                case 'close':    return 'Close window';
                case 'minimize': return 'Minimize window';
                case 'desktop':  return 'Show desktop';
                case 'chat': {
                    const msg = a.t ?? '';
                    return `Ask André: “${msg.length > 40 ? msg.slice(0, 38) + '…' : msg}”`;
                }
                case 'search': return `Search desktop: "${(a.t ?? '').slice(0, 40)}"`;
                case 'browse': {
                    const q = a.t ?? '';
                    return /^https?:\/\//i.test(q)
                        ? `Browse to ${q.slice(0, 40)}`
                        : `Search web: "${q.slice(0, 40)}"`;
                }
                default: return a.a;
            }
        }).join(' → ');
    }

    /**
     * Execute a sequence of AI-parsed actions with a short delay between steps.
     * @param {Array<{a:string,t?:string}>} actions
     */
    async _executeSequence(actions) {
        // When the sidebar is open and the sequence includes a chat reply,
        // drop any redundant “open chat” step — the answer streams inline.
        const hasChat = actions.some(a => a.a === 'chat');
        const steps = (hasChat && this._isSidebarOpen())
            ? actions.filter(a => !(a.a === 'open' && a.t === 'chat'))
            : actions;

        for (const act of steps) {
            switch (act.a) {
                case 'open':
                    this._windowManager.openFile(act.t);
                    break;
                case 'close': {
                    const id = this._windowManager.activeWindowId;
                    if (id) this._windowManager.closeWindow(id);
                    break;
                }
                case 'minimize': {
                    const id = this._windowManager.activeWindowId;
                    if (id) this._windowManager.minimizeWindow(id);
                    break;
                }
                case 'desktop':
                    this._windowManager.showDesktop();
                    break;
                case 'chat':
                    await this._streamToSidebar(act.t ?? '');
                    break;
                case 'search': {
                    // Focus the desktop search bar and type the query
                    const searchInput = document.querySelector('.search-input');
                    if (searchInput) {
                        const box = searchInput.closest('.search-box');
                        if (box) box.classList.add('focused');
                        searchInput.focus();
                        searchInput.value = act.t ?? '';
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    break;
                }
                case 'browse': {
                    // Open browser window then navigate to URL or yep.com search
                    this._windowManager.openFile('browser');
                    await new Promise(r => setTimeout(r, 500));
                    const raw = act.t ?? '';
                    const url = /^https?:\/\//i.test(raw)
                        ? raw
                        : `https://yep.com/web?q=${encodeURIComponent(raw)}`;
                    document.dispatchEvent(new CustomEvent('andreos:browser-navigate', { detail: { url } }));
                    break;
                }
            }
            // Pause between steps so each window has time to open/focus
            if (steps.length > 1) await new Promise(r => setTimeout(r, 450));
        }
    }

    // ── Private: command parsing ───────────────────────────────────────────────

    /**
     * Map a raw transcript to the first matching COMMAND_REGISTRY entry.
     * @param {string} rawText
     * @returns {{ intent: string, args: object, label: string } | null}
     */
    _parse(rawText) {
        // ── Chat message shortcut: "ask André <question>" ──────────────────────
        // Checked before the keyword registry so the full question is preserved.
        // No ^ anchor — Whisper sometimes prepends whitespace.
        // [\s,]+ after the name — Whisper often inserts a comma: "Ask André, ..."
        // andr[^\s,]+ matches any Whisper rendering: André, Andrea, Andrei, Andrew, Andrés…
        // including accented characters that \w misses.
        const chatMatch = rawText.match(
            /(?:ask\s+andr[^\s,]+|tell\s+andr[^\s,]+|message\s+andr[^\s,]+|spør\s+andr[^\s,]+)[\s,]+(.+)/i
        );
        if (chatMatch) {
            const message = chatMatch[1].trim();
            if (message.length > 2) {
                const preview = message.length > 40 ? message.slice(0, 40) + '…' : message;
                return { intent: 'chat_message', args: { text: message }, label: `Ask André: "${preview}"` };
            }
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
            browser: 'Browser', chat: 'Ask André', game: 'Cast Arena', research: 'Research',
            settings: 'Settings',
        };

        for (const cmd of COMMAND_REGISTRY) {
            if (cmd.keywords.some(kw => text.includes(kw))) {
                const label = cmd.args?.fileType
                    ? `Open ${APP_LABELS[cmd.args.fileType] ?? cmd.args.fileType}`
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
                this._windowManager.openFile(args.fileType);
                break;

            case 'close': {
                const id = this._windowManager.activeWindowId;
                if (id) this._windowManager.closeWindow(id);
                else    this._notifications.show('No active window to close', 'info');
                break;
            }

            case 'minimize': {
                const id = this._windowManager.activeWindowId;
                if (id) this._windowManager.minimizeWindow(id);
                else    this._notifications.show('No active window to minimize', 'info');
                break;
            }

            case 'chat_message':
                if (window.AndreChat) {
                    window.AndreChat.injectMessage(args.text);
                } else {
                    this._windowManager.openFile('chat');
                }
                break;

            case 'desktop':
                this._windowManager.showDesktop();
                break;

            case 'research_open_nth': {
                const ok = window.__ResearchApp?.openPaper(args.n);
                if (!ok) this._notifications.show(`No paper #${args.n} in current list`, 'warning');
                break;
            }
            case 'research_sort':
                window.__ResearchApp?.setSort(args.sort);
                break;
            case 'research_filter':
                window.__ResearchApp?.setFilter(args.type);
                break;
            case 'research_search':
                window.__ResearchApp?.search(args.query);
                break;
            case 'research_categories': {
                const cats = window.__ResearchApp?.getCategories() ?? 'Research not open';
                this._notifications.show(`📋 Available categories: ${cats}`, 'info');
                break;
            }

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
            '🎤',
            'info'
        );
    }

    _setState(state) {
        this._state = state;
        this._onStateChange(state);
    }
}
