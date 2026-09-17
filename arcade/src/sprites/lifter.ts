import type { LiftId } from "../feel";
import type { PixelBuffer } from "./canvas";
import { fillRect } from "./canvas";
import { head, rect, shade, shoe } from "./draw";
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

function torso(buf: PixelBuffer, x: number, y: number, w: number, h: number): void {
  shade(buf, x, y, w, h, ARCADE_PALETTE.singlet, ARCADE_PALETTE.singlet, ARCADE_PALETTE.singletShade);
  fillRect(buf, x + 3, y + 7, w - 6, 3, ARCADE_PALETTE.belt);
  fillRect(buf, x + 3, y + 7, w - 6, 1, ARCADE_PALETTE.amberDeep);
}

export function drawSquat(
  buf: PixelBuffer,
  progress: number,
  weightKg: number,
  pose: SpritePose,
  heavy: boolean,
): void {
  const depth =
    pose === "miss"
      ? 0.9
      : pose === "hole"
        ? 1
        : pose === "descend"
          ? lerp(0, 1, Math.min(1, progress / 0.5))
          : pose === "drive"
            ? lerp(1, 0.15, progress)
            : pose === "success"
              ? 0
              : 0.12;
  const hipY = lerp(60, 80, depth);
  const knee = lerp(0, 8, depth);
  const lean = (heavy ? 5 : 1) + (depth > 0.7 && heavy ? 3 : 0);
  const barY = hipY - (heavy ? 18 : 21);

  torso(buf, 71 + lean, hipY - 20, 18, 22);
  head(buf, 75 + lean, hipY - 29, heavy || pose === "hole");
  shade(
    buf,
    68 + lean - knee,
    hipY + 1,
    7,
    17,
    ARCADE_PALETTE.skin,
    ARCADE_PALETTE.skin,
    ARCADE_PALETTE.skinShade,
  );
  shade(
    buf,
    85 + lean + knee,
    hipY + 1,
    7,
    17,
    ARCADE_PALETTE.skin,
    ARCADE_PALETTE.skin,
    ARCADE_PALETTE.skinShade,
  );
  fillRect(buf, 68 + lean - knee, hipY + 8, 7, 3, ARCADE_PALETTE.chalk);
  fillRect(buf, 85 + lean + knee, hipY + 8, 7, 3, ARCADE_PALETTE.chalk);
  shoe(buf, 66 + lean - knee, hipY + 16);
  shoe(buf, 85 + lean + knee, hipY + 16);
  shade(buf, 62 + lean, hipY - 14, 9, 6, ARCADE_PALETTE.skin, ARCADE_PALETTE.skin, ARCADE_PALETTE.skinShade);
  shade(buf, 89 + lean, hipY - 14, 9, 6, ARCADE_PALETTE.skin, ARCADE_PALETTE.skin, ARCADE_PALETTE.skinShade);

  if (pose === "miss") {
    drawBar(buf, 98, 88, weightKg);
    drawChalk(buf, 58, 86, 14);
  } else {
    drawBar(buf, 80 + lean, barY, weightKg);
  }
  if (pose === "success") {
    fillRect(buf, 72 + lean, hipY - 32, 16, 2, ARCADE_PALETTE.amber);
  }
  if (heavy) {
    drawChalk(buf, 64 + lean, hipY + 6, 12);
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
        ? lerp(1, 0.1, progress)
        : pose === "miss"
          ? 0.85
          : 0.2;
  const barY = lerp(46, 64, press);
  const arch = heavy ? 3 : 1;

  shade(buf, 60, 74, 40, 8, ARCADE_PALETTE.skin, ARCADE_PALETTE.skin, ARCADE_PALETTE.skinShade);
  shade(
    buf,
    68,
    66 - arch,
    24,
    10,
    ARCADE_PALETTE.singlet,
    ARCADE_PALETTE.singlet,
    ARCADE_PALETTE.singletShade,
  );
  head(buf, 70, 58 - arch, heavy || pose === "hole");
  shade(buf, 54, 68, 12, 5, ARCADE_PALETTE.skin, ARCADE_PALETTE.skin, ARCADE_PALETTE.skinShade);
  shade(buf, 94, 68, 12, 5, ARCADE_PALETTE.skin, ARCADE_PALETTE.skin, ARCADE_PALETTE.skinShade);
  shade(buf, 58, 78, 8, 12, ARCADE_PALETTE.skin, ARCADE_PALETTE.skin, ARCADE_PALETTE.skinShade);
  shade(buf, 94, 78, 8, 12, ARCADE_PALETTE.skin, ARCADE_PALETTE.skin, ARCADE_PALETTE.skinShade);
  shoe(buf, 56, 88);
  shoe(buf, 94, 88);

  if (pose === "miss") {
    drawBar(buf, 80, 72, weightKg);
    drawChalk(buf, 56, 60, 12);
  } else {
    drawBar(buf, 80, barY, weightKg);
  }
  if (pose === "hole") {
    fillRect(buf, 74, 62, 12, 2, ARCADE_PALETTE.amber);
  }
  if (pose === "success") {
    fillRect(buf, 70, 42, 20, 2, ARCADE_PALETTE.amber);
  }
  if (heavy) {
    drawChalk(buf, 62, 58, 8);
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
    pose === "descend" || pose === "hole" || pose === "miss"
      ? pose === "miss"
        ? 0.08
        : 0.05
      : pose === "drive"
        ? lerp(0.15, 0.85, progress)
        : pose === "lock" || pose === "success"
          ? 1
          : 0.1;
  const hipY = lerp(82, 58, lock);
  const barY = lerp(90, 56, lock);
  const lean = lerp(12, 0, lock) + (heavy && lock < 0.85 ? 4 : 0);

  torso(buf, 71, hipY - 18, 18, 20);
  head(buf, 76 - Math.floor(lean / 3), hipY - 27, heavy || lock < 0.5);
  shade(buf, 69, hipY + 1, 7, 15, ARCADE_PALETTE.skin, ARCADE_PALETTE.skin, ARCADE_PALETTE.skinShade);
  shade(buf, 84, hipY + 1, 7, 15, ARCADE_PALETTE.skin, ARCADE_PALETTE.skin, ARCADE_PALETTE.skinShade);
  fillRect(buf, 69, hipY + 7, 7, 3, ARCADE_PALETTE.chalk);
  fillRect(buf, 84, hipY + 7, 7, 3, ARCADE_PALETTE.chalk);
  shoe(buf, 67, hipY + 14);
  shoe(buf, 84, hipY + 14);
  shade(buf, 64, hipY - 6, 9, 6, ARCADE_PALETTE.skin, ARCADE_PALETTE.skin, ARCADE_PALETTE.skinShade);
  shade(buf, 87, hipY - 6, 9, 6, ARCADE_PALETTE.skin, ARCADE_PALETTE.skin, ARCADE_PALETTE.skinShade);

  if (pose === "miss") {
    drawBar(buf, 80, 92, weightKg);
    drawChalk(buf, 66, 86, 14);
  } else {
    drawBar(buf, 80, barY, weightKg);
  }
  if (lock > 0.92 || pose === "success") {
    fillRect(buf, 74, hipY - 22, 12, 2, ARCADE_PALETTE.amber);
  }
  if (heavy) {
    drawChalk(buf, 72, barY + 3, 10);
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

export { rect };
