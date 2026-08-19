/**
 * ladder.test.ts — stage 1's invariants, swept in the house shape: named
 * parameters in `LADDER_SWEEP`, deterministic generators, counts pinned (not
 * bounds), and a non-zero control kept runnable beside every zero so the
 * zeros are zero against something.
 *
 * The three subjects, from the stage-1 brief and GDD §5.7/§5.10/§12.3:
 *
 *   - never punish engagement: an extra check-in must not leave the player
 *     worse — swept exhaustively over every subset of a short slot grid and
 *     on seeded longer calendars, under both shipped policies;
 *   - never punish absence: more absence differs by capped foregone income
 *     and by nothing else — same pair set, read the other direction, plus a
 *     prefix sweep that watches rung and equipment never shrink over time;
 *   - the cap: non-decreasing in the gap, flat past the horizon, plateau
 *     derived from the tuning rather than transcribed, boundary straddled.
 *
 * On the money reading under a spending policy, said plainly because the
 * numbers below depend on it: cash-in-hand is not element-wise comparable
 * under a rule that spends when it can afford to — the more-engaged twin
 * crosses a price threshold first, converts cash into a rung or an item, and
 * holds less cash while being strictly ahead. That is the player's own
 * decision arriving earlier, not a penalty. So the enforced reading under
 * `cheapest-affordable-first` is joint: accrued income, rung and equipment
 * are each monotone in engagement, and the conservation equality (cash plus
 * everything paid equals everything accrued, exactly) pins that any cash
 * deficit is exactly the price of the extra assets held. Under `hoard`
 * nothing is spent, and there cash itself is monotone and pinned at zero
 * violations. `CASH_DIVERGENCES_UNDER_SPENDING` keeps the measured count of
 * threshold crossings in the file so the joint reading is a decision a
 * reader can see the size of, not a quiet substitution.
 */

import { describe, expect, it } from 'vitest';
import {
  LADDER_POLICIES,
  type CompetitionLift,
  type LadderBuyResult,
  type LadderEquipmentItem,
  type LadderMoveResult,
  type LadderPolicy,
  type LadderRun,
  type LadderRung,
  type LadderState,
  accrueLadderGymBucks,
  buyLadderEquipment,
  createLadderState,
  ladderCheckIn,
  ladderEquipmentCost,
  ladderEquipmentMinRung,
  ladderIncomeRatePerHour,
  ladderMoveCost,
  ladderRungIndex,
  moveUpLadder,
  nextLadderRung,
  requireLadderState,
  runLadder,
  unlockedLifts,
} from './ladder';
import { offlineBankingHorizonSeconds, scrubPrecision } from './production';
import { EMPIRE_TUNING } from './empireTuning';

const T = EMPIRE_TUNING;

// ---------------------------------------------------------------------------
// Sweep parameters — every input of every measurement below, in one place
// ---------------------------------------------------------------------------

/**
 * The parameters of every sweep in this file, exported the way
 * `EMPIRE_SWEEP` and `ENGAGEMENT_SWEEP` are: a measurement whose inputs are
 * not written down is an anecdote (`src/game/streakSweep.ts`'s lesson).
 */
export const LADDER_SWEEP = Object.freeze({
  /**
   * The exhaustive grid: six days of two slots, one slot every twelve hours.
   *
   * Twelve hours and not a smaller spacing, for a reason the first version of
   * this file measured the hard way: at six-hour slots over three days the
   * grid's whole accrual tops out at 2160 Gym Bucks, below every price in the
   * stage-1 tuning, so the spending policy never spent and its sweep was the
   * hoard sweep wearing a second name — an axis with one point, however many
   * subsets the grid has. At twelve-hour slots the full grid banks 4320,
   * which straddles the first relocation (2500) and, after it, the rack
   * (1500), so the spending policy genuinely diverges from hoard inside the
   * exhaustive domain. `CASH_DIVERGENCES_UNDER_SPENDING.EXHAUSTIVE` being
   * non-zero is the pinned evidence the axis varies.
   */
  EXHAUSTIVE_SLOTS: 12,
  SLOT_SECONDS: 43200,
  /**
   * Every subset of the grid is a schedule; every (schedule, absent slot)
   * pair is a monotonicity pair. 2^12 subsets x 12 slots / 2 = 24576.
   */
  EXHAUSTIVE_SCHEDULES: 4096,
  EXHAUSTIVE_PAIRS: 24576,

  /** The seeded calendars: LCG-generated attendance on a two-slot day. */
  SEEDS: Object.freeze([11, 23, 47, 61, 83] as const),
  SEEDED_LENGTHS_DAYS: Object.freeze([40, 100] as const),
  SEEDED_SLOTS_PER_DAY: 2,
  /** A slot is attended unless the draw lands on 0 mod 3 — two-thirds attendance. */
  ATTENDANCE_MODULUS: 3,
  /** Numerical Recipes LCG, the same generator class the house sweeps use. */
  LCG_MULTIPLIER: 1664525,
  LCG_INCREMENT: 1013904223,
  LCG_MODULUS: 4294967296,

  /** Prefix (trajectory) sweep: the first two calendars per length. */
  TRAJECTORY_SEEDS: 2,

  /**
   * The control's per-check-in fee, in Gym Bucks — deliberately above the
   * most a single extra slot on the grid can bank (a full horizon at the
   * garage rate is 360), so an extra check-in under the fee model is a net
   * loss at every pair and the control's count is the whole pair set. The
   * shipped model has no fee anywhere; this is the "checked in more, ended
   * up worse" shape kept runnable so the zeros are zero against a counter
   * that counts.
   */
  CONTROL_FEE_GYM_BUCKS: 500,

  /** Cap sweep: every whole tick from zero to this far past the horizon. */
  CAP_SWEEP_PAST_HORIZON_SECONDS: 3600,
});

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** The exhaustive grid's slot times: slot k checks in at (k+1) x SLOT_SECONDS. */
function slotTime(slot: number): number {
  return (slot + 1) * LADDER_SWEEP.SLOT_SECONDS;
}

/** The schedule a subset bitmask names, ascending. */
function scheduleOf(mask: number): readonly number[] {
  const times: number[] = [];
  for (let slot = 0; slot < LADDER_SWEEP.EXHAUSTIVE_SLOTS; slot += 1) {
    if ((mask & (1 << slot)) !== 0) times.push(slotTime(slot));
  }
  return times;
}

/** The seeded calendar for one seed and length, as attended slot times. */
function seededSchedule(seed: number, lengthDays: number): readonly number[] {
  const slotSeconds = T.SECONDS_PER_DAY / LADDER_SWEEP.SEEDED_SLOTS_PER_DAY;
  let draw = seed;
  const times: number[] = [];
  const slots = lengthDays * LADDER_SWEEP.SEEDED_SLOTS_PER_DAY;
  for (let slot = 0; slot < slots; slot += 1) {
    draw =
      (draw * LADDER_SWEEP.LCG_MULTIPLIER + LADDER_SWEEP.LCG_INCREMENT) %
      LADDER_SWEEP.LCG_MODULUS;
    if (draw % LADDER_SWEEP.ATTENDANCE_MODULUS !== 0) times.push((slot + 1) * slotSeconds);
  }
  return times;
}

/** Insert one extra check-in, keeping the schedule strictly ascending. */
function withExtra(schedule: readonly number[], at: number): readonly number[] {
  return [...schedule, at].sort((left, right) => left - right);
}

// ---------------------------------------------------------------------------
// The divergence read on one monotonicity pair
// ---------------------------------------------------------------------------

interface PairDivergence {
  /** The more-engaged run accrued less. Violating under every policy. */
  readonly accruedLower: boolean;
  /** The more-engaged run ended on a lower rung. Violating. */
  readonly rungLower: boolean;
  /** The more-engaged run's equipment is not a superset. Violating. */
  readonly equipmentNotSuperset: boolean;
  /** The more-engaged run holds less cash. Violating under `hoard` only. */
  readonly cashLower: boolean;
}

function divergence(base: LadderRun, moreEngaged: LadderRun): PairDivergence {
  const held = new Set(moreEngaged.state.equipment);
  return {
    accruedLower: moreEngaged.accruedGymBucks < base.accruedGymBucks,
    rungLower: ladderRungIndex(moreEngaged.state.rung) < ladderRungIndex(base.state.rung),
    equipmentNotSuperset: !base.state.equipment.every((item) => held.has(item)),
    cashLower: moreEngaged.state.gymBucks < base.state.gymBucks,
  };
}

/** Cash plus everything paid equals everything accrued. Exact, per run. */
function conservationHolds(run: LadderRun): boolean {
  const paid =
    run.bought.reduce((total, item) => total + ladderEquipmentCost(item), 0) +
    run.movedTo.reduce((total, to) => total + ladderMoveCost(to), 0);
  return scrubPrecision(run.state.gymBucks + paid) === scrubPrecision(run.accruedGymBucks);
}

interface SweepTally {
  pairs: number;
  accruedLower: number;
  rungLower: number;
  equipmentNotSuperset: number;
  cashLower: number;
  conservationBreaks: number;
}

function emptyTally(): SweepTally {
  return {
    pairs: 0,
    accruedLower: 0,
    rungLower: 0,
    equipmentNotSuperset: 0,
    cashLower: 0,
    conservationBreaks: 0,
  };
}

function tallyPair(tally: SweepTally, base: LadderRun, moreEngaged: LadderRun): void {
  const read = divergence(base, moreEngaged);
  tally.pairs += 1;
  tally.accruedLower += read.accruedLower ? 1 : 0;
  tally.rungLower += read.rungLower ? 1 : 0;
  tally.equipmentNotSuperset += read.equipmentNotSuperset ? 1 : 0;
  tally.cashLower += read.cashLower ? 1 : 0;
  tally.conservationBreaks += conservationHolds(base) && conservationHolds(moreEngaged) ? 0 : 1;
}

// ---------------------------------------------------------------------------
// The sweeps, memoised — each pair set is walked once per policy
// ---------------------------------------------------------------------------

const exhaustiveMemo = new Map<LadderPolicy, SweepTally>();

/**
 * Every (schedule, absent slot) pair of the exhaustive grid: the run without
 * the slot is the base, the run with it is the more-engaged twin. Runs are
 * memoised per mask, so 2^12 runs serve 24576 pairs.
 */
function exhaustiveSweep(policy: LadderPolicy): SweepTally {
  const memo = exhaustiveMemo.get(policy);
  if (memo !== undefined) return memo;
  const runs = new Map<number, LadderRun>();
  const runOf = (mask: number): LadderRun => {
    const found = runs.get(mask);
    if (found !== undefined) return found;
    const run = runLadder(scheduleOf(mask), policy);
    runs.set(mask, run);
    return run;
  };
  const tally = emptyTally();
  const masks = 1 << LADDER_SWEEP.EXHAUSTIVE_SLOTS;
  for (let mask = 0; mask < masks; mask += 1) {
    for (let slot = 0; slot < LADDER_SWEEP.EXHAUSTIVE_SLOTS; slot += 1) {
      const bit = 1 << slot;
      if ((mask & bit) !== 0) continue;
      tallyPair(tally, runOf(mask), runOf(mask | bit));
    }
  }
  exhaustiveMemo.set(policy, tally);
  return tally;
}

const seededMemo = new Map<LadderPolicy, SweepTally>();

/** The seeded pairs: each calendar against itself plus each absent slot. */
function seededSweep(policy: LadderPolicy): SweepTally {
  const memo = seededMemo.get(policy);
  if (memo !== undefined) return memo;
  const tally = emptyTally();
  const slotSeconds = T.SECONDS_PER_DAY / LADDER_SWEEP.SEEDED_SLOTS_PER_DAY;
  for (const lengthDays of LADDER_SWEEP.SEEDED_LENGTHS_DAYS) {
    for (const seed of LADDER_SWEEP.SEEDS) {
      const schedule = seededSchedule(seed, lengthDays);
      const attended = new Set(schedule);
      const base = runLadder(schedule, policy);
      const slots = lengthDays * LADDER_SWEEP.SEEDED_SLOTS_PER_DAY;
      for (let slot = 0; slot < slots; slot += 1) {
        const at = (slot + 1) * slotSeconds;
        if (attended.has(at)) continue;
        tallyPair(tally, base, runLadder(withExtra(schedule, at), policy));
      }
    }
  }
  seededMemo.set(policy, tally);
  return tally;
}

/**
 * The control: the identical hoard fold with a per-check-in fee subtracted
 * from final cash — the "checked in more, ended up worse" shape, kept
 * runnable so the zeros above are zero against a machine that can count.
 */
function feeControlCashViolations(): number {
  const runs = new Map<number, number>();
  const cashOf = (mask: number): number => {
    const found = runs.get(mask);
    if (found !== undefined) return found;
    const run = runLadder(scheduleOf(mask), 'hoard');
    const cash =
      run.state.gymBucks - run.checkIns * LADDER_SWEEP.CONTROL_FEE_GYM_BUCKS;
    runs.set(mask, cash);
    return cash;
  };
  let violations = 0;
  const masks = 1 << LADDER_SWEEP.EXHAUSTIVE_SLOTS;
  for (let mask = 0; mask < masks; mask += 1) {
    for (let slot = 0; slot < LADDER_SWEEP.EXHAUSTIVE_SLOTS; slot += 1) {
      const bit = 1 << slot;
      if ((mask & bit) !== 0) continue;
      if (cashOf(mask | bit) < cashOf(mask)) violations += 1;
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Vocabulary and lookups
// ---------------------------------------------------------------------------

describe('the ladder vocabulary, derived from the tuning block', () => {
  it('indexes the four rungs bottom-up and knows the rung above each', () => {
    let walked = 0;
    for (const [at, rung] of T.LADDER_RUNGS.entries()) {
      expect(ladderRungIndex(rung)).toBe(at);
      const above = nextLadderRung(rung);
      if (at === T.LADDER_RUNGS.length - 1) expect(above).toBeNull();
      else expect(above).toBe(T.LADDER_RUNGS[at + 1]);
      walked += 1;
    }
    expect(walked).toBe(4);
    expect(ladderRungIndex('garage')).toBe(0);
    expect(nextLadderRung('warehouse')).toBeNull();
    // The cast route the runtime refusal exists for.
    expect(() => ladderRungIndex('penthouse' as LadderRung)).toThrow(/not a rung/);
  });

  it('prices every relocation and every item off the tuning tables, loudly', () => {
    let priced = 0;
    for (const rung of T.LADDER_RUNGS) {
      if (rung === T.LADDER_RUNGS[0]) continue;
      expect(ladderMoveCost(rung)).toBe(T.LADDER_MOVE_COST_GYM_BUCKS[rung]);
      priced += 1;
    }
    for (const item of T.LADDER_EQUIPMENT_ITEMS) {
      expect(ladderEquipmentCost(item)).toBe(T.LADDER_EQUIPMENT_COST_GYM_BUCKS[item]);
      expect(T.LADDER_RUNGS).toContain(ladderEquipmentMinRung(item));
      priced += 1;
    }
    expect(priced).toBe(7);
    expect(() => ladderMoveCost('garage' as never)).toThrow(/no relocation cost/);
    expect(() => ladderEquipmentCost('chalk-bowl' as LadderEquipmentItem)).toThrow(/no price/);
    expect(() => ladderEquipmentMinRung('chalk-bowl' as LadderEquipmentItem)).toThrow(
      /no minimum rung/,
    );
  });

  it('reads every income rate and refuses a rung with none', () => {
    let read = 0;
    for (const rung of T.LADDER_RUNGS) {
      expect(ladderIncomeRatePerHour(rung)).toBe(T.LADDER_INCOME_GYM_BUCKS_PER_HOUR[rung]);
      read += 1;
    }
    expect(read).toBe(4);
    expect(() => ladderIncomeRatePerHour('penthouse' as LadderRung)).toThrow(/no income rate/);
  });

  it('holds the stage-1 tuning shape the values promise', () => {
    // Re-derived from the values rather than restated: costs and incomes are
    // strictly increasing up the ladder, requirements and the starting kit
    // are subsets of the item list, and every min-rung is a rung.
    const costs = T.LADDER_RUNGS.filter((rung) => rung !== T.LADDER_RUNGS[0]).map((rung) =>
      ladderMoveCost(rung as Exclude<LadderRung, 'garage'>),
    );
    for (let at = 1; at < costs.length; at += 1) {
      expect(costs[at]).toBeGreaterThan(costs[at - 1] as number);
    }
    const incomes = T.LADDER_RUNGS.map((rung) => ladderIncomeRatePerHour(rung));
    for (let at = 1; at < incomes.length; at += 1) {
      expect(incomes[at]).toBeGreaterThan(incomes[at - 1] as number);
    }
    expect(incomes[0]).toBeGreaterThan(0);
    for (const item of T.LADDER_STARTING_EQUIPMENT) {
      expect(T.LADDER_EQUIPMENT_ITEMS).toContain(item);
    }
    let requirements = 0;
    for (const lift of T.LADDER_LIFTS) {
      for (const item of T.LADDER_LIFT_REQUIREMENTS[lift]) {
        expect(T.LADDER_EQUIPMENT_ITEMS).toContain(item);
        requirements += 1;
      }
    }
    expect(requirements).toBe(8);
    expect(Object.keys(T.LADDER_LIFT_REQUIREMENTS).sort()).toEqual([...T.LADDER_LIFTS].sort());
    expect(Object.keys(T.LADDER_EQUIPMENT_MIN_RUNG).sort()).toEqual(
      [...T.LADDER_EQUIPMENT_ITEMS].sort(),
    );
    expect(Object.keys(T.LADDER_EQUIPMENT_COST_GYM_BUCKS).sort()).toEqual(
      [...T.LADDER_EQUIPMENT_ITEMS].sort(),
    );
    expect(Object.keys(T.LADDER_MOVE_COST_GYM_BUCKS).sort()).toEqual(
      [...T.LADDER_RUNGS].filter((rung) => rung !== T.LADDER_RUNGS[0]).sort(),
    );
    expect(Object.keys(T.LADDER_INCOME_GYM_BUCKS_PER_HOUR).sort()).toEqual(
      [...T.LADDER_RUNGS].sort(),
    );
  });

  it('gates capability exactly as the requirement lists say, in meet order', () => {
    const opening = createLadderState();
    // §5.1's garage: bench and deadlift, no squat until the rack.
    expect(unlockedLifts(opening.equipment)).toEqual(['bench', 'deadlift']);
    expect(unlockedLifts([...T.LADDER_EQUIPMENT_ITEMS])).toEqual(['squat', 'bench', 'deadlift']);
    expect(unlockedLifts([])).toEqual([]);
    const barAndPlates: readonly CompetitionLift[] = unlockedLifts(['power-bar', 'comp-plates']);
    expect(barAndPlates).toEqual(['deadlift']);
    // The rack needs the storage unit's space before it can even be bought.
    expect(ladderEquipmentMinRung('squat-rack')).toBe('storage-unit');
  });
});

// ---------------------------------------------------------------------------
// State construction and validation
// ---------------------------------------------------------------------------

describe('the state constructor and the cast-route refusals', () => {
  it('opens in the garage with the §5.1 kit, no money, the mark at zero', () => {
    const state = createLadderState();
    expect(state.rung).toBe('garage');
    expect(state.gymBucks).toBe(0);
    expect(state.collectedAt).toBe(0);
    expect([...state.equipment].sort()).toEqual([...T.LADDER_STARTING_EQUIPMENT].sort());
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.equipment)).toBe(true);
    expect(requireLadderState(state)).toBe(state);
  });

  it('refuses every malformed state a cast can build, naming the fault', () => {
    const good = createLadderState();
    const routes: readonly (readonly [string, LadderState, RegExp])[] = [
      ['a fifth rung', { ...good, rung: 'penthouse' as LadderRung }, /not a rung/],
      ['negative money', { ...good, gymBucks: -1 }, /at or above zero/],
      ['non-finite money', { ...good, gymBucks: Number.NaN }, /at or above zero/],
      ['a negative mark', { ...good, collectedAt: -1 }, /whole non-negative tick/],
      ['an off-tick mark', { ...good, collectedAt: 0.5 }, /whole non-negative tick/],
      [
        'an unknown item',
        { ...good, equipment: ['chalk-bowl' as LadderEquipmentItem] },
        /not a Barbell-group item/,
      ],
      [
        'a duplicate item',
        { ...good, equipment: ['power-bar', 'power-bar'] as readonly LadderEquipmentItem[] },
        /held twice/,
      ],
      [
        'an out-of-order list',
        { ...good, equipment: ['comp-plates', 'power-bar'] as readonly LadderEquipmentItem[] },
        /fixed item order/,
      ],
    ];
    let refused = 0;
    for (const [why, state, message] of routes) {
      expect(() => requireLadderState(state), why).toThrow(message);
      refused += 1;
    }
    expect(refused).toBe(routes.length);
    expect(refused).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// The cap, against the SUM-input accrual
// ---------------------------------------------------------------------------

describe('the offline cap on the summed rate — reused, and swept where it is used', () => {
  it('is non-decreasing in the gap and flat past the horizon, at tick resolution', () => {
    const horizon = offlineBankingHorizonSeconds();
    const rate = ladderIncomeRatePerHour('garage');
    // The plateau, derived from the tuning rather than transcribed.
    const plateau = scrubPrecision(
      (rate * T.OFFLINE_EARNINGS_FRACTION * horizon) / T.SECONDS_PER_HOUR,
    );
    let previous = -1;
    let points = 0;
    let flatPoints = 0;
    const top = horizon + LADDER_SWEEP.CAP_SWEEP_PAST_HORIZON_SECONDS;
    for (let gap = 0; gap <= top; gap += T.TICK_SECONDS) {
      const accrual = accrueLadderGymBucks(rate, gap);
      expect(accrual.gymBucks).toBeGreaterThanOrEqual(previous);
      expect(accrual.secondsBanked + accrual.secondsDiscarded).toBe(accrual.secondsElapsed);
      if (gap >= horizon) {
        expect(accrual.gymBucks).toBe(plateau);
        expect(accrual.secondsBanked).toBe(horizon);
        flatPoints += 1;
      } else {
        expect(accrual.secondsDiscarded).toBe(0);
      }
      previous = accrual.gymBucks;
      points += 1;
    }
    // Counts, not bounds: the domain contains the horizon and both shores.
    expect(points).toBe(top + 1);
    expect(flatPoints).toBe(LADDER_SWEEP.CAP_SWEEP_PAST_HORIZON_SECONDS + 1);
    // The boundary, straddled by name.
    expect(accrueLadderGymBucks(rate, horizon - 1).secondsDiscarded).toBe(0);
    expect(accrueLadderGymBucks(rate, horizon).secondsBanked).toBe(horizon);
    expect(accrueLadderGymBucks(rate, horizon + 1).secondsDiscarded).toBe(1);
  });

  it('reads the rate as a sum input: stage 4 changes the argument, not the mechanism', () => {
    // Additivity in the RATE, which is what "fed by summed production" needs:
    // accruing at a summed rate equals summing the accruals, to within one
    // precision step of the scrub — derived from PRECISION_DECIMALS, not
    // eyeballed.
    const step = 1 / 10 ** T.PRECISION_DECIMALS;
    const gaps = [0, 1, 3599, 3600, 43199, 43200, 86400];
    let probed = 0;
    for (const gap of gaps) {
      for (const rung of T.LADDER_RUNGS) {
        const single = accrueLadderGymBucks(ladderIncomeRatePerHour(rung), gap).gymBucks;
        const summed = accrueLadderGymBucks(
          ladderIncomeRatePerHour(rung) + ladderIncomeRatePerHour('garage'),
          gap,
        ).gymBucks;
        const parts = scrubPrecision(
          single + accrueLadderGymBucks(ladderIncomeRatePerHour('garage'), gap).gymBucks,
        );
        expect(scrubPrecision(Math.abs(summed - parts))).toBeLessThanOrEqual(step);
        probed += 1;
      }
    }
    expect(probed).toBe(gaps.length * T.LADDER_RUNGS.length);
    expect(probed).toBe(28);
    // And the refusals hold the seam: a rate that is not a rate is loud.
    expect(() => accrueLadderGymBucks(-1, 0)).toThrow(/summed income rate/);
    expect(() => accrueLadderGymBucks(Number.NaN, 0)).toThrow(/summed income rate/);
    expect(() => accrueLadderGymBucks(1, -1)).toThrow(/at or above zero/);
  });
});

// ---------------------------------------------------------------------------
// Check-ins and the two decisions
// ---------------------------------------------------------------------------

describe('check-ins accrue the gap, decide nothing, and refuse a bent clock', () => {
  it('pays the gap at the rung rate and advances the mark, touching nothing else', () => {
    const opening = createLadderState();
    const sixHours = LADDER_SWEEP.SLOT_SECONDS;
    const checkedIn = ladderCheckIn(opening, sixHours);
    expect(checkedIn.state.collectedAt).toBe(sixHours);
    expect(checkedIn.accrual.secondsBanked).toBe(sixHours);
    expect(checkedIn.accrual.secondsDiscarded).toBe(0);
    expect(checkedIn.state.gymBucks).toBe(
      scrubPrecision(
        (ladderIncomeRatePerHour('garage') * T.OFFLINE_EARNINGS_FRACTION * sixHours) /
          T.SECONDS_PER_HOUR,
      ),
    );
    // A check-in is not a decision: rung and equipment are the same values,
    // by reference, so nothing here can ever be a forced transition.
    expect(checkedIn.state.rung).toBe(opening.rung);
    expect(checkedIn.state.equipment).toBe(opening.equipment);
    // A zero-length gap is legal and pays zero.
    const again = ladderCheckIn(checkedIn.state, sixHours);
    expect(again.accrual.gymBucks).toBe(0);
    expect(again.state.gymBucks).toBe(checkedIn.state.gymBucks);
  });

  it('refuses a backwards mark and an off-tick time', () => {
    const state = ladderCheckIn(createLadderState(), LADDER_SWEEP.SLOT_SECONDS).state;
    expect(() => ladderCheckIn(state, 0)).toThrow(/behind the mark/);
    expect(() => ladderCheckIn(state, LADDER_SWEEP.SLOT_SECONDS + 0.5)).toThrow(
      /whole non-negative tick/,
    );
    expect(() => ladderCheckIn(state, -1)).toThrow(/whole non-negative tick/);
  });
});

describe('the two spends: shown costs, loud refusals, every arm reachable', () => {
  /** A state at `rung` holding `gymBucks`, built through the public API only. */
  function stateAt(rung: LadderRung, gymBucks: number): LadderState {
    return requireLadderState(
      Object.freeze({ ...createLadderState(), rung, gymBucks }),
    );
  }

  it('buys an item exactly when the space fits it and the money covers it', () => {
    const rackCost = ladderEquipmentCost('squat-rack');
    const outcomes: readonly (readonly [string, LadderBuyResult, string])[] = [
      ['own kit again', buyLadderEquipment(stateAt('garage', rackCost), 'power-bar'), 'refused'],
      ['rack in the garage', buyLadderEquipment(stateAt('garage', rackCost), 'squat-rack'), 'refused'],
      ['rack while broke', buyLadderEquipment(stateAt('storage-unit', 0), 'squat-rack'), 'refused'],
      ['rack with space and money', buyLadderEquipment(stateAt('storage-unit', rackCost), 'squat-rack'), 'bought'],
    ];
    const reasons: string[] = [];
    for (const [why, outcome, kind] of outcomes) {
      expect(outcome.kind, why).toBe(kind);
      expect(outcome.cost).toBe(ladderEquipmentCost(outcome.item));
      if (outcome.kind === 'refused') reasons.push(outcome.reason);
    }
    expect(reasons).toEqual(['already-owned', 'rung-too-low', 'not-enough-gym-bucks']);
    const bought = outcomes[3]?.[1] as LadderBuyResult & { readonly kind: 'bought' };
    expect(bought.state.gymBucks).toBe(0);
    expect(bought.state.equipment).toContain('squat-rack');
    expect(unlockedLifts(bought.state.equipment)).toEqual(['squat', 'bench', 'deadlift']);
    // A refusal hands back the argument itself, unchanged.
    const refusal = outcomes[2]?.[1] as LadderBuyResult & { readonly kind: 'refused' };
    expect(refusal.state.equipment).not.toContain('squat-rack');
    // An exact-price buy succeeds: the comparison is `<`, not `<=`.
    expect(buyLadderEquipment(stateAt('storage-unit', rackCost - 1), 'squat-rack').kind).toBe(
      'refused',
    );
  });

  it('moves up one rung, charges the shown cost, and keeps the equipment — §5.1 as read', () => {
    const cost = ladderMoveCost('storage-unit');
    const rich = stateAt('garage', cost);
    const moved = moveUpLadder(rich);
    expect(moved.kind).toBe('moved');
    if (moved.kind !== 'moved') throw new Error('unreachable');
    expect(moved.from).toBe('garage');
    expect(moved.to).toBe('storage-unit');
    expect(moved.cost).toBe(cost);
    expect(moved.state.rung).toBe('storage-unit');
    expect(moved.state.gymBucks).toBe(0);
    // The equipment disposition, pinned: the old space is gone, the gear is
    // not. Same frozen array, byte-identical, by reference.
    expect(moved.state.equipment).toBe(rich.equipment);
    // The mark does not move either — relocation is a decision, not time.
    expect(moved.state.collectedAt).toBe(rich.collectedAt);

    const broke = moveUpLadder(stateAt('garage', cost - 1));
    expect(broke.kind).toBe('refused');
    if (broke.kind === 'refused' && broke.reason === 'not-enough-gym-bucks') {
      expect(broke.to).toBe('storage-unit');
      expect(broke.cost).toBe(cost);
    } else {
      throw new Error('the broke move should be refused for money');
    }

    const top = moveUpLadder(stateAt('warehouse', 0));
    expect(top.kind).toBe('refused');
    if (top.kind === 'refused') expect(top.reason).toBe('at-the-top');
  });

  it('walks the whole ladder one rung at a time, one way, cast route refused', () => {
    let state = stateAt(
      'garage',
      T.LADDER_RUNGS.filter((rung) => rung !== 'garage').reduce(
        (total, rung) => total + ladderMoveCost(rung as Exclude<LadderRung, 'garage'>),
        0,
      ),
    );
    const visited: LadderRung[] = [state.rung];
    for (;;) {
      const outcome = moveUpLadder(state);
      if (outcome.kind !== 'moved') break;
      // One rung at a time, and only ever up.
      expect(ladderRungIndex(outcome.to)).toBe(ladderRungIndex(outcome.from) + 1);
      state = outcome.state;
      visited.push(state.rung);
    }
    expect(visited).toEqual([...T.LADDER_RUNGS]);
    expect(state.gymBucks).toBe(0);
    expect(moveUpLadder(state).kind).toBe('refused');
  });
});

// ---------------------------------------------------------------------------
// The composed run and its invariants
// ---------------------------------------------------------------------------

describe('runLadder — deterministic, conserving, and refusing a bent schedule', () => {
  it('refuses a non-ascending schedule and an unknown policy', () => {
    expect(() => runLadder([1, 1], 'hoard')).toThrow(/strictly ascending/);
    expect(() => runLadder([2, 1], 'hoard')).toThrow(/strictly ascending/);
    expect(() => runLadder([], 'greedy' as LadderPolicy)).toThrow(/not a ladder policy/);
    expect(runLadder([], 'hoard').checkIns).toBe(0);
  });

  it('is byte-identical on identical inputs, across the seeded domain, twice', () => {
    let compared = 0;
    for (const lengthDays of LADDER_SWEEP.SEEDED_LENGTHS_DAYS) {
      for (const seed of LADDER_SWEEP.SEEDS) {
        const schedule = seededSchedule(seed, lengthDays);
        for (const policy of LADDER_POLICIES) {
          expect(JSON.stringify(runLadder(schedule, policy))).toBe(
            JSON.stringify(runLadder(schedule, policy)),
          );
          compared += 1;
        }
      }
    }
    expect(compared).toBe(
      LADDER_SWEEP.SEEDED_LENGTHS_DAYS.length * LADDER_SWEEP.SEEDS.length * LADDER_POLICIES.length,
    );
    expect(compared).toBe(20);
  });

  it('conserves money exactly on every run of both domains', () => {
    // Cash plus everything paid equals everything accrued — the equality that
    // makes the joint monotonicity reading below an accounting fact rather
    // than a policy taste. Checked here across the seeded domain; the
    // exhaustive domain is checked pair-by-pair inside the sweeps.
    let checked = 0;
    for (const lengthDays of LADDER_SWEEP.SEEDED_LENGTHS_DAYS) {
      for (const seed of LADDER_SWEEP.SEEDS) {
        for (const policy of LADDER_POLICIES) {
          expect(conservationHolds(runLadder(seededSchedule(seed, lengthDays), policy))).toBe(true);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(20);
  });

  it('never revisits a rung and never re-buys an item within a run', () => {
    for (const lengthDays of LADDER_SWEEP.SEEDED_LENGTHS_DAYS) {
      for (const seed of LADDER_SWEEP.SEEDS) {
        const run = runLadder(seededSchedule(seed, lengthDays), 'cheapest-affordable-first');
        // The relocation trail is a contiguous ascending walk from the rung
        // above the garage — one-way, no rung skipped, none repeated.
        expect(run.movedTo).toEqual(T.LADDER_RUNGS.slice(1, 1 + run.movedTo.length));
        expect(new Set(run.bought).size).toBe(run.bought.length);
        expect(run.state.rung).toBe(T.LADDER_RUNGS[run.movedTo.length]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Never punish engagement — the stage-1 subject
// ---------------------------------------------------------------------------

/**
 * The measured cash divergences under the spending policy, kept in the file
 * for the reason the header gives: they are threshold crossings — the
 * more-engaged twin affords a rung or an item first and holds less cash while
 * strictly ahead on what the cash became. The conservation equality holds on
 * every one of them, which is what pins that reading to arithmetic.
 */
const CASH_DIVERGENCES_UNDER_SPENDING = Object.freeze({
  EXHAUSTIVE: 7524,
  /**
   * Zero, and measured rather than assumed zero: on the 40- and 100-day
   * calendars a threshold crossing happens weeks before the end, and the
   * higher rung's income repays the price long before the final state is
   * compared — so the end-of-run cash read shows no divergence. The
   * exhaustive grid is where the run ends close enough to a crossing for the
   * cash dip to still be visible, which is why the non-zero evidence that
   * the spending axis varies lives there and not here.
   */
  SEEDED: 0,
});

describe('never punish engagement: an extra check-in is not a loss, measured', () => {
  it('holds exhaustively, on every subset of the slot grid, under both policies', () => {
    let policies = 0;
    for (const policy of LADDER_POLICIES) {
      const tally = exhaustiveSweep(policy);
      expect(tally.pairs, policy).toBe(LADDER_SWEEP.EXHAUSTIVE_PAIRS);
      expect(tally.accruedLower, policy).toBe(0);
      expect(tally.rungLower, policy).toBe(0);
      expect(tally.equipmentNotSuperset, policy).toBe(0);
      expect(tally.conservationBreaks, policy).toBe(0);
      policies += 1;
    }
    expect(policies).toBe(LADDER_POLICIES.length);
    // Cash itself: monotone where nothing is spent, and exactly the measured
    // threshold crossings where the policy spends.
    expect(exhaustiveSweep('hoard').cashLower).toBe(0);
    expect(exhaustiveSweep('cheapest-affordable-first').cashLower).toBe(
      CASH_DIVERGENCES_UNDER_SPENDING.EXHAUSTIVE,
    );
  });

  it('holds on the seeded 40- and 100-day calendars, under both policies', () => {
    for (const policy of LADDER_POLICIES) {
      const tally = seededSweep(policy);
      expect(tally.pairs, policy).toBeGreaterThan(0);
      expect(tally.accruedLower, policy).toBe(0);
      expect(tally.rungLower, policy).toBe(0);
      expect(tally.equipmentNotSuperset, policy).toBe(0);
      expect(tally.conservationBreaks, policy).toBe(0);
    }
    // The domain, pinned: how many pairs the calendars actually produced.
    expect(seededSweep('hoard').pairs).toBe(453);
    expect(seededSweep('cheapest-affordable-first').pairs).toBe(453);
    expect(seededSweep('hoard').cashLower).toBe(0);
    expect(seededSweep('cheapest-affordable-first').cashLower).toBe(
      CASH_DIVERGENCES_UNDER_SPENDING.SEEDED,
    );
  });

  it('keeps the punishing shape countable: the fee control is not zero', () => {
    // The identical machinery, pointed at a model that charges a fee per
    // check-in, produces the violations the shipped model is pinned at zero
    // of. Delete the fee and this number collapses to the shipped zero.
    expect(feeControlCashViolations()).toBe(24576);
  });
});

// ---------------------------------------------------------------------------
// Never punish absence — §5.7's rule, applied to what stage 1 has
// ---------------------------------------------------------------------------

describe('never punish absence: the gap costs capped income and nothing else', () => {
  it('under hoard, the absent twin differs in cash alone, by at most the derived bound', () => {
    // The same exhaustive pair set, read the other way: the run WITHOUT the
    // slot is the absent twin. Under hoard there are no decisions, so rung
    // and equipment must be identical values and the whole difference must be
    // the foregone income of one merged gap — bounded by the horizon's worth
    // of banked seconds at the garage rate, derived from the tuning.
    const rate = ladderIncomeRatePerHour('garage');
    const horizon = offlineBankingHorizonSeconds();
    const bound = scrubPrecision((rate * T.OFFLINE_EARNINGS_FRACTION * horizon) / T.SECONDS_PER_HOUR);
    const runs = new Map<number, LadderRun>();
    const runOf = (mask: number): LadderRun => {
      const found = runs.get(mask);
      if (found !== undefined) return found;
      const run = runLadder(scheduleOf(mask), 'hoard');
      runs.set(mask, run);
      return run;
    };
    let pairs = 0;
    let worstForegone = 0;
    const masks = 1 << LADDER_SWEEP.EXHAUSTIVE_SLOTS;
    for (let mask = 0; mask < masks; mask += 1) {
      for (let slot = 0; slot < LADDER_SWEEP.EXHAUSTIVE_SLOTS; slot += 1) {
        const bit = 1 << slot;
        if ((mask & bit) !== 0) continue;
        const absent = runOf(mask);
        const present = runOf(mask | bit);
        expect(absent.state.rung).toBe(present.state.rung);
        expect(absent.state.equipment).toEqual(present.state.equipment);
        const foregone = scrubPrecision(present.state.gymBucks - absent.state.gymBucks);
        expect(foregone).toBeGreaterThanOrEqual(0);
        expect(foregone).toBeLessThanOrEqual(bound);
        worstForegone = Math.max(worstForegone, foregone);
        pairs += 1;
      }
    }
    expect(pairs).toBe(LADDER_SWEEP.EXHAUSTIVE_PAIRS);
    // The bound is attained, not merely respected: a check-in splitting two
    // at-cap gaps banks one whole extra horizon, so the worst forgone amount
    // equals the derived bound exactly — the domain reaches the region where
    // the cap does its work, rather than sampling short of it.
    expect(worstForegone).toBe(bound);
  });

  it('nothing is ever taken: rung and equipment are monotone over every prefix', () => {
    // The trajectory half, through the public API alone: every prefix of a
    // calendar is itself a run, and along the prefix chain the rung index
    // never falls, the equipment set never shrinks, and the accrued total
    // never falls — under both policies. This is what "no forced transition"
    // means with no failure state built yet, and it is the invariant stage 4
    // must keep when one exists.
    let chains = 0;
    let steps = 0;
    for (const lengthDays of LADDER_SWEEP.SEEDED_LENGTHS_DAYS) {
      for (const seed of LADDER_SWEEP.SEEDS.slice(0, LADDER_SWEEP.TRAJECTORY_SEEDS)) {
        const schedule = seededSchedule(seed, lengthDays);
        for (const policy of LADDER_POLICIES) {
          let previous = runLadder([], policy);
          for (let upTo = 1; upTo <= schedule.length; upTo += 1) {
            const run = runLadder(schedule.slice(0, upTo), policy);
            expect(ladderRungIndex(run.state.rung)).toBeGreaterThanOrEqual(
              ladderRungIndex(previous.state.rung),
            );
            const held = new Set(run.state.equipment);
            expect(previous.state.equipment.every((item) => held.has(item))).toBe(true);
            expect(run.accruedGymBucks).toBeGreaterThanOrEqual(previous.accruedGymBucks);
            previous = run;
            steps += 1;
          }
          chains += 1;
        }
      }
    }
    expect(chains).toBe(
      LADDER_SWEEP.SEEDED_LENGTHS_DAYS.length * LADDER_SWEEP.TRAJECTORY_SEEDS * LADDER_POLICIES.length,
    );
    expect(chains).toBe(8);
    // The chains are not empty: the step count is the sum of the four
    // calendars' attended slots, walked twice (once per policy).
    expect(steps).toBe(768);
  });
});
