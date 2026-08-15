/**
 * careerSweep.ts — the inputs the career eligibility measurement runs on, and
 * the two controls it is measured against.
 *
 * Pure: zero React, zero side effects, zero I/O, no clock, no `Math.random`.
 * Every sequence below is a pure function of a seed written down here.
 *
 * ===========================================================================
 * WHY A MODULE AND NOT A HELPER IN THE TEST
 * ===========================================================================
 * The same reason `src/game/streakSweep.ts` exists, and that file says it at
 * length: a measurement whose inputs are not written down is an anecdote. The
 * streak measurement was first published with its seeds unstated and could not
 * afterwards be reproduced by anyone, including its author. So the grid, the
 * seeds, the distribution and the window live here as named constants, and
 * `eligibility.test.ts` measures through them.
 *
 * Registered in `src/tuning/audit.ts` as `data`, not `feel`, and deliberately
 * absent from `src/tuning/index.ts`: turning a seed does not change the game,
 * only which careers the property is checked on. A playtester has no business
 * in this file.
 *
 * ===========================================================================
 * THE PROPERTY, AND THE TWO AXES IT IS MEASURED ON
 * ===========================================================================
 * GDD §12.3 refuses "an injury or setback that punishes a player for showing up
 * daily", and CLAUDE.md turns that into a comparison between two lifters
 * identical except that one did more. For a career calendar the two readings of
 * "more" are different questions and both are measured:
 *
 *   AXIS A — STRENGTH. Two lifters whose best Total differs. The stronger one
 *   must qualify for a superset of the meets, never a smaller set. Exhaustive
 *   over a grid, so it is a proof over the grid rather than a sample.
 *
 *   AXIS B — ATTENDANCE, THROUGH QUALIFICATION. Two careers identical except
 *   that one lifter competed at one extra meet. The lifter who competed more
 *   must qualify for a superset at the same later day. Sampled from seeds,
 *   because the space of careers is not enumerable.
 *
 *   AXIS C — ATTENDANCE, THROUGH ENTRY. The same two careers, asked what they
 *   may enter rather than what they qualify for. Entering a dated meet spends
 *   it, so the lifter who competed more does hold a shorter list — and the
 *   property is that the difference is exactly the meets they went to and
 *   nothing else. See the block on `ENTRY_VARIANTS` for why this axis needs its
 *   own evaluation lag, and `eligibility.test.ts` for the counts.
 *
 * WHY B AND C ARE TWO AXES AND NOT ONE, since they run on the same fixture:
 * they read different functions. `qualifiedMeets` filters on the federation and
 * the Total, and never looks at `enteredMeetIds`; `enterableMeets` filters
 * through `entryVerdict`, which does. A break in either one leaves the other
 * green, which `eligibility.test.ts` measures rather than asserts.
 *
 * A ZERO WITH NO CONTROL BESIDE IT IS A ZERO ABOUT NOTHING, so each axis ships
 * with a rule that breaks it, and the test pins the control's non-zero count
 * next to the shipped zero. Every control is a design somebody could plausibly
 * have written, which is what makes them worth keeping:
 *
 *   - `highest-tier-band` — a lifter may only enter the top tier they qualify
 *     for, which is a real anti-sandbagging idea and which makes getting
 *     stronger take meets away.
 *   - `latest-total-wins` — qualification reads the last total instead of the
 *     best, which is how a "current form" system would naturally be written and
 *     which makes a bad meet day cost a lifter meets they had already earned.
 *   - `entry-cooldown` — a mandatory rest after a meet, which is the most
 *     plausible of them because real federations do impose one, and which
 *     charges the lifter who competed more with a lockout the lifter who stayed
 *     home does not pay.
 *   - `worlds-cooldown-*` — that same rest charged after the annual
 *     championship and after nothing else. Three of them, pointed at the
 *     calendar's first, second and third worlds meets, because which of those
 *     three a simulated career can be standing on is the whole question this
 *     round was about.
 *   - `worlds-reset-*` — the annual result taken as the lifter's ranking total
 *     instead of their best. Three again, and all three measure zero on this
 *     population by 27.5 kg: see the block above `ENTRY_VARIANTS`. That margin
 *     is arithmetic about these 24 seeded careers rather than a property of the
 *     calendar, so it is measured and pinned rather than argued for.
 */

import { nextRandom, seedState } from '../game/prng';
import { addDays, type StreakDay } from '../game/streak';
import { CAREER_TUNING, type CareerFederationId, type CareerMeetTier } from './careerTuning';
import { entryTier, tierIndex, tiersLowestFirst } from './federation';
import {
  careerMeetFor,
  qualifyingTotalKgFor,
  scheduledMeets,
  seasonAnchorDay,
  tierSeriesStartDay,
  type CareerMeet,
} from './calendar';
import {
  canEnter,
  careerRecordAfterMeet,
  enterableMeets,
  meetsQualifyingTotal,
  newCareerLifter,
  qualifiesFor,
  type CareerLifter,
} from './eligibility';

// ---------------------------------------------------------------------------
// Axis A — strength
// ---------------------------------------------------------------------------

/**
 * The grid of best Totals the strength axis is swept over, and the calendar
 * window the comparison is made in.
 *
 * `null` — a lifter who has never competed — is the bottom of the grid and is
 * included as a value rather than tested separately: it is the state every
 * career starts in and the one place a `>=` comparison has nothing to compare.
 *
 * The step is 2.5 kg because that is the smallest weight a competition bar can
 * move by (`MIN_ATTEMPT_INCREMENT_KG` in `src/game/meet.ts`), so it is the
 * finest grid a real total can land on. The ceiling is comfortably past the
 * heaviest total the sport has seen, so the grid covers every qualifying total
 * this game could reasonably ship and a long way either side.
 */
export const STRENGTH_SWEEP = Object.freeze({
  MIN_TOTAL_KG: 0,
  MAX_TOTAL_KG: 1000,
  STEP_KG: 2.5,
  /** Days after the season anchor the comparison window opens. */
  WINDOW_START_OFFSET_DAYS: 0,
  /** How long that window is. A year, so every tier occurs in it. */
  WINDOW_DAYS: 364,
  /** Whose calendar. Any federation gives the same shape; one is swept. */
  FEDERATION: 'meridian' as CareerFederationId,
});

/**
 * Every best Total on the grid, lowest first, with `null` at the bottom.
 *
 * Ordered so that index order is total order: `i < j` implies the value at `i`
 * is a smaller total than the value at `j`, with `null` — no total at all —
 * below every number.
 */
export function strengthGrid(): readonly (number | null)[] {
  const totals: (number | null)[] = [null];
  const steps = Math.round(
    (STRENGTH_SWEEP.MAX_TOTAL_KG - STRENGTH_SWEEP.MIN_TOTAL_KG) / STRENGTH_SWEEP.STEP_KG,
  );
  for (let index = 0; index <= steps; index += 1) {
    totals.push(STRENGTH_SWEEP.MIN_TOTAL_KG + index * STRENGTH_SWEEP.STEP_KG);
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Axis B — attendance
// ---------------------------------------------------------------------------

/**
 * The careers the attendance axes are sampled from.
 *
 * A career here is a list of meet totals, one per meet the lifter attends, in
 * calendar order. The comparison is a career against the same career with one
 * meet removed, which is the single-superset shape `streakSweep.ts` uses for
 * training days: everything else about the two lifters is identical.
 *
 * The deltas are deliberately two-sided. A distribution that only ever went up
 * would make the latest-total control produce zero violations and the whole
 * comparison would report a clean bill for a rule that is broken — an empty
 * domain reproduced in the one place it would not be noticed. `BAD_DAY_SHARE`
 * is what keeps it non-empty, and the test pins how many bad days the sweep
 * actually produced rather than trusting this comment.
 *
 * ===========================================================================
 * HOW DEEP A CAREER THIS RUNS ON, AND WHERE THAT DEPTH CAME FROM
 * ===========================================================================
 * The first version of this block held the simulation at 14 meets, by giving
 * the lifter a self-imposed 28-day rest between meets. That rest was invented
 * here and it was the load-bearing parameter in the whole measurement: a
 * current-form rule that switched on after a lifter's 16th meet was invisible,
 * because no lifter in the sweep ever had a 16th meet. That rule is now a
 * control rather than a sentence — `delayed-form-inside` and
 * `delayed-form-past-the-edge` below — and `eligibility.test.ts` runs it on
 * both sides of the depth this file reaches.
 *
 * The second version fixed that and left the same hole one axis over. It ran
 * for one calendar period, and the single worlds meet a period holds falls six
 * days after the anchor with three meet days in front of it — so the most a
 * lifter could be holding when it came round was 380 + 3 x 70 = 590 kg against
 * a 650 kg bar. Every career in the sweep was 77 to 82 meets deep and none of
 * them entered a worlds meet, so a rule keyed to the top tier was as invisible
 * as the 16th-meet rule had been. That hole is now three controls —
 * `worlds-reset-first`, `worlds-reset-second` and `worlds-reset-third` — and
 * closing it cost a longer simulation rather than a denser one.
 *
 * So the four numbers that decide the depth are read off the shipped calendar
 * instead of chosen here, and `eligibility.test.ts` asserts each of them
 * against `CAREER_TUNING` and `scheduledMeets` rather than against this
 * comment:
 *
 *   - `MIN_DAYS_BETWEEN_MEETS` is 1, the calendar's own resolution, which is to
 *     say this file imposes no rest at all. What limits attendance is then the
 *     schedule and the qualifying totals, both of which are the game's.
 *   - `CALENDAR_PERIOD_DAYS` is 364. For the shipped cadences — 7, 14, 91 and
 *     364 days — that is the exact period of the calendar: every cadence
 *     divides it, so the pattern of meet days repeats from there. It is also
 *     `CAREER_TUNING.HORIZON_DAYS`, the span a calendar screen draws.
 *   - `CALENDAR_PERIODS` is 2, and it is the number this round moved. One
 *     period is the shortest simulation that shows a whole calendar; two is the
 *     shortest that shows a REACHABLE worlds meet, because the first occurrence
 *     of an annual series is six days after the anchor and the second is 370.
 *     `SIMULATION_DAYS` is their product, 728 days.
 *   - `MEETS_PER_CAREER` is 171, the number of meets two periods hold, which is
 *     the ceiling on a career the simulation can produce: one meet a day at
 *     most, and every meet distinct.
 *
 * WHAT DEPTH STILL DOES NOT REACH, stated because a widened domain invites the
 * assumption that it is now complete, and pinned as controls rather than as
 * this sentence. There are four edges and they are not all at the far end:
 *
 *   - A rule keyed to a lifter's 170th meet. The deepest career here is 169.
 *     `delayed-form-past-the-edge` is that edge as a measured zero, and the
 *     count of careers deep enough to reach it is pinned at 0 beside it.
 *   - A rule keyed to a lifter's 105th meet. Careers do reach it — all 24 of
 *     them — and the qualification axis reports nothing anyway.
 *     `delayed-form-past-visible` is that, with the count of careers that DO
 *     reach it pinned at 24, so "invisible" and "unreachable" are told apart.
 *   - A rule keyed to the THIRD occurrence of the annual series, on day 734.
 *     Two periods hold two of them, at days 6 and 370.
 *     `worlds-cooldown-third` is that edge as a measured zero.
 *   - A rule keyed to the FIRST occurrence, on day 6. That one is inside the
 *     calendar and outside every career, because no lifter can hold 650 kg six
 *     days in. `worlds-cooldown-first` is that as a measured zero too, and it
 *     is the sharper half of the pair: an edge can sit in the middle of a
 *     domain as well as at its end, and a reader counting worlds meets on the
 *     calendar would have assumed both were reachable.
 *
 * AND ONE BLIND SPOT THAT IS NOT AN EDGE AT ALL, which is what this round
 * turned up rather than what it went looking for. The qualification axis does
 * not see the worlds-keyed record rule anywhere in this fixture, and the reason
 * is a margin of 27.5 kg: the lowest total anybody here puts up at a competitive
 * worlds meet is 677.5, against a top qualifying total of 650, so a rule that rewrites
 * their record with it leaves them clearing every bar on the ladder. That is
 * why the tier-keyed controls that report a non-zero are on the entry axis, and
 * why the three `worlds-reset-*` record controls ship reporting zero with their
 * reason measured beside them.
 *
 * A reader should hold that at the size it is. It is a fact about these 24
 * seeded careers and the shipped qualifying totals, not a theorem: a seed whose
 * worlds day fell 8 kg lower would move it, and nothing here would have to
 * change for that to happen. What the pin buys is that the margin is a number
 * in a test rather than an assumption nobody wrote down.
 *
 * A finite domain has an edge wherever it is drawn; what changed is where, and
 * that every edge is now a number a test pins rather than a sentence.
 */
export const ATTENDANCE_SWEEP = Object.freeze({
  SEEDS: Object.freeze([
    20260812, 913377, 4242, 60103, 771, 1, 99991, 314159, 2718281, 17, 555555, 8675309,
    31, 4096, 123456789, 7, 202601, 88, 65537, 1048576, 999, 24601, 5150, 42424242,
  ]),
  /**
   * How many totals are drawn per career, and the deepest career the simulation
   * can produce. Read off the calendar: 105 local, 52 regional, 8 nationals,
   * 4 campaign summits and 2 competitive ones across the two periods the
   * simulation runs for.
   */
  MEETS_PER_CAREER: 171,
  /** The first meet's total, in kg. Below the regional bar, so it can climb through it. */
  FIRST_TOTAL_KG: 380,
  /** A good day adds up to this much. */
  MAX_GAIN_KG: 70,
  /** A bad day takes off up to this much. */
  MAX_LOSS_KG: 70,
  /** How often a meet is a bad day. */
  BAD_DAY_SHARE: 0.35,
  /** Totals land on the competition grid. */
  ROUNDING_KG: 2.5,
  /**
   * The period of the shipped calendar, in days.
   *
   * Every cadence divides it — 364 = 52 x 7 = 26 x 14 = 4 x 91 = 1 x 364 — so
   * the pattern of meet days repeats from here, and it is the span
   * `CAREER_TUNING.HORIZON_DAYS` draws. `eligibility.test.ts` asserts both
   * rather than trusting this sentence.
   */
  CALENDAR_PERIOD_DAYS: 364,
  /**
   * How many of those periods a simulated career runs for.
   *
   * Two, and the reason is the annual tier. A worlds meet asks for 650 kg; the
   * first one a period holds falls on day 6 with three meet days in front of
   * it, so the most a lifter can be holding is
   * `FIRST_TOTAL_KG + 3 x MAX_GAIN_KG` = 590. The second falls on day 370, by
   * which point a lifter who has entered everything they qualify for is well
   * past the bar. One period is a simulation with an empty worlds column; two
   * is the shortest one without.
   *
   * Nothing about the calendar resets at the boundary and this is worth being
   * explicit about, because a day anchor has cost this repository two waves.
   * There is one anchor, `CAREER_TUNING.SEASON_ANCHOR`, and each tier's series
   * is an arithmetic progression running forward from it. A "period" is a
   * description of how that progression repeats, not a thing the calendar is
   * re-anchored to, so day 364 is an ordinary day that happens to be a local
   * meet day and day 370 is an ordinary day that happens to be a worlds one.
   * `calendar.test.ts` holds the ten-year weekday check that says so.
   */
  CALENDAR_PERIODS: 2,
  /** How long the simulated career runs, from the season anchor. Their product. */
  SIMULATION_DAYS: 728,
  /**
   * The fewest days the simulated lifter leaves between two meets.
   *
   * One day, which is the finest the calendar can be read at, so the harness
   * adds no rest of its own. See the header for the 28 this replaces and for
   * what that 28 was hiding. The number itself did not go away: it is
   * `ENTRY_COOLDOWN_DAYS` below, where a self-imposed rest belongs — as the
   * control that shows axis C can see a lockout, rather than as the thing
   * deciding how much of the game the sweep looks at.
   */
  MIN_DAYS_BETWEEN_MEETS: 1,
  /** How long after the last meet both lifters are compared, on axis B. */
  EVALUATION_LAG_DAYS: 7,
  /**
   * The same lag for axis C, and it has to be zero.
   *
   * Axis C's subject is the entry gate, and the one meet the two lifters differ
   * on is the meet at the moment they differ. At any positive lag that meet is
   * already behind the window — `entryVerdict` refuses it to both of them as
   * `MEET_HAS_PASSED` — so `enteredMeetIds` decides nothing and the axis
   * measures the same thing axis B does. Measured rather than argued: at the
   * shipped lag of 7 the number of pairs whose enterable lists differ at all
   * because of an entry is 0, and at 0 it is the whole depth of the sweep.
   * `eligibility.test.ts` pins both.
   */
  ENTRY_EVALUATION_LAG_DAYS: 0,
  /**
   * How long the `entry-cooldown` control locks a lifter out after a meet.
   *
   * 28 days, which is the rest the first version of this sweep gave every
   * lifter as a fixture parameter. As a control it is doing the job that
   * parameter should never have been doing: standing in for a design that
   * charges a lifter for having competed, so the axis has something non-zero to
   * be zero against.
   */
  ENTRY_COOLDOWN_DAYS: 28,
  /**
   * The two meet counts the delayed current-form control is measured at, and
   * they are the edge of this domain written down as a number.
   *
   * A current-form rule does not have to switch on at a lifter's first meet. A
   * designer who wanted new lifters protected would delay it — "your last total
   * counts once you are established" — and that delay is what made the old
   * 14-meet fixture useless: the same rule, delayed past 15, was invisible.
   *
   * So three points ship rather than two, because deepening the domain proved
   * the old pair had been measuring one edge while a nearer one did the real
   * binding. At one calendar period they were 81 and 82 — the deepest career
   * and one past it — and the first of them measured 81 violating pairs. Moved
   * to 164 and 165 at two periods, THE SAME PAIR MEASURED ZERO AND ZERO: the
   * check went quiet without anybody editing it, which is what a widened domain
   * doing the work of a new rule looks like.
   *
   * IT HAPPENED AGAIN WHEN THE SUMMIT WAS SPLIT, and this is the second
   * instance of the same mechanism rather than a repetition of the first. GDD
   * §6.6's campaign summit adds four meets to a two-period career, which moves
   * every subsequent meet's INDEX by one to four — and the visibility edge is a
   * fact about which index a total lands on. The pair pinned at 100 and 101 was
   * still green and had stopped measuring the thing it names: at the five-tier
   * calendar the last n that bites is 103, so 100 was two zeros' worth of
   * daylight away from the edge it was placed on. NOTHING ABOUT THE RULE
   * CHANGED AND NOTHING ABOUT THE CHECK CHANGED; a tier landed in a different
   * file.
   *
   * Where the rule can bite at all is arithmetic about this population rather
   * than a property of the calendar, so it is measured rather than reasoned
   * about. `latestTotalAfter(n)` differs from the shipped fold at exactly one
   * moment — the lifter's (n+1)-th meet, where the diligent lifter has switched
   * to current form and the one who skipped a meet has not — so it can only
   * show up when the total put up AT that meet sits below a qualifying bar the
   * lifter's own best has already cleared. Deep into a career the totals here
   * have outgrown the top bar of 650 kg and stopped interleaving with any of
   * them. Scanned meet by meet from 90 to 130, the last n that bites is 103.
   *
   * The three points are therefore:
   *
   *   - `DELAYED_FORM_INSIDE` at 103, the deepest meet count at which this axis
   *     can still see the rule. Non-zero.
   *   - `DELAYED_FORM_PAST_VISIBLE` at 104, one meet further. The rule FIRES —
   *     every one of the 24 careers is deeper than 104 meets — and the axis
   *     still reports nothing.
   *   - `DELAYED_FORM_PAST_THE_EDGE` at 169, the deepest career. The rule never
   *     fires at all, because firing needs a 170th meet and nothing here has
   *     one.
   *
   * Two zeros for two different reasons, and the difference is what each one is
   * worth. `eligibility.test.ts` pins how many careers reach each rule's
   * switch-on point, so "invisible" and "unreachable" are told apart by a count
   * rather than by this paragraph.
   */
  DELAYED_FORM_INSIDE: 103,
  DELAYED_FORM_PAST_VISIBLE: 104,
  DELAYED_FORM_PAST_THE_EDGE: 169,
  /**
   * Which occurrence of the annual series each tier-keyed control fires at,
   * counted from the first one the calendar holds.
   *
   * These three are the tier axis of the same edge `DELAYED_FORM_*` draws on
   * the meet-count axis, and they are numbered from zero because that is how
   * `tierOccurrenceOf` counts: occurrence 0 is the worlds meet on day 6,
   * occurrence 1 is the one on day 370, occurrence 2 would be day 734.
   *
   * The middle one is inside the domain. The outer two are its edges, and they
   * are edges for different reasons — the first is inside the calendar and
   * outside every career, the third is outside the simulation altogether.
   * `RECORD_VARIANTS` and `ENTRY_VARIANTS` each carry all three, and the two
   * tables disagree about the middle one: the entry axis reports it and the
   * qualification axis cannot. That disagreement is the measurement worth
   * having, and `eligibility.test.ts` pins both halves of it.
   */
  WORLDS_OCCURRENCE_FIRST: 0,
  WORLDS_OCCURRENCE_SECOND: 1,
  WORLDS_OCCURRENCE_THIRD: 2,
  /**
   * The top qualifying total any tier asks for, mirrored from `careerTuning.ts`
   * as the number the worlds measurements are taken against.
   *
   * Mirrored rather than imported so that a tuner who moves the worlds bar gets
   * a red here — `eligibility.test.ts` asserts the two agree — instead of a
   * measurement that silently follows the bar under a comment that no longer
   * describes it.
   */
  TOP_QUALIFYING_TOTAL_KG: 650,
  /** The window the comparison is made over, from the evaluation day. */
  WINDOW_DAYS: 364,
  FEDERATION: 'meridian' as CareerFederationId,
});

/**
 * One career's meet totals, in calendar order.
 *
 * Deterministic in the seed. The first total is fixed so that every career
 * starts below the regional bar and can climb through it; the walk after that
 * is what makes the sequences differ.
 */
export function seededCareerTotals(seed: number, meets: number): readonly number[] {
  const totals: number[] = [];
  let state = seedState(seed);
  let current: number = ATTENDANCE_SWEEP.FIRST_TOTAL_KG;
  for (let index = 0; index < meets; index += 1) {
    const badDraw = nextRandom(state);
    state = badDraw.state;
    const sizeDraw = nextRandom(state);
    state = sizeDraw.state;
    const isBadDay = badDraw.value < ATTENDANCE_SWEEP.BAD_DAY_SHARE;
    const delta = isBadDay
      ? -sizeDraw.value * ATTENDANCE_SWEEP.MAX_LOSS_KG
      : sizeDraw.value * ATTENDANCE_SWEEP.MAX_GAIN_KG;
    current = Math.max(
      0,
      Math.round((current + delta) / ATTENDANCE_SWEEP.ROUNDING_KG) * ATTENDANCE_SWEEP.ROUNDING_KG,
    );
    totals.push(current);
  }
  return totals;
}

/** How many of a total sequence are lower than the one before. */
export function badDayCount(totals: readonly number[]): number {
  let count = 0;
  for (let index = 1; index < totals.length; index += 1) {
    const previous = totals[index - 1];
    const current = totals[index];
    if (previous !== undefined && current !== undefined && current < previous) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// The controls
// ---------------------------------------------------------------------------

/**
 * Which qualification rule a sweep runs under.
 *
 * `shipped` is `qualifiesFor` itself, imported rather than restated, so a
 * control can never be compared against a copy of the engine that has drifted
 * from the engine.
 */
export type QualificationVariant = 'shipped' | 'highest-tier-band';

/**
 * A control, not a design. Under `highest-tier-band` a lifter qualifies only
 * for the highest tier their total clears — the shape an anti-sandbagging rule
 * takes when somebody writes one — so crossing a qualifying total takes the
 * tiers below it away.
 */
export const QUALIFICATION_VARIANTS: Readonly<
  Record<QualificationVariant, (lifter: CareerLifter, meet: CareerMeet) => boolean>
> = Object.freeze({
  shipped: qualifiesFor,
  'highest-tier-band': (lifter, meet) => {
    if (!qualifiesFor(lifter, meet)) return false;
    return meet.tier === highestQualifiedTier(lifter.bestTotalKg);
  },
});

/** The top tier a total clears, or the entry tier when it clears nothing. */
export function highestQualifiedTier(bestTotalKg: number | null): CareerMeetTier {
  let highest: CareerMeetTier = entryTier();
  for (const tier of tiersLowestFirst()) {
    if (meetsQualifyingTotal(bestTotalKg, qualifyingTotalKgFor(tier))) highest = tier;
  }
  return highest;
}

/** Which rule turns a meet result into a career record. */
export type RecordVariant =
  | 'shipped'
  | 'latest-total-wins'
  | 'delayed-form-inside'
  | 'delayed-form-past-visible'
  | 'delayed-form-past-the-edge'
  | 'worlds-reset-first'
  | 'worlds-reset-second'
  | 'worlds-reset-third';

/**
 * What a record rule is handed about the meet it is folding in.
 *
 * The first three arguments are `careerRecordAfterMeet`'s own, in its own
 * order, so `shipped` below stays that function itself rather than a wrapper
 * around it — a control measured against a copy of the engine is measured
 * against something that can drift from the engine. The two after them are what
 * a tier-keyed or date-keyed control needs and the shipped rule ignores;
 * TypeScript lets a three-parameter function stand in for a five-parameter type,
 * so adding them costs the `shipped` entry nothing.
 */
export type RecordFold = (
  lifter: CareerLifter,
  meetId: string,
  totalKg: number,
  tier: CareerMeetTier,
  day: StreakDay,
) => CareerLifter;

/**
 * Which occurrence of a tier's series a meet day is, counted from zero at the
 * first one the calendar holds.
 *
 * Derived from `CAREER_TUNING` through `calendar.ts` rather than from a table
 * here, so a tuner who moves a phase or a cadence moves this with it. A day
 * that is not one of the tier's meet days gives a non-integer, which is what
 * the `worlds-reset-*` controls test for.
 */
export function tierOccurrenceOf(tier: CareerMeetTier, day: StreakDay): number {
  return (day - tierSeriesStartDay(tier)) / CAREER_TUNING.CADENCE_DAYS[tier];
}

/**
 * A career that remembers the last total instead of the best, once the lifter
 * has `afterMeets` of them on record.
 *
 * `afterMeets` of zero is the plain current-form rule. Anything higher is the
 * same rule with a grace period, which is the shape that walked past this sweep
 * while its careers were 14 meets long.
 */
function latestTotalAfter(afterMeets: number): RecordFold {
  return (lifter, meetId, totalKg) => {
    const entered = lifter.enteredMeetIds.includes(meetId)
      ? lifter.enteredMeetIds
      : [...lifter.enteredMeetIds, meetId];
    if (lifter.enteredMeetIds.length < afterMeets) return careerRecordAfterMeet(lifter, meetId, totalKg);
    return { federationId: lifter.federationId, bestTotalKg: totalKg, enteredMeetIds: entered };
  };
}

/**
 * A career whose record is overwritten by whatever was put up at one nominated
 * occurrence of the worlds series, instead of taking the better of the two.
 *
 * The design somebody would write for this is "your world result is your
 * ranking total", and it is a plausible one: an annual championship is the meet
 * a federation would rank you off. It is also exactly the shape GDD §12.3
 * refuses, and it needs no memory beyond the meet being folded — a lifter who
 * turns up at worlds and has a bad day forgets every total above it, while the
 * lifter who stayed home keeps theirs.
 *
 * `occurrence` counts from zero at the first worlds meet the calendar holds, so
 * the three entries below are the same rule pointed at three different days.
 * The one thing they hold apart is which of those days a simulated lifter can
 * actually be standing on.
 */
function worldsResetAt(occurrence: number): RecordFold {
  return (lifter, meetId, totalKg, tier, day) => {
    if (tier !== 'competitive-worlds' || tierOccurrenceOf('competitive-worlds', day) !== occurrence) {
      return careerRecordAfterMeet(lifter, meetId, totalKg);
    }
    const entered = lifter.enteredMeetIds.includes(meetId)
      ? lifter.enteredMeetIds
      : [...lifter.enteredMeetIds, meetId];
    return { federationId: lifter.federationId, bestTotalKg: totalKg, enteredMeetIds: entered };
  };
}

/**
 * The second control, its two delayed forms, and the three tier-keyed ones.
 * Under `latest-total-wins` the career remembers the last total instead of the
 * best, which is how a "current form" gate reads, and a bad meet day then costs
 * a lifter meets they had already qualified for.
 *
 * The two delayed entries are the same rule switched on part way through a
 * career, at the meet counts `ATTENDANCE_SWEEP` names. They are what turns the
 * edge of this domain into a pinned number rather than a sentence somebody
 * measured once: one is inside the deepest career the sweep produces and the
 * other is one meet past it.
 *
 * The three `worlds-reset-*` entries do the same job on the tier axis, which is
 * the axis the one-period version of this sweep was blind on. Their zeros and
 * their non-zero sit in `eligibility.test.ts` beside each other, so a reader
 * can see which of the calendar's worlds meets a career here reaches and which
 * two it does not.
 */
export const RECORD_VARIANTS: Readonly<Record<RecordVariant, RecordFold>> = Object.freeze({
  shipped: careerRecordAfterMeet,
  'latest-total-wins': latestTotalAfter(0),
  'delayed-form-inside': latestTotalAfter(ATTENDANCE_SWEEP.DELAYED_FORM_INSIDE),
  'delayed-form-past-visible': latestTotalAfter(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_VISIBLE),
  'delayed-form-past-the-edge': latestTotalAfter(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_THE_EDGE),
  'worlds-reset-first': worldsResetAt(ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_FIRST),
  'worlds-reset-second': worldsResetAt(ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_SECOND),
  'worlds-reset-third': worldsResetAt(ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_THIRD),
});

// ---------------------------------------------------------------------------
// The simulated career the attendance axis compares
// ---------------------------------------------------------------------------

/** One meet in a simulated season: where it sat, which rung it was, and what was put up at it. */
export interface SeasonMeet {
  readonly day: StreakDay;
  readonly meetId: string;
  readonly tier: CareerMeetTier;
  readonly totalKg: number;
}

/**
 * One season on the shipped calendar, as a fixture both arms of the attendance
 * axis are measured against.
 *
 * The schedule is greedy and simple: walk the days from the season anchor, and
 * on each day take the first meet the engine says can be entered, provided
 * `MIN_DAYS_BETWEEN_MEETS` have passed since the last. Entry is decided by
 * `canEnter` itself rather than by a rule restated here, so the fixture cannot
 * drift from the engine it is a fixture for.
 *
 * At the shipped `MIN_DAYS_BETWEEN_MEETS` of 1 this is the most competitive
 * career the game will sell a player: every meet they are eligible for, taken.
 * That is the lifter GDD §12.3's "never punish daily engagement" is about, so
 * it is the one the property is measured on.
 *
 * A season is a pure function of its seed, so both record variants measure
 * against exactly the same one. That is what isolates the axis: two lifters
 * compared on it differ in which meets of one fixed season they attended and in
 * nothing else — not in the dates, not in the totals, not in the calendar.
 */
export function simulateSeason(seed: number): readonly SeasonMeet[] {
  const totals = seededCareerTotals(seed, ATTENDANCE_SWEEP.MEETS_PER_CAREER);
  const anchor = seasonAnchorDay();
  const lastDay = addDays(anchor, ATTENDANCE_SWEEP.SIMULATION_DAYS);
  let lifter: CareerLifter = newCareerLifter(ATTENDANCE_SWEEP.FEDERATION);
  const season: SeasonMeet[] = [];
  let lastMeetDay: number | null = null;
  for (let day = anchor; day <= lastDay; day = addDays(day, 1)) {
    if (lastMeetDay !== null && day - lastMeetDay < ATTENDANCE_SWEEP.MIN_DAYS_BETWEEN_MEETS) continue;
    const meet = scheduledMeets(ATTENDANCE_SWEEP.FEDERATION, day, day).find((candidate) =>
      canEnter(lifter, candidate, day),
    );
    if (meet === undefined) continue;
    const totalKg = totals[season.length];
    if (totalKg === undefined) {
      throw new RangeError(
        `career: a season ran past MEETS_PER_CAREER (${ATTENDANCE_SWEEP.MEETS_PER_CAREER}) meets`,
      );
    }
    lifter = careerRecordAfterMeet(lifter, meet.id, totalKg);
    season.push({ day, meetId: meet.id, tier: meet.tier, totalKg });
    lastMeetDay = day;
  }
  return season;
}

/**
 * The day of the last meet on the record of a lifter who competed at the
 * season's meets up to and including `throughIndex`, skipping `skipIndex`, or
 * `null` if that leaves them with no meets at all.
 *
 * Kept beside the fold rather than derived from a `CareerLifter`, because a
 * `CareerLifter` does not carry a date and must not start carrying one to suit
 * a control: `CAREER_LIFTER_KEYS` is the fence, and widening it to fit a sweep
 * would be the sweep deciding what eligibility may read.
 */
export function lastEnteredDayOf(
  season: readonly SeasonMeet[],
  throughIndex: number,
  skipIndex: number | null,
): StreakDay | null {
  for (let index = Math.min(throughIndex, season.length - 1); index >= 0; index -= 1) {
    if (index === skipIndex) continue;
    const meet = season[index];
    if (meet !== undefined) return meet.day;
  }
  return null;
}

/**
 * Every day of one tier the lifter has on their record, in calendar order.
 *
 * The tier-keyed entry controls need "when did you last go to a worlds meet",
 * which no `CareerLifter` carries and none may start carrying: widening
 * `CAREER_LIFTER_KEYS` to suit a control would be the sweep deciding what
 * eligibility may read. It is derived from the season beside the fold, the way
 * `lastEnteredDayOf` already is.
 */
export function enteredDaysOfTier(
  season: readonly SeasonMeet[],
  throughIndex: number,
  skipIndex: number | null,
  tier: CareerMeetTier,
): readonly StreakDay[] {
  const days: StreakDay[] = [];
  for (let index = 0; index <= Math.min(throughIndex, season.length - 1); index += 1) {
    if (index === skipIndex) continue;
    const meet = season[index];
    if (meet !== undefined && meet.tier === tier) days.push(meet.day);
  }
  return days;
}

/**
 * What a lifter's entry list is asked from: the day, how long ago they last
 * competed, and which worlds meets are on their record.
 *
 * The last two are what the shipped rule does not read and a rest-based design
 * would have to. Handing them to every variant keeps the arms taking one input
 * each rather than several different ones.
 */
export interface EntryContext {
  readonly today: StreakDay;
  readonly lastEnteredDay: StreakDay | null;
  readonly worldsDaysEntered: readonly StreakDay[];
}

/** Which entry rule a sweep runs under. */
export type EntryVariant =
  | 'shipped'
  | 'entry-cooldown'
  | 'worlds-cooldown-first'
  | 'worlds-cooldown-second'
  | 'worlds-cooldown-third';

/**
 * An entry rule, as a filter of the list the engine itself produced.
 *
 * EVERY CONTROL HERE IS A LOCKOUT, so every one of them is expressible as a
 * filter and `shipped` is the identity. That shape is deliberate and it is what
 * makes the arms comparable: they run on one `enterableMeets` call per lifter
 * per moment rather than one each, which is what lets five arms cost roughly
 * what one used to. A control that ADDED a meet would need a different shape,
 * and there is not one — a design that hands a lifter a meet they are not
 * eligible for is not a §12.3 hazard.
 */
export type EntryFilter = (
  base: readonly CareerMeet[],
  context: EntryContext,
) => readonly CareerMeet[];

/** A lockout of `days` running from `from`, applied to the engine's own list. */
function lockedOutUntil(
  base: readonly CareerMeet[],
  from: StreakDay | null,
  days: number,
): readonly CareerMeet[] {
  if (from === null) return base;
  const clearOn = addDays(from, days);
  return base.filter((meet) => meet.day > clearOn);
}

/**
 * The entry-side controls.
 *
 * Under `entry-cooldown` a lifter may not enter anything for
 * `ENTRY_COOLDOWN_DAYS` after any meet. It is the most plausible of the
 * controls this module measures against — real federations impose rest, and a
 * game would call it recovery — and it is exactly the shape GDD §12.3 refuses:
 * the lifter who competed at one more meet starts their lockout later, so the
 * calendar in front of them is shorter than the calendar in front of the lifter
 * who stayed home.
 *
 * The three `worlds-cooldown-*` entries are the same rest charged after one
 * nominated occurrence of the annual series and after nothing else, which is
 * the more likely design of the two: a fortnight off after a world championship
 * reads as respect for the athlete rather than as a tax. It is the same tax.
 *
 * WHY THE TIER-KEYED CONTROLS LIVE ON THIS AXIS AND NOT ON THE RECORD AXIS.
 * Measured, not chosen. A worlds-keyed RECORD rule is invisible to the
 * qualification axis at any depth this fixture reaches: `bestTotalKg` is
 * non-decreasing under the shipped fold, the top qualifying total is 650 kg,
 * and the lowest total anybody in this sweep puts up AT a worlds meet is
 * 677.5 kg — so a rule that rewrites their record with it still leaves them
 * clearing every bar on the ladder. `worlds-reset-second` is that fact as a
 * measured zero, with the 677.5 and the 650 pinned beside it and the count of
 * careers whose record the rule really does rewrite pinned at 16. The
 * enterable list has no such ceiling, which is why the tier-keyed lockouts are
 * here.
 */
export const ENTRY_VARIANTS: Readonly<Record<EntryVariant, EntryFilter>> = Object.freeze({
  shipped: (base) => base,
  'entry-cooldown': (base, context) =>
    lockedOutUntil(base, context.lastEnteredDay, ATTENDANCE_SWEEP.ENTRY_COOLDOWN_DAYS),
  'worlds-cooldown-first': (base, context) =>
    lockedOutUntil(
      base,
      worldsDayAtOccurrence(context, ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_FIRST),
      ATTENDANCE_SWEEP.ENTRY_COOLDOWN_DAYS,
    ),
  'worlds-cooldown-second': (base, context) =>
    lockedOutUntil(
      base,
      worldsDayAtOccurrence(context, ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_SECOND),
      ATTENDANCE_SWEEP.ENTRY_COOLDOWN_DAYS,
    ),
  'worlds-cooldown-third': (base, context) =>
    lockedOutUntil(
      base,
      worldsDayAtOccurrence(context, ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_THIRD),
      ATTENDANCE_SWEEP.ENTRY_COOLDOWN_DAYS,
    ),
});

/** The day of the nominated worlds occurrence on this lifter's record, if they went. */
function worldsDayAtOccurrence(context: EntryContext, occurrence: number): StreakDay | null {
  return (
    context.worldsDaysEntered.find((day) => tierOccurrenceOf('competitive-worlds', day) === occurrence) ?? null
  );
}

/** The list the engine gives, which every entry arm filters. */
export function shippedEntryList(
  lifter: CareerLifter,
  context: EntryContext,
): readonly CareerMeet[] {
  return enterableMeets(lifter, context.today, ATTENDANCE_SWEEP.WINDOW_DAYS);
}

/**
 * The career record of a lifter who competed at the season's meets up to and
 * including `throughIndex`, skipping the one at `skipIndex`.
 *
 * `skipIndex` of `null` is the lifter who went to all of them. The pair
 * (`null`, `i`) is two lifters identical in every respect except that one
 * competed at one more meet, which is the comparison GDD §12.3 asks for.
 *
 * Both arms run this one function; `variant` picks the fold under test, and
 * nothing else about the two lifters can differ.
 */
export function careerAfter(
  season: readonly SeasonMeet[],
  throughIndex: number,
  skipIndex: number | null,
  variant: RecordVariant,
): CareerLifter {
  const fold = RECORD_VARIANTS[variant];
  let lifter: CareerLifter = newCareerLifter(ATTENDANCE_SWEEP.FEDERATION);
  for (let index = 0; index <= throughIndex; index += 1) {
    if (index === skipIndex) continue;
    const meet = season[index];
    if (meet === undefined) break;
    lifter = fold(lifter, meet.meetId, meet.totalKg, meet.tier, meet.day);
  }
  return lifter;
}

/** One evaluation moment: the meet that just happened and every career at it. */
export interface SeasonMoment {
  readonly throughIndex: number;
  readonly meet: SeasonMeet;
  /** The lifter who went to every meet up to and including `throughIndex`. */
  readonly diligent: CareerLifter;
  /** `idle[i]` is that same lifter with the meet at index `i` skipped. */
  readonly idle: readonly CareerLifter[];
}

/**
 * Every moment of a season, with the careers the pair loop compares at each,
 * built by advancing the previous moment's careers instead of re-folding each
 * one from the start of the season.
 *
 * SAME VALUES, LESS ARITHMETIC, and the recurrence is exact rather than
 * approximate:
 *
 *   careerAfter(s, t, i)     = fold(careerAfter(s, t - 1, i), s[t])  for i < t
 *   careerAfter(s, t, t)     = careerAfter(s, t - 1, null)
 *   careerAfter(s, t, null)  = fold(careerAfter(s, t - 1, null), s[t])
 *
 * The middle line is the one worth reading twice: a lifter who skipped the meet
 * that has just happened is the same lifter as the one who had been to
 * everything a moment ago.
 *
 * WHY IT EXISTS. `careerAfter` re-folds the whole prefix per pair, so the pair
 * loop costs a cube of the season length; two calendar periods make a season
 * twice as deep as one, which is eight times the arithmetic for four times the
 * pairs. This is the same measurement over the same pairs. `eligibility.test.ts`
 * drives the two against each other over a whole triangle of moments and pins
 * how many it compared, so a divergence is a red rather than a silently faster
 * answer.
 */
export function* seasonMoments(
  season: readonly SeasonMeet[],
  variant: RecordVariant,
): Generator<SeasonMoment> {
  const fold = RECORD_VARIANTS[variant];
  let diligent: CareerLifter = newCareerLifter(ATTENDANCE_SWEEP.FEDERATION);
  const idle: CareerLifter[] = [];
  for (let throughIndex = 0; throughIndex < season.length; throughIndex += 1) {
    const meet = season[throughIndex];
    if (meet === undefined) break;
    for (let skip = 0; skip < throughIndex; skip += 1) {
      idle[skip] = fold(idle[skip] as CareerLifter, meet.meetId, meet.totalKg, meet.tier, meet.day);
    }
    idle[throughIndex] = diligent;
    diligent = fold(diligent, meet.meetId, meet.totalKg, meet.tier, meet.day);
    yield { throughIndex, meet, diligent, idle };
  }
}

/**
 * Everything `qualifiedMeets` is allowed to read about a lifter, as one string.
 *
 * The attendance axis asks the same qualification question of up to 169 lifters
 * at one moment, and most of them differ in a field qualification does not
 * read. Two lifters with the same key here are two lifters that question
 * answers identically, so a memo on this key is the same measurement with the
 * duplicates removed.
 *
 * THE KEY'S COMPLETENESS IS A CHECK, not an assumption: `eligibility.test.ts`
 * drives the whole strength grid with an empty record and with every meet in
 * the window on it, asserts the two agree, and asserts these keys agree too. An
 * `enteredMeetIds` term added to `qualifiesFor` reddens that pair before it can
 * reach this memo.
 */
export function qualificationKey(lifter: CareerLifter): string {
  return `${lifter.federationId}|${lifter.bestTotalKg}`;
}

/** How many meets of one tier a simulated season holds. */
export function seasonMeetsOfTier(
  season: readonly SeasonMeet[],
  tier: CareerMeetTier,
): readonly SeasonMeet[] {
  return season.filter((meet) => meet.tier === tier);
}

// ---------------------------------------------------------------------------
// AXIS D — the campaign summit is reachable
// ---------------------------------------------------------------------------

/**
 * The inputs GDD §6.6's "always reachable" requirement is measured on, and the
 * two calendars that requirement is measured AGAINST.
 *
 * ===========================================================================
 * WHY THIS IS A FOURTH AXIS AND NOT A COUNT INSIDE AXIS B
 * ===========================================================================
 * Axes A, B and C all ask a §12.3 monotonicity question: does doing MORE ever
 * give you LESS. This one asks a reachability question — is there a lifter who
 * can stand on the top rung at all — and the two are different enough that
 * running them through one fixture would make both worse.
 *
 * Concretely: axis B's `simulateSeason` starts every career on the season
 * anchor. That is the right fixture for a monotonicity comparison, where what
 * matters is that both arms share a calendar. It is the WRONG fixture for
 * reachability, because a summit's reachability depends on where the player
 * enters the season relative to it, and a fixture with one signup day cannot
 * see that. A campaign summit late in the season looks perfectly reachable to
 * every anchor-signup career and can still be a year away for somebody who
 * installed the game in month seven.
 *
 * So this axis sweeps SIGNUP DAY as well as seed, and its careers run for a
 * fixed span from their own signup rather than to a fixed absolute day.
 *
 * ===========================================================================
 * THE REQUIREMENT, IN NUMBERS, STATED BEFORE THE KNOBS WERE PICKED
 * ===========================================================================
 * GDD §6.6 makes "always reachable" a REQUIREMENT of the campaign summit
 * — "always — this is the point of it" — and CLAUDE.md has three times refused
 * a small, honestly measured, permanently documented breach of an absolute. So
 * the first clause is not a percentile:
 *
 *   R1 — EVERY simulated arc enters a campaign summit. All
 *        `SEEDS.length x SIGNUP_OFFSET_DAYS.length` of them, no exceptions
 *        carved out, pinned at the full count rather than bounded.
 *
 *   R2 — PACE. A campaign is a year-scale thing, so the summit has to land
 *        inside one: at least `FIRST_YEAR_ARCS_REQUIRED` of those arcs enter
 *        their first campaign summit within `FIRST_YEAR_DAYS` of signing up,
 *        and the median arc does so inside `MEDIAN_DAYS_CEILING`. This clause
 *        IS distributional and that is deliberate — a slower player taking
 *        longer is pacing, not a lockout, and R1 is what makes it not a
 *        lockout.
 *
 *   R2b — NO SIGNUP DAY IS LOCKED OUT. Every signup offset, taken on its own,
 *        gets at least `MIN_FIRST_YEAR_ARCS_PER_OFFSET` of its 24 arcs to a
 *        summit inside the first year. "Always reachable" is a claim about
 *        every player rather than about an average, and an average is exactly
 *        what hides the failure this piece was sent to fix.
 *
 *   R3 — IT IS A SUMMIT. The gate sits strictly above nationals' and strictly
 *        below competitive worlds' (§6.6's Q1 ruling: separate totals, campaign
 *        lower), and no arc enters a campaign summit off fewer than
 *        `MIN_MEETS_BEFORE_A_SUMMIT` meets — a top rung reached in a fortnight
 *        is not a top rung. Both halves are pinned.
 *
 * `eligibility.test.ts` measures all four and pins the counts. R1 and R3's
 * first half are absolutes; R2, R2b and R3's second half are the numbers a
 * playtester will move.
 *
 * R1 IS NOT THE CLAUSE THAT BITES, AND SAYING SO IS THE POINT OF WRITING R2b
 * DOWN SEPARATELY. Measured: the shipped calendar takes 192 of 192 arcs to a
 * summit and the unfixed control takes 191 of 192, so R1 alone separates a
 * calendar §6.6 called a design violation from the one that repairs it by a
 * single arc. What separates them is R2b — the shipped calendar's worst signup
 * day gets 19 of its 24 arcs to a summit inside the first year, and the
 * control's worst signup day gets ZERO. An absolute stated over the whole
 * population turned out to be nearly vacuous; the same absolute stated per
 * signup day is the measurement.
 *
 * AND R2b DOES NOT REACH THE PHASE, which is the same lesson one level down.
 * Both clauses are about whether a summit ARRIVES, and the cadence decides
 * that; the phase decides whether the one a new lifter is first SHOWN is one
 * they could ever enter. `anchorArcsEnteringTheirFirstOfferedSummit` is the
 * clause for that, and nothing above it would have moved when it went to zero.
 *
 * ===========================================================================
 * WHAT THE NUMBERS ARE MEASURED AGAINST — THREE CONTROLS, A FULL 2x2
 * ===========================================================================
 * The fix has two knobs, the campaign summit's cadence and its phase, and a
 * measurement that moved both at once could not say which one mattered. So
 * every corner of the square is runnable rather than described:
 *
 *   - `annual-at-the-competitive-phase` is the calendar as it stood before the
 *     summit was split: annual, six days after the anchor. This is the shape
 *     GDD §6.6 recorded as a design violation, and it is kept here so the
 *     violation has a number rather than a memory.
 *   - `annual-late` is the phase moved and the cadence left annual.
 *   - `semi-annual-at-the-competitive-phase` is the cadence moved and the phase
 *     left where it was.
 *
 * THE FOURTH CORNER WAS ADDED AFTER THE FIRST THREE LET A FALSE CLAIM STAND,
 * and the correction is the more useful half of this block. With only the two
 * one-sided controls the shipped calendar passed and both controls failed,
 * which reads as "both knobs were needed" and is what `PHASE_DAYS` claimed.
 * Both controls had moved the cadence too. Holding it: the CADENCE is the
 * reachability fix — semi-annual at the old phase still takes 192 of 192 arcs
 * to a summit, worst signup day 18 against the shipped 19 — and the PHASE is a
 * legibility fix with its own statistic,
 * `anchorArcsEnteringTheirFirstOfferedSummit`, which is 0 of 24 at the old
 * phase under EITHER cadence and 18 of 24 at the shipped one.
 *
 * Two knobs need four corners, or one edge takes the other's credit.
 *
 * No control changes the qualifying total. Threshold and calendar are the two
 * halves of the same defect and the controls hold the threshold still, so what
 * they measure is the calendar's contribution alone.
 *
 * ONE SIDE EFFECT OF THE FIRST CONTROL, NAMED RATHER THAN LEFT TO BE FOUND.
 * Putting the campaign summit back on the competitive summit's series puts both
 * summits on the SAME DAYS, and a lifter cannot be at two meets at once — the
 * greedy rule takes the first meet the tie-break offers, which is the campaign
 * one. So under that control the competitive tier's entries fall to zero, and
 * `eligibility.test.ts` pins the fall. That is not noise to be apologised for:
 * it is `scheduledMeets`'s same-day tie-break, which `calendar.ts` describes as
 * unreachable at the shipped phases, being reached and behaving as documented.
 */
export const CAMPAIGN_SUMMIT_SWEEP = Object.freeze({
  /**
   * How many days after the season anchor each simulated lifter signs up.
   *
   * Eight offsets stepping by 23 days, which covers one campaign cadence
   * (0..161 of 182) and — because 23 and 7 are coprime — puts the eight signups
   * on eight different weekdays, so no arm of this sweep is accidentally
   * aligned with the weekday a tier's series falls on.
   *
   * WHY THE STEP IS NOT A MULTIPLE OF SEVEN, since every cadence is: a sweep
   * whose signup days all shared a weekday would hold the phase relationship
   * between the lifter and every series FIXED, and the whole point of this
   * dimension is that a summit's reachability depends on that relationship.
   */
  SIGNUP_OFFSET_DAYS: Object.freeze([0, 23, 46, 69, 92, 115, 138, 161]),
  /**
   * How long an arc runs, from its own signup day.
   *
   * Two calendar periods, the same span axis B's careers run for, so the two
   * axes are looking at careers of the same depth. It is four campaign
   * cadences, which is what lets a control that only offers a summit annually
   * still offer two.
   */
  RUN_DAYS: 728,
  /**
   * The draw per arc, and a ceiling rather than a count.
   *
   * An arc starting mid-season can catch one more occurrence of a series than
   * one starting on the anchor, so the deepest arc is not a number this file
   * can state from the calendar the way `MEETS_PER_CAREER` is. It is drawn
   * generously and `eligibility.test.ts` pins the deepest arc actually produced
   * against it, so the slack is a measured number instead of a hope.
   */
  MEETS_PER_ARC: 200,
  /** R2's window: a campaign is a year-scale thing. */
  FIRST_YEAR_DAYS: 364,
  /**
   * R2, first half: how many of the 192 arcs must reach a campaign summit
   * inside that first year.
   *
   * 168, which is seven eighths. Not every arc, because a lifter who signs up a
   * week after a summit is held cannot reach that one however well they play,
   * and demanding otherwise would demand a summit every week.
   *
   * DELIBERATELY BELOW THE MEASUREMENT RATHER THAN EQUAL TO IT. The shipped
   * calendar measures 176, which `eligibility.test.ts` pins exactly beside this
   * bar. A requirement set AT its own measurement reads as a requirement chosen
   * to be met, and carries no margin to lose before it is broken.
   */
  FIRST_YEAR_ARCS_REQUIRED: 168,
  /** R2, second half: the median arc's wait, in days from signup. */
  MEDIAN_DAYS_CEILING: 250,
  /**
   * R2b: the fewest arcs any ONE signup day may get to a summit inside the
   * first year, out of the 24 seeds that share it.
   *
   * Half. The shipped calendar's worst signup day measures 19 of 24 and both
   * controls' worst measure 0 of 24, so this bar sits between two numbers that
   * are not close, which is what a bar wants.
   */
  MIN_FIRST_YEAR_ARCS_PER_OFFSET: 12,
  /**
   * R3, second half: the fewest meets an arc may have behind it when it enters
   * its first campaign summit.
   *
   * Five. A summit a lifter walks into off two meets is a formality with a big
   * name on it.
   *
   * THE MEASURED FLOOR IS 8, AND IT IS A FACT ABOUT THE TOTAL GENERATOR AS MUCH
   * AS ABOUT THE CALENDAR. `seededCareerTotals` is a two-sided random walk that
   * can add up to `MAX_GAIN_KG` — 70 kg — at a single meet, with no ceiling
   * anywhere, so a lucky arc can climb 380 kg to the 600 kg gate in eight
   * meets and about six weeks. No real progression model would allow that, and
   * a reader should hold the 8 as the generator's tail rather than as a
   * statement about how fast the game lets a player climb. It is pinned exactly
   * so that a generator with a plausible ceiling moves it visibly.
   */
  MIN_MEETS_BEFORE_A_SUMMIT: 5,
  FEDERATION: 'meridian' as CareerFederationId,
});

/** Which campaign-summit calendar an arc runs on. */
export type CampaignCalendarVariant =
  | 'shipped'
  | 'annual-at-the-competitive-phase'
  | 'annual-late'
  | 'semi-annual-at-the-competitive-phase';

/** A tier's series as the two numbers that generate it. */
export interface SeriesShape {
  readonly cadenceDays: number;
  readonly phaseDays: number;
}

/**
 * The four calendars the campaign summit is measured on: the shipped one and
 * the three corners of the two-knob square.
 *
 * `shipped` READS `CAREER_TUNING` rather than restating it, so a tuner who
 * moves the campaign cadence or phase moves this arm with it and the
 * measurement re-runs on what actually ships. The controls read the competitive
 * tier's own numbers for the same reason: the unfixed calendar is not a number
 * typed here, it is the annual series the competitive summit still runs on.
 *
 * THE FOURTH ARM EXISTS BECAUSE THE FIRST THREE LET A FALSE CLAIM STAND.
 * `PHASE_DAYS`' block said 177 was "the other half of the reachability fix",
 * and with the shipped arm and two controls that read as though the measurement
 * supported it: the calendar with the old phase fails and the calendar with the
 * new one passes. Both controls moved the CADENCE as well, so neither of them
 * could tell which knob mattered.
 *
 * Held apart, it is the CADENCE. This arm is the shipped cadence at the old
 * phase — a summit every 182 days starting on day six — and it takes 192 of 192
 * arcs to a summit with a worst signup day of 18 against the shipped 19. The
 * phase is very nearly free once the cadence is semi-annual, and the reason is
 * arithmetic rather than luck: a series that comes round twice a year has an
 * occurrence within 182 days of every day there is, wherever it starts.
 *
 * So a square of two knobs needs its fourth corner or one of the two edges gets
 * the other's credit. The phase's own argument survives, smaller and honest,
 * and it is in `PHASE_DAYS`' block: at the old phase the season's first summit
 * falls on day six and NOBODY can enter it, so the calendar shows every new
 * lifter a summit that is furniture. That is a legibility cost with a number
 * behind it, not a reachability one.
 */
export const CAMPAIGN_CALENDAR_VARIANTS: Readonly<Record<CampaignCalendarVariant, SeriesShape>> =
  Object.freeze({
    shipped: Object.freeze({
      cadenceDays: CAREER_TUNING.CADENCE_DAYS['campaign-worlds'],
      phaseDays: CAREER_TUNING.PHASE_DAYS['campaign-worlds'],
    }),
    'annual-at-the-competitive-phase': Object.freeze({
      cadenceDays: CAREER_TUNING.CADENCE_DAYS['competitive-worlds'],
      phaseDays: CAREER_TUNING.PHASE_DAYS['competitive-worlds'],
    }),
    'annual-late': Object.freeze({
      cadenceDays: CAREER_TUNING.CADENCE_DAYS['competitive-worlds'],
      phaseDays: CAREER_TUNING.PHASE_DAYS['campaign-worlds'],
    }),
    'semi-annual-at-the-competitive-phase': Object.freeze({
      cadenceDays: CAREER_TUNING.CADENCE_DAYS['campaign-worlds'],
      phaseDays: CAREER_TUNING.PHASE_DAYS['competitive-worlds'],
    }),
  });

/**
 * Every day in `[fromDay, toDay]` a series of this shape holds a meet on.
 *
 * The same arithmetic `calendar.ts`'s `meetDaysForTier` runs, over a shape
 * given as two numbers instead of read from a tier. It exists because the
 * controls need a calendar the shipped tuning does not hold, and `CAREER_TUNING`
 * is frozen and must stay that way.
 *
 * A SECOND IMPLEMENTATION OF A THING THE ENGINE ALREADY DOES IS A DRIFT
 * HAZARD, so it is checked rather than trusted: `eligibility.test.ts` asserts
 * this function's output for the `shipped` shape is identical to
 * `meetDaysForTier('campaign-worlds', ...)` over the whole simulated span. An
 * edit to either that makes them disagree reddens there.
 */
export function seriesDays(
  shape: SeriesShape,
  fromDay: StreakDay,
  toDay: StreakDay,
): readonly StreakDay[] {
  if (toDay < fromDay) return [];
  const start = addDays(seasonAnchorDay(), shape.phaseDays);
  if (toDay < start) return [];
  const firstIndex = fromDay <= start ? 0 : Math.ceil((fromDay - start) / shape.cadenceDays);
  const days: StreakDay[] = [];
  for (let index = firstIndex; ; index += 1) {
    const day = addDays(start, index * shape.cadenceDays);
    if (day > toDay) break;
    days.push(day);
  }
  return days;
}

/**
 * The federation's whole calendar in `[fromDay, toDay]`, with the campaign
 * summit's series moved to the variant's shape.
 *
 * Every meet is built by `careerMeetFor`, the engine's own constructor, so a
 * relocated summit carries the engine's qualifying total, id and name. The ONLY
 * thing a variant changes is which days the campaign summit falls on — which is
 * what makes these controls a measurement of the calendar position rather than
 * of a second, differently gated tier.
 */
export function variantCalendar(
  variant: CampaignCalendarVariant,
  fromDay: StreakDay,
  toDay: StreakDay,
): readonly CareerMeet[] {
  const shape = CAMPAIGN_CALENDAR_VARIANTS[variant];
  const others = scheduledMeets(CAMPAIGN_SUMMIT_SWEEP.FEDERATION, fromDay, toDay).filter(
    (meet) => meet.tier !== 'campaign-worlds',
  );
  const summits = seriesDays(shape, fromDay, toDay).map((day) =>
    careerMeetFor(CAMPAIGN_SUMMIT_SWEEP.FEDERATION, 'campaign-worlds', day),
  );
  return [...others, ...summits].sort((a, b) =>
    a.day === b.day ? tierIndex(a.tier) - tierIndex(b.tier) : a.day - b.day,
  );
}

/** One simulated campaign arc: who, from when, and what they got to. */
export interface CampaignArc {
  readonly seed: number;
  /** Days after the season anchor this lifter signed up. */
  readonly signupOffsetDays: number;
  readonly meets: readonly SeasonMeet[];
  /** Days from signup to the first campaign summit entered, or `null` if none. */
  readonly daysToFirstSummit: number | null;
  /** How many meets were behind them when they entered it. */
  readonly meetsBeforeFirstSummit: number | null;
  readonly summitsEntered: number;
  /**
   * Did this lifter enter the very first campaign summit their calendar put in
   * front of them?
   *
   * The phase's own measurement, and the one the cadence cannot make for it. A
   * summit offered on the sixth day of a career is furniture: it is on the
   * calendar, it is the top of the ladder, and nobody at any seed can be strong
   * enough for it. `false` here is either that, or a lifter who was genuinely
   * too slow — which is why it is counted at the anchor-signup arms, where the
   * two are told apart by the gate-clearing count beside it.
   */
  readonly enteredFirstOfferedSummit: boolean;
  /** How many of each tier the calendar OFFERED inside this arc's window. */
  readonly offeredPerTier: Readonly<Record<CareerMeetTier, number>>;
  /** How many of each tier the lifter actually entered. */
  readonly enteredPerTier: Readonly<Record<CareerMeetTier, number>>;
}

function emptyTierTally(): Record<CareerMeetTier, number> {
  const tally = {} as Record<CareerMeetTier, number>;
  for (const tier of tiersLowestFirst()) tally[tier] = 0;
  return tally;
}

/**
 * One lifter's campaign, played greedily from their own signup day.
 *
 * The same rule `simulateSeason` uses — walk the days, take the first meet the
 * engine says can be entered — and for the same reason: at
 * `MIN_DAYS_BETWEEN_MEETS` of 1 this is the most competitive career the game
 * will sell, which is what "a solo player who plays the campaign well" means
 * when it has to be a number. Entry is decided by `canEnter` itself, so the
 * fixture cannot drift from the engine.
 *
 * WHAT IT DOES NOT MODEL, said plainly because a reader will assume otherwise:
 * a real player misses meets, and a player who misses meets climbs slower and
 * reaches the summit later than every arc here. This measures the CEILING of
 * campaign pace, not its middle. R1's "every arc reaches a summit" is therefore
 * a statement about the best case, and the honest reading of it is that a
 * calendar failing R1 is certainly unreachable rather than that one passing it
 * is certainly reachable for everybody.
 */
export function simulateCampaignArc(
  seed: number,
  signupOffsetDays: number,
  variant: CampaignCalendarVariant,
): CampaignArc {
  const totals = seededCareerTotals(seed, CAMPAIGN_SUMMIT_SWEEP.MEETS_PER_ARC);
  const signupDay = addDays(seasonAnchorDay(), signupOffsetDays);
  const lastDay = addDays(signupDay, CAMPAIGN_SUMMIT_SWEEP.RUN_DAYS);
  const calendar = variantCalendar(variant, signupDay, lastDay);
  const byDay = new Map<number, CareerMeet[]>();
  const offeredPerTier = emptyTierTally();
  for (const meet of calendar) {
    offeredPerTier[meet.tier] += 1;
    const row = byDay.get(meet.day);
    if (row === undefined) byDay.set(meet.day, [meet]);
    else row.push(meet);
  }

  let lifter: CareerLifter = newCareerLifter(CAMPAIGN_SUMMIT_SWEEP.FEDERATION);
  const meets: SeasonMeet[] = [];
  const enteredPerTier = emptyTierTally();
  let lastMeetDay: number | null = null;
  let daysToFirstSummit: number | null = null;
  let meetsBeforeFirstSummit: number | null = null;
  let summitsEntered = 0;
  for (let day = signupDay; day <= lastDay; day = addDays(day, 1)) {
    if (lastMeetDay !== null && day - lastMeetDay < ATTENDANCE_SWEEP.MIN_DAYS_BETWEEN_MEETS) continue;
    const meet = (byDay.get(day) ?? []).find((candidate) => canEnter(lifter, candidate, day));
    if (meet === undefined) continue;
    const totalKg = totals[meets.length];
    if (totalKg === undefined) {
      throw new RangeError(
        `career: an arc ran past MEETS_PER_ARC (${CAMPAIGN_SUMMIT_SWEEP.MEETS_PER_ARC}) meets`,
      );
    }
    if (meet.tier === 'campaign-worlds') {
      if (daysToFirstSummit === null) {
        daysToFirstSummit = day - signupDay;
        meetsBeforeFirstSummit = meets.length;
      }
      summitsEntered += 1;
    }
    lifter = careerRecordAfterMeet(lifter, meet.id, totalKg);
    meets.push({ day, meetId: meet.id, tier: meet.tier, totalKg });
    enteredPerTier[meet.tier] += 1;
    lastMeetDay = day;
  }
  const firstOfferedSummit = calendar.find((meet) => meet.tier === 'campaign-worlds');
  return {
    seed,
    signupOffsetDays,
    meets,
    daysToFirstSummit,
    meetsBeforeFirstSummit,
    summitsEntered,
    enteredFirstOfferedSummit:
      firstOfferedSummit !== undefined && meets.some((meet) => meet.meetId === firstOfferedSummit.id),
    offeredPerTier: Object.freeze(offeredPerTier),
    enteredPerTier: Object.freeze(enteredPerTier),
  };
}

/** Every (seed, signup day) arc of one variant, in a fixed order. */
export function campaignArcs(variant: CampaignCalendarVariant): readonly CampaignArc[] {
  const arcs: CampaignArc[] = [];
  for (const seed of ATTENDANCE_SWEEP.SEEDS) {
    for (const offset of CAMPAIGN_SUMMIT_SWEEP.SIGNUP_OFFSET_DAYS) {
      arcs.push(simulateCampaignArc(seed, offset, variant));
    }
  }
  return arcs;
}

/** What one variant's arcs add up to. Counts, never bounds. */
export interface CampaignReach {
  readonly arcs: number;
  /** Arcs that entered at least one campaign summit. R1 is this equalling `arcs`. */
  readonly arcsReachingASummit: number;
  /** Arcs that entered one within `FIRST_YEAR_DAYS` of signing up. R2. */
  readonly arcsReachingInsideAYear: number;
  /**
   * The same count cut by signup day, in `SIGNUP_OFFSET_DAYS` order. R2b.
   *
   * This is the row that tells a lockout from a slow average: a calendar can
   * take three quarters of all arcs to a summit inside a year while one signup
   * day gets none of its own there, and only the cut says so.
   */
  readonly firstYearArcsPerOffset: readonly number[];
  /** The smallest entry in the row above. R2b is this clearing its bar. */
  readonly worstOffsetFirstYearArcs: number;
  /** Days from signup to first summit, over the arcs that reached one, sorted. */
  readonly daysToFirstSummit: readonly number[];
  readonly medianDaysToFirstSummit: number | null;
  readonly worstDaysToFirstSummit: number | null;
  /** The fewest meets any arc had behind it at its first summit. R3. */
  readonly fewestMeetsBeforeASummit: number | null;
  readonly summitsEntered: number;
  readonly offeredPerTier: Readonly<Record<CareerMeetTier, number>>;
  readonly enteredPerTier: Readonly<Record<CareerMeetTier, number>>;
  /** The deepest arc, against which `MEETS_PER_ARC`'s slack is measured. */
  readonly deepestArc: number;
  /**
   * How many of the ANCHOR-SIGNUP arcs entered the first campaign summit their
   * calendar offered them. The phase's own statistic — see the field of the
   * same name on `CampaignArc`.
   */
  readonly anchorArcsEnteringTheirFirstOfferedSummit: number;
}

/** Fold one variant's arcs into the counts the requirement is read off. */
export function measureCampaignReach(variant: CampaignCalendarVariant): CampaignReach {
  const arcs = campaignArcs(variant);
  const offeredPerTier = emptyTierTally();
  const enteredPerTier = emptyTierTally();
  const reached: number[] = [];
  let arcsReachingInsideAYear = 0;
  let summitsEntered = 0;
  let fewestMeetsBeforeASummit: number | null = null;
  let deepestArc = 0;
  for (const arc of arcs) {
    for (const tier of tiersLowestFirst()) {
      offeredPerTier[tier] += arc.offeredPerTier[tier];
      enteredPerTier[tier] += arc.enteredPerTier[tier];
    }
    summitsEntered += arc.summitsEntered;
    deepestArc = Math.max(deepestArc, arc.meets.length);
    if (arc.daysToFirstSummit !== null) {
      reached.push(arc.daysToFirstSummit);
      if (arc.daysToFirstSummit <= CAMPAIGN_SUMMIT_SWEEP.FIRST_YEAR_DAYS) arcsReachingInsideAYear += 1;
    }
    if (arc.meetsBeforeFirstSummit !== null) {
      fewestMeetsBeforeASummit =
        fewestMeetsBeforeASummit === null
          ? arc.meetsBeforeFirstSummit
          : Math.min(fewestMeetsBeforeASummit, arc.meetsBeforeFirstSummit);
    }
  }
  const firstYearArcsPerOffset = CAMPAIGN_SUMMIT_SWEEP.SIGNUP_OFFSET_DAYS.map(
    (offset) =>
      arcs.filter(
        (arc) =>
          arc.signupOffsetDays === offset &&
          arc.daysToFirstSummit !== null &&
          arc.daysToFirstSummit <= CAMPAIGN_SUMMIT_SWEEP.FIRST_YEAR_DAYS,
      ).length,
  );
  const sorted = [...reached].sort((a, b) => a - b);
  return {
    arcs: arcs.length,
    arcsReachingASummit: sorted.length,
    arcsReachingInsideAYear,
    firstYearArcsPerOffset: Object.freeze(firstYearArcsPerOffset),
    worstOffsetFirstYearArcs: Math.min(...firstYearArcsPerOffset),
    daysToFirstSummit: sorted,
    medianDaysToFirstSummit: sorted.length === 0 ? null : (sorted[Math.floor(sorted.length / 2)] as number),
    worstDaysToFirstSummit: sorted.length === 0 ? null : (sorted[sorted.length - 1] as number),
    fewestMeetsBeforeASummit,
    summitsEntered,
    offeredPerTier: Object.freeze(offeredPerTier),
    enteredPerTier: Object.freeze(enteredPerTier),
    deepestArc,
    anchorArcsEnteringTheirFirstOfferedSummit: arcs.filter(
      (arc) => arc.signupOffsetDays === 0 && arc.enteredFirstOfferedSummit,
    ).length,
  };
}
