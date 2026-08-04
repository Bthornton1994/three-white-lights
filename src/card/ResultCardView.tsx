/**
 * ResultCardView.tsx — the only file in `src/card/` that imports React.
 *
 * Everything above it is pure: `renderResultCard` produces palette indices,
 * `sheetGridToRgba` turns those into bytes, and this file is the thin layer
 * that hands the bytes to Skia. Same shape as `src/art/LifterSpriteView.tsx`,
 * deliberately — a second rendering idiom in the same app is how two pieces
 * start to look like two products.
 *
 * NEAREST NEIGHBOUR ONLY. GDD §7.1 requires it. Two things enforce it here:
 * `sampling` is pinned to `FilterMode.Nearest` with mipmaps off, and `scale` is
 * rounded to a whole number before it is used. A fractional scale makes some
 * source pixels two device pixels wide and some three, and that shimmer is the
 * fastest way to make pixel art look like a photograph of pixel art. A layout
 * that needs a size between two integer scales letterboxes the smaller one.
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

import { RGBA } from '../art/palette';
import type { ResultCard } from '../game/resultCard';
import { CARD } from './cardTuning';
import { renderResultCard } from './renderResultCard';
import { sheetGridToRgba } from './sheetPalette';

/** Build an SkImage for a card. Cheap enough to run whenever the card changes. */
export function makeResultCardImage(card: ResultCard): SkImage | null {
  const grid = renderResultCard(card);
  const bytes = sheetGridToRgba(grid);
  const data = Skia.Data.fromBytes(bytes);
  return Skia.Image.MakeImage(
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
}

export interface ResultCardViewProps {
  readonly card: ResultCard;
  /** Integer upscale. Rounded and floored at 1; see the header. */
  readonly scale?: number;
}

export function ResultCardView({ card, scale = CARD.DEFAULT_UPSCALE }: ResultCardViewProps): React.ReactElement {
  const zoom = Math.max(1, Math.round(scale));
  const width = CARD.W * zoom;
  const height = CARD.H * zoom;

  const image = useMemo(() => makeResultCardImage(card), [card]);

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
