# game/public/assets —— 静态资源落点（VN 不参与打包编译）

> 这个目录**必须**位于 `game/` 之下：Vite 的 `publicDir` 默认就是 `<root>/public`，
> 里面的文件会被原样拷到 `game/dist/assets/` 并可直接按 `/assets/...` 访问。

## 目录归属

| 子目录 | 负责人 | 内容 |
| :-- | :-- | :-- |
| `sprites/` | 成员A | 角色 / 小怪 / 忠犬 / Boss 精灵图集（PNG + JSON） |
| `tilesets/` | 成员B | 瓦片集 + 彩蛋物件贴图 + 切片 JSON |
| `audio/` | 成员E | 8-bit 音效与 BGM |

## 加载路径约定

代码里一律用**以 `/` 开头的绝对路径**，例如：

```js
this.load.atlas('player_youth', '/assets/sprites/player_youth.png', '/assets/sprites/player_youth.json');
this.load.atlas('stage1', '/assets/tilesets/school_corridor.png', '/assets/tilesets/school_corridor.json');
```

`vite.config.js` 里 `base: './'` 只影响 JS/CSS 的引用前缀，不影响 `load.*` 的运行时路径；
`public/` 下的文件在 dev 与 build 后都稳定暴露在 `/assets/` 下。

## 迁移说明

成员A 的 `public/assets/sprites/`（仓库根）与成员B 的 `assets/tilesets/`（仓库根）
需要移动到本目录。移动只改路径、不改文件内容：

```bash
git mv public/assets/sprites game/public/assets/sprites
git mv assets/tilesets      game/public/assets/tilesets
```
