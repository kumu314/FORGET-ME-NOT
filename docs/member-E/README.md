# 成员 E 交付物 —— HUD / 彩蛋弹窗 / 音效 / 转场

对应《开发分工与GitHub协作规范》成员 E：
分支 `feat/member-E-ui-<feature>`，模块：**对战 HUD、彩蛋弹窗、音效与转场**。

## 一、文件清单

| 路径 | 说明 |
| :--- | :--- |
| `game/src/ui/BattleHUD.js` | 复古像素战斗 HUD：玩家血条/能量条（20 段、低血闪烁）、Boss 血条、暴击飘字、受伤红闪。纯 Canvas 覆盖层实现，不依赖 Phaser |
| `game/src/ui/EasterEggModal.js` | 彩蛋阅读弹窗：居中特写卡片 + **全局慢动作（timeScale=0.25）** + 打字机 + 空格/J/点击关闭；内置 GDD 三个彩蛋原文案（小狗纸箱 / 试卷答案 / 保温杯） |
| `game/src/ui/TypewriterTransition.js` | 轻量转场：纯黑淡入淡出 + 打字机文本，Promise 化，任意键跳过；内置 GDD 5.1 / 5.6 / 结局兜底三套文案 |
| `game/src/audio/AudioManager.js` | 音频引擎：32 个真实音效批量加载（`loadSfx`）、失败回退内置 8-bit 合成音、环境音循环 `playLoop`、占位 BGM、总线软压缩、音量记忆 |
| `game/public/assets/audio/` | 32 个音效 wav（单声道 22050Hz、柔和化处理）+ `manifest.json`（来源/时长）+ `README.md`（触发点说明） |

## 二、接入方式（给 C / D）

```js
import { audio } from '../audio/AudioManager.js';
import { BattleHUD } from '../ui/BattleHUD.js';
import { EasterEggModal, EGG_PRESETS } from '../ui/EasterEggModal.js';
import { TypewriterTransition, TRANSITION_PRESETS } from '../ui/TypewriterTransition.js';

// 1) 音效：启动时加载一次（Vite publicDir = game/public/，路径以 /assets/ 开头）
await audio.loadSfx('/assets/audio/');
audio.play('hit');            // 近战命中
audio.play('bark_attack');    // 狗扑咬（D）
const stopRain = audio.playLoop('rain', { volume: 0.5 }); // 第二关雨声循环

// 2) HUD：在 Phaser Canvas 上方叠一个 overlay canvas（pointer-events:none）
//    hud.setPlayer({ hp, maxHp, mp, maxMp }); hud.setCamera({ x, y }); hud.render(dt);

// 3) 彩蛋弹窗：触发时打开，主循环读取慢动作系数
EasterEggModal.open({ ...EGG_PRESETS.dog, onOpen: () => audio.play('egg') });
// 主循环： dt *= EasterEggModal.timeScale;   // 弹窗开启自动 0.25

// 4) 转场：Boss 结算后等待文本播完再切场景
await TypewriterTransition.play(TRANSITION_PRESETS['1to2'], { onTick: () => audio.play('typing') });
```

事件：`window` 上派发 `egg-modal:open` / `egg-modal:close` / `transition:start` / `transition:end` / `sfx:loaded`，需要联动时可监听。

## 三、已知限制（需联调）

1. **本模块是独立于 Phaser 的实现**（DOM 覆盖层 + Canvas 覆盖层 + WebAudio），尚未在 `StageScene` 中接线；接入需主程 C 在场景里挂 overlay canvas 和调用点（预计 1~2 小时）。
2. 音效来自成员本地素材库（《Y 游戏音效库 / 游戏动画音效全集》），**来源与授权未验证**，路演/公开发布前请确认或替换为 CC0/商用授权素材。
3. BGM 目前是程序合成的占位循环，正式三关 BGM 待补。
4. 弹窗/转场的字体使用系统等宽字体；仓库 `public/fonts/` 放像素中文字体后可替换 `font-family`。

## 四、自测记录

- [x] 独立 demo 页：32 个音效全部加载成功，无爆音、无控制台报错
- [x] 回血 / 回蓝 / 扣蓝 / Boss 登场 为四个独立音效
- [x] 彩蛋三套文案、转场三套文案与 GDD 原文一致
- [ ] Phaser 场景内联调（待成员 C）
