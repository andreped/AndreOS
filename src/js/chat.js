// chat.js — WebLLM-powered chat assistant for AndreOS
// Loaded as <script type="module">. Exposes window.AndreChat for classic script.js.

import * as webllm from "@mlc-ai/web-llm";
import { SYSTEM_PROMPT } from "./andre-profile.js";

const MODEL_ID = "SmolLM2-135M-Instruct-q0f16-MLC";

// ── Module-level state ────────────────────────────────────────────────────────
let engine        = null;
let engineState   = 'idle'; // idle | loading | ready | error
let lastProgress  = { text: 'Starting model download…', pct: 0 };
const registeredWindows = new Set();
const messageHistory    = [];

// ── Desktop-ready gate ────────────────────────────────────────────────────────
// Notifications are buffered until the OS signals the desktop is visible,
// so toasts never appear over the loading screen.
let desktopReady = false;
const notifQueue = [];

function onDesktopReady() {
    desktopReady = true;
    notifQueue.forEach(fn => fn());
    notifQueue.length = 0;
}

function whenReady(fn) {
    if (desktopReady) fn();
    else notifQueue.push(fn);
}

document.addEventListener('andreos:desktop-ready', onDesktopReady, { once: true });

// ── Toast notification ────────────────────────────────────────────────────────
function showToast(message, { type = 'info', duration = 5000, action = null } = {}) {
    const el = document.createElement('div');
    el.className = 'chat-toast';
    el.dataset.type = type;
    el.innerHTML = `
        <div class="chat-toast-message">${message}</div>
        ${action ? `<button class="chat-toast-btn">${action.label}</button>` : ''}
        <button class="chat-toast-close">✕</button>
    `;
    document.body.appendChild(el);

    if (action) {
        el.querySelector('.chat-toast-btn').addEventListener('click', () => {
            action.fn();
            el.remove();
        });
    }
    el.querySelector('.chat-toast-close').addEventListener('click', () => el.remove());

    setTimeout(() => {
        el.classList.add('chat-toast-out');
        setTimeout(() => el.remove(), 350);
    }, duration);
}

// ── Window-level progress ─────────────────────────────────────────────────────
function applyProgress(winEl, text, pct) {
    const status = winEl.querySelector('.chat-load-status');
    const fill   = winEl.querySelector('.chat-progress-fill');
    // Shorten verbose WebLLM messages to just MB + % for the overlay
    const mbMatch = text.match(/(\d+)MB fetched/);
    const shortText = mbMatch
        ? `Downloading… ${mbMatch[1]} MB  (${pct}%)`
        : pct === 0 ? 'Starting download…' : text;
    if (status) status.textContent = shortText;
    if (fill)   fill.style.width   = Math.min(100, pct) + '%';
}

function updateAll(text, pct) {
    lastProgress = { text, pct };
registeredWindows.forEach(w => applyProgress(w, text, pct));
}

// ── UI transition ─────────────────────────────────────────────────────────────
function transitionToChat(winEl) {
    const overlay      = winEl.querySelector('.chat-load-overlay');
    const messagesArea = winEl.querySelector('.chat-messages-area');
    const inputRow     = winEl.querySelector('.chat-input-row');
    if (overlay)      overlay.style.display     = 'none';
    if (messagesArea) messagesArea.style.display = 'flex';
    if (inputRow)     inputRow.style.display     = 'flex';

    if (messageHistory.length === 0) {
        appendBubble(winEl, 'assistant',
            "Hi! I'm André's AI assistant running locally in your browser 🤖\nAsk me anything about his background, projects, or skills.");
    } else {
        messageHistory.forEach(msg => appendBubble(winEl, msg.role, msg.content, false));
    }
    const input = winEl.querySelector('.chat-input');
    if (input) setTimeout(() => input.focus(), 50);
}

// ── Bubble helpers ────────────────────────────────────────────────────────────
function appendBubble(winEl, role, content, addToHistory = true) {
    const area = winEl.querySelector('.chat-messages-area');
    if (!area) return null;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble-${role}`;
    bubble.style.whiteSpace = 'pre-wrap';
    bubble.textContent = content;
    area.appendChild(bubble);
    area.scrollTop = area.scrollHeight;
    if (addToHistory) messageHistory.push({ role, content });
    return bubble;
}

// ── Send / stream ─────────────────────────────────────────────────────────────
async function sendMessage(winEl, userText) {
    if (engineState !== 'ready' || !userText.trim()) return;

    const input   = winEl.querySelector('.chat-input');
    const sendBtn = winEl.querySelector('.chat-send');
    if (input)   input.disabled   = true;
    if (sendBtn) sendBtn.disabled = true;

    appendBubble(winEl, 'user', userText);
    registeredWindows.forEach(w => { if (w !== winEl) appendBubble(w, 'user', userText, false); });

    const assistantEntry = { role: 'assistant', content: '' };
    messageHistory.push(assistantEntry);

    const typingBubbles = new Map();
    registeredWindows.forEach(w => {
        const b = appendBubble(w, 'assistant', '▋', false);
        if (b) b.style.whiteSpace = 'pre-wrap';
        typingBubbles.set(w, b);
    });

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messageHistory.slice(0, -1).filter(m => m.role !== 'system')
    ];

    try {
        const stream = await engine.chat.completions.create({
            messages,
            stream: true,
            max_tokens: 300,
            temperature: 0.7,
        });
        let fullText = '';
        for await (const chunk of stream) {
            fullText += chunk.choices[0]?.delta?.content || '';
            assistantEntry.content = fullText;
            typingBubbles.forEach((bubble, w) => {
                if (bubble) {
                    bubble.textContent = fullText + '▋';
                    const area = w.querySelector('.chat-messages-area');
                    if (area) area.scrollTop = area.scrollHeight;
                }
            });
        }
        typingBubbles.forEach(b => { if (b) b.textContent = fullText; });
    } catch (err) {
        const msg = 'Sorry, something went wrong. Please try again.';
        assistantEntry.content = msg;
        typingBubbles.forEach(b => { if (b) b.textContent = msg; });
        console.error('[AndreChat] send error:', err);
    }

    if (input)   { input.disabled = false; input.focus(); }
    if (sendBtn) sendBtn.disabled = false;
}

// ── Engine loader ─────────────────────────────────────────────────────────────
async function loadEngine() {
    if (engineState === 'loading' || engineState === 'ready') return;
    engineState = 'loading';
    console.log('[AndreChat] Starting model load:', MODEL_ID);

    // Show NC card — but only on the first load (not on refreshes within the same session)
    const silentLoad = !!sessionStorage.getItem('andreos:model-loaded');
    whenReady(() => {
        if (engineState !== 'ready' && !silentLoad) {
            window.__AndreOSApp?.createLiveNotification(
                'ai-model', 'Loading AI Model', 'Compiling WebGPU shaders… this takes ~30s the first time.', '⚙️'
            );
        }
    });
    updateAll('Compiling WebGPU shaders…', 0);

    try {
        engine = await webllm.CreateMLCEngine(MODEL_ID, {
            initProgressCallback: (report) => {
                const pct  = Math.round((report.progress || 0) * 100);
                const text = report.text || 'Loading…';
                console.log('[AndreChat]', pct + '%', text);

                // First real callback — shaders done, download starting
                const isFetching = text.toLowerCase().includes('fetch') || pct > 0;
                const mbMatch    = text.match(/(\d+)MB fetched/);
                const shortText  = mbMatch
                    ? `Downloading… ${mbMatch[1]} MB`
                    : isFetching ? 'Downloading weights…' : 'Compiling WebGPU shaders…';

                updateAll(shortText, pct);
                if (!silentLoad) window.__AndreOSApp?.updateLiveNotification('ai-model', pct, shortText);

                // Update NC card icon once download actually starts
                if (isFetching) {
                    const icon = document.querySelector('#nc-live-ai-model .nc-item-icon');
                    if (icon) icon.textContent = '⬇️';
                    const title = document.querySelector('#nc-live-ai-model .nc-item-title');
                    if (title) title.textContent = 'Downloading AI Model';
                }
            }
        });

        engineState = 'ready';
        sessionStorage.setItem('andreos:model-loaded', '1');
        console.log('[AndreChat] Model ready ✓');
        if (!silentLoad) whenReady(() => window.__AndreOSApp?.completeLiveNotification(
            'ai-model', 'AI Model ready', 'Ask André is ready to chat!', '✅', 'success',
            () => window.__AndreOSApp?.openFile('chat')
        ));

        registeredWindows.forEach(winEl => transitionToChat(winEl));

    } catch (err) {
        engineState = 'error';
        const msg = err?.message || String(err);
        console.error('[AndreChat] Load error:', err);
        whenReady(() => {
            window.__AndreOSApp?.completeLiveNotification(
                'ai-model', 'AI Model failed', msg, '❌', 'error'
            );
            showToast('❌ Failed to load AI model', {
            type: 'error',
            duration: 10000,
            action: { label: 'Retry', fn: () => window.AndreChat?.retry() }
            });
        });

        registeredWindows.forEach(winEl => {
            const overlay = winEl.querySelector('.chat-load-overlay');
            if (overlay) overlay.innerHTML = `
                <div class="chat-load-icon">⚠️</div>
                <div class="chat-load-title">Failed to load model</div>
                <div class="chat-load-subtitle" style="color:rgba(255,100,100,0.8);font-size:12px;word-break:break-word">${msg}</div>
                <button class="chat-retry-btn" onclick="window.AndreChat&&window.AndreChat.retry()">Retry</button>
            `;
        });
    }
}

// ── Public API ────────────────────────────────────────────────────────────────
window.AndreChat = {
    setupWindow(winEl) {
        if (!navigator.gpu) {
            const overlay = winEl.querySelector('.chat-load-overlay');
            if (overlay) overlay.innerHTML = `
                <div class="chat-load-icon">⚠️</div>
                <div class="chat-load-title">WebGPU not available</div>
                <div class="chat-load-subtitle">Please use Chrome or Edge 113+<br>to run the local AI model.</div>
            `;
            return;
        }

        registeredWindows.add(winEl);
        applyProgress(winEl, lastProgress.text, lastProgress.pct);

        const input   = winEl.querySelector('.chat-input');
        const sendBtn = winEl.querySelector('.chat-send');
        const submit  = () => {
            const text = input?.value?.trim();
            if (!text) return;
            if (input) input.value = '';
            sendMessage(winEl, text);
        };
        if (input) {
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); submit(); }
            });
            input.addEventListener('click',     e => e.stopPropagation());
            input.addEventListener('mousedown', e => e.stopPropagation());
        }
        if (sendBtn) sendBtn.addEventListener('click', e => { e.stopPropagation(); submit(); });

        if (engineState === 'ready') {
            transitionToChat(winEl);
        }

        const observer = new MutationObserver(() => {
            if (!document.contains(winEl)) { registeredWindows.delete(winEl); observer.disconnect(); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    },

    retry() {
        engineState = 'idle';
        engine = null;
        registeredWindows.forEach(winEl => {
            const overlay = winEl.querySelector('.chat-load-overlay');
            if (overlay) overlay.innerHTML = `
                <div class="chat-load-icon">🤖</div>
                <div class="chat-load-title">SmolLM2-135M</div>
                <div class="chat-load-subtitle">A tiny AI running entirely in your browser.<br>First load downloads ~135 MB (cached after).</div>
                <div class="chat-progress-track"><div class="chat-progress-fill"></div></div>
                <div class="chat-load-status">Starting…</div>
            `;
        });
        loadEngine();
    }
};

// ── Start loading on page load ────────────────────────────────────────────────
if (navigator.gpu) {
    loadEngine();
} else {
    console.warn('[AndreChat] WebGPU not available — model will not load.');
}
