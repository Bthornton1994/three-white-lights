/**
 * AthleteAcceptanceScreen — the dev-only playback harness for the production
 * athlete stage. Reached ONLY through the spike route with the mode key
 * (`?dev-rive-spike=1&dev-mode=athlete-accept`, `__DEV__` only — see
 * `devModeQuery.ts`), so it is behind exactly the gate the runtime spike is.
 *
 * What it does: re-drives every scenario in the canonical trace corpus
 * through the real mechanic (`acceptancePlan.ts`) and hands each tick to the
 * REAL `AthleteStage` — the same component `TrainingLiftStage` will mount
 * behind `ATHLETE_RIG.TRAINING_STAGE` — as `{ state, history, totalKg }`, at
 * the presentation tick rate, holding each ending, looping forever. A DOM
 * probe (`dev-athlete-accept-probe`) carries the scenario, tick, phase,
 * `barHeight`, `depth`, outcome and the size of the write list, so
 * `tools/athleteAccept.mjs` can read what the stage was given while it reads
 * the canvas back.
 *
 * What it refuses: while `ATHLETE_RIV_IS_PLACEHOLDER` is true the stage is
 * NOT mounted and the status reads `ASSET_MISSING`. No diagnostic asset is
 * ever substituted for the athlete here — the health bar and the rewards
 * card are the spike's, not a body.
 *
 * What it surfaces: a runtime error thrown while the stage renders is
 * caught by the boundary below and put on the status line as
 * `RUNTIME_ERROR`, never swallowed. Binding, artboard and state-machine
 * mismatches are the contract command's to report before this runs
 * (`node tools/rivContract.mjs … --artboard squat`); a stage that binds and
 * draws nothing is what the probe's canvas readback is for.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { athleteRigInputsFrom, rigInputValues } from '../../art/athleteRig';
import { liftPresentation, PRESENTATION_TICK_MS } from '../../game/liftPresentation';
import { LIFT_PALETTE } from '../../lift/liftPalette';
import { AthleteComposedStage } from '../../session/AthleteComposedStage';
import { ATHLETE_RIV_IS_PLACEHOLDER } from '../../session/athleteAsset';
import { composeAthleteStage, DEFAULT_HUD_INSETS, type AthleteComposition } from '../../session/athleteComposition';
import { ROOM_ASSET_IS_MISSING } from '../../session/roomAsset';
import { priorFromHistory } from '../../session/athleteStagePrior';
import { ACCEPTANCE_PLAYBACK, SPIKE_LAYOUT } from '../riveRuntimeSpike/spikeTuning';
import {
  acceptancePlan,
  advancePlayback,
  PLAYBACK_START,
  playbackFrame,
  type AcceptanceScenario,
  type PlaybackFrame,
  type PlaybackPosition,
} from './acceptancePlan';

type AcceptanceStatus =
  | { readonly kind: 'ASSET_MISSING' }
  | { readonly kind: 'PLAYING' }
  | { readonly kind: 'RUNTIME_ERROR'; readonly message: string };

interface BoundaryProps {
  readonly onError: (message: string) => void;
  readonly children: React.ReactNode;
}

/** A render error inside the stage becomes a status line, not a blank screen. */
class StageErrorBoundary extends React.Component<BoundaryProps, { readonly failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    this.props.onError(error.message);
  }

  override render(): React.ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

function statusLine(status: AcceptanceStatus, frame: PlaybackFrame | null, position: PlaybackPosition): string {
  switch (status.kind) {
    case 'ASSET_MISSING':
      return 'ASSET_MISSING — assets/athlete/athlete-01.riv has not arrived; athleteAsset.ts points at the placeholder; no stage mounted, no substitute';
    case 'RUNTIME_ERROR':
      return `RUNTIME_ERROR — ${status.message}`;
    case 'PLAYING':
      return frame === null
        ? 'PLAYING — no frame'
        : `PLAYING — ${frame.scenario.id} tick ${frame.tick}/${frame.ticks} ${frame.state.phase} loop ${position.loops}`;
  }
}

function probeJson(
  status: AcceptanceStatus,
  plan: readonly AcceptanceScenario[],
  position: PlaybackPosition,
  frame: PlaybackFrame | null,
  composition: AthleteComposition,
): string {
  const base = {
    status: status.kind,
    message: status.kind === 'RUNTIME_ERROR' ? status.message : '',
    roomAssetMissing: ROOM_ASSET_IS_MISSING,
    composition: {
      viewport: composition.viewport,
      hud: composition.hud,
      frame: composition.frame,
      scale: composition.scale,
      fit: composition.fit,
      band: composition.band,
      floorY: composition.floorY,
      crownY: composition.crownY,
      lockoutBarY: composition.lockoutBarY,
      holeBarY: composition.holeBarY,
      cropped: composition.cropped,
    },
    scenarioIds: plan.map((p) => p.scenario.id),
    scenarioTicks: plan.map((p) => p.states.length),
    holdTicks: ACCEPTANCE_PLAYBACK.HOLD_TICKS_AT_END,
    tickMs: PRESENTATION_TICK_MS,
    loops: position.loops,
    mounted: status.kind === 'PLAYING',
  };
  if (frame === null) return JSON.stringify(base);
  const view = liftPresentation(frame.state, frame.totalKg, priorFromHistory(frame.history, frame.state));
  const writes = rigInputValues(athleteRigInputsFrom(view));
  return JSON.stringify({
    ...base,
    scenario: frame.scenario.id,
    scenarioIndex: position.scenario,
    tick: frame.tick,
    ticks: frame.ticks,
    held: position.held,
    phase: view.phase,
    barHeight: view.barHeight,
    depth: view.depth,
    outcome: view.outcome,
    missReason: view.missReason,
    totalKg: view.load.totalKg,
    writes: writes.length,
  });
}

export function AthleteAcceptanceScreen(): React.ReactElement {
  const plan = useMemo(() => acceptancePlan(), []);
  const [position, setPosition] = useState<PlaybackPosition>(PLAYBACK_START);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const mounted = !ATHLETE_RIV_IS_PLACEHOLDER && runtimeError === null;

  useEffect(() => {
    if (!mounted) return undefined;
    const id = setInterval(() => setPosition((current) => advancePlayback(current, plan)), PRESENTATION_TICK_MS);
    return () => clearInterval(id);
  }, [mounted, plan]);

  const frame = mounted ? playbackFrame(plan, position) : null;
  const window = useWindowDimensions();
  const composition = composeAthleteStage({ width: window.width, height: window.height }, DEFAULT_HUD_INSETS);
  const status: AcceptanceStatus = ATHLETE_RIV_IS_PLACEHOLDER
    ? { kind: 'ASSET_MISSING' }
    : runtimeError !== null
      ? { kind: 'RUNTIME_ERROR', message: runtimeError }
      : { kind: 'PLAYING' };

  // The probe is rewritten on a scenario boundary and every PROBE_EVERY_TICKS
  // ticks — not every tick, so the DOM write is not what a pacing readback
  // measures.
  const probeRef = useRef<string>('');
  const boundary = position.tick === 0 || position.tick % ACCEPTANCE_PLAYBACK.PROBE_EVERY_TICKS === 0;
  const windowKey = `${window.width}x${window.height}`;
  const lastWindowRef = useRef<string>('');
  const resized = lastWindowRef.current !== windowKey;
  lastWindowRef.current = windowKey;
  if (probeRef.current === '' || boundary || !mounted || resized) {
    probeRef.current = probeJson(status, plan, position, frame, composition);
  }

  // The phone, composed: the composed stage fills the window behind the
  // guides (HUD bands, the frame outline, the floor and crown lines) and the
  // status/probe text sits in the top HUD inset. With no athlete the frame
  // and the lines still draw, so the geometry can be verified before the
  // asset exists — on the real room plate when it lands, on the backdrop
  // until then.
  const { frame: box } = composition;
  return (
    <View style={styles.container} testID="dev-athlete-accept">
      {mounted && frame !== null ? (
        <View style={StyleSheet.absoluteFill} testID="dev-athlete-accept-stage">
          <StageErrorBoundary onError={setRuntimeError}>
            <AthleteComposedStage
              state={frame.state}
              history={frame.history}
              totalKg={frame.totalKg}
              viewport={{ width: window.width, height: window.height }}
              hud={DEFAULT_HUD_INSETS}
            />
          </StageErrorBoundary>
        </View>
      ) : null}
      <View
        pointerEvents="none"
        style={[styles.guideFrame, { left: box.x, top: box.y, width: box.width, height: box.height }]}
        testID="dev-athlete-accept-frame"
      />
      <View pointerEvents="none" style={[styles.guideLine, { top: composition.floorY }]} testID="dev-athlete-accept-floor" />
      <View pointerEvents="none" style={[styles.guideLine, { top: composition.crownY }]} testID="dev-athlete-accept-crown" />
      <View pointerEvents="none" style={[styles.hudBand, { top: 0, height: composition.band.top }]} testID="dev-athlete-accept-hud-top" />
      <View
        pointerEvents="none"
        style={[styles.hudBand, { top: composition.band.bottom, height: window.height - composition.band.bottom }]}
        testID="dev-athlete-accept-hud-bottom"
      />
      <View style={styles.chrome} pointerEvents="none">
        <Text style={styles.heading}>ATHLETE ACCEPTANCE — DEV ONLY — the real stage on the canonical trace corpus</Text>
        <Text style={styles.status} testID="dev-athlete-accept-status">
          {statusLine(status, frame, position)}
        </Text>
        <Text style={styles.probe} testID="dev-athlete-accept-probe">
          {probeRef.current}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIFT_PALETTE.BACKDROP,
  },
  chrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingTop: SPIKE_LAYOUT.PADDING_TOP,
    paddingHorizontal: SPIKE_LAYOUT.PADDING_HORIZONTAL,
  },
  guideFrame: {
    position: 'absolute',
    borderWidth: ACCEPTANCE_PLAYBACK.GUIDE_LINE_PX,
    borderColor: LIFT_PALETTE.TEXT,
  },
  guideLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ACCEPTANCE_PLAYBACK.GUIDE_LINE_PX,
    backgroundColor: LIFT_PALETTE.TEXT,
  },
  hudBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: LIFT_PALETTE.BACKDROP,
    opacity: ACCEPTANCE_PLAYBACK.HUD_BAND_OPACITY,
  },
  heading: {
    color: LIFT_PALETTE.TEXT,
    fontSize: SPIKE_LAYOUT.HEADING_SIZE,
    fontWeight: '700',
    marginBottom: SPIKE_LAYOUT.HEADING_GAP,
  },
  status: {
    color: LIFT_PALETTE.TEXT,
    fontSize: SPIKE_LAYOUT.STATUS_SIZE,
    marginBottom: SPIKE_LAYOUT.STATUS_GAP,
  },
  probe: {
    color: LIFT_PALETTE.TEXT,
    fontSize: ACCEPTANCE_PLAYBACK.PROBE_FONT_SIZE,
    opacity: 0,
    height: 0,
  },
});
