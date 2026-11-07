import Phaser from 'phaser';
import { GAME_WIDTH, PHYSICS } from '../config/gameConfig.js';
import { WORLD_WIDTH, getStageLayout, validateElderStageIsFlat } from '../config/stageLayout.js';
import { InputController, createIdleState } from '../core/Input.js';
import { createBackground, createHud, refreshHud, SOLID_TEXTURE } from './sceneHelpers.js';
import Player from '../entities/Player.js';
import ChalkBullet from '../entities/ChalkBullet.js';
import AIManager from '../ai/AIManager.js';

/**
 * 关卡场景（成员C：关卡碰撞检测与检查点复活）
 *
 * 一个场景服务三关，靠 init 传入的 phase 切换：
 *  - 地形与彩蛋均由 src/config/stageLayout.js 数据驱动
 *  - 死亡 → 最近接触过的检查点复活（满血满蓝 + 无敌帧）
 *  - T 键切换年龄用于演示生命周期数值与老年"禁跳"、R 键手动复活
 */

const STAGE_TINT = {
  youth: 0xffd9a0,
  middle: 0x2a3242,
  elder: 0x8a8f7a,
};

const PHASE_ORDER = ['youth', 'middle', 'elder'];

export default class StageScene extends Phaser.Scene {
  constructor() {
    super('StageScene');
    this.checkpointList = [];
    this.activeCheckpointIndex = 0;
    this.bullets = [];
    this.targets = [];
    this.respawnPending = false;
    this.inputState = createIdleState();
  }

  /**
   * @param {{phase?: 'youth'|'middle'|'elder'}} [data]
   */
  init(data) {
    this.phaseId = data?.phase ?? 'youth';
    this.layout = getStageLayout(this.phaseId);
    if (this.phaseId === 'elder') validateElderStageIsFlat(this.layout);

    // Scene 实例会被复用，可变状态必须在这里重置
    this.checkpointList = this.layout.checkpoints.map((c) => ({ ...c }));
    this.activeCheckpointIndex = 0;
    this.bullets = [];
    this.targets = [];
    this.respawnPending = false;
    this.inputState = createIdleState();
  }

  create() {
    const { height } = this.game.config;
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, height);
    this.physics.world.gravity.y = 0; // 重力由 Player 自身 gravityY 承担，静态道具无需重力

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, height);
    createBackground(this, STAGE_TINT[this.phaseId], this.layout.title);

    this._buildTerrain();
    this._buildCheckpoints();
    this._buildEasterEggs();
    this._spawnPlayer();
    this._initAI();

    this.hud = createHud(this);
    this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
    this.cameras.main.setDeadzone(60, 40);

    this._bindDebugKeys();
    this.inputCtl = new InputController(this);

    this.events.once('shutdown', () => this._teardown());
    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  // ==========================================================
  // 构建
  // ==========================================================

  _buildTerrain() {
    this.solids = this.physics.add.staticGroup();

    for (const s of this.layout.solids) {
      const key = SOLID_TEXTURE[s.kind] ?? SOLID_TEXTURE.ground;
      this.add.tileSprite(s.x, s.y, s.w, s.h, key).setOrigin(0, 0).setDepth(10);

      // 每个地形配一个不可见静态体，按矩形精确对齐碰撞盒
      const body = this.physics.add.staticImage(s.x + s.w / 2, s.y + s.h / 2, key);
      body.setVisible(false);
      body.setSize(s.w, s.h);
      body.refreshBody();
      this.solids.add(body);

      if (s.label) {
        this.add
          .text(s.x + s.w / 2, s.y - 12, s.label, {
            fontFamily: 'monospace',
            fontSize: '8px',
            color: '#ffe6a7',
          })
          .setOrigin(0.5, 1)
          .setDepth(11);
      }
    }
  }

  _buildCheckpoints() {
    this.checkpointMarkers = this.checkpointList.map((cp, i) => {
      const flag = this.add.rectangle(cp.x, cp.y, 6, 22, 0xffd76a).setOrigin(0.5, 1).setDepth(12);
      flag.setAlpha(i === 0 ? 1 : 0.55);
      return flag;
    });
    this.activeCheckpointIndex = 0;
  }

  _buildEasterEggs() {
    this.easterEggs = this.layout.easterEggs.map((egg) => {
      const marker = this.add.image(egg.x, egg.y - 8, 'ph_easter').setDepth(12);
      this.tweens.add({
        targets: marker,
        y: marker.y - 3,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
      return { ...egg, marker, taken: false };
    });
  }

  _spawnPlayer() {
    const { spawn } = this.layout;
    this.player = new Player(this, spawn.x, spawn.y, {
      phase: this.phaseId,
      onCough: () => this._flashCough(),
      onRangedFire: (shot) => this._fireBullet(shot),
      onMeleeHit: null,
      onDamaged: (info) => this._showDamageText(info),
      onDeath: () => this._onPlayerDeath(),
    });
    this.player.setSpawnPoint(spawn.x, spawn.y);
    this.player.setDepth(20);
    this.physics.add.collider(this.player, this.solids);
    this.player.setDebugMeleeBox(true);
  }

  /** AI 接线：刷怪 / 忠犬继承 / Boss 触发线，全部由布阵数据驱动 */
  _initAI() {
    this.ai = new AIManager(this, this.player, this.solids, {
      groundY: this._groundTop(),
    });
    this.ai.applyStage(this.phaseId);

    // Boss 战结算反馈（血条由 E 的 BattleHUD 监听 ai:boss:hp / ai:boss:phase）
    this._onBossDefeated = ({ kind }) => {
      this.cameras.main.flash(420, 255, 240, 190);
      this._toast(kind === 'teacher' ? '下课铃响了——交卷吧' : '暴雨停了');
    };
    this.events.on('ai:boss:defeated', this._onBossDefeated, this);
  }

  /** 当前关卡地面的顶面 y */
  _groundTop() {
    const ground = this.layout.solids.filter((s) => s.kind === 'ground');
    return ground.length ? Math.min(...ground.map((s) => s.y)) : 240;
  }

  // ==========================================================
  // 输入
  // ==========================================================

  _bindDebugKeys() {
    const kb = this.input.keyboard;
    if (!kb) return;
    // 注意：input.keyboard 是全局插件，scene.restart() 不会自动解绑，
    // 所以这里保存函数引用，在 _teardown() 里成对 off 掉，否则每次重开都会多绑一次。
    this._onKeyT = () => this._cyclePhase();
    this._onKeyR = () => this.player?.respawn(this._activeCheckpoint());
    kb.on('keydown-T', this._onKeyT);
    kb.on('keydown-R', this._onKeyR);
  }

  /** T 键：青年 → 中年 → 老年循环，用于演示生命周期数值与禁跳 */
  _cyclePhase() {
    const next = PHASE_ORDER[(PHASE_ORDER.indexOf(this.phaseId) + 1) % PHASE_ORDER.length];
    this.scene.restart({ phase: next });
  }

  // ==========================================================
  // 主循环
  // ==========================================================

  update(time, delta) {
    const input = this.inputCtl?.update() ?? this.inputState;
    this.inputState = input;

    this.player.update(delta, input);
    this.ai?.update(time, delta);
    this.player.setDebugMeleeBox(true);

    this._updateCheckpoints();
    this._updateEasterEggs();
    this._updateBullets();
    refreshHud(this, this.hud, this.player);
  }

  _activeCheckpoint() {
    return this.checkpointList[this.activeCheckpointIndex] ?? this.checkpointList[0];
  }

  /** 检查点：走过即激活，死亡后回到最近激活的那个 */
  _updateCheckpoints() {
    for (let i = this.activeCheckpointIndex + 1; i < this.checkpointList.length; i += 1) {
      const cp = this.checkpointList[i];
      if (Math.abs(this.player.x - cp.x) < 18 && this.player.y >= cp.y - 40) {
        this.activeCheckpointIndex = i;
        this.player.setSpawnPoint(cp.x, cp.y);
        this.checkpointMarkers.forEach((m, idx) => m.setAlpha(idx <= i ? 1 : 0.55));
        this.cameras.main.flash(120, 255, 215, 106);
        break;
      }
    }
  }

  _updateEasterEggs() {
    for (const egg of this.easterEggs) {
      if (egg.taken) continue;
      if (Math.abs(this.player.x - egg.x) < 14 && Math.abs(this.player.y - egg.y) < 40) {
        egg.taken = true;
        egg.marker.setTint(0x88ff88);
        if (egg.id === 'standard-answer') {
          this.player.grantStandardAnswer();
          this._toast('拾取【标准答案】：能量上限 80 · 回能 4/s');
        } else if (egg.id === 'puppy-box') {
          // 纸箱 → 忠犬入队（写 registry，二/三关自动继承形态）
          this.ai?.onEasterEgg('puppy-box');
        } else {
          this._toast('发现彩蛋');
        }
      }
    }
  }

  _updateBullets() {
    this.bullets = this.bullets.filter((b) => b.active);
    if (!this.ai) return;

    for (const b of this.bullets) {
      const hits = this.ai.hitByProjectile(b);
      if (hits.length === 0) continue;

      // 非穿刺弹（纸飞机）命中即爆：先结算纸屑 AOE，再销毁
      if (!b.profile.pierce) {
        if (b.aoeRadius > 0) {
          this.ai.damageMonstersAt(b.x, b.y, b.aoeRadius, Math.round(b.profile.damage * 0.5), {
            fromProjectile: true,
          });
        }
        b.destroy();
      }
    }

    this.bullets = this.bullets.filter((b) => b.active);
  }

  // ==========================================================
  // 战斗结算
  // ==========================================================

  _fireBullet(shot) {
    // 能量已在 Player 内扣除，这里只负责把子弹放进世界
    const bullet = new ChalkBullet(this, {
      x: shot.x,
      y: shot.y,
      facing: shot.facing,
      phaseId: shot.phaseId,
      owner: shot.owner,
    });
    this.bullets.push(bullet);
  }

  _onPlayerDeath() {
    if (this.respawnPending) return;
    this.respawnPending = true;
    this.cameras.main.shake(180, 0.008);
    this.time.delayedCall(PHYSICS.respawnDelayMs, () => {
      this.player.respawn(this._activeCheckpoint());
      this.respawnPending = false;
    });
  }

  // ==========================================================
  // 反馈
  // ==========================================================

  _showDamageText(info, color = '#ff8888', x = null, y = null) {
    const label = this.add
      .text(x ?? this.player.x, (y ?? this.player.y) - 26, `-${info.damage}`, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color,
      })
      .setOrigin(0.5)
      .setDepth(2000);
    this.tweens.add({
      targets: label,
      y: label.y - 14,
      alpha: 0,
      duration: 520,
      onComplete: () => label.destroy(),
    });
  }

  /** 老年按 Space：只冒一个咳嗽气泡，绝不产生竖直速度 */
  _flashCough() {
    const bubble = this.add
      .text(this.player.x + this.player.facing * 10, this.player.y - 26, '咳…', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#ffffff',
        backgroundColor: '#00000066',
      })
      .setOrigin(0.5)
      .setDepth(2000);
    this.tweens.add({
      targets: bubble,
      y: bubble.y - 10,
      alpha: 0,
      duration: 600,
      onComplete: () => bubble.destroy(),
    });
  }

  _toast(text) {
    const t = this.add
      .text(GAME_WIDTH / 2, 36, text, { fontFamily: 'monospace', fontSize: '9px', color: '#fff6c9' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3000);
    this.tweens.add({ targets: t, alpha: 0, duration: 1400, delay: 500, onComplete: () => t.destroy() });
  }

  _teardown() {
    // 解绑调试键，避免 scene.restart() 累积监听器导致 T/R 被触发多次
    const kb = this.input?.keyboard;
    if (kb) {
      if (this._onKeyT) kb.off('keydown-T', this._onKeyT);
      if (this._onKeyR) kb.off('keydown-R', this._onKeyR);
    }
    this._onKeyT = null;
    this._onKeyR = null;

    if (this._onBossDefeated) {
      this.events.off('ai:boss:defeated', this._onBossDefeated, this);
      this._onBossDefeated = null;
    }
    this.ai?.destroy();
    this.ai = null;

    this.inputCtl?.destroy();
    this.inputCtl = null;
    this.bullets = [];
    this.targets = [];
  }
}
