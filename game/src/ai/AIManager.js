import Phaser from 'phaser';
import {
  AI,
  BOSS,
  DOG,
  MONSTERS,
  PROJECTILE_PLACEHOLDERS,
} from '../config/aiConfig.js';
import { ProjectilePool } from './AIProjectiles.js';
import { MonsterTypes } from './MonsterFSM.js';
import DogCompanion from './DogCompanion.js';
import BossTeacher from './BossTeacher.js';
import BossAdmin from './BossAdmin.js';

/** Boss 类型注册表：spawnBoss('teacher' | 'employer') */
export const BossTypes = {
  teacher: BossTeacher,
  employer: BossAdmin,
};

/**
 * AI 架构整合层（成员D）
 *
 * 关卡场景接入方式（成员C / E）：
 *
 *   import AIManager from './ai/AIManager.js';
 *
 *   // Player 创建完成之后（scene.player / player.eventsHooks 已存在）
 *   this.ai = new AIManager(this, this.player, this.solids, { groundY: 240 });
 *   this.ai.spawnMonster('paperSpirit', 340, 200);
 *   this.ai.attachDogForLevel(0);            // 第一关救狗后二/三关自动继承
 *   this.ai.spawnBoss('teacher', 1200, 240, { left: 1080, right: 1500 });
 *
 *   // 场景 update 里每帧驱动
 *   this.ai.update(time, delta);
 *
 * AI 不 import C 的 Player，只依赖鸭子类型：
 *   player.isDead / x / y / facing / mp / maxMp / hp / maxHp / body / getBounds()
 *   player.takeDamage(dmg, { fromX, knockback, lift, source })
 *   player.setVelocityY(v) / player.eventsHooks.onMeleeHit | onRangedFire | onDamaged
 *
 * 事件（scene.events 上监听，供 E 做 HUD / 特效）：
 *   ai:damage          { x, y, amount, target, type?, kind? }
 *   ai:kill            { type, x, y, exp }
 *   ai:boss:spawn      { kind, name, hpMax }
 *   ai:boss:hp         { kind, hp, hpMax, phase }
 *   ai:boss:phase      { kind, phase }
 *   ai:boss:defeated   { kind }
 *   ai:fx              { type: 'warning'|'slam'|'barrage'|'explode'|..., ... }
 *   ai:toast           { text }
 *   ai:dog:unlock / ai:dog:form / ai:dog:heal / ai:dog:bite / ai:dog:bark / ai:dog:heart / ai:dog:fetch / ai:dog:intercept
 *
 * 玩家自己的投掷物仍由 C 的 ChalkBullet 负责；命中 AI 目标时调用
 *   ai.damageMonstersInRect(bullet.getBounds(), damage, { fromProjectile: true })
 * 或 ai.damageMonstersAt(x, y, aoeRadius, damage, { fromProjectile: true })。
 */
export class AIManager {
  constructor(scene, player, platforms, opts = {}) {
    this.scene = scene;
    this.player = player;
    this.platforms = platforms || null;
    this.groundY = opts.groundY ?? BOSS.teacher.groundY;

    this.monsters = [];
    this.boss = null;
    this.dog = null;
    this.bullets = new ProjectilePool(scene);
    this.seenDrops = new Set();
    this.exp = 0;
    this.lastPlayerDamageAt = 0;

    ensurePlaceholderTextures(scene);

    this.group = scene.physics.add.group();
    if (this.platforms) scene.physics.add.collider(this.group, this.platforms);

    scene.ai = this; // 供玩家 / 小怪 / 狗跨模块访问
    this.installPlayerHooks();

    this.onKillBound = (info) => this.onKill(info);
    scene.events.on('ai:kill', this.onKillBound, this);
  }

  /* ---------- 与成员C 的 Player 对接 ---------- */

  installPlayerHooks() {
    const hooks = this.player && this.player.eventsHooks;
    if (!hooks) {
      console.warn('[AI] Player 缺少 eventsHooks，AI 事件桥接未生效');
      return;
    }

    this.prevHooks = {
      onMeleeHit: hooks.onMeleeHit,
      onRangedFire: hooks.onRangedFire,
      onDamaged: hooks.onDamaged,
    };

    this.hookMeleeHit = (info) => {
      this.prevHooks.onMeleeHit?.(info);
      this.handleMelee(info);
    };
    this.hookRangedFire = (shot) => {
      this.prevHooks.onRangedFire?.(shot);
      this.dog?.onOwnerRanged(shot);
    };
    this.hookDamaged = (info) => {
      this.prevHooks.onDamaged?.(info);
      this.lastPlayerDamageAt = this.scene.time.now;
      if (info?.result?.blocked) this.dog?.onOwnerBlock(info);
    };

    hooks.onMeleeHit = this.hookMeleeHit;
    hooks.onRangedFire = this.hookRangedFire;
    hooks.onDamaged = this.hookDamaged;
  }

  restorePlayerHooks() {
    const hooks = this.player && this.player.eventsHooks;
    if (!hooks || !this.prevHooks) return;
    hooks.onMeleeHit = this.prevHooks.onMeleeHit;
    hooks.onRangedFire = this.prevHooks.onRangedFire;
    hooks.onDamaged = this.prevHooks.onDamaged;
  }

  /** C 的近战结算入口：box 为 Phaser.Geom.Rectangle，airKick 表示空中飞踢 */
  handleMelee(info) {
    if (!this.player || this.player.isDead || !info || !info.box) return [];

    const hits = this.damageMonstersInRect(info.box, info.damage, {
      isMelee: true,
      isAir: !!info.airKick,
      fromX: this.player.x,
      knockback: info.knockbackSmallEnemies ? 60 : 0,
      stunMs: info.appliesStun ? 220 : 0,
    });

    // 空中飞踢命中浮空小怪 → 借力弹跳（GDD 操作表）
    if (info.airKick && hits.some((h) => h.def && h.def.flying)) {
      this.player.setVelocityY(-AI.airKickBounce);
    }

    this.dog?.onOwnerMelee(info);
    return hits;
  }

  /* ---------- 刷怪 ---------- */

  spawnMonster(type, x, y) {
    const Cls = MonsterTypes[type];
    if (!Cls) {
      console.warn('[AI] 未知小怪类型:', type);
      return null;
    }
    const m = new Cls(this.scene, x, y);
    m.player = this.player;
    this.group.add(m);
    this.monsters.push(m);
    this.scene.events.emit('ai:monster:spawn', { type, x, y });
    return m;
  }

  spawnBoss(kind, x, y, arena) {
    const Cls = BossTypes[kind];
    if (!Cls) {
      console.warn('[AI] 未知 Boss 类型:', kind);
      return null;
    }
    if (this.boss && !this.boss.defeated) return this.boss;

    this.boss = new Cls(this.scene, x, y ?? this.groundY, {
      groundY: this.groundY,
      ...(arena || {}),
    });
    if (this.platforms) this.scene.physics.add.collider(this.boss, this.platforms);
    return this.boss;
  }

  attachDog(form) {
    if (this.dog && this.dog.active) return this.dog;
    const initial = form || DogCompanion.savedForm(this.scene) || 'puppy';
    this.dog = new DogCompanion(this.scene, this.player, initial);
    console.info('[AI] 忠犬出场，形态 =', this.dog.form);
    return this.dog;
  }

  /**
   * 跨场景忠犬继承（GDD 7.2）
   * 第一关救出小狗后写入 registry，第二/三关直接调用本方法即可自动出现并切换形态。
   * @param {number} level 0=青年 1=中年 2=老年
   */
  attachDogForLevel(level) {
    const unlocked = DogCompanion.isUnlocked(this.scene);
    console.info('[AI] 跨场景继承检查：level =', level, '，已解锁 =', unlocked);
    if (!unlocked) return null;
    return this.attachDog(DogCompanion.formForLevel(level));
  }

  /* ---------- 查询 ---------- */

  aliveMonsters() {
    return this.monsters.filter((m) => !m.dead && m.active && !m.destroyed);
  }

  activeBoss() {
    return this.boss && this.boss.active && !this.boss.defeated ? this.boss : null;
  }

  nearestMonster(x, y, range, filter) {
    let best = null;
    let bestDist = range;
    for (const m of this.aliveMonsters()) {
      if (filter && !filter(m)) continue;
      const d = Phaser.Math.Distance.Between(x, y, m.x, m.y);
      if (d <= bestDist) {
        bestDist = d;
        best = m;
      }
    }
    return best;
  }

  /* ---------- 伤害结算（供 C 的弹道 / 场景调用） ---------- */

  /**
   * 矩形范围伤害（近战框、直线弹道、扇形近似）
   * @param {Phaser.Geom.Rectangle} rect
   * @param {number} damage
   * @param {{isMelee?:boolean,isAir?:boolean,fromProjectile?:boolean,fromX?:number,knockback?:number,stunMs?:number}} opts
   */
  damageMonstersInRect(rect, damage, opts = {}) {
    const hits = [];
    const fromX = opts.fromX ?? this.player.x;

    for (const m of this.aliveMonsters()) {
      if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, m.getBounds())) continue;
      m.takeDamage(damage, {
        ...opts,
        fromX,
        dir: Math.sign(m.x - fromX) || 1,
      });
      hits.push(m);
    }

    const boss = this.activeBoss();
    if (boss && Phaser.Geom.Intersects.RectangleToRectangle(rect, boss.getBounds())) {
      boss.takeDamage(damage, opts);
      hits.push(boss);
    }
    return hits;
  }

  /** 圆形范围伤害（纸飞机爆裂 / 词典 AOE 等） */
  damageMonstersAt(x, y, radius, damage, opts = {}) {
    const hits = [];
    const fromX = opts.fromX ?? x;

    for (const m of this.aliveMonsters()) {
      if (Phaser.Math.Distance.Between(x, y, m.x, m.y) > radius + m.displayWidth / 2) continue;
      m.takeDamage(damage, {
        ...opts,
        fromX,
        dir: Math.sign(m.x - fromX) || 1,
      });
      hits.push(m);
    }

    const boss = this.activeBoss();
    if (boss && Phaser.Math.Distance.Between(x, y, boss.x, boss.y) <= radius + boss.displayWidth / 2) {
      boss.takeDamage(damage, opts);
      hits.push(boss);
    }
    return hits;
  }

  /* ---------- 击杀：经验 + 被动掉落 + 感悟光球 ---------- */

  onKill(info) {
    this.exp += info.exp || 0;

    const def = MONSTERS[info.type];
    if (def && def.drop) {
      const firstKill = !this.seenDrops.has(info.type);
      if (firstKill || Math.random() < def.drop.chance) {
        this.seenDrops.add(info.type);
        this.scene.events.emit('ai:skill:drop', { name: def.drop.name, type: info.type });
        this.scene.events.emit('ai:toast', { text: `获得被动【${def.drop.name}】` });
      }
    }

    this.spawnOrb(info.x, info.y);
  }

  spawnOrb(x, y) {
    if (!this.scene.textures.exists('ai_orb')) return;
    const orb = this.scene.add.image(x, y, 'ai_orb').setDepth(6);
    this.scene.tweens.add({
      targets: orb,
      y: y - 16,
      duration: 260,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        if (!orb.active) return;
        this.scene.tweens.add({
          targets: orb,
          x: this.player.x,
          y: this.player.y,
          duration: 420,
          onComplete: () => orb.destroy(),
        });
      },
    });
  }

  /* ---------- 每帧驱动 ---------- */

  update(time, delta) {
    this.bullets.update(time, delta);

    for (const m of this.monsters) {
      if (!m.dead && m.active && !m.destroyed) m.update(time, delta);
    }
    if (this.monsters.some((m) => m.destroyed)) {
      this.monsters = this.monsters.filter((m) => !m.destroyed);
    }

    const boss = this.activeBoss();
    if (boss) boss.update(time, delta);
    if (this.dog && this.dog.active) this.dog.update(time, delta);
  }

  destroy() {
    this.restorePlayerHooks();
    this.scene.events.off('ai:kill', this.onKillBound, this);
    this.bullets.clearAll();

    for (const m of this.monsters) {
      if (m.active) m.destroy();
    }
    this.monsters = [];
    if (this.boss && this.boss.active) this.boss.destroy();
    this.boss = null;
    if (this.dog && this.dog.active) this.dog.destroy();
    this.dog = null;

    if (this.scene.ai === this) this.scene.ai = null;
  }
}

/* =====================================================================
 *  占位纹理：A 的正式资源到位前保证 AI 可独立运行
 *  正式资源只要使用同名纹理键加载，这里会自动跳过生成。
 * ===================================================================== */

const DOG_PLACEHOLDER_COLORS = {
  dog_puppy: 0xd9a441,
  dog_adult: 0xc98b2f,
  dog_elder: 0xb8a98a,
};

function makeTexture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  draw(g, w, h);
  g.generateTexture(key, w, h);
  g.destroy();
}

function drawCreature(g, w, h, color) {
  g.fillStyle(color, 1).fillRect(0, 0, w, h);
  g.lineStyle(1, 0x1b1b25, 1).strokeRect(0.5, 0.5, w - 1, h - 1);
  g.fillStyle(0x1b1b25, 1);
  const eyeX = Math.max(1, Math.floor(w * 0.25));
  const eyeY = Math.max(1, Math.floor(h * 0.35));
  g.fillRect(eyeX, eyeY, 1, 1);
  g.fillRect(Math.max(eyeX + 2, w - eyeX - 1), eyeY, 1, 1);
}

function ensurePlaceholderTextures(scene) {
  // 小怪
  for (const def of Object.values(MONSTERS)) {
    const p = def.placeholder;
    makeTexture(scene, def.texture, p.w, p.h, (g, w, h) => drawCreature(g, w, h, p.color));
  }

  // 忠犬（A 的 dog_* 图集未加载时）
  for (const [key, def] of Object.entries(DOG.forms)) {
    const sizes = { dog_puppy: { w: 12, h: 12 }, dog_adult: { w: 20, h: 16 }, dog_elder: { w: 20, h: 16 } };
    const s = sizes[def.texture] || { w: 16, h: 12 };
    makeTexture(scene, def.texture, s.w, s.h, (g, w, h) =>
      drawCreature(g, w, h, DOG_PLACEHOLDER_COLORS[def.texture] || 0xd9a441),
    );
  }

  // Boss（A 的 boss_* 图集未加载时）
  for (const def of Object.values(BOSS)) {
    const p = def.placeholder;
    makeTexture(scene, def.texture, p.w, p.h, (g, w, h) => {
      g.fillStyle(p.color, 1).fillRect(0, 0, w, h);
      g.lineStyle(2, 0x1b1b25, 1).strokeRect(1, 1, w - 2, h - 2);
      g.fillStyle(0x1b1b25, 1).fillRect(Math.floor(w * 0.3), Math.floor(h * 0.28), 4, 4);
      g.fillRect(Math.floor(w * 0.62), Math.floor(h * 0.28), 4, 4);
    });
  }

  // 弹道 / 光球
  for (const [key, p] of Object.entries(PROJECTILE_PLACEHOLDERS)) {
    makeTexture(scene, key, p.w, p.h, (g, w, h) => {
      if (p.shape === 'circle') {
        g.fillStyle(p.color, 1).fillCircle(w / 2, h / 2, Math.min(w, h) / 2);
      } else {
        g.fillStyle(p.color, 1).fillRect(0, 0, w, h);
      }
    });
  }
}

export default AIManager;
