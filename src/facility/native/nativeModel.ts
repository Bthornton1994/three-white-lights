import {
  floorFurnitureLayout, floorGridSize, floorLayout, furnitureItemFootprint, sessionItemFootprint,
  type FloorRotation, type GridPosition, type GridSize,
} from '../floor';
import { EMPIRE_TUNING } from '../empireTuning';
import { gymViewReduce, type GymViewState } from '../ladderView';
import {
  ladderEquipmentCost, ladderEquipmentMinRung, ladderIncomeRatePerHour,
  ladderMoveCost, nextLadderRung, type LadderEquipmentItem, type LadderRung,
} from '../ladder';
import {
  conditionIncomeMultiplier, managerHireCostGymBucks, managerWageRatePerBankedHour,
  managerAutoRepairCondition, repairCostGymBucks, type ManagedEquipmentItem,
} from '../management';
import { sessionEquipmentCost, sessionEquipmentMinRung, type SessionEquipmentItem } from '../sessions';
import { displayConditionPercent, playerFacingUpgradeEffect, playerFacingUpgradeLabel, playerFacingUpgradeRefuse } from '../stationView';
import { stationLevels, upgradeStation } from '../stationCapability';
import { COMPETITION_BENCH_BAY, capacityRealizesOn, competitionBenchBay } from '../trainingStation';
import type { FacilityAction } from '../../production/contracts';
import { fitSceneCamera, projectWorld } from '../scene/camera';
import { SCENE_TUNING } from '../scene/sceneTuning';
import type { SceneCamera, ScenePoint } from '../scene/types';
import { NATIVE_FACILITY_COPY as C, NATIVE_FACILITY_TUNING as T } from './nativeTuning';

export type NativeGymPage = (typeof C.tabs)[number];

export function nativeSceneCamera(rung: LadderRung, viewport: GridSize, requestedZoom: number, pan: ScenePoint): SceneCamera {
  const fitted = fitSceneCamera(floorGridSize(rung), viewport, rung);
  const zoom = Math.max(SCENE_TUNING.camera.minimumZoom, Math.min(SCENE_TUNING.camera.maximumZoom, requestedZoom));
  const focus = projectWorld(fitted, fitted.focus);
  const scale = fitted.scale * zoom;
  return { ...fitted, scale, zoom, pan, origin: {
    x: focus.x - (fitted.focus.x - fitted.focus.y) * scale + pan.x,
    y: focus.y - (fitted.focus.x + fitted.focus.y) * scale * fitted.floorSlope + pan.y,
  } };
}

export function nativeItemName(item: ManagedEquipmentItem): string {
  return C.items[item];
}

export function nativeLayoutTarget(item: ManagedEquipmentItem): Extract<FacilityAction, { kind: 'floor-edit' }>['target'] {
  return (EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS as readonly string[]).includes(item)
    ? { kind: 'furniture', item: item as LadderEquipmentItem }
    : { kind: 'session', item: item as SessionEquipmentItem };
}

export function nativeItemPlacement(state: GymViewState, item: ManagedEquipmentItem) {
  return [...floorFurnitureLayout(state.floor, state.managed.gym.ladder.equipment), ...floorLayout(state.floor)]
    .find(row => row.item === item) ?? null;
}

export function nativeItemFootprint(item: ManagedEquipmentItem, rotation: FloorRotation) {
  const target = nativeLayoutTarget(item);
  return target.kind === 'furniture' ? furnitureItemFootprint(target.item, rotation) : sessionItemFootprint(target.item, rotation);
}

export function nativePlacementPreview(state: GymViewState, item: ManagedEquipmentItem | null, position: GridPosition | null, rotation: FloorRotation) {
  if (item === null) return { preview: null, valid: false, message: 'Choose equipment from your inventory.' };
  if (position === null) return { preview: null, valid: false, message: 'Drag equipment onto the floor, or tap a clear space.' };
  if (!Number.isInteger(position.x) || !Number.isInteger(position.y)) {
    return { preview: null, valid: false, message: 'Enter whole column and row numbers.' };
  }
  const footprint = nativeItemFootprint(item, rotation);
  const refusal = gymViewReduce(state, nativeLayoutAction(state, item, position, rotation)).lastRefusal;
  const valid = refusal === null;
  const message = valid ? 'Clear space. Ready to place.'
    : refusal === 'out-of-bounds' ? 'The whole footprint must fit inside your gym.'
    : refusal === 'overlaps' ? 'That footprint overlaps equipment. Choose a clear space.'
    : refusal === 'no-second-position' ? 'Leave room for the second usable bench.'
    : 'This item cannot be placed here.';
  return { preview: { item, position, footprint, rotation, valid }, valid, message };
}

export function nativeLayoutAction(state: GymViewState, item: ManagedEquipmentItem, position: GridPosition | null, rotation: FloorRotation): Extract<FacilityAction, { kind: 'floor-edit' }> {
  return {
    kind: 'floor-edit', expectedLayoutRevision: state.floor.layoutRevision,
    target: nativeLayoutTarget(item), placement: position === null ? null : { ...position, rotation },
  };
}

export function nativeNextRotation(rotation: FloorRotation): FloorRotation {
  return ((rotation + T.QUARTER_TURN) % T.FULL_TURN) as FloorRotation;
}

export function nativeFacilityReadings(state: GymViewState) {
  const gym = state.managed.gym;
  const ladder = gym.ladder;
  const owned: readonly ManagedEquipmentItem[] = [...ladder.equipment, ...gym.sessionEquipment];
  const rungIndex = (EMPIRE_TUNING.LADDER_RUNGS as readonly string[]).indexOf(ladder.rung);
  const next = nextLadderRung(ladder.rung);
  const number = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  const inventory = owned.map(item => ({ item, name: nativeItemName(item), stored: nativeItemPlacement(state, item) === null }));
  const catalog = [
    ...EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS.map(item => ({ item, cost: ladderEquipmentCost(item), minimum: ladderEquipmentMinRung(item), family: 'barbell' as const })),
    ...EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.map(item => ({ item, cost: sessionEquipmentCost(item), minimum: sessionEquipmentMinRung(item), family: 'training' as const })),
  ].map(row => ({
    ...row, name: nativeItemName(row.item), price: number(row.cost), owned: owned.includes(row.item),
    locked: (EMPIRE_TUNING.LADDER_RUNGS as readonly string[]).indexOf(row.minimum) > rungIndex,
    affordable: ladder.gymBucks >= row.cost,
  }));
  const managers = EMPIRE_TUNING.MANAGER_TIERS.map(tier => ({
    tier, name: C.managers[tier], hired: state.managed.manager?.tier === tier,
    positionOpen: state.managed.manager === null,
    available: state.managed.manager === null && ladder.gymBucks >= managerHireCostGymBucks(tier),
    price: number(managerHireCostGymBucks(tier)), affordable: ladder.gymBucks >= managerHireCostGymBucks(tier),
    wage: number(managerWageRatePerBankedHour(tier)),
    capability: managerAutoRepairCondition(tier) > 0
      ? `Auto-repairs below ${displayConditionPercent(managerAutoRepairCondition(tier))}% condition.`
      : 'Inspects the floor. No automatic repair.',
  }));
  const maintenance = owned.flatMap(item => {
    const condition = state.managed.condition[item];
    if (condition === undefined) return [];
    const cost = repairCostGymBucks(state.managed, item);
    return [{ item, name: nativeItemName(item), condition: displayConditionPercent(condition), price: number(cost), ready: condition >= 1, affordable: ladder.gymBucks >= cost }];
  });
  const bay = competitionBenchBay(state.floor, ladder.equipment, stationLevels(state.capability, COMPETITION_BENCH_BAY).capacity);
  const upgrades = EMPIRE_TUNING.STATION_UPGRADE_AXES.map(axis => {
    const outcome = upgradeStation(state.capability, COMPETITION_BENCH_BAY, axis, ladder.gymBucks, bay.complete, capacityRealizesOn(state.floor, ladder.equipment));
    return {
      axis, label: playerFacingUpgradeLabel(axis), effect: playerFacingUpgradeEffect(axis),
      cost: number(outcome.costGymBucks), available: outcome.kind === 'upgraded',
      refusal: outcome.kind === 'refused' ? playerFacingUpgradeRefuse(outcome.reason) : null,
    };
  });
  return {
    title: C.rung[ladder.rung], bucks: number(ladder.gymBucks),
    income: number(ladderIncomeRatePerHour(ladder.rung) * conditionIncomeMultiplier(state.managed)),
    inventory, catalog, managers, maintenance, upgrades,
    next: next === null ? null : { rung: next, title: C.rung[next], cost: number(ladderMoveCost(next)), affordable: ladder.gymBucks >= ladderMoveCost(next) },
    canUndo: state.floor.lastLayoutEdit !== null,
  };
}
