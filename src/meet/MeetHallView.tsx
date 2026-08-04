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
 * integers checked against each other by `gymScene.test.ts`.
 *
 * ---------------------------------------------------------------------------
 * THE BAR LOADS BY CLIPPING, NOT BY A SECOND DRAWING
 * ---------------------------------------------------------------------------
 * See `meetHall.ts`. Two sprite frames of the same pose — one with a bare bar,
 * one fully loaded — and a window that widens from the shaft outward. The
 * plates that appear are `renderLifterFrame`'s own discs at their real relative
 * diameters, in the sprite palette, on the sprite's pixel grid.
 *
 * ---------------------------------------------------------------------------
 * NOT VERIFIED ON A DEVICE
 * ---------------------------------------------------------------------------
 * Same status as `GymSceneView.tsx` and `LifterSpriteView.tsx`: this type-checks
 * against the installed Skia types and follows the same documented paths those
 * files do. `tools/capture-meet.mjs` is what actually proves the pixels.
 *
 * NO ARITHMETIC AND NO GAME MATH HERE. The scene, the frame specs and the
 * reveal geometry are all `meetHall.ts`'s, which is pure and tested.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  FilterMode,
  Group,
  Image as SkiaImage,
  MipmapMode,
  Rect,
  rect,
} from '@shopify/react-native-skia';

import { GymSceneLayer } from '../art/GymSceneView';
import { makeSpriteImage } from '../art/LifterSpriteView';
import { CENTER_X } from '../art/spriteTuning';
import { LIFT_TUNING } from '../game/liftTuning';
import { SPRITE_BOX } from '../lift/liftFrame';
import { hallLifterFrame, hallPlateCount, plateRevealPx, MEET_HALL_SCENE } from './meetHall';
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
}

export function MeetHallView({ lifter, scrim }: MeetHallViewProps): React.ReactElement {
  const totalKg = lifter === null ? null : lifter.totalKg;
  const barKg = lifter === null ? null : lifter.barAndCollarsKg;
  const loadRatio = lifter === null ? null : lifter.loadRatio;

  // The two frames of the same pose. Memoised on the three numbers that shape
  // them rather than on the object, so a re-render for a plate landing does not
  // rasterise 6,912 pixels twice more.
  const loadedImage = useMemo(
    () =>
      totalKg === null || barKg === null || loadRatio === null
        ? null
        : makeSpriteImage(hallLifterFrame(loadRatio, totalKg, barKg)),
    [totalKg, barKg, loadRatio],
  );
  const bareImage = useMemo(
    () =>
      barKg === null || loadRatio === null
        ? null
        : makeSpriteImage(hallLifterFrame(loadRatio, barKg, barKg)),
    [barKg, loadRatio],
  );

  // How much of the loaded bar is showing. `undefined` means "already loaded",
  // which resolves to the whole stack and therefore to the whole cell.
  const reveal = useMemo(() => {
    if (totalKg === null || barKg === null) return 0;
    const shown = lifter?.platesLoaded ?? hallPlateCount(totalKg, barKg);
    return plateRevealPx(shown, totalKg, barKg);
  }, [totalKg, barKg, lifter?.platesLoaded]);

  const centreX = SPRITE_BOX.x + CENTER_X * SPRITE_SCALE;
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

      <GymSceneLayer spec={MEET_HALL_SCENE} />

      {/* The bare bar, then the loaded bar through a widening window. */}
      {bareImage === null ? null : (
        <SkiaImage
          image={bareImage}
          x={SPRITE_BOX.x}
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
            x={SPRITE_BOX.x}
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
