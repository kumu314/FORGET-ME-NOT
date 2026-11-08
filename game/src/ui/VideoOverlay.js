/**
 * 全屏视频播放层（DOM 实现，覆盖在 Phaser canvas 之上）
 *
 * 用于开场视频与结局视频：
 *  - 自动处理浏览器自动播放限制：先尝试带声音，被拦截则静音播放；
 *  - 底部长按出现「跳过」按钮，Esc 也可跳过；
 *  - 播放结束 / 跳过 / 出错都会 resolve，绝不阻塞游戏流程；
 *  - 暴露 window.__FMN_VIDEO__.skip() 供调试与自动化使用。
 *
 * 用法：
 *   await playVideo('assets/video/intro.mp4', { skipAfterMs: 2200 });
 */
export function playVideo(src, { skipAfterMs = 1800, skipText = '跳过 ▶' } = {}) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof window === 'undefined' || !document.body) {
      resolve(false);
      return;
    }
    document.getElementById('fmn-video-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'fmn-video-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '9998', background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', cursor: 'default',
    });

    const video = document.createElement('video');
    video.src = src;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('playsinline', '');
    video.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000';
    overlay.appendChild(video);

    let done = false;
    let skipTimer = null;

    const cleanup = () => {
      clearTimeout(skipTimer);
      window.removeEventListener('keydown', onKey, true);
      try { video.pause(); } catch { /* ignore */ }
      overlay.remove();
      if (window.__FMN_VIDEO__) delete window.__FMN_VIDEO__;
    };
    const finish = (result) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(result);
    };

    // 跳过按钮：延迟出现，避免误触；Esc 也可跳过
    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.textContent = skipText;
    skipBtn.style.cssText = [
      'position:absolute', 'right:16px', 'bottom:16px', 'padding:8px 16px',
      'background:rgba(0,0,0,.55)', 'color:#f4f0e6', 'border:1px solid rgba(244,240,230,.55)',
      'border-radius:6px', 'font:13px "Microsoft YaHei",sans-serif', 'cursor:pointer',
      'opacity:0', 'transition:opacity .3s', 'z-index:2',
    ].join(';');
    skipBtn.addEventListener('click', (event) => { event.stopPropagation(); finish('skip'); });
    overlay.appendChild(skipBtn);
    skipTimer = setTimeout(() => { skipBtn.style.opacity = '1'; }, skipAfterMs);

    const onKey = (event) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        finish('skip');
      }
    };
    window.addEventListener('keydown', onKey, true);

    // 自动播放策略：带声音 → 静音 → 点击播放
    let soundBtn = null;
    const ensureSoundBtn = () => {
      if (soundBtn || done) return;
      soundBtn = document.createElement('button');
      soundBtn.type = 'button';
      soundBtn.textContent = '🔇 开启声音';
      soundBtn.style.cssText = [
        'position:absolute', 'left:16px', 'bottom:16px', 'padding:8px 14px',
        'background:rgba(0,0,0,.55)', 'color:#f4f0e6', 'border:1px solid rgba(244,240,230,.55)',
        'border-radius:6px', 'font:13px "Microsoft YaHei",sans-serif', 'cursor:pointer', 'z-index:2',
      ].join(';');
      soundBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        video.muted = false;
        soundBtn.textContent = '🔊 声音已开';
        setTimeout(() => { soundBtn.style.opacity = '0'; }, 1500);
      });
      overlay.appendChild(soundBtn);
    };
    const showPlayPrompt = () => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '▶ 点击播放';
      btn.style.cssText = [
        'position:absolute', 'padding:14px 26px', 'background:rgba(20,20,26,.85)',
        'color:#f4f0e6', 'border:2px solid #c9b984', 'border-radius:8px',
        'font:16px "Microsoft YaHei",sans-serif', 'cursor:pointer', 'z-index:3',
      ].join(';');
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        btn.remove();
        video.muted = false;
        video.play().catch(() => { /* 再失败就保持当前状态 */ });
      });
      overlay.appendChild(btn);
    };
    const playMuted = () => {
      video.muted = true;
      ensureSoundBtn();
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => showPlayPrompt());
    };
    const playWithSound = () => {
      video.muted = false;
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(playMuted);
    };

    video.addEventListener('ended', () => finish('ended'));
    video.addEventListener('error', () => finish('error'));
    overlay.addEventListener('pointerdown', (event) => event.stopPropagation());

    window.__FMN_VIDEO__ = { skip: () => finish('skip'), video };

    document.body.appendChild(overlay);
    playWithSound();
  });
}
