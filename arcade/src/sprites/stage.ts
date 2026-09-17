import type { LiftId } from "../feel";
import type { PixelBuffer } from "./canvas";
import { clear, fillCircle, fillRect, hline } from "./canvas";
import { ARCADE_PALETTE } from "./palette";

export function drawVenue(buf: PixelBuffer, lift: LiftId): void {
  clear(buf, ARCADE_PALETTE.void);
  fillRect(buf, 0, 0, buf.w, 54, ARCADE_PALETTE.crowd);
  fillRect(buf, 0, 54, buf.w, 8, ARCADE_PALETTE.ink);
  fillRect(buf, 0, 62, buf.w, buf.h - 62, ARCADE_PALETTE.floor);
  hline(buf, 18, 96, 124, ARCADE_PALETTE.floorLine);
  fillRect(buf, 22, 88, 116, 10, ARCADE_PALETTE.charcoal);
  fillRect(buf, 24, 89, 112, 8, ARCADE_PALETTE.iron);

  if (lift === "squat") {
    fillRect(buf, 28, 40, 6, 50, ARCADE_PALETTE.rack);
    fillRect(buf, 126, 40, 6, 50, ARCADE_PALETTE.rack);
    fillRect(buf, 24, 52, 14, 3, ARCADE_PALETTE.steel);
    fillRect(buf, 122, 52, 14, 3, ARCADE_PALETTE.steel);
  }
  if (lift === "bench") {
    fillRect(buf, 58, 78, 44, 6, ARCADE_PALETTE.benchPad);
    fillRect(buf, 62, 72, 36, 8, ARCADE_PALETTE.ember);
    fillRect(buf, 68, 84, 6, 10, ARCADE_PALETTE.iron);
    fillRect(buf, 86, 84, 6, 10, ARCADE_PALETTE.iron);
    fillRect(buf, 48, 36, 6, 42, ARCADE_PALETTE.rack);
    fillRect(buf, 106, 36, 6, 42, ARCADE_PALETTE.rack);
  }
  if (lift === "deadlift") {
    fillRect(buf, 40, 94, 80, 3, ARCADE_PALETTE.floorLine);
  }

  fillRect(buf, 64, 6, 32, 14, ARCADE_PALETTE.lightHousing);
}

export function drawLights(
  buf: PixelBuffer,
  colors: readonly ("white" | "red" | "off")[],
): void {
  const cx = [70, 80, 90];
  for (let i = 0; i < 3; i += 1) {
    const state = colors[i] ?? "off";
    const color =
      state === "white"
        ? ARCADE_PALETTE.lightWhite
        : state === "red"
          ? ARCADE_PALETTE.lightRed
          : ARCADE_PALETTE.lightOff;
    fillCircle(buf, cx[i] ?? 80, 13, 4, color);
    fillRect(buf, (cx[i] ?? 80) - 3, 8, 6, 2, ARCADE_PALETTE.iron);
  }
}

export function drawChalk(buf: PixelBuffer, x: number, y: number, amount: number): void {
  for (let i = 0; i < amount; i += 1) {
    fillRect(buf, x + (i % 5) * 2, y + ((i * 3) % 7), 1, 1, ARCADE_PALETTE.chalkCloud);
  }
}
