import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, Rect, Group } from '@shopify/react-native-skia';

// RENDER SPIKE — temporary. Verifies that (a) Expo web renders at all and
// (b) Skia's CanvasKit initialises in this sandbox, which decides whether
// bar-path/rep rendering can be built on Skia as the GDD assumes.
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading} testID="spike-heading">
        RENDER SPIKE OK
      </Text>
      <View testID="skia-host" style={styles.canvasWrap}>
        <Canvas style={styles.canvas}>
          <Group>
            <Rect x={0} y={0} width={64} height={16} color="#d64545" />
            <Rect x={0} y={20} width={64} height={16} color="#3b6ea5" />
            <Rect x={0} y={40} width={64} height={16} color="#e0c341" />
          </Group>
        </Canvas>
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#14161a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  heading: { color: '#f2f4f8', fontSize: 20, fontWeight: '700' },
  canvasWrap: { width: 64, height: 56 },
  canvas: { flex: 1 },
});
