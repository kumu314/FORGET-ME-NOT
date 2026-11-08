/**
 * 悬浮保险丝（issue #74 症状兜底）
 *
 * 背景：二关 x463 悬浮软锁偶发且难以复现（真实浏览器 731 帧未抓到），
 * 但报告者实测 setAllowGravity+setGravityY+setVelocityY(50) 可立即恢复。
 * 本模块只做"持续低速滞空"的看门狗判定（纯函数），恢复动作由 Player 执行，
 * 触发时附 __uteDiagnostics 现场快照，供后续抓真因。
 *
 * 注意：这是症状兜底，不是根因修复。触发日志出现即说明复现窗口被捕获。
 */

export const HOVER_FUSE = Object.freeze({
  /** 竖直速度绝对值低于此值算"低速滞空"（px/s） */
  maxVerticalSpeed: 80,
  /** 连续低速滞空超过此毫秒数触发恢复 */
  triggerMs: 2000,
  /** 触发后的冷却，避免反复弹跳 */
  cooldownMs: 3000,
});

/**
 * 推进悬浮看门狗。
 * @param {number} watchMs 当前已累计的低速滞空时长
 * @param {number} delta 本帧毫秒
 * @param {boolean} grounded 是否落地
 * @param {number} vy 竖直速度
 * @param {number} cooldownMs 剩余冷却（毫秒）
 * @returns {{watchMs: number, cooldownMs: number, tripped: boolean}}
 */
export function updateHoverWatch(watchMs, delta, grounded, vy, cooldownMs = 0) {
  const cooling = Math.max(0, cooldownMs - delta);
  const lowSpeed = Math.abs(vy) < HOVER_FUSE.maxVerticalSpeed;

  if (grounded || !lowSpeed) {
    return { watchMs: 0, cooldownMs: cooling, tripped: false };
  }

  const next = watchMs + delta;
  if (next >= HOVER_FUSE.triggerMs && cooling <= 0) {
    return { watchMs: 0, cooldownMs: HOVER_FUSE.cooldownMs, tripped: true };
  }
  return { watchMs: next, cooldownMs: cooling, tripped: false };
}
