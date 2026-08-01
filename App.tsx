import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { LiftScreen } from './src/lift/LiftScreen';
import { LIFT_PALETTE } from './src/lift/liftPalette';

// Prototype 1 (GDD §10): the lift mechanic, in complete isolation. One rep,
// played — no progression, no meta, no backend.
//
// `index.ts` must not import this module until `LoadSkiaWeb` has resolved:
// Skia's web build binds `global.CanvasKit` at module-evaluation time, and
// everything below transitively imports Skia.
export default function App() {
  return (
    <View style={styles.container}>
      <LiftScreen />
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
