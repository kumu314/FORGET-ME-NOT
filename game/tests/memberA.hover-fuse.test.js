import { describe, it, expect } from 'vitest';
import { HOVER_FUSE, updateHoverWatch } from '../src/entities/hoverFuse.js';

describe('悬浮保险丝（issue #74）', () => {
  it('持续低速滞空 2 秒后触发一次', () => {
    let watchMs = 0;
    let cooldownMs = 0;
    let tripped = 0;
    for (let i = 0; i < 40; i += 1) { // 40 帧 × 50ms = 2000ms
      const r = updateHoverWatch(watchMs, 50, false, -60, cooldownMs);
      watchMs = r.watchMs;
      cooldownMs = r.cooldownMs;
      if (r.tripped) tripped += 1;
    }
    expect(tripped).toBe(1);
    expect(cooldownMs).toBe(HOVER_FUSE.cooldownMs);
  });

  it('落地即清零，不误伤正常跳跃', () => {
    const r1 = updateHoverWatch(1500, 50, false, -300, 0); // 正常起跳（高速上冲）
    expect(r1.watchMs).toBe(0);
    const r2 = updateHoverWatch(1500, 50, true, 0, 0); // 落地
    expect(r2.watchMs).toBe(0);
    expect(r2.tripped).toBe(false);
  });

  it('高速坠落/上升不累计', () => {
    expect(updateHoverWatch(900, 50, false, 620, 0).watchMs).toBe(0);
    expect(updateHoverWatch(900, 50, false, -310, 0).watchMs).toBe(0);
  });

  it('冷却期内即使再次低速滞空也不重复触发', () => {
    let watchMs = 0;
    let cooldownMs = HOVER_FUSE.cooldownMs; // 刚触发过
    let tripped = 0;
    for (let i = 0; i < 40; i += 1) {
      const r = updateHoverWatch(watchMs, 50, false, -60, cooldownMs);
      watchMs = r.watchMs;
      cooldownMs = r.cooldownMs;
      if (r.tripped) tripped += 1;
    }
    expect(tripped).toBe(0);
  });
});
