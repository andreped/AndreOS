/** Cast Arena game window content (embedded game iframe). */
export function render() {
    return `
        <div class="game-viewport">
            <iframe class="game-iframe"
                src="https://cast-arena-io.onrender.com/"
                credentialless
                allow="accelerometer; autoplay; clipboard-write; fullscreen; gamepad; pointer-lock"
                referrerpolicy="no-referrer"></iframe>
            <div class="browser-blocked game-blocked">
                <div class="blocked-icon">&#128683;</div>
                <p>Game couldn't load — the server may not allow embedding.</p>
                <a class="blocked-newtab" href="https://cast-arena-io.onrender.com/" target="_blank" rel="noopener noreferrer">Open in new tab &#8599;</a>
            </div>
            <div class="browser-loading">
                <div class="browser-spinner"></div>
            </div>
        </div>
    `;
}
