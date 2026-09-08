#!/usr/bin/env node
/**
 * rekey-empire-art.mjs — strip hot-pink generation-key remnants out of the
 * Iron & Amber owned art, in place, and report what it removed.
 *
 * Claude Code Session B's instrument (CLAUDE.md "Crossing VL-2"). The member
 * and equipment paintings under `public/empire-art/` were generated on a
 * hot-pink key and flood-filled to alpha from the outside
 * (`docs/design/IRON-AMBER-ART-PROVENANCE.md`). A flood fill cannot reach an
 * ENCLOSED region — the panels between a bench's frame members, the gap
 * between an arm and a torso, the patch behind a bar — so those stayed pink
 * and shipped that way: measured at 12% of the flat bench's opaque pixels,
 * 2.4% of the bottom bench-press frame, 1.4% of the serious lifter, 1.5% of
 * the quality bench (`CLAUDE.md`, the VL-2 crossing). This tool keys them.
 *
 * WHAT IT DOES. For each named file: decodes the PNG (`tools/png.mjs`),
 * scores every pixel's PINKNESS — how far the lesser of red and blue sits
 * above green, past a floor no skin, cloth or steel in these paintings
 * reaches — and multiplies alpha by (1 - pinkness). A fully pink pixel goes
 * transparent; a fringe pixel half-blended with pink goes half transparent
 * and keeps its colour, which is how a keyed edge stays soft. Then it
 * re-encodes and writes the file back, printing the remnant count before
 * and after.
 *
 * WHAT IT DELIBERATELY DOES NOT TOUCH. The athlete's kit has a designed
 * magenta accent stripe and the casual member's hoodie trim is warm; a
 * blanket key over every member would eat a real design colour. So this tool
 * runs ONLY on the files named on its command line, and the default list is
 * the four measured remnant carriers. It never touches the scene paintings.
 *
 * Usage: node tools/rekey-empire-art.mjs [--dry-run] [stem ...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

import { decodePng } from './png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'public', 'empire-art');
const DRY_RUN = process.argv.includes('--dry-run');
const DEFAULT_STEMS = [
  'eq-flat-bench',
  'eq-quality-bench',
  'member-using-bench-b-right',
  'member-using-bench-b-left',
  'member-serious-lifter-right',
  'member-serious-lifter-left',
];
const stems = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const targets = stems.length > 0 ? stems : DEFAULT_STEMS;

/**
 * Pinkness in [0, 1]: 0 at or below `FLOOR` above green, 1 at or past
 * `FLOOR + RAMP`. Hot pink (255, 0, 255) scores 1; a maroon singlet
 * (110, 20, 50), a skin tone (220, 160, 120) and steel (80, 80, 90) score 0.
 */
const FLOOR = 40;
const RAMP = 60;
/** Remnant share of opaque pixels above which the file still fails after keying. */
const REMNANT_SHARE_LIMIT = 0.01;
function pinkness(r, g, b) {
  const lesser = Math.min(r, b);
  const above = lesser - g - FLOOR;
  if (above <= 0) return 0;
  return above >= RAMP ? 1 : above / RAMP;
}

function isRemnant(r, g, b, a) {
  return a > 0 && r > 170 && g < 130 && b > 110;
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(typeAndData) >>> 0, 0);
    return Buffer.concat([length, typeAndData, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let exitCode = 0;
for (const stem of targets) {
  const file = join(ART, `${stem}.png`);
  const image = decodePng(readFileSync(file));
  const rgba = Buffer.from(image.rgba);
  const pixels = image.width * image.height;
  let opaqueBefore = 0;
  let remnantBefore = 0;
  let keyed = 0;
  let softened = 0;
  for (let i = 0; i < pixels; i += 1) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const a = rgba[i * 4 + 3];
    if (a > 0) opaqueBefore += 1;
    if (isRemnant(r, g, b, a)) remnantBefore += 1;
    const p = pinkness(r, g, b);
    if (p <= 0 || a === 0) continue;
    const next = Math.round(a * (1 - p));
    if (next === 0) keyed += 1;
    else softened += 1;
    rgba[i * 4 + 3] = next;
  }
  let opaqueAfter = 0;
  let remnantAfter = 0;
  for (let i = 0; i < pixels; i += 1) {
    const a = rgba[i * 4 + 3];
    if (a > 0) opaqueAfter += 1;
    if (isRemnant(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], a)) remnantAfter += 1;
  }
  console.log(
    `${stem.padEnd(30)} ${image.width}x${image.height}  opaque ${opaqueBefore} -> ${opaqueAfter}  remnant ${remnantBefore} (${((100 * remnantBefore) / Math.max(opaqueBefore, 1)).toFixed(2)}%) -> ${remnantAfter} (${((100 * remnantAfter) / Math.max(opaqueAfter, 1)).toFixed(2)}%)  keyed ${keyed} softened ${softened}`,
  );
  // A few dozen fringe pixels along a keyed edge are what a soft key
  // leaves; a region is what this tool exists to remove. One percent of
  // the opaque pixels is the line between them.
  if (remnantAfter > opaqueAfter * REMNANT_SHARE_LIMIT) exitCode = 1;
  if (!DRY_RUN) writeFileSync(file, encodePng(image.width, image.height, rgba));
}
if (DRY_RUN) console.log('dry run — nothing written');
process.exit(exitCode);
