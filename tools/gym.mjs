#!/usr/bin/env node
/**
 * Gym / environment inspection harness.
 *
 * Renders the environment layer to PNGs so a critic can judge real pixels
 * without running the app (GDD §12.4, "critics inspect real output"), and
 * prints the readability numbers for each frame so the claim and the picture
 * arrive together.
 *
 * Outputs under .gauntlet/shots/gym/:
 *   bank.png                the two background banks as swatches, with the
 *                           lifter's own ramps beside them for comparison
 *   room-training-1x.png    the training gym, native scene resolution
 *   room-training-3x.png    the same, at the upscale the app draws it at
 *   room-meet-1x/3x.png     the meet platform
 *   composite-<depth>.png   THE THING THAT MATTERS: the lifter composited into
 *                           the room at several squat depths, at 1x and 3x
 *   empty-vs-full.png       the room with every prop and light removed, beside
 *                           the room as shipped
 *   readability.json        every number `measureSceneReadability` reports
 *
 * No npm dependencies. PNG is encoded here with node:zlib, and TypeScript is
 * loaded through Node's built-in type stripping, so the pixels a critic sees
 * come from the exact modules the app imports.
 *
 * Usage: node tools/gym.mjs [--out DIR]
 */

import { registerHooks } from 'node:module';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import zlib from 'node:zlib';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (relative && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        const url = new URL(`${specifier}.ts`, context.parentURL ?? import.meta.url);
        if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
      } catch {
        /* fall through */
      }
    }
    return nextResolve(specifier, context);
  },
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const art = await import(pathToFileURL(path.join(ROOT, 'src/art/index.ts')).href);

const {
  BANK_SIZE,
  GYM,
  GYM_BANKS,
  GYM_LIFT_STAGE,
  GYM_PROPS_TRAINING,
  PALETTE_BANKS,
  RESOLUTION,
  blitOver,
  buildSquatRep,
  clearBand,
  createGrid,
  frameSpecFrom,
  formatReadability,
  gridToRgba,
  liftStageScene,
  measureSceneReadability,
  propBox,
  renderGymScene,
  renderLifterFrame,
  rgb5ToRgb8,
  sceneColorAt,
  setPx,
  upscaleGrid,
} = art;

const args = process.argv.slice(2);
const flagOf = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};
const OUT = path.resolve(ROOT, flagOf('out', '.gauntlet/shots/gym'));

// ---------------------------------------------------------------------------
// PNG (node:zlib only)
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
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function writeGrid(file, grid) {
  const rgba = gridToRgba(grid, sceneColorAt);
  writeFileSync(path.join(OUT, file), encodePng(grid.w, grid.h, rgba));
  return file;
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const UP = GYM_LIFT_STAGE.SCALE;
const written = [];

for (const venue of ['training-gym', 'meet-platform']) {
  const spec = { ...liftStageScene(0), venue };
  const grid = renderGymScene(spec);
  written.push(writeGrid(`room-${venue}-1x.png`, grid));
  written.push(writeGrid(`room-${venue}-${UP}x.png`, upscaleGrid(grid, UP)));
}

// --- the composite: the room with the lifter standing in it -----------------
const rep = buildSquatRep(art.LOAD_PRESETS.MAXIMAL);
const frames = rep.frames;
const pick = (frac) => frames[Math.min(frames.length - 1, Math.round((frames.length - 1) * frac))];
const MOMENTS = [
  ['standing', 0],
  ['descent', 0.25],
  ['hole', 0.5],
  ['drive', 0.7],
];

const report = {};
for (const [name, frac] of MOMENTS) {
  const frame = pick(frac);
  const spec = liftStageScene(0);
  const scene = renderGymScene(spec);
  const totalKg = 250;
  const { grid: sprite } = renderLifterFrame(frameSpecFrom(frame, totalKg));
  const composite = blitOver(scene, sprite, GYM_LIFT_STAGE.SPRITE_X, GYM_LIFT_STAGE.SPRITE_Y);
  written.push(writeGrid(`composite-${name}-1x.png`, composite));
  written.push(writeGrid(`composite-${name}-${UP}x.png`, upscaleGrid(composite, UP)));
  const r = measureSceneReadability(composite);
  report[name] = r;
  console.log(`\n--- ${name} ---\n${formatReadability(r)}`);
}

// --- the same figure, in the meet venue -------------------------------------
{
  const spec = { ...liftStageScene(0), venue: 'meet-platform' };
  const scene = renderGymScene(spec);
  const { grid: sprite } = renderLifterFrame(frameSpecFrom(pick(0), 250));
  const composite = blitOver(scene, sprite, GYM_LIFT_STAGE.SPRITE_X, GYM_LIFT_STAGE.SPRITE_Y);
  written.push(writeGrid(`composite-meet-${UP}x.png`, upscaleGrid(composite, UP)));
  const r = measureSceneReadability(composite);
  report['meet'] = r;
  console.log(`\n--- meet platform ---\n${formatReadability(r)}`);
}

// --- with the environment deleted, for comparison ---------------------------
{
  const spec = liftStageScene(0);
  const flat = createGrid(spec.w, spec.h, GYM.WALL_DEEP);
  const frame = pick(0.5);
  const { grid: sprite } = renderLifterFrame(frameSpecFrom(frame, 250));
  const composite = blitOver(flat, sprite, GYM_LIFT_STAGE.SPRITE_X, GYM_LIFT_STAGE.SPRITE_Y);
  written.push(writeGrid(`no-environment-${UP}x.png`, upscaleGrid(composite, UP)));
  const r = measureSceneReadability(composite);
  report['no-environment'] = r;
  console.log(`\n--- no environment (flat fill) ---\n${formatReadability(r)}`);
}

// --- the reserved band, drawn, so the composition rule is visible -----------
{
  const spec = liftStageScene(0);
  const grid = renderGymScene(spec);
  const band = clearBand(spec, RESOLUTION.LIFTER_HEIGHT_PX);
  for (let x = band.x0; x <= band.x1; x += 1) {
    setPx(grid, x, band.y0, GYM.LAMP_CORE);
    setPx(grid, x, band.y1, GYM.LAMP_CORE);
  }
  for (let y = band.y0; y <= band.y1; y += 1) {
    setPx(grid, band.x0, y, GYM.LAMP_CORE);
    setPx(grid, band.x1, y, GYM.LAMP_CORE);
  }
  for (const placement of GYM_PROPS_TRAINING) {
    const box = propBox(spec, placement);
    for (let x = box.x0; x <= box.x1; x += 1) {
      setPx(grid, x, box.y0, GYM.CHALK_DUST);
      setPx(grid, x, box.y1, GYM.CHALK_DUST);
    }
  }
  written.push(writeGrid(`clear-band-${UP}x.png`, upscaleGrid(grid, UP)));
}

// --- palette swatches -------------------------------------------------------
{
  const SW = 10;
  const banks = [...PALETTE_BANKS, ...GYM_BANKS];
  const grid = createGrid(BANK_SIZE * SW, banks.length * SW);
  banks.forEach((bank, b) => {
    for (let slot = 0; slot < BANK_SIZE; slot += 1) {
      const index = b * BANK_SIZE + slot;
      for (let y = 0; y < SW; y += 1) {
        for (let x = 0; x < SW; x += 1) setPx(grid, slot * SW + x, b * SW + y, index);
      }
    }
  });
  written.push(writeGrid('bank.png', upscaleGrid(grid, 2)));

  const luma = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
  console.log('\n--- bank luma ---');
  banks.forEach((bank, b) => {
    const row = bank.colors
      .map((c, slot) => (slot === 0 ? null : `${slot}:${luma(rgb5ToRgb8(c)).toFixed(0)}`))
      .filter(Boolean)
      .join(' ');
    console.log(`${bank.name.padEnd(10)} ${row}`);
  });
}

writeFileSync(path.join(OUT, 'readability.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nwrote ${written.length + 1} files to ${OUT}`);
