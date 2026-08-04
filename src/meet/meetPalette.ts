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
 */
import { LIFT_PALETTE } from '../lift/liftPalette';
import type { PlateHue } from '../art/plates';

export const MEET_PALETTE = Object.freeze({
  ...LIFT_PALETTE,

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
  TOTAL: '#f4f6fb',
  PR: '#ffd75e',
  DIVIDER: '#242b39',
  ACTION: '#38445c',
  ACTION_TEXT: '#e8ecf4',

  /** The attempt board's cells. */
  BOARD_GOOD: '#1e3324',
  BOARD_GOOD_EDGE: '#3f7d52',
  BOARD_NO_LIFT: '#33201f',
  BOARD_NO_LIFT_EDGE: '#8a4040',
  BOARD_EMPTY: '#14181f',
  BOARD_EMPTY_EDGE: '#222833',
});

/**
 * Competition plate colours, as CSS, keyed by `src/art/plates.ts`'s own hue
 * names.
 *
 * THE DENOMINATIONS AND WHICH HUE EACH ONE IS ARE NOT DECIDED HERE — that is
 * `PLATE_SPECS`, transcribed from OpenLifter's defaults. This map only says
 * what "RED" looks like in a React Native style, because the art module's
 * palette is an indexed 5-bit sprite palette and a `<View>` needs a string.
 *
 * GDD §7.1: "Competition plates are also color-coded by weight in the real
 * sport — that is free visual language and should not be thrown away." These
 * are the standard IPF-ladder colours (25 red, 20 blue, 15 yellow, 10 green,
 * 5 and the change discs black/white), which is why a lifter can read the bar
 * on the walkout beat without reading the number.
 */
export const MEET_PLATE_COLOURS: Readonly<
  Record<PlateHue, { readonly face: string; readonly edge: string }>
> = Object.freeze({
  RED: { face: '#c8322f', edge: '#f0605c' },
  BLUE: { face: '#2f63c8', edge: '#5f93f0' },
  YELLOW: { face: '#d9c22c', edge: '#ffe86a' },
  GREEN: { face: '#2f9c48', edge: '#5fd07a' },
  BLACK: { face: '#20242c', edge: '#4a515f' },
});
