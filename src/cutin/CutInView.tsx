/**
 * CutInView.tsx — the interrupt, on screen.
 *
 * A THIN LAYER. It decides nothing: whether a cut-in fires is `cutInGate.ts`'s,
 * what it shows is `cutInArt.ts`'s, and how long it lasts is `CutInHost.tsx`'s
 * timer. Its LAYOUT numbers are all `CUT_IN_LAYOUT`'s; the one number it takes
 * from anywhere else is `CUT_IN_TUNING.ENTER_MS`, the arrival duration, which
 * lives with the gate's other timings because it is a beat and not a box. What
 * is left here is one full-screen `Pressable`, a Skia image and two lines of
 * type.
 *
 * ---------------------------------------------------------------------------
 * THE WHOLE SCREEN IS THE DISMISS TARGET
 * ---------------------------------------------------------------------------
 * GDD §7.2: "Always skippable — tap to dismiss. Daily players will see these
 * hundreds of times." So there is no close button in a corner and no minimum
 * hold: the `Pressable` is `absoluteFill` and its `onPress` IS the dismiss
 * handler. `cutInWiring.test.ts` reads this file and fails if the press handler
 * stops being the dismiss handler.
 *
 * WHERE THE FIRST-FRAME TAP IS ACTUALLY DECIDED, which is NOT here. This header
 * used to say `CUT_IN_TUNING.DISMISS_ENABLED_AFTER_MS` is zero "so the first
 * frame accepts a tap", and that causation was false: nothing on the route from
 * this `onPress` to the gate consulted a clock, so the first frame accepted a
 * tap because NO window was implemented, and setting the constant to 300 —
 * which `cutInTuning.ts` invites in writing — would have reddened two unit tests
 * and changed the behaviour of the app not at all. The window is now real and it
 * is the HOST's: `CutInHost.dismissByTap` measures the beat and asks
 * `tapDismissCutIn`, so the zero is what makes the first frame dismissible and
 * moving it is a change to what a player can do.
 *
 * The skip hint is PRINTED rather than implied, for the same "hundreds of
 * times" reason: a player who does not know the screen is tappable waits it
 * out, which is the tax the rule exists to remove.
 *
 * ---------------------------------------------------------------------------
 * IT IS PLACEHOLDER ART, AND WHAT MAKES IT PLACEHOLDER IS THE TABLE IT READS
 * ---------------------------------------------------------------------------
 * GDD §7.2 says to cut cut-in art entirely from the early prototypes, and §11
 * records the working assumption this run applies. Nothing is drawn here or in
 * `cutInArt.ts` — `cutInArt.test.ts` reads both files and fails on an authored
 * drawing. What arrives on screen is `renderCutIn`'s CUT-IN GRID: the Tier 3
 * drawing `partners.ts` already holds, stamped into a cut-in-shaped composition
 * of a ground, two rules and a well, with ONE line of Tier 3 caption under it.
 *
 * THE SAME WITNESS, NOT THE SAME PICTURE. `cutInArt.ts` reads the table through
 * `tier3Of(entry, live.slot, CUT_IN_SURFACE)` — the identical §7.3 door
 * `src/licensing/renderPanels.ts` goes through — and stamps with that module's
 * own `drawArt`. So a licensed portrait later is still a row in `partners.ts`
 * and this file still does not change. What it does NOT do is mount
 * `renderPanel`: that is the character-select / shop composition, it draws all
 * three tiers at once by design, and on the interrupt beat it printed the
 * partner's name twice with `COMPACT BUILD` under it over a colorway strip. GDD
 * §7.2 rules on this by name, and §7.2 also records why it was a §7.3 failure
 * rather than an ugly frame: no row of the table could have removed that build
 * label, so the promise that the art pass is a data change was false as written
 * while the cut-in read the panel.
 *
 * SO THERE IS NO TIER 2 AND NO TIER 1 FURNITURE ON THIS SCREEN — no name tag, no
 * colorway swatches, no build label. The one identity line is the Tier 3
 * CAPTION, because the caption is a field of the same `Tier3Content` as the
 * drawing and therefore follows the slot. That ruling is PER MOMENT, and the
 * per-moment table is `CUT_IN_ART.SLOT` in `cutInTuning.ts`: point a beat at
 * `wordmark` or `product` there and the picture and the line move together,
 * which a name tag would not. `cutInArt.ts`'s header states the cost.
 *
 * NEAREST NEIGHBOUR ONLY (GDD §7.1), the same two ways `LicensedPanelView` and
 * `ResultCardView` do it: `FilterMode.Nearest` with mipmaps off, and a whole
 * number for `scale` chosen by `cutInScaleFor`.
 *
 * ---------------------------------------------------------------------------
 * THE SCRIM IS A SEPARATE LAYER FROM THE ARRIVAL
 * ---------------------------------------------------------------------------
 * `CUT_IN_LAYOUT.SCRIM_OPACITY` says how much of the screen behind is left
 * visible. It used to sit on the same node the arrival animation drives, which
 * applies `opacity` last and therefore won — so the constant was registered,
 * documented and read by no pixel. It is its own absolutely-positioned layer
 * now. `tools/capture-cutin.mjs` measures it on real frames: an overlay that
 * had gone opaque again would leave zero blended pixels behind it.
 *
 * THE PIXELS ARE IN THE REPOSITORY. `.gauntlet/shots/cutin/` is committed — ten
 * PNGs and `frames.json` — so a reader who goes looking for the evidence finds
 * it in a fresh checkout instead of being told to take it themselves. This
 * sentence has been wrong twice in opposite directions: it first claimed the
 * screen "has now been photographed" while `.gauntlet/shots/` was gitignored and
 * the directory existed on one machine, then went on denying the pictures were
 * here after `.gitignore` was amended to keep them. What is there now:
 *
 *     .gauntlet/shots/cutin/baseline-no-cutin.png     `?cutin=nonsense`, no overlay
 *     .gauntlet/shots/cutin/<moment>.png              one frozen frame per §7.2 moment
 *     .gauntlet/shots/cutin/live-mid-hold.png         the timer running
 *     .gauntlet/shots/cutin/live-after-auto-dismiss.png
 *     .gauntlet/shots/cutin/live-after-tap.png        a CORNER tap, not the centre
 *     .gauntlet/shots/cutin/played-*.png              the two played `?meet=` paths
 *     .gauntlet/shots/cutin/frames.json               every measurement below
 *
 * TO REGENERATE THEM, with the instrument that is also in the repo:
 *
 *     npx expo start --web        # then, against whatever port it prints
 *     node tools/capture-cutin.mjs --url http://localhost:8081
 *
 * That run measures what a source scan cannot — the four corners hit-tested with
 * `elementFromPoint`, whether the overlay is above the screen it interrupts, and
 * how many pixels survive `SCRIM_OPACITY` — writes the answers into
 * `frames.json`, and exits non-zero if any of it is wrong. `cutInWiring.test.ts`
 * fails if the directory this paragraph names stops being in the tree, so the
 * sentence cannot go stale a third time without something going red.
 *
 * WHAT THE PICTURES STILL DO NOT SETTLE. Whether it READS as an interrupt is a
 * playtest judgement (GDD §12.1): no critic can judge a beat it cannot feel, and
 * a screenshot is not a feeling. That is the whole of it now — this paragraph
 * used to add that the frames could not date themselves, which was true when it
 * was written and stopped being true in the same wave: `frames.json` now
 * carries `capturedFrom` (commit, branch, clean/dirty) and an `instrument`
 * digest of the tools that produced it, the same way
 * `.gauntlet/shots/shell/route.json` does, and `tools/evidence.mjs --verify`
 * fails on a record that is missing either, was captured dirty, stamps a commit
 * with code changes since, or reports its own run as red.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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

import { RGBA } from '../art/palette';
import { sheetGridToRgba } from '../card/sheetPalette';
import type { LicensingCatalogue } from '../licensing/catalogue';
import { LIFT_PALETTE } from '../lift/liftPalette';
import { cutInScaleFor, renderCutIn } from './cutInArt';
import type { LiveCutIn } from './cutInGate';
import { CUT_IN_COPY, CUT_IN_LAYOUT, CUT_IN_TUNING } from './cutInTuning';

const L = CUT_IN_LAYOUT;

/** Build the Skia image for a live cut-in. Same path as `LicensedPanelView`. */
function makeCutInImage(
  catalogue: LicensingCatalogue,
  live: LiveCutIn,
): { image: SkImage | null; w: number; h: number } {
  const grid = renderCutIn(catalogue, live);
  const bytes = sheetGridToRgba(grid);
  const data = Skia.Data.fromBytes(bytes);
  const image = Skia.Image.MakeImage(
    {
      width: grid.w,
      height: grid.h,
      alphaType: AlphaType.Unpremul,
      colorType: ColorType.RGBA_8888,
    },
    data,
    grid.w * RGBA.BYTES_PER_PIXEL,
  );
  return { image, w: grid.w, h: grid.h };
}

export interface CutInViewProps {
  readonly live: LiveCutIn;
  readonly catalogue: LicensingCatalogue;
  /** Viewport width in logical points. The panel picks its own whole scale. */
  readonly availableWidth: number;
  /** GDD §7.2's "tap to dismiss". The whole screen calls this. */
  readonly onDismiss: () => void;
}

export function CutInView({
  live,
  catalogue,
  availableWidth,
  onDismiss,
}: CutInViewProps): React.ReactElement {
  const { image, w, h } = React.useMemo(
    () => makeCutInImage(catalogue, live),
    [catalogue, live],
  );
  const scale = cutInScaleFor(w, availableWidth);

  // It CUTS in. A short rise rather than a fade-up, because §7.2's whole
  // argument is that the thing interrupts.
  const arrived = useSharedValue(0);
  React.useEffect(() => {
    arrived.value = 0;
    arrived.value = withTiming(1, { duration: CUT_IN_TUNING.ENTER_MS });
  }, [arrived, live]);
  const arrivalStyle = useAnimatedStyle(() => ({ opacity: arrived.value }));

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel={CUT_IN_COPY.SKIP_HINT}
      testID="cut-in"
    >
      <Animated.View style={[styles.root, arrivalStyle]}>
        {/*
          THE SCRIM IS ITS OWN LAYER, and it has to be. It used to be
          `opacity: L.SCRIM_OPACITY` on this same node, under the arrival
          animation's `{ opacity: arrived.value }` — which is applied last and
          therefore won, so once the enter timing completed the overlay sat at
          opacity 1 over an opaque backdrop and the registered tunable reached
          no pixel at all. Split out, the arrival animates the WHOLE overlay in
          and `SCRIM_OPACITY` decides how much of the interrupted screen shows
          through it, which is what its name has always claimed.

          Absolutely positioned, so it is out of the flex flow and takes no part
          in the `gap` or the centring, and drawn first so the panel and the
          copy sit on top of it at full weight.
        */}
        <View style={[StyleSheet.absoluteFill, styles.scrim]} testID="cut-in-scrim" />

        <View style={{ width: w * scale, height: h * scale }} testID="cut-in-art">
          <Canvas style={{ width: w * scale, height: h * scale }}>
            {image === null ? null : (
              <Image
                image={image}
                x={0}
                y={0}
                width={w * scale}
                height={h * scale}
                fit="fill"
                sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
              />
            )}
          </Canvas>
        </View>

        <Text style={styles.line} testID="cut-in-line">
          {CUT_IN_COPY.LINE[live.moment]}
        </Text>

        <Text style={styles.hint} testID="cut-in-skip-hint">
          {CUT_IN_COPY.SKIP_HINT}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: L.ROW_GAP,
    paddingHorizontal: L.SCREEN_PAD,
  },
  /**
   * How much of the interrupted screen is left visible. NOT on `root`: the
   * arrival animation sets `opacity` on that node and would override it.
   */
  scrim: {
    backgroundColor: LIFT_PALETTE.BACKDROP,
    opacity: L.SCRIM_OPACITY,
  },
  line: {
    color: LIFT_PALETTE.TEXT,
    fontSize: L.LINE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
    textAlign: 'center',
  },
  hint: {
    color: LIFT_PALETTE.TEXT_DIM,
    fontSize: L.HINT_FONT,
    letterSpacing: L.LETTER_SPACING,
    opacity: L.HINT_OPACITY,
  },
});
