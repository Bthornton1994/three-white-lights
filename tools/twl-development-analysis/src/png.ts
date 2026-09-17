import { readFileSync, writeFileSync } from "node:fs";
import pngjs from "pngjs";
import type { MeasuredFrame } from "./types.ts";
import { sha256Hex } from "./util/hash.ts";

const { PNG } = pngjs;

export type Png = InstanceType<typeof PNG>;

export function readPng(file: string): Png {
  return PNG.sync.read(readFileSync(file));
}

export function pngFromBuffer(buf: Buffer): Png {
  return PNG.sync.read(buf);
}

export function writePng(file: string, png: Png): void {
  writeFileSync(file, PNG.sync.write(png));
}

export function newPng(width: number, height: number): Png {
  const png = new PNG({ width, height });
  png.data.fill(0);
  return png;
}

export interface AlphaStats {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  opaque: number;
  semiTransparent: number;
  colors: number;
  footCenterX: number | null;
}

/**
 * Visible-pixel bounding box and a bottom-weighted foot center (mean x of
 * opaque pixels in the lowest 4 opaque rows). Alpha > 0 counts as visible,
 * matching the target's own `check_sprites.py` notion of a fringe pixel.
 */
export function alphaStats(png: Png): AlphaStats {
  const { width, height, data } = png;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;
  let semi = 0;
  const colors = new Set<number>();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] ?? 0;
      if (a === 0) continue;
      if (a < 255) semi += 1;
      opaque += 1;
      colors.add(((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0));
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  let footCenterX: number | null = null;
  if (maxY >= 0) {
    let sum = 0;
    let n = 0;
    for (let y = Math.max(minY, maxY - 3); y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const a = data[(y * width + x) * 4 + 3] ?? 0;
        if (a > 0) {
          sum += x;
          n += 1;
        }
      }
    }
    footCenterX = n > 0 ? Math.round((sum / n) * 10) / 10 : null;
  }
  return { minX, minY, maxX, maxY, opaque, semiTransparent: semi, colors: colors.size, footCenterX };
}

export function measureFrame(sheet: string, index: number, file: string): MeasuredFrame {
  const buf = readFileSync(file);
  const png = PNG.sync.read(buf);
  const s = alphaStats(png);
  return {
    sheet,
    index,
    path: file,
    sha256: sha256Hex(buf),
    width: png.width,
    height: png.height,
    minX: s.minX,
    minY: s.minY,
    maxX: s.maxX,
    maxY: s.maxY,
    footCenterX: s.footCenterX,
    opaque: s.opaque,
    semiTransparent: s.semiTransparent,
    colors: s.colors,
  };
}

/**
 * Re-implements the target SpriteStage compositor with nearest-neighbour
 * sampling: platform drawn `cover` at (posX 0.5, posY 0.42) then the lifter
 * blitted at integer (dx, dy). Used to prove the live canvas equals the
 * anchored composition pixel for pixel.
 */
export function composeStage(
  platform: Png,
  lifter: Png,
  stageW: number,
  stageH: number,
  dx: number,
  dy: number,
  posX = 0.5,
  posY = 0.42,
): Png {
  const out = newPng(stageW, stageH);
  const scale = Math.max(stageW / platform.width, stageH / platform.height);
  const sw = stageW / scale;
  const sh = stageH / scale;
  const sx = Math.round((platform.width - sw) * posX);
  const sy = Math.round((platform.height - sh) * posY);
  const swR = Math.round(sw);
  const shR = Math.round(sh);
  // Chromium samples nearest-neighbour at the destination pixel centre.
  for (let y = 0; y < stageH; y += 1) {
    const py = Math.min(platform.height - 1, sy + Math.floor(((y + 0.5) * shR) / stageH));
    for (let x = 0; x < stageW; x += 1) {
      const px = Math.min(platform.width - 1, sx + Math.floor(((x + 0.5) * swR) / stageW));
      const si = (py * platform.width + px) * 4;
      const di = (y * stageW + x) * 4;
      out.data[di] = platform.data[si] ?? 0;
      out.data[di + 1] = platform.data[si + 1] ?? 0;
      out.data[di + 2] = platform.data[si + 2] ?? 0;
      out.data[di + 3] = 255;
    }
  }
  for (let y = 0; y < lifter.height; y += 1) {
    const ty = y + dy;
    if (ty < 0 || ty >= stageH) continue;
    for (let x = 0; x < lifter.width; x += 1) {
      const tx = x + dx;
      if (tx < 0 || tx >= stageW) continue;
      const si = (y * lifter.width + x) * 4;
      const a = (lifter.data[si + 3] ?? 0) / 255;
      if (a === 0) continue;
      const di = (ty * stageW + tx) * 4;
      for (let c = 0; c < 3; c += 1) {
        const src = lifter.data[si + c] ?? 0;
        const dst = out.data[di + c] ?? 0;
        out.data[di + c] = Math.round(src * a + dst * (1 - a));
      }
      out.data[di + 3] = 255;
    }
  }
  return out;
}

export interface DiffStats {
  width: number;
  height: number;
  sizeMatch: boolean;
  meanAbsDiff: number;
  mismatchFraction: number;
  comparedPixels: number;
}

/** Mean absolute RGB difference normalised to 0..1, and the fraction of pixels differing by more than `tol`. */
export function diffPng(a: Png, b: Png, tol = 24): DiffStats {
  const sizeMatch = a.width === b.width && a.height === b.height;
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  let sum = 0;
  let mismatched = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const ia = (y * a.width + x) * 4;
      const ib = (y * b.width + x) * 4;
      let d = 0;
      for (let c = 0; c < 3; c += 1) d += Math.abs((a.data[ia + c] ?? 0) - (b.data[ib + c] ?? 0));
      sum += d / 3;
      if (d / 3 > tol) mismatched += 1;
    }
  }
  const n = Math.max(1, w * h);
  return {
    width: w,
    height: h,
    sizeMatch,
    meanAbsDiff: Math.round((sum / n / 255) * 10000) / 10000,
    mismatchFraction: Math.round((mismatched / n) * 10000) / 10000,
    comparedPixels: n,
  };
}

export function cropPng(src: Png, x: number, y: number, w: number, h: number): Png {
  const out = newPng(w, h);
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      const sx = x + xx;
      const sy = y + yy;
      const di = (yy * w + xx) * 4;
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const si = (sy * src.width + sx) * 4;
      out.data[di] = src.data[si] ?? 0;
      out.data[di + 1] = src.data[si + 1] ?? 0;
      out.data[di + 2] = src.data[si + 2] ?? 0;
      out.data[di + 3] = src.data[si + 3] ?? 0;
    }
  }
  return out;
}

/** Nearest-neighbour downscale by an integer factor; used to compare a 2x canvas against a 1x composition. */
export function downscaleNearest(src: Png, factor: number): Png {
  const w = Math.floor(src.width / factor);
  const h = Math.floor(src.height / factor);
  const out = newPng(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const si = (y * factor * src.width + x * factor) * 4;
      const di = (y * w + x) * 4;
      for (let c = 0; c < 4; c += 1) out.data[di + c] = src.data[si + c] ?? 0;
    }
  }
  return out;
}

/** Fraction of the lifter's own opaque pixels that differ between two stage images. Exact placement proof. */
export function lifterRegionMismatch(actual: Png, expected: Png, lifter: Png, dx: number, dy: number, tol = 8): { mismatch: number; total: number } {
  let mismatch = 0;
  let total = 0;
  for (let y = 0; y < lifter.height; y += 1) {
    const ty = y + dy;
    if (ty < 0 || ty >= expected.height) continue;
    for (let x = 0; x < lifter.width; x += 1) {
      const tx = x + dx;
      if (tx < 0 || tx >= expected.width) continue;
      if ((lifter.data[(y * lifter.width + x) * 4 + 3] ?? 0) === 0) continue;
      total += 1;
      const i = (ty * expected.width + tx) * 4;
      for (let c = 0; c < 3; c += 1) {
        if (Math.abs((actual.data[i + c] ?? 0) - (expected.data[i + c] ?? 0)) > tol) {
          mismatch += 1;
          break;
        }
      }
    }
  }
  return { mismatch, total };
}

export interface AlignedDiff {
  offsetY: number;
  meanAbsDiff: number;
  mismatchFraction: number;
}

/**
 * Compares a region of `fresh` (given by box) against `committed`, searching
 * vertical offsets so a screenshot taken at a different scroll position still
 * compares the same on-screen region. Coarse-to-fine: 8 px steps, then 1 px.
 */
export function alignedRegionDiff(fresh: Png, committed: Png, box: { x: number; y: number; width: number; height: number }, maxShift = 480): AlignedDiff {
  const x0 = Math.max(0, Math.round(box.x));
  const y0 = Math.max(0, Math.round(box.y));
  const w = Math.min(Math.round(box.width), fresh.width - x0, committed.width - x0);
  const h = Math.min(Math.round(box.height), fresh.height - y0);
  const region = cropPng(fresh, x0, y0, w, h);
  const evalAt = (dy: number): DiffStats | null => {
    const cy = y0 + dy;
    if (cy < 0 || cy + h > committed.height) return null;
    return diffPng(region, cropPng(committed, x0, cy, w, h));
  };
  let best: { dy: number; d: DiffStats } | null = null;
  const consider = (dy: number): void => {
    const d = evalAt(dy);
    if (d && (!best || d.meanAbsDiff < best.d.meanAbsDiff)) best = { dy, d };
  };
  for (let dy = -maxShift; dy <= maxShift; dy += 8) consider(dy);
  if (best) {
    const centre = (best as { dy: number }).dy;
    for (let dy = centre - 8; dy <= centre + 8; dy += 1) consider(dy);
  }
  if (!best) return { offsetY: 0, meanAbsDiff: 1, mismatchFraction: 1 };
  const b = best as { dy: number; d: DiffStats };
  return { offsetY: b.dy, meanAbsDiff: b.d.meanAbsDiff, mismatchFraction: b.d.mismatchFraction };
}
