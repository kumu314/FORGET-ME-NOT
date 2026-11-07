# AI/FX quality fixes (baseline 73b2510)

Implemented in the independent `UNTIL-THE-END-ai` worktree. Player, StageScene, gameConfig and UI are owned by the integration agent and are not changed here.

## Required integration hook

In Player._handleHorizontal, multiply the computed walking speed by `this.passiveMoveMult ?? 1`. stagePassives sets this field to 1 normally and 1.15 when 风油精提神 is owned, including after scene restart. This hook is the only remaining Player change needed by this branch. `passiveStatusDurationMult` is 1 or 0.5 and is already applied by the existing applySlow entrypoint. Normal hurt recovery and invulnerability timers are not status effects and are unchanged.

广播体操 now synchronizes the existing `broadcastExercise` field from persistent ownership; Player's existing 85% block reduction reads it. 举一反三 runs only for a known monster's killing blow carrying `isMelee: true`; the event retains original type/x/y/exp. Projectile, stomp, dog defuse and Boss defeat paths cannot trigger it. A newly dropped passive does not retroactively apply to that kill.

## Other confirmed fixes

- Custom overtimeGhost/requirementVortex movement uses the same detect/leash thresholds as the generic FSM, with patrol outside detection and pursuit until the leash is exceeded. Vortex shield restoration is independent of pursuit.
- Juice shutdown unregisters all four named listeners, cancels the outstanding timer, restores world.timeScale and clears installation state. Reinstalling on the same Scene works without duplicate shake handlers.
- Adult dog automatically defuses multiple nearby red dots and intercepts nearby stamp shockwaves using the existing guardRange. Stamp FX also invokes protection immediately after spawning waves; it works outside letter rain and does not clear smoke/ordinary projectiles. Existing block/letter-rain abilities remain.
- Healing now requires grounded, stationary, non-attacking, unthreatened play in addition to the existing last-damage and healing timers. No healing amounts or intervals changed.

## Verification

`npm test`: 103/103 tests passed across 10 files, including 9 new focused cases. `npm run build` succeeded (44 modules; existing large-bundle warning only). Phaser is mocked in unit tests; they do not establish real-browser physics behavior.

Integration browser scenarios:

1. Kill each youth monster once: inventory persists after T/scene restart; confirm inspector's ordinary block takes 15% damage and sleepBug gives 1.15 movement speed after the hook above.
2. Own 举一反三 with MP below cap: controlled RNG below 0.25 plus melee killing blow grants 5MP; projectile kill, Boss defeat and RNG at 0.25 do not. MP never exceeds cap.
3. Switch youth→middle→youth repeatedly, hit enemies and receive hits: hitstop works each time, each shake event fires once, no stale timescale after shutdown.
4. Leave middle enemies about 950px away: ghost/vortex patrol rather than chase the player. Approach within64px to acquire, retreat beyond120px to disengage.
5. With adult dog, approach two red dots without blocking, then test a stamp outside the letter storm: nearby threats are cleared. Walk/jump/attack near an enemy after taking damage: the dog does not heal; retreat and stand still to allow the original 10HP/10s aura.

These fixes do not claim to resolve #74. The read-only audit and probes are at `D:/CodexOutputs/黑客松/reports/quality-20261108/ai-fx-review.md`; the integration agent owns actual browser reproduction and Player/Stage physics fixes.
