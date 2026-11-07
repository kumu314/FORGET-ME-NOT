import { describe, expect, it, vi } from 'vitest';

/**
 * 卡 3 稳定性收尾的单测：
 *  1) BattleHUD 空值防护（player 缺失时 render 不抛错）
 *  2) 像素字体探测与安全回退栈
 *  3) main.js 全局错误兜底（error / unhandledrejection 只生成一个提示层）
 *
 * 依赖（Phaser / 场景 / DOM UI）全部 mock，测试只验证纯逻辑。
 */
vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Game: class {
      constructor() {
        this.events = { once: vi.fn() };
      }
    },
    AUTO: 0,
    Scale: { FIT: 0, CENTER_BOTH: 0 },
  },
}));

vi.mock('../src/scenes/sceneHelpers.js', () => ({
  ensurePlaceholderTextures: vi.fn(),
  PARALLAX_SETS: {},
}));
vi.mock('../src/scenes/spriteAtlases.js', () => ({
  preloadSpriteAtlases: vi.fn(),
  registerSpriteAnimations: vi.fn(),
}));
vi.mock('../src/scenes/monsterSprites.js', () => ({
  preloadMonsterSprites: vi.fn(),
  registerMonsterAnimations: vi.fn(),
}));
vi.mock('../src/scenes/StageScene.js', () => ({ default: class StageScene {} }));
vi.mock('../src/scenes/EndingScene.js', () => ({ default: class EndingScene {} }));
vi.mock('../src/ui/AudioControls.js', () => ({ mountAudioControls: () => ({ destroy: vi.fn() }) }));

import { BattleHUD } from '../src/ui/BattleHUD.js';
import { detectPixelFont, applyFontFallback, FONT_FALLBACK_STACK } from '../src/scenes/BootScene.js';
import { buildErrorOverlay, installGlobalErrorGuard } from '../src/main.js';

/** 画布上下文替身：未知方法返回空函数，避免逐项 mock */
function makeCanvas() {
  const ctx = new Proxy(
    {
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: (text) => ({ width: String(text).length * 8 }),
    },
    { get: (target, key) => target[key] ?? (() => {}) },
  );
  return { width: 480, height: 270, getContext: () => ctx, ctx };
}

/** 最小 DOM 替身：只覆盖错误层需要的接口 */
function makeFakeDoc() {
  const added = [];
  const doc = {
    _added: added,
    documentElement: { style: { setProperty: vi.fn() } },
    body: { appendChild: (el) => added.push(el) },
    getElementById: (id) => added.find((el) => el.id === id) ?? null,
    createElement: (tag) => {
      const el = {
        tag,
        id: '',
        style: {},
        children: [],
        textContent: '',
        appendChild(child) {
          this.children.push(child);
        },
        setAttribute: vi.fn(),
        addEventListener: vi.fn(),
      };
      return el;
    },
  };
  return doc;
}

describe('BattleHUD 空值防护（场景切换瞬间）', () => {
  it('player 为 undefined 时 render 不抛错，也不绘制', () => {
    const { ctx } = makeCanvas();
    const hud = new BattleHUD(makeCanvas());
    hud.player = undefined;
    expect(() => hud.render()).not.toThrow();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('player 字段缺失 / NaN / max=0 时仍能安全渲染', () => {
    const hud = new BattleHUD(makeCanvas());
    hud.setPlayer({ hp: NaN, maxHp: 0, mp: undefined, maxMp: undefined });
    expect(() => hud.render()).not.toThrow();
    hud.setPlayer({ hp: 100, maxHp: 200, mp: 20, maxMp: 50 });
    expect(() => hud.render()).not.toThrow();
  });

  it('经验数据缺字段 / next=0 时经验条不产生 NaN 崩溃', () => {
    const hud = new BattleHUD(makeCanvas());
    hud.setXp({ level: undefined, xp: 5, next: 0 });
    expect(() => hud.render()).not.toThrow();
  });
});

describe('像素字体探测与安全回退栈', () => {
  it('像素字体可用时不回退、不告警', () => {
    const fonts = { check: () => true };
    expect(detectPixelFont({ fonts })).toBe(true);
    const warn = vi.fn();
    const result = applyFontFallback({ fonts }, warn);
    expect(result).toEqual({ ok: true, stack: null });
    expect(warn).not.toHaveBeenCalled();
  });

  // 回归：fonts.check 在字体不存在时也返回 true，
  // 所以「有 check 且恒返回 true」不能作为像素字体可用的证据。
  it('FontFaceSet 里没有像素字体时，不因 check 返回 true 而误判为可用', () => {
    const other = { family: 'Arial', status: 'loaded' };
    const fonts = [other]; // 可迭代，但里面没有像素字体
    fonts.check = () => true; // 关键：check 撒谎
    expect(detectPixelFont({ fonts })).toBe(false);
  });

  it('FontFaceSet 里真有像素字体时判定为可用', () => {
    const loaded = { family: 'Zpix', status: 'loaded' };
    const fonts = [loaded];
    fonts.check = () => false; // check 说没有，但集合里明明有
    expect(detectPixelFont({ fonts })).toBe(true);
  });

  it('family 名带引号 / 大小写不同也能匹配', () => {
    const loaded = { family: '"FUSION PIXEL"', status: 'loading' };
    const fonts = [loaded];
    expect(detectPixelFont({ fonts })).toBe(true);
  });

  it('加载失败的 FontFace 不算可用', () => {
    const broken = { family: 'Zpix', status: 'error' };
    const fonts = [broken];
    fonts.check = () => false;
    expect(detectPixelFont({ fonts })).toBe(false);
  });

  it('像素字体缺失时注入黑体优先的回退栈并告警', () => {
    const doc = makeFakeDoc();
    const warn = vi.fn();
    const result = applyFontFallback(doc, warn);
    expect(result.ok).toBe(false);
    expect(result.stack).toBe(FONT_FALLBACK_STACK);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(doc.documentElement.style.setProperty).toHaveBeenCalledWith('--fmn-font-family', FONT_FALLBACK_STACK);
  });

  it('HUD 文本使用注入的字体栈', () => {
    const fonts = [];
    const base = { fillText: vi.fn(), strokeText: vi.fn(), measureText: (t) => ({ width: String(t).length * 8 }) };
    const ctx = new Proxy(base, {
      get: (t, k) => t[k] ?? (() => {}),
      set: (t, k, v) => {
        if (k === 'font') fonts.push(v);
        t[k] = v;
        return true;
      },
    });
    const hud = new BattleHUD({ width: 480, height: 270, getContext: () => ctx });
    hud.setFontFamily(FONT_FALLBACK_STACK);
    hud.render();
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.every((font) => font.includes(FONT_FALLBACK_STACK))).toBe(true);
  });
});

describe('全局错误兜底', () => {
  it('error 事件生成一次提示层，重复错误不叠加', () => {
    const win = new EventTarget();
    const doc = makeFakeDoc();
    expect(installGlobalErrorGuard(win, doc)).toBe(true);
    expect(installGlobalErrorGuard(win, doc)).toBe(false);
    win.dispatchEvent(new Event('error'));
    win.dispatchEvent(new Event('error'));
    const overlays = doc._added.filter((el) => el.id === 'fmn-fatal-overlay');
    expect(overlays).toHaveLength(1);
  });

  it('unhandledrejection 也触发提示层', () => {
    const win = new EventTarget();
    const doc = makeFakeDoc();
    installGlobalErrorGuard(win, doc);
    win.dispatchEvent(new Event('unhandledrejection'));
    expect(doc._added.filter((el) => el.id === 'fmn-fatal-overlay')).toHaveLength(1);
  });

  it('提示层包含「刷新重试」文案与刷新按钮', () => {
    const el = buildErrorOverlay(makeFakeDoc());
    expect(el).not.toBeNull();
    expect(el.id).toBe('fmn-fatal-overlay');
    expect(el.children.map((child) => child.tag)).toEqual(['div', 'div', 'button']);
    expect(el.children[0].textContent).toContain('刷新');
    expect(el.children[2].textContent).toBe('刷新页面');
  });
});
