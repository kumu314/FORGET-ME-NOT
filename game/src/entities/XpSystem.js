import Phaser from 'phaser';
import { XP_SYSTEM } from '../config/gameConfig.js';
import { expToNext } from './combatMath.js';
import ExpOrb from './ExpOrb.js';
import { LevelUpModal, LEVEL_UP_CHOICES } from '../ui/LevelUpModal.js';

/**
 * 经验系统【领悟】（issue #17，GDD §3.1）
 *
 * - 监听 ai:kill → 在击杀点掉落感悟光球（真实经验值，取代 AIManager 的装饰性光球）
 * - update 每帧推进磁吸/吸收，入账后查升级
 * - 经验条满：暂停世界（复用彩蛋弹窗的 egg-modal:open 冻结契约）→ 三选一弹窗 → 应用强化 → 恢复
 * - 等级/经验跨关持久化（registry），二/三关继续成长
 */
const REGISTRY_KEY = 'playerXpState';

export default class XpSystem {
  /**
   * @param {import('phaser').Scene} scene
   * @param {import('./Player.js').default} player
   */
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.orbs = [];
    this.frozen = false;
    this.pendingLevels = 0;

    const saved = scene.registry.get(REGISTRY_KEY) ?? { level: 1, xp: 0 };
    this.level = Math.max(1, saved.level ?? 1);
    this.xp = Math.max(0, saved.xp ?? 0);

    this._onKill = (info) => this.onKill(info);
    this._onEggOpen = () => {
      this.frozen = true;
    };
    this._onEggClose = () => {
      this.frozen = false;
    };
    scene.events.on('ai:kill', this._onKill, this);
    window.addEventListener('egg-modal:open', this._onEggOpen);
    window.addEventListener('egg-modal:close', this._onEggClose);
  }

  /** 击杀点掉光球（exp 载荷由 MonsterFSM.die 的 ai:kill 带出） */
  onKill(info) {
    if (!info || !(info.exp > 0)) return;
    this.spawnOrb(info.x, info.y, info.exp);
  }

  spawnOrb(x, y, exp) {
    if (this.frozen) return;
    const orb = new ExpOrb(this.scene, { x, y, exp }, this.player, (o) => this.absorb(o.exp));
    this.orbs.push(orb);
  }

  /** 经验入账 + 升级检查 */
  absorb(exp) {
    this.xp += exp;
    while (this.xp >= expToNext(this.level)) {
      this.xp -= expToNext(this.level);
      this.level += 1;
      this.pendingLevels += 1;
    }
    this.save();
    if (this.pendingLevels > 0 && !this.frozen) this.openLevelUp();
  }

  openLevelUp() {
    if (this.frozen || this.pendingLevels <= 0) return;
    this.frozen = true;
    // 复用彩蛋弹窗的冻结契约：StageScene/AIManager 停摆、玩家清速
    window.dispatchEvent(new CustomEvent('egg-modal:open', { detail: { timeScale: 0, key: 'levelup' } }));
    LevelUpModal.open({
      level: this.level,
      onChoose: (id) => this.chooseUpgrade(id),
    });
  }

  /** 应用强化并恢复世界（由 LevelUpModal 的 onChoose 回调驱动） */
  chooseUpgrade(id) {
    const choice = LEVEL_UP_CHOICES.find((c) => c.id === id) ?? LEVEL_UP_CHOICES[0];
    this.player.applyLevelUpgrade(choice.id);
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    this.frozen = false;
    window.dispatchEvent(new CustomEvent('egg-modal:close', { detail: { key: 'levelup' } }));
    if (this.pendingLevels > 0) {
      // 连升多级：关一张再开一张
      this.scene.time.delayedCall(60, () => this.openLevelUp());
    }
  }

  /** 每帧：推进光球（弹窗冻结时停摆）；待结算的升级自愈补开 */
  update(deltaMs) {
    if (this.frozen) return;
    if (this.pendingLevels > 0) {
      this.openLevelUp();
      return;
    }
    if (!this.orbs.length) return;
    this.orbs = this.orbs.filter((orb) => !orb.update(deltaMs));
  }

  /** HUD 联动读数 */
  getHudState() {
    return { level: this.level, xp: this.xp, next: expToNext(this.level) };
  }

  save() {
    this.scene.registry.set(REGISTRY_KEY, { level: this.level, xp: this.xp });
  }

  destroy() {
    this.scene.events.off('ai:kill', this._onKill, this);
    window.removeEventListener('egg-modal:open', this._onEggOpen);
    window.removeEventListener('egg-modal:close', this._onEggClose);
    for (const orb of this.orbs) orb.destroy();
    this.orbs = [];
    LevelUpModal.close();
  }
}
