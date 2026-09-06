/**
 * SessionScreen — the daily loop, GDD §3.2, end to end.
 *
 * ```
 * Open app
 *   -> Lift + RPE (history readiness as copy)
 *   -> The work sets, on the existing lift mechanic
 *   -> Close-out: e1RM, streak, feedback
 *   -> Done
 * ```
 *
 * There is no subjective readiness check-in on the first paint.
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
import { CloseOutView } from './CloseOutView';
import { RestView } from './RestView';
import { SESSION_PALETTE } from './sessionPalette';
import { SetView } from './SetView';
import { useSession, type SessionPreviewFrame } from './useSession';

const L = SESSION_LAYOUT;

function AlreadyTrained(): React.ReactElement {
  return (
    <View style={styles.centred} testID="session-already-trained">
      <Text style={styles.headline}>{SESSION_COPY.ALREADY_TRAINED_HEADLINE}</Text>
      <Text style={styles.subhead}>{SESSION_COPY.ALREADY_TRAINED_SUBHEAD}</Text>
    </View>
  );
}

export interface SessionScreenProps {
  readonly preview?: SessionPreviewFrame | undefined;
  readonly serverPort?: SessionServerPort | undefined;
  readonly onPhase?: ((phase: SessionPhase) => void) | undefined;
  readonly onCutIn?: ((live: boolean) => void) | undefined;
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

  if (loop.alreadyTrainedToday && state.plan === null && preview === undefined) {
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
        {state.phase === 'briefing' && state.readiness !== null ? (
          <BriefingView
            lift={state.context.lift}
            readiness={state.readiness}
            injury={state.injury}
            workSets={plannedTemplateFor(state).workSets}
            repsPerSet={plannedTemplateFor(state).repsPerSet}
            disclosures={loop.onboardingDisclosures}
            ladderReady={loop.ladderReady}
            onChooseRpe={(rpe) => dispatch({ kind: 'choose-rpe', rpe })}
            onChooseLift={chooseLift}
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
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    backgroundColor: SESSION_PALETTE.BACKDROP,
  },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: L.ROW_GAP,
    paddingHorizontal: L.SCREEN_PAD,
    paddingTop: L.SAFE_AREA_FALLBACK,
  },
  headline: {
    color: SESSION_PALETTE.TEXT,
    fontSize: L.HEADLINE_FONT,
    fontWeight: '800',
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '100%',
  },
  subhead: {
    color: SESSION_PALETTE.TEXT_DIM,
    fontSize: L.SUBHEAD_FONT,
    lineHeight: L.BODY_LINE_HEIGHT,
    textAlign: 'center',
    width: '100%',
  },
});
