/**
 * livingMemberArrival.test.ts — Stage G.2C3 arrival record, vacancy classifier,
 * and player-facing copy. Roster minting and FloorSim continuity live in the
 * integration file.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
    expect(livingMemberShouldArrive(0, 'casual', 'recovery')).toBe(false);
    expect(livingMemberShouldArrive(-1, 'casual', 'recovery')).toBe(false);
  });

  it('does not mint from forming or strain evidence', () => {
    expect(livingMemberShouldArrive(1, 'casual', 'forming')).toBe(false);
    expect(livingMemberShouldArrive(1, 'casual', 'strain')).toBe(false);
    expect(livingMemberShouldArrive(1, 'powerlifter', 'strain')).toBe(false);
    expect(livingMemberShouldArrive(1, 'serious-lifter', 'neutral')).toBe(false);
  });

  it('lets Casual join on recovery or formed-neutral evidence', () => {
    expect(livingMemberShouldArrive(1, 'casual', 'recovery')).toBe(true);
    expect(livingMemberShouldArrive(1, 'casual', 'neutral')).toBe(true);
  });

  it('lets common types join only on recovery', () => {
    for (const type of ['bodybuilder', 'powerlifter', 'athlete'] as const) {
      expect(livingMemberShouldArrive(1, type, 'recovery')).toBe(true);
      expect(livingMemberShouldArrive(1, type, 'neutral')).toBe(false);
    }
  });

  it('lets Serious Lifter join only on recovery', () => {
    expect(livingMemberShouldArrive(1, 'serious-lifter', 'recovery')).toBe(true);
    expect(livingMemberShouldArrive(1, 'serious-lifter', 'neutral')).toBe(false);
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
