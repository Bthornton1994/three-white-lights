/**
 * SessionScreen — the daily loop, GDD §3.2, end to end.
 *
 * ```
 * Open app
 *   -> Readiness check-in (3 taps, one screen)
 *   -> Modifier surfaced + RPE target picked (1 tap, one screen)
 *   -> The work sets, on the existing lift mechanic
 *   -> Close-out: e1RM, streak, feedback
 *   -> Done
 * ```
 *
 * ---------------------------------------------------------------------------
 * THE APP OPENS ON THE FIRST QUESTION
 * ---------------------------------------------------------------------------
 * There is no splash, no home screen, no "start today's session" button, and no
 * loading gate in front of the check-in. GDD §12.2 measures this piece on
 * TIME-TO-FIRST-INPUT against a best-in-class daily-habit app, and every screen
 * before the first question is time the player spends answering nothing.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE IS A ROUTER, NOT A SCREEN
 * ---------------------------------------------------------------------------
 * It reads `state.phase` and renders one of five views. It computes nothing:
 * no load, no window, no outcome, no streak, and no progression number. CLAUDE.md
 * forbids deriving game state inside a `.tsx` file, and the whole of the loop's
 * logic is in `src/game/session.ts`.
 *
 * The close-out's figures come from `loop.closeOutReadings`, which is what
 * `progression.ts` says the record now is (via `sessionClient.ts`). This file
 * does not pick between a projection and a confirmation, or compute either — it
 * hands the reading down and `CloseOutView` renders how sure it is.
 */

import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SESSION_COPY, SESSION_LAYOUT } from '../game/sessionTuning';
import { plannedTemplateFor } from '../game/session';
import type { LiftOutcome } from '../game/lift';
import { BriefingView } from './BriefingView';
import { CheckInView } from './CheckInView';
import { CloseOutView } from './CloseOutView';
import { RestView } from './RestView';
import { SESSION_PALETTE } from './sessionPalette';
import { SetView } from './SetView';
import { useSession, type SessionPreviewFrame } from './useSession';

const L = SESSION_LAYOUT;

/**
 * GDD §3.2 is one session a day. When the day's session is already logged the
 * loop says so rather than offering a second one the server would refuse.
 */
function AlreadyTrained(): React.ReactElement {
  return (
    <View style={styles.centred} testID="session-already-trained">
      <Text style={styles.headline}>{SESSION_COPY.ALREADY_TRAINED_HEADLINE}</Text>
      <Text style={styles.subhead}>{SESSION_COPY.ALREADY_TRAINED_SUBHEAD}</Text>
    </View>
  );
}

export interface SessionScreenProps {
  /**
   * DEBUG ONLY. Freezes the loop on one scripted beat instead of running a
   * played session (see `sessionPreview.ts`). Nothing in the played app passes
   * this; it arrives from the `?session=` query string and exists so the
   * renderer can be photographed at moments a headless browser cannot reach.
   *
   * It carries a `ProgressionCache` as well as a `SessionState`, because the
   * close-out's numbers are read out of the cache — a frame without one would
   * photograph a screen showing a different lifter's figures.
   */
  readonly preview?: SessionPreviewFrame | undefined;
}

export function SessionScreen({ preview }: SessionScreenProps = {}): React.ReactElement {
  const loop = useSession(preview);
  const { dispatch, restartDay } = loop;
  const state = loop.state;

  const onRepResolved = useCallback(
    (outcome: LiftOutcome) => dispatch({ kind: 'rep-resolved', outcome }),
    [dispatch],
  );
  const onBeginSet = useCallback(() => dispatch({ kind: 'begin-set' }), [dispatch]);
  const onRetry = useCallback(() => dispatch({ kind: 'retry' }), [dispatch]);

  if (loop.alreadyTrainedToday && state.phase === 'check-in' && preview === undefined) {
    return (
      <View style={styles.root} testID="session-screen">
        <AlreadyTrained />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="session-screen">
      {state.phase === 'check-in' ? (
        <CheckInView
          answers={state.answers}
          onTap={(tap) => dispatch({ kind: 'check-in-tap', tap })}
        />
      ) : null}

      {state.phase === 'briefing' && state.readiness !== null ? (
        <BriefingView
          lift={state.context.lift}
          readiness={state.readiness}
          injury={state.injury}
          workSets={plannedTemplateFor(state).workSets}
          repsPerSet={plannedTemplateFor(state).repsPerSet}
          ladderReady={loop.ladderReady}
          onChooseRpe={(rpe) => dispatch({ kind: 'choose-rpe', rpe })}
        />
      ) : null}

      {state.phase === 'set' ? <SetView state={state} onRepResolved={onRepResolved} /> : null}

      {state.phase === 'rest' && state.plan !== null ? (
        <RestView
          nextSet={state.setIndex + 1}
          workSets={state.plan.workSets}
          weightKg={state.plan.weightKg}
          onBeginSet={onBeginSet}
        />
      ) : null}

      {state.phase === 'close-out' &&
      state.closeOut !== null &&
      loop.closeOutReadings !== null ? (
        <CloseOutView
          closeOut={state.closeOut}
          readings={loop.closeOutReadings}
          onDone={restartDay}
          onRetry={onRetry}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SESSION_PALETTE.BACKDROP,
  },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: L.ROW_GAP,
    paddingHorizontal: L.SCREEN_PAD,
  },
  headline: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.HEADLINE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
  subhead: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.SUBHEAD_FONT,
    textAlign: 'center',
  },
});
