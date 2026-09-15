import { FEEL, type LiftId } from "../feel.ts";
import { suggestedAttempts, sanitizeAttempts } from "../math/attempts.ts";
import { applyFatigue, resolveAttempt, scoreMeet } from "../math/score.ts";
import { nextSessionStreak, readSessionStreak, writeSessionStreak } from "../math/streak.ts";
import type { ArcadeMeet, AttemptOutcome, TimingGrade } from "../math/types.ts";
import { cuesForLift, gradeTap, missedCue, sequenceDurationMs } from "./timing.ts";

export type Screen =
  | "title"
  | "lift"
  | "attempts"
  | "walkout"
  | "timing"
  | "judging"
  | "success"
  | "failure"
  | "transition"
  | "bomb"
  | "results";

export type ArcadeState = {
  screen: Screen;
  lift: LiftId | null;
  e1rmKg: number;
  attemptsKg: [number, number, number];
  currentAttempt: 1 | 2 | 3;
  outcomes: AttemptOutcome[];
  hiddenFatigue: number;
  pendingGrades: TimingGrade[];
  lastOutcome: AttemptOutcome | null;
  meet: ArcadeMeet | null;
  sessionStreak: number;
};

export function initialState(storage: Pick<Storage, "getItem"> | null = null): ArcadeState {
  return {
    screen: "title",
    lift: null,
    e1rmKg: FEEL.DEFAULT_E1RM_KG.squat,
    attemptsKg: suggestedAttempts(FEEL.DEFAULT_E1RM_KG.squat),
    currentAttempt: 1,
    outcomes: [],
    hiddenFatigue: 0,
    pendingGrades: [],
    lastOutcome: null,
    meet: null,
    sessionStreak: readSessionStreak(storage),
  };
}

export function chooseLift(state: ArcadeState, lift: LiftId): ArcadeState {
  const e1rmKg = FEEL.DEFAULT_E1RM_KG[lift];
  return {
    ...state,
    screen: "attempts",
    lift,
    e1rmKg,
    attemptsKg: suggestedAttempts(e1rmKg),
    currentAttempt: 1,
    outcomes: [],
    hiddenFatigue: 0,
    pendingGrades: [],
    lastOutcome: null,
    meet: null,
  };
}

export function setAttempts(
  state: ArcadeState,
  attemptsKg: [number, number, number],
): ArcadeState {
  return { ...state, attemptsKg: sanitizeAttempts(attemptsKg) };
}

export function startWalkout(state: ArcadeState): ArcadeState {
  if (!state.lift) {
    return state;
  }
  return { ...state, screen: "walkout", pendingGrades: [] };
}

export function startTiming(state: ArcadeState): ArcadeState {
  return { ...state, screen: "timing", pendingGrades: [] };
}

export function recordTap(
  state: ArcadeState,
  cueIndex: number,
  elapsedMs: number,
): ArcadeState {
  if (!state.lift) {
    return state;
  }
  const cues = cuesForLift(state.lift, state.hiddenFatigue);
  const cue = cues[cueIndex];
  if (!cue) {
    return state;
  }
  if (state.pendingGrades[cueIndex] !== undefined) {
    return state;
  }
  const duration = sequenceDurationMs(state.lift);
  const grade = gradeTap(elapsedMs, duration, cue);
  const pending = [...state.pendingGrades];
  pending[cueIndex] = grade;
  return { ...state, pendingGrades: pending };
}

export function finishTiming(state: ArcadeState): ArcadeState {
  if (!state.lift) {
    return state;
  }
  const cues = cuesForLift(state.lift, state.hiddenFatigue);
  const grades = cues.map((_, i) => state.pendingGrades[i] ?? missedCue());
  const weightKg = state.attemptsKg[state.currentAttempt - 1] ?? FEEL.MIN_ATTEMPT_KG;
  const outcome = resolveAttempt({
    attempt: state.currentAttempt,
    weightKg,
    e1rmKg: state.e1rmKg,
    grades,
    fatigue: state.hiddenFatigue,
  });
  return {
    ...state,
    screen: "judging",
    pendingGrades: grades,
    lastOutcome: outcome,
  };
}

export function afterJudging(state: ArcadeState): ArcadeState {
  const outcome = state.lastOutcome;
  if (!outcome) {
    return state;
  }
  return {
    ...state,
    screen: outcome.made ? "success" : "failure",
  };
}

export function continueAfterOutcome(
  state: ArcadeState,
  storage: Pick<Storage, "getItem" | "setItem"> | null = null,
): ArcadeState {
  const outcome = state.lastOutcome;
  if (!outcome || !state.lift) {
    return state;
  }
  const outcomes = [...state.outcomes, outcome];
  const fatigue = applyFatigue(state.hiddenFatigue, outcome);
  const finished = outcomes.length >= 3;
  const bombed = finished && outcomes.every((o) => !o.made);

  if (!finished) {
    const nextAttempt = (state.currentAttempt + 1) as 1 | 2 | 3;
    return {
      ...state,
      screen: "transition",
      outcomes,
      hiddenFatigue: fatigue,
      currentAttempt: nextAttempt,
      lastOutcome: outcome,
    };
  }

  const incoming = readSessionStreak(storage);
  const persisted = nextSessionStreak(
    incoming,
    bombed,
    outcomes.some((o) => o.made),
  );
  writeSessionStreak(storage, persisted);
  const meet = scoreMeet(
    state.lift,
    state.e1rmKg,
    state.attemptsKg,
    outcomes,
    fatigue,
    persisted,
  );
  return {
    ...state,
    screen: bombed ? "bomb" : "results",
    outcomes,
    hiddenFatigue: fatigue,
    meet,
    sessionStreak: persisted,
  };
}

export function openResults(state: ArcadeState): ArcadeState {
  if (!state.lift) {
    return state;
  }
  const meet =
    state.meet ??
    scoreMeet(
      state.lift,
      state.e1rmKg,
      state.attemptsKg,
      state.outcomes,
      state.hiddenFatigue,
      state.sessionStreak,
    );
  return { ...state, screen: "results", meet };
}

export function resetToTitle(storage: Pick<Storage, "getItem"> | null = null): ArcadeState {
  return initialState(storage);
}

export function backToLiftSelect(
  storage: Pick<Storage, "getItem"> | null = null,
): ArcadeState {
  return { ...initialState(storage), screen: "lift" };
}
