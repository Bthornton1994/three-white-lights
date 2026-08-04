/**
 * LiftStage — everything the mechanic draws, on one Skia canvas.
 *
 * CLAUDE.md: "Skia for bar-path and rep rendering." Four things share the
 * canvas so they can be composited against each other rather than stacked as
 * separate views:
 *
 *   0. THE ROOM (GDD §12.2 "Gym / environment art"), drawn first and behind
 *      everything. It is a background LAYER, not a screen: `renderGymScene`
 *      knows nothing about the mechanic, and this screen knows nothing about
 *      what is in the room. Its pixel grid is pinned to the sprite's — same
 *      integer scale, and an origin chosen so the two lattices are in phase —
 *      because two nearest-neighbour images at different phases shimmer along
 *      every edge where they meet. See `GYM_LIFT_STAGE`.
 *   1. THE LIFTER, as the 16-bit sprite the art system already renders. Drawn
 *      through `makeSpriteImage` with nearest-neighbour sampling and an integer
 *      upscale (GDD §7.1 — a fractional scale produces uneven pixel sizes and
 *      is how pixel art gets ruined in a mobile app).
 *   2. THE BAR-PATH PLOT, a side-on trace of the bar's sagittal drift against
 *      its height. This is the view the sprite CANNOT be: the sprite is drawn
 *      head-on, so forward drift reaches it only as the body folding. Here it
 *      is the literal shape a lifter would recognise from a bar-path app.
 *   3. THE CUE RING, which shrinks onto its target ring at the exact tick the
 *      input would grade 'perfect'.
 *
 * NO MECHANIC LOGIC. Every geometry decision comes from `liftFrame.ts` and
 * every number from `LIFT_TUNING`. `liftTuning.test.ts` scans this file for
 * numeric literals and fails on anything that is not 0, 1 or 2.
 */

import React, { useMemo, useRef } from 'react';
import {
  Canvas,
  Circle,
  FilterMode,
  Group,
  Image as SkiaImage,
  MipmapMode,
  Path,
  Rect,
  Skia,
  type SkImage,
  type SkPath,
} from '@shopify/react-native-skia';

import { makeSpriteImage } from '../art/LifterSpriteView';
import { GymSceneLayer } from '../art/GymSceneView';
import { liftStageScene } from '../art/gymScene';
import { LIFT_TUNING, STICK_HEIGHT_FRAC, STICK_WIDTH } from '../game/liftTuning';
import { cueProgress, type LiftState } from '../game/lift';
import { LIFT_PALETTE } from './liftPalette';
import {
  SPRITE_BOX,
  cuePulse,
  cueRing,
  frameKey,
  hitFlash,
  liftFrameSpec,
  stageShake,
  traceAlpha,
  traceX,
  traceY,
} from './liftFrame';

const L = LIFT_TUNING.LAYOUT;
const F = LIFT_TUNING.FEEDBACK;

/**
 * The room, built once at module load.
 *
 * It is a constant because it is one: `renderGymScene` is pure and this spec
 * never changes on this screen — no camera pan, no venue switch, nothing about
 * the player. Rebuilding it per render would raster 22,490 pixels a frame to
 * produce the same bytes.
 */
const SCENE = liftStageScene();

export interface LiftStageProps {
  readonly state: LiftState;
  readonly history: readonly LiftState[];
  readonly totalKg: number;
}

/**
 * Rasterising the sprite is a per-pixel shading pass over a 96x72 grid, which is
 * far too expensive to redo every tick. The drawing is quantised (see
 * `liftFrame.ts`), so most ticks reuse the previous image; this holds the last
 * one and its key.
 */
function useSpriteImage(state: LiftState, totalKg: number): SkImage | null {
  const cache = useRef<{ key: string; image: SkImage | null }>({ key: '', image: null });
  return useMemo(() => {
    const spec = liftFrameSpec(state, totalKg);
    const key = frameKey(spec);
    if (cache.current.key === key) return cache.current.image;
    const image = makeSpriteImage(spec);
    cache.current = { key, image };
    return image;
  }, [state, totalKg]);
}

function tracePath(history: readonly LiftState[], from: number, to: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  let started = false;
  for (let i = from; i < to; i += 1) {
    const s = history[i];
    if (s === undefined) continue;
    const x = traceX(s.barForwardPx);
    const y = traceY(s.height);
    if (!started) {
      builder.moveTo(x, y);
      started = true;
    } else {
      builder.lineTo(x, y);
    }
  }
  return builder.build();
}

export function LiftStage({ state, history, totalKg }: LiftStageProps): React.ReactElement {
  const image = useSpriteImage(state, totalKg);
  const ring = cueRing(cueProgress(state));
  const shake = stageShake(state);
  const flash = hitFlash(state);
  const pulse = cuePulse(state.tick);
  const lastTiming = state.timings[state.timings.length - 1];

  // The trace is drawn as a few segments of increasing alpha rather than one
  // path per point: a Skia path per tick would be two hundred draw calls a
  // frame, and the fade only has to read as a fade.
  const segments = useMemo(() => {
    const max = F.TRACE_MAX_POINTS;
    const from = Math.max(0, history.length - max);
    const count = history.length - from;
    const bands = Math.max(1, Math.min(count, F.TRACE_FADE_BANDS));
    const out: { path: SkPath; alpha: number }[] = [];
    for (let b = 0; b < bands; b += 1) {
      const start = from + Math.floor((count * b) / bands);
      // Overlap by one so the bands join instead of showing gaps.
      const end = from + Math.min(count, Math.floor((count * (b + 1)) / bands) + 1);
      if (end - start < 2) continue;
      out.push({ path: tracePath(history, start, end), alpha: traceAlpha(b, bands) });
    }
    return out;
  }, [history]);

  const stickY = traceY(STICK_HEIGHT_FRAC);
  const legalY = traceY(1 - LIFT_TUNING.DEPTH_LEGAL);
  const barY = traceY(state.height);
  // Half-height of the sticking-point band, from the width the demand curve
  // actually uses, so the drawn band is the region the bar really slows in.
  const stickBandH = Math.max(1, traceY(STICK_HEIGHT_FRAC - STICK_WIDTH) - stickY);

  return (
    <Canvas style={{ width: L.STAGE_W, height: L.STAGE_H }}>
      {/* The base fill is still here and still does a job: the room is an
          integer number of scene pixels and the stage is not, so this is what
          the last fractional row lands on rather than on nothing. */}
      <Rect x={0} y={0} width={L.STAGE_W} height={L.STAGE_H} color={LIFT_PALETTE.STAGE} />

      {/* --- the room the lift happens in ------------------------------ */}
      <GymSceneLayer spec={SCENE} />

      {/* --- bar-path plot -------------------------------------------- */}
      <Group>
        <Rect
          x={L.TRACE_X}
          y={L.TRACE_TOP}
          width={L.TRACE_W}
          height={L.TRACE_BOTTOM - L.TRACE_TOP}
          color={LIFT_PALETTE.PANEL}
        />
        {/* The sticking point, as a band rather than a line: it has width. */}
        <Rect
          x={L.TRACE_X}
          y={stickY - stickBandH}
          width={L.TRACE_W}
          height={stickBandH * 2}
          color={LIFT_PALETTE.GUIDE_STICK}
        />
        {/* Legal depth. Above this line is a red light. */}
        <Rect
          x={L.TRACE_X}
          y={legalY}
          width={L.TRACE_W}
          height={L.TRACE_GUIDE_DASH / 2}
          color={LIFT_PALETTE.GUIDE_DEPTH}
        />
        {/* Plumb line: where the bar would travel with no drift at all. */}
        <Rect
          x={traceX(0)}
          y={L.TRACE_TOP}
          width={1}
          height={L.TRACE_BOTTOM - L.TRACE_TOP}
          color={LIFT_PALETTE.GUIDE_LINE}
        />
        {segments.map((segment, i) => (
          <Path
            key={i}
            path={segment.path}
            color={LIFT_PALETTE.TRACE}
            style="stroke"
            strokeWidth={F.TRACE_WIDTH}
            opacity={segment.alpha}
          />
        ))}
        {/* The bar itself, on the plot. */}
        <Rect
          x={traceX(state.barForwardPx) - L.TRACE_BAR_HALF_W}
          y={barY - 1}
          width={L.TRACE_BAR_HALF_W * 2}
          height={F.TRACE_WIDTH}
          color={LIFT_PALETTE.BAR_STEEL}
        />
      </Group>

      {/* --- the lifter, shaken by whatever the bar is doing to him ---- */}
      <Group transform={[{ translateX: shake.dx }, { translateY: shake.dy }]}>
        <SkiaImage
          image={image}
          x={SPRITE_BOX.x}
          y={SPRITE_BOX.y}
          width={SPRITE_BOX.w}
          height={SPRITE_BOX.h}
          fit="fill"
          sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
        />
      </Group>

      {/* --- cue ring -------------------------------------------------- */}
      {ring === null ? null : (
        <Group>
          <Circle
            cx={L.CUE_X}
            cy={L.CUE_Y}
            r={ring.targetRadius}
            color={LIFT_PALETTE.CUE_TARGET}
            style="stroke"
            strokeWidth={1}
          />
          <Circle
            cx={L.CUE_X}
            cy={L.CUE_Y}
            r={ring.radius}
            color={ring.inPerfectBand ? LIFT_PALETTE.CUE_PERFECT : LIFT_PALETTE.CUE}
            style="stroke"
            strokeWidth={F.CUE_RING_STROKE}
            opacity={ring.inPerfectBand ? 1 : pulse}
          />
        </Group>
      )}

      {/* --- the flash left behind by an input that just landed -------- */}
      {flash <= 0 || lastTiming === undefined ? null : (
        <Circle
          cx={L.CUE_X}
          cy={L.CUE_Y}
          r={F.CUE_RING_OUTER_R - (F.CUE_RING_OUTER_R - F.CUE_RING_INNER_R) * flash}
          color={
            lastTiming.grade === 'missed' ? LIFT_PALETTE.MISS : LIFT_PALETTE.CUE_PERFECT
          }
          style="stroke"
          strokeWidth={F.CUE_RING_STROKE}
          opacity={flash}
        />
      )}
    </Canvas>
  );
}
