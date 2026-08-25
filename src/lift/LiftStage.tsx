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
 *
 *      WHICH room is the caller's, through the `venue` prop. A Sim set is in
 *      the training gym; a competition attempt is on the meet platform, with
 *      the crowd and the sponsor banner (GDD §6). This file names neither
 *      choice for anybody else — it holds both rooms and draws the one it is
 *      handed.
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
 *   4. THE COMMAND BEAT (GDD §6.2, ruled 2026-08-25) — the armed wait, the hit
 *      at the command tick, and the burst readout. This layer exists because
 *      phone playtest 4 measured the press command's entire stimulus inventory
 *      on the platform the beta ships to (GDD §10.0, web/PWA) and found ONE
 *      live channel: a header text colour. The haptic the spec designates as
 *      the real stimulus does not exist behind a browser tab, and the stage was
 *      pixel-static across the command — `frameKey` byte-identical at command
 *      minus 2 through plus 6. It covers the deadlift's down call by
 *      construction, through the same `commandHit` predicate, because that beat
 *      was measured with the same gap (0 changed lifter pixels).
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
import { ContactShadowLayer, GymSceneLayer } from '../art/GymSceneView';
import { liftStageScene, type GymSceneSpec } from '../art/gymScene';
import type { GymVenue } from '../art/gymTuning';
import { LIFT_TUNING, STICK_HEIGHT_FRAC, STICK_WIDTH } from '../game/liftTuning';
import { cueProgress, type LiftState } from '../game/lift';
import { LIFT_PALETTE } from './liftPalette';
import {
  SPRITE_BOX,
  barGlyphColour,
  burstReadout,
  commandHit,
  cuePulse,
  cueRing,
  frameKey,
  hitFlash,
  liftFrameSpec,
  stageArmed,
  stageShake,
  traceAlpha,
  traceX,
  traceY,
} from './liftFrame';

const L = LIFT_TUNING.LAYOUT;
const F = LIFT_TUNING.FEEDBACK;

/**
 * The SEATED rooms, built once at module load — one per venue.
 *
 * They are constants because they are: `renderGymScene` is pure and neither
 * spec changes while a rep is running — no camera pan, nothing about the
 * player. Rebuilding one per render would raster 22,490 pixels a frame to
 * produce the same bytes. Building BOTH up front costs one extra grid and means
 * switching rooms between screens is a lookup rather than a re-raster.
 *
 * `crowdRisePx` IS COMPOSED ON TOP OF ONE OF THESE RATHER THAN STORED HERE, and
 * that is what keeps the sentence above true: a meet attempt's hall is one of
 * nine rises (`MEET_TUNING.CROWD`), it does not change during the rep, and a
 * table of eighteen rooms built at module load to serve one of them would be
 * eighteen rasters for a screen most players never open.
 *
 * Typed as a total `Record<GymVenue, …>`, so a third venue added to
 * `gymTuning.ts` is a compile error here rather than a silently missing room.
 *
 * BUILT BY OVERRIDING `liftStageScene`'s VENUE, and `gymScene.ts` is not
 * touched. The box — width, height, floor row, focus column — is fixed by
 * `LIFT_TUNING.LAYOUT` and by the sprite's resolution, because it is the hole
 * the figure is drawn into and the figure is the same size wherever he stands.
 * Only the room changes. This is the same idiom `gymScene.test.ts` and
 * `tools/gym.mjs` already use to render the meet platform.
 */
const SCENES: Readonly<Record<GymVenue, GymSceneSpec>> = Object.freeze({
  'training-gym': liftStageScene(),
  'meet-platform': { ...liftStageScene(), venue: 'meet-platform' },
});

/**
 * Which room a screen with no opinion gets.
 *
 * The Sim session is the default because it is the daily one. Meet day states
 * its venue explicitly (`MEET_TUNING.VENUE`) rather than relying on a default,
 * which is the whole point: the emotional centrepiece must not inherit the
 * training gym by omission, which is exactly what it used to do.
 */
const DEFAULT_VENUE: GymVenue = 'training-gym';

export interface LiftStageProps {
  readonly state: LiftState;
  readonly history: readonly LiftState[];
  readonly totalKg: number;
  /**
   * The room this rep happens in (GDD §6 vs §3.2). Omitted, it is the training
   * gym. `AttemptView` passes `MEET_TUNING.VENUE`.
   */
  readonly venue?: GymVenue | undefined;
  /**
   * Scene rows the seating has come up by. Omitted or 0, the hall is seated and
   * the room is `SCENES[venue]` itself — the identical object every Sim set
   * draws, so a screen with no opinion cannot cost a second raster.
   *
   * ---------------------------------------------------------------------------
   * WHY A REP TAKES ONE AT ALL
   * ---------------------------------------------------------------------------
   * The walk-out spends the whole of GDD §6.2's escalation bringing the hall to
   * its feet (`MEET_TUNING.CROWD`, `WALKOUT_TAIL.HUSH_CROWD_RISE_PX`), and this
   * screen is the frame straight after it. Without the prop the rep drew
   * `spec.crowdRisePx ?? 0` — a seated hall — so the crowd sat back down on the
   * frame the bar started moving, which is the one moment of the beat a
   * broadcast has them standing.
   *
   * SAME NAME, SAME DEFAULT, SAME MEANING AS `MeetHallView`'s. The two are the
   * rooms either side of one cut and a reader should not have to check that
   * they agree about units.
   *
   * IT IS NOT A CHANNEL THIS SCREEN ANIMATES. `AttemptView` hands over one
   * number for the whole rep — what the walk-out left the hall at — and nothing
   * here moves it. A hall that reacted DURING the rep would be feedback about
   * the lift in progress, which is a different design and not this one.
   */
  readonly crowdRisePx?: number | undefined;
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

export function LiftStage({
  state,
  history,
  totalKg,
  venue = DEFAULT_VENUE,
  crowdRisePx = 0,
}: LiftStageProps): React.ReactElement {
  const image = useSpriteImage(state, totalKg);
  const seated = SCENES[venue];
  // THE SAME SHAPE `meetHall.ts`'s `hallScene` USES, and for the same reason: at
  // rise 0 this is the module constant itself rather than an equal copy, so
  // every screen that has no opinion about the crowd keeps the one-raster
  // property `SCENES` exists for. A risen hall costs one extra room per row,
  // and the rise is constant for a whole rep, so that is one per attempt.
  const scene = useMemo(
    () => (crowdRisePx <= 0 ? seated : { ...seated, crowdRisePx }),
    [seated, crowdRisePx],
  );
  const ring = cueRing(cueProgress(state));
  const shake = stageShake(state);
  const flash = hitFlash(state);
  const pulse = cuePulse(state.tick);
  const lastTiming = state.timings[state.timings.length - 1];
  // THE COMMAND BEAT (GDD §6.2, ruled 2026-08-25). All three are pure functions
  // of the rep in `liftFrame.ts`; nothing about the beat is decided here.
  const hit = commandHit(state);
  const armed = stageArmed(state);
  const burst = burstReadout(state);

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

  const kind = state.config.kind;
  const stickY = traceY(STICK_HEIGHT_FRAC[kind]);
  // NULL ON ANYTHING BUT A SQUAT, AND THE GUIDE LINE IS NOT DRAWN AT ALL.
  // Legal depth is a squat idea — `LIFT_TUNING.DEPTH_LEGAL` has only a `squat`
  // row and does not type-check with another. Drawing the line anyway at some
  // invented height would be a cue that lies: it would mark a threshold the
  // other two lifts are never judged against. A deadlift's bar never goes
  // below its starting point, and a bench's legality is the chest touch itself
  // (ruled 2026-08-25) — there is no depth between legal and illegal for a
  // line to sit on.
  const legalY = kind === 'squat' ? traceY(1 - LIFT_TUNING.DEPTH_LEGAL[kind]) : null;
  const barY = traceY(state.height);
  // Half-height of the sticking-point band, from the width the demand curve
  // actually uses, so the drawn band is the region the bar really slows in.
  const stickBandH = Math.max(1, traceY(STICK_HEIGHT_FRAC[kind] - STICK_WIDTH[kind]) - stickY);

  return (
    <Canvas style={{ width: L.STAGE_W, height: L.STAGE_H }}>
      {/* The base fill is still here and still does a job: the room is an
          integer number of scene pixels and the stage is not, so this is what
          the last fractional row lands on rather than on nothing. */}
      <Rect x={0} y={0} width={L.STAGE_W} height={L.STAGE_H} color={LIFT_PALETTE.STAGE} />

      {/* --- the room the lift happens in ------------------------------ */}
      <GymSceneLayer spec={scene} />

      {/* --- and what he throws on the floor of it ----------------------
          THE SAME `scene`, not a second one. `contactShadowPatch` samples the
          floor it lands on and steps those pixels down, so a shadow built from
          the training gym's boards under a lifter standing on the meet
          platform is a patch of the wrong colour in the right place. */}
      <ContactShadowLayer scene={scene} frame={liftFrameSpec(state, totalKg)} />

      {/* --- bar-path plot --------------------------------------------
          THE BEZEL IS NOT DECORATION. Composited over a room rather than over a
          flat backdrop, an unedged opaque rectangle reads as a HOLE CUT IN THE
          WALL: the crowd rows run up to it, stop, and continue in the sliver on
          the other side. One keyline turns it into a board mounted on the wall,
          which is a thing a hall can contain.

          IT IS A PARTIAL FIX AND SAYS SO. The sliver is still there, because
          removing it means moving the panel flush to the frame's right edge —
          `LIFT_TUNING.LAYOUT.TRACE_X` from 300 to 312 — and that is the rep's
          own geometry, shared with the daily session, rather than this screen's.
          `GYM_STAGE_CHROME` would move with it. */}
      <Group>
        <Rect
          x={L.TRACE_X}
          y={L.TRACE_TOP}
          width={L.TRACE_W}
          height={L.TRACE_BOTTOM - L.TRACE_TOP}
          color={LIFT_PALETTE.PANEL}
        />
        <Rect
          x={L.TRACE_X}
          y={L.TRACE_TOP}
          width={L.TRACE_W}
          height={L.TRACE_BOTTOM - L.TRACE_TOP}
          color={LIFT_PALETTE.PANEL_EDGE}
          style="stroke"
          strokeWidth={1}
        />
        {/* The sticking point, as a band rather than a line: it has width. */}
        <Rect
          x={L.TRACE_X}
          y={stickY - stickBandH}
          width={L.TRACE_W}
          height={stickBandH * 2}
          color={LIFT_PALETTE.GUIDE_STICK}
        />
        {/* Legal depth. Above this line is a red light. Absent on a deadlift,
            which has no depth judgement — see `legalY`. */}
        {legalY === null ? null : (
          <Rect
            x={L.TRACE_X}
            y={legalY}
            width={L.TRACE_W}
            height={L.TRACE_GUIDE_DASH / 2}
            color={LIFT_PALETTE.GUIDE_DEPTH}
          />
        )}
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
        {/* The bar itself, on the plot — coloured by how it is ARRIVING while a
            bench bar is coming down (`chestApproach`, GDD §6.2), steel
            otherwise. `barGlyphColour` makes that choice; this file draws it. */}
        <Rect
          x={traceX(state.barForwardPx) - L.TRACE_BAR_HALF_W}
          y={barY - 1}
          width={L.TRACE_BAR_HALF_W * 2}
          height={F.TRACE_WIDTH}
          color={barGlyphColour(state)}
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

      {/* --- THE COMMAND HIT ------------------------------------------
          A full-stage wash and a ring that EXPANDS out of the lifter, at the
          tick a command fires. Bench's press call and the deadlift's down call
          both come through `commandHit`; squat has neither and draws nothing.

          DRAWN OVER THE ROOM AND THE LIFTER AND UNDER THE READOUT, and the
          order is load-bearing in both directions. Under the lifter it would be
          a background flicker rather than a hit on the thing being watched;
          over the burst readout it would tint the pips for most of the window
          the pips exist to report, which is the one measurement
          `verify-lift-press.mjs` counts. */}
      {hit === null ? null : (
        <Group>
          <Rect
            x={0}
            y={0}
            width={L.STAGE_W}
            height={L.STAGE_H}
            color={LIFT_PALETTE.COMMAND_FLASH}
            opacity={hit.washAlpha}
          />
          <Circle
            cx={L.CUE_X}
            cy={L.CUE_Y}
            r={hit.ringRadius}
            color={LIFT_PALETTE.COMMAND_RING}
            style="stroke"
            strokeWidth={F.STAGE_COMMAND.RING_STROKE}
            opacity={hit.amount}
          />
        </Group>
      )}

      {/* --- THE ARMED WAIT -------------------------------------------
          One radius, one period, no countdown — see `stageArmed`. The lifter is
          set and the stage is live; nothing here says when the call comes. */}
      {armed === null ? null : (
        <Circle
          cx={L.CUE_X}
          cy={L.CUE_Y}
          r={F.STAGE_COMMAND.ARMED_RING_R}
          color={LIFT_PALETTE.ARMED}
          style="stroke"
          strokeWidth={F.STAGE_COMMAND.ARMED_RING_STROKE}
          opacity={armed}
        />
      )}

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

      {/* --- THE BURST READOUT, DRAWN LAST ----------------------------
          One pip per counted tap the physics cap allows, lit as they land. It
          is on top of everything — including the command wash — so what a
          player sees, and what a pixel check counts inside `tray`, is the pips
          and not the pips seen through a flash. */}
      {burst === null ? null : (
        <Group>
          <Rect
            x={burst.tray.x}
            y={burst.tray.y}
            width={burst.tray.w}
            height={burst.tray.h}
            color={LIFT_PALETTE.BURST_TRAY}
          />
          <Rect
            x={burst.tray.x}
            y={burst.tray.y}
            width={burst.tray.w}
            height={burst.tray.h}
            color={LIFT_PALETTE.BURST_TRAY_EDGE}
            style="stroke"
            strokeWidth={1}
          />
          {burst.pips.map((pip) => (
            <Rect
              key={pip.x}
              x={pip.x}
              y={pip.y}
              width={pip.w}
              height={pip.h}
              color={pip.lit ? LIFT_PALETTE.BURST_PIP_LIT : LIFT_PALETTE.BURST_PIP_DIM}
            />
          ))}
        </Group>
      )}
    </Canvas>
  );
}
