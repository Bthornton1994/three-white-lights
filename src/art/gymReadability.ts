/**
 * Does the figure still read once the room is behind it?
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A MODULE AND NOT A PARAGRAPH IN A TEST
 * ---------------------------------------------------------------------------
 * GDD §12.2 grades this piece on "readability at phone scale, not just
 * fidelity". That half of the bar is measurable, so it is measured on the
 * composited pixels — scene grid with the lifter blitted into it — rather than
 * on the two layers reasoned about separately.
 *
 * ---------------------------------------------------------------------------
 * AND THE COMPOSITE IS WHAT SURVIVES WHAT IS PAINTED ON TOP OF IT
 * ---------------------------------------------------------------------------
 * The first version of this file claimed to measure "the actual composited
 * pixels the screen shows" and did not. `LiftStage.tsx` paints an opaque
 * bar-path panel over the right-hand strip of the canvas AFTER the room, and at
 * `GYM_LIFT_STAGE.SCALE` that panel hides 4160 of the room's 22490 pixels —
 * 18.5% — on every frame. The hidden fifth was not a neutral sample of the room:
 * the dumbbell rack was 73% behind it, the loaded bar 62%, the flat bench 32%,
 * and the third of three lamp filaments entirely. Every share in this file was a
 * fraction over a population a fifth of which nobody can see.
 *
 * So the measurement takes OCCLUDERS. A pixel under one is not background, not
 * figure, not an edge, not a rim sample and not a denominator. The occluders for
 * the shipped stage come from `liftStageOccluders()`, which derives them from
 * the screen's own layout, and `gymScene.test.ts` re-derives that from
 * `LIFT_TUNING.LAYOUT` so the two cannot drift apart.
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
 *   - `backgroundIndexCount` — falls to one on a flat fill. It is NOT a
 *     furniture count and no longer claims to be: the shell of the room alone —
 *     wall bands, courses, joints, windows, stripe, kickplate, floor bands,
 *     platform, steel, seams, lamp wash — reaches about twenty indices with
 *     nothing standing in the room at all. `furnitureShare` is the bound that
 *     actually needs furniture; see its own note.
 *   - `furnitureShare` — how much of the visible room breaks a horizontal band.
 *     The shell is bands: every boundary it draws runs left to right, so it
 *     scores near zero however many colours it spends. A rack, a bench, a plate
 *     tree and a lamp stem are uprights and score. A checkerboard scores
 *     enormously, which is why it is bounded above as well.
 *   - `contentBalance` / `contentCells` — WHERE the content is, not how much.
 *     Every other number in this file is invariant under permuting the props;
 *     these two are not, and that is what they are for.
 *   - `rimContrast` percentiles — a background that matches any part of the
 *     figure's own value range drives the low percentiles down, whether it
 *     matches by being too bright OR by sitting on the figure's shadow steps
 *     (the lifter's SINGLET_DARK is luma 54 and his GEAR_DARK is 59, so a
 *     "safe, dark" wall at 55 is a worse background than a pale one).
 *   - `backgroundOverFigureShare` — the share of the room brighter than the
 *     median pixel of the lifter. Nothing makes this smaller than a black
 *     screen, so it is bracketed by the two above rather than trusted alone.
 *
 * ---------------------------------------------------------------------------
 * TWO RIM NUMBERS, BECAUSE A KEYLINE AND A FILL ARE DIFFERENT QUESTIONS
 * ---------------------------------------------------------------------------
 * `rimContrast` samples the outermost reachable pixel of the figure against the
 * room three pixels out. On a 16-bit sprite that pixel is usually the KEYLINE,
 * and the lifter's two keylines are luma 9 (equipment) and 19 (body). A room
 * value clearing both by even `PERCEPTIBLE_LUMA_STEP` has to be 29 or brighter
 * — and a room whose DARKEST band is 29 cannot hold the bottom of the range,
 * which is the whole reason the figure owns the top of it. So a perceptual floor
 * on `rimContrast` is not something any dark room can pass, and pretending
 * otherwise would be inventing a bound nobody can meet.
 *
 * `rimFill` is the same crossing measured as the BEST separation available
 * anywhere in the first `RIM_INSET_PX` pixels of the figure — keyline or the
 * paint behind it. That is the question the eye is actually asking at a
 * silhouette, and it is the one a perceptual floor belongs on. It is bounded at
 * `PERCEPTIBLE_LUMA_STEP` and above; `rimContrast` is reported and bounded at
 * what a dark room can structurally reach, with the arithmetic above as the
 * reason rather than a shrug.
 *
 * WHAT IT CANNOT SAY. Nothing here is a judgement about whether the room looks
 * like a gym, whether it looks 16-bit, or whether it looks good. It says the
 * figure separates from it and that the room has things in it, arranged. GDD
 * §12.2's other clause — the blind era A/B — needs a human and a reference this
 * repository does not have; see `docs/reference/README.md`.
 */

import { BANK_SIZE, isTransparentIndex } from './palette';
import { lumaOfIndex } from './gymPalette';
import { getPx, type IndexGrid } from './raster';
import { GYM_READABILITY } from './gymTuning';
import type { SceneRect } from './gymScene';

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
  /** Pixels of the grid the screen actually shows, and pixels it does not. */
  readonly visiblePx: number;
  readonly hiddenPx: number;
  readonly backgroundPx: number;
  readonly figurePx: number;
  readonly barbellPx: number;
  /** Distinct palette indices in the VISIBLE background. One means a flat fill. */
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
  /**
   * Share of background forming a hard luma step with a HORIZONTAL neighbour —
   * the room's uprights. The shell of a room is bands and scores near zero.
   */
  readonly furnitureShare: number;
  /**
   * Content density per cell of a `COMPOSITION_COLS` x `COMPOSITION_ROWS` grid
   * over the visible region, row-major from the top-left. Not permutation
   * invariant: move a prop and these move.
   */
  readonly contentCells: readonly number[];
  /** Cells holding at least a `CELL_SHARE` of the room's content. */
  readonly filledCells: number;
  /**
   * Content left of the figure's centre column minus content right of it, over
   * their sum. -1 is all of it on his right, +1 all of it on his left.
   */
  readonly contentBalance: number;
  /** The busiest cell's share of all the content in the room. */
  readonly contentPeak: number;
  /** Share of background at or above the figure's own top band. */
  readonly backgroundBrightShare: number;
  /** Share of background brighter than the figure's median pixel. */
  readonly backgroundOverFigureShare: number;
  /** |Δluma| across the silhouette, figure edge vs. room outside. */
  readonly rimSamples: number;
  readonly rimContrast: Percentiles;
  /** The same crossings, taking the best separation the first few px offer. */
  readonly rimFill: Percentiles;
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

export interface ReadabilityOptions {
  /**
   * Whether the barbell counts as part of the thing that has to read. It does by
   * default, because GDD §12.2's bar for this piece says the environment must
   * not reduce the readability of the bar path either — a rack drawn behind the
   * discs is exactly the failure that would hide.
   */
  readonly subjectIsBarbell?: boolean;
  /**
   * Boxes of the grid the screen paints over opaquely. Pixels inside one are not
   * measured at all. Empty means "nothing is drawn over this image", which is
   * true of an offline contact sheet and false of every real screen.
   */
  readonly occluders?: readonly SceneRect[];
}

/** Measure one composited frame, as the screen shows it. */
export function measureSceneReadability(
  grid: IndexGrid,
  options: ReadabilityOptions = {},
): SceneReadability {
  const countBarbell = options.subjectIsBarbell ?? true;
  const occluders = options.occluders ?? [];
  const roles: PixelRole[] = new Array<PixelRole>(grid.w * grid.h).fill('nothing');
  const luma = new Float64Array(grid.w * grid.h);
  const hidden = new Uint8Array(grid.w * grid.h);

  let hiddenPx = 0;
  for (const rect of occluders) {
    for (let y = Math.max(0, rect.y0); y <= Math.min(grid.h - 1, rect.y1); y += 1) {
      for (let x = Math.max(0, rect.x0); x <= Math.min(grid.w - 1, rect.x1); x += 1) {
        if (hidden[y * grid.w + x] === 1) continue;
        hidden[y * grid.w + x] = 1;
        hiddenPx += 1;
      }
    }
  }
  const visible = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < grid.w && y < grid.h && hidden[y * grid.w + x] === 0;

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
      if (!visible(x, y)) continue;
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
    if (!visible(x, y)) return false;
    const role = roles[y * grid.w + x];
    return role === 'figure' || (countBarbell && role === 'barbell');
  };
  const backgroundAt = (x: number, y: number): boolean => {
    if (!visible(x, y)) return false;
    return roles[y * grid.w + x] === 'background';
  };

  // --- the composition grid --------------------------------------------------
  // Over the WHOLE FRAME, not over the visible part of it. The question is how
  // the content is spread across what the player is looking at, and a quarter of
  // the frame that a panel is sitting on genuinely has nothing in it. Measuring
  // over the visible region instead would quietly re-normalise that away.
  const cols = GYM_READABILITY.COMPOSITION_COLS;
  const rows = GYM_READABILITY.COMPOSITION_ROWS;
  const cellContent = new Float64Array(cols * rows);

  // --- busyness, uprights, composition --------------------------------------
  const margin = GYM_READABILITY.BEHIND_MARGIN_PX;
  const behind = {
    x0: minX - margin,
    x1: maxX + margin,
    y0: minY - margin,
    y1: maxY + margin,
  };
  const subjectCentreX = maxX < minX ? Math.floor(grid.w / 2) : Math.round((minX + maxX) / 2);
  let edges = 0;
  let uprights = 0;
  let behindEdges = 0;
  let behindPx = 0;
  let bright = 0;
  let leftContent = 0;
  let rightContent = 0;
  for (let y = 0; y < grid.h; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      if (!backgroundAt(x, y)) continue;
      const here = luma[y * grid.w + x] ?? 0;
      let isEdge = false;
      let isUpright = false;
      for (const [dx, dy] of FORWARD_NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!backgroundAt(nx, ny)) continue;
        if (Math.abs(here - (luma[ny * grid.w + nx] ?? 0)) >= GYM_READABILITY.EDGE_LUMA_DELTA) {
          isEdge = true;
          // A step across a HORIZONTAL neighbour is a vertical boundary: an
          // upright. Bands do not make these; furniture does.
          if (dx !== 0) isUpright = true;
        }
      }
      if (isEdge) edges += 1;
      if (isUpright) {
        uprights += 1;
        const ci = Math.min(cols - 1, Math.floor((x * cols) / grid.w));
        const ri = Math.min(rows - 1, Math.floor((y * rows) / grid.h));
        const cell = ri * cols + ci;
        cellContent[cell] = (cellContent[cell] ?? 0) + 1;
        if (x < subjectCentreX) leftContent += 1;
        else rightContent += 1;
      }
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
  const rimBest: number[] = [];
  for (let y = 0; y < grid.h; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      if (!subjectAt(x, y)) continue;
      for (const step of NEIGHBOURS) {
        const dx = step[0] ?? 0;
        const dy = step[1] ?? 0;
        if (subjectAt(x + dx, y + dy)) continue;
        // Walk out into the room. Anything that is not visible background out
        // there — another limb across a gap, the edge of the grid, a panel
        // painted over the room — is not the room and is not this measure's
        // business.
        const ox = x + dx * GYM_READABILITY.RIM_PROBE_PX;
        const oy = y + dy * GYM_READABILITY.RIM_PROBE_PX;
        if (!backgroundAt(ox, oy)) continue;
        let blocked = false;
        for (let s = 1; s <= GYM_READABILITY.RIM_PROBE_PX; s += 1) {
          if (subjectAt(x + dx * s, y + dy * s)) blocked = true;
        }
        if (blocked) continue;
        const outside = luma[oy * grid.w + ox] ?? 0;
        // ...and in from the boundary, so the sample is the figure rather than
        // the sprite's own keyline.
        let ix = x;
        let iy = y;
        let best = Math.abs((luma[y * grid.w + x] ?? 0) - outside);
        for (let s = 1; s <= GYM_READABILITY.RIM_INSET_PX; s += 1) {
          if (!subjectAt(x - dx * s, y - dy * s)) break;
          ix = x - dx * s;
          iy = y - dy * s;
          const step2 = Math.abs((luma[iy * grid.w + ix] ?? 0) - outside);
          if (step2 > best) best = step2;
        }
        rim.push(Math.abs((luma[iy * grid.w + ix] ?? 0) - outside));
        rimBest.push(best);
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

  const cellShares = Array.from(cellContent, (v) => (uprights === 0 ? 0 : v / uprights));
  const peak = cellShares.length === 0 ? 0 : Math.max(...cellShares);
  const evenShare = cellShares.length === 0 ? 0 : 1 / cellShares.length;

  return {
    visiblePx: grid.w * grid.h - hiddenPx,
    hiddenPx,
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
    furnitureShare: backgroundPx === 0 ? 0 : uprights / backgroundPx,
    contentCells: cellShares,
    // "Holds its share" is measured against an even spread rather than against a
    // fresh constant: a cell counts as filled once it carries its stated
    // fraction of what it would carry if the room were laid out evenly.
    filledCells: cellShares.filter(
      (v) => v >= evenShare * GYM_READABILITY.CELL_FILLED_FRACTION_OF_EVEN,
    ).length,
    contentBalance:
      leftContent + rightContent === 0
        ? 0
        : (leftContent - rightContent) / (leftContent + rightContent),
    contentPeak: peak,
    backgroundBrightShare: backgroundPx === 0 ? 0 : bright / backgroundPx,
    backgroundOverFigureShare: backgroundPx === 0 ? 0 : overFigure / backgroundPx,
    rimSamples: rim.length,
    rimContrast: percentiles([...rim].sort((a, b) => a - b)),
    rimFill: percentiles([...rimBest].sort((a, b) => a - b)),
  };
}

/** One line per quantity, for putting real numbers in a report. */
export function formatReadability(r: SceneReadability): string {
  const pct = (v: number): string => `${(v * 100).toFixed(2)}%`;
  const n = (v: number): string => v.toFixed(1);
  return [
    `visible      ${r.visiblePx} px, ${r.hiddenPx} hidden by chrome (${pct(r.hiddenPx / Math.max(1, r.hiddenPx + r.visiblePx))})`,
    `background   ${r.backgroundPx} px, ${r.backgroundIndexCount} indices, mean luma ${n(r.backgroundMeanLuma)}`,
    `             p05 ${n(r.backgroundLuma.p05)} p50 ${n(r.backgroundLuma.p50)} p90 ${n(r.backgroundLuma.p90)}`,
    `figure       ${r.figurePx} px, mean luma ${n(r.figureMeanLuma)}, p50 ${n(r.figureLuma.p50)} p90 ${n(r.figureLuma.p90)}`,
    `barbell      ${r.barbellPx} px`,
    `edge share   all ${pct(r.backgroundEdgeShare)}, behind the figure ${pct(r.behindEdgeShare)} of ${r.behindPx} px`,
    `furniture    ${pct(r.furnitureShare)} of the visible room is an upright`,
    `composition  balance ${r.contentBalance.toFixed(2)}, peak cell ${pct(r.contentPeak)}, ${r.filledCells}/${r.contentCells.length} cells filled`,
    `             cells ${r.contentCells.map((v) => pct(v)).join(' ')}`,
    `bright share ${pct(r.backgroundBrightShare)} at/over ${GYM_READABILITY.FIGURE_BAND_LUMA}, ${pct(r.backgroundOverFigureShare)} over the figure median`,
    `rim keyline  ${r.rimSamples} samples, p05 ${n(r.rimContrast.p05)} p10 ${n(r.rimContrast.p10)} p25 ${n(r.rimContrast.p25)} p50 ${n(r.rimContrast.p50)}`,
    `rim fill     p05 ${n(r.rimFill.p05)} p10 ${n(r.rimFill.p10)} p25 ${n(r.rimFill.p25)} p50 ${n(r.rimFill.p50)}`,
  ].join('\n');
}
