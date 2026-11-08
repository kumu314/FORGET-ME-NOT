/**
 * 演示后半段证据包取证脚本（卡 3：只取证，不改游戏代码）。
 *
 * 一条命令复跑：node game/tools/demo-evidence.cjs
 *
 * 产物（写入 docs/demo-evidence/）：
 *   - shots/*.png  11 张本地 + 1 张线上 Pages 首屏
 *   - raw/run.json     本地全程读数（快照/耗时/音频探针/pageerror/遥测摘要）
 *   - raw/online.json  线上 Pages 复验读数
 *
 * 诚实标注：
 *   - 玩家位置用 body.reset() 传送（非自然走位），触发 Boss/彩蛋/拥抱前均先落地再按方向键逼近；
 *   - headless 无声卡，音频只验「WebAudio 节点创建链路在跑」，不验真实出声；
 *   - 攻击用 J 键脉冲连打，玩家不闪避不格挡，死亡即如实记录。
 */
const { chromium } = require('./node_modules/playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.resolve(__dirname, '../dist');
const OUT = path.resolve(__dirname, '../../docs/demo-evidence');
const ONLINE_URL = 'https://kumu314.github.io/UNTIL-THE-END/';
const PROXY = process.env.FMN_PROXY || 'http://127.0.0.1:7897';

fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'raw'), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** 在任何页面脚本之前注入：WebAudio 调用探针（只读计数，不改行为） */
const AUDIO_PROBE_INIT = `
(() => {
  const probe = { contexts: 0, oscillator: 0, bufferSource: 0, gain: 0, filter: 0, resumes: 0, lastState: null, t0: Date.now() };
  Object.defineProperty(window, '__fmnAudioProbe', { value: probe });
  const AC = window.AudioContext;
  if (!AC) return;
  const count = (proto, method, key) => {
    const orig = proto[method];
    if (typeof orig !== 'function') return;
    proto[method] = function (...args) { probe[key] += 1; return orig.apply(this, args); };
  };
  count(AC.prototype, 'createOscillator', 'oscillator');
  count(AC.prototype, 'createBufferSource', 'bufferSource');
  count(AC.prototype, 'createGain', 'gain');
  count(AC.prototype, 'createBiquadFilter', 'filter');
  const origResume = AC.prototype.resume;
  if (typeof origResume === 'function') {
    AC.prototype.resume = function (...args) {
      probe.resumes += 1;
      probe.lastState = this.state;
      return origResume.apply(this, args).then((v) => { probe.lastState = this.state; return v; });
    };
  }
  const OrigAC = AC;
  function PatchedAudioContext(...args) { probe.contexts += 1; return new OrigAC(...args); }
  PatchedAudioContext.prototype = OrigAC.prototype;
  window.AudioContext = PatchedAudioContext;
  window.__eggModalEvents = { open: 0, close: 0 };
  window.addEventListener('egg-modal:open', () => window.__eggModalEvents.open += 1);
  window.addEventListener('egg-modal:close', () => window.__eggModalEvents.close += 1);
})();
`;

/** 静态文件服务器：伺服 vite 构建产物 */
function serveDist() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.wav': 'audio/wav', '.json': 'application/json', '.md': 'text/plain', '.txt': 'text/plain' };
  const srv = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (u === '/') u = '/index.html';
    const f = path.join(DIST, u);
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); res.end('404'); return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port })));
}

async function main() {
  const startedAt = new Date();
  const run = {
    scriptStartedAt: startedAt.toISOString(),
    baseline: 'main = 58a46cf8800885e7105993e2cce67031fd82d421',
    teleportCaveat: '玩家位置用 body.reset() 传送，非自然走位（卡 3 要求如实标注）',
    steps: [],
    audioByPhase: {},
    pageErrors: [],
    consoleErrors: [],
    telemetrySummary: null,
    problems: [],
  };

  const record = (step, data) => {
    run.steps.push({ step, at: new Date().toISOString(), ...data });
    console.log(`[${step}] ${JSON.stringify(data)}`);
    // 增量落盘：即使中途 fatal，已采集的读数和 pageerror 也不丢
    fs.writeFileSync(path.join(OUT, 'raw', 'run.json'), JSON.stringify(run, null, 2));
  };

  const { srv, port } = await serveDist();
  console.log(`serving dist at http://127.0.0.1:${port}/`);

  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge',
    args: ['--disable-webgl', '--disable-gpu-sandbox'], // 强制 Canvas 渲染：WebGL canvas 截图必黑（项目已知坑）
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => run.pageErrors.push(String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') run.consoleErrors.push(m.text().slice(0, 300)); });
  await page.addInitScript(AUDIO_PROBE_INIT);

  const snap = () => page.evaluate(() => {
    const g = window.__FORGET_ME_NOT__;
    const s = g?.scene?.getScene('StageScene');
    const boss = s?.ai?.activeBoss?.() ?? null;
    return {
      phase: s?.phaseId ?? null,
      stageActive: g ? g.scene.isActive('StageScene') : false,
      endingActive: g ? g.scene.isActive('EndingScene') : false,
      x: s?.player ? Math.round(s.player.x) : null,
      hp: s?.player ? Math.round(s.player.hp) : null,
      maxHp: s?.player?.maxHp ?? null,
      isDead: s?.player?.isDead ?? null,
      hasDog: !!s?.ai?.dog,
      dogForm: s?.ai?.dog?.form ?? null,
      boss: boss ? { kind: boss.kind, hp: Math.round(boss.hp), hpMax: boss.hpMax, x: Math.round(boss.x) } : null,
      modalOpen: s?.modalOpen ?? false,
      endingPlayed: s?.endingPlayed ?? false,
      loveLetter: s?.player?.loveLetter ?? null,
      renderType: g?.renderType ?? g?.config?.renderType ?? null,
    };
  });
  const audioSnap = () => page.evaluate(() => {
    const p = window.__fmnAudioProbe;
    return p ? { ...p } : null;
  });
  const shot = (name) => page.screenshot({ path: path.join(OUT, 'shots', `${name}.png`) });

  const waitFor = async (fn, { timeout = 30000, interval = 250, desc = '' } = {}) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      let v;
      try { v = await fn(); } catch { /* 场景转场期间 getScene 可能短暂拿不到，忽略重试 */ }
      if (v) return v;
      await sleep(interval);
    }
    throw new Error(`waitFor 超时(${timeout}ms): ${desc}`);
  };

  /** 传送（诚实标注：非自然走位），并等落地使 isGrounded=true（拥抱判定的前提） */
  const teleport = async (x) => {
    await page.evaluate((tx) => {
      const s = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
      s.player.body.reset(tx, 185);
    }, x);
    await sleep(1300);
  };

  /**
   * 自动打法 v4（键位契约来自 Player.js 头注释：J 近战三连击 / L 远程投掷 / S 格挡免伤 70%）：
   * - 距离驱动：贴身(≤80px)脉冲 J，被击退拉开后按住 D 追击 + 脉冲 L 远程消耗；
   * - 每 5 个攻击动作插一段 S 格挡（免伤 70%）；
   * - 升级模态（LevelUpModal，Digit1/2/3 三选一）弹出时按 1 选攻击并继续；
   * - boss 判定需连续 3 次快照无 boss（防登场/换阶段演出的短暂 activeBoss()=null 误判）。
   */
  const fightBoss = async ({ fightShot, fightShotAtMs = 6000, maxSec = 150 }) => {
    const t0 = Date.now();
    let midShotDone = false;
    let last = null;
    let peakDamage = 0;
    let tick = 0;
    let bossNullStreak = 0;
    let timedOut = true;
    while (Date.now() - t0 < maxSec * 1000) {
      last = await snap();
      if (last.modalOpen) { // 升级/彩蛋模态会吞掉所有攻击输入：按 1 选攻击升级后继续
        await page.keyboard.up('KeyD');
        await page.keyboard.press('Digit1'); await sleep(450);
        continue;
      }
      if (!last.boss || last.boss.hp <= 0) {
        bossNullStreak += 1;
        if (bossNullStreak >= 3) { timedOut = false; break; } // 连续 3 次无 boss = 真被击败
      } else {
        bossNullStreak = 0;
        peakDamage = Math.max(peakDamage, last.boss.hpMax - last.boss.hp);
      }
      const dist = last.boss && last.x !== null ? last.boss.x - last.x : 0;
      if (Math.abs(dist) > 80) await page.keyboard.down('KeyD');
      else await page.keyboard.up('KeyD');
      if (Math.abs(dist) <= 90) {
        await page.keyboard.down('KeyJ'); await sleep(80);
        await page.keyboard.up('KeyJ'); await sleep(140);
      } else {
        await page.keyboard.down('KeyL'); await sleep(80);
        await page.keyboard.up('KeyL'); await sleep(180);
      }
      tick += 1;
      if (tick % 6 === 0) { // 格挡轮换：免伤 70% 的喘息窗口（频率调低，保输出）
        await page.keyboard.down('KeyS'); await sleep(300);
        await page.keyboard.up('KeyS'); await sleep(100);
      }
      if (!midShotDone && Date.now() - t0 > fightShotAtMs && last.boss && last.boss.hp < last.boss.hpMax) {
        await page.keyboard.up('KeyD');
        await shot(fightShot);
        midShotDone = true;
      }
      if (last.isDead) {
        await page.keyboard.up('KeyD');
        return { outcome: 'player-dead', elapsedSec: round((Date.now() - t0) / 1000), peakDamage, last };
      }
    }
    await page.keyboard.up('KeyD');
    return { outcome: timedOut ? 'timeout' : 'boss-down', elapsedSec: round((Date.now() - t0) / 1000), peakDamage, midShotDone, last };
  };

  /** 清残留模态：升级模态 Digit1 选择（LevelUpModal），彩蛋模态 Enter 快进+关闭（EasterEggModal） */
  const dismissModals = async () => {
    const s = await snap();
    if (!s.modalOpen) return false;
    await page.keyboard.press('Digit1'); await sleep(400);
    await page.keyboard.press('Enter'); await sleep(400);
    await page.keyboard.press('Enter'); await sleep(500);
    return true;
  };

  /** 玩家死亡兜底：等待死亡演出后按 T 循环切关到目标 phase（卡 3 已知坑：T 后等 ≥900ms） */
  const ensurePhase = async (target) => {
    let cur = await snap();
    if (cur.phase === target) return cur;
    for (let i = 0; i < 3 && cur.phase !== target; i++) {
      await page.keyboard.press('KeyT');
      await sleep(1500);
      cur = await snap();
    }
    if (cur.phase !== target) throw new Error(`ensurePhase 失败: 期望 ${target} 实际 ${cur.phase}`);
    await sleep(1200); // 等 restart 后场景稳定
    return cur;
  };

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await waitFor(() => page.evaluate(() => {
    const s = window.__FORGET_ME_NOT__?.scene?.getScene('StageScene');
    return s?.player ? true : false;
  }), { timeout: 30000, desc: 'BootScene → StageScene(player) 就绪' });
  await sleep(2500); // 等 HUD/BGM 起播
  run.audioByPhase.youthStart = await audioSnap();
  record('boot', await snap());

  /* ============ 阶段 A · youth：小狗纸箱彩蛋 → Boss 班主任 ============ */
  await teleport(836); // 落点避开 paperSpirit(x=780) 触碰圈，纸箱(866)左侧 30px
  // 纸箱两段式（StageScene._updateEasterEggs：|x-866|<14 触发；未 smashed 只弹提示）。
  // 状态驱动取证：先在圈外(≤852) J 打封条 → 轮询 egg.smashed → 破箱后纯 D 进圈，
  // 避免上一轮"破箱瞬间人已在圈内→模态被后续 J 连按秒关(egg-modal open=1 close=1)"的取证失误。
  const eggState = () => page.evaluate(() => {
    const s = window.__FORGET_ME_NOT__?.scene?.getScene('StageScene');
    const e = s?.easterEggs?.find?.((x) => x.id === 'puppy-box');
    return {
      smashed: !!e?.smashed, taken: !!e?.taken,
      modalOpen: !!s?.modalOpen, modalOpens: window.__eggModalEvents?.open ?? 0,
    };
  });
  let egg = await eggState();
  for (let round$ = 1; round$ <= 4 && !egg.smashed; round$++) {
    for (let j = 0; j < 8 && !egg.smashed; j++) {
      await page.keyboard.down('KeyJ'); await sleep(80);
      await page.keyboard.up('KeyJ'); await sleep(150);
      egg = await eggState();
    }
    if (!egg.smashed) { // 没够到封条就贴近一点再打
      await page.keyboard.down('KeyD'); await sleep(110); await page.keyboard.up('KeyD'); await sleep(250);
    }
  }
  const smashed = egg.smashed;
  if (smashed) {
    await page.keyboard.down('KeyD'); await sleep(520); await page.keyboard.up('KeyD'); // 纯移动进圈，无按键干扰模态
    const modalOn = await waitFor(() => eggState().then((e) => e.modalOpen), { timeout: 5000, interval: 150, desc: '彩蛋模态打开' }).then(() => true).catch(() => false);
    egg = await eggState();
    await shot('07-puppy-box-egg-modal');
    record('egg-puppy-box', { smashed: true, modalOpened: modalOn, ...egg, ...(await snap()) });
    if (modalOn) {
      // 关模态：Enter 先快进打字机、再关（EasterEggModal 契约：Space/Enter/J/Esc）
      await page.keyboard.press('Enter'); await sleep(500);
      await page.keyboard.press('Enter'); await sleep(900);
    } else {
      run.problems.push(`youth 小狗纸箱：封条已破但模态未开或被秒关(modalOpens=${egg.modalOpens})（未修，仅登记）`);
    }
  } else {
    run.problems.push('youth x≈866 小狗纸箱 4 轮 J 连打未能打破封条（未修，仅登记）');
    await shot('07-puppy-box-egg-modal'); // 如实保留现场画面
    record('egg-puppy-box', { smashed: false, ...egg, ...(await snap()) });
  }
  record('dog-youth', await snap()); // hasDog/form 实况（预期 puppy）

  // 情书支线（issue #16：桌洞纸堆 x=308 打碎掉情书 → 近战 +25%「怦然心动」）：
  // Boss1 忠犬是 puppy 无战斗力，玩家 Solo 420HP 站桩换血不够，顺路取增益是合法玩法内手段
  await teleport(268);
  for (let j = 0; j < 10; j++) {
    await page.keyboard.down('KeyJ'); await sleep(80);
    await page.keyboard.up('KeyJ'); await sleep(150);
  }
  await sleep(600); // 等碎纸/掉落演出
  await page.keyboard.down('KeyD'); await sleep(600); await page.keyboard.up('KeyD');
  await sleep(800); // 掉落物触碰 + 可能的模态
  let eggNow = await snap();
  if (eggNow.modalOpen) { // love-letter 模态：Enter 快进 + 关闭
    await page.keyboard.press('Enter'); await sleep(400);
    await page.keyboard.press('Enter'); await sleep(800);
    eggNow = await snap();
  }
  record('love-letter', { loveLetter: eggNow.loveLetter, x: eggNow.x, modalOpen: eggNow.modalOpen });
  if (!eggNow.loveLetter) run.problems.push('youth x≈308 纸堆情书未拾取（loveLetter=false），Boss1 少 +25% 近战增益（未修，仅登记）');

  // Boss 1 · 班主任（triggerX 1230，出生 x=1430，arena 1150-1580）
  await dismissModals();
  await teleport(1200);
  await page.keyboard.down('KeyD'); await sleep(2300); await page.keyboard.up('KeyD');
  await waitFor(() => snap().then((s) => !!s.boss), { timeout: 10000, desc: 'Boss1 登场' });
  await sleep(900); // 登场演出 + toast
  await shot('01-boss-teacher-intro');
  const boss1Before = await snap();
  record('boss1-intro', boss1Before);
  const boss1 = await fightBoss({ fightShot: '02-boss-teacher-fight' });
  await shot('03-boss-teacher-defeat'); // defeat 演出 1400ms 窗口内抢帧（若玩家死亡则为死亡画面）
  record('boss1-defeat', { outcome: boss1.outcome, elapsedSec: boss1.elapsedSec, peakDamage: boss1.peakDamage, final: await snap() });
  if (boss1.outcome === 'boss-down') {
    await waitFor(() => snap().then((s) => s.phase === 'middle' && s.x !== null), { timeout: 40000, desc: '转场 → middle 就绪' });
  } else {
    if (boss1.outcome === 'player-dead') run.problems.push(`Boss1（班主任）自动打法 ${boss1.elapsedSec}s 玩家死亡，对 Boss 最高伤害 ${boss1.peakDamage}/420（未修，仅登记）`);
    else run.problems.push(`Boss1（班主任）自动打法 ${boss1.elapsedSec}s 超时未击败，伤害 ${boss1.peakDamage}/420（未修，仅登记）`);
    await sleep(2500); // 等死亡/僵局演出
    await ensurePhase('middle'); // T 键兜底切关（死亡不阻塞 _cyclePhase）
  }
  run.audioByPhase.middleStart = await audioSnap();
  await sleep(1500);

  /* ============ 阶段 B · middle：忠犬继承 → Boss 雇主 ============ */
  await dismissModals();
  const dogMiddle = await snap();
  await shot('08-dog-adult-middle');
  record('dog-middle', dogMiddle); // 预期 hasDog=true form=adult（attachDogForLevel 自动继承）

  // Boss 2 · 雇主（triggerX 1300，出生 x=1440，arena 1240-1580；落点避开 x=1250 涡流）
  await dismissModals();
  await teleport(1288);
  await page.keyboard.down('KeyD'); await sleep(900); await page.keyboard.up('KeyD');
  await waitFor(() => snap().then((s) => !!s.boss), { timeout: 10000, desc: 'Boss2 登场' });
  await sleep(900);
  await shot('04-boss-employer-intro');
  const boss2Before = await snap();
  record('boss2-intro', boss2Before);
  const boss2 = await fightBoss({ fightShot: '05-boss-employer-fight' });
  await shot('06-boss-employer-defeat');
  record('boss2-defeat', { outcome: boss2.outcome, elapsedSec: boss2.elapsedSec, peakDamage: boss2.peakDamage, final: await snap() });
  if (boss2.outcome === 'boss-down') {
    await waitFor(() => snap().then((s) => s.phase === 'elder' && s.x !== null), { timeout: 40000, desc: '转场 → elder 就绪' });
  } else {
    if (boss2.outcome === 'player-dead') run.problems.push(`Boss2（雇主）自动打法 ${boss2.elapsedSec}s 玩家死亡，对 Boss 最高伤害 ${boss2.peakDamage}/460（未修，仅登记）`);
    else run.problems.push(`Boss2（雇主）自动打法 ${boss2.elapsedSec}s 超时未击败，伤害 ${boss2.peakDamage}/460（未修，仅登记）`);
    await sleep(2500);
    await ensurePhase('elder');
  }
  run.audioByPhase.elderStart = await audioSnap();
  await sleep(1500);

  /* ============ 阶段 C · elder：忠犬老年形态 → 拥抱 → EndingScene ============ */
  await dismissModals();
  const dogElder = await snap();
  await shot('09-dog-elder-stage');
  record('dog-elder', dogElder); // 预期 form=elder

  // 拥抱：孩子 x=1472 hugDistance=22 facing=1 → 玩家 x∈[1450,1472] 落地且 vx>0（从左向右）
  await teleport(1430);
  await page.keyboard.down('KeyD'); await sleep(650); await page.keyboard.up('KeyD');
  const hug = await waitFor(() => snap().then((s) => s.endingPlayed), { timeout: 12000, desc: '拥抱触发(endingPlayed)' });
  await shot('10-ending-hug-toast');
  record('hug', hug); // toast「你轻轻抱住了孩子」帧

  // EndingScreen: hug → 1.2s → fadeOut 0.7s → _advanceStage → EndingScene
  await waitFor(() => page.evaluate(() => window.__FORGET_ME_NOT__.scene.isActive('EndingScene')), { timeout: 30000, desc: 'EndingScene 激活' });
  await sleep(3200); // 等打字机出字
  await shot('11-ending-scene');
  record('ending-scene', await page.evaluate(() => {
    const e = window.__FORGET_ME_NOT__?.scene?.getScene('EndingScene');
    return { endingActive: true, visibleText: (e?.typewriter?.text ?? e?.storyText ?? '').slice(0, 60) || null };
  }));
  run.audioByPhase.end = await audioSnap();

  // 遥测摘要（PlaytestTelemetry 已挂 window.__fmnTelemetry）
  run.telemetrySummary = await page.evaluate(() => window.__fmnTelemetry?.summary?.() ?? null).catch(() => null);

  await browser.close();
  srv.close();

  /* ============ 线上 Pages 复验（走本地代理；独立浏览器实例） ============ */
  const online = { url: ONLINE_URL, checkedAt: new Date().toISOString() };
  try {
    const ob = await chromium.launch({
      headless: true, channel: 'msedge',
      args: ['--disable-webgl', '--disable-gpu-sandbox'],
      proxy: { server: PROXY, bypass: '127.0.0.1' },
    });
    const op = await ob.newPage({ viewport: { width: 1280, height: 720 } });
    const badResponses = [];
    op.on('pageerror', (e) => (online.pageErrors ??= []).push(String(e).slice(0, 300)));
    op.on('response', (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url().slice(0, 120)}`); });
    await op.goto(ONLINE_URL, { waitUntil: 'load', timeout: 45000 });
    await sleep(7000);
    online.readiness = await op.evaluate(() => {
      const g = window.__FORGET_ME_NOT__;
      return { hasGame: !!g, stageActive: g ? g.scene.isActive('StageScene') : false, renderType: g?.renderType ?? g?.config?.renderType ?? null };
    }).catch((e) => ({ error: String(e).slice(0, 200) }));
    online.http4xx5xx = badResponses;
    await op.screenshot({ path: path.join(OUT, 'shots', '12-online-pages.png') });
    online.screenshot = 'shots/12-online-pages.png';
    await ob.close();
  } catch (e) {
    online.error = String(e).slice(0, 400); // 代理/网络不可达时如实记录，不中断本地证据
  }
  fs.writeFileSync(path.join(OUT, 'raw', 'online.json'), JSON.stringify(online, null, 2));
  console.log('[online]', JSON.stringify(online));

  run.scriptFinishedAt = new Date().toISOString();
  run.totalSec = round((Date.now() - startedAt.getTime()) / 1000);
  fs.writeFileSync(path.join(OUT, 'raw', 'run.json'), JSON.stringify(run, null, 2));

  const shots = fs.readdirSync(path.join(OUT, 'shots')).filter((f) => f.endsWith('.png'));
  console.log('\n===== 摘要 =====');
  console.log(`截图 ${shots.length} 张 -> docs/demo-evidence/shots/`);
  console.log(`pageErrors=${run.pageErrors.length} consoleErrors=${run.consoleErrors.length}`);
  console.log(`问题登记 ${run.problems.length} 条`);
  process.exit(0);
}

main().catch((e) => { console.error('[fatal]', e); process.exit(1); });
