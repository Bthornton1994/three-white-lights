/**
 * BriefingView — the opening training decision (GDD §3.2 as corrected): lift,
 * history readiness copy, and RPE on one screen.
 *
 * No subjective sleep / soreness / motivation taps. Readiness is inferred
 * from the training-history ledger and printed; this file computes nothing.
 *
 * GDD §3.3: the player picks RPE, not raw weight. The bar appears on the
 * platform after the choice.
 *
 * NO FATIGUE METER (GDD §3.4, §12.3). Copy only.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SESSION_COPY, SESSION_LAYOUT, SESSION_TUNING } from '../game/sessionTuning';
import type { InjuryNotice, ReadinessReport } from '../game/fatigue';
import type { LiftKind } from '../game/meet';
import type { OnboardingDisclosure } from '../game/onboardingDisclosure';
import { SESSION_PALETTE } from './sessionPalette';

const L = SESSION_LAYOUT;

function modifierColour(percent: number, band: ReadinessReport['band']): string {
  if (percent > 0) return SESSION_PALETTE.MODIFIER_UP;
  if (percent < 0) return SESSION_PALETTE.MODIFIER_DOWN;
  if (band === 'grinding') return SESSION_PALETTE.MODIFIER_DOWN;
  if (band === 'ready' || band === 'primed') return SESSION_PALETTE.MODIFIER_UP;
  return SESSION_PALETTE.MODIFIER_LEVEL;
}

function InjuryLine({ injury }: { readonly injury: InjuryNotice }): React.ReactElement {
  return (
    <View style={styles.injury} testID="session-injury">
      <Text style={styles.injuryHeadline}>{injury.headline}</Text>
      <Text style={styles.injuryDetail}>{injury.detail}</Text>
      <Text style={styles.injuryDetail}>{injury.reassurance}</Text>
    </View>
  );
}

export interface BriefingViewProps {
  readonly lift: LiftKind;
  readonly readiness: ReadinessReport;
  readonly injury: InjuryNotice | null;
  readonly workSets: number;
  readonly repsPerSet: number;
  readonly disclosures: readonly OnboardingDisclosure[];
  readonly ladderReady: boolean;
  readonly onChooseRpe: (rpe: number) => void;
  readonly onChooseLift: (lift: LiftKind) => void;
}

export function BriefingView({
  lift,
  readiness,
  injury,
  workSets,
  repsPerSet,
  disclosures,
  ladderReady,
  onChooseRpe,
  onChooseLift,
}: BriefingViewProps): React.ReactElement {
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = withTiming(1, { duration: SESSION_TUNING.BRIEFING_REVEAL_MS });
  }, [reveal]);
  const ladderStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));

  return (
    <View style={styles.root} testID="session-briefing">
      <View style={styles.lights} testID="session-lights">
        {([0, 1, 2] as const).map((index) => (
          <View key={index} testID={`session-light-${index}`} style={styles.light} />
        ))}
      </View>
      <Text style={styles.title}>{SESSION_COPY.CHECK_IN_TITLE}</Text>

      <View style={styles.row} testID="check-in-lift">
        <Text style={styles.question}>{SESSION_COPY.CHECK_IN_LIFT_QUESTION}</Text>
        <View style={styles.chips}>
          {SESSION_TUNING.LIFT_ROTATION.map((option) => {
            const isChosen = option === lift;
            return (
              <Pressable
                key={option}
                testID={`check-in-lift-${option}`}
                accessibilityRole="button"
                onPress={() => onChooseLift(option)}
                style={[styles.chip, isChosen ? styles.chipChosen : null]}
              >
                <Text
                  style={[styles.chipLabel, isChosen ? styles.chipLabelChosen : null]}
                  numberOfLines={1}
                >
                  {SESSION_COPY.LIFT_LABEL[option]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text
        style={[styles.modifier, { color: modifierColour(readiness.loadAdjustmentPercent, readiness.band) }]}
        testID="session-modifier"
      >
        {readiness.label}
      </Text>
      {readiness.detail === '' ? null : (
        <Text style={styles.detail} testID="session-readiness-detail">
          {readiness.detail}
        </Text>
      )}
      <Text style={styles.plan} testID="session-plan">
        {`${workSets} ${SESSION_COPY.BRIEFING_PLAN} × ${repsPerSet}`}
      </Text>

      {injury === null ? null : <InjuryLine injury={injury} />}

      {disclosures.length > 0 ? (
        <View style={styles.disclosures} testID="check-in-disclosures">
          <Text style={styles.disclosureTitle}>{SESSION_COPY.FIRST_RUN_TITLE}</Text>
          {disclosures.map((disclosure) => (
            <Text
              key={disclosure.id}
              testID={`check-in-disclosure-${disclosure.id}`}
              style={styles.disclosureLine}
            >
              {disclosure.line}
            </Text>
          ))}
        </View>
      ) : null}

      <Animated.View style={[styles.ladderBlock, ladderStyle]}>
        <Text style={styles.prompt}>{SESSION_COPY.BRIEFING_PROMPT}</Text>
        <View style={styles.ladder} testID="session-rpe-ladder">
          {SESSION_TUNING.RPE_CHOICES.map((rpe, index) => (
            <Pressable
              key={rpe}
              testID={`session-rpe-${rpe}`}
              accessibilityRole="button"
              disabled={!ladderReady}
              onPress={() => onChooseRpe(rpe)}
              style={[
                styles.rung,
                index === SESSION_TUNING.DEFAULT_RPE_INDEX ? styles.rungSuggested : null,
              ]}
            >
              <Text
                style={[
                  styles.rungLabel,
                  index === SESSION_TUNING.DEFAULT_RPE_INDEX ? styles.rungLabelSuggested : null,
                ]}
              >
                {rpe}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>{SESSION_COPY.BRIEFING_RPE_HINT}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: L.SCREEN_PAD,
    paddingTop: L.SAFE_AREA_FALLBACK,
    paddingBottom: L.SAFE_AREA_FALLBACK,
    gap: L.ROW_GAP,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  lights: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: L.PIP_GAP,
    width: '100%',
  },
  light: {
    width: L.PIP_SIZE,
    height: L.PIP_SIZE,
    borderRadius: L.PIP_SIZE / 2,
    backgroundColor: SESSION_PALETTE.LIGHT,
  },
  title: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.HEADLINE_FONT,
    fontWeight: '800',
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  row: {
    gap: L.ROW_GAP,
    width: '100%',
  },
  question: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.QUESTION_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: L.CHIP_GAP,
    width: '100%',
  },
  chip: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: L.CHIP_MIN_WIDTH,
    minWidth: L.CHIP_MIN_WIDTH,
    minHeight: L.TOUCH_MIN,
    height: L.CHIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: L.CHIP_RADIUS,
    borderWidth: L.CHIP_BORDER,
    borderColor: SESSION_PALETTE.CHIP_EDGE,
    backgroundColor: SESSION_PALETTE.CHIP,
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
    color: SESSION_PALETTE.ACTION_TEXT,
    fontWeight: '800',
  },
  modifier: {
    fontSize: L.MODIFIER_FONT,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
    width: '100%',
  },
  detail: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    lineHeight: L.BODY_LINE_HEIGHT,
    textAlign: 'center',
    width: '100%',
    flexShrink: 1,
  },
  plan: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.PLAN_FONT,
    textAlign: 'center',
  },
  injury: {
    marginTop: L.ROW_GAP,
    gap: L.ROW_GAP / 2,
    alignItems: 'center',
    width: '100%',
  },
  injuryHeadline: {
    color: SESSION_PALETTE.GRIND,
    fontSize: L.PROMPT_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
  },
  injuryDetail: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    lineHeight: L.BODY_LINE_HEIGHT,
    textAlign: 'center',
    width: '100%',
  },
  ladderBlock: {
    marginTop: L.SECTION_GAP,
    gap: L.ROW_GAP,
    width: '100%',
  },
  prompt: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.PROMPT_FONT,
    fontWeight: '800',
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '100%',
    flexShrink: 1,
  },
  ladder: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: L.RPE_CHIP_GAP,
    width: '100%',
    justifyContent: 'center',
  },
  rung: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: L.RPE_CHIP_MIN_WIDTH,
    minWidth: L.RPE_CHIP_MIN_WIDTH,
    minHeight: L.TOUCH_MIN,
    height: L.RPE_CHIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: L.CHIP_RADIUS,
    borderWidth: L.CHIP_BORDER,
    borderColor: SESSION_PALETTE.CHIP_EDGE,
    backgroundColor: SESSION_PALETTE.CHIP,
  },
  rungSuggested: {
    backgroundColor: SESSION_PALETTE.ACTION,
    borderColor: SESSION_PALETTE.RPE_SUGGESTED_EDGE,
  },
  rungLabel: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.ANSWER_FONT,
    fontWeight: '700',
  },
  rungLabelSuggested: {
    color: SESSION_PALETTE.ACTION_TEXT,
    fontWeight: '800',
  },
  hint: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    lineHeight: L.BODY_LINE_HEIGHT,
    textAlign: 'center',
    width: '100%',
    flexShrink: 1,
  },
  disclosures: {
    gap: L.DISCLOSURE_GAP,
    width: '100%',
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
