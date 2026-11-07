import { describe, expect, it, vi } from 'vitest';
import { BattleHUD } from '../src/ui/BattleHUD.js';

function makeHud() {
  const ctx = new Proxy({
    fillText: vi.fn(),
    measureText: (text) => ({ width: text.length * 8 }),
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const hud = new BattleHUD({ width: 480, height: 270, getContext: () => ctx });
  return { hud, ctx };
}

describe('battle HUD complete render path', () => {
  it('renders without XP or Boss before the first frame sync', () => {
    const { hud } = makeHud();
    expect(() => hud.render()).not.toThrow();
  });

  it('renders the experience level once alongside player and Boss bars', () => {
    const { hud, ctx } = makeHud();
    hud.setXp({ level: 3, xp: 12, next: 50 });
    hud.showBoss({ name: '巨影班主任', hp: 200, maxHp: 420 });
    expect(() => hud.render()).not.toThrow();
    expect(ctx.fillText.mock.calls.filter(([text]) => text === 'Lv.3')).toHaveLength(1);
    expect(ctx.fillText.mock.calls.some(([text]) => text === '巨影班主任')).toBe(true);
  });
});
