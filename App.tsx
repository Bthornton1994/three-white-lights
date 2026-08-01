import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { LiftScreen } from './src/lift/LiftScreen';
import { LIFT_PALETTE } from './src/lift/liftPalette';
import { replayRequestFrom } from './src/lift/replayRoute';

// Prototype 1 (GDD §10): the lift mechanic, in complete isolation. One rep,
// played — no progression, no meta, no backend.
//
// `index.ts` must not import this module until `LoadSkiaWeb` has resolved:
// Skia's web build binds `global.CanvasKit` at module-evaluation time, and
// everything below transitively imports Skia.
//
// THE ONE PIECE OF ROUTING IN THE APP is the debug replay query string, and it
// is here rather than inside the screen so the screen stays a renderer. On
// native `window` does not exist and the branch is dead, which is correct — the
// route exists to let the screenshot harness photograph the web build at
// moments a wall clock cannot reliably hit (see `src/lift/liftReplay.ts`).
function replayFromLocation() {
  if (typeof window === 'undefined') return undefined;
  return replayRequestFrom(window.location.search) ?? undefined;
}

export default function App() {
  return (
    <View style={styles.container}>
      <LiftScreen replay={replayFromLocation()} />
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
