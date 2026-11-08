/**
 * HelpOverlay —— 操作说明面板（Tab 键唤出）
 *
 * 交互：
 *   - 游戏中按 Tab 打开 / 关闭；打开时通过 StageScene 既有的 modalOpen 机制暂停世界
 *   - Esc 或点击遮罩关闭
 *   - 打开期间浏览器默认的 Tab 焦点切换被 preventDefault 拦下，不会跳走焦点
 *   - 其他弹窗（彩蛋 / 升级 / 结局）打开时不抢 Tab
 *
 * 内容全部由 config/gameConfig.js 的 KEYS 派生，键位改了说明会跟着改，不会对不上。
 */

import { KEYS } from '../config/gameConfig.js';
import { isUiInputTarget } from '../core/Input.js';

/** Phaser 键名 → 面板上展示的按键文字 */
const KEY_LABELS = Object.freeze({
  LEFT: '←',
  RIGHT: '→',
  UP: '↑',
  DOWN: '↓',
  SPACE: '空格',
  A: 'A',
  D: 'D',
  S: 'S',
  J: 'J',
  L: 'L',
  T: 'T',
  R: 'R',
  TAB: 'Tab',
  ESC: 'Esc',
});

/**
 * 操作说明的分组内容。
 * `group` 指向 KEYS 里的语义键组，渲染时取 KEYS[group]；
 * 测试会校验两者始终一致，避免文案与真实键位漂移。
 */
export const HELP_SECTIONS = Object.freeze([
  {
    title: '移动',
    rows: Object.freeze([
      { action: '向左移动', group: 'left' },
      { action: '向右移动', group: 'right' },
      { action: '跳跃（老年期改为驻足喘息）', group: 'jump' },
    ]),
  },
  {
    title: '战斗',
    rows: Object.freeze([
      { action: '格挡：减伤 70%，受击前 0.2 秒内按住为完美格挡', group: 'block' },
      { action: '近战三连击（连续按 J 续接）', group: 'melee' },
      { action: '远程粉笔头（消耗能量）', group: 'ranged' },
    ]),
  },
  {
    title: '系统',
    rows: Object.freeze([
      { action: '切换年龄：青年 → 中年 → 老年（演示用）', keys: Object.freeze(['T']) },
      { action: '原地复活到最近检查点', keys: Object.freeze(['R']) },
      { action: '打开 / 关闭本操作说明（打开时暂停游戏）', keys: Object.freeze(['TAB']) },
      { action: '关闭弹窗 / 本说明', keys: Object.freeze(['ESC']) },
    ]),
  },
]);

/** 面板展示用的按键文字；未知键名原样显示 */
export function keyLabel(code) {
  return KEY_LABELS[code] ?? code;
}

export class HelpOverlay {
  constructor() {
    this.isOpen = false;
    this._el = null;
    this._ensureStyle();
  }

  static get isOpen() {
    return !!(HelpOverlay._inst && HelpOverlay._inst.isOpen);
  }

  static open() {
    if (!HelpOverlay._inst) HelpOverlay._inst = new HelpOverlay();
    return HelpOverlay._inst.open();
  }

  static close() {
    if (HelpOverlay._inst) HelpOverlay._inst.close();
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this._build();
    window.addEventListener('keydown', this._onKey, true);
    window.dispatchEvent(new CustomEvent('help-overlay:open'));
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    window.removeEventListener('keydown', this._onKey, true);
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
    window.dispatchEvent(new CustomEvent('help-overlay:close'));
  }

  _onKey = (e) => {
    if (!this.isOpen) return;
    if (e.code === 'Escape' || e.code === 'Tab') {
      e.preventDefault?.();
      e.stopPropagation?.();
      this.close();
    }
  };

  _build() {
    const root = document.createElement('div');
    root.className = 'help-overlay';

    const card = document.createElement('div');
    card.className = 'help-card';

    const title = document.createElement('div');
    title.className = 'help-title';
    title.textContent = '操作说明';

    const sub = document.createElement('div');
    sub.className = 'help-sub';
    sub.textContent = '打开时游戏暂停 · 按 Tab 或 Esc 关闭';

    card.append(title, sub);

    for (const section of HELP_SECTIONS) {
      const block = document.createElement('div');
      block.className = 'help-section';

      const heading = document.createElement('div');
      heading.className = 'help-section-title';
      heading.textContent = section.title;
      block.appendChild(heading);

      for (const row of section.rows) {
        const codes = row.group ? KEYS[row.group] : row.keys;

        const line = document.createElement('div');
        line.className = 'help-row';

        const keys = document.createElement('div');
        keys.className = 'help-keys';
        for (const code of codes) {
          const kbd = document.createElement('kbd');
          kbd.textContent = keyLabel(code);
          keys.appendChild(kbd);
        }

        const action = document.createElement('div');
        action.className = 'help-action';
        action.textContent = row.action;

        line.append(keys, action);
        block.appendChild(line);
      }

      card.appendChild(block);
    }

    const footer = document.createElement('div');
    footer.className = 'help-footer';
    footer.textContent = '[ Tab / Esc 关闭 ]';
    card.appendChild(footer);

    root.appendChild(card);
    // 只点遮罩关闭，点卡片内部不关闭，方便滚动阅读
    root.addEventListener('click', (e) => {
      if (e.target === root) this.close();
    });

    document.body.appendChild(root);
    this._el = root;
  }

  _ensureStyle() {
    if (document.getElementById('help-overlay-style')) return;
    const css = `
      .help-overlay {
        position: fixed; inset: 0; z-index: 9997;
        background: rgba(8,8,12,.62);
        display: flex; align-items: center; justify-content: center;
        font-family: "Courier New", "Sarasa Mono SC", "Noto Sans Mono CJK SC", monospace;
        user-select: none;
      }
      .help-card {
        width: min(520px, 92vw); max-height: 86vh; overflow: auto;
        box-sizing: border-box;
        background: #f7f3e3; color: #40382b;
        border: 4px solid #40382b;
        box-shadow: 0 0 0 4px #f7f3e3, 0 0 0 8px #40382b, 8px 10px 0 rgba(0,0,0,.35);
        padding: 18px 20px 14px;
        animation: help-pop .25s steps(4) both;
      }
      .help-title { font-size: 18px; font-weight: bold; letter-spacing: 3px; text-align: center; }
      .help-sub   { font-size: 11px; color: #8a7a5f; text-align: center; margin-top: 6px; }
      .help-section { margin-top: 14px; border-top: 2px dashed #c9b58d; padding-top: 10px; }
      .help-section-title { font-size: 11px; color: #b4532c; letter-spacing: 2px; margin-bottom: 6px; }
      .help-row  { display: flex; align-items: flex-start; gap: 10px; margin: 5px 0; line-height: 1.6; }
      .help-keys { flex: 0 0 118px; display: flex; flex-wrap: wrap; gap: 4px; }
      .help-keys kbd {
        display: inline-block; min-width: 18px; padding: 1px 5px;
        font: inherit; font-size: 11px; text-align: center;
        background: #fffdf4; border: 2px solid #40382b;
        box-shadow: 2px 2px 0 rgba(64,56,43,.35);
      }
      .help-action { flex: 1; font-size: 12px; }
      .help-footer {
        margin-top: 14px; text-align: center; font-size: 11px; color: #8a7a5f;
        animation: help-blink 1s steps(2) infinite;
      }
      @keyframes help-pop   { from { transform: scale(.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes help-blink { 50% { opacity: .3; } }
    `;
    const style = document.createElement('style');
    style.id = 'help-overlay-style';
    style.textContent = css;
    document.head.appendChild(style);
  }
}

/**
 * 安装 Tab 操作说明（每个 StageScene 生命周期装一次，shutdown 自动卸载）。
 * 打开 / 关闭时复用 StageScene 的 modalOpen 机制暂停世界。
 */
export function installHelpOverlay(scene) {
  if (scene._helpOverlay) return scene._helpOverlay;

  const onKeyDown = (event) => {
    if (event.code !== 'Tab' && event.key !== 'Tab') return;
    if (scene.transitioning) return;
    if (isUiInputTarget(event.target)) return;

    // 说明面板未开时，其它弹窗 / 结局期间不抢 Tab；面板已开则随时可关
    if (!HelpOverlay.isOpen && scene.modalOpen) return;

    event.preventDefault?.();
    event.stopPropagation?.();
    if (HelpOverlay.isOpen) HelpOverlay.close();
    else HelpOverlay.open();
  };

  const onOpen = () => scene._setModalPaused?.('help', true);
  const onClose = () => scene._setModalPaused?.('help', false);

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('help-overlay:open', onOpen);
  window.addEventListener('help-overlay:close', onClose);

  const handle = {
    overlay: HelpOverlay,
    destroy() {
      window.removeEventListener('keydown', onKeyDown, true);
      // 先关面板，让 close 事件把 modalOpen 的 help 原因撤掉
      HelpOverlay.close();
      window.removeEventListener('help-overlay:open', onOpen);
      window.removeEventListener('help-overlay:close', onClose);
      if (scene._helpOverlay === handle) scene._helpOverlay = null;
    },
  };

  const onShutdown = () => {
    handle.destroy();
    scene.events.off('shutdown', onShutdown);
  };
  scene.events.once('shutdown', onShutdown);
  scene._helpOverlay = handle;
  return handle;
}
