import { FEEL, type LiftId } from "../feel";
import { windowMs } from "../math/fatigue";
import type { TimingCue, TimingGrade } from "../math/types";

export function cuesForLift(lift: LiftId, fatigue: number): TimingCue[] {
  if (lift === "squat") {
    return [
      {
        id: "depth",
        label: "DEPTH",
        center: 0.42,
        windowMs: windowMs(FEEL.WINDOW_MS.squatDepth, fatigue),
      },
      {
        id: "drive",
        label: "DRIVE",
        center: 0.78,
        windowMs: windowMs(FEEL.WINDOW_MS.squatDrive, fatigue),
      },
    ];
  }
  if (lift === "bench") {
    return [
      {
        id: "pause",
        label: "PAUSE",
        center: 0.4,
        windowMs: windowMs(FEEL.WINDOW_MS.benchPause, fatigue),
      },
      {
        id: "press",
        label: "PRESS",
        center: 0.76,
        windowMs: windowMs(FEEL.WINDOW_MS.benchPress, fatigue),
      },
    ];
  }
  return [
    {
      id: "pull",
      label: "PULL",
      center: 0.28,
      windowMs: windowMs(FEEL.WINDOW_MS.deadliftPull, fatigue),
    },
    {
      id: "lock",
      label: "LOCKOUT",
      center: 0.8,
      windowMs: windowMs(FEEL.WINDOW_MS.deadliftLock, fatigue),
    },
  ];
}

export function sequenceDurationMs(lift: LiftId): number {
  if (lift === "squat") {
    return FEEL.TIMING_MS.squatDescend + FEEL.TIMING_MS.squatHole + FEEL.TIMING_MS.squatDrive;
  }
  if (lift === "bench") {
    return FEEL.TIMING_MS.benchLower + FEEL.TIMING_MS.benchPause + FEEL.TIMING_MS.benchPress;
  }
  return (
    FEEL.TIMING_MS.deadliftStart +
    FEEL.TIMING_MS.deadliftPull +
    FEEL.TIMING_MS.deadliftLock
  );
}

export function gradeTap(
  elapsedMs: number,
  durationMs: number,
  cue: TimingCue,
): TimingGrade {
  const progress = durationMs <= 0 ? 1 : elapsedMs / durationMs;
  const error = progress - cue.center;
  const halfWindow = cue.windowMs / durationMs / 2;
  const abs = Math.abs(error);
  if (abs <= halfWindow * FEEL.GREAT_HALF_WINDOW) {
    return "great";
  }
  if (abs <= halfWindow * FEEL.GOOD_HALF_WINDOW) {
    return "good";
  }
  if (abs <= halfWindow) {
    return error < 0 ? "early" : "late";
  }
  return "miss";
}

export function missedCue(): TimingGrade {
  return "miss";
}

/** Visible amber band as a fraction of the lane, matching the graded window. */
export function laneWindowPercent(
  cue: TimingCue,
  durationMs: number,
): { leftPct: number; widthPct: number } {
  const width = durationMs <= 0 ? 0 : cue.windowMs / durationMs;
  return {
    leftPct: (cue.center - width / 2) * 100,
    widthPct: width * 100,
  };
}
