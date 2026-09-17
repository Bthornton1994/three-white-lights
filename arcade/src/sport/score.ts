/**
 * Arcade card numbers from freeze judging / totals / DOTS / e1RM.
 * Skill-point chrome uses FEEL constants; the make/miss and kg total do not.
 */
import { evaluateDots, hasDotsScore, officialTotalKg, type DotsSex } from "../game/dots.ts";
import { epleyE1rm } from "../game/e1rm.ts";
import { perceivedRpe, type SessionFeel, type LiftMoment } from "../game/fatigue.ts";
import type { LiftResolution, TimingGrade as FreezeGrade } from "../game/lift.ts";
import { FEEL, type LiftId } from "../feel.ts";
import type { ArcadeMeet, AttemptOutcome, JudgeColor, ScoreBreakdown, TimingGrade } from "../math/types.ts";
import { consecutiveMakes } from "../math/attempts.ts";

export const SOURCE_COMMIT = "288db32c06232bb0fb65ce7236a0614c698a6920";

function dotsSex(sex: "M" | "F"): DotsSex {
  return sex === "F" ? "female" : "male";
}

export function mapTimingGrade(grade: FreezeGrade): TimingGrade {
  if (grade === "perfect") return "great";
  if (grade === "missed") return "miss";
  if (grade === "good" || grade === "early" || grade === "late") return grade;
  return "miss";
}

export function impliedRpeFromResolution(
  resolution: LiftResolution,
  loadRatio: number,
  feel: SessionFeel,
  moment: LiftMoment,
): number {
  let prescribed: 6 | 6.5 | 7 | 7.5 | 8 | 8.5 | 9 | 9.5 | 10 = 8;
  if (resolution.outcome === "miss") prescribed = 10;
  else if (resolution.outcome === "grind") prescribed = 9.5;
  else if (loadRatio >= 0.97) prescribed = 9;
  else if (loadRatio >= 0.92) prescribed = 8.5;
  else if (loadRatio >= 0.85) prescribed = 8;
  else prescribed = 7.5;
  return perceivedRpe(prescribed, feel, moment);
}

export function skillPointsForOutcome(made: boolean, outcome: LiftResolution["outcome"], lights: readonly JudgeColor[]): number {
  if (!made) return FEEL.SCORE_MISS;
  let points = FEEL.SCORE_MAKE;
  if (outcome === "grind") points += FEEL.SCORE_GOOD;
  else points += FEEL.SCORE_GREAT;
  if (lights.every((c) => c === "white")) points += FEEL.SCORE_THREE_WHITE;
  return points;
}

export function scoreBreakdownFromSport(
  outcomes: AttemptOutcome[],
  bestKg: number,
  consecutive: number,
  sessionStreak: number,
  bombed: boolean,
): ScoreBreakdown {
  if (bombed) {
    return { weight: 0, execution: 0, streak: 0, total: FEEL.SCORE_BOMB };
  }
  const weight = Math.round(bestKg * FEEL.SCORE_BEST_WEIGHT);
  let execution = 0;
  for (const outcome of outcomes) {
    execution += outcome.skillPoints;
  }
  const streak = consecutive * FEEL.SCORE_STREAK_MAKE + sessionStreak * FEEL.SCORE_STREAK_SESSION;
  return {
    weight,
    execution,
    streak,
    total: weight + execution + streak,
  };
}

export function sportMeetCard(
  lift: LiftId,
  e1rmKg: number,
  attemptsKg: [number, number, number],
  outcomes: AttemptOutcome[],
  hiddenFatigue: number,
  sessionStreak: number,
): ArcadeMeet {
  const madeWeights = outcomes.filter((o) => o.made).map((o) => o.weightKg);
  const bestKg = madeWeights.length === 0 ? 0 : Math.max(...madeWeights);
  const bombed = outcomes.length === 3 && bestKg === 0;
  const totalKg = bestKg;
  const dotsOutcome = evaluateDots(
    dotsSex(FEEL.SEX),
    FEEL.BODYWEIGHT_KG,
    totalKg > 0 ? officialTotalKg(totalKg) : null,
  );
  const dots = hasDotsScore(dotsOutcome) ? dotsOutcome.score : 0;
  const e1rmFromBestKg = bestKg > 0 ? epleyE1rm(bestKg, 1) : 0;
  const consecutive = consecutiveMakes(outcomes.map((o) => o.made));
  const persistedStreak = bombed ? 0 : sessionStreak;
  const breakdown = scoreBreakdownFromSport(outcomes, bestKg, consecutive, persistedStreak, bombed);
  return {
    lift,
    e1rmKg,
    attemptsKg,
    outcomes,
    hiddenFatigue,
    bombed,
    bestKg,
    totalKg,
    dots,
    e1rmFromBestKg,
    consecutiveMakes: consecutive,
    sessionStreak: persistedStreak,
    breakdown,
    score: breakdown.total,
  };
}
