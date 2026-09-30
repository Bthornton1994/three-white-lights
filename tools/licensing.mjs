#!/usr/bin/env node
/**
 * Tier 3 surface inspection harness (GDD §7.3).
 *
 * Renders `src/licensing/renderPanels.ts` straight to PNG so the exact pixels
 * the app draws can be looked at without a browser in the loop (GDD §12.4,
 * "critics inspect real output"). Same approach as `tools/card.mjs`: no npm
 * dependencies, PNG encoded with node:zlib, and the TypeScript sources loaded
 * through Node's built-in type stripping so what is drawn here is the same code
 * the app imports rather than a copy of it.
 *
 * This is NOT a substitute for `tools/shoot.mjs`. It proves the grid; the
 * screenshot harness proves the Skia path that puts the grid on a screen:
 *
 *   bash tools/dev-web.sh
 *   for p in shop character-select; do
 *     node tools/shoot.mjs ".gauntlet/shots/licensing/app-$p.png" \
 *       --url "http://localhost:8081/licensing.html?panel=$p" \
 *       --wait 9000 --sel licensing-panel
 *   done
 *
 * `.gauntlet/shots/` is gitignored, so the PNGs are evidence for whoever runs
 * this and do not travel with the commit — the commands do.
 *
 * Outputs under .gauntlet/shots/licensing/:
 *   shop-1x.png / shop-4x.png                       the sponsored shelf
 *   character-select-1x.png / character-select-4x.png   all four entries
 *   panel-<id>-4x.png                               one panel per entry
 *
 * Usage: node tools/licensing.mjs [--out DIR]
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

const { renderLicensingPanel, renderPanel, LICENSING_PANELS } = await load(
  'src/licensing/renderPanels.ts',
);
const { LICENSING_CATALOGUE } = await load('src/licensing/partners.ts');
const { sheetGridToRgba, findUnallocatedSheetIndices } = await load('src/card/sheetPalette.ts');
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
const OUT = outIndex === -1 ? path.join(ROOT, '.gauntlet/shots/licensing') : process.argv[outIndex + 1];
mkdirSync(OUT, { recursive: true });

function write(name, grid) {
  const bad = findUnallocatedSheetIndices(grid);
  if (bad.length > 0) throw new Error(`${name}: unallocated palette indices ${bad.join(', ')}`);
  const rgba = sheetGridToRgba(grid);
  writeFileSync(path.join(OUT, name), encodePng(grid.w, grid.h, rgba));
  return `${name} ${grid.w}x${grid.h}`;
}

const written = [];
for (const panel of LICENSING_PANELS) {
  const grid = renderLicensingPanel(LICENSING_CATALOGUE, panel);
  written.push(write(`${panel}-1x.png`, grid));
  written.push(write(`${panel}-4x.png`, upscaleGrid(grid, 4)));
}

// One panel per entry, so a drawing can be proofread on its own.
for (const entry of LICENSING_CATALOGUE.entries) {
  for (const slot of ['portrait', 'wordmark', 'product']) {
    const grid = renderPanel({ entry, slot }, 'character-select');
    written.push(write(`panel-${entry.id}-${slot}-4x.png`, upscaleGrid(grid, 4)));
  }
}

console.log(JSON.stringify({ out: OUT, written }, null, 2));
