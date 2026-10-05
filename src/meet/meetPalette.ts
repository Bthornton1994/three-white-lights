/**
 * Screen chrome colours for meet day.
 *
 * Built ON `LIFT_PALETTE` rather than beside it, for the reason
 * `sessionPalette.ts` gives: the attempt is played on the same platform the
 * daily session's reps are, so the weigh-in, the walkout and the verdict have
 * to sit in the same room as it.
 *
 * THE TWO LIGHT COLOURS ARE THE ONLY ONES THAT CARRY MEANING. White and red are
 * the sport's own signal and the one thing on a meet screen a lifter reads
 * without looking — everything else here is chrome. They are deliberately not
 * the session's GOOD/MISS greens and reds: a judging light is a light, not a
 * status colour, and a white light that came out green would read as a game's
 * approval rather than as a referee's.
 *
 * NOT SPRITE COLOURS. Those live in `src/art/palette.ts` and are sourced from
 * real meet software.
 *
 * Strings rather than numbers on purpose, so they are outside the numeric scan
 * `meetTuning.test.ts` runs. A colour is not a timing window and does not
 * belong in a block a playtester turns with a stopwatch.
 *
 * ---------------------------------------------------------------------------
 * `MEET_PLATE_COLOURS` IS GONE, AND WHERE THE PLATE LADDER LIVES NOW
 * ---------------------------------------------------------------------------
 * This file used to carry the competition plate ladder as CSS, for a barbell the
 * walk-out beat drew out of `<View>`s. That bar is gone: GDD §7.1 commits to a
 * fixed internal resolution and nearest-neighbour scaling throughout, and the
 * walkout now draws `renderLifterFrame`'s bar (see `src/meet/meetHall.ts`). The
 * discs are therefore the SPRITE palette's — `RAMPS.PLATE_*` in
 * `src/art/palette.ts`, whose hues are transcribed from real meet software, with
 * the denominations in `src/art/plates.ts`. GDD §7.1's "colour coding is free
 * visual language" is still taken; it is taken once, in the one palette that
 * draws a plate, rather than twice in two colour spaces that could drift.
 */
import { LIFT_PALETTE } from '../lift/liftPalette';

export const MEET_PALETTE = Object.freeze({
  ...LIFT_PALETTE,

  ESPRESSO: '#14100d',
  ESPRESSO_EDGE: '#3a2a1c',
  AMBER: '#c9a15b',
  AMBER_INK: '#1a1008',
  IVORY: '#f3ead8',

  TEXT: '#f3ead8',
  TEXT_DIM: '#c4b49a',

  /** The three lights. */
  LIGHT_WHITE: '#f4f6fb',
  LIGHT_WHITE_EDGE: '#ffffff',
  LIGHT_RED: '#d8383c',
  LIGHT_RED_EDGE: '#ff6b6e',
  /** A light that has not come up yet. */
  LIGHT_DARK: '#161a22',
  LIGHT_DARK_EDGE: '#272d3a',

  /** The walkout beat. Dim, so the bar is the only thing lit. */
  WALKOUT_BACKDROP: '#07090d',
  WALKOUT_TEXT: '#9aa8c2',
  /** The line that fires on a third attempt or a bomb-risk attempt. */
  WALKOUT_URGENT: '#ffd75e',

  /** Attempt-choice cards: the safe one and the greedy one. */
  CARD_SAFE: '#18202c',
  CARD_SAFE_EDGE: '#33465e',
  CARD_BOLD: '#231c22',
  CARD_BOLD_EDGE: '#7a4550',
  /** The card that would set a competition PR. */
  CARD_PR_EDGE: '#ffd75e',

  /** The floor line on the attempt-selection screen — GDD §6.3's bite. */
  FLOOR_RAISED: '#ff8f6b',
  FLOOR_STEADY: '#8ea3c8',

  /** The bomb-out beat. Nothing here is red; it is not an error screen. */
  BOMB_TEXT: '#b9c2d4',
  BOMB_DIM: '#6b7488',

  /** The recap. */
  TOTAL: '#f3ead8',
  PR: '#ffd75e',
  DIVIDER: '#3a2a1c',
  ACTION: '#c9a15b',
  ACTION_TEXT: '#1a1008',

  /** Iron & Amber facility chrome around meet-day beats that are not the live attempt. */
  CARD: '#14100d',
  CARD_EDGE: '#3a2a1c',

  /** The attempt board's cells. */
  BOARD_GOOD: '#1e3324',
  BOARD_GOOD_EDGE: '#3f7d52',
  BOARD_NO_LIFT: '#33201f',
  BOARD_NO_LIFT_EDGE: '#8a4040',
  BOARD_EMPTY: '#14181f',
  BOARD_EMPTY_EDGE: '#222833',
});
