/**
 * LicensedPanelView.tsx — the only file in `src/licensing/` that imports React.
 *
 * Everything above it is pure: `renderPanels.ts` produces palette indices,
 * `sheetGridToRgba` turns those into bytes, and this file is the thin layer that
 * hands the bytes to Skia. Same shape as `ResultCardView.tsx` and
 * `LifterSpriteView.tsx`, deliberately — a third rendering idiom in the same app
 * is how three pieces start to look like three products.
 *
 * NEAREST NEIGHBOUR ONLY. GDD §7.1 requires it. Two things enforce it here:
 * `sampling` is pinned to `FilterMode.Nearest` with mipmaps off, and `scale` is
 * a whole number chosen to fit rather than a ratio. A fractional scale makes
 * some source pixels two device pixels wide and some three, and that shimmer is
 * the fastest way to make pixel art look like a photograph of pixel art.
 *
 * NOT VERIFIED ON A DEVICE. It type-checks against the installed
 * @shopify/react-native-skia types and follows the same documented raw-pixel
 * path the result card already uses, and it has been photographed in the Expo
 * WEB build by `tools/shoot.mjs`. Nothing in this run has run it on a phone.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { LIFT_PALETTE } from '../lift/liftPalette';
import { LICENSING_COPY, LICENSING_SCREEN } from './licensingTuning';
import { renderLicensingPanel, scaleToFit, type LicensingPanelId } from './renderPanels';
import type { LicensingCatalogue } from './catalogue';

/** Build an SkImage for a licensing sheet. Cheap enough to run on change. */
export function makeLicensingImage(
  catalogue: LicensingCatalogue,
  panel: LicensingPanelId,
): { image: SkImage | null; w: number; h: number } {
  const grid = renderLicensingPanel(catalogue, panel);
  const bytes = sheetGridToRgba(grid);
  const data = Skia.Data.fromBytes(bytes);
  const image = Skia.Image.MakeImage(
    {
      width: grid.w,
      height: grid.h,
      // The grid has no partial alpha at all, so there is nothing to
      // premultiply; Unpremul keeps the bytes byte-identical to the encoder's.
      alphaType: AlphaType.Unpremul,
      colorType: ColorType.RGBA_8888,
    },
    data,
    grid.w * RGBA.BYTES_PER_PIXEL,
  );
  return { image, w: grid.w, h: grid.h };
}

export interface LicensedPanelViewProps {
  readonly catalogue: LicensingCatalogue;
  readonly panel: LicensingPanelId;
  /** Available width in logical points. The sheet picks its own whole scale. */
  readonly availableWidth: number;
}

export function LicensedPanelView({
  catalogue,
  panel,
  availableWidth,
}: LicensedPanelViewProps): React.ReactElement {
  const { image, w, h } = useMemo(() => makeLicensingImage(catalogue, panel), [catalogue, panel]);
  const scale = scaleToFit(w, availableWidth);
  // The testID is on the wrapping View, not on the Canvas: Skia's web Canvas
  // does not forward it to a `data-testid` attribute, and `tools/shoot.mjs`
  // waits on that selector to know the sheet actually mounted. Without it the
  // harness warns and captures whatever happens to be on screen — which is how
  // a blank render gets photographed and filed as evidence.
  return (
    <View style={{ width: w * scale, height: h * scale }} testID="licensing-panel">
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
  );
}

export interface LicensingScreenProps {
  readonly catalogue: LicensingCatalogue;
  readonly panel: LicensingPanelId;
  /** Viewport width in points. The harness passes the capture width. */
  readonly viewportWidth: number;
}

/**
 * The screen chrome around the sheet: a title, a one-line explanation, and the
 * sheet.
 *
 * The explanation is not decoration. GDD §8.1 says a sponsored item is
 * "cosmetic and flavor-only, mechanically identical to the fictional item it
 * reskins" — and a promise a player cannot read is a promise only the tests
 * know about.
 */
export function LicensingScreen({
  catalogue,
  panel,
  viewportWidth,
}: LicensingScreenProps): React.ReactElement {
  const shop = panel === 'shop';
  return (
    <View style={styles.root} testID="licensing-screen">
      <Text style={styles.title}>
        {shop ? LICENSING_COPY.SHOP_TITLE : LICENSING_COPY.SELECT_TITLE}
      </Text>
      <Text style={styles.subtitle}>
        {shop ? LICENSING_COPY.SHOP_SUBTITLE : LICENSING_COPY.SELECT_SUBTITLE}
      </Text>
      <View style={styles.sheet}>
        <LicensedPanelView
          catalogue={catalogue}
          panel={panel}
          availableWidth={viewportWidth - LICENSING_SCREEN.PAD * 2}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: LIFT_PALETTE.BACKDROP,
    padding: LICENSING_SCREEN.PAD,
  },
  title: {
    color: LIFT_PALETTE.TEXT,
    fontSize: LICENSING_SCREEN.TITLE_SIZE,
    fontWeight: '700',
    letterSpacing: LICENSING_SCREEN.TITLE_TRACKING,
  },
  subtitle: {
    color: LIFT_PALETTE.TEXT_DIM,
    fontSize: LICENSING_SCREEN.SUBTITLE_SIZE,
    textAlign: 'center',
  },
  sheet: {
    marginTop: LICENSING_SCREEN.TITLE_GAP,
  },
});
