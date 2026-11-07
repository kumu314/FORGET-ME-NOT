import Phaser from 'phaser';
import { ensurePlaceholderTextures, PARALLAX_SETS } from './sceneHelpers.js';
import { preloadSpriteAtlases, registerSpriteAnimations } from './spriteAtlases.js';
import { preloadMonsterSprites, registerMonsterAnimations } from './monsterSprites.js';

/** 成员B 的场景瓦片图集（issue #16：第一关瓦片上墙） */
const TILESET_ATLASES = ['school_corridor', 'school_props', 'easter_eggs', 'office_rain', 'office_props', 'home_autumn', 'courtyard_props'];

/** 像素字体候选（存在任意一个即视为像素字体可用） */
export const PIXEL_FONT_FAMILIES = ['"Zpix"', '"Fusion Pixel"', '"Ark Pixel"'];

/** 像素字体缺失时的安全回退栈：黑体优先，避免中文回退成宋体导致观感断裂 */
export const FONT_FALLBACK_STACK = '"Microsoft YaHei", "SimHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';

/**
 * 探测像素字体是否可用。纯函数，便于单测（不依赖真实 document）。
 * @param {Document} doc
 * @returns {boolean}
 */
export function detectPixelFont(doc = (typeof document !== 'undefined' ? document : undefined)) {
  const fonts = doc && doc.fonts;
  if (!fonts || typeof fonts.check !== 'function') return false;
  try {
    return PIXEL_FONT_FAMILIES.some((family) => fonts.check(`12px ${family}`));
  } catch {
    return false;
  }
}

/**
 * 字体兜底：像素字体不可用时，向页面注入安全字体栈（CSS 变量）并给出告警。
 * 只做探测与回退，不修改任何资源路径或 manifest。
 * @returns {{ok: boolean, stack: string|null}}
 */
export function applyFontFallback(
  doc = (typeof document !== 'undefined' ? document : undefined),
  warn = console.warn,
) {
  if (detectPixelFont(doc)) return { ok: true, stack: null };
  warn(`[boot] 像素字体不可用，回退安全字体栈（黑体优先）：${FONT_FALLBACK_STACK}`);
  if (doc && doc.documentElement && doc.documentElement.style && typeof doc.documentElement.style.setProperty === 'function') {
    doc.documentElement.style.setProperty('--fmn-font-family', FONT_FALLBACK_STACK);
  }
  if (typeof window !== 'undefined') window.__FMN_FONT_STACK__ = FONT_FALLBACK_STACK;
  return { ok: false, stack: FONT_FALLBACK_STACK };
}

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

    // 字体探测（preload 末尾）：像素字体缺失时设置安全回退栈，HUD 文本读取全局栈
    applyFontFallback(typeof document !== 'undefined' ? document : undefined);
  }

  create() {
    ensurePlaceholderTextures(this);
    registerSpriteAnimations(this);
    registerMonsterAnimations(this);
    this.scene.start('StageScene', { phase: 'youth' });
  }
}
