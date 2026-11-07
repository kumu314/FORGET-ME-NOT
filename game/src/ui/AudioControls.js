import { audio } from '../audio/AudioManager.js';

export function mountAudioControls(manager = audio, parent = document.body) {
  const panel = document.createElement('details');
  panel.id = 'audio-controls';
  Object.assign(panel.style, {
    position: 'fixed', right: '12px', bottom: '12px', zIndex: '40',
    color: '#fff8e8', background: '#19232af2', border: '1px solid #c9b984',
    borderRadius: '6px', padding: '10px', font: '14px sans-serif', width: '220px',
    maxWidth: 'calc(100vw - 48px)', boxSizing: 'border-box',
  });
  const summary = document.createElement('summary');
  summary.textContent = '声音设置';
  summary.style.cursor = 'pointer';
  panel.appendChild(summary);
  const mute = document.createElement('button');
  mute.type = 'button';
  mute.style.cssText = 'margin:10px 0;padding:6px 10px;cursor:pointer';
  const updateMute = () => {
    mute.textContent = manager.muted ? '恢复声音' : '静音';
    mute.setAttribute('aria-pressed', String(manager.muted));
    summary.textContent = manager.muted ? '声音设置 · 已静音' : '声音设置';
  };
  mute.addEventListener('click', () => {
    manager.unlock();
    manager.setMuted(!manager.muted);
    updateMute();
  });
  panel.appendChild(mute);
  updateMute();
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
  for (const eventName of ['keydown', 'keyup', 'pointerdown', 'pointerup']) {
    panel.addEventListener(eventName, (event) => event.stopPropagation());
  }
  panel.addEventListener('pointerdown', () => manager.unlock());
  parent.appendChild(panel);
  return { element: panel, destroy: () => panel.remove() };
}
