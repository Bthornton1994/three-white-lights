/**
 * livingMemberExperience.test.ts — Stage G.2A / G.2A.1 recent-service meaning.
 *
 * Calibration lives here as runnable comparisons, not as a report nobody can
 * re-derive. Wait-curve candidates, training maps, and composite candidates
 * are scored against the G.1 Garage distributions and against synthetic
 * boundary histories. G.2A.1 pins exact remembered-window Garage tables
 * and names 110 as waitDecayTicks (e-folding), not a half-life. The shipped
 * functions are the chosen curves.
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
  type FloorSimServiceObservation,
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

function waitDecay(ticks: number, decayTicks: number): number {
  return Math.exp(-ticks / decayTicks);
}

function waitTrueHalfLife(ticks: number, halfLifeTicks: number): number {
  return Math.exp((-Math.LN2 * ticks) / halfLifeTicks);
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

function overallLabel(score: number): string {
  if (score >= KNOBS.overallGoodMin) return 'Good';
  if (score >= KNOBS.overallMixedMin) return 'Mixed';
  if (score >= KNOBS.overallRoughMin) return 'Rough';
  return 'Poor';
}

function waitLabel(score: number): string {
  if (score >= KNOBS.waitEasyMin) return 'Easy';
  if (score >= KNOBS.waitManageableMin) return 'Manageable';
  if (score >= KNOBS.waitStrainedMin) return 'Strained';
  return 'Rough';
}

function trainingLabel(score: number): string {
  if (score >= KNOBS.trainingExcellentMin) return 'Excellent';
  if (score >= KNOBS.trainingSolidMin) return 'Solid';
  return 'Thin';
}

function scored(wait: number, training: number, reliability: number) {
  const arithmetic = arithmeticMean([wait, training, reliability]);
  const geometric = geometricMean([wait, training, reliability]);
  const bottleneck = bottleneckMean([wait, training, reliability]);
  return Object.freeze({
    wait,
    training,
    reliability,
    arithmetic: Object.freeze({ score: arithmetic, overall: overallLabel(arithmetic) }),
    geometric: Object.freeze({ score: geometric, overall: overallLabel(geometric) }),
    bottleneck: Object.freeze({ score: bottleneck, overall: overallLabel(bottleneck) }),
  });
}

function trainingFromMap(stockScore: number, trainingExperience: number): number {
  const stockExp = T.STATION_STOCK_TRAINING_EXPERIENCE;
  const qualityExp = T.STATION_QUALITY_TRAINING_EXPERIENCE;
  const span = qualityExp - stockExp;
  const t = span === 0 ? 0 : (trainingExperience - stockExp) / span;
  return stockScore + t * (KNOBS.trainingQualityScore - stockScore);
}

function tally(labels: readonly string[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const label of labels) counts[label] = (counts[label] ?? 0) + 1;
  return Object.freeze(counts);
}

function collectGarage(capability = stockStationCapability()) {
  const context = garageContext(capability);
  const opening = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
  let state = createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
  const observations: FloorSimServiceObservation[] = [];
  for (let tick = 0; tick < 1_000; tick += 1) {
    const stepped = stepFloorSimWithObservations(state, context);
    observations.push(...stepped.observations);
    state = stepped.state;
  }
  return Object.freeze({
    roster: applyServiceObservations(opening, observations),
    observations: Object.freeze(observations.slice()),
  });
}

function garageFamily(capability = stockStationCapability()) {
  const { roster, observations } = collectGarage(capability);
  const formed = roster.members
    .map((member) =>
      Object.freeze({ member, experience: livingMemberExperience(member.recentVisits) }),
    )
    .filter((row) => row.experience.status === 'formed');
  const rememberedWaits = formed.flatMap((row) =>
    row.member.recentVisits.map((visitRow) => visitRow.queueWaitTicks),
  );
  const meanOf = (values: readonly number[]): number =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  return Object.freeze({
    completedObservationCount: observations.filter((row) => row.outcome === 'completed').length,
    formedMemberCount: formed.length,
    meanRawQueueWaitTicks: meanOf(rememberedWaits),
    meanWait: meanOf(formed.map((row) => row.experience.components?.wait ?? 0)),
    meanTraining: meanOf(formed.map((row) => row.experience.components?.training ?? 0)),
    meanReliability: meanOf(formed.map((row) => row.experience.components?.reliability ?? 0)),
    meanComposite: meanOf(formed.map((row) => row.experience.composite ?? 0)),
    overall: tally(formed.map((row) => row.experience.labels.overall)),
    waitLabels: tally(formed.map((row) => row.experience.labels.wait)),
    trainingLabels: tally(formed.map((row) => row.experience.labels.training)),
    named: Object.freeze(
      ['Nia', 'Omar', 'Wren'].map((name) => {
        const member = roster.members.find((row) => row.displayName === name);
        if (member === undefined) throw new Error(`expected ${name}`);
        const experience = livingMemberExperience(member.recentVisits);
        return Object.freeze({
          name,
          id: member.id,
          sampleCount: experience.sampleCount,
          components: experience.components,
          composite: experience.composite,
          overall: experience.labels.overall,
          reasons: experience.reasons.map((reason) => reason.text),
        });
      }),
    ),
  });
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
    exponential110: (ticks: number) => waitDecay(ticks, KNOBS.waitDecayTicks),
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

  it('names 110 as waitDecayTicks, an e-folding constant, not a half-life', () => {
    expect(KNOBS.waitDecayTicks).toBe(110);
    expect('waitHalfLifeTicks' in KNOBS).toBe(false);
    expect(waitComponentFromTicks(110)).toBeCloseTo(Math.exp(-1), 10);
    expect(waitComponentFromTicks(110)).not.toBeCloseTo(0.5, 3);
    const ticks = Object.freeze([0, 52.52, 86.36, 95, 116.59, 128]);
    const current = Object.freeze(
      Object.fromEntries(ticks.map((value) => [String(value), waitDecay(value, KNOBS.waitDecayTicks)])),
    );
    const trueHalfLife = Object.freeze(
      Object.fromEntries(
        ticks.map((value) => [String(value), waitTrueHalfLife(value, KNOBS.waitDecayTicks)]),
      ),
    );
    expect(current['0']).toBe(1);
    expect(trueHalfLife['0']).toBe(1);
    expect(current['52.52']).toBeCloseTo(0.6203604831590998, 10);
    expect(trueHalfLife['52.52']).toBeCloseTo(0.7182437577848889, 10);
    expect(current['86.36']).toBeCloseTo(0.45607823824293925, 10);
    expect(trueHalfLife['86.36']).toBeCloseTo(0.5803153884055917, 10);
    expect(current['95']).toBeCloseTo(0.4216261054870035, 10);
    expect(trueHalfLife['95']).toBeCloseTo(0.5495656112795922, 10);
    expect(current['116.59']).toBeCloseTo(0.34648730774449366, 10);
    expect(trueHalfLife['116.59']).toBeCloseTo(0.4796622838521465, 10);
    expect(current['128']).toBeCloseTo(0.31234830125984425, 10);
    expect(trueHalfLife['128']).toBeCloseTo(0.44638598471682817, 10);
    expect(waitComponentFromTicks(52.52)).toBeCloseTo(current['52.52'] ?? 0, 10);
    expect(EXPERIENCE_CODE).not.toMatch(/waitHalfLifeTicks/);
    expect(EXPERIENCE_CODE).not.toMatch(/Math\.LN2/);
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

describe('Stage G.2A.1 — training mapping candidates', () => {
  const stockWait = 0.31368001276156227;
  const capacityWait = 0.6197135473011088;
  const throughputWait = 0.4271760601788676;
  const severeWait = waitDecay(180, KNOBS.waitDecayTicks);
  const maps = Object.freeze([0.75, 0.82, 0.9] as const);

  it('compares 0.75 / 0.82 / 0.90 stock maps with Quality held at 1, then keeps 0.82', () => {
    const row = (stockMap: number, wait: number, experience: number) => {
      const training = trainingFromMap(stockMap, experience);
      const composite = geometricMean([wait, training, 1]);
      return Object.freeze({
        stockMap,
        wait: waitLabel(wait),
        training,
        trainingLabel: trainingLabel(training),
        composite,
        overall: overallLabel(composite),
      });
    };
    const report = maps.map((stockMap) =>
      Object.freeze({
        stockMap,
        excellentStock: row(stockMap, 1, T.STATION_STOCK_TRAINING_EXPERIENCE),
        excellentQuality: row(stockMap, 1, T.STATION_QUALITY_TRAINING_EXPERIENCE),
        stockGarage: row(stockMap, stockWait, T.STATION_STOCK_TRAINING_EXPERIENCE),
        qualityGarage: row(stockMap, stockWait, T.STATION_QUALITY_TRAINING_EXPERIENCE),
        capacityGarage: row(stockMap, capacityWait, T.STATION_STOCK_TRAINING_EXPERIENCE),
        throughputGarage: row(stockMap, throughputWait, T.STATION_STOCK_TRAINING_EXPERIENCE),
        severeStock: row(stockMap, severeWait, T.STATION_STOCK_TRAINING_EXPERIENCE),
        severeQuality: row(stockMap, severeWait, T.STATION_QUALITY_TRAINING_EXPERIENCE),
      }),
    );
    const at075 = report[0];
    const at082 = report[1];
    const at090 = report[2];
    expect(at075?.excellentStock.trainingLabel).toBe('Thin');
    expect(at075?.capacityGarage.overall).toBe('Mixed');
    expect(at082?.excellentStock.trainingLabel).toBe('Solid');
    expect(at082?.excellentQuality.trainingLabel).toBe('Excellent');
    expect(at082?.capacityGarage.overall).toBe('Good');
    expect(at082?.severeQuality.overall).not.toBe('Good');
    expect(at082?.qualityGarage.trainingLabel).toBe('Excellent');
    expect(at082?.qualityGarage.wait).toBe('Rough');
    expect(at090?.excellentStock.trainingLabel).toBe('Solid');
    expect(at090?.excellentQuality.training).toBe(1);
    expect((at082?.excellentQuality.training ?? 0) - (at082?.excellentStock.training ?? 1)).toBeCloseTo(
      0.18,
      10,
    );
    expect((at090?.excellentQuality.training ?? 0) - (at090?.excellentStock.training ?? 1)).toBeCloseTo(
      0.1,
      10,
    );
    expect(KNOBS.trainingStockScore).toBe(0.82);
    expect(KNOBS.trainingQualityScore).toBe(1);
  });
});

describe('Stage G.2A.1 — composite candidates against actual overall labels', () => {
  const stockGarage = scored(0.31368001276156227, 0.82, 1);
  const qualityGarage = scored(0.31368001276156227, 1, 1);
  const capacityGarage = scored(0.6197135473011088, 0.82, 1);
  const throughputGarage = scored(0.4271760601788676, 0.82, 1);
  const excellentStock = scored(1, 0.82, 1);
  const excellentQuality = scored(1, 1, 1);
  const severeStock = scored(waitDecay(180, KNOBS.waitDecayTicks), 0.82, 1);
  const severeQuality = scored(waitDecay(180, KNOBS.waitDecayTicks), 1, 1);
  const oneBreak = scored(1, 0.82, 0.91);
  const allBreaks = scored(1, 0.82, 0.55);
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
  const oneVisit = livingMemberExperience([visit({ queueWaitTicks: 10 })]);

  it('uses the shipped Good/Mixed/Rough thresholds rather than an arbitrary 0.75 cut', () => {
    expect(KNOBS.overallGoodMin).toBe(0.78);
    expect(KNOBS.overallMixedMin).toBe(0.62);
    expect(KNOBS.overallRoughMin).toBe(0.45);
    expect(excellentStock.arithmetic.score).toBeCloseTo(0.94, 10);
    expect(excellentStock.arithmetic.overall).toBe('Good');
    expect(excellentStock.geometric.score).toBeCloseTo(0.9359901623141157, 10);
    expect(excellentStock.geometric.overall).toBe('Good');
    expect(excellentStock.bottleneck.score).toBeCloseTo(0.88, 10);
    expect(excellentStock.bottleneck.overall).toBe('Good');
    expect(excellentQuality.arithmetic.score).toBe(1);
    expect(excellentQuality.geometric.score).toBe(1);
    expect(excellentQuality.bottleneck.score).toBe(1);
    expect(excellentQuality.geometric.overall).toBe('Good');
    expect(stockGarage.arithmetic.score).toBeCloseTo(0.7112266709205208, 10);
    expect(stockGarage.arithmetic.overall).toBe('Mixed');
    expect(stockGarage.geometric.score).toBeCloseTo(0.6359655144471363, 10);
    expect(stockGarage.geometric.overall).toBe('Mixed');
    expect(stockGarage.bottleneck.score).toBeCloseTo(0.5124533418410415, 10);
    expect(stockGarage.bottleneck.overall).toBe('Rough');
    expect(qualityGarage.arithmetic.score).toBeCloseTo(0.7712266709205208, 10);
    expect(qualityGarage.arithmetic.overall).toBe('Mixed');
    expect(qualityGarage.geometric.score).toBeCloseTo(0.6794574772824462, 10);
    expect(qualityGarage.geometric.overall).toBe('Mixed');
    expect(qualityGarage.bottleneck.score).toBeCloseTo(0.5424533418410415, 10);
    expect(qualityGarage.bottleneck.overall).toBe('Rough');
    expect(capacityGarage.arithmetic.score).toBeCloseTo(0.8132378491003696, 10);
    expect(capacityGarage.arithmetic.overall).toBe('Good');
    expect(capacityGarage.geometric.score).toBeCloseTo(0.7979976532673189, 10);
    expect(capacityGarage.geometric.overall).toBe('Good');
    expect(capacityGarage.bottleneck.score).toBeCloseTo(0.7164756982007392, 10);
    expect(capacityGarage.bottleneck.overall).toBe('Mixed');
    expect(throughputGarage.arithmetic.score).toBeCloseTo(0.7490586867262892, 10);
    expect(throughputGarage.arithmetic.overall).toBe('Mixed');
    expect(throughputGarage.geometric.score).toBeCloseTo(0.7049206820857463, 10);
    expect(throughputGarage.geometric.overall).toBe('Mixed');
    expect(throughputGarage.bottleneck.score).toBeCloseTo(0.5881173734525784, 10);
    expect(throughputGarage.bottleneck.overall).toBe('Rough');
    expect(severeStock.arithmetic.overall).toBe('Mixed');
    expect(severeStock.geometric.overall).toBe('Rough');
    expect(severeStock.bottleneck.overall).toBe('Poor');
    expect(severeQuality.arithmetic.score).toBeCloseTo(0.7315622361105034, 10);
    expect(severeQuality.arithmetic.overall).toBe('Mixed');
    expect(severeQuality.geometric.score).toBeCloseTo(0.5795782787848095, 10);
    expect(severeQuality.geometric.overall).toBe('Rough');
    expect(severeQuality.bottleneck.score).toBeCloseTo(0.46312447222100677, 10);
    expect(severeQuality.bottleneck.overall).toBe('Rough');
    expect(allBreaks.arithmetic.score).toBeCloseTo(0.79, 10);
    expect(allBreaks.arithmetic.overall).toBe('Good');
    expect(allBreaks.geometric.score).toBeCloseTo(0.766876649056906, 10);
    expect(allBreaks.geometric.overall).toBe('Mixed');
    expect(allBreaks.bottleneck.score).toBeCloseTo(0.67, 10);
    expect(allBreaks.bottleneck.overall).toBe('Mixed');
    expect(oneBreak.geometric.score).toBeCloseTo(0.9070232401791283, 10);
    expect(oneBreak.geometric.overall).toBe('Good');
    expect(mixed.labels.overall).toBe('Good');
    expect(mixed.composite).toBeCloseTo(0.8154723507634511, 10);
    expect(oneVisit.labels.overall).toBe('Good');
    expect(oneVisit.sampleCount).toBe(1);
    expect(severeStock.geometric.overall).toBe('Rough');
  });

  it('keeps geometric: arithmetic calls five interruptions Good; bottleneck hides Quality garage as Rough', () => {
    expect(allBreaks.arithmetic.score).toBeGreaterThanOrEqual(KNOBS.overallGoodMin);
    expect(allBreaks.geometric.score).toBeLessThan(KNOBS.overallGoodMin);
    expect(qualityGarage.bottleneck.overall).toBe('Rough');
    expect(qualityGarage.geometric.overall).toBe('Mixed');
    expect(capacityGarage.geometric.score).toBeGreaterThan(stockGarage.geometric.score);
    expect(throughputGarage.geometric.score).toBeGreaterThan(stockGarage.geometric.score);
    expect(qualityGarage.training).toBe(1);
    expect(oneBreak.geometric.overall).toBe('Good');
    expect(severeQuality.geometric.overall).not.toBe('Good');
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

function snapshotExperience(history: readonly ServiceVisitRecord[]) {
  const experience = livingMemberExperience(history);
  return Object.freeze({
    status: experience.status,
    sampleCount: experience.sampleCount,
    wait: experience.components?.wait ?? null,
    training: experience.components?.training ?? null,
    reliability: experience.components?.reliability ?? null,
    composite: experience.composite,
    overall: experience.labels.overall,
    waitLabel: experience.labels.wait,
    trainingLabel: experience.labels.training,
    reliabilityLabel: experience.labels.reliability,
  });
}

describe('Stage G.2A.1 — synthetic boundary table', () => {
  const mixedHistory = Object.freeze([
    visit({ queueWaitTicks: 0, observedAtTick: 1 }),
    visit({ queueWaitTicks: 20, observedAtTick: 2 }),
    visit({ queueWaitTicks: 95, observedAtTick: 3 }),
    visit({
      queueWaitTicks: 10,
      observedAtTick: 4,
      trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
    }),
    visit({ queueWaitTicks: 128, observedAtTick: 5, outcome: 'interrupted' }),
  ]);
  const oneInterruptedAmongFour = Object.freeze([
    visit({ queueWaitTicks: 0, observedAtTick: 1 }),
    visit({ queueWaitTicks: 0, observedAtTick: 2 }),
    visit({ queueWaitTicks: 0, observedAtTick: 3 }),
    visit({ queueWaitTicks: 0, observedAtTick: 4 }),
    visit({ queueWaitTicks: 0, observedAtTick: 5, outcome: 'interrupted' }),
  ]);

  it('pins exact components, composite, and player-facing overall labels', () => {
    const zero = snapshotExperience([]);
    const oneExcellentStock = snapshotExperience([visit({ queueWaitTicks: 0 })]);
    const oneSevereStock = snapshotExperience([visit({ queueWaitTicks: 180 })]);
    const fiveExcellentStock = snapshotExperience(repeats(visit({ queueWaitTicks: 0 }), 5));
    const fiveExcellentQuality = snapshotExperience(
      repeats(
        visit({
          queueWaitTicks: 0,
          trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
        }),
        5,
      ),
    );
    const fiveSevereStock = snapshotExperience(repeats(visit({ queueWaitTicks: 180 }), 5));
    const fiveSevereQuality = snapshotExperience(
      repeats(
        visit({
          queueWaitTicks: 180,
          trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
        }),
        5,
      ),
    );
    const mixed = snapshotExperience(mixedHistory);
    const oneBreak = snapshotExperience(oneInterruptedAmongFour);
    const fiveBreaks = snapshotExperience(
      repeats(visit({ queueWaitTicks: 0, outcome: 'interrupted' }), 5),
    );

    expect(zero).toEqual({
      status: 'forming',
      sampleCount: 0,
      wait: null,
      training: null,
      reliability: null,
      composite: null,
      overall: 'Still forming',
      waitLabel: 'Not yet',
      trainingLabel: 'Not yet',
      reliabilityLabel: 'Not yet',
    });
    expect(oneExcellentStock.sampleCount).toBe(1);
    expect(oneExcellentStock.wait).toBe(1);
    expect(oneExcellentStock.training).toBe(0.82);
    expect(oneExcellentStock.reliability).toBe(1);
    expect(oneExcellentStock.composite).toBeCloseTo(0.9359901623141157, 10);
    expect(oneExcellentStock.overall).toBe('Good');
    expect(oneExcellentStock.waitLabel).toBe('Easy');
    expect(oneExcellentStock.trainingLabel).toBe('Solid');
    expect(oneExcellentStock.reliabilityLabel).toBe('Steady');
    expect(oneSevereStock.wait).toBeCloseTo(0.19468670833151014, 10);
    expect(oneSevereStock.training).toBe(0.82);
    expect(oneSevereStock.reliability).toBe(1);
    expect(oneSevereStock.composite).toBeCloseTo(0.5424795672335296, 10);
    expect(oneSevereStock.overall).toBe('Rough');
    expect(oneSevereStock.waitLabel).toBe('Rough');
    expect(oneSevereStock.trainingLabel).toBe('Solid');
    expect(fiveExcellentStock.sampleCount).toBe(5);
    expect(fiveExcellentStock.wait).toBe(1);
    expect(fiveExcellentStock.training).toBe(0.82);
    expect(fiveExcellentStock.reliability).toBe(1);
    expect(fiveExcellentStock.composite).toBeCloseTo(oneExcellentStock.composite ?? 0, 10);
    expect(fiveExcellentStock.overall).toBe('Good');
    expect(fiveExcellentStock.trainingLabel).toBe('Solid');
    expect(fiveExcellentQuality.wait).toBe(1);
    expect(fiveExcellentQuality.training).toBe(1);
    expect(fiveExcellentQuality.reliability).toBe(1);
    expect(fiveExcellentQuality.composite).toBe(1);
    expect(fiveExcellentQuality.overall).toBe('Good');
    expect(fiveExcellentQuality.trainingLabel).toBe('Excellent');
    expect(fiveSevereStock.wait).toBeCloseTo(oneSevereStock.wait ?? 0, 10);
    expect(fiveSevereStock.composite).toBeCloseTo(oneSevereStock.composite ?? 0, 10);
    expect(fiveSevereStock.overall).toBe('Rough');
    expect(fiveSevereQuality.wait).toBeCloseTo(0.19468670833151014, 10);
    expect(fiveSevereQuality.training).toBe(1);
    expect(fiveSevereQuality.composite).toBeCloseTo(0.5795782787848095, 10);
    expect(fiveSevereQuality.overall).toBe('Rough');
    expect(fiveSevereQuality.trainingLabel).toBe('Excellent');
    expect(fiveSevereQuality.waitLabel).toBe('Rough');
    expect(mixed.wait).toBeCloseTo(0.6961656082208582, 10);
    expect(mixed.training).toBeCloseTo(0.856, 10);
    expect(mixed.reliability).toBeCloseTo(0.91, 10);
    expect(mixed.composite).toBeCloseTo(0.8154723507634511, 10);
    expect(mixed.overall).toBe('Good');
    expect(mixed.waitLabel).toBe('Manageable');
    expect(mixed.trainingLabel).toBe('Solid');
    expect(mixed.reliabilityLabel).toBe('Uneven');
    expect(oneBreak.wait).toBe(1);
    expect(oneBreak.training).toBe(0.82);
    expect(oneBreak.reliability).toBeCloseTo(0.91, 10);
    expect(oneBreak.composite).toBeCloseTo(0.9070232401791283, 10);
    expect(oneBreak.overall).toBe('Good');
    expect(oneBreak.reliabilityLabel).toBe('Uneven');
    expect(fiveBreaks.wait).toBe(1);
    expect(fiveBreaks.training).toBe(0.82);
    expect(fiveBreaks.reliability).toBe(0.55);
    expect(fiveBreaks.composite).toBeCloseTo(0.766876649056906, 10);
    expect(fiveBreaks.overall).toBe('Mixed');
    expect(fiveBreaks.reliabilityLabel).toBe('Disrupted');
  });
});

describe('Stage G.2A.1 — exact 1000-tick Garage fixture table', () => {
  it('pins G.2 remembered-window output, not G.1 all-observation means', () => {
    const stock = garageFamily();
    const quality = garageFamily(
      withStationAxis(stockStationCapability(), COMPETITION_BENCH_BAY, 'quality', 1),
    );
    const capacity = garageFamily(
      withStationAxis(stockStationCapability(), COMPETITION_BENCH_BAY, 'capacity', 1),
    );
    const throughput = garageFamily(
      withStationAxis(stockStationCapability(), COMPETITION_BENCH_BAY, 'throughput', 1),
    );

    expect(stock.completedObservationCount).toBe(17);
    expect(quality.completedObservationCount).toBe(17);
    expect(capacity.completedObservationCount).toBe(25);
    expect(throughput.completedObservationCount).toBe(22);
    expect(stock.formedMemberCount).toBe(3);
    expect(quality.formedMemberCount).toBe(3);
    expect(capacity.formedMemberCount).toBe(3);
    expect(throughput.formedMemberCount).toBe(3);

    expect(stock.meanRawQueueWaitTicks).toBeCloseTo(128.13333333333334, 10);
    expect(quality.meanRawQueueWaitTicks).toBeCloseTo(128.13333333333334, 10);
    expect(capacity.meanRawQueueWaitTicks).toBeCloseTo(54.333333333333336, 10);
    expect(throughput.meanRawQueueWaitTicks).toBeCloseTo(93.66666666666667, 10);
    expect(stock.meanRawQueueWaitTicks).not.toBeCloseTo(G1_WAIT.stockMean, 1);

    expect(stock.meanWait).toBeCloseTo(0.31368001276156227, 10);
    expect(quality.meanWait).toBeCloseTo(0.31368001276156227, 10);
    expect(capacity.meanWait).toBeCloseTo(0.6197135473011088, 10);
    expect(throughput.meanWait).toBeCloseTo(0.4271760601788676, 10);
    expect(stock.meanTraining).toBe(0.82);
    expect(quality.meanTraining).toBe(1);
    expect(capacity.meanTraining).toBe(0.82);
    expect(throughput.meanTraining).toBe(0.82);
    expect(stock.meanReliability).toBe(1);
    expect(quality.meanReliability).toBe(1);
    expect(capacity.meanReliability).toBe(1);
    expect(throughput.meanReliability).toBe(1);
    expect(stock.meanComposite).toBeCloseTo(0.6358163851139348, 10);
    expect(quality.meanComposite).toBeCloseTo(0.6792981493971691, 10);
    expect(capacity.meanComposite).toBeCloseTo(0.7966705618221184, 10);
    expect(throughput.meanComposite).toBeCloseTo(0.704912410827251, 10);

    expect(stock.overall).toEqual({ Mixed: 3 });
    expect(quality.overall).toEqual({ Mixed: 3 });
    expect(capacity.overall).toEqual({ Mixed: 2, Good: 1 });
    expect(throughput.overall).toEqual({ Mixed: 3 });
    expect(stock.waitLabels).toEqual({ Rough: 3 });
    expect(quality.waitLabels).toEqual({ Rough: 3 });
    expect(capacity.waitLabels).toEqual({ Manageable: 2, Easy: 1 });
    expect(throughput.waitLabels).toEqual({ Strained: 3 });
    expect(stock.trainingLabels).toEqual({ Solid: 3 });
    expect(quality.trainingLabels).toEqual({ Excellent: 3 });
    expect(capacity.trainingLabels).toEqual({ Solid: 3 });
    expect(throughput.trainingLabels).toEqual({ Solid: 3 });

    const niaStock = stock.named[0];
    const omarStock = stock.named[1];
    const wrenStock = stock.named[2];
    expect(niaStock?.id).toBe('member:n1:0');
    expect(omarStock?.id).toBe('member:n1:1');
    expect(wrenStock?.id).toBe('member:n1:2');
    expect(niaStock?.sampleCount).toBe(5);
    expect(omarStock?.sampleCount).toBe(5);
    expect(wrenStock?.sampleCount).toBe(5);
    expect(niaStock?.components?.wait).toBeCloseTo(0.30858081566392714, 10);
    expect(niaStock?.components?.training).toBe(0.82);
    expect(niaStock?.components?.reliability).toBe(1);
    expect(niaStock?.composite).toBeCloseTo(0.6325005755180609, 10);
    expect(niaStock?.overall).toBe('Mixed');
    expect(niaStock?.reasons).toEqual([
      'Waits have been very long.',
      'Training has been a regular gym session.',
    ]);
    expect(omarStock?.components?.wait).toBeCloseTo(0.29903848289547974, 10);
    expect(omarStock?.composite).toBeCloseTo(0.6259125281175376, 10);
    expect(omarStock?.overall).toBe('Mixed');
    expect(omarStock?.reasons).toEqual([
      'Waits have been very long.',
      'Training has been a regular gym session.',
    ]);
    expect(wrenStock?.components?.wait).toBeCloseTo(0.33342073972527986, 10);
    expect(wrenStock?.composite).toBeCloseTo(0.649036051706206, 10);
    expect(wrenStock?.overall).toBe('Mixed');
    expect(wrenStock?.reasons).toEqual([
      'Waits have been very long.',
      'Training has been a regular gym session.',
    ]);

    const niaQuality = quality.named[0];
    const omarQuality = quality.named[1];
    const wrenQuality = quality.named[2];
    expect(niaQuality?.components?.wait).toBeCloseTo(niaStock?.components?.wait ?? 0, 10);
    expect(niaQuality?.components?.training).toBe(1);
    expect(niaQuality?.composite).toBeCloseTo(0.6757555805440137, 10);
    expect(niaQuality?.overall).toBe('Mixed');
    expect(niaQuality?.reasons).toEqual([
      'Waits have been very long.',
      'Training setup has been strong.',
    ]);
    expect(omarQuality?.composite).toBeCloseTo(0.6687169943859763, 10);
    expect(omarQuality?.overall).toBe('Mixed');
    expect(wrenQuality?.composite).toBeCloseTo(0.6934218732615176, 10);
    expect(wrenQuality?.overall).toBe('Mixed');

    const niaCapacity = capacity.named[0];
    const omarCapacity = capacity.named[1];
    const wrenCapacity = capacity.named[2];
    expect(niaCapacity?.components?.wait).toBeCloseTo(0.5786213355567446, 10);
    expect(niaCapacity?.components?.training).toBe(0.82);
    expect(niaCapacity?.composite).toBeCloseTo(0.7799547942004615, 10);
    expect(niaCapacity?.overall).toBe('Mixed');
    expect(niaCapacity?.reasons).toEqual([
      'Waiting has been more reasonable.',
      'Training has been a regular gym session.',
    ]);
    expect(omarCapacity?.components?.wait).toBeCloseTo(0.7279314942997821, 10);
    expect(omarCapacity?.composite).toBeCloseTo(0.8419793765980876, 10);
    expect(omarCapacity?.overall).toBe('Good');
    expect(omarCapacity?.reasons).toEqual([
      'Service has been prompt.',
      'Training has been a regular gym session.',
    ]);
    expect(wrenCapacity?.components?.wait).toBeCloseTo(0.5525878120468001, 10);
    expect(wrenCapacity?.composite).toBeCloseTo(0.7680775146678058, 10);
    expect(wrenCapacity?.overall).toBe('Mixed');
    expect(wrenCapacity?.reasons).toEqual([
      'Waiting has been more reasonable.',
      'Training has been a regular gym session.',
    ]);

    const niaThroughput = throughput.named[0];
    const omarThroughput = throughput.named[1];
    const wrenThroughput = throughput.named[2];
    expect(niaThroughput?.components?.wait).toBeCloseTo(0.42143473678526294, 10);
    expect(niaThroughput?.components?.training).toBe(0.82);
    expect(niaThroughput?.composite).toBeCloseTo(0.7017483399763027, 10);
    expect(niaThroughput?.overall).toBe('Mixed');
    expect(niaThroughput?.reasons).toEqual([
      'Waits have been long.',
      'Training has been a regular gym session.',
    ]);
    expect(omarThroughput?.components?.wait).toBeCloseTo(0.4280130979233207, 10);
    expect(omarThroughput?.composite).toBeCloseTo(0.7053808048159016, 10);
    expect(omarThroughput?.overall).toBe('Mixed');
    expect(wrenThroughput?.components?.wait).toBeCloseTo(0.43208034582801913, 10);
    expect(wrenThroughput?.composite).toBeCloseTo(0.7076080876895483, 10);
    expect(wrenThroughput?.overall).toBe('Mixed');
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
