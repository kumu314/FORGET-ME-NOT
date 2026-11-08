# 成员 E 交付物 —— HUD / 彩蛋弹窗 / 音效 / 转场

对应《开发分工与GitHub协作规范》成员 E：
分支 `feat/member-E-ui-<feature>`，模块：**对战 HUD、彩蛋弹窗、音效与转场**。

## 一、文件清单

| 路径 | 说明 |
| :--- | :--- |
| `game/src/ui/BattleHUD.js` | 复古像素战斗 HUD：玩家血条/能量条（20 段、低血闪烁）、Boss 血条、暴击飘字、受伤红闪。纯 Canvas 覆盖层实现，不依赖 Phaser |
| `game/src/ui/EasterEggModal.js` | 彩蛋阅读弹窗：居中特写卡片 + 打字机 + 空格/J/点击补全或关闭；内置 GDD 三个彩蛋原文案。关卡通过事件暂停物理世界与玩法更新 |
| `game/src/ui/TypewriterTransition.js` | 轻量转场：纯黑淡入淡出 + 打字机文本，Promise 化，任意键跳过；内置 GDD 5.1 / 5.6 / 结局兜底三套文案 |
| `game/src/audio/AudioManager.js` | 音频引擎：32 个原创程序化 WAV 批量加载（`loadSfx`）、失败回退内置 8-bit 合成音、环境音循环 `playLoop`、三关原创 BGM、总线软压缩、音量记忆 |
| `game/public/assets/audio/` | 32 个原创音效 WAV（单声道 22050Hz、16-bit PCM）+ `manifest.json`（配方/种子/哈希）+ `LICENSE.txt` + 来源说明 |
| `tools/generate_original_sfx.py` | 仅用 Python 标准库的固定种子合成器；`--check` 在内存复现并比较全部音效及来源文件 |

## 二、现有接线与 API

`StageScene` 已通过 `HudOverlay.mountBattleHud()` 挂载 HUD，按场景触发音效、彩蛋和转场，并按关卡选择 BGM。以下保留公共 API 示例。彩蛋及升级弹窗通过 `egg-modal:open` / `egg-modal:close` 事件冻结与恢复世界：暂停 Phaser 物理世界，主循环只更新 HUD。`EasterEggModal.timeScale` 保留模块 API 默认值 0.25，实际关卡没有将该值乘入 delta；当前游戏使用完整玩法暂停。

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

// 3) 彩蛋弹窗：StageScene 已监听开关事件来暂停和恢复物理世界
EasterEggModal.open({ ...EGG_PRESETS.dog, onOpen: () => audio.play('egg') });

// 4) 转场：Boss 结算后等待文本播完再切场景
await TypewriterTransition.play(TRANSITION_PRESETS['1to2'], { onTick: () => audio.play('typing') });
```

事件：`window` 上派发 `egg-modal:open` / `egg-modal:close` / `transition:start` / `transition:end` / `sfx:loaded`，需要联动时可监听。

## 三、来源与边界

1. HUD、弹窗、WebAudio 模块本身不依赖 Phaser；关卡接线由 `StageScene` 与 `HudOverlay` 提供。音效替换保持现有加载键、文件路径和调用点。
2. 32个音效现由 `tools/generate_original_sfx.py` 原创程序化生成，固定种子、无外部采样，按项目MIT许可证提供；清单、SHA256和随附许可证见 `game/public/assets/audio/`。犬声为合成音，不是动物录音。
3. 三关原创WebAudio配乐由 `game/src/audio/scores.js` 提供；本次音效替换不改动配乐。
4. 弹窗/转场的字体使用系统等宽字体；仓库 `public/fonts/` 放像素中文字体后可替换 `font-family`。

## 四、验证记录与待验项目

- 自动验证：`python tools/generate_original_sfx.py --check` 对32个 WAV、manifest、许可证逐字节复现；`game/tests/originalSfx.test.js` 检查键/路径覆盖、来源哈希、PCM格式、电平和雨声循环边界。
- 回血 / 回蓝 / 扣蓝 / Boss 登场使用四个独立文件；全部32个 WAV 的 SHA256 均不相同。
- 接线状态来自当前源代码检查；本次音效替换的主观试听、犬声辨识度及实战混音尚未验收，机器电平检查不能证明无可闻瑕疵。
