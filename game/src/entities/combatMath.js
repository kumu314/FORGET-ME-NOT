/**
 * 战斗数值纯函数（成员C）
 *
 * 全部是无副作用的纯函数，方便在 Node 里单测；Player.js 只负责把它们接到 Phaser 上。
 * 依据《游戏功能设计文档》§3 核心战斗与数值系统。
 */

import {
  COMBAT,
  LEVEL_UPGRADES,
  LOVE_LETTER_BUFF,
  PHYSICS,
  STANDARD_ANSWER_BUFF,
  XP_SYSTEM,
} from '../config/gameConfig.js';

/** 能量上限：青年 50，【标准答案】彩蛋永久提升至 80 */
export function computeMpCap(phase, { standardAnswer = false } = {}) {
  if (standardAnswer && phase.id === 'youth') return STANDARD_ANSWER_BUFF.mpCap;
  return phase.mp;
}

/** 【怦然心动】近战加成：拾取手写情书后近战伤害 ×1.25（四舍五入取整） */
export function applyLoveLetter(damage, loveLetter = false) {
  if (!loveLetter) return damage;
  return Math.round(damage * LOVE_LETTER_BUFF.meleeMultiplier);
}

/**
 * 近战最终伤害（issue #17）：基础 ×【怦然心动】× 攻击力强化（升级可叠）。
 * applyLoveLetter 保留为单因子速查（既有单测依赖）。
 */
export function computeMeleeDamage(baseDamage, { loveLetter = false, attackLevels = 0 } = {}) {
  let damage = baseDamage;
  if (loveLetter) damage *= LOVE_LETTER_BUFF.meleeMultiplier;
  damage *= LEVEL_UPGRADES.attack.meleeMultiplier ** attackLevels;
  return Math.round(damage);
}

/** 暴击判定：critChance ∈ [0, cap]，注入 rand 便于单测 */
export function rollCrit(critChance, rand = Math.random()) {
  if (critChance <= 0) return false;
  return rand < Math.min(critChance, LEVEL_UPGRADES.crit.critCap);
}

/** 跳跃滞空强化：每级重力 ×0.85，封底 0.7（老年禁跳不受影响，重力只影响腾空段） */
export function computeGravityScale(hangLevels = 0) {
  if (hangLevels <= 0) return 1;
  const scale = LEVEL_UPGRADES.hang.gravityScale ** hangLevels;
  return Math.max(LEVEL_UPGRADES.hang.floor, scale);
}

/** 升到 level+1 级所需经验：base × growth^(level-1)，向上取整 */
export function expToNext(level = 1) {
  return Math.ceil(XP_SYSTEM.baseLevelExp * XP_SYSTEM.levelGrowth ** (level - 1));
}

/** 每秒回能：青年 2/s；【标准答案】提升至 4/s */
export function computeMpRegen(phase, { standardAnswer = false } = {}) {
  if (standardAnswer && phase.id === 'youth') return STANDARD_ANSWER_BUFF.mpRegen;
  return phase.mpRegen;
}

/**
 * 格挡结算：返回实际伤害与是否完美格挡。
 * - 未格挡：全额伤害
 * - 格挡：减免 70%（持【广播体操】被动时为 85%）
 * - 完美格挡（受击前 0.2 秒内按住 S）：减免 90%，并瞬回 10 点能量
 *
 * @param {number} damage 原始伤害
 * @param {{blockHeld?: boolean, blockHeldForMs?: number, passiveReduction?: number}} opts
 */
export function resolveIncomingDamage(damage, opts = {}) {
  const { blockHeld = false, blockHeldForMs = Infinity, passiveReduction } = opts;
  if (!blockHeld) {
    return { damage, blocked: false, perfect: false, mpGain: 0 };
  }

  const perfect = blockHeldForMs <= COMBAT.perfectBlockWindowMs;
  const reduction = perfect
    ? COMBAT.perfectBlockReduction
    : Math.max(passiveReduction ?? 0, COMBAT.blockReductionBase);

  return {
    damage: Math.max(0, Math.round(damage * (1 - reduction))),
    blocked: true,
    perfect,
    mpGain: perfect ? COMBAT.perfectBlockMpGain : 0,
  };
}

/** 受击后的生命值（不低于 0） */
export function applyDamage(hp, damage) {
  return Math.max(0, hp - Math.max(0, damage));
}

/** 每秒回蓝，按 delta 换算；结果上限为 mpCap */
export function tickMp(mp, mpCap, regenPerSecond, deltaMs) {
  const next = mp + (regenPerSecond * deltaMs) / 1000;
  return Math.min(mpCap, next);
}

/** 消耗能量：不足则返回 null（表示"放不出来"） */
export function trySpendMp(mp, cost) {
  if (mp < cost) return null;
  return mp - cost;
}

/**
 * 地面移动速度：老年步履蹒跚，地面速度打八折
 * @param {number} baseSpeed
 * @param {object} phase
 * @param {boolean} grounded
 */
export function computeMoveSpeed(baseSpeed, phase, grounded) {
  const factor = grounded ? (phase.canJump ? 1 : PHYSICS.elderGroundFactor) : 1;
  return baseSpeed * factor;
}

/** 能否起跳：只有青年/中年且贴地（或处于土狼时间）才能离地 */
export function canJump(phase, { grounded = false, coyoteLeftMs = 0 } = {}) {
  if (!phase.canJump) return false;
  return grounded || coyoteLeftMs > 0;
}

/**
 * 跳跃键行为：'jump'（起跳）或 'cough'（老年驻足微喘，离地为 0）
 * @param {object} phase
 * @returns {'jump'|'cough'}
 */
export function resolveJumpKeyAction(phase) {
  return phase.canJump ? 'jump' : 'cough';
}

/**
 * 近战当前段位：连击在 linkWindow 内续接，超时回到第一段。
 * @param {number} currentStage 0 表示未出招
 * @param {number} sinceLastActiveMs 距上一次命中的毫秒数
 * @param {number} linkWindow 连击窗口
 * @param {number} chainLength
 */
export function nextComboStage(currentStage, sinceLastActiveMs, linkWindow, chainLength = 3) {
  if (currentStage <= 0) return 1;
  if (sinceLastActiveMs > linkWindow) return 1;
  return (currentStage % chainLength) + 1;
}

/** 是否可以在此刻起手近战（受击硬直 / 格挡中 / 空中不允许地面连击） */
export function canStartMelee({ hurtLockMs = 0, blocking = false, grounded = true } = {}) {
  return hurtLockMs <= 0 && !blocking && grounded;
}

/** 是否可以此刻释放远程 */
export function canStartRanged({ hurtLockMs = 0, blocking = false } = {}) {
  return hurtLockMs <= 0 && !blocking;
}

/** 检查点复活状态：满血满蓝，并带无敌帧 */
export function respawnState(phase, { standardAnswer = false } = {}) {
  return {
    hp: phase.hp,
    mp: computeMpCap(phase, { standardAnswer }),
    invulnMs: PHYSICS.invulnMs,
  };
}
