import { FEEL } from "../feel";
import { dotsScore } from "./dots";
import { epleyE1rm } from "./e1rm";
import { impliedRpeFromPercent, clampRpe } from "./rpe";
import { bestSuccessfulKg } from "./attempts";
import { nextFatigue, fatigueCue } from "./fatigue";
import type { ArcadeMeet, AttemptOutcome, TimingGrade } from "./types";
import type { LiftId } from "../feel";

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
  const sloppy = grades.filter((g) => g !== "great").length;
  if (sloppy === 0) {
    return ["white", "white", "white"];
  }
  if (sloppy === 1) {
    return ["white", "white", "red"];
  }
  return ["white", "red", "red"];
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

export function scoreMeet(
  lift: LiftId,
  e1rmKg: number,
  attemptsKg: [number, number, number],
  outcomes: AttemptOutcome[],
  hiddenFatigue: number,
): ArcadeMeet {
  const madeWeights = outcomes.filter((o) => o.made).map((o) => o.weightKg);
  const bestKg = bestSuccessfulKg(madeWeights);
  const bombed = outcomes.length === 3 && bestKg === 0;
  const totalKg = bestKg;
  const dots = dotsScore(totalKg, FEEL.BODYWEIGHT_KG, FEEL.SEX);
  const e1rmFromBestKg = epleyE1rm(bestKg, 1);
  let score = bestKg * FEEL.SCORE_BEST_WEIGHT;
  for (const outcome of outcomes) {
    score += outcome.skillPoints;
    if (outcome.lights.every((c) => c === "white")) {
      score += FEEL.SCORE_THREE_WHITE;
    }
  }
  if (bombed) {
    score = FEEL.SCORE_BOMB;
  }
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
    score: Math.round(score),
  };
}

export function applyFatigue(
  current: number,
  outcome: AttemptOutcome,
): number {
  return nextFatigue(current, outcome.impliedRpe, outcome.made, outcome.grades);
}
