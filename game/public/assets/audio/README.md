# assets/audio/ —— 音效素材与 BGM 说明（成员 E 维护）

本目录的音效来自用户提供的本地素材库
`Y 游戏音效素材库 / 游戏动画音效全集`（**内部素材，商用/公开发布前请确认授权协议**）。

已通过 `tools/import_sfx.py` 统一处理为：**单声道 / 22050Hz / 16-bit PCM / RMS 统一响度 / 8kHz 低通削高频 / tanh 软削波 / 6ms 淡入 + 25ms 淡出**（整体听感偏柔和，不炸耳）。
源路径、时长与来源记录在 `manifest.json`（由脚本生成，不要手改）。

## 一、音效清单（32 个真实素材）

### 战斗（近战 / 受击 / 格挡）

| 文件 | 音效 | 建议触发点 |
| :--- | :--- | :--- |
| `sfx_hit.wav` | 有力量的拳击 | 青年近战命中第 1/2 段 |
| `sfx_hit_heavy.wav` | 棍棒击中 | 中年公文包、老年拐杖、教鞭重击 |
| `sfx_crit.wav` | 高频肉体击中 | 暴击命中（配合 HUD 暴击飘字） |
| `sfx_hurt.wav` | 男声受伤 | 玩家受伤（带人声） |
| `sfx_death.wav` | 死亡倒地 | 玩家死亡 / 敌人击破 |
| `sfx_block.wav` | 刀打盾上的声音 | 按 `S` 成功格挡 / 完美格挡 |

### 角色动作（移动 / 技能）

| 文件 | 音效 | 建议触发点 |
| :--- | :--- | :--- |
| `sfx_jump.wav` | 跳跃 | 青年/中年起跳 |
| `sfx_land.wav` | 落地 | 跳跃落地 |
| `sfx_footstep.wav` | 脚步（硬地面） | 行走循环（每 2~3 帧触发一次） |
| `sfx_throw.wav` | 短风 | 扔粉笔 / 纸飞机（`L`） |
| `sfx_magic.wav` | 光魔法带气流 | 老年【金色记忆碎片】/ 彩蛋增益生效 |

### 随从忠犬（成员 D 联动）

| 文件 | 音效 | 建议触发点 |
| :--- | :--- | :--- |
| `sfx_bark.wav` | 狗叫 | 小狗扑咬前 / 大黄狗威慑 |
| `sfx_bark_attack.wav` | 狗扑 | 扑咬咬住敌人的瞬间 |
| `sfx_dog_hurt.wav` | 狗受伤呜咽 | 小狗被打滚撒娇（无敌判定下仍可播） |

### 界面与叙事（成员 E 核心）

| 文件 | 音效 | 建议触发点 |
| :--- | :--- | :--- |
| `sfx_pickup.wav` | 捡起铃铛 | 感悟光球 / 彩蛋白点拾取 |
| `sfx_heal.wav` | 补血之光 | 回血 / 新娘（忠犬）治疗 |
| `sfx_mp_up.wav` | 小光 | 回蓝 / 能量恢复 |
| `sfx_mp_down.wav` | 较暗提示音 | 扣蓝 / 能量消耗 |
| `sfx_bell.wav` | 结束的钟声 | 下课铃 / 第一关 Boss 进场 |
| `sfx_egg.wav` | 铜管短旋律 | 三个彩蛋触发解锁（配合弹窗） |
| `sfx_victory.wav` | 骑兵号胜利 | 关卡结算 / 结局 |
| `sfx_typing.wav` | 单键敲击（已截 0.14s） | 彩蛋弹窗、转场打字机逐字 |
| `sfx_ui.wav` | 按钮点击 | 菜单、弹窗交互 |
| `sfx_checkpoint.wav` | 信息提示 | 检查点激活 |
| `sfx_paper.wav` | 翻页 | 试卷彩蛋 / 阅读 UI 展开 |
| `sfx_door.wav` | 沉重开门 | 关卡转场、教室后门打开 |

### 环境与 Boss

| 文件 | 音效 | 建议触发点 |
| :--- | :--- | :--- |
| `sfx_thunder.wav` | 下雨+雷电 | 第二关雷雨氛围（一次性） |
| `sfx_rain.wav` | 连续雨声（4.4s） | 第二关环境循环，用 `audio.playLoop('rain')` |
| `sfx_boss_roar.wav` | 巨怪咆哮 | 班主任 / 老板登场 |
| `sfx_boss_enter.wav` | 战争警告号（warwarning） | 显示 Boss 血条 / Boss 战开场 |
| `sfx_boss_warn.wav` | 怪物警告 | Boss 技能预警红框出现 |
| `sfx_transition.wav` | 阵风 | 关卡黑屏转场入场 |

## 二、代码接入

```js
import { audio, SFX_FILES } from '../audio/AudioManager.js';

// 页面启动后一次性加载 28 个真实音效（失败自动回退合成音）
const { loaded, failed } = await audio.loadSfx('assets/audio/');
console.log(`音效 ${loaded}/${loaded + failed}`);

audio.play('hit');            // 近战命中
audio.play('bark_attack');    // 狗扑咬
const stopRain = audio.playLoop('rain', { volume: 0.5 }); // 第二关雨声循环
// ...离开关卡时 stopRain();
```

> Phaser 工程接入时，把这些 wav 放到 `game/public/assets/audio/`，加载前缀保持一致
> （Vite 的 `publicDir` 是 `game/public/`，`this.load.audio` 用 `/assets/audio/...` 绝对路径）。

## 三、重新生成 / 换素材

1. 解压素材库（本机 RAR，用 7-Zip/Windows 自带解压均可），解压到成员本地 `sfx_extract/`；
2. 修改成员本地 `tools/sfx_selected.json`（目标名 → 素材库内相对路径）；
3. 在成员本地 `member-E/` 目录运行（该脚本不随仓库提交）：

```bash
python tools/import_sfx.py
```

脚本会重新生成全部 wav 与 `manifest.json`。

## 四、授权提醒

本目录素材来自用户本地素材库，来源与授权状态**未经验证**，仅用于团队内部开发。
如需公开发布（路演 / 上架 / 开源），请替换为明确许可（CC0 / 商用授权）的素材，
推荐 itch.io、OpenGameArt、Freesound（注意逐条查看 License）。
替换时保持文件名不变即可，代码无需改动。

## 五、BGM 说明

- 当前 `audio.startBgm('stage1')` 是**程序合成的原创占位循环**（120 BPM），仅开发期使用；
- 正式三关 BGM 建议：第一关 8-bit Chiptune / 第二关 Synthwave+暴雨 / 第三关 温暖单簧管；
- 成品放入本目录后用 `audio.loadSound('bgm1', ...)` + 缓冲源 loop 替换占位循环。

