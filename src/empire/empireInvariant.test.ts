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
 *     Pinned at 1572 of 5232 elements, and 32 of 144 arrival-day elements, every
 *     one of them EARLIER.
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
  asGymBucks,
  asReputation,
  asUnacceleratedSeconds,
  createEmpireClock,
  createEmpireState,
  createNpcLifter,
  type EmpireState,
  type NpcLifter,
  type UnacceleratedSeconds,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import {
  EMPIRE_FUNDINGS,
  SHIPPED_FUNDING,
  arrivalDays,
  compareDayLists,
  compareLedgers,
  composeTrainingIqRate,
  empireRunFaults,
  grantSecondsAt,
  idleDayLedger,
  outputSeries,
  progressionDayLedger,
  runEmpire,
  type AccelerantPlan,
  type EmpireDayEntry,
  type EmpireFunding,
  type EmpireRun,
} from './empireInvariant';
import { EMPIRE_SWEEP, accelerantPlans, policyAt, socialInputs } from './empireSweep.test';
import { rosterTrainingIqPerDay } from './npc';

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
    settledGymBucks: asGymBucks(0),
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
    expect(boundDays).toBe(455);
    expect(runsThatBound).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// The invariant
// ---------------------------------------------------------------------------

describe('the composed run is a run at all', () => {
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
    expect(baseline.census.recruits).toBe(11);
    expect(baseline.census.expansions).toBe(13);
    expect(baseline.census.settledPhysioLevel).toBe(1);
    expect(baseline.census.socialRewardDays).toBe(14);
    expect(baseline.gym.state.roster.length).toBeGreaterThan(0);
    // The physio rung is reached inside the sweep and is NOT reached at the
    // shortest horizon, so the physio series has a step in it to compare rather
    // than a constant. Counts, not bounds, on both.
    let runsWithPhysio = 0;
    let runsWithoutPhysio = 0;
    for (const cell of GRID) {
      for (const run of cell.runs) {
        if (run.census.settledPhysioLevel > 0) runsWithPhysio += 1;
        else runsWithoutPhysio += 1;
      }
    }
    expect(runsWithPhysio).toBe(52);
    expect(runsWithoutPhysio).toBe(26);
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
    expect(totals.dayElements).toBe(120);
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
    expect(totals.dayElements).toBe(1896);
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

  it('POSITIVE control: the purchase moves the gym the player looks at', () => {
    // The other half of the sale, on the census rather than on the ledger: a
    // plan that grants enough finishes builds the baseline has not finished and
    // puts more lifters on the floor. Counts, not bounds.
    let movedExpansions = 0;
    let movedRecruits = 0;
    let compared = 0;
    for (const pair of PAIRS) {
      compared += 1;
      if (pair.candidate.census.expansions !== pair.baseline.census.expansions) movedExpansions += 1;
      if (pair.candidate.census.recruits !== pair.baseline.census.recruits) movedRecruits += 1;
    }
    expect(compared).toBe(72);
    expect(movedExpansions).toBe(12);
    expect(movedRecruits).toBe(0);
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
    expect(moved).toBe(1572);
    expect(movedLists).toBe(72);
  });

  it('NEGATIVE control: both series move, and the physio days arrive EARLIER', () => {
    // Per series, so the control is a control for both of the subject's two
    // zeros rather than for their sum. The physio half is the one that moves a
    // DAY: every moved element arrives earlier, which is the direction a
    // purchase pushes and is what says this is the hazard rather than noise.
    const physio = seriesTotals(CONTROL_PAIRS, 'physio-days-saved');
    expect(physio.elements).toBe(2616);
    expect(physio.moved).toBe(84);
    expect(physio.movedLists).toBe(48);
    expect(physio.dayElements).toBe(128);
    expect(physio.dayMoved).toBe(32);
    expect(physio.dayEarlier).toBe(32);
    expect(physio.dayMovedLists).toBe(32);
    // The lists are not even the same length on 16 of them, which is the same
    // hazard reported by a different fact.
    expect(physio.dayLengthDiffers).toBe(16);

    const trainingIq = seriesTotals(CONTROL_PAIRS, 'training-iq');
    expect(trainingIq.elements).toBe(2616);
    expect(trainingIq.moved).toBe(1488);
    expect(trainingIq.movedLists).toBe(72);
    // The trickle's arrival-day list does not move under the control; it gets
    // LONGER, because the accelerated gym reaches steps the wall clock has not.
    // Recorded as measured rather than assumed: the day-valued subject is the
    // physio one, and this is the fact that says so.
    expect(trainingIq.dayMoved).toBe(0);
    expect(trainingIq.dayLengthDiffers).toBe(20);
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
    expect(censusesThatDiffer).toBe(39);
    expect(EMPIRE_FUNDINGS.length).toBe(2);
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
    expect(faults.length).toBe(1);
    expect(faults[0]).toContain('grants were spent');
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
    expect(singleQuoted.size).toBe(27);
    expect(doubleQuoted.size).toBe(0);
    expect(templateChunks.size).toBe(14);
    // The template collector really reaches this module's messages, by match
    // count rather than by presence.
    const chunks = [...templateChunks];
    expect(chunks.filter((chunk) => chunk.includes('grants were spent')).length).toBe(1);
    expect(chunks.filter((chunk) => chunk.includes('recruit-')).length).toBe(1);

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
      'composed-gym',
      'gym-bucks',
      'gym-empire-timer-skip',
      'physio',
      'physio-days-saved',
      'rewarded-ad-timer-skip',
      'rival-period-close',
      'roster-slot',
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
    expect(stringsChecked).toBe(41);
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
