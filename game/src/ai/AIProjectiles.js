import Phaser from 'phaser';

/**
 * 敌方弹幕对象池（成员D）
 *
 * 统一管理 Boss / 小怪发射的飞行道具，手动 AABB 判定，
 * 避免每帧创建销毁对象（GDD 性能要求）。
 *
 * 玩家自己的投掷物由成员C 的 ChalkBullet 负责；D 只对外提供
 * AIManager.damageMonstersAt / damageMonstersInRect 供其接入伤害结算。
 *
 * spawn 参数：
 *  { x, y, vx, vy, texture, damage, life,
 *    gravity, slow:{mult,duration}, aoeRadius, targetY, pierce, angle, spin }
 */
/**
 * 占位弹道的视觉放大表（issue #87）：占用纹理只有 6~12px，在雨夜等复杂背景上
 * 几乎不可见（玩家反馈「看不到攻击方式、莫名奇妙掉血」）。按纹理给默认放大倍数，
 * 碰撞走 getBounds、与视觉同比例，所见即所中。调用方仍可用 cfg.scale 覆盖。
 */
const VISUAL_SCALE = Object.freeze({
  bullet_ring: 2.4,       // 老板·画大饼：金色烟圈
  bullet_shockwave: 2.5,  // 老师横扫 / 老板盖章：贴地冲击波
  bullet_letter: 1.9,     // 老板二阶段：裁员信
  bullet_chalk_boss: 2.4, // 老师狙击：粉笔
  bullet_dictionary: 1.8, // 老师抽查：词典
  bullet_paper: 1.8,      // 老师二阶段：试卷
  bullet_bubble: 1.7,     // 瞌睡虫泡泡
});

export class ProjectilePool {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
  }

  spawn(cfg) {
    const scene = this.scene;
    if (!scene.textures.exists(cfg.texture)) {
      console.warn('[AI] 弹道纹理不存在:', cfg.texture);
      return null;
    }

    let b = this.pool.find((o) => o && !o.active);
    if (!b) {
      b = scene.add.sprite(cfg.x, cfg.y, cfg.texture);
      b.setDepth(6);
      this.pool.push(b);
    }
    // issue #93：可选动画键（如 'projectiles:chalk'）。池复用时先停旧动画，
    // 无动画的 spawn 必须回退静态纹理，避免继承上一发子弹的动画帧。
    const hasAnim = Boolean(cfg.anim && scene.anims.exists(cfg.anim));
    if (hasAnim) {
      b.play(cfg.anim);
    } else {
      b.anims.stop();
      b.setTexture(cfg.texture);
    }
    b.setPosition(cfg.x, cfg.y);
    b.setActive(true);
    b.setVisible(true);
    b.setAlpha(1);
    // 可读性（issue #95）：占位弹道只有 6~12px，按纹理默认放大；
    // 已上真动画（#93/#94，如粉笔 16×16）path 保持原生尺寸，只放大占位兜底。
    b.setScale(cfg.scale ?? (hasAnim ? 1 : (VISUAL_SCALE[cfg.texture] ?? 1)));
    b.clearTint();
    b.setAngle(hasAnim ? 0 : (cfg.angle || 0));

    b.vx = cfg.vx || 0;
    b.vy = cfg.vy || 0;
    b.gravity = cfg.gravity || 0;
    b.life = cfg.life !== undefined ? cfg.life : 1.5;
    b.damage = cfg.damage || 0;
    b.faction = cfg.faction || 'enemy';
    b.slow = cfg.slow || null;
    b.source = cfg.source || 'projectile';
    b.aoeRadius = cfg.aoeRadius || 0;
    b.targetY = cfg.targetY !== undefined ? cfg.targetY : null;
    b.pierce = cfg.pierce || 0;
    b.hitPlayer = false;
    b.spin = cfg.spin || 0;
    return b;
  }

  release(b) {
    if (!b || !b.scene) return; // 场景已销毁时直接跳过
    b.setActive(false);
    b.setVisible(false);
    b.clearTint();
  }

  ofFaction(faction) {
    return this.pool.filter((b) => b.active && b.faction === faction);
  }

  clearAll() {
    this.pool.forEach((b) => {
      if (b && b.active) this.release(b);
    });
    this.pool = [];
  }

  update(time, delta) {
    const dt = Math.min(delta, 40) / 1000;
    const player = this.scene.ai ? this.scene.ai.player : this.scene.player;
    const bounds = this.scene.physics.world.bounds;

    for (const b of this.pool) {
      if (!b.active) continue;

      b.life -= dt;
      b.vy += b.gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.spin) b.angle += b.spin * dt;

      // 落地 / 到点爆炸（如词典砸下）
      if (b.aoeRadius > 0 && b.targetY !== null && b.y >= b.targetY) {
        this.explode(b);
        continue;
      }
      if (
        b.life <= 0 ||
        b.x < bounds.x - 60 ||
        b.x > bounds.right + 60 ||
        b.y < bounds.y - 120 ||
        b.y > bounds.bottom + 80
      ) {
        this.release(b);
        continue;
      }

      if (b.faction === 'enemy') this.checkPlayerHit(b, player);
    }
  }

  /* 敌方弹幕 → 玩家 */
  checkPlayerHit(b, player) {
    if (!player || player.isDead || b.hitPlayer) return;
    if (!Phaser.Geom.Intersects.RectangleToRectangle(b.getBounds(), player.getBounds())) return;
    b.hitPlayer = true;

    player.takeDamage(b.damage, {
      fromX: b.x,
      knockback: 100,
      source: b.source,
    });
    // C 的 Player 目前没有 applySlow；接口补上后这里自动生效
    if (b.slow && typeof player.applySlow === 'function') {
      player.applySlow(b.slow.mult, b.slow.duration);
    }
    if (!b.pierce) this.release(b);
  }

  explode(b) {
    const player = this.scene.ai ? this.scene.ai.player : this.scene.player;
    if (
      player &&
      !player.isDead &&
      Phaser.Math.Distance.Between(b.x, b.y, player.x, player.y) <= b.aoeRadius
    ) {
      player.takeDamage(b.damage, {
        fromX: b.x,
        knockback: 140,
        source: 'aoe',
      });
    }

    const fx = this.scene.add.circle(b.x, b.y, b.aoeRadius, 0xffe0a0, 0.35).setDepth(7);
    this.scene.tweens.add({
      targets: fx,
      alpha: 0,
      scale: 1.2,
      duration: 240,
      onComplete: () => fx.destroy(),
    });
    this.release(b);
  }
}

export default ProjectilePool;
