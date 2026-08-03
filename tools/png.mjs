#!/usr/bin/env node
/**
 * A PNG decoder, and the pixel comparisons `verify-lift-shots.mjs` is built on.
 *
 * WHY THIS IS HAND-WRITTEN RATHER THAN AN npm PACKAGE. `tools/sprites.mjs` and
 * `tools/card.mjs` already ENCODE PNGs with nothing but `node:zlib`, and the
 * decode direction is the same three ideas backwards: inflate the IDAT stream,
 * undo the five per-scanline filters, read out samples. The screenshots this
 * has to open come from one producer (Chromium via Playwright) and are always
 * 8-bit non-interlaced truecolour. A dependency would be more code in the tree,
 * not less, and it would be the one piece of the verifier nobody in this repo
 * could read. The round-trip self-test at the bottom of
 * `verify-lift-shots.selftest.mjs` is what keeps that decision honest: it
 * encodes known pixels under every filter type and asserts this file reads them
 * back exactly.
 *
 * The decoder REFUSES formats it does not fully implement rather than guessing.
 * A verifier that silently mis-decodes is worse than one that does not decode
 * at all, because it produces confident numbers about pixels that were never
 * there.
 */
import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Bytes per pixel for each PNG colour type, at 8 bits per sample. */
const CHANNELS_BY_COLOUR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * @typedef {object} DecodedImage
 * @property {number} width
 * @property {number} height
 * @property {Uint8Array} rgba  width*height*4, straight (non-premultiplied) RGBA.
 */

/**
 * Decode a PNG buffer to RGBA.
 *
 * Supports 8-bit greyscale, truecolour, indexed and their alpha variants,
 * non-interlaced. Throws on anything else.
 *
 * @param {Buffer} buffer
 * @returns {DecodedImage}
 */
export function decodePng(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('not a PNG (bad signature)');
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colourType = 0;
  let interlace = 0;
  let palette = null;
  let paletteAlpha = null;
  const idat = [];

  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colourType = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') {
      palette = Buffer.from(data);
    } else if (type === 'tRNS') {
      paletteAlpha = Buffer.from(data);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
  }

  if (width <= 0 || height <= 0) throw new Error('PNG has no IHDR');
  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth} (only 8 is decoded)`);
  if (interlace !== 0) throw new Error('unsupported interlaced PNG');
  const channels = CHANNELS_BY_COLOUR_TYPE[colourType];
  if (channels === undefined) throw new Error(`unsupported PNG colour type ${colourType}`);
  if (colourType === 3 && palette === null) throw new Error('indexed PNG with no PLTE');
  if (idat.length === 0) throw new Error('PNG has no IDAT');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) {
    throw new Error(`PNG IDAT is short: ${raw.length} bytes for ${(stride + 1) * height}`);
  }

  const lines = unfilter(raw, width, height, channels);
  return { width, height, rgba: toRgba(lines, width, height, colourType, channels, palette, paletteAlpha) };
}

/**
 * Undo the per-scanline filters. Returns the concatenated unfiltered scanlines,
 * `width * channels` bytes each, with the filter-type bytes removed.
 *
 * @param {Buffer} raw
 * @param {number} width
 * @param {number} height
 * @param {number} channels
 * @returns {Uint8Array}
 */
function unfilter(raw, width, height, channels) {
  const stride = width * channels;
  const out = new Uint8Array(stride * height);
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[src];
    src += 1;
    const line = y * stride;
    const prev = line - stride;
    for (let i = 0; i < stride; i += 1) {
      const x = raw[src + i];
      const a = i >= channels ? out[line + i - channels] : 0;
      const b = y > 0 ? out[prev + i] : 0;
      const c = y > 0 && i >= channels ? out[prev + i - channels] : 0;
      let value;
      switch (filter) {
        case 0:
          value = x;
          break;
        case 1:
          value = x + a;
          break;
        case 2:
          value = x + b;
          break;
        case 3:
          value = x + ((a + b) >> 1);
          break;
        case 4:
          value = x + paeth(a, b, c);
          break;
        default:
          throw new Error(`unknown PNG filter type ${filter} on row ${y}`);
      }
      out[line + i] = value & 0xff;
    }
    src += stride;
  }
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function toRgba(lines, width, height, colourType, channels, palette, paletteAlpha) {
  const rgba = new Uint8Array(width * height * 4);
  const count = width * height;
  for (let i = 0; i < count; i += 1) {
    const s = i * channels;
    const d = i * 4;
    switch (colourType) {
      case 0:
        rgba[d] = lines[s];
        rgba[d + 1] = lines[s];
        rgba[d + 2] = lines[s];
        rgba[d + 3] = 255;
        break;
      case 2:
        rgba[d] = lines[s];
        rgba[d + 1] = lines[s + 1];
        rgba[d + 2] = lines[s + 2];
        rgba[d + 3] = 255;
        break;
      case 3: {
        const p = lines[s] * 3;
        rgba[d] = palette[p];
        rgba[d + 1] = palette[p + 1];
        rgba[d + 2] = palette[p + 2];
        rgba[d + 3] = paletteAlpha === null || lines[s] >= paletteAlpha.length ? 255 : paletteAlpha[lines[s]];
        break;
      }
      case 4:
        rgba[d] = lines[s];
        rgba[d + 1] = lines[s];
        rgba[d + 2] = lines[s];
        rgba[d + 3] = lines[s + 1];
        break;
      default:
        rgba[d] = lines[s];
        rgba[d + 1] = lines[s + 1];
        rgba[d + 2] = lines[s + 2];
        rgba[d + 3] = lines[s + 3];
        break;
    }
  }
  return rgba;
}

// ---------------------------------------------------------------------------
// Pixel comparisons
// ---------------------------------------------------------------------------

/**
 * A rectangle of pixels, in device pixels of a decoded image.
 *
 * @typedef {object} Region
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 */

/**
 * A circular hole punched out of a region, in device pixels.
 *
 * @typedef {object} Hole
 * @property {number} cx
 * @property {number} cy
 * @property {number} r
 */

/**
 * True when (x, y) is inside any of `holes`.
 *
 * @param {readonly Hole[]} holes
 * @param {number} x
 * @param {number} y
 */
function inAnyHole(holes, x, y) {
  for (const hole of holes) {
    const dx = x - hole.cx;
    const dy = y - hole.cy;
    if (dx * dx + dy * dy <= hole.r * hole.r) return true;
  }
  return false;
}

/**
 * Number of pixels that differ between two images inside `region`, ignoring any
 * pixel inside `holes` and any difference smaller than `tolerance` on every
 * channel.
 *
 * The tolerance exists because a screenshot of a GPU canvas is not
 * bit-reproducible across runs; it must stay far below the difference an
 * authored pose change makes, and the tuning constants say so where they live.
 *
 * @param {DecodedImage} a
 * @param {DecodedImage} b
 * @param {Region} region
 * @param {{ tolerance?: number, holes?: readonly Hole[] }} [options]
 * @returns {{ differing: number, total: number, maxChannelDelta: number }}
 */
export function diffPixels(a, b, region, options = {}) {
  const tolerance = options.tolerance ?? 0;
  const holes = options.holes ?? [];
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`image sizes differ: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  assertRegionFits(a, region);
  let differing = 0;
  let total = 0;
  let maxChannelDelta = 0;
  for (let y = region.y; y < region.y + region.h; y += 1) {
    for (let x = region.x; x < region.x + region.w; x += 1) {
      if (inAnyHole(holes, x, y)) continue;
      total += 1;
      const i = (y * a.width + x) * 4;
      let delta = 0;
      for (let c = 0; c < 4; c += 1) {
        const d = Math.abs(a.rgba[i + c] - b.rgba[i + c]);
        if (d > delta) delta = d;
      }
      if (delta > maxChannelDelta) maxChannelDelta = delta;
      if (delta > tolerance) differing += 1;
    }
  }
  return { differing, total, maxChannelDelta };
}

/**
 * The set of pixels inside `region` that are NOT the background colour, as a
 * bounding box plus a count. This is the drawn silhouette of whatever occupies
 * the region.
 *
 * @param {DecodedImage} image
 * @param {Region} region
 * @param {readonly [number, number, number]} background
 * @param {{ tolerance?: number, holes?: readonly Hole[] }} [options]
 * @returns {{ count: number, minX: number, maxX: number, minY: number, maxY: number }}
 */
export function silhouette(image, region, background, options = {}) {
  const tolerance = options.tolerance ?? 0;
  const holes = options.holes ?? [];
  assertRegionFits(image, region);
  let count = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = region.y; y < region.y + region.h; y += 1) {
    for (let x = region.x; x < region.x + region.w; x += 1) {
      if (inAnyHole(holes, x, y)) continue;
      const i = (y * image.width + x) * 4;
      const delta = Math.max(
        Math.abs(image.rgba[i] - background[0]),
        Math.abs(image.rgba[i + 1] - background[1]),
        Math.abs(image.rgba[i + 2] - background[2]),
      );
      if (delta <= tolerance) continue;
      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { count, minX, maxX, minY, maxY };
}

/**
 * The most common colour inside `region`, as `[r, g, b]`. Used to READ the
 * background off a captured frame instead of restating a palette value that
 * could drift.
 *
 * @param {DecodedImage} image
 * @param {Region} region
 * @returns {[number, number, number]}
 */
export function dominantColour(image, region) {
  assertRegionFits(image, region);
  const counts = new Map();
  for (let y = region.y; y < region.y + region.h; y += 1) {
    for (let x = region.x; x < region.x + region.w; x += 1) {
      const i = (y * image.width + x) * 4;
      const key = (image.rgba[i] << 16) | (image.rgba[i + 1] << 8) | image.rgba[i + 2];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let best = 0;
  let bestCount = -1;
  for (const [key, n] of counts) {
    if (n > bestCount) {
      best = key;
      bestCount = n;
    }
  }
  return [(best >> 16) & 0xff, (best >> 8) & 0xff, best & 0xff];
}

function assertRegionFits(image, region) {
  if (
    region.x < 0 ||
    region.y < 0 ||
    region.w <= 0 ||
    region.h <= 0 ||
    region.x + region.w > image.width ||
    region.y + region.h > image.height
  ) {
    throw new Error(
      `region ${region.x},${region.y} ${region.w}x${region.h} does not fit in ` +
        `${image.width}x${image.height} — the capture geometry is not what the verifier expects`,
    );
  }
}

/**
 * Scale a region expressed in logical points into device pixels.
 *
 * @param {Region} region
 * @param {number} scale
 * @returns {Region}
 */
export function scaleRegion(region, scale) {
  return {
    x: Math.round(region.x * scale),
    y: Math.round(region.y * scale),
    w: Math.round(region.w * scale),
    h: Math.round(region.h * scale),
  };
}

/**
 * Scale a hole expressed in logical points into device pixels.
 *
 * @param {Hole} hole
 * @param {number} scale
 * @returns {Hole}
 */
export function scaleHole(hole, scale) {
  return { cx: hole.cx * scale, cy: hole.cy * scale, r: hole.r * scale };
}
