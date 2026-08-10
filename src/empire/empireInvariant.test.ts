/**
 * empireInvariant.test.ts — the second reading of "structurally unable",
 * measured.
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
 * sum, a bound or a hash. Two lists, because they fail differently:
 *
 *   - the progression ledger — a Training IQ amount and a physio amount per
 *     calendar day, stamped on the wall clock;
 *   - the ARRIVAL-DAY lists derived from it, because the ledger's own `day` is
 *     the composition loop's counter and therefore cannot move. That is stated
 *     in `arrivalDays`'s own docstring as a measured hole rather than left for a
 *     reader: `misaligned` is zero across this whole sweep, on the control as
 *     well as on the subject, so the day half of `compareLedgers` is an empty
 *     domain here. It is exercised by the unit tests on `compareLedgers` and by
 *     the arrival-day lists, which do move.
 *
 * ===========================================================================
 * Every zero has something beside it
 * ===========================================================================
 *
 *   - the POSITIVE control is the idle half of the same ledger. If a purchase
 *     did not move the Gym Bucks balance and the roster size, the sweep would be
 *     reporting a zero about an accelerant that was never applied. Pinned at 72
 *     of 72 lists moved.
 *   - the NEGATIVE control is `EmpireRun.counterfactualIdleReadings` — the same
 *     two readings, on the same days, through the same functions, taken off the
 *     idle lane. It is the wiring mistake a later piece would make, and it is
 *     produced by the run itself rather than reassembled here so it cannot drift
 *     from the thing it is a control for. Pinned at 72 of 72 lists moved, 1572
 *     of 5232 elements, and 32 of 144 arrival-day lists.
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
  arrivalDays,
  compareDayLists,
  compareLedgers,
  composeTrainingIqRate,
  empireRunFaults,
  grantSecondsAt,
  idleDayLedger,
  progressionDayLedger,
  runEmpire,
  type AccelerantPlan,
  type EmpireDayEntry,
  type EmpireRun,
} from './empireInvariant';
import { EMPIRE_SWEEP, accelerantPlans, policyAt, socialInputs } from './empireSweep.test';
import { rosterTrainingIqPerDay } from './npc';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// The grid, materialised once
// ---------------------------------------------------------------------------

const SOCIAL = socialInputs();
const PLANS = accelerantPlans();

interface SweepCell {
  readonly cadence: number;
  readonly days: number;
  /** Index 0 is the baseline, by `accelerantPlans`'s own order. */
  readonly runs: readonly EmpireRun[];
}

const GRID: readonly SweepCell[] = (() => {
  const cells: SweepCell[] = [];
  for (const days of EMPIRE_SWEEP.HORIZON_DAYS) {
    const policy = policyAt(EMPIRE_SWEEP.CHECK_INS_PER_DAY);
    cells.push({
      cadence: EMPIRE_SWEEP.CHECK_INS_PER_DAY,
      days,
      runs: PLANS.map((plan) => runEmpire(days, policy, plan, SOCIAL)),
    });
  }
  for (const days of EMPIRE_SWEEP.DENSE_HORIZON_DAYS) {
    const policy = policyAt(EMPIRE_SWEEP.DENSE_CHECK_INS_PER_DAY);
    cells.push({
      cadence: EMPIRE_SWEEP.DENSE_CHECK_INS_PER_DAY,
      days,
      runs: PLANS.map((plan) => runEmpire(days, policy, plan, SOCIAL)),
    });
  }
  return Object.freeze(cells);
})();

/** Every (baseline, candidate) pair the sweep compares. */
function pairs(): readonly { readonly baseline: EmpireRun; readonly candidate: EmpireRun }[] {
  const out: { baseline: EmpireRun; candidate: EmpireRun }[] = [];
  for (const cell of GRID) {
    const baseline = cell.runs[0];
    if (baseline === undefined) continue;
    for (const candidate of cell.runs) {
      if (candidate === baseline) continue;
      out.push({ baseline, candidate });
    }
  }
  return out;
}

const PAIRS = pairs();
const PROGRESSION_OUTPUTS = ['training-iq', 'physio-days-saved'] as const;

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
    expect(boundDays).toBe(481);
    expect(runsThatBound).toBe(26);
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
        ledgerEntries += run.ledger.length;
        faults += empireRunFaults(run).length;
      }
    }
    expect(runs).toBe(78);
    expect(PAIRS.length).toBe(72);
    expect(ledgerEntries).toBe(11336);
    expect(faults).toBe(0);
  });

  it('really recruits, expands, pays a physio and closes a rival period', () => {
    // The simulation is doing GDD §5's work rather than idling. Without this
    // the invariant could be a zero over a gym that never bought anything.
    const longest = GRID[EMPIRE_SWEEP.HORIZON_DAYS.length - 1];
    expect(longest?.days).toBe(100);
    const baseline = longest?.runs[0] as EmpireRun;
    expect(baseline.census.idleRecruits).toBe(11);
    expect(baseline.census.settledRecruits).toBe(11);
    expect(baseline.census.idleExpansions).toBe(13);
    expect(baseline.census.settledExpansions).toBe(13);
    expect(baseline.census.settledPhysioLevel).toBe(1);
    expect(baseline.census.socialRewardDays).toBe(14);
    expect(baseline.settled.state.roster.length).toBeGreaterThan(0);
    // Both §8.3B mechanisms fire somewhere in the sweep. `skipExpansion` is
    // only reachable at the dense cadence, which is why that row exists.
    let buildSkips = 0;
    let clockSkips = 0;
    for (const cell of GRID) {
      for (const run of cell.runs) {
        buildSkips += run.census.idleBuildSkips;
        clockSkips += run.census.idleClockSkips;
      }
    }
    expect(buildSkips).toBe(24);
    expect(clockSkips).toBe(22974);
  });

  it('hands the settled lane nothing, on every step of every run', () => {
    // The one line §3 of the module header calls the whole closure, pinned.
    // Reddening edit: step the settled lane with `plan.accelerant, granted`.
    let checked = 0;
    for (const cell of GRID) {
      for (const run of cell.runs) {
        expect(run.census.settledSkippedSeconds).toBe(0);
        expect(run.settled.buildSkips).toBe(0);
        expect(run.settled.clockSkips).toBe(0);
        const idleReading: number = run.settled.state.clock.accelerated;
        const wallReading: number = run.settled.state.clock.unaccelerated;
        expect(idleReading).toBe(wallReading);
        checked += 1;
      }
    }
    expect(checked).toBe(78);
    // And the idle lane WAS handed something, or the line above holds because
    // nothing was ever granted.
    let granted = 0;
    for (const cell of GRID) {
      for (const run of cell.runs) granted += run.census.grantedSeconds;
    }
    expect(granted).toBe(193183200);
  });
});

describe('no purchasable accelerant moves the progression ledger, element by element', () => {
  it('compares the progression ledger position by position and finds nothing moved', () => {
    // THE INVARIANT. Not a sum, not a bound: day, output and amount, at every
    // position of every list, for every purchasable accelerant, on every
    // schedule, at every horizon, at both cadences.
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

  it('compares the arrival-day lists position by position and finds nothing moved', () => {
    // The day-valued subject. `EmpireDayEntry.day` is the loop counter and so
    // cannot move; the day a Training IQ step or a physio level first LANDS can,
    // and chain B and chain C both move exactly that.
    let lists = 0;
    let elements = 0;
    let moved = 0;
    let lengthDiffers = 0;
    for (const pair of PAIRS) {
      for (const output of PROGRESSION_OUTPUTS) {
        const result = compareDayLists(
          arrivalDays(progressionDayLedger(pair.baseline.ledger), output),
          arrivalDays(progressionDayLedger(pair.candidate.ledger), output),
        );
        lists += 1;
        elements += result.compared;
        moved += result.moved;
        if (result.lengthDiffers) lengthDiffers += 1;
      }
    }
    expect(lists).toBe(144);
    expect(elements).toBe(2028);
    expect(moved).toBe(0);
    expect(lengthDiffers).toBe(0);
  });

  it('drove every purchasable accelerant, so the zeros are not about one of them', () => {
    const driven = new Set<string>();
    for (const plan of PLANS) {
      if (plan.accelerant !== null) driven.add(plan.accelerant);
    }
    expect([...driven].sort()).toEqual([...PURCHASABLE_ACCELERANTS].sort());
    expect(driven.size).toBe(2);
    // And both halves of `empireCore.ts`'s partition are really in the ledger.
    const outputs = new Set(GRID[0]?.runs[0]?.ledger.map((one) => one.output) ?? []);
    for (const output of PROGRESSION_REACHING_OUTPUTS) expect(outputs).toContain(output);
    expect([...outputs].filter((one) => (IDLE_ONLY_OUTPUTS as readonly string[]).includes(one)).length).toBe(2);
    expect(outputs.size).toBe(4);
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
    expect(moved).toBe(2714);
    // Every single comparison moved, not merely the aggregate.
    expect(movedLists).toBe(72);
  });

  it('NEGATIVE control: the same readings off the idle lane DO move', () => {
    // `EmpireRun.counterfactualIdleReadings` is the deliberately-wired variant:
    // the progression ledger read off the lane the purchase reaches. It is
    // chain C — a skip pays Gym Bucks sooner, so the gym affords a physio level
    // and a higher-tier recruit on an earlier wall-clock day — and it is the
    // number the zero above is a zero against.
    let comparisons = 0;
    let elements = 0;
    let moved = 0;
    let movedLists = 0;
    for (const pair of PAIRS) {
      const result = compareLedgers(
        pair.baseline.counterfactualIdleReadings,
        pair.candidate.counterfactualIdleReadings,
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

  it('NEGATIVE control: the arrival DAYS off the idle lane move, and move earlier', () => {
    // The day-valued half of the same control. Every moved element arrives
    // EARLIER, which is the direction a purchase pushes and is what says this is
    // the hazard rather than noise.
    let lists = 0;
    let elements = 0;
    let moved = 0;
    let earlier = 0;
    let movedLists = 0;
    let lengthDiffers = 0;
    for (const pair of PAIRS) {
      for (const output of PROGRESSION_OUTPUTS) {
        const result = compareDayLists(
          arrivalDays(pair.baseline.counterfactualIdleReadings, output),
          arrivalDays(pair.candidate.counterfactualIdleReadings, output),
        );
        lists += 1;
        elements += result.compared;
        moved += result.moved;
        earlier += result.earlier;
        if (result.moved > 0) movedLists += 1;
        if (result.lengthDiffers) lengthDiffers += 1;
      }
    }
    expect(lists).toBe(144);
    expect(elements).toBe(1930);
    expect(moved).toBe(32);
    expect(earlier).toBe(32);
    expect(movedLists).toBe(32);
    // The lists are not even the same length on 34 of them, which is the same
    // hazard reported by a different fact: the idle lane reaches a Training IQ
    // step the settled lane has not reached yet.
    expect(lengthDiffers).toBe(34);
  });

  it('the two controls are about the same runs as the subject', () => {
    // The trap CLAUDE.md names: a control assembled by a second loop can be a
    // control for a different simulation. These come off the same `EmpireRun`.
    for (const cell of GRID) {
      for (const run of cell.runs) {
        expect(run.counterfactualIdleReadings.length).toBe(progressionDayLedger(run.ledger).length);
        expect(run.counterfactualIdleReadings.map((one) => one.day)).toEqual(
          progressionDayLedger(run.ledger).map((one) => one.day),
        );
        expect(run.counterfactualIdleReadings.map((one) => one.output)).toEqual(
          progressionDayLedger(run.ledger).map((one) => one.output),
        );
      }
    }
    // And on the baseline plan the two are byte-identical, because with no
    // accelerant the two lanes are the same gym. That is what says the control
    // differs from the subject only where a purchase lands.
    for (const cell of GRID) {
      const baseline = cell.runs[0] as EmpireRun;
      expect(
        compareLedgers(baseline.counterfactualIdleReadings, progressionDayLedger(baseline.ledger)),
      ).toEqual({ compared: baseline.counterfactualIdleReadings.length, moved: 0, misaligned: 0, movedAmounts: 0, lengthDiffers: false });
    }
  });
});

// ---------------------------------------------------------------------------
// The run's own invariants
// ---------------------------------------------------------------------------

describe('a run refuses what it should refuse', () => {
  it('reports a settled lane that carries an accelerant', () => {
    // `empireRunFaults` is the runtime shadow of §3 of the module header, and a
    // fault list that found nothing and one that looked at nothing read the
    // same. This drives the faults it exists for.
    const run = GRID[0]?.runs[1] as EmpireRun;
    expect(empireRunFaults(run)).toEqual([]);
    const doctored: EmpireRun = {
      ...run,
      census: { ...run.census, settledSkippedSeconds: 1 },
      settled: { ...run.settled, buildSkips: 1 },
    };
    const faults = empireRunFaults(doctored);
    expect(faults.length).toBe(2);
    expect(faults[0]).toContain('seconds of accelerant');
    expect(faults[1]).toContain('grants');
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
      counterfactualIdleReadings: [
        ...run.counterfactualIdleReadings,
        entry(0, 'training-iq', 0),
      ],
    };
    expect(empireRunFaults(overIq).some((fault) => fault.includes('above the daily budget'))).toBe(
      true,
    );
  });

  it('reports a ledger with no progression half and one with no idle half', () => {
    const run = GRID[0]?.runs[0] as EmpireRun;
    const idleOnly: EmpireRun = {
      ...run,
      ledger: idleDayLedger(run.ledger),
      counterfactualIdleReadings: [],
    };
    const faults = empireRunFaults(idleOnly);
    expect(faults.some((fault) => fault.includes('no entry reaches progression'))).toBe(true);
    expect(faults.some((fault) => fault.includes('no counterfactual'))).toBe(true);
    const progressionOnly: EmpireRun = { ...run, ledger: progressionDayLedger(run.ledger) };
    expect(
      empireRunFaults(progressionOnly).some((fault) => fault.includes('no entry is idle-only')),
    ).toBe(true);
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

describe('this module is pure, numerically clean and names nobody', () => {
  const source = readFileSync(path.join(HERE, 'empireInvariant.ts'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('was read at all, so the scans below are not scanning an empty string', () => {
    expect(source.length).toBeGreaterThan(0);
    expect(code.length).toBeGreaterThan(0);
    expect(code).toMatch(/export function /);
  });

  it('reads no clock, rolls no dice and touches no host API', () => {
    // The directory-wide version of this lives in `empireCore.test.ts`. This is
    // the same ban applied here, so it bites before that file's list is signed.
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
    for (const pattern of banned) {
      expect(code, `empireInvariant.ts must not reach ${String(pattern)}`).not.toMatch(pattern);
      checks += 1;
    }
    expect(checks).toBe(banned.length);
    expect(checks).toBe(17);
    // Every pattern is driven against a string it should trip, so a regex that
    // stopped matching anything is red rather than quietly green.
    for (const [index, pattern] of banned.entries()) {
      expect(tripwires[index], `pattern ${String(pattern)} matches nothing`).toMatch(pattern);
    }
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
    const singleQuoted = new Set<string>();
    const doubleQuoted = new Set<string>();
    const templateChunks = new Set<string>();
    for (const match of code.matchAll(/'([^'\\\n]*)'/g)) singleQuoted.add(match[1] as string);
    for (const match of code.matchAll(/"([^"\\\n]*)"/g)) doubleQuoted.add(match[1] as string);
    for (const match of code.matchAll(/`((?:[^`\\]|\\[\s\S])*)`/g)) {
      templateChunks.add((match[1] as string).replace(/\$\{[^}]*\}/g, ' '));
    }
    expect(singleQuoted.size).toBe(28);
    expect(doubleQuoted.size).toBe(0);
    expect(templateChunks.size).toBe(15);
    // The template collector really reaches this module's messages, by match
    // count rather than by presence.
    const chunks = [...templateChunks];
    expect(chunks.filter((chunk) => chunk.includes('the counterfactual holds')).length).toBe(1);
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
      'accepted',
      'coach-staff-level',
      'composed-gym',
      'gym-bucks',
      'gym-empire-timer-skip',
      'physio',
      'physio-days-saved',
      'rewarded-ad-timer-skip',
      'rival-period-close',
      'roster-slot',
      'training-iq',
    ]);

    const personShaped = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;
    let stringsChecked = 0;
    for (const value of [...singleQuoted, ...doubleQuoted, ...templateChunks]) {
      expect(personShaped.test(value), `${value} is shaped like a person's name`).toBe(false);
      stringsChecked += 1;
    }
    expect(stringsChecked).toBe(singleQuoted.size + doubleQuoted.size + templateChunks.size);
    expect(stringsChecked).toBe(43);

    // The pattern is not a dead letter, and the probe is DERIVED from this
    // module's own vocabulary rather than written beside the pattern.
    let probes = 0;
    for (const literal of [...singleQuoted].filter((value) => !value.includes(' '))) {
      const word = literal.replace(/[^A-Za-z]/g, '');
      if (word.length < 2) continue;
      const titled = `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`;
      expect(personShaped.test(`${titled} ${titled}`), `${titled} is not person-shaped`).toBe(true);
      probes += 1;
    }
    expect(probes).toBe(20);
    expect(probes).toBe([...singleQuoted].filter((value) => !value.includes(' ')).length);
  });

  it('names every lifter it creates from a placeholder and a kebab id', () => {
    // The names really reaching the roster, rather than the literals in the
    // source. GDD §12.3 is about what ships, and a run is what ships.
    const run = GRID[EMPIRE_SWEEP.HORIZON_DAYS.length - 1]?.runs[0] as EmpireRun;
    expect(run.days).toBe(100);
    expect(run.settled.state.roster.length).toBeGreaterThan(0);
    const personShaped = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;
    let checked = 0;
    for (const lifter of run.settled.state.roster) {
      expect(lifter.displayName).toBe('Placeholder');
      expect(lifter.id).toMatch(/^recruit-\d+$/);
      expect(personShaped.test(`${lifter.displayName} ${String(lifter.id)}`)).toBe(false);
      checked += 1;
    }
    expect(checked).toBe(run.settled.state.roster.length);
    expect(checked).toBe(11);
  });
});
