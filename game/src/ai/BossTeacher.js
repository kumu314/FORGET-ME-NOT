import Phaser from 'phaser';
import BossBase from './BossBase.js';

/**
 * 第一关 Boss：巨影班主任——无尽的倒计时（成员D）
 *
 * 技能（动画键严格取自契约 boss_teacher:*）：
 *  1. 教鞭横扫 sweep      → sweep      贴地粉笔冲击波，Space 起跳躲避
 *  2. 粉笔狙击 snipe      → throw_chalk 三连高速粉笔，S 格挡
 *  3. 突击抽查 audit      → summon     脚下红框预警后词典砸落
 *  4. 二阶段（HP<50%）：试卷羽翼全屏弹幕，前三招冷却缩短
 */
export class BossTeacher extends BossBase {
  constructor(scene, x, y, arena) {
    super(scene, x, y, 'teacher', arena);
  }

  skillAnim(id) {
    if (id === 'sweep') return 'sweep';
    if (id === 'snipe') return 'throw_chalk';
    if (id === 'audit') return 'summon';
    return 'idle';
  }

  /* 各招式的红色预警框 */
  telegraphRect(id) {
    const p = this.player;
    if (id === 'sweep') {
      return { x: this.x, y: this.groundY - 8, w: 160, h: 28 };
    }
    if (id === 'snipe') {
      const w = Math.max(40, Math.abs(p.x - this.x));
      return { x: (this.x + p.x) / 2, y: p.y - 2, w, h: 8 };
    }
    if (id === 'audit') {
      return { x: p.x, y: this.groundY - 16, w: 48, h: 28 };
    }
    return null;
  }

  doSkill(id, time) {
    const dmg = this.cfg.damage;

    if (id === 'sweep') {
      const gy = this.groundY - 5;
      for (const dir of [-1, 1]) {
        this.scene.ai.bullets.spawn({
          x: this.x + dir * 14,
          y: gy,
          vx: dir * 130,
          vy: 0,
          angle: dir < 0 ? 180 : 0,
          texture: 'bullet_shockwave',
          damage: dmg.sweep,
          faction: 'enemy',
          life: 2.2,
        });
      }
      this.scene.cameras.main.shake(180, 0.004);
      this.scene.events.emit('ai:fx', {
        type: 'slam',
        x: this.x,
        y: this.groundY,
        wide: 160,
      });
      return;
    }

    if (id === 'snipe') {
      const tx = this.player.x;
      const ty = this.player.y - 4;
      for (let i = 0; i < 3; i += 1) {
        this.scene.time.delayedCall(120 * i, () => {
          if (this.defeated || !this.active) return;
          const ang = Phaser.Math.Angle.Between(this.x, this.y - 10, tx, ty);
          this.scene.ai.bullets.spawn({
            x: this.x,
            y: this.y - 10,
            vx: Math.cos(ang) * 180,
            vy: Math.sin(ang) * 180,
            angle: Phaser.Math.RadToDeg(ang),
            texture: 'bullet_chalk_boss',
            damage: dmg.snipe,
            faction: 'enemy',
            life: 1.8,
          });
        });
      }
      return;
    }

    if (id === 'audit') {
      // 红框已亮 0.4s，再给 0.8s 反应时间，然后词典从天而降
      const tx = this.player.x;
      this.scene.time.delayedCall(800, () => {
        if (this.defeated || !this.active) return;
        this.scene.ai.bullets.spawn({
          x: tx,
          y: -20,
          vx: 0,
          vy: 0,
          gravity: 500,
          texture: 'bullet_dictionary',
          damage: dmg.audit,
          faction: 'enemy',
          life: 3,
          aoeRadius: 30,
          targetY: this.groundY,
        });
        this.scene.events.emit('ai:fx', {
          type: 'warning',
          x: tx,
          y: this.groundY - 30,
          text: '词典落下!',
        });
      });
    }
  }

  /* 二阶段：周期性全屏试卷弹幕（列间留缝） */
  phase2Tick(time) {
    if (time < this.nextBarrageAt) return;
    this.nextBarrageAt = time + this.cfg.barrageInterval * 1000;
    this.paperBarrage();
  }

  paperBarrage() {
    const cam = this.scene.cameras.main;
    const left = cam.scrollX + 8;
    const width = cam.width - 16;
    const cols = 6;
    const gapA = Phaser.Math.Between(0, cols - 1);
    const gapB = (gapA + 2 + Phaser.Math.Between(0, 1)) % cols;

    for (let i = 0; i < cols; i += 1) {
      if (i === gapA || i === gapB) continue;
      this.scene.ai.bullets.spawn({
        x: left + (width / (cols - 1)) * i,
        y: cam.scrollY - 20,
        vx: 0,
        vy: this.cfg.paperFallSpeed,
        texture: 'bullet_paper',
        damage: this.cfg.damage.paper,
        faction: 'enemy',
        life: 4,
        angle: 90,
        spin: 20,
      });
    }
    this.scene.events.emit('ai:fx', { type: 'barrage', kind: 'paper' });
  }
}

export default BossTeacher;
