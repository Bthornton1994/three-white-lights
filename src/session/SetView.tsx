/**
 * SetView — the reps, played on the mechanic that already exists.
 *
 * Phone-first: the stage scales to the visible width so the bar-path panel
 * cannot hang off the right edge, and instructional copy wraps or collapses
 * instead of clipping. Meet-day AttemptView is untouched.
 *
 * NO MECHANIC LOGIC AND NO FATIGUE READOUT (GDD §3.4, §12.3).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { LiftStage } from '../lift/LiftStage';
import { useLiftLoop } from '../lift/useLiftLoop';
import { totalKgFor } from '../lift/liftFrame';
import {
  PRESS_NOT_SELECT,
  PRESS_NOT_TAKEN,
  PRESS_WITHOUT_DELAY,
  SUPPRESS_CONTEXT_MENU,
} from '../lift/pressGuard';
import { pressCommandIsLive, promptFor, type LiftOutcome } from '../game/lift';
import { LIFT_COPY, LIFT_TUNING } from '../game/liftTuning';
import { SESSION_COPY, SESSION_LAYOUT, SESSION_TUNING } from '../game/sessionTuning';
import {
  currentSetNumber,
  executionQualityFrom,
  repConfigFor,
  type SessionState,
} from '../game/session';
import { SESSION_PALETTE } from './sessionPalette';
import { LIFT_PALETTE } from '../lift/liftPalette';

const L = SESSION_LAYOUT;
const STAGE = LIFT_TUNING.LAYOUT;

const OUTCOME_COLOUR: Record<LiftOutcome, string> = {
  'good-lift': SESSION_PALETTE.GOOD,
  grind: SESSION_PALETTE.GRIND,
  miss: SESSION_PALETTE.MISS,
};

function RepPips({
  reps,
  done,
  live,
}: {
  readonly reps: number;
  readonly done: number;
  readonly live: boolean;
}): React.ReactElement {
  return (
    <View style={styles.pips} testID="session-rep-pips">
      {Array.from({ length: reps }, (_unused, index) => (
        <View
          key={index}
          style={[
            styles.pip,
            index < done
              ? styles.pipDone
              : live && index === done
                ? styles.pipLive
                : styles.pipTodo,
          ]}
        />
      ))}
    </View>
  );
}

export interface SetViewProps {
  readonly state: SessionState;
  readonly onRepResolved: (outcome: LiftOutcome, executionQuality: number) => void;
}

export function SetView({ state, onRepResolved }: SetViewProps): React.ReactElement {
  const plan = state.plan;
  const setIndex = state.setIndex;
  const repIndex = state.repIndex;
  const config = useMemo(
    () => repConfigFor(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setIndex, repIndex, plan],
  );
  const loop = useLiftLoop(config);
  const { restart, onPressIn, onPressOut } = loop;

  const [stageWidth, setStageWidth] = useState<number>(STAGE.STAGE_W);
  const [instructionsOpen, setInstructionsOpen] = useState(true);

  const onStageSlotLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && next !== stageWidth) setStageWidth(next);
  }, [stageWidth]);

  const fittedScale = Math.max(
    L.STAGE_FIT_MIN_SCALE,
    Math.min(1, stageWidth / STAGE.STAGE_W),
  );

  const repKey = `${state.setIndex}:${state.repIndex}`;
  const lastRepKey = useRef<string>(repKey);
  useEffect(() => {
    if (lastRepKey.current === repKey) return;
    lastRepKey.current = repKey;
    restart(config.loadRatio);
  }, [repKey, restart, config.loadRatio]);

  const resolution = loop.state.resolution;
  const resolved = loop.state.phase === 'RESOLVED';
  const outcome = resolution === null ? null : resolution.outcome;
  const handOff = useCallback(() => {
    if (outcome !== null && resolution !== null) {
      onRepResolved(outcome, executionQualityFrom(resolution));
    }
  }, [outcome, resolution, onRepResolved]);
  useEffect(() => {
    if (!resolved || outcome === null) return undefined;
    const timer = setTimeout(handOff, SESSION_TUNING.REP_RESULT_HOLD_MS);
    return () => clearTimeout(timer);
  }, [resolved, outcome, handOff]);

  if (plan === null) return <View style={styles.root} />;

  const totalKg = totalKgFor(plan.loadRatio, plan.e1rmKg);
  const setNumber = currentSetNumber(state);
  const instruction =
    resolution === null || resolution.detail === ''
      ? LIFT_COPY.SUBTITLE[loop.state.config.kind]
      : resolution.detail;

  return (
    <View style={styles.root} testID="session-set" {...SUPPRESS_CONTEXT_MENU}>
      <View style={styles.header}>
        <Text style={styles.setLabel} testID="session-set-label">
          {`${SESSION_COPY.SET_LABEL} ${setNumber} ${SESSION_COPY.SET_OF} ${plan.workSets}`}
        </Text>
        <Text style={styles.weight} testID="session-weight">
          {`${totalKg} kg`}
        </Text>
        <RepPips reps={plan.repsPerSet} done={state.repIndex} live={!resolved} />
        <Text
          style={[
            styles.prompt,
            pressCommandIsLive(loop.state)
              ? {
                  fontSize: LIFT_TUNING.LAYOUT.HEADLINE_FONT,
                  color: LIFT_PALETTE.CUE_PERFECT,
                }
              : null,
            resolution === null ? null : { color: OUTCOME_COLOUR[resolution.outcome] },
          ]}
          testID="session-prompt"
        >
          {resolution === null ? promptFor(loop.state) : resolution.headline}
        </Text>
        {instructionsOpen ? (
          <Text style={styles.detail} testID="session-detail">
            {instruction}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => setInstructionsOpen((open) => !open)}
          style={styles.instructionToggle}
          testID="session-instruction-toggle"
        >
          <Text style={styles.instructionToggleLabel}>
            {instructionsOpen ? SESSION_COPY.INSTRUCTION_DISMISS : SESSION_COPY.INSTRUCTION_SHOW}
          </Text>
        </Pressable>
      </View>

      <View style={styles.stageSlot} onLayout={onStageSlotLayout}>
        <View
          style={[
            styles.stageScaler,
            {
              width: STAGE.STAGE_W * fittedScale,
              height: STAGE.STAGE_H * fittedScale,
            },
          ]}
        >
          <Pressable
            style={[
              styles.stage,
              {
                transform: [
                  { translateX: ((fittedScale - 1) * STAGE.STAGE_W) / 2 },
                  { translateY: ((fittedScale - 1) * STAGE.STAGE_H) / 2 },
                  { scale: fittedScale },
                ],
              },
            ]}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            testID="session-touch"
            {...PRESS_WITHOUT_DELAY}
          >
            <LiftStage state={loop.state} history={loop.history} totalKg={totalKg} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    paddingHorizontal: L.SCREEN_PAD,
    paddingTop: L.SAFE_AREA_FALLBACK,
    ...PRESS_NOT_SELECT,
  },
  header: {
    alignItems: 'center',
    gap: L.ROW_GAP / 2,
    paddingVertical: L.ROW_GAP,
    width: '100%',
    maxWidth: '100%',
  },
  setLabel: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.TITLE_FONT,
    fontWeight: '800',
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '100%',
    flexShrink: 1,
  },
  weight: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
  },
  pips: {
    flexDirection: 'row',
    gap: L.PIP_GAP,
    paddingVertical: L.ROW_GAP / 2,
  },
  pip: {
    width: L.PIP_SIZE,
    height: L.PIP_SIZE,
    borderRadius: L.PIP_SIZE / 2,
  },
  pipDone: { backgroundColor: SESSION_PALETTE.PIP_DONE },
  pipLive: { backgroundColor: SESSION_PALETTE.PIP_LIVE },
  pipTodo: { backgroundColor: SESSION_PALETTE.PIP_TODO },
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
  detail: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    lineHeight: L.INSTRUCTION_LINE_HEIGHT,
    textAlign: 'center',
    width: '100%',
    flexShrink: 1,
  },
  instructionToggle: {
    minHeight: L.TOUCH_MIN,
    minWidth: L.TOUCH_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: L.SCREEN_PAD,
  },
  instructionToggleLabel: {
    color: SESSION_PALETTE.ACTION,
    fontSize: L.LABEL_FONT,
    fontWeight: '800',
    letterSpacing: L.LETTER_SPACING,
    textTransform: 'uppercase',
  },
  stageSlot: {
    width: '100%',
    maxWidth: '100%',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stageScaler: {
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  stage: {
    width: STAGE.STAGE_W,
    height: STAGE.STAGE_H,
    // The half that does NOT inherit, so it has to be here, on the element the
    // press lands in. Without it this Pressable computes `touch-action:
    // manipulation` and 20px of finger drift hands the descent to the browser.
    ...PRESS_NOT_TAKEN,
  },
});
