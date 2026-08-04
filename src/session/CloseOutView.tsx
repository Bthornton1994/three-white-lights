/**
 * CloseOutView — GDD §3.2's "e1RM updated, streak incremented, feedback shown".
 *
 * ---------------------------------------------------------------------------
 * THE NUMBER THAT MOVES HERE IS e1RM. THERE IS NO TOTAL ON THIS SCREEN.
 * ---------------------------------------------------------------------------
 * GDD §3.2 states this as a constraint on whoever builds this loop: "It must
 * not show a Total that ticked up, an 'estimated Total', or a projected
 * competition total, because Total is the sum of best successful *competition*
 * attempts (§6.4) and there were no attempts today."
 *
 * The prohibition is enforced three deep and none of the three is this comment:
 * `SessionCloseOut` has no total field, `session.test.ts` serialises it and
 * fails on the word, and `ProjectionWithinReach<'record-training-session'>`
 * makes a projected Total a COMPILE error in `progression.ts`.
 *
 * ---------------------------------------------------------------------------
 * WHAT LANDS, AND WHY IN THIS ORDER
 * ---------------------------------------------------------------------------
 * Three rows, staggered so they arrive rather than appear:
 *
 *   1. THE CALL. "NEW e1RM" or "SESSION LOGGED", in the colour of the outcome.
 *   2. THE NUMBER. The lifter's e1RM for the lift they just trained. On a PR it
 *      counts UP from the old value, so the movement is the event; on an
 *      ordinary day it is simply there, because most days it does not move and
 *      pretending otherwise is what makes a PR mean nothing.
 *   3. THE STREAK, which pops. The one thing that moves every single day, and
 *      the reason a daily-habit loop has a close-out at all.
 *
 * Then the reps banked and the bar-speed line — GDD §3.4's feedback channel,
 * which is a phrase and never a meter.
 *
 * NO CUT-IN FIRES HERE. GDD §7.2 puts PR moments on the cut-in list and caps
 * them at one per session (§12.3 makes more than one a refusal condition), and
 * §7.2 also says to "cut art entirely from the early prototypes". Firing none
 * is inside both rules; whoever builds the cut-in piece owns the gate.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { SESSION_COPY, SESSION_LAYOUT, SESSION_TUNING } from '../game/sessionTuning';
import type { SessionCloseOut } from '../game/session';
import { SESSION_PALETTE } from './sessionPalette';

const L = SESSION_LAYOUT;

/**
 * Counts a number from `from` to `to` over `durationMs`.
 *
 * React state rather than Reanimated, because the thing being animated is TEXT
 * CONTENT: Reanimated animates style properties on the UI thread and cannot
 * rewrite a `<Text>`'s children without a helper this project does not depend
 * on. A once-per-session count over `CLOSE_OUT_E1RM_COUNT_MS` is not a
 * per-frame cost worth a dependency.
 *
 * A zero duration lands on `to` immediately, which is what an ordinary day
 * wants — the number did not move, so nothing should appear to move.
 */
function useCountUp(from: number, to: number, durationMs: number, delayMs: number): number {
  const [value, setValue] = useState(durationMs <= 0 ? to : from);
  const frame = useRef<number>(0);
  useEffect(() => {
    if (durationMs <= 0) {
      setValue(to);
      return undefined;
    }
    const start = Date.now() + delayMs;
    const tick = (): void => {
      const elapsed = Date.now() - start;
      const t = elapsed <= 0 ? 0 : Math.min(1, elapsed / durationMs);
      setValue(from + (to - from) * t);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [from, to, durationMs, delayMs]);
  return value;
}

/** A row that fades in on its own beat, so the close-out assembles. */
function Row({
  index,
  children,
}: {
  readonly index: number;
  readonly children: React.ReactNode;
}): React.ReactElement {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withDelay(
      index * SESSION_TUNING.CLOSE_OUT_ROW_STAGGER_MS,
      withTiming(1, { duration: SESSION_TUNING.CLOSE_OUT_ROW_FADE_MS }),
    );
  }, [index, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return <Animated.View style={[styles.row, style]}>{children}</Animated.View>;
}

export interface CloseOutViewProps {
  readonly closeOut: SessionCloseOut;
  readonly onDone: () => void;
  readonly onRetry: () => void;
}

export function CloseOutView({
  closeOut,
  onDone,
  onRetry,
}: CloseOutViewProps): React.ReactElement {
  const from = closeOut.previousBestE1rmKg ?? closeOut.newBestE1rmKg ?? 0;
  const to = closeOut.newBestE1rmKg ?? from;

  // The count-up. Zero duration when nothing moved, so an ordinary day does not
  // animate a number that is standing still.
  const shownE1rm = useCountUp(
    from,
    to,
    closeOut.isPr ? SESSION_TUNING.CLOSE_OUT_E1RM_COUNT_MS : 0,
    SESSION_TUNING.CLOSE_OUT_ROW_STAGGER_MS,
  );

  const pop = useSharedValue(1);
  useEffect(() => {
    if (closeOut.streakAfter === closeOut.streakBefore) return;
    pop.value = withDelay(
      SESSION_TUNING.CLOSE_OUT_ROW_STAGGER_MS *
        SESSION_TUNING.CLOSE_OUT_ROW_ORDER.STREAK,
      withSequence(
        withTiming(SESSION_TUNING.CLOSE_OUT_STREAK_POP_SCALE, {
          duration: SESSION_TUNING.CLOSE_OUT_STREAK_POP_MS / 2,
        }),
        withTiming(1, { duration: SESSION_TUNING.CLOSE_OUT_STREAK_POP_MS / 2 }),
      ),
    );
  }, [pop, closeOut.streakAfter, closeOut.streakBefore]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const headlineColour = closeOut.isPr
    ? SESSION_PALETTE.PR
    : closeOut.canPropose
      ? SESSION_PALETTE.TEXT
      : SESSION_PALETTE.MISS;

  return (
    <View style={styles.root} testID="session-close-out">
      <Row index={SESSION_TUNING.CLOSE_OUT_ROW_ORDER.CALL}>
        <Text style={[styles.headline, { color: headlineColour }]} testID="close-out-headline">
          {closeOut.headline}
        </Text>
        <Text style={styles.subhead} testID="close-out-subhead">
          {closeOut.subhead}
        </Text>
      </Row>

      {closeOut.newBestE1rmKg === null ? null : (
        <Row index={SESSION_TUNING.CLOSE_OUT_ROW_ORDER.E1RM}>
          <Text style={styles.statLabel}>
            {`${SESSION_COPY.LIFT_LABEL[closeOut.lift]} ${SESSION_COPY.CLOSE_OUT_E1RM_LABEL}`}
          </Text>
          <View style={styles.numberRow}>
            <Text
              style={[styles.bigNumber, closeOut.isPr ? styles.bigNumberPr : null]}
              testID="close-out-e1rm"
            >
              {shownE1rm.toFixed(SESSION_TUNING.E1RM_DISPLAY_DECIMALS)}
            </Text>
            <Text style={styles.unit}>kg</Text>
          </View>
        </Row>
      )}

      <View style={styles.divider} />

      <Row index={SESSION_TUNING.CLOSE_OUT_ROW_ORDER.STREAK}>
        <Animated.View style={popStyle}>
          <Text style={styles.stat} testID="close-out-streak">
            {closeOut.streakAfter}
          </Text>
        </Animated.View>
        <Text style={styles.statLabel}>{SESSION_COPY.CLOSE_OUT_STREAK_LABEL}</Text>
      </Row>

      <Row index={SESSION_TUNING.CLOSE_OUT_ROW_ORDER.REPS}>
        <Text style={styles.stat} testID="close-out-reps">
          {`${closeOut.goodReps} / ${closeOut.prescribedReps}`}
        </Text>
        <Text style={styles.statLabel}>{SESSION_COPY.CLOSE_OUT_REPS_LABEL}</Text>
        <Text style={styles.feedback} testID="close-out-feedback">
          {closeOut.barSpeedText}
        </Text>
      </Row>

      <Pressable
        style={styles.action}
        accessibilityRole="button"
        onPress={closeOut.canPropose ? onDone : onRetry}
        testID="close-out-action"
      >
        <Text style={styles.actionLabel}>
          {closeOut.canPropose ? SESSION_COPY.CLOSE_OUT_DONE : SESSION_COPY.CLOSE_OUT_RETRY}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: L.SCREEN_PAD,
    gap: L.STAT_ROW_GAP,
  },
  row: {
    alignItems: 'center',
    gap: L.ROW_GAP / 2,
  },
  headline: {
    fontSize: L.HEADLINE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  subhead: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.SUBHEAD_FONT,
    textAlign: 'center',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: L.ROW_GAP / 2,
  },
  bigNumber: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.BIG_NUMBER_FONT,
    fontWeight: '700',
  },
  bigNumberPr: {
    color: SESSION_PALETTE.PR,
  },
  unit: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.UNIT_FONT,
    paddingBottom: L.ROW_GAP,
  },
  divider: {
    height: L.DIVIDER_HEIGHT,
    alignSelf: 'stretch',
    backgroundColor: SESSION_PALETTE.DIVIDER,
  },
  stat: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.STAT_FONT,
    fontWeight: '700',
  },
  statLabel: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  feedback: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.SUBHEAD_FONT,
    textAlign: 'center',
  },
  action: {
    alignSelf: 'stretch',
    height: L.BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: L.BUTTON_RADIUS,
    backgroundColor: SESSION_PALETTE.ACTION,
  },
  actionLabel: {
    color: SESSION_PALETTE.ACTION_TEXT,
    fontSize: L.BUTTON_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
});
