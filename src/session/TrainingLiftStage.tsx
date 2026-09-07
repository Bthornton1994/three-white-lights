/**
 * TrainingLiftStage — Iron & Amber plates on the daily session set.
 *
 * The played lift still comes from `useLiftLoop` / `stepLift`. This file only
 * replaces the training-path picture: owned illustrated gym stills instead of
 * the sprite raster. Meet Day keeps `src/lift/LiftStage.tsx`.
 *
 * The plate is the room. Skia draws command/cue rings and the grind pip row
 * the mechanic still needs on web — not the bar-path TRACE panel, which read
 * as a hole cut out of the picture.
 *
 * Exported as `LiftStage` so the press-surface walk in `liftInput.test.ts`
 * still finds a stage inside `SetView`.
 */
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Rect } from '@shopify/react-native-skia';

import { LIFT_TUNING } from '../game/liftTuning';
import { cueProgress } from '../game/lift';
import { LIFT_PALETTE } from '../lift/liftPalette';
import {
  commandHit,
  cuePulse,
  cueRing,
  grindReadout,
  hitFlash,
  stageArmed,
  stageShake,
} from '../lift/liftFrame';
import type { LiftStageProps } from '../lift/LiftStage';
import { SESSION_PALETTE } from './sessionPalette';
import { ironAmberCropShift, ironAmberPlateFor, type IronAmberPlateId } from './ironAmberPlates';
import { IRON_AMBER } from '../game/sessionTuning';

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
  const [box, setBox] = useState<{ w: number; h: number }>({ w: L.STAGE_W, h: L.STAGE_H });
  const plateId = ironAmberPlateFor(state.config.kind, state.phase, state.height);
  const ring = cueRing(cueProgress(state));
  const shake = stageShake(state);
  const flash = hitFlash(state);
  const pulse = cuePulse(state.tick);
  const lastTiming = state.timings[state.timings.length - 1];
  const hit = commandHit(state);
  const armed = stageArmed(state);
  const grind = grindReadout(state);
  const sx = box.w / L.STAGE_W;
  const cueX = box.w * IRON_AMBER.CUE_X_RATIO;
  const cueY = box.h * IRON_AMBER.CUE_Y_RATIO;
  const cropY = ironAmberCropShift(state.config.kind);

  return (
    <View
      style={[styles.canvas, { transform: [{ translateX: shake.dx }, { translateY: shake.dy }] }]}
      testID="iron-amber-stage"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setBox({ w: width, h: height });
      }}
    >
      <Image
        source={PLATE_SOURCE[plateId]}
        style={[
          styles.plate,
          {
            transform: [{ scale: IRON_AMBER.PLATE_SCALE }, { translateY: cropY }],
          },
        ]}
        resizeMode="cover"
        testID={`iron-amber-plate-${plateId}`}
      />
      <Canvas style={styles.overlay}>
        {hit === null ? null : (
          <Group>
            <Rect
              x={0}
              y={0}
              width={box.w}
              height={box.h}
              color={LIFT_PALETTE.COMMAND_FLASH}
              opacity={hit.washAlpha}
            />
            <Circle
              cx={cueX}
              cy={cueY}
              r={hit.ringRadius * sx}
              color={LIFT_PALETTE.COMMAND_RING}
              style="stroke"
              strokeWidth={F.STAGE_COMMAND.RING_STROKE}
              opacity={hit.amount}
            />
          </Group>
        )}

        {armed === null ? null : (
          <Circle
            cx={cueX}
            cy={cueY}
            r={F.STAGE_COMMAND.ARMED_RING_R * sx}
            color={LIFT_PALETTE.ARMED}
            style="stroke"
            strokeWidth={F.STAGE_COMMAND.ARMED_RING_STROKE}
            opacity={armed}
          />
        )}

        {ring === null ? null : (
          <Group>
            <Circle
              cx={cueX}
              cy={cueY}
              r={ring.targetRadius * sx}
              color={LIFT_PALETTE.CUE_TARGET}
              style="stroke"
              strokeWidth={1}
            />
            <Circle
              cx={cueX}
              cy={cueY}
              r={ring.radius * sx}
              color={ring.inPerfectBand ? LIFT_PALETTE.CUE_PERFECT : LIFT_PALETTE.CUE}
              style="stroke"
              strokeWidth={F.CUE_RING_STROKE}
              opacity={ring.inPerfectBand ? 1 : pulse}
            />
          </Group>
        )}

        {flash <= 0 || lastTiming === undefined ? null : (
          <Circle
            cx={cueX}
            cy={cueY}
            r={(F.CUE_RING_OUTER_R - (F.CUE_RING_OUTER_R - F.CUE_RING_INNER_R) * flash) * sx}
            color={
              lastTiming.grade === 'missed' ? LIFT_PALETTE.MISS : LIFT_PALETTE.CUE_PERFECT
            }
            style="stroke"
            strokeWidth={F.CUE_RING_STROKE}
            opacity={flash}
          />
        )}

        {grind === null ? null : (
          <Group>
            <Rect
              x={cueX - (grind.tray.w * sx) / 2}
              y={cueY + IRON_AMBER.GRIND_BELOW_CUE}
              width={grind.tray.w * sx}
              height={grind.tray.h * sx}
              color={LIFT_PALETTE.GRIND_TRAY}
            />
            {grind.pips.map((pip) => (
              <Rect
                key={pip.x}
                x={cueX - (grind.tray.w * sx) / 2 + (pip.x - grind.tray.x) * sx}
                y={
                  cueY +
                  IRON_AMBER.GRIND_BELOW_CUE +
                  (pip.y - grind.tray.y) * sx
                }
                width={pip.w * sx}
                height={pip.h * sx}
                color={pip.lit ? LIFT_PALETTE.GRIND_PIP_LIT : LIFT_PALETTE.GRIND_PIP_DIM}
              />
            ))}
          </Group>
        )}
      </Canvas>
    </View>
  );
}

/** The name `SetView` still mounts, so the lift press-surface census stays at 3. */
export { TrainingLiftStage as LiftStage };

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    alignSelf: 'stretch',
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
