import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from '../src/audio/AudioManager.js';
import { SCORES, scoreStep } from '../src/audio/scores.js';
import { mountAudioControls } from '../src/ui/AudioControls.js';

function audioParam() {
  return { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
}

function audioNode() {
  return {
    connect: vi.fn(function () { return arguments[0]; }),
    start: vi.fn(), stop: vi.fn(), gain: audioParam(), frequency: audioParam(),
    playbackRate: audioParam(), Q: audioParam(),
  };
}

class FakeContext {
  currentTime = 0;
  sampleRate = 22050;
  state = 'running';
  destination = {};
  oscillators = [];
  sources = [];
  createGain = () => audioNode();
  createOscillator = () => {
    const oscillator = audioNode();
    this.oscillators.push(oscillator);
    return oscillator;
  };
  createBufferSource = () => {
    const source = audioNode();
    this.sources.push(source);
    return source;
  };
  createBiquadFilter = () => audioNode();
  createBuffer = (channels, length) => ({ getChannelData: () => new Float32Array(length) });
  createDynamicsCompressor = () => Object.fromEntries(
    ['threshold', 'knee', 'ratio', 'attack', 'release'].map((key) => [key, audioParam()])
      .concat([['connect', vi.fn()]]),
  );
  resume = vi.fn(async () => { this.state = 'running'; });
}

let manager;
let saved;
beforeEach(() => {
  vi.useFakeTimers();
  saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  vi.stubGlobal('window', { AudioContext: FakeContext, dispatchEvent: vi.fn() });
  manager = new AudioManager();
});
afterEach(() => {
  manager.stopBgm();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('audio mix and playback', () => {
  it('applies master, music and effects levels independently, including existing loops', () => {
    manager.init();
    manager.setVolume(0.5);
    manager.setMusicVolume(0.2);
    manager.setEffectsVolume(0.3);
    manager.custom.set('rain', {});
    const stop = manager.playLoop('rain');
    const source = manager.ctx.sources[0];
    expect(source.connect.mock.calls[0][0].connect).toHaveBeenCalledWith(manager.effects);
    manager.setEffectsVolume(0);
    expect(manager.effects.gain.value).toBe(0);
    expect(manager.music.gain.value).toBe(0.2);
    expect(manager.master.gain.value).toBe(0.5);
    stop();
    expect(source.stop).toHaveBeenCalledOnce();
  });

  it('mutes the entire mix without destroying saved levels and restores them', () => {
    manager.init();
    manager.setVolume(0.4);
    manager.startBgm('stage2');
    manager.setMuted(true);
    manager.play('hit');
    expect(manager.master.gain.value).toBe(0);
    expect(manager.ctx.oscillators.length).toBe(scoreStep('stage2', 0).notes.length);
    manager.setVolume(0.8);
    expect(manager.master.gain.value).toBe(0);
    manager.setMuted(false);
    expect(manager.master.gain.value).toBe(0.8);
  });

  it('persists all settings, clamps out-of-range values and rejects invalid numbers', () => {
    manager.setVolume(2);
    manager.setMusicVolume(-2);
    manager.setEffectsVolume(0.23);
    manager.setMuted(true);
    const restored = new AudioManager();
    expect([restored.volume, restored.musicVolume, restored.effectsVolume, restored.muted])
      .toEqual([1, 0, 0.23, true]);
    manager.setVolume(NaN);
    manager.setMusicVolume(Infinity);
    expect([manager.volume, manager.musicVolume]).toEqual([1, 0]);
    saved.set('fm-audio-vol', 'broken');
    saved.set('fm-audio-settings', '{broken');
    expect(new AudioManager().volume).toBe(0.7);
  });

  it('routes sampled effects and synthesized effects through the same effects bus', () => {
    manager.init();
    manager.custom.set('hit', {});
    manager.play('hit');
    const gain = manager.ctx.sources[0].connect.mock.calls[0][0];
    expect(gain.connect).toHaveBeenCalledWith(manager.effects);
    manager.play('bell');
    const toneGain = manager.ctx.oscillators[0].connect.mock.calls[0][0];
    expect(toneGain.connect).toHaveBeenCalledWith(manager.effects);
    manager.play('thunder');
    expect(manager.ctx.sources.length).toBeGreaterThan(1);
  });

  it('does not replay a pending effect after the player muted during resume', async () => {
    manager.init();
    manager.ctx.state = 'suspended';
    manager.play('hit');
    manager.setMuted(true);
    await Promise.resolve();
    expect(manager.ctx.oscillators).toHaveLength(0);
  });

  it('handles resume denial without an unhandled rejection or premature effect', async () => {
    manager.init();
    manager.ctx.state = 'suspended';
    manager.ctx.resume.mockRejectedValue(new Error('gesture required'));
    manager.play('hit');
    await Promise.resolve();
    await Promise.resolve();
    expect(manager.ctx.oscillators).toHaveLength(0);
  });

  it('rejects HTTP error pages before trying to decode them', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    await expect(manager.loadSound('missing', '/missing.wav')).rejects.toThrow('404');
    expect(manager.custom.size).toBe(0);
  });
});

describe('original three-stage scores and scheduling', () => {
  it('has distinct tempo, waveform, arrangement and complete repeatable eight-bar loops', () => {
    expect(Object.values(SCORES).map((score) => score.bpm)).toEqual([144, 108, 66]);
    expect(Object.values(SCORES).map((score) => score.lead)).toEqual(['square', 'sawtooth', 'sine']);
    const totals = [];
    for (const key of Object.keys(SCORES)) {
      expect(SCORES[key].melody).toHaveLength(8);
      let noteCount = 0;
      for (let step = 0; step < 64; step++) {
        const { notes } = scoreStep(key, step);
        noteCount += notes.length;
        for (const note of notes) {
          expect(note.f0).toBeGreaterThan(0);
          expect(note.dur).toBeGreaterThan(0);
          expect(note.vol).toBeGreaterThan(0);
        }
      }
      totals.push(noteCount);
      expect(scoreStep(key, 64)).toEqual(scoreStep(key, 0));
    }
    expect(new Set(totals).size).toBe(3);
    expect(scoreStep('stage2', 0).notes.some((note) => note.cutoff === 1200)).toBe(true);
  });

  it('holds its score position while context is suspended and begins after unlock', () => {
    manager.init();
    manager.ctx.state = 'suspended';
    manager.startBgm('stage1');
    vi.advanceTimersByTime(5000);
    expect(manager._bgmStep).toBe(0);
    manager.ctx.state = 'running';
    vi.advanceTimersByTime(25);
    expect(manager._bgmStep).toBe(1);
    expect(manager.ctx.oscillators[0].start).toHaveBeenCalledWith(0);
  });

  it('schedules on the audio clock and avoids a burst of old notes after timer throttling', () => {
    manager.startBgm('stage1');
    manager.ctx.currentTime = 10;
    vi.advanceTimersByTime(25);
    expect(manager._bgmStep).toBe(2);
    const newest = manager.ctx.oscillators.at(-1);
    expect(newest.start).toHaveBeenCalledWith(10);
  });

  it('stops already scheduled voices on stage switch and leaves exactly one timer', () => {
    manager.startBgm('stage1');
    const oldVoices = [...manager._bgmSources];
    manager.startBgm('stage2');
    for (const source of oldVoices) expect(source.stop).toHaveBeenCalledTimes(2);
    expect(manager._bgmKey).toBe('stage2');
    expect(vi.getTimerCount()).toBe(1);
    const count = manager.ctx.oscillators.length;
    manager.startBgm('stage2');
    expect(manager.ctx.oscillators).toHaveLength(count);
    manager.stopBgm();
    expect(vi.getTimerCount()).toBe(0);
    expect(manager._bgmSources.size).toBe(0);
  });

  it('gracefully ignores unsupported audio and unknown track keys', () => {
    manager.startBgm('unknown');
    expect(vi.getTimerCount()).toBe(0);
    vi.stubGlobal('window', {});
    const unsupported = new AudioManager();
    unsupported.startBgm('stage1');
    expect(unsupported.ctx).toBeNull();
  });
});

it('mounts operable labeled controls once at application level and removes them', () => {
  const elements = [];
  const documentListeners = {};
  vi.stubGlobal('document', {
    addEventListener: vi.fn((name, handler) => { documentListeners[name] = handler; }),
    removeEventListener: vi.fn(),
    createElement: (tag) => {
      const element = {
        tag, style: {}, children: [], handlers: {}, setAttribute: vi.fn(), remove: vi.fn(),
        append(...children) { this.children.push(...children); },
        appendChild(child) { this.children.push(child); },
        addEventListener(name, handler) { this.handlers[name] = handler; },
        contains(node) { return node === this || this.children.some((child) => child.contains(node)); },
      };
      elements.push(element);
      return element;
    },
  });
  const parent = { appendChild: vi.fn() };
  const uiManager = {
    volume: 0.7, musicVolume: 0.6, effectsVolume: 0.8, muted: false,
    unlock: vi.fn(), setVolume: vi.fn(), setMusicVolume: vi.fn(), setEffectsVolume: vi.fn(),
    setMuted(value) { this.muted = value; },
  };
  const controls = mountAudioControls(uiManager, parent);
  expect(parent.appendChild).toHaveBeenCalledWith(controls.element);
  const sliders = elements.filter((element) => element.tag === 'input');
  expect(sliders).toHaveLength(3);
  sliders[1].value = '25';
  sliders[1].handlers.input();
  expect(uiManager.setMusicVolume).toHaveBeenCalledWith(0.25);
  elements.find((element) => element.tag === 'button').handlers.click();
  expect(uiManager.muted).toBe(true);
  // #76 适配（结构换成折叠图标后的等价验证）：
  // 点击声音控件外部 → 释放其内部控件的键盘焦点；点控件内部不释放；外部焦点不误伤
  const panelInput = sliders[0];
  panelInput.blur = vi.fn();
  document.activeElement = panelInput;
  documentListeners.pointerdown({ target: panelInput });
  expect(panelInput.blur).not.toHaveBeenCalled();
  documentListeners.pointerdown({ target: {} });
  expect(panelInput.blur).toHaveBeenCalledOnce();
  const outside = { blur: vi.fn() };
  document.activeElement = outside;
  documentListeners.pointerdown({ target: {} });
  expect(outside.blur).not.toHaveBeenCalled();
  controls.destroy();
  expect(document.removeEventListener).toHaveBeenCalledWith('pointerdown', documentListeners.pointerdown, true);
  expect(controls.element.remove).toHaveBeenCalledOnce();
});
