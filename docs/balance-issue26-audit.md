# Issue #26: balance audit, not acceptance sign-off

Audit baseline: develop f0aa037, 2026-11-07. The initial commit adds an offline configuration report and nine mechanics probes. The authorized follow-up applies the two tuning fixes below. Issue #26 stays open. Historical source line references below refer to f0aa037.

## Applied follow-up: sustained elder casting and equal block protection

The follow-up changes gameConfig.RANGED_COST.elder from 10 to 3, retaining elder 200 MP, 12 MP/s and 260 ms cooldown. It adds COMBAT.blockInvulnMs=900 and replaces Player.takeDamage's blocked 120 ms literal with this constant, matching the existing 900 ms unblocked protection. Blocking still prevents melee and ranged attacks.

With production config and real Player methods, the elder held-cast regression now emits 231 shots in 60 simulated seconds (3,000 steps of 20 ms), exactly 260 ms apart, with MP at least 197. There is no candidate configuration injection in this regression. In the same dense-hit exposure described below, ordinary block now accepts 67 hits for 402 damage, while no block accepts 67 hits for 1,340 damage: total blocked damage is 30% of unblocked damage for those equal 3,000-request sequences. These are mechanics regressions, not player win rates. The script now reports the previous cost-ten envelope alongside the active config.

Tradeoffs remain: sustained elder output rises and energy scarcity falls; equal protection windows admit fewer block events than the old 120 ms rule, reducing MP-refund opportunities. Human duration, style win rates, collision behavior and subjective feel remain unmeasured. To revert just the tuning, restore elder cost 10 and the previous blocked 120 ms assignment; the parent can revert the independent follow-up commit if required.

## Reproduce

From game/: node tools/balance-audit.mjs; npm test. The report imports the existing gameConfig, stageLayout, StageSpawns and aiConfig; it does not copy their balance values into another configuration. rangedResourceEnvelope accepts cost/cooldown/regen/cap overrides for candidate comparison without mutating production settings.

This worktree reused installed Vitest without installing dependencies:

    node D:/CodexOutputs/黑客松/FORGET-ME-NOT/game/node_modules/vitest/vitest.mjs run --config D:/CodexOutputs/黑客松/FORGET-ME-NOT/game/vitest.config.js --root D:/CodexOutputs/黑客松/FORGET-ME-NOT-balance/game

Result: 4/4 test files, 62/62 tests passed; 9/9 are new balance probes. Each held-fire or dense-hit probe drives 3,000 steps of 20 ms over 60 simulated seconds. Phaser rendering/physics are mocked. Resource tests invoke production Player._tickTimers, _tickMp and _handleRanged; the damage diagnostic invokes production Player.takeDamage. They do not invent enemy AI or assign win probabilities.

## Eight to fifteen minutes per stage is unverified and not supported by current content

The requirement remains 480–900 seconds per stage. Current world width is 1,600 px, spawn x=48, normal walk speed 95 px/s and elder ground factor 0.8. See game/src/config/stageLayout.js:26, game/src/config/gameConfig.js:16 and :22. Obstacle-free travel to the right boundary is 16.34 s for youth/middle and 20.42 s for elder. These are arithmetic reference times, not measured clear times. Elder's current ending trigger is earlier, x=1,450, giving 18.45 s of unimpeded walking (StageScene.js:58 and :440).

At this baseline StageSpawns has eight youth enemies (280 raw HP) and a 420-HP boss; seven middle enemies (320 raw HP) and a 460-HP boss; three elder enemies (85 raw HP), no boss. The third-stage ending currently triggers by position. The stage worker is adding content separately; rerun the report after integration. The helper counts only main spawn entries, not the optional respawning youth puzzle helper, shields, armor, dog effects, drops or upgrades.

The free-running melee-chain arithmetic is 75 / 80.65 / 34.15 damage per second, using chain recover times as total stage durations, matching Player._startMelee and _tickMelee. This assumes continuous contact and no interruptions; it is not effective combat DPS and cannot yield a measured completion time. A 16–20 second walk plus this small enemy roster provides no evidence for 8–15 minutes of meaningful play. Keeping the time target requires additional authored encounters/exploration and human duration measurements. Inflating boss HP or adding forced waits to make the timer reach eight minutes would change the experience; this audit does not do either.

No stage-clear runs were measured: 0 runs across all three stages. No block/rush wins were sampled: 0 attempted runs in either style. There is therefore no duration or comparable-win-rate acceptance claim.

## Elder spell supply: retain 12 MP/s, evaluate cost three

The audited f0aa037 baseline has 200 MP, regen 12/s, cost 10 and cooldown 260 ms (gameConfig.js:59, :122 and :129). Player._handleRanged already fires while L is held; it gates on cooldown, block, hurt and MP, not on a fresh keypress. No extra repeat-input implementation is required.

At cost 10 the cooldown ceiling is 3.846 shots/s, but sustainable MP supply permits only 1.2 shots/s: 31.2% of that ceiling. Continuous-drain approximation exhausts a full bar in 7.56 s; actual first starvation is frame/shot dependent, so this is not an exact runtime deadline. The production-method probe emits 91 shots over 60 simulated seconds from full MP with no incoming damage, block, dog refunds or perfect-block refunds. Youth/middle yield 11/19 shots under the same resource-only conditions. These counts do not measure hits or kills.

For sustained hold-L casting, cost 3 fits 12 MP/s and 260 ms: maximum sustainable cost is 3.12 MP/shot. The initial isolated candidate produced 231 shots over 60 simulated seconds, each 260 ms apart, with MP remaining at least 197; the follow-up reproduces this using the active production config. At typical 60 Hz, 260 ms rounds to at least 16 frames (266.7 ms); browser frame timing remains unmeasured here.

GDD specifies youth cost 15 (line 90), middle cost 20 (line 174), elder 12 MP/s and spell-machine-gun intent (line 224), but gives no elder numeric cost. The existing source comment attributing elder cost 10 to GDD is therefore unsupported by the checked document. A cost-three tuning change would preserve the lifecycle regen contract.

Tradeoff: cost three raises eventual single-target ranged output from supply-limited 12 to cooldown-limited approximately 38.46 damage/s before misses, using the current 10-damage projectile. It also makes the 200-MP reserve and 10-MP perfect-block refund much less strategically scarce. It should be disclosed and checked with the new elder encounter. Keeping current cost preserves the initial-burst/resource-management game, at the expense of sustained spell-machine-gun intent. Changing cost alone cannot prove subjective feel or level balance.

## Dense-hit reversal: ordinary block can take more damage

At f0aa037 Player.takeDamage grants blocked hits 120 ms of invulnerability (Player.js:588), but unblocked hits PHYSICS.invulnMs=900 ms (Player.js:591). Blocking reduces individual hits by 70%; it also prevents casting and ground melee while held. The follow-up replaces the blocked literal with COMBAT.blockInvulnMs=900.

One diagnostic requests a 20-damage hit every 20 ms for 60 seconds, starting with 100,000 fixture HP to avoid death stopping the sequence. Ordinary held block accepts 500 hits for 3,000 damage; no block accepts 67 hits for 1,340 damage. This is two deterministic scripted exposure cases, not enemy combat and not two gameplay victories. Continuous-hit arithmetic is 50 versus 22.22 damage/s, a 2.25 ratio. Even 85% mitigation can be counteracted by this immunity difference. Perfect-block MP gain is bounded by MP cap; these tests do not model timing skill or exploit profitability.

If block should reliably reduce damage under overlapping attacks, expose blocked invulnerability in COMBAT and consume that constant in Player.takeDamage. Matching the existing 900 ms unblocked duration is a simple candidate; under identical exposure it preserves the advertised per-hit mitigation over time. A minimum of 270 ms gives equal continuous DPS for raw 20 ordinary-blocked damage 6, but equality is not a benefit and rounding changes this threshold for other hit values. Tradeoff of 900 ms: fewer accepted block events means fewer perfect-block/dog refund opportunities and less multi-hit pressure. Source-specific cadence and actual boss patterns still need runtime validation. Keeping 120 ms retains this dense-hit reversal.

The initial diagnostic commit changes no runtime wiring. The authorized follow-up changes only gameConfig.js and the blocked-invulnerability assignment in Player.js, with regression assertions and this disclosure updated. StageScene.js and aiConfig.js are untouched. The benefit ceiling is fixing the demonstrated resource/cadence behavior; 8–15-minute pacing, human block/rush win rates, AI collisions, subjective casting feel and optional feedback effects remain outside these probes. No publication, push or issue closure occurs.
