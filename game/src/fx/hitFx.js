/**
 * 命中与攻击的视觉特效层（2026-11-08）
 *
 * 与 fx/Juice.js 的分工：
 *   - Juice.js 管"手感"：命中顿帧、三档屏震（已有，不重复做）
 *   - 本模块只管"看得见"：挥击弧光、命中火花、敌人预警/爆炸/踩地/吸蓝/护盾的可视化
 *
 * 全部用 Graphics + Tween 程序化绘制：不新增任何贴图，不依赖外部资源，
 * 与仓库里"资产由脚本生成"的既有做法一致。
 *
 * 监听的事件都是既有事件，不新增 AI 侧 IPC：
 *   player:melee-start  { x, y, facing, stage, phaseId, airKick }   玩家出招
 *   ai:damage           { x, y, amount, target }                    命中目标
 *   ai:fx               { type, x, y, radius?, kind?, text? }       敌人行为预告
 *
 * 深度：30~33（玩家 20 之上、HUD 1000 之下），不会被场景瓦片挡住。
 */

const FX_DEPTH = Object.freeze({ slash: 31, spark: 32, telegraph: 30, burst: 30 });

/** 三阶段挥击配色：青年冷白、中年暖金、老年淡紫 */
const SLASH_COLOR = Object.freeze({
  youth: 0xbfe3ff,
  middle: 0xffd76a,
  elder: 0xc9a6ff,
});

/** 玩家挥击：朝面向一侧画一道弧光，由小放大并淡出 */
function spawnSlash(scene, payload) {
  const { x, y, facing, stage = 1, phaseId = 'youth', airKick = false } = payload ?? {};
  if (typeof x !== 'number' || typeof y !== 'number') return;

  const color = SLASH_COLOR[phaseId] ?? 0xffffff;
  const radius = 17 + Math.min(stage, 3) * 2.5;
  const arc = Math.PI * 0.85;
  const mid = facing > 0 ? 0 : Math.PI;
  // 空中飞踢的弧光抬到脚前方
  const originY = airKick ? y - 18 : y - 10;
  // 往面向一侧偏 7px：让弧光看起来是"挥出去"的，而不是糊在身上
  const originX = x + facing * 7;

  const g = scene.add.graphics({ x: originX, y: originY }).setDepth(FX_DEPTH.slash);
  // 外层柔光
  g.lineStyle(stage >= 3 ? 7 : 6, color, 0.28);
  g.beginPath();
  g.arc(0, 0, radius, mid - arc / 2, mid + arc / 2, false);
  g.strokePath();
  // 主体月牙
  g.lineStyle(stage >= 3 ? 4 : 3, color, 0.95);
  g.beginPath();
  g.arc(0, 0, radius, mid - arc / 2, mid + arc / 2, false);
  g.strokePath();
  // 内侧高光：白芯，保证在米色墙面和绿色墙裙上都看得见
  g.lineStyle(1, 0xffffff, 0.85);
  g.beginPath();
  g.arc(0, 0, radius - 3, mid - arc / 2.6, mid + arc / 2.6, false);
  g.strokePath();
  g.setScale(0.75);

  scene.tweens.add({
    targets: g,
    alpha: { from: 0.95, to: 0 },
    scaleX: 1.3,
    scaleY: 1.3,
    duration: 160,
    ease: 'Quad.easeOut',
    onComplete: () => g.destroy(),
  });
}

/** 命中火花：以命中点为中心放射短线 */
function spawnHitSpark(scene, x, y, strong) {
  if (typeof x !== 'number' || typeof y !== 'number') return;

  const count = strong ? 9 : 6;
  const len = strong ? 14 : 9;
  const g = scene.add.graphics({ x, y }).setDepth(FX_DEPTH.spark);
  // 暖黄射线 + 白核：米色墙面和绿色墙裙上都能分辨
  g.lineStyle(strong ? 3 : 2, strong ? 0xffc93c : 0xffd76a, 1);
  for (let i = 0; i < count; i += 1) {
    const a = (Math.PI * 2 * i) / count + (i % 2) * 0.24;
    g.beginPath();
    g.moveTo(Math.cos(a) * 2, Math.sin(a) * 2);
    g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    g.strokePath();
  }
  // 中心一点白核
  g.fillStyle(0xffffff, 0.9).fillCircle(0, 0, strong ? 3 : 2);

  scene.tweens.add({
    targets: g,
    alpha: 0,
    scaleX: 1.55,
    scaleY: 1.55,
    duration: 130,
    ease: 'Quad.easeOut',
    onComplete: () => g.destroy(),
  });
}

/** 向外扩散的圆环（预警、爆炸、护盾共用） */
function spawnRing(scene, x, y, { r0, r1, color, duration, width = 2 }) {
  const g = scene.add.graphics({ x, y }).setDepth(FX_DEPTH.telegraph);
  g.lineStyle(width, color, 0.9);
  g.strokeCircle(0, 0, r0);
  scene.tweens.add({
    targets: g,
    scaleX: r1 / Math.max(r0, 1),
    scaleY: r1 / Math.max(r0, 1),
    alpha: 0,
    duration,
    ease: 'Quad.easeOut',
    onComplete: () => g.destroy(),
  });
}

/** 实心爆点（爆炸中心） */
function spawnBurst(scene, x, y, radius, color) {
  const g = scene.add.graphics({ x, y }).setDepth(FX_DEPTH.burst);
  g.fillStyle(color, 0.5).fillCircle(0, 0, radius);
  scene.tweens.add({
    targets: g,
    scaleX: 1.6,
    scaleY: 1.6,
    alpha: 0,
    duration: 220,
    ease: 'Quad.easeOut',
    onComplete: () => g.destroy(),
  });
}

/** 踩地 / 砸地：地面扬尘，几道短竖线向上散开 */
function spawnDust(scene, x, y, strong) {
  const g = scene.add.graphics({ x, y }).setDepth(FX_DEPTH.telegraph);
  g.lineStyle(strong ? 3 : 2, 0xd8cdb4, 0.85);
  for (let i = -2; i <= 2; i += 1) {
    g.beginPath();
    g.moveTo(i * 5, 0);
    g.lineTo(i * 7, -(strong ? 10 : 6));
    g.strokePath();
  }
  scene.tweens.add({
    targets: g,
    y: y - 3,
    alpha: 0,
    duration: 260,
    ease: 'Quad.easeOut',
    onComplete: () => g.destroy(),
  });
}

/** 敌人行为预告（ai:fx）→ 可视化 */
function spawnEnemyFx(scene, fx) {
  const { type, x, y, radius } = fx ?? {};
  const hasPoint = typeof x === 'number' && typeof y === 'number';

  switch (type) {
    case 'warning':
      // 冲锋 / 自爆 / 词典落点的红色警戒圈
      if (hasPoint) spawnRing(scene, x, y, { r0: 3, r1: 18, color: 0xff6b6b, duration: 320, width: 2 });
      break;
    case 'explode':
      if (hasPoint) {
        spawnBurst(scene, x, y, radius ?? 24, 0xffb347);
        spawnRing(scene, x, y, { r0: 4, r1: (radius ?? 24) * 1.15, color: 0xffd76a, duration: 240, width: 3 });
      }
      break;
    case 'slam':
      if (hasPoint) spawnDust(scene, x, y, true);
      break;
    case 'stomp':
      if (hasPoint) spawnDust(scene, x, y, false);
      break;
    case 'drain':
      if (hasPoint) spawnRing(scene, x, y, { r0: 10, r1: 2, color: 0x8fd0ff, duration: 280, width: 2 });
      break;
    case 'shieldRestore':
      if (hasPoint) spawnRing(scene, x, y, { r0: 6, r1: 20, color: 0x9ad0ff, duration: 300, width: 2 });
      break;
    case 'shieldBreak':
      if (hasPoint) spawnRing(scene, x, y, { r0: 18, r1: 4, color: 0xff8f8f, duration: 260, width: 3 });
      break;
    case 'shield':
      if (hasPoint) spawnRing(scene, x, y, { r0: 8, r1: 14, color: 0x9ad0ff, duration: 200, width: 1 });
      break;
    default:
      break;
  }
}

/**
 * 安装特效层。重复安装会直接返回（场景 restart 时由 shutdown 解绑）。
 * @param {import('phaser').Scene} scene
 */
export function installHitFx(scene) {
  if (scene._hitFxInstalled) return;
  scene._hitFxInstalled = true;

  const onSlash = (payload) => spawnSlash(scene, payload);
  const onDamage = ({ x, y, amount }) => spawnHitSpark(scene, x, y, (amount ?? 0) >= 20);
  const onAiFx = (fx) => spawnEnemyFx(scene, fx);

  scene.events.on('player:melee-start', onSlash);
  scene.events.on('ai:damage', onDamage);
  scene.events.on('ai:fx', onAiFx);

  scene.events.once('shutdown', () => {
    scene.events.off('player:melee-start', onSlash);
    scene.events.off('ai:damage', onDamage);
    scene.events.off('ai:fx', onAiFx);
    scene._hitFxInstalled = false;
  });
}
