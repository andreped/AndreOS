/** Settings window content (AI engine + speech configuration). */
import { MODELS, CPU_MODELS, LLM_LANGUAGES, TRANSCRIBE_LANGUAGES } from '../../platform/services/Settings.js';

const langPills = (langs) => langs.map((l) => `<button class="lang-pill" data-lang="${l.id}">${l.label}</button>`).join('');

export function render() {
    const modelCard = (m) => `
        <div class="model-card" data-model-id="${m.id}">
            <div class="model-card-radio"><span class="model-radio-dot"></span></div>
            <div class="model-card-info">
                <div class="model-card-header">
                    <span class="model-name">${m.name}</span>
                    ${m.badge ? `<span class="model-badge">${m.badge}</span>` : ''}
                    <span class="model-size">${m.size}</span>
                </div>
                <div class="model-desc">${m.desc}</div>
            </div>
        </div>`;
    const modelCards    = MODELS.map(modelCard).join('');
    const cpuModelCards = CPU_MODELS.map(modelCard).join('');

    const themes = [
        { id: 'light',  icon: '☀️', name: 'Light',  desc: 'Bright surfaces — the default look' },
        { id: 'dark',   icon: '🌙', name: 'Dark',   desc: 'Dim surfaces, easier on the eyes at night' },
        { id: 'system', icon: '💻', name: 'System', desc: 'Follow your operating system setting' },
    ];
    const themeCards = themes.map(t => `
        <div class="theme-card" data-theme-id="${t.id}">
            <div class="model-card-radio"><span class="model-radio-dot"></span></div>
            <span class="theme-card-icon">${t.icon}</span>
            <div class="model-card-info">
                <div class="model-card-header"><span class="model-name">${t.name}</span></div>
                <div class="model-desc">${t.desc}</div>
            </div>
        </div>`).join('');

    const backgrounds = [
        { id: 'match', icon: '🎭', name: 'Match theme', desc: 'Follow the UI theme above' },
        { id: 'light', icon: '🌈', name: 'Bright',      desc: 'Vivid daytime wallpaper — even in Dark mode' },
        { id: 'dark',  icon: '🌌', name: 'Dark',        desc: 'Deep night wallpaper — even in Light mode' },
    ];
    const backgroundCards = backgrounds.map(b => `
        <div class="theme-card" data-background-id="${b.id}">
            <div class="model-card-radio"><span class="model-radio-dot"></span></div>
            <span class="theme-card-icon">${b.icon}</span>
            <div class="model-card-info">
                <div class="model-card-header"><span class="model-name">${b.name}</span></div>
                <div class="model-desc">${b.desc}</div>
            </div>
        </div>`).join('');

    return `
        <div class="settings-container">
            <nav class="settings-sidebar">
                <div class="settings-sidebar-header">Settings</div>
                <div class="settings-nav-item active" data-section="ai">
                    <span class="settings-nav-icon">🤖</span><span>AI Engine</span>
                </div>
                <div class="settings-nav-item" data-section="voice">
                    <span class="settings-nav-icon">🎙️</span><span>Speech</span>
                </div>
                <div class="settings-nav-item" data-section="appearance">
                    <span class="settings-nav-icon">🎨</span><span>Appearance</span>
                </div>
                <div class="settings-nav-item" data-section="help">
                    <span class="settings-nav-icon">❓</span><span>Help</span>
                </div>
            </nav>
            <div class="settings-content-panel">

                <div class="settings-section active" data-section="ai">
                    <h2 class="settings-section-title">AI Engine</h2>
                    <p class="settings-section-desc">Powers the AI assistant chat and the AI voice command parser. The model is downloaded once and cached in your browser.</p>
                    <div class="model-cards">${modelCards}</div>

                    <h3 class="settings-subsection-title">CPU-only (no GPU)</h3>
                    <p class="settings-section-desc">Runs on the CPU via llama.cpp/WASM — no WebGPU. Slower to answer (especially the first token), but it keeps the whole desktop responsive during inference.</p>
                    <div class="model-cards">${cpuModelCards}</div>

                    <h3 class="settings-subsection-title">Reasoning effort</h3>
                    <p class="settings-section-desc">How much the model thinks before answering (Qwen3.5). Higher = deeper reasoning and a larger token budget; None skips thinking for the fastest reply.</p>
                    <div class="lang-pills" id="reasoning-effort-pills">
                        <button class="lang-pill" data-effort="none">None</button>
                        <button class="lang-pill" data-effort="low">Low</button>
                        <button class="lang-pill" data-effort="medium">Medium</button>
                        <button class="lang-pill" data-effort="high">High</button>
                    </div>

                    <h3 class="settings-subsection-title">Command planner</h3>
                    <p class="settings-section-desc">What turns a request into OS actions. The decision model (Vela 3.1 pico, 150M, ~200–300 MB download) picks actions instead of generating JSON — faster and more reliable; the chat model still writes the answers.</p>
                    <div class="lang-pills" id="planner-pills">
                        <button class="lang-pill" data-planner="llm">Chat model</button>
                        <button class="lang-pill" data-planner="vela">Decision model</button>
                    </div>

                    <h3 class="settings-subsection-title">Response Language</h3>
                    <div class="lang-pills" id="llm-lang-pills">${langPills(LLM_LANGUAGES)}</div>

                    <div class="settings-apply-row">
                        <span class="settings-apply-status"></span>
                        <button class="settings-apply-btn">Save Settings</button>
                    </div>
                </div>

                <div class="settings-section" data-section="voice">
                    <h2 class="settings-section-title">Speech</h2>
                    <p class="settings-section-desc">Configure the speech recognition model and language for voice commands.</p>

                    <h3 class="settings-subsection-title">Transcription Model</h3>
                    <div class="model-cards">
                        <div class="model-card" data-whisper-model-id="Xenova/whisper-tiny">
                            <div class="model-card-radio"><span class="model-radio-dot"></span></div>
                            <div class="model-card-info">
                                <div class="model-card-header"><span class="model-name">Whisper Tiny</span><span class="model-size">~39 MB</span></div>
                                <div class="model-desc">Fastest · Multilingual · Lower accuracy</div>
                            </div>
                        </div>
                        <div class="model-card" data-whisper-model-id="Xenova/whisper-base">
                            <div class="model-card-radio"><span class="model-radio-dot"></span></div>
                            <div class="model-card-info">
                                <div class="model-card-header"><span class="model-name">Whisper Base</span><span class="model-badge">Recommended</span><span class="model-size">~74 MB</span></div>
                                <div class="model-desc">Recommended · Multilingual · Good balance</div>
                            </div>
                        </div>
                        <div class="model-card" data-whisper-model-id="Xenova/whisper-small">
                            <div class="model-card-radio"><span class="model-radio-dot"></span></div>
                            <div class="model-card-info">
                                <div class="model-card-header"><span class="model-name">Whisper Small</span><span class="model-badge">Best Quality</span><span class="model-size">~244 MB</span></div>
                                <div class="model-desc">Best accuracy · Multilingual · Slower load</div>
                            </div>
                        </div>
                        <div class="model-card" data-whisper-model-id="onnx-community/nemotron-3.5-asr-streaming-0.6b-onnx-int4">
                            <div class="model-card-radio"><span class="model-radio-dot"></span></div>
                            <div class="model-card-info">
                                <div class="model-card-header"><span class="model-name">Nemotron 3.5 ASR</span><span class="model-badge">Experimental</span><span class="model-size">~790 MB</span></div>
                                <div class="model-desc">Realtime streaming · Strong English · Weak Norwegian</div>
                            </div>
                        </div>
                    </div>

                    <h3 class="settings-subsection-title">Transcription Language</h3>
                    <div class="lang-pills" id="transcribe-lang-pills">${langPills(TRANSCRIBE_LANGUAGES)}</div>

                    <h3 class="settings-subsection-title">Transcription Mode</h3>
                    <div class="lang-pills" id="transcribe-mode-pills">
                        <button class="lang-pill" data-lang="realtime" title="Text appears in the chat field as you speak (Nemotron only; Whisper always transcribes when you stop)">Realtime</button>
                        <button class="lang-pill" data-lang="full" title="Transcribe the whole recording when you stop">Full audio</button>
                    </div>

                    <div class="settings-option">
                        <div class="settings-option-info">
                            <div class="settings-option-label">AI command parsing</div>
                            <div class="settings-option-desc">Use the AI model to interpret voice commands not matched by the built-in parser. Requires the AI model to be loaded first.</div>
                        </div>
                        <label class="settings-switch">
                            <input type="checkbox" id="voice-ai-toggle">
                            <span class="settings-switch-track"></span>
                        </label>
                    </div>

                    <div class="settings-apply-row">
                        <span class="settings-apply-status" id="voice-apply-status"></span>
                        <button class="settings-apply-btn" id="voice-apply-btn">Apply Voice Settings</button>
                    </div>
                </div>

                <div class="settings-section" data-section="appearance">
                    <h2 class="settings-section-title">Appearance</h2>
                    <p class="settings-section-desc">Choose how AndreOS and all its apps look. Light is the default; your choice is saved and applied instantly.</p>

                    <h3 class="settings-subsection-title">Theme</h3>
                    <div class="theme-cards" id="theme-cards">
                        ${themeCards}
                    </div>

                    <h3 class="settings-subsection-title">Background</h3>
                    <p class="settings-section-desc">The animated desktop wallpaper. Keep it independent of the theme — for example, a bright background even while the UI stays in Dark mode.</p>
                    <div class="theme-cards" id="background-cards">
                        ${backgroundCards}
                    </div>

                </div>

                <div class="settings-section" data-section="help">
                    <h2 class="settings-section-title">Help</h2>
                    <p class="settings-section-desc">Intro tour and onboarding options.</p>

                    <h3 class="settings-subsection-title">Intro tour</h3>
                    <p class="settings-section-desc">A short walkthrough of the desktop, the assistant, and the Research app.</p>

                    <div class="settings-option">
                        <div class="settings-option-info">
                            <div class="settings-option-label">Show tour on first visit</div>
                            <div class="settings-option-desc">Automatically run the intro tour the first time someone opens the site.</div>
                        </div>
                        <label class="settings-switch">
                            <input type="checkbox" id="onboarding-enabled-toggle">
                            <span class="settings-switch-track"></span>
                        </label>
                    </div>

                    <div class="settings-apply-row">
                        <button class="settings-apply-btn" id="tour-replay-btn">Show intro again</button>
                    </div>
                </div>

            </div>
        </div>
    `;
}
