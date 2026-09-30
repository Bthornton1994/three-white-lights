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
import {
  contactShadowPatch,
  liftContactShadow,
  renderGymScene,
  type GymSceneSpec,
} from './gymScene';
import { GYM_CONTACT_SHADOW, GYM_LIFT_STAGE } from './gymTuning';
import type { IndexGrid } from './raster';
import type { LifterFrameSpec } from './lifterSprite';

function imageFromGrid(grid: IndexGrid): SkImage | null {
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

/** Build an SkImage for one room. Static per spec — memoise at the call site. */
export function makeGymSceneImage(spec: GymSceneSpec): SkImage | null {
  return imageFromGrid(renderGymScene(spec));
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
    // Field by field rather than on the object, so a caller that rebuilds an
    // equal spec every render does not re-raster 22,490 pixels. `crowdRisePx`
    // is on the list because meet day brings the hall up (GDD §6.2, and
    // `MEET_TUNING.CROWD`); a room memoised without it would stay seated for
    // the whole beat while every other layer said it had stood.
    [spec.venue, spec.w, spec.h, spec.floorRow, spec.focusX, spec.cameraX, spec.crowdRisePx],
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

export interface ContactShadowLayerProps {
  readonly scene: GymSceneSpec;
  readonly frame: LifterFrameSpec;
}

/**
 * What the lifter throws on the floor he is standing on.
 *
 * A SEPARATE, TINY IMAGE rather than a re-render of the room. The room is a
 * constant built once — 22,490 pixels — and the shadow changes shape every time
 * he changes depth. `contactShadowPatch` returns only the box the shadow covers,
 * already painted in the room's own colours stepped down, so what goes to the
 * GPU per frame is a few hundred pixels on the same lattice as everything else.
 *
 * Draw it AFTER the room and BEFORE the figure.
 */
export function ContactShadowLayer({
  scene,
  frame,
}: ContactShadowLayerProps): React.ReactElement | null {
  // The room it lands on is a constant per spec, so it is rastered once and not
  // once per pose. Rebuilding it here would put 22,490 pixels through a shading
  // pass to darken three hundred of them.
  const room = useMemo(
    () => renderGymScene(scene),
    [scene.venue, scene.w, scene.h, scene.floorRow, scene.focusX, scene.cameraX],
  );
  const patch = useMemo(
    () =>
      contactShadowPatch(
        room,
        liftContactShadow(frame),
        GYM_LIFT_STAGE.SPRITE_X,
        GYM_LIFT_STAGE.SPRITE_Y,
        GYM_CONTACT_SHADOW.STEPS,
      ),
    // The shadow's identity is the surface it lands on and the pose numbers that
    // shape it. Everything else about the frame — tilt, bend, chalk, load — does
    // not reach it, so depending on the spec object would rebuild it on every
    // tick of a held pose.
    [room, frame.depth, frame.direction, frame.strainLevel, frame.pitchLevel],
  );
  const image = useMemo(() => (patch === null ? null : imageFromGrid(patch.grid)), [patch]);
  if (patch === null) return null;
  return (
    <SkiaImage
      image={image}
      x={GYM_LIFT_STAGE.ORIGIN_X + patch.x * GYM_LIFT_STAGE.SCALE}
      y={GYM_LIFT_STAGE.ORIGIN_Y + patch.y * GYM_LIFT_STAGE.SCALE}
      width={patch.grid.w * GYM_LIFT_STAGE.SCALE}
      height={patch.grid.h * GYM_LIFT_STAGE.SCALE}
      fit="fill"
      sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
    />
  );
}
