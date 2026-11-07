/** Non-mutating evidence for #74. Wall time prevents a pumped update loop faking seconds. */
export function createAirborneWatch({ thresholdMs = 2000 } = {}) {
  let since = null;
  let reported = false;
  return (sample) => {
    const suspect = !sample.grounded && !sample.dead && !sample.modal && !sample.transitioning
      && !sample.paused && Math.abs(sample.vy) < 100;
    if (!suspect) { since = null; reported = false; return false; }
    if (since === null) since = sample.wallMs;
    if (!reported && sample.wallMs - since >= thresholdMs) {
      reported = true;
      return true;
    }
    return false;
  };
}

export function installPhysicsDiagnostics(scene) {
  const samples = [];
  const incidents = [];
  const watch = createAirborneWatch();
  const startedAt = performance.now();
  let sampledAt = -Infinity;
  const onUpdate = () => {
    const wallMs = performance.now() - startedAt;
    if (wallMs - sampledAt < 100) return;
    sampledAt = wallMs;
    const p = scene.player;
    if (!p?.body) return;
    const b = p.body;
    const world = scene.physics.world;
    const sample = {
      wallMs, sceneMs: scene.time.now, phase: scene.phaseId,
      x: p.x, y: p.y, bodyX: b.x, bodyY: b.y,
      vx: b.velocity.x, vy: b.velocity.y,
      gravityY: b.gravity.y, worldGravityY: world.gravity.y, allowGravity: b.allowGravity,
      grounded: p.isGrounded, dead: p.isDead, hp: p.hp, mp: p.mp,
      hurtLockMs: p.hurtLockMs, invulnMs: p.invulnMs,
      paused: world.isPaused, timeScale: world.timeScale,
      modal: scene.modalOpen, transitioning: scene.transitioning,
      blocked: { ...b.blocked }, touching: { ...b.touching },
      input: { ...scene.inputState?._held }, dog: scene.ai?.dog?.form ?? null,
    };
    samples.push(sample);
    if (samples.length > 120) samples.shift();
    if (!watch(sample) || incidents.length >= 5) return;
    const incident = {
      kind: 'airborne-low-velocity', at: new Date().toISOString(), sample,
      nearbySolids: (scene.layout?.solids ?? []).filter(s =>
        s.x < p.x + 80 && s.x + s.w > p.x - 80 && s.y < p.y + 80 && s.y + s.h > p.y - 80),
      history: samples.slice(),
    };
    incidents.push(incident);
    scene.events.emit('physics:airborne-stall', incident);
    console.warn('[physics diagnostic] prolonged low-speed airborne state; no correction applied', incident);
  };
  scene.events.on('postupdate', onUpdate);
  const api = { phase: scene.phaseId, samples, incidents,
    snapshot: () => ({ phase: scene.phaseId, samples: samples.slice(), incidents: incidents.slice() }) };
  window.__uteDiagnostics = api;
  scene.events.once('shutdown', () => {
    scene.events.off('postupdate', onUpdate);
  });
  return api;
}
