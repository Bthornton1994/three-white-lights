import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { AppShell } from './src/shell/AppShell';
import { LIFT_PALETTE } from './src/lift/liftPalette';
import { RiveRuntimeSpikeScreen } from './src/dev/riveRuntimeSpike/RiveRuntimeSpikeScreen';
import { useDevRiveSpikeRoute } from './src/dev/riveRuntimeSpike/devRoute';

// THE APP OPENS INTO THE DAILY SESSION LOOP (GDD §3.2): readiness check-in ->
// modifier -> the work sets, on the lift mechanic -> close-out. There is no
// splash and no home screen in front of it, because GDD §12.2 measures that
// piece on time-to-first-input.
//
// `index.ts` must not import this module until `LoadSkiaWeb` has resolved:
// Skia's web build binds `global.CanvasKit` at module-evaluation time, and
// everything below transitively imports Skia.
//
// ---------------------------------------------------------------------------
// THIS FILE IS THE PLATFORM EDGE. THE ROUTING IS IN `src/shell/`.
// ---------------------------------------------------------------------------
// The only thing here that a pure module could not do is READ `window`. Every
// decision made from what it reads — which surface opens, which frozen frame it
// draws, where the player can go next — is in `src/shell/shellRoute.ts`, which
// takes the string rather than the browser and is therefore testable without
// one. On native `window` does not exist, `search` is null, and every debug
// branch downstream is correctly dead.
//
// THE FOUR DEBUG QUERY STRINGS ARE UNCHANGED, and they are the run's evidence
// harness rather than leftovers. `tools/capture-lift.mjs`,
// `verify-lift-shots.mjs`, `capture-session.mjs`, `verify-session-boundary.mjs`
// and `capture-meet.mjs` all drive the app through them, and there is no other
// way to photograph a beat a wall clock cannot reliably hit:
//
//   ?replay=<load>&moment=<id>   one beat of a scripted REP.
//   ?session=<moment>            one beat of a scripted SESSION.
//   ?meet=<moment>               one beat of a scripted MEET (GDD §6), frozen.
//   ?meet=live                   the same meet PLAYED, with its clock running.
//
// A PLAYER NO LONGER NEEDS ANY OF THEM. Meet day used to be reachable only by
// typing `?meet=` into a browser — the whole of GDD §6 was unreachable in a
// build on a phone. `src/shell/AppShell.tsx` now carries the route between the
// daily session and meet day, in both directions, on a finger.
function locationSearch(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.search;
}

// ---------------------------------------------------------------------------
// ONE DEV-ONLY BRANCH, DELIBERATELY SEPARATE FROM `resolveEntry`'S FOUR.
// ---------------------------------------------------------------------------
// `?dev-rive-spike=1` is NOT one of the four debug query strings named above
// and never reaches `src/shell/shellRoute.ts` — it is decided here, before
// `AppShell` mounts at all, and short-circuits to a screen `resolveEntry` has
// no arm for and will never be given one. It is not part of the GDD evidence
// harness those four serve; it exists solely for
// `docs/design/ADR-001-athlete-animation-architecture.md` §7's runtime spike.
//
// Gated on BOTH conditions, not either alone: `__DEV__` is Metro's own
// dev/production flag (statically `false` in a production build, native or
// web) and the query string is one nobody reaches by navigating the app.
// Either alone would still keep a player from getting here; both together
// means a misconfigured `__DEV__` in a preview build still can't surface it
// without someone typing this exact string.
//
// THE SAME QUERY ON BOTH PLATFORMS. On web it is `window.location.search`,
// read above. On native there is no address bar, so the same key and value
// are read from the app's LAUNCH URL through the app scheme (`app.json`) —
// `src/dev/riveRuntimeSpike/devRoute.ts` does that read, keeps the `__DEV__`
// guard in front of every `Linking` call, and returns `'app'` unconditionally
// in a production build. `'pending'` is the one native tick before the launch
// URL resolves; the backdrop is drawn and nothing else, so the shell never
// flashes under the spike. The four debug query strings are unchanged.
export default function App() {
  const devRoute = useDevRiveSpikeRoute(locationSearch());
  if (devRoute === 'spike') {
    return <RiveRuntimeSpikeScreen />;
  }
  if (devRoute === 'pending') {
    return <View style={styles.container} />;
  }
  return (
    <View style={styles.container}>
      <AppShell search={locationSearch()} />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIFT_PALETTE.BACKDROP,
  },
});
