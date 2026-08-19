/**
 * System Monitor — best-effort, real-time load visualisation from the browser.
 *
 * Host CPU/GPU utilisation is not exposed to sandboxed pages, so we estimate:
 *   • CPU load  ← event-loop lag (main-thread contention), badged with the
 *                 Compute Pressure API state where the browser supports it.
 *   • GPU load  ← requestAnimationFrame frame-time vs. the 60fps budget.
 * Static facts (cores, memory, battery, GPU adapter) come from the matching
 * navigator/WebGPU APIs. All loops self-terminate once the window is closed
 * (the element is detached from the DOM → `winEl.isConnected` is false).
 */
import { monitorContext } from './context.js';

const HISTORY = 90;              // samples kept per sparkline
const FRAME_BUDGET = 1000 / 60;  // 16.67ms == a healthy 60fps frame

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * CPU load estimate. Lag as a fraction of the sampling interval gives a
 * continuous jitter signal; when the browser exposes a real Compute Pressure
 * reading we weight toward it (0.6) and keep some lag responsiveness (0.4).
 */
export function estimateCpuPct(lagMs, tickMs, pressurePct = null) {
    const jitter = clamp((lagMs / tickMs) * 100, 0, 100);
    return Math.round(pressurePct == null ? jitter : jitter * 0.4 + pressurePct * 0.6);
}

/** GPU/render load estimate: how far the worst recent frame overshot budget. */
export function estimateGpuPct(worstDeltaMs, frameBudget = FRAME_BUDGET) {
    const overshoot = Math.max(0, worstDeltaMs - frameBudget);
    return Math.round(clamp((overshoot / (frameBudget * 3)) * 100, 0, 100));
}

/** @param {HTMLElement} winEl */
export function setupMonitorWindow(winEl) {
    const $ = (id) => winEl.querySelector(`#${id}`);

    const cpuVal = $('mon-cpu-val'), cpuState = $('mon-cpu-state');
    const gpuVal = $('mon-gpu-val'), gpuFps = $('mon-gpu-fps');
    const cpuSpark = setupSpark($('mon-cpu-spark'), '#3b82f6'); // blue
    const gpuSpark = setupSpark($('mon-gpu-spark'), '#ef4444'); // red

    const alive = () => winEl.isConnected;

    // ── Static facts ────────────────────────────────────────────────────────
    $('mon-cores').textContent = navigator.hardwareConcurrency
        ? `${navigator.hardwareConcurrency} logical` : 'unknown';
    $('mon-mem').textContent = navigator.deviceMemory
        ? `~${navigator.deviceMemory} GB` : 'unavailable';

    // WebGPU adapter name (async, best-effort).
    let gpuName = 'unavailable';
    (async () => {
        try {
            const adapter = await navigator.gpu?.requestAdapter();
            const info = adapter && (adapter.info ?? await adapter.requestAdapterInfo?.());
            const name = [info?.vendor, info?.architecture, info?.description]
                .filter(Boolean).join(' ').trim();
            gpuName = name || (adapter ? 'WebGPU device' : 'WebGPU unavailable');
            if (alive()) $('mon-gpu-name').textContent = gpuName;
        } catch { gpuName = 'WebGPU unavailable'; if (alive()) $('mon-gpu-name').textContent = gpuName; }
    })();

    // Battery (Chromium only).
    let battery = null;
    navigator.getBattery?.().then((b) => { battery = b; }).catch(() => {});

    // ── Compute Pressure API — a *real* CPU pressure signal where available ──
    const PRESSURE_PCT = { nominal: 20, fair: 45, serious: 75, critical: 95 };
    let pressureState = null, pressurePct = null, pressureObs = null;
    if ('PressureObserver' in window) {
        try {
            pressureObs = new PressureObserver((records) => {
                const s = records[records.length - 1]?.state;
                if (s) { pressureState = s; pressurePct = PRESSURE_PCT[s] ?? null; }
            });
            pressureObs.observe('cpu', { sampleInterval: 500 }).catch(() => { pressureObs = null; });
        } catch { pressureObs = null; }
    }

    // ── GPU/render proxy — rolling worst frame time across each 250ms window ─
    let lastFrame = performance.now();
    let frameCount = 0, worstDelta = 0;
    const rafLoop = () => {
        if (!alive()) return;
        const now = performance.now();
        const delta = now - lastFrame;
        lastFrame = now;
        worstDelta = Math.max(worstDelta, delta);
        frameCount++;
        requestAnimationFrame(rafLoop);
    };
    requestAnimationFrame(rafLoop);

    // ── CPU proxy — event-loop lag over a fixed cadence ─────────────────────
    const TICK = 250;
    let lastTick = performance.now();
    const timer = setInterval(() => {
        if (!alive()) { clearInterval(timer); pressureObs?.disconnect?.(); monitorContext.clear(); return; }

        const now = performance.now();
        const lag = Math.max(0, (now - lastTick) - TICK);
        lastTick = now;

        // Lag as a fraction of the interval → a jitter-driven load estimate,
        // nudged toward the Compute Pressure reading when the browser gives one.
        const cpuPct = estimateCpuPct(lag, TICK, pressurePct);

        cpuVal.textContent = cpuPct;
        cpuState.textContent = pressureState ?? 'estimate';
        cpuSpark.push(cpuPct);

        // GPU: how far the worst recent frame overshot the 60fps budget.
        const fps = Math.round((frameCount / TICK) * 1000);
        const gpuPct = estimateGpuPct(worstDelta);
        worstDelta = 0; frameCount = 0;

        gpuVal.textContent = gpuPct;
        gpuFps.textContent = `${Math.min(fps, 60)} fps`;
        gpuSpark.push(gpuPct);

        if (battery) {
            $('mon-battery').textContent =
                `${Math.round(battery.level * 100)}%${battery.charging ? ' ⚡' : ''}`;
        } else if ($('mon-battery').textContent === '—') {
            $('mon-battery').textContent = 'unavailable';
        }

        const mem = performance.memory;
        if (mem) {
            $('mon-heap').textContent =
                `${(mem.usedJSHeapSize / 1048576).toFixed(0)} / ${(mem.jsHeapSizeLimit / 1048576).toFixed(0)} MB`;
        } else if ($('mon-heap').textContent === '—') {
            $('mon-heap').textContent = 'unavailable';
        }

        // Publish a snapshot so the assistant can answer about the live view.
        monitorContext.setSnapshot({
            cpuPct, cpuState: pressureState ?? 'estimate', gpuPct, fps: Math.min(fps, 60),
            cores: $('mon-cores').textContent, memGB: $('mon-mem').textContent,
            heap: $('mon-heap').textContent, battery: $('mon-battery').textContent, gpuName,
        });
    }, TICK);
}

/** Minimal rolling sparkline over a canvas. Returns a `{ push }` handle. */
function setupSpark(canvas, stroke) {
    if (!canvas) return { push() {} };
    const data = [];
    const draw = () => {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h) return;
        canvas.width = w * dpr; canvas.height = h * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);
        if (data.length < 2) return;
        const step = w / (HISTORY - 1);
        const pad = 4; // keep low values off the canvas edge so the line/glow isn't clipped
        const y = (v) => h - pad - (clamp(v, 0, 100) / 100) * (h - pad * 2);
        // Filled area under the line for a cleaner read.
        ctx.beginPath();
        ctx.moveTo(0, h);
        data.forEach((v, i) => ctx.lineTo(i * step, y(v)));
        ctx.lineTo((data.length - 1) * step, h);
        ctx.closePath();
        ctx.globalAlpha = 0.22; ctx.fillStyle = stroke; ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        data.forEach((v, i) => (i ? ctx.lineTo(i * step, y(v)) : ctx.moveTo(0, y(v))));
        ctx.lineWidth = 2.25; ctx.strokeStyle = stroke;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.shadowColor = stroke; ctx.shadowBlur = 6; // soft glow so it reads on dark surfaces
        ctx.stroke();
        ctx.shadowBlur = 0;
    };
    return {
        push(v) {
            data.push(v);
            if (data.length > HISTORY) data.shift();
            draw();
        },
    };
}
