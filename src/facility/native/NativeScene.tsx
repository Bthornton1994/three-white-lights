import React, { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Polygon, Polyline, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import type { GymSceneFrame, SceneCommand, ScenePaint, ScenePoint } from '../scene/types';
import type { GridPosition, GridSize } from '../floor';
import type { ManagedEquipmentItem } from '../management';
import { NATIVE_FACILITY_TUNING as T, NATIVE_FACILITY_PALETTE as P } from './nativeTuning';
import { beginNativeGesture, moveNativeGesture, finishNativeGesture, type NativeSceneGesture } from './nativeGesture';

type GradientPaint = Exclude<ScenePaint, string>;

interface NativeSceneProps {
  readonly frame: GymSceneFrame;
  readonly build: boolean;
  readonly cameraMode: boolean;
  readonly selected: ManagedEquipmentItem | null;
  readonly selectedFootprint: GridSize | null;
  readonly onSelect: (item: ManagedEquipmentItem) => void;
  readonly onPreview: (position: GridPosition) => void;
  readonly onPan: (point: ScenePoint) => void;
  readonly onDragging: (dragging: boolean) => void;
}

/** Render the shared projected commands through the native SVG implementation. */
export function NativeScene({ frame, build, cameraMode, selected, selectedFootprint, onSelect, onPreview, onPan, onDragging }: NativeSceneProps): React.ReactElement {
  const current = useRef({ frame, build, cameraMode, selected, selectedFootprint, onSelect, onPreview, onPan, onDragging });
  current.current = { frame, build, cameraMode, selected, selectedFootprint, onSelect, onPreview, onPan, onDragging };
  const gesture = useRef<NativeSceneGesture | null>(null);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant(event, state) {
      const c = current.current;
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      const started = beginNativeGesture(c.frame, point, { ...c, touches: state.numberActiveTouches });
      if (started.selection !== null) c.onSelect(started.selection);
      gesture.current = started.gesture;
      c.onDragging(true);
    },
    onPanResponderMove(event, state) {
      const c = current.current;
      const g = gesture.current;
      if (!g) return;
      const moved = moveNativeGesture(g, c.frame.camera, { x: state.dx, y: state.dy }, state.numberActiveTouches);
      gesture.current = moved.gesture;
      if (moved.pan !== null) c.onPan(moved.pan);
      if (moved.preview !== null) c.onPreview(moved.preview);
    },
    onPanResponderRelease(event) {
      const c = current.current;
      const g = gesture.current;
      const preview = g === null ? null : finishNativeGesture(g, c.frame.camera, { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY });
      if (preview !== null) c.onPreview(preview);
      gesture.current = null;
      c.onDragging(false);
    },
    onPanResponderTerminate() {
      gesture.current = null;
      current.current.onDragging(false);
    },
    onPanResponderTerminationRequest: () => false,
  }), []);

  const paints = useMemo(() => {
    const byKey = new Map<string, { id: string; paint: GradientPaint }>();
    for (const command of frame.commands) {
      const entries = [command.kind === 'line' ? undefined : command.fill, command.kind === 'text' ? undefined : command.stroke];
      for (const paint of entries) {
        if (paint === undefined || typeof paint === 'string') continue;
        const key = JSON.stringify(paint);
        if (!byKey.has(key)) byKey.set(key, { id: `native-gym-paint-${byKey.size}`, paint });
      }
    }
    return byKey;
  }, [frame.commands]);
  const paintValue = (paint?: ScenePaint): string => paint === undefined ? 'none' : typeof paint === 'string' ? paint : `url(#${paints.get(JSON.stringify(paint))!.id})`;
  const points = (values: readonly ScenePoint[]) => values.map(point => `${point.x},${point.y}`).join(' ');
  const draw = (command: SceneCommand, index: number): React.ReactElement => {
    const stroke = command.kind === 'text' ? undefined : paintValue(command.stroke);
    const style = { opacity: command.opacity, stroke, strokeWidth: command.lineWidth, pointerEvents: 'none' as const };
    if (command.kind === 'polygon') return <Polygon key={index} {...style} points={points(command.points)} fill={paintValue(command.fill)} />;
    if (command.kind === 'line') return <Polyline key={index} {...style} points={points(command.points)} fill="none" stroke={paintValue(command.stroke)} strokeLinecap="round" strokeLinejoin="round" />;
    if (command.kind === 'ellipse') return <Ellipse key={index} {...style} cx={command.center.x} cy={command.center.y} rx={command.radiusX} ry={command.radiusY} fill={paintValue(command.fill)} transform={command.rotation === undefined ? undefined : `rotate(${command.rotation * T.RADIANS_TO_DEGREES} ${command.center.x} ${command.center.y})`} />;
    return <SvgText key={index} {...style} x={command.position.x} y={command.position.y} fill={paintValue(command.fill)} fontSize={command.fontSize} fontFamily={command.fontFamily} fontWeight={command.weight} textAnchor={command.align === 'center' ? 'middle' : command.align === 'right' ? 'end' : 'start'} transform={command.rotation === undefined ? undefined : `rotate(${command.rotation * T.RADIANS_TO_DEGREES} ${command.position.x} ${command.position.y})`}>{command.text}</SvgText>;
  };
  return <View style={styles.root} {...responder.panHandlers} testID="native-facility-scene" accessibilityLabel="Living gym floor. Choose equipment in the inventory to move it." accessibilityRole="image">
    <Svg width="100%" height={frame.camera.viewport.height} viewBox={`0 0 ${frame.camera.viewport.width} ${frame.camera.viewport.height}`} pointerEvents="none">
      <Defs>{[...paints.values()].map(({ id, paint }) => paint.kind === 'linear-gradient'
        ? <LinearGradient key={id} id={id} gradientUnits="userSpaceOnUse" x1={paint.from.x} y1={paint.from.y} x2={paint.to.x} y2={paint.to.y}>{paint.stops.map((stop, i) => <Stop key={i} offset={stop.offset} stopColor={stop.color} />)}</LinearGradient>
        : <RadialGradient key={id} id={id} gradientUnits="userSpaceOnUse" cx={paint.center.x} cy={paint.center.y} rx={paint.radius} ry={paint.radius}>{paint.stops.map((stop, i) => <Stop key={i} offset={stop.offset} stopColor={stop.color} />)}</RadialGradient>)}</Defs>
      {frame.commands.map(draw)}
    </Svg>
  </View>;
}

const styles = StyleSheet.create({ root: { backgroundColor: P.ESPRESSO, overflow: 'hidden' } });
