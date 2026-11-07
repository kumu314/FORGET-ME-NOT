import Phaser from 'phaser';
import { BOSS } from '../config/aiConfig.js';
import { playAnim } from './anim.js';

/**
 * Boss AI 通用框架（成员D · GDD 7.3）
 *
 * 循环：WANDER 闲逛发呆（给玩家输出空间）
 *      → SELECT 按距离抽招
 *      → TELEGRAPH 红色预警框
 *      → ACTION 出招判定
 *      → RECOVER 后摇
 *
 * HP 低于 phase2At 强制二阶段：缩短冷却 + 常态化弹幕 + enraged 动画。
 * 招式由 BossTeacher / BossAdmin 覆写 telegraphRect / skillAnim / doSkill / phase2Tick。
 *
 * 动画键遵循契约：boss_teacher:sweep / boss_employer:smoke …
 * 贴图 / 图集由成员A 提供；未加载时 AIManager 生成同名占位纹理。
 */
export class BossBase extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, kind, arena = {}) {
    const cfg = BOSS[kind];
    if (!cfg) throw new Error(`[AI] 未知 Boss 类型: ${kind}`);
    super(scene, x, y, cfg.texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.kind = kind;
    this.cfg = cfg;
    this.body.setSize(cfg.body.w, cfg.body.h);
    this.body.setOffset((this.width - cfg.body.w) / 2, this.height - cfg.body.h);
    this.body.setAllowGravity(false);
    this.body.setVelocity(0, 0);
    this.setDepth(5);
    this.setCollideWorldBounds(true);

    this.hpMax = cfg.hp;
    this.hp = cfg.hp;
    this.phase = 1;
    this.defeated = false;

    this.actionState = 'WANDER';
    this.actionTimer = cfg.wanderTime;
    this.pendingSkill = null;
    this.cooldownScale = 1;
    this.nextBarrageAt = Infinity;
    this.letterRainActive = false;
    this.letterRainEndAt = 0;
    this.hurtUntil = 0;
    this.animOverrideUntil = 0;
    this._introPlayed = false;

    const world = scene.physics.world.bounds;
    this.player = scene.ai ? scene.ai.player : scene.player;
    this.arena = {
      left: arena.left ?? world.x + 40,
      right: arena.right ?? world.right - 40,
    };
    this.groundY = arena.groundY ?? cfg.groundY;

    // 脚底对齐地面：兼容占位图（origin 0.5）与 A 图集的 pivot 原点
    this.setY(this.groundY - (this.displayHeight - this.displayOriginY));

    this.telegraphs = [];
    this.contactCd = 0;

    this.setAnim('idle', true);
    scene.events.emit('ai:boss:spawn', {
      kind: this.kind,
      name: cfg.displayName,
      hpMax: this.hpMax,
    });
  }

  update(time, delta) {
    if (this.defeated || !this.active) return;
    if (!this._introPlayed) {
      this._introPlayed = true;
      this.speak(this.cfg.lines?.intro, { shake: true });
    }
    const dt = Math.min(delta, 40) / 1000;
    if (this.contactCd > 0) this.contactCd -= dt;

    this.setFlipX(this.player.x < this.x);
    this.checkPhase(time);
    if (this.phase === 2 && this.phase2Tick) this.phase2Tick(time, dt);

    switch (this.actionState) {
      case 'WANDER':
        this.wander(dt);
        this.actionTimer -= dt;
        if (this.actionTimer <= 0) this.beginSelect();
        break;

      case 'TELEGRAPH':
        this.body.setVelocityX(0);
        this.actionTimer -= dt;
        if (this.actionTimer <= 0) this.executeSkill(time);
        break;

      case 'ACTION':
        this.body.setVelocityX(0);
        if (this.skillTick) this.skillTick(time, dt);
        this.actionTimer -= dt;
        if (this.actionTimer <= 0) {
          this.actionState = 'RECOVER';
          this.actionTimer = this.cfg.recoverTime * this.cooldownScale;
          this.clearTelegraphs();
        }
        break;

      case 'RECOVER':
        this.body.setVelocityX(0);
        this.actionTimer -= dt;
        if (this.actionTimer <= 0) {
          this.actionState = 'WANDER';
          this.actionTimer = this.cfg.wanderTime * this.cooldownScale;
        }
        break;
    }

    this.refreshAnim();
    this.touchPlayer();
  }

  wander(dt) {
    const dist = Math.abs(this.player.x - this.x);
    let dir = Math.sign(this.player.x - this.x) || 1;
    if (dist < this.cfg.preferredRange) dir = -dir;

    let vx = dir * this.cfg.wanderSpeed;
    if (this.x < this.arena.left) vx = Math.abs(this.cfg.wanderSpeed);
    if (this.x > this.arena.right) vx = -Math.abs(this.cfg.wanderSpeed);
    this.body.setVelocityX(vx);
  }

  /* ---------- 动画 ---------- */

  /** 当前应播放的动作键；受击时由 hurtUntil 临时接管 */
  currentAction() {
    if (this.actionState === 'ACTION') return this.skillAnim(this.pendingSkill) || 'idle';
    if (this.phase === 2) return 'enraged';
    return 'idle';
  }

  setAnim(action, force = false) {
    if (!force && this.animAction === action) return;
    this.animAction = action;
    playAnim(this, this.cfg.texture, action);
  }

  refreshAnim() {
    const now = this.scene.time.now;
    if (now < this.hurtUntil || now < this.animOverrideUntil) return;
    this.setAnim(this.currentAction());
  }

  /** 子类覆写：招式 → 动画键（sweep / throw_chalk / summon / slam / smoke / envelopes） */
  skillAnim() {
    return 'idle';
  }

  /* ---------- 招式选择 ---------- */
  beginSelect() {
    this.pendingSkill = this.pickSkill();
    this.beginTelegraph(this.pendingSkill);
    this.actionState = 'TELEGRAPH';
    this.actionTimer = this.cfg.telegraphTime;
  }

  pickSkill() {
    const dist = Math.abs(this.player.x - this.x);
    let list = this.cfg.skills.filter((s) => (s.minRange ? dist >= s.minRange : true));
    if (list.length === 0) list = this.cfg.skills;

    let total = 0;
    for (const s of list) total += s.weight;
    let r = Math.random() * total;
    for (const s of list) {
      r -= s.weight;
      if (r <= 0) return s.id;
    }
    return list[0].id;
  }

  beginTelegraph(skillId) {
    const r = this.telegraphRect(skillId);
    if (!r) return;
    const rect = this.scene.add
      .rectangle(r.x, r.y, r.w, r.h, 0xff3344, 0.18)
      .setStrokeStyle(2, 0xff3344)
      .setDepth(4);
    this.telegraphs.push(rect);
    this.scene.tweens.add({
      targets: rect,
      alpha: 0.7,
      duration: this.cfg.telegraphTime * 1000,
      yoyo: true,
    });
  }

  clearTelegraphs() {
    this.telegraphs.forEach((t) => t.destroy());
    this.telegraphs = [];
  }

  executeSkill(time) {
    this.clearTelegraphs();
    this.actionState = 'ACTION';
    this.actionTimer =
      (this.cfg.skillDurations && this.cfg.skillDurations[this.pendingSkill]) || 0.8;
    this.doSkill(this.pendingSkill, time);
  }

  /* ---------- 阶段 ---------- */
  checkPhase(time) {
    if (this.phase !== 1 || this.hp > this.hpMax * this.cfg.phase2At) return;

    this.phase = 2;
    this.cooldownScale = this.cfg.phase2CooldownScale;
    this.nextBarrageAt = time + this.cfg.barrageInterval * 1000;
    this.setTint(0xffb3b3);
    this.scene.time.delayedCall(260, () => {
      if (this.active && !this.defeated) this.clearTint();
    });
    this.setAnim('enraged', true);

    this.scene.events.emit('ai:boss:phase', { kind: this.kind, phase: 2 });
    this.speak(
      this.kind === 'teacher' ? '班主任进入狂暴：试卷羽翼展开！' : '老板进入狂暴：裁员信风暴！',
    );
    if (this.onPhase2) this.onPhase2(time);
  }

  /* ---------- 受伤 / 结算 ---------- */
  takeDamage(amount, opts = {}) {
    if (this.defeated) return 0;
    this.hp -= amount;

    this.setTint(0xff7a7a);
    this.hurtUntil = this.scene.time.now + 150;
    this.setAnim('hurt', true);
    this.scene.time.delayedCall(160, () => {
      if (this.active && !this.defeated) this.refreshAnim();
    });

    this.scene.events.emit('ai:damage', {
      x: this.x,
      y: this.y - 20,
      amount: Math.round(amount),
      target: 'boss',
      kind: this.kind,
    });
    this.scene.events.emit('ai:boss:hp', {
      kind: this.kind,
      hp: Math.max(0, this.hp),
      hpMax: this.hpMax,
      phase: this.phase,
    });

    if (this.hp <= 0) this.defeat();
    return amount;
  }

  defeat() {
    if (this.defeated) return;
    this.defeated = true;
    this.body.enable = false;
    this.clearTelegraphs();
    this.letterRainActive = false;
    this.speak(this.cfg.lines?.defeat, { holdMs: 2400 });
    this._paperBurst();
    this.scene.events.emit('ai:boss:defeated', { kind: this.kind });
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 20,
      duration: 700,
      onComplete: () => this.destroy(),
    });
  }

  /**
   * 台词横幅（登场/狂暴/结算通用）：自持渲染，不依赖外部事件监听者。
   * 顺带修复：此前狂暴提示走 ai:toast 事件，但该事件无任何监听方，台词从未显示过。
   */
  speak(text, opts = {}) {
    if (!text) return;
    if (opts.shake) this.scene.cameras.main.shake(240, 0.006);
    const banner = this.scene.add
      .text(this.scene.scale.width / 2, 48, text, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffe9b0',
        backgroundColor: '#000000aa',
        align: 'center',
        wordWrap: { width: this.scene.scale.width - 36 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(3000);
    this.scene.tweens.add({
      targets: banner,
      alpha: 0,
      delay: opts.holdMs ?? 1900,
      duration: 500,
      onComplete: () => banner.destroy(),
    });
  }

  /** 通关演出：试卷/KPI 纸屑崩解（纯矩形，遵循红线三"不做复杂动画"） */
  _paperBurst() {
    const palette =
      this.kind === 'teacher'
        ? [0xfff6e0, 0xffe9b0, 0xffffff]
        : [0xe8e8e8, 0xd8c9a3, 0xfff2c4];
    for (let i = 0; i < 14; i += 1) {
      const scrap = this.scene.add
        .rectangle(
          this.x + Phaser.Math.Between(-26, 26),
          this.y + Phaser.Math.Between(-32, 8),
          Phaser.Math.Between(3, 7),
          Phaser.Math.Between(4, 8),
          Phaser.Utils.Array.GetRandom(palette),
        )
        .setDepth(6);
      this.scene.tweens.add({
        targets: scrap,
        y: scrap.y + Phaser.Math.Between(36, 92),
        x: scrap.x + Phaser.Math.Between(-32, 32),
        angle: Phaser.Math.Between(-220, 220),
        alpha: 0,
        duration: Phaser.Math.Between(650, 1100),
        ease: 'Quad.easeOut',
        onComplete: () => scrap.destroy(),
      });
    }
  }

  touchPlayer() {
    if (!this.player || this.player.isDead) return;
    if (this.contactCd > 0) return;
    if (!Phaser.Geom.Intersects.RectangleToRectangle(this.getBounds(), this.player.getBounds())) return;
    this.contactCd = 0.6;
    this.player.takeDamage(this.cfg.contactDamage, {
      fromX: this.x,
      knockback: 140,
      source: `boss:${this.kind}`,
    });
  }

  destroy(fromScene) {
    this.clearTelegraphs();
    super.destroy(fromScene);
  }

  /* 子类覆写 */
  telegraphRect() {
    return null;
  }

  doSkill() {}
}

export default BossBase;
