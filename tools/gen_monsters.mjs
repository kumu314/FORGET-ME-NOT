/**
 * 小怪像素贴图生成器（成员D · 资产批次）
 *
 * 为什么用脚本生成而不是手绘位图：
 *   1. 尺寸必须与 aiConfig.MONSTERS[x].placeholder 的 w/h 严格一致（8×8 / 12×10 / 12×12 / 12×14 / 12×18 / 16×16），
 *      body.setOffset 依赖 this.width/height，差 1px 碰撞盒就歪；
 *   2. 六只共用一套调色板与 1px 描边，风格才会统一；
 *   3. 可复现——改像素图直接改下面的字符网格，重跑即得，不需要美术软件。
 *
 * 运行：node tools/gen_monsters.mjs
 * 产出：game/public/assets/sprites/monsters/*.png（每只 2 帧横排）+ preview/*.png（8 倍放大预览）
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../game/public/assets/sprites/monsters');
const PREVIEW_DIR = path.join(OUT_DIR, 'preview');

/* ==========================================================
 * 1. 通用调色板
 * ========================================================== */

const OUTLINE = '#1b1b25'; // 全项目统一描边色（AIManager.drawCreature 也用这个）
const EYE = '#2a2a3a';

const PALETTES = {
  paper: { '.': null, O: OUTLINE, C: '#f2e8d5', H: '#d9c9a6', D: '#c0ad8a', E: EYE, B: '#8fb2cf' },
  sleepbug: { '.': null, O: OUTLINE, B: '#b9c7ff', D: '#8b9de0', W: '#e8eeff', E: EYE },
  inspector: { '.': null, O: OUTLINE, C: '#6b5b4a', D: '#4a3f33', S: '#c8b9a0', R: '#d94b3f', M: '#9aa4b0', W: '#d9d2c4', E: EYE },
  dot: { '.': null, O: OUTLINE, R: '#ff4d5e', D: '#c22a3c', W: '#ffffff' },
  ghost: { '.': null, O: OUTLINE, G: '#7fe3c4', D: '#4fb89b', E: '#12211d', T: '#dbe9ef' },
  vortex: { '.': null, O: OUTLINE, P: '#9a6bff', D: '#6c46c4', W: '#e6dcff', Y: '#ffd76a' },
};

/* ==========================================================
 * 2. 像素图（每帧一个字符网格，字符 → PALETTES 里的键）
 *    每个网格必须严格 width × height，脚本会逐行校验
 *    画法：1px 深色描边打底 → 主体色 → 单侧阴影 → 局部高光
 * ========================================================== */

const SPRITES = [
  /* 纸精 12×12：一张右上折角的答题纸，两道横格线，下摆齐边（不做撕口，避免读成骷髅） */
  {
    key: 'mon_paper',
    palette: 'paper',
    frames: [
      [
        '............',
        '..OOOOOO....',
        '.OCCCCCOOO..',
        '.OCCCCCCOCO.',
        '.OCCCCCCCCO.',
        '.OCEECCEECO.',
        '.OCCCCCCCCO.',
        '.OCBBBBBBCO.',
        '.OCBCBCBCCO.',
        '..OCCCCCCO..',
        '...OOOOOO...',
        '............',
      ],
      [
        '............',
        '..OOOOOO....',
        '.OCCCCCOOO..',
        '.OCCCCCCOCO.',
        '.OCCCCCCCCO.',
        '.OCCCCCCCCO.',
        '.OCEECCEECO.',
        '.OCBBBBBBCO.',
        '.OCBCBCBCCO.',
        '..OCCCCCCO..',
        '...OOOOOO...',
        '............',
      ],
    ],
  },

  /* 瞌睡浮游虫 12×10：圆身 + 两侧小翅，闭眼横线，垂下的触角 */
  {
    key: 'mon_sleepbug',
    palette: 'sleepbug',
    frames: [
      [
        '..O.....O...',
        '...O...O....',
        '.W..OOOO..W.',
        '.OWBBBBBBWO.',
        '.OBBBBBBBBO.',
        '.OBEEBBEEBO.',
        '.OBBBBBBBBO.',
        '..OBBBBBBO..',
        '...OOOOOO...',
        '............',
      ],
      [
        '............',
        '..O.....O...',
        '.W..OOOO..W.',
        '.OWBBBBBBWO.',
        '.OBBBBBBBBO.',
        '.OBEEBBEEBO.',
        '.OBBBBBBBBO.',
        '..OBBBBBBO..',
        '...OOOOOO...',
        '............',
      ],
    ],
  },

  /* 巡查员 12×18：鸭舌帽 + 帽檐下的脸、单侧红袖章、正面金属护甲、腰带皮鞋 */
  {
    key: 'mon_inspector',
    palette: 'inspector',
    frames: [
      [
        '....OOOO....',
        '..OOOOOOOO..',
        '.OOSSSSSSOO.',
        '.OSEESSEESO.',
        '.OSSSSSSSSO.',
        '..OOOOOOOO..',
        'OODCCCCCCDOO',
        'OCCCCCCCCCCO',
        'OCCCMMMMCCCO',
        'OCCRMMMMRCCO',
        'OCCCMMMMCCCO',
        'OCCDCCCCDCCO',
        'OCCCWCCWCCCO',
        'OCCCCCCCCCCO',
        'OCCCCCCCCCCO',
        '.OCCCCCCCCO.',
        '..ODDOODDO..',
        '..OOO..OOO..',
      ],
      [
        '....OOOO....',
        '..OOOOOOOO..',
        '.OOSSSSSSOO.',
        '.OSEESSEESO.',
        '.OSSSSSSSSO.',
        '..OOOOOOOO..',
        'OODCCCCCCDOO',
        'OCCCCCCCCCCO',
        'OCCCMMMMCCCO',
        'OCCRMMMMRCCO',
        'OCCDCCCCDCCO',
        'OCCCWCCWCCCO',
        'OCCCCCCCCCCO',
        'OCCCCCCCCCCO',
        '.OCCCCCCCCO.',
        '..ODDOODDO..',
        '..OOO..OOO..',
        '............',
      ],
    ],
  },

  /* 未读红点 8×8：通知徽标，中间一道白色未读计数 */
  {
    key: 'mon_dot',
    palette: 'dot',
    frames: [
      [
        '..OOOO..',
        '.ORRRRO.',
        'ORRWRRRO',
        'ORRWRRRO',
        'ORRWRRRO',
        '.ORRRRO.',
        '..OOOO..',
        '........',
      ],
      [
        '..OOOO..',
        '.ODRRDO.',
        'ORRWRRRO',
        'ORRWRRRO',
        'ORRWRRRO',
        '.ORRRRO.',
        '..OOOO..',
        '........',
      ],
    ],
  },

  /* 加班幽灵 12×14：空心方眼、下垂的领带（不放领口白块，避免读成嘴）、下摆波浪 */
  {
    key: 'mon_ghost',
    palette: 'ghost',
    frames: [
      [
        '....OOOO....',
        '..OOGGGGOO..',
        '.OGGGGGGGGO.',
        '.OGEEGGEEGO.',
        '.OGEEGGEEGO.',
        '.OGGGGGGGGO.',
        '.OGGGGGGGGO.',
        '.OGGGTTGGGO.',
        '.OGGGTTGGGO.',
        '.OGGGTGGGGO.',
        '.OGGGGGGGGO.',
        '.OGOGOGOGOO.',
        '..O.O.O.O.O.',
        '............',
      ],
      [
        '....OOOO....',
        '..OOGGGGOO..',
        '.OGGGGGGGGO.',
        '.OGEEGGEEGO.',
        '.OGEEGGEEGO.',
        '.OGGGGGGGGO.',
        '.OGGGGGGGGO.',
        '.OGGGTTGGGO.',
        '.OGGGTTGGGO.',
        '.OGGGTGGGGO.',
        'OGGGGGGGGGO.',
        'OGOGOGOGOGO.',
        '..O.O.O.O...',
        '............',
      ],
    ],
  },

  /* 需求涡流 16×16：暗核 + 亮环 + 三片被卷入的纸屑，两帧错开 45° 表示旋转 */
  {
    key: 'mon_vortex',
    palette: 'vortex',
    frames: [
      [
        '......OOOO......',
        '....OOPPPPOO....',
        '...OPPWWWWPPO...',
        '..OPPWDDDDWPPO..',
        '..OPWDDDDDDWPO..',
        '.OPPWDDDDDDWPPO.',
        '.OPWDDDDDDDDWPO.',
        'OPPWDDDWWDDDWPPO',
        'OPWDDDDWWDDDDDPO',
        '.OPWDDDDDDDDWPO.',
        '.OPPWDDDDDDWPPO.',
        '..OPWDDDDDDWPO..',
        '..OPPWDDDDWPPO..',
        '...OPPWWWWPPO...',
        '....OOPPPPOO....',
        '......OOOO......',
      ],
      [
        '......OOOO......',
        '....OOPPPPOO....',
        '...OPPWWWWPPO...',
        '..OPPWDDDDWPPO..',
        '..OPWDDDDDDWPO..',
        'OPPWDDDDDDDWPPO.',
        '.OPWDDDWDDDDWPO.',
        'OPPWDDDWDDDDWPPO',
        'OPWDDDDDDWDDDDPO',
        '.OPWDDDDWDDDWPO.',
        '..OPWDDDDDDWPO..',
        '..OPPWDDDDWPPO..',
        '..OPPWWWWWWPPO..',
        '...OPPPPPPPPO...',
        '....OOPPPPOO....',
        '......OOOO......',
      ],
    ],
  },
];


/* ==========================================================
 * 3. PNG 编码（无第三方依赖：手写 IHDR/IDAT/IEND）
 * ========================================================== */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ==========================================================
 * 4. 网格 → RGBA
 * ========================================================== */

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function validate(rows, label, expectW = null) {
  const w = rows[0].length;
  if (expectW && w !== expectW) throw new Error(`${label}: 宽度 ${w} ≠ 期望 ${expectW}`);
  rows.forEach((r, i) => {
    if (r.length !== w) throw new Error(`${label}: 第 ${i} 行宽度 ${r.length} ≠ ${w}`);
  });
  return { w, h: rows.length };
}

function drawInto(buf, sheetW, originX, rows, palette, label) {
  const { w, h } = validate(rows, label);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const ch = rows[y][x];
      if (!(ch in palette)) throw new Error(`${label}: 未知调色板字符 "${ch}" (${x},${y})`);
      const hex = palette[ch];
      if (!hex) continue;
      const [r, g, b] = hexToRgb(hex);
      const o = ((y * sheetW) + originX + x) * 4;
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
      buf[o + 3] = 255;
    }
  }
  return { w, h };
}

/* ==========================================================
 * 5. 主流程
 * ========================================================== */

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(PREVIEW_DIR, { recursive: true });

const report = [];

for (const sprite of SPRITES) {
  const palette = PALETTES[sprite.palette];
  const first = validate(sprite.frames[0], `${sprite.key}[0]`);
  const fw = first.w;
  const fh = first.h;
  const cols = sprite.frames.length;

  const sheetW = fw * cols;
  const buf = Buffer.alloc(sheetW * fh * 4, 0);

  sprite.frames.forEach((rows, i) => {
    const dim = drawInto(buf, sheetW, i * fw, rows, palette, `${sprite.key}[${i}]`);
    if (dim.h !== fh) throw new Error(`${sprite.key}: 各帧高度不一致`);
  });

  const file = path.join(OUT_DIR, `${sprite.key}.png`);
  fs.writeFileSync(file, encodePNG(sheetW, fh, buf));
  report.push({ key: sprite.key, frame: `${fw}×${fh}`, frames: cols, sheet: `${sheetW}×${fh}` });
}

/* 预览：8 倍最近邻放大，深底 + 浅底各一版，横向铺开 */
const SCALE = 8;
const GAP = 6;

function buildPreview(bgHex) {
  const tiles = SPRITES.map((s) => {
    const rows = s.frames[0];
    const { w, h } = validate(rows, s.key);
    return { rows, w, h, palette: PALETTES[s.palette] };
  });
  const contentW = tiles.reduce((sum, t) => sum + t.w * SCALE + GAP * SCALE, 0) + GAP * SCALE;
  const contentH = Math.max(...tiles.map((t) => t.h)) * SCALE + GAP * 2 * SCALE;

  const px = new Array(contentW * contentH * 4).fill(0);
  const [br, bg, bb] = hexToRgb(bgHex);
  for (let i = 0; i < contentW * contentH; i += 1) {
    px[i * 4] = br;
    px[i * 4 + 1] = bg;
    px[i * 4 + 2] = bb;
    px[i * 4 + 3] = 255;
  }

  let cursorX = GAP * SCALE;
  for (const t of tiles) {
    const offsetY = contentH - (t.h + GAP) * SCALE;
    for (let y = 0; y < t.h; y += 1) {
      for (let x = 0; x < t.w; x += 1) {
        const hex = t.palette[t.rows[y][x]];
        if (!hex) continue;
        const [r, g, b] = hexToRgb(hex);
        for (let sy = 0; sy < SCALE; sy += 1) {
          for (let sx = 0; sx < SCALE; sx += 1) {
            const px2 = cursorX + x * SCALE + sx;
            const py2 = offsetY + y * SCALE + sy;
            const o = (py2 * contentW + px2) * 4;
            px[o] = r;
            px[o + 1] = g;
            px[o + 2] = b;
            px[o + 3] = 255;
          }
        }
      }
    }
    cursorX += (t.w + GAP) * SCALE;
  }

  return { buf: Buffer.from(px), w: contentW, h: contentH };
}

for (const [name, bg] of [['dark', '#20222c'], ['light', '#cfd6e0']]) {
  const pv = buildPreview(bg);
  fs.writeFileSync(path.join(PREVIEW_DIR, `monsters_${name}.png`), encodePNG(pv.w, pv.h, pv.buf));
}

console.log('生成完毕：');
for (const r of report) console.log(`  ${r.key.padEnd(16)} 单帧 ${r.frame}  ×${r.frames} 帧  →  图集 ${r.sheet}`);
console.log(`输出目录：${OUT_DIR}`);
