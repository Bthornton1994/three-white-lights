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
 * NO LOGIC HERE. Which lights, whether it was close, what the feedback line
 * says, and which cue and pattern a lamp gets, are all decided in `meetDay.ts`
 * and arrive as data.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { MEET_COPY, MEET_LAYOUT, MEET_TUNING } from '../game/meetTuning';
import { lightRevealDelayMs, type MeetDayAttempt } from '../game/meetDay';
import { playBeat } from './meetFeedback';
import { JUDGE_COUNT, type JudgeLight } from '../game/meet';
import { formatWeight } from '../game/resultCard';
import { MEET_PALETTE } from './meetPalette';

const L = MEET_LAYOUT;

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
}

export function VerdictView({ attempt, liftLabel, revealed }: VerdictViewProps): React.ReactElement {
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

  return (
    <View style={styles.root} testID={revealed ? 'meet-verdict' : 'meet-deliberation'}>
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
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: L.SCREEN_PAD,
    gap: L.SECTION_GAP,
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
