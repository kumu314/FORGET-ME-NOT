import Phaser from 'phaser';
import { ensurePlaceholderTextures } from './sceneHelpers.js';
import { preloadSpriteAtlases, registerSpriteAnimations } from './spriteAtlases.js';

/**
 * 资源预加载（BootScene）
 * 角色、Boss、随从与弹道的首批图集统一从 manifest/atlas 加载；B/E 资源继续走占位。
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    preloadSpriteAtlases(this.load);
    this.load.on('loaderror', (file) => {
      console.warn(`[sprites] failed to load ${file.key}: ${file.src ?? 'unknown source'}`);
    });
  }

  create() {
    ensurePlaceholderTextures(this);
    registerSpriteAnimations(this);
    this.scene.start('StageScene', { phase: 'youth' });
  }
}
