/**
 * CutInView.tsx — the interrupt, on screen.
 *
 * A THIN LAYER. It decides nothing: whether a cut-in fires is `cutInGate.ts`'s,
 * what it shows is `cutInArt.ts`'s, how long it lasts is `CutInHost.tsx`'s
 * timer, and every number it uses is `CUT_IN_LAYOUT`'s. What is left here is
 * one full-screen `Pressable`, a Skia image and two lines of type.
 *
 * ---------------------------------------------------------------------------
 * THE WHOLE SCREEN IS THE DISMISS TARGET
 * ---------------------------------------------------------------------------
 * GDD §7.2: "Always skippable — tap to dismiss. Daily players will see these
 * hundreds of times." So there is no close button in a corner and no minimum
 * hold: the `Pressable` is `absoluteFill`, its `onPress` IS the dismiss
 * handler, and `CUT_IN_TUNING.DISMISS_ENABLED_AFTER_MS` is zero so the first
 * frame accepts a tap. `cutInWiring.test.ts` reads this file and fails if the
 * press handler stops being the dismiss handler.
 *
 * The skip hint is PRINTED rather than implied, for the same "hundreds of
 * times" reason: a player who does not know the screen is tappable waits it
 * out, which is the tax the rule exists to remove.
 *
 * ---------------------------------------------------------------------------
 * IT IS PLACEHOLDER ART AND SAYS SO BY BEING THE LICENSING PANEL
 * ---------------------------------------------------------------------------
 * GDD §7.2 says to cut cut-in art entirely from the early prototypes, and §11
 * records the working assumption this run applies. Nothing here is drawn for
 * the cut-in: the picture is the Tier 3 panel `src/licensing/renderPanels.ts`
 * already produces, read through §7.3's surface witness. A licensed portrait
 * later is a row in `partners.ts` and this file does not change.
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
 * NOT VERIFIED AS FEELING LIKE AN INTERRUPT, AND THE PIXELS ARE NOT IN THE REPO.
 * This used to say it "has now been photographed — `.gauntlet/shots/cutin/`",
 * which was true only on a machine that had just taken the photographs:
 * `.gauntlet/shots/` is gitignored, so that directory does not exist in a fresh
 * checkout or after a clean, and a reader who went looking for the evidence
 * found nothing. What is true is that the INSTRUMENT is in the repo. Run
 *
 *     npx expo start --web        # then, against whatever port it prints
 *     node tools/capture-cutin.mjs --url http://localhost:8081
 *
 * and `.gauntlet/shots/cutin/` is written: a `?cutin=nonsense` baseline, one
 * frozen frame per firing moment, the live auto-dismiss and corner-tap frames,
 * the two played `?meet=` paths, and `frames.json`. That run also measures what
 * a source scan cannot — the four corners hit-tested with `elementFromPoint`,
 * whether the overlay is above the screen it interrupts, and how many pixels
 * survive `SCRIM_OPACITY` — and exits non-zero if any of it is wrong.
 *
 * Whether it READS as an interrupt is still a playtest judgement (GDD §12.1):
 * no critic can judge a beat it cannot feel, and a screenshot is not a feeling.
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
