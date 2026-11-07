/**
 * 试玩遥测（issue #26 · 数值平衡的数据地基）
 *
 * 安装后自动采集：用时、死亡（按检查点分布）、承伤、检查点激活顺序、
 * Boss 战时长、按键使用率（近战/远程/跳跃/格挡）。
 * 一关结束自动汇总：console 摘要 + localStorage 快照。
 *
 * 导出：控制台执行 `__fmnTelemetry.download()` 下载 JSON，
 * 丢给成员 A/C 即可按数据拧 #26 的螺丝，不再玄学调参。
 *
 * 事件面：
 *  - 场景事件（StageScene 四处单行 emit）：player:died / player:damaged / checkpoint / stage:complete
 *  - AI 事件（已有）：ai:boss:spawn / ai:boss:defeated
 *  - 窗口键盘：J/L/Space/S 计数（自装监听，不碰 InputController）
 */

const KEY_LABELS = { KeyJ: 'melee', KeyL: 'ranged', Space: 'jump', KeyS: 'block' };

export function installTelemetry(scene) {
  if (scene._telemetryInstalled) return;
  scene._telemetryInstalled = true;

  const phaseId = scene.phaseId ?? 'unknown';
  const startedAt = Date.now();
  const data = {
    phase: phaseId,
    startedAt: new Date().toISOString(),
    elapsedMs: 0,
    deaths: 0,
    deathsByCheckpoint: {},
    damageTaken: 0,
    damageTakenCount: 0,
    checkpointsActivated: [],
    bossFights: [],
    _bossSpawnAt: {},
    keyPresses: { melee: 0, ranged: 0, jump: 0, block: 0 },
  };
  let finalized = false;

  const onKey = (e) => {
    const label = KEY_LABELS[e.code];
    if (label && data.keyPresses[label] !== undefined) data.keyPresses[label] += 1;
  };
  window.addEventListener('keydown', onKey);

  const onDamage = (info) => {
    data.damageTaken += info?.damage ?? 0;
    data.damageTakenCount += 1;
  };
  const onDied = () => {
    data.deaths += 1;
    const cp = scene.checkpointList?.[scene.activeCheckpointIndex];
    const label = cp?.label ?? `cp${scene.activeCheckpointIndex ?? 0}`;
    data.deathsByCheckpoint[label] = (data.deathsByCheckpoint[label] ?? 0) + 1;
  };
  const onCheckpoint = (cp) => {
    if (cp?.label) data.checkpointsActivated.push(cp.label);
  };
  const onBossSpawn = (b) => {
    if (b?.kind) data._bossSpawnAt[b.kind] = Date.now();
  };
  const onBossDefeated = (b) => {
    if (!b?.kind) return;
    const spawnAt = data._bossSpawnAt[b.kind];
    data.bossFights.push({
      kind: b.kind,
      durationMs: spawnAt ? Date.now() - spawnAt : null,
    });
  };

  scene.events.on('player:damaged', onDamage);
  scene.events.on('player:died', onDied);
  scene.events.on('checkpoint', onCheckpoint);
  scene.events.on('ai:boss:spawn', onBossSpawn);
  scene.events.on('ai:boss:defeated', onBossDefeated);

  function finalize() {
    if (finalized) return;
    finalized = true;
    data.elapsedMs = Date.now() - startedAt;
    try {
      localStorage.setItem(
        `fmn-telemetry-${phaseId}-${Date.now()}`,
        JSON.stringify(data),
      );
    } catch (e) { /* 存储满不阻塞 */ }
    try {
      console.info(
        `[遥测] ${phaseId} 用时 ${(data.elapsedMs / 1000).toFixed(1)}s · 死亡 ${data.deaths} · 承伤 ${data.damageTaken} · __fmnTelemetry.summary() / download()`,
      );
    } catch (e) { /* console 不可用不阻塞 */ }
  }

  scene.events.on('stage:complete', finalize);
  scene.events.once('shutdown', () => {
    window.removeEventListener('keydown', onKey);
    scene.events.off('player:damaged', onDamage);
    scene.events.off('player:died', onDied);
    scene.events.off('checkpoint', onCheckpoint);
    scene.events.off('ai:boss:spawn', onBossSpawn);
    scene.events.off('ai:boss:defeated', onBossDefeated);
    finalize();
  });

  window.__fmnTelemetry = {
    data,
    summary() {
      return {
        ...data,
        _bossSpawnAt: undefined,
        elapsedSec: +((Date.now() - startedAt) / 1000).toFixed(1),
      };
    },
    download() {
      const blob = new Blob([JSON.stringify(this.summary(), null, 2)], {
        type: 'application/json',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fmn-telemetry-${phaseId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      return a.download;
    },
  };
  return window.__fmnTelemetry;
}
