import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { LiftScreen } from './src/lift/LiftScreen';
import { LIFT_PALETTE } from './src/lift/liftPalette';
import { replayRequestFrom } from './src/lift/replayRoute';
import { SessionScreen } from './src/session/SessionScreen';
import { previewFrameFor, sessionPreviewFrom } from './src/session/sessionPreview';

// THE APP OPENS INTO THE DAILY SESSION LOOP (GDD §3.2): readiness check-in ->
// modifier -> the work sets, on the lift mechanic -> close-out. There is no
// splash and no home screen in front of it, because GDD §12.2 measures this
// piece on time-to-first-input.
//
// `index.ts` must not import this module until `LoadSkiaWeb` has resolved:
// Skia's web build binds `global.CanvasKit` at module-evaluation time, and
// everything below transitively imports Skia.
//
// ALL ROUTING IN THE APP IS TWO DEBUG QUERY STRINGS, and both are here rather
// than inside a screen so the screens stay renderers. On native `window` does
// not exist and both branches are dead, which is correct — they exist so the
// screenshot harness can photograph the web build at moments a wall clock
// cannot reliably hit.
//
//   ?replay=<load>&moment=<id>   one beat of a scripted REP. The Prototype-1
//                                lift screen, unchanged, and still the thing
//                                `tools/verify-lift-shots.mjs` photographs.
//   ?session=<moment>            one beat of a scripted SESSION.
function replayFromLocation() {
  if (typeof window === 'undefined') return undefined;
  return replayRequestFrom(window.location.search) ?? undefined;
}

function sessionPreviewFromLocation() {
  if (typeof window === 'undefined') return undefined;
  const request = sessionPreviewFrom(window.location.search);
  // A frame is a scripted `SessionState` AND the `ProgressionCache` its numbers
  // are read out of — the close-out prints what the boundary says, so a preview
  // without a cache would photograph the wrong figures.
  return request === null ? undefined : previewFrameFor(request);
}

export default function App() {
  const replay = replayFromLocation();
  return (
    <View style={styles.container}>
      {replay === undefined ? (
        <SessionScreen preview={sessionPreviewFromLocation()} />
      ) : (
        <LiftScreen replay={replay} />
      )}
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
