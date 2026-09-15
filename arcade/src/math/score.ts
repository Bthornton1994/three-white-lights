import { FEEL } from "../feel.ts";
import { dotsScore } from "./dots.ts";
import { epleyE1rm } from "./e1rm.ts";
import { impliedRpeFromPercent, clampRpe } from "./rpe.ts";
import { bestSuccessfulKg, consecutiveMakes } from "./attempts.ts";
import { nextFatigue, fatigueCue } from "./fatigue.ts";
import type { ArcadeMeet, AttemptOutcome, ScoreBreakdown, TimingGrade } from "./types.ts";
import type { LiftId } from "../feel.ts";

export function skillPointsFor(grades: readonly TimingGrade[]): number {
  let points = 0;
  for (const grade of grades) {
    if (grade === "great") {
      points += FEEL.SCORE_GREAT;
    } else if (grade === "good") {
      points += FEEL.SCORE_GOOD;
    }
  }
  return points;
}

export function lightsFor(
  made: boolean,
  grades: readonly TimingGrade[],
): [AttemptOutcome["lights"][0], AttemptOutcome["lights"][1], AttemptOutcome["lights"][2]] {
  if (!made) {
    return ["red", "red", "red"];
  }
  // In-window "good" is still a make. Two goods must keep a 2-white majority
  // so the lift is not flipped to a no-lift after the window was hit.
  // Great vs good still differs in skill points and the three-white bonus.
  if (grades.every((g) => g === "great")) {
    return ["white", "white", "white"];
  }
  return ["white", "white", "red"];
}

export function resolveAttempt(input: {
  attempt: 1 | 2 | 3;
  weightKg: number;
  e1rmKg: number;
  grades: TimingGrade[];
  fatigue: number;
}): AttemptOutcome {
  const made = input.grades.every((g) => g === "great" || g === "good");
  const pct = (input.weightKg / input.e1rmKg) * 100;
  let rpe = impliedRpeFromPercent(pct);
  if (!made) {
    rpe = clampRpe(rpe + 0.5);
  } else if (input.grades.every((g) => g === "great")) {
    rpe = clampRpe(rpe - 0.5);
  }
  const lights = lightsFor(made, input.grades);
  const whiteCount = lights.filter((c) => c === "white").length;
  const goodLift = made && whiteCount >= 2;
  return {
    attempt: input.attempt,
    weightKg: input.weightKg,
    made: goodLift,
    lights,
    grades: input.grades,
    impliedRpe: rpe,
    cue: fatigueCue(input.fatigue, goodLift),
    skillPoints: goodLift ? skillPointsFor(input.grades) + FEEL.SCORE_MAKE : FEEL.SCORE_MISS,
  };
}

export function scoreBreakdown(
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
    if (outcome.lights.every((c) => c === "white")) {
      execution += FEEL.SCORE_THREE_WHITE;
    }
  }
  const streak =
    consecutive * FEEL.SCORE_STREAK_MAKE + sessionStreak * FEEL.SCORE_STREAK_SESSION;
  return {
    weight,
    execution,
    streak,
    total: weight + execution + streak,
  };
}

export function scoreMeet(
  lift: LiftId,
  e1rmKg: number,
  attemptsKg: [number, number, number],
  outcomes: AttemptOutcome[],
  hiddenFatigue: number,
  sessionStreak: number,
): ArcadeMeet {
  const madeWeights = outcomes.filter((o) => o.made).map((o) => o.weightKg);
  const bestKg = bestSuccessfulKg(madeWeights);
  const bombed = outcomes.length === 3 && bestKg === 0;
  const totalKg = bestKg;
  const dots = dotsScore(totalKg, FEEL.BODYWEIGHT_KG, FEEL.SEX);
  const e1rmFromBestKg = epleyE1rm(bestKg, 1);
  const consecutive = consecutiveMakes(outcomes.map((o) => o.made));
  const persistedStreak = bombed ? 0 : sessionStreak;
  const breakdown = scoreBreakdown(outcomes, bestKg, consecutive, persistedStreak, bombed);
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

export function applyFatigue(
  current: number,
  outcome: AttemptOutcome,
): number {
  return nextFatigue(current, outcome.impliedRpe, outcome.made, outcome.grades);
}
