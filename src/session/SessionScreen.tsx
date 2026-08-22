/**
 * SessionScreen — the daily loop, GDD §3.2, end to end.
 *
 * ```
 * Open app
 *   -> Readiness check-in (3 taps, one screen; today's lift chosen here)
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
 *
 * ---------------------------------------------------------------------------
 * IT OWNS THE DAY'S ONE CUT-IN SLOT (GDD §7.2)
 * ---------------------------------------------------------------------------
 * `CutInHost` wraps the whole loop, because §7.2's cap is per SESSION and no
 * single beat of the loop knows what a session is. One host, one slot, keyed on
 * `cutInSessionId('training', day)` — so the rest beat and the close-out are
 * competing for the same one cut-in rather than getting one each.
 *
 * The router still routes and still computes nothing: the session id and the
 * seed are `cutInGate.ts`'s functions of the day, not arithmetic done here.
 */

import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CutInHost } from '../cutin/CutInHost';
import { cutInSessionId, cutInSessionSeed } from '../cutin/cutInGate';
import { SESSION_COPY, SESSION_LAYOUT } from '../game/sessionTuning';
import { plannedTemplateFor } from '../game/session';
import type { SessionPhase } from '../game/session';
import type { SessionServerPort } from '../game/sessionClient';
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
  /**
   * The APP's session-server connection, supplied by the shell.
   *
   * Not a detail. `alreadyTrainedToday` is read out of what the server said,
   * and the shell unmounts this screen when meet day opens — so a port built
   * per mount would forget today's session the moment the player navigated away
   * and came back, and offer them a second session of the same day (GDD §3.2
   * allows one). One connection per app run, in `src/shell/appServer.ts`.
   *
   * Omitted, `useSession` builds its own, which is what a test or a standalone
   * render wants.
   */
  readonly serverPort?: SessionServerPort | undefined;
  /**
   * Reports which beat of GDD §3.2 the loop is on, for the shell's chrome gate.
   *
   * ROUTING INFORMATION, not state. The shell draws no navigation control over
   * a live set — a mis-tap there costs a rep — so it has to know, and it may
   * not derive it: session state belongs to `session.ts`. This screen tells it,
   * and tells it nothing else.
   */
  readonly onPhase?: ((phase: SessionPhase) => void) | undefined;
  /**
   * Reports whether a GDD §7.2 cut-in is on screen, for the shell's chrome gate.
   *
   * The same kind of thing as `onPhase` and forwarded straight to `CutInHost`,
   * which owns the answer. The shell's pill is a sibling of this whole screen
   * and paints above the overlay, so a tap meant to dismiss an interrupt would
   * navigate instead — see `shellAffordanceFor`.
   */
  readonly onCutIn?: ((live: boolean) => void) | undefined;
  /**
   * `window.location.search`, for the `?cutin=` debug route only.
   *
   * Passed down rather than read here, so `App.tsx` stays the one platform edge.
   * Omitted, `CutInHost` falls back to its own read, which is what a standalone
   * render wants.
   */
  readonly cutInSearch?: string | null | undefined;
}

export function SessionScreen({
  preview,
  serverPort,
  onPhase,
  onCutIn,
  cutInSearch,
}: SessionScreenProps = {}): React.ReactElement {
  const loop = useSession(preview, serverPort);
  const { dispatch, restartDay, chooseLift } = loop;
  const state = loop.state;

  useEffect(() => {
    onPhase?.(state.phase);
  }, [onPhase, state.phase]);

  const onRepResolved = useCallback(
    (outcome: LiftOutcome, executionQuality: number) =>
      dispatch({ kind: 'rep-resolved', outcome, executionQuality }),
    [dispatch],
  );
  const onBeginSet = useCallback(() => dispatch({ kind: 'begin-set' }), [dispatch]);
  const onRetry = useCallback(() => dispatch({ kind: 'retry' }), [dispatch]);

  const day = state.context.day;

  if (loop.alreadyTrainedToday && state.phase === 'check-in' && preview === undefined) {
    return (
      <View style={styles.root} testID="session-screen">
        <AlreadyTrained />
      </View>
    );
  }

  return (
    <CutInHost
      sessionId={cutInSessionId('training', day)}
      seed={cutInSessionSeed('training', day)}
      search={cutInSearch}
      onLive={onCutIn}
    >
      <View style={styles.root} testID="session-screen">
        {state.phase === 'check-in' ? (
          <CheckInView
            answers={state.answers}
            lift={state.context.lift}
            onTap={(tap) => dispatch({ kind: 'check-in-tap', tap })}
            onChooseLift={chooseLift}
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
            loadRatio={state.plan.loadRatio}
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
    </CutInHost>
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
