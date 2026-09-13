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
 * ---------------------------------------------------------------------------
 * THE PR MOMENTS ARE OFFERED TO THE CUT-IN GATE, AND IT DECIDES
 * ---------------------------------------------------------------------------
 * GDD §7.2's second firing moment is "PR moments (new e1RM, new total,
 * qualifying for a higher tier)", and two of the three land on this screen: the
 * total, and each lift's own best. This file reports them as beats to
 * `useOfferCutIn` and decides nothing — `src/cutin/cutInGate.ts` applies §7.2's
 * one-per-session cap (§12.3's refusal condition) and this meet's scarcity
 * rates. A recap with no PR on it reports `achieved: false` and is refused, so
 * the qualification is the gate's rather than a condition here.
 *
 * THE THIRD ONE LANDS NOWHERE, AND THAT SENTENCE USED TO STOP AT "two of the
 * three". `record: 'tier'` — §7.2's "qualifying for a higher tier" — is a beat
 * kind `cutInGate.ts` permits and fires on, and NO SCREEN IN THE APP CAN OFFER
 * IT. It is not this screen's to send: tier qualification is a fact about a
 * lifter's standing across meets, which needs GDD §6.1's Career calendar, and a
 * human has explicitly deferred that. So it is unbuilt rather than missing, and
 * it is written down here and in `cutInGate.ts` §5 rather than left as a gap a
 * reader has to notice. `cutInWiring.test.ts`'s "THE THIRD PR SUB-MOMENT IS
 * REACHED BY NO SCREEN" pins it, and goes red the day one of them starts.
 *
 * WHAT IT REPORTS IS THE SERVER'S ANSWER. `recap.isTotalPr` comes off the same
 * confirmed recap every number on this screen does, so the cut-in cannot
 * celebrate a record the card does not print.
 *
 * A BOMB-OUT DOES NOT REACH THIS SCREEN — `MeetScreen` routes it to
 * `BombOutView`, which offers §7.2's third moment itself.
 *
 * ---------------------------------------------------------------------------
 * WHICH WORD GOES BESIDE A LIFT IS NOT DECIDED HERE
 * ---------------------------------------------------------------------------
 * `RecapLiftRow.callOut` arrives already chosen by `meetDay.ts`'s
 * `liftCallOutFor`, and this file picks nothing: it used to read `row.isPr` and
 * hand `AttemptBoard` the string `MEET_COPY.RECAP_PR_LIFT`, which printed "PR"
 * against all three lifts of a first meet — the meet §6.3's screen, one beat
 * earlier, had just told the same player carried no PR at all. GDD §6.5 records
 * that defect and the ruling. The cut-in beat below still reads `row.isPr`,
 * deliberately: a first-ever lift is a moment, the same way a first total is,
 * and the total's beat has always fired on one.
 *
 * `@guarantee the-pr-word-needs-a-record-to-beat`
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from '../ui/MotionPressable';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { LIFT_ORDER } from '../game/meet';
import { MEET_COPY, MEET_LAYOUT, MEET_TUNING } from '../game/meetTuning';
import { countedTotalText, type MeetDayAttempt, type MeetRecap } from '../game/meetDay';
import type { CareerMeetOutcome } from '../game/careerServer';
import { useOfferCutIn } from '../cutin/CutInHost';
import { AttemptBoard } from './AttemptBoard';
import { careerRecapLines } from './careerSurface';
import { MeetBookendRoom } from './MeetBookendRoom';
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
  /**
   * What this result did to the career (GDD §6.5, Sprint 1b): the server's
   * `CareerMeetOutcome` off `RecordedMeet.career`, computed by
   * `careerServer.ts` inside `applyMeetResult` against the same row every
   * other number on this screen came from. `null` draws nothing — the debug
   * harness may render a recap with no recorded meet behind it.
   */
  readonly career?: CareerMeetOutcome | null;
  readonly onSeeCard: () => void;
}

export function RecapView({
  recap,
  attempts,
  career = null,
  onSeeCard,
}: RecapViewProps): React.ReactElement {
  const to = recap.totalKg ?? 0;
  const from = recap.previousBestTotalKg ?? to;
  const counted = useCountUp(
    from,
    to,
    recap.isTotalPr && recap.totalKg !== null ? MEET_TUNING.RECAP_TOTAL_COUNT_MS : 0,
    MEET_TUNING.RECAP_ROW_STAGGER_MS,
  );

  // GDD §7.2's PR moments, offered. Two beats rather than one, because a meet
  // can set a new total and a new best in a single lift at once and the gate is
  // the thing that ranks them.
  useOfferCutIn([
    { kind: 'record', record: 'total', achieved: recap.isTotalPr },
    { kind: 'record', record: 'e1rm', achieved: recap.rows.some((row) => row.isPr) },
  ]);

  return (
    <MeetBookendRoom testID="meet-recap">
      <View style={styles.root}>
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
        {/* GDD §6.5's career lines (Sprint 1b), on the total's own beat: the
            standing career best and the tiers this result newly qualified —
            `careerRecapLines` over the server's own outcome, nothing derived
            here. Same stagger slot as the total, because they are about it. */}
        {career === null
          ? null
          : careerRecapLines(career).map((line) => (
              <Text
                key={line.kind}
                style={[styles.prText, line.kind === 'qualified' ? styles.prTextHot : null]}
                testID={`recap-${line.kind}`}
              >
                {line.text}
              </Text>
            ))}
      </Block>

      <Block index={MEET_TUNING.RECAP_ROW_ORDER.LIFTS}>
        <Text style={styles.sectionLabel}>{MEET_COPY.RECAP_ATTEMPTS_LABEL}</Text>
        <View style={styles.boards}>
          {LIFT_ORDER.map((lift, index) => (
            <AttemptBoard
              key={lift}
              lift={lift}
              attempts={attempts}
              callOut={recap.rows[index]?.callOut ?? undefined}
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

      {recap.whyLines.length === 0 ? null : (
        <Block index={MEET_TUNING.RECAP_ROW_ORDER.WHY}>
          <Text style={styles.sectionLabel}>{MEET_COPY.RECAP_WHY_LABEL}</Text>
          {recap.whyLines.map((line) => (
            <Text key={line} style={styles.prText} testID="recap-why">
              {line}
            </Text>
          ))}
        </Block>
      )}

      <Block index={MEET_TUNING.RECAP_ROW_ORDER.CARD}>
        <MotionPressable
          style={styles.action}
          accessibilityRole="button"
          onPress={onSeeCard}
          testID="recap-action"
        >
          <Text style={styles.actionLabel}>{MEET_COPY.RECAP_ACTION}</Text>
        </MotionPressable>
      </Block>
      </View>
    </MeetBookendRoom>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: L.BOOKEND_CARD_GAP,
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
