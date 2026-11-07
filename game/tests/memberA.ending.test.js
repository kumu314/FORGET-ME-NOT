import { describe, it, expect, vi } from 'vitest';

// 结局模块不直接用 Phaser 命名空间；TypewriterTransition 一并 mock 掉
vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/ui/TypewriterTransition.js', () => ({
  TypewriterTransition: { play: vi.fn(() => Promise.resolve()) },
  TRANSITION_PRESETS: { ending: { title: '结局', lines: ['人生不是一场必须要赢的战斗。', '走过的每一步，都算数。'] } },
}));

import { TypewriterTransition } from '../src/ui/TypewriterTransition.js';
import { installEndingScreen, ENDING_TRIGGER_PADDING } from '../src/ui/EndingScreen.js';
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

const tick = (scene) => scene._handlers.update?.();

describe('结局保底触发器（issue #25）', () => {
  it('老年关走到世界尽头恰好触发一次结局', async () => {
    const scene = stubScene({ phaseId: 'elder', playerX: WORLD_WIDTH - 10 });
    installEndingScreen(scene);
    tick(scene);
    await Promise.resolve();
    expect(TypewriterTransition.play).toHaveBeenCalledTimes(1);
    expect(TypewriterTransition.play.mock.calls[0][0]).toBeTypeOf('object');
    tick(scene);
    expect(TypewriterTransition.play).toHaveBeenCalledTimes(1);
  });

  it('青年/中年关走到尽头不触发', () => {
    for (const phaseId of ['youth', 'middle']) {
      const scene = stubScene({ phaseId, playerX: WORLD_WIDTH - 10 });
      installEndingScreen(scene);
      tick(scene);
      expect(TypewriterTransition.play).not.toHaveBeenCalled();
    }
  });

  it('老年关未到阈值不触发', () => {
    const scene = stubScene({ phaseId: 'elder', playerX: 100 });
    installEndingScreen(scene);
    tick(scene);
    expect(TypewriterTransition.play).not.toHaveBeenCalled();
  });

  it('重复安装幂等；shutdown 时解绑 update', () => {
    const scene = stubScene({ phaseId: 'elder', playerX: 100 });
    installEndingScreen(scene);
    installEndingScreen(scene);
    expect(scene._handlers.update).toBeTypeOf('function');
    expect(scene._handlers['once:shutdown']).toBeTypeOf('function');
    scene._handlers['once:shutdown']();
    expect(scene._handlers.update).toBeUndefined();
  });
});
