/**
 * TrainingLiftStage — Iron & Amber plates on the daily session set.
 *
 * The played lift still comes from `useLiftLoop` / `stepLift`. This file only
 * replaces the training-path picture: owned gym stills instead of the sprite
 * raster. Meet Day's attempt mounts this same stage. The A0 sprite file stays
 * at `src/lift/LiftStage.tsx`.
 *
 * The plate is the room. Skia draws only the command and cue rings the
 * mechanic still needs on web (GDD §6.2) — not the bar-path TRACE panel, which
 * reads as a hole cut out of the photograph.
 *
 * Exported as `LiftStage` so the press-surface walk in `liftInput.test.ts`
 * still finds a stage inside `SetView` and `AttemptView`. `src/lift/LiftStage.tsx`
 * remains the A0 sprite harness.
 */
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Rect } from '@shopify/react-native-skia';

import { LIFT_TUNING } from '../game/liftTuning';
import { cueProgress } from '../game/lift';
import { IRON_AMBER, SESSION_COPY } from '../game/sessionTuning';
import {
  commandHit,
  cuePulse,
  cueRing,
  hitFlash,
  stageArmed,
} from '../lift/liftFrame';
import type { LiftStageProps } from '../lift/LiftStage';
import { SESSION_PALETTE } from './sessionPalette';
import { ironAmberPlateFor, ironAmberPlateLayout, type IronAmberPlateId } from './ironAmberPlates';

import squatBrace from '../../assets/iron-amber/squat-brace.jpg';
import squatHole from '../../assets/iron-amber/squat-hole.jpg';
import squatDrive from '../../assets/iron-amber/squat-drive.jpg';
import benchBrace from '../../assets/iron-amber/bench-brace.jpg';
import benchChest from '../../assets/iron-amber/bench-chest.jpg';
import benchPress from '../../assets/iron-amber/bench-press.jpg';
import deadliftFloor from '../../assets/iron-amber/deadlift-floor.jpg';
import deadliftKnee from '../../assets/iron-amber/deadlift-knee.jpg';
import deadliftLockout from '../../assets/iron-amber/deadlift-lockout.jpg';

const STAGE = LIFT_TUNING.LAYOUT;
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
  crowdRisePx = 0,
}: LiftStageProps): React.ReactElement {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const plateId = ironAmberPlateFor(state.config.kind, state.phase, state.height);
  const plateLayout = ironAmberPlateLayout(
    state.config.kind,
    box.width,
    box.height,
    crowdRisePx,
  );
  const ring = cueRing(cueProgress(state));
  const flash = hitFlash(state);
  const pulse = cuePulse(state.tick);
  const lastTiming = state.timings[state.timings.length - 1];
  const hit = commandHit(state);
  const armed = stageArmed(state);
  const cueX = box.width * IRON_AMBER.CUE_X_RATIO;
  const cueY = box.height * IRON_AMBER.CUE_Y_RATIO;
  const scale = box.width <= 0 ? 0 : box.width / STAGE.STAGE_W;
  const riseWash = crowdRisePx * IRON_AMBER.HALL_RISE_WASH;

  return (
    <View
      style={styles.canvas}
      testID="iron-amber-stage"
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        setBox({ width: next.width, height: next.height });
      }}
    >
      {box.width <= 0 ? null : (
      <Image
        source={PLATE_SOURCE[plateId]}
        style={[
          styles.plate,
          {
            width: plateLayout.width,
            height: plateLayout.height,
            left: plateLayout.left,
            top: plateLayout.top,
          },
        ]}
        resizeMode="stretch"
        accessibilityRole="image"
        accessibilityLabel={SESSION_COPY.LIFT_LABEL[state.config.kind]}
        testID={`iron-amber-plate-${plateId}`}
      />
      )}
      {riseWash <= 0 ? null : (
        <View
          style={[styles.wash, { opacity: riseWash }]}
          pointerEvents="none"
          testID="iron-amber-hall-rise"
        />
      )}
      {box.width <= 0 ? null : (
        <Canvas style={styles.overlay}>
          {hit === null ? null : (
            <Group>
              <Rect
                x={0}
                y={0}
                width={box.width}
                height={box.height}
                color={SESSION_PALETTE.COMMAND_FLASH}
                opacity={hit.washAlpha}
              />
              <Circle
                cx={cueX}
                cy={cueY}
                r={hit.ringRadius * scale}
                color={SESSION_PALETTE.COMMAND_RING}
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
              r={F.STAGE_COMMAND.ARMED_RING_R * scale}
              color={SESSION_PALETTE.PLATE_ARMED}
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
                r={ring.targetRadius * scale}
                color={SESSION_PALETTE.PLATE_CUE_TARGET}
                style="stroke"
                strokeWidth={IRON_AMBER.CUE_TARGET_STROKE}
              />
              <Circle
                cx={cueX}
                cy={cueY}
                r={ring.radius * scale}
                color={ring.inPerfectBand ? SESSION_PALETTE.PLATE_CUE_PERFECT : SESSION_PALETTE.PLATE_CUE}
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
              r={
                (F.CUE_RING_OUTER_R - (F.CUE_RING_OUTER_R - F.CUE_RING_INNER_R) * flash) *
                scale
              }
              color={lastTiming.grade === 'missed' ? SESSION_PALETTE.MISS : SESSION_PALETTE.PLATE_CUE_PERFECT}
              style="stroke"
              strokeWidth={F.CUE_RING_STROKE}
              opacity={flash}
            />
          )}
        </Canvas>
      )}
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
    position: 'absolute',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  wash: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: SESSION_PALETTE.AMBER,
  },
});
