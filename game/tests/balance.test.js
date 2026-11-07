import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: { Physics: { Arcade: { Sprite: class {} } }, Geom: {}, Math: {} },
}));

import Player from '../src/entities/Player.js';
import { COMBAT, LIFECYCLE, PHYSICS, RANGED_COOLDOWN, RANGED_COST } from '../src/config/gameConfig.js';
import { blockCadenceEnvelope, rangedResourceEnvelope, stagePacingEnvelope } from '../src/entities/balanceMath.js';

function resourceFixture(phaseId) {
  return {
    phaseId,
    phase: LIFECYCLE[phaseId],
    mp: LIFECYCLE[phaseId].mp,
    maxMp: LIFECYCLE[phaseId].mp,
    standardAnswer: false,
    rangedCooldownMs: 0,
    hurtLockMs: 0,
    isBlocking: false,
    isGrounded: true,
    invulnMs: 0,
    jumpBufferMs: 0,
    rangedActionMs: 0,
    coughMs: 0,
    comboSinceActiveMs: 0,
    facing: 1,
    x: 0,
    y: 240,
    setAlpha() {},
    eventsHooks: {},
  };
}

function fireFor(phaseId, durationMs = 60000) {
  const player = resourceFixture(phaseId);
  const firedAt = [];
  let now = 0;
  player.eventsHooks.onRangedFire = () => firedAt.push(now);
  for (now = 0; now < durationMs; now += 20) {
    Player.prototype._tickTimers.call(player, 20);
    Player.prototype._tickMp.call(player, 20);
    Player.prototype._handleRanged.call(player, { rangedHeld: true });
  }
  return { player, firedAt };
}

describe('configuration arithmetic, not playtest acceptance', () => {
  it('shows elder burst versus sustained supply without changing 12 MP/s', () => {
    const current = rangedResourceEnvelope('elder', { cost: 10 });
    expect(current.cooldownShotsPerSecond).toBeCloseTo(1000 / 260);
    expect(current.sustainableShotsPerSecond).toBe(1.2);
    expect(current.cooldownUptime).toBeCloseTo(0.312);
    expect(current.maximumSustainableCost).toBeCloseTo(3.12);
    expect(rangedResourceEnvelope('elder', { cost: 3 }).cooldownUptime).toBe(1);
    expect(LIFECYCLE.elder.mpRegen).toBe(12);
  });

  it('reads standard-answer cap/regen through production combatMath', () => {
    const buff = rangedResourceEnvelope('youth', { standardAnswer: true });
    expect(buff.mpCap).toBe(80);
    expect(buff.regenPerSecond).toBe(4);
    expect(() => rangedResourceEnvelope('unknown')).toThrow();
    expect(() => rangedResourceEnvelope('elder', { cost: 0 })).toThrow();
    expect(() => rangedResourceEnvelope('elder', { regenPerSecond: -1 })).toThrow();
  });

  it('labels obstacle-free traversal separately from clear duration', () => {
    const pacing = stagePacingEnvelope('elder', { worldWidth: 1600, spawnX: 48 });
    expect(pacing.groundSpeed).toBe(76);
    expect(pacing.unobstructedTraversalSeconds).toBeCloseTo(1552 / 76);
    expect(pacing.idealMeleeChainDps).toBeCloseTo(28 / 0.82);
  });
});

describe('real Player resource methods with mocked Phaser, fixed 20 ms steps', () => {
  it.each(['youth', 'middle', 'elder'])(
    '%s: held-input output respects the configured resource and cooldown ceilings',
    (phaseId) => {
      const { player, firedAt } = fireFor(phaseId);
      const phase = LIFECYCLE[phaseId];
      const supplyCeiling = Math.floor((phase.mp + phase.mpRegen * 59.98) / RANGED_COST[phaseId]);
      const frameCooldown = Math.ceil(RANGED_COOLDOWN[phaseId] / 20) * 20;
      const expectedShots = Math.min(supplyCeiling, Math.ceil(60000 / frameCooldown));
      expect(firedAt).toHaveLength(expectedShots);
      for (let index = 1; index < firedAt.length; index += 1) {
        expect(firedAt[index] - firedAt[index - 1]).toBeGreaterThanOrEqual(RANGED_COOLDOWN[phaseId]);
      }
      expect(player.mp).toBeGreaterThanOrEqual(0);
      expect(player.mp).toBeLessThanOrEqual(player.maxMp);
    },
  );

  it('configured elder cost sustains real held casting at 260 ms with 12 MP/s', () => {
    expect(LIFECYCLE.elder.mp).toBe(200);
    expect(LIFECYCLE.elder.mpRegen).toBe(12);
    expect(RANGED_COST.elder).toBe(3);
    expect(RANGED_COOLDOWN.elder).toBe(260);
    const { player, firedAt } = fireFor('elder');
    expect(firedAt).toHaveLength(231);
    expect(player.mp).toBeGreaterThanOrEqual(197);
    for (let index = 1; index < firedAt.length; index += 1) {
      expect(firedAt[index] - firedAt[index - 1]).toBe(260);
    }
  });

  it('cannot cast during block or hurt; release resumes with available MP', () => {
    const player = resourceFixture('elder');
    const fire = vi.fn();
    player.eventsHooks.onRangedFire = fire;
    player.isBlocking = true;
    Player.prototype._handleRanged.call(player, { rangedHeld: true });
    player.isBlocking = false;
    player.hurtLockMs = 1;
    Player.prototype._handleRanged.call(player, { rangedHeld: true });
    expect(fire).not.toHaveBeenCalled();
    expect(player.mp).toBe(player.maxMp);
    player.hurtLockMs = 0;
    Player.prototype._handleRanged.call(player, { rangedHeld: true });
    expect(fire).toHaveBeenCalledTimes(1);
    expect(player.mp).toBe(player.maxMp - RANGED_COST.elder);
  });
});

describe('dense-hit diagnostic: real Player.takeDamage, not an AI win-rate model', () => {
  function incomingHits(blocking) {
    const player = {
      ...resourceFixture('youth'),
      hp: 100000,
      isDead: false,
      isBlocking: blocking,
      blockHeldForMs: 1000,
      broadcastExercise: false,
      setVelocity() {},
    };
    let hits = 0;
    for (let now = 0; now < 60000; now += 20) {
      Player.prototype._tickTimers.call(player, 20);
      if (Player.prototype.takeDamage.call(player, 20).damage > 0) hits += 1;
    }
    return { hits, damage: 100000 - player.hp };
  }

  it('ordinary block reduces dense-hit total damage with equal protection windows', () => {
    const block = incomingHits(true);
    const rush = incomingHits(false);
    const player = { ...resourceFixture('youth'), hp: 1000, blockHeldForMs: 1000, isBlocking: true };
    Player.prototype.takeDamage.call(player, 20);
    const envelope = blockCadenceEnvelope(20, player.invulnMs);
    expect(COMBAT.blockInvulnMs).toBe(PHYSICS.invulnMs);
    expect(player.invulnMs).toBe(COMBAT.blockInvulnMs);
    expect(block).toEqual({ hits: 67, damage: 402 });
    expect(rush).toEqual({ hits: 67, damage: 1340 });
    expect(block.damage).toBeLessThan(rush.damage);
    expect(block.hits).toBe(Math.ceil(60000 / (Math.ceil(player.invulnMs / 20) * 20)));
    expect(block.damage).toBe(block.hits * envelope.ordinaryBlockedDamage);
    expect(rush.hits).toBe(Math.ceil(60000 / (Math.ceil(PHYSICS.invulnMs / 20) * 20)));
    expect(rush.damage).toBe(rush.hits * 20);
    expect(envelope.minimumBlockedInvulnForEqualDpsMs).toBe(270);
    expect(envelope.unblockedInvulnMs).toBe(PHYSICS.invulnMs);
  });
});
