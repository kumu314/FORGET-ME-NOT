import Phaser from 'phaser';
import { AI, DOG, DOG_FORM_BY_LEVEL, REGISTRY_KEYS } from '../config/aiConfig.js';
import { playAnim } from './anim.js';

/**
 * 随从忠犬 AI（成员D · GDD 7.2）
 *
 * · 幽灵跟随：targetX = player.x - player.facing * followOffset，不做地形寻路
 * · 跨场景持久化：第一关救出后写入 registry，二/三关自动继承并切换形态
 * · 跟玩家操作联动（由 AIManager 从 C 的 eventsHooks 转发）：
 *     J 近战           → 飞扑咬住最近小怪 1 秒（定身）
 *     Space+J 空中飞踢 → 地面吠叫声波，震落低空浮游虫
 *     L 远程           → 中年大黄狗捡回纸屑，返还 5 点能量
 *     S 格挡成功       → 头顶冒爱心回能；中年额外驱散最近的红点
 * · 治愈光环：脱战 3 秒后每 10 秒回一次血
 * · 无敌判定：小狗不参与伤害结算，永远打不死
 *
 * 动画键：dog_puppy:run / dog_adult:pounce / dog_elder:walk …（见动画契约）
 */
export class DogCompanion extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, player, form) {
    const initialForm = form || DogCompanion.savedForm(scene) || 'puppy';
    const def = DOG.forms[initialForm];
    super(scene, player.x - def.followOffset, player.y - def.body.h, def.texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.player = player;
    this.ai = scene.ai;
    this.form = initialForm;
    this.def = def;
    this.body.setSize(def.body.w, def.body.h);
    this.body.setOffset((this.width - def.body.w) / 2, this.height - def.body.h);
    this.body.setAllowGravity(false);
    this.setDepth(16);
    this.setCollideWorldBounds(true);

    this.lunging = false;
    this.animLock = false;
    this.currentAction = 'idle';
    this.pounceCd = 0;
    this.barkCd = 0;
    this.fetchCd = 0;
    this.interceptCd = 0;
    this.nextHealAt = scene.time.now + def.healInterval * 1000;

    scene.game.registry.set(REGISTRY_KEYS.dogUnlocked, true);
    scene.game.registry.set(REGISTRY_KEYS.dogForm, initialForm);

    this.setAction('idle');
    scene.events.emit('ai:dog:unlock', { form: initialForm });
  }

  /* ---------- 跨场景持久化（静态 API，关卡场景直接调用） ---------- */

  /** 存档里是否已救出小狗 */
  static isUnlocked(scene) {
    return !!scene.game.registry.get(REGISTRY_KEYS.dogUnlocked);
  }

  /** 关卡编号（0/1/2）→ 对应形态 */
  static formForLevel(level) {
    return DOG_FORM_BY_LEVEL[level] || DOG_FORM_BY_LEVEL[0];
  }

  /** 读取存档里的形态 */
  static savedForm(scene) {
    return scene.game.registry.get(REGISTRY_KEYS.dogForm) || null;
  }

  /** 救出小狗（第一关纸箱处调用一次，之后各关自动继承） */
  static unlock(scene, form = 'puppy') {
    scene.game.registry.set(REGISTRY_KEYS.dogUnlocked, true);
    scene.game.registry.set(REGISTRY_KEYS.dogForm, form);
  }

  /* ---------- 每帧 ---------- */

  update(time, delta) {
    this.updateFollow(delta);
    this.guardExplosives();
    this.updateHealAura(time);
    this.updateIntercept(time);
  }

  updateFollow(delta) {
    const p = this.player;
    if (this.lunging) return;

    const targetX = p.x - p.facing * (this.def.followOffset || 12);
    const dx = targetX - this.x;
    const speed = Phaser.Math.Clamp(
      dx * 6,
      -(this.def.maxSpeed || 120),
      this.def.maxSpeed || 120,
    );
    this.body.setVelocityX(speed);
    this.setFlipX(p.facing < 0);

    // 幽灵式垂直吸附：不参与地形碰撞，避免卡平台
    const footY = p.y - (this.displayHeight - this.displayOriginY);
    this.y = Phaser.Math.Linear(this.y, footY, Math.min(1, (delta / 1000) * 12));

    if (Math.abs(dx) > 220) {
      this.setPosition(targetX, footY);
      this.body.setVelocityX(0);
    }

    if (!this.animLock) {
      const moving = Math.abs(dx) > 2;
      const runAction = this.form === 'elder' ? 'walk' : 'run';
      this.setAction(moving ? runAction : 'idle');
    }
  }

  setAction(action, force = false) {
    if (!force && this.currentAction === action) return;
    this.currentAction = action;
    playAnim(this, this.def.texture, action);
  }

  /* ---------- 与玩家操作联动（AIManager 转发） ---------- */

  /** J 近战：飞扑咬住最近小怪 */
  onOwnerMelee(info) {
    if (info?.airKick) this.bark();
    else this.pounce();
  }

  pounce() {
    const now = this.scene.time.now;
    if (now < this.pounceCd) return;
    const target = this.ai.nearestMonster(this.x, this.y, this.def.biteRange);
    if (!target) return;

    this.pounceCd = now + 700;
    this.lunging = true;
    this.animLock = true;
    this.setAction('pounce', true);

    const sign = Math.sign(target.x - this.x) || 1;
    this.scene.tweens.add({
      targets: this,
      x: target.x - sign * 6,
      y: target.y - 2,
      duration: 140,
      yoyo: true,
      onComplete: () => {
        this.lunging = false;
        this.animLock = false;
        this.setAction('idle', true);
      },
    });

    target.stun(this.def.biteStun);
    this.scene.time.delayedCall(120, () => {
      if (this.active) this.setAction('bite', true);
    });
    this.scene.events.emit('ai:dog:bark', { x: this.x, y: this.y - 6 });
    this.scene.events.emit('ai:dog:bite', { x: target.x, y: target.y - 8 });
  }

  /** Space+J：地面吠叫声波，震落低空浮游虫 */
  bark() {
    const now = this.scene.time.now;
    if (now < this.barkCd) return;
    this.barkCd = now + 350;

    this.setAction('bark', true);
    this.scene.time.delayedCall(320, () => {
      if (this.active && !this.animLock) this.setAction('idle', true);
    });

    let count = 0;
    for (const m of this.ai.aliveMonsters()) {
      if (!m.def.flying) continue;
      if (Phaser.Math.Distance.Between(this.x, this.y, m.x, m.y) > this.def.barkRange) continue;
      m.knockDown(1.2);
      count += 1;
    }
    this.scene.events.emit('ai:dog:bark', { x: this.x, y: this.y - 6, count });
  }

  /** 格挡成功：回能 + 爱心；中年大黄狗额外驱散最近红点 */
  onOwnerBlock(info) {
    this.gainMp(this.def.blockMp || 0);
    this.scene.events.emit('ai:dog:heart', {
      x: this.x,
      y: this.y - 10,
      perfect: !!info?.result?.perfect,
    });

    if (this.form !== 'adult' || !this.def.guardRange) return;
    const target = this.ai.nearestMonster(this.x, this.y, this.def.guardRange, (m) => m.typeKey === 'unreadDot');
    if (target && target.defuse) {
      target.defuse();
      this.scene.events.emit('ai:dog:intercept', { x: target.x, y: target.y });
    }
  }

  /** 远程投掷：中年大黄狗捡回纸屑返还能量 */
  onOwnerRanged() {
    if (this.form !== 'adult' || !this.def.fetchMp) return;
    const now = this.scene.time.now;
    if (now < this.fetchCd) return;
    this.fetchCd = now + 1000;

    this.gainMp(this.def.fetchMp);
    this.scene.events.emit('ai:dog:fetch', {
      x: this.x,
      y: this.y - 6,
      amount: this.def.fetchMp,
    });
  }

  gainMp(amount) {
    if (!amount) return;
    const p = this.player;
    p.mp = Math.min(p.maxMp, p.mp + amount);
  }

  /* ---------- 光环 & 弹幕拦截 ---------- */

  /** 成年狗主动清除包围主角的红点和接近的公章冲击波。沿用既有guardRange。 */
  guardExplosives(stamp = false) {
    if (this.form !== 'adult' || this.player.isDead || !this.def.guardRange) return;
    const p = this.player;
    const nearby = (target) => Phaser.Math.Distance.Between(p.x, p.y, target.x, target.y) <= this.def.guardRange;
    const dots = this.ai.aliveMonsters().filter((m) => m.typeKey === 'unreadDot' && nearby(m));
    const waves = this.ai.bullets.ofFaction('enemy').filter((b) => b.source === 'shockwave' && nearby(b));
    if (!stamp && dots.length < 2 && !waves.length) return;
    if (!dots.length && !waves.length) return;
    for (const dot of dots) dot.defuse();
    for (const wave of waves) this.ai.bullets.release(wave);
    this.setAction('bark', true);
    this.scene.events.emit('ai:dog:bark', { x: this.x, y: this.y - 6 });
    this.scene.events.emit('ai:dog:intercept', { x: p.x, y: p.y });
  }

  updateHealAura(time) {
    const p = this.player;
    if (p.isDead) return;
    if (time - (this.ai.lastPlayerDamageAt || 0) < 3000) return; // 未脱战
    if (!p.isGrounded || Math.abs(p.body.velocity.x) >= 1 || p._inRecovery || p.rangedActionMs > 0) return;
    if (this.ai.activeBoss() || this.ai.aliveMonsters().some((m) =>
      Phaser.Math.Distance.Between(p.x, p.y, m.x, m.y) < AI.detectRange)) return;
    if (time < this.nextHealAt) return;

    this.nextHealAt = time + this.def.healInterval * 1000;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + this.def.healAmount);
    if (p.hp > before) {
      this.scene.events.emit('ai:dog:heal', {
        x: this.x,
        y: this.y - 10,
        amount: p.hp - before,
      });
    }
  }

  /** 老板二阶段【裁员信风暴】时，大黄狗主动拦截部分弹幕 */
  updateIntercept(time) {
    const boss = this.ai.boss;
    if (!boss || !boss.letterRainActive) return;
    if (time < this.interceptCd) return;

    for (const b of this.ai.bullets.ofFaction('enemy')) {
      if (Phaser.Math.Distance.Between(this.x, this.y, b.x, b.y) > 75) continue;
      this.interceptCd = time + 600;
      this.ai.bullets.release(b);
      this.scene.events.emit('ai:dog:intercept', { x: b.x, y: b.y });
      break;
    }
  }

  /* ---------- 形态切换 ---------- */

  setForm(form) {
    const def = DOG.forms[form];
    if (!def) return;
    this.form = form;
    this.def = def;
    this.setTexture(def.texture);
    this.body.setSize(def.body.w, def.body.h);
    this.body.setOffset((this.width - def.body.w) / 2, this.height - def.body.h);
    this.scene.game.registry.set(REGISTRY_KEYS.dogForm, form);
    this.setAction('idle', true);
    this.scene.events.emit('ai:dog:form', { form });
  }
}

export default DogCompanion;
