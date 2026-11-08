import { isUiInputTarget } from '../core/Input.js';

const KEY_LABELS = { KeyJ: 'melee', KeyL: 'ranged', Space: 'jump', KeyS: 'block', ArrowDown: 'block' };

export function installTelemetry(scene, { revision = import.meta.env?.VITE_GIT_SHA ?? 'unknown' } = {}) {
  if (scene._telemetry) return scene._telemetry;
  const phaseId = scene.phaseId ?? 'unknown';
  const startedAt = Date.now();
  const runId = globalThis.crypto?.randomUUID?.() ?? `${startedAt}-${Math.random().toString(36).slice(2)}`;
  const bossSpawnAt = new Map();
  const data = {
    schemaVersion: 1,
    runId,
    revision,
    phase: phaseId,
    startedAt: new Date(startedAt).toISOString(),
    elapsedMs: 0,
    timeMetric: 'wall-clock-including-pauses',
    inputMetric: 'nonrepeat-keydown-during-gameplay',
    outcome: 'in-progress',
    endReason: null,
    contamination: [],
    diagnostics: [],
    deaths: 0,
    deathsByCheckpoint: {},
    damageTaken: 0,
    damageTakenCount: 0,
    checkpointsActivated: [],
    bossFights: [],
    keyPresses: { melee: 0, ranged: 0, jump: 0, block: 0 },
  };
  let finalized = false;
  const elapsed = () => finalized ? data.elapsedMs : Math.max(0, Date.now() - startedAt);
  const contaminate = (reason) => {
    if (!data.contamination.includes(reason)) data.contamination.push(reason);
  };
  const onKey = (e) => {
    if (finalized || e.repeat || document.hidden
      || isUiInputTarget(e.target) || isUiInputTarget(document.activeElement)) return;
    if (e.code === 'KeyR') contaminate('manual-respawn');
    if (e.code === 'KeyT') contaminate('debug-phase-switch');
    if (scene.modalOpen || scene.transitioning) return;
    const label = KEY_LABELS[e.code];
    if (label) data.keyPresses[label] += 1;
  };
  const onDamage = (info) => {
    if (finalized) return;
    data.damageTaken += info?.damage ?? 0;
    data.damageTakenCount += 1;
  };
  const onDied = () => {
    if (finalized) return;
    data.deaths += 1;
    const cp = scene.checkpointList?.[scene.activeCheckpointIndex];
    const label = cp?.label ?? `cp${scene.activeCheckpointIndex ?? 0}`;
    data.deathsByCheckpoint[label] = (data.deathsByCheckpoint[label] ?? 0) + 1;
  };
  const onCheckpoint = (cp) => {
    if (!finalized && cp?.label) data.checkpointsActivated.push(cp.label);
  };
  const onBossSpawn = (b) => {
    if (!finalized && b?.kind) bossSpawnAt.set(b.kind, Date.now());
  };
  const onBossDefeated = (b) => {
    if (finalized || !b?.kind) return;
    const spawnAt = bossSpawnAt.get(b.kind);
    data.bossFights.push({ kind: b.kind, durationMs: spawnAt === undefined ? null : Date.now() - spawnAt });
    bossSpawnAt.delete(b.kind);
  };
  const onDiagnostic = () => {
    if (finalized) return;
    data.diagnostics.push({ event: 'physics:airborne-stall', atMs: elapsed() });
    contaminate('physics:airborne-stall');
  };
  function finalize(outcome, reason) {
    if (finalized) return;
    data.elapsedMs = elapsed();
    data.outcome = outcome;
    data.endReason = reason;
    finalized = true;
    try {
      localStorage.setItem(`fmn-telemetry-${phaseId}-${runId}`, JSON.stringify(handle.summary()));
    } catch { /* Storage availability must not interrupt the game. */ }
    console.info(`[遥测] ${phaseId} ${outcome} · ${(data.elapsedMs / 1000).toFixed(1)}s · 死亡 ${data.deaths} · 承伤 ${data.damageTaken}`);
  }
  const onComplete = () => finalize('completed', 'stage:complete');
  const listeners = [
    ['player:damaged', onDamage],
    ['player:died', onDied],
    ['checkpoint', onCheckpoint],
    ['ai:boss:spawn', onBossSpawn],
    ['ai:boss:defeated', onBossDefeated],
    ['physics:airborne-stall', onDiagnostic],
    ['stage:complete', onComplete],
  ];
  const onShutdown = () => {
    finalize('interrupted', 'shutdown');
    window.removeEventListener('keydown', onKey);
    for (const [name, listener] of listeners) scene.events.off(name, listener);
    scene.events.off('shutdown', onShutdown);
    if (scene._telemetry === handle) {
      scene._telemetry = null;
      scene._telemetryInstalled = false;
    }
  };
  const handle = {
    data,
    markContaminated(reason) {
      if (!finalized && typeof reason === 'string' && reason.trim()) contaminate(reason.trim());
    },
    summary() {
      const elapsedMs = elapsed();
      return JSON.parse(JSON.stringify({ ...data, elapsedMs, elapsedSec: +(elapsedMs / 1000).toFixed(1) }));
    },
    history() {
      const runs = new Map();
      const warnings = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.startsWith('fmn-telemetry-')) continue;
          try {
            const run = JSON.parse(localStorage.getItem(key));
            if (run?.schemaVersion === 1 && typeof run.runId === 'string') runs.set(run.runId, run);
            else warnings.push(`legacy-or-invalid-record:${key}`);
          } catch { warnings.push(`unreadable-record:${key}`); }
        }
      } catch { warnings.push('storage-unavailable:only-current-stage-included'); }
      runs.set(runId, this.summary());
      return { schemaVersion: 1, exportedAt: new Date().toISOString(),
        runs: [...runs.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt)), warnings };
    },
    downloadAll() {
      return saveJson(this.history(), `ute-playtests-${Date.now()}.json`);
    },
    download() {
      return saveJson(this.summary(), `fmn-telemetry-${phaseId}-${runId}.json`);
    },
  };
  window.addEventListener('keydown', onKey);
  for (const [name, listener] of listeners) scene.events.on(name, listener);
  scene.events.once('shutdown', onShutdown);
  scene._telemetryInstalled = true;
  scene._telemetry = handle;
  window.__fmnTelemetry = handle;
  return handle;
}

function saveJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return filename;
}