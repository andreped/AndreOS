/** Browser window content (chrome + iframe viewport). */
export function render() {
    return `
        <div class="browser-chrome">
            <div class="browser-toolbar">
                <button class="nav-btn back-btn" title="Back">&#8592;</button>
                <button class="nav-btn fwd-btn" title="Forward">&#8594;</button>
                <button class="nav-btn reload-btn" title="Reload">&#8635;</button>
                <input class="url-bar" type="text" spellcheck="false" placeholder="Enter a URL or search...">
                <a class="nav-btn newtab-btn" href="#" target="_blank" rel="noopener noreferrer" title="Open in new tab">&#8599;</a>
            </div>
            <div class="browser-bookmarks">
                <button class="bm-chip" data-url="https://andreped.dev">&#127968; My Site</button>
                <button class="bm-chip" data-url="https://yep.com">&#128269; Yep</button>
                <button class="bm-chip" data-url="https://en.wikipedia.org/wiki/Artificial_intelligence">&#128218; Wikipedia</button>
                <button class="bm-chip" data-url="https://www.nettavisen.no">&#128240; Nettavisen</button>
                <button class="bm-chip" data-url="https://andreped-aeropath.hf.space">&#129978; AeroPath</button>
                <button class="bm-chip" data-url="https://andreped-lynos.hf.space">&#129704; LyNoS</button>
            </div>
            <div class="browser-viewport">
                <iframe class="browser-iframe"
                    credentialless
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    referrerpolicy="no-referrer"></iframe>
                <div class="browser-blocked">
                    <div class="blocked-icon">&#128683;</div>
                    <p>This site doesn&#39;t allow embedding.</p>
                    <a class="blocked-newtab" href="#" target="_blank" rel="noopener noreferrer">Open in new tab &#8599;</a>
                </div>
                <div class="browser-loading">
                    <div class="browser-spinner"></div>
                </div>
            </div>
        </div>
    `;
}
