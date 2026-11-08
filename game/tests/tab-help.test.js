import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYS } from '../src/config/gameConfig.js';
import { HELP_SECTIONS, HelpOverlay, installHelpOverlay, keyLabel } from '../src/ui/HelpOverlay.js';

/** 只实现 HelpOverlay 用到的 DOM 子集 */
function makeDocument() {
  const created = [];
  const doc = {
    head: { appendChild: vi.fn() },
    body: { appendChild: vi.fn() },
    activeElement: null,
    getElementById: vi.fn(() => null),
    createElement(tag) {
      const el = {
        tag,
        style: {},
        children: [],
        handlers: {},
        textContent: '',
        appendChild(child) {
          this.children.push(child);
          return child;
        },
        append(...kids) {
          kids.forEach((kid) => this.appendChild(kid));
        },
        addEventListener(name, handler) {
          this.handlers[name] = handler;
        },
        remove: vi.fn(),
        setAttribute: vi.fn(),
      };
      created.push(el);
      return el;
    },
  };
  return { doc, created };
}

function makeWindow() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) {
      listeners.set(type, [...(listeners.get(type) ?? []), handler]);
    },
    removeEventListener(type, handler) {
      listeners.set(type, (listeners.get(type) ?? []).filter((fn) => fn !== handler));
    },
    dispatchEvent(event) {
      // 与 DOM 一致：派发时复制监听器列表，新增的监听器不参与本次派发
      for (const handler of [...(listeners.get(event.type) ?? [])]) handler(event);
      return true;
    },
  };
}

const keyEvent = (code) => ({
  type: 'keydown',
  code,
  key: code === 'TAB' ? 'Tab' : code,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
});

const rows = HELP_SECTIONS.flatMap((section) => section.rows);

let win;
let doc;

beforeEach(() => {
  HelpOverlay._inst = null;
  win = makeWindow();
  doc = makeDocument().doc;
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('CustomEvent', class {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  });
});

afterEach(() => {
  if (HelpOverlay.isOpen) HelpOverlay.close();
  HelpOverlay._inst = null;
  vi.unstubAllGlobals();
});

describe('tab help content', () => {
  it('derives every gameplay row from the real key config', () => {
    const configRows = rows.filter((row) => row.group);
    expect(new Set(configRows.map((row) => row.group))).toEqual(new Set(Object.keys(KEYS)));
    for (const row of configRows) expect(row.keys).toBeUndefined();
  });

  it('lists the system hotkeys and gives every key a readable label', () => {
    const allKeys = rows.flatMap((row) => (row.group ? KEYS[row.group] : row.keys));
    for (const hotkey of ['T', 'R', 'TAB', 'ESC']) expect(allKeys).toContain(hotkey);
    for (const code of allKeys) expect(keyLabel(code)).toBeTruthy();
    expect(keyLabel('SPACE')).toBe('空格');
    expect(keyLabel('TAB')).toBe('Tab');
  });

  it('renders one row per action with the actual key codes', () => {
    HelpOverlay.open();
    const root = HelpOverlay._inst._el;
    expect(doc.body.appendChild).toHaveBeenCalledWith(root);
    const cards = root.children;
    expect(cards).toHaveLength(1);
    const kbd = cards[0].children
      .flatMap((block) => block.children ?? [])
      .flatMap((line) => line.children?.[0]?.children ?? []);
    for (const code of Object.values(KEYS).flat()) {
      expect(kbd.some((el) => el.tag === 'kbd' && el.textContent === keyLabel(code))).toBe(true);
    }
  });
});

describe('tab help toggle', () => {
  const makeScene = () => {
    const scene = {
      transitioning: false,
      modalOpen: false,
      events: new EventEmitter(),
      _setModalPaused: vi.fn((key, open) => {
        if (key === 'help') scene.modalOpen = open;
      }),
    };
    return scene;
  };

  it('opens on Tab, pauses the world, and closes on Tab again', () => {
    const scene = makeScene();
    installHelpOverlay(scene);

    const openEvent = keyEvent('TAB');
    win.dispatchEvent(openEvent);
    expect(HelpOverlay.isOpen).toBe(true);
    expect(openEvent.preventDefault).toHaveBeenCalled();
    expect(openEvent.stopPropagation).toHaveBeenCalled();
    expect(scene._setModalPaused).toHaveBeenCalledWith('help', true);
    expect(scene.modalOpen).toBe(true);

    win.dispatchEvent(keyEvent('TAB'));
    expect(HelpOverlay.isOpen).toBe(false);
    expect(scene._setModalPaused).toHaveBeenLastCalledWith('help', false);
    expect(scene.modalOpen).toBe(false);
  });

  it('closes on Escape and on a backdrop click', () => {
    const scene = makeScene();
    installHelpOverlay(scene);

    win.dispatchEvent(keyEvent('TAB'));
    win.dispatchEvent(keyEvent('Escape'));
    expect(HelpOverlay.isOpen).toBe(false);
    expect(scene.modalOpen).toBe(false);

    win.dispatchEvent(keyEvent('TAB'));
    const root = HelpOverlay._inst._el;
    root.handlers.click({ target: root });
    expect(HelpOverlay.isOpen).toBe(false);
    expect(scene.modalOpen).toBe(false);
  });

  it('does not steal Tab while another modal or an input is focused', () => {
    const scene = makeScene();
    installHelpOverlay(scene);

    scene.modalOpen = true;
    win.dispatchEvent(keyEvent('TAB'));
    expect(HelpOverlay.isOpen).toBe(false);

    scene.modalOpen = false;
    const target = { closest: () => ({}) };
    win.dispatchEvent({ ...keyEvent('TAB'), target });
    expect(HelpOverlay.isOpen).toBe(false);
  });

  it('uninstalls on scene shutdown', () => {
    const scene = makeScene();
    installHelpOverlay(scene);

    scene.events.emit('shutdown');
    expect(scene._helpOverlay).toBeNull();

    win.dispatchEvent(keyEvent('TAB'));
    expect(HelpOverlay.isOpen).toBe(false);
    expect(scene._setModalPaused).not.toHaveBeenCalled();
  });
});
