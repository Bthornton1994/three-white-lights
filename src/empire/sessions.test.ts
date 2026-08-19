/**
 * sessions.test.ts — GDD §5 (v2) stage 2, graded where it is written.
 *
 * Four batteries, each in the house shape (named parameters, counts not
 * bounds, non-zero controls kept runnable, arms-reached censuses):
 *
 *   1. The tuning shape: every stage-2 table keyed exactly, every budget
 *      guard re-derived slack from the values rather than trusted, and the
 *      §5.5 arithmetic (four fixed plus three flexible is the training week).
 *   2. The decision-density measurement the stage-1 gate ordered: the
 *      canonical twice-daily run's purchase days pinned exactly, with the
 *      strip-mall band's decision count and largest empty stretch read out
 *      of the run rather than asserted in prose.
 *   3. Never punish engagement, element-wise: money, rung, equipment and the
 *      weekly effect series, exhaustively on the slot grid and on seeded
 *      40/100-day calendars, with the fee control's non-zero count pinned.
 *   4. The crown sweep, in the E6 element-wise shape: two runs identical
 *      except one is granted purchased/accelerated currency must be
 *      byte-identical on purchase days, relocations, weekly effects and slot
 *      legality — and the wired-accelerant control, the same fold with grants
 *      paid into the settled purse, is kept runnable with its divergence
 *      counts pinned non-zero and attributed per series.
 *
 * The fatigue-seam contract is bounded against the real `FATIGUE_TUNING`
 * here, because a test may cross the directory's import fence and a shipped
 * module may not (`sessions.ts` header §4).
 */

import { describe, expect, it } from 'vitest';
import { FATIGUE_TUNING } from '../game/fatigue';
import {
  type AcceleratedGrant,
  type FlexibleActivity,
  type FlexibleSlot,
  type GymPolicy,
  type GymRun,
  type GymRunSchedule,
  type GymState,
  type SessionEquipmentItem,
  type SlotOutcome,
  type WeekAllocation,
  type WeeklyAttributeEffects,
  GRANT_DESTINATIONS,
  GYM_POLICIES,
  activityAvailable,
  activityEquipmentGroup,
  availableActivities,
  buySessionEquipment,
  composedCeilingGrowth,
  createGymState,
  createRestAllocation,
  grantAcceleratedGymBucks,
  groupCapabilityGrade,
  gymCheckIn,
  requireGymState,
  requireWeekAllocation,
  resolveWeek,
  runGym,
  sessionEquipmentCost,
  sessionEquipmentGroup,
  sessionEquipmentMinRung,
  supportAmplifier,
  weeklyAttributeEffects,
} from './sessions';
import { ladderEquipmentCost, ladderMoveCost, ladderRungIndex } from './ladder';
import { EMPIRE_TUNING } from './empireTuning';

const T = EMPIRE_TUNING;

// ---------------------------------------------------------------------------
// Sweep parameters — every input of every measurement below, in one place
// ---------------------------------------------------------------------------

/**
 * Exported the way `LADDER_SWEEP`, `EMPIRE_SWEEP` and `ENGAGEMENT_SWEEP` are:
 * a measurement whose inputs are not written down is an anecdote
 * (`src/game/streakSweep.ts`'s lesson).
 */
export const SESSIONS_SWEEP = Object.freeze({
  /**
   * The exhaustive grid: six days of two slots, one every twelve hours — the
   * same grid `LADDER_SWEEP` uses and for the same measured reason: its full
   * accrual straddles the first relocation and the cheap items, so the
   * spending policy genuinely diverges from hoard inside the domain.
   */
  EXHAUSTIVE_SLOTS: 12,
  SLOT_SECONDS: 43200,
  EXHAUSTIVE_SCHEDULES: 4096,
  EXHAUSTIVE_PAIRS: 24576,

  /** The seeded calendars: LCG-generated attendance on a two-slot day. */
  SEEDS: Object.freeze([11, 23, 47, 61, 83] as const),
  SEEDED_LENGTHS_DAYS: Object.freeze([40, 100] as const),
  SEEDED_SLOTS_PER_DAY: 2,
  ATTENDANCE_MODULUS: 3,
  LCG_MULTIPLIER: 1664525,
  LCG_INCREMENT: 1013904223,
  LCG_MODULUS: 4294967296,

  /**
   * The fee control's per-check-in charge — above what one extra slot can
   * bank at the garage rate, so the control's count is the whole pair set.
   * The shipped model charges no fee anywhere; this is the "checked in more,
   * ended up worse" shape kept runnable so the zeros are zero against a
   * counter that counts.
   */
  CONTROL_FEE_GYM_BUCKS: 500,

  /**
   * The canonical gate cadence: twice-daily check-ins, the cadence the
   * stage-1 play-through's 3.7 / 6.6 / 18.7-day rhythm was measured at, run
   * long enough to buy out the whole tree and relocate to the warehouse.
   */
  CANONICAL_DAYS: 40,

  /** Grant times as fractions through a schedule, so plans span it. */
  GRANT_AT_FRACTIONS: Object.freeze([0, 0.4, 0.8] as const),

  /** Weeks in the crown/never-punish allocation plan before it repeats. */
  PLAN_WEEKS: 4,
} as const);

/**
 * The crown sweep's grant sizes, derived from the subject's own numbers
 * rather than invented — the extremes lesson: a domain must contain the
 * region the code branches on, and every `balance < price` branch point in
 * stage 2 is a row of these three tables. One grant of exactly each price,
 * one a single Gym Buck short of the dearest, one the sum of every price,
 * and one four times the dearest.
 */
function grantSizes(): readonly number[] {
  const prices = [
    ...T.LADDER_RUNGS.filter((rung) => rung !== T.LADDER_RUNGS[0]).map((rung) =>
      ladderMoveCost(rung as Exclude<(typeof T.LADDER_RUNGS)[number], 'garage'>),
    ),
    ...T.LADDER_EQUIPMENT_ITEMS.map((item) => ladderEquipmentCost(item)),
    ...T.SESSION_EQUIPMENT_ITEMS.map((item) => sessionEquipmentCost(item)),
  ];
  const dearest = Math.max(...prices);
  const total = prices.reduce((sum, price) => sum + price, 0);
  return Object.freeze([...new Set([...prices, dearest - 1, total, dearest * 4])].sort(
    (left, right) => left - right,
  ));
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

function slotTime(slot: number): number {
  return (slot + 1) * SESSIONS_SWEEP.SLOT_SECONDS;
}

function scheduleOf(mask: number): readonly number[] {
  const times: number[] = [];
  for (let slot = 0; slot < SESSIONS_SWEEP.EXHAUSTIVE_SLOTS; slot += 1) {
    if ((mask & (1 << slot)) !== 0) times.push(slotTime(slot));
  }
  return times;
}

function seededSchedule(seed: number, lengthDays: number): readonly number[] {
  const slotSeconds = T.SECONDS_PER_DAY / SESSIONS_SWEEP.SEEDED_SLOTS_PER_DAY;
  let draw = seed;
  const times: number[] = [];
  const slots = lengthDays * SESSIONS_SWEEP.SEEDED_SLOTS_PER_DAY;
  for (let slot = 0; slot < slots; slot += 1) {
    draw =
      (draw * SESSIONS_SWEEP.LCG_MULTIPLIER + SESSIONS_SWEEP.LCG_INCREMENT) %
      SESSIONS_SWEEP.LCG_MODULUS;
    if (draw % SESSIONS_SWEEP.ATTENDANCE_MODULUS !== 0) times.push((slot + 1) * slotSeconds);
  }
  return times;
}

/** Twice-daily attendance, every slot, for `days` days. */
function canonicalSchedule(days: number): readonly number[] {
  const times: number[] = [];
  for (let slot = 0; slot < days * 2; slot += 1) times.push((slot + 1) * 43200);
  return times;
}

function withExtra(schedule: readonly number[], at: number): readonly number[] {
  return [...schedule, at].sort((left, right) => left - right);
}

/**
 * The sweep plan: four weeks that between them allocate every activity and a
 * rest, then repeat via the plan's own last-entry rule. Chosen so the
 * allocation axis varies — a plan of one constant week would grade the
 * effects series against an axis with one point.
 */
function sweepPlan(): readonly WeekAllocation[] {
  return Object.freeze([
    Object.freeze(['stretching-yoga', 'cardio', 'hypertrophy']) as WeekAllocation,
    Object.freeze(['cardio', 'cardio', 'rest']) as WeekAllocation,
    Object.freeze(['hypertrophy', 'stretching-yoga', 'other-recovery']) as WeekAllocation,
    Object.freeze(['other-recovery', 'rest', 'stretching-yoga']) as WeekAllocation,
  ]);
}

function scheduleFor(
  checkInsSeconds: readonly number[],
  grants: readonly AcceleratedGrant[],
): GymRunSchedule {
  return Object.freeze({ checkInsSeconds, allocationPlan: sweepPlan(), grants });
}

function runOf(checkInsSeconds: readonly number[], policy: GymPolicy): GymRun {
  return runGym(scheduleFor(checkInsSeconds, []), policy, 'accelerated-purse');
}

// ---------------------------------------------------------------------------
// Element-wise comparison of the series the sweeps grade
// ---------------------------------------------------------------------------

/** Whether a more-engaged twin is worse anywhere, series by series. */
interface PairDivergence {
  readonly accruedLower: boolean;
  readonly rungLower: boolean;
  readonly equipmentNotSuperset: boolean;
  readonly cashLower: boolean;
  /** Some capability the base holds arrived later (or not at all) for the twin. */
  readonly purchaseLater: boolean;
  /** Some week's effects are worse on some channel for the twin. */
  readonly effectsWorse: boolean;
}

function purchaseDayOf(run: GymRun, item: string): number {
  for (const purchase of run.purchases) {
    if (purchase.item === item) return purchase.atSeconds;
  }
  return Number.POSITIVE_INFINITY;
}

function effectsWorse(base: WeeklyAttributeEffects, twin: WeeklyAttributeEffects): boolean {
  return (
    twin.residualCarryMultiplier > base.residualCarryMultiplier ||
    twin.injuryChanceMultiplier > base.injuryChanceMultiplier ||
    twin.techniqueQualityBonus < base.techniqueQualityBonus ||
    twin.ceilingGrowthPerWeek < base.ceilingGrowthPerWeek
  );
}

function divergence(base: GymRun, moreEngaged: GymRun): PairDivergence {
  const held = new Set(moreEngaged.state.sessionEquipment);
  const heldLadder = new Set(moreEngaged.state.ladder.equipment);
  let purchaseLater = false;
  for (const purchase of base.purchases) {
    if (purchaseDayOf(moreEngaged, purchase.item) > purchase.atSeconds) purchaseLater = true;
  }
  let worse = false;
  for (const week of base.weeks) {
    const twin = moreEngaged.weeks[week.weekIndex];
    if (twin === undefined || effectsWorse(week.effects, twin.effects)) worse = true;
  }
  return {
    accruedLower: moreEngaged.accruedGymBucks < base.accruedGymBucks,
    rungLower:
      ladderRungIndex(moreEngaged.state.ladder.rung) < ladderRungIndex(base.state.ladder.rung),
    equipmentNotSuperset:
      !base.state.sessionEquipment.every((item) => held.has(item)) ||
      !base.state.ladder.equipment.every((item) => heldLadder.has(item)),
    cashLower: moreEngaged.state.ladder.gymBucks < base.state.ladder.gymBucks,
    purchaseLater,
    effectsWorse: worse,
  };
}

/** Cash plus everything paid equals everything accrued (plus control credits). */
function conservationHolds(run: GymRun, controlCredited: number): boolean {
  let paid = 0;
  const stageTwo = new Set<string>(T.SESSION_EQUIPMENT_ITEMS);
  for (const purchase of run.purchases) {
    paid += stageTwo.has(purchase.item)
      ? sessionEquipmentCost(purchase.item as SessionEquipmentItem)
      : ladderEquipmentCost(purchase.item as (typeof T.LADDER_EQUIPMENT_ITEMS)[number]);
  }
  for (const move of run.movedTo) paid += ladderMoveCost(move.to);
  const left = Math.round((run.state.ladder.gymBucks + paid) * 1e6);
  const right = Math.round((run.accruedGymBucks + controlCredited) * 1e6);
  return left === right;
}

interface SweepTally {
  pairs: number;
  accruedLower: number;
  rungLower: number;
  equipmentNotSuperset: number;
  cashLower: number;
  purchaseLater: number;
  effectsWorse: number;
  conservationBreaks: number;
}

function emptyTally(): SweepTally {
  return {
    pairs: 0,
    accruedLower: 0,
    rungLower: 0,
    equipmentNotSuperset: 0,
    cashLower: 0,
    purchaseLater: 0,
    effectsWorse: 0,
    conservationBreaks: 0,
  };
}

function tallyPair(tally: SweepTally, base: GymRun, moreEngaged: GymRun): void {
  const read = divergence(base, moreEngaged);
  tally.pairs += 1;
  tally.accruedLower += read.accruedLower ? 1 : 0;
  tally.rungLower += read.rungLower ? 1 : 0;
  tally.equipmentNotSuperset += read.equipmentNotSuperset ? 1 : 0;
  tally.cashLower += read.cashLower ? 1 : 0;
  tally.purchaseLater += read.purchaseLater ? 1 : 0;
  tally.effectsWorse += read.effectsWorse ? 1 : 0;
  tally.conservationBreaks +=
    conservationHolds(base, 0) && conservationHolds(moreEngaged, 0) ? 0 : 1;
}

const exhaustiveMemo = new Map<GymPolicy, SweepTally>();

function exhaustiveSweep(policy: GymPolicy): SweepTally {
  const memo = exhaustiveMemo.get(policy);
  if (memo !== undefined) return memo;
  const runs = new Map<number, GymRun>();
  const of = (mask: number): GymRun => {
    const found = runs.get(mask);
    if (found !== undefined) return found;
    const run = runOf(scheduleOf(mask), policy);
    runs.set(mask, run);
    return run;
  };
  const tally = emptyTally();
  const masks = 1 << SESSIONS_SWEEP.EXHAUSTIVE_SLOTS;
  for (let mask = 0; mask < masks; mask += 1) {
    for (let slot = 0; slot < SESSIONS_SWEEP.EXHAUSTIVE_SLOTS; slot += 1) {
      const bit = 1 << slot;
      if ((mask & bit) !== 0) continue;
      tallyPair(tally, of(mask), of(mask | bit));
    }
  }
  exhaustiveMemo.set(policy, tally);
  return tally;
}

const seededMemo = new Map<GymPolicy, SweepTally>();

function seededSweep(policy: GymPolicy): SweepTally {
  const memo = seededMemo.get(policy);
  if (memo !== undefined) return memo;
  const tally = emptyTally();
  const slotSeconds = T.SECONDS_PER_DAY / SESSIONS_SWEEP.SEEDED_SLOTS_PER_DAY;
  for (const lengthDays of SESSIONS_SWEEP.SEEDED_LENGTHS_DAYS) {
    for (const seed of SESSIONS_SWEEP.SEEDS) {
      const schedule = seededSchedule(seed, lengthDays);
      const attended = new Set(schedule);
      const base = runOf(schedule, policy);
      const slots = lengthDays * SESSIONS_SWEEP.SEEDED_SLOTS_PER_DAY;
      for (let slot = 0; slot < slots; slot += 1) {
        const at = (slot + 1) * slotSeconds;
        if (attended.has(at)) continue;
        tallyPair(tally, base, runOf(withExtra(schedule, at), policy));
      }
    }
  }
  seededMemo.set(policy, tally);
  return tally;
}

/** The fee control: identical hoard fold, final cash charged per check-in. */
function feeControlCashViolations(): number {
  const runs = new Map<number, number>();
  const cashOf = (mask: number): number => {
    const found = runs.get(mask);
    if (found !== undefined) return found;
    const run = runOf(scheduleOf(mask), 'hoard');
    const cash = run.state.ladder.gymBucks - run.checkIns * SESSIONS_SWEEP.CONTROL_FEE_GYM_BUCKS;
    runs.set(mask, cash);
    return cash;
  };
  let violations = 0;
  const masks = 1 << SESSIONS_SWEEP.EXHAUSTIVE_SLOTS;
  for (let mask = 0; mask < masks; mask += 1) {
    for (let slot = 0; slot < SESSIONS_SWEEP.EXHAUSTIVE_SLOTS; slot += 1) {
      const bit = 1 << slot;
      if ((mask & bit) !== 0) continue;
      if (cashOf(mask | bit) < cashOf(mask)) violations += 1;
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A gym state at `rung` with `gymBucks` settled and `items` owned. */
function gymAt(
  rung: (typeof T.LADDER_RUNGS)[number],
  gymBucks: number,
  items: readonly SessionEquipmentItem[],
): GymState {
  const opening = createGymState();
  return Object.freeze({
    ladder: Object.freeze({ ...opening.ladder, rung, gymBucks }),
    acceleratedGymBucks: 0,
    sessionEquipment: Object.freeze(
      [...items].sort(
        (left, right) =>
          T.SESSION_EQUIPMENT_ITEMS.indexOf(left) - T.SESSION_EQUIPMENT_ITEMS.indexOf(right),
      ),
    ),
  });
}

const FULL_KIT: readonly SessionEquipmentItem[] = T.SESSION_EQUIPMENT_ITEMS;

/** Every allocation of the three slots over the five slot values: 125 weeks. */
function everyAllocation(): readonly WeekAllocation[] {
  const values: readonly FlexibleSlot[] = [...T.FLEXIBLE_ACTIVITIES, 'rest'];
  const all: WeekAllocation[] = [];
  for (const a of values) {
    for (const b of values) {
      for (const c of values) all.push(Object.freeze([a, b, c]) as WeekAllocation);
    }
  }
  return all;
}

// ---------------------------------------------------------------------------
// 1. The tuning shape
// ---------------------------------------------------------------------------

describe('the stage-2 tuning shape, re-derived from the values', () => {
  it('keys every stage-2 table by exactly the item list, and groups by the group list', () => {
    const items = [...T.SESSION_EQUIPMENT_ITEMS].sort();
    expect(Object.keys(T.SESSION_EQUIPMENT_GROUP).sort()).toEqual(items);
    expect(Object.keys(T.SESSION_EQUIPMENT_COST_GYM_BUCKS).sort()).toEqual(items);
    expect(Object.keys(T.SESSION_EQUIPMENT_MIN_RUNG).sort()).toEqual(items);
    for (const item of T.SESSION_EQUIPMENT_ITEMS) {
      expect(T.SESSION_ACTIVITY_GROUPS).toContain(sessionEquipmentGroup(item));
      expect(sessionEquipmentCost(item)).toBeGreaterThan(0);
      expect(T.LADDER_RUNGS).toContain(sessionEquipmentMinRung(item));
    }
    // Grades cover exactly the three activity groups' items; support items are
    // modifiers and are graded by channel and amplifier instead.
    const activityItems = T.SESSION_EQUIPMENT_ITEMS.filter(
      (item) => sessionEquipmentGroup(item) !== 'support',
    ).sort();
    expect(Object.keys(T.SESSION_EQUIPMENT_CAPABILITY).sort()).toEqual(activityItems);
    for (const grade of Object.values(T.SESSION_EQUIPMENT_CAPABILITY)) {
      expect(grade).toBeGreaterThan(0);
    }
    const supportItems = T.SESSION_EQUIPMENT_ITEMS.filter(
      (item) => sessionEquipmentGroup(item) === 'support',
    ).sort();
    expect(Object.keys(T.SUPPORT_ITEM_CHANNEL).sort()).toEqual(supportItems);
    expect(Object.keys(T.SUPPORT_ITEM_AMPLIFIER).sort()).toEqual(supportItems);
    // Every group has at least one item, so no activity is dead content.
    for (const group of T.SESSION_ACTIVITY_GROUPS) {
      expect(
        T.SESSION_EQUIPMENT_ITEMS.filter((item) => sessionEquipmentGroup(item) === group).length,
        group,
      ).toBeGreaterThan(0);
    }
  });

  it('maps every activity to a group that exists, and higher-tier recovery is recovery', () => {
    expect(Object.keys(T.SESSION_ACTIVITY_EQUIPMENT_GROUP).sort()).toEqual(
      [...T.FLEXIBLE_ACTIVITIES].sort(),
    );
    for (const activity of T.FLEXIBLE_ACTIVITIES) {
      expect(T.SESSION_ACTIVITY_GROUPS).toContain(activityEquipmentGroup(activity));
    }
    for (const item of T.ADVANCED_RECOVERY_ITEMS) {
      expect(sessionEquipmentGroup(item)).toBe('recovery');
    }
    expect(T.ADVANCED_RECOVERY_ITEMS.length).toBeGreaterThan(0);
  });

  it('sums the fixed four and the flexible three to the §5.5 training week', () => {
    expect(T.FIXED_POWERLIFTING_SESSIONS_PER_WEEK).toBe(4);
    expect(T.FLEXIBLE_SESSIONS_PER_WEEK).toBe(3);
    expect(T.FIXED_POWERLIFTING_SESSIONS_PER_WEEK + T.FLEXIBLE_SESSIONS_PER_WEEK).toBe(
      T.DAYS_PER_TRAINING_WEEK,
    );
    // The tuple type and the tuning value agree — turning the value without
    // moving the type is red here, which is what makes the budget honest.
    expect(createRestAllocation().length).toBe(T.FLEXIBLE_SESSIONS_PER_WEEK);
  });

  it('keeps every budget guard slack: the best reachable build lands inside it', () => {
    // Re-derived, not restated: the extreme of each channel over every
    // allocation at the full kit, against its floor or cap. Slack means the
    // guard exists for the tuner who turns a rate up, not for the shipped
    // values — the `BUILD_SECONDS_MAX` pattern.
    let carryReductionMax = 0;
    let injuryReductionMax = 0;
    let techniqueMax = 0;
    let growthMax = 0;
    for (const allocation of everyAllocation()) {
      const effects = weeklyAttributeEffects(allocation, FULL_KIT);
      carryReductionMax = Math.max(carryReductionMax, 1 - effects.residualCarryMultiplier);
      injuryReductionMax = Math.max(injuryReductionMax, 1 - effects.injuryChanceMultiplier);
      techniqueMax = Math.max(techniqueMax, effects.techniqueQualityBonus);
      growthMax = Math.max(growthMax, effects.ceilingGrowthPerWeek);
    }
    expect(carryReductionMax).toBeGreaterThan(0);
    expect(carryReductionMax).toBeLessThan(1 - T.RESIDUAL_CARRY_MULTIPLIER_FLOOR);
    expect(injuryReductionMax).toBeGreaterThan(0);
    expect(injuryReductionMax).toBeLessThan(1 - T.INJURY_CHANCE_MULTIPLIER_FLOOR);
    expect(techniqueMax).toBeGreaterThan(0);
    expect(techniqueMax).toBeLessThan(T.TECHNIQUE_QUALITY_BONUS_MAX);
    expect(growthMax).toBeGreaterThan(0);
    expect(growthMax).toBeLessThan(T.CEILING_GROWTH_PER_WEEK_MAX);
    // The clamps themselves are live, driven on a synthetic build the tuner
    // could create: the guard binds when the rate is turned far enough. The
    // clamp arithmetic is exercised through the shipped floor because the
    // clamp reads the tuning, so this drives the reachable side instead: the
    // floors sit strictly inside (0, 1) and the caps strictly inside (0, 1).
    expect(T.RESIDUAL_CARRY_MULTIPLIER_FLOOR).toBeGreaterThan(0);
    expect(T.RESIDUAL_CARRY_MULTIPLIER_FLOOR).toBeLessThan(1);
    expect(T.INJURY_CHANCE_MULTIPLIER_FLOOR).toBeGreaterThan(0);
    expect(T.INJURY_CHANCE_MULTIPLIER_FLOOR).toBeLessThan(1);
    expect(T.TECHNIQUE_QUALITY_BONUS_MAX).toBeGreaterThan(0);
    expect(T.TECHNIQUE_QUALITY_BONUS_MAX).toBeLessThan(1);
    expect(T.CEILING_GROWTH_PER_WEEK_MAX).toBeGreaterThan(0);
    expect(T.CEILING_GROWTH_PER_WEEK_MAX).toBeLessThan(1);
  });

  it('bounds the seam contract against the real fatigue block', () => {
    // The wiring piece hands these to the fatigue model; the bounds that keep
    // the handoff sane are pinned against the real constants, the way
    // PHYSIO_MAX_DAYS_SAVED is. A floored carry multiplier leaves a positive
    // surviving fraction, and a floored injury multiplier leaves the injury
    // arm alive at the fatigue model's own ceiling chance.
    expect(FATIGUE_TUNING.DAILY_DECAY * T.RESIDUAL_CARRY_MULTIPLIER_FLOOR).toBeGreaterThan(0);
    expect(FATIGUE_TUNING.DAILY_DECAY * T.RESIDUAL_CARRY_MULTIPLIER_FLOOR).toBeLessThan(
      FATIGUE_TUNING.DAILY_DECAY,
    );
    expect(
      FATIGUE_TUNING.INJURY_MAX_CHANCE_PER_SESSION * T.INJURY_CHANCE_MULTIPLIER_FLOOR,
    ).toBeGreaterThan(0);
    expect(T.TECHNIQUE_QUALITY_BONUS_MAX).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// 2. The week: unrepresentability, gating, effects
// ---------------------------------------------------------------------------

describe('the fixed four are structurally non-allocatable', () => {
  it('refuses every bent allocation a cast can build, naming the fault', () => {
    // The compile-time half lives in the directives below; this is the cast
    // route the type cannot see, refused at the moment of use.
    // @ts-expect-error — a powerlifting session has no spelling in a flexible slot
    const bentSlot: WeekAllocation = ['powerlifting', 'rest', 'rest'];
    expect(() => requireWeekAllocation(bentSlot)).toThrowError(
      /powerlifting is not a flexible activity or rest/,
    );
    // @ts-expect-error — a fourth flexible session has no spelling
    const four: WeekAllocation = ['rest', 'rest', 'rest', 'rest'];
    expect(() => requireWeekAllocation(four)).toThrowError(/allocates exactly 3/);
    // @ts-expect-error — a dropped slot has no spelling
    const two: WeekAllocation = ['rest', 'rest'];
    expect(() => requireWeekAllocation(two)).toThrowError(/allocates exactly 3/);
    // The discriminating half: the legal shapes pass through unchanged.
    const legal: WeekAllocation = ['cardio', 'rest', 'stretching-yoga'];
    expect(requireWeekAllocation(legal)).toBe(legal);
    expect(requireWeekAllocation(createRestAllocation())).toEqual(['rest', 'rest', 'rest']);
  });
});

describe('capability gates activity — §5.4 read at stage-2 resolution', () => {
  it('opens with nothing available and unlocks per group, advanced recovery last', () => {
    expect(availableActivities([])).toEqual([]);
    expect(availableActivities(['bike'])).toEqual(['cardio']);
    expect(availableActivities(['dumbbells'])).toEqual(['hypertrophy']);
    expect(availableActivities(['mats'])).toEqual(['stretching-yoga']);
    // The recovery group alone does not open other-recovery; the higher-tier
    // item does — §5.5's "Recovery equipment, higher tiers".
    expect(activityAvailable(['mats', 'foam-rollers'], 'other-recovery')).toBe(false);
    expect(activityAvailable(['sauna'], 'other-recovery')).toBe(true);
    expect(availableActivities(FULL_KIT)).toEqual([...T.FLEXIBLE_ACTIVITIES]);
    // A support item gates nothing.
    expect(availableActivities(['belts', 'chalk-bowl'])).toEqual([]);
  });

  it('resolves a week into trained, rested and unequipped, naming what is missing', () => {
    const slots = resolveWeek(['cardio', 'rest', 'other-recovery'], ['bike', 'mats']);
    expect(slots[0]).toEqual({ kind: 'trained', activity: 'cardio' });
    expect(slots[1]).toEqual({ kind: 'rested' });
    // Recovery group present, higher tier absent: the report names the tier.
    expect(slots[2]).toEqual({
      kind: 'unequipped',
      activity: 'other-recovery',
      requires: 'advanced-recovery',
    });
    // Group absent entirely: the report names the group.
    const bare = resolveWeek(['hypertrophy', 'stretching-yoga', 'cardio'], []);
    expect(bare[0]).toEqual({ kind: 'unequipped', activity: 'hypertrophy', requires: 'accessory' });
    expect(bare[1]).toEqual({
      kind: 'unequipped',
      activity: 'stretching-yoga',
      requires: 'recovery',
    });
    expect(bare[2]).toEqual({ kind: 'unequipped', activity: 'cardio', requires: 'conditioning' });
  });

  it('reaches every declared slot-outcome arm and every requirement kind, counted', () => {
    // The arms census: a discriminated return's sweep is graded by which arms
    // the drive produced, not by how many inputs it was offered.
    const counts = new Map<string, number>();
    const kits: readonly (readonly SessionEquipmentItem[])[] = [
      [],
      ['bike'],
      ['mats', 'foam-rollers'],
      ['sauna'],
      FULL_KIT,
    ];
    for (const kit of kits) {
      for (const allocation of everyAllocation()) {
        for (const outcome of resolveWeek(allocation, kit)) {
          const key =
            outcome.kind === 'unequipped' ? `unequipped/${outcome.requires}` : outcome.kind;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }
    expect([...counts.keys()].sort()).toEqual([
      'rested',
      'trained',
      'unequipped/accessory',
      'unequipped/advanced-recovery',
      'unequipped/conditioning',
      'unequipped/recovery',
    ]);
    // Counts, not bounds: 5 kits x 125 allocations x 3 slots.
    let total = 0;
    for (const count of counts.values()) total += count;
    expect(total).toBe(5 * 125 * 3);
  });
});

describe('the attribute effects — §5.5 as deterministic, tunable arithmetic', () => {
  it('is the identity on an all-rest week and on an unequipped week', () => {
    const rest = weeklyAttributeEffects(createRestAllocation(), FULL_KIT);
    expect(rest.residualCarryMultiplier).toBe(1);
    expect(rest.injuryChanceMultiplier).toBe(1);
    expect(rest.techniqueQualityBonus).toBe(0);
    expect(rest.ceilingGrowthPerWeek).toBe(0);
    // Allocated but unequipped: the slots report unequipped and move nothing.
    const bare = weeklyAttributeEffects(['cardio', 'hypertrophy', 'stretching-yoga'], []);
    expect(bare).toEqual(rest);
  });

  it('moves each channel with its own activity, scaled by the group grade', () => {
    const oneCardio = weeklyAttributeEffects(['cardio', 'rest', 'rest'], ['bike']);
    expect(oneCardio.residualCarryMultiplier).toBe(
      1 - 1 * 1 * T.CARDIO_RESIDUAL_CARRY_REDUCTION_PER_GRADE_SESSION,
    );
    expect(oneCardio.injuryChanceMultiplier).toBe(1);
    // A second conditioning item raises the grade and deepens the effect.
    const graded = weeklyAttributeEffects(['cardio', 'rest', 'rest'], ['bike', 'rower']);
    expect(graded.residualCarryMultiplier).toBeLessThan(oneCardio.residualCarryMultiplier);
    expect(groupCapabilityGrade(['bike', 'rower'], 'conditioning')).toBe(2.5);
    // Hypertrophy reaches the ceiling channel and nothing else.
    const hyper = weeklyAttributeEffects(['hypertrophy', 'rest', 'rest'], ['dumbbells']);
    expect(hyper.ceilingGrowthPerWeek).toBe(
      1 * 1 * T.HYPERTROPHY_CEILING_GROWTH_PER_GRADE_SESSION,
    );
    expect(hyper.residualCarryMultiplier).toBe(1);
    // Stretching reaches injury and technique together — §5.5's row.
    const stretch = weeklyAttributeEffects(['stretching-yoga', 'rest', 'rest'], ['mats']);
    expect(stretch.injuryChanceMultiplier).toBe(
      1 - 1 * 1 * T.STRETCHING_INJURY_REDUCTION_PER_GRADE_SESSION,
    );
    expect(stretch.techniqueQualityBonus).toBe(
      1 * 1 * T.STRETCHING_TECHNIQUE_BONUS_PER_GRADE_SESSION,
    );
    // Other-recovery reaches the carry channel at its slower rate.
    const other = weeklyAttributeEffects(['other-recovery', 'rest', 'rest'], ['sauna']);
    expect(other.residualCarryMultiplier).toBe(
      1 - 1 * 2 * T.OTHER_RECOVERY_RESIDUAL_CARRY_REDUCTION_PER_GRADE_SESSION,
    );
  });

  it('lets a support item modify an earned effect and generate nothing alone', () => {
    // Belts behind zero stretching sessions: identity. The modifier
    // multiplies the earned base, so an empty base stays empty.
    const beltsAlone = weeklyAttributeEffects(['cardio', 'rest', 'rest'], ['bike', 'belts']);
    expect(beltsAlone.injuryChanceMultiplier).toBe(1);
    // Belts behind one stretching session: the earned reduction is amplified.
    const withBelts = weeklyAttributeEffects(
      ['stretching-yoga', 'rest', 'rest'],
      ['mats', 'belts'],
    );
    const bare = weeklyAttributeEffects(['stretching-yoga', 'rest', 'rest'], ['mats']);
    expect(1 - withBelts.injuryChanceMultiplier).toBeCloseTo(
      (1 - bare.injuryChanceMultiplier) * (1 + T.SUPPORT_ITEM_AMPLIFIER.belts),
      10,
    );
    expect(supportAmplifier(['belts', 'sleeves'], 'injury-risk')).toBeCloseTo(
      T.SUPPORT_ITEM_AMPLIFIER.belts + T.SUPPORT_ITEM_AMPLIFIER.sleeves,
      10,
    );
    expect(supportAmplifier(['belts'], 'technique-quality')).toBe(0);
  });

  it('varies across the allocation axis, measured rather than assumed', () => {
    // The axis rule: the effects sweep is only evidence if the allocation
    // axis actually moves the output. Distinct effect tuples over the 125
    // allocations at the full kit, counted.
    const distinct = new Set<string>();
    for (const allocation of everyAllocation()) {
      const effects = weeklyAttributeEffects(allocation, FULL_KIT);
      distinct.add(
        [
          effects.residualCarryMultiplier,
          effects.injuryChanceMultiplier,
          effects.techniqueQualityBonus,
          effects.ceilingGrowthPerWeek,
        ].join('/'),
      );
    }
    // 3 slots over unordered multisets of 5 values: 35 distinct allocations,
    // and every one lands its own effects tuple at the full kit.
    expect(distinct.size).toBe(35);
  });

  it('compounds the ceiling growth multiplicatively and refuses a bent series', () => {
    const week = weeklyAttributeEffects(['hypertrophy', 'hypertrophy', 'hypertrophy'], FULL_KIT);
    const three = composedCeilingGrowth([week, week, week]);
    expect(three).toBeCloseTo((1 + week.ceilingGrowthPerWeek) ** 3 - 1, 6);
    expect(composedCeilingGrowth([])).toBe(0);
    expect(three).toBeGreaterThan(3 * week.ceilingGrowthPerWeek - 1e-9);
    const bent = { ...week, ceilingGrowthPerWeek: -0.1 as never };
    expect(() => composedCeilingGrowth([bent])).toThrowError(/finite and at or above zero/);
  });
});

// ---------------------------------------------------------------------------
// 3. State, transitions, and the buy arms
// ---------------------------------------------------------------------------

describe('the state constructor and the cast-route refusals', () => {
  it('opens with the stage-1 ladder, both purses at their floor, no stage-2 items', () => {
    const opening = createGymState();
    expect(opening.ladder.rung).toBe('garage');
    expect(opening.acceleratedGymBucks).toBe(0);
    expect(opening.sessionEquipment).toEqual([]);
    expect(requireGymState(opening)).toBe(opening);
  });

  it('refuses every malformed state a cast can build, naming the fault', () => {
    const opening = createGymState();
    expect(() =>
      requireGymState({ ...opening, acceleratedGymBucks: -1 }),
    ).toThrowError(/accelerated purse must be finite/);
    expect(() =>
      requireGymState({
        ...opening,
        sessionEquipment: ['bike', 'bike'] as unknown as readonly SessionEquipmentItem[],
      }),
    ).toThrowError(/held twice/);
    expect(() =>
      requireGymState({
        ...opening,
        sessionEquipment: ['power-cage'] as unknown as readonly SessionEquipmentItem[],
      }),
    ).toThrowError(/not a stage-2 equipment item/);
    expect(() =>
      requireGymState({
        ...opening,
        sessionEquipment: ['treadmill', 'bike'] as unknown as readonly SessionEquipmentItem[],
      }),
    ).toThrowError(/fixed item order/);
  });

  it('buys from the settled purse alone, and reaches every refusal arm, counted', () => {
    const counts = new Map<string, number>();
    const note = (key: string): void => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };
    // Bought: money and rung both suffice.
    const rich = gymAt('strip-mall-unit', 50000, []);
    const bought = buySessionEquipment(rich, 'treadmill');
    note(bought.kind);
    expect(bought.kind).toBe('bought');
    if (bought.kind === 'bought') {
      expect(bought.state.ladder.gymBucks).toBe(50000 - sessionEquipmentCost('treadmill'));
      expect(bought.state.sessionEquipment).toEqual(['treadmill']);
      // The accelerated purse is untouched by a capability purchase.
      expect(bought.state.acceleratedGymBucks).toBe(0);
    }
    // Already owned.
    if (bought.kind === 'bought') {
      const again = buySessionEquipment(bought.state, 'treadmill');
      note(again.kind === 'refused' ? `refused/${again.reason}` : again.kind);
      expect(again.kind === 'refused' && again.reason === 'already-owned').toBe(true);
      expect(again.state).toBe(bought.state);
    }
    // Rung too low: a sled needs the warehouse floor.
    const cramped = buySessionEquipment(gymAt('strip-mall-unit', 50000, []), 'sled');
    note(cramped.kind === 'refused' ? `refused/${cramped.reason}` : cramped.kind);
    expect(cramped.kind === 'refused' && cramped.reason === 'rung-too-low').toBe(true);
    // Not enough settled money — and the accelerated purse cannot cover the
    // shortfall, which is the funding split read at one call site: the same
    // state with a fat accelerated purse is refused identically.
    const poor = gymAt('strip-mall-unit', 10, []);
    const refusedPoor = buySessionEquipment(poor, 'treadmill');
    note(refusedPoor.kind === 'refused' ? `refused/${refusedPoor.reason}` : refusedPoor.kind);
    expect(refusedPoor.kind === 'refused' && refusedPoor.reason === 'not-enough-gym-bucks').toBe(
      true,
    );
    const poorButGranted = grantAcceleratedGymBucks(poor, 1000000);
    const refusedGranted = buySessionEquipment(poorButGranted, 'treadmill');
    expect(
      refusedGranted.kind === 'refused' && refusedGranted.reason === 'not-enough-gym-bucks',
    ).toBe(true);
    // Every declared arm was reached exactly once (the granted twin repeats
    // an arm on purpose and is not noted).
    expect([...counts.keys()].sort()).toEqual([
      'bought',
      'refused/already-owned',
      'refused/not-enough-gym-bucks',
      'refused/rung-too-low',
    ]);
    for (const count of counts.values()) expect(count).toBe(1);
  });

  it('credits the accelerated purse on a grant and refuses a bent amount', () => {
    const opening = createGymState();
    const granted = grantAcceleratedGymBucks(opening, 1234);
    expect(granted.acceleratedGymBucks).toBe(1234);
    expect(granted.ladder).toBe(opening.ladder);
    expect(() => grantAcceleratedGymBucks(opening, -1)).toThrowError(/finite and at or above/);
    expect(() => grantAcceleratedGymBucks(opening, Number.NaN)).toThrowError(
      /finite and at or above/,
    );
  });

  it('accrues a check-in into the settled purse through the stage-1 mechanism', () => {
    const opening = createGymState();
    const checked = gymCheckIn(opening, 3600);
    expect(checked.state.ladder.gymBucks).toBeCloseTo(
      T.LADDER_INCOME_GYM_BUCKS_PER_HOUR.garage * T.OFFLINE_EARNINGS_FRACTION,
      6,
    );
    expect(checked.accrual.secondsBanked).toBe(3600);
    expect(checked.state.acceleratedGymBucks).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. The composed run: determinism, refusals, the decision-density measurement
// ---------------------------------------------------------------------------

describe('runGym — deterministic, conserving, refusing a bent schedule', () => {
  it('refuses a bent schedule, policy, destination, plan or grant list', () => {
    const plan = sweepPlan();
    expect(() =>
      runGym(
        { checkInsSeconds: [43200, 43200], allocationPlan: plan, grants: [] },
        'cheapest-affordable-first',
        'accelerated-purse',
      ),
    ).toThrowError(/strictly ascending/);
    expect(() =>
      runGym(
        { checkInsSeconds: [], allocationPlan: [], grants: [] },
        'hoard',
        'accelerated-purse',
      ),
    ).toThrowError(/at least one week/);
    expect(() =>
      runGym(
        scheduleFor([43200], [{ atSeconds: 100, gymBucks: -5 }]),
        'hoard',
        'accelerated-purse',
      ),
    ).toThrowError(/finite and at or above zero/);
    expect(() =>
      runGym(
        scheduleFor(
          [43200],
          [
            { atSeconds: 100, gymBucks: 5 },
            { atSeconds: 50, gymBucks: 5 },
          ],
        ),
        'hoard',
        'accelerated-purse',
      ),
    ).toThrowError(/ascending time/);
    expect(() =>
      runGym(scheduleFor([43200], []), 'spend-it-all' as never, 'accelerated-purse'),
    ).toThrowError(/not a gym policy/);
    expect(() =>
      runGym(scheduleFor([43200], []), 'hoard', 'chalk-purse' as never),
    ).toThrowError(/not a grant destination/);
  });

  it('is byte-identical on identical inputs, across the seeded domain, twice', () => {
    for (const seed of SESSIONS_SWEEP.SEEDS) {
      const schedule = seededSchedule(seed, 40);
      for (const policy of GYM_POLICIES) {
        expect(JSON.stringify(runOf(schedule, policy))).toBe(
          JSON.stringify(runOf(schedule, policy)),
        );
      }
    }
  });

  it('conserves money exactly on every run of the seeded domain', () => {
    let runs = 0;
    for (const seed of SESSIONS_SWEEP.SEEDS) {
      for (const lengthDays of SESSIONS_SWEEP.SEEDED_LENGTHS_DAYS) {
        for (const policy of GYM_POLICIES) {
          const run = runOf(seededSchedule(seed, lengthDays), policy);
          expect(conservationHolds(run, 0)).toBe(true);
          runs += 1;
        }
      }
    }
    expect(runs).toBe(SESSIONS_SWEEP.SEEDS.length * 2 * 2);
  });

  it('reports a week from the equipment held at its first second', () => {
    // The stated rule of the header §5: a mid-week purchase counts from the
    // next week. Canonical cadence, eager policy: mats land on day 0.5, so
    // week 0 (whose first second is 0) trains stretching against nothing and
    // week 1 trains it against the mats.
    const run = runGym(
      {
        checkInsSeconds: canonicalSchedule(15),
        allocationPlan: [Object.freeze(['stretching-yoga', 'rest', 'rest']) as WeekAllocation],
        grants: [],
      },
      'cheapest-affordable-first',
      'accelerated-purse',
    );
    const first = run.weeks[0] as { slots: readonly SlotOutcome[] };
    const second = run.weeks[1] as { slots: readonly SlotOutcome[] };
    expect(first.slots[0]).toEqual({
      kind: 'unequipped',
      activity: 'stretching-yoga',
      requires: 'recovery',
    });
    expect(second.slots[0]).toEqual({ kind: 'trained', activity: 'stretching-yoga' });
    expect(purchaseDayOf(run, 'mats')).toBe(43200);
  });

  it('pins the canonical twice-daily run: every purchase day, and the band metrics', () => {
    // The stage-1 gate's diagnosis, measured against the repair: at the
    // cadence the 3.7 / 6.6 / 18.7 rhythm was measured at, the eager buyer's
    // whole decision list, pinned by item and by day. The strip-mall band
    // used to hold zero purchases after the rack; the pin below is what it
    // holds now, and the two derived metrics after it are the design target
    // read out of the run.
    const run = runGym(
      scheduleFor(canonicalSchedule(SESSIONS_SWEEP.CANONICAL_DAYS), []),
      'cheapest-affordable-first',
      'accelerated-purse',
    );
    const day = (seconds: number): number => seconds / T.SECONDS_PER_DAY;
    const purchases = run.purchases.map((p) => `${p.item}@${day(p.atSeconds)}`);
    const moves = run.movedTo.map((m) => `${m.to}@${day(m.atSeconds)}`);
    expect(purchases).toEqual([
      'mats@0.5',
      'chalk-bowl@1',
      'foam-rollers@5',
      'belts@5',
      'dumbbells@5.5',
      'squat-rack@6',
      'bike@6.5',
      'sleeves@13.5',
      'treadmill@14',
      'cables@15',
      'rower@16',
      'specialty-bars@17.5',
      'machines@19.5',
      'sauna@22',
      'sled@33.5',
    ]);
    expect(moves).toEqual(['storage-unit@4.5', 'strip-mall-unit@13', 'warehouse@33']);

    // The band metrics, derived from the run rather than asserted in prose.
    const stripMallAt = run.movedTo[1]?.atSeconds ?? Number.POSITIVE_INFINITY;
    const warehouseAt = run.movedTo[2]?.atSeconds ?? Number.POSITIVE_INFINITY;
    const decisionsInBand = run.purchases.filter(
      (p) => p.atSeconds >= stripMallAt && p.atSeconds < warehouseAt,
    );
    expect(decisionsInBand.length).toBe(7);
    // The largest empty stretch inside the band, in days, decisions and the
    // relocation included as its endpoints. The stage-1 measurement was the
    // whole band empty (~19 days at this cadence, ~38 check-ins); the tail
    // save for the warehouse is now the one long quiet stretch.
    const marks = [stripMallAt, ...decisionsInBand.map((p) => p.atSeconds), warehouseAt];
    let largestGapDays = 0;
    for (let at = 1; at < marks.length; at += 1) {
      largestGapDays = Math.max(largestGapDays, day((marks[at] as number) - (marks[at - 1] as number)));
    }
    expect(largestGapDays).toBe(11);
    // And the weekly allocation stays a live choice across the run: the
    // available-activity set changes as capability arrives.
    const availabilitySteps = new Set(
      run.weeks.map((week) => week.slots.filter((slot) => slot.kind === 'trained').length),
    );
    expect(availabilitySteps.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Never punish engagement — element-wise, with the control pinned
// ---------------------------------------------------------------------------

describe('never punish engagement: an extra check-in is not a loss, measured', () => {
  it('holds exhaustively, on every subset of the slot grid, under both policies', () => {
    for (const policy of GYM_POLICIES) {
      const tally = exhaustiveSweep(policy);
      expect(tally.pairs).toBe(SESSIONS_SWEEP.EXHAUSTIVE_PAIRS);
      expect(tally.accruedLower).toBe(0);
      expect(tally.rungLower).toBe(0);
      expect(tally.equipmentNotSuperset).toBe(0);
      expect(tally.purchaseLater).toBe(0);
      expect(tally.effectsWorse).toBe(0);
      expect(tally.conservationBreaks).toBe(0);
      if (policy === 'hoard') expect(tally.cashLower).toBe(0);
    }
  });

  it('holds on the seeded 40- and 100-day calendars, under both policies', () => {
    for (const policy of GYM_POLICIES) {
      const tally = seededSweep(policy);
      expect(tally.pairs).toBe(453);
      expect(tally.accruedLower).toBe(0);
      expect(tally.rungLower).toBe(0);
      expect(tally.equipmentNotSuperset).toBe(0);
      expect(tally.purchaseLater).toBe(0);
      expect(tally.effectsWorse).toBe(0);
      expect(tally.conservationBreaks).toBe(0);
      if (policy === 'hoard') expect(tally.cashLower).toBe(0);
    }
  });

  it('keeps the punishing shape countable: the fee control is not zero', () => {
    // The identical fold with a per-check-in fee. Every pair is a violation
    // at this fee, which is what says the counter above can count.
    expect(feeControlCashViolations()).toBe(SESSIONS_SWEEP.EXHAUSTIVE_PAIRS);
  });
});

// ---------------------------------------------------------------------------
// 6. The crown sweep — the E6 element-wise shape
// ---------------------------------------------------------------------------

describe('purchased or accelerated currency buys no training outcome, element-wise', () => {
  /** The grant plans: every derived size, landed at three points of the run. */
  function grantPlans(schedule: readonly number[]): readonly (readonly AcceleratedGrant[])[] {
    const last = schedule[schedule.length - 1] as number;
    const plans: (readonly AcceleratedGrant[])[] = [];
    for (const size of grantSizes()) {
      for (const fraction of SESSIONS_SWEEP.GRANT_AT_FRACTIONS) {
        plans.push(Object.freeze([{ atSeconds: Math.floor(last * fraction), gymBucks: size }]));
      }
    }
    // One plan granting every size in sequence, spread across the run.
    const sizes = grantSizes();
    plans.push(
      Object.freeze(
        sizes.map((size, at) =>
          Object.freeze({
            atSeconds: Math.floor((last * at) / sizes.length),
            gymBucks: size,
          }),
        ),
      ),
    );
    return Object.freeze(plans);
  }

  const CROWN_SCHEDULES: readonly (readonly number[])[] = [
    canonicalSchedule(SESSIONS_SWEEP.CANONICAL_DAYS),
    seededSchedule(11, 40),
    seededSchedule(23, 100),
  ];

  interface CrownTally {
    comparisons: number;
    grantsLanded: number;
    purchasesMoved: number;
    movesMoved: number;
    weeksMoved: number;
    accruedMoved: number;
    settledMoved: number;
  }

  function crownTally(destination: (typeof GRANT_DESTINATIONS)[number]): CrownTally {
    const tally: CrownTally = {
      comparisons: 0,
      grantsLanded: 0,
      purchasesMoved: 0,
      movesMoved: 0,
      weeksMoved: 0,
      accruedMoved: 0,
      settledMoved: 0,
    };
    for (const schedule of CROWN_SCHEDULES) {
      const base = runGym(scheduleFor(schedule, []), 'cheapest-affordable-first', destination);
      for (const grants of grantPlans(schedule)) {
        const granted = runGym(
          scheduleFor(schedule, grants),
          'cheapest-affordable-first',
          destination,
        );
        tally.comparisons += 1;
        tally.grantsLanded += granted.grantsLanded;
        if (JSON.stringify(granted.purchases) !== JSON.stringify(base.purchases)) {
          tally.purchasesMoved += 1;
        }
        if (JSON.stringify(granted.movedTo) !== JSON.stringify(base.movedTo)) {
          tally.movesMoved += 1;
        }
        if (JSON.stringify(granted.weeks) !== JSON.stringify(base.weeks)) {
          tally.weeksMoved += 1;
        }
        if (granted.accruedGymBucks !== base.accruedGymBucks) tally.accruedMoved += 1;
        if (
          destination === 'accelerated-purse' &&
          granted.state.ladder.gymBucks !== base.state.ladder.gymBucks
        ) {
          tally.settledMoved += 1;
        }
        // Non-vacuity per pair: the granted twin really was granted.
        expect(granted.grantedGymBucks).toBeGreaterThan(0);
        if (destination === 'accelerated-purse') {
          // The whole grant is on the accelerated purse and nowhere else.
          expect(granted.state.acceleratedGymBucks).toBeCloseTo(
            grants.reduce(
              (sum, grant) => (grant.atSeconds <= (schedule[schedule.length - 1] as number) ? sum + grant.gymBucks : sum),
              0,
            ),
            6,
          );
        }
      }
    }
    return tally;
  }

  it('leaves every training-outcome series byte-identical under every grant plan', () => {
    const tally = crownTally('accelerated-purse');
    // The domain is real: 3 schedules x (sizes x 3 fractions + 1 combined).
    expect(tally.comparisons).toBe(CROWN_SCHEDULES.length * (grantSizes().length * 3 + 1));
    expect(tally.grantsLanded).toBeGreaterThan(0);
    // The claim, element by element: capability arrivals, relocations, the
    // weekly effect and legality series, the settled accrual and the settled
    // balance all identical between the granted twin and the base.
    expect(tally.purchasesMoved).toBe(0);
    expect(tally.movesMoved).toBe(0);
    expect(tally.weeksMoved).toBe(0);
    expect(tally.accruedMoved).toBe(0);
    expect(tally.settledMoved).toBe(0);
  });

  it('keeps the wired-accelerant control runnable, and its counts are not zero', () => {
    // The same fold with grants credited to the settled purse — the mutant
    // the sweep exists to catch, kept as a named destination so the zeros
    // above are zero against a counter that counts. Under it, granted money
    // buys capability: purchase days move, and the weekly effect series
    // moves with them.
    const tally = crownTally('settled-purse-wired-control');
    expect(tally.comparisons).toBe(CROWN_SCHEDULES.length * (grantSizes().length * 3 + 1));
    expect(tally.purchasesMoved).toBeGreaterThan(0);
    expect(tally.weeksMoved).toBeGreaterThan(0);
    expect(tally.movesMoved).toBeGreaterThan(0);
    // Attribution, pinned exactly so a weakening of the control is loud.
    expect(tally.purchasesMoved).toBe(126);
    expect(tally.movesMoved).toBe(125);
    expect(tally.weeksMoved).toBe(71);
  });

  it('derives the grant domain from every price the subject branches on', () => {
    // Containment, not density: every `balance < price` branch point in
    // stage 2 is one of these three tables, and every row is a grant size.
    const sizes = new Set(grantSizes());
    for (const item of T.SESSION_EQUIPMENT_ITEMS) {
      expect(sizes.has(sessionEquipmentCost(item)), item).toBe(true);
    }
    for (const item of T.LADDER_EQUIPMENT_ITEMS) {
      expect(sizes.has(ladderEquipmentCost(item)), item).toBe(true);
    }
    for (const rung of ['storage-unit', 'strip-mall-unit', 'warehouse'] as const) {
      expect(sizes.has(ladderMoveCost(rung)), rung).toBe(true);
    }
  });
});
