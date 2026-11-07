# 忘记我 · Forget Me Not

HENU 黑客松项目组**工作区**（Phaser 3 + Vite）。
游戏本体在 `game/`，`docs/` 存放设计文档，`prototype/` 保留早期原型。

## 游戏目录

```
game/
├── index.html            # 游戏入口（Canvas 挂载根节点）
├── package.json          # phaser ^3.90 / vite ^5 / vitest ^2
├── vite.config.js
└── src/                  # 核心代码专区（ES6 模块化）
```

### 本地运行

```bash
cd game
npm install
npm run dev       # http://localhost:5173 ，--host 已开，手机同网段可访问
npm run test      # 纯逻辑单测（数值曲线 / 战斗判定 / 输入语义）
npm run build     # 输出 dist/ 纯静态产物
```

## 当前进度

| 模块 | 负责人 | 状态 |
| :-- | :-- | :-- |
| 工程脚手架（Phaser 3 + Vite + 像素渲染基线） | 成员C | ✅ |
| 输入层 / 角色控制器 / 动作物理 / 生命周期数值 / 老年禁跳 | 成员C | ✅ |
| 关卡碰撞与检查点复活（三关数据驱动） | 成员C | ✅ |
| 角色与随从像素贴图 | 成员A | ⏳ 占位色块 |
| 瓦片、视差背景、彩蛋物件 | 成员B | ⏳ 占位瓦片 |
| 小怪 FSM / 随从狗 AI / Boss | 成员D | ⏳ 场景内暂用"沙包"假目标 |
| 战斗 HUD / 彩蛋弹窗 / 音效 / 转场 | 成员E | ⏳ 基础 HUD 占位 |

> 美术资源就位前，所有贴图走 `src/scenes/sceneHelpers.js` 生成的占位纹理，
> 换正式资源时只需替换纹理 key，不动逻辑代码。

## 协作规范

见 [CONTRIBUTING.md](./CONTRIBUTING.md) 与 [docs/开发分工与GitHub协作规范.md](./docs/开发分工与GitHub协作规范.md)。
