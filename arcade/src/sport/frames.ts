/**
 * Visual translation of liftPresentation into the existing 6-frame sheets.
 * Does not invent physics. Does not retune lift.ts.
 */
import type { LiftPresentationState } from "../game/liftPresentation.ts";
import { LIFT_TUNING } from "../game/liftTuning.ts";
import type { LiftId } from "../feel.ts";
import {
  IDLE_FRAMES,
  LIFT_SHEETS,
  LIFT_SHEETS_MAX,
  MISS_FRAMES,
  SUCCESS_FRAMES,
  type VisualEffort,
} from "../sprites/sheets.ts";
import type { Screen } from "./machine.ts";

export type SportPose =
  | "idle"
  | "walkout"
  | "brace"
  | "descend"
  | "hole"
  | "pause"
  | "drive"
  | "press"
  | "pull"
  | "lock"
  | "success"
  | "miss";

export function poseFromPresentation(view: LiftPresentationState | null, screen: Screen): SportPose {
  if (screen === "success") return "success";
  if (screen === "failure" || screen === "bomb") return "miss";
  if (screen === "walkout" || screen === "transition" || screen === "attempts") return "walkout";
  if (!view) return "idle";
  switch (view.phase) {
    case "BRACE":
      return "brace";
    case "DESCENT":
      return "descend";
    case "HOLE":
      return view.kind === "bench" ? "pause" : "hole";
    case "ASCENT":
      if (view.kind === "bench") return "press";
      if (view.kind === "deadlift") return "pull";
      return "drive";
    case "LOCKOUT":
    case "RESOLVED":
      return view.outcome === "miss" ? "miss" : "lock";
    default:
      return "idle";
  }
}

export function squatDepthPhaseFromView(
  view: LiftPresentationState | null,
  screen: Screen,
): "stand" | "descent" | "hole" | "ascent" | "lock" {
  if (screen === "judging" || screen === "success") return "lock";
  if (!view || view.kind !== "squat") return "stand";
  switch (view.phase) {
    case "BRACE":
      return "stand";
    case "DESCENT":
      return "descent";
    case "HOLE":
      return "hole";
    case "ASCENT":
      return "ascent";
    default:
      return "lock";
  }
}

/** 0 = standing, 1 = authored bottom. Direct presentation.depth. */
export function squatDepthFromView(view: LiftPresentationState | null): number {
  if (!view || view.kind !== "squat") return 0;
  return Math.min(1, Math.max(0, view.depth));
}

export function sheetIndexFromPresentation(view: LiftPresentationState): number {
  const { kind, phase, depth, barHeight } = view;
  if (kind === "squat") {
    const legal = LIFT_TUNING.DEPTH_LEGAL.squat;
    if (phase === "BRACE") return 0;
    if (phase === "DESCENT") {
      if (depth < legal * 0.35) return 0;
      if (depth < legal * 0.9) return 1;
      return 2;
    }
    if (phase === "HOLE") return 2;
    if (phase === "ASCENT") {
      if (barHeight < 0.35) return 2;
      if (barHeight < 0.62) return 3;
      if (barHeight < 0.88) return 4;
      return 5;
    }
    return 5;
  }
  if (kind === "bench") {
    if (phase === "BRACE") return 0;
    if (phase === "DESCENT") {
      if (depth < 0.35) return 0;
      if (depth < 0.75) return 1;
      return 2;
    }
    if (phase === "HOLE") return 2;
    if (phase === "ASCENT") {
      if (barHeight < 0.4) return 3;
      if (barHeight < 0.75) return 4;
      return 5;
    }
    return 5;
  }
  if (phase === "BRACE") return 0;
  if (phase === "ASCENT") {
    if (barHeight < 0.22) return 0;
    if (barHeight < 0.42) return 1;
    if (barHeight < 0.62) return 2;
    if (barHeight < 0.82) return 3;
    return 4;
  }
  return 5;
}

export function frameSrcFromPresentation(
  lift: LiftId,
  screen: Screen,
  view: LiftPresentationState | null,
  clockMs: number,
  effort: VisualEffort = "light",
): string {
  if (screen === "title" || screen === "lift") {
    return IDLE_FRAMES[Math.floor(clockMs / 280) % IDLE_FRAMES.length] ?? IDLE_FRAMES[0];
  }
  if (screen === "success") {
    const i = Math.floor(Math.max(0, clockMs) / 180) % SUCCESS_FRAMES.length;
    return SUCCESS_FRAMES[i] ?? SUCCESS_FRAMES[0];
  }
  if (screen === "failure" || screen === "bomb") {
    const i = Math.min(
      MISS_FRAMES.length - 1,
      Math.floor(Math.max(0.5, Math.min(1, clockMs / 900)) * MISS_FRAMES.length),
    );
    return MISS_FRAMES[i] ?? MISS_FRAMES[0];
  }
  const sheet = effort === "max" ? LIFT_SHEETS_MAX[lift] : LIFT_SHEETS[lift];
  const idx = view ? sheetIndexFromPresentation(view) : 0;
  return sheet.frames[Math.min(sheet.frameCount - 1, Math.max(0, idx))] ?? sheet.frames[0];
}
