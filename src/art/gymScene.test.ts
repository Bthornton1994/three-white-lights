import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { codeOnly } from '../tuning/audit';
import { LIFT_TUNING } from '../game/liftTuning';
import { CENTER_X, RESOLUTION } from './spriteTuning';
import { BANK_SIZE, PAL, isTransparentIndex } from './palette';
import { GYM, lumaOfIndex, sceneColorAt } from './gymPalette';
import { GYM_PROP_KINDS, PROP_ART } from './gymProps';
import {
  GYM_BANNER,
  GYM_CLEAR_BAND,
  GYM_CONTACT_SHADOW,
  GYM_LIFT_FOCUS_X,
  GYM_LIFT_STAGE,
  GYM_LIGHTING,
  GYM_PARALLAX,
  GYM_PROPS_MEET,
  GYM_PROPS_TRAINING,
  GYM_READABILITY,
  GYM_ROOM,
  GYM_STAGE_CHROME,
  GYM_VENUE_PROPS,
  GYM_WINDOWS,
  type GymPropPlacement,
  type GymVenue,
} from './gymTuning';
import {
  blitOver,
  clearBand,
  contactShadowPatch,
  floorDepth,
  junctionRow,
  layerOffset,
  liftContactShadow,
  liftStageOccluders,
  liftStageScene,
  platformBackRow,
  propBox,
  rectsOverlap,
  renderGymScene,
  sceneProps,
  type GymSceneSpec,
  type SceneRect,
} from './gymScene';
import { formatReadability, measureSceneReadability, roleOf } from './gymReadability';
import { createGrid, getPx, setPx, type IndexGrid } from './raster';
import { LOAD_PRESETS } from './spriteTuning';
import { buildSquatRep } from './squatAnimation';
import { frameSpecFrom, isBodyIndex, renderLifterFrame } from './lifterSprite';

/**
 * ===========================================================================
 * WHAT THIS FILE IS FOR
 * ===========================================================================
 * GDD §12.2 grades the gym on two clauses. One of them — "blind A/B, same era"
 * — is not decidable here: `docs/reference/README.md` records that no 16-bit
 * gym-interior reference is committed, and CLAUDE.md says a bar that cannot be
 * compared against its reference is reported unverifiable rather than passed.
 * Nothing in this file claims it.
 *
 * The other clause — "readability at phone scale" — is measurable, and this is
 * where it is measured, ON THE PIXELS THAT SURVIVE THE SCREEN.
 *
 * ===========================================================================
 * WHAT THE SCREEN PAINTS OVER THE ROOM IS PART OF THE COMPOSITE
 * ===========================================================================
 * `LiftStage.tsx` draws an opaque bar-path panel over the right-hand strip of
 * the canvas after the room. It hides 4160 of the room's 22490 pixels on every
 * frame, and the previous version of this file counted every one of them as
 * visible. `liftStageOccluders()` is now passed to every measurement here, and
 * `describe('the panel is part of the composite')` proves the numbers move when
 * the panel widens — which under the old measurement they could not.
 *
 * ===========================================================================
 * EVERY BOUND IS BRACKETED AT BOTH ENDS
 * ===========================================================================
 * The failure this run keeps finding is a check that a WORSE artifact satisfies
 * more easily. Every readability quantity here has that shape available, and
 * every one is therefore bounded on both sides:
 *
 *   - a blank black rectangle has PERFECT rim contrast and zero busyness. It
 *     fails `MEAN_LUMA`, `INDEX_COUNT`, `EDGE_SHARE`, `FURNITURE_SHARE`,
 *     `FILLED_CELLS` and `BRIGHT_SHARE` floors.
 *   - a lit, cluttered room has plenty of content. It fails the `EDGE_SHARE`,
 *     `BEHIND_EDGE_SHARE`, `FURNITURE_SHARE` and `OVER_FIGURE_SHARE` ceilings.
 *   - a room drawn in the figure's own value band passes both of those and
 *     fails the `RIM_*` floors.
 *   - a room with the SHELL and no furniture in it passes everything the old
 *     `INDEX_COUNT` floor was pretending to catch — a bare shell reaches twenty
 *     indices on its own — and fails `FURNITURE_SHARE` and `FILLED_CELLS`.
 *   - a room with every prop shoved to one side passes all of those and fails
 *     `CONTENT_BALANCE`.
 *
 * `describe('the bounds bite')` plants each of those and asserts the SPECIFIC
 * bound that catches it. If a bound were ever loosened until it could not fail,
 * those tests go red rather than green.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// THE BOUNDS
// ---------------------------------------------------------------------------

/**
 * The pass/fail bar for a composited frame.
 *
 * Deliberately here and not in `gymTuning.ts`. The measurement's terms — what
 * counts as an edge, how far out the rim is probed, what luma step counts as
 * visible — are tuning, because they define the instrument. A BAR is not tuning;
 * it belongs where it can be read next to the numbers it is judging, and where
 * moving it is an edit to a test rather than a knob in a file whose whole
 * invitation is "turn these".
 *
 * ---------------------------------------------------------------------------
 * MEASURED VALUES, WITH THE PANEL COUNTED AS OPAQUE
 * ---------------------------------------------------------------------------
 * Training gym, four squat depths, and the meet venue, all with the bar-path
 * panel occluding 4160 px — so the headroom below is visible rather than
 * implied. The bracketed figure is the same quantity with the occluder REMOVED,
 * where it differs, which is what the previous version of this file reported:
 *
 *   indices            26-27          mean luma  36.8-37.1  (35.7 unoccluded)
 *   luma p90           54.6-71.8      edge share 12.2-12.7% (10.9 unoccluded)
 *   behind edge share  20.3-23.9%     bright     0.08-0.09% (0.10 unoccluded)
 *   over figure median 8.4-9.5%       (7.6 unoccluded)
 *   furniture share    5.5-6.0%       (4.8 unoccluded)
 *   content balance    -0.01..+0.15   (-0.05 unoccluded)
 *   filled cells       8-9 of 12      (9 unoccluded)
 *   rim keyline p05/p25/p50   11.3-15.4 / 25.0 / 39.1-45.7
 *   rim fill    p05/p10        11.4-24.5 / 24.3-25.0
 *
 * And the planted rooms, for the same quantities, so the headroom is on the
 * record in both directions:
 *
 *   deleted layer   1 index, mean 10.9, edge 0%,     furn 0%,    cells 0/12
 *   checker         2,       mean 48.2, edge 54.4%,  furn 32.4%, rim p05 1.9
 *   figure-band     14,      mean 55.8, edge 7.2%,   rim keyline p05 3.6 p25 15.0
 *   shell, no props 20,      mean 35.9, edge 8.1%,   furn 3.4%,  cells 6/12
 *   props all-left  27,      mean 37.1, edge 12.5%,  balance 0.441
 *
 * Read the last two rows twice. The bare shell reaches TWENTY indices with
 * nothing standing in the room, which is why `INDEX_COUNT_MIN` no longer claims
 * to be a furniture floor and `FURNITURE_SHARE_MIN` is. And the all-left room
 * is byte-for-byte the same furniture as the shipped one, moved: every quantity
 * above it except `CONTENT_BALANCE` is within a point of the shipped room's.
 */
const BOUNDS = {
  /**
   * A flat fill has one. NOT A FURNITURE COUNT — the shell of the room alone
   * (wall bands, courses, joints, windows, stripe, kickplate, floor bands,
   * platform, seams, lamp wash, truss) measures 20 with the prop table empty, so
   * a floor of 14 is satisfied by a room with nothing in it. `FURNITURE_SHARE`
   * is the bound that needs furniture; this one only catches a flat fill and is
   * documented as doing only that.
   */
  INDEX_COUNT_MIN: 14,
  /** The whole scene index space is 36; a cap much above that says nothing. */
  INDEX_COUNT_MAX: 34,
  /** Black screen 10.9 fails this. */
  MEAN_LUMA_MIN: 25,
  /** A room bright enough to compete with the figure fails this. */
  MEAN_LUMA_MAX: 70,
  P90_LUMA_MIN: 40,
  P90_LUMA_MAX: 90,
  /** Zero on an empty room. */
  EDGE_SHARE_MIN: 0.03,
  /** A checker, or a room full of high-contrast clutter, exceeds this. */
  EDGE_SHARE_MAX: 0.14,
  BEHIND_EDGE_SHARE_MIN: 0.02,
  BEHIND_EDGE_SHARE_MAX: 0.28,
  /**
   * THE FURNITURE FLOOR, and this one really does need furniture.
   *
   * `furnitureShare` counts only steps across a HORIZONTAL neighbour — vertical
   * boundaries, uprights. The shell of this room is bands: every mark it makes
   * runs left to right, so it scores 3.4% however many colours it spends, and
   * almost all of that 3.4% is the platform's own two sides. The shipped room
   * with its eight props scores 5.5-6.0%. 4.5% sits between them with about a
   * point of margin on each side, and `describe('the bounds bite')` renders the
   * shell with `props: []` and asserts it fails.
   */
  FURNITURE_SHARE_MIN: 0.045,
  /** ...and a checkerboard is 32.4%, which is not furniture, it is noise. */
  FURNITURE_SHARE_MAX: 0.15,
  /** There is a light source in the room... */
  BRIGHT_SHARE_MIN: 0.0002,
  /** ...and it is a filament, not a wall. */
  BRIGHT_SHARE_MAX: 0.01,
  /** Something in the room is brighter than the figure's median pixel — the
   *  platform. Nothing is, on a black screen. */
  OVER_FIGURE_SHARE_MIN: 0.01,
  OVER_FIGURE_SHARE_MAX: 0.2,
  /**
   * COMPOSITION. Every other bound in this file is invariant under permuting
   * the props: relocate all eight and none of them moves by more than rounding.
   * These three see WHERE the content is.
   *
   * `FILLED_CELLS_MIN` — of a 4x3 grid over the frame, how many cells carry at
   * least a quarter of an even share. The shipped room manages 8; the bare shell
   * manages 6. Two of the four it misses are the right-hand column, which the
   * panel is sitting on, and one is the band reserved for the figure — so 8 of
   * 12 is close to this screen's ceiling and the floor is set one below it.
   *
   * `CONTENT_BALANCE_MAX` — content left of the figure minus content right of
   * him, over the total. Shipped runs -0.01 to +0.15; the same furniture pushed
   * to one side runs 0.44.
   *
   * `CONTENT_PEAK_MAX` — the busiest cell's share of all content. A room whose
   * content is one stripe scores 1.0.
   */
  FILLED_CELLS_MIN: 7,
  CONTENT_BALANCE_MAX: 0.3,
  CONTENT_PEAK_MAX: 0.35,
  /**
   * RIM SEPARATION. Floors only, which makes them the most directional numbers
   * in the file and the reason every bound above exists: a black rectangle
   * scores BETTER on all of them than the shipped room does.
   *
   * Stated in `GYM_READABILITY`'s two anchors rather than in fresh integers, so
   * "is this a real contrast bound or a collision detector" has an answer that
   * is not an opinion:
   *
   *   PERCEPTIBLE_LUMA_STEP (10) is the room's own softest deliberate mark, the
   *   block-course mortar line, which is authored to read as texture.
   *   EDGE_LUMA_DELTA (20) is the step this piece calls a hard edge.
   *
   * WHY THE KEYLINE FLOOR IS NOT HIGHER, WITH THE ARITHMETIC. `rimContrast`
   * samples the outermost reachable pixel of the figure, which on a 16-bit
   * sprite is the keyline. The lifter has two: luma 9 on equipment and 19 on the
   * body. A room value clearing BOTH by 10 has to be 29 or brighter, and a room
   * whose darkest band is 29 cannot hold the bottom of the value range — which
   * is the entire reason the figure owns the top of it. More generally his
   * fifteen colours leave no gap wider than 18 luma below 125, so NO background
   * value under 125 is more than 9 luma from every step of him. A p05 floor of
   * 10 is therefore a statement about how many bad contacts occur, not about the
   * palette, and it is set at exactly the step the art already calls visible.
   */
  RIM_P05_MIN: GYM_READABILITY.PERCEPTIBLE_LUMA_STEP,
  RIM_P25_MIN: GYM_READABILITY.EDGE_LUMA_DELTA,
  RIM_P50_MIN: GYM_READABILITY.EDGE_LUMA_DELTA + GYM_READABILITY.PERCEPTIBLE_LUMA_STEP,
  /**
   * The same crossings, measured as the best separation anywhere in the first
   * `RIM_INSET_PX` pixels — keyline or the paint behind it. That is the question
   * the eye asks at a silhouette, so it carries the harder floor. It does NOT
   * replace the keyline percentiles: the figure-band plant scores 38.7 here and
   * 3.6 there, so only the keyline measure catches a room painted in the
   * figure's own values.
   */
  RIM_FILL_P05_MIN: GYM_READABILITY.PERCEPTIBLE_LUMA_STEP,
  RIM_FILL_P10_MIN: GYM_READABILITY.EDGE_LUMA_DELTA,
  /** The figure keeps the top of the range outright. */
  FIGURE_OVER_ROOM_P90_MIN: 60,
} as const;

type Violation = string;

/**
 * Every bound the frame fails, by name. Empty is a pass.
 *
 * `occluders` defaults to the lift stage's, because that is what the screen
 * does. Passing `[]` measures the image nobody sees, and exactly one test does
 * that on purpose, to show the difference.
 */
function violations(grid: IndexGrid, occluders: readonly SceneRect[] = OCCLUDERS): Violation[] {
  const r = measureSceneReadability(grid, { occluders });
  const out: Violation[] = [];
  const check = (name: string, value: number, min: number, max: number): void => {
    if (value < min) out.push(`${name}_LOW(${value.toFixed(4)}<${min})`);
    if (value > max) out.push(`${name}_HIGH(${value.toFixed(4)}>${max})`);
  };
  check('INDEX_COUNT', r.backgroundIndexCount, BOUNDS.INDEX_COUNT_MIN, BOUNDS.INDEX_COUNT_MAX);
  check('MEAN_LUMA', r.backgroundMeanLuma, BOUNDS.MEAN_LUMA_MIN, BOUNDS.MEAN_LUMA_MAX);
  check('P90_LUMA', r.backgroundLuma.p90, BOUNDS.P90_LUMA_MIN, BOUNDS.P90_LUMA_MAX);
  check('EDGE_SHARE', r.backgroundEdgeShare, BOUNDS.EDGE_SHARE_MIN, BOUNDS.EDGE_SHARE_MAX);
  check(
    'BEHIND_EDGE_SHARE',
    r.behindEdgeShare,
    BOUNDS.BEHIND_EDGE_SHARE_MIN,
    BOUNDS.BEHIND_EDGE_SHARE_MAX,
  );
  check('FURNITURE_SHARE', r.furnitureShare, BOUNDS.FURNITURE_SHARE_MIN, BOUNDS.FURNITURE_SHARE_MAX);
  check('BRIGHT_SHARE', r.backgroundBrightShare, BOUNDS.BRIGHT_SHARE_MIN, BOUNDS.BRIGHT_SHARE_MAX);
  check(
    'OVER_FIGURE_SHARE',
    r.backgroundOverFigureShare,
    BOUNDS.OVER_FIGURE_SHARE_MIN,
    BOUNDS.OVER_FIGURE_SHARE_MAX,
  );
  const noCeiling = Number.POSITIVE_INFINITY;
  check('FILLED_CELLS', r.filledCells, BOUNDS.FILLED_CELLS_MIN, noCeiling);
  check('CONTENT_BALANCE', Math.abs(r.contentBalance), 0, BOUNDS.CONTENT_BALANCE_MAX);
  check('CONTENT_PEAK', r.contentPeak, 0, BOUNDS.CONTENT_PEAK_MAX);
  check('RIM_P05', r.rimContrast.p05, BOUNDS.RIM_P05_MIN, noCeiling);
  check('RIM_P25', r.rimContrast.p25, BOUNDS.RIM_P25_MIN, noCeiling);
  check('RIM_P50', r.rimContrast.p50, BOUNDS.RIM_P50_MIN, noCeiling);
  check('RIM_FILL_P05', r.rimFill.p05, BOUNDS.RIM_FILL_P05_MIN, noCeiling);
  check('RIM_FILL_P10', r.rimFill.p10, BOUNDS.RIM_FILL_P10_MIN, noCeiling);
  check(
    'FIGURE_OVER_ROOM',
    r.figureLuma.p90 - r.backgroundLuma.p90,
    BOUNDS.FIGURE_OVER_ROOM_P90_MIN,
    noCeiling,
  );
  return out;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SPEC = liftStageScene();
const MEET_SPEC: GymSceneSpec = { ...SPEC, venue: 'meet-platform' };
const DEMO_TOTAL_KG = 250;
const OCCLUDERS = liftStageOccluders();

const REP = buildSquatRep(LOAD_PRESETS.MAXIMAL);
const LIGHT_REP = buildSquatRep(LOAD_PRESETS.LIGHT);

function frameAt(frac: number): (typeof REP.frames)[number] {
  const i = Math.min(REP.frames.length - 1, Math.round((REP.frames.length - 1) * frac));
  const frame = REP.frames[i];
  if (frame === undefined) throw new Error('no frame');
  return frame;
}

/**
 * The room, the shadow he throws on it, and the figure — the exact three-layer
 * stack `LiftStage.tsx` draws, in the order it draws them.
 */
function compositeOnto(scene: IndexGrid, frac: number, shadow: boolean = true): IndexGrid {
  const spec = frameSpecFrom(frameAt(frac), DEMO_TOTAL_KG);
  if (shadow) {
    const patch = contactShadowPatch(
      scene,
      liftContactShadow(spec),
      GYM_LIFT_STAGE.SPRITE_X,
      GYM_LIFT_STAGE.SPRITE_Y,
      GYM_CONTACT_SHADOW.STEPS,
    );
    if (patch !== null) blitOver(scene, patch.grid, patch.x, patch.y);
  }
  const { grid } = renderLifterFrame(spec);
  return blitOver(scene, grid, GYM_LIFT_STAGE.SPRITE_X, GYM_LIFT_STAGE.SPRITE_Y);
}

/** The room with the lifter standing in it, exactly as the stage composites. */
function composite(frac: number, spec: GymSceneSpec = SPEC): IndexGrid {
  return compositeOnto(renderGymScene(spec), frac);
}

/** The same figure over a background made by `paint`, for the adversarial set. */
function compositeOverPainted(paint: (g: IndexGrid) => void, frac: number = 0.5): IndexGrid {
  const bg = createGrid(SPEC.w, SPEC.h, GYM.WALL_DEEP);
  paint(bg);
  // No shadow on a planted background: the plants are about what the ROOM does,
  // and a shadow stepped down an arbitrary painted surface is not that.
  return compositeOnto(bg, frac, false);
}

const MOMENTS: readonly (readonly [string, number])[] = [
  ['standing', 0],
  ['descent', 0.25],
  ['hole', 0.5],
  ['drive', 0.7],
];

// ---------------------------------------------------------------------------
// The layer exists at all
// ---------------------------------------------------------------------------

describe('the room is a room', () => {
  it('covers every pixel of its grid — no holes for a screen colour to show', () => {
    const g = renderGymScene(SPEC);
    expect(g.w).toBe(GYM_LIFT_STAGE.W);
    expect(g.h).toBe(GYM_LIFT_STAGE.H);
    for (let i = 0; i < g.data.length; i += 1) {
      expect(isTransparentIndex(g.data[i] ?? 0), `hole at ${i}`).toBe(false);
    }
  });

  it('draws a wall, a floor, a platform, lamps and props', () => {
    // The check that goes red the moment the layer is deleted. Each of these is
    // a named piece of the room, found by its own palette index.
    const g = renderGymScene(SPEC);
    const present = new Set<number>(g.data);
    for (const [name, index] of [
      ['wall', GYM.WALL_MID],
      ['kickplate', GYM.WALL_SKIRT],
      ['painted stripe', GYM.STRIPE_MID],
      ['window glass', GYM.GLASS_DIM],
      ['rubber floor', GYM.FLOOR_MID],
      ['platform boards', GYM.WOOD_LIGHT],
      ['steel on the equipment', GYM.STEEL_FRAME],
      ['platform edge', GYM.WOOD_LIGHT],
      ['lamp filament', GYM.LAMP_CORE],
      ['coloured plates on a tree', GYM.ACCENT_RED],
      ['chalk', GYM.CHALK_DUST],
    ] as const) {
      expect(present.has(index), `the room has no ${name}`).toBe(true);
    }
  });

  it('renders the same bytes twice — nothing in here is random', () => {
    const a = renderGymScene(SPEC);
    const b = renderGymScene(SPEC);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  it('resolves every index it draws to a real colour', () => {
    for (const spec of [SPEC, MEET_SPEC]) {
      const g = renderGymScene(spec);
      for (const index of new Set<number>(g.data)) {
        expect(sceneColorAt(index), `index ${index} is unallocated`).toBeDefined();
      }
    }
  });

  it('draws only background banks — the room never borrows a figure colour', () => {
    // The banks are what make "is this the room or the lifter?" have an exact
    // answer, and the readability measure depends on that answer.
    for (const spec of [SPEC, MEET_SPEC]) {
      for (const index of new Set<number>(renderGymScene(spec).data)) {
        expect(roleOf(index), `index ${index}`).toBe('background');
        expect(isBodyIndex(index)).toBe(false);
      }
    }
  });

  it('gives the two venues different rooms, from one renderer', () => {
    const gym = renderGymScene(SPEC);
    const meet = renderGymScene(MEET_SPEC);
    expect(Array.from(gym.data)).not.toEqual(Array.from(meet.data));
    const inGym = new Set<number>(gym.data);
    const inMeet = new Set<number>(meet.data);
    // A meet hall has a crowd and a banner; a training gym has block courses
    // and a plate tree.
    expect(inMeet.has(GYM.CROWD_MID)).toBe(true);
    expect(inGym.has(GYM.CROWD_MID)).toBe(false);
    expect(inGym.has(GYM.GLASS_DIM)).toBe(true);
    expect(inMeet.has(GYM.GLASS_DIM)).toBe(false);
    // ...and both stand on the same platform.
    expect(inGym.has(GYM.WOOD_LIGHT)).toBe(true);
    expect(inMeet.has(GYM.WOOD_LIGHT)).toBe(true);
  });

  it('composes at a size that is not the lift stage', () => {
    // The layer is reusable or it is welded to one screen. Meet day is being
    // built in parallel and does not share this box.
    const other: GymSceneSpec = {
      venue: 'meet-platform',
      w: SPEC.w * 2,
      h: Math.round(SPEC.h / 2),
      floorRow: Math.round(SPEC.h / 2) - GYM_ROOM.APRON_ROWS - 1,
      focusX: SPEC.w,
      cameraX: 0,
    };
    const g = renderGymScene(other);
    expect(g.w).toBe(other.w);
    expect(g.h).toBe(other.h);
    for (let i = 0; i < g.data.length; i += 1) {
      expect(isTransparentIndex(g.data[i] ?? 0)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// The scene box agrees with the screen it is drawn on
// ---------------------------------------------------------------------------

describe('the scene box is derived, not guessed', () => {
  const L = LIFT_TUNING.LAYOUT;
  const S = GYM_LIFT_STAGE;

  it('uses the sprite own integer upscale', () => {
    expect(S.SCALE).toBe(LIFT_TUNING.FEEDBACK.SPRITE_SCALE);
    expect(Number.isInteger(S.SCALE)).toBe(true);
  });

  it('puts the two pixel grids on ONE lattice', () => {
    // The reason ORIGIN_Y is 1 and not 0. The sprite is drawn at y 292 and 292
    // is not a multiple of 3, so a scene at y 0 has its pixel grid a third of a
    // scene-pixel out of phase with the figure standing on it — which at
    // nearest-neighbour is a visible shimmer along every edge where they meet.
    expect((L.SPRITE_X - S.ORIGIN_X) % S.SCALE).toBe(0);
    expect((L.SPRITE_Y - S.ORIGIN_Y) % S.SCALE).toBe(0);
    expect(S.SPRITE_X).toBe((L.SPRITE_X - S.ORIGIN_X) / S.SCALE);
    expect(S.SPRITE_Y).toBe((L.SPRITE_Y - S.ORIGIN_Y) / S.SCALE);
  });

  it('lands the drawn floor on the drawn soles', () => {
    const soleOnScreen = L.SPRITE_Y + RESOLUTION.FLOOR_Y * S.SCALE;
    const floorOnScreen = S.ORIGIN_Y + S.FLOOR_ROW * S.SCALE;
    expect(floorOnScreen).toBe(soleOnScreen);
  });

  it('covers the stage and does not overshoot it by a whole scene pixel', () => {
    expect(S.ORIGIN_X + S.W * S.SCALE).toBeGreaterThanOrEqual(L.STAGE_W);
    expect(S.ORIGIN_Y + S.H * S.SCALE).toBeGreaterThanOrEqual(L.STAGE_H);
    expect(S.ORIGIN_X + (S.W - 1) * S.SCALE).toBeLessThan(L.STAGE_W);
    expect(S.ORIGIN_Y + (S.H - 1) * S.SCALE).toBeLessThan(L.STAGE_H);
  });

  it('composes the room around the lifter centre line, not the grid centre', () => {
    expect(GYM_LIFT_FOCUS_X).toBe(S.SPRITE_X + CENTER_X);
    // ...and they really are different, which is the whole point of `focusX`.
    expect(Math.abs(GYM_LIFT_FOCUS_X - S.W / 2)).toBeGreaterThan(BANK_SIZE / 2);
  });

  it('keeps the junction above the floor and the platform below it', () => {
    expect(junctionRow(SPEC)).toBeGreaterThan(0);
    expect(junctionRow(SPEC)).toBeLessThan(SPEC.floorRow);
    expect(floorDepth(SPEC)).toBeGreaterThan(GYM_ROOM.APRON_ROWS);
    expect(platformBackRow(SPEC)).toBeGreaterThan(junctionRow(SPEC));
    expect(platformBackRow(SPEC)).toBeLessThan(SPEC.floorRow);
  });
});

// ---------------------------------------------------------------------------
// The hole the figure stands in
// ---------------------------------------------------------------------------

/** Union bounding box of the lifter body across the whole pose space. */
function bodyBox(): SceneRect {
  let x0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const rep of [REP, LIGHT_REP]) {
    for (const frame of rep.frames) {
      const { grid } = renderLifterFrame(frameSpecFrom(frame, DEMO_TOTAL_KG));
      for (let y = 0; y < grid.h; y += 1) {
        for (let x = 0; x < grid.w; x += 1) {
          if (!isBodyIndex(getPx(grid, x, y))) continue;
          x0 = Math.min(x0, x + GYM_LIFT_STAGE.SPRITE_X);
          x1 = Math.max(x1, x + GYM_LIFT_STAGE.SPRITE_X);
          y0 = Math.min(y0, y + GYM_LIFT_STAGE.SPRITE_Y);
          y1 = Math.max(y1, y + GYM_LIFT_STAGE.SPRITE_Y);
        }
      }
    }
  }
  return { x0, y0, x1, y1 };
}

const BODY_BOX = bodyBox();

describe('nothing stands where the figure stands', () => {
  const band = clearBand(SPEC, RESOLUTION.LIFTER_HEIGHT_PX);

  it('reserves a band that really does contain the drawn figure', () => {
    // The authored band checked against the RENDERED silhouette, over the whole
    // pose space at two loads, rather than against itself. Without this the
    // reservation could drift away from the thing it protects and every
    // placement below would still "pass".
    expect(BODY_BOX.x1).toBeGreaterThan(BODY_BOX.x0);
    expect(band.x0).toBeLessThan(BODY_BOX.x0);
    expect(band.x1).toBeGreaterThan(BODY_BOX.x1);
    expect(band.y0).toBeLessThan(BODY_BOX.y0);
    expect(band.y1).toBeGreaterThanOrEqual(BODY_BOX.y1);
    // ...and it is not so wide that reserving it is vacuous: a band covering
    // the whole scene would trivially exclude every prop and mean nothing.
    expect(band.x1 - band.x0).toBeLessThan(SPEC.w / 2);
  });

  it('places no training prop inside it', () => {
    for (const placement of GYM_PROPS_TRAINING) {
      const box = propBox(SPEC, placement);
      expect(rectsOverlap(box, band), `${placement.ART} overlaps the clear band`).toBe(false);
    }
  });

  it('places no meet prop inside it', () => {
    for (const placement of GYM_PROPS_MEET) {
      const box = propBox(MEET_SPEC, placement);
      expect(rectsOverlap(box, band), `${placement.ART} overlaps the clear band`).toBe(false);
    }
  });

  it('keeps the bright wall colours out of it, on the rendered pixels', () => {
    // The exemption `gymPalette.test.ts` takes for the lamp wash, the painted
    // stripe and the window glass, checked rather than trusted. Each of them is
    // within a few luma of a step the lifter is drawn in, and each is legal
    // only because it never appears behind him.
    for (const spec of [SPEC, MEET_SPEC]) {
      const g = renderGymScene(spec);
      for (let y = Math.max(0, band.y0); y <= Math.min(spec.h - 1, band.y1); y += 1) {
        for (let x = Math.max(0, band.x0); x <= Math.min(spec.w - 1, band.x1); x += 1) {
          const index = getPx(g, x, y);
          for (const [name, banned] of [
            ['lamp wash', GYM.WALL_LIGHT],
            ['painted stripe', GYM.STRIPE_MID],
            ['window glass', GYM.GLASS_DIM],
            ['lamp filament', GYM.LAMP_CORE],
            ['lamp glow', GYM.LAMP_GLOW],
          ] as const) {
            expect(index, `${name} at (${x},${y}) in ${spec.venue}`).not.toBe(banned);
          }
        }
      }
    }
  });

  it('is a rule a bad placement breaks — checked by planting one', () => {
    const planted: GymPropPlacement = { ART: 'FLAT_BENCH', XF: 0.35, DEPTH: 0.1, DIM: false };
    expect(rectsOverlap(propBox(SPEC, planted), band)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Compositing
// ---------------------------------------------------------------------------

describe('the room goes behind the figure and stays there', () => {
  it('does not overwrite one pixel of the lifter or the bar', () => {
    for (const [name, frac] of MOMENTS) {
      const { grid: sprite } = renderLifterFrame(frameSpecFrom(frameAt(frac), DEMO_TOTAL_KG));
      const before = Array.from(sprite.data).filter((v) => !isTransparentIndex(v)).length;
      const merged = composite(frac);
      let after = 0;
      for (let y = 0; y < sprite.h; y += 1) {
        for (let x = 0; x < sprite.w; x += 1) {
          const v = getPx(sprite, x, y);
          if (isTransparentIndex(v)) continue;
          after += 1;
          expect(
            getPx(merged, x + GYM_LIFT_STAGE.SPRITE_X, y + GYM_LIFT_STAGE.SPRITE_Y),
            `${name} lost a sprite pixel at (${x},${y})`,
          ).toBe(v);
        }
      }
      expect(after).toBe(before);
      expect(before).toBeGreaterThan(0);
    }
  });

  it('leaves the sprite grid itself untouched', () => {
    const { grid: sprite } = renderLifterFrame(frameSpecFrom(frameAt(0), DEMO_TOTAL_KG));
    const copy = Array.from(sprite.data);
    blitOver(renderGymScene(SPEC), sprite, GYM_LIFT_STAGE.SPRITE_X, GYM_LIFT_STAGE.SPRITE_Y);
    expect(Array.from(sprite.data)).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// READABILITY
// ---------------------------------------------------------------------------

const report = (grid: IndexGrid): string =>
  formatReadability(measureSceneReadability(grid, { occluders: OCCLUDERS }));

describe('readability at phone scale', () => {
  it('passes every bound at every moment of the rep', () => {
    for (const [name, frac] of MOMENTS) {
      const grid = composite(frac);
      expect(violations(grid), `${name}:\n${report(grid)}`).toEqual([]);
    }
  });

  it('passes them in the meet venue too', () => {
    const grid = composite(0, MEET_SPEC);
    expect(violations(grid), report(grid)).toEqual([]);
  });

  it('measures a real figure and a real room, not two empty sets', () => {
    // The vacuity guard. Every share above is a ratio, and a ratio over zero
    // pixels reports whatever the denominator guard says.
    const r = measureSceneReadability(composite(0.5), { occluders: OCCLUDERS });
    expect(r.figurePx).toBeGreaterThan(500);
    expect(r.barbellPx).toBeGreaterThan(200);
    expect(r.backgroundPx).toBeGreaterThan(SPEC.w * SPEC.h * 0.5);
    expect(r.behindPx).toBeGreaterThan(1000);
    expect(r.rimSamples).toBeGreaterThan(200);
    // ...and the three roles plus the hidden strip account for every pixel.
    expect(r.figurePx + r.barbellPx + r.backgroundPx + r.hiddenPx).toBe(SPEC.w * SPEC.h);
    expect(r.visiblePx + r.hiddenPx).toBe(SPEC.w * SPEC.h);
  });

  it('keeps the figure at the top of the range, by a distance', () => {
    const r = measureSceneReadability(composite(0), { occluders: OCCLUDERS });
    expect(r.figureLuma.p90 - r.backgroundLuma.p90).toBeGreaterThan(
      BOUNDS.FIGURE_OVER_ROOM_P90_MIN,
    );
    expect(r.figureMeanLuma).toBeGreaterThan(r.backgroundMeanLuma * 2);
  });
});

// ---------------------------------------------------------------------------
// THE PANEL IS PART OF THE COMPOSITE
// ---------------------------------------------------------------------------

describe('the panel is part of the composite', () => {
  const S = GYM_LIFT_STAGE;
  const C = GYM_STAGE_CHROME;
  const L = LIFT_TUNING.LAYOUT;

  it('takes the occluder from the screen that draws it, not from a guess', () => {
    // Same discipline `GYM_LIFT_STAGE` is held to: the numbers are written down
    // in the tuning file and re-derived here, so they cannot drift away from
    // the panel `LiftStage.tsx` actually paints.
    expect(C.PANEL_X).toBe(L.TRACE_X);
    expect(C.PANEL_W).toBe(L.TRACE_W);
    expect(C.PANEL_TOP).toBe(L.TRACE_TOP);
    expect(C.PANEL_BOTTOM).toBe(L.TRACE_BOTTOM);
  });

  it('converts it to the scene pixels the panel really covers', () => {
    const [rect] = OCCLUDERS;
    expect(OCCLUDERS.length).toBe(1);
    if (rect === undefined) throw new Error('no occluder');
    // Every scene pixel inside the rect is more than half covered on each axis,
    // and every pixel just outside it is not. Checked against the geometry
    // rather than against the constant that produced it.
    const coveredFrac = (i: number, origin: number, lo: number, hi: number): number => {
      const a = origin + i * S.SCALE;
      const b = a + S.SCALE;
      return Math.max(0, Math.min(b, hi) - Math.max(a, lo)) / S.SCALE;
    };
    const inX = (i: number): number => coveredFrac(i, S.ORIGIN_X, C.PANEL_X, C.PANEL_X + C.PANEL_W);
    const inY = (i: number): number => coveredFrac(i, S.ORIGIN_Y, C.PANEL_TOP, C.PANEL_BOTTOM);
    for (const [name, f, i] of [
      ['x0', inX, rect.x0],
      ['x1', inX, rect.x1],
      ['y0', inY, rect.y0],
      ['y1', inY, rect.y1],
    ] as const) {
      expect(f(i), `${name} inside`).toBeGreaterThan(C.OCCLUSION_COVERAGE_MIN);
    }
    expect(inX(rect.x0 - 1)).toBeLessThanOrEqual(C.OCCLUSION_COVERAGE_MIN);
    expect(inX(rect.x1 + 1)).toBeLessThanOrEqual(C.OCCLUSION_COVERAGE_MIN);
    expect(inY(rect.y0 - 1)).toBeLessThanOrEqual(C.OCCLUSION_COVERAGE_MIN);
    expect(inY(rect.y1 + 1)).toBeLessThanOrEqual(C.OCCLUSION_COVERAGE_MIN);
  });

  it('hides about a fifth of the room, and the busy fifth', () => {
    const r = measureSceneReadability(composite(0), { occluders: OCCLUDERS });
    expect(r.hiddenPx).toBe(4160);
    expect(r.hiddenPx / (SPEC.w * SPEC.h)).toBeGreaterThan(0.18);
    // The props that are behind it, named, so this is not an abstract fraction.
    const [rect] = OCCLUDERS;
    if (rect === undefined) throw new Error('no occluder');
    const hiddenFraction = (placement: GymPropPlacement): number => {
      const box = propBox(SPEC, placement);
      const w = Math.max(0, Math.min(box.x1, rect.x1) - Math.max(box.x0, rect.x0) + 1);
      const h = Math.max(0, Math.min(box.y1, rect.y1) - Math.max(box.y0, rect.y0) + 1);
      return (w * h) / ((box.x1 - box.x0 + 1) * (box.y1 - box.y0 + 1));
    };
    // No prop is now MOSTLY behind the panel. Before this rework the dumbbell
    // rack was 73% behind it, the loaded bar 62% and the flat bench 32%, and
    // every one of those pixels counted towards the readability numbers.
    for (const placement of GYM_PROPS_TRAINING) {
      expect(hiddenFraction(placement), `${placement.ART} is mostly behind the panel`).toBeLessThan(
        0.5,
      );
    }
  });

  it('MOVES THE NUMBERS — widening the panel changes what the room measures', () => {
    // THE MUTATION. Under the old measurement this test could not have gone
    // green in one direction and red in the other, because the occluder was not
    // an input at all: every number was identical for every panel.
    const grid = composite(0);
    const wider: SceneRect[] = [{ x0: 60, x1: SPEC.w - 1, y0: 0, y1: SPEC.h - 1 }];
    const shipped = measureSceneReadability(grid, { occluders: OCCLUDERS });
    const mutated = measureSceneReadability(grid, { occluders: wider });
    // Assert the mutation applied before trusting what it says.
    expect(mutated.hiddenPx).toBeGreaterThan(shipped.hiddenPx * 2);
    expect(mutated.backgroundPx).toBeLessThan(shipped.backgroundPx);
    // ...and then that it lands somewhere.
    expect(mutated.furnitureShare).not.toBeCloseTo(shipped.furnitureShare, 4);
    expect(mutated.backgroundMeanLuma).not.toBeCloseTo(shipped.backgroundMeanLuma, 3);
    expect(mutated.contentBalance).not.toBeCloseTo(shipped.contentBalance, 3);
    expect(mutated.filledCells).toBeLessThan(shipped.filledCells);
    // A panel over half the room takes half its furniture with it.
    expect(violations(grid, wider).length).toBeGreaterThan(0);
  });

  it('and removing it changes them the other way', () => {
    const grid = composite(0);
    const occluded = measureSceneReadability(grid, { occluders: OCCLUDERS });
    const raw = measureSceneReadability(grid, { occluders: [] });
    expect(raw.hiddenPx).toBe(0);
    expect(raw.backgroundPx).toBeGreaterThan(occluded.backgroundPx);
    // Every one of these was reported as the room's number before the occluder
    // existed. None of them is.
    expect(raw.backgroundEdgeShare).toBeLessThan(occluded.backgroundEdgeShare);
    expect(raw.furnitureShare).toBeLessThan(occluded.furnitureShare);
    expect(raw.backgroundOverFigureShare).toBeLessThan(occluded.backgroundOverFigureShare);
    expect(raw.backgroundBrightShare).toBeGreaterThan(occluded.backgroundBrightShare);
    expect(raw.contentBalance).toBeLessThan(occluded.contentBalance);
  });
});

// ---------------------------------------------------------------------------
// The lifter stands on something
// ---------------------------------------------------------------------------

describe('the figure is grounded', () => {
  it('darkens the platform under his feet, in the room own ramp', () => {
    const room = renderGymScene(SPEC);
    const before = Array.from(room.data);
    const spec = frameSpecFrom(frameAt(0), DEMO_TOTAL_KG);
    const patch = contactShadowPatch(
      room,
      liftContactShadow(spec),
      GYM_LIFT_STAGE.SPRITE_X,
      GYM_LIFT_STAGE.SPRITE_Y,
      GYM_CONTACT_SHADOW.STEPS,
    );
    expect(patch, 'no shadow at all').not.toBeNull();
    if (patch === null) return;
    // It does not mutate what it measures.
    expect(Array.from(room.data)).toEqual(before);
    // It sits under the lifter and on the platform, and it is darker than what
    // it landed on, everywhere.
    let painted = 0;
    for (let y = 0; y < patch.grid.h; y += 1) {
      for (let x = 0; x < patch.grid.w; x += 1) {
        const index = getPx(patch.grid, x, y);
        if (isTransparentIndex(index)) continue;
        painted += 1;
        const under = getPx(room, x + patch.x, y + patch.y);
        expect(lumaOfIndex(index) ?? 0, `not darker at (${x},${y})`).toBeLessThan(
          lumaOfIndex(under) ?? 0,
        );
        // Still the room's own palette — the shadow never introduces a colour.
        expect(roleOf(index)).toBe('background');
      }
    }
    expect(painted).toBeGreaterThan(100);
    expect(patch.y).toBeGreaterThan(platformBackRow(SPEC));
  });

  it('narrows as he descends, because the key light is high', () => {
    const area = (frac: number): number => {
      const mask = liftContactShadow(frameSpecFrom(frameAt(frac), DEMO_TOTAL_KG));
      let n = 0;
      for (let i = 0; i < mask.data.length; i += 1) {
        if (!isTransparentIndex(mask.data[i] ?? 0)) n += 1;
      }
      return n;
    };
    expect(area(0.5)).toBeLessThan(area(0));
  });

  it('is what the composite draws, not only what a tool draws', () => {
    // The defect this closes: `renderContactShadow` existed and was called by
    // `tools/sprites.mjs` and by unit tests only, so on the shipped stage the
    // lifter stood on a 136-luma platform with nothing under his feet.
    const withShadow = compositeOnto(renderGymScene(SPEC), 0, true);
    const without = compositeOnto(renderGymScene(SPEC), 0, false);
    expect(Array.from(withShadow.data)).not.toEqual(Array.from(without.data));
    const a = measureSceneReadability(withShadow, { occluders: OCCLUDERS });
    const b = measureSceneReadability(without, { occluders: OCCLUDERS });
    expect(a.backgroundEdgeShare).toBeGreaterThan(b.backgroundEdgeShare);
    // ...and the grounded frame still passes every bound.
    expect(violations(withShadow), report(withShadow)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ...AND THE BOUNDS BITE
// ---------------------------------------------------------------------------

describe('the bounds bite', () => {
  /** Assert the planted background really is different from the shipped one. */
  function planted(paint: (g: IndexGrid) => void): IndexGrid {
    const shipped = renderGymScene(SPEC);
    const bg = createGrid(SPEC.w, SPEC.h, GYM.WALL_DEEP);
    paint(bg);
    expect(Array.from(bg.data), 'the plant did not change anything').not.toEqual(
      Array.from(shipped.data),
    );
    return compositeOverPainted(paint);
  }

  it('DELETING THE ROOM fails the floors — and passes every rim bound', () => {
    // The single most important assertion in this file. A blank rectangle is
    // the BEST possible background by rim contrast and by busyness, so the rim
    // percentiles on their own would grade the deleted layer as an improvement.
    // This is what stops them being a directional bound nobody could fail.
    const grid = planted(() => {
      /* leave the flat WALL_DEEP fill */
    });
    const r = measureSceneReadability(grid);
    expect(r.rimContrast.p50).toBeGreaterThan(BOUNDS.RIM_P50_MIN);
    expect(r.backgroundEdgeShare).toBe(0);

    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('INDEX_COUNT_LOW'))).toBe(true);
    expect(bad.some((v) => v.startsWith('MEAN_LUMA_LOW'))).toBe(true);
    expect(bad.some((v) => v.startsWith('P90_LUMA_LOW'))).toBe(true);
    expect(bad.some((v) => v.startsWith('EDGE_SHARE_LOW'))).toBe(true);
    expect(bad.some((v) => v.startsWith('BRIGHT_SHARE_LOW'))).toBe(true);
    expect(bad.some((v) => v.startsWith('OVER_FIGURE_SHARE_LOW'))).toBe(true);
  });

  it('A BUSY ROOM fails the edge-share ceiling', () => {
    // THE ONE THAT MATTERS. A readability bound that only fails on a blank
    // screen is measuring nothing, so this is a room with plenty in it, at
    // plenty of contrast, drawn with the real palette.
    const grid = planted((g) => {
      for (let y = 0; y < g.h; y += 1) {
        for (let x = 0; x < g.w; x += 1) {
          const cell = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0;
          setPx(g, x, y, cell ? GYM.WALL_DEEP : GYM.WOOD_MID);
        }
      }
    });
    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('EDGE_SHARE_HIGH')), bad.join(' ')).toBe(true);
    expect(bad.some((v) => v.startsWith('BEHIND_EDGE_SHARE_HIGH'))).toBe(true);
  });

  it('A BUSY ROOM ONLY BEHIND THE FIGURE fails the behind-the-figure ceiling', () => {
    // Sharper than the last one: the room is exactly as shipped everywhere
    // except the band the lifter occupies, where it is cluttered. The
    // whole-scene edge share barely moves; the behind-the-figure one does.
    const band = clearBand(SPEC, RESOLUTION.LIFTER_HEIGHT_PX);
    const grid = planted((g) => {
      const room = renderGymScene(SPEC);
      g.data.set(room.data);
      for (let y = band.y0; y <= band.y1; y += 1) {
        for (let x = band.x0; x <= band.x1; x += 1) {
          const cell = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0;
          setPx(g, x, y, cell ? GYM.WALL_DEEP : GYM.STEEL_LIT);
        }
      }
    });
    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('BEHIND_EDGE_SHARE_HIGH')), bad.join(' ')).toBe(true);
  });

  it('A BRIGHT ROOM fails the brightness ceilings', () => {
    const grid = planted((g) => {
      const room = renderGymScene(SPEC);
      g.data.set(room.data);
      for (let y = 0; y < junctionRow(SPEC); y += 1) {
        for (let x = 0; x < g.w; x += 1) setPx(g, x, y, GYM.LAMP_GLOW);
      }
    });
    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('MEAN_LUMA_HIGH')), bad.join(' ')).toBe(true);
    expect(bad.some((v) => v.startsWith('P90_LUMA_HIGH'))).toBe(true);
    expect(bad.some((v) => v.startsWith('OVER_FIGURE_SHARE_HIGH'))).toBe(true);
  });

  it('A ROOM PAINTED IN THE FIGURE OWN VALUES fails ONLY the rim floors', () => {
    // The case neither "too dark" nor "too bright" catches, and the whole
    // reason the rim percentiles exist.
    //
    // This room is BUILT TO PASS EVERYTHING ELSE. It is banded, so it has real
    // content and a legal edge share; it has a filament, so it has a light
    // source; its mean and p90 sit inside the brightness window; part of it is
    // brighter than the figure's median. It is a perfectly reasonable-looking
    // background by every aggregate. It just happens to be painted in the
    // 49-59 band where the lifter's plate shades, singlet and knee sleeves
    // live, so his silhouette dissolves into it — and the rim floors are the
    // only thing that says so.
    // Twelve surfaces, every one of them between luma 41 and 73, banded in
    // ascending order so no band boundary is a hard edge, plus a chalk seam for
    // content and a filament for a light source. Fourteen indices — as many as
    // a real room — and an average value inside the window.
    // RE-DERIVED against the figure A1's shading rework left behind, not the one
    // this plant was written for. Its steps under 90 now read 19.3 / 45.2 /
    // 49.3 / 50.9 / 54.1 / 58.9 / 64.7 / 65.1 / 73.0 / 75.0 / 83.9, and each
    // band below is the gym index nearest one of them. `WALL_MID` was in this
    // list and is not any more: it moved to 33.9 this round to get off his hair,
    // which put it 11 luma clear of the nearest figure step — i.e. it stopped
    // being a colour that hides a lifter, so it stopped belonging in a room
    // built to hide one. `WOOD_MID` (85.7, 1.8 off PLATE_BLUE_SHADE) replaces it
    // and keeps the count at twelve, which is what keeps INDEX_COUNT passing.
    const BANDS = [
      GYM.WOOD_DARK,
      GYM.LAMP_HOUSING,
      GYM.ACCENT_RED,
      GYM.CROWD_MID,
      GYM.FLOOR_LIGHT,
      GYM.STRIPE_MID,
      GYM.ACCENT_BLUE,
      GYM.STEEL_FRAME,
      GYM.WALL_LIGHT,
      GYM.GLASS_DIM,
      GYM.ACCENT_YELLOW,
      GYM.WOOD_MID,
    ];
    // Cycled rather than clamped, and narrow enough that the figure's whole
    // height meets every band. With one pass of twelve bands over the full grid
    // the lifter only ever stood in front of the top of the ladder, and a plant
    // that only collides with his shins is not a room painted in his values.
    const BAND_ROWS = 6;
    // UPRIGHTS, evenly spread across the frame — pillars, near enough. Without
    // them this plant would fail `FURNITURE_SHARE`, `FILLED_CELLS` and
    // `CONTENT_PEAK` as well, and stop being the sharp "only the rim catches it"
    // case it exists to be. One column in twenty-five is enough content to clear
    // the furniture floor and few enough to stay under the busyness ceiling.
    const SEAM_COLS = 25;
    const grid = planted((g) => {
      for (let y = 0; y < g.h; y += 1) {
        const band = BANDS[Math.floor(y / BAND_ROWS) % BANDS.length] ?? BANDS[0] ?? 0;
        for (let x = 0; x < g.w; x += 1) {
          setPx(g, x, y, x % SEAM_COLS === 0 ? GYM.LAMP_GLOW : band);
        }
      }
      // A light source, so BRIGHT_SHARE has something to find.
      for (let y = 0; y < 2; y += 1) {
        for (let x = 0; x < 8; x += 1) setPx(g, x + 4, y + 1, GYM.LAMP_CORE);
      }
    });
    const bad = violations(grid);
    // The LOW percentile is where this case lives, and that is a property of the
    // case rather than a weakness. `rimContrast` samples the outermost reachable
    // pixel of the figure, which is usually his keyline at luma 8.9 or 19.3 — so
    // a room has to be DARK to collide with a quarter of the crossings, and a
    // dark room fails MEAN_LUMA and stops being this test. A room in his MID
    // values collides on the crossings where the keyline is absent and the fill
    // is what shows, which is the bottom few per cent. p05 is the bound that
    // catches it, and p25 is not asserted here because asserting it would mean
    // building a different room and calling it this one.
    expect(bad.some((v) => v.startsWith('RIM_P05_LOW')), bad.join(' ')).toBe(true);
    expect(bad.every((v) => v.startsWith('RIM_')), `non-rim bound fired: ${bad.join(' ')}`).toBe(
      true,
    );
    // ...and it passes every aggregate that catches the blank screen, the
    // blown-out one and the unfurnished one, which is what makes the rim bounds
    // load-bearing rather than redundant.
    for (const passed of [
      'INDEX_COUNT',
      'MEAN_LUMA',
      'P90_LUMA',
      'EDGE_SHARE',
      'BRIGHT_SHARE',
      'OVER_FIGURE_SHARE',
      'FURNITURE_SHARE',
      'FILLED_CELLS',
      'CONTENT_BALANCE',
      'CONTENT_PEAK',
    ]) {
      expect(bad.some((v) => v.startsWith(passed)), `${passed} also fired: ${bad.join(' ')}`).toBe(
        false,
      );
    }
    // ...and the FILL percentiles pass it outright, which is exactly why the
    // keyline percentiles are kept as their own bound rather than replaced.
    const r = measureSceneReadability(grid, { occluders: OCCLUDERS });
    expect(r.rimContrast.p05).toBeLessThan(BOUNDS.RIM_P05_MIN);
    expect(r.rimFill.p05).toBeGreaterThan(BOUNDS.RIM_FILL_P05_MIN);
    expect(r.rimFill.p05 - r.rimContrast.p05).toBeGreaterThan(
      GYM_READABILITY.PERCEPTIBLE_LUMA_STEP,
    );
  });

  it('A ROOM WITH NO FURNITURE IN IT fails the furniture floor', () => {
    // THE ONE THE OLD `INDEX_COUNT_MIN` CLAIMED TO BE. This is the shipped
    // shell — every wall band, course, joint, window, stripe, kickplate, floor
    // band, platform, seam, lamp and wash — with the prop table emptied.
    const bare: GymSceneSpec = { ...SPEC, props: [] };
    const shell = renderGymScene(bare);
    // Assert the mutation applied: it really is a different room, and really is
    // missing exactly the furniture.
    expect(sceneProps(bare).length).toBe(0);
    expect(sceneProps(SPEC).length).toBe(GYM_PROPS_TRAINING.length);
    expect(Array.from(shell.data)).not.toEqual(Array.from(renderGymScene(SPEC).data));

    const grid = compositeOnto(shell, 0);
    const r = measureSceneReadability(grid, { occluders: OCCLUDERS });
    // It clears the old floor comfortably — which is the whole point. A bare
    // shell is not short of colours.
    expect(r.backgroundIndexCount).toBeGreaterThan(BOUNDS.INDEX_COUNT_MIN);
    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('FURNITURE_SHARE_LOW')), bad.join(' ')).toBe(true);
    expect(bad.some((v) => v.startsWith('FILLED_CELLS_LOW')), bad.join(' ')).toBe(true);
    expect(bad.some((v) => v.startsWith('INDEX_COUNT'))).toBe(false);
    // ...and the shipped room, with the same shell and eight props in it, passes.
    expect(violations(composite(0))).toEqual([]);
  });

  it('THE SAME FURNITURE, MOVED, fails the balance ceiling', () => {
    // THE PERMUTATION TEST. Eleven of the bounds in this file are invariant
    // under moving the props and the rest are local-neighbour statistics; before
    // `contentBalance` existed, relocating every prop to a legal position left
    // all of them unchanged. This room has the identical prop list with one
    // number per entry changed.
    const shoved: readonly GymPropPlacement[] = GYM_PROPS_TRAINING.map((p) => ({
      ...p,
      XF: 0.02,
    }));
    expect(shoved.length).toBe(GYM_PROPS_TRAINING.length);
    expect(shoved.map((p) => p.ART)).toEqual(GYM_PROPS_TRAINING.map((p) => p.ART));
    const moved = renderGymScene({ ...SPEC, props: shoved });
    expect(Array.from(moved.data), 'the shove did not move anything').not.toEqual(
      Array.from(renderGymScene(SPEC).data),
    );

    const grid = compositeOnto(moved, 0);
    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('CONTENT_BALANCE_HIGH')), bad.join(' ')).toBe(true);
    // ...and it passes every bound that cannot see where anything is, which is
    // what makes the balance bound load-bearing rather than decorative.
    for (const blind of [
      'INDEX_COUNT',
      'MEAN_LUMA',
      'P90_LUMA',
      'EDGE_SHARE',
      'BRIGHT_SHARE',
      'OVER_FIGURE_SHARE',
      'FURNITURE_SHARE',
      'RIM_',
    ]) {
      expect(bad.some((v) => v.startsWith(blind)), `${blind} also fired: ${bad.join(' ')}`).toBe(
        false,
      );
    }
  });

  it('and a legal reshuffle moves the composition numbers without failing', () => {
    // The other half of the same proof: the metric is not a constant that only
    // fires on absurd input. Mirroring the room about its centre is a perfectly
    // legal arrangement, and it swings the balance from positive to negative.
    const mirrored: readonly GymPropPlacement[] = GYM_PROPS_TRAINING.map((p) => ({
      ...p,
      XF: 0.92 - p.XF,
    }));
    const grid = compositeOnto(renderGymScene({ ...SPEC, props: mirrored }), 0);
    const a = measureSceneReadability(composite(0), { occluders: OCCLUDERS });
    const b = measureSceneReadability(grid, { occluders: OCCLUDERS });
    expect(Math.sign(a.contentBalance)).not.toBe(Math.sign(b.contentBalance));
    expect(Math.abs(a.contentBalance - b.contentBalance)).toBeGreaterThan(0.1);
    expect(a.contentCells).not.toEqual(b.contentCells);
  });

  it('reports nothing at all for the shipped room, so a finding is the plant', () => {
    expect(violations(composite(0.5))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Parallax
// ---------------------------------------------------------------------------

describe('the layers are separate layers', () => {
  it('slides each at its own rate, and the wall slowest', () => {
    const cam = SPEC.w / 4;
    expect(layerOffset(cam, GYM_PARALLAX.WALL)).toBe(Math.round(-cam * GYM_PARALLAX.WALL));
    expect(Math.abs(layerOffset(cam, GYM_PARALLAX.WALL))).toBeLessThan(
      Math.abs(layerOffset(cam, GYM_PARALLAX.PROPS_FAR)),
    );
    expect(Math.abs(layerOffset(cam, GYM_PARALLAX.PROPS_FAR))).toBeLessThan(
      Math.abs(layerOffset(cam, GYM_PARALLAX.FLOOR)),
    );
    expect(Math.abs(layerOffset(cam, GYM_PARALLAX.FLOOR))).toBeLessThan(
      Math.abs(layerOffset(cam, GYM_PARALLAX.PROPS_NEAR)),
    );
  });

  it('moves a near prop further than a far one for the same camera', () => {
    const near: GymPropPlacement = { ART: 'CHALK_STAND', XF: 0.5, DEPTH: 0.9, DIM: false };
    const far: GymPropPlacement = { ...near, DEPTH: 0 };
    const cam = SPEC.w / 2;
    const moved: GymSceneSpec = { ...SPEC, cameraX: cam };
    const nearShift = propBox(moved, near).x0 - propBox(SPEC, near).x0;
    const farShift = propBox(moved, far).x0 - propBox(SPEC, far).x0;
    expect(Math.abs(nearShift)).toBeGreaterThan(Math.abs(farShift));
    expect(Math.sign(nearShift)).toBe(Math.sign(farShift));
  });

  it('still covers the grid when the camera has moved a long way', () => {
    for (const cameraX of [-SPEC.w * 2, -SPEC.w / 3, SPEC.w / 3, SPEC.w * 2]) {
      const g = renderGymScene({ ...SPEC, cameraX });
      for (let i = 0; i < g.data.length; i += 1) {
        expect(isTransparentIndex(g.data[i] ?? 0), `hole at camera ${cameraX}`).toBe(false);
      }
    }
  });

  it('is unexercised by the shipped stage, and says so', () => {
    // GDD §12.1: build the tunable version and say plainly what has not been
    // played. The daily session's stage is at camera 0 and always will be until
    // something pans it.
    expect(liftStageScene().cameraX).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Refusal conditions and purity
// ---------------------------------------------------------------------------

describe('what the room is not allowed to contain', () => {
  it('has a closed prop catalogue with no meter, gauge, dial or scoreboard', () => {
    // GDD §3.4 and §12.3 forbid a visible fatigue meter, and §12.3 is a refusal
    // condition. Pinned exactly, so scenery that displays a level cannot arrive
    // without an edit here.
    expect([...GYM_PROP_KINDS].sort()).toEqual(
      [
        'BUMPER_STACK',
        'CEILING_LAMP',
        'CHALK_STAND',
        'DUMBBELL_RACK',
        'EQUIPMENT_CASE',
        'FLAT_BENCH',
        'JUDGE_TABLE',
        'KETTLEBELL_ROW',
        'LOADED_BAR',
        'PLATE_TREE',
        'POWER_RACK',
      ].sort(),
    );
    for (const kind of GYM_PROP_KINDS) {
      expect(/METER|GAUGE|DIAL|BAR_GRAPH|SCOREBOARD|READINESS|FATIGUE/.test(kind)).toBe(false);
    }
  });

  /**
   * GDD §12.3: no real, named athlete, brand or company identity — name, logo,
   * likeness or wordmark — in any asset, string, config or code path. §7.3 puts
   * real wordmarks on Tier 3 surfaces (cut-ins, character select, shop, result
   * card); THE ENVIRONMENT IS NOT ONE, so none belongs here at any point.
   *
   * A gym is the highest-risk surface in the app for this, because every real
   * rack, bench, bar, plate, shoe and backdrop carries a mark and a "realistic"
   * detail is exactly how one arrives. §12.3 asks for a name-by-name statement
   * of what was searched rather than "looks fine", so the list is in the test.
   */
  const REAL_IDENTITIES: readonly string[] = [
    // Federations and meet organisations
    'IPF',
    'USAPL',
    'USPA',
    'IPL',
    'WRPF',
    'GPC',
    'SPF',
    'RPS',
    'NPL',
    'BVDK',
    'Powerlifting America',
    'OpenLifter',
    'OpenPowerlifting',
    // Bar, plate and rack makers
    'Rogue',
    'Eleiko',
    'Ivanko',
    'Texas Power',
    'Ohio Bar',
    'Kabuki',
    'Sorinex',
    'Hammer Strength',
    'Life Fitness',
    'Cybex',
    'Nautilus',
    'Precor',
    'Concept2',
    'Rep Fitness',
    'Force USA',
    'Titan',
    'York Barbell',
    'Uesaka',
    // Apparel, belts, sleeves, shoes
    'SBD',
    'Inzer',
    'Nike',
    'Adidas',
    'Reebok',
    'Romaleos',
    'Adipower',
    'Under Armour',
    'Virus',
    'A7',
    // Gym chains
    "Gold's Gym",
    'Planet Fitness',
    'Anytime Fitness',
    'CrossFit',
    'Westside Barbell',
    'Juggernaut',
    // Lifters
    'Coan',
    'Hafthor',
    'Eddie Hall',
    'Larry Wheels',
    'Julius Maddox',
    'Ray Williams',
    'Taylor Atwood',
    'Amanda Lawrence',
    'Jessica Buettner',
    'Jesus Olivares',
    'Sheiko',
    'Smolov',
  ];

  const GYM_LAYER_FILES = [
    'gymScene.ts',
    'gymTuning.ts',
    'gymProps.ts',
    'gymPalette.ts',
    'gymReadability.ts',
    'GymSceneView.tsx',
  ];

  /**
   * Whole words only. `IPL` sits inside `multiple` and every short acronym here
   * has a common substring somewhere; a mark arrives as a word, not a syllable.
   */
  const namePattern = (name: string): RegExp =>
    new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

  it('names no real athlete, brand, federation or company, anywhere in the layer', () => {
    // Raw source, comments included — a mark in a comment is a mark somebody
    // will promote into a drawing later. Every file in the environment layer.
    expect(GYM_LAYER_FILES.length).toBeGreaterThan(5);
    expect(REAL_IDENTITIES.length).toBeGreaterThan(50);
    for (const file of GYM_LAYER_FILES) {
      const source = readFileSync(path.join(HERE, file), 'utf8');
      expect(source.length, `${file} is empty`).toBeGreaterThan(500);
      for (const name of REAL_IDENTITIES) {
        expect(namePattern(name).test(source), `${file} names ${name}`).toBe(false);
      }
    }
    // ...and the scan is not vacuous: it finds a planted mark in each category.
    for (const planted of [
      'a Rogue rack against the wall',
      'the IPF plate ladder',
      'Ed Coan on the platform',
      "a poster outside Gold's Gym",
    ]) {
      expect(
        REAL_IDENTITIES.some((n) => namePattern(n).test(planted)),
        `the scan missed: ${planted}`,
      ).toBe(true);
    }
  });

  it('cannot draw a wordmark at all — there is no text path in the room', () => {
    // Structural, like the fatigue meter. A logo needs either a glyph renderer
    // or a bitmap of one, and this layer has neither: every mark it makes is a
    // rectangle of a palette index, and the only strings in the whole prop
    // catalogue are the kind keys and an anchor.
    for (const file of GYM_LAYER_FILES) {
      const code = codeOnly(readFileSync(path.join(HERE, file), 'utf8'));
      for (const banned of [
        'drawText',
        'fillText',
        'measureText',
        'TextBlob',
        'Typeface',
        'matchFamilyStyle',
        'Paragraph',
        'Glyph',
        'FontMgr',
        'useFont',
        'fromText',
      ]) {
        expect(code.includes(banned), `${file} reaches for ${banned}`).toBe(false);
      }
    }
  });

  it('carries no drawable string in the prop catalogue at all', () => {
    for (const kind of GYM_PROP_KINDS) {
      const art = PROP_ART[kind];
      // The only string a prop owns is where it is pinned, and it is one of two
      // words. Everything else in a drawing is five numbers.
      expect(['floor', 'ceiling']).toContain(art.ANCHOR);
      for (const rect of art.RECTS) {
        expect(rect.length).toBe(5);
        for (const v of rect) expect(typeof v).toBe('number');
      }
      // ...and the kind key itself is a generic equipment noun, screaming case,
      // never rendered — pinned exactly by the catalogue test above.
      expect(/^[A-Z][A-Z_]*$/.test(kind)).toBe(true);
    }
    // The meet backdrop is the place a mark would feel most natural. It is
    // blank colour blocks and a painted band, and it has no string field.
    for (const value of Object.values(GYM_BANNER)) expect(typeof value).toBe('number');
    expect(GYM_BANNER.PATCH_COUNT).toBeGreaterThan(0);
  });

  it('takes no input from which a fatigue level could be drawn', () => {
    // Structural, not a promise. `GymSceneSpec` is a room, a size, a floor, a
    // focus column and a camera. Pinned so a sixth field is a visible edit.
    expect(Object.keys(SPEC).sort()).toEqual(
      ['cameraX', 'floorRow', 'focusX', 'h', 'venue', 'w'].sort(),
    );
  });

  it('is a pure renderer — no React, no randomness, no clock, no currency', () => {
    // Scanned through `codeOnly`, the audit's own stripper, so it reads CODE
    // and not prose. Without it this test fails on the sentence in
    // `gymScene.ts` that says there is no currency in it, which is the kind of
    // false positive that gets a check deleted rather than fixed.
    const files = [
      'gymScene.ts',
      'gymTuning.ts',
      'gymProps.ts',
      'gymPalette.ts',
      'gymReadability.ts',
    ];
    expect(files.length).toBeGreaterThan(4);
    for (const file of files) {
      const code = codeOnly(readFileSync(path.join(HERE, file), 'utf8'));
      expect(code.length, `${file} is empty`).toBeGreaterThan(500);
      for (const banned of [
        'react',
        'Math.random',
        'Date.now',
        'new Date',
        'localStorage',
        'fetch(',
        'require(',
        'currency',
        'gymBucks',
        'purchase',
        'advert',
        'fatigue',
        'readiness',
      ]) {
        expect(code.toLowerCase().includes(banned.toLowerCase()), `${file} uses ${banned}`).toBe(
          false,
        );
      }
    }
    // ...and the scan is not vacuous: the same stripper keeps real code.
    expect(codeOnly(readFileSync(path.join(HERE, 'gymScene.ts'), 'utf8'))).toContain(
      'renderGymScene',
    );
    expect(codeOnly('const a = 1; // Math.random()')).not.toContain('Math.random');
    expect(codeOnly('const a = Math.random();')).toContain('Math.random');
  });

  it('never lets the room out-value the lifter, at any moment of any rep', () => {
    // Cheap enough to run over the whole pose space rather than four samples.
    const room = renderGymScene(SPEC);
    const roomTop = Math.max(
      ...[...new Set<number>(room.data)].map((index) => lumaOfIndex(index) ?? 0),
    );
    expect(roomTop).toBeLessThan(lumaOfIndex(PAL.SKIN_HI) ?? 0);
    expect(roomTop).toBeGreaterThan(lumaOfIndex(GYM.WOOD_LIGHT) ?? 0);
  });
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

describe('the props are drawings that fit their own boxes', () => {
  it('keeps every rect inside the art box it declares', () => {
    for (const kind of GYM_PROP_KINDS) {
      const art = PROP_ART[kind];
      expect(art.W).toBeGreaterThan(0);
      expect(art.H).toBeGreaterThan(0);
      expect(art.RECTS.length).toBeGreaterThan(0);
      for (const [x, y, w, h] of art.RECTS) {
        expect(x, `${kind}`).toBeGreaterThanOrEqual(0);
        expect(y, `${kind}`).toBeGreaterThanOrEqual(0);
        expect(x + w, `${kind} overruns W`).toBeLessThanOrEqual(art.W);
        expect(y + h, `${kind} overruns H`).toBeLessThanOrEqual(art.H);
      }
    }
  });

  it('draws every prop in an allocated background colour', () => {
    for (const kind of GYM_PROP_KINDS) {
      for (const rect of PROP_ART[kind].RECTS) {
        const index = rect[4];
        expect(sceneColorAt(index), `${kind} uses index ${index}`).toBeDefined();
        expect(roleOf(index)).toBe('background');
      }
    }
  });

  it('lights every prop from the same side as the figure', () => {
    // SHADING.LIGHT_DIR.x is negative: the key is upper-LEFT. A prop whose lit
    // column is on its right flank is lit by a second, imaginary lamp.
    for (const kind of ['POWER_RACK', 'PLATE_TREE', 'DUMBBELL_RACK', 'CHALK_STAND'] as const) {
      const art = PROP_ART[kind];
      const lit = art.RECTS.filter((r) => r[4] === GYM.STEEL_LIT && r[2] === 1);
      expect(lit.length, `${kind} has no lit column`).toBeGreaterThan(0);
      for (const [x, y, , h] of lit) {
        const body = art.RECTS.find(
          (r) => r[4] === GYM.STEEL_FRAME && r[0] === x && r[1] === y && r[3] === h,
        );
        expect(body, `${kind} lit column at ${x} has no tube under it`).toBeDefined();
      }
    }
  });

  it('places every venue prop somewhere the scene can actually draw it', () => {
    for (const venue of ['training-gym', 'meet-platform'] as const satisfies readonly GymVenue[]) {
      const spec: GymSceneSpec = { ...SPEC, venue };
      for (const placement of GYM_VENUE_PROPS[venue]) {
        const box = propBox(spec, placement);
        expect(box.x1, `${placement.ART} is entirely off the left`).toBeGreaterThan(0);
        expect(box.x0, `${placement.ART} is entirely off the right`).toBeLessThan(spec.w);
        expect(box.y1, `${placement.ART} is above the frame`).toBeGreaterThan(0);
        expect(box.y0, `${placement.ART} is below the frame`).toBeLessThan(spec.h);
        expect(placement.DEPTH).toBeGreaterThanOrEqual(0);
        expect(placement.DEPTH).toBeLessThanOrEqual(1);
      }
    }
  });

  it('hangs the lamps evenly and inside the frame', () => {
    const g = renderGymScene(SPEC);
    let filament = 0;
    for (let i = 0; i < g.data.length; i += 1) if (g.data[i] === GYM.LAMP_CORE) filament += 1;
    expect(filament).toBeGreaterThanOrEqual(GYM_LIGHTING.LAMP_COUNT);
    // The filament is allowed to be bright because it is small. This is the
    // "small" half, as an area bound rather than a value one.
    expect(filament / (g.w * g.h)).toBeLessThan(0.005);
  });

  it('puts the windows above the figure, where their glass cannot hurt', () => {
    const band = clearBand(SPEC, RESOLUTION.LIFTER_HEIGHT_PX);
    const glassBottom = Math.round(junctionRow(SPEC) * GYM_WINDOWS.TOP_FRAC) + GYM_WINDOWS.H;
    expect(glassBottom).toBeLessThan(band.y0);
  });
});
