/**
 * engagement.test.ts — chain A measured: does the player's own engagement ever
 * make a progression-reaching empire output arrive later, or come out lower?
 *
 * ===========================================================================
 * The answer, up front, and what changed it
 * ===========================================================================
 *
 * Every number below is pinned in this file, taken element-wise by wall-clock
 * day, and reproducible from `ENGAGEMENT_SWEEP` alone.
 *
 * On the shipped engine the property holds on every domain measured here and
 * under five of the six spending policies: 0 violating pairs on the exhaustive
 * 24576-pair window, 0 on every calendar of a coarse grid enumerated whole
 * (114688 pairs), 0 at 20, 40, 60 and 100 seeded days, and 0 for an extra
 * TRAINED day at every element. The sixth policy is not zero and is diagnosed
 * rather than clamped — see "the one arm that is not zero" below.
 *
 * WHAT THE ZEROS ARE ZEROS AGAINST, because a zero with nothing beside it is
 * the empty-domain vacuity CLAUDE.md keeps recording. `'single-purse'` is the
 * engine as it stood before GDD §5.4's third-book ruling — the same clock
 * split, the same wall-clock money, and every wall-clock spender back on ONE
 * balance — driven through the same loop by one parameter. On the identical
 * domain it gives:
 *
 *   policy                        shipped   single purse (pre-ruling)
 *   rotate-greedy-per-check-in          0        2954
 *   fixed-order-no-rotation             0        2751
 *   cheapest-affordable-first           0        2751
 *   costliest-affordable-first          0        3427
 *   save-for-physio-first               0           0
 *   spend-once-per-calendar-day      7245       10122
 *
 * all on 24576 pairs and 589824 compared elements. The right-hand column is
 * piece E8's table reproduced number for number by the control, which is what
 * says the control is the old engine rather than a new approximation of it.
 *
 * ===========================================================================
 * Why a purse per output is what removed it
 * ===========================================================================
 *
 * The mechanism E8 measured and could not fix: one wall-clock balance was
 * contested by §5.4's space and spotter ladders, §5.4's physio ladder and
 * §5.3's recruits, and a contested balance has a spending ORDER. The order
 * moved with the check-in schedule, so a player who opened the app more often
 * could buy a different rung at a different moment and end on a LOWER §5.2
 * Training IQ series.
 *
 * `WallClockBooks` gives each of those spenders a purse nothing else can
 * spend, and `EMPIRE_BOOKS` gives each purse its own slot in the spending loop.
 * A purse with one spender is spent in ladder order at the first moment it can
 * afford the next rung, and attending more can only move an accrual earlier, so
 * the day a rung lands is monotone in attendance. That is the whole argument,
 * and the table above is the measurement of it rather than a restatement.
 *
 * ===========================================================================
 * The one arm that is not zero, and what is actually behind it
 * ===========================================================================
 *
 * `'spend-once-per-calendar-day'` is 7245 of 24576 on the window, 60 at twenty
 * seeded days and 44 at forty. It is a model of a player who banks the day's
 * takings and spends them at the last check-in THEY TAKE, and the sweep below
 * splits its violations by whether the extra check-in moved that moment:
 *
 *   the extra check-in is later than the day's last:  8064 pairs, 7240 violating
 *   the extra check-in is not:                       16512 pairs,    5 violating
 *
 * So 7240 of 7245 are one mechanism, and it is not §5's: a player who opens the
 * app again in the evening spends their day's money in the evening, and a build
 * started four hours later finishes four hours later. No purse arrangement
 * reaches it, because the money was never the thing that moved — the DECISION
 * MOMENT was. It is a property of that simulated player, and it is reported
 * rather than removed, because removing it means redefining `lastCheckInOfDay`
 * as the day's last SLOT, which is a different model of a player and not a fix
 * to the design.
 *
 * The remaining 5 are a SECOND mechanism and a real one, so they are named
 * separately. They all come from one baseline, and in each the more-engaged gym
 * banks more money by the same instant — an extra check-in splits a gap the
 * offline cap was truncating — and then buys a HIGHER NPC tier with it.
 * `NPC_RECRUIT_COST_GYM_BUCKS` divided by `NPC_TIER_OUTPUT_MULTIPLIER` rises
 * strictly along `NPC_TIERS` (500, 1250, 3200, 7500, 13846 Gym Bucks per unit
 * of Training IQ), and `bestRecruitableTier` buys the best tier it can afford,
 * so a gym with more money at one decision buys strictly LESS Training IQ per
 * Buck. That is a property of the recruit price table and of the simulated
 * player's choice rule — not of the purses, which is why it survives them — and
 * it is pinned as a unit fact below rather than left inside a sweep count.
 *
 * ===========================================================================
 * What the coarse exhaustive grid now says, and what it used to say
 * ===========================================================================
 *
 * E8 recorded that every calendar of seven days at two check-ins a day never
 * reached a physio level, so its physio half was an empty domain and the
 * headline sweep had to be windowed. That is no longer true and the sentence is
 * replaced rather than kept: with a purse per output the physio fund fills at
 * the baseline line with nothing else drawing on it, so physio arrives on day 4
 * at full attendance and the coarse grid reaches it in 21737 of 114688 pairs.
 * The coarse sweep is therefore a live exhaustive result on both series now,
 * and it is 0.
 *
 * The windowed sweep stays because the cost argument stands: at six check-ins a
 * day a horizon long enough to be interesting is 2^72 calendars.
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
  ENGAGEMENT_WIRINGS,
  SHIPPED_ENGAGEMENT_WIRING,
  addEngagement,
  chargesUpkeep,
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
   * The Gym Bucks an upkeep control takes off EVERY wall-clock purse per keyed
   * event. A control's dial rather than a game value — nothing the game ships
   * charges it.
   *
   * Two dials rather than one, and the reason is measured: a check-in control
   * charges six times a calendar day and a trained-day control charges on the
   * few days `EMPIRE_SWEEP.TRAINED_DAYS` names, so one per-event magnitude
   * makes them controls of very different strength. At 100 on both, the
   * trained-day control moved NOTHING at all — 0 of 45 pairs, 0 elements —
   * which is a control that has stopped controlling for anything. At 500 it
   * moves 6 pairs and pushes 5 physio arrivals later. The check-in dial stays
   * at 100 because at 500 its gym never reaches a physio level at all
   * (`pairsWherePhysioArrived` 0 of 644), which empties the half of the domain
   * that control is the control for.
   */
  UPKEEP_GYM_BUCKS: 100,

  /** The same dial for the trained-day control. See above for why it differs. */
  TRAINED_DAY_UPKEEP_GYM_BUCKS: 500,

  /**
   * The fixture the M10 check drives `runEmpire` on: the horizon, and an axis
   * order whose level-1 prices are NOT ascending.
   *
   * Both are load-bearing and both were found by search rather than chosen.
   * `EMPIRE_SWEEP.AXIS_ORDER` is price-ascending inside every purse, so under
   * it `'cheapest-affordable-first'` and `'fixed-order-no-rotation'` pick the
   * same axis every time and no ledger separates them; putting the spotter
   * ladder ahead of the cheaper space ladder is what makes the two policies
   * different functions of the same state. Twelve days is not long enough for
   * the rotation to change an outcome — measured, 2 distinct ledgers across the
   * six policies — and twenty days is, at 4.
   */
  M10_HORIZON_DAYS: 20,
  M10_AXIS_ORDER: Object.freeze(['spotter', 'space', 'physio', 'equipment', 'coach'] as const),

  /**
   * The window the `'spend-once-per-calendar-day'` diagnostic enumerates. The
   * same twelve leading slots as the headline sweep, so the split below adds up
   * to the headline count rather than describing a different domain.
   */
  SPEND_ONCE_WINDOW_SLOTS: 12,

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
  /**
   * The headline. Every calendar of the first two days, on a 12-day horizon.
   * Zero violating pairs, against a comparator that moved 19778 of 24576 pairs
   * and paid the more-engaged gym MORE on 205848 day-elements.
   */
  WINDOWED_SHIPPED: {
    pairs: 24576,
    comparedElements: 589824,
    movedPairs: 19778,
    movedElements: 206884,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 205848,
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
  /**
   * THE CONTROL THE HEADLINE ZERO IS A ZERO AGAINST: the same engine with every
   * wall-clock spender back on one balance, which is where GDD §5.4's
   * third-book ruling came from. Piece E8 measured exactly these numbers on
   * exactly this domain before the ruling, and the control reproduces them.
   */
  WINDOWED_SINGLE_PURSE: {
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
   * Chain A re-connected: the engine before the TWO-books ruling, where the
   * sponsor line reaches the purse a physio rung is bought from. 263 pairs in
   * which training MORE moved the physio arrival a day later, which is what the
   * physio zeros are zeros against.
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
  /** The same enumeration at day 4. */
  WINDOWED_LATE: {
    pairs: 2304,
    comparedElements: 55296,
    movedPairs: 80,
    movedElements: 80,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 0,
    physioLower: 0,
    physioHigher: 80,
    physioArrivalLater: 0,
    physioArrivalEarlier: 80,
    pairsWherePhysioArrived: 2304,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  /**
   * Every calendar of a grid coarse enough to enumerate whole, and it is now a
   * LIVE physio domain rather than an empty one: 21737 of 114688 pairs reach a
   * physio level, where before the third-book ruling none did.
   */
  COARSE_FULL: {
    pairs: 114688,
    comparedElements: 1605632,
    movedPairs: 95590,
    movedElements: 404116,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 386998,
    physioLower: 0,
    physioHigher: 17118,
    physioArrivalLater: 0,
    physioArrivalEarlier: 16056,
    pairsWherePhysioArrived: 21737,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  /** Adding a whole day of check-ins rather than one. */
  WHOLE_DAY: {
    pairs: 24576,
    comparedElements: 589824,
    movedPairs: 15515,
    movedElements: 108790,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 81936,
    physioLower: 0,
    physioHigher: 26854,
    physioArrivalLater: 0,
    physioArrivalEarlier: 14419,
    pairsWherePhysioArrived: 23768,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  SEEDED_20: {
    pairs: 644,
    comparedElements: 25760,
    movedPairs: 77,
    movedElements: 1269,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 1252,
    physioLower: 0,
    physioHigher: 17,
    physioArrivalLater: 0,
    physioArrivalEarlier: 17,
    pairsWherePhysioArrived: 644,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  SEEDED_40: {
    pairs: 623,
    comparedElements: 49840,
    movedPairs: 315,
    movedElements: 4494,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 4469,
    physioLower: 0,
    physioHigher: 25,
    physioArrivalLater: 0,
    physioArrivalEarlier: 25,
    pairsWherePhysioArrived: 623,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  SEEDED_60: {
    pairs: 650,
    comparedElements: 78000,
    movedPairs: 326,
    movedElements: 10147,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 10136,
    physioLower: 0,
    physioHigher: 11,
    physioArrivalLater: 0,
    physioArrivalEarlier: 11,
    pairsWherePhysioArrived: 650,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  SEEDED_100: {
    pairs: 556,
    comparedElements: 111200,
    movedPairs: 175,
    movedElements: 5689,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 5689,
    physioLower: 0,
    physioHigher: 0,
    physioArrivalLater: 0,
    physioArrivalEarlier: 0,
    pairsWherePhysioArrived: 556,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  /** The pre-ruling engine on the sampled grid: E8's own SEEDED_20 numbers. */
  SEEDED_20_SINGLE_PURSE: {
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
    movedPairs: 106,
    movedElements: 1519,
    violatingPairs: 34,
    trainingIqLower: 280,
    trainingIqHigher: 1184,
    physioLower: 23,
    physioHigher: 32,
    physioArrivalLater: 23,
    physioArrivalEarlier: 32,
    pairsWherePhysioArrived: 644,
    worstTrainingIqDeficit: 0.22852099999999997,
    worstPhysioDeficit: 1,
    worstArrivalDeficitDays: 1,
    lengthMismatches: 0,
  },
  DIAG_SHIPPED: {
    pairs: 5120,
    comparedElements: 122880,
    movedPairs: 3925,
    movedElements: 42722,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 42562,
    physioLower: 0,
    physioHigher: 160,
    physioArrivalLater: 0,
    physioArrivalEarlier: 160,
    pairsWherePhysioArrived: 5120,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  /** E8's DIAG_SHIPPED, reproduced by the control on the same domain. */
  DIAG_SINGLE_PURSE: {
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
  /**
   * One axis per purse. `pairsWherePhysioArrived` is 0, so this arm's physio
   * half is an empty domain and its zeros are zeros about a hook that never
   * fired — pinned so that reads as a fact rather than as evidence.
   */
  DIAG_ONE_PER_FUNDING_FAMILY: {
    pairs: 5120,
    comparedElements: 122880,
    movedPairs: 3766,
    movedElements: 40203,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 40203,
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
  DIAG_NO_ROSTER_SLOT_AXES: {
    pairs: 5120,
    comparedElements: 122880,
    movedPairs: 2417,
    movedElements: 25038,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 24878,
    physioLower: 0,
    physioHigher: 160,
    physioArrivalLater: 0,
    physioArrivalEarlier: 160,
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
  /**
   * The pre-ruling engine's `'save-for-physio-first'` arm with the SAME window
   * moved to day 4 — the reading that explains why its headline zero is a zero.
   * See "explains the save-for-physio zero" below.
   */
  SAVER_LATE_SINGLE_PURSE: {
    pairs: 2304,
    comparedElements: 55296,
    movedPairs: 1416,
    movedElements: 10112,
    violatingPairs: 128,
    trainingIqLower: 603,
    trainingIqHigher: 9429,
    physioLower: 0,
    physioHigher: 80,
    physioArrivalLater: 0,
    physioArrivalEarlier: 80,
    pairsWherePhysioArrived: 2304,
    worstTrainingIqDeficit: 0.432674,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  /** The control for the line above, at its own dial. See `TRAINED_DAY_UPKEEP_GYM_BUCKS`. */
  TRAINED_DAY_UPKEEP: {
    pairs: 45,
    comparedElements: 1800,
    movedPairs: 6,
    movedElements: 43,
    violatingPairs: 6,
    trainingIqLower: 38,
    trainingIqHigher: 0,
    physioLower: 5,
    physioHigher: 0,
    physioArrivalLater: 5,
    physioArrivalEarlier: 0,
    pairsWherePhysioArrived: 45,
    worstTrainingIqDeficit: 0.220372,
    worstPhysioDeficit: 1,
    worstArrivalDeficitDays: 1,
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
  // Which wiring takes a dial is `chargesUpkeep`'s answer rather than a list
  // written here, so a control added to `ENGAGEMENT_WIRINGS` cannot be built
  // wrong by this helper — `engagementWiring` throws on both mismatches.
  const wiring = chargesUpkeep(key)
    ? engagementWiring(
        key,
        key === 'trained-day-upkeep'
          ? ENGAGEMENT_SWEEP.TRAINED_DAY_UPKEEP_GYM_BUCKS
          : ENGAGEMENT_SWEEP.UPKEEP_GYM_BUCKS,
      )
    : key === 'shipped'
      ? shippedEngagementWiring()
      : engagementWiring(key, 0);
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
    // the windowed sweep's physio domain non-empty. Day 4 rather than day 7:
    // under GDD §5.4's third-book ruling the physio purse fills at the baseline
    // line with no other spender drawing on it.
    expect(shipped.census.physioArrivalDay).toBe(4);
    let controlsDriven = 0;
    for (const key of ENGAGEMENT_WIRINGS) {
      if (key === SHIPPED_ENGAGEMENT_WIRING) continue;
      const control = runFor(days, history, key);
      expect(engagementRunFaults(control), key).toEqual([]);
      expect(control.census.upkeepEvents > 0, key).toBe(chargesUpkeep(key));
      controlsDriven += 1;
    }
    // A count over the real list, so a control added to `ENGAGEMENT_WIRINGS`
    // and never driven is red here rather than quietly unswept.
    expect(controlsDriven).toBe(ENGAGEMENT_WIRINGS.length - 1);
    expect(controlsDriven).toBe(4);
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
  it('measures the shipped engine, and BOTH halves are zero', () => {
    const tally = windowedSweep(
      ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
      0,
      ENGAGEMENT_SWEEP.WINDOW_SLOTS,
    );
    // The headline number FIRST, so a mutant that brings the violations back
    // fails with "expected 2954 to be 0" rather than with two elided objects —
    // CLAUDE.md's "a check that bites but fails uselessly is half a check".
    expect(tally.violatingPairs).toBe(0);
    expect(tally.trainingIqLower).toBe(0);
    expect(tally.physioArrivalLater).toBe(0);
    expect(tally).toEqual(MEASURED.WINDOWED_SHIPPED);
    // The comparator is live on this domain, which is what stops the zero being
    // a zero about a sweep that compared nothing: 19778 of 24576 pairs moved,
    // and the more-engaged gym was paid MORE on 205848 day-elements.
    expect(tally.movedPairs).toBeGreaterThan(0);
    expect(tally.trainingIqHigher).toBeGreaterThan(0);
  });

  it('measures the SINGLE-PURSE engine on the same domain, and it is not zero', () => {
    // The control GDD §5.4's third-book ruling came from, and the one every
    // zero in this file is a zero against. `'single-purse'` keeps the clock
    // split and the wall-clock money and puts every wall-clock spender back on
    // one balance; the ledger it produces is the one piece E8 measured, and
    // these are E8's own numbers.
    const tally = windowedSweep(
      ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
      0,
      ENGAGEMENT_SWEEP.WINDOW_SLOTS,
      'single-purse',
    );
    expect(tally.violatingPairs).toBe(2954);
    expect(tally.trainingIqLower).toBe(25772);
    expect(tally).toEqual(MEASURED.WINDOWED_SINGLE_PURSE);
    // The two arms ran the same 24576 pairs and the same 589824 elements, so
    // the difference between them is the funding rule and nothing else.
    expect(tally.pairs).toBe(MEASURED.WINDOWED_SHIPPED.pairs);
    expect(tally.comparedElements).toBe(MEASURED.WINDOWED_SHIPPED.comparedElements);
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
  it('finds no violation, on a physio domain that is no longer empty', () => {
    // Every calendar of seven days at two check-ins a day — 114688 pairs, whole
    // rather than windowed. E8 recorded this grid's physio half as an EMPTY
    // domain: at one wall-clock purse the rung was never reached inside seven
    // days. It is reached now, in 21737 pairs, so this is a live exhaustive
    // reading on both series rather than a reading on one.
    const tally = fullyExhaustiveSweep(
      ENGAGEMENT_SWEEP.COARSE_HORIZON_DAYS,
      ENGAGEMENT_SWEEP.COARSE_CHECK_INS_PER_DAY,
    );
    expect(tally.violatingPairs).toBe(0);
    expect(tally.pairsWherePhysioArrived).toBe(21737);
    expect(tally).toEqual(MEASURED.COARSE_FULL);
    expect(tally.movedPairs).toBeGreaterThan(0);
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
  it('pins all three controls above the shipped engine on the grid it is measured on', () => {
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
    expect(seededSweep(days, trials, ENGAGEMENT_SWEEP.SEEDS[0], 'single-purse')).toEqual(
      MEASURED.SEEDED_20_SINGLE_PURSE,
    );
    expect(seededSweep(days, trials, ENGAGEMENT_SWEEP.SEEDS[0], 'accelerated-purse')).toEqual(
      MEASURED.SEEDED_20_ACCELERATED_PURSE,
    );
    expect(seededSweep(days, trials, ENGAGEMENT_SWEEP.SEEDS[0], 'check-in-upkeep')).toEqual(
      MEASURED.SEEDED_20_CHECK_IN_UPKEEP,
    );
    // 0 against 4, 12 and 34 on one grid. The pre-ruling purse is the smallest
    // of the three and it is the one that matters: it is not a synthetic
    // variant, it is what this directory shipped a wave ago.
    expect(MEASURED.SEEDED_20.violatingPairs).toBe(0);
    expect(MEASURED.SEEDED_20_SINGLE_PURSE.violatingPairs).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// The term is the spending order, measured rather than argued
// ---------------------------------------------------------------------------

describe('the term the third-book ruling removed, decomposed on one domain', () => {
  it('is zero on every arm of the shipped engine and 566 on the same arm pre-ruling', () => {
    // Three arms on ONE domain, each with one term removed and nothing else
    // changed, so the contrast is a decomposition rather than three unrelated
    // readings. The shipped arm is measured here rather than borrowed, because
    // the headline sweep runs a wider window.
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const slots = ENGAGEMENT_SWEEP.DIAGNOSTIC_WINDOW_SLOTS;
    expect(windowedSweep(days, 0, slots)).toEqual(MEASURED.DIAG_SHIPPED);
    // The same domain on the pre-ruling engine, which is where E8's 566 came
    // from. Every arm below is zero on the shipped engine, so without this line
    // the decomposition would be three zeros with nothing to decompose.
    expect(windowedSweep(days, 0, slots, 'single-purse')).toEqual(MEASURED.DIAG_SINGLE_PURSE);
    expect(MEASURED.DIAG_SINGLE_PURSE.violatingPairs).toBe(566);
    expect(MEASURED.DIAG_SHIPPED.violatingPairs).toBe(0);
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
  /**
   * Every spending policy on the headline domain, under the shipped engine.
   *
   * Five of the six are zero. `'cheapest-affordable-first'` is not listed
   * because it is byte-identical to `'fixed-order-no-rotation'` here — see the
   * check that pins the coincidence rather than counting the row twice — and
   * the shipped row is asserted against `MEASURED.WINDOWED_SHIPPED` itself so
   * the two harnesses cannot quietly disagree.
   */
  WINDOWED: Object.freeze({
    'fixed-order-no-rotation': {
      pairs: 24576,
      comparedElements: 589824,
      movedPairs: 19361,
      movedElements: 201661,
      violatingPairs: 0,
      trainingIqLower: 0,
      trainingIqHigher: 200625,
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
    'costliest-affordable-first': {
      pairs: 24576,
      comparedElements: 589824,
      movedPairs: 19993,
      movedElements: 210029,
      violatingPairs: 0,
      trainingIqLower: 0,
      trainingIqHigher: 208993,
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
    'save-for-physio-first': {
      pairs: 24576,
      comparedElements: 589824,
      movedPairs: 19361,
      movedElements: 201661,
      violatingPairs: 0,
      trainingIqLower: 0,
      trainingIqHigher: 200625,
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
      movedPairs: 10403,
      movedElements: 99837,
      violatingPairs: 7245,
      trainingIqLower: 64189,
      trainingIqHigher: 35136,
      physioLower: 0,
      physioHigher: 512,
      physioArrivalLater: 0,
      physioArrivalEarlier: 512,
      pairsWherePhysioArrived: 24576,
      worstTrainingIqDeficit: 0.13604700000000003,
      worstPhysioDeficit: 0,
      worstArrivalDeficitDays: 0,
      lengthMismatches: 0,
    },
  }),

  /**
   * The same six on the PRE-RULING engine, on the same domain — piece E8's
   * table, reproduced number for number by `'single-purse'`.
   *
   * This block is what makes the zeros above readable: every one of them is a
   * zero where the engine one wave ago was not zero, except
   * `'save-for-physio-first'`, whose own zero E8 could not explain and which is
   * explained below.
   */
  WINDOWED_SINGLE_PURSE: Object.freeze({
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

  /** The pre-ruling violating-pair counts alone, as the table the report quotes. */
  SINGLE_PURSE_VIOLATING_PAIRS: Object.freeze({
    'rotate-greedy-per-check-in': 2954,
    'fixed-order-no-rotation': 2751,
    'cheapest-affordable-first': 2751,
    'costliest-affordable-first': 3427,
    'save-for-physio-first': 0,
    'spend-once-per-calendar-day': 10122,
  }),

  /**
   * The same six on a SECOND domain. Every arm is zero except the day-granularity
   * one, which is 60 here and 44 at forty days.
   */
  SEEDED_20: Object.freeze({
    'rotate-greedy-per-check-in': { pairs: 644, movedPairs: 77, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'fixed-order-no-rotation': { pairs: 644, movedPairs: 73, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'cheapest-affordable-first': { pairs: 644, movedPairs: 73, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'costliest-affordable-first': { pairs: 644, movedPairs: 80, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'save-for-physio-first': { pairs: 644, movedPairs: 73, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'spend-once-per-calendar-day': { pairs: 644, movedPairs: 69, violatingPairs: 60, trainingIqLower: 1010, physioArrivalLater: 6, worstTrainingIqDeficit: 0.00815699999999997 },
  }),
  SEEDED_40: Object.freeze({
    'rotate-greedy-per-check-in': { pairs: 623, movedPairs: 315, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'fixed-order-no-rotation': { pairs: 623, movedPairs: 315, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'cheapest-affordable-first': { pairs: 623, movedPairs: 315, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'costliest-affordable-first': { pairs: 623, movedPairs: 315, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'save-for-physio-first': { pairs: 623, movedPairs: 315, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'spend-once-per-calendar-day': { pairs: 623, movedPairs: 250, violatingPairs: 44, trainingIqLower: 964, physioArrivalLater: 1, worstTrainingIqDeficit: 0.01576500000000003 },
  }),

  /**
   * Adding a WHOLE DAY rather than one check-in, under every policy. Zero on
   * all six now, including the day-granularity one that measured 600 before the
   * third-book ruling.
   */
  WHOLE_DAY_VIOLATING_PAIRS: Object.freeze({
    'rotate-greedy-per-check-in': 0,
    'fixed-order-no-rotation': 0,
    'cheapest-affordable-first': 0,
    'costliest-affordable-first': 0,
    'save-for-physio-first': 0,
    'spend-once-per-calendar-day': 0,
  }),

  /**
   * One full-attendance run per policy, so a tally taken under a policy that
   * bought nothing would report itself instead of being a quiet zero.
   */
  FULL_ATTENDANCE_CENSUS: Object.freeze({
    'rotate-greedy-per-check-in': { spendingMoments: 72, recruits: 5, expansions: 5, physioArrivalDay: 4 },
    'fixed-order-no-rotation': { spendingMoments: 72, recruits: 5, expansions: 5, physioArrivalDay: 4 },
    'cheapest-affordable-first': { spendingMoments: 72, recruits: 5, expansions: 5, physioArrivalDay: 4 },
    'costliest-affordable-first': { spendingMoments: 72, recruits: 5, expansions: 5, physioArrivalDay: 4 },
    'save-for-physio-first': { spendingMoments: 72, recruits: 5, expansions: 5, physioArrivalDay: 4 },
    'spend-once-per-calendar-day': { spendingMoments: 12, recruits: 5, expansions: 5, physioArrivalDay: 5 },
  }),
} as const);

/** The headline windowed sweep under one policy and one wiring. Same domain, same comparator. */
function policyWindowed(
  spending: EmpireSpendingPolicy,
  key: EngagementWiringKey = 'shipped',
): EngagementTally {
  return windowedSweep(
    ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
    0,
    ENGAGEMENT_SWEEP.WINDOW_SLOTS,
    key,
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

/**
 * Two tests in this block need more than `vitest.config.ts`'s 30 s, and they are
 * given a budget rather than a smaller sweep.
 *
 * That config's own comment sets the standard: *"those tests earn their time —
 * they rasterise real frames and enumerate whole calendars — so the honest fix
 * is a budget that fits the work, not a smaller sweep"*, and equally that
 * raising the GLOBAL timeout would hide how thin the margin is elsewhere. So
 * this is local: the global budget is untouched and every other test in the
 * repository still fails at 30 s.
 *
 * MEASURED here, solo on an unloaded machine, the four slowest in this file:
 *
 *   40736 ms  splits that arm by whether the extra check-in moved the day…
 *   38670 ms  measures the rotation phase removed: fixed order, and cheapest…
 *   24436 ms  measures the ordering reversed: costliest affordable first
 *   22282 ms  explains the save-for-physio zero instead of repeating it
 *
 * The gap between the top two and the rest is not mysterious: the sibling arms
 * run two full windowed sweeps and these run three, because each also takes the
 * pre-ruling single-purse reading the zero is zero against. Deleting that would
 * turn a decomposition back into two blank readings, which is the trade this
 * file was written to refuse.
 *
 * The number is not a round guess — it is roughly 2.2× the slowest measurement,
 * because the suite runs these in parallel under load and the failure that
 * produced this comment was a 39 s test in a 30 s budget on a run whose whole
 * file took 287 s. Re-measure rather than trusting these four lines if a run
 * comes in near it; that is the mistake the config's own stale list records.
 */
const SLOW_SWEEP_TIMEOUT_MS = 90_000;

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

  it('separates every spending policy on the ledger runEmpire itself produces', () => {
    // THE M10 HOLE, CLOSED. Deliberately NOT titled with a bracketed id: the
    // `@guarantee` convention binds a bracketed id to a `MUTATION_WITNESSES`
    // entry in `src/game/guaranteeTags.test.ts`, which this piece may not edit,
    // and a tag with no witness is exactly the unbacked pointer that file
    // exists to refuse. The mutants are recorded in this piece's report
    // instead. The hole this replaces: `runEmpire` names
    // `SHIPPED_SPENDING_POLICY` at one call site, and under
    // `EMPIRE_SWEEP.AXIS_ORDER` at twelve days four of the six policies produce
    // a byte-identical ledger — so swapping that call site to any of the other
    // three reddened NOTHING in the directory. The previous wave pinned the
    // hole and said plainly that was weaker than closing it.
    //
    // What closes it is driving `runEmpire` on a fixture where the six policies
    // are six different functions of the same state: twenty days, and an axis
    // order whose level-1 prices are not ascending inside the roster purse
    // (`M10_AXIS_ORDER` puts the 1000 spotter rung ahead of the 800 space one).
    // Price-ascending order is exactly what made `'cheapest-affordable-first'`
    // and `'fixed-order-no-rotation'` the same policy, and twenty days is what
    // gives the rotation something to change.
    //
    // The assertion is that the set of policies whose ledger equals
    // `runEmpire`'s is exactly `[SHIPPED_SPENDING_POLICY]`. Swapping the call
    // site to any other policy moves `runEmpire`'s ledger onto that policy's,
    // so the set becomes that policy instead and this line goes red — verified
    // by running all four mutants.
    const days = ENGAGEMENT_SWEEP.M10_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
    const order = ENGAGEMENT_SWEEP.M10_AXIS_ORDER;
    const policy = policyFor(cadence, order);
    const theirs = runEmpire(days, policy, BASELINE_PLAN, socialInputs());
    const history = fullAttendance(days, cadence);
    const matches: EmpireSpendingPolicy[] = [];
    const separated: EmpireSpendingPolicy[] = [];
    for (const spending of EMPIRE_SPENDING_POLICIES) {
      const mine = runFor(days, history, 'shipped', order, cadence, spending);
      if (JSON.stringify(mine.ledger) === JSON.stringify(theirs.ledger)) matches.push(spending);
      else separated.push(spending);
    }
    expect(matches).toEqual([SHIPPED_SPENDING_POLICY]);
    expect(separated.length).toBe(EMPIRE_SPENDING_POLICIES.length - 1);
    expect(separated).toEqual([
      'fixed-order-no-rotation',
      'cheapest-affordable-first',
      'costliest-affordable-first',
      'save-for-physio-first',
      'spend-once-per-calendar-day',
    ]);
    // The ledger really is non-trivial on this fixture, so the separation is
    // not five comparisons of empty lists.
    expect(theirs.ledger.length).toBe(days * 4);
    expect(theirs.census.recruits).toBeGreaterThan(0);
    expect(theirs.census.expansions).toBeGreaterThan(0);
    // And the fixture's own load-bearing property, stated as a check rather
    // than as a comment: the two policies the shipped axis order cannot tell
    // apart ARE told apart here. If a price change ever made
    // `M10_AXIS_ORDER` ascending again, this is the line that reddens rather
    // than the two arms silently re-merging.
    const fixedLedger = runFor(days, history, 'shipped', order, cadence, 'fixed-order-no-rotation');
    const cheapestLedger = runFor(
      days,
      history,
      'shipped',
      order,
      cadence,
      'cheapest-affordable-first',
    );
    expect(JSON.stringify(fixedLedger.ledger) === JSON.stringify(cheapestLedger.ledger)).toBe(
      false,
    );
  });

  it('still cannot separate cheapest-first from fixed order on the SHIPPED axis order', () => {
    // The coincidence the fixture above works around, pinned where a reader
    // meets it. On `EMPIRE_SWEEP.AXIS_ORDER` the level-1 prices ascend inside
    // every purse — 800 space before 1000 spotter, 1200 coach before 1500
    // equipment — so "cheapest affordable first" and "the declared order" pick
    // the same axis every time and the two policies are one policy. This is a
    // fact about `EMPIRE_TUNING`'s prices, not about the policies, and it
    // reddens if a price moves.
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
    const history = fullAttendance(days, cadence);
    const fixed = runFor(
      days,
      history,
      'shipped',
      ENGAGEMENT_SWEEP.AXIS_ORDER,
      cadence,
      'fixed-order-no-rotation',
    );
    const cheapest = runFor(
      days,
      history,
      'shipped',
      ENGAGEMENT_SWEEP.AXIS_ORDER,
      cadence,
      'cheapest-affordable-first',
    );
    expect(cheapest.ledger).toEqual(fixed.ledger);
    // The prices the coincidence rests on, read from the tuning block rather
    // than transcribed, in the order `AXIS_ORDER` offers them.
    const spaceOne = EMPIRE_TUNING.SPACE_LEVEL_COST_GYM_BUCKS[0] as number;
    const spotterOne = EMPIRE_TUNING.STAFF_LEVEL_COST_GYM_BUCKS.spotter[0] as number;
    const coachOne = EMPIRE_TUNING.STAFF_LEVEL_COST_GYM_BUCKS.coach[0] as number;
    const equipmentOne = EMPIRE_TUNING.EQUIPMENT_TIER_COST_GYM_BUCKS['comp-plates'];
    expect(spaceOne).toBeLessThan(spotterOne);
    expect(coachOne).toBeLessThan(equipmentOne);
    expect([spaceOne, spotterOne, coachOne, equipmentOne]).toEqual([800, 1000, 1200, 1500]);
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

  it('reproduces the headline exactly under the shipped policy', () => {
    // The first thing that has to hold: if this arm did not land on
    // `MEASURED.WINDOWED_SHIPPED` byte for byte, the two harnesses would
    // disagree and nothing else in this section would be worth reading. It is
    // asserted against that object rather than against a transcription of it.
    expect(policyWindowed(SHIPPED_SPENDING_POLICY)).toEqual(MEASURED.WINDOWED_SHIPPED);
    expect(MEASURED.WINDOWED_SHIPPED.violatingPairs).toBe(0);
    // And the same arm on the pre-ruling engine, which is the 2954 this file's
    // header quotes.
    expect(policyWindowed(SHIPPED_SPENDING_POLICY, 'single-purse')).toEqual(
      MEASURED.WINDOWED_SINGLE_PURSE,
    );
  });

  it('measures the rotation phase removed: fixed order, and cheapest-first with it', () => {
    // Two arms, and they come out IDENTICAL — measured, not arranged. On
    // `EMPIRE_TUNING`'s shipped ladders `AXIS_ORDER` is already price-ascending
    // inside each purse at every rung this domain reaches, so "cheapest
    // affordable first" and "the declared order" pick the same axis every time.
    // If a price moves, they separate and this line goes red rather than the
    // two arms silently continuing to be counted as independent evidence.
    const fixed = policyWindowed('fixed-order-no-rotation');
    const cheapest = policyWindowed('cheapest-affordable-first');
    expect(fixed).toEqual(MEASURED_POLICY.WINDOWED['fixed-order-no-rotation']);
    expect(cheapest).toEqual(fixed);
    expect(fixed.violatingPairs).toBe(0);
    // Both are zero on the shipped engine and both were not before the ruling,
    // so the pair is a decomposition rather than two blank readings.
    expect(policyWindowed('fixed-order-no-rotation', 'single-purse')).toEqual(
      MEASURED_POLICY.WINDOWED_SINGLE_PURSE['fixed-order-no-rotation'],
    );
    expect(
      MEASURED_POLICY.WINDOWED_SINGLE_PURSE['fixed-order-no-rotation'].violatingPairs,
    ).toBe(2751);
  }, SLOW_SWEEP_TIMEOUT_MS);

  it('measures the ordering reversed: costliest affordable first', () => {
    const tally = policyWindowed('costliest-affordable-first');
    expect(tally).toEqual(MEASURED_POLICY.WINDOWED['costliest-affordable-first']);
    expect(tally.violatingPairs).toBe(0);
    // The worst arm of the pre-ruling engine, on the same domain, is 3427.
    expect(policyWindowed('costliest-affordable-first', 'single-purse')).toEqual(
      MEASURED_POLICY.WINDOWED_SINGLE_PURSE['costliest-affordable-first'],
    );
  });

  it('explains the save-for-physio zero instead of repeating it', () => {
    // THE HOLE THIS CLOSES. Piece E8 measured `'save-for-physio-first'` at zero
    // on this window under the single-purse engine and could not say why, while
    // the same policy gave 15 at twenty seeded days and 138 at forty. An
    // unexplained zero is what this run keeps catching, so it is chased here to
    // a mechanism rather than re-pinned.
    //
    // The mechanism is the WINDOW'S POSITION, and the measurement that shows it
    // is moving the window. While the gym is saving, the policy refuses every
    // other wall-clock spender — `axisSpendingOrder` offers only the physio rung
    // and `maySpendOnRoster` refuses a recruit — so under ONE purse there is
    // exactly one spender during the hold, and one spender's purchase day is
    // monotone in accrual. Physio arrives on day 4 at full attendance, and the
    // headline window varies only the first twelve slots, which is days 0 and
    // 1: the whole varied region sits inside the hold, and every slot after it
    // is attended on both sides. So the schedule has nothing contended to move
    // and the zero is a fact about where the window is.
    //
    // Move the same window to day 4, after the hold has ended and the contest
    // has resumed, and the same policy on the same engine gives 128 violating
    // pairs and 603 lower Training IQ days. That is the empty-domain shape
    // named rather than left as a coincidence.
    expect(policyWindowed('save-for-physio-first')).toEqual(
      MEASURED_POLICY.WINDOWED['save-for-physio-first'],
    );
    expect(policyWindowed('save-for-physio-first', 'single-purse')).toEqual(
      MEASURED_POLICY.WINDOWED_SINGLE_PURSE['save-for-physio-first'],
    );
    expect(
      MEASURED_POLICY.WINDOWED_SINGLE_PURSE['save-for-physio-first'].violatingPairs,
    ).toBe(0);
    const lateSingle = windowedSweep(
      ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
      ENGAGEMENT_SWEEP.LATE_WINDOW_FROM_SLOT,
      ENGAGEMENT_SWEEP.LATE_WINDOW_SLOTS,
      'single-purse',
      ENGAGEMENT_SWEEP.AXIS_ORDER,
      'save-for-physio-first',
    );
    expect(lateSingle.violatingPairs).toBe(128);
    expect(lateSingle.trainingIqLower).toBe(603);
    expect(lateSingle).toEqual(MEASURED.SAVER_LATE_SINGLE_PURSE);
    // The physio rung really does land on day 4 under this policy, which is
    // what puts the headline window inside the hold and the late window after
    // it. Both wirings, because the claim is about the hold rather than about
    // the purse split.
    const full = fullAttendance(
      ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
      ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY,
    );
    for (const key of ['shipped', 'single-purse'] as const) {
      const run = runFor(
        ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
        full,
        key,
        ENGAGEMENT_SWEEP.AXIS_ORDER,
        ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY,
        'save-for-physio-first',
      );
      expect(run.census.physioArrivalDay, key).toBe(4);
    }
    // And the ruling closes the late window too, which is the half that says
    // the fix is not the hold.
    const lateShipped = windowedSweep(
      ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
      ENGAGEMENT_SWEEP.LATE_WINDOW_FROM_SLOT,
      ENGAGEMENT_SWEEP.LATE_WINDOW_SLOTS,
      'shipped',
      ENGAGEMENT_SWEEP.AXIS_ORDER,
      'save-for-physio-first',
    );
    expect(lateShipped.violatingPairs).toBe(0);
    expect(lateShipped.pairs).toBe(lateSingle.pairs);
  });

  it('measures the per-check-in granularity removed, and splits the arm that is not zero', () => {
    // THE ONE ARM THAT IS NOT ZERO. 7245 of 24576, and the split below says
    // 7240 of them are one mechanism that no purse arrangement reaches.
    const tally = policyWindowed('spend-once-per-calendar-day');
    expect(tally.violatingPairs).toBe(7245);
    expect(tally).toEqual(MEASURED_POLICY.WINDOWED['spend-once-per-calendar-day']);
    // Better than the pre-ruling engine on the same domain, and better on the
    // physio half in particular: 5484 later arrivals become none.
    expect(policyWindowed('spend-once-per-calendar-day', 'single-purse')).toEqual(
      MEASURED_POLICY.WINDOWED_SINGLE_PURSE['spend-once-per-calendar-day'],
    );
    expect(tally.physioArrivalLater).toBe(0);
    expect(
      MEASURED_POLICY.WINDOWED_SINGLE_PURSE['spend-once-per-calendar-day'].physioArrivalLater,
    ).toBe(5484);
  });

  it('splits that arm by whether the extra check-in moved the day it spends at', () => {
    // The diagnosis, on the same twelve slots the headline enumerates, so the
    // two halves add up to the count above rather than describing another
    // domain. A pair is on the left when the extra check-in is later in its day
    // than every check-in the baseline took, which is the definition of
    // `lastCheckInOfDay` this policy spends at.
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
    const window = ENGAGEMENT_SWEEP.SPEND_ONCE_WINDOW_SLOTS;
    const slots = days * cadence;
    let movesMoment = 0;
    let movesMomentViolating = 0;
    let keepsMoment = 0;
    let keepsMomentViolating = 0;
    for (let mask = 0; mask < 1 << window; mask += 1) {
      const attended = (slot: number): boolean =>
        slot >= window ? true : (mask & (1 << slot)) !== 0;
      const history = historyFrom(slots, attended, BASE_TRAINED_DAYS);
      const baseline = runFor(
        days,
        history,
        'shipped',
        ENGAGEMENT_SWEEP.AXIS_ORDER,
        cadence,
        'spend-once-per-calendar-day',
      );
      for (let bit = 0; bit < window; bit += 1) {
        if ((mask & (1 << bit)) !== 0) continue;
        const day = Math.floor(bit / cadence);
        let lastAttended = -1;
        for (let tick = 0; tick < cadence; tick += 1) {
          if (attended(day * cadence + tick)) lastAttended = tick;
        }
        const divergence = compareEngagement(
          baseline,
          runFor(
            days,
            moreEngagedBy(history, bit),
            'shipped',
            ENGAGEMENT_SWEEP.AXIS_ORDER,
            cadence,
            'spend-once-per-calendar-day',
          ),
        );
        if (bit - day * cadence > lastAttended) {
          movesMoment += 1;
          if (divergence.violating) movesMomentViolating += 1;
        } else {
          keepsMoment += 1;
          if (divergence.violating) keepsMomentViolating += 1;
        }
      }
    }
    expect({ movesMoment, movesMomentViolating, keepsMoment, keepsMomentViolating }).toEqual({
      movesMoment: 8064,
      movesMomentViolating: 7240,
      keepsMoment: 16512,
      keepsMomentViolating: 5,
    });
    // The two halves are the headline count, so neither is a different domain.
    expect(movesMoment + keepsMoment).toBe(
      MEASURED_POLICY.WINDOWED['spend-once-per-calendar-day'].pairs,
    );
    expect(movesMomentViolating + keepsMomentViolating).toBe(
      MEASURED_POLICY.WINDOWED['spend-once-per-calendar-day'].violatingPairs,
    );
  }, SLOW_SWEEP_TIMEOUT_MS);

  it('names the second mechanism behind the five that remain: the recruit price curve', () => {
    // The five keeps-moment violators are not the spending moment, so they are
    // a mechanism of their own and it is a real one. In each, an extra check-in
    // splits a gap the offline cap was truncating, so the more-engaged gym has
    // MORE money at the same instant — and `bestRecruitableTier` spends it on
    // the best tier it can afford, which is the worst tier per Buck.
    //
    // Gym Bucks per unit of Training IQ rises strictly along `NPC_TIERS`, so a
    // gym with more money at one decision buys strictly less Training IQ with
    // it. That is a property of the price table and of the simulated player's
    // choice rule; no purse arrangement touches it, which is why it survives
    // the third-book ruling. Stated as a unit fact so it cannot be mistaken for
    // a sweep artefact, and so a re-priced ladder reddens here.
    const perIq = EMPIRE_TUNING.NPC_TIERS.map(
      (tier) =>
        EMPIRE_TUNING.NPC_RECRUIT_COST_GYM_BUCKS[tier] /
        EMPIRE_TUNING.NPC_TIER_OUTPUT_MULTIPLIER[tier],
    );
    let rises = 0;
    for (let at = 1; at < perIq.length; at += 1) {
      expect(perIq[at] as number).toBeGreaterThan(perIq[at - 1] as number);
      rises += 1;
    }
    expect(rises).toBe(EMPIRE_TUNING.NPC_TIERS.length - 1);
    expect(rises).toBe(4);
    expect(perIq.map((cost) => Math.round(cost))).toEqual([500, 1250, 3200, 7500, 13846]);
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
   * The list this returns is the point. Before the third-book ruling it was
   * EMPTY at both horizons — no policy was zero on a second domain, which is
   * what made the windowed zeros unreadable. It is five of six now, and the
   * sixth is the day-granularity policy the section above diagnoses.
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

  /** Every policy but the day-granularity one, in `EMPIRE_SPENDING_POLICIES` order. */
  const ZERO_AT_EVERY_SEEDED_HORIZON: readonly EmpireSpendingPolicy[] =
    EMPIRE_SPENDING_POLICIES.filter((policy) => policy !== 'spend-once-per-calendar-day');

  it('finds five of the six policies zero at 20 seeded days', () => {
    expect(seededArm(20, 12, ENGAGEMENT_SWEEP.SEEDS[0], MEASURED_POLICY.SEEDED_20)).toEqual([
      ...ZERO_AT_EVERY_SEEDED_HORIZON,
    ]);
    expect(ZERO_AT_EVERY_SEEDED_HORIZON.length).toBe(5);
  });

  it('finds five of the six policies zero at 40 seeded days', () => {
    expect(seededArm(40, 6, ENGAGEMENT_SWEEP.SEEDS[1], MEASURED_POLICY.SEEDED_40)).toEqual([
      ...ZERO_AT_EVERY_SEEDED_HORIZON,
    ]);
  });

  /**
   * The whole-day reading, re-taken under a policy at a time.
   *
   * Before the third-book ruling the day-granularity policy was 600 of 24576
   * here while the other five were zero. All six are zero now — an extra whole
   * day of check-ins moves nothing down under any model of a player measured,
   * which is the reading the slot-level split above is the finer version of.
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

  it('takes the whole-day reading under the last three, and all six are zero', () => {
    expect(wholeDayArm(SECOND_HALF)).toBe(3);
    // Named here rather than left in the table: the arm that measured 600
    // before the ruling is the day-granularity policy, and it is zero now.
    expect(MEASURED_POLICY.WHOLE_DAY_VIOLATING_PAIRS['spend-once-per-calendar-day']).toBe(0);
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
    const shipped = trainedDaySweep(days, trials, seed);
    expect(shipped).toEqual(MEASURED.TRAINED_DAY_SHIPPED);
    expect(shipped.movedElements).toBe(0);
    const control = trainedDaySweep(days, trials, seed, 'trained-day-upkeep');
    expect(control).toEqual(MEASURED.TRAINED_DAY_UPKEEP);
    // The control moves, which is the whole reason it is beside the zero. At
    // `UPKEEP_GYM_BUCKS` it did not — see `TRAINED_DAY_UPKEEP_GYM_BUCKS` for
    // the measurement that made this a dial of its own rather than a shared one.
    expect(control.movedElements).toBeGreaterThan(0);
    expect(control.violatingPairs).toBe(6);
    expect(control.physioArrivalLater).toBe(5);
  });
});
