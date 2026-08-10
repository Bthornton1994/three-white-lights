import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { codeOnly } from '../tuning/audit';
import { LIFT_TUNING } from '../game/liftTuning';
import { MEET_TUNING } from '../game/meetTuning';
import { CENTER_X, RESOLUTION } from './spriteTuning';
import { BANK_SIZE, PAL, isTransparentIndex } from './palette';
import {
  GYM,
  GYM_DIM_STEP,
  GYM_RAMPS,
  SCENE_INDEX_COUNT,
  WALL_COURSE_BANDS,
  dimDelta,
  dimIndex,
  lumaOfIndex,
  sceneColorAt,
  wallCourseDeltas,
} from './gymPalette';
import { GYM_PROP_KINDS, PROP_ART } from './gymProps';
import {
  GYM_BANNER,
  GYM_CLEAR_BAND,
  GYM_CONTACT_SHADOW,
  GYM_CROWD,
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
  GYM_VENUE,
  GYM_WALL_PAINT,
  GYM_WINDOWS,
  type GymPropPlacement,
  type GymVenue,
} from './gymTuning';
import {
  blitOver,
  clearBand,
  contactShadowPatch,
  crowdFrontRow,
  floorDepth,
  junctionRow,
  layerOffset,
  liftContactShadow,
  liftStageOccluders,
  liftStageScene,
  platformBackRow,
  propBox,
  propFootprint,
  propOrigin,
  propShadowRows,
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
 * EVERY BOUND HAS A PLANT THAT FAILS IT — EXCEPT TWO, WHICH ARE NAMED
 * ===========================================================================
 * This heading used to read "EVERY BOUND IS BRACKETED AT BOTH ENDS", and three
 * ceilings had nothing behind them at the time. It is now the weaker, true
 * claim, and `describe('what this file can and cannot make fail')` at the bottom
 * of the file ENFORCES it rather than promising it: a ledger of every bound any
 * grid here has actually been measured against and failed, asserted against
 * `Object.keys(BOUNDS)`, with `RIM_P25_MIN` and `RIM_P50_MIN` declared as having
 * no plant and the reasons written down. A new bound cannot arrive without
 * landing in one of the two lists.
 *
 * It read THREE until the risen hall was brought into this file.
 * `FIGURE_OVER_ROOM_P90_MIN` now has one — a crowd band repainted in the room's
 * brightest paint — and its old excuse ("the room would have to be a wall of
 * filaments") turned out to have been an argument about the lamps that never
 * considered the seating.
 *
 * The failure this run keeps finding is a check that a WORSE artifact satisfies
 * more easily. Most readability quantities here have that shape available, and
 * are therefore bounded on both sides:
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
 *   - a room whose content is all in one cell fails `CONTENT_PEAK`.
 *   - a room that spends 35 of the 36 background colours it could fails
 *     `INDEX_COUNT_MAX`.
 *   - a room lit by a WALL of filaments rather than three lamps fails
 *     `BRIGHT_SHARE_MAX`.
 *
 * `describe('the bounds bite')` plants each of those and asserts the SPECIFIC
 * bound that catches it. If a bound were ever loosened until it could not fail,
 * those tests go red rather than green.
 *
 * The last three arrived late, and the honest reason is on the record: a
 * previous version of this header made the blanket claim with only six plants
 * behind it, and `CONTENT_PEAK_MAX` (0.35 against the artifact's worst 0.236),
 * `INDEX_COUNT_MAX` (34 in a 36-index space) and `BRIGHT_SHARE_MAX` (1% against
 * 0.086%) had nothing that could fail them. An overstated header is the same
 * defect as an unfalsifiable check, one level up.
 *
 * ===========================================================================
 * AND TWO BOUNDS ARE CALIBRATED AGAINST THE ARTIFACT, WHICH IS SAID OUT LOUD
 * ===========================================================================
 * `FURNITURE_SHARE_MIN` and `FILLED_CELLS_MIN` were both chosen by measuring the
 * shipped room and the bare shell and putting a line between them. That is a
 * regression detector wearing a bar's clothes: it can catch the furniture being
 * deleted and it cannot tell you the furniture was never enough. Both say so at
 * their own definition. No other bound in this file is set that way — the rim
 * floors are divisions of `EDGE_LUMA_DELTA`, the luma and share bounds are round
 * numbers with plants on both sides, and `RIM_DEAD_SHARE_MAX` is zero.
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
 *   indices            26-27          mean luma  35.7-36.2  (34.8 unoccluded)
 *   luma p90           54.6-71.8      edge share 12.5-12.7% (10.9 unoccluded)
 *   behind edge share  21.4-23.9%     bright     0.08-0.09% (0.10 unoccluded)
 *   over figure median 6.6-9.4%       (7.6 unoccluded)
 *   furniture share    5.7-6.0%       (4.8 unoccluded)
 *   content balance    -0.01..+0.11   (-0.05 unoccluded)
 *   filled cells       8-9 of 12      (9 unoccluded)
 *   rim keyline p05/p25/p50   11.4-15.4 / 22.2-25.0 / 39.1-49.1
 *   rim fill    p05/p10        11.4-16.1 / 14.6-25.0
 *   rim worst / dead share    5.7-7.1 / 0.00%  in the training gym
 *                             0.0     / 1.96%  in the meet venue — SEE BELOW
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
   * CALIBRATED AGAINST THE ARTIFACT, exactly like `FURNITURE_SHARE_MIN`, and
   * flagged here because the previous version of this note described the
   * arithmetic — "the floor is set one below it" — without ever using the word.
   * 7 is (the shipped room's 8) minus one. A floor placed one step under the
   * thing it is judging can catch a REGRESSION and cannot tell anybody the
   * layout was never good enough in the first place; it bites at all only
   * because the bare shell scores 6 and fails, and `describe('the bounds bite')`
   * plants that. Read it as a ratchet, not as a bar.
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
  /**
   * NO CROSSING MAY BE A DEAD CONTACT. Zero, and the only bound in this file
   * that was not chosen by looking at something.
   *
   * The five percentiles above are all `p05` or higher, which means a collision
   * covering under five per cent of the silhouette CANNOT MOVE ANY OF THEM. The
   * shipped meet composite has exactly that shape: one crossing at 0.00 luma
   * where `HAIR_DARK` meets `CROWD_MID`, six more at 1.03 where `OUTLINE` meets
   * `CROWD_DARK`, 1.96% of 358 crossings — and `rimContrast.p05` reads the
   * 18th-worst sample and never sees any of it. The percentile was passing that
   * frame because it could not reach the dirt, not because the frame is clean.
   *
   * `rimDeadShare` counts crossings at or under `DEAD_CONTACT_LUMA` (a quarter
   * of the hard-edge step). The ceiling is 0 because "part of the silhouette
   * vanishes" is not a quantity with an acceptable non-zero value. THE MEET
   * VENUE FAILS IT, and that failure is asserted by name rather than tuned
   * away — see `describe('readability at phone scale')`.
   */
  RIM_DEAD_SHARE_MAX: 0,
  /**
   * The figure keeps the top of the range outright.
   *
   * The shipped rooms clear it by a distance — the figure's p90 is 174.9 and the
   * background's tops out around 71.8 — and the thing that can take it away is
   * the CROWD, not the lamps: the seating is 3,120 of the room's 22,490 pixels,
   * enough that repainting it bright drops this to 38.7. That is the plant, in
   * `it('WOULD catch a crowd that out-values the lifter')`.
   */
  FIGURE_OVER_ROOM_P90_MIN: 60,
} as const;

type Violation = string;

/**
 * THE COVERAGE LEDGER.
 *
 * Every bound any grid in this file has ever been measured against and failed,
 * accumulated as the suite runs. The last test in the file asserts it, which is
 * what turns "every bound is bracketed at both ends" from a claim in a header
 * into something that goes red when it stops being true.
 *
 * Whole-file by construction: a `vitest -t` run that skips the plants will fail
 * the ledger, and that is correct — a filtered run is not a coverage run.
 */
const FIRED_BOUNDS = new Set<string>();
let MEASURED_GRIDS = 0;

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
  MEASURED_GRIDS += 1;
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
  check('RIM_DEAD_SHARE', r.rimDeadShare, 0, BOUNDS.RIM_DEAD_SHARE_MAX);
  // NAMED FOR ITS BOUND, and that is a fix rather than a style choice: the
  // coverage ledger at the bottom of this file derives the fired-bound name from
  // the CONSTANT's name by stripping `_MIN`/`_MAX`, so a check called
  // `FIGURE_OVER_ROOM` could never be accounted for against
  // `FIGURE_OVER_ROOM_P90_MIN` however hard it fired. That went unnoticed for as
  // long as the bound was declared unplanted; the moment a plant existed the
  // ledger said it did not.
  check(
    'FIGURE_OVER_ROOM_P90',
    r.figureLuma.p90 - r.backgroundLuma.p90,
    BOUNDS.FIGURE_OVER_ROOM_P90_MIN,
    noCeiling,
  );
  for (const v of out) FIRED_BOUNDS.add(v.split('(')[0] ?? v);
  return out;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SPEC = liftStageScene();
const MEET_SPEC: GymSceneSpec = { ...SPEC, venue: 'meet-platform' };
const DEMO_TOTAL_KG = 250;
const OCCLUDERS = liftStageOccluders();

/**
 * THE MEET ROOMS THE GAME ACTUALLY DRAWS — including the risen ones.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS, AND WHAT IT ADMITS ABOUT THE FILE BEFORE IT
 * ---------------------------------------------------------------------------
 * Every measurement in this file used to render `{ ...liftStageScene(), venue }`
 * and nothing else, so `crowdRisePx` was `undefined` — 0 — in all of them. The
 * word did not appear in this file at any point. But meet day brings the seating
 * up on exactly the two beats GDD §12.2 judges: an urgent walk-out and three
 * white lights. So the room the two highest-value moments in the game are drawn
 * in had never been through a single bound here, and a crowd that rose until it
 * out-valued the lifter would have passed this suite untouched.
 *
 * The rises are read from `MEET_TUNING.CROWD` rather than restated, so a tuning
 * pass that turns them up drags them through these bounds automatically. That is
 * the whole point: the constants are meant to be turned by hand later (GDD
 * §12.1), and a bound that only ever sees today's value is not protecting the
 * ones tomorrow's playtester will try.
 */
const MEET_RISES: readonly (readonly [string, number])[] = [
  ['seated', 0],
  ['risen for a walk-out', MEET_TUNING.CROWD.WALKOUT_RISE_PX],
  ['on its feet for three whites', MEET_TUNING.CROWD.CHEER_RISE_PX],
];

/** The meet hall with its seating `rise` rows into the standing wave. */
function meetSpecAt(rise: number): GymSceneSpec {
  return rise <= 0 ? MEET_SPEC : { ...MEET_SPEC, crowdRisePx: rise };
}

/** The top row of the seating band, from the venue's own row count. */
function crowdBandTop(): number {
  return Math.max(0, crowdFrontRow(MEET_SPEC) - GYM_VENUE[MEET_SPEC.venue].CROWD_ROWS);
}

/** Every palette index drawn inside the seating band's rows. */
function bandIndices(room: IndexGrid): ReadonlySet<number> {
  const out = new Set<number>();
  for (let y = crowdBandTop(); y < crowdFrontRow(MEET_SPEC); y += 1) {
    for (let x = 0; x < room.w; x += 1) out.add(getPx(room, x, y));
  }
  return out;
}

/**
 * The brightest colour the ROOM can draw.
 *
 * `roleOf(index) === 'background'` is load-bearing rather than tidy. Painted in
 * one of the FIGURE's colours the plant below would be counted as figure by
 * `measureSceneReadability`, the background statistics would never see it, and
 * it would fire three floors about the room being EMPTY instead of a ceiling
 * about it being loud — a mutation that goes red for the wrong reason, which is
 * the failure this whole round is about. It was written that way first, and this
 * comment is here because the numbers caught it.
 */
function brightestRoomIndex(): number {
  let best = 0;
  let bestLuma = -1;
  for (let index = 0; index < SCENE_INDEX_COUNT * BANK_SIZE; index += 1) {
    if (sceneColorAt(index) === undefined) continue;
    if (roleOf(index) !== 'background') continue;
    const luma = lumaOfIndex(index) ?? 0;
    if (luma > bestLuma) {
      bestLuma = luma;
      best = index;
    }
  }
  return best;
}

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

/**
 * THE MEET ROOM WITH ITS SEATING PUT BACK DOWN ON THE FLOOR — the mutation of
 * `GYM_CROWD.RISER_ROWS`, and the non-vacuity control for `rimDeadShare`.
 *
 * The band of rows the crowd is drawn in is moved down by exactly `RISER_ROWS`,
 * so its front rail lands on the wall/floor junction the way it did before this
 * pass, and the vacated rows go back to the wall paint immediately above them.
 * Nothing else about the room changes.
 *
 * It is built by moving pixels rather than by re-rendering with a different
 * constant because `RISER_ROWS` is frozen and `GymSceneSpec` deliberately has no
 * field for it. What matters is that the resulting grid puts seating behind the
 * standing figure's crown, which is the defect, and that the shipped grid does
 * not.
 */
function seatingLoweredToTheFloor(): IndexGrid {
  return compositeOverPainted((g) => {
    const room = renderGymScene(MEET_SPEC);
    g.data.set(room.data);
    const drop = GYM_CROWD.RISER_ROWS;
    const bottom = crowdFrontRow(MEET_SPEC);
    const top = Math.max(0, bottom - GYM_VENUE[MEET_SPEC.venue].CROWD_ROWS);
    for (let y = bottom - 1; y >= top; y -= 1) {
      for (let x = 0; x < g.w; x += 1) setPx(g, x, y + drop, getPx(room, x, y));
    }
    const above = Math.max(0, top - 1);
    for (let y = top; y < Math.min(top + drop, bottom); y += 1) {
      for (let x = 0; x < g.w; x += 1) setPx(g, x, y, getPx(room, x, above));
    }
  }, 0);
}

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

  it('FAILS NOTHING IN THE MEET VENUE EITHER — the known fail is closed', () => {
    // WHAT THIS LINE USED TO SAY, kept because the history is the argument:
    //
    //   expect(bad, report(grid)).toEqual(['RIM_DEAD_SHARE_HIGH(0.0196>0)']);
    //
    // The meet venue's crowd is drawn in CROWD_DARK (20.33) and CROWD_MID
    // (45.22). After A1's shading rework the lifter's OUTLINE is 19.31 and his
    // HAIR_DARK is 45.22 — the same number to two decimal places. The seating
    // was painted from the wall/floor junction UPWARD, and the junction (row
    // 119) sits inside the standing figure's span (103-165), so his crown was
    // in front of the heads and the room and the figure were literally the same
    // colour at that crossing: one crossing at 0.00 luma, seven at 1.03, 1.96%
    // of 358. Every percentile passed it, because p05 reads the 18th-worst.
    //
    // `gymPalette.ts` recorded that no colour pair in the rgb5 grid fixes it
    // and that "the actual fix is geometric — the crowd's seating sitting below
    // his crown rather than behind it". That is `GYM_CROWD.RISER_ROWS`, and it
    // is now 20: the band stops twenty rows above the floor, on a barrier, and
    // what is behind his head is WALL_MID — the same value the training gym has
    // always put there.
    //
    // Measured after the change: rim worst 5.7-8.0 luma across the rep, dead
    // share 0.00%. `describe('the bounds bite')` plants the OLD geometry and
    // asserts it still fails, so this pass is a fix rather than a deleted check.
    for (const [name, frac] of MOMENTS) {
      const grid = composite(frac, MEET_SPEC);
      expect(violations(grid), `meet ${name}:\n${report(grid)}`).toEqual([]);
      const r = measureSceneReadability(grid, { occluders: OCCLUDERS });
      expect(r.rimDeadShare, `meet ${name} has a dead contact`).toBe(0);
      expect(r.rimWorst, `meet ${name}`).toBeGreaterThan(GYM_READABILITY.DEAD_CONTACT_LUMA);
    }
  });

  it('AND FAILS NOTHING WITH THE HALL ON ITS FEET — the room the beat draws', () => {
    // THE GAP THIS CLOSES. Every bound above was measured on a SEATED hall,
    // because `liftStageScene()` leaves `crowdRisePx` undefined and nothing here
    // ever set it. Meet day brings the seating up on an urgent walk-out and on
    // three white lights — the two beats §12.2 actually judges — so the room
    // those frames draw had never been measured at all.
    //
    // Every rise the game ships, every moment of the rep, every bound.
    for (const [state, rise] of MEET_RISES) {
      for (const [name, frac] of MOMENTS) {
        const grid = composite(frac, meetSpecAt(rise));
        expect(violations(grid), `meet ${name}, ${state}:\n${report(grid)}`).toEqual([]);
        const r = measureSceneReadability(grid, { occluders: OCCLUDERS });
        expect(r.rimDeadShare, `meet ${name}, ${state}, dead contact`).toBe(0);
        expect(r.rimWorst, `meet ${name}, ${state}`).toBeGreaterThan(
          GYM_READABILITY.DEAD_CONTACT_LUMA,
        );
      }
    }
    // NON-VACUITY: the risen rooms really are different rooms. Without this the
    // loop above could be three copies of the seated frame and still pass.
    const pixelsOf = (rise: number): Uint8Array => renderGymScene(meetSpecAt(rise)).data;
    const seen = new Set(MEET_RISES.map(([, rise]) => pixelsOf(rise).join(',')));
    expect(seen.size, 'the shipped rises draw the same room').toBe(MEET_RISES.length);
    expect(MEET_RISES.length).toBeGreaterThan(2);
  });

  it('never lets a RISEN hall out-value the lifter, at any rise the game ships', () => {
    // The bound `describe('the room is a pure renderer')` holds over the
    // training gym, held over the room that actually competes with the three
    // lamps. The seating is the largest mass in the lower two thirds of a meet
    // frame, and `gymTuning.ts` says it is "held to the bottom of the value
    // range so the busiest area of the screen is also the quietest one" — so the
    // thing to check is that STANDING UP does not spend brighter paint.
    const figureTop = lumaOfIndex(PAL.SKIN_HI) ?? 0;
    const seatedBand = bandIndices(renderGymScene(MEET_SPEC));
    for (const [state, rise] of MEET_RISES) {
      const room = renderGymScene(meetSpecAt(rise));
      const roomTop = Math.max(
        ...[...new Set<number>(room.data)].map((index) => lumaOfIndex(index) ?? 0),
      );
      expect(roomTop, `${state}: the room out-values the lifter`).toBeLessThan(figureTop);
      // The band draws no colour a seated hall does not. A subset rather than a
      // luma comparison, because it also catches a rise that reached for a
      // DARKER new value — either way the band stopped being the two-colour mass
      // the venue's palette note says it is.
      for (const index of bandIndices(room)) {
        expect(seatedBand.has(index), `${state}: the band grew index ${index}`).toBe(true);
      }
    }
  });

  it('WOULD catch a crowd that out-values the lifter — the plant', () => {
    // The other half of the check above, and the reason it is worth anything:
    // a band repainted in the room's own brightest paint, at the rise the cheer
    // ships, and the bounds this file already has catch it.
    const bright = brightestRoomIndex();
    const plant = renderGymScene(meetSpecAt(MEET_TUNING.CROWD.CHEER_RISE_PX));
    for (let y = crowdBandTop(); y < crowdFrontRow(MEET_SPEC); y += 1) {
      for (let x = 0; x < plant.w; x += 1) {
        if (getPx(plant, x, y) === GYM.CROWD_DARK) continue;
        setPx(plant, x, y, bright);
      }
    }
    // The subset check goes first, because it is the one that is specific to
    // this defect rather than to overall busyness.
    expect(bandIndices(plant).has(bright)).toBe(true);
    expect(bandIndices(renderGymScene(MEET_SPEC)).has(bright)).toBe(false);
    // ...and the composited frame fails the file's own bounds, BY NAME, and one
    // of them is `FIGURE_OVER_ROOM` — the bound that says the lifter keeps the
    // top of the value range outright. Its note in the ledger used to read "the
    // room would have to be a wall of filaments"; the seating is 3,120 of the
    // room's 22,490 pixels and the crowd turns out to be enough on its own.
    // Equality rather than `.some(...)`, so this cannot quietly stop firing the
    // one that matters.
    const grid = compositeOnto(plant, 0, false);
    expect(violations(grid), `the bright band passed:\n${report(grid)}`).toEqual([
      'P90_LUMA_HIGH(136.1670>90)',
      'BRIGHT_SHARE_HIGH(0.0794>0.01)',
      'FIGURE_OVER_ROOM_P90_LOW(38.6960<60)',
    ]);
  });

  it('keeps the seating clear of the figure by GEOMETRY, checked on the silhouette', () => {
    // The bound above is a statistic. This is the thing the statistic is about,
    // and it is checked against the figure's REAL rendered crown rather than
    // against `RISER_ROWS` — so shrinking the riser back toward the junction
    // fails here by name even if the luma numbers happened to survive.
    //
    // AT EVERY RISE THE GAME SHIPS. A hall that rose DOWNWARD, or one whose
    // keyline spilled past the front rail, would put seating back behind his
    // head — the exact defect `RISER_ROWS` exists to have fixed — and until this
    // loop existed no measurement here had ever seen a risen room.
    const { grid: sprite } = renderLifterFrame(frameSpecFrom(frameAt(0), DEMO_TOTAL_KG));
    let crown = Number.POSITIVE_INFINITY;
    for (let y = 0; y < sprite.h; y += 1) {
      for (let x = 0; x < sprite.w; x += 1) {
        if (isTransparentIndex(getPx(sprite, x, y))) continue;
        crown = Math.min(crown, y + GYM_LIFT_STAGE.SPRITE_Y);
      }
    }
    for (const [state, rise] of MEET_RISES) {
      const room = renderGymScene(meetSpecAt(rise));
      // Rows the seating BAND is drawn in, told apart from the judges' table by
      // width: the table seats its officials in the same two colours and stands
      // on the floor in front of the lifter, 28 columns of 130, while the band
      // runs the whole width of the hall. Both counts are asserted below, so the
      // discriminator cannot quietly start matching nothing.
      const bandRows: number[] = [];
      let tableRows = 0;
      for (let y = 0; y < room.h; y += 1) {
        let n = 0;
        for (let x = 0; x < room.w; x += 1) {
          const v = getPx(room, x, y);
          if (v === GYM.CROWD_DARK || v === GYM.CROWD_MID) n += 1;
        }
        if (n > room.w / 2) bandRows.push(y);
        else if (n > 0) tableRows += 1;
      }
      // Non-vacuity: there IS a figure, there IS a band, and there IS a table
      // the discriminator is separating from it.
      expect(crown).toBeLessThan(room.h);
      expect(bandRows.length, state).toBeGreaterThan(
        GYM_VENUE[MEET_SPEC.venue].CROWD_ROWS / 2,
      );
      expect(tableRows, state).toBeGreaterThan(0);
      // The band's front rail is where `crowdFrontRow` says it is...
      expect(crowdFrontRow(MEET_SPEC)).toBe(junctionRow(MEET_SPEC) - GYM_CROWD.RISER_ROWS);
      // ...and every row of it is above his crown, standing or seated.
      expect(
        Math.max(...bandRows),
        `${state}: the seating reaches the lifter crown`,
      ).toBeLessThan(crown);
      // ...and it never reaches BELOW the rail either, which is what puts the
      // hall behind the platform rather than on it.
      expect(Math.max(...bandRows), `${state}: seating past the front rail`).toBeLessThan(
        crowdFrontRow(MEET_SPEC),
      );
    }
  });

  it('and the training gym — the shipped daily screen — fails none', () => {
    for (const [name, frac] of MOMENTS) {
      const r = measureSceneReadability(composite(frac), { occluders: OCCLUDERS });
      expect(r.rimDeadShare, `${name} has a dead contact`).toBe(0);
      // ...and the worst single crossing in the room, which no percentile sees.
      expect(r.rimWorst, name).toBeGreaterThan(GYM_READABILITY.DEAD_CONTACT_LUMA);
    }
  });

  it('shows the percentile really is blind to the contact the share catches', () => {
    // THE MUTATION FOR THE NEW MEASURE, AND THE MUTATION FOR THE GEOMETRY FIX,
    // in one grid: the meet room with the seating put back down on the floor,
    // which is exactly what `GYM_CROWD.RISER_ROWS: 0` drew until this pass.
    //
    // Assert the dead contact exists, then assert that every percentile bound is
    // satisfied anyway. If `rimDeadShare` were a re-statement of
    // `rimContrast.p05` this could not go green — and if the riser were not what
    // fixed the shipped frame, this plant would not fail.
    const r = measureSceneReadability(seatingLoweredToTheFloor(), { occluders: OCCLUDERS });
    expect(r.rimWorst).toBe(0);
    expect(r.rimDeadShare).toBeGreaterThan(0);
    expect(r.rimDeadShare).toBeLessThan(0.05);
    // ...and the p05 the old suite relied on is comfortably above its floor.
    expect(r.rimContrast.p05).toBeGreaterThan(BOUNDS.RIM_P05_MIN);
    expect(r.rimFill.p05).toBeGreaterThan(BOUNDS.RIM_FILL_P05_MIN);
    expect(r.rimContrast.p25).toBeGreaterThanOrEqual(BOUNDS.RIM_P25_MIN);
    // And it fails exactly the one bound, by name, the way the shipped frame
    // used to. Equality rather than `.some(...)`, so it cannot grow an entry.
    expect(violations(seatingLoweredToTheFloor())).toEqual(['RIM_DEAD_SHARE_HIGH(0.0307>0)']);
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
// THE RULER'S OWN PROVENANCE
// ---------------------------------------------------------------------------

/**
 * The three block-course deltas, read off the RENDERED WALL.
 *
 * One entry per wall band, top to bottom, or `null` where the band draws no
 * course row this scene can see. Found by scanning for course rows that are a
 * single uniform index across the whole width — which is what a course row is
 * before the windows, the stripe and the lamp wash are painted over it — and
 * comparing that index against the band's own paint two rows below it.
 *
 * Measured rather than derived from `GYM_DIM_STEP`, on purpose: the claim being
 * pinned is about the mark the room MAKES, and a claim derived from the map
 * would still be true if the renderer stopped calling `dimIndex` at all.
 */
function renderedCourseDeltas(spec: GymSceneSpec): readonly (number | null)[] {
  // The SHELL, because a course is a mark the WALL makes and the furniture
  // stands in front of it: on the shipped room the rack, the plate tree and the
  // dumbbell rail cover every course block in the bottom band. `props: []` is
  // the documented test hook and changes nothing about how the wall is painted.
  const g = renderGymScene({ ...spec, props: [] });
  const junction = junctionRow(spec);
  const period = GYM_WALL_PAINT.COURSE_ROWS;
  return WALL_COURSE_BANDS.map((paint) => {
    for (let y = GYM_WALL_PAINT.TRUSS_ROWS; y + period <= junction; y += 1) {
      if ((y - GYM_WALL_PAINT.TRUSS_ROWS) % period !== 0) continue;
      // A whole course block, top row plus the six rows of field under it. In a
      // block untouched by a window, the painted stripe, the kickplate or a lamp
      // wash there are at most two indices in it: the band's own paint, and the
      // course/joint mark cut into it.
      const tally = new Map<number, number>();
      const courseRow = new Set<number>();
      for (let dy = 0; dy < period; dy += 1) {
        for (let x = 0; x < spec.w; x += 1) {
          const v = getPx(g, x, y + dy);
          tally.set(v, (tally.get(v) ?? 0) + 1);
          if (dy === 0) courseRow.add(v);
        }
      }
      if (tally.size > 2 || courseRow.size !== 1) continue;
      const field = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const [mark] = [...courseRow];
      if (field !== paint || field === undefined || mark === undefined) continue;
      return (lumaOfIndex(field) ?? 0) - (lumaOfIndex(mark) ?? 0);
    }
    return null;
  });
}

describe('the room own softest mark is what the ruler says it is', () => {
  /**
   * The exact numbers, to two decimal places, straight off the palette. A
   * comment in `gymTuning.ts` quoted "about 10 luma" for a year and the renderer
   * drew none of these; that comment is now the arithmetic and this is the pin
   * under it.
   */
  const EXPECTED = [0, 15.09, 8.89] as const;

  it('draws three block courses, at 0.00 / 15.09 / 8.89 luma', () => {
    const deltas = wallCourseDeltas();
    expect(deltas.length).toBe(EXPECTED.length);
    deltas.forEach((d, i) => expect(d, `band ${i}`).toBeCloseTo(EXPECTED[i] ?? 0, 2));
  });

  it('and the RENDERED wall agrees with the palette, band for band', () => {
    // The map could say anything; this is what the pixels do.
    const drawn = renderedCourseDeltas(SPEC);
    expect(drawn.length).toBe(EXPECTED.length);
    drawn.forEach((d, i) => {
      expect(d, `band ${i} has no clean course row`).not.toBeNull();
      expect(d ?? -1, `band ${i}`).toBeCloseTo(EXPECTED[i] ?? 0, 2);
    });
  });

  it('THE TOP OF THE WALL IS FLAT, and that is the decision, not an accident', () => {
    // `WALL_DEEP` is the bottom rung of the ramp and nothing in the GYM_WALL
    // bank is under it, so a course drawn there is a course drawn in the band's
    // own colour. Pinned, with the bank's fullness as the reason it stays.
    expect(dimIndex(GYM.WALL_DEEP)).toBe(GYM.WALL_DEEP);
    expect(dimDelta(GYM.WALL_DEEP)).toBe(0);
    const wallLumas = [...Array(BANK_SIZE).keys()]
      .map((slot) => lumaOfIndex(GYM.WALL_DEEP - 1 + slot))
      .filter((v): v is number => v !== undefined);
    expect(Math.min(...wallLumas)).toBe(lumaOfIndex(GYM.WALL_DEEP));
    // ...and the flat region is a real fraction of the wall, not a rounding.
    expect(GYM_WALL_PAINT.BAND_FRACS[0]).toBeGreaterThan(0.3);
  });

  it('MUTATION: the pins move when the renderer dim map moves', () => {
    // The check that could not fail if the thing it names were broken, made to
    // fail. `wallCourseDeltas` takes the map so a mutated copy can be handed to
    // it; the shipped call passes nothing.
    const mutated = { ...GYM_DIM_STEP, [GYM.WALL_MID]: GYM.WALL_DEEP };
    // Assert the mutation applied before trusting what it says.
    expect(mutated[GYM.WALL_MID]).not.toBe(GYM_DIM_STEP[GYM.WALL_MID]);
    const after = wallCourseDeltas(mutated);
    expect(after[2]).toBeCloseTo(23.97, 2);
    expect(after[2]).not.toBeCloseTo(EXPECTED[2], 2);
    // ...and the top band's zero is not a constant either: give WALL_DEEP a rung
    // and it stops being zero.
    const lit = { ...GYM_DIM_STEP, [GYM.WALL_DEEP]: GYM.CROWD_DARK };
    expect(wallCourseDeltas(lit)[0]).not.toBe(0);
  });

  it('brackets EDGE_LUMA_DELTA between two marks the room really makes', () => {
    // The claim in `gymTuning.ts`: 20 sits above the loudest course the wall
    // draws and below a steel prop standing against the band the figure is drawn
    // against. Both halves, off the palette.
    const loudestCourse = Math.max(...wallCourseDeltas());
    const steelOnWall = (lumaOfIndex(GYM.STEEL_FRAME) ?? 0) - (lumaOfIndex(GYM.WALL_MID) ?? 0);
    expect(loudestCourse).toBeCloseTo(15.09, 2);
    expect(steelOnWall).toBeCloseTo(23.2, 2);
    expect(loudestCourse).toBeLessThan(GYM_READABILITY.EDGE_LUMA_DELTA);
    expect(steelOnWall).toBeGreaterThan(GYM_READABILITY.EDGE_LUMA_DELTA);
  });

  it('keeps the two derived thresholds derived, not re-typed', () => {
    expect(GYM_READABILITY.PERCEPTIBLE_LUMA_STEP).toBe(GYM_READABILITY.EDGE_LUMA_DELTA / 2);
    expect(GYM_READABILITY.DEAD_CONTACT_LUMA).toBe(GYM_READABILITY.EDGE_LUMA_DELTA / 4);
  });

  it('SAYS WHAT THE ANCHOR WOULD HAVE TO BE FOR A SHIPPED FRAME TO FAIL', () => {
    // The headroom, computed rather than asserted, because the two thinnest
    // margins in this file are margins against a convention and the next person
    // to turn it should learn the cost before they turn it.
    //
    // The rim floors are `PERCEPTIBLE_LUMA_STEP` (= anchor/2) and
    // `EDGE_LUMA_DELTA` (= anchor). So for each frame:
    //   p05 fails once anchor/2 > p05, i.e. anchor > 2 * p05
    //   p25 fails once anchor   > p25
    const frames: [string, IndexGrid][] = [
      ...MOMENTS.map(([name, frac]): [string, IndexGrid] => [name, composite(frac)]),
      ['meet', composite(0, MEET_SPEC)],
    ];
    let firstFail = Number.POSITIVE_INFINITY;
    const rows: string[] = [];
    for (const [name, grid] of frames) {
      const r = measureSceneReadability(grid, { occluders: OCCLUDERS });
      const byP05 = 2 * Math.min(r.rimContrast.p05, r.rimFill.p05);
      const byP25 = r.rimContrast.p25;
      firstFail = Math.min(firstFail, byP05, byP25);
      rows.push(`${name}: p05 ${r.rimContrast.p05.toFixed(2)} p25 ${r.rimContrast.p25.toFixed(2)}`);
    }
    // The whole suite has this much room above the anchor, and no more.
    expect(firstFail, rows.join('\n')).toBeCloseTo(22.15, 2);
    expect(GYM_READABILITY.EDGE_LUMA_DELTA).toBeLessThan(firstFail);
    expect(firstFail - GYM_READABILITY.EDGE_LUMA_DELTA).toBeLessThan(3);

    // ...and the specific claim in `gymTuning.ts`: had the anchor been the
    // wall's real loudest course rather than half the hard-edge step, the meet
    // frame and the descent frame would fail RIM_P05 outright.
    const loudestCourse = Math.max(...wallCourseDeltas());
    for (const [name, grid] of frames) {
      const r = measureSceneReadability(grid, { occluders: OCCLUDERS });
      if (name === 'standing') expect(r.rimContrast.p05).toBeGreaterThan(loudestCourse);
      else expect(r.rimContrast.p05, `${name} would survive a ${loudestCourse} anchor`).toBeLessThan(
        loudestCourse,
      );
    }
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
// ...AND SO IS THE FURNITURE, WHERE THE ROOM CAN AFFORD IT
// ---------------------------------------------------------------------------

describe('the furniture is grounded too', () => {
  /**
   * Every cell a prop's contact shadow is drawn into, MINUS the cells some other
   * prop's own drawing then lands on. A near prop overlapping a further one's
   * shadow rows is a legal composition, and a pixel of bumper plate is not a
   * shadow to be judged as one.
   */
  function shadowCells(spec: GymSceneSpec): readonly (readonly [number, number])[] {
    const covered = new Set<number>();
    for (const placement of sceneProps(spec)) {
      const art = PROP_ART[placement.ART];
      const origin = propOrigin(spec, art, placement);
      for (const [rx, ry, rw, rh] of art.RECTS) {
        for (let y = origin.y + ry; y < origin.y + ry + rh; y += 1) {
          for (let x = origin.x + rx; x < origin.x + rx + rw; x += 1) covered.add(y * spec.w + x);
        }
      }
    }
    const out: [number, number][] = [];
    for (const placement of sceneProps(spec)) {
      const art = PROP_ART[placement.ART];
      if (art.ANCHOR !== 'floor') continue;
      const origin = propOrigin(spec, art, placement);
      for (const [a, b] of propFootprint(art)) {
        for (let dy = 0; dy < GYM_CONTACT_SHADOW.PROP_ROWS; dy += 1) {
          for (let x = origin.x + a; x <= origin.x + b; x += 1) {
            const y = origin.y + art.H + dy;
            if (x < 0 || y < 0 || x >= spec.w || y >= spec.h) continue;
            if (covered.has(y * spec.w + x)) continue;
            out.push([x, y]);
          }
        }
      }
    }
    return out;
  }

  it('reads the footprint off the drawing, so nothing has to declare one', () => {
    // A plate tree's shadow is its base plate, not its 15px box; a kettlebell
    // row throws three shadows because it is three kettlebells.
    expect(propFootprint(PROP_ART.PLATE_TREE)).toEqual([[2, 12]]);
    expect(propFootprint(PROP_ART.KETTLEBELL_ROW).length).toBe(3);
    expect(propFootprint(PROP_ART.POWER_RACK)).toEqual([
      [0, 8],
      [23, 31],
    ]);
    // ...and every floor prop in the catalogue has one, so none is standing on
    // nothing by accident.
    for (const kind of GYM_PROP_KINDS) {
      const art = PROP_ART[kind];
      if (art.ANCHOR !== 'floor') continue;
      expect(propFootprint(art).length, `${kind} touches the floor nowhere`).toBeGreaterThan(0);
    }
    expect(propFootprint(PROP_ART.CEILING_LAMP).length).toBeGreaterThan(0);
    expect(propShadowRows(PROP_ART.CEILING_LAMP)).toBe(0);
  });

  it('DARKENS THE PLATFORM UNDER THE PROPS STANDING ON IT', () => {
    // The defect this closes: the grounding fix reached the lifter and not the
    // room, so the rack feet, bench legs, plate-tree base, chalk stand and
    // kettlebells all met the floor with nothing under them.
    const room = renderGymScene(SPEC);
    let darkened = 0;
    for (const [x, y] of shadowCells(SPEC)) {
      const here = lumaOfIndex(getPx(room, x, y)) ?? 0;
      // Two rows above the base is the surface the shadow would have been on.
      const clean = lumaOfIndex(getPx(room, x, y - GYM_CONTACT_SHADOW.PROP_ROWS - 1)) ?? 0;
      if (here < clean - GYM_READABILITY.PERCEPTIBLE_LUMA_STEP) darkened += 1;
    }
    expect(darkened, 'no prop casts a shadow at all').toBeGreaterThan(20);
  });

  it('never draws a shadow it has itself called invisible, or one the subject hides in', () => {
    // The two rules, checked on the pixels. Every shadow cell either equals the
    // untouched surface (no shadow drawn) or is at least PERCEPTIBLE_LUMA_STEP
    // under it AND at least PERCEPTIBLE_LUMA_STEP over the darkest step the
    // figure and the barbell are drawn in.
    const room = renderGymScene(SPEC);
    const keyline = Math.min(lumaOfIndex(PAL.EQ_OUTLINE) ?? 0, lumaOfIndex(PAL.OUTLINE) ?? 0);
    const bare = renderGymScene({ ...SPEC, props: [] });
    for (const [x, y] of shadowCells(SPEC)) {
      const here = getPx(room, x, y);
      const under = getPx(bare, x, y);
      if (here === under) continue;
      const drop = (lumaOfIndex(under) ?? 0) - (lumaOfIndex(here) ?? 0);
      expect(drop, `invisible shadow at (${x},${y})`).toBeGreaterThanOrEqual(
        GYM_READABILITY.PERCEPTIBLE_LUMA_STEP,
      );
      expect(
        (lumaOfIndex(here) ?? 0) - keyline,
        `shadow at (${x},${y}) is in the subject own keyline band`,
      ).toBeGreaterThanOrEqual(GYM_READABILITY.PERCEPTIBLE_LUMA_STEP);
    }
  });

  it('REFUSES to shade the rubber, and the refusal is what keeps a bound passing', () => {
    // THE MEASURED REASON, kept as a test rather than only as a comment. The
    // floor ramp has two rungs under FLOOR_MID. FLOOR_DARK is 8.9 below it —
    // under the perceptible step. FLOOR_DEEP is 17.00 below it and 8.00 ABOVE the
    // barbell's keyline — inside the band the discs' own outline occupies, and
    // the sleeves cross those rows at every depth of the rep.
    const keyline = lumaOfIndex(PAL.EQ_OUTLINE) ?? 0;
    const mid = lumaOfIndex(GYM.FLOOR_MID) ?? 0;
    expect(mid - (lumaOfIndex(GYM.FLOOR_DARK) ?? 0)).toBeCloseTo(8.89, 2);
    expect(mid - (lumaOfIndex(GYM.FLOOR_DEEP) ?? 0)).toBeCloseTo(17.0, 1);
    expect((lumaOfIndex(GYM.FLOOR_DEEP) ?? 0) - keyline).toBeLessThan(
      GYM_READABILITY.PERCEPTIBLE_LUMA_STEP,
    );
    // ...and there is no third option: nothing in the GYM_FLOOR bank sits in the
    // window that would satisfy both rules.
    const lo = keyline + GYM_READABILITY.PERCEPTIBLE_LUMA_STEP;
    const hi = mid - GYM_READABILITY.PERCEPTIBLE_LUMA_STEP;
    const inWindow = [...Array(BANK_SIZE).keys()]
      .map((slot) => lumaOfIndex(GYM.FLOOR_DEEP - 1 + slot))
      .filter((v): v is number => v !== undefined)
      .filter((v) => v >= lo && v <= hi);
    expect(inWindow, `${lo.toFixed(2)}..${hi.toFixed(2)} is not empty`).toEqual([]);

    // So the rubber rows are untouched, and every prop standing only on rubber
    // still meets the floor with nothing under it. Stated, not hidden.
    const room = renderGymScene(SPEC);
    const bare = renderGymScene({ ...SPEC, props: [] });
    let onRubber = 0;
    for (const [x, y] of shadowCells(SPEC)) {
      if (!GYM_RAMPS.FLOOR.includes(getPx(bare, x, y))) continue;
      onRubber += 1;
      expect(getPx(room, x, y), `rubber shaded at (${x},${y})`).toBe(getPx(bare, x, y));
    }
    expect(onRubber, 'no prop stands on rubber at all').toBeGreaterThan(50);
  });

  it('MUTATION: turning the cap off changes the room, and the numbers say where', () => {
    // The check that could not fail if the mechanism were broken, made to fail.
    // The shadows really are pixels: with the prop table emptied the same cells
    // are the plain floor, and the two renders differ by exactly the cells the
    // footprints name.
    const room = renderGymScene(SPEC);
    const bare = renderGymScene({ ...SPEC, props: [] });
    let changed = 0;
    for (const [x, y] of shadowCells(SPEC)) if (getPx(room, x, y) !== getPx(bare, x, y)) changed += 1;
    expect(changed).toBeGreaterThan(20);
    // ...and the shadowed room still passes every bound, which is the half that
    // was NOT true of the version that shaded the rubber: that one took the
    // descent frame's rimContrast.p25 from 22.15 to 20.19 with one row and to
    // 19.37 with two, against a floor of 20.
    for (const [name, frac] of MOMENTS) {
      const grid = composite(frac);
      expect(violations(grid), `${name}:\n${report(grid)}`).toEqual([]);
    }
    expect(
      measureSceneReadability(composite(0.25), { occluders: OCCLUDERS }).rimContrast.p25,
    ).toBeCloseTo(22.15, 2);
  });

  it('keeps the shadow inside the reserved hole rule it is drawn under', () => {
    // `propBox` counts the shadow rows, so the "nothing stands where the figure
    // stands" check sees them. Without this a shadow could be the one part of a
    // prop that reaches into the band.
    const band = clearBand(SPEC, RESOLUTION.LIFTER_HEIGHT_PX);
    for (const placement of GYM_PROPS_TRAINING) {
      const art = PROP_ART[placement.ART];
      const box = propBox(SPEC, placement);
      expect(box.y1 - (propOrigin(SPEC, art, placement).y + art.H - 1)).toBe(propShadowRows(art));
      expect(rectsOverlap(box, band), `${placement.ART} shadow overlaps the clear band`).toBe(false);
    }
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
    // ...and 32% of it is an upright, which is not furniture, it is noise.
    expect(bad.some((v) => v.startsWith('FURNITURE_SHARE_HIGH'))).toBe(true);
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

  // -------------------------------------------------------------------------
  // THE THREE CEILINGS THAT HAD NOTHING BEHIND THEM
  // -------------------------------------------------------------------------
  //
  // `CONTENT_PEAK_MAX`, `INDEX_COUNT_MAX` and `BRIGHT_SHARE_MAX` were in this
  // file with no plant that could fail them — the shipped room's worst peak is
  // 0.239 against a ceiling of 0.35, it spends 27 of a 36-index space against a
  // cap of 34, and 0.086% of it clears luma 160 against a cap of 1%. A ceiling
  // that nothing in the run can reach is a claim, not a check. These three are
  // the rooms that reach them.

  it('A ROOM WHOSE CONTENT IS ALL IN ONE CELL fails the peak ceiling', () => {
    // The shell — which has real content, a light source and a legal edge share
    // — with a stand of uprights inside ONE cell of the 4x3 grid. Placed in the
    // top-middle cell, which straddles the figure's own centre column and sits
    // above his crown, so the balance stays near zero and the behind-the-figure
    // share does not move: composition is the only thing wrong with this room,
    // and it is the peak rather than the balance that says so.
    const cellW = Math.floor(SPEC.w / GYM_READABILITY.COMPOSITION_COLS);
    const cellH = Math.floor(SPEC.h / GYM_READABILITY.COMPOSITION_ROWS);
    const grid = planted((g) => {
      g.data.set(renderGymScene({ ...SPEC, props: [] }).data);
      for (let y = 0; y < cellH; y += 1) {
        for (let x = cellW; x < cellW * 2; x += 6) setPx(g, x, y, GYM.STEEL_FRAME);
      }
    });
    // It also fails `FILLED_CELLS`, and that is INHERITED rather than smudged:
    // its base is the bare shell, which fails that bound on its own two tests
    // above. Both are pinned exactly, so this plant cannot quietly start failing
    // a third thing and still look like a peak plant.
    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('CONTENT_PEAK_HIGH')), bad.join(' ')).toBe(true);
    expect(bad.map((v) => v.split('(')[0]).sort()).toEqual(['CONTENT_PEAK_HIGH', 'FILLED_CELLS_LOW']);
    const r = measureSceneReadability(grid, { occluders: OCCLUDERS });
    expect(r.contentPeak).toBeGreaterThan(BOUNDS.CONTENT_PEAK_MAX);
    // ...and the shipped room is nowhere near it, which is the other bracket.
    expect(
      measureSceneReadability(composite(0), { occluders: OCCLUDERS }).contentPeak,
    ).toBeLessThan(BOUNDS.CONTENT_PEAK_MAX);
  });

  it('A ROOM REACHING FOR COLOURS IT DOES NOT NEED fails the index ceiling', () => {
    // The failure the cap names, and the reason it is 34 rather than 100: the
    // background index space is 36 — the STAGE bank plus the two gym banks — so
    // a room spending nearly all of it has no palette discipline at all.
    //
    // The shipped room with a two-pixel patch of every background colour it does
    // NOT already use. Small on purpose: this is the plant for the INDEX cap, so
    // it has to move the index count and as little else as possible.
    const every: number[] = [];
    for (let i = 0; i < SCENE_INDEX_COUNT; i += 1) {
      if (sceneColorAt(i) !== undefined && roleOf(i) === 'background') every.push(i);
    }
    expect(every.length).toBe(36);
    const room = renderGymScene(SPEC);
    const used = new Set<number>(room.data);
    const spare = every.filter((i) => !used.has(i));
    // The plant's SIZE is the artifact's, not the bound's: it is every colour
    // the shipped room leaves on the shelf, nine of them, and it would be the
    // same nine whatever the ceiling said. What the bound is allowed to decide
    // is only whether it is reachable at all — if it were ever raised above the
    // index space, this is the line that says the cap has stopped meaning
    // anything rather than the plant quietly growing to meet it.
    expect(spare.length).toBe(9);
    expect(used.size + spare.length).toBe(every.length);
    expect(every.length).toBeGreaterThan(BOUNDS.INDEX_COUNT_MAX);
    const grid = planted((g) => {
      g.data.set(room.data);
      spare.forEach((index, n) => {
        for (let dy = 0; dy < 2; dy += 1) {
          for (let dx = 0; dx < 2; dx += 1) setPx(g, n * 3 + dx, dy, index);
        }
      });
    });
    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('INDEX_COUNT_HIGH')), bad.join(' ')).toBe(true);
    expect(bad.every((v) => v.startsWith('INDEX_COUNT')), `also fired: ${bad.join(' ')}`).toBe(true);
    const r = measureSceneReadability(grid, { occluders: OCCLUDERS });
    expect(r.backgroundIndexCount).toBeGreaterThan(BOUNDS.INDEX_COUNT_MAX);
    expect(r.backgroundIndexCount).toBeLessThanOrEqual(every.length);
  });

  it('A ROOM LIT BY A WALL OF FILAMENTS fails the bright-share ceiling', () => {
    // `LAMP_CORE` (195) is the only index in either gym bank over luma 160, and
    // it is allowed to be bright because it is small: three lamps, seven pixels
    // each. The ceiling says how small. This is the room that says it out loud —
    // the same filament, spread across the ceiling instead of hung from it.
    //
    // It also trips `P90_LUMA_HIGH`, and that is not a smudged plant: a wall of
    // filaments IS a brighter wall at the ninetieth percentile. What matters is
    // that it trips none of the busyness, furniture, composition or rim bounds,
    // so the bright share is the one doing the work here.
    const room = renderGymScene(SPEC);
    // 355 px — 2.2% of the visible background, and a fixed number rather than a
    // multiple of the ceiling, so raising the ceiling makes this plant FAIL
    // instead of growing to meet it. For scale: the shipped room's three lamps
    // carry 21 filament pixels between them — 0.13% of the visible background,
    // against this plant's 2.2%.
    const FILAMENT_PX = 355;
    const grid = planted((g) => {
      g.data.set(room.data);
      for (let i = 0; i < FILAMENT_PX; i += 1) {
        setPx(g, i % g.w, GYM_LIGHTING.LAMP_ROW + Math.floor(i / g.w), GYM.LAMP_CORE);
      }
    });
    const bad = violations(grid);
    expect(bad.some((v) => v.startsWith('BRIGHT_SHARE_HIGH')), bad.join(' ')).toBe(true);
    for (const quiet of [
      'INDEX_COUNT',
      'MEAN_LUMA',
      'EDGE_SHARE',
      'BEHIND_EDGE_SHARE',
      'FURNITURE_SHARE',
      'FILLED_CELLS',
      'CONTENT_BALANCE',
      'CONTENT_PEAK',
      'RIM_',
    ]) {
      expect(bad.some((v) => v.startsWith(quiet)), `${quiet} also fired: ${bad.join(' ')}`).toBe(
        false,
      );
    }
    const r = measureSceneReadability(grid, { occluders: OCCLUDERS });
    expect(r.backgroundBrightShare).toBeGreaterThan(BOUNDS.BRIGHT_SHARE_MAX);
    // ...and the shipped room is under it by more than an order of magnitude,
    // which is the fact the cap is protecting rather than a coincidence.
    expect(
      measureSceneReadability(composite(0), { occluders: OCCLUDERS }).backgroundBrightShare,
    ).toBeLessThan(BOUNDS.BRIGHT_SHARE_MAX / 10);
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
    // The size of the list, PINNED rather than lower-bounded, because a report
    // that says "68 names" about a 59-name list is the same defect as a comment
    // that says "10 luma" about a 0-luma mark. Fifty-nine: thirteen federations
    // and meet organisations, eighteen bar / plate / rack makers, ten apparel,
    // belt and shoe brands, six gym chains, twelve lifters and programmes.
    expect(GYM_LAYER_FILES.length).toBe(6);
    expect(REAL_IDENTITIES.length).toBe(59);
    expect(new Set(REAL_IDENTITIES).size).toBe(REAL_IDENTITIES.length);
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

// ---------------------------------------------------------------------------
// THE COVERAGE LEDGER — RUN LAST, DELIBERATELY
// ---------------------------------------------------------------------------

describe('what this file can and cannot make fail', () => {
  /**
   * Three floors have no room in this file that trips them, and they are named
   * rather than covered by a header sentence.
   *
   *   RIM_P25_MIN, RIM_P50_MIN — every plant that drives the quarter or the
   *     median of the rim distribution down drives its fifth percentile down
   *     first, so `RIM_P05_LOW` is what fires and these two never do. A
   *     distribution with a healthy p05 and a broken p25 is constructible in
   *     principle; no ROOM built out of this palette produces one, and inventing
   *     a synthetic luma histogram to trip them would be measuring the checker
   *     rather than the art.
   *
   * Both are REPORTED on every frame and would catch a regression on the shipped
   * room. What they do not have is a plant, and this says so.
   *
   * ---------------------------------------------------------------------------
   * ONE NAME LEFT THIS LIST, AND THE REASON IT WAS ON IT WAS WRONG
   * ---------------------------------------------------------------------------
   * `FIGURE_OVER_ROOM_P90_MIN` was declared unplanted here, on the grounds that
   * "the figure's own p90 is 174.9, so this fires only once the background's p90
   * passes 114.9 — the room would have to be a wall of filaments". That was an
   * argument about the LAMPS, and it never considered the crowd: the seating is
   * 3,120 of the room's 22,490 pixels, and repainting it in the room's brightest
   * paint takes the background's p90 to 136.2 on its own. The plant is
   * `it('WOULD catch a crowd that out-values the lifter')`, and it exists
   * because the risen hall was brought into this file at all.
   */
  const UNPLANTED = ['RIM_P25_MIN', 'RIM_P50_MIN'] as const;

  it('accounts for every bound in BOUNDS, as planted or as declared unplanted', () => {
    // A new bound cannot arrive without landing in one of the two lists.
    const twoSided = ['INDEX_COUNT', 'MEAN_LUMA', 'P90_LUMA', 'EDGE_SHARE'];
    for (const name of twoSided) {
      expect(FIRED_BOUNDS.has(`${name}_LOW`), `${name} has no low plant`).toBe(true);
      expect(FIRED_BOUNDS.has(`${name}_HIGH`), `${name} has no high plant`).toBe(true);
    }
    const accountedFor = new Set<string>(UNPLANTED);
    for (const key of Object.keys(BOUNDS)) {
      if (accountedFor.has(key)) continue;
      const base = key.replace(/_(MIN|MAX)$/, '');
      const side = key.endsWith('_MIN') ? 'LOW' : 'HIGH';
      expect(FIRED_BOUNDS.has(`${base}_${side}`), `${key} has no plant and is not declared`).toBe(
        true,
      );
    }
  });

  it('has actually run the plants — a filtered run is not a coverage run', () => {
    expect(MEASURED_GRIDS).toBeGreaterThan(20);
    expect(FIRED_BOUNDS.size).toBeGreaterThan(15);
  });

  it('has NOT quietly acquired a plant for the three it says it lacks', () => {
    // The other direction. If one of these ever does get a plant, this goes red
    // and the list above shrinks by hand, which is the point.
    for (const key of UNPLANTED) {
      const base = key.replace(/_(MIN|MAX)$/, '');
      const side = key.endsWith('_MIN') ? 'LOW' : 'HIGH';
      expect(FIRED_BOUNDS.has(`${base}_${side}`), `${key} is planted now — update the list`).toBe(
        false,
      );
    }
  });
});
