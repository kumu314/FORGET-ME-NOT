import { describe, it, expect, vi } from 'vitest';

// TTK 护栏是纯数学题；ChalkBullet 模块顶部 import phaser，mock 掉即可读 BULLET_PROFILES
vi.mock('phaser', () => ({
  default: {
    Physics: { Arcade: { Sprite: class {} } },
    Geom: {},
    Math: {},
  },
}));

import { BULLET_PROFILES } from '../src/entities/ChalkBullet.js';
import { MONSTERS, BOSS } from '../src/config/aiConfig.js';
import { COMBAT, MELEE_CHAIN, LIFECYCLE, RANGED_COST } from '../src/config/gameConfig.js';

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const combosToKill = (hp, comboDamage) => Math.ceil(hp / comboDamage);

/** 一关三怪的 hp（题海纸精/瞌睡浮游虫/迟到巡查员） */
const STAGE1_HP = ['paperSpirit', 'sleepBug', 'inspector'].map((id) => MONSTERS[id]?.hp);
/** 二关三怪（未读红点/加班魂/需求变更涡流） */
const STAGE2_HP = ['unreadDot', 'overtimeGhost', 'requirementVortex'].map((id) => MONSTERS[id]?.hp);

describe('TTK 数学护栏（issue #26 · 拦 gross 离谱值）', () => {
  it('一关三怪：青年全套连击击杀耗时落在 1~4 个连击内', () => {
    const combo = sum(MELEE_CHAIN.youth.damage);
    expect(combo).toBeGreaterThanOrEqual(24);
    for (const hp of STAGE1_HP) {
      expect(hp, '小怪 hp 配置缺失').toBeGreaterThan(0);
      expect(combosToKill(hp, combo)).toBeLessThanOrEqual(4);
    }
  });

  it('二关三怪：中年全套连击击杀落在 1~4 个连击内', () => {
    const combo = sum(MELEE_CHAIN.middle.damage);
    expect(combo).toBeGreaterThanOrEqual(30);
    for (const hp of STAGE2_HP) {
      expect(hp, '小怪 hp 配置缺失').toBeGreaterThan(0);
      expect(combosToKill(hp, combo)).toBeLessThanOrEqual(4);
    }
  });

  it('Boss 纯近战理论击杀时长落在 8s~60s（每套连击按 1.5s 循环）', () => {
    for (const kind of ['teacher', 'employer']) {
      const combo = sum(MELEE_CHAIN.youth.damage);
      const ttkSec = (BOSS[kind].hp / combo) * 1.5;
      expect(ttkSec, `${kind} Boss 打起来不该像切菜`).toBeGreaterThanOrEqual(8);
      expect(ttkSec, `${kind} Boss 不该磨到睡着`).toBeLessThanOrEqual(60);
    }
  });

  it('远程三段伤害落在 8~20 且 MP 经济可自洽（耗蓝 ≤ 当前 MP 上限）', () => {
    for (const phase of ['youth', 'middle', 'elder']) {
      const dmg = BULLET_PROFILES[phase].damage;
      expect(dmg).toBeGreaterThanOrEqual(8);
      expect(dmg).toBeLessThanOrEqual(20);
      expect(RANGED_COST[phase], '远程耗蓝配置缺失').toBeGreaterThan(0);
      expect(RANGED_COST[phase]).toBeLessThanOrEqual(LIFECYCLE[phase].mp);
    }
  });

  it('格挡经济：完美格挡收益 ≥ 基础格挡（风险换收益方向正确）', () => {
    expect(COMBAT.perfectBlockReduction).toBeGreaterThan(COMBAT.blockReductionBase);
  });
});
