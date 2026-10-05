import { describe, expect, it } from 'vitest';
import { createSceneCamera, projectWorld, projectedFootprint } from '../scene/camera';
import type { GymSceneFrame } from '../scene/types';
import { beginNativeGesture, finishNativeGesture, moveNativeGesture, type NativeGestureOptions } from './nativeGesture';

const camera = createSceneCamera({ width: 12, height: 10 }, { width: 390, height: 430 });
const bench = { x: 2, y: 3 };
const footprint = { width: 3, height: 1 };
const frame: GymSceneFrame = {
  camera, commands: [], tick: 72,
  counts: { total: 0, training: 0, waiting: 0, walking: 0, leaving: 0, interrupted: 0, stranded: 0, staff: 0 },
  entities: [{ id: 'bench', kind: 'equipment', item: 'flat-bench', position: { x: bench.x + footprint.width / 2, y: bench.y + footprint.height / 2 }, footprint,
    hitPolygon: projectedFootprint(camera, bench, footprint), depth: 6, label: 'Competition bench', source: 'primary' }],
};
const options: NativeGestureOptions = { build: true, cameraMode: false, selected: null, selectedFootprint: null, touches: 1 };

describe('native direct world manipulation', () => {
  it('selects an equipment tap without creating or rounding a layout draft', () => {
    const point = projectWorld(camera, { x: bench.x + 0.25, y: bench.y + 0.4 });
    const started = beginNativeGesture(frame, point, options);
    expect(started.selection).toBe('flat-bench');
    expect(started.gesture.mode).toBe('equipment');
    expect(finishNativeGesture(started.gesture, camera, point)).toBeNull();
  });

  it('keeps the grab offset while dragging an existing item through the same projection', () => {
    const point = projectWorld(camera, { x: bench.x + 0.25, y: bench.y + 0.4 });
    const destination = projectWorld(camera, { x: 7.25, y: 5.4 });
    const started = beginNativeGesture(frame, point, options);
    const moved = moveNativeGesture(started.gesture, camera, { x: destination.x - point.x, y: destination.y - point.y }, 1);
    expect(moved.preview).toEqual({ x: 7, y: 5 });
    expect(moved.pan).toBeNull();
    expect(finishNativeGesture(moved.gesture, camera, destination)).toEqual({ x: 7, y: 5 });
  });

  it('centers stored equipment using its rotated footprint on empty-floor taps and drags', () => {
    const rotated = { width: 1, height: 3 };
    const point = projectWorld(camera, { x: 6.5, y: 6.5 });
    const started = beginNativeGesture(frame, point, { ...options, selected: 'flat-bench', selectedFootprint: rotated });
    expect(started.selection).toBeNull();
    expect(started.gesture.offset).toEqual({ x: 0.5, y: 1.5 });
    expect(finishNativeGesture(started.gesture, camera, point)).toEqual({ x: 6, y: 5 });
    const destination = projectWorld(camera, { x: 8.5, y: 4.5 });
    expect(moveNativeGesture(started.gesture, camera, { x: destination.x - point.x, y: destination.y - point.y }, 1).preview).toEqual({ x: 8, y: 3 });
  });

  it('gives camera mode and two-finger gestures priority over equipment selection and placement', () => {
    const point = projectWorld(camera, { x: 2.5, y: 3.5 });
    for (const setting of [{ cameraMode: true, touches: 1 }, { cameraMode: false, touches: 2 }]) {
      const started = beginNativeGesture(frame, point, { ...options, ...setting });
      expect(started.selection).toBeNull();
      const moved = moveNativeGesture(started.gesture, camera, { x: 20, y: -15 }, setting.touches);
      expect(moved.pan).toEqual({ x: 20, y: -15 });
      expect(moved.preview).toBeNull();
      expect(finishNativeGesture(moved.gesture, camera, point)).toBeNull();
    }
  });

  it('switches to camera handling when a second finger arrives and stays there on release', () => {
    const point = projectWorld(camera, { x: 2.5, y: 3.5 });
    const started = beginNativeGesture(frame, point, options);
    const switched = moveNativeGesture(started.gesture, camera, { x: 1, y: 1 }, 2);
    expect(switched.gesture.mode).toBe('camera');
    const moved = moveNativeGesture(switched.gesture, camera, { x: 20, y: 10 }, 1);
    expect(moved.pan).toEqual({ x: 20, y: 10 });
    expect(moved.preview).toBeNull();
    expect(finishNativeGesture(moved.gesture, camera, point)).toBeNull();
  });

  it('ignores touch jitter and does not move equipment from the viewing page', () => {
    const point = projectWorld(camera, { x: 2.5, y: 3.5 });
    const started = beginNativeGesture(frame, point, options);
    expect(moveNativeGesture(started.gesture, camera, { x: 1, y: 1 }, 1).preview).toBeNull();
    const viewing = beginNativeGesture(frame, point, { ...options, build: false });
    expect(viewing.selection).toBe('flat-bench');
    expect(moveNativeGesture(viewing.gesture, camera, { x: 40, y: 20 }, 1).preview).toBeNull();
    expect(finishNativeGesture(viewing.gesture, camera, point)).toBeNull();
  });

  it('does not select an expansion seat as an independently movable purchased item', () => {
    const expansion: GymSceneFrame = { ...frame, entities: [{ ...frame.entities[0]!, source: 'expansion' }] };
    const point = projectWorld(camera, { x: 2.5, y: 3.5 });
    expect(beginNativeGesture(expansion, point, options).selection).toBeNull();
  });
});
