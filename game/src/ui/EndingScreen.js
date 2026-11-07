/**
 * 结局保底（issue #25 · GDD §6 兜底策略）
 *
 * 第三关走到终点 → 黑幕定格 → 打字机结局文案（TRANSITION_PRESETS.ending，GDD 原文）→ 落幕卡。
 * 触发器现状：接近世界右端即触发（孩子终局的临时代理）；
 * #23 落地"拥抱交互"后，把 ENDING_TRIGGER 判定换成对应事件即可。
 *
 * 零侵入接线：走 Phaser 场景自带 update 事件，不改 StageScene 循环；
 * StageScene.create() 里 `installEndingScreen(this)` 一行完成安装。
 */
import { WORLD_WIDTH } from '../config/stageLayout.js';
import { TypewriterTransition, TRANSITION_PRESETS } from './TypewriterTransition.js';

/** 距世界右端多少像素触发结局（临时触发器） */
export const ENDING_TRIGGER_PADDING = 90;

const wait = (scene, ms) => new Promise((resolve) => scene.time.delayedCall(ms, resolve));

/**
 * 在场景上安装结局监听；重复调用安全（幂等）。
 * 仅在老年关（phaseId === 'elder'）生效；青年/中年关走到尽头不触发。
 */
export function installEndingScreen(scene) {
  if (scene._endingScreenInstalled) return;
  scene._endingScreenInstalled = true;

  let fired = false;

  const detach = () => scene.events.off('update', onTick);

  async function fire() {
    detach();
    scene._endingFired = true;

    // 定格世界：黑幕落下前暂停物理，避免角色在字幕期间继续走动
    scene.physics?.world?.pause?.();

    const veil = scene.add
      .rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(6000)
      .setAlpha(0);
    scene.tweens.add({ targets: veil, alpha: 1, duration: 700 });
    await wait(scene, 780);

    await TypewriterTransition.play(TRANSITION_PRESETS.ending, { charInterval: 90, holdEnd: 1500 });

    const card = scene.add
      .text(
        scene.scale.width / 2,
        scene.scale.height / 2,
        '— 完 —\n\n感谢游玩《忘记我》\nHENU Hackathon · 按任意键回到少年时',
        {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#f5efdf',
          align: 'center',
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(6001)
      .setAlpha(0);
    scene.tweens.add({ targets: card, alpha: 1, duration: 900 });

    scene.input.keyboard?.once('keydown', () => scene.scene.start('StageScene', { phase: 'youth' }));
  }

  function onTick() {
    if (fired || scene._endingFired) return;
    if (scene.phaseId !== 'elder') return;
    const px = scene.player?.x;
    if (typeof px !== 'number') return;
    if (px > WORLD_WIDTH - ENDING_TRIGGER_PADDING) {
      fired = true;
      fire();
    }
  }

  scene.events.on('update', onTick);
  scene.events.once('shutdown', detach);
}
