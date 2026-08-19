/** System Monitor window content — real-time, best-effort load visualisation. */

export function render() {
    return `
    <div class="monitor-app">
        <div class="monitor-gauges">
            <div class="monitor-gauge" data-metric="cpu">
                <div class="monitor-gauge-head">
                    <span class="monitor-gauge-title">CPU load</span>
                    <span class="monitor-gauge-badge" id="mon-cpu-state">—</span>
                </div>
                <div class="monitor-gauge-value"><span id="mon-cpu-val">0</span><small>%</small></div>
                <canvas class="monitor-spark" id="mon-cpu-spark"></canvas>
                <div class="monitor-gauge-note">Event-loop lag estimate, refined by the Compute&nbsp;Pressure API where available.</div>
            </div>
            <div class="monitor-gauge" data-metric="gpu">
                <div class="monitor-gauge-head">
                    <span class="monitor-gauge-title">GPU / Render load</span>
                    <span class="monitor-gauge-badge" id="mon-gpu-fps">— fps</span>
                </div>
                <div class="monitor-gauge-value"><span id="mon-gpu-val">0</span><small>%</small></div>
                <canvas class="monitor-spark" id="mon-gpu-spark"></canvas>
                <div class="monitor-gauge-note">Frame-time proxy from <code>requestAnimationFrame</code>. Rises when the compositor/GPU is busy.</div>
            </div>
        </div>

        <div class="monitor-tiles">
            <div class="monitor-tile"><span class="monitor-tile-label">CPU cores</span><span class="monitor-tile-value" id="mon-cores">—</span></div>
            <div class="monitor-tile"><span class="monitor-tile-label">System RAM (approx)</span><span class="monitor-tile-value" id="mon-mem">—</span></div>
            <div class="monitor-tile"><span class="monitor-tile-label">JS heap</span><span class="monitor-tile-value" id="mon-heap">—</span></div>
            <div class="monitor-tile"><span class="monitor-tile-label">Battery</span><span class="monitor-tile-value" id="mon-battery">—</span></div>
            <div class="monitor-tile monitor-tile--wide"><span class="monitor-tile-label">GPU adapter</span><span class="monitor-tile-value" id="mon-gpu-name">—</span></div>
        </div>

        <p class="monitor-disclaimer">
            Browsers are sandboxed: there is no web API for exact host CPU/GPU utilisation.
            These are honest real-time <em>estimates</em> derived from what the page can measure.
        </p>
    </div>`;
}
