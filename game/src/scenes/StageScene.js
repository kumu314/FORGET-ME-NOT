import Phaser from 'phaser';
import { GAME_WIDTH, PHYSICS } from '../config/gameConfig.js';
import { WORLD_WIDTH, getStageLayout, validateElderStageIsFlat } from '../config/stageLayout.js';
import { InputController, createIdleState } from '../core/Input.js';
import { createBackground, createHud, refreshHud, SOLID_TEXTURE } from './sceneHelpers.js';
import { EasterEggModal, EGG_PRESETS } from '../ui/EasterEggModal.js';
import Player from '../entities/Player.js';
import ChalkBullet from '../entities/ChalkBullet.js';
import AIManager from '../ai/AIManager.js';

/**
 * 关卡场景（成员C：关卡碰撞检测与检查点复活；issue #16：瓦片上墙 + 两彩蛋 + 检查点）
 *
 * 一个场景服务三关，靠 init 传入的 phase 切换：
 *  - 地形与彩蛋均由 src/config/stageLayout.js 数据驱动；第一关用 B 的瓦片图集拼装三段布局
 *  - 彩蛋走 E 的 EasterEggModal 特写（打字机 + 全局慢动作），触碰即触发
 *  - 死亡 → 最近接触过的检查点复活（满血满蓝 + 无敌帧）
 *  - T 键切换年龄用于演示生命周期数值与老年"禁跳"、R 键手动复活
 */

const STAGE_TINT = {
  youth: 0xffd9a0,
  middle: 0x2a3242,
  elder: 0x8a8f7a,
};

const PHASE_ORDER = ['youth', 'middle', 'elder'];

/** 彩蛋1 手写情书的弹窗文案（GDD 未给出原文，按 §5.5 回忆章节的基调补写） */
const LETTER_EGG_PRESET = {
  key: 'letter',
  title: '桌洞里的手写情书',
  icon: '💌',
  theme: 'paper',
  lines: [
    '课桌的桌洞深处压着一封没有署名的信，',
    '信纸边角已经被摩挲得起了毛边。',
    '“谢谢你总是最后一个走，替我把窗户关好。”',
  ],
  reward: '获得永久增益【怦然心动】：近战伤害 +25%',
};

export default class StageScene extends Phaser.Scene {
  constructor() {
    super('StageScene');
    this.checkpointList = [];
    this.activeCheckpointIndex = 0;
    this.bullets = [];
    this.targets = [];
    this.respawnPending = false;
    this.inputState = createIdleState();
    this.eggHelperBugs = [];
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
    this.eggHelperBugs = [];
    this.bg = null;
    this.breakableState = new Map();
  }

  create() {
    const { height } = this.game.config;
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, height);
    this.physics.world.gravity.y = 0; // 重力由 Player 自身 gravityY 承担，静态道具无需重力

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, height);
    this.bg = createBackground(this, STAGE_TINT[this.phaseId], this.layout.title);

    this._buildTerrain();
    this._buildCheckpoints();
    this._buildBreakables();
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

      // 第一关由 tiles 数据负责贴图（B 的瓦片），其余关沿用占位纹理
      if (this.layout.tiles.length === 0) {
        this.add.tileSprite(s.x, s.y, s.w, s.h, key).setOrigin(0, 0).setDepth(10);
      }

      // 每个地形配一个不可见静态体，按矩形精确对齐碰撞盒
      // ⚠️ 顺序必须是先 refreshBody 后 setSize：StaticBody.refreshBody() 会按纹理帧
      // 重置尺寸（16×16），放在 setSize 之后会把它改回去，地形碰撞实际只有一格大。
      const body = this.physics.add.staticImage(s.x + s.w / 2, s.y + s.h / 2, key);
      body.setVisible(false);
      body.refreshBody();
      body.setSize(s.w, s.h);
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

    this._paintTiles();
  }

  /** 数据驱动上墙：{ t: 帧名, x, y, w?, h? } 按"墙带→道具→地面"次序绘制，后画盖先画 */
  _paintTiles() {
    for (const op of this.layout.tiles) {
      const cols = op.w ?? 1;
      const rows = op.h ?? 1;
      const img = this.add
        .image(op.x, op.y, 'school_corridor', op.t)
        .setOrigin(0, 0)
        .setDepth(10);
      if (cols > 1 || rows > 1) {
        // 跑排瓦片：用 tileSprite 平铺，保持与单帧一致的像素密度
        img.destroy();
        this.add
          .tileSprite(op.x, op.y, cols * 16, rows * 16, 'school_corridor', op.t)
          .setOrigin(0, 0)
          .setDepth(10);
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

  /** 可打碎物：近战命中 → 换帧/散纸 → 掉落彩蛋（issue #16 桌洞纸堆 → 手写情书） */
  _buildBreakables() {
    this.breakables = this.layout.breakables.map((b) => {
      if (b.kind === 'paper-pile') {
        const books = this.add.image(b.x - 12, 216, 'school_corridor', 'books_stack').setOrigin(0, 0).setDepth(11);
        const scraps = this.add.image(b.x + 4, 224, 'school_corridor', 'paper_scrap').setOrigin(0, 0).setDepth(11);
        return { ...b, parts: [books, scraps], smashed: false };
      }
      if (b.kind === 'box') {
        // 纸箱贴图归 _buildEasterEggs 的 puppy-box 彩蛋管理，这里只登记判定点
        return { ...b, parts: [], smashed: false };
      }
      return { ...b, parts: [], smashed: false };
    });
  }

  _buildEasterEggs() {
    this.easterEggs = this.layout.easterEggs.map((egg) => {
      let marker;
      if (egg.id === 'puppy-box') {
        marker = this.add.image(egg.x, egg.y - 16, 'easter_eggs', 'box_closed').setDepth(12);
        // 封条未碎时轻微颤动（B 的 tremble 帧交替）
        this.time.addEvent({
          delay: 420,
          loop: true,
          callback: () => {
            if (!egg.smashed && marker.active) {
              marker.setTexture('easter_eggs', Math.random() < 0.5 ? 'box_tremble_a' : 'box_tremble_b');
            }
          },
        });
      } else if (egg.id === 'standard-answer') {
        marker = this.add.image(egg.x, egg.y - 8, 'easter_eggs', 'answer_card_a').setDepth(12);
        this.time.addEvent({
          delay: 380,
          loop: true,
          callback: () => {
            if (marker.active) {
              marker.setTexture(
                'easter_eggs',
                marker.frame.name === 'answer_card_a' ? 'answer_card_b' : 'answer_card_a',
              );
            }
          },
        });
      } else {
        marker = this.add.image(egg.x, egg.y - 8, 'ph_easter').setDepth(12);
      }
      this.tweens.add({
        targets: marker,
        y: marker.y - 3,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
      return { ...egg, marker, taken: false, smashed: false };
    });
  }

  _spawnPlayer() {
    const { spawn } = this.layout;
    this.player = new Player(this, spawn.x, spawn.y, {
      phase: this.phaseId,
      onCough: () => this._flashCough(),
      onRangedFire: (shot) => this._fireBullet(shot),
      // 近战结算入口：先打碎场景可碎物，AIManager 会在 installPlayerHooks 里链上小怪结算
      onMeleeHit: (info) => this._onPlayerMelee(info),
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
    this._spawnEggHelpers();

    // Boss 战结算反馈（血条由 E 的 BattleHUD 监听 ai:boss:hp / ai:boss:phase）
    this._onBossDefeated = ({ kind }) => {
      this.cameras.main.flash(420, 255, 240, 190);
      this._toast(kind === 'teacher' ? '下课铃响了——交卷吧' : '暴雨停了');
    };
    this.events.on('ai:boss:defeated', this._onBossDefeated, this);

    // 解谜借力怪被误杀 → 延时重生，保证"飞踢借力上横梁"路线永不软锁
    this._onAiKill = (info) => {
      const helper = this.eggHelperBugs.find(
        (h) => h.spec.type === info.type && Math.abs(h.spec.x - info.x) < 48,
      );
      if (!helper || !this.scene.isActive()) return;
      helper.monster = null;
      this.time.delayedCall(helper.spec.respawnMs ?? 2500, () => {
        if (this.scene.isActive()) helper.monster = this.ai?.spawnMonster(helper.spec.type, helper.spec.x, helper.spec.y);
      });
    };
    this.events.on('ai:kill', this._onAiKill, this);
  }

  /** 彩蛋解谜浮空借力怪（stageLayout.eggHelpers，y 为显式悬停高度） */
  _spawnEggHelpers() {
    for (const spec of this.layout.eggHelpers) {
      const monster = this.ai.spawnMonster(spec.type, spec.x, spec.y);
      this.eggHelperBugs.push({ spec, monster });
    }
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
    // 彩蛋弹窗开启：全局慢动作（E 的 EasterEggModal 约定）——玩家按慢速走，敌人与子弹暂停
    const modalOpen = EasterEggModal.isOpen;
    const ts = modalOpen ? EasterEggModal.timeScale : 1;
    const input = modalOpen ? createIdleState() : (this.inputCtl?.update() ?? this.inputState);
    this.inputState = input;

    this.player.update(delta * ts, input);
    if (!modalOpen) {
      this.ai?.update(time, delta);
      this._updateBullets();
    }
    this.player.setDebugMeleeBox(true);

    // 老年记忆碎片的追踪目标（ChalkBullet 读 scene.targets）
    this.targets = this.ai ? [...this.ai.aliveMonsters(), this.ai.activeBoss()].filter(Boolean) : [];

    this._updateParallax();
    this._updateCheckpoints();
    if (!modalOpen) this._updateEasterEggs();
    refreshHud(this, this.hud, this.player);
  }

  _updateParallax() {
    const scrollX = this.cameras.main.scrollX;
    for (const layer of this.bg?.layers ?? []) {
      layer.ts.tilePositionX = scrollX * layer.factor;
    }
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
        this._toast(`检查点已点亮：${cp.label}`);
        break;
      }
    }
  }

  /** 近战结算入口：打碎可碎物（纸堆 / 纸箱封条）；小怪结算由 AIManager 链式处理 */
  _onPlayerMelee(info) {
    if (!info?.box) return;
    for (const b of this.breakables ?? []) {
      if (b.smashed) continue;
      const rect = new Phaser.Geom.Rectangle(b.x - 12, b.y - 16, 24, 24);
      if (!Phaser.Geom.Intersects.RectangleToRectangle(info.box, rect)) continue;

      if (b.kind === 'paper-pile') {
        this._smashPaperPile(b);
      } else if (b.kind === 'box') {
        this._openPuppyBox(b);
      }
    }
  }

  _smashPaperPile(b) {
    b.smashed = true;
    for (const part of b.parts) part.setVisible(false);
    // 纸屑四散
    for (let i = 0; i < 5; i += 1) {
      const scrap = this.add
        .image(b.x + Phaser.Math.Between(-8, 8), b.y - 4, 'school_corridor', 'paper_scrap')
        .setDepth(13);
      this.tweens.add({
        targets: scrap,
        x: b.x + Phaser.Math.Between(-34, 34),
        y: b.y + Phaser.Math.Between(-14, 10),
        angle: Phaser.Math.Between(-120, 120),
        alpha: 0,
        duration: 620,
        ease: 'Cubic.out',
        onComplete: () => scrap.destroy(),
      });
    }
    // 情书浮现 → 注册为可触碰彩蛋
    const letter = this.add.image(b.x, b.y - 6, 'ph_letter').setDepth(14);
    this.tweens.add({
      targets: letter,
      y: letter.y - 5,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.easterEggs.push({
      id: 'love-letter',
      x: b.x,
      y: b.y - 2,
      type: 'buff',
      marker: letter,
      taken: false,
      smashed: false,
    });
    this._toast('纸堆散开——桌洞里掉出一封信');
  }

  _openPuppyBox(b) {
    b.smashed = true;
    const egg = this.easterEggs.find((e) => e.id === 'puppy-box');
    if (!egg) return;
    egg.smashed = true;
    egg.marker.setTexture('easter_eggs', 'box_open');
    const bubble = this.add.image(egg.x, egg.y - 40, 'easter_eggs', 'bubble_wuu').setDepth(13);
    this.tweens.add({
      targets: bubble,
      y: bubble.y - 6,
      alpha: 0,
      duration: 1500,
      onComplete: () => bubble.destroy(),
    });
  }

  _updateEasterEggs() {
    for (const egg of this.easterEggs) {
      if (egg.taken) continue;
      if (Math.abs(this.player.x - egg.x) < 14 && Math.abs(this.player.y - egg.y) < 40) {
        if (egg.id === 'puppy-box' && !egg.smashed) {
          // 封条未碎：只提示，不触发（GDD §4.4：先 J 打碎封条与杂物，再触碰）
          if (!egg.hintedAt || this.time.now - egg.hintedAt > 1600) {
            egg.hintedAt = this.time.now;
            this._toast('纸箱在颤动……用 J 打开封条试试');
          }
          continue;
        }

        egg.taken = true;
        egg.marker.setTint(0x88ff88);
        this._openEggModal(egg);
      }
    }
  }

  /** 彩蛋特写：E 的打字机弹窗 + 全局慢动作；增益在触碰瞬间生效 */
  _openEggModal(egg) {
    if (egg.id === 'standard-answer') {
      this.player.grantStandardAnswer();
      this._toast('拾取【标准答案】：能量上限 80 · 回能 4/s · 红笔穿透');
      EasterEggModal.open({ ...EGG_PRESETS.answer });
    } else if (egg.id === 'love-letter') {
      this.player.grantLoveLetter();
      this._toast('拾取【手写情书】：近战伤害 +25%（怦然心动）');
      EasterEggModal.open({ ...LETTER_EGG_PRESET });
    } else if (egg.id === 'puppy-box') {
      // 纸箱 → 忠犬入队（写 registry，二/三关自动继承形态）
      this.ai?.onEasterEgg('puppy-box');
      EasterEggModal.open({ ...EGG_PRESETS.dog });
    } else {
      this._toast('发现彩蛋');
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
    if (this._onAiKill) {
      this.events.off('ai:kill', this._onAiKill, this);
      this._onAiKill = null;
    }
    if (EasterEggModal.isOpen) EasterEggModal.close();

    this.ai?.destroy();
    this.ai = null;

    this.inputCtl?.destroy();
    this.inputCtl = null;
    this.bullets = [];
    this.targets = [];
    this.eggHelperBugs = [];
  }
}
