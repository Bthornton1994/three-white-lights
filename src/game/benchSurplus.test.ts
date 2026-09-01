/**
 * C3 surplus compression — derivation, identity, truthful pips, 8 < 9 < 10.
 *
 * Minted 2026-09-01 after ordinary-bench phone replay. Additive bands are
 * frozen; this file checks the compressor on top of them.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  benchWorkingBand,
  benchWorkingExcess,
  createLift,
  grindChargeNext,
  grindForce,
  grindProgress,
  grindUsefulForce,
  meanGrindForceAtGap,
  stepLift,
  type LiftConfig,
  type LiftInput,
  type LiftState,
} from './lift';
import { LIFT_TUNING, TICK_MS } from './liftTuning';
import {
  EMPTY_FATIGUE_STATE,
  NEUTRAL_CHECK_IN,
  sessionFeel,
} from './fatigue';
import { prescribeSession } from './session';
import { SESSION_TUNING } from './sessionTuning';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = 'bench' as const;
const MAX_TICKS = 1200;
const CENSUS_SEEDS = 16;
const JITTER_MS = 8;
const FAST_STOP_AFTER = 48;

function ordinaryFeel() {
  return sessionFeel(EMPTY_FATIGUE_STATE, 1, NEUTRAL_CHECK_IN);
}

function ordinaryConfig(rpe: 6 | 7 | 8 | 9 | 10, seed: number): LiftConfig {
  const feel = ordinaryFeel();
  const plan = prescribeSession(
    SESSION_TUNING.STARTING_E1RM.kilograms.bench,
    BENCH,
    rpe,
    feel.readiness,
    SESSION_TUNING.WORK_SETS,
    SESSION_TUNING.REPS_PER_SET,
  );
  return { kind: BENCH, loadRatio: plan.loadRatio, seed, feel };
}

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

function independentCycleMean(gap: number): number {
  const decay = LIFT_TUNING.GRIND_CHARGE_DECAY_PER_TICK;
  const decayOverCycle = decay ** gap;
  const afterTap = 1 / (1 - decayOverCycle);
  let charge = afterTap;
  let sum = 0;
  for (let t = 0; t < gap; t += 1) {
    sum += grindForce(charge);
    charge = grindChargeNext(charge, false);
  }
  return sum / gap;
}

function splitmix(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ticksFromMs(ms: number): number {
  return Math.max(LIFT_TUNING.GRIND_TAP_REFRACTORY_TICKS, Math.round(ms / TICK_MS));
}

type GapFn = (ascentTicks: number) => number | null;

function driveRep(
  config: LiftConfig,
  gapFor: GapFn,
): LiftState & {
  minVel: number;
  forceSum: number;
  usefulSum: number;
  pipSum: number;
  ascentN: number;
} {
  let state = createLift(config);
  let commanded = false;
  let nextTapTick: number | null = null;
  let releaseNext = false;
  let minVel = Infinity;
  let forceSum = 0;
  let usefulSum = 0;
  let pipSum = 0;
  let ascentN = 0;
  for (let i = 0; i < MAX_TICKS; i += 1) {
    const tick = state.tick + 1;
    let input: LiftInput | null = null;
    if (!commanded) {
      if (tick === 1) input = { kind: 'press' };
    } else if (releaseNext) {
      input = { kind: 'release' };
      releaseNext = false;
    } else if (nextTapTick !== null && tick >= nextTapTick) {
      const gap = gapFor(state.ascentTicks);
      if (gap !== null) {
        input = { kind: 'press' };
        releaseNext = true;
        nextTapTick = tick + gap;
      }
    }
    state = stepLift(state, input);
    const command = state.pressCommandTick;
    if (!commanded && command !== null && state.tick >= command) {
      commanded = true;
      nextTapTick = state.tick + 1;
      releaseNext = false;
    }
    if (state.phase === 'ASCENT') {
      ascentN += 1;
      forceSum += state.grindForce;
      usefulSum += grindUsefulForce(state.grindForce, state.config);
      const progress = grindProgress(state);
      pipSum += progress?.lit ?? 0;
      if (state.velocity < minVel) minVel = state.velocity;
    }
    if (state.phase === 'RESOLVED') break;
  }
  return Object.assign(state, {
    minVel: Number.isFinite(minVel) ? minVel : 0,
    forceSum,
    usefulSum,
    pipSum,
    ascentN,
  });
}

interface CellStats {
  make: number;
  grind: number;
  good: number;
  miss: number;
  ascent: number;
  stall: number;
  minVel: number;
  force: number;
  useful: number;
  pips: number;
}

function statsOf(rpe: 8 | 9 | 10, centerMs: number, jitter: boolean, seeds: number): CellStats {
  let make = 0;
  let grind = 0;
  let good = 0;
  let miss = 0;
  let ascent = 0;
  let stall = 0;
  let minVel = 0;
  let force = 0;
  let useful = 0;
  let pips = 0;
  for (let seed = 1; seed <= seeds; seed += 1) {
    const draw = splitmix(7100 + seed * 29 + Math.round(centerMs));
    const gapFor: GapFn = jitter
      ? () => ticksFromMs(centerMs + (draw() * 2 - 1) * JITTER_MS)
      : () => ticksFromMs(centerMs);
    const s = driveRep(ordinaryConfig(rpe, seed), gapFor);
    const out = s.resolution?.outcome;
    if (out === 'miss') miss += 1;
    else {
      make += 1;
      if (out === 'grind') grind += 1;
      else if (out === 'good-lift') good += 1;
    }
    stall += s.stallTicks;
    ascent += s.ascentTicks;
    minVel += s.minVel;
    force += s.ascentN ? s.forceSum / s.ascentN : 0;
    useful += s.ascentN ? s.usefulSum / s.ascentN : 0;
    pips += s.ascentN ? s.pipSum / s.ascentN : 0;
  }
  const n = seeds;
  return {
    make: make / n,
    grind: grind / n,
    good: good / n,
    miss: miss / n,
    ascent: ascent / n,
    stall: stall / n,
    minVel: minVel / n,
    force: force / n,
    useful: useful / n,
    pips: pips / n,
  };
}

function coastStats(rpe: 8 | 9 | 10, seeds: number): CellStats {
  const gapFor: GapFn = (ascent) => (ascent <= FAST_STOP_AFTER ? LIFT_TUNING.GRIND_TAP_REFRACTORY_TICKS : null);
  let make = 0;
  let grind = 0;
  let good = 0;
  let miss = 0;
  let ascent = 0;
  let stall = 0;
  let minVel = 0;
  let force = 0;
  let useful = 0;
  let pips = 0;
  for (let seed = 1; seed <= seeds; seed += 1) {
    const s = driveRep(ordinaryConfig(rpe, seed), gapFor);
    const out = s.resolution?.outcome;
    if (out === 'miss') miss += 1;
    else {
      make += 1;
      if (out === 'grind') grind += 1;
      else if (out === 'good-lift') good += 1;
    }
    stall += s.stallTicks;
    ascent += s.ascentTicks;
    minVel += s.minVel;
    force += s.ascentN ? s.forceSum / s.ascentN : 0;
    useful += s.ascentN ? s.usefulSum / s.ascentN : 0;
    pips += s.ascentN ? s.pipSum / s.ascentN : 0;
  }
  const n = seeds;
  return {
    make: make / n,
    grind: grind / n,
    good: good / n,
    miss: miss / n,
    ascent: ascent / n,
    stall: stall / n,
    minVel: minVel / n,
    force: force / n,
    useful: useful / n,
    pips: pips / n,
  };
}

describe('C3 surplus compression', () => {
  it('derives the floor from the charge cycle, not from copied probe forces', () => {
    const onsetGap = LIFT_TUNING.BENCH_SURPLUS_FLOOR_GAP_TICKS.onset;
    const middleGap = LIFT_TUNING.BENCH_SURPLUS_FLOOR_GAP_TICKS.middle;
    expect(onsetGap).toBe(11);
    expect(middleGap).toBe(8);
    expect(LIFT_TUNING.BENCH_SURPLUS_FLOOR_CUT_MARGIN).toBe(0.025);
    expect(LIFT_TUNING.BENCH_SURPLUS_COMPRESS).toBe(0.55);
    expect(meanGrindForceAtGap(onsetGap)).toBeCloseTo(independentCycleMean(onsetGap), 6);
    expect(meanGrindForceAtGap(middleGap)).toBeCloseTo(independentCycleMean(middleGap), 6);
    expect(meanGrindForceAtGap(middleGap)).toBeGreaterThan(meanGrindForceAtGap(onsetGap));
    expect(meanGrindForceAtGap(onsetGap)).toBeGreaterThan(meanGrindForceAtGap(onsetGap + 1));
    const source = codeOnly(readFileSync(path.join(HERE, 'liftTuning.ts'), 'utf8'));
    expect(source, '0.626 is a probe measurement, not a tuning literal').not.toMatch(/\b0\.626\b/);
    expect(source, '0.741 is a probe measurement, not a tuning literal').not.toMatch(/\b0\.741\b/);
  });

  it('leaves wall, warm-up, squat and deadlift byte-identical to raw force [bench-surplus-wall-is-identity]', () => {
    expect(LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_ONSET).toBe(0.22);
    expect(LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_MIDDLE_ADDEND).toBe(0.214);
    expect(LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND).toBe(0.192);

    const wall = ordinaryConfig(10, 1);
    expect(benchWorkingBand(wall.kind, benchWorkingExcess(wall))).toBe('wall');
    const warmup = ordinaryConfig(6, 1);
    expect(benchWorkingBand(warmup.kind, benchWorkingExcess(warmup))).toBeNull();
    const squat: LiftConfig = { kind: 'squat', loadRatio: 0.9, seed: 1 };
    const pull: LiftConfig = { kind: 'deadlift', loadRatio: 0.9, seed: 1 };

    const identityForces = [0, 0.3, 0.62, 0.8, 1] as const;
    expect(identityForces.length, 'the forces identity is checked at').toBe(5);
    for (const force of identityForces) {
      expect(grindUsefulForce(force, wall), `wall force ${force}`).toBe(force);
      expect(grindUsefulForce(force, warmup), `warmup force ${force}`).toBe(force);
      expect(grindUsefulForce(force, squat), `squat force ${force}`).toBe(force);
      expect(grindUsefulForce(force, pull), `deadlift force ${force}`).toBe(force);
    }

    const slowFeel = sessionFeel(EMPTY_FATIGUE_STATE, 1, {
      sleep: 'poor',
      soreness: 'sore',
      motivation: 'flat',
    });
    const onsetPlan = prescribeSession(
      SESSION_TUNING.STARTING_E1RM.kilograms.bench,
      BENCH,
      8,
      slowFeel.readiness,
      SESSION_TUNING.WORK_SETS,
      SESSION_TUNING.REPS_PER_SET,
    );
    const onset: LiftConfig = { kind: BENCH, loadRatio: onsetPlan.loadRatio, seed: 1, feel: slowFeel };
    const middle = ordinaryConfig(9, 1);
    expect(benchWorkingBand(onset.kind, benchWorkingExcess(onset))).toBe('onset');
    expect(benchWorkingBand(middle.kind, benchWorkingExcess(middle))).toBe('middle');
    const onsetFloor = meanGrindForceAtGap(LIFT_TUNING.BENCH_SURPLUS_FLOOR_GAP_TICKS.onset);
    const middleFloor = meanGrindForceAtGap(LIFT_TUNING.BENCH_SURPLUS_FLOOR_GAP_TICKS.middle);
    expect(grindUsefulForce(onsetFloor, onset)).toBe(onsetFloor);
    expect(grindUsefulForce(middleFloor, middle)).toBe(middleFloor);
    expect(grindUsefulForce(0, onset)).toBe(0);
    const mashedOnset = grindUsefulForce(1, onset);
    const mashedMiddle = grindUsefulForce(1, middle);
    expect(mashedOnset).toBeCloseTo(
      onsetFloor + (1 - onsetFloor) * LIFT_TUNING.BENCH_SURPLUS_COMPRESS,
      6,
    );
    expect(mashedMiddle).toBeCloseTo(
      middleFloor + (1 - middleFloor) * LIFT_TUNING.BENCH_SURPLUS_COMPRESS,
      6,
    );
    expect(mashedOnset).toBeLessThan(1);
    expect(mashedMiddle).toBeLessThan(1);
    expect(mashedOnset).toBeGreaterThan(onsetFloor);
    const played8 = ordinaryConfig(8, 1);
    const played9 = ordinaryConfig(9, 1);
    expect(grindUsefulForce(1, played8)).toBeCloseTo(mashedOnset, 6);
    expect(grindUsefulForce(1, played9)).toBeCloseTo(mashedMiddle, 6);
  });

  it('lights the pip row from useful force, not raw grindForce [the-grind-readout-reads-useful-force]', () => {
    const config = ordinaryConfig(8, 3);
    const mashed = driveRep(config, () => LIFT_TUNING.GRIND_TAP_REFRACTORY_TICKS);
    let sawAscent = 0;
    let sawCompression = 0;
    let state = createLift(config);
    let commanded = false;
    let nextTapTick: number | null = null;
    let releaseNext = false;
    for (let i = 0; i < MAX_TICKS; i += 1) {
      const tick = state.tick + 1;
      let input: LiftInput | null = null;
      if (!commanded) {
        if (tick === 1) input = { kind: 'press' };
      } else if (releaseNext) {
        input = { kind: 'release' };
        releaseNext = false;
      } else if (nextTapTick !== null && tick >= nextTapTick) {
        input = { kind: 'press' };
        releaseNext = true;
        nextTapTick = tick + LIFT_TUNING.GRIND_TAP_REFRACTORY_TICKS;
      }
      state = stepLift(state, input);
      const command = state.pressCommandTick;
      if (!commanded && command !== null && state.tick >= command) {
        commanded = true;
        nextTapTick = state.tick + 1;
        releaseNext = false;
      }
      const progress = grindProgress(state);
      if (progress !== null && state.phase === 'ASCENT' && state.grindForce > 0.9) {
        sawAscent += 1;
        const useful = grindUsefulForce(state.grindForce, state.config);
        const units = LIFT_TUNING.FEEDBACK.STAGE_COMMAND.GRIND_READOUT_UNITS;
        expect(progress.force).toBeCloseTo(useful, 9);
        expect(progress.lit).toBe(Math.min(units, Math.round(useful * units)));
        const rawLit = Math.min(units, Math.round(state.grindForce * units));
        if (progress.lit !== rawLit) sawCompression += 1;
      }
      if (state.phase === 'RESOLVED') break;
    }
    expect(sawAscent, 'never saw a mashed ascent tick').toBeGreaterThan(10);
    expect(sawCompression, 'pips still tracked raw force').toBeGreaterThan(0);
    expect(mashed.resolution?.outcome).not.toBe('miss');
  });

  it('orders RPE 8 < 9 < 10 at committed ~70 ms and closes the coast', () => {
    const rungs = [8, 9, 10] as const;
    const table: Record<number, Record<number, CellStats>> = { 8: {}, 9: {}, 10: {} };
    for (const rpe of rungs) {
      for (const ms of [40, 70, 100] as const) {
        table[rpe]![ms] = statsOf(rpe, ms, true, CENSUS_SEEDS);
      }
    }
    const coast8 = coastStats(8, 12);
    const coast9 = coastStats(9, 12);
    const at70 = {
      8: table[8]![70]!,
      9: table[9]![70]!,
      10: table[10]![70]!,
    };
    const dump = [8, 9, 10].flatMap((rpe) =>
      ([40, 70, 100] as const).map((ms) => {
        const s = table[rpe]![ms]!;
        return `RPE ${rpe} ${ms}ms make=${s.make} grind=${s.grind} good=${s.good} miss=${s.miss} ascent=${s.ascent.toFixed(1)} stall=${s.stall.toFixed(1)} minVel=${s.minVel.toFixed(4)} F=${s.force.toFixed(3)} U=${s.useful.toFixed(3)} pips=${s.pips.toFixed(1)}`;
      }),
    );
    dump.push(
      `coast8 miss=${coast8.miss} grind=${coast8.grind} make=${coast8.make} ascent=${coast8.ascent.toFixed(1)}`,
      `coast9 miss=${coast9.miss} grind=${coast9.grind} make=${coast9.make} ascent=${coast9.ascent.toFixed(1)}`,
    );
    // eslint-disable-next-line no-console
    console.log(dump.join('\n'));
    expect(at70[8].make, `RPE 8 70ms make\n${dump.join('\n')}`).toBe(1);
    expect(at70[9].make, 'RPE 9 70ms make').toBe(1);
    expect(at70[10].make, 'RPE 10 70ms make').toBe(1);
    expect(at70[8].grind, 'RPE 8 70ms grind').toBe(1);
    expect(at70[9].grind, 'RPE 9 70ms grind').toBe(1);
    expect(at70[10].grind, 'RPE 10 70ms grind').toBe(1);
    expect(at70[8].ascent, '8 < 9 at 70ms').toBeLessThan(at70[9].ascent);
    expect(at70[9].ascent, '9 < 10 at 70ms').toBeLessThan(at70[10].ascent);
    expect(at70[8].useful, 'RPE 8 useful < raw').toBeLessThan(at70[8].force);
    expect(at70[9].useful, 'RPE 9 useful < raw').toBeLessThan(at70[9].force);
    expect(at70[10].useful, 'RPE 10 useful is identity').toBeCloseTo(at70[10].force, 9);
    expect(coast8.miss, 'fast-48 must miss RPE 8').toBe(1);
    expect(coast9.miss, 'fast-48 must miss RPE 9').toBe(1);
    for (const rpe of rungs) {
      const mash = table[rpe]![40]!;
      const human = table[rpe]![70]!;
      expect(mash.good, `RPE ${rpe} 40ms is not a better class than 70ms`).toBeLessThanOrEqual(
        human.good,
      );
    }
    // The numbers are the report, pinned so a retune that quietly walks
    // them has to re-pin rather than leaving the ordering assertion green
    // on a different shape. Re-derived against production C3, not copied
    // from the isolated prototype.
    expect(Math.round(at70[8].ascent * 10) / 10).toBeGreaterThan(80);
    expect(Math.round(at70[10].ascent * 10) / 10).toBeGreaterThan(Math.round(at70[9].ascent * 10) / 10);
  }, 90_000);
});
