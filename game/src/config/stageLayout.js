/**
 * 关卡数据（成员C：负责碰撞布局与检查点）
 *
 * 三关地形按设计文档 §4 / §5.5 / §5.6：
 *  - 第一关：走廊 + 平台 + 讲台（可借力上黑板报横梁）
 *  - 第二关：工位平台 + 打印机长廊
 *  - 第三关：**纯平地**（取消一切断桥/高台/垂直天井，因为老年无法跳跃）
 *
 * 坐标单位：像素，y 轴向下；地面 y 约 240（世界高 270）。
 */

export const GROUND_Y = 240;
export const WORLD_WIDTH = 1600;

/** @typedef {{x:number,y:number,w:number,h:number,kind?:string,label?:string}} Solid */

export const STAGE_LAYOUTS = Object.freeze({
  youth: {
    stage: 1,
    title: '第一关 · 青葱岁月',
    phase: 'youth',
    spawn: { x: 48, y: GROUND_Y },
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
      { x: 430, y: 160, w: 72, h: 12, kind: 'desk' },
      // 讲台（借力上黑板报横梁）
      { x: 520, y: 200, w: 64, h: 40, kind: 'podium' },
      { x: 560, y: 132, w: 140, h: 10, kind: 'beam', label: '黑板报横梁' },
      // 走廊后半段储物柜顶
      { x: 880, y: 184, w: 120, h: 56, kind: 'locker' },
      { x: 1120, y: 152, w: 80, h: 12, kind: 'desk' },
    ],
    /** 彩蛋锚点（由成员E做弹窗，成员B做贴图；这里只给位置） */
    easterEggs: [
      { id: 'puppy-box', x: 900, y: GROUND_Y, type: 'companion' },
      { id: 'standard-answer', x: 630, y: 132, type: 'buff' },
    ],
  },
  middle: {
    stage: 2,
    title: '第二关 · 泥潭中年',
    phase: 'middle',
    spawn: { x: 48, y: GROUND_Y },
    checkpoints: [
      { x: 48, y: GROUND_Y, label: '工位起点' },
      { x: 700, y: GROUND_Y, label: '茶水间走廊' },
      { x: 1320, y: GROUND_Y, label: '总裁办公室前厅' },
    ],
    solids: [
      { x: 0, y: GROUND_Y, w: 1600, h: 30, kind: 'ground' },
      // 工位桌面（可跳上）
      { x: 220, y: 196, w: 140, h: 44, kind: 'desk' },
      { x: 470, y: 176, w: 110, h: 64, kind: 'desk' },
      // 打印机长廊顶盖
      { x: 760, y: 188, w: 180, h: 52, kind: 'printer' },
      { x: 1040, y: 150, w: 96, h: 12, kind: 'duct', label: '通风管' },
    ],
    easterEggs: [{ id: 'thermos', x: 850, y: GROUND_Y, type: 'buff' }],
  },
  elder: {
    stage: 3,
    title: '第三关 · 暮年回响',
    phase: 'elder',
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
  },
});

/** 深拷贝一份布局，避免运行时改动污染常量 */
export function getStageLayout(phaseId) {
  const layout = STAGE_LAYOUTS[phaseId];
  if (!layout) throw new Error(`未知阶段的关卡: ${phaseId}`);
  return {
    ...layout,
    spawn: { ...layout.spawn },
    checkpoints: layout.checkpoints.map((c) => ({ ...c })),
    solids: layout.solids.map((s) => ({ ...s })),
    easterEggs: layout.easterEggs.map((e) => ({ ...e })),
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
