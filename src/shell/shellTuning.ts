/**
 * shellTuning.ts — every tuned value the APP SHELL owns.
 *
 * The shell is the navigation layer: it decides which surface is on screen and
 * draws the one affordance that moves between them. Nothing here is a rule of
 * the sport and nothing here is progression — it is chrome, and chrome is
 * exactly the sort of thing GDD §12.1 says gets moved by hand afterwards.
 *
 * CLAUDE.md, "Game Feel Values Must Be Tunable": every timing, size and phase
 * gate below is a named constant in a registered home, re-exported from
 * `src/tuning/index.ts` under `TUNING.shell`, so a playtester can find it from
 * the one place. `src/tuning/audit.ts` registers this file and no `.tsx` file
 * may hold any of it.
 *
 * NONE OF THESE VALUES HAVE BEEN PLAYED. Every one is a starting point — in
 * particular `SESSION_PHASES` and `MEET_PHASES` below, which are a judgement
 * about when a navigation control is welcome and when it is in the way, and
 * that judgement needs a thumb on a phone to settle.
 *
 * Colour is deliberately absent: the pill is drawn out of `LIFT_PALETTE`, which
 * both `SESSION_PALETTE` and `MEET_PALETTE` are built on, so the shell's chrome
 * sits in the same room as whichever surface is under it without adding a
 * fourth palette that could drift from the other three.
 */

import type { MeetDayPhaseId } from '../game/meetDay';
import type { SessionPhase } from '../game/session';

/**
 * WHEN THE SHELL'S CHROME IS ALLOWED ON SCREEN.
 *
 * Not a style choice: a navigation pill drawn over a live set is a mis-tap
 * waiting to happen on the one beat of the game where a mis-tap costs a rep,
 * and GDD §3.2's whole loop is 60-90 seconds of that. So the shell asks the
 * surface which beat it is on and draws nothing outside these lists.
 *
 * SESSION_PHASES — the beats of GDD §3.2 where the player is deciding rather
 * than lifting. `set` and `rest` are deliberately absent: `set` is the mechanic
 * and `rest` is the gap between two of them, and neither wants a second thing
 * to press. `check-in` is included, which is also the "already trained today"
 * surface (GDD §3.2 allows one session a day) — a player who opens the app for
 * the second time gets somewhere to go rather than a dead end, which is the
 * §12.3 "never punish daily engagement" line applied to navigation.
 *
 * MEET_PHASES — where meet day is over and the way out is a route (GDD §6.5).
 * `bombed` is deliberately absent: §6.3's somber beat draws its own way out and
 * a second button on it would clutter the one screen the GDD asks to be left
 * alone.
 */
export const SHELL_NAV = Object.freeze({
  SESSION_PHASES: Object.freeze([
    'check-in',
    'briefing',
    'close-out',
  ] as const satisfies readonly SessionPhase[]),

  MEET_PHASES: Object.freeze(['recap'] as const satisfies readonly MeetDayPhaseId[]),

  /**
   * How long the pill takes to arrive.
   *
   * There is no fade OUT: the control unmounts the instant the surface leaves a
   * listed phase, because the phase it is leaving for is usually the set, and a
   * control that is still fading while the bar is being unracked is still
   * pressable.
   */
  FADE_IN_MS: 220,

  /** Held before the pill starts arriving, so it does not race the screen under it. */
  FADE_IN_DELAY_MS: 320,
});

/**
 * The pill's geometry, in logical points on a 390x844 phone.
 *
 * BOTTOM-ANCHORED on purpose. Every surface the shell draws over — the
 * check-in, the briefing, the close-out, the recap, the result card — centres
 * its content and leaves the bottom sixth of the screen empty, so this is the
 * one band where chrome overlaps nothing. Moving it means re-shooting all five.
 */
export const SHELL_LAYOUT = Object.freeze({
  NAV_BOTTOM_INSET: 44,
  NAV_HEIGHT: 38,
  NAV_PAD_H: 20,
  NAV_RADIUS: 19,
  NAV_BORDER: 1,
  NAV_FONT: 11,
  NAV_LETTER_SPACING: 2,
  /** Widens the touch target past the drawn pill, for a thumb. */
  NAV_HIT_SLOP: 14,
  /**
   * CROSSING 6: the gap between two simultaneous pills, when the session
   * surface draws both MEET DAY and the Gym Empire entry side by side. Unused
   * (and unread) whenever at most one pill is on screen, which is every beat
   * but the session's — the row has one item there and a `columnGap` on a
   * single flex child paints nothing.
   */
  NAV_GAP: 12,
});

/**
 * What the shell says.
 *
 * NO REAL IDENTITY (GDD §7.3, §12.3): every string here is a generic English
 * noun phrase. No federation, no meet series, no brand, no athlete.
 *
 * MEET_NAV_LABEL IS NOT A CALENDAR. GDD §6.1 enters a meet by selecting one
 * from the Career calendar, gated by qualifying totals, after a weigh-in beat.
 * Career mode does not exist yet, so this is one ungated door to the one local
 * meet the game has — and the label says "meet day", not "enter nationals",
 * precisely so it does not promise a selection screen that is not there.
 */
export const SHELL_COPY = Object.freeze({
  /** Session surface -> meet day. */
  MEET_NAV_LABEL: 'MEET DAY',
  MEET_NAV_HINT: 'Opens meet day.',

  /** Meet surface -> back to the daily loop. */
  LEAVE_MEET_LABEL: 'BACK TO TRAINING',
  LEAVE_MEET_HINT: 'Returns to the daily session.',

  /**
   * CROSSING 6: session surface -> Gym Empire (GDD §5), and the way back.
   * "GYM EMPIRE" rather than a shortened form, because the shell's other two
   * labels ("MEET DAY", "BACK TO TRAINING") both name the destination or the
   * return in full and a clipped label here would read as a different register
   * next to them.
   */
  GYM_NAV_LABEL: 'GYM EMPIRE',
  GYM_NAV_HINT: 'Opens Gym Empire.',

  LEAVE_GYM_LABEL: 'BACK TO TRAINING',
  LEAVE_GYM_HINT: 'Returns to the daily session.',
});
