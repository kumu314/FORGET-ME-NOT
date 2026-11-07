/**
 * 关卡 AI 布阵数据（成员D · GDD §4.3 / §5.5 / §5.6）
 *
 * 为什么单独一份而不是塞进 stageLayout.js：
 *   stageLayout.js 是成员C 的地形数据（solids / checkpoints / easterEggs），
 *   刷怪点属于 AI 侧数据，收口在这里；只 import 它的 GROUND_Y，一行都不改它。
 *   这样 C 调地形、D 调敌人站位，两个 PR 不会撞在同一个文件上。
 *
 * 坐标约定（y 省略时自动推导）：
 *   - 地面小怪：GROUND_Y 上方一个身位再落一点，靠重力自然落稳，
 *     避免出生帧就嵌进地形里被 Arcade 挤出去。
 *   - 浮空小怪：GROUND_Y - AIR_HEIGHT。这个高度是照着三件事核过的：
 *     玩家跳跃顶点够得着空中飞踢、忠犬吠叫 barkRange 够得着、又高于角色头顶。
 *
 * ⚠️ 摆位必须避开 solids：
 *   第一关地面在 620~680 有一处浅坑（C 留的跳跃考验），讲台 / 储物柜 / 工位桌面
 *   都紧贴地面，地面小怪不能放在这些矩形里，否则一出生就被静态体顶飞。
 *   下面每一处 x 都对着 stageLayout.solids 核过一遍。
 */

import { GROUND_Y } from '../config/stageLayout.js';
import { MONSTERS } from '../config/aiConfig.js';

/** 浮空小怪距地高度（像素） */
const AIR_HEIGHT = 56;
/** 地面小怪出生点比落地位置再高一点，让重力接管 */
const DROP_MARGIN = 6;

export const STAGE_SPAWNS = Object.freeze({
  /* 第一关 · 青葱破茧之夏：成群纸精打手感，浮游虫逼出对空手段，巡查员逼出格挡反击 */
  youth: {
    level: 0,
    monsters: [
      // 开场连打：走廊起点一段三个纸精，练三连击
      { type: 'paperSpirit', x: 300 },
      { type: 'paperSpirit', x: 470 },
      // 浅坑右侧的落点，跳过去正好接敌
      { type: 'paperSpirit', x: 700 },
      { type: 'paperSpirit', x: 780 },
      // 黑板报前的高台段
      { type: 'paperSpirit', x: 1180 },
      // 两只浮游虫：一只在开场逼玩家学 Space+J，一只在黑板报前
      { type: 'sleepBug', x: 380 },
      { type: 'sleepBug', x: 1080 },
      // 迟到巡查员：走廊后半，正面有护甲，只能踩头或格挡反击
      { type: 'inspector', x: 1050 },
    ],
    // 走到阶梯教室门前才开战（triggerX 略早于检查点 1380，留出登场演出余量）
    boss: {
      kind: 'teacher',
      triggerX: 1230,
      x: 1430,
      arena: { left: 1150, right: 1580 },
    },
  },

  /* 第二关 · 泥潭钢筋雨夜：自爆逼走位、吸蓝逼持续输出、涡流逼空中破盾 */
  middle: {
    level: 1,
    monsters: [
      { type: 'unreadDot', x: 400 },
      { type: 'unreadDot', x: 640 },
      { type: 'unreadDot', x: 990 },
      { type: 'overtimeGhost', x: 620 },
      { type: 'overtimeGhost', x: 1180 },
      { type: 'requirementVortex', x: 1000 },
      { type: 'requirementVortex', x: 1250 },
    ],
    boss: {
      kind: 'employer',
      triggerX: 1300,
      x: 1440,
      arena: { left: 1240, right: 1580 },
    },
  },

  /*
   * 第三关 · 暮年回响：纯平地，没有跳跃
   * 敌人阵容是占位——GDD 第三关只写了"极高频记忆碎片清场"，没给敌人清单，
   * 先放两只地面 + 一只浮空，保证老年关有靶子可打（浮空那只只靠 L 和忠犬吠叫处理）。
   * 终局 Boss（拉杆箱孩子）还没做，见 issue #23，这里 boss 置 null。
   */
  elder: {
    level: 2,
    monsters: [
      { type: 'paperSpirit', x: 420 },
      { type: 'paperSpirit', x: 960 },
      { type: 'sleepBug', x: 700 },
    ],
    boss: null,
  },
});

/**
 * 推导单个刷怪点的实际出生坐标。
 * @param {{type: string, x: number, y?: number}} spec
 * @param {number} [groundY]
 * @returns {{x: number, y: number}}
 */
export function spawnPointFor(spec, groundY = GROUND_Y) {
  if (typeof spec.y === 'number') return { x: spec.x, y: spec.y };

  const def = MONSTERS[spec.type];
  const h = def?.placeholder?.h ?? 12;
  return {
    x: spec.x,
    y: def?.flying ? groundY - AIR_HEIGHT : groundY - h - DROP_MARGIN,
  };
}

/** 深拷贝一份布阵，避免运行时改动污染常量 */
export function getStageSpawns(phaseId) {
  const stage = STAGE_SPAWNS[phaseId];
  if (!stage) throw new Error(`[AI] 未知关卡的布阵数据: ${phaseId}`);
  return {
    ...stage,
    monsters: stage.monsters.map((m) => ({ ...m })),
    boss: stage.boss
      ? { ...stage.boss, arena: { ...stage.boss.arena } }
      : null,
  };
}

export default STAGE_SPAWNS;
