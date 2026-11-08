import { audio } from '../audio/AudioManager.js';

/**
 * 声音控制面板：默认折叠成 40×40 喇叭图标钉在视口右下角，
 * 点击展开完整面板（贴右边缘向上弹出，不遮挡画布中下部的剧情提示文字），
 * 再点收起。折叠态用 🔊/🔇 图标 + 边框变色反映当前是否静音。
 *
 * 注意：静音按钮必须是本组件创建的第一个 <button>（audio.test.js 依赖该顺序），
 * 因此展开/收起图标按钮放在面板内容之后再创建。
 */
export function mountAudioControls(manager = audio, parent = document.body) {
  const wrapper = document.createElement('div');
  wrapper.id = 'audio-controls';
  Object.assign(wrapper.style, {
    position: 'fixed', right: '8px', bottom: '8px', zIndex: '40',
  });

  const panel = document.createElement('div');
  panel.id = 'audio-controls-panel';
  Object.assign(panel.style, {
    position: 'absolute', right: '0', bottom: 'calc(100% + 4px)',
    width: '220px', maxWidth: 'calc(100vw - 48px)', boxSizing: 'border-box',
    maxHeight: 'calc(100vh - 64px)', overflowY: 'auto',
    color: '#fff8e8', background: '#19232af2', border: '1px solid #c9b984',
    borderRadius: '6px', padding: '10px', font: '14px sans-serif',
    display: 'none',
  });
  const header = document.createElement('div');
  header.textContent = '声音设置';
  header.style.cssText = 'font-weight:600;margin-bottom:4px';
  panel.appendChild(header);

  const mute = document.createElement('button');
  mute.type = 'button';
  mute.style.cssText = 'margin:6px 0;padding:6px 10px;cursor:pointer';
  panel.appendChild(mute);

  for (const [labelText, property, setter] of [
    ['总音量', 'volume', 'setVolume'],
    ['音乐', 'musicVolume', 'setMusicVolume'],
    ['音效 / 环境', 'effectsVolume', 'setEffectsVolume'],
  ]) {
    const label = document.createElement('label');
    label.style.cssText = 'display:block;margin:8px 0';
    const caption = document.createElement('span');
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(Math.round(manager[property] * 100));
    slider.setAttribute('aria-label', labelText);
    slider.style.cssText = 'display:block;width:100%;accent-color:#e2c47a';
    const update = () => { caption.textContent = `${labelText} ${slider.value}%`; };
    slider.addEventListener('input', () => {
      manager.unlock();
      manager[setter](Number(slider.value) / 100);
      update();
    });
    update();
    label.append(caption, slider);
    panel.appendChild(label);
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  Object.assign(toggle.style, {
    width: '40px', height: '40px', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: '0',
    font: '18px/1 sans-serif', cursor: 'pointer',
    color: '#ffe6a7', background: '#19232af2',
    border: '1px solid #c9b984', borderRadius: '6px',
  });
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'audio-controls-panel');

  const updateMute = () => {
    mute.textContent = manager.muted ? '恢复声音' : '静音';
    mute.setAttribute('aria-pressed', String(manager.muted));
    toggle.textContent = manager.muted ? '🔇' : '🔊';
    toggle.style.borderColor = manager.muted ? '#d9806a' : '#c9b984';
    toggle.setAttribute('aria-label', manager.muted ? '声音设置（已静音）' : '声音设置');
  };
  const setExpanded = (open) => {
    panel.style.display = open ? 'block' : 'none';
    toggle.setAttribute('aria-expanded', String(open));
  };

  mute.addEventListener('click', () => {
    manager.unlock();
    manager.setMuted(!manager.muted);
    updateMute();
  });
  toggle.addEventListener('click', () => {
    manager.unlock();
    setExpanded(panel.style.display === 'none');
  });

  wrapper.append(toggle, panel);
  for (const eventName of ['keydown', 'keyup', 'pointerdown', 'pointerup']) {
    wrapper.addEventListener(eventName, (event) => event.stopPropagation());
  }
  wrapper.addEventListener('pointerdown', () => manager.unlock());
  // 适配 develop #76 的「声音面板卡键」修复：点击声音控件外部时释放其内部控件的
  // 键盘焦点，防止滑杆/按钮持续吃掉 A/D/Space 等游戏按键。
  // 原版挂在 panel 上，这里随结构改挂 wrapper（图标+面板一起管）；
  // 用 document 捕获相位，wrapper 的 stopPropagation（冒泡）不影响它先行触发。
  const releaseFocus = (event) => {
    const focused = document.activeElement;
    if (wrapper.contains(focused) && !wrapper.contains(event.target)) focused.blur();
  };
  document.addEventListener('pointerdown', releaseFocus, true);
  updateMute();
  parent.appendChild(wrapper);
  return {
    element: wrapper,
    destroy() {
      document.removeEventListener('pointerdown', releaseFocus, true);
      wrapper.remove();
    },
  };
}
