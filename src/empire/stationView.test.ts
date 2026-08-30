import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { type FloorSimMember, type FloorSimMemberState, type FloorStationRef } from './floorSim';
import {
  type ManagedGym,
  createManagedGym,
  hireManager,
  ownedItemsOf,
  repairEquipment,
  withUpdatedGym,
} from './management';
import { buySessionEquipment, withLadder } from './sessions';
import {
  displayRepairCostBySoundness,
  isSoundCondition,
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
): FloorSimMember {
  return Object.freeze({
    index,
    type: 'powerlifter',
    state,
    cell: Object.freeze({ x: 0, y: 0 }),
    next: null,
    progress: 0,
    target,
    targetPosition: target === null ? null : Object.freeze({ x: 0, y: 0 }),
    claimedAt: target === null ? null : 0,
    queuedAt: null,
    timer: 0,
    interruptedBy: null,
    awayFrom: null,
    strandedAt: null,
  });
}

describe('stationView.ts — GDD §5.14 Stage C', () => {
  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

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
    expect(view).toEqual({ occupied: false, activeMemberType: null, queueCount: 0 });
  });

  it('reports occupied and the using member type when somebody is using it', () => {
    const members = [memberAt(0, 'using', SESSION_REF)];
    const view = stationOperationView(members, SESSION_REF);
    expect(view.occupied).toBe(true);
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
    expect(view.queueCount).toBe(2);
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
      activeMemberType: null,
      queueCount: 0,
    });
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
