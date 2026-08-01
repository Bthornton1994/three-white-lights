/**
 * Screen chrome colours for the lift mechanic.
 *
 * NOT SPRITE COLOURS. The sprite's palette lives in `src/art/palette.ts` and is
 * sourced from real meet software — plate hues in particular must not be
 * "balanced". These are the colours of the UI drawn around the sprite: the
 * backdrop, the bar-path plot, the cue ring, the judging lights.
 *
 * Strings rather than numbers on purpose, so they are outside the numeric-
 * literal scan `liftTuning.test.ts` runs. A colour is not a timing window and
 * does not belong in a tuning block a playtester turns with a stopwatch.
 */
export const LIFT_PALETTE = Object.freeze({
  /** Platform backdrop. Dark, so plate colours and the cue ring carry. */
  BACKDROP: '#12141a',
  STAGE: '#191d26',
  PANEL: '#1f2430',
  PANEL_EDGE: '#2c3242',

  TEXT: '#e8ecf4',
  TEXT_DIM: '#8b93a6',

  /** The bar-path trace, newest segment brightest. */
  TRACE: '#7fb2ff',
  /** Guide line at legal depth. */
  GUIDE_DEPTH: '#7a6a3f',
  /** Band marking the sticking point on the plot. */
  GUIDE_STICK: '#2b2436',
  GUIDE_LINE: '#333a4a',

  /** Cue ring: neutral while open, hot inside the perfect band. */
  CUE: '#8ea3c8',
  CUE_PERFECT: '#ffd75e',
  CUE_TARGET: '#5f6b84',

  /** The bar glyph on the plot. */
  BAR_STEEL: '#c9d2e2',

  /** Judging lights. */
  LIGHT_WHITE: '#f4f6fb',
  LIGHT_RED: '#d2423c',
  LIGHT_OFF: '#2a3040',
  LIGHT_EDGE: '#59637a',

  /** Outcome copy. */
  GOOD: '#7ddc8f',
  GRIND: '#ffd75e',
  MISS: '#e8695f',

  BUTTON: '#242b39',
  BUTTON_ACTIVE: '#38445c',
});
