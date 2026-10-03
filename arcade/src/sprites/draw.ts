import type { PixelBuffer } from "./canvas";
import { fillRect, pset } from "./canvas";
import { ARCADE_PALETTE } from "./palette";

export function rect(
  buf: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  outline = ARCADE_PALETTE.ink,
): void {
  fillRect(buf, x, y, w, h, fill);
  fillRect(buf, x, y, w, 1, outline);
  fillRect(buf, x, y + h - 1, w, 1, outline);
  fillRect(buf, x, y, 1, h, outline);
  fillRect(buf, x + w - 1, y, 1, h, outline);
}

export function shade(
  buf: PixelBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  light: number,
  mid: number,
  dark: number,
): void {
  rect(buf, x, y, w, h, mid);
  fillRect(buf, x + 1, y + 1, Math.max(1, w - 3), 1, light);
  fillRect(buf, x + 1, y + h - 2, Math.max(1, w - 2), 1, dark);
  fillRect(buf, x + w - 2, y + 1, 1, Math.max(1, h - 2), dark);
}

export function head(buf: PixelBuffer, x: number, y: number, strain: boolean): void {
  shade(buf, x, y, 10, 9, ARCADE_PALETTE.skin, ARCADE_PALETTE.skin, ARCADE_PALETTE.skinShade);
  fillRect(buf, x + 1, y - 2, 8, 4, ARCADE_PALETTE.hair);
  fillRect(buf, x, y - 1, 2, 3, ARCADE_PALETTE.hair);
  pset(buf, x + 3, y + 3, ARCADE_PALETTE.ink);
  pset(buf, x + 6, y + 3, ARCADE_PALETTE.ink);
  fillRect(buf, x + 3, y + 6, strain ? 4 : 3, 1, ARCADE_PALETTE.skinShade);
  if (strain) {
    pset(buf, x + 2, y + 4, ARCADE_PALETTE.ember);
    pset(buf, x + 7, y + 4, ARCADE_PALETTE.ember);
  }
}

export function shoe(buf: PixelBuffer, x: number, y: number): void {
  rect(buf, x, y, 9, 4, ARCADE_PALETTE.chalk, ARCADE_PALETTE.ink);
  fillRect(buf, x + 1, y + 1, 3, 1, ARCADE_PALETTE.amber);
}
