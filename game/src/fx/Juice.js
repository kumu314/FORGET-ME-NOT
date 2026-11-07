/**
 * 打击感机制层（issue #26 · 已知良好默认值，全部集中在 JUICE 常量可调）
 *
 *  - 命中顿帧：任意 AI 目标受击瞬间 world.timeScale 拉高 70ms（世界微顿）
 *  - 屏震三档：玩家受击(轻) / AI 重事件 stomp·explode(中) / Boss 二阶段(重)
 * 全部节流防连发叠加。小怪受击红闪 D 已实现（MonsterFSM.flashHit），不重复做。
 *
 * 事件面全部为已有事件：ai:damage / player:damaged / ai:fx / ai:boss:phase。
 */

export const JUICE = Object.freeze({
  hitStopTimeScale: 4,
  hitStopMs: 70,
  hitStopMinGapMs: 90,
  shake: Object.freeze({
    playerHurt: Object.freeze({ durationMs: 130, intensity: 0.005 }),
    heavy: Object.freeze({ durationMs: 200, intensity: 0.007 }),
    bossPhase: Object.freeze({ durationMs: 300, intensity: 0.01 }),
    minGapMs: 250,
  }),
});

export function installJuice(scene) {
  if (scene._juiceInstalled) return;
  scene._juiceInstalled = true;

  let lastHitStop = 0;
  const lastShake = {};

  const shake = (tier) => {
    const now = scene.time.now;
    if (now - (lastShake[tier] ?? -Infinity) < JUICE.shake.minGapMs) return;
    lastShake[tier] = now;
    const cfg = JUICE.shake[tier];
    scene.cameras.main.shake(cfg.durationMs, cfg.intensity);
  };

  const onDamage = () => {
    const now = scene.time.now;
    if (now - lastHitStop < JUICE.hitStopMinGapMs) return;
    lastHitStop = now;
    const world = scene.physics?.world;
    if (!world) return;
    world.timeScale = JUICE.hitStopTimeScale;
    scene.time.delayedCall(JUICE.hitStopMs, () => {
      world.timeScale = 1;
    });
  };

  scene.events.on('ai:damage', onDamage);
  scene.events.on('player:damaged', () => shake('playerHurt'));
  scene.events.on('ai:fx', (fx) => {
    if (fx?.type === 'stomp' || fx?.type === 'explode') shake('heavy');
  });
  scene.events.on('ai:boss:phase', () => shake('bossPhase'));
  scene.events.once('shutdown', () => {
    scene.events.off('ai:damage', onDamage);
    if (scene.physics?.world) scene.physics.world.timeScale = 1;
  });
}
