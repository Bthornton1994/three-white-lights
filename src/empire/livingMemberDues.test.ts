/**
 * livingMemberDues.test.ts — Stage G.2D dues rate, forming path, window math,
 * and player-facing copy. Roster settlement lives in the integration file.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import {
  createLivingMemberDuesLedger,
  createLivingMemberDuesSettlement,
  creditLivingMemberDuesGymBucks,
  lastLivingMemberDuesSettlement,
  livingMemberDailyDuesGymBucks,
  livingMemberDuesCreditedDelta,
  livingMemberDuesForWindow,
  livingMemberDuesGymBucksForInterval,
  livingMemberDuesOccupancyUntilSeconds,
  playerFacingDuesLine,
  requireLivingMemberDuesOccupancyClock,
  requireLivingMemberDuesWindow,
  appendLivingMemberDuesSettlement,
} from './livingMemberDues';
import { livingMemberExperience } from './livingMemberExperience';
import { createLivingMemberStayState } from './livingMemberStay';
import type { GymMemberId, LivingGymMember, ServiceVisitRecord } from './livingMembers';
import { memberBaseDuesGymBucks, memberDuesGymBucks } from './members';

const HERE = dirname(fileURLToPath(import.meta.url));
const DAY = EMPIRE_TUNING.SECONDS_PER_DAY;

function codeOf(file: string): string {
  const source = readFileSync(join(HERE, file), 'utf8');
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function visit(overrides: Partial<ServiceVisitRecord> = {}): ServiceVisitRecord {
  return Object.freeze({
    stationKind: 'training',
    stationKey: 'training:competition-bench-bay',
    queueWaitTicks: 0,
    trainingExperience: EMPIRE_TUNING.STATION_QUALITY_TRAINING_EXPERIENCE,
    outcome: 'completed',
    observedAtTick: 1,
    ...overrides,
  });
}

function memberNamed(
  name: string,
  type: LivingGymMember['type'] = 'casual',
  recentVisits: readonly ServiceVisitRecord[] = Object.freeze([]),
  joinedAtSeconds: number = 0,
  ordinal: number = 0,
): LivingGymMember {
  return Object.freeze({
    id: `member:n1:${ordinal}` as GymMemberId,
    displayName: name,
    type,
    joinedAtSeconds,
    recentVisits,
    stayState: createLivingMemberStayState(),
  });
}

describe('Stage G.2D — daily dues from G.2A, not crowding', () => {
  it('pays published base while experience is forming, without inventing a composite', () => {
    const nia = memberNamed('Nia', 'casual');
    const daily = livingMemberDailyDuesGymBucks(nia);
    expect(livingMemberExperience(nia.recentVisits).status).toBe('forming');
    expect(livingMemberExperience(nia.recentVisits).composite).toBeNull();
    expect(daily.status).toBe('forming');
    expect(daily.gymBucksPerDay).toBe(memberBaseDuesGymBucks('casual'));
    expect(daily.gymBucksPerDay).not.toBe(memberDuesGymBucks('casual', 0));
    expect(daily.gymBucksPerDay).toBe(memberDuesGymBucks('casual', 1));
  });

  it('scales formed dues with accepted G.2A composite through memberDuesGymBucks', () => {
    const nia = memberNamed(
      'Nia',
      'athlete',
      Object.freeze([
        visit({
          queueWaitTicks: 70,
          trainingExperience: EMPIRE_TUNING.STATION_STOCK_TRAINING_EXPERIENCE,
          outcome: 'completed',
        }),
      ]),
    );
    const experience = livingMemberExperience(nia.recentVisits);
    expect(experience.status).toBe('formed');
    expect(experience.composite).not.toBeNull();
    const daily = livingMemberDailyDuesGymBucks(nia);
    expect(daily.status).toBe('formed');
    expect(daily.gymBucksPerDay).toBe(memberDuesGymBucks('athlete', experience.composite as number));
    expect(daily.gymBucksPerDay).toBeLessThan(memberBaseDuesGymBucks('athlete'));
    expect(daily.gymBucksPerDay).toBeGreaterThan(memberDuesGymBucks('athlete', 0));
  });

  it('orders type bases the same way members.ts already does', () => {
    const casual = livingMemberDailyDuesGymBucks(memberNamed('A', 'casual'));
    const bodybuilder = livingMemberDailyDuesGymBucks(memberNamed('B', 'bodybuilder'));
    const powerlifter = livingMemberDailyDuesGymBucks(memberNamed('C', 'powerlifter'));
    const athlete = livingMemberDailyDuesGymBucks(memberNamed('D', 'athlete'));
    const serious = livingMemberDailyDuesGymBucks(memberNamed('E', 'serious-lifter'));
    expect(casual.gymBucksPerDay).toBeLessThan(bodybuilder.gymBucksPerDay);
    expect(bodybuilder.gymBucksPerDay).toBe(powerlifter.gymBucksPerDay);
    expect(bodybuilder.gymBucksPerDay).toBeLessThan(athlete.gymBucksPerDay);
    expect(athlete.gymBucksPerDay).toBe(serious.gymBucksPerDay);
  });

  it('pays more for better formed experience at the same type', () => {
    const rough = memberNamed(
      'Nia',
      'casual',
      Object.freeze([
        visit({
          queueWaitTicks: 200,
          trainingExperience: EMPIRE_TUNING.STATION_STOCK_TRAINING_EXPERIENCE,
          outcome: 'interrupted',
        }),
      ]),
    );
    const strong = memberNamed('Nia', 'casual', Object.freeze([visit()]));
    expect(livingMemberDailyDuesGymBucks(strong).gymBucksPerDay).toBeGreaterThan(
      livingMemberDailyDuesGymBucks(rough).gymBucksPerDay,
    );
  });
});

describe('Stage G.2D — clock window math', () => {
  it('credits a full day of forming base for a member present the whole day', () => {
    const nia = memberNamed('Nia', 'casual');
    expect(livingMemberDuesGymBucksForInterval(nia, 0, DAY)).toBe(memberBaseDuesGymBucks('casual'));
  });

  it('pro-rates a join that happens mid-window', () => {
    const nia = memberNamed('Nia', 'casual', Object.freeze([]), DAY / 2);
    expect(livingMemberDuesGymBucksForInterval(nia, 0, DAY)).toBe(
      memberBaseDuesGymBucks('casual') / 2,
    );
    expect(livingMemberDuesGymBucksForInterval(nia, 0, DAY / 2)).toBe(0);
    const later = memberNamed('Nia', 'casual', Object.freeze([]), DAY);
    expect(livingMemberDuesGymBucksForInterval(later, 0, DAY / 2)).toBe(0);
  });

  it('pro-rates a mid-window departure through untilSeconds', () => {
    const nia = memberNamed('Nia', 'casual');
    expect(livingMemberDuesGymBucksForInterval(nia, 0, DAY, DAY / 2)).toBe(
      memberBaseDuesGymBucks('casual') / 2,
    );
    expect(livingMemberDuesGymBucksForInterval(nia, 0, DAY, 0)).toBe(0);
    expect(livingMemberDuesGymBucksForInterval(nia, DAY / 2, DAY, DAY / 2)).toBe(0);
  });

  it('occupies the open GymHost tick when a departure is stamped on the window start', () => {
    const nia = memberNamed('Nia', 'casual');
    const omar = memberNamed('Omar', 'athlete', Object.freeze([]), 0, 1);
    const openMark = EMPIRE_TUNING.WALL_CLOCK_TICK_INTERVAL_SECONDS;
    expect(livingMemberDuesOccupancyUntilSeconds(0, 0, DAY)).toBe(openMark);
    expect(livingMemberDuesOccupancyUntilSeconds(DAY / 2, 0, DAY)).toBe(DAY / 2);
    expect(livingMemberDuesOccupancyUntilSeconds(0, 0, 1)).toBe(1);
    expect(
      livingMemberDuesForWindow(Object.freeze([nia]), 0, DAY, Object.freeze([
        { member: omar, departedAtSeconds: 0 },
      ])),
    ).toBe(
      memberBaseDuesGymBucks('casual') +
        livingMemberDuesGymBucksForInterval(omar, 0, DAY, openMark),
    );
  });

  it('sums active members with departed stubs and ignores a zero-length window', () => {
    const nia = memberNamed('Nia', 'casual');
    const omar = memberNamed('Omar', 'athlete', Object.freeze([]), 0, 1);
    const pair: readonly LivingGymMember[] = Object.freeze([nia, omar]);
    expect(livingMemberDuesForWindow(pair, 0, DAY)).toBe(
      memberBaseDuesGymBucks('casual') + memberBaseDuesGymBucks('athlete'),
    );
    expect(livingMemberDuesForWindow(pair, 40, 40)).toBe(0);
    expect(
      livingMemberDuesForWindow(Object.freeze([nia]), 0, DAY, Object.freeze([
        { member: omar, departedAtSeconds: DAY / 2 },
      ])),
    ).toBe(memberBaseDuesGymBucks('casual') + memberBaseDuesGymBucks('athlete') / 2);
  });

  it('refuses a backward window, a negative mark, and occupancy that leaves before join', () => {
    expect(() => requireLivingMemberDuesWindow(10, 9)).toThrow(/earlier than start/);
    expect(() => requireLivingMemberDuesWindow(-1, 10)).toThrow(/non-negative/);
    expect(() => requireLivingMemberDuesWindow(0, Number.NaN)).toThrow(/non-negative/);
    expect(() => createLivingMemberDuesLedger(-1)).toThrow(/settledAtSeconds/);
    expect(() => createLivingMemberDuesSettlement(0, 0, 1)).toThrow(/positive interval/);
    expect(() => createLivingMemberDuesSettlement(0, DAY, -1)).toThrow(/non-negative/);
    expect(() => requireLivingMemberDuesOccupancyClock(-1, 0)).toThrow(/non-negative/);
    expect(() => requireLivingMemberDuesOccupancyClock(1, 2)).toThrow(/earlier than joinedAtSeconds/);
    const nia = memberNamed('Nia', 'casual');
    const other = memberNamed('Omar', 'athlete', Object.freeze([]), 0, 1);
    expect(() => livingMemberDuesGymBucksForInterval(nia, 0, DAY, nia.joinedAtSeconds - 1)).toThrow(
      /non-negative/,
    );
    expect(() =>
      livingMemberDuesForWindow(Object.freeze([nia]), 0, DAY, Object.freeze([
        { member: nia, departedAtSeconds: DAY / 2 },
      ])),
    ).toThrow(/active member/);
    expect(() =>
      livingMemberDuesForWindow(Object.freeze([nia]), 0, DAY, Object.freeze([
        { member: other, departedAtSeconds: DAY / 2 },
        { member: other, departedAtSeconds: DAY / 4 },
      ])),
    ).toThrow(/twice/);
    const late = memberNamed('Nia', 'casual', Object.freeze([]), DAY, 2);
    expect(() =>
      livingMemberDuesForWindow(Object.freeze([]), 0, DAY, Object.freeze([
        { member: late, departedAtSeconds: DAY / 2 },
      ])),
    ).toThrow(/earlier than joinedAtSeconds/);
  });
});

describe('Stage G.2D — ledger helpers and copy', () => {
  it('archives a settlement and returns the last one', () => {
    const ledger = createLivingMemberDuesLedger(0);
    expect(lastLivingMemberDuesSettlement(ledger.settlements)).toBeNull();
    const record = createLivingMemberDuesSettlement(0, DAY, 60);
    expect(record.fromSeconds).toBe(0);
    expect(record.toSeconds).toBe(DAY);
    expect(record.gymBucks).toBe(60);
    expect(lastLivingMemberDuesSettlement(Object.freeze([record]))).toBe(record);
    expect(() =>
      appendLivingMemberDuesSettlement(createLivingMemberDuesLedger(10), record),
    ).toThrow(/does not continue/);
  });

  it('credits a positive ledger delta onto the purse and leaves a zero delta as identity', () => {
    expect(creditLivingMemberDuesGymBucks(10, 0)).toBe(10);
    expect(creditLivingMemberDuesGymBucks(10, 5)).toBe(15);
    const before = createLivingMemberDuesLedger(0);
    const after = appendLivingMemberDuesSettlement(
      before,
      createLivingMemberDuesSettlement(0, DAY, 60),
    );
    expect(livingMemberDuesCreditedDelta(before, after)).toBe(60);
    expect(livingMemberDuesCreditedDelta(after, after)).toBe(0);
    expect(() => creditLivingMemberDuesGymBucks(10, -1)).toThrow(/non-negative/);
    expect(() => creditLivingMemberDuesGymBucks(Number.NaN, 1)).toThrow(/finite number/);
  });

  it('names the daily rate without a percent, countdown, or reputation claim', () => {
    const daily = livingMemberDailyDuesGymBucks(memberNamed('Nia'));
    const line = playerFacingDuesLine(daily);
    expect(line).toBe(`DUES ${daily.gymBucksPerDay} gym bucks a day`);
    expect(line).not.toMatch(/%/);
    expect(line).not.toMatch(/reputation/i);
    expect(line).not.toMatch(/countdown|visits left/i);
  });
});

describe('Stage G.2D — source fences', () => {
  it('does not call crowding satisfaction, reputation, Career, or NpcLifter', () => {
    const source = codeOf('livingMemberDues.ts');
    expect(source).toMatch(/memberDuesGymBucks/);
    expect(source).toMatch(/memberBaseDuesGymBucks/);
    expect(source).toMatch(/livingMemberExperience/);
    expect(source).not.toMatch(/memberSatisfaction\(/);
    expect(source).not.toMatch(/crowdingLoad|crowdingSatisfactionMultiplier/);
    expect(source).not.toMatch(/reputationFromMembers/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/leaveProbability|churnPercentage|%/);
    expect(source).not.toMatch(/from ['"]\.\.\/game/);
    expect(source).not.toMatch(/from ['"]\.\/sportingReputation['"]/);
    expect(source).not.toMatch(/from ['"]\.\/npc['"]/);
    expect(source).not.toMatch(/NpcLifter/);
    expect(source).not.toMatch(/ladderIncomeRatePerHour|accrueLadderGymBucks/);
    expect(source).not.toMatch(/^import \{[^}]*\} from ['"]\.\/livingMembers['"]/m);
    expect(source).toMatch(/import type/);
    expect(source).toMatch(/requireLivingMemberDuesOccupancyClock/);
    expect(source).toMatch(/departedAtSeconds/);
  });
});
