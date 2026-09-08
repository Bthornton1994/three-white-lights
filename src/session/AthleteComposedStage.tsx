/**
 * AthleteComposedStage — the production squat stage as a COMPOSITION.
 *
 * The empty side-on room plate (`roomAsset.ts`) and the athlete rig canvas
 * (`AthleteStage`) are the same 1152 × 1728 canvas, so they are drawn into
 * ONE frame — placed and scaled by `composeAthleteStage` from the box this
 * component is given, never from the rep. Two children of one absolutely
 * positioned frame, both `absoluteFill`: there is no second rect for either
 * layer to stretch in, and the floor line lands where the composition puts
 * it on every phone.
 *
 * `ROOM_ASSET_MISSING`: while `roomAsset.ts` is null the frame draws the
 * backdrop colour under the rig and carries the `room-asset-missing`
 * marker. No painted scene is ever used in its place — this file imports
 * neither `ironAmberPlates` nor any `iron-amber/*.jpg`.
 *
 * Mounted by `TrainingLiftStage` behind `ATHLETE_RIG.TRAINING_STAGE`
 * (through the same lazy import that keeps the Rive runtime off the player
 * bundle while the gate is closed), and by the acceptance harness with the
 * phone's own HUD insets. The box is measured with `onLayout`, so inside
 * `SetView` the composition is of the stage's box, not the window; the
 * harness passes the window and the HUD insets to compose the phone.
 */
import React, { useState } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { LiftStageProps } from '../lift/LiftStage';
import { AthleteStage } from './AthleteStage';
import { composeAthleteStage, type HudInsets, type Viewport } from './athleteComposition';
import { ROOM_ASSET } from './roomAsset';
import { SESSION_PALETTE } from './sessionPalette';

export interface AthleteComposedStageProps extends LiftStageProps {
  /** HUD insets inside the box, viewport px. The box is HUD-free by default (SetView lays the HUD out around it). */
  readonly hud?: HudInsets;
  /** Compose against this box instead of the measured one (the harness passes the window). */
  readonly viewport?: Viewport;
}

const NO_HUD: HudInsets = Object.freeze({ top: 0, bottom: 0 });

export function AthleteComposedStage({ hud = NO_HUD, viewport, ...stage }: AthleteComposedStageProps): React.ReactElement {
  const [measured, setMeasured] = useState<Viewport | null>(null);
  const box = viewport ?? measured;
  const onLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setMeasured({ width, height });
  };
  if (box === null || !(box.width > 0) || !(box.height > 0)) {
    return <View style={styles.viewport} onLayout={onLayout} testID="athlete-composed-stage" />;
  }
  const composition = composeAthleteStage(box, hud);
  const { frame } = composition;
  return (
    <View style={styles.viewport} onLayout={onLayout} testID="athlete-composed-stage">
      <View
        style={[styles.frame, { left: frame.x, top: frame.y, width: frame.width, height: frame.height }]}
        testID="athlete-composed-frame"
      >
        {ROOM_ASSET === null ? (
          <View style={[StyleSheet.absoluteFill, styles.roomMissing]} testID="room-asset-missing" />
        ) : (
          <Image source={ROOM_ASSET} style={StyleSheet.absoluteFill} resizeMode="cover" testID="athlete-composed-room" />
        )}
        <View style={StyleSheet.absoluteFill} testID="athlete-composed-rig">
          <AthleteStage {...stage} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignSelf: 'stretch',
    overflow: 'hidden',
    backgroundColor: SESSION_PALETTE.SQUAT_WALL,
  },
  frame: {
    position: 'absolute',
  },
  roomMissing: {
    backgroundColor: SESSION_PALETTE.SQUAT_WALL,
  },
});
