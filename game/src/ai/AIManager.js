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
import { getStageSpawns, spawnPointFor } from './StageSpawns.js';

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
    this.stage = null;     // 当前关卡布阵（applyStage 写入）
    this.bossSpec = null;  // Boss 触发线，玩家推进到 triggerX 才开战
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
    this.checkStageTriggers();

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

  /* ---------- 关卡布阵接入（把 AI 真正接进关卡） ---------- */

  /**
   * 按关卡布阵刷怪，并继承忠犬。场景 create() 里调一次。
   * @param {'youth'|'middle'|'elder'} phaseId
   * @returns {Array} 本次刷出的小怪
   */
  applyStage(phaseId) {
    const stage = getStageSpawns(phaseId);
    this.stage = stage;

    const spawned = [];
    for (const spec of stage.monsters) {
      const { x, y } = spawnPointFor(spec, this.groundY);
      const m = this.spawnMonster(spec.type, x, y);
      if (m) spawned.push(m);
    }

    // 跨场景继承：第一关纸箱救出来后，二/三关自动换形态出场
    this.attachDogForLevel(stage.level);

    this.bossSpec = stage.boss;
    console.info(
      `[AI] ${phaseId} 布阵完成：小怪 ${spawned.length} 只，Boss=${stage.boss ? stage.boss.kind : '无'}`,
    );
    return spawned;
  }

  /** 玩家推进到 Boss 触发线才开战（每帧由 update 调用，只触发一次） */
  checkStageTriggers() {
    const spec = this.bossSpec;
    if (!spec || this.boss || this.player.isDead) return;
    if (this.player.x < spec.triggerX) return;

    this.spawnBoss(spec.kind, spec.x, null, spec.arena);
    this.scene.events.emit('ai:toast', {
      text: `${BOSS[spec.kind].displayName} 登场！`,
    });
  }

  /**
   * 彩蛋联动（场景触碰彩蛋时调用）。
   * 'puppy-box' → 写入 registry 并立刻出场，此后二/三关 attachDogForLevel 自动继承。
   * @param {string} id stageLayout.easterEggs[].id
   */
  onEasterEgg(id) {
    if (id !== 'puppy-box') return null;
    if (this.dog && this.dog.active) return this.dog;

    const level = this.stage?.level ?? 0;
    const form = DogCompanion.formForLevel(level);
    DogCompanion.unlock(this.scene, form);
    const dog = this.attachDog(form);

    this.scene.events.emit('ai:toast', {
      text: '忠犬·阿黄 加入：你按 J，它会扑上去咬住敌人 1 秒',
    });
    return dog;
  }

  /**
   * 玩家弹道命中结算（场景每帧对每颗子弹调一次）。
   *
   * 去重交给 ChalkBullet.registerHit：
   *  - 穿刺弹（粉笔 / 记忆碎片）对同一目标只结算一次，可继续穿下一个
   *  - 非穿刺弹（纸飞机）首次命中即 consumed，这里返回空数组后由场景销毁并结算 AOE
   *
   * @param {import('../entities/ChalkBullet.js').default} bullet
   * @returns {Array} 本次命中的目标（小怪 / Boss）
   */
  hitByProjectile(bullet) {
    const hits = [];
    if (!bullet || !bullet.active || bullet.consumed) return hits;

    const rect = bullet.getBounds();
    const opts = {
      fromProjectile: true,
      fromX: bullet.x,
      dir: Math.sign(bullet.facing) || 1,
    };

    for (const m of this.aliveMonsters()) {
      if (bullet.hitTargets?.has(m)) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, m.getBounds())) continue;
      const dmg = bullet.registerHit(m);
      if (dmg > 0) {
        m.takeDamage(dmg, opts);
        hits.push(m);
      }
    }

    const boss = this.activeBoss();
    if (
      boss
      && !bullet.hitTargets?.has(boss)
      && Phaser.Geom.Intersects.RectangleToRectangle(rect, boss.getBounds())
    ) {
      const dmg = bullet.registerHit(boss);
      if (dmg > 0) {
        boss.takeDamage(dmg, opts);
        hits.push(boss);
      }
    }

    return hits;
  }

  destroy() {
    this.bossSpec = null;
    this.stage = null;
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
