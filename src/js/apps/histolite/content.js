/** HistoLite window content — a bare full-bleed embed of the HistoLite web app. */
export function render() {
    return `
        <iframe class="histolite-iframe"
            src="https://histolite.pages.dev/"
            credentialless
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerpolicy="no-referrer"></iframe>
    `;
}
