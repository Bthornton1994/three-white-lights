/**
 * Does the figure still read once the room is behind it?
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A MODULE AND NOT A PARAGRAPH IN A TEST
 * ---------------------------------------------------------------------------
 * GDD §12.2 grades this piece on "readability at phone scale, not just
 * fidelity". That half of the bar is measurable, so it is measured, on the
 * actual composited pixels the screen shows — scene grid with the lifter
 * blitted into it — rather than on the two layers reasoned about separately.
 *
 * ---------------------------------------------------------------------------
 * EVERY NUMBER HERE IS TWO-SIDED, AND THAT IS THE POINT
 * ---------------------------------------------------------------------------
 * A readability bound that only fails on a blank screen measures nothing. Each
 * quantity below therefore has a natural failure at BOTH ends, and the bounds
 * in `gymScene.test.ts` bracket every one of them:
 *
 *   - `backgroundEdgeShare` — a busy, high-contrast room drives it UP; an empty
 *     black rectangle drives it to zero. A gym has to have things in it.
 *   - `backgroundMeanLuma` — a bright room drives it up and eats the figure's
 *     range; a black room drives it down and there is no room left.
 *   - `backgroundIndexCount` — falls to one on a flat fill.
 *   - `rimContrast` percentiles — a background that matches any part of the
 *     figure's own value range drives the low percentiles down, whether it
 *     matches by being too bright OR by sitting on the figure's shadow steps
 *     (the lifter's SINGLET_DARK is luma 54 and his GEAR_DARK is 59, so a
 *     "safe, dark" wall at 55 is a worse background than a pale one).
 *   - `backgroundOverFigureShare` — the share of the room brighter than the
 *     median pixel of the lifter. Nothing makes this smaller than a black
 *     screen, so it is bracketed by the two above rather than trusted alone.
 *
 * WHAT IT CANNOT SAY. Nothing here is a judgement about whether the room looks
 * like a gym, whether it looks 16-bit, or whether it looks good. It says the
 * figure separates from it. GDD §12.2's other clause — the blind era A/B —
 * needs a human and a reference this repository does not have; see
 * `docs/reference/README.md`.
 */

import { BANK_SIZE, isTransparentIndex } from './palette';
import { lumaOfIndex } from './gymPalette';
import { getPx, type IndexGrid } from './raster';
import { GYM_READABILITY } from './gymTuning';

/** Which layer a palette index belongs to, for the measurement. */
export type PixelRole = 'figure' | 'barbell' | 'background' | 'nothing';

const FIGURE_BANK = 0;
const BARBELL_BANK = 1;

export function roleOf(index: number): PixelRole {
  if (isTransparentIndex(index)) return 'nothing';
  const bank = Math.floor(index / BANK_SIZE);
  if (bank === FIGURE_BANK) return 'figure';
  if (bank === BARBELL_BANK) return 'barbell';
  return 'background';
}

export type Percentiles = Readonly<Record<keyof typeof GYM_READABILITY.QUANTILES, number>>;

function percentiles(sorted: readonly number[]): Percentiles {
  const at = (q: number): number => {
    if (sorted.length === 0) return 0;
    const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
    return sorted[i] ?? 0;
  };
  const out: Record<string, number> = {};
  for (const [name, q] of Object.entries(GYM_READABILITY.QUANTILES)) out[name] = at(q);
  return out as Percentiles;
}

export interface SceneReadability {
  readonly backgroundPx: number;
  readonly figurePx: number;
  readonly barbellPx: number;
  /** Distinct palette indices in the background. One means a flat fill. */
  readonly backgroundIndexCount: number;
  readonly backgroundMeanLuma: number;
  readonly figureMeanLuma: number;
  readonly figureLuma: Percentiles;
  readonly backgroundLuma: Percentiles;
  /** Share of background pixels forming a hard luma step with a neighbour. */
  readonly backgroundEdgeShare: number;
  /** The same, restricted to the band directly behind the figure. */
  readonly behindEdgeShare: number;
  readonly behindPx: number;
  /** Share of background at or above the figure's own top band. */
  readonly backgroundBrightShare: number;
  /** Share of background brighter than the figure's median pixel. */
  readonly backgroundOverFigureShare: number;
  /** |Δluma| across the silhouette, figure inside vs. room outside. */
  readonly rimSamples: number;
  readonly rimContrast: Percentiles;
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Right and down only, for the busyness scan: every neighbouring pair in the
 * grid is visited exactly once that way, so an edge is not counted twice.
 */
const FORWARD_NEIGHBOURS: readonly (readonly [number, number])[] = NEIGHBOURS.filter(
  ([dx, dy]) => dx > 0 || dy > 0,
);

function lumaAt(grid: IndexGrid, x: number, y: number): number {
  return lumaOfIndex(getPx(grid, x, y)) ?? 0;
}

/**
 * Measure one composited frame.
 *
 * `subjectIsBarbell` decides whether the barbell counts as part of the thing
 * that has to read. It does by default, because GDD §12.2's bar for this piece
 * says the environment must not reduce the readability of the bar path either —
 * a rack drawn behind the discs is exactly the failure that would hide.
 */
export function measureSceneReadability(
  grid: IndexGrid,
  options: { readonly subjectIsBarbell?: boolean } = {},
): SceneReadability {
  const countBarbell = options.subjectIsBarbell ?? true;
  const roles: PixelRole[] = new Array<PixelRole>(grid.w * grid.h).fill('nothing');
  const luma = new Float64Array(grid.w * grid.h);

  const figureLumas: number[] = [];
  const backgroundLumas: number[] = [];
  const indices = new Set<number>();
  let barbellPx = 0;
  let minX = grid.w;
  let maxX = -1;
  let minY = grid.h;
  let maxY = -1;

  for (let y = 0; y < grid.h; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      const i = y * grid.w + x;
      const index = getPx(grid, x, y);
      const role = roleOf(index);
      roles[i] = role;
      luma[i] = lumaOfIndex(index) ?? 0;
      if (role === 'background') {
        backgroundLumas.push(luma[i] ?? 0);
        indices.add(index);
      } else if (role === 'figure') {
        figureLumas.push(luma[i] ?? 0);
      } else if (role === 'barbell') {
        barbellPx += 1;
      }
      if (role === 'figure' || (countBarbell && role === 'barbell')) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const subjectAt = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) return false;
    const role = roles[y * grid.w + x];
    return role === 'figure' || (countBarbell && role === 'barbell');
  };
  const backgroundAt = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) return false;
    return roles[y * grid.w + x] === 'background';
  };

  // --- busyness -------------------------------------------------------------
  const margin = GYM_READABILITY.BEHIND_MARGIN_PX;
  const behind = {
    x0: minX - margin,
    x1: maxX + margin,
    y0: minY - margin,
    y1: maxY + margin,
  };
  let edges = 0;
  let behindEdges = 0;
  let behindPx = 0;
  let bright = 0;
  for (let y = 0; y < grid.h; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      if (!backgroundAt(x, y)) continue;
      const here = luma[y * grid.w + x] ?? 0;
      let isEdge = false;
      for (const [dx, dy] of FORWARD_NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!backgroundAt(nx, ny)) continue;
        if (Math.abs(here - (luma[ny * grid.w + nx] ?? 0)) >= GYM_READABILITY.EDGE_LUMA_DELTA) {
          isEdge = true;
        }
      }
      if (isEdge) edges += 1;
      if (here >= GYM_READABILITY.FIGURE_BAND_LUMA) bright += 1;
      const inBehind = x >= behind.x0 && x <= behind.x1 && y >= behind.y0 && y <= behind.y1;
      if (inBehind) {
        behindPx += 1;
        if (isEdge) behindEdges += 1;
      }
    }
  }

  // --- rim separation -------------------------------------------------------
  const rim: number[] = [];
  for (let y = 0; y < grid.h; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      if (!subjectAt(x, y)) continue;
      for (const step of NEIGHBOURS) {
        const dx = step[0] ?? 0;
        const dy = step[1] ?? 0;
        if (subjectAt(x + dx, y + dy)) continue;
        // Walk out into the room. Anything that is not background out there —
        // another limb across a gap, the edge of the grid — is not the room and
        // is not this measure's business.
        const ox = x + dx * GYM_READABILITY.RIM_PROBE_PX;
        const oy = y + dy * GYM_READABILITY.RIM_PROBE_PX;
        if (!backgroundAt(ox, oy)) continue;
        let blocked = false;
        for (let s = 1; s <= GYM_READABILITY.RIM_PROBE_PX; s += 1) {
          if (subjectAt(x + dx * s, y + dy * s)) blocked = true;
        }
        if (blocked) continue;
        // ...and in from the boundary, so the sample is the figure rather than
        // the sprite's own keyline.
        let ix = x;
        let iy = y;
        for (let s = 1; s <= GYM_READABILITY.RIM_INSET_PX; s += 1) {
          if (!subjectAt(x - dx * s, y - dy * s)) break;
          ix = x - dx * s;
          iy = y - dy * s;
        }
        rim.push(Math.abs(lumaAt(grid, ix, iy) - lumaAt(grid, ox, oy)));
      }
    }
  }

  const backgroundPx = backgroundLumas.length;
  const figurePx = figureLumas.length;
  const sortedFigure = [...figureLumas].sort((a, b) => a - b);
  const sortedBackground = [...backgroundLumas].sort((a, b) => a - b);
  const figureMedian = percentiles(sortedFigure).p50;
  const overFigure = sortedBackground.filter((v) => v > figureMedian).length;
  const mean = (values: readonly number[]): number =>
    values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

  return {
    backgroundPx,
    figurePx,
    barbellPx,
    backgroundIndexCount: indices.size,
    backgroundMeanLuma: mean(backgroundLumas),
    figureMeanLuma: mean(figureLumas),
    figureLuma: percentiles(sortedFigure),
    backgroundLuma: percentiles(sortedBackground),
    backgroundEdgeShare: backgroundPx === 0 ? 0 : edges / backgroundPx,
    behindEdgeShare: behindPx === 0 ? 0 : behindEdges / behindPx,
    behindPx,
    backgroundBrightShare: backgroundPx === 0 ? 0 : bright / backgroundPx,
    backgroundOverFigureShare: backgroundPx === 0 ? 0 : overFigure / backgroundPx,
    rimSamples: rim.length,
    rimContrast: percentiles([...rim].sort((a, b) => a - b)),
  };
}

/** One line per quantity, for putting real numbers in a report. */
export function formatReadability(r: SceneReadability): string {
  const pct = (v: number): string => `${(v * 100).toFixed(2)}%`;
  const n = (v: number): string => v.toFixed(1);
  return [
    `background   ${r.backgroundPx} px, ${r.backgroundIndexCount} indices, mean luma ${n(r.backgroundMeanLuma)}`,
    `             p05 ${n(r.backgroundLuma.p05)} p50 ${n(r.backgroundLuma.p50)} p90 ${n(r.backgroundLuma.p90)}`,
    `figure       ${r.figurePx} px, mean luma ${n(r.figureMeanLuma)}, p50 ${n(r.figureLuma.p50)} p90 ${n(r.figureLuma.p90)}`,
    `barbell      ${r.barbellPx} px`,
    `edge share   all ${pct(r.backgroundEdgeShare)}, behind the figure ${pct(r.behindEdgeShare)} of ${r.behindPx} px`,
    `bright share ${pct(r.backgroundBrightShare)} at/over ${GYM_READABILITY.FIGURE_BAND_LUMA}, ${pct(r.backgroundOverFigureShare)} over the figure median`,
    `rim contrast ${r.rimSamples} samples, p05 ${n(r.rimContrast.p05)} p10 ${n(r.rimContrast.p10)} p25 ${n(r.rimContrast.p25)} p50 ${n(r.rimContrast.p50)}`,
  ].join('\n');
}
