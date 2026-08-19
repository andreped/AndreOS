/**
 * Self-check for the System Monitor load estimators (pure math only — no DOM).
 * Run: node src/js/apps/monitor/monitor.selfcheck.mjs
 */
import assert from 'node:assert/strict';
import { estimateCpuPct, estimateGpuPct } from './window.js';

// CPU: no lag → ~0%; lag == interval → clamps to 100%; always in [0,100].
assert.equal(estimateCpuPct(0, 250), 0);
assert.equal(estimateCpuPct(250, 250), 100);
assert.equal(estimateCpuPct(1000, 250), 100, 'huge lag stays clamped');

// CPU: a real pressure reading dominates (0.6) but lag still nudges (0.4).
assert.equal(estimateCpuPct(0, 250, 100), 60);   // 0*0.4 + 100*0.6
assert.equal(estimateCpuPct(250, 250, 0), 40);   // 100*0.4 + 0*0.6

// GPU: a healthy 16.6ms frame → 0%; 3× overshoot past budget → 100%.
const budget = 1000 / 60;
assert.equal(estimateGpuPct(budget), 0);
assert.equal(estimateGpuPct(budget * 4), 100, 'sustained jank clamps to 100%');
assert.ok(estimateGpuPct(budget * 2) > 0 && estimateGpuPct(budget * 2) < 100);

console.log('monitor selfcheck: OK');
