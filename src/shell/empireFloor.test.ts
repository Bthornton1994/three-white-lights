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
  /**
   * How far the monotonicity walks go, in seconds — one entry per horizon.
   *
   * 240 USED TO BE THE WHOLE LIST, AND THE ZERO IT PRODUCED WAS A PROPERTY OF
   * THE WINDOW RATHER THAN OF THE FLOOR. In four minutes this gym makes no
   * purchase at all — `purchaseMoments` is 0 there, pinned below — so a walk
   * that stops at 240 s can only ever see the accrual half of the loop. Run the
   * same walk to twelve hours and one reading drops (`gymBucks` 1199.417 ->
   * 0.034 at 34300 s); to twenty-four, two (1499.917 -> 0.633 at 56670 s).
   *
   * Twelve and twenty-four hours are the horizons a phone reaches while
   * backgrounded for a working day and for a night, which is why they are the
   * two added rather than a round number picked for looking thorough. The
   * sitting stays in the list because it is the domain the old claim was true
   * over, and its zeros are what say the added horizons are the thing that
   * moved.
   */
  MONOTONE_HORIZONS_SECONDS: Object.freeze([
    240,
    12 * EMPIRE_TUNING.SECONDS_PER_HOUR,
    24 * EMPIRE_TUNING.SECONDS_PER_HOUR,
  ]),
  /**
   * Above this, a horizon is long enough for the gym to have spent money, so it
   * is one of the horizons the §12.3 pairing is re-enumerated at.
   *
   * A threshold rather than a second copy of the two numbers, so the pairing
   * cannot end up asking about a different set than the walk does.
   */
  PAIR_LONG_HORIZON_ABOVE_SECONDS: EMPIRE_TUNING.SECONDS_PER_HOUR,
  /** How many base visit schedules each LONG pairing horizon enumerates. */
  LONG_PAIRS_PER_HORIZON: 8,
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
// WHICH READINGS ARE COUNTERS, WHICH IS A BALANCE, AND WHICH IS THE SAWTOOTH
// ---------------------------------------------------------------------------

/**
 * ===========================================================================
 * THE OLD CLAIM WAS "EVERY READING IS NON-DECREASING" AND IT IS NOT TRUE
 * ===========================================================================
 * It measured zero decreases because it walked 240 seconds, and in 240 seconds
 * this gym buys nothing. Widen the identical walk and `gymBucks` drops — once
 * in twelve hours, twice in twenty-four — because `stepGym` step 4 starts a
 * §5.4 expansion and step 5 recruits a §5.3 lifter out of the money step 3 just
 * collected. GDD §5.1 is "time passes -> resources generate -> SPEND to expand",
 * so the drop is the loop working; a floor whose Gym Bucks only ever rose would
 * be a floor with §5.1's second verb missing.
 *
 * THIS IS A DOMAIN-COVERAGE REPAIR AND NOT A §12.3 REMEDIATION, and the
 * distinction is worth stating plainly because the widened horizon will
 * otherwise be read as a fairness fix. §12.3 asks whether a player who looks
 * more often ends up worse off. The drop is not that: two players who arrive at
 * the same instant see the same drop however differently they looked, which is
 * `advanceEmpireFloor`'s stated property and is re-enumerated at these same two
 * long horizons by the pairing check further down (`differing` pinned at 0 with
 * the count of pairs that actually reached a purchase pinned beside it). What
 * was wrong here was the CLAIM, which quantified over "every reading" while its
 * evidence covered a window with no purchase in it.
 *
 * So the readings are classified instead of lumped, and the classification is
 * exhaustive over what the floor draws:
 *
 *   - CUMULATIVE. `reputation`, `roster` and `clockSeconds` are counters. §5
 *     has no path that takes reputation away, removes a lifter or rewinds the
 *     gym clock, so these are non-decreasing at every horizon and the zero is
 *     pinned at all three.
 *   - A BALANCE. `gymBucks` is money. It rises on collection and falls when the
 *     gym commits it, so it is sawtooth, and what is checked is that it never
 *     falls at a step where the gym bought NOTHING.
 *   - THE SAWTOOTH BY CONSTRUCTION. `pendingGymBucks` is the preview of the
 *     current gap; the check-in that banks it resets it to zero. It falls once
 *     per check-in and nowhere else, which is pinned in both directions.
 *   - CATEGORICAL. `equipment` is a rung name. It is not ordered, so no
 *     monotonicity claim is made about it, and it is named here rather than
 *     silently dropped from the walk the way it used to be.
 */
const CUMULATIVE_READINGS = Object.freeze(['reputation', 'roster', 'clockSeconds'] as const);
const BALANCE_READING = 'gymBucks' as const;
const SAWTOOTH_READING = 'pendingGymBucks' as const;
const CATEGORICAL_READINGS = Object.freeze(['equipment'] as const);
const NUMERIC_READINGS = Object.freeze([
  BALANCE_READING,
  SAWTOOTH_READING,
  ...CUMULATIVE_READINGS,
] as const);

type NumericReading = (typeof NUMERIC_READINGS)[number];

/**
 * How many §5.3 recruitments, §5.4 rungs and roster promotions this gym has
 * committed to.
 *
 * `recruits` counts the ones that have JOINED and `pending` the ones still on
 * their timer, so the sum moves when a recruitment BEGINS — which is when the
 * money leaves — and stays put when one completes. That is the moment a fall in
 * the balance is allowed to happen at.
 */
const purchasesMadeBy = (floor: EmpireFloor): number =>
  floor.gym.expansions + floor.gym.promotions + floor.gym.recruits + floor.gym.pending.length;

/** What one second-by-second walk of the floor saw. Counts, never bounds. */
interface FloorWalk {
  readonly read: number;
  readonly decreases: Readonly<Record<NumericReading, number>>;
  readonly increases: Readonly<Record<NumericReading, number>>;
  /** Steps at which the gym committed to a recruit, a rung or a promotion. */
  readonly purchaseMoments: number;
  /** Steps at which `stepGym` was asked for at least one check-in. */
  readonly checkInMoments: number;
  /** `pendingGymBucks` fell at a step that took a check-in. */
  readonly sawtoothResetsAtACheckIn: number;
  /** `pendingGymBucks` fell at a step that did not. THE SAFETY COUNT. */
  readonly sawtoothFallsAwayFromACheckIn: number;
  /** The widest gap `accrueProduction` was ever asked about, in whole seconds. */
  readonly widestPendingGapSeconds: number;
  /** Readings at which GDD §5.1's offline cap discarded any of that gap. */
  readonly cappedReadings: number;
  /**
   * Every fall of the BALANCE, as text: the instant, the reading before and the
   * reading after.
   *
   * NO `bought` FLAG IN THIS TEXT, deliberately. The safety claim is the list
   * below, and if these lines carried the flag then pinning this record would
   * imply the safety claim outright and leave that check unable to speak — the
   * domination CLAUDE.md makes a required check. This list says WHICH steps
   * fell; the next one says whether any of them was unbought. Two facts, two
   * assertions, neither implying the other.
   */
  readonly balanceFalls: readonly string[];
  /**
   * The falls of the balance that happened at a step where the gym bought
   * NOTHING. THE SAFETY LIST, and it is a list rather than a count so a failure
   * names the instant.
   */
  readonly balanceFallsWithNoPurchase: readonly string[];
  /**
   * Every fall of one of the three COUNTERS, as text. Expected empty at every
   * horizon; a list rather than a count for the same reason.
   */
  readonly counterFalls: readonly string[];
}

const WALKS = new Map<number, FloorWalk>();

/**
 * One walk to `horizonSeconds`, memoised.
 *
 * Memoised because four separate claims below are about the same walk and
 * re-running it four times would be four times the cost for the same numbers.
 * It is a pure function of its argument — `empireFloorAfter` opens a fresh gym
 * — so the cache cannot leak state between tests.
 */
function walkTo(horizonSeconds: number): FloorWalk {
  const cached = WALKS.get(horizonSeconds);
  if (cached !== undefined) return cached;

  const decreases: Record<NumericReading, number> = {
    gymBucks: 0,
    pendingGymBucks: 0,
    reputation: 0,
    roster: 0,
    clockSeconds: 0,
  };
  const increases: Record<NumericReading, number> = { ...decreases };
  const balanceFalls: string[] = [];
  const balanceFallsWithNoPurchase: string[] = [];
  const counterFalls: string[] = [];
  let read = 0;
  let purchaseMoments = 0;
  let checkInMoments = 0;
  let sawtoothResetsAtACheckIn = 0;
  let sawtoothFallsAwayFromACheckIn = 0;
  let widestPendingGapSeconds = 0;
  let cappedReadings = 0;

  let previous = empireFloorAfter(0);
  for (
    let at = FLOOR_SWEEP.MONOTONE_STEP_SECONDS;
    at <= horizonSeconds;
    at += FLOOR_SWEEP.MONOTONE_STEP_SECONDS
  ) {
    const now = advanceEmpireFloor(previous, at * EMPIRE_FLOOR.MILLISECONDS_PER_SECOND);
    read += 1;
    const before = empireFloorReadings(previous);
    const after = empireFloorReadings(now);
    const bought = purchasesMadeBy(now) > purchasesMadeBy(previous);
    const checkedIn = now.checkIns > previous.checkIns;
    if (bought) purchaseMoments += 1;
    if (checkedIn) checkInMoments += 1;

    const gap = now.openSeconds - now.gym.collectedAt.unaccelerated;
    if (gap > widestPendingGapSeconds) widestPendingGapSeconds = gap;
    if (pendingWasCapped(now)) cappedReadings += 1;

    for (const key of NUMERIC_READINGS) {
      if (Number(after[key]) < Number(before[key])) {
        decreases[key] += 1;
        const where = `at ${at}s ${key} ${before[key]} -> ${after[key]}`;
        if (key === BALANCE_READING) {
          balanceFalls.push(where);
          if (!bought) balanceFallsWithNoPurchase.push(`${where}, and the gym bought nothing`);
        }
        if (key === SAWTOOTH_READING) {
          if (checkedIn) sawtoothResetsAtACheckIn += 1;
          else sawtoothFallsAwayFromACheckIn += 1;
        }
        if ((CUMULATIVE_READINGS as readonly string[]).includes(key)) counterFalls.push(where);
      }
      if (Number(after[key]) > Number(before[key])) increases[key] += 1;
    }
    previous = now;
  }

  const walk: FloorWalk = Object.freeze({
    read,
    decreases: Object.freeze(decreases),
    increases: Object.freeze(increases),
    purchaseMoments,
    checkInMoments,
    balanceFalls: Object.freeze(balanceFalls),
    balanceFallsWithNoPurchase: Object.freeze(balanceFallsWithNoPurchase),
    counterFalls: Object.freeze(counterFalls),
    sawtoothResetsAtACheckIn,
    sawtoothFallsAwayFromACheckIn,
    widestPendingGapSeconds,
    cappedReadings,
  });
  WALKS.set(horizonSeconds, walk);
  return walk;
}

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

  it('every reading the floor draws is classified, and nothing falls out of the walk', () => {
    // THE SCOPE GUARD. The claims below are stated per class, so a reading added
    // to `EmpireFloorReadings` that joined none of them would be checked by
    // nothing and would look exactly like coverage. Both directions, so a class
    // that stopped naming a live reading is red as well.
    expect([...NUMERIC_READINGS, ...CATEGORICAL_READINGS].sort()).toEqual(
      Object.keys(empireFloorReadings(empireFloorAfter(0))).sort(),
    );
    expect([BALANCE_READING, SAWTOOTH_READING, ...CUMULATIVE_READINGS].sort()).toEqual(
      [...NUMERIC_READINGS].sort(),
    );
    // ...and the walk really reads all of them, at every horizon it is asked
    // about, rather than skipping one whose counter stayed at zero.
    expect(FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS).toEqual([240, 43_200, 86_400]);
  });

  it('the CUMULATIVE readings never go backwards, at four minutes and at twelve and twenty-four hours', () => {
    // `reputation`, `roster` and `clockSeconds` are counters, not balances, so
    // the claim is one flat list of every step that took any of them down,
    // gathered across all three horizons and expected empty. A LIST AND NOT A
    // COUNT, because a failure here should name the instant.
    //
    // REPUTATION STOPS RISING AND DOES NOT FALL, which is why its increase count
    // below is 2500 at BOTH long horizons: §5.4's reputation line reaches its
    // ceiling inside twelve hours and then sits there. A plateau is
    // non-decreasing, and pinning the count rather than a bound is what makes
    // that visible instead of leaving it to look like a stopped walk.
    const counterFalls = FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS.flatMap(
      (horizon) => walkTo(horizon).counterFalls,
    );
    expect(counterFalls, counterFalls.slice(0, 4).join('\n')).toEqual([]);
    // ...and the non-vacuity, which is a different fact and not implied by the
    // line above: the walk really read every step and the counters really moved.
    //
    // A `fell: []` COLUMN WAS WRITTEN INTO THE ROWS BELOW AND DELETED, and the
    // domination is recorded rather than the check quietly dropped — it was
    // `decreases[key] > 0` over the same three walks, which is the same
    // predicate as the list above, so no state of the subject could redden one
    // while the other passed. The list is what survives, because it names the
    // instant and a column could only say that a key fell.
    //
    // The rows are TEXT rather than objects, so a failure prints the numbers
    // that moved instead of `expected [ …(3) ] to deeply equal [ …(3) ]`. That
    // is CLAUDE.md's "a check that bites but fails uselessly is half a check",
    // and it is measured rather than assumed: the object form printed exactly
    // that sentence when a mutant was driven against it.
    expect(
      FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS.map((horizon) => {
        const walk = walkTo(horizon);
        const rises = CUMULATIVE_READINGS.map((key) => `${key} +${walk.increases[key]}`);
        return `${horizon}s: ${walk.read} read, ${rises.join(', ')}`;
      }),
    ).toEqual([
      '240s: 240 read, reputation +24, roster +0, clockSeconds +24',
      '43200s: 43200 read, reputation +2500, roster +1, clockSeconds +4320',
      '86400s: 86400 read, reputation +2500, roster +2, clockSeconds +8640',
    ]);
  });

  it('GYM BUCKS is a balance, so it falls — and only ever at a step where the gym bought something', () => {
    // THE RESTATED CLAIM, AND THE ONE THE OLD 240-SECOND WINDOW COULD NOT HAVE
    // MADE. The old assertion was "every reading is non-decreasing", pinned at
    // zero decreases; the same walk to twelve hours gives one and to
    // twenty-four gives two, and re-pinning at two would have pinned a fact
    // about the window rather than about the floor. What is true at every
    // horizon is that the balance only falls when the gym has committed money,
    // and that is the zero worth having.
    //
    // THE TWO FALLS, NAMED, so a re-tune that moves them is read as a change
    // rather than as an arithmetic slip: `gymBucks` 1199.417 -> 0.034 at
    // 34300 s, and 1499.917 -> 0.633 at 56670 s. Both are `stepGym` step 4
    // starting a §5.4 expansion.
    //
    // AND THE PURCHASE COUNT IS LARGER THAN THE FALL COUNT, which is a fact
    // about §5 rather than a slack bound: five commitments in twenty-four hours
    // move this row twice. §5 keeps more than one book and this row draws
    // `state.gymBucks`, so a commitment funded out of another purse leaves it
    // alone. Both are pinned, so that ratio cannot drift in silence.
    //
    // THE SAFETY CLAIM, and it is empty at every horizon.
    const unbought = FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS.flatMap(
      (horizon) => walkTo(horizon).balanceFallsWithNoPurchase,
    );
    expect(unbought, unbought.slice(0, 4).join('\n')).toEqual([]);
    // ...and the falls themselves, which is a SEPARATE fact: these lines carry
    // no `bought` flag, so pinning them cannot imply the assertion above. WHICH
    // steps fell is this record; whether any of them was unbought is that one.
    expect(FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS.map((horizon) => walkTo(horizon).balanceFalls))
      .toEqual([
        [],
        ['at 34300s gymBucks 1199.417 -> 0.034'],
        ['at 34300s gymBucks 1199.417 -> 0.034', 'at 56670s gymBucks 1499.917 -> 0.633'],
      ]);
    // ...and the counts the falls sit among.
    expect(
      FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS.map((horizon) => {
        const walk = walkTo(horizon);
        return `${horizon}s: ${walk.purchaseMoments} bought, ${walk.increases[BALANCE_READING]} rises`;
      }),
    ).toEqual(['240s: 0 bought, 24 rises', '43200s: 2 bought, 4319 rises', '86400s: 5 bought, 8638 rises']);
  });

  it('the SINCE CHECK-IN row is the one that is sawtooth by construction, and it resets at a check-in and nowhere else', () => {
    // `pendingGymBucks` is the preview of the gap since the last check-in, so
    // the check-in that banks it takes it back to zero. It was never in the old
    // walk's key list and nothing said why; it is in the walk now, with its own
    // claim, because "which readings are monotone" is not answerable while one
    // of them is quietly excluded.
    //
    // BOTH DIRECTIONS. The safety count is a fall away from a check-in — money
    // disappearing from the preview with nothing banking it — and the pairing
    // count says the resets really happened, one per check-in, rather than the
    // row having gone flat.
    //
    // THE SAFETY CLAIM: money leaving the preview with nothing banking it.
    for (const horizon of FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS) {
      expect(
        walkTo(horizon).sawtoothFallsAwayFromACheckIn,
        `steps in ${horizon}s where SINCE CHECK-IN fell with no check-in banking it`,
      ).toBe(0);
    }
    // ...and the other half, which the line above does not imply: every
    // check-in really does reset the row, so the zero is not a zero about a row
    // that had gone flat. AN `atACheckIn === checkInMoments` MAP WAS WRITTEN
    // BELOW THIS AND DELETED, with the domination recorded: this table pins both
    // numbers per horizon, so the equality could not have reddened while the
    // table passed.
    expect(
      FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS.map((horizon) => {
        const walk = walkTo(horizon);
        return `${horizon}s: ${walk.sawtoothResetsAtACheckIn} resets against ${walk.checkInMoments} check-ins`;
      }),
    ).toEqual([
      '240s: 24 resets against 24 check-ins',
      '43200s: 4320 resets against 4320 check-ins',
      '86400s: 8640 resets against 8640 check-ins',
    ]);
  });

  it('an extra visit changes nothing at the horizons where the gym SPENDS, either', () => {
    // THE REASON THE WIDENED WALK ABOVE IS NOT A §12.3 FINDING, CHECKED RATHER
    // THAN ASSERTED. The pairing at the top of this block enumerates 30 s to
    // 300 s, where this gym never buys anything — so it could not have said
    // whether the DROP is engagement-sensitive. This re-enumerates the same
    // construction at the two long horizons, where it is.
    //
    // Both players are read at the same instant and differ only by one extra
    // look. `withAPurchase` is the non-vacuity that matters here: it counts the
    // pairs whose floors actually reached a commitment, so a zero `differing`
    // over pairs that never spent would report itself instead of passing.
    const horizons = FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS.filter(
      (horizon) => horizon > FLOOR_SWEEP.PAIR_LONG_HORIZON_ABOVE_SECONDS,
    );
    expect(horizons).toEqual([43_200, 86_400]);
    const observed = horizons.map((horizon) => {
      const random = generator(FLOOR_SWEEP.SEED);
      let pairs = 0;
      let differing = 0;
      let withAPurchase = 0;
      for (let index = 0; index < FLOOR_SWEEP.LONG_PAIRS_PER_HORIZON; index += 1) {
        const base = scheduleOf(random, FLOOR_SWEEP.VISITS_PER_SCHEDULE, horizon);
        const extra = Math.floor(random() * horizon * EMPIRE_FLOOR.MILLISECONDS_PER_SECOND);
        const end = Math.max(base[base.length - 1] ?? 0, extra);
        const idle = floorAfterSchedule([...base, end].sort((a, b) => a - b));
        const diligent = floorAfterSchedule([...base, extra, end].sort((a, b) => a - b));
        pairs += 1;
        if (shapeOf(idle) !== shapeOf(diligent)) differing += 1;
        if (purchasesMadeBy(idle) > 0) withAPurchase += 1;
      }
      return `${horizon}s: ${differing} of ${pairs} pairs differ, ${withAPurchase} reached a purchase`;
    });
    expect(observed).toEqual([
      '43200s: 0 of 8 pairs differ, 7 reached a purchase',
      '86400s: 0 of 8 pairs differ, 8 reached a purchase',
    ]);
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
  it('the offline cap cannot bite here, and that is a bound rather than five samples', () => {
    // ===================================================================
    // `pendingWasCapped` IS FALSE AT EVERY FLOOR THIS MODULE CAN BUILD, AND
    // FIVE INSTANTS WERE NEVER EVIDENCE OF THAT
    // ===================================================================
    // The old shape here was `toBe(false)` at 0, 7, 60, 600 and 3600 seconds.
    // Extended, it is false at all 86400 readings of a whole day's walk too —
    // and that is still a statement about a sampled domain, which is the exact
    // defect the horizon widening above was for. The honest version is the
    // reason, and the reason is an inequality between two numbers:
    //
    //   `advanceEmpireFloor` takes every check-in it owes before it previews, so
    //   the gap `accrueProduction` is asked about is
    //   `openSeconds - checkInReadingAt(checkIns)`, which is strictly less than
    //   `EMPIRE_FLOOR.CHECK_IN_SECONDS` by construction. The cap discards only
    //   what is past `bankableOfflineSeconds`' horizon. So while one check-in is
    //   shorter than that horizon, no floor can be built that caps.
    //
    // THREE ASSERTIONS, AND NONE OF THEM IS DOMINATED BY ANOTHER. That is
    // CLAUDE.md's required check, discharged by measurement rather than by
    // reading them side by side — each was shown to redden ALONE:
    //
    //   `CHECK_IN_SECONDS < cappedAbove`   `CHECK_IN_SECONDS` -> 86_400:
    //                                      `expected 86400 to be less than 43200`.
    //   `cappedReadings === 0`             the same cadence with the other two
    //                                      assertions removed:
    //                                      `capped readings in 86400s: expected
    //                                      43199 to be +0`.
    //   `widestPendingGapSeconds`          `owed` -> `checkInsBy(openSeconds) / 2`,
    //                                      which leaves the cadence alone and the
    //                                      cap quiet: `widest previewed gap in
    //                                      240s: expected 129 to be 9`.
    //
    // They read as one fact and are three: what the tuning says, what the engine
    // discarded, and how far behind the collection mark actually fell.
    const cappedAbove = bankableOfflineSeconds(Number.MAX_SAFE_INTEGER);
    expect(EMPIRE_FLOOR.CHECK_IN_SECONDS).toBeLessThan(cappedAbove);
    for (const horizon of FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS) {
      const walk = walkTo(horizon);
      expect(walk.cappedReadings, `capped readings in ${horizon}s`).toBe(0);
      // ...and the gap really is bounded by one check-in, measured rather than
      // argued: a widest gap of zero would mean the walk never previewed a gap
      // at all, and the zero above would be a zero about nothing.
      expect(walk.widestPendingGapSeconds, `widest previewed gap in ${horizon}s`).toBe(
        EMPIRE_FLOOR.CHECK_IN_SECONDS - FLOOR_SWEEP.MONOTONE_STEP_SECONDS,
      );
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
