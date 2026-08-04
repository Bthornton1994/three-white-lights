/**
 * session.ts — the daily session loop (GDD §3.2, §3.3, §3.4).
 *
 * ```
 * Open app
 *   -> Readiness check-in (5 sec, 3 taps: sleep / soreness / motivation)
 *   -> Modifier applied and surfaced ("Feeling primed +5%" / "Grinding today")
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
 * WHAT THIS MEANS FOR PROGRESSION, said plainly rather than left to be found:
 * because the load goes out through the chart and the estimate comes back
 * through the same chart, a session hit exactly on target reports exactly the
 * e1RM it was prescribed from — the round trip `e1rm.ts` is built to protect.
 * So e1RM does NOT move on an ordinary day, and the close-out says so. It moves
 * when the readiness nudge put a heavier bar up and the player made it. That
 * scarcity is deliberate: a PR every day is not a PR.
 *
 * WHAT IS UNRESOLVED, and is not this piece's to resolve: nothing here paces
 * that growth over weeks. The prescribed fraction of e1RM is the same whatever
 * the e1RM is, so the mechanic does not get harder as the number climbs. GDD
 * §3.4 gives multi-week arcs to Career mode and this loop leaves them there.
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
  NEUTRAL_CHECK_IN,
  cappedSession,
  sessionFeel,
  type FatigueState,
  type InjuryNotice,
  type LiftMoment,
  type MotivationAnswer,
  type ReadinessCheckIn,
  type ReadinessReport,
  type SessionFeel,
  type SessionRecord,
  type SimLift,
  type SleepAnswer,
  type SorenessAnswer,
} from './fatigue';
import { TO_FAILURE_RPE, tryEstimateE1rm } from './e1rm';
import { percentOf1RM, rawLoadForRpeTarget, roundLoad } from './rpe';
import type { LiftConfig, LiftOutcome } from './lift';
import type { LiftKind } from './meet';
import {
  emptyProjection,
  projectedCount,
  projectedKg,
  type ProgressionProjection,
  type ProjectionWithinReach,
  type ProposalOfKind,
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
  | { readonly kind: 'choose-rpe'; readonly rpe: number }
  /** A rep of the lift mechanic resolved. `lift.ts` decided the outcome. */
  | { readonly kind: 'rep-resolved'; readonly outcome: LiftOutcome }
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
  readonly headline: string;
  readonly subhead: string;
  /**
   * False when nothing was banked. The client must not propose a training
   * session in that case (`progression.ts` refuses a session with no set), and
   * the close-out offers a retry instead of ending the day.
   */
  readonly canPropose: boolean;
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
  readonly repsThisSet: readonly LiftOutcome[];
  readonly closeOut: SessionCloseOut | null;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function scrub(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(SESSION_TUNING.PRECISION_DECIMALS));
}

/** A rep the bar actually went up for. A high squat is a red light, not a rep. */
export function isMadeRep(outcome: LiftOutcome): boolean {
  return outcome !== 'miss';
}

/**
 * Which lift today is (GDD §3.2: "One lift per day ... on rotation").
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
 * One played set, as the server will be told about it.
 *
 * See the module header for why a failed rep reports RPE 10: on a
 * reps-in-reserve chart that is the definition of failure, not an estimate of
 * it. The reps reported are the ones the lifter actually completed.
 */
export function playedSetFrom(
  plan: SessionPlan,
  setNumber: number,
  outcomes: readonly LiftOutcome[],
): PlayedSet {
  let goodReps = 0;
  let wentToFailure = false;
  for (const outcome of outcomes) {
    if (isMadeRep(outcome)) goodReps += 1;
    else wentToFailure = true;
  }
  const report: TrainingSetReport | null =
    goodReps < 1
      ? null
      : {
          lift: plan.lift,
          weightKg: plan.weightKg,
          reps: goodReps,
          rpe: wentToFailure ? TO_FAILURE_RPE : plan.targetRpe,
        };
  return { setNumber, outcomes: [...outcomes], goodReps, wentToFailure, report };
}

/**
 * The best e1RM the session's sets imply, kg, or `null`.
 *
 * `null` covers both "no set was completed" and "`e1rm.ts` refused" — the
 * second happens past the published chart's coverage, and this module shows no
 * number rather than papering over the refusal with a second formula (which
 * CLAUDE.md bans outright).
 */
export function sessionE1rmFrom(sets: readonly TrainingSetReport[]): number | null {
  let best: number | null = null;
  for (const set of sets) {
    const estimate = tryEstimateE1rm({ weight: set.weightKg, reps: set.reps, rpe: set.rpe });
    if (estimate === null) continue;
    if (best === null || estimate > best) best = estimate;
  }
  return best === null ? null : scrub(best);
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
 *   2. CAPPED. One session may not raise it by more than
 *      `MAX_E1RM_GAIN_FRACTION_PER_SESSION`. At the shipped value this does not
 *      bind on any session this loop can produce — the largest honest jump is
 *      the readiness nudge's +5% — and `sessionServer.test.ts` checks that
 *      rather than assuming it. It is a bound on a lying client, not a pacing
 *      lever, and it is NOT a solution to long-run progression pacing.
 */
export function nextBestE1rm(held: number | null, sessionEstimate: number | null): number | null {
  if (sessionEstimate === null) return held;
  if (held === null) return sessionEstimate;
  if (sessionEstimate <= held) return held;
  const ceiling = held * (1 + SESSION_PROGRESSION_GUARD.MAX_E1RM_GAIN_FRACTION_PER_SESSION);
  return Math.min(sessionEstimate, ceiling);
}

// ---------------------------------------------------------------------------
// The close-out
// ---------------------------------------------------------------------------

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
  const sessionE1rmKg = sessionE1rmFrom(reports);
  const previousBestE1rmKg = state.context.bestE1rmKg;
  const newBestE1rmKg = nextBestE1rm(previousBestE1rmKg, sessionE1rmKg);
  const isPr =
    newBestE1rmKg !== null &&
    (previousBestE1rmKg === null || newBestE1rmKg > previousBestE1rmKg);
  const canPropose = reports.length > 0;

  const headline = !canPropose
    ? SESSION_COPY.CLOSE_OUT_EMPTY_HEADLINE
    : isPr
      ? SESSION_COPY.CLOSE_OUT_PR_HEADLINE
      : SESSION_COPY.CLOSE_OUT_HELD_HEADLINE;
  const prescribedReps = plan.workSets * plan.repsPerSet;
  const subhead = !canPropose
    ? SESSION_COPY.CLOSE_OUT_EMPTY_SUBHEAD
    : isPr
      ? SESSION_COPY.CLOSE_OUT_PR_SUBHEAD
      : goodReps < prescribedReps
        ? SESSION_COPY.CLOSE_OUT_SHORT_SUBHEAD
        : SESSION_COPY.CLOSE_OUT_HELD_SUBHEAD;

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
    headline,
    subhead,
    canPropose,
  };
}

// ---------------------------------------------------------------------------
// The proposal and the projection — the client's ask, and nothing more
// ---------------------------------------------------------------------------

/**
 * What the client asks the server to record. INPUTS ONLY: the sets as they were
 * performed. There is no e1RM in it and no Total in it — `progression.ts`'s
 * allowlists forbid both, and the server derives e1RM from these four numbers
 * per set with `e1rm.ts` so the two halves of the app cannot disagree.
 *
 * `null` when the session banked nothing. See the header on why that is a
 * retry rather than a lost day.
 */
export function sessionProposal(
  closeOut: SessionCloseOut,
  deviceWallClock: LocalWallClock,
): ProposalOfKind<'record-training-session'> | null {
  if (!closeOut.canPropose) return null;
  return {
    kind: 'record-training-session',
    report: { deviceWallClock, sets: closeOut.sets },
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

/** A session at its first frame: the check-in, with nothing tapped. */
export function createSession(context: SessionContext): SessionState {
  if (!Number.isSafeInteger(context.day)) {
    throw new RangeError(`session: day must be a safe integer day index, received ${context.day}.`);
  }
  if (!Number.isFinite(context.e1rmKg) || context.e1rmKg <= 0) {
    throw new RangeError(
      `session: e1rmKg must be a positive finite number, received ${context.e1rmKg}.`,
    );
  }
  return {
    context,
    phase: 'check-in',
    answers: EMPTY_CHECK_IN,
    feel: null,
    readiness: null,
    injury: null,
    plan: null,
    setIndex: 0,
    repIndex: 0,
    completedSets: [],
    repsThisSet: [],
    closeOut: null,
  };
}

function withTap(answers: PartialCheckIn, tap: CheckInTap): PartialCheckIn {
  switch (tap.question) {
    case 'sleep':
      return { ...answers, sleep: tap.answer };
    case 'soreness':
      return { ...answers, soreness: tap.answer };
    case 'motivation':
      return { ...answers, motivation: tap.answer };
    default:
      return answers;
  }
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
    case 'check-in-tap': {
      if (state.phase !== 'check-in') return state;
      const answers = withTap(state.answers, event.tap);
      const complete = completeCheckIn(answers);
      if (complete === null) return { ...state, answers };
      // The whole of GDD §3.2's "modifier applied and surfaced", in one call.
      // `sessionFeel` is the only thing that reads the hidden ledger, and the
      // readiness report it returns is a readout of these three taps and
      // nothing else — `fatigue.ts` guarantees that by taking no state.
      const feel = sessionFeel(state.context.fatigue, state.context.day, complete);
      return {
        ...state,
        phase: 'briefing',
        answers,
        feel,
        readiness: feel.readiness,
        injury: feel.injury,
      };
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
      const repsThisSet = [...state.repsThisSet, event.outcome];
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
