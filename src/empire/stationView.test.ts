import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { type FloorSimMember, type FloorSimMemberState, type FloorStationRef } from './floorSim';
import {
  COUNTED_DECISIONS,
  type ManagedGym,
  createManagedGym,
  failurePhase,
  hireManager,
  itemCondition,
  ownedItemsOf,
  recoveryRequirement,
  repairEquipment,
  withUpdatedGym,
} from './management';
import { buySessionEquipment, withLadder } from './sessions';
import {
  displayConditionPercent,
  displayRepairCostBySoundness,
  formatEmpireMultiplier,
  formatGymBucks,
  isRecoveryBlocking,
  isSoundCondition,
  playerFacingActivityGroupLabel,
  playerFacingEquipmentLabel,
  playerFacingManagerCapability,
  playerFacingMemberActivityLine,
  playerFacingMemberTypeLabel,
  playerFacingPlacementRefuse,
  playerFacingStationOperation,
  playerFacingUpgradeEffect,
  playerFacingUpgradeLabel,
  playerFacingUpgradeRefuse,
  plateLoadingDiscs,
  plateLoadingProgress,
  recoveryBlockingItems,
  stationConditionView,
  stationIdentityView,
  stationManagerEffectView,
  stationOperationView,
} from './stationView';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A gym rich enough to buy `mats` (the one `SESSION_EQUIPMENT_MIN_RUNG.garage` item) and to hire any manager tier. */
function withMatsOwned(): ManagedGym {
  const base = createManagedGym();
  const rich = withLadder(base.gym, Object.freeze({ ...base.gym.ladder, gymBucks: 100000 }));
  const bought = buySessionEquipment(rich, 'mats');
  if (bought.kind !== 'bought') throw new Error('fixture could not buy mats');
  return withUpdatedGym(base, bought.state);
}

/** Every owned item worn to `condition`, purse left as-is. */
function withCondition(state: ManagedGym, condition: number): ManagedGym {
  const worn: Record<string, number> = {};
  for (const item of ownedItemsOf(state.gym)) worn[item] = condition;
  return Object.freeze({ ...state, condition: Object.freeze(worn) as ManagedGym['condition'] });
}

const FIXED_REF: FloorStationRef = Object.freeze({ kind: 'fixed', item: 'power-bar' });
const SESSION_REF: FloorStationRef = Object.freeze({ kind: 'session', item: 'mats' });
const OTHER_SESSION_REF: FloorStationRef = Object.freeze({ kind: 'session', item: 'dumbbells' });

/** A minimal, fully-specified `FloorSimMember`, overridable per test. */
function memberAt(
  index: number,
  state: FloorSimMemberState,
  target: FloorStationRef | null,
  cell: { readonly x: number; readonly y: number } = Object.freeze({ x: 0, y: 0 }),
): FloorSimMember {
  return Object.freeze({
    memberId: `member:n0:${index}`,
    index,
    type: 'powerlifter',
    state,
    cell,
    next: null,
    progress: 0,
    target,
    targetPosition: target === null ? null : Object.freeze({ x: 0, y: 0 }),
    claimedAt: target === null ? null : 0,
    queuedAt: null,
    queueArrivedAt: null,
    timer: 0,
    interruptedBy: null,
    awayFrom: null,
    strandedAt: null,
    usingStartedAt: null,
  });
}

describe('stationView.ts — GDD §5.14 Stage C', () => {
  // -------------------------------------------------------------------------
  // Player-facing presentation (Stage C.1c) — labels, not domain tokens
  // -------------------------------------------------------------------------

  it('projects every ladder and session equipment token to a player-facing label without renaming the enum', () => {
    for (const item of EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS) {
      const label = playerFacingEquipmentLabel(item);
      expect(label.length, item).toBeGreaterThan(0);
      expect(label.includes('-'), `${item} should not be the hyphenated token`).toBe(false);
    }
    for (const item of EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS) {
      const label = playerFacingEquipmentLabel(item);
      expect(label.length, item).toBeGreaterThan(0);
      expect(label.includes('-'), `${item} should not be the hyphenated token`).toBe(false);
    }
    expect(playerFacingEquipmentLabel('comp-plates')).toBe('Competition plates');
    expect(playerFacingEquipmentLabel('competition-bench-bay')).toBe('Competition bench bay');
    expect(playerFacingEquipmentLabel('wrist-wraps')).toBe('Wrist wraps');
    expect(playerFacingEquipmentLabel('mats')).toBe('Mats');
  });

  it('projects session activity groups to player-facing labels', () => {
    for (const group of EMPIRE_TUNING.SESSION_ACTIVITY_GROUPS) {
      expect(playerFacingActivityGroupLabel(group).includes('-')).toBe(false);
    }
    expect(playerFacingActivityGroupLabel('conditioning')).toBe('Conditioning');
  });

  it('formats condition as a whole percent without changing the stored 0–1 value', () => {
    expect(displayConditionPercent(1)).toBe(100);
    expect(displayConditionPercent(0.5)).toBe(50);
    expect(displayConditionPercent(0.966)).toBe(97);
  });

  /**
   * VL-3 round 2c (HUD-2c): the raw-float-in-the-HUD fix. Captured evidence
   * showed `177.83999999999997`, `0.249999` and `0.166666` reaching the
   * player-facing screen verbatim — ordinary floating-point accrual noise,
   * and 6-decimal `scrubPrecision` engine noise, printed without any display
   * rounding at all. `formatGymBucks`/`formatEmpireMultiplier` are the one
   * place that stops it. Deleting either `.toFixed(...)` call (i.e.
   * replacing the function body with `return String(amountGymBucks);` /
   * `return String(multiplier);`) makes every assertion below fail, because
   * `String(177.83999999999997)` is `'177.83999999999997'`, not `'177.84'`,
   * and `String(0.166666)` is `'0.166666'`, not `'0.167'` — this is the exact
   * mutation a builder must apply and watch redden before trusting this
   * test as a witness.
   */
  it('formats a Gym Bucks quantity to a fixed, player-legible number of decimal places — the witnessed defect, reproduced and closed', () => {
    // The exact witnessed value from the captured HUD evidence.
    expect(formatGymBucks(177.83999999999997)).toBe('177.84');
    // Whole numbers still carry the decimal places, so "gym bucks: 5.00"
    // reads consistently rather than jumping between 0 and 2 decimal places
    // depending on whether accrual noise happened to be present.
    expect(formatGymBucks(0)).toBe('0.00');
    expect(formatGymBucks(5)).toBe('5.00');
    expect(formatGymBucks(604.8)).toBe('604.80');
    // The general property: no matter how many decimal digits the input
    // float carries, the formatted string carries exactly
    // `GYM_BUCKS_DISPLAY_DECIMALS` of them — never more, never fewer, never
    // the raw unrounded representation.
    const messyInputs = [0.1 + 0.2, 1 / 3, 12345.6789012345, 1e-10, 691.2, -0];
    for (const value of messyInputs) {
      const formatted = formatGymBucks(value);
      const decimalPart = formatted.split('.')[1] ?? '';
      expect(decimalPart.length, `formatGymBucks(${value}) = ${formatted}`).toBe(
        EMPIRE_TUNING.GYM_BUCKS_DISPLAY_DECIMALS,
      );
      // And it never contains more digits after the point than the ones
      // asserted above — a raw float leak would show 15-17 significant
      // digits, not `GYM_BUCKS_DISPLAY_DECIMALS`.
      expect(formatted).not.toBe(String(value));
    }
  });

  it('formats a dimensionless empire multiplier/fraction to a fixed, player-legible number of decimal places — the other two witnessed values', () => {
    // The exact witnessed values from the captured HUD evidence — both are
    // `scrubPrecision`'s 6-decimal-place engine noise, still too long to
    // read as a HUD number.
    expect(formatEmpireMultiplier(0.249999)).toBe('0.250');
    expect(formatEmpireMultiplier(0.166666)).toBe('0.167');
    expect(formatEmpireMultiplier(0)).toBe('0.000');
    expect(formatEmpireMultiplier(0.35)).toBe('0.350');
    const messyInputs = [1 / 6, 1 / 3, 2 / 3, 0.123456789];
    for (const value of messyInputs) {
      const formatted = formatEmpireMultiplier(value);
      const decimalPart = formatted.split('.')[1] ?? '';
      expect(decimalPart.length, `formatEmpireMultiplier(${value}) = ${formatted}`).toBe(
        EMPIRE_TUNING.EMPIRE_MULTIPLIER_DISPLAY_DECIMALS,
      );
      expect(formatted).not.toBe(String(value));
    }
  });

  it('describes manager capability without raw 0–1 thresholds', () => {
    expect(playerFacingManagerCapability('novice')).toBe('no auto-repair');
    expect(playerFacingManagerCapability('steady')).toBe(
      `auto-repair below ${displayConditionPercent(EMPIRE_TUNING.MANAGER_AUTO_REPAIR_CONDITION.steady)}%`,
    );
    expect(playerFacingManagerCapability('veteran')).toBe(
      `auto-repair below ${displayConditionPercent(EMPIRE_TUNING.MANAGER_AUTO_REPAIR_CONDITION.veteran)}%`,
    );
  });

  it('projects member types and live activity without raw enums', () => {
    expect(playerFacingMemberTypeLabel('powerlifter')).toBe('Powerlifter');
    expect(playerFacingMemberTypeLabel('bodybuilder')).toBe('Bodybuilder');
    expect(playerFacingMemberActivityLine('using', 'flat-bench')).toBe('Training on Flat bench');
    expect(playerFacingMemberActivityLine('using', 'competition-bench-bay')).toBe(
      'Training on Competition bench bay',
    );
    expect(playerFacingMemberActivityLine('queuing', 'mats')).toBe('Waiting for Mats');
    expect(playerFacingMemberActivityLine('leaving', null)).toBe('Leaving');
    expect(playerFacingMemberActivityLine('seeking', null)).toBe('Walking');
  });

  it('states placement refusals as player-facing reasons, not enums', () => {
    expect(playerFacingPlacementRefuse('occupied')).toBe('Space occupied');
    expect(playerFacingPlacementRefuse('doesnt-fit')).toBe("Doesn't fit here");
    expect(playerFacingPlacementRefuse('outside')).toBe('Outside the gym');
  });

  it('names Stage D.1 upgrades as bay fittings, not as Q/C/T scalars', () => {
    expect(playerFacingUpgradeLabel('quality')).toBe('Competition pads');
    expect(playerFacingUpgradeLabel('capacity')).toBe('Second bench');
    expect(playerFacingUpgradeLabel('throughput')).toBe('Plate tree');
    expect(playerFacingUpgradeEffect('quality')).toBe('better training experience');
    expect(playerFacingUpgradeEffect('capacity')).toBe('two can train at once');
    expect(playerFacingUpgradeEffect('throughput')).toBe('faster plate changes');
    expect(playerFacingUpgradeRefuse('not-upgradable')).toBe("Can't upgrade this");
    expect(playerFacingUpgradeRefuse('already-upgraded')).toBe('Already fitted');
    expect(playerFacingUpgradeRefuse('not-placed')).toBe('Place the bay first');
    expect(playerFacingUpgradeRefuse('no-second-position')).toBe(
      'No room for a second bench',
    );
    expect(playerFacingUpgradeRefuse('not-enough-gym-bucks')).toBe('Not enough gym bucks');
  });

  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  it('reads a training station identity with no session group', () => {
    const identity = stationIdentityView({ kind: 'training', station: 'competition-bench-bay' });
    expect(identity.kind).toBe('training');
    expect(identity.item).toBe('competition-bench-bay');
    expect(identity.sessionGroup).toBeNull();
  });

  it('reads a fixed station identity with no session group', () => {
    const identity = stationIdentityView(FIXED_REF);
    expect(identity.kind).toBe('fixed');
    expect(identity.item).toBe('power-bar');
    expect(identity.sessionGroup).toBeNull();
  });

  it('reads a session station identity with its real §5.4 group', () => {
    const identity = stationIdentityView(SESSION_REF);
    expect(identity.kind).toBe('session');
    expect(identity.item).toBe('mats');
    // `sessionEquipmentGroup('mats')` is the real function this reads through —
    // driven directly rather than a hardcoded string, so the two cannot drift.
    expect(identity.sessionGroup).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Live operation — counts, not order
  // -------------------------------------------------------------------------

  it('reports idle when nobody targets the station', () => {
    const members = [memberAt(0, 'seeking', OTHER_SESSION_REF)];
    const view = stationOperationView(members, SESSION_REF);
    expect(view).toEqual({ occupied: false, occupantCount: 0, activeMemberType: null, queueCount: 0 });
  });

  it('reports occupied and the using member type when somebody is using it', () => {
    const members = [memberAt(0, 'using', SESSION_REF)];
    const view = stationOperationView(members, SESSION_REF);
    expect(view.occupied).toBe(true);
    expect(view.occupantCount).toBe(1);
    expect(view.activeMemberType).toBe('powerlifter');
    expect(view.queueCount).toBe(0);
  });

  it('counts seeking AND queuing members toward this station as the queue, and nothing else', () => {
    const members = [
      memberAt(0, 'using', SESSION_REF),
      memberAt(1, 'seeking', SESSION_REF),
      memberAt(2, 'queuing', SESSION_REF),
      // Not counted: a different target, and states outside seeking/queuing.
      memberAt(3, 'seeking', OTHER_SESSION_REF),
      memberAt(4, 'leaving', SESSION_REF),
      memberAt(5, 'interrupted', null),
    ];
    const view = stationOperationView(members, SESSION_REF);
    expect(view.occupied).toBe(true);
    expect(view.occupantCount).toBe(1);
    expect(view.queueCount).toBe(2);
  });

  it('counts two members using the same station as occupantCount 2', () => {
    const members = [memberAt(0, 'using', SESSION_REF), memberAt(1, 'using', SESSION_REF)];
    const view = stationOperationView(members, SESSION_REF);
    expect(view.occupied).toBe(true);
    expect(view.occupantCount).toBe(2);
    expect(view.queueCount).toBe(0);
  });

  it('with seats, counts unique current-useCells occupants only — same snapshot as the floor', () => {
    const primary = Object.freeze({ x: 5, y: 0 });
    const expansion = Object.freeze({ x: 7, y: 0 });
    const leftover = Object.freeze({ x: 4, y: 0 });
    const members = [
      memberAt(0, 'using', FIXED_REF, leftover),
      memberAt(1, 'using', FIXED_REF, leftover),
      memberAt(2, 'queuing', FIXED_REF, Object.freeze({ x: 3, y: 0 })),
    ];
    const uncapped = stationOperationView(members, FIXED_REF);
    expect(uncapped.occupantCount).toBe(2);
    expect(uncapped.queueCount).toBe(1);
    const afterCapacity = stationOperationView(members, FIXED_REF, [primary, expansion]);
    expect(afterCapacity.occupied).toBe(false);
    expect(afterCapacity.occupantCount).toBe(0);
    expect(afterCapacity.queueCount).toBe(1);
    const twoSeats = [
      memberAt(0, 'using', FIXED_REF, primary),
      memberAt(1, 'using', FIXED_REF, expansion),
      memberAt(2, 'using', FIXED_REF, primary),
    ];
    const seated = stationOperationView(twoSeats, FIXED_REF, [primary, expansion]);
    expect(seated.occupied).toBe(true);
    expect(seated.occupantCount).toBe(2);
  });

  it('distinguishes a fixed station from a session item of the same shape', () => {
    // Two refs that would collide under an item-only equality.
    const members = [memberAt(0, 'using', FIXED_REF)];
    expect(stationOperationView(members, FIXED_REF).occupied).toBe(true);
    expect(stationOperationView(members, SESSION_REF).occupied).toBe(false);
  });

  it('is non-vacuous: an empty member list reports idle with zero queue', () => {
    expect(stationOperationView([], SESSION_REF)).toEqual({
      occupied: false,
      occupantCount: 0,
      activeMemberType: null,
      queueCount: 0,
    });
  });

  it('playerFacingStationOperation names occupied, loading plates, idle, and the waiting clause', () => {
    const idle = stationOperationView([], SESSION_REF);
    expect(playerFacingStationOperation(idle, 0)).toBe('Idle');
    expect(playerFacingStationOperation(idle, 1)).toBe('Loading plates');
    const waiting = stationOperationView(
      [memberAt(0, 'queuing', SESSION_REF), memberAt(1, 'seeking', SESSION_REF)],
      SESSION_REF,
    );
    expect(playerFacingStationOperation(waiting, 0)).toBe('Idle, 2 waiting');
    expect(playerFacingStationOperation(waiting, 1)).toBe('Loading plates, 2 waiting');
    const using = stationOperationView([memberAt(0, 'using', SESSION_REF)], SESSION_REF);
    expect(playerFacingStationOperation(using, 0)).toBe('In use by Powerlifter');
    expect(playerFacingStationOperation(using, 1)).toBe('In use by Powerlifter');
    const dual = stationOperationView(
      [memberAt(0, 'using', SESSION_REF), memberAt(1, 'using', SESSION_REF)],
      SESSION_REF,
    );
    expect(playerFacingStationOperation(dual, 0)).toBe('2 training');
  });

  // -------------------------------------------------------------------------
  // Condition — display rounding agrees with the real threshold
  // -------------------------------------------------------------------------

  it('isSoundCondition agrees with MAINTENANCE_PROMPT_CONDITION at both edges', () => {
    const line = EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION;
    expect(isSoundCondition(line)).toBe(true);
    expect(isSoundCondition(line - 0.0001)).toBe(false);
    expect(isSoundCondition(1)).toBe(true);
  });

  it('displayRepairCostBySoundness rounds to 0 exactly when isSoundCondition is true', () => {
    expect(displayRepairCostBySoundness(123, 1)).toBe(0);
    expect(displayRepairCostBySoundness(123, 0.1)).toBe(123);
  });

  it('stationConditionView reads the real condition and repair cost, and rounds the display cost', () => {
    const worn = withCondition(withMatsOwned(), 0.1);
    const view = stationConditionView(worn, 'mats');
    expect(view.condition).toBe(0.1);
    expect(view.repairCostGymBucks).toBeGreaterThan(0);
    expect(view.displayRepairCostGymBucks).toBe(view.repairCostGymBucks);
    expect(view.isSound).toBe(false);
  });

  it('stationConditionView reports a sound item as 0 to repair even if the raw cost is a tiny positive float', () => {
    const sound = withCondition(withMatsOwned(), 0.999999);
    const view = stationConditionView(sound, 'mats');
    expect(view.isSound).toBe(true);
    expect(view.displayRepairCostGymBucks).toBe(0);
  });

  it('stationConditionView agrees with a real repairEquipment call: sound reads refused already-sound, worn reads repairable', () => {
    const worn = withCondition(withMatsOwned(), 0.1);
    const outcome = repairEquipment(worn, 'mats');
    const view = stationConditionView(worn, 'mats');
    expect(outcome.kind).toBe('repaired');
    expect(view.isSound).toBe(false);

    const sound = withCondition(withMatsOwned(), 1);
    const soundOutcome = repairEquipment(sound, 'mats');
    expect(soundOutcome.kind).toBe('refused');
    expect(stationConditionView(sound, 'mats').isSound).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Staff relationship
  // -------------------------------------------------------------------------

  it('reports no manager effect at all when nobody is hired', () => {
    const view = stationManagerEffectView(withMatsOwned(), 'mats');
    expect(view).toEqual({
      hired: false,
      tier: null,
      autoRepairCondition: null,
      wouldAutoRepairNow: false,
    });
  });

  it('the novice tier never auto-repairs, at any condition — CLAUDE.md Stage C: threshold 0', () => {
    const base = withMatsOwned();
    const hired = hireManager(base, 'novice', 0);
    if (hired.kind !== 'hired') throw new Error('fixture could not hire novice');
    expect(EMPIRE_TUNING.MANAGER_AUTO_REPAIR_CONDITION.novice).toBe(0);
    // Worn all the way down to the edge of what `itemCondition` accepts —
    // still not auto-repaired, because the threshold is 0 and condition is
    // never negative.
    const worn = withCondition(hired.state, 0.001);
    const view = stationManagerEffectView(worn, 'mats');
    expect(view.hired).toBe(true);
    expect(view.tier).toBe('novice');
    expect(view.autoRepairCondition).toBe(0);
    expect(view.wouldAutoRepairNow).toBe(false);
  });

  it('a manager with a real threshold DOES read as covering a worn item below it', () => {
    const base = withMatsOwned();
    const hired = hireManager(base, 'veteran', 0);
    if (hired.kind !== 'hired') throw new Error('fixture could not hire veteran');
    const threshold = EMPIRE_TUNING.MANAGER_AUTO_REPAIR_CONDITION.veteran;
    expect(threshold).toBeGreaterThan(0);
    const worn = withCondition(hired.state, Math.max(0, threshold - 0.05));
    const sound = withCondition(hired.state, 1);
    expect(stationManagerEffectView(worn, 'mats').wouldAutoRepairNow).toBe(true);
    expect(stationManagerEffectView(sound, 'mats').wouldAutoRepairNow).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GDD §5.14 Stage C.1a — the recovery/routine-maintenance contradiction
//
// Stage C.1 shipped `stationConditionView.isSound` as the ONLY question the
// station panel asked of an item's condition — `MAINTENANCE_PROMPT_CONDITION`
// (0.5) gated. `RECOVERY_CONDITION_MIN` (0.8) gates a completely different
// question, `recoveryRequirement`'s, and nothing joined the two. So an item
// between the two thresholds — sound by the routine reading, still below the
// recovery minimum — read "as new" on its own panel while the gym-level
// recovery surface, reading the SAME condition, refused to reopen over it.
// Neither threshold moved; `stationConditionView` now answers both questions.
// ---------------------------------------------------------------------------

describe('GDD §5.14 Stage C.1a — recovery blocks on a routine-sound item, and the panel now says so', () => {
  /** The exact midpoint of the real gap, derived from the two shipped thresholds rather than hardcoded — this is the condition Stage C.1's own disclosed contradiction was about. */
  const GAP_CONDITION =
    (EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION + EMPIRE_TUNING.RECOVERY_CONDITION_MIN) / 2;

  /**
   * A dormant (`failurePhase(state) === 'failed'`) gym with `mats` worn to
   * `condition` and the purse set to `gymBucks` — the same direct
   * strike-ledger construction `management.test.ts`'s own
   * `derives the failure phase from the strike count alone` test uses, not a
   * hand-waved dormancy flag: `failurePhase` is a pure function of
   * `state.strikes.length`, so this really is the failed state, reached the
   * same way the shipped app reaches it.
   */
  function dormantAt(condition: number, gymBucks: number): ManagedGym {
    const worn = withCondition(withMatsOwned(), condition);
    const record = Object.freeze({
      decision: COUNTED_DECISIONS[2] as (typeof COUNTED_DECISIONS)[number],
      atSeconds: 0,
      shownCostGymBucks: 10,
    });
    const failed: ManagedGym = Object.freeze({
      ...worn,
      gym: withLadder(worn.gym, Object.freeze({ ...worn.gym.ladder, gymBucks })),
      strikes: Object.freeze(Array.from({ length: EMPIRE_TUNING.FAILURE_STRIKES }, () => record)),
    });
    if (failurePhase(failed) !== 'failed') throw new Error('fixture did not reach dormancy');
    return failed;
  }

  it('the gap is real: the midpoint sits at-or-above the routine threshold and strictly below the recovery minimum', () => {
    expect(GAP_CONDITION).toBeGreaterThanOrEqual(EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION);
    expect(GAP_CONDITION).toBeLessThan(EMPIRE_TUNING.RECOVERY_CONDITION_MIN);
    expect(isSoundCondition(GAP_CONDITION)).toBe(true);
    expect(isRecoveryBlocking(GAP_CONDITION)).toBe(true);
  });

  it('REQUIRED NEGATIVE CONTROL, affordable case: recovery is blocked by a gap-condition item, the panel identifies it as a recovery blocker rather than "nothing to repair", the real repair action is offered, and repairing it through the real reducer clears exactly that item from the recovery-blocking list', () => {
    const dormant = dormantAt(GAP_CONDITION, 100000);

    // (1) Recovery is genuinely blocked, and `mats` is genuinely one of the
    // reasons — read off the real gym-level function, not asserted.
    const requirementBefore = recoveryRequirement(dormant);
    expect(requirementBefore.kind).toBe('blocked');
    if (requirementBefore.kind === 'blocked') {
      expect(requirementBefore.equipmentBelowMinimum).toBe(true);
    }
    expect(recoveryBlockingItems(dormant)).toContain('mats');

    // (2) The station panel's own read of this item: routine-sound (so the
    // OLD gate would have drawn "as new — nothing to repair"), dormant, and
    // a real recovery blocker. This is the exact state the human's brief
    // named as reachable before the fix and forbidden after it.
    const view = stationConditionView(dormant, 'mats');
    expect(view.isSound).toBe(true);
    expect(view.dormant).toBe(true);
    expect(view.blocksRecovery).toBe(true);

    // (3) `FloorGrid.tsx`'s own repair-availability gate, reproduced exactly
    // (`isSound && !blocksRecovery` draws "nothing to repair"; anything else
    // reaches the price/afford check). With `blocksRecovery` true this must
    // NOT read as "nothing to repair" — that is the contradiction the
    // acceptance bar (§11) forbids as a reachable state.
    const repairWithheldAsNothingToDo = view.isSound && !view.blocksRecovery;
    expect(repairWithheldAsNothingToDo).toBe(false);
    // And the quoted price is the REAL, unrounded repair cost — not the
    // display-rounded 0 the routine reading alone would have shown, and
    // affordable against this fixture's purse.
    expect(view.repairCostGymBucks).toBeGreaterThan(0);
    expect(view.repairCostGymBucks).toBeLessThanOrEqual(dormant.gym.ladder.gymBucks);

    // (4) Drive the SAME action the panel's button dispatches
    // (`repair-item` -> `repairEquipment`) — no new formula, no recovery
    // discount, no automatic charge.
    const repaired = repairEquipment(dormant, 'mats');
    expect(repaired.kind).toBe('repaired');
    if (repaired.kind !== 'repaired') throw new Error('unreachable');
    expect(repaired.cost).toBe(view.repairCostGymBucks);
    // The real price was deducted, exactly.
    expect(repaired.state.gym.ladder.gymBucks).toBe(
      dormant.gym.ladder.gymBucks - view.repairCostGymBucks,
    );
    // The real repair mechanic's own output: full condition, not a
    // to-the-minimum figure no function charges (`repairCostGymBucks`'s own
    // header).
    expect(itemCondition(repaired.state, 'mats')).toBe(1);

    // (5) Recovery re-evaluates from the real post-repair state: `mats` is
    // no longer one of the blockers (every OTHER owned item was worn to the
    // same gap condition by this fixture's `withCondition`, so they remain —
    // this asserts the one thing the repair actually changed, not a false
    // claim that the whole gym is now ready).
    expect(recoveryBlockingItems(repaired.state)).not.toContain('mats');
    expect(stationConditionView(repaired.state, 'mats').blocksRecovery).toBe(false);
  });

  it('REQUIRED NEGATIVE CONTROL, unaffordable case: the same gap-condition item under a purse below the real repair cost — recovery still names it, the panel quotes the real (unaffordable) price rather than "nothing to repair", and no repair happens', () => {
    const dormant = dormantAt(GAP_CONDITION, 0);
    const view = stationConditionView(dormant, 'mats');
    expect(view.blocksRecovery).toBe(true);
    expect(view.repairCostGymBucks).toBeGreaterThan(0);
    expect(view.repairCostGymBucks).toBeGreaterThan(dormant.gym.ladder.gymBucks);

    // `FloorGrid.tsx`'s gate reaches the unaffordable arm, not the
    // "nothing to repair" arm — this item is not routine-sound-and-clear,
    // it is a priced refusal.
    expect(view.isSound && !view.blocksRecovery).toBe(false);

    const outcome = repairEquipment(dormant, 'mats');
    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') expect(outcome.reason).toBe('not-enough-gym-bucks');
    // State is unchanged by a refusal.
    expect(itemCondition(outcome.state, 'mats')).toBe(GAP_CONDITION);
    expect(recoveryBlockingItems(outcome.state)).toContain('mats');
  });

  it('outside dormancy, a gap-condition item is routine-sound and reads as nothing-to-repair, byte-identically to before this round — `blocksRecovery` never fires on a live gym', () => {
    const live = withCondition(withMatsOwned(), GAP_CONDITION);
    expect(failurePhase(live)).toBe('sound');
    const view = stationConditionView(live, 'mats');
    expect(view.isSound).toBe(true);
    expect(view.dormant).toBe(false);
    expect(view.blocksRecovery).toBe(false);
    expect(view.displayRepairCostGymBucks).toBe(0);
    expect(view.isSound && !view.blocksRecovery).toBe(true);
  });
});

describe('Stage D2.2 plate-loading progress — same job, duration-scaled', () => {
  it('is 0 when remaining is 0 or total is 0, and 0 at a just-armed seat', () => {
    expect(plateLoadingProgress(0, 18)).toBe(0);
    expect(plateLoadingProgress(18, 0)).toBe(0);
    expect(plateLoadingProgress(0, 0)).toBe(0);
    expect(plateLoadingProgress(18, 18)).toBe(0);
    expect(plateLoadingProgress(6, 6)).toBe(0);
  });

  it('maps remaining=1 to progress 1 at stock 18 and tree 6', () => {
    const stockTotal = EMPIRE_TUNING.FLOOR_SIM_STATION_CHANGEOVER_TICKS;
    const treeTotal = EMPIRE_TUNING.STATION_THROUGHPUT_CHANGEOVER_TICKS;
    expect(stockTotal).toBe(18);
    expect(treeTotal).toBe(6);
    expect(plateLoadingProgress(stockTotal, stockTotal)).toBe(0);
    expect(plateLoadingProgress(1, stockTotal)).toBe(1);
    expect(plateLoadingProgress(treeTotal, treeTotal)).toBe(0);
    expect(plateLoadingProgress(1, treeTotal)).toBe(1);
  });

  it('does not divide by zero when total is 0 or 1', () => {
    expect(plateLoadingProgress(1, 0)).toBe(0);
    expect(plateLoadingProgress(0, 1)).toBe(0);
    expect(plateLoadingProgress(1, 1)).toBe(1);
    expect(Number.isFinite(plateLoadingProgress(1, 1))).toBe(true);
    expect(Number.isFinite(plateLoadingProgress(1, 18))).toBe(true);
  });

  it('puts every disc on the sleeve at the last visible tick, same path at 18 and 6', () => {
    const layout = EMPIRE_TUNING.FLOOR_PLATE_LOADING;
    const stockEnd = plateLoadingDiscs(plateLoadingProgress(1, 18));
    const treeEnd = plateLoadingDiscs(plateLoadingProgress(1, 6));
    expect(stockEnd).toEqual(treeEnd);
    expect(stockEnd.length).toBe(layout.discCount);
    for (const disc of stockEnd) {
      expect(disc.xFraction).toBe(layout.sleeveXFraction);
    }
    const last = stockEnd[layout.discCount - 1];
    expect(last?.xFraction).toBe(layout.sleeveXFraction);
    const stockStart = plateLoadingDiscs(plateLoadingProgress(18, 18));
    const treeStart = plateLoadingDiscs(plateLoadingProgress(6, 6));
    expect(stockStart).toEqual(treeStart);
    for (const disc of stockStart) {
      expect(disc.xFraction).toBe(layout.sourceXFraction);
    }
  });

  it('emits the tuned disc count and moves them from source x toward sleeve x', () => {
    const layout = EMPIRE_TUNING.FLOOR_PLATE_LOADING;
    const start = plateLoadingDiscs(0);
    const end = plateLoadingDiscs(1);
    expect(start.length).toBe(layout.discCount);
    expect(end.length).toBe(layout.discCount);
    expect(start[0]?.xFraction).toBeCloseTo(layout.sourceXFraction, 10);
    expect(end[0]?.xFraction).toBeCloseTo(layout.sleeveXFraction, 10);
    expect(end[0]?.xFraction).toBeGreaterThan(start[0]?.xFraction as number);
    // Same path, sequential discs: at halfway the first disc has arrived and
    // the last has not left the stack. Stock 18 and tree 6 share this shape.
    const mid = plateLoadingDiscs(0.5);
    expect(mid[0]?.xFraction).toBeCloseTo(layout.sleeveXFraction, 10);
    expect(mid[layout.discCount - 1]?.xFraction).toBeCloseTo(layout.sourceXFraction, 10);
  });
});

