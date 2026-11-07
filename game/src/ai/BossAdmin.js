import Phaser from 'phaser';
import BossBase from './BossBase.js';

/**
 * 第二关 Boss：黄金暴君·老板（成员D）
 *
 * 技能（动画键严格取自契约 boss_employer:*）：
 *  1. 画大饼   smoke → smoke   金色烟圈，命中减速 + 掉血
 *  2. 降本增效 stamp → slam    巨型公章砸地，地板冲击波（Space 起跳）
 *  3. 二阶段（HP<50%）：envelopes 裁员信风暴；大黄狗会主动拦截部分弹幕
 */
export class BossAdmin extends BossBase {
  constructor(scene, x, y, arena) {
    super(scene, x, y, 'employer', arena);
    this.nextLetterAt = 0;
  }

  skillAnim(id) {
    if (id === 'smoke') return 'smoke';
    if (id === 'stamp') return 'slam';
    return 'idle';
  }

  telegraphRect(id) {
    const p = this.player;
    if (id === 'smoke') {
      const w = Math.max(40, Math.abs(p.x - this.x));
      return { x: (this.x + p.x) / 2, y: this.y - 4, w, h: 40 };
    }
    if (id === 'stamp') {
      return { x: this.x, y: this.groundY - 6, w: 170, h: 26 };
    }
    return null;
  }

  doSkill(id) {
    const dmg = this.cfg.damage;

    if (id === 'smoke') {
      const sign = Math.sign(this.player.x - this.x) || 1;
      for (let i = 0; i < 3; i += 1) {
        this.scene.time.delayedCall(160 * i, () => {
          if (this.defeated || !this.active) return;
          this.scene.ai.bullets.spawn({
            x: this.x + sign * 20,
            y: this.y - 12,
            vx: sign * 55,
            vy: 0,
            texture: 'bullet_ring',
            damage: dmg.smoke,
            faction: 'enemy',
            life: 3.2,
            slow: { mult: 0.7, duration: 2 },
          });
        });
      }
      return;
    }

    if (id === 'stamp') {
      const gy = this.groundY - 5;
      for (const dir of [-1, 1]) {
        this.scene.ai.bullets.spawn({
          x: this.x + dir * 18,
          y: gy,
          vx: dir * 150,
          vy: 0,
          angle: dir < 0 ? 180 : 0,
          texture: 'bullet_shockwave',
          damage: dmg.stamp,
          faction: 'enemy',
          life: 2.2,
        });
      }
      this.scene.cameras.main.shake(240, 0.006);
      this.scene.events.emit('ai:fx', {
        type: 'slam',
        x: this.x,
        y: this.groundY,
        wide: 170,
      });
    }
  }

  /* 二阶段：裁员信风暴 */
  phase2Tick(time) {
    if (time >= this.nextBarrageAt) {
      this.nextBarrageAt = time + this.cfg.barrageInterval * 1000;
      this.letterRainActive = true;
      this.letterRainEndAt = time + this.cfg.letterRainDuration * 1000;
      this.scene.events.emit('ai:fx', { type: 'barrage', kind: 'letter' });

      // 风暴期间播放 envelopes，临时接管刷新中的 enraged
      this.animOverrideUntil = this.letterRainEndAt;
      this.setAnim('envelopes', true);
    }

    if (time >= this.letterRainEndAt) this.letterRainActive = false;

    if (this.letterRainActive && time >= this.nextLetterAt) {
      this.nextLetterAt = time + 320;
      this.spawnLetter();
      this.spawnLetter();
    }
  }

  spawnLetter() {
    const cam = this.scene.cameras.main;
    const x = Phaser.Math.Between(cam.scrollX + 12, cam.scrollX + cam.width - 12);
    this.scene.ai.bullets.spawn({
      x,
      y: cam.scrollY - 16,
      vx: 0,
      vy: 100,
      texture: 'bullet_letter',
      damage: this.cfg.damage.letter,
      faction: 'enemy',
      life: 4,
      angle: 0,
    });
  }
}

export default BossAdmin;
