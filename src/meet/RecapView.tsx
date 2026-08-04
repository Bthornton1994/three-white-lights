/**
 * RecapView — GDD §6.5's post-meet screen.
 *
 * "Recap screen: attempt-by-attempt breakdown, PR call-outs, DOTS score,
 * placing in field."
 *
 * ---------------------------------------------------------------------------
 * THE TOTAL LANDS FIRST, AND IT IS THE ONLY PLACE ONE EVER MOVES
 * ---------------------------------------------------------------------------
 * GDD §2 and §3.2: Total is set by meet results and does not move between
 * meets, and the daily loop's close-out is forbidden from showing one — "the
 * whole reason meet day lands is that it is the only thing that moves that
 * number." So this is the payoff that beat was saving up for, it arrives first
 * (`RECAP_ROW_ORDER.TOTAL`), and on a competition PR it counts up from the
 * lifter's previous best rather than simply being there.
 *
 * The number is the SERVER's. `buildMeetRecap` refuses outright to assemble a
 * recap whose confirmed total disagrees with the card built from the meet the
 * client played, so this screen cannot print an optimistic total next to a card
 * printing a real one.
 *
 * ---------------------------------------------------------------------------
 * THE CARD IS THE HAND-OFF, NOT A COPY
 * ---------------------------------------------------------------------------
 * §6.5's shareable card is `src/card/`'s and already exists. This screen builds
 * nothing of it: `MeetRecap.card` is a `ResultCard` from `resultCard.ts` and the
 * button hands it to `ResultCardScreen` unchanged. Every number on this recap —
 * the total, the DOTS score, the place cell — is read back off that same card,
 * so what a player sees before they share and what they share are the same
 * facts.
 *
 * NO CUT-IN FIRES HERE. GDD §7.2 lists PR moments and puts cut-in art outside
 * the early prototypes; §12.3 caps them at one per session. Firing none is
 * inside both rules and the gate belongs to the cut-in piece.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { LIFT_ORDER } from '../game/meet';
import { MEET_COPY, MEET_LAYOUT, MEET_TUNING } from '../game/meetTuning';
import { countedTotalText, type MeetDayAttempt, type MeetRecap } from '../game/meetDay';
import { AttemptBoard } from './AttemptBoard';
import { MEET_PALETTE } from './meetPalette';

const L = MEET_LAYOUT;

/** A block that arrives on its own beat, so the recap assembles. */
function Block({ index, children }: { readonly index: number; readonly children: React.ReactNode }): React.ReactElement {
  const shown = useSharedValue(0);
  React.useEffect(() => {
    shown.value = withDelay(
      index * MEET_TUNING.RECAP_ROW_STAGGER_MS,
      withTiming(1, { duration: MEET_TUNING.RECAP_ROW_FADE_MS }),
    );
  }, [index, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return <Animated.View style={[styles.block, style]}>{children}</Animated.View>;
}

/**
 * Counts a number from `from` to `to`.
 *
 * React state rather than Reanimated for the reason `CloseOutView` gives: the
 * thing being animated is TEXT CONTENT, which Reanimated cannot rewrite without
 * a helper this project does not depend on. A zero duration lands on `to`
 * immediately, which is what a meet that did not beat the lifter's best wants —
 * the number did not move, so nothing should appear to move.
 */
function useCountUp(from: number, to: number, durationMs: number, delayMs: number): number {
  const [value, setValue] = React.useState(durationMs <= 0 ? to : from);
  const frame = React.useRef<number>(0);
  React.useEffect(() => {
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

export interface RecapViewProps {
  readonly recap: MeetRecap;
  readonly attempts: readonly MeetDayAttempt[];
  readonly onSeeCard: () => void;
}

export function RecapView({ recap, attempts, onSeeCard }: RecapViewProps): React.ReactElement {
  const to = recap.totalKg ?? 0;
  const from = recap.previousBestTotalKg ?? to;
  const counted = useCountUp(
    from,
    to,
    recap.isTotalPr && recap.totalKg !== null ? MEET_TUNING.RECAP_TOTAL_COUNT_MS : 0,
    MEET_TUNING.RECAP_ROW_STAGGER_MS,
  );

  return (
    <ScrollView contentContainerStyle={styles.root} testID="meet-recap">
      <Text style={styles.eyebrow}>{MEET_COPY.RECAP_EYEBROW}</Text>

      <Block index={MEET_TUNING.RECAP_ROW_ORDER.TOTAL}>
        <Text style={styles.totalLabel}>{MEET_COPY.RECAP_TOTAL_LABEL}</Text>
        <Text
          style={[styles.total, recap.isTotalPr ? styles.totalPr : null]}
          testID="recap-total"
        >
          {countedTotalText(recap, counted)}
        </Text>
        {recap.prText === null ? null : (
          <Text
            style={[styles.prText, recap.isTotalPr || recap.isFirstTotal ? styles.prTextHot : null]}
            testID="recap-pr"
          >
            {recap.prText}
          </Text>
        )}
      </Block>

      <Block index={MEET_TUNING.RECAP_ROW_ORDER.LIFTS}>
        <Text style={styles.sectionLabel}>{MEET_COPY.RECAP_ATTEMPTS_LABEL}</Text>
        <View style={styles.boards}>
          {LIFT_ORDER.map((lift, index) => (
            <AttemptBoard
              key={lift}
              lift={lift}
              attempts={attempts}
              prLabel={recap.rows[index]?.isPr === true ? MEET_COPY.RECAP_PR_LIFT : undefined}
            />
          ))}
        </View>
      </Block>

      <View style={styles.summary}>
        <Block index={MEET_TUNING.RECAP_ROW_ORDER.DOTS}>
          <Text style={styles.summaryValue} testID="recap-dots">
            {recap.dotsText}
          </Text>
          <Text style={styles.summaryLabel}>{MEET_COPY.RECAP_DOTS_LABEL}</Text>
        </Block>
        <Block index={MEET_TUNING.RECAP_ROW_ORDER.PLACE}>
          <Text style={styles.summaryValue} testID="recap-place">
            {recap.placeText}
          </Text>
          <Text style={styles.summaryLabel}>
            {`${MEET_COPY.RECAP_PLACE_LABEL} ${MEET_COPY.RECAP_OF_FIELD} ${recap.fieldSize}`}
          </Text>
        </Block>
      </View>

      <Block index={MEET_TUNING.RECAP_ROW_ORDER.CARD}>
        <Pressable
          style={styles.action}
          accessibilityRole="button"
          onPress={onSeeCard}
          testID="recap-action"
        >
          <Text style={styles.actionLabel}>{MEET_COPY.RECAP_ACTION}</Text>
        </Pressable>
      </Block>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: L.SCREEN_PAD,
    paddingVertical: L.SECTION_GAP,
    gap: L.SECTION_GAP,
  },
  block: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: L.ROW_GAP / 2,
  },
  eyebrow: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.EYEBROW_FONT,
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  totalLabel: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  total: {
    color: MEET_PALETTE.TOTAL,
    fontSize: L.BIG_NUMBER_FONT,
    fontWeight: '700',
  },
  totalPr: {
    color: MEET_PALETTE.PR,
  },
  prText: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
  },
  prTextHot: {
    color: MEET_PALETTE.PR,
    fontWeight: '700',
  },
  sectionLabel: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.WIDE_LETTER_SPACING,
    paddingBottom: L.ROW_GAP / 2,
  },
  boards: {
    gap: L.BOARD_GAP,
  },
  summary: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-around',
  },
  summaryValue: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.MID_NUMBER_FONT,
    fontWeight: '700',
  },
  summaryLabel: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
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
