import Phaser from 'phaser';
import { XP_SYSTEM } from '../config/gameConfig.js';

/**
 * 感悟光球（issue #17，GDD §3.1【领悟】）
 *
 * 击杀怪物掉落；平时原地浮动，玩家进入吸附半径后以加速度被磁吸，
 * 进入吸收距离即结算经验。世界重力为 0，运动完全自持。
 */
export default class ExpOrb extends Phaser.GameObjects.Image {
  /**
   * @param {import('phaser').Scene} scene
   * @param {{x:number, y:number, exp:number}} spec
   * @param {{x:number, y:number}} playerPosRef 玩家引用（读实时坐标）
   * @param {(orb: ExpOrb) => void} onAbsorb 入账回调
   */
  constructor(scene, spec, playerPosRef, onAbsorb) {
    super(scene, spec.x, spec.y, ExpOrb.ensureTexture(scene));
    scene.add.existing(this);
    this.setDepth(7);

    this.exp = Math.max(1, Math.round(spec.exp));
    this.playerRef = playerPosRef;
    this.onAbsorb = onAbsorb;
    this.vx = Phaser.Math.Between(-20, 20); // 掉落瞬间的自然散开
    this.vy = Phaser.Math.Between(-30, -10);
    this.magnetized = false;
    this.ageMs = 0;

    // 浮动呼吸：磁吸开始后停掉，避免干扰轨迹
    this.bobTween = scene.tweens.add({
      targets: this,
      y: spec.y - 3,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  /** 光球贴图：AIManager 已生成 ai_orb 占位则复用，否则自造一颗暖金光点 */
  static ensureTexture(scene) {
    if (scene.textures.exists('ai_orb')) return 'ai_orb';
    if (!scene.textures.exists('xp_orb')) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffe08a, 1).fillCircle(3, 3, 3);
      g.fillStyle(0xfff6c9, 1).fillCircle(3, 3, 1.5);
      g.generateTexture('xp_orb', 6, 6);
      g.destroy();
    }
    return 'xp_orb';
  }

  /**
   * 每帧推进：磁吸 + 吸收。返回 true 表示已被吸收（由管理器回收）。
   * @param {number} deltaMs
   */
  update(deltaMs) {
    if (!this.active) return false;
    this.ageMs += deltaMs;
    const dt = Math.min(deltaMs, 50) / 1000;
    const dx = this.playerRef.x - this.x;
    const dy = this.playerRef.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= XP_SYSTEM.pickupRadius) {
      this.onAbsorb?.(this);
      this.destroy();
      return true;
    }

    if (dist <= XP_SYSTEM.magnetRadius) {
      if (!this.magnetized) {
        this.magnetized = true;
        this.bobTween?.stop();
      }
      // 朝玩家方向加速，封顶 magnetSpeed：干脆但不瞬移
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      this.vx += nx * XP_SYSTEM.magnetAccel * dt;
      this.vy += ny * XP_SYSTEM.magnetAccel * dt;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > XP_SYSTEM.magnetSpeed) {
        this.vx = (this.vx / speed) * XP_SYSTEM.magnetSpeed;
        this.vy = (this.vy / speed) * XP_SYSTEM.magnetSpeed;
      }
    } else {
      // 出圈（玩家跑开）：阻尼回落，慢慢停下来继续浮动
      this.vx *= 1 - 2.2 * dt;
      this.vy *= 1 - 2.2 * dt;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    return false;
  }

  destroy(fromScene) {
    this.bobTween?.stop();
    this.bobTween = null;
    super.destroy(fromScene);
  }
}
