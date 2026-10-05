import { describe, expect, it } from 'vitest';
import { createGymViewState, gymViewReduce } from '../facility/ladderView';
import { newServerRecord } from '../game/sessionServer';
import { withFacilityWallet, utcServerDay, readProductionMutation, readFacilityAction, applyProductionMutation, initialProductionState, productionOpening } from './server';

describe('production authority boundaries', () => {
  it('seals the facility wallet record without moving protected performance facts', () => {
    const original = newServerRecord(20_000);
    const facility = gymViewReduce(createGymViewState(), { kind: 'advance-clock', gapSeconds: 3_600, mode: 'online' });
    const record = withFacilityWallet(original, facility);
    expect(record).not.toBe(original);
    expect(record.wallet.gymBucks).toBe(Math.floor(facility.managed.gym.ladder.gymBucks));
    expect(record.wallet.gymBucks).toBeGreaterThan(0);
    expect(record.wallet.chalk).toBe(original.wallet.chalk);
    expect(record.totalKg).toBe(original.totalKg);
    expect(record.bestE1rmKg).toBe(original.bestE1rmKg);
    expect(record.meets).toBe(original.meets);
    expect(record.streak).toBe(original.streak);
    expect(record.federation).toBe(original.federation);
    expect(record.fatigue).toBe(original.fatigue);
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.bestE1rmKg)).toBe(true);
    expect(Object.isFrozen(record.fatigue)).toBe(true);
    expect(Object.isFrozen(record.federation)).toBe(true);
    expect(Object.isFrozen(record.meets)).toBe(true);
    expect(Object.isFrozen(record.streak)).toBe(true);
    expect(Object.isFrozen(record.wallet)).toBe(true);
    expect(Reflect.set(record.wallet, 'gymBucks', 999_999)).toBe(false);
    expect(record.wallet.gymBucks).toBe(Math.floor(facility.managed.gym.ladder.gymBucks));
  });

  it('uses the native three AM rollover on the database UTC clock', () => {
    expect(utcServerDay(Date.UTC(2026, 8, 30, 2, 59, 59))).toBe(utcServerDay(Date.UTC(2026, 8, 29, 23, 59, 59)));
    expect(utcServerDay(Date.UTC(2026, 8, 30, 3))).toBe(utcServerDay(Date.UTC(2026, 8, 30, 2, 59, 59)) + 1);
  });

  it('rejects account replacement and client controlled clocks at the command boundary', () => {
    expect(() => readProductionMutation({ kind: 'facility-action', payload: {}, requestId: 'x', expectedRevision: 0, userId: 'someone-else' })).toThrow();
    for (const kind of ['advance-clock', 'advance-to-next-week', 'reset-gym', 'apply-living-member-observations', 'set-gym-surface']) expect(() => readFacilityAction({ kind, gapSeconds: 99_999 })).toThrow();
  });
});


describe('authoritative floor edit protocol', () => {
  const edit = { kind: 'floor-edit', expectedLayoutRevision: 0, target: { kind: 'furniture', item: 'flat-bench' }, placement: { x: 3, y: 0, rotation: 90 } };
  const nowMs = Date.UTC(2026, 9, 3, 12);

  it('accepts exact oriented edits and storage/undo shapes', () => {
    expect(readFacilityAction(edit)).toEqual(edit);
    expect(readFacilityAction({ ...edit, placement: null })).toEqual({ ...edit, placement: null });
    expect(readFacilityAction({ kind: 'floor-undo', expectedLayoutRevision: 1 })).toEqual({ kind: 'floor-undo', expectedLayoutRevision: 1 });
  });

  it.each([
    { ...edit, expectedLayoutRevision: 0.5 },
    { ...edit, expectedLayoutRevision: -1 },
    { ...edit, expectedLayoutRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...edit, target: { kind: 'furniture', item: 'rower' } },
    { ...edit, target: { kind: 'session', item: 'flat-bench' } },
    { ...edit, target: { ...edit.target, userId: 'other-account' } },
    { ...edit, placement: { x: 3, y: 0 } },
    { ...edit, placement: { x: 3, y: 0, rotation: 45 } },
    { ...edit, placement: { x: 3.5, y: 0, rotation: 90 } },
    { ...edit, placement: { x: 3, y: 0, rotation: 90, wallet: 999 } },
    { ...edit, wallet: { gymBucks: 999 } },
    { ...edit, state: createGymViewState() },
    { kind: 'floor-undo', expectedLayoutRevision: 1, previous: createGymViewState() },
    { kind: 'floor-undo' },
  ])('rejects malformed edits at the server boundary: %j', value => {
    expect(() => readFacilityAction(value)).toThrow();
  });

  it('serializes the layout receipt and rejects a concurrent stale edit after restore', () => {
    const initial = initialProductionState(nowMs);
    const saved = applyProductionMutation(initial, { kind: 'facility-action', requestId: 'layout-1', expectedRevision: 0, payload: { action: edit } }, nowMs, 'layout-test');
    expect(saved.response).toMatchObject({ kind: 'saved', state: { floor: { layoutRevision: 1, furniture: { 'flat-bench': { rotation: 90 } } } } });
    const reopened = productionOpening(saved.state, 1, nowMs);
    expect(reopened.facility.floor.layoutRevision).toBe(1);
    const stale = applyProductionMutation(saved.state, { kind: 'facility-action', requestId: 'layout-stale', expectedRevision: 1, payload: { action: { ...edit, placement: null } } }, nowMs, 'layout-test');
    expect(stale.response).toMatchObject({ kind: 'refused', message: 'layout conflict', state: { floor: { layoutRevision: 1 } } });
    expect(stale.state.facilitySave).toBe(saved.state.facilitySave);
    const undo = applyProductionMutation(stale.state, { kind: 'facility-action', requestId: 'layout-undo', expectedRevision: 2, payload: { action: { kind: 'floor-undo', expectedLayoutRevision: 1 } } }, nowMs, 'layout-test');
    expect(undo.response).toMatchObject({ kind: 'saved', state: { floor: { layoutRevision: 2, furniture: { 'flat-bench': { rotation: 0 } }, lastLayoutEdit: null } } });
    const final = productionOpening(undo.state, 3, nowMs);
    expect(final.wire.wallet).toEqual(reopened.wire.wallet);
    expect(final.wire.totalKg).toBe(reopened.wire.totalKg);
    expect(final.wire.bestE1rmKg).toEqual(reopened.wire.bestE1rmKg);
    expect(final.wire.meets).toEqual(reopened.wire.meets);
    expect(final.facility.livingMembers).toEqual(reopened.facility.livingMembers);
  });
});
