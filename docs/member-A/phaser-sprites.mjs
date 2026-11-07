// Optional integration helpers. No dependency on a gameplay scene or entity class.
// Vite callers should pass `${import.meta.env.BASE_URL}assets/sprites/`.
export const characterAssetIds = Object.freeze([
  'player_youth', 'player_middle', 'player_elder',
  'dog_puppy', 'dog_adult', 'dog_elder',
  'boss_teacher', 'boss_employer', 'boss_child', 'projectiles',
]);

export function preloadCharacterAtlases(scene, assetBase = 'assets/sprites/') {
  const base = assetBase.endsWith('/') ? assetBase : `${assetBase}/`;
  for (const id of characterAssetIds) {
    scene.load.atlas(id, `${base}${id}.png`, `${base}${id}.json`);
    // Phaser consumes the texture metadata; retain custom animation metadata too.
    scene.load.json(`${id}:spec`, `${base}${id}.json`);
  }
}

export function createCharacterAnimations(scene) {
  let created = 0;
  for (const id of characterAssetIds) {
    const spec = scene.cache.json.get(`${id}:spec`);
    if (!spec?.game?.animations || !scene.textures.exists(id)) {
      throw new Error(`Character atlas not loaded: ${id}`);
    }
    for (const [name, clip] of Object.entries(spec.game.animations)) {
      const key = `${id}:${name}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: clip.frames.map(frame => ({ key: id, frame })),
        frameRate: clip.frameRate,
        repeat: clip.repeat,
      });
      created++;
    }
  }
  return created;
}
