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

import { LiftStage } from '../session/TrainingLiftStage';
import { useLiftLoop } from '../lift/useLiftLoop';
import {
  PRESS_NOT_SELECT,
  PRESS_NOT_TAKEN,
  PRESS_WITHOUT_DELAY,
  SUPPRESS_CONTEXT_MENU,
} from '../lift/pressGuard';
import { pressCommandIsLive, promptFor, type LiftResolution } from '../game/lift';
import { LIFT_COPY } from '../game/liftTuning';
import { ATTEMPTS_PER_LIFT } from '../game/meet';
import { MEET_COPY, MEET_LAYOUT, MEET_TUNING } from '../game/meetTuning';
import { attemptConfigFor, liveAttemptWeightText, meetCommandFor, type MeetDayState } from '../game/meetDay';
import { settledCrowdRisePx, walkoutRequestFor } from './walkout';
import { MEET_PALETTE } from './meetPalette';

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

  const command = meetCommandFor(loop.state);

  return (
    <View style={styles.root} testID="meet-attempt" {...SUPPRESS_CONTEXT_MENU}>
      <Pressable
        style={styles.stage}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        testID="attempt-touch"
        {...PRESS_WITHOUT_DELAY}
      >
        <LiftStage
          state={loop.state}
          history={loop.history}
          totalKg={live.weightKg}
          venue={MEET_TUNING.VENUE}
          crowdRisePx={crowdRisePx}
        />
        <View style={styles.hudScrim} pointerEvents="none" />
        <View style={styles.hud} pointerEvents="none">
          <Text style={styles.eyebrow} testID="attempt-label">
            {`${MEET_COPY.LIFT_LABEL[live.lift]} · ${MEET_COPY.ATTEMPT_LABEL} ${live.attemptNumber} ${MEET_COPY.ATTEMPT_OF} ${ATTEMPTS_PER_LIFT}`}
          </Text>
          <Text style={styles.weight} testID="attempt-weight">
            {liveAttemptWeightText(state)}
          </Text>
        </View>
        {command === null ? null : (
          <Text
            style={[styles.liveCommand, command.live ? styles.commandLive : null]}
            testID="meet-command"
          >
            {command.text}
          </Text>
        )}
        <View style={styles.commandScrim} pointerEvents="none" />
        <View style={styles.command} pointerEvents="none">
          <Text
            style={[
              styles.prompt,
              pressCommandIsLive(loop.state) ? styles.promptLive : null,
            ]}
            testID="attempt-prompt"
          >
            {resolution === null ? promptFor(loop.state) : resolution.headline}
          </Text>
          <Text style={styles.detail} testID="attempt-detail" numberOfLines={L.ATTEMPT_DETAIL_LINES}>
            {resolution === null || resolution.detail === ''
              ? LIFT_COPY.SUBTITLE[loop.state.config.kind]
              : resolution.detail}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...PRESS_NOT_SELECT,
  },
  hudScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: L.HALL_HUD_HEIGHT,
    backgroundColor: MEET_PALETTE.CARD,
    opacity: L.HALL_HUD_SCRIM,
  },
  hud: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: L.HALL_HUD_HEIGHT,
    paddingHorizontal: L.HALL_HUD_PAD,
    gap: L.ROW_GAP,
  },
  eyebrow: {
    color: MEET_PALETTE.AMBER,
    fontSize: L.EYEBROW_FONT,
    letterSpacing: L.LETTER_SPACING,
    fontWeight: '700',
  },
  weight: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.SUBHEAD_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  prompt: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.HEADLINE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
  },
  promptLive: {
    color: MEET_PALETTE.AMBER,
  },
  detail: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    textAlign: 'center',
  },
  liveCommand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: L.HALL_COMMAND_HEIGHT,
    color: MEET_PALETTE.TEXT,
    fontSize: L.COMMAND_FONT,
    fontWeight: '800',
    letterSpacing: L.WIDE_LETTER_SPACING,
    textAlign: 'center',
  },
  commandLive: {
    color: MEET_PALETTE.AMBER,
    fontSize: L.COMMAND_LIVE_FONT,
  },
  commandScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: L.HALL_COMMAND_HEIGHT,
    backgroundColor: MEET_PALETTE.CARD,
    opacity: L.HALL_COMMAND_SCRIM,
  },
  command: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: L.HALL_COMMAND_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: L.ROW_GAP / 2,
    paddingHorizontal: L.HALL_HUD_PAD,
  },
  stage: {
    flex: 1,
    alignSelf: 'stretch',
    ...PRESS_NOT_TAKEN,
  },
});
