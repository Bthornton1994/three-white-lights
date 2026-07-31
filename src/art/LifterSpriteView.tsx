/**
 * Rendering glue — the only file in `src/art/` that imports React.
 *
 * Everything above it is pure: `renderLifterFrame` produces palette indices,
 * `gridToRgba` turns those into bytes, and this file is the thin layer that
 * hands the bytes to Skia. It is deliberately not re-exported from
 * `src/art/index.ts`, so the pure modules stay importable from a plain node
 * test run with no Skia in the process.
 *
 * NEAREST NEIGHBOUR ONLY. GDD §7.1 requires it, and it is the difference
 * between a sprite and a blurry photograph of a sprite. Two things enforce it:
 * `sampling` is pinned to FilterMode.Nearest with mipmaps off, and `scale` is
 * rounded to an integer before it is used. A fractional scale produces uneven
 * pixel sizes — some source pixels two device pixels wide and some three — and
 * that shimmer is the single most common way pixel art gets ruined in a mobile
 * app. If a layout needs a size between two integer scales, the correct fix is
 * to letterbox the smaller integer scale, not to interpolate.
 *
 * NOT VERIFIED AT RUNTIME. This file type-checks against the installed
 * @shopify/react-native-skia types and follows its documented raw-pixel path
 * (Skia.Data.fromBytes -> Skia.Image.MakeImage), but nothing in this run has
 * rendered it on a device or in the web build. Treat it as unproven glue rather
 * than as tested code; the PNG harness in tools/sprites.mjs is what actually
 * proves the pixels.
 */

import React, { useMemo } from 'react';
import {
  AlphaType,
  Canvas,
  ColorType,
  FilterMode,
  Image,
  MipmapMode,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';

import { RESOLUTION } from './spriteTuning';
import { SPRITE_CELL, frameSpecFrom, renderLifterFrame, type LifterFrameSpec } from './lifterSprite';
import { gridToRgba } from './rgba';
import type { SquatFrame } from './squatAnimation';

/** Build an SkImage from a frame spec. Cheap enough to run per frame change. */
export function makeSpriteImage(spec: LifterFrameSpec): SkImage | null {
  const { grid } = renderLifterFrame(spec);
  const bytes = gridToRgba(grid);
  const data = Skia.Data.fromBytes(bytes);
  return Skia.Image.MakeImage(
    {
      width: grid.w,
      height: grid.h,
      // The grid has no partial alpha at all, so there is nothing to
      // premultiply; Unpremul keeps the bytes byte-identical to gridToRgba's.
      alphaType: AlphaType.Unpremul,
      colorType: ColorType.RGBA_8888,
    },
    data,
    grid.w * 4,
  );
}

export interface LifterSpriteViewProps {
  readonly frame: SquatFrame;
  /** Total weight on the bar, kg, including bar and collars. */
  readonly totalKg: number;
  /** Integer upscale. Rounded and floored at 1; see the header. */
  readonly scale?: number;
  readonly barKg?: number;
}

export function LifterSpriteView({
  frame,
  totalKg,
  scale = RESOLUTION.DEFAULT_UPSCALE,
  barKg,
}: LifterSpriteViewProps): React.ReactElement {
  const zoom = Math.max(1, Math.round(scale));
  const width = SPRITE_CELL.W * zoom;
  const height = SPRITE_CELL.H * zoom;

  const image = useMemo(
    () => makeSpriteImage(frameSpecFrom(frame, totalKg, barKg)),
    // The frame's identity is its drawn state, which is exactly what
    // `frameSpecFrom` reads. Depending on the frame object itself would rebuild
    // the image on every tick of a held frame.
    [
      frame.poseDepth,
      frame.direction,
      frame.strainLevel,
      frame.pitchLevel,
      frame.barLateralPx,
      frame.barTiltDeg,
      frame.barBendPx,
      frame.chalkMotes,
      totalKg,
      barKg,
    ],
  );

  return (
    <Canvas style={{ width, height }}>
      <Image
        image={image}
        x={0}
        y={0}
        width={width}
        height={height}
        fit="fill"
        sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
      />
    </Canvas>
  );
}
