import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/gameConfig.js';
import BootScene from './scenes/BootScene.js';
import StageScene from './scenes/StageScene.js';
import EndingScene from './scenes/EndingScene.js';
import { mountAudioControls } from './ui/AudioControls.js';

/**
 * Phaser.Game 配置与初始化入口
 *
 * 关键渲染约定（设计文档 §1.1）：
 *  - WebGL 优先，降级 Canvas
 *  - pixelArt: true → 最近邻采样，杜绝像素边缘模糊
 *  - 逻辑原生分辨率 480×270，FIT 整体缩放并按整数倍对齐
 */
const config = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0b0b10',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  render: {
    pixelArt: true,
    antialias: false,
  },
  physics: {
    default: 'arcade',
    arcade: {
      // 世界重力交给 Player 自身的 gravityY：老年"禁跳"必须能完全关掉离地
      gravity: { y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  fps: { target: 60 },
};

/** 创建游戏实例（供入口与调试复用） */
export function createGame() {
  return new Phaser.Game({ ...config, scene: [BootScene, StageScene, EndingScene] });
}

/* ---------------- 全局错误兜底（任务卡 3） ----------------
 * 目的：演示现场哪怕真崩了，也要「能看懂 + 能重来」，而不是黑屏。
 * 不做自动重启（会掩盖问题），只提示 + 提供刷新按钮。
 */

/**
 * 构建致命错误提示层（纯 DOM，不依赖 Phaser）。
 * @param {Document} doc
 * @returns {HTMLElement|null}
 */
export function buildErrorOverlay(doc = (typeof document !== 'undefined' ? document : undefined)) {
  if (!doc || typeof doc.createElement !== 'function') return null;
  const el = doc.createElement('div');
  el.id = 'fmn-fatal-overlay';
  if (typeof el.setAttribute === 'function') el.setAttribute('role', 'alert');
  el.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999', 'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center', 'gap:12px', 'padding:24px',
    'background:rgba(10,10,16,.86)', 'color:#f4f0e6', 'text-align:center',
    'font:14px/1.6 "Microsoft YaHei","SimHei",sans-serif', 'cursor:default',
  ].join(';');

  const title = doc.createElement('div');
  title.textContent = '游戏遇到异常，请刷新重试';
  title.style.cssText = 'font-size:16px;font-weight:600';

  const tip = doc.createElement('div');
  tip.textContent = '错误信息已输出到控制台（Console），刷新后可继续。';
  tip.style.cssText = 'font-size:12px;opacity:.75';

  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.textContent = '刷新页面';
  btn.style.cssText = 'padding:8px 18px;border:2px solid #f4f0e6;background:transparent;color:#f4f0e6;font:inherit;cursor:pointer';
  btn.addEventListener('click', () => {
    if (typeof location !== 'undefined' && typeof location.reload === 'function') location.reload();
  });

  el.appendChild(title);
  el.appendChild(tip);
  el.appendChild(btn);
  return el;
}

/**
 * 记录并展示致命错误（重复错误只保留一个提示层）。
 * @returns {HTMLElement|null}
 */
export function reportFatalError(error, { doc = (typeof document !== 'undefined' ? document : undefined) } = {}) {
  try {
    const detail = error && (error.stack || error.message) ? (error.stack || error.message) : String(error ?? '未知错误');
    console.error('[fmn] 未捕获异常：', detail);
  } catch { /* console 不可用时忽略 */ }
  if (!doc || !doc.body) return null;
  let overlay = typeof doc.getElementById === 'function' ? doc.getElementById('fmn-fatal-overlay') : null;
  if (!overlay) {
    overlay = buildErrorOverlay(doc);
    if (overlay) doc.body.appendChild(overlay);
  }
  return overlay;
}

/**
 * 安装全局错误兜底：window.error + unhandledrejection。
 * @returns {boolean} 是否本次完成安装（重复安装返回 false）
 */
export function installGlobalErrorGuard(
  win = (typeof window !== 'undefined' ? window : undefined),
  doc = (typeof document !== 'undefined' ? document : undefined),
) {
  if (!win || win.__FMN_ERROR_GUARD__) return false;
  win.__FMN_ERROR_GUARD__ = true;
  win.addEventListener('error', (event) => {
    reportFatalError(event && (event.error ?? event.message), { doc });
  });
  win.addEventListener('unhandledrejection', (event) => {
    reportFatalError(event && (event.reason ?? '未处理的 Promise 拒绝'), { doc });
  });
  return true;
}

// 挂载到 window 便于 CI/调试时用脚本取状态与截图
const game = createGame();
const audioControls = mountAudioControls();
game.events.once('destroy', () => audioControls.destroy());
if (typeof window !== 'undefined') {
  window.__FORGET_ME_NOT__ = game;
  installGlobalErrorGuard();
}

export default game;
