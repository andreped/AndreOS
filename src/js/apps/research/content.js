/** Research window content (publication list + detail pane). */
export function render() {
    return `
        <div class="research-root">
            <div class="research-status">
                <div class="research-loading">
                    <div class="research-spinner"></div>
                    <p>Loading publications&hellip;</p>
                </div>
            </div>
            <div class="research-body research-split" style="display:none;">
                <div class="research-pane research-pane--list">
                    <div class="research-stats"></div>
                    <div class="research-toolbar">
                        <input type="search" class="research-search" placeholder="Search publications&hellip;" />
                        <select class="research-sort">
                            <option value="cited">Most cited</option>
                            <option value="date">Newest first</option>
                            <option value="asc">Oldest first</option>
                        </select>
                    </div>
                    <div class="research-filters"></div>
                    <div class="research-list"></div>
                </div>
                <div class="research-pane research-pane--detail">
                    <div class="research-detail-empty">
                        <div class="research-detail-empty-icon">📄</div>
                        <p>Select a publication to read it here.</p>
                    </div>
                    <div class="research-detail" hidden>
                        <div class="research-detail-header">
                            <div class="research-detail-title"></div>
                            <div class="research-detail-tabs">
                                <button class="research-tab active" data-view="pdf">PDF</button>
                                <button class="research-tab" data-view="abstract">Abstract</button>
                            </div>
                            <div class="research-detail-actions">
                                <a class="research-detail-link research-detail-doi" target="_blank" rel="noopener noreferrer" hidden>DOI ↗</a>
                                <a class="research-detail-link research-detail-newtab" target="_blank" rel="noopener noreferrer" hidden>Open ↗</a>
                            </div>
                        </div>
                        <div class="research-detail-viewer">
                            <div class="research-pdf-loading">
                                <div class="research-spinner"></div>
                                <p>Loading paper&hellip;</p>
                            </div>
                            <div class="research-pdf-canvas"></div>
                            <div class="research-pdf-blocked" hidden>
                                <div class="research-pdf-blocked-icon">🔒</div>
                                <p>This publisher doesn't allow reading the PDF inside the app.</p>
                                <a class="research-pdf-blocked-link" target="_blank" rel="noopener noreferrer">Open in a new tab ↗</a>
                            </div>
                            <div class="research-pdf-none" hidden>
                                <div class="research-pdf-blocked-icon">🚫</div>
                                <p>No open-access PDF is available — showing the abstract instead.</p>
                            </div>
                            <div class="research-abstract-view" hidden>
                                <div class="research-abstract-meta"></div>
                                <div class="research-abstract-text"></div>
                            </div>
                            <div class="research-pdf-zoom" hidden>
                                <button class="research-zoom-out" title="Zoom out">−</button>
                                <span class="research-zoom-level">100%</span>
                                <button class="research-zoom-in" title="Zoom in">+</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
