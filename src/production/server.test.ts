import { describe, expect, it } from 'vitest';
import { createGymViewState, gymViewReduce } from '../facility/ladderView';
import { newServerRecord } from '../game/sessionServer';
import { withFacilityWallet, utcServerDay, readProductionMutation, readFacilityAction } from './server';

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
