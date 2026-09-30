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
  purchasesMade,
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
  catchUpWasCapped,
  checkInReadingAt,
  checkInsBy,
  elapsedSecondsBetween,
  empireFloorAfter,
  empireFloorReadings,
  forfeitedAwaySeconds,
  openEmpireFloor,
  pendingWasCapped,
  CATCH_UP_CAP_SECONDS,
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
  /**
   * Where the AIMED extra look is placed relative to a commitment instant, in
   * seconds.
   *
   * Three positions rather than a window, and they are chosen from the engine's
   * own grain rather than for looking thorough: a commitment lands on a
   * check-in, so `0` is an extra look taken on the very check-in that spends
   * the money, and `-1` / `+1` are one `MONOTONE_STEP_SECONDS` either side of
   * it, inside the gap where a fragmenting wiring would lose the remainder.
   */
  AIMED_OFFSETS_SECONDS: Object.freeze([-1, 0, 1]),
  /**
   * How many examples the two LADDER lists keep before they stop collecting.
   *
   * A CAP ON THE PRINTING AND NOT ON THE CHECK. Both lists are asserted EMPTY,
   * so a cap cannot hide a failure: one example is as red as a hundred
   * thousand. What it stops is the failure being useless — a row drawing an
   * off-ladder name at every step collects one entry per second of the walk,
   * and the first drive of that mutant printed 172800 of them, which is
   * CLAUDE.md's "a check that bites but fails uselessly is half a check" in its
   * loudest possible form.
   */
  LADDER_LIST_EXAMPLES: 8,
  /** The fragmenting control's window and its two collection cadences, in seconds. */
  FRAGMENT_SECONDS: 600,
  FRAGMENT_WHOLE_TICK: 1,
  FRAGMENT_HALF_TICK: 0.5,

  // ---------------------------------------------------------------------------
  // The PAST-THE-CAP domain, added with the 2026-08-18 Option B ruling. Every
  // constant below parameterises a sweep over schedules whose gaps can exceed
  // `CATCH_UP_CAP_SECONDS`, which no constant above can produce: the widest gap
  // the sub-cap sweeps can draw is `HORIZON_SECONDS`, five hundred-odd times
  // inside the cap, and that is asserted in the invariance test's own body.
  // ---------------------------------------------------------------------------

  /**
   * The wall window the capped pairing sweep draws schedules from: one day, so
   * a three-visit schedule sometimes leaves a gap past the twelve-hour cap and
   * sometimes does not — both halves of the domain in one seeded draw, with the
   * split pinned rather than hoped for. A two-day window was tried first and
   * measured 10 past-cap of 10: every pair capped, the sub-cap byte-identity
   * arm covering nothing, which is the empty-domain shape this codebase keeps
   * recording. One day is where the same seed populates both halves.
   */
  CAPPED_PAIR_WINDOW_SECONDS: 24 * EMPIRE_TUNING.SECONDS_PER_HOUR,
  /** Seeded pairs the capped sweep enumerates. Few, because each simulates up to a day of gym. */
  CAPPED_PAIRS: 16,
  /** Visits in a capped base schedule, before the extra one is inserted. */
  CAPPED_VISITS_PER_SCHEDULE: 3,
  /**
   * The capped walk: a floor read ONCE A DAY for five days, so every single
   * advance is a capped one — the exact suspended-tab cadence the ruling is
   * about, driven through the same walk machinery as the three 1-second walks.
   */
  CAPPED_WALK_STEP_SECONDS: EMPIRE_TUNING.SECONDS_PER_DAY,
  CAPPED_WALK_HORIZON_SECONDS: 5 * EMPIRE_TUNING.SECONDS_PER_DAY,
  /**
   * The ruling's own freeze ladder — 24 h, 72 h, 1 week, 30 days, 1 year — the
   * jumps the unbounded loop was measured at (160 ms / 505 ms / 1.31 s / 6.7 s /
   * 97.2 s at ef1a3f2). The test that walks it pins the ARITHMETIC bound: every
   * rung owes the same `CATCH_UP_CAP_SECONDS` of steps, so the freeze is the
   * cap's own cost whatever the jump. Wall-clock milliseconds are deliberately
   * not asserted — a timing assertion measures the box — and live in
   * `empireFloor.ts`'s docstring as the measurement the ruling was made on.
   */
  JUMP_LADDER_SECONDS: Object.freeze([
    EMPIRE_TUNING.SECONDS_PER_DAY,
    3 * EMPIRE_TUNING.SECONDS_PER_DAY,
    7 * EMPIRE_TUNING.SECONDS_PER_DAY,
    30 * EMPIRE_TUNING.SECONDS_PER_DAY,
    365 * EMPIRE_TUNING.SECONDS_PER_DAY,
  ]),
});

/**
 * The horizons the §12.3 pairing is re-enumerated at: the ones long enough for
 * this gym to have committed money.
 *
 * Derived from the walk's own horizon list by the threshold rather than written
 * out a second time, so the pairing cannot end up asking about a different set
 * than the walk does. Pinned in the scope guard beside the list it comes from.
 */
const LONG_PAIR_HORIZONS = FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS.filter(
  (horizon) => horizon > FLOOR_SWEEP.PAIR_LONG_HORIZON_ABOVE_SECONDS,
);

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

/**
 * The widest wall gap a call schedule holds, in whole seconds, opened at zero.
 *
 * The same flooring `elapsedSecondsBetween` applies, so "past the cap" here is
 * the same question `advanceEmpireFloor` answers — a schedule whose widest gap
 * is at most `CATCH_UP_CAP_SECONDS` never forfeits, and one past it must.
 */
function widestGapSecondsOf(scheduleMs: readonly number[]): number {
  let widest = 0;
  let previous = 0;
  for (const at of scheduleMs) {
    const seconds = Math.floor(at / EMPIRE_FLOOR.MILLISECONDS_PER_SECOND);
    if (seconds - previous > widest) widest = seconds - previous;
    if (seconds > previous) previous = seconds;
  }
  return widest;
}

/** Everything about a floor that a comparison should care about. */
const shapeOf = (floor: EmpireFloor): string =>
  JSON.stringify({
    openSeconds: floor.openSeconds,
    gymSeconds: floor.gymSeconds,
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
 *   - A LADDER RUNG. `equipment` is a position on `EQUIPMENT_TIERS`, compared
 *     by index the way `empireCore.ts` compares it, so the claim is that the
 *     floor only ever climbs and never draws a name that is off the ladder.
 *   - THE FORFEIT. `forfeitedSeconds` is the away summary the 2026-08-18 Option
 *     B ruling added: wall time past `CATCH_UP_CAP_SECONDS` that was
 *     acknowledged and not simulated. Over one floor's lifetime it is a counter
 *     — both clocks it differences only move forward — so the walk holds it
 *     non-decreasing like the cumulative three. It gets its OWN class rather
 *     than joining them because its direction INVERTS between the two kinds of
 *     claim this file makes: over time more forfeit is just history, but
 *     between two players read at the same instant, the more-engaged one must
 *     never hold MORE of it — forfeit is the one reading where a §12.3
 *     violation is a rise, not a fall. Lumping it with the counters would have
 *     made the pairing sweep assert the wrong direction on it, silently.
 *
 * ===========================================================================
 * THE FIFTH CLASS USED TO SAY "CATEGORICAL … IT IS NOT ORDERED", AND THAT
 * SENTENCE WAS FALSE
 * ===========================================================================
 * It is deleted rather than softened, because it was not a description of the
 * row — it was the sole reason `equipment` sat outside the only walk that could
 * have caught a hardcode, and the exclusion it justified was measured to be
 * exactly that hole. Replacing `floor.gym.state.axes.equipment` with the
 * literal `'bare-bar'` in `empireFloor.ts` left this file, the whole of
 * `src/shell` and `guaranteeTags.test.ts` at 137 passed, exit 0, with `tsc`
 * clean. The sibling one line up — `roster` — reddens instantly, and so do the
 * other four rows.
 *
 * The ladder is real and the tree already relies on it in three places:
 * `EMPIRE_TUNING.EQUIPMENT_TIERS` documents itself as "the order is the
 * ladder", its prices are strictly increasing, and `empireCore.ts`'s state
 * validator compares two rungs with `tiers.indexOf(settled) >
 * tiers.indexOf(live)`. GDD §5.4 writes the axis as a ladder in its own table.
 * So the ordering was never in doubt; only this file's use of it was missing.
 *
 * `rungIndexOf` below is that same `indexOf`, and it is the whole mechanism:
 * a claim about how the row MOVES is one no constant can satisfy, whereas a
 * value pinned at more instants is the hardcode written twice.
 */
const CUMULATIVE_READINGS = Object.freeze(['reputation', 'roster', 'clockSeconds'] as const);
const BALANCE_READING = 'gymBucks' as const;
const SAWTOOTH_READING = 'pendingGymBucks' as const;
const FORFEIT_READING = 'forfeitedSeconds' as const;
const LADDER_READINGS = Object.freeze(['equipment'] as const);
const NUMERIC_READINGS = Object.freeze([
  BALANCE_READING,
  SAWTOOTH_READING,
  FORFEIT_READING,
  ...CUMULATIVE_READINGS,
] as const);

type NumericReading = (typeof NUMERIC_READINGS)[number];

/**
 * Where a rung name sits on GDD §5.4's equipment ladder, or -1 if it is not on
 * it at all.
 *
 * `EMPIRE_TUNING.EQUIPMENT_TIERS`' own order, read through the same
 * `tiers.indexOf` comparison `empireCore.ts` validates a decoded gym with. Not
 * a second ladder written down here: this file imports §5's table and asks it
 * where a name sits, so a rung added to §5.4 is ordered here without anything
 * being edited.
 */
const rungIndexOf = (rung: string): number =>
  (EMPIRE_TUNING.EQUIPMENT_TIERS as readonly string[]).indexOf(rung);

/**
 * How many §5.3 recruitments, §5.4 rungs and roster promotions this gym has
 * committed to.
 *
 * `purchasesMade` IS `src/empire/`'s OWN, imported rather than re-implemented.
 * A byte-identical copy of it lived here and drifting copies are invisible —
 * CLAUDE.md's rule is that a guard written for one thing reads its sibling
 * instead of copying it, and this file already imports from that module.
 * `EmpireGym.recruits` counts lifters who have JOINED and `pending` those still
 * on their timer, so the sum moves when a recruitment BEGINS — when the money
 * leaves — and stays put when one completes. That is the moment a fall in the
 * balance is allowed to happen at.
 */
const purchasesMadeBy = (floor: EmpireFloor): number => purchasesMade(floor.gym);

/** What one second-by-second walk of the floor saw. Counts, never bounds. */
interface FloorWalk {
  readonly read: number;
  readonly decreases: Readonly<Record<NumericReading, number>>;
  readonly increases: Readonly<Record<NumericReading, number>>;
  /** Steps at which the gym committed to a recruit, a rung or a promotion. */
  readonly purchaseMoments: number;
  /**
   * The instants, in whole seconds, those commitments happened at.
   *
   * Recorded so the §12.3 pairing further down can AIM an extra look at the
   * moment the money moves instead of hoping a random one lands there. It is
   * not pinned anywhere: `purchaseMoments` already pins how many there are, and
   * a second pin on the same events would be a count restating a list.
   */
  readonly purchaseInstants: readonly number[];
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
  /**
   * Every fall of the FORFEIT reading, as text. Expected empty at every horizon
   * and at every step size: both clocks it differences only move forwards, so a
   * fall here is the away summary handing forfeited time back. Its own list
   * rather than a `counterFalls` member because the class is its own — see the
   * classification header for the direction inversion that keeps it out of
   * `CUMULATIVE_READINGS`.
   */
  readonly forfeitFalls: readonly string[];
  /**
   * Steps at which the equipment row moved DOWN `EQUIPMENT_TIERS`. THE LADDER
   * SAFETY LIST, and a list rather than a count so a failure names the instant
   * and both rungs. Capped at `LADDER_LIST_EXAMPLES`; see that constant for why
   * a cap on an emptiness check hides nothing.
   */
  readonly rungsDescended: readonly string[];
  /**
   * Readings whose rung name is not on `EQUIPMENT_TIERS` at all, capped the
   * same way and for the same reason.
   *
   * A SEPARATE FACT FROM THE ONE ABOVE, and neither implies it: a row stuck on
   * one off-ladder name never moves, so nothing descends while every reading is
   * off the ladder; and a real rung sliding back down the ladder is a descent
   * with nothing off it. Two ways for this row to be wrong, two lists.
   */
  readonly rungsOffTheLadder: readonly string[];
  /**
   * Steps at which the rung changed at all, in either direction.
   *
   * DELIBERATELY DIRECTIONLESS. If this record carried which way each change
   * went, pinning it would imply `rungsDescended` outright and leave that check
   * unable to speak — the same domination the `balanceFalls` record above is
   * shaped to avoid. This one says the row MOVED; that one says no move was
   * backwards.
   */
  readonly rungChanges: number;
  /** How many distinct rung names the walk drew. */
  readonly rungsSeen: number;
}

const WALKS = new Map<string, FloorWalk>();

/**
 * One walk to `horizonSeconds` at `stepSeconds` a read, memoised.
 *
 * Memoised because four separate claims below are about the same walk and
 * re-running it four times would be four times the cost for the same numbers.
 * It is a pure function of its arguments — `empireFloorAfter` opens a fresh gym
 * — so the cache cannot leak state between tests.
 *
 * `stepSeconds` defaults to the 1-second grain every pre-cap claim was taken
 * at. The capped walk hands it a whole day, which makes every advance a capped
 * one — same machinery, same records, different domain.
 */
function walkTo(
  horizonSeconds: number,
  stepSeconds: number = FLOOR_SWEEP.MONOTONE_STEP_SECONDS,
): FloorWalk {
  const key = `${stepSeconds}x${horizonSeconds}`;
  const cached = WALKS.get(key);
  if (cached !== undefined) return cached;

  const decreases: Record<NumericReading, number> = {
    gymBucks: 0,
    pendingGymBucks: 0,
    forfeitedSeconds: 0,
    reputation: 0,
    roster: 0,
    clockSeconds: 0,
  };
  const increases: Record<NumericReading, number> = { ...decreases };
  const balanceFalls: string[] = [];
  const balanceFallsWithNoPurchase: string[] = [];
  const counterFalls: string[] = [];
  const forfeitFalls: string[] = [];
  const purchaseInstants: number[] = [];
  const rungsDescended: string[] = [];
  const rungsOffTheLadder: string[] = [];
  const rungNames = new Set<string>();
  let read = 0;
  let purchaseMoments = 0;
  let checkInMoments = 0;
  let sawtoothResetsAtACheckIn = 0;
  let sawtoothFallsAwayFromACheckIn = 0;
  let widestPendingGapSeconds = 0;
  let cappedReadings = 0;
  let rungChanges = 0;

  let previous = empireFloorAfter(0);
  // THE OPENING RUNG IS READ BEFORE THE WALK STARTS, so a floor that draws an
  // off-ladder name from the first instant and never moves is caught. Reading
  // only the `after` of each step would leave the opening reading unexamined,
  // which is the one a hardcoded row is most likely to be.
  const keepExample = (list: string[], line: string): void => {
    if (list.length < FLOOR_SWEEP.LADDER_LIST_EXAMPLES) list.push(line);
  };
  {
    const opening = empireFloorReadings(previous).equipment;
    rungNames.add(opening);
    if (rungIndexOf(opening) < 0) {
      keepExample(rungsOffTheLadder, `at 0s ${opening} is not a rung on EQUIPMENT_TIERS`);
    }
  }
  for (let at = stepSeconds; at <= horizonSeconds; at += stepSeconds) {
    const now = advanceEmpireFloor(previous, at * EMPIRE_FLOOR.MILLISECONDS_PER_SECOND);
    read += 1;
    const before = empireFloorReadings(previous);
    const after = empireFloorReadings(now);
    const bought = purchasesMadeBy(now) > purchasesMadeBy(previous);
    const checkedIn = now.checkIns > previous.checkIns;
    if (bought) {
      purchaseMoments += 1;
      purchaseInstants.push(at);
    }
    if (checkedIn) checkInMoments += 1;

    // THE LADDER, read by index rather than by equality. `rungIndexOf` is
    // `EQUIPMENT_TIERS`' own order, so "the row went backwards" is a question
    // about §5's table and not about alphabetical accident.
    for (const key of LADDER_READINGS) {
      rungNames.add(after[key]);
      if (rungIndexOf(after[key]) < 0) {
        keepExample(rungsOffTheLadder, `at ${at}s ${after[key]} is not a rung on EQUIPMENT_TIERS`);
      }
      if (after[key] !== before[key]) {
        rungChanges += 1;
        if (rungIndexOf(after[key]) < rungIndexOf(before[key])) {
          keepExample(
            rungsDescended,
            `at ${at}s ${key} ${before[key]} -> ${after[key]}, down the ladder`,
          );
        }
      }
    }

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
        if (key === FORFEIT_READING) forfeitFalls.push(where);
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
    purchaseInstants: Object.freeze(purchaseInstants),
    checkInMoments,
    balanceFalls: Object.freeze(balanceFalls),
    balanceFallsWithNoPurchase: Object.freeze(balanceFallsWithNoPurchase),
    counterFalls: Object.freeze(counterFalls),
    forfeitFalls: Object.freeze(forfeitFalls),
    rungsDescended: Object.freeze(rungsDescended),
    rungsOffTheLadder: Object.freeze(rungsOffTheLadder),
    rungChanges,
    rungsSeen: rungNames.size,
    sawtoothResetsAtACheckIn,
    sawtoothFallsAwayFromACheckIn,
    widestPendingGapSeconds,
    cappedReadings,
  });
  WALKS.set(key, walk);
  return walk;
}

// ---------------------------------------------------------------------------
// THE CANONICAL TRAJECTORY — what "further along the same path" resolves against
// ---------------------------------------------------------------------------

/**
 * The gym after exactly `checkIns` check-ins, taken at the readings the floor
 * always hands out: `checkInReadingAt(1)` up to `checkInReadingAt(checkIns)`.
 *
 * THE ONE FOLD EVERY FLOOR IS A PREFIX-READ OF. `advanceEmpireFloor` numbers
 * its check-ins from one at fixed readings whatever the wall clock did, so a
 * floor's gym is decided by its `checkIns` count alone — which is what turns
 * "the extra look never lands you behind" from a claim about forty readings
 * into a claim about one integer plus this identity. The capped sweeps assert
 * both halves: the count is monotone in looks, and every gym IS this fold read
 * at its own count, byte for byte.
 *
 * NOT `empireFloorAfter(checkInReadingAt(k))`, deliberately: that is one
 * advance, which the cap clamps past `CATCH_UP_CAP_SECONDS`, so it cannot reach
 * the far end of the trajectory the capped pairs live on. This is the same
 * fold built the way the naive control builds gyms — `stepGym` directly, §5's
 * own function — memoised incrementally because the sweeps ask for many
 * prefixes of one path.
 */
const CANONICAL_TRAJECTORY: EmpireGym[] = [createEmpireGym()];
function canonicalGymAt(checkIns: number): EmpireGym {
  for (let k = CANONICAL_TRAJECTORY.length; k <= checkIns; k += 1) {
    const previous = CANONICAL_TRAJECTORY[k - 1];
    if (previous === undefined) throw new Error(`canonical trajectory has no gym at ${k - 1}`);
    CANONICAL_TRAJECTORY[k] = stepGym(previous, EMPIRE_FLOOR_POLICY, checkInReadingAt(k), null, 0);
  }
  const gym = CANONICAL_TRAJECTORY[checkIns];
  if (gym === undefined) throw new Error(`canonical trajectory has no gym at ${checkIns}`);
  return gym;
}

/**
 * Every way `diligent` could read WORSE than `idle` for a player, at one shared
 * instant, as a list of faults — empty when §12.3 holds for the pair.
 *
 * WHAT IS COMPARED AND WHAT DELIBERATELY IS NOT. The counters, the rung and
 * the forfeit are compared directly: more looks may never mean less
 * reputation, a shorter roster, an older clock, a lower rung, or MORE
 * forfeited time (the forfeit is the one reading whose punishing direction is
 * a rise — see the classification header). The BALANCE and the SAWTOOTH are
 * not compared raw, and that is a §5.1 fact rather than a soft spot: spending
 * is the loop's second verb, so a gym that is strictly further along can hold
 * less cash because it has bought more. What protects those two rows instead
 * is the trajectory identity below — both gyms are the SAME fold read at their
 * own counts, so the diligent player's balance is a value the idle player's
 * own future holds, purchases and all — plus the walks' per-class claims about
 * how each row may move along that one path.
 */
function punishingFaults(idle: EmpireFloor, diligent: EmpireFloor, where: string): string[] {
  const faults: string[] = [];
  if (diligent.checkIns < idle.checkIns) {
    faults.push(`${where}: the extra look LOST check-ins, ${diligent.checkIns} < ${idle.checkIns}`);
  }
  if (diligent.gymSeconds < idle.gymSeconds) {
    faults.push(`${where}: the extra look SIMULATED LESS, ${diligent.gymSeconds} < ${idle.gymSeconds}`);
  }
  if (forfeitedAwaySeconds(diligent) > forfeitedAwaySeconds(idle)) {
    faults.push(
      `${where}: the extra look FORFEITED MORE, ` +
        `${forfeitedAwaySeconds(diligent)} > ${forfeitedAwaySeconds(idle)}`,
    );
  }
  const before = empireFloorReadings(idle);
  const after = empireFloorReadings(diligent);
  for (const key of CUMULATIVE_READINGS) {
    if (Number(after[key]) < Number(before[key])) {
      faults.push(`${where}: ${key} ${before[key]} -> ${after[key]} on the extra look`);
    }
  }
  for (const key of LADDER_READINGS) {
    if (rungIndexOf(after[key]) < rungIndexOf(before[key])) {
      faults.push(`${where}: ${key} ${before[key]} -> ${after[key]}, down the ladder, on the extra look`);
    }
  }
  for (const [name, floor] of [
    ['idle', idle],
    ['diligent', diligent],
  ] as const) {
    if (JSON.stringify(floor.gym) !== JSON.stringify(canonicalGymAt(floor.checkIns))) {
      faults.push(
        `${where}: the ${name} gym at ${floor.checkIns} check-ins is OFF the canonical trajectory, ` +
          'so "further along the same path" no longer covers its balance',
      );
    }
  }
  return faults;
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

describe('the floor is a function of elapsed time and of nothing else — BELOW THE CAP', () => {
  /**
   * The test `empireFloor.ts`'s first guarantee tag names, and THE PROPERTY IS
   * RESTATED SINCE THE 2026-08-18 CAP RULING rather than re-pinned. It used to
   * quantify over every schedule; under the cap that is false by design — a
   * gap past `CATCH_UP_CAP_SECONDS` forfeits, so where the calls fell decides
   * what was forfeited. What survives, exactly, is the original equality on
   * the domain where no gap exceeds the cap, and that domain is asserted in
   * this body rather than implied: the whole window these schedules are drawn
   * from is smaller than the cap, so every gap they can produce is sub-cap by
   * construction. The other half of the restated property — past the cap, more
   * looks never land behind, strictly ahead pinned live — is the capped
   * pairing sweep further down, under its own tag.
   *
   * Random call schedules against the one-shot value. Counts, not bounds: the
   * comparisons made and the distinct floors seen are both pinned, so a sweep
   * whose generator stopped producing anything reports an empty domain instead
   * of agreeing with it.
   */
  it('below the cap, any schedule of calls lands on the value one call would have produced [below-the-cap-the-floor-is-a-function-of-elapsed-time]', () => {
    // THE DOMAIN, ASSERTED. Every gap a schedule in this sweep can hold is at
    // most the whole window, and the window sits far inside the cap — so the
    // zero mismatches below is a zero about the sub-cap domain, stated rather
    // than discovered later to have quietly covered nothing.
    expect(FLOOR_SWEEP.HORIZON_SECONDS).toBeLessThan(CATCH_UP_CAP_SECONDS);
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
    expect([...NUMERIC_READINGS, ...LADDER_READINGS].sort()).toEqual(
      Object.keys(empireFloorReadings(empireFloorAfter(0))).sort(),
    );
    expect(
      [BALANCE_READING, SAWTOOTH_READING, FORFEIT_READING, ...CUMULATIVE_READINGS].sort(),
    ).toEqual([...NUMERIC_READINGS].sort());
    // ...and the walk really reads all of them, at every horizon it is asked
    // about, rather than skipping one whose counter stayed at zero.
    expect(FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS).toEqual([240, 43_200, 86_400]);
    // ...and the subset the §12.3 pairing re-enumerates at. NOT IMPLIED BY THE
    // LINE ABOVE: it is that list filtered by `PAIR_LONG_HORIZON_ABOVE_SECONDS`,
    // so moving the threshold reddens this and leaves the walk's list alone.
    expect(LONG_PAIR_HORIZONS).toEqual([43_200, 86_400]);
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

  it('EQUIPMENT is a rung, and the floor only ever climbs the ladder it is on [the-equipment-row-is-a-rung-the-gym-climbs]', () => {
    // =====================================================================
    // THE CLAIM A CONSTANT CANNOT SATISFY, WHICH IS THE WHOLE POINT OF IT
    // =====================================================================
    // This row was excluded from the walk on the stated grounds that a rung
    // name "is not ordered". It is ordered — by `EQUIPMENT_TIERS`, which
    // `empireCore.ts` already compares two gyms with — and the exclusion was
    // the one hole in this file: hardcoding the row to the literal it draws on
    // arrival left every test in `src/shell` green.
    //
    // So what is asserted is how the row MOVES, in three facts none of which
    // implies another:
    //
    //   - it never goes DOWN the ladder (the safety list, empty everywhere);
    //   - every name it draws is ON the ladder (a stuck off-ladder row never
    //     descends, so the list above cannot see it);
    //   - and it MOVES, once, inside a day (the census, which is what a
    //     hardcode reddens — a constant draws one rung and changes never).
    //
    // WHY THE CENSUS CARRIES NO DIRECTION. If it said which way the change
    // went, pinning it would imply the safety list and leave that check unable
    // to speak. Same separation as `balanceFalls` against
    // `balanceFallsWithNoPurchase` above.
    //
    // WHAT THIS CANNOT SEE, measured rather than assumed. The floor spends no
    // accelerant, so `state.axes.equipment` and `state.settledAxes.equipment`
    // hold the same rung at every instant of this walk — drawing the settled
    // view instead would be invisible here. That is a real limit of this
    // surface rather than of the claim: §5 only parts the two views when a
    // §8.3B skip is spent, and this module never spends one (pinned by "spends
    // nothing on an accelerant" below).
    const descended = FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS.flatMap(
      (horizon) => walkTo(horizon).rungsDescended,
    );
    expect(descended, descended.slice(0, 4).join('\n')).toEqual([]);
    // ...and the other way this row can be wrong, which the list above cannot
    // reach: a name that is on no rung at all.
    const offTheLadder = FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS.flatMap(
      (horizon) => walkTo(horizon).rungsOffTheLadder,
    );
    expect(offTheLadder, offTheLadder.slice(0, 4).join('\n')).toEqual([]);
    // THE CENSUS, AND IT IS THE ASSERTION THE HARDCODE REDDENS. Counts and not
    // bounds: a row that stopped moving reports one rung and no change instead
    // of quietly agreeing with the two empty lists above.
    expect(
      FLOOR_SWEEP.MONOTONE_HORIZONS_SECONDS.map((horizon) => {
        const walk = walkTo(horizon);
        return `${horizon}s: ${walk.read} read, ${walk.rungsSeen} rung(s) drawn, ${walk.rungChanges} change(s)`;
      }),
    ).toEqual([
      '240s: 240 read, 1 rung(s) drawn, 0 change(s)',
      '43200s: 43200 read, 1 rung(s) drawn, 0 change(s)',
      '86400s: 86400 read, 2 rung(s) drawn, 1 change(s)',
    ]);
  });

  it('an extra visit changes nothing at the horizons where the gym SPENDS, either', () => {
    // THE REASON THE WIDENED WALK ABOVE IS NOT A §12.3 FINDING, CHECKED RATHER
    // THAN ASSERTED. The pairing at the top of this block enumerates 30 s to
    // 300 s, where this gym never buys anything — so it could not have said
    // whether the DROP is engagement-sensitive. This re-enumerates the same
    // construction at the two long horizons, where it is.
    //
    // =====================================================================
    // `withAPurchase` WAS THE NAME OF THIS COUNT AND IT MISDESCRIBED IT
    // =====================================================================
    // It was introduced as "the non-vacuity that matters here", and the
    // emptiness that matters is whether the EXTRA LOOK lands anywhere near the
    // moment the money moves. It never measured that. It counted pairs whose
    // floors reached a commitment at some point in the window, which at these
    // horizons is nearly all of them and says nothing about where the extra
    // look fell.
    //
    // BOTH READINGS ARE KEPT AND BOTH ARE NAMED FOR WHAT THEY MEASURE, because
    // the second is the honest disclosure that the first was standing in for:
    // `reachedACommitment` is 7 and 8 of 8, and `lookedWithinACheckIn` — the
    // extra look landing within one `CHECK_IN_SECONDS` of a commitment instant
    // — is 0 and 0. Deepening the random draw does not fix that; at 400 pairs
    // per horizon it measures 0 and 1. The zeros are pinned rather than removed
    // so the gap reports itself, and the test below is what covers it, by
    // AIMING the extra look instead of hoping.
    // SINCE THE CAP, "changes nothing" IS ONLY THE SUB-CAP HALF OF THE CLAIM,
    // so each pair also reports whether its idle schedule holds a gap past
    // `CATCH_UP_CAP_SECONDS`. At the twelve-hour horizon no schedule can — the
    // whole window is the cap — and at twenty-four hours this seeded draw
    // happens to produce none either (six visits in a day rarely leave a
    // twelve-hour hole), so the zeros here are still the old equality on its
    // own domain, and the census is what SAYS so instead of leaving the reader
    // to assume it. The past-cap domain these two horizons cannot reach is the
    // aimed test's below (one past-cap base, three differing pairs) and the
    // capped pairing sweep's. Any pair that DID differ here would have to be
    // diligent-ahead, and that is asserted rather than assumed.
    const punishing: string[] = [];
    const observed = LONG_PAIR_HORIZONS.map((horizon) => {
      const random = generator(FLOOR_SWEEP.SEED);
      const commitments = walkTo(horizon).purchaseInstants;
      let pairs = 0;
      let differing = 0;
      let pastCapBases = 0;
      let reachedACommitment = 0;
      let lookedWithinACheckIn = 0;
      for (let index = 0; index < FLOOR_SWEEP.LONG_PAIRS_PER_HORIZON; index += 1) {
        const base = scheduleOf(random, FLOOR_SWEEP.VISITS_PER_SCHEDULE, horizon);
        const extra = Math.floor(random() * horizon * EMPIRE_FLOOR.MILLISECONDS_PER_SECOND);
        const end = Math.max(base[base.length - 1] ?? 0, extra);
        const idleSchedule = [...base, end].sort((a, b) => a - b);
        const idle = floorAfterSchedule(idleSchedule);
        const diligent = floorAfterSchedule([...base, extra, end].sort((a, b) => a - b));
        pairs += 1;
        if (widestGapSecondsOf(idleSchedule) > CATCH_UP_CAP_SECONDS) pastCapBases += 1;
        if (shapeOf(idle) !== shapeOf(diligent)) differing += 1;
        punishing.push(...punishingFaults(idle, diligent, `horizon ${horizon}s, pair ${index}`));
        if (purchasesMadeBy(idle) > 0) reachedACommitment += 1;
        const extraSeconds = extra / EMPIRE_FLOOR.MILLISECONDS_PER_SECOND;
        if (
          commitments.some(
            (at) => Math.abs(extraSeconds - at) <= EMPIRE_FLOOR.CHECK_IN_SECONDS,
          )
        ) {
          lookedWithinACheckIn += 1;
        }
      }
      return (
        `${horizon}s: ${differing} of ${pairs} pairs differ (${pastCapBases} past-cap base(s)), ` +
        `${reachedACommitment} reached a commitment, ${lookedWithinACheckIn} looked within a ` +
        'check-in of one'
      );
    });
    expect(punishing, punishing.slice(0, 4).join('\n')).toEqual([]);
    expect(observed).toEqual([
      '43200s: 0 of 8 pairs differ (0 past-cap base(s)), 7 reached a commitment, 0 looked within a check-in of one',
      '86400s: 0 of 8 pairs differ (0 past-cap base(s)), 8 reached a commitment, 0 looked within a check-in of one',
    ]);
  });

  it('and an extra visit AIMED at the instant the gym commits its money changes nothing either', () => {
    // THE DOMAIN THE RANDOM DRAW ABOVE CANNOT REACH, ENUMERATED INSTEAD OF
    // SAMPLED. Every commitment instant the walk saw, with the extra look
    // placed just before it, exactly on it, and just after it — the three
    // positions from which an extra check-in could plausibly perturb a
    // purchase. A commitment instant is a multiple of `CHECK_IN_SECONDS`, so
    // the middle offset is an extra look landing on the very check-in that
    // spends the money and the outer two are mid-gap on either side.
    //
    // The instants are read off the walk rather than transcribed, so a re-tune
    // that moves them aims at the new ones. An engine that stopped committing
    // anything reports `0 of 0 aimed pairs, over 0 commitment instant(s)` and
    // reddens, which is how an empty domain is supposed to look from outside.
    // SINCE THE CAP, AN AIMED LOOK ON A PAST-CAP BASE IS ALLOWED TO MOVE THE
    // FLOOR — in one direction. A base schedule at the twenty-four-hour horizon
    // can hold a gap past `CATCH_UP_CAP_SECONDS`, and an extra look inside that
    // gap splits it, simulates more of it, and lands the diligent player
    // strictly ahead. So "differ" is no longer the failure; a differing pair
    // whose diligent side reads WORSE on any §12.3 axis is, and every differing
    // pair is driven through `punishingFaults` — counters, rung, forfeit
    // direction and the canonical-trajectory identity — with the split of the
    // aimed domain (how many bases held a past-cap gap) pinned beside the
    // count so the differing pairs are read against the domain that produced
    // them.
    const punishing: string[] = [];
    const aimed = LONG_PAIR_HORIZONS.map((horizon) => {
      const random = generator(FLOOR_SWEEP.SEED);
      const commitments = walkTo(horizon).purchaseInstants;
      let pairs = 0;
      let differing = 0;
      let pastCapBases = 0;
      for (const at of commitments) {
        const base = scheduleOf(random, FLOOR_SWEEP.VISITS_PER_SCHEDULE, horizon);
        if (
          widestGapSecondsOf([...base, horizon * EMPIRE_FLOOR.MILLISECONDS_PER_SECOND]) >
          CATCH_UP_CAP_SECONDS
        ) {
          pastCapBases += 1;
        }
        for (const offset of FLOOR_SWEEP.AIMED_OFFSETS_SECONDS) {
          const extra = (at + offset) * EMPIRE_FLOOR.MILLISECONDS_PER_SECOND;
          const end = Math.max(base[base.length - 1] ?? 0, extra);
          const idle = floorAfterSchedule([...base, end].sort((a, b) => a - b));
          const diligent = floorAfterSchedule([...base, extra, end].sort((a, b) => a - b));
          pairs += 1;
          if (shapeOf(idle) !== shapeOf(diligent)) differing += 1;
          punishing.push(
            ...punishingFaults(idle, diligent, `horizon ${horizon}s, aimed at ${at}s${offset >= 0 ? '+' : ''}${offset}`),
          );
        }
      }
      return (
        `${horizon}s: ${differing} of ${pairs} aimed pairs differ, over ` +
        `${commitments.length} commitment instant(s), ${pastCapBases} past-cap base(s)`
      );
    });
    expect(punishing, punishing.slice(0, 4).join('\n')).toEqual([]);
    expect(aimed).toEqual([
      '43200s: 0 of 6 aimed pairs differ, over 2 commitment instant(s), 0 past-cap base(s)',
      '86400s: 3 of 15 aimed pairs differ, over 5 commitment instant(s), 1 past-cap base(s)',
    ]);
  });

  // ===========================================================================
  // PAST THE CAP — the domain the 2026-08-18 Option B ruling created, swept
  // ===========================================================================

  /**
   * The test `empireFloor.ts`'s second guarantee tag names, and the restated
   * half of the old path-independence property. Two schedules over the same
   * wall span, identical except for one extra look, both read at the same final
   * instant, over a window wide enough that gaps regularly exceed
   * `CATCH_UP_CAP_SECONDS`. Four counts pinned, none a bound:
   *
   *   - the PUNISHING direction is a fault list, expected empty — check-ins,
   *     simulated seconds, every counter, the rung, the forfeit's own inverted
   *     direction, and the canonical-trajectory identity that carries the
   *     balance claim (see `punishingFaults` for why the balance is not
   *     compared raw);
   *   - STRICTLY AHEAD is pinned non-zero and exact — the cap's reward
   *     direction is alive in the sampled domain, not merely unviolated;
   *   - the pairs whose gaps all sit under the cap are pinned BYTE-IDENTICAL —
   *     the old equality, surviving on exactly the domain it still owns;
   *   - and the domain split itself is pinned, so a re-seed that quietly
   *     stopped producing past-cap gaps is a red census, not a vacuous zero.
   */
  it('past the cap, a schedule with more looks never lands behind — and strictly ahead is live [past-the-cap-more-looks-never-land-behind]', () => {
    const random = generator(FLOOR_SWEEP.SEED);
    const faults: string[] = [];
    const subCapDiffering: string[] = [];
    let pairs = 0;
    let identical = 0;
    let ahead = 0;
    let pastCapPairs = 0;
    let subCapPairs = 0;
    let forfeitedStrictlyLess = 0;
    for (let index = 0; index < FLOOR_SWEEP.CAPPED_PAIRS; index += 1) {
      const base = scheduleOf(
        random,
        FLOOR_SWEEP.CAPPED_VISITS_PER_SCHEDULE,
        FLOOR_SWEEP.CAPPED_PAIR_WINDOW_SECONDS,
      );
      const extra = Math.floor(
        random() * FLOOR_SWEEP.CAPPED_PAIR_WINDOW_SECONDS * EMPIRE_FLOOR.MILLISECONDS_PER_SECOND,
      );
      const end = Math.max(base[base.length - 1] ?? 0, extra);
      const idleSchedule = [...base, end].sort((a, b) => a - b);
      const diligentSchedule = [...base, extra, end].sort((a, b) => a - b);
      const idle = floorAfterSchedule(idleSchedule);
      const diligent = floorAfterSchedule(diligentSchedule);
      pairs += 1;

      // The domain census: a pair is past-cap if either schedule holds a gap
      // the clamp would forfeit on. Counted off the schedules, not the floors,
      // so the census cannot be circular about the thing it is a census of.
      const widest = Math.max(widestGapSecondsOf(idleSchedule), widestGapSecondsOf(diligentSchedule));
      if (widest > CATCH_UP_CAP_SECONDS) pastCapPairs += 1;
      else subCapPairs += 1;

      faults.push(...punishingFaults(idle, diligent, `pair ${index}`));
      if (shapeOf(idle) === shapeOf(diligent)) {
        identical += 1;
      } else {
        ahead += 1;
        if (forfeitedAwaySeconds(diligent) < forfeitedAwaySeconds(idle)) forfeitedStrictlyLess += 1;
      }
      // THE OLD PROPERTY, ON THE DOMAIN IT STILL OWNS: a pair whose every gap
      // is sub-cap must be byte-identical, extra look and all.
      if (widest <= CATCH_UP_CAP_SECONDS && shapeOf(idle) !== shapeOf(diligent)) {
        subCapDiffering.push(`pair ${index}: no gap past the cap, and the extra look still moved the floor`);
      }
    }
    expect(faults, faults.slice(0, 6).join('\n')).toEqual([]);
    expect(subCapDiffering, subCapDiffering.join('\n')).toEqual([]);
    expect(pairs).toBe(FLOOR_SWEEP.CAPPED_PAIRS);
    // THE DOMAIN SPLIT, PINNED. Both halves are populated, so the empty fault
    // list above is about a domain that actually holds capped gaps, and the
    // byte-identity above is about one that actually holds sub-cap pairs.
    expect(`${pastCapPairs} past-cap, ${subCapPairs} sub-cap`).toBe('4 past-cap, 12 sub-cap');
    // THE REWARD DIRECTION, LIVE AND EXACT: three of the four past-cap pairs
    // end with the extra look STRICTLY ahead, and in every one of them it also
    // forfeited strictly less — the number the away row draws is itself
    // engagement-monotone here. The fourth past-cap pair is the honest
    // remainder: its extra look landed outside the long gap, so both floors
    // forfeited the same span and stayed byte-identical — an extra look only
    // helps when it actually splits an absence, and this seeded draw holds
    // both shapes.
    expect(`${ahead} strictly ahead, ${forfeitedStrictlyLess} forfeited strictly less`).toBe(
      '3 strictly ahead, 3 forfeited strictly less',
    );
    expect(identical + ahead).toBe(pairs);
  });

  /**
   * THE PAIR THE RULING WAS MADE ON, PINNED EXACTLY. Away a whole day: the
   * player who never looked has half the day simulated and half forfeited; the
   * player who looked once, at the cap boundary, has both halves run in full.
   * The extra look EARNS — double the check-ins, zero forfeit — and both gyms
   * are the one canonical fold read at their own counts, so everything either
   * screen draws comes off the same path.
   */
  it('the ruling’s own pair: away a whole day, one look at hour twelve keeps the whole day', () => {
    const capMs = CATCH_UP_CAP_SECONDS * EMPIRE_FLOOR.MILLISECONDS_PER_SECOND;
    const dayMs = EMPIRE_TUNING.SECONDS_PER_DAY * EMPIRE_FLOOR.MILLISECONDS_PER_SECOND;
    const absentee = advanceEmpireFloor(openEmpireFloor(0), dayMs);
    const visitor = advanceEmpireFloor(advanceEmpireFloor(openEmpireFloor(0), capMs), dayMs);

    // The absentee: wall clock honest, gym clock capped, the difference drawn.
    expect(absentee.openSeconds).toBe(86_400);
    expect(absentee.gymSeconds).toBe(43_200);
    expect(absentee.checkIns).toBe(4_320);
    expect(forfeitedAwaySeconds(absentee)).toBe(43_200);
    expect(catchUpWasCapped(absentee)).toBe(true);
    expect(empireFloorReadings(absentee).forfeitedSeconds).toBe('43200');

    // The visitor: two gaps of exactly the cap, neither forfeits anything.
    expect(visitor.openSeconds).toBe(86_400);
    expect(visitor.gymSeconds).toBe(86_400);
    expect(visitor.checkIns).toBe(8_640);
    expect(forfeitedAwaySeconds(visitor)).toBe(0);
    expect(catchUpWasCapped(visitor)).toBe(false);
    expect(empireFloorReadings(visitor).forfeitedSeconds).toBe('0');

    // The reward direction on the readings themselves, strictly — on the rows
    // that CAN still move: §5.4's reputation line reaches its ceiling inside
    // the cap's own span (both players read 5000 here, measured, which is why
    // reputation is the one counter asserted >= rather than >), so the strict
    // evidence is the roster and the gym clock, both of which the extra look
    // doubles the trajectory for.
    expect(visitor.gym.state.roster.length).toBeGreaterThan(absentee.gym.state.roster.length);
    expect(Number(empireFloorReadings(visitor).clockSeconds)).toBeGreaterThan(
      Number(empireFloorReadings(absentee).clockSeconds),
    );
    expect(visitor.gym.state.reputation).toBeGreaterThanOrEqual(absentee.gym.state.reputation);
    expect(visitor.gym.state.reputation).toBe(5_000);
    expect(punishingFaults(absentee, visitor, 'the ruling pair')).toEqual([]);

    // One trajectory, two read points: the §12.3 shape of the whole cap.
    expect(JSON.stringify(absentee.gym)).toBe(JSON.stringify(canonicalGymAt(4_320)));
    expect(JSON.stringify(visitor.gym)).toBe(JSON.stringify(canonicalGymAt(8_640)));
  });

  /**
   * THE FREEZE LADDER THE RULING QUOTED, RE-TAKEN AS ARITHMETIC. Under the
   * unbounded loop these five jumps cost 8,640 / 25,920 / 60,480 / 259,200 /
   * 3,153,600 steps (160 ms to 97.2 s at ef1a3f2, idle box); under the clamp
   * every one of them owes the same `CATCH_UP_CAP_SECONDS` of check-ins, so
   * the synchronous work a jump can demand is a constant of the tuning, not of
   * the absence. Wall-clock milliseconds are deliberately not asserted — a
   * timing pin measures the box — the step count IS the bound, and it is
   * pinned as the cap's own number so a tuning change meets friction here.
   */
  it('a jump of any size owes at most the cap: one day to one year all land on the same gym', () => {
    const capCheckIns = CATCH_UP_CAP_SECONDS / EMPIRE_FLOOR.CHECK_IN_SECONDS;
    expect(capCheckIns).toBe(4_320);
    const cappedGym = JSON.stringify(canonicalGymAt(capCheckIns));
    for (const jump of FLOOR_SWEEP.JUMP_LADDER_SECONDS) {
      const floor = empireFloorAfter(jump);
      expect(floor.checkIns, `check-ins owed by a ${jump}s jump`).toBe(capCheckIns);
      expect(floor.gymSeconds, `gym seconds after a ${jump}s jump`).toBe(CATCH_UP_CAP_SECONDS);
      expect(floor.openSeconds, `wall seconds after a ${jump}s jump`).toBe(jump);
      expect(forfeitedAwaySeconds(floor), `forfeit of a ${jump}s jump`).toBe(
        jump - CATCH_UP_CAP_SECONDS,
      );
      expect(catchUpWasCapped(floor)).toBe(true);
      // All five rungs land on the SAME gym — the fold at the cap — which is
      // what "time beyond the cap is acknowledged, not simulated" means.
      expect(JSON.stringify(floor.gym)).toBe(cappedGym);
      // ...and the INNER offline discard stayed quiet on every one of them:
      // a capped advance lands the gym clock on a check-in boundary, so the
      // previewed gap is zero and `production.ts` was never asked to discard.
      expect(pendingWasCapped(floor)).toBe(false);
      expect(floor.pending.gymBucks).toBe(0);
    }
    // The ladder really is the ruling's: a day, three days spelt as 72 hours in
    // the ruling, a week, thirty days, a year.
    expect(FLOOR_SWEEP.JUMP_LADDER_SECONDS).toEqual([86_400, 259_200, 604_800, 2_592_000, 31_536_000]);
  });

  /**
   * THE SUSPENDED-TAB CADENCE ITSELF: a floor read once a day for five days,
   * through the same walk machinery as the three 1-second walks, so every
   * class keeps its claim on the domain where every single advance is capped.
   * The counters still never fall, the forfeit never falls and rises at every
   * read, the balance falls only where the gym bought, the sawtooth resets
   * only at check-ins, the rung never descends — and the inner discard stays
   * at zero even here, which is the widest domain that claim now covers.
   */
  it('read once a day for five days, every reading still moves the right way', () => {
    const walk = walkTo(
      FLOOR_SWEEP.CAPPED_WALK_HORIZON_SECONDS,
      FLOOR_SWEEP.CAPPED_WALK_STEP_SECONDS,
    );
    expect(walk.counterFalls, walk.counterFalls.join('\n')).toEqual([]);
    expect(walk.forfeitFalls, walk.forfeitFalls.join('\n')).toEqual([]);
    expect(walk.balanceFallsWithNoPurchase, walk.balanceFallsWithNoPurchase.join('\n')).toEqual([]);
    expect(walk.rungsDescended, walk.rungsDescended.join('\n')).toEqual([]);
    expect(walk.rungsOffTheLadder, walk.rungsOffTheLadder.join('\n')).toEqual([]);
    expect(walk.sawtoothFallsAwayFromACheckIn).toBe(0);
    expect(walk.cappedReadings, 'inner offline discards on the capped walk').toBe(0);
    // COUNTS, NOT BOUNDS — the walk really happened and the cap really bit:
    // five reads, each one a check-in moment, each one raising the forfeit.
    expect(
      `${walk.read} read, ${walk.checkInMoments} check-in moments, ` +
        `forfeit +${walk.increases[FORFEIT_READING]}, ${walk.purchaseMoments} bought`,
    ).toBe('5 read, 5 check-in moments, forfeit +5, 5 bought');
    // ...and the walk's end state is the arithmetic the clamp promises: five
    // days of wall, five caps of gym, the difference on the away row.
    const last = FLOOR_SWEEP.CAPPED_WALK_HORIZON_SECONDS;
    expect(last / FLOOR_SWEEP.CAPPED_WALK_STEP_SECONDS).toBe(5);
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
      forfeitedSeconds: '0',
    });
    expect(empireFloorReadings(empireFloorAfter(10))).toEqual({
      gymBucks: '0.167',
      pendingGymBucks: '0.000',
      reputation: '2',
      roster: '0',
      equipment: 'bare-bar',
      clockSeconds: '10',
      forfeitedSeconds: '0',
    });
    expect(empireFloorReadings(empireFloorAfter(60))).toEqual({
      gymBucks: '1.000',
      pendingGymBucks: '0.000',
      reputation: '12',
      roster: '0',
      equipment: 'bare-bar',
      clockSeconds: '60',
      forfeitedSeconds: '0',
    });
    expect(empireFloorReadings(empireFloorAfter(600))).toEqual({
      gymBucks: '10.000',
      pendingGymBucks: '0.000',
      reputation: '120',
      roster: '0',
      equipment: 'bare-bar',
      clockSeconds: '600',
      forfeitedSeconds: '0',
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
  it('the INNER offline discard cannot bite here, and that is a bound rather than five samples', () => {
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
    //   `gymSeconds - checkInReadingAt(checkIns)`, which is strictly less than
    //   `EMPIRE_FLOOR.CHECK_IN_SECONDS` by construction. The cap discards only
    //   what is past `bankableOfflineSeconds`' horizon. So while one check-in is
    //   shorter than that horizon, no floor can be built that caps.
    //
    // RE-DERIVED FOR THE 2026-08-18 CATCH-UP CAP, because the inequality's
    // subject moved: the previewed gap used to be `openSeconds -
    // checkInReadingAt(checkIns)`, and a wall clock that jumps a week would
    // have made that claim false. It is GYM time now — a capped advance
    // forfeits the wall span instead of letting the previewed gap widen — so
    // the bound holds on the capped domain too, and the capped-floor arm at
    // the bottom of this test is the assertion that it does, on the very floor
    // whose catch-up WAS capped.
    //
    // THREE ASSERTIONS, AND NONE OF THEM IS DOMINATED BY ANOTHER. That is
    // CLAUDE.md's required check, discharged by measurement rather than by
    // reading them side by side — each was shown to redden ALONE, re-run
    // against the clamped module rather than carried over from the old one:
    //
    //   `CHECK_IN_SECONDS < cappedAbove`   `CHECK_IN_SECONDS` -> 86_400:
    //                                      `expected 86400 to be less than 43200`.
    //   `cappedReadings === 0`             the same cadence with the other two
    //                                      assertions removed:
    //                                      `capped readings in 86400s: expected
    //                                      43199 to be +0`.
    //   `widestPendingGapSeconds`          `owed` -> `checkInsBy(gymSeconds) / 2`,
    //                                      which leaves the cadence alone and the
    //                                      cap quiet: `widest previewed gap in
    //                                      240s: expected 240 to be 9`. (The
    //                                      pre-clamp module read 129 here; on
    //                                      the clamped one the halved count
    //                                      lets the mark fall the walk's whole
    //                                      length.)
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
      // ...and a WATCHED floor never forfeits: the outer cap needs a gap wider
      // than itself, and a walk that reads every second cannot hand it one.
      // This is the away row's own zero on the domain the old sweeps cover —
      // the state where the summary reads nothing because there is nothing to
      // summarise.
      expect(walk.increases[FORFEIT_READING], `forfeit rises in a watched ${horizon}s`).toBe(0);
      expect(walk.decreases[FORFEIT_READING], `forfeit falls in a watched ${horizon}s`).toBe(0);
    }
    // THE CAPPED-FLOOR ARM, which did not exist when the outer cap could not
    // either: the one floor state the old comment called unbuildable is now
    // built on purpose, and the inner discard is asserted quiet ON it. An hour
    // past the cap in one advance — the catch-up is capped, the away row is
    // live, and `pendingWasCapped` is still false because the gym clock landed
    // on its own boundary rather than gaping.
    const capped = empireFloorAfter(CATCH_UP_CAP_SECONDS + EMPIRE_TUNING.SECONDS_PER_HOUR);
    expect(catchUpWasCapped(capped)).toBe(true);
    expect(forfeitedAwaySeconds(capped)).toBe(EMPIRE_TUNING.SECONDS_PER_HOUR);
    expect(pendingWasCapped(capped)).toBe(false);
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
