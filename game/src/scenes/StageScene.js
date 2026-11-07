import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PHYSICS } from '../config/gameConfig.js';
import { WORLD_WIDTH, getStageLayout, validateElderStageIsFlat } from '../config/stageLayout.js';
import { InputController, createIdleState } from '../core/Input.js';
import { createBackground, createHud, refreshHud, SOLID_TEXTURE } from './sceneHelpers.js';
import Player from '../entities/Player.js';
import ChalkBullet from '../entities/ChalkBullet.js';
import AIManager from '../ai/AIManager.js';
import XpSystem from '../entities/XpSystem.js';
import { audio } from '../audio/AudioManager.js';
import { mountBattleHud } from '../ui/HudOverlay.js';
import { EasterEggModal, EGG_PRESETS } from '../ui/EasterEggModal.js';
import { TypewriterTransition, TRANSITION_PRESETS } from '../ui/TypewriterTransition.js';
import { installEndingScreen } from '../ui/EndingScreen.js';
import { ELDER_CHILD, canHugChild } from '../config/elderEnding.js';
import { installStagePassives, tickPassiveRecovery } from '../entities/stagePassives.js';
import { installTelemetry } from '../telemetry/PlaytestTelemetry.js';
import { installJuice } from '../fx/Juice.js';

/**
 * 关卡场景（成员C：关卡碰撞检测与检查点复活 / 成员D：AI 接线 / 成员E：HUD·弹窗·音频·转场）
 *
 * 一个场景服务三关，靠 init 传入的 phase 切换：
 *  - 地形与彩蛋均由 src/config/stageLayout.js 数据驱动
 *  - 死亡 → 最近接触过的检查点复活（满血满蓝 + 无敌帧），带死亡遮罩
 *  - 打完 Boss → 打字机转场 → 自动进下一关；第三关走到公园尽头 → 结局文本
 *  - T 键切换年龄、R 键手动复活（演示用）
 */

const STAGE_TINT = {
  youth: 0xffd9a0,
  middle: 0x2a3242,
  elder: 0x8a8f7a,
};

const PHASE_ORDER = ['youth', 'middle', 'elder'];
const NEXT_PHASE = { youth: 'middle', middle: 'elder' };
const NEXT_TRANSITION = { youth: '1to2', middle: '2to3' };
const BGM_KEY = { youth: 'stage1', middle: 'stage2', elder: 'stage3' };

/** 彩蛋 id → 成员E 的文案预设 */
const EGG_BY_ID = {
  'puppy-box': EGG_PRESETS.dog,
  'standard-answer': EGG_PRESETS.answer,
  thermos: EGG_PRESETS.cup,
  'wedding-ring': {
    key: 'ring', title: '工牌旁的婚戒', icon: '💍', theme: 'paper',
    lines: ['工牌会过期，戒指内侧的名字却一直在。', '你想起热茶、等你回家的人，和脚边那团温暖的毛。', '雨停之后，记得一起回家。'],
    reward: '留下一段家庭记忆；忠犬恢复守护的力量',
  },
  // 彩蛋1 手写情书（issue #16）：GDD 未给原文，按 §5.5 回忆章节基调补写
  'love-letter': {
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
  },
};

/** 音效只加载一次（三个关卡共用同一份 SFX 缓冲） */
let sfxLoading = null;
function ensureSfxLoaded() {
  if (!sfxLoading) sfxLoading = audio.loadSfx();
  return sfxLoading;
}

export default class StageScene extends Phaser.Scene {
  constructor() {
    super('StageScene');
    this.checkpointList = [];
    this.activeCheckpointIndex = 0;
    this.bullets = [];
    this.targets = [];
    this.respawnPending = false;
    this.inputState = createIdleState();
    this.modalOpen = false;
    this.transitioning = false;
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
    this.modalOpen = false;
    this.transitioning = false;
    this.endingPlayed = false;
    this.child = null;
    this.lastHitSfxAt = 0;
    this.aiListeners = [];
    this.eggHelperBugs = [];
  }

  create() {
    const { height } = this.game.config;
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, height);
    this.physics.world.gravity.y = 0; // 重力由 Player 自身 gravityY 承担，静态道具无需重力

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, height);
    createBackground(this, STAGE_TINT[this.phaseId], this.layout.title, this.phaseId);

    this._buildTerrain();
    this._buildCheckpoints();
    this._buildBreakables();
    this._buildEasterEggs();
    this._spawnPlayer();
    this._initAI();
    this._initXP();
    installStagePassives(this.player, this.game.registry, () => this.time.now);
    this._buildChild();

    this.hud = createHud(this);
    this._initUiModules();
    installEndingScreen(this);
    installTelemetry(this); // 试玩遥测（issue #26）：用时/死亡/承伤/按键，__fmnTelemetry.download() 导出
    installJuice(this); // 打击感机制层（issue #26）：命中顿帧 + 三档屏震

    this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
    this.cameras.main.setDeadzone(60, 40);

    this._buildDemoGuide();
    this._bindDebugKeys();
    this.inputCtl = new InputController(this);

    this.events.once('shutdown', () => this._teardown());
    this.cameras.main.fadeIn(220, 0, 0, 0);
    this._syncHud(0);
  }

  /* ==========================================================
   * UI / 音频接线（成员E 模块的挂载点）
   * ========================================================== */

  _initUiModules() {
    // 1) 战斗 HUD：E 的 Canvas 覆盖层，挂到 Phaser 主画布上方
    const mount = mountBattleHud(this.game);
    this.battleHud = mount.hud;
    this._hudMount = mount;
    this.battleHud.setStage(this.layout.title);

    // 旧 Phaser 简易 HUD 全部隐藏：血条/读数由 E 的 Canvas HUD 接管，
    // 它的底部提示条会和 HUD 的 HP/MP 条叠在同一区域（重叠成一团糊字）。
    for (const key of ['hpBg', 'hpBar', 'mpBg', 'mpBar', 'phaseText', 'hintBg', 'hintText']) {
      this.hud[key]?.setVisible(false);
    }

    // 2) 音频：首次用户手势解锁 + 预加载真实素材（失败自动回退合成音）
    this._unlockAudio = () => audio.unlock();
    window.addEventListener('pointerdown', this._unlockAudio, { once: true });
    window.addEventListener('keydown', this._unlockAudio, { once: true });
    ensureSfxLoaded().then(() => {
      // 二关雨夜的环境雨声：AudioManager.playLoop 就是为「第二关雨声」留的口子。
      // 素材没加载成功时 playLoop 返回空函数，等于静音，不抛错。
      if (this.phaseId !== 'middle' || !this.scene.isActive()) return;
      this._stopRain = audio.playLoop('rain', { volume: 0.22 });
      this.time.addEvent({ delay: 9000, loop: true, callback: () => audio.play('thunder', { volume: 0.35 }) });
    });
    audio.stopBgm();
    audio.startBgm(BGM_KEY[this.phaseId]);

    // 3) 彩蛋弹窗开启时冻结世界（GDD：慢动作居中特写）
    this._onEggOpen = () => {
      this.modalOpen = true;
      this.player?.setVelocity(0, 0);
      this.physics?.world?.pause?.();
    };
    this._onEggClose = () => {
      this.modalOpen = false;
      this.physics?.world?.resume?.();
    };
    window.addEventListener('egg-modal:open', this._onEggOpen);
    window.addEventListener('egg-modal:close', this._onEggClose);

    // 4) 战斗事件 → HUD 飘字 / 音效
    this._bindCombatFeedback();
  }

  _bindCombatFeedback() {
    const on = (evt, fn) => {
      this.events.on(evt, fn, this);
      this.aiListeners.push([evt, fn]);
    };

    on('ai:damage', ({ x, y, amount, target }) => {
      this.battleHud?.spawnDamage(x, y, amount, { crit: amount >= 20 });
      const now = this.time.now;
      if (now - this.lastHitSfxAt > 60) {
        this.lastHitSfxAt = now;
        audio.play(target === 'boss' ? 'hit_heavy' : 'hit');
      }
    });

    on('ai:kill', (info) => {
      audio.play('pickup');
      // 解谜借力怪被误杀 → 延时重生，保证"飞踢借力上横梁"路线永不软锁（issue #16）
      const helper = (this.eggHelperBugs || []).find(
        (h) => h.spec.type === info?.type && Math.abs(h.spec.x - (info?.x ?? 0)) < 48,
      );
      if (helper) {
        helper.monster = null;
        this.time.delayedCall(helper.spec.respawnMs ?? 2500, () => {
          if (this.scene.isActive() && this.ai) {
            helper.monster = this.ai.spawnMonster(helper.spec.type, helper.spec.x, helper.spec.y);
          }
        });
      }
    });
    on('ai:dog:bark', () => audio.play('bark'));
    on('ai:dog:bite', () => audio.play('bark_attack'));
    on('ai:dog:heal', ({ amount }) => {
      audio.play('heal');
      if (this.player) this.battleHud?.spawnText(this.player.x, this.player.y - 20, `+${amount}`, '#7ddc8a');
    });
    on('ai:skill:drop', ({ name }) => {
      audio.play('mp_up');
      this._toast(`获得被动【${name}】`);
    });

    on('ai:boss:spawn', ({ name, hpMax }) => {
      this.battleHud?.showBoss({ name, maxHp: hpMax });
      audio.play('boss_enter');
      audio.play('bell');
    });
    on('ai:boss:hp', ({ hp }) => this.battleHud?.setBossHp(hp));
    on('ai:boss:phase', () => {
      audio.play('boss_warn');
      this.cameras.main.shake(220, 0.006);
    });
  }

  /* ==========================================================
   * 构建
   * ========================================================== */

  _buildTerrain() {
    this.solids = this.physics.add.staticGroup();

    for (const s of this.layout.solids) {
      const key = SOLID_TEXTURE[s.kind] ?? SOLID_TEXTURE.ground;
      // 三关均由 tiles 数据负责贴图。
      if (this.layout.tiles.length === 0) {
        this.add.tileSprite(s.x, s.y, s.w, s.h, key).setOrigin(0, 0).setDepth(10);
      }

      // 碰撞体用不可见矩形直接建静态体：体积天然等于地形矩形。
      // 不能用 staticImage + setSize + refreshBody —— refreshBody() 会把刚设好的
      // 尺寸重新同步回贴图尺寸（16×16），地表/平台只剩一个 16px 的小方块，
      // 玩家和小怪会直接穿过地面掉到世界底部。
      const body = this.add.rectangle(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, 0x000000, 0);
      body.setVisible(false);
      this.physics.add.existing(body, true);
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

  /** 数据驱动上墙（issue #16）：{ t: 帧名, x, y, w?, h? }，按"墙带→道具→地面"次序绘制，后画盖先画 */
  _paintTiles() {
    const atlas = this.layout.tileset ?? 'school_corridor';
    for (const op of this.layout.tiles) {
      const cols = op.w ?? 1;
      const rows = op.h ?? 1;
      if (cols > 1 || rows > 1) {
        // 跑排瓦片：用 tileSprite 平铺，Phaser 会为图集帧生成填充纹理
        this.add
          .tileSprite(op.x, op.y, cols * 16, rows * 16, atlas, op.t)
          .setOrigin(0, 0)
          .setDepth(10);
      } else {
        this.add.image(op.x, op.y, atlas, op.t).setOrigin(0, 0).setDepth(10);
      }
    }
  }

  /** 可打碎物（issue #16）：近战命中 → 换帧/散纸 → 掉落彩蛋 */
  _buildBreakables() {
    this.breakables = this.layout.breakables.map((b) => {
      if (b.kind === 'paper-pile') {
        const books = this.add.image(b.x - 12, 216, 'school_corridor', 'books_stack').setOrigin(0, 0).setDepth(11);
        const scraps = this.add.image(b.x + 4, 224, 'school_corridor', 'paper_scrap').setOrigin(0, 0).setDepth(11);
        return { ...b, parts: [books, scraps], smashed: false };
      }
      // 纸箱贴图归 _buildEasterEggs 的 puppy-box 彩蛋管理，这里只登记判定点
      return { ...b, parts: [], smashed: false };
    });
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
      // B 的正式彩蛋贴图就位后按 id 换装；缺失时回退占位方块
      let marker;
      if (egg.id === 'puppy-box' && this.textures.exists('easter_eggs')) {
        marker = this.add.image(egg.x, egg.y - 16, 'easter_eggs', 'box_closed').setDepth(12);
        // 封条未碎时轻微颤动（B 的 tremble 帧交替，GDD §4.4 "纸箱微微颤动"）
        this.time.addEvent({
          delay: 420,
          loop: true,
          callback: () => {
            const live = this.easterEggs?.find((e) => e.id === egg.id);
            if (!live?.smashed && marker.active) {
              marker.setTexture('easter_eggs', Math.random() < 0.5 ? 'box_tremble_a' : 'box_tremble_b');
            }
          },
        });
      } else if (egg.id === 'standard-answer' && this.textures.exists('easter_eggs')) {
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
      } else if (egg.id === 'thermos' && this.textures.exists('easter_eggs')) {
        marker = this.add.image(egg.x, egg.y - 8, 'easter_eggs', 'thermos_a').setDepth(12);
      } else if (egg.id === 'wedding-ring') {
        marker = this.add.circle(egg.x, egg.y - 8, 4, 0xffd76a, 0.3)
          .setStrokeStyle(2, 0xffd76a).setDepth(12);
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
      onRangedFire: (shot) => {
        audio.play(shot.phaseId === 'elder' ? 'magic' : 'throw');
        this._fireBullet(shot);
      },
      // 近战结算入口：先打碎场景可碎物，AIManager 会在 installPlayerHooks 里链上小怪结算
      onMeleeHit: (info) => this._onPlayerMelee(info),
      onDamaged: (info) => this._onPlayerDamaged(info),
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

    // Boss 战结算：胜利标识 → 打字机转场 → 下一关
    this._onBossDefeated = ({ kind }) => {
      this.cameras.main.flash(420, 255, 240, 190);
      // 结算台词由 BossBase.defeat() 的 speak() 横幅承担，这里不再重复 toast
      this._showVictoryBanner(kind);
      this.battleHud?.hideBoss();
      audio.play('victory');
      this.time.delayedCall(1400, () => this._advanceStage());
    };
    this.events.on('ai:boss:defeated', this._onBossDefeated, this);
  }

  /** 当前关卡地面的顶面 y */
  _groundTop() {
    const ground = this.layout.solids.filter((s) => s.kind === 'ground');
    return ground.length ? Math.min(...ground.map((s) => s.y)) : 240;
  }

  _buildChild() {
    if (this.phaseId !== 'elder') return;
    this.child = this.add.sprite(ELDER_CHILD.x, this._groundTop(), 'boss_child', 'idle_0')
      .setOrigin(0.5, 47 / 48).setDepth(18);
    this.child.play('boss_child:idle');
    this.add.text(ELDER_CHILD.x - 96, this._groundTop() - 68,
      '孩子拖着行李箱，准备远行。\n慢慢走到他身后，抱一抱他。', {
        fontFamily: 'monospace', fontSize: '8px', color: '#ffe6a7', align: 'center',
      }).setDepth(21);
  }

  /** 经验系统接线（issue #17）：光球磁吸 + 升级三选一，跨关 registry 持久化 */
  _initXP() {
    this.xp = new XpSystem(this, this.player);
    this.events.once('shutdown', () => {
      this.xp?.destroy();
      this.xp = null;
    });
  }

  /** 彩蛋解谜浮空借力怪（stageLayout.eggHelpers，y 为显式悬停高度；issue #16 飞踢借力上横梁） */
  _spawnEggHelpers() {
    for (const spec of this.layout.eggHelpers) {
      const monster = this.ai.spawnMonster(spec.type, spec.x, spec.y);
      this.eggHelperBugs.push({ spec, monster });
    }
  }

  /* ==========================================================
   * 关卡推进
   * ========================================================== */

  async _advanceStage() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.events.emit('stage:complete', { phaseId: this.phaseId }); // 遥测：本关结算（issue #26）
    audio.stopBgm();

    const next = NEXT_PHASE[this.phaseId];
    const preset = next ? TRANSITION_PRESETS[NEXT_TRANSITION[this.phaseId]] : TRANSITION_PRESETS.ending;

    await TypewriterTransition.play(preset, { onTick: () => audio.play('typing') });

    this.transitioning = false;
    if (next) {
      this.scene.restart({ phase: next });
    } else {
      this.scene.start('EndingScene');
    }
  }

  _checkEnding() {
    if (this.phaseId !== 'elder' || this.endingPlayed || !this.child) return;
    if (!canHugChild(this.player)) return;
    this.endingPlayed = true;
    this.modalOpen = true;
    this.player.setVelocity(0, 0);
    this.player.play('player_elder:idle', true);
    this.child.setFlipX(true);
    this.child.play('boss_child:idle', true);
    this.physics.world.pause();
    audio.stopBgm();
    const warmth = this.add.circle(this.child.x - 8, this._groundTop() - 20, 48, 0xffc477, 0.2)
      .setDepth(17);
    this.tweens.add({ targets: warmth, alpha: 0.5, duration: 700 });
    this.tweens.add({ targets: this.player, x: this.child.x - 10, duration: 450 });
    this._toast('你轻轻抱住了孩子。他停下脚步，转过身来。');
    this.events.emit('story:hug');
  }

  /* ==========================================================
   * 输入
   * ========================================================== */

  _bindDebugKeys() {
    const kb = this.input.keyboard;
    if (!kb) return;
    // 注意：input.keyboard 是全局插件，scene.restart() 不会自动解绑，
    // 所以这里保存函数引用，在 _teardown() 里成对 off 掉，否则每次重开都会多绑一次。
    this._onKeyT = () => this._cyclePhase();
    this._onKeyR = () => {
      this._hideDeathOverlay();
      this.player?.respawn(this._activeCheckpoint());
      this.respawnPending = false;
    };
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
    // 彩蛋弹窗 / 转场期间冻结玩法，只继续刷 HUD
    if (this.modalOpen || this.transitioning) {
      this._syncHud(delta);
      return;
    }

    const input = this.inputCtl?.update() ?? this.inputState;
    this.inputState = input;

    this.player.update(delta, input);
    if (time < this.player.stageSlowUntil) {
      this.player.setVelocityX(this.player.body.velocity.x * this.player.stageSlowMult);
    }
    this.ai?.update(time, delta);
    this.xp?.update(delta);
    this.player.setDebugMeleeBox(true);

    // 老年记忆碎片的追踪目标（ChalkBullet 读 scene.targets；含 Boss）
    this.targets = this.ai ? [...this.ai.aliveMonsters(), this.ai.activeBoss()].filter(Boolean) : [];

    this._updateCheckpoints();
    this._updateEasterEggs();
    this._updateBullets();
    this._updateParallax(delta);
    const threatened = this.ai?.aliveMonsters().some((monster) => Math.abs(monster.x - this.player.x) < 80)
      || this.ai?.activeBoss();
    const resting = !threatened && !input.left && !input.right && !input.meleeHeld && !input.rangedHeld
      && this.player.isGrounded && Math.abs(this.player.body.velocity.x) < 1;
    tickPassiveRecovery(this.player, delta, resting);
    this._checkEnding();
    refreshHud(this, this.hud, this.player);
    this._syncHud(delta);
  }

  /** 视差背景：按相机横向滚动量推进每一层的 tilePosition */
  _updateParallax(delta = 16) {
    const scrollX = this.cameras.main.scrollX;
    for (const { sprite, factor } of this.parallaxLayers || []) {
      sprite.tilePositionX = scrollX * factor;
    }

    // fx 层（二关雨丝）：横向跟相机，纵向按真实时间下落。
    // 用 delta/1000 而不是每帧固定量，掉帧时雨速不会跟着变慢。
    for (const fx of this.parallaxFx || []) {
      fx.sprite.tilePositionX = scrollX * fx.factor;
      fx.offsetY -= (fx.speedY * delta) / 1000;
      // 落到一个平铺周期外就回卷：画面完全一致，但避免长时间运行后数值越滚越大
      if (fx.tileH && fx.offsetY <= -fx.tileH) fx.offsetY += fx.tileH;
      fx.sprite.tilePositionY = fx.offsetY;
    }
  }

  /** 把相机与玩家数值同步给 E 的 Canvas HUD 并渲染一帧 */
  _syncHud(delta) {
    if (!this.battleHud || !this.player) return;
    const cam = this.cameras.main;
    this.battleHud.setCamera({ x: cam.scrollX, y: cam.scrollY });
    this.battleHud.setPlayer({
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      mp: this.player.mp,
      maxMp: this.player.maxMp,
    });
    if (this.xp) this.battleHud.setXp(this.xp.getHudState());
    this.battleHud.render(Math.min(delta, 50) / 1000);
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
        this.events.emit('checkpoint', cp); // 遥测：激活顺序（issue #26）
        this.player.setSpawnPoint(cp.x, cp.y);
        this.checkpointMarkers.forEach((m, idx) => m.setAlpha(idx <= i ? 1 : 0.55));
        this.cameras.main.flash(120, 255, 215, 106);
        audio.play('checkpoint');
        break;
      }
    }
  }

  _updateEasterEggs() {
    for (const egg of this.easterEggs) {
      if (egg.taken) continue;
      if (Math.abs(this.player.x - egg.x) < 14 && Math.abs(this.player.y - egg.y) < 40) {
        // 纸箱两段式（GDD §4.4）：封条未碎只提示，不触发
        if (egg.id === 'puppy-box' && !egg.smashed) {
          if (!egg.hintedAt || this.time.now - egg.hintedAt > 1600) {
            egg.hintedAt = this.time.now;
            this._toast('纸箱在颤动……用 J 打开封条试试');
          }
          continue;
        }

        egg.taken = true;
        egg.marker.setTint?.(0x88ff88);
        egg.marker.setAlpha(0.45);
        this._openEasterEgg(egg.id);
      }
    }
  }

  /** 彩蛋：先发增益，再弹成员E 的慢动作特写卡片 */
  _openEasterEgg(id) {
    if (id === 'standard-answer') {
      this.player.grantStandardAnswer();
      this._toast('拾取【标准答案】：能量上限 80 · 回能 4/s');
    } else if (id === 'love-letter') {
      // 彩蛋1（issue #16）：情书 → 【怦然心动】近战伤害 +25%
      this.player.grantLoveLetter();
      this._toast('拾取【手写情书】：近战伤害 +25%（怦然心动）');
    } else if (id === 'puppy-box') {
      // 纸箱 → 忠犬入队（写 registry，二/三关自动继承形态）
      this.ai?.onEasterEgg('puppy-box');
    } else if (id === 'thermos') {
      this.game.registry.set('story.thermos', true);
      this.ai?.dog?.setForm('adult');
      this._toast('获得【暖心守护】：随从进化');
    } else if (id === 'wedding-ring') {
      this.game.registry.set('story.weddingRing', true);
      if (this.ai?.dog) {
        this.ai.dog.interceptCd = 0;
        this.ai.dog.nextHealAt = this.time.now;
      }
      this._toast('婚戒的温度提醒你：有人在等你回家。');
    }

    const preset = EGG_BY_ID[id];
    if (!preset) return;

    audio.play('egg');
    EasterEggModal.open({
      ...preset,
      onTick: () => audio.play('typing'),
      onClose: () => audio.play('ui'),
    });
  }

  /** 近战结算入口（issue #16）：打碎可碎物（纸堆/纸箱封条）；小怪结算由 AIManager 链式处理 */
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
    if (this.textures.exists('easter_eggs')) {
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

  _onPlayerDamaged(info) {
    this.events.emit('player:damaged', info); // 遥测 + 打击感屏震（issue #26）
    this.battleHud?.hurtFlash();
    audio.play(info?.result?.blocked ? 'block' : 'hurt');
    this._showDamageText(info);
  }

  _onPlayerDeath() {
    if (this.respawnPending) return;
    this.respawnPending = true;
    this.events.emit('player:died'); // 遥测：死亡计数（issue #26）
    audio.play('death');
    this.cameras.main.shake(180, 0.008);
    this._showDeathOverlay();
    this.time.delayedCall(PHYSICS.respawnDelayMs + 600, () => {
      this._hideDeathOverlay();
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

  _showDeathOverlay() {
    this.deathOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(5000);
    this.deathText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '按 R 复活', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(5001);
  }

  _hideDeathOverlay() {
    this.deathOverlay?.destroy();
    this.deathText?.destroy();
    this.deathOverlay = null;
    this.deathText = null;
  }

  _showVictoryBanner(kind) {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, kind === 'teacher' ? '课程结束' : '雨过天晴', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(6000);
  }

  _buildDemoGuide() {
    const guide = this.add
      .text(10, 44, 'A/D 移动   Space 跳跃   S 格挡\nJ 近战   L 远程   T 切年龄   R 复活', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#d7f5d8',
        lineSpacing: 2,
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 3 },
      })
      .setScrollFactor(0)
      .setDepth(2000);
    this.tweens.add({ targets: guide, alpha: 0, duration: 1200, delay: 6000 });
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

    // AI 战斗反馈监听必须成对解绑：scene.events 在 restart 时不会自动清空
    for (const [evt, fn] of this.aiListeners || []) {
      this.events.off(evt, fn, this);
    }
    this.aiListeners = [];

    this.ai?.destroy();
    this.ai = null;

    // UI / 音频收尾
    window.removeEventListener('egg-modal:open', this._onEggOpen);
    window.removeEventListener('egg-modal:close', this._onEggClose);
    window.removeEventListener('pointerdown', this._unlockAudio);
    window.removeEventListener('keydown', this._unlockAudio);
    EasterEggModal.close();
    this.physics?.world?.resume?.();
    this._hudMount?.destroy();
    this._hudMount = null;
    this.battleHud = null;
    this._stopRain?.();
    this._stopRain = null;
    audio.stopBgm();

    this.inputCtl?.destroy();
    this.inputCtl = null;
    this.bullets = [];
    this.targets = [];
    this.eggHelperBugs = [];
  }
}
