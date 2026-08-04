/**
 * The gym — a composable background layer the lift happens in.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS
 * ---------------------------------------------------------------------------
 * One pure function from a `GymSceneSpec` to an index grid, in exactly the same
 * terms the lifter sprite is drawn in: palette indices, no colour values, no
 * alpha, no fractional pixels. That is what makes the two composable — a scene
 * and a figure end up in one grid, which is what the readability measurement
 * needs and what a Skia layer wants anyway.
 *
 * It is a LAYER, not a screen. Nothing in here knows about the lift mechanic,
 * the session, the meet, or which screen is asking. `LiftStage.tsx` draws it
 * behind the figure; meet day can draw the same function with a different venue
 * and a different box. The only inputs are a room, a size, where the floor is,
 * which column the figure stands on, and where the camera is.
 *
 * ---------------------------------------------------------------------------
 * IT IS A RENDERER AND NOTHING ELSE (CLAUDE.md, and the A2 brief)
 * ---------------------------------------------------------------------------
 *   - No React import, no I/O, no side effects.
 *   - NO RANDOMNESS. Every mark in the room is placed by an authored table or
 *     by a periodic function of position. `renderGymScene` called twice with
 *     the same spec returns byte-identical grids, and `gymScene.test.ts`
 *     asserts it. A seeded PRNG would have been easier and it is exactly the
 *     thing that makes a background impossible to art-direct.
 *   - No currency, no ad path, no game math, no player state. `GymSceneSpec`
 *     has five fields and none of them is a number about the lifter.
 *   - NO FATIGUE METER, and structurally not just by intention (GDD §3.4,
 *     §12.3): there is no input to this module from which one could be drawn.
 *     Nothing here is told how tired anybody is.
 *
 * ---------------------------------------------------------------------------
 * DEPTH IS VALUE AND OVERLAP, NOT DETAIL
 * ---------------------------------------------------------------------------
 * Four devices, in the order they do work:
 *
 *   1. VALUE BANDS. The wall lives in the bottom third of the range, the floor
 *      in the middle, the figure alone in the top. Measured off the era
 *      reference in `gymPalette.ts`'s header.
 *   2. A DIM STEP on far props. The same drawing in darker paint reads as
 *      further away, and costs one lookup rather than a second drawing.
 *   3. A HOLE IN THE COMPOSITION. Nothing stands in the band the figure
 *      occupies. This is the rule the whole layout is built around.
 *   4. PARALLAX RATES, for a camera that no shipped screen moves yet.
 */

import { fillRect, createGrid, getPx, setPx, type IndexGrid } from './raster';
import { PAL, isTransparentIndex } from './palette';
import { deformPose, pitchForLevel, poseAtDepth, strainForLevel } from './rig';
import { renderContactShadow, type LifterFrameSpec } from './lifterSprite';
import { GYM, GYM_RAMPS, dimIndex, lumaOfIndex, stepIndex } from './gymPalette';
import { PROP_ART, type PropArt } from './gymProps';
import {
  GYM_BANNER,
  GYM_CLEAR_BAND,
  GYM_CONTACT_SHADOW,
  GYM_CROWD,
  GYM_FLOOR_PLAN,
  GYM_LIFT_FOCUS_X,
  GYM_LIFT_STAGE,
  GYM_LIGHTING,
  GYM_PARALLAX,
  GYM_READABILITY,
  GYM_ROOM,
  GYM_STAGE_CHROME,
  GYM_VENUE,
  GYM_VENUE_PROPS,
  GYM_WALL_PAINT,
  GYM_WINDOWS,
  type GymPropPlacement,
  type GymVenue,
} from './gymTuning';

// ---------------------------------------------------------------------------
// The spec
// ---------------------------------------------------------------------------

export interface GymSceneSpec {
  readonly venue: GymVenue;
  readonly w: number;
  readonly h: number;
  /**
   * The furniture, when it is not the venue's own table.
   *
   * Absent on every production caller — `liftStageScene()` does not set it, and
   * `GYM_VENUE_PROPS[venue]` is what a room gets. It exists so a test can render
   * THE SHELL WITH NOTHING IN IT and hold the furniture floor over it: a bound
   * that claims "a room has furniture" is worth nothing until a room with no
   * furniture can be built and shown to fail it.
   *
   * Still not player state. It is a list of drawings and where they stand.
   */
  readonly props?: readonly GymPropPlacement[];
  /** The row the figure's soles rest on. The floor is drawn through it. */
  readonly floorRow: number;
  /**
   * The column the room is composed around — the figure's own centre line, not
   * the middle of the grid. Every screen in this app puts a panel down one
   * side, so those two are never the same number, and a light pool centred on
   * the grid would light the panel instead of the lifter.
   */
  readonly focusX: number;
  /** Camera position in scene pixels. Layers slide at `GYM_PARALLAX` rates. */
  readonly cameraX: number;
  /**
   * Scene rows the seated crowd has come UP by — a hall on its feet.
   *
   * Absent or 0 on every room this file builds and on every screen outside meet
   * day, which is both the default and the point: a training gym has no crowd
   * at all (`GYM_VENUE['training-gym'].CROWD`), and a meet hall is seated unless
   * something is happening to it. `src/game/meetTuning.ts`'s `CROWD` block owns
   * WHEN it is non-zero and by how much; this file only draws it.
   *
   * IT ONLY EVER MOVES CROWD PIXELS UPWARD. `paintCrowd` lifts each silhouette's
   * head and stretches its shoulders down to the base it already had, so the
   * bottom edge of the band does not move. That is load-bearing rather than
   * tidy: the seating sits above the lifter's crown on purpose
   * (`GYM_CROWD.RISER_ROWS`), and a rise that grew downward would put texture
   * back behind his head and undo the readability fix `meetStage.test.ts`
   * measures.
   */
  readonly crowdRisePx?: number | undefined;
}

/**
 * The scene box the daily session's lift stage sits in.
 *
 * Its numbers are constrained by `LIFT_TUNING.LAYOUT` and by the sprite's own
 * resolution rather than chosen; `gymScene.test.ts` re-derives every one of
 * them and fails if the two drift apart.
 */
export function liftStageScene(cameraX: number = 0): GymSceneSpec {
  return {
    venue: 'training-gym',
    w: GYM_LIFT_STAGE.W,
    h: GYM_LIFT_STAGE.H,
    floorRow: GYM_LIFT_STAGE.FLOOR_ROW,
    focusX: GYM_LIFT_FOCUS_X,
    cameraX,
  };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** The row where the back wall meets the floor. */
export function junctionRow(spec: GymSceneSpec): number {
  return Math.round(spec.floorRow * GYM_ROOM.JUNCTION_FRAC);
}

/** Rows of floor between the junction and the bottom of the scene. */
export function floorDepth(spec: GymSceneSpec): number {
  return spec.h - junctionRow(spec);
}

/** How far a layer has slid, in whole pixels, at this camera position. */
export function layerOffset(cameraX: number, rate: number): number {
  return Math.round(-cameraX * rate);
}

/** Index of the band `frac` falls in, given ascending band boundaries. */
function bandAt(fracs: readonly number[], frac: number): number {
  let band = 0;
  for (const edge of fracs) if (frac >= edge) band += 1;
  return band;
}

function rampAt(ramp: readonly number[], step: number): number {
  const clamped = Math.min(ramp.length - 1, Math.max(0, step));
  return ramp[clamped] ?? ramp[0] ?? 0;
}

/** Linear interpolation, clamped to the endpoints. */
function lerp(a: number, b: number, t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return a + (b - a) * u;
}

/**
 * First column of a repeating pattern that has been slid by a camera, chosen so
 * the pattern still starts off the left edge however far it has slid. Without
 * it a panned wall loses its leftmost course of blocks.
 */
function wrapStart(offset: number, period: number): number {
  return (((offset % period) + period) % period) - period;
}

// ---------------------------------------------------------------------------
// Layer: the back wall
// ---------------------------------------------------------------------------

function paintWall(g: IndexGrid, spec: GymSceneSpec): void {
  const junction = junctionRow(spec);
  const bias = GYM_VENUE[spec.venue].WALL_STEP_BIAS;
  const shift = layerOffset(spec.cameraX, GYM_PARALLAX.WALL);

  for (let y = 0; y < junction; y += 1) {
    const step = bandAt(GYM_WALL_PAINT.BAND_FRACS, y / junction) + bias;
    const paint = rampAt(GYM_RAMPS.WALL, step);
    for (let x = 0; x < spec.w; x += 1) setPx(g, x, y, paint);
  }

  // Roof steel across the top, so the room has a lid rather than fading out.
  fillRect(g, 0, 0, spec.w, GYM_WALL_PAINT.TRUSS_ROWS, GYM.TRUSS);

  if (!GYM_VENUE[spec.venue].BLOCK_WALL) return;

  // Block courses, drawn in ONE STEP DOWN FROM WHATEVER BAND THEY CROSS rather
  // than in a fixed colour. A fixed mortar colour is a hard edge against the
  // brightest band and invisible against the darkest; `dimIndex` keeps every
  // course under GYM_READABILITY.EDGE_LUMA_DELTA in every band. Texture is
  // allowed; texture that registers as an edge at phone scale is noise, and
  // this is the whole difference between a wall and a stack of stripes.
  for (let y = GYM_WALL_PAINT.TRUSS_ROWS; y < junction; y += GYM_WALL_PAINT.COURSE_ROWS) {
    for (let x = 0; x < spec.w; x += 1) setPx(g, x, y, dimIndex(getPx(g, x, y)));
    const course = Math.floor(y / GYM_WALL_PAINT.COURSE_ROWS);
    const stagger = course % 2 === 0 ? 0 : GYM_WALL_PAINT.JOINT_STAGGER;
    const first = wrapStart(stagger + shift, GYM_WALL_PAINT.JOINT_COLS);
    for (let x = first; x < spec.w; x += GYM_WALL_PAINT.JOINT_COLS) {
      for (let dy = 1; dy < GYM_WALL_PAINT.COURSE_ROWS && y + dy < junction; dy += 1) {
        setPx(g, x, y + dy, dimIndex(getPx(g, x, y + dy)));
      }
    }
  }

  paintWindows(g, spec, junction);

  // The painted band every commercial gym has. A hue change, not a value
  // change: it costs nothing in contrast and buys the room a warm note.
  const stripeTop = Math.round(junction * GYM_WALL_PAINT.STRIPE_FRAC);
  fillRect(g, 0, stripeTop, spec.w, GYM_WALL_PAINT.STRIPE_ROWS, GYM.STRIPE_MID);
  fillRect(
    g,
    0,
    stripeTop + GYM_WALL_PAINT.STRIPE_ROWS - 1,
    spec.w,
    1,
    GYM.STRIPE_DARK,
  );

  // The kickplate. One line, at the junction, and the reason the figure stands
  // on a floor instead of in front of a backdrop.
  fillRect(g, 0, junction - GYM_WALL_PAINT.SKIRT_ROWS, spec.w, GYM_WALL_PAINT.SKIRT_ROWS, GYM.WALL_SKIRT);
}

/** High glass, as far from the figure as the wall goes. */
function paintWindows(g: IndexGrid, spec: GymSceneSpec, junction: number): void {
  if (GYM_WINDOWS.COUNT <= 0) return;
  const top = Math.round(junction * GYM_WINDOWS.TOP_FRAC);
  const inset = spec.w * GYM_WINDOWS.INSET_F;
  const span = spec.w - inset * 2 - GYM_WINDOWS.W;
  const gaps = Math.max(1, GYM_WINDOWS.COUNT - 1);
  const shift = layerOffset(spec.cameraX, GYM_PARALLAX.WALL);
  for (let i = 0; i < GYM_WINDOWS.COUNT; i += 1) {
    const x0 = Math.round(inset + (span * i) / gaps) + shift;
    fillRect(g, x0 - 1, top - 1, GYM_WINDOWS.W + 2, GYM_WINDOWS.H + 2, GYM.FRAME_DARK);
    fillRect(g, x0, top, GYM_WINDOWS.W, GYM_WINDOWS.H, GYM.GLASS_DIM);
    for (let x = x0 + GYM_WINDOWS.MULLION_COLS; x < x0 + GYM_WINDOWS.W; x += GYM_WINDOWS.MULLION_COLS) {
      fillRect(g, x, top, 1, GYM_WINDOWS.H, GYM.FRAME_DARK);
    }
  }
}

// ---------------------------------------------------------------------------
// Layer: the crowd (meet venue only)
// ---------------------------------------------------------------------------

/**
 * The row the front barrier of the seating stands on — the bottom of the crowd
 * band, raised clear of the platform floor by `GYM_CROWD.RISER_ROWS`.
 *
 * Exported because it is the number that decides whether the lifter's head is
 * drawn against seating or against wall, and `gymScene.test.ts` and
 * `src/meet/meetStage.test.ts` both check it against the figure's own rendered
 * silhouette rather than against the constant.
 */
export function crowdFrontRow(spec: GymSceneSpec): number {
  return Math.max(0, junctionRow(spec) - GYM_CROWD.RISER_ROWS);
}

function paintCrowd(g: IndexGrid, spec: GymSceneSpec): void {
  const venue = GYM_VENUE[spec.venue];
  if (!venue.CROWD) return;
  const junction = junctionRow(spec);
  // The seating stops here, not at the floor. See `GYM_CROWD.RISER_ROWS`: the
  // junction sits inside the standing figure's span, so a band drawn down to it
  // is a band drawn behind his head.
  const bottom = crowdFrontRow(spec);
  const top = Math.max(0, bottom - venue.CROWD_ROWS);
  const shift = layerOffset(spec.cameraX, GYM_PARALLAX.WALL);
  // How far this hall is on its feet. Whole rows, never negative, and clipped
  // into the band below. See `GymSceneSpec.crowdRisePx`.
  const rise = Math.max(0, Math.round(spec.crowdRisePx ?? 0));

  paintBanner(g, spec, junction, top);

  fillRect(g, 0, top, spec.w, bottom - top, GYM.CROWD_DARK);
  let row = 0;
  for (let y = top; y < bottom; y += GYM_CROWD.ROW_PITCH) {
    const stagger = row % 2 === 0 ? 0 : GYM_CROWD.ROW_STAGGER;
    const first = wrapStart(stagger + shift, GYM_CROWD.HEAD_COLS);
    for (let x = first; x < spec.w; x += GYM_CROWD.HEAD_COLS) {
      // Head, then shoulders under it. The shoulders are what stop a crowd
      // reading as polka dots: a spectator is a silhouette that touches the one
      // beside it, not an isolated blob.
      //
      // CLIPPED TO THE BAND. A head three rows from the bottom would otherwise
      // put its shoulders below the barrier, which is where the figure is.
      //
      // STANDING UP IS THE HEAD LIFTING AND THE SHOULDERS STRETCHING TO MEET
      // THE SEAT, not the whole silhouette sliding: the rows repeat every
      // `ROW_PITCH`, so a pure translation by a whole pitch would redraw the
      // same crowd. Growing each figure keeps the base where it was, which is
      // what stops a rise reaching down toward the lifter.
      const headTop = Math.max(top, y - rise);
      const headH = Math.min(GYM_CROWD.HEAD_H, Math.max(0, bottom - headTop));
      fillRect(g, x, headTop, GYM_CROWD.HEAD_W, headH, GYM.CROWD_MID);
      const shoulderTop = headTop + GYM_CROWD.HEAD_H;
      const seatRow = Math.min(bottom, y + GYM_CROWD.HEAD_H + GYM_CROWD.SHOULDER_ROWS);
      const shoulderH = Math.max(0, seatRow - shoulderTop);
      fillRect(g, x - 1, shoulderTop, GYM_CROWD.HEAD_W + 2, shoulderH, GYM.CROWD_MID);
    }
    row += 1;
  }
  // The barrier across the front of the seating. Same job the kickplate does in
  // the gym: it stops the crowd being a texture and makes it a thing with a
  // front edge, which is what puts it BEHIND the platform. It sits on the front
  // edge of the raised deck, so the rows under it read as the deck's face.
  fillRect(g, 0, bottom - GYM_CROWD.RAIL_ROWS, spec.w, GYM_CROWD.RAIL_ROWS, GYM.FRAME_DARK);
}

/**
 * The printed backdrop, above the crowd.
 *
 * A full-width printed board is the one element that reads "competition"
 * instead of "gym" at any size. Kept entirely above the seating, so the
 * brightest large surface in the venue is nowhere near the figure.
 *
 * NO IDENTITY ON IT, AND NO WAY TO PUT ONE THERE. The patches below are flat
 * nine-by-six colour blocks and the stripe is the room's own warm paint; there
 * is no font, no glyph table and no string anywhere in this file's drawing
 * path. GDD §12.3 forbids a real brand or federation mark in any asset, and
 * §7.3 keeps real wordmarks on Tier 3 surfaces, which the environment is not.
 * See `GYM_BANNER`.
 */
function paintBanner(g: IndexGrid, spec: GymSceneSpec, junction: number, crowdTop: number): void {
  const top = Math.min(
    crowdTop - GYM_BANNER.ROWS,
    Math.round(junction * GYM_BANNER.TOP_FRAC),
  );
  if (top < 0) return;
  fillRect(g, 0, top, spec.w, GYM_BANNER.ROWS, GYM.WALL_MID);
  fillRect(g, 0, top, spec.w, 1, GYM.FRAME_DARK);
  fillRect(g, 0, top + GYM_BANNER.ROWS - 1, spec.w, 1, GYM.FRAME_DARK);

  const stripeTop = top + Math.round(GYM_BANNER.ROWS * GYM_BANNER.STRIPE_FRAC);
  fillRect(g, 0, stripeTop, spec.w, GYM_BANNER.STRIPE_ROWS, GYM.STRIPE_MID);
  fillRect(g, 0, stripeTop + GYM_BANNER.STRIPE_ROWS - 1, spec.w, 1, GYM.STRIPE_DARK);

  const inset = spec.w * GYM_BANNER.PATCH_INSET_F;
  const span = spec.w - inset * 2 - GYM_BANNER.PATCH_W;
  const gaps = Math.max(1, GYM_BANNER.PATCH_COUNT - 1);
  const patchTop = top + Math.round((GYM_BANNER.ROWS * GYM_BANNER.STRIPE_FRAC - GYM_BANNER.PATCH_H) / 2);
  for (let i = 0; i < GYM_BANNER.PATCH_COUNT; i += 1) {
    const x = Math.round(inset + (span * i) / gaps);
    fillRect(g, x, patchTop, GYM_BANNER.PATCH_W, GYM_BANNER.PATCH_H, GYM.WALL_LIGHT);
  }
}

// ---------------------------------------------------------------------------
// Layer: the floor and the platform
// ---------------------------------------------------------------------------

function paintFloor(g: IndexGrid, spec: GymSceneSpec): void {
  const junction = junctionRow(spec);
  const depth = floorDepth(spec);
  for (let y = junction; y < spec.h; y += 1) {
    const step = bandAt(GYM_FLOOR_PLAN.BAND_FRACS, (y - junction) / depth);
    const surface = rampAt(GYM_RAMPS.FLOOR, step);
    for (let x = 0; x < spec.w; x += 1) setPx(g, x, y, surface);
  }
}

/** The row the lifting platform's back edge sits on. */
export function platformBackRow(spec: GymSceneSpec): number {
  return junctionRow(spec) + Math.round(floorDepth(spec) * GYM_FLOOR_PLAN.PLATFORM_BACK_F);
}

/** Centre column of the platform at this camera position. */
function platformCentre(spec: GymSceneSpec): number {
  return Math.round(spec.focusX + layerOffset(spec.cameraX, GYM_PARALLAX.FLOOR));
}

/** Half-width of the platform at row `y`, or null above its back edge. */
function platformHalfAt(spec: GymSceneSpec, y: number): number | null {
  const backRow = platformBackRow(spec);
  if (y < backRow) return null;
  const t = (y - backRow) / Math.max(1, spec.h - backRow);
  return lerp(
    spec.w * GYM_FLOOR_PLAN.PLATFORM_BACK_HALF_WF,
    spec.w * GYM_FLOOR_PLAN.PLATFORM_FRONT_HALF_WF,
    t,
  );
}

function paintPlatform(g: IndexGrid, spec: GymSceneSpec): void {
  const backRow = platformBackRow(spec);
  const centre = platformCentre(spec);

  for (let y = backRow; y < spec.h; y += 1) {
    const half = platformHalfAt(spec, y);
    if (half === null) continue;
    const t = (y - backRow) / Math.max(1, spec.h - backRow);
    const plank = rampAt(GYM_RAMPS.WOOD, bandAt(GYM_FLOOR_PLAN.BAND_FRACS, t));
    for (let x = Math.round(centre - half); x <= Math.round(centre + half); x += 1) {
      setPx(g, x, y, plank);
    }
  }

  // The raised back edge of the platform, lit along its top face.
  //
  // DRAWN IN THE WOOD RAMP, NOT IN STEEL, and that is a fix rather than a
  // preference. In steel this band was STEEL_LIT (92) over STEEL_FRAME (58) — and
  // it runs the full width of the platform, straight through the columns the
  // lifter's own legs occupy. His knee sleeves are GEAR_DARK 59 and GEAR_MID
  // 101, so at the bottom of a squat his sleeve sat 0.9 luma off the band behind
  // it and his shin 8.9 off the lit face. The rim percentiles found it; nothing
  // else could. WOOD_LIGHT (136) sits in the one gap the figure's whole ramp
  // leaves below 150 — between GEAR_MID 101 / SKIN_MID 117 / 125 and
  // SINGLET_LIGHT 148 / GEAR_LIGHT 149 — and it is the only value in either gym
  // bank that clears every step of his kit by more than a visible margin.
  const edgeHalf = Math.round(spec.w * GYM_FLOOR_PLAN.PLATFORM_BACK_HALF_WF);
  fillRect(
    g,
    centre - edgeHalf,
    backRow,
    edgeHalf * 2 + 1,
    GYM_FLOOR_PLAN.EDGE_ROWS,
    GYM.WOOD_DARK,
  );
  fillRect(g, centre - edgeHalf, backRow, edgeHalf * 2 + 1, 1, GYM.WOOD_LIGHT);
}

/**
 * The gaps between the boards, drawn AFTER the light pool and in one step down
 * from whatever the board under them ended up being.
 *
 * Drawn with the platform instead, a seam is a fixed colour that the pool then
 * brightens the boards away from: at two steps of pool the seam was 68 luma
 * under its own plank, a black stripe every nine columns straight through the
 * area the lifter's feet land in. One step down keeps a plank line a plank line.
 */
function paintPlanks(g: IndexGrid, spec: GymSceneSpec): void {
  const centre = platformCentre(spec);
  for (let y = platformBackRow(spec); y < spec.h; y += 1) {
    const half = platformHalfAt(spec, y);
    if (half === null) continue;
    for (let x = Math.round(centre - half); x <= Math.round(centre + half); x += 1) {
      if (Math.abs(x - centre) % GYM_FLOOR_PLAN.PLANK_COLS !== 0) continue;
      setPx(g, x, y, dimIndex(getPx(g, x, y)));
    }
  }
}

// ---------------------------------------------------------------------------
// Layer: light
// ---------------------------------------------------------------------------

/**
 * The pool of light on the platform.
 *
 * Follows the FOCUS, not the camera: the lamp a lifter is standing under moves
 * with the lifter. Two hard steps rather than a falloff, because a BG layer
 * could not draw a falloff and a dithered one at this size reads as dirt.
 */
function paintLightPool(g: IndexGrid, spec: GymSceneSpec): void {
  const junction = junctionRow(spec);
  const halfW = spec.w * GYM_LIGHTING.POOL_HALF_WF;
  const halfH = floorDepth(spec) * GYM_LIGHTING.POOL_DEPTH_F;
  for (let y = junction; y < spec.h; y += 1) {
    for (let x = 0; x < spec.w; x += 1) {
      const nx = (x - spec.focusX) / halfW;
      const ny = (y - spec.floorRow) / halfH;
      const r = Math.sqrt(nx * nx + ny * ny);
      if (r >= 1) continue;
      const steps = GYM_LIGHTING.POOL_STEPS - Math.floor(r * GYM_LIGHTING.POOL_STEPS);
      setPx(g, x, y, stepIndex(getPx(g, x, y), steps));
    }
  }
}

/** Where each ceiling lamp hangs, in scene pixels. */
export function lampColumns(spec: GymSceneSpec): readonly number[] {
  const inset = spec.w * GYM_LIGHTING.LAMP_INSET_F;
  const span = spec.w - inset * 2;
  const gaps = Math.max(1, GYM_LIGHTING.LAMP_COUNT - 1);
  const shift = layerOffset(spec.cameraX, GYM_PARALLAX.WALL);
  const out: number[] = [];
  for (let i = 0; i < GYM_LIGHTING.LAMP_COUNT; i += 1) {
    out.push(Math.round(inset + (span * i) / gaps) + shift);
  }
  return out;
}

/** The wash each lamp throws down the wall behind it. */
function paintWallWash(g: IndexGrid, spec: GymSceneSpec): void {
  const junction = junctionRow(spec);
  const lampBottom = GYM_LIGHTING.LAMP_ROW + PROP_ART.CEILING_LAMP.H;
  for (const cx of lampColumns(spec)) {
    for (let dy = 0; dy < GYM_LIGHTING.WASH_ROWS; dy += 1) {
      const y = lampBottom + dy;
      if (y >= junction) break;
      const half = Math.round(lerp(1, GYM_LIGHTING.WASH_HALF_W, dy / GYM_LIGHTING.WASH_ROWS));
      for (let x = cx - half; x <= cx + half; x += 1) {
        setPx(g, x, y, stepIndex(getPx(g, x, y), 1));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Layer: props
// ---------------------------------------------------------------------------

/**
 * Top-left corner a prop's box is drawn at.
 *
 * A `floor` prop is pinned by its BASE — the row it stands on — because that is
 * the only edge of it that has to agree with anything. A `ceiling` prop is
 * pinned by its top, for the same reason from the other end.
 */
export function propOrigin(
  spec: GymSceneSpec,
  art: PropArt,
  placement: GymPropPlacement,
): { readonly x: number; readonly y: number } {
  const rate =
    placement.DEPTH <= GYM_PARALLAX.FAR_DEPTH ? GYM_PARALLAX.PROPS_FAR : GYM_PARALLAX.PROPS_NEAR;
  const x = Math.round(spec.w * placement.XF) + layerOffset(spec.cameraX, rate);
  if (art.ANCHOR === 'ceiling') return { x, y: GYM_LIGHTING.LAMP_ROW };
  const base = Math.round(lerp(junctionRow(spec), spec.floorRow, placement.DEPTH));
  return { x, y: base - art.H };
}

function stampProp(
  g: IndexGrid,
  art: PropArt,
  x0: number,
  y0: number,
  dim: boolean,
): void {
  for (const [rx, ry, rw, rh, index] of art.RECTS) {
    fillRect(g, x0 + rx, y0 + ry, rw, rh, dim ? dimIndex(index) : index);
  }
}

/**
 * The columns a prop actually TOUCHES THE FLOOR ON, read off the bottom row of
 * its own drawing.
 *
 * Derived rather than authored, so a plate tree's shadow is its base plate and
 * not its bounding box, a kettlebell row throws three shadows instead of one,
 * and `PROP_ART` cannot forget to declare one. Returned as spans so the shadow
 * has the gaps the object has.
 */
export function propFootprint(art: PropArt): readonly (readonly [number, number])[] {
  const bottom = art.H - 1;
  const on = new Array<boolean>(art.W).fill(false);
  for (const [rx, ry, rw, rh] of art.RECTS) {
    if (ry > bottom || ry + rh <= bottom) continue;
    for (let x = Math.max(0, rx); x < Math.min(art.W, rx + rw); x += 1) on[x] = true;
  }
  const spans: [number, number][] = [];
  let start = -1;
  for (let x = 0; x <= art.W; x += 1) {
    if (x < art.W && on[x] === true) {
      if (start === -1) start = x;
    } else if (start !== -1) {
      spans.push([start, x - 1]);
      start = -1;
    }
  }
  return spans;
}

/**
 * Darken the floor under a prop, in the room's own ramp.
 *
 * Same mechanism as `contactShadowPatch` does for the figure and for the same
 * reason: a fixed dark index is a hole on a 136-luma platform and invisible on
 * 17-luma rubber, so the shadow is made of the surface it falls on. Drawn from
 * the row the prop stands on FORWARD, because the key light is high and the
 * shadow pools toward the viewer.
 *
 * Ceiling-anchored props do not stand on anything and get nothing.
 *
 * ---------------------------------------------------------------------------
 * HOW FAR DOWN: TWO RULES, AND THE PLATFORM IS THE ONLY SURFACE THAT PASSES
 * ---------------------------------------------------------------------------
 * The room's ramps are not evenly spaced, so a fixed number of rungs is a
 * different shadow on every surface: one rung is 50.5 luma on the lit platform
 * and 8.89 on mid rubber. So the depth is chosen by rule instead — step down
 * until the drop is worth drawing, and stop as soon as it is:
 *
 *   1. VISIBLE. The drop must reach `PERCEPTIBLE_LUMA_STEP`, or the mark is one
 *      this piece has itself declared invisible.
 *   2. CLEAR OF THE SUBJECT. The result must stay `PERCEPTIBLE_LUMA_STEP` above
 *      the darkest step the FIGURE AND BARBELL are drawn in — the equipment
 *      keyline at luma 8.91. A shadow darker than that is a piece of room in the
 *      band the subject's own outline occupies.
 *
 * ...and never more than `PROP_MAX_STEPS` rungs either way.
 *
 * ---------------------------------------------------------------------------
 * WHICH MEANS THE RUBBER GETS NO SHADOW, AND THAT IS A MEASURED REFUSAL
 * ---------------------------------------------------------------------------
 * `FLOOR_MID` (33.91) has exactly two rungs under it. `FLOOR_DARK` (25.03) is
 * 8.89 below it, which fails rule 1. `FLOOR_DEEP` (16.91) is 17.00 below it,
 * which passes rule 1 and fails rule 2 by 1.00 luma — it is 8.00 from the
 * barbell's keyline, and the sleeves cross those rows at every depth of the
 * rep. There is no index in the GYM_FLOOR bank in the 18.91-23.91 window that
 * would satisfy both, and the bank is full.
 *
 * That is not theory. Shipping the `FLOOR_DEEP` version was measured, twice:
 * `rimContrast.p25` on the descent frame fell from 22.15 to 20.19 with one row
 * of shadow and to 19.37 with two, against a floor of 20. Grounding the
 * furniture on the rubber costs the readability clause a real, shipped frame, so
 * it is not drawn there and the number is written down instead of the shadow.
 *
 * What it costs artistically is stated too: the five props standing on rubber
 * still meet the floor with nothing under them. Fixing that needs a rubber
 * shadow rung in the palette (no free slot) or the barbell's sleeves out of the
 * props' columns (a wider `GYM_CLEAR_BAND`, which moves the furniture). Both are
 * bigger than this change.
 */
const SUBJECT_DARKEST_LUMA = Math.min(
  lumaOfIndex(PAL.EQ_OUTLINE) ?? 0,
  lumaOfIndex(PAL.OUTLINE) ?? 0,
);

function propShadowIndex(under: number): number | null {
  for (let steps = 1; steps <= GYM_CONTACT_SHADOW.PROP_MAX_STEPS; steps += 1) {
    const shaded = stepIndex(under, -steps);
    const shadedLuma = lumaOfIndex(shaded) ?? 0;
    const drop = (lumaOfIndex(under) ?? 0) - shadedLuma;
    if (drop < GYM_READABILITY.PERCEPTIBLE_LUMA_STEP) continue;
    if (shadedLuma - SUBJECT_DARKEST_LUMA < GYM_READABILITY.PERCEPTIBLE_LUMA_STEP) return null;
    return shaded;
  }
  return null;
}

function stampPropShadow(g: IndexGrid, art: PropArt, x0: number, baseRow: number): void {
  if (art.ANCHOR !== 'floor') return;
  const { PROP_ROWS, PROP_SPREAD } = GYM_CONTACT_SHADOW;
  for (const [a, b] of propFootprint(art)) {
    for (let dy = 0; dy < PROP_ROWS; dy += 1) {
      const y = baseRow + dy;
      if (y < 0 || y >= g.h) continue;
      for (let x = x0 + a - PROP_SPREAD; x <= x0 + b + PROP_SPREAD; x += 1) {
        if (x < 0 || x >= g.w) continue;
        const shaded = propShadowIndex(getPx(g, x, y));
        if (shaded === null) continue;
        setPx(g, x, y, shaded);
      }
    }
  }
}

/** The rows a prop's contact shadow occupies, for the reservation check. */
export function propShadowRows(art: PropArt): number {
  return art.ANCHOR === 'floor' ? GYM_CONTACT_SHADOW.PROP_ROWS : 0;
}

/** The furniture this spec draws: its own list if it has one, else the venue's. */
export function sceneProps(spec: GymSceneSpec): readonly GymPropPlacement[] {
  return spec.props ?? GYM_VENUE_PROPS[spec.venue];
}

function paintProps(g: IndexGrid, spec: GymSceneSpec): void {
  // Every shadow first, then every prop. Otherwise a near prop's shadow lands on
  // top of the far prop it overlaps, which is a shadow floating in mid air.
  for (const placement of sceneProps(spec)) {
    const art = PROP_ART[placement.ART];
    const origin = propOrigin(spec, art, placement);
    stampPropShadow(g, art, origin.x, origin.y + art.H);
  }
  for (const placement of sceneProps(spec)) {
    const art = PROP_ART[placement.ART];
    const origin = propOrigin(spec, art, placement);
    stampProp(g, art, origin.x, origin.y, placement.DIM);
  }
}

function paintLamps(g: IndexGrid, spec: GymSceneSpec): void {
  const art = PROP_ART.CEILING_LAMP;
  for (const cx of lampColumns(spec)) {
    stampProp(g, art, cx - Math.floor(art.W / 2), GYM_LIGHTING.LAMP_ROW, false);
  }
}

function paintApron(g: IndexGrid, spec: GymSceneSpec): void {
  fillRect(g, 0, spec.h - GYM_ROOM.APRON_ROWS, spec.w, GYM_ROOM.APRON_ROWS, GYM.FLOOR_DEEP);
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------

/**
 * Render one room. Deterministic: same spec, same bytes, every time.
 *
 * Layer order is the order a background painter would work in, and two steps of
 * it are load-bearing rather than conventional:
 *
 *   - the light pool runs AFTER the platform and BEFORE the props, so the lamp
 *     lights the floor the lifter stands on and does not light the equipment
 *     standing on it. A rack brightened by a floor lamp is a rack that competes
 *     with the figure.
 *   - the apron runs after the pool, so the bottom edge of the frame stays dark
 *     whatever the lighting does. It is the only thing in front of the figure
 *     and it is three rows of shadow below his feet.
 */
export function renderGymScene(spec: GymSceneSpec): IndexGrid {
  const g = createGrid(spec.w, spec.h, GYM.WALL_DEEP);
  paintWall(g, spec);
  paintCrowd(g, spec);
  paintWallWash(g, spec);
  paintFloor(g, spec);
  paintPlatform(g, spec);
  paintLightPool(g, spec);
  paintPlanks(g, spec);
  paintApron(g, spec);
  paintProps(g, spec);
  paintLamps(g, spec);
  return g;
}

// ---------------------------------------------------------------------------
// Compositing
// ---------------------------------------------------------------------------

/**
 * Paint `over` onto `base` at `(dx, dy)`, skipping transparent indices.
 *
 * `raster.ts`'s `compositeOver` needs both grids the same size, which a figure
 * and a room never are. This is the same rule at an offset, and it is what the
 * readability measurement composites with — so what gets measured is the pixels
 * the screen shows, not two layers reasoned about separately.
 */
export function blitOver(base: IndexGrid, over: IndexGrid, dx: number, dy: number): IndexGrid {
  for (let y = 0; y < over.h; y += 1) {
    for (let x = 0; x < over.w; x += 1) {
      const v = getPx(over, x, y);
      if (isTransparentIndex(v)) continue;
      setPx(base, x + dx, y + dy, v);
    }
  }
  return base;
}

/** Where the lifter's sprite cell sits inside the lift stage's scene. */
export const LIFT_SPRITE_ORIGIN = Object.freeze({
  x: GYM_LIFT_STAGE.SPRITE_X,
  y: GYM_LIFT_STAGE.SPRITE_Y,
});

/**
 * The shadow this frame's lifter throws, as a mask.
 *
 * A one-line bridge, and it lives here rather than in `lifterSprite.ts` because
 * of what it is FOR: `renderContactShadow` has existed since A1 and, until now,
 * was called only by an offline contact-sheet tool and by unit tests. On the
 * shipped stage the lifter stood on a 136-luma platform with nothing under his
 * feet. Grounding a figure is a property of the composite, not of the sprite, so
 * the composite is where the call belongs.
 *
 * The pose is rebuilt from the frame spec by the same three steps
 * `renderLifterFrame` uses, rather than by rasterising the sprite a second time
 * to read the pose off the result.
 */
export function liftContactShadow(spec: LifterFrameSpec): IndexGrid {
  const pose = deformPose(
    poseAtDepth(spec.depth, spec.direction),
    strainForLevel(spec.strainLevel),
    pitchForLevel(spec.pitchLevel ?? 0),
  );
  return renderContactShadow(pose, spec.depth);
}

/**
 * Darken `base` wherever `mask` is opaque, by `steps` rungs of the room's own
 * ramps, and return ONLY the affected box.
 *
 * This is how the contact shadow reaches the composite. It is a patch rather
 * than a whole re-render because the room is a constant built once at module
 * load and the shadow is not: the shadow changes shape every time the lifter
 * changes depth, and rasterising 22,490 pixels to darken 300 of them would undo
 * the reason the room is a constant in the first place.
 *
 * The patch's pixels are the ROOM'S OWN INDICES stepped down, so the shadow is
 * made of the surface it falls on and the scene never gains a colour. Pixels the
 * mask does not cover are left transparent, so the patch composites like any
 * other sprite. Returns null when the mask is empty or lands entirely off-grid.
 */
export function contactShadowPatch(
  base: IndexGrid,
  mask: IndexGrid,
  dx: number,
  dy: number,
  steps: number,
): { readonly grid: IndexGrid; readonly x: number; readonly y: number } | null {
  let x0 = base.w;
  let x1 = -1;
  let y0 = base.h;
  let y1 = -1;
  for (let y = 0; y < mask.h; y += 1) {
    for (let x = 0; x < mask.w; x += 1) {
      if (isTransparentIndex(getPx(mask, x, y))) continue;
      const bx = x + dx;
      const by = y + dy;
      if (bx < 0 || by < 0 || bx >= base.w || by >= base.h) continue;
      if (bx < x0) x0 = bx;
      if (bx > x1) x1 = bx;
      if (by < y0) y0 = by;
      if (by > y1) y1 = by;
    }
  }
  if (x1 < x0 || y1 < y0) return null;
  const grid = createGrid(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = 0; y < mask.h; y += 1) {
    for (let x = 0; x < mask.w; x += 1) {
      if (isTransparentIndex(getPx(mask, x, y))) continue;
      const bx = x + dx;
      const by = y + dy;
      if (bx < x0 || by < y0 || bx > x1 || by > y1) continue;
      setPx(grid, bx - x0, by - y0, stepIndex(getPx(base, bx, by), -steps));
    }
  }
  return { grid, x: x0, y: y0 };
}

/**
 * The boxes of the room the screen paints over, in SCENE pixels.
 *
 * `GYM_STAGE_CHROME` authors the bar-path panel in screen points because that is
 * the space `LiftStage.tsx` lays it out in. This is the conversion, and it is
 * conservative in the direction that matters: a scene pixel counts as hidden
 * only once the chrome covers more than `OCCLUSION_COVERAGE_MIN` of it, so a
 * pixel showing a sliver is still counted as room.
 */
export function liftStageOccluders(): readonly SceneRect[] {
  const S = GYM_LIFT_STAGE;
  const C = GYM_STAGE_CHROME;
  // A scene pixel `i` spans screen points [origin + i*SCALE, origin + (i+1)*SCALE).
  // It is hidden when the chrome covers more than OCCLUSION_COVERAGE_MIN of that
  // span, on each axis independently — which at 0.5 is the ordinary
  // pixel-centre rule and is why the threshold is named rather than rounded.
  const first = (edge: number, origin: number): number =>
    Math.floor((edge - origin) / S.SCALE + C.OCCLUSION_COVERAGE_MIN - 1) + 1;
  const last = (edge: number, origin: number): number =>
    Math.ceil((edge - origin) / S.SCALE - C.OCCLUSION_COVERAGE_MIN) - 1;
  const rect: SceneRect = {
    x0: Math.max(0, first(C.PANEL_X, S.ORIGIN_X)),
    x1: Math.min(S.W - 1, last(C.PANEL_X + C.PANEL_W, S.ORIGIN_X)),
    y0: Math.max(0, first(C.PANEL_TOP, S.ORIGIN_Y)),
    y1: Math.min(S.H - 1, last(C.PANEL_BOTTOM, S.ORIGIN_Y)),
  };
  return rect.x1 < rect.x0 || rect.y1 < rect.y0 ? [] : [rect];
}

// ---------------------------------------------------------------------------
// The reserved band
// ---------------------------------------------------------------------------

export interface SceneRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/**
 * The columns and rows no prop may be drawn into — the hole the figure stands
 * in. Authored in `GYM_CLEAR_BAND`; checked against the figure's real rendered
 * silhouette by `gymScene.test.ts`, so it cannot drift away from the thing it
 * is protecting.
 */
export function clearBand(spec: GymSceneSpec, lifterHeightPx: number): SceneRect {
  const half = spec.w * GYM_CLEAR_BAND.HALF_WF;
  return {
    x0: Math.round(spec.focusX - half),
    x1: Math.round(spec.focusX + half),
    y0: Math.round(spec.floorRow - lifterHeightPx * GYM_CLEAR_BAND.HEIGHT_F),
    y1: spec.floorRow,
  };
}

/**
 * The box a placed prop's drawing occupies, for overlap checks.
 *
 * Includes its contact shadow rows. A shadow is pixels the prop puts in the room
 * exactly like its own steel is, so the reserved hole has to see them or the
 * reservation is protecting the wrong rectangle.
 */
export function propBox(spec: GymSceneSpec, placement: GymPropPlacement): SceneRect {
  const art = PROP_ART[placement.ART];
  const origin = propOrigin(spec, art, placement);
  return {
    x0: origin.x,
    y0: origin.y,
    x1: origin.x + art.W - 1,
    y1: origin.y + art.H - 1 + propShadowRows(art),
  };
}

export function rectsOverlap(a: SceneRect, b: SceneRect): boolean {
  return a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
}
