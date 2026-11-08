import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import Key from 'phaser/src/input/keyboard/keys/Key.js';
import { InputController } from '../src/core/Input.js';
import { installTelemetry } from '../src/telemetry/PlaytestTelemetry.js';

let scene;
let stored;
const dispatchKey = (code, repeat = false) => {
  const event = new Event('keydown');
  Object.assign(event, { code, repeat });
  window.dispatchEvent(event);
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', { activeElement: null, hidden: false });
  stored = new Map();
  vi.stubGlobal('localStorage', { setItem: (key, value) => stored.set(key, value),
    get length() { return stored.size; }, key: i => [...stored.keys()][i], getItem: key => stored.get(key) });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  scene = { phaseId: 'youth', events: new EventEmitter(), game: { events: new EventEmitter() } };
});
afterEach(() => {
  scene.events.emit('shutdown');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('telemetry lifecycle and sample integrity', () => {
  it('reinstalls on the same Scene after restart, without old listeners', () => {
    const first = installTelemetry(scene);
    expect(installTelemetry(scene)).toBe(first);
    scene.events.emit('shutdown');
    expect(scene.events.listenerCount('stage:complete')).toBe(0);
    scene.phaseId = 'middle';
    const second = installTelemetry(scene);
    scene.events.emit('player:damaged', { damage: 7 });
    expect(second.data.phase).toBe('middle');
    expect(second.data.runId).not.toBe(first.data.runId);
    expect(second.data.damageTaken).toBe(7);
    expect(first.data.damageTaken).toBe(0);
    expect(first.data.outcome).toBe('interrupted');
  });
  it('freezes exported elapsed time and every counter when complete', () => {
    const telemetry = installTelemetry(scene, { revision: 'test-revision' });
    vi.setSystemTime(6000);
    scene.events.emit('stage:complete');
    const completed = telemetry.summary();
    vi.setSystemTime(16000);
    dispatchKey('KeyJ');
    scene.events.emit('player:damaged', { damage: 99 });
    expect(telemetry.summary()).toEqual(completed);
    expect(completed).toMatchObject({ elapsedMs: 5000, elapsedSec: 5, outcome: 'completed', revision: 'test-revision' });
    expect(JSON.parse([...stored.values()][0])).toEqual(completed);
  });
  it('counts non-repeat gameplay keydowns, including the block alias', () => {
    const telemetry = installTelemetry(scene);
    dispatchKey('KeyJ');
    dispatchKey('KeyJ', true);
    scene.modalOpen = true;
    dispatchKey('KeyL');
    scene.modalOpen = false;
    scene.transitioning = true;
    dispatchKey('Space');
    dispatchKey('KeyT');
    scene.transitioning = false;
    document.activeElement = { closest: () => ({}) };
    dispatchKey('KeyL');
    document.activeElement = null;
    dispatchKey('ArrowDown');
    dispatchKey('KeyR');
    expect(telemetry.data.keyPresses).toEqual({ melee: 1, ranged: 0, jump: 0, block: 1 });
    expect(telemetry.data.contamination).toContain('manual-respawn');
    expect(telemetry.data.contamination).toContain('debug-phase-switch');
  });
  it('records diagnostics as sample contamination and removes its listener', () => {
    const telemetry = installTelemetry(scene);
    telemetry.markContaminated('automation-probe');
    scene.events.emit('physics:airborne-stall', { x: 123 });
    expect(telemetry.data.diagnostics).toHaveLength(1);
    expect(telemetry.data.contamination).toContain('physics:airborne-stall');
    expect(telemetry.data.contamination).toContain('automation-probe');
    scene.events.emit('shutdown');
    expect(scene.events.listenerCount('physics:airborne-stall')).toBe(0);
  });
});

describe('real Phaser Key state reset', () => {
  const makeInput = () => {
    scene.input = { keyboard: { addKey: () => new Key({ game: { loop: { time: 0 } } }, 68) } };
    return new InputController(scene);
  };
  it('flush resets the Phaser key as well as the semantic snapshot', () => {
    const input = makeInput();
    const key = input._keyMap.get('D');
    key.isDown = true;
    expect(input.update().right).toBe(true);
    input.flush();
    expect(key.isDown).toBe(false);
    expect(input.update().right).toBe(false);
    input.destroy();
  });
  it('neutralizes held keys when focus moves into a DOM control and cleans up', () => {
    const input = makeInput();
    const key = input._keyMap.get('D');
    key.isDown = true;
    document.activeElement = { closest: () => ({}) };
    window.dispatchEvent(new Event('focusin'));
    expect(key.isDown).toBe(false);
    key.isDown = true;
    expect(input.update().right).toBe(false);
    input.destroy();
    key.isDown = true;
    window.dispatchEvent(new Event('focusin'));
    expect(key.isDown).toBe(true);
  });
});

describe('multi-stage playtest export', () => {
  it('keeps completed/interrupted/current stages, ignores unrelated storage and deduplicates current', () => {
    const youth = installTelemetry(scene, { revision: 'fixture-rev' });
    scene.events.emit('stage:complete'); scene.events.emit('shutdown');
    scene.phaseId = 'middle';
    const middle = installTelemetry(scene); scene.events.emit('shutdown');
    scene.phaseId = 'elder';
    const elder = installTelemetry(scene);
    stored.set('other-app-private-data', '{bad json');
    stored.set('fmn-telemetry-corrupt', '{bad json');
    const bundle = elder.history();
    expect(bundle.runs.map(run => run.phase)).toEqual(['youth', 'middle', 'elder']);
    expect(bundle.runs.map(run => run.outcome)).toEqual(['completed', 'interrupted', 'in-progress']);
    expect(bundle.runs[0].runId).toBe(youth.data.runId);
    expect(bundle.runs[1].runId).toBe(middle.data.runId);
    expect(bundle.warnings).toEqual(['unreadable-record:fmn-telemetry-corrupt']);
    scene.events.emit('stage:complete');
    expect(elder.history().runs).toHaveLength(3);
  });
  it('retains the current snapshot with an explicit warning when storage is unavailable', () => {
    const telemetry = installTelemetry(scene);
    vi.stubGlobal('localStorage', { get length() { throw new Error('blocked'); } });
    const bundle = telemetry.history();
    expect(bundle.runs).toEqual([telemetry.summary()]);
    expect(bundle.warnings).toContain('storage-unavailable:only-current-stage-included');
  });
});