// chat.js — WebLLM-powered chat assistant for AndreOS
// Loaded as <script type="module">. Exposes window.AndreChat for classic script.js.

import * as webllm from "@mlc-ai/web-llm";
import { SYSTEM_PROMPT } from "./andre-profile.js";
import { RAGEngine }   from "./system/RAGEngine.js";
import { ActiveContext } from "./system/ActiveContext.js";
import { getModelId, MODELS, getLLMLanguage } from "./system/Settings.js";

const MODEL_ID = getModelId(); // resolved from Settings at load time — re-read on retry()

// ── RAG ───────────────────────────────────────────────────────────────────────
const ragEngine = new RAGEngine();
ragEngine.init({
    onReady: (count) => whenReady(() => {
        if (localStorage.getItem('andreos:rag-notified')) return;
        localStorage.setItem('andreos:rag-notified', '1');
        window.__AndreOSApp?.pushNotification(
            'Research Index Ready',
            `Ask André can now answer questions about André's ${count} publications.`,
            '📚', 'success'
        );
    }),
});

// ── Module-level state ────────────────────────────────────────────────────────
let engine        = null;
let engineState   = 'idle'; // idle | loading | ready | error
let engineError   = '';     // human-readable error stored when state === 'error'
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

    const langSetting = getLLMLanguage();
    const langInstruction = langSetting === 'no' ? '\n\nAlways respond in Norwegian (Bokmål).'
        : langSetting === 'en' ? '\n\nAlways respond in English.'
        : '';

    const activeCtx    = ActiveContext.getContextBlock(userText);
    // When the user is viewing a specific paper, that paper is the context —
    // don't also inject other RAG papers or the small model conflates them.
    const ragContext   = activeCtx ? '' : ragEngine.query(userText);
    const systemContent = [
        SYSTEM_PROMPT,
        activeCtx || null,
        ragContext
            ? `## Relevant Research Papers\nThese papers from André's publications are relevant to this question:\n\n${ragContext}\n\nCite paper titles when they are relevant to your answer.`
            : null,
    ].filter(Boolean).join('\n\n') + langInstruction;

    const messages = [
        { role: 'system', content: systemContent },
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

// ── GPU capability pre-flight ────────────────────────────────────────────────
async function assertGPULimits() {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter was found on this device.');
    const available = adapter.limits.maxStorageBuffersPerShaderStage;
    const required  = 10;
    if (available < required) {
        throw new Error(
            `Your browser's WebGPU implementation does not meet the minimum ` +
            `requirements for the AI model (maxStorageBuffersPerShaderStage: ` +
            `${available}, need ≥ ${required}). Please use Chrome 113+, Edge 113+, or Safari 18+.`
        );
    }
}

// ── Engine loader ─────────────────────────────────────────────────────────────
async function loadEngine() {
    if (engineState === 'loading' || engineState === 'ready') return;
    engineState = 'loading';
    console.log('[AndreChat] Starting model load:', getModelId());

    // Update the loading title to show the actual selected model name
    const modelInfo = MODELS.find(m => m.id === getModelId());
    const modelLabel = modelInfo?.name ?? getModelId();
    registeredWindows.forEach(w => {
        const titleEl = w.querySelector('.chat-model-name');
        if (titleEl) titleEl.textContent = modelLabel;
    });

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
        await assertGPULimits();
        engine = await webllm.CreateMLCEngine(getModelId(), {
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
        engineError = msg;
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
                <div class="chat-load-subtitle">Please use Chrome 113+, Edge 113+, or Safari 18+<br>to run the local AI model.</div>
            `;
            return;
        }

        if (engineState === 'error') {
            const overlay = winEl.querySelector('.chat-load-overlay');
            if (overlay) overlay.innerHTML = `
                <div class="chat-load-icon">⚠️</div>
                <div class="chat-load-title">Failed to load model</div>
                <div class="chat-load-subtitle" style="color:rgba(255,100,100,0.8);font-size:12px;word-break:break-word">${engineError}</div>
                <button class="chat-retry-btn" onclick="window.AndreChat&&window.AndreChat.retry()">Retry</button>
            `;
            return;
        }

        registeredWindows.add(winEl);
        applyProgress(winEl, lastProgress.text, lastProgress.pct);

        const input    = winEl.querySelector('.chat-input');
        const sendBtn  = winEl.querySelector('.chat-send');
        const clearBtn = winEl.querySelector('.chat-clear');
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

        if (clearBtn) {
            clearBtn.addEventListener('click', e => {
                e.stopPropagation();
                messageHistory.length = 0;
                registeredWindows.forEach(w => {
                    const area = w.querySelector('.chat-messages-area');
                    if (area) area.innerHTML = '';
                });
                appendBubble(winEl, 'assistant',
                    "Hi! I'm André's AI assistant running locally in your browser 🤖\nAsk me anything about his background, projects, or skills.");
                if (input) input.focus();
            });
        }

        if (engineState === 'ready') {
            transitionToChat(winEl);
        }

        const observer = new MutationObserver(() => {
            if (!document.contains(winEl)) { registeredWindows.delete(winEl); observer.disconnect(); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    },

    /**
     * Programmatically send a message to the chat — used by voice commands.
     * Opens the chat window if it is not already open, then either sends
     * the message immediately (engine ready) or pre-fills the input and
     * focuses it so the user can press Enter once the model finishes loading.
     * @param {string} text
     */
    injectMessage(text) {
        if (!text?.trim()) return;

        // Ensure the chat window is open
        window.__AndreOSApp?.openFile('chat');

        // Give the window a tick to mount before querying it
        setTimeout(() => {
            const winEl = [...registeredWindows][0];
            if (!winEl) return;

            if (engineState === 'ready') {
                sendMessage(winEl, text);
            } else {
                // Pre-fill the input so it is ready to send once the model loads
                const input = winEl.querySelector('.chat-input');
                if (input) {
                    input.value = text;
                    input.focus();
                }
            }
        }, 100);
    },

    /** Currently loaded model ID (null if not yet loaded). */
    get currentModelId() { return engineState === 'ready' ? getModelId() : null; },

    /**
     * BM25 paper search — used by SearchOverlay to include publications in
     * the desktop search results.
     * @param {string} query
     * @returns {object[]}
     */
    searchPapers(query) { return ragEngine.searchPapers(query); },

    /**
     * Stream a conversational LLM response without touching the chat window.
     * Used by the OS Assistant sidebar for non-command queries.
     * @param {string}                     text
     * @param {(partial: string) => void}  onChunk  — called with accumulated text + cursor on each token
     * @param {(full: string) => void}     onDone   — called with final text when stream ends
     */
    async querySidebar(text, onChunk, onDone) {
        if (engineState !== 'ready') {
            onDone?.('The AI model isn\'t loaded yet — open Ask André to load it first.');
            return;
        }
        const langSetting = getLLMLanguage();
        const langInstruction = langSetting === 'no' ? '\n\nAlways respond in Norwegian (Bokmål).'
            : langSetting === 'en' ? '\n\nAlways respond in English.'
            : '';
        const activeCtx  = ActiveContext.getContextBlock(text);
        // A viewed paper takes priority over general RAG retrieval.
        const ragContext = activeCtx ? '' : ragEngine.query(text);
        const systemContent = [
            SYSTEM_PROMPT,
            activeCtx || null,
            ragContext
                ? `## Relevant Research Papers\nThese papers from André's publications are relevant to this question:\n\n${ragContext}\n\nCite paper titles when relevant.`
                : null,
        ].filter(Boolean).join('\n\n') + langInstruction;
        try {
            const stream = await engine.chat.completions.create({
                messages: [
                    { role: 'system', content: systemContent },
                    { role: 'user',   content: text },
                ],
                stream: true,
                max_tokens: 300,
                temperature: 0.7,
            });
            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk.choices[0]?.delta?.content || '';
                onChunk?.(fullText + '▋');
            }
            onDone?.(fullText);
        } catch (err) {
            console.error('[AndreChat] querySidebar error:', err);
            onDone?.('Sorry, something went wrong.');
        }
    },

    async parseCommand(text) {
        if (engineState !== 'ready') return null;
        const prompt =
`You are an OS command parser. Convert the voice command into a JSON array of actions.
Apps: about, resume, projects, skills, contact, social, browser, chat, game, research, settings
Actions: {"a":"open","t":"<app>"} | {"a":"close"} | {"a":"minimize"} | {"a":"desktop"} | {"a":"chat","t":"<message>"}
Use {"a":"chat","t":"..."} to answer a question — do NOT add {"a":"open","t":"chat"} before it.
Reply with ONLY the JSON array, nothing else.
Examples:
"open research and then chat" → [{"a":"open","t":"research"}]
"show desktop" → [{"a":"desktop"}]
"ask André about his PhD" → [{"a":"chat","t":"Tell me about your PhD"}]
Command: "${text.replace(/"/g, "'")}"`;

        try {
            const response = await engine.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 120,
                temperature: 0.1,
            });
            const raw     = response.choices[0]?.message?.content?.trim() ?? '';
            const jsonMatch = raw.match(/\[[\s\S]*?\]/);
            if (!jsonMatch) return null;
            const actions = JSON.parse(jsonMatch[0]);
            return Array.isArray(actions) && actions.length > 0 ? actions : null;
        } catch (err) {
            console.warn('[AndreChat] parseCommand failed:', err);
            return null;
        }
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

// ── React to settings changes ─────────────────────────────────────────────────
document.addEventListener('andreos:settings-apply', () => {
    if (!navigator.gpu) return;
    sessionStorage.removeItem('andreos:model-loaded'); // show NC card for new model
    window.AndreChat.retry();
});
