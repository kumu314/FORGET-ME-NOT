# Modal pause and airborne diagnostics (2026-11-08)

`StageScene` now tracks modal ownership by the existing event `detail.key`. Releasing an egg cannot release the upgrade dialog's pause. If XP opens a dialog mid-update, the update returns before trying to pick up a nearby egg. The last release resumes physics; ending and transition locks remain authoritative.

Real Edge/Vite verification: 4/4 checks, denominator = the four assertions in `verify-stage-modals.cjs`: same-frame pending upgrade at the answer egg opens only upgrade, forced overlap retains pause after egg close, final selection resumes physics, no page errors. The test arranges position/pending XP and uses actual scene/UI implementations; it is not a natural-frequency measurement or a complete playthrough.

Issue #74 is not claimed fixed. A real RAF probe collected 731 frames without the reported prolonged hover; gravity stayed enabled at 1000, maximum low-speed airborne stretch was 200 ms. Another 225-frame terrain isolation passed an ordinary jump onto and across the 48-pixel-high desk beginning at x470. Player center x463 is its expected right-edge contact because the body width is14. These paths do not prove that no other input/AI/driver sequence can fail.

The non-mutating recorder samples every100ms by wall clock, retaining at most120 samples and5 incidents. `window.__uteDiagnostics.snapshot()` returns body/scene positions, scene and wall times, gravity, timeScale, pause/contact state, input, HP/MP, dog/passives and healing timers. More than2 wall-clock seconds airborne at |vy|<100 outside death/modal/transition/pause emits `physics:airborne-stall`. This is a diagnostic suspicion, not proof of softlock; low gravity or controlled test setups can produce it. It never resets gravity, moves the player, heals, or changes damage.

If #74 recurs, export the snapshot plus `__fmnTelemetry.download()`, revision, actual key sequence and any long `evaluate` frame-pump code. Repeating `Scene.update` inside one evaluate does not establish complete Phaser physics frames. The recorder intentionally uses wall time so hundreds of artificial update calls do not impersonate seconds.

Keeping the original pause code leaves a proven overlap/resume defect. Keeping #74 unchanged without diagnostics would leave no evidence to distinguish keyboard state, body identity, world timing and actual physics. Reverting this change removes the ownership guard and recorder together; no asset or map is modified.

Narrative transitions also stop player velocity and pause physics; T/R debug actions are ignored while a modal or transition owns control. A real-Phaser Boss probe passed 9/9 assertions: both Boss half-HP phases, real keyboard melee defeat, frozen narrative with T ignored, youth→middle→elder recovery, and no page errors. Boss HP/position and player protection are controlled setup; this does not measure difficulty or full-clear duration.
