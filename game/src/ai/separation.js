/**
 * 怪间分离（issue #88）
 *
 * 两只追击怪会收敛到玩家同一坐标重叠堆叠：击杀一只后另一只原地贴脸，
 * 读作"打死后原地复活"。此模块提供纯函数的水平分离，由 AIManager
 * 每帧对存活怪两两调用。零依赖、确定性（dx=0 时固定 a 左 b 右）。
 */

/**
 * 将水平/垂直重叠的 a、b 沿水平方向推开。
 * @returns {boolean} 是否发生了分离
 */
export function separatePair(a, b, strength = 0.5) {
  const halfW = (a.width + b.width) / 2;
  const dx = b.x - a.x;
  if (Math.abs(dx) >= halfW) return false;

  const halfH = (a.height + b.height) / 2;
  const dy = b.y - a.y;
  if (Math.abs(dy) >= halfH) return false;

  const push = Math.max(2, halfW - Math.abs(dx)) * strength;
  const dir = dx > 0 ? -1 : 1;
  a.x += push * dir;
  b.x -= push * dir;
  return true;
}

/** 对存活怪两两分离（AIManager.update 每帧调用） */
export function separateAll(monsters) {
  const alive = monsters.filter((m) => !m.dead && m.active && !m.destroyed);
  let separated = false;
  for (let i = 0; i < alive.length; i += 1) {
    for (let j = i + 1; j < alive.length; j += 1) {
      if (separatePair(alive[i], alive[j])) separated = true;
    }
  }
  return separated;
}
