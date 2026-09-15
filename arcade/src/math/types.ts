import type { LiftId } from "../feel.ts";

export type AttemptIndex = 1 | 2 | 3;

export type TimingGrade = "great" | "good" | "late" | "early" | "miss";

export type JudgeColor = "white" | "red" | "off";

export type AttemptOutcome = {
  attempt: AttemptIndex;
  weightKg: number;
  made: boolean;
  lights: [JudgeColor, JudgeColor, JudgeColor];
  grades: TimingGrade[];
  impliedRpe: number;
  cue: string;
  skillPoints: number;
};

export type ScoreBreakdown = {
  weight: number;
  execution: number;
  streak: number;
  total: number;
};

export type ArcadeMeet = {
  lift: LiftId;
  e1rmKg: number;
  attemptsKg: [number, number, number];
  outcomes: AttemptOutcome[];
  hiddenFatigue: number;
  bombed: boolean;
  bestKg: number;
  totalKg: number;
  dots: number;
  e1rmFromBestKg: number;
  consecutiveMakes: number;
  sessionStreak: number;
  breakdown: ScoreBreakdown;
  score: number;
};

export type TimingCue = {
  id: string;
  label: string;
  /** Progress 0..1 when the window is centered. */
  center: number;
  windowMs: number;
};
