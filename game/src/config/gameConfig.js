/**
 * 全局数值与按键常量（成员C：主角操控 / 动作物理 / 机能演变）
 *
 * 这里的数值必须与《游戏功能设计文档》§1.2 生命周期属性演变、§2 操作规范、
 * §3 核心战斗数值严格对齐；改动属于"共享配置"，按 CONTRIBUTING.md 需先在群里报备。
 */

/** 原生像素分辨率（整数倍放大到 1080P/4K，最近邻采样） */
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;
export const TILE_SIZE = 16;

/** 物理世界与手感常量（单位：像素 / 秒） */
export const PHYSICS = Object.freeze({
  gravityY: 1000,
  walkSpeed: 95,
  /** 空中水平速度倍率：青年身手敏捷，空中保持大部分位移 */
  airControlFactorYouth: 0.85,
  /** 中年略显沉重，空中位移收窄 */
  airControlFactorMiddle: 0.7,
  /** 老年步履蹒跚，地面速度打八折 */
  elderGroundFactor: 0.8,
  jumpVelocity: -310,
  /** 落地时的竖直速度阻尼，避免贴地抖动 */
  maxFallSpeed: 620,
  coyoteMs: 90,
  jumpBufferMs: 110,
  /** 被击飞/受击后的无操作时间（避免受击瞬间继续冲刺） */
  hurtLockMs: 220,
  invulnMs: 900,
  maxHpDefault: 200,
  respawnDelayMs: 700,
});

/**
 * 三个阶段的生命周期数值（设计文档 §1.2）
 * hp / mp：上限；mpRegen：每秒自动回能；canJump：老年机能剥夺
 */
export const LIFECYCLE = Object.freeze({
  youth: Object.freeze({
    id: 'youth',
    label: '青年',
    stage: 1,
    hp: 200,
    mp: 50,
    mpRegen: 2,
    canJump: true,
    jumpKeyBehavior: 'jump',
  }),
  middle: Object.freeze({
    id: 'middle',
    label: '中年',
    stage: 2,
    hp: 120,
    mp: 100,
    mpRegen: 5,
    canJump: true,
    jumpKeyBehavior: 'jump',
  }),
  elder: Object.freeze({
    id: 'elder',
    label: '老年',
    stage: 3,
    hp: 50,
    mp: 200,
    mpRegen: 12,
    canJump: false,
    /** 老年按 Space 只播放驻足微喘（咳嗽），角色离地为 0 */
    jumpKeyBehavior: 'cough',
  }),
});

export const LIFE_PHASES = Object.freeze(['youth', 'middle', 'elder']);

/** 战斗与格挡（设计文档 §3） */
export const COMBAT = Object.freeze({
  /** 普通格挡免伤 70%；【广播体操】被动可提升至 85% */
  blockReductionBase: 0.7,
  /** 完美格挡窗口：受到伤害前 0.2 秒内按住 S */
  perfectBlockWindowMs: 200,
  /** 完美格挡免伤 90%，并瞬回 10 点能量 */
  perfectBlockReduction: 0.9,
  perfectBlockMpGain: 10,
  /** 老年拄拐点地：动作更慢但带定身硬直 */
  elderMeleeLingerMs: 220,
});

/** 各阶段近战三连击时序（毫秒：出招点 / 收招） */
export const MELEE_CHAIN = Object.freeze({
  youth: Object.freeze({
    damage: [10, 10, 16],
    activeAt: [60, 60, 110],
    recover: [120, 120, 240],
    reach: 20,
    /** 连击输入窗口：收招前多少毫秒内按 J 可续接下一段 */
    linkWindow: 320,
    label: '少年直拳 · 接书包横砸',
  }),
  middle: Object.freeze({
    damage: [14, 14, 22],
    activeAt: [75, 75, 140],
    recover: [160, 160, 300],
    reach: 24,
    linkWindow: 380,
    label: '公文包重击',
    /** 对小型敌人 100% 击退（由 AI/受击方消费） */
    knockbackSmallEnemies: true,
  }),
  elder: Object.freeze({
    damage: [8, 8, 12],
    activeAt: [120, 120, 200],
    recover: [220, 220, 380],
    reach: 18,
    linkWindow: 420,
    label: '拐杖点地敲击',
    /** 命中附加定身硬直 */
    appliesStun: true,
  }),
});

/** 远程消耗（设计文档 §4.2 / §5.5；老年期改为漫天记忆碎片） */
export const RANGED_COST = Object.freeze({
  youth: 15,
  middle: 20,
  elder: 10,
});

/** 远程冷却（毫秒）：青年/中年 340，老年 260 */
export const RANGED_COOLDOWN = Object.freeze({
  youth: 340,
  middle: 340,
  elder: 260,
});

/** 第一关【标准答案】彩蛋增益：能量上限 50→80，回能 2→4 */
export const STANDARD_ANSWER_BUFF = Object.freeze({
  mpCap: 80,
  mpRegen: 4,
});

/**
 * 第一关【怦然心动】彩蛋增益（issue #16 彩蛋1 手写情书）：
 * 桌洞纸堆打碎后拾取情书，近战伤害永久提升 25%。
 * 数值取"少年直拳 10/10/16 → 13/13/20"，与三连击节奏对齐不破格。
 */
export const LOVE_LETTER_BUFF = Object.freeze({
  meleeMultiplier: 1.25,
});

/**
 * 经验系统【领悟】（issue #17，GDD §3.1）：
 * 击杀怪物掉落感悟光球 → 靠近磁吸吸收 → 经验条满升级 → 暂停自选强化。
 * 磁吸手感参数全部收口在这里，方便按实测调。
 */
export const XP_SYSTEM = Object.freeze({
  /** 吸附半径（px）：玩家进入后光球开始磁吸 */
  magnetRadius: 76,
  /** 磁吸最大速度（px/s） */
  magnetSpeed: 240,
  /** 磁吸加速度（px/s²）：决定"吸过来"的干脆程度 */
  magnetAccel: 1100,
  /** 吸收距离（px）：小于该值即入账 */
  pickupRadius: 12,
  /** 升到 2 级所需经验（一关小怪经验约 80，中期即可首升） */
  baseLevelExp: 40,
  /** 每级需求倍率（L2=40, L3=54, L4=73 …） */
  levelGrowth: 1.35,
});

/** 升级三选一强化（GDD §3.1：攻击力/暴击率/跳跃滞空） */
export const LEVEL_UPGRADES = Object.freeze({
  attack: Object.freeze({
    id: 'attack',
    label: '攻击力提升',
    desc: '近战伤害 +25%（可叠加）',
    /** 每级近战倍率 */
    meleeMultiplier: 1.25,
    maxLevels: 4,
  }),
  crit: Object.freeze({
    id: 'crit',
    label: '暴击率提升',
    desc: '近战暴击率 +15%，暴击伤害 ×2',
    critGain: 0.15,
    critCap: 0.6,
    critMultiplier: 2,
    maxLevels: 3,
  }),
  hang: Object.freeze({
    id: 'hang',
    label: '跳跃滞空延长',
    desc: '腾空更久、落点更远（重力 ×0.85/级）',
    /** 每级重力缩放（乘在 PHYSICS.gravityY 上，越小越滞空） */
    gravityScale: 0.85,
    floor: 0.7,
    maxLevels: 2,
  }),
});

/** 按键映射（设计文档 §2.1，PC 键盘标准） */
export const KEYS = Object.freeze({
  left: ['LEFT', 'A'],
  right: ['RIGHT', 'D'],
  jump: ['SPACE'],
  block: ['DOWN', 'S'],
  melee: ['J'],
  ranged: ['L'],
});

/** 单键的"是否按下"判定，供 Input.js / Player.js 共用（便于单测） */
export const KEY_DOWN = Object.freeze({
  left: 'A',
  right: 'D',
  jump: 'SPACE',
  block: 'S',
  melee: 'J',
  ranged: 'L',
});
