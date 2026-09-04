/**
 * livingMemberStay.test.ts — Stage G.2C1 persistent stay-response foundation.
 *
 * These tests pin response dynamics only. G.2B remains the service-derived
 * signal; this layer adds persistence, recovery hysteresis, and the narrow
 * GDD-backed type response without deleting a member.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type {
  LivingMemberRetentionPressure,
  LivingMemberRetentionReasonKind,
} from './livingMemberRetention';
import {
  advanceLivingMemberStay,
  createLivingMemberStayState,
  isLivingMemberDepartureEligible,
  LIVING_MEMBER_STAY_STATUSES,
  playerFacingStayResponse,
} from './livingMemberStay';
import type { MemberType } from './members';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'livingMemberStay.ts'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function formed(
  label: string,
  pressure: number,
  reasonKind: LivingMemberRetentionReasonKind = 'service',
): LivingMemberRetentionPressure {
  return Object.freeze({
    status: 'formed',
    pressure,
    label,
    reasons: Object.freeze([
      Object.freeze({
        kind: reasonKind,
        text: `${reasonKind} evidence`,
      }),
    ]),
  });
}

const FORMING: LivingMemberRetentionPressure = Object.freeze({
  status: 'forming',
  pressure: null,
  label: 'Still forming',
  reasons: Object.freeze([
    Object.freeze({ kind: 'forming' as const, text: 'Membership is still forming.' }),
  ]),
});

describe('Stage G.2C1 — persistent stay-response vocabulary', () => {
  it('opens forming and exposes no departure claim', () => {
    const state = createLivingMemberStayState();
    expect(state).toEqual({
      status: 'forming',
      lastEvaluatedVisitTick: null,
      lastCause: 'forming',
    });
    expect(LIVING_MEMBER_STAY_STATUSES).toEqual([
      'forming',
      'staying',
      'unsettled',
      'considering-exit',
      'departure-eligible',
    ]);
    expect(isLivingMemberDepartureEligible(state)).toBe(false);
    expect(playerFacingStayResponse(state)).toBe('Still forming');
  });

  it('preserves forming uncertainty until G.2B is formed', () => {
    const first = advanceLivingMemberStay(createLivingMemberStayState(), 'casual', FORMING, 1);
    expect(first.status).toBe('forming');
    const second = advanceLivingMemberStay(first, 'casual', formed('Stable', 0.1), 2);
    expect(second.status).toBe('staying');
    expect(second.lastCause).toBe('recovery');
  });

  it('refuses a formed label outside the accepted G.2B vocabulary', () => {
    expect(() =>
      advanceLivingMemberStay(createLivingMemberStayState(), 'casual', formed('Unknown', 0.5), 1),
    ).toThrow(/unknown label/);
  });
});

describe('Stage G.2C1 — narrow GDD-backed type response', () => {
  it('lets Casual Watching+wait deteriorate without changing the G.2B signal', () => {
    const base = formed('Watching', 0.3, 'wait');
    const casual = advanceLivingMemberStay(createLivingMemberStayState(), 'casual', base, 1);
    expect(casual.status).toBe('unsettled');
    expect(casual.lastCause).toBe('wait');
    expect(base.label).toBe('Watching');
    expect(base.pressure).toBe(0.3);
  });

  it('does not give Casual an unrelated Watching penalty', () => {
    const state = advanceLivingMemberStay(
      createLivingMemberStayState(),
      'casual',
      formed('Watching', 0.3, 'service'),
      1,
    );
    expect(state.status).toBe('staying');
  });

  it('keeps Bodybuilder, Powerlifter, and Athlete on the common service path', () => {
    const types: readonly MemberType[] = ['bodybuilder', 'powerlifter', 'athlete'];
    for (const type of types) {
      const watching = advanceLivingMemberStay(
        createLivingMemberStayState(),
        type,
        formed('Watching', 0.3, 'wait'),
        1,
      );
      expect(watching.status, type).toBe('staying');

      const strained = advanceLivingMemberStay(
        createLivingMemberStayState(),
        type,
        formed('Strained', 0.5, 'service'),
        1,
      );
      expect(strained.status, type).toBe('unsettled');
    }
  });

  it('makes Serious Lifter tolerant of Strained but not At risk service', () => {
    const strained = advanceLivingMemberStay(
      createLivingMemberStayState(),
      'serious-lifter',
      formed('Strained', 0.5, 'service'),
      1,
    );
    expect(strained.status).toBe('staying');

    const atRisk = advanceLivingMemberStay(
      createLivingMemberStayState(),
      'serious-lifter',
      formed('At risk', 0.7, 'service'),
      1,
    );
    expect(atRisk.status).toBe('unsettled');
  });
});

describe('Stage G.2C1 — sustained strain and recovery hysteresis', () => {
  it('requires three distinct strain observations before departure eligibility', () => {
    const atRisk = formed('At risk', 0.7, 'service');
    const one = advanceLivingMemberStay(createLivingMemberStayState(), 'powerlifter', atRisk, 1);
    const two = advanceLivingMemberStay(one, 'powerlifter', atRisk, 2);
    const three = advanceLivingMemberStay(two, 'powerlifter', atRisk, 3);

    expect(one.status).toBe('unsettled');
    expect(two.status).toBe('considering-exit');
    expect(three.status).toBe('departure-eligible');
    expect(isLivingMemberDepartureEligible(one)).toBe(false);
    expect(isLivingMemberDepartureEligible(two)).toBe(false);
    expect(isLivingMemberDepartureEligible(three)).toBe(true);
    expect(playerFacingStayResponse(two)).toBe('Considering leaving');
    expect(playerFacingStayResponse(three)).toBe('Considering leaving');
  });

  it('recovers one state per Stable service observation and never jumps back to forming', () => {
    const atRisk = formed('At risk', 0.7, 'service');
    let state = createLivingMemberStayState();
    state = advanceLivingMemberStay(state, 'powerlifter', atRisk, 1);
    state = advanceLivingMemberStay(state, 'powerlifter', atRisk, 2);
    state = advanceLivingMemberStay(state, 'powerlifter', atRisk, 3);
    expect(state.status).toBe('departure-eligible');

    state = advanceLivingMemberStay(state, 'powerlifter', formed('Stable', 0.1), 4);
    expect(state.status).toBe('considering-exit');
    state = advanceLivingMemberStay(state, 'powerlifter', formed('Stable', 0.1), 5);
    expect(state.status).toBe('unsettled');
    state = advanceLivingMemberStay(state, 'powerlifter', formed('Stable', 0.1), 6);
    expect(state.status).toBe('staying');
    state = advanceLivingMemberStay(state, 'powerlifter', formed('Stable', 0.1), 7);
    expect(state.status).toBe('staying');
  });

  it('replaying the same observation tick is idempotent and an older tick is refused', () => {
    const atRisk = formed('At risk', 0.7, 'service');
    const first = advanceLivingMemberStay(createLivingMemberStayState(), 'powerlifter', atRisk, 10);
    const replay = advanceLivingMemberStay(first, 'powerlifter', atRisk, 10);
    expect(replay).toBe(first);
    expect(replay.status).toBe('unsettled');
    expect(() => advanceLivingMemberStay(first, 'powerlifter', atRisk, 9)).toThrow(/older/);
  });
});

describe('Stage G.2C1 — source fences', () => {
  it('contains no random, wall-clock, probability, dues, reputation, or roster deletion mechanism', () => {
    expect(CODE).not.toMatch(/Math\.random/);
    expect(CODE).not.toMatch(/Date\.now/);
    expect(CODE).not.toMatch(/leaveProbability|churnChance|dailyRisk/);
    expect(CODE).not.toMatch(/memberDuesGymBucks|reputationFromMembers/);
    expect(CODE).not.toMatch(/splice|filter\s*\(/);
    expect(CODE).not.toMatch(/from ['"]\.\/livingMembers['"]/);
  });
});
