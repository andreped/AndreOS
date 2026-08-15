/**
 * Settings — shared settings store used by chat.js, SettingsWindow, and VoiceCommandManager.
 * All reads/writes go through localStorage under SETTINGS_KEY.
 */

export const SETTINGS_KEY     = 'andreos_settings';
export const DEFAULT_MODEL_ID = 'Qwen3.5-2B-q4f16_1-MLC';

export const MODELS = [
    { id: 'SmolLM2-135M-Instruct-q0f16-MLC',   name: 'SmolLM2 135M',  size: '~265 MB', desc: 'Fastest load · English only',                            badge: null },
    { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen2.5 1.5B',  size: '~1 GB',   desc: 'Multilingual · Norwegian ✓ · Compact',                     badge: null },
    { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B',  size: '~2 GB',   desc: 'Multilingual · Meta',                                     badge: null },
    { id: 'Qwen3.5-2B-q4f16_1-MLC',            name: 'Qwen3.5 2B',    size: '~1.4 GB', desc: 'Newest · 201 languages · Optional reasoning',              badge: 'Recommended' },
    { id: 'Qwen3.5-4B-q4f16_1-MLC',            name: 'Qwen3.5 4B',    size: '~2.8 GB', desc: 'Largest · 201 languages · Optional reasoning · Needs more VRAM', badge: null },
];

/**
 * Custom (non-prebuilt) WebLLM models. Each entry is an MLC ModelRecord that gets
 * merged into the engine's `appConfig.model_list` (see chat.js), so a compiled
 * MLC model hosted anywhere can be selected like a built-in one.
 *
 * Requires an MLC build — NOT a raw Hugging Face checkpoint:
 *   • `model`     URL to the MLC-format weights (e.g. an `…-MLC` HF repo).
 *   • `model_lib` URL to the compiled WebAssembly kernel. Its version segment
 *                 (e.g. `v0_2_84/base`) must match the installed web-llm runtime.
 *   • `overrides` optional ChatConfig tweaks (e.g. context window, KV history).
 * See https://llm.mlc.ai/docs/deploy/webllm.html to compile new weights/libs.
 *
 * @type {{ model: string, model_id: string, model_lib: string, overrides?: object }[]}
 */
export const CUSTOM_MODELS = [
    // Qwen3.5 2B — official MLC build. Not in web-llm 0.2.84's bundled config yet,
    // but the wasm is compiled for the v0_2_84 runtime, so it loads on our version.
    // max_history_size: 1 is required — Qwen3.5 is a hybrid/recurrent architecture.
    {
        model: 'https://huggingface.co/mlc-ai/Qwen3.5-2B-q4f16_1-MLC',
        model_id: 'Qwen3.5-2B-q4f16_1-MLC',
        model_lib: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm',
        overrides: { context_window_size: 8192, max_history_size: 1 },
    },
    // Qwen3.5 4B — same qwen3_5 architecture as the 2B (standard attention, no sliding
    // window), official MLC build with a v0_2_84 wasm. max_history_size: 1 for the same
    // hybrid/recurrent reason. Heavier (~2.8 GB VRAM) — needs a roomier GPU than the 2B.
    {
        model: 'https://huggingface.co/mlc-ai/Qwen3.5-4B-q4f16_1-MLC',
        model_id: 'Qwen3.5-4B-q4f16_1-MLC',
        model_lib: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Qwen3.5-4B-q4f16_1_cs1k-webgpu.wasm',
        overrides: { context_window_size: 8192, max_history_size: 1 },
    },
];

/**
 * CPU-only models — run via wllama (llama.cpp compiled to WASM), no WebGPU.
 * Slower than the GPU models (especially first-token/prefill), but they keep the
 * whole desktop responsive because they don't contend with the OS compositor for
 * the GPU. Each entry points at a single-file GGUF (Q4_K_M recommended).
 *
 * @type {{ id: string, name: string, size: string, desc: string, badge: string|null, url: string, contextSize?: number }[]}
 */
export const CPU_MODELS = [
    {
        id: 'Qwen3.5-2B-GGUF-CPU',
        name: 'Qwen3.5 2B (CPU)',
        size: '~1.8 GB',
        desc: 'Same model as the GPU default · Runs on CPU · No GPU needed · Slower',
        badge: 'CPU',
        // Same base model as the GPU default (Qwen/Qwen3.5-2B), GGUF Q4_K_M.
        url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',
        contextSize: 8192,
    },
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

/**
 * Reasoning effort levels (OpenAI-style). Each maps to whether the model thinks
 * (`enable_thinking`) and its total token budget (thinking + answer). Consumed
 * in chat.js. WebLLM has no separate thinking cap, so higher effort = a larger
 * overall budget plus a prompt nudge to reason proportionately.
 */
export const REASONING_LEVELS = [
    { id: 'none',   label: 'None',   think: false, maxTokens: 512,  nudge: '' },
    { id: 'low',    label: 'Low',    think: true,  maxTokens: 1536, nudge: 'Think briefly — a sentence or two — then answer.' },
    { id: 'medium', label: 'Medium', think: true,  maxTokens: 3072, nudge: 'Think concisely before answering.' },
    { id: 'high',   label: 'High',   think: true,  maxTokens: 6144, nudge: 'Think thoroughly, step by step, before answering.' },
];

export const THEMES = [
    { id: 'light',  label: 'Light',  icon: '☀️', desc: 'Bright surfaces — the default look' },
    { id: 'dark',   label: 'Dark',   icon: '🌙', desc: 'Dim surfaces, easier on the eyes at night' },
    { id: 'system', label: 'System', icon: '💻', desc: 'Follow your operating system setting' },
];

/**
 * Desktop background animation. Independent of the UI theme so you can keep the
 * bright wallpaper even in Dark mode. 'match' follows whatever the theme resolves to.
 */
export const BACKGROUNDS = [
    { id: 'match', label: 'Match theme', icon: '🎭', desc: 'Follow the UI theme above' },
    { id: 'light', label: 'Bright',      icon: '🌈', desc: 'Vivid daytime wallpaper, any theme' },
    { id: 'dark',  label: 'Dark',        icon: '🌌', desc: 'Deep night wallpaper, any theme' },
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

/** True when the selected (or given) model runs on CPU via wllama. */
export function isCpuModel(id = getModelId()) { return CPU_MODELS.some(m => m.id === id); }
/** The CPU model record for the selected (or given) id, or null. */
export function getCpuModel(id = getModelId()) { return CPU_MODELS.find(m => m.id === id) ?? null; }

export function getWhisperModel()   { return getSettings().whisperModel   || 'Xenova/whisper-base'; }
export function getTranscribeLang() { return getSettings().transcribeLang || 'english'; }  // default English — more reliable than auto
export function getLLMLanguage()    { return getSettings().llmLang        || 'en'; }        // default English
export function isVoiceAIEnabled()  { return getSettings().voiceAI !== false; }
export function getReasoningEffort(){ return getSettings().reasoningEffort || 'none'; }     // none | low | medium | high
export function getTheme()          { return getSettings().theme          || 'light'; }     // default Light
export function getBackground()     { return getSettings().background     || 'light'; }     // match | light | dark — default Bright
