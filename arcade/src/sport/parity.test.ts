import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createLift,
  runLift,
  stepLift,
  type LiftConfig,
  type LiftPhase,
  type LiftState,
} from "../game/lift.ts";
import { liftPresentation } from "../game/liftPresentation.ts";
import { judgeAttempt, attemptSeedFor } from "../game/meetDay.ts";
import { isGoodLift } from "../game/meet.ts";
import { applyProofToState, readProofQuery, sampleScoredMeet } from "../illustrated/proof.ts";
import { benchScript, deadliftScript, FREEZE_SEED, MAX_TICKS, squatScript } from "./scripts.ts";
import {
  afterJudging,
  chooseLift,
  continueAfterOutcome,
  initialState,
  queueInput,
  startPlay,
  startWalkout,
  stepPlay,
  SOURCE_COMMIT,
} from "./machine.ts";
import { sheetIndexFromPresentation } from "./frames.ts";

const LIFT_SHA256 = "4dc74947ffc64f1af36da92c01a7cfb53d3f021b802cba31f67c3ecdcb24e417";
const TUNING_SHA256 = "ef920d59eecdb5ac698f7515a1efe4af1c7ee0e38f9079f7f9cd6deace441f2a";

function digestFile(rel: string): string {
  return createHash("sha256").update(readFileSync(rel)).digest("hex");
}

function phasePath(history: readonly LiftState[]): LiftPhase[] {
  const out: LiftPhase[] = [];
  for (const state of history) {
    const last = out[out.length - 1];
    if (last !== state.phase) out.push(state.phase);
  }
  return out;
}

function historyDigest(history: readonly LiftState[]): string {
  const rows = history.map((state) =>
    [
      state.tick,
      state.phase,
      state.phaseTick,
      state.held,
      state.depth,
      state.height,
      state.velocity,
      state.peakHeight,
      state.netForce,
      state.depthAchieved,
      state.drivesUsed,
      state.ascentTicks,
      state.stallTicks,
      state.pressCommandTick,
      state.downCommandTick,
      state.resolution?.outcome ?? null,
      state.resolution?.missReason ?? null,
    ].join("|"),
  );
  const hash = createHash("sha256").update(rows.join("\n")).digest("hex").slice(0, 16);
  return `${history.length}:${hash}`;
}

function playScript(stateStart: ReturnType<typeof initialState>, script: { tick: number; kind: "press" | "release" }[]) {
  let state = stateStart;
  const byTick = new Map(script.map((s) => [s.tick, s]));
  let guard = 0;
  while (state.screen === "play" && guard < MAX_TICKS) {
    const input = byTick.get(state.liftState!.tick + 1);
    if (input) state = queueInput(state, input.kind);
    state = stepPlay(state, 1000 / 60);
    guard += 1;
  }
  return state;
}

describe("authoritative freeze source", () => {
  it("pins lift.ts and liftTuning.ts to Session A A0 SHA 288db32c", () => {
    expect(SOURCE_COMMIT).toBe("288db32c06232bb0fb65ce7236a0614c698a6920");
    expect(digestFile("src/game/lift.ts")).toBe(LIFT_SHA256);
    expect(digestFile("src/game/liftTuning.ts")).toBe(TUNING_SHA256);
  });
});

describe("A0 history digests still hold through the arcade driver", () => {
  it("pins representative squat and deadlift histories", () => {
    const squatConfig: LiftConfig = { kind: "squat", loadRatio: 0.85, seed: 7 };
    const deadliftConfig: LiftConfig = { kind: "deadlift", loadRatio: 0.85, seed: 7 };
    const squat = runLift(squatConfig, squatScript(squatConfig, "ideal"), MAX_TICKS).history;
    const deadlift = runLift(deadliftConfig, deadliftScript(deadliftConfig, "held"), MAX_TICKS).history;
    expect(historyDigest(squat)).toBe("143:202d21c756e1ddf0");
    expect(historyDigest(deadlift)).toBe("163:fa82901b439b9c70");
  });
});

describe("presentation parity", () => {
  it("mirrors phase, outcome, load, and depth from LiftState", () => {
    const config: LiftConfig = { kind: "squat", loadRatio: 0.7, seed: FREEZE_SEED };
    const played = runLift(config, squatScript(config, "ideal"), MAX_TICKS);
    let prior: LiftState | null = null;
    for (const state of played.history) {
      const view = liftPresentation(state, 126, prior);
      expect(view.phase).toBe(state.phase);
      expect(view.kind).toBe("squat");
      expect(view.depth).toBe(state.depth);
      expect(view.barHeight).toBe(state.height);
      expect(view.load.loadRatio).toBe(state.config.loadRatio);
      expect(view.outcome).toBe(state.resolution?.outcome ?? null);
      expect(view.complete).toBe(state.phase === "RESOLVED");
      prior = state;
    }
    expect(played.final.resolution?.depthAchieved).toBe(true);
    expect(played.final.resolution?.outcome).not.toBe("miss");
  });
});

describe("squat faculties", () => {
  it("makes legal depth, misses high, and buries a hold-forever", () => {
    const legalCfg: LiftConfig = { kind: "squat", loadRatio: 0.7, seed: FREEZE_SEED };
    const legal = runLift(legalCfg, squatScript(legalCfg, "ideal"), MAX_TICKS);
    expect(legal.final.resolution?.depthAchieved).toBe(true);
    expect(legal.final.resolution?.outcome).not.toBe("miss");
    const path = phasePath(legal.history);
    expect(path).toEqual(["BRACE", "DESCENT", "HOLE", "ASCENT", "LOCKOUT", "RESOLVED"]);
    const hole = legal.history.find((s) => s.phase === "HOLE");
    expect(hole).toBeTruthy();
    expect((hole?.depth ?? 0) >= 0.8).toBe(true);
    expect(sheetIndexFromPresentation(liftPresentation(hole!, 126, null))).toBe(2);

    const high = runLift(legalCfg, squatScript(legalCfg, "high"), MAX_TICKS);
    expect(high.final.resolution?.depthAchieved).toBe(false);
    expect(high.final.resolution?.outcome).toBe("miss");
    expect(high.final.resolution?.missReason).toBe("no-depth");

    const buriedCfg: LiftConfig = { kind: "squat", loadRatio: 1, seed: 11 };
    const buried = runLift(buriedCfg, squatScript(buriedCfg, "buried"), MAX_TICKS);
    expect(buried.final.resolution?.missReason).toBe("buried");
  });
});

describe("bench faculties", () => {
  it("holds a chest pause, fires an unpredictable press command, and mashes through", () => {
    const config: LiftConfig = { kind: "bench", loadRatio: 0.7, seed: FREEZE_SEED };
    const played = runLift(config, benchScript(config, "mash"), MAX_TICKS);
    const path = phasePath(played.history);
    expect(path[0]).toBe("BRACE");
    expect(path).toContain("DESCENT");
    expect(path).toContain("HOLE");
    expect(path).toContain("ASCENT");
    const commanded = played.history.find((s) => s.events.some((e) => e.kind === "press-command"));
    expect(commanded).toBeTruthy();
    expect(commanded?.phase).toBe("HOLE");
    expect(played.final.resolution?.outcome).not.toBe("miss");
  });

  it("misses an unanswered press command", () => {
    const config: LiftConfig = { kind: "bench", loadRatio: 0.95, seed: 3 };
    const played = runLift(config, benchScript(config, "no-press"), MAX_TICKS);
    expect(played.final.resolution).not.toBeNull();
    expect(played.history.some((s) => s.phase === "HOLE")).toBe(true);
  });
});

describe("deadlift faculties", () => {
  it("walks BRACE → ASCENT → LOCKOUT → RESOLVED with a down command", () => {
    const config: LiftConfig = { kind: "deadlift", loadRatio: 0.9, seed: FREEZE_SEED };
    const played = runLift(config, deadliftScript(config, "held"), MAX_TICKS);
    expect(phasePath(played.history)).toEqual(["BRACE", "ASCENT", "LOCKOUT", "RESOLVED"]);
    expect(played.history[0]?.height).toBe(0);
    expect(played.history.some((s) => s.downCommandTick !== null && s.tick >= s.downCommandTick)).toBe(
      true,
    );
    expect(played.final.resolution?.outcome).not.toBe("miss");
  });

  it("scripts an early-release attempt without inventing a new miss rule", () => {
    const config: LiftConfig = { kind: "deadlift", loadRatio: 0.9, seed: 1 };
    const held = runLift(config, deadliftScript(config, "held"), MAX_TICKS);
    const letGo = runLift(config, deadliftScript(config, "letgo"), MAX_TICKS);
    expect(held.final.resolution).not.toBeNull();
    expect(letGo.final.resolution).not.toBeNull();
    expect(held.final.resolution?.outcome).not.toBe("miss");
  });
});

describe("judging and three attempts", () => {
  it("majority lights match the mechanic make/miss", () => {
    const config: LiftConfig = { kind: "squat", loadRatio: 0.7, seed: FREEZE_SEED };
    const legal = runLift(config, squatScript(config, "ideal"), MAX_TICKS);
    const high = runLift(config, squatScript(config, "high"), MAX_TICKS);
    const makeCall = judgeAttempt(legal.final.resolution!, attemptSeedFor(4, "squat", 1));
    const missCall = judgeAttempt(high.final.resolution!, attemptSeedFor(4, "squat", 2));
    expect(makeCall.good).toBe(true);
    expect(isGoodLift(makeCall.lights)).toBe(true);
    expect(missCall.good).toBe(false);
    expect(isGoodLift(missCall.lights)).toBe(false);
  });

  it("plays three scripted squat attempts into a results card", () => {
    let state = chooseLift(initialState(null), "squat");
    expect(state.attemptsKg[0]).toBeGreaterThanOrEqual(25);
    expect(state.attemptsKg[1]).toBeGreaterThanOrEqual(state.attemptsKg[0]!);
    expect(state.attemptsKg[2]).toBeGreaterThanOrEqual(state.attemptsKg[1]!);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      state = startPlay(startWalkout(state));
      const cfg = state.liftState!.config;
      state = playScript(state, squatScript(cfg, "ideal"));
      expect(state.screen).toBe("judging");
      expect(state.lastOutcome?.made).toBe(true);
      state = continueAfterOutcome(afterJudging(state));
    }
    expect(state.screen).toBe("results");
    expect(state.meet?.bombed).toBe(false);
    expect(state.meet?.bestKg).toBeGreaterThan(0);
    expect(state.outcomes).toHaveLength(3);
  });

  it("bombs three high squats", () => {
    let state = chooseLift(initialState(null), "squat");
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      state = startPlay(startWalkout(state));
      state = playScript(state, squatScript(state.liftState!.config, "high"));
      state = continueAfterOutcome(afterJudging(state));
    }
    expect(state.screen).toBe("bomb");
    expect(state.meet?.bombed).toBe(true);
    expect(state.meet?.bestKg).toBe(0);
  });
});

describe("stepLift identity", () => {
  it("Arcade stepPlay is createLift/stepLift at 60 Hz, not a second physics", () => {
    const started = startPlay(startWalkout(chooseLift(initialState(null), "deadlift")));
    let arcade = started;
    let sim = createLift(started.liftState!.config);
    expect(arcade.liftState?.tick).toBe(sim.tick);
    arcade = queueInput(arcade, "press");
    arcade = stepPlay(arcade, 1000 / 60);
    sim = stepLift(sim, { kind: "press" });
    expect(arcade.liftState?.phase).toBe(sim.phase);
    expect(arcade.liftState?.height).toBe(sim.height);
    expect(arcade.presentation?.phase).toBe(sim.phase);
  });
});

describe("proof fixtures sit on the sport machine", () => {
  it("parses proof query and builds a freeze-judged results card", () => {
    expect(readProofQuery("?proof=timing")).toEqual({ screen: "timing", freeze: false, lift: null });
    const meet = sampleScoredMeet();
    expect(meet.lift).toBe("deadlift");
    expect(meet.outcomes).toHaveLength(3);
    expect(meet.bombed).toBe(false);
    expect(meet.bestKg).toBeGreaterThan(0);
    const next = applyProofToState(initialState(null), "?proof=results");
    expect(next.screen).toBe("results");
    expect(next.meet?.bestKg).toBe(meet.bestKg);
    const benchTiming = applyProofToState(initialState(null), "?proof=timing&lift=bench");
    expect(benchTiming.screen).toBe("play");
    expect(benchTiming.lift).toBe("bench");
    expect(benchTiming.liftState?.config.kind).toBe("bench");
  });
});
