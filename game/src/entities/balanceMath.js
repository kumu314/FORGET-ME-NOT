import { COMBAT, LIFECYCLE, MELEE_CHAIN, PHYSICS, RANGED_COOLDOWN, RANGED_COST } from '../config/gameConfig.js';
import { computeMoveSpeed, computeMpCap, computeMpRegen, resolveIncomingDamage } from './combatMath.js';

export function rangedResourceEnvelope(phaseId, overrides = {}) {
  const phase = LIFECYCLE[phaseId];
  if (!phase) throw new Error('Unknown phase: ' + phaseId);
  const mpCap = overrides.mpCap ?? computeMpCap(phase, overrides);
  const regenPerSecond = overrides.regenPerSecond ?? computeMpRegen(phase, overrides);
  const cost = overrides.cost ?? RANGED_COST[phaseId];
  const cooldownMs = overrides.cooldownMs ?? RANGED_COOLDOWN[phaseId];
  for (const [key, value] of Object.entries({ mpCap, regenPerSecond, cost, cooldownMs })) {
    if (!Number.isFinite(value) || value < 0 || (['cost', 'cooldownMs'].includes(key) && value === 0)) {
      throw new RangeError('Invalid ' + key + ': ' + value);
    }
  }
  const cooldownShotsPerSecond = 1000 / cooldownMs;
  const supplyShotsPerSecond = regenPerSecond / cost;
  const netDrainPerSecond = Math.max(0, cost * cooldownShotsPerSecond - regenPerSecond);
  return {
    mpCap, regenPerSecond, cost, cooldownMs, cooldownShotsPerSecond,
    sustainableShotsPerSecond: Math.min(cooldownShotsPerSecond, supplyShotsPerSecond),
    cooldownUptime: Math.min(1, supplyShotsPerSecond / cooldownShotsPerSecond),
    maximumSustainableCost: regenPerSecond / cooldownShotsPerSecond,
    netDrainPerSecond,
    continuousDrainSeconds: netDrainPerSecond > 0 ? mpCap / netDrainPerSecond : null,
  };
}

export function stagePacingEnvelope(phaseId, { worldWidth, spawnX }) {
  const phase = LIFECYCLE[phaseId];
  if (!phase) throw new Error('Unknown phase: ' + phaseId);
  const groundSpeed = computeMoveSpeed(PHYSICS.walkSpeed, phase, true);
  const chain = MELEE_CHAIN[phaseId];
  return {
    groundSpeed,
    unobstructedTraversalSeconds: (worldWidth - spawnX) / groundSpeed,
    idealMeleeChainDps: chain.damage.reduce((sum, damage) => sum + damage, 0)
      / (chain.recover.reduce((sum, duration) => sum + duration, 0) / 1000),
  };
}

export function blockCadenceEnvelope(rawDamage, blockedInvulnMs) {
  if (!Number.isFinite(rawDamage) || rawDamage <= 0
      || !Number.isFinite(blockedInvulnMs) || blockedInvulnMs <= 0) {
    throw new RangeError('Damage and blocked invulnerability must be positive finite numbers');
  }
  const ordinary = resolveIncomingDamage(rawDamage, {
    blockHeld: true,
    blockHeldForMs: COMBAT.perfectBlockWindowMs + 1,
  }).damage;
  return {
    rawDamage,
    ordinaryBlockedDamage: ordinary,
    unblockedInvulnMs: PHYSICS.invulnMs,
    blockedInvulnMs,
    continuousUnblockedDps: rawDamage * 1000 / PHYSICS.invulnMs,
    continuousBlockedDps: ordinary * 1000 / blockedInvulnMs,
    minimumBlockedInvulnForEqualDpsMs: PHYSICS.invulnMs * ordinary / rawDamage,
  };
}
