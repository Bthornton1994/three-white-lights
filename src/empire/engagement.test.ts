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
 * under ALL SIX spending policies: 0 violating pairs on the exhaustive
 * 24576-pair window, 0 on every calendar of a coarse grid enumerated whole
 * (114688 pairs), 0 at 20, 40, 60 and 100 seeded days, and 0 for an extra
 * TRAINED day at every element.
 *
 * A DOMAIN IS A DOMAIN FOR THE POLICY IT WAS RUN AT, and for the sixth policy
 * that is a separate list. `runEngagement` reads `EMPIRE_DAY_SPENDING_ANCHORS`
 * under `'spend-once-per-calendar-day'` and under nothing else, while
 * `windowedSweep` and `seededSweep` both DEFAULT `spending` to the per-check-in
 * policy — so a sweep called without one carries the shipped anchor's name and
 * asks it nothing. The domains that actually exercise the anchor are the rows
 * of `ANCHOR_DOMAINS` near the foot of this file, each with the count of
 * questions its runs put to the anchor pinned beside its violating count.
 *
 * THE SIXTH USED TO BE 6459 AND THE SPECIFICATION IS WHAT CHANGED, not the
 * count. `'spend-once-per-calendar-day'` said "the day's takings are spent at
 * the last check-in the player takes"; it now says "each purse buys at most
 * once a calendar day, at the first check-in of that day it can afford its next
 * rung". `EMPIRE_DAY_SPENDING_ANCHORS` is the four readings of that sentence,
 * all four are runnable, and the three the game does not ship are controls with
 * their counts pinned below. See "the anchor is the specification" further
 * down.
 *
 * WHAT THE ZEROS ARE ZEROS AGAINST, because a zero with nothing beside it is
 * the empty-domain vacuity CLAUDE.md keeps recording. `'single-purse'` is the
 * engine as it stood before GDD §5.4's third-book ruling — the same clock
 * split, the same wall-clock money, and every wall-clock spender back on ONE
 * balance — driven through the same loop by one parameter. On the identical
 * domain it gives:
 *
 *   policy                        shipped   single purse (pre-ruling)
 *   rotate-greedy-per-check-in          0        3003
 *   fixed-order-no-rotation             0        2800
 *   cheapest-affordable-first           0        2800
 *   costliest-affordable-first          0        3503
 *   save-for-physio-first               0           0
 *   spend-once-per-calendar-day         0        2887
 *
 * all on 24576 pairs and 589824 compared elements. The last row read 6459 and
 * 3908 under the anchor this piece replaced.
 *
 * The right-hand column moved when §5.3's promotion path landed, and saying so
 * is the point of writing it down. It read 2954 / 2751 / 2751 / 3427 / 0 /
 * 10122 — piece E8's own table, reproduced number for number, which is what
 * said the control was the old engine rather than an approximation of it. A gym
 * that can move a filled roster slot up spends differently, so this control is
 * now the pre-third-book FUNDING rule on the post-repair roster rather than
 * E8's whole engine. It is still a control: same domain, one parameter apart
 * from the subject, non-zero on five of six policies — and non-zero on the
 * sixth too under every one of its four day anchors, 2887 to 3908. It is no
 * longer a
 * historical reproduction, and `'one-way-door'` is the parameter that
 * reproduces the roster as it was.
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
 * The anchor is the specification, and it was the specification that was wrong
 * ===========================================================================
 *
 * "Spends once a calendar day" does not say WHICH check-in of the day. That
 * unstated half was carrying the whole residue, and once it is written down as
 * a parameter the four readings of it measure, on the identical domain and the
 * shipped engine:
 *
 *   anchor                                 shipped   single purse
 *   first-affordable-check-in-per-purse          0           2887   <- SHIPPED
 *   first-affordable-check-in                   31           2878
 *   first-attended-check-in                   1951           3104
 *   last-attended-check-in                    6459           3908
 *
 * WHY THE OLD ANCHOR COULD NOT BE ZERO, and it is structural rather than a
 * tuning accident: adding a check-in can only move the day's LAST one later or
 * leave it. Money accrues on the wall clock and a purchase converts money into
 * a wall-clock timer, so a later purchase starts a later build and finishes
 * later. `'last-attended-check-in'` is anti-monotone in engagement by
 * construction, and the extra check-in's only effect on the decision is to
 * defer it. That is why its residue was 6459 of the 8064 pairs where the extra
 * check-in moved the day's decision moment and 0 of the 16512 where it did not.
 *
 * WHY MOVING THE ANCHOR EARLIER IS NOT ENOUGH ON ITS OWN, measured rather than
 * assumed, because it is the obvious next guess and it is wrong. Under
 * `'first-attended-check-in'` the anchor moves earlier or not at all — and the
 * gym then shops with LESS money accrued and commits to a rung it would
 * otherwise have skipped, or to nothing at all. 1951 violating pairs, worst
 * deficit 0.263 Training IQ per day, which is twenty-six times the old
 * anchor's worst deficit. Violations in the other direction are real and this
 * is their count.
 *
 * `'first-affordable-check-in'` is the repair for that and gets to 31: the day's
 * trip is offered again at the next check-in when it could buy nothing, so a
 * broke morning no longer costs the day. The 31 that survive were traced rather
 * than argued, and all 31 come from one shape — the extra check-in is the day's
 * new EARLIEST one, the gym shops there, the roster purse holds 460 Gym Bucks
 * against a 500 novice and buys nothing, and the day's trip is over because
 * some OTHER purse could afford its rung. One purse's affordability closed
 * every purse's day.
 *
 * `'first-affordable-check-in-per-purse'` is what ships and it is the same
 * sentence taken purse by purse: GDD §5.4's third-book ruling already gave each
 * funded output a purse nothing else may spend, and the day anchor is now
 * declared at that same grain. A purse buys once a calendar day, at the first
 * check-in of that day it can afford its next rung, and a purse that can afford
 * nothing waits.
 *
 * WHAT THAT ESTABLISHES BY CONSTRUCTION IS ONE STEP AND NOT THE PROPERTY, and
 * the paragraph here used to run the two together. The step: adding a check-in
 * can only make a purse's next rung affordable EARLIER or leave it, because
 * money and reputation accrue on the wall clock and a check-in reads them
 * sooner. It used to close "so the day a rung lands is monotone in attendance,
 * purse by purse". Two measurements say the join does not hold:
 *
 *   - THE PREMISE IS TRUE IN A VIOLATING ENGINE. It is about the anchor, the
 *     per-purse split and wall-clock accrual; `RosterUpgradeRule` touches none
 *     of them, and `'one-way-door'` at this same anchor is 824 violating pairs
 *     of 24576, pinned below.
 *   - IT IS ABOUT WHEN A RUNG LANDS AND NOT WHICH ONE. `AXIS_OUTPUT` puts
 *     `space` and `spotter` on one purse and `coach` and `equipment` on
 *     another, the spending loop takes the first startable offer and breaks,
 *     and `EmpireGym.nextAxis` advances once per attended calendar day — so an
 *     extra check-in on an otherwise-empty day permanently shifts which ladder
 *     a two-ladder purse is offered first. Measured at 3334 of 24576 pairs,
 *     every one inside the roster purse, the dearer spotter rung where the
 *     less-engaged gym took the cheaper space one. That is the mechanism
 *     `'first-attended-check-in'` was rejected for at 1951, confined rather
 *     than removed.
 *
 * So the zero is a MEASUREMENT and it is worth the domains it was taken on:
 * `ANCHOR_DOMAINS`, each of which is asserted to have consulted the anchor. The
 * longest is 100 seeded days.
 *
 * WHAT THE ANCHOR IS NOT: it is not what makes the engine safe on its own.
 * Under the `'single-purse'` control every one of the four anchors is non-zero,
 * 2887 to 3908. The purses are what removed the residue and the anchor is what
 * makes them reachable in order; either alone is a violating engine, and the
 * right-hand column above is the measurement of that rather than a claim.
 *
 * THE OLD ANCHOR IS KEPT RUNNABLE AS A CONTROL — "a player who defers" — and
 * two things below are still measured on it, because they are claims about
 * §5.3 rather than about the anchor and that anchor is where they were taken:
 * the roster's one-way door (5 pairs on the arm where the decision moment does
 * NOT move) and `runEngagement`'s `spendsOn` counterfactual. Under the shipped
 * anchor the one-way door is worth 824 violating pairs of 24576, so §5.3's
 * promotion path is load-bearing here too and that is pinned beside it.
 *
 * WHAT THEY WERE, kept because a retracted diagnosis is worth more than a
 * deleted one: the five were said for several waves — here, in GDD §5.4 and in
 * the CLAUDE.md ruling that acted on both — to be the recruit price ladder.
 * That was measured and it is FALSE of all five. In every one of them the
 * diligent gym takes a `novice` at 500 Bucks per unit and the idle gym takes a
 * `club` at 1250: the diligent gym buys the cheaper and more efficient rung and
 * loses anyway, because the scarce thing at that decision is the roster SLOT. A
 * slot, once filled, was filled forever, and §5.3's ladder unlocks on
 * reputation, which rises with time. `recruitment.ts`'s promotion section is
 * the repair and `empireInvariant.ts` §4b is the trace.
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

import { readFileSync } from 'node:fs';
import path from 'node:path';

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
  EMPIRE_DAY_SPENDING_ANCHORS,
  EMPIRE_SPENDING_POLICIES,
  SHIPPED_DAY_SPENDING_ANCHOR,
  SHIPPED_ROSTER_UPGRADE,
  SHIPPED_SPENDING_POLICY,
  rosterRatesAt,
  runEmpire,
  type EmpireDaySpendingAnchor,
  type EmpirePolicy,
  type EmpireSpendingPolicy,
  type RosterUpgradeRule,
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
import { axisBook, type ExpansionAxis } from './expansion';
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
// Per-test wall-clock budgets, derived from measured durations by ONE rule
// ---------------------------------------------------------------------------

/**
 * The rule that turns a measured duration into a declared budget, and the
 * global this file mirrors.
 *
 * WHY THIS FILE DECLARES BUDGETS AT ALL, since `vitest.config.ts` argues against
 * raising the budget in its own header and that argument is right. Its complaint
 * is that a suite which fails on load and passes on a retry teaches everyone to
 * re-run instead of reading the failure. This file's problem is a different one
 * and the config's own text names the fix for it: a single sweep here exceeds
 * the global budget OUTRIGHT, alone in its file, on an idle machine — one test
 * measured 34.6 s against 30 s and was the suite's only red. That is not a load
 * artefact and no retry fixes it.
 *
 * A global raise is the wrong repair because it hands the same 90 s to three
 * thousand tests that finish in milliseconds, so the next genuinely hung one
 * sits there for a minute and a half. What is declared instead is a budget per
 * heavy test, computed from that test's own MEASURED duration by the one rule
 * below, with the measurement written at the call site. So the numbers in this
 * file are facts about how long the work takes rather than a ceiling somebody
 * picked, and re-taking them is re-running the test and reading the reporter.
 *
 * THE FACTOR IS THE MARGIN AND IT IS DECLARED RATHER THAN HOPED FOR. Two times
 * measured, rounded up to five seconds, floored at the global — floored because
 * a derived budget must never be TIGHTER than the one it replaces, which is the
 * arithmetic accident that would otherwise make a fast test's declaration a
 * regression. If this file starts failing under contention, this factor is the
 * thing to move, not the sweeps: every sweep here is carrying a §12.3
 * measurement and shrinking one to fit a clock would trade evidence for speed.
 */
const SWEEP_BUDGET = Object.freeze({
  /**
   * `TEST_TIMEOUT_MS` in `vitest.config.ts`, mirrored.
   *
   * Mirrored rather than imported: importing a vite config into a node test
   * drags the whole config loader in. `pins the global budget it mirrors`
   * below reads that file's source and fails if the two ever disagree, so this
   * is a copy that cannot go stale silently.
   */
  GLOBAL_MS: 30_000,
  HEADROOM_FACTOR: 2,
  ROUND_UP_TO_MS: 5_000,
} as const);

/** A declared budget from a measured duration. See `SWEEP_BUDGET`. */
function budgetFrom(measuredMs: number): number {
  if (!Number.isFinite(measuredMs) || measuredMs <= 0) {
    throw new RangeError(`a budget must come from a real measurement, received ${measuredMs}`);
  }
  const padded = measuredMs * SWEEP_BUDGET.HEADROOM_FACTOR;
  const rounded = Math.ceil(padded / SWEEP_BUDGET.ROUND_UP_TO_MS) * SWEEP_BUDGET.ROUND_UP_TO_MS;
  return Math.max(SWEEP_BUDGET.GLOBAL_MS, rounded);
}

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
   * Zero violating pairs, against a comparator that moved 21109 of 24576 pairs
   * and paid the more-engaged gym MORE on 208396 day-elements.
   */
  WINDOWED_SHIPPED: {
    pairs: 24576,
    comparedElements: 589824,
    movedPairs: 21109,
    movedElements: 209432,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 208396,
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
    movedPairs: 18231,
    movedElements: 187963,
    violatingPairs: 3003,
    trainingIqLower: 25725,
    trainingIqHigher: 162238,
    physioLower: 0,
    physioHigher: 0,
    physioArrivalLater: 0,
    physioArrivalEarlier: 0,
    pairsWherePhysioArrived: 0,
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
    movedPairs: 23410,
    movedElements: 218190,
    violatingPairs: 3492,
    trainingIqLower: 31739,
    trainingIqHigher: 181777,
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
    movedPairs: 718,
    movedElements: 1443,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 1363,
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
    movedPairs: 22619,
    movedElements: 159522,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 132668,
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
    movedPairs: 187,
    movedElements: 1398,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 1381,
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
    movedPairs: 385,
    movedElements: 1353,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 1328,
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
    movedPairs: 304,
    movedElements: 857,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 846,
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
    movedPairs: 145,
    movedElements: 566,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 566,
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
    movedPairs: 176,
    movedElements: 1709,
    violatingPairs: 4,
    trainingIqLower: 19,
    trainingIqHigher: 1670,
    physioLower: 0,
    physioHigher: 20,
    physioArrivalLater: 0,
    physioArrivalEarlier: 20,
    pairsWherePhysioArrived: 644,
    worstTrainingIqDeficit: 0.0061029999999999696,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  },
  SEEDED_20_ACCELERATED_PURSE: {
    pairs: 644,
    comparedElements: 25760,
    movedPairs: 210,
    movedElements: 1825,
    violatingPairs: 12,
    trainingIqLower: 143,
    trainingIqHigher: 1660,
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
    movedPairs: 167,
    movedElements: 1618,
    violatingPairs: 46,
    trainingIqLower: 285,
    trainingIqHigher: 1278,
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
    movedPairs: 4216,
    movedElements: 43213,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 43053,
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
    movedPairs: 3557,
    movedElements: 38740,
    violatingPairs: 574,
    trainingIqLower: 5324,
    trainingIqHigher: 33416,
    physioLower: 0,
    physioHigher: 0,
    physioArrivalLater: 0,
    physioArrivalEarlier: 0,
    pairsWherePhysioArrived: 0,
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
    movedPairs: 4034,
    movedElements: 40568,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 40568,
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
    movedPairs: 3436,
    movedElements: 26153,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 25993,
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
    violatingPairs: 133,
    trainingIqLower: 635,
    trainingIqHigher: 9397,
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
    movedPairs: 13,
    movedElements: 58,
    violatingPairs: 13,
    trainingIqLower: 53,
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

// ---------------------------------------------------------------------------
// What a sweep actually ran, so an anchor-inert domain reports itself
// ---------------------------------------------------------------------------

/**
 * The record every sweep leaves behind: how many runs it built, and how many
 * questions those runs put to `EMPIRE_DAY_SPENDING_ANCHORS`.
 *
 * THE DEFECT THIS EXISTS FOR, stated so the field is not read as bookkeeping.
 * `runEngagement` takes an anchor whatever policy it is driven at, and only a
 * `spendsOncePerDay` policy ever asks it anything. `windowedSweep` and
 * `seededSweep` both default `spending` to `SHIPPED_SPENDING_POLICY`, which is
 * per-check-in — so a sweep called with no spending argument runs the shipped
 * anchor's NAME through the whole comparison while the anchor decides nothing,
 * and the tally it returns is indistinguishable from one taken on a domain that
 * did exercise it. GDD §5.4 credited the shipped anchor with a zero on two such
 * domains for a wave, and the sentence read exactly as true as the three that
 * were.
 *
 * `EngagementCensus.anchorDecisions` is the run's own observed count, taken at
 * the three call sites in `runEngagement` rather than derived from `spending`.
 * This sums it over a whole sweep, `ANCHOR_DOMAINS` pins the sum per domain,
 * and `engagementRunFaults` refuses any single run whose count disagrees with
 * its policy. So a domain that stops reading the anchor reddens with two
 * integers rather than continuing to look like evidence about it.
 */
interface SweepRecord {
  readonly runs: number;
  readonly anchorDecisions: number;
}

let sweepRuns = 0;
let sweepAnchorDecisions = 0;

/** Start a fresh record. Every sweep helper below opens with this. */
function beginSweep(): void {
  sweepRuns = 0;
  sweepAnchorDecisions = 0;
}

/** The record of the sweep that just returned. */
function sweepRecord(): SweepRecord {
  return Object.freeze({ runs: sweepRuns, anchorDecisions: sweepAnchorDecisions });
}

/** Restore a record off a memo hit, so a cached sweep reports what it measured. */
function resumeSweep(record: SweepRecord): void {
  sweepRuns = record.runs;
  sweepAnchorDecisions = record.anchorDecisions;
}

/**
 * Fold one run into the current record.
 *
 * Every run this file builds goes through here, which is what makes the record
 * complete rather than a count somebody remembered to increment: `runFor`,
 * `upgradeRun` and `anchoredRun` are the only three constructors, and all three
 * return through this.
 */
function noteRun(run: EngagementRun): EngagementRun {
  sweepRuns += 1;
  sweepAnchorDecisions += run.census.anchorDecisions;
  return run;
}

function runFor(
  days: number,
  history: EngagementHistory,
  key: EngagementWiringKey = 'shipped',
  axisOrder: readonly ExpansionAxis[] = ENGAGEMENT_SWEEP.AXIS_ORDER,
  checkInsPerDay: number = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY,
  spending: EmpireSpendingPolicy = SHIPPED_SPENDING_POLICY,
  anchor: EmpireDaySpendingAnchor = SHIPPED_DAY_SPENDING_ANCHOR,
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
  return noteRun(
    runEngagement(
      days,
      policyFor(checkInsPerDay, axisOrder),
      history,
      socialFor(history),
      wiring,
      spending,
      SHIPPED_ROSTER_UPGRADE,
      history,
      anchor,
    ),
  );
}

/**
 * Sweeps already taken, keyed on every argument that decides their result.
 *
 * NOT AN OPTIMISATION THAT CHANGES WHAT IS CHECKED, and the distinction is
 * worth stating because a memo can quietly turn two independent readings into
 * one. `windowedSweep` and `seededSweep` are pure functions of their arguments,
 * and the call sites that share a key are calling them with argument lists that
 * are equal element by element — the headline sweep and the policy table's
 * shipped row, for instance, are the same seven arguments written two ways.
 * Every assertion in this file compares a sweep against a pinned literal in
 * `MEASURED*`, never against another sweep's return value, so a memo hit cannot
 * make an assertion agree with itself. What it removes is the second
 * computation of an identical domain, which is five of the file's twenty-odd
 * windowed sweeps.
 *
 * `SweepRecord` is cached with the tally, so a memo hit still reports the runs
 * and the anchor decisions its domain actually made rather than zero.
 */
const SWEEP_MEMO = new Map<string, { tally: EngagementTally; record: SweepRecord }>();

function memoised(key: string, take: () => EngagementTally): EngagementTally {
  const hit = SWEEP_MEMO.get(key);
  if (hit !== undefined) {
    resumeSweep(hit.record);
    return hit.tally;
  }
  beginSweep();
  const tally = take();
  SWEEP_MEMO.set(key, { tally, record: sweepRecord() });
  return tally;
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
  anchor: EmpireDaySpendingAnchor = SHIPPED_DAY_SPENDING_ANCHOR,
): EngagementTally {
  return memoised(
    ['windowed', days, windowFrom, windowSlots, key, axisOrder.join('+'), spending, anchor].join(
      '|',
    ),
    () => windowedSweepUncached(days, windowFrom, windowSlots, key, axisOrder, spending, anchor),
  );
}

function windowedSweepUncached(
  days: number,
  windowFrom: number,
  windowSlots: number,
  key: EngagementWiringKey,
  axisOrder: readonly ExpansionAxis[],
  spending: EmpireSpendingPolicy,
  anchor: EmpireDaySpendingAnchor,
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
    const made = runFor(
      days,
      history,
      key,
      axisOrder,
      ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY,
      spending,
      anchor,
    );
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
  beginSweep();
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
  return memoised(['whole-day', days, spending].join('|'), () =>
    wholeDaySweepUncached(days, spending),
  );
}

function wholeDaySweepUncached(days: number, spending: EmpireSpendingPolicy): EngagementTally {
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
  anchor: EmpireDaySpendingAnchor = SHIPPED_DAY_SPENDING_ANCHOR,
): EngagementTally {
  return memoised(
    ['seeded', days, trials, seed, key, axisOrder.join('+'), spending, anchor].join('|'),
    () => seededSweepUncached(days, trials, seed, key, axisOrder, spending, anchor),
  );
}

function seededSweepUncached(
  days: number,
  trials: number,
  seed: number,
  key: EngagementWiringKey,
  axisOrder: readonly ExpansionAxis[],
  spending: EmpireSpendingPolicy,
  anchor: EmpireDaySpendingAnchor,
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
    const baseline = runFor(days, history, key, axisOrder, cadence, spending, anchor);
    for (let slot = 0; slot < slots; slot += 1) {
      if (draws[slot] === true) continue;
      tally = addEngagement(
        tally,
        compareEngagement(
          baseline,
          runFor(days, moreEngagedBy(history, slot), key, axisOrder, cadence, spending, anchor),
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
  beginSweep();
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
    // a zero about a sweep that compared nothing: 21109 of 24576 pairs moved,
    // and the more-engaged gym was paid MORE on 208396 day-elements.
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
    expect(tally.violatingPairs).toBe(3003);
    expect(tally.trainingIqLower).toBe(25725);
    expect(tally).toEqual(MEASURED.WINDOWED_SINGLE_PURSE);
    // The two arms ran the same 24576 pairs and the same 589824 elements, so
    // the difference between them is the funding rule and nothing else.
    expect(tally.pairs).toBe(MEASURED.WINDOWED_SHIPPED.pairs);
    expect(tally.comparedElements).toBe(MEASURED.WINDOWED_SHIPPED.comparedElements);
  });

  it('measures chain A re-connected, as the control the physio zero is zero against', { timeout: budgetFrom(10_857) }, () => {
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
    expect(MEASURED.DIAG_SINGLE_PURSE.violatingPairs).toBe(574);
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
   * All six are zero. `'cheapest-affordable-first'` is not listed because it is
   * byte-identical to `'fixed-order-no-rotation'` here — see the check that
   * pins the coincidence rather than counting the row twice — and the shipped
   * row is asserted against `MEASURED.WINDOWED_SHIPPED` itself so the two
   * harnesses cannot quietly disagree. The day-granularity row is zero at
   * `SHIPPED_DAY_SPENDING_ANCHOR` and 6459 at the anchor it replaced;
   * `MEASURED_ANCHOR` below carries all four readings.
   */
  WINDOWED: Object.freeze({
    'fixed-order-no-rotation': {
      pairs: 24576,
      comparedElements: 589824,
      movedPairs: 20895,
      movedElements: 204554,
      violatingPairs: 0,
      trainingIqLower: 0,
      trainingIqHigher: 203518,
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
      movedPairs: 21342,
      movedElements: 212471,
      violatingPairs: 0,
      trainingIqLower: 0,
      trainingIqHigher: 211435,
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
      movedPairs: 20895,
      movedElements: 204554,
      violatingPairs: 0,
      trainingIqLower: 0,
      trainingIqHigher: 203518,
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
      movedPairs: 11284,
      movedElements: 97287,
      violatingPairs: 0,
      trainingIqLower: 0,
      trainingIqHigher: 96251,
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
      movedPairs: 17880,
      movedElements: 184243,
      violatingPairs: 2800,
      trainingIqLower: 22578,
      trainingIqHigher: 161665,
      physioLower: 0,
      physioHigher: 0,
      physioArrivalLater: 0,
      physioArrivalEarlier: 0,
      pairsWherePhysioArrived: 0,
      worstTrainingIqDeficit: 0.4513370000000001,
      worstPhysioDeficit: 0,
      worstArrivalDeficitDays: 0,
      lengthMismatches: 0,
    },
    'costliest-affordable-first': {
      pairs: 24576,
      comparedElements: 589824,
      movedPairs: 17843,
      movedElements: 182137,
      violatingPairs: 3503,
      trainingIqLower: 28409,
      trainingIqHigher: 153728,
      physioLower: 0,
      physioHigher: 0,
      physioArrivalLater: 0,
      physioArrivalEarlier: 0,
      pairsWherePhysioArrived: 0,
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
      movedPairs: 11374,
      movedElements: 110294,
      violatingPairs: 2887,
      trainingIqLower: 29257,
      trainingIqHigher: 81037,
      physioLower: 0,
      physioHigher: 0,
      physioArrivalLater: 0,
      physioArrivalEarlier: 0,
      pairsWherePhysioArrived: 0,
      worstTrainingIqDeficit: 0.4405459999999999,
      worstPhysioDeficit: 0,
      worstArrivalDeficitDays: 0,
      lengthMismatches: 0,
    },
  }),

  /**
   * The single-purse violating-pair counts alone, as the table the report quotes.
   *
   * These are the LIVE control's numbers, re-taken after §5.3's promotion path.
   * Piece E8's own were 2954 / 2751 / 2751 / 3427 / 0 / 10122, and this table
   * reproduced them exactly for several waves — which is what said the control
   * was the old engine rather than an approximation of it. It is not that any
   * more, and `engagement.test.ts`'s header says so rather than leaving the
   * resemblance to be assumed.
   */
  SINGLE_PURSE_VIOLATING_PAIRS: Object.freeze({
    'rotate-greedy-per-check-in': 3003,
    'fixed-order-no-rotation': 2800,
    'cheapest-affordable-first': 2800,
    'costliest-affordable-first': 3503,
    'save-for-physio-first': 0,
    'spend-once-per-calendar-day': 2887,
  }),

  /**
   * The same six on a SECOND domain. Every arm is zero, including the
   * day-granularity one — which read 60 here and 34 at forty days under the
   * anchor `SHIPPED_DAY_SPENDING_ANCHOR` replaced, and those two numbers are
   * kept in `MEASURED_ANCHOR.SEEDED_20_VIOLATING` and `SEEDED_40_VIOLATING` as
   * the thing these zeros are zeros against on this domain.
   */
  SEEDED_20: Object.freeze({
    'rotate-greedy-per-check-in': { pairs: 644, movedPairs: 187, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'fixed-order-no-rotation': { pairs: 644, movedPairs: 187, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'cheapest-affordable-first': { pairs: 644, movedPairs: 187, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'costliest-affordable-first': { pairs: 644, movedPairs: 189, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'save-for-physio-first': { pairs: 644, movedPairs: 187, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'spend-once-per-calendar-day': { pairs: 644, movedPairs: 87, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
  }),
  SEEDED_40: Object.freeze({
    'rotate-greedy-per-check-in': { pairs: 623, movedPairs: 385, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'fixed-order-no-rotation': { pairs: 623, movedPairs: 385, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'cheapest-affordable-first': { pairs: 623, movedPairs: 385, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'costliest-affordable-first': { pairs: 623, movedPairs: 385, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'save-for-physio-first': { pairs: 623, movedPairs: 385, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
    'spend-once-per-calendar-day': { pairs: 623, movedPairs: 350, violatingPairs: 0, trainingIqLower: 0, physioArrivalLater: 0, worstTrainingIqDeficit: 0 },
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
   *
   * `spendingMoments` is not in this digest any more and the reason is worth a
   * sentence: under the shipped day anchor it is 72 for every policy, because
   * the per-purse day offers SOME unspent purse at nearly every check-in. It
   * had stopped separating anything. `purchaseCheckIns` / `purchaseDays` /
   * `repeatPurseSpends` are what separate the two families now, and they are
   * measurements of the rule rather than of the offer: 13 buying check-ins over
   * 6 days with 4 purses buying twice in a day for the per-check-in policies,
   * against 12 over 9 with none for the day-granularity one.
   */
  FULL_ATTENDANCE_CENSUS: Object.freeze({
    'rotate-greedy-per-check-in': { purchaseCheckIns: 13, purchaseDays: 6, repeatPurseSpends: 4, recruits: 5, expansions: 5, physioArrivalDay: 4 },
    'fixed-order-no-rotation': { purchaseCheckIns: 13, purchaseDays: 6, repeatPurseSpends: 4, recruits: 5, expansions: 5, physioArrivalDay: 4 },
    'cheapest-affordable-first': { purchaseCheckIns: 13, purchaseDays: 6, repeatPurseSpends: 4, recruits: 5, expansions: 5, physioArrivalDay: 4 },
    'costliest-affordable-first': { purchaseCheckIns: 13, purchaseDays: 6, repeatPurseSpends: 4, recruits: 5, expansions: 5, physioArrivalDay: 4 },
    'save-for-physio-first': { purchaseCheckIns: 13, purchaseDays: 6, repeatPurseSpends: 4, recruits: 5, expansions: 5, physioArrivalDay: 4 },
    'spend-once-per-calendar-day': { purchaseCheckIns: 12, purchaseDays: 9, repeatPurseSpends: 0, recruits: 5, expansions: 5, physioArrivalDay: 4 },
  }),
} as const);


/**
 * WHAT EACH DAY ANCHOR PRODUCED, pinned whole.
 *
 * `EMPIRE_DAY_SPENDING_ANCHORS` is the unstated half of "spends once a calendar
 * day" written down: WHICH check-in of the day. One of the four ships and three
 * are controls, and every number here is on the same 24576-pair window as the
 * policy table above, so the two are one comparison rather than two.
 */
const MEASURED_ANCHOR = Object.freeze({
  /** The four anchors on the shipped wiring, as whole tallies. */
  WINDOWED: Object.freeze({
    'first-affordable-check-in-per-purse': {
      pairs: 24576,
      comparedElements: 589824,
      movedPairs: 11284,
      movedElements: 97287,
      violatingPairs: 0,
      trainingIqLower: 0,
      trainingIqHigher: 96251,
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
    'first-affordable-check-in': {
      pairs: 24576,
      comparedElements: 589824,
      movedPairs: 12990,
      movedElements: 101815,
      violatingPairs: 31,
      trainingIqLower: 336,
      trainingIqHigher: 96979,
      physioLower: 0,
      physioHigher: 4500,
      physioArrivalLater: 0,
      physioArrivalEarlier: 4500,
      pairsWherePhysioArrived: 24576,
      worstTrainingIqDeficit: 0.24957699999999994,
      worstPhysioDeficit: 0,
      worstArrivalDeficitDays: 0,
      lengthMismatches: 0,
    },
    'first-attended-check-in': {
      pairs: 24576,
      comparedElements: 589824,
      movedPairs: 11437,
      movedElements: 88316,
      violatingPairs: 1951,
      trainingIqLower: 22806,
      trainingIqHigher: 61010,
      physioLower: 0,
      physioHigher: 4500,
      physioArrivalLater: 0,
      physioArrivalEarlier: 4500,
      pairsWherePhysioArrived: 24576,
      worstTrainingIqDeficit: 0.26323399999999997,
      worstPhysioDeficit: 0,
      worstArrivalDeficitDays: 0,
      lengthMismatches: 0,
    },
    'last-attended-check-in': {
      pairs: 24576,
      comparedElements: 589824,
      movedPairs: 10403,
      movedElements: 92792,
      violatingPairs: 6459,
      trainingIqLower: 62878,
      trainingIqHigher: 29402,
      physioLower: 0,
      physioHigher: 512,
      physioArrivalLater: 0,
      physioArrivalEarlier: 512,
      pairsWherePhysioArrived: 24576,
      worstTrainingIqDeficit: 0.009975999999999985,
      worstPhysioDeficit: 0,
      worstArrivalDeficitDays: 0,
      lengthMismatches: 0,
    },
  }),

  /**
   * The same four on the pre-third-book-ruling wiring.
   *
   * Every one of them is non-zero, which is the measurement behind "the anchor
   * is not what makes the engine safe on its own". Move the day's shopping to
   * the earliest moment each ladder can afford it and put every ladder back on
   * one balance, and the schedule decides which ladder reaches the balance
   * first again — 2887, against 0 with the purses split.
   */
  WINDOWED_SINGLE_PURSE_VIOLATING: Object.freeze({
    'first-affordable-check-in-per-purse': 2887,
    'first-affordable-check-in': 2878,
    'first-attended-check-in': 3104,
    'last-attended-check-in': 3908,
  }),

  /**
   * The four anchors on a SECOND domain, seeded rather than enumerated.
   *
   * `'first-affordable-check-in'` is 4 at twenty days and 0 at forty, and that
   * is written down rather than rounded to "non-zero": a control that is zero
   * on one horizon is reported as zero on it. It is the 31-pair anchor and its
   * shape is rare, so a sampled domain of 644 pairs reaching it 4 times and 623
   * pairs reaching it 0 times is what a rare shape looks like when sampled.
   */
  SEEDED_20_VIOLATING: Object.freeze({
    'first-affordable-check-in-per-purse': 0,
    'first-affordable-check-in': 4,
    'first-attended-check-in': 8,
    'last-attended-check-in': 60,
  }),
  SEEDED_40_VIOLATING: Object.freeze({
    'first-affordable-check-in-per-purse': 0,
    'first-affordable-check-in': 0,
    'first-attended-check-in': 2,
    'last-attended-check-in': 34,
  }),

  /**
   * The shipped anchor split by whether the extra check-in becomes the day's
   * EARLIEST one — which is the only thing this anchor lets an extra check-in
   * change about a decision, and therefore the arm a violation would live on.
   *
   * Both arms are zero and both arms MOVE, in counts rather than bounds. An arm
   * that stopped moving would be an empty domain reporting a zero.
   */
  EARLIEST_SPLIT: Object.freeze({
    movesEarliest: 8064,
    movesEarliestViolating: 0,
    movesEarliestMoved: 5216,
    keepsEarliest: 16512,
    keepsEarliestViolating: 0,
    keepsEarliestMoved: 6068,
  }),

  /**
   * §5.3's one-way door, re-measured under the SHIPPED anchor.
   *
   * The promotion path was ruled in against 5 pairs measured under the old
   * anchor. Under this one the same control is worth 824, so it is not a repair
   * whose subject the respecification removed — it is load-bearing here too,
   * and this is the number that says so.
   */
  ONE_WAY_DOOR_VIOLATING: 824,

  /**
   * Every calendar of seven days at two check-ins a day, whole, under the day
   * policy at the shipped anchor. 114688 pairs, 21737 of which reached physio.
   */
  COARSE_FULL: Object.freeze({
    pairs: 114688,
    comparedElements: 1605632,
    movedPairs: 105225,
    movedElements: 353650,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 336532,
    physioLower: 0,
    physioHigher: 17118,
    physioArrivalLater: 0,
    physioArrivalEarlier: 16056,
    pairsWherePhysioArrived: 21737,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  }),

  /**
   * The four anchors on the SAME WINDOW MOVED TO DAY 4, under the day policy.
   *
   * This domain was in GDD §5.4's list of anchor measurements and was not one:
   * `windowedSweep`'s default `spending` is per-check-in, so the day-4 test
   * above runs the shipped anchor's name past an engine that never asks it
   * anything. This row is the reading the document claimed, taken. The old
   * anchor is 456 here, so the domain separates the four rather than being a
   * second place they all come out zero.
   */
  /**
   * The headline window's four violating counts on their own, so
   * `ANCHOR_DOMAINS` can name the same numbers the whole-tally table carries.
   * Asserted equal to `WINDOWED`'s own `violatingPairs` in both directions by
   * the table-shape check, so the two cannot drift apart.
   */
  WINDOWED_VIOLATING: Object.freeze({
    'first-affordable-check-in-per-purse': 0,
    'first-affordable-check-in': 31,
    'first-attended-check-in': 1951,
    'last-attended-check-in': 6459,
  }),

  LATE_WINDOW_VIOLATING: Object.freeze({
    'first-affordable-check-in-per-purse': 0,
    'first-affordable-check-in': 0,
    'first-attended-check-in': 0,
    'last-attended-check-in': 456,
  }),

  /**
   * The four anchors at 60 and at 100 seeded days, under the day policy.
   *
   * ALSO CLAIMED AND NOT TAKEN. `seededSweep` defaults `spending` the same way,
   * so the 60/100-day test above is a per-check-in reading; before this row the
   * longest horizon the shipped day anchor had ever been measured at was 40
   * days, on 623 pairs from 6 seeded histories. Both horizons are zero at the
   * shipped anchor and non-zero at the old one, and the two anchors between
   * them are small rather than zero — which is what a rare shape looks like
   * when a sampled domain is long enough to reach it.
   */
  SEEDED_60_VIOLATING: Object.freeze({
    'first-affordable-check-in-per-purse': 0,
    'first-affordable-check-in': 1,
    'first-attended-check-in': 3,
    'last-attended-check-in': 64,
  }),
  SEEDED_100_VIOLATING: Object.freeze({
    'first-affordable-check-in-per-purse': 0,
    'first-affordable-check-in': 0,
    'first-attended-check-in': 2,
    'last-attended-check-in': 4,
  }),

  /**
   * The shipped anchor's whole tally at 60 and at 100 seeded days, so the zeros
   * above sit beside the domain they were taken on rather than alone.
   */
  SEEDED_60_SHIPPED: Object.freeze({
    pairs: 650,
    comparedElements: 78000,
    movedPairs: 329,
    movedElements: 1600,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 1589,
    physioLower: 0,
    physioHigher: 11,
    physioArrivalLater: 0,
    physioArrivalEarlier: 11,
    pairsWherePhysioArrived: 650,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  }),
  SEEDED_100_SHIPPED: Object.freeze({
    pairs: 556,
    comparedElements: 111200,
    movedPairs: 125,
    movedElements: 609,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 609,
    physioLower: 0,
    physioHigher: 0,
    physioArrivalLater: 0,
    physioArrivalEarlier: 0,
    pairsWherePhysioArrived: 556,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  }),

  /**
   * WHICH RUNG LANDED, NOT WHEN — the reading the construction argument for
   * this anchor does not cover, and the non-vacuity denominator for its zero.
   *
   * `empireInvariant.ts` §4c used to close with "so the day a rung lands is
   * monotone in attendance, purse by purse". The premise it drew that from is
   * about WHEN a purse can first afford its next rung. `AXIS_OUTPUT` puts
   * `space` and `spotter` on one purse and `coach` and `equipment` on another,
   * `stepGym` step 4 takes the first startable offer and breaks, and
   * `EmpireGym.nextAxis` advances once per attended calendar day under this
   * anchor — so an extra check-in on an otherwise-empty day permanently shifts
   * which ladder of a two-ladder purse is offered first.
   *
   * `swapped` counts the pairs where the more-engaged gym STARTS A DIFFERENT
   * AXIS at the same position in its rung order. It is 3334 of 24576, so the
   * mechanism is live and the zero beside it is a measurement over a domain
   * that reaches it rather than a zero about something unreachable.
   *
   * `sameAxisDifferentLevel` is 0, which is a fact about the shape rather than
   * a target: every first divergence is between two axes, never the same
   * ladder at two rungs.
   */
  RUNG_SWAP: Object.freeze({
    pairs: 24576,
    diverged: 3334,
    swapped: 3334,
    sameAxisDifferentLevel: 0,
  }),
} as const);

/** The headline windowed sweep under one policy and one wiring. Same domain, same comparator. */
/** One run under a named roster-upgrade rule, everything else the sweep's own. */
function upgradeRun(
  days: number,
  history: EngagementHistory,
  cadence: number,
  upgrades: RosterUpgradeRule,
  anchor: EmpireDaySpendingAnchor = SHIPPED_DAY_SPENDING_ANCHOR,
): EngagementRun {
  return noteRun(
    runEngagement(
      days,
      policyFor(cadence),
      history,
      socialFor(history),
      shippedEngagementWiring(),
      'spend-once-per-calendar-day',
      upgrades,
      history,
      anchor,
    ),
  );
}

/**
 * One run whose day-granularity spending anchor is another history's.
 *
 * Taken at `'last-attended-check-in'` by default, and that is the point of the
 * default rather than an oversight: `spendsOn` says whose attendance decides
 * which check-in of the day the shopping happens at, and only an anchor that
 * DERIVES that moment from attendance has such a moment to hold. Under the
 * shipped per-purse anchor the moment is a fact about each purse's balance, so
 * there is nothing for a second history to decide.
 */
function anchoredRun(
  days: number,
  history: EngagementHistory,
  cadence: number,
  spendsOn: EngagementHistory,
  anchor: EmpireDaySpendingAnchor = 'last-attended-check-in',
): EngagementRun {
  return noteRun(
    runEngagement(
      days,
      policyFor(cadence),
      history,
      socialFor(history),
      shippedEngagementWiring(),
      'spend-once-per-calendar-day',
      SHIPPED_ROSTER_UPGRADE,
      spendsOn,
      anchor,
    ),
  );
}

function policyWindowed(
  spending: EmpireSpendingPolicy,
  key: EngagementWiringKey = 'shipped',
  anchor: EmpireDaySpendingAnchor = SHIPPED_DAY_SPENDING_ANCHOR,
): EngagementTally {
  return windowedSweep(
    ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
    0,
    ENGAGEMENT_SWEEP.WINDOW_SLOTS,
    key,
    ENGAGEMENT_SWEEP.AXIS_ORDER,
    spending,
    anchor,
  );
}

/** The attendance predicate a window mask stands for: inside the window, the bit. */
function maskAttendance(mask: number, window: number): (slot: number) => boolean {
  return (slot: number): boolean => (slot >= window ? true : (mask & (1 << slot)) !== 0);
}

/**
 * Does turning `bit` on make it the EARLIEST check-in of its calendar day?
 *
 * The per-purse anchor's whole exposure, as a predicate: each purse shops at
 * the first check-in of the day it can afford its rung, so an extra check-in
 * can only change a decision by arriving before every check-in that day.
 */
function becomesEarliestOfDay(
  mask: number,
  bit: number,
  window: number,
  cadence: number,
): boolean {
  const attended = maskAttendance(mask, window);
  const day = Math.floor(bit / cadence);
  let firstAttended: number = cadence;
  for (let tick = cadence - 1; tick >= 0; tick -= 1) {
    if (attended(day * cadence + tick)) firstAttended = tick;
  }
  return bit - day * cadence < firstAttended;
}

/** The headline window under one DAY ANCHOR, everything else the sweep's own. */
function anchorWindowed(
  anchor: EmpireDaySpendingAnchor,
  key: EngagementWiringKey = 'shipped',
): EngagementTally {
  return policyWindowed('spend-once-per-calendar-day', key, anchor);
}

/** The day-4 window under one DAY ANCHOR, under the day-granularity policy. */
function lateAnchorWindowed(anchor: EmpireDaySpendingAnchor): EngagementTally {
  return windowedSweep(
    ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
    ENGAGEMENT_SWEEP.LATE_WINDOW_FROM_SLOT,
    ENGAGEMENT_SWEEP.LATE_WINDOW_SLOTS,
    'shipped',
    ENGAGEMENT_SWEEP.AXIS_ORDER,
    'spend-once-per-calendar-day',
    anchor,
  );
}

/** A seeded horizon under one DAY ANCHOR, under the day-granularity policy. */
function seededAnchorSweep(
  days: number,
  trials: number,
  seed: number,
  anchor: EmpireDaySpendingAnchor,
): EngagementTally {
  return seededSweep(
    days,
    trials,
    seed,
    'shipped',
    ENGAGEMENT_SWEEP.AXIS_ORDER,
    'spend-once-per-calendar-day',
    anchor,
  );
}

/**
 * Every calendar of the coarse grid, whole, under the day policy at one anchor.
 *
 * Extracted from the test that used to inline it so `ANCHOR_DOMAINS` can name
 * the same computation rather than a second one shaped like it; memoised, so
 * naming it twice costs one enumeration.
 */
function coarseDaySweep(anchor: EmpireDaySpendingAnchor): EngagementTally {
  return memoised(['coarse-day', anchor].join('|'), () => {
    const days = ENGAGEMENT_SWEEP.COARSE_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.COARSE_CHECK_INS_PER_DAY;
    const slots = days * cadence;
    const cache = new Map<number, EngagementRun>();
    const at = (mask: number): EngagementRun => {
      const hit = cache.get(mask);
      if (hit !== undefined) return hit;
      const history = historyFrom(slots, (slot) => (mask & (1 << slot)) !== 0, BASE_TRAINED_DAYS);
      const made = runFor(
        days,
        history,
        'shipped',
        ENGAGEMENT_SWEEP.AXIS_ORDER,
        cadence,
        'spend-once-per-calendar-day',
        anchor,
      );
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
  });
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

  it('reports what each policy actually bought, so no tally is a zero about nothing [a-purse-shops-once-a-calendar-day]', () => {
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
    const history = fullAttendance(days, cadence);
    let policiesRun = 0;
    for (const spending of EMPIRE_SPENDING_POLICIES) {
      const run = runFor(days, history, 'shipped', ENGAGEMENT_SWEEP.AXIS_ORDER, cadence, spending);
      // Joined rather than compared as an array, so a fault fails with its own
      // sentence instead of `[ Array(1) ] to deeply equal []`.
      expect(engagementRunFaults(run).join(' | '), spending).toBe('');
      expect(run.spending).toBe(spending);
      expect(run.census.checkIns).toBe(days * cadence);
      // THE DAY-GRANULARITY RULE FIRST, read off the run rather than off its
      // own parameter: no purse bought twice in one calendar day, and the
      // per-check-in policies did — so this zero is a zero against a number the
      // same census reports, and a mutant fails with two integers and a policy
      // name rather than with two elided objects.
      if (spending === 'spend-once-per-calendar-day') {
        expect(run.census.repeatPurseSpends, spending).toBe(0);
      } else {
        expect(run.census.repeatPurseSpends, spending).toBeGreaterThan(0);
      }
      expect(
        {
          purchaseCheckIns: run.census.purchaseCheckIns,
          purchaseDays: run.census.purchaseDays,
          repeatPurseSpends: run.census.repeatPurseSpends,
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

  it('reproduces the headline exactly under the shipped policy', { timeout: budgetFrom(22_000) }, () => {
    // Two full 24576-pair sweeps. 22 s is the COLD cost — both are memo hits
    // when the exhaustive section above has already run, and a budget taken
    // warm would be a budget for the order rather than for the work.
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

  it('measures the rotation phase removed: fixed order, and cheapest-first with it', { timeout: budgetFrom(38_823) }, () => {
    // THREE full 24576-pair sweeps, and this was one of the two tests that blew
    // the global budget outright. It is not split into three because the three
    // are one argument: the two shipped arms have to be compared to each other
    // in the same body, and the pre-ruling arm is what makes their equality a
    // decomposition rather than two blank readings.
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
    ).toBe(2800);
  });

  it('measures the ordering reversed: costliest affordable first', { timeout: budgetFrom(32_503) }, () => {
    // Two full sweeps, subject and its pre-ruling control. The other test that
    // blew the global budget.
    const tally = policyWindowed('costliest-affordable-first');
    expect(tally).toEqual(MEASURED_POLICY.WINDOWED['costliest-affordable-first']);
    expect(tally.violatingPairs).toBe(0);
    // The worst arm of the pre-ruling engine, on the same domain, is 3427.
    expect(policyWindowed('costliest-affordable-first', 'single-purse')).toEqual(
      MEASURED_POLICY.WINDOWED_SINGLE_PURSE['costliest-affordable-first'],
    );
  });

  it('explains the save-for-physio zero instead of repeating it', { timeout: budgetFrom(21_317) }, () => {
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
    expect(lateSingle.violatingPairs).toBe(133);
    expect(lateSingle.trainingIqLower).toBe(635);
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

  it('measures the per-check-in granularity removed, and that arm is zero too now', { timeout: budgetFrom(23_039) }, () => {
    // THE ARM THAT USED TO BE 6459. It is 0, and the specification is what
    // changed: `SHIPPED_DAY_SPENDING_ANCHOR` says which check-in of the day a
    // player who shops once a day shops at, and the anchor block below is the
    // four readings of that with their counts.
    const tally = policyWindowed('spend-once-per-calendar-day');
    expect(tally.violatingPairs).toBe(0);
    expect(tally).toEqual(MEASURED_POLICY.WINDOWED['spend-once-per-calendar-day']);
    // The old anchor, still runnable and still 6459, so this zero is a zero
    // against the number it replaced rather than against nothing.
    expect(anchorWindowed('last-attended-check-in').violatingPairs).toBe(6459);
    // And the pre-ruling engine on the same domain, at the shipped anchor.
    expect(policyWindowed('spend-once-per-calendar-day', 'single-purse')).toEqual(
      MEASURED_POLICY.WINDOWED_SINGLE_PURSE['spend-once-per-calendar-day'],
    );
    expect(tally.physioArrivalLater).toBe(0);
    // AND THE SINGLE-PURSE CONTROL'S PHYSIO HALF IS AN EMPTY DOMAIN, which is
    // written down rather than quietly re-pinned. Before §5.3's promotion path
    // this control put 5484 physio arrivals LATER, and that was the number the
    // shipped physio zero was a zero against on this arm. With promotion in the
    // loop the pooled wall-clock balance is drawn on by promotions too, so
    // under this control the physio rung is never reached inside twelve days at
    // all — 0 of 24576 pairs saw one arrive, on either side. A zero taken
    // against that would be a zero about a hook that never fired.
    //
    // The physio control that is still live is `'accelerated-purse'`, pinned at
    // 263 later arrivals over the same 24576 pairs with the domain full, and
    // the subject's own physio domain is full at 24576. So the physio zero
    // still has something to be a zero against; it is a different control than
    // it was, and that is the honest statement rather than a re-pinned 0.
    expect(
      MEASURED_POLICY.WINDOWED_SINGLE_PURSE['spend-once-per-calendar-day'].pairsWherePhysioArrived,
    ).toBe(0);
    expect(MEASURED.WINDOWED_ACCELERATED_PURSE.physioArrivalLater).toBe(263);
    expect(MEASURED.WINDOWED_ACCELERATED_PURSE.pairsWherePhysioArrived).toBe(24576);
    expect(tally.pairsWherePhysioArrived).toBe(24576);
  });

  it('splits that arm by whether the extra check-in moved the day it spends at [a-filled-slot-is-not-a-one-way-door] [a-slot-costs-the-same-by-every-route]', { timeout: budgetFrom(7_000) }, () => {
    // TAKEN AT THE `'last-attended-check-in'` CONTROL ANCHOR, ON PURPOSE. This
    // check is a claim about §5.3's roster and not about the day anchor, and
    // the roster claim was measured on that anchor — so it stays there rather
    // than being re-taken somewhere the five it is about do not exist. The
    // shipped anchor's own reading of the same repair is
    // `MEASURED_ANCHOR.ONE_WAY_DOOR_VIOLATING`, pinned at 824 below, which is
    // what says the repair is load-bearing on the shipped engine too.
    //
    // The diagnosis, on the same twelve slots the headline enumerates, so the
    // two halves add up to that anchor's count rather than describing another
    // domain. A pair is on the left when the extra check-in is later in its day
    // than every check-in the baseline took, which is the moment this anchor
    // spends at.
    const anchor: EmpireDaySpendingAnchor = 'last-attended-check-in';
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
    const window = ENGAGEMENT_SWEEP.SPEND_ONCE_WINDOW_SLOTS;
    const slots = days * cadence;
    let movesMoment = 0;
    let movesMomentViolating = 0;
    let keepsMoment = 0;
    let keepsMomentViolating = 0;
    let promotedBaselines = 0;
    // MASK-KEYED, because `moreEngagedBy(history(mask), bit)` IS `history(mask |
    // 1 << bit)` — the same attendance grid and the same trained days — so the
    // uncached form built 28672 runs where 4096 exist. It was the slowest test
    // in the repository at 34.5 s against a 30 s budget, and it was slow by
    // rebuilding the same twelve-day runs seven times over rather than by
    // measuring anything extra. `windowedSweep` has always cached this way; this
    // loop and the two below simply had not.
    const cache = new Map<number, EngagementRun>();
    const at = (mask: number): EngagementRun => {
      const hit = cache.get(mask);
      if (hit !== undefined) return hit;
      const made = runFor(
        days,
        historyFrom(slots, maskAttendance(mask, window), BASE_TRAINED_DAYS),
        'shipped',
        ENGAGEMENT_SWEEP.AXIS_ORDER,
        cadence,
        'spend-once-per-calendar-day',
        anchor,
      );
      cache.set(mask, made);
      return made;
    };
    for (let mask = 0; mask < 1 << window; mask += 1) {
      const attended = maskAttendance(mask, window);
      const baseline = at(mask);
      if (baseline.census.promotions > 0) promotedBaselines += 1;
      for (let bit = 0; bit < window; bit += 1) {
        if ((mask & (1 << bit)) !== 0) continue;
        const day = Math.floor(bit / cadence);
        let lastAttended = -1;
        for (let tick = 0; tick < cadence; tick += 1) {
          if (attended(day * cadence + tick)) lastAttended = tick;
        }
        const divergence = compareEngagement(baseline, at(mask | (1 << bit)));
        if (bit - day * cadence > lastAttended) {
          movesMoment += 1;
          if (divergence.violating) movesMomentViolating += 1;
        } else {
          keepsMoment += 1;
          if (divergence.violating) keepsMomentViolating += 1;
        }
      }
    }
    // THE HEADLINE NUMBER FIRST, so a mutant that brings §5.3's one-way door
    // back fails with "expected 5 to be 0" rather than with two elided objects
    // — CLAUDE.md's "a check that bites but fails uselessly is half a check".
    // Measured: without it, this exact mutant reddened on the elided form.
    expect(keepsMomentViolating).toBe(0);
    expect({ movesMoment, movesMomentViolating, keepsMoment, keepsMomentViolating }).toEqual({
      movesMoment: 8064,
      movesMomentViolating: 6459,
      keepsMoment: 16512,
      keepsMomentViolating: 0,
    });
    // NON-VACUITY FOR THE ZERO ON THE RIGHT. §5.3's promotion path is what took
    // that arm from 5 to 0, so a zero taken over baselines that never promoted
    // anything would be a zero about a path nothing used. Every one of the 4096
    // baselines promotes, counted rather than bounded.
    expect(promotedBaselines).toBe(1 << window);
    // The two halves are that anchor's own count, so neither is a different
    // domain — read out of the anchor table rather than transcribed.
    expect(movesMoment + keepsMoment).toBe(
      MEASURED_ANCHOR.WINDOWED['last-attended-check-in'].pairs,
    );
    expect(movesMomentViolating + keepsMomentViolating).toBe(
      MEASURED_ANCHOR.WINDOWED['last-attended-check-in'].violatingPairs,
    );
  });

  it('closes the five that survived the purses, against the roster as it was', () => {
    // THE CONTROL THE ZERO ABOVE IS A ZERO AGAINST, at the same
    // `'last-attended-check-in'` anchor for the same reason. The check above
    // measured the shipped roster on the keeps-moment arm and found 0; this one
    // measures `'one-way-door'` — a filled roster slot filled forever, the
    // engine before §5.3's promotion path — on the same 16512 pairs, and finds
    // the five.
    //
    // The two are separate checks rather than two arms of one because the whole
    // enumeration twice does not fit `vitest.config.ts`'s per-test budget. They
    // enumerate the same masks over the same window and both pin `keepsMoment`
    // at 16512, so "the same domain" is a measured equality and not a claim.
    const anchor: EmpireDaySpendingAnchor = 'last-attended-check-in';
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
    const window = ENGAGEMENT_SWEEP.SPEND_ONCE_WINDOW_SLOTS;
    const slots = days * cadence;
    let keepsMoment = 0;
    let oneWayDoorViolating = 0;
    let maskCount = 0;
    let controlPromotions = 0;
    // Mask-keyed for the reason the check above gives, and the two loops are
    // written the same way on purpose: they enumerate the same masks over the
    // same window, and a cache added to one arm and not to its sibling is the
    // shape CLAUDE.md records as "the branch immediately below the one you just
    // fixed".
    const cache = new Map<number, EngagementRun>();
    const at = (mask: number): EngagementRun => {
      const hit = cache.get(mask);
      if (hit !== undefined) return hit;
      const made = upgradeRun(
        days,
        historyFrom(slots, maskAttendance(mask, window), BASE_TRAINED_DAYS),
        cadence,
        'one-way-door',
        anchor,
      );
      cache.set(mask, made);
      return made;
    };
    for (let mask = 0; mask < 1 << window; mask += 1) {
      const attended = maskAttendance(mask, window);
      const doorBase = at(mask);
      controlPromotions += doorBase.census.promotions;
      maskCount += 1;
      for (let bit = 0; bit < window; bit += 1) {
        if ((mask & (1 << bit)) !== 0) continue;
        const day = Math.floor(bit / cadence);
        let lastAttended = -1;
        for (let tick = 0; tick < cadence; tick += 1) {
          if (attended(day * cadence + tick)) lastAttended = tick;
        }
        if (bit - day * cadence > lastAttended) continue;
        keepsMoment += 1;
        if (compareEngagement(doorBase, at(mask | (1 << bit))).violating) {
          oneWayDoorViolating += 1;
        }
      }
    }
    // The domain, so a five cannot be a five about an enumeration that emptied,
    // and so this arm is the arm the check above found zero on.
    expect(maskCount).toBe(1 << window);
    expect(keepsMoment).toBe(16512);
    // The control really is the roster as it was: it promotes nothing at all.
    expect(controlPromotions).toBe(0);
    // And it carries the five.
    expect(oneWayDoorViolating).toBe(5);
  });

  it('holds the decision moment and the other arm goes to zero too [the-day-granularity-residue-is-the-decision-moment]', { timeout: budgetFrom(15_553) }, () => {
    // TAKEN AT THE `'last-attended-check-in'` CONTROL ANCHOR — `anchoredRun`'s
    // own default, and its docstring says why: `spendsOn` holds a moment that
    // attendance decides, and only an anchor that derives its moment from
    // attendance has one to hold.
    //
    // THE PROOF THAT THE RESIDUE UNDER THAT ANCHOR IS THE SIMULATED PLAYER'S
    // DECISION MOMENT rather than anything §5 prices, funds or times, and it is
    // a counterfactual on the decision rule alone. It is the measurement that
    // said the residue was in the SPECIFICATION, which is what this piece then
    // changed: `SHIPPED_DAY_SPENDING_ANCHOR` is the structural version of the
    // same finding, and this stays as the diagnosis it was reached from.
    //
    // The extra check-in is still taken in both runs: it collects, it accrues
    // into every purse, it earns `REPUTATION_PER_CHECK_IN`. What `spendsOn`
    // removes is its power to move the moment the day's banked money is spent
    // at — the anchor is the baseline's own. Everything §5 owns is untouched.
    //
    // Restricted to the pairs where the moment DOES move, because those are the
    // only ones the anchor changes anything for, and the pair count is pinned.
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
    const window = ENGAGEMENT_SWEEP.SPEND_ONCE_WINDOW_SLOTS;
    const slots = days * cadence;
    let movesMoment = 0;
    let freeAnchorViolating = 0;
    let heldAnchorViolating = 0;
    let heldAnchorMoved = 0;
    // The FREE arm is mask-keyed like the two loops above — a run whose
    // `spendsOn` is its own history is a function of the mask alone. The HELD
    // arm deliberately is not cached: its `spendsOn` is the BASELINE's history
    // while its own attendance is the more-engaged one, so it is a function of
    // the pair rather than of the mask, and a cache keyed on the mask would
    // silently hand back the free arm's run and collapse the counterfactual
    // this whole check is.
    const freeCache = new Map<number, EngagementRun>();
    const free = (mask: number): EngagementRun => {
      const hit = freeCache.get(mask);
      if (hit !== undefined) return hit;
      const history = historyFrom(slots, maskAttendance(mask, window), BASE_TRAINED_DAYS);
      const made = anchoredRun(days, history, cadence, history);
      freeCache.set(mask, made);
      return made;
    };
    for (let mask = 0; mask < 1 << window; mask += 1) {
      const attended = maskAttendance(mask, window);
      const history = historyFrom(slots, attended, BASE_TRAINED_DAYS);
      const baseline = free(mask);
      for (let bit = 0; bit < window; bit += 1) {
        if ((mask & (1 << bit)) !== 0) continue;
        const day = Math.floor(bit / cadence);
        let lastAttended = -1;
        for (let tick = 0; tick < cadence; tick += 1) {
          if (attended(day * cadence + tick)) lastAttended = tick;
        }
        if (bit - day * cadence <= lastAttended) continue;
        movesMoment += 1;
        const more = moreEngagedBy(history, bit);
        if (compareEngagement(baseline, free(mask | (1 << bit))).violating) {
          freeAnchorViolating += 1;
        }
        const held = compareEngagement(baseline, anchoredRun(days, more, cadence, history));
        if (held.violating) heldAnchorViolating += 1;
        if (held.movedElements > 0) heldAnchorMoved += 1;
      }
    }
    expect(movesMoment).toBe(8064);
    // With the anchor free — the shipped reading — this arm is the residue.
    expect(freeAnchorViolating).toBe(6459);
    // With the anchor held, and nothing else changed, it is zero.
    expect(heldAnchorViolating).toBe(0);
    // NON-VACUITY, and it is the load-bearing half: the held comparison is not
    // comparing two identical runs. The extra check-in still moves the ledger
    // on this many pairs — it just cannot defer the purchase any more.
    expect(heldAnchorMoved).toBe(7263);
  });


  // -------------------------------------------------------------------------
  // The day ANCHOR is the third independent variable, and it is swept too
  // -------------------------------------------------------------------------

  it('pins every day anchor on the shipped wiring, and only one of the four is zero [the-day-shops-purse-by-purse]', { timeout: budgetFrom(44_000) }, () => {
    // Four full sweeps. 44 s is the COLD cost — two of the four are memo hits
    // when the checks above have already taken them, and this test must not
    // depend on that to fit.
    // THE MEASUREMENT THAT CHOSE THE SPECIFICATION. "Spends once a calendar
    // day" does not say which check-in, and the unstated half was carrying the
    // whole residue. Four readings, one domain, one comparator, one parameter
    // apart.
    let measured = 0;
    const violating: Record<string, number> = {};
    for (const anchor of EMPIRE_DAY_SPENDING_ANCHORS) {
      const tally = anchorWindowed(anchor);
      // The scalar first, so a mutant fails with two integers and the anchor's
      // name rather than with two elided sixteen-field objects.
      expect(tally.violatingPairs, anchor).toBe(MEASURED_ANCHOR.WINDOWED[anchor].violatingPairs);
      expect(tally, anchor).toEqual(MEASURED_ANCHOR.WINDOWED[anchor]);
      // NON-VACUITY PER ARM, in counts rather than bounds: every anchor was run
      // over the whole window, every one of them moved the ledger, and every
      // one of them reached a physio level on every pair. An anchor whose
      // domain had emptied would report a zero that means nothing.
      expect(tally.pairs, anchor).toBe(24576);
      expect(tally.comparedElements, anchor).toBe(589824);
      expect(tally.pairsWherePhysioArrived, anchor).toBe(24576);
      expect(tally.movedPairs, anchor).toBeGreaterThan(0);
      violating[anchor] = tally.violatingPairs;
      measured += 1;
    }
    expect(measured).toBe(4);
    expect(measured).toBe(EMPIRE_DAY_SPENDING_ANCHORS.length);
    // The table, as one object so a shifted row fails with both sides visible.
    expect(violating).toEqual({
      'first-affordable-check-in-per-purse': 0,
      'first-affordable-check-in': 31,
      'first-attended-check-in': 1951,
      'last-attended-check-in': 6459,
    });
    // The shipped anchor is the zero, and the shipped row of the POLICY table
    // is the same measurement — asserted against that object rather than
    // against a copy of it, so the two harnesses cannot quietly disagree.
    expect(MEASURED_ANCHOR.WINDOWED[SHIPPED_DAY_SPENDING_ANCHOR]).toEqual(
      MEASURED_POLICY.WINDOWED['spend-once-per-calendar-day'],
    );
    expect(violating[SHIPPED_DAY_SPENDING_ANCHOR]).toBe(0);
    // VIOLATIONS IN THE OTHER DIRECTION ARE REAL AND THIS IS WHERE THEY ARE.
    // Moving the anchor earlier without asking whether anything is affordable
    // makes the gym shop with less money and commit to a rung it would have
    // skipped: `'first-attended-check-in'`'s worst deficit is TWENTY-SIX TIMES
    // the deferring anchor's, on a quarter of the violating pairs.
    expect(
      MEASURED_ANCHOR.WINDOWED['first-attended-check-in'].worstTrainingIqDeficit,
    ).toBeGreaterThan(
      MEASURED_ANCHOR.WINDOWED['last-attended-check-in'].worstTrainingIqDeficit,
    );
  });

  it('pins every day anchor on the single-purse control, where all four are non-zero', { timeout: budgetFrom(30_766) }, () => {
    // THE ANCHOR IS NOT WHAT MAKES THE ENGINE SAFE, and this is the arm that
    // says so. Put every wall-clock ladder back on one balance and the schedule
    // decides which ladder reaches it first again, whichever check-in the
    // shopping happens at. The purses and the anchor are one repair in two
    // parts, and a reader who took the zero above for the anchor alone would be
    // wrong by 2887.
    let measured = 0;
    for (const anchor of EMPIRE_DAY_SPENDING_ANCHORS) {
      const tally = anchorWindowed(anchor, 'single-purse');
      expect(tally.violatingPairs, anchor).toBe(
        MEASURED_ANCHOR.WINDOWED_SINGLE_PURSE_VIOLATING[anchor],
      );
      expect(tally.violatingPairs, anchor).toBeGreaterThan(0);
      expect(tally.pairs, anchor).toBe(24576);
      measured += 1;
    }
    expect(measured).toBe(4);
    // The shipped anchor's control row is the same number the policy table's
    // single-purse row carries, read from it rather than transcribed.
    expect(MEASURED_ANCHOR.WINDOWED_SINGLE_PURSE_VIOLATING[SHIPPED_DAY_SPENDING_ANCHOR]).toBe(
      MEASURED_POLICY.WINDOWED_SINGLE_PURSE['spend-once-per-calendar-day'].violatingPairs,
    );
  });

  it('splits the shipped anchor by WHEN a purse can first afford, and counts what that misses', () => {
    // THE ARM A VIOLATION WOULD LIVE ON, AND THE HALF THE SPLIT DOES NOT SEE.
    // Under this anchor each purse shops at the first check-in of the day it
    // can afford its next rung, so the only thing an extra check-in changes
    // about WHEN a purse decides is whether it becomes the day's EARLIEST one.
    // Both arms are zero; both arms MOVE, in counts.
    //
    // The title used to say "the one thing an extra check-in can move about
    // it", and that was false in a way this loop can measure. It is the one
    // thing an extra check-in can move about the TIMING. It is not the one
    // thing it can move about the DECISION: two of the four purses hold two
    // ladders (`AXIS_OUTPUT` puts `space` and `spotter` on the roster purse and
    // `coach` and `equipment` on the Bucks purse), the spending loop takes the
    // first startable offer and breaks, and `EmpireGym.nextAxis` advances once
    // per attended calendar day — so an extra check-in on an otherwise-empty
    // day permanently shifts WHICH ladder a two-ladder purse is offered first.
    // The rung-order reading below counts that, and it is 3334 of 24576 rather
    // than nothing, which is what makes the two zeros above a measurement over
    // a live mechanism instead of a zero about an unreachable one.
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
    const window = ENGAGEMENT_SWEEP.SPEND_ONCE_WINDOW_SLOTS;
    const slots = days * cadence;
    const cache = new Map<number, EngagementRun>();
    const at = (mask: number): EngagementRun => {
      const hit = cache.get(mask);
      if (hit !== undefined) return hit;
      const made = runFor(
        days,
        historyFrom(slots, maskAttendance(mask, window), BASE_TRAINED_DAYS),
        'shipped',
        ENGAGEMENT_SWEEP.AXIS_ORDER,
        cadence,
        'spend-once-per-calendar-day',
      );
      cache.set(mask, made);
      return made;
    };
    let movesEarliest = 0;
    let movesEarliestViolating = 0;
    let movesEarliestMoved = 0;
    let keepsEarliest = 0;
    let keepsEarliestViolating = 0;
    let keepsEarliestMoved = 0;
    let rungPairs = 0;
    let rungDiverged = 0;
    let rungSwapped = 0;
    let rungSameAxis = 0;
    const swappedPurses = new Set<string>();
    for (let mask = 0; mask < 1 << window; mask += 1) {
      for (let bit = 0; bit < window; bit += 1) {
        if ((mask & (1 << bit)) !== 0) continue;
        const divergence = compareEngagement(at(mask), at(mask | (1 << bit)));
        if (becomesEarliestOfDay(mask, bit, window, cadence)) {
          movesEarliest += 1;
          if (divergence.violating) movesEarliestViolating += 1;
          if (divergence.movedElements > 0) movesEarliestMoved += 1;
        } else {
          keepsEarliest += 1;
          if (divergence.violating) keepsEarliestViolating += 1;
          if (divergence.movedElements > 0) keepsEarliestMoved += 1;
        }
        // WHICH RUNG, at the same ordinal position in each gym's own start
        // order. Read off `EngagementRun.rungOrder`, which is `EmpireGym.builds`
        // — the spending loop's own record — rather than a second reading of
        // what it ought to have bought.
        rungPairs += 1;
        const left = at(mask).rungOrder;
        const right = at(mask | (1 << bit)).rungOrder;
        const shared = Math.min(left.length, right.length);
        for (let index = 0; index < shared; index += 1) {
          const before = left[index];
          const after = right[index];
          if (before === after) continue;
          rungDiverged += 1;
          const beforeAxis = String(before).split('@')[0] ?? '';
          const afterAxis = String(after).split('@')[0] ?? '';
          if (beforeAxis === afterAxis) {
            rungSameAxis += 1;
          } else {
            rungSwapped += 1;
            swappedPurses.add(
              [
                axisBook(beforeAxis as ExpansionAxis),
                axisBook(afterAxis as ExpansionAxis),
              ].join(' vs '),
            );
          }
          break;
        }
      }
    }
    // The headline numbers first, so a mutant fails with two integers rather
    // than two elided objects — CLAUDE.md's "a check that bites but fails
    // uselessly is half a check".
    expect(movesEarliestViolating).toBe(0);
    expect(keepsEarliestViolating).toBe(0);
    expect({
      movesEarliest,
      movesEarliestViolating,
      movesEarliestMoved,
      keepsEarliest,
      keepsEarliestViolating,
      keepsEarliestMoved,
    }).toEqual(MEASURED_ANCHOR.EARLIEST_SPLIT);
    // The two halves are the headline domain, so neither is a different one.
    expect(movesEarliest + keepsEarliest).toBe(
      MEASURED_ANCHOR.WINDOWED[SHIPPED_DAY_SPENDING_ANCHOR].pairs,
    );
    // THE RUNG-SWAP READING, and the scalar first for the same reason. 3334
    // pairs in which the more-engaged gym starts a different axis at the same
    // position — so "adding a check-in only moves a purse's first affordable
    // moment earlier" is true and is not the safety property, because the
    // decision it leaves free is which of a purse's two ladders takes the money.
    expect(rungSwapped).toBe(3334);
    expect({
      pairs: rungPairs,
      diverged: rungDiverged,
      swapped: rungSwapped,
      sameAxisDifferentLevel: rungSameAxis,
    }).toEqual(MEASURED_ANCHOR.RUNG_SWAP);
    expect(rungPairs).toBe(MEASURED_ANCHOR.WINDOWED[SHIPPED_DAY_SPENDING_ANCHOR].pairs);
    // AND EVERY SWAP IS INSIDE ONE PURSE, which is the mechanism rather than a
    // coincidence: a purse holding one ladder has nothing to swap. Asserted as
    // a set so a swap that crossed two purses fails with both names visible.
    expect([...swappedPurses]).toEqual(['roster-slot vs roster-slot']);
    // The two axes really are on one purse and really are priced apart, read
    // from the shipped tables rather than transcribed — the 800 space rung and
    // the 1000 spotter rung, which is which rung the phase decides between.
    expect(axisBook('space')).toBe(axisBook('spotter'));
    expect(EMPIRE_TUNING.SPACE_LEVEL_COST_GYM_BUCKS[0]).toBeLessThan(
      EMPIRE_TUNING.STAFF_LEVEL_COST_GYM_BUCKS.spotter[0] as number,
    );
  });

  it('keeps §5.3\'s promotion path load-bearing at the shipped anchor: 824 without it', () => {
    // THE CONTROL THE TWO ZEROS ABOVE ARE ZEROS AGAINST, over the same masks
    // and the same window — `keepsEarliest + movesEarliest` is pinned at 24576
    // there and `pairs` is pinned at 24576 here, so "the same domain" is a
    // measured equality rather than a claim.
    //
    // The promotion repair was ruled in against 5 pairs measured at the OLD
    // day anchor. Respecifying the anchor could have removed its subject; it
    // did not. `'one-way-door'` — a filled roster slot filled forever — is
    // worth 824 violating pairs of 24576 at the shipped anchor, so the repair
    // is load-bearing here too, and by a wider margin than the ruling had.
    const days = ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS;
    const cadence = ENGAGEMENT_SWEEP.CHECK_INS_PER_DAY;
    const window = ENGAGEMENT_SWEEP.SPEND_ONCE_WINDOW_SLOTS;
    const slots = days * cadence;
    const cache = new Map<number, EngagementRun>();
    const at = (mask: number): EngagementRun => {
      const hit = cache.get(mask);
      if (hit !== undefined) return hit;
      const made = upgradeRun(
        days,
        historyFrom(slots, maskAttendance(mask, window), BASE_TRAINED_DAYS),
        cadence,
        'one-way-door',
      );
      cache.set(mask, made);
      return made;
    };
    let pairs = 0;
    let oneWayDoorViolating = 0;
    let controlPromotions = 0;
    for (let mask = 0; mask < 1 << window; mask += 1) {
      controlPromotions += at(mask).census.promotions;
      for (let bit = 0; bit < window; bit += 1) {
        if ((mask & (1 << bit)) !== 0) continue;
        pairs += 1;
        if (compareEngagement(at(mask), at(mask | (1 << bit))).violating) oneWayDoorViolating += 1;
      }
    }
    expect(oneWayDoorViolating).toBe(824);
    expect(oneWayDoorViolating).toBe(MEASURED_ANCHOR.ONE_WAY_DOOR_VIOLATING);
    // The domain, so an 824 cannot be an 824 about an enumeration that shrank.
    expect(pairs).toBe(MEASURED_ANCHOR.WINDOWED[SHIPPED_DAY_SPENDING_ANCHOR].pairs);
    // The control really is the roster as it was: it promotes nothing at all,
    // and the shipped run over the same masks promotes on every one of them.
    expect(controlPromotions).toBe(0);
  });

  it('takes the shipped anchor to a second exhaustive domain: every calendar of a coarse grid', () => {
    // 114688 pairs, whole rather than windowed, under the day-granularity
    // policy — the headline sweep runs this grid under the shipped per-check-in
    // policy and never under this one. Seven days at two check-ins is a
    // different shape of day from six check-ins at twelve days: two check-ins
    // means the day's earliest opportunity is one of two moments rather than
    // one of six, which is where a per-purse anchor has the least room.
    const tally = coarseDaySweep(SHIPPED_DAY_SPENDING_ANCHOR);
    expect(tally.violatingPairs).toBe(0);
    expect(tally).toEqual(MEASURED_ANCHOR.COARSE_FULL);
    // The physio half is live on this grid rather than an empty domain, and the
    // comparator moved: counts, not bounds.
    expect(tally.pairsWherePhysioArrived).toBe(21737);
    expect(tally.movedPairs).toBe(105225);
  });

  it('pins the four anchors on a seeded domain too, at 20 and 40 days', { timeout: budgetFrom(16_303) }, () => {
    // A SECOND DOMAIN FOR THE ANCHOR TABLE, so the choice above is not one
    // enumeration's opinion. Seeded rather than exhaustive, at the sweep's own
    // seeds and density.
    const twenty: Record<string, number> = {};
    const forty: Record<string, number> = {};
    let measured = 0;
    for (const anchor of EMPIRE_DAY_SPENDING_ANCHORS) {
      const short = seededSweep(
        20,
        12,
        ENGAGEMENT_SWEEP.SEEDS[0],
        'shipped',
        ENGAGEMENT_SWEEP.AXIS_ORDER,
        'spend-once-per-calendar-day',
        anchor,
      );
      const long = seededSweep(
        40,
        6,
        ENGAGEMENT_SWEEP.SEEDS[1],
        'shipped',
        ENGAGEMENT_SWEEP.AXIS_ORDER,
        'spend-once-per-calendar-day',
        anchor,
      );
      // The domain, per arm, before any count taken off it is read.
      expect(short.pairs, anchor).toBe(644);
      expect(long.pairs, anchor).toBe(623);
      expect(short.pairsWherePhysioArrived, anchor).toBe(644);
      expect(long.pairsWherePhysioArrived, anchor).toBe(623);
      twenty[anchor] = short.violatingPairs;
      forty[anchor] = long.violatingPairs;
      measured += 1;
    }
    expect(measured).toBe(4);
    expect(twenty).toEqual(MEASURED_ANCHOR.SEEDED_20_VIOLATING);
    expect(forty).toEqual(MEASURED_ANCHOR.SEEDED_40_VIOLATING);
    expect(twenty[SHIPPED_DAY_SPENDING_ANCHOR]).toBe(0);
    expect(forty[SHIPPED_DAY_SPENDING_ANCHOR]).toBe(0);
    // Said rather than implied: at forty days two of the three controls are
    // zero as well, so this domain separates the anchors less sharply than the
    // exhaustive window does. That is a fact about a sampled domain reaching a
    // rare shape, and it is why the window is the headline.
    expect(forty['first-affordable-check-in']).toBe(0);
  });

  // The two readings below are each split in half, and the split is only about
  // wall time: `vitest.config.ts`'s budget is per test and its own header says
  // the margin is the thing worth writing down rather than widening. The halves
  // are named from `EMPIRE_SPENDING_POLICIES` itself and reassembled in a check
  // of their own, so a policy cannot fall down the crack between them.
  const FIRST_HALF = EMPIRE_SPENDING_POLICIES.slice(0, 3);
  const SECOND_HALF = EMPIRE_SPENDING_POLICIES.slice(3);

  it('splits the two long readings without dropping a policy between the halves', () => {
    // `SINGLE_PURSE_VIOLATING_PAIRS` is the header's right-hand column, and it
    // was DECLARED AND READ BY NOTHING for as long as it has existed — a table
    // a report quotes with no check behind it, which is the shape CLAUDE.md
    // opens with. It is derived from the whole tallies here, in both
    // directions, so the column and the measurement cannot come apart.
    // Only four of the six carry a whole tally — `WINDOWED_SINGLE_PURSE` holds
    // the ones a check drives — so the derivation is over those four and the
    // count of them is pinned, rather than over a loop that would silently
    // walk two keys that are not there.
    let columns = 0;
    for (const [spending, tally] of Object.entries(MEASURED_POLICY.WINDOWED_SINGLE_PURSE)) {
      expect(
        MEASURED_POLICY.SINGLE_PURSE_VIOLATING_PAIRS[spending as EmpireSpendingPolicy],
        spending,
      ).toBe(tally.violatingPairs);
      columns += 1;
    }
    expect(columns).toBe(4);
    expect(Object.keys(MEASURED_POLICY.SINGLE_PURSE_VIOLATING_PAIRS).sort()).toEqual(
      [...EMPIRE_SPENDING_POLICIES].sort(),
    );
    // The two the tally table does not carry are measured by the sweep beside
    // it — `windowedSweep(..., 'single-purse')` under each — so they are pinned
    // here directly rather than left as the only two rows nothing checks.
    expect(MEASURED_POLICY.SINGLE_PURSE_VIOLATING_PAIRS['rotate-greedy-per-check-in']).toBe(
      MEASURED.WINDOWED_SINGLE_PURSE.violatingPairs,
    );
    expect(MEASURED_POLICY.SINGLE_PURSE_VIOLATING_PAIRS['cheapest-affordable-first']).toBe(
      MEASURED_POLICY.SINGLE_PURSE_VIOLATING_PAIRS['fixed-order-no-rotation'],
    );

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
   * what made the windowed zeros unreadable. It was five of six until the day
   * anchor was written down as a parameter, and it is six of six now.
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

  /**
   * Every policy, in `EMPIRE_SPENDING_POLICIES` order.
   *
   * This was five of six for as long as the day-granularity policy spent at the
   * day's last check-in. It is all six at `SHIPPED_DAY_SPENDING_ANCHOR`, and
   * the anchor block keeps the other three anchors' seeded counts beside it —
   * 4, 8 and 60 at twenty days — so "all six" is a zero against numbers taken
   * on this same domain.
   */
  const ZERO_AT_EVERY_SEEDED_HORIZON: readonly EmpireSpendingPolicy[] = [
    ...EMPIRE_SPENDING_POLICIES,
  ];

  it('finds all six policies zero at 20 seeded days', () => {
    expect(seededArm(20, 12, ENGAGEMENT_SWEEP.SEEDS[0], MEASURED_POLICY.SEEDED_20)).toEqual([
      ...ZERO_AT_EVERY_SEEDED_HORIZON,
    ]);
    expect(ZERO_AT_EVERY_SEEDED_HORIZON.length).toBe(6);
  });

  it('finds all six policies zero at 40 seeded days', { timeout: budgetFrom(14_651) }, () => {
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

  it('takes the whole-day reading under the first three policies', { timeout: budgetFrom(12_275) }, () => {
    expect(wholeDayArm(FIRST_HALF)).toBe(3);
  });

  it('takes the whole-day reading under the last three, and all six are zero', { timeout: budgetFrom(17_221) }, () => {
    expect(wholeDayArm(SECOND_HALF)).toBe(3);
    // Named here rather than left in the table: the arm that measured 600
    // before the ruling is the day-granularity policy, and it is zero now.
    expect(MEASURED_POLICY.WHOLE_DAY_VIOLATING_PAIRS['spend-once-per-calendar-day']).toBe(0);
    expect(MEASURED_POLICY.WHOLE_DAY_VIOLATING_PAIRS['rotate-greedy-per-check-in']).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// WHICH DOMAINS THE ANCHOR CLAIM IS ACTUALLY MADE ON
// ---------------------------------------------------------------------------

/**
 * One domain the day-anchor claim covers, and the evidence it carries.
 *
 * THE DEFECT THIS TABLE EXISTS FOR. GDD §5.4 credited the shipped anchor with
 * "0 violating pairs on every domain measured" and listed five domains. Two of
 * the five never consulted the anchor: `windowedSweep` and `seededSweep` both
 * default `spending` to `SHIPPED_SPENDING_POLICY`, which is per-check-in, and
 * the day-4 test and the 60/100-day test call them with no spending argument.
 * `runEngagement` never reads `anchor` under a per-check-in policy, so those two
 * tallies are evidence about the policy and about nothing at all about the
 * anchor — and they read, in a sentence, exactly like the three that were.
 * Before this table the longest horizon the shipped day anchor had ever been
 * measured at was 40 days, on 623 pairs from 6 seeded histories.
 *
 * So the claim is this list rather than a sentence, and every row is a test
 * generated from the row. A domain named in the claim without a row here is not
 * measured; a row whose sweep goes anchor-inert reports `anchorDecisions: 0`
 * and reddens with two integers rather than passing.
 *
 * `runs` and `anchorDecisions` are the sweeps' own record, summed across the
 * anchors the row runs, taken through `noteRun` at the three constructors —
 * observed rather than derived from `spending`, which is what stops the guard
 * being a restatement of the parameter it is checking.
 */
interface AnchorDomain {
  /** What GDD §5.4 and this file's header call this domain. */
  readonly name: string;
  /** The anchors this row runs. Four where the cost allows; one where it does not. */
  readonly anchors: readonly EmpireDaySpendingAnchor[];
  readonly sweep: (anchor: EmpireDaySpendingAnchor) => EngagementTally;
  /** Pairs one anchor's sweep compares, so a domain that shrank is red. */
  readonly pairs: number;
  /** Runs the row's sweeps built, summed. */
  readonly runs: number;
  /** Questions those runs put to the day anchor, summed. Zero means inert. */
  readonly anchorDecisions: number;
  /** Violating pairs per anchor, for the anchors this row runs. */
  readonly violating: Readonly<Record<string, number>>;
  /**
   * This row's own COLD wall-clock duration, in milliseconds, measured by
   * running its generated test alone. Cold because the memo makes a warm run of
   * several of these nearly free, and a budget taken warm would be a budget for
   * whichever row happened to run second. `budgetFrom` turns it into the test's
   * declared timeout.
   */
  readonly measuredMs: number;
}

const FOUR_ANCHORS = EMPIRE_DAY_SPENDING_ANCHORS;
const SHIPPED_ANCHOR_ONLY: readonly EmpireDaySpendingAnchor[] = [SHIPPED_DAY_SPENDING_ANCHOR];

const ANCHOR_DOMAINS: readonly AnchorDomain[] = Object.freeze([
  {
    name: 'the 24576-pair window',
    anchors: FOUR_ANCHORS,
    sweep: (anchor) => anchorWindowed(anchor),
    pairs: 24576,
    runs: 16384,
    anchorDecisions: 2187754,
    violating: MEASURED_ANCHOR.WINDOWED_VIOLATING,
    measuredMs: 25_589,
  },
  {
    name: 'the same window moved to day 4',
    anchors: FOUR_ANCHORS,
    sweep: lateAnchorWindowed,
    pairs: 2304,
    runs: 2048,
    anchorDecisions: 284608,
    violating: MEASURED_ANCHOR.LATE_WINDOW_VIOLATING,
    measuredMs: 3_307,
  },
  {
    name: 'every calendar of the coarse grid, whole',
    anchors: SHIPPED_ANCHOR_ONLY,
    sweep: coarseDaySweep,
    pairs: 114688,
    runs: 16384,
    anchorDecisions: 139842,
    violating: { 'first-affordable-check-in-per-purse': 0 },
    measuredMs: 4_738,
  },
  {
    name: 'seeded histories at 20 days',
    anchors: FOUR_ANCHORS,
    sweep: (anchor) => seededAnchorSweep(20, 12, ENGAGEMENT_SWEEP.SEEDS[0], anchor),
    pairs: 644,
    runs: 2624,
    anchorDecisions: 378211,
    violating: MEASURED_ANCHOR.SEEDED_20_VIOLATING,
    measuredMs: 5_142,
  },
  {
    name: 'seeded histories at 40 days',
    anchors: FOUR_ANCHORS,
    sweep: (anchor) => seededAnchorSweep(40, 6, ENGAGEMENT_SWEEP.SEEDS[1], anchor),
    pairs: 623,
    runs: 2516,
    anchorDecisions: 744027,
    violating: MEASURED_ANCHOR.SEEDED_40_VIOLATING,
    measuredMs: 10_553,
  },
  {
    name: 'seeded histories at 60 days',
    anchors: FOUR_ANCHORS,
    sweep: (anchor) => seededAnchorSweep(60, 4, ENGAGEMENT_SWEEP.SEEDS[2], anchor),
    pairs: 650,
    runs: 2616,
    anchorDecisions: 1150954,
    violating: MEASURED_ANCHOR.SEEDED_60_VIOLATING,
    measuredMs: 17_731,
  },
  {
    name: 'seeded histories at 100 days',
    anchors: FOUR_ANCHORS,
    sweep: (anchor) => seededAnchorSweep(100, 2, ENGAGEMENT_SWEEP.SEEDS[3], anchor),
    pairs: 556,
    runs: 2232,
    anchorDecisions: 1644681,
    violating: MEASURED_ANCHOR.SEEDED_100_VIOLATING,
    measuredMs: 25_235,
  },
  {
    name: 'the whole-day reading',
    anchors: SHIPPED_ANCHOR_ONLY,
    sweep: () => wholeDaySweep(ENGAGEMENT_SWEEP.WHOLE_DAY_HORIZON_DAYS, 'spend-once-per-calendar-day'),
    pairs: 24576,
    runs: 4096,
    anchorDecisions: 258713,
    violating: { 'first-affordable-check-in-per-purse': 0 },
    measuredMs: 4_466,
  },
]);

describe('the domains the day anchor is measured on, one test per domain', () => {
  for (const domain of ANCHOR_DOMAINS) {
    it(`measures the day anchor on ${domain.name}`, { timeout: budgetFrom(domain.measuredMs) }, () => {
      let runs = 0;
      let anchorDecisions = 0;
      const violating: Record<string, number> = {};
      for (const anchor of domain.anchors) {
        const tally = domain.sweep(anchor);
        const record = sweepRecord();
        runs += record.runs;
        anchorDecisions += record.anchorDecisions;
        // The domain, per arm, before any count taken off it is read.
        expect(tally.pairs, `${domain.name} @ ${anchor}`).toBe(domain.pairs);
        violating[anchor] = tally.violatingPairs;
      }
      // THE ANCHOR-INERTNESS GUARD, and the scalar first so an inert domain
      // fails with "expected 0 to be <n>" naming the domain rather than with
      // two elided objects. This is the assertion the two mis-credited domains
      // would have failed: a per-check-in sweep builds its runs and puts ZERO
      // questions to `EMPIRE_DAY_SPENDING_ANCHORS`.
      expect(anchorDecisions, `${domain.name}: anchor decisions`).toBeGreaterThan(0);
      expect({ runs, anchorDecisions }, domain.name).toEqual({
        runs: domain.runs,
        anchorDecisions: domain.anchorDecisions,
      });
      expect(violating, domain.name).toEqual(domain.violating);
      expect(violating[SHIPPED_DAY_SPENDING_ANCHOR], domain.name).toBe(0);
    });
  }

  it('pins the global budget it mirrors, and the rule that derives from it', () => {
    // `SWEEP_BUDGET.GLOBAL_MS` is a copy of `vitest.config.ts`'s
    // `TEST_TIMEOUT_MS`, and a copy that cannot go stale is the only kind worth
    // having. Read from that file's source, so raising the global there without
    // touching this one is red rather than silently making every derived budget
    // here a floor it no longer is.
    const config = readFileSync(path.join(process.cwd(), 'vitest.config.ts'), 'utf8');
    const declared = /const TEST_TIMEOUT_MS = ([0-9_]+);/.exec(config);
    expect(declared, 'vitest.config.ts declares TEST_TIMEOUT_MS').not.toBeNull();
    expect(Number((declared?.[1] ?? '').replace(/_/g, ''))).toBe(SWEEP_BUDGET.GLOBAL_MS);
    // The rule, at the three places it can go wrong: it doubles, it rounds up
    // to five seconds, and it never returns a budget TIGHTER than the global —
    // which is the arithmetic accident that would turn a fast test's own
    // declaration into a regression.
    expect(budgetFrom(38_823)).toBe(80_000);
    expect(budgetFrom(21_317)).toBe(45_000);
    expect(budgetFrom(1_000)).toBe(SWEEP_BUDGET.GLOBAL_MS);
    expect(() => budgetFrom(0)).toThrow(/real measurement/);
    // And every declared row's budget really is above its own measurement, so a
    // row whose sweep grew past its budget is caught here as well as by the
    // clock. Counted rather than bounded, so an empty table reports itself.
    let checked = 0;
    for (const domain of ANCHOR_DOMAINS) {
      expect(budgetFrom(domain.measuredMs), domain.name).toBeGreaterThan(domain.measuredMs);
      checked += 1;
    }
    expect(checked).toBe(ANCHOR_DOMAINS.length);
  });

  it('has a row for every domain the anchor claim names, and no other', () => {
    // The table is the claim, so its shape is pinned rather than left to
    // whoever reads the list. Eight rows, four of which run all four anchors —
    // and the two single-anchor rows say so in `anchors` rather than in a
    // sentence, because "measured on the coarse grid" reads identically whether
    // it means one anchor or four.
    expect(ANCHOR_DOMAINS.length).toBe(8);
    expect(new Set(ANCHOR_DOMAINS.map((domain) => domain.name)).size).toBe(8);
    const fourAnchorRows = ANCHOR_DOMAINS.filter(
      (domain) => domain.anchors.length === EMPIRE_DAY_SPENDING_ANCHORS.length,
    );
    expect(fourAnchorRows.length).toBe(6);
    // Every row runs the shipped anchor, or its zero is about something else.
    for (const domain of ANCHOR_DOMAINS) {
      expect(domain.anchors.includes(SHIPPED_DAY_SPENDING_ANCHOR), domain.name).toBe(true);
      expect(Object.keys(domain.violating).sort(), domain.name).toEqual([...domain.anchors].sort());
    }
    // The headline row's counts and the whole-tally table's are one set of
    // numbers written twice, so they are tied in both directions rather than
    // left to agree by inspection.
    let tied = 0;
    for (const anchor of EMPIRE_DAY_SPENDING_ANCHORS) {
      expect(MEASURED_ANCHOR.WINDOWED_VIOLATING[anchor], anchor).toBe(
        MEASURED_ANCHOR.WINDOWED[anchor].violatingPairs,
      );
      tied += 1;
    }
    expect(tied).toBe(4);
    expect(Object.keys(MEASURED_ANCHOR.WINDOWED_VIOLATING).sort()).toEqual(
      [...EMPIRE_DAY_SPENDING_ANCHORS].sort(),
    );
    // AND THE TWO DOMAINS THAT ARE NOT ANCHOR MEASUREMENTS ARE NOT ON THIS
    // LIST, which is the other half of the correction. `windowedSweep` and
    // `seededSweep` at the DEFAULT spending policy build real runs that ask the
    // anchor nothing, and this is that stated as a measurement rather than as a
    // caveat: both report zero decisions over thousands of runs.
    beginSweep();
    windowedSweep(
      ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
      ENGAGEMENT_SWEEP.LATE_WINDOW_FROM_SLOT,
      ENGAGEMENT_SWEEP.LATE_WINDOW_SLOTS,
    );
    const inertLate = sweepRecord();
    expect(inertLate.runs).toBeGreaterThan(0);
    expect(inertLate.anchorDecisions).toBe(0);
    beginSweep();
    seededSweep(20, 12, ENGAGEMENT_SWEEP.SEEDS[0]);
    const inertSeeded = sweepRecord();
    expect(inertSeeded.runs).toBeGreaterThan(0);
    expect(inertSeeded.anchorDecisions).toBe(0);
    expect({ inertLateRuns: inertLate.runs, inertSeededRuns: inertSeeded.runs }).toEqual({
      inertLateRuns: 512,
      inertSeededRuns: 656,
    });
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
    expect(control.violatingPairs).toBe(13);
    expect(control.physioArrivalLater).toBe(5);
  });
});

