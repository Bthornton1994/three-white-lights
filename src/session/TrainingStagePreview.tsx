/**
 * TrainingStagePreview — the licensed training gym as the briefing's room.
 *
 * PX TRAINING-FIT-02: kill the flat void. Screen 03 is facility-first. This is
 * the SAME training-gym raster LiftStage already paints (`liftStageScene`),
 * not mockup isometric art and not a Gym Empire dock.
 *
 * No mechanic. No bar-path panel. No live loop. The live set still uses
 * LiftStage.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, FilterMode, Image as SkiaImage, MipmapMode, Rect } from '@shopify/react-native-skia';

import { makeGymSceneImage } from '../art/GymSceneView';
import { liftStageScene } from '../art/gymScene';
import { GYM_LIFT_STAGE } from '../art/gymTuning';
import { LIFT_TUNING } from '../game/liftTuning';
import { SESSION_LAYOUT } from '../game/sessionTuning';
import { SESSION_PALETTE } from './sessionPalette';

const L = SESSION_LAYOUT;
const STAGE = LIFT_TUNING.LAYOUT;
const SCENE = GYM_LIFT_STAGE;

export function TrainingStagePreview(): React.ReactElement {
  const [slotWidth, setSlotWidth] = useState<number>(STAGE.STAGE_W);
  const [slotHeight, setSlotHeight] = useState<number>(STAGE.STAGE_H);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const nextW = event.nativeEvent.layout.width;
    const nextH = event.nativeEvent.layout.height;
    if (nextW > 0 && nextW !== slotWidth) setSlotWidth(nextW);
    if (nextH > 0 && nextH !== slotHeight) setSlotHeight(nextH);
  }, [slotHeight, slotWidth]);

  // Cover the briefing slot so leftover espresso void is not the room.
  const fittedScale = Math.max(
    L.STAGE_FIT_MIN_SCALE,
    slotWidth / STAGE.STAGE_W,
    slotHeight / STAGE.STAGE_H,
  );
  const coverShift = slotHeight * L.STAGE_PREVIEW_COVER_SHIFT_FRACTION;
  const image = useMemo(() => makeGymSceneImage(liftStageScene()), []);

  return (
    <View
      style={styles.slot}
      onLayout={onLayout}
      testID="session-training-stage"
    >
      <View
        style={[
          styles.scaler,
          {
            width: STAGE.STAGE_W * fittedScale,
            height: STAGE.STAGE_H * fittedScale,
            transform: [{ translateY: -coverShift }],
          },
        ]}
      >
        <View
          style={[
            styles.canvasBox,
            {
              transform: [
                { translateX: ((fittedScale - 1) * STAGE.STAGE_W) / 2 },
                { translateY: ((fittedScale - 1) * STAGE.STAGE_H) / 2 },
                { scale: fittedScale },
              ],
            },
          ]}
        >
          <Canvas style={styles.canvas}>
            <Rect
              x={0}
              y={0}
              width={STAGE.STAGE_W}
              height={STAGE.STAGE_H}
              color={SESSION_PALETTE.BACKDROP}
            />
            <SkiaImage
              image={image}
              x={SCENE.ORIGIN_X}
              y={SCENE.ORIGIN_Y}
              width={SCENE.W * SCENE.SCALE}
              height={SCENE.H * SCENE.SCALE}
              fit="fill"
              sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
            />
          </Canvas>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    minHeight: L.STAGE_PREVIEW_MIN_HEIGHT,
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scaler: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasBox: {
    width: STAGE.STAGE_W,
    height: STAGE.STAGE_H,
  },
  canvas: {
    width: STAGE.STAGE_W,
    height: STAGE.STAGE_H,
  },
});
