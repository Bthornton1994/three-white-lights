/**
 * empireSweep.test.ts — the parameters of piece E6's measurement, written down.
 *
 * ===========================================================================
 * Why this file exists at all
 * ===========================================================================
 *
 * `src/game/streakSweep.ts` is the house precedent and its own header gives the
 * reason: the first version of a measurement in this repository was reported
 * with its seeds unstated and could not afterwards be reproduced by anyone —
 * six plausible parameterisations gave six different numbers. A measurement
 * whose inputs are not written down is an anecdote.
 *
 * So every horizon, cadence, plan and social input the invariant sweep runs at
 * is a named constant in `EMPIRE_SWEEP` below, and the plan list is produced by
 * one deterministic generator rather than assembled at a call site.
 *
 * ===========================================================================
 * Why it carries a `.test.ts` suffix when it is mostly parameters
 * ===========================================================================
 *
 * `src/tuning/audit.ts` classifies every file under `src/empire/` that is not in
 * `SOURCE_RULES` as a `renderer`, and a `renderer` may hold no bare numeric
 * literal at all. `empireCore.test.ts` runs that audit over this directory from
 * inside this piece's own suite and pins the findings at zero for every shipped
 * module. A sweep parameter is not a game-feel value a playtester turns, so it
 * does not belong in `empireTuning.ts`; and a file named `empireSweep.ts` full
 * of horizons would fail the audit by name, line and literal.
 *
 * `expansion.test.ts`, `reputation.test.ts`, `npc.test.ts`, `social.test.ts` and
 * `production.test.ts` all resolve this the same way — their sweep blocks live
 * in their own test files, which the audit deliberately does not read. This file
 * is that convention with the block hoisted into its own module so two test
 * files can share one set of parameters instead of two that drift.
 *
 * The alternative is a `SOURCE_RULES` row registering `src/empire/empireSweep.ts`
 * as a constants module. That row is in another session's file and is written
 * out verbatim in this piece's report; if a human lands it, this file can be
 * renamed and its self-checks moved without any other change.
 *
 * The self-checks below are the non-vacuity guard on the generator itself: a
 * plan list that had gone empty, or a schedule that granted nothing inside the
 * shortest horizon, would make every zero in `empireInvariant.test.ts` a zero
 * about an accelerant that was never applied.
 */

import { describe, expect, it } from 'vitest';

import { PURCHASABLE_ACCELERANTS } from './empireCore';
import {
  grantSecondsAt,
  type AccelerantPlan,
  type EmpirePolicy,
  type SocialInputs,
} from './empireInvariant';
import { asCalendarDay, type Encouragement } from './social';

// ---------------------------------------------------------------------------
// The parameters
// ---------------------------------------------------------------------------

export const EMPIRE_SWEEP = Object.freeze({
  /**
   * The horizons the ledgers are compared at, in calendar days.
   *
   * Ascending, and the longest is a hundred days because that is the length GDD
   * §4.4 reports every streak measurement at, so a number taken here is
   * comparable with one taken there.
   */
  HORIZON_DAYS: Object.freeze([7, 30, 60, 100] as const),

  /**
   * Check-ins per calendar day at the ordinary cadence. Six is a four-hour gap,
   * inside GDD §5.1's offline horizon, which is the cadence piece E4's chain
   * measurement ran at.
   */
  CHECK_INS_PER_DAY: 6,

  /**
   * The horizons the dense cadence runs at. Shorter, because the run cost is
   * the product of the two.
   */
  DENSE_HORIZON_DAYS: Object.freeze([7, 14] as const),

  /**
   * Check-ins per day at the dense cadence: a fifteen-minute gap.
   *
   * This row exists for one measured reason. At the ordinary cadence every
   * build in `EMPIRE_TUNING`'s ladders finishes inside one check-in gap, so no
   * build is ever IN FLIGHT when a grant lands and `skipExpansion` is never
   * reached — `EmpireRunCensus.idleBuildSkips` is zero across the whole
   * ordinary sweep. One of the two mechanisms GDD §8.3B sells would therefore
   * have been an empty domain. At fifteen minutes the upper rungs of the space
   * and staff ladders outlast a gap and the mechanism fires; the sweep pins
   * that it did.
   */
  DENSE_CHECK_INS_PER_DAY: 96,

  /**
   * The order the simulated player offers a level-up to each axis, rotated one
   * step per check-in so no axis starves.
   *
   * Physio is last deliberately: it is the axis whose only effect reaches Sim
   * progression, so putting it behind every cheaper rung is the arrangement in
   * which money binds hardest on it — which is the arrangement chain C is most
   * visible in, and the counterfactual measures chain C.
   */
  AXIS_ORDER: Object.freeze(['space', 'spotter', 'coach', 'equipment', 'physio'] as const),

  /** Which GDD §5.5 metric the rival comparison ranks on. */
  LEADERBOARD_METRIC: 'reputation',

  /** Timer-skip grants applied at one check-in. Zero is the baseline's row. */
  GRANTS_PER_CHECK_IN: Object.freeze([1, 2, 4] as const),

  /**
   * Application schedules, as (first check-in, cadence) pairs.
   *
   * Two rows rather than one: a grant on every check-in from the first, which is
   * the heaviest spender, and a grant every fifth check-in from the seventh,
   * which is a player who buys occasionally and starts after the gym is
   * running. §4.4's own finding was about a purchase SCHEDULE moving, so a
   * single schedule would be one point of a domain.
   */
  SCHEDULES: Object.freeze([
    Object.freeze({ firstCheckIn: 1, everyNthCheckIn: 1 } as const),
    Object.freeze({ firstCheckIn: 7, everyNthCheckIn: 5 } as const),
  ] as const),

  /** Account creation, as a calendar day. Anchors every §5.5 period. */
  ANCHOR_DAY: 0,

  /** The supplied rival's reputation. A number the gym passes partway through. */
  RIVAL_REPUTATION: 400,

  /**
   * The days encouragements arrive on, and the sender each arrives from.
   *
   * Fixed calendar days with fixed senders, which is the shape GDD §8.3C
   * measured at zero violating pairs. Two on day 5 from the same sender, so the
   * one-payout-per-distinct-sender rule in `encouragementGymBucksOn` is inside
   * the domain rather than assumed.
   */
  ENCOURAGEMENT_DAYS: Object.freeze([2, 5, 5, 11, 23, 47] as const),

  /**
   * The player history the social layer is handed and reads none of. GDD §8.3C
   * measured every one of these as unsafe to key a reward to; they are carried
   * so a future edit that reads one is inside a swept function.
   */
  SESSION_COUNT: 40,
  STREAK_DAYS: 12,
  PASS_TIERS_UNLOCKED: 3,
  TRAINED_DAYS: Object.freeze([1, 3, 4, 8, 13, 21, 34, 55] as const),
} as const);

// ---------------------------------------------------------------------------
// The deterministic generators
// ---------------------------------------------------------------------------

/** The baseline every comparison is taken against: no accelerant, ever. */
export const BASELINE_PLAN: AccelerantPlan = Object.freeze({
  accelerant: null,
  grantsPerCheckIn: 0,
  firstCheckIn: 1,
  everyNthCheckIn: 1,
});

/**
 * Every plan the sweep drives, in a fixed order.
 *
 * The accelerant axis is `PURCHASABLE_ACCELERANTS`, which `empireCore.ts`
 * derives from its own arrival table through its own predicate — so a
 * purchasable accelerant added later is swept without this file being edited,
 * and the count pin below is what says one arrived.
 */
export function accelerantPlans(): readonly AccelerantPlan[] {
  const plans: AccelerantPlan[] = [BASELINE_PLAN];
  for (const accelerant of PURCHASABLE_ACCELERANTS) {
    for (const grantsPerCheckIn of EMPIRE_SWEEP.GRANTS_PER_CHECK_IN) {
      for (const schedule of EMPIRE_SWEEP.SCHEDULES) {
        plans.push(
          Object.freeze({
            accelerant,
            grantsPerCheckIn,
            firstCheckIn: schedule.firstCheckIn,
            everyNthCheckIn: schedule.everyNthCheckIn,
          }),
        );
      }
    }
  }
  return Object.freeze(plans);
}

/** The policy at a cadence. Everything else is the same on both cadences. */
export function policyAt(checkInsPerDay: number): EmpirePolicy {
  return Object.freeze({
    checkInsPerDay,
    axisOrder: [...EMPIRE_SWEEP.AXIS_ORDER],
    leaderboardMetric: 'reputation',
  });
}

/** The §5.5 surroundings every run is given. Fixed, supplied, and never chosen. */
export function socialInputs(): SocialInputs {
  const encouragementsReceived: Encouragement[] = EMPIRE_SWEEP.ENCOURAGEMENT_DAYS.map((day, at) =>
    Object.freeze({
      day: asCalendarDay(EMPIRE_SWEEP.ANCHOR_DAY + day),
      // Two of the six share a sender, so the one-payout-per-sender rule is in
      // the domain. The index is halved to produce the repeat.
      fromGymId: `friend-gym-${Math.floor(at / 2)}`,
    }),
  );
  return Object.freeze({
    calendar: Object.freeze({
      anchorDay: asCalendarDay(EMPIRE_SWEEP.ANCHOR_DAY),
      trainedDays: Object.freeze(
        EMPIRE_SWEEP.TRAINED_DAYS.map((day) => asCalendarDay(EMPIRE_SWEEP.ANCHOR_DAY + day)),
      ),
      sessionCount: EMPIRE_SWEEP.SESSION_COUNT,
      streakDays: EMPIRE_SWEEP.STREAK_DAYS,
      passTiersUnlocked: EMPIRE_SWEEP.PASS_TIERS_UNLOCKED,
    }),
    rival: Object.freeze({
      gymId: 'rival-gym',
      displayName: 'Placeholder',
      reputation: EMPIRE_SWEEP.RIVAL_REPUTATION,
      combinedTotalKg: 0,
    }),
    encouragementsReceived: Object.freeze(encouragementsReceived),
  });
}

// ---------------------------------------------------------------------------
// The non-vacuity guard on the generator itself
// ---------------------------------------------------------------------------

describe('the sweep parameters describe a domain that is not empty', () => {
  it('generates the plan list it says it does, counts and all', () => {
    const plans = accelerantPlans();
    // Counts, not bounds. A generator that returned an empty list, or one that
    // returned only the baseline, would make every zero in
    // `empireInvariant.test.ts` a zero over nothing.
    expect(plans.length).toBe(
      1 +
        PURCHASABLE_ACCELERANTS.length *
          EMPIRE_SWEEP.GRANTS_PER_CHECK_IN.length *
          EMPIRE_SWEEP.SCHEDULES.length,
    );
    expect(plans.length).toBe(13);
    expect(plans.filter((plan) => plan.accelerant === null).length).toBe(1);
    expect(plans[0]).toBe(BASELINE_PLAN);
    // Every purchasable accelerant is really driven, and the same number of
    // times, so a plan list that had quietly dropped one is red.
    for (const accelerant of PURCHASABLE_ACCELERANTS) {
      expect(plans.filter((plan) => plan.accelerant === accelerant).length).toBe(6);
    }
    expect(PURCHASABLE_ACCELERANTS.length).toBe(2);
    // And no two plans are the same plan.
    expect(new Set(plans.map((plan) => JSON.stringify(plan))).size).toBe(plans.length);
  });

  it('grants something inside the shortest horizon on every non-baseline plan', () => {
    // The empty-domain guard that matters most: a schedule whose first check-in
    // falls outside the shortest horizon would make that horizon's comparison a
    // comparison of a plan against itself.
    const shortest = Math.min(...EMPIRE_SWEEP.HORIZON_DAYS, ...EMPIRE_SWEEP.DENSE_HORIZON_DAYS);
    const checkIns = shortest * EMPIRE_SWEEP.CHECK_INS_PER_DAY;
    let grantedPlans = 0;
    let baselinePlans = 0;
    let totalGrants = 0;
    for (const plan of accelerantPlans()) {
      let granted = 0;
      for (let checkIn = 1; checkIn <= checkIns; checkIn += 1) {
        if (grantSecondsAt(plan, checkIn) > 0) granted += 1;
      }
      if (plan.accelerant === null) {
        expect(granted).toBe(0);
        baselinePlans += 1;
        continue;
      }
      expect(granted).toBeGreaterThan(0);
      grantedPlans += 1;
      totalGrants += granted;
    }
    expect(shortest).toBe(7);
    expect(checkIns).toBe(42);
    expect(baselinePlans).toBe(1);
    expect(grantedPlans).toBe(12);
    // The measured total, pinned rather than bounded: six plans grant on all 42
    // check-ins and six grant on eight of them.
    expect(totalGrants).toBe(6 * 42 + 6 * 8);
    expect(totalGrants).toBe(300);
  });

  it('describes horizons and cadences that ascend and are whole', () => {
    const horizons = [...EMPIRE_SWEEP.HORIZON_DAYS];
    expect(horizons).toEqual([...horizons].sort((left, right) => left - right));
    expect(new Set(horizons).size).toBe(horizons.length);
    expect(horizons.length).toBe(4);
    const dense = [...EMPIRE_SWEEP.DENSE_HORIZON_DAYS];
    expect(dense).toEqual([...dense].sort((left, right) => left - right));
    expect(dense.length).toBe(2);
    // The dense cadence really is denser, or the row that exists to reach
    // `skipExpansion` reaches nothing the ordinary cadence does not.
    expect(EMPIRE_SWEEP.DENSE_CHECK_INS_PER_DAY).toBeGreaterThan(EMPIRE_SWEEP.CHECK_INS_PER_DAY);
    for (const cadence of [EMPIRE_SWEEP.CHECK_INS_PER_DAY, EMPIRE_SWEEP.DENSE_CHECK_INS_PER_DAY]) {
      expect(Number.isInteger(cadence)).toBe(true);
      expect(cadence).toBeGreaterThan(0);
    }
  });

  it('supplies social inputs that pay on more than one day and share a sender', () => {
    const social = socialInputs();
    expect(social.encouragementsReceived.length).toBe(6);
    expect(social.rival).not.toBeNull();
    // Distinct days and distinct senders, both counted, so the one-payout-per-
    // sender rule and the multi-day schedule are both in the domain.
    expect(new Set(social.encouragementsReceived.map((one) => one.day)).size).toBe(5);
    expect(new Set(social.encouragementsReceived.map((one) => one.fromGymId)).size).toBe(3);
    // The training-shaped fields are carried and are not zero, so a future edit
    // that reads one has something to read.
    expect(social.calendar.sessionCount).toBe(EMPIRE_SWEEP.SESSION_COUNT);
    expect(social.calendar.streakDays).toBe(EMPIRE_SWEEP.STREAK_DAYS);
    expect(social.calendar.passTiersUnlocked).toBe(EMPIRE_SWEEP.PASS_TIERS_UNLOCKED);
    expect(social.calendar.trainedDays.length).toBe(8);
  });

  it('names no real gym, lifter, brand or federation', () => {
    // GDD §12.3, applied to this file's own fixtures. The scan cannot tell a
    // real name from an invented one — that is the human pass — but a
    // `Capitalised Capitalised` pair is the shape a person's name takes, and
    // every id here is a kebab token.
    const social = socialInputs();
    const names = [
      social.rival?.gymId ?? '',
      social.rival?.displayName ?? '',
      ...social.encouragementsReceived.map((one) => one.fromGymId),
    ];
    expect(names.length).toBe(8);
    const personShaped = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;
    let checked = 0;
    for (const name of names) {
      expect(personShaped.test(name), `${name} is shaped like a person's name`).toBe(false);
      checked += 1;
    }
    expect(checked).toBe(names.length);
    // The pattern is not a dead letter, and the probe is derived from the
    // fixtures rather than written beside the pattern.
    expect(personShaped.test('Placeholder Placeholder')).toBe(true);
  });
});
