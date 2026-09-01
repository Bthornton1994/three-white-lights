/**
 * A0 freeze — accepted squat / bench C3 / deadlift mechanics.
 *
 * Histories are already hash-pinned in `lift.test.ts` ("squat and deadlift
 * are untouched by the bench redesign", 85 cases at `BASELINE_COMMIT`). This
 * file is the A0 ruling's extra anchors: C3 constants, the deadlift phase
 * sentence, squat miss shapes, and committed play up the load ladder. Visual
 * identity work must leave every assertion here green.
 *
 * NOTHING BELOW ASSERTS FEEL. The human already ruled the mechanics in.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  braceTicks,
  createLift,
  descentRate,
  runLift,
  stepLift,
  type LiftConfig,
  type LiftPhase,
  type LiftState,
  type ScriptedInput,
} from './lift';
import { LIFT_TUNING } from './liftTuning';
import {
  EMPTY_FATIGUE_STATE,
  NEUTRAL_CHECK_IN,
  sessionFeel,
} from './fatigue';
import { prescribeSession } from './session';
import { SESSION_TUNING } from './sessionTuning';

const FREEZE_SEED = 4;
const MAX_TICKS = 1200;
const WORK_SETS = SESSION_TUNING.WORK_SETS;
const REPS_PER_SET = SESSION_TUNING.REPS_PER_SET;

function ordinaryFeel() {
  return sessionFeel(EMPTY_FATIGUE_STATE, 20300, NEUTRAL_CHECK_IN);
}

function squatScript(config: LiftConfig, style: 'ideal' | 'high' | 'buried'): ScriptedInput[] {
  const load = config.loadRatio;
  const press = braceTicks(load, 'squat') + 1;
  if (style === 'buried') return [{ tick: press, kind: 'press' }];
  const depth = style === 'high' ? 0.6 : LIFT_TUNING.DEPTH_IDEAL.squat;
  const release = press + Math.round(depth / descentRate(load, 'squat'));
  const base: ScriptedInput[] = [
    { tick: press, kind: 'press' },
    { tick: release, kind: 'release' },
  ];
  if (style === 'high') return base;
  const probe = runLift(config, base, MAX_TICKS);
  const open = probe.history.find((state) => state.events.some((event) => event.kind === 'drive-cue-open'));
  const ideal = open?.activeCue?.idealTick ?? null;
  if (ideal === null) return base;
  return [...base, { tick: ideal, kind: 'press' }];
}

function deadliftScript(config: LiftConfig, style: 'held' | 'letgo'): ScriptedInput[] {
  const load = config.loadRatio;
  let script: ScriptedInput[] = [{ tick: braceTicks(load, 'deadlift') + 1, kind: 'press' }];
  for (let i = 0; i < 12; i += 1) {
    const probe = runLift(config, script, MAX_TICKS);
    const opens = probe.history.filter((state) =>
      state.events.some((event) => event.kind === 'drive-cue-open'),
    );
    const cue = opens[opens.length - 1]?.activeCue ?? null;
    if (cue === null || script.some((input) => input.tick === cue.idealTick)) break;
    const locked = probe.history.find((state) => state.events.some((event) => event.kind === 'lockout'));
    if (locked !== undefined && cue.idealTick >= locked.tick) break;
    script = [
      ...script,
      { tick: cue.idealTick - 1, kind: 'release' },
      { tick: cue.idealTick, kind: 'press' },
    ];
  }
  if (style === 'letgo') {
    const probe = runLift(config, script, MAX_TICKS);
    const lock = probe.history.find((state) => state.events.some((event) => event.kind === 'lockout'));
    if (lock !== undefined) script = [...script, { tick: lock.tick + 1, kind: 'release' }];
  }
  return script;
}

function phasePath(history: readonly LiftState[]): readonly LiftPhase[] {
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
    ].join('|'),
  );
  const hash = createHash('sha256').update(rows.join('\n')).digest('hex').slice(0, 16);
  return `${history.length}:${hash}`;
}

describe('A0 C3 bench constants stay minted', () => {
  it('keeps the accepted surplus-compression triple', () => {
    expect(LIFT_TUNING.BENCH_SURPLUS_COMPRESS).toBe(0.55);
    expect(LIFT_TUNING.BENCH_SURPLUS_FLOOR_GAP_TICKS.onset).toBe(11);
    expect(LIFT_TUNING.BENCH_SURPLUS_FLOOR_GAP_TICKS.middle).toBe(8);
    expect(LIFT_TUNING.BENCH_SURPLUS_FLOOR_CUT_MARGIN).toBe(0.025);
    expect(LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_ONSET).toBe(0.22);
    expect(LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_MIDDLE_ADDEND).toBe(0.214);
    expect(LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND).toBe(0.192);
  });
});

describe('A0 squat mechanic freeze', () => {
  it('makes a legal-depth driven rep, misses high, and buries a hold-forever', () => {
    const legal = runLift(
      { kind: 'squat', loadRatio: 0.7, seed: FREEZE_SEED },
      squatScript({ kind: 'squat', loadRatio: 0.7, seed: FREEZE_SEED }, 'ideal'),
      MAX_TICKS,
    );
    expect(legal.final.resolution?.depthAchieved).toBe(true);
    expect(legal.final.resolution?.outcome).not.toBe('miss');

    const high = runLift(
      { kind: 'squat', loadRatio: 0.7, seed: FREEZE_SEED },
      squatScript({ kind: 'squat', loadRatio: 0.7, seed: FREEZE_SEED }, 'high'),
      MAX_TICKS,
    );
    expect(high.final.resolution?.depthAchieved).toBe(false);
    expect(high.final.resolution?.outcome).toBe('miss');
    expect(high.final.resolution?.missReason).toBe('no-depth');

    const buried = runLift(
      { kind: 'squat', loadRatio: 1, seed: 11 },
      squatScript({ kind: 'squat', loadRatio: 1, seed: 11 }, 'buried'),
      MAX_TICKS,
    );
    expect(buried.final.resolution?.missReason).toBe('buried');
  });

  it('keeps ordinary-session RPE 8 / 9 / 10 committed squats as makes, slower up the ladder', () => {
    const feel = ordinaryFeel();
    const e1rm = SESSION_TUNING.STARTING_E1RM.kilograms.squat;
    const loads: number[] = [];
    const ticks: number[] = [];
    for (const rpe of [8, 9, 10] as const) {
      const plan = prescribeSession(e1rm, 'squat', rpe, feel.readiness, WORK_SETS, REPS_PER_SET);
      const config: LiftConfig = {
        kind: 'squat',
        loadRatio: plan.loadRatio,
        seed: FREEZE_SEED,
        feel,
      };
      const played = runLift(config, squatScript(config, 'ideal'), MAX_TICKS);
      expect(played.final.resolution?.outcome, `RPE ${rpe}`).not.toBe('miss');
      loads.push(plan.loadRatio);
      ticks.push(played.history.length);
    }
    expect(loads[0]).toBeLessThan(loads[1] ?? 0);
    expect(loads[1]).toBeLessThan(loads[2] ?? 0);
    expect(ticks[2]).toBeGreaterThan(ticks[0] ?? 0);
  });
});

describe('A0 deadlift mechanic freeze', () => {
  it('walks BRACE → ASCENT → LOCKOUT → RESOLVED and never enters DESCENT or HOLE', () => {
    const config: LiftConfig = { kind: 'deadlift', loadRatio: 0.9, seed: FREEZE_SEED };
    const played = runLift(config, deadliftScript(config, 'held'), MAX_TICKS);
    const path = phasePath(played.history);
    expect(path).toEqual(['BRACE', 'ASCENT', 'LOCKOUT', 'RESOLVED']);
    expect(path).not.toContain('DESCENT');
    expect(path).not.toContain('HOLE');
    expect(played.history[0]?.height).toBe(0);
    expect(played.history[0]?.depth).toBe(1);
    expect(played.history.some((state) => state.phase === 'ASCENT')).toBe(true);
    expect(played.history.some((state) => state.events.some((event) => event.kind === 'drive-cue-open'))).toBe(
      true,
    );
    expect(played.history.some((state) => state.events.some((event) => event.kind === 'lockout'))).toBe(true);
    expect(played.history.some((state) => state.downCommandTick !== null && state.tick >= state.downCommandTick)).toBe(
      true,
    );
    expect(played.final.resolution?.outcome).not.toBe('miss');
  });

  it('keeps the current early-release behaviour rather than newly punishing it', () => {
    const config: LiftConfig = { kind: 'deadlift', loadRatio: 0.9, seed: 1 };
    const held = runLift(config, deadliftScript(config, 'held'), MAX_TICKS);
    const letGo = runLift(config, deadliftScript(config, 'letgo'), MAX_TICKS);
    expect(held.final.resolution).not.toBeNull();
    expect(letGo.final.resolution).not.toBeNull();
    expect(held.final.resolution?.outcome).not.toBe('miss');
  });

  it('keeps committed pulls at working, heavy and maximal loads as makes, slower up the ladder', () => {
    const ticks: number[] = [];
    for (const load of [0.7, 0.85, 1.0] as const) {
      const config: LiftConfig = { kind: 'deadlift', loadRatio: load, seed: 7 };
      const played = runLift(config, deadliftScript(config, 'held'), MAX_TICKS);
      expect(played.final.resolution?.outcome, `load ${load}`).not.toBe('miss');
      ticks.push(played.history.length);
    }
    expect(ticks[0]).toBeLessThan(ticks[1] ?? 0);
    expect(ticks[1]).toBeLessThan(ticks[2] ?? 0);
  });
});

describe('A0 freeze digests are a function of the sim, not the drawing', () => {
  it('pins representative squat and deadlift histories', () => {
    const squatConfig: LiftConfig = { kind: 'squat', loadRatio: 0.85, seed: 7 };
    const deadliftConfig: LiftConfig = { kind: 'deadlift', loadRatio: 0.85, seed: 7 };
    const squat = runLift(squatConfig, squatScript(squatConfig, 'ideal'), MAX_TICKS).history;
    const deadlift = runLift(deadliftConfig, deadliftScript(deadliftConfig, 'held'), MAX_TICKS).history;
    expect(historyDigest(squat)).toBe('143:202d21c756e1ddf0');
    expect(historyDigest(deadlift)).toBe('163:fa82901b439b9c70');

    let stepped = createLift({ kind: 'squat', loadRatio: 0.9, seed: 3 });
    const steppedHistory: LiftState[] = [];
    for (let i = 0; i < 40; i += 1) {
      stepped = stepLift(stepped, i === 20 ? { kind: 'press' } : null);
      steppedHistory.push(stepped);
    }
    expect(steppedHistory).toHaveLength(40);
  });
});
