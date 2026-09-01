/**
 * Session A grind-response probe. Measurement + isolated prototype.
 * Does not change production tuning. Does not ship a mechanic.
 *
 *   npx vitest run tools/grind-response-probe.test.ts
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';

import {
  ascentDemand,
  benchWorkingExcess,
  createLift,
  grindForce,
  lifterCapacity,
  stepLift,
  type LiftConfig,
  type LiftInput,
  type LiftState,
} from '../src/game/lift';
import {
  LIFT_TUNING,
  STICK_HEIGHT_FRAC,
  TICK_MS,
} from '../src/game/liftTuning';
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
  surplusCompress,
  type SurplusCompressSpec,
} from './grindResponsePrototype';

const BENCH = 'bench' as const;
const MAX_TICKS = 1200;
const E1RM_KG = SESSION_TUNING.STARTING_E1RM.kilograms.bench;
const WORK_SETS = SESSION_TUNING.WORK_SETS;
const REPS_PER_SET = SESSION_TUNING.REPS_PER_SET;
const SEEDS = 16;
const CADENCE_MS = [40, 55, 70, 85, 100, 115, 130, 150] as const;
const JITTER_MS = 8;
const STICK_H = STICK_HEIGHT_FRAC.bench;

type Rung = 'rpe8' | 'rpe9' | 'rpe10';
type Stepper = (state: LiftState, input: LiftInput | null) => LiftState;

interface Cell {
  readonly label: string;
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
  const out: Cell[] = [];
  for (const rpe of [8, 9, 10] as const) {
    const plan = prescribeSession(E1RM_KG, BENCH, rpe, feel.readiness, WORK_SETS, REPS_PER_SET);
    out.push({
      label: `ordinary/rpe${rpe}/${plan.weightKg}kg/${plan.loadRatio.toFixed(4)}`,
      rung: `rpe${rpe}` as Rung,
      loadRatio: plan.loadRatio,
      feel,
      weightKg: plan.weightKg,
    });
  }
  return out;
}

function reachableWorkingCells(): Cell[] {
  const sleeps = ['poor', 'ok', 'good'] as const;
  const sorenesses = ['sore', 'normal', 'fresh'] as const;
  const motivations = ['flat', 'steady', 'fired-up'] as const;
  const seen = new Set<string>();
  const cells: Cell[] = [];
  for (const targetRpe of [8, 9, 10] as const) {
    for (const sleep of sleeps) {
      for (const soreness of sorenesses) {
        for (const motivation of motivations) {
          const feel = sessionFeel(EMPTY_FATIGUE_STATE, WORK_SETS + 2, {
            sleep,
            soreness,
            motivation,
          });
          const plan = prescribeSession(
            E1RM_KG,
            BENCH,
            targetRpe,
            feel.readiness,
            WORK_SETS,
            REPS_PER_SET,
          );
          const key = `${targetRpe}|${plan.loadRatio}|${feel.barSpeed}`;
          if (seen.has(key)) continue;
          seen.add(key);
          cells.push({
            label: `session/rpe${targetRpe}/${plan.loadRatio.toFixed(4)}/${feel.barSpeed}`,
            rung: `rpe${targetRpe}` as Rung,
            loadRatio: plan.loadRatio,
            feel,
            weightKg: plan.weightKg,
          });
        }
      }
    }
  }
  return cells;
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
  return Math.max(
    LIFT_TUNING.GRIND_TAP_REFRACTORY_TICKS,
    Math.round(ms / TICK_MS),
  );
}

type GapFn = (ascentTicks: number, registered: number) => number | null;

function metronome(gap: number): GapFn {
  return () => gap;
}

function jitteredMs(centerMs: number, jitterMs: number, seed: number): GapFn {
  const draw = splitmix(seed);
  return () =>
    ticksFromMs(centerMs + (draw() * 2 - 1) * jitterMs);
}

function patternFastThenStop(fastGap: number, stopAfterAscent: number): GapFn {
  return (ascent) => (ascent <= stopAfterAscent ? fastGap : null);
}

function patternFastThenSlow(fastGap: number, slowGap: number, switchAt: number): GapFn {
  return (ascent) => (ascent <= switchAt ? fastGap : slowGap);
}

function patternSlowThenFast(slowGap: number, fastGap: number, switchAt: number): GapFn {
  return (ascent) => (ascent <= switchAt ? slowGap : fastGap);
}

function patternBursty(burstGap: number, burstTaps: number, pauseTicks: number): GapFn {
  const cycle = burstTaps * burstGap + pauseTicks;
  return (_ascent, registered) => {
    const pos = registered === 0 ? 0 : (registered * burstGap) % cycle;
    return pos < burstTaps * burstGap ? burstGap : pauseTicks;
  };
}

interface AscentTrace {
  ticks: number;
  stallTicks: number;
  forceSum: number;
  usefulSum: number;
  chargeSum: number;
  netSum: number;
  atCeil: number;
  at90: number;
  minVel: number;
  stickTicks: number;
  stickVelSum: number;
  ticksToCeil: number;
  ticksToCeilFromCommand: number;
  registeredTaps: number;
  dispatchedTaps: number;
  lockoutTick: number | null;
  commandTick: number | null;
  launchForce: number;
  peakHeight: number;
}

function emptyTrace(): AscentTrace {
  return {
    ticks: 0,
    stallTicks: 0,
    forceSum: 0,
    usefulSum: 0,
    chargeSum: 0,
    netSum: 0,
    atCeil: 0,
    at90: 0,
    minVel: Infinity,
    stickTicks: 0,
    stickVelSum: 0,
    ticksToCeil: 0,
    ticksToCeilFromCommand: 0,
    registeredTaps: 0,
    dispatchedTaps: 0,
    lockoutTick: null,
    commandTick: null,
    launchForce: 0,
    peakHeight: 0,
  };
}

function driveRep(
  config: LiftConfig,
  gapFor: GapFn,
  stepper: Stepper,
  spec: SurplusCompressSpec | null,
): { final: LiftState; ascent: AscentTrace } {
  let state = createLift(config);
  let commanded = false;
  let nextTapTick: number | null = null;
  let releaseNext = false;
  const ascent = emptyTrace();
  let firstCeilAscent = false;
  let firstCeilCommand = false;
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
        ascent.dispatchedTaps += 1;
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
      ascent.commandTick = command;
    }
    if (state.grindForce >= 0.99 && !firstCeilCommand && commanded) {
      firstCeilCommand = true;
      ascent.ticksToCeilFromCommand = state.tick - (command ?? state.tick);
    }
    if (state.phase === 'ASCENT') {
      ascent.ticks += 1;
      const useful = spec
        ? surplusCompress(state.grindForce, prev.phase === 'ASCENT' ? prev.height : state.height, spec)
        : state.grindForce;
      ascent.forceSum += state.grindForce;
      ascent.usefulSum += useful;
      ascent.chargeSum += state.grindCharge;
      ascent.netSum += state.netForce;
      if (state.grindForce >= 0.99) {
        ascent.atCeil += 1;
        if (!firstCeilAscent) {
          firstCeilAscent = true;
          ascent.ticksToCeil = ascent.ticks;
        }
      }
      if (state.grindForce >= 0.9) ascent.at90 += 1;
      if (state.velocity < ascent.minVel) ascent.minVel = state.velocity;
      if (Math.abs(state.height - STICK_H) <= 0.22) {
        ascent.stickTicks += 1;
        ascent.stickVelSum += state.velocity;
      }
      if (state.peakHeight > ascent.peakHeight) ascent.peakHeight = state.peakHeight;
    }
    if (state.phase === 'LOCKOUT' && ascent.lockoutTick === null) {
      ascent.lockoutTick = state.tick;
      ascent.launchForce = state.launchForce;
    }
    if (state.phase === 'RESOLVED') break;
  }
  ascent.stallTicks = state.stallTicks;
  ascent.registeredTaps = state.grindTaps;
  return { final: state, ascent };
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pct(n: number, d = 1): string {
  if (d === 0) return '—';
  return `${((100 * n) / d).toFixed(0)}%`;
}

function fmt(n: number, d = 3): string {
  return Number.isFinite(n) ? n.toFixed(d) : '—';
}

interface Row {
  label: string;
  rung: string;
  cadence: string;
  n: number;
  makes: number;
  misses: number;
  grinds: number;
  goodLifts: number;
  stallRate: number;
  meanStall: number;
  meanAscent: number;
  meanLockoutMs: number;
  meanForce: number;
  meanUseful: number;
  meanCharge: number;
  fracCeil: number;
  meanMinVel: number;
  meanStick: number;
  meanTaps: number;
  meanDispatched: number;
  meanTicksToCeil: number;
  meanPeakH: number;
}

function recordRows(
  cell: Cell,
  cadence: string,
  samples: { final: LiftState; ascent: AscentTrace }[],
): Row {
  const n = samples.length;
  const makes = samples.filter((s) => s.final.resolution?.outcome !== 'miss').length;
  return {
    label: cell.label,
    rung: cell.rung,
    cadence,
    n,
    makes,
    misses: n - makes,
    grinds: samples.filter((s) => s.final.resolution?.outcome === 'grind').length,
    goodLifts: samples.filter((s) => s.final.resolution?.outcome === 'good-lift').length,
    stallRate: samples.filter((s) => s.final.stallTicks > 0).length / n,
    meanStall: avg(samples.map((s) => s.final.stallTicks)),
    meanAscent: avg(samples.map((s) => s.final.ascentTicks)),
    meanLockoutMs: avg(samples.map((s) => (s.ascent.lockoutTick ?? s.final.tick) * TICK_MS)),
    meanForce: avg(samples.map((s) => (s.ascent.ticks ? s.ascent.forceSum / s.ascent.ticks : 0))),
    meanUseful: avg(samples.map((s) => (s.ascent.ticks ? s.ascent.usefulSum / s.ascent.ticks : 0))),
    meanCharge: avg(samples.map((s) => (s.ascent.ticks ? s.ascent.chargeSum / s.ascent.ticks : 0))),
    fracCeil: avg(samples.map((s) => (s.ascent.ticks ? s.ascent.atCeil / s.ascent.ticks : 0))),
    meanMinVel: avg(samples.map((s) => (Number.isFinite(s.ascent.minVel) ? s.ascent.minVel : 0))),
    meanStick: avg(samples.map((s) => s.ascent.stickTicks)),
    meanTaps: avg(samples.map((s) => s.ascent.registeredTaps)),
    meanDispatched: avg(samples.map((s) => s.ascent.dispatchedTaps)),
    meanTicksToCeil: avg(samples.map((s) => s.ascent.ticksToCeilFromCommand)),
    meanPeakH: avg(samples.map((s) => s.ascent.peakHeight)),
  };
}

function summarise(rows: Row[]): Omit<Row, 'label' | 'cadence'> & { cadence: string } {
  const n = rows.reduce((a, r) => a + r.n, 0);
  const cadence = rows[0]?.cadence ?? '';
  return {
    rung: rows[0]?.rung ?? '',
    cadence,
    n,
    makes: rows.reduce((a, r) => a + r.makes, 0),
    misses: rows.reduce((a, r) => a + r.misses, 0),
    grinds: rows.reduce((a, r) => a + r.grinds, 0),
    goodLifts: rows.reduce((a, r) => a + r.goodLifts, 0),
    stallRate: avg(rows.map((r) => r.stallRate)),
    meanStall: avg(rows.map((r) => r.meanStall)),
    meanAscent: avg(rows.map((r) => r.meanAscent)),
    meanLockoutMs: avg(rows.map((r) => r.meanLockoutMs)),
    meanForce: avg(rows.map((r) => r.meanForce)),
    meanUseful: avg(rows.map((r) => r.meanUseful)),
    meanCharge: avg(rows.map((r) => r.meanCharge)),
    fracCeil: avg(rows.map((r) => r.fracCeil)),
    meanMinVel: avg(rows.map((r) => r.meanMinVel)),
    meanStick: avg(rows.map((r) => r.meanStick)),
    meanTaps: avg(rows.map((r) => r.meanTaps)),
    meanDispatched: avg(rows.map((r) => r.meanDispatched)),
    meanTicksToCeil: avg(rows.map((r) => r.meanTicksToCeil)),
    meanPeakH: avg(rows.map((r) => r.meanPeakH)),
  };
}

function lineOf(s: ReturnType<typeof summarise> | Row): string {
  const make = pct(s.makes, s.n);
  const grind = pct(s.grinds, s.n);
  const good = pct(s.goodLifts, s.n);
  const miss = pct(s.misses, s.n);
  return `${String(s.rung).padEnd(6)} ${String(s.cadence).padStart(8)}  ${make.padStart(4)}  ${grind.padStart(5)}  ${good.padStart(4)}  ${miss.padStart(4)}  ${fmt(s.meanStall, 1).padStart(5)}  ${fmt(s.meanAscent, 1).padStart(6)}  ${fmt(s.meanLockoutMs / 1000, 2).padStart(5)}s  F=${fmt(s.meanForce, 3)} U=${fmt(s.meanUseful, 3)} ceil=${pct(s.fracCeil, 1).padStart(4)} taps=${fmt(s.meanTaps, 1)}`;
}

function sampleCell(
  cell: Cell,
  seed: number,
  gapFor: GapFn,
  spec: SurplusCompressSpec | null,
): { final: LiftState; ascent: AscentTrace } {
  const config: LiftConfig = {
    kind: BENCH,
    loadRatio: cell.loadRatio,
    seed,
    feel: cell.feel,
  };
  const stepper: Stepper = spec
    ? (st, input) => stepLiftPrototype(st, input, spec)
    : stepLift;
  return driveRep(config, gapFor, stepper, spec);
}

function sampleCadence(
  cell: Cell,
  centerMs: number,
  jitter: boolean,
  spec: SurplusCompressSpec | null,
  seeds = SEEDS,
): { final: LiftState; ascent: AscentTrace }[] {
  const samples = [];
  for (let seed = 1; seed <= seeds; seed += 1) {
    const gapFor = jitter
      ? jitteredMs(centerMs, JITTER_MS, 4000 + seed * 31 + Math.round(centerMs))
      : metronome(ticksFromMs(centerMs));
    samples.push(sampleCell(cell, seed, gapFor, spec));
  }
  return samples;
}

it(
  'grind-response probe: reproduce, curve, prototype [investigation]',
  () => {
    const lines: string[] = [];
    const out = (s = '') => {
      lines.push(s);
      console.log(s);
    };

    const ordinary = ordinaryCells();
    const reachable = reachableWorkingCells();
    const current = stepLift;

    out('=== HEAD / ENGINE ===');
    out(`e1rm=${E1RM_KG} ordinary weights: ${ordinary.map((c) => `${c.rung} ${c.weightKg}kg`).join(', ')}`);
    out(
      `ONSET=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_ONSET} MIDDLE=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_MIDDLE_ADDEND} WALL=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND}`,
    );
    out(
      `BOOST=${LIFT_TUNING.GRIND_BOOST_FORCE_MAX} CEILING=${LIFT_TUNING.GRIND_CHARGE.CEILING} DECAY=${LIFT_TUNING.GRIND_CHARGE_DECAY_PER_TICK} REFRACTORY=${LIFT_TUNING.GRIND_TAP_REFRACTORY_TICKS} ticks (${LIFT_TUNING.GRIND_TAP_REFRACTORY_TICKS * TICK_MS}ms)`,
    );
    out(`TICK_MS=${TICK_MS}  40ms→${ticksFromMs(40)}t  55ms→${ticksFromMs(55)}t  70ms→${ticksFromMs(70)}t  100ms→${ticksFromMs(100)}t  150ms→${ticksFromMs(150)}t`);
    out();

    // Identity pin: compress=1 must match stepLift.
    out('=== IDENTITY PIN (compress=1 vs stepLift) ===');
    {
      const cell = ordinary[0]!;
      let mismatches = 0;
      let ticks = 0;
      const spec: SurplusCompressSpec = { floorForce: 0, compress: 1, stickWeight: 1 };
      for (let seed = 1; seed <= 4; seed += 1) {
        const gap = metronome(ticksFromMs(70));
        const a = driveRep(
          { kind: BENCH, loadRatio: cell.loadRatio, seed, feel: cell.feel },
          gap,
          current,
          null,
        );
        const b = driveRep(
          { kind: BENCH, loadRatio: cell.loadRatio, seed, feel: cell.feel },
          gap,
          (st, input) => stepLiftPrototype(st, input, spec),
          spec,
        );
        ticks += 1;
        const same =
          a.final.phase === b.final.phase &&
          a.final.resolution?.outcome === b.final.resolution?.outcome &&
          a.final.ascentTicks === b.final.ascentTicks &&
          a.final.stallTicks === b.final.stallTicks &&
          Math.abs(a.final.height - b.final.height) < 1e-6 &&
          Math.abs(a.final.velocity - b.final.velocity) < 1e-6;
        if (!same) {
          mismatches += 1;
          out(
            `  MISMATCH seed=${seed} cur=${a.final.resolution?.outcome}/${a.final.ascentTicks}t/${a.final.stallTicks}st h=${fmt(a.final.height)} proto=${b.final.resolution?.outcome}/${b.final.ascentTicks}t/${b.final.stallTicks}st h=${fmt(b.final.height)}`,
          );
        }
      }
      out(`  mismatches=${mismatches} of 4 (must be 0)`);
      if (mismatches !== 0) throw new Error('prototype identity pin failed');
    }
    out();

    // Static stick nets for ordinary cells.
    out('=== STATIC STICK NET (ordinary 120kg session) ===');
    for (const cell of ordinary) {
      const config: LiftConfig = { kind: BENCH, loadRatio: cell.loadRatio, seed: 1, feel: cell.feel };
      const cap = lifterCapacity(config);
      const excess = benchWorkingExcess(config);
      const demand = ascentDemand(STICK_H, cell.loadRatio, BENCH, 0, 0, excess);
      const boost = LIFT_TUNING.GRIND_BOOST_FORCE_MAX;
      const net = (f: number) => cap + boost * f - demand;
      out(
        `${cell.label}  cap=${fmt(cap, 3)} dem=${fmt(demand, 3)} excess=${fmt(excess, 4)}  net@0=${fmt(net(0), 3)} @0.7=${fmt(net(0.7), 3)} @1=${fmt(net(1), 3)} breakEvenF=${fmt(Math.max(0, (demand - cap) / boost), 3)}`,
      );
    }
    out();

    const allCurrentRows: Row[] = [];
    const runGrid = (
      cells: Cell[],
      spec: SurplusCompressSpec | null,
      jitter: boolean,
      tag: string,
    ): Row[] => {
      const rows: Row[] = [];
      for (const cell of cells) {
        for (const ms of CADENCE_MS) {
          const samples = sampleCadence(cell, ms, jitter, spec);
          rows.push(recordRows(cell, `${tag}${ms}ms`, samples));
        }
      }
      return rows;
    };

    out('=== REPRODUCTION (ordinary check-in, jitter ±8ms, 16 seeds) ===');
    out('rung   cadence    make grind good  miss  stall  ascent  lock    force');
    const repro = runGrid(ordinary, null, true, '');
    allCurrentRows.push(...repro);
    for (const row of repro) out(lineOf(row));
    out();
    out('per-rung jittered summary:');
    for (const rung of ['rpe8', 'rpe9', 'rpe10'] as const) {
      for (const ms of [40, 70, 100] as const) {
        const rs = repro.filter((r) => r.rung === rung && r.cadence === `${ms}ms`);
        out('  ' + lineOf(summarise(rs)));
      }
    }
    out();

    out('=== RESPONSE CURVES (reachable working cells, periodic, 16 seeds) ===');
    const curves = runGrid(reachable, null, false, 'p');
    allCurrentRows.push(...curves);
    out('rung   cadence    make grind good  miss  stall  ascent  lock    force');
    for (const rung of ['rpe8', 'rpe9', 'rpe10'] as const) {
      for (const ms of CADENCE_MS) {
        const rs = curves.filter((r) => r.rung === rung && r.cadence === `p${ms}ms`);
        out(lineOf(summarise(rs)));
      }
    }
    out();

    out('=== USEFUL CADENCE BAND ===');
    const bandFor = (rung: Rung) => {
      const byMs = CADENCE_MS.map((ms) => {
        const s = summarise(curves.filter((r) => r.rung === rung && r.cadence === `p${ms}ms`));
        return { ms, s };
      });
      const mash = byMs[0]!.s;
      // Walk slow → fast. The first cadence that still makes ≥95% is the
      // slowest reliable make. If the slowest tested cadence still makes,
      // the miss wall is beyond the probed range (report it as such).
      let slowestReliable = byMs[0]!.ms;
      let missWallInRange = false;
      for (const row of [...byMs].reverse()) {
        if (row.s.makes / row.s.n >= 0.95) {
          slowestReliable = row.ms;
          missWallInRange = row.ms !== byMs[byMs.length - 1]!.ms;
          break;
        }
        missWallInRange = true;
      }
      // Fastest cadence at which extra tapping still changes the outcome
      // (make / grind / duration). 40ms and 55ms share the 3-tick refractory
      // so they are identical; flatten stops at the first row that moves.
      let flattenMs = byMs[0]!.ms;
      for (const row of byMs) {
        const makeDelta = row.s.makes / row.s.n - mash.makes / mash.n;
        const ascentDelta = row.s.meanAscent - mash.meanAscent;
        const grindDelta = row.s.grinds / row.s.n - mash.grinds / mash.n;
        if (Math.abs(makeDelta) < 0.02 && Math.abs(ascentDelta) < 3 && Math.abs(grindDelta) < 0.05) {
          flattenMs = row.ms;
        } else {
          break;
        }
      }
      const at70 = byMs.find((r) => r.ms === 70)?.s;
      const at100 = byMs.find((r) => r.ms === 100)?.s;
      return {
        rung,
        slowestReliableMs: slowestReliable,
        flattenMs,
        bandMs: slowestReliable - flattenMs,
        missWallInRange,
        mashMake: mash.makes / mash.n,
        mashAscent: mash.meanAscent,
        mashGrind: mash.grinds / mash.n,
        at70make: at70 ? at70.makes / at70.n : 0,
        at70ascent: at70?.meanAscent ?? 0,
        at70grind: at70 ? at70.grinds / at70.n : 0,
        at70stall: at70?.meanStall ?? 0,
        at100make: at100 ? at100.makes / at100.n : 0,
        at100ascent: at100?.meanAscent ?? 0,
        at100grind: at100 ? at100.grinds / at100.n : 0,
      };
    };
    const bands = (['rpe8', 'rpe9', 'rpe10'] as const).map(bandFor);
    for (const b of bands) {
      out(
        `${b.rung}: slowest 95% make ${b.slowestReliableMs}ms${b.missWallInRange ? '' : ' (miss wall beyond 150ms)'}; extra tapping stops mattering by ${b.flattenMs}ms; useful band ${b.bandMs}ms`,
      );
      out(
        `       40ms: make=${pct(b.mashMake, 1)} grind=${pct(b.mashGrind, 1)} ascent=${fmt(b.mashAscent, 1)}`,
      );
      out(
        `       70ms: make=${pct(b.at70make, 1)} grind=${pct(b.at70grind, 1)} ascent=${fmt(b.at70ascent, 1)} stall=${fmt(b.at70stall, 1)}`,
      );
      out(
        `       100ms: make=${pct(b.at100make, 1)} grind=${pct(b.at100grind, 1)} ascent=${fmt(b.at100ascent, 1)}`,
      );
    }
    out();

    out('=== SATURATION (ordinary, periodic) ===');
    for (const cell of ordinary) {
      for (const ms of [40, 70, 100] as const) {
        const samples = sampleCadence(cell, ms, false, null, 8);
        const t2c = avg(samples.map((s) => s.ascent.ticksToCeilFromCommand));
        const frac = avg(samples.map((s) => (s.ascent.ticks ? s.ascent.atCeil / s.ascent.ticks : 0)));
        const force = avg(samples.map((s) => (s.ascent.ticks ? s.ascent.forceSum / s.ascent.ticks : 0)));
        const launch = avg(samples.map((s) => s.final.launchForce));
        out(
          `${cell.rung} ${ms}ms  launchF=${fmt(launch, 3)} meanF=${fmt(force, 3)} ticksToCeilFromCommand=${fmt(t2c, 1)} ascentFracAtCeil=${pct(frac, 1)} registered=${fmt(avg(samples.map((s) => s.ascent.registeredTaps)), 1)} dispatched=${fmt(avg(samples.map((s) => s.ascent.dispatchedTaps)), 1)}`,
        );
      }
    }
    out();

    out('=== SUSTAINED-EFFORT PATTERNS (ordinary, 12 seeds) ===');
    const patternSpecs: { name: string; gap: GapFn }[] = [
      { name: 'steady70', gap: metronome(ticksFromMs(70)) },
      { name: 'steady100', gap: metronome(ticksFromMs(100)) },
      { name: 'mash40', gap: metronome(ticksFromMs(40)) },
      { name: 'fast12-stop', gap: patternFastThenStop(3, 12) },
      { name: 'fast24-stop', gap: patternFastThenStop(3, 24) },
      { name: 'fast48-stop', gap: patternFastThenStop(3, 48) },
      { name: 'fast24-then-slow133', gap: patternFastThenSlow(3, 8, 24) },
      { name: 'slow133-then-fast24', gap: patternSlowThenFast(8, 3, 24) },
      { name: 'bursty3on12off', gap: patternBursty(3, 3, 12) },
    ];
    const patternRows: Row[] = [];
    for (const cell of ordinary) {
      for (const p of patternSpecs) {
        const samples = [];
        for (let seed = 1; seed <= 12; seed += 1) {
          samples.push(sampleCell(cell, seed, p.gap, null));
        }
        const row = recordRows(cell, p.name, samples);
        patternRows.push(row);
      }
    }
    out('rung   pattern              make grind good  miss  stall  ascent  lock');
    for (const row of patternRows) out(lineOf(row));
    out();

    out('=== STICKING REGION (ordinary, periodic 70ms vs 100ms vs 40ms) ===');
    for (const cell of ordinary) {
      const config: LiftConfig = { kind: BENCH, loadRatio: cell.loadRatio, seed: 1, feel: cell.feel };
      const cap = lifterCapacity(config);
      const dem = ascentDemand(STICK_H, cell.loadRatio, BENCH, 0, 0, benchWorkingExcess(config));
      out(`${cell.label}  demand@stick=${fmt(dem, 3)} cap=${fmt(cap, 3)} margin=${fmt(dem - cap, 3)}`);
      for (const ms of [40, 70, 100] as const) {
        const samples = sampleCadence(cell, ms, false, null, 8);
        out(
          `  ${ms}ms  stickTicks=${fmt(avg(samples.map((s) => s.ascent.stickTicks)), 1)} minVel=${fmt(avg(samples.map((s) => (Number.isFinite(s.ascent.minVel) ? s.ascent.minVel : 0))), 4)} stall=${fmt(avg(samples.map((s) => s.final.stallTicks)), 1)}`,
        );
      }
    }
    out();

    out('=== REALISTIC-THUMB MISS @ ~70ms jittered (reachable + ordinary) ===');
    for (const rung of ['rpe8', 'rpe9', 'rpe10'] as const) {
      const ord = repro.filter((r) => r.rung === rung && r.cadence === '70ms');
      const reach = runGrid(
        reachable.filter((c) => c.rung === rung),
        null,
        true,
        'j',
      ).filter((r) => r.cadence === 'j70ms');
      const o = summarise(ord);
      const r = summarise(reach);
      out(
        `${rung} ordinary 70ms: make=${pct(o.makes, o.n)} miss=${pct(o.misses, o.n)} grind=${pct(o.grinds, o.n)} stall=${fmt(o.meanStall, 1)} n=${o.n}`,
      );
      out(
        `${rung} reachable 70ms: make=${pct(r.makes, r.n)} miss=${pct(r.misses, r.n)} grind=${pct(r.grinds, r.n)} stall=${fmt(r.meanStall, 1)} n=${r.n}`,
      );
    }
    out();

    // Prototype search — ordinary cells, 8 seeds, 40/70/100.
    out('=== PROTOTYPE SEARCH (surplus compress, ordinary, 8 seeds) ===');
    type SpecNamed = { name: string; byRung: Record<Rung, SurplusCompressSpec> };
    const candidates: SpecNamed[] = [];
    const c8s = [0.35, 0.5, 0.65];
    const c9s = [0.2, 0.35, 0.5];
    const stickWs = [0, 0.85];
    for (const stickWeight of stickWs) {
      for (const c8 of c8s) {
        for (const c9 of c9s) {
          candidates.push({
            name: `c8=${c8}/c9=${c9}/c10=1/sw=${stickWeight}`,
            byRung: {
              rpe8: { floorForce: 0.62, compress: c8, stickWeight },
              rpe9: { floorForce: 0.7, compress: c9, stickWeight },
              rpe10: { floorForce: 0.79, compress: 1, stickWeight },
            },
          });
        }
      }
    }
    const scoreOf = (byRung: Record<Rung, SurplusCompressSpec>): { score: number; notes: string[] } => {
      const notes: string[] = [];
      let score = 0;
      const at = (rung: Rung, ms: number) => {
        const cell = ordinary.find((c) => c.rung === rung)!;
        return recordRows(cell, `${ms}`, sampleCadence(cell, ms, true, byRung[rung], 8));
      };
      const r8_70 = at('rpe8', 70);
      const r8_100 = at('rpe8', 100);
      const r8_40 = at('rpe8', 40);
      const r9_70 = at('rpe9', 70);
      const r9_100 = at('rpe9', 100);
      const r10_70 = at('rpe10', 70);
      if (r8_70.makes / r8_70.n >= 0.99) score += 3;
      else notes.push(`R8@70 make ${pct(r8_70.makes, r8_70.n)}`);
      if (r8_70.grinds / r8_70.n >= 0.5) score += 3;
      else notes.push(`R8@70 grind ${pct(r8_70.grinds, r8_70.n)}`);
      if (r8_70.meanStall < 20) score += 1;
      if (r8_100.makes / r8_100.n >= 0.85) score += 3;
      else notes.push(`R8@100 make ${pct(r8_100.makes, r8_100.n)}`);
      if (r9_70.makes / r9_70.n >= 0.85) score += 3;
      else notes.push(`R9@70 make ${pct(r9_70.makes, r9_70.n)}`);
      if (r9_70.meanStall > 0.5) score += 3;
      else notes.push(`R9@70 stall ${fmt(r9_70.meanStall, 1)}`);
      if (r9_70.grinds / r9_70.n >= 0.7) score += 2;
      else notes.push(`R9@70 grind ${pct(r9_70.grinds, r9_70.n)}`);
      if (r9_100.makes / r9_100.n >= 0.5 && r9_100.makes / r9_100.n < 1) score += 2;
      else notes.push(`R9@100 make ${pct(r9_100.makes, r9_100.n)}`);
      if (r10_70.makes / r10_70.n >= 0.85) score += 3;
      else notes.push(`R10@70 make ${pct(r10_70.makes, r10_70.n)}`);
      if (r8_40.meanAscent > r8_70.meanAscent - 8) score += 2;
      else notes.push(`R8 40ms still much faster (${fmt(r8_40.meanAscent, 1)} vs ${fmt(r8_70.meanAscent, 1)})`);
      if (r9_70.meanAscent > r8_70.meanAscent + 8) score += 2;
      else notes.push('R9 not slower than R8 at 70');
      return { score, notes };
    };

    const ranked = candidates.map((c) => ({ ...c, ...scoreOf(c.byRung) }));
    ranked.sort((a, b) => b.score - a.score);
    for (const c of ranked.slice(0, 8)) {
      out(`  score ${c.score}  ${c.name}  ${c.notes.length ? 'notes: ' + c.notes.join('; ') : 'hits gate'}`);
    }
    const winner = ranked[0]!;
    out(`WINNER ${winner.name} score=${winner.score}`);
    out();

    out('=== STALL SEARCH (RPE 9 hard surplus cap; RPE 8 held at c=0.35/sw=0) ===');
    const stallCandidates: SpecNamed[] = [];
    for (const floorForce of [0.62, 0.66, 0.7]) {
      for (const compress of [0, 0.08, 0.16]) {
        for (const stickWeight of [0, 0.9, 1]) {
          stallCandidates.push({
            name: `r9floor=${floorForce}/c=${compress}/sw=${stickWeight}`,
            byRung: {
              rpe8: { floorForce: 0.62, compress: 0.35, stickWeight: 0 },
              rpe9: { floorForce, compress, stickWeight },
              rpe10: { floorForce: 0.79, compress: 1, stickWeight: 0 },
            },
          });
        }
      }
    }
    const stallScore = (byRung: Record<Rung, SurplusCompressSpec>) => {
      const notes: string[] = [];
      let score = 0;
      const at = (rung: Rung, ms: number, n = 8) => {
        const cell = ordinary.find((c) => c.rung === rung)!;
        return recordRows(cell, `${ms}`, sampleCadence(cell, ms, true, byRung[rung], n));
      };
      const r8_70 = at('rpe8', 70);
      const r8_100 = at('rpe8', 100);
      const r9_70 = at('rpe9', 70);
      const r9_100 = at('rpe9', 100);
      const r10_70 = at('rpe10', 70);
      if (r8_70.makes === r8_70.n) score += 2;
      if (r8_70.grinds / r8_70.n >= 0.5) score += 2;
      if (r8_100.makes / r8_100.n >= 0.85) score += 2;
      else notes.push(`R8@100 make ${pct(r8_100.makes, r8_100.n)}`);
      if (r9_70.makes / r9_70.n >= 0.8) score += 3;
      else notes.push(`R9@70 make ${pct(r9_70.makes, r9_70.n)}`);
      if (r9_70.meanStall >= 6) score += 4;
      else if (r9_70.meanStall > 0) score += 2;
      else notes.push('R9@70 no stall');
      if (r9_70.grinds / r9_70.n >= 0.8) score += 1;
      if (r9_100.makes / r9_100.n >= 0.5 && r9_100.makes / r9_100.n < 1) score += 2;
      else notes.push(`R9@100 make ${pct(r9_100.makes, r9_100.n)}`);
      if (r10_70.makes / r10_70.n >= 0.85) score += 2;
      if (r9_70.meanAscent > r8_70.meanAscent + 10) score += 1;
      return {
        score,
        notes,
        r8_70,
        r8_100,
        r9_70,
        r9_100,
        r10_70,
      };
    };
    const stallRanked = stallCandidates.map((c) => ({ ...c, ...stallScore(c.byRung) }));
    stallRanked.sort((a, b) => b.score - a.score);
    for (const c of stallRanked.slice(0, 10)) {
      out(
        `  score ${c.score}  ${c.name}  R9@70 make=${pct(c.r9_70.makes, c.r9_70.n)} stall=${fmt(c.r9_70.meanStall, 1)} ascent=${fmt(c.r9_70.meanAscent, 1)}  R9@100 make=${pct(c.r9_100.makes, c.r9_100.n)}  ${c.notes.join('; ')}`,
      );
    }
    const stallWinner = stallRanked[0]!;
    out(`STALL WINNER ${stallWinner.name} score=${stallWinner.score}`);
    out();

    out('=== CURRENT vs PROTOTYPE (ordinary, jittered, 16 seeds) ===');
    const protoByRung = winner.byRung;
    out('side    rung   cadence    make grind good  miss  stall  ascent  lock    force');
    for (const ms of [40, 70, 100] as const) {
      for (const cell of ordinary) {
        const cur = recordRows(cell, `${ms}ms`, sampleCadence(cell, ms, true, null));
        const pro = recordRows(cell, `${ms}ms`, sampleCadence(cell, ms, true, protoByRung[cell.rung]));
        out(`CUR     ${lineOf(cur)}`);
        out(`PROTO   ${lineOf(pro)}`);
      }
    }
    out();

    out('=== PROTOTYPE STOP-MID-REP (ordinary, 12 seeds) ===');
    for (const cell of ordinary) {
      for (const p of [
        { name: 'fast24-stop', gap: patternFastThenStop(3, 24) },
        { name: 'fast48-stop', gap: patternFastThenStop(3, 48) },
        { name: 'steady70', gap: metronome(ticksFromMs(70)) },
      ]) {
        const samples = [];
        for (let seed = 1; seed <= 12; seed += 1) {
          samples.push(sampleCell(cell, seed, p.gap, protoByRung[cell.rung]));
        }
        out(`PROTO ${lineOf(recordRows(cell, p.name, samples))}`);
      }
    }
    out();

    out('=== INVARIANTS (current engine, production path) ===');
    const zeroTap = (rpe: number) => {
      const feel = ordinaryFeel();
      const plan = prescribeSession(E1RM_KG, BENCH, rpe, feel.readiness, WORK_SETS, REPS_PER_SET);
      let lost = 0;
      for (let seed = 1; seed <= 12; seed += 1) {
        let state = createLift({ kind: BENCH, loadRatio: plan.loadRatio, seed, feel });
        for (let i = 0; i < MAX_TICKS; i += 1) {
          const tick = state.tick + 1;
          const input: LiftInput | null = tick === 1 ? { kind: 'press' } : null;
          state = stepLift(state, input);
          if (state.phase === 'RESOLVED') break;
        }
        if (state.resolution?.outcome === 'miss') lost += 1;
      }
      return { rpe, load: plan.loadRatio, lost, n: 12 };
    };
    for (const rpe of [6, 7, 8]) {
      const z = zeroTap(rpe);
      out(`  zero-tap RPE ${rpe} (held descent only): lost ${z.lost}/${z.n}  loadRatio=${z.load.toFixed(4)}`);
    }

    // Production WORKING_FLOOR is the authority (lift.test.ts, re-driven at
    // 2f1e1e04): RPE 8 13/11/12/13, RPE 9 10/9/9/10, RPE 10 7/7/8/8.
    // This probe re-derives the ordinary-cell floor the same way: walk gap
    // fast → slow, last cadence that still makes every seed.
    const floorOf = (cell: Cell): number => {
      let lastMake = 3;
      for (let gap = 3; gap <= 20; gap += 1) {
        let makes = 0;
        const n = 8;
        for (let seed = 1; seed <= n; seed += 1) {
          const s = sampleCell(cell, seed, metronome(gap), null);
          if (s.final.resolution?.outcome !== 'miss') makes += 1;
        }
        if (makes < n) return lastMake;
        lastMake = gap;
      }
      return lastMake;
    };
    out('  WORKING_FLOOR ordinary (last 8/8-make gap, 3..20 ticks):');
    for (const cell of ordinary) {
      out(`    ${cell.rung} ${cell.weightKg}kg  floor≈${floorOf(cell)} ticks`);
    }

    // squat / deadlift: prototype stepper with spec still identity because kind!==bench.
    {
      let sqMismatch = 0;
      for (const kind of ['squat', 'deadlift'] as const) {
        const spec: SurplusCompressSpec = { floorForce: 0.5, compress: 0.2, stickWeight: 1 };
        for (let seed = 1; seed <= 3; seed += 1) {
          const config: LiftConfig = { kind, loadRatio: 0.85, seed };
          const gap = metronome(6);
          const a = driveRep(config, gap, current, null);
          const b = driveRep(config, gap, (st, input) => stepLiftPrototype(st, input, spec), spec);
          if (a.final.resolution?.outcome !== b.final.resolution?.outcome || a.final.ascentTicks !== b.final.ascentTicks) {
            sqMismatch += 1;
          }
        }
      }
      out(`  squat/deadlift prototype no-op mismatches=${sqMismatch} (must be 0)`);
    }

    out();
    out('=== ADDITIVE CONSTANTS UNCHANGED ===');
    out(
      `ONSET=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_ONSET} MIDDLE=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_MIDDLE_ADDEND} WALL=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND}`,
    );

    const report = {
      e1rm: E1RM_KG,
      ordinary: ordinary.map((c) => ({ rung: c.rung, kg: c.weightKg, loadRatio: c.loadRatio })),
      constants: {
        ONSET: LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_ONSET,
        MIDDLE: LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_MIDDLE_ADDEND,
        WALL: LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND,
      },
      bands,
      winner: { name: winner.name, score: winner.score, notes: winner.notes, byRung: winner.byRung },
      ranked: ranked.map((c) => ({ name: c.name, score: c.score, notes: c.notes })),
      stallWinner: {
        name: stallWinner.name,
        score: stallWinner.score,
        notes: stallWinner.notes,
        byRung: stallWinner.byRung,
        r9_70: {
          make: stallWinner.r9_70.makes / stallWinner.r9_70.n,
          stall: stallWinner.r9_70.meanStall,
          ascent: stallWinner.r9_70.meanAscent,
        },
        r9_100: { make: stallWinner.r9_100.makes / stallWinner.r9_100.n },
      },
    };
    writeFileSync('/tmp/grind-response-probe.json', JSON.stringify(report, null, 2));
    writeFileSync('/tmp/grind-response-probe.txt', lines.join('\n'));
  },
  300_000,
);
