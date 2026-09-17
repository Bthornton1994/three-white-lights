import type { LiftId } from "../feel";
import type { JudgeColor } from "../math/types";
import { createBuffer } from "./canvas";
import { drawLifter, poseFromProgress, type SpritePose } from "./lifter";
import { drawLights, drawVenue } from "./stage";

export function renderArcadeFrame(input: {
  lift: LiftId;
  progress: number;
  weightKg: number;
  e1rmKg: number;
  screen: string;
  lights?: readonly (JudgeColor | "off")[];
  pose?: SpritePose;
}): ReturnType<typeof createBuffer> {
  const buf = createBuffer();
  drawVenue(buf, input.lift);
  const pose = input.pose ?? poseFromProgress(input.lift, input.progress, input.screen);
  drawLifter(buf, input.lift, input.progress, input.weightKg, pose, input.e1rmKg);
  drawLights(buf, input.lights ?? ["off", "off", "off"]);
  return buf;
}
