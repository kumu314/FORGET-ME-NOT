import { LIFE_PHASES } from '../config/gameConfig.js';

export const SPRITE_BASE_PATH = 'assets/sprites/';
export const SPRITE_MANIFEST_KEY = 'sprite-manifest';
export const PLAYER_ATLAS_IDS = Object.freeze(LIFE_PHASES.map((phaseId) => `player_${phaseId}`));
export const PROJECTILE_ATLAS_ID = 'projectiles';
export const PROJECTILE_FRAME_SIZE = 16;
export const SPRITE_ATLAS_IDS = Object.freeze([
  ...PLAYER_ATLAS_IDS, PROJECTILE_ATLAS_ID,
  'dog_puppy', 'dog_adult', 'dog_elder', 'boss_teacher', 'boss_employer', 'boss_child',
]);

const specKey = (atlasId) => `${atlasId}:spec`;
const animationKey = (atlasId, animationName) => `${atlasId}:${animationName}`;

/** Queue the current P0 sprite atlases and their animation specs. */
export function preloadSpriteAtlases(loader) {
  loader.json(SPRITE_MANIFEST_KEY, `${SPRITE_BASE_PATH}manifest.json`);
  for (const atlasId of SPRITE_ATLAS_IDS) {
    loader.atlas(atlasId, `${SPRITE_BASE_PATH}${atlasId}.png`, `${SPRITE_BASE_PATH}${atlasId}.json`);
    loader.json(specKey(atlasId), `${SPRITE_BASE_PATH}${atlasId}.json`);
  }
}

/** Register every animation advertised by a loaded atlas. */
export function registerSpriteAnimations(scene) {
  const manifest = scene.cache.json.get(SPRITE_MANIFEST_KEY);
  if (!manifest?.assets?.length) {
    console.warn('[sprites] manifest missing; sprite animations disabled');
    return;
  }

  for (const asset of manifest.assets) {
    if (!SPRITE_ATLAS_IDS.includes(asset.id) || !scene.textures.exists(asset.id)) continue;
    const spec = scene.cache.json.get(specKey(asset.id));
    const animations = spec?.game?.animations;
    if (!animations) {
      console.warn(`[sprites] ${asset.id} has no animation spec`);
      continue;
    }

    for (const [name, animation] of Object.entries(animations)) {
      const key = animationKey(asset.id, name);
      if (scene.anims.exists(key)) continue;
      const frames = (animation.frames ?? []).map((frame) => ({ key: asset.id, frame }));
      if (!frames.length) continue;
      scene.anims.create({
        key,
        frames,
        frameRate: Number(animation.frameRate) || 10,
        repeat: animation.repeat ?? 0,
      });
    }
  }
}

export function getManifestAsset(scene, atlasId) {
  const manifest = scene.cache.json.get(SPRITE_MANIFEST_KEY);
  return manifest?.assets?.find((asset) => asset.id === atlasId) ?? null;
}

export function hasManifestAnimation(scene, atlasId, animationName) {
  return Boolean(getManifestAsset(scene, atlasId)?.animationNames?.includes(animationName));
}

export function hasReadyAnimation(scene, atlasId, animationName) {
  return (
    scene.textures.exists(atlasId) &&
    hasManifestAnimation(scene, atlasId, animationName) &&
    scene.anims.exists(animationKey(atlasId, animationName))
  );
}

export function getAnimationKey(atlasId, animationName) {
  return animationKey(atlasId, animationName);
}

export function getPlayerAtlasId(phaseId) {
  return `player_${phaseId}`;
}
