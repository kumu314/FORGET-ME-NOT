import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/gameConfig.js';
import BootScene from './scenes/BootScene.js';
import StageScene from './scenes/StageScene.js';
import EndingScene from './scenes/EndingScene.js';
import { mountAudioControls } from './ui/AudioControls.js';

/**
 * Phaser.Game 配置与初始化入口
 *
 * 关键渲染约定（设计文档 §1.1）：
 *  - WebGL 优先，降级 Canvas
 *  - pixelArt: true → 最近邻采样，杜绝像素边缘模糊
 *  - 逻辑原生分辨率 480×270，FIT 整体缩放并按整数倍对齐
 */
const config = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0b0b10',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  render: {
    pixelArt: true,
    antialias: false,
  },
  physics: {
    default: 'arcade',
    arcade: {
      // 世界重力交给 Player 自身的 gravityY：老年"禁跳"必须能完全关掉离地
      gravity: { y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  fps: { target: 60 },
};

/** 创建游戏实例（供入口与调试复用） */
export function createGame() {
  return new Phaser.Game({ ...config, scene: [BootScene, StageScene, EndingScene] });
}

// 挂载到 window 便于 CI/调试时用脚本取状态与截图
const game = createGame();
const audioControls = mountAudioControls();
game.events.once('destroy', () => audioControls.destroy());
if (typeof window !== 'undefined') {
  window.__FORGET_ME_NOT__ = game;
}

export default game;
