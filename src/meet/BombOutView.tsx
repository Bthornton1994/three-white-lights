/**
 * BombOutView — GDD §6.3's somber moment.
 *
 * "Bombing out (missing all three on a lift) ends the meet with zero on that
 * lift. This is real and feared in the actual sport. Give it a distinct, somber
 * moment — narratively honest, not a generic game-over screen, and not
 * punitive."
 *
 * ---------------------------------------------------------------------------
 * WHAT MAKES IT NOT A GAME-OVER SCREEN
 * ---------------------------------------------------------------------------
 * Four things, and none of them is the word "somber" in a comment:
 *
 *   1. IT SAYS WHAT HAPPENED, NOT THAT YOU LOST. The headline is "NO TOTAL",
 *      which is the sport's own language for it and the exact thing that goes
 *      in a federation's Place column ("DQ" — `resultCard.ts`, cited to real
 *      published results). There is no "GAME OVER", no score, and no rank.
 *   2. NOTHING IS RED. A bomb-out is not an error state and the screen does not
 *      colour it like one. The palette here is the dimmest in the piece.
 *   3. IT STARTS WITH SILENCE. `BOMB_OUT_SILENCE_MS` of an almost-empty screen
 *      before the first line arrives, and the lines then arrive slower than
 *      anywhere else. There is nothing to tap through while it does.
 *   4. IT SAYS WHAT WAS NOT LOST, IN AS MANY WORDS, BEFORE IT OFFERS THE WAY
 *      OUT. GDD §12.3 and CLAUDE.md make a setback that punishes a player for
 *      showing up a refusal condition. A bomb-out takes NOTHING: e1RM, streak,
 *      best total on record and balances are all exactly where they were, and
 *      `meetServer.test.ts` proves each clause against the server rather than
 *      trusting this copy. The screen is allowed to say it because it is true.
 *
 * The lifter's attempts are still shown. A bombed card is rendered, not hidden
 * — `resultCard.ts` argues that at length: the projector at a real meet drops a
 * DQ'd lifter's row to spare them, but this is that lifter's own screen and
 * they are the one looking at it.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { MEET_COPY, MEET_LAYOUT, MEET_TUNING } from '../game/meetTuning';
import type { LiftKind } from '../game/meet';
import { hapticForBeat, type MeetDayAttempt } from '../game/meetDay';
import { playHaptic } from '../lift/haptics';
import { AttemptBoard } from './AttemptBoard';
import { MEET_PALETTE } from './meetPalette';

const L = MEET_LAYOUT;

/**
 * A line that arrives after the silence, on its own beat. Slower than anywhere
 * else in the piece — the pacing IS the tone.
 */
function Line({ index, children }: { readonly index: number; readonly children: React.ReactNode }): React.ReactElement {
  const shown = useSharedValue(0);
  React.useEffect(() => {
    shown.value = withDelay(
      MEET_TUNING.BOMB_OUT_SILENCE_MS + index * MEET_TUNING.BOMB_OUT_ROW_STAGGER_MS,
      withTiming(1, { duration: MEET_TUNING.BOMB_OUT_ROW_FADE_MS }),
    );
  }, [index, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return <Animated.View style={[styles.line, style]}>{children}</Animated.View>;
}

export interface BombOutViewProps {
  readonly bombedLift: LiftKind;
  readonly attempts: readonly MeetDayAttempt[];
  readonly onDone: () => void;
}

export function BombOutView({ bombedLift, attempts, onDone }: BombOutViewProps): React.ReactElement {
  const liftLabel = MEET_COPY.LIFT_LABEL[bombedLift];

  // ONE LOW BEAT, WHEN THE FIRST LINE ARRIVES, AND NOTHING ELSE.
  //
  // Deliberately not an `error` notification: that is the pattern this app uses
  // for a missed rep, and filing the worst moment in the sport under the same
  // feeling as a mistimed press would make it read as a fail state. GDD §6.3
  // asks for somber and explicitly not punitive. `MEET_TUNING.HAPTICS.BOMB_OUT`
  // is `soft`, once, after `BOMB_OUT_SILENCE_MS` of nothing.
  React.useEffect(() => {
    const timer = setTimeout(
      () => playHaptic(hapticForBeat({ kind: 'bomb-out' })),
      MEET_TUNING.BOMB_OUT_SILENCE_MS,
    );
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root} testID="meet-bombed">
      <Line index={MEET_TUNING.BOMB_OUT_ROW_ORDER.CALL}>
        <Text style={styles.call} testID="bomb-out-call">
          {MEET_COPY.BOMB_OUT_CALL}
        </Text>
      </Line>

      <Line index={MEET_TUNING.BOMB_OUT_ROW_ORDER.WHAT_HAPPENED}>
        <Text style={styles.body} testID="bomb-out-what-happened">
          {MEET_COPY.BOMB_OUT_WHAT_HAPPENED.replace('{lift}', liftLabel.toLowerCase())}
        </Text>
        <AttemptBoard lift={bombedLift} attempts={attempts} />
        <Text style={styles.honest} testID="bomb-out-honest">
          {MEET_COPY.BOMB_OUT_HONEST}
        </Text>
      </Line>

      {/* What a bomb-out did NOT cost. GDD §12.3, on screen, before the exit. */}
      <Line index={MEET_TUNING.BOMB_OUT_ROW_ORDER.KEPT}>
        <Text style={styles.kept} testID="bomb-out-kept">
          {MEET_COPY.BOMB_OUT_KEPT}
        </Text>
      </Line>

      <Line index={MEET_TUNING.BOMB_OUT_ROW_ORDER.ACTION}>
        <Pressable
          style={styles.action}
          accessibilityRole="button"
          onPress={onDone}
          testID="bomb-out-action"
        >
          <Text style={styles.actionLabel}>{MEET_COPY.BOMB_OUT_ACTION}</Text>
        </Pressable>
      </Line>
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
  line: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: L.ROW_GAP,
  },
  call: {
    color: MEET_PALETTE.BOMB_TEXT,
    fontSize: L.HEADLINE_FONT,
    fontWeight: '700',
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  body: {
    color: MEET_PALETTE.BOMB_TEXT,
    fontSize: L.BODY_FONT,
    textAlign: 'center',
  },
  honest: {
    color: MEET_PALETTE.BOMB_DIM,
    fontSize: L.HINT_FONT,
    textAlign: 'center',
  },
  kept: {
    color: MEET_PALETTE.BOMB_TEXT,
    fontSize: L.BODY_FONT,
    textAlign: 'center',
  },
  action: {
    alignSelf: 'stretch',
    height: L.BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: L.BUTTON_RADIUS,
    backgroundColor: MEET_PALETTE.ACTION,
  },
  actionLabel: {
    color: MEET_PALETTE.ACTION_TEXT,
    fontSize: L.BUTTON_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
});
