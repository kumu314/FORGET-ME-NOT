import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {
  Physics: { Arcade: { Sprite: class {} } },
  Geom: { Intersects: { RectangleToRectangle: () => true } },
  Math: {
    Distance: { Between: (leftX, leftY, rightX, rightY) => Math.hypot(leftX - rightX, leftY - rightY) },
    Between: (min) => min,
  },
} }));

import { AIManager } from '../src/ai/AIManager.js';
import { MonsterTypes } from '../src/ai/MonsterFSM.js';
import { BossAdmin } from '../src/ai/BossAdmin.js';
import { BOSS, MONSTERS } from '../src/config/aiConfig.js';

function scene() {
  return {
    events: { emit: vi.fn() },
    time: { now: 100, delayedCall: (delay, callback) => callback() },
    ai: { bullets: { spawn: vi.fn() } },
    cameras: { main: { shake: vi.fn(), scrollX: 0, scrollY: 0, width: 480 } },
  };
}

function monster(type) {
  return Object.assign(Object.create(MonsterTypes[type].prototype), {
    x: 100, y: 200, hp: 100, typeKey: type, def: MONSTERS[type], scene: scene(),
    player: { x: 105, y: 200, mp: 50, takeDamage: vi.fn() },
    body: { setVelocityX: vi.fn(), setVelocityY: vi.fn(), blocked: {} },
    setVisible: vi.fn(), setFlipX: vi.fn(), setTint: vi.fn(), clearTint: vi.fn(),
    flashHit: vi.fn(), die: vi.fn(), hover: vi.fn(),
  });
}

describe('二关敌人实战机制', () => {
  it('红点接近后精确等1秒引爆，保留可格挡伤害入口', () => {
    const dot = monster('unreadDot');
    dot.behavior(100, 0.016);
    expect(dot.fuseAt).toBe(1100);
    dot.behavior(1099, 0.016);
    expect(dot.player.takeDamage).not.toHaveBeenCalled();
    dot.behavior(1100, 0.016);
    expect(dot.player.takeDamage).toHaveBeenCalledWith(MONSTERS.unreadDot.explodeDamage,
      expect.objectContaining({ source: 'unreadDot' }));
    expect(dot.die).toHaveBeenCalledOnce();
  });

  it('加班魂按接触时间吸蓝，远离后停止', () => {
    const ghost = monster('overtimeGhost');
    ghost.behavior(100, 0.5);
    expect(ghost.player.mp).toBe(50 - MONSTERS.overtimeGhost.drainMpPerSec * 0.5);
    ghost.player.x = 400;
    ghost.behavior(600, 0.5);
    expect(ghost.player.mp).toBe(50 - MONSTERS.overtimeGhost.drainMpPerSec * 0.5);
  });

  it('涡流将纸飞机反射为敌方弹道，空中近战破盾后可以正常受伤', () => {
    const vortex = monster('requirementVortex');
    vortex.shieldActive = true;
    const ai = Object.assign(Object.create(AIManager.prototype), {
      aliveMonsters: () => [vortex], activeBoss: () => null,
      bullets: { spawn: vi.fn() }, scene: vortex.scene,
    });
    vortex.getBounds = () => ({});
    const bullet = { active: true, x: 90, y: 200, facing: 1,
      profile: { speed: 220, damage: 16 }, body: { velocity: { x: 220, y: 0 } },
      getBounds: () => ({}), destroy: vi.fn(), registerHit: vi.fn(() => 16) };
    expect(ai.hitByProjectile(bullet)).toEqual([]);
    expect(ai.bullets.spawn).toHaveBeenCalledWith(expect.objectContaining({ vx: -220, faction: 'enemy', damage: 16 }));
    expect(bullet.destroy).toHaveBeenCalledOnce();
    expect(bullet.registerHit).not.toHaveBeenCalled();
    expect(vortex.takeDamage(10, { isMelee: true })).toBe(0);
    expect(vortex.takeDamage(10, { isMelee: true, isAir: true })).toBe(15);
    expect(vortex.shieldActive).toBe(false);
    expect(vortex.takeDamage(16, { fromProjectile: true })).toBe(16);
  });

  it('老板烟圈带减速、公章双向冲击波与半血裁员信风暴', () => {
    const boss = Object.assign(Object.create(BossAdmin.prototype), {
      x: 1440, y: 220, groundY: 240, cfg: BOSS.employer,
      player: { x: 1380 }, active: true, scene: scene(), setAnim: vi.fn(),
      setTint: vi.fn(), clearTint: vi.fn(), speak: vi.fn(), phase: 1,
      hp: BOSS.employer.hp * 0.49, hpMax: BOSS.employer.hp, nextLetterAt: 0,
    });
    boss.doSkill('smoke');
    expect(boss.scene.ai.bullets.spawn).toHaveBeenCalledTimes(3);
    expect(boss.scene.ai.bullets.spawn).toHaveBeenCalledWith(expect.objectContaining({ texture: 'bullet_ring', slow: { mult: 0.7, duration: 2 } }));
    boss.doSkill('stamp');
    expect(boss.scene.ai.bullets.spawn).toHaveBeenCalledWith(expect.objectContaining({ source: 'shockwave', vx: 150 }));
    expect(boss.scene.ai.bullets.spawn).toHaveBeenCalledWith(expect.objectContaining({ source: 'shockwave', vx: -150 }));
    boss.checkPhase(100);
    expect(boss.phase).toBe(2);
    boss.phase2Tick(boss.nextBarrageAt);
    expect(boss.scene.ai.bullets.spawn).toHaveBeenCalledWith(expect.objectContaining({ texture: 'bullet_letter', vy: 100 }));
  });

  it('击杀掉落实际授予被动，击杀载荷原有坐标不变', () => {
    const saved = new Map();
    const ai = Object.assign(Object.create(AIManager.prototype), {
      exp: 0, seenDrops: new Set(),
      player: { phase: { mp: 100 }, mp: 50 },
      scene: { events: { emit: vi.fn() }, game: { registry: { get: (key) => saved.get(key), set: (key, value) => saved.set(key, value) } } },
    });
    const info = { type: 'overtimeGhost', x: 850, y: 220, exp: 12 };
    ai.onKill(info);
    expect(ai.player.maxMp).toBe(120);
    expect(ai.exp).toBe(12);
    expect(info).toEqual({ type: 'overtimeGhost', x: 850, y: 220, exp: 12 });
  });
});
