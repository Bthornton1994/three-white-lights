/**
 * bake-member-motion.mjs — VL-3's bake: rasterises `src/empire/memberRig.ts`'s
 * posed cut-out puppet into one frame strip per clip under `public/empire-art/`
 * and writes the contact sheets a critic looks at under
 * `docs/design/living-gym-world/vl-3/`. Claude Code Session B's tool
 * (CLAUDE.md, "VL-3").
 *
 * No npm dependencies. PNGs are decoded with `tools/png.mjs` and encoded here
 * with `node:zlib`. The TypeScript rig and puppet are loaded through Node's
 * built-in type stripping plus the same resolve hook `tools/sprites.mjs`
 * uses, so the frames a critic sees are posed by the exact modules the tests
 * grade — not a JS copy.
 *
 * WHAT IS DECIDED HERE AND WHAT IS NOT. Every pose — which part sits where,
 * rotated by how much, which foot is planted, how far the root advanced — is
 * the rig's (`memberRigClip`). This tool only samples pixels: for each part in
 * draw order it inverse-maps every canvas pixel of the part's transformed
 * bounding box back to the source painting, bilinearly samples the part's
 * cut (the source masked to the part's polygons, with its occlusion fills,
 * far-limb shade and the presser's tank recolour applied first), and
 * alpha-composites premultiplied. The strip is `frames` such canvases side
 * by side, `MEMBER_MOTION_CANVAS_PX` square each, named by
 * `memberMotionStripStem`.
 *
 * THE RECOLOUR, AND ITS LIMIT. The presser painting wears a black tank; the
 * walker a beige tee. Inside `PRESSER.recolour.polygon` every pixel that is
 * not lit skin (see `PuppetRecolour.skin`) is QUANTILE-MATCHED onto the tee:
 * ranked by luminance among the tank's pixels and given the tee pixel at
 * the same rank, the tee being every cloth-classified pixel inside
 * `recolour.reference.polygons` of the walker painting. So the tank carries
 * the tee's measured colours and the tee's own contrast range, with no
 * authored colour pair; the bake prints the tenth and fiftieth percentiles
 * of both distributions and writes them to `member-motion-measurements.json`.
 * What it cannot do: tell a dark fabric fold from dark skin in shadow that
 * falls inside the polygon (both are dark and the classifier only spares
 * LIT skin), so the polygon has to be tight, and it is hand-read; the
 * shorts stay black because the polygon stops at the waist, and the waist
 * line is an authored guess on a painting where both garments are black.
 * The tank's own shading is ~100 luminance levels wide and the tee's ~140,
 * so the match expands contrast a little and the noise with it. Stated here
 * rather than hidden; the reassembled-rest sheet shows it beside the
 * untouched painting.
 *
 * THE DISSOLVE MEASUREMENT. For each edge in `MEMBER_MOTION_DISSOLVE_EDGES`
 * the bake overlays the outgoing clip's last frame and the incoming clip's
 * first at 50% each (`sheet-dissolve.png`) and prints the intersection over
 * union of their opaque masks, twice: over the whole frame, and with the
 * presser's bar and plates left out (the walker has no bar to match, so
 * the second number is the ceiling the poses are working against). The
 * whole-frame IoU is what `memberRig.test.ts` pins.
 *
 * THE PHONE-SIZE BREATH. The idle's rest frame (0) and full-inhale frame
 * (half way round) are box-downsampled to `FLOOR_MEMBER_MOTION_PHONE_BODY_PX`
 * tall and the fraction of body pixels whose composited colour moves by
 * more than `BREATH_DIFF_LEVELS` is printed and written; the test pins it
 * above `FLOOR_MEMBER_MOTION_IDLE_BREATH_VISIBLE_FRACTION`. A pixel-count
 * threshold is a coarse stand-in for legibility, stated as such.
 *
 * DETERMINISM. No clock, no random source, no timestamp in any chunk; the
 * same tree bakes byte-identical files. `--check` bakes into memory and
 * compares against what is on disk instead of writing.
 *
 * Outputs:
 *   public/empire-art/member-motion-<type>-<clip>.png       one strip per clip
 *   docs/design/living-gym-world/vl-3/sheet-<clip>.png       frames in a row at 1× (the walk also at 3×)
 *   docs/design/living-gym-world/vl-3/sheet-all-clips.png    every clip, one row each
 *   docs/design/living-gym-world/vl-3/onion-walk.png         every walk frame overlaid in the world frame, planted balls marked
 *   docs/design/living-gym-world/vl-3/parts-<puppet>.png     the exploded part atlas, pivots and tips marked
 *   docs/design/living-gym-world/vl-3/rest-<puppet>.png      painting | reassembled at rest | uncovered pixels in red
 *   docs/design/living-gym-world/vl-3/sheet-dissolve.png     each dissolve edge: outgoing | incoming | both at 50%, IoU captioned
 *   docs/design/living-gym-world/vl-3/sheet-phone-idle.png   the idle's rest and peak frames at phone size, 4×
 *   docs/design/living-gym-world/vl-3/member-motion-metadata.json  `memberRigMetadata()`
 *   docs/design/living-gym-world/vl-3/member-motion-measurements.json  dissolve IoUs, breath legibility, recolour percentiles
 *
 * Usage: node tools/bake-member-motion.mjs [--check]
 */

import { registerHooks } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import zlib from 'node:zlib';
import { decodePng } from './png.mjs';

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
const ART_DIR = path.join(ROOT, 'public', 'empire-art');
const SHEET_DIR = path.join(ROOT, 'docs', 'design', 'living-gym-world', 'vl-3');
const CHECK = process.argv.includes('--check');

const rig = await import(pathToFileURL(path.join(ROOT, 'src/empire/memberRig.ts')).href);
const puppetModule = await import(pathToFileURL(path.join(ROOT, 'src/empire/memberPuppet.ts')).href);
const clipsModule = await import(pathToFileURL(path.join(ROOT, 'src/empire/memberMotionClips.ts')).href);
const tuningModule = await import(pathToFileURL(path.join(ROOT, 'src/empire/empireTuning.ts')).href);

const { PUPPETS } = puppetModule;
const { MEMBER_MOTION_CLIPS, MEMBER_MOTION_CANVAS_PX, MEMBER_MOTION_PRODUCTION_TYPES, MEMBER_MOTION_DISSOLVE_EDGES, memberMotionStripStem } =
  clipsModule;
const { EMPIRE_TUNING } = tuningModule;

// Sheet layout only — not game-facing, not a feel value: how the evidence is
// laid out for a human to read, never anything the app draws.
const SHEET_GAP = 6;
const SHEET_MARGIN = 10;
const WALK_ZOOM = 3;
const ONION_ALPHA = 0.22;
const CHECKER = [216, 216, 216, 236, 236, 236];
const CHECKER_CELL = 16;
const LABEL_RGB = [200, 30, 30];
const MARK_RGB = [30, 120, 255];
const UNCOVERED_RGB = [255, 0, 0];
const DISSOLVE_ZOOM = 2;
const PHONE_ZOOM = 4;
/** Alpha at or above which a frame pixel counts as opaque for the dissolve masks. */
const MASK_ALPHA = 128;
/** Levels (of 255, composited over mid grey) a phone-size pixel must move by to count as changed. */
const BREATH_DIFF_LEVELS = 16;
const MID_GREY = 128;

const CANVAS = MEMBER_MOTION_CANVAS_PX;

// ---------------------------------------------------------------------------
// Images: premultiplied float RGBA buffers
// ---------------------------------------------------------------------------

function makeImage(width, height) {
  return { width, height, data: new Float32Array(width * height * 4) };
}

function fromDecoded(decoded) {
  const img = makeImage(decoded.width, decoded.height);
  for (let i = 0; i < decoded.width * decoded.height; i += 1) {
    const a = decoded.rgba[i * 4 + 3] / 255;
    img.data[i * 4] = (decoded.rgba[i * 4] / 255) * a;
    img.data[i * 4 + 1] = (decoded.rgba[i * 4 + 1] / 255) * a;
    img.data[i * 4 + 2] = (decoded.rgba[i * 4 + 2] / 255) * a;
    img.data[i * 4 + 3] = a;
  }
  return img;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Mean of RGB. */
function luminance(rgba, i) {
  return (rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3;
}

/**
 * The reference garment's pixels sorted by luminance: every opaque pixel of
 * `reference.source` inside its polygons that passes the cloth classifier.
 */
function referenceCloth(decoded, reference) {
  const out = [];
  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      const i = (y * decoded.width + x) * 4;
      if (decoded.rgba[i + 3] < MASK_ALPHA) continue;
      if (!reference.polygons.some((polygon) => pointInPolygon(x + 0.5, y + 0.5, polygon))) continue;
      const r = decoded.rgba[i];
      const b = decoded.rgba[i + 2];
      const l = luminance(decoded.rgba, i);
      if (b < reference.cloth.minBlueOverRed * r || l < reference.cloth.minLuminance) continue;
      out.push({ l, rgb: [r, decoded.rgba[i + 1], b] });
    }
  }
  out.sort((a, b) => a.l - b.l);
  return out;
}

/** The colour at quantile q (0..1) of a luminance-sorted pixel list. */
function quantileColour(sorted, q) {
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.round(q * (sorted.length - 1))))].rgb;
}

/**
 * Straight-alpha copy of a source with the puppet's recolour applied by
 * quantile matching (see the header). Returns the copy and the percentiles
 * the report quotes.
 */
function recoloured(decoded, recolour, references) {
  const out = new Uint8Array(decoded.rgba);
  if (recolour === undefined) return { image: { width: decoded.width, height: decoded.height, rgba: out }, report: null };
  const cloth = referenceCloth(references[recolour.reference.source], recolour.reference);
  if (cloth.length === 0) throw new Error('the reference garment classified no pixels');
  // The target: every non-skin pixel in the polygon, keyed by its RGB sum
  // so equal luminances share one rank (the mid-rank of their bin).
  const targets = [];
  const histogram = new Uint32Array(3 * 255 + 1);
  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      const i = (y * decoded.width + x) * 4;
      if (out[i + 3] === 0) continue;
      if (!pointInPolygon(x + 0.5, y + 0.5, recolour.polygon)) continue;
      const l = luminance(out, i);
      if (out[i] - out[i + 2] >= recolour.skin.minChroma && l >= recolour.skin.minLuminance) continue;
      const sum = out[i] + out[i + 1] + out[i + 2];
      histogram[sum] += 1;
      targets.push({ i, sum });
    }
  }
  const n = targets.length;
  if (n === 0) throw new Error('the recolour polygon holds no pixels');
  const below = new Float64Array(histogram.length);
  let running = 0;
  for (let sum = 0; sum < histogram.length; sum += 1) {
    below[sum] = running;
    running += histogram[sum];
  }
  const quantileOf = (sum) => (below[sum] + histogram[sum] / 2) / n;
  for (const { i, sum } of targets) {
    const rgb = quantileColour(cloth, quantileOf(sum));
    out[i] = rgb[0];
    out[i + 1] = rgb[1];
    out[i + 2] = rgb[2];
  }
  const sourceAt = (q) => {
    // The target's own colour at quantile q: the first bin whose cumulative share reaches q, averaged.
    let acc = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    let bin = 0;
    for (; bin < histogram.length; bin += 1) {
      acc += histogram[bin];
      if (acc / n >= q) break;
    }
    for (const { i, sum } of targets) {
      if (sum !== bin) continue;
      r += decoded.rgba[i];
      g += decoded.rgba[i + 1];
      b += decoded.rgba[i + 2];
      count += 1;
    }
    return count === 0 ? null : [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
  };
  const report = {
    referencePixels: cloth.length,
    targetPixels: n,
    reference: { p10: quantileColour(cloth, 0.1), p50: quantileColour(cloth, 0.5), p90: quantileColour(cloth, 0.9) },
    targetBefore: { p10: sourceAt(0.1), p50: sourceAt(0.5), p90: sourceAt(0.9) },
  };
  return { image: { width: decoded.width, height: decoded.height, rgba: out }, report };
}

/**
 * A part's cut: the source masked to the part's polygons, occlusion fills
 * applied, far-limb shade applied. Premultiplied.
 */
function cutPart(source, part, farShade) {
  const { width, height } = source;
  const mask = new Uint8Array(width * height);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (const polygon of part.polygons) {
    for (const [px, py] of polygon) {
      minX = Math.min(minX, Math.floor(px));
      minY = Math.min(minY, Math.floor(py));
      maxX = Math.max(maxX, Math.ceil(px));
      maxY = Math.max(maxY, Math.ceil(py));
    }
  }
  for (let y = Math.max(0, minY); y < Math.min(height, maxY + 1); y += 1) {
    for (let x = Math.max(0, minX); x < Math.min(width, maxX + 1); x += 1) {
      for (const polygon of part.polygons) {
        if (pointInPolygon(x + 0.5, y + 0.5, polygon)) {
          mask[y * width + x] = 1;
          break;
        }
      }
    }
  }
  const straight = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    if (mask[i] === 0) continue;
    straight[i * 4] = source.rgba[i * 4];
    straight[i * 4 + 1] = source.rgba[i * 4 + 1];
    straight[i * 4 + 2] = source.rgba[i * 4 + 2];
    straight[i * 4 + 3] = source.rgba[i * 4 + 3];
  }
  for (const fill of part.fills ?? []) {
    const [x0, y0, x1, y1] = fill.rect;
    for (let y = y0; y < y1; y += 1) {
      let sx = fill.from === 'left' ? x0 - 1 : x1;
      const step = fill.from === 'left' ? -1 : 1;
      while (sx >= 0 && sx < width && (mask[y * width + sx] === 0 || straight[(y * width + sx) * 4 + 3] < 128)) sx += step;
      if (sx < 0 || sx >= width) continue;
      for (let x = x0; x < x1; x += 1) {
        const from = (y * width + sx) * 4;
        const to = (y * width + x) * 4;
        mask[y * width + x] = 1;
        straight[to] = straight[from];
        straight[to + 1] = straight[from + 1];
        straight[to + 2] = straight[from + 2];
        straight[to + 3] = straight[from + 3];
      }
    }
  }
  const shade = part.far === true ? farShade : 1;
  const img = makeImage(width, height);
  for (let i = 0; i < width * height; i += 1) {
    const a = straight[i * 4 + 3] / 255;
    img.data[i * 4] = (straight[i * 4] / 255) * a * shade;
    img.data[i * 4 + 1] = (straight[i * 4 + 1] / 255) * a * shade;
    img.data[i * 4 + 2] = (straight[i * 4 + 2] / 255) * a * shade;
    img.data[i * 4 + 3] = a;
  }
  return { image: img, bounds: { minX, minY, maxX, maxY } };
}

/** Bilinear sample of a premultiplied image at (x, y); outside is transparent. */
function sample(img, x, y, out) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  for (let j = 0; j < 2; j += 1) {
    const yy = y0 + j;
    if (yy < 0 || yy >= img.height) continue;
    const wy = j === 0 ? 1 - fy : fy;
    for (let i = 0; i < 2; i += 1) {
      const xx = x0 + i;
      if (xx < 0 || xx >= img.width) continue;
      const w = wy * (i === 0 ? 1 - fx : fx);
      if (w === 0) continue;
      const k = (yy * img.width + xx) * 4;
      out[0] += img.data[k] * w;
      out[1] += img.data[k + 1] * w;
      out[2] += img.data[k + 2] * w;
      out[3] += img.data[k + 3] * w;
    }
  }
}

function rotate(dx, dy, radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [dx * c + dy * s, -dx * s + dy * c];
}

/** Composite one placed part onto a canvas (both premultiplied). */
function drawPart(canvas, cut, part, placement, offsetX, offsetY, alphaScale) {
  const px = part.pivot[0];
  const py = part.pivot[1];
  // Canvas bounding box of the transformed cut bounds.
  const corners = [
    [cut.bounds.minX, cut.bounds.minY],
    [cut.bounds.maxX + 1, cut.bounds.minY],
    [cut.bounds.minX, cut.bounds.maxY + 1],
    [cut.bounds.maxX + 1, cut.bounds.maxY + 1],
  ];
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const [cx, cy] of corners) {
    const [rx, ry] = rotate(cx - px, cy - py, placement.rotation);
    left = Math.min(left, placement.pivot.x + rx + offsetX);
    right = Math.max(right, placement.pivot.x + rx + offsetX);
    top = Math.min(top, placement.pivot.y + ry + offsetY);
    bottom = Math.max(bottom, placement.pivot.y + ry + offsetY);
  }
  const x0 = Math.max(0, Math.floor(left) - 1);
  const x1 = Math.min(canvas.width - 1, Math.ceil(right) + 1);
  const y0 = Math.max(0, Math.floor(top) - 1);
  const y1 = Math.min(canvas.height - 1, Math.ceil(bottom) + 1);
  const s = new Float32Array(4);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const cx = x + 0.5 - offsetX - placement.pivot.x;
      const cy = y + 0.5 - offsetY - placement.pivot.y;
      const [sx, sy] = rotate(cx, cy, -placement.rotation);
      sample(cut.image, px + sx - 0.5, py + sy - 0.5, s);
      const a = s[3] * alphaScale;
      if (a <= 0) continue;
      const k = (y * canvas.width + x) * 4;
      const inv = 1 - a;
      canvas.data[k] = s[0] * alphaScale + canvas.data[k] * inv;
      canvas.data[k + 1] = s[1] * alphaScale + canvas.data[k + 1] * inv;
      canvas.data[k + 2] = s[2] * alphaScale + canvas.data[k + 2] * inv;
      canvas.data[k + 3] = a + canvas.data[k + 3] * inv;
    }
  }
}

// ---------------------------------------------------------------------------
// PNG out
// ---------------------------------------------------------------------------

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc(buf) {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
/** Encode a premultiplied float image as a straight-alpha RGBA8 PNG. */
function encodePng(img) {
  const { width, height } = img;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const k = (y * width + x) * 4;
      const a = img.data[k + 3];
      const o = y * (width * 4 + 1) + 1 + x * 4;
      if (a <= 0) {
        raw[o] = 0;
        raw[o + 1] = 0;
        raw[o + 2] = 0;
        raw[o + 3] = 0;
      } else {
        raw[o] = Math.max(0, Math.min(255, Math.round((img.data[k] / a) * 255)));
        raw[o + 1] = Math.max(0, Math.min(255, Math.round((img.data[k + 1] / a) * 255)));
        raw[o + 2] = Math.max(0, Math.min(255, Math.round((img.data[k + 2] / a) * 255)));
        raw[o + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Sheet drawing helpers
// ---------------------------------------------------------------------------

function checker(img) {
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const dark = (Math.floor(x / CHECKER_CELL) + Math.floor(y / CHECKER_CELL)) % 2 === 0;
      const k = (y * img.width + x) * 4;
      img.data[k] = (dark ? CHECKER[0] : CHECKER[3]) / 255;
      img.data[k + 1] = (dark ? CHECKER[1] : CHECKER[4]) / 255;
      img.data[k + 2] = (dark ? CHECKER[2] : CHECKER[5]) / 255;
      img.data[k + 3] = 1;
    }
  }
}

/** Blit `src` onto `dst` at (dx, dy) scaled by `scale` (nearest), alpha-over. */
function blit(dst, src, dx, dy, scale, alpha) {
  for (let y = 0; y < src.height * scale; y += 1) {
    const sy = Math.floor(y / scale);
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width * scale; x += 1) {
      const sx = Math.floor(x / scale);
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const s = (sy * src.width + sx) * 4;
      const a = src.data[s + 3] * alpha;
      if (a <= 0) continue;
      const d = (ty * dst.width + tx) * 4;
      const inv = 1 - a;
      dst.data[d] = src.data[s] * alpha + dst.data[d] * inv;
      dst.data[d + 1] = src.data[s + 1] * alpha + dst.data[d + 1] * inv;
      dst.data[d + 2] = src.data[s + 2] * alpha + dst.data[d + 2] * inv;
      dst.data[d + 3] = a + dst.data[d + 3] * inv;
    }
  }
}

function setPixel(img, x, y, rgb, alpha = 1) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) return;
  const k = (yi * img.width + xi) * 4;
  const inv = 1 - alpha;
  img.data[k] = (rgb[0] / 255) * alpha + img.data[k] * inv;
  img.data[k + 1] = (rgb[1] / 255) * alpha + img.data[k + 1] * inv;
  img.data[k + 2] = (rgb[2] / 255) * alpha + img.data[k + 2] * inv;
  img.data[k + 3] = alpha + img.data[k + 3] * inv;
}

function cross(img, x, y, rgb, arm = 3) {
  for (let d = -arm; d <= arm; d += 1) {
    setPixel(img, x + d, y, rgb);
    setPixel(img, x, y + d, rgb);
  }
}

function line(img, x0, y0, x1, y1, rgb) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= steps; i += 1) setPixel(img, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, rgb);
}

const FONT = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['111', '100', '100', '100', '111'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['110', '101', '101', '101', '101'],
  O: ['111', '101', '101', '101', '111'],
  P: ['111', '101', '111', '100', '100'],
  R: ['110', '101', '110', '101', '101'],
  S: ['111', '100', '111', '001', '111'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  '.': ['000', '000', '000', '000', '010'],
  '-': ['000', '000', '111', '000', '000'],
  '>': ['100', '010', '001', '010', '100'],
  '%': ['101', '001', '010', '100', '101'],
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '001', '001', '001'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};
function label(img, text, x0, y0, rgb, scale = 2) {
  let cx = x0;
  for (const ch of String(text)) {
    const g = FONT[ch];
    if (g === undefined) {
      cx += 4 * scale;
      continue;
    }
    for (let r = 0; r < 5; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        if (g[r][c] !== '1') continue;
        for (let dy = 0; dy < scale; dy += 1) for (let dx = 0; dx < scale; dx += 1) setPixel(img, cx + c * scale + dx, y0 + r * scale + dy, rgb);
      }
    }
    cx += 4 * scale;
  }
}

// ---------------------------------------------------------------------------
// Bake
// ---------------------------------------------------------------------------

const sources = {};
const cuts = {};
const decodedBySource = {};
for (const puppet of Object.values(PUPPETS)) {
  const decoded = decodePng(readFileSync(path.join(ART_DIR, `${puppet.source}.png`)));
  if (decoded.width !== puppet.size || decoded.height !== puppet.size) {
    throw new Error(`${puppet.source} is ${decoded.width}x${decoded.height}, the puppet says ${puppet.size}`);
  }
  decodedBySource[puppet.source] = decoded;
}
const recolourReports = {};
for (const [name, puppet] of Object.entries(PUPPETS)) {
  const decoded = decodedBySource[puppet.source];
  const { image: painted, report } = recoloured(decoded, puppet.recolour, decodedBySource);
  if (report !== null) {
    recolourReports[name] = report;
    console.log(
      `${name} recolour: ${report.targetPixels} tank px quantile-matched onto ${report.referencePixels} tee px; ` +
        `tee p10 (${report.reference.p10}) p50 (${report.reference.p50}) p90 (${report.reference.p90}); ` +
        `tank before p10 (${report.targetBefore.p10}) p50 (${report.targetBefore.p50}) p90 (${report.targetBefore.p90})`,
    );
  }
  sources[name] = { decoded, painted };
  cuts[name] = {};
  for (const part of puppet.parts) cuts[name][part.name] = cutPart(painted, part, EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FAR_LIMB_SHADE);
}

function renderFrame(frame, canvas, offsetX, offsetY, alpha = 1, skipFree = false) {
  const puppet = PUPPETS[frame.puppet];
  for (const placement of frame.placements) {
    const part = puppet.parts.find((p) => p.name === placement.part);
    if (skipFree && part.free === true) continue;
    drawPart(canvas, cuts[frame.puppet][placement.part], part, placement, offsetX, offsetY, alpha);
  }
}

/** Opaque mask of a premultiplied canvas. */
function opaqueMask(canvas) {
  const mask = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < mask.length; i += 1) mask[i] = canvas.data[i * 4 + 3] * 255 >= MASK_ALPHA ? 1 : 0;
  return mask;
}

/** Intersection over union of two masks, with the counts. */
function maskIou(a, b) {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === 1 && b[i] === 1) inter += 1;
    if (a[i] === 1 || b[i] === 1) union += 1;
  }
  return { inter, union, iou: union === 0 ? 0 : inter / union };
}

/** Box-filter downsample of a premultiplied canvas to `height` px tall. */
function downsample(canvas, height) {
  const scale = height / canvas.height;
  const width = Math.round(canvas.width * scale);
  const out = makeImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x / scale);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) / scale));
      const y0 = Math.floor(y / scale);
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) / scale));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let yy = y0; yy < y1 && yy < canvas.height; yy += 1) {
        for (let xx = x0; xx < x1 && xx < canvas.width; xx += 1) {
          const k = (yy * canvas.width + xx) * 4;
          r += canvas.data[k];
          g += canvas.data[k + 1];
          b += canvas.data[k + 2];
          a += canvas.data[k + 3];
          count += 1;
        }
      }
      const o = (y * width + x) * 4;
      out.data[o] = r / count;
      out.data[o + 1] = g / count;
      out.data[o + 2] = b / count;
      out.data[o + 3] = a / count;
    }
  }
  return out;
}

/**
 * The fraction of body pixels (opaque in either) whose colour composited
 * over mid grey moves by more than `BREATH_DIFF_LEVELS` between two
 * same-size premultiplied images.
 */
function bodyDifference(a, b) {
  let body = 0;
  let changed = 0;
  const grey = MID_GREY / 255;
  for (let i = 0; i < a.width * a.height; i += 1) {
    const aa = a.data[i * 4 + 3];
    const ba = b.data[i * 4 + 3];
    if (aa * 255 < MASK_ALPHA && ba * 255 < MASK_ALPHA) continue;
    body += 1;
    let d = Math.abs(aa - ba) * 255;
    for (let c = 0; c < 3; c += 1) {
      const av = a.data[i * 4 + c] + grey * (1 - aa);
      const bv = b.data[i * 4 + c] + grey * (1 - ba);
      d = Math.max(d, Math.abs(av - bv) * 255);
    }
    if (d > BREATH_DIFF_LEVELS) changed += 1;
  }
  return { body, changed, fraction: body === 0 ? 0 : changed / body };
}

const rendered = {};
for (const clip of MEMBER_MOTION_CLIPS) {
  const rigClip = rig.memberRigClip(clip);
  rendered[clip] = rigClip.frames.map((frame) => {
    const canvas = makeImage(CANVAS, CANVAS);
    renderFrame(frame, canvas, 0, 0);
    return { frame, canvas };
  });
}

const outputs = [];
function emit(file, png) {
  outputs.push({ file, png });
}

for (const type of MEMBER_MOTION_PRODUCTION_TYPES) {
  for (const clip of MEMBER_MOTION_CLIPS) {
    const frames = rendered[clip];
    const strip = makeImage(CANVAS * frames.length, CANVAS);
    frames.forEach(({ canvas }, i) => blit(strip, canvas, i * CANVAS, 0, 1, 1));
    emit(path.join(ART_DIR, `${memberMotionStripStem(type, clip)}.png`), encodePng(strip));
  }
}

// Contact sheets.
function sheetRow(frames, zoom, markPlant) {
  const width = SHEET_MARGIN * 2 + frames.length * (CANVAS * zoom + SHEET_GAP) - SHEET_GAP;
  const height = SHEET_MARGIN * 2 + CANVAS * zoom + 16;
  const sheet = makeImage(width, height);
  checker(sheet);
  frames.forEach(({ frame, canvas }, i) => {
    const x = SHEET_MARGIN + i * (CANVAS * zoom + SHEET_GAP);
    const y = SHEET_MARGIN + 16;
    blit(sheet, canvas, x, y, zoom, 1);
    label(sheet, i, x + 2, SHEET_MARGIN, LABEL_RGB);
    // The ground line, and the planted ball if any.
    const ground = rig.groundLineY();
    line(sheet, x, y + ground * zoom, x + CANVAS * zoom - 1, y + ground * zoom, MARK_RGB);
    if (markPlant && frame.plantedSole !== null) {
      cross(sheet, x + frame.plantedSole.x * zoom, y + frame.plantedSole.y * zoom, LABEL_RGB, 4);
    }
    if (frame.barCentre !== null) cross(sheet, x + frame.barCentre.x * zoom, y + frame.barCentre.y * zoom, MARK_RGB, 4);
  });
  return sheet;
}

for (const clip of MEMBER_MOTION_CLIPS) {
  const row = sheetRow(rendered[clip], 1, true);
  if (clip === 'walk') {
    const zoomed = sheetRow(rendered[clip], WALK_ZOOM, true);
    const both = makeImage(Math.max(row.width, zoomed.width), row.height + zoomed.height);
    checker(both);
    blit(both, row, 0, 0, 1, 1);
    blit(both, zoomed, 0, row.height, 1, 1);
    emit(path.join(SHEET_DIR, `sheet-${clip}.png`), encodePng(both));
  } else {
    emit(path.join(SHEET_DIR, `sheet-${clip}.png`), encodePng(row));
  }
}

{
  const rows = MEMBER_MOTION_CLIPS.map((clip) => sheetRow(rendered[clip], 1, true));
  const all = makeImage(Math.max(...rows.map((r) => r.width)), rows.reduce((h, r) => h + r.height, 0));
  checker(all);
  let y = 0;
  for (const row of rows) {
    blit(all, row, 0, y, 1, 1);
    y += row.height;
  }
  emit(path.join(SHEET_DIR, 'sheet-all-clips.png'), encodePng(all));
}

// Onion skin of the walk in the WORLD frame: frame k shifted right by its root
// advance, so a planted ball from every frame of a stance lands on one spot.
{
  const frames = rendered.walk;
  const stride = Math.ceil(rig.authoredStridePx());
  const zoom = 2;
  const width = (CANVAS + stride) * zoom + SHEET_MARGIN * 2;
  const height = CANVAS * zoom + SHEET_MARGIN * 2 + 16;
  const onion = makeImage(width, height);
  checker(onion);
  const ox = SHEET_MARGIN;
  const oy = SHEET_MARGIN + 16;
  const ground = rig.groundLineY();
  line(onion, ox, oy + ground * zoom, ox + (CANVAS + stride) * zoom, oy + ground * zoom, MARK_RGB);
  for (const { frame, canvas } of frames) {
    blit(onion, canvas, ox + Math.round(frame.rootAdvance * zoom), oy, zoom, ONION_ALPHA);
  }
  for (const { frame } of frames) {
    if (frame.plantedSole === null) continue;
    const wx = frame.plantedSole.x + frame.rootAdvance;
    cross(onion, ox + wx * zoom, oy + frame.plantedSole.y * zoom, LABEL_RGB, 5);
    label(onion, frame.index, ox + wx * zoom - 4, oy + ground * zoom + 6 + (frame.index % 4) * 12, LABEL_RGB);
  }
  emit(path.join(SHEET_DIR, 'onion-walk.png'), encodePng(onion));
}

// The dissolve edges: outgoing last | incoming first | both at 50%, IoU captioned.
const measurements = { dissolve: {}, phoneIdle: null, recolour: recolourReports };
{
  const rows = [];
  for (const [from, to] of MEMBER_MOTION_DISSOLVE_EDGES) {
    const outgoing = rendered[from][rendered[from].length - 1];
    const incoming = rendered[to][0];
    const whole = maskIou(opaqueMask(outgoing.canvas), opaqueMask(incoming.canvas));
    // The same with the presser's free part (the bar and plates) left out.
    const bodyOnly = (entry) => {
      const canvas = makeImage(CANVAS, CANVAS);
      renderFrame(entry.frame, canvas, 0, 0, 1, true);
      return canvas;
    };
    const body = maskIou(opaqueMask(bodyOnly(outgoing)), opaqueMask(bodyOnly(incoming)));
    const rootGap = Math.hypot(outgoing.frame.root.x - incoming.frame.root.x, outgoing.frame.root.y - incoming.frame.root.y);
    measurements.dissolve[`${from}>${to}`] = {
      outgoingFrame: outgoing.frame.index,
      incomingFrame: incoming.frame.index,
      iou: whole.iou,
      intersection: whole.inter,
      union: whole.union,
      iouWithoutBar: body.iou,
      rootGapPx: rootGap,
    };
    console.log(
      `dissolve ${from}[${outgoing.frame.index}] > ${to}[${incoming.frame.index}]: IoU ${whole.iou.toFixed(4)} (${whole.inter} / ${whole.union}), ` +
        `without the bar ${body.iou.toFixed(4)}, pelvis gap ${rootGap.toFixed(2)} px`,
    );
    const width = SHEET_MARGIN * 2 + 3 * (CANVAS * DISSOLVE_ZOOM + SHEET_GAP) - SHEET_GAP;
    const height = SHEET_MARGIN * 2 + CANVAS * DISSOLVE_ZOOM + 16;
    const row = makeImage(width, height);
    checker(row);
    const y = SHEET_MARGIN + 16;
    const cell = (i) => SHEET_MARGIN + i * (CANVAS * DISSOLVE_ZOOM + SHEET_GAP);
    blit(row, outgoing.canvas, cell(0), y, DISSOLVE_ZOOM, 1);
    blit(row, incoming.canvas, cell(1), y, DISSOLVE_ZOOM, 1);
    blit(row, outgoing.canvas, cell(2), y, DISSOLVE_ZOOM, 1 / 2);
    blit(row, incoming.canvas, cell(2), y, DISSOLVE_ZOOM, 1 / 2);
    for (const i of [0, 1, 2]) {
      const frame = i === 0 ? outgoing.frame : incoming.frame;
      cross(row, cell(i) + frame.root.x * DISSOLVE_ZOOM, y + frame.root.y * DISSOLVE_ZOOM, LABEL_RGB, 6);
    }
    label(row, `${from.toUpperCase()} ${outgoing.frame.index}`, cell(0) + 2, SHEET_MARGIN, LABEL_RGB);
    label(row, `${to.toUpperCase()} ${incoming.frame.index}`, cell(1) + 2, SHEET_MARGIN, LABEL_RGB);
    label(row, `DISSOLVE IOU ${(whole.iou * 100).toFixed(1)}% NO BAR ${(body.iou * 100).toFixed(1)}%`, cell(2) + 2, SHEET_MARGIN, LABEL_RGB);
    rows.push(row);
  }
  const sheet = makeImage(Math.max(...rows.map((r) => r.width)), rows.reduce((h, r) => h + r.height, 0));
  checker(sheet);
  let y = 0;
  for (const row of rows) {
    blit(sheet, row, 0, y, 1, 1);
    y += row.height;
  }
  emit(path.join(SHEET_DIR, 'sheet-dissolve.png'), encodePng(sheet));
}

// The breath at phone size: the idle's rest frame against its full-inhale
// frame (half way round), downsampled to the front-row body height.
{
  const idle = rendered.idle;
  const phone = EMPIRE_TUNING.FLOOR_MEMBER_MOTION_PHONE_BODY_PX;
  const rest = idle[0];
  const peak = idle[Math.floor(idle.length / 2)];
  const restSmall = downsample(rest.canvas, phone);
  const peakSmall = downsample(peak.canvas, phone);
  const small = bodyDifference(restSmall, peakSmall);
  const full = bodyDifference(rest.canvas, peak.canvas);
  measurements.phoneIdle = {
    bodyPx: phone,
    restFrame: rest.frame.index,
    peakFrame: peak.frame.index,
    diffLevels: BREATH_DIFF_LEVELS,
    bodyPixels: small.body,
    changedPixels: small.changed,
    fraction: small.fraction,
    fullSizeFraction: full.fraction,
  };
  console.log(
    `phone idle: frames ${rest.frame.index} vs ${peak.frame.index} at ${phone} px — ${small.changed} of ${small.body} body px changed ` +
      `(${(small.fraction * 100).toFixed(1)}%; ${(full.fraction * 100).toFixed(1)}% at full size), threshold ${BREATH_DIFF_LEVELS} levels`,
  );
  const wait = rendered.wait;
  const waitSmall = bodyDifference(downsample(wait[0].canvas, phone), downsample(wait[Math.floor(wait.length / 2)].canvas, phone));
  measurements.phoneIdle.waitFraction = waitSmall.fraction;
  const cellW = phone * PHONE_ZOOM + SHEET_GAP;
  const sheet = makeImage(SHEET_MARGIN * 2 + 4 * cellW, SHEET_MARGIN * 2 + phone * PHONE_ZOOM + 16);
  checker(sheet);
  const entries = [
    ['IDLE 0', restSmall],
    ['IDLE 6', peakSmall],
    ['WAIT 0', downsample(wait[0].canvas, phone)],
    ['WAIT 6', downsample(wait[Math.floor(wait.length / 2)].canvas, phone)],
  ];
  entries.forEach(([text, img], i) => {
    blit(sheet, img, SHEET_MARGIN + i * cellW, SHEET_MARGIN + 16, PHONE_ZOOM, 1);
    label(sheet, text, SHEET_MARGIN + i * cellW + 2, SHEET_MARGIN, LABEL_RGB);
  });
  emit(path.join(SHEET_DIR, 'sheet-phone-idle.png'), encodePng(sheet));
}

// Exploded parts and reassembled rest, per puppet. Each part is cropped to
// its polygon bounds and drawn at 2× so the cut, its pivot (red), tip (blue)
// and sole points (small blue) can actually be read.
const PARTS_ZOOM = 2;
for (const [name, puppet] of Object.entries(PUPPETS)) {
  const size = puppet.size;
  const boxes = puppet.parts.map((part) => cuts[name][part.name].bounds);
  const cellW = Math.max(...boxes.map((b) => b.maxX - b.minX + 1)) * PARTS_ZOOM + SHEET_GAP;
  const cellH = Math.max(...boxes.map((b) => b.maxY - b.minY + 1)) * PARTS_ZOOM + 16;
  const n = puppet.parts.length;
  const exploded = makeImage(SHEET_MARGIN * 2 + n * cellW, SHEET_MARGIN * 2 + cellH);
  checker(exploded);
  puppet.parts.forEach((part, i) => {
    const b = boxes[i];
    const x = SHEET_MARGIN + i * cellW;
    const y = SHEET_MARGIN + 16;
    const crop = makeImage(b.maxX - b.minX + 1, b.maxY - b.minY + 1);
    const cut = cuts[name][part.name].image;
    for (let yy = 0; yy < crop.height; yy += 1) {
      for (let xx = 0; xx < crop.width; xx += 1) {
        const from = ((b.minY + yy) * cut.width + (b.minX + xx)) * 4;
        const to = (yy * crop.width + xx) * 4;
        for (let c = 0; c < 4; c += 1) crop.data[to + c] = cut.data[from + c];
      }
    }
    blit(exploded, crop, x, y, PARTS_ZOOM, 1);
    const sx = (v) => x + (v - b.minX) * PARTS_ZOOM;
    const sy = (v) => y + (v - b.minY) * PARTS_ZOOM;
    for (const polygon of part.polygons) {
      for (let k = 0; k < polygon.length; k += 1) {
        const a = polygon[k];
        const c = polygon[(k + 1) % polygon.length];
        line(exploded, sx(a[0]), sy(a[1]), sx(c[0]), sy(c[1]), LABEL_RGB);
      }
    }
    cross(exploded, sx(part.pivot[0]), sy(part.pivot[1]), LABEL_RGB, 5);
    cross(exploded, sx(part.tip[0]), sy(part.tip[1]), MARK_RGB, 5);
    if (part.sole !== undefined) {
      cross(exploded, sx(part.sole.heel[0]), sy(part.sole.heel[1]), MARK_RGB, 2);
      cross(exploded, sx(part.sole.ball[0]), sy(part.sole.ball[1]), MARK_RGB, 2);
    }
    label(exploded, i, x + 2, SHEET_MARGIN, LABEL_RGB);
  });
  emit(path.join(SHEET_DIR, `parts-${name}.png`), encodePng(exploded));
  console.log(`${name} parts, in draw order: ${puppet.parts.map((part, i) => `${i}=${part.name}`).join(' ')}`);

  // Rest: painting | reassembled | uncovered.
  const rest = makeImage(SHEET_MARGIN * 2 + 3 * (size + SHEET_GAP) - SHEET_GAP, SHEET_MARGIN * 2 + size);
  checker(rest);
  const original = fromDecoded(sources[name].decoded);
  blit(rest, original, SHEET_MARGIN, SHEET_MARGIN, 1, 1);
  const reassembled = makeImage(size, size);
  const restFrame = {
    puppet: name,
    placements: puppet.parts.map((part) => {
      // Rest placement: pivot at its attach in the parent's frame, no rotation.
      // Resolve the attach chain through the parents' source coordinates.
      let pivot = [part.attach[0], part.attach[1]];
      let parentName = part.parent;
      while (parentName !== null) {
        const parent = puppet.parts.find((p) => p.name === parentName);
        pivot = [pivot[0] - parent.pivot[0] + parent.attach[0], pivot[1] - parent.pivot[1] + parent.attach[1]];
        parentName = parent.parent;
      }
      return { part: part.name, pivot: { x: pivot[0], y: pivot[1] }, rotation: 0 };
    }),
  };
  renderFrame(restFrame, reassembled, 0, 0);
  blit(rest, reassembled, SHEET_MARGIN + size + SHEET_GAP, SHEET_MARGIN, 1, 1);
  const uncovered = makeImage(size, size);
  let uncoveredCount = 0;
  let paintedCount = 0;
  for (let i = 0; i < size * size; i += 1) {
    const a = original.data[i * 4 + 3];
    if (a < 0.5) continue;
    paintedCount += 1;
    const grey = 0.35 * a;
    uncovered.data[i * 4] = grey;
    uncovered.data[i * 4 + 1] = grey;
    uncovered.data[i * 4 + 2] = grey;
    uncovered.data[i * 4 + 3] = a;
    if (reassembled.data[i * 4 + 3] < 0.5) {
      uncoveredCount += 1;
      uncovered.data[i * 4] = UNCOVERED_RGB[0] / 255;
      uncovered.data[i * 4 + 1] = UNCOVERED_RGB[1] / 255;
      uncovered.data[i * 4 + 2] = UNCOVERED_RGB[2] / 255;
      uncovered.data[i * 4 + 3] = 1;
    }
  }
  blit(rest, uncovered, SHEET_MARGIN + 2 * (size + SHEET_GAP), SHEET_MARGIN, 1, 1);
  emit(path.join(SHEET_DIR, `rest-${name}.png`), encodePng(rest));
  console.log(`${name}: ${uncoveredCount} of ${paintedCount} painted pixels uncovered by any part at rest`);
}

// Metadata and measurements.
emit(path.join(SHEET_DIR, 'member-motion-metadata.json'), Buffer.from(JSON.stringify(rig.memberRigMetadata(), null, 2) + '\n'));
emit(path.join(SHEET_DIR, 'member-motion-measurements.json'), Buffer.from(JSON.stringify(measurements, null, 2) + '\n'));

// ---------------------------------------------------------------------------
// Write or check
// ---------------------------------------------------------------------------

let differ = 0;
for (const { file, png } of outputs) {
  if (CHECK) {
    const same = existsSync(file) && readFileSync(file).equals(png);
    console.log(`${same ? 'same' : 'DIFFERS'}  ${path.relative(ROOT, file)}  ${png.length} bytes`);
    if (!same) differ += 1;
  } else {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, png);
    console.log(`wrote  ${path.relative(ROOT, file)}  ${png.length} bytes`);
  }
}
if (CHECK && differ > 0) {
  console.log(`${differ} output(s) differ from disk`);
  process.exit(1);
}
