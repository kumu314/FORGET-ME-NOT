import Phaser from 'phaser';
import { AI, MONSTERS } from '../config/aiConfig.js';
import { monsterBreathKey } from '../scenes/monsterSprites.js';

/**
 * 小怪 AI：有限状态机 FSM（成员D · GDD 7.1）
 *
 * 状态循环：
 *   PATROL 巡逻 →（玩家进入 64px）CHASE 追击 →
 *   （进入 16px 近战 / 56px 远程）ATTACK（0.2s 前摇闪白 → 判定 → 后摇）→ CHASE
 *
 * 所有小怪共用本基类，差异通过 aiConfig.MONSTERS + 子类覆写实现。
 * 外部（AIManager / 玩家攻击）只调用 takeDamage / stun / knockDown。
 *
 * 与成员C 的 Player 对接约定（鸭子类型，不 import C 的文件）：
 *   player.isDead / player.x / player.y / player.body / player.getBounds()
 *   player.takeDamage(dmg, { fromX, knockback, lift, source })
 *   player.setVelocityY(v)
 */
export class MonsterFSM extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type) {
    const def = MONSTERS[type];
    if (!def) throw new Error(`[AI] 未知小怪类型: ${type}`);
    super(scene, x, y, def.texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.typeKey = type;
    this.def = def;
    this.body.setSize(def.body.w, def.body.h);
    this.body.setOffset((this.width - def.body.w) / 2, this.height - def.body.h);
    this.body.setAllowGravity(!def.flying);
    if (!def.flying) this.body.setGravityY(AI.gravityY);
    // depth 14：地形/瓦片是 10~12，玩家是 20。
    // 原来写 3，小怪会被瓦片盖住半截（#47 瓦片上墙后尤其明显，站位贴着地面的怪只剩头顶露出来）。
    // 取 14 让怪站在场景之上、玩家之下，也留出 15 给雨幕等前景特效。
    this.setDepth(14);

    this.hpMax = def.hp;
    this.hp = def.hp;
    this.homeX = x;
    this.homeY = y;

    this.state = 'PATROL';
    this.attackPhase = null;
    this.phaseTime = 0;
    this.activeTime = 0.05;
    this.stunUntil = 0;
    this.dead = false;
    this.destroyed = false;
    this.touchCd = 0;
    this.patrolDir = Math.random() < 0.5 ? -1 : 1;
    this.hoverPhase = Math.random() * Math.PI * 2;
    this.knockedDown = false;
    this.facing = -1;
    this.player = scene.ai ? scene.ai.player : scene.player;

    if (def.flying) this.baseY = y;
    const breathKey = monsterBreathKey(def.texture);
    if (scene.anims.exists(breathKey)) this.play(breathKey);
  }

  update(time, delta) {
    if (this.dead || !this.active) return;
    const dt = Math.min(delta, 40) / 1000;
    if (this.touchCd > 0) this.touchCd -= dt;

    // 眩晕（被狗扑咬 / 被踩头 / 被打落）
    if (time < this.stunUntil) {
      this.body.setVelocityX(0);
      if (this.def.flying && !this.knockedDown) this.body.setVelocityY(0);
      this.updateContact();
      return;
    }
    if (this.knockedDown) {
      this.knockedDown = false;
      if (this.def.flying) {
        this.body.setAllowGravity(false);
        this.body.setVelocity(0, 0);
        this.baseY = this.y;
      }
      this.clearTint();
    }

    // 自定义行为的小怪（红点 / 加班魂 / 涡流）
    if (this.behavior) {
      this.behavior(time, dt);
      this.updateContact();
      return;
    }

    this.fsm(time, dt);
    this.updateContact();
  }

  fsm(time, dt) {
    const p = this.player;
    if (!p) return;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);

    switch (this.state) {
      case 'PATROL':
        if (!p.isDead && dist < AI.detectRange) {
          this.state = 'CHASE';
          break;
        }
        this.patrol(dt);
        break;

      case 'CHASE':
        if (p.isDead || dist > AI.leashRange) {
          this.state = 'PATROL';
          this.body.setVelocityX(0);
          break;
        }
        if (dist <= AI.meleeRange || (this.def.attacksFromRange && dist <= AI.rangedRange)) {
          this.enterAttack();
          break;
        }
        this.chase(dist, dt);
        break;

      case 'ATTACK':
        this.attackTick(time, dt);
        break;
    }
  }

  patrol(dt) {
    const speed = this.def.patrolSpeed || 24;
    this.body.setVelocityX(this.patrolDir * speed);
    if (this.x > this.homeX + this.def.patrolRange) this.patrolDir = -1;
    if (this.x < this.homeX - this.def.patrolRange) this.patrolDir = 1;
    this.setFlipX(this.body.velocity.x < 0);
    if (this.def.flying) this.hover(dt);
  }

  chase(dist, dt) {
    const dir = Math.sign(this.player.x - this.x) || this.facing;
    this.facing = dir;
    this.body.setVelocityX(dir * (this.def.chaseSpeed || 40));
    this.setFlipX(dir < 0);
    if (this.def.flying) this.hover(dt);
  }

  hover(dt) {
    if (!this.def.flying || this.knockedDown) return;
    this.hoverPhase += dt * (this.def.hoverFreq || 1) * Math.PI * 2;
    this.setY(this.baseY + Math.sin(this.hoverPhase) * (this.def.hoverAmp || 0));
  }

  /* ---------- 攻击三阶段 ---------- */
  enterAttack() {
    if (this.state === 'ATTACK') return;
    this.state = 'ATTACK';
    this.attackPhase = 'WINDUP';
    this.phaseTime = 0;
    this.body.setVelocityX(0);
    if (this.def.flying) this.body.setVelocityY(0);
    this.setTintFill(0xffffff); // 前摇闪白预警
  }

  attackTick(time, dt) {
    this.phaseTime += dt;

    if (this.attackPhase === 'WINDUP') {
      if (this.phaseTime >= (this.def.windup ?? AI.windup)) {
        this.clearTint();
        this.phaseTime = 0;
        this.attackPhase = 'ACTIVE';
        this.performAttack();
      }
      return;
    }

    if (this.attackPhase === 'ACTIVE') {
      if (this.phaseTime >= this.activeTime) {
        this.phaseTime = 0;
        this.attackPhase = 'RECOVER';
        this.endAttack();
      }
      return;
    }

    if (this.attackPhase === 'RECOVER') {
      if (this.phaseTime >= (this.def.recover ?? AI.recover)) {
        this.state = 'CHASE';
        this.attackPhase = null;
        this.body.setVelocityX(0);
      }
    }
  }

  /* 子类覆写 */
  performAttack() {}
  endAttack() {}

  /* ---------- 受伤 / 控制 ---------- */
  takeDamage(amount, opts = {}) {
    if (this.dead) return 0;

    let dmg = amount;
    const srcX = opts.fromX ?? (this.player ? this.player.x : this.x);

    // 正面护甲（迟到巡查员：正面受击伤害减半）
    if (this.def.frontArmor) {
      const fromRight = srcX > this.x;
      const fromFront = (fromRight && this.facing > 0) || (!fromRight && this.facing < 0);
      if (fromFront) dmg *= this.def.frontArmor;
    }

    this.hp -= dmg;
    this.flashHit();

    if (opts.knockback) {
      const dir = opts.dir ?? (Math.sign(this.x - srcX) || 1);
      this.body.setVelocity(dir * opts.knockback, this.def.flying ? -60 : -100);
    }
    if (opts.stunMs) this.stun(opts.stunMs / 1000);

    this.scene.events.emit('ai:damage', {
      x: this.x,
      y: this.y - 8,
      amount: Math.round(dmg),
      target: 'monster',
      type: this.typeKey,
    });

    if (this.hp <= 0) this.die();
    return dmg;
  }

  flashHit() {
    if (this.attackPhase === 'WINDUP') return; // 保持前摇闪白
    this.setTint(0xff8a8a);
    if (this.flashEvent) this.flashEvent.remove(false);
    this.flashEvent = this.scene.time.delayedCall(120, () => {
      if (this.active && this.attackPhase !== 'WINDUP') this.clearTint();
    });
  }

  stun(seconds) {
    if (this.dead) return;
    this.stunUntil = this.scene.time.now + seconds * 1000;
    this.body.setVelocityX(0);
    if (this.def.flying) this.body.setVelocityY(0);
    this.clearTint();
  }

  /** 浮空小怪被打落（忠犬吠叫 / 空中飞踢） */
  knockDown(seconds = 1.2) {
    if (this.dead) return;
    if (!this.def.flying) {
      this.stun(seconds);
      return;
    }
    this.knockedDown = true;
    this.stunUntil = this.scene.time.now + seconds * 1000;
    this.body.setAllowGravity(true);
    this.body.setGravityY(AI.gravityY);
    this.body.setVelocityY(120);
    this.setTint(0xaad4ff);
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.body.enable = false;
    this.clearTint();
    this.setVelocity(0, 0);
    this.scene.events.emit('ai:kill', {
      type: this.typeKey,
      x: this.x,
      y: this.y,
      exp: this.def.exp || 0,
    });
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 12,
      duration: 260,
      onComplete: () => this.dispose(),
    });
  }

  dispose() {
    this.destroyed = true;
    if (this.flashEvent) this.flashEvent.remove(false);
    this.destroy();
  }

  /* ---------- 接触伤害 ---------- */
  updateContact() {
    if (this.dead || !this.player || this.player.isDead) return;
    if (this.touchCd > 0) return;
    if (!Phaser.Geom.Intersects.RectangleToRectangle(this.getBounds(), this.player.getBounds())) return;
    this.touchCd = AI.contactCooldown;
    this.onTouchPlayer(this.player);
  }

  onTouchPlayer(player) {
    const dmg = this.def.contactDamage;
    if (dmg > 0) {
      player.takeDamage(dmg, {
        fromX: this.x,
        knockback: 110,
        source: `monster:${this.typeKey}`,
      });
    }
  }
}

/* =====================================================================
 *  具体小怪实现
 * ===================================================================== */

/* 题海小纸精：贴地滑行 + 小跳冲撞，成群出现，血薄 */
class PaperSpirit extends MonsterFSM {
  constructor(scene, x, y) {
    super(scene, x, y, 'paperSpirit');
  }

  performAttack() {
    const dir = Math.sign(this.player.x - this.x) || this.facing;
    this.facing = dir;
    this.setFlipX(dir < 0);
    this.body.setVelocity(dir * this.def.leapVx, this.def.leapVy);
    this.activeTime = this.def.activeTime;
  }

  endAttack() {
    this.body.setVelocityX(0);
  }
}

/* 瞌睡浮游虫：悬浮空中，周期性喷减速泡泡；被吠叫会坠地 */
class SleepBug extends MonsterFSM {
  constructor(scene, x, y) {
    super(scene, x, y, 'sleepBug');
  }

  chase(dist, dt) {
    let dir = Math.sign(this.player.x - this.x) || this.facing;
    if (dist < 30) dir = -dir; // 保持距离，不贴脸
    this.facing = Math.sign(this.player.x - this.x) || this.facing;
    this.body.setVelocityX(dir * this.def.chaseSpeed);
    this.setFlipX(this.facing < 0);
    this.hover(dt);
  }

  performAttack() {
    const p = this.player;
    const ang = Phaser.Math.Angle.Between(this.x, this.y, p.x, p.y - 6);
    const spd = this.def.bubbleSpeed;
    this.scene.ai.bullets.spawn({
      x: this.x,
      y: this.y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      texture: 'bullet_bubble',
      damage: this.def.bubbleDamage,
      faction: 'enemy',
      life: 2.4,
      slow: { mult: 0.6, duration: 2 },
    });
    this.activeTime = 0.08;
    this.body.setVelocityX(0);
  }
}

/* 迟到巡查员：正面护甲 + 秒表冲锋；可踩头 */
class Inspector extends MonsterFSM {
  constructor(scene, x, y) {
    super(scene, x, y, 'inspector');
  }

  performAttack() {
    const dir = Math.sign(this.player.x - this.x) || this.facing;
    this.facing = dir;
    this.setFlipX(dir < 0);
    this.body.setVelocityX(dir * this.def.chargeSpeed);
    this.activeTime = this.def.chargeTime;
    this.scene.events.emit('ai:fx', {
      type: 'warning',
      x: this.x,
      y: this.y - 14,
      text: '冲锋!',
    });
  }

  endAttack() {
    this.body.setVelocityX(0);
  }

  onTouchPlayer(player) {
    // 踩头：玩家在下落且位于头顶
    if (player.body.velocity.y > 0 && player.body.bottom <= this.body.top + 10) {
      player.setVelocityY(-AI.airKickBounce);
      this.stun(1.5);
      this.takeDamage(10, { fromX: player.x });
      this.scene.events.emit('ai:fx', { type: 'stomp', x: this.x, y: this.y - 12 });
      return;
    }
    super.onTouchPlayer(player);
  }
}

/* 未读红点：靠近 1 秒自爆 */
class UnreadDot extends MonsterFSM {
  constructor(scene, x, y) {
    super(scene, x, y, 'unreadDot');
    this.fuseAt = 0;
    this.nextHop = 0;
  }

  behavior(time, dt) {
    if (this.dead) return;
    const p = this.player;

    if (this.fuseAt) {
      this.setVisible(Math.floor(time / 100) % 2 === 0);
      if (time >= this.fuseAt) this.explode();
      return;
    }

    if (p && !p.isDead) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
      const dir = Math.sign(p.x - this.x) || 1;
      this.facing = dir;
      this.body.setVelocityX(dir * this.def.chaseSpeed);
      this.setFlipX(dir < 0);

      if (this.body.blocked.down && time > this.nextHop) {
        this.body.setVelocityY(-110);
        this.nextHop = time + 900;
      }
      if (dist < this.def.fuseRange) {
        this.fuseAt = time + this.def.fuseTime * 1000;
        this.setTint(0xffe08a);
        this.scene.events.emit('ai:fx', {
          type: 'warning',
          x: this.x,
          y: this.y - 10,
          text: '自爆!',
        });
      }
    } else {
      this.patrol(dt);
    }
  }

  explode() {
    if (this.dead) return;
    const p = this.player;
    const radius = this.def.explodeRadius;
    this.scene.events.emit('ai:fx', { type: 'explode', x: this.x, y: this.y, radius });
    if (p && !p.isDead && Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y) <= radius) {
      p.takeDamage(this.def.explodeDamage, {
        fromX: this.x,
        knockback: 140,
        source: 'unreadDot',
      });
    }
    this.die();
  }

  /** 大黄狗【撞碎暴风】：无害引爆 */
  defuse() {
    if (this.dead) return;
    this.scene.events.emit('ai:fx', { type: 'explode', x: this.x, y: this.y, radius: this.def.explodeRadius });
    this.die();
  }
}

/* 无偿加班魂：接触持续吸取主角能量 */
class OvertimeGhost extends MonsterFSM {
  constructor(scene, x, y) {
    super(scene, x, y, 'overtimeGhost');
    this.drainFxAt = 0;
  }

  behavior(time, dt) {
    if (this.dead) return;
    const p = this.player;
    if (p && !p.isDead) {
      const dir = Math.sign(p.x - this.x) || this.facing;
      this.facing = dir;
      this.body.setVelocityX(dir * this.def.chaseSpeed);
      this.setFlipX(dir < 0);

      const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
      if (dist < this.def.drainRange) {
        p.mp = Math.max(0, p.mp - this.def.drainMpPerSec * dt);
        if (time > this.drainFxAt) {
          this.drainFxAt = time + 400;
          this.scene.events.emit('ai:fx', { type: 'drain', x: p.x, y: p.y - 10 });
        }
      }
    } else {
      this.patrol(dt);
    }
  }
}

/* 需求变更涡流：护盾吸收远程道具，需空中近战破盾 */
class RequirementVortex extends MonsterFSM {
  constructor(scene, x, y) {
    super(scene, x, y, 'requirementVortex');
    this.shieldActive = true;
    this.shieldRestoreAt = 0;
    this.setTint(0x9a6bff);
  }

  behavior(time, dt) {
    if (this.dead) return;
    this.hover(dt);

    const p = this.player;
    if (p && !p.isDead) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
      const dir = Math.sign(p.x - this.x) || this.facing;
      this.facing = dir;
      const vx = dist > 55 ? this.def.chaseSpeed : -this.def.chaseSpeed;
      this.body.setVelocityX(dir * vx);
      this.setFlipX(dir < 0);
    } else {
      this.body.setVelocityX(0);
    }

    if (!this.shieldActive && time >= this.shieldRestoreAt) {
      this.shieldActive = true;
      this.setTint(0x9a6bff);
      this.scene.events.emit('ai:fx', { type: 'shieldRestore', x: this.x, y: this.y });
    }
  }

  takeDamage(amount, opts = {}) {
    if (this.dead) return 0;

    if (this.shieldActive) {
      if (opts.isAir && opts.isMelee) {
        // 空中近战破盾
        this.shieldActive = false;
        this.shieldRestoreAt = this.scene.time.now + this.def.shieldBreakTime * 1000;
        this.clearTint();
        this.scene.events.emit('ai:fx', { type: 'shieldBreak', x: this.x, y: this.y });
        return super.takeDamage(amount * 1.5, opts);
      }
      this.scene.events.emit('ai:fx', { type: 'shield', x: this.x, y: this.y });
      return 0;
    }

    return super.takeDamage(amount, opts);
  }
}

/** 类型注册表：AIManager 通过 spawnMonster('paperSpirit') 取用 */
export const MonsterTypes = {
  paperSpirit: PaperSpirit,
  sleepBug: SleepBug,
  inspector: Inspector,
  unreadDot: UnreadDot,
  overtimeGhost: OvertimeGhost,
  requirementVortex: RequirementVortex,
};

export default MonsterFSM;
