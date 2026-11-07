/**
 * EasterEggModal —— 彩蛋阅读弹窗（成员 E 交付模块）
 *
 * 功能（对应《开发分工与GitHub协作规范》成员 E 第 2 条验收项）：
 *   触碰彩蛋（小狗纸箱 / 答题卡 / 保温杯）时弹出：
 *   - 居中特写卡片（DOM 实现，中英文混排友好，复古像素风）
 *   - 全局慢动作：弹窗开启时 EasterEggModal.timeScale === 0.25
 *   - 打字机逐字显示，空格 / J / 点击 先补全再关闭，Esc 直接关闭
 *   - 内置 GDD 4.4 / 5.5 三个彩蛋的原文案预设（EGG_PRESETS）
 *
 * 集成方式（成员 C/D 对接）：
 *   import { EasterEggModal, EGG_PRESETS } from '../ui/EasterEggModal.js';
 *
 *   // 触碰彩蛋时（由碰撞检测触发）：
 *   EasterEggModal.open({
 *     ...EGG_PRESETS.dog,                 // dog / answer / cup
 *     onOpen:  () => audio.play('egg'),   // 解锁音效（可选）
 *     onTick:  () => audio.play('typing'),// 打字机滴答（可选）
 *     onClose: () => audio.play('ui'),
 *   });
 *
 *   // 成员 C 主循环（★ 慢动作接入点）：
 *   dt *= EasterEggModal.timeScale;       // 弹窗开启时自动变慢，关闭自动恢复 1
 *   if (EasterEggModal.isOpen) { ... }    // 建议暂停敌人攻击判定
 *
 *   // 全局事件（可监听做额外处理）：
 *   window.addEventListener('egg-modal:open',  e => ...);  // e.detail.timeScale
 *   window.addEventListener('egg-modal:close', e => ...);
 */

/** 三个彩蛋的文案预设（与 GDD 原文一致，改动文案只改这里） */
export const EGG_PRESETS = {
  /** 第一关 · 彩蛋 1：纸箱里的小狗 */
  dog: {
    key: 'dog',
    title: '纸箱里的小狗',
    icon: '🐶',
    theme: 'dog',
    lines: [
      '放学路上遇到的那只流浪小狗，',
      '从此成了少年生命里最忠诚的底色。',
    ],
    reward: '获得永久随从伙伴【忠犬·阿黄】！',
  },
  /** 第一关 · 彩蛋 2：试卷答案 */
  answer: {
    key: 'answer',
    title: '试卷答案',
    icon: '📄',
    theme: 'paper',
    lines: [
      '标准答案永远只有一行，',
      '但这真的是人生的全部解法吗？',
    ],
    reward: '能量上限 50→80 ｜ 回能 2→4点/秒 ｜ 粉笔头升级为穿透红笔',
  },
  /** 第二关 · 彩蛋：未拆封的保温杯 */
  cup: {
    key: 'cup',
    title: '未拆封的保温杯',
    icon: '☕',
    theme: 'cup',
    lines: [
      '在最泥泞沉重的中年岁月里，',
      '一杯热茶与脚边那团沉睡的暖毛，',
      '是你对抗世界的所有铠甲。',
    ],
    reward: '获得永久增益【暖心守护（随从进化）】',
  },
};

export class EasterEggModal {
  constructor() {
    this.isOpen = false;
    this.timeScale = 1;      // 全局慢放系数，主循环读取
    this._cfg = null;
    this._el = null;
    this._textEl = null;
    this._hintEl = null;
    this._typingTimer = null;
    this._nextTimer = null;
    this._typingDone = false;
    this._lineIdx = 0;
    this._charIdx = 0;
    this._ensureStyle();
  }

  /* ---------- 静态单例入口 ---------- */

  static get isOpen() {
    return !!(EasterEggModal._inst && EasterEggModal._inst.isOpen);
  }

  static get timeScale() {
    return EasterEggModal._inst ? EasterEggModal._inst.timeScale : 1;
  }

  static open(cfg) {
    if (!EasterEggModal._inst) EasterEggModal._inst = new EasterEggModal();
    return EasterEggModal._inst.open(cfg);
  }

  static close() {
    if (EasterEggModal._inst) EasterEggModal._inst.close();
  }

  /* ---------- 打开 / 关闭 ---------- */

  open(cfg = EGG_PRESETS.dog) {
    if (this.isOpen) return;
    this._cfg = cfg;
    this.isOpen = true;
    this.timeScale = cfg.timeScale || 0.25;
    this._build();
    window.dispatchEvent(new CustomEvent('egg-modal:open', {
      detail: { timeScale: this.timeScale, key: cfg.key },
    }));
    window.addEventListener('keydown', this._onInput, true);
    if (cfg.onOpen) cfg.onOpen();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.timeScale = 1;
    clearInterval(this._typingTimer);
    clearTimeout(this._nextTimer);
    window.removeEventListener('keydown', this._onInput, true);
    if (this._el) { this._el.remove(); this._el = null; }
    window.dispatchEvent(new CustomEvent('egg-modal:close', {
      detail: { key: this._cfg && this._cfg.key },
    }));
    if (this._cfg && this._cfg.onClose) this._cfg.onClose();
  }

  /* ---------- 输入处理 ---------- */

  _onInput = (e) => {
    if (!this.isOpen) return;
    if (e.type === 'click' || ['Space', 'Enter', 'KeyJ', 'Escape'].includes(e.code)) {
      e.preventDefault();
      e.stopPropagation();
      if (!this._typingDone) this._finishTyping();
      else this.close();
    }
  };

  /* ---------- 构建与打字机 ---------- */

  _build() {
    const cfg = this._cfg;
    const el = document.createElement('div');
    el.className = 'egg-modal';
    el.innerHTML = `
      <div class="egg-card egg-theme-${cfg.theme || 'paper'}">
        <div class="egg-icon">${cfg.icon || '✨'}</div>
        <div class="egg-title">${cfg.title || ''}</div>
        <div class="egg-text"></div>
        <div class="egg-reward">${cfg.reward || ''}</div>
        <div class="egg-hint">[ 按 空格 / J / 点击 继续 ]</div>
      </div>`;
    el.addEventListener('click', this._onInput);
    document.body.appendChild(el);
    this._el = el;
    this._textEl = el.querySelector('.egg-text');
    this._hintEl = el.querySelector('.egg-hint');
    this._hintEl.style.display = 'none';
    this._typingDone = false;
    this._lineIdx = 0;
    this._typeLine();
  }

  _typeLine() {
    if (!this.isOpen || this._typingDone) return;
    const lines = this._cfg.lines || [''];
    if (this._lineIdx >= lines.length) { this._finishTyping(); return; }
    const line = lines[this._lineIdx];
    this._charIdx = 0;
    const div = document.createElement('div');
    div.className = 'egg-line';
    this._textEl.appendChild(div);
    this._typingTimer = setInterval(() => {
      this._charIdx++;
      div.textContent = line.slice(0, this._charIdx);
      if (this._cfg.onTick) this._cfg.onTick();
      if (this._charIdx >= line.length) {
        clearInterval(this._typingTimer);
        this._lineIdx++;
        this._nextTimer = setTimeout(() => this._typeLine(), 350);
      }
    }, this._cfg.charInterval || 45);
  }

  /** 一次性补齐全部文本并显示关闭提示 */
  _finishTyping() {
    if (this._typingDone) return;
    clearInterval(this._typingTimer);
    clearTimeout(this._nextTimer);
    const lines = this._cfg.lines || [''];
    this._textEl.innerHTML = '';
    for (const l of lines) {
      const div = document.createElement('div');
      div.className = 'egg-line';
      div.textContent = l;
      this._textEl.appendChild(div);
    }
    this._typingDone = true;
    if (this._hintEl) this._hintEl.style.display = 'block';
  }

  /* ---------- 样式（只注入一次） ---------- */

  _ensureStyle() {
    if (document.getElementById('egg-modal-style')) return;
    const css = `
      .egg-modal {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(8,8,12,.62);
        display: flex; align-items: center; justify-content: center;
        font-family: "Courier New", "Sarasa Mono SC", "Noto Sans Mono CJK SC", monospace;
        cursor: pointer; user-select: none;
      }
      .egg-card {
        width: min(430px, 86vw); box-sizing: border-box;
        background: #fdf3d8; color: #40382b;
        border: 4px solid #40382b;
        box-shadow: 0 0 0 4px #fdf3d8, 0 0 0 8px #40382b, 8px 10px 0 rgba(0,0,0,.35);
        padding: 22px 20px 14px; text-align: center;
        animation: egg-pop .25s steps(4) both;
      }
      .egg-theme-dog   { background: #ffe9d6; }
      .egg-theme-paper { background: #f7f3e3; }
      .egg-theme-cup   { background: #e3eef6; }
      .egg-icon  { font-size: 44px; line-height: 1; margin-bottom: 8px; }
      .egg-title { font-size: 18px; font-weight: bold; letter-spacing: 2px; margin-bottom: 12px; }
      .egg-text  {
        min-height: 3.6em; font-size: 14px; line-height: 1.8;
        text-align: left; padding: 0 8px; white-space: pre-wrap;
      }
      .egg-line  { min-height: 1.4em; }
      .egg-reward {
        margin-top: 12px; font-size: 12px; color: #b4532c;
        border-top: 2px dashed #c9b58d; padding-top: 8px;
      }
      .egg-hint { margin-top: 12px; font-size: 11px; color: #8a7a5f; animation: egg-blink 1s steps(2) infinite; }
      @keyframes egg-pop  { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes egg-blink { 50% { opacity: .25; } }
    `;
    const style = document.createElement('style');
    style.id = 'egg-modal-style';
    style.textContent = css;
    document.head.appendChild(style);
  }
}
