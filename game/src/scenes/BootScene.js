import Phaser from 'phaser';
import { ensurePlaceholderTextures } from './sceneHelpers.js';
import { preloadSpriteAtlases, registerSpriteAnimations } from './spriteAtlases.js';

/** 成员 B 的场景图集与视差贴图（issue #16：第一关瓦片上墙；二三关视差一并加载） */
const TILESET_ATLASES = ['school_corridor', 'school_props', 'easter_eggs'];
const PARALLAX_SETS = ['stage1_indoor', 'stage2_night', 'stage3_sunset'];
const PARALLAX_LAYERS = ['sky', 'far', 'near'];

/**
 * 资源预加载（BootScene）
 * 角色、Boss、随从与弹道的首批图集统一从 manifest/atlas 加载；B 的瓦片/视差从 tilesets 与 parallax 加载。
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    preloadSpriteAtlases(this.load);

    for (const key of TILESET_ATLASES) {
      this.load.atlas(key, `assets/tilesets/${key}.png`, `assets/tilesets/${key}.json`);
    }
    for (const set of PARALLAX_SETS) {
      for (const layer of PARALLAX_LAYERS) {
        this.load.image(`${set}_${layer}`, `assets/parallax/${set}_${layer}.png`);
      }
    }

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
