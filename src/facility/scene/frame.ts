import { floorFurnitureLayout, floorLayout, furnitureItemFootprint, sessionItemFootprint, type GridSize } from '../floor';
import { floorStationRefKey, floorStations, type FloorSimMember, type FloorStation } from '../floorSim';
import { stationLevels } from '../stationCapability';
import { COMPETITION_BENCH_BAY, competitionBenchBay } from '../trainingStation';
import type { ManagedEquipmentItem } from '../management';
import { EMPIRE_TUNING } from '../empireTuning';
import { renderMember } from './actors';
import { createSceneCamera, pointInPolygon, projectWorld, projectedFootprint } from './camera';
import { ANATOMY_GEOMETRY as A } from './anatomyData';
import { EQUIPMENT_ASSETS } from './equipmentData';
import { renderEquipment } from './equipment';
import { renderEnvironment, sceneBackdrop } from './environment';
import { addCommand, createScenePainter, finishPrimitives, worldDepth, type ScenePainter } from './geometry';
import { SCENE_PALETTE as P } from './scenePalette';
import { SCENE_TUNING as T } from './sceneTuning';
import type { EquipmentInstance, GymSceneFrame, GymSceneInput, SceneActivityCounts, SceneCamera, SceneEntity, ScenePoint, ScenePrimitive } from './types';

function hull(points: readonly ScenePoint[]): readonly ScenePoint[] {
  const sorted = [...points].sort((left, right) => left.x - right.x || left.y - right.y);
  const cross = (a: ScenePoint, b: ScenePoint, c: ScenePoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const chain = (values: readonly ScenePoint[]): ScenePoint[] => {
    const result: ScenePoint[] = [];
    for (const point of values) {
      while (result.length >= T.math.two && cross(result[result.length - T.math.two]!, result[result.length - T.math.one]!, point) <= T.math.zero) result.pop();
      result.push(point);
    }
    result.pop();
    return result;
  };
  return [...chain(sorted), ...chain([...sorted].reverse())];
}

function equipmentEntity(instance: EquipmentInstance, camera: SceneCamera, kind: SceneEntity['kind'] = 'equipment'): SceneEntity {
  const position = { x: instance.position.x + instance.footprint.width / T.math.two, y: instance.position.y + instance.footprint.height / T.math.two };
  const base = projectedFootprint(camera, instance.position, instance.footprint);
  const top = projectedFootprint(camera, instance.position, instance.footprint, EQUIPMENT_ASSETS[instance.item].height);
  return { id: instance.source === 'expansion' ? `${instance.item}:expansion` : instance.item, kind, item: instance.item, position,
    footprint: instance.footprint, rotation: instance.rotation, source: instance.source ?? 'primary',
    hitPolygon: hull([...base, ...top]), depth: worldDepth(position), label: EQUIPMENT_ASSETS[instance.item].label };
}

function renderedHitPolygon(primitives: readonly ScenePrimitive[]): readonly ScenePoint[] {
  const points = primitives.filter(primitive => primitive.depth >= T.math.zero).flatMap(({ command }) => {
    if (command.kind === 'text') return [command.position];
    if (command.kind === 'ellipse') return [{ x: command.center.x - command.radiusX, y: command.center.y - command.radiusY }, { x: command.center.x + command.radiusX, y: command.center.y + command.radiusY }];
    return command.points;
  });
  const boundary = hull(points);
  const center = { x: boundary.reduce<number>((sum, point) => sum + point.x, T.math.zero) / boundary.length, y: boundary.reduce<number>((sum, point) => sum + point.y, T.math.zero) / boundary.length };
  return boundary.map(point => {
    const distance = Math.max(T.math.epsilon, Math.hypot(point.x - center.x, point.y - center.y));
    return { x: point.x + (point.x - center.x) / distance * T.build.hitSlop, y: point.y + (point.y - center.y) / distance * T.build.hitSlop };
  });
}

function memberEntity(member: FloorSimMember, position: ScenePoint, head: ScenePoint, camera: SceneCamera, staff = false): SceneEntity {
  const feet = projectWorld(camera, position);
  const radius = T.entity.actorHitWidth * camera.scale;
  const top = Math.min(head.y - T.anatomy.headRadius * camera.scale, feet.y);
  return { id: staff ? 'manager' : member.memberId, kind: staff ? 'staff' : 'member', memberId: staff ? undefined : member.memberId,
    position, activity: staff ? undefined : member.state, depth: worldDepth(position), label: staff ? 'Gym manager' : member.type,
    hitPolygon: [{ x: feet.x - radius, y: top }, { x: feet.x + radius, y: top }, { x: feet.x + radius, y: feet.y + T.build.hitSlop }, { x: feet.x - radius, y: feet.y + T.build.hitSlop }] };
}

function allEquipment(input: GymSceneInput): readonly EquipmentInstance[] {
  const furniture = floorFurnitureLayout(input.context.floor, input.context.barbellOwned);
  const equipment: EquipmentInstance[] = [...furniture, ...floorLayout(input.context.floor).filter(row => input.context.sessionOwned.includes(row.item))]
    .map(row => ({ ...row, source: 'primary' as const, condition: input.managed?.condition[row.item] }));
  const bay = competitionBenchBay(input.context.floor, input.context.barbellOwned, stationLevels(input.context.capability, COMPETITION_BENCH_BAY).capacity);
  if (bay.expansion !== null) equipment.push({ ...bay.expansion, item: 'flat-bench', condition: input.managed?.condition['flat-bench'] });
  return equipment;
}

function occupiedEquipment(member: FloorSimMember, equipment: readonly EquipmentInstance[], stations: ReadonlyMap<string, FloorStation>): EquipmentInstance | undefined {
  if (member.state !== 'using' || member.target === null) return undefined;
  const station = stations.get(floorStationRefKey(member.target));
  if (station === undefined) return undefined;
  if (member.targetPosition !== null && (member.targetPosition.x !== station.position.x || member.targetPosition.y !== station.position.y || (member.targetPosition.rotation ?? T.math.zero) !== (station.position.rotation ?? T.math.zero))) return undefined;
  if (member.targetLayoutKey != null && member.targetLayoutKey !== station.layoutKey) return undefined;
  const seat = station.useCells.findIndex(cell => cell.x === member.cell.x && cell.y === member.cell.y);
  if (seat < T.math.zero) return undefined;
  if (member.target.kind === 'training') return equipment.find(instance => instance.item === 'flat-bench' && instance.source === (seat === T.math.zero ? 'primary' : 'expansion'));
  const targetItem = member.target.item;
  return equipment.find(instance => instance.item === targetItem);
}

function anchorEntityPrimitives(painter: ScenePainter, start: number, depth: number, end: number = painter.primitives.length, orderByDepth = true): void {
  const parts = painter.primitives.slice(start, end).sort((left, right) => (orderByDepth ? left.depth - right.depth : T.math.zero) || left.order - right.order);
  for (let index = T.math.zero; index < parts.length; index += T.math.one) {
    const part = parts[index]!;
    painter.primitives[start + index] = part.depth < T.math.zero ? part : { ...part, depth: depth + index * T.entity.localLayerStep };
  }
}

function outlineFootprint(painter: ScenePainter, instance: EquipmentInstance, color: string, opacity: number, fillOpacity: number, depth: number = T.entity.selectionDepth): void {
  const points = projectedFootprint(painter.camera, instance.position, instance.footprint);
  addCommand(painter, { kind: 'polygon', points, fill: color, opacity: fillOpacity }, depth);
  addCommand(painter, { kind: 'line', points: [...points, points[T.math.zero]!], stroke: color, lineWidth: Math.max(T.lines.minimumPixels, T.lines.selected * painter.camera.scale), opacity }, depth + T.math.epsilon);
}

function renderManager(painter: ScenePainter, input: GymSceneInput, equipment: readonly EquipmentInstance[]): SceneEntity | undefined {
  if (input.managed?.manager == null) return undefined;
  const grid = painter.camera.grid;
  let cell: ScenePoint | undefined;
  for (let y = T.math.zero; y < grid.height && cell === undefined; y += T.math.one) {
    for (let x = T.math.zero; x < grid.width; x += T.math.one) {
      if (!equipment.some(instance => x >= instance.position.x && x < instance.position.x + instance.footprint.width && y >= instance.position.y && y < instance.position.y + instance.footprint.height)
        && !input.sim.members.some(member => member.cell.x === x && member.cell.y === y)) { cell = { x, y }; break; }
    }
  }
  if (cell === undefined) return undefined;
  const manager: FloorSimMember = { memberId: 'manager', index: input.sim.members.length, type: 'serious-lifter', state: 'seeking', cell, next: null,
    progress: T.math.zero, target: null, targetPosition: null, claimedAt: null, queuedAt: null, queueArrivedAt: null,
    timer: T.math.zero, interruptedBy: null, awayFrom: null, strandedAt: null, usingStartedAt: null };
  const actorStart = painter.primitives.length;
  const actor = renderMember(painter, manager, { elapsedSeconds: input.elapsedSeconds, reducedMotion: input.reducedMotion, staff: true,
    staffPosition: { x: cell.x + T.math.half, y: cell.y + T.math.half } });
  anchorEntityPrimitives(painter, actorStart, actor.depth + T.entity.actorLayerOffset, painter.primitives.length, false);
  const center = projectWorld(painter.camera, { x: actor.position.x + A.staff.clipboardX, y: actor.position.y + A.staff.clipboardY, z: A.staff.clipboardZ });
  const halfWidth = A.staff.clipboardWidth * painter.camera.scale / T.math.two;
  const halfHeight = A.staff.clipboardHeight * painter.camera.scale / T.math.two;
  addCommand(painter, { kind: 'polygon', points: [{ x: center.x - halfWidth, y: center.y - halfHeight }, { x: center.x + halfWidth, y: center.y - halfHeight }, { x: center.x + halfWidth, y: center.y + halfHeight }, { x: center.x - halfWidth, y: center.y + halfHeight }],
    fill: P.wood, stroke: P.cream, lineWidth: T.lines.fine * painter.camera.scale }, actor.depth + T.entity.clipboardDepth);
  return memberEntity(manager, actor.position, actor.head, painter.camera, true);
}

export function buildGymSceneFrame(input: GymSceneInput, camera: SceneCamera): GymSceneFrame {
  const painter = createScenePainter(camera);
  const equipment = allEquipment(input);
  const stations = new Map(floorStations(input.context).map(station => [floorStationRefKey(station.ref), station]));
  const assignments = new Map(input.sim.members.map(member => [member.memberId, occupiedEquipment(member, equipment, stations)]));
  const occupied = new Set([...assignments.values()].filter((instance): instance is EquipmentInstance => instance !== undefined));
  const entities: SceneEntity[] = [];
  renderEnvironment(painter, input.context.rung, input.build);
  for (const instance of equipment) {
    const entity = equipmentEntity(instance, camera);
    if (input.selected === entity.id || input.selected === instance.item) outlineFootprint(painter, instance, P.amber, T.build.outlineOpacity, T.build.selectionFloorOpacity);
    const equipmentStart = painter.primitives.length;
    renderEquipment(painter, instance, { omitBar: occupied.has(instance), elapsedSeconds: occupied.has(instance) ? input.elapsedSeconds : T.math.zero, reducedMotion: input.reducedMotion });
    const hitPolygon = renderedHitPolygon(painter.primitives.slice(equipmentStart));
    anchorEntityPrimitives(painter, equipmentStart, entity.depth);
    entities.push({ ...entity, hitPolygon });
  }
  let training = T.math.zero;
  for (const member of input.sim.members) {
    const instance = assignments.get(member.memberId);
    const actorStart = painter.primitives.length;
    const actor = renderMember(painter, member, { equipment: instance, elapsedSeconds: input.elapsedSeconds, tickAlpha: input.tickAlpha, reducedMotion: input.reducedMotion });
    if (instance === undefined) anchorEntityPrimitives(painter, actorStart, actor.depth + T.entity.actorLayerOffset, painter.primitives.length, false);
    else {
      anchorEntityPrimitives(painter, actorStart, actor.depth + T.entity.actorLayerOffset, actor.bodyEnd, false);
      const surfaceDepth = worldDepth({ x: instance.position.x + instance.footprint.width / T.math.two, y: instance.position.y + instance.footprint.height / T.math.two });
      anchorEntityPrimitives(painter, actor.bodyEnd, surfaceDepth + T.entity.actorLayerOffset / T.math.two, actor.heldEnd);
    }
    entities.push(memberEntity(member, actor.position, actor.head, camera));
    if (instance !== undefined) training += T.math.one;
  }
  const manager = renderManager(painter, input, equipment);
  if (manager !== undefined) entities.push(manager);
  const preview = input.preview;
  if (preview != null) {
    const instance: EquipmentInstance = { ...preview, rotation: preview.rotation ?? T.preview.rotation };
    const ghost = createScenePainter(camera);
    renderEquipment(ghost, instance, { reducedMotion: true });
    for (const command of finishPrimitives(ghost)) addCommand(painter, { ...command, opacity: (command.opacity ?? T.math.one) * T.build.previewOpacity }, T.entity.previewDepth);
    outlineFootprint(painter, instance, preview.valid ? P.valid : P.invalid, T.build.outlineOpacity, preview.valid ? T.build.validFillOpacity : T.build.invalidFillOpacity, T.entity.previewDepth + T.math.one);
    entities.push({ ...equipmentEntity(instance, camera, 'preview'), hitPolygon: renderedHitPolygon(ghost.primitives) });
  }
  const counts: SceneActivityCounts = { training, waiting: input.sim.members.filter(member => member.state === 'queuing').length,
    walking: input.sim.members.filter(member => member.state === 'seeking').length, leaving: input.sim.members.filter(member => member.state === 'leaving').length,
    interrupted: input.sim.members.filter(member => member.state === 'interrupted').length, stranded: input.sim.members.filter(member => member.strandedAt !== null).length,
    staff: manager === undefined ? T.math.zero : T.math.one, total: input.sim.members.length };
  return { commands: [sceneBackdrop(camera), ...finishPrimitives(painter)], entities: entities.sort((left, right) => left.depth - right.depth), counts, camera, tick: input.sim.tick };
}

export function hitTestScene(frame: GymSceneFrame, point: ScenePoint): SceneEntity | null {
  return [...frame.entities].reverse().find(entity => entity.kind === 'equipment' && pointInPolygon(point, entity.hitPolygon)) ?? null;
}

export function buildEquipmentPreview(item: ManagedEquipmentItem, viewport: GridSize = { width: T.preview.viewportWidth, height: T.preview.viewportHeight }): GymSceneFrame {
  const asset = EQUIPMENT_ASSETS[item];
  const footprint = (EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS as readonly string[]).includes(item) ? furnitureItemFootprint(item as Parameters<typeof furnitureItemFootprint>[0]) : sessionItemFootprint(item as Parameters<typeof sessionItemFootprint>[0]);
  const camera = createSceneCamera(footprint, viewport, { fitAll: true });
  const fitted = Math.min((viewport.width - T.preview.padding * T.math.two) / (footprint.width + footprint.height),
    (viewport.height - T.preview.padding * T.math.two) / ((footprint.width + footprint.height) * camera.floorSlope + asset.height * camera.verticalScale));
  const previewCamera: SceneCamera = { ...camera, scale: fitted,
    origin: { x: viewport.width / T.math.two - (footprint.width - footprint.height) / T.math.two * fitted,
      y: T.preview.padding + asset.height * fitted * camera.verticalScale } };
  const painter = createScenePainter(previewCamera);
  const instance: EquipmentInstance = { item, position: { x: T.math.zero, y: T.math.zero }, footprint, rotation: T.preview.rotation };
  renderEquipment(painter, instance, { reducedMotion: true });
  return { commands: finishPrimitives(painter), entities: [{ ...equipmentEntity(instance, previewCamera), hitPolygon: renderedHitPolygon(painter.primitives) }], camera: previewCamera, tick: T.math.zero,
    counts: { training: T.math.zero, waiting: T.math.zero, walking: T.math.zero, leaving: T.math.zero, interrupted: T.math.zero, stranded: T.math.zero, staff: T.math.zero, total: T.math.zero } };
}
