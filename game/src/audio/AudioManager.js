import { SCORES, scoreStep } from './scores.js';

const clampVolume = (value, fallback) => Number.isFinite(Number(value))
  ? Math.max(0, Math.min(1, Number(value))) : fallback;

/**
 * AudioManager —— 8-bit / 16-bit 芯片音效引擎（成员 E 交付模块）
 *
 * 功能（对应《开发分工与GitHub协作规范》成员 E 第 3 条验收项）：
 *   - 32 个来自本地音效库的真实素材（assets/audio/，已做柔和化处理），
 *     loadSfx() 一键加载；加载失败自动回退到内置 8-bit 合成音
 *   - 纯 Web Audio 实时合成方波 / 三角波 / 噪声（拳击、扔粉笔、狗吠、格挡、下课铃、雷雨等）
 *   - 总线软压缩（DynamicsCompressor），整体听感更柔和、不炸耳
 *   - 音量滑杆 + localStorage 记忆 + 静音开关
 *
 * 集成方式（全体成员对接）：
 *   import { audio } from '../audio/AudioManager.js';
 *
 *   // ★ 浏览器自动播放策略：首次用户手势时解锁一次即可
 *   window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
 *
 *   audio.play('hit');        // 拳击 / 受击       audio.play('throw');  // 扔粉笔
 *   audio.play('bark');       // 狗吠（成员 D）    audio.play('block');  // 格挡
 *   audio.play('bell');       // 下课铃 / Boss进场 audio.play('thunder');// 雷雨
 *   audio.play('pickup');     // 拾取光球          audio.play('crit');   // 暴击
 *   audio.play('egg');        // 彩蛋解锁          audio.play('ui');     // 界面
 *   audio.play('typing');     // 打字机滴答
 *   audio.startBgm('stage1'); // 原创三关 BGM       audio.stopBgm();
 *
 *   // 正式版替换：用真实素材覆盖合成音
 *   await audio.loadSound('hit', 'assets/audio/sfx_hit.wav');
 *
 *   // 推荐：一次性加载全部真实音效（assets/audio/sfx_*.wav，来自本地音效库）
 *   await audio.loadSfx();   // 失败自动回退合成音，不影响运行
 */

/** 真实音效清单（assets/audio/ 下的文件名，loadSfx 按此批量加载） */
export const SFX_FILES = {
  hit: 'sfx_hit.wav',
  hit_heavy: 'sfx_hit_heavy.wav',
  crit: 'sfx_crit.wav',
  hurt: 'sfx_hurt.wav',
  death: 'sfx_death.wav',
  block: 'sfx_block.wav',
  jump: 'sfx_jump.wav',
  land: 'sfx_land.wav',
  footstep: 'sfx_footstep.wav',
  throw: 'sfx_throw.wav',
  magic: 'sfx_magic.wav',
  bark: 'sfx_bark.wav',
  bark_attack: 'sfx_bark_attack.wav',
  dog_hurt: 'sfx_dog_hurt.wav',
  pickup: 'sfx_pickup.wav',
  bell: 'sfx_bell.wav',
  thunder: 'sfx_thunder.wav',
  rain: 'sfx_rain.wav',
  egg: 'sfx_egg.wav',
  victory: 'sfx_victory.wav',
  typing: 'sfx_typing.wav',
  ui: 'sfx_ui.wav',
  checkpoint: 'sfx_checkpoint.wav',
  paper: 'sfx_paper.wav',
  door: 'sfx_door.wav',
  boss_roar: 'sfx_boss_roar.wav',
  boss_warn: 'sfx_boss_warn.wav',
  boss_enter: 'sfx_boss_enter.wav',
  transition: 'sfx_transition.wav',
  heal: 'sfx_heal.wav',
  mp_up: 'sfx_mp_up.wav',
  mp_down: 'sfx_mp_down.wav',
};
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.7;
    this.musicVolume = 0.65;
    this.effectsVolume = 0.8;
    this.music = null;
    this.effects = null;
    this.custom = new Map();      // name -> AudioBuffer（真实素材注册表）
    this._bgmTimer = null;
    this._bgmStep = 0;
    this._bgmSources = new Set();
    try {
      const saved = localStorage.getItem('fm-audio-vol');
      if (saved !== null) this.volume = clampVolume(saved, this.volume);
      const settings = JSON.parse(localStorage.getItem('fm-audio-settings') || '{}');
      this.musicVolume = clampVolume(settings.music ?? this.musicVolume, this.musicVolume);
      this.effectsVolume = clampVolume(settings.effects ?? this.effectsVolume, this.effectsVolume);
      this.muted = settings.muted === true;
    } catch { /* 无 localStorage 环境（如 Node）忽略 */ }
  }

  /** 创建 AudioContext。首次必须由用户手势触发（见 unlock）。 */
  init() {
    if (this.ctx) return;
    const AC = globalThis.window?.AudioContext || globalThis.window?.webkitAudioContext;
    if (!AC) { console.warn('[AudioManager] 当前环境不支持 Web Audio'); return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.music = this.ctx.createGain();
    this.effects = this.ctx.createGain();
    this.music.gain.value = this.musicVolume;
    this.effects.gain.value = this.effectsVolume;
    this.music.connect(this.master);
    this.effects.connect(this.master);
    // 总线加一级软压缩：削峰、圆滑瞬态，整体听感更柔和
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 24;
    this.comp.ratio.value = 3;
    this.comp.attack.value = 0.008;
    this.comp.release.value = 0.25;
    this.master.connect(this.comp);
    this.comp.connect(this.ctx.destination);
  }

  /** 在任意 click / keydown 回调里调用一次即可解锁声音。 */
  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
        .then(() => window.dispatchEvent(new CustomEvent('fm-audio:unlocked')))
        .catch(() => { /* 用户手势外调用会失败，等下次手势 */ });
    } else {
      window.dispatchEvent(new CustomEvent('fm-audio:unlocked'));
    }
  }

  /** 当前音频状态：running / suspended / unsupported */
  get state() { return this.ctx ? this.ctx.state : 'unsupported'; }

  /** 诊断试听：一小段确认音频通路正常的提示音（彩蛋旋律 + 下课铃） */
  test() {
    this.unlock();
    this.play('egg');
    setTimeout(() => this.play('bell'), 500);
  }

  setVolume(v) {
    this.volume = clampVolume(v, this.volume);
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    try { localStorage.setItem('fm-audio-vol', String(this.volume)); } catch { /* ignore */ }
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    this._saveSettings();
  }

  setMusicVolume(value) {
    this.musicVolume = clampVolume(value, this.musicVolume);
    if (this.music) this.music.gain.value = this.musicVolume;
    this._saveSettings();
  }

  setEffectsVolume(value) {
    this.effectsVolume = clampVolume(value, this.effectsVolume);
    if (this.effects) this.effects.gain.value = this.effectsVolume;
    this._saveSettings();
  }

  _saveSettings() {
    try {
      localStorage.setItem('fm-audio-settings', JSON.stringify({
        music: this.musicVolume, effects: this.effectsVolume, muted: this.muted,
      }));
    } catch { /* ignore */ }
  }

  /** 注册真实音频素材；注册后 play 优先使用素材而非合成音。 */
  async loadSound(name, url) {
    this.init();
    if (!this.ctx) return;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Audio HTTP ${resp.status}: ${url}`);
    const buf = await resp.arrayBuffer();
    const decoded = await this.ctx.decodeAudioData(buf);
    this.custom.set(name, decoded);
  }

  /**
   * 批量加载真实音效（assets/audio/sfx_*.wav）。
   * 单个失败不影响其他音效，播放时自动回退到内置合成音。
   * @returns {Promise<{loaded:number, failed:number}>}
   */
  async loadSfx(base = 'assets/audio/') {
    const entries = Object.entries(SFX_FILES);
    let loaded = 0;
    let failed = 0;
    await Promise.all(entries.map(async ([name, file]) => {
      try {
        await this.loadSound(name, base + file);
        loaded++;
      } catch (e) {
        failed++;
        console.warn('[AudioManager] 音效加载失败，使用合成音兜底:', name, e);
      }
    }));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sfx:loaded', { detail: { loaded, failed, total: entries.length } }));
    }
    return { loaded, failed, total: entries.length };
  }

  /**
   * 循环播放环境音（如第二关雨声）。需先 loadSfx()。
   * @returns {Function} 停止函数
   */
  playLoop(name, { volume = 1 } = {}) {
    this.init();
    if (!this.ctx || !this.custom.has(name)) return () => {};
    const src = this.ctx.createBufferSource();
    src.buffer = this.custom.get(name);
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.effects);
    src.start();
    return () => { try { src.stop(); } catch { /* 已停止 */ } };
  }

  /** 播放：优先真实素材，其次内置合成音色。context 挂起时先恢复再播，避免首声被吞。 */
  play(name, opts = {}) {
    this.init();
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        if (!this.muted) this._dispatch(name, opts);
      }).catch(() => {});
      return;
    }
    this._dispatch(name, opts);
  }

  _dispatch(name, opts) {
    const buffer = this.custom.get(name);
    if (buffer) { this._playBuffer(buffer, opts); return; }
    const synth = this._synths[name];
    if (synth) synth.call(this, this.ctx, this.effects, opts);
  }

  _playBuffer(buffer, { volume = 1, playbackRate = 1 } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = playbackRate;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.effects);
    src.start();
  }

  /** 基础音色：振荡器 + 频率滑音 + 起音/衰减包络 */
  _tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.1, vol = 0.5, at = 0.004, rel = 0.04, delay = 0, when, destination = this.effects, cutoff }) {
    const ctx = this.ctx;
    const t0 = when ?? ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + at);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + rel);
    if (cutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      osc.connect(filter).connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(destination);
    if (destination === this.music) {
      this._bgmSources.add(osc);
      osc.onended = () => this._bgmSources.delete(osc);
    }
    osc.start(t0);
    osc.stop(t0 + dur + rel + 0.02);
  }

  /** 低通滤波噪声（雷雨 / 爆炸底噪） */
  _noise({ dur = 0.3, vol = 0.5, filterFreq = 800, q = 0.5, at = 0.01 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + at);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.effects);
    src.start(t0);
  }

  /** 内置合成音色表（8-bit 芯片风格） */
  _synths = {
    // 拳击 / 受击：低频方波急速下坠
    hit() { this._tone({ type: 'square', f0: 230, f1: 70, dur: 0.12, vol: 0.55 }); },

    // 扔粉笔 / 纸飞机：三角波上扬滑音
    throw() { this._tone({ type: 'triangle', f0: 480, f1: 1250, dur: 0.16, vol: 0.35 }); },

    // 狗吠：两段急促低音方波 + 一点噪声
    bark() {
      this._tone({ type: 'square', f0: 190, f1: 120, dur: 0.06, vol: 0.4 });
      this._tone({ type: 'square', f0: 150, f1: 90, dur: 0.1, vol: 0.4, at: 0.002, delay: 0.05 });
      this._noise({ dur: 0.08, vol: 0.12, filterFreq: 900 });
    },

    // 格挡：金属感方波下坠 + 高音脆响
    block() {
      this._tone({ type: 'square', f0: 700, f1: 330, dur: 0.09, vol: 0.45 });
      this._tone({ type: 'square', f0: 1100, f1: 900, dur: 0.05, vol: 0.2 });
    },

    // 下课铃：叮—咚 两连击
    bell() {
      this._tone({ type: 'square', f0: 880, f1: 860, dur: 0.28, vol: 0.3, rel: 0.25 });
      this._tone({ type: 'square', f0: 660, f1: 650, dur: 0.45, vol: 0.28, rel: 0.4, at: 0.001, delay: 0.3 });
    },

    // 雷雨：低通噪声渐弱
    thunder() { this._noise({ dur: 1.25, vol: 0.4, filterFreq: 420, at: 0.06 }); },

    // 拾取光球：上行双音
    pickup() {
      this._tone({ type: 'square', f0: 660, dur: 0.07, vol: 0.25 });
      this._tone({ type: 'square', f0: 990, dur: 0.1, vol: 0.25, at: 0.002, delay: 0.07 });
    },

    // 暴击：尖锐上行
    crit() { this._tone({ type: 'square', f0: 880, f1: 1760, dur: 0.12, vol: 0.4 }); },

    // 界面点击
    ui() { this._tone({ type: 'square', f0: 1200, f1: 1100, dur: 0.03, vol: 0.18, rel: 0.01 }); },

    // 彩蛋解锁：四音上行小旋律
    egg() {
      [523, 659, 784, 1047].forEach((f, i) => {
        this._tone({ type: 'square', f0: f, dur: 0.09, vol: 0.22, at: 0.002, rel: 0.06, delay: i * 0.09 });
      });
    },

    // 打字机滴答
    typing() { this._tone({ type: 'square', f0: 2100, f1: 2000, dur: 0.015, vol: 0.06, rel: 0.01 }); },
  };

  /** 原创八小节循环；按 AudioContext 时钟预排，挂起期间不推进乐谱。 */
  startBgm(key = 'stage1') {
    this.init();
    if (!this.ctx || !SCORES[key]) return;
    if (this._bgmTimer !== null && this._bgmKey === key) return;
    this.stopBgm();
    this._bgmKey = key;
    this._bgmNextTime = this.ctx.currentTime;
    const schedule = () => {
      if (this.ctx.state !== 'running') return;
      this._bgmNextTime = Math.max(this._bgmNextTime, this.ctx.currentTime);
      while (this._bgmNextTime < this.ctx.currentTime + 0.12) {
        const { duration, notes } = scoreStep(key, this._bgmStep);
        for (const note of notes) this._tone({ ...note, when: this._bgmNextTime, destination: this.music });
        this._bgmNextTime += duration;
        this._bgmStep = (this._bgmStep + 1) % 64;
      }
    };
    schedule();
    this._bgmTimer = setInterval(schedule, 25);
  }

  stopBgm() {
    if (this._bgmTimer !== null) {
      clearInterval(this._bgmTimer);
      this._bgmTimer = null;
    }
    for (const source of this._bgmSources) {
      try { source.stop(); } catch { /* 已结束 */ }
    }
    this._bgmSources.clear();
    this._bgmStep = 0;
    this._bgmKey = null;
  }
}

/** 全项目共享单例；各模块直接 import { audio } 使用。 */
export const audio = new AudioManager();
