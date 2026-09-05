/**
 * livingMemberArrival.test.ts — Stage G.2C3 arrival record, vacancy classifier,
 * and player-facing copy. Roster minting and FloorSim continuity live in the
 * integration file.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import {
  createLivingMemberArrivalRecord,
  lastLivingMemberArrival,
  livingMemberShouldArrive,
  playerFacingArrivalLine,
  requireLivingMemberArrivalContext,
} from './livingMemberArrival';
import { createLivingMemberStayState } from './livingMemberStay';
import type { GymMemberId, LivingGymMember } from './livingMembers';
import type { MemberType } from './members';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = EMPIRE_TUNING.HIGH_PAYING_MEMBER_ARRIVAL_REPUTATION_THRESHOLD;

function codeOf(file: string): string {
  const source = readFileSync(join(HERE, file), 'utf8');
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function memberNamed(name: string, type: MemberType = 'casual'): LivingGymMember {
  return Object.freeze({
    id: `member:n1:3` as GymMemberId,
    displayName: name,
    type,
    joinedAtSeconds: 12,
    recentVisits: Object.freeze([]),
    stayState: createLivingMemberStayState(),
  });
}

describe('Stage G.2C3 — vacancy arrival classifier', () => {
  it('refuses to mint when the facility is already at cap', () => {
    expect(livingMemberShouldArrive(0, 'casual', 'recovery', 0)).toBe(false);
    expect(livingMemberShouldArrive(-1, 'casual', 'recovery', 0)).toBe(false);
  });

  it('does not mint from forming or strain evidence', () => {
    expect(livingMemberShouldArrive(1, 'casual', 'forming', 0)).toBe(false);
    expect(livingMemberShouldArrive(1, 'casual', 'strain', 0)).toBe(false);
    expect(livingMemberShouldArrive(1, 'powerlifter', 'strain', 0)).toBe(false);
    expect(livingMemberShouldArrive(1, 'serious-lifter', 'neutral', GATE)).toBe(false);
  });

  it('lets Casual join on recovery or formed-neutral evidence', () => {
    expect(livingMemberShouldArrive(1, 'casual', 'recovery', 0)).toBe(true);
    expect(livingMemberShouldArrive(1, 'casual', 'neutral', 0)).toBe(true);
  });

  it('lets Bodybuilder and Powerlifter join only on recovery, without a reputation gate', () => {
    for (const type of ['bodybuilder', 'powerlifter'] as const) {
      expect(livingMemberShouldArrive(1, type, 'recovery', 0)).toBe(true);
      expect(livingMemberShouldArrive(1, type, 'neutral', 0)).toBe(false);
      expect(livingMemberShouldArrive(1, type, 'recovery', GATE)).toBe(true);
    }
  });

  it('lets Athlete join on recovery only when credited reputation meets the G.2E gate', () => {
    expect(livingMemberShouldArrive(1, 'athlete', 'recovery', 0)).toBe(false);
    expect(livingMemberShouldArrive(1, 'athlete', 'recovery', GATE - Number.EPSILON)).toBe(false);
    expect(livingMemberShouldArrive(1, 'athlete', 'recovery', GATE)).toBe(true);
    expect(livingMemberShouldArrive(1, 'athlete', 'neutral', GATE)).toBe(false);
  });

  it('lets Serious Lifter join only on recovery and only when credited reputation meets the G.2E gate', () => {
    expect(livingMemberShouldArrive(1, 'serious-lifter', 'recovery', 0)).toBe(false);
    expect(livingMemberShouldArrive(1, 'serious-lifter', 'recovery', GATE)).toBe(true);
    expect(livingMemberShouldArrive(1, 'serious-lifter', 'neutral', GATE)).toBe(false);
  });

  it('refuses a non-finite or negative credited reputation', () => {
    expect(() => livingMemberShouldArrive(1, 'casual', 'recovery', Number.NaN)).toThrow(
      /credited member reputation/,
    );
    expect(() => livingMemberShouldArrive(1, 'casual', 'recovery', -1)).toThrow(
      /credited member reputation/,
    );
  });
});

describe('Stage G.2C3 — arrival record and copy', () => {
  it('archives the minted snapshot and the attracting identity', () => {
    const member = memberNamed('Cole');
    const attractedBy = 'member:n1:0' as GymMemberId;
    const record = createLivingMemberArrivalRecord(member, 10, attractedBy);
    expect(record.member).toBe(member);
    expect(record.arrivedAtTick).toBe(10);
    expect(record.attractedById).toBe(attractedBy);
    expect(playerFacingArrivalLine(record)).toBe('Cole joined the gym.');
    expect(lastLivingMemberArrival([])).toBeNull();
    expect(lastLivingMemberArrival([record])).toBe(record);
  });

  it('fails closed on a non-integer arrival tick', () => {
    expect(() =>
      createLivingMemberArrivalRecord(memberNamed('Cole'), 1.5, 'member:n1:0' as GymMemberId),
    ).toThrow(/non-negative whole number/);
    expect(() =>
      createLivingMemberArrivalRecord(memberNamed('Cole'), -1, 'member:n1:0' as GymMemberId),
    ).toThrow(/non-negative whole number/);
  });

  it('fails closed on invalid join-clock context', () => {
    expect(() =>
      requireLivingMemberArrivalContext({
        sessionOwned: Object.freeze([]),
        joinedAtSeconds: -1,
      }),
    ).toThrow(/joinedAtSeconds/);
    expect(
      requireLivingMemberArrivalContext({
        sessionOwned: Object.freeze([]),
        joinedAtSeconds: 0,
      }).joinedAtSeconds,
    ).toBe(0);
  });

  it('does not mention dues, reputation, percentages, or countdowns in copy', () => {
    const source = codeOf('livingMemberArrival.ts');
    expect(source).not.toMatch(/memberDuesGymBucks|reputationFromMembers|leaveProbability|%/);
    expect(source).not.toMatch(/countdown|churnChance|Math\.random|Date\.now/);
    expect(playerFacingArrivalLine(createLivingMemberArrivalRecord(memberNamed('Cole'), 10, 'member:n1:0' as GymMemberId))).not.toMatch(/%|\d+ visits left/);
  });
});
