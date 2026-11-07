/**
 * BattleHUD —— 复古像素战斗 HUD（成员 E 交付模块）
 *
 * 功能（对应《开发分工与GitHub协作规范》成员 E 第 1 条验收项）：
 *   1. 玩家血条槽 / 能量条槽（复古分段像素格，低血量闪烁）
 *   2. Boss 血条（顶部居中，带 Boss 名称）
 *   3. 暴击飘字 / 伤害飘字 / 回血飘字 / 提示文字
 *   4. 玩家受伤红闪反馈
 *
 * 集成方式（成员 C 对接）：
 *   // 建议使用独立覆盖层画布（pointer-events: none），叠在游戏画布之上
 *   const hud = new BattleHUD(hudCanvas);
 *   hud.setResolution(480, 270);              // 与游戏逻辑分辨率一致（GDD 1.1）
 *
 *   每帧：
 *     hud.setCamera({ x, y });                // 同步相机
 *     hud.setPlayer({ hp, maxHp, mp, maxMp }); // 同步玩家数值
 *     hud.setBossHp(boss.hp);                 // Boss 存在时
 *     hud.render(dt);
 *
 *   战斗事件：
 *     hud.spawnDamage(wx, wy, 10, { crit: true });   // 世界坐标 → 自动换算屏幕
 *     hud.spawnText(wx, wy, '+5 能量', '#5bd7ff');
 *     hud.hurtFlash();                               // 玩家受伤红闪
 *     hud.showBoss({ name: '巨影班主任', maxHp: 1000 }); // Boss 进场
 *
 * 模块无任何外部依赖，纯 Canvas 2D 绘制，可覆盖在任意引擎渲染结果之上。
 */
export class BattleHUD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rw = 480; // 逻辑分辨率（调用 setResolution 与游戏对齐）
    this.rh = 270;
    this.camera = { x: 0, y: 0 };
    this.player = { hp: 200, maxHp: 200, mp: 50, maxMp: 50 };
    this.stage = '';      // 左上角关卡标签，如「第一关 · 青年」
    this.boss = null;     // { name, maxHp, hp }
    this.xp = null;       // { level, xp, next }（issue #17 经验条）
    this.popups = [];     // 飘字池
    this.flash = 0;       // 受伤红闪 0~1
    this.t = 0;
  }

  setResolution(w, h) { this.rw = w; this.rh = h; }
  setCamera(cam) { if (cam) Object.assign(this.camera, cam); }
  setPlayer(p) { if (p) Object.assign(this.player, p); }
  setStage(label) { this.stage = label; }
  setXp(state) { if (state) Object.assign(this.xp ??= {}, state); }

  showBoss({ name, maxHp = 1000, hp = maxHp }) { this.boss = { name, maxHp, hp }; }
  hideBoss() { this.boss = null; }
  setBossHp(hp) { if (this.boss) this.boss.hp = Math.max(0, hp); }

  /** 伤害 / 暴击飘字（传入世界坐标，内部按相机换算到屏幕） */
  spawnDamage(wx, wy, value, { crit = false } = {}) {
    this.popups.push({ wx, wy, text: String(value), crit, color: null, life: 0, maxLife: 0.9, vy: -26 });
  }

  /** 通用提示飘字（回血 / 回蓝 / 拾取等） */
  spawnText(wx, wy, text, color = '#5bd7ff') {
    this.popups.push({ wx, wy, text, crit: false, color, life: 0, maxLife: 1.1, vy: -20 });
  }

  /** 玩家受伤红闪 */
  hurtFlash() { this.flash = 1; }

  /** 计算整数倍点对点缩放与居中偏移（GDD 1.1：像素无模糊拉伸） */
  _layout() {
    const cw = this.canvas.width || this.canvas.clientWidth || this.rw;
    const ch = this.canvas.height || this.canvas.clientHeight || this.rh;
    const scale = Math.max(1, Math.floor(Math.min(cw / this.rw, ch / this.rh)));
    const ox = Math.floor((cw - this.rw * scale) / 2);
    const oy = Math.floor((ch - this.rh * scale) / 2);
    return { cw, ch, scale, ox, oy };
  }

  render(dt = 1 / 60) {
    const { ctx } = this;
    const L = this._layout();
    this.t += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);

    ctx.save();
    // 清空整块覆盖画布（letterbox 区域也清干净）
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, L.cw, L.ch);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(L.scale, 0, 0, L.scale, L.ox, L.oy);

    this._drawPopups(dt);
    this._drawBossBar();
    this._drawPlayerBars();
    this._drawStage();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${0.28 * this.flash})`;
      ctx.fillRect(0, 0, this.rw, this.rh);
    }
    ctx.restore();
  }

  /* ---------------- 内部绘制 ---------------- */

  _drawPopups(dt) {
    const { ctx } = this;
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life += dt;
      if (p.life >= p.maxLife) { this.popups.splice(i, 1); continue; }
      const k = p.life / p.maxLife;
      const x = (p.wx - this.camera.x);
      const y = (p.wy - this.camera.y) + p.vy * p.life;
      ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (p.crit) {
        ctx.font = 'bold 13px monospace';
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 1;
        ctx.strokeText(p.text, x, y);
        ctx.fillStyle = '#ffe15b';
      } else {
        ctx.font = '8px monospace';
        ctx.fillStyle = p.color || '#ffffff';
      }
      ctx.fillText(p.text, x, y);
      ctx.globalAlpha = 1;
    }
  }

  _drawPlayerBars() {
    const { hp, maxHp, mp, maxMp } = this.player;
    const x = 6, xpY = this.rh - 27, hpY = this.rh - 18, mpY = this.rh - 9;
    // 经验条（issue #17）：满级不必隐藏——它是常驻成长读数
    if (this.xp) {
      const { level, xp, next } = this.xp;
      this._label(`Lv.${level}`, x, xpY - 1);
      this._bar(x + 30, xpY, 96, 3, Math.min(xp, next), next, '#ffd75b');
    }
    this._label('HP', x, hpY - 1);
    this._bar(x + 18, hpY, 120, 6, hp, maxHp, '#ff5b5b', { lowBlink: 0.3 });
    this._label('MP', x, mpY - 1);
    this._bar(x + 18, mpY, 120, 4, mp, maxMp, '#5bd7ff');
  }

  _drawBossBar() {
    if (!this.boss) return;
    const { ctx } = this;
    const w = 170, x = Math.floor((this.rw - w) / 2), y = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - 2, y - 12, w + 4, 20);
    ctx.fillStyle = '#ffe15b';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.boss.name, this.rw / 2, y - 9);
    this._bar(x, y + 2, w, 6, this.boss.hp, this.boss.maxHp, '#ffd75b');
  }

  _drawStage() {
    if (!this.stage) return;
    const { ctx } = this;
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const w = ctx.measureText(this.stage).width + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(2, 2, w, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.stage, 6, 3);
  }

  _label(text, x, y) {
    const { ctx } = this;
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
  }

  /** 复古分段能量条：seg 段、段间 1px 空隙，低血量时闪烁 */
  _bar(x, y, w, h, val, max, color, { lowBlink = 0 } = {}) {
    const { ctx } = this;
    const seg = 20, gap = 1;
    const segW = Math.max(1, Math.floor((w - gap * (seg - 1)) / seg));
    const filled = Math.max(0, Math.round((val / max) * seg));
    const blink = lowBlink && max > 0 && val / max <= lowBlink && Math.floor(this.t * 4) % 2 === 0;

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    for (let i = 0; i < seg; i++) {
      ctx.globalAlpha = (i < filled && blink) ? 0.45 : 1;
      ctx.fillStyle = i < filled ? color : 'rgba(255,255,255,0.14)';
      ctx.fillRect(x + i * (segW + gap), y, segW, h);
    }
    ctx.globalAlpha = 1;
  }
}
