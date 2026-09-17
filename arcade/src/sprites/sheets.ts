import type { LiftId } from "../feel.ts";
import type { Screen } from "../loop/machine.ts";

export type LiftSheet = {
  src: string;
  frames: string[];
  frameCount: number;
  cols: number;
  rows: number;
  fallbackLift: LiftId;
};

export const LIFT_SHEETS: Record<LiftId, LiftSheet> = {
  squat: {
    src: "/sprites/squat/sheet-transparent.png",
    frames: [
      "/sprites/squat/frame-01.png",
      "/sprites/squat/frame-02.png",
      "/sprites/squat/frame-03.png",
      "/sprites/squat/frame-04.png",
      "/sprites/squat/frame-05.png",
      "/sprites/squat/frame-06.png",
    ],
    frameCount: 6,
    cols: 3,
    rows: 2,
    fallbackLift: "squat",
  },
  bench: {
    src: "/sprites/bench/sheet-transparent.png",
    frames: [
      "/sprites/bench/frame-01.png",
      "/sprites/bench/frame-02.png",
      "/sprites/bench/frame-03.png",
      "/sprites/bench/frame-04.png",
      "/sprites/bench/frame-05.png",
      "/sprites/bench/frame-06.png",
    ],
    frameCount: 6,
    cols: 3,
    rows: 2,
    fallbackLift: "bench",
  },
  deadlift: {
    src: "/sprites/deadlift/sheet-transparent.png",
    frames: [
      "/sprites/deadlift/frame-01.png",
      "/sprites/deadlift/frame-02.png",
      "/sprites/deadlift/frame-03.png",
      "/sprites/deadlift/frame-04.png",
      "/sprites/deadlift/frame-05.png",
      "/sprites/deadlift/frame-06.png",
    ],
    frameCount: 6,
    cols: 3,
    rows: 2,
    fallbackLift: "deadlift",
  },
};

export const IDLE_FRAMES = [
  "/sprites/idle/frame-01.png",
  "/sprites/idle/frame-02.png",
  "/sprites/idle/frame-03.png",
  "/sprites/idle/frame-04.png",
] as const;

export const SUCCESS_FRAMES = [
  "/sprites/success/frame-01.png",
  "/sprites/success/frame-02.png",
  "/sprites/success/frame-03.png",
  "/sprites/success/frame-04.png",
] as const;

export const MISS_FRAMES = [
  "/sprites/miss/frame-01.png",
  "/sprites/miss/frame-02.png",
  "/sprites/miss/frame-03.png",
  "/sprites/miss/frame-04.png",
] as const;

export const LIFT_SHEETS_MAX: Record<LiftId, LiftSheet> = {
  squat: {
    src: "/sprites/squat-max/sheet-transparent.png",
    frames: [
      "/sprites/squat-max/frame-01.png",
      "/sprites/squat-max/frame-02.png",
      "/sprites/squat-max/frame-03.png",
      "/sprites/squat-max/frame-04.png",
      "/sprites/squat-max/frame-05.png",
      "/sprites/squat-max/frame-06.png",
    ],
    frameCount: 6,
    cols: 3,
    rows: 2,
    fallbackLift: "squat",
  },
  bench: {
    src: "/sprites/bench-max/sheet-transparent.png",
    frames: [
      "/sprites/bench-max/frame-01.png",
      "/sprites/bench-max/frame-02.png",
      "/sprites/bench-max/frame-03.png",
      "/sprites/bench-max/frame-04.png",
      "/sprites/bench-max/frame-05.png",
      "/sprites/bench-max/frame-06.png",
    ],
    frameCount: 6,
    cols: 3,
    rows: 2,
    fallbackLift: "bench",
  },
  deadlift: {
    src: "/sprites/deadlift-max/sheet-transparent.png",
    frames: [
      "/sprites/deadlift-max/frame-01.png",
      "/sprites/deadlift-max/frame-02.png",
      "/sprites/deadlift-max/frame-03.png",
      "/sprites/deadlift-max/frame-04.png",
      "/sprites/deadlift-max/frame-05.png",
      "/sprites/deadlift-max/frame-06.png",
    ],
    frameCount: 6,
    cols: 3,
    rows: 2,
    fallbackLift: "deadlift",
  },
};

export const SCENE = {
  title: "/sprites/title.png",
  titleWide: "/sprites/title-wide.png",
  platform: "/sprites/platform.png",
  identity: "/sprites/identity.png",
} as const;

/** Lift-select card art. Presentation only — not a gameplay input. */
export const LIFT_CARD: Record<LiftId, { light: string; max: string; pose: string }> = {
  squat: {
    light: "/sprites/cards/squat-light.png",
    max: "/sprites/cards/squat-max.png",
    pose: "Depth",
  },
  bench: {
    light: "/sprites/cards/bench-light.png",
    max: "/sprites/cards/bench-max.png",
    pose: "Pause",
  },
  deadlift: {
    light: "/sprites/cards/deadlift-light.png",
    max: "/sprites/cards/deadlift-max.png",
    pose: "Lockout",
  },
};


/** Visual-only load split. Not a judging or timing threshold. */
export const VISUAL = {
  MAX_LOAD_RATIO: 0.96,
} as const;

export type VisualEffort = "light" | "max";

export function visualEffort(weightKg: number, e1rmKg: number): VisualEffort {
  if (e1rmKg <= 0) {
    return "light";
  }
  return weightKg / e1rmKg >= VISUAL.MAX_LOAD_RATIO ? "max" : "light";
}

export type SpritePose =
  | "idle"
  | "walkout"
  | "descend"
  | "hole"
  | "drive"
  | "pause"
  | "press"
  | "pull"
  | "lock"
  | "success"
  | "miss";

export function poseForScreen(screen: Screen, lift: LiftId, progress: number): SpritePose {
  if (screen === "success") return "success";
  if (screen === "failure" || screen === "bomb") return "miss";
  if (screen === "walkout" || screen === "transition" || screen === "lift" || screen === "attempts") {
    return "walkout";
  }
  if (screen !== "timing" && screen !== "judging") {
    return "idle";
  }
  if (lift === "squat") {
    if (screen === "judging") return "lock";
    if (progress < 0.22) return "idle";
    if (progress < 0.42) return "descend";
    if (progress < 0.58) return "hole";
    if (progress < 0.92) return "drive";
    return "lock";
  }
  if (lift === "bench") {
    if (progress < 0.4) return "descend";
    if (progress < 0.55) return "pause";
    return "press";
  }
  if (progress < 0.2) return "pull";
  if (progress < 0.8) return "drive";
  return "lock";
}

/**
 * Squat sheet index. Holds frame-03 (below-parallel hole) through the DEPTH cue.
 * Walkout stays standing. Judging holds lockout. Bench/deadlift do not use this.
 */
export function squatSheetIndex(screen: Screen, progress: number): number {
  if (screen === "walkout" || screen === "transition" || screen === "attempts" || screen === "lift") {
    return 0;
  }
  if (screen === "judging") return 5;
  if (screen !== "timing") {
    return Math.min(5, Math.floor(Math.min(1, Math.max(0, progress)) * 6));
  }
  if (progress < 0.22) return 0;
  if (progress < 0.42) return 1;
  if (progress < 0.58) return 2;
  if (progress < 0.72) return 3;
  if (progress < 0.9) return 4;
  return 5;
}

export type SquatDepthPhase = "stand" | "descent" | "hole" | "ascent" | "lock";

export function squatDepthPhase(screen: Screen, progress: number): SquatDepthPhase {
  if (screen === "judging" || screen === "success") return "lock";
  if (screen !== "timing") return "stand";
  if (progress < 0.22) return "stand";
  if (progress < 0.42) return "descent";
  if (progress < 0.58) return "hole";
  if (progress < 0.92) return "ascent";
  return "lock";
}

/** 0 = standing, 1 = legal below-parallel hole. Presentation only. */
export function squatDepth01(screen: Screen, progress: number): number {
  const phase = squatDepthPhase(screen, progress);
  if (phase === "stand" || phase === "lock") return 0;
  if (phase === "hole") return 1;
  if (phase === "descent") {
    return Math.min(1, Math.max(0, (progress - 0.22) / 0.2));
  }
  return Math.min(1, Math.max(0, 1 - (progress - 0.58) / 0.34));
}

export function frameSrcFor(
  lift: LiftId,
  screen: Screen,
  progress: number,
  clockMs: number,
  effort: VisualEffort = "light",
): string {
  if (screen === "title" || screen === "lift") {
    const idle = IDLE_FRAMES[Math.floor(clockMs / 280) % IDLE_FRAMES.length];
    return idle ?? IDLE_FRAMES[0];
  }
  if (screen === "success") {
    if (clockMs > 0) {
      const i = Math.floor(clockMs / 180) % SUCCESS_FRAMES.length;
      return SUCCESS_FRAMES[i] ?? SUCCESS_FRAMES[0];
    }
    const i = Math.min(SUCCESS_FRAMES.length - 1, Math.floor(progress * SUCCESS_FRAMES.length));
    return SUCCESS_FRAMES[i] ?? SUCCESS_FRAMES[0];
  }
  if (screen === "failure" || screen === "bomb") {
    const i = Math.min(MISS_FRAMES.length - 1, Math.floor(Math.max(progress, 0.5) * MISS_FRAMES.length));
    return MISS_FRAMES[i] ?? MISS_FRAMES[0];
  }
  const sheet = effort === "max" ? LIFT_SHEETS_MAX[lift] : LIFT_SHEETS[lift];
  const idx =
    lift === "squat"
      ? squatSheetIndex(screen, progress)
      : Math.min(sheet.frameCount - 1, Math.floor(Math.min(1, Math.max(0, progress)) * sheet.frameCount));
  return sheet.frames[idx] ?? sheet.frames[0];
}

/**
 * Visual-only walkout mapping onto early lift-sheet frames.
 * Caps below lockout. Does not change judging, timing windows, or feel.ts.
 */
export function walkoutProgress(elapsedMs: number, durationMs: number): number {
  const duration = Math.max(1, durationMs);
  return Math.min(0.49, (Math.max(0, elapsedMs) / duration) * 0.49);
}
