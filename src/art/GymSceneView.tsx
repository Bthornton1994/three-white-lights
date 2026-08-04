/**
 * Rendering glue for the environment layer — one of two React files in
 * `src/art/`, and deliberately not re-exported from `src/art/index.ts` so the
 * pure modules stay importable from a plain node test run with no Skia in the
 * process.
 *
 * It does one thing: turn a `GymSceneSpec` into an `SkImage`. Everything about
 * WHAT the room looks like is `gymScene.ts`; everything about WHERE it goes on
 * a screen belongs to the screen.
 *
 * NEAREST NEIGHBOUR ONLY, for the reason GDD §7.1 gives and for one more the
 * sprite does not have: the room and the figure are two images on one canvas,
 * so if their pixel grids are different sizes or out of phase the composition
 * shimmers along every edge where they meet. `GYM_LIFT_STAGE` pins the scene's
 * scale to the sprite's own and its origin to a row that keeps the two on one
 * lattice; `gymScene.test.ts` re-derives both and fails if they drift.
 *
 * NOT VERIFIED ON A DEVICE. Same status as `LifterSpriteView.tsx`: this
 * type-checks against the installed Skia types and follows its documented
 * raw-pixel path, and the PNG harness in `tools/gym.mjs` plus the browser
 * capture are what actually prove the pixels.
 */

import React, { useMemo } from 'react';
import {
  AlphaType,
  ColorType,
  FilterMode,
  Image as SkiaImage,
  MipmapMode,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';

import { RGBA } from './palette';
import { sceneColorAt } from './gymPalette';
import { gridToRgba } from './rgba';
import { renderGymScene, type GymSceneSpec } from './gymScene';
import { GYM_LIFT_STAGE } from './gymTuning';

/** Build an SkImage for one room. Static per spec — memoise at the call site. */
export function makeGymSceneImage(spec: GymSceneSpec): SkImage | null {
  const grid = renderGymScene(spec);
  // The scene resolves through `sceneColorAt`, which sees the two BACKGROUND
  // banks as well as the three sprite banks. `colorAt` alone would render every
  // gym pixel transparent, which is exactly the hole a wrong resolver leaves.
  const bytes = gridToRgba(grid, sceneColorAt);
  const data = Skia.Data.fromBytes(bytes);
  return Skia.Image.MakeImage(
    {
      width: grid.w,
      height: grid.h,
      alphaType: AlphaType.Unpremul,
      colorType: ColorType.RGBA_8888,
    },
    data,
    grid.w * RGBA.BYTES_PER_PIXEL,
  );
}

export interface GymSceneLayerProps {
  readonly spec: GymSceneSpec;
}

/**
 * The room, as a Skia element to put at the bottom of a canvas.
 *
 * Its box comes from `GYM_LIFT_STAGE` rather than from props: the origin and
 * the scale are what keep this image on the same pixel lattice as the lifter
 * standing on it, and a caller free to pass its own would be free to break
 * that silently.
 */
export function GymSceneLayer({ spec }: GymSceneLayerProps): React.ReactElement {
  const image = useMemo(
    () => makeGymSceneImage(spec),
    [spec.venue, spec.w, spec.h, spec.floorRow, spec.focusX, spec.cameraX],
  );
  return (
    <SkiaImage
      image={image}
      x={GYM_LIFT_STAGE.ORIGIN_X}
      y={GYM_LIFT_STAGE.ORIGIN_Y}
      width={GYM_LIFT_STAGE.W * GYM_LIFT_STAGE.SCALE}
      height={GYM_LIFT_STAGE.H * GYM_LIFT_STAGE.SCALE}
      fit="fill"
      sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
    />
  );
}
