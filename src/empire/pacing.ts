/**
 * pacing.ts — GDD §5.14 Stage B: the economy pacing simulator.
 *
 * The staged plan (`docs/GDD.md` §5.14) sequences this before any UI or
 * upgrade-axis work on purpose: `ladderView.tsx`'s own header carries an
 * explicit, unverified claim — "whether the four income magnitudes pace well
 * (garage to storage unit in about seven idle days, warehouse in about
 * twenty-two) is the gate's open question" — and nothing in the tree
 * measures it. This module measures it, against the REAL shipped engine, and
 * says what it finds. It does not decide whether the pacing is good; §12.1
 * is explicit that no test or critic may make that call, and none of the
 * assertions below claim to.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock reading, no randomness. Its imports are
 * `./empireCore` (`refuseWith`), `./empireTuning`, `./ladder`, `./management`
 * and `./production` (`offlineBankingHorizonSeconds`, for the sporadic gap
 * cap — see §2 below).
 *
 * ===========================================================================
 * 1. What this drives, and what it does not reimplement
 * ===========================================================================
 *
 * Every dollar figure, every offline-cap decision and every wear/condition/
 * failure computation below is `ladderCheckIn`'s, `moveUpLadder`'s,
 * `runLadder`'s, `managedCheckIn`'s or `runManagedGym`'s — real, shipped,
 * separately tested functions. This file supplies only WHEN to call them: a
 * check-in schedule per simulated player, and — for the one ladder policy
 * neither shipped `LadderPolicy` answers on its own (§3 below) — the
 * decision to relocate the instant a move is affordable. That is the same
 * "compose real primitives into a named policy" shape `ladder.ts`'s own
 * `cheapestAffordable`/`runLadder` and `management.ts`'s own `runManagedGym`
 * already use for THEIR policies; this module does not duplicate their
 * accrual, wear or failure arithmetic anywhere.
 *
 * ===========================================================================
 * 2. Four check-in policies, and why each is built the way it is
 * ===========================================================================
 *
 * `PACING_CHECK_IN_POLICIES` is the axis CLAUDE.md's own "richness on one
 * axis is not evidence about an axis nobody varied" section asks for: four
 * distinct real phone-open patterns, not one canonical player.
 *
 *   - `'watcher'` — the app open continuously. Check-ins land every
 *     `EMPIRE_TUNING.WALL_CLOCK_TICK_INTERVAL_SECONDS`, the REAL interval
 *     `AppShell.tsx`'s `GymHost` dispatches on, in `'online'` mode (the
 *     undiscounted rate). Every individual gap is far under the offline
 *     horizon, so the cap never engages for this policy — a genuinely
 *     present player is not an absence, which is the correct reading of
 *     `EarningsMode`'s own doc comment in `ladder.ts`.
 *   - `'few-times-a-day'` — four `'offline'`-mode check-ins a day, six hours
 *     apart. The six-hour gap is `EMPIRE_TUNING.SECONDS_PER_DAY` halved
 *     twice; both literal `2`s are `src/tuning/audit.ts`'s own
 *     `STRUCTURAL_IDIOMS` ("a halving"), which is what lets this policy read
 *     "four times a day" without a new tuning entry for the count.
 *   - `'once-a-day'` — one `'offline'`-mode check-in every
 *     `EMPIRE_TUNING.SECONDS_PER_DAY`.
 *   - `'sporadic'` — an irregular, deterministic four-gap cycle (half an
 *     hour, two hours, the real offline-banking horizon, one hour), built
 *     entirely from constants this directory already registers plus
 *     `offlineBankingHorizonSeconds()` — no new "irregular gap" array. The
 *     cycle's own period (15.5 real hours) does not divide a calendar day,
 *     so it drifts against day boundaries the way a genuinely sporadic
 *     opener would.
 *
 *     ITS CAP, STATED BECAUSE THE BRIEF ASKS FOR IT BY NAME: no gap in this
 *     policy exceeds `offlineBankingHorizonSeconds()`
 *     (`EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS` hours, the larger of the
 *     cap and the no-punish floor). Not because a longer real gap cannot
 *     happen — it plainly can, a player really can vanish for a week — but
 *     because `production.ts`'s own header proves accrual flat past that
 *     horizon: a longer gap would bank, wear and discard identically to one
 *     at the horizon, so sampling past it would not exercise any different
 *     shipped arithmetic. That is the reading of the task brief's "do not
 *     exceed it or you are testing something that cannot happen" this module
 *     takes, stated so a reader who expects a literal multi-day gap here
 *     knows why there is not one.
 *
 * Every policy's schedule additionally carries a check-in at every mark in
 * `EMPIRE_TUNING.PACING_REPORT_HORIZONS_SECONDS` at or under the run's own
 * horizon — see that constant's own doc comment — so a reading exists at
 * exactly the five report horizons regardless of whether the policy's
 * natural cadence would otherwise land there.
 *
 * ===========================================================================
 * 3. Ladder pacing: two measurements, both on real functions, neither a guess
 * ===========================================================================
 *
 * `runPacingLadder` composes `ladderCheckIn`/`nextLadderRung`/
 * `ladderMoveCost`/`moveUpLadder` into a policy neither shipped `LadderPolicy`
 * answers on its own: relocate the INSTANT a move is affordable, buy no
 * equipment. `'hoard'` never relocates at all; `'cheapest-affordable-first'`
 * can spend on a cheap equipment item before an expensive relocation,
 * conflating "how long until the gym can afford the move" (this module's
 * question) with "how long given a shopping list" (a different, real
 * question). This composed policy answers the first cleanly and is the
 * primary reading below.
 *
 * `runPacingLadderRealistic` is the second reading: the REAL, UNMODIFIED
 * `runLadder(schedule, 'cheapest-affordable-first')`, which does buy
 * equipment along the way. Comparing the two shows what equipment purchases
 * cost a real player in relocation time.
 *
 * THE LIMIT OF BOTH, STATED BECAUSE THE ENGINE HAS IT AND THIS FILE DOES NOT
 * PATCH AROUND IT: `runLadder` calls `ladderCheckIn` with no `mode` argument,
 * so it is `'offline'`-rated on every check-in regardless of the schedule's
 * own policy — there is no `'online'`-mode variant of the shipped composed
 * ladder run. So `runPacingLadderRealistic('watcher', …)` under-reports what
 * a true always-online player would earn, by the same online/offline gap
 * `runPacingLadder`'s own mode-aware loop measures directly. Fixing this
 * means adding a `mode` parameter to `runLadder` itself, which is a
 * `ladder.ts` edit and out of this round's scope; it is reported here rather
 * than silently worked around.
 *
 * ===========================================================================
 * 4. Management pacing: three REAL shipped policies, zero reimplementation
 * ===========================================================================
 *
 * The brief asks two things: does hiring the cheapest manager pay for
 * itself, and does manager auto-repair net out cheaper or costlier than
 * manual repair. Both are answered by three of `management.ts`'s own six
 * `ManagementPolicy` values, driven unmodified through the real
 * `runManagedGym` — no custom management loop exists in this file:
 *
 *   - `'hands-off'` — never hires, never repairs. The do-nothing baseline.
 *   - `'diligent'` — never hires; repairs proactively (manual schedule) and
 *     at every offered maintenance prompt. THE manual-repair comparison arm.
 *   - `'cheapskate'` — hires the cheapest tier once warning signs are
 *     visible, and actively declines every repair prompt afterward, relying
 *     wholly on that tier's own auto-repair. THE cheapest-manager comparison
 *     arm — chosen over inventing a fourth policy because it is real, it is
 *     already tested, and "hire once trouble is visible" is a more
 *     defensible model of when a player actually hires than "hire the
 *     instant it is affordable, before there is any visible reason to".
 *
 * `runPacingManagedGym` is a thin wrapper: build the schedule, take its
 * seconds (mode carries no meaning for `runManagedGym` — see the limit
 * below), call the real `runManagedGym`.
 *
 * THE SAME LIMIT AS §3's, IN THE SAME MECHANISM: `runManagedGym` also calls
 * its check-ins with no `mode` argument, so every management reading below —
 * `'watcher'` included — is computed at the `'offline'` income fraction.
 * Reported, not patched around, for the identical reason.
 */

import { refuseWith } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import {
  type EarningsMode,
  type LadderDestination,
  type LadderRun,
  type LadderRung,
  type LadderState,
  createLadderState,
  ladderCheckIn,
  ladderMoveCost,
  moveUpLadder,
  nextLadderRung,
  runLadder,
} from './ladder';
import { type ManagedRun, type ManagementPolicy, runManagedGym } from './management';
import { offlineBankingHorizonSeconds } from './production';

// ---------------------------------------------------------------------------
// Check-in policies and schedule generation
// ---------------------------------------------------------------------------

/**
 * Four distinct simulated phone-open patterns. See header §2 for what each
 * one is and why it is built the way it is.
 */
export const PACING_CHECK_IN_POLICIES = Object.freeze([
  'watcher',
  'few-times-a-day',
  'once-a-day',
  'sporadic',
] as const);

export type PacingCheckInPolicy = (typeof PACING_CHECK_IN_POLICIES)[number];

/** One scheduled check-in: when, and at which rate the gap it closes pays. */
export interface PacingScheduleEntry {
  readonly atSeconds: number;
  readonly mode: EarningsMode;
}

/**
 * The check-in offsets a policy's own natural cadence produces, before the
 * report horizons are unioned in by `pacingCheckInSchedule`. Whole ticks,
 * strictly ascending, never zero (a check-in at the opening mark closes no
 * gap).
 */
function naturalOffsetsSeconds(
  policy: PacingCheckInPolicy,
  horizonSeconds: number,
): readonly number[] {
  const offsets: number[] = [];
  if (policy === 'watcher') {
    const step = EMPIRE_TUNING.WALL_CLOCK_TICK_INTERVAL_SECONDS;
    for (let at = step; at <= horizonSeconds; at += step) offsets.push(at);
    return offsets;
  }
  if (policy === 'few-times-a-day') {
    // Four check-ins a day: the day, halved twice. See header §2.
    const step = EMPIRE_TUNING.SECONDS_PER_DAY / 2 / 2;
    for (let at = step; at <= horizonSeconds; at += step) offsets.push(at);
    return offsets;
  }
  if (policy === 'once-a-day') {
    const step = EMPIRE_TUNING.SECONDS_PER_DAY;
    for (let at = step; at <= horizonSeconds; at += step) offsets.push(at);
    return offsets;
  }
  // 'sporadic'. Header §2 has the derivation and the cap reasoning.
  const cycleSeconds: readonly number[] = [
    EMPIRE_TUNING.SECONDS_PER_HOUR / 2,
    EMPIRE_TUNING.SECONDS_PER_HOUR * 2,
    offlineBankingHorizonSeconds(),
    EMPIRE_TUNING.SECONDS_PER_HOUR,
  ];
  let at = 0;
  let cursor = 0;
  for (;;) {
    at += cycleSeconds[cursor % cycleSeconds.length] as number;
    if (at > horizonSeconds) break;
    offsets.push(at);
    cursor += 1;
  }
  return offsets;
}

/**
 * `policy`'s full schedule out to `horizonSeconds`: its own natural cadence,
 * unioned with every `EMPIRE_TUNING.PACING_REPORT_HORIZONS_SECONDS` mark at
 * or under the horizon, deduplicated and sorted. `'watcher'` checks in at
 * `'online'` mode throughout; every other policy is `'offline'` throughout,
 * matching real production behaviour (only a continuously visible screen is
 * `'online'` — see `EarningsMode`'s own doc comment in `ladder.ts`).
 */
export function pacingCheckInSchedule(
  policy: PacingCheckInPolicy,
  horizonSeconds: number,
): readonly PacingScheduleEntry[] {
  if (!PACING_CHECK_IN_POLICIES.includes(policy)) {
    refuseWith(`${String(policy)} is not a pacing check-in policy`);
  }
  if (!Number.isFinite(horizonSeconds) || horizonSeconds <= 0) {
    refuseWith(`a pacing horizon must be finite and above zero, received ${horizonSeconds}`);
  }
  const mode: EarningsMode = policy === 'watcher' ? 'online' : 'offline';
  const natural = naturalOffsetsSeconds(policy, horizonSeconds);
  const horizonMarks = EMPIRE_TUNING.PACING_REPORT_HORIZONS_SECONDS.filter(
    (mark) => mark <= horizonSeconds,
  );
  const merged = Array.from(new Set<number>([...natural, ...horizonMarks])).sort(
    (left, right) => left - right,
  );
  return Object.freeze(merged.map((atSeconds) => Object.freeze({ atSeconds, mode })));
}

// ---------------------------------------------------------------------------
// Ladder pacing
// ---------------------------------------------------------------------------

/** One check-in's ladder reading: what it banked, and whether it relocated. */
export interface PacingLadderReading {
  readonly atSeconds: number;
  readonly mode: EarningsMode;
  readonly rung: LadderRung;
  readonly gymBucks: number;
  readonly secondsBanked: number;
  readonly secondsDiscarded: number;
  readonly movedTo: LadderDestination | null;
}

/** One composed "relocate the instant it's affordable" run. */
export interface PacingLadderRun {
  readonly checkInPolicy: PacingCheckInPolicy;
  readonly horizonSeconds: number;
  readonly readings: readonly PacingLadderReading[];
  readonly finalState: LadderState;
  /** The first check-in at which each destination was reached, if any. */
  readonly firstMovedAtSeconds: Readonly<Partial<Record<LadderDestination, number>>>;
}

/**
 * Header §3's primary ladder measurement: relocate the instant a move is
 * affordable, buy no equipment. Every accrual, cap decision and relocation
 * below is `ladderCheckIn`'s and `moveUpLadder`'s.
 */
export function runPacingLadder(
  checkInPolicy: PacingCheckInPolicy,
  horizonSeconds: number,
): PacingLadderRun {
  const schedule = pacingCheckInSchedule(checkInPolicy, horizonSeconds);
  let state = createLadderState();
  const readings: PacingLadderReading[] = [];
  const firstMoved: Partial<Record<LadderDestination, number>> = {};
  for (const entry of schedule) {
    const checkedIn = ladderCheckIn(state, entry.atSeconds, entry.mode);
    state = checkedIn.state;
    let movedTo: LadderDestination | null = null;
    const destination = nextLadderRung(state.rung);
    if (destination !== null && state.gymBucks >= ladderMoveCost(destination)) {
      const outcome = moveUpLadder(state);
      if (outcome.kind === 'moved') {
        state = outcome.state;
        movedTo = outcome.to;
        firstMoved[outcome.to] = entry.atSeconds;
      }
    }
    readings.push(
      Object.freeze({
        atSeconds: entry.atSeconds,
        mode: entry.mode,
        rung: state.rung,
        gymBucks: state.gymBucks,
        secondsBanked: checkedIn.accrual.secondsBanked,
        secondsDiscarded: checkedIn.accrual.secondsDiscarded,
        movedTo,
      }),
    );
  }
  return Object.freeze({
    checkInPolicy,
    horizonSeconds,
    readings: Object.freeze(readings),
    finalState: state,
    firstMovedAtSeconds: Object.freeze(firstMoved),
  });
}

/**
 * Header §3's secondary ladder measurement: the real, unmodified
 * `runLadder(schedule, 'cheapest-affordable-first')` — a player who also
 * buys equipment along the way. Offline-rated throughout regardless of
 * `checkInPolicy`; see header §3's limit paragraph.
 */
export function runPacingLadderRealistic(
  checkInPolicy: PacingCheckInPolicy,
  horizonSeconds: number,
): LadderRun {
  const seconds = pacingCheckInSchedule(checkInPolicy, horizonSeconds).map(
    (entry) => entry.atSeconds,
  );
  return runLadder(seconds, 'cheapest-affordable-first');
}

// ---------------------------------------------------------------------------
// Management (staffing/condition/repair) pacing
// ---------------------------------------------------------------------------

/**
 * Header §4's management measurement: the real, unmodified
 * `runManagedGym(schedule, managementPolicy)`. Offline-rated throughout
 * regardless of `checkInPolicy`; see header §4's limit paragraph.
 */
export function runPacingManagedGym(
  checkInPolicy: PacingCheckInPolicy,
  managementPolicy: ManagementPolicy,
  horizonSeconds: number,
): ManagedRun {
  const seconds = pacingCheckInSchedule(checkInPolicy, horizonSeconds).map(
    (entry) => entry.atSeconds,
  );
  return runManagedGym(seconds, managementPolicy);
}

// ---------------------------------------------------------------------------
// Reading a run at one of the report horizons
// ---------------------------------------------------------------------------

/**
 * The reading recorded at exactly `horizonSeconds`, from a series either
 * `runPacingLadder` or `runPacingManagedGym` produced. Both carry an
 * `atSeconds` field and both series are guaranteed a reading at every
 * `EMPIRE_TUNING.PACING_REPORT_HORIZONS_SECONDS` mark at or under the run's
 * own horizon (`pacingCheckInSchedule` forces it), so this refuses only on a
 * horizon outside that guarantee — a caller asking a question the schedule
 * was never built to answer, not a silent gap.
 */
export function pacingReadingAtHorizon<T extends { readonly atSeconds: number }>(
  readings: readonly T[],
  horizonSeconds: number,
): T {
  const found = readings.find((reading) => reading.atSeconds === horizonSeconds);
  if (found === undefined) {
    refuseWith(`no reading recorded at the ${horizonSeconds}-second horizon`);
  }
  return found;
}

// ---------------------------------------------------------------------------
// A property the composed ladder loop must hold, checkable independently of
// any particular tuning value
// ---------------------------------------------------------------------------

/**
 * True if `readings`' rung never regresses — the ladder is one-way
 * (`ladder.ts` header §1), so a composed run that ever reports a rung behind
 * an earlier reading has a bug in the composition, not in the tuning.
 * Non-vacuous: `pacing.test.ts` drives a corrupted series through this and
 * shows it returns `false`.
 */
export function pacingLadderRungNeverRegresses(
  readings: readonly PacingLadderReading[],
): boolean {
  let previousIndex = -1;
  for (const reading of readings) {
    const index = EMPIRE_TUNING.LADDER_RUNGS.indexOf(reading.rung);
    if (index < previousIndex) return false;
    previousIndex = index;
  }
  return true;
}
