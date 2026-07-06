/**
 * Settings — shared settings store used by chat.js, SettingsWindow, and VoiceCommandManager.
 * All reads/writes go through localStorage under SETTINGS_KEY.
 */

export const SETTINGS_KEY     = 'andreos_settings';
export const DEFAULT_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

export const MODELS = [
    { id: 'SmolLM2-135M-Instruct-q0f16-MLC',   name: 'SmolLM2 135M',  size: '~265 MB', desc: 'Fastest load · English only',                            badge: null },
    { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen2.5 1.5B',  size: '~1 GB',   desc: 'Multilingual · Norwegian ✓ · Best speed/quality balance', badge: 'Recommended' },
    { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B',  size: '~800 MB', desc: 'Multilingual · Compact · Meta',                           badge: null },
    { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B',  size: '~2 GB',   desc: 'Best response quality · Multilingual',                    badge: 'Best Quality' },
];

export const WHISPER_MODELS = [
    { id: 'Xenova/whisper-tiny',  name: 'Whisper Tiny',  size: '~39 MB',  desc: 'Fastest · Multilingual · Lower accuracy', badge: null },
    { id: 'Xenova/whisper-base',  name: 'Whisper Base',  size: '~74 MB',  desc: 'Recommended · Multilingual · Good balance', badge: 'Recommended' },
    { id: 'Xenova/whisper-small', name: 'Whisper Small', size: '~244 MB', desc: 'Best accuracy · Multilingual · Slower load', badge: 'Best Quality' },
];

export const TRANSCRIBE_LANGUAGES = [
    { id: 'auto',      label: 'Auto-detect' },
    { id: 'english',   label: 'English' },
    { id: 'norwegian', label: 'Norwegian' },
];

export const LLM_LANGUAGES = [
    { id: 'auto', label: 'Auto (match user)' },
    { id: 'en',   label: 'English' },
    { id: 'no',   label: 'Norwegian' },
];

export function getSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'); }
    catch { return {}; }
}

export function saveSettings(partial) {
    const next = { ...getSettings(), ...partial };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
}

export function getModelId()        { return getSettings().chatModel      || DEFAULT_MODEL_ID; }
export function getWhisperModel()   { return getSettings().whisperModel   || 'Xenova/whisper-base'; }
export function getTranscribeLang() { return getSettings().transcribeLang || 'auto'; }
export function getLLMLanguage()    { return getSettings().llmLang        || 'auto'; }
export function isVoiceAIEnabled()  { return getSettings().voiceAI !== false; }
