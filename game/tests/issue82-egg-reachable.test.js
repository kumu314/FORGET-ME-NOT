import { describe, expect, it, vi } from 'vitest';

// 纯逻辑单测不需要 Phaser 运行时（它在 node 环境里会访问 window）
vi.mock('phaser', () => ({
  default: { Physics: { Arcade: { Sprite: class {} } }, Geom: {}, Math: {} },
}));

import { getStageLayout, STAGE_LAYOUTS, GROUND_Y } from '../src/config/stageLayout.js';
import { PHYSICS } from '../src/config/gameConfig.js';

/**
 * issue #82 回归守卫：彩蛋与可破碎物必须落在「玩家实际可达」的位置。
 *
 * 可达性模型（与玩家身体/拾取判定对齐）：
 *  - 地面拾取（egg.y === GROUND_Y）：玩家贴地行走，身体占 y[219,240]；
 *    若某 solid 在蛋的 x 处侵入该高度带（s.y ≤ 219 且 s.y+h ≥ 240），玩家身体
 *    会被挡在墙外（身体半宽 7px），蛋不可达 —— #82 小狗纸箱与保温杯即此类。
 *  - 台上拾取（egg.y === 某 solid 顶面 s.y）：玩家站上面触碰，可达性取决于
 *    登台路线（跳跃/借力），这里只断言「蛋确实贴在平台顶面上」，不浮空、不嵌入。
 */
const PLAYER_BODY_HALF_WIDTH = 7;
const PLAYER_BODY_TOP = 219; // GROUND_Y - 21（身体高度）

function groundBlockedBySolid(layout, x) {
  return layout.solids.some(
    (s) => s.y <= PLAYER_BODY_TOP && s.y + s.h >= GROUND_Y && x >= s.x - PLAYER_BODY_HALF_WIDTH && x <= s.x + s.w + PLAYER_BODY_HALF_WIDTH,
  );
}

function onTopOfSomeSolid(layout, x, y) {
  return layout.solids.some((s) => s.y === y && x >= s.x - 2 && x <= s.x + s.w + 2);
}

describe('issue #82 回归：彩蛋/破碎点必须在玩家可达域', () => {
  for (const [phaseId, layout] of Object.entries(STAGE_LAYOUTS)) {
    it(`[${phaseId}] 地面彩蛋不被 solid 挡住身体（#82 小狗/保温杯类）`, () => {
      for (const egg of layout.easterEggs) {
        if (egg.y !== GROUND_Y) continue; // 台上拾取另行断言
        expect({ egg: egg.id, x: egg.x, blocked: groundBlockedBySolid(layout, egg.x) }).toEqual({
          egg: egg.id,
          x: egg.x,
          blocked: false,
        });
      }
    });

    it(`[${phaseId}] 地面可破碎物判定点不被 solid 挡住身体`, () => {
      for (const b of layout.breakables) {
        if (b.y !== GROUND_Y && b.y !== GROUND_Y - 8) continue; // 地面/桌洞两类
        expect({ breakable: b.id, x: b.x, blocked: groundBlockedBySolid(layout, b.x) }).toEqual({
          breakable: b.id,
          x: b.x,
          blocked: false,
        });
      }
    });

    it(`[${phaseId}] 非地面彩蛋必须贴在某平台顶面上（不浮空不嵌入）`, () => {
      for (const egg of layout.easterEggs) {
        if (egg.y === GROUND_Y) continue;
        expect({ egg: egg.id, y: egg.y, onSurface: onTopOfSomeSolid(layout, egg.x, egg.y) }).toEqual({
          egg: egg.id,
          y: egg.y,
          onSurface: true,
        });
      }
    });
  }

  it('第一关小狗纸箱在储物柜（880-1000）左侧开放地，砸封条与触碰都摸得到', () => {
    const youth = getStageLayout('youth');
    const boxEgg = youth.easterEggs.find((e) => e.id === 'puppy-box');
    const boxBreak = youth.breakables.find((b) => b.id === 'puppy-box');
    const locker = youth.solids.find((s) => s.kind === 'locker');
    // 玩家贴柜体能到的最左中心 = locker.x - 7；触碰圈 |dx|<14 必须覆盖该点
    const maxCenter = locker.x - PLAYER_BODY_HALF_WIDTH;
    expect(Math.abs(maxCenter - boxEgg.x)).toBeLessThan(14);
    expect(boxBreak.x).toBe(boxEgg.x); // 砸封条判定点与彩蛋锚点一致
  });

  it('第二关保温杯在茶水间开放地（#82 同类：不得困在打印机 solid 内）', () => {
    const middle = getStageLayout('middle');
    const thermos = middle.easterEggs.find((e) => e.id === 'thermos');
    expect(thermos).toBeTruthy();
    expect(groundBlockedBySolid(middle, thermos.x)).toBe(false);
  });

  /**
   * issue #65 回归守卫：地面上任何「挡住身体高度带」的 solid（= 地形墙）
   * 顶部必须处于跳跃可达范围（跳升极限 48px），否则走廊被硬墙堵死。
   * 历史案例：储物柜 y184（顶距地 56px > 48）堵死一关，见 issue #65。
   */
  it('所有关卡的地形墙顶部都在跳跃可达范围内（issue #65 类）', () => {
    const JUMP_REACH = PHYSICS.jumpVelocity ** 2 / (2 * PHYSICS.gravityY); // 48px
    for (const [phaseId, layout] of Object.entries(Object.fromEntries(
      ['youth', 'middle', 'elder'].map((p) => [p, getStageLayout(p)]),
    ))) {
      for (const s of layout.solids) {
        const coversBodyBand = s.y <= PLAYER_BODY_TOP && s.y + s.h >= GROUND_Y;
        if (!coversBodyBand) continue; // 高台/头顶物不在此列（另有贴面与路线设计约束）
        expect({
          phase: phaseId, kind: s.kind, x: s.x, top: s.y,
          rise: GROUND_Y - s.y,
        }).toEqual({
          phase: phaseId, kind: s.kind, x: s.x, top: s.y,
          rise: expect.any(Number),
        });
        expect(GROUND_Y - s.y).toBeLessThanOrEqual(JUMP_REACH);
        expect(GROUND_Y - s.y).toBeGreaterThan(0);
      }
    }
  });
});
