/**
 * BriefingView — GDD §3.2's "Modifier applied and surfaced" and GDD §3.3's RPE
 * choice, on ONE screen.
 *
 * ---------------------------------------------------------------------------
 * WHY THEY SHARE A SCREEN
 * ---------------------------------------------------------------------------
 * The modifier is the answer to the check-in the player just gave, and the RPE
 * ladder is the decision it informs. Splitting them would put a screen with
 * nothing to do on it between the two, which is exactly the flab GDD §12.2
 * measures. The modifier line is held for `BRIEFING_REVEAL_MS` so it registers
 * as a result rather than as a caption, and the ladder is live the moment that
 * beat ends.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE IS AND IS NOT ALLOWED TO KNOW
 * ---------------------------------------------------------------------------
 * The headline and the percentage are `ReadinessReport`, built by `fatigue.ts`;
 * this screen prints them. It computes no load, no percentage and no band.
 *
 * IT SHOWS NO WEIGHT EITHER, and that is the design rather than an omission.
 * GDD §3.3: "Player selects RPE target (6-10), NOT raw weight." Printing the
 * bar next to each rung would turn the choice back into picking a weight off a
 * list, which is the thing the mode exists not to be. The weight appears on the
 * platform, once the choice is made. The gold RPE 8 chip IS the primary
 * action — there is no second START tap that duplicates the choice.
 *
 * NO FATIGUE METER (GDD §3.4, §12.3). The only quantity on this screen is the
 * player's own check-in percentage.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from '../ui/MotionPressable';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SESSION_COPY, SESSION_LAYOUT, SESSION_TUNING } from '../game/sessionTuning';
import type { InjuryNotice, ReadinessReport } from '../game/fatigue';
import type { LiftKind } from '../game/meet';
import { SESSION_PALETTE } from './sessionPalette';
import { IronAmberCard, IronAmberRoom } from './IronAmberRoom';

const L = SESSION_LAYOUT;

function modifierColour(percent: number): string {
  if (percent > 0) return SESSION_PALETTE.MODIFIER_UP;
  if (percent < 0) return SESSION_PALETTE.MODIFIER_DOWN;
  return SESSION_PALETTE.MODIFIER_LEVEL;
}

/**
 * The setback line, when one is running (GDD §3.5).
 *
 * Copy only — the volume cut it describes was already applied by
 * `fatigue.ts`'s `cappedSession` when the plan was built. Framed as
 * recoverable, because §3.5 requires it to be, and the reassurance line comes
 * from the fatigue module rather than being written again here.
 */
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
  /** Live once the reveal beat has elapsed. */
  readonly ladderReady: boolean;
  readonly onChooseRpe: (rpe: number) => void;
}

export function BriefingView({
  lift,
  readiness,
  injury,
  workSets,
  repsPerSet,
  ladderReady,
  onChooseRpe,
}: BriefingViewProps): React.ReactElement {
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = withTiming(1, {
      duration: SESSION_TUNING.BRIEFING_REVEAL_MS,
      reduceMotion: ReduceMotion.System,
    });
  }, [reveal]);
  const ladderStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));

  return (
    <IronAmberRoom
      testID="session-briefing"
      gymTestID="iron-amber-briefing-gym"
      liftKind={lift}
    >
      <IronAmberCard>
        <Text style={styles.lift}>{SESSION_COPY.LIFT_LABEL[lift]}</Text>
        <Text
          style={[styles.modifier, { color: modifierColour(readiness.loadAdjustmentPercent) }]}
          testID="session-modifier"
        >
          {readiness.label}
        </Text>
        <Text style={styles.plan} testID="session-plan">
          {`${workSets} ${SESSION_COPY.BRIEFING_PLAN} × ${repsPerSet}`}
        </Text>

        {injury === null ? null : <InjuryLine injury={injury} />}

        <Animated.View style={[styles.ladderBlock, ladderStyle]}>
          <Text style={styles.prompt}>{SESSION_COPY.BRIEFING_PROMPT}</Text>
          <View style={styles.ladder} testID="session-rpe-ladder">
            {SESSION_TUNING.RPE_CHOICES.map((rpe, index) => (
              <MotionPressable
                key={rpe}
                testID={`session-rpe-${rpe}`}
                accessibilityRole="button"
                accessibilityLabel={`${SESSION_COPY.BRIEFING_PROMPT} ${rpe}`}
                accessibilityState={{
                  disabled: !ladderReady,
                  selected: index === SESSION_TUNING.DEFAULT_RPE_INDEX,
                }}
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
                    index === SESSION_TUNING.DEFAULT_RPE_INDEX
                      ? styles.rungLabelSuggested
                      : null,
                  ]}
                >
                  {rpe}
                </Text>
              </MotionPressable>
            ))}
          </View>
          <Text style={styles.hint}>{SESSION_COPY.BRIEFING_RPE_HINT}</Text>
        </Animated.View>
      </IronAmberCard>
    </IronAmberRoom>
  );
}

const styles = StyleSheet.create({
  lift: {
    color: SESSION_PALETTE.AMBER,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
  },
  modifier: {
    fontSize: L.MODIFIER_FONT,
    fontWeight: '700',
    textAlign: 'center',
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
  },
  injuryHeadline: {
    color: SESSION_PALETTE.GRIND,
    fontSize: L.PROMPT_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  injuryDetail: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    textAlign: 'center',
  },
  ladderBlock: {
    marginTop: L.SECTION_GAP,
    gap: L.ROW_GAP,
  },
  prompt: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.PROMPT_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
  },
  ladder: {
    flexDirection: 'row',
    gap: L.RPE_CHIP_GAP,
  },
  rung: {
    flex: 1,
    height: L.RPE_CHIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: L.CHIP_RADIUS,
    borderWidth: L.CHIP_BORDER,
    borderColor: SESSION_PALETTE.TEXT_DIM,
    backgroundColor: SESSION_PALETTE.CHIP,
  },
  rungSuggested: {
    borderColor: SESSION_PALETTE.RPE_SUGGESTED_EDGE,
    backgroundColor: SESSION_PALETTE.AMBER,
  },
  rungLabel: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.RPE_CHIP_FONT,
    fontWeight: '700',
  },
  rungLabelSuggested: {
    color: SESSION_PALETTE.AMBER_INK,
  },
  hint: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    textAlign: 'center',
  },
});
