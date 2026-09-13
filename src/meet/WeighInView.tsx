/**
 * WeighInView — GDD §6.1's weigh-in beat.
 *
 * "Weigh-in beat: pick weight class, water-cut flavor text if cutting close.
 * Flavor only — no dieting mechanic."
 *
 * FLAVOUR ONLY IS ENFORCED BY THERE BEING NOTHING TO PRESS. The class is
 * derived from the bodyweight (`weighInFor`, which is `meetDay.ts`'s and reads
 * `resultCard.ts`'s published class list), the cut line is one sentence, and
 * the only control on the screen moves the player forward. No number on this
 * screen is an input, so there is no dieting mechanic to accidentally build.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from '../ui/MotionPressable';

import { MEET_COPY, MEET_LAYOUT } from '../game/meetTuning';
import { formatWeight } from '../game/resultCard';
import type { WeighIn } from '../game/meetDay';
import { MeetBookendRoom } from './MeetBookendRoom';
import { MEET_PALETTE } from './meetPalette';

const L = MEET_LAYOUT;

export interface WeighInViewProps {
  readonly weighIn: WeighIn;
  readonly lifterName: string;
  readonly meetName: string;
  readonly federation: string;
  readonly categoryText: string;
  readonly onConfirm: () => void;
}

export function WeighInView({
  weighIn,
  lifterName,
  meetName,
  federation,
  categoryText,
  onConfirm,
}: WeighInViewProps): React.ReactElement {
  return (
    <MeetBookendRoom
      testID="meet-weigh-in"
      footer={
        <MotionPressable
          style={styles.action}
          accessibilityRole="button"
          onPress={onConfirm}
          testID="weigh-in-action"
        >
          <Text style={styles.actionLabel}>{MEET_COPY.WEIGH_IN_ACTION}</Text>
        </MotionPressable>
      }
    >
      <View style={styles.root}>
      <Text style={styles.eyebrow}>{MEET_COPY.WEIGH_IN_EYEBROW}</Text>
      <Text style={styles.federation}>{federation.toUpperCase()}</Text>
      <Text style={styles.meetName} testID="meet-name">
        {meetName}
      </Text>

      <View style={styles.divider} />

      <Text style={styles.lifter} testID="meet-lifter">
        {lifterName}
      </Text>
      <Text style={styles.category}>{categoryText}</Text>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue} testID="weigh-in-bodyweight">
            {formatWeight(weighIn.bodyweightKg)}
          </Text>
          <Text style={styles.statLabel}>{MEET_COPY.WEIGH_IN_BODYWEIGHT_LABEL}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue} testID="weigh-in-class">
            {weighIn.weightClassText}
          </Text>
          <Text style={styles.statLabel}>{MEET_COPY.WEIGH_IN_CLASS_LABEL}</Text>
        </View>
      </View>

      <Text
        style={[styles.flavour, weighIn.cuttingClose ? styles.flavourTight : null]}
        testID="weigh-in-flavour"
      >
        {weighIn.flavourText}
      </Text>
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
  eyebrow: {
    color: MEET_PALETTE.AMBER,
    fontSize: L.EYEBROW_FONT,
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  federation: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  meetName: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.HEADLINE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  divider: {
    height: L.DIVIDER_HEIGHT,
    alignSelf: 'stretch',
    backgroundColor: MEET_PALETTE.DIVIDER,
    marginVertical: L.ROW_GAP,
  },
  lifter: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.TITLE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  category: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  stats: {
    flexDirection: 'row',
    gap: L.SECTION_GAP,
    paddingVertical: L.BOOKEND_CARD_GAP,
  },
  stat: {
    alignItems: 'center',
    gap: L.ROW_GAP / 2,
  },
  statValue: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.MID_NUMBER_FONT,
    fontWeight: '700',
  },
  statLabel: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  flavour: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.BODY_FONT,
    textAlign: 'center',
  },
  flavourTight: {
    color: MEET_PALETTE.WALKOUT_URGENT,
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
