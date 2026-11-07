# 动画键名契约（Animation Contract）

> v0.1-draft · 2026-11-07 起草（待成员 A / C 确认后升 v1.0）
> 数据源：`public/assets/sprites/manifest.json`（integration-draft-v1，PR #8）× `game/src/config/gameConfig.js`（PR #7）
> **唯一真源**：贴图帧以 manifest 的 `sha256` 为准；动画键以本文为接线约定。代码侧**禁止硬编码帧号**，一律查 manifest 的 `animationNames`。

## 通用约定

- 朝向：素材统一**朝右**（`facing: "right"`），向左由代码 `flipX` 翻转
- 采样：`nearest`（pixelArt），禁止任何平滑缩放
- 播放查表规则：`play(key)` 前查 manifest，键不存在时 **fallback 到 `idle` 并 `console.warn`**，不许抛错断游戏

## 主角三阶段（24×24，32 帧/阶段）

| 动画键 | 青年 | 中年 | 老年 | 说明 / 对接 C 的常量 |
|---|:---:|:---:|:---:|---|
| `idle` | ✅ | ✅ | ✅ | 循环播放 |
| `run` | ✅ | ✅ | —（老年为 `walk`） | 速度用 `walkSpeed`（老年 ×`elderGroundFactor` 0.8） |
| `walk` | — | — | ✅ | 老年专用慢速循环 |
| `jump` | ✅ | ✅ | ⛔ **不存在** | 老年按 Space 走 `cough` 分支，代码不得引用 |
| `cough` | — | — | ✅ | 对应老年跳跃键失败演出；单次播放，播完回 `idle` |
| `hurt` | ✅ | ✅ | ✅ | 单次播放，时长覆盖 `hurtLockMs` 220ms |
| `attack_1/2/3` | ✅ | ✅ | ✅ | 三连击窗口衔接；⚠️ 老年三段须是**拐杖点地**帧（待 A 自核） |
| `block` | ✅ | ✅ | ✅ | 按住 S 循环；完美格挡（受击前 0.2s）在此姿态下判定 |

## 忠犬三阶段（幼犬 12×12 / 成犬·老犬 20×16，16 帧/阶段）

| 动画键 | 幼犬 | 成犬 | 老犬 | 说明 |
|---|:---:|:---:|:---:|---|
| `idle` | ✅ | ✅ | ✅ | 跟随驻足时循环 |
| `run` | ✅ | ✅ | —（老犬 `walk`） | 跟随移动 |
| `pounce` | ✅ | ✅ | ✅ | 玩家按 J 协同飞扑 → 咬住定身 1s（对接 D 的 DogCompanion） |
| `bark` | ✅ | ✅ | ✅ | Space+J 仰头吠叫，震落空中小怪 |
| `bite` | ✅ | ✅ | ✅ | 扑咬撕扯连段 |

## Boss（班主任 64×64 / 老板 64×64 / 孩子 48×48）

| 实体 | 动画键 | 对接技能（GDD §4.5 / 二关） |
|---|---|---|
| `boss_teacher` | `idle` `sweep` `throw_chalk` `summon` `enraged` `hurt` | sweep=教鞭横扫（贴地波，可跳躲）· throw_chalk=粉笔三连（可格挡）· summon=突击抽查/试卷羽翼 · enraged=半血狂暴 |
| `boss_employer` | `idle` `slam` `smoke` `envelopes` `enraged` `hurt` | slam=降本增效公章 · smoke=画大饼（减速圈）· envelopes=裁员信风暴（新娘/忠犬格挡演出） |
| `boss_child` | `idle` `walk`（**仅 8 帧**） | ⚠️ 待第三关终局演出定稿后扩帧（受击/拉杆箱/被拥抱反应），现在不补 |

## 已知缺口（补齐前代码侧用占位，勿阻塞其他联调）

1. **远程投掷/施法帧（P0）**：`L` 键三阶段皆无专用帧（青年投粉笔抬臂 / 中年掷纸飞机 / 老年记忆碎片施法）——已立 issue 追踪
2. **弹道贴图（P0）**：粉笔头、纸飞机、记忆碎片光粒（8×8~16×16 即可），`ChalkBullet.js` 现用占位
3. **死亡/复活帧（P1，可后置）**：可先用黑屏淡出保底
4. **打击特效帧（归属待定）**：格挡火花、粉笔碎裂——A/D/E 对一下归谁

## Issue #19：远程补帧提案（待 C 确认）

本节先约定新键，资源另走 A 功能分支。现有动画键和帧坐标全部保留。

| 图集 | 新动作 / 播放键 | 帧与尺寸 | 行为 |
|---|---|---|---|
| player_youth | throw / player_youth:throw | throw_0..3，24×24 | 持粉笔抬臂、蓄势、出手、收势；单次 |
| player_middle | throw / player_middle:throw | throw_0..3，24×24 | 持纸飞机侧掷；单次 |
| player_elder | cast / player_elder:cast | cast_0..3，24×24 | 拄杖站定、空手引导记忆碎片；单次、无跳跃 |
| projectiles | chalk / projectiles:chalk | chalk_0..3，16×16 | 粉笔头飞行，循环 |
| projectiles | paper_plane / projectiles:paper_plane | paper_plane_0..3，16×16 | 朝右纸飞机，循环 |
| projectiles | memory / projectiles:memory | memory_0..3，16×16 | 青蓝记忆光粒，循环 |

主角原 32 帧后追加一行，总 36 帧/阶段；原图前 8 行保持字节级像素一致。弹道使用独立 projectiles 图集，中心 pivot=(0.5,0.5)，角色仍以脚底为锚点。图集文件放 game/public/assets/sprites/。

角色演示动作建议 4 帧/240ms，弹道演示 4 帧/320ms；仅是预览节奏，生成弹道和耗蓝由 C 的输入/冷却逻辑负责，禁止依赖 animationcomplete 造成重复发射。空中发射暂复用同一上身动作，世界位移由物理控制；不把复用称为专用空中补帧。

本提案涉及共享接线约定，待 C 确认后使用新键；未确认时继续按现有 fallback 规则运行。资源 PR 关联本提案与 #19，不提前关闭 #19。

## 变更纪律

- 改动画键名 = 改契约 = 动共享约定：**先在本文件提 PR 改表，再动代码/图集**，两侧不得单方面改
- 图集更新必须保持 manifest 的 `sha256` 同步重算（A 的校验脚本会拦不一致）
