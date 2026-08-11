/** SCRATCH — deleted before commit. Measures everything the rework needs to pin. */
import { describe, expect, it } from 'vitest';

import { EMPIRE_SWEEP, socialInputs } from './empireSweep.test';
import {
  EMPIRE_DAY_SPENDING_ANCHORS,
  EMPIRE_SPENDING_POLICIES,
  SHIPPED_DAY_SPENDING_ANCHOR,
  SHIPPED_ROSTER_UPGRADE,
  type EmpireDaySpendingAnchor,
  type EmpirePolicy,
  type EmpireSpendingPolicy,
  type RosterUpgradeRule,
  type SocialInputs,
} from './empireInvariant';
import {
  addEngagement,
  compareEngagement,
  emptyEngagementTally,
  engagementRunFaults,
  engagementWiring,
  historyFrom,
  runEngagement,
  shippedEngagementWiring,
  type EngagementHistory,
  type EngagementRun,
  type EngagementTally,
  type EngagementWiringKey,
} from './engagement';
import { asCalendarDay, type SocialCalendarContext } from './social';

const DAYS = 12;
const CADENCE = EMPIRE_SWEEP.CHECK_INS_PER_DAY;
const WINDOW = 12;
const DAY_POLICY: EmpireSpendingPolicy = 'spend-once-per-calendar-day';
const BASE_SOCIAL: SocialInputs = socialInputs();
const BASE_TRAINED_DAYS: readonly number[] = EMPIRE_SWEEP.TRAINED_DAYS;

function policyFor(cadence: number = CADENCE): EmpirePolicy {
  return Object.freeze({
    checkInsPerDay: cadence,
    axisOrder: [...EMPIRE_SWEEP.AXIS_ORDER],
    leaderboardMetric: EMPIRE_SWEEP.LEADERBOARD_METRIC,
  });
}

function socialFor(history: EngagementHistory): SocialInputs {
  const calendar: SocialCalendarContext = Object.freeze({
    ...BASE_SOCIAL.calendar,
    trainedDays: Object.freeze(
      history.trainedDays.map((day) => asCalendarDay(EMPIRE_SWEEP.ANCHOR_DAY + day)),
    ),
    sessionCount: EMPIRE_SWEEP.SESSION_COUNT + history.trainedDays.length,
  });
  return Object.freeze({ ...BASE_SOCIAL, calendar });
}

function runAt(
  days: number,
  history: EngagementHistory,
  anchor: EmpireDaySpendingAnchor,
  key: EngagementWiringKey = 'shipped',
  upgrades: RosterUpgradeRule = SHIPPED_ROSTER_UPGRADE,
  spending: EmpireSpendingPolicy = DAY_POLICY,
  cadence: number = CADENCE,
): EngagementRun {
  const wiring = key === 'shipped' ? shippedEngagementWiring() : engagementWiring(key, 0);
  return runEngagement(
    days,
    policyFor(cadence),
    history,
    socialFor(history),
    wiring,
    spending,
    upgrades,
    history,
    anchor,
  );
}

function windowHistory(mask: number, days: number = DAYS): EngagementHistory {
  return historyFrom(
    days * CADENCE,
    (slot) => (slot >= WINDOW ? true : (mask & (1 << slot)) !== 0),
    BASE_TRAINED_DAYS,
  );
}

function sweep(
  anchor: EmpireDaySpendingAnchor,
  key: EngagementWiringKey,
  upgrades: RosterUpgradeRule = SHIPPED_ROSTER_UPGRADE,
): EngagementTally {
  const cache = new Map<number, EngagementRun>();
  const at = (mask: number): EngagementRun => {
    const hit = cache.get(mask);
    if (hit !== undefined) return hit;
    const made = runAt(DAYS, windowHistory(mask), anchor, key, upgrades);
    cache.set(mask, made);
    return made;
  };
  let tally = emptyEngagementTally();
  for (let mask = 0; mask < 1 << WINDOW; mask += 1) {
    for (let bit = 0; bit < WINDOW; bit += 1) {
      if ((mask & (1 << bit)) !== 0) continue;
      tally = addEngagement(tally, compareEngagement(at(mask), at(mask | (1 << bit))));
    }
  }
  return tally;
}

/** A 32-bit LCG, the same one `engagement.test.ts` uses. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function seededSweep(
  days: number,
  trials: number,
  seed: number,
  anchor: EmpireDaySpendingAnchor,
): EngagementTally {
  const random = lcg(seed);
  const slots = days * CADENCE;
  let tally = emptyEngagementTally();
  for (let trial = 0; trial < trials; trial += 1) {
    const grid: boolean[] = [];
    for (let slot = 0; slot < slots; slot += 1) grid.push(random() < 0.55);
    const base = historyFrom(slots, (slot) => grid[slot] === true, BASE_TRAINED_DAYS);
    const baseRun = runAt(days, base, anchor);
    for (let slot = 0; slot < slots; slot += 1) {
      if (grid[slot] === true) continue;
      const more = historyFrom(
        slots,
        (at) => (at === slot ? true : grid[at] === true),
        BASE_TRAINED_DAYS,
      );
      tally = addEngagement(tally, compareEngagement(baseRun, runAt(days, more, anchor)));
    }
  }
  return tally;
}

function wholeDaySweep(days: number, anchor: EmpireDaySpendingAnchor): EngagementTally {
  const cache = new Map<number, EngagementRun>();
  const at = (mask: number): EngagementRun => {
    const hit = cache.get(mask);
    if (hit !== undefined) return hit;
    const history = historyFrom(
      days * CADENCE,
      (slot) => (mask & (1 << Math.floor(slot / CADENCE))) !== 0,
      BASE_TRAINED_DAYS,
    );
    const made = runAt(days, history, anchor);
    cache.set(mask, made);
    return made;
  };
  let tally = emptyEngagementTally();
  for (let mask = 0; mask < 1 << days; mask += 1) {
    for (let bit = 0; bit < days; bit += 1) {
      if ((mask & (1 << bit)) !== 0) continue;
      tally = addEngagement(tally, compareEngagement(at(mask), at(mask | (1 << bit))));
    }
  }
  return tally;
}

const say = (label: string, value: unknown): void => {
  process.stdout.write(`RESULT ${label} ${JSON.stringify(value)}\n`);
};

describe('scratch', () => {
  it('C: per-purse against the one-way-door roster', () => {
    say('per-purse/one-way-door', sweep(SHIPPED_DAY_SPENDING_ANCHOR, 'shipped', 'one-way-door'));
    expect(1).toBe(1);
  }, 900_000);

  it('D: per-purse split by whether the added check-in moves the day earliest opportunity', () => {
    const cache = new Map<number, EngagementRun>();
    const at = (mask: number): EngagementRun => {
      const hit = cache.get(mask);
      if (hit !== undefined) return hit;
      const made = runAt(DAYS, windowHistory(mask), SHIPPED_DAY_SPENDING_ANCHOR);
      cache.set(mask, made);
      return made;
    };
    let movesEarliest = 0;
    let movesEarliestViolating = 0;
    let movesEarliestMoved = 0;
    let keepsEarliest = 0;
    let keepsEarliestViolating = 0;
    let keepsEarliestMoved = 0;
    for (let mask = 0; mask < 1 << WINDOW; mask += 1) {
      for (let bit = 0; bit < WINDOW; bit += 1) {
        if ((mask & (1 << bit)) !== 0) continue;
        const day = Math.floor(bit / CADENCE);
        let firstAttended = CADENCE;
        for (let tick = CADENCE - 1; tick >= 0; tick -= 1) {
          const slot = day * CADENCE + tick;
          if (slot >= WINDOW || (mask & (1 << slot)) !== 0) firstAttended = tick;
        }
        const divergence = compareEngagement(at(mask), at(mask | (1 << bit)));
        if (bit - day * CADENCE < firstAttended) {
          movesEarliest += 1;
          if (divergence.violating) movesEarliestViolating += 1;
          if (divergence.movedElements > 0) movesEarliestMoved += 1;
        } else {
          keepsEarliest += 1;
          if (divergence.violating) keepsEarliestViolating += 1;
          if (divergence.movedElements > 0) keepsEarliestMoved += 1;
        }
      }
    }
    say('per-purse-split', {
      movesEarliest,
      movesEarliestViolating,
      movesEarliestMoved,
      keepsEarliest,
      keepsEarliestViolating,
      keepsEarliestMoved,
    });
    expect(1).toBe(1);
  }, 900_000);

  it('E: seeded 20 and 40 under every anchor for the day policy', () => {
    for (const anchor of EMPIRE_DAY_SPENDING_ANCHORS) {
      say(`seeded20/${anchor}`, seededSweep(20, 12, 90210, anchor));
      say(`seeded40/${anchor}`, seededSweep(40, 6, 31337, anchor));
    }
    expect(1).toBe(1);
  }, 900_000);

  it('F: whole-day under the shipped anchor', () => {
    say('whole-day/per-purse', wholeDaySweep(12, SHIPPED_DAY_SPENDING_ANCHOR));
    expect(1).toBe(1);
  }, 900_000);

  it('H: extra domains under the shipped anchor: late window, coarse grid, seeded 60/100', () => {
    // Late window: slots 24..32, 12-day horizon.
    const lateFrom = 24;
    const lateSlots = 9;
    const cacheL = new Map<number, EngagementRun>();
    const atL = (mask: number): EngagementRun => {
      const hit = cacheL.get(mask);
      if (hit !== undefined) return hit;
      const history = historyFrom(
        DAYS * CADENCE,
        (slot) =>
          slot < lateFrom || slot >= lateFrom + lateSlots
            ? true
            : (mask & (1 << (slot - lateFrom))) !== 0,
        BASE_TRAINED_DAYS,
      );
      const made = runAt(DAYS, history, SHIPPED_DAY_SPENDING_ANCHOR);
      cacheL.set(mask, made);
      return made;
    };
    let late = emptyEngagementTally();
    for (let mask = 0; mask < 1 << lateSlots; mask += 1) {
      for (let bit = 0; bit < lateSlots; bit += 1) {
        if ((mask & (1 << bit)) !== 0) continue;
        late = addEngagement(late, compareEngagement(atL(mask), atL(mask | (1 << bit))));
      }
    }
    say('late-window/per-purse', late);

    // Coarse fully exhaustive: 7 days at 2 check-ins.
    const coarseDays = 7;
    const coarseCadence = 2;
    const coarseSlots = coarseDays * coarseCadence;
    const cacheC = new Map<number, EngagementRun>();
    const atC = (mask: number): EngagementRun => {
      const hit = cacheC.get(mask);
      if (hit !== undefined) return hit;
      const history = historyFrom(
        coarseSlots,
        (slot) => (mask & (1 << slot)) !== 0,
        BASE_TRAINED_DAYS,
      );
      const made = runAt(
        coarseDays,
        history,
        SHIPPED_DAY_SPENDING_ANCHOR,
        'shipped',
        SHIPPED_ROSTER_UPGRADE,
        DAY_POLICY,
        coarseCadence,
      );
      cacheC.set(mask, made);
      return made;
    };
    let coarse = emptyEngagementTally();
    for (let mask = 0; mask < 1 << coarseSlots; mask += 1) {
      for (let bit = 0; bit < coarseSlots; bit += 1) {
        if ((mask & (1 << bit)) !== 0) continue;
        coarse = addEngagement(coarse, compareEngagement(atC(mask), atC(mask | (1 << bit))));
      }
    }
    say('coarse/per-purse', coarse);

    say('seeded60/per-purse', seededSweep(60, 4, 60613, SHIPPED_DAY_SPENDING_ANCHOR));
    say('seeded100/per-purse', seededSweep(100, 2, 100003, SHIPPED_DAY_SPENDING_ANCHOR));
    say('seeded60/last-attended', seededSweep(60, 4, 60613, 'last-attended-check-in'));
    say('seeded100/last-attended', seededSweep(100, 2, 100003, 'last-attended-check-in'));
    expect(1).toBe(1);
  }, 1_800_000);

  it('G: full-attendance census under every policy', () => {
    const history = historyFrom(DAYS * CADENCE, () => true, BASE_TRAINED_DAYS);
    for (const spending of EMPIRE_SPENDING_POLICIES) {
      const run = runAt(
        DAYS,
        history,
        SHIPPED_DAY_SPENDING_ANCHOR,
        'shipped',
        SHIPPED_ROSTER_UPGRADE,
        spending,
      );
      say(`census/${spending}`, { census: run.census, faults: engagementRunFaults(run) });
    }
    for (const anchor of EMPIRE_DAY_SPENDING_ANCHORS) {
      const run = runAt(DAYS, history, anchor);
      say(`census-anchor/${anchor}`, { census: run.census, faults: engagementRunFaults(run) });
    }
    expect(1).toBe(1);
  }, 900_000);
});
