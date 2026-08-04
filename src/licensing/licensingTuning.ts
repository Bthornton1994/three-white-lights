/**
 * licensingTuning.ts — every layout and pacing value the Tier 3 surfaces use.
 *
 * CLAUDE.md, "Game Feel Values Must Be Tunable": "Keep every such value as a
 * named constant in one place. Never scatter them as magic numbers across
 * components." This is this piece's block, registered in `src/tuning/audit.ts`
 * and re-exported from `src/tuning/index.ts` so a playtester reaches it from the
 * one place.
 *
 * NONE OF THESE VALUES HAVE BEEN PLAYED. GDD §12.1 budgets roughly 30 passes
 * over the feel values by hand, with real people. Every number below is a
 * starting point, and the two that most obviously need a human eye are called
 * out where they sit.
 *
 * UNITS. `PANEL` and everything under it are CARD PIXELS — the same 1x grid
 * `renderResultCard.ts` works in, upscaled by a whole number for display.
 * `SCREEN` is React Native logical points. The two are different and the blocks
 * say which is which, exactly as `cardTuning.ts` does.
 */

/**
 * THE TIER 3 PANEL, in card pixels.
 *
 * One panel is one partner on one surface: art, a rule, the wordmark caption,
 * and the Tier 2 name tag under it. Sized so the widest authored drawing
 * (a 24-wide wordmark lockup) fits with a margin either side.
 */
export const PANEL = {
  /**
   * Panel width and height.
   *
   * SIZED BY THE PHONE, NOT BY TASTE. GDD §12.2 grades art at phone scale, and
   * nearest-neighbour scaling (§7.1) means the sheet can only be drawn at whole
   * multiples. Two columns of 82 with `SHELF`'s margins make a 182-pixel sheet,
   * which is the widest that still doubles inside a 390pt viewport's padding —
   * one pixel wider and the whole screen drops to 1x and becomes unreadable.
   * Change either of these and re-check `LICENSING_SCREEN.MAX_SCALE` against a
   * real capture.
   */
  W: 82,
  H: 132,
  /** Inset from the panel edge to any content. */
  PAD: 5,
  /** Border thickness. */
  BORDER: 1,
  /** Top of the art well, below the panel border. */
  ART_TOP: 7,
  /** Height reserved for the drawing. Taller than the tallest authored art. */
  ART_H: 48,
  /**
   * Largest whole-number upscale a Tier 3 drawing is stamped at inside the
   * well. The renderer picks the largest integer that fits both axes and floors
   * at 1, so a taller drawing simply sits smaller rather than being cropped.
   */
  ART_MAX_SCALE: 3,
  /** Gap between the art well and the rule under it. */
  RULE_GAP: 3,
  /** Gap between the rule and the caption baseline box. */
  CAPTION_GAP: 4,
  /** How many lines a caption or a mechanics line may wrap to. */
  TEXT_LINES: 2,
  /** Vertical pitch between two wrapped lines. */
  LINE_PITCH: 9,
  /** Gap between the caption and the Tier 2 name tag. */
  NAME_TAG_GAP: 3,
  /** Gap between the name tag and the mechanics line. */
  MECHANICS_GAP: 3,
} as const;

/**
 * How many steps a colorway ramp has: dark, mid, light.
 *
 * A SHAPE, NOT A KNOB, and it lives here rather than in `renderPanels.ts`
 * because `src/tuning/audit.ts` allows a bare number only inside a registered
 * constants home — correctly: a `3` at the top of a renderer is exactly what
 * that scan exists to find, whether or not this particular one is a feel value.
 * Changing it means changing `Colorway`'s three fields too.
 */
export const RAMP_STEPS = 3;

/**
 * THE TIER 1 STRIP, in card pixels.
 *
 * The other half of a shelf row: the colorway swatch and the icon-mark, i.e.
 * everything the SPRITE would carry. Drawn beside the Tier 3 art on purpose, so
 * a reviewer can see at a glance which half of a partner reaches a 30-pixel
 * figure and which half never does.
 */
export const TIER_1_STRIP = {
  /** Side of one colorway swatch chip. */
  SWATCH: 9,
  /** Gap between the three chips of a colorway ramp. */
  SWATCH_GAP: 1,
  /** Gap between the swatch ramp and the icon-mark. */
  MARK_GAP: 5,
  /**
   * Whole-number upscale the icon-mark is drawn at inside the strip.
   *
   * 2 rather than 1 because a 5x5 mark at 1x is invisible next to 9-pixel
   * swatches, and the strip's whole job is to let a reviewer SEE what the
   * sprite would carry. It is still an icon-mark at sprite scale; this is the
   * inspection view of it, not the sprite.
   */
  MARK_SCALE: 2,
} as const;

/**
 * TEXT, in card pixels.
 *
 * `*_SCALE` values are whole-number upscales of the 5x9 card font. Fractional
 * scaling is forbidden everywhere in this codebase (GDD §7.1, nearest neighbour
 * only) and `drawText` rounds anyway.
 */
export const PANEL_TEXT = {
  /** The Tier 3 caption — the wordmark, set. */
  CAPTION_SCALE: 1,
  /** The Tier 2 name tag. */
  NAME_TAG_SCALE: 1,
  /** The small print: what the item reskins. */
  MECHANICS_SCALE: 1,
  /** The heading above a shelf. */
  HEADING_SCALE: 1,
} as const;

/**
 * THE SHELF, in card pixels — how panels are laid out next to each other.
 */
export const SHELF = {
  /** Panels per row. Two fits a phone at a 4x upscale. */
  COLUMNS: 2,
  /** Gap between panels, horizontally and vertically. */
  GAP: 6,
  /** Inset from the sheet edge. */
  MARGIN: 6,
  /**
   * Height of the heading band above the first row. Two lines: the surface's
   * title, and the standing reminder that nothing in the table is real.
   */
  HEADING_H: 24,
  /** Vertical pitch between the two heading lines. */
  HEADING_PITCH: 11,
  /** Inset from the top of the band to the first line. */
  HEADING_TOP: 3,
} as const;

/**
 * THE SCREEN AROUND THE SHEET, in React Native logical points.
 *
 * Different unit from everything above. `cardTuning.ts` draws the same line for
 * the result card and says why: the sheet is a pixel grid scaled by a whole
 * number, and the chrome around it is laid out in points like any other React
 * Native view.
 */
export const LICENSING_SCREEN = {
  /** Outer padding around the sheet. */
  PAD: 12,
  /** Gap between the title and the sheet. */
  TITLE_GAP: 10,
  /** Title size. */
  TITLE_SIZE: 15,
  /** Sub-title size. */
  SUBTITLE_SIZE: 11,
  /** Letter spacing on the title. */
  TITLE_TRACKING: 1.5,
  /**
   * Largest whole-number upscale the sheet may be drawn at.
   *
   * A CAP, not a target: `LicensedPanelView` picks the largest integer scale
   * that fits the available width and floors at 1, so this only bites on a
   * tablet. Fractional scaling is never used — GDD §7.1 requires nearest
   * neighbour, and a fractional scale makes some source pixels two device
   * pixels wide and some three.
   */
  MAX_SCALE: 6,
} as const;

/**
 * COPY. Every string these surfaces print, in one place.
 *
 * NOT A PARTNER'S COPY. Everything here is the game's own chrome — headings and
 * the line that says a branded item is mechanically its house version. A
 * partner's own words are `displayName` and `blurb` on their catalogue row, and
 * `realIp.ts` scans both.
 */
export const LICENSING_COPY = {
  SHOP_TITLE: 'SPONSORED SHELF',
  SHOP_SUBTITLE: 'Cosmetic only. Every branded item is its house version with different art.',
  SELECT_TITLE: 'CHARACTER SELECT',
  SELECT_SUBTITLE: 'Tier 1 on the sprite, Tier 2 on the name tag, Tier 3 here.',
  /**
   * The line under every sponsored item. GDD §8.1's promise, printed where a
   * player can read it rather than only asserted in a test — "a branded chalk is
   * the existing chalk with different art".
   *
   * A CANDIDATE FOR A HUMAN'S EYE. It is honest and it is clunky; whether a
   * shop screen should say this out loud on every row, or say it once at the
   * top, is a copy decision nobody has playtested.
   */
  SAME_AS: 'SAME AS',
  /**
   * Shown instead of the "same as" line on a panel with no sponsored item
   * behind it — character select, where nothing is being sold.
   *
   * It prints the entry's TIER 1 BUILD, which is the one thing on the panel a
   * player is actually choosing between and the one thing that reaches the
   * sprite. A brand has no body, so it says what a brand is instead.
   */
  BUILD_LABELS: {
    compact: 'COMPACT BUILD',
    'long-limbed': 'LONG-LIMBED BUILD',
    heavyweight: 'HEAVYWEIGHT BUILD',
    'not-a-lifter': 'KIT SPONSOR',
  },
  /** The placeholder banner: nothing here is a real partner. */
  PLACEHOLDER_NOTE: 'FICTIONAL PLACEHOLDERS',
} as const;
