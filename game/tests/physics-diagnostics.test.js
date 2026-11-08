import { describe, expect, it } from 'vitest';
import { createAirborneWatch } from '../src/core/PhysicsDiagnostics.js';
const air = (wallMs, extra = {}) => ({ wallMs, grounded: false, dead: false, modal: false,
  transitioning: false, paused: false, vy: -60, ...extra });
describe('non-mutating airborne diagnostics', () => {
  it('requires two wall-clock seconds; pumped scene updates do not count', () => {
    const watch = createAirborneWatch();
    for (let i = 0; i < 500; i++) expect(watch(air(i / 100))).toBe(false);
    expect(watch(air(2000))).toBe(true);
    expect(watch(air(2100))).toBe(false);
  });
  it.each([{ grounded: true }, { dead: true }, { modal: true }, { transitioning: true },
    { paused: true }, { vy: 150 }])('resets on expected movement or suspension: %j', (state) => {
    const watch = createAirborneWatch();
    expect(watch(air(0))).toBe(false);
    expect(watch(air(1900, state))).toBe(false);
    expect(watch(air(2000))).toBe(false);
    expect(watch(air(4000))).toBe(true);
  });
});
