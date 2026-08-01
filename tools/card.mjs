#!/usr/bin/env node
/**
 * Result-card inspection harness.
 *
 * Renders `src/card/renderResultCard.ts` straight to PNG so the exact pixels
 * the app draws can be looked at without a browser in the loop (GDD §12.4,
 * "critics inspect real output"). Same approach as `tools/sprites.mjs`: no npm
 * dependencies, PNG encoded with node:zlib, and the TypeScript sources loaded
 * through Node's built-in type stripping so what is drawn here is the same code
 * the app imports rather than a copy of it.
 *
 * This is NOT a substitute for `tools/shoot.mjs`. It proves the grid; the
 * screenshot harness proves the Skia path that puts the grid on a screen.
 *
 * Outputs under .gauntlet/shots/card/:
 *   strong-1x.png / strong-4x.png     a lifter who totalled and placed
 *   bombed-1x.png / bombed-4x.png     a lifter who bombed a lift
 *   sheet.png                         both cards side by side at 2x
 *
 * Usage: node tools/card.mjs [--out DIR]
 */

import { registerHooks } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const { renderResultCard } = await load('src/card/renderResultCard.ts');
const { sheetGridToRgba, findUnallocatedSheetIndices } = await load('src/card/sheetPalette.ts');
const { CARD } = await load('src/card/cardTuning.ts');
const { STRONG_MEET_CARD, BOMBED_MEET_CARD } = await load('src/card/sampleCards.ts');
const { upscaleGrid } = await load('src/art/raster.ts');

// --- PNG (node:zlib only) ---------------------------------------------------

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

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
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

// --- Render -----------------------------------------------------------------

const outIndex = process.argv.indexOf('--out');
const OUT = outIndex === -1 ? path.join(ROOT, '.gauntlet/shots/card') : process.argv[outIndex + 1];
mkdirSync(OUT, { recursive: true });

function write(name, grid) {
  const rgba = sheetGridToRgba(grid);
  writeFileSync(path.join(OUT, name), encodePng(grid.w, grid.h, rgba));
  return `${name} ${grid.w}x${grid.h}`;
}

const cards = [
  ['strong', STRONG_MEET_CARD],
  ['bombed', BOMBED_MEET_CARD],
];

const written = [];
for (const [name, card] of cards) {
  const grid = renderResultCard(card);
  const bad = findUnallocatedSheetIndices(grid);
  if (bad.length > 0) throw new Error(`${name}: unallocated palette indices ${bad.join(', ')}`);
  written.push(write(`${name}-1x.png`, grid));
  written.push(write(`${name}-4x.png`, upscaleGrid(grid, 4)));
}

// Both at 2x side by side, which is the size the phone shows one at.
const pair = { w: CARD.W * 4 + 12, h: CARD.H * 2 + 8, data: new Uint8Array((CARD.W * 4 + 12) * (CARD.H * 2 + 8)) };
for (const [i, [, card]] of cards.entries()) {
  const scaled = upscaleGrid(renderResultCard(card), 2);
  const ox = 4 + i * (CARD.W * 2 + 4);
  for (let y = 0; y < scaled.h; y += 1) {
    for (let x = 0; x < scaled.w; x += 1) {
      pair.data[(y + 4) * pair.w + (x + ox)] = scaled.data[y * scaled.w + x];
    }
  }
}
written.push(write('sheet.png', pair));

console.log(JSON.stringify({ out: OUT, written }, null, 2));
