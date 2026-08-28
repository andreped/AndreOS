/** Waddle game window content (embedded playtest build). */
export function render() {
    return `
        <div class="game-viewport">
            <div class="waddle-note">
                <span class="waddle-note-badge">Playtest</span>
                Demo build for playtesting only — not public and may be out of date.
            </div>
            <iframe class="game-iframe waddle-iframe"
                src="https://waddle.andrped94.workers.dev/"
                credentialless
                allow="accelerometer; autoplay; clipboard-write; fullscreen; gamepad; pointer-lock"
                referrerpolicy="no-referrer"></iframe>
            <div class="browser-blocked game-blocked">
                <div class="blocked-icon">&#128683;</div>
                <p>Game couldn't load — the server may not allow embedding.</p>
                <a class="blocked-newtab" href="https://waddle.andrped94.workers.dev/" target="_blank" rel="noopener noreferrer">Open in new tab &#8599;</a>
            </div>
            <div class="browser-loading">
                <div class="browser-spinner"></div>
            </div>
        </div>
    `;
}
