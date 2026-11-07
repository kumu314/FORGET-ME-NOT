import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig.js';

/**
 * 占位像素纹理工厂：成员A/B 的美术资源到位前，用 Graphics 生成纯色瓦片，
 * 保证工程"立即能跑、能演示"，并且换贴图时只需替换纹理 key。
 */
export function ensurePlaceholderTextures(scene) {
  const make = (key, w, h, color, strokeColor = 0x1b1b25) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color, 1).fillRect(0, 0, w, h);
    g.lineStyle(1, strokeColor, 0.45).strokeRect(0.5, 0.5, w - 1, h - 1);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  make('ph_ground', 16, 16, 0x3a4a3f);
  make('ph_desk', 16, 16, 0x6b4b32);
  make('ph_podium', 16, 16, 0x7a5a3a);
  make('ph_beam', 16, 16, 0x8a6a44);
  make('ph_locker', 16, 16, 0x4f5b6b);
  make('ph_printer', 16, 16, 0x5a6470);
  make('ph_duct', 16, 16, 0x66707c);
  make('ph_checkpoint', 6, 22, 0xffd76a);
  make('ph_easter', 10, 10, 0xffb347);
  // 桌洞纸堆打碎后露出的手写情书（issue #16 彩蛋1）：粉色信封占位，正式贴图同名覆盖即可
  const letter = scene.make.graphics({ x: 0, y: 0, add: false });
  letter.fillStyle(0xf5a8b8, 1).fillRect(0, 0, 10, 8);
  letter.lineStyle(1, 0xc96f84, 1).strokeRect(0.5, 0.5, 9, 7);
  letter.lineBetween(0, 0, 5, 4);
  letter.lineBetween(10, 0, 5, 4);
  letter.generateTexture('ph_letter', 10, 8);
  letter.destroy();
}

/** 纹理 key → 显示颜色（台阶细线淡一点） */
export const SOLID_TEXTURE = {
  ground: 'ph_ground',
  desk: 'ph_desk',
  podium: 'ph_podium',
  beam: 'ph_beam',
  locker: 'ph_locker',
  printer: 'ph_printer',
  duct: 'ph_duct',
};

/** 各关视差背景（成员 B parallax.json；贴图未加载时回退纯色底） */
export const PHASE_PARALLAX = Object.freeze({
  youth: { set: 'stage1_indoor', scroll: { sky: 0.1, far: 0.3, near: 0.85 } },
  middle: { set: 'stage2_night', scroll: { sky: 0.1, far: 0.3, near: 0.85 } },
  elder: { set: 'stage3_sunset', scroll: { sky: 0.1, far: 0.3, near: 0.85 } },
});

/**
 * 视差背景：sky/far 铺在墙带之上（走廊顶部透空带），near（ alpha 光柱）叠在瓦片上。
 * 贴图 320×180 → tileScale 1.5 精确放大到 480×270；滚动由 StageScene 每帧回写 tilePositionX。
 */
export function createBackground(scene, tint, label) {
  const cfg = PHASE_PARALLAX[scene.phaseId] ?? PHASE_PARALLAX.youth;
  const layers = [];
  if (scene.textures.exists(`${cfg.set}_sky`)) {
    const push = (suffix, depth, factor, alpha = 1) => {
      const ts = scene.add
        .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, `${cfg.set}_${suffix}`)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(depth)
        .setAlpha(alpha);
      ts.setTileScale(1.5, 1.5);
      layers.push({ ts, factor });
    };
    push('sky', -100, cfg.scroll.sky);
    push('far', -95, cfg.scroll.far);
    push('near', 15, cfg.scroll.near, 0.55); // 光柱叠在瓦片与角色之间
  }

  // 兜底纯色底（图集缺失/单测环境）：保持原有暖色调不穿帮
  const bg = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, tint).setOrigin(0, 0).setScrollFactor(0);
  bg.setDepth(-100);
  if (layers.length) bg.setDepth(-110);

  return { bg, layers };
}

export function createHud(scene) {
  const style = {
    fontFamily: 'monospace',
    fontSize: '9px',
    color: '#ffffff',
  };
  // 底部操作提示：半透明压暗条，保证叠在深色地面/亮色走廊上都读得清
  const hintBg = scene.add
    .rectangle(0, GAME_HEIGHT - 14, GAME_WIDTH, 14, 0x000000, 0.55)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(1000);

  const hud = {
    hpBg: scene.add.rectangle(8, 8, 82, 6, 0x222222).setOrigin(0, 0).setScrollFactor(0).setDepth(1000),
    hpBar: scene.add.rectangle(9, 9, 80, 4, 0xd64545).setOrigin(0, 0).setScrollFactor(0).setDepth(1001),
    mpBg: scene.add.rectangle(8, 17, 82, 6, 0x222222).setOrigin(0, 0).setScrollFactor(0).setDepth(1000),
    mpBar: scene.add.rectangle(9, 18, 80, 4, 0x4a9df0).setOrigin(0, 0).setScrollFactor(0).setDepth(1001),
    phaseText: scene.add.text(96, 6, '', style).setScrollFactor(0).setDepth(1001),
    hintBg,
    hintText: scene.add
      .text(6, GAME_HEIGHT - 12, 'A/D移动  Space跳跃  S格挡  J近战  L远程  T切换年龄  R复活', {
        ...style,
        fontSize: '8px',
        color: '#cfd6e0',
      })
      .setScrollFactor(0)
      .setDepth(1001),
  };
  return hud;
}

/** 根据玩家状态刷新 HUD（成员E 的 BattleHUD 上线后由对方接管） */
export function refreshHud(scene, hud, player) {
  const hpRatio = Phaser.Math.Clamp(player.hp / player.maxHp, 0, 1);
  const mpRatio = Phaser.Math.Clamp(player.mp / player.maxMp, 0, 1);
  hud.hpBar.width = Math.max(0, 80 * hpRatio);
  hud.mpBar.width = Math.max(0, 80 * mpRatio);
  // 彩蛋 Buff 徽标（issue #16）：怦然心动 / 标准答案
  const buffs = [
    player.loveLetter ? '【心动】' : '',
    player.standardAnswer ? '【答案】' : '',
  ].join('');
  hud.phaseText.setText(
    `${player.phase.label}${buffs}  HP ${Math.ceil(player.hp)}/${player.maxHp}  MP ${Math.floor(player.mp)}/${player.maxMp}` +
      `  ${player.phase.canJump ? '[可跳跃]' : '[无法跳跃]'}`,
  );
}
