import { FEEL, type LiftId } from "../feel.ts";
import type { ArcadeState } from "../loop/machine.ts";
import { sequenceDurationMs } from "../loop/timing.ts";
import { suggestedAttempts } from "../math/attempts.ts";
import { resolveAttempt, scoreMeet } from "../math/score.ts";
import type { ArcadeMeet } from "../math/types.ts";
import { TIMING_PROOF_LIFT } from "./assets.ts";

export type ProofScreen = "title" | "lift" | "timing" | "results";

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
    raw === "title" || raw === "lift" || raw === "timing" || raw === "results" ? raw : null;
  const freezeFlag = params.get("freeze");
  const freeze =
    freezeFlag === "0" || freezeFlag === "false" ? false : screen !== null;
  return { screen, freeze, lift: parseLift(params.get("lift")) };
}

/** Display fixture for ?proof=results. Uses real resolveAttempt + scoreMeet. */
export function sampleScoredMeet(): ArcadeMeet {
  const lift = TIMING_PROOF_LIFT;
  const e1rmKg = FEEL.DEFAULT_E1RM_KG[lift];
  const attemptsKg = suggestedAttempts(e1rmKg);
  const outcomes = ([1, 2, 3] as const).map((attempt, i) =>
    resolveAttempt({
      attempt,
      weightKg: attemptsKg[i] ?? FEEL.MIN_ATTEMPT_KG,
      e1rmKg,
      grades: ["great", "great"],
      fatigue: 0,
    }),
  );
  return scoreMeet(lift, e1rmKg, attemptsKg, outcomes, 0, 1);
}

export function applyProofToState(state: ArcadeState, search?: string): ArcadeState {
  const proof = readProofQuery(search);
  if (proof.screen === "lift") {
    return { ...state, screen: "lift" };
  }
  if (proof.screen === "timing") {
    const lift = proof.lift ?? TIMING_PROOF_LIFT;
    const e1rmKg = FEEL.DEFAULT_E1RM_KG[lift];
    return {
      ...state,
      screen: "timing",
      lift,
      e1rmKg,
      attemptsKg: suggestedAttempts(e1rmKg),
      currentAttempt: 1,
      timingElapsedMs: Math.round(sequenceDurationMs(lift) * 0.28),
    };
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
