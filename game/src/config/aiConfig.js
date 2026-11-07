/**
 * 成员D · AI 数值配置（480×270 原生分辨率重标定版）
 *
 * 为什么单独一份而不是塞进 gameConfig.js：
 *  gameConfig.js 是成员C 的共享配置（生命周期 / 物理 / 连击），正在 PR 评审中；
 *  AI 数值全部收口在本文，避免两边同时改同一文件产生冲突。
 *  距离与速度按 960×540 → 480×270 重标定（×0.5），角色仍为 24×24，
 *  与 docs/animation-contract.md 的帧尺寸一致。
 *
 * 小怪 / 弹道贴图 A 尚未交付（契约里的已知 P0 缺口），
 * AIManager 会在场景内生成同名占位纹理，正式资源到位后只要纹理同名即自动接管。
 */

/** 通用 AI 阈值（单位：像素 / 秒） */
export const AI = Object.freeze({
  /** 巡逻时发现玩家的距离 */
  detectRange: 64,
  /** 进入近战的距离 */
  meleeRange: 16,
  /** 进入远程攻击的距离 */
  rangedRange: 56,
  /** 超出该距离脱战回巡逻点 */
  leashRange: 120,
  /** 默认攻击前摇（闪白预警） */
  windup: 0.2,
  /** 默认攻击后摇 */
  recover: 0.5,
  /** 接触伤害的重复触发间隔 */
  contactCooldown: 0.5,
  /** 空中飞踢命中浮空小怪后的借力弹跳速度 */
  airKickBounce: 180,
  /** 小怪自身重力（世界重力为 0，由各实体自承） */
  gravityY: 1000,
});

/** 小怪配置：texture 为正式资源键，placeholder 仅在资源缺失时用于生成占位图 */
export const MONSTERS = Object.freeze({
  /* 第一关 · 题海小纸精：贴地滑行 + 小跳冲撞，成群出现 */
  paperSpirit: {
    texture: 'mon_paper',
    placeholder: { w: 12, h: 12, color: 0xf2e8d5 },
    hp: 30,
    body: { w: 10, h: 8 },
    patrolSpeed: 24,
    patrolRange: 40,
    chaseSpeed: 48,
    contactDamage: 10,
    windup: 0.25,
    recover: 0.45,
    leapVx: 85,
    leapVy: -160,
    activeTime: 0.35,
    exp: 8,
    drop: { name: '举一反三', chance: 0.25 },
  },

  /* 第一关 · 瞌睡浮游虫：悬浮空中，喷减速泡泡；被吠叫会坠地 */
  sleepBug: {
    texture: 'mon_sleepbug',
    placeholder: { w: 12, h: 10, color: 0xb9c7ff },
    hp: 25,
    body: { w: 10, h: 8 },
    flying: true,
    hoverAmp: 6,
    hoverFreq: 0.9,
    patrolSpeed: 16,
    patrolRange: 35,
    chaseSpeed: 22,
    contactDamage: 0,
    attacksFromRange: true,
    windup: 0.3,
    recover: 0.7,
    bubbleDamage: 5,
    bubbleSpeed: 80,
    exp: 10,
    drop: { name: '风油精提神', chance: 0.25 },
  },

  /* 第一关 · 迟到巡查员：正面护甲 + 秒表冲锋 */
  inspector: {
    texture: 'mon_inspector',
    placeholder: { w: 12, h: 18, color: 0x6b5b4a },
    hp: 80,
    body: { w: 10, h: 16 },
    patrolSpeed: 26,
    patrolRange: 45,
    chaseSpeed: 52,
    contactDamage: 20,
    windup: 0.4,
    recover: 0.5,
    chargeSpeed: 130,
    chargeTime: 0.45,
    frontArmor: 0.5,
    exp: 20,
    drop: { name: '广播体操', chance: 0.25 },
  },

  /* 第二关 · 未读红点：靠近 1 秒自爆 */
  unreadDot: {
    texture: 'mon_dot',
    placeholder: { w: 8, h: 8, color: 0xff4d5e },
    hp: 20,
    body: { w: 6, h: 6 },
    patrolSpeed: 20,
    patrolRange: 20,
    chaseSpeed: 55,
    contactDamage: 0,
    fuseRange: 26,
    fuseTime: 1.0,
    explodeRadius: 32,
    explodeDamage: 30,
    exp: 12,
    drop: { name: '已读不回', chance: 0.25 },
  },

  /* 第二关 · 无偿加班魂：接触持续吸取能量 */
  overtimeGhost: {
    texture: 'mon_ghost',
    placeholder: { w: 12, h: 14, color: 0x7fe3c4 },
    hp: 60,
    body: { w: 10, h: 12 },
    patrolSpeed: 20,
    patrolRange: 35,
    chaseSpeed: 35,
    contactDamage: 8,
    drainRange: 18,
    drainMpPerSec: 10,
    windup: 0.2,
    recover: 0.4,
    exp: 15,
    drop: { name: '咖啡因耐受', chance: 0.25 },
  },

  /* 第二关 · 需求变更涡流：护盾吸收远程，需空中近战破盾 */
  requirementVortex: {
    texture: 'mon_vortex',
    placeholder: { w: 16, h: 16, color: 0x9a6bff },
    hp: 70,
    body: { w: 12, h: 12 },
    flying: true,
    hoverAmp: 5,
    hoverFreq: 0.7,
    patrolSpeed: 18,
    patrolRange: 30,
    chaseSpeed: 24,
    contactDamage: 8,
    reflectRadius: 24,
    shieldBreakTime: 3,
    windup: 0.2,
    recover: 0.4,
    exp: 18,
    drop: { name: '摸鱼回血', chance: 0.25 },
  },
});

/** 随从忠犬三形态（贴图键与 A 的图集键一致：dog_puppy / dog_adult / dog_elder） */
export const DOG = Object.freeze({
  forms: {
    puppy: {
      texture: 'dog_puppy',
      body: { w: 10, h: 8 },
      maxSpeed: 150,
      followOffset: 12,
      biteRange: 56,
      biteStun: 1.0,
      barkRange: 48,
      healInterval: 10,
      healAmount: 5,
      blockMp: 5,
    },
    adult: {
      texture: 'dog_adult',
      body: { w: 16, h: 10 },
      maxSpeed: 140,
      followOffset: 14,
      biteRange: 64,
      biteStun: 1.0,
      barkRange: 56,
      healInterval: 10,
      healAmount: 10,
      blockMp: 5,
      fetchMp: 5,
      guardRange: 60,
    },
    elder: {
      texture: 'dog_elder',
      body: { w: 16, h: 10 },
      maxSpeed: 90,
      followOffset: 10,
      biteRange: 48,
      biteStun: 0.8,
      barkRange: 40,
      healInterval: 10,
      healAmount: 8,
      blockMp: 4,
    },
  },
});

/** Boss 配置：贴图键遵循动画契约（boss_teacher / boss_employer，均为 64×64） */
export const BOSS = Object.freeze({
  teacher: {
    texture: 'boss_teacher',
    displayName: '巨影班主任',
    placeholder: { w: 64, h: 64, color: 0x3b3f6b },
    hp: 420,
    body: { w: 28, h: 44 },
    wanderSpeed: 30,
    wanderTime: 1.2,
    telegraphTime: 0.4,
    recoverTime: 0.6,
    contactDamage: 10,
    preferredRange: 96,
    phase2At: 0.5,
    phase2CooldownScale: 0.65,
    barrageInterval: 6.5,
    paperFallSpeed: 95,
    groundY: 240,
    skills: [
      { id: 'sweep', weight: 40 },
      { id: 'snipe', weight: 30, minRange: 36 },
      { id: 'audit', weight: 30 },
    ],
    skillDurations: { sweep: 1.0, snipe: 0.7, audit: 1.4 },
    damage: { sweep: 18, snipe: 10, audit: 20, paper: 12 },
  },
  employer: {
    texture: 'boss_employer',
    displayName: '黄金暴君·老板',
    placeholder: { w: 64, h: 64, color: 0xc9a227 },
    hp: 460,
    body: { w: 30, h: 44 },
    wanderSpeed: 25,
    wanderTime: 1.2,
    telegraphTime: 0.4,
    recoverTime: 0.65,
    contactDamage: 10,
    preferredRange: 105,
    phase2At: 0.5,
    phase2CooldownScale: 0.62,
    barrageInterval: 7,
    letterRainDuration: 4.0,
    groundY: 240,
    skills: [
      { id: 'smoke', weight: 55 },
      { id: 'stamp', weight: 45 },
    ],
    skillDurations: { smoke: 1.0, stamp: 1.1 },
    damage: { smoke: 6, stamp: 20, letter: 12 },
  },
});

/** 关卡编号 → 忠犬形态（跨场景继承） */
export const DOG_FORM_BY_LEVEL = Object.freeze(['puppy', 'adult', 'elder']);

/** 跨场景持久化用的 registry key */
export const REGISTRY_KEYS = Object.freeze({
  dogUnlocked: 'dogUnlocked',
  dogForm: 'dogForm',
});

/** 弹道 / 拾取物占位纹理规格（A 的正式弹道资源到位后同名覆盖即可） */
export const PROJECTILE_PLACEHOLDERS = Object.freeze({
  bullet_bubble: { w: 6, h: 6, color: 0x9fd8ff, shape: 'circle' },
  bullet_shockwave: { w: 10, h: 6, color: 0xffb066, shape: 'rect' },
  bullet_chalk_boss: { w: 6, h: 3, color: 0xf4f1e1, shape: 'rect' },
  bullet_paper: { w: 8, h: 8, color: 0xf6f2e6, shape: 'rect' },
  bullet_dictionary: { w: 12, h: 12, color: 0x8b4a2f, shape: 'rect' },
  bullet_ring: { w: 10, h: 10, color: 0xffd76a, shape: 'circle' },
  bullet_letter: { w: 8, h: 6, color: 0xfff2c4, shape: 'rect' },
  ai_orb: { w: 6, h: 6, color: 0xffe08a, shape: 'circle' },
});
