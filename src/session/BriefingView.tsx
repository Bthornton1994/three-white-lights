/**
 * BriefingView — the opening training decision (GDD §3.2 as corrected): lift,
 * history readiness copy, and RPE on one screen.
 *
 * A×C IRON & AMBER Screen 03 family (PX TRAINING-FIT-02):
 * facility-first training gym, THREE WHITE LIGHTS, athletic lift hero,
 * readiness as a card, one-row effort pills, full-width amber START.
 * Licensed gym raster — not mockup isometric art. No Gym/Shop/Staff/Train
 * dock (Session B).
 *
 * No subjective sleep / soreness / motivation taps. Readiness is inferred
 * from the training-history ledger and printed; this file computes nothing.
 *
 * GDD §3.3: the player picks RPE, not raw weight. Tapping a rung still starts
 * the set. START starts the suggested rung.
 *
 * NO FATIGUE METER (GDD §3.4, §12.3). Copy only.
 */

import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { TrainingStagePreview } from './TrainingStagePreview';

const L = SESSION_LAYOUT;
const SUGGESTED_RPE = SESSION_TUNING.RPE_CHOICES[SESSION_TUNING.DEFAULT_RPE_INDEX];

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

  const startRpe = SUGGESTED_RPE === undefined ? SESSION_TUNING.RPE_CHOICES[0] : SUGGESTED_RPE;
  const overlayMaxPercent = L.STAGE_OVERLAY_MAX_PERCENT;

  return (
    <View style={styles.root} testID="session-briefing">
      <View style={styles.stageWrap}>
        <TrainingStagePreview />
        <View style={styles.brand} pointerEvents="none">
          <View style={styles.lights} testID="session-lights">
            {([0, 1, 2] as const).map((index) => (
              <View key={index} testID={`session-light-${index}`} style={styles.light} />
            ))}
          </View>
          <Text style={styles.brandMark}>{SESSION_COPY.BRAND_MARK}</Text>
        </View>
      </View>

      <View
        style={[styles.overlay, { maxHeight: `${overlayMaxPercent}%` }]}
        testID="session-briefing-overlay"
      >
        <View style={styles.overlayScrim} pointerEvents="none" />
        <ScrollView
          style={styles.overlayScroll}
          contentContainerStyle={styles.overlayContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <Text style={styles.kicker}>{SESSION_COPY.BRIEFING_KICKER}</Text>
        <Text style={styles.hero} testID="session-lift-hero">
          {SESSION_COPY.LIFT_HERO[lift]}
        </Text>

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

        <Text style={styles.plan} testID="session-plan">
          {`${workSets} ${SESSION_COPY.BRIEFING_PLAN} × ${repsPerSet}`}
        </Text>

        <View style={styles.card} testID="session-readiness-card">
          <View style={styles.cardAccent} />
          <View style={styles.cardBody}>
            <Text
              style={[
                styles.cardHeadline,
                { color: modifierColour(readiness.loadAdjustmentPercent, readiness.band) },
              ]}
              testID="session-modifier"
            >
              {readiness.label}
            </Text>
            {readiness.detail === '' ? null : (
              <Text style={styles.cardDetail} testID="session-readiness-detail">
                {readiness.detail}
              </Text>
            )}
          </View>
        </View>

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
            {SESSION_TUNING.RPE_CHOICES.map((rpe) => {
              const isSuggested = rpe === SUGGESTED_RPE;
              return (
                <Pressable
                  key={rpe}
                  testID={`session-rpe-${rpe}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${SESSION_COPY.BRIEFING_RPE_PREFIX} ${rpe}`}
                  disabled={!ladderReady}
                  onPress={() => onChooseRpe(rpe)}
                  style={[styles.rung, isSuggested ? styles.rungSuggested : null]}
                >
                  <Text
                    style={[styles.rungLabel, isSuggested ? styles.rungLabelSuggested : null]}
                    numberOfLines={1}
                  >
                    {`${rpe}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!ladderReady || startRpe === undefined}
            onPress={() => {
              if (startRpe !== undefined) onChooseRpe(startRpe);
            }}
            style={styles.start}
            testID="session-start-lift"
          >
            <Text style={styles.startLabel}>
              {`${SESSION_COPY.BRIEFING_START} ${SESSION_COPY.LIFT_LABEL[lift]}`}
            </Text>
          </Pressable>
        </Animated.View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  stageWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    minHeight: L.STAGE_PREVIEW_MIN_HEIGHT,
    width: '100%',
  },
  brand: {
    position: 'absolute',
    top: L.SAFE_AREA_FALLBACK,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: L.BRAND_LIGHT_GAP,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    maxWidth: '100%',
  },
  overlayScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: SESSION_PALETTE.BACKDROP,
    opacity: L.OVERLAY_SCRIM_OPACITY,
  },
  overlayScroll: {
    width: '100%',
    maxWidth: '100%',
  },
  overlayContent: {
    paddingHorizontal: L.SCREEN_PAD,
    paddingTop: L.SECTION_GAP,
    paddingBottom: L.NAV_CLEARANCE,
    gap: L.ROW_GAP,
    width: '100%',
  },
  lights: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: L.BRAND_LIGHT_GAP,
    width: '100%',
  },
  light: {
    width: L.BRAND_LIGHT_SIZE,
    height: L.BRAND_LIGHT_SIZE,
    borderRadius: L.BRAND_LIGHT_SIZE / 2,
    backgroundColor: SESSION_PALETTE.LIGHT,
  },
  brandMark: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.BRAND_FONT,
    fontWeight: '800',
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  kicker: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.TITLE_FONT,
    fontWeight: '800',
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  hero: {
    color: SESSION_PALETTE.TEXT,
    fontFamily: SESSION_PALETTE.TYPE_HERO,
    fontSize: L.HERO_FONT,
    fontWeight: '800',
    letterSpacing: L.HERO_LETTER_SPACING,
    lineHeight: L.HERO_LINE_HEIGHT,
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '100%',
    flexShrink: 1,
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
  plan: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.PLAN_FONT,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    borderRadius: L.CARD_RADIUS,
    borderWidth: L.CHIP_BORDER,
    borderColor: SESSION_PALETTE.CARD_EDGE,
    backgroundColor: SESSION_PALETTE.CARD,
    overflow: 'hidden',
  },
  cardAccent: {
    width: L.CARD_ACCENT_WIDTH,
    backgroundColor: SESSION_PALETTE.ACTION,
  },
  cardBody: {
    flex: 1,
    gap: L.ROW_GAP / 2,
    padding: L.CARD_PAD,
  },
  cardHeadline: {
    fontSize: L.MODIFIER_FONT,
    fontWeight: '700',
    width: '100%',
    flexShrink: 1,
  },
  cardDetail: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    lineHeight: L.BODY_LINE_HEIGHT,
    width: '100%',
    flexShrink: 1,
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
    flexWrap: 'nowrap',
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
    borderRadius: L.RPE_CHIP_HEIGHT / 2,
    borderWidth: L.CHIP_BORDER,
    borderColor: SESSION_PALETTE.CHIP_EDGE,
    backgroundColor: SESSION_PALETTE.CHIP,
    paddingHorizontal: L.CHIP_GAP,
  },
  rungSuggested: {
    backgroundColor: SESSION_PALETTE.CHIP,
    borderColor: SESSION_PALETTE.RPE_SUGGESTED_EDGE,
    borderWidth: L.RPE_SELECTED_BORDER,
  },
  rungLabel: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.ANSWER_FONT,
    fontWeight: '700',
  },
  rungLabelSuggested: {
    color: SESSION_PALETTE.ACTION,
    fontWeight: '800',
  },
  start: {
    alignSelf: 'stretch',
    minHeight: L.TOUCH_MIN,
    height: L.START_BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: L.BUTTON_RADIUS,
    backgroundColor: SESSION_PALETTE.ACTION,
    marginTop: L.ROW_GAP,
  },
  startLabel: {
    color: SESSION_PALETTE.ACTION_TEXT,
    fontSize: L.BUTTON_FONT,
    fontWeight: '800',
    letterSpacing: L.LETTER_SPACING,
    textTransform: 'uppercase',
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
