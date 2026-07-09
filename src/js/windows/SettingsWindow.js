import { getModelId, getSettings, saveSettings, getWhisperModel, getTranscribeLang, getLLMLanguage } from '../platform/services/Settings.js';

export function setupSettingsWindow(winEl) {
    winEl.querySelectorAll('.settings-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            winEl.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
            winEl.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            winEl.querySelector(`.settings-section[data-section="${item.dataset.section}"]`)?.classList.add('active');
        });
    });

    function initLangPills(containerId, getCurrentValue, saveKey) {
        const container = winEl.querySelector(`#${containerId}`);
        if (!container) return;
        const pills = container.querySelectorAll('.lang-pill');
        const refresh = () => { const cur = getCurrentValue(); pills.forEach(p => p.classList.toggle('active', p.dataset.lang === cur)); };
        refresh();
        pills.forEach(p => p.addEventListener('click', () => { saveSettings({ [saveKey]: p.dataset.lang }); refresh(); }));
    }

    // AI model cards
    const applyBtn = winEl.querySelector('.settings-apply-btn');
    const statusEl = winEl.querySelector('.settings-apply-status');

    const refreshAiCards = () => {
        const cur = getModelId();
        winEl.querySelectorAll('.model-card[data-model-id]').forEach(c => c.classList.toggle('selected', c.dataset.modelId === cur));
    };
    refreshAiCards();

    winEl.querySelectorAll('.model-card[data-model-id]').forEach(card => {
        card.addEventListener('click', () => {
            saveSettings({ chatModel: card.dataset.modelId });
            refreshAiCards();
            refreshApplyBtn();
            if (statusEl) statusEl.textContent = '';
        });
    });

    const refreshApplyBtn = () => {
        if (!applyBtn) return;
        const loadedId = window.AndreChat?.currentModelId ?? null;
        applyBtn.textContent = (loadedId && loadedId === getModelId()) ? 'Restart AI' : 'Apply & Restart AI';
        applyBtn.disabled = false;
    };
    refreshApplyBtn();

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('andreos:settings-apply'));
            if (statusEl) statusEl.textContent = 'AI is restarting with the new model\u2026';
            refreshApplyBtn();
        });
    }

    initLangPills('llm-lang-pills', getLLMLanguage, 'llmLang');

    // Voice section
    const voiceApplyBtn = winEl.querySelector('#voice-apply-btn');
    const voiceStatus   = winEl.querySelector('#voice-apply-status');

    const refreshWhisperCards = () => {
        const cur = getWhisperModel();
        winEl.querySelectorAll('.model-card[data-whisper-model-id]').forEach(c => c.classList.toggle('selected', c.dataset.whisperModelId === cur));
    };
    refreshWhisperCards();

    winEl.querySelectorAll('.model-card[data-whisper-model-id]').forEach(card => {
        card.addEventListener('click', () => {
            saveSettings({ whisperModel: card.dataset.whisperModelId });
            refreshWhisperCards();
            if (voiceStatus) voiceStatus.textContent = '';
        });
    });

    initLangPills('transcribe-lang-pills', getTranscribeLang, 'transcribeLang');

    if (voiceApplyBtn) {
        voiceApplyBtn.addEventListener('click', () => {
            window.__AndreOSApp?.reloadVoiceEngine();
            if (voiceStatus) voiceStatus.textContent = 'Voice engine reloaded \u2014 click mic to load new model.';
        });
    }

    const voiceToggle = winEl.querySelector('#voice-ai-toggle');
    if (voiceToggle) {
        voiceToggle.checked = getSettings().voiceAI !== false;
        voiceToggle.addEventListener('change', () => saveSettings({ voiceAI: voiceToggle.checked }));
    }
}
