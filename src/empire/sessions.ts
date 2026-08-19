/**
 * sessions.ts — GDD §5 (v2) stage 2: sessions and equipment groups.
 *
 * §5.11's second stage, pure logic only: the remaining §5.4 equipment groups
 * (Conditioning, Accessory, Recovery, Support), §5.5's sessions model — four
 * powerlifting sessions fixed and guaranteed, three flexible sessions
 * allocated — and the attribute effects as pure outputs. No members (stage 3),
 * no portfolio, no condition decay (stage 4), no sponsors (stage 5). Stage 1's
 * ladder is `ladder.ts` and is composed, not re-implemented: the rung, the
 * settled purse and the Barbell group live there, and this module's state
 * carries a `LadderState` whole.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock reading, no randomness. Its imports are
 * `./empireTuning`, `./ladder`, `./production` and `./empireCore` (for
 * `refuseWith`, the directory's throw gate).
 *
 * ===========================================================================
 * 1. The fixed four are structurally non-allocatable, not defaulted
 * ===========================================================================
 *
 * §5.5: "Four powerlifting sessions per week are fixed and guaranteed — they
 * do not compete with anything else for a slot."
 *
 * `WeekAllocation` is a tuple of exactly the three flexible slots, and a slot
 * admits a `FlexibleActivity` or `'rest'`. There is no powerlifting member in
 * that union and no fourth position in the tuple, so "reallocate a
 * powerlifting session" has no spelling in the type: writing a powerlifting
 * token into a slot is a compile error, and growing or shrinking the tuple is
 * one too. The four exist in this module as the tuning constant
 * `FIXED_POWERLIFTING_SESSIONS_PER_WEEK` — a number a screen can print and a
 * test can sum to §5.5's "7 total" — and as nothing any allocation can reach.
 * This is the same unrepresentability move `ladder.ts` §1 makes for the
 * one-rung phase.
 *
 * Bounded claim, limit, catcher: the type closes the honest route; a caller
 * can still cast a bent tuple in, which is why every consumer runs
 * `requireWeekAllocation` and refuses a slot off the vocabulary or a tuple off
 * the length at runtime, and `sessions.test.ts` drives both refusals and pins
 * the compile-time half with type-level probes.
 *
 * ===========================================================================
 * 2. Capability gates activity, and the gate is the equipment list
 * ===========================================================================
 *
 * §5.4/§5.5: an activity is available exactly when its equipment group has at
 * least one item present — cardio needs Conditioning, hypertrophy needs
 * Accessory, stretching/yoga needs Recovery, and other-recovery needs
 * Recovery plus one of the higher-tier items (`ADVANCED_RECOVERY_ITEMS`).
 * Item grades then decide how much a session moves the attribute outputs, so
 * a group's second and third item are decisions rather than stock. Support
 * items are §5.4's "Modifiers to the above": each amplifies one named
 * attribute channel and generates nothing on its own — a belt behind zero
 * stretching sessions moves nothing, which `sessions.test.ts` drives.
 *
 * An allocated slot whose activity is not available is reported as
 * `'unequipped'` and contributes nothing — reported, not silent, the same
 * rule the streak system's consumption reporting follows. The report names
 * what is missing, so a screen can sell the purchase that fixes it.
 *
 * ===========================================================================
 * 3. The funding split: capability buys from the settled purse
 * ===========================================================================
 *
 * §5.5, non-negotiable: "Accelerated or purchased currency must never buy a
 * training outcome — the wall-clock/accelerated funding split applies
 * unchanged (§5.10)." Every item in this stage gates or grades a training
 * activity, and hypertrophy reaches the e1RM ceiling, so every stage-2 item
 * is a training outcome one hop out — as is stage 1's Barbell group, which
 * gates the competition lifts.
 *
 * The split at stage 2: `GymState.ladder.gymBucks` is the settled purse. Its
 * whole credit surface is `ladderCheckIn`'s wall-clock accrual — stage 1
 * shipped it single-sourced, and this module adds no second source. Every
 * capability purchase (`buySessionEquipment` here, `buyLadderEquipment` and
 * `moveUpLadder` through the composed run) debits that purse and no other.
 * `GymState.acceleratedGymBucks` is the accelerated purse: purchased or
 * accelerated currency lands there and, at stage 2, nothing spends it — the
 * §8.3A/§8.3B sinks (decor, cosmetics) arrive with later stages, so the purse
 * ships with its spender count at zero on purpose, the seam cut before the
 * wiring exists.
 *
 * Bounded claim, limit, catcher — stated because the last four opacity
 * absolutes in this repository were bypassed and the bounded form was not:
 * the claim is that no affordability read in this module mentions
 * `acceleratedGymBucks`, so a granted amount moves no purchase day, no
 * effect and no legality bit. The limit: both purses are plain numbers, and
 * `ladder.gymBucks + acceleratedGymBucks` fed back through a hand-built state
 * is arithmetic no type here can see. The catcher for that route is the crown
 * sweep in `sessions.test.ts`: element-wise byte-identity of purchase days,
 * weekly effect series and slot legality between runs identical except for
 * granted currency, with the wired-accelerant control (`GRANT_DESTINATIONS`'
 * second member) kept runnable and its divergence count pinned non-zero — the
 * E6 shape that caught the v1 chain-A mutant.
 *
 * ===========================================================================
 * 4. Attribute effects are pure outputs, and the fatigue seam is a contract
 * ===========================================================================
 *
 * §5.11 stage 2 says the effects wire into the existing fatigue model.
 * `src/game/fatigue.ts` is another session's file, and this directory's
 * import fence resolves every specifier to a module inside `src/empire/` —
 * so this stage is pure-logic-first against the seam, the same move that
 * made §5 v1 and Career safe. Nothing here is wired into anything.
 *
 * `WeeklyAttributeEffects` is that contract: a frozen object of four branded
 * quantities with the unit in the brand, produced by
 * `weeklyAttributeEffects` and consumed today by tests and by the composed
 * run. What each field is FOR, in the fatigue model's own terms, so the
 * later serialised wiring piece hands values rather than reinterprets them:
 *
 *   - `residualCarryMultiplier` multiplies the fraction of fatigue residual
 *     that survives a night (`FATIGUE_TUNING.DAILY_DECAY`'s subject). 1 is
 *     no effect; the floor keeps sleep mattering.
 *   - `injuryChanceMultiplier` multiplies the per-session injury chance
 *     (`INJURY_CHANCE_PER_OVERREACH`'s subject). 1 is no effect; the floor
 *     keeps the injury arm alive — allocation may shrink risk, not erase it.
 *   - `techniqueQualityBonus` is an additive 0..max bonus for the depth
 *     check's quality read (GDD §6.2's "technique quality at depth").
 *   - `ceilingGrowthPerWeek` is the fraction the e1RM ceiling grows this
 *     week; `composedCeilingGrowth` compounds a series of weeks.
 *
 * `sessions.test.ts` imports the real `FATIGUE_TUNING` (a test may cross the
 * fence; a shipped module may not) and bounds the contract against it, the
 * way `PHYSIO_MAX_DAYS_SAVED` is bounded.
 *
 * ===========================================================================
 * 5. The composed run — what the sweeps drive
 * ===========================================================================
 *
 * `runGym` folds a check-in schedule, a weekly allocation plan and a list of
 * accelerated-currency grants through the whole stage-2 loop under a named
 * policy, and reports everything: purchases with their times, relocations
 * with their times, and one report per completed week carrying the
 * allocation, the per-slot legality and the effects. Deterministic by
 * construction — no draw, no clock read, ties on cost keep the earlier
 * candidate in the fixed enumeration order (Barbell items, then session
 * items, then the relocation).
 *
 * A week's effects read the equipment held at the week's first second, so a
 * mid-week purchase counts from the next week — one rule, stated here,
 * pinned in `sessions.test.ts`. Weeks are reported only once complete: a
 * schedule ending mid-week reports the finished weeks and not the stub.
 */

import { refuseWith } from './empireCore';
import {
  type LadderAccrual,
  type LadderDestination,
  type LadderEquipmentItem,
  type LadderRung,
  type LadderState,
  buyLadderEquipment,
  createLadderState,
  ladderCheckIn,
  ladderEquipmentCost,
  ladderEquipmentMinRung,
  ladderMoveCost,
  ladderRungIndex,
  moveUpLadder,
  nextLadderRung,
  requireLadderState,
} from './ladder';
import { scrubPrecision } from './production';
import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// Vocabulary, derived from the tuning block rather than restated
// ---------------------------------------------------------------------------

/** A §5.4 stage-2 equipment group. Stage 1's Barbell group lives on the ladder. */
export type SessionActivityGroup = (typeof EMPIRE_TUNING.SESSION_ACTIVITY_GROUPS)[number];

/** A stage-2 equipment item, across all four groups. */
export type SessionEquipmentItem = (typeof EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS)[number];

/** An item that carries a capability grade — the three activity groups' items. */
export type ActivityEquipmentItem = keyof typeof EMPIRE_TUNING.SESSION_EQUIPMENT_CAPABILITY;

/** A §5.4 Support item — a modifier, graded by channel and amplifier instead. */
export type SupportItem = keyof typeof EMPIRE_TUNING.SUPPORT_ITEM_CHANNEL;

/** An attribute channel a Support item may amplify. */
export type SupportChannel = (typeof EMPIRE_TUNING.SUPPORT_ITEM_CHANNEL)[SupportItem];

/** A §5.5 flexible activity. There is no powerlifting member here — header §1. */
export type FlexibleActivity = (typeof EMPIRE_TUNING.FLEXIBLE_ACTIVITIES)[number];

/** What one flexible slot may hold: an activity, or rest. */
export type FlexibleSlot = FlexibleActivity | 'rest';

/**
 * One week's allocation of the three flexible sessions — the whole of what a
 * player may allocate. A tuple, not an array: the length is part of the type,
 * so a fourth session cannot be written and a slot cannot be dropped. The
 * fixed four have no field here at all (header §1).
 */
export type WeekAllocation = readonly [FlexibleSlot, FlexibleSlot, FlexibleSlot];

/**
 * The spending policies `runGym` composes with — the same two tokens
 * `ladder.ts` ships, reused on purpose: same meaning, same census row.
 */
export const GYM_POLICIES = Object.freeze(['hoard', 'cheapest-affordable-first'] as const);

export type GymPolicy = (typeof GYM_POLICIES)[number];

/**
 * Where a currency grant lands, and the crown sweep's control axis.
 *
 * `'accelerated-purse'` is the shipped rule: purchased or accelerated Gym
 * Bucks credit `GymState.acceleratedGymBucks`, which nothing at stage 2
 * spends. `'settled-purse-wired-control'` is a control, not a game rule: the
 * identical fold with grants credited to the settled purse, kept runnable so
 * the crown sweep's zeros are zero against a counter that counts — under it,
 * granted money buys capability and the divergence count in
 * `sessions.test.ts` is pinned non-zero. No screen and no wiring piece may
 * reach for the second token; it exists to be measured against.
 */
export const GRANT_DESTINATIONS = Object.freeze([
  'accelerated-purse',
  'settled-purse-wired-control',
] as const);

export type GrantDestination = (typeof GRANT_DESTINATIONS)[number];

// ---------------------------------------------------------------------------
// The fatigue-seam contract's branded quantities — header §4
// ---------------------------------------------------------------------------

declare const STAGE_TWO_BRAND: unique symbol;

type Branded<T, B extends string> = T & { readonly [STAGE_TWO_BRAND]: B };

/** Multiplies the overnight-surviving fraction of fatigue residual. Floor..1. */
export type ResidualCarryMultiplier = Branded<number, 'residual-carry-multiplier'>;

/** Multiplies the per-session injury chance. Floor..1. */
export type InjuryChanceMultiplier = Branded<number, 'injury-chance-multiplier'>;

/** Additive depth-check quality bonus. 0..max. */
export type TechniqueQualityBonus = Branded<number, 'technique-quality-bonus'>;

/** Fraction the e1RM ceiling grows this week. 0..max, compounded across weeks. */
export type CeilingGrowthPerWeek = Branded<number, 'ceiling-growth-per-week'>;

/**
 * One week's attribute effects — the seam contract of header §4. Produced only
 * by `weeklyAttributeEffects`, frozen, every field branded with its unit.
 */
export interface WeeklyAttributeEffects {
  readonly residualCarryMultiplier: ResidualCarryMultiplier;
  readonly injuryChanceMultiplier: InjuryChanceMultiplier;
  readonly techniqueQualityBonus: TechniqueQualityBonus;
  readonly ceilingGrowthPerWeek: CeilingGrowthPerWeek;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** The §5.4 group `item` belongs to. Loud on a cast-in item with no row. */
export function sessionEquipmentGroup(item: SessionEquipmentItem): SessionActivityGroup {
  const group: SessionActivityGroup | undefined = EMPIRE_TUNING.SESSION_EQUIPMENT_GROUP[item];
  if (group === undefined) refuseWith(`${String(item)} is in no stage-2 equipment group`);
  return group;
}

/** An item's flat published price. */
export function sessionEquipmentCost(item: SessionEquipmentItem): number {
  const cost = EMPIRE_TUNING.SESSION_EQUIPMENT_COST_GYM_BUCKS[item];
  if (!Number.isFinite(cost) || cost < 0) {
    refuseWith(`${String(item)} has no price on the stage-2 equipment list`);
  }
  return cost;
}

/** The lowest rung whose space fits `item`. */
export function sessionEquipmentMinRung(item: SessionEquipmentItem): LadderRung {
  const rung: LadderRung | undefined = EMPIRE_TUNING.SESSION_EQUIPMENT_MIN_RUNG[item];
  if (rung === undefined) refuseWith(`${String(item)} has no minimum rung`);
  return rung;
}

/** The equipment group `activity` requires — §5.5's table, second column. */
export function activityEquipmentGroup(activity: FlexibleActivity): SessionActivityGroup {
  const group: SessionActivityGroup | undefined =
    EMPIRE_TUNING.SESSION_ACTIVITY_EQUIPMENT_GROUP[activity];
  if (group === undefined) refuseWith(`${String(activity)} requires no equipment group`);
  return group;
}

/** An activity item's capability grade; a Support item grades nothing here. */
function capabilityGradeOf(item: SessionEquipmentItem): number {
  const table: Readonly<Partial<Record<SessionEquipmentItem, number>>> =
    EMPIRE_TUNING.SESSION_EQUIPMENT_CAPABILITY;
  return table[item] ?? 0;
}

/**
 * The summed capability grade of the owned items of `group` — what scales how
 * far a session of that group's activity moves the attribute outputs.
 */
export function groupCapabilityGrade(
  equipment: readonly SessionEquipmentItem[],
  group: SessionActivityGroup,
): number {
  let grade = 0;
  for (const item of equipment) {
    if (sessionEquipmentGroup(item) === group) grade += capabilityGradeOf(item);
  }
  return scrubPrecision(grade);
}

/**
 * The summed Support amplifier on `channel` from the owned items — §5.4's
 * modifiers. Multiplies an earned effect and generates nothing on its own,
 * because the callers below apply it to the session-earned base.
 */
export function supportAmplifier(
  equipment: readonly SessionEquipmentItem[],
  channel: SupportChannel,
): number {
  const channels: Readonly<Partial<Record<SessionEquipmentItem, SupportChannel>>> =
    EMPIRE_TUNING.SUPPORT_ITEM_CHANNEL;
  const amplifiers: Readonly<Partial<Record<SessionEquipmentItem, number>>> =
    EMPIRE_TUNING.SUPPORT_ITEM_AMPLIFIER;
  let amplifier = 0;
  for (const item of equipment) {
    if (channels[item] === channel) amplifier += amplifiers[item] ?? 0;
  }
  return scrubPrecision(amplifier);
}

/** Whether any owned item belongs to `group`. A loop, not a member call. */
function ownsItemOfGroup(
  equipment: readonly SessionEquipmentItem[],
  group: SessionActivityGroup,
): boolean {
  for (const item of equipment) {
    if (sessionEquipmentGroup(item) === group) return true;
  }
  return false;
}

/** Whether any owned item is on the higher-tier recovery list. */
function ownsAdvancedRecoveryItem(equipment: readonly SessionEquipmentItem[]): boolean {
  const advanced = new Set<string>(EMPIRE_TUNING.ADVANCED_RECOVERY_ITEMS);
  for (const item of equipment) {
    if (advanced.has(item)) return true;
  }
  return false;
}

/**
 * Whether `activity` is available with `equipment` held — §5.4's capability
 * gate: at least one item of the required group, and for other-recovery
 * additionally one of the higher-tier recovery items.
 */
export function activityAvailable(
  equipment: readonly SessionEquipmentItem[],
  activity: FlexibleActivity,
): boolean {
  if (!ownsItemOfGroup(equipment, activityEquipmentGroup(activity))) return false;
  if (activity !== 'other-recovery') return true;
  return ownsAdvancedRecoveryItem(equipment);
}

/** Every available activity, in the fixed §5.5 order. */
export function availableActivities(
  equipment: readonly SessionEquipmentItem[],
): readonly FlexibleActivity[] {
  return Object.freeze(
    EMPIRE_TUNING.FLEXIBLE_ACTIVITIES.filter((activity) =>
      activityAvailable(equipment, activity),
    ),
  );
}

// ---------------------------------------------------------------------------
// The week: allocation, legality, effects
// ---------------------------------------------------------------------------

/** The all-rest allocation — what a week is before the player chooses. */
export function createRestAllocation(): WeekAllocation {
  return Object.freeze(['rest', 'rest', 'rest']) as WeekAllocation;
}

/**
 * §5.5's sentence as a value a screen can print: the guaranteed four, the
 * flexible three, and their sum — "7 total, matching a real training week".
 * The fixed count is read here and allocated nowhere, which is header §1.
 */
export function trainingWeekShape(): {
  readonly fixed: number;
  readonly flexible: number;
  readonly total: number;
} {
  return Object.freeze({
    fixed: EMPIRE_TUNING.FIXED_POWERLIFTING_SESSIONS_PER_WEEK,
    flexible: EMPIRE_TUNING.FLEXIBLE_SESSIONS_PER_WEEK,
    total:
      EMPIRE_TUNING.FIXED_POWERLIFTING_SESSIONS_PER_WEEK +
      EMPIRE_TUNING.FLEXIBLE_SESSIONS_PER_WEEK,
  });
}

/**
 * Refuse a bent allocation and hand a well-formed one back unchanged — the
 * runtime half of header §1's unrepresentability claim, for the cast route
 * the type cannot see.
 */
export function requireWeekAllocation(allocation: WeekAllocation): WeekAllocation {
  const slots: readonly FlexibleSlot[] = allocation;
  if (slots.length !== EMPIRE_TUNING.FLEXIBLE_SESSIONS_PER_WEEK) {
    refuseWith(
      `a week allocates exactly ${EMPIRE_TUNING.FLEXIBLE_SESSIONS_PER_WEEK} flexible sessions, received ${slots.length}`,
    );
  }
  const legal = new Set<string>([...EMPIRE_TUNING.FLEXIBLE_ACTIVITIES, 'rest']);
  for (const slot of slots) {
    if (!legal.has(slot)) refuseWith(`${String(slot)} is not a flexible activity or rest`);
  }
  return allocation;
}

/** What a slot must be holding for its activity to run. */
export type SlotRequirement = SessionActivityGroup | 'advanced-recovery';

/** What one allocated slot did this week. Reported, not silent — header §2. */
export type SlotOutcome =
  | { readonly kind: 'trained'; readonly activity: FlexibleActivity }
  | { readonly kind: 'rested' }
  | {
      readonly kind: 'unequipped';
      readonly activity: FlexibleActivity;
      readonly requires: SlotRequirement;
    };

/**
 * Resolve one week's allocation against the equipment held: which slots
 * train, which rest, and which asked for an activity the gym cannot host —
 * with the missing requirement named, so the report sells the purchase.
 */
export function resolveWeek(
  allocation: WeekAllocation,
  equipment: readonly SessionEquipmentItem[],
): readonly [SlotOutcome, SlotOutcome, SlotOutcome] {
  requireWeekAllocation(allocation);
  requireSessionEquipment(equipment);
  const resolve = (slot: FlexibleSlot): SlotOutcome => {
    if (slot === 'rest') return Object.freeze({ kind: 'rested' });
    if (activityAvailable(equipment, slot)) {
      return Object.freeze({ kind: 'trained', activity: slot });
    }
    const group = activityEquipmentGroup(slot);
    const requires: SlotRequirement = ownsItemOfGroup(equipment, group)
      ? 'advanced-recovery'
      : group;
    return Object.freeze({ kind: 'unequipped', activity: slot, requires });
  };
  return Object.freeze([resolve(allocation[0]), resolve(allocation[1]), resolve(allocation[2])]);
}

/** Clamp helper for the two floors and two ceilings below. */
function clampedReduction(raw: number, floor: number): number {
  return Math.min(raw, 1 - floor);
}

/**
 * One week's attribute effects from the allocation and the equipment — the
 * whole of §5.5's effects table at stage-2 resolution, deterministic and
 * tunable. Trained sessions come from `resolveWeek`, so an unequipped slot
 * contributes exactly nothing here and is reported there; Support amplifiers
 * multiply the earned base per channel, so they modify and do not generate.
 */
export function weeklyAttributeEffects(
  allocation: WeekAllocation,
  equipment: readonly SessionEquipmentItem[],
): WeeklyAttributeEffects {
  const outcomes = resolveWeek(allocation, equipment);
  let cardioSessions = 0;
  let hypertrophySessions = 0;
  let stretchingSessions = 0;
  let otherRecoverySessions = 0;
  for (const outcome of outcomes) {
    if (outcome.kind !== 'trained') continue;
    if (outcome.activity === 'cardio') cardioSessions += 1;
    if (outcome.activity === 'hypertrophy') hypertrophySessions += 1;
    if (outcome.activity === 'stretching-yoga') stretchingSessions += 1;
    if (outcome.activity === 'other-recovery') otherRecoverySessions += 1;
  }
  const conditioningGrade = groupCapabilityGrade(equipment, 'conditioning');
  const accessoryGrade = groupCapabilityGrade(equipment, 'accessory');
  const recoveryGrade = groupCapabilityGrade(equipment, 'recovery');

  const carryReduction = clampedReduction(
    cardioSessions * conditioningGrade * EMPIRE_TUNING.CARDIO_RESIDUAL_CARRY_REDUCTION_PER_GRADE_SESSION +
      otherRecoverySessions * recoveryGrade * EMPIRE_TUNING.OTHER_RECOVERY_RESIDUAL_CARRY_REDUCTION_PER_GRADE_SESSION,
    EMPIRE_TUNING.RESIDUAL_CARRY_MULTIPLIER_FLOOR,
  );
  const injuryReduction = clampedReduction(
    stretchingSessions * recoveryGrade * EMPIRE_TUNING.STRETCHING_INJURY_REDUCTION_PER_GRADE_SESSION *
      (1 + supportAmplifier(equipment, 'injury-risk')),
    EMPIRE_TUNING.INJURY_CHANCE_MULTIPLIER_FLOOR,
  );
  const techniqueBonus = Math.min(
    stretchingSessions * recoveryGrade * EMPIRE_TUNING.STRETCHING_TECHNIQUE_BONUS_PER_GRADE_SESSION *
      (1 + supportAmplifier(equipment, 'technique-quality')),
    EMPIRE_TUNING.TECHNIQUE_QUALITY_BONUS_MAX,
  );
  const ceilingGrowth = Math.min(
    hypertrophySessions * accessoryGrade * EMPIRE_TUNING.HYPERTROPHY_CEILING_GROWTH_PER_GRADE_SESSION *
      (1 + supportAmplifier(equipment, 'ceiling-growth')),
    EMPIRE_TUNING.CEILING_GROWTH_PER_WEEK_MAX,
  );
  return Object.freeze({
    residualCarryMultiplier: scrubPrecision(1 - carryReduction) as ResidualCarryMultiplier,
    injuryChanceMultiplier: scrubPrecision(1 - injuryReduction) as InjuryChanceMultiplier,
    techniqueQualityBonus: scrubPrecision(techniqueBonus) as TechniqueQualityBonus,
    ceilingGrowthPerWeek: scrubPrecision(ceilingGrowth) as CeilingGrowthPerWeek,
  });
}

/**
 * A series of weekly ceiling growths, compounded — §5.5's "Slow, compounding"
 * as arithmetic: the fraction the ceiling has grown after living the series.
 */
export function composedCeilingGrowth(weeks: readonly WeeklyAttributeEffects[]): number {
  let factor = 1;
  for (const week of weeks) {
    const growth: number = week.ceilingGrowthPerWeek;
    if (!Number.isFinite(growth) || growth < 0) {
      refuseWith(`a weekly ceiling growth must be finite and at or above zero, received ${growth}`);
    }
    factor *= 1 + growth;
  }
  return scrubPrecision(factor - 1);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * The whole of stage 2's state — header §3 says which purse is which.
 * `sessionEquipment` is sorted in `SESSION_EQUIPMENT_ITEMS` order and
 * duplicate-free, which `requireGymState` enforces so equal holdings are
 * equal bytes, the same canon rule `LadderState.equipment` keeps.
 */
export interface GymState {
  readonly ladder: LadderState;
  readonly acceleratedGymBucks: number;
  readonly sessionEquipment: readonly SessionEquipmentItem[];
}

/** Sort stage-2 items into the fixed order, so equal holdings are equal bytes. */
function canonicalSessionEquipment(
  equipment: readonly SessionEquipmentItem[],
): readonly SessionEquipmentItem[] {
  return Object.freeze(
    [...equipment].sort(
      (left, right) =>
        EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.indexOf(left) -
        EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.indexOf(right),
    ),
  );
}

/** Refuse an equipment list a cast bent: unknown items, duplicates, disorder. */
function requireSessionEquipment(
  equipment: readonly SessionEquipmentItem[],
): readonly SessionEquipmentItem[] {
  const seen = new Set<string>();
  for (const item of equipment) {
    if (!EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.includes(item)) {
      refuseWith(`${String(item)} is not a stage-2 equipment item`);
    }
    if (seen.has(item)) refuseWith(`${String(item)} is held twice`);
    seen.add(item);
  }
  const canonical = canonicalSessionEquipment(equipment);
  for (const [at, item] of canonical.entries()) {
    if (equipment[at] !== item) {
      refuseWith(`stage-2 equipment must be listed in the fixed item order: ${canonical.join(', ')}`);
    }
  }
  return equipment;
}

/** Refuse a malformed state, and hand a well-formed one back unchanged. */
export function requireGymState(state: GymState): GymState {
  requireLadderState(state.ladder);
  if (!Number.isFinite(state.acceleratedGymBucks) || state.acceleratedGymBucks < 0) {
    refuseWith(
      `the accelerated purse must be finite and at or above zero, received ${state.acceleratedGymBucks}`,
    );
  }
  requireSessionEquipment(state.sessionEquipment);
  return state;
}

/** The opening state: stage 1's opening ladder, both purses at their floor. */
export function createGymState(): GymState {
  return Object.freeze({
    ladder: createLadderState(),
    acceleratedGymBucks: 0,
    sessionEquipment: canonicalSessionEquipment([]),
  });
}

// ---------------------------------------------------------------------------
// Transitions — the capability spend, the grant, the check-in
// ---------------------------------------------------------------------------

/** Buying a stage-2 item: it lands, or the refusal says why, state unchanged. */
export type SessionBuyResult =
  | {
      readonly kind: 'bought';
      readonly state: GymState;
      readonly item: SessionEquipmentItem;
      readonly cost: number;
    }
  | {
      readonly kind: 'refused';
      readonly state: GymState;
      readonly item: SessionEquipmentItem;
      readonly cost: number;
      readonly reason: 'already-owned' | 'rung-too-low' | 'not-enough-gym-bucks';
    };

/**
 * Buy `item` from the settled purse — the only purse capability may spend
 * (header §3). The accelerated balance is not read here, which is the claim
 * the crown sweep measures.
 */
export function buySessionEquipment(state: GymState, item: SessionEquipmentItem): SessionBuyResult {
  requireGymState(state);
  const cost = sessionEquipmentCost(item);
  const held = new Set<string>(state.sessionEquipment);
  if (held.has(item)) {
    return Object.freeze({ kind: 'refused', state, item, cost, reason: 'already-owned' });
  }
  if (ladderRungIndex(state.ladder.rung) < ladderRungIndex(sessionEquipmentMinRung(item))) {
    return Object.freeze({ kind: 'refused', state, item, cost, reason: 'rung-too-low' });
  }
  if (state.ladder.gymBucks < cost) {
    return Object.freeze({ kind: 'refused', state, item, cost, reason: 'not-enough-gym-bucks' });
  }
  return Object.freeze({
    kind: 'bought',
    state: Object.freeze({
      ...state,
      ladder: Object.freeze({
        ...state.ladder,
        gymBucks: scrubPrecision(state.ladder.gymBucks - cost),
      }),
      sessionEquipment: canonicalSessionEquipment([...state.sessionEquipment, item]),
    }),
    item,
    cost,
  });
}

/**
 * Credit the accelerated purse — where purchased or accelerated Gym Bucks
 * land (header §3). The one writer of `acceleratedGymBucks`, and at stage 2
 * the purse has no spender: §8.3A/§8.3B's sinks arrive with later stages.
 */
export function grantAcceleratedGymBucks(state: GymState, gymBucks: number): GymState {
  requireGymState(state);
  if (!Number.isFinite(gymBucks) || gymBucks < 0) {
    refuseWith(`a grant must be finite and at or above zero, received ${gymBucks}`);
  }
  return Object.freeze({
    ...state,
    acceleratedGymBucks: scrubPrecision(state.acceleratedGymBucks + gymBucks),
  });
}

/** A check-in: the settled purse accrues the gap through stage 1's mechanism. */
export function gymCheckIn(
  state: GymState,
  atSeconds: number,
): { readonly state: GymState; readonly accrual: LadderAccrual } {
  requireGymState(state);
  const checkedIn = ladderCheckIn(state.ladder, atSeconds);
  return Object.freeze({
    state: Object.freeze({ ...state, ladder: checkedIn.state }),
    accrual: checkedIn.accrual,
  });
}

// ---------------------------------------------------------------------------
// The composed run — header §5
// ---------------------------------------------------------------------------

/** One accelerated-currency grant: how much, and from when it may land. */
export interface AcceleratedGrant {
  readonly atSeconds: number;
  readonly gymBucks: number;
}

/** Everything one run folds: the schedule, the plan, the grants. */
export interface GymRunSchedule {
  /** Strictly ascending whole ticks, as `ladderCheckIn` requires. */
  readonly checkInsSeconds: readonly number[];
  /** Week i uses entry min(i, length-1). Must be non-empty. */
  readonly allocationPlan: readonly WeekAllocation[];
  /** Ascending by `atSeconds`; each lands at the first check-in at or after it. */
  readonly grants: readonly AcceleratedGrant[];
}

/** A capability purchase the run made, with when it landed. */
export interface GymPurchase {
  readonly item: LadderEquipmentItem | SessionEquipmentItem;
  readonly atSeconds: number;
}

/** A relocation the run made, with when it landed. */
export interface GymRelocation {
  readonly to: LadderDestination;
  readonly atSeconds: number;
}

/** One completed week's report: the choice, the legality, the effects. */
export interface GymWeekReport {
  readonly weekIndex: number;
  readonly allocation: WeekAllocation;
  readonly slots: readonly [SlotOutcome, SlotOutcome, SlotOutcome];
  readonly effects: WeeklyAttributeEffects;
}

/** One composed run: the end state and every series the sweeps compare. */
export interface GymRun {
  readonly state: GymState;
  readonly checkIns: number;
  /** Settled-purse accrual, total. */
  readonly accruedGymBucks: number;
  readonly grantsLanded: number;
  readonly grantedGymBucks: number;
  readonly purchases: readonly GymPurchase[];
  readonly movedTo: readonly GymRelocation[];
  readonly weeks: readonly GymWeekReport[];
}

/** `state` with its ladder replaced — one writer shape for the composed fold. */
function withLadder(state: GymState, ladder: LadderState): GymState {
  return Object.freeze({ ...state, ladder });
}

/**
 * The wired-accelerant control's credit: the grant paid into the settled
 * purse instead of the accelerated one. This is the mutant the crown sweep
 * measures against, reachable only through `runGym`'s control destination —
 * see `GRANT_DESTINATIONS`.
 */
function creditSettledPurseForControl(state: GymState, gymBucks: number): GymState {
  return withLadder(
    state,
    Object.freeze({
      ...state.ladder,
      gymBucks: scrubPrecision(state.ladder.gymBucks + gymBucks),
    }),
  );
}

/** The cheapest affordable action, or null — enumeration order is the tie-break. */
function cheapestAffordable(
  state: GymState,
):
  | { readonly action: 'buy-ladder'; readonly item: LadderEquipmentItem }
  | { readonly action: 'buy-session'; readonly item: SessionEquipmentItem }
  | { readonly action: 'move' }
  | null {
  let bestCost = Number.POSITIVE_INFINITY;
  let best:
    | { readonly action: 'buy-ladder'; readonly item: LadderEquipmentItem }
    | { readonly action: 'buy-session'; readonly item: SessionEquipmentItem }
    | { readonly action: 'move' }
    | null = null;
  const rung = ladderRungIndex(state.ladder.rung);
  const heldLadder = new Set<string>(state.ladder.equipment);
  for (const item of EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS) {
    if (heldLadder.has(item)) continue;
    if (rung < ladderRungIndex(ladderEquipmentMinRung(item))) continue;
    const cost = ladderEquipmentCost(item);
    if (state.ladder.gymBucks < cost) continue;
    if (cost < bestCost) {
      bestCost = cost;
      best = { action: 'buy-ladder', item };
    }
  }
  const heldSession = new Set<string>(state.sessionEquipment);
  for (const item of EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS) {
    if (heldSession.has(item)) continue;
    if (rung < ladderRungIndex(sessionEquipmentMinRung(item))) continue;
    const cost = sessionEquipmentCost(item);
    if (state.ladder.gymBucks < cost) continue;
    if (cost < bestCost) {
      bestCost = cost;
      best = { action: 'buy-session', item };
    }
  }
  const above = nextLadderRung(state.ladder.rung);
  if (above !== null) {
    const cost = ladderMoveCost(above);
    if (state.ladder.gymBucks >= cost && cost < bestCost) {
      best = { action: 'move' };
    }
  }
  return best;
}

/**
 * Fold a whole schedule through stage 2 under a named policy and a named
 * grant destination. Deterministic by construction; header §5 states the
 * ordering rules, and the refusals here make a bent input loud.
 */
export function runGym(
  schedule: GymRunSchedule,
  policy: GymPolicy,
  destination: GrantDestination,
): GymRun {
  if (!GYM_POLICIES.includes(policy)) {
    refuseWith(`${String(policy)} is not a gym policy`);
  }
  if (!GRANT_DESTINATIONS.includes(destination)) {
    refuseWith(`${String(destination)} is not a grant destination`);
  }
  if (schedule.allocationPlan.length < 1) {
    refuseWith('an allocation plan must carry at least one week');
  }
  for (const allocation of schedule.allocationPlan) requireWeekAllocation(allocation);
  let previousGrantAt = Number.NEGATIVE_INFINITY;
  for (const grant of schedule.grants) {
    if (!Number.isFinite(grant.gymBucks) || grant.gymBucks < 0) {
      refuseWith(`a grant must be finite and at or above zero, received ${grant.gymBucks}`);
    }
    if (!Number.isFinite(grant.atSeconds) || grant.atSeconds < previousGrantAt) {
      refuseWith(`grants must be listed in ascending time, received ${grant.atSeconds}`);
    }
    previousGrantAt = grant.atSeconds;
  }

  let state = createGymState();
  let accruedGymBucks = 0;
  let grantsLanded = 0;
  let grantedGymBucks = 0;
  const purchases: GymPurchase[] = [];
  const movedTo: GymRelocation[] = [];
  let nextGrant = 0;
  let previous = -1;

  for (const at of schedule.checkInsSeconds) {
    if (at <= previous) {
      refuseWith(`check-ins must be strictly ascending, received ${at} after ${previous}`);
    }
    previous = at;
    while (nextGrant < schedule.grants.length) {
      const grant = schedule.grants[nextGrant] as AcceleratedGrant;
      if (grant.atSeconds > at) break;
      nextGrant += 1;
      grantsLanded += 1;
      grantedGymBucks = scrubPrecision(grantedGymBucks + grant.gymBucks);
      state =
        destination === 'accelerated-purse'
          ? grantAcceleratedGymBucks(state, grant.gymBucks)
          : creditSettledPurseForControl(state, grant.gymBucks);
    }
    const checkedIn = gymCheckIn(state, at);
    state = checkedIn.state;
    accruedGymBucks = scrubPrecision(accruedGymBucks + checkedIn.accrual.gymBucks);
    if (policy === 'hoard') continue;
    for (;;) {
      const pick = cheapestAffordable(state);
      if (pick === null) break;
      if (pick.action === 'buy-ladder') {
        const outcome = buyLadderEquipment(state.ladder, pick.item);
        if (outcome.kind !== 'bought') refuseWith(`the affordable ${pick.item} was refused`);
        state = withLadder(state, outcome.state);
        purchases.push(Object.freeze({ item: outcome.item, atSeconds: at }));
        continue;
      }
      if (pick.action === 'buy-session') {
        const outcome = buySessionEquipment(state, pick.item);
        if (outcome.kind !== 'bought') refuseWith(`the affordable ${pick.item} was refused`);
        state = outcome.state;
        purchases.push(Object.freeze({ item: outcome.item, atSeconds: at }));
        continue;
      }
      const outcome = moveUpLadder(state.ladder);
      if (outcome.kind !== 'moved') refuseWith('the affordable move up was refused');
      state = withLadder(state, outcome.state);
      movedTo.push(Object.freeze({ to: outcome.to, atSeconds: at }));
    }
  }

  const weekSeconds = EMPIRE_TUNING.DAYS_PER_TRAINING_WEEK * EMPIRE_TUNING.SECONDS_PER_DAY;
  const lastCheckIn =
    schedule.checkInsSeconds.length === 0
      ? 0
      : (schedule.checkInsSeconds[schedule.checkInsSeconds.length - 1] as number);
  const completedWeeks = Math.floor(lastCheckIn / weekSeconds);
  const stageTwoItems = new Set<string>(EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS);
  const sessionPurchases = purchases.filter((purchase) => stageTwoItems.has(purchase.item));
  const weeks: GymWeekReport[] = [];
  for (let weekIndex = 0; weekIndex < completedWeeks; weekIndex += 1) {
    const startsAt = weekIndex * weekSeconds;
    const held = canonicalSessionEquipment(
      sessionPurchases
        .filter((purchase) => purchase.atSeconds <= startsAt)
        .map((purchase) => purchase.item as SessionEquipmentItem),
    );
    const planIndex = Math.min(weekIndex, schedule.allocationPlan.length - 1);
    const allocation = schedule.allocationPlan[planIndex] as WeekAllocation;
    weeks.push(
      Object.freeze({
        weekIndex,
        allocation,
        slots: resolveWeek(allocation, held),
        effects: weeklyAttributeEffects(allocation, held),
      }),
    );
  }

  return Object.freeze({
    state,
    checkIns: schedule.checkInsSeconds.length,
    accruedGymBucks,
    grantsLanded,
    grantedGymBucks,
    purchases: Object.freeze(purchases),
    movedTo: Object.freeze(movedTo),
    weeks: Object.freeze(weeks),
  });
}
