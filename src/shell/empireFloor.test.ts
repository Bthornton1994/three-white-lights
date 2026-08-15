/**
 * empireFloor.test.ts — the §12.3 measurement for GDD §5's floor, and the
 * arithmetic the screen draws.
 *
 * ===========================================================================
 * WHY THE SWEEP PARAMETERS ARE IN THIS FILE AND NOT IN A MODULE OF THEIR OWN
 * ===========================================================================
 * CLAUDE.md's house standard is `src/game/streakSweep.ts`: seeds, lengths and
 * the generator as named constants in their own module, because the first
 * version of that measurement was reported with its seeds unstated and could not
 * afterwards be reproduced. Everything but the FILE is honoured below — the
 * seeds, the schedule generator, the horizons and the counts are all named and
 * frozen, and every number this file reports can be re-derived from them.
 *
 * The file is different for a stated reason rather than by preference. A
 * `src/shell/empireFloorSweep.ts` holding numeric literals cannot pass
 * `src/tuning/audit.ts` without a row in `SOURCE_RULES` and its pinned mirror in
 * `audit.test.ts` — the three files CLAUDE.md names as THE shared surface
 * between the sessions running on this repository, whose edits have to be filed
 * as a crossing in `CLAUDE.md` BEFORE the work starts. This piece was not
 * authorised to file one, and the audit deliberately does not read test files,
 * so the parameters live here. That is a deviation from the house shape and it
 * is written down rather than absorbed.
 */

import { describe, expect, it } from 'vitest';

import {
  createEmpireGym,
  stepGym,
  type EmpireGym,
} from '../empire/empireInvariant';
import { EXPANSION_AXES } from '../empire/expansion';
import { accrueProduction, bankableOfflineSeconds } from '../empire/production';
import { EMPIRE_TUNING } from '../empire/empireTuning';
import { createEmpireClock, type EmpireState } from '../empire/empireCore';
import { EMPIRE_FLOOR } from './shellTuning';
import {
  advanceEmpireFloor,
  checkInReadingAt,
  checkInsBy,
  elapsedSecondsBetween,
  empireFloorAfter,
  empireFloorReadings,
  openEmpireFloor,
  pendingWasCapped,
  EMPIRE_FLOOR_POLICY,
  type EmpireFloor,
} from './empireFloor';

// ---------------------------------------------------------------------------
// The parameters every count below was taken on
// ---------------------------------------------------------------------------

const FLOOR_SWEEP = Object.freeze({
  /** The one seed. Turning it changes which schedules the property is checked over. */
  SEED: 0x5f3a91,
  /** How many random call schedules the invariance sweep drives. */
  SCHEDULES: 64,
  /** How many `advanceEmpireFloor` calls each schedule makes. */
  CALLS_PER_SCHEDULE: 24,
  /** The wall-clock window, in seconds, a schedule's calls are drawn from. */
  HORIZON_SECONDS: 300,
  /** The horizons the engagement pairing is enumerated at. */
  PAIR_HORIZON_SECONDS: Object.freeze([30, 60, 120, 300]),
  /** How many base visit schedules each pairing horizon enumerates. */
  PAIRS_PER_HORIZON: 48,
  /** Visits in a base schedule, before the extra one is inserted. */
  VISITS_PER_SCHEDULE: 6,
  /** The step, in seconds, the monotonicity walk reads the floor at. */
  MONOTONE_STEP_SECONDS: 1,
  /** How far the monotonicity walk goes. */
  MONOTONE_SECONDS: 240,
  /** The fragmenting control's window and its two collection cadences, in seconds. */
  FRAGMENT_SECONDS: 600,
  FRAGMENT_WHOLE_TICK: 1,
  FRAGMENT_HALF_TICK: 0.5,
});

/** mulberry32. Deterministic, seeded, and the same generator `streakSweep.ts` uses. */
function generator(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` instants in milliseconds, sorted, inside `windowSeconds`. */
function scheduleOf(random: () => number, count: number, windowSeconds: number): readonly number[] {
  const ms = windowSeconds * EMPIRE_FLOOR.MILLISECONDS_PER_SECOND;
  return Array.from({ length: count }, () => Math.floor(random() * ms)).sort((a, b) => a - b);
}

/** The floor a whole call schedule leaves behind, opened at instant zero. */
function floorAfterSchedule(schedule: readonly number[]): EmpireFloor {
  let floor = openEmpireFloor(0);
  for (const at of schedule) floor = advanceEmpireFloor(floor, at);
  return floor;
}

/** Everything about a floor that a comparison should care about. */
const shapeOf = (floor: EmpireFloor): string =>
  JSON.stringify({
    openSeconds: floor.openSeconds,
    checkIns: floor.checkIns,
    gym: floor.gym,
    readings: empireFloorReadings(floor),
  });

// ---------------------------------------------------------------------------
// THE CONTROL: what the naive wiring does, measured on the shipped engine
// ---------------------------------------------------------------------------

/**
 * The wiring this module exists instead of: hand `stepGym` the raw clock every
 * time somebody looks.
 *
 * Kept runnable rather than described, because every zero below is a zero
 * against this. It is the same `stepGym`, the same policy and the same gym —
 * the only difference is that the collection reading is whatever instant the
 * caller happened to arrive at.
 */
function naiveGymAfter(collectionsAt: readonly number[]): EmpireGym {
  let gym = createEmpireGym();
  for (const at of collectionsAt) gym = stepGym(gym, EMPIRE_FLOOR_POLICY, at, null, 0);
  return gym;
}

const everySecondTo = (seconds: number, step: number): readonly number[] => {
  const out: number[] = [];
  for (let at = step; at <= seconds; at += step) out.push(Number(at.toFixed(1)));
  return out;
};

describe('the naive wiring really does punish a player for looking more often', () => {
  /**
   * THE MEASUREMENT THAT DECIDED THE SHAPE OF `empireFloor.ts`.
   *
   * `production.ts` quantises a gap down to whole `TICK_SECONDS` and `stepGym`
   * moves the collection mark to the exact reading it was handed, so a
   * collection taken at a fractional offset discards the fragment. Twice the
   * attention, and the diligent gym banks nothing at all.
   */
  it('collecting twice as often at half-tick offsets banks NOTHING — the non-zero control', () => {
    const whole = naiveGymAfter(
      everySecondTo(FLOOR_SWEEP.FRAGMENT_SECONDS, FLOOR_SWEEP.FRAGMENT_WHOLE_TICK),
    );
    const fragmented = naiveGymAfter(
      everySecondTo(FLOOR_SWEEP.FRAGMENT_SECONDS, FLOOR_SWEEP.FRAGMENT_HALF_TICK),
    );
    expect(whole.state.gymBucks).toBe(11.063625);
    expect(fragmented.state.gymBucks).toBe(0);
    // ...and the more diligent gym really did check in more, so the zero above
    // is not a zero about a gym that never collected.
    expect(fragmented.state.reputation).toBe(2400);
    expect(whole.state.reputation).toBe(1200);
  });

  /**
   * The other half of the same defect: a gym that misses its check-ins and
   * collects the whole span at once is permanently behind one that did not. So
   * "catch up in one big step" is not an optimisation of the loop in
   * `advanceEmpireFloor`; it is a different and worse answer.
   */
  it('collecting one long gap is not the same as collecting its check-ins', () => {
    const oneStep = naiveGymAfter([FLOOR_SWEEP.FRAGMENT_SECONDS]);
    const everyTick = naiveGymAfter(
      everySecondTo(FLOOR_SWEEP.FRAGMENT_SECONDS, FLOOR_SWEEP.FRAGMENT_WHOLE_TICK),
    );
    expect(oneStep.state.gymBucks).toBe(10);
    expect(oneStep.state.reputation).toBe(2);
    expect(everyTick.state.gymBucks).toBe(11.063625);
    expect(everyTick.state.reputation).toBe(1200);
  });
});

// ---------------------------------------------------------------------------
// THE PROPERTY
// ---------------------------------------------------------------------------

describe('the floor is a function of elapsed time and of nothing else', () => {
  /**
   * The test `empireFloor.ts`'s guarantee tag names.
   *
   * Random call schedules against the one-shot value. Counts, not bounds: the
   * comparisons made and the distinct floors seen are both pinned, so a sweep
   * whose generator stopped producing anything reports an empty domain instead
   * of agreeing with it.
   */
  it('any schedule of calls lands on the value one call would have produced [the-floor-is-a-function-of-elapsed-time-and-nothing-else]', () => {
    const random = generator(FLOOR_SWEEP.SEED);
    const distinct = new Set<string>();
    const mismatches: string[] = [];
    let compared = 0;
    for (let index = 0; index < FLOOR_SWEEP.SCHEDULES; index += 1) {
      const schedule = scheduleOf(
        random,
        FLOOR_SWEEP.CALLS_PER_SCHEDULE,
        FLOOR_SWEEP.HORIZON_SECONDS,
      );
      const last = schedule[schedule.length - 1] ?? 0;
      const walked = shapeOf(floorAfterSchedule(schedule));
      const oneShot = shapeOf(advanceEmpireFloor(openEmpireFloor(0), last));
      compared += 1;
      distinct.add(oneShot);
      if (walked !== oneShot) mismatches.push(`schedule ${index} ending at ${last}ms`);
    }
    expect(mismatches, mismatches.join('\n')).toEqual([]);
    expect(compared).toBe(FLOOR_SWEEP.SCHEDULES);
    // NON-VACUITY. If every schedule produced the same floor, the equality above
    // would be about one value and would say nothing.
    expect(distinct.size).toBe(25);
  });

  it('and a schedule that stops early is exactly the same floor as one that never started', () => {
    // The degenerate direction of the same claim, written out because a sweep
    // over random schedules will never draw it: no calls at all, and one call at
    // the instant of opening, are the same floor.
    expect(shapeOf(openEmpireFloor(0))).toBe(shapeOf(advanceEmpireFloor(openEmpireFloor(0), 0)));
  });

  it('a backwards clock cannot take anything away', () => {
    const ahead = advanceEmpireFloor(openEmpireFloor(0), 120_000);
    const behind = advanceEmpireFloor(ahead, 5_000);
    expect(shapeOf(behind)).toBe(shapeOf(ahead));
    expect(elapsedSecondsBetween(120_000, 5_000)).toBe(0);
  });

  it('refuses a clock reading that is not a number rather than paying out NaN', () => {
    expect(() => elapsedSecondsBetween(0, Number.NaN)).toThrow(RangeError);
    expect(() => openEmpireFloor(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('§12.3 — a player who looks more often is never worse off', () => {
  /**
   * The house shape, applied to the one thing a player can vary on this
   * surface: how often they look at it. Two schedules identical except that one
   * has an extra visit, every reading compared, counts pinned at zero — with the
   * naive wiring's own non-zero count taken on the same schedules beside it.
   */
  it('an extra visit changes NOTHING, and the naive wiring loses money on the same schedules', () => {
    const random = generator(FLOOR_SWEEP.SEED);
    let pairs = 0;
    let moved = 0;
    const violating: string[] = [];
    let naiveViolating = 0;
    let naiveMoved = 0;
    for (const horizon of FLOOR_SWEEP.PAIR_HORIZON_SECONDS) {
      for (let index = 0; index < FLOOR_SWEEP.PAIRS_PER_HORIZON; index += 1) {
        const base = scheduleOf(random, FLOOR_SWEEP.VISITS_PER_SCHEDULE, horizon);
        const extra = Math.floor(random() * horizon * EMPIRE_FLOOR.MILLISECONDS_PER_SECOND);
        const end = Math.max(base[base.length - 1] ?? 0, extra);
        // Both players are read at the SAME instant, so the only difference
        // between them is the extra look.
        const idle = [...base, end].sort((a, b) => a - b);
        const diligent = [...base, extra, end].sort((a, b) => a - b);

        pairs += 1;
        const idleFloor = floorAfterSchedule(idle);
        const diligentFloor = floorAfterSchedule(diligent);
        if (shapeOf(idleFloor) !== shapeOf(diligentFloor)) {
          violating.push(`horizon ${horizon}s, pair ${index}: the extra look moved the floor`);
        }
        if (diligentFloor.gym.state.gymBucks !== idleFloor.gym.state.gymBucks) moved += 1;

        // THE SAME PAIR, THROUGH THE WIRING THIS MODULE REPLACES.
        const naiveIdle = naiveGymAfter(idle.map((ms) => ms / EMPIRE_FLOOR.MILLISECONDS_PER_SECOND));
        const naiveDiligent = naiveGymAfter(
          diligent.map((ms) => ms / EMPIRE_FLOOR.MILLISECONDS_PER_SECOND),
        );
        if (naiveDiligent.state.gymBucks < naiveIdle.state.gymBucks) naiveViolating += 1;
        if (naiveDiligent.state.gymBucks !== naiveIdle.state.gymBucks) naiveMoved += 1;
      }
    }
    expect(violating, violating.slice(0, 4).join('\n')).toEqual([]);
    expect(pairs).toBe(192);
    // NON-VACUITY, TWO WAYS. The pairs really were enumerated, and the shipped
    // floor really is INDIFFERENT to the extra look rather than the sweep having
    // failed to produce one.
    expect(moved).toBe(0);
    // THE SAME 192 PAIRS, THROUGH THE WIRING THIS MODULE REPLACES. 72 of them
    // move at all, and 65 of those 72 move DOWNWARDS: the player who looked one
    // extra time ends with less money than the one who did not. That is what the
    // zeros above are zero against, and the seven that move upwards are why the
    // shipped answer is an EQUALITY rather than a "never less" bound — a wiring
    // that pays for attention is a wiring where not paying attention costs you.
    expect(naiveViolating).toBe(65);
    expect(naiveMoved).toBe(72);
  });

  it('every reading is non-decreasing as wall time passes', () => {
    let decreases = 0;
    let increases = 0;
    let read = 0;
    let previous = empireFloorAfter(0);
    for (
      let at = FLOOR_SWEEP.MONOTONE_STEP_SECONDS;
      at <= FLOOR_SWEEP.MONOTONE_SECONDS;
      at += FLOOR_SWEEP.MONOTONE_STEP_SECONDS
    ) {
      const now = advanceEmpireFloor(previous, at * EMPIRE_FLOOR.MILLISECONDS_PER_SECOND);
      read += 1;
      const before = empireFloorReadings(previous);
      const after = empireFloorReadings(now);
      for (const key of ['gymBucks', 'reputation', 'roster', 'clockSeconds'] as const) {
        if (Number(after[key]) < Number(before[key])) decreases += 1;
        if (Number(after[key]) > Number(before[key])) increases += 1;
      }
      previous = now;
    }
    expect(decreases).toBe(0);
    expect(read).toBe(240);
    // NON-VACUITY: the readings really do move, so the zero is not a zero about
    // a floor that never advanced.
    expect(increases).toBe(72);
  });
});

// ---------------------------------------------------------------------------
// WHAT THE SCREEN ACTUALLY DRAWS
// ---------------------------------------------------------------------------

describe('the floor advances, and these are the numbers', () => {
  /**
   * The readings at four instants, pinned. This is the arithmetic behind "the
   * screen shows real advancing state": every one of these comes out of
   * `stepGym` and `accrueProduction`, and re-tuning `EMPIRE_FLOOR` or any
   * `EMPIRE_TUNING` rate moves them, which is friction a human should meet.
   */
  it('draws the gym at 0s, 10s, 60s and 600s', () => {
    expect(empireFloorReadings(empireFloorAfter(0))).toEqual({
      gymBucks: '0.000',
      pendingGymBucks: '0.000',
      reputation: '0',
      roster: '0',
      equipment: 'bare-bar',
      clockSeconds: '0',
    });
    expect(empireFloorReadings(empireFloorAfter(10))).toEqual({
      gymBucks: '0.167',
      pendingGymBucks: '0.000',
      reputation: '2',
      roster: '0',
      equipment: 'bare-bar',
      clockSeconds: '10',
    });
    expect(empireFloorReadings(empireFloorAfter(60))).toEqual({
      gymBucks: '1.000',
      pendingGymBucks: '0.000',
      reputation: '12',
      roster: '0',
      equipment: 'bare-bar',
      clockSeconds: '60',
    });
    expect(empireFloorReadings(empireFloorAfter(600))).toEqual({
      gymBucks: '10.000',
      pendingGymBucks: '0.000',
      reputation: '120',
      roster: '0',
      equipment: 'bare-bar',
      clockSeconds: '600',
    });
  });

  it('the SINCE CHECK-IN row moves between check-ins, which the collected rows do not', () => {
    // The row `accrueProduction` is drawn for: what the gap has produced and not
    // yet paid in. Read at three instants inside one check-in gap.
    const readings = [63, 65, 69].map((at) => empireFloorReadings(empireFloorAfter(at)));
    expect(readings.map((r) => r.pendingGymBucks)).toEqual(['0.050', '0.083', '0.150']);
    // ...while the collected rows sit still, because no check-in happened.
    expect(new Set(readings.map((r) => r.gymBucks))).toEqual(new Set(['1.000']));
    expect(new Set(readings.map((r) => r.clockSeconds))).toEqual(new Set(['60']));
  });

  it('the check-in schedule is the cadence and nothing else', () => {
    expect(checkInsBy(0)).toBe(0);
    expect(checkInsBy(EMPIRE_FLOOR.CHECK_IN_SECONDS - 1)).toBe(0);
    expect(checkInsBy(EMPIRE_FLOOR.CHECK_IN_SECONDS)).toBe(1);
    expect(checkInReadingAt(3)).toBe(EMPIRE_FLOOR.CHECK_IN_SECONDS * 3);
    expect(empireFloorAfter(FLOOR_SWEEP.HORIZON_SECONDS).checkIns).toBe(
      FLOOR_SWEEP.HORIZON_SECONDS / EMPIRE_FLOOR.CHECK_IN_SECONDS,
    );
  });
});

describe('the seams this surface deliberately does not cross', () => {
  it('the offline cap never bites here, and the reading that says so can be non-zero', () => {
    // Every gap on this surface is one check-in, orders of magnitude inside
    // GDD §5.1's cap, so nothing is ever discarded.
    for (const at of [0, 7, 60, 600, 3600]) {
      expect(pendingWasCapped(empireFloorAfter(at)), `at ${at}s`).toBe(false);
    }
    // THE OTHER DIRECTION, so the false above is not a false about a field that
    // cannot be true. A gap past the horizon really does discard time — read off
    // the same `accrueProduction` the floor's preview goes through.
    const horizonSeconds =
      Math.max(
        EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS,
        EMPIRE_TUNING.OFFLINE_EARNINGS_NO_PUNISH_HOURS,
      ) * EMPIRE_TUNING.SECONDS_PER_HOUR;
    const past = horizonSeconds + EMPIRE_TUNING.SECONDS_PER_HOUR;
    expect(bankableOfflineSeconds(past)).toBe(horizonSeconds);
    const gym = createEmpireGym();
    const asOf: EmpireState = Object.freeze({
      ...gym.state,
      clock: createEmpireClock(past, 0),
    });
    expect(
      accrueProduction(asOf, gym.collectedAt, {
        gymBucksPerHour: () => 0,
        trainingIqPerDay: () => 0,
      }).offlineSecondsDiscarded,
    ).toBe(EMPIRE_TUNING.SECONDS_PER_HOUR);
  });

  it('spends nothing on an accelerant, so GDD §8.3B is unreachable from this surface', () => {
    const floor = empireFloorAfter(FLOOR_SWEEP.HORIZON_SECONDS);
    expect(floor.gym.state.accelerants).toEqual([]);
    expect(floor.gym.buildSkips).toBe(0);
    expect(floor.gym.clockSkips).toBe(0);
    expect(floor.gym.skippedSeconds).toBe(0);
  });

  it('the policy it steps with is derived from §5, not restated here', () => {
    expect(EMPIRE_FLOOR_POLICY.axisOrder).toBe(EXPANSION_AXES);
    expect(EMPIRE_FLOOR_POLICY.checkInsPerDay).toBe(
      EMPIRE_TUNING.SECONDS_PER_DAY / EMPIRE_FLOOR.CHECK_IN_SECONDS,
    );
  });
});
