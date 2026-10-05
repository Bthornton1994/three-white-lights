import { describe, expect, it } from 'vitest';
import { EMPIRE_TUNING } from '../empireTuning';
import { createGymViewState, gymViewReduce } from '../ladderView';
import { advancePracticeFacilityClock, createPracticeFacility } from './practiceFacility';

describe('native disposable facility clock', () => {
  it('does not mint income from repeated check-in taps without elapsed time', async () => {
    const port = createPracticeFacility(() => 5000);
    const opening = port.openingFacility();
    for (let index = 0; index < 20; index++) await port.facilityAction({ kind: 'check-in' }, `tap:${index}`);
    expect(port.openingFacility()).toBe(opening);
    expect(port.openingFacility().managed.gym.ladder.gymBucks).toBe(0);
  });

  it('consumes whole domain ticks once and carries the sub-tick remainder and backwards clock', () => {
    const opening = { state: createGymViewState(), atMs: 1000 };
    const quantum = EMPIRE_TUNING.TICK_SECONDS * EMPIRE_TUNING.MILLISECONDS_PER_SECOND;
    expect(advancePracticeFacilityClock(opening, 999, 'online')).toBe(opening);
    expect(advancePracticeFacilityClock(opening, 1000 + quantum - 1, 'online')).toBe(opening);
    const next = advancePracticeFacilityClock(opening, 1000 + quantum + 499, 'online');
    expect(next.atMs).toBe(1000 + quantum);
    expect(next.state.managed.gym.ladder.collectedAt).toBe(EMPIRE_TUNING.TICK_SECONDS);
    expect(next.state.managed.gym.ladder.gymBucks).toBeGreaterThan(0);
    expect(advancePracticeFacilityClock(next, 1000 + quantum + 999, 'online')).toBe(next);
  });

  it('uses the existing offline reduction and cap after native backgrounding', async () => {
    let now = 0;
    const port = createPracticeFacility(() => now);
    const opening = port.openingFacility();
    port.setForeground(false);
    now = 30 * EMPIRE_TUNING.SECONDS_PER_DAY * EMPIRE_TUNING.MILLISECONDS_PER_SECOND;
    port.setForeground(true);
    const expected = gymViewReduce(opening, { kind: 'advance-clock', gapSeconds: now / EMPIRE_TUNING.MILLISECONDS_PER_SECOND, mode: 'offline' });
    expect(port.openingFacility()).toEqual(expected);
    expect(port.openingFacility().lastAccrual!.secondsDiscarded).toBeGreaterThan(0);
    const beforeTap = port.openingFacility().managed.gym.ladder.gymBucks;
    await port.facilityAction({ kind: 'check-in' }, 'resume-check');
    expect(port.openingFacility().managed.gym.ladder.gymBucks).toBe(beforeTap);
  });

  it('treats an unexpectedly long foreground scheduling gap as offline', () => {
    const opening = { state: createGymViewState(), atMs: 0 };
    const gap = 7 * EMPIRE_TUNING.SECONDS_PER_DAY;
    const next = advancePracticeFacilityClock(opening, gap * EMPIRE_TUNING.MILLISECONDS_PER_SECOND, 'online');
    const offline = gymViewReduce(opening.state, { kind: 'advance-clock', gapSeconds: gap, mode: 'offline' });
    expect(next.state).toEqual(offline);
    expect(next.state.lastAccrual!.secondsDiscarded).toBeGreaterThan(0);
  });

  it('replays an idempotent request and refuses reuse for a different action', async () => {
    let now = 0;
    const port = createPracticeFacility(() => now);
    const original = await port.facilityAction({ kind: 'floor-remove-furniture', item: 'flat-bench' }, 'edit-once');
    const revision = port.openingFacility().floor.layoutRevision;
    now = 10000;
    expect(await port.facilityAction({ kind: 'floor-remove-furniture', item: 'flat-bench' }, 'edit-once')).toBe(original);
    expect(port.openingFacility().floor.layoutRevision).toBe(revision);
    const refused = await port.facilityAction({ kind: 'floor-remove-furniture', item: 'power-bar' }, 'edit-once');
    expect(refused.kind).toBe('refused');
    expect(port.openingFacility().floor.furniture['power-bar']).toBeDefined();
  });

  it('allows a fresh check-in after a refused edit without minting time or replaying the refusal', async () => {
    const port = createPracticeFacility(() => 0);
    const refused = await port.facilityAction({ kind: 'floor-edit', expectedLayoutRevision: 99, target: { kind: 'furniture', item: 'flat-bench' }, placement: null }, 'stale-edit');
    expect(refused.kind).toBe('refused');
    const failed = port.openingFacility();
    expect(failed.lastRefusal).not.toBeNull();
    const check = await port.facilityAction({ kind: 'check-in' }, 'read-after-refusal');
    expect(check.kind).toBe('saved');
    expect(port.openingFacility().lastRefusal).toBeNull();
    expect(port.openingFacility().managed.gym.ladder.gymBucks).toBe(failed.managed.gym.ladder.gymBucks);
    expect(port.openingFacility().floor).toBe(failed.floor);
    expect(port.openingFacility().managed.gym.ladder.collectedAt).toBe(failed.managed.gym.ladder.collectedAt);
  });

  it('routes a placement, stale revision, and undo through the facility reducer', async () => {
    const port = createPracticeFacility(() => 0);
    const revision = port.openingFacility().floor.layoutRevision;
    const action = { kind: 'floor-edit', expectedLayoutRevision: revision, target: { kind: 'furniture', item: 'flat-bench' }, placement: null } as const;
    const stored = await port.facilityAction(action, 'store');
    expect(stored.kind).toBe('saved');
    const storedState = port.openingFacility();
    expect(storedState.floor.furniture['flat-bench']).toBeUndefined();
    expect(storedState.floor.layoutRevision).toBe(revision + 1);
    const stale = await port.facilityAction({ ...action, target: { kind: 'furniture', item: 'power-bar' } }, 'stale');
    expect(stale.kind).toBe('refused');
    const undone = await port.facilityAction({ kind: 'floor-undo', expectedLayoutRevision: storedState.floor.layoutRevision }, 'undo');
    expect(undone.kind).toBe('saved');
    expect(port.openingFacility().floor.furniture['flat-bench']).toEqual(createGymViewState().floor.furniture['flat-bench']);
  });

  it('opens a new disposable gym rather than sharing a prior app-run balance or layout', async () => {
    const first = createPracticeFacility(() => 0);
    await first.facilityAction({ kind: 'floor-remove-furniture', item: 'flat-bench' }, 'first-store');
    const second = createPracticeFacility(() => 0);
    expect(second.openingFacility()).toEqual(createGymViewState());
    expect(second.openingFacility().floor).not.toEqual(first.openingFacility().floor);
  });
});
