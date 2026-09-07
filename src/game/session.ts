/**
 * session.ts — the daily session loop (GDD §3.2, §3.3, §3.4).
 *
 * ```
 * Open app
 *   -> Next training decision (lift + intended RPE)
 *   -> Automated readiness from training history, as copy
 *   -> One lift-focused session (60-90 sec, timing-based sets)
 *   -> e1RM updated, streak incremented, feedback shown
 *   -> Done
 * ```
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT (CLAUDE.md "Pure logic is separate from UI", GDD §9.2)
 * ---------------------------------------------------------------------------
 *   - Zero React imports, zero I/O, zero side effects.
 *   - NO CLOCK. The day is an integer the caller supplies, and the beat
 *     durations in `SESSION_TUNING` are read by the UI's clock, not by this
 *     module. Nothing here calls `Date.now()`.
 *   - NO RANDOMNESS. The lift mechanic's per-rep seed is derived from
 *     (day, set, rep), so a session replays byte for byte.
 *   - Every transition returns a new state; inputs are never mutated.
 *
 * ---------------------------------------------------------------------------
 * THE NUMBER THAT MOVES AT THE CLOSE-OUT IS e1RM. NEVER TOTAL.
 * ---------------------------------------------------------------------------
 * GDD §3.2 states this as a constraint on whoever builds this loop, and §2 and
 * §6.4 are what it follows from: a Total is the sum of best successful
 * COMPETITION attempts, it is `null` until the first meet, and there were no
 * attempts today. `SessionCloseOut` therefore has no total field, no
 * "estimated total" and no projected one, and `sessionProjection` cannot carry
 * one — `ProjectionWithinReach<'record-training-session'>` narrows `totalKg` to
 * `null`, so a projected Total on a training session is a compile error in
 * `progression.ts` rather than a note here. `session.test.ts` also serialises
 * the close-out and fails on the word.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS MODULE DOES NOT DECIDE
 * ---------------------------------------------------------------------------
 *   - THE REP. `lift.ts` owns descent, depth, reversal, drive and outcome. This
 *     module hands it a config and reads back one `LiftOutcome` per rep.
 *   - THE LOAD CURVE. `rpe.ts` turns (e1RM, reps, RPE) into a weight off the
 *     published chart. Nothing here interpolates or invents a percentage.
 *   - THE ESTIMATE. `e1rm.ts` turns a completed set into an e1RM, and REFUSES
 *     past the chart's coverage. This module propagates that refusal as `null`
 *     and shows no number; it never substitutes one.
 *   - THE STREAK. `streak.ts` owns `recordTrainingDay`, the grace, the Recovery
 *     Day offer and the 03:00 rollover. This module reports what the streak
 *     WOULD be if today is recorded, which is a projection, and the server
 *     decides.
 *   - FATIGUE. `fatigue.ts` owns it, hidden. This module passes the check-in in
 *     and passes a `SessionFeel` through to the mechanic. It reads no fatigue
 *     number, produces none, and `SessionCloseOut` has no field one could be
 *     bound to (GDD §3.4, §12.3: never a visible meter).
 *   - PROGRESSION. The client PROPOSES; the server publishes. This module
 *     builds the proposal and the optimistic projection and stops there.
 *
 * ---------------------------------------------------------------------------
 * HOW A SET BECOMES A NUMBER, AND WHY IT IS THE HONEST READING
 * ---------------------------------------------------------------------------
 * The prescription is `REPS_PER_SET` reps at the player's target RPE, on a bar
 * the chart says is that RPE for that rep count, nudged by the readiness
 * percentage GDD §3.2 asks to be surfaced.
 *
 *   ALL PRESCRIBED REPS MADE  ->  reported as (reps @ targetRpe). The player
 *                                 did what the prescription asked, so the
 *                                 prescription's own RPE is what it cost.
 *   MISSED AT REP k           ->  reported as (k-1 reps @ RPE 10). A rep that
 *                                 failed is failure by definition: zero reps in
 *                                 reserve, which is what RPE 10 MEANS on this
 *                                 chart. Nothing is invented — the RPE is read
 *                                 off the event, not guessed from bar speed.
 *   MISSED AT REP 1           ->  not reported at all. A set with no completed
 *                                 rep has no rep count to estimate from, and
 *                                 `progression.ts` refuses a set of zero reps.
 *
 * A missed rep ends the set. The remaining sets still run, at the same weight —
 * this loop does not autoregulate mid-session, and pretending it did would be
 * inventing a rule the GDD does not have.
 *
 * WHAT THIS MEANS FOR PROGRESSION, MEASURED RATHER THAN ASSERTED. An earlier
 * version of this comment claimed that "e1RM does NOT move on an ordinary day"
 * and that "a PR every day is not a PR". THAT WAS FALSE, and it is written out
 * here rather than quietly deleted because the shape of the mistake matters:
 * the claim was true of the ONE check-in the suite happened to exercise and of
 * no other.
 *
 * What actually happens, driven through this module's own public API
 * (`prescribeSession` -> `playedSetFrom` -> `sessionE1rmFrom` ->
 * `nextBestE1rm`), every rep made exactly on target:
 *
 *   CHECK-IN      NUDGE   30 SESSIONS FROM 200 kg     PRs
 *   grinding       -5%    200.00 kg                    0 / 30
 *   steady          0%    200.00 kg                    0 / 30
 *   ready          +2%    292.85 kg  (at RPE 6)       30 / 30
 *   primed         +5%    770.65 kg  (at RPE 6)       30 / 30
 *
 * The mechanism, in four steps, none of which is a bug on its own:
 *
 *   1. The load goes out as `e1RM x chart(reps, rpe) x (1 + nudge)` and the
 *      estimate comes back as `weight / chart(reps, rpe)`. The chart cancels,
 *      which is the round trip `e1rm.ts` exists to protect and is CORRECT. On a
 *      flat check-in it is the whole story and the number holds.
 *   2. On a positive check-in the surviving factor is `(1 + nudge)`, so the set
 *      reports an e1RM above the one it was prescribed from.
 *   3. `nextBestE1rm` is monotone and its cap
 *      (`MAX_E1RM_GAIN_FRACTION_PER_SESSION`, 6%) is above the largest nudge
 *      (5%), so the cap never binds and the higher number is kept.
 *   4. `sessionServer.todayForLifter` prescribes tomorrow from the best on
 *      record — i.e. from the number today's nudge just minted. It compounds.
 *
 * `session.test.ts` sweeps all four bands across 137 e1RMs and five rungs and
 * pins the counts, and runs the 30-session loop above and pins the totals.
 *
 * THE FIX IS NOT HERE, AND DELIBERATELY SO. It is not `e1rm.ts` — the
 * cancellation is right, and paying a higher rung more for the same relative
 * performance is exactly the two-parts-disagree failure CLAUDE.md's one-formula
 * rule forbids. It is that `FATIGUE_TUNING.READINESS_LOAD_ADJUSTMENT_PERCENT`
 * is a FLAT CONSTANT paid for three unverified taps, with no coupling to what
 * the lifter has actually been doing. Session-over-session growth should scale
 * with RPE/effort history, and that belongs to the fatigue/progression module
 * when it is built. It is a RECORDED DEPENDENCY (GDD §3.4), not an oversight,
 * and a stopgap pacing constant here would be a knob somebody later has to
 * unpick. Until it lands, this module must not claim a scarcity it does not
 * provide — GDD §3.2's "a session e1RM PR where they set one" and §7.2's
 * "scarcity is the entire mechanic" are both stronger than the code earns.
 *
 * ALSO UNRESOLVED, and separate: the prescribed fraction of e1RM is the same
 * whatever the e1RM is, so the mechanic does not get harder as the number
 * climbs. GDD §3.4 gives multi-week arcs to Career mode and this loop leaves
 * them there.
 *
 * ---------------------------------------------------------------------------
 * THE KNOWN DEGENERACY IN THE RPE CHOICE. READ THIS BEFORE TUNING IT.
 * ---------------------------------------------------------------------------
 * GDD §3.3 calls the RPE choice "what makes the mode feel real". As built, the
 * five rungs differ in difficulty and in fatigue cost but NOT IN REWARD, and a
 * player optimising for e1RM should always take the lowest one.
 *
 * The arithmetic, because it is not obvious and it is not a bug in the code:
 * the load goes out as `e1RM x chart(reps, rpe) x (1 + nudge)` and the estimate
 * comes back as `weight / chart(reps, rpe)`, so the chart cancels and every
 * rung reports `e1RM x (1 + nudge)` — 210.0 kg from a 200 kg e1RM on a primed
 * day, at RPE 6 and at RPE 10 alike, differing only by the kilo or so lost to
 * rounding the bar down. Measured across the ladder: 209.6 at RPE 6, 208.8 at
 * RPE 10. The heavier rung pays LESS, by rounding noise.
 *
 * That cancellation is not something to fix here. It is exactly the round-trip
 * property `e1rm.ts` exists to protect and CLAUDE.md requires — "hitting the
 * target means your e1RM did not move" — and any rule that paid a higher rung
 * more for the same relative performance would be the drift that property
 * forbids.
 *
 * WHAT THE RUNGS DO DIFFER IN, so the choice is not empty in-session:
 *   - The bar. 76-92% of e1RM before the nudge, which the lift mechanic feels:
 *     at the bottom of the ladder its demand curve never exceeds the lifter's
 *     capacity and the rep goes up; at the top it does and the rep has to be
 *     driven. Measured in `sessionTuning.test.ts`.
 *   - Tomorrow. At the shipped template `5x3 @ RPE 6` indexes under
 *     `FATIGUE_TUNING.STRAIN_FREE_ALLOWANCE` and costs nothing, while
 *     `5x3 @ RPE 9` is strain 1.0 and makes tomorrow's window tighter.
 *   - Injury exposure. Only the top of the ladder passes
 *     `INJURY_STRAIN_THRESHOLD` at all (GDD §3.5).
 *   - Whether the session completes. A player 100 ms off the cue banks every
 *     rep at RPE 6 and none at RPE 10.
 *
 * THE FIX THAT WAS IDENTIFIED AND NOT BUILT, so whoever picks this up does not
 * have to find it again: an AMRAP top set. An extra rep beyond the prescription
 * is worth more when the bar is heavier — on the published chart a second rep
 * at 100% of e1RM is +4.7%, while an extra rep at 76% is +3.1% and takes ten
 * reps of the mechanic to reach. That gives the higher rung a real payoff using
 * only the published chart and inventing nothing. It was left out because it
 * adds a decision beat and makes session length unbounded at the bottom of the
 * ladder, which is the budget GDD §3.2 sets and this piece is measured against.
 *
 * ---------------------------------------------------------------------------
 * SHOWING UP IS NEVER PUNISHED (GDD §3.5, §12.3)
 * ---------------------------------------------------------------------------
 * Two places this loop could have broken that rule, and what it does instead:
 *
 *   - A SESSION THAT BANKS NOTHING. `progression.ts` will not accept a training
 *     session with no completed set, so a player who missed every rep cannot be
 *     credited a training day for it. Rather than let that end a streak, the
 *     close-out for such a session is a RETRY: the same day, the same check-in,
 *     a fresh RPE choice. The lightest choice on the ladder is a bar the lift
 *     mechanic's demand curve never stalls, so a player who taps at all has a
 *     session they can complete. `session.test.ts` pins the retry.
 *   - AN INJURY. `fatigue.ts`'s `cappedSession` cuts work sets on the affected
 *     lift and guarantees at least one survives, so a setback shortens a session
 *     and can never cost a day. This module applies that cap rather than
 *     reimplementing it.
 */

import {
  LUCKIEST_ROLLS,
  NEUTRAL_CHECK_IN,
  cappedSession,
  historyReadiness,
  nextTrainingAction,
  recordSession,
  sessionFeel,
  type FatigueState,
  type InjuryNotice,
  type LiftMoment,
  type MotivationAnswer,
  type NextTrainingAction,
  type ReadinessCheckIn,
  type ReadinessReport,
  type SessionFeel,
  type SessionRecord,
  type SimLift,
  type SleepAnswer,
  type SorenessAnswer,
} from './fatigue';
import { TO_FAILURE_RPE, tryEstimateE1rm } from './e1rm';
import { percentOf1RM, rawLoadForRpeTarget, roundLoad, type WeightUnit } from './rpe';
import type { LiftConfig, LiftOutcome, LiftResolution } from './lift';

import type { LiftKind } from './meet';
import {
  emptyProjection,
  projectedCount,
  projectedKg,
  type ProgressionProjection,
  type ProjectionWithinReach,
  type ProposalOfKind,
  type TrainingCardReport,
  type TrainingSetReport,
} from './progression';
import type { LocalWallClock } from './streak';
import {
  SESSION_COPY,
  SESSION_PROGRESSION_GUARD,
  SESSION_TUNING,
  type CheckInQuestion,
} from './sessionTuning';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * Where the loop is.
 *
 * `'set'` covers a rep being played AND the beat where its result is held —
 * the difference is a duration the UI counts, not a decision this module takes.
 * `'rest'` is the pause between work sets, which is the only beat that exists
 * purely for pacing.
 */
export type SessionPhase = 'check-in' | 'briefing' | 'set' | 'rest' | 'close-out';

export const SESSION_PHASES = Object.freeze([
  'check-in',
  'briefing',
  'set',
  'rest',
  'close-out',
] as const satisfies readonly SessionPhase[]);

/** One of the three taps, with the answer it carried. */
export type CheckInTap =
  | { readonly question: 'sleep'; readonly answer: SleepAnswer }
  | { readonly question: 'soreness'; readonly answer: SorenessAnswer }
  | { readonly question: 'motivation'; readonly answer: MotivationAnswer };

/** Everything the player can do. One event per meaningful tap or beat. */
export type SessionEvent =
  | { readonly kind: 'check-in-tap'; readonly tap: CheckInTap }
  /**
   * Retarget today's session to another competition lift. The caller supplies
   * the full next `SessionContext` (same day, new lift, that lift's e1RM)
   * because this module never talks to the cache. Legal on the opening
   * decision (briefing, before an RPE is chosen); later beats ignore it.
   */
  | { readonly kind: 'choose-lift'; readonly context: SessionContext }
  | { readonly kind: 'choose-rpe'; readonly rpe: number }
  /**
   * A rep of the lift mechanic resolved. `lift.ts` decided the outcome;
   * `executionQuality` is `executionQualityFrom` read off that same rep's
   * `LiftResolution`, not re-derived here — this module never re-grades a
   * rep, only carries the grade forward.
   */
  | { readonly kind: 'rep-resolved'; readonly outcome: LiftOutcome; readonly executionQuality: number }
  /** The rest beat elapsed (or was tapped through). */
  | { readonly kind: 'begin-set' }
  /** A session that banked nothing, taken again on the same day. */
  | { readonly kind: 'retry' };

/** The check-in as it fills up. `null` means "not tapped yet". */
export interface PartialCheckIn {
  readonly sleep: SleepAnswer | null;
  readonly soreness: SorenessAnswer | null;
  readonly motivation: MotivationAnswer | null;
}

export const EMPTY_CHECK_IN: PartialCheckIn = Object.freeze({
  sleep: null,
  soreness: null,
  motivation: null,
});

/**
 * What the app knows before the session starts. All of it comes from server
 * truth (via `progression.ts`) or from the app edge (the day).
 */
export interface SessionContext {
  /** Integer streak day. Resolved outside — this module never reads a clock. */
  readonly day: number;
  readonly lift: LiftKind;
  /** The e1RM loads are prescribed from, kg. */
  readonly e1rmKg: number;
  /** Best e1RM on record for this lift, kg, or null before the first one. */
  readonly bestE1rmKg: number | null;
  readonly streakBefore: number;
  /** What the streak becomes if today is recorded. From `streak.ts`'s `openDay`. */
  readonly streakIfTrainedToday: number;
  /** The hidden ledger. Read only, and only by `fatigue.ts`. */
  readonly fatigue: FatigueState;
}

/** The prescription. Every number in it came from the published chart. */
export interface SessionPlan {
  readonly lift: LiftKind;
  readonly targetRpe: number;
  readonly repsPerSet: number;
  /** After any injury cap (GDD §3.5). Never below one set. */
  readonly workSets: number;
  readonly e1rmKg: number;
  /** %1RM the chart gives for (repsPerSet, targetRpe). */
  readonly percentOf1rm: number;
  /** Load before the readiness nudge, unrounded. */
  readonly baseWeightKg: number;
  /** What actually goes on the bar, snapped to loadable increments. */
  readonly weightKg: number;
  /** The surfaced modifier, signed. GDD §3.2's "+5%". */
  readonly loadAdjustmentPercent: number;
  /** `weightKg / e1rmKg` — what the lift mechanic means by `loadRatio`. */
  readonly loadRatio: number;
}

/** One rep, as `lift.ts` resolved it and as this module read its execution. */
export interface RepResult {
  readonly outcome: LiftOutcome;
  /** 0..1. `executionQualityFrom`'s output — see there for how it is read. */
  readonly executionQuality: number;
}

/** One work set, as it was played. */
export interface PlayedSet {
  /** 1-based, for copy. */
  readonly setNumber: number;
  readonly outcomes: readonly LiftOutcome[];
  readonly goodReps: number;
  /** True when a rep was missed, i.e. the lifter met failure at this weight. */
  readonly wentToFailure: boolean;
  /** What the server is told. `null` when no rep was completed. */
  readonly report: TrainingSetReport | null;
}

/**
 * WHAT A DAY PAYS. TWO KINDS, AND GDD §3.2 RULED THE SECOND ONE.
 *
 * `'e1rm'` — a competition lift was trained and its best estimate can move.
 * `'training-iq'` — accessory day. `LiftKind` is the meet (§6.2) and stays three
 * members for ever, so an accessory session has no e1RM to show and the
 * close-out must not invent one — including in its WORDS. `closeOutCopyFor`
 * below is what makes that true of the headline as well as the number.
 */
export const SESSION_PAYOFFS = ['e1rm', 'training-iq'] as const;

export type SessionPayoff = (typeof SESSION_PAYOFFS)[number];

/**
 * The payoff beat.
 *
 * NO TOTAL FIELD, AND NONE MAY BE ADDED (GDD §3.2). No fatigue field either
 * (GDD §3.4, §12.3) — the only feedback about how today felt is
 * `barSpeedText`, which is one of five phrases and carries no number.
 */
export interface SessionCloseOut {
  readonly day: number;
  readonly lift: LiftKind;
  readonly targetRpe: number;
  readonly weightKg: number;
  readonly goodReps: number;
  readonly prescribedReps: number;
  /** The sets the server is told about. Empty when nothing was completed. */
  readonly sets: readonly TrainingSetReport[];
  /**
   * The best e1RM this session implies, kg, or `null` when there is none —
   * either because no rep was banked, or because `e1rm.ts` REFUSED the set. A
   * refusal shows no number rather than a substituted one.
   */
  readonly sessionE1rmKg: number | null;
  readonly previousBestE1rmKg: number | null;
  /**
   * THE NUMBER THE SCREEN SHOWS. What the best e1RM on record becomes once the
   * server has this session — `nextBestE1rm`, the same rule the server applies,
   * so the close-out cannot show a figure that changes when the response lands.
   */
  readonly newBestE1rmKg: number | null;
  readonly isPr: boolean;
  /** Kilos above the previous best, or `null` when this is not a PR. */
  readonly prGainKg: number | null;
  readonly streakBefore: number;
  /** What the streak becomes if the server records today. A projection. */
  readonly streakAfter: number;
  /** GDD §3.4's bar-speed cue, as copy. Qualitative; contains no number. */
  readonly barSpeedText: string;
  /**
   * WHAT THE DAY PAID, AND THEREFORE WHAT THE SCREEN IS ALLOWED TO SAY.
   *
   * A REAL FIELD, not an optional tag read structurally. It used to be the
   * latter — `sessionClient.ts` looked for `{ payoff?: unknown }` because
   * `session.ts` carried no discriminant — and the cost was exactly what §12.3
   * warns about in a different context: the client branched on the tag for the
   * NUMBERS while `headline` and `subhead` were chosen before anything knew what
   * kind of day it was. The words and the numbers now come out of the same
   * decision, in one function.
   */
  readonly payoff: SessionPayoff;
  readonly headline: string;
  readonly subhead: string;
  /**
   * False when nothing was banked. The client must not propose a training
   * session in that case (`progression.ts` refuses a session with no set), and
   * the close-out offers a retry instead of ending the day.
   */
  readonly canPropose: boolean;
  /** History outlook for the next day. Copy only — never a meter. */
  readonly outlookHeadline: string;
  readonly outlookDetail: string;
  /** Adaptive next action from the same ledger. */
  readonly nextAction: NextTrainingAction;
}

/** The whole loop, on one tap. */
export interface SessionState {
  readonly context: SessionContext;
  readonly phase: SessionPhase;
  readonly answers: PartialCheckIn;
  /** Available from the moment the third tap lands. */
  readonly feel: SessionFeel | null;
  /** The surfaced modifier (GDD §3.2). `feel.readiness`, verbatim. */
  readonly readiness: ReadinessReport | null;
  /** GDD §3.5's soft consequence, if one is running today. */
  readonly injury: InjuryNotice | null;
  readonly plan: SessionPlan | null;
  /** 0-based index of the set being played or rested before. */
  readonly setIndex: number;
  /** 0-based index of the rep about to be played inside the current set. */
  readonly repIndex: number;
  readonly completedSets: readonly PlayedSet[];
  readonly repsThisSet: readonly RepResult[];
  readonly closeOut: SessionCloseOut | null;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function scrub(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(SESSION_TUNING.PRECISION_DECIMALS));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** A rep the bar actually went up for. A high squat is a red light, not a rep. */
export function isMadeRep(outcome: LiftOutcome): boolean {
  return outcome !== 'miss';
}

/**
 * Which lift the rotation programmes for this day (GDD §3.2).
 *
 * The player may pick a different competition lift on the check-in; this is
 * the default the session opens on, not the only lift they can train.
 *
 * Modulo, corrected for negative days so a day index before the epoch does not
 * index off the front of the rotation.
 */
export function liftForDay(day: number): LiftKind {
  if (!Number.isSafeInteger(day)) {
    throw new RangeError(`session: day must be a safe integer day index, received ${day}.`);
  }
  const rotation = SESSION_TUNING.LIFT_ROTATION;
  const index = ((day % rotation.length) + rotation.length) % rotation.length;
  // UNTRUSTED KEY: an array index is an index signature under
  // `noUncheckedIndexedAccess`, so the compiler widens this and the guard is
  // its idea rather than ours.
  const lift: LiftKind | undefined = rotation[index];
  if (lift === undefined) {
    throw new RangeError('session: LIFT_ROTATION is empty, so there is no lift to train.');
  }
  return lift;
}

/** The three lifts share a name in both vocabularies; the cast is that fact. */
function asSimLift(lift: LiftKind): SimLift {
  return lift;
}

/** The check-in, once all three taps have landed. `null` until then. */
export function completeCheckIn(partial: PartialCheckIn): ReadinessCheckIn | null {
  const { sleep, soreness, motivation } = partial;
  if (sleep === null || soreness === null || motivation === null) return null;
  return { sleep, soreness, motivation };
}

/** How many of the three questions have been answered. */
export function checkInProgress(partial: PartialCheckIn): number {
  return (
    (partial.sleep === null ? 0 : 1) +
    (partial.soreness === null ? 0 : 1) +
    (partial.motivation === null ? 0 : 1)
  );
}

/** The first question with no answer yet, or `null` once all three are in. */
export function nextCheckInQuestion(partial: PartialCheckIn): CheckInQuestion | null {
  if (partial.sleep === null) return 'sleep';
  if (partial.soreness === null) return 'soreness';
  if (partial.motivation === null) return 'motivation';
  return null;
}

// ---------------------------------------------------------------------------
// Prescription (GDD §3.3)
// ---------------------------------------------------------------------------

/**
 * The RPE target the ladder opens on. An index into `RPE_CHOICES` rather than a
 * value, so the two cannot disagree.
 */
export function defaultRpeChoice(): number {
  const choices = SESSION_TUNING.RPE_CHOICES;
  // UNTRUSTED KEY: `DEFAULT_RPE_INDEX` is a hand-maintained number and the list
  // beside it is hand-maintained too; nothing but a test ties them together.
  const rpe: number | undefined = choices[SESSION_TUNING.DEFAULT_RPE_INDEX];
  if (rpe === undefined) {
    throw new RangeError(
      `session: DEFAULT_RPE_INDEX ${SESSION_TUNING.DEFAULT_RPE_INDEX} is outside RPE_CHOICES.`,
    );
  }
  return rpe;
}

/**
 * Turn one RPE choice into a bar.
 *
 * The whole of GDD §3.3: "Player selects RPE target (6-10), not raw weight.
 * Game calculates load from current e1RM." The chart lookup is `rpe.ts`'s and
 * throws for a cell the published chart does not hold — this module lets that
 * refusal through rather than clamping the request onto a cell that exists.
 *
 * The readiness percentage is applied to the load, which is what
 * `FATIGUE_TUNING.READINESS_LOAD_ADJUSTMENT_PERCENT` is for and what GDD §3.2's
 * "Feeling primed +5%" means. It moves in both directions and it is the ONLY
 * thing the check-in changes about the bar.
 *
 * @throws {RangeError} on a non-positive e1RM, or on an RPE / rep-count pair
 * the published chart has no cell for.
 */
export function prescribeSession(
  e1rmKg: number,
  lift: LiftKind,
  targetRpe: number,
  readiness: ReadinessReport,
  workSets: number,
  repsPerSet: number = SESSION_TUNING.REPS_PER_SET,
): SessionPlan {
  if (!Number.isSafeInteger(workSets) || workSets < 1) {
    throw new RangeError(`session: workSets must be a whole number >= 1, received ${workSets}.`);
  }
  // The chart load first, UNROUNDED, so the modifier is applied to the exact
  // percentage and only the final number is snapped. Snapping twice would round
  // a small nudge away entirely.
  const chartWeightKg = rawLoadForRpeTarget(e1rmKg, repsPerSet, targetRpe);
  const nudgedWeightKg = chartWeightKg * (1 + readiness.loadAdjustmentPercent / SESSION_TUNING.PERCENT_TO_FRACTION);
  const weightKg = roundLoad(nudgedWeightKg, {
    unit: SESSION_TUNING.LOAD_UNIT,
    mode: SESSION_TUNING.LOAD_ROUNDING_MODE,
  });
  return {
    lift,
    targetRpe,
    repsPerSet,
    workSets,
    e1rmKg,
    percentOf1rm: percentOf1RM(repsPerSet, targetRpe),
    baseWeightKg: scrub(nudgedWeightKg),
    weightKg,
    loadAdjustmentPercent: readiness.loadAdjustmentPercent,
    loadRatio: scrub(weightKg / e1rmKg),
  };
}

/**
 * How many work sets today actually has, after any setback (GDD §3.5).
 *
 * `cappedSession` is `fatigue.ts`'s, including its guarantee that at least one
 * work set always survives — so a setback shortens a session and can never cost
 * a streak day.
 */
export function workSetsForToday(
  context: SessionContext,
  targetRpe: number,
  repsPerSet: number = SESSION_TUNING.REPS_PER_SET,
): number {
  const planned: SessionRecord = {
    day: context.day,
    lift: asSimLift(context.lift),
    topRpe: targetRpe,
    workSets: SESSION_TUNING.WORK_SETS,
    repsPerSet,
  };
  return cappedSession(planned, context.fatigue).workSets;
}

// ---------------------------------------------------------------------------
// The rep, handed to `lift.ts`
// ---------------------------------------------------------------------------

/**
 * Where in the session this rep is, for `fatigue.ts`'s within-session term.
 * GDD §3.4's "same-day" horizon: later sets and later reps carry more burden,
 * which reaches the mechanic as a narrower window and nothing else.
 */
export function liftMomentFor(state: SessionState): LiftMoment {
  return { workSetsCompleted: state.setIndex, repsCompletedInSet: state.repIndex };
}

/**
 * Deterministic per-rep seed. Not randomness — the mechanic's wobble jitter has
 * to come from somewhere, and deriving it from the rep's coordinates means a
 * session replays identically.
 */
export function repSeed(day: number, setIndex: number, repIndex: number): number {
  return (
    SESSION_TUNING.SEED_BASE +
    day +
    setIndex * SESSION_TUNING.SEED_SET_STRIDE +
    repIndex * SESSION_TUNING.SEED_REP_STRIDE
  );
}

/**
 * The config for the rep about to be played.
 *
 * `feel` is what carries GDD §3.4 into the mechanic: `lift.ts` uses it for the
 * timing-window width and the bar-speed capacity nudge, and for nothing else.
 * No fatigue number crosses this boundary in either direction.
 *
 * @throws {RangeError} when called outside a set.
 */
export function repConfigFor(state: SessionState): LiftConfig {
  const plan = state.plan;
  if (plan === null) {
    throw new RangeError('session: there is no plan yet, so there is no rep to configure.');
  }
  const feel = state.feel;
  return {
    // THE REAL LIFT, NOT A SIMULATED STAND-IN. This used to read
    // `simKindFor(state.context.lift)`, which mapped a deadlift day onto
    // squat's beat; deadlift has its own phase model now and that stopgap is
    // deleted, so the day's actual lift goes straight through.
    kind: state.context.lift,
    loadRatio: plan.loadRatio,
    seed: repSeed(state.context.day, state.setIndex, state.repIndex),
    ...(feel === null ? {} : { feel }),
    moment: liftMomentFor(state),
  };
}

// ---------------------------------------------------------------------------
// Resolving a set
// ---------------------------------------------------------------------------

/**
 * How well a rep was executed, 0..1, read off the `LiftResolution` `lift.ts`
 * already produced — this does not re-grade the rep, only reads its own
 * recorded grades back.
 *
 * Averaged over the rep's DRIVE-cue timings only, not the depth-release cue
 * too: depth-release precision and drive tap-rate are the two SEPARATE
 * dimensions Sprint 3's window/tap-rate pieces built (see `liftTuning.ts`'s
 * `DRIVE_WINDOW_MS` header), and depth is already covered by whether the rep
 * was made at all — a buried or shallow release fails the rep outright rather
 * than merely costing quality. The drive is what still has something to say
 * once a rep is already known to have succeeded.
 *
 * A rep with NO drive timings — reachable at light loads, where
 * `ascentDemand` never goes negative and the bar rises without a boost, see
 * `driveAttemptsFor`'s header — reads as full quality: nothing was asked of
 * the lifter, so nothing was botched.
 */
export function executionQualityFrom(resolution: LiftResolution): number {
  const driveTimings = resolution.timings.filter((timing) => timing.cue === 'drive');
  if (driveTimings.length === 0) return 1;
  const sum = driveTimings.reduce((total, timing) => total + timing.quality, 0);
  return scrub(clamp01(sum / driveTimings.length));
}

/**
 * One played set, as the server will be told about it.
 *
 * See the module header for why a failed rep reports RPE 10: on a
 * reps-in-reserve chart that is the definition of failure, not an estimate of
 * it. The reps reported are the ones the lifter actually completed.
 *
 * `TrainingSetReport.executionQuality` is the GOOD reps' `executionQuality`
 * averaged — a missed rep already routes the whole set to `TO_FAILURE_RPE`
 * and has no execution quality of its own to contribute (there was no
 * successful drive to grade). A set with no good reps reports `null`
 * regardless, same as before this field existed, so the average is never
 * computed over an empty list.
 */
export function playedSetFrom(
  plan: SessionPlan,
  setNumber: number,
  results: readonly RepResult[],
): PlayedSet {
  let goodReps = 0;
  let wentToFailure = false;
  let qualitySum = 0;
  for (const { outcome, executionQuality } of results) {
    if (isMadeRep(outcome)) {
      goodReps += 1;
      qualitySum += executionQuality;
    } else {
      wentToFailure = true;
    }
  }
  const report: TrainingSetReport | null =
    goodReps < 1
      ? null
      : {
          lift: plan.lift,
          // `weight`, not `weightKg`: the row makes no unit claim. The claim is
          // one level up, on `TrainingCardReport`, at the grain the loop
          // actually has a unit — `SESSION_TUNING.LOAD_UNIT`, which is also the
          // unit `prescribeSession` snapped this number onto.
          weight: plan.weightKg,
          reps: goodReps,
          rpe: wentToFailure ? TO_FAILURE_RPE : plan.targetRpe,
          executionQuality: scrub(clamp01(qualitySum / goodReps)),
        };
  return {
    setNumber,
    outcomes: results.map((result) => result.outcome),
    goodReps,
    wentToFailure,
    report,
  };
}

/** The session's best e1RM estimate, and the execution quality behind it. */
export interface SessionE1rmEstimate {
  readonly e1rmKg: number;
  /** `TrainingSetReport.executionQuality` of the SET that produced `e1rmKg` — not a session-wide average, so the number `nextBestE1rm` reads is evidence about the specific rep the estimate came from. */
  readonly executionQuality: number;
}

/**
 * The best e1RM the session's sets imply, kg, plus the execution quality
 * behind that specific estimate — or `null`.
 *
 * `null` covers both "no set was completed" and "`e1rm.ts` refused" — the
 * second happens past the published chart's coverage, and this module shows no
 * number rather than papering over the refusal with a second formula (which
 * CLAUDE.md bans outright). `tryEstimateE1rm` reads only `{weight, reps, rpe}`
 * — the domain-pure inputs — so a set's `executionQuality` never touches the
 * estimate itself; it only rides alongside the winning set's number for
 * `nextBestE1rm` to read once the pure estimate already exists.
 */
export function sessionE1rmFrom(sets: readonly TrainingSetReport[]): SessionE1rmEstimate | null {
  let best: SessionE1rmEstimate | null = null;
  for (const set of sets) {
    const estimate = tryEstimateE1rm({ weight: set.weight, reps: set.reps, rpe: set.rpe });
    if (estimate === null) continue;
    if (best === null || estimate > best.e1rmKg) {
      best = { e1rmKg: scrub(estimate), executionQuality: set.executionQuality };
    }
  }
  return best;
}

/**
 * What the best e1RM on record becomes, given a session's estimate.
 *
 * SHARED, NOT DUPLICATED, and that is the point of it living here. It is the
 * SERVER'S rule — `sessionServer.ts` is its only authoritative caller — but an
 * optimistic projection has to predict the server or the close-out shows a
 * number that visibly changes when the response lands. A client with its own
 * copy of this rule is a client whose copy can drift, so there is one.
 *
 * Two clauses:
 *
 *   1. MONOTONE. A training session never lowers the best on record. A lifter
 *      who had a bad day keeps their number (GDD §12.3: never punish showing
 *      up).
 *   2. CAPPED, AND NOW BY A RANGE RATHER THAN A POINT. One session may not
 *      raise it by more than `MAX_E1RM_GAIN_FRACTION_PER_SESSION`, same bound
 *      as before — but which fraction of that ceiling actually applies now
 *      scales with the winning set's `executionQuality`, linearly between
 *      `MIN_E1RM_GAIN_FRACTION_PER_SESSION` (worst) and `MAX_...` (best),
 *      via `qualityScaledGainFraction`. At `executionQuality === 1` this is
 *      byte-identical to the old flat-6% rule — every existing pinned number
 *      in `session.test.ts`'s and `sessionServer.test.ts`'s canned-outcome
 *      fixtures uses quality 1 and is unaffected by this change. It is still
 *      a bound on a lying client, not a pacing lever, and it is NOT a
 *      solution to long-run progression pacing — see the next paragraph,
 *      which this change does not touch.
 *
 * SO NOTHING HERE PACES SESSION-OVER-SESSION GROWTH, and the header's measured
 * table is what that still costs: on a positive check-in this returns a higher
 * number every session, forever, and tomorrow's bar is prescribed from it.
 * That is a DIFFERENT axis from the one this function now covers — quality
 * scales how much of ONE session's already-earned gain is trusted, not how
 * many sessions in a row may earn one. The coupling that fixes THAT is still a
 * recorded dependency on the fatigue/progression module (GDD §3.4): the
 * readiness nudge has to scale with RPE/effort history instead of being a flat
 * constant. Do not read the quality scaling above as having closed that gap.
 */
export function nextBestE1rm(
  held: number | null,
  session: SessionE1rmEstimate | null,
): number | null {
  if (session === null) return held;
  if (held === null) return session.e1rmKg;
  if (session.e1rmKg <= held) return held;
  const fraction = qualityScaledGainFraction(session.executionQuality);
  const ceiling = held * (1 + fraction);
  return Math.min(session.e1rmKg, ceiling);
}

/**
 * The fraction of `held` a session may add, scaled linearly by execution
 * quality between `MIN_E1RM_GAIN_FRACTION_PER_SESSION` (a botched-but-still-PR
 * set) and `MAX_E1RM_GAIN_FRACTION_PER_SESSION` (a clean one). Both ends are
 * playtesting placeholders (`sessionTuning.ts`), not derivations — the shape
 * (linear, not stepped) is the only thing asserted as a property rather than
 * a value, in `session.test.ts`.
 */
function qualityScaledGainFraction(executionQuality: number): number {
  const quality = clamp01(executionQuality);
  const { MIN_E1RM_GAIN_FRACTION_PER_SESSION, MAX_E1RM_GAIN_FRACTION_PER_SESSION } =
    SESSION_PROGRESSION_GUARD;
  return (
    MIN_E1RM_GAIN_FRACTION_PER_SESSION +
    (MAX_E1RM_GAIN_FRACTION_PER_SESSION - MIN_E1RM_GAIN_FRACTION_PER_SESSION) * quality
  );
}

// ---------------------------------------------------------------------------
// The close-out
// ---------------------------------------------------------------------------

/** The two strings at the top of the payoff beat. */
export interface CloseOutCopy {
  readonly headline: string;
  readonly subhead: string;
}

/** What `closeOutCopyFor` needs to know. Nothing about the lift, on purpose. */
export interface CloseOutCopyInput {
  readonly payoff: SessionPayoff;
  /** False when nothing was banked. Outranks everything else. */
  readonly canPropose: boolean;
  /** The client's PR prediction. Only ever consulted on an `'e1rm'` day. */
  readonly isPr: boolean;
  readonly goodReps: number;
  readonly prescribedReps: number;
}

/**
 * THE WORDS ON THE PAYOFF BEAT, CHOSEN BY WHAT THE DAY ACTUALLY PAID.
 *
 * ===========================================================================
 * WHY THIS IS A FUNCTION AND NOT FOUR TERNARIES INSIDE `closeOutFrom`
 * ===========================================================================
 *
 * Because the ternaries did not have the payoff in scope, and got it wrong in
 * the one direction nobody looked. There were three headlines — NEW e1RM,
 * SESSION LOGGED, NOTHING BANKED — and the choice between them was the client's
 * PR prediction and nothing else. GDD §3.2 rules that accessory day does not get
 * an e1RM close-out; the numbers honoured it (no `bestE1rmKg` write, no e1RM
 * node) and the words did not, so an accessory day on a primed readiness
 * rendered a screen headed "NEW e1RM" over a Training IQ row with no number in
 * it. A screen headed "NEW e1RM" is an e1RM close-out whatever the digits do.
 *
 * IT WAS INVISIBLE BECAUSE THE ONE FIXTURE THAT COULD HAVE SHOWN IT WAS BUILT ON
 * THE ONE READINESS THAT ARITHMETICALLY CANNOT PR. Worth recording next to the
 * fix, because that is a demonstration pointed away from the case where it
 * fails, which is a shape this run has now found more than once.
 *
 * THE ORDER OF THE BRANCHES IS THE RULING:
 *
 *   1. NOTHING BANKED outranks the payoff kind. A day with no completed rep has
 *      nothing to say about e1RM or Training IQ, and the copy is lift-agnostic
 *      already — it offers the retry.
 *   2. ACCESSORY DAY next, BEFORE the PR check. `isPr` is a statement about an
 *      e1RM, and an accessory day has none for it to be about.
 *   3. Only then the e1RM branches, unchanged.
 *
 * `payoff` is a `SessionPayoff` rather than a boolean so a third payoff — if the
 * design ever grows one — is a compile error here rather than a silent fall
 * through to the e1RM copy.
 */
export function closeOutCopyFor(input: CloseOutCopyInput): CloseOutCopy {
  if (!input.canPropose) {
    return {
      headline: SESSION_COPY.CLOSE_OUT_EMPTY_HEADLINE,
      subhead: SESSION_COPY.CLOSE_OUT_EMPTY_SUBHEAD,
    };
  }
  const short = input.goodReps < input.prescribedReps;
  switch (input.payoff) {
    case 'training-iq':
      return {
        headline: SESSION_COPY.CLOSE_OUT_ACCESSORY_HEADLINE,
        subhead: short
          ? SESSION_COPY.CLOSE_OUT_ACCESSORY_SHORT_SUBHEAD
          : SESSION_COPY.CLOSE_OUT_ACCESSORY_SUBHEAD,
      };
    case 'e1rm':
      if (input.isPr) {
        return {
          headline: SESSION_COPY.CLOSE_OUT_PR_HEADLINE,
          subhead: SESSION_COPY.CLOSE_OUT_PR_SUBHEAD,
        };
      }
      return {
        headline: SESSION_COPY.CLOSE_OUT_HELD_HEADLINE,
        subhead: short ? SESSION_COPY.CLOSE_OUT_SHORT_SUBHEAD : SESSION_COPY.CLOSE_OUT_HELD_SUBHEAD,
      };
  }
}

/**
 * RE-TAG A CLOSE-OUT AS AN ACCESSORY DAY'S — copy, PR flag and e1RM fields.
 *
 * ===========================================================================
 * WHY THIS EXISTS AT ALL, STATED PLAINLY
 * ===========================================================================
 *
 * Accessory day is RULED (GDD §3.2) and PARTLY BUILT. `sessionServer.ts`
 * enforces the boundary — an accessory set cannot write `bestE1rmKg` — and
 * `CloseOutView` has a first-class Training IQ branch. What does not exist yet
 * is an accessory day in `SESSION_TUNING.LIFT_ROTATION`, because `liftForDay`
 * hands back a `LiftKind` and `LiftKind` is the meet's three lifts for ever.
 * Widening the rotation is the piece that owns the server side.
 *
 * So this is the one door from an e1RM close-out to an accessory one, and it is
 * HERE rather than in the preview that currently calls it, because what an
 * accessory close-out says and what it carries is this module's business. When
 * the rotation lands, `closeOutFrom` calls `closeOutCopyFor` with
 * `'training-iq'` directly and this becomes unnecessary rather than wrong.
 *
 * WHAT IT CLEARS AND WHY. The e1RM fields go to `null` and `isPr` to false —
 * not because anything currently reads them on this branch (the screen does
 * not), but because they are a claim about a lift's estimate and an accessory
 * day has none to make. Leaving a live PR flag on a close-out headed "ACCESSORY
 * BANKED" would be the same half-truth one field over.
 */
export function asAccessoryCloseOut(closeOut: SessionCloseOut): SessionCloseOut {
  const copy = closeOutCopyFor({
    payoff: 'training-iq',
    canPropose: closeOut.canPropose,
    isPr: false,
    goodReps: closeOut.goodReps,
    prescribedReps: closeOut.prescribedReps,
  });
  return {
    ...closeOut,
    payoff: 'training-iq',
    sessionE1rmKg: null,
    newBestE1rmKg: null,
    isPr: false,
    prGainKg: null,
    headline: copy.headline,
    subhead: copy.subhead,
  };
}

function closeOutFrom(state: SessionState): SessionCloseOut {
  const plan = state.plan;
  if (plan === null) {
    throw new RangeError('session: cannot close out a session that was never prescribed.');
  }
  const reports: TrainingSetReport[] = [];
  let goodReps = 0;
  for (const set of state.completedSets) {
    goodReps += set.goodReps;
    if (set.report !== null) reports.push(set.report);
  }
  const sessionEstimate = sessionE1rmFrom(reports);
  const sessionE1rmKg = sessionEstimate === null ? null : sessionEstimate.e1rmKg;
  const previousBestE1rmKg = state.context.bestE1rmKg;
  const newBestE1rmKg = nextBestE1rm(previousBestE1rmKg, sessionEstimate);
  const isPr =
    newBestE1rmKg !== null &&
    (previousBestE1rmKg === null || newBestE1rmKg > previousBestE1rmKg);
  const canPropose = reports.length > 0;
  const prescribedReps = plan.workSets * plan.repsPerSet;

  // A competition lift was trained, because `liftForDay` only hands back one.
  // `asAccessoryCloseOut` is the other door and it re-runs this same function.
  const payoff: SessionPayoff = 'e1rm';
  const { headline, subhead } = closeOutCopyFor({
    payoff,
    canPropose,
    isPr,
    goodReps,
    prescribedReps,
  });

  const nextDay = state.context.day + 1;
  let ledger = state.context.fatigue;
  const recorded = sessionRecordFromReports(state.context.day, plan.lift, reports);
  if (recorded !== null) {
    ledger = recordSession(ledger, recorded, LUCKIEST_ROLLS).state;
  }
  const outlook = historyReadiness(ledger, nextDay);
  const action = nextTrainingAction(ledger, nextDay);

  return {
    day: state.context.day,
    lift: plan.lift,
    targetRpe: plan.targetRpe,
    weightKg: plan.weightKg,
    goodReps,
    prescribedReps,
    sets: reports,
    sessionE1rmKg,
    previousBestE1rmKg,
    newBestE1rmKg,
    isPr,
    prGainKg:
      isPr && newBestE1rmKg !== null && previousBestE1rmKg !== null
        ? scrub(newBestE1rmKg - previousBestE1rmKg)
        : null,
    streakBefore: state.context.streakBefore,
    streakAfter: canPropose ? state.context.streakIfTrainedToday : state.context.streakBefore,
    barSpeedText: state.feel === null ? '' : state.feel.barSpeedText,
    payoff,
    headline,
    subhead,
    canPropose,
    outlookHeadline: outlook.headline,
    outlookDetail: outlook.detail,
    nextAction: action,
  };
}

function sessionRecordFromReports(
  day: number,
  lift: SimLift,
  reports: readonly TrainingSetReport[],
): SessionRecord | null {
  if (reports.length === 0) return null;
  let topRpe = Number.NEGATIVE_INFINITY;
  let totalReps = 0;
  for (let i = 0; i < reports.length; i += 1) {
    const set = reports[i];
    if (set === undefined) continue;
    if (set.rpe > topRpe) topRpe = set.rpe;
    totalReps += set.reps;
  }
  return {
    day,
    lift,
    topRpe,
    workSets: reports.length,
    repsPerSet: Math.ceil(totalReps / reports.length),
  };
}

// ---------------------------------------------------------------------------
// The proposal and the projection — the client's ask, and nothing more
// ---------------------------------------------------------------------------

/**
 * COMPILE-TIME ASSERTION: THE UNITS THE LOOP CAN LOAD IN ARE EXACTLY THE UNITS A
 * CARD CAN DECLARE.
 *
 * `SESSION_TUNING.LOAD_UNIT` is an `rpe.ts` `WeightUnit`; `TrainingCardReport`
 * is two string literals in `progression.ts`, which imports nothing from the
 * session loop and should not. Two unions written in two files that must agree
 * are one boundary only while something says so — add a third unit to the loader
 * (`ROUNDING_INCREMENT` gains a row) and `sessionProposal` below would have a
 * value it cannot declare, silently, because a `switch` with no arm for it just
 * falls through. This fails instead, in both directions.
 */
type LoadUnitsAreExactlyCardUnits = [WeightUnit] extends [TrainingCardReport['unit']]
  ? [TrainingCardReport['unit']] extends [WeightUnit]
    ? true
    : never
  : never;
export const THE_LOOPS_LOAD_UNITS_ARE_EXACTLY_A_CARDS: LoadUnitsAreExactlyCardUnits = true;

/**
 * What the client asks the server to record. INPUTS ONLY: the sets as they were
 * performed. There is no e1RM in it and no Total in it — `progression.ts`'s
 * allowlists forbid both, and the server derives e1RM from these four numbers
 * per set with `e1rm.ts` so the two halves of the app cannot disagree.
 *
 * `null` when the session banked nothing. See the header on why that is a
 * retry rather than a lost day.
 *
 * ---------------------------------------------------------------------------
 * THE UNIT IS DECLARED FROM THE CONSTANT THAT DECIDED IT, NOT TYPED AS A LITERAL
 * ---------------------------------------------------------------------------
 * `SESSION_TUNING.LOAD_UNIT` is the unit `prescribeSession` snapped every one of
 * these weights onto — `roundLoad(nudged, { unit: SESSION_TUNING.LOAD_UNIT })`,
 * one function above. Writing `unit: 'kg'` here instead would be a label typed
 * by a module that did not decide the number: true today, and still saying `kg`
 * on the day the loop learns to prescribe in pounds. That is the defect this
 * whole boundary exists to stop, one field over.
 *
 * BUILDING THE CARD REQUIRES NAMING THE UNIT, and the `?:` below is that
 * requirement showing up as code rather than as a convention: the arms carry
 * different field names, so there is no object literal that satisfies
 * `TrainingCardReport` without having branched.
 *
 * WHAT THIS DOES NOT CLAIM, because the honest statement is smaller than it
 * looks: flipping `LOAD_UNIT` to `'lb'` does NOT produce a pound session.
 * `prescribeSession` computes the load from a KILOGRAM e1RM (`context.e1rmKg`,
 * off `record.bestE1rmKg`) and `LOAD_UNIT` only chooses the snapping grid, so a
 * flipped constant yields a kilogram magnitude on a 5-unit grid. The card would
 * then declare `'lb'` over kilogram numbers and `sessionServer.ts` would refuse
 * the whole session. THAT IS THE INTENDED FAILURE: loud and unrecorded beats
 * quiet and banked, and `bestE1rmKg` is monotone so a banked mistake is
 * permanent. Making the magnitude follow the unit is a real change to the
 * loading path and GDD §11's display-unit question, and it is not taken here.
 */
export function sessionProposal(
  closeOut: SessionCloseOut,
  deviceWallClock: LocalWallClock,
): ProposalOfKind<'record-training-session'> | null {
  if (!closeOut.canPropose) return null;
  const unit = SESSION_TUNING.LOAD_UNIT;
  const card: TrainingCardReport =
    unit === 'kg'
      ? { unit, kilogramSets: closeOut.sets }
      : { unit, poundSets: closeOut.sets };
  return {
    kind: 'record-training-session',
    report: { deviceWallClock, card },
  };
}

/**
 * What the screen may show while the request is in flight.
 *
 * TYPED AS `ProjectionWithinReach<'record-training-session'>`, which is what
 * makes GDD §3.2's "never a Total" a compile error rather than a convention:
 * that type narrows `totalKg` to `null` for this proposal kind, so putting a
 * number there does not typecheck. `e1RM` and `streak` are inside the reach and
 * are exactly what the close-out puts on screen.
 */
export function sessionProjection(
  closeOut: SessionCloseOut,
): ProjectionWithinReach<'record-training-session'> & ProgressionProjection {
  const base = emptyProjection();
  if (!closeOut.canPropose) return base;
  // The same number the close-out put on screen, which is the same rule the
  // server will apply. A projection that predicted something else would make
  // the figure jump when the response lands.
  const best = closeOut.newBestE1rmKg;
  return {
    ...base,
    bestE1rmKg: {
      ...base.bestE1rmKg,
      [closeOut.lift]: best === null ? null : projectedKg(best),
    },
    streak: { currentStreak: projectedCount(closeOut.streakAfter) },
  };
}

// ---------------------------------------------------------------------------
// The machine
// ---------------------------------------------------------------------------

/** A session at its first frame: lift + RPE, with history readiness already applied. */
export function createSession(context: SessionContext): SessionState {
  if (!Number.isSafeInteger(context.day)) {
    throw new RangeError(`session: day must be a safe integer day index, received ${context.day}.`);
  }
  if (!Number.isFinite(context.e1rmKg) || context.e1rmKg <= 0) {
    throw new RangeError(
      `session: e1rmKg must be a positive finite number, received ${context.e1rmKg}.`,
    );
  }
  const feel = sessionFeel(context.fatigue, context.day, NEUTRAL_CHECK_IN);
  return {
    context,
    phase: 'briefing',
    answers: EMPTY_CHECK_IN,
    feel,
    readiness: feel.readiness,
    injury: feel.injury,
    plan: null,
    setIndex: 0,
    repIndex: 0,
    completedSets: [],
    repsThisSet: [],
    closeOut: null,
  };
}

/**
 * Advance the loop by one event.
 *
 * TOTAL: an event that does not apply to the current phase returns the state
 * unchanged rather than throwing. A double-tap on a button that has already
 * advanced the screen is a thing fingers do, and it must not be a crash.
 */
export function stepSession(state: SessionState, event: SessionEvent): SessionState {
  switch (event.kind) {
    case 'choose-lift': {
      if (state.phase !== 'briefing' || state.plan !== null) return state;
      if (event.context.day !== state.context.day) return state;
      if (event.context.lift === state.context.lift) return state;
      const feel = sessionFeel(event.context.fatigue, event.context.day, NEUTRAL_CHECK_IN);
      return {
        ...state,
        context: event.context,
        feel,
        readiness: feel.readiness,
        injury: feel.injury,
      };
    }

    case 'check-in-tap': {
      // Subjective check-in is not in the player loop. The event stays on the
      // union so old callers do not crash; it does not move the phase.
      return state;
    }

    case 'choose-rpe': {
      if (state.phase !== 'briefing') return state;
      const readiness = state.readiness;
      if (readiness === null) return state;
      const workSets = workSetsForToday(state.context, event.rpe);
      const plan = prescribeSession(
        state.context.e1rmKg,
        state.context.lift,
        event.rpe,
        readiness,
        workSets,
      );
      return { ...state, phase: 'set', plan, setIndex: 0, repIndex: 0, repsThisSet: [] };
    }

    case 'rep-resolved': {
      if (state.phase !== 'set') return state;
      const plan = state.plan;
      if (plan === null) return state;
      const repsThisSet = [
        ...state.repsThisSet,
        { outcome: event.outcome, executionQuality: event.executionQuality },
      ];
      const setOver = !isMadeRep(event.outcome) || repsThisSet.length >= plan.repsPerSet;
      if (!setOver) {
        return { ...state, repIndex: repsThisSet.length, repsThisSet };
      }
      const played = playedSetFrom(plan, state.setIndex + 1, repsThisSet);
      const completedSets = [...state.completedSets, played];
      const next: SessionState = {
        ...state,
        completedSets,
        repsThisSet: [],
        repIndex: 0,
        setIndex: state.setIndex + 1,
      };
      if (next.setIndex >= plan.workSets) {
        const done: SessionState = { ...next, phase: 'close-out', setIndex: plan.workSets };
        return { ...done, closeOut: closeOutFrom(done) };
      }
      return { ...next, phase: 'rest' };
    }

    case 'begin-set': {
      if (state.phase !== 'rest') return state;
      return { ...state, phase: 'set', repIndex: 0, repsThisSet: [] };
    }

    case 'retry': {
      // Only a session that banked nothing may be taken again on the same day.
      // A completed one is the day's session (GDD §3.2, one per day) and the
      // server would refuse a second anyway (`ALREADY_TRAINED_TODAY`).
      if (state.phase !== 'close-out') return state;
      if (state.closeOut !== null && state.closeOut.canPropose) return state;
      return {
        ...state,
        phase: 'briefing',
        plan: null,
        setIndex: 0,
        repIndex: 0,
        completedSets: [],
        repsThisSet: [],
        closeOut: null,
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Read models for the screens
// ---------------------------------------------------------------------------

/**
 * The check-in a session is running on, whether or not the player tapped.
 *
 * `NEUTRAL_CHECK_IN` is `fatigue.ts`'s own "un-taken" answer, so a session read
 * before the third tap is read against the same neutral the module defines.
 */
export function checkInOrNeutral(state: SessionState): ReadinessCheckIn {
  return completeCheckIn(state.answers) ?? NEUTRAL_CHECK_IN;
}

/**
 * The set and rep counts the briefing shows, BEFORE an RPE has been chosen and
 * so before a `SessionPlan` exists.
 *
 * Here rather than in the screen because it has to be the same number the plan
 * will carry — including any injury cap (GDD §3.5), which is why it goes
 * through `workSetsForToday` instead of reading the template. The RPE does not
 * enter it: `cappedSession` cuts volume on the affected lift and does not read
 * intensity.
 */
export interface PlannedTemplate {
  readonly workSets: number;
  readonly repsPerSet: number;
}

export function plannedTemplateFor(state: SessionState): PlannedTemplate {
  const plan = state.plan;
  if (plan !== null) return { workSets: plan.workSets, repsPerSet: plan.repsPerSet };
  return {
    workSets: workSetsForToday(state.context, defaultRpeChoice()),
    repsPerSet: SESSION_TUNING.REPS_PER_SET,
  };
}

/** 1-based set number for copy, clamped so a finished session reads sensibly. */
export function currentSetNumber(state: SessionState): number {
  const plan = state.plan;
  if (plan === null) return 1;
  return Math.min(plan.workSets, state.setIndex + 1);
}

/**
 * How long a played session takes, in milliseconds, given how long the reps
 * themselves ran.
 *
 * DERIVED FROM THE SAME CONSTANTS THE SCREENS RUN ON, so GDD §3.2's 60-90 s
 * budget is checkable rather than asserted. The rep total is measured by
 * playing them (`session.test.ts` runs the real mechanic); everything else is
 * the beats in `SESSION_TUNING`.
 *
 * The check-in and the RPE choice are NOT included: they are the player's
 * reading and deciding time, which no constant in this file can predict.
 * `SESSION_HUMAN_INPUT_BUDGET_MS` is what the test adds on top and is a guess,
 * labelled as one.
 */
export function playedSessionMs(
  repMs: number,
  reps: number,
  workSets: number,
): number {
  const holds = Math.max(0, reps) * SESSION_TUNING.REP_RESULT_HOLD_MS;
  const rests = Math.max(0, workSets - 1) * SESSION_TUNING.SET_REST_MS;
  return repMs + holds + rests + SESSION_TUNING.BRIEFING_REVEAL_MS;
}
