# game/public/assets/tilesets —— 场景瓦片与彩蛋贴图（成员 B 专区）

> 仓库路径：`game/public/assets/tilesets/`（Vite 以 `game/` 为根，`public/` 内文件按根路径对外服务）。
> 运行时加载 URL（相对 Vite 根）：`assets/tilesets/...`。
> 交付规格：16×16 像素网格 / 透明底 PNG / TexturePacker JSON(Array) 格式切片描述。
> Phaser 3 加载方式：`this.load.atlas('stage1', 'assets/tilesets/school_corridor.png', 'assets/tilesets/school_corridor.json')`

## 0. 快速接入（三关瓦片集）

| 关卡 | 图集 | 加载 |
|---|---|---|
| 一关·教学楼走廊 | `school_corridor.png/.json` | `this.load.atlas('stage1', ...)` |
| 二关·写字楼雨夜 | `office_rain.png/.json` | `this.load.atlas('stage2', ...)` |
| 三关·老宅秋园 | `home_autumn.png/.json` | `this.load.atlas('stage3', ...)` |

每个 frame 的 `meta.role`：`ground` / `platform`（可站立，solid=true）/ `decor` / `breakable`。

## 1. school_corridor.png（第一关，43 瓦片）

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

## 2. office_rain.png（第二关·写字楼，34 瓦片）

| 分组 | 瓦片名 | 说明 |
|---|---|---|
| 地面 | `carpet_a/b/edge/dark` | 办公室地毯四件套（平铺/边缘/底层） |
| 地面 | `wetfloor_a/b` | 落地窗前反光地板（竖向光斑），建议窗下两列使用 |
| 墙/顶 | `wall_office` `wall_office_b` | 石膏板墙板（带拼缝），可平铺 |
| 墙/顶 | `ceiling_plain` `ceiling_light` | T-bar 吊顶 / 长灯面板（发光），顶行使用 |
| 工位 | `partition_top` `partition_body` | 格间挡板：顶盖（铝帽）+ 绒布板身，竖向堆叠 |
| 工位 | `desk_l/m/r` `desk_monitor` `desk_single` | 办公桌排（左/中/右三段）；带发光 CRT 显示器中段；单桌（文件+马克杯） |
| 打印长廊 | `printer_tl/tr/bl/br` | 2×2 大复印机（绿 LCD、出纸口、卡纸面板） |
| 茶水间 | `vending_top` `vending_bottom` | 自动贩卖机 16×32（上：发光货架；下：投币口+取货口），保温杯彩蛋放两机夹缝 |
| 窗 | `blinds_closed` `blinds_open` | 百叶窗（闭合/拉起露出夜景光点） |
| 窗 | `glasswall_a/b` `mullion` | 落地窗玻璃（雨痕+城市光点，两种变体）+ 竖向铝立柱 |
| 电梯 | `elevator` | 金属电梯门（中缝+呼叫面板） |
| 地面物 | `paper_pile` `chair_office` `bin_office` `box_kpi` `cable_floor` | 文件堆 / 转椅 / 网格垃圾桶（溢出废纸）/ KPI 纸箱 / 地上缆线 |

## 3. home_autumn.png（第三关·老宅秋园，31 瓦片）⚠️ 纯平地

> 第三关老年无法跳跃：**所有地形为平地**，本表不含任何必须跳跃的平台；`engawa`（缘侧）与长椅仅作装饰层级（solid=false 的长椅），不会挡路。

| 分组 | 瓦片名 | 说明 |
|---|---|---|
| 地面 | `wood_a/b/edge/dark` | 老宅木地板四件套（横向拼板+木纹） |
| 地面 | `path_a/b/edge` | 秋叶公园土路（落叶点缀，两种密度） |
| 地面 | `grass_a` | 秋日褪色草地 |
| 墙面 | `wall_paper` `wall_paper_b` | 暖米色墙纸（光斑变体） |
| 墙面 | `rail_wood` `wainscot` `base_wood` | 墙裙线 / 深木护墙板 / 踢脚线 |
| 门窗 | `window_old` `sill_old` | 旧木窗（暮色玻璃+枫叶剪影）/ 木窗台 |
| 门窗 | `door_home_top` `door_home_bot` | 玄关门：底格带暖光门缝（结局氛围用） |
| 室内 | `rocker` `tv_old` `clock_top/base` `cabinet_top/bot` | 摇椅 / 显像管电视（屏幕微光） / 落地钟 16×32（铜摆锤） / 旧柜 16×32（顶格全家福相框） |
| 室内 | `engawa` `photo_frame` | 缘侧木沿（装饰）/ 墙上全家福 |
| 秋园 | `bench_park` `trunk_maple` `leaves_pile` `leaves_flat` | 公园长椅（纯装饰）/ 枫树干+树冠底缘 / 落叶堆 / 散落叶 |
| 秋园 | `lantern_stone` `fence_wood` | 石灯笼 / 木栅栏横排（平铺） |

## 4. easter_eggs.png（彩蛋道具，9 精灵）

| 精灵 | 动画/用法 |
|---|---|
| `box_closed` `box_tremble_a` `box_tremble_b` | 小狗纸箱：idle 用 closed，触发前循环 tremble_a↔b（约 4fps 微颤） |
| `box_open` | 近战打碎封条+触碰后替换，内部留狗耳朵位（狗本体用成员 A 资源叠加） |
| `bubble_wuu` | "呜呜"气泡，叠加在纸箱上方悬浮上下浮动 |
| `answer_card_a` `answer_card_b` | 金光答题卡：a↔b 循环闪烁，放置在 beam 横梁上 |
| `thermos_a` `thermos_b` | 保温杯（第二关茶水间两台贩卖机夹缝），a↔b 反光闪烁 |

## 5. ../parallax/（三关多层视差背景，320×180 横向无缝）

清单 `../parallax/parallax.json`（含建议滚动系数）。全部 320×180、**横向无缝可平铺**，Phaser 用 `tileSprite(scaleX=游戏缩放)` 加载：

| 关卡 | 层（sky→near） | 建议滚动系数 |
|---|---|---|
| 一关·操场晨光 | `stage1_morning_sky / _far / _mid / _near` | 0.10 / 0.30 / 0.60 / 0.85 |
| 二关·雨夜霓虹落地窗 | `stage2_night_sky / _far / _mid / _near` + `stage2_rain_overlay` | 0.10 / 0.30 / 0.60 / 0.85 / 雨层 1.0 |
| 三关·夕阳秋园 | `stage3_sunset_sky / _far / _mid / _near` | 0.10 / 0.30 / 0.60 / 0.85 |

- 二关 `_near` 是落地窗竖向铝立柱（中间全透明，透出后面霓虹天际线）；
- 二关 `stage2_rain_overlay` 是透明底雨丝层：让程序组做快速纵向偏移动画（如每帧 `tilePositionY -= 4`）即成降雨；
- 合成效果自测图：`../parallax/preview/mockup_stage{1,2,3}_*.png`。

## 6. preview/（PR 自测证据）

- `school_corridor_sheet_x4.png` / `office_rain_sheet_x4.png` / `home_autumn_sheet_x4.png` / `easter_eggs_sheet_x4.png`：瓦片集 ×4 放大审阅图
- `level1_corridor_mockup_x4.png`：一关走廊场景拼接
- `../parallax/preview/mockup_stage1_morning_x3.png` 等：三关视差合成效果

## 7. 再生成方式

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/gen_stage1_assets.ps1   # 一关瓦片+彩蛋
powershell -NoProfile -ExecutionPolicy Bypass -File tools/gen_env_pack2.ps1       # 二三关瓦片+全部视差
powershell -NoProfile -ExecutionPolicy Bypass -File tools/make_sheet_previews.ps1 # 审阅放大图
```

改调色/像素后重跑脚本即可无损重出全部 PNG+JSON（禁止提交 .psd/.ase 源文件）。

## 8. 比例尺与多瓦片拼装规范（v2 改造标准）

> 目的：解决「砖大物小、墙空家具小」的比例失调。本节是 gen_*.ps1 下一版改图的**验收标准**。

### 8.0 唯一尺子

- 主角 24px ≈ 1.7m → **1 格(16px) ≈ 1.1m，约 14px = 1m**。
- 每个物件画完，先和主角 24px 精灵并肩比一比，再交付。

### 8.1 改造清单（尺寸对照）

| 物件 | 现尺寸 | v2 尺寸 | 帧形式 | 要点 |
|---|---|---|---|---|
| 窗户 | 1×1(16×16)+窗台 | **单窗 2×2 起，三段式 `window_l/_m/_r` 成排铺**（窗台仍独立一行） | 切片 l/m/r | 窗要比人高；窗棂十字+落日渐变玻璃保留 |
| 教室门 | 1×2(16×32) | **2×3(32×48)，门框画进帧内** | 整块帧 `door_2x3` | 门要明显比人宽、比人高 |
| 储物柜 | 2×2(32×32) | **2×3(32×48)** | 整块帧 `locker_2x3` | 柜比人高，顶格加排气栅 |
| 课桌连排 | 3×1(48×16) | 保持 3×1，**画满 16px 高** | 切片保持 | 加桌肚前板、腿加粗、顶板加厚——高度没错，是画太薄 |
| 单桌 desk_single | 1×1 | 同上，画壮实 | 整块帧 | 同上 |
| 盆栽 plant | 1×1 | **1×2(16×24)**：上株下盆 | 整块帧 | 现在像杯垫 |
| 垃圾桶 trash_bin | 1×1 | 保持 1×1，画满格 | 整块帧 | 现在没画满格 |
| 黑板 3×3 / 讲台 1×2 / 挂钟 / 横梁 beam | — | **保持不动** | — | 已达标，黑板是全图比例标兵 |
| （新增）公告栏 | — | 2×1(32×16)，贴墙 | 整块帧 | 治「墙空」 |
| （新增）灭火器箱 | — | 1×2(16×24)，贴墙 | 整块帧 | 治「墙空」 |

### 8.2 贴图细化规则（治「砖块那么大」）

- **贴图内部最小图案 ≤ 半格(8px)**，细纹理目标 4px。
- `floor_a/b`：格内画 2×2 小板纹（8px 子板≈55cm），`floor_edge` 只在顶部 1px 高光。
- `wall_upper`：斑点从随机稀疏改为规律分布（4~8px 间距），每 16px 加 1px 竖向拼缝（比底色暗一号）。
- `wall_lower` 绿墙裙：加水平护板线（每 8px 一道），消除大片纯色。
- `floor_dark`：纯色+轻微噪点即可，不必加图案。

### 8.3 拼装规则（多瓦片拼一个物品）

- **优先整块帧**：32×32 / 32×48 等大物件画成**一帧**，摆放时按格对齐——整块画永不拼缝。TexturePacker JSON(Array) 帧尺寸可任意（本仓库角色清单 24×24/64×64 即为例证），Phaser `load.atlas` 代码不用改。
- **只有可延伸结构才切片**：水平三段式 `l/m/r`（长桌、窗带），垂直 `top/mid/base`（门、柜若用切片）。
- `meta.role` 照旧：可站立的 `ground`/`platform` 标 solid=true，装饰 `decor`、可破坏 `breakable` 不变。
- 整块帧朝向以 facing=right 为基准（与 `tools/_style_ref/manifest.json` 一致）。

### 8.4 落地步骤与验收

1. 改 `tools/gen_stage1_assets.ps1` / `tools/gen_env_pack2.ps1` 对应绘制函数，重跑三脚本重出全部 PNG+JSON（禁手改 PNG）。
2. 重跑 `tools/make_sheet_previews.ps1` 出审阅图，并**加一张与主角精灵并排的比例对比图**放 `preview/`。
3. 验收线：窗≥人高、柜≥人高、门框完整、地板小板纹、墙面无大面积空白。
