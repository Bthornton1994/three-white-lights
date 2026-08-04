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
  /**
   * Rows between block-course mortar lines.
   *
   * -------------------------------------------------------------------------
   * THE TOP BAND IS FLAT, AND THAT IS NOW A DECISION RATHER THAN AN OMISSION
   * -------------------------------------------------------------------------
   * A course is drawn as `dimIndex` of whatever band it crosses, so how loud it
   * is depends on the band. The wall has three bands and `GYM_DIM_STEP` has a
   * rung under two of them:
   *
   *     WALL_DEEP  ->  (nothing is darker)  ->  0.00 luma  ->  NO COURSE DRAWN
   *     WALL_DARK  ->  WALL_DEEP            -> 15.09 luma
   *     WALL_MID   ->  WALL_DARK            ->  8.89 luma
   *
   * So the top 36% of the wall — `BAND_FRACS[0]`, about 43 of 119 rows on the
   * lift stage — is a flat dark field with no brickwork in it, and that is
   * visible in `.gauntlet/shots/gym/screen-standing-3x.png`. It reads as an
   * authored choice and until now it was not one: it was a missing map entry.
   *
   * IT IS KEPT, AND HERE IS THE REASON. `WALL_DEEP` (10.85) is the bottom rung
   * of the wall ramp and the GYM_WALL bank is full — sixteen of sixteen slots
   * spent — so there is no darker colour to draw a course in and no free slot to
   * make one. The alternatives were to draw the top course one rung UP instead
   * (a 15.09-luma LIGHT line at the very top of the frame, brighter than the
   * course in the band below it, which is a lit ceiling and not a mortar joint)
   * or to spend a bank slot the crowd and the lamp need. A gym's roofline being
   * out of the lamps and going to flat black is what the reference does with its
   * own upper corners, so the band stays flat and stays stated.
   *
   * `gymScene.test.ts` pins all three deltas off the RENDERED pixels, including
   * the zero, so this comment cannot drift away from the renderer again.
   */
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
 *
 * ---------------------------------------------------------------------------
 * THE FURNITURE IS GROUNDED THE SAME WAY, AND WAS NOT
 * ---------------------------------------------------------------------------
 * The lifter got a contact shadow and the room did not: the rack feet, bench
 * legs, plate-tree base, chalk stand and kettlebells all terminated flush
 * against the floor with nothing under them. That is the same defect the figure
 * had, one layer back, and it is the loudest "stamped on" tell a background
 * layer has.
 *
 * `PROP_*` is that fix. Same mechanism — step the room's own ramp down, never
 * paint a fixed dark index — for the same reason: a fixed shadow colour is a
 * hole on a pale platform and invisible on dark rubber.
 *
 * The FOOTPRINT is not authored. It is read off the bottom row of the prop's own
 * drawing in `gymProps.ts`, so a plate tree's shadow is its base plate and not
 * its bounding box, and a kettlebell row throws three shadows rather than one.
 * Nothing in `PROP_ART` needs a shadow row and nothing can forget one.
 *
 * HOW DARK is not a fixed number of rungs, because the ramps are not evenly
 * spaced: one rung is 50.5 luma on the lit platform and 8.9 on mid rubber. The
 * renderer steps down until the drop reaches
 * `GYM_READABILITY.PERCEPTIBLE_LUMA_STEP` and then stops, so `PROP_MAX_STEPS` is
 * a CEILING on how dark a prop shadow may get rather than how dark it is.
 *
 * ALSO UNPLAYED. Nobody has looked at this on a phone.
 */
export const GYM_CONTACT_SHADOW = Object.freeze({
  /** Rungs of the room's own ramp the surface under the FIGURE steps down. */
  STEPS: 2,
  /**
   * The most rungs a piece of FURNITURE may darken the floor by. Two: enough to
   * clear the perceptible step on mid rubber (17.0 luma), and not enough for a
   * prop standing on the lit platform to punch a 95-luma hole in it.
   */
  PROP_MAX_STEPS: 2,
  /** Rows of shadow, drawn forward from the row the prop stands on. */
  PROP_ROWS: 2,
  /**
   * Columns the shadow spreads either side of the footprint it came from.
   *
   * 0, and that is load-bearing rather than lazy: the reserved hole the figure
   * stands in is only two columns clear of the nearest prop on the left and one
   * on the right, so a shadow wider than its prop is a prop in the clear band.
   * `propBox` counts the shadow rows, so the reservation check sees them.
   */
  PROP_SPREAD: 0,
});

/** Column the room is composed around: the lifter's own centre line. */
export const GYM_LIFT_FOCUS_X = GYM_LIFT_STAGE.SPRITE_X + CENTER_X;

/** The lifter's drawn height, in scene pixels. Same units as the scene. */
export const GYM_LIFTER_HEIGHT_PX = RESOLUTION.LIFTER_HEIGHT_PX;

// ---------------------------------------------------------------------------
// The readability measure
// ---------------------------------------------------------------------------

/**
 * THE ONE AUTHORED NUMBER THE READABILITY RULER IS MADE OF.
 *
 * Luma step between neighbouring pixels that counts as a HARD EDGE. Every other
 * separation threshold in this file is a plain division of it — see
 * `GYM_READABILITY` below — so there is exactly one number to turn and the rest
 * move with it.
 *
 * ---------------------------------------------------------------------------
 * WHERE 20 COMES FROM, MEASURED, WITH BOTH BRACKETS
 * ---------------------------------------------------------------------------
 * It sits between the loudest mark the WALL draws and the softest mark a PROP
 * draws against that wall, and both of those are real numbers off the shipped
 * palette rather than a rounded intuition:
 *
 *   - the loudest block course the wall draws is 15.09 luma (`WALL_DARK` 25.94
 *     stepped to `WALL_DEEP` 10.85). Texture, and 20 is above it, so a course
 *     does not register as an edge.
 *   - a steel prop standing against the band the lifter is drawn against is
 *     23.20 luma (`STEEL_FRAME` 58.03 over `WALL_MID` 34.82). Furniture, and 20
 *     is below it, so a rack does register.
 *
 * 4.9 luma of margin under, 3.2 over. `gymScene.test.ts` pins both brackets off
 * the palette, so if either mark moves the bracket claim goes red instead of
 * quietly becoming false.
 *
 * WHAT IT IS NOT: a psychophysics claim. Nobody has looked at this on a phone at
 * real brightness. It is one stated place to turn when somebody does.
 */
const EDGE_LUMA_DELTA = 20;

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
 * ---------------------------------------------------------------------------
 * THE THREE SEPARATION THRESHOLDS ARE ONE NUMBER AND TWO DIVISIONS OF IT
 * ---------------------------------------------------------------------------
 * `EDGE_LUMA_DELTA` (20) is authored and bracketed above. The other two are
 * CONVENTIONS — a half and a quarter — and are written as arithmetic on it
 * rather than as fresh integers so that nobody has to take a comment's word for
 * how they relate. Turning the anchor turns all three together.
 *
 * The pass/fail bounds themselves live in the test, deliberately: a bound is
 * the bar, and a bar belongs where it can be read next to the numbers it is
 * judging rather than in a file whose whole invitation is "turn these".
 */
export const GYM_READABILITY = Object.freeze({
  /** The anchor. See the block comment above `EDGE_LUMA_DELTA`. */
  EDGE_LUMA_DELTA,
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
   * ---------------------------------------------------------------------------
   * A CONVENTION — HALF THE HARD-EDGE STEP — AND NOTHING MORE
   * ---------------------------------------------------------------------------
   * This is stated plainly because the previous version of this comment did not
   * state it plainly. It claimed 10 was "the room's own softest deliberate mark
   * … the block-course mortar line … which measures about 10 luma". THE ROOM
   * DOES NOT DRAW A 10-LUMA MARK. Courses are drawn with `dimIndex` of whatever
   * band they cross, and `GYM_DIM_STEP` has no entry for `WALL_DEEP`, so the
   * three courses the wall actually draws measure:
   *
   *     WALL_DEEP  (luma 10.85)   ->  no dimmer neighbour   ->  delta  0.00
   *     WALL_DARK  (luma 25.94)   ->  WALL_DEEP             ->  delta 15.09
   *     WALL_MID   (luma 34.82)   ->  WALL_DARK             ->  delta  8.89
   *
   * The first row is not a rounding. `WALL_DEEP` is the bottom of the wall ramp
   * and nothing in the bank is under it, so the top 36% of the wall — every row
   * above `GYM_WALL_PAINT.BAND_FRACS[0]` — HAS NO BRICKWORK AT ALL. See
   * `GYM_WALL_PAINT.COURSE_ROWS` for what was decided about that.
   *
   * There is no 10 anywhere in that list, and `gymScene.test.ts` now pins all
   * three off the rendered pixels so the number in a comment cannot drift away
   * from the number the renderer draws a second time.
   *
   * So: 10 is `EDGE_LUMA_DELTA / 2`. A convention, chosen because half of a hard
   * edge is a reasonable place to put "present but not an edge", and written as
   * the division so nobody re-derives a provenance for it.
   *
   * ---------------------------------------------------------------------------
   * WHAT IT COSTS TO MOVE IT, SAID OUT LOUD
   * ---------------------------------------------------------------------------
   * The rim floors in `gymScene.test.ts` are denominated in this number, and two
   * of them pass by very little. Measured on the shipped frames:
   *
   *   - the meet frame's `rimContrast.p05` is 11.42, so any anchor above 11.42
   *     (i.e. `EDGE_LUMA_DELTA` above 22.84) FAILS the shipped meet frame.
   *   - the descent frame's `rimContrast.p25` is 22.15, so `EDGE_LUMA_DELTA`
   *     above 22.15 fails the shipped descent frame.
   *   - had the anchor been the wall's real loudest course (15.09) rather than
   *     this convention, the meet frame (11.42) AND the descent, hole and drive
   *     frames (14.61) would all fail RIM_P05 outright.
   *
   * That is 2.15 luma of headroom on the whole suite, on a convention. It is
   * pinned as a headroom test rather than left implicit, so the next person to
   * turn this number learns what it costs before they turn it and not after.
   *
   * WHAT IT IS NOT: a claim that 9 luma is invisible on a real phone at real
   * brightness. Nobody has looked at this on a phone.
   */
  PERCEPTIBLE_LUMA_STEP: EDGE_LUMA_DELTA / 2,
  /**
   * Below this, two surfaces meeting at the silhouette are the SAME COLOUR.
   *
   * A quarter of the hard-edge step — the same kind of convention as the one
   * above, and derived from the same anchor. It exists because the percentile
   * rim numbers are structurally blind to a small collision: a contact that is
   * two per cent of the crossings sits under `p05` and cannot move it, however
   * bad it is. `rimDeadShare` counts crossings under this threshold, and its
   * bound is ZERO — the one ceiling in this piece that is not calibrated against
   * anything, because "no part of the silhouette may vanish" is not a quantity
   * you tune.
   */
  DEAD_CONTACT_LUMA: EDGE_LUMA_DELTA / 4,
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
