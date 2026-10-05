import { describe, expect, it } from 'vitest';
import { createFloorState, floorGridSize, placeFloorItem } from '../floor';
import { createFloorSimState, floorStations, runFloorSim, withAmbientLivingPopulation, type FloorSimContext, type FloorSimMember } from '../floorSim';
import { EMPIRE_TUNING } from '../empireTuning';
import { createGymViewState } from '../ladderView';
import { sceneContextFor } from './runtime';
import { createSceneCamera, fitSceneCamera, pointInPolygon, projectWorld, projectedFootprint, unprojectFloor } from './camera';
import { buildEquipmentPreview, buildGymSceneFrame, hitTestScene } from './frame';
import { equipmentTransform } from './geometry';
import { EQUIPMENT_ASSETS } from './equipmentData';
import { ENVIRONMENT_STAGES } from './environmentData';
import { STATION_POSES } from './anatomyData';
import { SCENE_PALETTE } from './scenePalette';
import type { GymSceneFrame, GymSceneInput, SceneCommand } from './types';

function opening(): GymSceneInput {
  const state = createGymViewState();
  const context = sceneContextFor(state);
  return { context, managed: state.managed, sim: runFloorSim(createFloorSimState(context, 17), context, 120), elapsedSeconds: 14.4 };
}

function commandNumbers(command: SceneCommand): readonly number[] {
  const points = command.kind === 'ellipse' ? [command.center] : command.kind === 'text' ? [command.position] : command.points;
  const dimensions = command.kind === 'ellipse' ? [command.radiusX, command.radiusY] : command.kind === 'text' ? [command.fontSize] : [];
  return [...points.flatMap(point => [point.x, point.y]), ...dimensions, command.opacity ?? 1, command.lineWidth ?? 1];
}

function expectFinite(frame: GymSceneFrame): void {
  expect(frame.commands.length).toBeGreaterThan(0);
  expect(frame.commands.flatMap(commandNumbers).every(Number.isFinite)).toBe(true);
  for (const command of frame.commands) {
    expect(command.opacity ?? 1).toBeGreaterThanOrEqual(0);
    expect(command.opacity ?? 1).toBeLessThanOrEqual(1);
    if (command.kind === 'ellipse') { expect(command.radiusX).toBeGreaterThanOrEqual(0); expect(command.radiusY).toBeGreaterThanOrEqual(0); }
  }
}

describe('shared gym camera', () => {
  it('round-trips floor coordinates after focus, pan, and zoom', () => {
    const camera = createSceneCamera({ width: 16, height: 12 }, { width: 390, height: 480 }, { zoom: 1.9, pan: { x: 37, y: -24 }, focus: { x: 6, y: 4 } });
    for (const point of [{ x: 0, y: 0 }, { x: 16, y: 12 }, { x: 7.4, y: 3.1 }]) {
      const result = unprojectFloor(camera, projectWorld(camera, point));
      expect(result.x).toBeCloseTo(point.x, 9); expect(result.y).toBeCloseTo(point.y, 9);
    }
  });

  it.each(EMPIRE_TUNING.LADDER_RUNGS)('fits the entire %s floor and stage wall at phone and desktop sizes', rung => {
    const grid = floorGridSize(rung);
    for (const width of [320, 390, 430, 1200]) {
      const camera = fitSceneCamera(grid, { width, height: 420 }, rung);
      expect(camera.focus).toEqual({ x: grid.width / 2, y: grid.height / 2 });
      const points = [...projectedFootprint(camera, { x: 0, y: 0 }, grid), projectWorld(camera, { x: 0, y: 0, z: ENVIRONMENT_STAGES[rung].wallHeight })];
      for (const point of points) { expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(width); expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThanOrEqual(420); }
    }
  });

  it('hits the same oriented floor polygon the preview displays', () => {
    const camera = createSceneCamera({ width: 12, height: 10 }, { width: 390, height: 440 });
    const polygon = projectedFootprint(camera, { x: 2, y: 3 }, { width: 4, height: 2 });
    expect(pointInPolygon(projectWorld(camera, { x: 4, y: 4 }), polygon)).toBe(true);
    expect(pointInPolygon(projectWorld(camera, { x: 7, y: 4 }), polygon)).toBe(false);
  });
});

describe('shared scene frames', () => {
  it('renders live ownership and reports only the visible population without mutating simulation', () => {
    const input = opening(); const before = JSON.stringify(input.sim);
    const frame = buildGymSceneFrame(input, createSceneCamera(floorGridSize(input.context.rung), { width: 390, height: 440 }));
    expectFinite(frame);
    expect(frame.tick).toBe(input.sim.tick);
    expect(frame.entities.filter(entity => entity.kind === 'equipment').map(entity => entity.item).sort()).toEqual([...input.context.barbellOwned].sort());
    expect(frame.entities.filter(entity => entity.kind === 'member').map(entity => entity.id)).toEqual(expect.arrayContaining(input.sim.members.map(member => member.memberId)));
    expect(frame.counts.total).toBe(input.sim.members.length);
    expect(frame.counts.training).toBe(input.sim.members.filter(member => member.state === 'using').length);
    expect(frame.counts.waiting).toBe(input.sim.members.filter(member => member.state === 'queuing').length);
    expect(JSON.stringify(input.sim)).toBe(before);
  });

  it('never paints a floor top after the people and equipment standing on it', () => {
    const input = opening(); const frame = buildGymSceneFrame(input, createSceneCamera(floorGridSize(input.context.rung), { width: 390, height: 440 }));
    const wholeFloor = projectedFootprint(frame.camera, { x: 0, y: 0 }, frame.camera.grid);
    const floorTop = frame.commands.findIndex(command => command.kind === 'polygon' && JSON.stringify(command.points) === JSON.stringify(wholeFloor));
    const firstActorDetail = frame.commands.findIndex(command => command.kind === 'ellipse' && command.radiusX < frame.camera.scale / 2);
    expect(floorTop).toBeGreaterThan(0); expect(floorTop).toBeLessThan(firstActorDetail);
  });

  it('paints the bench lifter over the pad instead of hiding their torso under a long surface', () => {
    const input = opening(); const frame = buildGymSceneFrame(input, createSceneCamera(floorGridSize(input.context.rung), { width: 390, height: 440 }));
    const firstShirt = frame.commands.findIndex(command => command.kind === 'polygon' && typeof command.fill === 'object' && command.fill.stops[0]?.color === SCENE_PALETTE.clothLight);
    const padSurfaces = frame.commands.map((command, index) => command.kind === 'polygon' && typeof command.fill === 'object' && command.fill.stops[0]?.color === SCENE_PALETTE.padLight ? index : -1);
    expect(firstShirt).toBeGreaterThan(Math.max(...padSurfaces));
    expect(Math.max(...padSurfaces)).toBeGreaterThan(0);
  });

  it('represents capacity as a separate bench and attaches each user to its own physical seat', () => {
    const base = opening();
    const context: FloorSimContext = { ...base.context, capability: { 'competition-bench-bay': { quality: 0, capacity: 1, throughput: 0 } } };
    const station = floorStations(context).find(row => row.ref.kind === 'training')!;
    expect(station.useCells).toHaveLength(2);
    const members = station.useCells.map((cell, index) => ({ ...base.sim.members[index]!, state: 'using' as const, cell, next: null, target: station.ref, targetPosition: station.position }));
    const frame = buildGymSceneFrame({ ...base, context, sim: { ...base.sim, members } }, createSceneCamera(floorGridSize(context.rung), { width: 390, height: 440 }));
    const benches = frame.entities.filter(entity => entity.item === 'flat-bench');
    const actors = frame.entities.filter(entity => entity.kind === 'member');
    expect(benches).toHaveLength(2); expect(actors).toHaveLength(2); expect(frame.counts.training).toBe(2);
    expect(benches.map(entity => entity.source).sort()).toEqual(['expansion', 'primary']);
    expect(actors[0]!.position).not.toEqual(actors[1]!.position);
  });

  it.each([0, 90, 180, 270] as const)('rotates equipment and station-specific rower contacts through %s degrees', rotation => {
    const floor = { ...createFloorState('garage'), furniture: {} };
    const placed = placeFloorItem(floor, ['rower'], 'rower', { x: 2, y: 0, rotation });
    expect(placed.kind).toBe('placed');
    const context = withAmbientLivingPopulation({ rung: 'garage', floor: placed.state, barbellOwned: [], sessionOwned: ['rower'], capability: {} });
    const sim = createFloorSimState(context, 1); const station = floorStations(context)[0]!;
    const member: FloorSimMember = { ...sim.members[0]!, state: 'using', cell: station.useCell, target: station.ref, targetPosition: station.position };
    const camera = createSceneCamera(floorGridSize('garage'), { width: 390, height: 440 });
    const frame = buildGymSceneFrame({ context, sim: { ...sim, members: [member] }, elapsedSeconds: 0, reducedMotion: true }, camera);
    const rower = frame.entities.find(entity => entity.item === 'rower')!;
    const actor = frame.entities.find(entity => entity.kind === 'member')!;
    expect(rower.rotation).toBe(rotation);
    const asset = EQUIPMENT_ASSETS.rower;
    const transform = equipmentTransform({ x: 2, y: 0 }, asset.size[0], asset.size[1], rotation);
    const left = STATION_POSES.rower.ankleL; const right = STATION_POSES.rower.ankleR;
    const midpoint = transform({ x: (left[0] + right[0]) / 2, y: (left[1] + right[1]) / 2, z: (left[2] + right[2]) / 2 });
    expect(actor.position.x).toBeCloseTo(midpoint.x, 9); expect(actor.position.y).toBeCloseTo(midpoint.y, 9);
    expect(hitTestScene(frame, projectWorld(camera, rower.position))?.id).toBe('rower');
    expect(hitTestScene(frame, { x: -100, y: -100 })).toBeNull();
    expectFinite(frame);
  });

  it('keeps preview commands separate and shows full validity footprint at the current orientation', () => {
    const input = opening(); const camera = createSceneCamera(floorGridSize(input.context.rung), { width: 390, height: 440 });
    const preview = { item: 'flat-bench' as const, position: { x: 5, y: 2 }, footprint: { width: 4, height: 2 }, rotation: 90 as const, valid: false };
    const frame = buildGymSceneFrame({ ...input, preview, build: true }, camera);
    expect(frame.entities.find(entity => entity.kind === 'preview')).toMatchObject({ rotation: 90, footprint: preview.footprint });
    const last = frame.commands.at(-1)!;
    expect(last.kind).toBe('line');
    if (last.kind === 'line') expect(last.points.slice(0, 4)).toEqual(projectedFootprint(camera, preview.position, preview.footprint));
    expectFinite(frame);
  });

  it('only displays staff when a manager is present in authoritative state', () => {
    const input = opening(); const camera = createSceneCamera(floorGridSize(input.context.rung), { width: 390, height: 440 });
    expect(buildGymSceneFrame(input, camera).counts.staff).toBe(0);
    const hired = { ...input, managed: { ...input.managed!, manager: { tier: EMPIRE_TUNING.MANAGER_TIERS[0], hiredUnderWarning: false } } };
    const frame = buildGymSceneFrame(hired, camera);
    expect(frame.counts.staff).toBe(1); expect(frame.entities.filter(entity => entity.kind === 'staff')).toHaveLength(1);
    expect(frame.counts.total).toBe(input.sim.members.length);
  });

  it.each([...EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS, ...EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS])('builds a finite and correctly bounded catalog preview for %s', item => {
    const frame = buildEquipmentPreview(item, { width: 180, height: 150 });
    expectFinite(frame); expect(frame.entities).toHaveLength(1); expect(frame.entities[0]!.item).toBe(item);
    const points = frame.commands.flatMap(command => command.kind === 'text' ? [command.position] : command.kind === 'ellipse' ? [command.center] : command.points);
    expect(Math.min(...points.map(point => point.x))).toBeGreaterThanOrEqual(0); expect(Math.max(...points.map(point => point.x))).toBeLessThanOrEqual(180);
    expect(Math.min(...points.map(point => point.y))).toBeGreaterThanOrEqual(0); expect(Math.max(...points.map(point => point.y))).toBeLessThanOrEqual(150);
  });
});
