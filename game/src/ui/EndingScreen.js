/**
 * 结局保底（issue #25 · GDD §6 兜底策略）
 *
 * 孩子身后的拥抱事件 → 黑幕定格 → StageScene 打字机文案 → EndingScene 大合照。
 *
 * 监听叙事事件，避免世界坐标越界直接跳过拥抱；
 * StageScene.create() 里 `installEndingScreen(this)` 一行完成安装。
 */

/**
 * 在场景上安装结局监听；重复调用安全（幂等）。
 * 仅在老年关（phaseId === 'elder'）的 story:hug 事件生效。
 */
export function installEndingScreen(scene) {
  if (scene._endingScreenInstalled) return;
  scene._endingScreenInstalled = true;

  let fired = false;

  const detach = () => {
    scene.events.off('story:hug', onHug);
    scene._endingScreenInstalled = false;
  };

  function onHug() {
    if (fired || scene.phaseId !== 'elder') return;
    fired = true;
    detach();
    scene.time.delayedCall(1200, () => {
      scene.cameras.main.fadeOut(700, 0, 0, 0);
      scene.time.delayedCall(700, () => scene._advanceStage());
    });
  }

  scene.events.on('story:hug', onHug);
  scene.events.once('shutdown', detach);
}
