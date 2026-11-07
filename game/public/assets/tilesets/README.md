# game/public/assets/tilesets —— 场景瓦片与彩蛋贴图（成员 B 专区）

> 仓库路径：`game/public/assets/tilesets/`（Vite 以 `game/` 为根，`public/` 内文件按根路径对外服务）。
> 运行时加载 URL（相对 Vite 根）：`assets/tilesets/...`。
> 交付规格：16×16 像素网格 / 透明底 PNG / TexturePacker JSON(Array) 格式切片描述。
> Phaser 3 加载方式：`this.load.atlas('stage1', 'assets/tilesets/school_corridor.png', 'assets/tilesets/school_corridor.json')`

## 1. school_corridor.png（第一关·教学楼走廊，43 瓦片）

| 分组 | 瓦片名 | 说明 / 摆放规则 |
|---|---|---|
| 地面 | `floor_a` `floor_b` | 可横向平铺的走廊地砖，建议 a:b ≈ 2:1 混用 |
| 地面 | `floor_edge` | 平台/地面顶层边缘（顶部高光） |
| 地面 | `floor_dark` | 地面下层/深色填充 |
| 墙面 | `wall_upper` `wall_upper_b` | 米黄墙（上段），可平铺 |
| 墙面 | `wall_trim` | 上下墙分界的木条（单行使用） |
| 墙面 | `wall_lower` | 墨绿墙裙（下段），可平铺 |
| 墙面 | `wall_base` | 踢脚线（墙最底一行） |
| 门窗 | `window` + `windowsill` | 落日渐金玻璃窗；窗在上一格、窗台在下一格 |
| 门窗 | `door_top` + `door_bottom` | 教室门（上/下两格叠放，底部贴地） |
| 黑板 | `bb_tl…bb_br` | 3×3 大黑板块（48×48），粉笔字迹+粉笔槽 |
| 可破坏 | `bb_sealed` → `bb_sealed_broken` | 封条小黑板：被 `J` 击碎后替换为 broken（meta.role=breakable） |
| 家具 | `podium_top` + `podium_base` | 讲台（两格叠放，可站上去跳向横梁） |
| 家具 | `desk_left` `desk_mid` `desk_right` | 连排课桌：左/中/右三段拼接 |
| 家具 | `desk_single` | 单张课桌（顶上有书） |
| 家具 | `locker_tl/tr/bl/br` | 2×2 储物柜 |
| 装饰 | `beam` | 黑板报顶部的木横梁（平台，答题卡放置处），横向平铺 |
| 装饰 | `wall_clock` `honor_roll` `banner_red` | 挂钟 / 优秀学生名单 / 红色横幅（横幅可横铺） |
| 地面物 | `plant` `trash_bin` `paper_scrap` `chalk_dust` `books_stack` | 盆栽 / 垃圾桶 / 纸屑 / 粉笔灰 / 书堆 |

每个 frame 的 `meta.role`：`ground` / `platform`（可站立，solid=true）/ `decor` / `breakable`。

## 2. easter_eggs.png（彩蛋道具，9 精灵）

| 精灵 | 动画/用法 |
|---|---|
| `box_closed` `box_tremble_a` `box_tremble_b` | 小狗纸箱：idle 用 closed，触发前循环播放 tremble_a↔b（约 4fps 微颤） |
| `box_open` | 近战打碎封条+触碰后替换，内部留了狗耳朵位（狗本体用成员 A 资源叠加） |
| `bubble_wuu` | "呜呜"气泡，叠加在纸箱上方悬浮上下浮动 |
| `answer_card_a` `answer_card_b` | 金光答题卡：a↔b 循环闪烁，放置在 beam 横梁上 |
| `thermos_a` `thermos_b` | 保温杯（第二关茶水间夹缝），a↔b 反光闪烁 |

## 3. preview/（PR 自测证据，可随分支提交）

- `level1_corridor_mockup_x4.png` —— 用本瓦片集拼接的第一关走廊 320×176 逻辑分辨率 ×4 预览
- `eggs_box_x6.png` / `eggs_items_x6.png` / `sealed_board_x6.png` —— 彩蛋与可破坏物放大验证条

## 4. 再生成方式

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/gen_stage1_assets.ps1
```

改调色/像素后重跑脚本即可无损重出全部 PNG+JSON（禁止提交 .psd/.ase 源文件）。
