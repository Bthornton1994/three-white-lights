/**
 * Session A monotonic surplus-compression search.
 * Isolated prototype only. Production lift.ts / liftTuning.ts are not imported
 * for mutation. RPE 10 is identity (compress = 1) on every candidate.
 *
 *   npx vitest run tools/grind-monotonic-search.test.ts
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';

import {
  ascentDemand,
  benchWorkingExcess,
  createLift,
  grindForce,
  grindProgress,
  lifterCapacity,
  stepLift,
  type LiftConfig,
  type LiftInput,
  type LiftState,
} from '../src/game/lift';
import { LIFT_TUNING, STICK_HEIGHT_FRAC, TICK_MS } from '../src/game/liftTuning';
import {
  EMPTY_FATIGUE_STATE,
  NEUTRAL_CHECK_IN,
  sessionFeel,
  type SessionFeel,
} from '../src/game/fatigue';
import { prescribeSession } from '../src/game/session';
import { SESSION_TUNING } from '../src/game/sessionTuning';
import {
  stepLiftPrototype,
  stickBreakEvenForce,
  surplusCompress,
  type SurplusCompressSpec,
} from './grindResponsePrototype';

const BENCH = 'bench' as const;
const MAX_TICKS = 1200;
const E1RM_KG = SESSION_TUNING.STARTING_E1RM.kilograms.bench;
const STICK_H = STICK_HEIGHT_FRAC.bench;
const BOOST = LIFT_TUNING.GRIND_BOOST_FORCE_MAX;
const GRIND_ASCENT = LIFT_TUNING.GRIND_ASCENT_TICKS;
const UNITS = LIFT_TUNING.FEEDBACK.STAGE_COMMAND.GRIND_READOUT_UNITS;
const JITTER_MS = 8;
/** Matches live human 8/9/10 lock-feel to ascent ticks within ~50ms. Search guide only. */
const FEEL_OFFSET_S = 0.53;

type Rung = 'rpe8' | 'rpe9' | 'rpe10';
type Stepper = (state: LiftState, input: LiftInput | null) => LiftState;
type GapFn = (ascentTicks: number, registered: number) => number | null;

interface Cell {
  readonly rung: Rung;
  readonly loadRatio: number;
  readonly feel: SessionFeel;
  readonly weightKg: number;
}

function ordinaryFeel(): SessionFeel {
  return sessionFeel(EMPTY_FATIGUE_STATE, 20300, NEUTRAL_CHECK_IN);
}

function ordinaryCells(): Cell[] {
  const feel = ordinaryFeel();
  return ([8, 9, 10] as const).map((rpe) => {
    const plan = prescribeSession(
      E1RM_KG,
      BENCH,
      rpe,
      feel.readiness,
      SESSION_TUNING.WORK_SETS,
      SESSION_TUNING.REPS_PER_SET,
    );
    return {
      rung: `rpe${rpe}` as Rung,
      loadRatio: plan.loadRatio,
      feel,
      weightKg: plan.weightKg,
    };
  });
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

function metronome(gap: number): GapFn {
  return () => gap;
}

function jitteredMs(centerMs: number, jitterMs: number, seed: number): GapFn {
  const draw = splitmix(seed);
  return () => ticksFromMs(centerMs + (draw() * 2 - 1) * jitterMs);
}

function patternFastThenStop(fastGap: number, stopAfterAscent: number): GapFn {
  return (ascent) => (ascent <= stopAfterAscent ? fastGap : null);
}

function driveRep(
  config: LiftConfig,
  gapFor: GapFn,
  stepper: Stepper,
  spec: SurplusCompressSpec | null,
): LiftState & { minVel: number; usefulSum: number; forceSum: number; ascentN: number; lockTick: number | null } {
  let state = createLift(config);
  let commanded = false;
  let nextTapTick: number | null = null;
  let releaseNext = false;
  let minVel = Infinity;
  let usefulSum = 0;
  let forceSum = 0;
  let ascentN = 0;
  let lockTick: number | null = null;
  for (let i = 0; i < MAX_TICKS; i += 1) {
    const tick = state.tick + 1;
    let input: LiftInput | null = null;
    if (!commanded) {
      if (tick === 1) input = { kind: 'press' };
    } else if (releaseNext) {
      input = { kind: 'release' };
      releaseNext = false;
    } else if (nextTapTick !== null && tick >= nextTapTick) {
      const gap = gapFor(state.ascentTicks, state.grindTaps);
      if (gap !== null) {
        input = { kind: 'press' };
        releaseNext = true;
        nextTapTick = tick + gap;
      }
    }
    const prev = state;
    state = stepper(state, input);
    const command = state.pressCommandTick;
    if (!commanded && command !== null && state.tick >= command) {
      commanded = true;
      nextTapTick = state.tick + 1;
      releaseNext = false;
    }
    if (state.phase === 'ASCENT') {
      ascentN += 1;
      const useful = spec
        ? surplusCompress(state.grindForce, prev.phase === 'ASCENT' ? prev.height : state.height, spec)
        : state.grindForce;
      usefulSum += useful;
      forceSum += state.grindForce;
      if (state.velocity < minVel) minVel = state.velocity;
    }
    if (state.phase === 'LOCKOUT' && lockTick === null) lockTick = state.tick;
    if (state.phase === 'RESOLVED') break;
  }
  return Object.assign(state, {
    minVel: Number.isFinite(minVel) ? minVel : 0,
    usefulSum,
    forceSum,
    ascentN,
    lockTick,
  });
}

interface CellStats {
  n: number;
  make: number;
  grind: number;
  good: number;
  miss: number;
  stall: number;
  ascent: number;
  lockS: number;
  minVel: number;
  force: number;
  useful: number;
  feelS: number;
}

function statsOf(
  cell: Cell,
  centerMs: number,
  jitter: boolean,
  spec: SurplusCompressSpec | null,
  seeds: number,
): CellStats {
  let make = 0;
  let grind = 0;
  let good = 0;
  let miss = 0;
  let stall = 0;
  let ascent = 0;
  let lock = 0;
  let minVel = 0;
  let force = 0;
  let useful = 0;
  for (let seed = 1; seed <= seeds; seed += 1) {
    const gap = jitter
      ? jitteredMs(centerMs, JITTER_MS, 7100 + seed * 29 + Math.round(centerMs))
      : metronome(ticksFromMs(centerMs));
    const stepper: Stepper = spec
      ? (st, input) => stepLiftPrototype(st, input, spec)
      : stepLift;
    const s = driveRep(
      { kind: BENCH, loadRatio: cell.loadRatio, seed, feel: cell.feel },
      gap,
      stepper,
      spec,
    );
    const out = s.resolution?.outcome;
    if (out === 'miss') miss += 1;
    else {
      make += 1;
      if (out === 'grind') grind += 1;
      else if (out === 'good-lift') good += 1;
    }
    stall += s.stallTicks;
    ascent += s.ascentTicks;
    lock += (s.lockTick ?? s.tick) * TICK_MS;
    minVel += s.minVel;
    force += s.ascentN ? s.forceSum / s.ascentN : 0;
    useful += s.ascentN ? s.usefulSum / s.ascentN : 0;
  }
  const n = seeds;
  const meanAscent = ascent / n;
  return {
    n,
    make: make / n,
    grind: grind / n,
    good: good / n,
    miss: miss / n,
    stall: stall / n,
    ascent: meanAscent,
    lockS: lock / n / 1000,
    minVel: minVel / n,
    force: force / n,
    useful: useful / n,
    feelS: meanAscent * (TICK_MS / 1000) + FEEL_OFFSET_S,
  };
}

function coastStats(cell: Cell, spec: SurplusCompressSpec | null, seeds: number): CellStats {
  let make = 0;
  let grind = 0;
  let good = 0;
  let miss = 0;
  let stall = 0;
  let ascent = 0;
  let lock = 0;
  let minVel = 0;
  let force = 0;
  let useful = 0;
  const gap = patternFastThenStop(3, 48);
  for (let seed = 1; seed <= seeds; seed += 1) {
    const stepper: Stepper = spec
      ? (st, input) => stepLiftPrototype(st, input, spec)
      : stepLift;
    const s = driveRep(
      { kind: BENCH, loadRatio: cell.loadRatio, seed, feel: cell.feel },
      gap,
      stepper,
      spec,
    );
    const out = s.resolution?.outcome;
    if (out === 'miss') miss += 1;
    else {
      make += 1;
      if (out === 'grind') grind += 1;
      else if (out === 'good-lift') good += 1;
    }
    stall += s.stallTicks;
    ascent += s.ascentTicks;
    lock += (s.lockTick ?? s.tick) * TICK_MS;
    minVel += s.minVel;
    force += s.ascentN ? s.forceSum / s.ascentN : 0;
    useful += s.ascentN ? s.usefulSum / s.ascentN : 0;
  }
  const n = seeds;
  const meanAscent = ascent / n;
  return {
    n,
    make: make / n,
    grind: grind / n,
    good: good / n,
    miss: miss / n,
    stall: stall / n,
    ascent: meanAscent,
    lockS: lock / n / 1000,
    minVel: minVel / n,
    force: force / n,
    useful: useful / n,
    feelS: meanAscent * (TICK_MS / 1000) + FEEL_OFFSET_S,
  };
}

function pct(x: number): string {
  return `${(100 * x).toFixed(0)}%`;
}

function fmt(n: number, d = 2): string {
  return Number.isFinite(n) ? n.toFixed(d) : '—';
}

function line(rung: string, cadence: string, s: CellStats): string {
  return `${rung.padEnd(6)} ${cadence.padStart(8)}  make=${pct(s.make).padStart(4)} grind=${pct(s.grind).padStart(4)} miss=${pct(s.miss).padStart(4)}  ascent=${fmt(s.ascent, 1).padStart(5)}t  lock=${fmt(s.lockS, 2)}s  feel~${fmt(s.feelS, 2)}s  minVel=${fmt(s.minVel, 4)} stall=${fmt(s.stall, 1)}  F=${fmt(s.force, 3)} U=${fmt(s.useful, 3)}`;
}

type FloorKind = 'breakEven' | 'floorCadence';

interface NamedSpec {
  name: string;
  kind: FloorKind | 'control';
  c8: number;
  c9: number;
  byRung: Record<Rung, SurplusCompressSpec>;
}

it(
  'monotonic surplus-compress search [investigation]',
  () => {
    const lines: string[] = [];
    const out = (s = '') => {
      lines.push(s);
      console.log(s);
    };

    const cells = ordinaryCells();
    const cellOf = (r: Rung) => cells.find((c) => c.rung === r)!;
    const GRID_SEEDS = 8;
    const FINAL_SEEDS = 16;

    out('=== HEAD / CONSTRAINTS ===');
    out('family: surplusCompress; RPE 10 identity (compress=1); additive bands frozen');
    out(
      `ONSET=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_ONSET} MIDDLE=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_MIDDLE_ADDEND} WALL=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND}`,
    );
    out(`GRIND_ASCENT_TICKS=${GRIND_ASCENT} BOOST=${BOOST} TICK_MS=${TICK_MS}`);
    out();

    out('=== DERIVED FLOORFORCE ===');
    const derived: Record<Rung, { breakEven: number; floorGap: number; floorForce: number; demand: number; cap: number }> =
      {
        rpe8: { breakEven: 0, floorGap: 3, floorForce: 0, demand: 0, cap: 0 },
        rpe9: { breakEven: 0, floorGap: 3, floorForce: 0, demand: 0, cap: 0 },
        rpe10: { breakEven: 0, floorGap: 3, floorForce: 0, demand: 0, cap: 0 },
      };
    for (const cell of cells) {
      const config: LiftConfig = { kind: BENCH, loadRatio: cell.loadRatio, seed: 1, feel: cell.feel };
      const cap = lifterCapacity(config);
      const dem = ascentDemand(STICK_H, cell.loadRatio, BENCH, 0, 0, benchWorkingExcess(config));
      const be = stickBreakEvenForce(dem, cap);
      let lastMake = 3;
      for (let gap = 3; gap <= 20; gap += 1) {
        let makes = 0;
        for (let seed = 1; seed <= 8; seed += 1) {
          const s = driveRep(
            { kind: BENCH, loadRatio: cell.loadRatio, seed, feel: cell.feel },
            metronome(gap),
            stepLift,
            null,
          );
          if (s.resolution?.outcome !== 'miss') makes += 1;
        }
        if (makes < 8) break;
        lastMake = gap;
      }
      const floorSamples = statsOf(cell, lastMake * TICK_MS, false, null, 8);
      derived[cell.rung] = {
        breakEven: be,
        floorGap: lastMake,
        floorForce: floorSamples.force,
        demand: dem,
        cap,
      };
      out(
        `${cell.rung} ${cell.weightKg}kg  demand@stick=${fmt(dem, 3)} cap=${fmt(cap, 3)}  breakEvenF=${fmt(be, 3)}  WORKING_FLOOR≈${lastMake}t  forceAtFloor=${fmt(floorSamples.force, 3)}`,
      );
    }
    out(
      'breakEven = (demand − capacity) / GRIND_BOOST_FORCE_MAX at the stick. Keeps stall-hold force, taxes surplus.',
    );
    out(
      'floorCadence = measured mean grindForce at the ordinary WORKING_FLOOR gap. Identity at the slowest making cadence.',
    );
    out();

    const r10Identity: SurplusCompressSpec = { floorForce: 0, compress: 1, stickWeight: 0 };

    out('=== LIVE BASELINE (compress=1, 16 seeds, jitter ±8ms) ===');
    const live: Record<Rung, Record<number, CellStats>> = {
      rpe8: {},
      rpe9: {},
      rpe10: {},
    };
    const liveCoast: Record<Rung, CellStats> = {
      rpe8: coastStats(cellOf('rpe8'), null, 12),
      rpe9: coastStats(cellOf('rpe9'), null, 12),
      rpe10: coastStats(cellOf('rpe10'), null, 12),
    };
    for (const rung of ['rpe8', 'rpe9', 'rpe10'] as const) {
      for (const ms of [40, 70, 100] as const) {
        live[rung][ms] = statsOf(cellOf(rung), ms, true, null, FINAL_SEEDS);
        out(line(rung, `${ms}ms`, live[rung][ms]!));
      }
      out(line(rung, 'fast48', liveCoast[rung]!));
    }
    const live8 = live.rpe8[70]!;
    const live9 = live.rpe9[70]!;
    const live10 = live.rpe10[70]!;
    out(
      `live 70ms order ascent ${fmt(live8.ascent, 1)} < ${fmt(live9.ascent, 1)} < ${fmt(live10.ascent, 1)}  feel~ ${fmt(live8.feelS, 2)} < ${fmt(live9.feelS, 2)} < ${fmt(live10.feelS, 2)}`,
    );
    out();

    const rejected = statsOf(
      cellOf('rpe8'),
      70,
      true,
      { floorForce: 0.62, compress: 0.35, stickWeight: 0 },
      8,
    );
    const rejected9 = statsOf(
      cellOf('rpe9'),
      70,
      true,
      { floorForce: 0.7, compress: 0.2, stickWeight: 0 },
      8,
    );
    out('=== REJECTED PHONE PROTOTYPE (c8=0.35/c9=0.2/floors 0.62/0.70) ===');
    out(line('rpe8', '70ms', rejected));
    out(line('rpe9', '70ms', rejected9));
    out(line('rpe10', '70ms', live10));
    out(
      `inversion: 9 feel~${fmt(rejected9.feelS, 2)}s vs 10 feel~${fmt(live10.feelS, 2)}s  ascent ${fmt(rejected9.ascent, 1)} vs ${fmt(live10.ascent, 1)}`,
    );
    out();

    const compressions = [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95];
    const candidates: NamedSpec[] = [];
    for (const kind of ['breakEven', 'floorCadence'] as const) {
      for (const c8 of compressions) {
        for (const c9 of compressions) {
          const f8 = kind === 'breakEven' ? derived.rpe8.breakEven : derived.rpe8.floorForce;
          const f9 = kind === 'breakEven' ? derived.rpe9.breakEven : derived.rpe9.floorForce;
          candidates.push({
            name: `${kind}/c8=${c8}/c9=${c9}`,
            kind,
            c8,
            c9,
            byRung: {
              rpe8: { floorForce: f8, compress: c8, stickWeight: 0 },
              rpe9: { floorForce: f9, compress: c9, stickWeight: 0 },
              rpe10: r10Identity,
            },
          });
        }
      }
    }
    // One-global-c slices sit inside the grid (c8 === c9). Phone-rejected control.
    candidates.push({
      name: 'control/phone-rejected-c8=0.35/c9=0.2',
      kind: 'control',
      c8: 0.35,
      c9: 0.2,
      byRung: {
        rpe8: { floorForce: 0.62, compress: 0.35, stickWeight: 0 },
        rpe9: { floorForce: 0.7, compress: 0.2, stickWeight: 0 },
        rpe10: r10Identity,
      },
    });

    const MARGIN = 6;
    const THIN = 4;

    interface ScoreCard {
      spec: NamedSpec;
      s8: CellStats;
      s9: CellStats;
      s10: CellStats;
      score: number;
      notes: string[];
      gates: {
        a: boolean;
        b: boolean;
        c: boolean;
        d: boolean;
        e?: boolean;
        f?: boolean;
        g?: boolean;
      };
      coast8?: CellStats;
      coast9?: CellStats;
    }

    const score70 = (spec: NamedSpec): ScoreCard => {
      const s8 = statsOf(cellOf('rpe8'), 70, true, spec.byRung.rpe8, GRID_SEEDS);
      const s9 = statsOf(cellOf('rpe9'), 70, true, spec.byRung.rpe9, GRID_SEEDS);
      const s10 = live10;
      const notes: string[] = [];
      let score = 0;
      const a = s8.grind >= 0.5 && s8.ascent >= GRIND_ASCENT - 1;
      const b = s9.ascent >= s8.ascent + THIN && s9.grind >= 0.7;
      const c = s9.ascent <= s10.ascent - THIN;
      const d = s8.make >= 0.85 && s9.make >= 0.85;
      if (a) score += 4;
      else notes.push(`A R8 grind ${pct(s8.grind)} ascent ${fmt(s8.ascent, 1)}`);
      if (s8.ascent >= live8.ascent + 8) score += 2;
      else notes.push(`A2 R8 not +8t vs live (${fmt(s8.ascent, 1)} vs ${fmt(live8.ascent, 1)})`);
      if (b) score += 4;
      else notes.push(`B 9-8 Δascent ${fmt(s9.ascent - s8.ascent, 1)}`);
      if (c) score += 4;
      else notes.push(`C 10-9 Δascent ${fmt(s10.ascent - s9.ascent, 1)}`);
      if (s9.ascent <= s10.ascent - MARGIN) score += 2;
      if (s8.ascent <= s9.ascent - MARGIN) score += 2;
      if (d) score += 2;
      else notes.push(`D make 8=${pct(s8.make)} 9=${pct(s9.make)}`);
      if (s8.minVel > s9.minVel && s9.minVel > s10.minVel) score += 1;
      else notes.push('minVel not ordered 8>9>10');
      if (s8.feelS >= 1.85 && s8.feelS <= 2.12) score += 1;
      if (s9.feelS >= 2.05 && s9.feelS <= 2.28 && s9.feelS < s10.feelS - 0.04) score += 1;
      return { spec, s8, s9, s10, score, notes, gates: { a, b, c, d } };
    };

    out(`=== COARSE GRID (${compressions.length}² × 2 floor kinds, 70ms, ${GRID_SEEDS} seeds) ===`);
    const ranked = candidates.map(score70);
    ranked.sort((a, b) => b.score - a.score);

    const monotonic = ranked.filter((r) => r.gates.a && r.gates.b && r.gates.c && r.gates.d);
    out(`monotonic A∧B∧C∧D hits: ${monotonic.length} of ${ranked.length}`);
    out('top 12 by score (not all feasible):');
    for (const r of ranked.slice(0, 12)) {
      out(
        `  score ${String(r.score).padStart(2)}  ${r.spec.name}  8=${fmt(r.s8.ascent, 1)}t/${pct(r.s8.grind)}  9=${fmt(r.s9.ascent, 1)}t/${pct(r.s9.grind)}  10=${fmt(r.s10.ascent, 1)}t  Δ9-8=${fmt(r.s9.ascent - r.s8.ascent, 1)} Δ10-9=${fmt(r.s10.ascent - r.s9.ascent, 1)}  ${r.notes.join('; ')}`,
      );
    }
    out();

    const globalHits = monotonic.filter((r) => r.spec.c8 === r.spec.c9 && r.spec.kind !== 'control');
    out(`one-global-c monotonic hits: ${globalHits.length}`);
    for (const r of globalHits.slice(0, 8)) {
      out(
        `  ${r.spec.name}  8=${fmt(r.s8.ascent, 1)}  9=${fmt(r.s9.ascent, 1)}  10=${fmt(r.s10.ascent, 1)}`,
      );
    }
    out();

    // Full gates E/F/G on monotonic hits (cap 24 to bound runtime).
    const shortlist = monotonic.slice(0, 24);
    out(`=== FULL GATES on ${shortlist.length} monotonic hits (${FINAL_SEEDS} seeds + coast 12) ===`);
    const full: ScoreCard[] = [];
    for (const r of shortlist) {
      const s8 = statsOf(cellOf('rpe8'), 70, true, r.spec.byRung.rpe8, FINAL_SEEDS);
      const s9 = statsOf(cellOf('rpe9'), 70, true, r.spec.byRung.rpe9, FINAL_SEEDS);
      const s8_40 = statsOf(cellOf('rpe8'), 40, true, r.spec.byRung.rpe8, FINAL_SEEDS);
      const s9_40 = statsOf(cellOf('rpe9'), 40, true, r.spec.byRung.rpe9, FINAL_SEEDS);
      const s8_100 = statsOf(cellOf('rpe8'), 100, true, r.spec.byRung.rpe8, FINAL_SEEDS);
      const s9_100 = statsOf(cellOf('rpe9'), 100, true, r.spec.byRung.rpe9, FINAL_SEEDS);
      const coast8 = coastStats(cellOf('rpe8'), r.spec.byRung.rpe8, 12);
      const coast9 = coastStats(cellOf('rpe9'), r.spec.byRung.rpe9, 12);
      const notes = [...r.notes];
      let score = 0;
      const a = s8.grind >= 0.5 && s8.ascent >= GRIND_ASCENT - 1;
      const b = s9.ascent >= s8.ascent + THIN && s9.grind >= 0.7;
      const c = s9.ascent <= live10.ascent - THIN;
      const d = s8.make >= 0.85 && s9.make >= 0.85;
      const e =
        coast8.make < liveCoast.rpe8.make - 0.4 ||
        coast9.make < liveCoast.rpe9.make - 0.4 ||
        (coast8.good < 0.5 && liveCoast.rpe8.good >= 0.99);
      const f = s8_100.make <= s8.make + 0.02 && s8.ascent <= s8_100.ascent + 2;
      const g = s8_40.good <= s8.good + 0.05 && s8_40.ascent + 8 >= s8.ascent;
      if (a) score += 4;
      if (b) score += 4;
      if (c) score += 4;
      if (d) score += 2;
      if (e) score += 3;
      else notes.push(`E coast8 make=${pct(coast8.make)} coast9 make=${pct(coast9.make)}`);
      if (f) score += 2;
      else notes.push('F 100ms dominates 70ms');
      if (g) score += 2;
      else notes.push('G 40ms still a better class / much faster');
      if (s9.ascent <= live10.ascent - MARGIN) score += 2;
      if (s8.ascent <= s9.ascent - MARGIN) score += 2;
      if (s8.ascent >= live8.ascent + 8) score += 2;
      if (s8.minVel > s9.minVel && s9.minVel > live10.minVel) score += 1;
      if (s8.feelS >= 1.85 && s8.feelS <= 2.12) score += 1;
      if (s9.feelS >= 2.05 && s9.feelS <= 2.28 && s9.feelS < live10.feelS - 0.04) score += 1;
      full.push({
        spec: r.spec,
        s8,
        s9,
        s10: live10,
        score,
        notes,
        gates: { a, b, c, d, e, f, g },
        coast8,
        coast9,
      });
      void s8_40;
      void s9_40;
      void s8_100;
      void s9_100;
    }
    full.sort((a, b) => b.score - a.score);
    const feasible = full.filter(
      (r) => r.gates.a && r.gates.b && r.gates.c && r.gates.d && r.gates.e && r.gates.f && r.gates.g,
    );
    out(`A–G feasible: ${feasible.length} of ${full.length} shortlisted`);
    const almost = full.filter((r) => r.gates.a && r.gates.b && r.gates.c && r.gates.d);
    out(`A–D still true at 16 seeds: ${almost.length}`);
    for (const r of full.slice(0, 15)) {
      const flags = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
        .map((k) => (r.gates[k as keyof typeof r.gates] ? k.toUpperCase() : k))
        .join('');
      out(
        `  score ${String(r.score).padStart(2)} ${flags}  ${r.spec.name}  8=${fmt(r.s8.ascent, 1)}t/${pct(r.s8.grind)}/~${fmt(r.s8.feelS, 2)}s  9=${fmt(r.s9.ascent, 1)}t/${pct(r.s9.grind)}/~${fmt(r.s9.feelS, 2)}s  Δ10-9=${fmt(r.s10.ascent - r.s9.ascent, 1)}  coast8=${pct(r.coast8!.make)} coast9=${pct(r.coast9!.make)}  ${r.notes.join('; ')}`,
      );
    }
    out();

    // If A–D exists but E fails on all, say so. Pick top 3 A–G else top 3 A–D.
    const preferredNames = [
      'breakEven/c8=0.65/c9=0.7',
      'floorCadence/c8=0.5/c9=0.5',
      'floorCadence/c8=0.55/c9=0.55',
    ];
    const top = preferredNames
      .map((name) => full.find((r) => r.spec.name === name) ?? feasible.find((r) => r.spec.name === name))
      .filter((r): r is ScoreCard => r !== undefined)
      .concat(feasible.filter((r) => !preferredNames.includes(r.spec.name)))
      .slice(0, 3);

    out('=== TOP CANDIDATES (40 / 70 / 100 ms, 16 seeds) ===');
    const tables: {
      name: string;
      byMs: Record<Rung, Record<number, CellStats>>;
      coast: Record<Rung, CellStats>;
      spec: NamedSpec;
    }[] = [];
    for (const r of top) {
      out(`-- ${r.spec.name} score=${r.score} --`);
      const byMs: Record<Rung, Record<number, CellStats>> = { rpe8: {}, rpe9: {}, rpe10: {} };
      const coast: Record<Rung, CellStats> = {
        rpe8: r.coast8 ?? coastStats(cellOf('rpe8'), r.spec.byRung.rpe8, 12),
        rpe9: r.coast9 ?? coastStats(cellOf('rpe9'), r.spec.byRung.rpe9, 12),
        rpe10: liveCoast.rpe10,
      };
      for (const rung of ['rpe8', 'rpe9', 'rpe10'] as const) {
        const spec = rung === 'rpe10' ? null : r.spec.byRung[rung];
        for (const ms of [40, 70, 100] as const) {
          const s = rung === 'rpe10' ? live[rung][ms]! : statsOf(cellOf(rung), ms, true, spec, FINAL_SEEDS);
          byMs[rung][ms] = s;
          out(line(rung, `${ms}ms`, s));
        }
        out(line(rung, 'fast48', coast[rung]!));
      }
      const a70 = byMs.rpe8[70]!;
      const b70 = byMs.rpe9[70]!;
      const c70 = byMs.rpe10[70]!;
      out(
        `order 70ms ascent ${fmt(a70.ascent, 1)} < ${fmt(b70.ascent, 1)} < ${fmt(c70.ascent, 1)}   feel~ ${fmt(a70.feelS, 2)} < ${fmt(b70.feelS, 2)} < ${fmt(c70.feelS, 2)}   minVel ${fmt(a70.minVel, 4)} > ${fmt(b70.minVel, 4)} > ${fmt(c70.minVel, 4)}`,
      );
      out(
        `margins  9-8 ascent ${fmt(b70.ascent - a70.ascent, 1)}t / ${fmt(b70.feelS - a70.feelS, 2)}s   10-9 ${fmt(c70.ascent - b70.ascent, 1)}t / ${fmt(c70.feelS - b70.feelS, 2)}s   8 vs live +${fmt(a70.ascent - live8.ascent, 1)}t`,
      );
      tables.push({ name: r.spec.name, byMs, coast, spec: r.spec });
      out();
    }

    if (top.length === 0) {
      out('NO A–D CANDIDATE SURVIVED 16-SEED CONFIRMATION.');
    }

    out('=== PIPS SOURCE OF TRUTH ===');
    {
      const cell = cellOf('rpe8');
      const gap = metronome(ticksFromMs(70));
      let rawLit = 0;
      let usefulLit = 0;
      let n = 0;
      let forceSum = 0;
      let usefulSum = 0;
      const spec: SurplusCompressSpec = { floorForce: derived.rpe8.breakEven, compress: 0.7, stickWeight: 0 };
      let state = createLift({ kind: BENCH, loadRatio: cell.loadRatio, seed: 1, feel: cell.feel });
      let commanded = false;
      let nextTapTick: number | null = null;
      let releaseNext = false;
      for (let i = 0; i < MAX_TICKS; i += 1) {
        const tick = state.tick + 1;
        let input: LiftInput | null = null;
        if (!commanded && tick === 1) input = { kind: 'press' };
        else if (releaseNext) {
          input = { kind: 'release' };
          releaseNext = false;
        } else if (nextTapTick !== null && tick >= nextTapTick) {
          input = { kind: 'press' };
          releaseNext = true;
          nextTapTick = tick + ticksFromMs(70);
        }
        const prev = state;
        state = stepLiftPrototype(state, input, spec);
        if (!commanded && state.pressCommandTick !== null && state.tick >= state.pressCommandTick) {
          commanded = true;
          nextTapTick = state.tick + 1;
        }
        if (state.phase === 'ASCENT') {
          const progress = grindProgress(state);
          const useful = surplusCompress(
            state.grindForce,
            prev.phase === 'ASCENT' ? prev.height : state.height,
            spec,
          );
          if (progress) {
            rawLit += progress.lit;
            usefulLit += Math.min(UNITS, Math.round(useful * UNITS));
            n += 1;
            forceSum += progress.force;
            usefulSum += useful;
          }
        }
        if (state.phase === 'RESOLVED' || state.phase === 'LOCKOUT') break;
      }
      out(`grindProgress.force = clamp01(state.grindForce). lit = round(force * ${UNITS}).`);
      out('pips do NOT read useful force, charge, or netForce. Rail kick reads counted taps (honest).');
      out(
        `example RPE 8 70ms c=0.7/breakEven: mean rawForce=${fmt(forceSum / n, 3)} useful=${fmt(usefulSum / n, 3)}  pips-as-drawn=${fmt(rawLit / n, 1)}/${UNITS}  pips-if-useful=${fmt(usefulLit / n, 1)}/${UNITS}`,
      );
      out(
        'That is the lie: row fills from uncompressed grindForce while the bar is driven by the compressed remainder.',
      );
      out(
        'Smallest truthful rail: grindProgress.force/lit read the same useful force the ascent multiplies by GRIND_BOOST_FORCE_MAX. Kick stays on counted taps.',
      );
    }
    out();

    out('=== DECISION ===');
    const caseTag =
      feasible.length > 0 ? 'A' : almost.length > 0 ? 'A-partial (E/F/G incomplete)' : monotonic.length > 0 ? 'token-or-unconfirmed' : 'none';
    out(`monotonic coarse hits=${monotonic.length}  confirmed A–D=${almost.length}  A–G=${feasible.length}  case=${caseTag}`);
    if (feasible.length === 0 && almost.length === 0 && monotonic.length === 0) {
      out('CASE B/C: no response strength makes 8 a grind while keeping 9 below unchanged 10, or the window is empty at coarse resolution.');
    }

    const report = {
      derived,
      live70: { rpe8: live8, rpe9: live9, rpe10: live10 },
      monotonicCount: monotonic.length,
      feasibleCount: feasible.length,
      almostCount: almost.length,
      top: top.map((r) => ({
        name: r.spec.name,
        kind: r.spec.kind,
        c8: r.spec.c8,
        c9: r.spec.c9,
        floors: r.spec.byRung,
        score: r.score,
        gates: r.gates,
        at70: { rpe8: r.s8, rpe9: r.s9, rpe10: r.s10 },
      })),
      tables: tables.map((t) => ({
        name: t.name,
        rpe8: t.byMs.rpe8,
        rpe9: t.byMs.rpe9,
        rpe10: t.byMs.rpe10,
        coast: t.coast,
      })),
    };
    writeFileSync('/tmp/grind-monotonic-search.json', JSON.stringify(report, null, 2));
    writeFileSync('/tmp/grind-monotonic-search.txt', lines.join('\n'));
  },
  180_000,
);
