/**
 * Sprite palette — 16-bit era colour discipline.
 *
 * ---------------------------------------------------------------------------
 * WHY COLOURS ARE STORED AS 5-BIT TRIPLES
 * ---------------------------------------------------------------------------
 * The SNES stores a colour as 15 bits: five bits per channel, 32 levels each.
 * Genesis is coarser still (9-bit, 8 levels per channel). Storing our colours
 * as 8-bit hex and *promising* to stay era-legal would be a claim nobody can
 * check; storing them as 5-bit triples makes the constraint structural — an
 * illegal colour cannot be written down in this file. `rgb5ToRgb8` expands to
 * display RGB using the same bit-replication the hardware emulators use
 * (`(c << 3) | (c >> 2)`), so 31 maps to 255 rather than 248.
 *
 * We use the SNES depth rather than Genesis's because GDD §7.1 explicitly wants
 * "enough palette for chalk, singlets, and plate colors" — the Genesis 8-level
 * ramp cannot hold four distinct skin steps and five plate hues without the
 * ramps colliding.
 *
 * ---------------------------------------------------------------------------
 * WHY THREE BANKS OF 16
 * ---------------------------------------------------------------------------
 * SNES sprite hardware assigns each 8x8 tile one of eight 16-colour palettes,
 * of which entry 0 is transparent — so 15 usable colours per object. Our banks
 * mirror that: LIFTER (the character), EQUIPMENT (bar, collars, plates) and
 * STAGE (contact shadow and the inspection backdrop). A frame is one index grid
 * whose values are `bank * 16 + slot`, so a sprite that would need a 16th colour
 * in a bank is a compile-time impossibility rather than a style violation.
 *
 * STAGE is deliberately thin. Real gym/environment art is a separate piece
 * (GDD §12.2 "Gym / environment art"); STAGE exists so a lifter frame has a
 * floor to stand on when inspected in isolation, and nothing more.
 *
 * ---------------------------------------------------------------------------
 * PLATE COLOURS — PROVENANCE
 * ---------------------------------------------------------------------------
 * GDD §7.1: "Competition plates are also color-coded by weight in the real
 * sport — that is free visual language and should not be thrown away." So the
 * hues are not a mood board choice; they carry weight information and a lifter
 * will read them as such.
 *
 * VERIFIED, by fetching the bytes in this sandbox:
 *   OpenLifter — the open-source software that runs real powerlifting meets —
 *   `src/constants/plateColors.ts` and `src/reducers/meetReducer.ts`, fetched
 *   from https://gitlab.com/openpowerlifting/openlifter/-/raw/main/... (HTTP
 *   200). Its default kg plate set and colours:
 *     50 kg green, 25 kg red, 20 kg blue, 15 kg yellow, 10 kg green,
 *     5 kg black, 2.5 kg black, 2 kg blue, 1.5 kg yellow, 1.25 kg black,
 *     1 kg blue, 0.75 kg red, 0.5 kg green, 0.25 kg blue.
 *   with hexes PLATE_DEFAULT_RED "#FF0000", BLUE "#4990E2", GREEN "#2AB003",
 *   YELLOW "#FFEF2A", BLACK "#000000", WHITE "#FFFFFF".
 *   Our five plate hues are 5-bit quantisations of those five hexes (see
 *   PLATE_HUE_SOURCE below, which records the source hex next to each ramp so
 *   the derivation is checkable line by line), and our denomination -> hue map
 *   is OpenLifter's, unchanged.
 *
 * NOT VERIFIED from here, and stated as unverified rather than asserted:
 *   The IPF Technical Rules Book itself. Every rulebook PDF on
 *   powerlifting.sport returns HTTP 403 through this sandbox's proxy, as does
 *   every secondary plate-colour guide tried. A text search summary reported
 *   that the current IPF text mandates colour only for 15 kg (yellow), 20 kg
 *   (blue) and 25 kg (red) and allows "any colour" at 10 kg and below; a second
 *   search reported the IWF coding as 25 red / 20 blue / 15 yellow / 10 green /
 *   5 white. Search summaries are not sources — the DOTS module in this repo
 *   documents a search summary inventing coefficients outright — so neither
 *   claim is treated as established here. Where OpenLifter and the reported IWF
 *   coding disagree (5 kg: black vs. white) we follow OpenLifter, because that
 *   is the one we could actually read.
 *
 * Ramps: each plate hue gets a two-step ramp (shade, light) plus the shared
 * EQUIPMENT outline. Two steps rather than three because a competition disc is
 * seen edge-on from the front — a 2px-wide rim has no room for a third band,
 * and spending bank slots on bands that never render is exactly the kind of
 * padding that makes a palette look decorative instead of worked.
 */

/** A colour in native 15-bit SNES space: three channels of 0..31. */
export type Rgb5 = readonly [number, number, number];

/** Display-space colour, 0..255 per channel. */
export type Rgb8 = readonly [number, number, number];

/** Slots per bank. SNES sprite palettes are 16 entries, entry 0 transparent. */
export const BANK_SIZE = 16;

/** Bank 0 slot 0. Any index whose slot is 0 is transparent. */
export const TRANSPARENT = 0;

/**
 * Expand a 5-bit channel to 8-bit the way SNES emulators do: replicate the top
 * bits into the low bits so the range saturates at 255 instead of 248.
 */
export function chan5To8(c5: number): number {
  const c = c5 | 0;
  return ((c << 3) | (c >> 2)) & 0xff;
}

export function rgb5ToRgb8(c: Rgb5): Rgb8 {
  return [chan5To8(c[0]), chan5To8(c[1]), chan5To8(c[2])];
}

/** Quantise an 8-bit channel down to the 5-bit hardware grid. */
export function chan8To5(c8: number): number {
  return (c8 >> 3) & 0x1f;
}

export interface PaletteBank {
  readonly name: string;
  /** Index 0 is the transparent sentinel; its colour value is never drawn. */
  readonly colors: readonly Rgb5[];
}

// ---------------------------------------------------------------------------
// Bank 0 — LIFTER
// ---------------------------------------------------------------------------
// Ramps are hue-shifted, not brightness-scaled: skin shadow leans red-violet
// and skin highlight leans yellow, which is the standard way 16-bit artists got
// warmth out of four steps. A pure value ramp of one hue is the single clearest
// "generated, not drawn" tell, so no ramp here shares a hue across all steps.

const LIFTER_COLORS: readonly Rgb5[] = [
  [31, 0, 31], //  0 transparent sentinel (magenta; never rendered)
  [3, 2, 3], //  1 L_OUTLINE       warm near-black
  [13, 7, 8], //  2 SKIN_SHADOW     red-violet lean
  [20, 12, 10], //  3 SKIN_MID
  [26, 20, 15], //  4 SKIN_LIGHT     Lifted with SKIN_HI, not left behind it.
  //                                 The four skin steps have to be roughly
  //                                 evenly spaced in luma or the ramp reads as
  //                                 blotches instead of as a modelled surface:
  //                                 at the old (206,140,107) the jump from here
  //                                 to the highlight was 61 luma against 29 for
  //                                 the step below it, and the flesh came out
  //                                 spotty. Reference steps (sprite-ref-1) are
  //                                 evenly spaced at 34-44 luma apart.
  [30, 26, 19], //  5 SKIN_HI         yellow lean. THE TOP OF THE FIGURE'S RANGE.
  //                                 Sampled off sprite-ref-1 at native scale,
  //                                 the wrestlers' skin runs (115,74,33) up
  //                                 through (231,198,132) to (247,231,214), and
  //                                 the top two steps cover ~15% of the body —
  //                                 the figures carry the brightest pixels in
  //                                 the frame and the crowd behind them sits at
  //                                 luma 16-80. Ours topped out at (239,190,148),
  //                                 a hair under the steel of its own collars,
  //                                 so the barbell out-valued the lifter.
  [26, 11, 9], //  6 SKIN_FLUSH     strain redness: SKIN_MID pushed ruddy, not
  //                                 pure red — it has to still read as a face
  [5, 6, 14], //  7 SINGLET_DARK
  [8, 11, 21], //  8 SINGLET_MID
  [14, 18, 28], //  9 SINGLET_LIGHT
  [5, 4, 6], // 10 HAIR_DARK
  [11, 8, 10], // 11 HAIR_LIGHT
  // GEAR — belt, both knee sleeves, both shoes. WHY THESE THREE MOVED, AND WHY
  // THEY DID NOT MOVE FURTHER: see the block comment directly below the bank.
  [7, 7, 9], // 12 GEAR_DARK
  [12, 12, 14], // 13 GEAR_MID
  [18, 18, 19], // 14 GEAR_LIGHT
  [30, 30, 29], // 15 CHALK
];

/*
 * WHY THE GEAR RAMP MOVED, AND WHY IT DID NOT MOVE FURTHER.
 *
 * The skin ramp was lifted once already (see SKIN_LIGHT above) and the gear ramp
 * was left behind, so the figure carried the top of its range only above the
 * belt: GEAR draws the belt, both knee sleeves and both shoes, which is most of
 * the lower body by area, and its old steps were 51 / 93 / 143 (Rec.601 luma of
 * the expanded 8-bit colour). Its darkest step was BELOW BACKDROP_MID's own 54,
 * so a sleeve's shaded flank was invisible against the backdrop it stood in
 * front of.
 *
 * MEASURED, in this sandbox, off sprite-ref-1 at native scale — the blond
 * wrestler, masked by colour and split at his own vertical midpoint:
 *
 *                       mean luma   px at luma >= 150   composition below mid
 *   reference, upper       113.7          32.6%
 *   reference, lower       109.0          21.7%        skin 54% kit 37% line 4%
 *   ours (was), upper       81.4          22.5%
 *   ours (was), lower       54.3           4.8%        line 52% kit 29% skin 13%
 *
 * The reference's own kit ramp — the wrestler's trunks, knee pad and boots,
 * which are one saturated pink ramp — measures 53 / 91 / 140. That is within a
 * few luma of what ours already was. So the gap was NOT mostly the ramp's
 * values; it was area. Half the lower body was near-black separation line, and
 * bare flesh was 13% where the reference's is 54%.
 *
 * Hence three coordinated changes rather than one big lift:
 *   1. GEAR moves 51/93/143 -> 59/101/149 and the steps even out (42, 48).
 *      Enough to clear the backdrop, not enough to out-value flesh.
 *   2. BACKDROP drops (see STAGE bank) to the reference's own crowd value, so
 *      GEAR_DARK now sits 23 luma clear of the backdrop instead of 3 below it.
 *   3. The near-black interior separation line comes off the legs entirely —
 *      see INTERIOR_EDGE — and the sleeve, hem and shin geometry changes in
 *      `rig.ts` put bare thigh and calf back into the frame.
 *
 * DELIBERATELY NOT DONE: pushing GEAR_LIGHT up to or past SKIN_LIGHT (175).
 * The reference's kit tops out at 140 against a skin third step of 152 — its
 * kit stays UNDER flesh. Sleeves, belts and shoes are black kit in this sport
 * (see meet-photo-ref-1); they must read as dark objects ON a lit leg, not as
 * the leg. GEAR_LIGHT at 149 is 26 luma under SKIN_LIGHT, which is the same
 * side of flesh the reference's kit is on.
 *
 * AND THAT RULE IS NOW ENFORCED RATHER THAN STATED. A ramp ordering is only a
 * promise about what CAN be drawn; the renderer broke the promise anyway, by
 * shading a bent leg out of its band. GEAR_LIGHT (149) out-valued SKIN_MID
 * (117), so wherever a leg fell to SKIN_MID the sleeve on it was the brighter
 * object.
 *
 * NO COLOUR IN THIS FILE MOVED FOR EITHER FIX, and both fixes are on the
 * renderer's side:
 *
 *   - `SHADING.FORESHORTEN` stopped a bent FEMUR being shaded as though it lay
 *     in the screen plane.
 *   - `SHADING.FAR_LEG_STEP_BIAS`, `SHADING.AXIAL_LEG` and
 *     `RIG_GEOMETRY.KNEE_SLEEVE.STEP_BIAS` stopped the rest of the lower body
 *     doing the same thing by three other routes: a blanket ramp-step bias that
 *     put the whole far leg's MEDIAN on SKIN_SHADOW, an axial profile borrowed
 *     from the arm that put the shin's only highlight underneath the sleeve,
 *     and a sleeve free to reach the top of the GEAR ramp.
 *
 * The enforcement is in `lifterSprite.test.ts`, and what it measures matters as
 * much as that it exists: the first version swept the pose space comparing two
 * MAXIMA over the whole thigh capsule, reported zero inversions, and was
 * satisfied by two pixels of lit hip surviving under the singlet while the
 * drawn leg was inverted everywhere the player looks. It now takes a MEDIAN and
 * an AREA SHARE over the bare leg BELOW the singlet hem, counts thigh and shin
 * separately, and asserts a floor on every pixel count it divides by.
 */

// ---------------------------------------------------------------------------
// Bank 1 — EQUIPMENT
// ---------------------------------------------------------------------------

/**
 * Source hexes the plate ramps were derived from, kept next to the ramps so the
 * derivation can be checked rather than believed. Values are OpenLifter's
 * `PlateColors` (see header).
 */
export const PLATE_HUE_SOURCE = {
  RED: '#FF0000',
  BLUE: '#4990E2',
  GREEN: '#2AB003',
  YELLOW: '#FFEF2A',
  BLACK: '#000000',
} as const;

const EQUIPMENT_COLORS: readonly Rgb5[] = [
  [31, 0, 31], //  0 transparent sentinel
  [1, 1, 2], //  1 EQ_OUTLINE      cool near-black. Darker than the backdrop on
  //                                purpose: the 1px gap between two discs is
  //                                filled with this, and it is the only thing
  //                                that makes a stack of plates countable.
  [7, 8, 10], //  2 STEEL_DARK
  [14, 15, 17], //  3 STEEL_MID
  [23, 24, 26], //  4 STEEL_LIGHT
  [17, 1, 3], //  5 PLATE_RED_SHADE      from #FF0000
  [31, 5, 4], //  6 PLATE_RED_LIGHT
  [5, 11, 20], //  7 PLATE_BLUE_SHADE     from #4990E2
  [12, 22, 30], //  8 PLATE_BLUE_LIGHT
  [22, 18, 2], //  9 PLATE_YELLOW_SHADE   from #FFEF2A
  [31, 30, 8], // 10 PLATE_YELLOW_LIGHT
  [2, 12, 2], // 11 PLATE_GREEN_SHADE     from #2AB003
  [8, 26, 4], // 12 PLATE_GREEN_LIGHT
  [6, 6, 8], // 13 PLATE_BLACK_SHADE     from #000000, lifted well off the
  [12, 12, 15], // 14 PLATE_BLACK_LIGHT     outline: a literal black disc is a
  //                                        hole in the sleeve at this size, and
  //                                        the small discs are the ones a
  //                                        player counts to read an attempt.
  [29, 30, 31], // 15 CHROME_HI           collar specular, disc hub
];

// ---------------------------------------------------------------------------
// Bank 2 — STAGE (inspection only, see header)
// ---------------------------------------------------------------------------

/*
 * THE STAGE GETS OUT OF THE FIGURE'S WAY.
 *
 * A stage is not neutral: whatever the lifter stands in front of decides how
 * much of the value range he has left. sprite-ref-1 is emphatic about this and
 * it is measurable — sampled here, its crowd (the whole band behind the ring)
 * runs mean 38.8 / median 36, i.e. the busiest, most detailed area of the
 * screen is held to the bottom sixth of the range so the wrestlers can own
 * everything above it. Its mat, which the figures stand ON rather than in front
 * of, is the opposite: mean 93.4 / median 102 / p90 120, a pale floor for dark
 * boots to sit against.
 *
 * Ours had that backwards at the top: BACKDROP_MID was 54, ABOVE GEAR_DARK's
 * own 51, so the lower body was drawn in front of something brighter than its
 * own kit. BACKDROP now lands on the reference's crowd values and PLATFORM on
 * its mat values, which also fixes the shoe contact — a dark sole on a pale
 * platform is what meet-photo-ref-1 shows, and it is the only reason a shoe
 * reads as standing on something rather than melting into it.
 */
const STAGE_COLORS: readonly Rgb5[] = [
  [31, 0, 31], // 0 transparent sentinel
  [3, 3, 6], // 1 BACKDROP_DARK    luma 27 (was 35)
  [5, 4, 8], // 2 BACKDROP_MID     luma 37 (was 54); ref crowd median 36
  [12, 9, 6], // 3 PLATFORM_DARK   luma 78 (was 53)
  [17, 13, 9], // 4 PLATFORM_MID   luma 112 (was 87); ref mat median 102
  [22, 17, 12], // 5 PLATFORM_LIGHT luma 146 (was 121); ref mat p90 120
  [2, 2, 3], // 6 CONTACT_SHADOW
];

export const LIFTER_BANK: PaletteBank = { name: 'LIFTER', colors: LIFTER_COLORS };
export const EQUIPMENT_BANK: PaletteBank = { name: 'EQUIPMENT', colors: EQUIPMENT_COLORS };
export const STAGE_BANK: PaletteBank = { name: 'STAGE', colors: STAGE_COLORS };

export const PALETTE_BANKS: readonly PaletteBank[] = [LIFTER_BANK, EQUIPMENT_BANK, STAGE_BANK];

/** Total index space: three banks of 16, whether or not every slot is filled. */
export const PALETTE_INDEX_COUNT = PALETTE_BANKS.length * BANK_SIZE;

/** Palette index for a (bank, slot) pair. */
export function paletteIndex(bank: number, slot: number): number {
  return bank * BANK_SIZE + slot;
}

/** True when the index falls in a bank's slot 0, i.e. draws nothing. */
export function isTransparentIndex(index: number): boolean {
  return index % BANK_SIZE === 0;
}

/** Colour for a palette index, or undefined for unallocated slots. */
export function colorAt(index: number): Rgb5 | undefined {
  const bank = PALETTE_BANKS[Math.floor(index / BANK_SIZE)];
  if (bank === undefined) return undefined;
  return bank.colors[index % BANK_SIZE];
}

/** True when the index names an allocated, drawable colour. */
export function isAllocatedIndex(index: number): boolean {
  return !isTransparentIndex(index) && colorAt(index) !== undefined;
}

// ---------------------------------------------------------------------------
// Named indices. Everything downstream references these, never raw numbers.
// ---------------------------------------------------------------------------

export const PAL = {
  // LIFTER
  OUTLINE: paletteIndex(0, 1),
  SKIN_SHADOW: paletteIndex(0, 2),
  SKIN_MID: paletteIndex(0, 3),
  SKIN_LIGHT: paletteIndex(0, 4),
  SKIN_HI: paletteIndex(0, 5),
  SKIN_FLUSH: paletteIndex(0, 6),
  SINGLET_DARK: paletteIndex(0, 7),
  SINGLET_MID: paletteIndex(0, 8),
  SINGLET_LIGHT: paletteIndex(0, 9),
  HAIR_DARK: paletteIndex(0, 10),
  HAIR_LIGHT: paletteIndex(0, 11),
  GEAR_DARK: paletteIndex(0, 12),
  GEAR_MID: paletteIndex(0, 13),
  GEAR_LIGHT: paletteIndex(0, 14),
  CHALK: paletteIndex(0, 15),

  // EQUIPMENT
  EQ_OUTLINE: paletteIndex(1, 1),
  STEEL_DARK: paletteIndex(1, 2),
  STEEL_MID: paletteIndex(1, 3),
  STEEL_LIGHT: paletteIndex(1, 4),
  PLATE_RED_SHADE: paletteIndex(1, 5),
  PLATE_RED_LIGHT: paletteIndex(1, 6),
  PLATE_BLUE_SHADE: paletteIndex(1, 7),
  PLATE_BLUE_LIGHT: paletteIndex(1, 8),
  PLATE_YELLOW_SHADE: paletteIndex(1, 9),
  PLATE_YELLOW_LIGHT: paletteIndex(1, 10),
  PLATE_GREEN_SHADE: paletteIndex(1, 11),
  PLATE_GREEN_LIGHT: paletteIndex(1, 12),
  PLATE_BLACK_SHADE: paletteIndex(1, 13),
  PLATE_BLACK_LIGHT: paletteIndex(1, 14),
  CHROME_HI: paletteIndex(1, 15),

  // STAGE
  BACKDROP_DARK: paletteIndex(2, 1),
  BACKDROP_MID: paletteIndex(2, 2),
  PLATFORM_DARK: paletteIndex(2, 3),
  PLATFORM_MID: paletteIndex(2, 4),
  PLATFORM_LIGHT: paletteIndex(2, 5),
  CONTACT_SHADOW: paletteIndex(2, 6),
} as const;

/** Ordered dark -> light ramps. Shading quantises into these. */
export const RAMPS = {
  SKIN: [PAL.SKIN_SHADOW, PAL.SKIN_MID, PAL.SKIN_LIGHT, PAL.SKIN_HI],
  SKIN_FLUSHED: [PAL.SKIN_SHADOW, PAL.SKIN_FLUSH, PAL.SKIN_LIGHT, PAL.SKIN_HI],
  SINGLET: [PAL.SINGLET_DARK, PAL.SINGLET_MID, PAL.SINGLET_LIGHT],
  HAIR: [PAL.HAIR_DARK, PAL.HAIR_DARK, PAL.HAIR_LIGHT],
  GEAR: [PAL.GEAR_DARK, PAL.GEAR_MID, PAL.GEAR_LIGHT],
  STEEL: [PAL.STEEL_DARK, PAL.STEEL_MID, PAL.STEEL_LIGHT],
  /** Bar shaft only: deliberately dim so it does not out-value the lifter. */
  SHAFT: [PAL.STEEL_DARK, PAL.STEEL_MID],
  /**
   * Collar clamp body — and it is deliberately dim.
   *
   * This used to be [STEEL_DARK, STEEL_LIGHT], and the comment beside it said
   * "CHROME_HI is reserved for a single specular pixel" while CHROME_HI was not
   * drawn anywhere at all. The result was a 20 px block of the brightest
   * equipment colour at each end of the bar, out-valuing the skin ramp, which
   * is how a sprite ends up duller than its own barbell. A specular is a dot,
   * not a block: the body is mid steel and `BAR.COLLAR_SPECULAR` places the one
   * CHROME_HI pixel that makes it read as chrome.
   */
  CHROME: [PAL.STEEL_DARK, PAL.STEEL_MID],
  PLATE_RED: [PAL.PLATE_RED_SHADE, PAL.PLATE_RED_LIGHT],
  PLATE_BLUE: [PAL.PLATE_BLUE_SHADE, PAL.PLATE_BLUE_LIGHT],
  PLATE_YELLOW: [PAL.PLATE_YELLOW_SHADE, PAL.PLATE_YELLOW_LIGHT],
  PLATE_GREEN: [PAL.PLATE_GREEN_SHADE, PAL.PLATE_GREEN_LIGHT],
  PLATE_BLACK: [PAL.PLATE_BLACK_SHADE, PAL.PLATE_BLACK_LIGHT],
  PLATFORM: [PAL.PLATFORM_DARK, PAL.PLATFORM_MID, PAL.PLATFORM_LIGHT],
} as const satisfies Record<string, readonly number[]>;

export type Ramp = readonly number[];

/**
 * Outline colour for a silhouette pixel, chosen by which bank the neighbouring
 * body pixel came from. Selective outlining — a warm outline on flesh and a
 * cool one on steel — is one of the cheapest era-correct details available and
 * the alternative (one flat black) is what makes generated sprites look pasted
 * onto the background.
 */
export function outlineIndexForBank(index: number): number {
  return Math.floor(index / BANK_SIZE) === 1 ? PAL.EQ_OUTLINE : PAL.OUTLINE;
}

/**
 * INTERIOR SEPARATION LINES — the line between two overlapping masses that are
 * BOTH inside the silhouette. Not the same job as `outlineIndexForBank`, which
 * draws the boundary between the sprite and the world.
 *
 * Every part is stamped with a 1px ring before it is filled (`PartOptions.edge`)
 * so the near leg reads in front of the far one and the sleeve reads in front of
 * the leg. That ring used to be PAL.OUTLINE — near-black, luma 19 — everywhere,
 * and `outlinePass` then adds a second near-black pixel outside it, so a 5px-wide
 * leg carried four columns of black. Measured on the lower half of the figure,
 * near-black was 52% of the body's own pixels; on the same split of sprite-ref-1
 * it is 4%, and that reference's arms and thighs are edged with the darkest step
 * of their OWN material (skin shadow, luma 80) with no keyline at all.
 *
 * So on the lower body the ring is now the material's own darkest step. The
 * silhouette keyline is untouched — `outlinePass` still puts one near-black
 * pixel outside everything, which is what keeps the figure readable at phone
 * scale against an unknown background (GDD §12.2).
 *
 * TUNING: setting any of these back to PAL.OUTLINE restores the old heavy
 * keyline for that material and nothing else changes. The upper body is
 * deliberately absent from this table — the dark breaks at the deltoid, elbow
 * and wrist are doing anatomical work there and are not separation lines.
 */
export const INTERIOR_EDGE = {
  SKIN: PAL.SKIN_SHADOW,
  GEAR: PAL.GEAR_DARK,
  SINGLET: PAL.SINGLET_DARK,
} as const;

/**
 * The interior separation colour for whatever material is already at a pixel.
 *
 * Used by the hand-drawn inner-leg seam, which has to sit on skin at one row and
 * on the singlet three rows up. Anything not in `INTERIOR_EDGE` — hair, chalk,
 * equipment — falls back to the keyline, because for those the black line is
 * still the right answer.
 */
export function interiorEdgeFor(index: number): number {
  switch (index) {
    case PAL.SKIN_SHADOW:
    case PAL.SKIN_MID:
    case PAL.SKIN_LIGHT:
    case PAL.SKIN_HI:
    case PAL.SKIN_FLUSH:
      return INTERIOR_EDGE.SKIN;
    case PAL.GEAR_DARK:
    case PAL.GEAR_MID:
    case PAL.GEAR_LIGHT:
      return INTERIOR_EDGE.GEAR;
    case PAL.SINGLET_DARK:
    case PAL.SINGLET_MID:
    case PAL.SINGLET_LIGHT:
      return INTERIOR_EDGE.SINGLET;
    default:
      return PAL.OUTLINE;
  }
}
