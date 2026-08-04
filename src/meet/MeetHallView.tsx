/**
 * MeetHallView — the hall, behind whatever the beat is saying.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT IS FOR
 * ---------------------------------------------------------------------------
 * GDD §12.2 judges meet day against "real powerlifting broadcast footage — a
 * third-attempt walkout". A broadcast walkout is the moment the hall is MOST
 * visible: the crowd on its feet, the spotters stepping back, the panel seated.
 * Before this, ours removed the building — the walk-out, the deliberation, the
 * lights and the one-way choice after a miss were all text on a black field, and
 * the only frame in the sequence with a room in it was the one where the player
 * is pressing the screen.
 *
 * This is the layer that puts them somewhere. It is a BACKGROUND, drawn behind
 * a screen's own content: it has no text, no button and no state, and it never
 * decides anything about the meet.
 *
 * ---------------------------------------------------------------------------
 * AND NOW IT MOVES — BUT ONLY WHERE IT IS ASKED TO
 * ---------------------------------------------------------------------------
 * It used to draw ONE memoised still of the brace over a static room, for every
 * beat, for the whole beat. So the walk-out contained no walk-out, and the room
 * behind an opener was byte-identical to the room behind a third attempt with
 * nothing banked.
 *
 * Two optional channels fix that, and this file owns neither of them:
 *
 *   `lifter.pose`   one frame of `src/meet/walkout.ts`'s timing sheet — the
 *                   unrack, the steps back, the settle. Omitted, the lifter is
 *                   drawn at the settled brace, which is what every beat AFTER
 *                   the walk-out wants and is exactly what this file drew
 *                   before.
 *   `crowdRisePx`   scene rows the seating has come up by. Omitted or 0, the
 *                   room is `MEET_HALL_SCENE` itself and the raster is
 *                   byte-for-byte the room every previous pass measured.
 *
 * SCARCITY IS THE POINT (GDD §7.2). Nothing here animates on its own. A beat
 * that hands over neither channel gets the still it always got, and most of the
 * staged beats do exactly that.
 *
 * ---------------------------------------------------------------------------
 * THE SAME ROOM, THE SAME BOX, THE SAME LATTICE AS THE REP
 * ---------------------------------------------------------------------------
 * `MEET_HALL_SCENE` is `liftStageScene()` with `MEET_TUNING.VENUE` — the exact
 * spec `LiftStage` builds for the attempt — and the image is placed at
 * `GYM_LIFT_STAGE`'s own origin and integer scale. So the hall behind the
 * walkout and the hall behind the rep are the same pixels in the same place, and
 * the cut between them is a cut in a continuous shot rather than a teleport.
 *
 * NEAREST NEIGHBOUR, INTEGER SCALE (GDD §7.1). Both images below pin
 * `FilterMode.Nearest` with mipmaps off and take their size from
 * `GYM_LIFT_STAGE.SCALE` / `LIFT_TUNING.FEEDBACK.SPRITE_SCALE`, which are
 * integers checked against each other by `gymScene.test.ts`. The walk-out's
 * sideways travel is a whole number of SPRITE pixels multiplied by that same
 * integer scale, so a moving figure lands on the lattice on every frame — which
 * is why the sheet quantises `bodyDxPx` rather than easing a float.
 *
 * ---------------------------------------------------------------------------
 * THE BAR LOADS BY CLIPPING, NOT BY A SECOND DRAWING
 * ---------------------------------------------------------------------------
 * See `meetHall.ts`. Two sprite frames of the same pose — one with a bare bar,
 * one fully loaded — and a window that widens from the shaft outward. The
 * plates that appear are `renderLifterFrame`'s own discs at their real relative
 * diameters, in the sprite palette, on the sprite's pixel grid. The bare frame
 * is now the loaded frame's own spec with the plates taken off, so the two are
 * the same drawing of the same man whatever the walk-out is doing to him.
 *
 * ---------------------------------------------------------------------------
 * RASTER COST, SINCE THIS FILE NOW REDRAWS
 * ---------------------------------------------------------------------------
 * `useSpriteImage` caches on `frameKey`, the same idiom `LiftStage` uses for the
 * rep. The walk-out's sheet is roughly a dozen drawings over two seconds, not
 * one per display frame, so the sprite is rasterised about a dozen times for the
 * whole beat. The ROOM is cached by `GymSceneLayer` on its fields, and
 * `crowdRisePx` is whole rows, so a hall that comes up costs one extra room
 * raster per row it rises and nothing after that.
 *
 * ---------------------------------------------------------------------------
 * NOT VERIFIED ON A DEVICE
 * ---------------------------------------------------------------------------
 * Same status as `GymSceneView.tsx` and `LifterSpriteView.tsx`: this type-checks
 * against the installed Skia types and follows the same documented paths those
 * files do. `tools/capture-meet.mjs` is what actually proves the pixels.
 *
 * NO ARITHMETIC AND NO GAME MATH HERE. The scene, the frame specs, the
 * choreography and the reveal geometry are all `meetHall.ts`'s and
 * `walkout.ts`'s, which are pure and tested.
 */

import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  FilterMode,
  Group,
  Image as SkiaImage,
  MipmapMode,
  Rect,
  rect,
  type SkImage,
} from '@shopify/react-native-skia';

import { GymSceneLayer } from '../art/GymSceneView';
import { makeSpriteImage } from '../art/LifterSpriteView';
import type { LifterFrameSpec } from '../art/lifterSprite';
import { CENTER_X } from '../art/spriteTuning';
import { LIFT_TUNING } from '../game/liftTuning';
import { SPRITE_BOX, frameKey } from '../lift/liftFrame';
import { hallLifterFrame, hallPlateCount, hallScene, plateRevealPx } from './meetHall';
import { walkoutLifterFrame, type WalkoutFrame } from './walkout';
import { MEET_PALETTE } from './meetPalette';

const L = LIFT_TUNING.LAYOUT;
const SPRITE_SCALE = LIFT_TUNING.FEEDBACK.SPRITE_SCALE;

/** Who is on the platform, and what is on their back. */
export interface MeetHallLifter {
  /** Everything on the bar, including bar and collars, kg. */
  readonly totalKg: number;
  /** What the bar and collars weigh on their own, kg. */
  readonly barAndCollarsKg: number;
  /** Attempt weight over the lifter's best single — how hard he is drawn. */
  readonly loadRatio: number;
  /**
   * Discs per side that have landed so far. Omitted, the bar is already loaded,
   * which is what every beat after the walk-out wants.
   */
  readonly platesLoaded?: number | undefined;
  /**
   * One frame of the walk-out's timing sheet (`src/meet/walkout.ts`) — the
   * unrack, a step, the settle. Omitted, he is drawn at the settled brace and
   * does not move, which is right for the deliberation, the verdict and the
   * attempt choice and was wrong for exactly one beat.
   */
  readonly pose?: WalkoutFrame | undefined;
}

export interface MeetHallViewProps {
  /**
   * The lifter, or `null` for an empty platform. Between attempts nobody is
   * standing on it, and drawing one there would be a lie about where the lifter
   * is (GDD §6.3's choice is made off the platform).
   */
  readonly lifter: MeetHallLifter | null;
  /**
   * How far the room is held back under whatever is drawn over it, 0..1.
   * `MEET_TUNING.HALL` owns the values; a screen names one, never a number.
   */
  readonly scrim: number;
  /**
   * Scene rows the seating has come up by. Omitted or 0, the hall is seated and
   * the room is the same object every other beat draws. `MEET_TUNING.CROWD` owns
   * when this is non-zero; a screen reads a ramp, never a number.
   */
  readonly crowdRisePx?: number | undefined;
}

/**
 * The sprite, rasterised at most once per drawing.
 *
 * The same cache `LiftStage`'s `useSpriteImage` keeps, for the same reason: a
 * 96x72 per-pixel shading pass is far too much to redo on a display frame that
 * is showing a drawing it already has.
 */
function useSpriteImage(spec: LifterFrameSpec | null): SkImage | null {
  const cache = useRef<{ key: string; image: SkImage | null }>({ key: '', image: null });
  return useMemo(() => {
    if (spec === null) return null;
    const key = frameKey(spec);
    if (cache.current.key === key) return cache.current.image;
    const image = makeSpriteImage(spec);
    cache.current = { key, image };
    return image;
  }, [spec]);
}

export function MeetHallView({
  lifter,
  scrim,
  crowdRisePx = 0,
}: MeetHallViewProps): React.ReactElement {
  const totalKg = lifter === null ? null : lifter.totalKg;
  const barKg = lifter === null ? null : lifter.barAndCollarsKg;
  const loadRatio = lifter === null ? null : lifter.loadRatio;
  const pose = lifter?.pose ?? null;

  // THE DRAWING. With a walk-out frame it is that frame; without one it is the
  // settled brace, which is the frame the rep itself begins from. Memoised on
  // the values that shape it rather than on the lifter object, so a re-render
  // for a plate landing does not build a new spec and miss the raster cache.
  const loadedSpec = useMemo<LifterFrameSpec | null>(() => {
    if (totalKg === null || barKg === null || loadRatio === null) return null;
    if (pose === null) return hallLifterFrame(loadRatio, totalKg, barKg);
    return walkoutLifterFrame(pose, totalKg, barKg);
  }, [totalKg, barKg, loadRatio, pose]);

  // The SAME drawing with the plates taken off. Built from the loaded spec
  // rather than rebuilt from the pose, so the two can never be two poses — which
  // is what would put a seam down the middle of a man while the bar loads.
  const bareSpec = useMemo<LifterFrameSpec | null>(
    () => (loadedSpec === null || barKg === null ? null : { ...loadedSpec, totalKg: barKg }),
    [loadedSpec, barKg],
  );

  const loadedImage = useSpriteImage(loadedSpec);
  const bareImage = useSpriteImage(bareSpec);

  // How much of the loaded bar is showing. `undefined` means "already loaded",
  // which resolves to the whole stack and therefore to the whole cell.
  const reveal = useMemo(() => {
    if (totalKg === null || barKg === null) return 0;
    const shown = lifter?.platesLoaded ?? hallPlateCount(totalKg, barKg);
    return plateRevealPx(shown, totalKg, barKg);
  }, [totalKg, barKg, lifter?.platesLoaded]);

  // Where he is standing. Whole SPRITE pixels times the integer scale, so a
  // stepping lifter stays on the same lattice as the room behind him.
  const spriteX = SPRITE_BOX.x + (pose?.bodyDxPx ?? 0) * SPRITE_SCALE;
  const centreX = spriteX + CENTER_X * SPRITE_SCALE;
  const window = rect(
    centreX - reveal * SPRITE_SCALE,
    SPRITE_BOX.y,
    reveal * SPRITE_SCALE * 2,
    SPRITE_BOX.h,
  );

  return (
    // THE `testID` IS ON THE VIEW, NOT ON THE CANVAS, and that is not a style
    // choice: Skia's web `Canvas` does not forward `testID` to the DOM, so a
    // marker on it is invisible to `tools/capture-meet.mjs` — which is the one
    // instrument that can say "there is a building in this shot" by looking at
    // the running app rather than at the source. It was on the Canvas first, and
    // the capture reported every staged beat as roomless while the pixels showed
    // a hall.
    <View style={styles.canvas} testID="meet-hall">
    <Canvas style={styles.canvas}>
      {/* The last fractional row of the stage lands on this rather than on
          nothing — the same job the base fill does in `LiftStage`. */}
      <Rect x={0} y={0} width={L.STAGE_W} height={L.STAGE_H} color={MEET_PALETTE.STAGE} />

      <GymSceneLayer spec={hallScene(crowdRisePx)} />

      {/* The bare bar, then the loaded bar through a widening window. */}
      {bareImage === null ? null : (
        <SkiaImage
          image={bareImage}
          x={spriteX}
          y={SPRITE_BOX.y}
          width={SPRITE_BOX.w}
          height={SPRITE_BOX.h}
          fit="fill"
          sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
        />
      )}
      {loadedImage === null ? null : (
        <Group clip={window}>
          <SkiaImage
            image={loadedImage}
            x={spriteX}
            y={SPRITE_BOX.y}
            width={SPRITE_BOX.w}
            height={SPRITE_BOX.h}
            fit="fill"
            sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
          />
        </Group>
      )}

      {/* The scrim. Flat alpha over the finished image, so it dims the room
          without resampling a single pixel of it. */}
      <Rect
        x={0}
        y={0}
        width={L.STAGE_W}
        height={L.STAGE_H}
        color={MEET_PALETTE.BACKDROP}
        opacity={scrim}
      />
    </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: L.STAGE_W, height: L.STAGE_H },
});
