/**
 * CheckInView — GDD §3.2's "Readiness check-in (5 sec, 3 taps)".
 *
 * ---------------------------------------------------------------------------
 * WHY ALL THREE QUESTIONS ARE ON ONE SCREEN
 * ---------------------------------------------------------------------------
 * The bar this piece is measured against (GDD §12.2) names TIME-TO-FIRST-INPUT
 * first. One question per screen would be three paints and two transitions
 * before the third tap; three readiness rows on one screen means the first tap
 * is live on the first paint and the other two need no navigation at all.
 * Today's lift is offered as chips on that same first paint, defaulting to
 * the rotation, so choosing bench is not a screen in front of the first
 * question. There is no splash, no home screen and no "start session" button
 * in front of it, because every one of those is a tap that answers nothing.
 *
 * Presentation (A-VIS-01): Iron & Amber panel 03 facility-first. The three
 * taps stay; the card is a compact drawer over the day's lifter plate, not a
 * four-row form plus a lecture. Lift chips sit as one strip; sleep / soreness
 * / motivation sit as one three-column band (still three taps, one paint).
 * GDD §3.2 is the path, not the layout.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE IS AND IS NOT ALLOWED TO KNOW
 * ---------------------------------------------------------------------------
 * It renders today's lift chips plus three rows of three readiness chips and
 * forwards taps. It scores nothing:
 * the readiness score, the band and the load percentage are `fatigue.ts`'s, and
 * they are computed in `session.ts` when the third tap lands (CLAUDE.md: "If
 * you find yourself computing a load or a fatigue modifier inside a .tsx file,
 * stop"). This screen does not even know which readiness answer is the good one.
 *
 * NO FATIGUE READOUT (GDD §3.4, §12.3). Nothing here shows how tired the lifter
 * is, and it cannot: the only thing on screen is what the player just tapped.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from '../ui/MotionPressable';

import { SESSION_COPY, SESSION_LAYOUT, SESSION_TUNING, type CheckInQuestion } from '../game/sessionTuning';
import type { CheckInTap, PartialCheckIn } from '../game/session';
import type { OnboardingDisclosure } from '../game/onboardingDisclosure';
import type { LiftKind } from '../game/meet';
import { SESSION_PALETTE } from './sessionPalette';
import { IronAmberCard, IronAmberRoom } from './IronAmberRoom';

const L = SESSION_LAYOUT;

interface Option {
  readonly value: string;
  readonly label: string;
  readonly tap: CheckInTap;
}

interface RowSpec {
  readonly question: CheckInQuestion;
  readonly options: readonly Option[];
  readonly chosen: (answers: PartialCheckIn) => string | null;
}

/**
 * The three rows, in the order GDD §3.2 lists them, each with its answers in
 * worst-to-best order.
 *
 * The ORDER and the LABELS are presentation and live here; the SCORES are
 * `fatigue.ts`'s and do not appear in this file at all — a `CheckInTap` names
 * an answer and nothing else. `sessionTuning.test.ts` asserts the copy table
 * covers exactly the answers the model scores, so a row cannot drift out of
 * sync with the model behind it.
 *
 * Written out per question rather than derived from a generic, because each
 * question's answers are a different union and `CheckInTap` is discriminated on
 * the question — spelling them out is what makes the tap builders typecheck
 * without a cast that could pair the wrong answer with the wrong question.
 */
const ROWS: readonly RowSpec[] = [
  {
    question: 'sleep',
    chosen: (answers) => answers.sleep,
    options: (['poor', 'ok', 'good'] as const).map((answer) => ({
      value: answer,
      label: SESSION_COPY.CHECK_IN_ANSWER.sleep[answer],
      tap: { question: 'sleep', answer },
    })),
  },
  {
    question: 'soreness',
    chosen: (answers) => answers.soreness,
    options: (['sore', 'normal', 'fresh'] as const).map((answer) => ({
      value: answer,
      label: SESSION_COPY.CHECK_IN_ANSWER.soreness[answer],
      tap: { question: 'soreness', answer },
    })),
  },
  {
    question: 'motivation',
    chosen: (answers) => answers.motivation,
    options: (['flat', 'steady', 'fired-up'] as const).map((answer) => ({
      value: answer,
      label: SESSION_COPY.CHECK_IN_ANSWER.motivation[answer],
      tap: { question: 'motivation', answer },
    })),
  },
];

export interface CheckInViewProps {
  readonly answers: PartialCheckIn;
  readonly lift: LiftKind;
  /**
   * GDD §4.2's first-run disclosures, already decided. Empty for everyone but
   * a lifter on their first run of the first-run lift.
   *
   * The decision is `onboardingDisclosure.ts`'s and the sentences travel with
   * it, so this screen chooses nothing and looks nothing up — it renders what
   * it was handed, which is the only way a test asserting a sentence is
   * asserting the sentence a player sees.
   */
  readonly disclosures: readonly OnboardingDisclosure[];
  readonly onTap: (tap: CheckInTap) => void;
  readonly onChooseLift: (lift: LiftKind) => void;
}

export function CheckInView({
  answers,
  lift,
  disclosures,
  onTap,
  onChooseLift,
}: CheckInViewProps): React.ReactElement {
  return (
    <IronAmberRoom
      testID="session-check-in"
      gymTestID="iron-amber-check-in-gym"
      liftKind={lift}
      scroll={false}
    >
      <IronAmberCard dense maxHeight={L.CHECK_IN_DRAWER_MAX_HEIGHT}>
        <Text style={styles.title}>{SESSION_COPY.CHECK_IN_TITLE}</Text>
        <View style={styles.row} testID="check-in-lift">
          <Text style={styles.question}>{SESSION_COPY.CHECK_IN_LIFT_QUESTION}</Text>
          <View style={styles.chips}>
            {SESSION_TUNING.LIFT_ROTATION.map((option) => {
              const isChosen = option === lift;
              return (
                <MotionPressable
                  key={option}
                  testID={`check-in-lift-${option}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isChosen }}
                  accessibilityLabel={SESSION_COPY.LIFT_LABEL[option]}
                  onPress={() => onChooseLift(option)}
                  style={[styles.chip, isChosen ? styles.chipChosen : null]}
                >
                  <Text style={[styles.chipLabel, isChosen ? styles.chipLabelChosen : null]}>
                    {SESSION_COPY.LIFT_LABEL[option]}
                  </Text>
                </MotionPressable>
              );
            })}
          </View>
        </View>
        <View style={styles.questions}>
          {ROWS.map((row) => {
            const chosen = row.chosen(answers);
            return (
              <View key={row.question} style={styles.questionCol} testID={`check-in-${row.question}`}>
                <Text style={styles.question}>{SESSION_COPY.CHECK_IN_QUESTION[row.question]}</Text>
                <View style={styles.chipStack}>
                  {row.options.map((option) => {
                    const isChosen = chosen === option.value;
                    return (
                      <MotionPressable
                        key={option.value}
                        testID={`check-in-${row.question}-${option.value}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isChosen }}
                        accessibilityLabel={option.label}
                        onPress={() => onTap(option.tap)}
                        style={[styles.chip, styles.chipStacked, isChosen ? styles.chipChosen : null]}
                      >
                        <Text style={[styles.chipLabel, isChosen ? styles.chipLabelChosen : null]}>
                          {option.label}
                        </Text>
                      </MotionPressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
        {/*
          GDD §4.2's first-run disclosures, BELOW the three taps on purpose:
          this screen is held to §12.2's time-to-first-input bar, so the first
          tap has to stay on the first paint. Text costs no tap and no
          navigation; a screen in front of the questions would cost both. The
          block is a one-line footnote that scrolls, not a lecture wall —
          A-VIS-01: facility stays first.
        */}
        {disclosures.length > 0 ? (
          <ScrollView
            style={styles.disclosureScroll}
            contentContainerStyle={styles.disclosureScrollContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            testID="check-in-disclosures"
          >
            <Text style={styles.disclosureTitle} numberOfLines={1}>
              {SESSION_COPY.FIRST_RUN_TITLE}
            </Text>
            {disclosures.map((disclosure) => (
              <Text
                key={disclosure.id}
                testID={`check-in-disclosure-${disclosure.id}`}
                style={styles.disclosureLine}
              >
                {disclosure.line}
              </Text>
            ))}
          </ScrollView>
        ) : null}
      </IronAmberCard>
    </IronAmberRoom>
  );
}

const styles = StyleSheet.create({
  title: {
    color: SESSION_PALETTE.AMBER,
    fontSize: L.CHECK_IN_TITLE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: L.CHECK_IN_ROW_GAP,
  },
  questions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: L.CHECK_IN_ROW_GAP,
  },
  questionCol: {
    flex: 1,
    gap: L.CHECK_IN_ROW_GAP,
  },
  question: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.QUESTION_FONT,
    width: L.CHECK_IN_LABEL_COL,
    flexShrink: 0,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    gap: L.CHIP_GAP,
  },
  chipStack: {
    gap: L.CHECK_IN_ROW_GAP,
  },
  chip: {
    flex: 1,
    height: L.CHIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: L.CHIP_RADIUS,
    borderWidth: L.CHIP_BORDER,
    borderColor: SESSION_PALETTE.CHIP_EDGE,
    backgroundColor: SESSION_PALETTE.CHIP,
  },
  chipStacked: {
    flex: 0,
    width: '100%',
  },
  chipChosen: {
    backgroundColor: SESSION_PALETTE.CHIP_CHOSEN,
    borderColor: SESSION_PALETTE.CHIP_CHOSEN_EDGE,
  },
  chipLabel: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.ANSWER_FONT,
  },
  chipLabelChosen: {
    color: SESSION_PALETTE.IVORY,
    fontWeight: '700',
  },
  disclosureScroll: {
    maxHeight: L.CHECK_IN_DISCLOSURE_MAX_HEIGHT,
  },
  disclosureScrollContent: {
    gap: L.DISCLOSURE_GAP,
  },
  disclosureTitle: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.QUESTION_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  disclosureLine: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.DISCLOSURE_FONT,
    lineHeight: L.DISCLOSURE_LINE_HEIGHT,
  },
});
