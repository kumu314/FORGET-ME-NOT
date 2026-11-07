import { describe, it, expect, vi, beforeEach } from 'vitest';

// 结局模块不直接用 Phaser 命名空间；TypewriterTransition 一并 mock 掉
vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/ui/TypewriterTransition.js', () => ({
  TypewriterTransition: { play: vi.fn(() => Promise.resolve()) },
  TRANSITION_PRESETS: { ending: { title: '结局', lines: ['人生不是一场必须要赢的战斗。', '走过的每一步，都算数。'] } },
}));

import { installEndingScreen } from '../src/ui/EndingScreen.js';
import { WORLD_WIDTH } from '../src/config/stageLayout.js';

/** 构造一个最小可用的假场景（只实现 EndingScreen 触到的面） */
function stubScene({ phaseId = 'elder', playerX = 48 } = {}) {
  const handlers = {};
  const chainable = () => {
    const obj = {};
    for (const m of ['setOrigin', 'setScrollFactor', 'setDepth', 'setAlpha']) obj[m] = () => obj;
    return obj;
  };
  return {
    _handlers: handlers,
    phaseId,
    _advanceStage: vi.fn(),
    cameras: { main: { fadeOut: vi.fn() } },
    player: { x: playerX },
    physics: { world: { pause: vi.fn() } },
    scale: { width: 480, height: 270 },
    add: { rectangle: vi.fn(chainable), text: vi.fn(chainable) },
    tweens: { add: vi.fn() },
    time: { delayedCall: (ms, cb) => cb() },
    input: { keyboard: { once: vi.fn() } },
    scene: { start: vi.fn() },
    events: {
      on: (name, fn) => {
        handlers[name] = fn;
      },
      off: (name) => {
        delete handlers[name];
      },
      once: (name, fn) => {
        handlers[`once:${name}`] = fn;
      },
    },
  };
}

const hug = (scene) => scene._handlers['story:hug']?.();

describe('拥抱后的唯一结局入口（issue #23 / #25）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('老年拥抱事件恰好推进一次打字机结局', async () => {
    const scene = stubScene({ phaseId: 'elder', playerX: WORLD_WIDTH - 10 });
    installEndingScreen(scene);
    hug(scene);
    await Promise.resolve();
    expect(scene._advanceStage).toHaveBeenCalledTimes(1);
    expect(scene.cameras.main.fadeOut).toHaveBeenCalledWith(700, 0, 0, 0);
    hug(scene);
    expect(scene._advanceStage).toHaveBeenCalledTimes(1);
  });

  it('青年/中年关走到尽头不触发', () => {
    for (const phaseId of ['youth', 'middle']) {
      const scene = stubScene({ phaseId, playerX: WORLD_WIDTH - 10 });
      installEndingScreen(scene);
      hug(scene);
      expect(scene._advanceStage).not.toHaveBeenCalled();
    }
  });

  it('老年关走到世界边缘也不能跳过拥抱', () => {
    const scene = stubScene({ phaseId: 'elder', playerX: WORLD_WIDTH - 1 });
    installEndingScreen(scene);
    scene._handlers.update?.();
    expect(scene._advanceStage).not.toHaveBeenCalled();
  });

  it('重复安装幂等；shutdown 后同一场景可重新安装', () => {
    const scene = stubScene({ phaseId: 'elder', playerX: 100 });
    installEndingScreen(scene);
    installEndingScreen(scene);
    expect(scene._handlers['story:hug']).toBeTypeOf('function');
    expect(scene._handlers['once:shutdown']).toBeTypeOf('function');
    scene._handlers['once:shutdown']();
    expect(scene._handlers['story:hug']).toBeUndefined();
    installEndingScreen(scene);
    expect(scene._handlers['story:hug']).toBeTypeOf('function');
  });
});
