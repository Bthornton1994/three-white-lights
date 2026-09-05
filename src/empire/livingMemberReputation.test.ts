/**
 * livingMemberReputation.test.ts — Stage G.2E type rates, occupancy window
 * math, and player-facing copy. Roster settlement lives in the integration
 * file.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { livingMemberDuesOccupancyUntilSeconds } from './livingMemberDues';
import {
  appendLivingMemberReputationSettlement,
  createLivingMemberReputationLedger,
  createLivingMemberReputationSettlement,
  lastLivingMemberReputationSettlement,
  livingMemberDailyReputation,
  livingMemberReputationCreditedDelta,
  livingMemberReputationForInterval,
  livingMemberReputationForWindow,
  playerFacingReputationLine,
} from './livingMemberReputation';
import { createLivingMemberStayState } from './livingMemberStay';
import type { GymMemberId, LivingGymMember, ServiceVisitRecord } from './livingMembers';
import { isHighPayingMemberType, memberReputationPerDay } from './members';

const HERE = dirname(fileURLToPath(import.meta.url));
const DAY = EMPIRE_TUNING.SECONDS_PER_DAY;

function codeOf(file: string): string {
  const source = readFileSync(join(HERE, file), 'utf8');
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
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

describe('Stage G.2E — daily reputation from published type rates', () => {
  it('uses the published type rate, including zero for Casual, without inventing a composite', () => {
    const nia = memberNamed('Nia', 'casual');
    expect(livingMemberDailyReputation(nia)).toBe(0);
    expect(livingMemberDailyReputation(nia)).toBe(memberReputationPerDay('casual'));
    expect(livingMemberDailyReputation(memberNamed('Omar', 'powerlifter'))).toBe(
      memberReputationPerDay('powerlifter'),
    );
    expect(livingMemberDailyReputation(memberNamed('Wren', 'serious-lifter'))).toBe(
      memberReputationPerDay('serious-lifter'),
    );
  });

  it('does not scale with formed experience — GDD does not say reputation follows satisfaction', () => {
    const visits: readonly ServiceVisitRecord[] = Object.freeze([
      Object.freeze({
        stationKind: 'training' as const,
        stationKey: 'training:competition-bench-bay',
        queueWaitTicks: 0,
        trainingExperience: EMPIRE_TUNING.STATION_QUALITY_TRAINING_EXPERIENCE,
        outcome: 'completed' as const,
        observedAtTick: 1,
      }),
    ]);
    const forming = memberNamed('Nia', 'powerlifter');
    const formed = memberNamed('Nia', 'powerlifter', visits);
    expect(livingMemberDailyReputation(forming)).toBe(livingMemberDailyReputation(formed));
  });

  it('orders powerlifter and serious-lifter above the rest, matching members.ts', () => {
    expect(memberReputationPerDay('powerlifter')).toBeGreaterThan(memberReputationPerDay('casual'));
    expect(memberReputationPerDay('powerlifter')).toBe(memberReputationPerDay('serious-lifter'));
    expect(memberReputationPerDay('powerlifter')).toBeGreaterThan(
      memberReputationPerDay('bodybuilder'),
    );
    expect(memberReputationPerDay('athlete')).toBe(memberReputationPerDay('bodybuilder'));
  });
});

describe('Stage G.2E — clock window math', () => {
  it('credits a full day of the type rate for a member present the whole day', () => {
    const nia = memberNamed('Nia', 'powerlifter');
    expect(livingMemberReputationForInterval(nia, 0, DAY)).toBe(memberReputationPerDay('powerlifter'));
    expect(livingMemberReputationForInterval(memberNamed('Omar', 'casual'), 0, DAY)).toBe(0);
  });

  it('pro-rates a join that happens mid-window', () => {
    const nia = memberNamed('Nia', 'powerlifter', Object.freeze([]), DAY / 2);
    expect(livingMemberReputationForInterval(nia, 0, DAY)).toBe(
      memberReputationPerDay('powerlifter') / 2,
    );
    expect(livingMemberReputationForInterval(nia, 0, DAY / 2)).toBe(0);
  });

  it('occupies the open GymHost tick when a departure is stamped on the window start', () => {
    const nia = memberNamed('Nia', 'powerlifter');
    const omar = memberNamed('Omar', 'serious-lifter', Object.freeze([]), 0, 1);
    const openMark = EMPIRE_TUNING.WALL_CLOCK_TICK_INTERVAL_SECONDS;
    expect(livingMemberDuesOccupancyUntilSeconds(0, 0, DAY)).toBe(openMark);
    expect(
      livingMemberReputationForWindow(Object.freeze([nia]), 0, DAY, Object.freeze([
        { member: omar, departedAtSeconds: 0 },
      ])),
    ).toBe(
      memberReputationPerDay('powerlifter') +
        livingMemberReputationForInterval(omar, 0, DAY, openMark),
    );
  });

  it('sums active members with departed stubs and ignores a zero-length window', () => {
    const nia = memberNamed('Nia', 'powerlifter');
    const omar = memberNamed('Omar', 'serious-lifter', Object.freeze([]), 0, 1);
    const pair: readonly LivingGymMember[] = Object.freeze([nia, omar]);
    expect(livingMemberReputationForWindow(pair, 0, DAY)).toBe(
      memberReputationPerDay('powerlifter') + memberReputationPerDay('serious-lifter'),
    );
    expect(livingMemberReputationForWindow(pair, 40, 40)).toBe(0);
    expect(
      livingMemberReputationForWindow(Object.freeze([nia]), 0, DAY, Object.freeze([
        { member: omar, departedAtSeconds: DAY / 2 },
      ])),
    ).toBeCloseTo(
      memberReputationPerDay('powerlifter') + memberReputationPerDay('serious-lifter') / 2,
      10,
    );
  });

  it('refuses occupancy that names an active member or a duplicate departed identity', () => {
    const nia = memberNamed('Nia', 'powerlifter');
    const other = memberNamed('Omar', 'athlete', Object.freeze([]), 0, 1);
    expect(() =>
      livingMemberReputationForWindow(Object.freeze([nia]), 0, DAY, Object.freeze([
        { member: nia, departedAtSeconds: DAY / 2 },
      ])),
    ).toThrow(/active member/);
    expect(() =>
      livingMemberReputationForWindow(Object.freeze([nia]), 0, DAY, Object.freeze([
        { member: other, departedAtSeconds: DAY / 2 },
        { member: other, departedAtSeconds: DAY / 4 },
      ])),
    ).toThrow(/twice/);
  });
});

describe('Stage G.2E — ledger helpers and copy', () => {
  it('archives a settlement and returns the last one', () => {
    const ledger = createLivingMemberReputationLedger(0);
    expect(lastLivingMemberReputationSettlement(ledger.settlements)).toBeNull();
    const record = createLivingMemberReputationSettlement(0, DAY, 0.45);
    expect(record.fromSeconds).toBe(0);
    expect(record.toSeconds).toBe(DAY);
    expect(record.reputation).toBe(0.45);
    expect(lastLivingMemberReputationSettlement(Object.freeze([record]))).toBe(record);
    expect(() =>
      appendLivingMemberReputationSettlement(createLivingMemberReputationLedger(10), record),
    ).toThrow(/does not continue/);
  });

  it('reports a positive ledger delta and leaves a zero delta as identity', () => {
    const before = createLivingMemberReputationLedger(0);
    const after = appendLivingMemberReputationSettlement(
      before,
      createLivingMemberReputationSettlement(0, DAY, 0.45),
    );
    expect(livingMemberReputationCreditedDelta(before, after)).toBe(0.45);
    expect(livingMemberReputationCreditedDelta(after, after)).toBe(0);
  });

  it('names the daily rate without a percent, countdown, or Career claim', () => {
    const rate = livingMemberDailyReputation(memberNamed('Nia', 'powerlifter'));
    const line = playerFacingReputationLine(rate);
    expect(line).toBe(`REP ${rate} a day`);
    expect(line).not.toMatch(/%/);
    expect(line).not.toMatch(/countdown|visits left|Career|meet/i);
    expect(() => playerFacingReputationLine(-1)).toThrow(/non-negative/);
  });
});

describe('Stage G.2E — source fences', () => {
  it('does not call crowding satisfaction, aggregate reputationFromMembers, Career, or NpcLifter', () => {
    const source = codeOf('livingMemberReputation.ts');
    expect(source).toMatch(/memberReputationPerDay/);
    expect(source).not.toMatch(/memberSatisfaction\(/);
    expect(source).not.toMatch(/crowdingLoad|crowdingSatisfactionMultiplier/);
    expect(source).not.toMatch(/reputationFromMembers/);
    expect(source).not.toMatch(/memberDuesGymBucks/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/leaveProbability|churnPercentage|%/);
    expect(source).not.toMatch(/from ['"]\.\.\/game/);
    expect(source).not.toMatch(/from ['"]\.\/sportingReputation['"]/);
    expect(source).not.toMatch(/from ['"]\.\/npc['"]/);
    expect(source).not.toMatch(/NpcLifter/);
    expect(source).not.toMatch(/EmpireState/);
    expect(source).toMatch(/import type/);
    expect(isHighPayingMemberType('athlete')).toBe(true);
    expect(isHighPayingMemberType('serious-lifter')).toBe(true);
    expect(isHighPayingMemberType('powerlifter')).toBe(false);
  });
});
