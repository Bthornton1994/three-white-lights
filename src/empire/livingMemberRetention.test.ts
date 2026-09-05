/**
 * livingMemberRetention.test.ts — Stage G.2B retention-pressure foundation.
 *
 * Common mapping candidates, Garage fixture tables, human-history rows,
 * synthetic boundaries, and the NARROW type-response comparison live here
 * as runnable numbers. The shipped function is type-blind linear inverse.
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
  livingMemberExperience,
  type LivingMemberExperience,
} from './livingMemberExperience';
import {
  LIVING_MEMBER_RETENTION_STATUSES,
  livingMemberRetentionPressure,
} from './livingMemberRetention';
import { type MemberType } from './members';
import { stockStationCapability, withStationAxis } from './stationCapability';
import { COMPETITION_BENCH_BAY } from './trainingStation';

const T = EMPIRE_TUNING;
const KIT = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);
const HERE = dirname(fileURLToPath(import.meta.url));
const RETENTION_SOURCE = readFileSync(join(HERE, 'livingMemberRetention.ts'), 'utf8');
const RETENTION_CODE = RETENTION_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const KNOBS = T.LIVING_MEMBER_RETENTION;

function visit(
  partial: Partial<ServiceVisitRecord> & Pick<ServiceVisitRecord, 'queueWaitTicks'>,
): ServiceVisitRecord {
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

function collectGarage(capability = stockStationCapability()) {
  const opening = createLivingMemberRoster('garage', KIT, [], 0, T.FLOOR_SIM_RENDER_SEED);
  const context = garageContext(capability);
  let state = createFloorSimState(context, T.FLOOR_SIM_RENDER_SEED);
  const observations = [];
  for (let tick = 0; tick < 1000; tick += 1) {
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
  const { roster } = collectGarage(capability);
  const formed = roster.members
    .map((member) => {
      const experience = livingMemberExperience(member.recentVisits);
      const retention = livingMemberRetentionPressure(experience);
      return Object.freeze({ member, experience, retention });
    })
    .filter((row) => row.experience.status === 'formed');
  const meanOf = (values: readonly number[]): number =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  return Object.freeze({
    roster,
    formedMemberCount: formed.length,
    meanComposite: meanOf(formed.map((row) => row.experience.composite ?? 0)),
    meanPressure: meanOf(formed.map((row) => row.retention.pressure ?? 0)),
    overall: tally(formed.map((row) => row.experience.labels.overall)),
    waitLabels: tally(formed.map((row) => row.experience.labels.wait)),
    membership: tally(formed.map((row) => row.retention.label)),
    named: Object.freeze(
      ['Nia', 'Omar', 'Wren'].map((name) => {
        const member = roster.members.find((row) => row.displayName === name);
        if (member === undefined) throw new Error(`expected ${name}`);
        const experience = livingMemberExperience(member.recentVisits);
        const retention = livingMemberRetentionPressure(experience);
        return Object.freeze({
          name,
          id: member.id,
          type: member.type,
          sampleCount: experience.sampleCount,
          composite: experience.composite,
          overall: experience.labels.overall,
          waitLabel: experience.labels.wait,
          trainingLabel: experience.labels.training,
          reliabilityLabel: experience.labels.reliability,
          waitScore: experience.components?.wait ?? null,
          pressure: retention.pressure,
          membership: retention.label,
          reasons: retention.reasons.map((reason) => reason.text),
        });
      }),
    ),
  });
}

function tally(labels: readonly string[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const label of labels) counts[label] = (counts[label] ?? 0) + 1;
  return Object.freeze(counts);
}

function linearPressure(composite: number): number {
  return Math.min(1, Math.max(0, 1 - composite));
}

function convexPressure(composite: number): number {
  const gap = Math.min(1, Math.max(0, 1 - composite));
  return gap * gap;
}

/** Logistic centered at Mixed/Rough midpoint 0.535 with k = 8. */
function logisticPressure(composite: number): number {
  const midpoint = (T.LIVING_MEMBER_EXPERIENCE.overallMixedMin + T.LIVING_MEMBER_EXPERIENCE.overallRoughMin) / 2;
  const k = 8;
  return 1 / (1 + Math.exp(k * (composite - midpoint)));
}

function clampUnit(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * NARROW GDD-backed comparison only. Not shipped.
 * Casual extra is wait-tolerance, not a second claim that service was worse.
 * Serious scales pressure down; it does not rewrite G.2A labels.
 */
function narrowPressure(base: number, type: MemberType, waitScore: number): number {
  if (type === 'casual') return clampUnit(base + 0.15 * (1 - waitScore));
  if (type === 'serious-lifter') return clampUnit(base * 0.85);
  return base;
}

function formedFromComposite(composite: number, wait = 0.5): LivingMemberExperience {
  return Object.freeze({
    sampleCount: 5,
    status: 'formed',
    components: Object.freeze({ wait, training: 0.82, reliability: 1 }),
    composite,
    reasons: Object.freeze([
      Object.freeze({ kind: 'wait' as const, text: wait < 0.38 ? 'Waits have been very long.' : 'Service has been prompt.' }),
      Object.freeze({ kind: 'training' as const, text: 'Training has been a regular gym session.' }),
    ]),
    labels: Object.freeze({
      overall: 'Mixed',
      wait: 'Strained',
      training: 'Solid',
      reliability: 'Steady',
    }),
  });
}

describe('Stage G.2B — forming experience produces forming retention', () => {
  // HYG-001: this case is live; the old bracket id was a stage label, not a
  // guarantee-tag declaration (no matching comment existed). Title marker retired.
  it('carries no numeric pressure and no stay-risk label', () => {
    const experience = livingMemberExperience([]);
    const retention = livingMemberRetentionPressure(experience);
    expect(experience.status).toBe('forming');
    expect(retention.status).toBe('forming');
    expect(retention.pressure).toBeNull();
    expect(retention.label).toBe('Still forming');
    expect(retention.reasons).toEqual([
      { kind: 'forming', text: 'Membership is still forming.' },
    ]);
    expect(retention.label).not.toBe('Stable');
    expect(retention.label).not.toBe('Watching');
    expect(retention.label).not.toBe('Strained');
    expect(retention.label).not.toBe('At risk');
    expect(LIVING_MEMBER_RETENTION_STATUSES).toEqual(['forming', 'formed']);
  });
});

describe('Stage G.2B — common pressure mapping candidates', () => {
  const composites = Object.freeze([0, 0.2, 0.45, 0.535, 0.62, 0.78, 1]);

  it('keeps every candidate monotone, with experience 1 at minimum pressure', () => {
    for (const mapping of [linearPressure, convexPressure, logisticPressure]) {
      let previous = mapping(0);
      expect(mapping(1)).toBeLessThanOrEqual(previous);
      for (const composite of composites) {
        const pressure = mapping(composite);
        expect(pressure).toBeGreaterThanOrEqual(0);
        expect(pressure).toBeLessThanOrEqual(1);
        expect(pressure).toBeLessThanOrEqual(previous + Number.EPSILON);
        previous = pressure;
      }
      expect(mapping(1)).toBeLessThan(mapping(0));
    }
    expect(linearPressure(1)).toBe(0);
    expect(linearPressure(0)).toBe(1);
    expect(convexPressure(1)).toBe(0);
    expect(convexPressure(0)).toBe(1);
    expect(logisticPressure(1)).toBeGreaterThan(0);
    expect(logisticPressure(1)).toBeLessThan(0.03);
    expect(logisticPressure(0)).toBeGreaterThan(0.97);
    expect(logisticPressure(0)).toBeLessThan(1);
    expect((T.LIVING_MEMBER_EXPERIENCE.overallMixedMin + T.LIVING_MEMBER_EXPERIENCE.overallRoughMin) / 2).toBeCloseTo(
      0.535,
      10,
    );
  });

  it('chooses linear inverse because convex compresses the played band and logistic misses the endpoints', () => {
    const stock = 0.6358163851139348;
    const quality = 0.6792981493971691;
    const throughput = 0.704912410827251;
    const capacity = 0.7966705618221184;
    expect(linearPressure(stock)).toBeCloseTo(0.3641836148860652, 10);
    expect(linearPressure(quality)).toBeCloseTo(0.3207018506028309, 10);
    expect(linearPressure(throughput)).toBeCloseTo(0.295087589172749, 10);
    expect(linearPressure(capacity)).toBeCloseTo(0.2033294381778816, 10);
    expect(convexPressure(capacity) / convexPressure(stock)).toBeLessThan(
      linearPressure(capacity) / linearPressure(stock),
    );
    expect(logisticPressure(0.535)).toBeCloseTo(0.5, 10);
    const shipped = livingMemberRetentionPressure(formedFromComposite(stock));
    expect(shipped.pressure).toBeCloseTo(linearPressure(stock), 10);
    expect(shipped.pressure).not.toBeCloseTo(convexPressure(stock), 3);
    expect(shipped.pressure).not.toBeCloseTo(logisticPressure(stock), 3);
  });
});

describe('Stage G.2B — base pressure is deterministic, bounded, and monotone', () => {
  it('never raises pressure when experience improves', () => {
    let previous = livingMemberRetentionPressure(formedFromComposite(0)).pressure ?? 1;
    expect(previous).toBe(1);
    for (let step = 1; step <= 100; step += 1) {
      const composite = step / 100;
      const pressure = livingMemberRetentionPressure(formedFromComposite(composite)).pressure;
      expect(pressure).not.toBeNull();
      expect(pressure ?? 1).toBeGreaterThanOrEqual(0);
      expect(pressure ?? 0).toBeLessThanOrEqual(1);
      expect(pressure ?? 1).toBeLessThanOrEqual(previous);
      previous = pressure ?? 0;
    }
    expect(livingMemberRetentionPressure(formedFromComposite(1)).pressure).toBe(0);
  });

  it('does not cliff at Good / Mixed / Rough / Poor presentation bands', () => {
    const bands = Object.freeze([
      T.LIVING_MEMBER_EXPERIENCE.overallGoodMin,
      T.LIVING_MEMBER_EXPERIENCE.overallMixedMin,
      T.LIVING_MEMBER_EXPERIENCE.overallRoughMin,
    ]);
    for (const band of bands) {
      const below = livingMemberRetentionPressure(formedFromComposite(band - 0.001)).pressure ?? 1;
      const at = livingMemberRetentionPressure(formedFromComposite(band)).pressure ?? 1;
      const above = livingMemberRetentionPressure(formedFromComposite(band + 0.001)).pressure ?? 1;
      expect(below).toBeGreaterThan(at);
      expect(at).toBeGreaterThan(above);
      expect(below - at).toBeCloseTo(0.001, 10);
      expect(at - above).toBeCloseTo(0.001, 10);
    }
  });
});

describe('Stage G.2B — input authority', () => {
  it('consumes accepted LivingMemberExperience and ignores displayName / QCT / crowding', () => {
    expect(RETENTION_CODE).not.toMatch(/memberSatisfaction/);
    expect(RETENTION_CODE).not.toMatch(/crowdingLoad/);
    expect(RETENTION_CODE).not.toMatch(/crowdingSatisfactionMultiplier/);
    expect(RETENTION_CODE).not.toMatch(/MEMBER_TYPE_CROWDING_SENSITIVITY/);
    expect(RETENTION_CODE).not.toMatch(/equipmentFitScore/);
    expect(RETENTION_CODE).not.toMatch(/memberDuesGymBucks/);
    expect(RETENTION_CODE).not.toMatch(/reputationFromMembers/);
    expect(RETENTION_CODE).not.toMatch(/qualityOwned/);
    expect(RETENTION_CODE).not.toMatch(/capacityOwned/);
    expect(RETENTION_CODE).not.toMatch(/throughputOwned/);
    expect(RETENTION_CODE).not.toMatch(/displayName/);
    expect(RETENTION_CODE).not.toMatch(/from '\.\/members'/);
    expect(RETENTION_CODE).not.toMatch(/MemberType/);
  });

  it('is not a probability and does not name a leave chance', () => {
    expect(RETENTION_CODE).not.toMatch(/leaveProbability/);
    expect(RETENTION_CODE).not.toMatch(/churnChance/);
    expect(RETENTION_CODE).not.toMatch(/dailyRisk/);
    expect(RETENTION_CODE).not.toMatch(/%/);
    const retention = livingMemberRetentionPressure(
      livingMemberExperience(repeats(visit({ queueWaitTicks: 128 }), 5)),
    );
    expect(retention.label).not.toMatch(/%/);
    expect(JSON.stringify(retention)).not.toMatch(/chance|churn|quit/i);
  });
});

describe('Stage G.2B — type layer is unshipped; G.2A stays byte-identical', () => {
  const history = repeats(visit({ queueWaitTicks: 128 }), 5);

  it('keeps G.2A experience byte-identical across member types', () => {
    const baseline = JSON.stringify(livingMemberExperience(history));
    for (const type of T.MEMBER_TYPES) {
      expect(JSON.stringify(livingMemberExperience(history)), type).toBe(baseline);
    }
    const shipped = livingMemberRetentionPressure(livingMemberExperience(history));
    expect(shipped.pressure).toBeCloseTo(linearPressure(livingMemberExperience(history).composite ?? 0), 10);
  });

  it('does not invent Bodybuilder, Powerlifter, or Athlete retention quirks in the shipped function', () => {
    expect(RETENTION_CODE).not.toMatch(/bodybuilder/);
    expect(RETENTION_CODE).not.toMatch(/powerlifter/);
    expect(RETENTION_CODE).not.toMatch(/athlete/);
    expect(RETENTION_CODE).not.toMatch(/season/);
    expect(RETENTION_CODE).not.toMatch(/casual/);
    expect(RETENTION_CODE).not.toMatch(/serious-lifter/);
  });

  it('compares NARROW GDD-backed response without shipping it', () => {
    const good = livingMemberExperience(repeats(visit({ queueWaitTicks: 0 }), 5));
    const mixed = livingMemberExperience(repeats(visit({ queueWaitTicks: 95 }), 5));
    const rough = livingMemberExperience(repeats(visit({ queueWaitTicks: 180 }), 5));
    const poor = livingMemberExperience(repeats(visit({ queueWaitTicks: 300 }), 5));
    const rows = Object.freeze([
      { name: 'Good', experience: good },
      { name: 'Mixed', experience: mixed },
      { name: 'Rough', experience: rough },
      { name: 'Poor', experience: poor },
    ]);
    for (const row of rows) {
      const base = livingMemberRetentionPressure(row.experience).pressure;
      expect(base, row.name).not.toBeNull();
      const wait = row.experience.components?.wait ?? 1;
      const casual = narrowPressure(base ?? 0, 'casual', wait);
      const serious = narrowPressure(base ?? 0, 'serious-lifter', wait);
      const bodybuilder = narrowPressure(base ?? 0, 'bodybuilder', wait);
      const powerlifter = narrowPressure(base ?? 0, 'powerlifter', wait);
      const athlete = narrowPressure(base ?? 0, 'athlete', wait);
      expect(bodybuilder, row.name).toBe(base);
      expect(powerlifter, row.name).toBe(base);
      expect(athlete, row.name).toBe(base);
      expect(casual, row.name).toBeGreaterThanOrEqual(base ?? 0);
      expect(serious, row.name).toBeLessThanOrEqual(base ?? 0);
      expect(casual - (base ?? 0), `${row.name} casual extra`).toBeLessThanOrEqual(0.15 + Number.EPSILON);
      expect((base ?? 0) - serious, `${row.name} serious relief`).toBeLessThanOrEqual((base ?? 0) * 0.15 + Number.EPSILON);
    }
    expect(good.labels.overall).toBe('Good');
    expect(good.labels.training).toBe('Solid');
    expect(mixed.labels.overall).toBe('Mixed');
    expect(rough.labels.overall).toBe('Rough');
    expect(poor.labels.overall).toBe('Poor');
    const casualGood = narrowPressure(livingMemberRetentionPressure(good).pressure ?? 0, 'casual', good.components?.wait ?? 1);
    expect(casualGood).toBeLessThan(KNOBS.atRiskMin);
    const seriousPoor = narrowPressure(livingMemberRetentionPressure(poor).pressure ?? 0, 'serious-lifter', poor.components?.wait ?? 1);
    expect(seriousPoor).toBeGreaterThanOrEqual(KNOBS.strainedMin);
    expect(RETENTION_CODE).not.toMatch(/narrowPressure/);
  });
});

describe('Stage G.2B — Garage fixture table', () => {
  it('pins Stock / Quality / Capacity / Throughput from G.2A composites, not from ownership', () => {
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

    expect(stock.meanComposite).toBeCloseTo(0.6358163851139348, 10);
    expect(quality.meanComposite).toBeCloseTo(0.6792981493971691, 10);
    expect(capacity.meanComposite).toBeCloseTo(0.7966705618221184, 10);
    expect(throughput.meanComposite).toBeCloseTo(0.704912410827251, 10);
    expect(stock.meanPressure).toBeCloseTo(1 - 0.6358163851139348, 10);
    expect(quality.meanPressure).toBeCloseTo(1 - 0.6792981493971691, 10);
    expect(capacity.meanPressure).toBeCloseTo(1 - 0.7966705618221184, 10);
    expect(throughput.meanPressure).toBeCloseTo(1 - 0.704912410827251, 10);
    expect(quality.meanPressure).toBeLessThan(stock.meanPressure);
    expect(throughput.meanPressure).toBeLessThan(stock.meanPressure);
    expect(capacity.meanPressure).toBeLessThan(throughput.meanPressure);
    expect(stock.overall).toEqual({ Mixed: 3 });
    expect(quality.overall).toEqual({ Mixed: 3 });
    expect(capacity.overall).toEqual({ Mixed: 2, Good: 1 });
    expect(throughput.overall).toEqual({ Mixed: 3 });
    expect(stock.waitLabels).toEqual({ Rough: 3 });
    expect(quality.waitLabels).toEqual({ Rough: 3 });
    expect(capacity.waitLabels).toEqual({ Manageable: 2, Easy: 1 });
    expect(throughput.waitLabels).toEqual({ Strained: 3 });
    expect(stock.membership).toEqual({ Watching: 3 });
    expect(quality.membership).toEqual({ Watching: 3 });
    expect(throughput.membership).toEqual({ Watching: 3 });
    expect(capacity.membership).toEqual({ Watching: 2, Stable: 1 });
    expect(stock.roster.members.length).toBe(3);
    expect(quality.roster.members.length).toBe(3);
    expect(capacity.roster.members.length).toBe(3);
    expect(throughput.roster.members.length).toBe(3);
  });
});

describe('Stage G.2B — human-history table', () => {
  it('tells a membership story without pretending anyone is about to disappear', () => {
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
    const wren = stock.named[2];
    const niaQuality = quality.named[0];
    const wrenThroughput = throughput.named[2];
    const omarCapacity = capacity.named[1];
    expect(wren?.overall).toBe('Mixed');
    expect(wren?.waitLabel).toBe('Rough');
    expect(wren?.trainingLabel).toBe('Solid');
    expect(wren?.reliabilityLabel).toBe('Steady');
    expect(wren?.pressure).toBeCloseTo(1 - 0.649036051706206, 10);
    expect(wren?.membership).toBe('Watching');
    expect(wren?.reasons).toContain('Long waits are testing this membership.');
    expect(niaQuality?.trainingLabel).toBe('Excellent');
    expect(niaQuality?.waitLabel).toBe('Rough');
    expect(niaQuality?.overall).toBe('Mixed');
    expect(niaQuality?.membership).toBe('Watching');
    expect(niaQuality?.pressure).toBeCloseTo(1 - 0.6757555805440137, 10);
    expect(niaQuality?.pressure ?? 1).toBeLessThan(wren?.pressure ?? 0);
    expect(wrenThroughput?.waitLabel).toBe('Strained');
    expect(wrenThroughput?.trainingLabel).toBe('Solid');
    expect(wrenThroughput?.overall).toBe('Mixed');
    expect(wrenThroughput?.membership).toBe('Watching');
    expect(wrenThroughput?.pressure ?? 1).toBeLessThan(wren?.pressure ?? 0);
    expect(omarCapacity?.waitLabel).toBe('Easy');
    expect(omarCapacity?.trainingLabel).toBe('Solid');
    expect(omarCapacity?.overall).toBe('Good');
    expect(omarCapacity?.membership).toBe('Stable');
    expect(omarCapacity?.reasons).toContain('Recent service has been working well.');
    const oneBreak = livingMemberRetentionPressure(
      livingMemberExperience(
        Object.freeze([
          visit({ queueWaitTicks: 0, observedAtTick: 1 }),
          visit({ queueWaitTicks: 0, observedAtTick: 2 }),
          visit({ queueWaitTicks: 0, observedAtTick: 3 }),
          visit({ queueWaitTicks: 0, observedAtTick: 4 }),
          visit({ queueWaitTicks: 0, observedAtTick: 5, outcome: 'interrupted' }),
        ]),
      ),
    );
    expect(oneBreak.pressure).toBeCloseTo(1 - 0.9070232401791283, 10);
    expect(oneBreak.label).toBe('Stable');
    expect(oneBreak.reasons.map((reason) => reason.text)).toContain(
      'Interrupted sessions are creating strain.',
    );
    expect(oneBreak.reasons.map((reason) => reason.text)).toContain(
      'Recent service has been working well.',
    );
  });
});

describe('Stage G.2B — synthetic boundaries', () => {
  it('covers forming, excellent, band edges, wait/training split, and interruption counts', () => {
    const forming = livingMemberRetentionPressure(livingMemberExperience([]));
    const excellent = livingMemberRetentionPressure(
      livingMemberExperience(
        repeats(visit({ queueWaitTicks: 0, trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE }), 5),
      ),
    );
    const goodNearMixed = livingMemberRetentionPressure(formedFromComposite(0.779, 1));
    const mixedHigh = livingMemberRetentionPressure(formedFromComposite(0.77, 0.5));
    const mixedLow = livingMemberRetentionPressure(formedFromComposite(0.62, 0.4));
    const roughHigh = livingMemberRetentionPressure(formedFromComposite(0.61, 0.35));
    const roughLow = livingMemberRetentionPressure(formedFromComposite(0.45, 0.2));
    const poor = livingMemberRetentionPressure(
      livingMemberExperience(repeats(visit({ queueWaitTicks: 300 }), 5)),
    );
    const severeWaitExcellentTraining = livingMemberRetentionPressure(
      livingMemberExperience(
        repeats(
          visit({
            queueWaitTicks: 180,
            trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
          }),
          5,
        ),
      ),
    );
    const excellentWaitSolidTraining = livingMemberRetentionPressure(
      livingMemberExperience(repeats(visit({ queueWaitTicks: 0 }), 5)),
    );
    const fiveBreaks = livingMemberRetentionPressure(
      livingMemberExperience(repeats(visit({ queueWaitTicks: 0, outcome: 'interrupted' }), 5)),
    );

    expect(forming.pressure).toBeNull();
    expect(forming.label).toBe('Still forming');
    expect(excellent.pressure).toBe(0);
    expect(excellent.label).toBe('Stable');
    expect(goodNearMixed.pressure).toBeCloseTo(0.221, 10);
    expect(goodNearMixed.label).toBe('Watching');
    expect(mixedHigh.label).toBe('Watching');
    expect(mixedLow.pressure).toBeCloseTo(0.38, 10);
    expect(mixedLow.label).toBe('Watching');
    expect(roughHigh.label).toBe('Watching');
    expect(roughLow.pressure).toBeCloseTo(0.55, 10);
    expect(roughLow.label).toBe('At risk');
    expect(poor.label).toBe('At risk');
    expect(poor.pressure ?? 0).toBeGreaterThan(KNOBS.atRiskMin);
    expect(severeWaitExcellentTraining.pressure).toBeCloseTo(1 - 0.5795782787848095, 10);
    expect(severeWaitExcellentTraining.label).toBe('Strained');
    expect(excellentWaitSolidTraining.label).toBe('Stable');
    expect(fiveBreaks.pressure).toBeCloseTo(1 - 0.766876649056906, 10);
    expect(fiveBreaks.label).toBe('Watching');

    const strainedWaitQuality = livingMemberExperience(
      repeats(
        visit({
          queueWaitTicks: 80,
          trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
        }),
        5,
      ),
    );
    const strainedWaitRetention = livingMemberRetentionPressure(strainedWaitQuality);
    expect(strainedWaitQuality.labels.wait).toBe('Strained');
    expect(strainedWaitQuality.labels.training).toBe('Excellent');
    expect(strainedWaitRetention.label).toBe('Stable');
    expect(strainedWaitRetention.pressure ?? 1).toBeLessThan(KNOBS.watchingMin);
    expect(strainedWaitRetention.reasons.map((reason) => reason.text)).toEqual([
      'Long waits are testing this membership.',
      'Recent service has been working well.',
    ]);
  });
});

describe('Stage G.2B — persistence is derived, not stored', () => {
  it('leaves pressure unchanged across offline advance, relocation, and remount', () => {
    const { roster, observations } = collectGarage();
    const byId = (
      members: readonly { readonly id: string; readonly recentVisits: readonly ServiceVisitRecord[] }[],
    ) =>
      Object.fromEntries(
        members.map((member) => [
          member.id,
          livingMemberRetentionPressure(livingMemberExperience(member.recentVisits)),
        ]),
      );
    const before = byId(roster.members);
    let state = createGymViewState();
    state = gymViewReduce(state, { kind: 'apply-living-member-observations', observations });
    const afterApply = byId(state.livingMembers.members);
    expect(afterApply).toEqual(before);
    const originalIds = roster.members.map((member) => member.id);
    state = gymViewReduce(state, {
      kind: 'advance-clock',
      gapSeconds: T.SECONDS_PER_HOUR,
      mode: 'offline',
    });
    const afterOffline = byId(state.livingMembers.members);
    expect(afterOffline).toEqual(afterApply);
    expect(originalIds.every((id) => state.livingMembers.members.some((member) => member.id === id))).toBe(
      true,
    );
    const relocatedRoster = reconcileLivingMemberRosterOnRelocation(
      state.livingMembers,
      'storage-unit',
      [],
      T.SECONDS_PER_DAY,
    );
    const afterMove = byId(relocatedRoster.members);
    for (const id of originalIds) {
      expect(afterMove[id], id).toEqual(afterApply[id]);
    }
    expect(relocatedRoster.members.some((member) => originalIds.includes(member.id) === false)).toBe(true);
    const remounted = Object.freeze({ ...state });
    expect(byId(remounted.livingMembers.members)).toEqual(afterApply);
    const bucksBeforeScore = state.managed.gym.ladder.gymBucks;
    const acceleratedBeforeScore = state.managed.gym.acceleratedGymBucks;
    for (const member of state.livingMembers.members) {
      livingMemberRetentionPressure(livingMemberExperience(member.recentVisits));
    }
    expect(state.managed.gym.ladder.gymBucks).toBe(bucksBeforeScore);
    expect(state.managed.gym.acceleratedGymBucks).toBe(acceleratedBeforeScore);
  });
});

describe('Stage G.2B — fences', () => {
  it('does not retune G.2A, Q/C/T, N=5, or check-in reputation', () => {
    expect(T.LIVING_MEMBER_EXPERIENCE.waitDecayTicks).toBe(110);
    expect(T.LIVING_MEMBER_EXPERIENCE.trainingStockScore).toBe(0.82);
    expect(T.LIVING_MEMBER_EXPERIENCE.trainingQualityScore).toBe(1);
    expect(T.LIVING_MEMBER_EXPERIENCE.reliabilityInterrupted).toBe(0.55);
    expect(T.LIVING_MEMBER_EXPERIENCE.overallGoodMin).toBe(0.78);
    expect(T.LIVING_MEMBER_EXPERIENCE.overallMixedMin).toBe(0.62);
    expect(T.LIVING_MEMBER_EXPERIENCE.overallRoughMin).toBe(0.45);
    expect(T.LIVING_MEMBER_SERVICE_HISTORY_WINDOW).toBe(5);
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

  it('does not roll dice, read a clock, import Career, merge NpcLifter, or write a wallet', () => {
    expect(RETENTION_CODE).not.toMatch(/Date\.now/);
    expect(RETENTION_CODE).not.toMatch(/Math\.random/);
    expect(RETENTION_CODE).not.toMatch(/from '\.\.\/career/);
    expect(RETENTION_CODE).not.toMatch(/from '\.\/npc'/);
    expect(RETENTION_CODE).not.toMatch(/NpcLifter/);
    expect(RETENTION_CODE).not.toMatch(/portfolio/i);
    expect(RETENTION_CODE).not.toMatch(/departed/);
    expect(RETENTION_CODE).not.toMatch(/scheduleDeparture/);
    expect(RETENTION_CODE).not.toMatch(/react/);
    expect(RETENTION_CODE).toMatch(/refuseWith/);
  });

  it('does not change roster count when scoring pressure', () => {
    const { roster } = collectGarage();
    const before = roster.members.length;
    const ids = roster.members.map((member) => member.id);
    for (const member of roster.members) {
      livingMemberRetentionPressure(livingMemberExperience(member.recentVisits));
    }
    expect(roster.members.length).toBe(before);
    expect(roster.members.map((member) => member.id)).toEqual(ids);
  });
});
