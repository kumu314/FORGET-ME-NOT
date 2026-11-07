/**
 * 动画键安全播放（成员D）
 *
 * 对齐 docs/animation-contract.md 的唯一约定：
 *   - 动画键格式为 `图集键:动作`（如 dog_puppy:run / boss_teacher:sweep）
 *   - 朝向统一朝右，左向只做 setFlipX
 *   - 键不存在时回退到 `${图集键}:idle` 并 console.warn，绝不抛错
 *   - 代码里不出现任何硬编码帧号
 */

const warned = new Set();

/**
 * 播放动画；返回实际使用的动画键（便于测试断言）。
 * @param {Phaser.GameObjects.Sprite} sprite
 * @param {string} atlas 图集 / 纹理键，例如 'dog_puppy'
 * @param {string} action 动作名，例如 'run'
 * @returns {string}
 */
export function playAnim(sprite, atlas, action) {
  const want = `${atlas}:${action}`;
  const idle = `${atlas}:idle`;
  const anims = sprite.scene?.anims;
  if (!anims) return want;

  if (anims.exists(want)) {
    sprite.play(want, true);
    return want;
  }
  if (!warned.has(want)) {
    warned.add(want);
    console.warn(`[AI] 缺少动画键 ${want}，按契约回退 ${idle}`);
  }
  if (anims.exists(idle)) sprite.play(idle, true);
  return idle;
}

/** 正式纹理是否已加载（用于跳过占位纹理生成） */
export function hasTexture(scene, key) {
  return scene.textures.exists(key);
}
