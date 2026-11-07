import Phaser from 'phaser';
import { ensurePlaceholderTextures, PARALLAX_SETS } from './sceneHelpers.js';
import { preloadSpriteAtlases, registerSpriteAnimations } from './spriteAtlases.js';

/**
 * 资源预加载（BootScene）
 * 角色、Boss、随从与弹道的首批图集走 manifest；B 的视差背景按关卡分层预载。
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    preloadSpriteAtlases(this.load);

    // 成员B 的视差层：三关各 4 层，键名 par_<prefix>_<layer>（与 PARALLAX_SETS 对应）
    for (const { prefix, layers } of Object.values(PARALLAX_SETS)) {
      for (const [layer] of layers) {
        this.load.image(`par_${prefix}_${layer}`, `assets/parallax/${prefix}_${layer}.png`);
      }
    }

    this.load.on('loaderror', (file) => {
      console.warn(`[boot] 资源加载失败 ${file.key}: ${file.src ?? 'unknown source'}`);
    });
  }

  create() {
    ensurePlaceholderTextures(this);
    registerSpriteAnimations(this);
    this.scene.start('StageScene', { phase: 'youth' });
  }
}
