import Phaser from 'phaser';

const PHOTO_KEY = 'ending_group_photo';
const FONT = 'monospace';

/** 静态片尾：沿用黑屏文本结局，在其后展示大合照与制作名单。 */
export default class EndingScene extends Phaser.Scene {
  constructor() {
    super('EndingScene');
  }

  preload() {
    // 按需加载，避免让片尾图片增加第一关的启动等待。
    if (!this.textures.exists(PHOTO_KEY)) {
      this.load.image(PHOTO_KEY, 'assets/ending/group-photo.png');
    }
  }

  create() {
    this.leaving = false;
    this.cameras.main.setBackgroundColor('#171c26');
    const text = (x, y, value, size = 10, color = '#eee0c5') => this.add.text(x, y, value, {
      fontFamily: FONT, fontSize: `${size}px`, color,
    });

    text(18, 26, '忘记我', 22);
    text(19, 56, 'FORGET ME NOT', 8, '#b8b1a5');
    this.add.rectangle(158, 136, 1, 226, 0x64533f);
    text(18, 90, '制作团队', 11, '#d4b783');
    ['李姝怡', '贾明杰', '邓宜安', '赵紫阳', '任涵毓'].forEach((name, i) => {
      text(18, 114 + i * 17, name, 10);
    });
    text(18, 207, '谢谢你，走到这里。', 8, '#b8b1a5');

    this.add.rectangle(318, 120, 296, 200, 0x302a28).setStrokeStyle(1, 0xa5875b);
    if (this.textures.exists(PHOTO_KEY)) {
      // 3:2 原图完整展示；不裁人物，不改变场景和碰撞配置。
      this.add.image(318, 120, PHOTO_KEY).setDisplaySize(288, 192);
    } else {
      // 图片加载失败仍有文字片尾和返回入口，不能卡死通关流程。
      text(318, 120, '这一路，有你们真好。', 11).setOrigin(0.5);
    }
    text(318, 234, '人生不是一场必须要赢的战斗。', 9).setOrigin(0.5);
    text(318, 249, '走过的每一步，都算数。', 9, '#d4b783').setOrigin(0.5);

    const button = this.add.rectangle(80, 237, 124, 24, 0x39362f)
      .setStrokeStyle(1, 0x9d835c).setInteractive({ useHandCursor: true });
    text(80, 237, '返回第一关  ↵', 9).setOrigin(0.5);
    const goBack = () => {
      if (this.leaving) return;
      this.leaving = true;
      this.scene.start('StageScene', { phase: 'youth' });
    };
    button.on('pointerover', () => button.setFillStyle(0x514633));
    button.on('pointerout', () => button.setFillStyle(0x39362f));
    button.on('pointerup', goBack);
    this.input.keyboard?.on('keydown-ENTER', goBack);
    this.input.keyboard?.on('keydown-SPACE', goBack);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown-ENTER', goBack);
      this.input.keyboard?.off('keydown-SPACE', goBack);
    });
  }
}
