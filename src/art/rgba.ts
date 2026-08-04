/**
 * Index grid -> RGBA bytes.
 *
 * The one place palette indices become colours. Kept separate from `raster.ts`
 * so the rasteriser never sees an RGB value, and separate from the React glue
 * so the conversion is unit-testable without a renderer.
 *
 * Unallocated palette slots render fully transparent rather than throwing: a
 * missing colour should show up as a hole in a screenshot, which is obvious,
 * not as a crash in a render loop, which is not. `assertGridIndicesAllocated`
 * exists for callers (and tests) that want the strict check.
 */

import { RGBA, colorAt, isTransparentIndex, rgb5ToRgb8, type Rgb5 } from './palette';
import type { IndexGrid } from './raster';

/**
 * How an index becomes a colour. Defaults to `colorAt` — the three sprite banks
 * — so every existing caller is bit-for-bit unchanged.
 *
 * The parameter exists because the environment layer adds two BACKGROUND banks
 * (`gymPalette.ts`), which is how the hardware kept BG and OBJ palettes apart,
 * and a grid holding a room AND a figure needs a resolver that can see both.
 * The alternative was a fourth copy of the byte-writing loop below, which is
 * the duplication `palette.ts`'s `RGBA` block was introduced to end.
 */
export type IndexResolver = (index: number) => Rgb5 | undefined;

/** Straight (non-premultiplied) RGBA8888, row-major, no padding. */
export function gridToRgba(grid: IndexGrid, resolve: IndexResolver = colorAt): Uint8Array {
  const out = new Uint8Array(grid.w * grid.h * RGBA.BYTES_PER_PIXEL);
  for (let i = 0; i < grid.w * grid.h; i += 1) {
    const index = grid.data[i] ?? 0;
    if (isTransparentIndex(index)) continue;
    const c5 = resolve(index);
    if (c5 === undefined) continue;
    const [r, g, b] = rgb5ToRgb8(c5);
    const o = i * RGBA.BYTES_PER_PIXEL;
    out[o + RGBA.RED_OFFSET] = r;
    out[o + RGBA.GREEN_OFFSET] = g;
    out[o + RGBA.BLUE_OFFSET] = b;
    out[o + RGBA.ALPHA_OFFSET] = RGBA.OPAQUE;
  }
  return out;
}

/** Every index in the grid names an allocated colour or is transparent. */
export function findUnallocatedIndices(grid: IndexGrid): number[] {
  const bad = new Set<number>();
  for (let i = 0; i < grid.data.length; i += 1) {
    const index = grid.data[i] ?? 0;
    if (isTransparentIndex(index)) continue;
    if (colorAt(index) === undefined) bad.add(index);
  }
  return [...bad].sort((a, b) => a - b);
}

export function assertGridIndicesAllocated(grid: IndexGrid): void {
  const bad = findUnallocatedIndices(grid);
  if (bad.length > 0) {
    throw new Error(`grid references unallocated palette indices: ${bad.join(', ')}`);
  }
}

/** Distinct palette indices present, ascending. Useful for palette audits. */
export function usedIndices(grid: IndexGrid): number[] {
  const seen = new Set<number>();
  for (let i = 0; i < grid.data.length; i += 1) seen.add(grid.data[i] ?? 0);
  return [...seen].sort((a, b) => a - b);
}
