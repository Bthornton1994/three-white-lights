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
import { type FloorSimMember, type FloorSimMemberState, type FloorStationRef } from './floorSim';
import {
  type ManagedEquipmentItem,
  type ManagedGym,
  type ManagerTier,
  failurePhase,
  itemCondition,
  managerAutoRepairCondition,
  ownedItemsOf,
  repairCostGymBucks,
} from './management';
import { type MemberType } from './members';
import { type LadderEquipmentItem } from './ladder';
import { type SessionActivityGroup, type SessionEquipmentItem, sessionEquipmentGroup } from './sessions';
import { type StationUpgradeAxis, type StationUpgradeRefuseReason } from './stationCapability';

/**
 * Player-facing names for shop/staff copy. Domain tokens stay the identifiers
 * tests and reducers use; this map is presentation only.
 */
const EQUIPMENT_PLAYER_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'competition-bench-bay': 'Competition bench bay',
  'power-bar': 'Power bar',
  'comp-plates': 'Competition plates',
  'flat-bench': 'Flat bench',
  'squat-rack': 'Squat rack',
  bike: 'Bike',
  treadmill: 'Treadmill',
  rower: 'Rower',
  sled: 'Sled',
  dumbbells: 'Dumbbells',
  cables: 'Cables',
  machines: 'Machines',
  mats: 'Mats',
  'foam-rollers': 'Foam rollers',
  sauna: 'Sauna',
  'wrist-wraps': 'Wrist wraps',
  belts: 'Belts',
  sleeves: 'Sleeves',
  'specialty-bars': 'Specialty bars',
});

const ACTIVITY_GROUP_PLAYER_LABELS: Readonly<Record<SessionActivityGroup, string>> = Object.freeze({
  conditioning: 'Conditioning',
  accessory: 'Accessory',
  recovery: 'Recovery',
  support: 'Support',
});

/** Concise player-facing name for a ladder or session equipment token. */
export function playerFacingEquipmentLabel(
  item: LadderEquipmentItem | SessionEquipmentItem | string,
): string {
  return EQUIPMENT_PLAYER_LABELS[item] ?? item;
}

/** Player-facing name for a §5.4 session activity group. */
export function playerFacingActivityGroupLabel(group: SessionActivityGroup): string {
  return ACTIVITY_GROUP_PLAYER_LABELS[group];
}

/** Whole-percent display of a 0–1 condition. Does not change the stored value. */
export function displayConditionPercent(condition: number): number {
  return Math.round(condition * EMPIRE_TUNING.CONDITION_PERCENT_SCALE);
}

/** Concise player-facing manager capability. Novice's 0 threshold means none. */
export function playerFacingManagerCapability(tier: ManagerTier): string {
  const threshold = managerAutoRepairCondition(tier);
  if (threshold <= 0) return 'no auto-repair';
  return `auto-repair below ${displayConditionPercent(threshold)}%`;
}

const MEMBER_TYPE_PLAYER_LABELS: Readonly<Record<MemberType, string>> = Object.freeze({
  casual: 'Casual',
  bodybuilder: 'Bodybuilder',
  powerlifter: 'Powerlifter',
  athlete: 'Athlete',
  'serious-lifter': 'Serious lifter',
});

/** Player-facing member type. Domain tokens stay the identifiers. */
export function playerFacingMemberTypeLabel(type: MemberType): string {
  return MEMBER_TYPE_PLAYER_LABELS[type];
}

/** One-line activity for the member card. No names, tenure, or stats. */
export function playerFacingMemberActivityLine(
  state: FloorSimMemberState,
  targetItem: string | null,
): string {
  if (state === 'using' && targetItem !== null) {
    return `Training on ${playerFacingEquipmentLabel(targetItem)}`;
  }
  if ((state === 'seeking' || state === 'queuing') && targetItem !== null) {
    return `Waiting for ${playerFacingEquipmentLabel(targetItem)}`;
  }
  if (state === 'leaving') return 'Leaving';
  if (state === 'interrupted') return 'Interrupted';
  return 'Walking';
}

/** Player-facing placement refusal. Underlying legality is unchanged. */
export type PlacementRefuseKind = 'occupied' | 'doesnt-fit' | 'outside';

export function playerFacingPlacementRefuse(kind: PlacementRefuseKind): string {
  if (kind === 'occupied') return 'Space occupied';
  if (kind === 'doesnt-fit') return `Doesn't fit here`;
  return 'Outside the gym';
}

/** Player-facing name of a Stage D.1 upgrade. Numbers stay in the cost line. Attached to the bay, not to a SKU. */
export function playerFacingUpgradeLabel(axis: StationUpgradeAxis): string {
  if (axis === 'quality') return 'Competition pads';
  if (axis === 'capacity') return 'Second bench';
  return 'Plate tree';
}

/** Why this upgrade exists, as a player reads it on the station — not an income multiplier. */
export function playerFacingUpgradeEffect(axis: StationUpgradeAxis): string {
  if (axis === 'quality') return 'better training experience';
  if (axis === 'capacity') return 'two can train at once';
  return 'faster plate changes';
}

/** Player-facing upgrade refusal. Domain tokens stay the identifiers. */
export function playerFacingUpgradeRefuse(reason: StationUpgradeRefuseReason): string {
  if (reason === 'not-upgradable') return 'Can\'t upgrade this';
  if (reason === 'already-upgraded') return 'Already fitted';
  if (reason === 'not-placed') return 'Place the bay first';
  if (reason === 'no-second-position') return 'No room for a second bench';
  return 'Not enough gym bucks';
}

/** How a piece of equipment relates to the Competition Bench Bay. */
export function playerFacingBayRole(
  complete: boolean,
  missing: readonly string[],
): string {
  if (complete) return 'Part of Competition bench bay';
  if (missing.length === 0) return 'Part of Competition bench bay';
  const labels: string[] = [];
  for (const item of missing) {
    labels.push(playerFacingEquipmentLabel(item));
  }
  return `Needs ${labels.join(', ')} for a Competition bench bay`;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** A tapped station's identity: which vocabulary it is drawn from, and (for a session item) which §5.4 activity group it belongs to. */
export interface StationIdentityView {
  readonly kind: FloorStationRef['kind'];
  readonly item: string;
  /** Null for `kind: 'fixed'` and `kind: 'training'` — those carry no session activity group. */
  readonly sessionGroup: SessionActivityGroup | null;
}

/** `ref`'s identity, read straight off `sessions.ts`'s own group table for a session item. */
export function stationIdentityView(ref: FloorStationRef): StationIdentityView {
  if (ref.kind === 'training') {
    return Object.freeze({ kind: ref.kind, item: ref.station, sessionGroup: null });
  }
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
  readonly occupantCount: number;
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

/** Whether `member` is currently targeting `ref` — the same kind+identity equality `floorSim.ts`'s own (unexported) `refsEqual` uses. */
function targetsStation(member: FloorSimMember, ref: FloorStationRef): boolean {
  const target = member.target;
  if (target === null) return false;
  if (target.kind !== ref.kind) return false;
  if (target.kind === 'training' && ref.kind === 'training') {
    return target.station === ref.station;
  }
  if (target.kind === 'training' || ref.kind === 'training') return false;
  return target.item === ref.item;
}

/** `ref`'s live operation, read straight off the sim's own member list — no queue geometry, no ordering, a filter and a count.
 * Optional `seats` is the current station's `useCells` (D2-UI-DEBT-01): a
 * using member counts only when their cell is one of those seats, unique per
 * seat, so the panel and the floor light the same snapshot. Omitted `seats`
 * keeps the prior using-state count. Do not change Capacity slot algebra. */
export function stationOperationView(
  members: readonly FloorSimMember[],
  ref: FloorStationRef,
  seats?: readonly { readonly x: number; readonly y: number }[],
): StationOperationView {
  const restrict = seats !== undefined;
  const seatKeys = new Set<string>();
  if (restrict) {
    for (const seat of seats) {
      seatKeys.add(`${seat.x},${seat.y}`);
    }
  }
  const occupiedSeats = new Set<string>();
  let occupied = false;
  let occupantCount = 0;
  let activeMemberType: MemberType | null = null;
  let queueCount = 0;
  for (const member of members) {
    if (!targetsStation(member, ref)) continue;
    if (member.state === 'using') {
      if (restrict) {
        const key = `${member.cell.x},${member.cell.y}`;
        if (!seatKeys.has(key)) continue;
        if (occupiedSeats.has(key)) continue;
        occupiedSeats.add(key);
      }
      occupied = true;
      occupantCount += 1;
      if (activeMemberType === null) activeMemberType = member.type;
    } else if (member.state === 'seeking' || member.state === 'queuing') {
      queueCount += 1;
    }
  }
  return Object.freeze({ occupied, occupantCount, activeMemberType, queueCount });
}

/**
 * Player-facing operation line. Occupied wins over loading so two bodies
 * training still read as training. An empty seat with remaining changeover
 * is "Loading plates" — the D2.1B Throughput sentence — not Idle. Waiting
 * is a clause, never the head.
 */
export function playerFacingStationOperation(
  view: StationOperationView,
  loadingSeats: number,
): string {
  let head: string;
  if (view.occupied && view.activeMemberType !== null) {
    head =
      view.occupantCount > 1
        ? `${view.occupantCount} training`
        : `In use by ${playerFacingMemberTypeLabel(view.activeMemberType)}`;
  } else if (loadingSeats > 0) {
    head = 'Loading plates';
  } else {
    head = 'Idle';
  }
  if (view.queueCount > 0) return `${head}, ${view.queueCount} waiting`;
  return head;
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

/**
 * Whether `condition` is below `RECOVERY_CONDITION_MIN` — the identical
 * per-item test `management.ts`'s `recoveryRepairCostGymBucks` already runs
 * inside its own summing loop, exposed here at the single-item level rather
 * than only as that function's gym-wide total. No new arithmetic: the
 * comparison is byte-for-byte the one `recoveryRepairCostGymBucks` performs.
 *
 * WHY THIS IS A SEPARATE QUESTION FROM `isSoundCondition`, STATED BECAUSE
 * STAGE C.1 SHIPPED A PANEL THAT ANSWERED ONLY ONE OF THEM. Routine
 * maintenance (`isSoundCondition`, gated on `MAINTENANCE_PROMPT_CONDITION`,
 * 0.5) and recovery eligibility (this function, gated on
 * `RECOVERY_CONDITION_MIN`, 0.8) are two thresholds over the same condition
 * axis with a real design gap between them — an item can sit at, say, 0.65:
 * above the routine line, below the recovery line. Routing both questions
 * through one boolean made that item's own panel say "as new" while the
 * gym-level recovery surface, reading the true condition, refused to reopen
 * over it. Neither threshold moved to fix this; the panel now asks both
 * questions instead of one.
 */
export function isRecoveryBlocking(condition: number): boolean {
  return condition < EMPIRE_TUNING.RECOVERY_CONDITION_MIN;
}

/**
 * Every item `managed` owns that is currently below `RECOVERY_CONDITION_MIN`
 * — `management.ts`'s own `wornItems` shape (a filter over `ownedItemsOf` at
 * a condition threshold), read at the recovery threshold instead of the
 * maintenance one, so a dormant gym has a pointer to WHICH stations are
 * blocking reopening rather than only the aggregate cost
 * `recoveryRepairCostGymBucks` already quotes. `ownedItemsOf`/`itemCondition`
 * are `management.ts`'s; nothing here recomputes what either already answers.
 */
export function recoveryBlockingItems(managed: ManagedGym): readonly ManagedEquipmentItem[] {
  return Object.freeze(
    ownedItemsOf(managed.gym).filter((item) => isRecoveryBlocking(itemCondition(managed, item))),
  );
}

/** One item's condition, as the station panel reads it: the real condition, the real repair cost, and the display-rounded cost beside it. */
export interface StationConditionView {
  readonly condition: number;
  readonly repairCostGymBucks: number;
  readonly displayRepairCostGymBucks: number;
  readonly isSound: boolean;
  /** Whether the gym is currently dormant (`failurePhase(managed) === 'failed'`) — read here so the panel can ask the recovery question only when it is live. */
  readonly dormant: boolean;
  /**
   * Whether THIS item, at its current condition, is one of the things
   * keeping a dormant gym from reopening — `dormant && isRecoveryBlocking
   * (condition)`. False for every item while the gym is not dormant, which
   * is what keeps every existing routine-maintenance reading (`isSound`,
   * `displayRepairCostGymBucks`) byte-identical outside dormancy: this field
   * is additive, not a replacement for either.
   */
  readonly blocksRecovery: boolean;
}

/** `item`'s condition view in `managed` — reshaped for the panel from calls already answered elsewhere in this module and in `management.ts`. */
export function stationConditionView(
  managed: ManagedGym,
  item: ManagedEquipmentItem,
): StationConditionView {
  const condition = itemCondition(managed, item);
  const cost = repairCostGymBucks(managed, item);
  const dormant = failurePhase(managed) === 'failed';
  return Object.freeze({
    condition,
    repairCostGymBucks: cost,
    displayRepairCostGymBucks: displayRepairCostBySoundness(cost, condition),
    isSound: isSoundCondition(condition),
    dormant,
    blocksRecovery: dormant && isRecoveryBlocking(condition),
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

/**
 * How far through a plate-changeover the seat is, in [0, 1], across the
 * discrete ticks the loading layer actually draws.
 *
 * The layer renders only while remaining > 0, so mapping
 * `(total - remaining) / total` never reached 1: the last visible stock
 * frame was 17/18 and the last visible tree frame was 5/6, which left the
 * last sequential disc short of the sleeve. Visible remaining=total..1
 * therefore maps onto 0..1:
 *
 *   remaining = total → 0 (just armed, discs on the stack)
 *   remaining = 1     → 1 (last drawn frame, discs on the sleeve)
 *
 * Stock (18) and plate-tree (6) share this path; only the number of
 * visible frames differs. Remaining 0 is not a loading beat. Total <= 1
 * cannot span both endpoints; the one visible frame sits at the sleeve
 * rather than dividing by zero.
 */
export function plateLoadingProgress(remainingTicks: number, totalTicks: number): number {
  if (!(totalTicks > 0) || remainingTicks <= 0) return 0;
  const remaining = remainingTicks > totalTicks ? totalTicks : remainingTicks;
  if (totalTicks <= 1) return 1;
  return (totalTicks - remaining) / (totalTicks - 1);
}

/** One plate disc inside a bench footprint, fractions in [0, 1]. */
export interface PlateLoadingDisc {
  readonly index: number;
  readonly xFraction: number;
  readonly yFraction: number;
}

/**
 * Disc positions for one changeover. Same path at every duration; only
 * `progress` (from remaining/total ticks) moves the discs. Geometry comes
 * from `FLOOR_PLATE_LOADING`.
 */
export function plateLoadingDiscs(progress: number): readonly PlateLoadingDisc[] {
  const layout = EMPIRE_TUNING.FLOOR_PLATE_LOADING;
  const count = layout.discCount;
  const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const discs: PlateLoadingDisc[] = [];
  for (let index = 0; index < count; index += 1) {
    const start = index / count;
    const end = (index + 1) / count;
    const local =
      clamped <= start ? 0 : clamped >= end ? 1 : (clamped - start) / (end - start);
    const stack = (index - (count - 1) / 2) * layout.stackSpreadFraction;
    const x =
      layout.sourceXFraction + (layout.sleeveXFraction - layout.sourceXFraction) * local;
    const y = layout.railYFraction + stack;
    discs.push(Object.freeze({ index, xFraction: x, yFraction: y }));
  }
  return Object.freeze(discs);
}
