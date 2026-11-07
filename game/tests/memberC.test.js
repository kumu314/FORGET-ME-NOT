import { describe, expect, it, vi } from 'vitest';

// 纯逻辑单测不需要 Phaser 运行时（它在 node 环境里会访问 window）
vi.mock('phaser', () => ({
  default: { Physics: { Arcade: { Sprite: class {} } }, Geom: {}, Math: {} },
}));

import {
  COMBAT,
  LIFECYCLE,
  MELEE_CHAIN,
  PHYSICS,
  RANGED_COST,
  STANDARD_ANSWER_BUFF,
} from '../src/config/gameConfig.js';
import {
  applyDamage,
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
import { getStageLayout, validateElderStageIsFlat } from '../src/config/stageLayout.js';

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
    expect(BULLET_PROFILES.elder.label).toBe('金色记忆碎片');
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
