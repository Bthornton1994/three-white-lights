/**
 * Replay scripts for tests and fixtures.
 * Copied from A0 freeze harnesses (a0LiftFreeze.test.ts / lift.test.ts).
 * They READ the sim; they do not retune it.
 */
import {
  braceTicks,
  descentRate,
  runLift,
  type LiftConfig,
  type ScriptedInput,
} from "../game/lift.ts";
import { LIFT_TUNING } from "../game/liftTuning.ts";

export const MAX_TICKS = 1200;
export const FREEZE_SEED = 4;
export const MASH_GAP_TICKS = 3;
export const MAX_SCRIPTED_TAPS = 80;

export function squatScript(
  config: LiftConfig,
  style: "ideal" | "high" | "buried",
): ScriptedInput[] {
  const load = config.loadRatio;
  const press = braceTicks(load, "squat") + 1;
  if (style === "buried") return [{ tick: press, kind: "press" }];
  const depth = style === "high" ? 0.6 : LIFT_TUNING.DEPTH_IDEAL.squat;
  const release = press + Math.round(depth / descentRate(load, "squat"));
  const base: ScriptedInput[] = [
    { tick: press, kind: "press" },
    { tick: release, kind: "release" },
  ];
  if (style === "high") return base;
  const probe = runLift(config, base, MAX_TICKS);
  const open = probe.history.find((state) =>
    state.events.some((event) => event.kind === "drive-cue-open"),
  );
  const ideal = open?.activeCue?.idealTick ?? null;
  if (ideal === null) return base;
  return [...base, { tick: ideal, kind: "press" }];
}

export function deadliftScript(
  config: LiftConfig,
  style: "held" | "letgo",
): ScriptedInput[] {
  const load = config.loadRatio;
  let script: ScriptedInput[] = [{ tick: braceTicks(load, "deadlift") + 1, kind: "press" }];
  for (let i = 0; i < 12; i += 1) {
    const probe = runLift(config, script, MAX_TICKS);
    const opens = probe.history.filter((state) =>
      state.events.some((event) => event.kind === "drive-cue-open"),
    );
    const cue = opens[opens.length - 1]?.activeCue ?? null;
    if (cue === null || script.some((input) => input.tick === cue.idealTick)) break;
    const locked = probe.history.find((state) =>
      state.events.some((event) => event.kind === "lockout"),
    );
    if (locked !== undefined && cue.idealTick >= locked.tick) break;
    script = [
      ...script,
      { tick: cue.idealTick - 1, kind: "release" },
      { tick: cue.idealTick, kind: "press" },
    ];
  }
  if (style === "letgo") {
    const probe = runLift(config, script, MAX_TICKS);
    const lock = probe.history.find((state) =>
      state.events.some((event) => event.kind === "lockout"),
    );
    if (lock !== undefined) script = [...script, { tick: lock.tick + 1, kind: "release" }];
  }
  return script;
}

function commandTickFor(config: LiftConfig): number | null {
  const press = braceTicks(config.loadRatio, "bench") + 1;
  const probe = runLift(config, [{ tick: press, kind: "press" }], MAX_TICKS);
  for (const state of probe.history) {
    if (state.events.some((event) => event.kind === "press-command")) return state.tick;
  }
  return null;
}

function mashTaps(fromTick: number, gapTicks: number, count: number): ScriptedInput[] {
  const out: ScriptedInput[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({ tick: fromTick + i * gapTicks, kind: "press" });
    out.push({ tick: fromTick + i * gapTicks + 1, kind: "release" });
  }
  return out;
}

export function benchScript(
  config: LiftConfig,
  style: "mash" | "no-press" | "false-start",
): ScriptedInput[] {
  const press = braceTicks(config.loadRatio, "bench") + 1;
  const hold: ScriptedInput[] = [{ tick: press, kind: "press" }];
  if (style === "no-press") return hold;
  const command = commandTickFor(config);
  if (command === null) return hold;
  if (style === "false-start") {
    const falseStart: ScriptedInput[] = [
      ...hold,
      { tick: Math.max(press + 1, command - 2), kind: "press" },
      { tick: Math.max(press + 2, command - 1), kind: "release" },
      ...mashTaps(command, MASH_GAP_TICKS, MAX_SCRIPTED_TAPS),
    ];
    return falseStart.sort((a, b) => a.tick - b.tick);
  }
  return [...hold, ...mashTaps(command, MASH_GAP_TICKS, MAX_SCRIPTED_TAPS)].sort(
    (a, b) => a.tick - b.tick,
  );
}
