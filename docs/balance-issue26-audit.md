# Issue #26 mechanics follow-up (2026-11-08)

Baseline: develop `73b2510`. The earlier local follow-up was not on develop; this revision ports only its resource/cadence correction and reusable probes. It does not sign off human playtesting.

- `RANGED_COST.elder`: 10 → 3; 200 MP, 12 MP/s, 260 ms cooldown unchanged. Cost ten eventually supports 1.2 shots/s; cost three supports the cooldown-limited 3.846 shots/s. The maximum sustainable cost is 3.12 MP/shot. This implements sustained elder casting at the expense of energy scarcity.
- `COMBAT.blockInvulnMs`: 900 ms, replacing a blocked-hit literal of 120 ms. Unblocked protection is already 900 ms. Equal exposure now preserves block mitigation over time. The tradeoff is fewer opportunities for perfect-block MP refunds.

`npm test` runs real Player methods with mocked Phaser, 3,000/3,000 fixed 20-ms steps per simulated minute. Elder fires 231 shots, 260 ms apart, retaining at least 197 MP. An identical sequence of 3,000 damage requests accepts 67 blocked hits (402 damage) versus 67 unblocked hits (1,340 damage). The previous 120-ms block accepted 500 hits (3,000 damage). These are deterministic mechanism probes, not enemy combat or win rates.

`node tools/balance-audit.mjs` reports resource envelopes, enemy health and unobstructed traversal separately from clear duration. Its scope is configuration arithmetic. It does not measure human 8–15-minute completion, block/rush victory rates, AI collision outcomes or subjective enjoyment. Human telemetry samples available to this audit: 0; #26 stays open until real sessions and feedback arrive.

Keeping the baseline retains the demonstrated resource starvation and dense-hit block reversal. To roll back only tuning, restore elder cost 10 and blocked invulnerability 120; no lifecycle HP, regen, map, AI or asset changes are needed. Check the new encounter density with humans before calling the game balanced.
