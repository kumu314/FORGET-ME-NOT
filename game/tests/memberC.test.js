import { describe, expect, it, vi } from 'vitest';

// 纯逻辑单测不需要 Phaser 运行时（它在 node 环境里会访问 window）
vi.mock('phaser', () => ({
  default: { Physics: { Arcade: { Sprite: class {} } }, Geom: {}, Math: {} },
}));

import {
  COMBAT,
  LIFECYCLE,
  LOVE_LETTER_BUFF,
  MELEE_CHAIN,
  PHYSICS,
  RANGED_COOLDOWN,
  RANGED_COST,
  STANDARD_ANSWER_BUFF,
} from '../src/config/gameConfig.js';
import {
  applyDamage,
  applyLoveLetter,
  canJump,
  canStartMelee,
  computeMoveSpeed,
  computeMpCap,
  computeMpRegen,
  nextComboStage,
  resolveIncomingDamage,
  resolveJumpKeyAction,
  respawnState,
  tickMp,
  trySpendMp,
} from '../src/entities/combatMath.js';
import { computeInputState, toHeldGroups } from '../src/core/Input.js';
import { BULLET_PROFILES } from '../src/entities/ChalkBullet.js';
import { selectPlayerAnimation } from '../src/entities/Player.js';
import { GROUND_Y, getStageLayout, validateElderStageIsFlat } from '../src/config/stageLayout.js';
import { AI as AI_THRESHOLDS } from '../src/config/aiConfig.js';
import corridorAtlas from '../public/assets/tilesets/school_corridor.json';
import propsAtlas from '../public/assets/tilesets/school_props.json';
import eggsAtlas from '../public/assets/tilesets/easter_eggs.json';

const { youth, middle, elder } = LIFECYCLE;

describe('生命周期数值（设计文档 §1.2）', () => {
  it('青年 200血/50蓝/回蓝2每秒，可跳跃', () => {
    expect([youth.hp, youth.mp, youth.mpRegen, youth.canJump]).toEqual([200, 50, 2, true]);
  });

  it('中年 120血/100蓝/回蓝5每秒，可跳跃', () => {
    expect([middle.hp, middle.mp, middle.mpRegen, middle.canJump]).toEqual([120, 100, 5, true]);
  });

  it('老年 50血/200蓝/回蓝12每秒，禁止跳跃', () => {
    expect([elder.hp, elder.mp, elder.mpRegen, elder.canJump]).toEqual([50, 200, 12, false]);
  });

  it('血量与能量随年龄单调递减/递增', () => {
    const order = [youth, middle, elder];
    const hps = order.map((p) => p.hp);
    const mps = order.map((p) => p.mp);
    const regens = order.map((p) => p.mpRegen);
    expect(hps).toEqual([...hps].sort((a, b) => b - a));
    expect(mps).toEqual([...mps].sort((a, b) => a - b));
    expect(regens).toEqual([...regens].sort((a, b) => a - b));
  });
});

describe('能量系统', () => {
  it('按 delta 自动回蓝并封顶', () => {
    expect(tickMp(0, 50, 2, 1000)).toBeCloseTo(2);
    expect(tickMp(0, 50, 2, 10000)).toBeCloseTo(20); // 2/s × 10s，尚未封顶
    expect(tickMp(0, 50, 2, 30000)).toBe(50); // 超过 25s 后封顶
    expect(tickMp(49.5, 50, 12, 1000)).toBe(50);
  });

  it('回蓝速度随阶段递增（同一秒内）', () => {
    const y = tickMp(0, youth.mp, youth.mpRegen, 1000);
    const m = tickMp(0, middle.mp, middle.mpRegen, 1000);
    const e = tickMp(0, elder.mp, elder.mpRegen, 1000);
    expect(y).toBeLessThan(m);
    expect(m).toBeLessThan(e);
  });

  it('彩蛋【标准答案】把青年上限 50→80、回能 2→4', () => {
    expect(computeMpCap(youth, { standardAnswer: true })).toBe(STANDARD_ANSWER_BUFF.mpCap);
    expect(computeMpRegen(youth, { standardAnswer: true })).toBe(STANDARD_ANSWER_BUFF.mpRegen);
    // 不影响其他阶段
    expect(computeMpCap(elder, { standardAnswer: true })).toBe(200);
  });

  it('能量不足时远程放不出来', () => {
    expect(trySpendMp(10, RANGED_COST.youth)).toBeNull();
    expect(trySpendMp(RANGED_COST.youth, RANGED_COST.youth)).toBe(0);
  });

  it('远程消耗：青年15 / 中年20 / 老年10', () => {
    expect([RANGED_COST.youth, RANGED_COST.middle, RANGED_COST.elder]).toEqual([15, 20, 10]);
  });

  it('远程冷却：青年/中年 340ms，老年 260ms', () => {
    expect([RANGED_COOLDOWN.youth, RANGED_COOLDOWN.middle, RANGED_COOLDOWN.elder]).toEqual([
      340, 340, 260,
    ]);
  });
});

describe('格挡与受击（设计文档 §3.1）', () => {
  it('不格挡：全额伤害', () => {
    const r = resolveIncomingDamage(30, { blockHeld: false });
    expect(r).toMatchObject({ damage: 30, blocked: false, perfect: false, mpGain: 0 });
  });

  it('普通格挡减免 70%', () => {
    const r = resolveIncomingDamage(30, { blockHeld: true, blockHeldForMs: 800 });
    expect(r).toMatchObject({ damage: 9, blocked: true, perfect: false, mpGain: 0 });
  });

  it('完美格挡（受击前 0.2s 内按住 S）减免 90% 并瞬回 10 能量', () => {
    const r = resolveIncomingDamage(30, { blockHeld: true, blockHeldForMs: 150 });
    expect(r).toMatchObject({ damage: 3, blocked: true, perfect: true, mpGain: COMBAT.perfectBlockMpGain });
    expect(COMBAT.perfectBlockWindowMs).toBe(200);
  });

  it('【广播体操】被动把格挡减免提升到 85%', () => {
    const r = resolveIncomingDamage(20, { blockHeld: true, blockHeldForMs: 900, passiveReduction: 0.85 });
    expect(r.damage).toBe(3);
  });

  it('伤害不会把生命打到负数', () => {
    expect(applyDamage(5, 99)).toBe(0);
  });

  it('复活状态：满血满蓝 + 无敌帧', () => {
    const s = respawnState(elder);
    expect(s.hp).toBe(elder.hp);
    expect(s.mp).toBe(elder.mp);
    expect(s.invulnMs).toBe(PHYSICS.invulnMs);
  });
});

describe('老年机能剥夺（第三关禁跳）', () => {
  it('老年关跳跃键行为是"咳嗽"而不是"跳跃"', () => {
    expect(resolveJumpKeyAction(elder)).toBe('cough');
    expect(resolveJumpKeyAction(youth)).toBe('jump');
    expect(resolveJumpKeyAction(middle)).toBe('jump');
  });

  it('即使贴地或有土狼时间，老年也无法起跳', () => {
    expect(canJump(elder, { grounded: true })).toBe(false);
    expect(canJump(elder, { grounded: true, coyoteLeftMs: 90 })).toBe(false);
    expect(canJump(youth, { grounded: true })).toBe(true);
    expect(canJump(middle, { grounded: false, coyoteLeftMs: 40 })).toBe(true);
  });

  it('青年/中年离地超过土狼时间后不能在空中二段跳', () => {
    expect(canJump(youth, { grounded: false, coyoteLeftMs: 0 })).toBe(false);
  });

  it('老年地面移动速度打八折（步履蹒跚）', () => {
    const onGround = computeMoveSpeed(PHYSICS.walkSpeed, elder, true);
    expect(onGround).toBeCloseTo(PHYSICS.walkSpeed * 0.8);
    expect(computeMoveSpeed(PHYSICS.walkSpeed, youth, true)).toBe(PHYSICS.walkSpeed);
  });

  it('老年关地图必须是纯平地（无高台/断桥）', () => {
    const layout = getStageLayout('elder');
    expect(validateElderStageIsFlat(layout)).toBe(true);
    // 地面必须连贯，不能留坑
    const ground = layout.solids.filter((s) => s.kind === 'ground');
    const total = ground.reduce((sum, s) => sum + s.w, 0);
    const span = Math.max(...ground.map((s) => s.x + s.w)) - Math.min(...ground.map((s) => s.x));
    expect(total).toBe(span);
  });
});

describe('近战三连击与判定', () => {
  it('连击在窗口内续接，超时回到第一段', () => {
    const win = MELEE_CHAIN.youth.linkWindow;
    expect(nextComboStage(0, 0, win)).toBe(1);
    expect(nextComboStage(1, 100, win)).toBe(2);
    expect(nextComboStage(2, 100, win)).toBe(3);
    expect(nextComboStage(3, 100, win)).toBe(1);
    expect(nextComboStage(1, win + 1, win)).toBe(1);
  });

  it('三阶段各是三段连击，且老年动作更慢', () => {
    for (const phase of ['youth', 'middle', 'elder']) {
      expect(MELEE_CHAIN[phase].damage).toHaveLength(3);
    }
    expect(MELEE_CHAIN.elder.activeAt[0]).toBeGreaterThan(MELEE_CHAIN.youth.activeAt[0]);
    expect(MELEE_CHAIN.elder.appliesStun).toBe(true);
    expect(MELEE_CHAIN.middle.knockbackSmallEnemies).toBe(true);
  });

  it('受击硬直 / 格挡中不能起手近战', () => {
    expect(canStartMelee({ hurtLockMs: 100 })).toBe(false);
    expect(canStartMelee({ blocking: true })).toBe(false);
    expect(canStartMelee({ grounded: false })).toBe(false);
    expect(canStartMelee()).toBe(true);
  });

  it('远程可在空中释放（Space+L）', () => {
    expect(BULLET_PROFILES.youth.speed).toBeGreaterThan(0);
    expect(BULLET_PROFILES.youth.pierce).toBe(true); // 粉笔头穿刺
    expect(BULLET_PROFILES.middle.aoe).toBeGreaterThan(0); // 纸飞机 AOE
    expect(BULLET_PROFILES.middle.atlasAnimation).toBe('paper_plane');
    expect(BULLET_PROFILES.elder.homing).toBe(true);
    expect(BULLET_PROFILES.elder.label).toBe('金色记忆碎片');
  });
});

describe('A 图集动画路由', () => {
  const base = {
    grounded: true,
    moving: false,
    blocking: false,
    hurt: false,
    coughing: false,
    meleeStage: 0,
    rangedAction: false,
  };

  it('按契约选择主角图集动作', () => {
    expect(selectPlayerAnimation({ ...base, phaseId: 'youth' })).toBe('idle');
    expect(selectPlayerAnimation({ ...base, phaseId: 'youth', moving: true })).toBe('run');
    expect(selectPlayerAnimation({ ...base, phaseId: 'youth', grounded: false })).toBe('jump');
    expect(selectPlayerAnimation({ ...base, phaseId: 'youth', blocking: true })).toBe('block');
    expect(selectPlayerAnimation({ ...base, phaseId: 'youth', meleeStage: 2 })).toBe('attack_2');
    expect(selectPlayerAnimation({ ...base, phaseId: 'youth', rangedAction: true })).toBe('throw');
  });

  it('老年使用 walk/cough/cast，绝不选择 jump', () => {
    expect(selectPlayerAnimation({ ...base, phaseId: 'elder', moving: true })).toBe('walk');
    expect(selectPlayerAnimation({ ...base, phaseId: 'elder', coughing: true })).toBe('cough');
    expect(selectPlayerAnimation({ ...base, phaseId: 'elder', rangedAction: true })).toBe('cast');
    expect(selectPlayerAnimation({ ...base, phaseId: 'elder', grounded: false })).toBe('walk');
  });
});

describe('输入层语义映射', () => {
  it('物理键码映射到语义动作', () => {
    expect([...toHeldGroups(['A', 'SPACE', 'J'])].sort()).toEqual(['jump', 'left', 'melee']);
    expect([...toHeldGroups(['D', 'S', 'L'])].sort()).toEqual(['block', 'ranged', 'right']);
  });

  it('跳跃只认边沿：按住 Space 不会自动连跳（否则落地会被重新弹起）', () => {
    const frame1 = computeInputState(new Set(['jump', 'melee']), null);
    expect(frame1.jumpDown).toBe(true);
    expect(frame1.jumpHeld).toBe(true);
    expect(frame1.meleeHeld).toBe(true);

    const frame2 = computeInputState(new Set(['jump', 'melee']), frame1);
    expect(frame2.jumpDown).toBe(false);
    expect(frame2.jumpHeld).toBe(true);

    const frame3 = computeInputState(new Set([]), frame2);
    const frame4 = computeInputState(new Set(['jump']), frame3);
    expect(frame4.jumpDown).toBe(true); // 松开后再按才算新的一次
  });

  it('近战/远程用"按住"语义：长按 J 由连击窗口裁决节奏', () => {
    const f1 = computeInputState(new Set(['melee', 'ranged']), null);
    const f2 = computeInputState(new Set(['melee', 'ranged']), f1);
    expect(f2.meleeHeld).toBe(true);
    expect(f2.rangedHeld).toBe(true);
    const f3 = computeInputState(new Set(), f2);
    expect(f3.meleeHeld).toBe(false);
    expect(f3.rangedHeld).toBe(false);
  });

  it('A 与 D 同时按下时两者都为 true，由 Player 的 (right-left) 决出净方向', () => {
    const s = computeInputState(new Set(['left', 'right']), null);
    expect(s.left && s.right).toBe(true);
  });
});

describe('第一关组装（issue #16）', () => {
  const youth = getStageLayout('youth');

  // 与 StageScene 相同的物理推导：纯跳升距 / 飞踢借力升距
  const plainJumpRise = (PHYSICS.jumpVelocity ** 2) / (2 * PHYSICS.gravityY); // ≈48px
  const bounceRise = (AI_THRESHOLDS.airKickBounce ** 2) / (2 * PHYSICS.gravityY); // ≈16px

  const solidByKind = (kind) => youth.solids.find((s) => s.kind === kind);
  const podium = solidByKind('podium');
  const beam = solidByKind('beam');

  it('三段布局：走廊 → 黑板报墙 → 阶梯教室，无缝覆盖整个世界（GDD §4.1）', () => {
    expect(youth.sections.map((s) => s.id)).toEqual(['corridor', 'blackboard', 'classroom']);
    expect(youth.sections[0].x0).toBe(0);
    for (let i = 1; i < youth.sections.length; i += 1) {
      expect(youth.sections[i].x0).toBe(youth.sections[i - 1].x1); // 段与段无缝
    }
    expect(youth.sections.at(-1).x1).toBe(1600); // 覆盖到世界尽头
  });

  it('瓦片拼装引用的帧名全部真实存在于 B 的三套图集，坐标不越界', () => {
    const frames = new Set([
      ...corridorAtlas.frames.map((f) => f.filename),
      ...propsAtlas.frames.map((f) => f.filename),
      ...eggsAtlas.frames.map((f) => f.filename),
    ]);
    expect(youth.tiles.length).toBeGreaterThan(80); // 三段布局确有规模
    for (const op of youth.tiles) {
      expect(frames).toContain(op.t);
      expect(op.x).toBeGreaterThanOrEqual(0);
      expect(op.y).toBeGreaterThanOrEqual(0);
      expect(op.x + (op.w ?? 1) * 16).toBeLessThanOrEqual(1600 + 16); // 允许 1 格跨缝覆盖
      expect(op.y + (op.h ?? 1) * 16).toBeLessThanOrEqual(272);
    }
  });

  it('黑板报横梁：讲台纯跳够不着（差 >4px），飞踢借力后可稳落（issue #16 彩蛋2 路线）', () => {
    expect(beam.kind).toBe('beam');
    // 纯跳最高点 = 讲台顶 - 48px；横梁必须高于它才逼出"借小怪连跳"
    expect(beam.y).toBeLessThan(podium.y - plainJumpRise);
    // 借力最高点 = 讲台顶 - 48 - 16；横梁不得高于它，否则永远够不着
    expect(beam.y).toBeGreaterThanOrEqual(podium.y - plainJumpRise - bounceRise);
  });

  it('借力浮空怪悬在横梁外侧上方：踢得到、不撞梁、复活窗口存在', () => {
    const [helper] = youth.eggHelpers;
    expect(helper.type).toBe('sleepBug');
    // 踢击判定框在头顶上方 19~45px：怪必须悬在横梁顶以上 ≥32.8px 才能在近顶点踢到
    expect(beam.y - helper.y).toBeGreaterThanOrEqual(32.8);
    // 怪在横梁 x 范围之外（左侧），上升途中不会撞上横梁底面
    expect(helper.x).toBeLessThan(beam.x);
    expect(helper.x).toBeGreaterThan(podium.x);
    expect(helper.respawnMs).toBeGreaterThan(0);
  });

  it('【标准答案】摆上横梁顶，MP 上限增益链路完整（50→80）', () => {
    const egg = youth.easterEggs.find((e) => e.id === 'standard-answer');
    expect(egg).toBeTruthy();
    expect(egg.x).toBeGreaterThanOrEqual(beam.x);
    expect(egg.x).toBeLessThanOrEqual(beam.x + beam.w);
    expect(egg.y).toBe(beam.y);
    // 拾取后青年的能量上限与回能
    expect(computeMpCap(LIFECYCLE.youth, { standardAnswer: true })).toBe(STANDARD_ANSWER_BUFF.mpCap); // 80
    expect(computeMpRegen(LIFECYCLE.youth, { standardAnswer: true })).toBe(STANDARD_ANSWER_BUFF.mpRegen); // 4
  });

  it('桌洞纸堆在地面近战判定带内，走过去 J 即可打碎（issue #16 彩蛋1）', () => {
    const pile = youth.breakables.find((b) => b.kind === 'paper-pile');
    expect(pile).toBeTruthy();
    // 地面近战判定框纵向覆盖 [feet-34, feet-14] = [206, 226]
    expect(pile.y).toBeGreaterThanOrEqual(GROUND_Y - 34);
    expect(pile.y).toBeLessThanOrEqual(GROUND_Y - 8);
    // 纸堆挂在某张课桌上（桌洞语义）
    const desks = youth.solids.filter((s) => s.kind === 'desk');
    const onDesk = desks.some((d) => pile.x >= d.x - 24 && pile.x <= d.x + d.w + 24);
    expect(onDesk).toBe(true);
  });

  it('检查点：走廊起点 == 出生点，教室门口/阶梯教室门前依次点亮，x 递增', () => {
    expect(youth.checkpoints[0].label).toBe('走廊起点');
    expect(youth.checkpoints[0].x).toBe(youth.spawn.x);
    const labels = youth.checkpoints.map((c) => c.label);
    expect(labels).toContain('教室门口');
    expect(labels).toContain('阶梯教室门前');
    const xs = youth.checkpoints.map((c) => c.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it('【怦然心动】近战加成：10/10/16 → 13/13/20，关闭时原样', () => {
    expect(LOVE_LETTER_BUFF.meleeMultiplier).toBe(1.25);
    expect(applyLoveLetter(10, true)).toBe(13);
    expect(applyLoveLetter(16, true)).toBe(20);
    expect(applyLoveLetter(8, true)).toBe(10); // 老年 8 → 10
    expect(applyLoveLetter(10, false)).toBe(10);
    // 三连击整链增益后仍在正常数值带
    for (const d of MELEE_CHAIN.youth.damage) {
      expect(applyLoveLetter(d, true)).toBe(Math.round(d * 1.25));
    }
  });

  it('纸箱彩蛋两段式：封条未碎只提示，碎后触发忠犬（GDD §4.4）', () => {
    const box = youth.breakables.find((b) => b.kind === 'box');
    const egg = youth.easterEggs.find((e) => e.id === 'puppy-box');
    expect(box).toBeTruthy();
    expect(egg).toBeTruthy();
    // 判定点与彩蛋锚点在同一位置（打碎即解锁触碰）
    expect(Math.abs(box.x - egg.x)).toBeLessThanOrEqual(8);
  });
});
