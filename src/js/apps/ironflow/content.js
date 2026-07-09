/** IronFlow window content (embedded app iframe). */
export function render() {
    return `
        <div class="game-viewport">
            <iframe class="ironflow-iframe"
                src="https://ironflow-bfo.pages.dev/"
                credentialless
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                referrerpolicy="no-referrer"></iframe>
            <div class="browser-blocked ironflow-blocked">
                <div class="blocked-icon">&#128683;</div>
                <p>IronFlow couldn&#39;t load — the server may not allow embedding.</p>
                <a class="blocked-newtab" href="https://ironflow-bfo.pages.dev/" target="_blank" rel="noopener noreferrer">Open in new tab &#8599;</a>
            </div>
            <div class="browser-loading">
                <div class="browser-spinner"></div>
            </div>
        </div>
    `;
}
