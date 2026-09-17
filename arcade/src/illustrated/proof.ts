import { FEEL, type LiftId } from "../feel.ts";
import type { SportState } from "../sport/machine.ts";
import { chooseLift, startPlay, startWalkout } from "../sport/machine.ts";
import { sportMeetCard, mapTimingGrade, skillPointsForOutcome } from "../sport/score.ts";
import { runLift, type LiftConfig, type ScriptedInput } from "../game/lift.ts";
import { benchScript, deadliftScript, squatScript } from "../sport/scripts.ts";
import { judgeAttempt, attemptSeedFor } from "../game/meetDay.ts";
import type { ArcadeMeet, AttemptOutcome, JudgeColor } from "../math/types.ts";
import { TIMING_PROOF_LIFT } from "./assets.ts";

export type ProofScreen = "title" | "lift" | "timing" | "play" | "results";

export type ProofQuery = {
  screen: ProofScreen | null;
  freeze: boolean;
  lift: LiftId | null;
};

function parseLift(raw: string | null): LiftId | null {
  if (raw === "squat" || raw === "bench" || raw === "deadlift") {
    return raw;
  }
  return null;
}

export function readProofQuery(search: string = ""): ProofQuery {
  const rawSearch =
    search || (typeof window === "undefined" ? "" : window.location.search);
  const params = new URLSearchParams(rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch);
  const raw = params.get("proof");
  const screen: ProofScreen | null =
    raw === "title" || raw === "lift" || raw === "timing" || raw === "play" || raw === "results"
      ? raw
      : null;
  const freezeFlag = params.get("freeze");
  const freeze =
    freezeFlag === "0" || freezeFlag === "false"
      ? false
      : screen !== null && screen !== "play" && screen !== "timing";
  return { screen, freeze, lift: parseLift(params.get("lift")) };
}

function scriptFor(config: LiftConfig): ScriptedInput[] {
  if (config.kind === "squat") return squatScript(config, "ideal");
  if (config.kind === "bench") return benchScript(config, "mash");
  return deadliftScript(config, "held");
}

/** Display fixture for ?proof=results. Three A0-scripted makes, judged by freeze. */
export function sampleScoredMeet(): ArcadeMeet {
  const lift = TIMING_PROOF_LIFT;
  const e1rmKg = FEEL.DEFAULT_E1RM_KG[lift];
  const seed = 4;
  const outcomes: AttemptOutcome[] = ([1, 2, 3] as const).map((attempt) => {
    const weightKg = Math.round((e1rmKg * (0.9 + (attempt - 1) * 0.035)) / 2.5) * 2.5;
    const config: LiftConfig = { kind: lift, loadRatio: weightKg / e1rmKg, seed: seed + attempt };
    const played = runLift(config, scriptFor(config), 1200);
    const resolution = played.final.resolution!;
    const call = judgeAttempt(resolution, attemptSeedFor(seed, lift, attempt));
    const lights = call.lights as [JudgeColor, JudgeColor, JudgeColor];
    return {
      attempt,
      weightKg,
      made: call.good,
      lights,
      grades: resolution.timings.map((t) => mapTimingGrade(t.grade)),
      impliedRpe: resolution.outcome === "grind" ? 9.5 : 8.5,
      cue: resolution.headline,
      skillPoints: skillPointsForOutcome(call.good, resolution.outcome, lights),
    };
  });
  const attemptsKg: [number, number, number] = [
    outcomes[0]?.weightKg ?? 25,
    outcomes[1]?.weightKg ?? 25,
    outcomes[2]?.weightKg ?? 25,
  ];
  return sportMeetCard(lift, e1rmKg, attemptsKg, outcomes, 0, 1);
}

export function applyProofToState(state: SportState, search?: string): SportState {
  const proof = readProofQuery(search);
  if (proof.screen === "lift") {
    return { ...state, screen: "lift" };
  }
  if (proof.screen === "timing" || proof.screen === "play") {
    const lift = proof.lift ?? TIMING_PROOF_LIFT;
    return startPlay(startWalkout(chooseLift({ ...state }, lift)));
  }
  if (proof.screen === "results") {
    const meet = sampleScoredMeet();
    return {
      ...state,
      screen: "results",
      lift: meet.lift,
      e1rmKg: meet.e1rmKg,
      attemptsKg: meet.attemptsKg,
      outcomes: meet.outcomes,
      meet,
    };
  }
  return state;
}
