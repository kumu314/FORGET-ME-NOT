import { computeMpCap } from './combatMath.js';

export const PASSIVE_KEY = 'stage.passives';
export const STAGE_PASSIVES = Object.freeze({
  paperSpirit: '举一反三',
  sleepBug: '风油精提神',
  inspector: '广播体操',
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
  syncYouthPassives(player);
  syncPassiveMpCap(player);
  return fresh;
}

export function syncPassiveMpCap(player) {
  if (!player.stagePassives?.has('overtimeGhost')) return;
  player.maxMp = computeMpCap(player.phase, { standardAnswer: player.standardAnswer }) + 20;
  player.mp = Math.min(player.mp, player.maxMp);
}

function syncYouthPassives(player) {
  player.broadcastExercise = player.stagePassives.has('inspector');
  player.passiveMoveMult = player.stagePassives.has('sleepBug') ? 1.15 : 1;
  player.passiveStatusDurationMult = player.stagePassives.has('sleepBug') ? 0.5 : 1;
}

/** Only kills made with melee can trigger 举一反三; dropping it is not a retroactive proc. */
export function recoverMeleeKillMp(player, info, random = Math.random) {
  if (player.isDead || !STAGE_PASSIVES[info.type] || !info.isMelee || !player.stagePassives?.has('paperSpirit') || random() >= 0.25) return 0;
  const gained = Math.max(0, Math.min(5, player.maxMp - player.mp));
  player.mp += gained;
  return gained;
}

export function installStagePassives(player, registry, now = () => 0) {
  player.stagePassives = new Set(registry.get(PASSIVE_KEY) ?? []);
  syncYouthPassives(player);
  syncPassiveMpCap(player);
  player.passiveRestMs = 0;
  player.applySlow = (mult, seconds) => {
    player.stageSlowMult = mult;
    player.stageSlowUntil = now() + seconds * 1000 * player.passiveStatusDurationMult;
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
