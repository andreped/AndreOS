/** Ask André chat window content. */
export function render() {
    return `
        <div class="chat-app">
            <div class="chat-load-overlay">
                <div class="chat-load-icon">⚙️</div>
                <div class="chat-load-title chat-model-name">AI Model</div>
                <div class="chat-load-subtitle">Compiling WebGPU shaders…<br><span style="opacity:0.5;font-size:11px">This takes ~30 s the first time, then weights are downloaded and cached.</span></div>
                <div class="chat-progress-track">
                    <div class="chat-progress-fill"></div>
                </div>
                <div class="chat-load-status">Initializing…</div>
            </div>
            <div class="chat-messages-area" style="display:none"></div>
            <div class="chat-input-row" style="display:none">
                <button class="chat-clear" data-tooltip="Clear conversation"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M9 3v1H4v2h1v13a2 2 0 002 2h10a2 2 0 002-2V6h1V4h-5V3H9zm0 5h2v9H9V8zm4 0h2v9h-2V8z"/></svg></button>
                <input class="chat-input" type="text" placeholder="Ask anything about André..." autocomplete="off" spellcheck="false">
                <button class="chat-send" data-tooltip="Send message"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
            </div>
        </div>
    `;
}
