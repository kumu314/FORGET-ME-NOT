/**
 * 飞行道具（成员C）
 *
 * 三种形态按阶段切换（设计文档 §4.2 / §5.5 / §5.6）：
 *  - 青年：粉笔头       —— 消耗 15 能量，直线快速穿刺
 *  - 中年：公文纸飞机   —— 消耗 20 能量，命中后爆裂产生小范围纸屑 AOE
 *  - 老年：金色记忆碎片 —— 消耗 10 能量，漫天追踪清场（这里先做直线 + 大判定，追踪交给后续版本）
 */

import Phaser from 'phaser';
import {
  getAnimationKey,
  hasReadyAnimation,
  PROJECTILE_ATLAS_ID,
  PROJECTILE_FRAME_SIZE,
} from '../scenes/spriteAtlases.js';

export const BULLET_PROFILES = Object.freeze({
  youth: Object.freeze({
    id: 'youth',
    label: '粉笔头',
    speed: 260,
    damage: 12,
    pierce: true, // 直线快速穿刺
    aoe: 0,
    tint: 0xf4f1e1,
    width: 6,
    height: 3,
    lifespanMs: 1200,
    atlasAnimation: 'chalk',
    homing: false,
  }),
  middle: Object.freeze({
    id: 'middle',
    label: '公文纸飞机',
    speed: 220,
    damage: 16,
    pierce: false,
    aoe: 28, // 命中爆裂半径（纸屑 AOE）
    tint: 0xd9dde3,
    width: 7,
    height: 4,
    lifespanMs: 1400,
    atlasAnimation: 'paper_plane',
    homing: false,
  }),
  elder: Object.freeze({
    id: 'elder',
    label: '金色记忆碎片',
    speed: 300,
    damage: 10,
    pierce: true,
    aoe: 16,
    tint: 0xffd76a,
    width: 8,
    height: 8,
    lifespanMs: 1600,
    atlasAnimation: 'memory',
    homing: true,
  }),
});

export default class ChalkBullet extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {import('phaser').Scene} scene
   * @param {{x:number,y:number,facing:number,phaseId?:string,owner?:object}} opts
   */
  constructor(scene, opts) {
    const phaseId = opts.phaseId ?? 'youth';
    const profile = BULLET_PROFILES[phaseId] ?? BULLET_PROFILES.youth;
    const hasAtlas = scene.textures.exists(PROJECTILE_ATLAS_ID);
    const textureKey = hasAtlas ? PROJECTILE_ATLAS_ID : ChalkBullet.ensureTexture(scene, profile);

    super(scene, opts.x, opts.y, textureKey, hasAtlas ? `${profile.atlasAnimation}_0` : undefined);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.profile = profile;
    this.owner = opts.owner ?? null;
    this.facing = opts.facing >= 0 ? 1 : -1;
    this.hitTargets = new Set(); // 穿刺弹避免对同一目标重复结算
    this.ageMs = 0;
    this.consumed = false;

    this.setOrigin(0.5, 0.5);
    this.body.setAllowGravity(false);
    this.body.setSize(profile.width, profile.height);
    if (hasAtlas) {
      this.body.setOffset(
        (PROJECTILE_FRAME_SIZE - profile.width) / 2,
        (PROJECTILE_FRAME_SIZE - profile.height) / 2,
      );
    }
    this.setDepth(50);
    if (hasAtlas) {
      this.clearTint();
      if (hasReadyAnimation(scene, PROJECTILE_ATLAS_ID, profile.atlasAnimation)) {
        this.play(getAnimationKey(PROJECTILE_ATLAS_ID, profile.atlasAnimation));
      } else {
        console.warn(
          `[ChalkBullet] ${PROJECTILE_ATLAS_ID}:${profile.atlasAnimation} missing; using first frame`,
        );
      }
    } else {
      console.warn(`[ChalkBullet] ${PROJECTILE_ATLAS_ID} atlas missing; using generated placeholder`);
      this.setTint(profile.tint);
    }
    this.setFlipX(this.facing < 0);
    this.setVelocity(this.facing * profile.speed, 0);
  }

  static ensureTexture(scene, profile) {
    const key = `memberC_bullet_${profile.id}`;
    if (!scene.textures.exists(key)) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      if (profile.id === 'middle') {
        // 纸飞机：三角形
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(profile.width, profile.height / 2);
        g.lineTo(0, profile.height);
        g.closePath();
        g.fillPath();
      } else {
        g.fillRect(0, 0, profile.width, profile.height);
      }
      g.generateTexture(key, profile.width, profile.height);
      g.destroy();
    }
    return key;
  }

  /** 每帧推进：出射程自动销毁，避免残留 */
  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this.ageMs += delta;
    if (this.profile.homing) this._trackNearestTarget();
    if (this.ageMs > this.profile.lifespanMs) this.destroy();
  }

  /** 老年记忆碎片：持续选择最近的活动目标，全屏追踪。 */
  _trackNearestTarget() {
    const targets = Array.isArray(this.scene?.targets) ? this.scene.targets : [];
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const target of targets) {
      if (!target?.active || !(target.hp > 0)) continue;
      const distance = Phaser.Math.Distance.Squared(this.x, this.y, target.x, target.y);
      if (distance < nearestDistance) {
        nearest = target;
        nearestDistance = distance;
      }
    }
    if (!nearest) return;

    const angle = Phaser.Math.Angle.Between(this.x, this.y, nearest.x, nearest.y);
    this.setVelocity(Math.cos(angle) * this.profile.speed, Math.sin(angle) * this.profile.speed);
    this.setFlipX(Math.cos(angle) < 0);
  }

  /** 命中目标后是否有 AOE */
  get aoeRadius() {
    return this.profile.aoe;
  }

  /**
   * 结算一次命中；返回伤害数值。
   * 穿刺弹可连续命中不同目标，非穿刺弹首次命中即销毁。
   */
  registerHit(target) {
    if (this.consumed) return 0;
    if (target && this.hitTargets.has(target)) return 0;
    if (target) this.hitTargets.add(target);
    if (!this.profile.pierce) this.consumed = true;
    return this.profile.damage;
  }
}
