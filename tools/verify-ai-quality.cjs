const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'D:/AgentHub/cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'output/playwright/ai-quality'));
fs.mkdirSync(out, { recursive: true });
process.env.TEMP = out;
process.env.TMP = out;
const report = { checkedAt: new Date().toISOString(), checks: [], pageErrors: [],
  method: 'Actual Vite source, real Phaser and Edge, natural RAF. Controlled spawns, lethal damage, grounded horizontal-control calls, RNG, restarts, guard calls and projectile/event/healing setup. No module mocks. Not a full playthrough, human balance sample or #74 reproduction.' };
const record = (name, pass, evidence) => report.checks.push({ name, pass: Boolean(pass), evidence });
(async () => {
  let browser;
  let vite;
  try {
    const { createServer } = await import(pathToFileURL(path.join(root, 'game/node_modules/vite/dist/node/index.js')).href);
    vite = await createServer({ root: path.join(root, 'game'), configFile: false, cacheDir: path.join(out, 'vite-cache'), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
    await vite.listen();
    browser = await chromium.launch({ executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--disable-gpu', '--disable-software-rasterizer'], env: { ...process.env, TEMP: out, TMP: out } });
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    page.on('pageerror', (error) => report.pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}`);
    await page.waitForFunction(() => window.__FORGET_ME_NOT__?.scene.getScene('StageScene')?.player?.isGrounded, null, { timeout: 60000 });
    report.renderer = await page.evaluate(() => window.__FORGET_ME_NOT__.renderer.type);
    const initial = await page.evaluate(() => {
      const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
      const player = scene.player;
      player._handleHorizontal(16, { right: true });
      const baseline = player.body.velocity.x;
      for (const type of ['paperSpirit', 'sleepBug', 'inspector']) scene.ai.spawnMonster(type, 1000, player.y).takeDamage(10000, { isMelee: true });
      player._handleHorizontal(16, { right: true });
      const boosted = player.body.velocity.x;
      player.setVelocityX(0);
      scene.ai.onEasterEgg('puppy-box');
      return { baseline, boosted, owned: [...player.stagePassives], broadcast: player.broadcastExercise, dog: scene.ai.dog.form };
    });
    record('real monster deaths grant all youth passives and15% horizontal speed', initial.owned.length === 3 && initial.broadcast && Math.abs(initial.boosted / initial.baseline - 1.15) < 1e-9, initial);
    for (const phase of ['middle', 'elder', 'youth']) {
      const before = await page.evaluate((phase) => {
        const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
        window.__aiQualityShutdown = null;
        scene.events.once('shutdown', () => {
          window.__aiQualityShutdown = { installed: scene._juiceInstalled, scale: scene.physics.world?.timeScale ?? null,
            oldJuiceListeners: ['ai:damage', 'player:damaged', 'ai:fx', 'ai:boss:phase'].flatMap((key) => scene.events.listeners(key).filter((handler) => ['onDamage', 'onPlayerDamaged', 'onFx', 'onBossPhase'].includes(handler.name)).map((handler) => handler.name)) };
        });
        scene.events.emit('ai:damage', { x: scene.player.x, y: scene.player.y, amount: 1 });
        const scale = scene.physics.world.timeScale;
        scene.scene.restart({ phase });
        return { scale };
      }, phase);
      await page.waitForFunction((phase) => {
        const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
        return scene.phaseId === phase && scene.player?.isGrounded && window.__aiQualityShutdown;
      }, phase, { timeout: 30000 });
      const after = await page.evaluate(() => {
        const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
        const player = scene.player;
        const startupScale = scene.physics.world.timeScale;
        const restoredMoveMult = player.passiveMoveMult;
        player.passiveMoveMult = 1;
        player._handleHorizontal(16, { right: true });
        const baseline = player.body.velocity.x;
        player.passiveMoveMult = restoredMoveMult;
        player._handleHorizontal(16, { right: true });
        const boosted = player.body.velocity.x;
        player.setVelocityX(0);
        player.applySlow(0.6, 2);
        const slowMs = player.stageSlowUntil - scene.time.now;
        player.stageSlowUntil = 0;
        player.blockHeldForMs = 1000;
        player.hurtLockMs = 0;
        player.invulnMs = 0;
        const block = player.takeDamage(20, { source: 'probe', fromX: player.x + 20 });
        player.blockHeldForMs = 0;
        player.invulnMs = 0;
        const listeners = Object.fromEntries(['ai:damage', 'player:damaged', 'ai:fx', 'ai:boss:phase'].map((key) => [key, scene.events.listeners(key).filter((handler) => ['onDamage', 'onPlayerDamaged', 'onFx', 'onBossPhase'].includes(handler.name)).length]));
        const shakeCalls = [];
        const camera = scene.cameras.main;
        const originalShake = camera.shake;
        camera.shake = function (...args) { shakeCalls.push(args); return originalShake.apply(this, args); };
        try { scene.events.emit('ai:boss:phase', { phase: 2 }); }
        finally { camera.shake = originalShake; }
        scene.events.emit('ai:damage', { x: player.x, y: player.y, amount: 1 });
        return { phase: scene.phaseId, owned: [...player.stagePassives], broadcast: player.broadcastExercise,
          baseline, boosted, restoredMoveMult, slowMs, block, listeners, shakeCalls, juiceShakes: shakeCalls.filter((args) => args[0] === 300 && args[1] === 0.01).length, startupScale, hitstopScale: scene.physics.world.timeScale,
          shutdown: window.__aiQualityShutdown, dog: scene.ai.dog?.form };
      });
      record(`${phase}: youth passives persist with real Player effects`, ['paperSpirit', 'sleepBug', 'inspector'].every((type) => after.owned.includes(type)) && after.broadcast && Math.abs(after.boosted / after.baseline - 1.15) < 1e-9 && after.slowMs === 1000 && Math.abs(after.block.damage - 3) < 1e-9, after);
      record(`${phase}: restart removes old Juice handlers and starts world at normal timescale`, before.scale === 4 && !after.shutdown.installed && (after.shutdown.scale === null || after.shutdown.scale === 1) && after.startupScale === 1 && after.shutdown.oldJuiceListeners.length === 0 && Object.values(after.listeners).every((count) => count === 1) && after.juiceShakes === 1 && after.hitstopScale === 4, { before, after });
      await page.waitForTimeout(160);
      record(`${phase}: real scene clock releases hitstop`, await page.evaluate(() => window.__FORGET_ME_NOT__.scene.getScene('StageScene').physics.world.timeScale) === 1, '160ms wall-clock wait; no manual step/pump');
      if (phase === 'middle') {
        const ai = await page.evaluate(() => {
          const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
          const player = scene.player;
          const manager = scene.ai;
          const results = [];
          for (const type of ['overtimeGhost', 'requirementVortex']) {
            const monster = manager.spawnMonster(type, player.x + 950, player.y);
            const snapshots = [];
            for (const distance of [950, 63, 74, 121]) {
              monster.setPosition(player.x + distance, player.y);
              monster.patrolDir = 1;
              monster.update(scene.time.now, 16);
              snapshots.push({ distance, state: monster.state, vx: monster.body.velocity.x });
            }
            results.push({ type, snapshots });
            monster.destroy();
          }
          const dog = manager.dog;
          const dots = [10, -10].map((offset) => manager.spawnMonster('unreadDot', player.x + offset, player.y));
          const hp = player.hp;
          dog.guardExplosives();
          const defused = dots.every((dot) => dot.dead);
          const makeBullet = (source, offset) => manager.bullets.spawn({ x: player.x + offset, y: player.y, texture: 'bullet_letter', source, faction: 'enemy', damage: 1 });
          const wave = makeBullet('shockwave', 30);
          const smoke = makeBullet('smoke', 35);
          const ordinary = makeBullet('projectile', 40);
          scene.events.emit('ai:fx', { type: 'slam', x: player.x, y: player.y });
          const guards = { adult: dog.form, defused, hpBefore: hp, hpAfter: player.hp, waveActive: wave.active, smokeActive: smoke.active, ordinaryActive: ordinary.active, letterStorm: Boolean(manager.boss?.letterRainActive) };
          manager.bullets.clearAll();
          player.hp = player.maxHp - 20;
          manager.lastPlayerDamageAt = scene.time.now - 4000;
          dog.nextHealAt = scene.time.now;
          player.setVelocityX(120);
          dog.updateHealAura(scene.time.now);
          const movingHp = player.hp;
          player.setVelocityX(0);
          player.rangedActionMs = 0;
          dog.updateHealAura(scene.time.now);
          return { results, guards, healing: { movingHp, restingHp: player.hp, grounded: player.isGrounded } };
        });
        record('real custom monsters acquire at63px and disengage beyond120px', ai.results.every(({ snapshots }) => snapshots.map((sample) => sample.state).join(',') === 'PATROL,CHASE,CHASE,PATROL' && snapshots[0].vx > 0 && snapshots[1].vx < 0 && snapshots[3].vx > 0), ai.results);
        record('adult dog defuses dots and blocks stamp outside letter storm', ai.guards.adult === 'adult' && ai.guards.defused && ai.guards.hpAfter === ai.guards.hpBefore && !ai.guards.waveActive && ai.guards.smokeActive && ai.guards.ordinaryActive && !ai.guards.letterStorm, ai.guards);
        record('adult dog heals grounded resting player after movement stops', ai.healing.grounded && ai.healing.restingHp - ai.healing.movingHp === 10, ai.healing);
      }
    }
    const kills = await page.evaluate(() => {
      const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
      const player = scene.player;
      const originalRandom = Math.random;
      const samples = [];
      try {
        for (const sample of [{ roll: 0, opts: { isMelee: true } }, { roll: 0, opts: { fromProjectile: true } }, { roll: 0.25, opts: { isMelee: true } }]) {
          player.mp = 20;
          const monster = scene.ai.spawnMonster('sleepBug', 1000, player.y);
          if (sample.opts.isMelee) Math.random = () => { Math.random = originalRandom; return sample.roll; };
          monster.takeDamage(10000, sample.opts);
          samples.push({ ...sample, mp: player.mp });
        }
      } finally { Math.random = originalRandom; }
      return samples;
    });
    record('real killing blows proc5MP only for melee with RNG below25%', kills.map((sample) => sample.mp).join(',') === '25,20,20', kills);
    await page.screenshot({ path: path.join(out, 'ai-quality-final.png') });
    record('no browser page errors', report.pageErrors.length === 0, report.pageErrors);
  } catch (error) {
    report.fatal = error.stack;
    process.exitCode = 2;
  } finally {
    await browser?.close();
    await vite?.close();
    fs.writeFileSync(path.join(out, 'ai-quality-browser.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (report.checks.some((check) => !check.pass)) process.exitCode ||= 1;
  }
})();
