/**
 * Tests for `production.ts` — GDD §5.1's loop and §5.2's production table.
 *
 * Every check below was written by naming the edit to `production.ts` that turns
 * it red before the assertion was written, and the name is in the comment above
 * it. A check with no such name was deleted rather than kept as decoration
 * (CLAUDE.md, "An Assertion Is Vacuous If It Cannot Fail").
 *
 * The offline-cap sweep's parameters are in `OFFLINE_SWEEP` below rather than at
 * the call site, for the reason `src/game/streakSweep.ts` exists: a measurement
 * whose inputs are not written down is an anecdote. Its counts are pinned
 * exactly — pairs compared, strictly-increasing pairs, plateau pairs, gaps past
 * the horizon — so an empty or one-sided domain reports itself instead of making
 * `violations === 0` a pass over nothing. A negative control runs the identical
 * driver over a deliberately punishing variant and pins its non-zero count.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  type EmpireClock,
  type EmpireState,
  type EquipmentTier,
  type IdleTenureDays,
  type NpcLifter,
  type NpcTier,
  type SettledTenureDays,
  type StaffRole,
  asGymBucks,
  asReputation,
  assertEmpireState,
  createEmpireClock,
  createEmpireState,
  createNpcLifter,
  idleLedger,
  progressionLedger,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import { auditSource, formatFindings } from '../tuning/audit';
import {
  type OfflineBankingPolicy,
  type ProductionAccrual,
  type RosterRateSource,
  SHIPPED_OFFLINE_BANKING_POLICY,
  accrueProduction,
  bankableOfflineSeconds,
  gymBucksRatePerHour,
  settledGymBucksRatePerHour,
  offlineBankingHorizonSeconds,
  productionRates,
  quantiseElapsedSeconds,
  scrubPrecision,
  trainingIqRatePerDay,
} from './production';

const HERE = path.dirname(new URL(import.meta.url).pathname);

const HOUR = EMPIRE_TUNING.SECONDS_PER_HOUR;
const DAY = EMPIRE_TUNING.SECONDS_PER_DAY;
const HORIZON_SECONDS = offlineBankingHorizonSeconds();
const NO_PUNISH_SECONDS = EMPIRE_TUNING.OFFLINE_EARNINGS_NO_PUNISH_HOURS * HOUR;

// ---------------------------------------------------------------------------
// A stand-in for piece E2
// ---------------------------------------------------------------------------

/**
 * The per-lifter rates piece E2 owns, implemented here only so this piece has
 * something to aggregate. It is deliberately the plainest reading of §5.3's
 * "output scales deterministically with gym tier + tenure/loyalty": tier
 * multiplier times a loyalty ramp, no state, no clock, nothing random.
 *
 * Nothing in `production.ts` is graded against this shape — every check below
 * either compares two runs of the same stand-in or recomputes the expected value
 * from the stand-in itself, so replacing it with E2's real curve moves no
 * verdict.
 */
function loyaltyMultiplier(tenureDays: number): number {
  const ramp = Math.min(1, tenureDays / EMPIRE_TUNING.NPC_TENURE_DAYS_TO_FULL_LOYALTY);
  const shaped = ramp ** EMPIRE_TUNING.NPC_LOYALTY_CURVE_EXPONENT;
  return (
    EMPIRE_TUNING.NPC_LOYALTY_MIN_MULTIPLIER +
    (EMPIRE_TUNING.NPC_LOYALTY_MAX_MULTIPLIER - EMPIRE_TUNING.NPC_LOYALTY_MIN_MULTIPLIER) * shaped
  );
}

const STAND_IN_RATES: RosterRateSource = {
  gymBucksPerHour: (lifter: NpcLifter, tenure: IdleTenureDays): number =>
    EMPIRE_TUNING.NPC_GYM_BUCKS_PER_HOUR_BASE *
    EMPIRE_TUNING.NPC_TIER_OUTPUT_MULTIPLIER[lifter.tier] *
    loyaltyMultiplier(tenure),
  trainingIqPerDay: (lifter: NpcLifter, tenure: SettledTenureDays): number =>
    EMPIRE_TUNING.NPC_TRAINING_IQ_PER_DAY_BASE *
    EMPIRE_TUNING.NPC_TIER_OUTPUT_MULTIPLIER[lifter.tier] *
    loyaltyMultiplier(tenure),
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface RosterSpec {
  readonly tier: NpcTier;
  /** Accelerated-clock second the lifter appeared on the roster. */
  readonly joinedAt: number;
  /** Wall-clock second the recruitment would have completed unaided. */
  readonly settledAt: number;
}

interface GymFixture {
  readonly label: string;
  readonly equipment: EquipmentTier;
  readonly spaceLevel: number;
  readonly coachLevel: number;
  readonly spotterLevel: number;
  readonly physioLevel: number;
  readonly roster: readonly RosterSpec[];
}

function lifterFrom(spec: RosterSpec, index: number): NpcLifter {
  return createNpcLifter(
    `lifter-${index}`,
    spec.tier,
    `roster slot ${index}`,
    spec.joinedAt,
    spec.settledAt,
  );
}

function stateFrom(fixture: GymFixture, elapsedSeconds: number, skippedSeconds: number): EmpireState {
  const staffLevel: Record<StaffRole, number> = {
    coach: fixture.coachLevel,
    spotter: fixture.spotterLevel,
    physio: fixture.physioLevel,
  };
  const axes = Object.freeze({
    equipment: fixture.equipment,
    spaceLevel: fixture.spaceLevel,
    staffLevel: Object.freeze(staffLevel),
  });
  const state: EmpireState = Object.freeze({
    clock: createEmpireClock(elapsedSeconds, skippedSeconds),
    axes,
    // The fixture describes one gym, so both views of the ladders are the same
    // ladders. What this file measures is the two RATES, and the wall-clock
    // book's rate reads no axes at all.
    settledAxes: axes,
    roster: Object.freeze(fixture.roster.map(lifterFrom)),
    reputation: asReputation(0),
    gymBucks: asGymBucks(0),
    settledBooks: createEmpireState().settledBooks,
    ledger: Object.freeze([]),
    accelerants: Object.freeze([]),
  });
  // Every fixture is a state the module's own invariants accept. Without this a
  // fixture that overfilled its roster would still produce numbers and the whole
  // sweep would be measuring a state the game cannot reach.
  assertEmpireState(state);
  return state;
}

const EMPTY_GYM: GymFixture = Object.freeze({
  label: 'an empty gym on its opening day',
  equipment: 'bare-bar',
  spaceLevel: 0,
  coachLevel: 0,
  spotterLevel: 0,
  physioLevel: 0,
  roster: Object.freeze([]),
});

const SMALL_GYM: GymFixture = Object.freeze({
  label: 'two lifters, no expansion',
  equipment: 'bare-bar',
  spaceLevel: 0,
  coachLevel: 0,
  spotterLevel: 0,
  physioLevel: 0,
  roster: Object.freeze([
    { tier: 'novice', joinedAt: 0, settledAt: 0 } as const,
    { tier: 'club', joinedAt: 600, settledAt: 600 } as const,
  ]),
});

const BUILT_GYM: GymFixture = Object.freeze({
  label: 'every bucks axis raised, four lifters',
  equipment: 'monolift',
  spaceLevel: 3,
  coachLevel: 4,
  spotterLevel: 2,
  physioLevel: 1,
  roster: Object.freeze([
    { tier: 'novice', joinedAt: 0, settledAt: 0 } as const,
    { tier: 'club', joinedAt: 600, settledAt: 600 } as const,
    { tier: 'regional', joinedAt: 1800, settledAt: 1800 } as const,
    { tier: 'national', joinedAt: 7200, settledAt: 7200 } as const,
  ]),
});

const SKIPPED_RECRUIT_GYM: GymFixture = Object.freeze({
  label: 'a lifter a timer skip landed before the recruitment would have settled',
  equipment: 'comp-plates',
  spaceLevel: 1,
  coachLevel: 1,
  spotterLevel: 1,
  physioLevel: 0,
  roster: Object.freeze([
    { tier: 'legendary', joinedAt: 0, settledAt: EMPIRE_TUNING.NPC_RECRUIT_SECONDS.legendary } as const,
  ]),
});

const SWEEP_FIXTURES: readonly GymFixture[] = Object.freeze([
  EMPTY_GYM,
  SMALL_GYM,
  BUILT_GYM,
  SKIPPED_RECRUIT_GYM,
]);

// ---------------------------------------------------------------------------
// The offline-cap sweep's parameters, written down so the measurement is one
// ---------------------------------------------------------------------------

const OFFLINE_SWEEP = Object.freeze({
  /** How long an absence the sweep runs out to. Four times the shipped horizon. */
  GAP_SECONDS_MAX: 48 * 3600,
  /** The coarse step. Fifteen minutes, so the whole range is walked. */
  GAP_STEP_SECONDS: 900,
  /**
   * Extra probes placed around each anchor below, so the pairs that straddle the
   * horizon are dense rather than fifteen minutes apart. The one-second offsets
   * are the pairs a clamp that is off by a tick fails on.
   */
  BOUNDARY_OFFSETS: Object.freeze([
    -3601, -3600, -901, -900, -2, -1, 0, 1, 2, 900, 901, 3600, 3601,
  ] as const),
  /** The seconds the probes cluster around: the horizon and the no-punish floor. */
  ANCHOR_SECONDS: Object.freeze([HORIZON_SECONDS, NO_PUNISH_SECONDS] as const),
  /** The wall-clock second the collection mark sits at in every sweep run. */
  MARK_SECONDS: 4 * 86400,
  /**
   * The negative control's penalty, in Gym Bucks per second of absence past the
   * horizon. Chosen large enough that a one-second pair past the horizon is a
   * visible reversal at six decimal places and small enough that the control
   * stays non-negative across the whole range for every fixture.
   */
  CONTROL_PENALTY_PER_SECOND: 0.001,
});

function sweepGaps(): readonly number[] {
  const gaps = new Set<number>();
  for (let at = 0; at <= OFFLINE_SWEEP.GAP_SECONDS_MAX; at += OFFLINE_SWEEP.GAP_STEP_SECONDS) {
    gaps.add(at);
  }
  for (const anchor of OFFLINE_SWEEP.ANCHOR_SECONDS) {
    for (const offset of OFFLINE_SWEEP.BOUNDARY_OFFSETS) {
      const gap = anchor + offset;
      if (gap >= 0 && gap <= OFFLINE_SWEEP.GAP_SECONDS_MAX) gaps.add(gap);
    }
  }
  return Object.freeze([...gaps].sort((left, right) => left - right));
}

const SWEEP_GAPS = sweepGaps();

/**
 * The mark and the state a sweep point is measured at.
 *
 * The mark is fixed and `now` moves forward by the gap, which is the shape of
 * the design promise: one player left at a moment, and the longer they stay away
 * the more they must come back to.
 */
function accrualAtGap(fixture: GymFixture, gapSeconds: number): ProductionAccrual {
  const mark: EmpireClock = createEmpireClock(OFFLINE_SWEEP.MARK_SECONDS, 0);
  const state = stateFrom(fixture, OFFLINE_SWEEP.MARK_SECONDS + gapSeconds, 0);
  return accrueProduction(state, mark, STAND_IN_RATES);
}

interface SweepResult {
  readonly pairsCompared: number;
  readonly violations: number;
  readonly strictlyIncreasingPairs: number;
  readonly plateauPairs: number;
  readonly worstDeficit: number;
}

/**
 * The one driver both the subject and the control run through, so the control
 * measures the instrument rather than a second instrument.
 */
function monotonicitySweep(payout: (fixture: GymFixture, gapSeconds: number) => number): SweepResult {
  let pairsCompared = 0;
  let violations = 0;
  let strictlyIncreasingPairs = 0;
  let plateauPairs = 0;
  let worstDeficit = 0;
  for (const fixture of SWEEP_FIXTURES) {
    const payouts = SWEEP_GAPS.map((gap) => payout(fixture, gap));
    for (let shorter = 0; shorter < payouts.length; shorter += 1) {
      for (let longer = shorter + 1; longer < payouts.length; longer += 1) {
        const before = payouts[shorter] as number;
        const after = payouts[longer] as number;
        pairsCompared += 1;
        if (after < before) {
          violations += 1;
          worstDeficit = Math.max(worstDeficit, before - after);
        } else if (after > before) {
          strictlyIncreasingPairs += 1;
        } else {
          plateauPairs += 1;
        }
      }
    }
  }
  return { pairsCompared, violations, strictlyIncreasingPairs, plateauPairs, worstDeficit };
}

// ---------------------------------------------------------------------------
// scrubPrecision
// ---------------------------------------------------------------------------

describe('scrubPrecision', () => {
  it('rounds to the tuned number of decimals', () => {
    // Reddens on: dropping `Math.round`, or scaling by anything other than
    // `10 ** PRECISION_DECIMALS`.
    expect(EMPIRE_TUNING.PRECISION_DECIMALS).toBe(6);
    expect(scrubPrecision(1 / 3)).toBe(0.333333);
    expect(scrubPrecision(2 / 3)).toBe(0.666667);
    expect(scrubPrecision(0.1 + 0.2)).toBe(0.3);
    // The scrub is what makes two accruals that should be equal compare equal.
    // Without it this pair differs in the last bit.
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('is non-decreasing, which is what the sweep below rests on', () => {
    // Reddens on: replacing the round-and-divide with anything that folds — a
    // modulo, a fractional part, a wrap.
    let checked = 0;
    let previous = -Infinity;
    for (let step = 0; step <= 4000; step += 1) {
      const value = scrubPrecision(step * 0.000_000_37);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
      checked += 1;
    }
    // Counts, not bounds.
    expect(checked).toBe(4001);
  });

  it('refuses a non-finite quantity rather than passing it on', () => {
    // Reddens on: deleting the `Number.isFinite` guard.
    expect(() => scrubPrecision(Number.NaN)).toThrow(/must be finite/);
    expect(() => scrubPrecision(Number.POSITIVE_INFINITY)).toThrow(/must be finite/);
  });
});

// ---------------------------------------------------------------------------
// quantiseElapsedSeconds
// ---------------------------------------------------------------------------

describe('quantiseElapsedSeconds', () => {
  it('drops the part of a span that does not fill a whole tick', () => {
    // Reddens on: dropping `Math.floor`.
    expect(EMPIRE_TUNING.TICK_SECONDS).toBe(1);
    expect(quantiseElapsedSeconds(90)).toBe(90);
    expect(quantiseElapsedSeconds(90.7)).toBe(90);
    expect(quantiseElapsedSeconds(0.9)).toBe(0);
  });

  it('really divides by the tick, at a tick the shipped tuning does not use', () => {
    // Reddens on: `Math.floor(seconds)` in place of
    // `Math.floor(seconds / tickSeconds) * tickSeconds`. At the shipped tick of
    // one second those two are the same function, so the divisor is only
    // reachable at another tick — which is why the argument exists.
    expect(quantiseElapsedSeconds(90, 60)).toBe(60);
    expect(quantiseElapsedSeconds(119, 60)).toBe(60);
    expect(quantiseElapsedSeconds(120, 60)).toBe(120);
    expect(quantiseElapsedSeconds(59, 60)).toBe(0);
  });

  it('refuses a backwards span and a tick that cannot divide', () => {
    // Two arms, written together because they are two branches of one
    // decision — CLAUDE.md's "the next thing to look at is the branch
    // immediately below it".
    // Reddens on: deleting either guard.
    expect(() => quantiseElapsedSeconds(-1)).toThrow(/at or above zero/);
    expect(() => quantiseElapsedSeconds(Number.NaN)).toThrow(/at or above zero/);
    expect(() => quantiseElapsedSeconds(10, 0)).toThrow(/above zero/);
    expect(() => quantiseElapsedSeconds(10, -60)).toThrow(/above zero/);
  });
});

// ---------------------------------------------------------------------------
// The cap itself
// ---------------------------------------------------------------------------

describe('the offline-earnings horizon', () => {
  it('is the shipped cap, in seconds', () => {
    // Reddens on: dropping the `* SECONDS_PER_HOUR`, or reading a different
    // tuning entry.
    expect(EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS).toBe(12);
    expect(offlineBankingHorizonSeconds()).toBe(12 * 3600);
    expect(SHIPPED_OFFLINE_BANKING_POLICY.capHours).toBe(
      EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS,
    );
    expect(SHIPPED_OFFLINE_BANKING_POLICY.noPunishHours).toBe(
      EMPIRE_TUNING.OFFLINE_EARNINGS_NO_PUNISH_HOURS,
    );
  });

  it('takes the larger of the cap and the no-punish floor, in both directions', () => {
    // THE CHECK THIS FILE WOULD BE WEAKEST WITHOUT. At the shipped tuning the
    // cap is twelve hours and the floor is ten, so `Math.max(cap, floor)` and
    // `cap` are the same number and deleting the `Math.max` is invisible. Both
    // arms are driven here at policies the shipped tuning does not reach.
    //
    // Reddens on: `Math.max(capHours, noPunishHours)` becoming `capHours` (the
    // first expectation) or `noPunishHours` (the second).
    expect(offlineBankingHorizonSeconds({ capHours: 4, noPunishHours: 10 })).toBe(10 * 3600);
    expect(offlineBankingHorizonSeconds({ capHours: 20, noPunishHours: 10 })).toBe(20 * 3600);
    // And the shipped policy really is the case where the two agree, so the
    // pair above is not measuring a policy the game never uses by accident.
    expect(SHIPPED_OFFLINE_BANKING_POLICY.capHours).toBeGreaterThan(
      SHIPPED_OFFLINE_BANKING_POLICY.noPunishHours,
    );
  });

  it('refuses a policy that is not made of hours, on each field separately', () => {
    // Reddens on: deleting either guard. Two arms, one per field.
    expect(() => offlineBankingHorizonSeconds({ capHours: -1, noPunishHours: 10 })).toThrow(
      /offline cap/,
    );
    expect(() =>
      offlineBankingHorizonSeconds({ capHours: 12, noPunishHours: Number.NaN }),
    ).toThrow(/no-punish floor/);
  });
});

describe('bankableOfflineSeconds', () => {
  it('banks a gap whole while it is inside the no-punish floor', () => {
    // GDD §5.1: the cap "rewards check-ins without punishing a 10-hour gap".
    // Reddens on: the clamp binding earlier than the horizon — for instance
    // `Math.min(gap, capHours * SECONDS_PER_HOUR / 2)`.
    let checked = 0;
    for (let gap = 0; gap <= NO_PUNISH_SECONDS; gap += 60) {
      expect(bankableOfflineSeconds(gap)).toBe(gap);
      checked += 1;
    }
    // Counts, not bounds: the loop really walked ten hours of minutes.
    expect(checked).toBe(601);
    expect(NO_PUNISH_SECONDS).toBe(10 * 3600);
  });

  it('flattens at the horizon and stays there', () => {
    // Reddens on: the clamp being removed (the values keep climbing), or
    // becoming a deduction (they fall).
    let flat = 0;
    for (let gap = HORIZON_SECONDS; gap <= OFFLINE_SWEEP.GAP_SECONDS_MAX; gap += 900) {
      expect(bankableOfflineSeconds(gap)).toBe(HORIZON_SECONDS);
      flat += 1;
    }
    // Counts, not bounds: 145 probes from the horizon out to 48 hours.
    expect(flat).toBe(145);
    // One tick under the horizon is one tick short of it, so the flattening
    // starts exactly where the horizon is rather than before it.
    expect(bankableOfflineSeconds(HORIZON_SECONDS - 1)).toBe(HORIZON_SECONDS - 1);
  });

  it('keeps the ten-hour gap whole even under a cap set below it', () => {
    // Reddens on: `bankableOfflineSeconds` clamping to `policy.capHours` rather
    // than to the horizon. This is the behavioural half of the `Math.max` check
    // above — the horizon function could be right and this could still clamp to
    // the wrong thing.
    const lowCap: OfflineBankingPolicy = { capHours: 4, noPunishHours: 10 };
    expect(bankableOfflineSeconds(9 * 3600, lowCap)).toBe(9 * 3600);
    expect(bankableOfflineSeconds(10 * 3600, lowCap)).toBe(10 * 3600);
    expect(bankableOfflineSeconds(11 * 3600, lowCap)).toBe(10 * 3600);
  });
});

// ---------------------------------------------------------------------------
// THE SWEEP
// ---------------------------------------------------------------------------

describe('a longer absence is never worth less than a shorter one', () => {
  it('has a domain that reaches both sides of the horizon', () => {
    // The non-vacuity guard for everything below. Counts, not bounds: how many
    // gaps, how many of them sit past the horizon, how many inside it. A
    // generator that had gone one-sided would make the sweep's zero a fact about
    // an empty half.
    expect(SWEEP_GAPS.length).toBe(209);
    expect(SWEEP_GAPS.filter((gap) => gap < HORIZON_SECONDS).length).toBe(60);
    expect(SWEEP_GAPS.filter((gap) => gap > HORIZON_SECONDS).length).toBe(148);
    expect(SWEEP_GAPS.filter((gap) => gap === HORIZON_SECONDS).length).toBe(1);
    expect(SWEEP_GAPS[0]).toBe(0);
    expect(SWEEP_GAPS[SWEEP_GAPS.length - 1]).toBe(OFFLINE_SWEEP.GAP_SECONDS_MAX);
    expect(SWEEP_FIXTURES.length).toBe(4);
  });

  it('holds on Gym Bucks across the horizon and well past it, with zero violations', () => {
    // Reddens on: any edit that makes banked seconds fall with the gap — the
    // clamp becoming a subtraction, the rate being read at `now` while the
    // roster shrinks, the fraction being applied to the discarded half.
    const result = monotonicitySweep(
      (fixture, gap) => accrualAtGap(fixture, gap).gymBucks as number,
    );
    expect(result.pairsCompared).toBe(86944);
    expect(result.violations).toBe(0);
    expect(result.worstDeficit).toBe(0);
    // Both outcomes really occur, so the zero is not a zero over a constant
    // series and not a zero over a strictly increasing one either. The plateau
    // is the cap doing its job; the increase is the gym paying at all.
    expect(result.strictlyIncreasingPairs).toBe(42840);
    expect(result.plateauPairs).toBe(44104);
    expect(result.strictlyIncreasingPairs + result.plateauPairs).toBe(result.pairsCompared);
    // The plateau count is derivable rather than observed: 149 of the 209 gaps
    // sit at or past the horizon, every pair of those pays the same, and there
    // are four fixtures. If the horizon moved, this arithmetic moves with it and
    // the pin above does not — which is the point of writing both down.
    expect((149 * 148) / 2).toBe(11026);
    expect(11026 * SWEEP_FIXTURES.length).toBe(result.plateauPairs);
  });

  it('holds on Training IQ too, which the cap does not touch', () => {
    // Reddens on: the offline cap being applied to the trickle. If it were, the
    // plateau count here would be non-zero, and the pin below is what says so.
    const result = monotonicitySweep(
      (fixture, gap) => accrualAtGap(fixture, gap).trainingIq as number,
    );
    expect(result.pairsCompared).toBe(86944);
    expect(result.violations).toBe(0);
    // Every gap is a distinct payout except at gap zero, where the empty first
    // element pairs with itself against nothing — the trickle is uncapped, so
    // the only equal pairs are the ones the empty gym contributes at zero rate.
    expect(result.plateauPairs).toBe(0);
    expect(result.strictlyIncreasingPairs).toBe(86944);
  });

  it('NEGATIVE CONTROL: the same sweep sees a punishing cap', () => {
    // A zero with nothing beside it is the empty-domain vacuity this codebase
    // has been bitten by repeatedly. This runs the identical driver over the
    // real accrual PLUS a documented defect — a Gym Bucks penalty per second of
    // absence past the horizon — so what is being graded is the sweep, not a
    // second implementation of the subject.
    //
    // Reddens on: the driver stopping at the first violation, comparing the
    // wrong direction, or walking a domain that never reaches past the horizon.
    const control = monotonicitySweep((fixture, gap) => {
      const paid = accrualAtGap(fixture, gap).gymBucks as number;
      const past = Math.max(0, gap - HORIZON_SECONDS);
      return paid - OFFLINE_SWEEP.CONTROL_PENALTY_PER_SECOND * past;
    });
    expect(control.pairsCompared).toBe(86944);
    expect(control.violations).toBe(46680);
    expect(control.worstDeficit).toBeCloseTo(129.6, 6);
  });

  it('past the horizon two different absences pay exactly the same', () => {
    // The plateau as an equality rather than as a count.
    // Reddens on: `accrueProduction` reading its rates at `state.clock` instead
    // of at `collectedAt`. That edit leaves the sweep above green — the payouts
    // still rise — and breaks this, because roster tenure keeps growing past the
    // horizon and the flat banked seconds get multiplied by a rate that is not.
    const twelve = accrualAtGap(BUILT_GYM, HORIZON_SECONDS);
    const forty = accrualAtGap(BUILT_GYM, 40 * 3600);
    expect(twelve.gymBucks).toBe(forty.gymBucks);
    expect(twelve.offlineSecondsBanked).toBe(forty.offlineSecondsBanked);
    // And the two really are different absences, so the equality is not two
    // readings of one point.
    expect(twelve.offlineSecondsElapsed).not.toBe(forty.offlineSecondsElapsed);
    expect(forty.trainingIq).not.toBe(twelve.trainingIq);
  });

  it('reports what the cap discarded rather than dropping it silently', () => {
    // Reddens on: `offlineSecondsDiscarded` being hardcoded to zero, or the
    // three counts stopping adding up.
    let withDiscard = 0;
    let withoutDiscard = 0;
    for (const gap of SWEEP_GAPS) {
      const accrual = accrualAtGap(SMALL_GYM, gap);
      expect(accrual.offlineSecondsBanked + accrual.offlineSecondsDiscarded).toBe(
        accrual.offlineSecondsElapsed,
      );
      if (accrual.offlineSecondsDiscarded > 0) withDiscard += 1;
      else withoutDiscard += 1;
    }
    // Counts, not bounds: both halves of the domain were seen.
    expect(withDiscard).toBe(148);
    expect(withoutDiscard).toBe(61);
    expect(withDiscard + withoutDiscard).toBe(SWEEP_GAPS.length);
  });
});

// ---------------------------------------------------------------------------
// The clock split, measured rather than asserted
// ---------------------------------------------------------------------------

describe('a purchased timer skip moves Gym Bucks and does not move Training IQ', () => {
  const MARK: EmpireClock = createEmpireClock(0, 0);
  const ELAPSED = 6 * 3600;
  const SKIP = EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT;

  const unskipped = stateFrom(BUILT_GYM, ELAPSED, 0);
  const skipped = stateFrom(BUILT_GYM, ELAPSED, SKIP);

  it('has two states that differ only in what was skipped', () => {
    // The non-vacuity guard for the three checks below: the wall clocks agree,
    // the idle clocks do not, and the rosters are identical.
    expect(skipped.clock.unaccelerated).toBe(unskipped.clock.unaccelerated);
    expect(skipped.clock.accelerated).not.toBe(unskipped.clock.accelerated);
    expect(skipped.clock.accelerated - unskipped.clock.accelerated).toBe(SKIP);
    expect(skipped.roster).toEqual(unskipped.roster);
  });

  it('pays more Gym Bucks under the skip, which is what GDD §8.3B sells', () => {
    // Reddens on: `gymBucksRatePerHour` or the idle gap reading the wall clock.
    // Stated as a strict increase rather than as "differs", because §8.3B is a
    // sale and a sale that paid less would also "differ".
    const withSkip = accrueProduction(skipped, MARK, STAND_IN_RATES);
    const without = accrueProduction(unskipped, MARK, STAND_IN_RATES);
    expect(withSkip.gymBucks as number).toBeGreaterThan(without.gymBucks as number);
    expect(withSkip.offlineSecondsElapsed).toBeGreaterThan(without.offlineSecondsElapsed);
  });

  it('leaves the rate at a shared mark alone, and moves it at the gym own clock', () => {
    // Two facts about the same pair, and keeping them apart is the design
    // decision in §5 of `production.ts`'s header rather than an accident.
    //
    // `accrueProduction` reads its rates at `collectedAt`, and both states here
    // were marked at the same moment, so the RATES agree and the skip shows up
    // as a longer idle gap. Read at each gym's own clock the rates differ,
    // because idle tenure is what the skip moved.
    //
    // Reddens on: `accrueProduction` reading its rates at `state.clock` (the
    // first pair stops being equal), and on `gymBucksRatePerHour` reading the
    // wall clock (the second pair stops differing).
    const withSkip = accrueProduction(skipped, MARK, STAND_IN_RATES);
    const without = accrueProduction(unskipped, MARK, STAND_IN_RATES);
    expect(withSkip.rates.gymBucksPerHour).toBe(without.rates.gymBucksPerHour);
    expect(gymBucksRatePerHour(skipped, skipped.clock, STAND_IN_RATES)).toBeGreaterThan(
      gymBucksRatePerHour(unskipped, unskipped.clock, STAND_IN_RATES),
    );
    // And the trickle read at each gym's own clock is still identical, so the
    // line above is the idle clock moving rather than both clocks moving.
    expect(trainingIqRatePerDay(skipped, skipped.clock, STAND_IN_RATES)).toBe(
      trainingIqRatePerDay(unskipped, unskipped.clock, STAND_IN_RATES),
    );
  });

  it('pays byte-identical Training IQ, element-wise on the progression ledger', () => {
    // GDD §8.1 and §12.3: nothing purchasable may affect training pace, and
    // Training IQ is §2's stat for how well you train.
    //
    // Reddens on: `accrueProduction` computing `wallGap` through
    // `elapsedFor(_, 'gym-bucks')` — which compiles, because both readings are
    // numbers once subtracted — or on `trainingIqRatePerDay` being handed
    // `state.clock.accelerated` by any arithmetic route.
    //
    // Element-wise on the list, not on an aggregate: GDD §4.4 records a legal
    // input that moved 2362 of 34338 lists and left every aggregate identical.
    const withSkip = accrueProduction(skipped, MARK, STAND_IN_RATES);
    const without = accrueProduction(unskipped, MARK, STAND_IN_RATES);
    expect(withSkip.trainingIq).toBe(without.trainingIq);
    expect(withSkip.rates.trainingIqPerDay).toBe(without.rates.trainingIqPerDay);
    expect(withSkip.trainingIqSecondsElapsed).toBe(without.trainingIqSecondsElapsed);

    const reaching = progressionLedger(withSkip.ledger);
    const reachingWithout = progressionLedger(without.ledger);
    expect(reaching.length).toBe(1);
    expect(reaching).toEqual(reachingWithout);
    // And the idle half of the same two ledgers is not identical, so the
    // element-wise comparison above is a fact about the split rather than about
    // two runs that produced the same everything.
    expect(idleLedger(withSkip.ledger)).not.toEqual(idleLedger(without.ledger));
  });

  it('holds across a range of skip sizes, with the counts pinned', () => {
    // The single-point version above is one skip. This is every skip size from
    // none to a full day, so the equality is not an accident of one magnitude.
    let compared = 0;
    let bucksDiffered = 0;
    const baseline = accrueProduction(unskipped, MARK, STAND_IN_RATES);
    for (let grants = 0; grants <= 24; grants += 1) {
      const state = stateFrom(BUILT_GYM, ELAPSED, grants * SKIP);
      const accrual = accrueProduction(state, MARK, STAND_IN_RATES);
      expect(accrual.trainingIq).toBe(baseline.trainingIq);
      expect(progressionLedger(accrual.ledger)).toEqual(progressionLedger(baseline.ledger));
      if ((accrual.gymBucks as number) !== (baseline.gymBucks as number)) bucksDiffered += 1;
      compared += 1;
    }
    // Counts, not bounds: 25 skip sizes compared, 24 of which moved the idle
    // half. A run where nothing moved would be an equality over one state.
    expect(compared).toBe(25);
    expect(bucksDiffered).toBe(24);
  });

  it('pays byte-identical money into the WALL-CLOCK book, at the baseline line', () => {
    // The book §5.4's physio rung and §5.3's recruits are bought out of, so
    // this equality is the one `empireInvariant.ts` composes chain C's closure
    // on top of. Reddens on: `accrueProduction` banking this half over the idle
    // gap, or paying it at `rates.gymBucksPerHour` rather than at
    // `settledGymBucksRatePerHour`.
    const withSkip = accrueProduction(skipped, MARK, STAND_IN_RATES);
    const without = accrueProduction(unskipped, MARK, STAND_IN_RATES);
    expect(withSkip.settledGymBucks).toBe(without.settledGymBucks);

    // The equality is not an equality between two identical rates: this gym's
    // own rate is far above the baseline line, and its roster and its ladders
    // are what make it so.
    expect(withSkip.rates.gymBucksPerHour).toBeGreaterThan(settledGymBucksRatePerHour());
    expect(settledGymBucksRatePerHour()).toBe(EMPIRE_TUNING.GYM_BUCKS_BASE_PER_HOUR);
    expect(settledGymBucksRatePerHour()).toBe(120);

    // And a gym with nothing at all pays the same into that book over the same
    // wall-clock gap, which is what "reads no state" means. Reddens on any
    // roster term or axis multiplier appearing on this line.
    const empty = accrueProduction(stateFrom(EMPTY_GYM, ELAPSED, 0), MARK, STAND_IN_RATES);
    expect(empty.settledGymBucks).toBe(withSkip.settledGymBucks);
    expect(empty.gymBucks as number).toBeLessThan(withSkip.gymBucks as number);
  });

  it('holds that equality across every skip size, with the counts pinned', () => {
    // The sibling of the Training IQ sweep above, on the other quantity the
    // wall clock owns. Same shape deliberately: this codebase keeps finding its
    // next gap in the branch beside a fixed one.
    let compared = 0;
    let settledDiffered = 0;
    let bucksDiffered = 0;
    const baseline = accrueProduction(unskipped, MARK, STAND_IN_RATES);
    for (let grants = 0; grants <= 24; grants += 1) {
      const accrual = accrueProduction(
        stateFrom(BUILT_GYM, ELAPSED, grants * EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT),
        MARK,
        STAND_IN_RATES,
      );
      if ((accrual.settledGymBucks as number) !== (baseline.settledGymBucks as number)) {
        settledDiffered += 1;
      }
      if ((accrual.gymBucks as number) !== (baseline.gymBucks as number)) bucksDiffered += 1;
      compared += 1;
    }
    expect(compared).toBe(25);
    expect(settledDiffered).toBe(0);
    // The zero above is a zero against this: the same 25 states moved the
    // accelerated book 24 times.
    expect(bucksDiffered).toBe(24);
  });
});

describe('a lifter a skip landed early pays Gym Bucks and no trickle until they settle', () => {
  // The part the brands do not cover: a purchase moves `joinedAt`, and
  // `settledTenureDays` floors at zero rather than reporting absence, so an
  // unsettled lifter would otherwise be paid at the tenure-zero rate.
  const SETTLES_AT = EMPIRE_TUNING.NPC_RECRUIT_SECONDS.legendary;

  it('leaves the trickle at the base rate while the recruit is unsettled', () => {
    // Reddens on: deleting `if (lifter.settledAt > now) continue;` from
    // `trainingIqRatePerDay`.
    const early = stateFrom(SKIPPED_RECRUIT_GYM, SETTLES_AT - 1, SETTLES_AT);
    expect(trainingIqRatePerDay(early, early.clock, STAND_IN_RATES)).toBe(
      EMPIRE_TUNING.TRAINING_IQ_BASE_PER_DAY,
    );
    // Non-vacuity: the lifter is on the roster and is being paid on the other
    // side, so the filter is excluding one output rather than excluding the
    // lifter from the gym.
    expect(early.roster.length).toBe(1);
    const withLifter = gymBucksRatePerHour(early, early.clock, STAND_IN_RATES);
    const withoutLifter = gymBucksRatePerHour(
      stateFrom({ ...SKIPPED_RECRUIT_GYM, roster: [] }, SETTLES_AT - 1, SETTLES_AT),
      early.clock,
      STAND_IN_RATES,
    );
    expect(withLifter).toBeGreaterThan(withoutLifter);
  });

  it('starts paying the trickle on the wall-clock second the recruit would have settled', () => {
    // Reddens on: the comparison becoming `>=` when it should be `>`, or the
    // filter reading `joinedAt`. Both sides of the boundary are driven.
    const before = stateFrom(SKIPPED_RECRUIT_GYM, SETTLES_AT - 1, SETTLES_AT);
    const on = stateFrom(SKIPPED_RECRUIT_GYM, SETTLES_AT, SETTLES_AT);
    expect(trainingIqRatePerDay(before, before.clock, STAND_IN_RATES)).toBe(
      EMPIRE_TUNING.TRAINING_IQ_BASE_PER_DAY,
    );
    expect(trainingIqRatePerDay(on, on.clock, STAND_IN_RATES)).toBeGreaterThan(
      EMPIRE_TUNING.TRAINING_IQ_BASE_PER_DAY,
    );
  });

  it('leaves a lifter who has not joined yet out of the Gym Bucks line', () => {
    // The sibling of the filter above, written out because the branch
    // immediately below a fixed one is where this codebase keeps finding the
    // next gap.
    // Reddens on: deleting `if (lifter.joinedAt > now) continue;` from
    // `gymBucksRatePerHour`.
    const future: GymFixture = {
      ...SMALL_GYM,
      roster: [{ tier: 'national', joinedAt: 10 * 3600, settledAt: 10 * 3600 }],
    };
    const early = stateFrom(future, 3600, 0);
    const empty = stateFrom({ ...future, roster: [] }, 3600, 0);
    expect(gymBucksRatePerHour(early, early.clock, STAND_IN_RATES)).toBe(
      gymBucksRatePerHour(empty, empty.clock, STAND_IN_RATES),
    );
    // Non-vacuity: the same lifter is paid once the accelerated clock reaches
    // them, so the equality above is the filter and not a rate of zero.
    const arrived = stateFrom(future, 11 * 3600, 0);
    expect(gymBucksRatePerHour(arrived, arrived.clock, STAND_IN_RATES)).toBeGreaterThan(
      gymBucksRatePerHour(empty, empty.clock, STAND_IN_RATES),
    );
  });
});

// ---------------------------------------------------------------------------
// Aggregation — GDD §5.2
// ---------------------------------------------------------------------------

describe('aggregation over the gym and its roster', () => {
  it('is the base line alone when the roster is empty', () => {
    // Reddens on: the base passive income being dropped from the sum, or an
    // axis multiplier being applied at level zero.
    const opening = stateFrom(EMPTY_GYM, 0, 0);
    expect(gymBucksRatePerHour(opening, opening.clock, STAND_IN_RATES)).toBe(
      EMPIRE_TUNING.GYM_BUCKS_BASE_PER_HOUR,
    );
    expect(trainingIqRatePerDay(opening, opening.clock, STAND_IN_RATES)).toBe(
      EMPIRE_TUNING.TRAINING_IQ_BASE_PER_DAY,
    );
  });

  it('adds each lifter through the rate source it was given', () => {
    // Reddens on: the roster loop being dropped, or a lifter being counted
    // twice. The expected value is recomputed from the stand-in rather than
    // restated, so it does not mirror `production.ts`'s own arithmetic.
    const at = 5 * 86400;
    const state = stateFrom(SMALL_GYM, at, 0);
    let expected = EMPIRE_TUNING.GYM_BUCKS_BASE_PER_HOUR;
    for (const lifter of state.roster) {
      const tenureDays = (at - lifter.joinedAt) / EMPIRE_TUNING.SECONDS_PER_DAY;
      expected +=
        EMPIRE_TUNING.NPC_GYM_BUCKS_PER_HOUR_BASE *
        EMPIRE_TUNING.NPC_TIER_OUTPUT_MULTIPLIER[lifter.tier] *
        loyaltyMultiplier(tenureDays);
    }
    expect(state.roster.length).toBe(2);
    expect(gymBucksRatePerHour(state, state.clock, STAND_IN_RATES)).toBe(scrubPrecision(expected));
  });

  it('multiplies the Gym Bucks line by the three axes that raise it', () => {
    // Reddens on: any of the equipment, space or coach multipliers being
    // dropped from `gymBucksRatePerHour`. Each is turned on alone so a missing
    // one cannot be hidden by the other two.
    const bare = stateFrom(EMPTY_GYM, 0, 0);
    const base = gymBucksRatePerHour(bare, bare.clock, STAND_IN_RATES);

    const equipped = stateFrom({ ...EMPTY_GYM, equipment: 'monolift' }, 0, 0);
    expect(gymBucksRatePerHour(equipped, equipped.clock, STAND_IN_RATES)).toBe(
      scrubPrecision(base * EMPIRE_TUNING.EQUIPMENT_TIER_BUCKS_MULTIPLIER.monolift),
    );

    const roomy = stateFrom({ ...EMPTY_GYM, spaceLevel: 3 }, 0, 0);
    expect(gymBucksRatePerHour(roomy, roomy.clock, STAND_IN_RATES)).toBe(
      scrubPrecision(base * (EMPIRE_TUNING.SPACE_PASSIVE_CEILING_MULTIPLIER[3] as number)),
    );

    const coached = stateFrom({ ...EMPTY_GYM, coachLevel: 4 }, 0, 0);
    expect(gymBucksRatePerHour(coached, coached.clock, STAND_IN_RATES)).toBe(
      scrubPrecision(base * (1 + EMPIRE_TUNING.STAFF_COACH_BUCKS_MULTIPLIER_PER_LEVEL * 4)),
    );
  });

  it('multiplies the trickle by none of them', () => {
    // GDD §8.1: every one of those three axes is bought with Gym Bucks and every
    // one of their build timers is skippable, so a multiplier here would be a
    // purchase reaching training pace in two hops.
    //
    // Reddens on: the axis multiplier being applied in `trainingIqRatePerDay`.
    // The roster is small enough that the daily ceiling is not what is holding
    // the two equal, and the line below says so.
    const bare = stateFrom(SMALL_GYM, 5 * 86400, 0);
    const built = stateFrom(
      { ...SMALL_GYM, equipment: 'monolift', spaceLevel: 3, coachLevel: 4 },
      5 * 86400,
      0,
    );
    const trickle = trainingIqRatePerDay(bare, bare.clock, STAND_IN_RATES);
    expect(trainingIqRatePerDay(built, built.clock, STAND_IN_RATES)).toBe(trickle);
    expect(trickle).toBeLessThan(EMPIRE_TUNING.TRAINING_IQ_DAILY_CEILING);
    // And the same two gyms are plainly different on the side the axes do reach.
    expect(gymBucksRatePerHour(built, built.clock, STAND_IN_RATES)).toBeGreaterThan(
      gymBucksRatePerHour(bare, bare.clock, STAND_IN_RATES),
    );
  });

  it('holds the trickle at the daily ceiling however large the gym gets', () => {
    // GDD §2 lists two sources for Training IQ; an idle layer with no ceiling
    // eventually makes the second one the whole stat.
    // Reddens on: dropping the `Math.min` against `TRAINING_IQ_DAILY_CEILING`.
    const crowded: GymFixture = {
      ...BUILT_GYM,
      spaceLevel: 5,
      spotterLevel: 4,
      roster: Array.from({ length: EMPIRE_TUNING.ROSTER_SLOTS_MAX }, () => ({
        tier: 'legendary' as const,
        joinedAt: 0,
        settledAt: 0,
      })),
    };
    const state = stateFrom(crowded, 90 * 86400, 0);
    expect(state.roster.length).toBe(16);
    // The uncapped sum, recomputed from the stand-in, really is over the
    // ceiling — so the equality below is the clamp biting rather than a small
    // gym coincidentally landing on the number.
    let uncapped = EMPIRE_TUNING.TRAINING_IQ_BASE_PER_DAY;
    for (const lifter of state.roster) {
      uncapped +=
        EMPIRE_TUNING.NPC_TRAINING_IQ_PER_DAY_BASE *
        EMPIRE_TUNING.NPC_TIER_OUTPUT_MULTIPLIER[lifter.tier] *
        loyaltyMultiplier(90);
    }
    expect(uncapped).toBeGreaterThan(EMPIRE_TUNING.TRAINING_IQ_DAILY_CEILING);
    expect(trainingIqRatePerDay(state, state.clock, STAND_IN_RATES)).toBe(
      EMPIRE_TUNING.TRAINING_IQ_DAILY_CEILING,
    );
  });

  it('refuses a rate source that hands back something that is not a rate', () => {
    // Piece E2's implementation arrives from outside this file. A NaN accepted
    // here becomes a NaN payout, and `EmpireLedgerEntry.amount` would carry it.
    // Reddens on: deleting `requireRate` from either loop. Two arms, one per
    // output.
    const state = stateFrom(SMALL_GYM, 86400, 0);
    const nanBucks: RosterRateSource = {
      ...STAND_IN_RATES,
      gymBucksPerHour: () => Number.NaN,
    };
    const negativeIq: RosterRateSource = {
      ...STAND_IN_RATES,
      trainingIqPerDay: () => -1,
    };
    expect(() => gymBucksRatePerHour(state, state.clock, nanBucks)).toThrow(/gym bucks per hour/);
    expect(() => trainingIqRatePerDay(state, state.clock, negativeIq)).toThrow(
      /training iq per day/,
    );
  });

  it('refuses a space level that is off the passive-ceiling ladder', () => {
    // Reddens on: `spacePassiveMultiplier` returning a default instead of
    // throwing, which would silently pay a built gym at the bare rate.
    const offLadder = {
      ...stateFrom(EMPTY_GYM, 0, 0),
      axes: { equipment: 'bare-bar' as const, spaceLevel: 99, staffLevel: { coach: 0, spotter: 0, physio: 0 } },
    };
    expect(() => gymBucksRatePerHour(offLadder, offLadder.clock, STAND_IN_RATES)).toThrow(
      /off the passive-ceiling ladder/,
    );
  });

  it('reports both rates together', () => {
    // Reddens on: `productionRates` returning one field twice, or swapping them.
    const state = stateFrom(BUILT_GYM, 3 * 86400, 0);
    const rates = productionRates(state, state.clock, STAND_IN_RATES);
    expect(rates.gymBucksPerHour).toBe(gymBucksRatePerHour(state, state.clock, STAND_IN_RATES));
    expect(rates.trainingIqPerDay).toBe(trainingIqRatePerDay(state, state.clock, STAND_IN_RATES));
    expect(rates.gymBucksPerHour).not.toBe(rates.trainingIqPerDay);
  });
});

// ---------------------------------------------------------------------------
// Accrual arithmetic and the ledger
// ---------------------------------------------------------------------------

describe('accrueProduction', () => {
  it('pays the offline share of the rate over the banked seconds', () => {
    // The arithmetic, stated once. Reddens on: dropping
    // `OFFLINE_EARNINGS_FRACTION`, or dividing by the wrong unit.
    const mark = createEmpireClock(0, 0);
    const state = stateFrom(EMPTY_GYM, 4 * 3600, 0);
    const accrual = accrueProduction(state, mark, STAND_IN_RATES);
    expect(accrual.offlineSecondsBanked).toBe(4 * 3600);
    expect(accrual.offlineSecondsDiscarded).toBe(0);
    expect(accrual.gymBucks as number).toBe(
      scrubPrecision(EMPIRE_TUNING.GYM_BUCKS_BASE_PER_HOUR * EMPIRE_TUNING.OFFLINE_EARNINGS_FRACTION * 4),
    );
    // The fraction really is below one, so the line above is not an identity.
    expect(EMPIRE_TUNING.OFFLINE_EARNINGS_FRACTION).toBeLessThan(1);
  });

  it('pays the trickle per calendar day of wall time, undiscounted and uncapped', () => {
    // Reddens on: `OFFLINE_EARNINGS_FRACTION` or the offline cap being applied
    // to the trickle. Three days is a quarter of a day past the twelve-hour
    // horizon many times over, so a cap would show here at once.
    const mark = createEmpireClock(0, 0);
    const state = stateFrom(EMPTY_GYM, 3 * 86400, 0);
    const accrual = accrueProduction(state, mark, STAND_IN_RATES);
    expect(accrual.trainingIqSecondsElapsed).toBe(3 * 86400);
    expect(accrual.trainingIq as number).toBe(EMPIRE_TUNING.TRAINING_IQ_BASE_PER_DAY * 3);
    // And the Gym Bucks half of the same accrual WAS capped, so the two really
    // are on different rules rather than both being uncapped.
    expect(accrual.offlineSecondsDiscarded).toBeGreaterThan(0);
  });

  it('stamps the ledger on the wall clock and pays one entry per output', () => {
    // Reddens on: `at` being taken from `collectedAt` rather than from
    // `state.clock`, or an entry being dropped. The state's two readings differ,
    // so the stamp is a choice rather than a coincidence.
    const mark = createEmpireClock(0, 0);
    const state = stateFrom(SMALL_GYM, 2 * 3600, 900);
    const accrual = accrueProduction(state, mark, STAND_IN_RATES);
    expect(state.clock.accelerated).not.toBe(state.clock.unaccelerated);
    expect(accrual.ledger.length).toBe(2);
    expect(accrual.ledger.map((entry) => entry.output)).toEqual(['gym-bucks', 'training-iq']);
    expect(accrual.ledger.map((entry) => entry.at as number)).toEqual([2 * 3600, 2 * 3600]);
    expect(accrual.ledger.map((entry) => entry.amount)).toEqual([
      accrual.gymBucks as number,
      accrual.trainingIq as number,
    ]);
    expect(progressionLedger(accrual.ledger).length).toBe(1);
    expect(idleLedger(accrual.ledger).length).toBe(1);
  });

  it('pays nothing for a gap of nothing', () => {
    // Reddens on: an accrual that pays on the rate rather than on the elapsed
    // time — a check-in loop that paid for opening the app would be a reward
    // keyed to what the player does.
    const mark = createEmpireClock(1234, 0);
    const state = stateFrom(BUILT_GYM, 1234, 0);
    const accrual = accrueProduction(state, mark, STAND_IN_RATES);
    expect(accrual.gymBucks as number).toBe(0);
    expect(accrual.trainingIq as number).toBe(0);
    expect(accrual.offlineSecondsElapsed).toBe(0);
    // The rates are not zero, so this is the elapsed time and not an empty gym.
    expect(accrual.rates.gymBucksPerHour).toBeGreaterThan(0);
    expect(accrual.rates.trainingIqPerDay).toBeGreaterThan(0);
  });

  it('refuses a mark that is ahead of the gym, on each clock separately', () => {
    // Two arms of one decision. A silently clamped backwards gap is a payout
    // nothing reports, and a negative one would reach `asGymBucks` as a
    // different error entirely.
    // Reddens on: deleting either guard — each message is matched by name, so
    // the fallthrough error from `quantiseElapsedSeconds` does not satisfy it.
    const behindOnIdle = stateFrom(EMPTY_GYM, 100, 0);
    expect(() =>
      accrueProduction(behindOnIdle, createEmpireClock(100, 50), STAND_IN_RATES),
    ).toThrow(/idle clock/);

    const behindOnWall = stateFrom(EMPTY_GYM, 100, 100);
    expect(() =>
      accrueProduction(behindOnWall, createEmpireClock(150, 0), STAND_IN_RATES),
    ).toThrow(/wall clock/);
  });

  it('takes the banking policy as an argument', () => {
    // Reddens on: `accrueProduction` ignoring its `policy` argument and reading
    // `SHIPPED_OFFLINE_BANKING_POLICY` directly.
    const mark = createEmpireClock(0, 0);
    const state = stateFrom(EMPTY_GYM, 24 * 3600, 0);
    const shipped = accrueProduction(state, mark, STAND_IN_RATES);
    const generous = accrueProduction(state, mark, STAND_IN_RATES, {
      capHours: 24,
      noPunishHours: 10,
    });
    expect(shipped.offlineSecondsBanked).toBe(12 * 3600);
    expect(generous.offlineSecondsBanked).toBe(24 * 3600);
    expect(generous.gymBucks as number).toBeGreaterThan(shipped.gymBucks as number);
  });
});

// ---------------------------------------------------------------------------
// Purity and the magic-number audit, for this file specifically
// ---------------------------------------------------------------------------

describe('production.ts is pure and numerically clean', () => {
  const SOURCE = readFileSync(path.join(HERE, 'production.ts'), 'utf8');
  const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('has a source to scan', () => {
    // The non-vacuity guard for the two scans below: a comment strip that ate
    // the file would make both of them pass over an empty string.
    expect(SOURCE.length).toBeGreaterThan(0);
    expect(CODE.length).toBeGreaterThan(0);
    expect(CODE).toMatch(/export function accrueProduction/);
  });

  it('reads no clock, rolls no dice and touches no host API', () => {
    // The same ban list `empireCore.test.ts` runs over the directory, applied to
    // this file, because that scan's own domain is pinned at the two modules
    // that shipped before this one.
    const banned: readonly RegExp[] = [
      /\bDate\b/,
      /\bperformance\s*\./,
      /Math\s*\.\s*random/,
      /\brandom\b/i,
      /\bshuffle\b/i,
      /\bweight/i,
      /\bseed\b/i,
      /\bdistribution\b/i,
      /\bprobability\b/i,
      /\brarity\b/i,
      /\bgacha\b/i,
      /\bfetch\s*\(/,
      /\bprocess\b/,
      /\bwindow\b/,
      /\bdocument\b/,
      /\blocalStorage\b/,
      /from ['"]react/,
    ];
    const tripwires: readonly string[] = [
      'const now = Date.now();',
      'performance . now()',
      'Math.random()',
      'const r = random();',
      'shuffle(list)',
      'const w = weights[0];',
      'const seed = 7;',
      'const distribution = [];',
      'const probability = 0.5;',
      'const rarity = 3;',
      'gacha()',
      'fetch (url)',
      'process.env',
      'window.alert',
      'document.body',
      'localStorage.getItem',
      "import x from 'react';",
    ];
    let checks = 0;
    for (const [index, pattern] of banned.entries()) {
      expect(CODE, `production.ts must not reach ${String(pattern)}`).not.toMatch(pattern);
      // Each pattern is driven against a string it should trip, so a regex that
      // stopped matching anything is red rather than quietly green.
      expect(tripwires[index], `pattern ${String(pattern)} matches nothing`).toMatch(pattern);
      checks += 1;
    }
    // Counts, not bounds.
    expect(checks).toBe(17);
    expect(checks).toBe(banned.length);
  });

  it('imports only this directory', () => {
    // An import edge out of `src/empire/` is how a pure module acquires a side
    // effect it did not ask for.
    // Reddens on: an import of anything outside this directory being added.
    const imports = [...CODE.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] as string);
    expect(imports).toEqual(['./empireCore', './empireTuning']);
  });

  it('holds every number in the tuning module', () => {
    // The repository's own audit, run against this file under its real path.
    // `production.ts` is not a registered constants home, so a bare literal in
    // it is a finding.
    // Reddens on: any bare numeric literal being written into `production.ts`.
    const findings = auditSource('src/empire/production.ts', SOURCE);
    expect(findings.length, `\n${formatFindings(findings)}\n`).toBe(0);
    // And the instrument is live on a file it has never seen, so the zero above
    // is not the audit having stopped reporting.
    expect(auditSource('src/empire/probe.ts', 'export const RATE = 42;\n').length).toBe(1);
  });

  it('ships no string a real name could be hiding in', () => {
    // GDD §12.3 refuses a real, named athlete, brand or company in any string or
    // code path. This cannot tell a real name from an invented one — that is the
    // human, name-by-name pass — but it makes a person-shaped one visible.
    const strings: string[] = [];
    for (const match of CODE.matchAll(/'([^'\\\n]*)'/g)) strings.push(match[1] as string);
    for (const match of CODE.matchAll(/"([^"\\\n]*)"/g)) strings.push(match[1] as string);
    for (const match of CODE.matchAll(/`((?:[^`\\]|\\[\s\S])*)`/g)) {
      strings.push((match[1] as string).replace(/\$\{[^}]*\}/g, ' '));
    }
    const personShaped = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;
    let checked = 0;
    for (const value of strings) {
      expect(personShaped.test(value), `${value} is shaped like a person's name`).toBe(false);
      checked += 1;
    }
    // Counts, not bounds: the collectors really found the file's strings,
    // including the template messages the single-quote collector cannot see.
    expect(checked).toBe(strings.length);
    expect(checked).toBe(23);
    expect(strings.filter((value) => value.includes('is off the passive-ceiling')).length).toBe(1);
    // The pattern is not a dead letter, and the probe is derived from this
    // file's own vocabulary rather than written beside the pattern.
    const token = 'gym-bucks'.replace(/[^A-Za-z]/g, '');
    const titled = `${token.slice(0, 1).toUpperCase()}${token.slice(1).toLowerCase()}`;
    expect(personShaped.test(`${titled} ${titled}`)).toBe(true);
  });
});
