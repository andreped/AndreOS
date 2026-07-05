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
import { VoiceEngine } from '../system/VoiceEngine.js';

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

export class VoiceCommandManager {
    /**
     * @param {{
     *   windowManager:  import('../desktop/WindowManager.js').WindowManager,
     *   notifications:  import('./NotificationManager.js').NotificationManager,
     *   onStateChange?: (state: 'idle'|'loading'|'ready'|'recording'|'processing'|'error') => void,
     * }} opts
     */
    constructor({ windowManager, notifications, onStateChange }) {
        this._windowManager = windowManager;
        this._notifications = notifications;
        this._onStateChange = onStateChange ?? (() => {});

        this._state       = 'idle';
        this._loadStarted = false;
        this._liveCardId  = 'voice-model-load';

        this._engine = new VoiceEngine({
            onReady:      ()    => this._onModelReady(),
            onProgress:   (p)   => this._onModelProgress(p),
            onTranscript: (t)   => this._onTranscript(t),
            onError:      (msg) => this._onEngineError(msg),
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
            await this._engine.startRecording();
        }
    }

    destroy() {
        this._engine.destroy();
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

    _onTranscript(text) {
        if (!text) {
            this._setState('ready');
            return;
        }
        const match = this._parse(text);
        if (match) {
            this._notifications.show(`🎤 "${text}" → ${match.label}`, 'success');
            this._dispatch(match);
        } else {
            this._notifications.show(`🎤 "${text}" — no command matched (try "help")`, 'warning');
        }
        this._setState('ready');
    }

    _onEngineError(message) {
        this._notifications.show(`Voice error: ${message}`, 'error');
        this._setState(this._engine.isReady ? 'ready' : 'error');
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
        const chatMatch = rawText.match(
            /(?:ask\s+andr[eé]|tell\s+andr[eé]|message\s+andr[eé])[\s,]+(.+)/i
        );
        if (chatMatch) {
            const message = chatMatch[1].trim();
            if (message.length > 2) {
                const preview = message.length > 40 ? message.slice(0, 40) + '…' : message;
                return { intent: 'chat_message', args: { text: message }, label: `chat: "${preview}"` };
            }
        }

        // Normalise: lowercase, collapse punctuation to spaces
        const text = ` ${rawText.toLowerCase().replace(/[.,!?]/g, ' ')} `;

        for (const cmd of COMMAND_REGISTRY) {
            if (cmd.keywords.some(kw => text.includes(kw))) {
                const label = cmd.args?.fileType
                    ? `opening ${cmd.args.fileType}`
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
