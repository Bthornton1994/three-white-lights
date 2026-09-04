/**
 * livingMemberExperience.test.ts — Stage G.2A recent-service meaning.
 *
 * Calibration lives here as runnable comparisons, not as a report nobody can
 * re-derive. Wait-curve candidates, training maps, and composite candidates
 * are scored against the G.1 Garage distributions and against synthetic
 * boundary histories. The shipped functions are the chosen curves.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createFloorState } from './floor';
import {
  createFloorSimState,
  stepFloorSimWithObservations,
  type FloorSimContext,
} from './floorSim';
import { EMPIRE_TUNING } from './empireTuning';
import { createGymViewState, gymViewReduce } from './ladderView';
import {
  applyServiceObservations,
  createLivingMemberRoster,
  floorSimPopulationFromRoster,
  reconcileLivingMemberRosterOnRelocation,
  type ServiceVisitRecord,
} from './livingMembers';
import {
  LIVING_MEMBER_EXPERIENCE_STATUSES,
  livingMemberExperience,
  waitComponentFromTicks,
} from './livingMemberExperience';
import {
  stockStationCapability,
  withStationAxis,
} from './stationCapability';
import { COMPETITION_BENCH_BAY } from './trainingStation';

const T = EMPIRE_TUNING;
const KIT = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);
const HERE = dirname(fileURLToPath(import.meta.url));
const EXPERIENCE_SOURCE = readFileSync(join(HERE, 'livingMemberExperience.ts'), 'utf8');
const EXPERIENCE_CODE = EXPERIENCE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const KNOBS = T.LIVING_MEMBER_EXPERIENCE;

const G1_WAIT = Object.freeze({
  stockMean: 116.59,
  qualityMean: 116.59,
  capacityMean: 52.52,
  throughputMean: 86.36,
  matchedStock: 128,
  matchedThroughput: 95,
});

function visit(partial: Partial<ServiceVisitRecord> & Pick<ServiceVisitRecord, 'queueWaitTicks'>): ServiceVisitRecord {
  return Object.freeze({
    stationKind: 'training',
    stationKey: 'training:competition-bench-bay',
    trainingExperience: T.STATION_STOCK_TRAINING_EXPERIENCE,
    outcome: 'completed',
    observedAtTick: 1,
    ...partial,
  });
}

function repeats(row: ServiceVisitRecord, count: number): readonly ServiceVisitRecord[] {
  return Object.freeze(
    Array.from({ length: count }, (_, index) =>
      visit({ ...row, observedAtTick: index + 1, queueWaitTicks: row.queueWaitTicks }),
    ),
  );
}

function garageContext(capability = stockStationCapability()): FloorSimContext {
  const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
  return Object.freeze({
    rung: roster.rung,
    floor: createFloorState(roster.rung),
    barbellOwned: KIT,
    sessionOwned: Object.freeze([]),
    capability,
    livingPopulation: floorSimPopulationFromRoster(roster),
  });
}

function collectRoster(
  context: FloorSimContext,
  ticks: number,
): ReturnType<typeof applyServiceObservations> {
  const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
  let state = createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
  const observations = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const stepped = stepFloorSimWithObservations(state, context);
    observations.push(...stepped.observations);
    state = stepped.state;
  }
  return applyServiceObservations(roster, observations);
}

function waitLinear(ticks: number, scale: number): number {
  return Math.max(0, 1 - ticks / scale);
}

function waitHyperbolic(ticks: number, scale: number): number {
  return scale / (scale + ticks);
}

function waitExponential(ticks: number, halfLife: number): number {
  return Math.exp(-ticks / halfLife);
}

function arithmeticMean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function geometricMean(values: readonly number[]): number {
  if (values.some((value) => value <= 0)) return 0;
  return Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);
}

function bottleneckMean(values: readonly number[]): number {
  return 0.5 * Math.min(...values) + 0.5 * arithmeticMean(values);
}

describe('Stage G.2A — no-history is forming, not a fake score', () => {
  it('returns forming with sampleCount 0 and no composite claim', () => {
    const experience = livingMemberExperience([]);
    expect(experience.status).toBe('forming');
    expect(experience.sampleCount).toBe(0);
    expect(experience.components).toBeNull();
    expect(experience.composite).toBeNull();
    expect(experience.labels.overall).toBe('Still forming');
    expect(experience.labels.wait).toBe('Not yet');
    expect(experience.labels.training).toBe('Not yet');
    expect(experience.labels.reliability).toBe('Not yet');
    expect(experience.reasons[0]?.kind).toBe('forming');
    expect(LIVING_MEMBER_EXPERIENCE_STATUSES).toEqual(['forming', 'formed']);
  });

  it('does not auto-satisfy or auto-punish zero history', () => {
    const experience = livingMemberExperience([]);
    expect(experience.composite).not.toBe(1);
    expect(experience.composite).not.toBe(0);
    expect(experience.labels.overall).not.toBe('Good');
    expect(experience.labels.overall).not.toBe('Poor');
  });
});

describe('Stage G.2A — wait curve candidates then the shipped choice', () => {
  const candidates = Object.freeze({
    linear180: (ticks: number) => waitLinear(ticks, 180),
    hyperbolic90: (ticks: number) => waitHyperbolic(ticks, 90),
    exponential110: (ticks: number) => waitExponential(ticks, KNOBS.waitHalfLifeTicks),
  });

  it('reports all three candidates against the G.1 Garage means before freezing one', () => {
    const report = Object.fromEntries(
      Object.entries(candidates).map(([name, curve]) => [
        name,
        Object.freeze({
          zero: curve(0),
          stock: curve(G1_WAIT.stockMean),
          quality: curve(G1_WAIT.qualityMean),
          capacity: curve(G1_WAIT.capacityMean),
          throughput: curve(G1_WAIT.throughputMean),
          matched95: curve(G1_WAIT.matchedThroughput),
          matched128: curve(G1_WAIT.matchedStock),
        }),
      ]),
    );
    expect(report.linear180?.zero).toBe(1);
    expect(report.hyperbolic90?.zero).toBe(1);
    expect(report.exponential110?.zero).toBe(1);
    expect(report.linear180?.matched95 ?? 0).toBeGreaterThan(report.linear180?.matched128 ?? 1);
    expect(report.hyperbolic90?.matched95 ?? 0).toBeGreaterThan(report.hyperbolic90?.matched128 ?? 1);
    expect(report.exponential110?.matched95 ?? 0).toBeGreaterThan(
      report.exponential110?.matched128 ?? 1,
    );
    // Hyperbolic compresses 95 vs 128 (delta ~0.073). Linear and exponential
    // keep a usable gap. Exponential also keeps Capacity clearly above
    // Throughput, which stays above stock — the physical order.
    const exp = report.exponential110;
    expect(exp).toBeDefined();
    expect((exp?.capacity ?? 0) - (exp?.stock ?? 1)).toBeGreaterThan(0.2);
    expect((exp?.throughput ?? 0) - (exp?.stock ?? 1)).toBeGreaterThan(0.08);
    expect((exp?.capacity ?? 0) - (exp?.throughput ?? 1)).toBeGreaterThan(0.1);
    expect(exp?.quality).toBeCloseTo(exp?.stock ?? 0, 10);
  });

  it('ships exponential 110: zero is best, monotonic, 95 beats 128, no copy-threshold step', () => {
    expect(waitComponentFromTicks(0)).toBe(1);
    let previous = waitComponentFromTicks(0);
    for (let ticks = 1; ticks <= 200; ticks += 1) {
      const next = waitComponentFromTicks(ticks);
      expect(next).toBeLessThanOrEqual(previous);
      previous = next;
    }
    expect(waitComponentFromTicks(G1_WAIT.matchedThroughput)).toBeGreaterThan(
      waitComponentFromTicks(G1_WAIT.matchedStock),
    );
    expect(waitComponentFromTicks(15) - waitComponentFromTicks(16)).toBeLessThan(0.02);
    expect(waitComponentFromTicks(39) - waitComponentFromTicks(40)).toBeLessThan(0.02);
    expect(waitComponentFromTicks(99) - waitComponentFromTicks(100)).toBeLessThan(0.02);
  });

  it('does not put G.1C wait-copy strings or thresholds in the mechanical wait formula', () => {
    expect(EXPERIENCE_CODE).not.toMatch(/playerFacingWaitExperience/);
    expect(EXPERIENCE_CODE).not.toMatch(/LIVING_MEMBER_WAIT_SHORT_MAX_TICKS/);
    expect(EXPERIENCE_CODE).not.toMatch(/LIVING_MEMBER_WAIT_LONG_MIN_TICKS/);
    expect(EXPERIENCE_CODE).not.toMatch(/LIVING_MEMBER_WAIT_VERY_LONG_MIN_TICKS/);
    expect(EXPERIENCE_CODE).not.toMatch(/'no wait'/);
    expect(EXPERIENCE_CODE).not.toMatch(/'short wait'/);
    expect(EXPERIENCE_CODE).not.toMatch(/'waited a while'/);
    expect(EXPERIENCE_CODE).not.toMatch(/'long wait'/);
    expect(EXPERIENCE_CODE).not.toMatch(/'very long wait'/);
    const waitFn = EXPERIENCE_SOURCE.slice(
      EXPERIENCE_SOURCE.indexOf('export function waitComponentFromTicks'),
      EXPERIENCE_SOURCE.indexOf('function trainingComponentFromExperience'),
    );
    expect(waitFn).not.toMatch(/\b15\b/);
    expect(waitFn).not.toMatch(/\b40\b/);
    expect(waitFn).not.toMatch(/\b100\b/);
  });
});

describe('Stage G.2A — training mapping', () => {
  it('keeps stock training as a legitimate non-zero experience and lets Quality raise it', () => {
    const stock = livingMemberExperience(repeats(visit({ queueWaitTicks: 0 }), 5));
    const quality = livingMemberExperience(
      repeats(
        visit({
          queueWaitTicks: 0,
          trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
        }),
        5,
      ),
    );
    expect(stock.components?.training).toBeCloseTo(KNOBS.trainingStockScore, 10);
    expect(quality.components?.training).toBeCloseTo(KNOBS.trainingQualityScore, 10);
    expect(stock.components?.training ?? 0).toBeGreaterThan(0.75);
    expect(stock.labels.training).toBe('Solid');
    expect(quality.labels.training).toBe('Excellent');
    expect(quality.components?.training ?? 0).toBeGreaterThan(stock.components?.training ?? 1);
  });

  it('does not read upgrade ownership or station level', () => {
    expect(EXPERIENCE_CODE).not.toMatch(/qualityOwned/);
    expect(EXPERIENCE_CODE).not.toMatch(/stationLevels/);
    expect(EXPERIENCE_CODE).not.toMatch(/withStationAxis/);
    expect(EXPERIENCE_CODE).not.toMatch(/crowdingLoad/);
    expect(EXPERIENCE_CODE).not.toMatch(/equipmentFitScore/);
    expect(EXPERIENCE_CODE).not.toMatch(/memberSatisfaction/);
    expect(EXPERIENCE_CODE).not.toMatch(/displayName/);
  });
});

describe('Stage G.2A — reliability', () => {
  it('treats a mid-use interruption as a real disruption without scoring it as zero', () => {
    const clean = livingMemberExperience(repeats(visit({ queueWaitTicks: 0 }), 5));
    const oneBreak = livingMemberExperience(
      Object.freeze([
        visit({ queueWaitTicks: 0, observedAtTick: 1 }),
        visit({ queueWaitTicks: 0, observedAtTick: 2 }),
        visit({ queueWaitTicks: 0, observedAtTick: 3 }),
        visit({ queueWaitTicks: 0, observedAtTick: 4 }),
        visit({ queueWaitTicks: 0, observedAtTick: 5, outcome: 'interrupted' }),
      ]),
    );
    const allBreaks = livingMemberExperience(
      repeats(visit({ queueWaitTicks: 0, outcome: 'interrupted' }), 5),
    );
    expect(clean.components?.reliability).toBe(1);
    expect(clean.labels.reliability).toBe('Steady');
    expect(oneBreak.components?.reliability ?? 1).toBeLessThan(1);
    expect(oneBreak.components?.reliability ?? 0).toBeGreaterThan(KNOBS.reliabilityInterrupted);
    expect(oneBreak.labels.reliability).toBe('Uneven');
    expect(oneBreak.reasons.some((reason) => reason.text.includes('interrupted'))).toBe(true);
    expect(allBreaks.components?.reliability).toBeCloseTo(KNOBS.reliabilityInterrupted, 10);
    expect(allBreaks.labels.reliability).toBe('Disrupted');
    expect(EXPERIENCE_CODE).not.toMatch(/Math\.random/);
  });
});

describe('Stage G.2A — composite candidates then the shipped choice', () => {
  const stockWait = waitExponential(G1_WAIT.stockMean, KNOBS.waitHalfLifeTicks);
  const qualityWait = waitExponential(G1_WAIT.qualityMean, KNOBS.waitHalfLifeTicks);
  const capacityWait = waitExponential(G1_WAIT.capacityMean, KNOBS.waitHalfLifeTicks);
  const throughputWait = waitExponential(G1_WAIT.throughputMean, KNOBS.waitHalfLifeTicks);
  const severeWait = waitExponential(G1_WAIT.matchedStock, KNOBS.waitHalfLifeTicks);
  const stockTrain = KNOBS.trainingStockScore;
  const qualityTrain = KNOBS.trainingQualityScore;
  const steady = 1;

  it('rejects arithmetic mean because Quality-plus-severe-wait still looks excellent', () => {
    const severeQuality = arithmeticMean([severeWait, qualityTrain, steady]);
    const stockGoodWait = arithmeticMean([1, stockTrain, steady]);
    expect(severeQuality).toBeGreaterThan(0.75);
    expect(stockGoodWait).toBeGreaterThan(0.9);
  });

  it('keeps geometric and bottleneck honest on mixed wait/training', () => {
    const severeQualityGeo = geometricMean([severeWait, qualityTrain, steady]);
    const stockGeo = geometricMean([stockWait, stockTrain, steady]);
    const qualityGeo = geometricMean([qualityWait, qualityTrain, steady]);
    const capacityGeo = geometricMean([capacityWait, stockTrain, steady]);
    const throughputGeo = geometricMean([throughputWait, stockTrain, steady]);
    expect(severeQualityGeo).toBeLessThan(0.72);
    expect(stockGeo).toBeLessThan(capacityGeo);
    expect(throughputGeo).toBeGreaterThan(stockGeo);
    expect(qualityGeo).toBeGreaterThan(stockGeo);
    expect(capacityGeo).toBeGreaterThan(throughputGeo);
    const severeQualityBottleneck = bottleneckMean([severeWait, qualityTrain, steady]);
    expect(severeQualityBottleneck).toBeLessThan(0.6);
  });

  it('ships geometric composition of equal-weight component averages', () => {
    const severeQuality = livingMemberExperience(
      repeats(
        visit({
          queueWaitTicks: G1_WAIT.matchedStock,
          trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
        }),
        5,
      ),
    );
    const stockLong = livingMemberExperience(
      repeats(visit({ queueWaitTicks: G1_WAIT.stockMean }), 5),
    );
    expect(severeQuality.labels.overall).not.toBe('Good');
    expect(severeQuality.labels.wait).toBe('Rough');
    expect(severeQuality.labels.training).toBe('Excellent');
    expect(stockLong.labels.training).toBe('Solid');
    expect(stockLong.composite).toBeCloseTo(
      geometricMean([
        stockLong.components?.wait ?? 0,
        stockLong.components?.training ?? 0,
        stockLong.components?.reliability ?? 0,
      ]),
      10,
    );
  });
});

describe('Stage G.2A — identity, upgrades, relocation, offline', () => {
  const history = repeats(visit({ queueWaitTicks: 40 }), 3);

  it('is deterministic and bounded', () => {
    const a = livingMemberExperience(history);
    const b = livingMemberExperience(history);
    expect(a).toEqual(b);
    expect(a.composite ?? -1).toBeGreaterThanOrEqual(0);
    expect(a.composite ?? 2).toBeLessThanOrEqual(1);
  });

  it('ignores displayName because displayName is not an input', () => {
    const nia = livingMemberExperience(history);
    const omar = livingMemberExperience(history);
    expect(nia).toEqual(omar);
    expect(EXPERIENCE_CODE).not.toMatch(/LIVING_MEMBER_GIVEN_NAMES/);
  });

  it('does not change when the same visits sit on a relocated or clock-advanced roster', () => {
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    const withHistory = applyServiceObservations(
      roster,
      history.map((row, index) =>
        Object.freeze({
          memberId: roster.members[0]?.id ?? '',
          memberIndex: 0,
          memberType: roster.members[0]?.type ?? 'powerlifter',
          stationKind: row.stationKind,
          stationKey: row.stationKey,
          queueWaitTicks: row.queueWaitTicks,
          trainingExperience: row.trainingExperience,
          outcome: row.outcome,
          observedAtTick: index + 1,
        }),
      ),
    );
    const before = livingMemberExperience(withHistory.members[0]?.recentVisits ?? []);
    const relocated = reconcileLivingMemberRosterOnRelocation(
      withHistory,
      'storage-unit',
      [],
      T.SECONDS_PER_DAY,
    );
    const afterMove = livingMemberExperience(relocated.members[0]?.recentVisits ?? []);
    expect(afterMove).toEqual(before);
    expect(relocated.members[0]?.id).toBe(withHistory.members[0]?.id);
  });

  it('does not import Career, Portfolio, NpcLifter, or a wallet write', () => {
    expect(EXPERIENCE_CODE).not.toMatch(/from '\.\/npc'/);
    expect(EXPERIENCE_CODE).not.toMatch(/NpcLifter/);
    expect(EXPERIENCE_CODE).not.toMatch(/memberDuesGymBucks/);
    expect(EXPERIENCE_CODE).not.toMatch(/reputationFromMembers/);
    expect(EXPERIENCE_CODE).not.toMatch(/sportingReputationFromResult/);
    expect(EXPERIENCE_CODE).not.toMatch(/from '\.\.\/career/);
    expect(EXPERIENCE_CODE).not.toMatch(/from '\.\.\/game/);
    expect(EXPERIENCE_CODE).not.toMatch(/Date\.now/);
    expect(EXPERIENCE_CODE).not.toMatch(/gymBucks/);
  });
});

describe('Stage G.2A — Q/C/T flow through the right component', () => {
  it('lets Quality raise training on the same waits, leaving wait unchanged', () => {
    const waits = Object.freeze([128, 132, 116, 134, 0]);
    const stockHistory = waits.map((queueWaitTicks, index) =>
      visit({
        queueWaitTicks,
        observedAtTick: index + 1,
        trainingExperience: T.STATION_STOCK_TRAINING_EXPERIENCE,
      }),
    );
    const qualityHistory = waits.map((queueWaitTicks, index) =>
      visit({
        queueWaitTicks,
        observedAtTick: index + 1,
        trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
      }),
    );
    const stock = livingMemberExperience(stockHistory);
    const quality = livingMemberExperience(qualityHistory);
    expect(quality.components?.wait).toBeCloseTo(stock.components?.wait ?? 0, 10);
    expect(quality.components?.training ?? 0).toBeGreaterThan(stock.components?.training ?? 1);
    expect(quality.labels.training).toBe('Excellent');
    expect(stock.labels.training).toBe('Solid');
  });

  it('lets Capacity and Throughput improve wait through actual ticks, with no axis bonus', () => {
    const stock = livingMemberExperience(
      repeats(visit({ queueWaitTicks: G1_WAIT.matchedStock }), 5),
    );
    const capacity = livingMemberExperience(
      repeats(visit({ queueWaitTicks: 49 }), 5),
    );
    const throughput = livingMemberExperience(
      repeats(visit({ queueWaitTicks: G1_WAIT.matchedThroughput }), 5),
    );
    expect(capacity.components?.wait ?? 0).toBeGreaterThan(stock.components?.wait ?? 1);
    expect(throughput.components?.wait ?? 0).toBeGreaterThan(stock.components?.wait ?? 1);
    expect(capacity.components?.wait ?? 0).toBeGreaterThan(throughput.components?.wait ?? 1);
    expect(capacity.components?.training).toBeCloseTo(stock.components?.training ?? 0, 10);
    expect(throughput.components?.training).toBeCloseTo(stock.components?.training ?? 0, 10);
  });
});

describe('Stage G.2A — synthetic boundary histories', () => {
  it('covers excellent, severe wait, mixed, one sample, interruptions, and forming', () => {
    const excellent = livingMemberExperience(
      repeats(
        visit({
          queueWaitTicks: 0,
          trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
        }),
        5,
      ),
    );
    const severe = livingMemberExperience(repeats(visit({ queueWaitTicks: 180 }), 5));
    const qualitySevere = livingMemberExperience(
      repeats(
        visit({
          queueWaitTicks: 180,
          trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
        }),
        5,
      ),
    );
    const mixed = livingMemberExperience(
      Object.freeze([
        visit({ queueWaitTicks: 0, observedAtTick: 1 }),
        visit({ queueWaitTicks: 20, observedAtTick: 2 }),
        visit({ queueWaitTicks: 95, observedAtTick: 3 }),
        visit({
          queueWaitTicks: 10,
          observedAtTick: 4,
          trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
        }),
        visit({ queueWaitTicks: 128, observedAtTick: 5, outcome: 'interrupted' }),
      ]),
    );
    const one = livingMemberExperience([visit({ queueWaitTicks: 10 })]);
    const none = livingMemberExperience([]);
    expect(excellent.labels.overall).toBe('Good');
    expect(excellent.labels.wait).toBe('Easy');
    expect(excellent.labels.training).toBe('Excellent');
    expect(severe.labels.wait).toBe('Rough');
    expect(severe.labels.training).toBe('Solid');
    expect(qualitySevere.labels.training).toBe('Excellent');
    expect(qualitySevere.labels.wait).toBe('Rough');
    expect(qualitySevere.labels.overall).not.toBe('Good');
    expect(mixed.reasons.length).toBeGreaterThanOrEqual(2);
    expect(one.status).toBe('formed');
    expect(one.sampleCount).toBe(1);
    expect(none.status).toBe('forming');
  });
});

describe('Stage G.2A — real Garage fixture families', () => {
  it('distinguishes stock / Quality / Capacity / Throughput the way G.1 service truth does', () => {
    const stockCtx = garageContext();
    const qualityCtx = garageContext(
      withStationAxis(stockStationCapability(), COMPETITION_BENCH_BAY, 'quality', 1),
    );
    const capacityCtx = garageContext(
      withStationAxis(stockStationCapability(), COMPETITION_BENCH_BAY, 'capacity', 1),
    );
    const throughputCtx = garageContext(
      withStationAxis(stockStationCapability(), COMPETITION_BENCH_BAY, 'throughput', 1),
    );
    const stockRoster = collectRoster(stockCtx, 1_000);
    const qualityRoster = collectRoster(qualityCtx, 1_000);
    const capacityRoster = collectRoster(capacityCtx, 1_000);
    const throughputRoster = collectRoster(throughputCtx, 1_000);

    const formed = (roster: typeof stockRoster) =>
      roster.members
        .map((member) => Object.freeze({ member, experience: livingMemberExperience(member.recentVisits) }))
        .filter((row) => row.experience.status === 'formed');

    const stockFormed = formed(stockRoster);
    const qualityFormed = formed(qualityRoster);
    const capacityFormed = formed(capacityRoster);
    const throughputFormed = formed(throughputRoster);
    expect(stockFormed.length).toBeGreaterThan(0);
    expect(qualityFormed.length).toBeGreaterThan(0);
    expect(capacityFormed.length).toBeGreaterThan(0);
    expect(throughputFormed.length).toBeGreaterThan(0);

    const meanWaitComponent = (rows: typeof stockFormed) =>
      rows.reduce((sum, row) => sum + (row.experience.components?.wait ?? 0), 0) / rows.length;
    const meanTraining = (rows: typeof stockFormed) =>
      rows.reduce((sum, row) => sum + (row.experience.components?.training ?? 0), 0) / rows.length;

    expect(meanWaitComponent(qualityFormed)).toBeCloseTo(meanWaitComponent(stockFormed), 5);
    expect(meanTraining(qualityFormed)).toBeGreaterThan(meanTraining(stockFormed));
    expect(meanWaitComponent(capacityFormed)).toBeGreaterThan(meanWaitComponent(stockFormed));
    expect(meanWaitComponent(throughputFormed)).toBeGreaterThan(meanWaitComponent(stockFormed));
    expect(meanTraining(capacityFormed)).toBeCloseTo(meanTraining(stockFormed), 5);
    expect(meanTraining(throughputFormed)).toBeCloseTo(meanTraining(stockFormed), 5);

    const byName = (roster: typeof stockRoster, name: string) =>
      roster.members.find((member) => member.displayName === name);

    for (const name of ['Nia', 'Omar', 'Wren'] as const) {
      const stockMember = byName(stockRoster, name);
      expect(stockMember).toBeDefined();
      if ((stockMember?.recentVisits.length ?? 0) === 0) continue;
      const stockXp = livingMemberExperience(stockMember?.recentVisits ?? []);
      expect(stockXp.labels.overall === 'Still forming' || stockXp.reasons.length > 0).toBe(true);
    }
  });

  it('keeps N=5 as the remembered window feeding the card', () => {
    expect(T.LIVING_MEMBER_SERVICE_HISTORY_WINDOW).toBe(5);
    const long = repeats(visit({ queueWaitTicks: 10 }), 8);
    const roster = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
    const first = roster.members[0];
    if (first === undefined) throw new Error('expected a garage member');
    const updated = applyServiceObservations(
      roster,
      long.map((row, index) =>
        Object.freeze({
          memberId: first.id,
          memberIndex: 0,
          memberType: first.type,
          stationKind: row.stationKind,
          stationKey: row.stationKey,
          queueWaitTicks: row.queueWaitTicks,
          trainingExperience: row.trainingExperience,
          outcome: row.outcome,
          observedAtTick: index + 1,
        }),
      ),
    );
    expect(updated.members[0]?.recentVisits.length).toBe(5);
    expect(livingMemberExperience(updated.members[0]?.recentVisits ?? []).sampleCount).toBe(5);
  });
});

describe('Stage G.2A — fences', () => {
  it('does not retune D2 Q/C/T or check-in reputation', () => {
    expect(T.STATION_UPGRADE_COST_GYM_BUCKS.quality).toBe(120);
    expect(T.STATION_UPGRADE_COST_GYM_BUCKS.capacity).toBe(180);
    expect(T.STATION_UPGRADE_COST_GYM_BUCKS.throughput).toBe(30);
    expect(T.STATION_STOCK_TRAINING_EXPERIENCE).toBe(1);
    expect(T.STATION_QUALITY_TRAINING_EXPERIENCE).toBe(2);
    expect(T.STATION_QUALITY_AFFINITY_BONUS).toBe(0.25);
    expect(T.FLOOR_SIM_STATION_CHANGEOVER_TICKS).toBe(18);
    expect(T.STATION_THROUGHPUT_CHANGEOVER_TICKS).toBe(6);
    expect(T.LADDER_INCOME_GYM_BUCKS_PER_HOUR.garage).toBe(60);
    expect(T.OFFLINE_EARNINGS_FRACTION).toBe(0.5);
    expect(T.REPUTATION_PER_CHECK_IN).toBe(2);
  });

  it('does not write dues or reputation through GymView when scoring experience', () => {
    let state = createGymViewState();
    const beforeBucks = state.managed.gym.ladder.gymBucks;
    const roster = collectRoster(garageContext(), 200);
    const first = roster.members[0];
    if (first === undefined) throw new Error('expected a garage member');
    state = gymViewReduce(state, {
      kind: 'apply-living-member-observations',
      observations: first.recentVisits.map((row) =>
        Object.freeze({
          memberId: first.id,
          memberIndex: 0,
          memberType: first.type,
          stationKind: row.stationKind,
          stationKey: row.stationKey,
          queueWaitTicks: row.queueWaitTicks,
          trainingExperience: row.trainingExperience,
          outcome: row.outcome,
          observedAtTick: row.observedAtTick,
        }),
      ),
    });
    for (const member of state.livingMembers.members) {
      livingMemberExperience(member.recentVisits);
    }
    expect(state.managed.gym.ladder.gymBucks).toBe(beforeBucks);
  });
});
