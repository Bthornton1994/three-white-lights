#!/usr/bin/env node
/**
 * Sprite inspection harness.
 *
 * Renders the lifter sprite system to PNGs so a critic can judge real pixels
 * without running the app, per GDD §12.4 ("critics inspect real output").
 *
 * Outputs under .gauntlet/shots/sprites/:
 *   palette.png                  the three 16-colour banks as swatches
 *   pose-sheet.png               every authored pose, relaxed vs. strained
 *   sheet-LIGHT.png              every animation frame of a light rep
 *   sheet-MAXIMAL.png            every animation frame of a maximal rep
 *   contact-sheet.png            light vs. maximal side by side, plus the
 *                                bar-height-over-time and bar-path graphs
 *   frames/1x/*.png              individual frames, native resolution
 *   frames/6x/*.png              individual frames, nearest-neighbour x6
 *
 * No npm dependencies. PNG is encoded here with node:zlib. TypeScript sources
 * are loaded through Node's built-in type stripping plus a resolve hook that
 * supplies the extensions TS-style imports omit — the sprite data a critic sees
 * is therefore the exact data the app imports, not a JS copy of it.
 *
 * Usage: node tools/sprites.mjs [--out DIR]
 */

import { registerHooks } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import zlib from 'node:zlib';

// ---------------------------------------------------------------------------
// TypeScript loading
// ---------------------------------------------------------------------------

registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (relative && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        const url = new URL(`${specifier}.ts`, context.parentURL ?? import.meta.url);
        if (existsSync(fileURLToPath(url))) {
          // No `format`: let Node infer it from the .ts extension, which is what
          // routes the file through built-in type stripping.
          return { url: url.href, shortCircuit: true };
        }
      } catch {
        /* fall through to default resolution */
      }
    }
    return nextResolve(specifier, context);
  },
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const art = await import(pathToFileURL(path.join(ROOT, 'src/art/index.ts')).href);

const {
  BANK_SIZE,
  PALETTE_BANKS,
  PAL,
  rgb5ToRgb8,
  LOAD_PRESETS,
  RESOLUTION,
  POSES,
  STRAIN,
  POSE_DEPTH_ANCHORS,
  buildSquatRep,
  ascentShapeVariation,
  longestStall,
  longestHoldTicks,
  longestAscentHoldTicks,
  longestAscentPoseRunTicks,
  peakForwardDeviationPx,
  peakLateralDeviationPx,
  peakBendPx,
  ascentTickFraction,
  distinctDrawingCount,
  renderLifterFrame,
  renderContactShadow,
  renderStage,
  frameSpecFrom,
  gridToRgba,
  compositeOver,
  cloneGrid,
  visualPlateStack,
  strainForLevel,
} = art;

// ---------------------------------------------------------------------------
// PNG encoding (node:zlib only)
// ---------------------------------------------------------------------------

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

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Encode straight RGBA8888 as a colour-type-6 PNG. */
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// A minimal RGBA canvas
// ---------------------------------------------------------------------------

function canvas(w, h, fill = [16, 16, 22, 255]) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = fill[3];
  }
  return { w, h, data };
}

function px(c, x, y, rgba) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const o = (y * c.w + x) * 4;
  if (rgba[3] === 0) return;
  c.data[o] = rgba[0];
  c.data[o + 1] = rgba[1];
  c.data[o + 2] = rgba[2];
  c.data[o + 3] = 255;
}

function rect(c, x, y, w, h, rgba) {
  for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) px(c, x + i, y + j, rgba);
}

/** Blit RGBA source, nearest-neighbour, integer scale. */
function blit(c, src, srcW, srcH, dx, dy, scale) {
  for (let y = 0; y < srcH * scale; y += 1) {
    const sy = (y / scale) | 0;
    for (let x = 0; x < srcW * scale; x += 1) {
      const sx = (x / scale) | 0;
      const o = (sy * srcW + sx) * 4;
      if (src[o + 3] === 0) continue;
      px(c, dx + x, dy + y, [src[o], src[o + 1], src[o + 2], 255]);
    }
  }
}

function line(c, x0, y0, x1, y1, rgba) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    px(c, x, y, rgba);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// ---------------------------------------------------------------------------
// 3x5 bitmap font. Labels have to be pixels too — a critic reading this sheet
// should not have to trust a filename.
// ---------------------------------------------------------------------------

const FONT = {
  A: '.#.|#.#|###|#.#|#.#',
  B: '##.|#.#|##.|#.#|##.',
  C: '.##|#..|#..|#..|.##',
  D: '##.|#.#|#.#|#.#|##.',
  E: '###|#..|##.|#..|###',
  F: '###|#..|##.|#..|#..',
  G: '.##|#..|#.#|#.#|.##',
  H: '#.#|#.#|###|#.#|#.#',
  I: '###|.#.|.#.|.#.|###',
  J: '..#|..#|..#|#.#|.#.',
  K: '#.#|#.#|##.|#.#|#.#',
  L: '#..|#..|#..|#..|###',
  M: '#.#|###|###|#.#|#.#',
  N: '#.#|###|###|###|#.#',
  O: '.#.|#.#|#.#|#.#|.#.',
  P: '##.|#.#|##.|#..|#..',
  Q: '.#.|#.#|#.#|###|.##',
  R: '##.|#.#|##.|#.#|#.#',
  S: '.##|#..|.#.|..#|##.',
  T: '###|.#.|.#.|.#.|.#.',
  U: '#.#|#.#|#.#|#.#|.#.',
  V: '#.#|#.#|#.#|.#.|.#.',
  W: '#.#|#.#|###|###|#.#',
  X: '#.#|#.#|.#.|#.#|#.#',
  Y: '#.#|#.#|.#.|.#.|.#.',
  Z: '###|..#|.#.|#..|###',
  0: '###|#.#|#.#|#.#|###',
  1: '.#.|##.|.#.|.#.|###',
  2: '##.|..#|.#.|#..|###',
  3: '##.|..#|.##|..#|##.',
  4: '#.#|#.#|###|..#|..#',
  5: '###|#..|##.|..#|##.',
  6: '.##|#..|###|#.#|###',
  7: '###|..#|.#.|.#.|.#.',
  8: '###|#.#|###|#.#|###',
  9: '###|#.#|###|..#|##.',
  ' ': '...|...|...|...|...',
  '.': '...|...|...|...|.#.',
  ',': '...|...|...|.#.|#..',
  ':': '...|.#.|...|.#.|...',
  '-': '...|...|###|...|...',
  '+': '...|.#.|###|.#.|...',
  '=': '...|###|...|###|...',
  '%': '#.#|..#|.#.|#..|#.#',
  '/': '..#|..#|.#.|#..|#..',
  '(': '..#|.#.|.#.|.#.|..#',
  ')': '#..|.#.|.#.|.#.|#..',
  '>': '#..|.#.|..#|.#.|#..',
  '<': '..#|.#.|#..|.#.|..#',
  '*': '#.#|.#.|###|.#.|#.#',
  '?': '##.|..#|.#.|...|.#.',
  '!': '.#.|.#.|.#.|...|.#.',
};

function text(c, str, x, y, rgba, scale = 1) {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT['?'];
    const rows = glyph.split('|');
    for (let ry = 0; ry < rows.length; ry += 1) {
      for (let rx = 0; rx < 3; rx += 1) {
        if (rows[ry][rx] !== '#') continue;
        rect(c, cx + rx * scale, y + ry * scale, scale, scale, rgba);
      }
    }
    cx += 4 * scale;
  }
  return cx;
}

const textW = (s, scale = 1) => s.length * 4 * scale;

// ---------------------------------------------------------------------------
// Sprite -> RGBA
// ---------------------------------------------------------------------------

const CELL_W = RESOLUTION.CELL_W;
const CELL_H = RESOLUTION.CELL_H;

/** Composite stage + contact shadow + sprite, and return RGBA bytes. */
function renderComposited(spec, depth, withStage = true) {
  const rendered = renderLifterFrame(spec);
  const base = withStage ? renderStage() : cloneGrid(rendered.grid);
  if (withStage) {
    compositeOver(base, renderContactShadow(rendered.pose, depth));
    compositeOver(base, rendered.grid);
  }
  return { rgba: gridToRgba(base), rendered };
}

function frameSpriteRgba(frame, totalKg, withStage = true) {
  const spec = frameSpecFrom(frame, totalKg);
  return renderComposited(spec, frame.sample.depth, withStage);
}

// ---------------------------------------------------------------------------
// Colours used by the sheets themselves (not sprite palette)
// ---------------------------------------------------------------------------

const INK = [232, 232, 240, 255];
const INK_DIM = [150, 152, 168, 255];
const BG = [14, 14, 20, 255];
const PANEL = [24, 24, 34, 255];
const GRID = [44, 44, 58, 255];
const LIGHT_C = [110, 200, 255, 255];
const MAX_C = [255, 90, 80, 255];

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

function paletteSheet() {
  const SW = 28;
  const PADDING = 12;
  const LABEL_H = 18;
  const cols = BANK_SIZE;
  const w = PADDING * 2 + cols * SW;
  const h = PADDING * 2 + PALETTE_BANKS.length * (SW + LABEL_H) + 40;
  const c = canvas(w, h, BG);

  text(c, 'SPRITE PALETTE - 3 BANKS OF 16, 5 BITS PER CHANNEL', PADDING, PADDING, INK, 2);
  let y = PADDING + 24;

  for (const bank of PALETTE_BANKS) {
    text(c, `${bank.name}  (${bank.colors.length} ALLOCATED)`, PADDING, y, INK_DIM, 2);
    y += LABEL_H;
    for (let slot = 0; slot < BANK_SIZE; slot += 1) {
      const x = PADDING + slot * SW;
      const col = bank.colors[slot];
      if (col === undefined || slot === 0) {
        // Unallocated / transparent: checkerboard, so a hole is obvious.
        for (let j = 0; j < SW - 2; j += 1) {
          for (let i = 0; i < SW - 2; i += 1) {
            const on = ((i >> 2) + (j >> 2)) % 2 === 0;
            px(c, x + i, y + j, on ? [40, 40, 50, 255] : [28, 28, 36, 255]);
          }
        }
      } else {
        const [r, g, b] = rgb5ToRgb8(col);
        rect(c, x, y, SW - 2, SW - 2, [r, g, b, 255]);
      }
      text(c, String(slot), x + 2, y + SW - 10, [0, 0, 0, 255], 1);
      text(c, String(slot), x + 1, y + SW - 11, INK, 1);
    }
    y += SW + 8;
  }
  return c;
}

function poseSheet() {
  const SCALE = 3;
  const keys = Object.keys(POSES);
  const rows = STRAIN.LEVELS;
  const cw = CELL_W * SCALE + 6;
  const ch = CELL_H * SCALE + 22;
  const c = canvas(24 + keys.length * cw, 56 + rows * ch, BG);

  text(c, 'AUTHORED POSES x STRAIN LEVELS  (SAME LOAD ON THE BAR: 180 KG)', 12, 12, INK, 2);
  text(
    c,
    'TIMING REMOVED. IF ONLY THE CLOCK CHANGED WITH LOAD, THESE ROWS WOULD BE IDENTICAL.',
    12,
    30,
    INK_DIM,
    1,
  );

  const anchorDepth = {};
  for (const dir of ['DESCENT', 'ASCENT']) {
    for (const a of POSE_DEPTH_ANCHORS[dir]) {
      if (anchorDepth[a.key] === undefined) anchorDepth[a.key] = { depth: a.depth, dir };
    }
  }

  for (let r = 0; r < rows; r += 1) {
    const y = 48 + r * ch;
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const anchor = anchorDepth[key] ?? { depth: 0, dir: 'DESCENT' };
      const x = 12 + i * cw;
      const spec = {
        depth: anchor.depth,
        direction: anchor.dir,
        strainLevel: r,
        barLateralPx: 0,
        barTiltDeg: 0,
        barBendPx: 0,
        chalkMotes: 0,
        totalKg: 180,
      };
      const { rgba } = renderComposited(spec, anchor.depth);
      blit(c, rgba, CELL_W, CELL_H, x, y, SCALE);
      const strainPct = Math.round(strainForLevel(r) * 100);
      text(c, `${key} S${strainPct}`, x, y + CELL_H * SCALE + 4, INK_DIM, 1);
    }
  }
  return c;
}

function frameSheet(rep, label, totalKg) {
  const SCALE = 3;
  const perRow = 10;
  const cw = CELL_W * SCALE + 6;
  const ch = CELL_H * SCALE + 26;
  const rows = Math.ceil(rep.frames.length / perRow);
  const c = canvas(24 + perRow * cw, 60 + rows * ch, BG);

  text(c, `${label}  -  ${rep.frames.length} FRAMES, ${rep.totalTicks} TICKS`, 12, 12, INK, 2);
  text(
    c,
    'EACH CELL IS ONE DRAWING. THE NUMBER UNDER IT IS HOW MANY 60HZ TICKS IT IS HELD.',
    12,
    32,
    INK_DIM,
    1,
  );

  rep.frames.forEach((frame, i) => {
    const x = 12 + (i % perRow) * cw;
    const y = 52 + Math.floor(i / perRow) * ch;
    const { rgba } = frameSpriteRgba(frame, totalKg);
    blit(c, rgba, CELL_W, CELL_H, x, y, SCALE);
    const hot = frame.holdTicks >= 5 ? MAX_C : INK_DIM;
    text(c, `${i}: ${frame.phase} X${frame.holdTicks}`, x, y + CELL_H * SCALE + 4, hot, 1);
    text(
      c,
      `D${Math.round(frame.poseDepth * 100)} S${frame.strainLevel} B${frame.barBendPx.toFixed(1)}`,
      x,
      y + CELL_H * SCALE + 12,
      INK_DIM,
      1,
    );
  });
  return c;
}

function graphPanel(c, x, y, w, h, title) {
  rect(c, x, y, w, h, PANEL);
  for (let i = 1; i < 4; i += 1) {
    const gy = y + Math.round((h * i) / 4);
    for (let gx = x; gx < x + w; gx += 2) px(c, gx, gy, GRID);
  }
  for (let i = 1; i < 8; i += 1) {
    const gx = x + Math.round((w * i) / 8);
    for (let gy = y; gy < y + h; gy += 2) px(c, gx, gy, GRID);
  }
  text(c, title, x + 4, y + 4, INK, 1);
}

function contactSheet(light, maximal, lightKg, maxKg) {
  const SCALE = 3;
  const CELLS = 8;
  const cw = CELL_W * SCALE + 8;
  const bandH = CELL_H * SCALE + 56;
  const graphH = 210;
  const w = 32 + CELLS * cw;
  const h = 110 + bandH * 2 + graphH + 200;
  const c = canvas(w, h, BG);

  text(c, 'DOES A MAXIMAL ATTEMPT ANIMATE HEAVIER THAN A LIGHT ONE?', 16, 14, INK, 3);
  text(
    c,
    'BOTH ROWS ARE SAMPLED AT THE SAME EIGHT POINTS OF REP PROGRESS, SO DURATION IS DIVIDED OUT.',
    16,
    40,
    INK_DIM,
    2,
  );

  const bands = [
    { rep: light, kg: lightKg, name: 'LIGHT', colour: LIGHT_C },
    { rep: maximal, kg: maxKg, name: 'MAXIMAL', colour: MAX_C },
  ];

  bands.forEach((band, bi) => {
    const y0 = 64 + bi * bandH;
    const stack = visualPlateStack(band.kg);
    const header =
      `${band.name}  ${band.kg}KG  RATIO ${band.rep.loadRatio.toFixed(2)}  ` +
      `${Math.round(band.rep.totalMs)}MS  ${band.rep.frames.length} FRAMES  ` +
      `${stack.perSide.length} PLATES/SIDE`;
    text(c, header, 16, y0, band.colour, 2);

    for (let i = 0; i < CELLS; i += 1) {
      const u = CELLS <= 1 ? 0 : i / (CELLS - 1);
      const tick = Math.min(band.rep.totalTicks - 1, Math.round(u * (band.rep.totalTicks - 1)));
      const frame =
        [...band.rep.frames].reverse().find((f) => f.startTick <= tick) ?? band.rep.frames[0];
      const { rgba } = frameSpriteRgba(frame, band.kg);
      const x = 16 + i * cw;
      blit(c, rgba, CELL_W, CELL_H, x, y0 + 16, SCALE);
      text(c, `${Math.round(u * 100)}% ${frame.phase}`, x, y0 + 18 + CELL_H * SCALE, INK_DIM, 1);
      text(
        c,
        `HOLD ${frame.holdTicks}T BEND ${frame.barBendPx.toFixed(1)} TILT ${frame.barTiltDeg}`,
        x,
        y0 + 26 + CELL_H * SCALE,
        INK_DIM,
        1,
      );
    }
  });

  // --- graphs -------------------------------------------------------------
  const gy = 64 + bandH * 2 + 10;
  const gw = Math.floor((w - 48) / 2);

  // 1. bar height over real time
  graphPanel(c, 16, gy, gw, graphH, 'BAR HEIGHT OVER TIME (MS) - FLAT SECTION IS THE STICKING POINT');
  const maxMs = Math.max(light.totalMs, maximal.totalMs);
  for (const band of bands) {
    let prev = null;
    band.rep.samples.forEach((s) => {
      const gx = 16 + Math.round((s.tick * (1000 / 60) * (gw - 12)) / maxMs) + 6;
      const gyy = gy + graphH - 12 - Math.round((1 - s.depth) * (graphH - 32));
      if (prev) line(c, prev[0], prev[1], gx, gyy, band.colour);
      prev = [gx, gyy];
    });
    text(
      c,
      band.name,
      16 + gw - textW(band.name, 1) - 6,
      gy + 6 + (band.name === 'LIGHT' ? 0 : 8),
      band.colour,
      1,
    );
  }
  text(c, `0`, 20, gy + graphH - 10, INK_DIM, 1);
  text(c, `${Math.round(maxMs)}MS`, 16 + gw - 40, gy + graphH - 10, INK_DIM, 1);

  // 2. sagittal bar path: forward drift vs height
  const px2 = 16 + gw + 16;
  graphPanel(
    c,
    px2,
    gy,
    gw,
    graphH,
    'SAGITTAL BAR PATH - FORWARD DRIFT (X) VS BAR HEIGHT (Y)',
  );
  const maxFwd = Math.max(
    peakForwardDeviationPx(light),
    peakForwardDeviationPx(maximal),
    0.5,
  );
  for (const band of bands) {
    let prev = null;
    band.rep.samples.forEach((s) => {
      const gx = px2 + 24 + Math.round((s.barForwardPx / maxFwd) * (gw - 60));
      const gyy = gy + graphH - 12 - Math.round((1 - s.depth) * (graphH - 32));
      if (prev) line(c, prev[0], prev[1], gx, gyy, band.colour);
      prev = [gx, gyy];
    });
  }
  for (let yy = gy + 14; yy < gy + graphH - 12; yy += 3) px(c, px2 + 24, yy, INK_DIM);
  text(c, `0`, px2 + 20, gy + graphH - 10, INK_DIM, 1);
  text(c, `${maxFwd.toFixed(1)}PX FORWARD`, px2 + gw - 60, gy + graphH - 10, INK_DIM, 1);

  // --- numbers ------------------------------------------------------------
  let ty = gy + graphH + 14;
  text(c, 'MEASURED, NOT ASSERTED:', 16, ty, INK, 2);
  ty += 20;
  const rows = statRows(light, maximal);
  for (const row of rows) {
    let tx = 16;
    tx = text(c, row[0].padEnd(34, ' '), tx, ty, INK_DIM, 2);
    tx = text(c, row[1].padStart(10, ' '), tx + 8, ty, LIGHT_C, 2);
    text(c, row[2].padStart(10, ' '), tx + 8, ty, MAX_C, 2);
    ty += 14;
  }
  return c;
}

function statRows(light, maximal) {
  const f = (n, d = 2) => n.toFixed(d);
  return [
    ['METRIC', 'LIGHT', 'MAXIMAL'],
    ['TOTAL MS', String(Math.round(light.totalMs)), String(Math.round(maximal.totalMs))],
    ['ASCENT SHARE OF REP', f(ascentTickFraction(light)), f(ascentTickFraction(maximal))],
    [
      'ASCENT SHAPE VARIATION',
      f(ascentShapeVariation(light), 3),
      f(ascentShapeVariation(maximal), 3),
    ],
    ['STALL TICKS', String(longestStall(light).ticks), String(longestStall(maximal).ticks)],
    [
      'STALL AT BAR HEIGHT',
      f(longestStall(light).atHeight),
      f(longestStall(maximal).atHeight),
    ],
    ['LONGEST HELD FRAME (TICKS)', String(longestHoldTicks(light)), String(longestHoldTicks(maximal))],
    [
      'LONGEST ASCENT HOLD (TICKS)',
      String(longestAscentHoldTicks(light)),
      String(longestAscentHoldTicks(maximal)),
    ],
    [
      'TICKS AT ONE BAR HEIGHT',
      String(longestAscentPoseRunTicks(light)),
      String(longestAscentPoseRunTicks(maximal)),
    ],
    ['PEAK FORWARD DRIFT PX', f(peakForwardDeviationPx(light)), f(peakForwardDeviationPx(maximal))],
    ['PEAK LATERAL DRIFT PX', f(peakLateralDeviationPx(light)), f(peakLateralDeviationPx(maximal))],
    ['PEAK SLEEVE BEND PX', f(peakBendPx(light)), f(peakBendPx(maximal))],
    ['DISTINCT DRAWINGS USED', String(distinctDrawingCount(light)), String(distinctDrawingCount(maximal))],
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const outFlag = args.indexOf('--out');
const OUT = path.resolve(
  ROOT,
  outFlag === -1 ? '.gauntlet/shots/sprites' : (args[outFlag + 1] ?? '.gauntlet/shots/sprites'),
);

mkdirSync(OUT, { recursive: true });
mkdirSync(path.join(OUT, 'frames/1x'), { recursive: true });
mkdirSync(path.join(OUT, `frames/${RESOLUTION.DEFAULT_UPSCALE}x`), { recursive: true });

function save(name, c) {
  const file = path.join(OUT, name);
  writeFileSync(file, encodePng(c.w, c.h, c.data));
  return { file, w: c.w, h: c.h };
}

/**
 * Bar weights for the two reps. Chosen so the plate stacks read as real meet
 * loads: 100 kg is a 25/10/2.5 per side over a 25 kg bar; 250 kg is four 25s
 * plus a 10 and a 2.5. Neither is a round number of plates by accident.
 */
const LIGHT_KG = 100;
const MAX_KG = 250;

const light = buildSquatRep(LOAD_PRESETS.LIGHT);
const maximal = buildSquatRep(LOAD_PRESETS.MAXIMAL);

const written = [];
written.push(save('palette.png', paletteSheet()));
written.push(save('pose-sheet.png', poseSheet()));
written.push(save('sheet-LIGHT.png', frameSheet(light, `LIGHT ${LIGHT_KG}KG`, LIGHT_KG)));
written.push(save('sheet-MAXIMAL.png', frameSheet(maximal, `MAXIMAL ${MAX_KG}KG`, MAX_KG)));
written.push(save('contact-sheet.png', contactSheet(light, maximal, LIGHT_KG, MAX_KG)));

// Individual frames at 1x and the integer upscale.
const UP = RESOLUTION.DEFAULT_UPSCALE;
for (const [name, rep, kg] of [
  ['light', light, LIGHT_KG],
  ['maximal', maximal, MAX_KG],
]) {
  rep.frames.forEach((frame, i) => {
    const { rgba } = frameSpriteRgba(frame, kg);
    const id = `${name}-${String(i).padStart(2, '0')}-${frame.phase.toLowerCase()}`;
    writeFileSync(path.join(OUT, 'frames/1x', `${id}.png`), encodePng(CELL_W, CELL_H, rgba));
    const up = canvas(CELL_W * UP, CELL_H * UP, [0, 0, 0, 0]);
    blit(up, rgba, CELL_W, CELL_H, 0, 0, UP);
    writeFileSync(path.join(OUT, `frames/${UP}x`, `${id}.png`), encodePng(up.w, up.h, up.data));
  });
}

const summary = {
  out: path.relative(ROOT, OUT),
  cell: `${CELL_W}x${CELL_H}`,
  upscale: UP,
  sheets: written.map((wr) => ({
    file: path.relative(ROOT, wr.file),
    size: `${wr.w}x${wr.h}`,
  })),
  frameFiles: (light.frames.length + maximal.frames.length) * 2,
  stats: Object.fromEntries(statRows(light, maximal).slice(1).map((r) => [r[0], { light: r[1], maximal: r[2] }])),
  paletteBanks: PALETTE_BANKS.map((b) => ({ name: b.name, allocated: b.colors.length })),
  plateStacks: {
    [`${LIGHT_KG}kg`]: visualPlateStack(LIGHT_KG).perSide.map((p) => `${p.spec.kg}${p.spec.hue[0]}`),
    [`${MAX_KG}kg`]: visualPlateStack(MAX_KG).perSide.map((p) => `${p.spec.kg}${p.spec.hue[0]}`),
  },
};
console.log(JSON.stringify(summary, null, 2));
