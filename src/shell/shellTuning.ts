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
/**
 * The one beat the Empire surface reports today.
 *
 * Empire has no choreography — the floor is a window onto GDD §5's running
 * gym, not a multi-beat mode. The shell still asks
 * for a beat so the leave control uses the same gate as meet/session rather
 * than a special case, and so a stale beat cannot flash on the way in.
 */
export type EmpirePhase = 'floor';

export const SHELL_NAV = Object.freeze({
  SESSION_PHASES: Object.freeze([
    'check-in',
    'briefing',
    'close-out',
  ] as const satisfies readonly SessionPhase[]),

  MEET_PHASES: Object.freeze(['recap'] as const satisfies readonly MeetDayPhaseId[]),

  EMPIRE_PHASES: Object.freeze(['floor'] as const satisfies readonly EmpirePhase[]),

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
  /** Gap between two pills when the session offers both meet day and Empire. */
  NAV_GAP: 10,
  /** Widens the touch target past the drawn pill, for a thumb. */
  NAV_HIT_SLOP: 14,

  /** Empire floor — padding and type. Feel starting points, not playtested. */
  EMPIRE_PAD_H: 28,
  EMPIRE_PAD_TOP: 72,
  EMPIRE_TITLE_FONT: 22,
  EMPIRE_TITLE_TRACK: 3,
  EMPIRE_BODY_FONT: 14,
  EMPIRE_BODY_LINE: 22,
  EMPIRE_STAT_GAP: 14,
  EMPIRE_STAT_LABEL_FONT: 11,
  EMPIRE_STAT_VALUE_FONT: 20,

  /**
   * -------------------------------------------------------------------------
   * WHY THESE TWO EXIST SEPARATELY, AND WHAT THE TIGHTENING COSTS
   * -------------------------------------------------------------------------
   * The stats column's top margin used to reuse `EMPIRE_PAD_TOP` (72) and a
   * card's vertical padding used to reuse `EMPIRE_STAT_GAP` (14) — two padding
   * constants doing double duty as column spacing because the floor had no
   * spacing knobs of its own. That fit six cards. It became a ruled bug at
   * seven: the away row (GDD §5.1's offline-cap summary) pushed the column's
   * bottom under the bottom band where the shell anchors its pill, and BACK TO
   * TRAINING drew on top of the card.
   *
   * THE MECHANISM CHOSEN IS TIGHTER SPACING — not smaller type, not a scroll,
   * not moving the pill band. Type at the sizes above stays legible; a scroll
   * for the sake of one card would put an interaction on a screen whose whole
   * design is "no control of its own"; and the pill band is shared chrome
   * (`NAV_BOTTOM_INSET`'s own comment: moving it means re-shooting every
   * surface). The cost is density: 48pt less air between the lead paragraph
   * and the column, 8pt less inside each card. Both are feel values a
   * playtester may re-spread — but only upward into the air above the column,
   * because the frame is fixed (GDD §7.1: one internal resolution, nothing
   * reflows to make room) and the floor's cards and the pill's TOUCH TARGET —
   * its drawn box grown by `NAV_HIT_SLOP` — have to stay disjoint on it. That
   * disjointness is measured per card on the floor a player opened, in
   * `tools/verify-shell-route.mjs`, so re-widening past the frame is a named
   * failure there rather than a quiet overlap.
   */
  /** Gap between the lead paragraph and the first stat card. */
  EMPIRE_STATS_TOP: 24,
  /** A stat card's own vertical padding, label above and reading below. */
  EMPIRE_STAT_PAD_V: 10,
});

/**
 * ===========================================================================
 * HOW FAST GDD §5's FLOOR RUNS, AND WHY EVERY ONE OF THESE IS A KNOB
 * ===========================================================================
 * The Empire surface advances a real `EmpireGym` through `src/empire/`'s own
 * `stepGym`. What §5 does NOT say is how often a check-in happens — §5.1
 * describes a check-in as something a player does ("check-in is 30-60 seconds:
 * collect, queue an upgrade") and gives no cadence for one. So the cadence is a
 * game-feel value in the CLAUDE.md sense, it lives here, and NONE OF THESE
 * NUMBERS HAS BEEN PLAYED. They are starting points.
 *
 * ===========================================================================
 * `CHECK_IN_SECONDS` IS ALSO THE §12.3 SAFETY PROPERTY, WHICH IS WHY IT IS A
 * DURATION OF WALL TIME AND NOT "ONE PER VISIT"
 * ===========================================================================
 * "Never punish daily engagement" has no tolerance band. Handing `stepGym` the
 * raw clock every time a player arrives, or every time a timer happens to fire,
 * makes the gym a function of the player's fidgeting: `production.ts` quantises
 * a gap to whole `EMPIRE_TUNING.TICK_SECONDS` and `stepGym` then moves the
 * collection mark to the exact reading, so sub-tick fragments are DISCARDED.
 * Measured on the shipped engine in `empireFloor.test.ts`: a gym collected 1200
 * times at half-second offsets over 600 seconds banks **0** Gym Bucks where the
 * same 600 seconds collected on whole ticks banks 11.063625. Twice the
 * attention, nothing to show for it.
 *
 * So the floor takes its check-ins at multiples of this constant OF ELAPSED
 * WALL TIME, and at no other moment. How often the player opens the surface,
 * how often the refresh timer fires, and whether the tab was backgrounded
 * cannot move any reading — that equality is what `empireFloor.test.ts` sweeps
 * and pins at zero, with the fragmenting variant kept runnable beside it as the
 * non-zero control.
 */
export const EMPIRE_FLOOR = Object.freeze({
  /**
   * Wall-clock seconds between two of the floor's check-ins.
   *
   * Fast enough that a player watching the floor sees the collected readings
   * move several times a minute; slow enough that a check-in still reads as an
   * event rather than as a frame. A knob, not a derivation.
   */
  CHECK_IN_SECONDS: 10,

  /**
   * How often the surface re-reads the floor while it is the surface on screen.
   *
   * Purely a redraw rate. It cannot change any reading — see the section above
   * — so this is the one knob here that is safe to turn on taste alone.
   */
  REFRESH_MS: 500,

  /**
   * Decimal places a Gym Bucks reading is drawn to.
   *
   * The idle line pays `EMPIRE_TUNING.GYM_BUCKS_BASE_PER_HOUR` an hour at
   * `OFFLINE_EARNINGS_FRACTION`, so a second is worth about a sixtieth of a
   * Buck; two decimals would leave the "since check-in" row apparently frozen
   * for a second at a time.
   */
  READING_DECIMALS: 3,

  /**
   * NOT A KNOB. Flagged in place, the way `cutInTuning.ts` flags its own §12.3
   * value, because it sits in a block whose whole point is that a playtester
   * turns everything in it.
   *
   * A unit conversion. The platform hands the shell milliseconds and
   * `src/empire/` counts in seconds; turning this makes the floor lie about the
   * clock rather than tuning anything. It lives here because
   * `src/tuning/audit.ts` allows a numeric literal only inside a registered
   * constants home, and that rule is worth more than the awkwardness of one
   * structural value sitting beside three real ones.
   */
  MILLISECONDS_PER_SECOND: 1000,
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

  /** Session surface -> Gym Empire floor (GDD §5). */
  EMPIRE_NAV_LABEL: 'GYM EMPIRE',
  EMPIRE_NAV_HINT: 'Opens the gym empire floor.',

  /** Empire surface -> back to the daily loop. */
  LEAVE_EMPIRE_LABEL: 'BACK TO TRAINING',
  LEAVE_EMPIRE_HINT: 'Returns to the daily session.',

  /**
   * Empire floor copy — no federation, brand, or athlete names (§7.3 / §12.3).
   *
   * THE LEAD SAYS WHAT THE SCREEN IS AND WHAT IT IS NOT, because the sentence
   * it replaces did not. That one read "Idle production is live in code; this
   * screen reads it" over a floor that called `createEmpireState()` once and
   * never stepped it — true about the repository, false about the screen, and
   * aimed at a player rather than at a reader. This one is about what the
   * player is looking at: the gym runs on this sitting's clock, and there is no
   * backend and no savefile behind it, so a reload opens a new gym at zero.
   *
   * NO NUMBER APPEARS IN IT. The check-in cadence is a knob in `EMPIRE_FLOOR`
   * above; naming it here would make this sentence go stale the first time a
   * playtester turned that knob, which is the failure mode this codebase keeps
   * recording.
   */
  EMPIRE_TITLE: 'GYM EMPIRE',
  EMPIRE_LEAD:
    'GDD §5 running on this sitting’s clock: time passes, the gym checks in, the numbers move. Nothing is saved — reload and a new gym opens at zero.',
  EMPIRE_STAT_BUCKS: 'GYM BUCKS',
  /** What the wall clock has produced since the last check-in and not yet paid in. */
  EMPIRE_STAT_PENDING: 'SINCE CHECK-IN',
  EMPIRE_STAT_REP: 'REPUTATION',
  EMPIRE_STAT_ROSTER: 'ROSTER',
  EMPIRE_STAT_EQUIPMENT: 'EQUIPMENT',
  /** The gym's own `EmpireClock`, in seconds — not the app's uptime. */
  EMPIRE_STAT_CLOCK: 'GYM CLOCK (SECONDS)',
  /**
   * GDD §5.1's away summary, ruled 2026-08-18: wall time past the offline cap
   * is acknowledged on this row and not simulated. A number and a state — the
   * value is the forfeited span, and zero is the state where the cap has never
   * bitten. No cap figure appears in the label on purpose: the cap is
   * `EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS`, a knob, and copy that named it
   * would go stale the first time a playtester turned it.
   */
  EMPIRE_STAT_AWAY: 'AWAY PAST THE CAP (SECONDS)',
});
