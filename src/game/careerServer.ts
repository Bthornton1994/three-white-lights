/**
 * careerServer.ts — the Career spine wired to the server boundary: the body of
 * the `choose-federation` Edge Function, and the ONE derivation of the career
 * read model from the stored row.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS, AND WHERE THE CAREER RECORD ACTUALLY LIVES
 * ---------------------------------------------------------------------------
 * `src/career/` is pure math with no consumer: federation, calendar,
 * eligibility, `careerRecordAfterMeet`. This module is the wiring the C1 claim
 * deferred — "a career writing a qualifying total is a progression intent" —
 * and it follows `sessionServer.ts` and `meetServer.ts`: a pure decision
 * procedure in the client's language, portable to a real Edge Function as a
 * move, not a rewrite.
 *
 * THE CAREER RECORD IS DERIVED, NOT STORED, and that is the load-bearing
 * decision. `CareerLifter` is three facts: the federation, the best total, the
 * meets entered. The stored row already owns the last two — `ServerRecord.
 * totalKg` is the best competition total and `ServerRecord.meets` is every
 * meet on the record, both moved by `applyMeetResult` only — so storing a
 * `CareerLifter` beside them would be a second copy of two numbers, free to
 * disagree with the first. Instead `careerLifterFor` FOLDS the stored meets
 * through `careerRecordAfterMeet`, the career module's own transition, and the
 * only stored career fact is the one nothing else carries: the federation.
 *
 * What that buys, precisely:
 *
 *   - ONE PATH. A played meet that completes changes the career read model
 *     because `applyMeetResult` appended to `record.meets` — there is no
 *     second write anywhere, because there is nothing to write. The completion
 *     intent carries the total into `careerRecordAfterMeet` through this fold.
 *   - REPLAY SAFETY FOR FREE. `applyMeetResult` refuses a duplicate meet id
 *     (`MEET_ALREADY_RECORDED`) before anything moves, so the fold's input
 *     never holds one and `enteredMeetIds` is a set by construction — and
 *     `careerRecordAfterMeet` is idempotent even if it were handed one.
 *   - AGREEMENT AS A THEOREM WITH A TEST, not a hope. The fold's best total
 *     and `record.totalKg` are two computations of one fact (both are max
 *     over the same meets), and `careerServer.test.ts` pins them equal across
 *     every record its sweep can reach.
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT
 * ---------------------------------------------------------------------------
 * Zero React imports, zero I/O, zero side effects, no clock, no randomness.
 * The day is resolved by the caller and passed in (GDD §4.1). Every transition
 * returns a new record; inputs are never mutated.
 *
 * ---------------------------------------------------------------------------
 * WHAT `applyFederationChoice` REFUSES, AND WHY THE ORDER IS WHAT IT IS
 * ---------------------------------------------------------------------------
 * GDD §2.1: a federation is picked once, at the start of a career. GDD §6.6's
 * region ruling is why the rule has teeth: region derives from the federation,
 * so a lifter who could re-pick after seeing results could shop for the
 * weakest pool — the competitive-integrity hole §6.6 names and refuses.
 *
 *   - `UNKNOWN_FEDERATION` — the id resolves against `CAREER_FEDERATION_IDS`
 *     or the proposal is malformed. Checked first because nothing else about a
 *     nonexistent federation can be reasoned about.
 *   - `FEDERATION_ALREADY_CHOSEN` — the row already carries `chosen: true`.
 *     The choice is spent; GDD §2.1 hands it out once.
 *   - `FEDERATION_LOCKED_BY_RESULTS` — the row carries meet results and the
 *     proposal names a DIFFERENT federation. Results belong to the calendar
 *     they were lifted on; moving them under another federation's ladder would
 *     carry a total into a pool it was never earned against. Confirming the
 *     federation the results were lifted under is allowed — a Sprint 1a lifter
 *     who banked a meet under the seeded default is not stranded outside the
 *     1b choosing screen; they may confirm that default and nothing else.
 *
 * The order is a copy decision the way `entryVerdict`'s is: more than one can
 * be true at once, and the order picks which sentence a player reads.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT TOUCHES, AND WHAT IT REFUSES TO TOUCH
 * ---------------------------------------------------------------------------
 * `applyFederationChoice` moves `federation` and the revision, and NOTHING
 * else: total, e1RM, streak, meets, wallet and the fatigue ledger are carried
 * through untouched, and `careerServer.test.ts` asserts identity on every one.
 * It takes a record and a proposal — no parameter for money, a balance or an
 * entitlement exists, so nothing money can buy changes what a federation
 * choice does (GDD §8.1, §12.3). The one fact it moves is `'protected'` in
 * `FACT_PROTECTION`, so the type system refuses the reach map ever handing it
 * to a paid proposal kind.
 */

import {
  careerRecordAfterMeet,
  entryVerdict,
  newCareerLifter,
  type CareerLifter,
  type EntryVerdict,
} from '../career/eligibility';
import { upcomingMeets, type CareerMeet } from '../career/calendar';
import { qualifiedTiers } from '../career/eligibility';
import { CAREER_FEDERATION_IDS } from '../career/federation';
import type { CareerFederationId, CareerMeetTier } from '../career/careerTuning';
import { sealServerValue, type ProgressionSnapshotWire, type ProposalOfKind } from './progression';
import { snapshotWireFor, type ServerRecord } from './sessionServer';
import { asStreakDay, type StreakDay } from './streak';

// ---------------------------------------------------------------------------
// The career read model, derived from the stored row
// ---------------------------------------------------------------------------

/**
 * WHAT THE CAREER FOLD READS, AS A SHAPE RATHER THAN AS A ROW.
 *
 * The same widening `meetServer.ts` gives `MeetDayHistory`, for the same
 * reason: `ServerRecord` satisfies this structurally, and so does what
 * `careerClient.ts` reads back out of a `ProgressionCache` through
 * `progression.ts`'s read accessors. One fold, two callers, no second copy of
 * the arithmetic to drift — and the client side still cannot name a
 * `ServerRecord`, because every field here is already on the wire with a read
 * accessor behind it.
 */
export interface CareerHistoryView {
  /** The stored federation; `chosen` is not read by the fold. */
  readonly federation: {
    readonly id: CareerFederationId;
  };
  /** Meets on the record, oldest first. Only id and total are read. */
  readonly meets: readonly {
    readonly meetId: string;
    readonly totalKg: number | null;
  }[];
}

/**
 * The career read model: `src/career/`'s `CareerLifter`, derived from the
 * stored row by folding every recorded meet through `careerRecordAfterMeet`.
 *
 * A bombed meet arrives as `totalKg: null` — the shape `applyMeetResult`
 * stores one in — and the career module's null arm spends the entry without
 * moving the best total. There is deliberately no arithmetic here: the fold's
 * step function is the career module's own transition, so the career math has
 * exactly one home.
 *
 * @guarantee the-career-record-is-the-meets-on-the-row
 */
export function careerLifterFor(history: CareerHistoryView): CareerLifter {
  let lifter = newCareerLifter(history.federation.id);
  for (const meet of history.meets) {
    lifter = careerRecordAfterMeet(lifter, meet.meetId, meet.totalKg);
  }
  return lifter;
}

// ---------------------------------------------------------------------------
// What a meet result did to the career — the recap's data (GDD §6.5)
// ---------------------------------------------------------------------------

/**
 * What one meet result did to the career record.
 *
 * `newlyQualifiedTiers` is the recap's payoff line: the rungs of GDD §6.1's
 * ladder this result unlocked that the lifter could not enter before. Computed
 * from `qualifiedTiers` before and after, so the answer is the eligibility
 * module's rather than a restatement of it.
 */
export interface CareerMeetOutcome {
  /** The career best total before this meet, kg, or null. */
  readonly bestTotalKgBefore: number | null;
  /** The career best total after it, kg, or null. */
  readonly bestTotalKgAfter: number | null;
  /** True when this meet raised the career best total. */
  readonly isCareerBestTotal: boolean;
  /** Tiers the lifter newly qualifies for because of this result, lowest first. */
  readonly newlyQualifiedTiers: readonly CareerMeetTier[];
}

/**
 * The outcome of recording `meetId` at `totalKg` against the career `before`.
 *
 * A bomb-out (`totalKg: null`) spends the entry and unlocks nothing, which the
 * fold's null arm already says; this just reports it. Recording the same meet
 * this career already holds reports no movement, because
 * `careerRecordAfterMeet` is idempotent — the shape a server-side replay of an
 * acknowledged proposal would take.
 */
export function careerMeetOutcome(
  before: CareerLifter,
  meetId: string,
  totalKg: number | null,
): CareerMeetOutcome {
  const after = careerRecordAfterMeet(before, meetId, totalKg);
  const tiersBefore = qualifiedTiers(before.bestTotalKg);
  const tiersAfter = qualifiedTiers(after.bestTotalKg);
  return {
    bestTotalKgBefore: before.bestTotalKg,
    bestTotalKgAfter: after.bestTotalKg,
    isCareerBestTotal:
      after.bestTotalKg !== null &&
      (before.bestTotalKg === null || after.bestTotalKg > before.bestTotalKg),
    newlyQualifiedTiers: tiersAfter.filter((tier) => !tiersBefore.includes(tier)),
  };
}

// ---------------------------------------------------------------------------
// The calendar read model — what GDD §6.1's calendar screen draws
// ---------------------------------------------------------------------------

/** One meet on the calendar, with the verdict the lifter would get today. */
export interface CareerCalendarEntry {
  readonly meet: CareerMeet;
  /**
   * `entryVerdict`'s answer, carried rather than recomputed by a screen: a
   * refused entry arrives with the sentence the player reads, keyed to the
   * reason it was refused for.
   */
  readonly verdict: EntryVerdict;
}

/**
 * The calendar as one lifter sees it on one day.
 *
 * Everything a calendar screen needs and nothing it has to compute: the
 * lifter, the day the verdicts were taken on, and every upcoming meet with its
 * verdict, soonest first. "Which meets can I enter today" is
 * `entries.filter(entry => entry.verdict.kind === 'open')` — a rendering
 * decision over precomputed verdicts, not eligibility math on the client.
 */
export interface CareerCalendarView {
  readonly lifter: CareerLifter;
  /** The day every verdict below was taken on. */
  readonly today: StreakDay;
  /** Every meet from `today` to the horizon, soonest first, with its verdict. */
  readonly entries: readonly CareerCalendarEntry[];
}

/**
 * Build the calendar read model for one lifter on one day.
 *
 * `day` is the server-resolved day index, exactly as `applyMeetResult` takes
 * it (GDD §4.1) — this module never reads a clock. `horizonDays` defaults
 * inside `upcomingMeets` to `CAREER_TUNING.HORIZON_DAYS`.
 *
 * @throws {RangeError} on a day that is not a whole day index, or a horizon
 * that is not a whole non-negative number of days.
 */
export function careerCalendarFor(
  lifter: CareerLifter,
  day: number,
  horizonDays?: number,
): CareerCalendarView {
  const today = asStreakDay(day);
  const entries = upcomingMeets(lifter.federationId, today, horizonDays).map((meet) => ({
    meet,
    verdict: entryVerdict(lifter, meet, today),
  }));
  return { lifter, today, entries };
}

// ---------------------------------------------------------------------------
// The `choose-federation` Edge Function body
// ---------------------------------------------------------------------------

export type CareerServerErrorCode =
  /** The report names no federation this game holds. */
  | 'UNKNOWN_FEDERATION'
  /** The row already carries a chosen federation. GDD §2.1 hands the pick out once. */
  | 'FEDERATION_ALREADY_CHOSEN'
  /** The row carries meet results and the report names a different federation. */
  | 'FEDERATION_LOCKED_BY_RESULTS';

export interface CareerServerError {
  readonly code: CareerServerErrorCode;
  readonly message: string;
}

export type CareerServerResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CareerServerError };

export interface AppliedFederationChoice {
  readonly record: ServerRecord;
  readonly wire: ProgressionSnapshotWire;
  /** The id the row now carries, resolved and proven known. */
  readonly federationId: CareerFederationId;
}

/**
 * Whether a wire string names a federation the game holds. Reads
 * `federation.ts`'s own derived list rather than a second copy of it.
 */
function isKnownFederationId(value: string): value is CareerFederationId {
  return (CAREER_FEDERATION_IDS as readonly string[]).includes(value);
}

/**
 * Choose a federation. THE ONLY WAY `ServerRecord.federation` MOVES after the
 * row is created.
 *
 * See the header for the three refusals and their order. On success the row's
 * federation carries the chosen id and `chosen: true`, the revision moves, and
 * every other fact on the record is the same object it was.
 *
 * @guarantee a-federation-is-chosen-once
 */
export function applyFederationChoice(
  record: ServerRecord,
  proposal: ProposalOfKind<'choose-federation'>,
  proposalId: string,
): CareerServerResult<AppliedFederationChoice> {
  const reported = proposal.report.federationId;
  if (typeof reported !== 'string' || !isKnownFederationId(reported)) {
    return {
      ok: false,
      error: {
        code: 'UNKNOWN_FEDERATION',
        message:
          `careerServer: no federation has the id ${JSON.stringify(String(reported))}. ` +
          `A career's calendar, eligibility and region all key off this id, so recording an ` +
          'unknown one would create a lifter competing in a federation that does not exist.',
      },
    };
  }
  if (record.federation.chosen) {
    return {
      ok: false,
      error: {
        code: 'FEDERATION_ALREADY_CHOSEN',
        message:
          `careerServer: this lifter already chose ${JSON.stringify(record.federation.id)}. ` +
          'GDD §2.1 hands the federation pick out once, at the start of a career, and §6.6 ' +
          'derives the competitive region from it — a choice that could be re-made after seeing ' +
          'results is the region-shopping hole that section refuses.',
      },
    };
  }
  if (record.meets.length > 0 && reported !== record.federation.id) {
    return {
      ok: false,
      error: {
        code: 'FEDERATION_LOCKED_BY_RESULTS',
        message:
          `careerServer: this lifter has meet results under ${JSON.stringify(record.federation.id)} ` +
          `and asked for ${JSON.stringify(reported)}. Results belong to the calendar they were ` +
          'lifted on; moving them under another federation would carry a total into a pool it ' +
          'was never earned against. The federation the results were lifted under can still be ' +
          'confirmed.',
      },
    };
  }
  const next: ServerRecord = sealServerValue({
    revision: record.revision + 1,
    // CARRIED THROUGH UNTOUCHED. A federation choice moves no number.
    totalKg: record.totalKg,
    bestE1rmKg: record.bestE1rmKg,
    streak: record.streak,
    meets: record.meets,
    wallet: record.wallet,
    fatigue: record.fatigue,
    trainingProgressCredit: record.trainingProgressCredit,
    federation: { id: reported, chosen: true },
  });
  return {
    ok: true,
    value: {
      record: next,
      wire: snapshotWireFor(next, proposalId),
      federationId: reported,
    },
  };
}
