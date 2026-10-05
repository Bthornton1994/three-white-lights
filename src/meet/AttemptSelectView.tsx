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
 * ---------------------------------------------------------------------------
 * THE PLATFORM IS BEHIND IT, AND IT IS EMPTY
 * ---------------------------------------------------------------------------
 * This screen used to be two cards on a void. It is the one-way choice §6.3 is
 * built around, and it is made in the same building as the attempt that
 * produced it — so the hall is behind it, held back hard by
 * `MEET_TUNING.HALL.CHOICE_SCRIM` because a decision with a paragraph on each
 * card has to READ.
 *
 * NOBODY IS ON THE PLATFORM. `lifter={null}`, and that is a statement rather
 * than a saving: between attempts the lifter is off the platform and the loading
 * crew is on it. Drawing a figure standing under a bar he has not declared yet
 * would be the screen telling a lie about where he is.
 *
 * NO ARITHMETIC HERE. Every weight, every delta and every label comes off
 * `attemptDecisionFor`, and every one of them has already been checked against
 * `isCallableWeightNow` — the same predicate `declareAttempt` will apply.
 *
 * ---------------------------------------------------------------------------
 * THE GOLD EDGE AND THE PR SENTENCE ARE THE SAME DECISION
 * ---------------------------------------------------------------------------
 * `styles.cardPr` paints `MEET_PALETTE.CARD_PR_EDGE` off `option.isPrAttempt`,
 * and the sentence beside it is `option.prNote`, which `meetDay.ts` fills from
 * that same expression. So a card cannot say "A PR on the line" without the
 * border, or wear the border in silence.
 *
 * `@guarantee pr-sentence-and-pr-border-are-one-decision`
 *
 * That is what this screen used to do. `MEET_COPY.OPTION_BIG_WHY` was a static
 * string reading "A PR on the line. Higher risk.", printed on the big card
 * whatever the flag said, and on a lifter's first meet the flag is false for
 * every card — so a played first meet drew six gold-less cards claiming a
 * record, in the same sitting whose recap called all three lifts a PR.
 * `AttemptSelectView.test.ts` holds the counts, and
 * `tools/verify-shell-route.mjs` reads the pair off the played arm in a browser
 * because a node suite cannot render a border.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from '../ui/MotionPressable';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { MEET_COPY, MEET_LAYOUT, MEET_TUNING } from '../game/meetTuning';
import type { AttemptDecision, AttemptOption } from '../game/meetDay';
import type { AttemptStake, MeetBoard } from '../game/meetBoard';
import { playBeat } from './meetFeedback';
import { formatWeight } from '../game/resultCard';
import { MeetHallView } from './MeetHallView';
import { MeetBoardView } from './MeetBoardView';
import { MEET_PALETTE } from './meetPalette';

const L = MEET_LAYOUT;

function OptionCard({
  option,
  index,
  bold,
  stakes,
  onChoose,
}: {
  readonly option: AttemptOption;
  readonly index: number;
  readonly bold: boolean;
  readonly stakes: readonly AttemptStake[];
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
      <MotionPressable
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
        <Text style={styles.cardDelta} testID={`attempt-option-delta-${option.id}`}>
          {option.deltaKg === 0 ? MEET_COPY.OPTION_SAME_WEIGHT : `+${formatWeight(option.deltaKg)}`}
        </Text>
        {option.prNote === null ? null : (
          <Text style={styles.cardPrNote} testID={`attempt-option-pr-note-${option.id}`}>
            {option.prNote}
          </Text>
        )}
        <Text style={styles.cardWhy} testID={`attempt-option-why-${option.id}`}>
          {option.why}
        </Text>
        {stakes.map((stake) => (
          <Text
            key={stake.kind}
            style={styles.cardStake}
            testID={`attempt-option-stake-${option.id}-${stake.kind}`}
          >
            {stake.text}
          </Text>
        ))}
      </MotionPressable>
    </Animated.View>
  );
}

export interface AttemptSelectViewProps {
  readonly decision: AttemptDecision;
  readonly board: MeetBoard;
  readonly onDeckName: string | null;
  readonly stakesByOptionId: Readonly<Record<string, readonly AttemptStake[]>>;
  readonly onChoose: (weightKg: number) => void;
}

export function AttemptSelectView({
  decision,
  board,
  onDeckName,
  stakesByOptionId,
  onChoose,
}: AttemptSelectViewProps): React.ReactElement {
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
      {/* Behind everything, and untouchable: the cards are the only thing on
          this screen that takes a press. */}
      <View style={styles.hall}>
        <MeetHallView lifter={null} scrim={MEET_TUNING.HALL.CHOICE_SCRIM} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      <Text style={styles.eyebrow}>{MEET_COPY.SELECT_EYEBROW}</Text>
      <MeetBoardView board={board} onDeckName={onDeckName} />
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
            stakes={stakesByOptionId[option.id] ?? []}
            onChoose={choose}
          />
        ))}
      </View>

      {decision.bombWarningText === null ? null : (
        <Text style={styles.bombWarning} testID="attempt-select-bomb-warning">
          {decision.bombWarningText}
        </Text>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignSelf: 'stretch',
  },
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: L.SCREEN_PAD,
    paddingVertical: L.ROW_GAP,
    gap: L.ROW_GAP,
    flexGrow: 1,
    justifyContent: 'center',
  },
  hall: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
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
  // The sentence and the border are the same colour because they are the same
  // decision — see `AttemptOption.prNote`.
  cardPrNote: {
    color: MEET_PALETTE.CARD_PR_EDGE,
    fontSize: L.HINT_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
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
  cardStake: {
    color: MEET_PALETTE.WALKOUT_URGENT,
    fontSize: L.LABEL_FONT,
    fontWeight: '700',
  },
  bombWarning: {
    color: MEET_PALETTE.WALKOUT_URGENT,
    fontSize: L.BODY_FONT,
    textAlign: 'center',
    paddingTop: L.ROW_GAP,
  },
});
