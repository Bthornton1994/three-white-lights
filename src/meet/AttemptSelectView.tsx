/**
 * AttemptSelectView — GDD §6.3, "Attempt Selection — The Real Tension".
 *
 * ---------------------------------------------------------------------------
 * THE FLOOR IS THE SCREEN
 * ---------------------------------------------------------------------------
 * §6.3's whole argument is one sentence: "The bite is that a miss does not
 * lower the floor — it RAISES it. A lifter who misses their opener cannot
 * retreat to something safe; the lightest thing they can still take is the
 * weight that just beat them."
 *
 * A screen that merely refuses a lower weight satisfies the rule and delivers
 * none of that, so the floor is not a validation here — IT IS THE HEADLINE. The
 * lightest legal call sits above the two options, in its own colour, with the
 * sentence attached, and after a miss it is the weight the lifter just failed
 * with. The number comes straight off `AttemptDecision.floorKg`, which is
 * `meet.ts`'s `AttemptContext.minimumWeight` unmodified, so what the screen
 * shouts and what the engine enforces are the same value.
 *
 * ---------------------------------------------------------------------------
 * TWO OPTIONS, NEVER THREE
 * ---------------------------------------------------------------------------
 * After a make: a small increase vs a big one. After a miss: repeat vs go past
 * it. §6.3 describes a choice between two things in both cases, and a third
 * button ("standard") would blunt it into a slider with three notches. The
 * engine has a `'standard'` strategy and this screen does not offer it —
 * `MEET_TUNING.SMALL_INCREASE_STRATEGY` / `BIG_INCREASE_STRATEGY` name which
 * two, and moving them is a tuning edit rather than a code one.
 *
 * NO ARITHMETIC HERE. Every weight, every delta and every label comes off
 * `attemptDecisionFor`, and every one of them has already been checked against
 * `isCallableWeightNow` — the same predicate `declareAttempt` will apply.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { MEET_COPY, MEET_LAYOUT, MEET_TUNING } from '../game/meetTuning';
import type { AttemptDecision, AttemptOption } from '../game/meetDay';
import { playBeat } from './meetFeedback';
import { formatWeight } from '../game/resultCard';
import { MEET_PALETTE } from './meetPalette';

const L = MEET_LAYOUT;

function OptionCard({
  option,
  index,
  bold,
  onChoose,
}: {
  readonly option: AttemptOption;
  readonly index: number;
  readonly bold: boolean;
  readonly onChoose: (weightKg: number) => void;
}): React.ReactElement {
  const shown = useSharedValue(0);
  React.useEffect(() => {
    shown.value = withDelay(
      index * MEET_TUNING.ATTEMPT_CARD_STAGGER_MS,
      withTiming(1, { duration: MEET_TUNING.ATTEMPT_CARD_FADE_MS }),
    );
  }, [index, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Animated.View style={[styles.cardWrap, style]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onChoose(option.weightKg)}
        testID={`attempt-option-${option.id}`}
        style={[
          styles.card,
          bold ? styles.cardBold : styles.cardSafe,
          option.isPrAttempt ? styles.cardPr : null,
        ]}
      >
        <Text style={styles.cardLabel}>{option.label}</Text>
        <Text style={styles.cardWeight} testID={`attempt-option-weight-${option.id}`}>
          {formatWeight(option.weightKg)}
        </Text>
        <Text style={styles.cardDelta}>
          {option.deltaKg === 0 ? MEET_COPY.OPTION_SAME_WEIGHT : `+${formatWeight(option.deltaKg)}`}
        </Text>
        <Text style={styles.cardWhy}>{option.why}</Text>
      </Pressable>
    </Animated.View>
  );
}

export interface AttemptSelectViewProps {
  readonly decision: AttemptDecision;
  readonly onChoose: (weightKg: number) => void;
}

export function AttemptSelectView({ decision, onChoose }: AttemptSelectViewProps): React.ReactElement {
  const raised = decision.floorRaisedByMiss;

  // THE FLOOR, FELT ONLY WHEN A MISS RAISED IT.
  //
  // `soundForBeat` and `hapticForBeat` both return null for a floor that is
  // merely the weight just made, and that asymmetry is the design, not an
  // omission: §6.3's bite is that a miss RAISES the floor, and a beat that
  // fired either way would say nothing. Silence on the good path is what
  // gives the bad one its weight.
  React.useEffect(
    () => playBeat({ kind: 'floor', raisedByMiss: raised }),
    [raised],
  );

  // A declaration is a one-way ratchet — the attempt cannot come back down.
  const choose = React.useCallback(
    (weightKg: number) => {
      playBeat({ kind: 'attempt-declared' });
      onChoose(weightKg);
    },
    [onChoose],
  );

  return (
    <View style={styles.root} testID="meet-attempt-select">
      <Text style={styles.eyebrow}>{MEET_COPY.SELECT_EYEBROW}</Text>
      <Text style={styles.title} testID="attempt-select-title">
        {`${MEET_COPY.LIFT_LABEL[decision.lift]} · ${MEET_COPY.ATTEMPT_LABEL} ${decision.attemptNumber}`}
      </Text>

      <Text style={styles.banked} testID="attempt-select-banked">
        {decision.bankedKg === null
          ? MEET_COPY.SELECT_NOTHING_BANKED
          : `${MEET_COPY.SELECT_BANKED} ${formatWeight(decision.bankedKg)}`}
      </Text>

      {/* THE FLOOR. GDD §6.3's bite, given the loudest line on the screen. */}
      <View style={styles.floor} testID="attempt-select-floor">
        <Text style={styles.floorLabel}>{MEET_COPY.SELECT_FLOOR_LABEL}</Text>
        <Text
          style={[
            styles.floorWeight,
            decision.floorRaisedByMiss ? styles.floorRaised : styles.floorSteady,
          ]}
          testID="attempt-select-floor-weight"
        >
          {formatWeight(decision.floorKg)}
        </Text>
        <Text
          style={[
            styles.floorText,
            decision.floorRaisedByMiss ? styles.floorRaised : null,
          ]}
          testID="attempt-select-floor-text"
        >
          {decision.floorText}
        </Text>
      </View>

      <View style={styles.cards}>
        {decision.options.map((option, index) => (
          <OptionCard
            key={option.id}
            option={option}
            index={index}
            bold={option.id === 'big'}
            onChoose={choose}
          />
        ))}
      </View>

      {decision.bombWarningText === null ? null : (
        <Text style={styles.bombWarning} testID="attempt-select-bomb-warning">
          {decision.bombWarningText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: L.SCREEN_PAD,
    gap: L.ROW_GAP,
  },
  eyebrow: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.EYEBROW_FONT,
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  title: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.HEADLINE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  banked: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  floor: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: L.ROW_GAP / 2,
    paddingVertical: L.SECTION_GAP / 2,
    marginTop: L.ROW_GAP,
    borderTopWidth: L.DIVIDER_HEIGHT,
    borderBottomWidth: L.DIVIDER_HEIGHT,
    borderColor: MEET_PALETTE.DIVIDER,
  },
  floorLabel: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  floorWeight: {
    fontSize: L.MID_NUMBER_FONT,
    fontWeight: '700',
  },
  floorRaised: { color: MEET_PALETTE.FLOOR_RAISED },
  floorSteady: { color: MEET_PALETTE.FLOOR_STEADY },
  floorText: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    textAlign: 'center',
  },
  cards: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: L.CARD_GAP,
    paddingTop: L.ROW_GAP,
  },
  cardWrap: {
    flex: 1,
  },
  card: {
    minHeight: L.CARD_HEIGHT,
    borderRadius: L.CARD_RADIUS,
    borderWidth: L.CARD_BORDER,
    padding: L.CARD_PAD,
    gap: L.ROW_GAP / 2,
  },
  cardSafe: {
    backgroundColor: MEET_PALETTE.CARD_SAFE,
    borderColor: MEET_PALETTE.CARD_SAFE_EDGE,
  },
  cardBold: {
    backgroundColor: MEET_PALETTE.CARD_BOLD,
    borderColor: MEET_PALETTE.CARD_BOLD_EDGE,
  },
  cardPr: {
    borderColor: MEET_PALETTE.CARD_PR_EDGE,
  },
  cardLabel: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  cardWeight: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.MID_NUMBER_FONT,
    fontWeight: '700',
  },
  cardDelta: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
  },
  cardWhy: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
  },
  bombWarning: {
    color: MEET_PALETTE.WALKOUT_URGENT,
    fontSize: L.BODY_FONT,
    textAlign: 'center',
    paddingTop: L.ROW_GAP,
  },
});
