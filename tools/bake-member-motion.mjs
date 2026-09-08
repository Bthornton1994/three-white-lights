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
 * walker a beige tee. Inside `PRESSER.recolour.polygon`, every pixel darker
 * than `darkMax` is remapped from the tank's compressed shadow range onto the
 * tee's shadow → lit ramp (luminance / darkMax, lifted by `gamma`). What it
 * cannot do: tell a dark fabric fold from a dark shadow on skin or hair that
 * falls inside the polygon (the warm rim light along the tank's edge, RGB
 * about (126, 65, 32), sits right at the threshold and reads as either); the
 * shorts stay black because the polygon stops at the waist, and the waist
 * line is an authored guess on a painting where both garments are black.
 * The tank's own shading is a few dozen levels wide, so the lift amplifies
 * its noise — the recoloured fabric is flatter and grainier than the tee it
 * imitates. Stated here rather than hidden; the reassembled-rest sheet shows
 * it beside the untouched painting.
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
 *   docs/design/living-gym-world/vl-3/member-motion-metadata.json  `memberRigMetadata()`
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
const { MEMBER_MOTION_CLIPS, MEMBER_MOTION_CANVAS_PX, MEMBER_MOTION_PRODUCTION_TYPES, memberMotionStripStem } = clipsModule;
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

/** Straight-alpha copy of a source with the puppet's recolour applied. */
function recoloured(decoded, recolour) {
  const out = new Uint8Array(decoded.rgba);
  if (recolour === undefined) return { width: decoded.width, height: decoded.height, rgba: out };
  const { polygon, darkMax, softBand, gamma, shadow, lit } = recolour;
  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      const i = (y * decoded.width + x) * 4;
      if (out[i + 3] === 0) continue;
      if (!pointInPolygon(x + 0.5, y + 0.5, polygon)) continue;
      const l = (out[i] + out[i + 1] + out[i + 2]) / 3;
      if (l >= darkMax + softBand) continue;
      const shade = Math.pow(Math.min(1, l / darkMax), gamma);
      const weight = l < darkMax ? 1 : (darkMax + softBand - l) / softBand;
      for (let c = 0; c < 3; c += 1) {
        const mapped = shadow[c] + (lit[c] - shadow[c]) * shade;
        out[i + c] = Math.round(out[i + c] + (mapped - out[i + c]) * weight);
      }
    }
  }
  return { width: decoded.width, height: decoded.height, rgba: out };
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
for (const [name, puppet] of Object.entries(PUPPETS)) {
  const decoded = decodePng(readFileSync(path.join(ART_DIR, `${puppet.source}.png`)));
  if (decoded.width !== puppet.size || decoded.height !== puppet.size) {
    throw new Error(`${puppet.source} is ${decoded.width}x${decoded.height}, the puppet says ${puppet.size}`);
  }
  sources[name] = { decoded, painted: recoloured(decoded, puppet.recolour) };
  cuts[name] = {};
  for (const part of puppet.parts) cuts[name][part.name] = cutPart(sources[name].painted, part, EMPIRE_TUNING.FLOOR_MEMBER_MOTION_FAR_LIMB_SHADE);
}

function renderFrame(frame, canvas, offsetX, offsetY, alpha = 1) {
  const puppet = PUPPETS[frame.puppet];
  for (const placement of frame.placements) {
    const part = puppet.parts.find((p) => p.name === placement.part);
    drawPart(canvas, cuts[frame.puppet][placement.part], part, placement, offsetX, offsetY, alpha);
  }
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

// Metadata.
emit(path.join(SHEET_DIR, 'member-motion-metadata.json'), Buffer.from(JSON.stringify(rig.memberRigMetadata(), null, 2) + '\n'));

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
