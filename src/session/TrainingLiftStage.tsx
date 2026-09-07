/**
 * TrainingLiftStage — Iron & Amber plates on the daily session set.
 *
 * The played lift still comes from `useLiftLoop` / `stepLift`. This file only
 * replaces the training-path picture: owned gym stills instead of the sprite
 * raster. Meet Day keeps `src/lift/LiftStage.tsx`.
 *
 * The plate is the room. Skia draws only the command and cue rings the
 * mechanic still needs on web — not the bar-path panel, which reads as a hole
 * cut out of the photograph.
 *
 * Exported as `LiftStage` so the press-surface walk in `liftInput.test.ts`
 * still finds a stage inside `SetView`.
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Rect } from '@shopify/react-native-skia';

import { LIFT_TUNING } from '../game/liftTuning';
import { cueProgress } from '../game/lift';
import { LIFT_PALETTE } from '../lift/liftPalette';
import {
  commandHit,
  cuePulse,
  cueRing,
  hitFlash,
  stageArmed,
  stageShake,
} from '../lift/liftFrame';
import type { LiftStageProps } from '../lift/LiftStage';
import { SESSION_PALETTE } from './sessionPalette';
import { ironAmberPlateFor, type IronAmberPlateId } from './ironAmberPlates';

import squatBrace from '../../assets/iron-amber/squat-brace.jpg';
import squatHole from '../../assets/iron-amber/squat-hole.jpg';
import squatDrive from '../../assets/iron-amber/squat-drive.jpg';
import benchBrace from '../../assets/iron-amber/bench-brace.jpg';
import benchChest from '../../assets/iron-amber/bench-chest.jpg';
import benchPress from '../../assets/iron-amber/bench-press.jpg';
import deadliftFloor from '../../assets/iron-amber/deadlift-floor.jpg';
import deadliftKnee from '../../assets/iron-amber/deadlift-knee.jpg';
import deadliftLockout from '../../assets/iron-amber/deadlift-lockout.jpg';

const L = LIFT_TUNING.LAYOUT;
const F = LIFT_TUNING.FEEDBACK;

const PLATE_SOURCE: Record<Exclude<IronAmberPlateId, 'gym-briefing'>, number> = {
  'squat-brace': squatBrace,
  'squat-hole': squatHole,
  'squat-drive': squatDrive,
  'bench-brace': benchBrace,
  'bench-chest': benchChest,
  'bench-press': benchPress,
  'deadlift-floor': deadliftFloor,
  'deadlift-knee': deadliftKnee,
  'deadlift-lockout': deadliftLockout,
};

export function TrainingLiftStage({
  state,
}: LiftStageProps): React.ReactElement {
  const plateId = ironAmberPlateFor(state.config.kind, state.phase, state.height);
  const ring = cueRing(cueProgress(state));
  const shake = stageShake(state);
  const flash = hitFlash(state);
  const pulse = cuePulse(state.tick);
  const lastTiming = state.timings[state.timings.length - 1];
  const hit = commandHit(state);
  const armed = stageArmed(state);

  return (
    <View
      style={[styles.canvas, { transform: [{ translateX: shake.dx }, { translateY: shake.dy }] }]}
      testID="iron-amber-stage"
    >
      <Image
        source={PLATE_SOURCE[plateId]}
        style={styles.plate}
        resizeMode="cover"
        testID={`iron-amber-plate-${plateId}`}
      />
      <Canvas style={styles.overlay}>
        {hit === null ? null : (
          <Group>
            <Rect
              x={0}
              y={0}
              width={L.STAGE_W}
              height={L.STAGE_H}
              color={LIFT_PALETTE.COMMAND_FLASH}
              opacity={hit.washAlpha}
            />
            <Circle
              cx={L.CUE_X}
              cy={L.CUE_Y}
              r={hit.ringRadius}
              color={LIFT_PALETTE.COMMAND_RING}
              style="stroke"
              strokeWidth={F.STAGE_COMMAND.RING_STROKE}
              opacity={hit.amount}
            />
          </Group>
        )}

        {armed === null ? null : (
          <Circle
            cx={L.CUE_X}
            cy={L.CUE_Y}
            r={F.STAGE_COMMAND.ARMED_RING_R}
            color={LIFT_PALETTE.ARMED}
            style="stroke"
            strokeWidth={F.STAGE_COMMAND.ARMED_RING_STROKE}
            opacity={armed}
          />
        )}

        {ring === null ? null : (
          <Group>
            <Circle
              cx={L.CUE_X}
              cy={L.CUE_Y}
              r={ring.targetRadius}
              color={LIFT_PALETTE.CUE_TARGET}
              style="stroke"
              strokeWidth={1}
            />
            <Circle
              cx={L.CUE_X}
              cy={L.CUE_Y}
              r={ring.radius}
              color={ring.inPerfectBand ? LIFT_PALETTE.CUE_PERFECT : LIFT_PALETTE.CUE}
              style="stroke"
              strokeWidth={F.CUE_RING_STROKE}
              opacity={ring.inPerfectBand ? 1 : pulse}
            />
          </Group>
        )}

        {flash <= 0 || lastTiming === undefined ? null : (
          <Circle
            cx={L.CUE_X}
            cy={L.CUE_Y}
            r={F.CUE_RING_OUTER_R - (F.CUE_RING_OUTER_R - F.CUE_RING_INNER_R) * flash}
            color={
              lastTiming.grade === 'missed' ? LIFT_PALETTE.MISS : LIFT_PALETTE.CUE_PERFECT
            }
            style="stroke"
            strokeWidth={F.CUE_RING_STROKE}
            opacity={flash}
          />
        )}
      </Canvas>
    </View>
  );
}

/** The name `SetView` still mounts, so the lift press-surface census stays at 3. */
export { TrainingLiftStage as LiftStage };

const styles = StyleSheet.create({
  canvas: {
    width: L.STAGE_W,
    height: L.STAGE_H,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: SESSION_PALETTE.CARD,
  },
  plate: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
});
