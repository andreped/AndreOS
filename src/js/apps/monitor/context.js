/**
 * System Monitor assistant context provider.
 *
 * The window pushes a live snapshot every tick; this exposes the current
 * readings (plus a short rolling average/peak) as an LLM-ready block so the
 * assistant can answer "how's my CPU?" while the monitor is on screen. The
 * numbers are browser best-effort estimates — the block says so, so the model
 * doesn't present them as exact hardware counters.
 */
const RING = 60; // ~15s of history at the 250ms tick

let _latest = null;
const _cpu = [];
const _gpu = [];

const push = (ring, v) => { ring.push(v); if (ring.length > RING) ring.shift(); };
const avg = (ring) => (ring.length ? Math.round(ring.reduce((a, b) => a + b, 0) / ring.length) : 0);
const peak = (ring) => (ring.length ? Math.max(...ring) : 0);

export const monitorContext = {
    /** @param {object} snapshot latest readings from the monitor window */
    setSnapshot(snapshot) {
        _latest = snapshot;
        push(_cpu, snapshot.cpuPct);
        push(_gpu, snapshot.gpuPct);
    },

    clear() { _latest = null; _cpu.length = 0; _gpu.length = 0; },

    getContextBlock() {
        const s = _latest;
        if (!s) return '';
        return `## System Monitor — live readings on screen\n` +
            `These are the browser's best-effort, real-time *estimates* (host CPU/GPU % ` +
            `is not exposed to web pages), not exact hardware counters.\n` +
            `- CPU load: ${s.cpuPct}% now (avg ${avg(_cpu)}%, peak ${peak(_cpu)}%), pressure state: ${s.cpuState}\n` +
            `- GPU / render load: ${s.gpuPct}% now (avg ${avg(_gpu)}%, peak ${peak(_gpu)}%), ${s.fps} fps\n` +
            `- CPU cores: ${s.cores}\n` +
            `- System RAM (approx): ${s.memGB}\n` +
            `- JS heap: ${s.heap}\n` +
            `- Battery: ${s.battery}\n` +
            `- GPU adapter: ${s.gpuName}\n\n` +
            `When the user says "CPU", "GPU", "my system", "this", etc., they mean the readings above. ` +
            `Answer from these values, and remind the user they are estimates if they ask for exact utilisation.`;
    },
};
