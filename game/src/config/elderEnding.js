export const ELDER_CHILD = Object.freeze({ x: 1472, facing: 1, hugDistance: 22 });

export function canHugChild(player, child = ELDER_CHILD) {
  if (!player || player.isDead || !player.isGrounded) return false;
  const distanceBehind = (child.x - player.x) * child.facing;
  return distanceBehind >= 0 && distanceBehind <= child.hugDistance
    && player.body?.velocity?.x * child.facing > 0;
}
