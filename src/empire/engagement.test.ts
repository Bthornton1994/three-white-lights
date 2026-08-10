/**
 * engagement.test.ts — chain A measured: does the player's own engagement ever
 * make a progression-reaching empire output arrive later, or come out lower?
 *
 * ===========================================================================
 * The answer, up front, because one half of it is not zero
 * ===========================================================================
 *
 * Every number below is pinned in this file, taken element-wise by wall-clock
 * day, and reproducible from `ENGAGEMENT_SWEEP` alone.
 *
 *   - The PHYSIO half is zero on the shipped engine, in every domain measured
 *     here, and it is zero for a structural reason rather than by luck. GDD
 *     §5.4's two-books ruling pays the sponsor line into the accelerated book
 *     and buys the physio rung out of the wall-clock one, so the chain §5.4
 *     names as unmeasured — `REPUTATION_PER_CHECK_IN` -> sponsor Gym Bucks ->
 *     `STAFF_LEVEL_COST_GYM_BUCKS.physio` -> the day physio arrives — is
 *     severed at the purse. The first `describe` below measures that severance
 *     directly. Re-connect it, which is what the `'accelerated-purse'` control
 *     is, and it bites.
 *
 *   - The TRAINING IQ half is not zero. On the shipped engine an extra check-in
 *     leaves the more-engaged gym paying a LOWER §5.2 trickle on some later day
 *     in 2954 of 24576 exhaustively enumerated pairs — 25772 individual days —
 *     with a worst deficit of 0.451337 Training IQ per day, and it reproduces
 *     on seeded sweeps out to 100 days.
 *
 * The term is diagnosed by measurement rather than by argument, in "the term is
 * the spending order" below. The wall-clock book is spent greedily at whatever
 * moment a check-in happens, and `EmpireGym.nextAxis` advances once per
 * check-in, so the check-in schedule decides which wall-clock-funded rung takes
 * the money. A rung on the space or spotter ladder is a roster slot, a roster
 * slot is a lifter, and a lifter pays Training IQ. Three arms on one domain of
 * 5120 pairs, each with one term removed:
 *
 *   - shipped, all five axes:                566 violating pairs, 5273 days
 *   - one axis per funding family (no phase): 238 violating pairs, 2153 days
 *   - no roster-slot axes (no lifter term):     0 violating pairs,    0 days
 *
 * The roster-slot axes are all of it: with no space and no spotter ladder the
 * roster cannot grow past `ROSTER_SLOTS_BASE` and no schedule can move a
 * lifter's arrival at all.
 *
 * THE MIDDLE ARM IS NOT THE ROTATION PHASE ON ITS OWN, and the sentence that
 * used to say it was is deleted rather than softened. `ONE_PER_FUNDING_FAMILY`
 * drops three of the five axes as well as the phase, so its 238 is two terms
 * removed and reads as one. The phase alone is
 * `'fixed-order-no-rotation'` in the policy table below, and on the headline
 * domain it is 2954 -> 2751: a fourteenth of the count, not half of it.
 *
 * That is GDD §12.3's "a setback that punishes daily engagement" in §4.4's
 * shape — a quantity the player's own activity moves deciding when something
 * that reaches Sim training pace arrives. It is reported rather than clamped:
 * the fix is a design decision about how §5.1's check-in loop spends, and this
 * piece was asked to measure, not to choose.
 *
 * ===========================================================================
 * The count survives every spending policy measured, which is what makes it §5's
 * ===========================================================================
 *
 * The paragraph above describes a SPENDING POLICY — greedy, rotating, once per
 * check-in — and GDD §5 does not specify one. It fixes prices, ceilings, timers,
 * gates and outputs and says nothing about when a player spends, so a count
 * taken under one spending order is a fact about that order until the others
 * have been run beside it. `EMPIRE_SPENDING_POLICIES` is that list and the whole
 * comparator is re-taken under each, on this file's own exhaustive domain:
 *
 *   policy                        violating pairs   days lower   worst deficit
 *   rotate-greedy-per-check-in            2954         25772       0.451337
 *   fixed-order-no-rotation               2751         22580       0.451337
 *   cheapest-affordable-first             2751         22580       0.451337
 *   costliest-affordable-first            3427         28880       0.436267
 *   save-for-physio-first                    0             0       0
 *   spend-once-per-calendar-day          10122         43482       0.650459
 *
 * all on 24576 pairs and 589824 compared elements, with `pairsWherePhysioArrived`
 * at 24576 on every row. Two things follow and neither is the tidy answer:
 *
 *   - `'cheapest-affordable-first'` and `'fixed-order-no-rotation'` are the same
 *     numbers because on `EMPIRE_TUNING`'s ladders `AXIS_ORDER` is already
 *     price-ascending inside each funding family, so the two policies pick the
 *     same axis every time. They are five distinct policies, not six, and the
 *     table says so rather than counting the row twice.
 *   - `'save-for-physio-first'` is zero HERE and 15 at twenty seeded days and
 *     138 at forty. A zero on one domain is not a fix, and this file pins the
 *     second domain beside it so the zero cannot be read as one.
 *
 * So no policy measured is zero everywhere, and the punish-engagement property
 * is a property of §5's composition rather than of one simulated player: a
 * single wall-clock purse is contested by §5.4's roster-slot ladders and §5.3's
 * recruits, both of which gate a §5.2 Training IQ payer, and a check-in moves
 * where in that contest the money lands whatever order the player spends in.
 *
 * The one place E7's diagnosis is measurably backwards is worth stating plainly:
 * it named the per-check-in granularity as the term, and
 * `'spend-once-per-calendar-day'` — which removes exactly that — is the WORST
 * row, three and a half times the shipped count, the only row on this domain in
 * which the more-engaged gym's physio arrives LATER (5484 pairs, up to two
 * days), and the only policy under which E7's own whole-day reading stops being
 * zero (600 of 24576). Coarser spending does not help; it lets a whole day's
 * accrual land on one decision, which is a bigger lever for the schedule to
 * move, not a smaller one.
 *
 * ===========================================================================
 * Why the exhaustive sweep is over a window rather than every calendar
 * ===========================================================================
 *
 * `src/game/streak.test.ts` walks every calendar of 8 to 16 days. The empire
 * cannot be walked that way, and the reason is measured rather than asserted:
 *
 *   - a physio level takes about seven days of wall-clock earnings at six
 *     check-ins a day, so a grid short and coarse enough to enumerate whole
 *     never reaches one. Enumerated whole at two check-ins a day over seven
 *     days — every calendar, 114688 pairs — physio arrives in zero of them and
 *     the violating mechanism fires in zero of them. Both counts are pinned
 *     below and are the evidence for this paragraph.
 *   - at six check-ins a day, a horizon that does reach physio is 2^72
 *     calendars.
 *
 * So the exhaustive sweep enumerates every attendance pattern of a window of
 * leading slots inside a horizon that does reach physio, with every later slot
 * attended. Moving the same window to day 4 gives zero violating pairs, which
 * is where the "early days are where the book is contested" claim comes from.
 *
 * ===========================================================================
 * The parameters live here for the reason `empireSweep.test.ts` gives
 * ===========================================================================
 *
 * `src/game/streakSweep.ts` exists because a measurement was once reported with
 * its seeds unstated and "six plausible parameterisations gave six different
 * numbers". `ENGAGEMENT_SWEEP` is this measurement's equivalent. It carries a
 * `.test.ts` suffix because `src/tuning/audit.ts` classifies an unregistered
 * `src/empire/*.ts` as a renderer and a renderer may hold no bare numeric
 * literal at all.
 *
 * This file costs roughly 40 seconds. It is the largest cost in the directory
 * and it is spent on domain size: the counts above are only worth pinning
 * because the domains behind them are enumerated rather than sampled.
 */

import { describe, expect, it } from 'vitest';

import { asReputation, createEmpireClock, createEmpireState } from './empireCore';
import {
  BASELINE_PLAN,
  EMPIRE_SWEEP,
  policyAt,
  socialInputs,
} from './empireSweep.test';
import { EMPIRE_TUNING } from './empireTuning';
import {
  EMPIRE_SPENDING_POLICIES,
  SHIPPED_SPENDING_POLICY,
  rosterRatesAt,
  runEmpire,
  type EmpirePolicy,
  type EmpireSpendingPolicy,
  type SocialInputs,
} from './empireInvariant';
import {
  addEngagement,
  compareEngagement,
  emptyEngagementTally,
  engagementRunFaults,
  engagementWiring,
  historyFrom,
  moreEngagedBy,
  moreEngagedByTrainedDay,
  runEngagement,
  shippedEngagementWiring,
  slotWallSeconds,
  type EngagementHistory,
  type EngagementRun,
  type EngagementTally,
  type EngagementWiringKey,
} from './engagement';
import type { ExpansionAxis } from './expansion';
import { accrueProduction } from './production';
import { accrueSponsorship } from './reputation';
import { asCalendarDay, type SocialCalendarContext } from './social';

// ---------------------------------------------------------------------------
// The parameters
// ---------------------------------------------------------------------------

export const ENGAGEMENT_SWEEP = Object.freeze({
  /**
   * The ordinary cadence, read from `EMPIRE_SWEEP` rather than restated, so a
   * number taken here is comparable with one taken there.
   */
  CHECK_INS_PER_DAY: EMPIRE_SWEEP.CHECK_INS_PER_DAY,

  /** The horizon the windowed exhaustive sweeps run over. */
  WINDOW_HORIZON_DAYS: 12,

  /**
   * How many leading check-in slots are enumerated exhaustively. Twelve slots
   * at six check-ins a day is the first two days, and 2^12 patterns.
   */
  WINDOW_SLOTS: 12,

  /**
   * The same enumeration moved later in the calendar, as the evidence for "the
   * early days are where the wall-clock book is contested". Slot 24 opens day
   * 4; the window is shorter because this reading is a control on the reading
   * above rather than a headline of its own.
   */
  LATE_WINDOW_FROM_SLOT: 24,
  LATE_WINDOW_SLOTS: 9,

  /**
   * The coarse grid that CAN be enumerated whole: every calendar of seven days
   * at two check-ins a day. It is here to measure that its physio domain is
   * empty, which is why the sweep above is windowed.
   */
  COARSE_HORIZON_DAYS: 7,
  COARSE_CHECK_INS_PER_DAY: 2,

  /** The horizon the whole-day reading enumerates. Every calendar of 12 days. */
  WHOLE_DAY_HORIZON_DAYS: 12,

  /** The horizons the seeded slot-level sweeps run at. */
  SEEDED_HORIZON_DAYS: Object.freeze([20, 40] as const),
  SEEDED_LONG_HORIZON_DAYS: Object.freeze([60, 100] as const),

  /** Seeded histories per horizon, in the order the horizons are listed. */
  SEEDED_TRIALS: Object.freeze([12, 6] as const),
  SEEDED_LONG_TRIALS: Object.freeze([4, 2] as const),

  /** The share of slots a seeded history attends. */
  ATTENDANCE_DENSITY: 0.55,

  /**
   * One seed per horizon, and the generator's constants.
   *
   * A 32-bit linear congruential generator kept inside `Number.MAX_SAFE_
   * INTEGER` by its multiplier — `1664525 * (2^32 - 1)` is about 7.15e15,
   * under 9.007e15 — so the sequence is exact integer arithmetic rather than
   * float-rounded, and reproduces anywhere.
   */
  SEEDS: Object.freeze([90210, 31337, 60613, 100003] as const),
  LCG_MULTIPLIER: 1664525,
  LCG_INCREMENT: 1013904223,
  LCG_MODULUS: 4294967296,

  /** The axis order the simulated player offers a level-up in. As `EMPIRE_SWEEP`. */
  AXIS_ORDER: EMPIRE_SWEEP.AXIS_ORDER,

  /**
   * The two decompositions the diagnosis is measured with.
   *
   * `ONE_PER_FUNDING_FAMILY` leaves one wall-clock-funded axis and one
   * idle-funded one, so `EmpireGym.nextAxis`'s rotation can no longer change
   * which axis takes the money: the phase term is switched off and nothing else
   * is. `NO_ROSTER_SLOT_AXES` additionally drops both axes that pay roster
   * slots, so the roster cannot grow past `ROSTER_SLOTS_BASE` and the lifter
   * term is switched off too.
   */
  ONE_PER_FUNDING_FAMILY: Object.freeze(['space', 'equipment'] as const),
  NO_ROSTER_SLOT_AXES: Object.freeze(['physio', 'equipment'] as const),

  /**
   * The window the decomposition runs on: the same enumeration as the headline,
   * one day shorter so three arms fit the time budget. All three arms share it,
   * including the shipped one, so the contrast is one domain and not three.
   */
  DIAGNOSTIC_WINDOW_SLOTS: 10,

  /**
   * The Gym Bucks an upkeep control takes off the wall-clock book per keyed
   * event. A control's dial rather than a game value — nothing the game ships
   * charges it — set at a sixtieth of the physio price so the charge is felt
   * without making the gym insolvent.
   */
  UPKEEP_GYM_BUCKS: 100,

  /** The extra-trained-day half: its horizon and how many seeded histories. */
  TRAINED_DAY_HORIZON_DAYS: 20,
  TRAINED_DAY_TRIALS: 3,
} as const);

// ---------------------------------------------------------------------------
// What each sweep produced, pinned
// ---------------------------------------------------------------------------

/**
 * Whole tallies rather than scattered numbers, pinned exactly and never
 * bounded, for the reason GDD §4.4 gives about the streak counts: a bound lets
 * a defect grow back quietly. That applies in both directions here — the
 * non-vacuity counts (`pairs`, `comparedElements`, `movedPairs`,
 * `pairsWherePhysioArrived`) are pinned too, so a domain that went empty is red
 * rather than green.
 */

const MEASURED = Object.freeze({
  /** The headline. Every calendar of the first two days, on a 12-day horizon. */
  WINDOWED_SHIPPED: {
    pairs: 24576,
    comparedElements: 589824,
    movedPairs: 17912,
    movedElements: 188660,
    violatingPairs: 2954,
    trainingIqLower: 25772,
    trainingIqHigher: 161852,
    physioLower: 0,
    physioHigher: 1036,
    physioArrivalLater: 0,
    physioArrivalEarlier: 1036,
    pairsWherePhysioArrived: 24576,
    worstTrainingIqDeficit: 0.4513370000000001,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  /**
   * Chain A re-connected: the engine as it stood before GDD §5.4's two-books
   * ruling. This is what the physio zero above is a zero against — 263 pairs in
   * which training MORE moved the physio arrival a day later.
   */
  WINDOWED_ACCELERATED_PURSE: {
    pairs: 24576,
    comparedElements: 589824,
    movedPairs: 19678,
    movedElements: 213883,
    violatingPairs: 3488,
    trainingIqLower: 33455,
    trainingIqHigher: 175754,
    physioLower: 263,
    physioHigher: 4411,
    physioArrivalLater: 263,
    physioArrivalEarlier: 4411,
    pairsWherePhysioArrived: 24576,
    worstTrainingIqDeficit: 0.64348,
    worstPhysioDeficit: 1,
    worstArrivalDeficitDays: 1,
    lengthMismatches: 0,
  },
  /** The same enumeration at day 4, where the wall-clock book is not contested. */
  WINDOWED_LATE: {
    pairs: 2304,
    comparedElements: 55296,
    movedPairs: 52,
    movedElements: 52,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 0,
    physioLower: 0,
    physioHigher: 52,
    physioArrivalLater: 0,
    physioArrivalEarlier: 52,
    pairsWherePhysioArrived: 2304,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  /**
   * Every calendar of a grid coarse enough to enumerate whole.
   * `pairsWherePhysioArrived` is ZERO, which is the pin that reports this
   * domain's physio half as empty instead of letting its zeros read as
   * evidence.
   */
  COARSE_FULL: {
    pairs: 114688,
    comparedElements: 1605632,
    movedPairs: 104910,
    movedElements: 371481,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 371481,
    physioLower: 0,
    physioHigher: 0,
    physioArrivalLater: 0,
    physioArrivalEarlier: 0,
    pairsWherePhysioArrived: 0,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  /** Adding a whole day of check-ins rather than one. */
  WHOLE_DAY: {
    pairs: 24576,
    comparedElements: 589824,
    movedPairs: 18546,
    movedElements: 128286,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 111728,
    physioLower: 0,
    physioHigher: 16558,
    physioArrivalLater: 0,
    physioArrivalEarlier: 10870,
    pairsWherePhysioArrived: 13853,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  SEEDED_20: {
    pairs: 644,
    comparedElements: 25760,
    movedPairs: 102,
    movedElements: 1628,
    violatingPairs: 4,
    trainingIqLower: 21,
    trainingIqHigher: 1588,
    physioLower: 0,
    physioHigher: 19,
    physioArrivalLater: 0,
    physioArrivalEarlier: 19,
    pairsWherePhysioArrived: 644,
    worstTrainingIqDeficit: 0.0061029999999999696,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  SEEDED_40: {
    pairs: 623,
    comparedElements: 49840,
    movedPairs: 331,
    movedElements: 4925,
    violatingPairs: 5,
    trainingIqLower: 116,
    trainingIqHigher: 4794,
    physioLower: 0,
    physioHigher: 15,
    physioArrivalLater: 0,
    physioArrivalEarlier: 15,
    pairsWherePhysioArrived: 623,
    worstTrainingIqDeficit: 0.419489,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  SEEDED_60: {
    pairs: 650,
    comparedElements: 78000,
    movedPairs: 287,
    movedElements: 9168,
    violatingPairs: 93,
    trainingIqLower: 2511,
    trainingIqHigher: 6652,
    physioLower: 0,
    physioHigher: 5,
    physioArrivalLater: 0,
    physioArrivalEarlier: 5,
    pairsWherePhysioArrived: 650,
    worstTrainingIqDeficit: 0.32780699999999996,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  SEEDED_100: {
    pairs: 556,
    comparedElements: 111200,
    movedPairs: 176,
    movedElements: 5664,
    violatingPairs: 4,
    trainingIqLower: 89,
    trainingIqHigher: 5571,
    physioLower: 0,
    physioHigher: 4,
    physioArrivalLater: 0,
    physioArrivalEarlier: 4,
    pairsWherePhysioArrived: 556,
    worstTrainingIqDeficit: 0.219827,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  SEEDED_20_ACCELERATED_PURSE: {
    pairs: 644,
    comparedElements: 25760,
    movedPairs: 94,
    movedElements: 1699,
    violatingPairs: 12,
    trainingIqLower: 150,
    trainingIqHigher: 1527,
    physioLower: 2,
    physioHigher: 20,
    physioArrivalLater: 2,
    physioArrivalEarlier: 20,
    pairsWherePhysioArrived: 644,
    worstTrainingIqDeficit: 0.4527889999999999,
    worstPhysioDeficit: 1,
    worstArrivalDeficitDays: 1,
    lengthMismatches: 0,
  },
  SEEDED_20_CHECK_IN_UPKEEP: {
    pairs: 644,
    comparedElements: 25760,
    movedPairs: 127,
    movedElements: 1890,
    violatingPairs: 39,
    trainingIqLower: 589,
    trainingIqHigher: 1269,
    physioLower: 0,
    physioHigher: 32,
    physioArrivalLater: 0,
    physioArrivalEarlier: 31,
    pairsWherePhysioArrived: 644,
    worstTrainingIqDeficit: 0.23088600000000015,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  DIAG_SHIPPED: {
    pairs: 5120,
    comparedElements: 122880,
    movedPairs: 3543,
    movedElements: 38886,
    violatingPairs: 566,
    trainingIqLower: 5273,
    trainingIqHigher: 33453,
    physioLower: 0,
    physioHigher: 160,
    physioArrivalLater: 0,
    physioArrivalEarlier: 160,
    pairsWherePhysioArrived: 5120,
    worstTrainingIqDeficit: 0.44200400000000006,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  DIAG_ONE_PER_FUNDING_FAMILY: {
    pairs: 5120,
    comparedElements: 122880,
    movedPairs: 3447,
    movedElements: 37538,
    violatingPairs: 238,
    trainingIqLower: 2153,
    trainingIqHigher: 35385,
    physioLower: 0,
    physioHigher: 0,
    physioArrivalLater: 0,
    physioArrivalEarlier: 0,
    pairsWherePhysioArrived: 0,
    worstTrainingIqDeficit: 0.21781699999999993,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  DIAG_NO_ROSTER_SLOT_AXES: {
    pairs: 5120,
    comparedElements: 122880,
    movedPairs: 2403,
    movedElements: 24938,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 24878,
    physioLower: 0,
    physioHigher: 60,
    physioArrivalLater: 0,
    physioArrivalEarlier: 60,
    pairsWherePhysioArrived: 5120,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  /** An extra TRAINED day moves nothing at all: every element identical. */
  TRAINED_DAY_SHIPPED: {
    pairs: 45,
    comparedElements: 1800,
    movedPairs: 0,
    movedElements: 0,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 0,
    physioLower: 0,
    physioHigher: 0,
    physioArrivalLater: 0,
    physioArrivalEarlier: 0,
    pairsWherePhysioArrived: 45,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  TRAINED_DAY_UPKEEP: {
    pairs: 45,
    comparedElements: 1800,
    movedPairs: 2,
    movedElements: 35,
    violatingPairs: 2,
    trainingIqLower: 19,
    trainingIqHigher: 16,
    physioLower: 0,
    physioHigher: 0,
    physioArrivalLater: 0,
    physioArrivalEarlier: 0,
    pairsWherePhysioArrived: 45,
    worstTrainingIqDeficit: 0.20558699999999996,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
} as const);

// ---------------------------------------------------------------------------
// The deterministic generators
// ---------------------------------------------------------------------------

const BASE_SOCIAL = socialInputs();
const BASE_TRAINED_DAYS: readonly number[] = EMPIRE_SWEEP.TRAINED_DAYS;

/** A 32-bit LCG. Exact integer arithmetic; see `LCG_MULTIPLIER` above. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state * ENGAGEMENT_SWEEP.LCG_MULTIPLIER + ENGAGEMENT_SWEEP.LCG_INCREMENT) >>> 0;
    return state / ENGAGEMENT_SWEEP.LCG_MODULUS;
  };
}

function policyFor(
  checkInsPerDay: number,
  axisOrder: readonly ExpansionAxis[] = ENGAGEMENT_SWEEP.AXIS_ORDER,
): EmpirePolicy {
  return Object.freeze({
    checkInsPerDay,
    axisOrder: [...axisOrder],
    leaderboardMetric: EMPIRE_SWEEP.LEADERBOARD_METRIC,
  });
}

/**
 * The §5.5 surroundings for a history, with that history's own training plumbed
 * through the calendar context.
 *
 * `SocialCalendarContext` carries the trained days and the session count and
 * `socialRewardSchedule` reads neither; `social.ts` §1 says that plumbing is
 * deliberate, so an edit which starts reading one is inside a swept function.
 * Handing the real history in is what puts it inside this sweep as well.
 */
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

function runFor(
  days: number,
  history: EngagementHistory,
  key: EngagementWiringKey = 'shipped',
  axisOrder: readonly ExpansionAxis[] = ENGAGEMENT_SWEEP.AXIS_ORDER,
  checkInsPerDay: number = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY,
  spending: EmpireSpendingPolicy = SHIPPED_SPENDING_POLICY,
): EngagementRun {
  const wiring =
    key === 'shipped' || key === 'accelerated-purse'
      ? key === 'shipped'
        ? shippedEngagementWiring()
        : engagementWiring(key, 0)
      : engagementWiring(key, ENGAGEMENT_SWEEP.UPKEEP_GYM_BUCKS);
  return runEngagement(
    days,
    policyFor(checkInsPerDay, axisOrder),
    history,
    socialFor(history),
    wiring,
    spending,
  );
}

/**
 * Every attendance pattern of a window of slots, every other slot attended,
 * each compared against the same pattern with one more slot attended.
 */
function windowedSweep(
  days: number,
  windowFrom: number,
  windowSlots: number,
  key: EngagementWiringKey = 'shipped',
  axisOrder: readonly ExpansionAxis[] = ENGAGEMENT_SWEEP.AXIS_ORDER,
  spending: EmpireSpendingPolicy = SHIPPED_SPENDING_POLICY,
): EngagementTally {
  const slots = days * ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
  const cache = new Map<number, EngagementRun>();
  const at = (mask: number): EngagementRun => {
    const hit = cache.get(mask);
    if (hit !== undefined) return hit;
    const history = historyFrom(
      slots,
      (slot) =>
        slot < windowFrom || slot >= windowFrom + windowSlots
          ? true
          : (mask & (1 << (slot - windowFrom))) !== 0,
      BASE_TRAINED_DAYS,
    );
    const made = runFor(days, history, key, axisOrder, ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY, spending);
    cache.set(mask, made);
    return made;
  };
  let tally = emptyEngagementTally();
  for (let mask = 0; mask < 1 << windowSlots; mask += 1) {
    for (let bit = 0; bit < windowSlots; bit += 1) {
      if ((mask & (1 << bit)) !== 0) continue;
      tally = addEngagement(tally, compareEngagement(at(mask), at(mask | (1 << bit))));
    }
  }
  return tally;
}

/** Every calendar of a whole grid, at a cadence coarse enough to enumerate. */
function fullyExhaustiveSweep(days: number, checkInsPerDay: number): EngagementTally {
  const slots = days * checkInsPerDay;
  const cache = new Map<number, EngagementRun>();
  const at = (mask: number): EngagementRun => {
    const hit = cache.get(mask);
    if (hit !== undefined) return hit;
    const history = historyFrom(slots, (slot) => (mask & (1 << slot)) !== 0, BASE_TRAINED_DAYS);
    const made = runFor(days, history, 'shipped', ENGAGEMENT_SWEEP.AXIS_ORDER, checkInsPerDay);
    cache.set(mask, made);
    return made;
  };
  let tally = emptyEngagementTally();
  for (let mask = 0; mask < 1 << slots; mask += 1) {
    for (let bit = 0; bit < slots; bit += 1) {
      if ((mask & (1 << bit)) !== 0) continue;
      tally = addEngagement(tally, compareEngagement(at(mask), at(mask | (1 << bit))));
    }
  }
  return tally;
}

/** Every calendar of whole attended DAYS, each compared against one more day. */
function wholeDaySweep(
  days: number,
  spending: EmpireSpendingPolicy = SHIPPED_SPENDING_POLICY,
): EngagementTally {
  const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
  const slots = days * cadence;
  const cache = new Map<number, EngagementRun>();
  const at = (mask: number): EngagementRun => {
    const hit = cache.get(mask);
    if (hit !== undefined) return hit;
    const history = historyFrom(
      slots,
      (slot) => (mask & (1 << Math.floor(slot / cadence))) !== 0,
      BASE_TRAINED_DAYS,
    );
    const made = runFor(days, history, 'shipped', ENGAGEMENT_SWEEP.AXIS_ORDER, cadence, spending);
    cache.set(mask, made);
    return made;
  };
  let tally = emptyEngagementTally();
  for (let mask = 0; mask < 1 << days; mask += 1) {
    for (let day = 0; day < days; day += 1) {
      if ((mask & (1 << day)) !== 0) continue;
      tally = addEngagement(tally, compareEngagement(at(mask), at(mask | (1 << day))));
    }
  }
  return tally;
}

/** Seeded histories at a horizon, each compared against every one-check-in addition. */
function seededSweep(
  days: number,
  trials: number,
  seed: number,
  key: EngagementWiringKey = 'shipped',
  axisOrder: readonly ExpansionAxis[] = ENGAGEMENT_SWEEP.AXIS_ORDER,
  spending: EmpireSpendingPolicy = SHIPPED_SPENDING_POLICY,
): EngagementTally {
  const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
  const slots = days * cadence;
  let tally = emptyEngagementTally();
  const next = lcg(seed);
  for (let trial = 0; trial < trials; trial += 1) {
    const draws: boolean[] = [];
    for (let slot = 0; slot < slots; slot += 1) {
      draws.push(next() < ENGAGEMENT_SWEEP.ATTENDANCE_DENSITY);
    }
    const history = historyFrom(slots, (slot) => draws[slot] === true, BASE_TRAINED_DAYS);
    const baseline = runFor(days, history, key, axisOrder, cadence, spending);
    for (let slot = 0; slot < slots; slot += 1) {
      if (draws[slot] === true) continue;
      tally = addEngagement(
        tally,
        compareEngagement(
          baseline,
          runFor(days, moreEngagedBy(history, slot), key, axisOrder, cadence, spending),
        ),
      );
    }
  }
  return tally;
}

/** Seeded histories, each compared against the same history with one more TRAINED day. */
function trainedDaySweep(
  days: number,
  trials: number,
  seed: number,
  key: EngagementWiringKey = 'shipped',
): EngagementTally {
  const slots = days * ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
  let tally = emptyEngagementTally();
  const next = lcg(seed);
  for (let trial = 0; trial < trials; trial += 1) {
    const draws: boolean[] = [];
    for (let slot = 0; slot < slots; slot += 1) {
      draws.push(next() < ENGAGEMENT_SWEEP.ATTENDANCE_DENSITY);
    }
    const history = historyFrom(slots, (slot) => draws[slot] === true, BASE_TRAINED_DAYS);
    const baseline = runFor(days, history, key);
    for (let day = 0; day < days; day += 1) {
      if (BASE_TRAINED_DAYS.includes(day)) continue;
      tally = addEngagement(
        tally,
        compareEngagement(baseline, runFor(days, moreEngagedByTrainedDay(history, day), key)),
      );
    }
  }
  return tally;
}

function fullAttendance(days: number, cadence: number): EngagementHistory {
  return historyFrom(days * cadence, () => true, BASE_TRAINED_DAYS);
}

// ---------------------------------------------------------------------------
// The driver is the shipped composition with a schedule bolted on
// ---------------------------------------------------------------------------

describe('the engagement driver is the shipped composition, driven by a schedule', () => {
  it('reproduces runEmpire entry for entry under full attendance', () => {
    // The drift guard. This file re-walks `runEmpire`'s day loop so a check-in
    // can be skipped, and a second implementation that had drifted from the
    // first would make every number below a measurement of something the game
    // does not run.
    for (const days of [7, 12]) {
      const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
      const mine = runEngagement(
        days,
        policyFor(cadence),
        fullAttendance(days, cadence),
        socialInputs(),
      );
      const theirs = runEmpire(days, policyAt(cadence), BASELINE_PLAN, socialInputs());
      expect(mine.ledger.length).toBe(days * 4);
      expect(mine.ledger.length).toBe(theirs.ledger.length);
      expect(mine.ledger).toEqual(theirs.ledger);
    }
  });

  it('refuses a pair that does not differ in engagement by exactly one', () => {
    // The precondition of the whole measurement, held by the constructor. A
    // pair whose two sides did not differ in engagement is not evidence about
    // engagement, and this is what stops one being counted as if it were.
    const history = historyFrom(6, (slot) => slot % 2 === 0, [1, 3]);
    expect(() => moreEngagedBy(history, 0)).toThrow(/already attended/);
    expect(() => moreEngagedBy(history, 6)).toThrow(/off a grid/);
    expect(() => moreEngagedByTrainedDay(history, 3)).toThrow(/already trained/);
    expect(history.attended.filter((one) => one).length).toBe(3);
    expect(moreEngagedBy(history, 1).attended.filter((one) => one).length).toBe(4);
    expect(moreEngagedByTrainedDay(history, 2).trainedDays).toEqual([1, 2, 3]);
  });

  it('refuses a control dial on a wiring that has nothing to turn', () => {
    expect(() => engagementWiring('shipped', 1)).toThrow(/charges no upkeep/);
    expect(() => engagementWiring('check-in-upkeep', 0)).toThrow(/controls for nothing/);
    expect(shippedEngagementWiring().upkeepGymBucks).toBe(0);
  });

  it('places a check-in on the wall clock the way runEmpire does', () => {
    expect(slotWallSeconds(0, 6)).toBe(EMPIRE_TUNING.SECONDS_PER_DAY / 6);
    expect(slotWallSeconds(5, 6)).toBe(EMPIRE_TUNING.SECONDS_PER_DAY);
    expect(slotWallSeconds(6, 6)).toBe(EMPIRE_TUNING.SECONDS_PER_DAY * (7 / 6));
    expect(() => slotWallSeconds(-1, 6)).toThrow(/counted from zero/);
    expect(() => slotWallSeconds(0, 0)).toThrow(/at or above one/);
  });

  it('reports a run that satisfies its own census, under every wiring', () => {
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
    const history = fullAttendance(days, cadence);
    const shipped = runFor(days, history);
    expect(engagementRunFaults(shipped)).toEqual([]);
    expect(shipped.census.checkIns).toBe(days * cadence);
    expect(shipped.census.upkeepEvents).toBe(0);
    // The physio hook really does fire inside this horizon, which is what makes
    // the windowed sweep's physio domain non-empty.
    expect(shipped.census.physioArrivalDay).toBe(7);
    for (const key of ['accelerated-purse', 'check-in-upkeep', 'trained-day-upkeep'] as const) {
      const control = runFor(days, history, key);
      expect(engagementRunFaults(control), key).toEqual([]);
      expect(control.census.upkeepEvents > 0, key).toBe(key !== 'accelerated-purse');
    }
    expect(runFor(days, history, 'check-in-upkeep').census.upkeepEvents).toBe(days * cadence);
    expect(runFor(days, history, 'trained-day-upkeep').census.upkeepEvents).toBe(
      BASE_TRAINED_DAYS.filter((day) => day < days).length,
    );
  });
});

// ---------------------------------------------------------------------------
// Where chain A's money link is severed
// ---------------------------------------------------------------------------

describe('the sponsor line does not reach the purse a physio level is bought from', () => {
  it('moves the sponsor payout with reputation and leaves the wall-clock book still', () => {
    // The structural half of the physio zero, and the reason it is not luck.
    // `sponsorGymBucksPerDay` is a step function of reputation, reputation is
    // `REPUTATION_PER_CHECK_IN`-keyed, and the physio rung is priced against
    // `EmpireState.settledGymBucks`. If sponsor money reached that book, chain
    // A would be live at the purse.
    //
    // Both readings are taken over the same reputation ladder and the same gap.
    // The sponsor series is the positive control: a zero taken beside a series
    // that also refused to move would be a zero about a gap that paid nothing.
    const gap = EMPIRE_TUNING.SECONDS_PER_HOUR;
    const mark = createEmpireClock(0, 0);
    const clock = createEmpireClock(gap, 0);
    const sponsor: number[] = [];
    const settled: number[] = [];
    for (const reputation of EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS) {
      const state = Object.freeze({
        ...createEmpireState(),
        clock,
        reputation: asReputation(reputation),
      });
      sponsor.push(accrueSponsorship(state, mark).gymBucks);
      settled.push(accrueProduction(state, mark, rosterRatesAt(mark)).settledGymBucks);
    }
    expect(sponsor.length).toBe(EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS.length);
    expect(sponsor.length).toBe(5);
    // Distinct at every rung: the payout really is a function of reputation.
    expect(new Set(sponsor).size).toBe(sponsor.length);
    // And one value at every rung: the wall-clock book is not.
    expect(new Set(settled).size).toBe(1);
    expect(settled[0]).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// EXHAUSTIVE: every calendar of a window, at the ordinary cadence
// ---------------------------------------------------------------------------

describe('EXHAUSTIVE: every calendar of a window of check-in slots', () => {
  it('measures the shipped engine, and the Training IQ half is NOT zero', () => {
    const tally = windowedSweep(
      ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
      0,
      ENGAGEMENT_SWEEP.WINDOW_SLOTS,
    );
    expect(tally).toEqual(MEASURED.WINDOWED_SHIPPED);
  });

  it('measures chain A re-connected, as the control the physio zero is zero against', () => {
    // `'accelerated-purse'` is `stepGym`'s own `funding: 'accelerated'`: the gym
    // is offered its accelerated book where the wall-clock one belongs, which is
    // the engine as it stood before GDD §5.4's two-books ruling. Under it the
    // sponsor line — denominated off check-in-keyed reputation — is money the
    // physio rung is bought with, which is chain A end to end.
    const tally = windowedSweep(
      ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
      0,
      ENGAGEMENT_SWEEP.WINDOW_SLOTS,
      'accelerated-purse',
    );
    expect(tally).toEqual(MEASURED.WINDOWED_ACCELERATED_PURSE);
  });

  it('finds no violation when the same window sits at day 4', () => {
    const tally = windowedSweep(
      ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
      ENGAGEMENT_SWEEP.LATE_WINDOW_FROM_SLOT,
      ENGAGEMENT_SWEEP.LATE_WINDOW_SLOTS,
    );
    expect(tally).toEqual(MEASURED.WINDOWED_LATE);
  });
});

describe('EXHAUSTIVE: every calendar of a grid coarse enough to enumerate whole', () => {
  it('reports its own physio domain as empty rather than passing quietly', () => {
    // This is the evidence for the windowed sweep above being windowed. Every
    // calendar of seven days at two check-ins a day: the violating mechanism
    // never fires, and neither does the physio hook, so a zero taken here would
    // be a zero about a hook that never ran.
    const tally = fullyExhaustiveSweep(
      ENGAGEMENT_SWEEP.COARSE_HORIZON_DAYS,
      ENGAGEMENT_SWEEP.COARSE_CHECK_INS_PER_DAY,
    );
    expect(tally).toEqual(MEASURED.COARSE_FULL);
  });
});

describe('EXHAUSTIVE: every calendar of attended DAYS', () => {
  it('finds no violation when the extra engagement is a whole day', () => {
    // The granularity finding, kept beside the slot-level one. Adding six
    // check-ins at once never hurt at this horizon; adding one does. A sweep
    // taken only at day granularity would have reported zero and been an empty
    // domain for the mechanism.
    const tally = wholeDaySweep(ENGAGEMENT_SWEEP.WHOLE_DAY_HORIZON_DAYS);
    expect(tally).toEqual(MEASURED.WHOLE_DAY);
  });
});

// ---------------------------------------------------------------------------
// SAMPLED: 20, 40, 60 and 100 days
// ---------------------------------------------------------------------------

describe('SAMPLED: seeded histories at 20 and 40 days', () => {
  it('reproduces the finding at 20 and 40 days', () => {
    const [short, long] = ENGAGEMENT_SWEEP.SEEDED_HORIZON_DAYS;
    const [shortTrials, longTrials] = ENGAGEMENT_SWEEP.SEEDED_TRIALS;
    expect(seededSweep(short, shortTrials, ENGAGEMENT_SWEEP.SEEDS[0])).toEqual(MEASURED.SEEDED_20);
    expect(seededSweep(long, longTrials, ENGAGEMENT_SWEEP.SEEDS[1])).toEqual(MEASURED.SEEDED_40);
  });
});

describe('SAMPLED: seeded histories at 60 and 100 days', () => {
  it('reproduces the finding at 60 and 100 days', () => {
    const [short, long] = ENGAGEMENT_SWEEP.SEEDED_LONG_HORIZON_DAYS;
    const [shortTrials, longTrials] = ENGAGEMENT_SWEEP.SEEDED_LONG_TRIALS;
    expect(seededSweep(short, shortTrials, ENGAGEMENT_SWEEP.SEEDS[2])).toEqual(MEASURED.SEEDED_60);
    expect(seededSweep(long, longTrials, ENGAGEMENT_SWEEP.SEEDS[3])).toEqual(MEASURED.SEEDED_100);
  });
});

describe('NEGATIVE CONTROLS on the sampled grid', () => {
  it('pins both controls above the shipped engine on the grid it is measured on', () => {
    // Two deliberately-wired variants, on exactly the domain `MEASURED.SEEDED_20`
    // was taken on, so the three are one comparison.
    //
    // Said exactly rather than rounded up: on THIS grid both controls raise the
    // violating-pair count (4 -> 12 and 4 -> 39), and only the purse control
    // moves a physio arrival (2 pairs later). The upkeep control's physio half
    // is zero here — its bite on physio shows at a denser domain, and the
    // physio-direction control that the exhaustive zero is a zero against is
    // `MEASURED.WINDOWED_ACCELERATED_PURSE` above, at 263 of 24576. A control
    // that happens to be zero on one series is reported as zero rather than
    // described as a control for it.
    const [days] = ENGAGEMENT_SWEEP.SEEDED_HORIZON_DAYS;
    const [trials] = ENGAGEMENT_SWEEP.SEEDED_TRIALS;
    expect(seededSweep(days, trials, ENGAGEMENT_SWEEP.SEEDS[0], 'accelerated-purse')).toEqual(
      MEASURED.SEEDED_20_ACCELERATED_PURSE,
    );
    expect(seededSweep(days, trials, ENGAGEMENT_SWEEP.SEEDS[0], 'check-in-upkeep')).toEqual(
      MEASURED.SEEDED_20_CHECK_IN_UPKEEP,
    );
  });
});

// ---------------------------------------------------------------------------
// The term is the spending order, measured rather than argued
// ---------------------------------------------------------------------------

describe('the term is the spending order on the wall-clock book', () => {
  it('drops with the rotation switched off and vanishes without the roster-slot axes', () => {
    // Three arms on ONE domain, each with one term removed and nothing else
    // changed, so the contrast is a decomposition rather than three unrelated
    // readings. The shipped arm is measured here rather than borrowed, because
    // the headline sweep runs a wider window.
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const slots = ENGAGEMENT_SWEEP.DIAGNOSTIC_WINDOW_SLOTS;
    expect(windowedSweep(days, 0, slots)).toEqual(MEASURED.DIAG_SHIPPED);
    expect(
      windowedSweep(days, 0, slots, 'shipped', ENGAGEMENT_SWEEP.ONE_PER_FUNDING_FAMILY),
    ).toEqual(MEASURED.DIAG_ONE_PER_FUNDING_FAMILY);
    expect(
      windowedSweep(days, 0, slots, 'shipped', ENGAGEMENT_SWEEP.NO_ROSTER_SLOT_AXES),
    ).toEqual(MEASURED.DIAG_NO_ROSTER_SLOT_AXES);
  });
});

// ---------------------------------------------------------------------------
// The same comparator under every spending policy
// ---------------------------------------------------------------------------

/**
 * What each spending policy produced, pinned whole.
 *
 * These six tallies are the answer to "is the count above a property of GDD §5
 * or of one simulated player", and the shipped row is the reproduction check:
 * it is asserted against `MEASURED.WINDOWED_SHIPPED` itself rather than against
 * a copy of its numbers, so the two harnesses cannot quietly disagree.
 */
const MEASURED_POLICY = Object.freeze({
  WINDOWED: Object.freeze({
    'fixed-order-no-rotation': {
      pairs: 24576,
      comparedElements: 589824,
      movedPairs: 17580,
      movedElements: 184963,
      violatingPairs: 2751,
      trainingIqLower: 22580,
      trainingIqHigher: 161347,
      physioLower: 0,
      physioHigher: 1036,
      physioArrivalLater: 0,
      physioArrivalEarlier: 1036,
      pairsWherePhysioArrived: 24576,
      worstTrainingIqDeficit: 0.4513370000000001,
      worstPhysioDeficit: 0,
      worstArrivalDeficitDays: 0,
      lengthMismatches: 0,
    },
    'costliest-affordable-first': {
      pairs: 24576,
      comparedElements: 589824,
      movedPairs: 17479,
      movedElements: 182777,
      violatingPairs: 3427,
      trainingIqLower: 28880,
      trainingIqHigher: 152861,
      physioLower: 0,
      physioHigher: 1036,
      physioArrivalLater: 0,
      physioArrivalEarlier: 1036,
      pairsWherePhysioArrived: 24576,
      worstTrainingIqDeficit: 0.43626699999999996,
      worstPhysioDeficit: 0,
      worstArrivalDeficitDays: 0,
      lengthMismatches: 0,
    },
    'save-for-physio-first': {
      pairs: 24576,
      comparedElements: 589824,
      movedPairs: 10752,
      movedElements: 83506,
      violatingPairs: 0,
      trainingIqLower: 0,
      trainingIqHigher: 82470,
      physioLower: 0,
      physioHigher: 1036,
      physioArrivalLater: 0,
      physioArrivalEarlier: 1036,
      pairsWherePhysioArrived: 24576,
      worstTrainingIqDeficit: 0,
      worstPhysioDeficit: 0,
      worstArrivalDeficitDays: 0,
      lengthMismatches: 0,
    },
    'spend-once-per-calendar-day': {
      pairs: 24576,
      comparedElements: 589824,
      movedPairs: 13027,
      movedElements: 132845,
      violatingPairs: 10122,
      trainingIqLower: 43482,
      trainingIqHigher: 79507,
      physioLower: 5504,
      physioHigher: 4352,
      physioArrivalLater: 5484,
      physioArrivalEarlier: 3883,
      pairsWherePhysioArrived: 24576,
      worstTrainingIqDeficit: 0.6504590000000001,
      worstPhysioDeficit: 1,
      worstArrivalDeficitDays: 2,
      lengthMismatches: 0,
    },
  }),

  /**
   * The same six on a SECOND domain, and the reason this block exists: on the
   * windowed domain `'save-for-physio-first'` is zero, and a zero on one domain
   * read as a fix is exactly the empty-domain mistake CLAUDE.md keeps recording.
   * At 40 seeded days the same policy gives 138.
   *
   * Only `violatingPairs`, `trainingIqLower`, `worstTrainingIqDeficit`,
   * `physioArrivalLater` and the two non-vacuity counts are pinned here, because
   * this domain is a check on the windowed one rather than a headline of its own.
   */
  SEEDED_20: Object.freeze({
    'rotate-greedy-per-check-in': { pairs: 644, movedPairs: 102, violatingPairs: 4, trainingIqLower: 21, physioArrivalLater: 0, worstTrainingIqDeficit: 0.0061029999999999696 },
    'fixed-order-no-rotation': { pairs: 644, movedPairs: 102, violatingPairs: 4, trainingIqLower: 21, physioArrivalLater: 0, worstTrainingIqDeficit: 0.0061029999999999696 },
    'cheapest-affordable-first': { pairs: 644, movedPairs: 102, violatingPairs: 4, trainingIqLower: 21, physioArrivalLater: 0, worstTrainingIqDeficit: 0.0061029999999999696 },
    'costliest-affordable-first': { pairs: 644, movedPairs: 97, violatingPairs: 8, trainingIqLower: 111, physioArrivalLater: 0, worstTrainingIqDeficit: 0.419489 },
    'save-for-physio-first': { pairs: 644, movedPairs: 123, violatingPairs: 15, trainingIqLower: 41, physioArrivalLater: 0, worstTrainingIqDeficit: 0.19864499999999996 },
    'spend-once-per-calendar-day': { pairs: 644, movedPairs: 71, violatingPairs: 61, trainingIqLower: 789, physioArrivalLater: 14, worstTrainingIqDeficit: 0.26323399999999997 },
  }),
  SEEDED_40: Object.freeze({
    'rotate-greedy-per-check-in': { pairs: 623, movedPairs: 331, violatingPairs: 5, trainingIqLower: 116, physioArrivalLater: 0, worstTrainingIqDeficit: 0.419489 },
    'fixed-order-no-rotation': { pairs: 623, movedPairs: 331, violatingPairs: 10, trainingIqLower: 251, physioArrivalLater: 0, worstTrainingIqDeficit: 0.419489 },
    'cheapest-affordable-first': { pairs: 623, movedPairs: 331, violatingPairs: 10, trainingIqLower: 251, physioArrivalLater: 0, worstTrainingIqDeficit: 0.419489 },
    'costliest-affordable-first': { pairs: 623, movedPairs: 331, violatingPairs: 6, trainingIqLower: 143, physioArrivalLater: 0, worstTrainingIqDeficit: 0.419489 },
    'save-for-physio-first': { pairs: 623, movedPairs: 413, violatingPairs: 138, trainingIqLower: 1345, physioArrivalLater: 0, worstTrainingIqDeficit: 0.25634900000000016 },
    'spend-once-per-calendar-day': { pairs: 623, movedPairs: 201, violatingPairs: 182, trainingIqLower: 1994, physioArrivalLater: 4, worstTrainingIqDeficit: 0.26990099999999995 },
  }),

  /**
   * Adding a WHOLE DAY rather than one check-in, under every policy.
   *
   * E7 reported this reading as zero and called it the sharpest discriminator
   * between the day and the check-in. It is zero under five of the six — and it
   * is 600 under `'spend-once-per-calendar-day'`, the policy that removes the
   * per-check-in granularity E7 named as the term. Removing that term makes this
   * reading worse rather than zero, which is why the term cannot have been it.
   */
  WHOLE_DAY_VIOLATING_PAIRS: Object.freeze({
    'rotate-greedy-per-check-in': 0,
    'fixed-order-no-rotation': 0,
    'cheapest-affordable-first': 0,
    'costliest-affordable-first': 0,
    'save-for-physio-first': 0,
    'spend-once-per-calendar-day': 600,
  }),

  /**
   * One full-attendance run per policy, so a tally taken under a policy that
   * bought nothing would report itself instead of being a quiet zero.
   * `spendingMoments` is the count that separates a day-granularity policy from
   * one that never reached a spending moment at all.
   */
  FULL_ATTENDANCE_CENSUS: Object.freeze({
    'rotate-greedy-per-check-in': { spendingMoments: 72, recruits: 5, expansions: 5, physioArrivalDay: 7 },
    'fixed-order-no-rotation': { spendingMoments: 72, recruits: 5, expansions: 5, physioArrivalDay: 7 },
    'cheapest-affordable-first': { spendingMoments: 72, recruits: 5, expansions: 5, physioArrivalDay: 7 },
    'costliest-affordable-first': { spendingMoments: 72, recruits: 5, expansions: 5, physioArrivalDay: 7 },
    'save-for-physio-first': { spendingMoments: 72, recruits: 5, expansions: 5, physioArrivalDay: 4 },
    'spend-once-per-calendar-day': { spendingMoments: 12, recruits: 5, expansions: 5, physioArrivalDay: 9 },
  }),
} as const);

/** The windowed sweep E7 took, under one policy. Same domain, same comparator. */
function policyWindowed(spending: EmpireSpendingPolicy): EngagementTally {
  return windowedSweep(
    ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
    0,
    ENGAGEMENT_SWEEP.WINDOW_SLOTS,
    'shipped',
    ENGAGEMENT_SWEEP.AXIS_ORDER,
    spending,
  );
}

/** The five counts the second-domain table pins, out of a whole tally. */
function policyDigest(tally: EngagementTally): Record<string, number> {
  return {
    pairs: tally.pairs,
    movedPairs: tally.movedPairs,
    violatingPairs: tally.violatingPairs,
    trainingIqLower: tally.trainingIqLower,
    physioArrivalLater: tally.physioArrivalLater,
    worstTrainingIqDeficit: tally.worstTrainingIqDeficit,
  };
}

describe('the spending policy is the second independent variable, and it is swept', () => {
  it('drives the shipped policy through the same code path as the default', () => {
    // The drift guard the table needs. Naming the shipped policy explicitly and
    // letting `runEngagement` default to it are two call sites, and if they had
    // produced different ledgers every number in the table would be about a
    // seventh policy nobody listed. Byte-identical, entry by entry, on a
    // partial schedule — a full one would not exercise `lastCheckInOfDay`.
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
    const history = historyFrom(days * cadence, (slot) => slot % 3 !== 1, BASE_TRAINED_DAYS);
    const defaulted = runFor(days, history);
    const named = runFor(days, history, 'shipped', ENGAGEMENT_SWEEP.AXIS_ORDER, cadence, SHIPPED_SPENDING_POLICY);
    expect(named.ledger.length).toBe(days * 4);
    expect(named.ledger).toEqual(defaulted.ledger);
    expect(named.census).toEqual(defaulted.census);
    // And the schedule really was partial, so the equality is not about a run
    // in which every check-in is a day boundary anyway.
    expect(named.census.checkIns).toBeLessThan(named.census.slots);
  });

  it('pins which policy runEmpire could be swapped to without anything noticing', () => {
    // The drift guard's blind spot, measured instead of left implicit, and it
    // was found by mutation rather than by reading. `runEmpire` drives FULL
    // attendance and names `SHIPPED_SPENDING_POLICY` at one call site; the guard
    // above compares its ledger with this file's. Swapping that call site to
    // `'fixed-order-no-rotation'` was run against the whole directory and
    // reddened NOTHING — because under full attendance four of the six policies
    // produce a byte-identical ledger and only two separate from it.
    //
    // So the list below is the size of the hole: a swap to one of the four is
    // invisible to every check here, and a swap to either of the two is caught.
    // Pinning it makes the hole a fact a reader can see rather than an absence
    // they have to notice, and it moves the day the policies stop coinciding.
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
    const history = fullAttendance(days, cadence);
    const shipped = runFor(days, history, 'shipped', ENGAGEMENT_SWEEP.AXIS_ORDER, cadence, SHIPPED_SPENDING_POLICY);
    const indistinguishable: EmpireSpendingPolicy[] = [];
    const separated: EmpireSpendingPolicy[] = [];
    for (const spending of EMPIRE_SPENDING_POLICIES) {
      const run = runFor(days, history, 'shipped', ENGAGEMENT_SWEEP.AXIS_ORDER, cadence, spending);
      if (JSON.stringify(run.ledger) === JSON.stringify(shipped.ledger)) {
        indistinguishable.push(spending);
      } else {
        separated.push(spending);
      }
    }
    expect(indistinguishable).toEqual([
      'rotate-greedy-per-check-in',
      'fixed-order-no-rotation',
      'cheapest-affordable-first',
      'costliest-affordable-first',
    ]);
    expect(separated).toEqual(['save-for-physio-first', 'spend-once-per-calendar-day']);
    expect(indistinguishable.length + separated.length).toBe(6);
    // And the ledger the two lists are sorted around is the one `runEmpire`
    // actually produces, so this is about the shipped composition and not about
    // a run assembled here.
    expect(runEmpire(days, policyAt(cadence), BASELINE_PLAN, socialInputs()).ledger).toEqual(
      shipped.ledger,
    );
  });

  it('reports what each policy actually bought, so no tally is a zero about nothing', () => {
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
    const history = fullAttendance(days, cadence);
    let policiesRun = 0;
    for (const spending of EMPIRE_SPENDING_POLICIES) {
      const run = runFor(days, history, 'shipped', ENGAGEMENT_SWEEP.AXIS_ORDER, cadence, spending);
      expect(engagementRunFaults(run), spending).toEqual([]);
      expect(run.spending).toBe(spending);
      expect(run.census.checkIns).toBe(days * cadence);
      expect(
        {
          spendingMoments: run.census.spendingMoments,
          recruits: run.census.recruits,
          expansions: run.census.expansions,
          physioArrivalDay: run.census.physioArrivalDay,
        },
        spending,
      ).toEqual(MEASURED_POLICY.FULL_ATTENDANCE_CENSUS[spending]);
      policiesRun += 1;
    }
    expect(policiesRun).toBe(EMPIRE_SPENDING_POLICIES.length);
    expect(policiesRun).toBe(6);
  });

  it('reproduces E7 exactly under the shipped policy', () => {
    // The first thing that has to hold: if this arm did not land on
    // `MEASURED.WINDOWED_SHIPPED` byte for byte, the two harnesses would
    // disagree and nothing else in this section would be worth reading. It is
    // asserted against that object rather than against a transcription of it.
    expect(policyWindowed(SHIPPED_SPENDING_POLICY)).toEqual(MEASURED.WINDOWED_SHIPPED);
    expect(MEASURED.WINDOWED_SHIPPED.violatingPairs).toBe(2954);
  });

  it('measures the rotation phase removed: fixed order, and cheapest-first with it', () => {
    // Two arms, and they come out IDENTICAL — measured, not arranged. On
    // `EMPIRE_TUNING`'s shipped ladders `AXIS_ORDER` is already price-ascending
    // inside each funding family at every rung this domain reaches, so
    // "cheapest affordable first" and "the declared order" pick the same axis
    // every time. They are two different functions of the state and one policy
    // on this cost table, and the equality below is what says so — if a price
    // moves, they separate and this line goes red rather than the two arms
    // silently continuing to be counted as independent evidence.
    const fixed = policyWindowed('fixed-order-no-rotation');
    const cheapest = policyWindowed('cheapest-affordable-first');
    expect(fixed).toEqual(MEASURED_POLICY.WINDOWED['fixed-order-no-rotation']);
    expect(cheapest).toEqual(fixed);
    // The phase term is a fourteenth of the shipped count, not the whole of it.
    // Measured the other way round as well: put the rotation back on this policy
    // and the arm lands on 2954 / 25772 exactly, which is what says the two arms
    // differ in the rotation and in nothing else.
    expect(fixed.violatingPairs).toBe(2751);
    expect(MEASURED.WINDOWED_SHIPPED.violatingPairs - fixed.violatingPairs).toBe(203);
  });

  it('measures the ordering reversed: costliest affordable first', () => {
    const tally = policyWindowed('costliest-affordable-first');
    expect(tally).toEqual(MEASURED_POLICY.WINDOWED['costliest-affordable-first']);
    // Worse than the shipped model, not better, so the ordering term does not
    // point in a helpful direction either.
    expect(tally.violatingPairs).toBeGreaterThan(MEASURED.WINDOWED_SHIPPED.violatingPairs);
  });

  it('measures the purse held for the one rung that reaches Sim progression', () => {
    const tally = policyWindowed('save-for-physio-first');
    expect(tally).toEqual(MEASURED_POLICY.WINDOWED['save-for-physio-first']);
    // Zero — and it is a zero against a live comparator, not an empty domain:
    // the same 24576 pairs, 10752 of which moved, and 82470 day-elements in
    // which the more-engaged gym paid MORE. The seeded reading below is what
    // stops this zero being read as a fix.
    expect(tally.violatingPairs).toBe(0);
    expect(tally.movedPairs).toBeGreaterThan(0);
    expect(tally.trainingIqHigher).toBeGreaterThan(0);
  });

  it('measures the per-check-in granularity removed: spend once a calendar day', () => {
    const tally = policyWindowed('spend-once-per-calendar-day');
    expect(tally).toEqual(MEASURED_POLICY.WINDOWED['spend-once-per-calendar-day']);
    // Three and a half times the shipped count, and the only arm on this domain
    // in which the more-engaged gym's PHYSIO arrives later at all. E7 named this
    // granularity as the term; removing it makes both halves worse.
    expect(tally.violatingPairs).toBeGreaterThan(MEASURED.WINDOWED_SHIPPED.violatingPairs);
    expect(MEASURED.WINDOWED_SHIPPED.physioArrivalLater).toBe(0);
    expect(tally.physioArrivalLater).toBe(5484);
  });

  // The two readings below are each split in half, and the split is only about
  // wall time: `vitest.config.ts`'s budget is per test and its own header says
  // the margin is the thing worth writing down rather than widening. The halves
  // are named from `EMPIRE_SPENDING_POLICIES` itself and reassembled in a check
  // of their own, so a policy cannot fall down the crack between them.
  const FIRST_HALF = EMPIRE_SPENDING_POLICIES.slice(0, 3);
  const SECOND_HALF = EMPIRE_SPENDING_POLICIES.slice(3);

  it('splits the two long readings without dropping a policy between the halves', () => {
    expect([...FIRST_HALF, ...SECOND_HALF]).toEqual([...EMPIRE_SPENDING_POLICIES]);
    expect(FIRST_HALF.length + SECOND_HALF.length).toBe(6);
    expect(FIRST_HALF.length).toBeGreaterThan(0);
    expect(SECOND_HALF.length).toBeGreaterThan(0);
  });

  /**
   * One seeded horizon under every policy, and the policies that came out zero.
   *
   * The claim this section turns on: `'save-for-physio-first'` is the only arm
   * that was zero on the windowed domain, and it is 15 at twenty days and 138 at
   * forty — so its zero is a fact about one window and not a property of the
   * policy.
   */
  function seededArm(
    days: number,
    trials: number,
    seed: number,
    pinned: Readonly<Record<string, Record<string, number>>>,
  ): readonly EmpireSpendingPolicy[] {
    const zeros: EmpireSpendingPolicy[] = [];
    let measured = 0;
    for (const spending of EMPIRE_SPENDING_POLICIES) {
      const tally = seededSweep(
        days,
        trials,
        seed,
        'shipped',
        ENGAGEMENT_SWEEP.AXIS_ORDER,
        spending,
      );
      expect(policyDigest(tally), `${spending} at ${days} days`).toEqual(pinned[spending]);
      if (tally.violatingPairs === 0) zeros.push(spending);
      measured += 1;
    }
    // A count, so a policy list that had gone empty is red here rather than
    // making the emptiness of `zeros` read as evidence.
    expect(measured).toBe(6);
    return Object.freeze(zeros);
  }

  it('finds no policy that is zero at 20 seeded days', () => {
    expect(seededArm(20, 12, ENGAGEMENT_SWEEP.SEEDS[0], MEASURED_POLICY.SEEDED_20)).toEqual([]);
  });

  it('finds no policy that is zero at 40 seeded days', () => {
    expect(seededArm(40, 6, ENGAGEMENT_SWEEP.SEEDS[1], MEASURED_POLICY.SEEDED_40)).toEqual([]);
  });

  /**
   * E7's sharpest discriminator, re-taken under a policy at a time.
   *
   * Under the shipped model adding a whole day of check-ins never hurt; under
   * the policy that spends once a day it hurts in 600 of 24576 pairs, which is
   * the reading that decides the per-check-in granularity was not the mechanism.
   */
  function wholeDayArm(policies: readonly EmpireSpendingPolicy[]): number {
    let measured = 0;
    for (const spending of policies) {
      const tally = wholeDaySweep(ENGAGEMENT_SWEEP.WHOLE_DAY_HORIZON_DAYS, spending);
      expect(tally.pairs, spending).toBe(24576);
      expect(tally.pairsWherePhysioArrived, spending).toBeGreaterThan(0);
      expect(tally.violatingPairs, spending).toBe(
        MEASURED_POLICY.WHOLE_DAY_VIOLATING_PAIRS[spending],
      );
      measured += 1;
    }
    return measured;
  }

  it('takes the whole-day reading under the first three policies', () => {
    expect(wholeDayArm(FIRST_HALF)).toBe(3);
  });

  it('takes the whole-day reading under the last three, one of which is not zero', () => {
    expect(wholeDayArm(SECOND_HALF)).toBe(3);
    // Named here rather than left in the table: the only non-zero whole-day
    // reading is the policy that removed the granularity E7 blamed.
    expect(MEASURED_POLICY.WHOLE_DAY_VIOLATING_PAIRS['spend-once-per-calendar-day']).toBe(600);
    expect(MEASURED_POLICY.WHOLE_DAY_VIOLATING_PAIRS['rotate-greedy-per-check-in']).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The other half of the property: an extra TRAINED day
// ---------------------------------------------------------------------------

describe('an extra trained day moves nothing the empire pays', () => {
  it('leaves both progression series byte-identical, with a control that does not', () => {
    // CLAUDE.md states the property in this form. No §5 module reads
    // `SocialCalendarContext.trainedDays` or `sessionCount` on any path that
    // reaches the wall-clock book, so the expected result is byte-identical
    // ledgers — and a zero of that shape needs both a live comparator beside it
    // and a control that moves.
    const days = ENGAGEMENT_SWEEP.TRAINED_DAY_HORIZON_DAYS;
    const trials = ENGAGEMENT_SWEEP.TRAINED_DAY_TRIALS;
    const seed = ENGAGEMENT_SWEEP.SEEDS[0];
    expect(trainedDaySweep(days, trials, seed)).toEqual(MEASURED.TRAINED_DAY_SHIPPED);
    expect(trainedDaySweep(days, trials, seed, 'trained-day-upkeep')).toEqual(
      MEASURED.TRAINED_DAY_UPKEEP,
    );
  });
});
