import { MONSTERS } from '../config/aiConfig.js';

/**
 * 小怪像素图集（成员D · 资产批次）
 *
 * 为什么单独一个模块、而不塞进 spriteAtlases.js：
 *   A 的 manifest 只管主角/忠犬/Boss/弹道四类，小怪不在其契约里；
 *   单独走 spritesheet 就不会污染 A 的 manifest 结构，也不会与 #46 之后的视差改造互相牵扯。
 *
 * 与占位纹理的关系：
 *   AIManager.ensurePlaceholderTextures() 每张纹理都有 `textures.exists(key)` 守卫，
 *   只要本模块在 BootScene.preload 阶段把同名 key 注册好，占位色块会自动让位；
 *   若某个 png 缺失（404），该 key 不存在，占位纹理照常兜底——不会白屏。
 *
 * 图集规格：每只 2 帧横排（帧 0 = 常态，帧 1 = 呼吸/摆动相位），
 * 帧尺寸直接取 aiConfig.MONSTERS[x].placeholder 的 w/h，
 * 因为 MonsterFSM 用 `this.width/height` 计算 body.setOffset，尺寸必须与配置严格一致。
 */
export const MONSTER_SPRITE_PATH = 'assets/sprites/monsters/';

export const MONSTER_SHEETS = Object.freeze(
  Object.fromEntries(
    Object.values(MONSTERS).map((def) => [def.texture, Object.freeze({ w: def.placeholder.w, h: def.placeholder.h })]),
  ),
);

/** 逐只登记 spritesheet：纹理 key 与 aiConfig.MONSTERS[x].texture 完全同名。 */
export function preloadMonsterSprites(loader) {
  for (const [key, size] of Object.entries(MONSTER_SHEETS)) {
    loader.spritesheet(key, `${MONSTER_SPRITE_PATH}${key}.png`, { frameWidth: size.w, frameHeight: size.h });
  }
}

/** 两帧轻微呼吸循环；占位纹理没有数字帧，保持静态回退。 */
export const monsterBreathKey = (texture) => `${texture}:breathe`;

export function registerMonsterAnimations(scene) {
  for (const texture of Object.keys(MONSTER_SHEETS)) {
    const sheet = scene.textures.exists(texture) && scene.textures.get(texture);
    if (!sheet || !sheet.has(0) || !sheet.has(1)) continue;
    const key = monsterBreathKey(texture);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: [{ key: texture, frame: 0 }, { key: texture, frame: 1 }],
      frameRate: 3,
      repeat: -1,
    });
  }
}
