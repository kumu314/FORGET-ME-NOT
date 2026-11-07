# 《忘记我》（Forget Me Not）项目开发分工与 GitHub PR 协作规范文档

---

## 1. 团队人员代号、角色定位与技术栈

### 1.1 核心技术栈规范 (Phaser 3 + Vite)
团队统一采用 **【Phaser.js 3 + Vite + ES6 模块化】** 架构开发：
* **核心框架**：`phaser` (v3.80+)
* **构建工具**：`vite`（极速启动，支持 `npm run dev` 局域网联调与 `npm run build` 纯静态导出）
* **物理系统**：Phaser 3 内置 Arcade Physics（轻量高效，原生重力与碰撞检测）
* **像素渲染**：开启 `pixelArt: true`，全局禁用抗锯齿平滑，确保 16×16 点阵质感。

### 1.2 人员角色与专属分支定义
为了保证在 GitHub 协作与敏捷开发中权责分明、指代清晰，团队 5 名成员统一使用 **A、B、C、D、E** 代号分配职责，各自拥有独立专属分支前缀（**按功能开短命分支，Squash 合并后即删**）：

* **成员 A**：**美术总监 / 角色动效 (Character Artist)**
* **成员 B**：**场景关卡美术 / 瓦片设计 (Environment Artist)**
* **成员 C**：**核心主程 / 角色控制器与物理 (Gameplay Lead)**
* **成员 D**：**系统架构 / 敌人与随从 AI (AI & System Lead)**
* **成员 E**：**UI交互 / 音频与关卡转场 (UI & Audio Engineer)**

---

## 2. 团队 A/B/C/D/E 详细工作任务分配表

每个成员的工作范围严格解耦，互不交叉冲突，确保在自己的模块内闭环：

| 成员代号 | 专属 GitHub 分支 | 负责核心模块 | 具体交付清单与验收标准 (P0/P1) | 关联交付文件路径 |
| :---: | :--- | :--- | :--- | :--- |
| **成员 A** | `assets/member-A-char-<feature>` | **角色、Boss与随从贴图动效** | 1. **主角三阶段**：青年（校服）、中年（西装）、老年（拄拐）的待机、奔跑、跳跃、受击、普攻三连击精灵表（24×24像素）；<br>2. **随从忠犬三阶段**：青年小幼犬（12×12）、中年大黄狗（20×16）、老年老狗的奔跑、扑咬撕扯动画帧；<br>3. **三大 Boss 精灵图**：一关班主任（教鞭/粉笔/翅膀）、二关老板、三关孩子；<br>4. 统一导出透明底 `.png` 和切片描述 `.json`。 | `game/public/assets/sprites/` |
| **成员 B** | `assets/member-B-env-<feature>` | **地图瓦片、场景背景与彩蛋物件** | 1. **三关瓦片集 (Tilemap)**：16×16 像素网格。一关（黑板/课桌/讲台）、二关（写字楼工位/百叶窗/地砖）、三关（老宅木地板/客厅/秋叶地面）；<br>2. **视差滚动背景层**：操场晨光、雨夜霓虹落地窗、夕阳窗台多层视差图；<br>3. **场景彩蛋道具贴图**：微颤纸箱、黑板报金光答题卡、保温杯等。 | `game/public/assets/tilesets/` |
| **成员 C** | `feat/member-C-player-<feature>` | **主角操控、动作物理与机能演变** | 1. **极简操作控制器**：实现 `A/D` 移动、`Space` 跳跃、`S` 下蹲格挡（免伤 70%）；<br>2. **战斗判定**：近战普攻（`J`）、远程投掷（`L`）、空中飞踢对空（`Space + J`）、空中投掷（`Space + L`）；<br>3. **生命周期数值**：青年（200血/50蓝/回蓝2/s）、中年（120血/100蓝/回蓝5/s）、老年（50血/200蓝/回蓝12/s）；<br>4. **老年机能剥夺**：第三关锁定跳跃功能（按 `Space` 仅播放咳嗽微动作，角色离地为 0）。 | `game/src/entities/Player.js`<br>`game/src/core/Input.js` |
| **成员 D** | `feat/member-D-ai-<feature>` | **怪物/Boss状态机与随从狗系统** | 1. **小怪 FSM 状态机**：实现巡逻、距离追击、攻击前摇判定；处理空中小怪悬浮与弹道；<br>2. **随从忠犬系统**：实现小狗“平滑延迟跟随”；玩家按 `J` 时小狗协同飞扑咬住小怪定身 1 秒；按 `Space+J` 仰头吠叫震落空中小怪；<br>3. **跨场景持久化单例**：第一关救出小狗后，第二关、第三关自动继承并更新为对应年龄形态；<br>4. **Boss 逻辑**：班主任与老板的技能定时循环、前摇预警红框与半血二阶段狂暴。 | `game/src/ai/MonsterFSM.js`<br>`game/src/ai/DogCompanion.js`<br>`game/src/ai/Boss*.js` |
| **成员 E** | `feat/member-E-ui-<feature>` | **对战HUD、彩蛋弹窗、音效与转场** | 1. **复古战斗 HUD**：绘制并动态绑定玩家血条槽、能量条槽、Boss血条与暴击飘字；<br>2. **彩蛋阅读弹窗**：实现触碰小狗纸箱、答题卡、保温杯时的慢动作居中特写卡片 UI；<br>3. **音频工程集成**：接入 8-bit/16-bit 芯片音效（拳击、扔粉笔、狗吠、格挡、下课铃、雷雨）；<br>4. **轻量转场叙事**：实现关卡结算后的纯黑淡出与 1~2 句打字机文本过渡。 | `game/src/ui/BattleHUD.js`<br>`game/src/ui/EasterEggModal.js`<br>`game/public/assets/audio/` |

---

## 3. GitHub PR（Pull Request）多人协作标准流

为了杜绝多人同时 push 产生代码覆盖或 Git 树混乱，团队实行**“双主干 + 专属前缀功能分支 + 强制提 PR 合并”**的工作流：

```
main (受保护分支：只存放可演示、无报错的最终发布版本)
 ▲
 │ (阶段性整体测试通过后，由技术负责人统一发 PR 合并)
 │
develop (主干集成开发分支：全员集成测试与合并目标分支)
 ▲
 ├── PR: assets/member-A-char-<feature>   (成员 A，每个功能一条)
 ├── PR: assets/member-B-env-<feature>    (成员 B，每个功能一条)
 ├── PR: feat/member-C-player-<feature>   (成员 C，每个功能一条)
 ├── PR: feat/member-D-ai-<feature>       (成员 D，每个功能一条)
 └── PR: feat/member-E-ui-<feature>       (成员 E，每个功能一条)
```

---

### 3.1 成员日常 Git 操作四步法（标准作业程序 SOP）

#### 第一步：开工前同步最新基线（防止落后过多）
每天开工或准备写新功能前，先在本地终端拉取 `develop` 最新代码合并到自己的分支：
```bash
git checkout develop
git pull origin develop
git checkout feat/member-X-xxxx    # 切换回自己的分支
git merge develop                  # 将主干最新成果合入自己本地
```

#### 第二步：在独立分支上进行日常提交
开发只在自己的独立分支上进行，遵守规范 Commit 格式：
```bash
git add .
git commit -m "feat(member-C): 完成老年阶段锁定跳跃功能与咳嗽动作"
git push origin feat/member-X-xxxx
```

#### 第三步：在 GitHub 上发起 Pull Request (PR)
1. 登录 GitHub 仓库页面，点击 **"Pull requests" -> "New pull request"**；
2. **基线对比设置**：
   * `base: develop`  <---  `compare: feat/member-X-xxxx`
   * ⚠️ **严禁将 base 设置为 `main`！必须全部提到 `develop` 分支！**
3. **PR 标题与模板规范**：
   * **PR标题**：`[代号X] 简短功能概述`（例如：`[成员C] 完成青年/中年/老年跳跃控制与属性曲线`）
   * **PR说明内容**：
     * **本次实现内容**：列举 1~3 条核心点；
     * **自测情况**：是否本地运行通过，控制台有无报错；
     * **关联文件**：修改了哪些文件。

#### 第四步：合并（由成员 A 批量执行 · 2026-11-07 修订）
* PR 发出后**无需等待审批**：确认 CI 绿、自查四条完成、影响面已报备即可；**合并统一由成员 A 批量点击 "Squash and merge"** 合入 `develop`。
* 原美术组/程序组互审改为**自查 + 非阻塞求审**：拿不准的地方（资源尺寸、变量污染）在 PR 里 @ 相关成员看一眼，但不阻塞合并。

---

## 4. 标准工程脚手架与目录树解耦 (Vite + Phaser 3)

> 仓库顶层布局：`docs/`（设计文档与协作规范）· `README.md` · `CONTRIBUTING.md` · **`game/`（Phaser 工程，Vite 根）**。
> 路径约定由主程裁决：所有资源与代码一律在 `game/` 内，Vite 打包以 `game/` 为根。

```
game/                            # 游戏工程子目录（Vite 根）
├── index.html                     # 游戏入口与 Canvas 挂载根节点
├── package.json                   # 依赖配置 ("phaser": "^3.80.0", "vite": "^5.0.0")
├── vite.config.js                 # 极速构建与开发服务器配置
│
├── public/                        # 【静态资源免编译专区 = game/public/】
│   └── assets/
│       ├── sprites/               # 角色/小怪/随从狗精灵图 (成员 A 提交)
│       │   ├── player_youth.png
│       │   ├── player_middle.png
│       │   ├── player_elder.png
│       │   ├── dog_companion.png
│       │   └── boss_teacher.png
│       ├── tilesets/              # 地图Tilemap与彩蛋 (成员 B 提交)
│       │   ├── school_tiles.png
│       │   ├── stage1_map.json    # Tiled导出的关卡瓦片数据
│       │   └── easter_box.png
│       └── audio/                 # 8-bit音效与BGM (成员 E 提交)
│           ├── sfx_hit.wav
│           ├── sfx_bark.wav
│           └── bgm_stage1.mp3
│
└── src/                           # 【核心代码专区 - ES6模块化】
    ├── main.js                    # Phaser.Game 配置与初始化入口
    ├── config/                    # 关卡数值与按键常量
    │   └── gameConfig.js
    ├── entities/                  # 游戏实体与物理 (成员 C 专区)
    │   ├── Player.js              # 继承 Phaser.Physics.Arcade.Sprite
    │   └── ChalkBullet.js         # 飞行道具
    ├── ai/                        # AI行为与状态机 (成员 D 专区)
    │   ├── MonsterFSM.js          # 普通小怪与浮空怪AI
    │   ├── DogCompanion.js        # 随从狗平滑跟随与扑咬协战
    │   └── BossTeacher.js         # 第一关Boss行为树与狂暴
    ├── ui/                        # HUD与弹窗 (成员 E 专区)
    │   ├── BattleHUD.js           # 纯像素UI血条、能量槽、Boss血条
    │   └── EasterEggModal.js      # 彩蛋居中慢动作特写弹窗
    └── scenes/                    # Phaser 场景管理器 (全员协作)
        ├── BootScene.js           # 资源预加载
        ├── Stage1Scene.js         # 第一关·青葱岁月
        ├── Stage2Scene.js         # 第二关·泥潭中年
        └── Stage3Scene.js         # 第三关·暮年回响 (禁用跳跃)
```

---

## 5. 协作军规与防翻车红线

1. **红线一：严禁向 `main` 分支直推代码**。`main` 分支开启分支保护，只允许通过 `develop` 测试完成后一次性合并。
2. **红线二：美术资源禁止上传超大工程源文件**。
   * 成员 A 与成员 B 严禁上传几百兆的 `.psd`、`.ase` 原文件，仓库只认最终导出的轻量 `.png` 和 `.json`，防止仓库体积膨胀导致 push/clone 失败。
3. **红线三：坚持 P0 优先，动画最后做**。
   * 成员 A、E 严禁在游戏战斗手感未成型前花费数小时抠终局长动画。通关结局先用纯黑背景 + 打字机文本快速打通全流程闭环！
4. **红线四：有冲突本地解决，不强推**。
   * 若提 PR 时提示冲突（Conflict），不要强推（禁止 `--force`），应在本地 checkout 自己分支后 `git merge develop`，在本地编辑器解掉冲突后再 push。
