/**
 * 输入层（成员C）
 *
 * 职责：把键盘物理按键收敛成一份"语义化输入快照"，供 Player.js 消费。
 * - 6 个核心键：A/D 移动、Space 跳跃、S 格挡、J 近战、L 远程。
 * - 空中组合键（Space+J / Space+L）不在这里裁决：统一由 Player 依据"当前是否离地"判定，
 *   于是老年期"禁跳"时组合键会自动失效，输入层不需要任何特判。
 */

import { KEYS } from '../config/gameConfig.js';

/** 一次输入采样：布尔量描述"此刻的意图" */
export function createIdleState() {
  return {
    left: false,
    right: false,
    /**
     * 跳跃本帧刚按下（边沿）。跳跃必须用边沿：按住 Space 不能自动连跳，
     * 否则落地瞬间会被"仍按住的 Space"重新弹起。
     */
    jumpDown: false,
    jumpHeld: false,
    blockHeld: false,
    /**
     * 近战/远程用"按住 (held)"而不是边沿：判定与起手时机由 Player 的
     * 连击窗口 / 冷却时间去裁决，长按 J 就能顺畅打出三连击。
     */
    meleeHeld: false,
    rangedHeld: false,
    /** 与状态机无关的原始按住记录，仅用于跳跃边沿计算 */
    _held: { jump: false },
  };
}

/**
 * 纯函数：由"当前按住的键集合 + 上一帧快照"推导本帧输入快照。
 * 抽成纯函数以便在 Node 里直接单测（不依赖 Phaser / DOM）。
 *
 * @param {Set<string>|string[]} heldGroups 当前按住的语义键名（'left' | 'jump' | ...）
 * @param {ReturnType<typeof createIdleState>|null} [prev] 上一帧快照
 */
export function computeInputState(heldGroups, prev = null) {
  const held = heldGroups instanceof Set ? heldGroups : new Set(heldGroups ?? []);
  const wasJump = prev?._held?.jump ?? false;
  const jumpHeld = held.has('jump');

  return {
    left: held.has('left'),
    right: held.has('right'),
    jumpDown: jumpHeld && !wasJump,
    jumpHeld,
    blockHeld: held.has('block'),
    meleeHeld: held.has('melee'),
    rangedHeld: held.has('ranged'),
    _held: { jump: jumpHeld },
  };
}

/** 由"物理键码集合"推导"语义键集合" */
export function toHeldGroups(heldKeyCodes) {
  const codes = heldKeyCodes instanceof Set ? heldKeyCodes : new Set(heldKeyCodes ?? []);
  const groups = new Set();
  for (const [group, list] of Object.entries(KEYS)) {
    if (list.some((code) => codes.has(code))) groups.add(group);
  }
  return groups;
}

/**
 * Phaser 版输入控制器：每帧从 KeyboardPlugin 采样，getState() 返回本帧快照。
 */
export class InputController {
  /**
   * @param {import('phaser').Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.keyboard = scene.input?.keyboard ?? null;
    this.state = createIdleState();
    this._keyMap = new Map(); // code -> Phaser.Key
    this._unbind = [];
    this._capture();
  }

  _capture() {
    const kb = this.keyboard;
    if (!kb || typeof kb.addKey !== 'function') return;

    // 空格 / 方向键会滚动页面，游戏内一律拦截
    const shouldCapture = new Set(['SPACE', 'DOWN', 'UP', 'LEFT', 'RIGHT']);

    for (const code of Object.values(KEYS).flat()) {
      const key = kb.addKey(code, true, false);
      if (!key) continue;
      this._keyMap.set(code, key);
      if (shouldCapture.has(code) && typeof key.addCapture === 'function') {
        key.addCapture();
      }
    }

    // 切出窗口时清空按键，防止"卡住一直往右跑"
    const onBlur = () => this.flush();
    const events = this.scene.game?.events;
    if (events?.on) {
      events.on('blur', onBlur);
      this._unbind.push(() => events.off('blur', onBlur));
    }
  }

  /** 采样一次并推进边沿状态 */
  update() {
    const codeSet = new Set();
    for (const [code, key] of this._keyMap) {
      if (key.isDown) codeSet.add(code);
    }
    this.state = computeInputState(toHeldGroups(codeSet), this.state);
    return this.state;
  }

  /** @returns {ReturnType<typeof createIdleState>} */
  getState() {
    return this.state;
  }

  /** 清空按住状态（失焦 / 暂停时调用） */
  flush() {
    this.state = createIdleState();
  }

  destroy() {
    this._unbind.forEach((fn) => fn());
    this._unbind = [];
    this._keyMap.clear();
    this.flush();
  }
}
