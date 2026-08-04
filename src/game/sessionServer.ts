/**
 * sessionServer.ts — the body of the `record-training-session` Edge Function,
 * written in the client's language because there is no backend yet.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS, AND WHY IT IS NOT "THE CLIENT WRITING PROGRESSION"
 * ---------------------------------------------------------------------------
 * CLAUDE.md: "Any mutation to Total, e1RM, streak state, meet results, or
 * currency balances goes through a Supabase Edge Function. The client never
 * writes these directly, even during prototyping ... do not write
 * client-authoritative code that will need unwinding later."
 *
 * There is no Supabase project in this repo. The choice was between letting a
 * component compute an e1RM and stuff it into local state — the exact shape
 * that has to be unwound later — and writing the server's decision procedure
 * once, in a module the client cannot reach around. This is the second.
 *
 * The boundary is real even though both halves run in one process:
 *
 *   - This module takes a `ProgressionProposal` and a stored `ServerRecord` and
 *     returns a `ProgressionSnapshotWire` — the decoded JSON body of a
 *     response. It is exactly the value an Edge Function would send.
 *   - The client turns that into truth through `receiveProgressionSnapshot`,
 *     which is the one door in `progression.ts`. Nothing here mints a
 *     `Confirmed` number or a `ProgressionSnapshot`; it cannot, because the
 *     symbols that would let it are private to that module.
 *   - Nothing here reads the client's projection. The e1RM is recomputed from
 *     the reported sets with `e1rm.ts`, and the streak from `streak.ts`. A
 *     client that lied about either is simply ignored — which is the property
 *     server-authority exists for, and the reason this is worth writing now
 *     rather than later.
 *
 * PORTING IT IS A MOVE, NOT A REWRITE: the file is pure, has no React and no
 * I/O, and its only inputs are the proposal and the stored record.
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT
 * ---------------------------------------------------------------------------
 *   - Zero React imports, zero I/O, zero side effects, no clock, no randomness.
 *   - The day is resolved by the caller and passed in. GDD §4.1: "'Local' is an
 *     account property the server resolves, not the device's current timezone",
 *     and `TrainingSessionReport.deviceWallClock` is explicitly a HINT. This
 *     module takes the resolved day as a parameter and reads the hint only to
 *     report drift.
 *   - Every transition returns a new record; inputs are never mutated.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT REFUSES
 * ---------------------------------------------------------------------------
 *   - A TOTAL. There is no path from a training session to `totalKg`, in this
 *     file or in `progression.ts`'s reach map. GDD §2, §3.2, §6.4: Total is the
 *     sum of best successful competition attempts and moves on meet day only.
 *     The stored total is carried through untouched and
 *     `sessionServer.test.ts` asserts it across every session it can build.
 *   - AN e1RM PAST THE CHART. `e1rm.ts` refuses rather than extrapolating, and
 *     this module propagates the refusal: a set it cannot answer for
 *     contributes nothing, and a session of only such sets moves no e1RM. It
 *     never substitutes a second formula.
 *   - AN e1RM THAT WENT DOWN. `bestE1rmKg` is the BEST on record, so a bad
 *     session cannot cost a lifter their number (GDD §12.3: never punish
 *     showing up).
 *   - ANYTHING BOUGHT. `applyTrainingSession` takes a proposal and a record. It
 *     has no parameter for a purchase, an entitlement, a boost or a balance, so
 *     nothing purchasable can change what a session is worth (GDD §8.1).
 *   - AN ACCESSORY SESSION CLAIMING AN e1RM. See below.
 *
 * ---------------------------------------------------------------------------
 * ACCESSORY WORK NEVER TOUCHES e1RM — RULED, AND ENFORCED HERE
 * ---------------------------------------------------------------------------
 * GDD §3.2 puts an accessory day in the daily rotation. The ruling on what it
 * may move: `LiftKind` stays exactly the three contested lifts, matching real
 * meet structure; accessory work does not write `bestE1rmKg` and produces no
 * e1RM close-out; it contributes **Training IQ** (GDD §2's existing currency)
 * and nothing else lift-specific.
 *
 * TWO ENFORCEMENTS, because a comment is not one:
 *
 *   1. AT COMPILE TIME. `ACCESSORY_IS_NOT_A_COMPETITION_LIFT` and
 *      `REPORTED_LIFT_IS_A_COMPETITION_LIFT` below fail `tsc` if `LiftKind`
 *      grows a fourth member or if the wire's `TrainingSetReport.lift` is
 *      widened to `SimLift` to let accessory through. That is the route the
 *      ruling actually forbids, and it is now a build error rather than a
 *      convention.
 *   2. AT RUNTIME. `TrainingSetReport` is a compile-time claim about a caller;
 *      a JS caller or a hand-edited save can put `'accessory'` in it. Before
 *      this was checked, such a session was ACCEPTED: the streak advanced, a
 *      fatigue record was written under `lift: 'accessory'`, and
 *      `AppliedTrainingSession.bestE1rmKg` came back as `undefined` while
 *      typed `number | null` — the e1RM path survived only because
 *      `estimate > undefined` happens to be false. `applyTrainingSession` now
 *      returns `NOT_A_COMPETITION_LIFT` and `bestE1rmFromSets` throws.
 *
 * WHAT IS NOT BUILT HERE, said plainly so nobody reads the enforcement as the
 * feature: there is no accessory day in `SESSION_TUNING.LIFT_ROTATION` and no
 * Training IQ balance. Both need a `progression.ts` change this module cannot
 * make on its own — a `trainingIq` fact (with a §8.1 protection answer) and a
 * proposal kind for a session that reports no `LiftKind` — plus a close-out
 * that shows IQ instead of an e1RM. GDD §11 records the ruling and what is
 * outstanding.
 */

import { estimateE1rm, tryEstimateE1rm } from './e1rm';
import {
  EMPTY_FATIGUE_STATE,
  LUCKIEST_ROLLS,
  recordSession,
  type FatigueState,
  type InjuryNotice,
  type InjuryRolls,
  type SessionRecord,
  type SimLift,
} from './fatigue';
import { LIFT_ORDER, type LiftKind } from './meet';
import type {
  MeetResultWire,
  ProgressionSnapshotWire,
  ProposalOfKind,
  StreakStateWire,
  TrainingSetReport,
  WalletCurrency,
} from './progression';
import {
  RECOVERY_DAY_ECONOMY,
  asStreakDay,
  createStreakState,
  openDay,
  recordTrainingDay,
  type StreakState,
} from './streak';
import { nextBestE1rm } from './session';
import { SESSION_TUNING } from './sessionTuning';

// ---------------------------------------------------------------------------
// The accessory-day boundary, at compile time
// ---------------------------------------------------------------------------

/**
 * COMPILE-TIME ASSERTION: `'accessory'` IS NOT A COMPETITION LIFT.
 *
 * The ruling keeps `LiftKind` at exactly squat / bench / deadlift, because that
 * is the structure of the sport (GDD §6.2) and every meet-day type is keyed by
 * it. Widening it to carry accessory work is the edit this refuses. `never` is
 * not assignable from `true`, so the failure is a build error on this line with
 * this constant's name in it.
 */
type AccessoryIsNotACompetitionLift = 'accessory' extends LiftKind ? never : true;
export const ACCESSORY_IS_NOT_A_COMPETITION_LIFT: AccessoryIsNotACompetitionLift = true;

/**
 * COMPILE-TIME ASSERTION: WHAT A TRAINING SESSION MAY REPORT IS A COMPETITION
 * LIFT.
 *
 * The other half, and the one that closes the obvious workaround: leaving
 * `LiftKind` alone and widening the WIRE to `SimLift` instead, so an accessory
 * set reaches `bestE1rmFromSets` legitimately. That change fails here.
 */
type ReportedLiftIsACompetitionLift = [TrainingSetReport['lift']] extends [LiftKind] ? true : never;
export const REPORTED_LIFT_IS_A_COMPETITION_LIFT: ReportedLiftIsACompetitionLift = true;

/**
 * COMPILE-TIME ASSERTION: the Sim vocabulary is the competition lifts plus
 * accessory, and nothing else.
 *
 * The control for the two above. Both are satisfied by a world where
 * `'accessory'` stopped existing at all, which would make them pass while the
 * thing they are guarding had quietly been deleted rather than fenced. This
 * fails in that world, and fails again if a fifth Sim lift appears without
 * anybody deciding what it reports.
 */
type SimLiftIsCompetitionLiftsPlusAccessory = [SimLift] extends [LiftKind | 'accessory']
  ? [LiftKind | 'accessory'] extends [SimLift]
    ? true
    : never
  : never;
export const SIM_LIFTS_ARE_COMPETITION_LIFTS_PLUS_ACCESSORY: SimLiftIsCompetitionLiftsPlusAccessory =
  true;

/**
 * Whether a reported lift is one the progression boundary can name, at RUNTIME.
 *
 * `LIFT_ORDER` is `meet.ts`'s own list, not a second copy of it, so this cannot
 * drift from the type above.
 */
function isCompetitionLift(lift: string): lift is LiftKind {
  return (LIFT_ORDER as readonly string[]).includes(lift);
}

// ---------------------------------------------------------------------------
// What the server stores
// ---------------------------------------------------------------------------

/**
 * The row a real backend would hold for one lifter.
 *
 * Plain JSON apart from `StreakState`, which is plain JSON too (its `StreakDay`
 * brand is a type-level fiction and serialises as an integer). `FatigueState`
 * is the hidden ledger and is stored here rather than on the client for the
 * same reason everything else is: it is what decides how tomorrow feels, and a
 * client that could edit it could edit the difficulty.
 */
export interface ServerRecord {
  readonly revision: number;
  /** Best competition total, kg. MOVED BY MEET RESULTS ONLY (GDD §6.4). */
  readonly totalKg: number | null;
  readonly bestE1rmKg: Readonly<Record<LiftKind, number | null>>;
  readonly streak: StreakState;
  readonly meets: readonly MeetResultWire[];
  readonly wallet: Readonly<Record<WalletCurrency, number>>;
  readonly fatigue: FatigueState;
}

/**
 * A lifter who has never trained.
 *
 * The starting e1RMs are placeholder onboarding data (`SESSION_TUNING`), not
 * progression: with a real backend they arrive from the sign-up flow. The
 * Recovery Day balance is GDD §4.2's signup grant, read from `streak.ts`'s own
 * economy table rather than restated.
 */
export function newServerRecord(): ServerRecord {
  return {
    revision: 0,
    totalKg: null,
    bestE1rmKg: {
      squat: SESSION_TUNING.STARTING_E1RM_KG.squat,
      bench: SESSION_TUNING.STARTING_E1RM_KG.bench,
      deadlift: SESSION_TUNING.STARTING_E1RM_KG.deadlift,
    },
    streak: {
      ...createStreakState(),
      recoveryDayBalance: RECOVERY_DAY_ECONOMY.SIGNUP_GRANT,
    },
    meets: [],
    wallet: { gymBucks: 0, chalk: 0 },
    fatigue: EMPTY_FATIGUE_STATE,
  };
}

function streakWire(state: StreakState): StreakStateWire {
  return {
    currentStreak: state.currentStreak,
    longestStreak: state.longestStreak,
    lastTrainedDay: state.lastTrainedDay,
    armedRecoveryDays: state.armedRecoveryDays,
    recoveryDayBalance: state.recoveryDayBalance,
    recoveryDayProtectionEnabled: state.recoveryDayProtectionEnabled,
    hasBankedFirstRecoveryDaySave: state.hasBankedFirstRecoveryDaySave,
  };
}

/**
 * The response body for a stored record. The one shape the client is ever given.
 *
 * `fatigue` is deliberately NOT on it: `ProgressionSnapshotWire` has no field
 * for it and none may be added. GDD §3.4 and §12.3 forbid a visible fatigue
 * meter, and a ledger on the wire is a meter that has not been rendered yet.
 * The client gets a `SessionFeel` instead, computed from the copy of the ledger
 * it is handed for the session it is about to play — qualitative, and with its
 * one number behind a private symbol.
 */
export function snapshotWireFor(
  record: ServerRecord,
  acknowledgedProposalId: string | null,
): ProgressionSnapshotWire {
  return {
    revision: record.revision,
    totalKg: record.totalKg,
    bestE1rmKg: {
      squat: record.bestE1rmKg.squat,
      bench: record.bestE1rmKg.bench,
      deadlift: record.bestE1rmKg.deadlift,
    },
    streak: streakWire(record.streak),
    meets: record.meets.map((meet) => ({ ...meet })),
    wallet: { gymBucks: record.wallet.gymBucks, chalk: record.wallet.chalk },
    acknowledgedProposalId,
  };
}

// ---------------------------------------------------------------------------
// Deriving e1RM from what was reported
// ---------------------------------------------------------------------------

/**
 * The best e1RM the reported sets imply, per lift, kg.
 *
 * `tryEstimateE1rm` rather than `estimateE1rm` so a set the published chart
 * cannot answer for is SKIPPED rather than throwing the whole session away.
 * `e1rm.ts` refuses past an effective rep max of 16 and this respects the
 * refusal: no number is produced for such a set, and none is invented.
 *
 * @throws {RangeError} on a set naming anything but a competition lift. Accessory
 * work has no e1RM by ruling (see the header), and `TrainingSetReport.lift` is
 * only a compile-time claim about the caller — before this guard, an accessory
 * set walked through and was silently dropped by an `estimate > undefined`
 * comparison, which is an accident rather than a boundary.
 */
export function bestE1rmFromSets(
  sets: readonly TrainingSetReport[],
): Readonly<Record<LiftKind, number | null>> {
  const out: Record<LiftKind, number | null> = { squat: null, bench: null, deadlift: null };
  for (const set of sets) {
    // UNTRUSTED KEY: this is a wire value, and an unknown one would otherwise
    // become a fourth key on an object typed as having exactly three.
    if (!isCompetitionLift(set.lift)) {
      throw new RangeError(
        `sessionServer: ${String(set.lift)} is not a competition lift and has no e1RM. ` +
          `Accessory work contributes Training IQ only (GDD §2, §3.2).`,
      );
    }
    const estimate = tryEstimateE1rm({ weight: set.weightKg, reps: set.reps, rpe: set.rpe });
    if (estimate === null) continue;
    const held = out[set.lift];
    if (held === null || estimate > held) out[set.lift] = estimate;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The strain a session cost, for the hidden ledger
// ---------------------------------------------------------------------------

/**
 * The reported sets, as the one `SessionRecord` `fatigue.ts` folds into the
 * ledger. GDD §3.2 is one session per day, so one record per day.
 *
 * `topRpe` is the hardest RPE reported, `workSets` the number of sets, and
 * `repsPerSet` the mean rounded up — `fatigue.ts` takes a rectangle, and
 * rounding the ragged real session UP is the direction that cannot understate
 * what it cost.
 *
 * NO WEIGHT FIELD, which is `fatigue.ts`'s design and not an omission: strain is
 * a function of RPE, sets and reps, so a lifter whose e1RM has doubled and who
 * still trains 5x3 @ RPE 9 sits at exactly the strain they did on day one.
 */
export function fatigueRecordFor(
  day: number,
  lift: SimLift,
  sets: readonly TrainingSetReport[],
): SessionRecord | null {
  if (sets.length === 0) return null;
  let topRpe = Number.NEGATIVE_INFINITY;
  let totalReps = 0;
  for (const set of sets) {
    if (set.rpe > topRpe) topRpe = set.rpe;
    totalReps += set.reps;
  }
  return {
    day,
    lift,
    topRpe,
    workSets: sets.length,
    repsPerSet: Math.ceil(totalReps / sets.length),
  };
}

// ---------------------------------------------------------------------------
// The Edge Function itself
// ---------------------------------------------------------------------------

export type SessionServerErrorCode =
  /** The reported sets name more than one lift. One lift a day (GDD §3.2). */
  | 'MIXED_LIFTS'
  /**
   * A reported set names something that is not a competition lift — accessory
   * work, or a lift that does not exist. Accessory work contributes Training IQ
   * and never an e1RM, so it has no business on this proposal (see the header).
   */
  | 'NOT_A_COMPETITION_LIFT'
  /**
   * `streak.ts` refused: already trained today, or a day in the past.
   *
   * "An offer pending" used to be a third reason here. It is gone because
   * Recovery Days are no longer offered — protection is armed ahead and the
   * missed day consumes it, so there is no decision left open to block on.
   */
  | 'STREAK_REFUSED'
  /** The reported day is not one this record can move to. */
  | 'BAD_DAY';

export interface SessionServerError {
  readonly code: SessionServerErrorCode;
  readonly message: string;
}

export type SessionServerResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SessionServerError };

export interface AppliedTrainingSession {
  readonly record: ServerRecord;
  readonly wire: ProgressionSnapshotWire;
  /** What the streak did. From `streak.ts`, not recomputed here. */
  readonly streakAfter: number;
  readonly milestonesReached: readonly number[];
  /** Best e1RM for the trained lift after this session, kg. */
  readonly bestE1rmKg: number | null;
  /** True when this session raised it. */
  readonly isPr: boolean;
  /** A setback this session started, or null (GDD §3.5). */
  readonly injuryOnset: InjuryNotice | null;
}

/**
 * Record a training session. THE ONLY WAY e1RM AND THE STREAK MOVE.
 *
 * @param record the lifter's stored row.
 * @param day the streak day the SERVER resolved. Not the device's, per GDD
 *   §4.1 — `proposal.report.deviceWallClock` is a hint and is not read here.
 * @param rolls injury rolls, supplied rather than drawn, so this stays pure and
 *   a test can pin the unluckiest outcome. In production these come from the
 *   Edge Function's own CSPRNG, never from the client.
 */
export function applyTrainingSession(
  record: ServerRecord,
  day: number,
  proposal: ProposalOfKind<'record-training-session'>,
  proposalId: string,
  rolls: InjuryRolls = LUCKIEST_ROLLS,
): SessionServerResult<AppliedTrainingSession> {
  if (!Number.isSafeInteger(day)) {
    return { ok: false, error: { code: 'BAD_DAY', message: `sessionServer: day ${day} is not a day index.` } };
  }
  const sets = proposal.report.sets;
  // BEFORE ANYTHING ELSE, AND BEFORE THE STREAK MOVES. A session naming a lift
  // this boundary cannot answer for is refused whole rather than half-recorded:
  // an accessory set used to advance the streak and land in the fatigue ledger
  // while contributing nothing to e1RM, which is a session the player performed
  // and the server has no honest row for.
  for (const set of sets) {
    if (!isCompetitionLift(set.lift)) {
      return {
        ok: false,
        error: {
          code: 'NOT_A_COMPETITION_LIFT',
          message:
            `sessionServer: a training session reports competition lifts, received ${String(set.lift)}. ` +
            `Accessory work contributes Training IQ and never an e1RM (GDD §2, §3.2).`,
        },
      };
    }
  }
  const lifts = new Set<LiftKind>(sets.map((set) => set.lift));
  if (lifts.size > 1) {
    return {
      ok: false,
      error: {
        code: 'MIXED_LIFTS',
        message: `sessionServer: a daily session trains one lift, received ${[...lifts].join(', ')}.`,
      },
    };
  }

  const streakDay = asStreakDay(day);
  const recorded = recordTrainingDay(record.streak, streakDay);
  if (!recorded.ok) {
    return {
      ok: false,
      error: { code: 'STREAK_REFUSED', message: recorded.error.message },
    };
  }

  const estimates = bestE1rmFromSets(sets);
  const bestE1rmKg: Record<LiftKind, number | null> = {
    squat: null,
    bench: null,
    deadlift: null,
  };
  let isPr = false;
  for (const lift of LIFT_ORDER) {
    const held = record.bestE1rmKg[lift];
    const next = nextBestE1rm(held, estimates[lift]);
    bestE1rmKg[lift] = next;
    if (next !== null && (held === null || next > held)) isPr = true;
  }

  // The trained lift, taken from the sets rather than from a parameter: the
  // report is the only thing that says what was trained, and a second source
  // could disagree with it.
  const trainedLift: LiftKind | undefined = sets[0]?.lift;
  let fatigue = record.fatigue;
  let injuryOnset: InjuryNotice | null = null;
  if (trainedLift !== undefined) {
    const fatigueRecord = fatigueRecordFor(day, trainedLift, sets);
    if (fatigueRecord !== null) {
      const folded = recordSession(fatigue, fatigueRecord, rolls);
      fatigue = folded.state;
      injuryOnset = folded.injuryOnset;
    }
  }

  const next: ServerRecord = {
    revision: record.revision + 1,
    // CARRIED THROUGH UNTOUCHED. A training session has no route to a Total.
    totalKg: record.totalKg,
    bestE1rmKg,
    streak: recorded.value.state,
    meets: record.meets,
    wallet: record.wallet,
    fatigue,
  };
  return {
    ok: true,
    value: {
      record: next,
      wire: snapshotWireFor(next, proposalId),
      streakAfter: recorded.value.streakAfter,
      milestonesReached: recorded.value.milestonesReached,
      bestE1rmKg: trainedLift === undefined ? null : bestE1rmKg[trainedLift],
      isPr,
      injuryOnset,
    },
  };
}

// ---------------------------------------------------------------------------
// Reads the client needs before it can prescribe anything
// ---------------------------------------------------------------------------

/**
 * What today looks like for this lifter, so the client can build a session.
 *
 * `streakIfTrainedToday` comes from `streak.ts`'s `openDay`, which is a pure
 * read model that mutates nothing — the streak's own answer to "what does today
 * do", including the free grace and any Recovery Day save already holding the
 * run open (GDD §4.2). This maps the parts a training session needs and leaves
 * the return-visit reveal to whoever renders it.
 */
export interface TodayForLifter {
  readonly day: number;
  readonly lift: LiftKind;
  readonly e1rmKg: number;
  readonly bestE1rmKg: number | null;
  readonly streakBefore: number;
  readonly streakIfTrainedToday: number;
  /** True when the server would refuse a second session today (GDD §3.2). */
  readonly alreadyTrainedToday: boolean;
  /** A copy of the hidden ledger, for `sessionFeel`. Never rendered as a number. */
  readonly fatigue: FatigueState;
}

export function todayForLifter(record: ServerRecord, day: number, lift: LiftKind): TodayForLifter {
  const opening = openDay(record.streak, asStreakDay(day));
  const alreadyTrainedToday = opening.kind === 'already-trained-today';
  const streakIfTrainedToday =
    opening.kind === 'streak-alive' ||
    opening.kind === 'gap-covered-by-grace' ||
    opening.kind === 'gap-covered-by-recovery-days'
      ? opening.streakIfTrainedToday
      : opening.kind === 'already-trained-today'
        ? opening.currentStreak
        : 1;
  const best = record.bestE1rmKg[lift];
  return {
    day,
    lift,
    // Loads are prescribed from the best e1RM on record. Before there is one,
    // the placeholder onboarding number stands in — see `newServerRecord`.
    e1rmKg: best ?? SESSION_TUNING.STARTING_E1RM_KG[lift],
    bestE1rmKg: best,
    streakBefore: record.streak.currentStreak,
    streakIfTrainedToday,
    fatigue: record.fatigue,
    alreadyTrainedToday,
  };
}

/**
 * e1RM for one completed set, kg, THROWING on a set the chart cannot answer for.
 *
 * Exported so the server's own arithmetic has one greppable name and so a test
 * can show that this and `session.ts`'s client-side estimate are the same call
 * into `e1rm.ts` rather than two curves that happen to agree.
 */
export function serverE1rmForSet(set: TrainingSetReport): number {
  return estimateE1rm({ weight: set.weightKg, reps: set.reps, rpe: set.rpe });
}
