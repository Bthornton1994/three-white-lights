import type { LiftId } from "../feel.ts";
import type { Screen } from "../loop/machine.ts";
import type { IllustratedCamera } from "./motion.ts";
import { ILLUSTRATED_MOTION, timingCamera } from "./motion.ts";

/**
 * Direct-use map onto existing Fable PR #71 stills, plus owner-revised
 * bench stills stored outside the concept SoT folder.
 * Do not point these at templates/, palette swatches, or PR #72 sprites.
 */

export const FABLE_REF_DIR = "art-direction/concept-fable-20260916/reference-ai";
export const ILLUSTRATED_PUBLIC_DIR = "/illustrated/fable-20260916";
export const ILLUSTRATED_DIRECT_USE_DIR = "/illustrated/direct-use";
export const ILLUSTRATED_DIRECT_USE_REPO = "art-direction/illustrated-direct-use/assets";

export type IllustratedStill = {
  file: string;
  src: string;
  repoPath: string;
  sha256: string;
  width: number;
  height: number;
  limited: boolean;
  limitedReason: string | null;
};

export const FABLE_STILLS = {
  modelSheet: {
    file: "AI-REF-01-MODEL-SHEET.png",
    src: `${ILLUSTRATED_PUBLIC_DIR}/AI-REF-01-MODEL-SHEET.png`,
    repoPath: `${FABLE_REF_DIR}/AI-REF-01-MODEL-SHEET.png`,
    sha256: "b484a534dfa54764245a006bb8e9ef8ce2a78077dd25773041bd6f8f8eb59ff9",
    width: 1280,
    height: 754,
    limited: false,
    limitedReason: null,
  },
  /** PR #71 concept still. Kept for SoT hash-lock. Not loaded on bench select/timing. */
  benchOriginal: {
    file: "AI-REF-02-BENCH-THREE-QUARTER.png",
    src: `${ILLUSTRATED_PUBLIC_DIR}/AI-REF-02-BENCH-THREE-QUARTER.png`,
    repoPath: `${FABLE_REF_DIR}/AI-REF-02-BENCH-THREE-QUARTER.png`,
    sha256: "0e4410b6dc472bd423bdb551cce7497978c062fb55e9148896c7bf8fabe923b7",
    width: 1024,
    height: 1058,
    limited: true,
    limitedReason: "Superseded on bench select/timing by bench-revised-20260916.png.",
  },
  deadlift: {
    file: "AI-REF-03-DEADLIFT-SETUP-LOCKOUT-MAX.png",
    src: `${ILLUSTRATED_PUBLIC_DIR}/AI-REF-03-DEADLIFT-SETUP-LOCKOUT-MAX.png`,
    repoPath: `${FABLE_REF_DIR}/AI-REF-03-DEADLIFT-SETUP-LOCKOUT-MAX.png`,
    sha256: "b56e379f6c18b52f5a6e8da4f3bc0cd9781645477b446741ca1444ad505c16ba",
    width: 1280,
    height: 754,
    limited: true,
    limitedReason: "Setup/lockout diptych; not a dedicated select card.",
  },
  squat: {
    file: "AI-REF-04-SQUAT-HOLE-LIGHT-VS-MAX.png",
    src: `${ILLUSTRATED_PUBLIC_DIR}/AI-REF-04-SQUAT-HOLE-LIGHT-VS-MAX.png`,
    repoPath: `${FABLE_REF_DIR}/AI-REF-04-SQUAT-HOLE-LIGHT-VS-MAX.png`,
    sha256: "bc6e03a8a83e5bfc77f2b4961c4f93f00342fc32e1b8dea1dcfa0be465ebc64a",
    width: 1280,
    height: 754,
    limited: true,
    limitedReason: "Light-vs-max hole diptych; not a dedicated select card or descent sequence.",
  },
  title: {
    file: "AI-REF-05-TITLE-SCREEN.png",
    src: `${ILLUSTRATED_PUBLIC_DIR}/AI-REF-05-TITLE-SCREEN.png`,
    repoPath: `${FABLE_REF_DIR}/AI-REF-05-TITLE-SCREEN.png`,
    sha256: "1bc09ab2231eb7a91fe7289cacfea23a5ac1a1dfc94402570806b614ff299d2f",
    width: 1280,
    height: 754,
    limited: true,
    limitedReason: "No portrait or wide title master; one 1280×754 landscape still. Hallucinated PRESS START / studio line remain in the bitmap.",
  },
} as const satisfies Record<string, IllustratedStill>;

/** Owner-revised mid-press bench. Direct-use path only. Not a Fable SoT overwrite. */
export const BENCH_REVISED: IllustratedStill = {
  file: "bench-revised-20260916.png",
  src: `${ILLUSTRATED_DIRECT_USE_DIR}/bench-revised-20260916.png`,
  repoPath: `${ILLUSTRATED_DIRECT_USE_REPO}/bench-revised-20260916.png`,
  sha256: "6ded9e1d74512e42527a3e1e4d86d915d210f8326a07b331c34973c4ab99548b",
  width: 1233,
  height: 1275,
  limited: true,
  limitedReason: "Owner-revised mid-press still; not a dedicated select card or timing sequence.",
};

export const BENCH_RACKED_NOT_SELECTED: IllustratedStill = {
  file: "bench-racked-20260916.png",
  src: `${ILLUSTRATED_DIRECT_USE_DIR}/not-selected/bench-racked-20260916.png`,
  repoPath: `${ILLUSTRATED_DIRECT_USE_REPO}/not-selected/bench-racked-20260916.png`,
  sha256: "c718bca6b06d24b87c3c900d83e019618bd2b37878bcd42020bf66816cd20d65",
  width: 1234,
  height: 1275,
  limited: true,
  limitedReason: "Not selected: racked pose, mangled viewer-right hand.",
};

export const TITLE_STILL = FABLE_STILLS.title;
export const RESULTS_BACKDROP = FABLE_STILLS.title;
export const RESULTS_SHEET_ART = FABLE_STILLS.modelSheet;
export const SHARE_BACKDROP = FABLE_STILLS.title;
export const SHARE_PORTRAIT = FABLE_STILLS.modelSheet;

export const LIFT_STILLS: Record<LiftId, IllustratedStill> = {
  squat: FABLE_STILLS.squat,
  bench: BENCH_REVISED,
  deadlift: FABLE_STILLS.deadlift,
};

/** Designated Independent QA timing capture for the original four-screen proof. */
export const TIMING_PROOF_LIFT: LiftId = "deadlift";

export const FABLE_STILL_LIST: readonly IllustratedStill[] = [
  FABLE_STILLS.modelSheet,
  FABLE_STILLS.benchOriginal,
  FABLE_STILLS.deadlift,
  FABLE_STILLS.squat,
  FABLE_STILLS.title,
];

export function isLegacyBenchSrc(src: string): boolean {
  return src.includes("AI-REF-02-BENCH-THREE-QUARTER");
}

export function isLegacySpriteSrc(src: string): boolean {
  return src.startsWith("/sprites/") || src.includes("/public/sprites/");
}

/**
 * Honest still reuse for screens that have no dedicated illustration.
 * Bomb uses the title hall as chrome backdrop metadata only.
 * Animated play screens still keep a still record for provenance;
 * the athlete is driven by arcade frames, not this still.
 * Never returns a PR #70 sprite path from this function.
 */
export function stillForScreen(screen: Screen, lift: LiftId): IllustratedStill {
  if (screen === "title" || screen === "lift" || screen === "results" || screen === "bomb") {
    return TITLE_STILL;
  }
  return LIFT_STILLS[lift];
}

/** Play screens that reuse existing arcade action frames inside the illustrated shell. */
export function usesArcadeFrames(screen: Screen): boolean {
  return (
    screen === "walkout" ||
    screen === "timing" ||
    screen === "judging" ||
    screen === "success" ||
    screen === "failure" ||
    screen === "transition" ||
    screen === "bomb"
  );
}

export function captionForScreen(screen: Screen, lift: LiftId): string {
  const name = lift[0]?.toUpperCase() + lift.slice(1);
  switch (screen) {
    case "attempts":
      return `Illustrated still · ${name} — not an attempt-board scene`;
    case "walkout":
      return `Animated walkout · ${name} arcade frames`;
    case "timing":
      return `Animated lift · ${name} arcade frames`;
    case "judging":
      return `Lockout hold · ${name} arcade frames`;
    case "success":
      return `Good lift · ${name} arcade frames`;
    case "failure":
      return `No lift · ${name} arcade frames`;
    case "transition":
      return `Plate change · ${name} arcade frames`;
    case "bomb":
      return "Bomb-out · miss frames in illustrated chrome";
    case "results":
      return "Illustrated still · no dedicated results-card art";
    default:
      return "Illustrated still";
  }
}

export function chipForScreen(screen: Screen): string {
  if (usesArcadeFrames(screen)) {
    return "ANIMATED — arcade frames";
  }
  switch (screen) {
    case "timing":
      return "LIMITED — still, not frames";
    case "success":
      return "LIMITED — still · not a success sequence";
    case "failure":
    case "bomb":
      return "LIMITED — still · not a miss sequence";
    default:
      return "LIMITED — illustrated still";
  }
}

export function cameraForScreen(
  screen: Screen,
  lift: LiftId,
  progress: number,
): IllustratedCamera {
  if (screen === "bomb" || screen === "results" || screen === "lift" || screen === "title") {
    return {
      objectPosition: ILLUSTRATED_MOTION.RESULTS_BACKDROP_POSITION,
      scale: screen === "bomb" ? 1.04 : 1,
    };
  }
  if (screen === "attempts" || screen === "walkout" || screen === "transition") {
    return timingCamera(lift, 0.08);
  }
  if (screen === "failure") {
    return timingCamera(lift, 0.72);
  }
  if (screen === "judging" || screen === "success") {
    return timingCamera(lift, 1);
  }
  return timingCamera(lift, progress);
}

export function kenBurnsForScreen(screen: Screen): boolean {
  return (
    screen === "walkout" ||
    screen === "success" ||
    screen === "transition" ||
    screen === "bomb" ||
    screen === "attempts"
  );
}
