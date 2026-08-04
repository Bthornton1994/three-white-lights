/**
 * WalkoutView — GDD §6.2 step 1: "Bar loads, brief walk-out beat."
 *
 * ---------------------------------------------------------------------------
 * THIS IS THE BEAT GDD §12.2 JUDGES
 * ---------------------------------------------------------------------------
 * "Real powerlifting broadcast footage — a third-attempt walkout. Does our
 * sequence produce comparable dread and anticipation? Judge pacing and sound,
 * not sprite count."
 *
 * The screen is deliberately almost empty. There is no button, nothing to tap,
 * and no way to skip: the lifter is under the bar and the only thing that ends
 * this beat is time. Everything on it is the bar, its weight, and one line —
 * and which line depends on what the attempt is worth, which is where the
 * escalation lives:
 *
 *   opener / second attempt   "WALK IT OUT"
 *   third attempt             "LAST ONE"
 *   above your best ever      "NOBODY HAS SEEN YOU DO THIS"
 *   nothing banked, last one  "NOTHING BANKED. THIS IS THE LIFT."
 *
 * The BEAT gets longer in the same order (`walkoutMs` in `meetDay.ts`), so a
 * third-attempt PR with a bomb on the line is both the loudest line and the
 * longest silence in the piece.
 *
 * WHAT IS NOT HERE, AND WHY. GDD §7.2 puts "third-attempt walkout at a meet"
 * first on its cut-in list and then says to "cut art entirely from the early
 * prototypes. Placeholder rectangles until meet day is proven to land." So this
 * beat fires no cut-in. §12.3 makes more than one cut-in per session a refusal
 * condition; firing none is inside that rule, and the gate belongs to whoever
 * builds the cut-in piece.
 *
 * NO SOUND EITHER, and §12.2 explicitly judges "pacing AND sound". There is no
 * audio anywhere in this codebase yet. Half of this beat's bar is therefore
 * unbuilt, not merely untuned, and that should be reported as a gap rather than
 * discovered.
 *
 * NO ARITHMETIC HERE. The plate stack is drawn from the weight and the bar, and
 * `plateStackFor` lives in `meetPlates.ts` because CLAUDE.md forbids computing
 * a load inside a `.tsx` file.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { MEET_COPY, MEET_LAYOUT, MEET_TUNING } from '../game/meetTuning';
import type { LiveAttempt } from '../game/meetDay';
import { ATTEMPTS_PER_LIFT } from '../game/meet';
import { formatWeight } from '../game/resultCard';
import { plateStackFor, type PlateMark } from './meetPlates';
import { MEET_PALETTE } from './meetPalette';

const L = MEET_LAYOUT;

/** One plate, landing on its own beat so the bar loads rather than appears. */
function Plate({ plate, index }: { readonly plate: PlateMark; readonly index: number }): React.ReactElement {
  const shown = useSharedValue(0);
  React.useEffect(() => {
    shown.value = withDelay(
      index * MEET_TUNING.BAR_LOAD_PLATE_STAGGER_MS,
      withTiming(1, { duration: MEET_TUNING.BAR_LOAD_PLATE_STAGGER_MS }),
    );
  }, [index, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Animated.View
      style={[
        styles.plate,
        { height: plate.heightPt, backgroundColor: plate.colour, borderColor: plate.edgeColour },
        style,
      ]}
    />
  );
}

export interface WalkoutViewProps {
  readonly attempt: LiveAttempt;
  readonly liftLabel: string;
  readonly barAndCollarsKg: number;
}

export function WalkoutView({ attempt, liftLabel, barAndCollarsKg }: WalkoutViewProps): React.ReactElement {
  const stack = plateStackFor(attempt.weightKg, barAndCollarsKg);
  const line = attempt.bombRisk
    ? MEET_COPY.WALKOUT_BOMB_RISK
    : attempt.isPrAttempt
      ? MEET_COPY.WALKOUT_PR
      : attempt.attemptNumber === ATTEMPTS_PER_LIFT
        ? MEET_COPY.WALKOUT_THIRD
        : MEET_COPY.WALKOUT_PROMPT;
  const urgent = attempt.bombRisk || attempt.isPrAttempt || attempt.attemptNumber === ATTEMPTS_PER_LIFT;

  const revealed = useSharedValue(0);
  React.useEffect(() => {
    revealed.value = 0;
    revealed.value = withDelay(
      MEET_TUNING.WALKOUT_WEIGHT_HOLD_MS,
      withTiming(1, { duration: MEET_TUNING.OPENER_ROW_FADE_MS }),
    );
  }, [revealed, attempt.lift, attempt.attemptNumber]);
  const lineStyle = useAnimatedStyle(() => ({ opacity: revealed.value }));

  return (
    <View style={styles.root} testID="meet-walkout">
      <Text style={styles.eyebrow} testID="walkout-attempt">
        {`${liftLabel} · ${MEET_COPY.ATTEMPT_LABEL} ${attempt.attemptNumber} ${MEET_COPY.ATTEMPT_OF} ${ATTEMPTS_PER_LIFT}`}
      </Text>

      <Text style={styles.weight} testID="walkout-weight">
        {formatWeight(attempt.weightKg)}
      </Text>

      <View style={styles.bar} testID="walkout-bar">
        {/* HEAVIEST INBOARD, both sides — the order a real loading crew works
            in, and the reason the left sleeve is drawn in reverse. The stagger
            index runs the same way, so the 25s land first and the change discs
            last. */}
        <View style={styles.sleeve}>
          {[...stack].reverse().map((plate, index) => (
            <Plate
              key={`l-${plate.weightKg}-${index}`}
              plate={plate}
              index={stack.length - index - 1}
            />
          ))}
        </View>
        <View style={styles.shaft} />
        <View style={styles.sleeve}>
          {stack.map((plate, index) => (
            <Plate key={`r-${plate.weightKg}-${index}`} plate={plate} index={index} />
          ))}
        </View>
      </View>

      <Animated.View style={lineStyle}>
        <Text style={[styles.line, urgent ? styles.lineUrgent : null]} testID="walkout-line">
          {line}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MEET_PALETTE.WALKOUT_BACKDROP,
    paddingHorizontal: L.SCREEN_PAD,
    gap: L.SECTION_GAP,
  },
  eyebrow: {
    color: MEET_PALETTE.WALKOUT_TEXT,
    fontSize: L.EYEBROW_FONT,
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  weight: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.BIG_NUMBER_FONT,
    fontWeight: '700',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: L.BAR_W,
    height: L.PLATE_MAX_H,
  },
  sleeve: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: L.PLATE_GAP,
    flex: 1,
    justifyContent: 'center',
  },
  shaft: {
    width: L.BAR_W / 2,
    height: L.BAR_H,
    backgroundColor: MEET_PALETTE.WALKOUT_TEXT,
  },
  plate: {
    width: L.PLATE_W,
    borderWidth: L.DIVIDER_HEIGHT,
    borderRadius: L.PLATE_GAP,
  },
  line: {
    color: MEET_PALETTE.WALKOUT_TEXT,
    fontSize: L.SUBHEAD_FONT,
    fontWeight: '700',
    letterSpacing: L.WIDE_LETTER_SPACING,
    textAlign: 'center',
  },
  lineUrgent: {
    color: MEET_PALETTE.WALKOUT_URGENT,
  },
});
