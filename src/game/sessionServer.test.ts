import { RECOVERY_ENTITLEMENT } from './streakEntitlement';
import { describe, expect, it } from 'vitest';

import {
  ACCESSORY_IS_NOT_A_COMPETITION_LIFT,
  A_STARTING_E1RM_CAN_DECLARE_A_UNIT_THIS_RECORD_REFUSES,
  REPORTED_LIFT_IS_A_COMPETITION_LIFT,
  SIM_LIFTS_ARE_COMPETITION_LIFTS_PLUS_ACCESSORY,
  applyTrainingSession,
  bestE1rmFromSets,
  fatigueRecordFor,
  newServerRecord,
  serverE1rmForSet,
  snapshotWireFor,
  todayForLifter,
  type ServerRecord,
} from './sessionServer';
import { SESSION_PROGRESSION_GUARD, SESSION_TUNING } from './sessionTuning';
import {
  A_STARTING_E1RM_SEED_CANNOT_BE_READ_WITHOUT_ITS_UNIT,
  A_TRAINING_CARD_CANNOT_BE_READ_WITHOUT_ITS_UNIT,
  FACT_PROTECTION,
  PROGRESSION_FACT_KEYS,
  TRAINING_CARD_REPORT_KEYS,
  applyServerSnapshot,
  asProposalId,
  emptyProgressionCache,
  isConfirmedReading,
  proposeChange,
  readBestE1rmKg,
  readStreakDays,
  readTotalKg,
  readingValue,
  receiveProgressionSnapshot,
  type ProgressionSnapshotWire,
  type ProposalOfKind,
  type StartingE1rmSeed,
  type TrainingSetReport,
} from './progression';
import { receiveSnapshot } from './sessionClient';
import { KILOGRAMS_PER_POUND } from './dots';
import { RPE_LOADING_TUNING } from './rpe';
import { LIFT_ORDER, type LiftKind } from './meet';
import { SIM_LIFTS, UNLUCKIEST_ROLLS, LUCKIEST_ROLLS } from './fatigue';
import {
  createSession,
  liftForDay,
  nextBestE1rm,
  sessionE1rmFrom,
  sessionProjection,
  sessionProposal,
  stepSession,
  type SessionState,
} from './session';
import type { ReadinessCheckIn } from './fatigue';

/**
 * The day these fixtures pretend the account was created on (GDD 4.2 signup
 * day; `streak.ts` 1b). Day 0, because every simulated session below is
 * recorded on day 0 or later and a signup day after a session is refused.
 */
const SIGNUP_DAY = 0;


const WALL_CLOCK = { year: 2026, month: 8, day: 3, hour: 19 };
const NEUTRAL: ReadinessCheckIn = { sleep: 'ok', soreness: 'normal', motivation: 'steady' };
const PRIMED: ReadinessCheckIn = { sleep: 'good', soreness: 'fresh', motivation: 'fired-up' };

/** A session honestly declared in the unit permanent progression stores. */
function proposalOf(sets: readonly TrainingSetReport[]): ProposalOfKind<'record-training-session'> {
  return kgProposalOf(sets);
}

/** The same sets, declared kilograms. */
function kgProposalOf(sets: readonly TrainingSetReport[]): ProposalOfKind<'record-training-session'> {
  return {
    kind: 'record-training-session',
    report: { deviceWallClock: WALL_CLOCK, card: { unit: 'kg', kilogramSets: sets } },
  };
}

/**
 * The same sets, declared POUNDS. Honest, not forged: this is the submission a
 * client running the daily loop in lb would send.
 */
function lbProposalOf(sets: readonly TrainingSetReport[]): ProposalOfKind<'record-training-session'> {
  return {
    kind: 'record-training-session',
    report: { deviceWallClock: WALL_CLOCK, card: { unit: 'lb', poundSets: sets } },
  };
}

function set(
  lift: LiftKind,
  weight: number,
  reps: number,
  rpe: number,
): TrainingSetReport {
  return { lift, weight, reps, rpe };
}

/** A session played end to end against a stored record, all reps made. */
function playAgainst(
  record: ServerRecord,
  day: number,
  answers: ReadinessCheckIn,
  rpe: number,
): { readonly state: SessionState; readonly lift: LiftKind } {
  const lift = liftForDay(day);
  const today = todayForLifter(record, day, lift);
  let state = createSession({
    day,
    lift,
    e1rmKg: today.e1rmKg,
    bestE1rmKg: today.bestE1rmKg,
    streakBefore: today.streakBefore,
    streakIfTrainedToday: today.streakIfTrainedToday,
    fatigue: today.fatigue,
  });
  state = stepSession(state, { kind: 'check-in-tap', tap: { question: 'sleep', answer: answers.sleep } });
  state = stepSession(state, {
    kind: 'check-in-tap',
    tap: { question: 'soreness', answer: answers.soreness },
  });
  state = stepSession(state, {
    kind: 'check-in-tap',
    tap: { question: 'motivation', answer: answers.motivation },
  });
  state = stepSession(state, { kind: 'choose-rpe', rpe });
  let guard = 0;
  while (state.phase !== 'close-out' && guard < 200) {
    guard += 1;
    state =
      state.phase === 'rest'
        ? stepSession(state, { kind: 'begin-set' })
        : stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift' });
  }
  return { state, lift };
}

// ---------------------------------------------------------------------------

describe('a new lifter', () => {
  it('starts with the onboarding placeholders, no meets and no Total', () => {
    const record = newServerRecord(SIGNUP_DAY);
    expect(record.totalKg).toBeNull();
    expect(record.meets).toEqual([]);
    expect(record.streak.currentStreak).toBe(0);
    // Hand-written from SESSION_TUNING's own note, not read back off it.
    expect(record.bestE1rmKg.squat).toBe(180);
    expect(record.bestE1rmKg.bench).toBe(120);
    expect(record.bestE1rmKg.deadlift).toBe(220);
    expect(record.streak.entitlement.coveredDaysLeft).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
  });

  it('produces a wire the one door in progression.ts accepts', () => {
    const received = receiveProgressionSnapshot(snapshotWireFor(newServerRecord(SIGNUP_DAY), null));
    expect(received.ok).toBe(true);
  });

  it('does not put the hidden fatigue ledger on the wire — GDD §3.4, §12.3', () => {
    const injured = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      1,
      proposalOf([set('bench', 200, 3, 10), set('bench', 200, 3, 10), set('bench', 200, 3, 10)]),
      'p',
      UNLUCKIEST_ROLLS,
    );
    expect(injured.ok).toBe(true);
    if (!injured.ok) return;
    expect(injured.value.record.fatigue.sessions.length).toBeGreaterThan(0);
    const json = JSON.stringify(injured.value.wire);
    expect(json).not.toMatch(/fatigue|strain|burden|injur/i);
  });
});

describe('deriving e1RM from what was reported', () => {
  it('reads it off the published chart, per lift, best ESTIMATE wins', () => {
    const best = bestE1rmFromSets([
      set('squat', 180, 3, 8),
      set('squat', 190, 3, 10),
      set('bench', 100, 5, 9),
    ]);
    // Hand-written from the chart: 3@8 = 86.3%, 3@10 = 92.2%, 5@9 = 83.7%.
    // The HEAVIER squat set is the WORSE estimate — 190/0.922 = 206.07 against
    // 180/0.863 = 208.57 — so this also shows the best set is chosen by what it
    // implies rather than by what was on the bar.
    expect(best.squat).toBeCloseTo(208.5747, 4);
    expect(best.squat).toBeCloseTo(180 / 0.863, 8);
    expect(190 / 0.922).toBeLessThan(180 / 0.863);
    expect(best.bench).toBeCloseTo(100 / 0.837, 8);
    expect(best.deadlift).toBeNull();
  });

  it('SKIPS a set the published chart refuses rather than inventing one', () => {
    // 13 reps @ RPE 6 is an effective rep max of 17. `e1rm.ts` refuses past 16
    // and will not join a second formula onto the top of the chart.
    const best = bestE1rmFromSets([set('squat', 100, 13, 6)]);
    expect(best.squat).toBeNull();
    // And a session made only of such sets moves nothing.
    const applied = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      0,
      proposalOf([set('squat', 100, 13, 6)]),
      'p',
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.record.bestE1rmKg.squat).toBe(180);
    expect(applied.value.isPr).toBe(false);
    // But the day still counts. Showing up is never punished (GDD §12.3).
    expect(applied.value.streakAfter).toBe(1);
  });

  it('is the SAME call into e1rm.ts the client makes — one curve, not two', () => {
    const sets = [set('squat', 172.5, 3, 8), set('squat', 172.5, 1, 10)];
    const client = sessionE1rmFrom(sets);
    const server = bestE1rmFromSets(sets).squat;
    expect(client).not.toBeNull();
    expect(server).not.toBeNull();
    expect(client).toBeCloseTo(server ?? Number.NaN, 6);
    expect(serverE1rmForSet(sets[0]!)).toBeCloseTo(172.5 / 0.863, 8);
  });
});

// ---------------------------------------------------------------------------
// THE FOURTH NUMBER, AND THE ONE IN THE OTHER MODE: the training set weights
//
// `TrainingSetReport.weightKg` was a bare `number` with the unit in its name,
// thirty lines above the meet attempt row that had just been renamed for exactly
// that defect, in the same list of untrusted wire reports.
//
// NOTHING ON THE PATH PROVED THE `Kg`:
//
//   client        `weightKg`, a bare number, no tag and no reading
//   decoder       `isFiniteWeight` — finiteness, not unit
//   estimator     `tryEstimateE1rm`, and `e1rm.ts` is documented UNIT-AGNOSTIC
//                 ("kg in -> kg out, lb in -> lb out. Do not convert inside this
//                 module"). Not an oversight there. The design.
//   write         `record.bestE1rmKg`, in a module with no occurrence of "unit"
//   monotone      `nextBestE1rm` never returns below what is held
//   permanent     `ConfirmedFacts.bestE1rmKg`, a `ConfirmedKg`, `'protected'`
//
// WHY MONOTONE IS WHAT MAKES IT THE BAD KIND. A pound number banked as kilograms
// is 2.2046x too large and no later honest session lowers it. It is what every
// future prescription is computed from (`todayForLifter`), what every future PR
// is tested against, and — through `meetServer.ts`'s `meetDayFacts` — what meet
// day suggests an opener from and what `stageLoadRatio` divides a proven
// kilogram meet weight by.
//
// AND THERE IS NO ARITHMETIC THAT CAN TELL THE TWO APART. 405 for 3 at RPE 8 is
// an ordinary pound set and an ordinary kilogram set; so is 172.5. The unit has
// to be carried, because it cannot be inferred.
// ---------------------------------------------------------------------------

describe('a session whose unit this record cannot store is refused, not recorded', () => {
  /** One honest working set. Pound-shaped, and a perfectly ordinary kg set too. */
  const ROWS: readonly TrainingSetReport[] = [set('squat', 405, 3, 8), set('squat', 405, 3, 8)];

  it('THE POUND SESSION: every other check passes and this one refuses', () => {
    // THE ADVERSARIAL CASE IN FULL, and the shape it arrives in matters. A client
    // running the daily loop in pounds — GDD §11's per-user display-unit question
    // one mode over — submits to a server that stores kilograms. No cast, no
    // `as`, no typed lie: every field below is honestly filled in by somebody who
    // lifted in pounds.
    const before = newServerRecord(SIGNUP_DAY);
    const snapshot = structuredClone(before);

    // (1) THE DAY'S CHECK PASSES. Demonstrated, not asserted: day 0 is the day
    //     the kilogram twin records on, three assertions down.
    // (2) THE LIFT CHECKS PASS. Every row names a competition lift and they all
    //     name the SAME one, so neither `NOT_A_COMPETITION_LIFT` nor
    //     `MIXED_LIFTS` has anything to fire on.
    expect([...new Set(ROWS.map((row) => row.lift))]).toEqual(['squat']);
    expect(ROWS.every((row) => (LIFT_ORDER as readonly string[]).includes(row.lift))).toBe(true);
    // (3) THE STREAK WOULD ACCEPT THE DAY, and the e1RM step would produce a
    //     number rather than declining to. Shown by running the SAME rows through
    //     the kilogram twin, so the values the other checks would have seen are
    //     on the page rather than argued about.
    const asKg = applyTrainingSession(newServerRecord(SIGNUP_DAY), 0, kgProposalOf(ROWS), 'p-kg');
    expect(asKg.ok, asKg.ok ? '' : asKg.error.message).toBe(true);
    if (!asKg.ok) throw new Error('unreachable');
    expect(asKg.value.streakAfter).toBe(1);
    expect(asKg.value.isPr).toBe(true);
    // Capped by `MAX_E1RM_GAIN_FRACTION_PER_SESSION`, which is a bound on a lying
    // client and is NOT a defence against this one — see the harm test below for
    // what it does and does not buy.
    expect(asKg.value.bestE1rmKg).toBeCloseTo(
      SESSION_TUNING.STARTING_E1RM.kilograms.squat *
        (1 + SESSION_PROGRESSION_GUARD.MAX_E1RM_GAIN_FRACTION_PER_SESSION),
      9,
    );

    // (4) AND THE UNIT'S CHECK IS WHAT REFUSES. Honestly declared `lb`, against a
    //     record that stores kilograms.
    const applied = applyTrainingSession(before, 0, lbProposalOf(ROWS), 'p-lb');
    expect(applied.ok).toBe(false);
    if (applied.ok) throw new Error('unreachable');
    expect(applied.error.code).toBe('UNSUPPORTED_SESSION_UNIT');
    // Not the day, not the lift, not a mixed session, not the streak, not a
    // malformed body: the one thing wrong with this submission is which unit its
    // numbers are in.
    expect(applied.error.code).not.toBe('BAD_DAY');
    expect(applied.error.code).not.toBe('NOT_A_COMPETITION_LIFT');
    expect(applied.error.code).not.toBe('MIXED_LIFTS');
    expect(applied.error.code).not.toBe('STREAK_REFUSED');
    expect(applied.error.code).not.toBe('MALFORMED_SESSION_CARD');
    // Nothing was produced to write, and the record handed in is untouched —
    // including the streak, which the refusal runs ahead of.
    expect(applied).not.toHaveProperty('value');
    expect(before).toEqual(snapshot);
  });

  it('THE POSITIVE CONTROL: the same rows, declared kg, record', () => {
    // Built so it CANNOT be satisfied by a check keyed on anything but the tag.
    // The two cards hold THE SAME ARRAY OBJECT — same magnitudes, same decimals,
    // same set count, same reps, same RPE — so the only difference between the
    // refusal above and the record below is which string the card carries. A
    // check written on magnitude ("> 300 must be pounds"), on decimals, on set
    // count, or on whether the weights look pound-ish would refuse this one too.
    const lb = lbProposalOf(ROWS);
    const kg = kgProposalOf(ROWS);
    if (lb.report.card.unit !== 'lb' || kg.report.card.unit !== 'kg') throw new Error('unreachable');
    expect(lb.report.card.poundSets).toBe(kg.report.card.kilogramSets);
    expect(lb.report.card.poundSets).toHaveLength(2);

    const refused = applyTrainingSession(newServerRecord(SIGNUP_DAY), 0, lb, 'p-lb');
    const recorded = applyTrainingSession(newServerRecord(SIGNUP_DAY), 0, kg, 'p-kg');
    expect(refused.ok).toBe(false);
    expect(recorded.ok, recorded.ok ? '' : recorded.error.message).toBe(true);
    if (!recorded.ok) throw new Error('unreachable');
    expect(recorded.value.record.bestE1rmKg.squat).toBeCloseTo(
      SESSION_TUNING.STARTING_E1RM.kilograms.squat *
        (1 + SESSION_PROGRESSION_GUARD.MAX_E1RM_GAIN_FRACTION_PER_SESSION),
      9,
    );
    expect(recorded.value.isPr).toBe(true);
    expect(recorded.value.streakAfter).toBe(1);
  });

  it('shows what the old code banked, so the harm is a number rather than a worry', () => {
    // 405 lb for 3 at RPE 8 is 469.29 on the chart read backwards. Read as
    // kilograms that is a 469 kg squat e1RM; the truth is 405 lb = 183.70 kg, so
    // 212.87 kg. 2.2046x — the same factor the meet path banked on the total.
    const asIfKilograms = bestE1rmFromSets(ROWS).squat;
    expect(asIfKilograms).not.toBeNull();
    const truth = (asIfKilograms ?? Number.NaN) * KILOGRAMS_PER_POUND;
    expect(asIfKilograms).toBeCloseTo(469.2932, 4);
    expect(truth).toBeCloseTo(212.8678, 4);
    expect((asIfKilograms ?? Number.NaN) / truth).toBeCloseTo(1 / KILOGRAMS_PER_POUND, 9);

    // WHAT THE PER-SESSION CAP DOES AND DOES NOT BUY, measured rather than
    // assumed, because it is the one thing that could be mistaken for a defence.
    // `MAX_E1RM_GAIN_FRACTION_PER_SESSION` bounds ONE session's jump — so the
    // first pound session banks +6%, not 2.2x. It bounds the RATE, not the
    // destination: the same submission repeated ratchets to the full pound number
    // and stops there, because `nextBestE1rm` never goes down.
    let record = newServerRecord(SIGNUP_DAY);
    let sessions = 0;
    while ((record.bestE1rmKg.squat ?? 0) < (asIfKilograms ?? 0) - 1e-9 && sessions < 100) {
      const step = applyTrainingSession(record, sessions, kgProposalOf(ROWS), `p-${sessions}`);
      if (!step.ok) throw new Error(step.error.message);
      record = step.value.record;
      sessions += 1;
    }
    expect(sessions).toBe(17);
    expect(record.bestE1rmKg.squat).toBeCloseTo(asIfKilograms ?? Number.NaN, 9);

    // ...and once there it cannot be walked back. A later, honest 180 kg session
    // leaves it exactly where it is.
    const honest = applyTrainingSession(record, 40, kgProposalOf([set('squat', 180, 3, 8)]), 'p-h');
    expect(honest.ok, honest.ok ? '' : honest.error.message).toBe(true);
    if (!honest.ok) throw new Error('unreachable');
    expect(honest.value.record.bestE1rmKg.squat).toBe(record.bestE1rmKg.squat);
    expect(honest.value.isPr).toBe(false);

    // And it is not a number anything downstream would have blinked at: it is
    // what tomorrow's bar is prescribed from, and — through `meetDayFacts` —
    // what meet day suggests an opener off.
    expect(todayForLifter(record, 41, 'squat').e1rmKg).toBe(record.bestE1rmKg.squat);
  });

  it('runs the unit check FIRST, and the proof is which refusal comes back', () => {
    // ORDER IS THE POINT, and it has to be pinned by something observable.
    // `applyTrainingSession` is pure — it returns a new record and mutates
    // nothing — so "before the streak moves" cannot be seen by looking at the
    // input record afterwards: that is true of every refusal, including one
    // written after the write. WHICH REFUSAL COMES BACK is the observable, and it
    // is a real property: every check below the unit check reads, throws on, or
    // reports numbers it is treating as kilograms.
    //
    // (a) AHEAD OF THE STREAK. A pound session on a day the streak would refuse
    //     anyway comes back `UNSUPPORTED_SESSION_UNIT`, not `STREAK_REFUSED`.
    //     Move the check below `recordTrainingDay` and this flips.
    const trained = applyTrainingSession(newServerRecord(SIGNUP_DAY), 0, kgProposalOf(ROWS), 'p-kg');
    expect(trained.ok, trained.ok ? '' : trained.error.message).toBe(true);
    if (!trained.ok) throw new Error('unreachable');
    const already = trained.value.record;
    // The control: the SAME day, declared kg, is refused by the streak — so the
    // streak really would have something to say here.
    const kgAgain = applyTrainingSession(already, 0, kgProposalOf(ROWS), 'p-again');
    expect(kgAgain.ok).toBe(false);
    if (kgAgain.ok) throw new Error('unreachable');
    expect(kgAgain.error.code).toBe('STREAK_REFUSED');
    const lbAgain = applyTrainingSession(already, 0, lbProposalOf(ROWS), 'p-lb-again');
    expect(lbAgain.ok).toBe(false);
    if (lbAgain.ok) throw new Error('unreachable');
    expect(lbAgain.error.code).toBe('UNSUPPORTED_SESSION_UNIT');

    // (b) AHEAD OF THE LIFT CHECKS, which are themselves ahead of
    //     `bestE1rmFromSets` — the call that hands these numbers to a
    //     UNIT-AGNOSTIC estimator. A pound card carrying an accessory row comes
    //     back on its unit, not on its lift.
    const accessory = { lift: 'accessory', weight: 60, reps: 3, rpe: 8 } as unknown as TrainingSetReport;
    const kgAccessory = applyTrainingSession(newServerRecord(SIGNUP_DAY), 0, kgProposalOf([accessory]), 'p-a');
    expect(kgAccessory.ok).toBe(false);
    if (kgAccessory.ok) throw new Error('unreachable');
    expect(kgAccessory.error.code).toBe('NOT_A_COMPETITION_LIFT');
    const lbAccessory = applyTrainingSession(newServerRecord(SIGNUP_DAY), 0, lbProposalOf([accessory]), 'p-b');
    expect(lbAccessory.ok).toBe(false);
    if (lbAccessory.ok) throw new Error('unreachable');
    expect(lbAccessory.error.code).toBe('UNSUPPORTED_SESSION_UNIT');

    // And a refused session leaves the record handed in exactly as it was —
    // which is a property of purity, not of ordering, and is stated as such.
    const before = newServerRecord(SIGNUP_DAY);
    const snapshot = structuredClone(before);
    expect(applyTrainingSession(before, 0, lbProposalOf(ROWS), 'p-lb').ok).toBe(false);
    expect(before).toEqual(snapshot);
  });

  it('refuses a unit it has never heard of, rather than assuming kilograms', () => {
    // The fail-safe direction, and the only way it can be reached: `unit` is
    // whatever the sender wrote once the body has been through JSON. `'lbs'`,
    // `'KG'` and `''` are all "not the unit this record stores".
    for (const unit of ['lbs', 'KG', 'pounds', '']) {
      const forged = {
        kind: 'record-training-session',
        report: { deviceWallClock: WALL_CLOCK, card: { unit, kilogramSets: ROWS } },
      } as unknown as ProposalOfKind<'record-training-session'>;
      const applied = applyTrainingSession(newServerRecord(SIGNUP_DAY), 0, forged, 'p-x');
      expect(applied.ok, `unit ${JSON.stringify(unit)}`).toBe(false);
      if (applied.ok) throw new Error('unreachable');
      expect(applied.error.code).toBe('UNSUPPORTED_SESSION_UNIT');
    }
  });

  it('refuses a tag with nothing under it, with its own code', () => {
    // `{ "unit": "kg" }` narrows perfectly and yields `undefined`; so does
    // `{ "unit": "kg", "poundSets": [...] }`, which names the wrong arm. Both are
    // a declared unit attached to no numbers, and the remedy is to fix the sender
    // rather than to convert anything — which is why it is a different code from
    // the one above. `meetServer.ts` learned this after shipping a round where a
    // checked tag over an unchecked payload wrote `undefined` with `ok: true`.
    const bodies: readonly unknown[] = [
      { deviceWallClock: WALL_CLOCK, card: { unit: 'kg' } },
      { deviceWallClock: WALL_CLOCK, card: { unit: 'kg', poundSets: ROWS } },
      { deviceWallClock: WALL_CLOCK, card: { unit: 'kg', kilogramSets: 2 } },
      { deviceWallClock: WALL_CLOCK },
    ];
    for (const report of bodies) {
      const forged = { kind: 'record-training-session', report } as unknown as ProposalOfKind<
        'record-training-session'
      >;
      const applied = applyTrainingSession(newServerRecord(SIGNUP_DAY), 0, forged, 'p-x');
      expect(applied.ok, JSON.stringify(report)).toBe(false);
      if (applied.ok) throw new Error('unreachable');
      expect(applied.error.code).toBe('MALFORMED_SESSION_CARD');
    }
  });

  it('still records a KILOGRAM SESSION THE CHART REFUSES — the check must not swallow one', () => {
    // GDD §12.3 and CLAUDE.md's "never punish daily engagement". `e1rm.ts`
    // refuses past its chart rather than extrapolating, so a session can be
    // perfectly legal and produce NO e1RM at all. A unit check written carelessly
    // — refusing when there is no number to look at, say — would cost that lifter
    // the day. It does not: the streak advances and the held e1RM is unchanged.
    const applied = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      0,
      kgProposalOf([set('squat', 100, 13, 6)]),
      'p-chart',
    );
    expect(applied.ok, applied.ok ? '' : applied.error.message).toBe(true);
    if (!applied.ok) throw new Error('unreachable');
    expect(applied.value.record.bestE1rmKg.squat).toBe(SESSION_TUNING.STARTING_E1RM.kilograms.squat);
    expect(applied.value.isPr).toBe(false);
    expect(applied.value.streakAfter).toBe(1);
  });

  it('is a runtime check, and says so — the compile-time half is the SHAPE', () => {
    // WHICH GUARANTEE IS WHICH, stated in the suite rather than only in a comment,
    // because rounding a runtime check up to a compile error is how the meet
    // path's version of this defect survived two rounds.
    //
    // COMPILE-TIME: there is no field on `TrainingCardReport` reachable from both
    // arms, so no expression anywhere produces the sets without naming a unit.
    // The assertion that pins it is read here so deleting it is a test failure
    // too, not only a `tsc` one.
    expect(A_TRAINING_CARD_CANNOT_BE_READ_WITHOUT_ITS_UNIT).toBe(true);
    expect([...TRAINING_CARD_REPORT_KEYS].sort()).toEqual(['kilogramSets', 'poundSets', 'unit']);
    // RUNTIME: which declared unit is ACCEPTED is a string comparison in
    // `readKilogramSets`, and deleting it is this file's failure rather than the
    // compiler's. The tests above are what fail.
    //
    // AND IT IS WEAKER THAN THE MEET CARD'S, which compares the client's claim
    // against server-owned data (`meet.rules.unit`). A session has no definition
    // to compare against, so the strongest question available is "did you say
    // kg?" — pinned here so the difference is not lost.
    expect(SESSION_TUNING.LOAD_UNIT).toBe('kg');
  });

  it('declares the unit off the constant that chose it, not off a literal', () => {
    // The client half. `sessionProposal` reads `SESSION_TUNING.LOAD_UNIT` — the
    // same constant `prescribeSession` snapped every one of these weights onto —
    // rather than typing `'kg'`. A literal is true today and still says `kg` on
    // the day the loop learns to prescribe in pounds, which is the defect this
    // whole boundary exists to stop, one field over.
    const played = playAgainst(newServerRecord(SIGNUP_DAY), 0, NEUTRAL, 8);
    const closeOut = played.state.closeOut;
    expect(closeOut).not.toBeNull();
    if (closeOut === null) throw new Error('unreachable');
    const proposal = sessionProposal(closeOut, WALL_CLOCK);
    expect(proposal).not.toBeNull();
    expect(proposal?.report.card.unit).toBe(SESSION_TUNING.LOAD_UNIT);
    // And the sets are reachable only through the arm the tag names.
    const card = proposal?.report.card;
    if (card === undefined || card.unit !== 'kg') throw new Error('the shipped loop loads in kg');
    expect(card.kilogramSets.length).toBeGreaterThan(0);
    // NOT A ONE-TOKEN FLIP, and this suite must not imply that it is. Flipping
    // `LOAD_UNIT` changes the SNAPPING GRID only: `prescribeSession` computes the
    // load from a kilogram e1RM either way, so the magnitude would stay
    // kilograms. The card would then declare `lb` over kilogram numbers and this
    // server would refuse the whole session — loud and unrecorded, which is the
    // right failure when the alternative is quiet and monotone. Making the
    // magnitude follow the unit is a change to the loading path and to GDD §11's
    // open display-unit question, and it is not taken here.
    expect(RPE_LOADING_TUNING.ROUNDING_INCREMENT.kg).toBe(2.5);
    expect(RPE_LOADING_TUNING.ROUNDING_INCREMENT.lb).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// The OTHER route into `bestE1rmKg`: the seed
// ---------------------------------------------------------------------------

describe('the seed that starts a record is progression, and its unit is a field', () => {
  // A card is not the only way a number gets into `bestE1rmKg`. `newServerRecord`
  // seeds it on every account, and for four rounds it seeded from three bare
  // numbers whose unit lived in an identifier (`STARTING_E1RM_KG`) under a
  // comment saying "NOT PROGRESSION. Nothing here is persisted and nothing
  // derives from it once the server has a real number." These tests are what
  // makes that comment's replacement checkable rather than a second promise.

  it('THE SEED REACHES A CONFIRMED, PROTECTED FACT — the whole route, run', () => {
    // The claim the old comment denied, demonstrated end to end rather than
    // argued: nothing here is a stub, every step is the shipped function, and
    // the number that comes out the far side is the one the constant declares.
    const record = newServerRecord(SIGNUP_DAY);
    const received = receiveProgressionSnapshot(snapshotWireFor(record, null));
    expect(received.ok, received.ok ? '' : received.error.message).toBe(true);
    if (!received.ok) throw new Error('unreachable');
    const applied = applyServerSnapshot(emptyProgressionCache(), received.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) throw new Error('unreachable');

    for (const lift of LIFT_ORDER) {
      const reading = readBestE1rmKg(applied.value, lift);
      // CONFIRMED, not projected: it arrived through the snapshot door.
      expect(isConfirmedReading(reading), lift).toBe(true);
      expect(readingValue(reading), lift).toBe(SESSION_TUNING.STARTING_E1RM.kilograms[lift]);
    }
    // And it is the field this boundary protects, named off the module's own
    // lists rather than restated here.
    expect([...PROGRESSION_FACT_KEYS]).toContain('bestE1rmKg');
    expect(FACT_PROTECTION.bestE1rmKg).toBe('protected');
  });

  it('THE SEED IS A PERMANENT FLOOR, so it never stops deriving', () => {
    // The second false clause: "nothing derives from it once the server has a
    // real number". `nextBestE1rm` is monotone, so a lifter whose true squat
    // e1RM is well under the seed carries the seed forever — the real number
    // never replaces it, it only ever fails to beat it.
    const seeded = SESSION_TUNING.STARTING_E1RM.kilograms.squat;
    // 138 kg for 3 @ RPE 8 is ~160 kg on the chart read backwards: an honest,
    // legal, fully-recorded session from a genuinely weaker lifter.
    const honest = applyTrainingSession(newServerRecord(SIGNUP_DAY), 0, kgProposalOf([set('squat', 138, 3, 8)]), 'p-1');
    expect(honest.ok, honest.ok ? '' : honest.error.message).toBe(true);
    if (!honest.ok) throw new Error('unreachable');
    expect(honest.value.record.bestE1rmKg.squat).toBe(seeded);
    expect(honest.value.isPr).toBe(false);
    // The day still counts — the floor costs the lifter nothing on GDD §12.3's
    // "never punish daily engagement", it just does not move.
    expect(honest.value.streakAfter).toBe(1);

    // Ten more of them. Still the seed, and still what tomorrow's bar is
    // prescribed from and what meet day would open off.
    let record = honest.value.record;
    for (let day = 1; day <= 10; day += 1) {
      const step = applyTrainingSession(record, day, kgProposalOf([set(liftForDay(day), 100, 3, 8)]), `p-${day}`);
      if (!step.ok) throw new Error(step.error.message);
      record = step.value.record;
    }
    expect(record.bestE1rmKg.squat).toBe(seeded);
    expect(todayForLifter(record, 11, 'squat').e1rmKg).toBe(seeded);
  });

  it('A NEW ACCOUNT STILL GETS A WORKING FIRST SESSION, computed FROM the seed', () => {
    // GDD §12.3, "never punish daily engagement": whatever the unit check does,
    // a lifter who has just signed up must be able to train today. The first
    // session's ceiling is the seed times the per-session cap, which is only
    // true while the seed is what the record was started with.
    const record = newServerRecord(SIGNUP_DAY);
    const today = todayForLifter(record, 0, 'squat');
    expect(today.e1rmKg).toBe(SESSION_TUNING.STARTING_E1RM.kilograms.squat);
    expect(today.bestE1rmKg).toBe(SESSION_TUNING.STARTING_E1RM.kilograms.squat);
    expect(today.alreadyTrainedToday).toBe(false);

    // Played end to end on the real mechanic, not hand-fed.
    const played = playAgainst(record, 0, PRIMED, 8);
    const closeOut = played.state.closeOut;
    expect(closeOut).not.toBeNull();
    if (closeOut === null) throw new Error('unreachable');
    const proposal = sessionProposal(closeOut, WALL_CLOCK);
    expect(proposal).not.toBeNull();
    if (proposal === null) throw new Error('unreachable');
    const applied = applyTrainingSession(record, 0, proposal, 'p-first');
    expect(applied.ok, applied.ok ? '' : applied.error.message).toBe(true);
    if (!applied.ok) throw new Error('unreachable');
    expect(applied.value.streakAfter).toBe(1);
    expect(applied.value.record.bestE1rmKg[played.lift]).not.toBeNull();
    expect(applied.value.record.bestE1rmKg[played.lift]!).toBeLessThanOrEqual(
      SESSION_TUNING.STARTING_E1RM.kilograms[played.lift] *
        (1 + SESSION_PROGRESSION_GUARD.MAX_E1RM_GAIN_FRACTION_PER_SESSION) +
        1e-9,
    );
  });

  it('the unit is a FIELD, and the magnitudes are unreachable without it', () => {
    // The shape claim, in the same form as the training card's. There is no
    // `value`, no `perLift` and no `e1rm` field reachable from both arms, so no
    // expression anywhere yields the three numbers without naming a unit first
    // — which is what makes flipping the unit a build error rather than a
    // silent 2.2x. `tsc` is the assertion; this is the runtime shadow of it.
    expect(Object.keys(SESSION_TUNING.STARTING_E1RM).sort()).toEqual(['kilograms', 'unit']);
    expect(SESSION_TUNING.STARTING_E1RM.unit).toBe('kg');
    expect(Object.keys(SESSION_TUNING.STARTING_E1RM.kilograms).sort()).toEqual(
      [...LIFT_ORDER].sort(),
    );
    // And the seed's type can still EXPRESS a unit this record refuses, so the
    // narrow in `sessionServer.ts` is discriminating rather than vacuous. This
    // constant is `true` only because it type-checked; reading it here is what
    // keeps it from being deleted as unused.
    expect(A_STARTING_E1RM_CAN_DECLARE_A_UNIT_THIS_RECORD_REFUSES).toBe(true);
    // THE SHAPE CLAIM ITSELF IS NOW ASSERTED RATHER THAN DESCRIBED, and this is
    // the runtime shadow of the fourth `ArmsAreTellableApart` line. The
    // `Object.keys` pins above look at the shipped VALUE, so they cannot see a
    // convenience field added to the TYPE on both arms and populated only on the
    // pound one — which is exactly the "give me `perLift[lift]` without a
    // switch" edit. `progression.ts` fails to compile in that world; read here
    // so the export cannot be deleted as unused.
    expect(A_STARTING_E1RM_SEED_CANNOT_BE_READ_WITHOUT_ITS_UNIT).toBe(true);
    // The write really does come off the tagged field, per lift.
    expect(newServerRecord(SIGNUP_DAY).bestE1rmKg).toEqual({ ...SESSION_TUNING.STARTING_E1RM.kilograms });
  });

  it('THE RESIDUAL, PINNED: the tag proves what was DECLARED, not what was TYPED', () => {
    // Said out loud in the suite rather than only in a comment, because
    // rounding a guarantee up is how this defect class survived earlier rounds.
    //
    // WHAT IS A COMPILE ERROR: declaring the seed in any other unit. Flipping
    // `unit` to `'lb'` without converting fails `satisfies StartingE1rmSeed` at
    // the constant; flipping it AND converting fails the
    // `PROVEN_STARTING_E1RM: ProvenStartingE1rm` binding in `sessionServer.ts`;
    // widening that annotation to the union fails `newServerRecord`, because
    // `.kilograms` does not exist on the pound arm. None of those reach a test.
    //
    // WHAT IS NOT CHECKED ANYWHERE: the magnitudes. A seed carrying pound
    // numbers under a `'kg'` tag is a well-formed `StartingE1rmSeed` and every
    // guard in the tree stays green. Constructed here so the hole is a value on
    // the page rather than a sentence.
    const lying: StartingE1rmSeed = {
      // A 180 kg squat, a 120 kg bench and a 220 kg deadlift, TYPED IN POUNDS by
      // somebody answering GDD §11's display-unit question one edit at a time.
      unit: 'kg',
      kilograms: { squat: 397, bench: 265, deadlift: 485 },
    };
    if (lying.unit !== 'kg') throw new Error('unreachable');
    // It narrows cleanly, reads cleanly, and is 2.2x wrong. Measured against
    // `KILOGRAMS_PER_POUND` rather than against the shipped seed, so this stays
    // true when a human retunes the magnitudes.
    expect(lying.kilograms.squat * KILOGRAMS_PER_POUND).toBeCloseTo(180.07, 1);
    expect(lying.kilograms.deadlift * KILOGRAMS_PER_POUND).toBeCloseTo(219.99, 1);
    // Nothing refuses it, and no plausibility band is invented here to pretend
    // otherwise: a bound on "how strong may a beginner be" is a game-feel guess,
    // and a guessed constant standing in for a check is exactly what GDD §11
    // records going wrong once already with `HUMAN_INPUT_BUDGET_MS`.
    //
    // AND DO NOT MISREAD WHAT THE SUITE DOES ON THAT EDIT. Making the same edit
    // to the shipped constant DOES turn several tests in this file red — but
    // only because they pin the arithmetic that 180/120/220 produce. They go red
    // for ANY change to these magnitudes, including a legitimate retune from 180
    // to 185, and not one of them mentions a unit. That is a change detector,
    // not a unit check, and it must not be counted as one: a human retuning the
    // seed updates those expectations and the pound magnitudes go through.
    //
    // What the shape DOES buy, stated as the narrower thing it is: the unit and
    // the magnitudes can no longer be moved apart without the diff saying so.
    // Both live in one object literal, in one file, on adjacent lines.
    expect(SESSION_TUNING.STARTING_E1RM.unit).toBe('kg');
  });
});

describe('accessory work never touches e1RM — the ruling, enforced', () => {
  // GDD §2, §3.2: `LiftKind` stays the three contested lifts; accessory day
  // contributes Training IQ and nothing else lift-specific, and produces no
  // e1RM close-out.
  //
  // The cast is the whole point of these tests. `TrainingSetReport.lift` is a
  // COMPILE-TIME claim about the caller, and the two things that reach this
  // boundary in production — a JSON body and a stored row — are neither of them
  // type-checked. Writing the cast out makes the untrusted path explicit rather
  // than untested.
  const accessorySet = { lift: 'accessory', weight: 60, reps: 3, rpe: 8 } as unknown as TrainingSetReport;
  const nonsenseSet = { lift: 'zercher', weight: 60, reps: 3, rpe: 8 } as unknown as TrainingSetReport;

  it('the compile-time fence is real, and it is not vacuous', () => {
    // These are `true` at runtime only because they type-checked. Reading them
    // here is what keeps them from being deleted as unused: `tsc` is the
    // assertion, and this is the reminder that it ran.
    expect(ACCESSORY_IS_NOT_A_COMPETITION_LIFT).toBe(true);
    expect(REPORTED_LIFT_IS_A_COMPETITION_LIFT).toBe(true);
    expect(SIM_LIFTS_ARE_COMPETITION_LIFTS_PLUS_ACCESSORY).toBe(true);
    // The runtime shadow of the same claim, so a reader can see what the types
    // above are asserting without reading a conditional type.
    expect([...LIFT_ORDER]).toEqual(['squat', 'bench', 'deadlift']);
    expect([...SIM_LIFTS].filter((lift) => !(LIFT_ORDER as readonly string[]).includes(lift))).toEqual([
      'accessory',
    ]);
  });

  it('bestE1rmFromSets REFUSES an accessory set instead of quietly dropping it', () => {
    // Before this guard it returned `{squat:null,bench:null,deadlift:null}` and
    // looked correct — but only because `estimate > undefined` is false. The
    // set was neither counted nor refused, which is the shape of accident this
    // fence exists to convert into a decision.
    expect(() => bestE1rmFromSets([accessorySet])).toThrow(RangeError);
    expect(() => bestE1rmFromSets([accessorySet])).toThrow(/Training IQ/);
    expect(() => bestE1rmFromSets([nonsenseSet])).toThrow(RangeError);
    // The positive control: the same call on a real lift still answers.
    expect(bestE1rmFromSets([set('squat', 172.5, 3, 8)]).squat).toBeCloseTo(199.8841, 4);
  });

  it('applyTrainingSession refuses the whole session, and moves nothing', () => {
    const record = newServerRecord(SIGNUP_DAY);
    const applied = applyTrainingSession(record, 0, proposalOf([accessorySet]), 'p-accessory');
    expect(applied.ok).toBe(false);
    if (applied.ok) return;
    expect(applied.error.code).toBe('NOT_A_COMPETITION_LIFT');
    expect(applied.error.message).toMatch(/Training IQ/);
    // Nothing half-happened. The streak did not advance and the hidden ledger
    // did not gain a row under a lift the wire cannot name.
    expect(record.streak.currentStreak).toBe(0);
    expect(record.fatigue.sessions).toEqual([]);
    expect(record.bestE1rmKg).toEqual({ squat: 180, bench: 120, deadlift: 220 });
  });

  it('refuses even when a real lift is in the same session', () => {
    // The mixed case: one squat set and one accessory set. `MIXED_LIFTS` would
    // also refuse this, so the test pins WHICH refusal fires — the lift-name
    // check runs first, and its message is the one that explains the ruling.
    const applied = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      0,
      proposalOf([set('squat', 172.5, 3, 8), accessorySet]),
      'p-mixed',
    );
    expect(applied.ok).toBe(false);
    if (applied.ok) return;
    expect(applied.error.code).toBe('NOT_A_COMPETITION_LIFT');
  });

  it('and a session of only competition lifts is still accepted', () => {
    // The positive control for all three refusals above: a guard that refused
    // everything would satisfy them too.
    const applied = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      0,
      proposalOf([set('squat', 172.5, 3, 8)]),
      'p-ok',
    );
    expect(applied.ok).toBe(true);
  });

  it('the daily rotation names no lift the progression boundary cannot answer for', () => {
    // The rotation is the one place an accessory day could be introduced by
    // editing a constant. Until `progression.ts` can carry a Training IQ fact
    // and a session that reports no `LiftKind`, that edit would put a session on
    // screen the server refuses — so it is checked here as well as in
    // `sessionTuning.test.ts`.
    for (const lift of SESSION_TUNING.LIFT_ROTATION) {
      expect(LIFT_ORDER, `${lift}`).toContain(lift);
      expect(lift).not.toBe('accessory');
    }
    for (let day = 0; day < 12; day += 1) {
      expect(LIFT_ORDER as readonly string[], `day ${day}`).toContain(liftForDay(day));
    }
  });
});

describe('nextBestE1rm', () => {
  it('never falls, so a bad day cannot cost a lifter their number', () => {
    expect(nextBestE1rm(200, 150)).toBe(200);
    expect(nextBestE1rm(200, null)).toBe(200);
    expect(nextBestE1rm(200, 200)).toBe(200);
  });

  it('takes the first estimate when there is nothing on record', () => {
    expect(nextBestE1rm(null, 150)).toBe(150);
    expect(nextBestE1rm(null, null)).toBeNull();
  });

  it('caps one session’s gain', () => {
    // Hand-written: 6% of 200 is 12, so 212 is the ceiling.
    expect(SESSION_PROGRESSION_GUARD.MAX_E1RM_GAIN_FRACTION_PER_SESSION).toBe(0.06);
    expect(nextBestE1rm(200, 500)).toBe(212);
    expect(nextBestE1rm(200, 205)).toBe(205);
  });

  it('the cap does not bind on anything this loop can produce', () => {
    // The largest honest jump is the readiness nudge at `primed`, +5%. If the
    // cap ever starts biting on a real session the close-out would show a
    // number the maths does not support, so this is a real check and not a
    // restatement of the constant.
    const record = newServerRecord(SIGNUP_DAY);
    const played = playAgainst(record, 0, PRIMED, 10);
    const closeOut = played.state.closeOut!;
    const held = record.bestE1rmKg[played.lift]!;
    expect(closeOut.sessionE1rmKg).not.toBeNull();
    expect(nextBestE1rm(held, closeOut.sessionE1rmKg)).toBe(closeOut.sessionE1rmKg);
  });
});

describe('applying a training session', () => {
  it('moves the streak and the trained lift’s e1RM', () => {
    const record = newServerRecord(SIGNUP_DAY);
    const applied = applyTrainingSession(
      record,
      10,
      // 160 x 3 @ RPE 8 implies 160 / 0.863 = 185.3998, a 3.0% gain on the
      // starting 180 — inside the guard, so this measures the e1RM path rather
      // than the cap.
      proposalOf([set('squat', 160, 3, 8)]),
      'p-1',
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.streakAfter).toBe(1);
    expect(applied.value.isPr).toBe(true);
    expect(applied.value.record.bestE1rmKg.squat).toBeCloseTo(185.3998, 4);
    expect(applied.value.record.bestE1rmKg.bench).toBe(120);
    expect(applied.value.record.revision).toBe(1);
  });

  it('holds the gain at the guard when a session claims an absurd jump', () => {
    // 200 x 3 @ RPE 8 implies 231.75, a 28.7% gain on the starting 180. The
    // guard holds it at 180 x 1.06.
    const applied = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      10,
      proposalOf([set('squat', 200, 3, 8)]),
      'p-1',
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.record.bestE1rmKg.squat).toBeCloseTo(190.8, 6);
  });

  it('NEVER MOVES THE TOTAL — GDD §2, §3.2, §6.4', () => {
    // Swept over every lift, every rung, and both a fresh lifter and one who
    // already has a Total on record from a meet.
    const withMeet: ServerRecord = { ...newServerRecord(SIGNUP_DAY), totalKg: 500 };
    let day = 0;
    for (const record of [newServerRecord(SIGNUP_DAY), withMeet]) {
      for (const lift of LIFT_ORDER) {
        for (const rpe of SESSION_TUNING.RPE_CHOICES) {
          day += 1;
          const applied = applyTrainingSession(
            record,
            day,
            proposalOf([set(lift, 150, 3, rpe)]),
            `p-${day}`,
          );
          expect(applied.ok).toBe(true);
          if (!applied.ok) continue;
          expect(applied.value.record.totalKg).toBe(record.totalKg);
          expect(applied.value.wire.totalKg).toBe(record.totalKg);
        }
      }
    }
    expect(day).toBe(30);
  });

  it('refuses a second session on the same day — GDD §3.2, one a day', () => {
    const first = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      5,
      proposalOf([set('squat', 150, 3, 8)]),
      'p-1',
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyTrainingSession(
      first.value.record,
      5,
      proposalOf([set('squat', 150, 3, 8)]),
      'p-2',
    );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('STREAK_REFUSED');
  });

  it('refuses a session that trains more than one lift', () => {
    const mixed = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      5,
      proposalOf([set('squat', 150, 3, 8), set('bench', 100, 3, 8)]),
      'p-1',
    );
    expect(mixed.ok).toBe(false);
    if (mixed.ok) return;
    expect(mixed.error.code).toBe('MIXED_LIFTS');
  });

  it('refuses a day that is not a day', () => {
    const bad = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      0.5,
      proposalOf([set('squat', 150, 3, 8)]),
      'p-1',
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.error.code).toBe('BAD_DAY');
  });

  it('ignores what the client believed and recomputes from the sets', () => {
    // The property server-authority exists for. The client sends inputs only,
    // and `TrainingSetReport`'s allowlist has no field for an answer — so the
    // strongest form of this check is that the wire's e1RM tracks the SETS and
    // nothing the client could have added.
    const applied = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      3,
      proposalOf([set('deadlift', 230, 1, 10)]),
      'p-1',
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    // 1 rep @ RPE 10 is 100% of 1RM, and 230 is a 4.5% gain on the starting
    // 220, inside the guard.
    expect(applied.value.wire.bestE1rmKg.deadlift).toBe(230);
  });

  it('pays a milestone from streak.ts rather than a second ledger', () => {
    let record = newServerRecord(SIGNUP_DAY);
    for (let day = 0; day < 7; day += 1) {
      const applied = applyTrainingSession(
        record,
        day,
        proposalOf([set(liftForDay(day), 100, 3, 8)]),
        `p-${day}`,
      );
      expect(applied.ok).toBe(true);
      if (!applied.ok) return;
      record = applied.value.record;
      // GDD §4.2: 7 / 30 / 100. The seventh trained day is the first milestone.
      expect(applied.value.milestonesReached).toEqual(day === 6 ? [7] : []);
    }
    expect(record.streak.currentStreak).toBe(7);
    // NO SIGNUP GRANT AND NO MILESTONE PAYOUT. GDD §4.2's Option 1 ruling
    // replaced both with a window entitlement everybody has on the same terms,
    // so a lifter seven days in has exactly what a lifter on day one has.
    expect(record.streak.entitlement.coveredDaysLeft).toBe(RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW);
  });

  it('starts a setback only from the roll it is handed — no Math.random here', () => {
    const brutal = [
      set('squat', 200, 3, 10),
      set('squat', 200, 3, 10),
      set('squat', 200, 3, 10),
      set('squat', 200, 3, 10),
      set('squat', 200, 3, 10),
    ];
    const lucky = applyTrainingSession(newServerRecord(SIGNUP_DAY), 0, proposalOf(brutal), 'p', LUCKIEST_ROLLS);
    const unlucky = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      0,
      proposalOf(brutal),
      'p',
      UNLUCKIEST_ROLLS,
    );
    expect(lucky.ok && lucky.value.injuryOnset).toBeNull();
    expect(unlucky.ok && unlucky.value.injuryOnset).not.toBeNull();
    // GDD §3.5: soft, and never a stat loss. Same e1RM either way.
    if (lucky.ok && unlucky.ok) {
      expect(unlucky.value.record.bestE1rmKg.squat).toBe(lucky.value.record.bestE1rmKg.squat);
      expect(unlucky.value.streakAfter).toBe(lucky.value.streakAfter);
    }
  });

  it('an ordinary session at the shipped template cannot injure at any frequency', () => {
    // GDD §3.5 / §12.3: showing up must never be what hurts you. 5x3 at the
    // default rung, thirty days running, with the unluckiest possible roll.
    let record = newServerRecord(SIGNUP_DAY);
    for (let day = 0; day < 30; day += 1) {
      const lift = liftForDay(day);
      const sets = Array.from({ length: SESSION_TUNING.WORK_SETS }, () =>
        set(lift, 150, SESSION_TUNING.REPS_PER_SET, 8),
      );
      const applied = applyTrainingSession(
        record,
        day,
        proposalOf(sets),
        `p-${day}`,
        UNLUCKIEST_ROLLS,
      );
      expect(applied.ok).toBe(true);
      if (!applied.ok) return;
      expect(applied.value.injuryOnset).toBeNull();
      record = applied.value.record;
    }
    expect(record.streak.currentStreak).toBe(30);
  });
});

describe('the ledger entry a session leaves', () => {
  it('takes the hardest RPE and rounds the ragged session up to a rectangle', () => {
    const record = fatigueRecordFor(4, 'squat', [
      set('squat', 150, 3, 8),
      set('squat', 150, 2, 10),
      set('squat', 150, 3, 8),
    ]);
    expect(record).toEqual({
      day: 4,
      lift: 'squat',
      topRpe: 10,
      workSets: 3,
      // 8 reps over 3 sets rounds UP, so the ledger cannot understate the cost.
      repsPerSet: 3,
    });
  });

  it('is nothing at all for a session with no sets', () => {
    expect(fatigueRecordFor(4, 'squat', [])).toBeNull();
  });
});

describe('today, for the client to prescribe from', () => {
  it('reads the streak’s own answer to what today does', () => {
    const fresh = todayForLifter(newServerRecord(SIGNUP_DAY), 100, 'squat');
    expect(fresh.streakBefore).toBe(0);
    expect(fresh.streakIfTrainedToday).toBe(1);
    expect(fresh.alreadyTrainedToday).toBe(false);
    expect(fresh.e1rmKg).toBe(180);

    const trained = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      100,
      proposalOf([set('squat', 150, 3, 8)]),
      'p',
    );
    expect(trained.ok).toBe(true);
    if (!trained.ok) return;
    const sameDay = todayForLifter(trained.value.record, 100, 'squat');
    expect(sameDay.alreadyTrainedToday).toBe(true);
    expect(sameDay.streakIfTrainedToday).toBe(1);
    const nextDay = todayForLifter(trained.value.record, 101, 'bench');
    expect(nextDay.alreadyTrainedToday).toBe(false);
    expect(nextDay.streakIfTrainedToday).toBe(2);
  });

  it('prescribes from the best e1RM once there is one', () => {
    const trained = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      100,
      proposalOf([set('squat', 185, 1, 10)]),
      'p',
    );
    expect(trained.ok).toBe(true);
    if (!trained.ok) return;
    expect(todayForLifter(trained.value.record, 101, 'squat').e1rmKg).toBe(185);
  });

  it('a two-day gap is covered by the free grace and the run survives', () => {
    // GDD §4.4 / §12.3. `streak.ts` owns the rule; this checks the session path
    // does not undo it.
    let record = newServerRecord(SIGNUP_DAY);
    const first = applyTrainingSession(record, 0, proposalOf([set('squat', 150, 3, 8)]), 'a');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    record = first.value.record;
    const afterGap = applyTrainingSession(record, 3, proposalOf([set('squat', 150, 3, 8)]), 'b');
    expect(afterGap.ok).toBe(true);
    if (!afterGap.ok) return;
    expect(afterGap.value.streakAfter).toBe(2);
  });
});

describe('the whole round trip — client proposes, server publishes, client reads', () => {
  it('ends with a CONFIRMED e1RM and streak, and an unmoved Total', () => {
    const record = newServerRecord(SIGNUP_DAY);
    const seed = receiveProgressionSnapshot(snapshotWireFor(record, null));
    expect(seed.ok).toBe(true);
    if (!seed.ok) return;
    const seeded = applyServerSnapshot(emptyProgressionCache(), seed.value);
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;

    const played = playAgainst(record, 0, PRIMED, 8);
    const closeOut = played.state.closeOut!;
    const proposal = sessionProposal(closeOut, WALL_CLOCK)!;
    const proposed = proposeChange(
      seeded.value,
      asProposalId('p-1'),
      proposal,
      sessionProjection(closeOut),
    );
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(readBestE1rmKg(proposed.value, played.lift).kind).toBe('projected');

    const applied = applyTrainingSession(record, 0, proposal, 'p-1');
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const settled = receiveProgressionSnapshot(applied.value.wire);
    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    const done = applyServerSnapshot(proposed.value, settled.value);
    expect(done.ok).toBe(true);
    if (!done.ok) return;

    const e1rm = readBestE1rmKg(done.value, played.lift);
    expect(isConfirmedReading(e1rm)).toBe(true);
    expect(readingValue(e1rm)).toBeCloseTo(closeOut.sessionE1rmKg ?? Number.NaN, 6);
    const streak = readStreakDays(done.value);
    expect(isConfirmedReading(streak)).toBe(true);
    expect(readingValue(streak)).toBe(1);
    const total = readTotalKg(done.value);
    expect(isConfirmedReading(total)).toBe(true);
    expect(readingValue(total)).toBeNull();
  });

  it('the server’s published e1RM agrees with what the close-out showed, and climbs by the amounts below', () => {
    // The property CLAUDE.md's one-formula rule exists for: two parts of the
    // app cannot report different numbers for the same set. Checked over the
    // whole ladder, both readiness ends, on a lifter with history.
    //
    // AND THE MAGNITUDE, which this loop used to watch climb without ever
    // looking at it. Agreement alone passes just as happily when both halves
    // agree on a number that has run away, so every step is recorded and the
    // ten-session trail is asserted below.
    interface Step {
      readonly day: number;
      readonly lift: LiftKind;
      readonly beforeKg: number | null;
      readonly afterKg: number | null;
      readonly isPr: boolean;
    }
    const trail: Step[] = [];

    let record = newServerRecord(SIGNUP_DAY);
    let day = 0;
    for (const answers of [NEUTRAL, PRIMED]) {
      for (const rpe of SESSION_TUNING.RPE_CHOICES) {
        const played = playAgainst(record, day, answers, rpe);
        const closeOut = played.state.closeOut!;
        const beforeKg = record.bestE1rmKg[played.lift];
        const applied = applyTrainingSession(
          record,
          day,
          sessionProposal(closeOut, WALL_CLOCK)!,
          `p-${day}`,
        );
        expect(applied.ok).toBe(true);
        if (!applied.ok) return;
        if (closeOut.isPr) {
          expect(applied.value.bestE1rmKg).toBeCloseTo(closeOut.sessionE1rmKg ?? Number.NaN, 6);
        } else {
          expect(applied.value.bestE1rmKg).toBe(closeOut.previousBestE1rmKg);
        }
        trail.push({
          day,
          lift: played.lift,
          beforeKg,
          afterKg: applied.value.bestE1rmKg,
          isPr: applied.value.isPr,
        });
        record = applied.value.record;
        day += 1;
      }
    }
    expect(day).toBe(10);
    expect(trail).toHaveLength(10);

    // ------------------------------------------------------------------
    // THE MAGNITUDE. Pinned as MEASURED CURRENT BEHAVIOUR, not as a target.
    // ------------------------------------------------------------------
    // Days 0-4 are the neutral half: the load goes out through a chart cell and
    // the estimate comes back through the same cell, so nothing moves. That is
    // `e1rm.ts`'s cancellation working exactly as designed.
    //
    // Days 5-9 are the primed half, and every one of them is a PR — including
    // days 8 and 9, which are the SECOND time this lifter trained that lift and
    // are computed from the number the first one minted. That compounding is
    // the known gap: the readiness nudge is a flat constant paid for three taps
    // rather than something coupled to training stimulus, and coupling it is a
    // recorded dependency on the fatigue/progression work (GDD §3.4). When it
    // lands, these numbers are what has to change.
    const neutralHalf = trail.slice(0, 5);
    const primedHalf = trail.slice(5);
    expect(neutralHalf.filter((step) => step.isPr)).toEqual([]);
    for (const step of neutralHalf) {
      expect(step.afterKg, `day ${step.day} ${step.lift}`).toBe(step.beforeKg);
    }
    expect(primedHalf.filter((step) => step.isPr)).toHaveLength(5);

    // Hand-written per lift, from the seed magnitudes in
    // `SESSION_TUNING.STARTING_E1RM.kilograms` (squat 180, bench 120,
    // deadlift 220).
    expect(primedHalf.map((step) => step.lift)).toEqual([
      'deadlift',
      'squat',
      'bench',
      'deadlift',
      'squat',
    ]);
    expect(primedHalf[0]!.afterKg).toBeCloseTo(228.1134, 4); // 220 -> +3.7%
    expect(primedHalf[1]!.afterKg).toBeCloseTo(188.172, 3); // 180 -> +4.5%
    expect(primedHalf[2]!.afterKg).toBeCloseTo(124.5655, 4); // 120 -> +3.8%
    // The compounding ones: each is the previous PR's number, nudged again.
    expect(primedHalf[3]!.beforeKg).toBeCloseTo(228.1134, 4);
    expect(primedHalf[3]!.afterKg).toBeCloseTo(238.2287, 4);
    expect(primedHalf[4]!.beforeKg).toBeCloseTo(188.172, 3);
    expect(primedHalf[4]!.afterKg).toBeCloseTo(195.2278, 4);

    // Five primed sessions across three lifts, and every lift's published best
    // is above where it started. Nothing here caps it: the one guard in the
    // path is 6% per session against a 5% nudge.
    expect(record.bestE1rmKg.squat).toBeCloseTo(195.2278, 4);
    expect(record.bestE1rmKg.bench).toBeCloseTo(124.5655, 4);
    expect(record.bestE1rmKg.deadlift).toBeCloseTo(238.2287, 4);
    expect(record.bestE1rmKg.squat! / SESSION_TUNING.STARTING_E1RM.kilograms.squat).toBeCloseTo(1.0846, 4);
    expect(
      record.bestE1rmKg.deadlift! / SESSION_TUNING.STARTING_E1RM.kilograms.deadlift,
    ).toBeCloseTo(1.0829, 4);
    // Two sessions on one lift, eight percent. Written as an explicit bound so
    // that a change which makes it worse fails here rather than passing.
    for (const lift of LIFT_ORDER) {
      const grown = record.bestE1rmKg[lift]! / SESSION_TUNING.STARTING_E1RM.kilograms[lift];
      expect(grown, `${lift} grew`).toBeGreaterThan(1);
      expect(grown, `${lift} grew`).toBeLessThan(1.09);
    }
  });
});

// ---------------------------------------------------------------------------
// The seal: an ASSIGNMENT is not a construction, and §7.5 counts constructions
// ---------------------------------------------------------------------------

/**
 * Returns whatever `this` is at a bare call.
 *
 * `undefined` under strict mode, the global object under sloppy — and that is
 * exactly the difference between the seal below THROWING and the seal below
 * failing in silence. Written as a function rather than cited from the spec
 * because "ES modules are always strict" is a claim about how this file is
 * compiled and run, not something the file can know by asserting it in prose.
 */
function thisAtABareCall(this: unknown): unknown {
  return this;
}

/**
 * A wire of the same shape `snapshotWireFor` returns, assembled here and
 * therefore NOT sealed.
 *
 * This is the CONTROL, and it is the reason the throw below is evidence rather
 * than decoration: it shows the same three lines succeeding, and the pound
 * number they write arriving in `ConfirmedFacts` as confirmed truth. Without it
 * a reader cannot tell whether the seal closed a real door or whether the write
 * was never going to land.
 */
function unsealedLike(wire: ProgressionSnapshotWire): ProgressionSnapshotWire {
  return {
    revision: wire.revision,
    totalKg: wire.totalKg,
    bestE1rmKg: { ...wire.bestE1rmKg },
    streak: { ...wire.streak },
    meets: wire.meets.map((meet) => ({ ...meet })),
    wallet: { ...wire.wallet },
    federation: { ...wire.federation },
    acknowledgedProposalId: wire.acknowledgedProposalId,
  };
}

describe('what leaves the server is sealed in flight', () => {
  it('refuses the write that type-checked clean on the app route [a-wire-in-flight-refuses-a-write]', () => {
    const wire = snapshotWireFor(newServerRecord(SIGNUP_DAY), null);
    const trueKg = wire.bestE1rmKg.deadlift;
    expect(trueKg, 'the wire carries a real kilogram e1RM to poison').toBeGreaterThan(0);

    // THE DEFECT, IN THE SHAPE IT WAS ACTUALLY WRITTEN. No cast, no `any`, no
    // reflective idiom, no numeric literal. `Readonly<Record<K, V>>` assigns to
    // `Record<K, V>` because property `readonly` is NOT part of assignability,
    // so `tsc --noEmit` has nothing to say — measured, on three lines in
    // `useSession.ts`, with the suite at exactly 63 files / 2654 tests.
    const bests: Record<LiftKind, number | null> = wire.bestE1rmKg;
    expect(() => {
      bests.deadlift = (trueKg ?? 0) / KILOGRAMS_PER_POUND;
    }).toThrow(TypeError);

    // AND — THE HALF THAT DOES NOT DEPEND ON THE MODE THIS RUNS IN. A sealed
    // write fails either way; under sloppy mode it fails SILENTLY, so asserting
    // only the throw would make the whole check an assertion about the compiler
    // rather than about the number.
    expect(wire.bestE1rmKg.deadlift, 'the e1RM did not move').toBe(trueKg);
  });

  it('runs strict, so that refusal is a throw and not a silence', () => {
    expect(thisAtABareCall(), 'a bare call sees no `this`, i.e. strict mode').toBeUndefined();
  });

  it('would otherwise have taken that write and confirmed it as truth', () => {
    // THE CONTROL. Same three lines, same numbers, on a wire nobody sealed.
    const open = snapshotWireFor(newServerRecord(SIGNUP_DAY), null);
    const trueKg = open.bestE1rmKg.deadlift ?? 0;
    const loose = unsealedLike(open);
    const bests: Record<LiftKind, number | null> = loose.bestE1rmKg;
    bests.deadlift = trueKg / KILOGRAMS_PER_POUND;

    // The write takes, and it is the 2.2x poison and not some rounding.
    expect(loose.bestE1rmKg.deadlift).toBeCloseTo(trueKg / KILOGRAMS_PER_POUND, 9);
    expect((loose.bestE1rmKg.deadlift ?? 0) / trueKg).toBeCloseTo(1 / KILOGRAMS_PER_POUND, 9);

    // AND IT LANDS IN PERMANENT PROGRESSION. Through `receiveSnapshot`, which
    // is §7.5's one client door, arriving as CONFIRMED — not projected, not
    // stale. This is the bar failing, reproduced, and it is what the seal above
    // is measured against.
    const cache = receiveSnapshot(emptyProgressionCache(), loose);
    const landed = readBestE1rmKg(cache, 'deadlift');
    expect(isConfirmedReading(landed), 'the poison arrived as confirmed truth').toBe(true);
    expect(readingValue(landed)).toBeCloseTo(trueKg / KILOGRAMS_PER_POUND, 9);

    // And the sealed wire the server actually hands out reads the true number.
    const honest = receiveSnapshot(emptyProgressionCache(), open);
    expect(readingValue(readBestE1rmKg(honest, 'deadlift'))).toBe(trueKg);
  });

  it('seals every level of the wire, not only its shell', () => {
    // `Object.freeze` is SHALLOW, and every number this bar is about lives one
    // or two levels down. A seal that froze the top object and left
    // `bestE1rmKg`, `streak`, `meets[0]` and `wallet` writable would pass a
    // check that only wrote to `wire.revision`.
    const wire = snapshotWireFor(newServerRecord(SIGNUP_DAY), null);
    expect(Object.isFrozen(wire), 'the wire itself').toBe(true);
    expect(Object.isFrozen(wire.bestE1rmKg), 'bestE1rmKg').toBe(true);
    expect(Object.isFrozen(wire.streak), 'streak').toBe(true);
    expect(Object.isFrozen(wire.meets), 'the meets array').toBe(true);
    expect(Object.isFrozen(wire.wallet), 'wallet').toBe(true);
    expect(Object.isFrozen(wire.federation), 'federation').toBe(true);

    const streak: { currentStreak: number } = wire.streak;
    expect(() => {
      streak.currentStreak = wire.streak.longestStreak + 1;
    }).toThrow(TypeError);
    const wallet: Record<string, number> = wire.wallet;
    expect(() => {
      wallet.gymBucks = 1;
    }).toThrow(TypeError);
  });

  it('seals a meet inside the wire, one array element down', () => {
    // The deepest mass field on the wire, and the only one behind an array.
    // `Object.freeze` on `meets` stops a `push`; it does not stop a write into
    // `meets[0]`, which is where a stored meet's Total lives.
    const record = newServerRecord(SIGNUP_DAY);
    const withMeet: ServerRecord = {
      ...record,
      meets: [
        {
          meetId: 'seal-fixture-meet',
          meetDayIndex: 1,
          totalKg: 400,
          bestByLift: { squat: 150, bench: 100, deadlift: 150 },
          bodyweightKg: 80,
        },
      ],
    };
    const wire = snapshotWireFor(withMeet, null);
    const stored = wire.meets[0];
    expect(stored, 'the fixture meet reached the wire').toBeDefined();
    const loose: { totalKg: number } = stored as { totalKg: number };
    expect(() => {
      loose.totalKg = 400 / KILOGRAMS_PER_POUND;
    }).toThrow(TypeError);
    expect(wire.meets[0]?.totalKg, 'the stored Total did not move').toBe(400);
    const byLift: Record<string, number> = wire.meets[0]?.bestByLift as Record<string, number>;
    expect(() => {
      byLift.squat = 150 / KILOGRAMS_PER_POUND;
    }).toThrow(TypeError);
  });

  it('seals the record this file produces, at both of its producers', () => {
    // §7.5's `record` rows for this module. A write into a STORED ROW before
    // `snapshotWireFor` reads it would be copied onto the wire faithfully and
    // sealed there, so sealing the wire alone leaves this door open.
    // EVERY NESTED OBJECT, NOT JUST `bestE1rmKg`. `Object.freeze` is shallow, so
    // a seal that reached the shell and one field leaves `streak`, `wallet`,
    // `meets` and `fatigue` writable — and this row's witness ledger claimed
    // "the shell and the nested objects" while one of the five was asserted.
    // `progression.test.ts` now derives the required set from `ServerRecord`
    // itself, so a sixth nested object on the interface makes this test owe an
    // assertion about it rather than quietly not covering it.
    const fresh = newServerRecord(SIGNUP_DAY);
    expect(Object.isFrozen(fresh), 'newServerRecord').toBe(true);
    expect(Object.isFrozen(fresh.bestE1rmKg), 'and its e1RMs').toBe(true);
    expect(Object.isFrozen(fresh.streak), 'and its streak').toBe(true);
    expect(Object.isFrozen(fresh.wallet), 'and its wallet').toBe(true);
    expect(Object.isFrozen(fresh.meets), 'and its meets array').toBe(true);
    expect(Object.isFrozen(fresh.fatigue), 'and its fatigue').toBe(true);
    expect(Object.isFrozen(fresh.federation), 'and its federation').toBe(true);
    const freshBests: Record<LiftKind, number | null> = fresh.bestE1rmKg;
    expect(() => {
      freshBests.squat = (fresh.bestE1rmKg.squat ?? 0) / KILOGRAMS_PER_POUND;
    }).toThrow(TypeError);

    const played = playAgainst(fresh, 0, PRIMED, 8);
    const closeOut = played.state.closeOut;
    expect(closeOut, 'the fixture session reached its close-out').not.toBeNull();
    const applied = applyTrainingSession(
      fresh,
      0,
      proposalOf(closeOut?.sets ?? []),
      asProposalId('seal-fixture'),
    );
    expect(applied.ok, 'the fixture session was recorded').toBe(true);
    if (!applied.ok) return;
    expect(Object.isFrozen(applied.value.record), 'applyTrainingSession').toBe(true);
    expect(Object.isFrozen(applied.value.record.bestE1rmKg), 'and its e1RMs').toBe(true);
    expect(Object.isFrozen(applied.value.record.streak), 'and its streak').toBe(true);
    expect(Object.isFrozen(applied.value.record.wallet), 'and its wallet').toBe(true);
    expect(Object.isFrozen(applied.value.record.meets), 'and its meets array').toBe(true);
    expect(Object.isFrozen(applied.value.record.fatigue), 'and its fatigue').toBe(true);
    expect(Object.isFrozen(applied.value.record.federation), 'and its federation').toBe(true);
    const settledBests: Record<LiftKind, number | null> = applied.value.record.bestE1rmKg;
    expect(() => {
      settledBests[played.lift] = 0;
    }).toThrow(TypeError);
  });

  it('seals nothing it was handed — the caller’s row stays writable', () => {
    // THE PRECONDITION `sealServerValue` PUTS ON A CALLER, checked rather than
    // promised. `snapshotWireFor` builds every nested object fresh, so its seal
    // reaches no part of the record. Change one of those lines to carry a
    // sub-object of `record` through BY REFERENCE — `bestE1rmKg:
    // record.bestE1rmKg` — and this goes red, because the server would then be
    // freezing its own stored row as a side effect of answering a read.
    const handBuilt = {
      revision: 0,
      totalKg: null,
      bestE1rmKg: { squat: 100, bench: 60, deadlift: 120 },
      streak: { ...newServerRecord(SIGNUP_DAY).streak },
      meets: [
        {
          meetId: 'caller-owned',
          meetDayIndex: 1,
          totalKg: 300,
          bestByLift: { squat: 100, bench: 60, deadlift: 140 },
          bodyweightKg: 80,
        },
      ],
      wallet: { gymBucks: 0, chalk: 0 },
      fatigue: newServerRecord(SIGNUP_DAY).fatigue,
      federation: { id: 'meridian', chosen: false },
    };
    expect(Object.isFrozen(handBuilt.bestE1rmKg), 'before the call').toBe(false);

    snapshotWireFor(handBuilt as ServerRecord, null);

    expect(Object.isFrozen(handBuilt), 'the caller’s row after the call').toBe(false);
    expect(Object.isFrozen(handBuilt.bestE1rmKg), 'and its e1RMs').toBe(false);
    expect(Object.isFrozen(handBuilt.wallet), 'and its wallet').toBe(false);
    expect(Object.isFrozen(handBuilt.meets), 'and its meets').toBe(false);
    expect(Object.isFrozen(handBuilt.meets[0]), 'and the meet inside them').toBe(false);
    expect(Object.isFrozen(handBuilt.streak), 'and its streak').toBe(false);
  });
});
