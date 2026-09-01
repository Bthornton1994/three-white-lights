/**
 * Session A grind-response investigation. Measurement only.
 * Does not change tuning. Does not ship a mechanic. Not part of the suite
 * contract — run explicitly:
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
  grindProgress,
  lifterCapacity,
  stepLift,
  type LiftConfig,
  type LiftInput,
  type LiftState,
} from '../src/game/lift';
import {
  LIFT_TUNING,
  STICK_HEIGHT_FRAC,
  STICK_WIDTH,
  TICK_MS,
} from '../src/game/liftTuning';
import {
  EMPTY_FATIGUE_STATE,
  sessionFeel,
  type SessionFeel,
} from '../src/game/fatigue';
import { prescribeSession } from '../src/game/session';
import { SESSION_TUNING } from '../src/game/sessionTuning';

const BENCH = 'bench' as const;
const MAX_TICKS = 1200;
const E1RM_KG = 100;
const WORK_SETS = 3;
const REPS_PER_SET = 3;
const SEEDS = 12;
const HUMAN_MS = { MIN: 57, MAX: 81 } as const;
const FLOORS: Record<string, number[]> = {
  rpe8: [13, 11, 12, 13],
  rpe9: [10, 9, 9, 10],
  rpe10: [7, 7, 8, 8],
};
const GAPS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 20] as const;
const STICK_H = STICK_HEIGHT_FRAC.bench;
const STICK_W = STICK_WIDTH.bench;

interface Cell {
  readonly label: string;
  readonly rung: 'rpe8' | 'rpe9' | 'rpe10';
  readonly loadRatio: number;
  readonly feel: SessionFeel;
  readonly floor: number;
}

function reachableWorkingCells(): Cell[] {
  const sleeps = ['poor', 'ok', 'good'] as const;
  const sorenesses = ['sore', 'normal', 'fresh'] as const;
  const motivations = ['flat', 'steady', 'fired-up'] as const;
  const seen = new Set<string>();
  const all: { label: string; loadRatio: number; feel: SessionFeel }[] = [];
  for (const targetRpe of SESSION_TUNING.RPE_CHOICES) {
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
          const key = `${plan.loadRatio}|${feel.barSpeed}`;
          if (seen.has(key)) continue;
          seen.add(key);
          all.push({
            label: `session/rpe${targetRpe}/${plan.loadRatio.toFixed(4)}/${feel.barSpeed}`,
            loadRatio: plan.loadRatio,
            feel,
          });
        }
      }
    }
  }
  const cells: Cell[] = [];
  const idx: Record<string, number> = { rpe8: 0, rpe9: 0, rpe10: 0 };
  for (const row of all) {
    const m = /session\/(rpe8|rpe9|rpe10)\//.exec(row.label);
    if (!m) continue;
    const rung = m[1] as Cell['rung'];
    const i = idx[rung] ?? 0;
    cells.push({
      label: row.label,
      rung,
      loadRatio: row.loadRatio,
      feel: row.feel,
      floor: FLOORS[rung]?.[i] ?? 0,
    });
    idx[rung] = i + 1;
  }
  return cells;
}

interface AscentTrace {
  ticks: number;
  stallTicks: number;
  forceSum: number;
  chargeSum: number;
  netSum: number;
  atCeil: number;
  at90: number;
  minVel: number;
  maxForce: number;
  maxLit: number;
  peakHeight: number;
  ticksToCeil: number | null;
  ticksToStick: number | null;
  stickDwell: number;
  stickVelSum: number;
  stickMinVel: number;
  stickNetSum: number;
  forceAtTick10: number;
  forceAtTick20: number;
  velAtStick: number;
}

function emptyTrace(): AscentTrace {
  return {
    ticks: 0,
    stallTicks: 0,
    forceSum: 0,
    chargeSum: 0,
    netSum: 0,
    atCeil: 0,
    at90: 0,
    minVel: Infinity,
    maxForce: 0,
    maxLit: 0,
    peakHeight: 0,
    ticksToCeil: null,
    ticksToStick: null,
    stickDwell: 0,
    stickVelSum: 0,
    stickMinVel: Infinity,
    stickNetSum: 0,
    forceAtTick10: 0,
    forceAtTick20: 0,
    velAtStick: 0,
  };
}

type GapFor = () => number;

function driveTraced(
  config: LiftConfig,
  gapFor: GapFor,
  opts: { stopAfterAscentTicks?: number } = {},
): { final: LiftState; ascent: AscentTrace } {
  let state = createLift(config);
  let commanded = false;
  let nextTapTick: number | null = null;
  let releaseNext = false;
  const ascent = emptyTrace();
  for (let i = 0; i < MAX_TICKS; i += 1) {
    const tick = state.tick + 1;
    let input: LiftInput | null = null;
    if (!commanded) {
      if (tick === 1) input = { kind: 'press' };
    } else if (releaseNext) {
      input = { kind: 'release' };
      releaseNext = false;
    } else if (nextTapTick !== null && tick >= nextTapTick) {
      const stop =
        opts.stopAfterAscentTicks !== undefined &&
        state.phase === 'ASCENT' &&
        state.ascentTicks >= opts.stopAfterAscentTicks;
      if (!stop) {
        input = { kind: 'press' };
        releaseNext = true;
        nextTapTick = tick + gapFor();
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
      ascent.ticks += 1;
      ascent.forceSum += state.grindForce;
      ascent.chargeSum += state.grindCharge;
      ascent.netSum += state.netForce;
      if (state.grindForce >= 0.99) {
        ascent.atCeil += 1;
        if (ascent.ticksToCeil === null) ascent.ticksToCeil = ascent.ticks;
      }
      if (state.grindForce >= 0.9) ascent.at90 += 1;
      if (state.velocity < ascent.minVel) ascent.minVel = state.velocity;
      if (state.grindForce > ascent.maxForce) ascent.maxForce = state.grindForce;
      if (state.peakHeight > ascent.peakHeight) ascent.peakHeight = state.peakHeight;
      const prog = grindProgress(state);
      if (prog && prog.lit > ascent.maxLit) ascent.maxLit = prog.lit;
      if (ascent.ticks === 10) ascent.forceAtTick10 = state.grindForce;
      if (ascent.ticks === 20) ascent.forceAtTick20 = state.grindForce;
      const inStick = Math.abs(state.height - STICK_H) <= STICK_W;
      if (inStick) {
        ascent.stickDwell += 1;
        ascent.stickVelSum += state.velocity;
        ascent.stickNetSum += state.netForce;
        if (state.velocity < ascent.stickMinVel) ascent.stickMinVel = state.velocity;
      }
      if (ascent.ticksToStick === null && state.height >= STICK_H) {
        ascent.ticksToStick = ascent.ticks;
        ascent.velAtStick = state.velocity;
      }
    }
    if (state.phase === 'RESOLVED') break;
  }
  ascent.stallTicks = state.stallTicks;
  return { final: state, ascent };
}

function metronome(gap: number): GapFor {
  return () => gap;
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

function humanCadence(seed: number): GapFor {
  const draw = splitmix(seed);
  return () =>
    Math.max(
      LIFT_TUNING.GRIND_TAP_REFRACTORY_TICKS,
      Math.round((HUMAN_MS.MIN + draw() * (HUMAN_MS.MAX - HUMAN_MS.MIN)) / TICK_MS),
    );
}

function steadyCharge(gap: number): number {
  const d = LIFT_TUNING.GRIND_CHARGE_DECAY_PER_TICK;
  return 1 / (1 - d ** gap);
}

function meanSteadyCharge(gap: number): number {
  const d = LIFT_TUNING.GRIND_CHARGE_DECAY_PER_TICK;
  const post = steadyCharge(gap);
  let sum = 0;
  for (let k = 0; k < gap; k += 1) sum += post * d ** k;
  return sum / gap;
}

function ticksToReachCharge(target: number, gap: number): number {
  const d = LIFT_TUNING.GRIND_CHARGE_DECAY_PER_TICK;
  let c = 0;
  for (let t = 1; t <= 200; t += 1) {
    c *= d;
    if ((t - 1) % gap === 0) c += 1;
    if (c >= target) return t;
  }
  return -1;
}

function pct(n: number, d: number): string {
  if (d === 0) return '—';
  return `${((100 * n) / d).toFixed(0)}%`;
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function fmt(n: number, d = 3): string {
  return Number.isFinite(n) ? n.toFixed(d) : '—';
}

it(
  'maps grind response across RPE 8/9/10 cadences [investigation]',
  () => {
    const cells = reachableWorkingCells();
    const byRung = {
      rpe8: cells.filter((c) => c.rung === 'rpe8'),
      rpe9: cells.filter((c) => c.rung === 'rpe9'),
      rpe10: cells.filter((c) => c.rung === 'rpe10'),
    };
    if (byRung.rpe8.length !== 4 || byRung.rpe9.length !== 4 || byRung.rpe10.length !== 4) {
      throw new Error(
        `unexpected cell counts: 8=${byRung.rpe8.length} 9=${byRung.rpe9.length} 10=${byRung.rpe10.length}`,
      );
    }

    const decay = LIFT_TUNING.GRIND_CHARGE_DECAY_PER_TICK;
    const { HALF_SATURATION, CEILING } = LIFT_TUNING.GRIND_CHARGE;
    const boost = LIFT_TUNING.GRIND_BOOST_FORCE_MAX;
    const units = LIFT_TUNING.FEEDBACK.STAGE_COMMAND.GRIND_READOUT_UNITS;

    const analytical = GAPS.map((gap) => {
      const post = Math.min(steadyCharge(gap), CEILING);
      const meanC = Math.min(meanSteadyCharge(gap), CEILING);
      const fMean = grindForce(meanC);
      const fPost = grindForce(post);
      return {
        gap,
        tapsPerSec: 60 / gap,
        intervalMs: gap * TICK_MS,
        chargePostTap: steadyCharge(gap),
        chargeMean: meanSteadyCharge(gap),
        forcePost: fPost,
        forceMean: fMean,
        pipsLit: Math.min(units, Math.round(fMean * units)),
        saturates: steadyCharge(gap) >= CEILING,
        ticksToCeil: ticksToReachCharge(CEILING, gap),
        ticksTo90: ticksToReachCharge(
          (() => {
            // invert grindForce ~ 0.9
            const satCeil = CEILING / (CEILING + HALF_SATURATION);
            const targetSat = 0.9 * satCeil;
            return (targetSat * HALF_SATURATION) / (1 - targetSat);
          })(),
          gap,
        ),
      };
    });

    const staticRows = cells.map((cell) => {
      const config: LiftConfig = {
        kind: BENCH,
        loadRatio: cell.loadRatio,
        seed: 1,
        feel: cell.feel,
      };
      const capacity = lifterCapacity(config);
      const excess = benchWorkingExcess(config);
      const demand = ascentDemand(STICK_H, cell.loadRatio, BENCH, 0, 0, excess);
      const forces = [0, 0.5, 0.7, 0.8, 0.85, 0.9, 0.95, 1];
      const nets = Object.fromEntries(forces.map((f) => [String(f), capacity + boost * f - demand]));
      const vTarget = (capacity + boost - demand) * LIFT_TUNING.VELOCITY_PER_NET_FORCE;
      return {
        label: cell.label,
        rung: cell.rung,
        loadRatio: cell.loadRatio,
        barSpeed: cell.feel.barSpeed,
        floor: cell.floor,
        capacity,
        excess,
        demandAtStick: demand,
        baseMargin: demand - capacity,
        nets,
        forceToBreakEven: Math.max(0, (demand - capacity) / boost),
        mashVTarget: vTarget,
        mashTicksThroughStick: STICK_W * 2 / Math.max(vTarget, 1e-6),
      };
    });

    type CellGapRow = {
      label: string;
      rung: string;
      gap: number | 'human';
      n: number;
      makes: number;
      misses: number;
      grinds: number;
      goodLifts: number;
      stallRate: number;
      meanStall: number;
      meanAscent: number;
      meanForce: number;
      meanCharge: number;
      meanNet: number;
      fracCeil: number;
      frac90: number;
      meanMinVel: number;
      meanPeakH: number;
      meanMaxLit: number;
      meanMaxForce: number;
      meanTicksToCeil: number;
      ceilReached: number;
      meanTicksToStick: number;
      meanStickDwell: number;
      meanStickVel: number;
      meanStickMinVel: number;
      meanForce10: number;
      meanForce20: number;
    };

    const rows: CellGapRow[] = [];

    const record = (
      cell: Cell,
      gap: number | 'human',
      samples: { final: LiftState; ascent: AscentTrace }[],
    ) => {
      const n = samples.length;
      const makes = samples.filter((s) => s.final.resolution?.outcome !== 'miss').length;
      const misses = n - makes;
      const grinds = samples.filter((s) => s.final.resolution?.outcome === 'grind').length;
      const goodLifts = samples.filter((s) => s.final.resolution?.outcome === 'good-lift').length;
      const stalled = samples.filter((s) => s.final.stallTicks > 0).length;
      const ceilSamples = samples.filter((s) => s.ascent.ticksToCeil !== null);
      rows.push({
        label: cell.label,
        rung: cell.rung,
        gap,
        n,
        makes,
        misses,
        grinds,
        goodLifts,
        stallRate: stalled / n,
        meanStall: avg(samples.map((s) => s.final.stallTicks)),
        meanAscent: avg(samples.map((s) => s.final.ascentTicks)),
        meanForce: avg(samples.map((s) => (s.ascent.ticks ? s.ascent.forceSum / s.ascent.ticks : 0))),
        meanCharge: avg(samples.map((s) => (s.ascent.ticks ? s.ascent.chargeSum / s.ascent.ticks : 0))),
        meanNet: avg(samples.map((s) => (s.ascent.ticks ? s.ascent.netSum / s.ascent.ticks : 0))),
        fracCeil: avg(samples.map((s) => (s.ascent.ticks ? s.ascent.atCeil / s.ascent.ticks : 0))),
        frac90: avg(samples.map((s) => (s.ascent.ticks ? s.ascent.at90 / s.ascent.ticks : 0))),
        meanMinVel: avg(samples.map((s) => (Number.isFinite(s.ascent.minVel) ? s.ascent.minVel : 0))),
        meanPeakH: avg(samples.map((s) => s.ascent.peakHeight)),
        meanMaxLit: avg(samples.map((s) => s.ascent.maxLit)),
        meanMaxForce: avg(samples.map((s) => s.ascent.maxForce)),
        meanTicksToCeil: avg(ceilSamples.map((s) => s.ascent.ticksToCeil ?? 0)),
        ceilReached: ceilSamples.length / n,
        meanTicksToStick: avg(
          samples
            .filter((s) => s.ascent.ticksToStick !== null)
            .map((s) => s.ascent.ticksToStick ?? 0),
        ),
        meanStickDwell: avg(samples.map((s) => s.ascent.stickDwell)),
        meanStickVel: avg(
          samples.map((s) => (s.ascent.stickDwell ? s.ascent.stickVelSum / s.ascent.stickDwell : 0)),
        ),
        meanStickMinVel: avg(
          samples.map((s) => (Number.isFinite(s.ascent.stickMinVel) ? s.ascent.stickMinVel : 0)),
        ),
        meanForce10: avg(samples.map((s) => s.ascent.forceAtTick10)),
        meanForce20: avg(samples.map((s) => s.ascent.forceAtTick20)),
      });
    };

    for (const cell of cells) {
      for (const gap of GAPS) {
        const samples = [];
        for (let seed = 1; seed <= SEEDS; seed += 1) {
          const config: LiftConfig = {
            kind: BENCH,
            loadRatio: cell.loadRatio,
            seed,
            feel: cell.feel,
          };
          samples.push(driveTraced(config, metronome(gap)));
        }
        record(cell, gap, samples);
      }
      const humanSamples = [];
      for (let seed = 1; seed <= SEEDS; seed += 1) {
        const config: LiftConfig = {
          kind: BENCH,
          loadRatio: cell.loadRatio,
          seed,
          feel: cell.feel,
        };
        humanSamples.push(driveTraced(config, humanCadence(1000 + seed * 17)));
      }
      record(cell, 'human', humanSamples);
    }

    // Spike-then-coast: mash gap-3 for N ascent ticks, then stop.
    const COAST_NS = [8, 12, 16, 24, 32, 48] as const;
    type CoastRow = {
      rung: string;
      nAscent: number;
      n: number;
      makes: number;
      meanAscent: number;
      meanStall: number;
      meanPeakH: number;
    };
    const coastRows: CoastRow[] = [];
    for (const cell of cells) {
      for (const nAscent of COAST_NS) {
        let makes = 0;
        const ascents: number[] = [];
        const stalls: number[] = [];
        const peaks: number[] = [];
        for (let seed = 1; seed <= SEEDS; seed += 1) {
          const config: LiftConfig = {
            kind: BENCH,
            loadRatio: cell.loadRatio,
            seed,
            feel: cell.feel,
          };
          const { final } = driveTraced(config, metronome(3), { stopAfterAscentTicks: nAscent });
          if (final.resolution?.outcome !== 'miss') makes += 1;
          ascents.push(final.ascentTicks);
          stalls.push(final.stallTicks);
          peaks.push(final.peakHeight);
        }
        coastRows.push({
          rung: cell.rung,
          nAscent,
          n: SEEDS,
          makes,
          meanAscent: avg(ascents),
          meanStall: avg(stalls),
          meanPeakH: avg(peaks),
        });
      }
    }

    const rungAt = (rung: string, gap: number | 'human') =>
      rows.filter((r) => r.rung === rung && r.gap === gap);

    const summarise = (rung: string, gap: number | 'human') => {
      const rs = rungAt(rung, gap);
      const n = rs.reduce((a, r) => a + r.n, 0);
      const makes = rs.reduce((a, r) => a + r.makes, 0);
      const grinds = rs.reduce((a, r) => a + r.grinds, 0);
      const good = rs.reduce((a, r) => a + r.goodLifts, 0);
      const misses = rs.reduce((a, r) => a + r.misses, 0);
      return {
        rung,
        gap,
        n,
        makePct: makes / n,
        missPct: misses / n,
        grindPct: grinds / n,
        goodPct: good / n,
        meanStall: avg(rs.map((r) => r.meanStall)),
        meanAscent: avg(rs.map((r) => r.meanAscent)),
        meanForce: avg(rs.map((r) => r.meanForce)),
        meanNet: avg(rs.map((r) => r.meanNet)),
        fracCeil: avg(rs.map((r) => r.fracCeil)),
        frac90: avg(rs.map((r) => r.frac90)),
        meanMinVel: avg(rs.map((r) => r.meanMinVel)),
        meanPeakH: avg(rs.map((r) => r.meanPeakH)),
        meanMaxLit: avg(rs.map((r) => r.meanMaxLit)),
        meanTicksToCeil: avg(rs.map((r) => r.meanTicksToCeil)),
        ceilReached: avg(rs.map((r) => r.ceilReached)),
        meanTicksToStick: avg(rs.map((r) => r.meanTicksToStick)),
        meanStickDwell: avg(rs.map((r) => r.meanStickDwell)),
        meanStickVel: avg(rs.map((r) => r.meanStickVel)),
        meanStickMinVel: avg(rs.map((r) => r.meanStickMinVel)),
        meanForce10: avg(rs.map((r) => r.meanForce10)),
        meanForce20: avg(rs.map((r) => r.meanForce20)),
      };
    };

    const rungs = ['rpe8', 'rpe9', 'rpe10'] as const;
    const summary = rungs.flatMap((rung) => [
      ...GAPS.map((g) => summarise(rung, g)),
      summarise(rung, 'human'),
    ]);

    const bandwidth = rungs.map((rung) => {
      const floor = Math.max(...(FLOORS[rung] ?? [0]));
      const atFloor = summarise(rung, floor);
      const above = GAPS.filter((g) => g < floor);
      let flattenGap = above[above.length - 1] ?? 3;
      let flattenReason = 'already at refractory';
      for (const g of [...above].reverse()) {
        const s = summarise(rung, g);
        const makeDelta = s.makePct - atFloor.makePct;
        const ascentDelta = atFloor.meanAscent - s.meanAscent;
        if (makeDelta < 0.02 && Math.abs(ascentDelta) < 2 && s.meanStall < 0.5) {
          flattenGap = g;
          flattenReason = `makeΔ=${fmt(makeDelta, 3)} ascentΔ=${fmt(ascentDelta, 1)} stall=${fmt(s.meanStall, 1)}`;
        } else {
          break;
        }
      }
      const mash = summarise(rung, 3);
      const human = summarise(rung, 'human');
      const floorMin = Math.min(...(FLOORS[rung] ?? [0]));
      return {
        rung,
        floorMax: floor,
        floorMin,
        makeAtFloor: atFloor.makePct,
        stallAtFloor: atFloor.meanStall,
        ascentAtFloor: atFloor.meanAscent,
        grindAtFloor: atFloor.grindPct,
        flattenGap,
        flattenReason,
        flattenTapsPerSec: 60 / flattenGap,
        mashMake: mash.makePct,
        mashAscent: mash.meanAscent,
        mashStall: mash.meanStall,
        mashForce: mash.meanForce,
        mashCeil: mash.fracCeil,
        mashLit: mash.meanMaxLit,
        mashGrind: mash.grindPct,
        mashGood: mash.goodPct,
        mashStickDwell: mash.meanStickDwell,
        mashStickVel: mash.meanStickVel,
        mashMinVel: mash.meanMinVel,
        mashTicksToCeil: mash.meanTicksToCeil,
        humanMake: human.makePct,
        humanAscent: human.meanAscent,
        humanStall: human.meanStall,
        humanForce: human.meanForce,
        humanGrind: human.grindPct,
        humanGood: human.goodPct,
        humanStickDwell: human.meanStickDwell,
        humanCeil: human.fracCeil,
        humanTicksToCeil: human.meanTicksToCeil,
        usefulBandTicks: floor - flattenGap,
        usefulBandMs: (floor - flattenGap) * TICK_MS,
      };
    });

    const coastByRung = rungs.map((rung) => {
      const of = COAST_NS.map((nAscent) => {
        const rs = coastRows.filter((r) => r.rung === rung && r.nAscent === nAscent);
        const n = rs.reduce((a, r) => a + r.n, 0);
        const makes = rs.reduce((a, r) => a + r.makes, 0);
        return {
          nAscent,
          makePct: makes / n,
          meanAscent: avg(rs.map((r) => r.meanAscent)),
          meanStall: avg(rs.map((r) => r.meanStall)),
          meanPeakH: avg(rs.map((r) => r.meanPeakH)),
        };
      });
      return { rung, of };
    });

    const lines: string[] = [];
    const out = (s = '') => {
      lines.push(s);
      console.log(s);
    };

    out('=== HEAD TUNING ===');
    out(
      `ONSET=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_ONSET} MIDDLE=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_MIDDLE_ADDEND} WALL=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND}`,
    );
    out(
      `CUT=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_CUT_MARGIN} WALL_CUT=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_WALL_CUT_MARGIN} CEILING_MARGIN=${LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING}`,
    );
    out(
      `BOOST=${boost} DECAY=${decay} HALF=${HALF_SATURATION} CHARGE_CEIL=${CEILING} REFRACTORY=${LIFT_TUNING.GRIND_TAP_REFRACTORY_TICKS}`,
    );
    out(
      `STALL_VEL=${LIFT_TUNING.GRIND_STALL_VELOCITY} STALL_TICKS=${LIFT_TUNING.GRIND_STALL_TICKS} ASCENT_GRIND=${LIFT_TUNING.GRIND_ASCENT_TICKS}`,
    );
    out(
      `VELOCITY_PER_NET=${LIFT_TUNING.VELOCITY_PER_NET_FORCE} RESPONSE=${LIFT_TUNING.VELOCITY_RESPONSE} STICK_H=${STICK_H} STICK_W=${STICK_W}`,
    );
    out();

    out('=== ANALYTICAL TAP RATE → FORCE ===');
    out(
      'gap  t/s    ms    charge  force   pips  sat?  ticksToCeil  ticksTo0.9',
    );
    for (const a of analytical) {
      out(
        `${String(a.gap).padStart(3)}  ${a.tapsPerSec.toFixed(2).padStart(5)}  ${String(a.intervalMs).padStart(4)}  ${fmt(a.chargeMean, 3).padStart(6)}  ${fmt(a.forceMean, 3).padStart(6)}  ${String(a.pipsLit).padStart(4)}  ${a.saturates ? 'YES' : 'no '}  ${String(a.ticksToCeil).padStart(11)}  ${String(a.ticksTo90).padStart(10)}`,
      );
    }
    out();
    out(`boost max = ${boost}  stickH = ${STICK_H}  readout units = ${units}`);
    out(`HALF_SATURATION=${HALF_SATURATION} CEILING=${CEILING}  TICK_MS=${TICK_MS}`);
    out();

    out('=== STATIC STICK NET FORCE (capacity + boost*F − demand) ===');
    out('If net>0 the bar accelerates through the stick at that grindForce.');
    for (const s of staticRows) {
      const n = s.nets as Record<string, number>;
      out(
        `${s.label}  cap=${fmt(s.capacity, 3)} dem=${fmt(s.demandAtStick, 3)} excess=${fmt(s.excess, 4)} breakEvenF=${fmt(s.forceToBreakEven, 3)}` +
          `  net@0=${fmt(n['0'] ?? 0, 3)} @0.7=${fmt(n['0.7'] ?? 0, 3)} @0.9=${fmt(n['0.9'] ?? 0, 3)} @1=${fmt(n['1'] ?? 0, 3)}` +
          `  mashV=${fmt(s.mashVTarget, 4)} stickTicks@mash≈${fmt(s.mashTicksThroughStick, 1)}`,
      );
    }
    out();

    out(`=== DRIVEN REPS  seeds=${SEEDS}  cells=${cells.length} ===`);
    out(
      'rung   gap     make  grind  good  miss  stall  ascent  force  ceil%  pips  net    t2ceil  stickT  stickV',
    );
    for (const s of summary) {
      const gap = s.gap === 'human' ? 'human' : String(s.gap).padStart(2);
      out(
        `${s.rung}  ${gap.padStart(5)}  ${pct(s.makePct, 1).padStart(4)}  ${pct(s.grindPct, 1).padStart(5)}  ${pct(s.goodPct, 1).padStart(4)}  ${pct(s.missPct, 1).padStart(4)}  ${fmt(s.meanStall, 1).padStart(5)}  ${fmt(s.meanAscent, 1).padStart(6)}  ${fmt(s.meanForce, 3)}  ${pct(s.fracCeil, 1).padStart(5)}  ${fmt(s.meanMaxLit, 1).padStart(4)}  ${fmt(s.meanNet, 3)}  ${fmt(s.meanTicksToCeil, 1).padStart(6)}  ${fmt(s.meanStickDwell, 1).padStart(6)}  ${fmt(s.meanStickVel, 4)}`,
      );
    }
    out();

    out('=== PER-CELL MAKE% AT KEY CADENCES ===');
    out('cell                                          flr  +2   +1   flr  -1   -2    8    6    5    4    3  human');
    for (const cell of cells) {
      const at = (g: number | 'human') => {
        const r = rows.find((x) => x.label === cell.label && x.gap === g);
        return r ? pct(r.makes, r.n).padStart(4) : '  — ';
      };
      const f = cell.floor;
      out(
        `${cell.label.padEnd(44)} ${String(f).padStart(3)} ${at(f + 2)} ${at(f + 1)} ${at(f)} ${at(f - 1)} ${at(f - 2)} ${at(8)} ${at(6)} ${at(5)} ${at(4)} ${at(3)} ${at('human')}`,
      );
    }
    out();

    out('=== PER-CELL MEAN ASCENT TICKS (lower = faster bar) ===');
    out('cell                                          flr    +1    flr    -2     8     5     3  human');
    for (const cell of cells) {
      const at = (g: number | 'human') => {
        const r = rows.find((x) => x.label === cell.label && x.gap === g);
        return r ? fmt(r.meanAscent, 1).padStart(5) : '    —';
      };
      const f = cell.floor;
      out(
        `${cell.label.padEnd(44)} ${String(f).padStart(3)} ${at(f + 1)} ${at(f)} ${at(Math.max(3, f - 2))} ${at(8)} ${at(5)} ${at(3)} ${at('human')}`,
      );
    }
    out();

    out('=== PER-CELL STICK DWELL TICKS AT MASH / HUMAN / FLOOR ===');
    out('cell                                          flr   floor  mash3  human  mashV  floorV');
    for (const cell of cells) {
      const at = (g: number | 'human') => {
        const r = rows.find((x) => x.label === cell.label && x.gap === g);
        return r ? fmt(r.meanStickDwell, 1).padStart(6) : '     —';
      };
      const vel = (g: number | 'human') => {
        const r = rows.find((x) => x.label === cell.label && x.gap === g);
        return r ? fmt(r.meanStickVel, 4) : '     —';
      };
      const f = cell.floor;
      out(
        `${cell.label.padEnd(44)} ${String(f).padStart(3)} ${at(f)} ${at(3)} ${at('human')}  ${vel(3)} ${vel(f)}`,
      );
    }
    out();

    out('=== BANDWIDTH / SATURATION ===');
    for (const b of bandwidth) {
      out(
        `${b.rung}: floor ${b.floorMin}-${b.floorMax} ticks  make@floor=${pct(b.makeAtFloor, 1)} stall=${fmt(b.stallAtFloor, 1)} ascent=${fmt(b.ascentAtFloor, 1)} grind=${pct(b.grindAtFloor, 1)}`,
      );
      out(
        `       extra tapping stops moving make/ascent around gap ${b.flattenGap} (${b.flattenTapsPerSec.toFixed(1)} t/s); useful band ≈ ${b.usefulBandTicks} ticks (${fmt(b.usefulBandMs, 0)}ms); ${b.flattenReason}`,
      );
      out(
        `       mash(gap3): make=${pct(b.mashMake, 1)} grind=${pct(b.mashGrind, 1)} good=${pct(b.mashGood, 1)} ascent=${fmt(b.mashAscent, 1)} stall=${fmt(b.mashStall, 1)} force=${fmt(b.mashForce, 3)} ceil=${pct(b.mashCeil, 1)} t2ceil=${fmt(b.mashTicksToCeil, 1)} pips=${fmt(b.mashLit, 1)} stick=${fmt(b.mashStickDwell, 1)}t vel=${fmt(b.mashStickVel, 4)} minV=${fmt(b.mashMinVel, 4)}`,
      );
      out(
        `       human(57-81ms): make=${pct(b.humanMake, 1)} grind=${pct(b.humanGrind, 1)} good=${pct(b.humanGood, 1)} ascent=${fmt(b.humanAscent, 1)} stall=${fmt(b.humanStall, 1)} force=${fmt(b.humanForce, 3)} ceil=${pct(b.humanCeil, 1)} t2ceil=${fmt(b.humanTicksToCeil, 1)} stick=${fmt(b.humanStickDwell, 1)}t`,
      );
    }
    out();

    out('=== SPIKE-THEN-COAST (mash gap-3 for N ascent ticks, then stop) ===');
    out('rung   N    make   ascent  stall  peakH');
    for (const g of coastByRung) {
      for (const row of g.of) {
        out(
          `${g.rung}  ${String(row.nAscent).padStart(2)}  ${pct(row.makePct, 1).padStart(5)}  ${fmt(row.meanAscent, 1).padStart(6)}  ${fmt(row.meanStall, 1).padStart(5)}  ${fmt(row.meanPeakH, 3)}`,
        );
      }
    }
    out();

    out('=== HIGH-EFFORT SEPARATION (gap 3 vs human vs floor) ===');
    out('If RPE 8 and RPE 9 converge at mash, the human sentence cannot be bought from WORKING_FLOOR.');
    const mash8 = summarise('rpe8', 3);
    const mash9 = summarise('rpe9', 3);
    const mash10 = summarise('rpe10', 3);
    const hum8 = summarise('rpe8', 'human');
    const hum9 = summarise('rpe9', 'human');
    const hum10 = summarise('rpe10', 'human');
    out(
      `mash ascent  8=${fmt(mash8.meanAscent, 1)}  9=${fmt(mash9.meanAscent, 1)}  10=${fmt(mash10.meanAscent, 1)}  Δ9-8=${fmt(mash9.meanAscent - mash8.meanAscent, 1)}  Δ10-9=${fmt(mash10.meanAscent - mash9.meanAscent, 1)}`,
    );
    out(
      `mash stick   8=${fmt(mash8.meanStickDwell, 1)}  9=${fmt(mash9.meanStickDwell, 1)}  10=${fmt(mash10.meanStickDwell, 1)}`,
    );
    out(
      `mash minVel  8=${fmt(mash8.meanMinVel, 4)}  9=${fmt(mash9.meanMinVel, 4)}  10=${fmt(mash10.meanMinVel, 4)}`,
    );
    out(
      `mash grind%  8=${pct(mash8.grindPct, 1)}  9=${pct(mash9.grindPct, 1)}  10=${pct(mash10.grindPct, 1)}`,
    );
    out(
      `human ascent 8=${fmt(hum8.meanAscent, 1)}  9=${fmt(hum9.meanAscent, 1)}  10=${fmt(hum10.meanAscent, 1)}  Δ9-8=${fmt(hum9.meanAscent - hum8.meanAscent, 1)}`,
    );
    out(
      `human grind% 8=${pct(hum8.grindPct, 1)}  9=${pct(hum9.grindPct, 1)}  10=${pct(hum10.grindPct, 1)}`,
    );
    out(
      `human make%  8=${pct(hum8.makePct, 1)}  9=${pct(hum9.makePct, 1)}  10=${pct(hum10.makePct, 1)}`,
    );
    const visuallyMs = (mash9.meanAscent - mash8.meanAscent) * TICK_MS;
    out(`mash RPE9-RPE8 duration gap = ${fmt(visuallyMs, 0)}ms (GRIND_ASCENT_TICKS=${LIFT_TUNING.GRIND_ASCENT_TICKS} = ${LIFT_TUNING.GRIND_ASCENT_TICKS * TICK_MS}ms)`);
    out(`pips at mash: 8=${fmt(mash8.meanMaxLit, 1)} 9=${fmt(mash9.meanMaxLit, 1)} 10=${fmt(mash10.meanMaxLit, 1)} of ${units}`);

    const report = {
      headNote: 'grind-response investigation; no tuning changed',
      constants: {
        ONSET: LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_ONSET,
        MIDDLE: LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_MIDDLE_ADDEND,
        WALL: LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_WALL_ADDEND,
        CUT: LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_CUT_MARGIN,
        WALL_CUT: LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_WALL_CUT_MARGIN,
        MARGIN_CEILING: LIFT_TUNING.BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING,
        BOOST: boost,
        DECAY: decay,
        HALF_SATURATION,
        CEILING,
        REFRACTORY: LIFT_TUNING.GRIND_TAP_REFRACTORY_TICKS,
        STALL_VELOCITY: LIFT_TUNING.GRIND_STALL_VELOCITY,
        STALL_TICKS: LIFT_TUNING.GRIND_STALL_TICKS,
        ASCENT_GRIND_TICKS: LIFT_TUNING.GRIND_ASCENT_TICKS,
        READOUT_UNITS: units,
        VELOCITY_PER_NET_FORCE: LIFT_TUNING.VELOCITY_PER_NET_FORCE,
        VELOCITY_RESPONSE: LIFT_TUNING.VELOCITY_RESPONSE,
        STICK_H,
        STICK_W,
        TICK_MS,
      },
      floors: FLOORS,
      analytical,
      staticRows,
      summary,
      bandwidth,
      coastByRung,
      perCell: rows,
    };
    writeFileSync('/tmp/grind-response.json', JSON.stringify(report, null, 2));
    writeFileSync('/tmp/grind-response.txt', lines.join('\n'));
  },
  300_000,
);
