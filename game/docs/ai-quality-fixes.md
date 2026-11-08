# AI/FX quality fixes (baseline 73b2510)

Implemented in the independent `UNTIL-THE-END-ai` worktree, updated against merged develop `ba8cfc6`. The integration agent authorized the single Player horizontal-speed hook below; StageScene, gameConfig and UI remain outside this branch's changes.

## Connected integration hook

Player._handleHorizontal now multiplies the computed walking speed by `this.passiveMoveMult ?? 1`. stagePassives sets this field to 1 normally and 1.15 when 风油精提神 is owned, including after scene restart. This is the only Player change in this branch. `passiveStatusDurationMult` is 1 or 0.5 and is already applied by the existing applySlow entrypoint. Normal hurt recovery and invulnerability timers are not status effects and are unchanged.

广播体操 now synchronizes the existing `broadcastExercise` field from persistent ownership; Player's existing 85% block reduction reads it. 举一反三 runs only for a known monster's killing blow carrying `isMelee: true`; the event retains original type/x/y/exp. Projectile, stomp, dog defuse and Boss defeat paths cannot trigger it. A newly dropped passive does not retroactively apply to that kill.

## Other confirmed fixes

- Custom overtimeGhost/requirementVortex movement uses the same detect/leash thresholds as the generic FSM, with patrol outside detection and pursuit until the leash is exceeded. Vortex shield restoration is independent of pursuit.
- Juice shutdown unregisters all four named listeners, cancels the outstanding timer, restores world.timeScale and clears installation state. Reinstalling on the same Scene works without duplicate shake handlers.
- Adult dog automatically defuses multiple nearby red dots and intercepts nearby stamp shockwaves using the existing guardRange. Stamp FX also invokes protection immediately after spawning waves; it works outside letter rain and does not clear smoke/ordinary projectiles. Existing block/letter-rain abilities remain.
- Healing now requires grounded, stationary, non-attacking, unthreatened play in addition to the existing last-damage and healing timers. No healing amounts or intervals changed.

## Verification

`cd game && npm test`: 119/119 tests passed across 11 files, including 12 AI-quality cases (three directly invoke Player._handleHorizontal for youth/middle/elder). `npm run build` succeeded (44 modules; existing large-bundle warning only). Phaser is mocked in unit tests; they do not establish real-browser physics behavior.

`node tools/verify-ai-quality.cjs D:/CodexOutputs/黑客松/reports/quality-20261108/ai-browser` passed 15/15 explicit browser checks on 2026-11-08 using actual Vite-served source, real Phaser and Edge Canvas (renderer type 1). No page errors were recorded. The tool defaults to `output/playwright/ai-quality` and accepts an output directory; existing local Playwright and Edge paths can be overridden with PLAYWRIGHT_MODULE and EDGE_PATH. All browser profiles, Vite cache and artifacts are written to the D-drive output directory.

Evidence: `D:/CodexOutputs/黑客松/reports/quality-20261108/ai-browser/ai-quality-browser.json` and `ai-quality-final.png`.

- Real spawned monster deaths grant the three youth passives. Youth and middle ground horizontal speed changes from 95 to 109.25; elder changes from 76 to 87.4. The restored multiplier is read before the probe temporarily removes it for a baseline. Middle→elder→youth scene restarts retain all three youth passives, ordinary blocked damage is 3 from a 20-point hit, and a two-second slow expires after one second.
- Each restarted scene owns exactly one of each of Juice's four event handlers. Old handlers are absent after shutdown, the installation flag is cleared, the new World starts at timeScale 1, hitstop sets 4 and the real scene clock returns it to 1. Phaser has already destroyed its World at the shutdown observer, so the report's shutdown scale is null. A Boss-phase event has the existing StageScene shake (220ms/0.006) plus exactly one Juice shake (300ms/0.01); these are recorded separately rather than claiming one total camera call.
- Both actual custom monsters patrol at 950px, acquire at 63px, retain pursuit at 74px and disengage at 121px. The adult dog defuses two nearby red dots without owner damage and removes a nearby stamp shockwave outside letter rain while smoke and ordinary projectiles remain. Resting on the ground permits 10HP healing; movement prevents that heal.
- With one controlled RNG draw, an actual monster killing blow grants 5MP for melee at roll 0; projectile damage and melee at roll 0.25 grant none. RNG is restored immediately after the one eligibility draw so Phaser UUID generation remains real.

The browser probe injects monster positions and lethal damage, directly invokes real grounded horizontal control and dog guard/heal methods, requests scene restarts, injects projectiles/events, and sets healing eligibility. Rendering, Arcade bodies and restart/clock execution use real Phaser with natural RAF; no manual game-loop pumping or module mocks. It verifies these mechanisms, not natural discovery, a complete playthrough, difficulty, human balance or #74.

Integration browser scenarios:

1. Kill each youth monster once: inventory persists after T/scene restart; confirm inspector's ordinary block takes 15% damage and sleepBug gives 1.15 movement speed.
2. Own 举一反三 with MP below cap: controlled RNG below 0.25 plus melee killing blow grants 5MP; projectile kill, Boss defeat and RNG at 0.25 do not. MP never exceeds cap.
3. Switch youth→middle→youth repeatedly, hit enemies and receive hits: hitstop works each time, each shake event fires once, no stale timescale after shutdown.
4. Leave middle enemies about 950px away: ghost/vortex patrol rather than chase the player. Approach within64px to acquire, retreat beyond120px to disengage.
5. With adult dog, approach two red dots without blocking, then test a stamp outside the letter storm: nearby threats are cleared. Walk/jump/attack near an enemy after taking damage: the dog does not heal; retreat and stand still to allow the original 10HP/10s aura.

These fixes do not claim to resolve #74. The read-only audit is at `D:/CodexOutputs/黑客松/reports/quality-20261108/ai-fx-review.md`; the integration agent owns #74 reproduction, remaining Player/Stage physics fixes, and human-playthrough acceptance.
