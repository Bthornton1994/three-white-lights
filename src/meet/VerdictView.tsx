/**
 * VerdictView — GDD §6.2 steps 4 and 5.
 *
 * "Three-light judging call (red/white), with a brief 'judges deliberating'
 * beat on close calls" and "Depth cue or bar-speed replay clip as feedback".
 *
 * ---------------------------------------------------------------------------
 * THE DELIBERATION BEAT MUST NOT LEAK THE VERDICT
 * ---------------------------------------------------------------------------
 * The whole point of a "judges deliberating" beat is that the lifter does not
 * know. So this screen shows THE SAME THING for a close call and a clear one —
 * three dark lamps and the word DELIBERATING — and differs only in how long it
 * holds. `deliberationMs(deliberated)` decides that, and `DELIBERATION_MARGIN`
 * is deliberately set wider than the band that can actually produce a split, so
 * a long beat is not a tell either (see `meetTuning.ts`).
 *
 * Nothing on this screen is derived from `call.good` until the lights are
 * revealed. A colour, a word or a layout that changed early would hand the
 * verdict over before the referees do.
 *
 * ---------------------------------------------------------------------------
 * THE LIGHTS COME UP ONE AT A TIME, HEAD REFEREE FIRST
 * ---------------------------------------------------------------------------
 * Real panels light together; ours stagger, because a 2-1 revealed all at once
 * is a fact and a 2-1 revealed in sequence is a moment — for one beat the panel
 * reads 1-1 and the lifter does not know which way the third goes. That is a
 * deliberate divergence from the real sport in the direction §12.2's bar asks
 * for, and it is stated rather than hidden.
 *
 * ---------------------------------------------------------------------------
 * AND THEY CLACK
 * ---------------------------------------------------------------------------
 * Three white lights is the thing this game is named after, and until now it
 * was a fade with no physical event behind it in an app that vibrates during an
 * ordinary training rep. Each lamp now fires a clack and a haptic on the same
 * delay it comes up on, white and red differ in both, and the crowd reacts
 * after the last lamp — ON A GOOD LIFT ONLY. A no-lift gets silence, because a
 * real hall goes quiet and a fail buzzer is the opposite of what GDD §6.3 asks
 * this piece to feel like.
 *
 * NOTHING FIRED HERE LEAKS THE VERDICT EARLY: the deliberation beat is one soft
 * tick and no sound at all, identical whichever way the call went, and a lamp's
 * clack arrives exactly when that lamp's colour becomes visible — not before.
 *
 * NOBODY HAS HEARD OR FELT ANY OF IT. See `MEET_SOUND` in `meetTuning.ts`.
 *
 * ---------------------------------------------------------------------------
 * AND THE LIFTER IS STILL STANDING THERE
 * ---------------------------------------------------------------------------
 * Both beats used to be a black field with three circles on it. The wait for the
 * lights is the single tensest moment in the sport and ours had nowhere to
 * happen: the player left the hall the instant the rep ended and came back to it
 * for the next attempt. `MeetHallView` draws the same platform the rep was taken
 * on, held back under the lamps by `MEET_TUNING.HALL.JUDGING_SCRIM` so the
 * lights are the brightest thing on the screen, with the lifter on it and the
 * bar still loaded.
 *
 * ---------------------------------------------------------------------------
 * ...AND ON A GOOD LIFT, THE HALL GETS UP
 * ---------------------------------------------------------------------------
 * Three white lights is the thing this game is named after, and it was the
 * FLATTEST frame in the sequence: twenty-four rows of identical stamped
 * silhouettes that did not move when the panel came up all white. The seating
 * now stands (`MEET_TUNING.CROWD.CHEER_RISE_PX`), on the same delay the cheer
 * cue and the verdict haptic already fire on — AFTER THE LAST LAMP, so it
 * cannot leak the call, and ONLY on a good one, because a real hall goes quiet
 * on three reds and a crowd that reacted either way would be reacting to
 * nothing.
 *
 * That is the only thing about the room derived from the call, and it happens
 * strictly after the player has been told. During the deliberation beat the
 * hall is seated, identical whichever way the call went — which is the property
 * the top of this file is about.
 *
 * NO LOGIC HERE. Which lights, whether it was close, what the feedback line
 * says, and which cue and pattern a lamp gets, are all decided in `meetDay.ts`
 * and arrive as data.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { MEET_COPY, MEET_LAYOUT, MEET_TUNING } from '../game/meetTuning';
import { LIFT_TUNING } from '../game/liftTuning';
import {
  deliberationMs,
  isUrgentAttempt,
  lightRevealDelayMs,
  type MeetDayAttempt,
} from '../game/meetDay';
import { playBeat } from './meetFeedback';
import { JUDGE_COUNT, type JudgeLight } from '../game/meet';
import { formatWeight } from '../game/resultCard';
import { MeetHallView } from './MeetHallView';
import { MEET_PALETTE } from './meetPalette';
import { useHallStep } from './useHallStep';
import {
  buildHold,
  cheerCrowdRise,
  crowdRisePxAt,
  walkoutFrameAt,
  walkoutFrameIndexAt,
  type WalkoutFrame,
} from './walkout';

const L = MEET_LAYOUT;

/**
 * When the hall reacts: after the LAST referee's lamp, on the same delay the
 * cheer cue and the verdict haptic already use. Read from `meetDay.ts`'s own
 * schedule rather than restated, so a tuning pass on the light stagger moves
 * the crowd with it.
 */
function cheerDelayMs(): number {
  return lightRevealDelayMs(JUDGE_COUNT - 1) + MEET_TUNING.FEEDBACK_REVEAL_DELAY_MS;
}

/** One referee's lamp. Dark until its beat, then its colour. */
function Lamp({
  light,
  seat,
  revealed,
}: {
  readonly light: JudgeLight;
  readonly seat: number;
  readonly revealed: boolean;
}): React.ReactElement {
  const lit = useSharedValue(0);
  React.useEffect(() => {
    if (!revealed) {
      lit.value = 0;
      return undefined;
    }
    const at = lightRevealDelayMs(seat);
    lit.value = withDelay(at, withTiming(1, { duration: MEET_TUNING.LIGHT_FADE_MS }));
    // THE CLACK. One per referee, on the same delay the lamp comes up on, and
    // a different pattern for white and red — a lifter watching a 2-1 assemble
    // should be able to feel the third one land the wrong way without looking.
    const timer = setTimeout(() => playBeat({ kind: 'light', light }), at);
    return () => clearTimeout(timer);
  }, [lit, light, revealed, seat]);
  const style = useAnimatedStyle(() => ({ opacity: lit.value }));
  return (
    <View style={styles.lampWell} testID={`verdict-lamp-${seat}`}>
      <View style={styles.lampDark} />
      <Animated.View
        style={[
          styles.lampLit,
          light === 'white' ? styles.lampWhite : styles.lampRed,
          style,
        ]}
      />
    </View>
  );
}

export interface VerdictViewProps {
  readonly attempt: MeetDayAttempt;
  readonly liftLabel: string;
  /** False during the deliberation beat, true once the lights may come up. */
  readonly revealed: boolean;
  /** What the bar and collars weigh on their own, kg. Drawn, never judged. */
  readonly barAndCollarsKg: number;
  /** Attempt weight over the lifter's best single. Drawn strain, nothing else. */
  readonly loadRatio: number;
}

export function VerdictView({
  attempt,
  liftLabel,
  revealed,
  barAndCollarsKg,
  loadRatio,
}: VerdictViewProps): React.ReactElement {
  const good = attempt.good;
  const feedback = useSharedValue(0);
  React.useEffect(() => {
    if (!revealed) {
      feedback.value = 0;
      return undefined;
    }
    // After the LAST referee's lamp, not before it: the feedback line explains
    // a verdict, and a line that arrived first would be explaining one the
    // player has not been told yet.
    const at = lightRevealDelayMs(JUDGE_COUNT - 1) + MEET_TUNING.FEEDBACK_REVEAL_DELAY_MS;
    feedback.value = withDelay(at, withTiming(1, { duration: MEET_TUNING.FEEDBACK_FADE_MS }));
    const timer = setTimeout(() => playBeat({ kind: 'verdict', good }), at);
    return () => clearTimeout(timer);
  }, [feedback, good, revealed]);
  const feedbackStyle = useAnimatedStyle(() => ({ opacity: feedback.value }));

  // The panel going dark. One soft tick and then nothing — the silence is the
  // beat, and a pulse through it would be a metronome rather than a panel
  // making up its mind. Fires on the DELIBERATION screen only, so it cannot
  // leak which way the call went.
  React.useEffect(() => {
    if (revealed) return undefined;
    return playBeat({ kind: 'deliberation' });
  }, [revealed]);

  // THE HALL REACTS. Only on a good lift, only after the last lamp, and it is
  // the one thing about the room that the call reaches. `crowdRisePxAt` is pure
  // and shared with the walk-out's own rise, so the two cannot be two ramps.
  //
  // AND IT REACTS HARDER TO A LIFT THE MEET TURNED ON. That is the ONLY way this
  // beat escalates, and deliberately not a longer hold — see
  // `MEET_TUNING.DELIBERATION_STAKES_EXTRA_MS`: the wait for news may be
  // lengthened, the news itself may only be made louder, because a longer hold
  // on a screen whose answer is already on it is dead air by construction.
  const cheering = revealed && good;
  const cheerRamp = isUrgentAttempt(attempt);
  const sampleRise = React.useCallback(
    (elapsedMs: number) =>
      cheering ? crowdRisePxAt(elapsedMs - cheerDelayMs(), cheerCrowdRise(cheerRamp)) : 0,
    [cheering, cheerRamp],
  );
  const crowdRisePx = useHallStep(
    sampleRise,
    cheerDelayMs() + MEET_TUNING.CROWD.CHEER_RISE_MS,
    null,
  );

  // HE IS STILL HOLDING THE BAR, AND THE WAIT IS NOW A WINDOW WITH SOMETHING IN
  // IT. `deliberationMs` got stakes extras, and lengthening a beat that draws
  // one memoised still is the very defect `walkout.ts`'s tail exists to remove.
  // `buildHold` is that same tail with no walk-out in front of it: the bar works
  // under a braced man for the brace window, then `WALKOUT_TAIL.HUSH_MS` of
  // stillness before the lamps.
  //
  // The clock runs during the DELIBERATION only. Once the lights may come up the
  // beat belongs to them, and a bar still rocking under three lamps would be
  // motion competing with the moment this game is named after.
  const hold = React.useMemo(
    () => buildHold(loadRatio, deliberationMs(attempt.deliberated, attempt)),
    [loadRatio, attempt],
  );
  const sampleHold = React.useCallback(
    (elapsedMs: number) => walkoutFrameIndexAt(hold, elapsedMs),
    [hold],
  );
  const holdIndex = useHallStep(sampleHold, revealed ? 0 : hold.beatMs, null);
  const pose: WalkoutFrame | undefined = revealed
    ? undefined
    : (hold.frames[holdIndex] ?? walkoutFrameAt(hold, hold.beatMs));

  return (
    <View style={styles.root} testID={revealed ? 'meet-verdict' : 'meet-deliberation'}>
      <View style={styles.panel}>
        <Text style={styles.eyebrow} testID="verdict-attempt">
          {`${liftLabel} · ${formatWeight(attempt.weightKg)}`}
        </Text>

        <View style={styles.lamps} testID="verdict-lamps">
          {attempt.lights.map((light, seat) => (
            <Lamp key={seat} light={light} seat={seat} revealed={revealed} />
          ))}
        </View>

        {revealed ? (
          <Text
            style={[styles.call, attempt.good ? styles.callGood : styles.callNoLift]}
            testID="verdict-call"
          >
            {attempt.good ? MEET_COPY.GOOD_LIFT : MEET_COPY.NO_LIFT}
          </Text>
        ) : (
          <Text style={styles.deliberating} testID="verdict-deliberating">
            {MEET_COPY.DELIBERATING}
          </Text>
        )}

        {revealed ? (
          <Animated.View style={feedbackStyle}>
            <Text style={styles.lightsText} testID="verdict-lights-text">
              {attempt.lightsText}
            </Text>
            <Text style={styles.feedback} testID="verdict-feedback">
              {attempt.feedbackText}
            </Text>
          </Animated.View>
        ) : null}
      </View>

      {/* He has not left the platform. The bar is still loaded and the room is
          still full; that is what the wait is. */}
      <MeetHallView
        lifter={{ totalKg: attempt.weightKg, barAndCollarsKg, loadRatio, pose }}
        scrim={MEET_TUNING.HALL.JUDGING_SCRIM}
        crowdRisePx={crowdRisePx}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  panel: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: L.SCREEN_PAD,
    gap: L.SECTION_GAP,
    maxHeight: LIFT_TUNING.LAYOUT.STAGE_H,
  },
  eyebrow: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.EYEBROW_FONT,
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  lamps: {
    flexDirection: 'row',
    gap: L.LIGHT_GAP,
  },
  lampWell: {
    width: L.LIGHT_SIZE,
    height: L.LIGHT_SIZE,
  },
  lampDark: {
    position: 'absolute',
    width: L.LIGHT_SIZE,
    height: L.LIGHT_SIZE,
    borderRadius: L.LIGHT_RADIUS,
    borderWidth: L.LIGHT_BORDER,
    backgroundColor: MEET_PALETTE.LIGHT_DARK,
    borderColor: MEET_PALETTE.LIGHT_DARK_EDGE,
  },
  lampLit: {
    position: 'absolute',
    width: L.LIGHT_SIZE,
    height: L.LIGHT_SIZE,
    borderRadius: L.LIGHT_RADIUS,
    borderWidth: L.LIGHT_BORDER,
  },
  lampWhite: {
    backgroundColor: MEET_PALETTE.LIGHT_WHITE,
    borderColor: MEET_PALETTE.LIGHT_WHITE_EDGE,
  },
  lampRed: {
    backgroundColor: MEET_PALETTE.LIGHT_RED,
    borderColor: MEET_PALETTE.LIGHT_RED_EDGE,
  },
  deliberating: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.SUBHEAD_FONT,
    fontWeight: '700',
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  call: {
    fontSize: L.HEADLINE_FONT,
    fontWeight: '700',
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  callGood: { color: MEET_PALETTE.LIGHT_WHITE },
  callNoLift: { color: MEET_PALETTE.LIGHT_RED },
  lightsText: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.BODY_FONT,
    textAlign: 'center',
  },
  feedback: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    textAlign: 'center',
    paddingTop: L.ROW_GAP / 2,
  },
});
