/**
 * careerEngagement.ts — does competing MORE ever leave a lifter standing
 * LOWER, or qualified for a tier LATER, than competing less?
 *
 * CLAUDE.md's §12.3 condition is "never punish daily engagement", and it says
 * what that means as a measurement rather than as a sentiment: for two
 * histories identical except that one has an extra day of activity, the more
 * active player must never end worse off, element by element, at every horizon.
 * `src/game/streak.test.ts` measures it on streaks and
 * `src/empire/engagement.ts` measures it on the idle layer. A career record is
 * a history too, and tier qualification is derived from it, so the same
 * question is live here with "an extra MEET" in place of "an extra day":
 *
 *   for two careers identical except that one contested an extra meet, the
 *   lifter who competed more must never, on any day, be qualified for a lower
 *   tier, have competed at a lower tier, or show fewer completed meets.
 *
 * Pure module: zero React, zero side effects, zero I/O, no clock, no
 * randomness. Its imports are its two siblings. It holds no parameters — the
 * horizons, densities, seeds, generator and totals table live in
 * `careerEngagement.test.ts`, for the reason `src/game/streakSweep.ts` exists
 * (a measurement whose inputs are not written down is an anecdote) and with the
 * `.test.ts` suffix `src/tuning/audit.ts` forces on a file full of numbers that
 * are not game-feel values.
 *
 * ===========================================================================
 * 1. Two runs, because there are two ways to compete more and they differ
 * ===========================================================================
 *
 * `runRecordHistory` adds a result straight to the record, with no calendar in
 * the way. It measures the STANDING MATH alone: given one more meet on the
 * record, can `careerStanding` report a worse standing on any day? Nothing in
 * this run can refuse anything, so a violation here would be arithmetic.
 *
 * `runEntryPlan` runs the whole §6.1 loop instead: walk the calendar in day
 * order, offer each planned meet to `meetEligibility`, enter the ones it
 * admits, record what was posted there, and carry the standing forward so the
 * next meet's gate sees it. It measures the DESIGN, and it can refuse — in
 * particular `MIN_DAYS_BETWEEN_ENTERED_MEETS` means an extra meet spends a
 * window that a later, bigger meet needed. The two runs are separated because
 * a single count mixing them would be attributable to either.
 *
 * ===========================================================================
 * 2. The reading is per day, and that is what makes "later" measurable
 * ===========================================================================
 *
 * Each run produces one reading per calendar day: the qualified tier's rank,
 * the highest competed tier's rank, and the number of completed meets, all as
 * of that day. A comparison is element-wise over (day x field).
 *
 * Reading per day rather than at the horizon is what catches lateness without
 * needing a separate notion of it. If the more-engaged lifter qualifies for
 * regional on day 35 and the less-engaged one on day 21, every day in between
 * is an element where the more-engaged lifter is ranked lower, and the count
 * says so. `worstLatenessDays` then reports the same fact in days, derived from
 * the same series rather than measured separately.
 *
 * A day-indexed ARRIVAL comparison was written first and thrown away, and the
 * reason is worth keeping because it looks right: comparing
 * `qualifiedOnDayIndex` directly makes a lifter who reaches a HIGHER tier later
 * look worse than one who reached a lower tier earlier, since the field means
 * "the day the current top tier was reached". It would have counted an
 * improvement as a violation.
 *
 * ===========================================================================
 * 3. The controls, because a zero has to be a zero against something
 * ===========================================================================
 *
 * Three standing models, chosen by a parameter, over the same domain:
 *
 *   - `'shipped'` — `careerStanding` as `careerRecord.ts` computes it: the
 *     best tier ever qualified for, over the whole record.
 *   - `'latest-result-only'` — standing from the most recent result alone. A
 *     "current form" model, and a perfectly plausible design: it is what a
 *     ladder that expires qualification at the next meet would do. Under it an
 *     extra meet with a smaller total DEMOTES the lifter, which is the shape
 *     §12.3 refuses.
 *   - `'last-n-results'` — the same idea with a window of `recentResults`
 *     meets. It exists because a one-result window is easy to dismiss as a
 *     straw man; a rolling window is what a real "recent form" rule looks like
 *     and it has the same defect, smaller.
 *
 * Nothing in the game reads the last two. They are here so the shipped
 * wiring's zeros are zeros against a measured non-zero rather than against a
 * hope.
 *
 * ===========================================================================
 * 4. What this file does not do
 * ===========================================================================
 *
 *   - It does not model performance. What a lifter posts at a meet arrives as
 *     an input, one `CareerMeetOffer` per attendable slot. A curve invented
 *     here would make every count below a fact about the curve.
 *   - It does not score, compare totals, or read a clock. The gate is injected
 *     exactly as it is everywhere else in this directory.
 *   - It does not decide the answer. Where a count is not zero it is reported
 *     and diagnosed in `careerEngagement.test.ts`, not clamped.
 */

import {
  enterMeet,
  meetEligibility,
  type CareerLifter,
  type CareerMeetSlot,
  type CareerQualifyingCategory,
  type CareerQualifyingGate,
} from './careerCore';
import {
  careerStanding,
  createCareerRecord,
  lifterWithStanding,
  recordMeetResult,
  standingRank,
  type CareerMeetResult,
  type CareerRecord,
  type CareerStanding,
} from './careerRecord';

// ---------------------------------------------------------------------------
// The standing models
// ---------------------------------------------------------------------------

/** The model the game ships, and the two controls its zeros are zeros against. */
export const CAREER_STANDING_WIRINGS = [
  'shipped',
  'latest-result-only',
  'last-n-results',
] as const;

export type CareerStandingWiringKey = (typeof CAREER_STANDING_WIRINGS)[number];

/** The one model `careerRecord.ts` implements. See the header, section 3. */
export const SHIPPED_CAREER_STANDING_WIRING: CareerStandingWiringKey = 'shipped';

/**
 * A model and the one magnitude a control needs.
 *
 * `recentResults` is a control's dial, so it is required to be zero on every
 * model that does not window — a control whose dial is set on the shipped model
 * would be the subject quietly running under a control's arithmetic.
 */
export interface CareerStandingWiring {
  readonly key: CareerStandingWiringKey;
  readonly recentResults: number;
}

/** True for a model that only counts a lifter's most recent meets. */
export function windowsResults(key: CareerStandingWiringKey): boolean {
  return key === 'latest-result-only' || key === 'last-n-results';
}

/** Build a model, refusing a dial on a model that has nothing to turn. */
export function careerStandingWiring(
  key: CareerStandingWiringKey,
  recentResults: number,
): CareerStandingWiring {
  if (!Number.isInteger(recentResults) || recentResults < 0) {
    throw new RangeError(
      `a result window must be a whole number at or above zero, received ${recentResults}.`,
    );
  }
  if (key === 'latest-result-only' && recentResults !== 1) {
    throw new RangeError(`the ${key} model is a window of one, so ${recentResults} has no meaning`);
  }
  if (key === 'last-n-results' && recentResults < 1) {
    throw new RangeError(`the ${key} model counts nothing at ${recentResults}, so it models nothing`);
  }
  if (!windowsResults(key) && recentResults !== 0) {
    throw new RangeError(`the ${key} model windows nothing, so ${recentResults} has no meaning`);
  }
  return Object.freeze({ key, recentResults });
}

/** The shipped model, which has no dial. */
export function shippedCareerStandingWiring(): CareerStandingWiring {
  return careerStandingWiring(SHIPPED_CAREER_STANDING_WIRING, 0);
}

/** The results a model counts, out of the ones a lifter has on the record. */
export function resultsUnder<Total>(
  wiring: CareerStandingWiring,
  results: readonly CareerMeetResult<Total>[],
): readonly CareerMeetResult<Total>[] {
  if (!windowsResults(wiring.key)) return results;
  if (results.length <= wiring.recentResults) return results;
  return results.slice(results.length - wiring.recentResults);
}

/** Standing on a given day under a given model. The definitional reading. */
export function standingUnder<Total>(
  wiring: CareerStandingWiring,
  record: CareerRecord<Total>,
  throughDayIndex: number,
  category: CareerQualifyingCategory,
  gate: CareerQualifyingGate<Total>,
): CareerStanding<Total> {
  const upToDay = record.results.filter((result) => result.dayIndex <= throughDayIndex);
  return careerStanding({ results: resultsUnder(wiring, upToDay) }, category, gate);
}

// ---------------------------------------------------------------------------
// The subject
// ---------------------------------------------------------------------------

/** One meet a simulated lifter could contest, and what they would post at it. */
export interface CareerMeetOffer<Total> {
  readonly slot: CareerMeetSlot;
  /** The total posted there, or `null` for a bomb-out. */
  readonly total: Total | null;
  readonly bodyweightKg: number;
}

/** Everything a run needs that is not the attendance pattern. */
export interface CareerEngagementInputs<Total> {
  /** One offer per attendable slot, ascending by day. */
  readonly offers: readonly CareerMeetOffer<Total>[];
  readonly lifter: CareerLifter<Total>;
  readonly category: CareerQualifyingCategory;
  readonly gate: CareerQualifyingGate<Total>;
  /** The last day a reading is taken on. */
  readonly throughDayIndex: number;
}

/**
 * The same attendance with one more meet contested, at an offer it declined.
 *
 * Throws on an offer already taken or off the list. That refusal is the
 * precondition of the whole measurement — "identical except that one contested
 * an extra meet" — held by the constructor rather than by a caller
 * remembering, so a pair that does not differ in engagement cannot be counted
 * as evidence about engagement.
 *
 * MUTATION WITNESS. Mutant: the `if (current) { throw ... }` guard deleted.
 * Reddened: `expect(() => withExtraMeet(attendance, 1)).toThrow(/already
 * contested/)` inside `refuses to build a pair that differs in nothing`.
 */
export function withExtraMeet(
  attendance: readonly boolean[],
  offer: number,
): readonly boolean[] {
  const current = attendance[offer];
  if (current === undefined) {
    throw new RangeError(`offer ${offer} is off a list of ${attendance.length} offers`);
  }
  if (current) {
    throw new RangeError(`offer ${offer} is already contested, so this pair differs in nothing`);
  }
  const taken = [...attendance];
  taken[offer] = true;
  return Object.freeze(taken);
}

/** Offers taken in an attendance pattern. A run's non-vacuity denominator. */
export function meetsTaken(attendance: readonly boolean[]): number {
  let count = 0;
  for (const taken of attendance) {
    if (taken) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// A run
// ---------------------------------------------------------------------------

/** One day's standing, as the comparator reads it. */
export interface CareerStandingReading {
  readonly dayIndex: number;
  /** `standingRank` of the qualified tier: -1 for none, 0 for local, up. */
  readonly qualifiedRank: number;
  readonly competedRank: number;
  readonly meetsCompleted: number;
}

/** What a run actually did, so a zero taken off it reports its own domain. */
export interface CareerEngagementCensus {
  readonly offers: number;
  readonly planned: number;
  /** Planned meets the calendar admitted. Below `planned` means it refused some. */
  readonly entered: number;
  readonly refusedEntries: number;
  readonly recorded: number;
  readonly totalsPosted: number;
  readonly bombOuts: number;
  readonly days: number;
  readonly topQualifiedRank: number;
  readonly topCompetedRank: number;
}

export interface CareerEngagementRun<Total> {
  readonly wiring: CareerStandingWiring;
  readonly record: CareerRecord<Total>;
  readonly readings: readonly CareerStandingReading[];
  readonly census: CareerEngagementCensus;
}

/**
 * The day-by-day series for a finished record.
 *
 * Computed from prefixes rather than by re-filtering the record on every day:
 * the results are day-ascending, so the results on or before day `d` are a
 * prefix of the list, and the standing on day `d` is the standing over that
 * prefix. `careerEngagement.test.ts` asserts the series equals the one
 * `standingUnder` produces day by day, which is the slower definitional
 * reading — so the index arithmetic here has an oracle that does not share it.
 */
function readingsFor<Total>(
  record: CareerRecord<Total>,
  inputs: CareerEngagementInputs<Total>,
  wiring: CareerStandingWiring,
): readonly CareerStandingReading[] {
  const prefixes: CareerStanding<Total>[] = [];
  for (let taken = 0; taken <= record.results.length; taken += 1) {
    prefixes.push(
      careerStanding(
        { results: resultsUnder(wiring, record.results.slice(0, taken)) },
        inputs.category,
        inputs.gate,
      ),
    );
  }

  const readings: CareerStandingReading[] = [];
  let taken = 0;
  for (let dayIndex = 0; dayIndex <= inputs.throughDayIndex; dayIndex += 1) {
    while (taken < record.results.length && (record.results[taken] as CareerMeetResult<Total>).dayIndex <= dayIndex) {
      taken += 1;
    }
    const standing = prefixes[taken] as CareerStanding<Total>;
    readings.push(
      Object.freeze({
        dayIndex,
        qualifiedRank: standingRank(standing.qualifiedTier),
        competedRank: standingRank(standing.highestTierCompeted),
        meetsCompleted: standing.meetsCompleted,
      }),
    );
  }
  return Object.freeze(readings);
}

/** The census of a finished run. */
function censusFor<Total>(
  record: CareerRecord<Total>,
  inputs: CareerEngagementInputs<Total>,
  planned: number,
  entered: number,
  readings: readonly CareerStandingReading[],
): CareerEngagementCensus {
  let totalsPosted = 0;
  let bombOuts = 0;
  for (const result of record.results) {
    if (result.total === null) bombOuts += 1;
    else totalsPosted += 1;
  }
  const last = readings[readings.length - 1];
  return Object.freeze({
    offers: inputs.offers.length,
    planned,
    entered,
    refusedEntries: planned - entered,
    recorded: record.results.length,
    totalsPosted,
    bombOuts,
    days: readings.length,
    topQualifiedRank: last === undefined ? -1 : last.qualifiedRank,
    topCompetedRank: last === undefined ? -1 : last.competedRank,
  });
}

/**
 * Every contested offer straight onto the record, with no calendar in the way.
 *
 * The standing math on its own. Entry is not consulted, nothing can be
 * refused, and the lifter is treated as having entered every offer they took —
 * so a violation from this run is arithmetic in `careerStanding` and cannot be
 * the gap rule.
 */
export function runRecordHistory<Total>(
  inputs: CareerEngagementInputs<Total>,
  attendance: readonly boolean[],
  wiring: CareerStandingWiring = shippedCareerStandingWiring(),
): CareerEngagementRun<Total> {
  if (attendance.length !== inputs.offers.length) {
    throw new RangeError(
      `an attendance of ${attendance.length} does not fit ${inputs.offers.length} offers`,
    );
  }
  let record = createCareerRecord<Total>();
  let lifter = inputs.lifter;
  let planned = 0;

  for (let index = 0; index < inputs.offers.length; index += 1) {
    if (attendance[index] !== true) continue;
    planned += 1;
    const offer = inputs.offers[index] as CareerMeetOffer<Total>;
    lifter = Object.freeze({
      ...lifter,
      enteredSlotIds: Object.freeze([...lifter.enteredSlotIds, offer.slot.slotId]),
      lastEntryDayIndex: offer.slot.dayIndex,
    });
    const outcome = recordMeetResult(record, lifter, offer.slot, {
      total: offer.total,
      bodyweightKg: offer.bodyweightKg,
    });
    if (outcome.kind !== 'recorded') {
      throw new RangeError(
        `a history run cannot be refused, and ${offer.slot.slotId} was: ${outcome.reason.kind}`,
      );
    }
    record = outcome.record;
  }

  const readings = readingsFor(record, inputs, wiring);
  return Object.freeze({
    wiring,
    record,
    readings,
    census: censusFor(record, inputs, planned, planned, readings),
  });
}

/** The entry rule a plan is run under, and the control that isolates one term. */
export const CAREER_ENTRY_MODELS = ['shipped', 'no-gap'] as const;

export type CareerEntryModel = (typeof CAREER_ENTRY_MODELS)[number];

/** The rule the game ships: §6.6's gap between two meets one lifter enters. */
export const SHIPPED_CAREER_ENTRY_MODEL: CareerEntryModel = 'shipped';

/**
 * The lifter as the entry model asks the calendar about them.
 *
 * `'no-gap'` hands `meetEligibility` a copy with no last entry day, which
 * switches off `earliestNextEntryDay` and therefore the
 * `too-soon-after-last-meet` refusal, and changes nothing else: the federation,
 * the entered list, the category and the qualifying total are the same value.
 * It is a control, and nothing the game ships runs on it.
 *
 * "CHANGES NOTHING ELSE" IS THE HALF THAT WAS ENFORCED BY NOTHING, and it is the
 * half every attribution in this file rests on: if the control also cleared, say,
 * `bestTotal`, then every "the entry gap is all of it" count would be a
 * difference of two things while still reading as a control.
 *
 * MUTATION WITNESS. Mutant: `return Object.freeze({ ...lifter,
 * lastEntryDayIndex: null, bestTotal: null });`. Reddened:
 * `expect(noGap.record).toEqual(shipped.record)` inside `changes nothing but the
 * entry gap when it runs the control`, which drives a plan the gap rule refuses
 * nothing on, so the ONE documented difference is switched off and any second
 * one shows up as two unequal records.
 */
function asAsked<Total>(lifter: CareerLifter<Total>, model: CareerEntryModel): CareerLifter<Total> {
  if (model === SHIPPED_CAREER_ENTRY_MODEL) return lifter;
  return Object.freeze({ ...lifter, lastEntryDayIndex: null });
}

/**
 * The whole §6.1 loop over a plan: enter what the calendar admits, record what
 * was posted, carry the standing forward into the next meet's gate.
 *
 * Entry is offered on the meet's own day, which is what a player picking a meet
 * off the calendar does. A refused entry is counted and skipped — it is not an
 * error, it is the design saying no, and `MIN_DAYS_BETWEEN_ENTERED_MEETS` is
 * the rule that says it most often.
 */
export function runEntryPlan<Total>(
  inputs: CareerEngagementInputs<Total>,
  plan: readonly boolean[],
  wiring: CareerStandingWiring = shippedCareerStandingWiring(),
  entryModel: CareerEntryModel = SHIPPED_CAREER_ENTRY_MODEL,
): CareerEngagementRun<Total> {
  if (plan.length !== inputs.offers.length) {
    throw new RangeError(`a plan of ${plan.length} does not fit ${inputs.offers.length} offers`);
  }
  let record = createCareerRecord<Total>();
  let lifter = inputs.lifter;
  let planned = 0;
  let entered = 0;

  for (let index = 0; index < inputs.offers.length; index += 1) {
    if (plan[index] !== true) continue;
    planned += 1;
    const offer = inputs.offers[index] as CareerMeetOffer<Total>;
    const outcome = enterMeet(
      asAsked(lifter, entryModel),
      offer.slot,
      offer.slot.dayIndex,
      inputs.gate,
    );
    if (outcome.kind !== 'entered') continue;
    entered += 1;
    lifter = outcome.lifter;

    const recorded = recordMeetResult(record, lifter, offer.slot, {
      total: offer.total,
      bodyweightKg: offer.bodyweightKg,
    });
    if (recorded.kind !== 'recorded') {
      throw new RangeError(
        `an entered meet must be recordable, and ${offer.slot.slotId} was not: ${recorded.reason.kind}`,
      );
    }
    record = recorded.record;
    lifter = lifterWithStanding(lifter, careerStanding(record, inputs.category, inputs.gate));
  }

  const readings = readingsFor(record, inputs, wiring);
  return Object.freeze({
    wiring,
    record,
    readings,
    census: censusFor(record, inputs, planned, entered, readings),
  });
}

/** Whether the calendar would admit this offer to this lifter on its own day. */
export function admitsOffer<Total>(
  inputs: CareerEngagementInputs<Total>,
  lifter: CareerLifter<Total>,
  offer: CareerMeetOffer<Total>,
): boolean {
  return (
    meetEligibility(offer.slot, lifter, offer.slot.dayIndex, inputs.gate).kind === 'eligible'
  );
}

// ---------------------------------------------------------------------------
// The comparison
// ---------------------------------------------------------------------------

/** The fields a comparison reads, per day. Higher is better on all three. */
export const CAREER_STANDING_FIELDS = [
  'qualifiedRank',
  'competedRank',
  'meetsCompleted',
] as const;

export type CareerStandingField = (typeof CAREER_STANDING_FIELDS)[number];

/** What comparing two runs found. Counts, so an empty domain reports itself. */
export interface CareerEngagementComparison {
  readonly days: number;
  /** Days times fields. The denominator every count below is out of. */
  readonly elements: number;
  /** Elements where the two runs differ at all, either way. */
  readonly movedElements: number;
  /** Elements where the lifter who competed MORE is worse off. */
  readonly violations: number;
  readonly byField: Readonly<Record<CareerStandingField, number>>;
  /** Days carrying at least one violating element. */
  readonly violatingDays: number;
  /** The largest amount the more-engaged lifter was behind by, in ranks or meets. */
  readonly worstDeficit: number;
  /**
   * The longest run of consecutive days the more-engaged lifter spent ranked
   * below the other on the qualified ladder. "Qualified later", in days.
   */
  readonly worstLatenessDays: number;
}

/** Read one field off a reading. */
function fieldOf(reading: CareerStandingReading, field: CareerStandingField): number {
  if (field === 'qualifiedRank') return reading.qualifiedRank;
  if (field === 'competedRank') return reading.competedRank;
  return reading.meetsCompleted;
}

/**
 * Compare the lifter who competed less against the one who competed more.
 *
 * Element-wise by day and field. A violation is an element where the
 * more-engaged lifter is strictly lower, which is the §12.3 property stated as
 * an arithmetic. Both runs must cover the same days, because a comparison over
 * two different horizons is not a comparison.
 */
export function compareCareerEngagement<Total>(
  less: CareerEngagementRun<Total>,
  more: CareerEngagementRun<Total>,
): CareerEngagementComparison {
  if (less.readings.length !== more.readings.length) {
    throw new RangeError(
      `two runs over ${less.readings.length} and ${more.readings.length} days are not comparable`,
    );
  }
  const byField: Record<CareerStandingField, number> = {
    qualifiedRank: 0,
    competedRank: 0,
    meetsCompleted: 0,
  };
  let elements = 0;
  let movedElements = 0;
  let violations = 0;
  let violatingDays = 0;
  let worstDeficit = 0;
  let lateness = 0;
  let worstLatenessDays = 0;

  for (let day = 0; day < less.readings.length; day += 1) {
    const before = less.readings[day] as CareerStandingReading;
    const after = more.readings[day] as CareerStandingReading;
    let dayViolations = 0;
    for (const field of CAREER_STANDING_FIELDS) {
      elements += 1;
      const deficit = fieldOf(before, field) - fieldOf(after, field);
      if (deficit !== 0) movedElements += 1;
      if (deficit <= 0) continue;
      violations += 1;
      dayViolations += 1;
      byField[field] += 1;
      if (deficit > worstDeficit) worstDeficit = deficit;
    }
    if (dayViolations > 0) violatingDays += 1;
    if (after.qualifiedRank < before.qualifiedRank) {
      lateness += 1;
      if (lateness > worstLatenessDays) worstLatenessDays = lateness;
    } else {
      lateness = 0;
    }
  }

  return Object.freeze({
    days: less.readings.length,
    elements,
    movedElements,
    violations,
    byField: Object.freeze(byField),
    violatingDays,
    worstDeficit,
    worstLatenessDays,
  });
}

/** Add two comparisons, so a sweep accumulates without a mutable tally. */
export function addComparisons(
  left: CareerEngagementComparison,
  right: CareerEngagementComparison,
): CareerEngagementComparison {
  return Object.freeze({
    days: left.days + right.days,
    elements: left.elements + right.elements,
    movedElements: left.movedElements + right.movedElements,
    violations: left.violations + right.violations,
    byField: Object.freeze({
      qualifiedRank: left.byField.qualifiedRank + right.byField.qualifiedRank,
      competedRank: left.byField.competedRank + right.byField.competedRank,
      meetsCompleted: left.byField.meetsCompleted + right.byField.meetsCompleted,
    }),
    violatingDays: left.violatingDays + right.violatingDays,
    worstDeficit: Math.max(left.worstDeficit, right.worstDeficit),
    worstLatenessDays: Math.max(left.worstLatenessDays, right.worstLatenessDays),
  });
}

/** An empty comparison, the identity `addComparisons` accumulates from. */
export function noComparisons(): CareerEngagementComparison {
  return Object.freeze({
    days: 0,
    elements: 0,
    movedElements: 0,
    violations: 0,
    byField: Object.freeze({ qualifiedRank: 0, competedRank: 0, meetsCompleted: 0 }),
    violatingDays: 0,
    worstDeficit: 0,
    worstLatenessDays: 0,
  });
}
