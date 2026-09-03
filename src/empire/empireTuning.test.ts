/**
 * Guards on the Gym Empire tuning block.
 *
 * `empireTuning.ts` is the one file a playtester edits for GDD §5, and §12.1
 * budgets roughly 30 hand passes over it. Everything below is a rule a hand
 * pass could plausibly break without breaking anything that looks related:
 *
 *   - a ladder that stops being monotone, so a tier is dominated by the one
 *     below it and nobody would ever buy it
 *   - a ceiling that is unreachable, so the top of an axis pays nothing, or one
 *     that binds at level zero, so the axis pays nothing at all
 *   - a table whose keys have drifted from the ladder they are keyed by
 *   - the physio hook growing until it needs the fatigue model's clamp to keep
 *     a setback from vanishing
 *   - an entry with no class, or a class nothing carries
 *
 * None of these says the values are right. No test can; GDD §12.1 is explicit
 * that feel tuning happens afterwards with people playing. They say the values
 * are still self-consistent and that the ladders still have the shape the file
 * claims they have.
 *
 * The physio section reads the real `FATIGUE_TUNING`, which is another
 * session's file. It is read and never written — the seam it targets
 * (`physioDaysSaved`, `INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO`) was frozen
 * before this piece existed.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FATIGUE_TUNING } from '../game/fatigue';
import { buildSeconds } from './empireCore';
import { shippedModuleNames } from './directoryWalk.test';
import {
  EMPIRE_TUNING,
  EMPIRE_TUNING_CLASSES,
  EMPIRE_TUNING_CLASSIFICATION,
  type EmpireTuningClass,
} from './empireTuning';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const T = EMPIRE_TUNING;

/** Strictly increasing, as a list of the pairs that broke it. */
function notIncreasing(values: readonly number[]): readonly string[] {
  const broken: string[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const previous = values[i - 1] as number;
    const current = values[i] as number;
    if (!(current > previous)) broken.push(`index ${i}: ${previous} -> ${current}`);
  }
  return broken;
}

/** The values of a per-tier table, in ladder order. */
function alongTiers(table: Readonly<Record<string, number>>, ladder: readonly string[]): number[] {
  return ladder.map((key) => table[key] as number);
}

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

describe('the block is frozen and every entry is classified', () => {
  it('freezes the block and its nested tables', () => {
    expect(Object.isFrozen(EMPIRE_TUNING)).toBe(true);
    expect(Object.isFrozen(EMPIRE_TUNING_CLASSIFICATION)).toBe(true);
    const nested = Object.entries(EMPIRE_TUNING).filter(([, value]) => typeof value === 'object');
    // Counts, not bounds — this file's own rule, and this line broke it. The
    // loop below walks whatever `nested` holds, so `toBeGreaterThan(0)` was
    // satisfied by one table out of eleven and every table that stopped being
    // an object walked past it. The names are pinned instead, so a table that
    // was flattened into a scalar, or a new one that arrived unfrozen, is a
    // decision somebody signs rather than a shrinking loop nobody sees.
    expect(nested.map(([key]) => key).sort()).toEqual([
      'ADVANCED_RECOVERY_ITEMS',
      'AMBIENT_MEMBER_COUNT_BY_RUNG',
      'AMBIENT_MEMBER_FOOTPRINT_TILES',
      'EQUIPMENT_TIERS',
      'EQUIPMENT_TIER_BUCKS_MULTIPLIER',
      'EQUIPMENT_TIER_COST_GYM_BUCKS',
      'FLEXIBLE_ACTIVITIES',
      'FLOOR_FIXED_FURNITURE_LAYOUT',
      'FLOOR_GRID_SIZE',
      'FLOOR_PLATE_LOADING',
      'FLOOR_SIM_USE_TICKS_BY_TYPE',
      // GDD §5.13 P4b — the per-use-class draw bias a `using` member is
      // pulled toward its station's anchor by.
      'FLOOR_SIM_USING_ANCHOR_BIAS',
      // GDD §5.13 presentation Phase 4 — the four sprite palettes, RGB
      // components as plain numbers so `floorSprites.ts` stays numerically
      // clean under the audit.
      'FLOOR_SPRITE_BODY_PALETTE',
      'FLOOR_SPRITE_FLOOR_PALETTE',
      'FLOOR_SPRITE_GEAR_PALETTE',
      'FLOOR_SPRITE_OUTFIT_PALETTE',
      'LADDER_DEV_TIME_STEPS_SECONDS',
      'LADDER_DEV_WATCHED_TIME_STEPS_SECONDS',
      'LADDER_EQUIPMENT_COST_GYM_BUCKS',
      'LADDER_EQUIPMENT_ITEMS',
      'LADDER_EQUIPMENT_MIN_RUNG',
      'LADDER_INCOME_GYM_BUCKS_PER_HOUR',
      'LADDER_LIFTS',
      'LADDER_LIFT_REQUIREMENTS',
      'LADDER_MOVE_COST_GYM_BUCKS',
      'LADDER_RUNGS',
      'LADDER_STARTING_EQUIPMENT',
      'LEADERBOARD_BRACKET_SIZE',
      'LEADERBOARD_SCOPES',
      'LIVING_MEMBER_SERVICE_HISTORY_WINDOWS', // Stage G.1
      // §5.11 stage 4's four per-tier manager tables and the tier ladder
      // itself. Read from this pin's own failure value.
      'MANAGER_AUTO_REPAIR_CONDITION',
      'MANAGER_HIRE_COST_GYM_BUCKS',
      'MANAGER_TIERS',
      'MANAGER_WAGE_GYM_BUCKS_PER_BANKED_HOUR',
      'MEMBER_DUES_GYM_BUCKS_PER_DAY',
      'MEMBER_TYPES',
      'MEMBER_TYPE_BARBELL_AFFINITY',
      'MEMBER_TYPE_CROWDING_LOAD_WEIGHT',
      'MEMBER_TYPE_CROWDING_SENSITIVITY',
      'MEMBER_TYPE_ITEM_AFFINITY',
      'MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY',
      'NPC_RECRUIT_COST_GYM_BUCKS',
      'NPC_RECRUIT_REPUTATION_THRESHOLD',
      'NPC_RECRUIT_SECONDS',
      'NPC_TIERS',
      'NPC_TIER_OUTPUT_MULTIPLIER',
      // GDD §5.14 Stage B's pacing simulator — the five report horizons.
      'PACING_REPORT_HORIZONS_SECONDS',
      'REPUTATION_TIER_THRESHOLDS',
      'SESSION_ACTIVITY_EQUIPMENT_GROUP',
      'SESSION_ACTIVITY_GROUPS',
      'SESSION_EQUIPMENT_CAPABILITY',
      'SESSION_EQUIPMENT_COST_GYM_BUCKS',
      'SESSION_EQUIPMENT_FOOTPRINT',
      'SESSION_EQUIPMENT_GROUP',
      'SESSION_EQUIPMENT_ITEMS',
      'SESSION_EQUIPMENT_MIN_RUNG',
      'SPACE_LEVEL_COST_GYM_BUCKS',
      'SPACE_PASSIVE_CEILING_MULTIPLIER',
      'SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER',
      'SPORTING_REPUTATION',
      'STAFF_LEVEL_COST_GYM_BUCKS',
      'STAFF_LEVEL_MAX',
      'STAFF_ROLES',
      'STATION_UPGRADE_AXES',
      'STATION_UPGRADE_COST_GYM_BUCKS',
      'STATION_UPGRADE_SLICE',
      'SUPPORT_ITEM_AMPLIFIER',
      'SUPPORT_ITEM_CHANNEL',
    ]);
    let frozen = 0;
    for (const [key, value] of nested) {
      expect(Object.isFrozen(value), `${key} is not frozen`).toBe(true);
      frozen += 1;
    }
    expect(frozen).toBe(nested.length);
    // And one level deeper, where the per-role cost ladders live.
    for (const role of T.STAFF_ROLES) {
      expect(Object.isFrozen(T.STAFF_LEVEL_COST_GYM_BUCKS[role]), role).toBe(true);
    }
  });

  it('classifies every entry, and classifies nothing that is not an entry', () => {
    const tuned = Object.keys(EMPIRE_TUNING).sort();
    const classified = Object.keys(EMPIRE_TUNING_CLASSIFICATION).sort();
    expect(classified).toEqual(tuned);
    for (const value of Object.values(EMPIRE_TUNING_CLASSIFICATION)) {
      expect(EMPIRE_TUNING_CLASSES).toContain(value);
    }
  });

  it('uses every class it declares, so the vocabulary is not aspirational', () => {
    // A class with no members is a distinction nobody is drawing. All four
    // carry weight: `refusal` in particular has to be non-empty or the file
    // has no §12.3 constants in it and the header is overstating itself.
    const counts = new Map<EmpireTuningClass, number>();
    for (const value of Object.values(EMPIRE_TUNING_CLASSIFICATION)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    for (const cls of EMPIRE_TUNING_CLASSES) {
      expect(counts.get(cls) ?? 0, `no entry is classified ${cls}`).toBeGreaterThan(0);
    }
    // Pinned, not bounded: the refusal set is small and named, and growing or
    // shrinking it is a decision somebody reads.
    const refusals = Object.entries(EMPIRE_TUNING_CLASSIFICATION)
      .filter(([, cls]) => cls === 'refusal')
      .map(([key]) => key)
      .sort();
    expect(refusals).toEqual([
      'PHYSIO_DAYS_SAVED_PER_STAFF_LEVEL',
      'PHYSIO_MAX_DAYS_SAVED',
      'RIVAL_COMPARISON_PERIOD_DAYS',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

describe('units', () => {
  it('agrees with itself about how long a day is', () => {
    expect(T.SECONDS_PER_DAY).toBe(T.SECONDS_PER_HOUR * 24);
    expect(T.SECONDS_PER_HOUR).toBe(T.SECONDS_PER_MINUTE * 60);
    expect(T.PRECISION_DECIMALS).toBeGreaterThan(0);
  });

  it('ticks at a resolution that divides an hour', () => {
    // The loop quantises production. A tick that does not divide an hour makes
    // an hourly rate depend on where the window starts, which is exactly the
    // disagreement between two clients the quantisation exists to remove.
    expect(T.TICK_SECONDS).toBeGreaterThan(0);
    expect(T.SECONDS_PER_HOUR % T.TICK_SECONDS).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// §5.1 Loop
// ---------------------------------------------------------------------------

describe('§5.1 loop', () => {
  it('holds the check-in inside the window §5.1 states in prose', () => {
    expect(T.CHECK_IN_TARGET_SECONDS_MIN).toBeGreaterThan(0);
    expect(T.CHECK_IN_TARGET_SECONDS_MAX).toBeGreaterThan(T.CHECK_IN_TARGET_SECONDS_MIN);
    // §5.1: "Check-in is 30-60 seconds". Pinned rather than bounded, because
    // the sentence is the design and a budget that drifts is a budget nobody
    // is measuring against.
    expect(T.CHECK_IN_TARGET_SECONDS_MIN).toBe(30);
    expect(T.CHECK_IN_TARGET_SECONDS_MAX).toBe(60);
  });

  it('does not punish the ten-hour gap §5.1 names', () => {
    // The cap is the thing that could punish it, so the cap is what is bounded
    // by it. Lowering the cap under the stated gap turns this red, which is
    // the edit CLAUDE.md's "never punish daily engagement" rule is about.
    expect(T.OFFLINE_EARNINGS_NO_PUNISH_HOURS).toBe(10);
    expect(T.OFFLINE_EARNINGS_CAP_HOURS).toBeGreaterThanOrEqual(
      T.OFFLINE_EARNINGS_NO_PUNISH_HOURS,
    );
  });

  it('makes a check-in worth making without making a gap a loss', () => {
    expect(T.OFFLINE_EARNINGS_FRACTION).toBeGreaterThan(0);
    expect(T.OFFLINE_EARNINGS_FRACTION).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// §5.2 Production
// ---------------------------------------------------------------------------

describe('§5.2 production', () => {
  it('pays something on both currencies', () => {
    expect(T.GYM_BUCKS_BASE_PER_HOUR).toBeGreaterThan(0);
    expect(T.NPC_GYM_BUCKS_PER_HOUR_BASE).toBeGreaterThan(0);
    expect(T.TRAINING_IQ_BASE_PER_DAY).toBeGreaterThan(0);
    expect(T.NPC_TRAINING_IQ_PER_DAY_BASE).toBeGreaterThan(0);
  });

  it('puts the Training IQ ceiling somewhere it can be felt from both sides', () => {
    // Two failures this is aimed at, and they are opposite. A ceiling at or
    // below the base trickle makes the whole roster term dead on day one. A
    // ceiling above anything a maximal gym can produce never binds, which
    // makes it decoration and lets §2's core tension drift behind an idle
    // timer. Both edits turn this red.
    expect(T.TRAINING_IQ_DAILY_CEILING).toBeGreaterThan(T.TRAINING_IQ_BASE_PER_DAY);

    const bestTier = Math.max(...Object.values(T.NPC_TIER_OUTPUT_MULTIPLIER));
    const maximalRosterIq =
      T.ROSTER_SLOTS_MAX * T.NPC_TRAINING_IQ_PER_DAY_BASE * bestTier * T.NPC_LOYALTY_MAX_MULTIPLIER;
    const maximalDailyIq = T.TRAINING_IQ_BASE_PER_DAY + maximalRosterIq;
    expect(maximalDailyIq).toBeGreaterThan(T.TRAINING_IQ_DAILY_CEILING);
    // The measured headroom at the shipped placeholders, so the margin is a
    // fact in the file rather than a shrug.
    expect(maximalDailyIq).toBeCloseTo(40, 6);
  });
});

// ---------------------------------------------------------------------------
// §5.3 NPC lifters
// ---------------------------------------------------------------------------

describe('§5.3 the recruitment ladder', () => {
  const tiers = [...T.NPC_TIERS];

  it('has a ladder with no duplicates', () => {
    expect(tiers.length).toBeGreaterThan(1);
    expect(new Set(tiers).size).toBe(tiers.length);
  });

  it('keys every per-tier table by exactly the ladder', () => {
    for (const [name, table] of [
      ['NPC_TIER_OUTPUT_MULTIPLIER', T.NPC_TIER_OUTPUT_MULTIPLIER],
      ['NPC_RECRUIT_COST_GYM_BUCKS', T.NPC_RECRUIT_COST_GYM_BUCKS],
      ['NPC_RECRUIT_REPUTATION_THRESHOLD', T.NPC_RECRUIT_REPUTATION_THRESHOLD],
      ['NPC_RECRUIT_SECONDS', T.NPC_RECRUIT_SECONDS],
    ] as const) {
      expect(Object.keys(table).sort(), name).toEqual([...tiers].sort());
    }
  });

  it('makes every rung strictly better and strictly dearer than the one below', () => {
    // A rung that pays no more than the one below it is a rung nobody buys; a
    // rung that costs no more is a rung that makes the one below it pointless.
    expect(notIncreasing(alongTiers(T.NPC_TIER_OUTPUT_MULTIPLIER, tiers))).toEqual([]);
    expect(notIncreasing(alongTiers(T.NPC_RECRUIT_COST_GYM_BUCKS, tiers))).toEqual([]);
    expect(notIncreasing(alongTiers(T.NPC_RECRUIT_SECONDS, tiers))).toEqual([]);
  });

  it('gates the ladder on reputation, reachably, and opens the bottom rung free of it', () => {
    const thresholds = alongTiers(T.NPC_RECRUIT_REPUTATION_THRESHOLD, tiers);
    const first = thresholds[0] as number;
    const last = thresholds[thresholds.length - 1] as number;
    // A new gym can recruit on day one.
    expect(first).toBe(0);
    // §5.3's legendary tier "unlocks via reputation milestones", so the top
    // rung is behind one, and that milestone is reachable on the scale.
    expect(last).toBeGreaterThan(0);
    expect(notIncreasing(thresholds)).toEqual([]);
    for (const tier of tiers) {
      expect(
        T.NPC_RECRUIT_REPUTATION_THRESHOLD[tier],
        `${tier} is gated above REPUTATION_MAX and is therefore dead content`,
      ).toBeLessThanOrEqual(T.REPUTATION_MAX);
    }
  });

  it('prices every tier, so nothing is recruited by luck for free', () => {
    // §12.3 refuses random-chance recruitment. The ban on randomness is a
    // source scan in `empireCore.test.ts`; this is the other half — every rung
    // has a published flat price, so there is a deterministic way to get one.
    for (const tier of tiers) {
      expect(T.NPC_RECRUIT_COST_GYM_BUCKS[tier], tier).toBeGreaterThan(0);
    }
  });

  it('makes tenure pay and then stop paying', () => {
    expect(T.NPC_LOYALTY_MIN_MULTIPLIER).toBeGreaterThan(0);
    expect(T.NPC_LOYALTY_MAX_MULTIPLIER).toBeGreaterThan(T.NPC_LOYALTY_MIN_MULTIPLIER);
    expect(T.NPC_TENURE_DAYS_TO_FULL_LOYALTY).toBeGreaterThan(0);
    expect(T.NPC_LOYALTY_CURVE_EXPONENT).toBeGreaterThan(0);
  });

  it('makes the roster ceiling reachable and makes it bind above the opening roster', () => {
    // Both directions, because both are real edits somebody could make while
    // balancing. A ceiling under the opening roster caps a gym at level zero;
    // a ceiling the axes cannot reach makes the top of two ladders pay
    // nothing.
    expect(T.ROSTER_SLOTS_BASE).toBeGreaterThan(0);
    expect(T.ROSTER_SLOTS_MAX).toBeGreaterThan(T.ROSTER_SLOTS_BASE);
    const reachable =
      T.ROSTER_SLOTS_BASE +
      T.ROSTER_SLOTS_PER_SPACE_LEVEL * T.SPACE_LEVEL_MAX +
      T.ROSTER_SLOTS_PER_SPOTTER_LEVEL * T.STAFF_LEVEL_MAX.spotter;
    expect(reachable).toBeGreaterThanOrEqual(T.ROSTER_SLOTS_MAX);
    // And the measured value at the shipped placeholders, so "reachable" is a
    // number rather than an inequality that a huge ceiling would also satisfy.
    expect(reachable).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// §5.4 Expansion axes
// ---------------------------------------------------------------------------

describe('§5.4 equipment', () => {
  const tiers = [...T.EQUIPMENT_TIERS];

  it('keys its tables by exactly the ladder', () => {
    expect(Object.keys(T.EQUIPMENT_TIER_COST_GYM_BUCKS).sort()).toEqual([...tiers].sort());
    expect(Object.keys(T.EQUIPMENT_TIER_BUCKS_MULTIPLIER).sort()).toEqual([...tiers].sort());
  });

  it('opens on a free baseline and climbs from there', () => {
    const costs = alongTiers(T.EQUIPMENT_TIER_COST_GYM_BUCKS, tiers);
    const multipliers = alongTiers(T.EQUIPMENT_TIER_BUCKS_MULTIPLIER, tiers);
    expect(costs[0]).toBe(0);
    expect(multipliers[0]).toBe(1);
    expect(notIncreasing(costs)).toEqual([]);
    expect(notIncreasing(multipliers)).toEqual([]);
  });
});

describe('§5.4 space', () => {
  it('prices exactly the levels the ladder has', () => {
    expect(T.SPACE_LEVEL_COST_GYM_BUCKS.length).toBe(T.SPACE_LEVEL_MAX);
    expect(notIncreasing([...T.SPACE_LEVEL_COST_GYM_BUCKS])).toEqual([]);
  });

  it('raises the passive ceiling from a baseline of one, per level', () => {
    // One entry per level plus the baseline the rest are measured against.
    expect(T.SPACE_PASSIVE_CEILING_MULTIPLIER.length).toBe(T.SPACE_LEVEL_MAX + 1);
    expect(T.SPACE_PASSIVE_CEILING_MULTIPLIER[0]).toBe(1);
    expect(notIncreasing([...T.SPACE_PASSIVE_CEILING_MULTIPLIER])).toEqual([]);
  });
});

describe('§5.4 staff', () => {
  it('keys its tables by exactly the roles', () => {
    expect(Object.keys(T.STAFF_LEVEL_MAX).sort()).toEqual([...T.STAFF_ROLES].sort());
    expect(Object.keys(T.STAFF_LEVEL_COST_GYM_BUCKS).sort()).toEqual([...T.STAFF_ROLES].sort());
  });

  it('prices exactly the levels each role has', () => {
    for (const role of T.STAFF_ROLES) {
      const costs = T.STAFF_LEVEL_COST_GYM_BUCKS[role];
      expect(costs.length, `${role} price list`).toBe(T.STAFF_LEVEL_MAX[role]);
      expect(T.STAFF_LEVEL_MAX[role], `${role} has no levels`).toBeGreaterThan(0);
      expect(notIncreasing([...costs]), `${role} prices`).toEqual([]);
    }
  });

  it('pays a coach in Gym Bucks', () => {
    expect(T.STAFF_COACH_BUCKS_MULTIPLIER_PER_LEVEL).toBeGreaterThan(0);
  });
});

describe('§5.4 the physio hook, against the real fatigue model', () => {
  it('saves whole days, and saves at least one', () => {
    // `recordSession` throws on a `physioDaysSaved` that is not a whole number
    // at or above zero, so a fractional table here fails at the seam rather
    // than rounding somewhere invisible. And a hook that saves nothing is dead
    // content dressed as a cross-mode feature, which is the other direction.
    expect(Number.isInteger(T.PHYSIO_DAYS_SAVED_PER_STAFF_LEVEL)).toBe(true);
    expect(Number.isInteger(T.PHYSIO_MAX_DAYS_SAVED)).toBe(true);
    expect(T.PHYSIO_DAYS_SAVED_PER_STAFF_LEVEL).toBeGreaterThan(0);
    expect(T.PHYSIO_MAX_DAYS_SAVED).toBeGreaterThan(0);
  });

  it('lets the physio ladder reach its own ceiling and go no further', () => {
    // A ladder that cannot reach the ceiling leaves levels paying nothing; one
    // that overshoots it leaves levels paying nothing for a different reason.
    // Equality is the only arrangement where every level is worth buying.
    expect(T.STAFF_LEVEL_MAX.physio * T.PHYSIO_DAYS_SAVED_PER_STAFF_LEVEL).toBe(
      T.PHYSIO_MAX_DAYS_SAVED,
    );
  });

  it('leaves the shortest setback at or above the fatigue floor without the clamp', () => {
    // GDD §5.4 wants physio to reduce Sim injury duration; §3.5 wants a
    // setback to stay a setback. `fatigue.ts` clamps at
    // INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO, and this asserts the empire never
    // reaches that clamp: the shortest roll minus everything physio can save
    // is at or above the floor on its own. Raising PHYSIO_MAX_DAYS_SAVED to 2
    // at the shipped fatigue tuning turns this red — 2 - 2 = 0, under a floor
    // of 1 — which is exactly the edit that would make the clamp load-bearing.
    const shortest = FATIGUE_TUNING.INJURY_DURATION_DAYS_MIN;
    const floor = FATIGUE_TUNING.INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO;
    expect(shortest - T.PHYSIO_MAX_DAYS_SAVED).toBeGreaterThanOrEqual(floor);

    // The per-roll half. The line that used to be here was
    // `expect(roll - PHYSIO_MAX_DAYS_SAVED).toBeLessThan(roll)`, which is
    // `PHYSIO_MAX_DAYS_SAVED > 0` — already asserted directly in the test
    // immediately above — restated inside a loop that gave it the appearance of
    // a sweep. It is replaced by the claim the loop is actually for: the
    // fatigue model's clamp never bites, so the WHOLE saving lands on every
    // roll rather than being absorbed by `Math.max`. Raising
    // PHYSIO_MAX_DAYS_SAVED to 2 turns this red at the shortest roll — 2 - 2 is
    // 0, clamped up to the floor of 1, so the saving delivered is 1 and not 2.
    let rollsWalked = 0;
    for (
      let roll = FATIGUE_TUNING.INJURY_DURATION_DAYS_MIN;
      roll <= FATIGUE_TUNING.INJURY_DURATION_DAYS_MAX;
      roll += 1
    ) {
      // The same arithmetic `fatigue.ts` performs, with its clamp in place.
      const shortened = Math.max(floor, roll - T.PHYSIO_MAX_DAYS_SAVED);
      expect(shortened, `roll of ${roll} days: the clamp absorbed part of the saving`).toBe(
        roll - T.PHYSIO_MAX_DAYS_SAVED,
      );
      expect(roll - shortened, `roll of ${roll} days: days actually saved`).toBe(
        T.PHYSIO_MAX_DAYS_SAVED,
      );
      // And a setback stays a setback: the sibling assertion, kept, because it
      // is the one that bites in the other direction.
      expect(shortened, `roll of ${roll} days`).toBeGreaterThanOrEqual(floor);
      rollsWalked += 1;
    }
    // Not an empty domain, and counted rather than bounded: the fatigue model
    // really does roll a range, and this is how many rolls it has.
    expect(rollsWalked).toBe(
      FATIGUE_TUNING.INJURY_DURATION_DAYS_MAX - FATIGUE_TUNING.INJURY_DURATION_DAYS_MIN + 1,
    );
    expect(rollsWalked).toBe(2);
  });
});

describe('§5.4 reputation and sponsorship', () => {
  it('runs its tiers from zero up to the top of the scale', () => {
    const thresholds = [...T.REPUTATION_TIER_THRESHOLDS];
    expect(thresholds[0]).toBe(0);
    expect(thresholds[thresholds.length - 1]).toBe(T.REPUTATION_MAX);
    expect(notIncreasing(thresholds)).toEqual([]);
  });

  it('pays sponsors per tier, starting at nothing', () => {
    const payouts = [...T.SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER];
    expect(payouts.length).toBe(T.REPUTATION_TIER_THRESHOLDS.length);
    expect(payouts[0]).toBe(0);
    expect(notIncreasing(payouts.slice(1))).toEqual([]);
  });

  it('earns reputation from the check-in and from tenure', () => {
    expect(T.REPUTATION_PER_CHECK_IN).toBeGreaterThan(0);
    expect(T.REPUTATION_PER_NPC_TENURE_DAY).toBeGreaterThan(0);
    expect(T.REPUTATION_MAX).toBeGreaterThan(0);
  });
});

describe('§5.4 build timers', () => {
  it('keeps the guard above the longest timer the ladders can produce', () => {
    // BUILD_SECONDS_MAX is a guard rather than a shaping value, and it is
    // currently slack. Asserting `buildSeconds(...) <= MAX` would be vacuous —
    // the function clamps — so the raw value is recomputed here and the clamp
    // is asserted not to bite. Raising the growth rate until it does turns
    // this red, which is the point of a guard that is not supposed to be a
    // truncation.
    const deepest = Math.max(T.SPACE_LEVEL_MAX, ...Object.values(T.STAFF_LEVEL_MAX));
    const raw = T.BUILD_SECONDS_BASE * T.BUILD_SECONDS_GROWTH_PER_LEVEL ** (deepest - 1);
    expect(T.BUILD_SECONDS_MAX).toBeGreaterThanOrEqual(raw);
    expect(buildSeconds(deepest)).toBeCloseTo(raw, 6);
    // And the measured longest timer at the shipped placeholders.
    expect(raw).toBeCloseTo(3981.312, 3);
  });

  it('grows the timer with the level', () => {
    expect(T.BUILD_SECONDS_BASE).toBeGreaterThan(0);
    expect(T.BUILD_SECONDS_GROWTH_PER_LEVEL).toBeGreaterThan(1);
    expect(T.TIMER_SKIP_SECONDS_PER_GRANT).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// §5.5 Social layer
// ---------------------------------------------------------------------------

describe('§5.5 social', () => {
  it('keys bracket sizes by exactly the scopes, and none of them is a mirror', () => {
    expect(Object.keys(T.LEADERBOARD_BRACKET_SIZE).sort()).toEqual([...T.LEADERBOARD_SCOPES].sort());
    for (const scope of T.LEADERBOARD_SCOPES) {
      expect(T.LEADERBOARD_BRACKET_SIZE[scope], scope).toBeGreaterThan(1);
    }
  });

  it('counts the rival comparison period in calendar days', () => {
    // GDD §8.3C measured this shape rather than argued it: a reward keyed to a
    // fixed calendar period gives 0 violating pairs, one keyed to session
    // count gives 1156 at 100 days, one keyed to streak length gives 54. The
    // magnitude here is a knob. The unit is the refusal condition, so what is
    // asserted is that it is a whole number of days and that the entry carries
    // the `refusal` class.
    expect(Number.isInteger(T.RIVAL_COMPARISON_PERIOD_DAYS)).toBe(true);
    expect(T.RIVAL_COMPARISON_PERIOD_DAYS).toBeGreaterThan(0);
    expect(EMPIRE_TUNING_CLASSIFICATION.RIVAL_COMPARISON_PERIOD_DAYS).toBe('refusal');
  });

  it('names no cadence in a unit the player’s training can move', () => {
    // A floor under the rule above, and stated as a floor: an entry called
    // `RIVAL_COMPARISON_PERIOD_DAYS` that a consumer secretly advanced per
    // session would satisfy this, and the thing that catches THAT is E6's
    // measurement. What this catches is the copy-paste — a new cadence added
    // in sessions or streak days because it was easier to compute that way.
    // ONE PATTERN WITH FIVE ALTERNATIVES WAS FOUR DEAD LETTERS. It read
    // `/PER_SESSION|SESSION_COUNT|PER_STREAK|STREAK_DAY|PER_TIER_UNLOCK/` and
    // the derived probe below exercised the first alternative only, so deleting
    // any of the other four from the pattern reddened nothing at all. The
    // sibling scan in `empireCore.test.ts` had already been given an
    // index-aligned tripwire per pattern and an explicit
    // `tripwires.length === banned.length` pin; that fix stopped at the file
    // boundary and this one, in the same directory, kept the hole.
    //
    // One entry per unit, so a unit is a row somebody deletes rather than four
    // characters inside a regex. The membership pin is what makes deleting one
    // red — deriving the pattern from the list alone would move both sides
    // together, which is the oracle-mirrors-its-subject shape.
    // THE MEMBERSHIP PIN THAT USED TO BE HERE COMPARED THIS LIST WITH A COPY OF
    // ITSELF, five lines below the declaration — two literals in one test,
    // which no state of `empireTuning.ts` could make disagree. It read as the
    // thing keeping a unit from being quietly deleted, and the thing that
    // actually does that is `probed`, at the bottom: the count of (key, unit)
    // pairs driven is pinned exactly, so a shortened list moves 270 and a
    // shortened key set moves it too. One of those two numbers has the subject
    // in it; the deleted comparison had neither.
    const bannedUnits = [
      'PER_SESSION',
      'SESSION_COUNT',
      'PER_STREAK',
      'STREAK_DAY',
      'PER_TIER_UNLOCK',
    ] as const;
    const banned = bannedUnits.map((unit) => new RegExp(unit));

    let examined = 0;
    let probed = 0;
    for (const key of Object.keys(EMPIRE_TUNING)) {
      for (const [index, pattern] of banned.entries()) {
        expect(pattern.test(key), `${key} is counted in something training moves`).toBe(false);
        // The probe, derived from the subject rather than written beside the
        // pattern: a real key re-suffixed with the real unit. This is GDD
        // §4.4's defect in its exact shape, so renaming
        // `RIVAL_COMPARISON_PERIOD_DAYS` to `RIVAL_COMPARISON_PER_SESSION`
        // reddens the line above, and a unit whose pattern stopped matching
        // reddens this one — for every unit now, not only the first.
        const unit = bannedUnits[index] as string;
        expect(pattern.test(`${key}_${unit}`), `${key}_${unit} slips past`).toBe(true);
        probed += 1;
      }
      examined += 1;
    }
    // The non-vacuity guard the two probes were standing in for, and it is the
    // one that was missing: how many keys the loop actually looked at. An empty
    // or truncated key set would have made every assertion above pass.
    expect(examined).toBe(Object.keys(EMPIRE_TUNING).length);
    // 87 -> 105: the ten §5 (v2) stage-3 member entries, plus §5.13
    // presentation Phase 1's eight floor knobs (FLOOR_GRID_SIZE,
    // SESSION_EQUIPMENT_FOOTPRINT, FLOOR_TILE_PIXELS,
    // FLOOR_GRID_BORDER_WIDTH_PIXELS, FLOOR_ITEM_BORDER_WIDTH_PIXELS,
    // FLOOR_TRAY_ITEM_MARGIN_PIXELS, FLOOR_DRAGGING_Z_INDEX,
    // FLOOR_TRAY_ITEM_MIN_TILES), both landing on the same base of 87.
    // 105 -> 107: GDD §5.13's PLAYTEST 2 ruling adds two top-level entries —
    // FLOOR_FIXED_FURNITURE_LAYOUT (gap 1, fixed Barbell-baseline furniture)
    // and FLOOR_GRID_LINE_WIDTH_PIXELS (gap 3, tile-boundary lines). Measured
    // by running this assertion and reading its failure value, not computed
    // by hand.
    // 107 -> 109: PLAYTEST 3's overlap-refusal ruling adds two more —
    // FLOOR_OVERLAP_REFUSAL_FLASH_MS and
    // FLOOR_OVERLAP_REFUSAL_OUTLINE_WIDTH_PIXELS. Same measurement discipline.
    // 109 -> 112: GDD §5.13 presentation Phase 2's three ambient-member
    // entries (AMBIENT_MEMBER_COUNT_BY_RUNG, AMBIENT_MEMBER_FOOTPRINT_TILES,
    // AMBIENT_MEMBER_PLACEMENT_STRIDE). Measured by running this assertion
    // and reading its failure value, not computed by hand.
    // 112 -> 120: PLAYTEST 4's eight new sizing/timing knobs
    // (AMBIENT_MEMBER_HEAD_DIAMETER_FRACTION, AMBIENT_MEMBER_BODY_WIDTH_FRACTION,
    // AMBIENT_MEMBER_BODY_HEIGHT_FRACTION, AMBIENT_MEMBER_BODY_CORNER_RADIUS_PIXELS,
    // AMBIENT_MEMBER_BOB_AMPLITUDE_PIXELS, AMBIENT_MEMBER_BOB_HALF_CYCLE_MS,
    // AMBIENT_MEMBER_BOB_STAGGER_LANES, AMBIENT_MEMBER_BOB_STAGGER_STEP_MS).
    // Measured by running this assertion and reading its failure value.
    // 120 -> 133: GDD §5.13 presentation Phase 3's thirteen FLOOR_SIM entries.
    // Measured by running this assertion and reading its failure value.
    // 133 -> 145: Phase 3's RENDER half adds twelve more FLOOR_SIM entries —
    // the tick interval, the move tween, the render seed, the cue's diameter
    // fraction / gap / interrupted scale, the leaving opacity, the using
    // pulse's amplitude and half-cycle, the highlight border width, and the
    // two z-indices. Measured by running this assertion and reading its
    // failure value, not computed by hand.
    // 145 -> 148: GDD §5.13 presentation Phase 4 adds seven FLOOR_SPRITE
    // entries (native pixels per tile, walk-frame ticks, four palettes and
    // the fleck stride) and retires the four placeholder-body sizing knobs
    // PLAYTEST 4 added, whose subject — the head-and-body placeholder — the
    // sprite replaced. Measured by running this assertion and reading its
    // failure value.
    // 148 -> 149: the label-size knob (FLOOR_SPRITE_LABEL_FONT_SIZE), added
    // when the first composed screenshot showed default-size captions
    // burying the sprites.
    // 149 -> 163: §5.11 stage 4's fourteen entries — the manager tier ladder
    // and its three per-tier tables, the wear rate, the condition income
    // floor, the repair rate, the dormancy crawl, the maintenance-prompt line
    // and its free allowance, the diligent policy's repair line, the two
    // strike thresholds and the recovery minimum. Note it is fourteen and not
    // fifteen: the dormancy entry slump that shipped with the first draft was
    // measured as a never-punish breach and removed, so no knob arrived for
    // it. Measured by running this assertion and reading its failure value.
    // 163 -> 165: the two ordinal review knobs the §5.7 chain-break round
    // added — MAINTENANCE_ORDER_FIRST_CHECK_IN and MAINTENANCE_ORDER_STRIDE.
    // Both are counted in CHECK-INS, and this test is the one that has to be
    // read carefully about that: a check-in is something the player does, so a
    // reader could take these for exactly the shape the banned-unit list
    // forbids. They are not. The list bans a CADENCE denominated in a unit
    // training moves — per session, per streak day — because such a cadence
    // makes an OUTCOME arrive sooner for a player who trains more. These two
    // did the opposite when they were added: they took the review OFF a wear
    // clock that absence and check-in frequency both moved, and put it on a
    // check-in COUNT that an enlarged gap could not change AT THE TIME. A
    // later, more specific human ruling re-keyed the ordinal itself, FROM that
    // check-in count TO real banked seconds — the same one-clock mechanism
    // money and wear already used (`management.ts` header §3g has the
    // derivation). That re-keying reopened exactly the channel these two
    // knobs' names describe: `management.test.ts`'s `withinHorizon` family
    // now reads 1401 / 582 / 224, GREATER than the condition-gated control's
    // 310 / 186 / 124 rather than zero against it — a measured regression,
    // not a claim this test can catch (these two knobs still name no unit a
    // player's training moves; what moved is what the ORDINAL they gate on is
    // computed FROM, which is a different file's concern and is disclosed
    // there rather than here).
    //
    // The other price was already stated rather than hidden, because it is
    // real and it is on this test's own subject: an ordinal cadence IS
    // check-in-keyed, so the engagement family's failure counters are
    // non-zero (909 / 524) and the reviews arrive sooner in wall-clock for a
    // player who checks in more. That WAS routed to a human as an open
    // conflict with §5.7's second sentence; the ruling withdrew the sentence
    // rather than the cadence, so 909 / 524 are now what a deleted bar would
    // have measured. `management.ts` header §3b has it. What keeps the
    // cadence out of THIS ban is unchanged and is the load-bearing part: no
    // name here is a per-session or per-streak-day rate, and the never-punish
    // reading the ban exists for — money — is measured at zero on every
    // engagement policy.
    //
    // 165 -> 166: `WALL_CLOCK_TICK_INTERVAL_SECONDS`, the "kill the mint"
    // round's one new knob — a real-seconds polling interval, not a cadence
    // denominated in any unit training moves.
    // 166 -> 167: `MILLISECONDS_PER_SECOND`, the units-conversion constant the
    // same round's harness fix reads instead of a bare 1000 — structural, not
    // a cadence in any unit training moves.
    // 167 -> 168: `DUST_REPAIR_COST_GYM_BUCKS`, the "chrome vs paid" bug-fix
    // round's one new knob — a Gym Bucks threshold below which a repair
    // quote is shown as dust, not a cadence in any unit training moves.
    // 168 -> 174: S4h's `GYM_SCREEN_BUTTON_*` block — six new screen-chrome
    // knobs (padding x2, border radius, border width, min height, disabled
    // opacity), none of them a cadence in any unit training moves.
    // 174 -> 175: S4i's `GYM_SCREEN_LEAVE_PILL_CLEARANCE_PIXELS`, a UI
    // clearance amount, not a cadence in any unit training moves.
    // 175 -> 176: GDD §5.14 Stage B's `PACING_REPORT_HORIZONS_SECONDS` — a
    // fixed measurement checkpoint list, not a cadence in any unit training
    // moves.
    // 176 -> 180: GDD §5.14 Stage C's four station-panel entries
    // (STATION_TAP_MAX_DRAG_PIXELS, FLOOR_STATION_PANEL_PADDING_PIXELS,
    // FLOOR_STATION_PANEL_BORDER_WIDTH_PIXELS,
    // FLOOR_STATION_PANEL_MARGIN_TOP_PIXELS) — a gesture-disambiguation
    // distance and three layout knobs, none of them a cadence in any unit
    // training moves.
    // 180 -> 182: Stage C.1b FLOOR_TILE_PIXELS_MAX and FLOOR_STAGE_PADDING_PIXELS.
    // 182 -> 183: Stage C.1c CONDITION_PERCENT_SCALE.
    // 183 -> 191: Stage D eight Q/C/T entries.
    // 191 -> 192: Stage D Quality affinity bonus.
    // 192 -> 193: Stage D2.1B FLOOR_SIM_STATION_CHANGEOVER_TICKS. The
    // 0.65 use-factor was replaced by STATION_THROUGHPUT_CHANGEOVER_TICKS
    // (replace, count unchanged).
    // 193 -> 196: Stage D2.2 SECONDS_PER_MINUTE, LADDER_DEV_WATCHED_TIME_
    // STEPS_SECONDS, FLOOR_PLATE_LOADING.
    // 197 -> 201: Stage G.1 LIVING_MEMBER_* tuning keys (four scalar knobs).
    expect(examined).toBe(201);
    // And how many (key, unit) pairs were actually driven, so a shortened unit
    // list is red on a count as well as on the membership pin above.
    expect(probed).toBe(examined * bannedUnits.length);
    // 435 -> 525 -> 535 -> 545 -> 560 -> 600 (120 keys x 5 banned units,
    // PLAYTEST 4's eight new tuning entries).
    // 600 -> 665 (133 keys x 5 banned units).
    // 665 -> 725 (145 keys x 5 banned units).
    // 725 -> 740 (148 keys x 5 banned units, Phase 4's net +3 entries).
    // 740 -> 745 (149 keys x 5 banned units).
    // 745 -> 815 (163 keys x 5 banned units).
    // 815 -> 825 (165 keys x 5 banned units).
    // 825 -> 830 (166 keys x 5 banned units).
    // 830 -> 835 (167 keys x 5 banned units).
    // 835 -> 840 (168 keys x 5 banned units).
    // 840 -> 870 (174 keys x 5 banned units, S4h's six new knobs).
    // 870 -> 875 (175 keys x 5 banned units, S4i's one new knob).
    // 875 -> 880 (176 keys x 5 banned units, Stage B's one new knob).
    // 880 -> 900 (180 keys x 5 banned units, Stage C's four new entries).
    // 900 -> 910: Stage C.1b two new knobs × 5 banned units.
    // 910 -> 915: Stage C.1c CONDITION_PERCENT_SCALE × 5 banned units.
    // 915 -> 955: Stage D eight Q/C/T entries × 5 banned units.
    // 955 -> 960: Stage D Quality affinity bonus, one more entry × 5.
    // 960 -> 965: Stage D2.1B FLOOR_SIM_STATION_CHANGEOVER_TICKS × 5.
    // 965 -> 980: Stage D2.2 three new entries × 5 banned units.
    // 985 -> 1005: Stage G.1 four LIVING_MEMBER_* entries × 5 banned units.
    expect(probed).toBe(1005);
  });

  it('pays the §5.5 rewards in Gym Bucks and pays something', () => {
    expect(T.RIVAL_REWARD_GYM_BUCKS).toBeGreaterThan(0);
    expect(T.ENCOURAGEMENT_REWARD_GYM_BUCKS).toBeGreaterThan(0);
    expect(T.FRIEND_VISITS_PER_DAY).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Reachability from a consumer
// ---------------------------------------------------------------------------

/**
 * Entries no shipped module under `src/empire/` reads yet, pinned exactly.
 *
 * The point of this list is that it shrinks. Pieces E1-E5 wire the loop, the
 * production curves, the roster, the axes and the social layer; each one takes
 * rows out of here, and a row that stays in it through the whole build is an
 * entry nothing consumes, which is a number in a tuning file that no playtester
 * can affect anything by turning.
 *
 * Pinned in both directions: an entry that is neither read nor listed fails,
 * and a listed entry that has since been wired fails too, so the list cannot
 * fill up with rows about code that already reads them.
 */
const AWAITING_CONSUMER: readonly string[] = [
  'CHECK_IN_TARGET_SECONDS_MAX',
  'CHECK_IN_TARGET_SECONDS_MIN',
  // Stage C.1d: drag is no longer the canonical Build path, so this
  // tap/drag disambiguation distance has no shipped reader.
  'STATION_TAP_MAX_DRAG_PIXELS',
  // `WALL_CLOCK_TICK_INTERVAL_SECONDS` LEFT THIS LIST, GDD §5.14 STAGE B. It
  // used to be here only for the scan's own declared blind spot — read by
  // `src/shell/AppShell.tsx`'s `GymHost`, outside `shippedModuleNames()`'s
  // reach. `pacing.ts`'s `naturalOffsetsSeconds` now reads it directly
  // (`EMPIRE_TUNING.WALL_CLOCK_TICK_INTERVAL_SECONDS`, the watcher policy's
  // step), which IS inside this directory's own walk, so the key is a real
  // consumed entry now rather than one this list has to carry as a footnote.
  // Same blind spot, same round: `MILLISECONDS_PER_SECOND` is read only by
  // `AppShell.tsx`'s `GymHost`, for the harness's ms<->s conversion — outside
  // `shippedModuleNames()`'s reach for the identical reason.
  'MILLISECONDS_PER_SECOND',
];

/**
 * Comments removed, the way the sibling scans in `empireCore.test.ts` remove
 * them.
 *
 * This scan did not, and its sibling forty lines away in the same directory
 * did — which is CLAUDE.md's "proximity is not protection" in miniature. A key
 * mentioned only inside a comment as `EMPIRE_TUNING.FOO` counted as consumed
 * and would have silently left `AWAITING_CONSUMER`. Harmless on the day it was
 * found, because the one comment mention in `empireCore.ts` is also a genuine
 * read twelve lines down — which is exactly the kind of luck this file is not
 * supposed to run on.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Which `EMPIRE_TUNING` entries a body of shipped source actually reads. */
function consumedKeys(source: string): readonly string[] {
  const code = withoutComments(source);
  return Object.keys(EMPIRE_TUNING).filter((key) => code.includes(`EMPIRE_TUNING.${key}`));
}

describe('every entry is reachable from a consumer, or is listed as not yet reached', () => {
  // Read through the shared walk rather than a one-level `readdirSync(HERE)`.
  // The direction this scan fails in when it cannot see a file is the
  // reassuring one: an unseen consumer makes a key look UNCONSUMED, which puts
  // it on `AWAITING_CONSUMER` where it reads as honest bookkeeping. A knob a
  // module in a subdirectory branched on would have sat on that list saying
  // nothing reads it while something did.
  const shipped = shippedModuleNames()
    .filter((name) => name !== 'empireTuning.ts')
    .map((name) => readFileSync(path.join(HERE, name), 'utf8'))
    .join('\n');

  const read = consumedKeys(shipped);
  const unread = Object.keys(EMPIRE_TUNING)
    .filter((key) => !read.includes(key))
    .sort();

  it('has consumers at all, so the scan is measuring something', () => {
    // The empty-domain guard. If `src/empire/` held no shipped module, every
    // key would read as unconsumed and the pin below would be a list of the
    // whole file that nobody would look at twice.
    expect(shipped.length).toBeGreaterThan(0);
    expect(read.length, 'no entry is read by any shipped module').toBeGreaterThan(0);
    // Counts rather than bounds, so an empty domain reports itself.
    expect(read.length + unread.length).toBe(Object.keys(EMPIRE_TUNING).length);
  });

  it('does not count a mention inside a comment as a consumer', () => {
    // The divergence driven rather than described. Deleting either half of
    // `withoutComments` turns one of the first two lines red; deleting the
    // whole strip turns both red. The third line is the positive control, so a
    // strip that had started eating code instead of comments — which would make
    // the first two pass for the wrong reason — is red as well.
    const realKey = Object.keys(EMPIRE_TUNING)[0] as string;
    const otherKey = Object.keys(EMPIRE_TUNING)[1] as string;
    expect(consumedKeys(`// EMPIRE_TUNING.${realKey}\n`)).toEqual([]);
    expect(consumedKeys(`/* EMPIRE_TUNING.${realKey} */\n`)).toEqual([]);
    expect(consumedKeys(`const x = EMPIRE_TUNING.${otherKey};\n`)).toEqual([otherKey]);
    // And the two keys are distinct, so the third line is not reading the
    // residue of the first two.
    expect(realKey).not.toBe(otherKey);
  });

  it('pins the not-yet-consumed list exactly, in both directions', () => {
    expect(unread).toEqual([...AWAITING_CONSUMER].sort());
    for (const key of AWAITING_CONSUMER) {
      expect(Object.keys(EMPIRE_TUNING), `${key} is listed but is not an entry`).toContain(key);
      expect(read, `${key} is listed as unconsumed but is read`).not.toContain(key);
    }
  });
});
