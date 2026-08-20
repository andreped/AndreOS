/**
 * Runnable check for the tour card placement geometry.
 * Run: node src/js/platform/shell/OnboardingTour.selfcheck.mjs
 */
import assert from 'node:assert/strict';
import { placeCard } from './OnboardingTour.js';

const rect = (left, top, w, h) => ({ left, top, width: w, height: h, right: left + w, bottom: top + h });
const VW = 1440, VH = 900, CW = 300, CH = 160;

// Small icon near the top-left → card goes below it.
{
    const r = rect(40, 40, 64, 64);
    const p = placeCard(r, CW, CH, VW, VH);
    assert.equal(p.top, r.bottom + 14, 'card should sit just below a top-left icon');
}

// Icon hugging the bottom edge (no room below) → flips above.
{
    const r = rect(40, VH - 80, 64, 64);
    const p = placeCard(r, CW, CH, VW, VH);
    assert.equal(p.top, r.top - 14 - CH, 'card should flip above when the target is at the bottom');
}

// Tall right-edge sidebar (full height, no room below/above) → card goes to its left.
{
    const r = rect(VW - 360, 0, 360, VH);
    const p = placeCard(r, CW, CH, VW, VH);
    assert.equal(p.left, r.left - 14 - CW, 'card should sit left of a full-height right sidebar');
}

// Card never overflows the viewport horizontally (icon flush to the right edge).
{
    const r = rect(VW - 64, 40, 64, 64);
    const p = placeCard(r, CW, CH, VW, VH);
    assert.ok(p.left >= 12 && p.left + CW <= VW - 12, 'card must stay within the viewport');
}

console.log('OnboardingTour placeCard: all checks passed ✓');
