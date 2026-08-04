/**
 * Screen chrome colours for the daily session loop.
 *
 * Built ON `LIFT_PALETTE` rather than beside it: the rep is played inside this
 * loop, so the check-in, the briefing and the close-out have to sit in the same
 * room as the platform. Everything shared is re-exported from there, and only
 * the handful of colours the session needs and the lift screen does not are
 * added.
 *
 * NOT SPRITE COLOURS. Those live in `src/art/palette.ts` and are sourced from
 * real meet software.
 *
 * Strings rather than numbers on purpose, so they are outside the numeric
 * scan `sessionTuning.test.ts` runs. A colour is not a timing window and does
 * not belong in a block a playtester turns with a stopwatch.
 */
import { LIFT_PALETTE } from '../lift/liftPalette';

export const SESSION_PALETTE = Object.freeze({
  ...LIFT_PALETTE,

  /** An unanswered check-in chip, and the one the finger landed on. */
  CHIP: '#1c2230',
  CHIP_EDGE: '#2c3242',
  CHIP_CHOSEN: '#38445c',
  CHIP_CHOSEN_EDGE: '#7fb2ff',

  /** The RPE the ladder opens on, before the player moves off it. */
  RPE_SUGGESTED_EDGE: '#4d5769',

  /** The modifier line. Warm when primed, cool when grinding. */
  MODIFIER_UP: '#ffd75e',
  MODIFIER_LEVEL: '#e8ecf4',
  MODIFIER_DOWN: '#8ea3c8',

  /** The close-out's PR beat. */
  PR: '#ffd75e',
  PR_GLOW: '#4a3d17',

  /** Set-counter pips: done, current, still to come. */
  PIP_DONE: '#7ddc8f',
  PIP_LIVE: '#ffd75e',
  PIP_TODO: '#2c3242',

  /** The primary action button on the close-out. */
  ACTION: '#38445c',
  ACTION_TEXT: '#e8ecf4',

  DIVIDER: '#242b39',
});
