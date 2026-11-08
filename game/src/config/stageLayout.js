/**
 * 关卡数据（成员C：负责碰撞布局与检查点；issue #16：第一关瓦片拼装数据）
 *
 * 三关地形按设计文档 §4 / §5.5 / §5.6：
 *  - 第一关：走廊 + 平台 + 讲台（可借力上黑板报横梁）
 *  - 第二关：工位平台 + 打印机长廊
 *  - 第三关：**纯平地**（取消一切断桥/高台/垂直天井，因为老年无法跳跃）
 *
 * 坐标单位：像素，y 轴向下；地面 y 约 240（世界高 270）。
 *
 * 第一关瓦片拼装（issue #16，用成员 B 的 school_corridor / school_props / easter_eggs 图集）：
 *  - tiles：绘制操作列表 { t: 瓦片帧名, x, y, w?, h? }，w/h 为重复格数（默认 1），
 *    按"墙带 → 横梁/黑板报 → 道具 → 地面 → 地下"顺序绘制，后画的盖住先画的。
 *  - sections：三段布局（GDD §4.1）主干道走廊 → 黑板报墙 → 阶梯教室，供单测与编辑器校验。
 *  - breakables：可打碎物（近战命中后由 StageScene 换帧/散纸并掉落彩蛋）。
 *  - eggHelpers：彩蛋解谜用浮空借力小怪（飞踢命中浮空怪 → 借力弹跳，AI.airKickBounce）。
 *
 * 横梁可达性核算（jumpVelocity -310 / 重力 1000 / airKickBounce 180）：
 *  - 站讲台顶(y200)纯跳最高到 y≈152 → 横梁顶 148 差 4px，**纯跳够不着**；
 *  - 空中飞踢借力 +16px → 最高到 y≈136 → 可稳落横梁 ⇒ 必须经"讲台跳 + 飞踢借力"两步。
 *  - 借力小怪须悬在横梁顶以上 ≥33px（踢击判定框在头顶上方 19~45px）且位于横梁 x 范围之外，
 *    避免上升途中撞横梁底面。
 */

export const GROUND_Y = 240;
export const WORLD_WIDTH = 1600;

/** @typedef {{x:number,y:number,w:number,h:number,kind?:string,label?:string}} Solid */
/** @typedef {{t:string,x:number,y:number,w?:number,h?:number,depth?:number}} TilePaint */
/** @typedef {{id:string,x:number,y:number,kind:string}} Breakable */

/** youth 关瓦片绘制序列（成员 B 图集帧名，见 game/public/assets/tilesets/*.json） */
const YOUTH_TILES = [
  // ── 墙带（y96-240：上墙 3 行 + 窗户行 + 腰线 + 护墙板 + 踢脚） ──
  { t: 'wall_upper', x: 0, y: 96, w: 100, h: 3 }, // 上墙整体打底 y96-144
  { t: 'wall_upper_b', x: 480, y: 96, w: 10, h: 3 }, // 变体墙
  { t: 'wall_upper_b', x: 960, y: 96, w: 14, h: 3 },
  // 窗户行 y144：三扇落日窗（窗 tile 在上一格，窗台在下一格）
  { t: 'window', x: 112, y: 144, w: 3, h: 1 },
  { t: 'windowsill', x: 112, y: 160, w: 3, h: 1 },
  { t: 'window', x: 272, y: 144, w: 3, h: 1 },
  { t: 'windowsill', x: 272, y: 160, w: 3, h: 1 },
  // 壁柱（柱头 + 柱身落到腰线）
  { t: 'column_top', x: 88, y: 96, w: 1, h: 1 },
  { t: 'column_body', x: 88, y: 112, w: 1, h: 4 },
  { t: 'column_top', x: 344, y: 96, w: 1, h: 1 },
  { t: 'column_body', x: 344, y: 112, w: 1, h: 4 },
  { t: 'column_top', x: 760, y: 96, w: 1, h: 1 },
  { t: 'column_body', x: 760, y: 112, w: 1, h: 4 },
  { t: 'column_top', x: 1160, y: 96, w: 1, h: 1 },
  { t: 'column_body', x: 1160, y: 112, w: 1, h: 4 },
  { t: 'column_top', x: 1440, y: 96, w: 1, h: 1 },
  { t: 'column_body', x: 1440, y: 112, w: 1, h: 4 },
  // 墙上装饰：红横幅 / 优秀学生名单 / 挂钟 / 常春藤
  { t: 'banner_red', x: 336, y: 96, w: 2, h: 1 },
  { t: 'banner_red', x: 1330, y: 96, w: 4, h: 1 },
  { t: 'honor_roll', x: 612, y: 120, w: 1, h: 1 },
  { t: 'wall_clock', x: 1408, y: 112, w: 1, h: 1 }, // 阶梯教室的高考倒计时钟（GDD §4.5）
  { t: 'vine_ivy', x: 520, y: 96, w: 1, h: 2 },
  { t: 'vine_ivy', x: 1024, y: 96, w: 1, h: 2 },

  // ── 腰线 + 护墙板 + 踢脚（全宽） ──
  { t: 'wall_trim', x: 0, y: 176, w: 100, h: 1 },
  { t: 'wall_lower', x: 0, y: 192, w: 100, h: 2 },
  { t: 'wall_base', x: 0, y: 224, w: 100, h: 1 },

  // ── 黑板报墙（第一段高潮：讲台 + 大黑板 + 顶部横梁） ──
  { t: 'bb_tl', x: 600, y: 152, w: 1, h: 1 },
  { t: 'bb_tm', x: 616, y: 152, w: 1, h: 1 },
  { t: 'bb_tr', x: 632, y: 152, w: 1, h: 1 },
  { t: 'bb_ml', x: 600, y: 168, w: 1, h: 1 },
  { t: 'bb_mm', x: 616, y: 168, w: 1, h: 1 },
  { t: 'bb_mr', x: 632, y: 168, w: 1, h: 1 },
  { t: 'bb_bl', x: 600, y: 184, w: 1, h: 1 },
  { t: 'bb_bm', x: 616, y: 184, w: 1, h: 1 },
  { t: 'bb_br', x: 632, y: 184, w: 1, h: 1 },

  // ── 阶梯教室（Boss 战场背景：大黑板 + 阶梯座位意象 + 教室门） ──
  { t: 'bb_tl', x: 1248, y: 136, w: 1, h: 1 },
  { t: 'bb_tm', x: 1264, y: 136, w: 1, h: 1 },
  { t: 'bb_tr', x: 1280, y: 136, w: 1, h: 1 },
  { t: 'bb_ml', x: 1248, y: 152, w: 1, h: 1 },
  { t: 'bb_mm', x: 1264, y: 152, w: 1, h: 1 },
  { t: 'bb_mr', x: 1280, y: 152, w: 1, h: 1 },
  { t: 'bb_bl', x: 1248, y: 168, w: 1, h: 1 },
  { t: 'bb_bm', x: 1264, y: 168, w: 1, h: 1 },
  { t: 'bb_br', x: 1280, y: 168, w: 1, h: 1 },
  // 阶梯座位：左升右降两组台阶 + 透视栏杆（纯装饰，无碰撞，Boss 场地保持纯平）
  { t: 'stairs_up', x: 1016, y: 224, w: 1, h: 1 },
  { t: 'stairs_up', x: 1032, y: 208, w: 1, h: 1 },
  { t: 'stairs_up', x: 1048, y: 192, w: 1, h: 1 },
  { t: 'stairs_up', x: 1064, y: 176, w: 1, h: 1 },
  { t: 'railing', x: 1016, y: 160, w: 4, h: 1 },
  { t: 'stairs_down', x: 1088, y: 176, w: 1, h: 1 },
  { t: 'stairs_down', x: 1104, y: 192, w: 1, h: 1 },
  { t: 'stairs_down', x: 1120, y: 208, w: 1, h: 1 },
  { t: 'stairs_down', x: 1136, y: 224, w: 1, h: 1 },
  // 教室木门（tile 版，y208-240）
  { t: 'door_top', x: 1208, y: 208, w: 1, h: 1 },
  { t: 'door_bottom', x: 1208, y: 224, w: 1, h: 1 },

  // ── 储物柜（走廊后半，与 solid 880/200/120/40 对齐，3 行 × 8 列；issue #65：顶 y200 可跳跃翻越） ──
  { t: 'locker_tl', x: 880, y: 200, w: 4, h: 1 },
  { t: 'locker_tr', x: 944, y: 200, w: 4, h: 1 },
  { t: 'locker_bl', x: 880, y: 216, w: 4, h: 1 },
  { t: 'locker_br', x: 944, y: 216, w: 4, h: 1 },
  { t: 'locker_bl', x: 880, y: 232, w: 4, h: 1 },
  { t: 'locker_br', x: 944, y: 232, w: 4, h: 1 },

  // ── 横梁（solid beam 568/148/128/10：8 格，黑板报正上方） ──
  // beam 帧在 16×16 格里只占第 4~11 行（上下各有透明留白），所以贴图 y 要上移 4px，
  // 让"看得见的木梁上沿"落在 148 == solid 上沿。否则人站上去会浮在梁上方 4px。
  { t: 'beam', x: 568, y: 144, w: 8, h: 1 },

  // ── 课桌（与 solids 对齐：desk_* 帧顶部有 2px 透明留白，故 y 取 solid.y - 2） ──
  { t: 'desk_left', x: 260, y: 190, w: 1, h: 1 },
  { t: 'desk_mid', x: 276, y: 190, w: 4, h: 1 },
  { t: 'desk_right', x: 340, y: 190, w: 1, h: 1 },
  { t: 'desk_left', x: 428, y: 158, w: 1, h: 1 },
  { t: 'desk_mid', x: 444, y: 158, w: 3, h: 1 },
  { t: 'desk_right', x: 492, y: 158, w: 1, h: 1 },
  { t: 'books_stack', x: 448, y: 142, w: 1, h: 1 }, // 桌上书堆（随桌面一起下移 2px）
  { t: 'desk_left', x: 1120, y: 150, w: 1, h: 1 },
  { t: 'desk_mid', x: 1136, y: 150, w: 3, h: 1 },
  { t: 'desk_right', x: 1184, y: 150, w: 1, h: 1 },
  { t: 'books_stack', x: 1152, y: 134, w: 1, h: 1 },

  // ── 讲台（solid 520/200/64/40：顶 + 双层底） ──
  { t: 'podium_top', x: 520, y: 200, w: 4, h: 1 },
  { t: 'podium_base', x: 520, y: 216, w: 4, h: 1 },
  { t: 'podium_base', x: 520, y: 232, w: 4, h: 1 },

  // ── 阶梯教室前排课桌（Boss 场地 1150-1580 保持净空） ──
  { t: 'desk_left', x: 936, y: 224, w: 1, h: 1 },
  { t: 'desk_mid', x: 952, y: 224, w: 1, h: 1 },
  { t: 'desk_right', x: 968, y: 224, w: 1, h: 1 },

  // ── 地面道具（贴地 16×16，y224-240） ──
  { t: 'plant', x: 64, y: 224, w: 1, h: 1 },
  { t: 'plant', x: 1032, y: 224, w: 1, h: 1 },
  { t: 'trash_bin', x: 712, y: 224, w: 1, h: 1 },
  { t: 'paper_scrap', x: 180, y: 224, w: 1, h: 1 },
  { t: 'paper_scrap', x: 940, y: 224, w: 1, h: 1 },
  { t: 'chalk_dust', x: 580, y: 224, w: 1, h: 1 },
  { t: 'chalk_dust', x: 1260, y: 224, w: 1, h: 1 },

  // ── 地面（y240-256：floor_a/b 混铺 + 裂纹点缀；浅坑 620-680 保持 C 的原始碰撞） ──
  { t: 'floor_a', x: 0, y: 240, w: 13, h: 1 },
  { t: 'floor_b', x: 208, y: 240, w: 6, h: 1 },
  { t: 'floor_a', x: 304, y: 240, w: 7, h: 1 },
  { t: 'floor_b', x: 416, y: 240, w: 6, h: 1 },
  { t: 'floor_a', x: 512, y: 240, w: 6, h: 1 },
  { t: 'floor_edge', x: 604, y: 240, w: 1, h: 1 }, // 浅坑左沿
  { t: 'wall_base', x: 620, y: 240, w: 1, h: 1 }, // 坑壁（左）
  { t: 'floor_dark', x: 636, y: 240, w: 2, h: 1 }, // 坑背
  { t: 'wall_base', x: 668, y: 240, w: 1, h: 1 }, // 坑壁（右）
  { t: 'floor_edge', x: 680, y: 240, w: 1, h: 1 }, // 浅坑右沿
  { t: 'floor_a', x: 696, y: 240, w: 14, h: 1 },
  { t: 'floor_b', x: 920, y: 240, w: 6, h: 1 },
  { t: 'floor_a', x: 1016, y: 240, w: 7, h: 1 },
  { t: 'floor_b', x: 1128, y: 240, w: 7, h: 1 },
  { t: 'floor_a', x: 1240, y: 240, w: 7, h: 1 },
  { t: 'floor_b', x: 1344, y: 240, w: 6, h: 1 },
  { t: 'floor_a', x: 1440, y: 240, w: 10, h: 1 },
  { t: 'floor_crack', x: 368, y: 240, w: 1, h: 1 },
  { t: 'floor_crack', x: 1064, y: 240, w: 1, h: 1 },
  { t: 'floor_crack', x: 1544, y: 240, w: 1, h: 1 },
  // 地下衬层（含浅坑底部，整条铺满）
  { t: 'floor_dark', x: 0, y: 256, w: 100, h: 1 },
];

const MIDDLE_TILES = [
  { t: 'wall_office', x: 0, y: 80, w: 69, h: 10 },
  { t: 'ceiling_plain', x: 0, y: 80, w: 100 },
  ...[96, 352, 608, 864].map((x) => ({ t: 'ceiling_light', x, y: 80, w: 4 })),
  ...[160, 400].flatMap((x) => [
    { t: 'partition_top', x, y: 160, w: 8 },
    { t: 'partition_body', x, y: 176, w: 8, h: 4 },
  ]),
  ...[{ x: 220, y: 208, w: 7 }, { x: 470, y: 192, w: 5 }].flatMap(({ x, y, w }) => [
    { t: 'desk_l', x, y }, { t: 'desk_m', x: x + 16, y, w },
    { t: 'desk_r', x: x + (w + 1) * 16, y },
    { t: 'desk_monitor', x: x + 32, y: y - 16 },
  ]),
  ...[620, 684, 900].flatMap((x) => [
    { t: 'printer_tl', x, y: 208 }, { t: 'printer_tr', x: x + 16, y: 208 },
    { t: 'printer_bl', x, y: 224 }, { t: 'printer_br', x: x + 16, y: 224 },
  ]),
  ...[812, 860].flatMap((x) => [
    { t: 'vending_top', x, y: 208 }, { t: 'vending_bottom', x, y: 224 },
  ]),
  { t: 'glasswall_a', x: 1104, y: 96, w: 31, h: 9 },
  ...[1104, 1232, 1360, 1488].map((x) => ({ t: 'mullion', x, y: 96, h: 9 })),
  { t: 'chair_office', x: 1460, y: 224 },
  { t: 'box_kpi', x: 1050, y: 224 },
  { t: 'carpet_a', x: 0, y: 240, w: 69 },
  { t: 'wetfloor_a', x: 1104, y: 240, w: 31 },
  { t: 'carpet_dark', x: 0, y: 256, w: 100 },
];

const ELDER_TILES = [
  { t: 'wall_paper', x: 0, y: 80, w: 45, h: 6 },
  { t: 'rail_wood', x: 0, y: 176, w: 45 },
  { t: 'wainscot', x: 0, y: 192, w: 45, h: 2 },
  { t: 'base_wood', x: 0, y: 224, w: 45 },
  { t: 'door_home_top', x: 16, y: 208 }, { t: 'door_home_bot', x: 16, y: 224 },
  ...[128, 352, 576].flatMap((x) => [
    { t: 'window_old', x, y: 144 }, { t: 'sill_old', x, y: 160 },
  ]),
  { t: 'photo_frame', x: 256, y: 160 },
  { t: 'tv_old', x: 320, y: 224 },
  { t: 'clock_top', x: 480, y: 208 }, { t: 'clock_base', x: 480, y: 224 },
  { t: 'rocker', x: 640, y: 224 },
  { t: 'wood_a', x: 0, y: 240, w: 45 },
  { t: 'wood_dark', x: 0, y: 256, w: 45 },
  { t: 'fence_wood', x: 720, y: 208, w: 55 },
  ...[784, 1040, 1296, 1536].map((x) => ({ t: 'trunk_maple', x, y: 176, h: 4 })),
  ...[832, 1168].map((x) => ({ t: 'bench_park', x, y: 224, w: 2 })),
  ...[752, 944, 1120, 1360].map((x) => ({ t: 'leaves_pile', x, y: 224, w: 2 })),
  { t: 'lantern_stone', x: 1392, y: 224 },
  { t: 'path_a', x: 720, y: 240, w: 55 },
  { t: 'grass_a', x: 720, y: 256, w: 55 },
];

export const STAGE_LAYOUTS = Object.freeze({
  youth: {
    stage: 1,
    title: '第一关 · 青葱岁月',
    phase: 'youth',
    spawn: { x: 48, y: GROUND_Y },
    /** 三段布局（GDD §4.1）：走廊 → 黑板报墙 → 阶梯教室 */
    sections: [
      { id: 'corridor', label: '主干道走廊', x0: 0, x1: 560 },
      { id: 'blackboard', label: '黑板报墙', x0: 560, x1: 1000 },
      { id: 'classroom', label: '阶梯教室', x0: 1000, x1: 1600 },
    ],
    checkpoints: [
      { x: 48, y: GROUND_Y, label: '走廊起点' },
      { x: 760, y: GROUND_Y, label: '教室门口' },
      { x: 1380, y: GROUND_Y, label: '阶梯教室门前' },
    ],
    solids: [
      // 连续走廊地面（留一处浅坑考验跳跃）
      { x: 0, y: GROUND_Y, w: 620, h: 30, kind: 'ground' },
      { x: 680, y: GROUND_Y, w: 920, h: 30, kind: 'ground' },
      // 课桌平台
      { x: 260, y: 192, w: 96, h: 12, kind: 'desk' },
      { x: 428, y: 160, w: 80, h: 12, kind: 'desk' },
      // 讲台（借力上黑板报横梁）
      { x: 520, y: 200, w: 64, h: 40, kind: 'podium' },
      { x: 568, y: 148, w: 128, h: 10, kind: 'beam', label: '黑板报横梁' },
      // 走廊后半段储物柜顶（issue #65：顶 y200 与讲台同高，40px 跳升可翻越，不再堵路）
      { x: 880, y: 200, w: 120, h: 40, kind: 'locker' },
      { x: 1120, y: 152, w: 80, h: 12, kind: 'desk' },
    ],
    /** 彩蛋锚点（StageScene 负责贴图与弹窗；letter 由 breakables 打碎后生成） */
    easterEggs: [
      // puppy-box x866：原 x900 落在储物柜 solid（880-1000）体内，合法玩法摸不到触碰圈
      // （触碰判定 |dy|<40，柜顶站立恰好 =40 不满足）。移到柜旁空地，GDD「储物柜旁」语义不变。
      { id: 'puppy-box', x: 866, y: GROUND_Y, type: 'companion' },
      { id: 'standard-answer', x: 660, y: 148, type: 'buff' },
    ],
    /** 可打碎物（近战命中 → StageScene 换帧散纸并掉落彩蛋） */
    breakables: [
      { id: 'letter-pile', x: 308, y: 222, kind: 'paper-pile' }, // 桌洞纸堆 → 手写情书
      { id: 'puppy-box', x: 866, y: 232, kind: 'box' }, // 纸箱封条 → 打开后可触碰触发忠犬
    ],
    /** 彩蛋解谜浮空借力怪（飞踢命中 → AI.airKickBounce 借力弹跳上横梁） */
    eggHelpers: [{ type: 'sleepBug', x: 555, y: 112, respawnMs: 2500, forEgg: 'standard-answer' }],
    /** B 图集瓦片绘制序列（见文件头注释） */
    tiles: YOUTH_TILES,
  },
  middle: {
    stage: 2,
    title: '第二关 · 泥潭中年',
    phase: 'middle',
    tileset: 'office_rain',
    sections: [
      { id: 'workstations', from: 0, to: 600, label: '深夜工位' },
      { id: 'printers', from: 600, to: 760, label: '打印机长廊' },
      { id: 'tea-room', from: 760, to: 1104, label: '茶水间' },
      { id: 'boss-foyer', from: 1104, to: 1600, label: '总裁办公室前厅' },
    ],
    spawn: { x: 48, y: GROUND_Y },
    checkpoints: [
      { x: 48, y: GROUND_Y, label: '工位起点' },
      { x: 700, y: GROUND_Y, label: '茶水间走廊' },
      { x: 1320, y: GROUND_Y, label: '总裁办公室前厅' },
    ],
    solids: [
      { x: 0, y: GROUND_Y, w: 1600, h: 30, kind: 'ground' },
      // 工位桌面（可跳上）
      { x: 220, y: 208, w: 144, h: 32, kind: 'desk' },
      { x: 470, y: 192, w: 112, h: 48, kind: 'desk' },
      // 打印机长廊顶盖
      { x: 620, y: 208, w: 32, h: 32, kind: 'printer' },
      { x: 684, y: 208, w: 32, h: 32, kind: 'printer' },
    ],
    easterEggs: [
      // thermos x600：原 x842 落在打印机 solid（760-940）体内，合法玩法摸不到（#82 同类）
      { id: 'thermos', x: 600, y: GROUND_Y, type: 'buff' },
      { id: 'wedding-ring', x: 1080, y: GROUND_Y, type: 'story' },
    ],
    tiles: MIDDLE_TILES,
    breakables: [],
    eggHelpers: [],
  },
  elder: {
    stage: 3,
    title: '第三关 · 暮年回响',
    phase: 'elder',
    tileset: 'home_autumn',
    sections: [
      { id: 'home', from: 0, to: 720, label: '老宅客厅' },
      { id: 'autumn-park', from: 720, to: 1600, label: '秋叶公园' },
    ],
    spawn: { x: 48, y: GROUND_Y },
    checkpoints: [
      { x: 48, y: GROUND_Y, label: '玄关' },
      { x: 780, y: GROUND_Y, label: '空着的摇椅' },
      { x: 1360, y: GROUND_Y, label: '秋叶公园' },
    ],
    solids: [
      // 纯平地：整关一条完整的连续地面，没有任何需要跳跃才能通过的地形
      { x: 0, y: GROUND_Y, w: 1600, h: 30, kind: 'ground' },
    ],
    easterEggs: [],
    tiles: ELDER_TILES,
    breakables: [],
    eggHelpers: [],
  },
});

/** 深拷贝一份布局，避免运行时改动污染常量 */
export function getStageLayout(phaseId) {
  const layout = STAGE_LAYOUTS[phaseId];
  if (!layout) throw new Error(`未知阶段的关卡: ${phaseId}`);
  return {
    ...layout,
    spawn: { ...layout.spawn },
    sections: (layout.sections ?? []).map((s) => ({ ...s })),
    checkpoints: layout.checkpoints.map((c) => ({ ...c })),
    solids: layout.solids.map((s) => ({ ...s })),
    easterEggs: layout.easterEggs.map((e) => ({ ...e })),
    breakables: (layout.breakables ?? []).map((b) => ({ ...b })),
    eggHelpers: (layout.eggHelpers ?? []).map((h) => ({ ...h })),
    tiles: (layout.tiles ?? []).map((t) => ({ ...t })),
  };
}

/** 校验：老年关必须是"纯平地"，不允许任何站立平台 */
export function validateElderStageIsFlat(layout) {
  const nonGround = layout.solids.filter((s) => s.kind !== 'ground');
  if (nonGround.length > 0) {
    throw new Error(`老年关不允许出现高台/断桥：${nonGround.map((s) => s.kind).join(',')}`);
  }
  return true;
}
