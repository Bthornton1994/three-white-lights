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
 * next to the shipped zero. All three controls are designs somebody could
 * plausibly have written, which is what makes them worth keeping:
 *
 *   - `highest-tier-band` — a lifter may only enter the top tier they qualify
 *     for, which is a real anti-sandbagging idea and which makes getting
 *     stronger take meets away.
 *   - `latest-total-wins` — qualification reads the last total instead of the
 *     best, which is how a "current form" system would naturally be written and
 *     which makes a bad meet day cost a lifter meets they had already earned.
 *   - `entry-cooldown` — a mandatory rest after a meet, which is the most
 *     plausible of the three because real federations do impose one, and which
 *     charges the lifter who competed more with a lockout the lifter who stayed
 *     home does not pay.
 */

import { nextRandom, seedState } from '../game/prng';
import { addDays, type StreakDay } from '../game/streak';
import { CAREER_TUNING, type CareerFederationId, type CareerMeetTier } from './careerTuning';
import { entryTier, tiersLowestFirst } from './federation';
import {
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
 *   - `MEETS_PER_CAREER` is 167, the number of meets two periods hold, which is
 *     the ceiling on a career the simulation can produce: one meet a day at
 *     most, and every meet distinct.
 *
 * WHAT DEPTH STILL DOES NOT REACH, stated because a widened domain invites the
 * assumption that it is now complete, and pinned as three controls rather than
 * as this sentence:
 *
 *   - A rule keyed to a lifter's 166th meet. The deepest career here is 165.
 *     `delayed-form-past-the-edge` is that edge as a measured zero.
 *   - A rule keyed to the THIRD occurrence of the annual series, on day 734.
 *     Two periods hold two of them, at days 6 and 370. `worlds-reset-third` is
 *     that edge as a measured zero.
 *   - A rule keyed to the FIRST occurrence, on day 6. That one is inside the
 *     calendar and outside every career, because no lifter can hold 650 kg six
 *     days in. `worlds-reset-first` is that as a measured zero too, and it is
 *     the older half of the same fact: an edge can sit in the middle of a
 *     domain as well as at its end.
 *
 * A finite domain has an edge wherever it is drawn; what changed is where, and
 * that all three edges are now numbers a test pins rather than sentences.
 */
export const ATTENDANCE_SWEEP = Object.freeze({
  SEEDS: Object.freeze([
    20260812, 913377, 4242, 60103, 771, 1, 99991, 314159, 2718281, 17, 555555, 8675309,
    31, 4096, 123456789, 7, 202601, 88, 65537, 1048576, 999, 24601, 5150, 42424242,
  ]),
  /**
   * How many totals are drawn per career, and the deepest career the simulation
   * can produce. Read off the calendar: 105 local, 52 regional, 8 nationals and
   * 2 worlds across the two periods the simulation runs for.
   */
  MEETS_PER_CAREER: 167,
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
   * So both sides of the edge ship. At `DELAYED_FORM_INSIDE` the rule is inside
   * the deepest career the sweep produces and the axis reports it; at
   * `DELAYED_FORM_PAST_THE_EDGE` it is one meet beyond, no lifter here ever
   * reaches it, and the axis reports nothing. The second number is the honest
   * half — it is this measurement's blind spot, pinned, so that deepening or
   * shallowing the domain moves it instead of leaving it to be rediscovered.
   *
   * 81 and 82 at one calendar period; 164 and 165 at two. The pair moved with
   * the domain, which is the mechanism working.
   */
  DELAYED_FORM_INSIDE: 164,
  DELAYED_FORM_PAST_THE_EDGE: 165,
  /**
   * Which occurrence of the annual series each `worlds-reset-*` control fires
   * at, counted from the first one the calendar holds.
   *
   * These three are the tier axis of the same edge `DELAYED_FORM_*` draws on
   * the meet-count axis, and they are numbered from zero because that is how
   * `worldsOccurrenceOf` counts: occurrence 0 is the worlds meet on day 6,
   * occurrence 1 is the one on day 370, occurrence 2 would be day 734.
   *
   * The middle one is inside the domain. The outer two are its edges, and they
   * are edges for different reasons — the first is inside the calendar and
   * outside every career, the third is outside the simulation altogether. Both
   * report zero, and a reader who knows why each zero is zero knows what this
   * sweep is blind to.
   */
  WORLDS_RESET_FIRST_OCCURRENCE: 0,
  WORLDS_RESET_SECOND_OCCURRENCE: 1,
  WORLDS_RESET_THIRD_OCCURRENCE: 2,
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
    if (tier !== 'worlds' || tierOccurrenceOf('worlds', day) !== occurrence) {
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
  'delayed-form-past-the-edge': latestTotalAfter(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_THE_EDGE),
  'worlds-reset-first': worldsResetAt(ATTENDANCE_SWEEP.WORLDS_RESET_FIRST_OCCURRENCE),
  'worlds-reset-second': worldsResetAt(ATTENDANCE_SWEEP.WORLDS_RESET_SECOND_OCCURRENCE),
  'worlds-reset-third': worldsResetAt(ATTENDANCE_SWEEP.WORLDS_RESET_THIRD_OCCURRENCE),
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
 * What a lifter's entry list is asked from: the day, and how long ago they last
 * competed.
 *
 * The second field is what the shipped rule does not read and a rest-based
 * design would have to. Handing it to every variant keeps the two arms taking
 * one input each rather than two different ones.
 */
export interface EntryContext {
  readonly today: StreakDay;
  readonly lastEnteredDay: StreakDay | null;
}

/** Which entry rule a sweep runs under. */
export type EntryVariant = 'shipped' | 'entry-cooldown';

/**
 * The third control, and the one the entry axis is measured against.
 *
 * Under `entry-cooldown` a lifter may not enter anything for
 * `ENTRY_COOLDOWN_DAYS` after a meet. It is the most plausible of the three
 * controls — real federations impose rest, and a game would call it recovery —
 * and it is exactly the shape GDD §12.3 refuses: the lifter who competed at one
 * more meet starts their lockout later, so the calendar in front of them is
 * shorter than the calendar in front of the lifter who stayed home.
 *
 * `shipped` is `enterableMeets` itself, imported rather than restated, for the
 * reason `QUALIFICATION_VARIANTS` gives.
 */
export const ENTRY_VARIANTS: Readonly<
  Record<EntryVariant, (lifter: CareerLifter, context: EntryContext) => readonly CareerMeet[]>
> = Object.freeze({
  shipped: (lifter, context) => enterableMeets(lifter, context.today, ATTENDANCE_SWEEP.WINDOW_DAYS),
  'entry-cooldown': (lifter, context) => {
    const list = enterableMeets(lifter, context.today, ATTENDANCE_SWEEP.WINDOW_DAYS);
    if (context.lastEnteredDay === null) return list;
    const clearOn = addDays(context.lastEnteredDay, ATTENDANCE_SWEEP.ENTRY_COOLDOWN_DAYS);
    return list.filter((meet) => meet.day > clearOn);
  },
});

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
 * The attendance axis asks the same qualification question of up to 165 lifters
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
