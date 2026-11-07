/**
 * LevelUpModal —— 升级三选一弹窗（issue #17，GDD §3.1）
 *
 * 视觉与交互对齐成员E 的 EasterEggModal（像素卡片、慢幕、键盘可选）：
 *   - 升级时由 XpSystem 调 LevelUpModal.open({ level, onChoose })
 *   - 三张强化卡：攻击力 / 暴击率 / 跳跃滞空（LEVEL_UPGRADES 数值）
 *   - 按 1 / 2 / 3 或点击卡片选择；Esc 不给逃（升级必选其一，GDD 语义）
 *   - 冻结世界：open/close 派发 egg-modal:open / egg-modal:close（与彩蛋弹窗同一契约，
 *     StageScene/AIManager 侧零改动即停摆）
 */

import { LEVEL_UPGRADES } from '../config/gameConfig.js';

/** 三选一的出牌顺序（固定顺序便于键位肌肉记忆） */
export const LEVEL_UP_CHOICES = Object.freeze([
  { id: LEVEL_UPGRADES.attack.id, label: LEVEL_UPGRADES.attack.label, desc: LEVEL_UPGRADES.attack.desc },
  { id: LEVEL_UPGRADES.crit.id, label: LEVEL_UPGRADES.crit.label, desc: LEVEL_UPGRADES.crit.desc },
  { id: LEVEL_UPGRADES.hang.id, label: LEVEL_UPGRADES.hang.label, desc: LEVEL_UPGRADES.hang.desc },
]);

const ICONS = { attack: '👊', crit: '✨', hang: '🕊' };

export class LevelUpModal {
  constructor() {
    this.isOpen = false;
    this._cfg = null;
    this._el = null;
    this._ensureStyle();
  }

  static get isOpen() {
    return !!(LevelUpModal._inst && LevelUpModal._inst.isOpen);
  }

  static open(cfg) {
    if (!LevelUpModal._inst) LevelUpModal._inst = new LevelUpModal();
    return LevelUpModal._inst.open(cfg);
  }

  static close() {
    if (LevelUpModal._inst) LevelUpModal._inst.close(true);
  }

  open(cfg = {}) {
    if (this.isOpen) return;
    this._cfg = cfg;
    this.isOpen = true;
    window.dispatchEvent(new CustomEvent('levelup-modal:open', { detail: { level: cfg.level } }));
    this._build();
    window.addEventListener('keydown', this._onInput, true);
  }

  /** silent=true 用于系统收尾（XpSystem.destroy），不再触发 onChoose */
  close(silent = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    window.removeEventListener('keydown', this._onInput, true);
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
    window.dispatchEvent(new CustomEvent('levelup-modal:close', { detail: { level: this._cfg?.level } }));
    if (!silent && this._cfg?.onClose) this._cfg.onClose();
  }

  _choose(id) {
    if (!this.isOpen) return;
    const onChoose = this._cfg?.onChoose;
    this.close(true);
    onChoose?.(id);
  }

  _onInput = (e) => {
    if (!this.isOpen) return;
    const map = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };
    if (e.code in map) {
      e.preventDefault();
      e.stopPropagation();
      const choice = LEVEL_UP_CHOICES[map[e.code]];
      this._choose(choice.id);
    }
  };

  _build() {
    const cards = LEVEL_UP_CHOICES.map(
      (c, i) => `
      <div class="lvl-card" data-id="${c.id}">
        <div class="lvl-key">${i + 1}</div>
        <div class="lvl-icon">${ICONS[c.id] ?? '⭐'}</div>
        <div class="lvl-name">${c.label}</div>
        <div class="lvl-desc">${c.desc}</div>
      </div>`,
    ).join('');

    const el = document.createElement('div');
    el.className = 'lvlup-modal';
    el.innerHTML = `
      <div class="lvlup-card">
        <div class="lvlup-title">level up · 领悟 Lv.${this._cfg?.level ?? 1}</div>
        <div class="lvlup-sub">选择一项强化（按 1 / 2 / 3 或点击）</div>
        <div class="lvl-cards">${cards}</div>
      </div>`;
    el.addEventListener('click', (e) => {
      const card = e.target.closest('.lvl-card');
      if (card) this._choose(card.dataset.id);
    });
    document.body.appendChild(el);
    this._el = el;
  }

  _ensureStyle() {
    if (document.getElementById('lvlup-modal-style')) return;
    const css = `
      .lvlup-modal {
        position: fixed; inset: 0; z-index: 9998;
        background: rgba(8,8,12,.55);
        display: flex; align-items: center; justify-content: center;
        font-family: "Courier New", "Sarasa Mono SC", "Noto Sans Mono CJK SC", monospace;
        user-select: none;
      }
      .lvlup-card {
        width: min(460px, 92vw); box-sizing: border-box;
        background: #10201a; color: #ffe9a8;
        border: 4px solid #ffe9a8;
        box-shadow: 0 0 0 4px #10201a, 0 0 0 8px #ffe9a8, 8px 10px 0 rgba(0,0,0,.4);
        padding: 14px 14px 12px; text-align: center;
        animation: lvlup-pop .25s steps(4) both;
      }
      .lvlup-title { font-size: 16px; font-weight: bold; letter-spacing: 2px; color: #ffd75b; }
      .lvlup-sub  { font-size: 10px; color: #cfe8c9; margin-top: 4px; }
      .lvl-cards  { display: flex; gap: 8px; margin-top: 10px; }
      .lvl-card {
        flex: 1; cursor: pointer; padding: 10px 6px 8px;
        background: #1b3328; border: 2px solid #4d7a5f;
        transition: transform .08s steps(2), border-color .08s;
      }
      .lvl-card:hover { transform: translateY(-3px); border-color: #ffd75b; }
      .lvl-key   { display:inline-block; font-size: 9px; color:#10201a; background:#ffd75b;
                   padding: 0 5px; margin-bottom: 4px; }
      .lvl-icon  { font-size: 22px; line-height: 1.2; }
      .lvl-name  { font-size: 12px; font-weight: bold; margin-top: 2px; color: #fff3c4; }
      .lvl-desc  { font-size: 9px; color: #b8d4b0; margin-top: 4px; line-height: 1.5; }
      @keyframes lvlup-pop { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `;
    const style = document.createElement('style');
    style.id = 'lvlup-modal-style';
    style.textContent = css;
    document.head.appendChild(style);
  }
}
