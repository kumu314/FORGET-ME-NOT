import Phaser from 'phaser';
import { ensurePlaceholderTextures, PARALLAX_SETS } from './sceneHelpers.js';
import { preloadSpriteAtlases, registerSpriteAnimations } from './spriteAtlases.js';
import { preloadMonsterSprites, registerMonsterAnimations } from './monsterSprites.js';

/** 成员B 的场景瓦片图集（issue #16：第一关瓦片上墙） */
const TILESET_ATLASES = ['school_corridor', 'school_props', 'easter_eggs'];

/**
 * 资源预加载（BootScene）
 * 角色、Boss、随从与弹道的首批图集走 manifest；B 的视差背景按关卡分层预载；
 * 场景瓦片图集供 StageScene 数据驱动拼装第一关地图。
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    preloadSpriteAtlases(this.load);

    // 成员D 的小怪像素图集：纹理 key 与 aiConfig.MONSTERS[x].texture 同名，
    // 先于 create() 里的 ensurePlaceholderTextures 注册，占位色块会自动让位；缺失时仍回退占位。
    preloadMonsterSprites(this.load);

    // 成员B 的场景瓦片图集（school_corridor / school_props / easter_eggs）
    for (const key of TILESET_ATLASES) {
      this.load.atlas(key, `assets/tilesets/${key}.png`, `assets/tilesets/${key}.json`);
    }

    // 成员B 的视差层：三关各 4 层，键名 par_<prefix>_<layer>（与 PARALLAX_SETS 对应）
    for (const { prefix, layers } of Object.values(PARALLAX_SETS)) {
      for (const [layer] of layers) {
        this.load.image(`par_${prefix}_${layer}`, `assets/parallax/${prefix}_${layer}.png`);
      }
    }

    // fx 叠加层（二关雨丝）：文件名不跟 `prefix_layer` 规约走，按 file 字段单独加载
    for (const { fx } of Object.values(PARALLAX_SETS)) {
      for (const f of fx ?? []) {
        this.load.image(`par_${f.file}`, `assets/parallax/${f.file}.png`);
      }
    }

    this.load.on('loaderror', (file) => {
      console.warn(`[boot] 资源加载失败 ${file.key}: ${file.src ?? 'unknown source'}`);
    });
  }

  create() {
    ensurePlaceholderTextures(this);
    registerSpriteAnimations(this);
    registerMonsterAnimations(this);
    this.scene.start('StageScene', { phase: 'youth' });
  }
}
