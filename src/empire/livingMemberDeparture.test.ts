/**
 * livingMemberDeparture.test.ts — Stage G.2C2 departure record, classifier
 * consumption, and player-facing copy. Roster deletion and FloorSim continuity
 * live in the integration file.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  createLivingMemberDepartureRecord,
  lastLivingMemberDeparture,
  livingMemberDepartureReason,
  livingMemberShouldDepart,
  playerFacingDepartureLine,
} from './livingMemberDeparture';
import type { LivingMemberRetentionPressure } from './livingMemberRetention';
import { createLivingMemberStayState, livingMemberStayEvidence } from './livingMemberStay';
import type { GymMemberId, LivingGymMember } from './livingMembers';

const HERE = dirname(fileURLToPath(import.meta.url));

function codeOf(file: string): string {
  const source = readFileSync(join(HERE, file), 'utf8');
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function retention(
  label: string,
  kind: 'wait' | 'reliability' | 'service',
  text: string,
  pressure: number,
): LivingMemberRetentionPressure {
  return Object.freeze({
    status: 'formed',
    pressure,
    label,
    reasons: Object.freeze([Object.freeze({ kind, text })]),
  });
}

function memberNamed(displayName: string): LivingGymMember {
  return Object.freeze({
    id: 'member:n1:0' as GymMemberId,
    displayName,
    type: 'casual',
    joinedAtSeconds: 0,
    recentVisits: Object.freeze([]),
    stayState: createLivingMemberStayState(),
  });
}

describe('Stage G.2C2 — departure confirmation is eligibility plus new strain', () => {
  it('does not depart on eligibility itself, recovery, or neutral evidence', () => {
    expect(livingMemberShouldDepart('departure-eligible', 'strain')).toBe(true);
    expect(livingMemberShouldDepart('departure-eligible', 'recovery')).toBe(false);
    expect(livingMemberShouldDepart('departure-eligible', 'neutral')).toBe(false);
    expect(livingMemberShouldDepart('departure-eligible', 'forming')).toBe(false);
    expect(livingMemberShouldDepart('considering-exit', 'strain')).toBe(false);
    expect(livingMemberShouldDepart('staying', 'strain')).toBe(false);
    expect(livingMemberShouldDepart('unsettled', 'strain')).toBe(false);
    expect(livingMemberShouldDepart('forming', 'strain')).toBe(false);
  });

  it('uses the frozen G.2C1 classifier rather than a second type table', () => {
    const waitWatching = retention('Watching', 'wait', 'Long waits are testing this membership.', 0.3);
    const serviceWatching = retention(
      'Watching',
      'service',
      'Recent service is shaping this membership.',
      0.3,
    );
    const strained = retention(
      'Strained',
      'service',
      'Recent service is shaping this membership.',
      0.5,
    );
    const atRisk = retention(
      'At risk',
      'service',
      'Recent service is shaping this membership.',
      0.7,
    );
    const stable = retention('Stable', 'service', 'Recent service has been working well.', 0.1);

    expect(livingMemberStayEvidence('casual', waitWatching)).toBe('strain');
    expect(livingMemberStayEvidence('casual', serviceWatching)).toBe('neutral');
    expect(livingMemberStayEvidence('bodybuilder', waitWatching)).toBe('neutral');
    expect(livingMemberStayEvidence('powerlifter', waitWatching)).toBe('neutral');
    expect(livingMemberStayEvidence('athlete', waitWatching)).toBe('neutral');
    expect(livingMemberStayEvidence('bodybuilder', strained)).toBe('strain');
    expect(livingMemberStayEvidence('powerlifter', strained)).toBe('strain');
    expect(livingMemberStayEvidence('athlete', strained)).toBe('strain');
    expect(livingMemberStayEvidence('serious-lifter', strained)).toBe('neutral');
    expect(livingMemberStayEvidence('serious-lifter', atRisk)).toBe('strain');
    expect(livingMemberStayEvidence('serious-lifter', waitWatching)).toBe('neutral');
    expect(livingMemberStayEvidence('powerlifter', stable)).toBe('recovery');

    expect(
      livingMemberShouldDepart(
        'departure-eligible',
        livingMemberStayEvidence('casual', waitWatching),
      ),
    ).toBe(true);
    expect(
      livingMemberShouldDepart(
        'departure-eligible',
        livingMemberStayEvidence('casual', serviceWatching),
      ),
    ).toBe(false);
    expect(
      livingMemberShouldDepart(
        'departure-eligible',
        livingMemberStayEvidence('serious-lifter', strained),
      ),
    ).toBe(false);
    expect(
      livingMemberShouldDepart(
        'departure-eligible',
        livingMemberStayEvidence('serious-lifter', atRisk),
      ),
    ).toBe(true);
  });
});

describe('Stage G.2C2 — player-facing departure copy', () => {
  it('names the member and the accepted G.2B reason with no percent or countdown', () => {
    const wait = retention('At risk', 'wait', 'Long waits are testing this membership.', 0.7);
    const record = createLivingMemberDepartureRecord(memberNamed('Nia'), 10, wait);
    expect(record.reasonKind).toBe('wait');
    expect(record.reasonText).toBe('Long waits are testing this membership.');
    expect(record.departedAtTick).toBe(10);
    expect(playerFacingDepartureLine(record)).toBe(
      'Nia left the gym. Long waits are testing this membership.',
    );
    expect(playerFacingDepartureLine(record)).not.toMatch(/%/);
    expect(playerFacingDepartureLine(record)).not.toMatch(/countdown|remaining|churn|probability/i);
  });

  it('prefers wait, then reliability, then service, matching G.2C1 cause order', () => {
    const mixed: LivingMemberRetentionPressure = Object.freeze({
      status: 'formed',
      pressure: 0.7,
      label: 'At risk',
      reasons: Object.freeze([
        Object.freeze({
          kind: 'service' as const,
          text: 'Recent service is shaping this membership.',
        }),
        Object.freeze({
          kind: 'reliability' as const,
          text: 'Interrupted sessions are creating strain.',
        }),
        Object.freeze({
          kind: 'wait' as const,
          text: 'Long waits are testing this membership.',
        }),
      ]),
    });
    expect(livingMemberDepartureReason(mixed)).toEqual({
      reasonKind: 'wait',
      reasonText: 'Long waits are testing this membership.',
    });

    const reliability = retention(
      'At risk',
      'reliability',
      'Interrupted sessions are creating strain.',
      0.7,
    );
    const reliabilityRecord = createLivingMemberDepartureRecord(memberNamed('Omar'), 11, reliability);
    expect(playerFacingDepartureLine(reliabilityRecord)).toBe(
      'Omar left the gym. Interrupted sessions are creating strain.',
    );
  });

  it('returns the last archive row and null when nobody has left', () => {
    expect(lastLivingMemberDeparture([])).toBeNull();
    const first = createLivingMemberDepartureRecord(
      memberNamed('Nia'),
      10,
      retention('At risk', 'wait', 'Long waits are testing this membership.', 0.7),
    );
    const second = createLivingMemberDepartureRecord(
      memberNamed('Omar'),
      20,
      retention('At risk', 'reliability', 'Interrupted sessions are creating strain.', 0.7),
    );
    expect(lastLivingMemberDeparture([first, second])).toBe(second);
  });

  it('refuses a forming retention as a departure reason', () => {
    const forming: LivingMemberRetentionPressure = Object.freeze({
      status: 'forming',
      pressure: null,
      label: 'Still forming',
      reasons: Object.freeze([
        Object.freeze({ kind: 'forming' as const, text: 'Membership is still forming.' }),
      ]),
    });
    expect(() => livingMemberDepartureReason(forming)).toThrow(/accepted wait, reliability, or service/);
  });
});

describe('Stage G.2C2 — source fences', () => {
  it('adds no random, wall-clock, probability, dues, reputation, Career, Portfolio, or NpcLifter path', () => {
    const files = Object.freeze([
      'livingMemberDeparture.ts',
      'livingMembers.ts',
      'livingMemberStay.ts',
      'floorSim.ts',
    ]);
    for (const file of files) {
      const code = codeOf(file);
      expect(code, file).not.toMatch(/Math\.random/);
      expect(code, file).not.toMatch(/Date\.now/);
      expect(code, file).not.toMatch(/leaveProbability|churnChance|dailyRisk|churnPercentage/);
      expect(code, file).not.toMatch(/memberDuesGymBucks|reputationFromMembers/);
      expect(code, file).not.toMatch(/from ['"]\.\.\/game/);
      expect(code, file).not.toMatch(/from ['"]\.\/sportingReputation['"]/);
      expect(code, file).not.toMatch(/from ['"]\.\/npc['"]/);
      expect(code, file).not.toMatch(/NpcLifter/);
      expect(code, file).not.toMatch(/crowdingLoad|memberSatisfaction|MEMBER_TYPE_CROWDING_SENSITIVITY/);
    }
    const departure = codeOf('livingMemberDeparture.ts');
    expect(departure).not.toMatch(/isLivingMemberDepartureEligible/);
    expect(departure).not.toMatch(/^import \{[^}]*\} from ['"]\.\/livingMembers['"]/m);
    expect(departure).toMatch(/import type/);
    const stay = codeOf('livingMemberStay.ts');
    expect(stay).not.toMatch(/from ['"]\.\/livingMemberDeparture['"]/);
    expect(stay).not.toMatch(/from ['"]\.\/livingMembers['"]/);
    expect(stay).toMatch(/livingMemberStayEvidence/);
    const living = codeOf('livingMembers.ts');
    expect(living).toMatch(/livingMemberStayEvidence/);
    expect(living).toMatch(/livingMemberShouldDepart/);
    expect(living).toMatch(/nextOrdinal/);
    expect(living).not.toMatch(/splice\s*\(/);
  });

  it('keeps FloorGrid selection on member identity and keys sprites by memberId', () => {
    const source = readFileSync(join(HERE, 'FloorGrid.tsx'), 'utf8');
    expect(source).not.toMatch(/selectedMemberIndex/);
    expect(source).toMatch(/selectedMemberId/);
    expect(source).toMatch(
      /drawnSim\.members\.find\(\(member\) => member\.memberId === selectedMemberId\)/,
    );
    expect(source).toMatch(/selectedMember === null \? null/);
    expect(source).toMatch(/key=\{`ambient-\$\{member\.memberId\}`\}/);
    expect(source).toMatch(/livingMemberById/);
    expect(source).toMatch(/reconcileFloorSimPopulation/);
    expect(source).toMatch(/floorgrid-departure-notice/);
    expect(source).toMatch(/playerFacingDepartureLine/);
    expect(source).not.toMatch(/leaveProbability|churnChance|% churn/);
    expect(source).not.toMatch(/X visits remaining|days remaining/);
    expect(source).not.toMatch(/setSelectedMemberId\([^)]*members\[/);
    expect(source).not.toMatch(/selectedMemberId\s*=\s*drawnSim\.members\[/);
  });
});
