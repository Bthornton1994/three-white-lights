import type { GridPosition, GridSize } from '../floor';
import type { ManagedEquipmentItem } from '../management';
import { pointInPolygon, unprojectFloor } from '../scene/camera';
import type { GymSceneFrame, SceneCamera, ScenePoint } from '../scene/types';
import { NATIVE_FACILITY_TUNING as T } from './nativeTuning';

export interface NativeSceneGesture {
  readonly mode: 'camera' | 'equipment' | 'tap';
  readonly origin: ScenePoint;
  readonly pan: ScenePoint;
  readonly offset: ScenePoint;
  readonly moved: boolean;
  readonly selectedOnFloor: boolean;
}

export interface NativeGestureOptions {
  readonly build: boolean;
  readonly cameraMode: boolean;
  readonly selected: ManagedEquipmentItem | null;
  readonly selectedFootprint: GridSize | null;
  readonly touches: number;
}

export function beginNativeGesture(frame: GymSceneFrame, point: ScenePoint, options: NativeGestureOptions): {
  readonly gesture: NativeSceneGesture;
  readonly selection: ManagedEquipmentItem | null;
} {
  const camera = options.cameraMode || options.touches > 1;
  const hit = camera ? undefined : [...frame.entities].reverse().find(entity =>
    entity.kind === 'equipment' && entity.source !== 'expansion' && pointInPolygon(point, entity.hitPolygon));
  const world = unprojectFloor(frame.camera, point);
  const equipment = !camera && options.build && (hit?.item !== undefined || options.selected !== null);
  return {
    selection: hit?.item ?? null,
    gesture: {
      mode: camera ? 'camera' : equipment ? 'equipment' : 'tap', origin: point,
      pan: frame.camera.pan, moved: false, selectedOnFloor: hit !== undefined,
      offset: hit ? { x: world.x - hit.position.x + (hit.footprint?.width ?? 0) / 2, y: world.y - hit.position.y + (hit.footprint?.height ?? 0) / 2 }
        : { x: (options.selectedFootprint?.width ?? 0) / 2, y: (options.selectedFootprint?.height ?? 0) / 2 },
    },
  };
}

function snappedPreview(camera: SceneCamera, point: ScenePoint, offset: ScenePoint): GridPosition {
  const world = unprojectFloor(camera, point);
  return { x: Math.round(world.x - offset.x), y: Math.round(world.y - offset.y) };
}

export function moveNativeGesture(gesture: NativeSceneGesture, camera: SceneCamera, delta: ScenePoint, touches: number): {
  readonly gesture: NativeSceneGesture;
  readonly preview: GridPosition | null;
  readonly pan: ScenePoint | null;
} {
  const mode: NativeSceneGesture['mode'] = gesture.mode === 'camera' || touches > 1 ? 'camera' : gesture.mode;
  if (Math.hypot(delta.x, delta.y) < T.DRAG_THRESHOLD_PX) {
    return { gesture: mode === gesture.mode ? gesture : { ...gesture, mode }, preview: null, pan: null };
  }
  const next = { ...gesture, mode, moved: true };
  return {
    gesture: next,
    pan: mode === 'camera' ? { x: gesture.pan.x + delta.x, y: gesture.pan.y + delta.y } : null,
    preview: mode === 'equipment' ? snappedPreview(camera, { x: gesture.origin.x + delta.x, y: gesture.origin.y + delta.y }, gesture.offset) : null,
  };
}

export function finishNativeGesture(gesture: NativeSceneGesture, camera: SceneCamera, point: ScenePoint): GridPosition | null {
  if (gesture.mode !== 'equipment' || (gesture.selectedOnFloor && !gesture.moved)) return null;
  return snappedPreview(camera, point, gesture.offset);
}
