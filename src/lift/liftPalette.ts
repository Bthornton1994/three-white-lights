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
  /**
   * BENCH ONLY: the bar glyph while it is coming down, by how it is arriving.
   *
   * `chestApproach` is the read model (`lift.ts`) — 0 fully controlled, 1
   * crashing — and GDD §6.2 says in as many words that what the player watches
   * during bench's descent is THE BAR. Three bands rather than a continuous
   * lerp because the sprite sheet is quantised for the same reason (GDD §7.1)
   * and because a colour a player has to read in peripheral vision wants to be
   * one of a few recognisable states, not a gradient.
   *
   * NOT A FATIGUE METER (§12.3). It is the bar's speed this tick, it resets
   * every rep, and nothing behind it comes from `fatigue.ts` — the same
   * argument `chestApproach`'s own header makes, restated where the colour is.
   */
  BAR_APPROACH_CALM: '#8fe3a4',
  BAR_APPROACH_WARM: '#ffd75e',
  BAR_APPROACH_HOT: '#e8695f',

  /**
   * THE ON-STAGE COMMAND BEAT (GDD §6.2, ruled 2026-08-25; phone playtest 4).
   *
   * Phone playtest 4 measured the stimulus inventory at the PRESS instant and
   * found ONE live channel on the beta's own platform: a header text colour.
   * The haptic `liftTuning.ts` designates as the real stimulus is a no-op on
   * web (`haptics.ts`), and GDD §10.0 scopes the beta to web/PWA. These are
   * the colours of the channel that replaces it.
   *
   * `COMMAND_FLASH` is a full-stage wash, so it is deliberately warm rather
   * than white: a white wash on a dark stage reads as the screen breaking, and
   * the plate colours (`src/art/palette.ts`) are sourced from real meet
   * software and must not be washed out of recognition.
   */
  COMMAND_FLASH: '#ffe9a8',
  COMMAND_RING: '#fff3c9',
  /**
   * The wait beat, which is armed and is NOT a countdown.
   *
   * Its ring holds one radius and breathes on a period that is a constant —
   * see `stageArmed`. Nothing about it moves with the seeded command delay,
   * which is the no-countdown identity `cueProgress` already refuses to break
   * for deadlift's lockout.
   */
  ARMED: '#7fb2ff',

  /** The burst readout: one pip per counted tap the physics cap allows. */
  BURST_TRAY: '#0d1016',
  BURST_TRAY_EDGE: '#3a4256',
  BURST_PIP_LIT: '#ff8a3d',
  BURST_PIP_DIM: '#39414f',

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
