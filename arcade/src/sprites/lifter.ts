import type { LiftId } from "../feel";
import type { PixelBuffer } from "./canvas";
import { fillRect } from "./canvas";
import { ARCADE_PALETTE } from "./palette";
import { drawBar } from "./plates";
import { drawChalk } from "./stage";

export type SpritePose =
  | "idle"
  | "walkout"
  | "descend"
  | "hole"
  | "drive"
  | "lock"
  | "miss"
  | "success";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function drawHead(buf: PixelBuffer, x: number, y: number): void {
  fillRect(buf, x, y, 8, 8, ARCADE_PALETTE.skin);
  fillRect(buf, x + 1, y - 2, 6, 3, ARCADE_PALETTE.hair);
  fillRect(buf, x + 5, y + 3, 2, 1, ARCADE_PALETTE.ink);
}

function drawTorso(buf: PixelBuffer, x: number, y: number, w: number, h: number): void {
  fillRect(buf, x, y, w, h, ARCADE_PALETTE.singlet);
  fillRect(buf, x, y + h - 3, w, 3, ARCADE_PALETTE.singletShade);
  fillRect(buf, x + 2, y + 6, w - 4, 3, ARCADE_PALETTE.belt);
}

export function drawSquat(
  buf: PixelBuffer,
  progress: number,
  weightKg: number,
  pose: SpritePose,
  heavy: boolean,
): void {
  const depth =
    pose === "hole" ? 1 : pose === "descend" ? lerp(0, 1, progress) : pose === "drive" ? lerp(1, 0, progress) : 0;
  const hipY = lerp(62, 78, depth);
  const kneeSpread = lerp(0, 6, depth);
  const barY = hipY - (heavy ? 20 : 22);
  const lean = heavy && depth > 0.6 ? 3 : 0;

  drawTorso(buf, 72 + lean, hipY - 18, 16, 20);
  drawHead(buf, 76 + lean, hipY - 26);
  fillRect(buf, 70 + lean - kneeSpread, hipY + 2, 6, 16, ARCADE_PALETTE.skin);
  fillRect(buf, 84 + lean + kneeSpread, hipY + 2, 6, 16, ARCADE_PALETTE.skin);
  fillRect(buf, 68 + lean - kneeSpread, hipY + 16, 8, 4, ARCADE_PALETTE.chalk);
  fillRect(buf, 84 + lean + kneeSpread, hipY + 16, 8, 4, ARCADE_PALETTE.chalk);
  fillRect(buf, 64 + lean, hipY - 12, 8, 5, ARCADE_PALETTE.skinShade);
  fillRect(buf, 88 + lean, hipY - 12, 8, 5, ARCADE_PALETTE.skinShade);
  drawBar(buf, 80 + lean, barY, weightKg);
  if (heavy) {
    drawChalk(buf, 70, hipY + 8, 8);
  }
}

export function drawBench(
  buf: PixelBuffer,
  progress: number,
  weightKg: number,
  pose: SpritePose,
  heavy: boolean,
): void {
  const press =
    pose === "descend" || pose === "hole"
      ? lerp(0, 1, pose === "hole" ? 1 : progress)
      : pose === "drive"
        ? lerp(1, 0, progress)
        : 0;
  const barY = lerp(48, 62, press);
  const arch = heavy ? 2 : 0;

  fillRect(buf, 62, 74, 36, 8, ARCADE_PALETTE.skin);
  fillRect(buf, 70, 68 - arch, 20, 8, ARCADE_PALETTE.singlet);
  fillRect(buf, 72, 64 - arch, 8, 6, ARCADE_PALETTE.skin);
  fillRect(buf, 70, 62 - arch, 8, 4, ARCADE_PALETTE.hair);
  fillRect(buf, 58, 70, 10, 4, ARCADE_PALETTE.skinShade);
  fillRect(buf, 92, 70, 10, 4, ARCADE_PALETTE.skinShade);
  fillRect(buf, 60, 78, 8, 10, ARCADE_PALETTE.skin);
  fillRect(buf, 92, 78, 8, 10, ARCADE_PALETTE.skin);
  drawBar(buf, 80, barY, weightKg);
  if (pose === "hole") {
    fillRect(buf, 76, 64, 8, 2, ARCADE_PALETTE.amber);
  }
  if (heavy) {
    drawChalk(buf, 64, 60, 6);
  }
}

export function drawDeadlift(
  buf: PixelBuffer,
  progress: number,
  weightKg: number,
  pose: SpritePose,
  heavy: boolean,
): void {
  const lock =
    pose === "descend" || pose === "hole"
      ? 0
      : pose === "drive"
        ? lerp(0.15, 0.85, progress)
        : pose === "lock" || pose === "success"
          ? 1
          : 0.05;
  const hipY = lerp(80, 60, lock);
  const barY = lerp(90, 58, lock);
  const lean = lerp(10, 0, lock) + (heavy && lock < 0.8 ? 2 : 0);

  drawTorso(buf, 72, hipY - 16, 16, 18);
  drawHead(buf, 78 - Math.floor(lean / 3), hipY - 24);
  fillRect(buf, 70, hipY + 2, 6, 14, ARCADE_PALETTE.skin);
  fillRect(buf, 84, hipY + 2, 6, 14, ARCADE_PALETTE.skin);
  fillRect(buf, 68, hipY + 14, 8, 4, ARCADE_PALETTE.chalk);
  fillRect(buf, 84, hipY + 14, 8, 4, ARCADE_PALETTE.chalk);
  fillRect(buf, 66, hipY - 4, 8, 5, ARCADE_PALETTE.skinShade);
  fillRect(buf, 86, hipY - 4, 8, 5, ARCADE_PALETTE.skinShade);
  drawBar(buf, 80, barY, weightKg);
  if (lock > 0.9) {
    fillRect(buf, 76, hipY - 18, 8, 2, ARCADE_PALETTE.amber);
  }
  if (heavy) {
    drawChalk(buf, 74, barY + 4, 7);
  }
}

export function poseFromProgress(lift: LiftId, progress: number, screen: string): SpritePose {
  if (screen === "walkout" || screen === "transition") {
    return "walkout";
  }
  if (screen === "success") {
    return "success";
  }
  if (screen === "failure" || screen === "bomb") {
    return "miss";
  }
  if (screen !== "timing" && screen !== "judging") {
    return "idle";
  }
  if (lift === "squat") {
    if (progress < 0.42) {
      return "descend";
    }
    if (progress < 0.58) {
      return "hole";
    }
    return "drive";
  }
  if (lift === "bench") {
    if (progress < 0.4) {
      return "descend";
    }
    if (progress < 0.55) {
      return "hole";
    }
    return "drive";
  }
  if (progress < 0.2) {
    return "hole";
  }
  if (progress < 0.8) {
    return "drive";
  }
  return "lock";
}

export function drawLifter(
  buf: PixelBuffer,
  lift: LiftId,
  progress: number,
  weightKg: number,
  pose: SpritePose,
  e1rmKg: number,
): void {
  const heavy = weightKg / e1rmKg >= 0.95;
  if (lift === "squat") {
    drawSquat(buf, progress, weightKg, pose, heavy);
    return;
  }
  if (lift === "bench") {
    drawBench(buf, progress, weightKg, pose, heavy);
    return;
  }
  drawDeadlift(buf, progress, weightKg, pose, heavy);
}
