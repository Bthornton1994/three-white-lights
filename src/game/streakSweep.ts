/**
 * streakSweep.ts — the calendars the streak monotonicity measurement runs on.
 *
 * PURE MODULE (CLAUDE.md "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock, no `Math.random`. Every schedule this file
 * produces is a pure function of a seed that is written down below.
 *
 * ===========================================================================
 * WHY THIS IS A MODULE AND NOT A HELPER INSIDE `streak.test.ts`
 * ===========================================================================
 *
 * GDD §4.4 records a measurement — "training one more day never lowers your
 * streak" — as a count, and a count is only worth something if somebody else
 * can get the same one. The first version of that measurement was reported with
 * its seeds left unstated, and it could not be reproduced afterwards by anyone,
 * including the person who took it: the same sweep at six plausible
 * parameterisations returned six different numbers, none of them the published
 * one. Nothing was wrong with the code. The INPUTS had not been written down.
 *
 * So the inputs live here, in the repository, as named constants and a
 * deterministic generator, and `streak.test.ts` measures through them. A reader
 * who wants to re-derive any number in GDD §4.4 needs this file and the seeds
 * in it, and needs to ask nobody anything.
 *
 * It is registered in `src/tuning/audit.ts` as `data`, NOT as `feel`. None of
 * these numbers is a knob: turning a seed does not change the game, it changes
 * which calendars the property is checked on. They are deliberately not
 * re-exported from `src/tuning/index.ts` for the same reason.
 *
 * ===========================================================================
 * WHAT THE SWEEP IS
 * ===========================================================================
 *
 * A "schedule" is a calendar of consecutive days with a flag per day: did the
 * lifter train. The property under test compares a schedule against every
 * SINGLE-DAY SUPERSET of it — the same calendar with exactly one idle day
 * turned into a trained one — and asks whether the lifter who trained more ever
 * ends on a lower streak.
 *
 * Two generators, because they answer different questions:
 *
 *   - `exhaustiveCalendar` enumerates ALL 2^L calendars of a short length. It is
 *     a proof over that length rather than a sample, and it is the only kind of
 *     evidence that can say "there is no such pair". It stops being runnable
 *     somewhere around L = 17.
 *   - `seededSchedules` samples longer calendars — forty and sixty days, which
 *     is what a training block actually looks like — from written-down seeds.
 *     It cannot prove absence, and the counts it returns are pinned so that a
 *     change in them is visible.
 *
 * There are TWO parameter blocks below, and they answer different questions.
 * `MONOTONICITY_SWEEP` is the measurement of what the two no-free-absence rules
 * CLOSED; `RESIDUE_SWEEP` is the measurement of what they LEFT. They share the
 * seeds and the attendance distribution and differ only in which calendars and
 * which counterfactuals they run, so the second cannot quietly restate the
 * first on a friendlier population.
 *
 * ===========================================================================
 * THE ATTENDANCE DISTRIBUTION, AND WHY IT IS THIS ONE
 * ===========================================================================
 *
 * Each schedule draws ONE attendance rate, then applies it independently per
 * day (a Bernoulli process at that rate). The rate is uniform on
 *
 *     [MIN_ATTENDANCE, MIN_ATTENDANCE + ATTENDANCE_SPREAD]  =  [0.2, 0.9]
 *
 * PER SCHEDULE, NOT PER DAY, and that is the load-bearing half. Drawing the
 * rate once gives a population of lifters that differ from each other —
 * near-daily ones, weekend-only ones, ones who barely show up — where drawing
 * it per day would give 400 copies of one average lifter and would almost never
 * produce the long absences the property is actually about.
 *
 * The bounds are chosen against the mechanic rather than for realism:
 *
 *   - 0.2 is low enough that absences routinely outrun
 *     `LONGEST_REPAIRABLE_ABSENCE_DAYS`, so runs really die in this sweep. A
 *     sweep in which no run ever dies reports zero violations and proves
 *     nothing, which is why `streak.test.ts` asserts that dead runs were seen.
 *   - 0.9 rather than 1.0 because a schedule with no idle day has no single-day
 *     superset and contributes no comparison at all.
 *
 * IT IS NOT TUNED AND IT IS NOT CLAIMED TO BE OPTIMAL. It is claimed to be
 * WRITTEN DOWN. If a future measurement wants a different population, the
 * honest move is to change these constants and re-derive the counts in GDD
 * §4.4, not to sample differently at a call site.
 *
 * ===========================================================================
 * DETERMINISM
 * ===========================================================================
 *
 * The generator is `prng.ts`'s mulberry32 — the one seeded generator in the
 * codebase, already registered as published data — threaded explicitly, so a
 * seed fixes the whole schedule set. `streakSweep.test.ts` asserts that two
 * calls with the same seed are byte-identical and that different seeds differ.
 */

import { TENDER_ARRIVAL, type CoveredDayTender, type TenderArrival } from './currencyProvenance';
import { nextRandom, seedState } from './prng';

/**
 * THE VERIFICATION PARAMETERS. Everything the monotonicity measurement in
 * `streak.test.ts` depends on, in one place, so GDD §4.4's counts can be
 * re-derived from the repository alone.
 */
export const MONOTONICITY_SWEEP = Object.freeze({
  /**
   * Calendar lengths swept EXHAUSTIVELY — all 2^L of each, and every single-day
   * superset of every one.
   *
   * The range starts BELOW the length at which the defect used to first appear
   * (11), so the leading zeros are visible and the sweep cannot be read as
   * passing by starting above the interesting length. It stops at 16 because
   * 2^17 calendars times 17 flips is where the suite's time budget goes.
   */
  EXHAUSTIVE_LENGTHS: Object.freeze([8, 9, 10, 11, 12, 13, 14, 15, 16]),

  /**
   * WINDOW LENGTH THE EXHAUSTIVE SWEEP IS RE-RUN AT, so that its calendars
   * actually cross a window boundary.
   *
   * WHY THIS EXISTS, and it is a gap rather than an enhancement. The shipped
   * `WINDOW_DAYS` is 30 and every exhaustive fixture anchors the signup day at
   * day 0, so an 8-to-16-day calendar lives entirely inside window 0. The only
   * PROOF-GRADE sweep in the repository therefore never saw the refill, never
   * saw two lifters re-converge at a boundary, and never saw a purchased day
   * expire — it proved the property for the sub-mechanism that was never in
   * doubt. Everything boundary-related was covered only by the SAMPLED sweeps.
   *
   * 7 because it is the largest value that puts at least one boundary inside
   * the SHORTEST exhaustive calendar (8 days) and at least two inside the
   * longest (16). Larger and the short lengths go back to being single-window;
   * much smaller and the entitlement refills so often that no absence can
   * outlive a window, which makes the sweep clean for an uninteresting reason.
   *
   * IT IS A MEASUREMENT PARAMETER, NOT A TUNING. The shipped window stays 30.
   */
  BOUNDARY_CROSSING_WINDOW_DAYS: 7,

  /**
   * Days the boundary-crossing sweep buys an Extra Covered Day on.
   *
   * FIXED POSITIONS ON THE CALENDAR, which is the only safe keying — both
   * members of every monotonicity pair buy on exactly these days, so nothing
   * the lifter does can move a purchase and the arm measures the ENGINE rather
   * than the purse. `coveredDayPurchaseDays` is deliberately NOT used here: at
   * `PRICE_IN_CHALK` 3 and `CHALK_PER_CALENDAR_DAYS` 10 a sixteen-day calendar
   * accrues one Chalk and buys nothing, so that generator makes this arm
   * silently identical to the no-purchase arm. It was, on the first run of this
   * sweep, and the two arms reporting byte-identical consumption is what showed
   * it.
   *
   * CHOSEN SO THAT EVEN THE SHORTEST EXHAUSTIVE CALENDAR BUYS IN TWO WINDOWS.
   * At `BOUNDARY_CROSSING_WINDOW_DAYS` = 7 the windows are days 0-6, 7-13 and
   * 14-20, so an eight-day calendar reaches [0, 3, 7] — two windows — and a
   * sixteen-day one reaches all five and three windows. That guarantees at
   * least one purchased day is credited in one window and expires unused in the
   * next, which is one of the three things the shipped-window exhaustive sweep
   * structurally cannot see. `[0, 3, 6, ...]` was the first attempt and is
   * wrong: day 6 is the last day of window 0, so an eight-day calendar bought
   * inside one window only.
   */
  BOUNDARY_CROSSING_PURCHASE_DAYS: Object.freeze([0, 3, 7, 10, 14]),

  /**
   * Seeds for the sampled sweep. Arbitrary, fixed, and WRITTEN DOWN — which is
   * the entire point of them. Five rather than one so a clean result is not one
   * lucky draw.
   *
   * Hexadecimal because they are bit patterns fed to a 32-bit generator, not
   * quantities.
   */
  SEEDS: Object.freeze([0x5eed_1eaf, 0x09e2_31f5, 0x0000_0001, 0x00c0_ffee, 0xdead_beef]),

  /** Schedules drawn per seed. */
  SCHEDULES_PER_SEED: 400,

  /**
   * Calendar lengths for the sampled sweep. Forty is a training block; sixty is
   * long enough to reach the second streak milestone, which is where the
   * residue GDD §4.4 records lives.
   */
  SAMPLED_LENGTHS: Object.freeze([40, 60]),

  /** Lowest attendance rate a schedule can be drawn at. See the header. */
  MIN_ATTENDANCE: 0.2,

  /** Width of the attendance range above `MIN_ATTENDANCE`. See the header. */
  ATTENDANCE_SPREAD: 0.7,
});

/**
 * THE SECOND MEASUREMENT'S PARAMETERS: the one that characterises what is LEFT
 * after the two no-free-absence rules, rather than what they closed.
 *
 * SEPARATE FROM `MONOTONICITY_SWEEP` ON PURPOSE. Adding 80 and 100 to
 * `SAMPLED_LENGTHS` would silently change what GDD §4.4's published 40/60 table
 * means, and would make a table that is quoted in three places grow a column
 * every time somebody asks a new question. The seeds, the schedule count and
 * the attendance distribution are shared — this block only says *which further
 * calendars* and *which counterfactuals* the residue was characterised on.
 */
export const RESIDUE_SWEEP = Object.freeze({
  /**
   * Further calendar lengths, swept to answer "does the residue grow without
   * bound, or does it saturate?". A streak game is played for years, so a
   * defect whose rate climbs with the calendar is a different and worse thing
   * than one that plateaus, and the count at any single length cannot tell them
   * apart.
   *
   * 80 and 100 rather than 200 and 400 because these two cost about three
   * seconds in the suite and 400 costs fifteen. The longer lengths were
   * measured by hand off this same generator and are recorded in GDD §4.4 as
   * unpinned observations, which is the honest label for a number no test
   * re-derives.
   */
  LENGTHS: Object.freeze([80, 100]),

  /** The length the counterfactuals below are run at. */
  COUNTERFACTUAL_LENGTH: 60,

  /**
   * Calendar days on which the SCHEDULE-INDEPENDENT INCOME counterfactual drops
   * one Recovery Day.
   *
   * WHAT THIS EXISTS TO SEPARATE. The published counterfactual switched streak
   * milestone income OFF, and with it off there is no income at all in this
   * sweep after the signup grant — so it could only ever show that income is
   * *involved*. It could not tell "income whose ARRIVAL the schedule decides"
   * apart from "income at all". These days are fixed points on the calendar
   * that both members of a pair reach identically, so income exists, is the
   * same size, and arrives at a moment neither lifter's training can move.
   *
   * Two of them, mid and late, because a grant landing early has most of the
   * calendar to wash out in and a grant landing late does not — measured, the
   * two positions behave very differently, and one of them alone would have
   * been a misleading sample.
   */
  FIXED_INCOME_DAYS: Object.freeze([20, 40]),
});

/**
 * THE THIRD MEASUREMENT'S PARAMETERS: the verification of the ROLLING
 * ENTITLEMENT that GDD §4.2 ruled in to replace the Recovery Day stock.
 *
 * WHY IT IS ITS OWN BLOCK AND ITS OWN GRID. The two blocks above measure a
 * defect. This one is asked to establish an ABSENCE of one, and a zero is the
 * easiest number in the world to get by accident — the last two "this closes
 * it" claims on this module both survived a single sweep and died under a
 * trace. So this block does not describe one sweep; it describes a battery,
 * aimed at the specific failure classes the stock design turned out to have:
 *
 *   - the LIFETIME BEST, which was never measured past 16 days and was the half
 *     that does not heal;
 *   - the deficit MAGNITUDE at long horizons, because the stock's frequency
 *     saturated while its worst case kept climbing to 189 days;
 *   - MANY PARAMETERISATIONS, because one model is how the previous two claims
 *     lasted as long as they did.
 */
export const ENTITLEMENT_VERIFICATION = Object.freeze({
  /** Lengths the full battery runs at, at `SCHEDULES_PER_SEED` per seed. */
  LENGTHS: Object.freeze([40, 60, 80, 100]),

  /**
   * Long horizons, for MAGNITUDE rather than frequency. A streak game is played
   * for years and the stock design's worst deficit reached 189 days at 400.
   *
   * Fewer schedules per seed than the short lengths, and that is a stated
   * trade rather than an oversight: 400 days at the full 400 schedules costs
   * about twenty-five seconds on its own, which is most of this file's budget
   * for one number.
   */
  LONG_LENGTHS: Object.freeze([200, 400]),
  LONG_SCHEDULES_PER_SEED: 100,

  /**
   * Attendance rates for the population the seeded generator does NOT produce.
   * `seededSchedules` draws one rate per schedule from [0.2, 0.9], so it has
   * few near-perfect and no sub-0.2 lifters. These aim at both tails directly.
   */
  FIXED_ATTENDANCE_RATES: Object.freeze([0.1, 0.25, 0.5, 0.75, 0.95]),
  FIXED_ATTENDANCE_LENGTH: 120,
  FIXED_ATTENDANCE_SCHEDULES: 120,
  FIXED_ATTENDANCE_SEED: 0x51de_51de,

  /**
   * Window lengths and per-window entitlements the property is checked over.
   * The shipped tuning is one point in this grid; a playtester moving the knob
   * must not be able to move the property.
   *
   * 1 and 365 are in deliberately: a window of one day is "the entitlement
   * refreshes daily" and a window of a year is "it barely refreshes at all",
   * and the property should not care.
   */
  WINDOW_DAYS_GRID: Object.freeze([1, 7, 13, 30, 31, 365]),
  PER_WINDOW_GRID: Object.freeze([0, 1, 2, 3, 5]),

  /**
   * Calendar days a granted covered day lands on, for the purchase path. These
   * are FIXED POSITIONS ON THE CALENDAR, which is the whole point — see
   * `streakEntitlement.ts` §3 for the measurement that says a grant keyed to
   * anything the lifter does reopens the defect.
   *
   * 30 is exactly a window boundary at the shipped tuning, and it is in the
   * list for that reason.
   */
  CALENDAR_GRANT_DAYS: Object.freeze([Object.freeze([10]), Object.freeze([30]), Object.freeze([15, 45])]),

  /**
   * Purchase schedules for the BANKABLE variant — a purchased covered day that
   * does NOT expire with its window.
   *
   * The shipped module expires it. This grid exists because the first version
   * of GDD §8.2 justified the expiry as a SAFETY property, and that turned out
   * to be false: the burn is what keeps a CALENDAR-FUNDED purchase safe, not
   * the expiry. Ten purchases and a front-loaded block are in here specifically
   * because a hoard is what a bankable product produces and a hoard is what the
   * old Recovery Day defect was made of.
   *
   * EVERY LIST HERE IS A FIXED CALENDAR, AND THE SCOPE IS THE FINDING. These
   * days are ones neither lifter's training can move, so what this grid can
   * establish is "banking is free ON THIS ARM" and nothing wider. GDD §8.2's
   * "a bankable purchased day is monotone-safe" was this measurement read
   * without its scope, and it is retracted there. On training-keyed funding a
   * bankable day violates — 77 / 275 / 696 / 681 — which is measured through
   * `judgeBankablePurchaseArm` instead.
   */
  BANKABLE_PURCHASE_DAYS: Object.freeze([
    Object.freeze([10, 40]),
    Object.freeze([5, 15, 25, 35, 45, 55, 65, 75, 85, 95]),
    Object.freeze([0, 1, 2, 3, 4, 5]),
  ]),

  /**
   * The adversarial search: random restarts, then hill-climbing on single-day
   * mutations towards the largest deficit any single-day superset shows.
   *
   * IT LOOKS FOR THE VIOLATION INSTEAD OF WAITING FOR ONE TO BE SAMPLED, which
   * is the difference between a sweep and an attack. Sized so it costs a few
   * seconds: the point is that it is run every time, not that it is exhaustive.
   */
  ADVERSARIAL: Object.freeze({ LENGTH: 90, RESTARTS: 12, STEPS: 120, SEED: 0x0bad_c0de }),

  /**
   * Grant schedules that MUST fail — the negative controls. A verification that
   * only ever reports zeros cannot distinguish a property that holds from a
   * harness that is not looking.
   */
  STREAK_KEYED_GRANT_AT: 7,
  SESSION_KEYED_GRANT_EVERY: 10,
});

/**
 * THE FOURTH MEASUREMENT'S PARAMETERS: GDD §8.3E's Extra Covered Day purchase,
 * and specifically the question the by-week rule in §8.3C does NOT answer.
 *
 * WHY IT NEEDS ITS OWN BLOCK. §8.3C was re-keyed so the season pass pays covered
 * days by week and never by tier, because a tier unlocks by playing. But the pass
 * also pays CHALK, and Chalk buys covered days — so if Chalk arrives on anything
 * training reaches ("rare achievements" in §8.2, a pass tier in §8.3C), the
 * lifter's own training moves the day they can AFFORD coverage. That is the
 * banned shape one hop further out, and the by-week rule as written does not
 * reach it. It is measured here rather than argued.
 *
 * THE DESIGN IS MATCHED, AND THE MATCHING IS THE WHOLE POINT. An earlier cut of
 * this measurement compared "buy every 7 days" against "buy when affordable" and
 * found the training-keyed model looking BETTER — an artifact, because the
 * calendar model also bought roughly twice as many covered days, and a bigger
 * bank hides violations for reasons that have nothing to do with keying. So all
 * three arms below share one purse, one price and one rule, and the lazy
 * member of every pair buys on identical days in all of them. The only thing
 * that varies is what the DILIGENT member's purchase schedule is computed from:
 *
 *   - `calendar`: Chalk trickles on the calendar only, so both members buy on
 *     the same days by construction. The training-independent control.
 *   - `frozen`: Chalk trickles on achievements, but the diligent member is
 *     handed the LAZY member's purchase days. Same rule, same purse, same
 *     price — training simply cannot move the schedule. The matched control.
 *   - `responsive`: the same achievement trickle, recomputed from the diligent
 *     member's own training. The hazard.
 *
 * `frozen` and `responsive` differ in exactly one thing, and it is the thing
 * under test.
 */
export const COVERED_DAY_PURCHASE_SWEEP = Object.freeze({
  /**
   * Schedules per seed for the purchase arms, below `MONOTONICITY_SWEEP.
   * SCHEDULES_PER_SEED` because these arms run three times over and the suite
   * has a time budget.
   *
   * IT IS A STATED TRADE, NOT AN OVERSIGHT. At the full 400 the responsive arm
   * measures 105 / 305 / 733 / 785 violating pairs at 40 / 60 / 80 / 100; at 150
   * it measures 59 / 108 / 203 / 484. The property being asserted is a ZERO on
   * the two clean arms and a NON-ZERO on the negative control, and both survive
   * the reduction with room to spare. GDD §8.3E publishes the full-population
   * numbers and names this constant as the reason the pinned ones are smaller.
   */
  SCHEDULES_PER_SEED: 150,

  /**
   * What one Extra Covered Day costs, in Chalk. Arbitrary and fixed: the
   * measurement is about WHEN a purchase can be afforded, not about the price,
   * and a price that no schedule can ever reach would make the sweep vacuous.
   */
  PRICE_IN_CHALK: 3,

  /**
   * Chalk that arrives on the CALENDAR — one per this many days. Neither
   * lifter's training can move it. GDD §8.2's "purchased" row, and §8.3C's pass
   * paying by week.
   */
  CHALK_PER_CALENDAR_DAYS: 10,

  /**
   * Chalk that arrives on an ACHIEVEMENT — one per this many sessions ever.
   * This is the shape GDD §8.2 gives Chalk's achievement trickle and the shape
   * a season-pass TIER has, and both of them are `'session-count'` tenders in
   * `currencyProvenance.TENDER_ARRIVAL`.
   *
   * IT IS THE NEGATIVE CONTROL NOW, NOT THE HAZARD. When this block was written
   * the hazard was live: `applySettledCoveredDayPurchase` took `'chalk'` and
   * had no way to ask which Chalk. It no longer takes a training-gated tender
   * at all, so this arm measures a configuration the shipped engine refuses —
   * which is the point of keeping it. Delete it and the restriction upstream
   * becomes an assertion nobody re-checks.
   */
  CHALK_PER_SESSIONS: 5,

  /** Covered days one order buys. Flat quantity, flat price — GDD §12.3, no gacha. */
  COVERED_DAYS_PER_ORDER: 1,
});

/**
 * THE DOOMED-SALE SWEEP: where the store's door is checked, in BOTH directions.
 *
 * THE FALSE-POSITIVE DIRECTION IS THE ONE THIS EXISTS FOR. "Refuses a doomed
 * absence" is satisfied by a store that refuses everything, so the load-bearing
 * half is that every absence still coverable is still SELLABLE — and it has to
 * be swept rather than sampled, because a refusal that is too eager by one day
 * is invisible at any fixture somebody picks by hand.
 *
 * THE ORACLE IS `absenceOutcome(...).protectionHolds` AND NOT A RE-DERIVATION.
 * That is the identical call `recordTrainingDay` branches on to decide whether a
 * run survived. A predicate rebuilt here out of `daysMissed`, the grace and the
 * per-absence ceiling would be a second implementation of the coverage rule that
 * agrees with the first only until one of them is edited, and this module has
 * shipped exactly that mistake before.
 *
 * AND IT IS ASKED OF THE NIGHTLY-SETTLED STATE, which is the axis the human's
 * ruling on `STORE_VERDICT_DIVERGENCE` added. The test builds a second state
 * beside each one by offering EVERY day the account has existed to
 * `settleBrokenStreak`, exactly as a nightly job would, and the store must sell
 * exactly when that state's absence holds. Note the oracle is built by the test
 * out of `settleBrokenStreak` and not by calling `settledStateAsOf` — the subject
 * uses that helper, so an oracle that also used it would agree with the subject
 * by construction and measure nothing.
 *
 * IT IS NOT CIRCULAR EVEN THOUGH THE STORE ASKS THE SAME FUNCTION. The oracle
 * and the subject are different functions: the sweep asserts that
 * `applySettledCoveredDayPurchase` — a store, with four other refusals in front
 * of this one — agrees with the absence rule everywhere. Making the refusal any
 * eagerer, or any lazier, breaks that agreement immediately. A second,
 * independent oracle rides along: `openDay`, which must never report
 * `'streak-broken'` on a day the store was willing to sell.
 *
 * THE DOMAIN IS REAL STATES, NOT HAND-BUILT ONES. Every calendar of
 * `EXHAUSTIVE_LENGTH` days is replayed through `recordTrainingDay`, so each probe
 * runs against a state the engine actually produces — including the lifter who
 * has never trained at all, which is mask 0.
 */
export const DOOMED_SALE_SWEEP = Object.freeze({
  /**
   * Calendar length, exhaustively: all 2^L of them.
   *
   * 10 gives 1024 calendars, which crossed with the probe horizon and the three
   * state shapes is about a hundred thousand store decisions and costs under two
   * seconds. Raising it doubles the cost per day for a domain that is already
   * dense in both answers.
   */
  EXHAUSTIVE_LENGTH: 10,

  /**
   * How many days past the end of the calendar each state is probed on.
   *
   * IT REACHES PAST A WINDOW BOUNDARY ON PURPOSE. `WINDOW_DAYS` is 30 and the
   * calendars are anchored at signup, so a horizon that stopped short of day 30
   * would sweep entirely inside window 0 and never see the armed snapshot refill
   * — which is the one place the sale verdict is known to be delicate. 31 puts
   * the boundary strictly inside the probe range for every calendar.
   */
  PROBE_HORIZON_DAYS: 31,

  /** Covered days the probe order asks for. Flat, like every other order. */
  COVERED_DAYS_PER_ORDER: 1,

  /**
   * WHERE THE CALENDAR SITS RELATIVE TO SIGNUP — the axis that lets this domain
   * express a run that ENDS AND THEN COMES BACK, which it previously could not.
   *
   * WHY IT WAS NEEDED, MEASURED RATHER THAN ARGUED. Anchored at signup, the
   * whole 98,304-decision sweep contained ZERO probes where the raw state and a
   * nightly-settled one disagreed about the absence. The reason is arithmetic: a
   * raw absence only stays covered for `LONGEST_REPAIRABLE_ABSENCE_DAYS` days
   * past the last session, the last session is inside a 10-day calendar starting
   * at signup, and the first window boundary is at day `WINDOW_DAYS`. The two
   * can never meet. So the store-verdict divergence the human ruled on lived
   * entirely outside the domain that was supposed to be checking the store, and
   * a sweep is only as honest as the states it can reach.
   *
   * THE BAND IS DERIVED, NOT PICKED. An offset puts the calendar's last day at
   * `WINDOW_DAYS - 1 - k`, for `k` from 0 to `LONGEST_REPAIRABLE_ABSENCE_DAYS`:
   * exactly the placements where a still-covered absence can span the boundary.
   * `streak.test.ts` re-derives these six numbers from the tuning constants and
   * asserts this list against them, so retuning the window moves the band rather
   * than silently missing it. Measured either side of the band — 14 and 22 — the
   * disagreement count is 0 again, which is the band being the right band and
   * not a wide guess.
   *
   * ZERO IS KEPT AS THE FIRST ENTRY. It is the original domain, it is the only
   * one where the lifter's first session is inside the calendar, and dropping it
   * to save time would trade coverage for coverage.
   */
  CALENDAR_START_OFFSETS: [0, 16, 17, 18, 19, 20] as readonly number[],

  /**
   * HOW MANY DAYS BEFORE THE COMPLETION DAY THE CLIENT DREW ITS SCREEN — the
   * axis that lets this domain express a render day that is not the completion
   * day, which it previously could not.
   *
   * WHY IT WAS NEEDED. Every probe in this sweep used to pass the SAME day to
   * the rendered verdict and to completion, so the render-day-≠-completion-day
   * axis was not in the domain at all. That is not an exotic case: the streak
   * day rolls over at `STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL`, so a tap at
   * 02:50 and a settlement at 03:10 are one day apart by the module's own
   * definition. With the axis missing, a refusal that told a legitimately-served
   * client "the offer should never have been on screen" was invisible to
   * roughly six hundred thousand store decisions.
   *
   * IT IS THE SAME HAZARD ONE AXIS OVER FROM WHERE IT WAS LAST FIXED. The
   * fixtures had stopped hardcoding the intra-day ORDER of a purchase against a
   * settle; they still hardcoded the intra-day IDENTITY of rendering and
   * completing.
   *
   * ZERO IS KEPT AS THE FIRST ENTRY, for the same reason it is kept in
   * `CALENDAR_START_OFFSETS`: it is the original domain and the shape a
   * same-day, one-device client actually has.
   *
   * TWO AND NOT MORE. `ABSENCE_ENDED_AFTER_OFFER` needs a lag of at least one,
   * and one day of lag already reaches it; a second day widens the window over
   * which the run can end without changing the shape of the case. The lag is
   * rotated across probes rather than multiplied into the domain — see
   * `streak.test.ts` — so this list costs no probes at all, and the count of
   * probes actually drawn at each lag is pinned there.
   */
  RENDER_DAY_LAGS: [0, 1, 2] as readonly number[],
});

/**
 * WHERE THE STORE'S VERDICT USED TO DEPEND ON WHEN THE APP WAS OPENED, and what
 * closed it.
 *
 * WHAT IT WAS. Since the store refuses to sell into an already-doomed absence,
 * the store's verdict is a function of `absenceOutcome`. `settleBrokenStreak`
 * nulls `lastTrainedDay`, which drops the anchor to the signup day and makes the
 * absence longer — and the armed snapshot REFILLS at a window boundary, so an
 * absence doomed on the last day of a window can be COVERED again on the first
 * day of the next one. On that revival day the two states disagree: the
 * unsettled one has a live run and the settled one has a 29-day absence. So a
 * client that settled nightly was refused a sale that a client which never
 * opened the app was sold.
 *
 * THE TWO HALVES ARE STILL THERE, AND STILL DELIBERATE. The anchor reset is what
 * makes a settled break stay settled; the boundary refill is GDD §4.2's "refills
 * without anybody opening the app". Neither moved. `STALE_VERDICTS_IN_THE_
 * DOOMED_SALE_SWEEP` counts how often they still disagree, and the count is not
 * zero — that is the point.
 *
 * WHAT MOVED IS WHERE THE STORE ASKS. The human's ruling separates rendering
 * from finalising: a stale offer on screen is acceptable, a completed sale that
 * settled state would have refused is not. So
 * `applySettledCoveredDayPurchase` re-validates through `settledStateAsOf`
 * before finalising and refuses with `ABSENCE_SETTLED_WHILE_AWAY`. No coverage
 * arithmetic was re-derived to do it — the walk offers each day to
 * `settleBrokenStreak` and the verdict is the same `absenceOutcome(...)
 * .protectionHolds` call `recordTrainingDay` branches on.
 *
 * IT NEVER REACHED THE STATE, EVEN BEFORE. Every full-state equality across
 * opening schedules held throughout; what differed was how many orders the store
 * took and therefore the spend. That is the difference between a store defect
 * and a §12.3 monotonicity defect, and it is worth being exact about which this
 * was.
 *
 * MEASURED ON THE SHIPPED ENGINE at the parameters in
 * `streak.test.ts`'s `OPEN-DAY SCHEDULE, WITH PURCHASES AND LONG RANDOM
 * CALENDARS`: 300 trials of 20–60 days, three opening schedules compared against
 * `'never'`, so 900 pairs.
 */
export const STORE_VERDICT_DIVERGENCE = Object.freeze({
  /**
   * Pairs, out of 900, where an opening schedule changed whether the store sold.
   *
   * ZERO, AND UNCONDITIONAL AGAIN. It was ONE, with the spend equality beside it
   * weakened to "wherever the store made the same decision" and this number
   * carrying the exception. The human's ruling closed it:
   * `applySettledCoveredDayPurchase` re-validates against settled state before
   * finalising, so the client that never opens the app is refused on exactly the
   * days the client that settles nightly is refused, and the spend equality is a
   * plain equality with nothing conditioning it.
   *
   * PINNED EXACTLY rather than bounded, so making it commoner is a red test and
   * a number somebody has to read, not a threshold that absorbs it.
   */
  PAIRS_IN_THIS_SWEEP: 0,

  /**
   * The same count on the engine BEFORE completion re-validation, kept as
   * history: one pair in 900, at these seeds and these lengths.
   *
   * IT IS NOT RE-DERIVABLE FROM THIS ENGINE, which is why it is written down.
   * The behaviour it counted no longer exists, so the only way to get this
   * number again is to remove the re-validation.
   */
  PAIRS_BEFORE_REVALIDATION: 1,

  /**
   * Probes in the doomed-sale sweep where the raw state and the nightly-settled
   * state DISAGREE about whether the absence holds. It halves with each day the
   * calendar moves later — 1024 at start offset 16, 512 at 17, 256 at 18, 128 at
   * 19, 64 at 20 — and is zero at offset 0 and at either edge of the band, 14 and
   * 22, which is the band being the right band rather than a wide guess.
   *
   * THIS IS THE ANTI-VACUITY GUARD FOR THE ZERO ABOVE, and it is the number that
   * matters most in this constant. "Unsettled and settled clients complete
   * identically" is satisfied perfectly by a domain in which they never differ —
   * which is precisely the domain the sweep had before
   * `DOOMED_SALE_SWEEP.CALENDAR_START_OFFSETS` was added, and precisely why the
   * defect was invisible to 98,304 store decisions. Re-validation does NOT make
   * this number fall: the two states still disagree about the absence, and the
   * store now refuses to act on the difference.
   */
  STALE_VERDICTS_IN_THE_DOOMED_SALE_SWEEP: 1984,
});

/** One calendar: `true` on the days the lifter trained. */
export type TrainingSchedule = readonly boolean[];

/**
 * The days a lifter on `schedule` can afford an Extra Covered Day, under
 * `COVERED_DAY_PURCHASE_SWEEP`'s purse. Buys as soon as affordable, which is
 * the behaviour the hazard needs and the one a real player has.
 *
 * IT TAKES A `TenderArrival` RATHER THAN A BOOLEAN, and that is not cosmetic.
 * The boolean it replaces was `trainingKeyed`, which made "which tenders are
 * training-keyed" a fact the CALLER decided — so the sweep and
 * `currencyProvenance.ts` were two places that had to agree about a season-pass
 * tier, and two places that agree are one rule only until somebody edits one of
 * them. Now the sweep reads `TENDER_ARRIVAL` like everything else does, so a
 * tender re-tagged in that table changes which arm it is measured on
 * automatically. `purchaseArrivalOf` is the bridge.
 *
 * THE THREE ARRIVALS, AND WHY TWO OF THEM COINCIDE HERE:
 *
 *   - `'calendar'` — Chalk trickles once per `CHALK_PER_CALENDAR_DAYS`. Pure
 *     function of the calendar length: identical for every schedule of that
 *     length, so both members of a monotonicity pair buy on the same days BY
 *     CONSTRUCTION rather than by assumption.
 *   - `'player-chosen'` — real money, a rewarded ad, buying Chalk. Modelled by
 *     the SAME calendar trickle, and that is a deliberate identity rather than
 *     laziness: what the sweep measures is whether a lifter's own training can
 *     MOVE the day they buy, and for a player-chosen arrival it cannot, by
 *     definition. Its row in the table is expected to be bit-identical to the
 *     calendar row, and `streakSweep.test.ts` asserts that instead of assuming
 *     it — an accidental difference would mean one of them had grown a
 *     dependence on the schedule.
 *   - `'session-count'` — the calendar trickle PLUS one per
 *     `CHALK_PER_SESSIONS` sessions ever. The hazard: training moves the
 *     affordability day. The purse is deliberately larger than the calendar
 *     arm's, which is why the matched control is the `frozen` treatment and not
 *     the calendar arm — see `COVERED_DAY_PURCHASE_SWEEP`.
 *
 * DETERMINISTIC AND PURE. Same schedule, same arrival, same days, every time.
 *
 * @throws {RangeError} if the schedule is empty.
 */
export function coveredDayPurchaseDays(
  schedule: TrainingSchedule,
  arrival: TenderArrival,
): readonly number[] {
  if (schedule.length < 1) {
    throw new RangeError('streakSweep: a purchase schedule needs a calendar of at least 1 day');
  }
  const purse = COVERED_DAY_PURCHASE_SWEEP;
  const trainingKeyed = arrival === 'session-count';
  const days: number[] = [];
  let chalk = 0;
  let sessions = 0;
  for (let day = 0; day < schedule.length; day += 1) {
    if (day > 0 && day % purse.CHALK_PER_CALENDAR_DAYS === 0) chalk += 1;
    if (schedule[day] === true) {
      sessions += 1;
      if (trainingKeyed && sessions % purse.CHALK_PER_SESSIONS === 0) chalk += 1;
    }
    while (chalk >= purse.PRICE_IN_CHALK) {
      chalk -= purse.PRICE_IN_CHALK;
      days.push(day);
    }
  }
  return days;
}

/**
 * The arrival a tender funds through — `TENDER_ARRIVAL`, re-exported as a
 * function so a sweep never restates the table.
 *
 * IT ACCEPTS TRAINING-GATED TENDERS ON PURPOSE, which is the one place in the
 * codebase that does. `applySettledCoveredDayPurchase` will not take one, and
 * that is exactly why the hazard has to be measurable here: a negative control
 * that cannot be constructed is a negative control nobody can check, and the
 * whole argument for the restriction is the number this arm produces.
 */
export function purchaseArrivalOf(tender: CoveredDayTender): TenderArrival {
  return TENDER_ARRIVAL[tender];
}

/**
 * The `mask`-th calendar of `length` days: bit *i* set means "trained on day
 * *i*". Enumerating `mask` from 0 to 2^length - 1 is every calendar of that
 * length, each exactly once.
 *
 * @throws {RangeError} if the length is not a positive whole number, or the
 * mask is not a whole number inside it.
 */
export function exhaustiveCalendar(mask: number, length: number): TrainingSchedule {
  if (!Number.isSafeInteger(length) || length < 1) {
    throw new RangeError(`streakSweep: a calendar length must be a whole number of at least 1, received ${length}`);
  }
  if (!Number.isSafeInteger(mask) || mask < 0 || mask >= 2 ** length) {
    throw new RangeError(`streakSweep: mask ${mask} is not a calendar of ${length} days`);
  }
  return Array.from({ length }, (_, day) => (mask & (1 << day)) !== 0);
}

/** How many calendars `exhaustiveCalendar` enumerates at a length. */
export function exhaustiveCalendarCount(length: number): number {
  if (!Number.isSafeInteger(length) || length < 1) {
    throw new RangeError(`streakSweep: a calendar length must be a whole number of at least 1, received ${length}`);
  }
  return 2 ** length;
}

/**
 * The sampled schedules for one seed: `MONOTONICITY_SWEEP.SCHEDULES_PER_SEED`
 * calendars of `length` days, drawn as the header describes — one attendance
 * rate per schedule, then a Bernoulli draw per day.
 *
 * DETERMINISTIC. The same seed and length always return the same schedules, in
 * the same order, on any machine. `streakSweep.test.ts` checks that rather than
 * trusting it.
 *
 * @throws {RangeError} if the length is not a positive whole number.
 */
export function seededSchedules(seed: number, length: number): readonly TrainingSchedule[] {
  if (!Number.isSafeInteger(length) || length < 1) {
    throw new RangeError(`streakSweep: a calendar length must be a whole number of at least 1, received ${length}`);
  }
  const schedules: TrainingSchedule[] = [];
  let state = seedState(seed);
  for (let index = 0; index < MONOTONICITY_SWEEP.SCHEDULES_PER_SEED; index += 1) {
    const rate = nextRandom(state);
    state = rate.state;
    const attendance =
      MONOTONICITY_SWEEP.MIN_ATTENDANCE + rate.value * MONOTONICITY_SWEEP.ATTENDANCE_SPREAD;
    const days: boolean[] = [];
    for (let day = 0; day < length; day += 1) {
      const draw = nextRandom(state);
      state = draw.state;
      days.push(draw.value < attendance);
    }
    schedules.push(days);
  }
  return schedules;
}

/**
 * Schedules drawn at ONE FIXED attendance rate, rather than at a rate drawn per
 * schedule.
 *
 * `seededSchedules` deliberately varies the rate so that one sweep contains a
 * population of different lifters. That is the right default and it is why the
 * rate range is written down — but it means the sweep contains almost no
 * near-perfect attenders and nobody below 0.2. This aims a population where it
 * is wanted, which is what `ENTITLEMENT_VERIFICATION.FIXED_ATTENDANCE_RATES`
 * exists to do.
 *
 * @throws {RangeError} if the length or count is not a positive whole number,
 * or the rate is outside [0, 1].
 */
export function fixedRateSchedules(
  seed: number,
  length: number,
  rate: number,
  count: number,
): readonly TrainingSchedule[] {
  if (!Number.isSafeInteger(length) || length < 1) {
    throw new RangeError(`streakSweep: a calendar length must be a whole number of at least 1, received ${length}`);
  }
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RangeError(`streakSweep: a schedule count must be a whole number of at least 1, received ${count}`);
  }
  if (!(rate >= 0 && rate <= 1)) {
    throw new RangeError(`streakSweep: an attendance rate must be within [0, 1], received ${rate}`);
  }
  const schedules: TrainingSchedule[] = [];
  let state = seedState(seed);
  for (let index = 0; index < count; index += 1) {
    const days: boolean[] = [];
    for (let day = 0; day < length; day += 1) {
      const draw = nextRandom(state);
      state = draw.state;
      days.push(draw.value < rate);
    }
    schedules.push(days);
  }
  return schedules;
}

/**
 * Every SINGLE-DAY SUPERSET of a schedule: the same calendar with exactly one
 * idle day turned into a trained one, once per idle day.
 *
 * This is the comparator the whole property is defined against. A schedule with
 * no idle day has none, and contributes no comparison.
 */
export function singleDaySupersets(schedule: TrainingSchedule): readonly TrainingSchedule[] {
  const out: TrainingSchedule[] = [];
  for (let day = 0; day < schedule.length; day += 1) {
    if (schedule[day] === true) continue;
    out.push(schedule.map((trained, i) => (i === day ? true : trained)));
  }
  return out;
}

/** `T` trained, `.` idle — so a failing calendar names itself in the error. */
export function renderSchedule(schedule: TrainingSchedule): string {
  return schedule.map((trained) => (trained ? 'T' : '.')).join('');
}

/** Days trained in a schedule. */
export function trainedDayCount(schedule: TrainingSchedule): number {
  return schedule.filter((trained) => trained).length;
}
