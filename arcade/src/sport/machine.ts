/**
 * Arcade meet loop driven by A0 freeze createLift / stepLift / meet / judging.
 * Visual chrome lives elsewhere. This file does not retune lift.ts.
 */
import {
  ATTEMPT_JUMP_FRACTION,
  DEFAULT_MEET_RULES,
  MIN_ATTEMPT_INCREMENT_KG,
  isDeclarableWeight,
  roundToCallableWeightIgnoringTheCard,
  suggestOpener,
  type LiftKind,
} from "../game/meet.ts";
import {
  EMPTY_FATIGUE_STATE,
  NEUTRAL_CHECK_IN,
  sessionFeel,
  type LiftMoment,
  type SessionFeel,
} from "../game/fatigue.ts";
import {
  createLift,
  promptFor,
  stepLift,
  type LiftInput,
  type LiftState,
} from "../game/lift.ts";
import { liftPresentation, PRESENTATION_TICK_MS, type LiftPresentationState } from "../game/liftPresentation.ts";
import { attemptSeedFor, judgeAttempt, walkoutMs, deliberationMs, type JudgingCall } from "../game/meetDay.ts";
import { SESSION_TUNING } from "../game/sessionTuning.ts";
import { FEEL, type LiftId } from "../feel.ts";
import type { ArcadeMeet, AttemptOutcome, JudgeColor } from "../math/types.ts";
import { nextSessionStreak, readSessionStreak, writeSessionStreak } from "../math/streak.ts";
import {
  impliedRpeFromResolution,
  mapTimingGrade,
  skillPointsForOutcome,
  SOURCE_COMMIT,
  sportMeetCard,
} from "./score.ts";

export { PRESENTATION_TICK_MS, SOURCE_COMMIT };

export type Screen =
  | "title"
  | "lift"
  | "attempts"
  | "walkout"
  | "play"
  | "judging"
  | "success"
  | "failure"
  | "transition"
  | "bomb"
  | "results";

export type SportState = {
  screen: Screen;
  lift: LiftId | null;
  e1rmKg: number;
  attemptsKg: [number, number, number];
  currentAttempt: 1 | 2 | 3;
  outcomes: AttemptOutcome[];
  lastOutcome: AttemptOutcome | null;
  meet: ArcadeMeet | null;
  sessionStreak: number;
  meetSeed: number;
  feel: SessionFeel;
  moment: LiftMoment;
  liftState: LiftState | null;
  priorLiftState: LiftState | null;
  presentation: LiftPresentationState | null;
  pendingInputs: LiftInput[];
  judging: JudgingCall | null;
  prompt: string;
  /** Presentation clock for walkout / verdict beats. Not the sim clock. */
  presentMs: number;
  /** Accumulator leftover, ms, for the 60 Hz integrator. */
  tickCarryMs: number;
  hiddenFatigue: number;
};

const DAY = 20300;

function startingE1rm(lift: LiftId): number {
  return SESSION_TUNING.STARTING_E1RM.kilograms[lift];
}

function ordinaryFeel(): SessionFeel {
  return sessionFeel(EMPTY_FATIGUE_STATE, DAY, NEUTRAL_CHECK_IN);
}

export function suggestedSportAttempts(lift: LiftId, e1rmKg: number): [number, number, number] {
  const openerRes = suggestOpener(lift, e1rmKg, DEFAULT_MEET_RULES);
  const opener = openerRes.ok ? openerRes.value : 25;
  const jump = ATTEMPT_JUMP_FRACTION[lift].standard;
  const second = roundToCallableWeightIgnoringTheCard(
    opener * (1 + jump),
    lift,
    DEFAULT_MEET_RULES,
    "up",
  );
  const third = roundToCallableWeightIgnoringTheCard(
    second * (1 + jump),
    lift,
    DEFAULT_MEET_RULES,
    "up",
  );
  return sanitizeSportAttempts(lift, [opener, second, third]);
}

export function sanitizeSportAttempts(
  lift: LiftKind,
  raw: [number, number, number],
): [number, number, number] {
  const floor = roundToCallableWeightIgnoringTheCard(25, lift, DEFAULT_MEET_RULES, "up");
  let prev = floor;
  const out: [number, number, number] = [floor, floor, floor];
  for (let i = 0; i < 3; i += 1) {
    const rounded = roundToCallableWeightIgnoringTheCard(
      raw[i] ?? prev,
      lift,
      DEFAULT_MEET_RULES,
      "nearest",
    );
    const kg = Math.max(prev, rounded);
    const legal = isDeclarableWeight(kg, DEFAULT_MEET_RULES)
      ? kg
      : roundToCallableWeightIgnoringTheCard(kg, lift, DEFAULT_MEET_RULES, "up");
    out[i] = Math.max(prev, legal);
    prev = out[i];
  }
  return out;
}

export function nudgeSportAttempt(
  lift: LiftId,
  attempts: [number, number, number],
  index: 0 | 1 | 2,
  direction: 1 | -1,
): [number, number, number] {
  const trial: [number, number, number] = [...attempts];
  trial[index] = (trial[index] ?? 25) + direction * MIN_ATTEMPT_INCREMENT_KG;
  return sanitizeSportAttempts(lift, trial);
}

export function initialState(storage: Pick<Storage, "getItem"> | null = null): SportState {
  const sessionStreak = readSessionStreak(storage);
  return {
    screen: "title",
    lift: null,
    e1rmKg: startingE1rm("squat"),
    attemptsKg: suggestedSportAttempts("squat", startingE1rm("squat")),
    currentAttempt: 1,
    outcomes: [],
    lastOutcome: null,
    meet: null,
    sessionStreak,
    meetSeed: FREEZE_MEET_SEED + sessionStreak * 1009,
    feel: ordinaryFeel(),
    moment: { workSetsCompleted: 0, repsCompletedInSet: 0 },
    liftState: null,
    priorLiftState: null,
    presentation: null,
    pendingInputs: [],
    judging: null,
    prompt: "",
    presentMs: 0,
    tickCarryMs: 0,
    hiddenFatigue: 0,
  };
}

const FREEZE_MEET_SEED = 4;

export function chooseLift(state: SportState, lift: LiftId): SportState {
  const e1rmKg = startingE1rm(lift);
  return {
    ...state,
    screen: "attempts",
    lift,
    e1rmKg,
    attemptsKg: suggestedSportAttempts(lift, e1rmKg),
    currentAttempt: 1,
    outcomes: [],
    lastOutcome: null,
    meet: null,
    feel: ordinaryFeel(),
    moment: { workSetsCompleted: 0, repsCompletedInSet: 0 },
    liftState: null,
    priorLiftState: null,
    presentation: null,
    pendingInputs: [],
    judging: null,
    prompt: "",
    presentMs: 0,
    tickCarryMs: 0,
    hiddenFatigue: 0,
  };
}

export function setAttempts(state: SportState, attemptsKg: [number, number, number]): SportState {
  if (!state.lift) return state;
  return { ...state, attemptsKg: sanitizeSportAttempts(state.lift, attemptsKg) };
}

function previousBestKg(state: SportState): number | null {
  const made = state.outcomes.filter((o) => o.made).map((o) => o.weightKg);
  return made.length === 0 ? null : Math.max(...made);
}

export function walkoutDurationMs(state: SportState): number {
  if (!state.lift) return FEEL.TIMING_MS.walkout;
  const weight = state.attemptsKg[state.currentAttempt - 1] ?? 25;
  const remaining = 3 - state.outcomes.length;
  const bombRisk = remaining <= 1 && state.outcomes.every((o) => !o.made);
  return walkoutMs(state.currentAttempt, weight, previousBestKg(state), bombRisk);
}

export function judgingDurationMs(state: SportState): number {
  const call = state.judging;
  if (!call) return FEEL.TIMING_MS.judging;
  return deliberationMs(call.deliberated, {
    attemptNumber: state.currentAttempt,
    isPrAttempt: previousBestKg(state) !== null && (state.lastOutcome?.weightKg ?? 0) > (previousBestKg(state) ?? 0),
    bombRisk:
      state.currentAttempt === 3 &&
      state.outcomes.every((o) => !o.made) &&
      state.lastOutcome !== null &&
      !state.lastOutcome.made,
  });
}

export function startWalkout(state: SportState): SportState {
  if (!state.lift) return state;
  return {
    ...state,
    screen: "walkout",
    liftState: null,
    priorLiftState: null,
    presentation: null,
    pendingInputs: [],
    judging: null,
    prompt: "",
    presentMs: 0,
    tickCarryMs: 0,
  };
}

export function startPlay(state: SportState): SportState {
  if (!state.lift) return state;
  const weightKg = state.attemptsKg[state.currentAttempt - 1] ?? 25;
  const loadRatio = weightKg / state.e1rmKg;
  const moment: LiftMoment = {
    workSetsCompleted: state.currentAttempt - 1,
    repsCompletedInSet: 0,
  };
  const seed = attemptSeedFor(state.meetSeed, state.lift, state.currentAttempt);
  const feel = state.feel;
  const liftState = createLift({
    kind: state.lift,
    loadRatio,
    seed,
    feel,
    moment,
  });
  const presentation = liftPresentation(liftState, weightKg, null);
  return {
    ...state,
    screen: "play",
    moment,
    liftState,
    priorLiftState: null,
    presentation,
    pendingInputs: [],
    judging: null,
    prompt: promptFor(liftState),
    presentMs: 0,
    tickCarryMs: 0,
  };
}

export function queueInput(state: SportState, kind: LiftInput["kind"]): SportState {
  if (state.screen !== "play" || !state.liftState) return state;
  return { ...state, pendingInputs: [...state.pendingInputs, { kind }] };
}

export function stepPlay(state: SportState, dtMs: number): SportState {
  if (state.screen !== "play" || !state.liftState || !state.lift) return state;
  let liftState = state.liftState;
  let prior = state.priorLiftState;
  let pending = [...state.pendingInputs];
  let carry = state.tickCarryMs + Math.max(0, Math.min(100, dtMs));
  const weightKg = state.attemptsKg[state.currentAttempt - 1] ?? 25;
  let presentation = state.presentation;
  while (carry >= PRESENTATION_TICK_MS && liftState.phase !== "RESOLVED") {
    const input = pending.shift() ?? null;
    prior = liftState;
    liftState = stepLift(liftState, input);
    presentation = liftPresentation(liftState, weightKg, prior);
    carry -= PRESENTATION_TICK_MS;
  }
  if (liftState.phase === "RESOLVED" && liftState.resolution) {
    return resolvePlay(
      {
        ...state,
        liftState,
        priorLiftState: prior,
        presentation,
        pendingInputs: [],
        prompt: promptFor(liftState),
        tickCarryMs: 0,
      },
      liftState,
    );
  }
  return {
    ...state,
    liftState,
    priorLiftState: prior,
    presentation,
    pendingInputs: pending,
    prompt: promptFor(liftState),
    tickCarryMs: carry,
    presentMs: state.presentMs + dtMs,
  };
}

function resolvePlay(state: SportState, liftState: LiftState): SportState {
  if (!state.lift || !liftState.resolution) return state;
  const weightKg = state.attemptsKg[state.currentAttempt - 1] ?? 25;
  const seed = attemptSeedFor(state.meetSeed, state.lift, state.currentAttempt);
  const call = judgeAttempt(liftState.resolution, seed);
  const lights = call.lights as [JudgeColor, JudgeColor, JudgeColor];
  const grades = liftState.resolution.timings.map((timing) => mapTimingGrade(timing.grade));
  const rpe = impliedRpeFromResolution(
    liftState.resolution,
    liftState.config.loadRatio,
    state.feel,
    state.moment,
  );
  const cue =
    liftState.resolution.detail !== ""
      ? `${liftState.resolution.headline} — ${liftState.resolution.detail}`
      : liftState.resolution.headline;
  const outcome: AttemptOutcome = {
    attempt: state.currentAttempt,
    weightKg,
    made: call.good,
    lights,
    grades,
    impliedRpe: rpe,
    cue,
    skillPoints: skillPointsForOutcome(call.good, liftState.resolution.outcome, lights),
  };
  return {
    ...state,
    screen: "judging",
    lastOutcome: outcome,
    judging: call,
    pendingInputs: [],
    prompt: liftState.resolution.headline,
    presentMs: 0,
    tickCarryMs: 0,
  };
}

export function afterJudging(state: SportState): SportState {
  const outcome = state.lastOutcome;
  if (!outcome) return state;
  return {
    ...state,
    screen: outcome.made ? "success" : "failure",
  };
}

export function continueAfterOutcome(state: SportState): SportState {
  if (state.screen !== "success" && state.screen !== "failure") return state;
  const outcome = state.lastOutcome;
  if (!outcome || !state.lift) return state;
  if (state.outcomes[state.outcomes.length - 1] === outcome) return state;
  const outcomes = [...state.outcomes, outcome];
  const finished = outcomes.length >= 3;
  const bombed = finished && outcomes.every((o) => !o.made);
  if (!finished) {
    return {
      ...state,
      screen: "transition",
      outcomes,
      currentAttempt: (state.currentAttempt + 1) as 1 | 2 | 3,
      lastOutcome: outcome,
      liftState: null,
      priorLiftState: null,
      presentation: null,
      pendingInputs: [],
      judging: null,
      prompt: "",
      presentMs: 0,
      tickCarryMs: 0,
    };
  }
  const persisted = nextSessionStreak(
    state.sessionStreak,
    bombed,
    outcomes.some((o) => o.made),
  );
  const meet = sportMeetCard(
    state.lift,
    state.e1rmKg,
    state.attemptsKg,
    outcomes,
    state.hiddenFatigue,
    persisted,
  );
  return {
    ...state,
    screen: bombed ? "bomb" : "results",
    outcomes,
    meet,
    sessionStreak: persisted,
    liftState: null,
    priorLiftState: null,
    presentation: null,
    pendingInputs: [],
    presentMs: 0,
    tickCarryMs: 0,
  };
}

export function persistFinishedMeet(
  state: SportState,
  storage: Pick<Storage, "setItem"> | null = null,
): void {
  if (state.screen !== "results" && state.screen !== "bomb") return;
  writeSessionStreak(storage, state.sessionStreak);
}

export function openResults(state: SportState): SportState {
  if (!state.lift) return state;
  const meet =
    state.meet ??
    sportMeetCard(
      state.lift,
      state.e1rmKg,
      state.attemptsKg,
      state.outcomes,
      state.hiddenFatigue,
      state.sessionStreak,
    );
  return { ...state, screen: "results", meet };
}

export function resetToTitle(storage: Pick<Storage, "getItem"> | null = null): SportState {
  return initialState(storage);
}

export function backToLiftSelect(storage: Pick<Storage, "getItem"> | null = null): SportState {
  return { ...initialState(storage), screen: "lift" };
}

export function currentWeightKg(state: SportState): number {
  return state.attemptsKg[state.currentAttempt - 1] ?? 25;
}

export function stageLights(state: SportState): [JudgeColor, JudgeColor, JudgeColor] {
  if (state.screen === "walkout" || state.screen === "play" || state.screen === "transition") {
    return ["off", "off", "off"];
  }
  return state.lastOutcome?.lights ?? ["off", "off", "off"];
}

export { promptFor };
