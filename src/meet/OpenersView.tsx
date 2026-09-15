/**
 * OpenersView — GDD §6.1's opening attempts.
 *
 * "Opening attempts pre-filled from current Sim-mode e1RM data as a suggested
 * safe opener. Player can override."
 *
 * Both halves of that sentence are on the screen at once: the number arrives
 * already filled in, and each row says whether it is still the suggestion or
 * the lifter's own call. Nothing forces a change and nothing blocks one.
 *
 * ALL THREE OPENERS ARE DECLARED HERE, which is how a real meet runs — a lifter
 * hands in all three at weigh-in and the attempt card only asks again between
 * attempts. It is also what keeps GDD §6.3's choice a choice about ATTEMPTS
 * rather than about openers: the ratchet has not started yet, so there is
 * nothing to ratchet against.
 *
 * NO ARITHMETIC HERE. The step size is the meet's own declaration increment,
 * read off `meetLoadingRules`, and the machine refuses a weight the engine
 * would not accept. This file adds and subtracts nothing it did not read.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from '../ui/MotionPressable';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { MEET_COPY, MEET_LAYOUT, MEET_TUNING } from '../game/meetTuning';
import { LIFT_ORDER, type LiftKind } from '../game/meet';
import { formatWeight } from '../game/resultCard';
import { MeetBookendRoom } from './MeetBookendRoom';
import { MEET_PALETTE } from './meetPalette';

const L = MEET_LAYOUT;

/** A row that fades in on its own beat, so the card assembles. */
function Row({ index, children }: { readonly index: number; readonly children: React.ReactNode }): React.ReactElement {
  const shown = useSharedValue(0);
  React.useEffect(() => {
    shown.value = withDelay(
      index * MEET_TUNING.OPENER_ROW_STAGGER_MS,
      withTiming(1, { duration: MEET_TUNING.OPENER_ROW_FADE_MS }),
    );
  }, [index, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return <Animated.View style={[styles.row, style]}>{children}</Animated.View>;
}

export interface OpenersViewProps {
  readonly openersKg: Readonly<Record<LiftKind, number>>;
  readonly overridden: Readonly<Record<LiftKind, boolean>>;
  /** The meet's declaration grid. One tap moves the bar by exactly this. */
  readonly stepKg: number;
  readonly onSet: (lift: LiftKind, weightKg: number) => void;
  readonly onConfirm: () => void;
}

export function OpenersView({
  openersKg,
  overridden,
  stepKg,
  onSet,
  onConfirm,
}: OpenersViewProps): React.ReactElement {
  return (
    <MeetBookendRoom
      testID="meet-openers"
      sport={
        <View style={styles.rows}>
          {LIFT_ORDER.map((lift, index) => (
            <Row key={lift} index={index}>
              <View style={styles.rowInner} testID={`opener-row-${lift}`}>
                <View style={styles.rowLabel}>
                  <Text style={styles.liftLabel}>{MEET_COPY.LIFT_LABEL[lift]}</Text>
                  <Text style={styles.source}>
                    {overridden[lift] ? MEET_COPY.OPENERS_CHANGED : MEET_COPY.OPENERS_SUGGESTED}
                  </Text>
                </View>
                <MotionPressable
                  style={styles.stepper}
                  accessibilityRole="button"
                  onPress={() => onSet(lift, openersKg[lift] - stepKg)}
                  testID={`opener-down-${lift}`}
                >
                  <Text style={styles.stepperLabel}>−</Text>
                </MotionPressable>
                <Text style={styles.weight} testID={`opener-weight-${lift}`}>
                  {formatWeight(openersKg[lift])}
                </Text>
                <MotionPressable
                  style={styles.stepper}
                  accessibilityRole="button"
                  onPress={() => onSet(lift, openersKg[lift] + stepKg)}
                  testID={`opener-up-${lift}`}
                >
                  <Text style={styles.stepperLabel}>+</Text>
                </MotionPressable>
              </View>
            </Row>
          ))}
        </View>
      }
      footer={
        <MotionPressable
          style={styles.action}
          accessibilityRole="button"
          onPress={onConfirm}
          testID="openers-action"
        >
          <Text style={styles.actionLabel}>{MEET_COPY.OPENERS_ACTION}</Text>
        </MotionPressable>
      }
    >
      <View style={styles.root}>
      <Text style={styles.eyebrow}>{MEET_COPY.OPENERS_EYEBROW}</Text>
      <Text style={styles.hint}>{MEET_COPY.OPENERS_HINT}</Text>
      <Text style={styles.getIn} testID="openers-get-in">
        {MEET_COPY.OPENERS_GET_IN}
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
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.EYEBROW_FONT,
    letterSpacing: L.WIDE_LETTER_SPACING,
  },
  hint: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    textAlign: 'center',
    paddingBottom: L.ROW_GAP,
  },
  getIn: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.HINT_FONT,
    textAlign: 'center',
    paddingBottom: L.ROW_GAP,
  },
  rows: {
    alignSelf: 'stretch',
    gap: L.ROW_GAP,
  },
  row: {
    alignSelf: 'stretch',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: L.BOOKEND_OPENER_ROW_HEIGHT,
    gap: L.ROW_GAP,
  },
  rowLabel: {
    flex: 1,
    gap: L.ROW_GAP / 2,
  },
  liftLabel: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.TITLE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  source: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  stepper: {
    width: L.STEPPER_SIZE,
    height: L.STEPPER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: L.STEPPER_RADIUS,
    backgroundColor: MEET_PALETTE.CARD_SAFE,
    borderWidth: L.CARD_BORDER,
    borderColor: MEET_PALETTE.CARD_SAFE_EDGE,
  },
  stepperLabel: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.SUBHEAD_FONT,
    fontWeight: '700',
  },
  weight: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.MID_NUMBER_FONT,
    fontWeight: '700',
    minWidth: L.BOARD_CELL_W,
    textAlign: 'center',
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
