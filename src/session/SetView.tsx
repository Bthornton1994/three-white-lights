/**
 * SetView — the reps, played on the mechanic that already exists.
 *
 * ---------------------------------------------------------------------------
 * NOTHING ABOUT THE REP IS REBUILT HERE
 * ---------------------------------------------------------------------------
 * `LiftStage` draws it, `useLiftLoop` clocks it and plays its haptics, and
 * `stepLift` decides it. This file adds exactly two things a standalone rep did
 * not need:
 *
 *   1. THE PRESCRIPTION. `useLiftLoop` is handed `repConfigFor(state)`, so the
 *      bar is the weight GDD §3.3's RPE choice produced and the timing window
 *      is whatever `fatigue.ts` made it for this point in the session. The
 *      standalone screen picks its load off a row of buttons; a session does
 *      not offer that choice mid-set.
 *   2. WHERE THE PLAYER IS. A set counter and rep pips, so four sets of three
 *      reads as a session rather than as twelve unrelated reps.
 *
 * `LiftScreen` itself is deliberately NOT reused whole: it owns a load selector
 * and its own load state, which is the Prototype-1 harness rather than a
 * session, and it takes no prescribed config. Its parts are what get reused.
 *
 * ---------------------------------------------------------------------------
 * WHY THE REP IS RESTARTED RATHER THAN REMOUNTED
 * ---------------------------------------------------------------------------
 * `useLiftLoop.restart` reuses the Skia canvas. Remounting per rep — the
 * obvious alternative, keyed on the rep index — would tear down and rebuild the
 * canvas twelve times a session, which is a visible hitch at exactly the moment
 * the player is about to be asked for a timing input.
 *
 * NO MECHANIC LOGIC AND NO FATIGUE READOUT (GDD §3.4, §12.3). Nothing here
 * computes a window, judges an outcome or displays a level.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LiftStage } from '../lift/LiftStage';
import { useLiftLoop } from '../lift/useLiftLoop';
import { totalKgFor } from '../lift/liftFrame';
import { PRESS_NOT_SELECT, PRESS_NOT_TAKEN, SUPPRESS_CONTEXT_MENU } from '../lift/pressGuard';
import { promptFor, type LiftOutcome } from '../game/lift';
import { LIFT_COPY, LIFT_TUNING } from '../game/liftTuning';
import { SESSION_COPY, SESSION_LAYOUT, SESSION_TUNING } from '../game/sessionTuning';
import {
  currentSetNumber,
  executionQualityFrom,
  repConfigFor,
  type SessionState,
} from '../game/session';
import { SESSION_PALETTE } from './sessionPalette';

const L = SESSION_LAYOUT;

const OUTCOME_COLOUR: Record<LiftOutcome, string> = {
  'good-lift': SESSION_PALETTE.GOOD,
  grind: SESSION_PALETTE.GRIND,
  miss: SESSION_PALETTE.MISS,
};

/**
 * One pip per prescribed rep in this set: banked, live, or still to come.
 *
 * The reason a session has a shape. Without it a work set is an unbounded run
 * of reps and the player cannot tell whether they are nearly done.
 */
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
  // The config is a function of WHICH REP THIS IS and what was prescribed, and
  // of nothing else. Depending on the whole session state would hand `restart`
  // a new object mid-rep every time anything about the session changed, which
  // would reset the bar under the player's finger.
  const setIndex = state.setIndex;
  const repIndex = state.repIndex;
  const config = useMemo(
    () => repConfigFor(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setIndex, repIndex, plan],
  );
  const loop = useLiftLoop(config);
  const { restart, onPressIn, onPressOut } = loop;

  // --- start the next rep ---------------------------------------------------
  const repKey = `${state.setIndex}:${state.repIndex}`;
  const lastRepKey = useRef<string>(repKey);
  useEffect(() => {
    if (lastRepKey.current === repKey) return;
    lastRepKey.current = repKey;
    restart(config.loadRatio);
  }, [repKey, restart, config.loadRatio]);

  // --- hand the outcome back after the result beat --------------------------
  const resolution = loop.state.resolution;
  const resolved = loop.state.phase === 'RESOLVED';
  const outcome = resolution === null ? null : resolution.outcome;
  // `executionQualityFrom` is `session.ts`'s pure read of `resolution` — no
  // mechanic logic lives in this file, only the call.
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
            resolution === null ? null : { color: OUTCOME_COLOUR[resolution.outcome] },
          ]}
          testID="session-prompt"
        >
          {resolution === null ? promptFor(loop.state) : resolution.headline}
        </Text>
        <Text style={styles.detail} testID="session-detail">
          {resolution === null || resolution.detail === ''
            ? LIFT_COPY.SUBTITLE
            : resolution.detail}
        </Text>
      </View>

      <Pressable
        style={styles.stage}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        testID="session-touch"
      >
        <LiftStage state={loop.state} history={loop.history} totalKg={totalKg} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    // The INHERITED half, on the root so it reaches the copy — see
    // `src/lift/pressGuard.ts`. On the stage it would reach only the Skia
    // canvas, where no selection is possible in the first place.
    ...PRESS_NOT_SELECT,
  },
  header: {
    alignItems: 'center',
    gap: L.ROW_GAP / 2,
    paddingVertical: L.ROW_GAP,
  },
  setLabel: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.LABEL_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  weight: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
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
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  detail: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
  },
  stage: {
    width: LIFT_TUNING.LAYOUT.STAGE_W,
    height: LIFT_TUNING.LAYOUT.STAGE_H,
    // The half that does NOT inherit, so it has to be here, on the element the
    // press lands in. Without it this Pressable computes `touch-action:
    // manipulation` and 20px of finger drift hands the descent to the browser.
    ...PRESS_NOT_TAKEN,
  },
});
