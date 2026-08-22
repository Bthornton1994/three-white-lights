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
 *   3. WHICH BUILDING THEY ARE IN. `LiftStage` takes a venue and this screen
 *      passes `MEET_TUNING.VENUE`, so the room behind the lifter is the meet
 *      platform — crowd, sponsor banner, judges' table — and not the training
 *      gym a Sim set is drawn in. Every other screen omits the prop and gets
 *      the gym. This is one prop and it is the difference between a competition
 *      attempt and a heavy single in your own gym.
 *   4. AND WHETHER THAT BUILDING IS ON ITS FEET.
 *
 * ---------------------------------------------------------------------------
 * (4) IS NEW, AND IT IS THE ESCALATION THIS SCREEN USED TO THROW AWAY
 * ---------------------------------------------------------------------------
 * `crowdRiseAt` takes the hall from 0 to `CROWD.WALKOUT_RISE_PX` through the
 * walk-out and on to `WALKOUT_TAIL.HUSH_CROWD_RISE_PX` across the BRACE window,
 * and holds it there for the hush. That ramp is the only channel by which GDD
 * §6.2's escalation reaches the picture at all — the other two are sound and
 * haptics, which nobody in this environment can check.
 *
 * This screen handed `LiftStage` no rise, `gymScene.ts` reads
 * `spec.crowdRisePx ?? 0`, and `MeetScreen` swaps the two views in one frame
 * with no crossfade. So on the attempts §12.2 names the hall rose, rose
 * further, held still for the hush — and then sat back down on the frame the
 * bar started moving. Measured on the shipped band: 1,633 of the composite's
 * 22,490 scene pixels changed at that cut, 1,306 of them outside the bar-path
 * panel and therefore visible.
 *
 * WHERE THE NUMBER COMES FROM. `settledCrowdRisePx` reads it off the walk-out
 * sheet's last drawn frame, through the same `walkoutRequestFor` the walk-out
 * itself is built from, so the rep cannot be drawn in a hall the walk-out never
 * reached. Nothing about the rise is computed here.
 *
 * IT SAYS NOTHING ABOUT THE LIFTER (GDD §3.4, §12.3). The rise is a function of
 * `isUrgentAttempt` — a third, a PR, or one with a bomb on it — which are facts
 * printed on the screen the player just left. It does not read readiness,
 * fatigue, load or the seed, and it is one number for the whole rep rather than
 * a channel that moves while the bar does, so there is nothing in it to read as
 * live feedback. `walkout.test.ts` sweeps that rather than promising it.
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
import { PRESS_NOT_SELECT, PRESS_NOT_TAKEN, SUPPRESS_CONTEXT_MENU } from '../lift/pressGuard';
import { pressCommandIsLive, promptFor, type LiftResolution } from '../game/lift';
import { LIFT_COPY, LIFT_TUNING } from '../game/liftTuning';
import { ATTEMPTS_PER_LIFT } from '../game/meet';
import { MEET_COPY, MEET_LAYOUT, MEET_TUNING } from '../game/meetTuning';
import { attemptConfigFor, liveAttemptWeightText, type MeetDayState } from '../game/meetDay';
import { settledCrowdRisePx, walkoutRequestFor } from './walkout';
import { MEET_PALETTE } from './meetPalette';
import { LIFT_PALETTE } from '../lift/liftPalette';

const L = MEET_LAYOUT;

export interface AttemptViewProps {
  readonly state: MeetDayState;
  /**
   * What the bar and collars weigh on their own, kg — the meet's own number.
   *
   * SUPPLIED BY THE ROUTER, exactly as it is to `WalkoutView` and `VerdictView`,
   * and from the same `meetLoadingRules(state.meet)` call. It is here so the
   * hall this rep is drawn in can be derived from the same walk-out request the
   * beat before it was built from; deriving it in this file would put
   * `meetLoadingRules` and a plate count inside a `.tsx`.
   */
  readonly barAndCollarsKg: number;
  readonly onResolved: (resolution: LiftResolution) => void;
}

export function AttemptView({
  state,
  barAndCollarsKg,
  onResolved,
}: AttemptViewProps): React.ReactElement {
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

  // WHAT THE WALK-OUT LEFT THE HALL AT. One number for the whole rep, read off
  // the walk-out's own sheet rather than restated, and memoised on the attempt
  // so the room is rastered once and not once per tick.
  const crowdRisePx = useMemo(
    () =>
      live === null
        ? 0
        : settledCrowdRisePx(walkoutRequestFor(live, barAndCollarsKg, live.loadRatio)),
    [live, barAndCollarsKg],
  );

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
    <View style={styles.root} testID="meet-attempt" {...SUPPRESS_CONTEXT_MENU}>
      <View style={styles.copy}>
      <View style={styles.header}>
        <Text style={styles.eyebrow} testID="attempt-label">
          {`${MEET_COPY.LIFT_LABEL[live.lift]} · ${MEET_COPY.ATTEMPT_LABEL} ${live.attemptNumber} ${MEET_COPY.ATTEMPT_OF} ${ATTEMPTS_PER_LIFT}`}
        </Text>
        <Text style={styles.weight} testID="attempt-weight">
          {/*
            THE UNIT COMES OFF THE MEET, NOT OFF THIS FILE. This line used to be
            `${formatWeight(live.weightKg)} kg` — a suffix typed here, over a
            number this screen cannot know the unit of, on a platform `meet.ts`
            will happily run under `POUND_MEET_RULES`. `liveAttemptWeightText`
            reads `meetLoadingRules(state.meet).unit`, which is the meet's own
            answer.
          */}
          {liveAttemptWeightText(state)}
        </Text>
        <Text
          style={[
            styles.prompt,
            pressCommandIsLive(loop.state)
              ? {
                  fontSize: LIFT_TUNING.LAYOUT.HEADLINE_FONT,
                  color: LIFT_PALETTE.CUE_PERFECT,
                }
              : null,
          ]}
          testID="attempt-prompt"
        >
          {resolution === null ? promptFor(loop.state) : resolution.headline}
        </Text>
        <Text style={styles.detail} testID="attempt-detail">
          {resolution === null || resolution.detail === ''
            ? LIFT_COPY.SUBTITLE[loop.state.config.kind]
            : resolution.detail}
        </Text>
      </View>
      </View>

      <Pressable
        style={styles.stage}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        testID="attempt-touch"
      >
        <LiftStage
          state={loop.state}
          history={loop.history}
          totalKg={live.weightKg}
          venue={MEET_TUNING.VENUE}
          crowdRisePx={crowdRisePx}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    // THE HALL IS PINNED TO THE BOTTOM OF THE FRAME, on this screen and on every
    // other staged beat. Before this the stage sat directly under the header and
    // the bottom 29% of the screen was flat black under the room's own floor —
    // measured off `live-attempt.png`, 244 of 844 points. Now the platform is on
    // the floor of the phone and the copy is centred in what is left, which is
    // the same shape `WalkoutView` and `VerdictView` use, so the player's eye
    // lands in the same place across all three beats.
    justifyContent: 'flex-end',
    // The INHERITED half, on the root so it reaches the copy — see
    // `src/lift/pressGuard.ts`. On the stage it would reach only the Skia
    // canvas, where no selection is possible in the first place.
    ...PRESS_NOT_SELECT,
  },
  copy: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    maxHeight: LIFT_TUNING.LAYOUT.STAGE_H,
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
    // The half that does NOT inherit, so it has to be here, on the element the
    // press lands in. Without it this Pressable computes `touch-action:
    // manipulation` and 20px of finger drift hands the attempt to the browser —
    // and a meet attempt is one attempt (GDD §6.2), so there is no retry.
    ...PRESS_NOT_TAKEN,
  },
});
