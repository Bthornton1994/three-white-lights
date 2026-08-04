/**
 * THE WALK-OUT MOVES, AND THE HALL KNOWS WHICH ATTEMPT IT IS.
 *
 * ===========================================================================
 * WHAT THIS FILE IS FOR, AND THE MEASUREMENT THAT PUT IT HERE
 * ===========================================================================
 * The previous pass staged meet day in a real building and got that right. It
 * also shipped a beat named "walk-out" with no walk-out in it. Diffing the two
 * captured frames:
 *
 *     walkout.png (opener, 207.5 kg) vs walkout-third.png (third, nothing banked)
 *     differing pixels:                 22,467 of 1,316,640  = 1.71%
 *     row span of every difference:     y 204 to 439  — the copy block
 *     differing pixels below y=640:     0
 *
 * Zero. Below the text the two frames were byte-identical, and they stayed
 * identical for the whole beat: `MeetHallView` drew one memoised still of
 * `buildSquatRep(loadRatio).frames[0]` and held it. Every channel by which a
 * third attempt escalated — the longer hold, `CROWD_SWELL_BIG`,
 * `WALKOUT_CALL_URGENT` — was in sound or haptics, the two channels nobody in
 * this environment can verify.
 *
 * ===========================================================================
 * SO EVERY CLAIM HERE IS MEASURED ON RENDERED PIXELS
 * ===========================================================================
 * `hallAt` below composites the walk-out exactly the way `MeetHallView` does —
 * `renderGymScene(hallScene(rise))`, then the sprite blitted at
 * `SPRITE_X + bodyDxPx` — and the geometry that makes those two the same
 * composite is asserted rather than assumed (see "the composite this file
 * measures is the composite the screen draws").
 *
 * WHAT IT CANNOT SEE, said plainly: this suite runs in a node environment with
 * no renderer, so it cannot mount `WalkoutView` and watch `useHallStep` advance.
 * It measures the SHEET on real pixels and it guards the WIRING through
 * `meetStage.test.ts`'s source parser. The one instrument that can watch the
 * component's clock run is `tools/capture-meet.mjs`, which photographs the live
 * walk-out at two instants and fails if the hall is the same picture in both.
 *
 * PACING IS STILL UNVERIFIABLE HERE (GDD §12.1, §12.2). Nothing below says the
 * walk-out feels like a walk-out; it says the picture changes, that it changes
 * in the places the design claims, and that it stops changing when it should.
 */

import { describe, expect, it } from 'vitest';

import {
  blitOver,
  crowdFrontRow,
  crowdRowRise,
  crowdTierCount,
  renderGymScene,
  type GymSceneSpec,
} from '../art/gymScene';
import { GYM } from '../art/gymPalette';
import { GYM_CROWD, GYM_LIFT_STAGE, GYM_VENUE } from '../art/gymTuning';
import { renderLifterFrame } from '../art/lifterSprite';
import { BAR_AND_COLLARS_KG, layoutSleeve, visualPlateStack } from '../art/plates';
import { fillRect, type IndexGrid } from '../art/raster';
import { LOAD_PRESETS, QUANTISE, RESOLUTION, STRAIN } from '../art/spriteTuning';
import { LIFT_TUNING } from '../game/liftTuning';
import { meetLoadingRules } from '../game/meet';
import { walkoutMs } from '../game/meetDay';
import { holdWalkoutAtMs, MEET_MOMENTS, previewStateFor } from '../game/meetPreview';
import { MEET_PREVIEW, MEET_TUNING } from '../game/meetTuning';
import { SPRITE_BOX } from '../lift/liftFrame';
import { hallLifterFrame, hallPlateCount, hallScene, MEET_HALL_SCENE } from './meetHall';
import {
  barLoadMs,
  buildWalkout,
  CHEER_CROWD_RISE,
  crowdRisePxAt,
  WALKOUT_CROWD_RISE,
  WALKOUT_STAGES,
  walkoutFrameAt,
  walkoutFrameIndexAt,
  walkoutLifterFrame,
  walkoutMotionMs,
  walkoutStageAt,
  walkoutStageStartMs,
  type WalkoutFrame,
} from './walkout';

/** A heavy competition squat, so the sleeve is long and the strain is real. */
const HEAVY_KG = 240;
const LOAD = LOAD_PRESETS.MAXIMAL;
const PLATES = hallPlateCount(HEAVY_KG, BAR_AND_COLLARS_KG);

const URGENT = buildWalkout({ loadRatio: LOAD, plateCount: PLATES, urgent: true });
const ORDINARY = buildWalkout({ loadRatio: LOAD, plateCount: PLATES, urgent: false });
const AT = walkoutStageStartMs(PLATES);

// ---------------------------------------------------------------------------
// The instrument
// ---------------------------------------------------------------------------

/**
 * The hall as the screen composites it, at one instant of the beat.
 *
 * A fresh room every call, because `blitOver` writes into its base.
 *
 * The BAR IS DRAWN FULLY LOADED. `MeetHallView` draws a bare frame under a
 * clipped loaded one only while the discs are landing, which is the `LOAD`
 * stage and `meetHall.test.ts`'s subject; every instant this file compares is
 * after the last plate, where the clip covers the whole cell and the composite
 * is exactly the loaded drawing.
 */
function hallAt(frame: WalkoutFrame | null): IndexGrid {
  const scene = renderGymScene(hallScene(frame?.crowdRisePx ?? 0));
  const spec =
    frame === null
      ? hallLifterFrame(LOAD, HEAVY_KG, BAR_AND_COLLARS_KG)
      : walkoutLifterFrame(frame, HEAVY_KG, BAR_AND_COLLARS_KG);
  const { grid } = renderLifterFrame(spec);
  return blitOver(
    scene,
    grid,
    GYM_LIFT_STAGE.SPRITE_X + (frame?.bodyDxPx ?? 0),
    GYM_LIFT_STAGE.SPRITE_Y,
  );
}

function hallMs(sequence: typeof URGENT, ms: number): IndexGrid {
  return hallAt(walkoutFrameAt(sequence, ms));
}

function differingPixels(a: IndexGrid, b: IndexGrid): number {
  expect(a.data.length, 'the two composites are not the same box').toBe(b.data.length);
  let n = 0;
  for (let i = 0; i < a.data.length; i += 1) if (a.data[i] !== b.data[i]) n += 1;
  return n;
}

/** Every differing pixel's row, as a span. `null` when the two are identical. */
function differingRows(a: IndexGrid, b: IndexGrid): { top: number; bottom: number } | null {
  let top = a.h;
  let bottom = -1;
  for (let y = 0; y < a.h; y += 1) {
    for (let x = 0; x < a.w; x += 1) {
      const i = y * a.w + x;
      if (a.data[i] === b.data[i]) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return bottom < 0 ? null : { top, bottom };
}

/** Pixels of seating, both values of the crowd ramp. */
function crowdPixels(grid: IndexGrid): number {
  let n = 0;
  for (const v of grid.data) if (v === GYM.CROWD_DARK || v === GYM.CROWD_MID) n += 1;
  return n;
}

// ---------------------------------------------------------------------------
// THE INSTRUMENT FOR "IS THIS STILL A CROWD" — air BETWEEN spectators
// ---------------------------------------------------------------------------

/** The rows the seating band occupies, top inclusive, bottom exclusive. */
const BAND_BOTTOM = crowdFrontRow(MEET_HALL_SCENE);
const BAND_TOP = Math.max(0, BAND_BOTTOM - GYM_VENUE[MEET_HALL_SCENE.venue].CROWD_ROWS);

/**
 * THE HALL WITH NOBODY ON THEIR FEET, rendered once.
 *
 * Every rise measured below is a DIFFERENCE from this picture, so "a hall that
 * did not move measures zero" is a property of how the reading is defined
 * rather than a claim about it.
 */
const REST_BAND = renderGymScene(MEET_HALL_SCENE);

/**
 * The rise the BEAT asks the hall for when it settles, and the one a good lift
 * asks for at the end of its ramp.
 *
 * Read out of the sequence and out of the ramp rather than copied from
 * `MEET_TUNING.CROWD`, so that severing the wire — a walk-out that stops asking
 * the hall to stand, a ramp that never reaches its top — reaches these
 * measurements instead of leaving them measuring a constant nobody is using.
 */
const WALKOUT_HALL_RISE = walkoutFrameAt(URGENT, URGENT.motionMs).crowdRisePx;
const CHEER_HALL_RISE = crowdRisePxAt(MEET_TUNING.CROWD.CHEER_RISE_MS, CHEER_CROWD_RISE);

/**
 * EVERY RISE THE HALL CAN BE DRAWN AT — the whole domain, not a sample of it.
 *
 * `paintCrowd` reduces `crowdRisePx` to `Math.max(0, Math.round(...))` before it
 * uses it, so the only inputs that exist are the non-negative integers, and it
 * reads that number ONLY through `crowdRowRise`, which caps every tier at
 * `ROW_RISE_MAX_PX`. The last rise that can move anybody is therefore the front
 * tier's cap plus the lag each tier behind it carries; past that the wave hands
 * `paintCrowd` the same rows forever and the room is the same room.
 *
 * That is what lets a loop over these values be titled "at every rise" and mean
 * it. Both halves — the arithmetic saturating, and the PICTURE not changing past
 * it — are asserted by `has nothing left to give past the end of this sweep`
 * rather than left as an argument in a comment.
 */
const RISE_SATURATION =
  GYM_CROWD.ROW_RISE_MAX_PX + GYM_CROWD.ROW_RISE_LAG_PX * (crowdTierCount(MEET_HALL_SCENE) - 1);
const EVERY_RISE: readonly number[] = Array.from(
  { length: RISE_SATURATION + 1 },
  (_unused, rise) => rise,
);

interface BandAir {
  /**
   * The SMALLEST share of any occupied row that is air.
   *
   * "Occupied" means the row has at least one spectator pixel in it, which is
   * what makes this a measure of the gaps between people rather than of the
   * empty rows above them. The worst row rather than the mean, because one solid
   * row through the middle of the band is exactly the failure an average hides.
   */
  readonly worstRowAir: number;
  /** How many rows have anybody in them. The non-vacuity handle. */
  readonly occupiedRows: number;
  /** Spectator pixels over all band pixels in those rows — figure vs ground. */
  readonly litShare: number;
  readonly litPx: number;
  readonly darkPx: number;
  /**
   * The SAME two counts taken the way the bound this replaced took them: every
   * crowd pixel anywhere in the frame, including the rows at the top of the band
   * that no figure grows into. Kept only so the mutation below can show that the
   * old bound passes the picture the new one fails.
   */
  readonly rectLitPx: number;
  readonly rectDarkPx: number;
  /**
   * How far each tier's heads are drawn above the row they sit on when nobody
   * has moved, back to front. Zero for every tier of a hall at rest, by the
   * definition in `tierRisesOf`.
   */
  readonly tierRises: readonly number[];
}

function sumOf(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** `BandAir` for a rendered room. Reads only the two crowd indices. */
function airOf(grid: IndexGrid): BandAir {
  let worstRowAir = 1;
  let occupiedRows = 0;
  let litPx = 0;
  let darkPx = 0;
  for (let y = BAND_TOP; y < BAND_BOTTOM; y += 1) {
    let lit = 0;
    let dark = 0;
    for (let x = 0; x < grid.w; x += 1) {
      const v = grid.data[y * grid.w + x];
      if (v === GYM.CROWD_MID) lit += 1;
      else if (v === GYM.CROWD_DARK) dark += 1;
    }
    if (lit === 0) continue;
    occupiedRows += 1;
    litPx += lit;
    darkPx += dark;
    worstRowAir = Math.min(worstRowAir, dark / (lit + dark));
  }
  let rectLitPx = 0;
  let rectDarkPx = 0;
  for (const v of grid.data) {
    if (v === GYM.CROWD_MID) rectLitPx += 1;
    else if (v === GYM.CROWD_DARK) rectDarkPx += 1;
  }
  return {
    worstRowAir: occupiedRows === 0 ? 0 : worstRowAir,
    occupiedRows,
    litShare: litPx + darkPx === 0 ? 0 : litPx / (litPx + darkPx),
    litPx,
    darkPx,
    rectLitPx,
    rectDarkPx,
    tierRises: tierRisesOf(grid),
  };
}

// ---------------------------------------------------------------------------
// THE INSTRUMENT FOR "DID THE HALL GET UP" — each tier's OWN columns, read
// against the same reading on the hall at rest
// ---------------------------------------------------------------------------

/*
 * ===========================================================================
 * WHAT THE PROBE THIS REPLACES COULD NOT SEE
 * ===========================================================================
 * It walked up from each tier line looking for "a row of that tier", and it
 * decided by counting `CROWD_MID` across the whole row against `grid.w / 2` —
 * 65 of the stage's 130 columns. On this band a HEAD row lights 55-57 columns
 * (`HEAD_W` 3 on a `HEAD_COLS` pitch of 7) and a SHOULDER row lights 90-94. So
 * the question it actually asked was "is this a shoulder row", and a head — the
 * thing that lifts when somebody stands — could never answer yes.
 *
 * Every number it returned was therefore the topmost SHOULDER row of the tier
 * BEHIND, which at rest already sits three rows above the tier line. It was a
 * fixed property of the seated drawing:
 *
 *     seated, nobody moved     [0, 3, 3, 3]   sum 9
 *     the shipped walk-out     [0, 3, 0, 6]   sum 9
 *
 * The beat this whole file exists to prove scored IDENTICALLY to a hall that
 * never moved, and the guard that named it — `some((r) => r > 0)` — passed on
 * the seated hall, so it could not fail for the reason it claimed. It was also
 * directional the wrong way: a band drawn with more shoulder overhang scored
 * higher without anybody getting up.
 *
 * ===========================================================================
 * WHAT THIS ONE MEASURES INSTEAD
 * ===========================================================================
 * The rise of a tier is how far the topmost pixel THAT TIER OWNS has moved off
 * the row it owns it on. Both halves of that are read out of the SEATED render
 * rather than derived from the constants `paintCrowd` draws with:
 *
 *   - A TIER LINE is a row of the band whose figures start there: it has
 *     spectator pixels in it and the row above it does not. On a hall at rest
 *     there is exactly one row of air between tiers, which is what makes this
 *     readable at all, and `the seated band is the drawing these measurements
 *     assume` below pins that as a picture rather than as an assumption.
 *   - A TIER'S OWN COLUMNS are the columns lit on its tier line that are lit
 *     NOWHERE in the rows between it and the tier behind. Adjacent tiers are
 *     staggered, so each keeps a couple of columns per pitch that the tier
 *     behind's widest row — its shoulders — never reaches. Standing up moves
 *     rows and never columns, so a column the tier behind cannot paint at rest
 *     is a column it cannot paint risen either.
 *   - THE BACK TIER'S WINDOW IS OFF THE BAND. It has no tier behind it, so it
 *     is looked for in the rows of wall ABOVE the seating — the same depth of
 *     window the others get. Nothing else can paint there because nothing at
 *     all is supposed to: `keeps every spectator inside the seating band`
 *     measures zero crowd pixels above the band's top row at every rise. So the
 *     back tier needs no exclusivity argument; a spectator up there is a defect
 *     whichever tier drew it. Before this, its window had NO ROWS IN IT and its
 *     reading was the constant 0 — see `tierRisesOf`.
 *
 * That gives a number no threshold has to be chosen for, and it is reported as
 * a DIFFERENCE against the same reading on `REST_BAND`, so a hall that did not
 * move reads 0 by construction rather than by luck. Back to front, on the
 * shipped band:
 *
 *     seated, nobody moved     [0, 0, 0, 0]   sum  0
 *     the walk-out's rise 5    [0, 1, 3, 4]   sum  8
 *     a good lift's rise 7     [0, 3, 4, 4]   sum 11
 *
 * The rises are `MEET_TUNING.CROWD`'s to turn and nobody has watched them on a
 * phone (GDD §12.1), so what is asserted below is the ORDER and the floor at
 * zero, not these values.
 */

/** One tier of seating, as the hall AT REST describes it. */
interface SeatedTier {
  /** Back to front: 0 is the tier furthest from the platform. */
  readonly index: number;
  /** The row this tier's heads are drawn on when nobody has moved. */
  readonly seatRow: number;
  /**
   * The highest row this tier could be seen in — one below the tier behind's
   * own seat row, so a reading can never be somebody else's spectator.
   *
   * THE BACK TIER HAS NO TIER BEHIND IT, and this used to be `BAND_TOP` for it
   * — which is its own seat row. That gave `topRowOf` a scan window with zero
   * rows in it, so the back tier's reading was the literal `0` for every
   * possible picture rather than a measurement of one. It now gets the same
   * DEPTH of window every other tier gets, carried UP OUT OF THE BAND onto the
   * wall, where `paintCrowd` draws no seating at all (`keeps every spectator
   * inside the seating band` pins that on pixels). A head that escapes the
   * band's top row therefore reads as a rise, and a reading of 0 means nobody
   * escaped rather than that there was nowhere to look.
   */
  readonly ceilingRow: number;
  /**
   * Columns this tier paints above `seatRow` and no other tier can.
   *
   * The back tier has no tier behind to exclude, so this is its whole head row
   * — and it does not need to exclude one. Its window is entirely off the band,
   * and a spectator pixel up there is a spectator drawn outside the seating
   * whichever tier drew it.
   */
  readonly ownCols: readonly number[];
}

/**
 * The top of the BACK tier's scan window: the same depth of window every other
 * tier gets, measured off the rendered pitch rather than off `GYM_CROWD`.
 *
 * A tier with one behind it can be seen in `ROW_PITCH - 1` rows — everything
 * between its seat row and the tier behind's. The back tier's are the
 * `ROW_PITCH - 1` rows above the band, which are wall.
 *
 * A ONE-TIER BAND THROWS rather than falling back. What used to stand here
 * returned `BAND_TOP` — which for a one-tier band IS the back tier's own seat
 * row, so the window came out with no rows in it and every reading taken through
 * it was the literal 0 again, which is the exact defect this function exists to
 * have fixed. It did fail loudly in the end (`keeps every spectator inside the
 * seating band` refuses `ceilingRow === seatRow` by name), but it failed one
 * test away from the readings that had quietly gone blind. Every measurement in
 * this file is taken through this window, so a band that came down to one tier
 * is a band this file's ruler cannot be built for, and it says so at import.
 */
function backTierCeiling(seatRows: readonly number[], seatRow: number): number {
  const inFront = seatRows[1];
  if (inFront === undefined) {
    throw new Error(
      'the seating band has only one tier: the back tier has no window to be measured in',
    );
  }
  return Math.max(0, seatRow - (inFront - seatRow) + 1);
}

/** The spectator columns in one row of a rendered room. */
function litColumnsAt(grid: IndexGrid, y: number): readonly number[] {
  const out: number[] = [];
  for (let x = 0; x < grid.w; x += 1) {
    if (grid.data[y * grid.w + x] === GYM.CROWD_MID) out.push(x);
  }
  return out;
}

/** The band's tiers, read off the hall at rest. See `SeatedTier`. */
function seatedTiersOf(rest: IndexGrid): readonly SeatedTier[] {
  const seatRows: number[] = [];
  for (let y = BAND_TOP; y < BAND_BOTTOM; y += 1) {
    if (litColumnsAt(rest, y).length === 0) continue;
    if (y > BAND_TOP && litColumnsAt(rest, y - 1).length > 0) continue;
    seatRows.push(y);
  }
  return seatRows.map((seatRow, index) => {
    const behind = seatRows[index - 1];
    const ceilingRow = behind === undefined ? backTierCeiling(seatRows, seatRow) : behind + 1;
    const taken = new Set<number>();
    for (let y = ceilingRow; y < seatRow; y += 1) {
      for (const x of litColumnsAt(rest, y)) taken.add(x);
    }
    return {
      index,
      seatRow,
      ceilingRow,
      ownCols: litColumnsAt(rest, seatRow).filter((x) => !taken.has(x)),
    };
  });
}

const SEATED_TIERS = seatedTiersOf(REST_BAND);

/** The highest row of `grid` this tier has anybody in. Its seat row, at rest. */
function topRowOf(grid: IndexGrid, tier: SeatedTier): number {
  for (let y = tier.ceilingRow; y < tier.seatRow; y += 1) {
    if (tier.ownCols.some((x) => grid.data[y * grid.w + x] === GYM.CROWD_MID)) return y;
  }
  return tier.seatRow;
}

/**
 * HOW MANY SPECTATOR PIXELS THIS TIER HAS IN THE PART OF THE BAND NOBODY ELSE
 * CAN PAINT: its own columns, in its scan window down to and INCLUDING its seat
 * row.
 *
 * The counterpart to `topRowOf`, and the reason both are needed: `topRowOf`
 * answers "how high", which a tier that is not drawn at all answers with a 0
 * indistinguishable from "did not move". This answers "how much", which such a
 * tier answers with nothing at all.
 *
 * WHY THE WINDOW STOPS AT THE SEAT ROW rather than running down to the next tier
 * line. Below its seat row a tier is legitimately covered by the tier in FRONT —
 * that is what the keyline is for, and it is the drawing standing up is supposed
 * to produce — so a count taken down there FALLS as the hall rises: at the
 * walk-out's rise the second tier keeps 108 of the 180 own-column pixels it has
 * at rest in those rows. Above and on its seat row nothing else reaches it. The
 * tier behind's columns are excluded from `ownCols` by construction; the tier in
 * front's rim tops out `ROW_PITCH - ROW_RISE_MAX_PX - KEYLINE_ROWS` = 1 row
 * BELOW this window's bottom. That second half is not taken on trust — anything
 * else painting in here would push the count ABOVE the equality asserted in
 * `reads its rise off a WHOLE tier, at every rise`, which is an equality and not
 * a floor precisely so that it can fail in both directions.
 */
function ownColumnPixels(grid: IndexGrid, tier: SeatedTier): number {
  let lit = 0;
  for (let y = tier.ceilingRow; y <= tier.seatRow; y += 1) {
    for (const x of tier.ownCols) {
      if (grid.data[y * grid.w + x] === GYM.CROWD_MID) lit += 1;
    }
  }
  return lit;
}

/**
 * How far each tier is drawn above where it sits at rest, back to front.
 *
 * A DIFFERENCE between two pictures, so the hall that did not move is the zero
 * of the scale. Nothing here reads `crowdRowRise`: "the hall really did stand"
 * stays a statement about pixels rather than a restatement of the arithmetic
 * that drew them.
 *
 * THE BACK TIER READS 0 AT EVERY RISE THE BEAT ASKS FOR, and that is a
 * measurement rather than a property of the probe — which is what this used to
 * get wrong. Its heads are drawn on the band's own top row and `paintCrowd`
 * clamps them there (`headTop = Math.max(top, y - rowRise)` in `gymScene.ts`),
 * so the one instant where the wave asks it for a row — the cheer, where the
 * arithmetic asks for 1 — moves nothing. That clamp is the ONE place in the
 * risen picture where the arithmetic and the pixels disagree, so it is the one
 * place the probe most needs to be able to look: the back tier's window is the
 * rows of WALL above the band, and if the clamp ever went, the head that
 * escaped would read as a rise of 1 and `agrees with the wave where the band
 * has room` would fail by name. (The docstring here used to say the back tier
 * "cannot be seen to move, and that is the picture and not the probe". Both
 * halves were true and they were true for two different reasons that happened
 * to coincide: the drawing was 0 because of the clamp, and the reading was 0
 * because its scan window had no rows in it and `topRowOf` returned its seat
 * row unconditionally.)
 *
 * WHAT THIS READING CANNOT SEE ON ITS OWN, said plainly: `topRowOf` falls back
 * to the seat row, so a tier drawn LOWER than it sits, or NOT DRAWN AT ALL,
 * reads 0 rather than negative — the same 0 a tier that simply did not move
 * gives. `reads its rise off a WHOLE tier, at every rise` is what closes that:
 * it counts this tier's own columns in the rows above and including its seat row
 * and requires exactly `rise + 1` SOLID rows of them, so a tier that vanished,
 * or slid down off its seat, owes the picture a row it cannot produce. Measured
 * before that test existed: `paintCrowd` made to skip the back tier whenever
 * `rise > 0` — an entire tier of the hall gone from every risen frame — left all
 * 2,330 tests in the tree green.
 *
 * THAT SENTENCE USED TO CITE `never lets a risen hall reach down toward the
 * lifter`, AND THAT TEST CANNOT DELIVER IT. It counts pixels that are crowd NOW
 * and were not crowd in the seated render, and `paintCrowd` fills the entire
 * band rectangle with `CROWD_DARK` before it draws anybody
 * (`fillRect(g, 0, top, spec.w, bottom - top, GYM.CROWD_DARK)`), so every pixel
 * inside the band is ALREADY crowd at rest and that predicate is unsatisfiable
 * anywhere in it. What the test can see is crowd escaping the band's BOTTOM
 * EDGE, over the rail toward the lifter — which is the claim its name makes, and
 * a different claim from this one. Two true facts joined by a reason that was
 * not the operative one.
 *
 * WHAT IS STILL NOT BOUNDED, named rather than implied, because an honest "not
 * bounded" is worth more than a citation that cannot deliver: NOTHING IN THIS
 * FILE STOPS A TIER GROWING DOWNWARD INSIDE THE BAND. Run rather than reasoned —
 * `paintCrowd` made to draw every silhouette one row deeper whenever
 * `rise > 0`, so the whole hall reaches toward the lifter as it stands, leaves
 * all 2,332 tests green. The reasons are worth writing down because they are not
 * obvious: the tiers behind the front one are legitimately eaten from below by
 * the tier in front's keyline, so there is no rest reading to hold their bottoms
 * to; and the FRONT tier's growth is invisible, because `paintCrowd` clips at
 * the band's bottom row and paints `RAIL_ROWS` of barrier over what is left.
 * `never lets a risen hall reach down toward the lifter` does now take a reading
 * inside the band at every rise, but it is a pin on the front edge's POSITION,
 * not a bound on growth — its own comment says which.
 */
function tierRisesOf(grid: IndexGrid): readonly number[] {
  return SEATED_TIERS.map((tier) => topRowOf(REST_BAND, tier) - topRowOf(grid, tier));
}

/** The shipped hall at `rise`, as air. */
function bandOf(rise: number): BandAir {
  return airOf(renderGymScene(hallScene(rise)));
}

/**
 * THE PLANT: the crowd band redrawn the way it was drawn before this pass —
 * EVERY TIER RISEN BY THE SAME AMOUNT, and no keyline around anybody.
 *
 * Painted over a freshly rendered hall rather than produced by re-rendering with
 * different constants, because `GYM_CROWD` is frozen and the mechanism is not a
 * field on `GymSceneSpec`. It is the same technique `gymScene.test.ts` uses to
 * plant `RISER_ROWS: 0`. Every number it draws with comes from `GYM_CROWD`, so
 * it is the old renderer and not a second guess at one — and `rise` 0 is
 * asserted to reproduce the shipped band exactly, which is what makes that
 * claim checkable.
 */
function uniformlyRisenBand(rise: number): IndexGrid {
  const shipped = renderGymScene(MEET_HALL_SCENE);
  const grid = renderGymScene(MEET_HALL_SCENE);
  const { HEAD_COLS, HEAD_H, HEAD_W, ROW_PITCH, ROW_STAGGER, SHOULDER_ROWS } = GYM_CROWD;
  fillRect(grid, 0, BAND_TOP, grid.w, BAND_BOTTOM - BAND_TOP, GYM.CROWD_DARK);
  let row = 0;
  for (let y = BAND_TOP; y < BAND_BOTTOM; y += ROW_PITCH) {
    const stagger = row % 2 === 0 ? 0 : ROW_STAGGER;
    for (let x = stagger - HEAD_COLS; x < grid.w; x += HEAD_COLS) {
      const headTop = Math.max(BAND_TOP, y - rise);
      const headH = Math.min(HEAD_H, Math.max(0, BAND_BOTTOM - headTop));
      fillRect(grid, x, headTop, HEAD_W, headH, GYM.CROWD_MID);
      const shoulderTop = headTop + HEAD_H;
      const seatRow = Math.min(BAND_BOTTOM, y + HEAD_H + SHOULDER_ROWS);
      fillRect(
        grid,
        x - 1,
        shoulderTop,
        HEAD_W + 2,
        Math.max(0, seatRow - shoulderTop),
        GYM.CROWD_MID,
      );
    }
    row += 1;
  }
  // Everything that stands IN FRONT of the seating goes back on top: the front
  // rail, and the four columns of the judges' table that reach into the band's
  // bottom rows. Restored from the shipped render by "was this pixel a crowd
  // colour", so the plant re-draws the crowd and nothing else — which is what
  // lets `rise` 0 be asserted byte-identical to the shipped room below.
  for (let y = BAND_TOP; y < BAND_BOTTOM; y += 1) {
    for (let x = 0; x < grid.w; x += 1) {
      const i = y * grid.w + x;
      const was = shipped.data[i];
      if (was === GYM.CROWD_MID || was === GYM.CROWD_DARK) continue;
      grid.data[i] = was ?? 0;
    }
  }
  return grid;
}

describe('the composite this file measures is the composite the screen draws', () => {
  it('places the sprite where MeetHallView places it, at the same integer scale', () => {
    // Without this, every pixel measurement below could be of a picture no
    // screen ever shows. `MeetHallView` draws the room at `ORIGIN` and scale
    // `GYM_LIFT_STAGE.SCALE`, and the sprite at `SPRITE_BOX` offset by
    // `bodyDxPx * SPRITE_SCALE` screen points — so a whole sprite pixel of body
    // travel is a whole scene pixel here only if these agree.
    const scale = GYM_LIFT_STAGE.SCALE;
    expect(LIFT_TUNING.FEEDBACK.SPRITE_SCALE).toBe(scale);
    expect(SPRITE_BOX.x).toBe(GYM_LIFT_STAGE.ORIGIN_X + GYM_LIFT_STAGE.SPRITE_X * scale);
    expect(SPRITE_BOX.y).toBe(GYM_LIFT_STAGE.ORIGIN_Y + GYM_LIFT_STAGE.SPRITE_Y * scale);
    expect(Number.isInteger(scale)).toBe(true);
  });

  it('measures a room with people in it', () => {
    // The other non-vacuity control: `hallAt` really does render the meet hall.
    expect(crowdPixels(hallAt(null))).toBeGreaterThan(0);
    expect(hallAt(null).data.length).toBe(GYM_LIFT_STAGE.W * GYM_LIFT_STAGE.H);
  });
});

// ---------------------------------------------------------------------------
// The ruler, before anything is measured with it
// ---------------------------------------------------------------------------

describe('the ruler this file reads the hall’s rise off', () => {
  /**
   * The runs of AIR between spectators in one row: columns of `CROWD_DARK`
   * with a spectator on both sides of them.
   *
   * A run has to be air the whole way across to count. The judges' table stands
   * in front of the band's bottom rows and hides a spectator or two behind it,
   * which leaves a wider hole that is furniture rather than a gap in the crowd;
   * so does the frame's own edge, which is why a run reaching column 0 is
   * dropped as well.
   */
  function interiorAirGaps(grid: IndexGrid, y: number): readonly number[] {
    const gaps: number[] = [];
    let run = 0;
    let air = true;
    for (let x = 0; x < grid.w; x += 1) {
      const value = grid.data[y * grid.w + x];
      if (value === GYM.CROWD_MID) {
        if (run > 0 && run < x && air) gaps.push(run);
        run = 0;
        air = true;
        continue;
      }
      run += 1;
      if (value !== GYM.CROWD_DARK) air = false;
    }
    return gaps;
  }

  it('is calibrated on the seated band the renderer actually drew', () => {
    // THE PIN THE KEYLINE'S OWN ARITHMETIC RESTS ON, on pixels. `GYM_CROWD`
    // argues `KEYLINE_ROWS: 1` and `KEYLINE_COLS: 2` are "the largest the
    // geometry affords WITHOUT changing the seated hall", from a spectator
    // being 5 rows in a 6-row pitch and 5 columns in a 7-column one. Both
    // halves of that are visible in the rendered band, and neither was checked
    // anywhere until now — which also made the probe below unreadable, because
    // it is the row of air that says where one tier stops and the next starts.
    expect(SEATED_TIERS.length, 'the band has no tiers in it').toBe(
      crowdTierCount(MEET_HALL_SCENE),
    );
    for (const tier of SEATED_TIERS) {
      // Every tier sits a whole pitch below the one behind it...
      const behind = SEATED_TIERS[tier.index - 1];
      if (behind !== undefined) {
        expect(tier.seatRow - behind.seatRow, `tier ${tier.index} is off the pitch`).toBe(
          GYM_CROWD.ROW_PITCH,
        );
        // ...with EXACTLY `KEYLINE_ROWS` rows of air above it: the row above
        // the seat row is empty and the row above that is the tier behind's
        // shoulders. A second rim row would eat them.
        for (let above = 1; above <= GYM_CROWD.KEYLINE_ROWS; above += 1) {
          expect(
            litColumnsAt(REST_BAND, tier.seatRow - above).length,
            `tier ${tier.index}: row ${above} above its seat is not air`,
          ).toBe(0);
        }
        expect(
          litColumnsAt(REST_BAND, tier.seatRow - GYM_CROWD.KEYLINE_ROWS - 1).length,
          `tier ${tier.index}: there is more air above it than the keyline claims`,
        ).toBeGreaterThan(0);
      }
      // And EXACTLY `KEYLINE_COLS` columns of air beside every spectator, at
      // the widest row the tier occupies — its shoulders.
      const rows: number[] = [];
      for (let y = tier.seatRow; y < BAND_BOTTOM; y += 1) {
        if (litColumnsAt(REST_BAND, y).length === 0) break;
        rows.push(y);
      }
      const widest = rows.reduce((a, b) =>
        litColumnsAt(REST_BAND, b).length > litColumnsAt(REST_BAND, a).length ? b : a,
      );
      const gaps = interiorAirGaps(REST_BAND, widest);
      expect(gaps.length, `tier ${tier.index} has no gaps between spectators`).toBeGreaterThan(0);
      for (const gap of gaps) {
        expect(gap, `tier ${tier.index}: a gap between spectators is not the keyline's width`)
          .toBe(GYM_CROWD.KEYLINE_COLS);
      }
      // ...which is what leaves this tier columns of its own to be measured in.
      expect(tier.ownCols.length, `tier ${tier.index} owns no columns`).toBeGreaterThan(0);
    }
  });

  it('reads ZERO on every tier of a hall that nobody stood up', () => {
    // The reading the probe this replaced could not produce: on the room every
    // other beat draws, it returned [0, 3, 3, 3] — the seated drawing's own
    // shoulder overhang — and the "the hall still stands up" guard passed on
    // it. This is the same room. Every tier must read nothing.
    const rest = tierRisesOf(renderGymScene(MEET_HALL_SCENE));
    expect(rest.length).toBe(SEATED_TIERS.length);
    for (const [tier, rise] of rest.entries()) {
      expect(rise, `tier ${tier} of a seated hall is drawn off its seat`).toBe(0);
    }
    // ...and it is the same zero through the path every other test takes.
    expect(bandOf(0).tierRises).toEqual(rest);
  });

  it('reads the shipped walk-out strictly higher than the hall at rest', () => {
    // THE CHECK THAT TURNS RED WHEN THE HALL STOPS GETTING UP, and it was run
    // both ways round before it was written down:
    //
    //   `hallScene(rise)` returns `MEET_HALL_SCENE` whatever it is asked for
    //     — the room never redraws. This test fails here, on `higher.length`.
    //     The guard this replaces (`some((r) => r > 0)`) stayed GREEN under it.
    //   `buildWalkout` emits `crowdRisePx: 0` on every frame — the beat stops
    //     asking. This test fails here too, because `WALKOUT_HALL_RISE` is read
    //     out of the settled frame rather than out of `MEET_TUNING`. Under that
    //     mutation the whole of `stands the crowd up without turning it into a
    //     slab` used to pass, because it measured the constant and not the beat.
    const rest = tierRisesOf(renderGymScene(MEET_HALL_SCENE));
    const walkout = tierRisesOf(renderGymScene(hallScene(WALKOUT_HALL_RISE)));
    const higher = walkout.filter((rise, tier) => rise > (rest[tier] ?? 0));
    expect(higher.length, 'the walk-out hall is drawn exactly where the seated one is')
      .toBeGreaterThan(0);
    expect(sumOf(walkout)).toBeGreaterThan(sumOf(rest));
    // The cheer goes further into the hall than the walk-out does, tier by tier
    // and not only on the total.
    const cheer = tierRisesOf(renderGymScene(hallScene(CHEER_HALL_RISE)));
    for (const [tier, rise] of cheer.entries()) {
      expect(rise, `tier ${tier} is lower on a cheer than on a walk-out`).toBeGreaterThanOrEqual(
        walkout[tier] ?? 0,
      );
    }
    expect(sumOf(cheer)).toBeGreaterThan(sumOf(walkout));
  });

  it('agrees with the wave where the band has room, and reads the clamp where it does not', () => {
    // THE CALIBRATION, and it is not the claim above: this compares the ruler
    // against `crowdRowRise`, which is the arithmetic the drawing is supposed to
    // realise. Two independent computations of the same quantity — one counting
    // pixels, one doing the sums — so agreement means the ruler is reading in
    // the right units, and disagreement means one of them is wrong.
    //
    // WHERE THEY DISAGREE ON PURPOSE, and it is the whole reason this test has
    // a name about a clamp: `paintCrowd` pins every head inside the band with
    // `headTop = Math.max(top, y - rowRise)`, and the BACK tier's heads are
    // already drawn on the band's top row. At the cheer's 7 the arithmetic asks
    // it for 1 row and the PICTURE gives 0. The pixels are the ones telling the
    // truth, which is the whole reason this file measures them.
    //
    // So the expected reading is the wave's answer CLIPPED TO THE BAND —
    // `bandRoom` below — rather than the wave's answer, and that clip is
    // computed from the rendered seat rows rather than assumed. DELETE THE
    // CLAMP (drop the `Math.max(top, ...)` in `gymScene.ts`) and the back tier's
    // head is drawn one row above the band at the cheer, its window sees it, and
    // this is the assertion that goes red.
    const tiers = crowdTierCount(MEET_HALL_SCENE);
    for (const rise of [WALKOUT_HALL_RISE, CHEER_HALL_RISE]) {
      const measured = tierRisesOf(renderGymScene(hallScene(rise)));
      for (const [index, seen] of measured.entries()) {
        const tier = SEATED_TIERS[index];
        if (tier === undefined) throw new Error('unreachable');
        const asked = crowdRowRise(rise, tiers - 1 - index);
        // How far this tier can come up and still be inside the band...
        const bandRoom = tier.seatRow - BAND_TOP;
        // ...and how far the PROBE can see above its seat row before it runs
        // into the tier behind — or, for the back tier, off the top of the band.
        const probeWindow = tier.seatRow - tier.ceilingRow;
        const drawn = Math.min(asked, bandRoom);
        expect(seen, `rise ${rise}, tier ${index}: drawn higher than the wave asked for`)
          .toBeLessThanOrEqual(asked);
        if (drawn <= probeWindow) {
          expect(
            seen,
            `rise ${rise}, tier ${index}: the band had room for ${drawn} rows and drew ${seen}`,
          ).toBe(drawn);
        }
        // The instrument saturates at the tier behind. If a tuning pass ever
        // pushes a tier that far, this says so rather than quietly reading low.
        expect(seen, `rise ${rise}, tier ${index}: the ruler ran out of band`).toBeLessThan(
          Math.max(1, probeWindow),
        );
      }
    }
  });

  it('keeps every spectator inside the seating band, at every rise', () => {
    // THE UPWARD MIRROR of `never lets a risen hall reach down toward the
    // lifter`, and the thing that makes the back tier's window readable: the
    // rows above the band are WALL, and a hall standing up must not paint
    // seating onto them. `paintCrowd` guarantees it two ways — `fillInBand`
    // clips the keyline, and `Math.max(top, y - rowRise)` clips the head — and
    // neither was measured anywhere before this.
    //
    // Zero rather than a bound, because there is no rise at which a spectator
    // belongs on the wall between the banner and the top tier. Non-vacuous
    // because the same rows are the back tier's scan window, and because the
    // band below them is asserted full of people by the tests above.
    //
    // AND "EVERY RISE" IS NOW THE WORD. This used to sample three — 0 and the
    // two the beat asks for — under a title that claimed all of them. Escape is
    // monotone in the rise for this renderer, so sampling was defensible, but
    // the argument lived nowhere and the title over-claimed. `EVERY_RISE` is the
    // whole domain instead, and the test below says on pixels why there is
    // nothing past the end of it.
    for (const rise of EVERY_RISE) {
      const grid = renderGymScene(hallScene(rise));
      let escaped = 0;
      for (let y = 0; y < BAND_TOP; y += 1) {
        for (let x = 0; x < grid.w; x += 1) {
          const v = grid.data[y * grid.w + x];
          if (v === GYM.CROWD_MID || v === GYM.CROWD_DARK) escaped += 1;
        }
      }
      expect(escaped, `rise ${rise}: the crowd is drawn above the seating band`).toBe(0);
    }
    // ...and the rows that must stay empty are the ones the back tier is
    // measured in, so this is the guarantee that reading rests on and not a
    // separate fact about a different part of the picture.
    const back = SEATED_TIERS[0];
    if (back === undefined) throw new Error('the band has no tiers in it');
    expect(back.ceilingRow, 'the back tier has no window to be measured in')
      .toBeLessThan(back.seatRow);
    expect(back.seatRow, 'the back tier does not sit on the top row of the band').toBe(BAND_TOP);
  });

  it('has nothing left to give past the end of this sweep', () => {
    // WHAT MAKES A LOOP OVER `EVERY_RISE` A STATEMENT ABOUT EVERY RISE, rather
    // than a sample with an ambitious title. Two halves, both measured:
    //
    //   THE ARITHMETIC. `paintCrowd` reads `spec.crowdRisePx` once, through
    //     `Math.max(0, Math.round(...))`, and uses it only through
    //     `crowdRowRise` — so the domain is the non-negative integers, and at
    //     the end of this sweep every tier is already at its cap.
    //   THE PICTURE. Which would still leave "and therefore the room stops
    //     changing" an inference, so it is rendered and compared instead.
    const tiers = crowdTierCount(MEET_HALL_SCENE);
    expect(EVERY_RISE[EVERY_RISE.length - 1], 'the sweep does not reach saturation')
      .toBe(RISE_SATURATION);
    expect(EVERY_RISE[0], 'the sweep does not start at a seated hall').toBe(0);
    for (let tier = 0; tier < tiers; tier += 1) {
      expect(
        crowdRowRise(RISE_SATURATION, tier),
        `tier ${tier} is not at its cap at the end of the sweep`,
      ).toBe(GYM_CROWD.ROW_RISE_MAX_PX);
    }
    const saturated = renderGymScene(hallScene(RISE_SATURATION));
    for (const beyond of [RISE_SATURATION + 1, RISE_SATURATION * 2, BAND_BOTTOM]) {
      expect(
        differingPixels(renderGymScene(hallScene(beyond)), saturated),
        `rise ${beyond} draws a room the sweep never visits`,
      ).toBe(0);
    }
    // Non-vacuity: inside the sweep the room really does keep changing, so this
    // is "the wave ran out" and not "the wave never started".
    expect(differingPixels(renderGymScene(hallScene(0)), saturated)).toBeGreaterThan(0);
    // ...and both rises the beat asks for are inside it. If a tuning pass ever
    // pushes one past the end, that rise draws nothing the cap did not already
    // draw — which is a thing worth being told rather than absorbing quietly.
    expect(WALKOUT_HALL_RISE, 'the walk-out asks for more rise than the band can use')
      .toBeLessThanOrEqual(RISE_SATURATION);
    expect(CHEER_HALL_RISE, 'the cheer asks for more rise than the band can use')
      .toBeLessThanOrEqual(RISE_SATURATION);
  });

  it('reads its rise off a WHOLE tier, at every rise', () => {
    // ---------------------------------------------------------------------
    // THE FLOOR UNDER `tierRisesOf`, AND THE HOLE IT FILLS
    // ---------------------------------------------------------------------
    // `topRowOf` falls back to the seat row, so a tier that is NOT DRAWN AT ALL
    // reads exactly what a tier that did not move reads: 0. Nothing else in the
    // tree could tell those two apart, and this was run rather than reasoned —
    // `paintCrowd` made to skip the back tier whenever `rise > 0`, so an entire
    // tier of the hall is missing from every risen frame:
    //
    //     Test Files  55 passed (55)
    //          Tests  2330 passed (2330)
    //
    // Why each instrument missed it:
    //   `agrees with the wave` expects the back tier to read 0 at both sampled
    //     rises, because its `bandRoom` is 0 — and "not drawn at all" reads 0.
    //   `airOf` SKIPS rows with no spectators in them, so a vanished tier
    //     RAISES `worstRowAir`. The metric improves.
    //   `litShare` is bounded above only; `occupiedRows` and `litPx` have floors
    //     on the SEATED hall only.
    //   `brings the hall up` compares two renders of the same code.
    //   `keeps every spectator inside the seating band` counts escapes ABOVE the
    //     band; `never lets a risen hall reach down` counts crowd that was not
    //     crowd before, which inside the band is nothing at all — see
    //     `tierRisesOf`.
    //
    // ---------------------------------------------------------------------
    // WHY EQUALITY AND NOT "AT LEAST AS MANY AS AT REST"
    // ---------------------------------------------------------------------
    // The floor is true here and it is asserted, but it is the weaker of the two
    // statements and it is only true in THIS window — see `ownColumnPixels` for
    // why the window stops at the seat row, and for the measurement that says a
    // count taken further down falls with the wave instead of holding.
    //
    // The exact relation is a product. Standing up is the head lifting and the
    // shoulders STRETCHING to a seat that stays put, so a tier risen by R is
    // solid from `seatRow - R` to `seatRow` in its own columns — R + 1 rows of
    // them, every one full. Asserting the product says that; a floor would not.
    // A tier drawn as a floating head with a gap under it, or one that grew a
    // row wider than its own columns, passes a floor and fails this.
    for (const rise of EVERY_RISE) {
      const grid = renderGymScene(hallScene(rise));
      const measured = tierRisesOf(grid);
      for (const tier of SEATED_TIERS) {
        // THE CALIBRATION: at rest the window holds exactly the seat row, so
        // "as many as at rest" and "one solid row" are the same sentence.
        const atRest = ownColumnPixels(REST_BAND, tier);
        expect(tier.ownCols.length, `tier ${tier.index} owns no columns`).toBeGreaterThan(0);
        expect(atRest, `tier ${tier.index} is not drawn on its own seat row at rest`)
          .toBe(tier.ownCols.length);

        const seen = ownColumnPixels(grid, tier);
        const rows = (measured[tier.index] ?? 0) + 1;
        expect(
          seen,
          `rise ${rise}, tier ${tier.index}: read as risen ${rows - 1}, which owes ${rows} solid rows of ${tier.ownCols.length} and drew ${seen} pixels`,
        ).toBe(rows * tier.ownCols.length);
        // ...and the floor, restated as the thing it is rather than left as a
        // corollary: a rise adds rows to a tier and takes none away, so no tier
        // ever has FEWER of its own pixels here than the seated hall gives it.
        expect(
          seen,
          `rise ${rise}, tier ${tier.index}: fewer spectators than the seated hall has`,
        ).toBeGreaterThanOrEqual(atRest);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// THE CLAIM: the beat named after a walk-out contains one
// ---------------------------------------------------------------------------

describe('the walk-out moves (GDD §6.2 step 1)', () => {
  /**
   * Four instants, one per stage that has motion in it, plus the settled end.
   * Named by stage rather than by number so a tuning pass that moves a duration
   * moves these with it.
   */
  const M = MEET_TUNING.WALKOUT_MOTION;
  /** Far enough into a step to be past the transfer and onto the plant. */
  const PLANT_MS = M.STEP_MS * 0.85;
  const INSTANTS: readonly { readonly name: string; readonly ms: number }[] = [
    { name: 'racked, bar loaded', ms: AT.UNRACK - M.TICK_MS },
    { name: 'mid-unrack', ms: AT.UNRACK + M.UNRACK_MS / 2 },
    { name: 'first plant', ms: AT.STEP + PLANT_MS },
    { name: 'second plant', ms: AT.STEP + M.STEP_MS + PLANT_MS },
    { name: 'set', ms: AT.SET },
  ];

  /**
   * THE MUTATION THIS TEST EXISTS FOR, and the number that used to be zero.
   *
   * Every consecutive pair of instants must differ by more than this many scene
   * pixels. Measured at these values: 224 / 344 / 391 / 279 for the four pairs
   * on an ordinary walk-out. The bound is deliberately far below the smallest of
   * them — this is "the picture is not the same picture", not a pin on a
   * drawing nobody has looked at.
   *
   * FREEZE THE CLOCK AND THIS GOES RED. Make `walkoutFrameAt` return
   * `sequence.frames[0]`, or make `buildWalkout` emit one frame, and every pair
   * collapses to 0.
   */
  const A_PICTURE_THAT_CHANGED = 100;

  it('draws a different picture at every stage of the beat', () => {
    const shots = INSTANTS.map((instant) => ({
      ...instant,
      grid: hallMs(ORDINARY, instant.ms),
    }));

    for (let i = 1; i < shots.length; i += 1) {
      const before = shots[i - 1];
      const after = shots[i];
      if (before === undefined || after === undefined) throw new Error('unreachable');
      const moved = differingPixels(before.grid, after.grid);
      expect(moved, `${before.name} -> ${after.name} is the same picture`).toBeGreaterThan(
        A_PICTURE_THAT_CHANGED,
      );
    }

    // ...and no two of the five are the same drawing, so the beat is not two
    // pictures with three repeats in it.
    for (let i = 0; i < shots.length; i += 1) {
      for (let j = i + 1; j < shots.length; j += 1) {
        const a = shots[i];
        const b = shots[j];
        if (a === undefined || b === undefined) throw new Error('unreachable');
        expect(differingPixels(a.grid, b.grid), `${a.name} == ${b.name}`).toBeGreaterThan(0);
      }
    }
  });

  it('moves the LIFTER, not just the room', () => {
    // Stated as its own assertion because "the picture changed" would also be
    // satisfied by a background that flickered while the man stood still. On an
    // ordinary walk-out the room is the SAME room at both instants — the crowd
    // never comes up — so every differing pixel has to be inside the sprite's
    // own cell.
    const racked = hallMs(ORDINARY, AT.UNRACK - MEET_TUNING.WALKOUT_MOTION.TICK_MS);
    const planted = hallMs(ORDINARY, AT.STEP + MEET_TUNING.WALKOUT_MOTION.STEP_MS * 0.85);
    const rooms = differingPixels(renderGymScene(hallScene(0)), renderGymScene(hallScene(0)));
    expect(rooms, 'the room is not stable between two renders').toBe(0);

    const span = differingRows(racked, planted);
    expect(span, 'nothing moved at all').not.toBeNull();
    expect(span?.top).toBeGreaterThanOrEqual(GYM_LIFT_STAGE.SPRITE_Y);
    expect(span?.bottom).toBeLessThan(GYM_LIFT_STAGE.SPRITE_Y + RESOLUTION.CELL_H);
  });

  it('takes the bar off the hooks: he starts dipped and ends standing', () => {
    const racked = walkoutFrameAt(ORDINARY, AT.LOAD);
    const set = walkoutFrameAt(ORDINARY, AT.SET);
    expect(racked.stage).toBe('LOAD');
    expect(racked.depth, 'he is not sitting under the bar while it loads').toBeGreaterThan(
      set.depth,
    );
    // ...and the dip is a whole number of the sheet's authored depth steps, so
    // it is a drawing rather than a rounding error.
    const steps = Math.round(racked.depth * QUANTISE.DEPTH_STEPS) -
      Math.round(set.depth * QUANTISE.DEPTH_STEPS);
    expect(steps).toBe(MEET_TUNING.WALKOUT_MOTION.RACK_DIP_STEPS);
  });

  it('steps back: the body plants each way and the bar rocks the other way', () => {
    const stepping = ORDINARY.frames.filter((f) => f.stage === 'STEP');
    const left = stepping.filter((f) => f.bodyDxPx < 0);
    const right = stepping.filter((f) => f.bodyDxPx > 0);
    expect(left.length, 'he never plants one way').toBeGreaterThan(0);
    expect(right.length, 'he never plants the other way').toBeGreaterThan(0);

    // Each plant is smaller than the first: he is settling, not pacing.
    const widest = Math.max(...stepping.map((f) => Math.abs(f.bodyDxPx)));
    expect(widest).toBe(MEET_TUNING.WALKOUT_MOTION.STEP_BODY_DX_PX);

    // The bar goes the OTHER way, on every frame that moves at all. This is the
    // thing that reads as a walk-out in a front view rather than as a man
    // sliding sideways.
    for (const frame of stepping) {
      if (frame.bodyDxPx === 0) continue;
      expect(
        Math.sign(frame.barLateralPx),
        `bar and body both went ${frame.bodyDxPx > 0 ? 'right' : 'left'} at ${frame.startMs}ms`,
      ).toBe(-Math.sign(frame.bodyDxPx));
    }
  });

  it('settles onto EXACTLY the drawing the rep begins from', () => {
    // THE CONTINUITY PROPERTY, on pixels. The cut from the walk-out to the
    // attempt is a cut inside one shot, so the last frame of the beat and the
    // still every other staged beat draws must be the same composite — not
    // similar, identical.
    const set = hallMs(ORDINARY, ORDINARY.motionMs);
    const still = hallAt(null);
    expect(differingPixels(set, still)).toBe(0);

    // ...and the spec really is the same spec, field for field.
    expect(walkoutLifterFrame(walkoutFrameAt(ORDINARY, ORDINARY.motionMs), HEAVY_KG, BAR_AND_COLLARS_KG))
      .toEqual(hallLifterFrame(LOAD, HEAVY_KG, BAR_AND_COLLARS_KG));
  });

  it('goes still and stays still — no loop, no drift', () => {
    const last = ORDINARY.frames[ORDINARY.frames.length - 1];
    expect(last).toBeDefined();
    for (const ms of [ORDINARY.motionMs, ORDINARY.motionMs * 2, walkoutMs(3, HEAVY_KG, null, true)]) {
      expect(walkoutFrameAt(ORDINARY, ms).index, `${ms}ms`).toBe(last?.index);
    }
    // A beat that is mostly stillness is the design (GDD §6.2 calls it "brief"
    // and §12.2 judges the dread), so the last stage really is the longest hold.
    expect(ORDINARY.motionMs).toBeLessThan(walkoutMs(1, HEAVY_KG, null, false));
  });
});

// ---------------------------------------------------------------------------
// THE SECOND CLAIM: `urgent` reaches the picture
// ---------------------------------------------------------------------------

describe('a third attempt is a different picture from an opener', () => {
  /**
   * THE NUMBER THAT USED TO BE ZERO.
   *
   * Below the copy block, an opener's settled walk-out and a third attempt's
   * differed in ZERO pixels — the hall was byte-identical. This is the same
   * measurement on the same instant of the same beat, in scene pixels.
   *
   * Measured at these values: 959 of the room's 22,490 scene pixels, 4.3% of
   * it. At the stage's integer scale of 3, photographed at device pixel ratio 2,
   * that is 34,524 screen pixels — half again as many as the 22,467 the copy
   * block accounted for in the frames that had nothing below it.
   *
   * Pinned as a FLOOR rather than exactly, because it is a function of how far
   * the crowd rises and that is a value a playtest pass will turn. The floor is
   * set below rise 3 (719) so a one-row reduction does not fail the suite, and
   * far above zero, which is what it used to be.
   */
  const THE_HALL_KNOWS = 500;

  it('brings the hall up, and an opener does not', () => {
    const opener = hallMs(ORDINARY, ORDINARY.motionMs);
    const third = hallMs(URGENT, URGENT.motionMs);
    const moved = differingPixels(opener, third);
    expect(moved, 'the opener and the third attempt are the same picture').toBeGreaterThan(
      THE_HALL_KNOWS,
    );

    // AND IT IS THE CROWD, not the lifter. He is under the same bar at the same
    // weight and must be drawn identically; a third attempt that changed how a
    // man stands would be a lie about the sport.
    expect(walkoutFrameAt(URGENT, URGENT.motionMs).crowdRisePx).toBe(
      MEET_TUNING.CROWD.WALKOUT_RISE_PX,
    );
    expect(walkoutFrameAt(ORDINARY, ORDINARY.motionMs).crowdRisePx).toBe(0);
    // Compared as the SPRITE'S OWN INPUT rather than as the frame object, so
    // the check is "the same man is drawn" and not "the two sheets have the same
    // number of drawings in them".
    const figureOf = (sequence: typeof URGENT): unknown =>
      walkoutLifterFrame(
        walkoutFrameAt(sequence, sequence.motionMs),
        HEAVY_KG,
        BAR_AND_COLLARS_KG,
      );
    expect(figureOf(URGENT)).toEqual(figureOf(ORDINARY));
    expect(walkoutFrameAt(URGENT, URGENT.motionMs).bodyDxPx).toBe(
      walkoutFrameAt(ORDINARY, ORDINARY.motionMs).bodyDxPx,
    );

    // ...and the difference sits entirely ABOVE the platform, in the seating.
    const span = differingRows(opener, third);
    expect(span).not.toBeNull();
    expect(span?.bottom).toBeLessThan(GYM_LIFT_STAGE.FLOOR_ROW);
  });

  it('never lets a risen hall reach down toward the lifter', () => {
    // THE READABILITY GUARANTEE THIS COULD HAVE BROKEN. `meetStage.test.ts`
    // measures zero sub-perceptual silhouette crossings against the crowd,
    // because `GYM_CROWD.RISER_ROWS` puts the seating above the lifter's crown.
    // A crowd that grew DOWNWARD when it stood would undo that silently.
    const seated = renderGymScene(hallScene(0));
    const standing = renderGymScene(hallScene(MEET_TUNING.CROWD.CHEER_RISE_PX));
    let lowestNewCrowdRow = -1;
    let lowestSeatedCrowdRow = -1;
    for (let y = 0; y < seated.h; y += 1) {
      for (let x = 0; x < seated.w; x += 1) {
        const i = y * seated.w + x;
        const was = seated.data[i];
        const now = standing.data[i];
        const isCrowd = (v: number | undefined): boolean =>
          v === GYM.CROWD_DARK || v === GYM.CROWD_MID;
        if (isCrowd(was)) lowestSeatedCrowdRow = Math.max(lowestSeatedCrowdRow, y);
        if (isCrowd(now) && !isCrowd(was)) lowestNewCrowdRow = Math.max(lowestNewCrowdRow, y);
      }
    }
    expect(lowestSeatedCrowdRow, 'there is no crowd to measure').toBeGreaterThan(0);
    // Nothing new appears below where crowd could already be.
    expect(lowestNewCrowdRow).toBeLessThanOrEqual(lowestSeatedCrowdRow);

    // -----------------------------------------------------------------------
    // WHAT THE READING ABOVE CANNOT ASK, AND THE ONE THAT CAN
    // -----------------------------------------------------------------------
    // `isCrowd(now) && !isCrowd(was)` is unsatisfiable INSIDE the seating band.
    // `paintCrowd` fills the whole band rectangle with `CROWD_DARK` before it
    // draws anybody, so every pixel in there is already crowd in the seated
    // render. The reading above therefore sees exactly one thing — crowd
    // escaping the band's BOTTOM EDGE, over the rail toward the lifter — which
    // is what this test is named for and is worth keeping. It is not a bound on
    // anything happening within the band, and `tierRisesOf`'s docstring used to
    // cite it as one.
    //
    // The band's own lowest SPECTATOR row is the one reading that can be taken
    // there: the front edge of the seating, the edge nearest the lifter. It must
    // not move down when the hall stands, because a rise lifts heads and
    // stretches shoulders to a seat that stays where it is.
    //
    // READ INSIDE THE BAND, not over the frame. `gymProps.ts` paints furniture
    // in these same two indices below the seating (row 121 carries `CROWD_MID`
    // on the shipped hall, 22 rows under the band), so the frame's lowest
    // crowd-coloured row is a table rather than a spectator, and a bound taken
    // on it would be pinned by furniture and could never move.
    //
    // WHAT THIS DOES NOT COVER, AND IT IS MOST OF THE DOWNWARD DIRECTION. It is
    // a pin on the front edge, not a bound on growth. `paintCrowd` clips every
    // silhouette at the band's bottom row and then paints `RAIL_ROWS` of barrier
    // over it, so a figure drawn further down than it sits is hidden by the rail
    // before this can see it — RUN BOTH WAYS ROUND: making every silhouette
    // `SHOULDER_ROWS + 1` deep whenever `rise > 0`, so the whole hall grows
    // downward as it stands, leaves the WHOLE TREE green. What this does catch
    // is a spectator becoming visible in a band row the seated hall keeps clear
    // — the rail no longer covering the seating, or the bottom clip going.
    // Nothing in this file bounds a tier growing downward inside the band; see
    // `tierRisesOf`.
    const lowestSpectatorRow = (grid: IndexGrid): number => {
      let row = -1;
      for (let y = BAND_TOP; y < BAND_BOTTOM; y += 1) {
        for (let x = 0; x < grid.w; x += 1) {
          if (grid.data[y * grid.w + x] === GYM.CROWD_MID) row = y;
        }
      }
      return row;
    };
    const seatedFrontEdge = lowestSpectatorRow(seated);
    expect(seatedFrontEdge, 'the seating band has nobody in it').toBeGreaterThan(BAND_TOP);
    for (const rise of EVERY_RISE) {
      expect(
        lowestSpectatorRow(renderGymScene(hallScene(rise))),
        `rise ${rise}: the front of the seating is drawn nearer the lifter than it sits`,
      ).toBeLessThanOrEqual(seatedFrontEdge);
    }
  });

  it('stands the crowd up without turning it into a slab', () => {
    // THE OTHER FAILURE MODE, and the one a "make it more visible" tuning pass
    // walked straight into. A spectator is `HEAD_H + SHOULDER_ROWS` = 5 rows on
    // a `ROW_PITCH` of 6, so a silhouette grown upward lands on the tier behind
    // it at a rise of 2, and the stagger that makes them read as separate people
    // then fills every column between them. The band goes solid.
    //
    // ---------------------------------------------------------------------
    // WHAT THIS USED TO MEASURE, AND WHY IT COULD NOT FAIL FOR ITS OWN REASON
    // ---------------------------------------------------------------------
    // It counted `CROWD_DARK` across the band's whole RECTANGLE and asked for a
    // fifth of it, reporting 26% at the walk-out and 23% at the cheer. But the
    // top rows of that rectangle are rows no figure grows into — the band is 24
    // rows and the seating is four tiers of 5 — so nearly all the surviving dark
    // was up there, in rows with nobody in them. It passed at a uniform rise of
    // 5 while the MIDDLE of the band had zero air in it: five rows in every six
    // were a full-width slab, and a critic reading the shipped frames saw the
    // band invert into a lit field with dark squares punched through it.
    //
    // So the bound is now the thing its own comment always claimed: the air
    // BETWEEN SPECTATORS, measured only in the rows spectators actually occupy,
    // and taken at the WORST such row rather than averaged — because a solid row
    // in the middle of the band is exactly what averaging hides.
    // The two risen halls are the ones the BEAT asks for — the settled frame of
    // an urgent walk-out and the top of the cheer's ramp — rather than the two
    // constants they are tuned from. See `WALKOUT_HALL_RISE`.
    const seated = bandOf(0);
    const walkout = bandOf(WALKOUT_HALL_RISE);
    const cheer = bandOf(CHEER_HALL_RISE);

    // Non-vacuity: there is a band, it has people in it, and they are in rows.
    expect(seated.occupiedRows, 'there is no seating to measure').toBeGreaterThan(
      GYM_CROWD.ROW_PITCH,
    );
    expect(seated.litPx).toBeGreaterThan(0);

    // THE BOUND. Every row a spectator is drawn in keeps at least this much of
    // itself as air. A seated hall measures 2 of every 7 columns — the gap the
    // shoulder pitch leaves, 28.6% — and the risen hall must not do worse.
    const AIR_BETWEEN_SPECTATORS = 1 / 5;
    // ...and the second bound, on the same rows: the band stays more ground than
    // figure by a margin. A seated hall is 53.6% figure across its occupied rows
    // and the shipped rises hold 53.2-54.7%; the uniform rise that shipped
    // before this pass is 84.4%, which is the inversion `gymTuning.ts`'s own
    // rule forbids — "held to the bottom of the value range so the busiest area
    // of the screen is also the quietest one".
    const STILL_MOSTLY_GROUND = 3 / 5;
    for (const [name, band] of [
      ['seated', seated],
      ['walk-out', walkout],
      ['cheer', cheer],
    ] as const) {
      expect(band.worstRowAir, `${name}: a row of the band is solid`).toBeGreaterThan(
        AIR_BETWEEN_SPECTATORS,
      );
      expect(band.litShare, `${name}: the band is more figure than ground`).toBeLessThan(
        STILL_MOSTLY_GROUND,
      );
    }

    // AND THE HALL STILL STANDS UP. The rise is not bought by doing nothing —
    // measured against what the SEATED hall reads on the same ruler, which is
    // zero. (The check that used to stand here asked only that some tier read
    // above zero, and the seated hall passed it; see `tierRisesOf`.)
    expect(seated.tierRises, 'a hall nobody stood up reads as risen').toEqual(
      seated.tierRises.map(() => 0),
    );
    expect(sumOf(walkout.tierRises), 'the walk-out hall is drawn where the seated one is')
      .toBeGreaterThan(sumOf(seated.tierRises));
    expect(sumOf(cheer.tierRises)).toBeGreaterThan(sumOf(walkout.tierRises));
    for (const [name, band] of [
      ['walk-out', walkout],
      ['cheer', cheer],
    ] as const) {
      expect(band.tierRises.some((r) => r > 0), `${name}: no tier came up`).toBe(true);
      // ...and nobody sank: a "rise" that pushed a tier DOWN would still beat a
      // seated hall on the sum if the sum were all this asked for.
      for (const [tier, rise] of band.tierRises.entries()) {
        expect(rise, `${name}: tier ${tier} is drawn below its seat`).toBeGreaterThanOrEqual(0);
      }
    }

    // ---------------------------------------------------------------------
    // THE MUTATION. The old mechanism, replayed on real pixels: every tier
    // risen by the same amount, no keyline. At the 5 rows that shipped it fails
    // the corrected bound outright — the worst occupied row has NO air in it —
    // while passing the old rectangle-wide bound it was written against.
    // ---------------------------------------------------------------------
    const uniform5 = airOf(uniformlyRisenBand(5));
    expect(uniform5.worstRowAir, 'the planted slab has air in every row').toBe(0);
    expect(uniform5.litShare, 'the planted slab did not invert').toBeGreaterThan(
      STILL_MOSTLY_GROUND,
    );
    // ...and the check that used to stand here waves it through. Both halves are
    // asserted, so "the old bound was too weak" is measured rather than argued.
    const oldBound = (band: BandAir): number =>
      band.rectDarkPx / (seated.rectLitPx + seated.rectDarkPx);
    expect(oldBound(uniform5), 'the old bound would have caught it').toBeGreaterThan(1 / 5);

    // The plant is the OLD DRAWING and not a broken one: at rest it reproduces
    // the shipped hall BYTE FOR BYTE, so what fails above is the rise and
    // nothing else about how the plant is built.
    expect(differingPixels(uniformlyRisenBand(0), renderGymScene(MEET_HALL_SCENE))).toBe(0);
  });

  it('leaves a seated hall byte-identical to the room every other beat draws', () => {
    // `hallScene(0)` must be `MEET_HALL_SCENE` itself, not a copy with an extra
    // field — otherwise every previously-measured room in this project quietly
    // becomes a different object with a different memo key.
    expect(hallScene(0)).toBe(MEET_HALL_SCENE);
    expect(hallScene(-MEET_TUNING.CROWD.CHEER_RISE_PX)).toBe(MEET_HALL_SCENE);

    // AND THE ROOM IS THE SAME ROOM, not just the same object. A rest hall
    // REBUILT — a different spec, carrying `crowdRisePx` explicitly — has to
    // rasterise byte for byte the same, because that is what says a zero rise is
    // a no-op in the RENDERER rather than only a short circuit in `hallScene`.
    // (What stood here compared `renderGymScene(hallScene(0))` with
    // `renderGymScene(MEET_HALL_SCENE)`, which the line above had just proved
    // is the same argument: it compared a room with itself and could not fail.)
    const rebuilt: GymSceneSpec = { ...MEET_HALL_SCENE, crowdRisePx: 0 };
    expect(rebuilt, 'the rebuilt spec is the frozen one').not.toBe(MEET_HALL_SCENE);
    expect(differingPixels(renderGymScene(rebuilt), REST_BAND)).toBe(0);

    // ...and the renderer's own clamp is what makes a hall that is asked to sit
    // DOWN sit still, so nothing depends on `hallScene` catching it first.
    const below: GymSceneSpec = {
      ...MEET_HALL_SCENE,
      crowdRisePx: -MEET_TUNING.CROWD.CHEER_RISE_PX,
    };
    expect(differingPixels(renderGymScene(below), REST_BAND)).toBe(0);
  });

  it('comes up over time rather than switching on', () => {
    const rises = ORDINARY.frames.map((f) => f.crowdRisePx);
    expect(new Set(rises).size, 'an opener has a crowd doing something').toBe(1);

    const urgentRises = URGENT.frames.map((f) => f.crowdRisePx);
    expect(new Set(urgentRises).size, 'the hall stands up in one frame').toBeGreaterThan(2);
    // Monotonic: nobody sits back down mid-walk-out.
    for (let i = 1; i < urgentRises.length; i += 1) {
      expect(urgentRises[i] ?? 0).toBeGreaterThanOrEqual(urgentRises[i - 1] ?? 0);
    }
    // Seated while the bar is still being loaded — the hall reacts to him
    // taking it, not to the crew.
    expect(walkoutFrameAt(URGENT, AT.LOAD).crowdRisePx).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// THE THIRD CLAIM: the crowd reacts to three whites
// ---------------------------------------------------------------------------

describe('the hall reacts to a good lift, and to nothing else', () => {
  it('is a different room after the last lamp than during the deliberation', () => {
    // The flattest frame in the sequence was three white lights in a hall that
    // did not move. Measured the same way: whole scene pixels.
    const waiting = renderGymScene(hallScene(0));
    const cheering = renderGymScene(hallScene(MEET_TUNING.CROWD.CHEER_RISE_PX));
    expect(differingPixels(waiting, cheering)).toBeGreaterThan(0);
    // DELETE THE REACTION — pass 0 where the verdict passes the ramp's top —
    // and this is the assertion that goes red.
    expect(crowdRisePxAt(MEET_TUNING.CROWD.CHEER_RISE_MS, CHEER_CROWD_RISE)).toBe(
      MEET_TUNING.CROWD.CHEER_RISE_PX,
    );
    expect(CHEER_CROWD_RISE.toPx).toBeGreaterThan(0);
  });

  it('stands FURTHER than it does on a walk-out', () => {
    // The ordering is the design claim; the values are a starting point nobody
    // has watched on a phone. Anticipation is people getting up; a good lift is
    // people already up.
    expect(CHEER_CROWD_RISE.toPx).toBeGreaterThan(WALKOUT_CROWD_RISE.toPx);
    // ...and faster: a reaction, not an anticipation.
    expect(CHEER_CROWD_RISE.rampMs).toBeLessThan(WALKOUT_CROWD_RISE.rampMs);
  });

  it('is seated before its ramp starts, so it cannot leak a verdict', () => {
    // The deliberation beat must be identical whichever way the call went. The
    // ramp is measured from AFTER the last lamp, so every negative offset — the
    // whole of the deliberation — is a seated hall.
    for (const before of [-MEET_TUNING.DELIBERATION_MS, -MEET_TUNING.LIGHT_FADE_MS, 0]) {
      expect(crowdRisePxAt(before, CHEER_CROWD_RISE), `${before}ms`).toBe(0);
    }
  });

  it('rises in whole rows, so the room is rasterised a handful of times', () => {
    const seen = new Set<number>();
    for (let ms = 0; ms <= CHEER_CROWD_RISE.rampMs; ms += 1) {
      seen.add(crowdRisePxAt(ms, CHEER_CROWD_RISE));
    }
    for (const rise of seen) expect(Number.isInteger(rise)).toBe(true);
    expect(seen.size).toBeLessThanOrEqual(CHEER_CROWD_RISE.toPx + 1);
  });
});

// ---------------------------------------------------------------------------
// The order the bar is loaded in, and the shape of the sheet
// ---------------------------------------------------------------------------

describe('the bar is loaded before he takes it off the hooks', () => {
  it('holds the unrack until the last disc could have landed', () => {
    // The complaint this answers: the plates were landing on a bar that was
    // already being walked out. `WalkoutView` drops one disc per
    // `BAR_LOAD_PLATE_STAGGER_MS`, so the loading window has to cover every disc
    // on the heaviest bar this game can build.
    for (const kg of [BAR_AND_COLLARS_KG, 100, 207.5, HEAVY_KG, 320, 400]) {
      const discs = layoutSleeve(visualPlateStack(kg, BAR_AND_COLLARS_KG)).slots.length;
      const lastDiscAt = Math.max(0, discs - 1) * MEET_TUNING.BAR_LOAD_PLATE_STAGGER_MS;
      expect(barLoadMs(discs), `${kg} kg`).toBeGreaterThan(lastDiscAt);
      expect(walkoutStageStartMs(discs).UNRACK, `${kg} kg`).toBeGreaterThan(lastDiscAt);
    }
    // The measurement is not vacuous: a real bar has real discs on it.
    expect(layoutSleeve(visualPlateStack(HEAVY_KG, BAR_AND_COLLARS_KG)).slots.length)
      .toBeGreaterThan(2);
  });

  it('never runs the choreography past the beat the meet gives it', () => {
    // An opener is the shortest walk-out there is (`walkoutMs`), so if the
    // motion fits inside that it fits inside every other.
    for (const kg of [BAR_AND_COLLARS_KG, 207.5, HEAVY_KG, 400]) {
      const discs = layoutSleeve(visualPlateStack(kg, BAR_AND_COLLARS_KG)).slots.length;
      expect(walkoutMotionMs(discs), `${kg} kg`).toBeLessThanOrEqual(
        walkoutMs(1, kg, null, false),
      );
    }
  });

  it('walks its stages in order and reaches every one of them', () => {
    const at = walkoutStageStartMs(PLATES);
    let previous = -1;
    for (const stage of WALKOUT_STAGES) {
      expect(at[stage], `${stage} does not follow the stage before it`).toBeGreaterThan(previous);
      previous = at[stage];
      expect(walkoutStageAt(at[stage], PLATES), stage).toBe(stage);
    }
    expect(new Set(ORDINARY.frames.map((f) => f.stage))).toEqual(new Set(WALKOUT_STAGES));
  });
});

describe('the walk-out is a finite sheet, not a per-frame deformation (GDD §7.1)', () => {
  it('coalesces into a sheet a 16-bit game could have shipped', () => {
    // A drawing per display frame over a 2 s beat would be ~120 drawings. The
    // bound is generous but it is a bound: this is what stops the choreography
    // becoming a continuous tween with a pixel filter on it.
    const A_SHEET = 48;
    expect(ORDINARY.frames.length).toBeGreaterThan(WALKOUT_STAGES.length);
    expect(ORDINARY.frames.length).toBeLessThan(A_SHEET);
    expect(URGENT.frames.length).toBeLessThan(A_SHEET);
    // ...and the urgent one costs a few more, because the crowd's rows are part
    // of the drawn identity.
    expect(URGENT.frames.length).toBeGreaterThan(ORDINARY.frames.length);
  });

  it('puts every channel on the sheet’s own quanta', () => {
    for (const frame of URGENT.frames) {
      const on = (value: number, step: number): boolean =>
        Math.abs(value / step - Math.round(value / step)) < 1e-9;
      expect(on(frame.depth, 1 / QUANTISE.DEPTH_STEPS), `depth ${frame.depth}`).toBe(true);
      expect(on(frame.barLateralPx, QUANTISE.LATERAL_QUANTUM_PX)).toBe(true);
      expect(on(frame.barTiltDeg, QUANTISE.TILT_QUANTUM_DEG)).toBe(true);
      expect(on(frame.barBendPx, QUANTISE.BEND_QUANTUM_PX)).toBe(true);
      expect(Number.isInteger(frame.bodyDxPx)).toBe(true);
      expect(Number.isInteger(frame.crowdRisePx)).toBe(true);
      expect(Number.isInteger(frame.strainLevel)).toBe(true);
      expect(frame.strainLevel).toBeLessThan(STRAIN.LEVELS);
    }
  });

  it('adds strain only where he is actually driving the bar', () => {
    // SCARCITY. Letting the steps feed the strain channel too made the body flip
    // rungs four times during the walk back, which at this quantisation is a
    // twitch rather than effort.
    const rest = walkoutFrameAt(ORDINARY, ORDINARY.motionMs).strainLevel;
    const byStage = new Map<string, Set<number>>();
    for (const frame of ORDINARY.frames) {
      const seen = byStage.get(frame.stage) ?? new Set<number>();
      seen.add(frame.strainLevel);
      byStage.set(frame.stage, seen);
    }
    expect([...(byStage.get('UNRACK') ?? [])].some((s) => s > rest)).toBe(true);
    for (const stage of ['LOAD', 'STEP', 'SETTLE', 'SET']) {
      expect([...(byStage.get(stage) ?? [rest])], stage).toEqual([rest]);
    }
  });

  it('is deterministic — the same attempt is the same beat every time', () => {
    expect(buildWalkout({ loadRatio: LOAD, plateCount: PLATES, urgent: false })).toEqual(ORDINARY);
  });

  it('indexes a frame by time the same way the render loop does', () => {
    for (const frame of URGENT.frames) {
      expect(walkoutFrameIndexAt(URGENT, frame.startMs)).toBe(frame.index);
      expect(walkoutFrameIndexAt(URGENT, frame.startMs + frame.holdMs - 1)).toBe(frame.index);
    }
    expect(walkoutFrameIndexAt(URGENT, -URGENT.motionMs)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The two instants the capture photographs
// ---------------------------------------------------------------------------

describe('the mid-motion preview beats land where they are named', () => {
  /**
   * The third attempt the preview builds, and the discs on its bar — read out of
   * the preview's own state and the federation's own loading rules, so a tuning
   * pass that moves the opener moves this with it.
   */
  function previewThird(): { sequence: ReturnType<typeof buildWalkout>; plates: number } {
    const state = previewStateFor({ moment: 'walkout-third' });
    const live = state.live;
    if (live === null) throw new Error('the walkout-third preview has no attempt on the bar');
    const barKg = meetLoadingRules(state.meet).barAndCollarsWeight[live.lift];
    const plates = hallPlateCount(live.weightKg, barKg);
    return {
      sequence: buildWalkout({ loadRatio: live.loadRatio, plateCount: plates, urgent: true }),
      plates,
    };
  }

  it('holds walkout-unrack inside the unrack and walkout-step inside a step', () => {
    // The photographs exist to show motion in stills, so each has to land in the
    // stage it is named for. Checked against the sequence the preview's own
    // attempt builds, not against arithmetic on the constants.
    const { sequence, plates } = previewThird();
    const unrackAt = MEET_PREVIEW.WALKOUT_HOLD_MS.UNRACK;
    const stepAt = MEET_PREVIEW.WALKOUT_HOLD_MS.STEP;
    expect(walkoutStageAt(unrackAt, plates)).toBe('UNRACK');
    expect(walkoutStageAt(stepAt, plates)).toBe('STEP');

    // ...and the two are genuinely different pictures from each other and from
    // the settled frame the third-attempt shot is taken at.
    const shots = [unrackAt, stepAt, sequence.motionMs].map((ms) =>
      hallAt(walkoutFrameAt(sequence, ms)),
    );
    for (let i = 0; i < shots.length; i += 1) {
      for (let j = i + 1; j < shots.length; j += 1) {
        const a = shots[i];
        const b = shots[j];
        if (a === undefined || b === undefined) throw new Error('unreachable');
        expect(differingPixels(a, b), `preview shots ${i} and ${j} are the same frame`)
          .toBeGreaterThan(0);
      }
    }
    // The step shot catches him off centre, which is the whole reason it is
    // taken there.
    expect(walkoutFrameAt(sequence, stepAt).bodyDxPx).not.toBe(0);
  });

  it('lets every other beat play, and freezes only these two', () => {
    const held = MEET_MOMENTS.filter((moment) => holdWalkoutAtMs(moment) !== null);
    expect(held).toEqual(['walkout-unrack', 'walkout-step']);
    // `walkout` and `walkout-third` run their clocks and come to rest, which is
    // what makes the crowd the only thing separating those two frames.
    expect(holdWalkoutAtMs('walkout')).toBeNull();
    expect(holdWalkoutAtMs('walkout-third')).toBeNull();
  });

  it('photographs the SAME attempt at all three walk-out instants', () => {
    // Otherwise the frames differ because they are different lifts, and the
    // comparison says nothing about the choreography.
    const third = previewStateFor({ moment: 'walkout-third' }).live;
    for (const moment of ['walkout-unrack', 'walkout-step'] as const) {
      const live = previewStateFor({ moment }).live;
      expect(live?.weightKg, moment).toBe(third?.weightKg);
      expect(live?.attemptNumber, moment).toBe(third?.attemptNumber);
      expect(live?.bombRisk, moment).toBe(third?.bombRisk);
    }
    // ...and the opener really is a different attempt, so the crowd measurement
    // above is comparing an urgent walk-out with a non-urgent one.
    const opener = previewStateFor({ moment: 'walkout' }).live;
    expect(opener?.attemptNumber).not.toBe(third?.attemptNumber);
    expect(opener?.bombRisk).toBe(false);
    expect(third?.bombRisk).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The one number nobody can check here
// ---------------------------------------------------------------------------

describe('what this file does NOT claim', () => {
  it('records that the pacing half of GDD §12.2 is unverified', () => {
    // Not a behaviour test. It is here so the claim is in the suite rather than
    // only in a comment: every duration the choreography runs on is a starting
    // point, and GDD §12.1 puts the tuning of them after the run, by hand, with
    // people watching. Broadcast footage is unreachable from this environment.
    const motion = MEET_TUNING.WALKOUT_MOTION;
    expect(motion.UNRACK_MS).toBeGreaterThan(0);
    expect(motion.STEP_MS).toBeGreaterThan(0);
    expect(motion.SETTLE_MS).toBeGreaterThan(0);
    expect(MEET_TUNING.CROWD.WALKOUT_RISE_MS).toBeGreaterThan(0);
  });
});
