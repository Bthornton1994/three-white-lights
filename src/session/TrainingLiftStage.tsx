/**
 * TrainingLiftStage — Session A live-set picture.
 *
 * Squat is the continuous Iron & Amber rig (`SquatScene`). Bench and deadlift
 * still use leftover stills until those slices get the same architecture.
 * Meet Day keeps `src/lift/LiftStage.tsx`.
 *
 * Exported as `LiftStage` so the press-surface walk in `liftInput.test.ts`
 * still finds a stage inside `SetView`.
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { SESSION_PALETTE } from './sessionPalette';
import type { LiftStageProps } from '../lift/LiftStage';
import { ironAmberCropShift, ironAmberPlateFor, type IronAmberPlateId } from './ironAmberPlates';
import { IRON_AMBER } from '../game/sessionTuning';
import { SquatScene } from './SquatScene';

import benchBrace from '../../assets/iron-amber/bench-brace.jpg';
import benchChest from '../../assets/iron-amber/bench-chest.jpg';
import benchPress from '../../assets/iron-amber/bench-press.jpg';
import deadliftFloor from '../../assets/iron-amber/deadlift-floor.jpg';
import deadliftKnee from '../../assets/iron-amber/deadlift-knee.jpg';
import deadliftLockout from '../../assets/iron-amber/deadlift-lockout.jpg';

const PLATE_SOURCE: Record<
  Exclude<IronAmberPlateId, 'gym-briefing' | 'squat-brace' | 'squat-hole' | 'squat-drive'>,
  number
> = {
  'bench-brace': benchBrace,
  'bench-chest': benchChest,
  'bench-press': benchPress,
  'deadlift-floor': deadliftFloor,
  'deadlift-knee': deadliftKnee,
  'deadlift-lockout': deadliftLockout,
};

function StillPlateStage({ state }: LiftStageProps): React.ReactElement {
  const plateId = ironAmberPlateFor(state.config.kind, state.phase, state.height);
  const cropY = ironAmberCropShift(state.config.kind);
  const source =
    plateId === 'squat-brace' || plateId === 'squat-hole' || plateId === 'squat-drive'
      ? deadliftFloor
      : PLATE_SOURCE[plateId];

  return (
    <View style={styles.canvas} testID="iron-amber-stage">
      <Image
        source={source}
        style={[
          styles.plate,
          {
            transform: [{ scale: IRON_AMBER.PLATE_SCALE }, { translateY: cropY }],
          },
        ]}
        resizeMode="cover"
        testID={`iron-amber-plate-${plateId}`}
      />
    </View>
  );
}

export function TrainingLiftStage(props: LiftStageProps): React.ReactElement {
  if (props.state.config.kind === 'squat') {
    return <SquatScene {...props} />;
  }
  return <StillPlateStage {...props} />;
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
});
