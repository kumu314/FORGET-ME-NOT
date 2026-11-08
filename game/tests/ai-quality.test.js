import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {
  Physics: { Arcade: { Sprite: class {} } },
  Math: { Distance: { Between: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by) } },
} }));

import { AI, DOG, MONSTERS } from '../src/config/aiConfig.js';
import { LIFECYCLE } from '../src/config/gameConfig.js';
import { MonsterFSM, MonsterTypes } from '../src/ai/MonsterFSM.js';
import { AIManager } from '../src/ai/AIManager.js';
import Player from '../src/entities/Player.js';
import { DogCompanion } from '../src/ai/DogCompanion.js';
import { installJuice, JUICE } from '../src/fx/Juice.js';
import { grantStagePassive, installStagePassives, recoverMeleeKillMp } from '../src/entities/stagePassives.js';

function registry() {
  const data = new Map();
  return { get: (key) => data.get(key), set: (key, value) => data.set(key, value) };
}
function hero() {
  return { phase: LIFECYCLE.youth, mp: 20, maxMp: 50, takeDamage: vi.fn() };
}

describe('青年掉落的实际效果与来源', () => {
  it.each(['youth', 'middle', 'elder'])('%s真实Player横向控制应用15%移速且跨关恢复', (phaseId) => {
    const save = registry();
    const velocity = { x: 0 };
    const p = Object.assign(Object.create(Player.prototype), {
      phaseId, phase: LIFECYCLE[phaseId], hurtLockMs: 0, blockHeldForMs: 0, coughMs: 0,
      body: { blocked: { down: true }, touching: {}, velocity },
      setFlipX: vi.fn(), setVelocityX: (x) => { velocity.x = x; },
    });
    p._handleHorizontal(16, { right: true });
    const baselineSpeed = velocity.x;
    grantStagePassive(hero(), save, 'sleepBug');
    installStagePassives(p, save);
    p._handleHorizontal(16, { right: true });
    expect(velocity.x).toBeCloseTo(baselineSpeed * 1.15);
    p._handleHorizontal(16, { left: true });
    expect(velocity.x).toBeCloseTo(-baselineSpeed * 1.15);
  });

  it('所有青年掉落均保存，重新建立角色后恢复效果', () => {
    const save = registry();
    const p = hero();
    for (const type of ['paperSpirit', 'sleepBug', 'inspector']) {
      expect(grantStagePassive(p, save, type)).toBe(true);
      expect(grantStagePassive(p, save, type)).toBe(false);
    }
    const restored = hero();
    installStagePassives(restored, save, () => 1000);
    expect([...restored.stagePassives]).toEqual(['paperSpirit', 'sleepBug', 'inspector']);
    expect(restored.broadcastExercise).toBe(true);
    expect(restored.passiveMoveMult).toBe(1.15);
    restored.applySlow(0.6, 2);
    expect(restored.stageSlowUntil).toBe(2000);
    const ordinary = hero();
    installStagePassives(ordinary, registry(), () => 1000);
    ordinary.applySlow(0.6, 2);
    expect(ordinary.stageSlowUntil).toBe(3000);
    expect(ordinary.passiveMoveMult).toBe(1);
    expect(ordinary.broadcastExercise).toBe(false);
  });

  it('举一反三仅由拥有者真实近战击杀触发，25%边界明确且MP封顶', () => {
    const p = hero();
    const info = { type: 'sleepBug', isMelee: true };
    expect(recoverMeleeKillMp(p, info, () => 0)).toBe(0);
    grantStagePassive(p, registry(), 'paperSpirit');
    expect(recoverMeleeKillMp(p, { ...info, isMelee: false }, () => 0)).toBe(0);
    expect(recoverMeleeKillMp(p, { ...info, type: 'teacher' }, () => 0)).toBe(0);
    expect(recoverMeleeKillMp(p, info, () => 0.25)).toBe(0);
    expect(recoverMeleeKillMp(p, info, () => 0.249)).toBe(5);
    expect(p.mp).toBe(25);
    p.mp = 48;
    expect(recoverMeleeKillMp(p, info, () => 0)).toBe(2);
    expect(p.mp).toBe(50);
  });

  it('MonsterFSM致命一击保留近战来源与世界坐标，远程不会沿用先前近战', () => {
    for (const opts of [{ isMelee: true }, { fromProjectile: true }]) {
      const events = new EventEmitter();
      const killed = vi.fn();
      events.on('ai:kill', killed);
      const m = Object.assign(Object.create(MonsterFSM.prototype), {
        hp: 1, x: 850, y: 210, typeKey: 'paperSpirit', def: MONSTERS.paperSpirit,
        body: { enable: true }, scene: { events, tweens: { add: vi.fn() } },
        flashHit: vi.fn(), clearTint: vi.fn(), setVelocity: vi.fn(),
      });
      m.takeDamage(5, opts);
      expect(killed).toHaveBeenCalledWith({ type: 'paperSpirit', x: 850, y: 210, exp: MONSTERS.paperSpirit.exp, isMelee: !!opts.isMelee });
    }
  });

  it('生产击杀入口先结算已有被动，不能通过首次掉落追溯获得5MP', () => {
    const save = registry();
    const p = hero();
    const ai = Object.assign(Object.create(AIManager.prototype), {
      exp: 0, seenDrops: new Set(), player: p,
      scene: { events: new EventEmitter(), game: { registry: save } },
    });
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      ai.onKill({ type: 'paperSpirit', exp: 10, isMelee: true });
      expect(p.mp).toBe(20);
      ai.onKill({ type: 'inspector', exp: 10, isMelee: true });
      expect(p.mp).toBe(25);
      expect(p.broadcastExercise).toBe(true);
      ai.onKill({ type: 'paperSpirit', exp: 10, isMelee: false });
      expect(p.mp).toBe(25);
    } finally { random.mockRestore(); }
  });
});

describe('Scene重复启动后的顿帧和屏震', () => {
  it('每次启动仅保留本轮四个监听，shutdown取消计时器并恢复timescale', () => {
    const events = new EventEmitter();
    const pending = [];
    const scene = { events, time: { now: 0, delayedCall: (_, callback) => {
      const timer = { callback, remove: vi.fn() }; pending.push(timer); return timer;
    } }, physics: { world: { timeScale: 1 } }, cameras: { main: { shake: vi.fn() } } };
    const externalListener = vi.fn();
    events.on('ai:fx', externalListener);
    for (let cycle = 0; cycle < 3; cycle++) {
      scene.time.now = cycle * 1000;
      installJuice(scene);
      installJuice(scene);
      expect(events.listenerCount('ai:damage')).toBe(1);
      expect(events.listenerCount('ai:fx')).toBe(2);
      events.emit('ai:damage');
      expect(scene.physics.world.timeScale).toBe(JUICE.hitStopTimeScale);
      events.emit('player:damaged');
      events.emit('ai:fx', { type: 'explode' });
      events.emit('ai:boss:phase');
      expect(scene.cameras.main.shake).toHaveBeenCalledTimes((cycle + 1) * 3);
      events.emit('shutdown');
      expect(pending.at(-1).remove).toHaveBeenCalledWith(false);
      expect(scene.physics.world.timeScale).toBe(1);
      expect(scene._juiceInstalled).toBe(false);
      for (const key of ['ai:damage', 'player:damaged', 'ai:boss:phase']) expect(events.listenerCount(key)).toBe(0);
      expect(events.listeners('ai:fx')).toEqual([externalListener]);
    }
  });
});

describe('二关自定义追击仍遵循侦测和脱战距离', () => {
  it.each(['overtimeGhost', 'requirementVortex'])('%s远处巡逻、近处追击，超出leash返回巡逻', (type) => {
    const velocity = { x: 0 };
    const m = Object.assign(Object.create(MonsterTypes[type].prototype), {
      active: true, state: 'PATROL', x: 1000, y: 184, homeX: 1000, homeY: 184, patrolDir: 1,
      def: MONSTERS[type], player: { x: 48, y: 184, mp: 50 }, shieldActive: true,
      body: { velocity, setVelocityX: (value) => { velocity.x = value; } },
      setFlipX: vi.fn(), hover: vi.fn(), updateContact: vi.fn(),
    });
    m.update(1000, 16);
    expect(m.state).toBe('PATROL');
    expect(velocity.x).toBe(MONSTERS[type].patrolSpeed);
    m.player.x = m.x - AI.detectRange + 1;
    m.update(1016, 16);
    expect(m.state).toBe('CHASE');
    expect(velocity.x).toBe(-MONSTERS[type].chaseSpeed);
    m.player.x = m.x - AI.detectRange - 10;
    m.update(1032, 16);
    expect(m.state).toBe('CHASE');
    m.player.x = m.x - AI.leashRange - 1;
    m.update(1048, 16);
    expect(m.state).toBe('PATROL');
    expect(velocity.x).toBe(MONSTERS[type].patrolSpeed);
    if (m.def.flying) expect(m.baseY).toBe(m.homeY);
  });
});

function adultDog() {
  return Object.assign(Object.create(DogCompanion.prototype), {
    form: 'adult', def: DOG.forms.adult, x: 90, y: 200, nextHealAt: 10000,
    player: { x: 100, y: 200, hp: 48, maxHp: 120, isGrounded: true, body: { velocity: { x: 0 } } },
    ai: { aliveMonsters: () => [], activeBoss: () => null, lastPlayerDamageAt: 0,
      bullets: { ofFaction: () => [], release: vi.fn() } },
    scene: { events: new EventEmitter() }, setAction: vi.fn(),
  });
}
describe('成年忠犬的驻足治疗和主动护主', () => {
  it('离地、移动、近敌、近期受击或出招时不能回血，脱战驻足才回复10HP', () => {
    const dog = adultDog();
    dog.player.isGrounded = false;
    dog.updateHealAura(10000);
    dog.player.isGrounded = true;
    dog.player.body.velocity.x = 120;
    dog.updateHealAura(10000);
    dog.player.body.velocity.x = 0;
    dog.ai.aliveMonsters = () => [{ x: 105, y: 200 }];
    dog.updateHealAura(10000);
    dog.ai.aliveMonsters = () => [];
    dog.ai.lastPlayerDamageAt = 9000;
    dog.updateHealAura(10000);
    dog.ai.lastPlayerDamageAt = 0;
    dog.player._inRecovery = true;
    dog.updateHealAura(10000);
    expect(dog.player.hp).toBe(48);
    dog.player._inRecovery = false;
    dog.updateHealAura(10000);
    expect(dog.player.hp).toBe(58);
    dog.updateHealAura(19999);
    expect(dog.player.hp).toBe(58);
  });

  it('不需格挡或信雨，红点包围与公章波已能触发主动保护；其他弹不被清除', () => {
    const dog = adultDog();
    const dots = [110, 90].map((x) => ({ x, y: 200, typeKey: 'unreadDot', defuse: vi.fn() }));
    dog.ai.aliveMonsters = () => [dots[0]];
    dog.guardExplosives();
    expect(dots[0].defuse).not.toHaveBeenCalled();
    dog.ai.aliveMonsters = () => dots;
    dog.guardExplosives();
    for (const dot of dots) expect(dot.defuse).toHaveBeenCalledOnce();
    dog.ai.aliveMonsters = () => [];
    const wave = { x: 130, y: 200, source: 'shockwave' };
    const farWave = { x: 400, y: 200, source: 'shockwave' };
    const smoke = { x: 110, y: 200, source: 'projectile' };
    dog.ai.bullets.ofFaction = () => [wave, farWave, smoke];
    dog.guardExplosives();
    expect(dog.ai.bullets.release).toHaveBeenCalledOnce();
    expect(dog.ai.bullets.release).toHaveBeenCalledWith(wave);
  });
});
