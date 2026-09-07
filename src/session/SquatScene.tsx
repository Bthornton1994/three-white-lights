/**
 * SquatScene — persistent Iron & Amber squat. One lifter, one bar, one rep.
 *
 * Skia paths are posed from `squatPoseFrom(state)`. The mechanic is not
 * rewritten. JPEG phase-swaps are not used.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Line,
  LinearGradient,
  Rect,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';

import { LIFT_TUNING } from '../game/liftTuning';
import { SQUAT_VISUAL as V } from '../game/sessionTuning';
import type { LiftStageProps } from '../lift/LiftStage';
import { SESSION_PALETTE } from './sessionPalette';
import { squatPoseFrom, type SquatPose } from './squatVisual';

const L = LIFT_TUNING.LAYOUT;

const C = {
  wall: SESSION_PALETTE.SQUAT_WALL,
  floor: SESSION_PALETTE.SQUAT_FLOOR,
  shaft: SESSION_PALETTE.AMBER,
  rack: SESSION_PALETTE.SQUAT_RACK,
  cup: SESSION_PALETTE.SQUAT_CUP,
  skin: SESSION_PALETTE.SQUAT_SKIN,
  singlet: SESSION_PALETTE.SQUAT_SINGLET,
  hair: SESSION_PALETTE.SQUAT_HAIR,
  bar: SESSION_PALETTE.SQUAT_BAR,
  collar: SESSION_PALETTE.AMBER,
  glow: SESSION_PALETTE.SQUAT_GLOW,
  chalk: SESSION_PALETTE.SQUAT_CHALK,
  red: SESSION_PALETTE.SQUAT_PLATE_RED,
  blue: SESSION_PALETTE.SQUAT_PLATE_BLUE,
  yellow: SESSION_PALETTE.SQUAT_PLATE_YELLOW,
  green: SESSION_PALETTE.SQUAT_PLATE_GREEN,
  black: SESSION_PALETTE.SQUAT_PLATE_BLACK,
} as const;

function plateColor(hue: string): string {
  if (hue === 'RED') return C.red;
  if (hue === 'BLUE') return C.blue;
  if (hue === 'YELLOW') return C.yellow;
  if (hue === 'GREEN') return C.green;
  return C.black;
}

function px(n: number, span: number): number {
  return n * span;
}

function LifterAndBar({
  pose,
  w,
  h,
}: {
  readonly pose: SquatPose;
  readonly w: number;
  readonly h: number;
}): React.ReactElement {
  const limb = px(V.LIMB_W, w);
  const barY = px(pose.bar.y, h);
  const barX = px(pose.bar.x, w);
  const sleeve = px(V.SLEEVE_FRAC, w);
  const thick = px(V.BAR_THICK, h);
  const glowW = thick + px(V.GLOW_PAD, h) * 2;
  const leftX = barX - sleeve;
  const rightX = barX + sleeve;
  const bend = px(pose.barBend, h);
  const leftSleeveY = barY + bend;
  const rightSleeveY = barY + bend;

  return (
    <Group>
      <Line
        p1={vec(px(pose.leftFoot.x, w), px(pose.leftFoot.y, h))}
        p2={vec(px(pose.leftKnee.x, w), px(pose.leftKnee.y, h))}
        color={C.skin}
        strokeWidth={limb}
        style="stroke"
        strokeCap="round"
      />
      <Line
        p1={vec(px(pose.rightFoot.x, w), px(pose.rightFoot.y, h))}
        p2={vec(px(pose.rightKnee.x, w), px(pose.rightKnee.y, h))}
        color={C.skin}
        strokeWidth={limb}
        style="stroke"
        strokeCap="round"
      />
      <Line
        p1={vec(px(pose.leftKnee.x, w), px(pose.leftKnee.y, h))}
        p2={vec(px(pose.hip.x, w), px(pose.hip.y, h))}
        color={C.skin}
        strokeWidth={limb}
        style="stroke"
        strokeCap="round"
      />
      <Line
        p1={vec(px(pose.rightKnee.x, w), px(pose.rightKnee.y, h))}
        p2={vec(px(pose.hip.x, w), px(pose.hip.y, h))}
        color={C.skin}
        strokeWidth={limb}
        style="stroke"
        strokeCap="round"
      />
      <RoundedRect
        x={px(pose.hip.x, w) - px(V.TORSO_W, w) / 2}
        y={px(pose.leftShoulder.y, h)}
        width={px(V.TORSO_W, w)}
        height={px(pose.hip.y, h) - px(pose.leftShoulder.y, h)}
        r={px(V.LIMB_W, w)}
        color={C.singlet}
      />
      <Line
        p1={vec(px(pose.leftShoulder.x, w), px(pose.leftShoulder.y, h))}
        p2={vec(leftX + px(V.COLLAR_W, w), leftSleeveY + px(V.ARM_DROP, h))}
        color={C.skin}
        strokeWidth={limb}
        style="stroke"
        strokeCap="round"
      />
      <Line
        p1={vec(px(pose.rightShoulder.x, w), px(pose.rightShoulder.y, h))}
        p2={vec(rightX - px(V.COLLAR_W, w), rightSleeveY + px(V.ARM_DROP, h))}
        color={C.skin}
        strokeWidth={limb}
        style="stroke"
        strokeCap="round"
      />
      <Circle
        cx={px(pose.head.x, w)}
        cy={px(pose.head.y, h)}
        r={px(V.HEAD_R, w)}
        color={C.skin}
      />
      <Circle
        cx={px(pose.head.x, w)}
        cy={px(pose.head.y, h) - px(V.HEAD_R, w) / 2}
        r={px(V.HEAD_R, w)}
        color={C.hair}
      />
      <RoundedRect
        x={px(pose.leftFoot.x, w) - px(V.FOOT_W, w) / 2}
        y={px(pose.leftFoot.y, h) - px(V.FOOT_H, h)}
        width={px(V.FOOT_W, w)}
        height={px(V.FOOT_H, h)}
        r={2}
        color={C.singlet}
      />
      <RoundedRect
        x={px(pose.rightFoot.x, w) - px(V.FOOT_W, w) / 2}
        y={px(pose.rightFoot.y, h) - px(V.FOOT_H, h)}
        width={px(V.FOOT_W, w)}
        height={px(V.FOOT_H, h)}
        r={2}
        color={C.singlet}
      />

      {pose.commandGlow > 0 ? (
        <Line
          p1={vec(leftX, leftSleeveY)}
          p2={vec(rightX, rightSleeveY)}
          color={C.glow}
          strokeWidth={glowW}
          style="stroke"
          strokeCap="round"
          opacity={pose.commandGlow}
        />
      ) : null}

      <Line
        p1={vec(leftX, leftSleeveY)}
        p2={vec(rightX, rightSleeveY)}
        color={C.bar}
        strokeWidth={thick}
        style="stroke"
        strokeCap="round"
      />
      <Rect
        x={leftX}
        y={leftSleeveY - px(V.COLLAR_W, h)}
        width={px(V.COLLAR_W, w)}
        height={px(V.COLLAR_W, h) * 2}
        color={C.collar}
      />
      <Rect
        x={rightX - px(V.COLLAR_W, w)}
        y={rightSleeveY - px(V.COLLAR_W, h)}
        width={px(V.COLLAR_W, w)}
        height={px(V.COLLAR_W, h) * 2}
        color={C.collar}
      />
      {pose.plates.map((plate, index) => {
        const maxR = px(V.PLATE_MAX_R, w);
        const r = (plate.spec.diameterMm / V.PLATE_REF_MM) * maxR;
        const gap = px(V.PLATE_GAP, w) + index * (px(V.PLATE_GAP, w) + px(V.COLLAR_W, w) + r * V.PLATE_SCALE);
        const color = plateColor(plate.spec.hue);
        return (
          <Group key={`p-${plate.spec.kg}-${index}`}>
            <Circle cx={leftX - gap} cy={leftSleeveY} r={r} color={color} />
            <Circle cx={rightX + gap} cy={rightSleeveY} r={r} color={color} />
          </Group>
        );
      })}
      {pose.particles.map((p, index) => (
        <Circle
          key={`c-${index}`}
          cx={px(p.x, w)}
          cy={px(p.y, h)}
          r={px(p.r, w)}
          color={C.chalk}
          opacity={p.a}
        />
      ))}
    </Group>
  );
}

export function SquatScene({ state, totalKg }: LiftStageProps): React.ReactElement {
  const [box, setBox] = useState<{ w: number; h: number }>({ w: L.STAGE_W, h: L.STAGE_H });
  const pose = squatPoseFrom(state, totalKg);
  const w = box.w;
  const h = box.h;
  const floorY = px(V.FLOOR_Y, h);
  const rackW = px(V.RACK_W, w);
  const leftRack = px(V.RACK_X_INSET, w);
  const rightRack = w - leftRack - rackW;
  const cupY = px(V.STAND_BAR_Y, h);

  return (
    <View
      style={styles.canvas}
      testID="iron-amber-stage"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setBox({ w: width, h: height });
      }}
    >
      <View style={styles.fill} testID="squat-scene" pointerEvents="none">
      <Canvas style={styles.fill}>
        <Rect x={0} y={0} width={w} height={h} color={C.wall} />
        <Rect x={0} y={floorY} width={w} height={h - floorY} color={C.floor} />
        <Rect
          x={px(V.SHAFT_X, w)}
          y={0}
          width={px(V.SHAFT_W, w)}
          height={floorY}
        >
          <LinearGradient
            start={vec(px(V.SHAFT_X, w), 0)}
            end={vec(px(V.SHAFT_X, w) + px(V.SHAFT_W, w), floorY)}
            colors={[C.shaft, C.wall]}
          />
        </Rect>
        <Rect
          x={px(V.SHAFT_X, w)}
          y={0}
          width={px(V.SHAFT_W, w)}
          height={floorY}
          color={C.shaft}
          opacity={V.SHAFT_OPACITY}
        />
        <Rect x={leftRack} y={px(V.HEAD_R, h)} width={rackW} height={floorY} color={C.rack} />
        <Rect x={rightRack} y={px(V.HEAD_R, h)} width={rackW} height={floorY} color={C.rack} />
        {Array.from({ length: V.DUST_COUNT }, (_, i) => (
          <Circle
            key={`d-${i}`}
            cx={px(V.SHAFT_X, w) + px(V.SHAFT_W, w) * ((i + 1) / (V.DUST_COUNT + 1))}
            cy={px(V.HEAD_R, h) * (i + 1)}
            r={px(V.DUST_R, w)}
            color={C.chalk}
            opacity={V.DUST_OPACITY}
          />
        ))}
        <Rect
          x={leftRack}
          y={cupY}
          width={px(V.J_CUP_W, w)}
          height={px(V.J_CUP_H, h)}
          color={C.cup}
        />
        <Rect
          x={rightRack - px(V.J_CUP_W, w) + rackW}
          y={cupY}
          width={px(V.J_CUP_W, w)}
          height={px(V.J_CUP_H, h)}
          color={C.cup}
        />
        <Group transform={[{ translateY: px(pose.cameraY, h) }]}>
          <LifterAndBar pose={pose} w={w} h={h} />
        </Group>
      </Canvas>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    alignSelf: 'stretch',
    overflow: 'hidden',
    backgroundColor: SESSION_PALETTE.CARD,
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
});
