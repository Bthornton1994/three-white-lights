/**
 * careerEngagement.test.ts — §12.3's "never punish daily engagement", measured
 * on a career: does contesting an extra meet ever leave a lifter standing
 * lower, or qualified later?
 *
 * ===========================================================================
 * The answer, up front, with the term that is not zero named
 * ===========================================================================
 *
 * Every number below is pinned in this file and reproducible from
 * `CAREER_ENGAGEMENT_SWEEP` alone. All of it is element-wise: one reading per
 * calendar day, three fields per reading, compared between a lifter and the
 * same lifter with one more meet on the calendar.
 *
 *   subject                                     window     seeded
 *   the standing math (`runRecordHistory`)           0          0
 *     control: standing from the latest result   9769        751
 *     control: standing from the last two        9451        693
 *   the whole §6.1 loop (`runEntryPlan`)          5124        258
 *     control: the same loop, no entry gap          0          0
 *
 * violating PAIRS, out of 24576 on the exhaustive window and 1769 seeded.
 *
 * THE STANDING MATH IS CLEAN AND THE LOOP IS NOT, and the second line is the
 * finding rather than a rounding error. It is reported and diagnosed here; it
 * has not been clamped, and the constant behind it has not been quietly
 * lowered.
 *
 * ===========================================================================
 * What the 5124 actually is: `MIN_DAYS_BETWEEN_ENTERED_MEETS`, measured
 * ===========================================================================
 *
 * A lifter who enters a meet may not enter another for
 * `MIN_DAYS_BETWEEN_ENTERED_MEETS` days — GDD §6.6's biweekly cadence as a
 * rule. So entering an extra LOCAL meet on day 7 can spend the window that a
 * REGIONAL meet on day 21 needed, and the more-engaged lifter spends the next
 * stretch of the calendar with a lower highest-tier-competed, a lower qualified
 * tier, or fewer meets on the record than the lifter who stayed home.
 *
 * The attribution is a control, not an argument. `'no-gap'` runs the identical
 * loop with `earliestNextEntryDay` switched off and nothing else changed, and
 * it is 0 on both domains. Every one of the 5124 is that one rule.
 *
 * Its magnitudes: worst deficit 2 rungs on the window and 4 seeded, and the
 * longest unbroken run of days spent ranked below the less-engaged lifter is
 * 107 days on the window and 227 seeded. This is not a small residue.
 *
 * WHAT THIS IS AND IS NOT, stated because the distinction decides whether it is
 * a §12.3 breach and this file cannot decide that. §12.3's subject is DAILY
 * ENGAGEMENT — showing up to train, opening the app, keeping a streak — and
 * `MIN_DAYS_BETWEEN_ENTERED_MEETS` reads none of those: it reads
 * `lastEntryDayIndex` and there is nothing else on `CareerLifter` to read, which
 * `careerCore.test.ts` pins as a field list. Nothing a player does daily moves
 * it. What it does punish is a COMPETITION CHOICE: taking the meet in front of
 * you costs the bigger one behind it, which is a scheduling decision with a
 * cost, and whether that reads as tension or as a trap is exactly the kind of
 * question GDD §12.1 says a playtest answers and an agent does not.
 *
 * The same tension was already recorded, from the other end, in
 * `careerCore.test.ts`'s greedy ladder walk: "take every meet you can" is a
 * strategy that costs the top of the ladder, and that walk enters no worlds
 * meet. This is that observation with a denominator.
 *
 * Three things a human might do about it, none of them taken here: lower
 * `MIN_DAYS_BETWEEN_ENTERED_MEETS` (it is a `budget`, and the number moves the
 * count); let a higher-tier meet override the gap; or leave it and treat the
 * cost as the point. All three are design rulings.
 *
 * ===========================================================================
 * Why the zeros are zeros against something
 * ===========================================================================
 *
 * `careerStanding` keeps the best tier a lifter ever qualified for, over the
 * whole record. That is monotone in the record by construction, so a zero from
 * it could be a zero about nothing. The two controls are the designs it is not:
 * `'latest-result-only'` is standing from the most recent meet, and
 * `'last-n-results'` is a rolling form window — both are plausible ladders and
 * both are non-zero here, because under them an extra meet with a smaller total
 * DEMOTES the lifter who took it.
 *
 * The `movedElements` counts are pinned beside every zero for the other vacuity
 * shape: they say the two runs differed somewhere, so the domain is not empty.
 *
 * ===========================================================================
 * The parameters live here for the reason `src/game/streakSweep.ts` exists
 * ===========================================================================
 *
 * That file exists because a measurement was once reported with its seeds
 * unstated and "six plausible parameterisations gave six different numbers".
 * `CAREER_ENGAGEMENT_SWEEP` is this measurement's equivalent: every horizon,
 * seed, density and generator constant, in one frozen block. It carries a
 * `.test.ts` suffix because `src/tuning/audit.ts` classifies an unregistered
 * `src/career/*.ts` as a renderer, and a renderer may hold no bare literal —
 * and these are sweep parameters, not game-feel values, so `careerTuning.ts`
 * is the wrong home for them.
 */

import { describe, expect, it } from 'vitest';

import {
  CAREER_FEDERATIONS,
  buildCareerCalendar,
  createCareerLifter,
  type CareerFederation,
  type CareerMeetSlot,
  type CareerQualifyingGate,
} from './careerCore';
import { careerStanding, standingRank, type CareerMeetResult } from './careerRecord';
import {
  CAREER_ENTRY_MODELS,
  CAREER_STANDING_FIELDS,
  CAREER_STANDING_WIRINGS,
  SHIPPED_CAREER_ENTRY_MODEL,
  SHIPPED_CAREER_STANDING_WIRING,
  addComparisons,
  admitsOffer,
  careerStandingWiring,
  compareCareerEngagement,
  meetsTaken,
  noComparisons,
  resultsUnder,
  runEntryPlan,
  runRecordHistory,
  shippedCareerStandingWiring,
  standingUnder,
  windowsResults,
  withExtraMeet,
  type CareerEngagementComparison,
  type CareerEngagementInputs,
  type CareerEngagementRun,
  type CareerEntryModel,
  type CareerMeetOffer,
  type CareerStandingReading,
  type CareerStandingWiring,
} from './careerEngagement';

// ===========================================================================
// The parameters
// ===========================================================================

export const CAREER_ENGAGEMENT_SWEEP = Object.freeze({
  /** The category every reading is taken in. The table is per category. */
  CATEGORY: 'mens',

  /** The federation the calendar is built for. Any of the four would do. */
  FEDERATION_INDEX: 0,

  /** The last day a reading is taken on, on the exhaustive window. */
  WINDOW_HORIZON_DAYS: 120,

  /**
   * How many of the calendar's meets are enumerated exhaustively. Twelve
   * offers is 2^12 attendance patterns and 12 * 2^11 = 24576 pairs, which is
   * the same order as `src/empire/engagement.test.ts`'s window and was chosen
   * to be comparable with it.
   */
  WINDOW_OFFERS: 12,

  /** The horizon and offer count the seeded sweep runs at. */
  SEEDED_HORIZON_DAYS: 240,
  SEEDED_OFFERS: 20,

  /** Baselines drawn per seed, and the share of offers a baseline contests. */
  SEEDED_TRIALS: 60,
  ATTENDANCE_DENSITY: 0.5,

  /**
   * One seed per seeded run. The window sweep uses the first for its totals
   * table and enumerates its attendance rather than drawing it.
   */
  SEEDS: Object.freeze([90210, 31337, 60613] as const),

  /**
   * A 32-bit linear congruential generator, kept inside
   * `Number.MAX_SAFE_INTEGER` by its multiplier — `1664525 * (2^32 - 1)` is
   * about 7.15e15, under 9.007e15 — so the sequence is exact integer
   * arithmetic and reproduces anywhere. The same three constants
   * `src/empire/engagement.test.ts` uses, so a reader comparing the two sweeps
   * is comparing like with like.
   */
  LCG_MULTIPLIER: 1664525,
  LCG_INCREMENT: 1013904223,
  LCG_MODULUS: 4294967296,

  /**
   * The synthetic performance model: what a lifter posts at a meet, drawn
   * uniformly in this band.
   *
   * NOT A DESIGN CLAIM AND NOT A CURVE THE GAME HAS. It is a spread wide enough
   * to cross three of the four tiers' qualifying totals in both directions, so
   * that an extra meet can carry a better total or a worse one and the
   * measurement has both cases in its domain. A lifter who improved
   * monotonically would make the controls unfalsifiable.
   */
  TOTAL_FLOOR_KG: 380,
  TOTAL_CEILING_KG: 720,

  /**
   * One offer in this many is a bomb-out, drawn from the same stream. GDD
   * §6.3's three misses on one lift: the meet is competed at and no total is
   * posted, which is the case a record that only stored totals would lose.
   */
  BOMB_OUT_IN: 11,

  /** The weigh-in every simulated result carries. Carried, never scored. */
  BODYWEIGHT_KG: 92.5,

  /** The `last-n-results` control's window. One is the other control. */
  RECENT_RESULTS: 2,
});

// ===========================================================================
// The subject, built from those parameters
// ===========================================================================

/** The opaque total, as every test in this directory builds it. */
interface TestTotal {
  readonly kg: number;
}

const kg = (value: number): TestTotal => ({ kg: value });
const GATE: CareerQualifyingGate<TestTotal> = (total, requiredKg) => total.kg >= requiredKg;

const FED = CAREER_FEDERATIONS[
  CAREER_ENGAGEMENT_SWEEP.FEDERATION_INDEX
] as CareerFederation;
const CATEGORY = CAREER_ENGAGEMENT_SWEEP.CATEGORY as 'mens';

/** The generator, as a closure over its own state. No clock, no global. */
function lcg(seed: number): () => number {
  let state = seed % CAREER_ENGAGEMENT_SWEEP.LCG_MODULUS;
  return () => {
    state =
      (CAREER_ENGAGEMENT_SWEEP.LCG_MULTIPLIER * state + CAREER_ENGAGEMENT_SWEEP.LCG_INCREMENT) %
      CAREER_ENGAGEMENT_SWEEP.LCG_MODULUS;
    return state / CAREER_ENGAGEMENT_SWEEP.LCG_MODULUS;
  };
}

/** The first `count` meets on the federation's calendar, with what was posted. */
function offersFor(
  seed: number,
  count: number,
  horizon: number,
): readonly CareerMeetOffer<TestTotal>[] {
  const calendar = buildCareerCalendar({ federationId: FED.id, throughDayIndex: horizon });
  const next = lcg(seed);
  const offers: CareerMeetOffer<TestTotal>[] = [];
  for (const slot of calendar.slice(0, count)) {
    const roll = next();
    const bombedOut = Math.floor(roll * CAREER_ENGAGEMENT_SWEEP.BOMB_OUT_IN) === 0;
    offers.push({
      slot: slot as CareerMeetSlot,
      total: bombedOut
        ? null
        : kg(
            Math.round(
              CAREER_ENGAGEMENT_SWEEP.TOTAL_FLOOR_KG +
                next() *
                  (CAREER_ENGAGEMENT_SWEEP.TOTAL_CEILING_KG -
                    CAREER_ENGAGEMENT_SWEEP.TOTAL_FLOOR_KG),
            ),
          ),
      bodyweightKg: CAREER_ENGAGEMENT_SWEEP.BODYWEIGHT_KG,
    });
  }
  return offers;
}

function inputsFor(
  offers: readonly CareerMeetOffer<TestTotal>[],
  horizon: number,
): CareerEngagementInputs<TestTotal> {
  return {
    offers,
    lifter: createCareerLifter<TestTotal>(FED.id, CATEGORY),
    category: CATEGORY,
    gate: GATE,
    throughDayIndex: horizon,
  };
}

/** Which run function a sweep arm drives, and under which entry rule. */
type SweepMode = 'record' | 'plan';

function runner(
  mode: SweepMode,
  inputs: CareerEngagementInputs<TestTotal>,
  wiring: CareerStandingWiring,
  entryModel: CareerEntryModel,
): (attendance: readonly boolean[]) => CareerEngagementRun<TestTotal> {
  if (mode === 'record') return (attendance) => runRecordHistory(inputs, attendance, wiring);
  return (attendance) => runEntryPlan(inputs, attendance, wiring, entryModel);
}

/** What a sweep arm found. Pairs and elements are its own denominators. */
interface SweepResult {
  readonly pairs: number;
  readonly violatingPairs: number;
  readonly recorded: number;
  readonly total: CareerEngagementComparison;
}

function sweepOver(
  run: (attendance: readonly boolean[]) => CareerEngagementRun<TestTotal>,
  baselines: readonly (readonly boolean[])[],
): SweepResult {
  let total = noComparisons();
  let pairs = 0;
  let violatingPairs = 0;
  let recorded = 0;
  for (const baseline of baselines) {
    const less = run(baseline);
    for (let offer = 0; offer < baseline.length; offer += 1) {
      if (baseline[offer] === true) continue;
      const more = run(withExtraMeet(baseline, offer));
      const comparison = compareCareerEngagement(less, more);
      total = addComparisons(total, comparison);
      pairs += 1;
      recorded += more.census.recorded;
      if (comparison.violations > 0) violatingPairs += 1;
    }
  }
  return { pairs, violatingPairs, recorded, total };
}

/** Every attendance pattern over `offers` offers, in mask order. */
function everyBaseline(offers: number): readonly (readonly boolean[])[] {
  const baselines: (readonly boolean[])[] = [];
  for (let mask = 0; mask < 1 << offers; mask += 1) {
    const pattern: boolean[] = [];
    for (let offer = 0; offer < offers; offer += 1) pattern.push((mask & (1 << offer)) !== 0);
    baselines.push(Object.freeze(pattern));
  }
  return baselines;
}

/** `trials` baselines drawn at the sweep's density, from one seed's stream. */
function seededBaselines(seed: number, offers: number, trials: number): readonly (readonly boolean[])[] {
  const next = lcg(seed + 1);
  const baselines: (readonly boolean[])[] = [];
  for (let trial = 0; trial < trials; trial += 1) {
    const pattern: boolean[] = [];
    for (let offer = 0; offer < offers; offer += 1) {
      pattern.push(next() < CAREER_ENGAGEMENT_SWEEP.ATTENDANCE_DENSITY);
    }
    baselines.push(Object.freeze(pattern));
  }
  return baselines;
}

const LATEST_ONLY = careerStandingWiring('latest-result-only', 1);
const LAST_N = careerStandingWiring('last-n-results', CAREER_ENGAGEMENT_SWEEP.RECENT_RESULTS);

const WINDOW_OFFERS = offersFor(
  CAREER_ENGAGEMENT_SWEEP.SEEDS[0],
  CAREER_ENGAGEMENT_SWEEP.WINDOW_OFFERS,
  CAREER_ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS,
);
const WINDOW_INPUTS = inputsFor(WINDOW_OFFERS, CAREER_ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS);
const WINDOW_BASELINES = everyBaseline(CAREER_ENGAGEMENT_SWEEP.WINDOW_OFFERS);

const SWEEP_TIMEOUT_MS = 120000;

// ===========================================================================
// The domain, before anything is measured over it
// ===========================================================================

describe('the domain the counts below are out of', () => {
  it('offers twelve real meets across three tiers, with a bomb-out among them', () => {
    // Pinned rather than described: the totals table is the synthetic
    // performance model, and every count in this file is a fact about THESE
    // twelve meets. A generator change moves the numbers and should be read.
    //
    // Reddens on: touching any of `TOTAL_FLOOR_KG`, `TOTAL_CEILING_KG`,
    // `BOMB_OUT_IN`, `SEEDS[0]`, `WINDOW_OFFERS` or the calendar's cadence.
    expect(
      WINDOW_OFFERS.map(
        (offer) =>
          `${offer.slot.tier}@${offer.slot.dayIndex}=${offer.total === null ? 'BOMB' : offer.total.kg}`,
      ),
    ).toEqual([
      'local@7=606',
      'local@14=691',
      'local@21=591',
      'regional@21=652',
      'local@28=384',
      'local@35=599',
      'regional@35=500',
      'local@42=708',
      'local@49=561',
      'regional@49=426',
      'nationals@49=493',
      'local@56=432',
    ]);
    expect(new Set(WINDOW_OFFERS.map((offer) => offer.slot.tier)).size).toBe(3);
    expect(WINDOW_BASELINES.length).toBe(4096);
  });

  it('spans the tiers, so a standing can move in both directions', () => {
    // A domain where every total qualified for the same tier would make every
    // count in this file zero for a reason that has nothing to do with the
    // subject — the empty-domain vacuity CLAUDE.md keeps recording.
    //
    // Reddens on: narrowing the totals band until it stops crossing a
    // requirement.
    const tiers = WINDOW_OFFERS.map((offer) =>
      offer.total === null ? null : careerStanding(
        { results: [{ slotId: offer.slot.slotId, tier: offer.slot.tier, federationId: offer.slot.federationId, dayIndex: offer.slot.dayIndex, total: offer.total, bodyweightKg: offer.bodyweightKg } as CareerMeetResult<TestTotal>] },
        CATEGORY,
        GATE,
      ).qualifiedTier,
    );
    expect(new Set(tiers).size).toBeGreaterThan(1);
    expect(tiers).toEqual([
      'nationals',
      'worlds',
      'nationals',
      'nationals',
      'local',
      'nationals',
      'regional',
      'worlds',
      'regional',
      'local',
      'regional',
      'local',
    ]);
  });

  it('has a seeded domain that actually records meets', () => {
    // The seeded sweep's non-vacuity denominator, taken before the sweep: a
    // baseline set that recorded nothing would make every count below zero.
    let contested = 0;
    for (const seed of CAREER_ENGAGEMENT_SWEEP.SEEDS) {
      for (const baseline of seededBaselines(
        seed,
        CAREER_ENGAGEMENT_SWEEP.SEEDED_OFFERS,
        CAREER_ENGAGEMENT_SWEEP.SEEDED_TRIALS,
      )) {
        contested += meetsTaken(baseline);
      }
    }
    expect(contested).toBe(1831);
  });
});

// ===========================================================================
// The standing math on its own
// ===========================================================================

describe('an extra meet on the record never lowers standing', () => {
  it(
    'is zero on the exhaustive window, against two non-zero controls',
    () => {
      // THE HEADLINE. Element-wise by day and field, over every attendance
      // pattern of twelve meets and every meet each could add.
      //
      // Reddens on: `standingOver` overwriting the qualified tier on every
      // result rather than only on a higher one; on `careerStanding` reading
      // the last result rather than the record; on `standingAsOf` ignoring its
      // day. Each of those is one of the controls below, and each is non-zero.
      const shipped = sweepOver(
        runner('record', WINDOW_INPUTS, shippedCareerStandingWiring(), SHIPPED_CAREER_ENTRY_MODEL),
        WINDOW_BASELINES,
      );
      expect(shipped.violatingPairs).toBe(0);
      expect(shipped.total.violations).toBe(0);
      expect(shipped.total.byField).toEqual({
        qualifiedRank: 0,
        competedRank: 0,
        meetsCompleted: 0,
      });
      expect(shipped.total.worstDeficit).toBe(0);
      expect(shipped.total.worstLatenessDays).toBe(0);

      // The domain those zeros are zeros over, pinned as counts.
      expect(shipped.pairs).toBe(24576);
      expect(shipped.total.elements).toBe(8921088);
      // And the two runs really did differ: 2.7 million elements moved, so the
      // comparator was comparing something.
      expect(shipped.total.movedElements).toBe(2721401);

      // The controls, on the identical domain. Both are plausible ladder
      // designs and both punish the lifter who competed more.
      const latest = sweepOver(
        runner('record', WINDOW_INPUTS, LATEST_ONLY, SHIPPED_CAREER_ENTRY_MODEL),
        WINDOW_BASELINES,
      );
      expect(latest.violatingPairs).toBe(9769);
      expect(latest.total.violations).toBe(355670);
      expect(latest.total.byField).toEqual({
        qualifiedRank: 217902,
        competedRank: 137768,
        meetsCompleted: 0,
      });
      expect(latest.total.worstDeficit).toBe(3);
      expect(latest.total.worstLatenessDays).toBe(100);
      expect(latest.pairs).toBe(shipped.pairs);

      const window = sweepOver(
        runner('record', WINDOW_INPUTS, LAST_N, SHIPPED_CAREER_ENTRY_MODEL),
        WINDOW_BASELINES,
      );
      expect(window.violatingPairs).toBe(9451);
      expect(window.total.violations).toBe(326638);
      expect(window.total.byField).toEqual({
        qualifiedRank: 279182,
        competedRank: 47456,
        meetsCompleted: 0,
      });
      expect(window.pairs).toBe(shipped.pairs);
    },
    SWEEP_TIMEOUT_MS,
  );

  it(
    'is zero on the seeded sweep too, at twice the horizon',
    () => {
      // A longer calendar with twenty offers, drawn rather than enumerated, so
      // the window's zero is not a fact about twelve meets.
      let shipped = { pairs: 0, violatingPairs: 0, recorded: 0, total: noComparisons() };
      let latest = { pairs: 0, violatingPairs: 0, recorded: 0, total: noComparisons() };
      let rolling = { pairs: 0, violatingPairs: 0, recorded: 0, total: noComparisons() };
      const add = (into: SweepResult, got: SweepResult): SweepResult => ({
        pairs: into.pairs + got.pairs,
        violatingPairs: into.violatingPairs + got.violatingPairs,
        recorded: into.recorded + got.recorded,
        total: addComparisons(into.total, got.total),
      });

      for (const seed of CAREER_ENGAGEMENT_SWEEP.SEEDS) {
        const offers = offersFor(
          seed,
          CAREER_ENGAGEMENT_SWEEP.SEEDED_OFFERS,
          CAREER_ENGAGEMENT_SWEEP.SEEDED_HORIZON_DAYS,
        );
        const inputs = inputsFor(offers, CAREER_ENGAGEMENT_SWEEP.SEEDED_HORIZON_DAYS);
        const baselines = seededBaselines(
          seed,
          CAREER_ENGAGEMENT_SWEEP.SEEDED_OFFERS,
          CAREER_ENGAGEMENT_SWEEP.SEEDED_TRIALS,
        );
        shipped = add(
          shipped,
          sweepOver(
            runner('record', inputs, shippedCareerStandingWiring(), SHIPPED_CAREER_ENTRY_MODEL),
            baselines,
          ),
        );
        latest = add(
          latest,
          sweepOver(runner('record', inputs, LATEST_ONLY, SHIPPED_CAREER_ENTRY_MODEL), baselines),
        );
        rolling = add(
          rolling,
          sweepOver(runner('record', inputs, LAST_N, SHIPPED_CAREER_ENTRY_MODEL), baselines),
        );
      }

      expect(shipped.violatingPairs).toBe(0);
      expect(shipped.total.violations).toBe(0);
      expect(shipped.total.worstDeficit).toBe(0);
      // Counts, not bounds, on both denominators.
      expect(shipped.pairs).toBe(1769);
      expect(shipped.total.elements).toBe(1278987);
      expect(shipped.total.movedElements).toBe(379504);
      // And the sweep really banked meets: 19082 results across the pairs.
      expect(shipped.recorded).toBe(19082);

      expect(latest.violatingPairs).toBe(751);
      expect(latest.total.violations).toBe(23883);
      expect(latest.total.worstDeficit).toBe(4);
      expect(latest.total.worstLatenessDays).toBe(164);
      expect(rolling.violatingPairs).toBe(693);
      expect(rolling.total.violations).toBe(26065);
      expect(rolling.pairs).toBe(shipped.pairs);
    },
    SWEEP_TIMEOUT_MS,
  );
});

// ===========================================================================
// The whole loop, where it is not zero
// ===========================================================================

describe('an extra meet entered through the calendar CAN lower standing', () => {
  it(
    'is 5124 of 24576 pairs, and the entry gap is all of it',
    () => {
      // THE FINDING. Not clamped, not smoothed, and diagnosed by a control
      // rather than by an argument: the same loop with the between-meets gap
      // switched off is zero, so every violating pair is
      // `MIN_DAYS_BETWEEN_ENTERED_MEETS` spending a window a later, bigger
      // meet needed.
      //
      // Reddens on: the count moving in either direction — lowering the gap,
      // letting a higher tier override it, or `runEntryPlan` no longer
      // carrying the standing forward.
      const shipped = sweepOver(
        runner('plan', WINDOW_INPUTS, shippedCareerStandingWiring(), SHIPPED_CAREER_ENTRY_MODEL),
        WINDOW_BASELINES,
      );
      expect(shipped.violatingPairs).toBe(5124);
      expect(shipped.pairs).toBe(24576);
      expect(shipped.total.violations).toBe(386612);
      expect(shipped.total.byField).toEqual({
        qualifiedRank: 183776,
        competedRank: 201888,
        meetsCompleted: 948,
      });
      // Two rungs at worst, and up to 107 consecutive days spent below the
      // lifter who competed less. The magnitudes are the reason this is
      // reported rather than filed as a rounding error.
      expect(shipped.total.worstDeficit).toBe(2);
      expect(shipped.total.worstLatenessDays).toBe(107);

      // The attribution, as a control on the identical domain.
      const noGap = sweepOver(
        runner('plan', WINDOW_INPUTS, shippedCareerStandingWiring(), 'no-gap'),
        WINDOW_BASELINES,
      );
      expect(noGap.violatingPairs).toBe(0);
      expect(noGap.total.violations).toBe(0);
      expect(noGap.pairs).toBe(shipped.pairs);
      // The control is not zero because it did nothing: it moved MORE elements
      // than the shipped arm, because it enters the meets the gap refuses.
      expect(noGap.total.movedElements).toBe(2768015);
      expect(noGap.total.movedElements).toBeGreaterThan(shipped.total.movedElements);
    },
    SWEEP_TIMEOUT_MS,
  );

  it(
    'is 258 of 1769 seeded pairs, with the same control at zero',
    () => {
      let shipped = { pairs: 0, violatingPairs: 0, recorded: 0, total: noComparisons() };
      let noGap = { pairs: 0, violatingPairs: 0, recorded: 0, total: noComparisons() };
      const add = (into: SweepResult, got: SweepResult): SweepResult => ({
        pairs: into.pairs + got.pairs,
        violatingPairs: into.violatingPairs + got.violatingPairs,
        recorded: into.recorded + got.recorded,
        total: addComparisons(into.total, got.total),
      });

      for (const seed of CAREER_ENGAGEMENT_SWEEP.SEEDS) {
        const offers = offersFor(
          seed,
          CAREER_ENGAGEMENT_SWEEP.SEEDED_OFFERS,
          CAREER_ENGAGEMENT_SWEEP.SEEDED_HORIZON_DAYS,
        );
        const inputs = inputsFor(offers, CAREER_ENGAGEMENT_SWEEP.SEEDED_HORIZON_DAYS);
        const baselines = seededBaselines(
          seed,
          CAREER_ENGAGEMENT_SWEEP.SEEDED_OFFERS,
          CAREER_ENGAGEMENT_SWEEP.SEEDED_TRIALS,
        );
        shipped = add(
          shipped,
          sweepOver(
            runner('plan', inputs, shippedCareerStandingWiring(), SHIPPED_CAREER_ENTRY_MODEL),
            baselines,
          ),
        );
        noGap = add(
          noGap,
          sweepOver(runner('plan', inputs, shippedCareerStandingWiring(), 'no-gap'), baselines),
        );
      }

      expect(shipped.violatingPairs).toBe(258);
      expect(shipped.pairs).toBe(1769);
      expect(shipped.total.violations).toBe(38472);
      expect(shipped.total.byField).toEqual({
        qualifiedRank: 12693,
        competedRank: 25388,
        meetsCompleted: 391,
      });
      expect(shipped.total.worstDeficit).toBe(4);
      expect(shipped.total.worstLatenessDays).toBe(227);

      expect(noGap.violatingPairs).toBe(0);
      expect(noGap.total.violations).toBe(0);
      // The gap really is refusing meets: the control banks nearly twice as
      // many results over the same plans.
      expect(shipped.recorded).toBe(9706);
      expect(noGap.recorded).toBe(18684);
    },
    SWEEP_TIMEOUT_MS,
  );

  it('shows the mechanism on one pair, in full', () => {
    // The 5124 as one legible case, so the count above is not the only
    // evidence for the diagnosis. Two meets sit on day 21, a local and a
    // regional. A lifter who takes the local one spends the window the
    // regional needed, and both of them competed the same NUMBER of times —
    // the extra meet did not add a meet, it swapped a bigger one for a
    // smaller.
    //
    // Reddens on: `MIN_DAYS_BETWEEN_ENTERED_MEETS` dropping below the gap
    // between day 7 and day 21, or `runEntryPlan` not consulting eligibility.
    const opener = WINDOW_OFFERS[0] as CareerMeetOffer<TestTotal>;
    const sameDayLocal = WINDOW_OFFERS[2] as CareerMeetOffer<TestTotal>;
    const regional = WINDOW_OFFERS[3] as CareerMeetOffer<TestTotal>;
    expect([opener.slot.tier, opener.slot.dayIndex]).toEqual(['local', 7]);
    expect([sameDayLocal.slot.tier, sameDayLocal.slot.dayIndex]).toEqual(['local', 21]);
    expect([regional.slot.tier, regional.slot.dayIndex]).toEqual(['regional', 21]);

    const patient = WINDOW_OFFERS.map((_, index) => index === 0 || index === 3);
    const eager = withExtraMeet(patient, 2);
    const less = runEntryPlan(WINDOW_INPUTS, patient);
    const more = runEntryPlan(WINDOW_INPUTS, eager);

    expect(less.census.planned).toBe(2);
    expect(less.census.entered).toBe(2);
    expect(more.census.planned).toBe(3);
    expect(more.census.entered).toBe(2);
    expect(more.census.refusedEntries).toBe(1);
    expect(less.record.results.map((result) => result.tier)).toEqual(['local', 'regional']);
    expect(more.record.results.map((result) => result.tier)).toEqual(['local', 'local']);

    // And they pay for it in standing, from day 21 to the horizon.
    const comparison = compareCareerEngagement(less, more);
    expect(comparison.violations).toBeGreaterThan(0);
    expect(comparison.byField.competedRank).toBe(100);
    expect(comparison.worstDeficit).toBe(1);
    expect(comparison.worstLatenessDays).toBe(0);
  });
});

// ===========================================================================
// The instruments themselves
// ===========================================================================

describe('the standing models', () => {
  it('names one shipped model and two controls', () => {
    expect([...CAREER_STANDING_WIRINGS]).toEqual([
      'shipped',
      'latest-result-only',
      'last-n-results',
    ]);
    expect(CAREER_STANDING_WIRINGS).toContain(SHIPPED_CAREER_STANDING_WIRING);
    expect(windowsResults('shipped')).toBe(false);
    expect(windowsResults('latest-result-only')).toBe(true);
    expect(windowsResults('last-n-results')).toBe(true);
  });

  it('refuses a dial on a model with nothing to turn, and a model with nothing set', () => {
    // A control whose dial is set on the shipped model would be the subject
    // quietly running under a control's arithmetic.
    //
    // Reddens on: dropping any of the three guards in `careerStandingWiring`.
    expect(shippedCareerStandingWiring()).toEqual({ key: 'shipped', recentResults: 0 });
    expect(() => careerStandingWiring('shipped', 1)).toThrow(/windows nothing/);
    expect(() => careerStandingWiring('latest-result-only', 2)).toThrow(/window of one/);
    expect(() => careerStandingWiring('last-n-results', 0)).toThrow(/models nothing/);
    expect(() => careerStandingWiring('last-n-results', 1.5)).toThrow(/whole number/);
    expect(() => careerStandingWiring('last-n-results', -1)).toThrow(/whole number/);
    expect(careerStandingWiring('last-n-results', 3).recentResults).toBe(3);
  });

  it('counts the results each model looks at', () => {
    const results = [7, 21, 35].map(
      (dayIndex) =>
        ({
          slotId: `s${dayIndex}`,
          tier: 'local',
          federationId: FED.id,
          dayIndex,
          total: kg(500),
          bodyweightKg: CAREER_ENGAGEMENT_SWEEP.BODYWEIGHT_KG,
        }) as CareerMeetResult<TestTotal>,
    );
    expect(resultsUnder(shippedCareerStandingWiring(), results)).toHaveLength(3);
    expect(resultsUnder(LATEST_ONLY, results).map((r) => r.dayIndex)).toEqual([35]);
    expect(resultsUnder(LAST_N, results).map((r) => r.dayIndex)).toEqual([21, 35]);
    // A window wider than the record is the whole record, not a padded one.
    expect(resultsUnder(careerStandingWiring('last-n-results', 9), results)).toHaveLength(3);
  });

  it('reads a day’s standing the same way the fast path does', () => {
    // `readingsFor` walks prefixes; `standingUnder` re-filters the record on
    // every day. They are different arithmetic over the same subject, and the
    // prefix indexing is the part that could be off by one.
    //
    // Reddens on: `readingsFor`'s `<=` becoming `<`, which shifts every
    // reading a day late.
    const run = runRecordHistory(WINDOW_INPUTS, WINDOW_BASELINES[2731] as readonly boolean[]);
    let checked = 0;
    for (const reading of run.readings) {
      const definitional = standingUnder(
        shippedCareerStandingWiring(),
        run.record,
        reading.dayIndex,
        CATEGORY,
        GATE,
      );
      expect(reading.qualifiedRank, `day ${reading.dayIndex}`).toBe(
        standingRank(definitional.qualifiedTier),
      );
      expect(reading.competedRank).toBe(standingRank(definitional.highestTierCompeted));
      expect(reading.meetsCompleted).toBe(definitional.meetsCompleted);
      checked += 1;
    }
    expect(checked).toBe(CAREER_ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS + 1);
    // The baseline used is not the empty one, so the walk had something to
    // index past.
    expect(run.census.recorded).toBeGreaterThan(0);
    expect(run.census.recorded).toBe(7);
  });
});

describe('a pair differs in exactly one meet', () => {
  it('refuses to build a pair that differs in nothing', () => {
    // The precondition of the whole measurement, held by the constructor
    // rather than by a caller remembering.
    //
    // Reddens on: dropping either guard in `withExtraMeet`.
    const attendance = [false, true, false];
    expect(withExtraMeet(attendance, 0)).toEqual([true, true, false]);
    expect(() => withExtraMeet(attendance, 1)).toThrow(/already contested/);
    expect(() => withExtraMeet(attendance, 3)).toThrow(/off a list/);
    expect(meetsTaken(attendance)).toBe(1);
    expect(meetsTaken(withExtraMeet(attendance, 0))).toBe(2);
  });
});

describe('the comparator', () => {
  const reading = (
    dayIndex: number,
    qualifiedRank: number,
    competedRank: number,
    meetsCompleted: number,
  ): CareerStandingReading => ({ dayIndex, qualifiedRank, competedRank, meetsCompleted });

  const runOf = (readings: readonly CareerStandingReading[]): CareerEngagementRun<TestTotal> =>
    ({
      wiring: shippedCareerStandingWiring(),
      record: { results: [] },
      readings,
      census: {
        offers: 0,
        planned: 0,
        entered: 0,
        refusedEntries: 0,
        recorded: 0,
        totalsPosted: 0,
        bombOuts: 0,
        days: readings.length,
        topQualifiedRank: -1,
        topCompetedRank: -1,
      },
    }) as CareerEngagementRun<TestTotal>;

  it('counts an element where the more-engaged lifter is lower, and only that', () => {
    // Reddens on: `compareCareerEngagement` counting a difference rather than
    // a deficit, which would make every improvement a violation too.
    const less = runOf([reading(0, 1, 1, 1), reading(1, 1, 1, 1)]);
    const better = runOf([reading(0, 2, 1, 1), reading(1, 2, 2, 2)]);
    const worse = runOf([reading(0, 0, 1, 1), reading(1, 1, 1, 0)]);

    const improved = compareCareerEngagement(less, better);
    expect(improved.violations).toBe(0);
    expect(improved.movedElements).toBe(4);
    expect(improved.elements).toBe(6);

    const punished = compareCareerEngagement(less, worse);
    expect(punished.violations).toBe(2);
    expect(punished.byField).toEqual({ qualifiedRank: 1, competedRank: 0, meetsCompleted: 1 });
    expect(punished.violatingDays).toBe(2);
    expect(punished.worstDeficit).toBe(1);
  });

  it('measures lateness as the longest unbroken run of days ranked below', () => {
    // Reddens on: `worstLatenessDays` counting total days rather than the
    // longest run, or not resetting when the lifter catches up.
    const less = runOf([0, 1, 2, 3, 4, 5].map((day) => reading(day, 2, 0, 0)));
    const late = runOf([
      reading(0, 2, 0, 0),
      reading(1, 1, 0, 0),
      reading(2, 1, 0, 0),
      reading(3, 2, 0, 0),
      reading(4, 1, 0, 0),
      reading(5, 2, 0, 0),
    ]);
    const comparison = compareCareerEngagement(less, late);
    expect(comparison.worstLatenessDays).toBe(2);
    expect(comparison.byField.qualifiedRank).toBe(3);
    expect(comparison.violatingDays).toBe(3);
  });

  it('refuses two runs over different horizons', () => {
    expect(() => compareCareerEngagement(runOf([reading(0, 0, 0, 0)]), runOf([]))).toThrow(
      /not comparable/,
    );
  });

  it('adds up, from an identity that adds nothing', () => {
    const empty = noComparisons();
    expect(empty.elements).toBe(0);
    const one = compareCareerEngagement(
      runOf([reading(0, 1, 1, 1)]),
      runOf([reading(0, 0, 1, 1)]),
    );
    expect(addComparisons(empty, one)).toEqual(one);
    const twice = addComparisons(one, one);
    expect(twice.violations).toBe(one.violations * 2);
    expect(twice.elements).toBe(one.elements * 2);
    // The two maxima are maxima, not sums.
    expect(twice.worstDeficit).toBe(one.worstDeficit);
    expect(twice.worstLatenessDays).toBe(one.worstLatenessDays);
  });

  it('reads every field it declares', () => {
    expect([...CAREER_STANDING_FIELDS]).toEqual([
      'qualifiedRank',
      'competedRank',
      'meetsCompleted',
    ]);
    // Each field is separately reachable, so none of the three is dead.
    const less = runOf([reading(0, 1, 1, 1)]);
    let reached = 0;
    for (const field of CAREER_STANDING_FIELDS) {
      const lowered = runOf([
        reading(
          0,
          field === 'qualifiedRank' ? 0 : 1,
          field === 'competedRank' ? 0 : 1,
          field === 'meetsCompleted' ? 0 : 1,
        ),
      ]);
      expect(compareCareerEngagement(less, lowered).byField[field], field).toBe(1);
      reached += 1;
    }
    expect(reached).toBe(CAREER_STANDING_FIELDS.length);
  });
});

describe('the two runs', () => {
  it('records every contested offer when there is no calendar in the way', () => {
    const attendance = WINDOW_OFFERS.map(() => true);
    const run = runRecordHistory(WINDOW_INPUTS, attendance);
    expect(run.census.recorded).toBe(WINDOW_OFFERS.length);
    expect(run.census.refusedEntries).toBe(0);
    expect(run.census.bombOuts).toBe(0);
    expect(run.census.totalsPosted).toBe(WINDOW_OFFERS.length);
    expect(run.census.days).toBe(CAREER_ENGAGEMENT_SWEEP.WINDOW_HORIZON_DAYS + 1);
    expect(run.census.topCompetedRank).toBe(standingRank('nationals'));
  });

  it('refuses an attendance that does not fit the offers', () => {
    expect(() => runRecordHistory(WINDOW_INPUTS, [true])).toThrow(/does not fit/);
    expect(() => runEntryPlan(WINDOW_INPUTS, [true])).toThrow(/does not fit/);
  });

  it('lets the calendar refuse a planned meet, and counts the refusals', () => {
    // Reddens on: `runEntryPlan` entering without consulting `meetEligibility`,
    // which would make `refusedEntries` zero everywhere and the whole finding
    // above disappear.
    const everything = WINDOW_OFFERS.map(() => true);
    const planned = runEntryPlan(WINDOW_INPUTS, everything);
    expect(planned.census.planned).toBe(WINDOW_OFFERS.length);
    expect(planned.census.entered).toBe(4);
    expect(planned.census.refusedEntries).toBe(8);
    expect(planned.record.results.map((result) => result.dayIndex)).toEqual([7, 21, 35, 49]);
  });

  it('runs the no-gap control on the same plan and enters more', () => {
    // The control is a control: it differs from the shipped model, in the one
    // direction it is documented to differ in.
    //
    // Reddens on: `asAsked` returning the lifter unchanged for `'no-gap'`,
    // which would make the zero above a duplicate of the shipped run rather
    // than an attribution.
    const everything = WINDOW_OFFERS.map(() => true);
    const shipped = runEntryPlan(WINDOW_INPUTS, everything);
    const noGap = runEntryPlan(WINDOW_INPUTS, everything, shippedCareerStandingWiring(), 'no-gap');
    expect(noGap.census.entered).toBe(12);
    expect(noGap.census.refusedEntries).toBe(0);
    expect(noGap.census.entered).toBeGreaterThan(shipped.census.entered);
    expect([...CAREER_ENTRY_MODELS]).toEqual(['shipped', 'no-gap']);
    expect(SHIPPED_CAREER_ENTRY_MODEL).toBe('shipped');
  });

  it('carries the standing forward into the next meet’s gate', () => {
    // The loop, not two loops: a total posted at meet one is what admits the
    // lifter to a gated meet later. Without it a plan could never reach a
    // gated tier at all, and the whole `plan` sweep would be a local-only
    // domain.
    //
    // Reddens on: `runEntryPlan` dropping its `lifterWithStanding` call — the
    // nationals meet on day 49 stops being entered.
    const plan = WINDOW_OFFERS.map((offer) => offer.slot.tier === 'nationals' || offer.slot.dayIndex === 7);
    const run = runEntryPlan(WINDOW_INPUTS, plan);
    expect(run.record.results.map((result) => result.tier)).toEqual(['local', 'nationals']);
    expect(run.census.topCompetedRank).toBe(standingRank('nationals'));
  });

  it('answers whether the calendar would admit one offer', () => {
    const fresh = createCareerLifter<TestTotal>(FED.id, CATEGORY);
    const local = WINDOW_OFFERS[0] as CareerMeetOffer<TestTotal>;
    const nationals = WINDOW_OFFERS[10] as CareerMeetOffer<TestTotal>;
    expect(admitsOffer(WINDOW_INPUTS, fresh, local)).toBe(true);
    expect(admitsOffer(WINDOW_INPUTS, fresh, nationals)).toBe(false);
  });
});
