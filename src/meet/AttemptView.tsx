/**
 * AttemptView — the attempt itself, played on the mechanic that already exists.
 *
 * GDD §6.2 step 2: "Lift resolves through the Arcade bar-path mechanic."
 *
 * ---------------------------------------------------------------------------
 * NOTHING ABOUT THE REP IS REBUILT HERE
 * ---------------------------------------------------------------------------
 * `LiftStage` draws it, `useLiftLoop` clocks it and plays its haptics, and
 * `stepLift` decides it — exactly as `SetView` does for a training set. This
 * file adds two things a training rep does not need:
 *
 *   1. THE ATTEMPT. `useLiftLoop` is handed `attemptConfigFor(state)`, so the
 *      bar is the weight the lifter declared and the timing window is whatever
 *      `fatigue.ts` made it for this point in the meet (GDD §6.2 step 3).
 *   2. WHERE THEY ARE. Which lift, which attempt, and what is on the bar.
 *
 * ---------------------------------------------------------------------------
 * ONE REP, AND NO SECOND CHANCE
 * ---------------------------------------------------------------------------
 * A training set restarts the mechanic between reps. An attempt does not: the
 * rep resolves, and its outcome goes to the judges. There is no retry button on
 * this screen and no way back to it, because a competition attempt is one
 * attempt — that is the whole difference between meet day and a session, and
 * it is what the walkout beat before it is dread ABOUT.
 *
 * NO MECHANIC LOGIC AND NO FATIGUE READOUT (GDD §3.4, §12.3). Nothing here
 * computes a window, judges an outcome or displays a level.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LiftStage } from '../lift/LiftStage';
import { useLiftLoop } from '../lift/useLiftLoop';
import { promptFor, type LiftResolution } from '../game/lift';
import { LIFT_COPY, LIFT_TUNING } from '../game/liftTuning';
import { ATTEMPTS_PER_LIFT } from '../game/meet';
import { MEET_COPY, MEET_LAYOUT } from '../game/meetTuning';
import { attemptConfigFor, type MeetDayState } from '../game/meetDay';
import { formatWeight } from '../game/resultCard';
import { MEET_PALETTE } from './meetPalette';

const L = MEET_LAYOUT;

export interface AttemptViewProps {
  readonly state: MeetDayState;
  readonly onResolved: (resolution: LiftResolution) => void;
}

export function AttemptView({ state, onResolved }: AttemptViewProps): React.ReactElement {
  const live = state.live;
  // The config is a function of WHICH ATTEMPT THIS IS and nothing else.
  // Depending on the whole meet state would hand the loop a new object mid-rep
  // every time anything changed, which would reset the bar under the finger.
  const liftName = live === null ? null : live.lift;
  const attemptNumber = live === null ? null : live.attemptNumber;
  const config = useMemo(
    () => attemptConfigFor(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liftName, attemptNumber],
  );
  const loop = useLiftLoop(config);
  const { onPressIn, onPressOut } = loop;

  const resolution = loop.state.resolution;
  const resolved = loop.state.phase === 'RESOLVED';
  const handOff = useCallback(() => {
    if (resolution !== null) onResolved(resolution);
  }, [resolution, onResolved]);
  useEffect(() => {
    if (!resolved || resolution === null) return undefined;
    // Straight to the judges. The silence before the lights is
    // `MEET_TUNING.VERDICT_SILENCE_MS` and it is the verdict screen's, so this
    // hands off immediately rather than holding a second beat of its own.
    handOff();
    return undefined;
  }, [resolved, resolution, handOff]);

  if (live === null) return <View style={styles.root} />;

  return (
    <View style={styles.root} testID="meet-attempt">
      <View style={styles.header}>
        <Text style={styles.eyebrow} testID="attempt-label">
          {`${MEET_COPY.LIFT_LABEL[live.lift]} · ${MEET_COPY.ATTEMPT_LABEL} ${live.attemptNumber} ${MEET_COPY.ATTEMPT_OF} ${ATTEMPTS_PER_LIFT}`}
        </Text>
        <Text style={styles.weight} testID="attempt-weight">
          {`${formatWeight(live.weightKg)} kg`}
        </Text>
        <Text style={styles.prompt} testID="attempt-prompt">
          {resolution === null ? promptFor(loop.state) : resolution.headline}
        </Text>
        <Text style={styles.detail} testID="attempt-detail">
          {resolution === null || resolution.detail === '' ? LIFT_COPY.SUBTITLE : resolution.detail}
        </Text>
      </View>

      <Pressable
        style={styles.stage}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        testID="attempt-touch"
      >
        <LiftStage state={loop.state} history={loop.history} totalKg={live.weightKg} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    gap: L.ROW_GAP / 2,
    paddingVertical: L.ROW_GAP,
  },
  eyebrow: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.EYEBROW_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  weight: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.SUBHEAD_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  prompt: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.TITLE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  detail: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
  },
  stage: {
    width: LIFT_TUNING.LAYOUT.STAGE_W,
    height: LIFT_TUNING.LAYOUT.STAGE_H,
  },
});
