import { describe, it, expect } from 'vitest';
import { separatePair } from '../src/ai/separation.js';

const mob = (x, y, w = 24, h = 24) => ({ x, y, width: w, height: h });

describe('怪间分离（issue #88）', () => {
  it('水平重叠的两只被推开且间距变大', () => {
    const a = mob(100, 240), b = mob(104, 240); // 间距 4 < 半宽和 24
    expect(separatePair(a, b)).toBe(true);
    expect(Math.abs(b.x - a.x)).toBeGreaterThan(4);
  });

  it('完全同坐标也稳定分离（确定性方向，不死循环）', () => {
    const a = mob(100, 240), b = mob(100, 240);
    expect(separatePair(a, b)).toBe(true);
    expect(a.x).not.toBe(b.x);
  });

  it('水平不重叠则不动', () => {
    const a = mob(100, 240), b = mob(200, 240);
    expect(separatePair(a, b)).toBe(false);
    expect(a.x).toBe(100);
    expect(b.x).toBe(200);
  });

  it('垂直错层（如地面怪与浮空怪）不分离', () => {
    const a = mob(100, 200), b = mob(104, 280);
    expect(separatePair(a, b)).toBe(false);
  });
});
