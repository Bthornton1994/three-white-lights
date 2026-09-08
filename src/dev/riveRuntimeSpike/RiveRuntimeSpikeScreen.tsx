/**
 * RiveRuntimeSpikeScreen — the dev-only Rive runtime spike.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PROVES, AND WHAT IT DOES NOT
 * ---------------------------------------------------------------------------
 * This screen exists to answer ADR-001's open runtime risks (§7) — does the
 * modern `@rive-app/react-native` (Nitro-based) runtime and its web
 * counterpart `@rive-app/react-canvas` actually install, resolve, mount, and
 * accept a continuous high-frequency write stream through a ViewModel — NOT
 * whether the athlete looks right. There is no athlete here. The values fed
 * to it are `spikeSignal.ts`'s synthetic sine/ease curves, never `LiftState`.
 *
 * The asset is REAL — the vendor's MIT-licensed quick-start health bar
 * (`assets/dev/THIRD-PARTY-RIVE-ASSETS.md`), obtained over this sandbox's
 * git path after the vendor's asset host and every npm tarball turned out
 * empty of one. It exposes one number, `health`; the synthetic feed's
 * `barHeight` is written to it at 60 Hz, so the bar drains and refills once
 * per synthetic rep. That is what lets the probe photograph a graphic that
 * MOVES under a continuous ViewModel write, on web — the thing the earlier
 * placeholder could not show. Still not shown here: native (no toolchain),
 * and anything about an athlete.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS SAFE TO SHIP ON A BRANCH WITHOUT BEING A PLAYER SURFACE
 * ---------------------------------------------------------------------------
 * `App.tsx` mounts this ONLY when `__DEV__` is true AND the URL carries
 * `?dev-rive-spike=1` — a query string `src/shell/shellRoute.ts`'s
 * `resolveEntry` has no arm for and never will, so the normal player
 * navigation graph cannot reach it by any sequence of taps. `__DEV__` is
 * Metro's own dev/production flag; a production build (native or web) has it
 * statically `false`. Neither this file nor its stages are imported by
 * `AppShell.tsx` or `shellRoute.ts` — deleting this whole `src/dev/`
 * directory plus the App.tsx branch removes it with zero residue elsewhere.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LIFT_PALETTE } from '../../lift/liftPalette';
import { AthleteAcceptanceScreen } from '../athleteAcceptance/AthleteAcceptanceScreen';
import { OwnerPlaytestScreen } from '../athleteAcceptance/OwnerPlaytestScreen';
import { useDevMode } from './devMode';
import { RiveSpikeStage } from './RiveSpikeStage';
import type { RiveSpikeStatus } from './riveSpikeTypes';
import { SOAK_CYCLE, SPIKE_LAYOUT } from './spikeTuning';

// The one platform read this screen makes — the same one App.tsx makes for
// the spike key. On native `window` does not exist and the hook reads the
// launch URL through `Linking` instead.
function webSearch(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.search;
}

export function RiveRuntimeSpikeScreen(): React.ReactElement {
  const [status, setStatus] = useState<RiveSpikeStatus>({ phase: 'loading' });
  // A second key on the spike route picks a surface inside it
  // (`devModeQuery.ts`). Same gate — this screen only mounts on that route.
  const mode = useDevMode(webSearch());
  // `spike-cycle`: unmount and remount the stage on a timer, counting cycles,
  // so the host soak can watch memory, listeners and pacing across real React
  // teardown of the Rive runtime. Inert in every other mode.
  const cycling = mode === 'spike-cycle';
  const [cycle, setCycle] = useState(0);
  const [stageMounted, setStageMounted] = useState(true);
  useEffect(() => {
    if (!cycling) return undefined;
    let unmountTimer: ReturnType<typeof setTimeout> | null = null;
    const period = setInterval(() => {
      setStageMounted(false);
      unmountTimer = setTimeout(() => {
        setCycle((n) => n + 1);
        setStageMounted(true);
      }, SOAK_CYCLE.UNMOUNTED_MS);
    }, SOAK_CYCLE.PERIOD_MS);
    return () => {
      clearInterval(period);
      if (unmountTimer !== null) clearTimeout(unmountTimer);
    };
  }, [cycling]);

  if (mode === 'athlete-accept') {
    return <AthleteAcceptanceScreen />;
  }
  // The owner's play route: the real shell, athlete stage on the training
  // squat, gate unflipped, fail-closed without the asset.
  if (mode === 'owner-playtest') {
    return <OwnerPlaytestScreen />;
  }

  return (
    <View style={styles.container} testID="dev-rive-spike">
      <Text style={styles.heading}>RIVE RUNTIME SPIKE — DEV ONLY, NOT AN ATHLETE</Text>
      <Text style={styles.status} testID="dev-rive-spike-status">
        {statusLine(status)}
      </Text>
      {cycling ? (
        <Text style={styles.status} testID="dev-rive-spike-cycle">
          {String(cycle)}
        </Text>
      ) : null}
      {stageMounted ? <RiveSpikeStage key={cycle} onStatus={setStatus} /> : null}
    </View>
  );
}

function statusLine(status: RiveSpikeStatus): string {
  switch (status.phase) {
    case 'loading':
      return 'loading…';
    case 'bound':
      return 'bound — writing health at 60fps';
    case 'error':
      return `error: ${status.message}`;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIFT_PALETTE.BACKDROP,
    paddingTop: SPIKE_LAYOUT.PADDING_TOP,
    paddingHorizontal: SPIKE_LAYOUT.PADDING_HORIZONTAL,
  },
  heading: {
    color: LIFT_PALETTE.TEXT,
    fontSize: SPIKE_LAYOUT.HEADING_SIZE,
    fontWeight: '700',
    marginBottom: SPIKE_LAYOUT.HEADING_GAP,
  },
  status: {
    color: LIFT_PALETTE.GOOD,
    fontSize: SPIKE_LAYOUT.STATUS_SIZE,
    fontFamily: 'monospace',
    marginBottom: SPIKE_LAYOUT.STATUS_GAP,
  },
});
