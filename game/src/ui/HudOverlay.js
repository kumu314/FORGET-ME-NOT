import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig.js';
import { BattleHUD } from './BattleHUD.js';

/**
 * BattleHUD 挂载层
 *
 * BattleHUD 是成员 E 交付的纯 Canvas 2D 覆盖层（无 Phaser 依赖），
 * 但它需要一个外部 <canvas> 才能工作 —— 之前仓库里没有任何地方创建这个节点，
 * 所以整套 HUD 一直是死代码。本模块负责三件事：
 *
 *  1. 建一块全屏覆盖 canvas（pointer-events: none，不拦截鼠标键盘）
 *  2. **后备缓冲固定为逻辑分辨率 480×270**，HUD 内部按 scale=1 绘制，
 *     再由 CSS 把这块缓冲拉伸到与 Phaser 主画布完全重合的矩形上。
 *     这样做是为了避免"HUD 自己算整数倍缩放 + Phaser 自己算 FIT 缩放"
 *     两套几何各算一遍，导致血条相对游戏画面偏移几十像素。
 *  3. 跟随窗口缩放 / Phaser ScaleManager 事件重新对齐。
 */
const CANVAS_ID = 'hud-overlay';

function ensureCanvas() {
  let canvas = document.getElementById(CANVAS_ID);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    Object.assign(canvas.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      pointerEvents: 'none',
      zIndex: '10',
      imageRendering: 'pixelated',
    });
    document.body.appendChild(canvas);
  }
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  canvas.style.display = 'block';
  return canvas;
}

/**
 * @param {import('phaser').Game} game
 * @returns {{hud: BattleHUD, destroy: () => void}}
 */
export function mountBattleHud(game) {
  const canvas = ensureCanvas();

  const sync = () => {
    const src = game.canvas;
    if (!src) return;
    const rect = src.getBoundingClientRect();
    canvas.style.left = `${rect.left}px`;
    canvas.style.top = `${rect.top}px`;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  };

  sync();
  window.addEventListener('resize', sync);
  game.scale.on('resize', sync);

  const hud = new BattleHUD(canvas);
  hud.setResolution(GAME_WIDTH, GAME_HEIGHT);

  const destroy = () => {
    window.removeEventListener('resize', sync);
    game.scale.off('resize', sync);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = 'none';
  };

  return { hud, destroy };
}

export default mountBattleHud;
