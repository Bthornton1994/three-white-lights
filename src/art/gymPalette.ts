/**
 * Gym / environment palette — two BACKGROUND banks, on top of the sprite banks.
 *
 * ---------------------------------------------------------------------------
 * WHY SEPARATE BANKS RATHER THAN MORE SLOTS IN `palette.ts`
 * ---------------------------------------------------------------------------
 * On the hardware this is modelling, the background and the character do not
 * share a palette. SNES mode 1 gives a 4bpp BG layer its own 16-colour palette,
 * chosen per tile, entirely separate from the OBJ (sprite) palettes. So a gym
 * that owns two BG banks and touches none of the lifter's fifteen colours is
 * not an architectural convenience — it is what the era actually did, and it is
 * the reason a background can be redrawn without the figure shifting hue.
 *
 * It is also the merge-safe shape: `palette.ts` is untouched by this piece.
 * Indices 0..47 keep meaning exactly what they meant; 48..79 are new. Anything
 * that resolves an index through `colorAt` still sees the same three banks, and
 * `sceneColorAt` below is the one function that sees all five.
 *
 * ---------------------------------------------------------------------------
 * THE VALUE RULE THIS FILE EXISTS TO ENFORCE
 * ---------------------------------------------------------------------------
 * GDD §12.2 judges this piece on "readability at phone scale", and the single
 * way a background fails that is by competing with the figure for the top of
 * the value range. `palette.ts` already measured what the era does about it,
 * off `sprite-ref-1-snes-wrestling.png` at native scale:
 *
 *   - the crowd — the busiest, most detailed band on the screen — is held to
 *     mean 38.8 / median 36, the bottom sixth of the range;
 *   - the mat the wrestlers stand ON is the opposite: mean 93.4 / median 102 /
 *     p90 120, a pale floor for dark boots;
 *   - the figures carry the brightest pixels in the frame, skin topping out
 *     around 231-247.
 *
 * Every colour below is placed against those three numbers, and the placement
 * is checked rather than promised: `gymPalette.test.ts` asserts the wall band
 * sits under the crowd figure, the floor band lands on the mat figure, and
 * nothing outside the lamp filament reaches the lifter's own top two skin
 * steps. Our lifter's ramp for reference: SKIN_HI 217, SKIN_LIGHT 175,
 * SKIN_MID 117, GEAR_LIGHT 149, SINGLET_LIGHT 148.
 *
 * WHAT IS NOT CLAIMED. That reference is a wrestling ring, not a gym interior,
 * and `docs/reference/README.md` says plainly that the gym/environment bar has
 * no dedicated reference committed. These values are therefore anchored to a
 * measured era-typical VALUE STRUCTURE; whether the result reads as authentic
 * 16-bit gym art in a blind A/B is not something this file can establish.
 *
 * ---------------------------------------------------------------------------
 * NOT A KNOB
 * ---------------------------------------------------------------------------
 * Registered in `src/tuning/audit.ts` as `kind: 'colour'` and reachable from
 * `src/tuning/index.ts` as `PALETTES.gym`. Colours are not turned with a
 * stopwatch the way a timing window is, but they ARE the whole readability
 * argument, so they live in one place and every one of them is named.
 */

import {
  BANK_SIZE,
  PALETTE_INDEX_COUNT,
  colorAt,
  paletteIndex,
  rgb5ToRgb8,
  type PaletteBank,
  type Rgb5,
} from './palette';

// ---------------------------------------------------------------------------
// Bank 3 — GYM_WALL: the shell of the room
// ---------------------------------------------------------------------------
//
// Everything here is deliberately dim. The wall is what the lifter is drawn IN
// FRONT OF, so it spends the bottom third of the range and nothing else. The
// two exceptions are the lamp, which is a light SOURCE and covers a handful of
// pixels, and the glass, which is small and cool.
//
// Ramps are hue-shifted rather than value-scaled, the same discipline the
// LIFTER bank uses: the wall leans blue in shadow and warm where a lamp washes
// it, so four steps of paint read as a lit surface instead of as grey.

const GYM_WALL_COLORS: readonly Rgb5[] = [
  [31, 0, 31], //  0 transparent sentinel (magenta; never rendered)
  // THE WALL RAMP IS DELIBERATELY OUT OF PHASE WITH THE FIGURE'S.
  // It used to be 18 / 36 / 52 / 69, an even ~17-luma ladder, against a figure
  // whose own low steps were about 17 apart too. Every wall step landed within
  // 4 luma of a figure step, which is the worst possible arrangement and
  // arrived by coincidence rather than by choice.
  //
  // THE FIGURE THEN MOVED, and this is what re-deriving against it looks like.
  // The A1 shading rework took HAIR_DARK from 37.2 to 45.2 and widened the
  // figure's distribution; WALL_MID at 43.9 — chosen to interleave with the OLD
  // ramp — ended up 1.4 luma from the lifter's own hair, and the rim
  // percentiles in `gymReadability.ts` found it at four to five samples a
  // frame. His head was dissolving into the wall behind it.
  //
  // The figure's steps under 80 now read 19.3 / 45.2 / 49.3 / 50.9 / 54.1 /
  // 58.9 / 64.7 / 65.1 / 73.0 / 75.0. There is exactly ONE window in that
  // ladder wide enough to hold a background value more than
  // GYM_READABILITY.PERCEPTIBLE_LUMA_STEP from both of its ends — 19.3 to 45.2,
  // and only its middle six luma. So the wall gets ONE safe band, not four, and
  // it is spent on the band the lifter's head and torso are actually drawn
  // against. WALL_DARK and WALL_DEEP sit above his crown and are exempt for the
  // same reason `gymPalette.test.ts` exempts the lamp wash and the glass — an
  // exemption `gymScene.test.ts` checks on the rendered pixels rather than
  // taking on trust.
  [1, 1, 4], //  1 WALL_DEEP      luma 11  — top of the wall, out of the lamps
  [3, 3, 5], //  2 WALL_DARK      luma 26  — ref crowd median is 36; ours is the
  //                                 band either side of it. ABOVE HIS CROWN.
  [4, 4, 6], //  3 WALL_MID       luma 34  — the band the lifter's head and
  //                                 torso are drawn against, and the only
  //                                 value in this bank inside the one safe
  //                                 window: 14.5 clear of his OUTLINE, 11.4
  //                                 clear of his HAIR_DARK, 15.5 clear of the
  //                                 shade half of a red disc and 20.3 clear of
  //                                 SINGLET_DARK.
  [8, 8, 11], //  4 WALL_LIGHT    luma 69  — ONLY where a lamp washes, and only
  //                                 high on the wall. It is 4 luma from
  //                                 SKIN_SHADOW, which would be a bad colour to
  //                                 put behind a lifter — so the renderer does
  //                                 not, and `gymScene.test.ts` asserts no
  //                                 WALL_LIGHT pixel lands in the band the
  //                                 figure occupies rather than trusting it.
  [2, 2, 3], //  5 WALL_SKIRT     luma 17  — the kickplate where the wall meets
  //                                 the floor. ONE line, and the only place the
  //                                 wall is allowed a hard edge, because it is
  //                                 the line that stops the room being a
  //                                 backdrop the figure floats in front of.
  //                                 Block courses are NOT drawn in this: they
  //                                 use `dimIndex` of whatever band they cross,
  //                                 which keeps every course under
  //                                 GYM_READABILITY.EDGE_LUMA_DELTA. Texture is
  //                                 allowed; texture that reads as an edge at
  //                                 phone scale is noise.
  [6, 3, 3], //  6 STRIPE_DARK    luma 32  — painted band, shadow side
  [10, 5, 4], //  7 STRIPE_MID    luma 52  — painted band. Warm, so the room has
  //                                 one non-blue note without spending value.
  [5, 5, 6], //  8 LAMP_HOUSING   luma 42
  [14, 13, 9], //  9 LAMP_GLOW    luma 106 — the warm halo around a filament
  [25, 24, 18], // 10 LAMP_CORE   luma 194 — THE FILAMENT, and the only thing in
  //                                 either gym bank allowed above 150. It is a
  //                                 light source; a lamp darker than the room
  //                                 it lights is the tell that nobody thought
  //                                 about where the light comes from. Bounded
  //                                 BY AREA instead of by value — see the
  //                                 bright-pixel share check in the readability
  //                                 module.
  [7, 9, 12], // 11 GLASS_DIM     luma 72  — high window, cool against the paint
  [3, 3, 4], // 12 FRAME_DARK     luma 25  — window frame, conduit, bracket
  [3, 4, 5], // 13 TRUSS          luma 31  — roof steel and hanging stems
  // THE ONE COLLISION THIS FILE CANNOT SOLVE, STATED RATHER THAN HIDDEN.
  // After A1's shading rework CROWD_MID (45.2) is the lifter's HAIR_DARK (45.2)
  // to one decimal place, and CROWD_DARK (20.3) is within 1.0 of his OUTLINE.
  // Both were measured, and both were tried: at CROWD_DARK 28 / CROWD_MID 36 —
  // the only pair the rgb5 grid offers inside the single safe window described
  // above the wall ramp — the worst contact improves from 0.0 to 8.0, still
  // under PERCEPTIBLE_LUMA_STEP, and the heads stop clearing EDGE_LUMA_DELTA
  // over the mass they sit on. Measured: the meet room's furniture share falls
  // from 5.99% to 2.75% and it fails FURNITURE_SHARE_MIN outright. A crowd 8
  // luma from his hair that no longer reads as a crowd is not a trade worth
  // taking, so these are left where they are and the collision is reported.
  //
  // What would actually solve it is not a colour: it is the crowd's seating
  // sitting below his crown rather than behind it, which is a change to the
  // meet venue's geometry and belongs to whoever owns meet-day art.
  // The bounds still pass — it is about 2% of rim samples, under the p05 floor
  // — and that is exactly why the number is written down here.
  [3, 2, 4], // 14 CROWD_DARK     luma 20  — meet venue: the seated dark mass
  [6, 5, 7], // 15 CROWD_MID      luma 45  — meet venue: a lit row of heads
];

// ---------------------------------------------------------------------------
// Bank 4 — GYM_FLOOR: what the lifter stands on, and what stands on it
// ---------------------------------------------------------------------------
//
// This bank carries the room's brightest routine values, and that is the right
// way round: the reference's mat is pale and its crowd is dark. A pale floor is
// also the only thing that makes a black lifting shoe read as a shoe rather
// than as a hole (meet-photo-ref-1), and the lifter's GEAR ramp bottoms out at
// luma 59, so the surface under his feet has to clear that by a wide margin.

const GYM_FLOOR_COLORS: readonly Rgb5[] = [
  [31, 0, 31], //  0 transparent sentinel
  // THE RUBBER STAYS UNDER 50, AND THAT IS MEASURED RATHER THAN chosen.
  // The competition plate ramp bottoms out at luma 49 (red) and 51 (black), the
  // singlet at 54, the knee sleeves at 59 and shadowed skin at 73 — so the band
  // from the high 40s to the mid 70s is where the FIGURE lives and a floor
  // drawn in it has nothing but a keyline holding it off him. Measured on the
  // real composite at the bottom of a squat, a 50-luma rubber floor put the
  // shade half of a red disc 0.6 luma from the floor behind it. These four
  // steps sit entirely below that band. It also happens to be what rubber gym
  // flooring looks like.
  [2, 2, 3], //  1 FLOOR_DEEP     luma 17  — rubber at the back of the room
  [3, 3, 4], //  2 FLOOR_DARK     luma 25
  [4, 4, 5], //  3 FLOOR_MID      luma 34
  [6, 6, 7], //  4 FLOOR_LIGHT    luma 50  — the front strip only, in the two
  //                                 bottom corners the platform does not cover.
  //                                 The light POOL does not reach the rubber at
  //                                 all: a spot on a platform lights the
  //                                 platform, and `GYM_LIGHT_STEP` has no entry
  //                                 for a rubber index, which is what enforces
  //                                 it.
  [6, 5, 3], //  5 WOOD_DARK      luma 41  — platform plank, shaded. Pulled down
  //                                 from 52, which sat 3 luma off
  //                                 PLATE_RED_SHADE (49) and 13 off
  //                                 SINGLET_DARK (54): a red disc resting on the
  //                                 back of the platform had nothing but its
  //                                 outline holding it off the boards.
  [13, 10, 6], //  6 WOOD_MID     luma 86
  [20, 16, 10], //  7 WOOD_LIGHT  luma 136 — lit platform top. Above the
  //                                 reference mat's p90 of 120 on purpose: at
  //                                 120 it was 3 luma off SKIN_MID (117), and
  //                                 the lit flank of the lifter's own shin
  //                                 disappeared into the boards he was standing
  //                                 on. 136 sits in the gap between SKIN_MID
  //                                 and SINGLET_LIGHT (148) and is still 39
  //                                 under SKIN_LIGHT.
  [4, 3, 2], //  8 WOOD_SEAM      luma 26  — the gap between two boards, and the
  //                                 bottom rung of the wood ramp, so
  //                                 LIGHT -> MID -> DARK -> SEAM steps down
  //                                 monotonically and `dimIndex` can be used to
  //                                 shade the platform without leaving the
  //                                 material.
  [7, 7, 8], //  9 STEEL_FRAME    luma 58  — platform edge band, rack section
  [11, 11, 13], // 10 STEEL_LIT   luma 92  — the lit flank of a round tube
  [3, 3, 4], // 11 RUBBER_DARK    luma 25  — bumper plate, prop shadow, tyre
  [11, 3, 3], // 12 ACCENT_RED    luma 44  — a 25 kg disc, seen across the room
  [4, 7, 12], // 13 ACCENT_BLUE   luma 55  — a 20 kg disc
  [11, 9, 3], // 14 ACCENT_YELLOW luma 73  — a 15 kg disc
  //                                 The sport's own weight-to-colour coding,
  //                                 whose provenance `palette.ts` records,
  //                                 carried into the background at a fraction
  //                                 of its value. GDD §7.1 calls plate colour
  //                                 "free visual language"; a gym with no
  //                                 coloured discs in it throws that away, and
  //                                 one with FULL-VALUE discs in the background
  //                                 steals the foreground's own cue.
  //                                 A WEIGHT, NOT A MAKER. These three say a
  //                                 denomination and nothing else. GDD §12.3
  //                                 forbids a real brand anywhere in the app
  //                                 and a disc face is the first place one
  //                                 would arrive; the room has no way to draw
  //                                 one, and `gymScene.test.ts` pins that.
  [14, 14, 15], // 15 CHALK_DUST  luma 116 — the bowl, and what spills off it
];

export const GYM_WALL_BANK: PaletteBank = { name: 'GYM_WALL', colors: GYM_WALL_COLORS };
export const GYM_FLOOR_BANK: PaletteBank = { name: 'GYM_FLOOR', colors: GYM_FLOOR_COLORS };

/** The gym banks, in bank order, starting at `GYM_BANK_FIRST`. */
export const GYM_BANKS: readonly PaletteBank[] = [GYM_WALL_BANK, GYM_FLOOR_BANK];

/** Bank number of the first gym bank: straight after the three sprite banks. */
export const GYM_BANK_FIRST = PALETTE_INDEX_COUNT / BANK_SIZE;

const GYM_WALL_BANK_INDEX = GYM_BANK_FIRST;
const GYM_FLOOR_BANK_INDEX = GYM_BANK_FIRST + 1;

/** Total index space once the gym banks are counted. */
export const SCENE_INDEX_COUNT = PALETTE_INDEX_COUNT + GYM_BANKS.length * BANK_SIZE;

// ---------------------------------------------------------------------------
// Named indices. The scene renderer references these and never a raw number.
// ---------------------------------------------------------------------------

export const GYM = {
  // GYM_WALL
  WALL_DEEP: paletteIndex(GYM_WALL_BANK_INDEX, 1),
  WALL_DARK: paletteIndex(GYM_WALL_BANK_INDEX, 2),
  WALL_MID: paletteIndex(GYM_WALL_BANK_INDEX, 3),
  WALL_LIGHT: paletteIndex(GYM_WALL_BANK_INDEX, 4),
  WALL_SKIRT: paletteIndex(GYM_WALL_BANK_INDEX, 5),
  STRIPE_DARK: paletteIndex(GYM_WALL_BANK_INDEX, 6),
  STRIPE_MID: paletteIndex(GYM_WALL_BANK_INDEX, 7),
  LAMP_HOUSING: paletteIndex(GYM_WALL_BANK_INDEX, 8),
  LAMP_GLOW: paletteIndex(GYM_WALL_BANK_INDEX, 9),
  LAMP_CORE: paletteIndex(GYM_WALL_BANK_INDEX, 10),
  GLASS_DIM: paletteIndex(GYM_WALL_BANK_INDEX, 11),
  FRAME_DARK: paletteIndex(GYM_WALL_BANK_INDEX, 12),
  TRUSS: paletteIndex(GYM_WALL_BANK_INDEX, 13),
  CROWD_DARK: paletteIndex(GYM_WALL_BANK_INDEX, 14),
  CROWD_MID: paletteIndex(GYM_WALL_BANK_INDEX, 15),

  // GYM_FLOOR
  FLOOR_DEEP: paletteIndex(GYM_FLOOR_BANK_INDEX, 1),
  FLOOR_DARK: paletteIndex(GYM_FLOOR_BANK_INDEX, 2),
  FLOOR_MID: paletteIndex(GYM_FLOOR_BANK_INDEX, 3),
  FLOOR_LIGHT: paletteIndex(GYM_FLOOR_BANK_INDEX, 4),
  WOOD_DARK: paletteIndex(GYM_FLOOR_BANK_INDEX, 5),
  WOOD_MID: paletteIndex(GYM_FLOOR_BANK_INDEX, 6),
  WOOD_LIGHT: paletteIndex(GYM_FLOOR_BANK_INDEX, 7),
  WOOD_SEAM: paletteIndex(GYM_FLOOR_BANK_INDEX, 8),
  STEEL_FRAME: paletteIndex(GYM_FLOOR_BANK_INDEX, 9),
  STEEL_LIT: paletteIndex(GYM_FLOOR_BANK_INDEX, 10),
  RUBBER_DARK: paletteIndex(GYM_FLOOR_BANK_INDEX, 11),
  ACCENT_RED: paletteIndex(GYM_FLOOR_BANK_INDEX, 12),
  ACCENT_BLUE: paletteIndex(GYM_FLOOR_BANK_INDEX, 13),
  ACCENT_YELLOW: paletteIndex(GYM_FLOOR_BANK_INDEX, 14),
  CHALK_DUST: paletteIndex(GYM_FLOOR_BANK_INDEX, 15),
} as const;

/**
 * Ordered dark -> light ramps for the scene.
 *
 * `WALL` is the vertical gradient the room is painted with; `FLOOR` is the
 * recession from the back of the room to the light pool; `WOOD` is the
 * platform. Banded, not smooth: a gradient is a modern-engine tell and a
 * hardware BG layer could not draw one.
 */
export const GYM_RAMPS = {
  WALL: [GYM.WALL_DEEP, GYM.WALL_DARK, GYM.WALL_MID, GYM.WALL_LIGHT],
  FLOOR: [GYM.FLOOR_DEEP, GYM.FLOOR_DARK, GYM.FLOOR_MID, GYM.FLOOR_LIGHT],
  WOOD: [GYM.WOOD_DARK, GYM.WOOD_MID, GYM.WOOD_LIGHT],
  STRIPE: [GYM.STRIPE_DARK, GYM.STRIPE_MID],
  STEEL: [GYM.STEEL_FRAME, GYM.STEEL_LIT],
  CROWD: [GYM.CROWD_DARK, GYM.CROWD_MID],
} as const satisfies Record<string, readonly number[]>;

/**
 * ONE STEP FURTHER AWAY.
 *
 * Depth in a background layer is value separation before it is anything else:
 * the same rack drawn twenty feet back is the same drawing in darker paint.
 * This maps every index a prop can be drawn in onto its one-step-dimmer
 * neighbour, so a placement can say `DIM: true` and get a far copy without a
 * second authored drawing and without a shading model in the background layer.
 *
 * Anything not listed maps to itself, which is deliberate: the lamp filament
 * and the chalk bowl do not have a far variant, and silently darkening them
 * would be worse than leaving them alone.
 */
export const GYM_DIM_STEP: Readonly<Record<number, number>> = Object.freeze({
  [GYM.STEEL_LIT]: GYM.STEEL_FRAME,
  [GYM.WALL_DARK]: GYM.WALL_DEEP,
  [GYM.STEEL_FRAME]: GYM.RUBBER_DARK,
  [GYM.WOOD_LIGHT]: GYM.WOOD_MID,
  [GYM.WOOD_MID]: GYM.WOOD_DARK,
  [GYM.WOOD_DARK]: GYM.WOOD_SEAM,
  [GYM.FLOOR_LIGHT]: GYM.FLOOR_MID,
  [GYM.FLOOR_MID]: GYM.FLOOR_DARK,
  [GYM.FLOOR_DARK]: GYM.FLOOR_DEEP,
  [GYM.ACCENT_YELLOW]: GYM.ACCENT_BLUE,
  [GYM.ACCENT_BLUE]: GYM.ACCENT_RED,
  [GYM.ACCENT_RED]: GYM.RUBBER_DARK,
  [GYM.CHALK_DUST]: GYM.FLOOR_LIGHT,
  [GYM.WALL_LIGHT]: GYM.WALL_MID,
  [GYM.WALL_MID]: GYM.WALL_DARK,
  [GYM.CROWD_MID]: GYM.CROWD_DARK,
});

/** The one-step-dimmer index, or the index itself where there is no step. */
export function dimIndex(index: number): number {
  return GYM_DIM_STEP[index] ?? index;
}

/**
 * ONE STEP INTO THE LIGHT.
 *
 * Written out rather than derived by inverting `GYM_DIM_STEP`, because that map
 * is not a bijection and inverting it produces nonsense: it steps a yellow disc
 * down to a blue one (which is fine — a far disc loses saturation) and the
 * inverse would step a blue disc UP to a yellow one, so lighting a plate would
 * change what denomination it is. Only surfaces a lamp actually falls on are
 * listed. Everything else is left where it is, which is why a chalk bowl inside
 * the light pool does not turn into something brighter than the lifter.
 */
export const GYM_LIGHT_STEP: Readonly<Record<number, number>> = Object.freeze({
  [GYM.WALL_DEEP]: GYM.WALL_DARK,
  [GYM.WALL_DARK]: GYM.WALL_MID,
  [GYM.WALL_MID]: GYM.WALL_LIGHT,
  [GYM.WOOD_SEAM]: GYM.WOOD_DARK,
  [GYM.WOOD_DARK]: GYM.WOOD_MID,
  [GYM.WOOD_MID]: GYM.WOOD_LIGHT,
  [GYM.STEEL_FRAME]: GYM.STEEL_LIT,
  [GYM.CROWD_DARK]: GYM.CROWD_MID,
});

/** The one-step-brighter index, or the index itself where there is no step. */
export function litIndex(index: number): number {
  return GYM_LIGHT_STEP[index] ?? index;
}

/** Apply `litIndex` `steps` times. Negative steps dim instead. */
export function stepIndex(index: number, steps: number): number {
  let out = index;
  for (let i = 0; i < Math.abs(steps); i += 1) {
    out = steps < 0 ? dimIndex(out) : litIndex(out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Resolving an index across all five banks
// ---------------------------------------------------------------------------

/**
 * Colour for any index in the SCENE space: the three sprite banks plus the two
 * gym banks. `colorAt` still answers for 0..47 and is unchanged, so a lifter
 * frame composited into a scene resolves through exactly the same table it
 * always did.
 */
export function sceneColorAt(index: number): Rgb5 | undefined {
  if (index < PALETTE_INDEX_COUNT) return colorAt(index);
  const bank = GYM_BANKS[Math.floor(index / BANK_SIZE) - GYM_BANK_FIRST];
  if (bank === undefined) return undefined;
  return bank.colors[index % BANK_SIZE];
}

// ---------------------------------------------------------------------------
// Luma
// ---------------------------------------------------------------------------

/**
 * Rec. 601 luma coefficients.
 *
 * NOT A TUNABLE — they are the published definition of luma, and every value
 * claim in this piece's comments and in its readability check is stated in
 * them. They live here because a colour's value is a property of the colour.
 */
export const REC601 = Object.freeze({ R: 0.299, G: 0.587, B: 0.114 });

export function lumaOfRgb5(c: Rgb5): number {
  const [r, g, b] = rgb5ToRgb8(c);
  return REC601.R * r + REC601.G * g + REC601.B * b;
}

/** Luma of a palette index, or `undefined` for transparent/unallocated. */
export function lumaOfIndex(index: number): number | undefined {
  const c = sceneColorAt(index);
  return c === undefined ? undefined : lumaOfRgb5(c);
}
