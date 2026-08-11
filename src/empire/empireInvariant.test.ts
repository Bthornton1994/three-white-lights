/**
 * empireInvariant.test.ts — the second reading of "structurally unable",
 * measured on the gym the player has.
 *
 * ===========================================================================
 * What is asserted, and what shape the assertion has to have
 * ===========================================================================
 *
 * GDD §4.4: "structurally unable" has two readings and the rule means both. The
 * first is a type error and lives in `empireCore.ts`. The second is that the
 * output cannot MOVE with the purchase, and §4.4 records a builder whose check
 * for it was green while the claim was false — a legal input "moved 2362 of
 * 34338 purchase-day lists, produced zero violations, and left every aggregate
 * in the comparison identical".
 *
 * So every measurement below is on a LIST, element by element, and never on a
 * sum, a bound or a hash. Three lists, because they fail differently:
 *
 *   - the progression ledger — a Training IQ amount and a physio amount per
 *     calendar day, stamped on the wall clock;
 *   - the same two series taken APART, so a zero cannot be a zero about one of
 *     them while the other moves;
 *   - the ARRIVAL-DAY lists derived from each, because the ledger's own `day` is
 *     the composition loop's counter and therefore cannot move. That is stated
 *     in `arrivalDays`'s own docstring as a measured hole rather than left for a
 *     reader: `misaligned` is zero across this whole sweep, on the control as
 *     well as on the subject, so the day half of `compareLedgers` is an empty
 *     domain here. It is exercised by the unit tests on `compareLedgers` and by
 *     the arrival-day lists, which do move under the control.
 *
 * ===========================================================================
 * The subject is the gym, and that is the correction this file exists for
 * ===========================================================================
 *
 * The previous version of this file compared a ledger read off a SECOND gym
 * that was stepped with no accelerant ever. That comparison was `g(x)` against
 * `g(x)`: it returned zero for any implementation of every module in
 * `src/empire/`, and it stayed green with chain B reverted inside
 * `empireCore.ts`. Every run here is one gym — the gym the accelerant lands on
 * — and both progression readings come off it through the shipped accessors.
 *
 * ===========================================================================
 * Every zero has something beside it
 * ===========================================================================
 *
 *   - the POSITIVE control is the idle half of the same ledger. If a purchase
 *     did not move the Gym Bucks balance and the roster size, the sweep would be
 *     reporting a zero about an accelerant that was never applied. Pinned at 72
 *     of 72 lists moved, 2592 of 5232 elements.
 *   - the NEGATIVE control is the same grid at `funding: 'accelerated'` — the
 *     gym offered its accelerated book and its idle axis view where the
 *     wall-clock ones belong, which is the engine as it stood before the split.
 *     Pinned at 1572 of 5232 elements, and 32 of 128 physio arrival-day
 *     elements, every one of them EARLIER.
 *
 *     Why 128 here and 144 on the subject, since both grids run the same 72
 *     pairs: `compareDayLists` compares the MINIMUM of the two list lengths, and
 *     on the control 16 of the 72 pairs come out at different lengths — the
 *     `dayLengthDiffers: 16` pinned below — so 16 elements fall outside the
 *     comparison and 144 becomes 128. The subject's 16 is 0. Both numbers are
 *     pinned in the checks, and this sentence said "32 of 144" for a wave,
 *     which is the arithmetic of neither.
 *
 * ===========================================================================
 * The sweep's parameters are somewhere else on purpose
 * ===========================================================================
 *
 * `empireSweep.test.ts` holds every horizon, cadence, plan and social input, and
 * its own header says why it carries a test suffix. This file reads them and
 * pins what they produced.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { auditSource, formatFindings } from '../tuning/audit';
import {
  IDLE_ONLY_OUTPUTS,
  PROGRESSION_REACHING_OUTPUTS,
  PURCHASABLE_ACCELERANTS,
  WALL_CLOCK_FUNDED_OUTPUTS,
  asGymBucks,
  asReputation,
  asUnacceleratedSeconds,
  createEmpireClock,
  createEmpireState,
  createNpcLifter,
  type AppliedAccelerant,
  type EmpireState,
  type GymBucks,
  type NpcLifter,
  type UnacceleratedSeconds,
  type WallClockFundedOutput,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import {
  EMPIRE_DAY_SPENDING_ANCHORS,
  EMPIRE_FUNDINGS,
  EMPIRE_SPENDING_POLICIES,
  SHIPPED_DAY_SPENDING_ANCHOR,
  SHIPPED_FUNDING,
  SHIPPED_SPENDING_MOMENT,
  SHIPPED_SPENDING_POLICY,
  anchorConsumesDayOnlyOnPurchase,
  anchorHasOneTripPerDay,
  arrivalDays,
  axisSpendingOrder,
  bookSpendsAtMoment,
  booksSpentBy,
  booksUnspentToday,
  compareDayLists,
  compareLedgers,
  composeTrainingIqRate,
  createEmpireGym,
  empireRunFaults,
  grantSecondsAt,
  idleDayLedger,
  isDaySpendingMoment,
  maySpendOnRoster,
  outputSeries,
  progressionDayLedger,
  purchasesMade,
  rotatesAtMoment,
  runEmpire,
  savingForPhysio,
  spendingMoment,
  spendingMomentForBooks,
  spendsAtMoment,
  stepGym,
  type AccelerantPlan,
  type DayCheckInFacts,
  type EmpireDayEntry,
  type EmpireFunding,
  type EmpirePolicy,
  type EmpireRun,
  type EmpireSpendingPolicy,
} from './empireInvariant';
import {
  ACCELERATED_BOOK,
  EMPIRE_BOOKS,
  POOLED_WALL_CLOCK_BOOK,
  axisBook,
  expansionContext,
  expansionVerdict,
  startExpansion,
  type EmpireBook,
  type ExpansionAxis,
  type ExpansionBuild,
  type ExpansionContext,
} from './expansion';
import { EMPIRE_SWEEP, accelerantPlans, policyAt, socialInputs } from './empireSweep.test';
import { rosterTrainingIqPerDay } from './npc';
import { RECRUIT_BOOK } from './recruitment';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// The grid, materialised once per funding rule
// ---------------------------------------------------------------------------

const SOCIAL = socialInputs();
const PLANS = accelerantPlans();

interface SweepCell {
  readonly cadence: number;
  readonly days: number;
  /** Index 0 is the baseline, by `accelerantPlans`'s own order. */
  readonly runs: readonly EmpireRun[];
}

function gridAt(funding: EmpireFunding): readonly SweepCell[] {
  const cells: SweepCell[] = [];
  for (const days of EMPIRE_SWEEP.HORIZON_DAYS) {
    const policy = policyAt(EMPIRE_SWEEP.CHECK_INS_PER_DAY);
    cells.push({
      cadence: EMPIRE_SWEEP.CHECK_INS_PER_DAY,
      days,
      runs: PLANS.map((plan) => runEmpire(days, policy, plan, SOCIAL, funding)),
    });
  }
  for (const days of EMPIRE_SWEEP.DENSE_HORIZON_DAYS) {
    const policy = policyAt(EMPIRE_SWEEP.DENSE_CHECK_INS_PER_DAY);
    cells.push({
      cadence: EMPIRE_SWEEP.DENSE_CHECK_INS_PER_DAY,
      days,
      runs: PLANS.map((plan) => runEmpire(days, policy, plan, SOCIAL, funding)),
    });
  }
  return Object.freeze(cells);
}

/** The shipped engine. Every zero below is about this grid. */
const GRID = gridAt(SHIPPED_FUNDING);

/** The deliberately-wired variant. Every non-zero control is about this one. */
const CONTROL_GRID = gridAt('accelerated');

interface Pair {
  readonly baseline: EmpireRun;
  readonly candidate: EmpireRun;
}

/** Every (baseline, candidate) pair a grid compares. */
function pairs(grid: readonly SweepCell[]): readonly Pair[] {
  const out: Pair[] = [];
  for (const cell of grid) {
    const baseline = cell.runs[0];
    if (baseline === undefined) continue;
    for (const candidate of cell.runs) {
      if (candidate === baseline) continue;
      out.push({ baseline, candidate });
    }
  }
  return out;
}

const PAIRS = pairs(GRID);
const CONTROL_PAIRS = pairs(CONTROL_GRID);
const PROGRESSION_OUTPUTS = ['training-iq', 'physio-days-saved'] as const;

/** The element-wise totals over one grid's pairs, for one progression output. */
interface SeriesTotals {
  readonly lists: number;
  readonly elements: number;
  readonly moved: number;
  readonly movedLists: number;
  readonly dayElements: number;
  readonly dayMoved: number;
  readonly dayEarlier: number;
  readonly dayMovedLists: number;
  readonly dayLengthDiffers: number;
}

/**
 * The commissioned measurement, taken once and read by the subject and by the
 * control.
 *
 * `empireCore.ts`'s §6 and `expansion.ts`'s §2 both ask for the same thing in
 * the same words: for every purchasable accelerant, on every application
 * schedule, at every horizon, the list of readings BY WALL-CLOCK DAY, compared
 * element-wise, with a negative control beside it. This walks the pairs once and
 * both sides read the same walker, so the subject and its control cannot be
 * measuring differently-shaped things.
 */
function seriesTotals(source: readonly Pair[], output: (typeof PROGRESSION_OUTPUTS)[number]): SeriesTotals {
  let lists = 0;
  let elements = 0;
  let moved = 0;
  let movedLists = 0;
  let dayElements = 0;
  let dayMoved = 0;
  let dayEarlier = 0;
  let dayMovedLists = 0;
  let dayLengthDiffers = 0;
  for (const pair of source) {
    const baseline = outputSeries(progressionDayLedger(pair.baseline.ledger), output);
    const candidate = outputSeries(progressionDayLedger(pair.candidate.ledger), output);
    const byElement = compareLedgers(baseline, candidate);
    lists += 1;
    elements += byElement.compared;
    moved += byElement.moved;
    if (byElement.moved > 0) movedLists += 1;
    const byDay = compareDayLists(
      arrivalDays(baseline, output),
      arrivalDays(candidate, output),
    );
    dayElements += byDay.compared;
    dayMoved += byDay.moved;
    dayEarlier += byDay.earlier;
    if (byDay.moved > 0) dayMovedLists += 1;
    if (byDay.lengthDiffers) dayLengthDiffers += 1;
  }
  return {
    lists,
    elements,
    moved,
    movedLists,
    dayElements,
    dayMoved,
    dayEarlier,
    dayMovedLists,
    dayLengthDiffers,
  };
}

// ---------------------------------------------------------------------------
// The comparator itself
// ---------------------------------------------------------------------------

function entry(day: number, output: 'training-iq' | 'gym-bucks', amount: number): EmpireDayEntry {
  const at: UnacceleratedSeconds = asUnacceleratedSeconds(day * EMPIRE_TUNING.SECONDS_PER_DAY);
  return { day, at, output, amount };
}

describe('the comparator can report every kind of divergence there is', () => {
  it('reports zero on two identical lists, and says how many it looked at', () => {
    const list = [entry(0, 'training-iq', 1), entry(1, 'training-iq', 2)];
    const result = compareLedgers(list, [...list]);
    expect(result).toEqual({
      compared: 2,
      moved: 0,
      misaligned: 0,
      movedAmounts: 0,
      lengthDiffers: false,
    });
    // The empty case reports itself rather than passing as a zero.
    expect(compareLedgers([], []).compared).toBe(0);
  });

  it('reports an amount that moved while the day did not', () => {
    // Reddening edit: drop the `left.amount !== right.amount` arm.
    const result = compareLedgers(
      [entry(0, 'training-iq', 1), entry(1, 'training-iq', 2)],
      [entry(0, 'training-iq', 1), entry(1, 'training-iq', 3)],
    );
    expect(result.compared).toBe(2);
    expect(result.moved).toBe(1);
    expect(result.movedAmounts).toBe(1);
    expect(result.misaligned).toBe(0);
  });

  it('reports a DAY that moved while the amount did not', () => {
    // The arm the sweep cannot exercise, driven directly. This is chain B's own
    // shape: the amount a lifter eventually pays is unchanged and the day it
    // starts paying is not. Reddening edit: drop `left.day === right.day` and
    // `left.at === right.at` from `aligned`.
    const result = compareLedgers(
      [entry(3, 'training-iq', 1), entry(4, 'training-iq', 2)],
      [entry(2, 'training-iq', 1), entry(4, 'training-iq', 2)],
    );
    expect(result.compared).toBe(2);
    expect(result.moved).toBe(1);
    expect(result.misaligned).toBe(1);
    expect(result.movedAmounts).toBe(0);
  });

  it('reports an OUTPUT that moved, so two halves cannot be compared as one', () => {
    const result = compareLedgers(
      [entry(0, 'training-iq', 1)],
      [entry(0, 'gym-bucks', 1)],
    );
    expect(result.moved).toBe(1);
    expect(result.misaligned).toBe(1);
  });

  it('reports two lists of different lengths rather than comparing the overlap quietly', () => {
    const result = compareLedgers([entry(0, 'training-iq', 1)], []);
    expect(result.lengthDiffers).toBe(true);
    expect(result.compared).toBe(0);
    expect(compareLedgers([entry(0, 'training-iq', 1)], [entry(0, 'training-iq', 1)]).lengthDiffers).toBe(
      false,
    );
  });

  it('compares arrival-day lists element-wise and says which way they moved', () => {
    expect(compareDayLists([0, 4, 15], [0, 4, 15])).toEqual({
      compared: 3,
      moved: 0,
      earlier: 0,
      lengthDiffers: false,
    });
    const moved = compareDayLists([0, 4, 15], [0, 3, 15]);
    expect(moved.moved).toBe(1);
    expect(moved.earlier).toBe(1);
    const later = compareDayLists([0, 4, 15], [0, 5, 15]);
    expect(later.moved).toBe(1);
    expect(later.earlier).toBe(0);
    expect(compareDayLists([0], []).lengthDiffers).toBe(true);
  });

  it('derives an arrival-day list that changes when a series changes', () => {
    // Non-vacuity on `arrivalDays` itself: it must pick out the day each new
    // amount first appears, and must not report a day for a repeat.
    const series: EmpireDayEntry[] = [
      entry(0, 'training-iq', 1),
      entry(1, 'training-iq', 1),
      entry(2, 'training-iq', 2),
      entry(3, 'training-iq', 2),
      entry(4, 'training-iq', 3),
    ];
    expect(arrivalDays(series, 'training-iq')).toEqual([0, 2, 4]);
    // The output filter is live: a series of another output yields nothing.
    expect(arrivalDays(series, 'physio-days-saved')).toEqual([]);
    expect(arrivalDays([...series, entry(5, 'gym-bucks', 9)], 'gym-bucks')).toEqual([5]);
    // And `outputSeries` splits one ledger into the two the sweep compares
    // apart, keeping day order.
    expect(outputSeries([...series, entry(5, 'gym-bucks', 9)], 'gym-bucks').length).toBe(1);
    expect(outputSeries(series, 'training-iq').map((one) => one.day)).toEqual([0, 1, 2, 3, 4]);
  });
});

// ---------------------------------------------------------------------------
// The Training IQ ceiling, applied at the composition point
// ---------------------------------------------------------------------------

function legendaryRoster(size: number, settledAt: number): readonly NpcLifter[] {
  const lifters: NpcLifter[] = [];
  for (let at = 0; at < size; at += 1) {
    lifters.push(createNpcLifter(`lifter-${at}`, 'legendary', 'Placeholder', settledAt, settledAt));
  }
  return lifters;
}

function gymWith(roster: readonly NpcLifter[], elapsedSeconds: number): EmpireState {
  const base = createEmpireState();
  return Object.freeze({
    ...base,
    clock: createEmpireClock(elapsedSeconds, 0),
    roster,
    reputation: asReputation(EMPIRE_TUNING.REPUTATION_MAX),
    gymBucks: asGymBucks(0),
  });
}

describe('the Training IQ daily budget is applied where the two terms are added', () => {
  it('caps a full legendary roster, and the uncapped subtotal really is above the cap', () => {
    // E2 handed this seam forward: `rosterTrainingIqPerDay` is uncapped and
    // `npc.ts` names the cap as an obligation on whoever adds the base trickle
    // to it. This is that addition, so this is where the cap goes.
    //
    // Reddening edit: drop the `Math.min` from `composeTrainingIqRate`. The
    // second and third lines below both move.
    const tenured = EMPIRE_TUNING.NPC_TENURE_DAYS_TO_FULL_LOYALTY * EMPIRE_TUNING.SECONDS_PER_DAY;
    const state = gymWith(legendaryRoster(EMPIRE_TUNING.ROSTER_SLOTS_MAX, 0), tenured * 2);
    const composed = composeTrainingIqRate(state, state.clock);

    // The seam is live rather than theoretical: the subtotal alone is above the
    // budget, so a composition that forgot the cap would ship a number above it.
    const subtotal = rosterTrainingIqPerDay(state.roster, state.clock);
    expect(subtotal).toBeGreaterThan(EMPIRE_TUNING.TRAINING_IQ_DAILY_CEILING);
    expect(subtotal).toBe(39);
    expect(composed.uncappedPerDay).toBe(40);
    expect(composed.perDay).toBe(EMPIRE_TUNING.TRAINING_IQ_DAILY_CEILING);
    expect(composed.ceilingBound).toBe(true);
    expect(composed.contributingLifters).toBe(EMPIRE_TUNING.ROSTER_SLOTS_MAX);
  });

  it('does not cap a gym under the budget, so the cap is a cap and not a floor', () => {
    // The other side of the same line: an assertion that only ever saw the
    // capped case could not tell a cap from a constant.
    const state = gymWith(legendaryRoster(1, 0), EMPIRE_TUNING.SECONDS_PER_DAY);
    const composed = composeTrainingIqRate(state, state.clock);
    expect(composed.perDay).toBe(composed.uncappedPerDay);
    expect(composed.perDay).toBeLessThan(EMPIRE_TUNING.TRAINING_IQ_DAILY_CEILING);
    expect(composed.ceilingBound).toBe(false);
    // And the empty gym is the base trickle alone.
    const empty = createEmpireState();
    expect(composeTrainingIqRate(empty, empty.clock).perDay).toBe(
      EMPIRE_TUNING.TRAINING_IQ_BASE_PER_DAY,
    );
    expect(composeTrainingIqRate(empty, empty.clock).contributingLifters).toBe(0);
  });

  it('counts a lifter only once their recruitment has settled on the wall clock', () => {
    // `settledTenureDays` floors at zero rather than reporting absence, so an
    // unfiltered composition would pay for a lifter a purchase put on the
    // roster early. Reddening edit: drop the `settledAt <= now` filter.
    const day = EMPIRE_TUNING.SECONDS_PER_DAY;
    const state = gymWith(legendaryRoster(2, day * 3), day);
    const composed = composeTrainingIqRate(state, state.clock);
    expect(composed.contributingLifters).toBe(0);
    expect(composed.perDay).toBe(EMPIRE_TUNING.TRAINING_IQ_BASE_PER_DAY);
    // And once they have settled, they count — or the zero above is a zero
    // about a roster that pays nothing at any time.
    const later = gymWith(legendaryRoster(2, day * 3), day * 4);
    expect(composeTrainingIqRate(later, later.clock).contributingLifters).toBe(2);
    expect(composeTrainingIqRate(later, later.clock).perDay).toBeGreaterThan(
      EMPIRE_TUNING.TRAINING_IQ_BASE_PER_DAY,
    );
  });

  it('agrees with production.ts on every day of every run in the sweep', () => {
    // The two ceilings are reached by different callers and each one is a
    // `Math.min` somebody could delete. `EmpireRunCensus` counts the comparison
    // on every day of every run; this is the pin on the counter.
    let comparisons = 0;
    let disagreements = 0;
    for (const cell of GRID) {
      for (const run of cell.runs) {
        comparisons += run.census.rateComparisons;
        disagreements += run.census.rateDisagreements;
      }
    }
    expect(comparisons).toBe(2834);
    expect(disagreements).toBe(0);
  });

  it('reaches the budget inside the sweep, so the agreement above is not about a slack cap', () => {
    let boundDays = 0;
    let runsThatBound = 0;
    for (const cell of GRID) {
      for (const run of cell.runs) {
        boundDays += run.census.ceilingBoundDays;
        if (run.census.ceilingBoundDays > 0) runsThatBound += 1;
      }
    }
    // 468 / 13 -> 1573 / 39 when §5.3's promotion path landed. A gym that can
    // move a filled slot up reaches a bigger roster subtotal sooner, so the
    // budget bites on more days — which is what this check wants (the cap is
    // REACHED) and is also a balance consequence nobody has played. It is
    // written down in `empireInvariant.ts` §4b as a tuning question rather
    // than left as a number that moved.
    expect({ boundDays, runsThatBound }).toEqual({ boundDays: 1573, runsThatBound: 39 });
  });
});

// ---------------------------------------------------------------------------
// The invariant
// ---------------------------------------------------------------------------

describe('the composed run is a run at all', () => {
  it("spends every wall-clock purse that has a spender, and never the one that has none", () => {
    // THE CHECK `empireCore.ts`'s WallClockBooks header names. It used to name a
    // pin that was not in this file — the claim was true and the evidence was a
    // sentence, which is the defect class CLAUDE.md opens with.
    //
    // `'reputation'` is on WALL_CLOCK_FUNDED_OUTPUTS because it is a GATING
    // output, so it gets a purse by derivation. Nothing prices anything in it:
    // reputation is earned per check-in, not bought. That is the thing measured
    // here rather than described.
    let reputationTaken = 0;
    const spentAtLeastOnce = new Set<string>();
    let runs = 0;
    for (const cell of GRID) {
      for (const run of cell.runs) {
        runs += 1;
        for (const book of WALL_CLOCK_FUNDED_OUTPUTS) {
          const taken = run.census.bookDebits[book];
          expect(taken, `${book} went negative`).toBeGreaterThanOrEqual(0);
          if (taken > 0) spentAtLeastOnce.add(book);
        }
        reputationTaken += run.census.bookDebits.reputation;
      }
    }

    // The subject: the fund with no spender is never touched.
    expect(reputationTaken).toBe(0);

    // NON-VACUITY, and it is the half that matters. A counter that never
    // incremented would report zero for every purse, so the zero above would be
    // a zero about a broken instrument. Counts, not bounds: the three purses
    // that DO have spenders — §5.4's roster-slot ladders, §5.4's physio ladder
    // and §5.3's recruits, priced in RECRUIT_BOOK — must each show a debit.
    expect(runs).toBe(GRID.length * PLANS.length);
    expect([...spentAtLeastOnce].sort()).toEqual(
      WALL_CLOCK_FUNDED_OUTPUTS.filter((book) => book !== 'reputation')
        .slice()
        .sort(),
    );
    expect(spentAtLeastOnce.size).toBe(WALL_CLOCK_FUNDED_OUTPUTS.length - 1);
    expect(spentAtLeastOnce.size).toBe(3);
  });

  it('drove the grid it says it drove, and every run is fault-free', () => {
    // Counts before verdicts. A grid that had gone empty, or runs that produced
    // no ledger, would make every zero below a zero about nothing.
    expect(GRID.length).toBe(EMPIRE_SWEEP.HORIZON_DAYS.length + EMPIRE_SWEEP.DENSE_HORIZON_DAYS.length);
    expect(GRID.length).toBe(6);
    let runs = 0;
    let ledgerEntries = 0;
    let faults = 0;
    for (const cell of GRID) {
      expect(cell.runs.length).toBe(PLANS.length);
      for (const run of cell.runs) {
        runs += 1;
        expect(run.funding).toBe(SHIPPED_FUNDING);
        ledgerEntries += run.ledger.length;
        faults += empireRunFaults(run).length;
      }
    }
    expect(runs).toBe(78);
    expect(PAIRS.length).toBe(72);
    expect(ledgerEntries).toBe(11336);
    expect(faults).toBe(0);
    // The control grid is the same shape, so the non-zeros below are taken over
    // the same number of comparisons as the zeros.
    expect(CONTROL_PAIRS.length).toBe(PAIRS.length);
  });

  it('really recruits, expands, pays a physio and closes a rival period', () => {
    // The simulation is doing GDD §5's work rather than idling. Without this
    // the invariant could be a zero over a gym that never bought anything.
    const longest = GRID[EMPIRE_SWEEP.HORIZON_DAYS.length - 1];
    expect(longest?.days).toBe(100);
    const baseline = longest?.runs[0] as EmpireRun;
    expect({
      recruits: baseline.census.recruits,
      expansions: baseline.census.expansions,
      settledPhysioLevel: baseline.census.settledPhysioLevel,
      socialRewardDays: baseline.census.socialRewardDays,
    }).toEqual({ recruits: 11, expansions: 13, settledPhysioLevel: 1, socialRewardDays: 14 });
    expect(baseline.gym.state.roster.length).toBeGreaterThan(0);
    // The physio rung is reached inside the sweep, and the series it produces
    // has a STEP in it rather than being constant — which is what makes an
    // element-wise comparison of it worth taking. Counted per run rather than
    // per horizon: under GDD §5.4's third-book ruling the physio purse fills at
    // the baseline line with nothing else drawing on it, so the rung is reached
    // at every horizon here including the shortest, and the sentence that used
    // to say the shortest horizon never reached it is deleted rather than
    // softened. What matters is the step, so the step is what is counted.
    let runsWithPhysio = 0;
    let runsWithoutPhysio = 0;
    let steppedSeries = 0;
    let constantSeries = 0;
    for (const cell of GRID) {
      for (const run of cell.runs) {
        if (run.census.settledPhysioLevel > 0) runsWithPhysio += 1;
        else runsWithoutPhysio += 1;
        const series = outputSeries(run.ledger, 'physio-days-saved').map((entry) => entry.amount);
        if (new Set(series).size > 1) steppedSeries += 1;
        else constantSeries += 1;
      }
    }
    expect({ runsWithPhysio, runsWithoutPhysio, steppedSeries, constantSeries }).toEqual({
      runsWithPhysio: 78,
      runsWithoutPhysio: 0,
      steppedSeries: 78,
      constantSeries: 0,
    });
  });

  it('spends every grant on exactly one of the two §8.3B mechanisms', () => {
    // The claim §6 of the module header makes about the two mechanisms, pinned
    // rather than described: a grant advances the idle clock or shortens a
    // running build, never both and never neither. Reddening edit: drop the
    // `else` in `stepGym`'s grant arm so a build skip also banks the seconds.
    let granted = 0;
    let buildSkips = 0;
    let clockSkips = 0;
    let grantedSeconds = 0;
    for (const cell of GRID) {
      for (const run of cell.runs) {
        granted += run.census.grantedCheckIns;
        buildSkips += run.census.buildSkips;
        clockSkips += run.census.clockSkips;
        grantedSeconds += run.census.grantedSeconds;
      }
    }
    expect(buildSkips + clockSkips).toBe(granted);
    // Counts, not bounds, and both mechanisms fire. `skipExpansion` is only
    // reachable at the dense cadence, which is why that row exists in the sweep.
    expect(granted).toBe(22998);
    expect(buildSkips).toBe(6);
    expect(clockSkips).toBe(22992);
    expect(grantedSeconds).toBe(193183200);
  });

  it('holds both halves of the ledger, partitioned by empireCore.ts own predicates', () => {
    // Which outputs land in which half is `SINK_REACH` and `OUTPUT_SINK`'s
    // answer, not this file's. Reddening edit: re-tag `'training-pace'` as
    // `'idle-only'` in `SINK_REACH` — the progression half empties, both counts
    // below move, and `empireRunFaults` reports it too.
    const run = GRID[0]?.runs[0] as EmpireRun;
    const progression = progressionDayLedger(run.ledger);
    const idle = idleDayLedger(run.ledger);
    expect(progression.length + idle.length).toBe(run.ledger.length);
    expect(progression.length).toBe(run.days * PROGRESSION_REACHING_OUTPUTS.length);
    expect(progression.length).toBe(14);
    expect(idle.length).toBe(14);
    for (const output of PROGRESSION_REACHING_OUTPUTS) {
      expect(outputSeries(progression, output).length).toBe(run.days);
    }
    for (const output of idle) {
      expect(IDLE_ONLY_OUTPUTS as readonly string[]).toContain(output.output);
    }
    expect(new Set(idle.map((one) => one.output)).size).toBe(2);
  });
});

describe('no purchasable accelerant moves the progression ledger, element by element', () => {
  it('compares the progression ledger position by position and finds nothing moved', () => {
    // THE INVARIANT. Not a sum, not a bound: day, output and amount, at every
    // position of every list, for every purchasable accelerant, on every
    // schedule, at every horizon, at both cadences — on the gym the accelerant
    // landed on.
    let comparisons = 0;
    let elements = 0;
    let moved = 0;
    let misaligned = 0;
    let movedAmounts = 0;
    let lengthDiffers = 0;
    for (const pair of PAIRS) {
      const result = compareLedgers(
        progressionDayLedger(pair.baseline.ledger),
        progressionDayLedger(pair.candidate.ledger),
      );
      comparisons += 1;
      elements += result.compared;
      moved += result.moved;
      misaligned += result.misaligned;
      movedAmounts += result.movedAmounts;
      if (result.lengthDiffers) lengthDiffers += 1;
    }
    expect(comparisons).toBe(72);
    expect(elements).toBe(5232);
    expect(moved).toBe(0);
    expect(misaligned).toBe(0);
    expect(movedAmounts).toBe(0);
    expect(lengthDiffers).toBe(0);
  });

  it('drove every purchasable accelerant, so the zeros are not about one of them', () => {
    const driven = new Set<string>();
    for (const plan of PLANS) {
      if (plan.accelerant !== null) driven.add(plan.accelerant);
    }
    expect([...driven].sort()).toEqual([...PURCHASABLE_ACCELERANTS].sort());
    expect(driven.size).toBe(2);
    // And each one is driven on the same number of pairs, so a zero cannot be
    // an average over one accelerant that was swept and one that was not.
    for (const accelerant of PURCHASABLE_ACCELERANTS) {
      expect(PAIRS.filter((pair) => pair.candidate.plan.accelerant === accelerant).length).toBe(36);
    }
  });

  it('compares the PHYSIO series by wall-clock day, and finds nothing moved', () => {
    // The measurement `expansion.ts`'s §2 and `empireCore.ts`'s §6 both
    // commissioned, in the words they commissioned it in: the list of
    // `physioDaysSavedAt` readings by wall-clock day, byte-identical to the
    // list with no accelerant applied, element-wise.
    //
    // Reddening edits, each measured: `skipExpansion` moving
    // `settledCompletion`; `expansionVerdict` reading `context.gymBucks` for a
    // wall-clock-funded axis; `settledAxisLevel` reading `idleCompletion`.
    const totals = seriesTotals(PAIRS, 'physio-days-saved');
    expect(totals.lists).toBe(72);
    expect(totals.elements).toBe(2616);
    expect(totals.moved).toBe(0);
    expect(totals.movedLists).toBe(0);
    // The day-valued half, which is where chain C shows up at all.
    expect(totals.dayElements).toBe(144);
    expect(totals.dayMoved).toBe(0);
    expect(totals.dayLengthDiffers).toBe(0);
  });

  it('compares the TRAINING IQ series by wall-clock day, and finds nothing moved', () => {
    // The sibling of the check above, on §5.2's trickle. Written as its own
    // measurement rather than folded into the ledger comparison, because a zero
    // over both series together can hide one series moving while the other
    // does not exist.
    //
    // Reddening edits, each measured: `recruitmentSchedule` stamping
    // `settlesAt` from `clock.accelerated`; `recruitmentRefusals` reading
    // `state.gymBucks` or `state.axes`; `reputationRates` reading
    // `elapsedFor(at, 'reputation')` — which is chain B, one module over.
    const totals = seriesTotals(PAIRS, 'training-iq');
    expect(totals.lists).toBe(72);
    expect(totals.elements).toBe(2616);
    expect(totals.moved).toBe(0);
    expect(totals.movedLists).toBe(0);
    // 1884 -> 1200 for the same reason the budget bites more often: a series
    // that sits at its cap changes on fewer days, so the DAY-list comparison
    // has fewer elements. The element-wise reading beside it is untouched at
    // 2616 and still zero, which is the reading the invariant is stated on.
    expect(totals.dayElements).toBe(1200);
    expect(totals.dayMoved).toBe(0);
    expect(totals.dayLengthDiffers).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The controls
// ---------------------------------------------------------------------------

describe('the zeros are zeros against measured numbers', () => {
  it('POSITIVE control: the purchase does move the idle half of the same ledger', () => {
    // If this were zero the accelerant was never applied and the invariant above
    // would be an empty domain reporting a pass.
    let comparisons = 0;
    let elements = 0;
    let moved = 0;
    let movedLists = 0;
    for (const pair of PAIRS) {
      const result = compareLedgers(
        idleDayLedger(pair.baseline.ledger),
        idleDayLedger(pair.candidate.ledger),
      );
      comparisons += 1;
      elements += result.compared;
      moved += result.moved;
      if (result.moved > 0) movedLists += 1;
    }
    expect(comparisons).toBe(72);
    expect(elements).toBe(5232);
    expect(moved).toBe(2592);
    // Every single comparison moved, not merely the aggregate.
    expect(movedLists).toBe(72);
  });

  it('the purchase moves the ledger the player reads and no census COUNT, both pinned', () => {
    // The other half of the sale, on the census rather than on the ledger.
    //
    // WHAT MOVED HERE AND WHAT STOPPED MOVING, because one of these counts went
    // to zero under GDD §5.4's third-book ruling and a positive control that
    // has gone quiet is worth naming rather than re-pinning. Before the ruling
    // a skip changed the NUMBER of rungs a horizon finished in 12 of 72 pairs,
    // because the accelerated book was the only purse with any slack in it.
    // With a purse per funded output each ladder is bought as soon as its own
    // fund can afford the next rung, and at every horizon here both runs finish
    // the same rungs — so the skip moves WHEN, not HOW MANY, and the counter
    // that reads a count reads zero.
    //
    // `idlePhysioLevel` is the census reading that still moves, and it is the
    // one the field's own docstring nominates: a skip that advances the idle
    // clock lands a finished physio build on the player's gym sooner. The idle
    // LEDGER control above is the primary one — 2592 elements on 72 of 72
    // comparisons — and this is its census twin.
    let movedExpansions = 0;
    let movedRecruits = 0;
    let movedIdlePhysio = 0;
    let movedSettledPhysio = 0;
    let compared = 0;
    for (const pair of PAIRS) {
      compared += 1;
      if (pair.candidate.census.expansions !== pair.baseline.census.expansions) movedExpansions += 1;
      if (pair.candidate.census.recruits !== pair.baseline.census.recruits) movedRecruits += 1;
      if (pair.candidate.census.idlePhysioLevel !== pair.baseline.census.idlePhysioLevel) {
        movedIdlePhysio += 1;
      }
      if (pair.candidate.census.settledPhysioLevel !== pair.baseline.census.settledPhysioLevel) {
        movedSettledPhysio += 1;
      }
    }
    expect(compared).toBe(72);
    expect([movedExpansions, movedRecruits, movedIdlePhysio, movedSettledPhysio]).toEqual([
      0, 0, 0, 0,
    ]);
    // Zeros need the accelerant to have been applied, or they are zeros about a
    // plan that granted nothing. These two say it was, off the same census.
    let grantedRuns = 0;
    let spentGrants = 0;
    for (const pair of PAIRS) {
      if (pair.candidate.census.grantedCheckIns > 0) grantedRuns += 1;
      spentGrants += pair.candidate.census.buildSkips + pair.candidate.census.clockSkips;
    }
    expect(grantedRuns).toBe(72);
    expect(spentGrants).toBe(22998);
  });

  it('NEGATIVE control: the same engine funded from the accelerated book DOES move', () => {
    // `EmpireFunding` is the deliberately-wired variant GDD §4.4 asks for: the
    // gym offered its accelerated book and its idle axis view where the
    // wall-clock ones belong. It is chain C — a skip pays Gym Bucks sooner, so
    // the gym affords a physio level and a recruit on an earlier wall-clock day
    // — and it is the number the zero above is a zero against.
    let comparisons = 0;
    let elements = 0;
    let moved = 0;
    let movedLists = 0;
    for (const pair of CONTROL_PAIRS) {
      const result = compareLedgers(
        progressionDayLedger(pair.baseline.ledger),
        progressionDayLedger(pair.candidate.ledger),
      );
      comparisons += 1;
      elements += result.compared;
      moved += result.moved;
      if (result.moved > 0) movedLists += 1;
    }
    expect(comparisons).toBe(72);
    expect(elements).toBe(5232);
    expect(moved).toBe(926);
    expect(movedLists).toBe(72);
  });

  it('NEGATIVE control: both series move, and the physio days arrive EARLIER', () => {
    // Per series, so the control is a control for both of the subject's two
    // zeros rather than for their sum. The physio half is the one that moves a
    // DAY: every moved element arrives earlier, which is the direction a
    // purchase pushes and is what says this is the hazard rather than noise.
    const physio = seriesTotals(CONTROL_PAIRS, 'physio-days-saved');
    expect(physio.elements).toBe(2616);
    expect(physio.moved).toBe(104);
    expect(physio.movedLists).toBe(48);
    expect(physio.dayElements).toBe(132);
    expect(physio.dayMoved).toBe(36);
    expect(physio.dayEarlier).toBe(36);
    expect(physio.dayMovedLists).toBe(36);
    // The lists are not even the same length on 12 of them, which is the same
    // hazard reported by a different fact.
    expect(physio.dayLengthDiffers).toBe(12);

    const trainingIq = seriesTotals(CONTROL_PAIRS, 'training-iq');
    expect(trainingIq.elements).toBe(2616);
    expect(trainingIq.moved).toBe(822);
    expect(trainingIq.movedLists).toBe(72);
    // The trickle's arrival-day list does not move under the control; it gets
    // LONGER, because the accelerated gym reaches steps the wall clock has not.
    // Recorded as measured rather than assumed: the day-valued subject is the
    // physio one, and this is the fact that says so.
    expect(trainingIq.dayMoved).toBe(0);
    expect(trainingIq.dayLengthDiffers).toBe(30);
  });

  it('the control differs from the subject only in the funding rule', () => {
    // What makes the two grids comparable, and what makes the control a control
    // rather than a second simulation: same plans, same horizons, same social
    // inputs, one parameter apart. Reddening edit: make `offeredTo` return its
    // argument unconditionally — the control stops differing from the subject
    // and `censusesThatDiffer` goes to zero.
    let censusesThatDiffer = 0;
    let plansCompared = 0;
    for (let cell = 0; cell < GRID.length; cell += 1) {
      const subject = GRID[cell] as SweepCell;
      const control = CONTROL_GRID[cell] as SweepCell;
      expect(control.days).toBe(subject.days);
      expect(control.cadence).toBe(subject.cadence);
      for (let at = 0; at < subject.runs.length; at += 1) {
        const left = subject.runs[at] as EmpireRun;
        const right = control.runs[at] as EmpireRun;
        expect(right.plan).toBe(left.plan);
        expect(left.funding).toBe(SHIPPED_FUNDING);
        expect(right.funding).toBe('accelerated');
        plansCompared += 1;
        if (
          right.census.recruits !== left.census.recruits ||
          right.census.expansions !== left.census.expansions ||
          right.census.settledPhysioLevel !== left.census.settledPhysioLevel
        ) {
          censusesThatDiffer += 1;
        }
      }
    }
    expect(plansCompared).toBe(78);
    // Counts, not bounds: the funding rule really changes what the gym bought,
    // on most runs and not on all of them.
    expect(censusesThatDiffer).toBe(26);
    expect(EMPIRE_FUNDINGS.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// The run's own invariants
// ---------------------------------------------------------------------------

describe('a run refuses what it should refuse', () => {
  it('reports a grant that was spent twice or spent nowhere', () => {
    // `empireRunFaults` is the runtime shadow of §6 of the module header, and a
    // fault list that found nothing and one that looked at nothing read the
    // same. This drives the fault it exists for.
    const run = GRID[0]?.runs[1] as EmpireRun;
    expect(empireRunFaults(run)).toEqual([]);
    const doubleSpent: EmpireRun = {
      ...run,
      census: { ...run.census, buildSkips: run.census.buildSkips + 1 },
    };
    const faults = empireRunFaults(doubleSpent);
    // TWO faults, not one, and the second is the point of the change that made
    // it two: `EmpireState.accelerants` now holds one entry per build skip, so
    // a census that claims a skip the gym did not record is caught from both
    // sides. Pinned as an exact list rather than a length, so a third fault
    // arriving is red rather than absorbed.
    expect(faults.length).toBe(2);
    expect(faults[0]).toContain('grants were spent');
    expect(faults[1]).toContain('applied accelerants');
  });

  it('re-asks the licence about accelerants the gym actually recorded', () => {
    // The domain, first. `EmpireState.accelerants` was seeded empty by
    // `createEmpireState` and written by nothing, so the `mayAccelerate` walk
    // at the foot of `empireRunFaults` ran over zero elements on all 78 shipped
    // and all 78 control runs — a loop that reads as GDD §8.1's refusal
    // condition checked on the composed gym and was decoration. `stepGym` now
    // keeps the grant it already constructed.
    let recorded = 0;
    let buildSkips = 0;
    let runsWithAnAccelerant = 0;
    for (const cell of GRID) {
      for (const run of cell.runs) {
        recorded += run.gym.state.accelerants.length;
        buildSkips += run.census.buildSkips;
        if (run.gym.state.accelerants.length > 0) runsWithAnAccelerant += 1;
      }
    }
    // Counts, not bounds. The domain is small and that is the point of writing
    // it down: a grant lands on a still-running build 6 times across the whole
    // grid, on 6 of the 78 runs — one apiece — and every one is a legal pairing.
    expect(recorded).toBe(6);
    expect(recorded).toBe(buildSkips);
    expect(runsWithAnAccelerant).toBe(6);
    expect(recorded).toBeGreaterThan(0);
    // And the check bites on the thing it is about. The carrier is FOUND
    // rather than indexed: a run picked by position might have no build skip in
    // it, and then the count half below would be asserting about an empty list
    // by accident. The illegal pairing is built by a cast, because that is the
    // only way one exists — `applyAccelerant` refuses it at compile time and
    // throws at run time, which is `empireCore.ts`'s first reading. This is the
    // payload that gets past both.
    const carrier = GRID.flatMap((cell) => cell.runs).find(
      (run) => run.census.buildSkips > 0,
    ) as EmpireRun;
    expect(carrier).toBeDefined();
    expect(carrier.census.buildSkips).toBeGreaterThan(0);
    expect(empireRunFaults(carrier)).toEqual([]);
    const illegal = {
      accelerant: 'gym-empire-timer-skip',
      output: 'training-iq',
      at: asUnacceleratedSeconds(0),
      seconds: EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
    } as unknown as AppliedAccelerant;
    const smuggled: EmpireRun = {
      ...carrier,
      gym: {
        ...carrier.gym,
        state: {
          ...carrier.gym.state,
          accelerants: [...carrier.gym.state.accelerants, illegal],
        },
      },
    };
    const faults = empireRunFaults(smuggled);
    expect(faults.some((fault) => fault.includes('was applied to training-iq'))).toBe(true);
    // The non-vacuity counter is the other half, and it is what makes the loop
    // above unable to go quiet by emptying: drop the recording from `stepGym`
    // and the count stops matching `buildSkips`. Driven from both directions.
    expect(faults.some((fault) => fault.includes('applied accelerants'))).toBe(true);
    const unrecorded: EmpireRun = {
      ...carrier,
      gym: { ...carrier.gym, state: { ...carrier.gym.state, accelerants: [] } },
    };
    expect(
      empireRunFaults(unrecorded).some((fault) =>
        fault.includes('recorded 0 applied accelerants'),
      ),
    ).toBe(true);
  });

  it('reports a wall-clock ladder that has run ahead of the player own gym', () => {
    const run = GRID[EMPIRE_SWEEP.HORIZON_DAYS.length - 1]?.runs[0] as EmpireRun;
    expect(run.census.settledPhysioLevel).toBe(run.census.idlePhysioLevel);
    const ahead: EmpireRun = {
      ...run,
      census: { ...run.census, idlePhysioLevel: run.census.settledPhysioLevel - 1 },
    };
    expect(empireRunFaults(ahead).some((fault) => fault.includes('the wall clock has reached'))).toBe(
      true,
    );
  });

  it('reports a disagreement with production.ts and an empty comparison', () => {
    const run = GRID[0]?.runs[0] as EmpireRun;
    expect(empireRunFaults({ ...run, census: { ...run.census, rateDisagreements: 3 } })).toEqual([
      'the composed trickle and production.ts disagreed on 3 of 7 days',
    ]);
    expect(
      empireRunFaults({ ...run, census: { ...run.census, rateComparisons: 0 } }).some((fault) =>
        fault.includes('never compared'),
      ),
    ).toBe(true);
  });

  it('reports a Training IQ day above the budget and a physio day above its own', () => {
    const run = GRID[0]?.runs[0] as EmpireRun;
    const overIq: EmpireRun = {
      ...run,
      ledger: [
        ...run.ledger,
        entry(0, 'training-iq', EMPIRE_TUNING.TRAINING_IQ_DAILY_CEILING + 1),
      ],
    };
    expect(empireRunFaults(overIq).some((fault) => fault.includes('above the daily budget'))).toBe(
      true,
    );
  });

  it('reports a ledger with no progression half and one with no idle half', () => {
    const run = GRID[0]?.runs[0] as EmpireRun;
    const idleOnly: EmpireRun = { ...run, ledger: idleDayLedger(run.ledger) };
    expect(
      empireRunFaults(idleOnly).some((fault) => fault.includes('no entry reaches progression')),
    ).toBe(true);
    const progressionOnly: EmpireRun = { ...run, ledger: progressionDayLedger(run.ledger) };
    expect(
      empireRunFaults(progressionOnly).some((fault) => fault.includes('no entry is idle-only')),
    ).toBe(true);
    expect(empireRunFaults({ ...run, ledger: [] }).some((fault) => fault.includes('no ledger at all'))).toBe(
      true,
    );
  });

  it('refuses a horizon or a cadence that is not a whole number at or above one', () => {
    const policy = policyAt(EMPIRE_SWEEP.CHECK_INS_PER_DAY);
    const plan = PLANS[0] as AccelerantPlan;
    expect(() => runEmpire(0, policy, plan, SOCIAL)).toThrow(RangeError);
    expect(() => runEmpire(1.5, policy, plan, SOCIAL)).toThrow(RangeError);
    expect(() => runEmpire(1, policyAt(0), plan, SOCIAL)).toThrow(RangeError);
  });

  it('grants on the schedule it was given and nowhere else', () => {
    const plan: AccelerantPlan = {
      accelerant: 'gym-empire-timer-skip',
      grantsPerCheckIn: 2,
      firstCheckIn: 3,
      everyNthCheckIn: 4,
    };
    const granted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((checkIn) =>
      grantSecondsAt(plan, checkIn),
    );
    const unit = EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT * 2;
    expect(granted).toEqual([0, 0, unit, 0, 0, 0, unit, 0, 0, 0, unit]);
    // The baseline grants nothing at any check-in, which is what makes it a
    // baseline rather than a plan with a small grant.
    expect([1, 2, 3, 50].map((checkIn) => grantSecondsAt(PLANS[0] as AccelerantPlan, checkIn))).toEqual([
      0, 0, 0, 0,
    ]);
    expect(() => grantSecondsAt(plan, 0)).toThrow(RangeError);
    expect(() => grantSecondsAt({ ...plan, everyNthCheckIn: 0 }, 1)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// The simulated player's spending policy
// ---------------------------------------------------------------------------

/**
 * The parameters of the spending-policy unit tests, written down for the reason
 * `empireSweep.test.ts`'s header gives.
 *
 * `PURSE` is far above every level-1 rung so an ordering test is about ORDER and
 * not about affordability; `THIN_PURSE` sits above the cheapest wall-clock rung
 * and below the physio one, which is the exact state
 * `'save-for-physio-first'` is defined by.
 */
const POLICY_FIXTURE = Object.freeze({
  PURSE: 1_000_000,
  THIN_PURSE: 900,
  ORDER: EMPIRE_SWEEP.AXIS_ORDER,
  /**
   * The slice of `ORDER` bought out of each purse, in `ORDER`'s own order.
   *
   * Three slices rather than two families, which is GDD §5.4's third-book
   * ruling reaching the offer: the roster-slot ladders and the physio ladder
   * were one family and are now two purses, and nothing offered out of one is
   * offered out of the other.
   */
  ROSTER_SLICE: Object.freeze(['space', 'spotter'] as const),
  PHYSIO_SLICE: Object.freeze(['physio'] as const),
  IDLE_SLICE: Object.freeze(['coach', 'equipment'] as const),
  /** Level-1 prices, from `EMPIRE_TUNING`, as the ordering arms sort on. */
  LEVEL_ONE_COSTS: Object.freeze({
    space: 800,
    spotter: 1000,
    physio: 6000,
    coach: 1200,
    equipment: 1500,
  } as const),
} as const);

/** The purse each of the three slices is bought out of, read from `axisBook`. */
const ROSTER_BOOK: EmpireBook = axisBook('space');
const PHYSIO_BOOK: EmpireBook = axisBook('physio');

function contextWith(purse: number, builds: readonly ExpansionBuild[] = []): ExpansionContext {
  const base = createEmpireState();
  const books: Partial<Record<WallClockFundedOutput, GymBucks>> = {};
  for (const book of WALL_CLOCK_FUNDED_OUTPUTS) books[book] = asGymBucks(purse);
  return expansionContext(
    Object.freeze({
      ...base,
      clock: createEmpireClock(0, 0),
      gymBucks: asGymBucks(purse),
      settledBooks: Object.freeze({ ...base.settledBooks, ...books }),
      reputation: asReputation(0),
    }),
    builds,
  );
}

function orderUnderContext(
  policy: EmpireSpendingPolicy,
  book: EmpireBook,
  context: ExpansionContext,
  nextAxis = 0,
  funding: EmpireFunding = SHIPPED_FUNDING,
): readonly ExpansionAxis[] {
  return axisSpendingOrder(
    spendingMoment(policy, true),
    [...POLICY_FIXTURE.ORDER],
    nextAxis,
    book,
    context,
    funding,
  );
}

function orderUnder(
  policy: EmpireSpendingPolicy,
  nextAxis: number,
  book: EmpireBook,
  purse: number,
): readonly ExpansionAxis[] {
  return orderUnderContext(policy, book, contextWith(purse), nextAxis);
}

describe('the spending policy is a parameter, and the shipped one is the loop that was there', () => {
  it('leaves the shipped policy blind to which check-in of the day it is', () => {
    // The claim `SHIPPED_SPENDING_MOMENT`'s docstring makes, driven rather than
    // written down. The default moment carries `lastCheckInOfDay: true`, and it
    // is only safe to default that way because the shipped policy does not read
    // it. Whole gyms are compared, not one field, over enough check-ins for a
    // rung and a recruit to have been bought.
    const policy = policyAt(EMPIRE_SWEEP.CHECK_INS_PER_DAY);
    const gap = EMPIRE_TUNING.SECONDS_PER_DAY / EMPIRE_SWEEP.CHECK_INS_PER_DAY;
    let told = createEmpireGym();
    let untold = createEmpireGym();
    for (let checkIn = 1; checkIn <= EMPIRE_SWEEP.CHECK_INS_PER_DAY * 9; checkIn += 1) {
      told = stepGym(told, policy, checkIn * gap, null, 0, SHIPPED_FUNDING, SHIPPED_SPENDING_MOMENT);
      untold = stepGym(
        untold,
        policy,
        checkIn * gap,
        null,
        0,
        SHIPPED_FUNDING,
        spendingMoment(SHIPPED_SPENDING_POLICY, checkIn % 2 === 0),
      );
    }
    // The gyms are not empty, so the equality below is not two fresh gyms.
    expect(told.expansions).toBeGreaterThan(0);
    expect(told.recruits + told.pending.length).toBeGreaterThan(0);
    expect(untold).toEqual(told);
  });

  it('answers both moment questions for every policy, with no policy unlisted', () => {
    // An exhaustive truth table rather than a spot check, so a policy added to
    // `EMPIRE_SPENDING_POLICIES` without an answer here is red on the counts.
    const spendsOnALaterCheckIn: EmpireSpendingPolicy[] = [];
    const rotates: EmpireSpendingPolicy[] = [];
    let asked = 0;
    for (const policy of EMPIRE_SPENDING_POLICIES) {
      expect(spendsAtMoment(spendingMoment(policy, true)), policy).toBe(true);
      if (spendsAtMoment(spendingMoment(policy, false))) spendsOnALaterCheckIn.push(policy);
      if (rotatesAtMoment(spendingMoment(policy, true))) rotates.push(policy);
      asked += 1;
    }
    expect(asked).toBe(EMPIRE_SPENDING_POLICIES.length);
    expect(asked).toBe(6);
    expect(spendsOnALaterCheckIn).toEqual([
      'rotate-greedy-per-check-in',
      'fixed-order-no-rotation',
      'cheapest-affordable-first',
      'costliest-affordable-first',
      'save-for-physio-first',
    ]);
    expect(rotates).toEqual(['rotate-greedy-per-check-in', 'spend-once-per-calendar-day']);
  });

  it('rotates the offer under the shipped policy and holds it still under the fixed one', () => {
    // The phase term, isolated. `nextAxis` is the only thing that differs
    // between the two readings on each line, and the purse is the one that
    // still holds two ladders after the third-book ruling — the physio purse
    // holds one, so a rotation test taken there could not fail.
    expect(orderUnder(SHIPPED_SPENDING_POLICY, 0, ROSTER_BOOK, POLICY_FIXTURE.PURSE)).toEqual([
      'space',
      'spotter',
    ]);
    expect(orderUnder(SHIPPED_SPENDING_POLICY, 1, ROSTER_BOOK, POLICY_FIXTURE.PURSE)).toEqual([
      'spotter',
      'space',
    ]);
    expect(orderUnder(SHIPPED_SPENDING_POLICY, 3, ACCELERATED_BOOK, POLICY_FIXTURE.PURSE)).toEqual([
      'equipment',
      'coach',
    ]);
    for (const nextAxis of [0, 1, 2, 3, 4]) {
      expect(
        orderUnder('fixed-order-no-rotation', nextAxis, ROSTER_BOOK, POLICY_FIXTURE.PURSE),
        `nextAxis ${nextAxis}`,
      ).toEqual([...POLICY_FIXTURE.ROSTER_SLICE]);
      expect(
        orderUnder('fixed-order-no-rotation', nextAxis, PHYSIO_BOOK, POLICY_FIXTURE.PURSE),
        `nextAxis ${nextAxis}`,
      ).toEqual([...POLICY_FIXTURE.PHYSIO_SLICE]);
      expect(
        orderUnder('fixed-order-no-rotation', nextAxis, ACCELERATED_BOOK, POLICY_FIXTURE.PURSE),
        `nextAxis ${nextAxis}`,
      ).toEqual([...POLICY_FIXTURE.IDLE_SLICE]);
    }
    // Every axis is offered out of exactly one purse, and the three slices
    // account for all of them — a count, so an axis that fell between two
    // purses is red here rather than silently never offered.
    const offered = EMPIRE_BOOKS.flatMap((book) =>
      orderUnder('fixed-order-no-rotation', 0, book, POLICY_FIXTURE.PURSE),
    );
    expect([...offered].sort()).toEqual([...POLICY_FIXTURE.ORDER].sort());
    expect(offered.length).toBe(POLICY_FIXTURE.ORDER.length);
  });

  it('advances the gym rotation counter exactly when the offer reads it', () => {
    // The other half of `rotatesAtMoment`, and it was written because the
    // mutation that removes the guard on `EmpireGym.nextAxis` in `stepGym` left
    // the whole directory green: under a non-rotating policy the counter is not
    // read, so a counter that kept advancing was invisible in every ledger. The
    // guard is the thing that keeps "the offer ignores the rotation" and "the
    // rotation stands still" one decision instead of two, and this is what says
    // so.
    const policy = policyAt(EMPIRE_SWEEP.CHECK_INS_PER_DAY);
    const gap = EMPIRE_TUNING.SECONDS_PER_DAY / EMPIRE_SWEEP.CHECK_INS_PER_DAY;
    const advanced: EmpireSpendingPolicy[] = [];
    for (const spending of EMPIRE_SPENDING_POLICIES) {
      let gym = createEmpireGym();
      for (let checkIn = 1; checkIn <= EMPIRE_SWEEP.CHECK_INS_PER_DAY; checkIn += 1) {
        gym = stepGym(
          gym,
          policy,
          checkIn * gap,
          null,
          0,
          SHIPPED_FUNDING,
          // Never a day boundary, so the day-granularity policy takes no
          // spending moment here and its counter must stand still too.
          spendingMoment(spending, false),
        );
      }
      if (gym.nextAxis !== 0) advanced.push(spending);
    }
    expect(advanced).toEqual(['rotate-greedy-per-check-in']);
    // And the same policy on a day boundary does advance, so the zero above is
    // not a gym that never stepped.
    let boundary = createEmpireGym();
    boundary = stepGym(
      boundary,
      policy,
      gap,
      null,
      0,
      SHIPPED_FUNDING,
      spendingMoment('spend-once-per-calendar-day', true),
    );
    expect(boundary.nextAxis).toBe(1);
  });

  it('answers every day anchor, and refuses the one question the per-purse anchor has no answer to', () => {
    // THE DAY ANCHOR VOCABULARY, as unit tests rather than only through the
    // 24576-pair sweep in `engagement.test.ts`. Every exported function §4c
    // added is driven here, including the two refusals.
    const facts = (
      first: boolean,
      last: boolean,
      bought: boolean,
    ): DayCheckInFacts => Object.freeze({
      firstAttendedOfDay: first,
      lastAttendedOfDay: last,
      boughtEarlierToday: bought,
    });

    // Each attendance-derived anchor reads its own fact and only its own, so an
    // anchor keyed on the wrong end of the day is red rather than plausible.
    expect(isDaySpendingMoment('last-attended-check-in', facts(true, false, false))).toBe(false);
    expect(isDaySpendingMoment('last-attended-check-in', facts(false, true, false))).toBe(true);
    expect(isDaySpendingMoment('first-attended-check-in', facts(true, false, false))).toBe(true);
    expect(isDaySpendingMoment('first-attended-check-in', facts(false, true, false))).toBe(false);
    // The one-trip affordable anchor keys on neither end: it keys on whether
    // the day's trip has already bought something.
    expect(isDaySpendingMoment('first-affordable-check-in', facts(false, false, false))).toBe(true);
    expect(isDaySpendingMoment('first-affordable-check-in', facts(true, true, true))).toBe(false);
    // And the per-purse anchor has no single moment to name, so it throws
    // rather than answering something plausible.
    expect(() =>
      isDaySpendingMoment('first-affordable-check-in-per-purse', facts(true, true, false)),
    ).toThrow(/purse by purse/);

    // The two predicates that route the driver, over the whole list rather than
    // one member each, so a fifth anchor cannot arrive unclassified.
    expect(
      EMPIRE_DAY_SPENDING_ANCHORS.filter((anchor) => !anchorHasOneTripPerDay(anchor)),
    ).toEqual(['first-affordable-check-in-per-purse']);
    expect(
      EMPIRE_DAY_SPENDING_ANCHORS.filter((anchor) => anchorConsumesDayOnlyOnPurchase(anchor)),
    ).toEqual(['first-affordable-check-in']);
    expect(EMPIRE_DAY_SPENDING_ANCHORS.length).toBe(4);
    expect(anchorHasOneTripPerDay(SHIPPED_DAY_SPENDING_ANCHOR)).toBe(false);

    // The purse bookkeeping: what is left to spend, and what a moment built
    // from it may buy out of.
    expect(booksUnspentToday([])).toEqual(EMPIRE_BOOKS);
    const spentOne = booksUnspentToday([RECRUIT_BOOK]);
    expect(spentOne.length).toBe(EMPIRE_BOOKS.length - 1);
    expect(spentOne.includes(RECRUIT_BOOK)).toBe(false);
    expect(booksUnspentToday([...EMPIRE_BOOKS])).toEqual([]);
    const partial = spendingMomentForBooks('spend-once-per-calendar-day', spentOne, false);
    expect(spendsAtMoment(partial)).toBe(true);
    expect(bookSpendsAtMoment(partial, RECRUIT_BOOK)).toBe(false);
    expect(bookSpendsAtMoment(partial, ACCELERATED_BOOK)).toBe(true);
    expect(partial.advancesRotation).toBe(false);
    const closed = spendingMomentForBooks('spend-once-per-calendar-day', [], true);
    expect(spendsAtMoment(closed)).toBe(false);
    // A purse the gym does not keep is a refusal rather than a silent no-op.
    expect(() =>
      spendingMomentForBooks('spend-once-per-calendar-day', ['not-a-book' as EmpireBook], false),
    ).toThrow(/not one of the gym/);

    // `purchasesMade` counts a recruitment when it is PAID FOR, which is the
    // fact the affordable anchors read. Driven on a real gym: one check-in with
    // spending open buys, the same check-in with every purse closed does not,
    // and a lifter moving from `pending` to the roster leaves the meter alone.
    const policy: EmpirePolicy = Object.freeze({
      checkInsPerDay: EMPIRE_SWEEP.CHECK_INS_PER_DAY,
      axisOrder: [...EMPIRE_SWEEP.AXIS_ORDER],
      leaderboardMetric: EMPIRE_SWEEP.LEADERBOARD_METRIC,
    });
    const gap = EMPIRE_TUNING.SECONDS_PER_DAY / EMPIRE_SWEEP.CHECK_INS_PER_DAY;
    let opened = createEmpireGym();
    let shut = createEmpireGym();
    let boughtAt = 0;
    let shutBought = 0;
    for (let checkIn = 1; checkIn <= EMPIRE_SWEEP.CHECK_INS_PER_DAY; checkIn += 1) {
      const before = opened;
      opened = stepGym(opened, policy, checkIn * gap, null, 0, SHIPPED_FUNDING, SHIPPED_SPENDING_MOMENT);
      if (purchasesMade(opened) > purchasesMade(before)) {
        boughtAt += 1;
        expect(booksSpentBy(before, opened).length, `check-in ${checkIn}`).toBeGreaterThan(0);
      } else {
        expect(booksSpentBy(before, opened)).toEqual([]);
      }
      const shutBefore = shut;
      shut = stepGym(shut, policy, checkIn * gap, null, 0, SHIPPED_FUNDING, closed);
      if (purchasesMade(shut) > purchasesMade(shutBefore)) shutBought += 1;
    }
    // The domain: the open gym really did buy, so the closed gym's zero is a
    // zero against something rather than a gym that could never afford a thing.
    expect(boughtAt).toBeGreaterThan(0);
    expect(shutBought).toBe(0);
    expect(purchasesMade(shut)).toBe(0);
    expect(booksSpentBy(createEmpireGym(), shut)).toEqual([]);
  });

  it('sorts by price in both directions, on prices read from the tuning block', () => {
    // The two ordering arms are each other's control: on one purse they are
    // exact reverses, which no single-direction check could say.
    // Two purses rather than one, because the third-book ruling left each
    // wall-clock purse with at most two ladders and a one-ladder purse cannot
    // discriminate an ordering at all.
    const cheapest = orderUnder('cheapest-affordable-first', 0, ROSTER_BOOK, POLICY_FIXTURE.PURSE);
    const costliest = orderUnder('costliest-affordable-first', 0, ROSTER_BOOK, POLICY_FIXTURE.PURSE);
    expect(cheapest).toEqual(['space', 'spotter']);
    expect(costliest).toEqual(['spotter', 'space']);
    expect([...costliest].reverse()).toEqual([...cheapest]);
    const idleCheapest = orderUnder(
      'cheapest-affordable-first',
      0,
      ACCELERATED_BOOK,
      POLICY_FIXTURE.PURSE,
    );
    const idleCostliest = orderUnder(
      'costliest-affordable-first',
      0,
      ACCELERATED_BOOK,
      POLICY_FIXTURE.PURSE,
    );
    expect(idleCheapest).toEqual(['coach', 'equipment']);
    expect(idleCostliest).toEqual(['equipment', 'coach']);
    // And the sort really is on the tuning block's prices, ascending, rather
    // than on the order they were declared in.
    const costs: Readonly<Record<string, number>> = POLICY_FIXTURE.LEVEL_ONE_COSTS;
    const prices = [...cheapest, ...idleCheapest].map((axis) => costs[axis] as number);
    expect(prices).toEqual([800, 1000, 1200, 1500]);
    expect([...prices].sort((left, right) => left - right)).toEqual(prices);
    // An axis with no rung this gym could start sorts last under both arms, and
    // is still offered, so the verdict and not the comparator refuses it.
    const thin = orderUnder('costliest-affordable-first', 0, ROSTER_BOOK, POLICY_FIXTURE.THIN_PURSE);
    expect(thin).toEqual(['space', 'spotter']);
    expect(thin.length).toBe(POLICY_FIXTURE.ROSTER_SLICE.length);
  });

  it('holds only the purse the physio rung is bought from, and the whole wall-clock side under a pooled control', () => {
    const thin = contextWith(POLICY_FIXTURE.THIN_PURSE);
    expect(savingForPhysio([...POLICY_FIXTURE.ORDER], thin)).toBe(true);
    expect(orderUnder('save-for-physio-first', 0, PHYSIO_BOOK, POLICY_FIXTURE.THIN_PURSE)).toEqual([
      'physio',
    ]);
    // The arm that matters, and why the one above cannot fail. After GDD §5.4's
    // third-book ruling the physio purse holds one ladder, so "physio alone is
    // offered out of it" is true of every policy and is not evidence about this
    // one. What the hold does is decided at the OTHER purses, and the two
    // readings below are what say the ruling is doing the work rather than the
    // policy:
    //
    //   - under the shipped funding the roster purse is untouched while the
    //     saver saves, because a rung bought out of it cannot spend a penny the
    //     physio rung could have had;
    //   - under `'single-wall-clock-purse'`, where the wall-clock side is one
    //     balance again, the same call offers NOTHING out of the same purse.
    //
    // Widening `physioHolds` to every wall-clock purse under the shipped
    // funding reddens the first; narrowing it to the physio purse under the
    // control reddens the second.
    expect(orderUnder('save-for-physio-first', 0, ROSTER_BOOK, POLICY_FIXTURE.THIN_PURSE)).toEqual([
      ...POLICY_FIXTURE.ROSTER_SLICE,
    ]);
    expect(
      orderUnderContext(
        'save-for-physio-first',
        POOLED_WALL_CLOCK_BOOK,
        thin,
        0,
        'single-wall-clock-purse',
      ),
    ).toEqual(['physio']);
    expect(
      orderUnderContext('save-for-physio-first', ROSTER_BOOK, thin, 0, 'single-wall-clock-purse'),
    ).toEqual([]);
    // The accelerated book spends different money under every funding and is
    // untouched, which is what makes this a hold on a purse rather than a
    // general freeze.
    expect(
      orderUnder('save-for-physio-first', 0, ACCELERATED_BOOK, POLICY_FIXTURE.THIN_PURSE),
    ).toEqual([...POLICY_FIXTURE.IDLE_SLICE]);
    // A gym that could pay for physio right now is still saving — it is about to
    // spend, and physio still goes first.
    expect(savingForPhysio([...POLICY_FIXTURE.ORDER], contextWith(POLICY_FIXTURE.PURSE))).toBe(true);
    // A gym that has ALREADY paid for its physio rung and is waiting on the
    // build has stopped saving, and this arm was a hole until a mutant found
    // it: replacing the refusal test with "anything but the ceiling" left every
    // sweep in the directory green, because no domain here reaches this state
    // at a moment the answer changes anything. It is a unit fact, so it is
    // checked as one.
    const started = startExpansion(contextWith(POLICY_FIXTURE.PURSE), 'physio');
    expect(started.started).toBe(true);
    const building = contextWith(
      POLICY_FIXTURE.PURSE,
      started.started ? [started.build] : [],
    );
    expect(expansionVerdict(building, 'physio').allowed).toBe(false);
    expect(savingForPhysio([...POLICY_FIXTURE.ORDER], building)).toBe(false);
    expect(
      orderUnderContext(
        'save-for-physio-first',
        POOLED_WALL_CLOCK_BOOK,
        building,
        0,
        'single-wall-clock-purse',
      ),
    ).toEqual(['space', 'spotter', 'physio']);
    expect(maySpendOnRoster(spendingMoment('save-for-physio-first', true), [...POLICY_FIXTURE.ORDER], building)).toBe(
      true,
    );
    // A gym with no physio rung on its ladder is not saving for one, and gets
    // the whole purse back.
    const withoutPhysio: ExpansionAxis[] = ['space', 'spotter', 'coach', 'equipment'];
    expect(savingForPhysio(withoutPhysio, thin)).toBe(false);
    expect(
      axisSpendingOrder(
        spendingMoment('save-for-physio-first', true),
        withoutPhysio,
        0,
        ROSTER_BOOK,
        thin,
      ),
    ).toEqual(['space', 'spotter']);
  });

  it('lets the roster spend while the physio purse is held, and holds it under a pooled control', () => {
    // Before the third-book ruling a recruit was bought out of the same balance
    // a physio rung was, so a policy that held one and not the other held
    // nothing — and `maySpendOnRoster` refused. `RECRUIT_BOOK` is its own purse
    // now, so under the shipped funding the refusal is gone and every policy
    // allows a recruit; under either pooled control it comes back. Both
    // directions are counted, so a `physioHolds` that stopped discriminating is
    // red on one of them whichever way it broke.
    const order = [...POLICY_FIXTURE.ORDER];
    const thin = contextWith(POLICY_FIXTURE.THIN_PURSE);
    expect(maySpendOnRoster(spendingMoment('save-for-physio-first', true), order, thin)).toBe(true);
    expect(
      maySpendOnRoster(
        spendingMoment('save-for-physio-first', true),
        order,
        thin,
        'single-wall-clock-purse',
      ),
    ).toBe(false);
    expect(
      maySpendOnRoster(spendingMoment('spend-once-per-calendar-day', false), order, thin),
    ).toBe(false);
    expect(maySpendOnRoster(spendingMoment('spend-once-per-calendar-day', true), order, thin)).toBe(
      true,
    );
    let allowed = 0;
    let allowedPooled = 0;
    for (const policy of EMPIRE_SPENDING_POLICIES) {
      if (maySpendOnRoster(spendingMoment(policy, true), order, thin)) allowed += 1;
      if (
        maySpendOnRoster(spendingMoment(policy, true), order, thin, 'single-wall-clock-purse')
      ) {
        allowedPooled += 1;
      }
    }
    // All six allow a recruit at a day's last check-in under the shipped
    // funding; five do under the pooled control. Counts, so a policy that
    // stopped answering is red here.
    expect(allowed).toBe(6);
    expect(allowed).toBe(EMPIRE_SPENDING_POLICIES.length);
    expect(allowedPooled).toBe(EMPIRE_SPENDING_POLICIES.length - 1);
  });

  it('offers nothing at all from an empty axis order, under every policy', () => {
    let empties = 0;
    for (const policy of EMPIRE_SPENDING_POLICIES) {
      for (const book of EMPIRE_BOOKS) {
        expect(
          axisSpendingOrder(
            spendingMoment(policy, true),
            [],
            0,
            book,
            contextWith(POLICY_FIXTURE.PURSE),
          ),
        ).toEqual([]);
        empties += 1;
      }
    }
    expect(empties).toBe(EMPIRE_SPENDING_POLICIES.length * EMPIRE_BOOKS.length);
    expect(EMPIRE_BOOKS.length).toBe(WALL_CLOCK_FUNDED_OUTPUTS.length + 1);
  });
});

// ---------------------------------------------------------------------------
// Purity, real-identity exposure and the magic-number audit
// ---------------------------------------------------------------------------

/**
 * Every string literal a source text ships, by kind.
 *
 * One collector, run over the real module and over a deliberately doctored copy
 * of it, so the probe below tests the INSTRUMENT rather than the regex it is
 * written beside.
 */
function stringLiteralsIn(code: string): {
  readonly singleQuoted: ReadonlySet<string>;
  readonly doubleQuoted: ReadonlySet<string>;
  readonly templateChunks: ReadonlySet<string>;
} {
  const singleQuoted = new Set<string>();
  const doubleQuoted = new Set<string>();
  const templateChunks = new Set<string>();
  for (const match of code.matchAll(/'([^'\\\n]*)'/g)) singleQuoted.add(match[1] as string);
  for (const match of code.matchAll(/"([^"\\\n]*)"/g)) doubleQuoted.add(match[1] as string);
  for (const match of code.matchAll(/`((?:[^`\\]|\\[\s\S])*)`/g)) {
    templateChunks.add((match[1] as string).replace(/\$\{[^}]*\}/g, ' '));
  }
  return { singleQuoted, doubleQuoted, templateChunks };
}

describe('this module is pure, numerically clean and names nobody', () => {
  const source = readFileSync(path.join(HERE, 'empireInvariant.ts'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('was read at all, so the scans below are not scanning an empty string', () => {
    expect(source.length).toBeGreaterThan(0);
    expect(code.length).toBeGreaterThan(0);
    expect(code).toMatch(/export function /);
  });

  // The clock-and-dice ban that used to sit here was a COPY of the list in
  // `empireCore.test.ts`, ending in `expect(checks).toBe(banned.length)` — a
  // count of an array declared three lines above it, which no state of
  // `empireInvariant.ts` could move. `empireCore.test.ts`'s own scan takes its
  // file list from `readdirSync` and therefore already covers this module by
  // name; the copy is deleted rather than re-pinned, because a twin guard that
  // is a copy is the failure CLAUDE.md records rather than the fix for it.

  /**
   * §4a's blind-spot map is the one thing in this module a reader cannot
   * re-derive: it says which mutants die here and which die one layer down, and
   * "leaves this file's N checks green" is the denominator that claim is over.
   *
   * That number drifted. It read 43 while `empireInvariant.test.ts` declared 48
   * checks, because five were added and the mutant was never re-run against
   * them — so the map's coverage claim was about a file that no longer existed.
   * `43` never appeared in the test file, so nothing could have caught it.
   *
   * WHAT THIS PINS AND WHAT IT DOES NOT. It resolves ONE number in ONE sentence
   * against a count taken from the test file's own source. It says nothing about
   * whether the mutant was actually re-run — no scan can — and nothing about the
   * other numbers in §4a, which are element counts pinned by the checks that
   * measured them. What it makes impossible is the specific drift that happened:
   * a check added here while that sentence keeps its old denominator.
   *
   * `@guarantee section-4a-denominator-is-measured`
   */
  it("§4a's denominator is this file's own check count [section-4a-denominator-is-measured]", () => {
    const testSource = readFileSync(path.join(HERE, 'empireInvariant.test.ts'), 'utf8');
    // Match COUNT, not presence: CLAUDE.md records a textual pin whose pattern
    // had three witnesses in one file and could not fail because the mutation
    // moved only one of them. One sentence carries this claim, so one match.
    const claims = [...source.matchAll(/leaves this file's (\d+) checks green/g)];
    expect(claims.length).toBe(1);
    const declared = Number((claims[0] as RegExpMatchArray)[1]);
    const declarations = [...testSource.matchAll(/^\s*it\(/gm)];
    // Non-vacuity in both directions: a regex that stopped matching would make
    // `declarations` empty and this comparison a zero against a zero.
    expect(declarations.length).toBeGreaterThan(40);
    expect(declared).toBe(declarations.length);
    expect(declared).toBe(50);

    // And the comparison bites from both sides, shown rather than claimed. The
    // module's digit moving and the test file growing a check are the two ways
    // this sentence goes stale, and each is doctored here and caught.
    const staleDigit = source.replace(
      "leaves this file's 50 checks green",
      "leaves this file's 43 checks green",
    );
    expect(staleDigit).not.toBe(source);
    expect(
      Number(
        ([...staleDigit.matchAll(/leaves this file's (\d+) checks green/g)][0] as RegExpMatchArray)[1],
      ),
    ).not.toBe(declarations.length);
    // Assembled rather than written out, and that is not fussiness.
    // `guaranteeTags.test.ts`'s witness scoper slices this file on the
    // declaration prefix and pins that its split count equals the
    // line-anchored declaration count; the prefix written out inside a string
    // — or inside this comment, which is how the first draft of it failed — is
    // a split point with no declaration behind it. It cuts a real test body
    // short and silently expires a witness. So the prefix is concatenated.
    const grownFile = `${testSource}\n  ${'it'}${'('}'a check nobody re-took the mutant against', () => {});\n`;
    expect([...grownFile.matchAll(/^\s*it\(/gm)].length).toBe(declarations.length + 1);
    expect(declared).not.toBe([...grownFile.matchAll(/^\s*it\(/gm)].length);
  });

  it('imports only from this directory', () => {
    const imports = [...code.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] as string);
    expect(imports.sort()).toEqual([
      './empireCore',
      './empireTuning',
      './expansion',
      './npc',
      './production',
      './recruitment',
      './reputation',
      './social',
    ]);
    // It composes all six §5 modules, which is what "the composer" means.
    expect(imports.length).toBe(8);
  });

  it('holds no number of its own', () => {
    // `empireInvariant.ts` is not a registered constants module, so every
    // literal in it that is not a structural idiom is a finding.
    const findings = auditSource('src/empire/empireInvariant.ts', source);
    expect(findings.length, `\n${formatFindings(findings)}\n`).toBe(0);
    // And the instrument is live on a file it has never seen, so the zero above
    // is not the audit having stopped reporting.
    expect(auditSource('src/empire/probe.ts', 'export const RATE = 42;\n').length).toBe(1);
  });

  it('ships no string a real name could be hiding in, and pins the ones it does ship', () => {
    // GDD §12.3 refuses a real, named athlete, brand, gym, company or federation
    // in any string or code path. No scan can tell a real name from an invented
    // one — that is the human, name-by-name pass. What this does is make a name
    // ARRIVING visible.
    const { singleQuoted, doubleQuoted, templateChunks } = stringLiteralsIn(code);
    // 41 rather than 37: `EMPIRE_DAY_SPENDING_ANCHORS`' four members.
    expect(singleQuoted.size).toBe(41);
    expect(doubleQuoted.size).toBe(0);
    // 15 rather than the 14 this pinned before `empireRunFaults` grew the
    // accelerant-count message; the chunk it added is asserted by count below.
    // 17 with the two refusals the day anchors brought — `spendingMomentForBooks`
    // refusing a purse the gym does not keep, and `isDaySpendingMoment` refusing
    // to name one moment for the anchor that spends purse by purse.
    expect(templateChunks.size).toBe(17);
    // The template collector really reaches this module's messages, by match
    // count rather than by presence.
    const chunks = [...templateChunks];
    expect(chunks.filter((chunk) => chunk.includes('grants were spent')).length).toBe(1);
    expect(chunks.filter((chunk) => chunk.includes('recruit-')).length).toBe(1);
    expect(chunks.filter((chunk) => chunk.includes('applied accelerants')).length).toBe(1);

    expect([...singleQuoted].filter((literal) => !literal.includes(' ')).sort()).toEqual([
      './empireCore',
      './empireTuning',
      './expansion',
      './npc',
      './production',
      './recruitment',
      './reputation',
      './social',
      'Placeholder',
      'accelerated',
      'accepted',
      'cheapest-affordable-first',
      'composed-gym',
      'costliest-affordable-first',
      'first-affordable-check-in',
      'first-affordable-check-in-per-purse',
      'first-attended-check-in',
      'fixed-order-no-rotation',
      'gym-bucks',
      'gym-empire-timer-skip',
      'last-attended-check-in',
      'not-enough-wall-clock-earnings',
      'one-way-door',
      'physio',
      'physio-days-saved',
      'promote-in-place',
      'rewarded-ad-timer-skip',
      'rival-period-close',
      'roster-slot',
      'rotate-greedy-per-check-in',
      'save-for-physio-first',
      'single-wall-clock-purse',
      'spend-once-per-calendar-day',
      'training-iq',
      'wall-clock-earned',
    ]);

    const personShaped = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;
    let stringsChecked = 0;
    for (const value of [...singleQuoted, ...doubleQuoted, ...templateChunks]) {
      expect(personShaped.test(value), `${value} is shaped like a person's name`).toBe(false);
      stringsChecked += 1;
    }
    expect(stringsChecked).toBe(singleQuoted.size + doubleQuoted.size + templateChunks.size);
    // 50 rather than 49, for the one template chunk `empireRunFaults`' new
    // accelerant-count message added; 52 with the two `ROSTER_UPGRADE_RULES`
    // members §5.3's promotion path brought; 58 with the four day anchors and
    // their two refusals.
    expect(stringsChecked).toBe(58);
  });

  it('would catch a person-shaped name arriving in this module', () => {
    // The non-vacuity probe for the scan above, and it is a probe of the
    // INSTRUMENT rather than of the pattern. The version this replaces built
    // `${titled} ${titled}` out of any two-letter token and asserted the
    // pattern matched it — which is true for every possible input, so it tested
    // the regex literal and nothing else.
    //
    // This doctors the module's own source, runs the SAME collector over it,
    // and asserts the scan reports exactly one person-shaped string. It reddens
    // if the collector stops reading a literal kind, and it reddens if the
    // pattern stops discriminating.
    const personShaped = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;
    const real = stringLiteralsIn(code);
    expect(
      [...real.singleQuoted, ...real.doubleQuoted, ...real.templateChunks].filter((value) =>
        personShaped.test(value),
      ).length,
    ).toBe(0);

    for (const doctored of [
      code.replace("const RECRUIT_DISPLAY_NAME = 'Placeholder';", "const RECRUIT_DISPLAY_NAME = 'Fictional Placeholder';"),
      code.replace('`recruit-${recruits + stillPending.length}`', '`Fictional Placeholder ${recruits}`'),
    ]) {
      // The doctoring landed, or the probe is about a string that is not there.
      expect(doctored).not.toBe(code);
      const found = stringLiteralsIn(doctored);
      const caught = [...found.singleQuoted, ...found.doubleQuoted, ...found.templateChunks].filter(
        (value) => personShaped.test(value),
      );
      expect(caught.length).toBe(1);
    }
  });

  it('names every lifter it creates from a placeholder and a kebab id', () => {
    // The names really reaching the roster, rather than the literals in the
    // source. GDD §12.3 is about what ships, and a run is what ships.
    const run = GRID[EMPIRE_SWEEP.HORIZON_DAYS.length - 1]?.runs[0] as EmpireRun;
    expect(run.days).toBe(100);
    expect(run.gym.state.roster.length).toBeGreaterThan(0);
    const personShaped = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;
    let checked = 0;
    for (const lifter of run.gym.state.roster) {
      expect(lifter.displayName).toBe('Placeholder');
      expect(lifter.id).toMatch(/^recruit-\d+$/);
      expect(personShaped.test(`${lifter.displayName} ${String(lifter.id)}`)).toBe(false);
      checked += 1;
    }
    expect(checked).toBe(run.gym.state.roster.length);
    expect(checked).toBe(11);
  });
});
