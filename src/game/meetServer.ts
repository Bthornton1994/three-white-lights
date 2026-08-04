/**
 * meetServer.ts — the body of the `record-meet-result` Edge Function, written
 * in the client's language because there is no backend yet.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS, AND WHY IT IS NOT "THE CLIENT WRITING A TOTAL"
 * ---------------------------------------------------------------------------
 * CLAUDE.md: "Any mutation to Total, e1RM, streak state, meet results, or
 * currency balances goes through a Supabase Edge Function. The client never
 * writes these directly, even during prototyping ... do not write
 * client-authoritative code that will need unwinding later."
 *
 * `sessionServer.ts` set the precedent for the daily loop and this is the same
 * shape for meet day. The boundary is real even though both halves run in one
 * process:
 *
 *   - This module takes a `ProgressionProposal` and a stored `ServerRecord` and
 *     returns a `ProgressionSnapshotWire` — the decoded JSON body of a
 *     response. It is exactly the value an Edge Function would send.
 *   - The client turns that into truth through `receiveProgressionSnapshot`,
 *     which is the one door in `progression.ts`. Nothing here mints a
 *     `Confirmed` number; it cannot, because the symbols that would let it are
 *     private to that module.
 *   - NOTHING HERE READS A TOTAL OFF THE CLIENT, because there is no total on
 *     the wire to read: `MeetResultReport` carries the attempts and the
 *     bodyweight and its allowlist forbids a `totalKg`. The total is recomputed
 *     by REPLAYING the reported attempts through `meet.ts` — the same engine
 *     the client played on, applying the same non-decreasing invariant, the
 *     same three-attempt limit and the same bomb-out rule. A client that
 *     reported an illegal card is refused rather than scored.
 *
 * PORTING IT IS A MOVE, NOT A REWRITE: the file is pure, has no React and no
 * I/O, and its only inputs are the proposal, the meet definition and the stored
 * record.
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT
 * ---------------------------------------------------------------------------
 *   - Zero React imports, zero I/O, zero side effects, no clock, no randomness.
 *   - The day is resolved by the caller and passed in, per GDD §4.1.
 *   - Every transition returns a new record; inputs are never mutated.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT MOVES, AND WHAT IT REFUSES TO MOVE
 * ---------------------------------------------------------------------------
 * MOVES:
 *   - `totalKg`, and this is the only function in the codebase that does. GDD
 *     §2: Total grows by "Meet results only — the sum of best successful
 *     attempt per lift (§6.4). It does not move between meets."
 *     MONOTONE: `ConfirmedFacts.totalKg` is the BEST competition total on
 *     record, so a worse meet cannot cost a lifter the number they already
 *     have, and a bomb-out cannot erase one. That is the same "never punish
 *     showing up" clause (GDD §12.3) that makes `bestE1rmKg` monotone in
 *     `sessionServer.ts`.
 *   - `meets`, which gains one `MeetResultWire` for this meet.
 *
 * REFUSES:
 *   - AN e1RM. `record.bestE1rmKg` is carried through UNTOUCHED and
 *     `meetServer.test.ts` asserts it across every meet it can build.
 *
 *     THIS IS A NARROWING OF WHAT THE REACH MAP PERMITS, AND IT IS DELIBERATE.
 *     `ProposalReach['record-meet-result']` is `'totalKg' | 'meets' |
 *     'bestE1rmKg' | 'wallet'`, so moving an e1RM here would type-check. The
 *     GDD does not ask for it: §2's table grows e1RM from "Sim mode training,
 *     session by session", and §6.4 gives a meet result a Total, a DOTS score,
 *     Career progression and Gym Empire reputation — not an e1RM. Widening
 *     that is a design decision with a real argument on both sides (a made
 *     third attempt IS a true single) and it is not this piece's to take
 *     quietly. If it is ever taken, it belongs in one place: here, with the
 *     chart-backwards estimate `e1rm.ts` already owns, and never as an
 *     incremental tick on a meet SCREEN.
 *   - THE STREAK. `record.streak` is carried through untouched. A meet is not a
 *     training session and `streak.ts`'s `recordTrainingDay` is
 *     `sessionServer.ts`'s to call. GDD §4.4's free grace covers the gap a meet
 *     day makes, so this does not cost a run — see the note on `applyMeetResult`
 *     for the open question that leaves.
 *   - THE WALLET. Carried through untouched. GDD §6.4's "result feeds ... Gym
 *     Empire (reputation)" is the Gym Empire piece's, and reputation is not a
 *     wallet currency.
 *   - ANYTHING BOUGHT. `applyMeetResult` takes a record, a day, a meet
 *     definition, a proposal and an id. It has no parameter for a purchase, an
 *     entitlement, a boost or a balance, so nothing purchasable can change what
 *     a meet is worth (GDD §8.1, §12.3).
 *   - A TOTAL IT CANNOT PROVE IS KILOGRAMS. See THE UNIT below. This is the LAST
 *     place the unit exists: `MeetResultWire` has no unit field, so a pound total
 *     that gets past here is a bare number named `totalKg` forever.
 *
 * ---------------------------------------------------------------------------
 * THE UNIT — why the write path checks it, and why it refuses rather than
 * converts
 * ---------------------------------------------------------------------------
 * `meet.ts` runs a meet in EITHER unit and says so: `MeetLoadingRules.unit` is
 * required, `POUND_MEET_RULES` is exported and validates, and `MeetDefinition.
 * rules` takes whatever it is handed — so `replayMeetCard`'s `createMeet(meet.
 * rules)` will happily replay a pound meet through the front door, no cast
 * needed.
 *
 * `dots.ts` and `resultCard.ts` already refuse a reading that is not in
 * kilograms. Both of those are READ paths, and both run AFTER this function: by
 * the time `buildResultCard` says `UNSUPPORTED_MEET_UNIT`, the pound number is
 * already in `record.totalKg` and in `record.meets[n].totalKg`, and it has
 * already been ranked against `MeetDefinition.ghostTotalsKg` (a kg field). A
 * refusal that fires downstream of the write is not a defence of the write.
 *
 * So the reading's unit is checked HERE, before `nextTotalKg` and before the
 * `MeetResultWire` is built, and `totalKg` is taken off the CHECKED reading
 * rather than from `finalMeetTotal(state)` — which is `readTotal(state).total`
 * with the unit thrown away. There is deliberately no expression left in this
 * file that produces a total without having looked at its unit first.
 *
 * WHY REFUSE RATHER THAN CONVERT, given `kilogramsFromPounds` exists and is
 * exact: the same reason `dots.ts` gives, and it is stronger here. A meet result
 * is TWO numbers — the total, which arrives from `meet.ts` with its unit
 * attached, and `MeetResultReport.bodyweightKg`, which arrives from the CALLER
 * as a bare number whose name this module cannot verify. Converting the total
 * while trusting the bodyweight replaces a 2.2x overstatement with a different
 * wrong number, written permanently, by a module that now claims to handle
 * units. A caller running a pound meet converts the whole entry at the call site
 * — both numbers, with `kilogramsFromPounds`, in one visible place — and records
 * the converted meet. Same posture as `e1rm.ts` past the RPE chart: refuse, and
 * name the remedy.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT CANNOT CHECK, SAID PLAINLY
 * ---------------------------------------------------------------------------
 * (1) WHETHER THE LIGHTS WERE REAL. `MeetAttemptReport.good` is the client's
 * word, and `progression.ts` says so where the type is defined: "with a real
 * Edge Function the lights should be re-resolved server-side and this type gets
 * narrower. It is the client's word today because there is nobody else to ask."
 *
 * So this module re-derives the ARITHMETIC and the RULES and takes the client's
 * word for the VERDICT. That is a real gap and it is the one a leaderboard
 * would be cheated through; it closes when the rep itself is resolved
 * server-side, not by anything that could be written here.
 *
 * (2) WHAT UNIT THE BODYWEIGHT IS IN. `MeetResultReport.bodyweightKg` is a bare
 * `number` with `Kg` in its name and nothing behind the name — no reading, no
 * brand, no rules object it came out of. The TOTAL's unit is checkable because
 * `meet.ts` attaches it; the bodyweight's is not, because no module produces it.
 * A lifter entered in pounds is stored as a lighter lifter, and the number that
 * misreads is the DOTS input on the result card. This is the identical gap
 * `dots.ts` names and declines to close ("the BODYWEIGHT is still a bare
 * `number` ... it does not cross a module boundary"); it is written down here
 * too because this is where the number is written down PERMANENTLY, and a
 * header that lists one unchecked unit while omitting the other reads as though
 * the unit question were settled. It closes by giving the report's bodyweight a
 * unit, not by anything this function can inspect.
 *
 * (3) WHETHER THE ATTEMPT WEIGHTS ARE THE UNIT THEY CLAIM. `MeetAttemptReport.
 * weightKg` has the same shape of problem, but only the same shape: the
 * attempts are replayed against `meet.rules`, so a card whose numbers are in the
 * wrong unit for its own meet is refused as illegal (below the bar, off the
 * declaration grid) or lands in the same reading the unit check above covers.
 * It is listed for completeness, not as an open hole.
 */

import {
  LIFT_ORDER,
  createMeet,
  declareAttempt,
  isMeetComplete,
  readTotal,
  resolveAttempt,
  type JudgePanel,
  type LiftKind,
  type MeetState,
} from './meet';
// `finalMeetTotal` is deliberately NOT imported. It is `readTotal(state).total`
// with the unit discarded, and this module must not hold a total that has
// forgotten what it is measured in — see THE UNIT in the header.
import { DOTS_TOTAL_UNIT } from './dots';
import type { MeetResultWire, ProgressionSnapshotWire, ProposalOfKind } from './progression';
import { snapshotWireFor, type ServerRecord } from './sessionServer';
import type { MeetDefinition } from './meetTuning';

// ---------------------------------------------------------------------------
// Replaying a reported card
// ---------------------------------------------------------------------------

/**
 * The lights the server replays an attempt with.
 *
 * Unanimous either way, on purpose: the panel is COSMETIC to the total. GDD
 * §6.4 scores a meet by the best successful attempt per lift and `meet.ts`
 * decides success by majority, so a 2-1 and a 3-0 produce the same number. The
 * report carries the decision (`good`), not the lights, and inventing a split
 * here would be inventing a fact rather than recomputing one.
 */
const REPLAY_GOOD: JudgePanel = ['white', 'white', 'white'];
const REPLAY_NO_LIFT: JudgePanel = ['red', 'red', 'red'];

/**
 * The one unit permanent progression stores a total in.
 *
 * `DOTS_TOTAL_UNIT` rather than a fresh `'kg'` literal, and the name is worth a
 * sentence because it says DOTS while the reason here is not DOTS.
 * `MeetResultWire.totalKg`, `ServerRecord.totalKg` and
 * `MeetDefinition.ghostTotalsKg` are kilogram fields by their names and by the
 * ghost numbers actually in them; DOTS is only the loudest of the things that
 * would go wrong. Reusing the constant means there is exactly ONE string in the
 * tree that a unit check compares against, spelled the way `meet.ts` spells it
 * and pinned to that spelling by `dots.test.ts` — a second literal here could
 * drift from `MeetWeightUnit` without anything noticing. `resultCard.ts` reuses
 * it the same way, for the same non-DOTS reasons.
 */
const PROGRESSION_TOTAL_UNIT = DOTS_TOTAL_UNIT;

export type MeetServerErrorCode =
  /** The reported attempts are not a legal meet card. */
  | 'MEET_REPLAY_REFUSED'
  /** The replay ran out of attempts before the meet finished. */
  | 'MEET_INCOMPLETE'
  /** More attempts were reported than the meet had room for. */
  | 'MEET_OVERRUN'
  /** This lifter already has a result for this meet. */
  | 'MEET_ALREADY_RECORDED'
  /**
   * The meet was not run in kilograms, so its total cannot be written into a
   * record whose fields are kilogram fields. See THE UNIT in the header for why
   * this refuses instead of converting.
   *
   * SPELLED THE SAME AS `ResultCardErrorCode['UNSUPPORTED_MEET_UNIT']` ON
   * PURPOSE. It is one refusal — this meet is in the wrong unit for this
   * pipeline — reached at two different points in it, and giving it two names
   * would make the write path's version look like a different problem.
   */
  | 'UNSUPPORTED_MEET_UNIT'
  /** The reported day is not one this record can move to. */
  | 'BAD_DAY';

export interface MeetServerError {
  readonly code: MeetServerErrorCode;
  readonly message: string;
}

export type MeetServerResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: MeetServerError };

/**
 * Rebuild a meet from the attempts a client reported.
 *
 * EVERY RULE OF THE SPORT IS APPLIED HERE, by `meet.ts`, because this is
 * `declareAttempt` and `resolveAttempt` and nothing else. A card whose attempts
 * go down in weight, repeat after a good lift, exceed three on a lift, arrive
 * out of order, or continue past a bomb-out is REFUSED — the engine returns the
 * refusal and this function passes it on with the attempt's coordinates
 * attached.
 *
 * The `lift` and `attemptNumber` guards on `declareAttempt` are what make "out
 * of order" refusable rather than silently reinterpreted: the engine rejects a
 * declaration whose coordinates are not the ones on deck.
 */
export function replayMeetCard(
  meet: MeetDefinition,
  attempts: ProposalOfKind<'record-meet-result'>['report']['attempts'],
): MeetServerResult<MeetState> {
  let state = createMeet(meet.rules);
  for (const attempt of attempts) {
    if (isMeetComplete(state)) {
      return {
        ok: false,
        error: {
          code: 'MEET_OVERRUN',
          message:
            `meetServer: the meet was already over when attempt ${attempt.attemptNumber} ` +
            `on the ${attempt.lift} was reported.`,
        },
      };
    }
    const declared = declareAttempt(state, {
      lift: attempt.lift,
      attemptNumber: attempt.attemptNumber,
      weight: attempt.weightKg,
    });
    if (!declared.ok) {
      return {
        ok: false,
        error: {
          code: 'MEET_REPLAY_REFUSED',
          message:
            `meetServer: attempt ${attempt.attemptNumber} on the ${attempt.lift} ` +
            `at ${attempt.weightKg} is not a legal call — ${declared.error.message}`,
        },
      };
    }
    const resolved = resolveAttempt(declared.value, {
      lift: attempt.lift,
      attemptNumber: attempt.attemptNumber,
      lights: attempt.good ? REPLAY_GOOD : REPLAY_NO_LIFT,
    });
    if (!resolved.ok) {
      return {
        ok: false,
        error: {
          code: 'MEET_REPLAY_REFUSED',
          message:
            `meetServer: attempt ${attempt.attemptNumber} on the ${attempt.lift} ` +
            `could not be judged — ${resolved.error.message}`,
        },
      };
    }
    state = resolved.value;
  }
  if (!isMeetComplete(state)) {
    return {
      ok: false,
      error: {
        code: 'MEET_INCOMPLETE',
        message: 'meetServer: the reported attempts do not finish the meet, so there is no result to record.',
      },
    };
  }
  return { ok: true, value: state };
}

// ---------------------------------------------------------------------------
// Placing (GDD §6.5 "placing in field", §6.6 ghost data)
// ---------------------------------------------------------------------------

export interface MeetPlacing {
  /** 1-based. `null` for a lifter with no total — a bomb-out does not place. */
  readonly place: number | null;
  /** The ghosts plus this lifter. */
  readonly fieldSize: number;
}

/**
 * Where the lifter finished.
 *
 * A LIFTER WITH NO TOTAL DOES NOT PLACE, and this returns `null` rather than
 * last. `resultCard.ts` refuses outright to build a card that pairs a numeric
 * placing with a missing total (`PLACING_WITHOUT_TOTAL`), so a `0` or a
 * `fieldSize` here would be caught downstream — but it would be caught as a
 * crash rather than as the honest answer, and the honest answer is that a
 * bombed lifter is absent from the board.
 *
 * Ties: a lifter equal with a ghost places AHEAD of it. Real federations break
 * a tie on bodyweight and the lighter lifter wins; the ghosts carry no
 * bodyweight, so this is the convention rather than the rule, and it is stated
 * rather than hidden.
 */
export function placingFor(totalKg: number | null, ghostTotalsKg: readonly number[]): MeetPlacing {
  const fieldSize = ghostTotalsKg.length + 1;
  if (totalKg === null) return { place: null, fieldSize };
  let ahead = 0;
  for (const ghost of ghostTotalsKg) {
    if (ghost > totalKg) ahead += 1;
  }
  return { place: ahead + 1, fieldSize };
}

// ---------------------------------------------------------------------------
// The Edge Function itself
// ---------------------------------------------------------------------------

export interface AppliedMeetResult {
  readonly record: ServerRecord;
  readonly wire: ProgressionSnapshotWire;
  /** The meet as the engine replayed it. What the recap and the card read. */
  readonly meet: MeetState;
  /**
   * This meet's total, kg, or null on a bomb-out. NOT the best on record.
   *
   * The `Kg` is now load-bearing rather than aspirational: `applyMeetResult`
   * refuses a meet that is not run in kilograms, so there is no path by which an
   * `AppliedMeetResult` exists carrying a total in another unit.
   */
  readonly totalKg: number | null;
  /** The best on record BEFORE this meet, kg, or null. */
  readonly previousBestTotalKg: number | null;
  /** True when this meet raised the best total on record. */
  readonly isTotalPr: boolean;
  readonly bestByLiftKg: Readonly<Record<LiftKind, number | null>>;
  /** Per lift: true when this meet beat the best competition lift on record. */
  readonly liftPrs: Readonly<Record<LiftKind, boolean>>;
  readonly placing: MeetPlacing;
  readonly bombedLift: LiftKind | null;
}

/**
 * The best competition lift on record, per lift, from the meets already stored.
 *
 * COMPETITION bests, not e1RM. GDD §6.5's "PR call-outs" on a meet recap are
 * about the platform, and an e1RM PR is the daily loop's payoff (§3.2).
 */
export function previousBestByLift(record: ServerRecord): Readonly<Record<LiftKind, number | null>> {
  const out: Record<LiftKind, number | null> = { squat: null, bench: null, deadlift: null };
  for (const meet of record.meets) {
    for (const lift of LIFT_ORDER) {
      const best = meet.bestByLift[lift];
      if (best === null) continue;
      const held = out[lift];
      if (held === null || best > held) out[lift] = best;
    }
  }
  return out;
}

/**
 * Record a meet result. THE ONLY WAY A TOTAL MOVES.
 *
 * @param record the lifter's stored row.
 * @param day the streak day the SERVER resolved (GDD §4.1). Stored on the meet
 *   result so a recap can order a lifter's meets; it does NOT touch the streak.
 *
 * REFUSES A MEET THAT IS NOT RUN IN KILOGRAMS (`UNSUPPORTED_MEET_UNIT`), before
 * anything is written. See THE UNIT in the header. A CALLER MUST HANDLE THIS
 * LIKE ANY OTHER REFUSAL — `useMeetDay.ts` currently drops a failed
 * `applyMeetResult` silently and shows no recap, which is the right thing for an
 * impossible case and the wrong thing for a player who just finished nine
 * attempts. That is a UI question, not this module's, and it is named here so
 * whoever adds the second meet definition finds it written down.
 *
 * AN OPEN QUESTION THIS LEAVES, stated rather than discovered later: a meet day
 * is not a trained day, so a player who competes instead of training does not
 * increment their streak. GDD §4.4's free grace absorbs a gap that short, so
 * today this costs nobody a run — but if meets ever become frequent enough that
 * it can, the answer is a design decision (does competing count as training?)
 * and belongs in §4, not in a quiet call to `recordTrainingDay` from here.
 */
export function applyMeetResult(
  record: ServerRecord,
  day: number,
  meet: MeetDefinition,
  proposal: ProposalOfKind<'record-meet-result'>,
  proposalId: string,
): MeetServerResult<AppliedMeetResult> {
  if (!Number.isSafeInteger(day)) {
    return { ok: false, error: { code: 'BAD_DAY', message: `meetServer: day ${day} is not a day index.` } };
  }
  if (record.meets.some((stored) => stored.meetId === proposal.report.meetId)) {
    return {
      ok: false,
      error: {
        code: 'MEET_ALREADY_RECORDED',
        message: `meetServer: this lifter already has a result for ${proposal.report.meetId}.`,
      },
    };
  }

  const replayed = replayMeetCard(meet, proposal.report.attempts);
  if (!replayed.ok) return replayed;
  const state = replayed.value;

  // GDD §6.4's total, computed by the engine from the engine's own card.
  const reading = readTotal(state);

  // THE UNIT, CHECKED BEFORE ANYTHING IS WRITTEN. Everything below this line
  // treats `reading.total` as kilograms — `nextTotalKg`, `MeetResultWire.
  // totalKg`, and `placingFor` against a kg ghost field — and this is the last
  // point at which the unit still exists to be checked: `MeetResultWire` has no
  // field to carry it. Checked on the READING, which is the form of this number
  // that still knows, rather than on `meet.rules`, so the thing checked is the
  // thing written. Checked on every kind, including the two with no total, for
  // the reason `dots.ts` gives: a defect that only fires on a meet that finished
  // with a total is the worst kind to ship.
  if (reading.unit !== PROGRESSION_TOTAL_UNIT) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_MEET_UNIT',
        message:
          `meetServer: this meet was run in ${JSON.stringify(reading.unit)}, and a recorded ` +
          `total is a ${PROGRESSION_TOTAL_UNIT} number — record.totalKg, MeetResultWire.totalKg ` +
          'and the meet’s ghost field are all kilogram fields, and none of them has anywhere to ' +
          'put a unit. Writing this would store a plausible number that is wrong by the ' +
          'conversion factor, permanently and unrecoverably, and every read downstream ' +
          '(dots.ts, resultCard.ts) would refuse it too late to help. This does NOT convert for ' +
          'you: a meet result is the total AND the bodyweight, and the bodyweight arrives here ' +
          'as a bare number this module cannot verify, so converting one while trusting the ' +
          'other is a different wrong number rather than a fix. Convert the whole entry at the ' +
          'call site with kilogramsFromPounds and record the converted meet.',
      },
    };
  }

  // Taken off the CHECKED reading. `null` on a bomb-out — and it is `null` there
  // rather than provisional, because `TotalReading.total` is a number only in
  // the 'final' case and `totalOnTheBoard` is a different field this never
  // reaches for.
  const totalKg = reading.total;
  const bombedLift = reading.kind === 'no-total' ? reading.bombedLift : null;

  const bestByLiftKg: Record<LiftKind, number | null> = {
    squat: state.lifts.squat.best,
    bench: state.lifts.bench.best,
    deadlift: state.lifts.deadlift.best,
  };

  const previousBestTotalKg = record.totalKg;
  const isTotalPr = totalKg !== null && (previousBestTotalKg === null || totalKg > previousBestTotalKg);
  // MONOTONE. A bomb-out cannot erase a total already on record and a worse
  // meet cannot lower one (GDD §12.3: never punish showing up).
  const nextTotalKg = isTotalPr ? totalKg : previousBestTotalKg;

  const heldByLift = previousBestByLift(record);
  const liftPrs: Record<LiftKind, boolean> = { squat: false, bench: false, deadlift: false };
  for (const lift of LIFT_ORDER) {
    const made = bestByLiftKg[lift];
    const held = heldByLift[lift];
    liftPrs[lift] = made !== null && (held === null || made > held);
  }

  const meetWire: MeetResultWire = {
    meetId: proposal.report.meetId,
    meetDayIndex: day,
    // A bomb-out is null here, not zero. `progression.ts`'s decoder says so in
    // as many words and refuses a zero that means "no total".
    totalKg,
    bestByLift: bestByLiftKg,
    bodyweightKg: proposal.report.bodyweightKg,
  };

  const next: ServerRecord = {
    revision: record.revision + 1,
    totalKg: nextTotalKg,
    // CARRIED THROUGH UNTOUCHED. A meet has no route to an e1RM — see the
    // header for why that is a narrowing of the reach map rather than an
    // omission.
    bestE1rmKg: record.bestE1rmKg,
    // CARRIED THROUGH UNTOUCHED. A meet is not a training day.
    streak: record.streak,
    meets: [...record.meets, meetWire],
    // CARRIED THROUGH UNTOUCHED. Nothing here pays out or charges anything.
    wallet: record.wallet,
    // CARRIED THROUGH UNTOUCHED. The hidden ledger is the daily loop's.
    fatigue: record.fatigue,
  };

  return {
    ok: true,
    value: {
      record: next,
      wire: snapshotWireFor(next, proposalId),
      meet: state,
      totalKg,
      previousBestTotalKg,
      isTotalPr,
      bestByLiftKg,
      liftPrs,
      placing: placingFor(totalKg, meet.ghostTotalsKg),
      bombedLift,
    },
  };
}

// ---------------------------------------------------------------------------
// Reads the client needs before it can open a meet
// ---------------------------------------------------------------------------

/**
 * What the lifter brings to the platform, so the client can build a meet.
 *
 * `bestE1rmKg` is what GDD §6.1's suggested opener is computed from, and it is
 * the only thing a meet reads out of the training half of the game.
 */
export interface MeetDayFacts {
  readonly day: number;
  readonly bestE1rmKg: Readonly<Record<LiftKind, number>>;
  readonly previousBestTotalKg: number | null;
  readonly previousBestByLiftKg: Readonly<Record<LiftKind, number | null>>;
}

/**
 * @param fallbackE1rmKg what to prescribe from for a lift with no e1RM on
 * record yet. The caller supplies it (`SESSION_TUNING.STARTING_E1RM_KG` is the
 * onboarding placeholder `sessionServer.ts` already uses) rather than this
 * module inventing a number.
 */
export function meetDayFacts(
  record: ServerRecord,
  day: number,
  fallbackE1rmKg: Readonly<Record<LiftKind, number>>,
): MeetDayFacts {
  const bestE1rmKg: Record<LiftKind, number> = { squat: 0, bench: 0, deadlift: 0 };
  for (const lift of LIFT_ORDER) {
    bestE1rmKg[lift] = record.bestE1rmKg[lift] ?? fallbackE1rmKg[lift];
  }
  return {
    day,
    bestE1rmKg,
    previousBestTotalKg: record.totalKg,
    previousBestByLiftKg: previousBestByLift(record),
  };
}
