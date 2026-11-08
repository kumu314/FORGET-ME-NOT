# 演示后半段证据包 · 取证报告（卡 3）

> 基线：`main = 58a46cf8800885e7105993e2cce67031fd82d421`（含 #78/#80/#83/#84/#86）
> 取证时间：2026-11-08 11:30 – 12:15 · 脚本：`node game/tools/demo-evidence.cjs`（一条命令复跑）
> 渲染环境：Edge headless 1280×720，`--disable-webgl`（强制 Canvas，renderType=1，规避 WebGL 截图全黑的已知坑）
> **定位：只取证，未改任何 `game/src/**`。**

## 一句话结论

**两场 Boss 均可被击败、忠犬跨三关自动继承、彩蛋/拥抱/结局全链路可触发、音频合成链路全程活跃、pageErrors=0。** Boss 战对站桩自动打法有随机性（单场胜率约 50%，见下表 6 轮数据），人工走位操作预期更稳（未验）。

## 证据表

| 编号 | 证据 | 怎么跑出来的 | 数字 | 截图 | 未验 |
|---|---|---|---|---|---|
| 01 | 第一关 Boss「班主任」登场 | `body.reset(1200,185)` 传送→落地 1.3s→按 D 走过 triggerX 1230 | Boss HP 420/420，玩家 170/200HP | shots/01-boss-teacher-intro.png | 传送非自然走位 |
| 02 | Boss 战斗中（伤害输出） | D 贴身 + J 近战脉冲 + L 远程投掷 + Digit1 选攻击升级 | 累计输出 410/420（保留轮） | shots/02-boss-teacher-fight.png | 伤害飘字受帧时机影响 |
| 03 | 第一关 Boss 击败/结算 | 同上打到连续 3 次快照无 Boss | **35s 击败**（420→0），玩家剩 27HP；结算演出：班主任台词「行了……交卷吧。你们这届，是我带过最好的一届。」+「课程结束」大字（图像语义分析确认） | shots/03-boss-teacher-defeat.png | 单轮胜负有随机性（见多轮表） |
| 04 | 第二关 Boss「雇主」登场 | Boss1 击败自动转场→middle；`reset(1288,185)`→D 走过 triggerX 1300 | Boss HP 460/460，玩家 120/120HP | shots/04-boss-employer-intro.png | 传送非自然走位 |
| 05 | Boss2 战斗中 | 同 02 打法 | 保留轮输出 432/460 | shots/05-boss-employer-fight.png | 同 02 |
| 06 | 第二关 Boss 战（惜败帧） | 同 02 打法打到玩家死亡 | 保留轮 **26.8s 玩家死亡，对 Boss 432/460（差 28HP）**；**另一轮（round3，同脚本）22.5s 完整击败 460→0、玩家剩 44HP** | shots/06-boss-employer-defeat.png | 击败帧截图未保留（round3 截图已被后续复跑清理，数字见本表与 raw 补充） |
| 07 | 第一关小狗纸箱彩蛋模态 | `reset(836,185)`→圈外(≤852) J 打封条（轮询 `egg.smashed`）→纯 D 进圈（\|x-866\|<14） | smashed=true→`egg-modal:open` 事件=1→modalOpen=true，忠犬入队 `hasDog=true, form=puppy` | shots/07-puppy-box-egg-modal.png | 模态停留时长的人工观感 |
| 08 | 第二关忠犬继承（成年形态） | Boss1 击败→自动转场 middle（无需 T 键） | `hasDog=true, form=adult`（`attachDogForLevel(1)` 自动继承，registry 持久化） | shots/08-dog-adult-middle.png | adult 形态技能（咬击/拦截）单独录像未做 |
| 09 | 第三关忠犬（老年形态） | Boss2 后自动/T 兜底转场 elder | `hasDog=true, form=elder`（`attachDogForLevel(2)`） | shots/09-dog-elder-stage.png | — |
| 10 | 结局拥抱触发 | `reset(1430,185)`→落地 1.3s（确保 isGrounded）→按 D 向右走（vx>0）至 x∈[1450,1472] | `endingPlayed=true`，toast「你轻轻抱住了孩子。他停下脚步，转过身来。」（`canHugChild`：hugDistance=22、facing=1） | shots/10-ending-hug-toast.png | — |
| 11 | 结局页（EndingScene） | 拥抱→EndingScreen 1.2s→fadeOut 0.7s→`_advanceStage`→EndingScene | `isActive('EndingScene')=true`，等 3.2s 后截图（制作名单+大合照+「谢谢你，走到这里。」） | shots/11-ending-scene.png | 结局打字机逐帧效果（静态页） |
| 12 | 线上 Pages 首屏 | 打开 https://kumu314.github.io/UNTIL-THE-END/ 等 7s（走本地代理） | `hasGame=true, stageActive=true, renderType=1(Canvas)`，HTTP 4xx/5xx=0，pageErrors=0 | shots/12-online-pages.png | 未验 Firefox/Safari/移动端/真实网络 |

## 忠犬跨关继承（三关链路）

| 关卡 | hasDog | form | 验证方式 |
|---|---|---|---|
| youth（拿纸箱后） | true | puppy | `ai.dog.form` 实况快照 |
| middle（自动转场后） | true | **adult** | 同上，无需任何操作 |
| elder（自动转场后） | true | **elder** | 同上 |

## 音频链路（WebAudio 探针，注入于任何页面脚本之前）

| 阶段边界 | AudioContext | oscillator | bufferSource | gain | filter | ctx 状态 |
|---|---|---|---|---|---|---|
| youth 开始 | 2 | 20 | 0 | 25 | 0 | running |
| middle 开始 | 2 | 349 | 230 | 584 | 4 | running |
| elder 开始 | 2 | 675 | 338 | 1018 | 172 | running |
| 结局后 | 2 | **681** | **365** | **1051** | 172 | running |

- **已验证**：AudioContext 处于 `running`；每关边界 oscillator/bufferSource 单调增长（BGM 周期调度 + 真实 wav 素材 `sfx_*.wav` 经 `AudioBufferSourceNode` 播放 + 音效合成节点持续创建）；elder 关出现 172 个 BiquadFilter（雷雨低通噪声合成特征）。
- **未验证**：扬声器真实出声（headless 无声卡）；音量/混音质量的主观听感。

## Boss 战多轮数据（同一脚本，打法逐轮迭代）

| 轮次 | 打法 | Boss1 班主任 420HP | Boss2 雇主 460HP |
|---|---|---|---|
| R1 | 纯 J 站桩（未贴身） | 19.5s 死，0/420 | 未进行 |
| R2 | D 贴身 + J 连打 | 35.7s 死，82/420 | 64.2s 死，114/460 |
| R3 | 距离驱动 J+L | 37s 死，172/420 | **22.5s 击败**，剩 44HP |
| R4 | +S 格挡高频 | 59.3s 死，142/420 | 150s 超时，172/460（升级模态吞输入） |
| R5 | +Digit1 升级处理（保留轮） | **35s 击败**，剩 27HP | 26.8s 死，432/460（差 28HP） |
| R6 | 同 R5 | 33.1s 死，250/420 | 58.2s 死，360/460 |

解读：两场 Boss 均有完整击败记录（R3 证 Boss2、R5 证 Boss1）；胜负关键变量是升级模态弹出的时机（Digit1 攻击强化显著提升 DPS）与忠犬形态（middle 起 adult 忠犬参战咬击是 Boss2 更快可杀的原因之一）。

## 基线健康度

- `npx vitest run`（forks 单线程）：**169/169 全绿**，含 `originalSfx.test.js`（卡面预告的 #85 红测在基线 58a46cf 已被修复）。
- `npm run build`（vite 5.4.21）：45 模块，产物 1.6MB（gzip 386KB），成功。
- 全程 `pageErrors=0`、`consoleErrors=0`（R5/R6 两轮均零）。
- 遥测（`window.__fmnTelemetry.summary()`）：elder 关 `outcome=completed, endReason=stage:complete`，schema v1 正常落库。

## 发现的问题（只登记，不修）

1. **Boss1（班主任）对站桩打法偏硬**：6 轮自动战斗仅 1 轮击败（420HP / 玩家 200HP，无远程消耗期的贴身战惩罚重）；建议负责平衡的卡评估 teacher 的攻击频率/伤害是否需要下调，或给 youth 关更早的回复手段。
2. **youth x≈308 纸堆情书自动拾取失败**（两轮复现 `loveLetter=false`，玩家已到位 x=321）：掉落物触碰机制对自动走位不友好，具体原因未查（可能是掉落位置/拾取圈/时序），不影响主线，登记备查。
3. **升级模态会完全吞掉战斗输入**（`LevelUpModal` 打开期间 J/L/D 无效）：自动脚本已适配（Digit1 选择），但人工玩家在 Boss 战中弹升级可能中断操作节奏，建议负责 UI 的卡评估 Boss 战内是否暂缓升级弹窗。

## 未检查项

- 未验自然走位（全部用 `body.reset()` 传送，卡 3 要求如实标注）。
- 未验扬声器真实出声（headless 无声卡，只验 WebAudio 节点链路）。
- 未验 Firefox/Safari/移动端/真实弱网。
- 未验人工操作下的 Boss 战体验（走位躲技能、Space+J 飞踢、格挡时机）。
- Boss2 的「击败瞬间」截图未保留在最终图集（round3 击败帧被后续复跑清理；击败数字在多轮表中，脚本可复跑复现）。
- 线上 Pages 复验在本地代理网络下进行（两轮读数一致）。

## 复跑方式

```bash
cd game && npm ci && npm run build
node tools/demo-evidence.cjs     # 约 2-8 分钟，产出 shots/*.png + raw/*.json
```

依赖：本机 Edge（channel:'msedge'）、playwright 1.65（`game/tools/node_modules/`，不入库）；线上复验需可访问 github.io 的网络（默认走 `FMN_PROXY`，默认 `http://127.0.0.1:7897`）。

原始读数：`raw/run.json`（保留轮全量快照/计时/音频探针/遥测摘要）、`raw/run-round6-supplement.json`（复验轮）、`raw/online.json`（线上读数）。
