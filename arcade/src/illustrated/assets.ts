import type { LiftId } from "../feel.ts";

/**
 * Direct-use map onto existing Fable PR #71 stills.
 * Paths are runtime URLs served from unmodified copies of the concept files.
 * Do not point these at templates/, palette swatches, or PR #72 sprites.
 */

export const FABLE_REF_DIR = "art-direction/concept-fable-20260916/reference-ai";
export const ILLUSTRATED_PUBLIC_DIR = "/illustrated/fable-20260916";

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
  bench: {
    file: "AI-REF-02-BENCH-THREE-QUARTER.png",
    src: `${ILLUSTRATED_PUBLIC_DIR}/AI-REF-02-BENCH-THREE-QUARTER.png`,
    repoPath: `${FABLE_REF_DIR}/AI-REF-02-BENCH-THREE-QUARTER.png`,
    sha256: "0e4410b6dc472bd423bdb551cce7497978c062fb55e9148896c7bf8fabe923b7",
    width: 1024,
    height: 1058,
    limited: true,
    limitedReason: "Single bench still; not a dedicated select card or timing sequence.",
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

export const TITLE_STILL = FABLE_STILLS.title;
export const RESULTS_BACKDROP = FABLE_STILLS.title;
export const RESULTS_SHEET_ART = FABLE_STILLS.modelSheet;

export const LIFT_STILLS: Record<LiftId, IllustratedStill> = {
  squat: FABLE_STILLS.squat,
  bench: FABLE_STILLS.bench,
  deadlift: FABLE_STILLS.deadlift,
};

/** Designated Independent QA timing capture. Deadlift has the only setup→finish sequence. */
export const TIMING_PROOF_LIFT: LiftId = "deadlift";

export const FABLE_STILL_LIST: readonly IllustratedStill[] = [
  FABLE_STILLS.modelSheet,
  FABLE_STILLS.bench,
  FABLE_STILLS.deadlift,
  FABLE_STILLS.squat,
  FABLE_STILLS.title,
];
