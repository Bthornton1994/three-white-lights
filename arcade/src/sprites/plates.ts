import type { PixelBuffer } from "./canvas";
import { fillCircle, fillRect } from "./canvas";
import { ARCADE_PALETTE, plateColor } from "./palette";

/** Standard IPF denominations, largest first. */
const DENOMS = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export function platesForLoad(weightKg: number): number[] {
  let remain = Math.max(0, (weightKg - 20) / 2);
  const out: number[] = [];
  for (const denom of DENOMS) {
    while (remain + 1e-6 >= denom) {
      out.push(denom);
      remain -= denom;
    }
  }
  return out;
}

export function drawSleeve(
  buf: PixelBuffer,
  collarX: number,
  barY: number,
  plates: readonly number[],
  toward: 1 | -1,
): void {
  let x = collarX;
  for (const kg of plates) {
    const radius = kg >= 20 ? 16 : kg >= 10 ? 13 : kg >= 5 ? 10 : 7;
    const thickness = kg >= 20 ? 4 : 3;
    const color = plateColor(kg);
    fillRect(buf, toward === 1 ? x : x - thickness, barY - radius, thickness, radius * 2, color);
    fillRect(
      buf,
      toward === 1 ? x : x - thickness,
      barY - radius,
      thickness,
      2,
      ARCADE_PALETTE.chalk,
    );
    x += toward * (thickness + 1);
  }
  fillCircle(buf, x + toward * 2, barY, 2, ARCADE_PALETTE.steel);
}

export function drawBar(
  buf: PixelBuffer,
  cx: number,
  barY: number,
  weightKg: number,
): void {
  const plates = platesForLoad(weightKg);
  fillRect(buf, cx - 36, barY - 1, 72, 3, ARCADE_PALETTE.bar);
  fillRect(buf, cx - 36, barY - 1, 72, 1, ARCADE_PALETTE.chalk);
  drawSleeve(buf, cx - 38, barY, plates, -1);
  drawSleeve(buf, cx + 38, barY, plates, 1);
}
