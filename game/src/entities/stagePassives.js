import { computeMpCap } from './combatMath.js';

export const PASSIVE_KEY = 'stage.passives';
export const STAGE_PASSIVES = Object.freeze({
  unreadDot: '已读不回',
  overtimeGhost: '咖啡因耐受',
  requirementVortex: '摸鱼回血',
});

export function reduceAreaDamage(damage, source, skills) {
  return skills.has('unreadDot') && ['unreadDot', 'aoe', 'shockwave'].includes(source)
    ? damage * 0.7 : damage;
}

export function grantStagePassive(player, registry, type) {
  if (!STAGE_PASSIVES[type]) return false;
  const skills = new Set(registry.get(PASSIVE_KEY) ?? []);
  const fresh = !skills.has(type);
  skills.add(type);
  registry.set(PASSIVE_KEY, [...skills]);
  player.stagePassives = skills;
  syncPassiveMpCap(player);
  return fresh;
}

export function syncPassiveMpCap(player) {
  if (!player.stagePassives?.has('overtimeGhost')) return;
  player.maxMp = computeMpCap(player.phase, { standardAnswer: player.standardAnswer }) + 20;
  player.mp = Math.min(player.mp, player.maxMp);
}

export function installStagePassives(player, registry, now = () => 0) {
  player.stagePassives = new Set(registry.get(PASSIVE_KEY) ?? []);
  syncPassiveMpCap(player);
  player.passiveRestMs = 0;
  player.applySlow = (mult, seconds) => {
    player.stageSlowMult = mult;
    player.stageSlowUntil = now() + seconds * 1000;
  };
  const takeDamage = player.takeDamage.bind(player);
  player.takeDamage = (damage, opts = {}) => {
    player.passiveRestMs = 0;
    player.passiveLastHitAt = now();
    return takeDamage(reduceAreaDamage(damage, opts.source, player.stagePassives), opts);
  };
}

export function tickPassiveRecovery(player, delta, resting) {
  syncPassiveMpCap(player);
  if (player.isDead || !player.stagePassives?.has('requirementVortex') || !resting) {
    player.passiveRestMs = 0;
    return 0;
  }
  const previous = player.passiveRestMs ?? 0;
  player.passiveRestMs = previous + delta;
  const healingMs = Math.max(0, player.passiveRestMs - 2000) - Math.max(0, previous - 2000);
  const healed = Math.min(player.maxHp - player.hp, healingMs * 3 / 1000);
  player.hp += healed;
  return healed;
}
