import Phaser from 'phaser';
import { ensurePlaceholderTextures } from './sceneHelpers.js';

/**
 * 资源预加载（BootScene）
 * 成员A/B/E 的正式资源按设计文档目录放入 public/assets 后，在这里 load。
 * 当前资源尚未入库，全部走 sceneHelpers 的占位纹理，保证工程可运行。
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // 例：this.load.spritesheet('player_youth', 'assets/sprites/player_youth.png', {...})
    // 现在不做任何网络加载，避免 404 噪音。
  }

  create() {
    ensurePlaceholderTextures(this);
    this.scene.start('StageScene', { phase: 'youth' });
  }
}
