/**
 * 主角控制器（成员C：主角操控 / 动作物理 / 机能演变）
 *
 * 继承 Phaser.Physics.Arcade.Sprite，负责：
 *  1. 极简操作：A/D 移动、Space 跳跃、S 下蹲格挡（免伤 70%）
 *  2. 战斗判定：J 近战三连击、L 远程投掷、Space+J 空中飞踢、Space+L 空中投掷
 *  3. 生命周期数值：青年 200/50 回2s → 中年 120/100 回5s → 老年 50/200 回12s
 *  4. 老年机能剥夺：锁定跳跃，按 Space 只播放咳嗽微动作，离地为 0
 *
 * 美术资源（成员A）就位前，这里用 setTint / 内置矩形纹理做占位，接口不变。
 */

import Phaser from 'phaser';
import {
  COMBAT,
  LIFE_PHASES,
  LIFECYCLE,
  MELEE_CHAIN,
  PHYSICS,
  RANGED_COST,
} from '../config/gameConfig.js';
import {
  applyDamage,
  canJump,
  canStartMelee,
  canStartRanged,
  computeMoveSpeed,
  computeMpCap,
  computeMpRegen,
  nextComboStage,
  resolveIncomingDamage,
  resolveJumpKeyAction,
  respawnState,
  tickMp,
  trySpendMp,
} from './combatMath.js';

/** 阶段占位色（成员A 的 SpriteSheet 到位后移除） */
const PHASE_TINT = {
  youth: 0x8fd0ff,
  middle: 0x5d6b7a,
  elder: 0xe8dcc0,
};

export default class Player extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {import('phaser').Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {{phase?: 'youth'|'middle'|'elder'}} [opts]
   */
  constructor(scene, x, y, opts = {}) {
    // 占位贴图：24×24 像素块（设计文档：角色 16×16 / 24×24 网格）
    const textureKey = Player.ensurePlaceholderTexture(scene);
    super(scene, x, y, textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1);
    this.body.setSize(14, 22);
    this.body.setOffset(5, 2);
    this.setCollideWorldBounds(true);
    this.setMaxVelocity(400, PHYSICS.maxFallSpeed);
    this.body.setGravityY(PHYSICS.gravityY);

    /** @type {keyof typeof LIFECYCLE} */
    this.phaseId = opts.phase ?? 'youth';
    this.phase = LIFECYCLE[this.phaseId];

    this.facing = 1;
    this.standardAnswer = false; // 【标准答案】彩蛋 Buff
    this.broadcastExercise = false; // 【广播体操】被动：格挡减免 70→85%

    const maxMp = computeMpCap(this.phase, { standardAnswer: this.standardAnswer });
    this.hp = this.phase.hp;
    this.mp = maxMp;
    this.maxHp = this.phase.hp;
    this.maxMp = maxMp;

    // —— 计时器（毫秒）——
    this.invulnMs = 0;
    this.hurtLockMs = 0;
    this.coyoteLeftMs = 0;
    this.jumpBufferMs = 0;
    this.blockHeldForMs = 0;
    this.coughMs = 0;
    /** 格挡成功时，下一次"按 S 起跳/移动"的放行标记（保留扩展） */
    this.blockedThisFrame = false;

    // —— 近战状态机 ——
    this.meleeStage = 0;
    this._inRecovery = false;
    this.meleeElapsedMs = 0;
    this.meleeHitDone = false;
    this.comboSinceActiveMs = Number.POSITIVE_INFINITY;
    /** 空中飞踢每次腾空只允许触发一次 */
    this._airKickFired = false;

    // —— 远程 ——
    this.rangedCooldownMs = 0;
    this.rangedLatch = false;

    // —— 复活 ——
    this.spawnPoint = { x, y };
    this.isDead = false;

    /** @type {Phaser.GameObjects.Rectangle|null} 近战判定框（调试可视化） */
    this.meleeHitboxDebug = null;
    /** 外部可注入的回调：由场景/AI 对接伤害结算与音效 */
    this.eventsHooks = {
      onMeleeHit: opts.onMeleeHit ?? null,
      onRangedFire: opts.onRangedFire ?? null,
      onCough: opts.onCough ?? null,
      onDeath: opts.onDeath ?? null,
      onDamaged: opts.onDamaged ?? null,
    };

    this.setTint(PHASE_TINT[this.phaseId]);
  }

  /** 无美术资源时生成 24×24 的占位纹理，只生成一次 */
  static ensurePlaceholderTexture(scene) {
    const key = 'memberC_player_placeholder';
    if (!scene.textures.exists(key)) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1).fillRect(0, 0, 24, 24);
      g.lineStyle(2, 0x1b1b25, 1).strokeRect(1, 1, 22, 22);
      g.generateTexture(key, 24, 24);
      g.destroy();
    }
    return key;
  }

  // ==========================================================
  // 阶段切换（关卡衔接时由场景调用）
  // ==========================================================

  /**
   * 切换生命周期阶段：重置上限并按新阶段回满，位置与检查点同步更新。
   * @param {'youth'|'middle'|'elder'} phaseId
   * @param {{refill?: boolean, spawn?: {x:number,y:number}}} [opts]
   */
  setPhase(phaseId, opts = {}) {
    if (!LIFE_PHASES.includes(phaseId)) {
      throw new Error(`未知阶段: ${phaseId}`);
    }
    this.phaseId = phaseId;
    this.phase = LIFECYCLE[phaseId];
    this.maxHp = this.phase.hp;
    this.maxMp = computeMpCap(this.phase, { standardAnswer: this.standardAnswer });

    if (opts.refill !== false) {
      this.hp = this.maxHp;
      this.mp = this.maxMp;
    } else {
      this.hp = Math.min(this.hp, this.maxHp);
      this.mp = Math.min(this.mp, this.maxMp);
    }

    this.setTint(PHASE_TINT[this.phaseId]);
    this.meleeStage = 0;
    if (opts.spawn) this.setSpawnPoint(opts.spawn.x, opts.spawn.y);
    return this;
  }

  get canJumpNow() {
    return this.phase.canJump;
  }

  get isGrounded() {
    return this.body.blocked.down || this.body.touching.down;
  }

  get isBlocking() {
    return this.blockHeldForMs > 0;
  }

  setSpawnPoint(x, y) {
    this.spawnPoint = { x, y };
  }

  /** 获得【标准答案】彩蛋增益 */
  grantStandardAnswer() {
    this.standardAnswer = true;
    this.maxMp = computeMpCap(this.phase, { standardAnswer: true });
    this.mp = this.maxMp;
    return this;
  }

  // ==========================================================
  // 每帧更新
  // ==========================================================

  /**
   * @param {number} delta 毫秒
   * @param {ReturnType<import('../core/Input.js').createIdleState>} input
   */
  update(delta, input) {
    this._tickTimers(delta);

    if (this.isDead) {
      this.setVelocityX(0);
      return;
    }

    this._tickMp(delta);
    this._tickBlock(delta, input);
    this._handleHorizontal(delta, input);
    this._handleJump(input, delta);
    this._handleMelee(input);
    this._handleRanged(input);
    this._tickMelee(delta);
  }

  _tickTimers(delta) {
    this.invulnMs = Math.max(0, this.invulnMs - delta);
    this.hurtLockMs = Math.max(0, this.hurtLockMs - delta);
    this.jumpBufferMs = Math.max(0, this.jumpBufferMs - delta);
    this.rangedCooldownMs = Math.max(0, this.rangedCooldownMs - delta);
    this.coughMs = Math.max(0, this.coughMs - delta);
    this.comboSinceActiveMs = Math.min(Number.POSITIVE_INFINITY, this.comboSinceActiveMs + delta);

    if (this.isGrounded) {
      this.coyoteLeftMs = PHYSICS.coyoteMs;
    } else {
      this.coyoteLeftMs = Math.max(0, this.coyoteLeftMs - delta);
    }

    // 无敌帧闪烁
    this.setAlpha(this.invulnMs > 0 && Math.floor(this.invulnMs / 90) % 2 === 0 ? 0.45 : 1);
  }

  _tickMp(delta) {
    const regen = computeMpRegen(this.phase, { standardAnswer: this.standardAnswer });
    this.mp = tickMp(this.mp, this.maxMp, regen, delta);
  }

  _tickBlock(delta, input) {
    const grounded = this.isGrounded;
    const wantBlock = Boolean(input.blockHeld) && grounded && this.hurtLockMs <= 0;
    if (wantBlock) {
      this.blockHeldForMs += delta;
    } else {
      this.blockHeldForMs = 0;
    }
  }

  _handleHorizontal(delta, input) {
    if (this.hurtLockMs > 0) return;

    // 老年拄拐点地自带定身：出招期间不可移动
    if (this._inRecovery && MELEE_CHAIN[this.phaseId].appliesStun) {
      this.setVelocityX(0);
      return;
    }

    // 格挡中：不能移动（护体姿态）
    if (this.isBlocking) {
      this.setVelocityX(0);
      return;
    }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) this.facing = dir;
    this.setFlipX(this.facing < 0);

    const grounded = this.isGrounded;
    let speed = computeMoveSpeed(PHYSICS.walkSpeed, this.phase, grounded);
    if (!grounded) {
      speed *=
        this.phaseId === 'middle' ? PHYSICS.airControlFactorMiddle : PHYSICS.airControlFactorYouth;
    }
    // 老年咳嗽喘息期间寸步难行
    if (this.coughMs > 0) speed *= 0.25;

    this.setVelocityX(dir * speed);
  }

  _handleJump(input, delta) {
    if (input.jumpDown) this.jumpBufferMs = PHYSICS.jumpBufferMs;

    const action = resolveJumpKeyAction(this.phase);

    // 老年：机能剥夺 —— 只有咳嗽动作，永远不离地
    if (action === 'cough') {
      if (input.jumpDown && !this.isDead) {
        this.coughMs = 420;
        this.setVelocityX(0);
        this.eventsHooks.onCough?.();
      }
      return;
    }

    if (this.jumpBufferMs > 0 && this.hurtLockMs <= 0 && !this.isBlocking) {
      if (canJump(this.phase, { grounded: this.isGrounded, coyoteLeftMs: this.coyoteLeftMs })) {
        this.setVelocityY(PHYSICS.jumpVelocity);
        this.jumpBufferMs = 0;
        this.coyoteLeftMs = 0;
      }
    }
  }

  _handleMelee(input) {
    // 近战/远程用"按住"语义：起手与连击时机由连击窗口裁决，
    // 长按 J 即可顺畅打出三连击；冷却内的按住不会重复触发远程。
    if (!input.meleeHeld) return;

    const grounded = this.isGrounded;

    // 空中：只在起跳那一刻响应一次，避免长按 J 在空中疯狂刷判定
    if (!grounded) {
      // 老年期不可用 —— 不是特判，而是它根本离不了地（canJump=false → 永远走不到这里）
      if (!this.phase.canJump || this.hurtLockMs > 0) return;
      if (input._held?.jump && !this._airKickFired) {
        this._airKickFired = true;
        this._startMelee(3, { airKick: true });
      }
      return;
    }
    this._airKickFired = false;

    if (
      !canStartMelee({
        hurtLockMs: this.hurtLockMs,
        blocking: this.isBlocking,
        grounded,
      })
    ) {
      return;
    }

    // 上一段还在出招/收招：等它打完再起下一段（下次 update 会自动续接）
    if (this._inRecovery) return;

    const stage = nextComboStage(
      this.meleeStage,
      this.comboSinceActiveMs,
      MELEE_CHAIN[this.phaseId].linkWindow,
    );
    this._startMelee(stage);
  }

  /** 起手一段近战（stage 1~3） */
  _startMelee(stage, { airKick = false } = {}) {
    const chain = MELEE_CHAIN[this.phaseId];
    this.meleeStage = stage;
    this.meleeActiveAt = chain.activeAt[stage - 1] ?? chain.activeAt[0];
    this.meleeRecoverAt = chain.recover[stage - 1] ?? chain.recover[0];
    this.meleeHitDone = false;
    this.meleeElapsedMs = 0;
    this.meleeAirKick = airKick;
    this._inRecovery = true;
    this.comboSinceActiveMs = 0;
    // 出招时锁住水平意图（老年拄拐点地：动作更慢，且带定身）
    if (MELEE_CHAIN[this.phaseId].appliesStun) this.setVelocityX(0);
  }

  _tickMelee(delta) {
    // 连击窗口过期：自动回归第一段
    if (this.meleeStage !== 0 && this.comboSinceActiveMs > MELEE_CHAIN[this.phaseId].linkWindow) {
      this.meleeStage = 0;
      this._inRecovery = false;
    }
    if (!this._inRecovery) return;

    this.meleeElapsedMs += delta;

    if (!this.meleeHitDone && this.meleeElapsedMs >= this.meleeActiveAt) {
      this.meleeHitDone = true;
      const chain = MELEE_CHAIN[this.phaseId];
      const damage = chain.damage[this.meleeStage - 1] ?? chain.damage[0];
      const box = this.getMeleeHitbox();
      this.eventsHooks.onMeleeHit?.({
        damage,
        stage: this.meleeStage,
        airKick: this.meleeAirKick,
        box,
        phaseId: this.phaseId,
        knockbackSmallEnemies: Boolean(chain.knockbackSmallEnemies),
        appliesStun: Boolean(chain.appliesStun),
        owner: this,
      });
    }

    if (this.meleeElapsedMs >= this.meleeRecoverAt) {
      // 收招完毕。段位保留到连击窗口过期，这样"点一下 J 再点一下"能接上第二、第三段。
      this._inRecovery = false;
      this.meleeHitDone = true;
      this.meleeAirKick = false;
      this.meleeElapsedMs = 0;
    }
  }

  /** 近战判定框（世界坐标），供场景做 overlap 判定 */
  getMeleeHitbox() {
    if (this.meleeStage === 0) return null;
    const chain = MELEE_CHAIN[this.phaseId];
    const w = chain.reach + 10;
    const h = this.meleeAirKick ? 26 : 20;
    const cx = this.facing > 0 ? this.x + chain.reach / 2 : this.x - chain.reach / 2;
    const cy = this.meleeAirKick ? this.y - this.displayHeight - 8 : this.y - h / 2 - 4;
    return new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h);
  }

  _handleRanged(input) {
    // 按住 L 时，冷却一好就继续投掷（手感接近"连发"），能量不足自然停下
    if (!input.rangedHeld) {
      this.rangedLatch = false;
      return;
    }
    if (this.rangedCooldownMs > 0) return;
    if (!canStartRanged({ hurtLockMs: this.hurtLockMs, blocking: this.isBlocking })) return;

    const cost = RANGED_COST[this.phaseId];
    const remaining = trySpendMp(this.mp, cost);
    if (remaining === null) return; // 能量不足，放不出来

    this.mp = remaining;
    this.rangedCooldownMs = this.phaseId === 'elder' ? 260 : 340;
    // 空中投掷（Space + L）：由"是否离地"自然区分，检查点同地面
    this.eventsHooks.onRangedFire?.({
      phaseId: this.phaseId,
      x: this.x + this.facing * 12,
      y: this.y - 14,
      facing: this.facing,
      airborne: !this.isGrounded,
      owner: this,
    });
  }

  // ==========================================================
  // 受伤 / 死亡 / 复活
  // ==========================================================

  /**
   * 受到伤害（外部调用）。
   * @param {number} damage
   * @param {{fromX?: number, knockback?: number, source?: string}} [opts]
   * @returns {{damage:number, blocked:boolean, perfect:boolean, died:boolean}}
   */
  takeDamage(damage, opts = {}) {
    if (this.isDead || this.invulnMs > 0 || this.hurtLockMs > 0) {
      return { damage: 0, blocked: false, perfect: false, died: false };
    }

    const blockHeld = this.isBlocking;
    const result = resolveIncomingDamage(damage, {
      blockHeld,
      blockHeldForMs: blockHeld ? this.blockHeldForMs : Infinity,
      passiveReduction: this.broadcastExercise ? 0.85 : COMBAT.blockReductionBase,
    });

    this.hp = applyDamage(this.hp, result.damage);

    if (result.blocked) {
      if (result.perfect) {
        this.mp = Math.min(this.maxMp, this.mp + result.mpGain);
      }
      // 格挡成功小幅回冲，不打断姿态
      this.invulnMs = 120;
    } else {
      this.hurtLockMs = PHYSICS.hurtLockMs;
      this.invulnMs = PHYSICS.invulnMs;
      const kb = opts.knockback ?? 120;
      const dir = opts.fromX !== undefined ? Math.sign(this.x - opts.fromX) || 1 : -this.facing;
      this.setVelocity(dir * kb, opts.lift ?? -110);
    }

    this.eventsHooks.onDamaged?.({
      result,
      hp: this.hp,
      damage: result.damage,
      source: opts.source ?? 'unknown',
      owner: this,
    });

    if (this.hp <= 0) {
      this.die();
      return { ...result, died: true };
    }
    return { ...result, died: false };
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    this.setVelocity(0, 0);
    this.setTint(0x555566);
    this.eventsHooks.onDeath?.({ owner: this });
  }

  /**
   * 在最近的检查点复活（满血满蓝 + 无敌帧）
   * @param {{x?:number, y?:number}} [checkpoint]
   */
  respawn(checkpoint) {
    const spot = checkpoint ?? this.spawnPoint;
    const state = respawnState(this.phase, { standardAnswer: this.standardAnswer });
    this.hp = state.hp;
    this.mp = state.mp;
    this.invulnMs = state.invulnMs;
    this.isDead = false;
    this.hurtLockMs = 0;
    this.meleeStage = 0;
    this.setPosition(spot.x, spot.y);
    this.setVelocity(0, 0);
    this.setTint(PHASE_TINT[this.phaseId]);
    this.setAlpha(1);
    return this;
  }

  /** 调试：画近战判定框 */
  setDebugMeleeBox(visible) {
    if (!visible) {
      this.meleeHitboxDebug?.destroy();
      this.meleeHitboxDebug = null;
      return;
    }
    if (!this.meleeHitboxDebug) {
      this.meleeHitboxDebug = this.scene.add
        .rectangle(0, 0, 1, 1, 0xff3366, 0.25)
        .setOrigin(0.5)
        .setDepth(9000);
    }
    const box = this.getMeleeHitbox();
    if (box) {
      this.meleeHitboxDebug.setVisible(true).setPosition(box.x + box.width / 2, box.y + box.height / 2);
      this.meleeHitboxDebug.setSize(box.width, box.height);
    } else {
      this.meleeHitboxDebug.setVisible(false);
    }
  }
}

export { PHASE_TINT };
