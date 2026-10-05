import { floorFurnitureLayout, floorLayout, floorPositionRotation, furnitureItemFootprint, sessionItemFootprint, type FloorEditTarget, type FloorRotation, type GridPosition } from '../../src/facility/floor';
import { gymViewReduce, type GymViewState } from '../../src/facility/ladderView';
import { EMPIRE_TUNING } from '../../src/facility/empireTuning';
import type { LadderEquipmentItem } from '../../src/facility/ladder';
import type { ManagedEquipmentItem } from '../../src/facility/management';
import type { SessionEquipmentItem } from '../../src/facility/sessions';
import { GYM_INTERACTION_TUNING as T } from './gymInteractionTuning';

export interface GymPlacement {
  readonly target: FloorEditTarget;
  readonly position: GridPosition | null;
  readonly rotation: FloorRotation;
  readonly expectedLayoutRevision: number;
}
export const GYM_ITEM_NAMES: Readonly<Record<ManagedEquipmentItem, string>> = Object.freeze({
  'power-bar': 'Power bar', 'comp-plates': 'Competition plates', 'flat-bench': 'Competition bench', 'squat-rack': 'Squat rack',
  bike: 'Exercise bike', treadmill: 'Treadmill', rower: 'Rowing machine', sled: 'Sled track', dumbbells: 'Dumbbell set', cables: 'Cable station',
  machines: 'Machine station', mats: 'Training mats', 'foam-rollers': 'Foam rollers', sauna: 'Sauna', 'wrist-wraps': 'Wrist wraps',
  belts: 'Lifting belts', sleeves: 'Knee sleeves', 'specialty-bars': 'Specialty bars',
});
export const GYM_RUNG_NAMES: Readonly<Record<string, string>> = Object.freeze({ garage: 'Garage gym', 'storage-unit': 'Storage gym', 'strip-mall-unit': 'Neighborhood gym', warehouse: 'Warehouse gym' });
export function equipmentTarget(item: ManagedEquipmentItem): FloorEditTarget {
  return (EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS as readonly string[]).includes(item)
    ? { kind: 'furniture', item: item as LadderEquipmentItem } : { kind: 'session', item: item as SessionEquipmentItem };
}
export function openingPlacement(state: GymViewState, item: ManagedEquipmentItem): GymPlacement {
  const row = [...floorFurnitureLayout(state.floor, state.managed.gym.ladder.equipment), ...floorLayout(state.floor)].find(entry => entry.item === item);
  return { target: equipmentTarget(item), position: row?.position ?? null, rotation: row ? floorPositionRotation(row.position) : T.ZERO as FloorRotation, expectedLayoutRevision: state.floor.layoutRevision };
}
export function placementFootprint(draft: GymPlacement) {
  return draft.target.kind === 'furniture' ? furnitureItemFootprint(draft.target.item, draft.rotation) : sessionItemFootprint(draft.target.item, draft.rotation);
}
export function placementRefusal(state: GymViewState, draft: GymPlacement | null): string | null {
  if (!draft || !draft.position) return 'choose-position';
  return gymViewReduce(state, { kind: 'floor-edit', expectedLayoutRevision: draft.expectedLayoutRevision, target: draft.target, placement: { ...draft.position, rotation: draft.rotation } }).lastRefusal;
}
export function placementMessage(reason: string | null): string {
  if (reason === null) return 'Clear space. Ready to place.';
  if (reason === 'choose-position') return 'Drag your equipment or tap a clear spot on the floor.';
  if (reason === 'overlaps') return 'Another item occupies this space.';
  if (reason === 'out-of-bounds') return 'Keep the complete footprint inside your gym.';
  if (reason === 'no-second-position') return 'Leave space beside your competition bench for its second bench.';
  if (reason === 'layout-conflict') return 'Your layout changed. Cancel and select the equipment again.';
  return reason.replaceAll('-', ' ');
}
export function rotatePlacement(draft: GymPlacement): GymPlacement {
  return { ...draft, rotation: (draft.rotation + T.QUARTER_TURN) % T.FULL_TURN as FloorRotation };
}
