/**
 * stationView.ts — GDD §5.14 Stage C: station-tap management.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock, no randomness. This is the small selector
 * CLAUDE.md's Stage C brief asks for ("a small pure selector/projector that
 * composes existing state over embedding substantial derivation in JSX") — it
 * introduces no new source of station truth. Every function here reads
 * `floorSim.ts`'s already-derived members and `management.ts`'s already-derived
 * condition/cost/manager values and reshapes them into one read model per
 * tapped station; it recomputes no queue geometry, no condition arithmetic, no
 * repair pricing and no manager capability of its own.
 *
 * WHO CALLS THIS. `FloorGrid.tsx`'s new tap-to-select interaction — the file
 * that already owns the floor's live sim and drag state is the file that owns
 * which station, if any, is selected, the same way it already owns the
 * in-flight drag and the overlap-refusal flash as component-local, purely
 * presentational state. Nothing here is a `GymViewState` field or a
 * `GymViewAction` arm: selection carries no economic meaning, so it does not
 * go through the reducer, the same way `FloorGrid.tsx`'s existing drag state
 * does not.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO.
 *   - It does not decide whether a repair would succeed. `repairEquipment` in
 *     `management.ts` is the one authoritative answer to that (it already
 *     encodes the real refusal order: not-owned, already-sound, not-enough-
 *     gym-bucks) and it is pure — calling it to READ `.kind`/`.reason` has no
 *     side effect, so `FloorGrid.tsx` calls it directly for that question
 *     rather than this module re-deriving the same three-way branch a second
 *     time.
 *   - It does not recompute a station's queue ORDER (`floorSim.ts`'s own
 *     `claimantsOf` is the ordering; it is not exported and this module does
 *     not need it). `stationOperationView` below counts the same two states
 *     `floorSim.ts`'s own header defines the queue by ("everyone whose target
 *     is that station and whose state is `seeking` or `queuing`") — a filter
 *     and a count, not a re-implementation of the fairness ordering.
 */

import { EMPIRE_TUNING } from './empireTuning';
import { type FloorSimMember, type FloorStationRef } from './floorSim';
import {
  type ManagedEquipmentItem,
  type ManagedGym,
  type ManagerTier,
  itemCondition,
  managerAutoRepairCondition,
  repairCostGymBucks,
} from './management';
import { type MemberType } from './members';
import { type SessionActivityGroup, sessionEquipmentGroup } from './sessions';

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** A tapped station's identity: which vocabulary it is drawn from, and (for a session item) which §5.4 activity group it belongs to. */
export interface StationIdentityView {
  readonly kind: FloorStationRef['kind'];
  readonly item: ManagedEquipmentItem;
  /** Null for `kind: 'fixed'` — the Barbell-baseline furniture carries no session activity group. */
  readonly sessionGroup: SessionActivityGroup | null;
}

/** `ref`'s identity, read straight off `sessions.ts`'s own group table for a session item. */
export function stationIdentityView(ref: FloorStationRef): StationIdentityView {
  if (ref.kind === 'session') {
    return Object.freeze({
      kind: ref.kind,
      item: ref.item,
      sessionGroup: sessionEquipmentGroup(ref.item),
    });
  }
  return Object.freeze({ kind: ref.kind, item: ref.item, sessionGroup: null });
}

// ---------------------------------------------------------------------------
// Live operation
// ---------------------------------------------------------------------------

/** What the floor sim reports about one station, right now: is it in use, by whom, and how many members are still waiting on it. */
export interface StationOperationView {
  readonly occupied: boolean;
  /** The type of the member currently using this station, or null while idle. */
  readonly activeMemberType: MemberType | null;
  /**
   * Everyone whose target is this station and whose state is `seeking` or
   * `queuing` — `floorSim.ts`'s own header names this pair of states as the
   * queue ("A station's queue is recomputed every tick from the members
   * themselves: everyone whose target is that station and whose state is
   * `seeking` or `queuing`"). Includes the member who will be served next,
   * the same way that header's own ordering does.
   */
  readonly queueCount: number;
}

/** Whether `member` is currently targeting `ref` — the same `kind`+`item` equality `floorSim.ts`'s own (unexported) `refsEqual` uses. */
function targetsStation(member: FloorSimMember, ref: FloorStationRef): boolean {
  const target = member.target;
  if (target === null) return false;
  return target.kind === ref.kind && target.item === ref.item;
}

/** `ref`'s live operation, read straight off the sim's own member list — no queue geometry, no ordering, a filter and a count. */
export function stationOperationView(
  members: readonly FloorSimMember[],
  ref: FloorStationRef,
): StationOperationView {
  let occupied = false;
  let activeMemberType: MemberType | null = null;
  let queueCount = 0;
  for (const member of members) {
    if (!targetsStation(member, ref)) continue;
    if (member.state === 'using') {
      occupied = true;
      activeMemberType = member.type;
    } else if (member.state === 'seeking' || member.state === 'queuing') {
      queueCount += 1;
    }
  }
  return Object.freeze({ occupied, activeMemberType, queueCount });
}

// ---------------------------------------------------------------------------
// Condition — display rounding only. `itemCondition`/`repairCostGymBucks`
// themselves are `management.ts`'s, called and never re-derived.
// ---------------------------------------------------------------------------

/**
 * Whether `condition` is at or above the worn-line threshold `GymScreen.tsx`'s
 * own `gymscreen-worn` line already prints — the same predicate S4f's
 * per-item repair row gates on (`GymScreen.tsx`'s own `isSoundCondition`).
 * Re-derived here rather than imported: `GymScreen.tsx` exports no helper
 * functions (its whole surface is the `GymScreen` component), and
 * `GymScreen.test.ts` already independently re-derives this same predicate
 * for the identical reason — comparing a screen's displayed number against
 * the registered tuning constant, not against another component's internals.
 */
export function isSoundCondition(condition: number): boolean {
  return condition >= EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION;
}

/**
 * A repair cost as shown in running text, rounded down to 0 once the item's
 * own condition clears the worn-line threshold — so the panel's "repairing it
 * costs X" line never contradicts an "as new" reading drawn beside it.
 * `repairCostGymBucks` itself is untouched; only the displayed rounding
 * happens here, the same S4f discipline `GymScreen.tsx`'s own
 * `displayRepairCostBySoundness` uses.
 */
export function displayRepairCostBySoundness(costGymBucks: number, condition: number): number {
  return isSoundCondition(condition) ? 0 : costGymBucks;
}

/** One item's condition, as the station panel reads it: the real condition, the real repair cost, and the display-rounded cost beside it. */
export interface StationConditionView {
  readonly condition: number;
  readonly repairCostGymBucks: number;
  readonly displayRepairCostGymBucks: number;
  readonly isSound: boolean;
}

/** `item`'s condition view in `managed` — two calls into `management.ts`, reshaped for the panel. */
export function stationConditionView(
  managed: ManagedGym,
  item: ManagedEquipmentItem,
): StationConditionView {
  const condition = itemCondition(managed, item);
  const cost = repairCostGymBucks(managed, item);
  return Object.freeze({
    condition,
    repairCostGymBucks: cost,
    displayRepairCostGymBucks: displayRepairCostBySoundness(cost, condition),
    isSound: isSoundCondition(condition),
  });
}

// ---------------------------------------------------------------------------
// Staff relationship
// ---------------------------------------------------------------------------

/** Whether, and how, the currently hired manager (if any) affects this one item. */
export interface StationManagerEffectView {
  readonly hired: boolean;
  readonly tier: ManagerTier | null;
  /** The hired manager's auto-repair condition threshold, or null when nobody is hired. */
  readonly autoRepairCondition: number | null;
  /**
   * Whether the hired manager's threshold covers this item AT ITS CURRENT
   * CONDITION — false whenever nobody is hired, and false for the `novice`
   * tier's registered 0 threshold at every reachable condition, per Stage B's
   * own measurement (CLAUDE.md: "the cheapest manager tier currently has an
   * auto-repair threshold of 0. It therefore does not autonomously repair
   * equipment under the shipped mechanic"). This reads that fact off
   * `managerAutoRepairCondition` rather than asserting it, so a later tuning
   * change moves this automatically.
   */
  readonly wouldAutoRepairNow: boolean;
}

/** `managed.manager`'s real effect on `item`, read off `management.ts`'s own tier/threshold functions. */
export function stationManagerEffectView(
  managed: ManagedGym,
  item: ManagedEquipmentItem,
): StationManagerEffectView {
  if (managed.manager === null) {
    return Object.freeze({
      hired: false,
      tier: null,
      autoRepairCondition: null,
      wouldAutoRepairNow: false,
    });
  }
  const tier = managed.manager.tier;
  const threshold = managerAutoRepairCondition(tier);
  const condition = itemCondition(managed, item);
  return Object.freeze({
    hired: true,
    tier,
    autoRepairCondition: threshold,
    wouldAutoRepairNow: condition < threshold,
  });
}
