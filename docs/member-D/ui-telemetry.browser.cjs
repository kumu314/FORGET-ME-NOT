const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const { chromium } = require('D:/AgentHub/cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = process.env.GAME_WORKTREE || "D:/CodexOutputs/黑客松/UNTIL-THE-END-ui";
const out = "D:/CodexOutputs/黑客松/reports/quality-20261108";
process.env.TEMP = out; process.env.TMP = out;
const report = { workingTree: root, sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()), checkedAt: new Date().toISOString(), method: 'Actual source served by Vite; real Phaser and Edge; controlled state setup is disclosed per case; no source or runtime modules mocked', checks: [], pageErrors: [] };
const record = (name, pass, evidence) => report.checks.push({ name, pass: Boolean(pass), evidence });
(async () => {
  let browser;
  let vite;
  try {
    const { createServer } = await import(pathToFileURL(path.join(root, 'game/node_modules/vite/dist/node/index.js')).href);
    vite = await createServer({ root: path.join(root, 'game'), configFile: false, cacheDir: path.join(out, 'ui-fixed-vite-cache'), server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
    await vite.listen();
    const address = vite.httpServer.address();
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-sandbox'], env: { ...process.env, TEMP: out, TMP: out } });
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:' + address.port);
    await page.waitForFunction(() => window.__FORGET_ME_NOT__?.scene.getScene('StageScene')?.player?.isGrounded, null, { timeout: 60000 });
    const firstTelemetry = await page.evaluate(() => ({ phase: window.__fmnTelemetry?.data.phase, startedAt: window.__fmnTelemetry?.data.startedAt }));
    await page.evaluate(() => window.__fmnTelemetry.markContaminated('automation-probe'));
    record('initial stage installs telemetry', firstTelemetry.phase === 'youth', firstTelemetry);

    const keysBefore = await page.evaluate(() => window.__fmnTelemetry.data.keyPresses.melee);
    await page.keyboard.down('j');
    await page.keyboard.down('j');
    await page.keyboard.up('j');
    const keyEvents = await page.evaluate(() => window.__fmnTelemetry.data.keyPresses.melee);
    record('held-key repeat is not counted as a new physical press', keyEvents - keysBefore === 1, { physicalDownSequences: 1, generatedKeydowns: 2, secondKeydownRepeat: true, recordedPresses: keyEvents - keysBefore });

    await page.keyboard.down('d');
    await page.waitForFunction(() => window.__FORGET_ME_NOT__.scene.getScene('StageScene').inputCtl.getState().right);
    await page.locator('#audio-controls summary').click();
    await page.locator('#audio-controls input').first().focus();
    await page.keyboard.up('d');
    await page.waitForTimeout(100);
    const focusState = await page.evaluate(() => {
      const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
      return { activeElement: document.activeElement?.tagName, keyIsDown: scene.inputCtl._keyMap.get('D').isDown, right: scene.inputCtl.getState().right, velocityX: scene.player.body.velocity.x };
    });
    record('releasing movement inside audio controls clears the game key', !focusState.keyIsDown && !focusState.right, focusState);
    await page.locator('#audio-controls summary').click();
    await page.locator('#game-root canvas').click({ position: { x: 20, y: 20 } });
    await page.keyboard.down('d');
    await page.waitForTimeout(70);
    const returnedFocus = await page.evaluate(() => {
      const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
      return { activeElement: document.activeElement.tagName, keyIsDown: scene.inputCtl._keyMap.get('D').isDown, right: scene.inputCtl.getState().right, velocityX: scene.player.body.velocity.x };
    });
    record('clicking canvas releases audio-panel focus and restores game keys', returnedFocus.activeElement !== 'SUMMARY' && returnedFocus.keyIsDown && returnedFocus.right && returnedFocus.velocityX > 0, returnedFocus);
    await page.keyboard.up('d');
    const flushBeforeBlur = await page.evaluate(() => {
      const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
      scene.inputCtl.flush();
      return { stateRight: scene.inputCtl.getState().right, keyIsDown: scene.inputCtl._keyMap.get('D').isDown };
    });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(40);
    const blurState = await page.evaluate(() => {
      const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
      return { keyIsDown: scene.inputCtl._keyMap.get('D').isDown, right: scene.inputCtl.getState().right };
    });
    record('Phaser blur handling resets the key independently of InputController.flush', !blurState.keyIsDown && !blurState.right, { setup: 'Dispatch browser blur through the real window and Phaser listeners; no keyboard objects mocked', afterFlush: flushBeforeBlur, afterWindowBlur: blurState });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.locator('#game-root canvas').click({ position: { x: 20, y: 20 } });
    await page.keyboard.press('d');

    const nested = await page.evaluate(async () => {
      const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
      const { EasterEggModal } = await import('/src/ui/EasterEggModal.js');
      const { LevelUpModal } = await import('/src/ui/LevelUpModal.js');
      const egg = scene.easterEggs.find(item => item.id === 'standard-answer');
      scene.player.setPosition(egg.x, egg.y);
      scene.xp.pendingLevels = 1;
      scene.update(scene.time.now, 16);
      const before = { eggOpen: EasterEggModal.isOpen, levelOpen: LevelUpModal.isOpen, modalOpen: scene.modalOpen, physicsPaused: scene.physics.world.isPaused };
      EasterEggModal.open({ key: 'controlled-egg', title: 'probe', lines: ['probe'] });
      const overlap = { eggOpen: EasterEggModal.isOpen, levelOpen: LevelUpModal.isOpen };
      EasterEggModal.close();
      const after = { eggOpen: EasterEggModal.isOpen, levelOpen: LevelUpModal.isOpen, modalOpen: scene.modalOpen, physicsPaused: scene.physics.world.isPaused };
      return { setup: 'Arrange a pending upgrade while player is at an untaken answer egg; run the actual StageScene.update once', before, overlap, after };
    });
    record('upgrade opens before same-frame egg pickup', !nested.before.eggOpen && nested.before.levelOpen && nested.before.physicsPaused, nested.before);
    record('active upgrade remains paused after an egg close attempt', nested.overlap.eggOpen && nested.overlap.levelOpen && nested.before.levelOpen && nested.before.modalOpen && nested.before.physicsPaused && nested.after.levelOpen && nested.after.modalOpen && nested.after.physicsPaused, nested);
    await page.evaluate(()=>window.__FORGET_ME_NOT__.scene.getScene('StageScene').player.body.reset(48,240));
    await page.keyboard.press('1');

    const clickSkip = await page.evaluate(async () => {
      const { TypewriterTransition } = await import('/src/ui/TypewriterTransition.js');
      TypewriterTransition.play(['A deliberately long narrative line to observe click-to-skip behavior.'], { charInterval: 30, fadeMs: 10, holdEnd: 10 });
      return true;
    });
    await page.locator('.tt-overlay').click();
    const transitionState = await page.evaluate(async () => {
      const { TypewriterTransition } = await import('/src/ui/TypewriterTransition.js');
      return { busy: TypewriterTransition._busy, fast: TypewriterTransition._inst._fast, overlayPresent: Boolean(document.querySelector('.tt-overlay')) };
    });
    record('transition click requests documented skip', transitionState.fast || !transitionState.busy, transitionState);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('.tt-overlay'));

    const finalizedBefore = await page.evaluate(() => {
      const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
      scene.events.emit('stage:complete', { phaseId: scene.phaseId });
      return window.__fmnTelemetry.summary();
    });
    await page.waitForTimeout(120);
    const finalizedAfter = await page.evaluate(() => window.__fmnTelemetry.summary());
    record('finalized telemetry export elapsed seconds remains frozen', finalizedAfter.elapsedSec === finalizedBefore.elapsedSec, { beforeElapsedMs: finalizedBefore.elapsedMs, afterElapsedMs: finalizedAfter.elapsedMs, beforeElapsedSec: finalizedBefore.elapsedSec, afterElapsedSec: finalizedAfter.elapsedSec });

    await page.evaluate(() => window.__FORGET_ME_NOT__.scene.getScene('StageScene').scene.restart({ phase: 'middle' }));
    await page.waitForFunction(() => { const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene'); return scene.phaseId === 'middle' && scene.player?.isGrounded; });
    const afterRestart = await page.evaluate(() => {
      const scene = window.__FORGET_ME_NOT__.scene.getScene('StageScene');
      const telemetry = window.__fmnTelemetry;
      telemetry.markContaminated('automation-probe');
      telemetry.markContaminated('automation-probe');
      const previousDamage = telemetry.data.damageTaken;
      scene.events.emit('player:damaged', { damage: 7 });
      return { scenePhase: scene.phaseId, telemetryPhase: telemetry.data.phase, startedAt: telemetry.data.startedAt, guard: scene._telemetryInstalled, damageListeners: scene.events.listenerCount('player:damaged'), previousDamage, currentDamage: telemetry.data.damageTaken };
    });
    record('scene restart creates telemetry for the new phase and attaches listeners', afterRestart.telemetryPhase === 'middle' && afterRestart.damageListeners > 0 && afterRestart.currentDamage === afterRestart.previousDamage + 7, afterRestart);
    const downloadEvent = page.waitForEvent('download');
    await page.evaluate(() => window.__fmnTelemetry.downloadAll());
    const download = await downloadEvent;
    const exportPath = path.join(out, 'playtest-export-probe.json');
    await download.saveAs(exportPath);
    const bundle = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    record('one downloaded bundle includes previous and current stage snapshots',
      bundle.runs.length === 2 && bundle.runs.some(r => r.phase === 'youth' && r.outcome === 'completed')
      && bundle.runs.some(r => r.phase === 'middle' && r.damageTaken === 7)
      && bundle.runs.every(r => r.contamination.includes('automation-probe')),
      { phases: bundle.runs.map(r => r.phase), warnings: bundle.warnings, exportPath });
    record('no browser page errors', report.pageErrors.length === 0, report.pageErrors);
    await page.screenshot({ path: path.join(out, 'ui-telemetry-fixed.png') });
  } catch (error) {
    report.fatal = error.stack;
    process.exitCode = 2;
  } finally {
    if (browser) await browser.close();
    if (vite) await vite.close();
    fs.writeFileSync(path.join(out, 'ui-telemetry-fixed.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (report.checks.some(item => !item.pass)) process.exitCode ||= 1;
  }
})();
