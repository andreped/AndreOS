// chat.js — WebLLM-powered chat assistant for AndreOS
// Loaded as <script type="module">. Exposes window.AndreChat for classic script.js.

import * as webllm from "@mlc-ai/web-llm";
import { buildProfileContext } from "./andre-profile.js";
import { RAGEngine }   from "../retrieval/RAGEngine.js";
import { ActiveContext } from "../retrieval/ActiveContext.js";
import { getModelId, MODELS, getLLMLanguage, CUSTOM_MODELS, getReasoningEffort, REASONING_LEVELS, isCpuModel, getCpuModel } from "../../platform/services/Settings.js";
import { appRegistry } from "../../apps/index.js";

const MODEL_ID = getModelId(); // resolved from Settings at load time — re-read on retry()

// ── RAG ───────────────────────────────────────────────────────────────────────
const ragEngine = new RAGEngine();
ragEngine.init({
    onReady: (count) => whenReady(() => {
        if (localStorage.getItem('andreos:rag-notified')) return;
        localStorage.setItem('andreos:rag-notified', '1');
        window.__AndreOSApp?.pushNotification(
            'Research Index Ready',
            `The AI assistant can now answer questions about André's ${count} publications.`,
            '📚', 'success'
        );
    }),
});

// ── Module-level state ────────────────────────────────────────────────────────
let engine        = null;
let engineState   = 'idle'; // idle | loading | ready | error
let engineError   = '';     // human-readable error stored when state === 'error'
let lastProgress  = { text: 'Starting model download…', pct: 0 };
// Full teardown for whatever engine is currently loaded (WebLLM worker or
// wllama). Called before loading a different model so we never keep two models
// resident in memory. Set at load time; null when nothing is loaded.
let teardown      = null;
const registeredWindows = new Set();
const messageHistory    = [];

// ── Generation lifecycle (drives the stop/cancel control) ──────────────────────
let generating     = false; // true while a streaming completion is in flight
let abortRequested = false;  // set by stopGeneration(); streaming loops check it

// Broadcast start/end so UI (e.g. the sidebar send↔stop button) can react.
function setGenerating(active) {
    generating = active;
    document.dispatchEvent(new CustomEvent(active ? 'andreos:generation-start' : 'andreos:generation-end'));
}

// ── DEV: main-thread blocking probe ───────────────────────────────────────────
// Quantifies how long the *main thread* stalls during a generation. Large totals
// here mean inference is CPU/main-thread bound (a worker engine helps); a near-
// zero total while the UI still hitches means the stall is GPU occupancy
// starving the compositor, which a worker can't fix. tl;dr: longtask only
// reports tasks >50ms, so sub-50ms churn is invisible — read totals, not zero.
if (import.meta.env.DEV && typeof PerformanceObserver !== 'undefined') {
    let blocked = 0, longest = 0, count = 0;
    try {
        new PerformanceObserver((list) => {
            for (const e of list.getEntries()) { blocked += e.duration; longest = Math.max(longest, e.duration); count++; }
        }).observe({ type: 'longtask', buffered: false });
        document.addEventListener('andreos:generation-start', () => { blocked = 0; longest = 0; count = 0; });
        document.addEventListener('andreos:generation-end', () =>
            console.log(`[AndreChat] main-thread blocked ${Math.round(blocked)}ms over ${count} long task(s), longest ${Math.round(longest)}ms`));
    } catch { /* longtask unsupported */ }
}


/**
 * Detect a degenerate repetition loop: the trailing chunk of text recurring
 * several times (small models like Qwen3.5-2B can get stuck repeating a phrase).
 */
function looksLooping(text) {
    if (text.length < 300) return false;
    const tail = text.slice(-48);
    if (!tail.trim()) return false;
    let count = 0, idx = 0;
    while ((idx = text.indexOf(tail, idx)) !== -1) { count++; idx += tail.length; }
    return count >= 3;
}

/**
 * Remove `<think>…</think>` reasoning blocks (including the empty one WebLLM
 * injects when thinking is disabled) so structured/eval outputs stay clean.
 */
function stripThink(text) {
    return String(text ?? '')
        .replace(/<think>[\s\S]*?<\/think>/g, '')  // completed reasoning blocks
        .replace(/<think>[\s\S]*$/, '')            // unterminated (e.g. cut mid-think)
        .trim();
}

/**
 * Generation config for the answer/eval path, honouring the Reasoning effort
 * setting. When thinking is on the budget is widened (thinking eats tokens);
 * when off it uses the tight per-call default.
 * @param {number} baseTokens tokens to allow when NOT thinking
 */
function structuredGenConfig(baseTokens) {
    const effort = REASONING_LEVELS.find(l => l.id === getReasoningEffort()) ?? REASONING_LEVELS[0];
    return {
        think: effort.think,
        maxTokens: effort.think ? Math.max(effort.maxTokens, baseTokens) : baseTokens,
    };
}

// ── Prompt debug logging ──────────────────────────────────────────────────────
// Auto-on in `vite dev`. In a production build (incl. `vite preview`) it's off
// unless enabled from the console: localStorage.setItem('andreos:debug-prompts','1').
// Logs the exact message array sent to the model for every call.
function logPrompt(label, messages) {
    if (!import.meta.env.DEV && localStorage.getItem('andreos:debug-prompts') !== '1') return;
    const chars = messages.reduce((n, m) => n + (m.content?.length || 0), 0);
    console.groupCollapsed(`[AndreChat] prompt ▶ ${label} · ${chars} chars · ~${Math.round(chars / 4)} tok`);
    for (const m of messages) console.log(`── ${m.role} ──\n${m.content}`);
    console.groupEnd();
}

/**
 * Streamed completion with the same loop-breaker as the chat UI, returning the
 * reasoning-stripped text. Used by the structured/eval calls so a thinking loop
 * gets cut off instead of blocking until max_tokens (non-streaming can't do that).
 */
async function completeText(messages, { maxTokens, temperature = 0.7, think = false }) {
    logPrompt('structured', messages);
    const stream = await engine.chat.completions.create({
        messages,
        stream: true,
        max_tokens: maxTokens,
        temperature,
        top_p: 0.9,
        frequency_penalty: 0.4,
        presence_penalty: 1.3,
        extra_body: { enable_thinking: think },
    });
    let full = '';
    let cut = false;
    for await (const chunk of stream) {
        full += chunk.choices[0]?.delta?.content || '';
        if (!cut && looksLooping(full)) {
            cut = true;
            try { engine.interruptGenerate?.(); } catch { /* ignore */ }
        }
    }
    return stripThink(full);
}

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

// ── Chat-window send/stop button (mirrors the sidebar ↑⇄■ toggle) ─────────────
const CHAT_SEND_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
const CHAT_STOP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

// While a response streams, every open chat window's send button becomes a stop
// button; it reverts when generation ends.
function applyChatSendState(winEl, streaming) {
    const sendBtn = winEl.querySelector('.chat-send');
    if (!sendBtn) return;
    sendBtn.classList.toggle('chat-send-stop', streaming);
    sendBtn.disabled = false;
    sendBtn.innerHTML = streaming ? CHAT_STOP_ICON : CHAT_SEND_ICON;
    sendBtn.dataset.tooltip = streaming ? 'Stop generating' : 'Send message';
}

document.addEventListener('andreos:generation-start', () => registeredWindows.forEach(w => applyChatSendState(w, true)));
document.addEventListener('andreos:generation-end',   () => registeredWindows.forEach(w => applyChatSendState(w, false)));

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
    // The send button is intentionally NOT disabled — the generation-start/-end
    // listeners turn it into a Stop button while streaming so it can cancel.

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
    // Only the profile sections relevant to the question (not the whole bio).
    const { prompt: profile, headings } = buildProfileContext(userText);
    // When the user is viewing a specific paper, that paper is the context —
    // don't also inject other RAG papers or the small model conflates them.
    // Otherwise only pull specific papers when the question is research-related.
    const ragContext   = (activeCtx || !headings.includes('Research & Publications')) ? '' : ragEngine.query(userText);
    const systemContent = [
        profile,
        activeCtx || null,
        ragContext
            ? `## Relevant Research Papers\nThese papers from André's publications are relevant to this question:\n\n${ragContext}\n\nCite paper titles when they are relevant to your answer.`
            : null,
    ].filter(Boolean).join('\n\n') + langInstruction;

    const messages = [
        { role: 'system', content: systemContent },
        ...messageHistory.slice(0, -1).filter(m => m.role !== 'system')
    ];

    abortRequested = false;
    setGenerating(true);
    logPrompt('chat', messages);
    try {
        const stream = await engine.chat.completions.create({
            messages,
            stream: true,
            max_tokens: 512,
            temperature: 0.7,
            top_p: 0.9,
            frequency_penalty: 0.4,
            presence_penalty: 1.3,
            extra_body: { enable_thinking: false },
        });
        let fullText = '';
        let frozen = null;
        for await (const chunk of stream) {
            fullText += chunk.choices[0]?.delta?.content || '';
            // On stop: keep draining the stream so the engine finalises cleanly
            // (breaking out mid-stream leaves WebLLM in a stuck state and the
            // NEXT generation hangs), but freeze the text at the stop point.
            if (abortRequested) { if (frozen === null) frozen = fullText; continue; }
            const shown = stripThink(fullText);
            assistantEntry.content = shown;
            typingBubbles.forEach((bubble, w) => {
                if (bubble) {
                    bubble.textContent = shown + '▋';
                    const area = w.querySelector('.chat-messages-area');
                    if (area) area.scrollTop = area.scrollHeight;
                }
            });
        }
        const finalText = stripThink(frozen ?? fullText);
        assistantEntry.content = finalText;
        typingBubbles.forEach(b => { if (b) b.textContent = finalText; });
    } catch (err) {
        const msg = 'Sorry, something went wrong. Please try again.';
        assistantEntry.content = msg;
        typingBubbles.forEach(b => { if (b) b.textContent = msg; });
        console.error('[AndreChat] send error:', err);
    } finally {
        setGenerating(false);
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
    const cpuModel = getCpuModel();
    console.log('[AndreChat] Starting model load:', getModelId(), cpuModel ? '(CPU/wllama)' : '(WebGPU)');

    // Update the loading title to show the actual selected model name
    const modelInfo = MODELS.find(m => m.id === getModelId()) ?? cpuModel;
    const modelLabel = modelInfo?.name ?? getModelId();
    registeredWindows.forEach(w => {
        const titleEl = w.querySelector('.chat-model-name');
        if (titleEl) titleEl.textContent = modelLabel;
    });

    // Show NC card — but only on the first load (not on refreshes within the same session)
    const silentLoad = !!sessionStorage.getItem('andreos:model-loaded');
    const loadingBlurb = cpuModel
        ? 'Downloading the CPU model… first run fetches the weights, then it\'s cached.'
        : 'Compiling WebGPU shaders… this takes ~30s the first time.';
    whenReady(() => {
        if (engineState !== 'ready' && !silentLoad) {
            window.__AndreOSApp?.createLiveNotification('ai-model', 'Loading AI Model', loadingBlurb, '⚙️');
        }
    });
    updateAll(cpuModel ? 'Loading CPU model…' : 'Compiling WebGPU shaders…', 0);

    try {
        if (cpuModel) {
            // CPU path — wllama (llama.cpp/WASM). Lazily imported so the ~big
            // wllama bundle only loads when a CPU model is actually selected.
            const { createWllamaEngine } = await import('./wllama-engine.js');
            const eng = await createWllamaEngine(cpuModel.url, {
                contextSize: cpuModel.contextSize ?? 4096,
                onProgress: (frac) => {
                    const pct  = Math.round(frac * 100);
                    const text = pct >= 100 ? 'Preparing model…' : `Downloading… ${pct}%`;
                    updateAll(text, pct);
                    if (!silentLoad) window.__AndreOSApp?.updateLiveNotification('ai-model', pct, text);
                },
            });
            engine = eng;
            teardown = async () => {
                try { eng.interruptGenerate?.(); } catch { /* ignore */ }
                try { await eng.unload?.(); } catch (e) { console.warn('[AndreChat] wllama unload failed:', e); }
            };
        } else {
            await assertGPULimits();
            // Merge any custom MLC models into the app config so they load like built-ins.
            const appConfig = CUSTOM_MODELS.length
                ? { ...webllm.prebuiltAppConfig, model_list: [...webllm.prebuiltAppConfig.model_list, ...CUSTOM_MODELS] }
                : undefined;
            // Run the engine in a Web Worker so per-dispatch command submission (the
            // batch-1 CPU bottleneck) stays off the UI thread — see mlc.worker.js.
            const worker = new Worker(new URL('./mlc.worker.js', import.meta.url), { type: 'module' });
            const eng = await webllm.CreateWebWorkerMLCEngine(worker, getModelId(), {
                appConfig,
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
            engine = eng;
            teardown = async () => {
                try { await eng.unload?.(); }  catch (e) { console.warn('[AndreChat] engine unload failed:', e); }
                try { worker.terminate(); }    catch (e) { console.warn('[AndreChat] worker terminate failed:', e); }
            };
        }

        engineState = 'ready';
        sessionStorage.setItem('andreos:model-loaded', '1');
        console.log('[AndreChat] Model ready ✓');
        if (!silentLoad) whenReady(() => window.__AndreOSApp?.completeLiveNotification(
            'ai-model', 'AI Model ready', 'The AI assistant is ready to chat!', '✅', 'success',
            () => window.__AndreOSApp?.openAssistant()
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

// ── Full teardown ─────────────────────────────────────────────────────────────
// Release the current engine before loading another one, so we never keep a
// previous model's weights (GPU VRAM / WASM heap) and its worker(s) resident.
async function unloadEngine() {
    const t = teardown;
    teardown = null;
    // Abort any in-flight generation first, else teardown blocks on a busy worker.
    abortRequested = true;
    try { engine?.interruptGenerate?.(); } catch { /* ignore */ }
    engine = null;
    engineState = 'idle';
    setGenerating(false);
    // tl;dr: race a timeout — a wllama CPU worker mid-prefill can't service exit()
    // until it finishes, which would otherwise hang Restart indefinitely. On
    // timeout we orphan the old worker (it finishes then gets GC'd) rather than block.
    if (t) {
        try { await Promise.race([t(), new Promise((r) => setTimeout(r, 3000))]); }
        catch (err) { console.warn('[AndreChat] teardown failed:', err); }
    }
}

// ── Public API ────────────────────────────────────────────────────────────────
window.AndreChat = {
    setupWindow(winEl) {
        if (!navigator.gpu && !isCpuModel()) {
            const overlay = winEl.querySelector('.chat-load-overlay');
            if (overlay) overlay.innerHTML = `
                <div class="chat-load-icon">⚠️</div>
                <div class="chat-load-title">WebGPU not available</div>
                <div class="chat-load-subtitle">Please use Chrome 113+, Edge 113+, or Safari 18+<br>to run the local AI model,<br>or pick a CPU model in Settings.</div>
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
        if (sendBtn) sendBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (generating) window.AndreChat.stopGeneration();
            else submit();
        });

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

    /** Currently loaded model ID (null if not yet loaded). */
    get currentModelId() { return engineState === 'ready' ? getModelId() : null; },

    /** True when the loaded model runs on the CPU (wllama) backend. */
    get isCpuBackend() { return engineState === 'ready' && isCpuModel(); },

    /**
     * BM25 paper search — used by SearchOverlay to include publications in
     * the desktop search results.
     * @param {string} query
     * @returns {object[]}
     */
    searchPapers(query) { return ragEngine.searchPapers(query); },

    /**
     * Stop an in-flight streaming generation, if any. Interrupts the WebLLM
     * engine and signals the streaming loops (and any queued plan steps) to
     * abort. Returns true if a generation was actually running.
     * @returns {boolean}
     */
    stopGeneration() {
        if (!generating) return false;
        abortRequested = true;
        try { engine?.interruptGenerate?.(); } catch (err) { console.warn('[AndreChat] interrupt failed:', err); }
        document.dispatchEvent(new CustomEvent('andreos:assistant-abort'));
        return true;
    },

    /** @returns {boolean} true while a streaming completion is in flight. */
    isGenerating() { return generating; },

    /**
     * Abort whatever model call is currently streaming, without the `generating`
     * guard stopGeneration() uses. The eval runner needs this because its calls
     * (routeIntent/parseCommand/answer) don't set the generating flag.
     */
    interrupt() { try { engine?.interruptGenerate?.(); } catch { /* ignore */ } },

    /**
     * Mark the assistant busy for a whole sidebar pipeline (router + parser +
     * answer), so the Stop button shows and stopGeneration() works during the
     * classification passes — not only during the final streamed answer.
     */
    markBusy(active) { setGenerating(!!active); },

    /**
     * Stream a conversational LLM response without touching the chat window.
     * Used by the OS Assistant sidebar for non-command queries.
     * @param {string}                     text
     * @param {(partial: string) => void}  onChunk  — called with accumulated text + cursor on each token
     * @param {(full: string) => void}     onDone   — called with final text when stream ends
     */
    async querySidebar(text, onChunk, onDone) {
        if (engineState !== 'ready') {
            if (!navigator.gpu && !isCpuModel()) {
                onDone?.('This browser has no WebGPU support, so the local AI model can\'t run. Try Chrome/Edge 113+ or Safari 18+, or pick a CPU model in Settings.');
                return;
            }
            // Auto-(re)start loading if it never started or previously failed,
            // then wait — so the sidebar recovers on its own instead of dead-ending.
            if (engineState === 'idle' || engineState === 'error') {
                if (engineState === 'error') { engineState = 'idle'; engine = null; }
                loadEngine();
            }
            onChunk?.('⏳ Loading the AI model… (first run downloads the weights, then it\'s cached)');
            try {
                await window.AndreChat.whenReady(180_000);
            } catch {
                onDone?.('The AI model couldn\'t load. Please try again in a moment.');
                return;
            }
        }
        const langSetting = getLLMLanguage();
        const langInstruction = langSetting === 'no' ? '\n\nAlways respond in Norwegian (Bokmål).'
            : langSetting === 'en' ? '\n\nAlways respond in English.'
            : '';
        const effort = REASONING_LEVELS.find(l => l.id === getReasoningEffort()) ?? REASONING_LEVELS[0];
        const activeCtx  = ActiveContext.getContextBlock(text);
        const { prompt: profile, headings } = buildProfileContext(text);
        // A viewed paper takes priority; otherwise only pull specific papers when
        // the question is research-related (per the section retriever).
        const ragContext = (activeCtx || !headings.includes('Research & Publications')) ? '' : ragEngine.query(text);
        const systemContent = [
            profile,
            activeCtx || null,
            ragContext
                ? `## Relevant Research Papers\nThese papers from André's publications are relevant to this question:\n\n${ragContext}\n\nCite paper titles when relevant.`
                : null,
            effort.think ? effort.nudge : null,
        ].filter(Boolean).join('\n\n') + langInstruction;
        abortRequested = false;
        setGenerating(true);
        const messages = [
            { role: "system", content: systemContent },
            { role: "user",   content: text },
        ];
        logPrompt('sidebar', messages);
        try {
            const stream = await engine.chat.completions.create({
                messages,
                stream: true,
                max_tokens: effort.maxTokens,
                temperature: 0.7,
                top_p: 0.9,
                // Penalise repeats so the small model doesn't fall into a
                // reasoning loop (Qwen recommends presence_penalty for this).
                frequency_penalty: 0.4,
                presence_penalty: 1.3,
                extra_body: { enable_thinking: effort.think },
            });
            let fullText = '';
            let frozen = null;
            for await (const chunk of stream) {
                fullText += chunk.choices[0]?.delta?.content || '';
                // Safety net: if it still starts repeating itself, cut it off.
                if (!abortRequested && looksLooping(fullText)) {
                    abortRequested = true;
                    try { engine.interruptGenerate?.(); } catch { /* ignore */ }
                }
                // On stop: keep draining so the engine finalises cleanly (breaking
                // out mid-stream leaves WebLLM stuck and the next call hangs);
                // just freeze the displayed text at the stop point.
                if (abortRequested) { if (frozen === null) frozen = fullText; continue; }
                onChunk?.(fullText + '▋');
            }
            onDone?.(frozen ?? fullText);
        } catch (err) {
            console.error('[AndreChat] querySidebar error:', err);
            onDone?.('Sorry, something went wrong.');
        } finally {
            setGenerating(false);
        }
    },

    /**
     * Non-streaming answer used by the evals harness (RAGAS-style answer suite).
     * Runs the exact same RAG pipeline as the chat window — active-app context
     * takes priority over general retrieval — but returns the final text plus the
     * context block that was fed to the model, so the harness can measure
     * faithfulness against what the model was actually given.
     * @param {string} text
     * @param {{ history?: {role:string,content:string}[], temperature?: number }} [opts]
     * @returns {Promise<{ text: string, context: string } | null>}
     */
    async answer(text, { history = [], temperature = 0.7 } = {}) {
        if (engineState !== 'ready') return null;
        const langSetting = getLLMLanguage();
        const langInstruction = langSetting === 'no' ? '\n\nAlways respond in Norwegian (Bokmål).'
            : langSetting === 'en' ? '\n\nAlways respond in English.'
            : '';
        const activeCtx  = ActiveContext.getContextBlock(text);
        const { prompt: profile, headings } = buildProfileContext(text);
        const ragContext = (activeCtx || !headings.includes('Research & Publications')) ? '' : ragEngine.query(text);
        const context    = activeCtx || ragContext || '';
        const systemContent = [
            profile,
            activeCtx || null,
            ragContext
                ? `## Relevant Research Papers\nThese papers from André's publications are relevant to this question:\n\n${ragContext}\n\nCite paper titles when relevant.`
                : null,
        ].filter(Boolean).join('\n\n') + langInstruction;
        try {
            const cfg = structuredGenConfig(512);
            const out = await completeText([
                { role: 'system', content: systemContent },
                ...history.filter(m => m.role !== 'system'),
                { role: 'user', content: text },
            ], { maxTokens: cfg.maxTokens, temperature, think: cfg.think });
            return { text: out, context };
        } catch (err) {
            console.error('[AndreChat] answer error:', err);
            return { text: '', context };
        }
    },

    async parseCommand(text, history = []) {
        if (engineState !== 'ready') return null;
        const histCtx = history.slice(-6)
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n');
        const appIds = appRegistry.launchable().map(m => m.id).join(', ');
        const prompt =
`You are AndreOS's command planner. Turn the request into a JSON array of actions that, run in order, fulfil it.
Apps (use with "open"): ${appIds}
Actions:
  {"a":"open","t":"<app>"}         open one of the apps listed above
  {"a":"open_paper","n":<number>}  open a specific numbered paper in the Research app
  {"a":"close"} | {"a":"minimize"} | {"a":"desktop"}   window management
  {"a":"browse","t":"<url-or-web-query>"}   open the web browser (external sites, or "search the web for …")
  {"a":"search","t":"<query>"}     type into the AndreOS desktop/taskbar search bar
  {"a":"chat","t":"<message>"}     answer a question or do a task about André (needs no OS action)
Rules:
- The apps listed above are ALWAYS {"a":"open","t":"<app>"} — for "open/show/pull up/see/switch to/what about <app>". Never {"a":"browse"} an app, and never {"a":"open","t":"chat"}.
- "desktop"/"show the desktop"/"back to the desktop" → {"a":"desktop"}. "close"/"minimize" are OS actions too. These are NOT apps — never {"a":"open","t":"desktop"}.
- Follow-ups that switch apps ("what about his skills?", "actually his projects", "switch to resume") → {"a":"open"} for that app.
- External websites are ALWAYS {"a":"browse"} (never {"a":"open"}). If the user gives an explicit URL or domain (e.g. "github.com", "example.org/x"), browse it VERBATIM — never rewrite it. Only a bare service name maps to André's profile: github → github.com/andreped, linkedin → linkedin.com/in/andré-pedersen, scholar → his Google Scholar. Also "search/look/google … on the web" → {"a":"browse"} with the query. Only use {"a":"search"} to search AndreOS itself.
- "his research", "his publications", "his papers" mean the Research app → {"a":"open","t":"research"}. Never web-browse for these; only github/linkedin/scholar/personal sites are {"a":"browse"}.
- A bare question, follow-up, or task about André ("summarise it", "what is it about?", "tell me about his experience", "what's his background") → a single {"a":"chat","t":"…"}. Rewrite pronouns from the conversation so the message stands alone. Do NOT return an empty array for these.
- Add a trailing {"a":"chat"} ONLY when the request itself asks a question or task. A plain "open X" has no chat.
- Plan the LATEST request only. Any earlier conversation is context for resolving references ("it", "that paper", "the 3rd one") — never skip an action or return an empty array just because something was already opened earlier.
Examples:
"open research" → [{"a":"open","t":"research"}]
"show me the projects" → [{"a":"open","t":"projects"}]
"what about his skills?" → [{"a":"open","t":"skills"}]
"show desktop" → [{"a":"desktop"}]
"ok show the desktop" → [{"a":"desktop"}]
"open the 3rd paper" → [{"a":"open_paper","n":3}]
"summarise it for me" → [{"a":"chat","t":"summarise this paper"}]
"what is it about?" → [{"a":"chat","t":"what is this about"}]
"pop open his github page" → [{"a":"browse","t":"github.com/andreped"}]
"go to github.com" → [{"a":"browse","t":"github.com"}]
"show me his publications" → [{"a":"open","t":"research"}]
"search the web for digital pathology" → [{"a":"browse","t":"digital pathology"}]
"open resume and tell me about his experience" → [{"a":"open","t":"resume"},{"a":"chat","t":"tell me about his experience"}]
"open research, open 40th paper, and summarize important topics" → [{"a":"open","t":"research"},{"a":"open_paper","n":40},{"a":"chat","t":"summarize important topics in this paper"}]
Multi-turn example (earlier turns already ran — still plan the latest request):
  [earlier: user "open research" → assistant "Opened research."]
  "open the 3rd paper" → [{"a":"open_paper","n":3}]
Reply with ONLY the JSON array for the latest request.${histCtx ? `\nEarlier conversation (context only — do not re-plan it):\n${histCtx}` : ''}
Request: "${text.replace(/"/g, "'")}"`;

        try {
            // Classification doesn't benefit from reasoning and loops with it — keep it fast/deterministic.
            const raw = await completeText([{ role: 'user', content: prompt }],
                { maxTokens: 150, temperature: 0.1, think: false });
            const jsonMatch = raw.match(/\[[\s\S]*?\]/);
            if (!jsonMatch) return null;
            const actions = JSON.parse(jsonMatch[0]);
            return Array.isArray(actions) && actions.length > 0 ? actions : null;
        } catch (err) {
            console.warn('[AndreChat] parseCommand failed:', err);
            return null;
        }
    },

    async routeIntent(text, history = []) {
        if (engineState !== 'ready') return null;
        const histCtx = history.slice(-4)
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n');
        const prompt =
`You are AndreOS's intent router. Classify the user's latest message as "command" or "direct".
- "command" = an OS action: open/show/close/minimize a named app or window; show desktop; browse or search the web; open a numbered paper; or act on the current app (sort, filter, find papers). Includes non-English, e.g. Norwegian ("åpne", "lukk", "vis").
- "direct" = a question or conversation to answer about André (bio, career, research, skills, opinions). A question about what/where/how he worked is "direct" even if it opens with "show me" or "tell me" (nothing gets opened).
${histCtx ? `Recent conversation:\n${histCtx}\n` : ''}Reply with ONLY "command" or "direct".
Examples:
"open research" → command
"show me the projects app" → command
"show desktop" → command
"go to github.com" → command
"take me to his github" → command
"search the web for medical imaging" → command
"sort by most cited" → command
"filter to only journals" → command
"find pathology papers" → command
"lukk vinduet" → command
"who is André?" → direct
"tell me about his work" → direct
"show me what he worked on at SINTEF" → direct
"what programming languages does he know?" → direct
"can you tell me about his projects" → direct
Message: "${text.replace(/"/g, "'")}"`;
        try {
            // Classification doesn't benefit from reasoning and loops with it — keep it fast/deterministic.
            const out = (await completeText([{ role: 'user', content: prompt }],
                { maxTokens: 8, temperature: 0, think: false })).toLowerCase();
            return out.includes('command') ? 'command' : 'direct';
        } catch {
            return null;
        }
    },

    /**
     * Returns a Promise that resolves when the engine reaches 'ready'.
     * Rejects after timeoutMs (default 2 min) or if the engine errors out.
     * Safe to call at any time — resolves immediately if already ready.
     */
    whenReady(timeoutMs = 120_000) {
        if (engineState === 'ready') return Promise.resolve();
        return new Promise((resolve, reject) => {
            const deadline = Date.now() + timeoutMs;
            const poll = () => {
                if (engineState === 'ready')  return resolve();
                if (engineState === 'error')  return reject(new Error('Engine failed to load'));
                if (Date.now() > deadline)    return reject(new Error('Engine load timed out'));
                setTimeout(poll, 500);
            };
            poll();
        });
    },

    async retry() {
        await unloadEngine();
        const label = (MODELS.find(m => m.id === getModelId()) ?? getCpuModel())?.name ?? getModelId();
        const blurb = getCpuModel()
            ? 'Runs on your CPU — no GPU needed.<br>First load downloads the weights (cached after).'
            : 'A local AI running entirely in your browser.<br>First load downloads the weights (cached after).';
        registeredWindows.forEach(winEl => {
            const overlay = winEl.querySelector('.chat-load-overlay');
            if (overlay) overlay.innerHTML = `
                <div class="chat-load-icon">🤖</div>
                <div class="chat-load-title">${label}</div>
                <div class="chat-load-subtitle">${blurb}</div>
                <div class="chat-progress-track"><div class="chat-progress-fill"></div></div>
                <div class="chat-load-status">Starting…</div>
            `;
        });
        loadEngine();
    }
};

// ── Start loading on page load ────────────────────────────────────────────────
if (navigator.gpu || isCpuModel()) {
    loadEngine();
} else {
    console.warn('[AndreChat] WebGPU not available — model will not load.');
}

// ── React to settings changes ─────────────────────────────────────────────────
document.addEventListener('andreos:settings-apply', () => {
    if (!navigator.gpu && !isCpuModel()) return;
    sessionStorage.removeItem('andreos:model-loaded'); // show NC card for new model
    window.AndreChat.retry();
});
