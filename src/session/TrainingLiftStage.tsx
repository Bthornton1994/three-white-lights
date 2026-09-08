/**
 * TrainingLiftStage — Session A live-set picture (Claude Code owns this).
 *
 * Squat currently mounts the rejected Skia schematic (`SquatScene`) as a
 * leftover debug path. It is NOT the production athlete. Do not generalize
 * it to bench or deadlift. Bind new rendering to `liftPresentation`, not to
 * joint layout in `squatVisual`.
 *
 * Meet Day keeps `src/lift/LiftStage.tsx`.
 *
 * Exported as `LiftStage` so the press-surface walk in `liftInput.test.ts`
 * still finds a stage inside `SetView`.
 */
import React, { Suspense } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { SESSION_PALETTE } from './sessionPalette';
import type { LiftStageProps } from '../lift/LiftStage';
import { ironAmberCropShift, ironAmberPlateFor, type IronAmberPlateId } from './ironAmberPlates';
import { IRON_AMBER } from '../game/sessionTuning';
import { ATHLETE_RIG } from '../art/spriteTuning';
import { SquatScene } from './SquatScene';

// THE PLAYER-PATH GATE. `ATHLETE_RIG.TRAINING_STAGE` decides what the
// training squat draws; it reads `'schematic'` until the athlete asset has
// passed every intake step (`docs/design/ATHLETE-ASSET-PIPELINE.md` §12a).
// The athlete stage is a DYNAMIC import so the Rive runtime stays off the
// player bundle while the gate is closed — a static import would carry it
// for nothing. Metro resolves the bare specifier per platform; `tsc` reads
// `AthleteStage.d.ts`.
const AthleteStageLazy = React.lazy(async () => {
  const mod = await import('./AthleteStage');
  return { default: mod.AthleteStage };
});

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
    if (ATHLETE_RIG.TRAINING_STAGE === 'athlete') {
      return (
        <Suspense fallback={<View style={styles.canvas} testID="iron-amber-stage" />}>
          <AthleteStageLazy {...props} />
        </Suspense>
      );
    }
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
