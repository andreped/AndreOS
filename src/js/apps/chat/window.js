/**
 * Delegates chat window setup to window.AndreChat (chat.js module).
 * Polls briefly if chat.js hasn't finished loading yet.
 * @param {HTMLElement} winEl
 */
export function setupChatWindow(winEl) {
    if (window.AndreChat) {
        window.AndreChat.setupWindow(winEl);
        return;
    }
    const retry = setInterval(() => {
        if (window.AndreChat) {
            clearInterval(retry);
            window.AndreChat.setupWindow(winEl);
        }
    }, 100);
    setTimeout(() => clearInterval(retry), 5000);
}
