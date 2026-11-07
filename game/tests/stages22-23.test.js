import { describe, expect, it, vi } from 'vitest';
import { LIFECYCLE } from '../src/config/gameConfig.js';
import { getStageLayout, validateElderStageIsFlat } from '../src/config/stageLayout.js';
import { ELDER_CHILD, canHugChild } from '../src/config/elderEnding.js';
import { getStageSpawns } from '../src/ai/StageSpawns.js';
import { grantStagePassive, installStagePassives, reduceAreaDamage, tickPassiveRecovery } from '../src/entities/stagePassives.js';
import officeAtlas from '../public/assets/tilesets/office_rain.json';
import homeAtlas from '../public/assets/tilesets/home_autumn.json';

function registry() {
  const values = new Map();
  return { get: (key) => values.get(key), set: (key, value) => values.set(key, value) };
}

function player(phase = 'middle') {
  return { phase: LIFECYCLE[phase], mp: 20, maxMp: LIFECYCLE[phase].mp, hp: 60, maxHp: 120, takeDamage: vi.fn() };
}

describe('第二关真实被动效果', () => {
  it('爆炸与范围伤害减免30%，保留普通接触伤害', () => {
    const skills = new Set(['unreadDot']);
    for (const source of ['unreadDot', 'aoe', 'shockwave']) expect(reduceAreaDamage(20, source, skills)).toBe(14);
    expect(reduceAreaDamage(20, 'projectile', skills)).toBe(20);
  });

  it('伤害入口使用被动并重置脱战站立计时', () => {
    const hero = player();
    const save = registry();
    grantStagePassive(hero, save, 'unreadDot');
    const incoming = hero.takeDamage;
    installStagePassives(hero, save);
    hero.passiveRestMs = 3000;
    hero.takeDamage(20, { source: 'unreadDot' });
    expect(incoming).toHaveBeenCalledWith(14, { source: 'unreadDot' });
    expect(hero.passiveRestMs).toBe(0);
  });

  it('咖啡因加20MP不叠层，并跨关恢复', () => {
    const hero = player();
    const save = registry();
    expect(grantStagePassive(hero, save, 'overtimeGhost')).toBe(true);
    expect(hero.maxMp).toBe(120);
    expect(grantStagePassive(hero, save, 'overtimeGhost')).toBe(false);
    expect(hero.maxMp).toBe(120);
    const elder = player('elder');
    installStagePassives(elder, save);
    expect(elder.maxMp).toBe(220);
    expect(elder.phase.mpRegen).toBe(12);
  });

  it('站立脱战2秒后每秒回3HP，移动/战斗会重置且不超上限', () => {
    const hero = player();
    grantStagePassive(hero, registry(), 'requirementVortex');
    expect(tickPassiveRecovery(hero, 2000, true)).toBe(0);
    expect(tickPassiveRecovery(hero, 1000, true)).toBe(3);
    expect(hero.hp).toBe(63);
    tickPassiveRecovery(hero, 16, false);
    expect(tickPassiveRecovery(hero, 1000, true)).toBe(0);
    hero.hp = 119;
    expect(tickPassiveRecovery(hero, 2000, true)).toBe(1);
    expect(hero.hp).toBe(120);
  });
});

describe('关卡布局与最终拥抱', () => {
  it('四段办公室和两段老宅秋园均引用实际存在的瓦片帧', () => {
    for (const [phase, atlas, count] of [['middle', officeAtlas, 4], ['elder', homeAtlas, 2]]) {
      const layout = getStageLayout(phase);
      const frames = new Set(atlas.frames.map((frame) => frame.filename));
      expect(layout.sections).toHaveLength(count);
      expect(layout.tiles.length).toBeGreaterThan(20);
      for (const op of layout.tiles) expect(frames.has(op.t), op.t).toBe(true);
    }
  });

  it('保温杯与婚戒均能通过地面触碰，老年全程平地无Boss战', () => {
    const middle = getStageLayout('middle');
    expect(middle.easterEggs.map((egg) => egg.id)).toContain('wedding-ring');
    for (const egg of middle.easterEggs) {
      expect(middle.solids.some((solid) => solid.kind !== 'ground' && egg.x > solid.x && egg.x < solid.x + solid.w)).toBe(false);
    }
    expect(validateElderStageIsFlat(getStageLayout('elder'))).toBe(true);
    expect(getStageSpawns('elder').boss).toBeNull();
  });

  it('只有从孩子背后贴近的地面行走能触发，站远处/正面/空中/死亡均不能触发', () => {
    const hero = { x: ELDER_CHILD.x - 18, isGrounded: true, body: { velocity: { x: 40 } } };
    expect(canHugChild(hero)).toBe(true);
    expect(canHugChild({ ...hero, x: ELDER_CHILD.x + 5 })).toBe(false);
    expect(canHugChild({ ...hero, x: ELDER_CHILD.x - 80 })).toBe(false);
    expect(canHugChild({ ...hero, isGrounded: false })).toBe(false);
    expect(canHugChild({ ...hero, isDead: true })).toBe(false);
    expect(canHugChild({ ...hero, body: { velocity: { x: 0 } } })).toBe(false);
    expect(canHugChild({ ...hero, body: { velocity: { x: -40 } } })).toBe(false);
  });
});
