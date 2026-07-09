/**
 * LangButton
 *
 * A compact taskbar tray button that lets users quickly switch between
 * English and Norwegian for both transcription (Whisper) and LLM responses.
 * Detailed per-feature control remains in the Settings window.
 *
 * Only renders on desktop (hidden via CSS on mobile — users use Settings there).
 */
import { getTranscribeLang, saveSettings } from '../services/Settings.js';

const LANGS = [
    { id: 'en', label: 'EN', name: 'English',   transcribe: 'english',   llm: 'en' },
    { id: 'no', label: 'NO', name: 'Norsk',      transcribe: 'norwegian', llm: 'no' },
];

export class LangButton {
    constructor() {
        this._el = this._build();
    }

    /** Insert before siblingEl in the DOM. */
    mount(siblingEl) {
        siblingEl?.parentElement?.insertBefore(this._el, siblingEl);
    }

    // ── Private ───────────────────────────────────────────────────────────────

    _currentId() {
        const t = getTranscribeLang();
        return LANGS.find(l => l.transcribe === t)?.id ?? 'en';
    }

    _build() {
        const el = document.createElement('div');
        el.className = 'lang-tray-btn';

        const render = () => {
            const cur = this._currentId();
            el.innerHTML = `
                <span class="lang-tray-label">${LANGS.find(l => l.id === cur)?.label ?? 'EN'}</span>
                <div class="lang-popup">
                    ${LANGS.map(l => `
                        <button class="lang-option${l.id === cur ? ' active' : ''}" data-id="${l.id}">
                            ${l.name}
                            ${l.id === cur ? '<span class="lang-check">✓</span>' : ''}
                        </button>`).join('')}
                </div>`;

            el.querySelectorAll('.lang-option').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const lang = LANGS.find(l => l.id === btn.dataset.id);
                    if (!lang) return;
                    saveSettings({ transcribeLang: lang.transcribe, llmLang: lang.llm });
                    el.classList.remove('open');
                    render(); // re-render to update label + checkmark
                });
            });
        };

        render();

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            el.classList.toggle('open');
        });

        document.addEventListener('click', () => el.classList.remove('open'));

        return el;
    }
}
