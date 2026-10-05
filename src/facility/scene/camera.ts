import { SCENE_TUNING as T } from './sceneTuning';
import type { GridSize } from '../floor';
import type { SceneCamera, SceneCameraOptions, ScenePoint, WorldPoint } from './types';
import { ENVIRONMENT_STAGES } from './environmentData';
import type { LadderRung } from '../ladder';

export function createSceneCamera(grid: GridSize, viewport: GridSize, options: SceneCameraOptions = {}): SceneCamera {
  const zoom = Math.max(T.camera.minimumZoom, Math.min(T.camera.maximumZoom, options.zoom ?? T.camera.defaultZoom));
  const span = options.fitAll ? grid.width + grid.height : Math.min(grid.width + grid.height, T.camera.maximumVisibleSpan);
  const availableWidth = viewport.width - T.camera.padding * T.math.two;
  const availableHeight = viewport.height - T.camera.topReserve - T.camera.bottomReserve;
  const fitted = Math.min(availableWidth / span, availableHeight / (span * T.camera.floorSlope + T.camera.wallHeight * T.camera.verticalScale));
  const scale = Math.max(options.fitAll ? T.camera.minimumFitScale : T.camera.minimumScale, Math.min(T.camera.maximumScale, fitted)) * zoom;
  const focus = options.focus ?? (options.fitAll ? { x: grid.width / T.math.two, y: grid.height / T.math.two } : { x: Math.min(grid.width, T.camera.maximumVisibleSpan / T.math.two) / T.math.two, y: Math.min(grid.height, T.camera.maximumVisibleSpan / T.math.two) / T.math.two });
  const pan = options.pan ?? { x: T.math.zero, y: T.math.zero };
  return { grid, viewport, scale, floorSlope: T.camera.floorSlope, verticalScale: T.camera.verticalScale, focus, zoom, pan,
    origin: { x: viewport.width / T.math.two - (focus.x - focus.y) * scale + pan.x,
      y: T.camera.topReserve + availableHeight * (options.fitAll ? T.math.half : T.camera.focusFloorRatio) - (focus.x + focus.y) * scale * T.camera.floorSlope + (options.fitAll ? T.camera.wallHeight * T.camera.verticalScale * scale / T.math.two : T.math.zero) + pan.y } };
}

export function fitSceneCamera(grid: GridSize, viewport: GridSize, rung?: LadderRung): SceneCamera {
  const wallHeight = rung === undefined ? T.camera.wallHeight : ENVIRONMENT_STAGES[rung].wallHeight;
  const availableWidth = Math.max(T.math.epsilon, viewport.width - T.camera.padding * T.math.two);
  const availableHeight = Math.max(T.math.epsilon, viewport.height - T.camera.topReserve - T.camera.bottomReserve);
  const span = grid.width + grid.height;
  const scale = Math.min(availableWidth / span, availableHeight / (span * T.camera.floorSlope + wallHeight * T.camera.verticalScale));
  const focus = { x: grid.width / T.math.two, y: grid.height / T.math.two };
  return { grid, viewport, scale, focus, zoom: T.camera.defaultZoom, pan: { x: T.math.zero, y: T.math.zero }, floorSlope: T.camera.floorSlope, verticalScale: T.camera.verticalScale,
    origin: { x: viewport.width / T.math.two - (focus.x - focus.y) * scale,
      y: T.camera.topReserve + availableHeight / T.math.two - (focus.x + focus.y) * scale * T.camera.floorSlope + wallHeight * T.camera.verticalScale * scale / T.math.two } };
}

export function projectWorld(camera: SceneCamera, point: WorldPoint): ScenePoint {
  return { x: camera.origin.x + (point.x - point.y) * camera.scale,
    y: camera.origin.y + (point.x + point.y) * camera.scale * camera.floorSlope - (point.z ?? T.math.zero) * camera.scale * camera.verticalScale };
}

export function unprojectFloor(camera: SceneCamera, point: ScenePoint): ScenePoint {
  const difference = (point.x - camera.origin.x) / camera.scale;
  const sum = (point.y - camera.origin.y) / (camera.scale * camera.floorSlope);
  return { x: (sum + difference) / T.math.two, y: (sum - difference) / T.math.two };
}

export function projectedFootprint(camera: SceneCamera, position: ScenePoint, footprint: GridSize, z: number = T.math.zero): readonly ScenePoint[] {
  return [projectWorld(camera, { ...position, z }), projectWorld(camera, { x: position.x + footprint.width, y: position.y, z }),
    projectWorld(camera, { x: position.x + footprint.width, y: position.y + footprint.height, z }), projectWorld(camera, { x: position.x, y: position.y + footprint.height, z })];
}

export function pointInPolygon(point: ScenePoint, polygon: readonly ScenePoint[]): boolean {
  let inside = false;
  let prior = polygon.length - T.math.one;
  for (let index = T.math.zero; index < polygon.length; index += T.math.one) {
    const a = polygon[index]; const b = polygon[prior];
    if (a !== undefined && b !== undefined && (a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    prior = index;
  }
  return inside;
}
