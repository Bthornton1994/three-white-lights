import { describe, expect, it } from 'vitest';
import { createGymViewState, gymViewReduce } from '../ladderView';
import { nativeFacilityReadings, nativeItemFootprint, nativeItemName, nativeItemPlacement, nativeLayoutAction, nativeLayoutTarget, nativeNextRotation, nativePlacementPreview, nativeSceneCamera } from './nativeModel';
import { projectWorld, unprojectFloor } from '../scene/camera';
import { placeFloorFurniture, placeFloorItem } from '../floor';
import { COMPETITION_BENCH_BAY } from '../trainingStation';

describe('native facility presentation model', () => {
  it('fits each progression stage and keeps camera pan, zoom, and floor hit testing in one transform', () => {
    for (const rung of ['garage', 'storage-unit', 'strip-mall-unit', 'warehouse'] as const) {
      const opening = nativeSceneCamera(rung, { width: 320, height: 300 }, 1, { x: 0, y: 0 });
      const moved = nativeSceneCamera(rung, opening.viewport, 1.5, { x: 22, y: -17 });
      const before = projectWorld(opening, opening.focus);
      const after = projectWorld(moved, moved.focus);
      expect(after.x - before.x).toBeCloseTo(22);
      expect(after.y - before.y).toBeCloseTo(-17);
      expect(moved.scale).toBeCloseTo(opening.scale * 1.5);
      const point = { x: 2.4, y: 1.8 };
      const recovered = unprojectFloor(moved, projectWorld(moved, point));
      expect(recovered.x).toBeCloseTo(point.x);
      expect(recovered.y).toBeCloseTo(point.y);
      const first = projectWorld(opening, { x: 0, y: 0 });
      const last = projectWorld(opening, { x: opening.grid.width, y: opening.grid.height });
      expect(first.y).toBeGreaterThanOrEqual(0);
      expect(last.y).toBeLessThanOrEqual(opening.viewport.height);
    }
  });

  it('names both furniture and session items and sends them to their domain targets', () => {
    expect(nativeItemName('flat-bench')).toBe('Competition bench');
    expect(nativeItemName('rower')).toBe('Rower');
    expect(nativeLayoutTarget('squat-rack')).toEqual({ kind: 'furniture', item: 'squat-rack' });
    expect(nativeLayoutTarget('rower')).toEqual({ kind: 'session', item: 'rower' });
  });

  it('reads actual storage and rotation, validates the full footprint, and creates revision-guarded edits', () => {
    const opening = createGymViewState();
    const bench = nativeItemPlacement(opening, 'flat-bench')!;
    expect(bench).not.toBeNull();
    const draft = nativePlacementPreview(opening, 'flat-bench', bench.position, 90);
    expect(nativeItemFootprint('flat-bench', 90)).toEqual(draft.preview!.footprint);
    expect(nativeItemFootprint('rower', 90)).not.toEqual(nativeItemFootprint('rower', 0));
    expect(draft.preview!.rotation).toBe(90);
    expect(draft.preview!.footprint.width).toBe(bench.footprint.height);
    expect(draft.preview!.footprint.height).toBe(bench.footprint.width);
    expect(nativePlacementPreview(opening, 'flat-bench', { x: -1, y: 0 }, 90).message).toMatch(/whole footprint/);
    expect(nativePlacementPreview(opening, 'flat-bench', { x: 0.5, y: NaN }, 90)).toEqual({ preview: null, valid: false, message: 'Enter whole column and row numbers.' });
    const action = nativeLayoutAction(opening, 'flat-bench', null, 90);
    expect(action).toEqual({ kind: 'floor-edit', target: { kind: 'furniture', item: 'flat-bench' }, placement: null, expectedLayoutRevision: opening.floor.layoutRevision });
    const stored = gymViewReduce(opening, action);
    expect(nativeItemPlacement(stored, 'flat-bench')).toBeNull();
    expect(nativeFacilityReadings(stored).inventory.find(row => row.item === 'flat-bench')!.stored).toBe(true);
    expect(nativeFacilityReadings(stored).canUndo).toBe(true);
    expect(nativeLayoutAction(stored, 'flat-bench', { x: 2, y: 2 }, 180)).toMatchObject({ expectedLayoutRevision: stored.floor.layoutRevision, placement: { x: 2, y: 2, rotation: 180 } });
  });

  it('keeps quarter turns on the four supported rotations', () => {
    expect([0, 90, 180, 270].map(rotation => nativeNextRotation(rotation as 0 | 90 | 180 | 270))).toEqual([90, 180, 270, 0]);
  });

  it('uses the authoritative capacity reservation for previews without editing the real floor', () => {
    let state = gymViewReduce(createGymViewState(), { kind: 'advance-clock', gapSeconds: 43_200, mode: 'online' });
    state = gymViewReduce(state, { kind: 'buy-session', item: 'wrist-wraps' });
    state = gymViewReduce(state, { kind: 'upgrade-station', station: COMPETITION_BENCH_BAY, axis: 'capacity' });
    expect(state.lastRefusal).toBeNull();
    const before = JSON.stringify(state);
    const expansion = { x: 5, y: 0, rotation: 0 } as const;
    expect(placeFloorItem(state.floor, state.managed.gym.sessionEquipment, 'wrist-wraps', expansion).kind).toBe('placed');
    expect(placeFloorFurniture(state.floor, state.managed.gym.ladder.equipment, 'power-bar', expansion).kind).toBe('placed');
    for (const item of ['wrist-wraps', 'power-bar'] as const) {
      const preview = nativePlacementPreview(state, item, expansion, 0);
      expect(preview.valid).toBe(false);
      expect(preview.preview!.valid).toBe(false);
      expect(preview.message).toMatch(/overlaps equipment/);
    }
    const enclosed = { x: 1, y: 3, rotation: 90 } as const;
    expect(placeFloorFurniture(state.floor, state.managed.gym.ladder.equipment, 'flat-bench', enclosed).kind).toBe('placed');
    const preview = nativePlacementPreview(state, 'flat-bench', enclosed, 90);
    expect(preview.valid).toBe(false);
    expect(preview.message).toMatch(/second usable bench/);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('shows the occupied manager position rather than offering a second hire the domain refuses', () => {
    let state = gymViewReduce(createGymViewState(), { kind: 'advance-clock', gapSeconds: 43_200, mode: 'online' });
    state = gymViewReduce(state, { kind: 'hire-manager', tier: 'novice' });
    expect(state.lastRefusal).toBeNull();
    const managers = nativeFacilityReadings(state).managers;
    expect(managers.find(row => row.tier === 'novice')!.hired).toBe(true);
    expect(managers.every(row => !row.available && !row.positionOpen)).toBe(true);
  });

  it('quotes real ownership, unlocks, funds, maintenance, managers, and upgrade refusals', () => {
    const opening = createGymViewState();
    const readings = nativeFacilityReadings(opening);
    expect(readings.title).toBe('Garage gym');
    expect(readings.bucks).toBe('0');
    expect(readings.catalog.find(row => row.item === 'flat-bench')!.owned).toBe(true);
    expect(readings.catalog.find(row => row.item === 'squat-rack')!.locked).toBe(true);
    expect(readings.catalog.find(row => row.item === 'mats')!.affordable).toBe(false);
    expect(readings.next!.title).toBe('The storage gym');
    expect(readings.next!.affordable).toBe(false);
    expect(readings.managers.find(row => row.tier === 'novice')!.capability).toMatch(/No automatic repair/);
    expect(readings.maintenance.every(row => row.ready && row.condition === 100)).toBe(true);
    expect(readings.upgrades.every(row => !row.available)).toBe(true);
    expect(readings.canUndo).toBe(false);
  });

  it('explains incomplete previews before calling the placement domain', () => {
    const opening = createGymViewState();
    expect(nativePlacementPreview(opening, null, null, 0).message).toMatch(/Choose equipment/);
    expect(nativePlacementPreview(opening, 'flat-bench', null, 0).message).toMatch(/Drag equipment/);
  });
});
