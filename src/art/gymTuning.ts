/**
 * GYM_TUNING — every hand-turnable number in the environment layer.
 *
 * CLAUDE.md: "Keep every such value as a named constant in one place. Never
 * scatter them as magic numbers across components." This is that place for the
 * gym. `gymScene.ts` contains no bare number at all; it reads everything here,
 * the palette indices from `gymPalette.ts`, and the prop drawings from
 * `gymProps.ts`.
 *
 * Registered in `src/tuning/audit.ts` as `kind: 'feel'` and re-exported from
 * `src/tuning/index.ts` as `TUNING.gym`, so a playtester opening the one place
 * can reach every value below.
 *
 * ---------------------------------------------------------------------------
 * WHAT SPLITS THIS FILE FROM `gymProps.ts`
 * ---------------------------------------------------------------------------
 * Same split `spriteTuning.ts` makes against `rig.ts`: a knob is a value that
 * can be turned ON ITS OWN and immediately looked at. How dark the back of the
 * room is, how far apart the lamps hang, how much of the frame the platform
 * takes, where the bench sits — all knobs. The seventh rectangle of a power
 * rack is not; it is part of a drawing, and moving it alone breaks the drawing.
 *
 * ---------------------------------------------------------------------------
 * NONE OF THESE HAVE BEEN PLAYED, AND ONE CLASS OF THEM CANNOT BE JUDGED HERE
 * ---------------------------------------------------------------------------
 * GDD §12.1 budgets roughly 30 hand passes over values like these. Two things
 * in particular are starting points and are called out as such:
 *
 *   - PARALLAX. Nothing in the shipped screens pans the camera, so every rate
 *     in `GYM_PARALLAX` is exercised by tests and by the offline tool and by
 *     nothing a player has seen. They are here because the layer separation is
 *     real and a panning meet-day walkout is the obvious consumer.
 *   - PROP PLACEMENT. Composition at 390x844 is a looking judgement. What the
 *     suite can check is that a prop does not land behind the figure and that
 *     the room does not out-contrast it; whether the room looks GOOD is not
 *     something a test says, and this file does not claim it.
 */

import { RESOLUTION, CENTER_X } from './spriteTuning';
import type { GymPropKind } from './gymProps';

/** Which room a scene is drawn as. */
export type GymVenue = 'training-gym' | 'meet-platform';

/**
 * One authored prop placement.
 *
 * `XF` is the LEFT EDGE of the prop as a fraction of scene width, and `DEPTH`
 * is how far forward it stands: 0 puts its base on the wall/floor junction at
 * the back of the room, 1 puts it on the row the lifter's own feet are on.
 * Fractions rather than pixels so the same table composes at any scene size —
 * the daily session's stage and whatever meet day ends up being are not the
 * same shape, and a table of absolute pixels would only ever fit one of them.
 *
 * `DIM` steps every colour in the drawing one rung darker (`GYM_DIM_STEP`). It
 * is the depth cue, and it is the one that survives being looked at on a phone:
 * a rack twenty feet further back is the same rack in darker paint.
 */
export interface GymPropPlacement {
  readonly ART: GymPropKind;
  readonly XF: number;
  readonly DEPTH: number;
  readonly DIM: boolean;
}

// ---------------------------------------------------------------------------
// The room's proportions
// ---------------------------------------------------------------------------

/**
 * Where the wall stops and the floor starts, and how the floor recedes.
 *
 * A flat elevation with a floor in front of it, which is what
 * `sprite-ref-1-snes-wrestling.png` does with its crowd and its mat, and what
 * every 16-bit sports game did: one BG layer painted as a back wall, the
 * playfield in front of it, no vanishing point. Perspective here is entirely
 * value and overlap, because a hardware BG layer had no other way to say it and
 * because a drawn vanishing point at 130 px across reads as a mistake.
 */
export const GYM_ROOM = Object.freeze({
  /**
   * The wall/floor junction, as a fraction of the distance from the top of the
   * scene down to the row the lifter stands on. Lower puts the horizon behind
   * his knees and makes the room feel small; higher pushes the back wall away.
   */
  JUNCTION_FRAC: 0.72,
  /** Rows of pure shadow along the very bottom edge, framing the composition. */
  APRON_ROWS: 3,
});

/**
 * The back wall.
 *
 * Painted concrete block, banded rather than graduated. A smooth vertical
 * gradient is the loudest "this was generated" tell available in a background,
 * because the hardware could not draw one — a BG layer had 15 colours and an
 * artist spent them on bands.
 */
export const GYM_WALL_PAINT = Object.freeze({
  /**
   * Fractions of the wall's height at which it steps to the next ramp entry,
   * top to bottom. Two entries against a three-step ramp: deep at the top,
   * dark through the middle, mid where the bounced light off the floor reaches.
   */
  BAND_FRACS: Object.freeze([0.36, 0.74]),
  /** Rows between block-course mortar lines. */
  COURSE_ROWS: 7,
  /** Columns between the staggered vertical joints in each course. */
  JOINT_COLS: 17,
  /** Vertical joints are offset by this many columns on alternate courses. */
  JOINT_STAGGER: 8,
  /** The painted band, as a fraction of wall height, and how tall it is. */
  STRIPE_FRAC: 0.58,
  STRIPE_ROWS: 4,
  /** Rows of roof steel across the very top. */
  TRUSS_ROWS: 2,
  /**
   * The kickplate where the wall meets the floor.
   *
   * The only hard edge the wall is allowed, and it earns it: without a line at
   * the junction the room is a backdrop the figure floats in front of rather
   * than a floor he stands on.
   */
  SKIRT_ROWS: 2,
});

/**
 * Clerestory windows — the high strip of glass every warehouse gym has.
 *
 * They exist to give the top third of the frame something to be, and they are
 * placed high on purpose: a window is the second brightest thing in the room
 * after the lamp filament, so it goes as far from the figure as the wall
 * allows. Nothing about the composition depends on them; setting COUNT to 0
 * leaves a bare wall and everything else still works.
 */
export const GYM_WINDOWS = Object.freeze({
  COUNT: 4,
  /** Top of the glass, as a fraction of wall height. */
  TOP_FRAC: 0.1,
  W: 15,
  H: 9,
  /** Fraction of the scene width the window row is inset by at each end. */
  INSET_F: 0.06,
  /** Columns between the mullions inside a window. */
  MULLION_COLS: 5,
});

/**
 * The floor, the platform, and the light on them.
 *
 * `PLATFORM_*` half-widths are fractions of the scene width, measured from the
 * FOCUS column — the column the lifter actually stands on, which is not the
 * middle of the scene on any screen that has a panel down one side.
 */
export const GYM_FLOOR_PLAN = Object.freeze({
  /**
   * Fractions of the floor's depth at which the rubber steps value.
   *
   * Front-loaded, and MEASURED rather than eyeballed. At an even [0.22, 0.5,
   * 0.78] the twelve rows directly under the wall were FLOOR_DEEP (luma 17) and
   * the fifteen under those were FLOOR_DARK (25) — and those are exactly the
   * rows the barbell's discs cross at every depth of the rep. The lifter's own
   * two keylines are luma 9 (equipment) and 19 (body), so a 17-luma floor put 8
   * luma between a disc's outline and the room, and 2.4 between the lifter's
   * outline and the room. The silhouette dissolved into the back of the floor,
   * and the rim percentiles said so.
   *
   * FLOOR_MID (34) clears the equipment keyline by 25 and the body keyline by
   * 15, and is still 15 under the bottom of the figure's own value band. So the
   * recession happens in the first six rows — which is what a shadow at the base
   * of a wall looks like anyway — and the rest of the rubber is the value the
   * figure can be seen against.
   */
  BAND_FRACS: Object.freeze([0.01, 0.03, 0.85]),
  /**
   * Where the platform's back edge sits, as a fraction of floor depth.
   *
   * Moved back from 0.36 after measuring: at 0.36 the steel edge band landed on
   * exactly the row the barbell's discs reach at the bottom of a squat, and the
   * shade half of a red disc (luma 49) sat on the shaded plank behind it (52)
   * with three luma between them. The band is now clear of the bar's travel.
   */
  PLATFORM_BACK_F: 0.52,
  /** Platform half-width at its back edge and at the bottom of the frame. */
  PLATFORM_BACK_HALF_WF: 0.26,
  PLATFORM_FRONT_HALF_WF: 0.34,
  /** Columns per plank, and the seam drawn between them. */
  PLANK_COLS: 9,
  /** Rows of steel edge banding along the platform's back edge. */
  EDGE_ROWS: 2,
});

/**
 * Lighting.
 *
 * One warm key from above, matching `SHADING.LIGHT_DIR`'s upper-left lamp on
 * the figure, plus a pool on the platform. The pool is doing real work rather
 * than decorating: the lifter's GEAR ramp bottoms out at luma 59 and his shoes
 * are drawn in it, so without a pale surface under him the contact between
 * shoe and floor is two dark shapes touching (see meet-photo-ref-1, where the
 * black shoes read only because the platform is pale).
 */
export const GYM_LIGHTING = Object.freeze({
  /** Ceiling lamps, evenly spaced across the scene. */
  LAMP_COUNT: 3,
  /** Rows from the top of the scene to the lamp's stem. */
  LAMP_ROW: 1,
  /** Fraction of the scene width the lamp row is inset by at each end. */
  LAMP_INSET_F: 0.16,
  /** The wash each lamp throws on the wall: half-width and depth, in rows. */
  WASH_HALF_W: 13,
  WASH_ROWS: 16,
  /** The pool on the floor, as fractions of scene width and floor depth. */
  POOL_HALF_WF: 0.3,
  POOL_DEPTH_F: 0.42,
  /**
   * How far up the pool's edge is feathered, in ramp steps. 1 is a single hard
   * step, which is what a BG layer could do; 2 gives a two-step falloff.
   */
  POOL_STEPS: 2,
});

/**
 * How fast each layer slides under a camera move.
 *
 * UNEXERCISED BY ANY SHIPPED SCREEN TODAY, and said plainly rather than left to
 * be discovered: the daily session's stage does not pan, so every scene it
 * draws is at `cameraX` 0 and every rate below is multiplied by nothing. They
 * exist because the layer split is real and because a meet-day walkout is the
 * obvious first consumer.
 *
 * Rates are fractions of the camera's own movement: the wall barely moves, the
 * floor moves nearly with the camera.
 */
export const GYM_PARALLAX = Object.freeze({
  WALL: 0.15,
  PROPS_FAR: 0.35,
  FLOOR: 0.75,
  PROPS_NEAR: 0.9,
  /** Depth at or below which a prop counts as far, for the rates above. */
  FAR_DEPTH: 0.3,
});

// ---------------------------------------------------------------------------
// What is in the room
// ---------------------------------------------------------------------------

/**
 * The training gym (GDD §3.2's daily session).
 *
 * Composed around a hole. `GYM_CLEAR_BAND` below reserves the columns the
 * lifter's own body occupies, and nothing in this table is allowed to land in
 * it — `gymScene.test.ts` checks that against the figure's REAL rendered
 * bounding box rather than against the authored band, so the reservation
 * cannot quietly drift away from the figure it is protecting.
 */
export const GYM_PROPS_TRAINING: readonly GymPropPlacement[] = Object.freeze([
  // The rack runs off the left edge of the frame on purpose. A room whose
  // furniture all fits inside the viewport is a diorama; one that is cut by the
  // frame carries on past it.
  Object.freeze({ ART: 'POWER_RACK' as const, XF: -0.05, DEPTH: 0.0, DIM: false }),
  Object.freeze({ ART: 'BUMPER_STACK' as const, XF: 0.1, DEPTH: 0.16, DIM: false }),
  Object.freeze({ ART: 'CHALK_STAND' as const, XF: 0.08, DEPTH: 0.64, DIM: false }),
  Object.freeze({ ART: 'KETTLEBELL_ROW' as const, XF: 0.0, DEPTH: 0.86, DIM: false }),
  // ---------------------------------------------------------------------
  // THE RIGHT-HAND GROUP, PULLED BACK OUT FROM BEHIND THE BAR-PATH PANEL.
  //
  // These four used to sit at XF 0.57 / 0.62 / 0.68 / 0.71, which on the lift
  // stage put the dumbbell rack 73% behind the panel, the loaded bar 62% and
  // the bench 32%. None of that showed on any screen, and the measurement was
  // counting all of it, so the busy half of the room was also the invisible
  // half. `GYM_STAGE_CHROME` now names the panel and the readability numbers
  // ignore what is under it; these placements are the other half of that fix —
  // the furniture moved to where the frame actually is.
  //
  // Ordered back to front, so a nearer prop overlaps a further one rather than
  // the other way round. They deliberately still run past the panel's left edge:
  // a gym does not stop at the edge of the viewport.
  Object.freeze({ ART: 'DUMBBELL_RACK' as const, XF: 0.57, DEPTH: 0.02, DIM: true }),
  Object.freeze({ ART: 'PLATE_TREE' as const, XF: 0.66, DEPTH: 0.06, DIM: false }),
  // Undimmed, unlike before. At DEPTH 0.34 the bench stands on rubber the floor
  // re-banding put at luma 34, and `dimIndex` takes its steel from 58 to 25 —
  // nine luma off the floor behind it, which is a bench nobody can see. A prop
  // in the middle of the room is not a far prop.
  Object.freeze({ ART: 'FLAT_BENCH' as const, XF: 0.56, DEPTH: 0.34, DIM: false }),
  Object.freeze({ ART: 'LOADED_BAR' as const, XF: 0.56, DEPTH: 0.72, DIM: false }),
]);

/**
 * The meet platform (GDD §6). Built for whoever puts the attempt loop on
 * screen: same layer stack, different furniture. The room goes darker and
 * emptier, the crowd band replaces the block wall, and the equipment that says
 * "training" — dumbbells, kettlebells, a chalk stand — is gone, because none of
 * it is on a competition platform.
 */
export const GYM_PROPS_MEET: readonly GymPropPlacement[] = Object.freeze([
  Object.freeze({ ART: 'JUDGE_TABLE' as const, XF: 0.0, DEPTH: 0.2, DIM: false }),
  Object.freeze({ ART: 'EQUIPMENT_CASE' as const, XF: 0.78, DEPTH: 0.06, DIM: true }),
  Object.freeze({ ART: 'PLATE_TREE' as const, XF: 0.88, DEPTH: 0.12, DIM: true }),
  Object.freeze({ ART: 'BUMPER_STACK' as const, XF: 0.66, DEPTH: 0.02, DIM: true }),
]);

/**
 * Venue overrides.
 *
 * A meet hall is not a gym with different furniture in it — it is darker, the
 * back wall is a crowd rather than a painted block, and the platform is the
 * only lit thing in the building. These are the three levers that produce that
 * without a second renderer.
 */
export const GYM_VENUE = Object.freeze({
  'training-gym': Object.freeze({
    /** Ramp steps the whole wall is pushed down by. */
    WALL_STEP_BIAS: 0,
    /** Draw block courses, the painted stripe and the high windows. */
    BLOCK_WALL: true,
    /** Draw the seated crowd band and the sponsor banner above it. */
    CROWD: false,
    /** Rows of crowd, measured up from the junction. */
    CROWD_ROWS: 0,
  }),
  'meet-platform': Object.freeze({
    WALL_STEP_BIAS: 0,
    BLOCK_WALL: false,
    CROWD: true,
    CROWD_ROWS: 30,
  }),
});

/**
 * The seated crowd behind a meet platform.
 *
 * Drawn the way `sprite-ref-1`'s crowd is: a dark mass with a repeating row of
 * slightly lit heads, held to the bottom of the value range so the busiest area
 * of the screen is also the quietest one. No individual spectators, because at
 * this scale an individual spectator is four pixels and four pixels of person
 * is noise.
 */
export const GYM_CROWD = Object.freeze({
  /** Columns between heads in a row. */
  HEAD_COLS: 7,
  /** Rows between successive rows of seating. */
  ROW_PITCH: 6,
  /** Heads on alternate rows are offset by this many columns. */
  ROW_STAGGER: 3,
  /** Head width and height, in pixels. */
  HEAD_W: 3,
  HEAD_H: 3,
  /** Rows of shoulder under each head. */
  SHOULDER_ROWS: 2,
  /** The barrier rail across the front of the seating. */
  RAIL_ROWS: 2,
});

/**
 * The printed backdrop a meet is lifted in front of.
 *
 * A full-width printed board is the single thing that says "competition" rather
 * than "gym". It is placed ABOVE the crowd and well above the lifter's crown on
 * purpose: it is the brightest large surface in either venue, and it has no
 * business being behind the figure.
 *
 * ---------------------------------------------------------------------------
 * IT CARRIES NO IDENTITY, AND CANNOT (GDD §12.3, §7.3)
 * ---------------------------------------------------------------------------
 * This is the single most likely place in the whole app for a real federation
 * or sponsor mark to arrive, because a real one is what a backdrop looks like.
 * So it is stated rather than left to discipline:
 *
 *   - `PATCH_*` are BLANK COLOUR BLOCKS. Nine pixels by six, one flat index, no
 *     glyphs. They are the rhythm of a printed board seen from twenty metres,
 *     and they are not placeholders waiting for a logo.
 *   - `STRIPE_*` is a band of the room's own warm paint. It is not any body's
 *     colours and is not named after one.
 *   - The renderer has NO TEXT PATH AT ALL — no font, no glyph table, no string
 *     in any drawing call. A wordmark here is not forbidden by convention, it is
 *     unreachable, and `gymScene.test.ts` asserts that rather than trusting it.
 *
 * GDD §7.3 puts real wordmarks on Tier 3 surfaces — cut-ins, character select,
 * the shop, the result card. THE ENVIRONMENT IS NOT ONE. If a licensed backdrop
 * is ever wanted it arrives through that system as data, not as an edit here.
 */
export const GYM_BANNER = Object.freeze({
  /** Top of the banner, as a fraction of wall height. */
  TOP_FRAC: 0.3,
  ROWS: 24,
  /** The painted band inside it, and where it sits within the banner. */
  STRIPE_ROWS: 4,
  STRIPE_FRAC: 0.55,
  /** Blank colour blocks along it: how many, how wide, how tall. */
  PATCH_COUNT: 5,
  PATCH_W: 9,
  PATCH_H: 6,
  PATCH_INSET_F: 0.08,
});

/** The prop table for each venue. */
export const GYM_VENUE_PROPS: Readonly<Record<GymVenue, readonly GymPropPlacement[]>> =
  Object.freeze({
    'training-gym': GYM_PROPS_TRAINING,
    'meet-platform': GYM_PROPS_MEET,
  });

// ---------------------------------------------------------------------------
// The hole the figure stands in
// ---------------------------------------------------------------------------

/**
 * Columns and rows no prop may be drawn into.
 *
 * Fractions of scene width, measured from the FOCUS column, and rows measured
 * up from the lifter's own feet as a fraction of his height. This is the single
 * most load-bearing composition rule in the piece: GDD §12.2 judges the gym on
 * readability at phone scale, and the fastest way to lose that is to stand a
 * dark steel rack directly behind a dark-kitted lifter.
 *
 * Checked against the figure's real rendered silhouette, not against itself.
 */
export const GYM_CLEAR_BAND = Object.freeze({
  /** Half-width of the reserved column band, as a fraction of scene width. */
  HALF_WF: 0.17,
  /** How far above the feet the reservation extends, in lifter heights. */
  HEIGHT_F: 1.25,
});

// ---------------------------------------------------------------------------
// The daily session's stage
// ---------------------------------------------------------------------------

/**
 * The scene box behind the lift mechanic, in scene pixels.
 *
 * EVERY NUMBER HERE IS CONSTRAINED BY SOMETHING ELSE, and `gymScene.test.ts`
 * re-derives all of them from `LIFT_TUNING.LAYOUT` and `RESOLUTION` rather than
 * trusting them:
 *
 *   - SCALE matches the sprite's own upscale, or the two pixel grids are
 *     different sizes on the same screen, which is the one thing GDD §7.1's
 *     nearest-neighbour rule exists to prevent.
 *   - ORIGIN_Y is 1, not 0, and that is the whole reason it is written down:
 *     the sprite is drawn at y 292 and 292 is not a multiple of 3, so a scene
 *     at y 0 would put its pixel lattice one point out of phase with the
 *     figure standing on it. At y 1 the two grids share a lattice exactly.
 *   - FLOOR_ROW is the row the sprite's own FLOOR_Y lands on once both are
 *     placed, so the drawn floor and the drawn soles are the same line.
 *   - W and H cover the stage at that scale and no more.
 */
export const GYM_LIFT_STAGE = Object.freeze({
  W: 130,
  H: 173,
  ORIGIN_X: 0,
  ORIGIN_Y: 1,
  SCALE: 3,
  /** Top-left of the sprite cell, in scene pixels. */
  SPRITE_X: 2,
  SPRITE_Y: 97,
  /** The row the lifter's soles rest on. */
  FLOOR_ROW: 165,
});

/**
 * THE CHROME THE SCREEN PAINTS ON TOP OF THE ROOM.
 *
 * ---------------------------------------------------------------------------
 * WHY A BACKGROUND LAYER HAS TO KNOW THIS
 * ---------------------------------------------------------------------------
 * It does not know it in order to DRAW anything — `renderGymScene` is still a
 * layer that has never heard of the lift mechanic. It knows it in order to be
 * MEASURED honestly.
 *
 * `LiftStage.tsx` paints an opaque bar-path panel over the right-hand strip of
 * the canvas, after the room and before the lifter. At `GYM_LIFT_STAGE.SCALE`
 * that panel covers 4160 of the room's 22490 pixels — 18.5% of it — on every
 * single frame. A readability number computed over all 22490 is a number about
 * an image nobody ever sees, and the hidden fifth is not a neutral sample of the
 * room: it is the busy half. The measurement therefore takes an occluder list,
 * and this is where the lift stage's occluder is written down.
 *
 * IN SCREEN POINTS, not scene pixels, because that is the space the chrome is
 * authored in. `liftStageOccluders()` converts. `gymScene.test.ts` asserts every
 * number below against `LIFT_TUNING.LAYOUT` so the two cannot drift apart.
 *
 * NOT A KNOB — moving these does not change how anything looks, it changes what
 * the measurement believes is visible. They are here because they are the
 * screen's geometry and there is one place for the screen's geometry.
 */
export const GYM_STAGE_CHROME = Object.freeze({
  /** The bar-path panel, in screen points: `LIFT_TUNING.LAYOUT.TRACE_*`. */
  PANEL_X: 300,
  PANEL_W: 78,
  PANEL_TOP: 20,
  PANEL_BOTTOM: 500,
  /**
   * How much of a scene pixel an occluder must cover before that pixel counts
   * as hidden. 0.5 — a pixel more than half covered is gone; a pixel less than
   * half covered still shows a sliver. The panel's edges land on scene-pixel
   * boundaries in every direction but one, so this threshold moves the count by
   * 26 pixels out of 4160 and is not doing real work; it is named so the rule is
   * stated rather than left implicit in a rounding.
   */
  OCCLUSION_COVERAGE_MIN: 0.5,
});

/**
 * The contact shadow, where the composite draws it.
 *
 * The SHAPE is `renderContactShadow` in `lifterSprite.ts` and belongs to the
 * figure — it narrows as he descends because the key light is high. What
 * belongs to the room is what the shadow DOES to the surface it lands on, and
 * this is that: how many rungs down the room's own ramp the lit platform goes
 * where he is standing on it.
 *
 * Two rungs rather than a flat black ellipse, on purpose. The platform top is
 * luma 136 and `PAL.CONTACT_SHADOW` is 17; painting that index straight on would
 * put a 119-luma hole in the brightest surface in the room, and would also put a
 * luma-17 shape inside the 9-19 band the lifter's own keyline lives in. Stepping
 * the wood ramp down instead keeps the shadow made of the floor it is on, which
 * is what a BG layer with sixteen colours had to do anyway.
 *
 * UNPLAYED. One rung reads softer, three reads like a hole. Nobody has looked at
 * this on a phone.
 */
export const GYM_CONTACT_SHADOW = Object.freeze({
  STEPS: 2,
});

/** Column the room is composed around: the lifter's own centre line. */
export const GYM_LIFT_FOCUS_X = GYM_LIFT_STAGE.SPRITE_X + CENTER_X;

/** The lifter's drawn height, in scene pixels. Same units as the scene. */
export const GYM_LIFTER_HEIGHT_PX = RESOLUTION.LIFTER_HEIGHT_PX;

// ---------------------------------------------------------------------------
// The readability measure
// ---------------------------------------------------------------------------

/**
 * Parameters of the readability measurement in `gymReadability.ts`.
 *
 * THESE ARE THE DEFINITION OF THE MEASURE, NOT A DIFFICULTY SETTING, and the
 * difference matters because the obvious way to make a failing check pass is to
 * turn one of them. That route is closed: `gymScene.test.ts` asserts that
 * deliberately hostile backgrounds — a high-contrast checker, a wall lifted
 * into the figure's own value band, props crowded in behind him — are REPORTED
 * AS FAILING, and every one of those assertions breaks if the parameters below
 * are loosened. Raising EDGE_LUMA_DELTA far enough to hide a busy room also
 * stops the checker being called busy, and the suite goes red.
 *
 * The pass/fail bounds themselves live in the test, deliberately: a bound is
 * the bar, and a bar belongs where it can be read next to the numbers it is
 * judging rather than in a file whose whole invitation is "turn these".
 */
export const GYM_READABILITY = Object.freeze({
  /**
   * Luma step between neighbouring pixels that counts as a hard edge.
   *
   * 20 is chosen so the block-course mortar line (10 luma under its wall) does
   * NOT count and a steel prop against that wall (22) does. Texture is allowed;
   * clutter is not, and this number is where the line between them is drawn.
   */
  EDGE_LUMA_DELTA: 20,
  /**
   * How far outside the figure's silhouette the background is sampled when
   * measuring rim separation. 1 would sample the sprite's own keyline, which is
   * part of the figure and would make the measure say nothing about the room.
   */
  RIM_PROBE_PX: 3,
  /** How far inside the silhouette the figure is sampled, same reason. */
  RIM_INSET_PX: 2,
  /** Margin around the figure's bounding box for the "directly behind" region. */
  BEHIND_MARGIN_PX: 5,
  /**
   * Luma at or above which a background pixel is competing with the figure for
   * the top of the range. The lifter's SKIN_LIGHT is 175 and his SKIN_HI is
   * 217; 160 sits under both, so a background pixel this bright is inside the
   * band the figure is supposed to own alone.
   */
  FIGURE_BAND_LUMA: 160,
  /**
   * The smallest luma step this piece is willing to call VISIBLE at phone scale.
   *
   * Not a guess and not a psychophysics claim: it is the room's own softest
   * deliberate mark. The block-course mortar line is drawn one rung under
   * whatever band it crosses, which measures about 10 luma, and it is authored
   * to read as texture — present, but not an edge. So 10 is the step this art
   * already treats as the boundary between "there" and "not there", and
   * EDGE_LUMA_DELTA (20) is the step it treats as a hard edge. Every separation
   * floor below is stated in these two numbers rather than in fresh integers.
   *
   * WHAT IT IS NOT: a claim that 9 luma is invisible on a real phone at real
   * brightness. Nobody has looked at this on a phone. It is a stated, single
   * place to turn if looking at one says the line is somewhere else.
   */
  PERCEPTIBLE_LUMA_STEP: 10,
  /**
   * The composition grid: how the visible room is cut up before its content is
   * counted, so "where the furniture is" is a number and not an opinion.
   *
   * 4 x 3 over the VISIBLE region. Coarse on purpose — a finer grid measures
   * individual props, and the question is whether the room is arranged, not
   * whether a bench is four pixels left of where it was.
   */
  COMPOSITION_COLS: 4,
  COMPOSITION_ROWS: 3,
  /**
   * How much of an EVEN share of the room's content a cell has to carry before
   * it counts as filled rather than bare. A quarter: a room laid out evenly puts
   * 1/12 of its content in each cell of a 4x3 grid, and a cell holding a quarter
   * of that has something in it without pretending the layout is a lattice.
   */
  CELL_FILLED_FRACTION_OF_EVEN: 0.25,
  /**
   * The quantiles every distribution in the report is summarised at.
   *
   * The low ones are the ones that matter. A background is not judged by its
   * average separation from the figure — an average hides a limb that has
   * vanished into a rack — it is judged by its WORST few per cent.
   */
  QUANTILES: Object.freeze({ p05: 0.05, p10: 0.1, p25: 0.25, p50: 0.5, p90: 0.9 }),
});
