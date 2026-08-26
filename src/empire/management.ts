/**
 * management.ts — GDD §5 (v2) stage 4: staffing, maintenance, equipment
 * condition, recoverable failure. §5.6/§5.7's settled design, unpaused by the
 * ruling recorded in `docs/GDD.md` §5.13, with portfolio explicitly excluded —
 * this module manages the one gym the ladder runs, and a manager is an
 * optional hire for it, exactly as that ruling states.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock reading, no randomness. Its imports are
 * `./empireCore` (for `refuseWith`, the directory's one throw gate),
 * `./empireTuning`, `./ladder` and `./sessions` (the equipment vocabulary and
 * the composed stage-2 state, composed whole rather than re-implemented) and
 * `./production` (`scrubPrecision`).
 *
 * ===========================================================================
 * 1. Wear is keyed to banked seconds — the derivation, and why not wall time
 * ===========================================================================
 *
 * §5.7 says condition "decays continuously and auto-deducts from income as it
 * falls — no player action is required", and the same section's hard rule says
 * nothing here may punish the player for being away. The §5.13 stage-4 ruling
 * reconciles them: decay is keyed to the gym's own advanced time — the clock
 * the player advances — and not to wall-clock absence.
 *
 * In the ladder's machinery the quantity that fits that sentence exactly is
 * the banked seconds of `ladderCheckIn`'s accrual: the part of a gap the
 * offline cap pays income on. So each item loses
 * `EQUIPMENT_WEAR_PER_BANKED_HOUR` per banked hour, and:
 *
 *   - absence beyond the offline horizon wears nothing, exactly as it earns
 *     nothing — a player away a month returns to a gym worn by at most one
 *     horizon more, not a month more;
 *   - the seconds that wear the equipment are the same seconds that paid
 *     income for operating it, so wear is use, not neglect of a timer;
 *   - below the horizon, banked seconds are exactly additive under splitting
 *     a gap (ladder.ts §4), so an extra check-in inside the horizon changes
 *     no wear at all.
 *
 * The limit, stated because the sweep is scoped by it: inside the catch-up
 * horizon a longer gap banks more seconds, so it earns more and wears more.
 * That is the offline cap's own design — time inside the horizon is paid
 * operation, not absence — and the named catcher for the boundary is the
 * pure-absence family in `management.test.ts`'s sweep: histories identical
 * except for extra absence beyond the horizon are byte-identical in
 * condition, income deducted and failure progression, pinned at zero
 * mismatches against a wall-clock-wear control pinned non-zero.
 *
 * The limit now has a size as well as a name, which it did not for a round.
 * `EXPECTED_SWEEP.withinHorizon` pins what "wears more" costs on the swept
 * domain: of 34560 compared readings, 20822 have the more-absent run at
 * strictly lower mean condition, 25132 have it ahead on cumulative income
 * deducted, and 890 have it net-lower in money. The paragraph above is the
 * DESIGN ARGUMENT for the wear basis; those four numbers are its price, and
 * whether the price is acceptable is a design ruling this module does not
 * make. It is written here rather than only in the test because a limit
 * stated without its magnitude reads smaller than it is.
 *
 * ===========================================================================
 * 2. Where the income deduction applies, and which multiplier moment
 * ===========================================================================
 *
 * §5.7's auto-deduction is applied at the one real income path stage 2 has:
 * `gymCheckIn`'s accrual. The choice is a multiplier, not a flat charge — a
 * flat per-check-in charge is a charge on showing up, which is the shape
 * `management.test.ts`'s `'visit-fee-control'` exists to hold up as the
 * counter-example, and it is pinned punishing there. A multiplier on the
 * accrual keeps income monotone in banked seconds instead.
 * `managedCheckIn` composes `gymCheckIn` whole (the stage-2 precedent:
 * compose, do not re-implement), then subtracts the deducted part of the raw
 * accrual from the settled purse.
 *
 * The multiplier is read after the gap's wear is applied — the end-of-gap
 * condition. What is driven rather than argued: `splitting a sub-horizon gap
 * leaves condition byte-identical and pays at least as much` runs a real gap
 * both ways and reads the purse. What is NOT driven, and is stated as
 * reasoning rather than as a measurement: that the start-of-gap multiplier
 * would pay strictly less on a split. No wiring implements that variant, so
 * nothing here has measured it, and a reader should treat the direction as
 * the reason the code is written this way and not as a checked claim.
 *
 * The multiplier's floor (`CONDITION_INCOME_MULTIPLIER_FLOOR`) keeps a fully
 * worn gym earning. The consistency the tuning must hold for engagement to
 * stay unpunished is derived and pinned in `management.test.ts`: a banked
 * hour at the floor multiplier still out-earns the top wage rate plus its own
 * wear's full repair cost, at the lowest rung's income rate.
 *
 * ===========================================================================
 * 3. Failure reads the decision ledger and nothing else
 * ===========================================================================
 *
 * §5.7, confirmed as settled design: failure is driven by accumulated bad
 * decisions made while actively engaged — repeatedly hiring the cheapest
 * manager despite visible warnings, ignoring the in-session maintenance
 * prompt more than once, actively declining a repair whose cost was shown —
 * and not by elapsed time.
 *
 * Here that is structural rather than promised: `failurePhase` is a pure
 * function of `ManagedGym.strikes.length`, and the three functions that
 * append a strike are the three §5.7 decision shapes (`hireManager`,
 * `respondToPrompt`, `declineRepair`). `managedCheckIn` reads no strike and
 * writes no strike, so no quantity of elapsed, banked or discarded seconds
 * moves the failure state. The warning phase (`'warned'`) becomes visible at
 * `FAILURE_WARNING_STRIKES`, before failure at `FAILURE_STRIKES`, so no
 * failure arrives unwarned; every strike record carries the cost or warning
 * that was on screen when the decision was taken.
 *
 * The limit, and its catchers, stated in the mechanism's own terms because
 * this one has a measured residual rather than a zero. Prompts are offered
 * when condition is low, so which check-in a decision OPPORTUNITY arrives at
 * tracks banked operation, and a run that operated more meets the failing
 * decision sooner. Two consequences, and they are pinned differently:
 *
 *   - Beyond the offline horizon nothing moves at all, so extra ABSENCE
 *     changes no opportunity and no outcome. `management.test.ts`'s
 *     pure-absence family is byte-identical on every counter it keeps —
 *     `EXPECTED_SWEEP.pureAbsence` carries the pair and reading counts —
 *     against a wall-clock-wear control and an absence-strike control
 *     (elapsed time fabricating a counted record — §5.7 broken by
 *     construction), both pinned non-zero.
 *   - Inside the horizon the extra time is PAID OPERATION, so it moves banked
 *     seconds, wear and the decision opportunity with them. Every counter of
 *     that family is pinned exactly in `EXPECTED_SWEEP.withinHorizon`, and
 *     none of them is zero. The money residual is priced reading by reading
 *     by `prices every within-horizon net-lower reading against the crawl
 *     arithmetic the header names, and counts what it does not cover`.
 *
 *     THIS PARAGRAPH SAID SOMETHING STRONGER FOR A ROUND AND THE MEASUREMENT
 *     DID NOT SUPPORT IT. It said that where the two runs' realized decisions
 *     match, the more-absent one is never net-worse and failure progression
 *     is byte-identical, citing `matchedTraceNetLower: 0` and
 *     `matchedTraceFailureMismatches: 0`. Those two zeros were taken over
 *     three of the six policies — the sweep read a constant named for what it
 *     asserted rather than for the subjects it covered — and over all six
 *     they read 337 and 155. The sentence is withdrawn rather than rescoped,
 *     because "on hands-off, diligent and negligent" is a fact about three
 *     player models and not the property the sentence was claiming.
 *
 *     What the priced attribution then shows, stated as counts because that
 *     is all it is: of 890 net-lower readings, 82 are covered by the crawl
 *     loss at that same check-in, a further 511 by the crawl loss
 *     accumulated to that check-in, and 297 by neither. The crawl arriving
 *     early is therefore A cause and not THE cause, which is a weaker claim
 *     than this header used to make and is the one the numbers carry. 67
 *     readings sit on a strictly larger repair bill in the more-absent run —
 *     the wear basis in §1 showing up as money — with a largest gap of 9.6
 *     Gym Bucks against a largest deficit of 104.22.
 *
 *     WHAT TO DO ABOUT ANY OF THAT IS NOT SETTLED HERE. It turns on what
 *     equipment wear should be keyed to, which is a design question §5.13
 *     does not answer and a builder may not; this module's job was to make
 *     the numbers visible, and the wear basis, the comparator and every
 *     tuning value are unchanged by the round that measured them.
 *
 * The ENGAGEMENT direction — CLAUDE.md's §12.3 rule, one extra check-in on a
 * fixed grid — is zero including divergent traces, because an extra check-in
 * banks a whole extra horizon of income at the same wall clock and that
 * covers every discrete cost it can pull forward on the swept domain.
 *
 * ===========================================================================
 * 4. Dormancy: income collapses, and what "keeps degrading" is read to mean
 * ===========================================================================
 *
 * A failed gym is dormant: the income multiplier drops to
 * `DORMANT_INCOME_MULTIPLIER` — a crawl, not a hard zero, because on the
 * single-gym ladder a literal zero plus an empty purse makes §5.7's own
 * recoverability clause arithmetically false (the ladder is the one money
 * source; that constant's comment carries the full derivation, and it is
 * flagged for human re-ruling rather than silently resolved). No wage is
 * charged and no manager auto-repairs while dormant. §5.6's "members leave"
 * surfaces through `memberConditionInput`, the real value stage 3's
 * `memberSatisfaction` declared as its stage-4 input.
 *
 * That last sentence understates what dormancy does to that channel, and the
 * gap is disclosed here in the same register as the two refusals below rather
 * than left for a reader to find. `memberConditionInput` is `meanCondition`,
 * and dormancy applies no wear, so mean condition is CONSTANT for the whole
 * of dormancy: the input stage 3 reads does not move once the gym has failed.
 * §5.6's members therefore leave at whatever rate the condition at the moment
 * of failure implies, and not one member faster for the gym having been
 * dormant a long time. Whether that is right is a design question and this
 * module does not answer it — it is recorded because "members leave" reads
 * like a live channel and here it is an inert one. Nothing in this file
 * measures it either: `members.ts` is not imported, no sweep drives
 * `memberSatisfaction`, and the only check pointed at this function is the
 * directed equality with `meanCondition`. A future ruling that wants dormant
 * attrition needs a key that is neither wall-clock nor check-in-keyed, which
 * is the same open problem the two refusals below name.
 *
 * §5.7's sentence "condition keeps degrading" has NO condition implementation
 * here, and that is a measured derivation rather than an oversight. Two
 * candidates were built and both were refused by measurement:
 *
 *   - ongoing dormant wear per banked second. A dormant gym hosts no
 *     operation for use-keyed wear to be about, and the charge lands on
 *     visits: more check-ins at a dormant gym would raise its repair bill
 *     with no offsetting income, which the never-punish rule refuses.
 *   - a one-off entry slump, applied when the strike count crosses the
 *     failure line. This shipped at 0.25 for one round and the sweep
 *     measured it: a slump is a discrete money cliff (slump x items x
 *     `REPAIR_COST_GYM_BUCKS_PER_CONDITION_POINT`) whose ARRIVAL TIME is
 *     engagement-sensitive, because a run that banked more operation reaches
 *     the failing decision a check-in earlier. Re-measured on the widened
 *     within-horizon domain rather than carried over: at 0.25 the engagement
 *     family reads 130 net-lower readings against a shipped 0, and the
 *     within-horizon family 983 against a shipped 890 with its
 *     matched-trace count going 337 -> 368. The `295` this paragraph used to
 *     quote is still exactly right for 'negligent' alone, which is what the
 *     family covered when it was taken; the fuller mutation table is in
 *     `management.test.ts`'s `EXPECTED_SWEEP.failureSlumpControl`.
 *
 *     Why the repair is removal and not a smaller number, stated in the
 *     mechanism's own terms rather than as a claim about every edit: the
 *     cliff is a FIXED cost and the income that pulls it forward is
 *     PROPORTIONAL to the extra banked span, so for a span small enough the
 *     income is smaller than any positive cliff. The sweep cannot see that
 *     directly, because its gap menu is coarse: measured at 0.20, 0.15, 0.10
 *     and 0.05 the same families read zero, so on THAT domain there was
 *     headroom. A §12.3 property held by a margin that exists only because
 *     nobody sampled between two menu entries is the "domain empty where it
 *     matters" shape, which is why the shipped value is not "just under the
 *     measured boundary".
 *
 *     THAT SWEEP OF SMALLER SLUMPS HAS NOT BEEN RE-TAKEN ON THE WIDENED
 *     DOMAIN, and its verb is past tense for that reason. It ran when the
 *     within-horizon family covered three policies of six, and the shipped
 *     within-horizon family is not zero on all six, so "the same families
 *     read zero" is a statement about the engagement family and about three
 *     player models — not about the whole battery as it now stands. The
 *     conclusion it supports (removal rather than a smaller number) does not
 *     rest on it, because the FIXED-cost-versus-PROPORTIONAL-income argument
 *     above is arithmetic and not a sample. Recorded as an untaken
 *     measurement rather than deleted.
 *
 * So dormancy costs the income crawl and the recovery bar
 * (`RECOVERY_CONDITION_MIN`, well above the maintenance-prompt line, so a
 * comeback buys repairs the player would not otherwise owe yet) and nothing
 * else. The removed mechanism is kept runnable as the
 * `'failure-slump-control'` wiring, whose counts `management.test.ts` pins
 * NON-ZERO — the number the shipped engagement zero is a zero against, and
 * the number the shipped within-horizon figures are smaller than. If a human wants
 * dormant rot back, it needs a key that is neither wall-clock, nor
 * check-in-keyed, nor a discrete cliff at a decision boundary, and no such
 * key exists in this machinery — flagged for re-ruling rather than silently
 * resolved.
 *
 * Recovery is §5.7's shape: a real repair investment (every item restored to
 * `RECOVERY_CONDITION_MIN`, quoted before the decision) plus staffing
 * turnaround (a manager whose hire was a counted cheap-hire strike must be
 * gone). `recoverGym` clears the active strikes and the gym is back online;
 * the asset is not lost.
 */

import { refuseWith } from './empireCore';
import { type LadderAccrual, type LadderEquipmentItem } from './ladder';
import { scrubPrecision } from './production';
import {
  type GymState,
  type SessionEquipmentItem,
  createGymState,
  gymCheckIn,
  requireGymState,
  withLadder,
} from './sessions';
import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// Vocabulary, derived from the tuning block rather than restated
// ---------------------------------------------------------------------------

/** A manager quality tier, worst first — §5.7's quality axis. */
export type ManagerTier = (typeof EMPIRE_TUNING.MANAGER_TIERS)[number];

/** Any item that carries a condition: the Barbell group and the stage-2 items. */
export type ManagedEquipmentItem = LadderEquipmentItem | SessionEquipmentItem;

/** Condition per owned item, each in [0, 1]. Exactly the owned items, no more. */
export type ConditionByItem = Readonly<Partial<Record<ManagedEquipmentItem, number>>>;

/** The failure machine's phases, in order of trouble. Derived, not stored. */
export const FAILURE_PHASES = Object.freeze(['sound', 'warned', 'failed'] as const);

export type FailurePhase = (typeof FAILURE_PHASES)[number];

/** §5.7's three counted decision shapes. Nothing else may append a strike. */
export const COUNTED_DECISIONS = Object.freeze([
  'cheapest-hire-under-warning',
  'prompt-dismissed-again',
  'repair-declined',
] as const);

export type CountedDecision = (typeof COUNTED_DECISIONS)[number];

/** One counted decision, with what the screen showed when it was taken. */
export interface CountedDecisionRecord {
  readonly decision: CountedDecision;
  /** The gym clock second of the check-in the decision was taken at. */
  readonly atSeconds: number;
  /** The cost that was shown before the decision — §5.7's "told the cost of". */
  readonly shownCostGymBucks: number;
}

/** The hired manager, if any. `hiredUnderWarning` is what recovery must undo. */
export interface ManagerState {
  readonly tier: ManagerTier;
  readonly hiredUnderWarning: boolean;
}

/** The whole of stage 4's state, composed onto stage 2's `GymState`. */
export interface ManagedGym {
  readonly gym: GymState;
  readonly condition: ConditionByItem;
  readonly manager: ManagerState | null;
  /** The active failure ledger. Cleared by recovery, counted by `failurePhase`. */
  readonly strikes: readonly CountedDecisionRecord[];
  /** Prompt dismissals taken so far, against the free allowance. */
  readonly promptDismissals: number;
  /** Recoveries completed — reported, so a comeback is visible in the state. */
  readonly recoveries: number;
}

// ---------------------------------------------------------------------------
// Lookups and quotes — every cost computable before the decision (§5.7)
// ---------------------------------------------------------------------------

/** Refuse a tier off the ladder. Loud on a cast-in value. */
function requireManagerTier(tier: ManagerTier): ManagerTier {
  if (!EMPIRE_TUNING.MANAGER_TIERS.includes(tier)) {
    refuseWith(`${String(tier)} is not a manager tier`);
  }
  return tier;
}

/** The flat published hire cost of `tier`. Quote this before charging it. */
export function managerHireCostGymBucks(tier: ManagerTier): number {
  requireManagerTier(tier);
  const cost = EMPIRE_TUNING.MANAGER_HIRE_COST_GYM_BUCKS[tier];
  if (!Number.isFinite(cost) || cost < 0) {
    refuseWith(`${String(tier)} has no published hire cost`);
  }
  return cost;
}

/** `tier`'s wage in Gym Bucks per banked hour of operation. */
export function managerWageRatePerBankedHour(tier: ManagerTier): number {
  requireManagerTier(tier);
  const rate = EMPIRE_TUNING.MANAGER_WAGE_GYM_BUCKS_PER_BANKED_HOUR[tier];
  if (!Number.isFinite(rate) || rate < 0) {
    refuseWith(`${String(tier)} has no published wage rate`);
  }
  return rate;
}

/** The condition below which a manager of `tier` repairs on its own. */
export function managerAutoRepairCondition(tier: ManagerTier): number {
  requireManagerTier(tier);
  const threshold = EMPIRE_TUNING.MANAGER_AUTO_REPAIR_CONDITION[tier];
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    refuseWith(`${String(tier)} has no auto-repair threshold inside [0, 1]`);
  }
  return threshold;
}

/** Every item `gym` owns, in the fixed ladder-then-session order. */
export function ownedItemsOf(gym: GymState): readonly ManagedEquipmentItem[] {
  return Object.freeze([...gym.ladder.equipment, ...gym.sessionEquipment]);
}

/** `item`'s condition in `state`. Refuses an item the gym does not own. */
export function itemCondition(state: ManagedGym, item: ManagedEquipmentItem): number {
  const condition = state.condition[item];
  if (condition === undefined) {
    refuseWith(`${String(item)} is not an owned item with a condition`);
  }
  return condition;
}

/** Mean condition across the owned items. 1 for a gym that owns nothing. */
export function meanCondition(state: ManagedGym): number {
  const items = ownedItemsOf(state.gym);
  if (items.length === 0) return 1;
  let sum = 0;
  for (const item of items) sum += itemCondition(state, item);
  return scrubPrecision(sum / items.length);
}

/** The phase the strike count puts the gym in. Derived, so it can not drift. */
export function failurePhase(state: ManagedGym): FailurePhase {
  if (state.strikes.length >= EMPIRE_TUNING.FAILURE_STRIKES) return 'failed';
  if (state.strikes.length >= EMPIRE_TUNING.FAILURE_WARNING_STRIKES) return 'warned';
  return 'sound';
}

/**
 * The multiplier the next accrual is paid at: the dormancy crawl while
 * failed (see `DORMANT_INCOME_MULTIPLIER`'s own comment for the §5.7
 * recoverability derivation), otherwise the floor plus the condition-scaled
 * remainder — §5.7's auto-deduction as one number a screen can show beside
 * the equipment.
 */
export function conditionIncomeMultiplier(state: ManagedGym): number {
  if (failurePhase(state) === 'failed') return EMPIRE_TUNING.DORMANT_INCOME_MULTIPLIER;
  const floor = EMPIRE_TUNING.CONDITION_INCOME_MULTIPLIER_FLOOR;
  return scrubPrecision(floor + (1 - floor) * meanCondition(state));
}

/**
 * The [0, 1] value stage 3 declared as its condition input — feed this to
 * `memberSatisfaction`'s `conditionMultiplier`, which `members.ts` header §2
 * says stage 4 supplies. Raw mean condition, not the income multiplier: what
 * members feel is the state of the equipment, not the economy's mercy floor.
 */
export function memberConditionInput(state: ManagedGym): number {
  return meanCondition(state);
}

/**
 * What a hired manager is worth in a POSITION comparison: the published hire
 * cost while employed, zero otherwise. `ManagedReading.netPosition` adds it
 * for the same reason it subtracts the repair bill — so a run cannot look
 * richer for having spent later. Its limit, stated because no arithmetic here
 * reaches it: a manager is not resellable and carries an ongoing wage, so this
 * is a comparison term and not a liquidation value. The wage needs no term of
 * its own because it is charged per banked hour and the tuning inequality
 * `management.test.ts` pins keeps it below the income those same hours earn.
 */
export function managerAssetValueGymBucks(state: ManagedGym): number {
  return state.manager === null ? 0 : managerHireCostGymBucks(state.manager.tier);
}

/** The shown cost of restoring `item` to full condition. */
export function repairCostGymBucks(state: ManagedGym, item: ManagedEquipmentItem): number {
  const condition = itemCondition(state, item);
  return scrubPrecision(
    (1 - condition) * EMPIRE_TUNING.REPAIR_COST_GYM_BUCKS_PER_CONDITION_POINT,
  );
}

/** The shown cost of restoring every owned item to full condition. */
export function fullRepairCostGymBucks(state: ManagedGym): number {
  let total = 0;
  for (const item of ownedItemsOf(state.gym)) {
    total += repairCostGymBucks(state, item);
  }
  return scrubPrecision(total);
}

/**
 * The shown cost of the recovery repair investment. The recovery minimum
 * decides WHICH items must be repaired (those below it); the one repair
 * instrument restores an item to full, so the quoted cost is the real cost
 * of the path the player can actually take, not a to-the-minimum figure no
 * function charges.
 */
export function recoveryRepairCostGymBucks(state: ManagedGym): number {
  let total = 0;
  for (const item of ownedItemsOf(state.gym)) {
    if (itemCondition(state, item) < EMPIRE_TUNING.RECOVERY_CONDITION_MIN) {
      total += repairCostGymBucks(state, item);
    }
  }
  return scrubPrecision(total);
}

/** Items worn below the maintenance-prompt line, in the fixed item order. */
export function wornItems(state: ManagedGym): readonly ManagedEquipmentItem[] {
  return Object.freeze(
    ownedItemsOf(state.gym).filter(
      (item) => itemCondition(state, item) < EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION,
    ),
  );
}

/** The in-session maintenance prompt, or quiet. Reported before it is decided. */
export type MaintenancePrompt =
  | { readonly kind: 'quiet' }
  | {
      readonly kind: 'offered';
      /** The worst-conditioned worn item; ties keep the earlier item in order. */
      readonly item: ManagedEquipmentItem;
      readonly repairCostGymBucks: number;
      /** Whether dismissing this prompt would be a counted decision. */
      readonly dismissalWouldCount: boolean;
    };

/**
 * What this check-in's maintenance prompt says, with the cost shown — the
 * §5.7 requirement that a failure-feeding decision had its cost on screen.
 */
export function maintenancePrompt(state: ManagedGym): MaintenancePrompt {
  const worn = wornItems(state);
  if (worn.length === 0) return Object.freeze({ kind: 'quiet' });
  let worst = worn[0] as ManagedEquipmentItem;
  for (const item of worn) {
    if (itemCondition(state, item) < itemCondition(state, worst)) worst = item;
  }
  return Object.freeze({
    kind: 'offered',
    item: worst,
    repairCostGymBucks: repairCostGymBucks(state, worst),
    dismissalWouldCount:
      state.promptDismissals >= EMPIRE_TUNING.MAINTENANCE_PROMPT_FREE_DISMISSALS,
  });
}

/** The visible warning surface — what "despite visible warning signs" reads. */
export interface WarningSigns {
  readonly phase: FailurePhase;
  readonly strikeCount: number;
  readonly strikesUntilFailure: number;
  readonly wornItems: readonly ManagedEquipmentItem[];
}

/** The warning state a screen must be able to show before failure. */
export function warningSigns(state: ManagedGym): WarningSigns {
  return Object.freeze({
    phase: failurePhase(state),
    strikeCount: state.strikes.length,
    strikesUntilFailure: Math.max(0, EMPIRE_TUNING.FAILURE_STRIKES - state.strikes.length),
    wornItems: wornItems(state),
  });
}

/** Whether the warning signs the cheap-hire strike is keyed on are showing. */
export function warningSignsVisible(state: ManagedGym): boolean {
  return failurePhase(state) !== 'sound' || wornItems(state).length > 0;
}

/** What recovery needs right now, with the remaining repair cost quoted. */
export type RecoveryRequirement =
  | { readonly kind: 'not-dormant' }
  | { readonly kind: 'ready' }
  | {
      readonly kind: 'blocked';
      readonly equipmentBelowMinimum: boolean;
      readonly managerHiredUnderWarning: boolean;
      readonly repairCostRemainingGymBucks: number;
    };

/** The recovery quote — §5.7's comeback, costed before it is attempted. */
export function recoveryRequirement(state: ManagedGym): RecoveryRequirement {
  if (failurePhase(state) !== 'failed') return Object.freeze({ kind: 'not-dormant' });
  const repairCostRemaining = recoveryRepairCostGymBucks(state);
  const equipmentBelowMinimum = repairCostRemaining > 0;
  const managerHiredUnderWarning = state.manager?.hiredUnderWarning === true;
  if (!equipmentBelowMinimum && !managerHiredUnderWarning) {
    return Object.freeze({ kind: 'ready' });
  }
  return Object.freeze({
    kind: 'blocked',
    equipmentBelowMinimum,
    managerHiredUnderWarning,
    repairCostRemainingGymBucks: repairCostRemaining,
  });
}

// ---------------------------------------------------------------------------
// State construction and validation
// ---------------------------------------------------------------------------

/** Every owned item at condition 1, in canonical order. */
function fullConditionFor(gym: GymState): ConditionByItem {
  const condition: Partial<Record<ManagedEquipmentItem, number>> = {};
  for (const item of ownedItemsOf(gym)) condition[item] = 1;
  return Object.freeze(condition);
}

/** The opening state: stage 2's opening gym, everything new, nobody hired. */
export function createManagedGym(): ManagedGym {
  const gym = createGymState();
  return Object.freeze({
    gym,
    condition: fullConditionFor(gym),
    manager: null,
    strikes: Object.freeze([]),
    promptDismissals: 0,
    recoveries: 0,
  });
}

/** Refuse a malformed state, and hand a well-formed one back unchanged. */
export function requireManagedGym(state: ManagedGym): ManagedGym {
  requireGymState(state.gym);
  const owned = ownedItemsOf(state.gym);
  const conditionKeys = Object.keys(state.condition);
  if (conditionKeys.length !== owned.length) {
    refuseWith(
      `the condition map holds ${conditionKeys.length} items and the gym owns ${owned.length}`,
    );
  }
  for (const item of owned) {
    const condition = state.condition[item];
    if (condition === undefined) {
      refuseWith(`${String(item)} is owned and carries no condition`);
    }
    if (!Number.isFinite(condition) || condition < 0 || condition > 1) {
      refuseWith(`${String(item)}'s condition must be inside [0, 1], received ${condition}`);
    }
  }
  if (state.manager !== null) requireManagerTier(state.manager.tier);
  if (!Number.isInteger(state.promptDismissals) || state.promptDismissals < 0) {
    refuseWith(
      `prompt dismissals must be a whole number at or above zero, received ${state.promptDismissals}`,
    );
  }
  if (!Number.isInteger(state.recoveries) || state.recoveries < 0) {
    refuseWith(`recoveries must be a whole number at or above zero, received ${state.recoveries}`);
  }
  let previousAt = 0;
  for (const record of state.strikes) {
    if (!COUNTED_DECISIONS.includes(record.decision)) {
      refuseWith(`${String(record.decision)} is not a counted decision`);
    }
    if (!Number.isFinite(record.atSeconds) || record.atSeconds < previousAt) {
      refuseWith(`strike times must be non-decreasing, received ${record.atSeconds}`);
    }
    previousAt = record.atSeconds;
    if (!Number.isFinite(record.shownCostGymBucks) || record.shownCostGymBucks < 0) {
      refuseWith(
        `a shown cost must be finite and at or above zero, received ${record.shownCostGymBucks}`,
      );
    }
  }
  return state;
}

/**
 * Re-seat this module's state on an updated `GymState` — the seam for a
 * caller that bought equipment through `sessions.ts`: known items keep their
 * condition, newly owned items arrive at condition 1. Refuses a gym that no
 * longer owns an item the condition map knows, because nothing sells.
 */
export function withUpdatedGym(state: ManagedGym, gym: GymState): ManagedGym {
  requireManagedGym(state);
  requireGymState(gym);
  const owned = ownedItemsOf(gym);
  const known = new Set<string>(Object.keys(state.condition));
  for (const item of known) {
    if (!owned.includes(item as ManagedEquipmentItem)) {
      refuseWith(`${item} carries a condition and is no longer owned`);
    }
  }
  const condition: Partial<Record<ManagedEquipmentItem, number>> = {};
  for (const item of owned) {
    condition[item] = state.condition[item] ?? 1;
  }
  return Object.freeze({ ...state, gym, condition: Object.freeze(condition) });
}

// ---------------------------------------------------------------------------
// The strike writer — one function, called by the three §5.7 decision shapes
// ---------------------------------------------------------------------------

/**
 * Append a counted decision. The single writer of `strikes` outside
 * `recoverGym`'s clear, so header §3's claim is one code path rather than a
 * convention — and it touches condition NOWHERE, which is header §4's
 * measured derivation: a condition cliff at a decision boundary is a money
 * cost whose arrival time engagement moves.
 */
function countDecision(
  state: ManagedGym,
  decision: CountedDecision,
  atSeconds: number,
  shownCostGymBucks: number,
): ManagedGym {
  return Object.freeze({
    ...state,
    strikes: Object.freeze([
      ...state.strikes,
      Object.freeze({ decision, atSeconds, shownCostGymBucks }),
    ]),
  });
}

/**
 * The removed entry slump, kept as the control's instrument only: every item
 * loses `slumpCondition`, clamped at zero. Reachable through
 * `runManagedGym`'s `'failure-slump-control'` wiring and through nothing a
 * screen would call — header §4 has the measurement that removed it.
 */
function withFailureSlumpForControl(state: ManagedGym, slumpCondition: number): ManagedGym {
  const condition: Partial<Record<ManagedEquipmentItem, number>> = {};
  for (const item of ownedItemsOf(state.gym)) {
    condition[item] = scrubPrecision(Math.max(0, itemCondition(state, item) - slumpCondition));
  }
  return Object.freeze({ ...state, condition: Object.freeze(condition) });
}

// ---------------------------------------------------------------------------
// The check-in — wear, income at the condition multiplier, wage, auto-repair
// ---------------------------------------------------------------------------

/** One manager auto-repair, reported: which item and what the gym was billed. */
export interface AutoRepairReport {
  readonly item: ManagedEquipmentItem;
  readonly costGymBucks: number;
}

/** Everything one managed check-in did. Reported, never silent. */
export interface ManagedCheckIn {
  readonly state: ManagedGym;
  /** The ladder's own accrual record for the gap, unmodified. */
  readonly accrual: LadderAccrual;
  /** The multiplier the accrual was paid at, read after the gap's wear. */
  readonly incomeMultiplier: number;
  /** What the purse kept of the raw accrual. */
  readonly incomePaidGymBucks: number;
  /** What condition took off the raw accrual — §5.7's auto-deduction. */
  readonly incomeDeductedGymBucks: number;
  /** Mean condition lost to this gap's wear. Zero while dormant. */
  readonly meanConditionWear: number;
  readonly wagePaidGymBucks: number;
  /** Wage due that the purse did not cover. Reported, not silently forgiven. */
  readonly wageShortfallGymBucks: number;
  readonly autoRepairs: readonly AutoRepairReport[];
}

/** A purse write on the composed state, through the ladder it composes. */
function withPurse(state: ManagedGym, gymBucks: number): ManagedGym {
  return Object.freeze({
    ...state,
    gym: withLadder(
      state.gym,
      Object.freeze({ ...state.gym.ladder, gymBucks: scrubPrecision(gymBucks) }),
    ),
  });
}

/** Wear every item by `wearSeconds` of operation, clamped at zero. */
function withWear(state: ManagedGym, wearSeconds: number): ManagedGym {
  if (wearSeconds === 0) return state;
  const wear =
    EMPIRE_TUNING.EQUIPMENT_WEAR_PER_BANKED_HOUR *
    (wearSeconds / EMPIRE_TUNING.SECONDS_PER_HOUR);
  const condition: Partial<Record<ManagedEquipmentItem, number>> = {};
  for (const item of ownedItemsOf(state.gym)) {
    condition[item] = scrubPrecision(Math.max(0, itemCondition(state, item) - wear));
  }
  return Object.freeze({ ...state, condition: Object.freeze(condition) });
}

/**
 * The shipped check-in, and the one place stage 4 touches the income path.
 * Header §§1-2 give the derivation: wear by the gap's banked seconds, then
 * income at the post-wear multiplier, then wage per banked hour, then the
 * manager's autonomous routine repairs — each reported.
 *
 * The private wear-basis seam is what the run's wall-clock-wear control
 * reaches through; this export is pinned to the banked reading.
 */
export function managedCheckIn(state: ManagedGym, atSeconds: number): ManagedCheckIn {
  return checkInWithWearBasis(state, atSeconds, 'banked-operation');
}

/** The wear bases the composed run can drive. Only the first ships. */
type WearBasis = 'banked-operation' | 'wall-clock-elapsed';

function checkInWithWearBasis(
  state: ManagedGym,
  atSeconds: number,
  basis: WearBasis,
): ManagedCheckIn {
  requireManagedGym(state);
  const dormant = failurePhase(state) === 'failed';
  const checkedIn = gymCheckIn(state.gym, atSeconds);
  const accrual = checkedIn.accrual;
  let next: ManagedGym = Object.freeze({ ...state, gym: checkedIn.state });

  // Wear first — §2 of the header says why the multiplier reads after it.
  // Dormancy applies no wear at all; §4 of the header is the derivation.
  const wearSeconds = dormant
    ? 0
    : basis === 'banked-operation'
      ? accrual.secondsBanked
      : accrual.secondsElapsed;
  const meanBefore = meanCondition(next);
  next = withWear(next, wearSeconds);
  const meanConditionWear = scrubPrecision(meanBefore - meanCondition(next));

  // Income at the post-wear multiplier: the purse was credited the raw
  // accrual by `gymCheckIn`; the deducted share comes back off it here.
  const incomeMultiplier = conditionIncomeMultiplier(next);
  const incomeDeducted = scrubPrecision(accrual.gymBucks * (1 - incomeMultiplier));
  const incomePaid = scrubPrecision(accrual.gymBucks - incomeDeducted);
  next = withPurse(next, next.gym.ladder.gymBucks - incomeDeducted);

  // Wage per banked hour, dormancy excepted, shortfall reported.
  let wagePaid = 0;
  let wageShortfall = 0;
  if (next.manager !== null && !dormant) {
    const due = scrubPrecision(
      managerWageRatePerBankedHour(next.manager.tier) *
        (accrual.secondsBanked / EMPIRE_TUNING.SECONDS_PER_HOUR),
    );
    wagePaid = Math.min(next.gym.ladder.gymBucks, due);
    wageShortfall = scrubPrecision(due - wagePaid);
    next = withPurse(next, next.gym.ladder.gymBucks - wagePaid);
  }

  // The manager's autonomous routine repairs — §5.7's good-manager function,
  // billed to the gym at the published rate, item order fixed.
  const autoRepairs: AutoRepairReport[] = [];
  if (next.manager !== null && !dormant) {
    const threshold = managerAutoRepairCondition(next.manager.tier);
    for (const item of ownedItemsOf(next.gym)) {
      if (itemCondition(next, item) >= threshold) continue;
      const cost = repairCostGymBucks(next, item);
      if (next.gym.ladder.gymBucks < cost) continue;
      next = withPurse(next, next.gym.ladder.gymBucks - cost);
      next = Object.freeze({
        ...next,
        condition: Object.freeze({ ...next.condition, [item]: 1 }),
      });
      autoRepairs.push(Object.freeze({ item, costGymBucks: cost }));
    }
  }

  return Object.freeze({
    state: next,
    accrual,
    incomeMultiplier,
    incomePaidGymBucks: incomePaid,
    incomeDeductedGymBucks: incomeDeducted,
    meanConditionWear,
    wagePaidGymBucks: wagePaid,
    wageShortfallGymBucks: wageShortfall,
    autoRepairs: Object.freeze(autoRepairs),
  });
}

// ---------------------------------------------------------------------------
// The decisions — §5.7's shapes, each with a shown cost and loud refusals
// ---------------------------------------------------------------------------

/** Repairing an item: it lands, or the refusal says why, state unchanged. */
export type RepairResult =
  | {
      readonly kind: 'repaired';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly cost: number;
    }
  | {
      readonly kind: 'refused';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly cost: number;
      readonly reason: 'not-owned' | 'already-sound' | 'not-enough-gym-bucks';
    };

/**
 * The explicit repair decision: spend the gym's own settled money to restore
 * `item` to full condition, at the quoted cost. Allowed while dormant — it is
 * the recovery investment's instrument.
 */
export function repairEquipment(state: ManagedGym, item: ManagedEquipmentItem): RepairResult {
  requireManagedGym(state);
  if (state.condition[item] === undefined) {
    return Object.freeze({ kind: 'refused', state, item, cost: 0, reason: 'not-owned' });
  }
  const cost = repairCostGymBucks(state, item);
  if (cost === 0) {
    return Object.freeze({ kind: 'refused', state, item, cost, reason: 'already-sound' });
  }
  if (state.gym.ladder.gymBucks < cost) {
    return Object.freeze({ kind: 'refused', state, item, cost, reason: 'not-enough-gym-bucks' });
  }
  const paid = withPurse(state, state.gym.ladder.gymBucks - cost);
  return Object.freeze({
    kind: 'repaired',
    state: Object.freeze({
      ...paid,
      condition: Object.freeze({ ...paid.condition, [item]: 1 }),
    }),
    item,
    cost,
  });
}

/** Declining a shown repair: counted, or refused because nothing was offered. */
export type DeclineRepairResult =
  | {
      readonly kind: 'declined';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly shownCost: number;
    }
  | {
      readonly kind: 'refused';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly reason: 'not-owned' | 'not-offered';
    };

/**
 * §5.7's third counted shape: actively declining a repair whose cost was
 * shown. A decline is meaningful when the repair was on offer — the item worn
 * below the prompt line — so a decline of a sound item is a refusal, not a
 * strike. `atSeconds` stamps the record; pass the gym clock's current mark.
 */
export function declineRepair(
  state: ManagedGym,
  item: ManagedEquipmentItem,
  atSeconds: number,
): DeclineRepairResult {
  requireManagedGym(state);
  if (state.condition[item] === undefined) {
    return Object.freeze({ kind: 'refused', state, item, reason: 'not-owned' });
  }
  if (itemCondition(state, item) >= EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION) {
    return Object.freeze({ kind: 'refused', state, item, reason: 'not-offered' });
  }
  const shownCost = repairCostGymBucks(state, item);
  return Object.freeze({
    kind: 'declined',
    state: countDecision(state, 'repair-declined', atSeconds, shownCost),
    item,
    shownCost,
  });
}

/** Answering the maintenance prompt: repair the worst item, or dismiss it. */
export type PromptResponse = 'repair' | 'dismiss';

export type PromptResult =
  | { readonly kind: 'no-prompt'; readonly state: ManagedGym }
  | {
      readonly kind: 'repaired';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly cost: number;
    }
  | {
      readonly kind: 'repair-refused';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly cost: number;
      readonly reason: 'not-enough-gym-bucks';
    }
  | {
      readonly kind: 'dismissed';
      readonly state: ManagedGym;
      readonly item: ManagedEquipmentItem;
      readonly shownCost: number;
      /** Whether this dismissal was a counted decision — past the free one. */
      readonly counted: boolean;
    };

/**
 * §5.7's second counted shape: the in-session maintenance prompt, answered.
 * The first `MAINTENANCE_PROMPT_FREE_DISMISSALS` dismissals mark nothing;
 * each one after is a counted decision carrying the cost that was shown.
 */
export function respondToPrompt(
  state: ManagedGym,
  response: PromptResponse,
  atSeconds: number,
): PromptResult {
  requireManagedGym(state);
  const prompt = maintenancePrompt(state);
  if (prompt.kind === 'quiet') return Object.freeze({ kind: 'no-prompt', state });
  if (response === 'repair') {
    const outcome = repairEquipment(state, prompt.item);
    if (outcome.kind === 'repaired') {
      return Object.freeze({
        kind: 'repaired',
        state: outcome.state,
        item: outcome.item,
        cost: outcome.cost,
      });
    }
    return Object.freeze({
      kind: 'repair-refused',
      state,
      item: prompt.item,
      cost: prompt.repairCostGymBucks,
      reason: 'not-enough-gym-bucks',
    });
  }
  const counted = prompt.dismissalWouldCount;
  const dismissed: ManagedGym = Object.freeze({
    ...state,
    promptDismissals: state.promptDismissals + 1,
  });
  return Object.freeze({
    kind: 'dismissed',
    state: counted
      ? countDecision(dismissed, 'prompt-dismissed-again', atSeconds, prompt.repairCostGymBucks)
      : dismissed,
    item: prompt.item,
    shownCost: prompt.repairCostGymBucks,
    counted,
  });
}

/** Hiring: it lands (counted if cheap-under-warning), or the refusal says why. */
export type HireResult =
  | {
      readonly kind: 'hired';
      readonly state: ManagedGym;
      readonly tier: ManagerTier;
      readonly cost: number;
      /** §5.7's first counted shape: the cheapest tier, warnings showing. */
      readonly countedAsStrike: boolean;
    }
  | {
      readonly kind: 'refused';
      readonly state: ManagedGym;
      readonly tier: ManagerTier;
      readonly cost: number;
      readonly reason: 'already-staffed' | 'not-enough-gym-bucks';
    };

/**
 * Hire a manager at `tier`, at the published cost. Hiring the cheapest tier
 * while warning signs show is §5.7's first counted decision shape, and the
 * hire itself is flagged so recovery can require the turnaround.
 */
export function hireManager(state: ManagedGym, tier: ManagerTier, atSeconds: number): HireResult {
  requireManagedGym(state);
  const cost = managerHireCostGymBucks(tier);
  if (state.manager !== null) {
    return Object.freeze({ kind: 'refused', state, tier, cost, reason: 'already-staffed' });
  }
  if (state.gym.ladder.gymBucks < cost) {
    return Object.freeze({ kind: 'refused', state, tier, cost, reason: 'not-enough-gym-bucks' });
  }
  const cheapestTier = EMPIRE_TUNING.MANAGER_TIERS[0];
  const countedAsStrike = tier === cheapestTier && warningSignsVisible(state);
  let next = withPurse(state, state.gym.ladder.gymBucks - cost);
  next = Object.freeze({
    ...next,
    manager: Object.freeze({ tier, hiredUnderWarning: countedAsStrike }),
  });
  if (countedAsStrike) {
    next = countDecision(next, 'cheapest-hire-under-warning', atSeconds, cost);
  }
  return Object.freeze({ kind: 'hired', state: next, tier, cost, countedAsStrike });
}

/** Letting the manager go. Free, and the staffing half of a turnaround. */
export type DismissManagerResult =
  | { readonly kind: 'dismissed'; readonly state: ManagedGym; readonly tier: ManagerTier }
  | { readonly kind: 'refused'; readonly state: ManagedGym; readonly reason: 'no-manager' };

export function dismissManager(state: ManagedGym): DismissManagerResult {
  requireManagedGym(state);
  if (state.manager === null) {
    return Object.freeze({ kind: 'refused', state, reason: 'no-manager' });
  }
  return Object.freeze({
    kind: 'dismissed',
    state: Object.freeze({ ...state, manager: null }),
    tier: state.manager.tier,
  });
}

/** Recovery: back online, or the refusal names the first unmet requirement. */
export type RecoveryResult =
  | { readonly kind: 'recovered'; readonly state: ManagedGym }
  | {
      readonly kind: 'refused';
      readonly state: ManagedGym;
      readonly reason:
        | 'not-dormant'
        | 'equipment-below-recovery-minimum'
        | 'manager-hired-under-warning';
    };

/**
 * §5.7's comeback: a dormant gym whose equipment has been restored to the
 * recovery minimum and whose counted-cheap hire is gone comes back online.
 * The active strikes clear, the free-dismissal allowance resets, and the
 * recovery is counted so the comeback is visible in the state.
 */
export function recoverGym(state: ManagedGym): RecoveryResult {
  requireManagedGym(state);
  const requirement = recoveryRequirement(state);
  if (requirement.kind === 'not-dormant') {
    return Object.freeze({ kind: 'refused', state, reason: 'not-dormant' });
  }
  if (requirement.kind === 'blocked') {
    return Object.freeze({
      kind: 'refused',
      state,
      reason: requirement.equipmentBelowMinimum
        ? 'equipment-below-recovery-minimum'
        : 'manager-hired-under-warning',
    });
  }
  return Object.freeze({
    kind: 'recovered',
    state: Object.freeze({
      ...state,
      strikes: Object.freeze([]),
      promptDismissals: 0,
      recoveries: state.recoveries + 1,
    }),
  });
}

// ---------------------------------------------------------------------------
// The composed run — what the sweeps drive
// ---------------------------------------------------------------------------

/**
 * The simulated-player decision policies the composed run folds with —
 * vocabulary, not injection, exactly as `ladder.ts`'s policies are. Each is a
 * deterministic rule below; none is a game feature. 'negligent',
 * 'cheapskate' and 'redemptive' exist so the failure machine's arms are
 * produced rather than merely possible.
 */
export const MANAGEMENT_POLICIES = Object.freeze([
  'hands-off',
  'diligent',
  'negligent',
  'cheapskate',
  'delegating',
  'redemptive',
] as const);

export type ManagementPolicy = (typeof MANAGEMENT_POLICIES)[number];

/**
 * The wirings the run can be driven under. `'shipped'` is the engine; the
 * three controls are what the sweep's zeros are zeros against, reachable
 * through `runManagedGym`'s wiring argument and through nothing a screen
 * would call:
 *
 *   - `'wall-clock-wear-control'` keys wear to elapsed seconds instead of
 *     banked ones — the decay-while-away model the §5.13 ruling forbids.
 *   - `'absence-strike-control'` fabricates a counted record per whole day
 *     the offline cap discarded from a gap — elapsed time feeding failure,
 *     §5.7 broken by construction.
 *   - `'visit-fee-control'` charges the purse a flat fee per check-in — the
 *     punishing per-event shape `engagement.ts`'s upkeep controls pin.
 *   - `'failure-slump-control'` applies the removed dormancy entry slump at
 *     the check-in whose decisions cross the failure line — the discrete
 *     money cliff header §4 measured and took out.
 */
export const MANAGEMENT_WIRINGS = Object.freeze([
  'shipped',
  'wall-clock-wear-control',
  'absence-strike-control',
  'visit-fee-control',
  'failure-slump-control',
] as const);

export type ManagementWiringKey = (typeof MANAGEMENT_WIRINGS)[number];

/** The one wiring the game ships. */
export const SHIPPED_MANAGEMENT_WIRING: ManagementWiringKey = 'shipped';

/**
 * A wiring and the two magnitudes its controls need. Each dial is required to
 * be zero on every wiring that does not spend it, the discipline
 * `engagement.ts`'s wiring constructor sets — a control whose dial is set on
 * the shipped wiring would be a subject quietly under a control's arithmetic.
 */
export interface ManagementWiring {
  readonly key: ManagementWiringKey;
  readonly controlChargeGymBucks: number;
  readonly controlSlumpCondition: number;
}

/** True for the wiring that charges the purse per check-in. */
export function chargesVisitFee(key: ManagementWiringKey): boolean {
  return key === 'visit-fee-control';
}

/** True for the wiring that applies the removed dormancy entry slump. */
export function slumpsOnFailure(key: ManagementWiringKey): boolean {
  return key === 'failure-slump-control';
}

/** Build a wiring, refusing a dial on a wiring that has nothing to turn. */
export function managementWiring(
  key: ManagementWiringKey,
  controlChargeGymBucks: number,
  controlSlumpCondition = 0,
): ManagementWiring {
  if (!MANAGEMENT_WIRINGS.includes(key)) {
    refuseWith(`${String(key)} is not a management wiring`);
  }
  if (!Number.isFinite(controlChargeGymBucks) || controlChargeGymBucks < 0) {
    refuseWith(
      `a control charge must be finite and at or above zero, received ${controlChargeGymBucks}`,
    );
  }
  if (!chargesVisitFee(key) && controlChargeGymBucks !== 0) {
    refuseWith(`the ${key} wiring charges no visit fee, so ${controlChargeGymBucks} has no meaning`);
  }
  if (chargesVisitFee(key) && controlChargeGymBucks === 0) {
    refuseWith(`the ${key} wiring charges nothing at zero, so it controls for nothing`);
  }
  if (!Number.isFinite(controlSlumpCondition) || controlSlumpCondition < 0 || controlSlumpCondition > 1) {
    refuseWith(
      `a control slump must be finite and inside [0, 1], received ${controlSlumpCondition}`,
    );
  }
  if (!slumpsOnFailure(key) && controlSlumpCondition !== 0) {
    refuseWith(`the ${key} wiring slumps nothing, so ${controlSlumpCondition} has no meaning`);
  }
  if (slumpsOnFailure(key) && controlSlumpCondition === 0) {
    refuseWith(`the ${key} wiring slumps nothing at zero, so it controls for nothing`);
  }
  return Object.freeze({ key, controlChargeGymBucks, controlSlumpCondition });
}

/** The shipped wiring, which has no dial. */
export function shippedManagementWiring(): ManagementWiring {
  return managementWiring(SHIPPED_MANAGEMENT_WIRING, 0, 0);
}

/** A decision the run's policy took, in the order taken. Kinds are closed. */
export const MANAGED_DECISION_KINDS = Object.freeze([
  'repair',
  'prompt-repair',
  'prompt-dismiss',
  'decline-repair',
  'hire-novice',
  'hire-steady',
  'hire-veteran',
  'dismiss-manager',
  'recover',
] as const);

export type ManagedDecisionKind = (typeof MANAGED_DECISION_KINDS)[number];

export interface ManagedDecisionEvent {
  readonly kind: ManagedDecisionKind;
  /** Index into the run's readings — which check-in the decision followed. */
  readonly checkIn: number;
  /** Whether it appended a strike. */
  readonly counted: boolean;
}

/** One check-in's readings — the series the never-punish sweep compares. */
export interface ManagedReading {
  readonly atSeconds: number;
  readonly secondsBanked: number;
  readonly meanCondition: number;
  readonly incomeMultiplier: number;
  readonly incomePaid: number;
  readonly incomeDeducted: number;
  readonly wagePaid: number;
  /**
   * The settled purse itself — `netPosition`'s first term, reported so the
   * decomposition can be read out of a reading rather than re-derived.
   */
  readonly settledGymBucks: number;
  /** The full repair bill — `netPosition`'s second term, same reason. */
  readonly fullRepairCost: number;
  /**
   * Settled purse, minus the full repair bill, plus the hired manager's
   * published cost — the position the monotonicity pins compare, so a run
   * cannot look richer by simply not having spent yet. Both adjustments are
   * net-neutral at the moment of the spend by construction: a repair's cost
   * equals the bill it removes, and a hire's cost equals the asset term it
   * adds. Without the second term a richer run that hires the veteran one
   * check-in earlier reads as net-worse for the readings in between, which is
   * the timed-lump-spend phasing `engagement.ts` measured and attributed to
   * the player model rather than to the design.
   *
   * All three terms are reported beside it, and
   * `management.test.ts`'s `netPosition is exactly its three reported terms`
   * pins the identity over every reading of every run the battery drove, in
   * both the per-reading and the end-of-run direction. That pin is what makes
   * a fourth term visible: adding one changes `netPosition` and moves none of
   * the three reported terms, so the identity goes red rather than the sweep
   * quietly reporting a different quantity under the same name.
   */
  readonly netPosition: number;
  /** The manager term inside `netPosition`, reported so it can be read out. */
  readonly managerAssetValue: number;
  readonly phase: FailurePhase;
  readonly strikeCount: number;
}

/** What one composed run actually did, so a zero reports its own domain. */
export interface ManagedRunCensus {
  readonly checkIns: number;
  readonly promptsOffered: number;
  readonly promptRepairs: number;
  readonly promptDismissals: number;
  readonly countedDismissals: number;
  readonly repairs: number;
  readonly declines: number;
  readonly autoRepairs: number;
  readonly hires: number;
  readonly managerDismissals: number;
  readonly recoveries: number;
  readonly recoveryRefusals: number;
  readonly wageShortfalls: number;
  /** Check-ins a control charged, struck or slumped on. Zero when shipped. */
  readonly controlCharges: number;
  readonly controlStrikes: number;
  readonly controlSlumps: number;
  /** The first reading index at which the gym was failed, or null. */
  readonly failedAtCheckIn: number | null;
}

/** One composed run: the end state and every series the sweeps compare. */
export interface ManagedRun {
  readonly state: ManagedGym;
  readonly wiring: ManagementWiring;
  readonly policy: ManagementPolicy;
  readonly readings: readonly ManagedReading[];
  readonly decisions: readonly ManagedDecisionEvent[];
  readonly census: ManagedRunCensus;
}

/** The decision-event kind a hire of `tier` records. A map, not a cast. */
function hireKindOf(tier: ManagerTier): ManagedDecisionKind {
  if (tier === 'novice') return 'hire-novice';
  if (tier === 'steady') return 'hire-steady';
  return 'hire-veteran';
}

/**
 * Fold a whole check-in schedule through the managed gym under a named
 * policy and wiring. Deterministic by construction: no draw, no clock read,
 * fixed item order, fixed decision order per check-in. The schedule must be
 * strictly ascending whole ticks, as `ladderCheckIn` requires.
 */
export function runManagedGym(
  checkInsSeconds: readonly number[],
  policy: ManagementPolicy,
  wiring: ManagementWiring = shippedManagementWiring(),
): ManagedRun {
  if (!MANAGEMENT_POLICIES.includes(policy)) {
    refuseWith(`${String(policy)} is not a management policy`);
  }
  // Revalidate through the constructor, so a hand-built wiring object gets
  // the same refusals (a dial on a wiring with nothing to turn, and so on).
  managementWiring(wiring.key, wiring.controlChargeGymBucks, wiring.controlSlumpCondition);

  let state = createManagedGym();
  const readings: ManagedReading[] = [];
  const decisions: ManagedDecisionEvent[] = [];
  let promptsOffered = 0;
  let promptRepairs = 0;
  let promptDismissalCount = 0;
  let countedDismissals = 0;
  let repairs = 0;
  let declines = 0;
  let autoRepairCount = 0;
  let hires = 0;
  let managerDismissals = 0;
  let recoveries = 0;
  let recoveryRefusals = 0;
  let wageShortfalls = 0;
  let controlCharges = 0;
  let controlStrikes = 0;
  let controlSlumps = 0;
  let failedAtCheckIn: number | null = null;
  let previous = -1;

  // An index loop and not `checkInsSeconds.entries()`, deliberately: a member
  // call on a caller-supplied array is an enumerated site
  // `empireForbiddenOutput.test.ts` has to drive or declare undriven, and this
  // directory's own precedent is that a smaller enumerated surface is worth
  // more than another driver for something no caller can reach.
  for (let checkIn = 0; checkIn < checkInsSeconds.length; checkIn += 1) {
    const at = checkInsSeconds[checkIn] as number;
    if (at <= previous) {
      refuseWith(`check-ins must be strictly ascending, received ${at} after ${previous}`);
    }
    previous = at;

    const basis: WearBasis =
      wiring.key === 'wall-clock-wear-control' ? 'wall-clock-elapsed' : 'banked-operation';
    const outcome = checkInWithWearBasis(state, at, basis);
    state = outcome.state;
    autoRepairCount += outcome.autoRepairs.length;
    if (outcome.wageShortfallGymBucks > 0) wageShortfalls += 1;

    if (chargesVisitFee(wiring.key)) {
      const charge = Math.min(state.gym.ladder.gymBucks, wiring.controlChargeGymBucks);
      if (charge > 0) {
        state = withPurse(state, state.gym.ladder.gymBucks - charge);
        controlCharges += 1;
      }
    }

    if (wiring.key === 'absence-strike-control') {
      // The control fabricates counted records off elapsed time — one per
      // whole day the offline cap discarded, so pure absence beyond the
      // horizon feeds failure directly. A decision the player did not take,
      // which is exactly the §5.7 violation it models. It reuses the decline
      // token so no control-owned vocabulary ships in the ledger's type.
      const fabricated = Math.floor(
        outcome.accrual.secondsDiscarded / EMPIRE_TUNING.SECONDS_PER_DAY,
      );
      for (let struck = 0; struck < fabricated; struck += 1) {
        state = countDecision(state, 'repair-declined', at, fullRepairCostGymBucks(state));
        controlStrikes += 1;
      }
    }

    // The policy's decisions, in one fixed order per check-in.
    const failedBeforeDecisions = failurePhase(state) === 'failed';
    if (policy !== 'hands-off') {
      const dormant = failurePhase(state) === 'failed';
      if (policy === 'redemptive' && dormant) {
        // Repair everything affordable, shed a counted hire, then recover.
        for (const item of ownedItemsOf(state.gym)) {
          const repaired = repairEquipment(state, item);
          if (repaired.kind === 'repaired') {
            state = repaired.state;
            repairs += 1;
            decisions.push(Object.freeze({ kind: 'repair', checkIn, counted: false }));
          }
        }
        // The staffing turnaround sheds whoever presided over the failure —
        // required for a counted-cheap hire, chosen here for any manager.
        if (state.manager !== null) {
          const dismissed = dismissManager(state);
          if (dismissed.kind === 'dismissed') {
            state = dismissed.state;
            managerDismissals += 1;
            decisions.push(Object.freeze({ kind: 'dismiss-manager', checkIn, counted: false }));
          }
        }
        const recovered = recoverGym(state);
        if (recovered.kind === 'recovered') {
          state = recovered.state;
          recoveries += 1;
          decisions.push(Object.freeze({ kind: 'recover', checkIn, counted: false }));
          // The staffing half of §5.7's turnaround: after coming back online,
          // the redemptive player hires the middle tier so the comeback has a
          // keeper — and so the hire-steady arm is produced by a run.
          if (state.manager === null) {
            const steady = EMPIRE_TUNING.MANAGER_TIERS[1] as ManagerTier;
            const hired = hireManager(state, steady, at);
            if (hired.kind === 'hired') {
              state = hired.state;
              hires += 1;
              decisions.push(
                Object.freeze({
                  kind: hireKindOf(steady),
                  checkIn,
                  counted: hired.countedAsStrike,
                }),
              );
            }
          }
        } else {
          recoveryRefusals += 1;
        }
      } else {
        if (policy === 'delegating' && state.manager === null) {
          // The delegating player waits for the manager worth delegating to —
          // the top tier — rather than settling for whoever is affordable.
          const best = EMPIRE_TUNING.MANAGER_TIERS[
            EMPIRE_TUNING.MANAGER_TIERS.length - 1
          ] as ManagerTier;
          const tier =
            state.gym.ladder.gymBucks >= managerHireCostGymBucks(best) ? best : null;
          if (tier !== null) {
            const hired = hireManager(state, tier, at);
            if (hired.kind === 'hired') {
              state = hired.state;
              hires += 1;
              decisions.push(
                Object.freeze({
                  kind: hireKindOf(tier),
                  checkIn,
                  counted: hired.countedAsStrike,
                }),
              );
            }
          }
        }
        if (policy === 'cheapskate' && state.manager === null && warningSignsVisible(state)) {
          // The cheapskate reacts to visible trouble by hiring the cheapest
          // tier — §5.7's first counted shape, produced rather than possible.
          const cheapest = EMPIRE_TUNING.MANAGER_TIERS[0];
          const hired = hireManager(state, cheapest, at);
          if (hired.kind === 'hired') {
            state = hired.state;
            hires += 1;
            decisions.push(
              Object.freeze({
                kind: hireKindOf(cheapest),
                checkIn,
                counted: hired.countedAsStrike,
              }),
            );
          }
        }

        const prompt = maintenancePrompt(state);
        if (prompt.kind === 'offered') {
          promptsOffered += 1;
          if (policy === 'diligent' || policy === 'delegating') {
            const answered = respondToPrompt(state, 'repair', at);
            if (answered.kind === 'repaired') {
              state = answered.state;
              promptRepairs += 1;
              decisions.push(Object.freeze({ kind: 'prompt-repair', checkIn, counted: false }));
            }
          } else if (policy === 'cheapskate') {
            // The active decline — §5.7's third shape, produced rather than
            // merely possible: the cheapskate is shown the worst item's cost
            // and turns it down, every prompted check-in.
            const turnedDown = declineRepair(state, prompt.item, at);
            if (turnedDown.kind === 'declined') {
              state = turnedDown.state;
              declines += 1;
              decisions.push(
                Object.freeze({ kind: 'decline-repair', checkIn, counted: true }),
              );
            }
          } else {
            const answered = respondToPrompt(state, 'dismiss', at);
            if (answered.kind === 'dismissed') {
              state = answered.state;
              promptDismissalCount += 1;
              if (answered.counted) countedDismissals += 1;
              decisions.push(
                Object.freeze({ kind: 'prompt-dismiss', checkIn, counted: answered.counted }),
              );
            }
          }
        }

        if (policy === 'diligent') {
          for (const item of ownedItemsOf(state.gym)) {
            if (itemCondition(state, item) >= EMPIRE_TUNING.REPAIR_POLICY_CONDITION) continue;
            const repaired = repairEquipment(state, item);
            if (repaired.kind === 'repaired') {
              state = repaired.state;
              repairs += 1;
              decisions.push(Object.freeze({ kind: 'repair', checkIn, counted: false }));
            }
          }
        }
      }
    }

    if (
      slumpsOnFailure(wiring.key) &&
      !failedBeforeDecisions &&
      failurePhase(state) === 'failed'
    ) {
      // The removed mechanism, run as a control at the crossing it used to
      // fire on — header §4 has the measurement that took it out of the
      // shipped path.
      state = withFailureSlumpForControl(state, wiring.controlSlumpCondition);
      controlSlumps += 1;
    }

    if (failedAtCheckIn === null && failurePhase(state) === 'failed') {
      failedAtCheckIn = checkIn;
    }
    readings.push(
      Object.freeze({
        atSeconds: at,
        secondsBanked: outcome.accrual.secondsBanked,
        meanCondition: meanCondition(state),
        incomeMultiplier: outcome.incomeMultiplier,
        incomePaid: outcome.incomePaidGymBucks,
        incomeDeducted: outcome.incomeDeductedGymBucks,
        wagePaid: outcome.wagePaidGymBucks,
        settledGymBucks: state.gym.ladder.gymBucks,
        fullRepairCost: fullRepairCostGymBucks(state),
        netPosition: scrubPrecision(
          state.gym.ladder.gymBucks -
            fullRepairCostGymBucks(state) +
            managerAssetValueGymBucks(state),
        ),
        managerAssetValue: managerAssetValueGymBucks(state),
        phase: failurePhase(state),
        strikeCount: state.strikes.length,
      }),
    );
  }

  return Object.freeze({
    state,
    wiring,
    policy,
    readings: Object.freeze(readings),
    decisions: Object.freeze(decisions),
    census: Object.freeze({
      checkIns: checkInsSeconds.length,
      promptsOffered,
      promptRepairs,
      promptDismissals: promptDismissalCount,
      countedDismissals,
      repairs,
      declines,
      autoRepairs: autoRepairCount,
      hires,
      managerDismissals,
      recoveries,
      recoveryRefusals,
      wageShortfalls,
      controlCharges,
      controlStrikes,
      controlSlumps,
      failedAtCheckIn,
    }),
  });
}
