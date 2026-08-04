/**
 * Gym props — the authored drawings the environment layer stamps.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS DATA AND NOT A KNOB
 * ---------------------------------------------------------------------------
 * Registered in `src/tuning/audit.ts` as `kind: 'data'`, alongside `rig.ts` and
 * `spriteMarks.ts`, and for the same reason those are: a coordinate in here
 * cannot be turned in isolation. Moving the third rect of a power rack two
 * pixels left does not make the rack "more" of anything — it breaks the rack.
 * These are drawings. What a playtester turns is WHERE they are placed and HOW
 * MUCH of the room they take up, and that is `gymTuning.ts`.
 *
 * ---------------------------------------------------------------------------
 * WHY RECTANGLES
 * ---------------------------------------------------------------------------
 * Because gym equipment is rectangles. A rack, a bench, a dumbbell rail and a
 * platform frame are all box section, and box section drawn as box section at
 * 30 px across is the whole of what makes it read. The two things that are not
 * — discs and bells — are built from a row-width table, which is exactly how a
 * pixel artist draws a small circle: you write down how wide each row is.
 *
 * Every rect names a palette index from `gymPalette.ts`. There is no shading
 * model behind a background layer, deliberately: `raster.ts`'s lamp is for the
 * figure, and running it over scenery would spend a lot of arithmetic making
 * the background more interesting, which is the opposite of the job.
 *
 * ---------------------------------------------------------------------------
 * THE LAMP IS UPPER-LEFT
 * ---------------------------------------------------------------------------
 * `SHADING.LIGHT_DIR` is `{ x: -0.52, y: -0.62, z: 0.59 }`, i.e. the key light
 * is above and to the left. Every tube in here therefore carries its one
 * `STEEL_LIT` column on its LEFT flank and its lit face on TOP. A background
 * lit from the other side than the figure is one of the loudest "assembled from
 * parts" tells there is, and it costs one column of pixels to avoid.
 */

import { GYM } from './gymPalette';

/** `[x, y, w, h, paletteIndex]`, relative to the prop's own top-left. */
export type PropRect = readonly [number, number, number, number, number];

/** Where a prop's box is pinned when it is placed into a scene. */
export type PropAnchor = 'floor' | 'ceiling';

export interface PropArt {
  readonly W: number;
  readonly H: number;
  readonly ANCHOR: PropAnchor;
  readonly RECTS: readonly PropRect[];
}

// ---------------------------------------------------------------------------
// Round things
// ---------------------------------------------------------------------------

/**
 * Row widths for a small disc, top to bottom. This IS the drawing of a circle
 * at this size — there is no radius that produces a better one, because at five
 * pixels across the only choices are which rows are 3 and which are 5.
 */
const DISC5_ROW_WIDTHS: readonly number[] = [3, 5, 5, 5, 3];
const DISC9_ROW_WIDTHS: readonly number[] = [5, 7, 9, 9, 9, 9, 9, 7, 5];
const DISC7_ROW_WIDTHS: readonly number[] = [3, 5, 7, 7, 7, 5, 3];

function discRects(
  widths: readonly number[],
  x: number,
  y: number,
  index: number,
): readonly PropRect[] {
  const span = Math.max(...widths);
  return widths.map((w, row) => [x + Math.floor((span - w) / 2), y + row, w, 1, index] as const);
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

export type GymPropKind =
  | 'POWER_RACK'
  | 'PLATE_TREE'
  | 'FLAT_BENCH'
  | 'DUMBBELL_RACK'
  | 'CHALK_STAND'
  | 'LOADED_BAR'
  | 'BUMPER_STACK'
  | 'KETTLEBELL_ROW'
  | 'CEILING_LAMP'
  | 'JUDGE_TABLE'
  | 'EQUIPMENT_CASE';

/**
 * THE CLOSED LIST OF THINGS THAT MAY APPEAR IN THE ROOM.
 *
 * Closed on purpose, and pinned by `gymScene.test.ts`. GDD §3.4 and §12.3
 * forbid a visible fatigue meter, and §12.3 is a refusal condition rather than
 * a preference — so "a wall-mounted readiness board" or "a gauge on the rack"
 * cannot arrive as scenery without an edit to this union and to the test that
 * pins it. There is no clock, no dial, no bar graph and no scoreboard in this
 * catalogue, and the scene renderer has no input from which one could be drawn:
 * `GymSceneSpec` carries a venue and a camera, and nothing about the player.
 */
export const PROP_ART: Readonly<Record<GymPropKind, PropArt>> = Object.freeze({
  /**
   * A power rack, seen head-on. 32 x 58 px is 0.93 m x 1.69 m at the sprite's
   * own PX_PER_METRE — a rack drawn true to a 1.2 m one would be a third of the
   * frame wide, so this is the compressed stage version, which is what a 16-bit
   * game would have shipped for the same reason.
   */
  POWER_RACK: Object.freeze({
    W: 32,
    H: 58,
    ANCHOR: 'floor',
    RECTS: Object.freeze<readonly PropRect[]>([
      // top crossbar, lit along its top face
      [0, 0, 32, 3, GYM.STEEL_FRAME],
      [0, 0, 32, 1, GYM.STEEL_LIT],
      // uprights, each with one lit column on the lamp side
      [1, 3, 4, 55, GYM.STEEL_FRAME],
      [1, 3, 1, 55, GYM.STEEL_LIT],
      [27, 3, 4, 55, GYM.STEEL_FRAME],
      [27, 3, 1, 55, GYM.STEEL_LIT],
      // pull-up bar
      [5, 4, 22, 2, GYM.STEEL_FRAME],
      [5, 4, 22, 1, GYM.STEEL_LIT],
      // adjustment holes — the detail that says "rack" and not "doorframe"
      [3, 12, 1, 1, GYM.RUBBER_DARK],
      [3, 18, 1, 1, GYM.RUBBER_DARK],
      [3, 24, 1, 1, GYM.RUBBER_DARK],
      [3, 30, 1, 1, GYM.RUBBER_DARK],
      [3, 36, 1, 1, GYM.RUBBER_DARK],
      [29, 12, 1, 1, GYM.RUBBER_DARK],
      [29, 18, 1, 1, GYM.RUBBER_DARK],
      [29, 24, 1, 1, GYM.RUBBER_DARK],
      [29, 30, 1, 1, GYM.RUBBER_DARK],
      [29, 36, 1, 1, GYM.RUBBER_DARK],
      // J-hooks at squat height
      [5, 21, 4, 3, GYM.STEEL_FRAME],
      [5, 21, 4, 1, GYM.STEEL_LIT],
      [23, 21, 4, 3, GYM.STEEL_FRAME],
      [23, 21, 4, 1, GYM.STEEL_LIT],
      // safety strap
      [5, 34, 22, 1, GYM.RUBBER_DARK],
      // feet
      [0, 55, 9, 3, GYM.STEEL_FRAME],
      [0, 55, 9, 1, GYM.STEEL_LIT],
      [23, 55, 9, 3, GYM.STEEL_FRAME],
      [23, 55, 9, 1, GYM.STEEL_LIT],
    ]),
  }),

  /**
   * A plate tree. The one prop that carries colour, and the reason the gym
   * banks hold three dimmed plate hues at all (GDD §7.1: plate colour is free
   * visual language). Denominations read left to right the way a loaded tree
   * does: the 25s at the bottom, the small stuff up top.
   */
  PLATE_TREE: Object.freeze({
    W: 15,
    H: 30,
    ANCHOR: 'floor',
    RECTS: Object.freeze<readonly PropRect[]>([
      [6, 0, 3, 27, GYM.STEEL_FRAME],
      [6, 0, 1, 27, GYM.STEEL_LIT],
      [2, 27, 11, 3, GYM.STEEL_FRAME],
      [2, 27, 11, 1, GYM.STEEL_LIT],
      // horns
      [4, 6, 3, 1, GYM.STEEL_FRAME],
      [8, 6, 3, 1, GYM.STEEL_FRAME],
      [4, 14, 3, 1, GYM.STEEL_FRAME],
      [8, 14, 3, 1, GYM.STEEL_FRAME],
      [4, 22, 3, 1, GYM.STEEL_FRAME],
      [8, 22, 3, 1, GYM.STEEL_FRAME],
      // discs, hung in pairs
      ...discRects(DISC5_ROW_WIDTHS, 0, 4, GYM.ACCENT_YELLOW),
      ...discRects(DISC5_ROW_WIDTHS, 10, 4, GYM.ACCENT_YELLOW),
      ...discRects(DISC5_ROW_WIDTHS, 0, 12, GYM.ACCENT_BLUE),
      ...discRects(DISC5_ROW_WIDTHS, 10, 12, GYM.ACCENT_BLUE),
      ...discRects(DISC5_ROW_WIDTHS, 0, 20, GYM.ACCENT_RED),
      ...discRects(DISC5_ROW_WIDTHS, 10, 20, GYM.ACCENT_RED),
    ]),
  }),

  /** A flat bench in profile. */
  FLAT_BENCH: Object.freeze({
    W: 28,
    H: 13,
    ANCHOR: 'floor',
    RECTS: Object.freeze<readonly PropRect[]>([
      [2, 0, 24, 3, GYM.RUBBER_DARK],
      [2, 0, 24, 1, GYM.STEEL_FRAME],
      [4, 3, 20, 1, GYM.STEEL_FRAME],
      [5, 4, 3, 9, GYM.STEEL_FRAME],
      [5, 4, 1, 9, GYM.STEEL_LIT],
      [20, 4, 3, 9, GYM.STEEL_FRAME],
      [20, 4, 1, 9, GYM.STEEL_LIT],
      [3, 11, 7, 2, GYM.STEEL_FRAME],
      [18, 11, 7, 2, GYM.STEEL_FRAME],
    ]),
  }),

  /** A two-tier dumbbell rail. */
  DUMBBELL_RACK: Object.freeze({
    W: 30,
    H: 17,
    ANCHOR: 'floor',
    RECTS: Object.freeze<readonly PropRect[]>([
      [0, 0, 3, 17, GYM.STEEL_FRAME],
      [0, 0, 1, 17, GYM.STEEL_LIT],
      [27, 0, 3, 17, GYM.STEEL_FRAME],
      [27, 0, 1, 17, GYM.STEEL_LIT],
      [0, 3, 30, 2, GYM.STEEL_FRAME],
      [0, 12, 30, 2, GYM.STEEL_FRAME],
      // top tier — the light ones
      [4, 0, 4, 3, GYM.RUBBER_DARK],
      [4, 0, 4, 1, GYM.STEEL_LIT],
      [10, 0, 4, 3, GYM.RUBBER_DARK],
      [10, 0, 4, 1, GYM.STEEL_LIT],
      [16, 0, 4, 3, GYM.RUBBER_DARK],
      [16, 0, 4, 1, GYM.STEEL_LIT],
      [22, 0, 4, 3, GYM.RUBBER_DARK],
      [22, 0, 4, 1, GYM.STEEL_LIT],
      // bottom tier — the heavy ones, wider
      [4, 8, 6, 4, GYM.RUBBER_DARK],
      [4, 8, 6, 1, GYM.STEEL_LIT],
      [12, 8, 6, 4, GYM.RUBBER_DARK],
      [12, 8, 6, 1, GYM.STEEL_LIT],
      [20, 8, 6, 4, GYM.RUBBER_DARK],
      [20, 8, 6, 1, GYM.STEEL_LIT],
    ]),
  }),

  /**
   * A chalk bowl on a stand. Small, and one of the two places in the room where
   * CHALK_DUST appears — GDD §7.1 names chalk as one of the things a 16-bit
   * palette buys that a 4-shade one does not, so the room says so.
   */
  CHALK_STAND: Object.freeze({
    W: 9,
    H: 15,
    ANCHOR: 'floor',
    RECTS: Object.freeze<readonly PropRect[]>([
      [3, 4, 3, 9, GYM.STEEL_FRAME],
      [3, 4, 1, 9, GYM.STEEL_LIT],
      [1, 13, 7, 2, GYM.STEEL_FRAME],
      [1, 13, 7, 1, GYM.STEEL_LIT],
      [0, 2, 9, 2, GYM.RUBBER_DARK],
      [1, 1, 7, 1, GYM.STEEL_FRAME],
      [2, 0, 5, 1, GYM.CHALK_DUST],
      [3, 1, 3, 1, GYM.CHALK_DUST],
    ]),
  }),

  /** A loaded bar left on the floor, seen from the side. */
  LOADED_BAR: Object.freeze({
    W: 42,
    H: 9,
    ANCHOR: 'floor',
    RECTS: Object.freeze<readonly PropRect[]>([
      [0, 3, 42, 2, GYM.STEEL_FRAME],
      [0, 3, 42, 1, GYM.STEEL_LIT],
      ...discRects(DISC9_ROW_WIDTHS, 5, 0, GYM.ACCENT_RED),
      ...discRects(DISC9_ROW_WIDTHS, 28, 0, GYM.ACCENT_RED),
      [15, 2, 2, 4, GYM.STEEL_FRAME],
      [25, 2, 2, 4, GYM.STEEL_FRAME],
    ]),
  }),

  /** Three discs leaned against the wall, overlapping. */
  BUMPER_STACK: Object.freeze({
    W: 13,
    H: 13,
    ANCHOR: 'floor',
    RECTS: Object.freeze<readonly PropRect[]>([
      ...discRects(DISC9_ROW_WIDTHS, 0, 4, GYM.RUBBER_DARK),
      ...discRects(DISC9_ROW_WIDTHS, 2, 2, GYM.ACCENT_BLUE),
      ...discRects(DISC7_ROW_WIDTHS, 5, 0, GYM.ACCENT_YELLOW),
    ]),
  }),

  /** Three kettlebells on the floor. */
  KETTLEBELL_ROW: Object.freeze({
    W: 19,
    H: 7,
    ANCHOR: 'floor',
    RECTS: Object.freeze<readonly PropRect[]>([
      [1, 0, 3, 1, GYM.STEEL_FRAME],
      [1, 1, 1, 1, GYM.STEEL_FRAME],
      [3, 1, 1, 1, GYM.STEEL_FRAME],
      ...discRects(DISC5_ROW_WIDTHS, 0, 2, GYM.RUBBER_DARK),
      [8, 0, 3, 1, GYM.STEEL_FRAME],
      [8, 1, 1, 1, GYM.STEEL_FRAME],
      [10, 1, 1, 1, GYM.STEEL_FRAME],
      ...discRects(DISC5_ROW_WIDTHS, 7, 2, GYM.RUBBER_DARK),
      [15, 0, 3, 1, GYM.STEEL_FRAME],
      [15, 1, 1, 1, GYM.STEEL_FRAME],
      [17, 1, 1, 1, GYM.STEEL_FRAME],
      ...discRects(DISC5_ROW_WIDTHS, 14, 2, GYM.RUBBER_DARK),
    ]),
  }),

  /**
   * A shop lamp on a stem. Ceiling-anchored, so it hangs from the top of the
   * scene rather than standing on the floor.
   *
   * LAMP_CORE is the only index in either gym bank above luma 150 and this is
   * the only prop that uses it, over 7 px. That is the shape of the rule: a
   * light source may be bright, and it may not be big.
   */
  CEILING_LAMP: Object.freeze({
    W: 12,
    H: 11,
    ANCHOR: 'ceiling',
    RECTS: Object.freeze<readonly PropRect[]>([
      [6, 0, 1, 4, GYM.TRUSS],
      [4, 4, 5, 1, GYM.LAMP_HOUSING],
      [3, 5, 7, 1, GYM.LAMP_HOUSING],
      [2, 6, 9, 1, GYM.LAMP_HOUSING],
      [1, 7, 11, 1, GYM.LAMP_HOUSING],
      [3, 8, 7, 1, GYM.LAMP_CORE],
      [4, 9, 5, 1, GYM.LAMP_GLOW],
      [5, 10, 3, 1, GYM.LAMP_GLOW],
    ]),
  }),

  /** Meet venue: the jury table at the edge of the platform. */
  JUDGE_TABLE: Object.freeze({
    W: 26,
    H: 11,
    ANCHOR: 'floor',
    RECTS: Object.freeze<readonly PropRect[]>([
      [0, 0, 26, 2, GYM.STEEL_FRAME],
      [0, 0, 26, 1, GYM.STEEL_LIT],
      [1, 2, 24, 7, GYM.CROWD_DARK],
      [1, 9, 24, 2, GYM.RUBBER_DARK],
      [4, 4, 4, 1, GYM.CROWD_MID],
      [12, 4, 6, 1, GYM.CROWD_MID],
    ]),
  }),

  /** Meet venue: the equipment/loading crates behind the platform. */
  EQUIPMENT_CASE: Object.freeze({
    W: 18,
    H: 14,
    ANCHOR: 'floor',
    RECTS: Object.freeze<readonly PropRect[]>([
      [0, 0, 18, 14, GYM.RUBBER_DARK],
      [0, 0, 18, 1, GYM.STEEL_FRAME],
      [0, 0, 1, 14, GYM.STEEL_FRAME],
      [0, 6, 18, 1, GYM.STEEL_FRAME],
      [4, 2, 10, 3, GYM.CROWD_DARK],
      [4, 8, 10, 3, GYM.CROWD_DARK],
    ]),
  }),
});

/** Every prop kind, in catalogue order. Pinned by test. */
export const GYM_PROP_KINDS: readonly GymPropKind[] = Object.freeze(
  Object.keys(PROP_ART) as GymPropKind[],
);
