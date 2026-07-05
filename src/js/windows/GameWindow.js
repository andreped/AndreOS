/**
 * Wires up the game iframe inside a game window element.
 * @param {HTMLElement} winEl
 */
export function setupGameWindow(winEl) {
    const iframe  = winEl.querySelector('.game-iframe');
    const blocked = winEl.querySelector('.game-blocked');
    const loading = winEl.querySelector('.browser-loading');

    if (!iframe) return;

    iframe.addEventListener('load', () => {
        if (loading) loading.style.display = 'none';
        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const isBlocked = !doc || !doc.body || doc.body.innerHTML.trim() === '';
            if (blocked) blocked.style.display = isBlocked ? 'flex' : 'none';
        } catch (_) {
            if (blocked) blocked.style.display = 'none';
        }
    });

    // Return focus to the window element when the header is clicked,
    // so Escape / keyboard shortcuts still work after interacting with the iframe.
    const header = winEl.querySelector('.window-header');
    if (header) {
        header.addEventListener('mousedown', () => {
            iframe.blur();
            winEl.focus({ preventScroll: true });
        });
    }
    winEl.setAttribute('tabindex', '-1');
}
