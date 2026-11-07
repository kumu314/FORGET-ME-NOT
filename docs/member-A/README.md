# A · 角色资源首版（待美术评审 / 游戏联调）

2026-11-07。资源首次制作基于 main `c00d12a`；提交前已同步 develop `574d1cf`，采用最新 v2 协作规范。

首版提供三年龄主角、三年龄阿黄、班主任、老板和长大的孩子。共 **9 张透明 PNG、9 份图集 JSON、200 个实际帧、53 个动画定义**。`preview.html` 可直接用 Chrome / Edge 双击打开；不依赖网络。

这是可加载的联调稿。文件检查与引擎加载通过，造型、动画流畅度、打击节奏及 B 的美术评审尚未完成。

## 文件与动作

运行资源位于 `game/public/assets/sprites/`，符合 2026-11-07 新增的 Phaser 3 + Vite 工程目录。

| 图集键 / 文件名 | 单帧尺寸 | 实际帧 | 动作 |
| --- | --- | ---: | --- |
| `player_youth` | 24×24 | 32 | idle / run / jump / hurt / attack_1 / attack_2 / attack_3 / block |
| `player_middle` | 24×24 | 32 | 同青年；普攻使用公文包 |
| `player_elder` | 24×24 | 32 | idle / walk / cough / hurt / attack_1 / attack_2 / attack_3 / block |
| `dog_puppy` | 12×12 | 16 | idle / run / pounce / bark；bite 复用扑咬末两帧 |
| `dog_adult` | 20×16 | 16 | 同幼犬；增加红领巾 |
| `dog_elder` | 20×16（暂定） | 16 | idle / walk / pounce / bark；bite 复用扑咬末两帧 |
| `boss_teacher` | 64×64 | 24 | idle / sweep / throw_chalk / summon / enraged / hurt |
| `boss_employer` | 64×64 | 24 | idle / slam / smoke / envelopes / enraged / hurt |
| `boss_child` | 48×48（暂定） | 8 | idle / walk；拉行李箱的成年孩子 |

每个基础动作 4 帧，每行一个动作，每张图 4 列。`bite` 是已有帧的动画引用，不额外计算到 200 帧。主角、犬和 Boss 共用 38 色导出色盘；单张实际使用色数小于等于 38。PNG 无有损压缩、无半透明边缘，四边至少留 1 个透明像素。原图用内置 image_gen 生成；切片、最近邻降采样、统一色盘、二值 alpha 与脚底对齐由本地导出脚本处理。原图和提示词留在 D 盘工作区，仓库不包含大尺寸工程原图。

## Phaser 接入

`phaser-sprites.mjs` 是可选示例，仅管理资源加载与动画注册，不修改 C/D/E 的实体或场景文件。

```js
import {
  preloadCharacterAtlases,
  createCharacterAnimations,
} from '../docs/member-A/phaser-sprites.mjs'; // 按实际引用位置调整路径

// 放在场景的 preload() 内
preloadCharacterAtlases(this, `${import.meta.env.BASE_URL}assets/sprites/`);

// 放在场景的 create() 内
createCharacterAnimations(this);
const hero = this.add.sprite(100, 140, 'player_youth', 'idle_0');
hero.play('player_youth:run');
hero.setFlipX(true); // 原图统一面向右，向左用 flipX
```

图集采用 TexturePacker JSON Hash 结构，`frames` / `meta` 供 `load.atlas` 读取；`game` 是项目扩展数据。动画键使用 `图集键:动作`，防止同名 `idle` 相互覆盖。重复注册会跳过已有键，可用于场景重新进入。

`game.anchor` 为原生像素坐标：`(帧宽 / 2, 帧高 - 1)`，例如主角 `(12, 23)`。JSON `pivot` 已归一化，Phaser 3.90 实测可自动读取。末行是透明留白，人物最低不透明像素在 `帧高 - 2`。不要再次强制 `setOrigin(0.5, 1)`，否则改变脚底约定。

相机 / 渲染器开启 `pixelArt: true`，使用整数缩放。Vite 子路径部署要使用 `import.meta.env.BASE_URL`，避免写死根路径 `/assets/`。

## C / D 接入注意

- **老年不导出 jump**，`supportsJump: false`，移动播放 `walk`，空格播放 `cough`。这是视觉契约，真正的禁跳与速度由 C 实现。
- `jump` 只表示姿态。世界坐标的升降由物理系统负责；图集中的脚底锚点保持一致。
- 三连击各自独立，默认单次播放。连段窗口、伤害、受击硬直由 C 决定。图集内不包含伤害或攻击范围数值。
- `block` 是进入 / 退出格挡的姿态草稿；长按格挡时可停在 `block_1` 或 `block_2`，不要循环播放起身帧。
- `pounce` 单次播放；进入钳制后播放 `bite`。咬住 1 秒与无敌机制由 D 控制。
- 老犬 `walk` 不能按 `run` 加载。三个年龄独立图集便于 D 切换纹理。
- 班主任的 `enraged` 包含试卷羽翼；`throw_chalk` / `summon` 和老板的 `smoke` / `envelopes` 只画施放动作，不带独立弹道、烟圈、落下词典和范围特效。
- 不要用整张 24×24 / 64×64 的透明画布直接当攻击判定范围。碰撞框和有效攻击帧需 C/D 结合实际手感确定，本批未声称已验证战斗判定。

## 尚未包含 / 需团队确定

1. 主角投掷、空中飞踢 / 公文包下砸、空中投掷、老年记忆法术的专用补帧；第一关小怪、弹道及技能特效的资源归属未在分工表明确。
2. 老犬帧尺寸暂沿用成年犬 20×16；孩子采用 GDD 允许的 Boss 48×48 网格。孩子只提供离家动作，GDD 尚无可执行战斗机制。
3. 这批是四帧关键姿态稿，尚未经 B 审图或实际关卡观感评审；原画比例和插帧仍可迭代。人物造型不是已获得团队确认的最终稿。
4. 无 P2 结局长动画、场景、HUD、音效或角色控制器。

## 验证证据

- `validation-assets.json`：逐个解码本批全部 9 张 PNG，对应 200 帧。验证尺寸、透明安全边、非空帧、颜色上限、统一脚底、动作至少 2 个不同像素帧、JSON 引用和文件 SHA-256。结果 9/9。
- `validation-browser.json`：20 项预览 / 引擎检查通过，包括全部 53 个动作可显示、暂停 / 逐帧 / 翻转 / 筛选、390px 宽无横向溢出、Phaser **3.90.0** 实际加载 200 帧并创建 53 个动画、重复注册不重复创建、脚底 pivot 被引擎读取。
- 验证仅覆盖这批资源和独立样例，不代表 C/D 的游戏场景、物理碰撞、玩家体验或最终演示已验收。

## 协作状态

功能分支：`assets/member-A-char-core-atlases`；PR 目标为 `develop`，标题前缀 `[成员A]`。至少 1 名成员 approve 后才可 Squash 合并；A/B 互审资源规格。

截至同步基线 `b8962bd`（C 的 PR #7），develop 已包含 Phaser 3 + Vite 脚手架、`package.json` / `package-lock.json` 与主角控制器。本批资源已位于 `game/public/assets/sprites/`，可进入主工程联调；资源加载和独立预览已完成验证，但真实关卡、碰撞与手感仍需 C/D 接入后验收。

## 与 C 已合入的主控制器对接

C 的 PR #7 已合入 develop（`b8962bd`）。旧 PR #5 已关闭；当前接入以 develop 中的 Player、gameConfig 和动画键名契约为准：

- 全部图集位于 `game/public/assets/sprites/`；JSON 文件名引用和浏览器 URL `assets/sprites/` 保持不变。`docs/member-A` 留在仓库根 `docs/` 下。
- C 的 Player 已有 `phaseId`、`facing`、`isGrounded`、`isBlocking`、`coughMs`、`hurtLockMs`、`meleeStage`、`meleeAirKick`，可映射到本批动画。资源 helper 不会自动修改 Player 的动作选择逻辑。
- C 当前占位图使用 `setOrigin(0.5, 1)`、14×22 body、offset(5, 2)，并在阶段切换 / 复活时 setTint。接入真实图集时需检查 **1px 脚底原点差**、清除阶段 tint，并保持物理盒世界坐标稳定，不能仅替换纹理 key 后声称接入完成。
- C 的青年近战前两段总时长为 120ms，本批预览默认 360ms；中老年的时序也不同。正式联调需按 `MELEE_CHAIN.activeAt/recover` 对齐姿态，不要直接采用预览帧率充当攻击判定时间。

本批没有改 C 的 Player、配置或共享场景；真实主游戏适配和动作时序对齐属于后续接入工作。
