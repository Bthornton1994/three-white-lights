import { describe, expect, it } from 'vitest';
import { createFloorState, placeFloorItem, placeFloorFurniture, floorLayout, floorFurnitureLayout, sessionItemFootprint, requireFloorState } from './floor';
import { createGymViewState, gymViewReduce } from './ladderView';
import { COMPETITION_BENCH_BAY, competitionBenchBay } from './trainingStation';

describe('living gym floor boundaries', () => {
  it('fits a horizontal treadmill using its rotated four by two footprint', () => {
    const result = placeFloorItem(createFloorState('garage'), ['treadmill'], 'treadmill', { x: 4, y: 4, rotation: 90 });
    expect(result.kind).toBe('placed');
  });

  it('rejects legacy session placement on the purchased second bench', () => {
    let state = gymViewReduce(createGymViewState(), { kind: 'advance-clock', gapSeconds: 43_200, mode: 'online' });
    state = gymViewReduce(state, { kind: 'buy-session', item: 'wrist-wraps' });
    state = gymViewReduce(state, { kind: 'upgrade-station', station: COMPETITION_BENCH_BAY, axis: 'capacity' });
    expect(state.lastRefusal).toBe(null);
    const placed = gymViewReduce(state, { kind: 'floor-place', item: 'wrist-wraps', position: { x: 5, y: 0 } });
    expect(placed.lastRefusal).toBe('overlaps');
    expect(placed.floor).toBe(state.floor);
  });
});


describe('oriented layout revisions and undo', () => {
  it.each([[0, 2, 5], [90, 5, 2], [180, 2, 5], [270, 5, 2]] as const)('uses the rower dimensions for %s degrees', (rotation, width, height) => {
    expect(sessionItemFootprint('rower', rotation)).toEqual({ width, height });
  });

  it('checks rotated existing equipment when placing another item', () => {
    const initial = placeFloorItem(createFloorState('garage'), ['rower', 'wrist-wraps'], 'rower', { x: 3, y: 4, rotation: 90 });
    expect(initial.kind).toBe('placed');
    expect(floorLayout(initial.state)[0]?.footprint).toEqual({ width: 5, height: 2 });
    const conflict = placeFloorItem(initial.state, ['rower', 'wrist-wraps'], 'wrist-wraps', { x: 7, y: 4 });
    expect(conflict.kind).toBe('refused');
    if (conflict.kind === 'refused') expect(conflict.reason).toBe('overlaps');
    expect(conflict.state).toBe(initial.state);
  });

  it('represents a bought rack as movable three by four furniture and rotates it', () => {
    const owned = ['power-bar', 'comp-plates', 'flat-bench', 'squat-rack'] as const;
    const placed = placeFloorFurniture(createFloorState('storage-unit'), owned, 'squat-rack', { x: 6, y: 1, rotation: 0 });
    expect(placed.kind).toBe('placed');
    expect(floorFurnitureLayout(placed.state, owned).find(row => row.item === 'squat-rack')?.footprint).toEqual({ width: 3, height: 4 });
    const turned = placeFloorFurniture(placed.state, owned, 'squat-rack', { x: 6, y: 1, rotation: 90 });
    expect(turned.kind).toBe('placed');
    expect(floorFurnitureLayout(turned.state, owned).find(row => row.item === 'squat-rack')).toMatchObject({ rotation: 90, footprint: { width: 4, height: 3 } });
    expect(turned.state.layoutRevision).toBe(placed.state.layoutRevision + 1);
  });

  it('rejects a second edit and stale undo from the same revision', () => {
    const opening = createGymViewState();
    const first = gymViewReduce(opening, { kind: 'floor-edit', expectedLayoutRevision: 0, target: { kind: 'furniture', item: 'comp-plates' }, placement: { x: 1, y: 3, rotation: 0 } });
    expect(first.lastRefusal).toBe(null);
    expect(first.floor.layoutRevision).toBe(1);
    const second = gymViewReduce(first, { kind: 'floor-edit', expectedLayoutRevision: 0, target: { kind: 'furniture', item: 'power-bar' }, placement: null });
    expect(second.lastRefusal).toBe('layout-conflict');
    expect(second.floor).toBe(first.floor);
    const staleUndo = gymViewReduce(first, { kind: 'floor-undo', expectedLayoutRevision: 0 });
    expect(staleUndo.lastRefusal).toBe('layout-conflict');
    expect(staleUndo.floor).toBe(first.floor);
  });

  it('undo changes only the last item and preserves earnings, purchases, and member identity', () => {
    let state = gymViewReduce(createGymViewState(), { kind: 'floor-edit', expectedLayoutRevision: 0, target: { kind: 'furniture', item: 'comp-plates' }, placement: { x: 1, y: 3, rotation: 90 } });
    state = gymViewReduce(state, { kind: 'advance-clock', gapSeconds: 3_600, mode: 'online' });
    state = gymViewReduce(state, { kind: 'buy-session', item: 'mats' });
    expect(state.managed.gym.sessionEquipment).toContain('mats');
    const reverted = gymViewReduce(state, { kind: 'floor-undo', expectedLayoutRevision: state.floor.layoutRevision });
    expect(reverted.lastRefusal).toBe(null);
    expect(reverted.floor.furniture['comp-plates']).toEqual({ x: 1, y: 0, rotation: 0 });
    expect(reverted.floor.layoutRevision).toBe(state.floor.layoutRevision + 1);
    expect(reverted.floor.lastLayoutEdit).toBe(null);
    expect(reverted.managed).toBe(state.managed);
    expect(reverted.livingMembers).toBe(state.livingMembers);
    expect(reverted.floor.furniture['flat-bench']).toBe(state.floor.furniture['flat-bench']);
    expect(gymViewReduce(reverted, { kind: 'floor-undo', expectedLayoutRevision: reverted.floor.layoutRevision }).lastRefusal).toBe('nothing-to-undo');
  });

  it('makes identical placement and empty storage no-ops', () => {
    const opening = createGymViewState();
    const placed = gymViewReduce(opening, { kind: 'floor-edit', expectedLayoutRevision: 0, target: { kind: 'furniture', item: 'flat-bench' }, placement: { x: 3, y: 0, rotation: 0 } });
    expect(placed.floor).toBe(opening.floor);
    expect(placed.floor.lastLayoutEdit).toBe(null);
    const missing = gymViewReduce(opening, { kind: 'floor-edit', expectedLayoutRevision: 0, target: { kind: 'furniture', item: 'squat-rack' }, placement: null });
    expect(missing.lastRefusal).toBe('not-owned');
    expect(missing.floor).toBe(opening.floor);
    const stored = gymViewReduce(opening, { kind: 'floor-edit', expectedLayoutRevision: 0, target: { kind: 'furniture', item: 'comp-plates' }, placement: null });
    expect(stored.floor.furniture['comp-plates']).toBeUndefined();
    expect(stored.floor.lastLayoutEdit).toMatchObject({ previous: { x: 1, y: 0, rotation: 0 }, current: null });
    const repeated = gymViewReduce(stored, { kind: 'floor-edit', expectedLayoutRevision: stored.floor.layoutRevision, target: { kind: 'furniture', item: 'comp-plates' }, placement: null });
    expect(repeated.floor).toBe(stored.floor);
  });

  it.each(['session', 'furniture'] as const)('guards atomic %s edits against the purchased expansion bench', kind => {
    let state = gymViewReduce(createGymViewState(), { kind: 'advance-clock', gapSeconds: 43_200, mode: 'online' });
    state = gymViewReduce(state, { kind: 'buy-session', item: 'wrist-wraps' });
    state = gymViewReduce(state, { kind: 'upgrade-station', station: COMPETITION_BENCH_BAY, axis: 'capacity' });
    const target = kind === 'session' ? { kind, item: 'wrist-wraps' as const } : { kind, item: 'power-bar' as const };
    const conflict = gymViewReduce(state, { kind: 'floor-edit', expectedLayoutRevision: state.floor.layoutRevision, target, placement: { x: 5, y: 0, rotation: 0 } });
    expect(conflict.lastRefusal).toBe('overlaps');
    expect(conflict.floor).toBe(state.floor);
    const rotated = gymViewReduce(state, { kind: 'floor-edit', expectedLayoutRevision: state.floor.layoutRevision, target: { kind: 'furniture', item: 'flat-bench' }, placement: { x: 3, y: 0, rotation: 90 } });
    expect(rotated.lastRefusal).toBe(null);
    const bay = competitionBenchBay(rotated.floor, rotated.managed.gym.ladder.equipment, 1);
    expect(bay.benches).toHaveLength(2);
    expect(bay.benches.map(row => row.footprint)).toEqual([{ width: 4, height: 2 }, { width: 4, height: 2 }]);
    expect(bay.expansion?.rotation).toBe(90);
  });

  it('refuses capacity when every adjacent second bench overlaps session equipment', () => {
    let state = gymViewReduce(createGymViewState(), { kind: 'advance-clock', gapSeconds: 43_200, mode: 'online' });
    state = gymViewReduce(state, { kind: 'buy-session', item: 'wrist-wraps' });
    state = gymViewReduce(state, { kind: 'floor-place', item: 'wrist-wraps', position: { x: 5, y: 0 } });
    expect(state.lastRefusal).toBe(null);
    const upgraded = gymViewReduce(state, { kind: 'upgrade-station', station: COMPETITION_BENCH_BAY, axis: 'capacity' });
    expect(upgraded.lastRefusal).toBe('no-second-position');
    expect(upgraded.managed).toBe(state.managed);
    expect(upgraded.capability).toBe(state.capability);
  });

  it('rejects a tampered floor revision or an unowned furniture footprint', () => {
    const floor = createFloorState('garage');
    expect(() => requireFloorState({ ...floor, layoutRevision: 0.5 }, [])).toThrow();
    expect(() => requireFloorState({ ...floor, furniture: { ...floor.furniture, 'squat-rack': { x: 5, y: 0 } } }, [], ['power-bar', 'comp-plates', 'flat-bench'])).toThrow();
  });
});
