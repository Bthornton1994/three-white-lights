/**
 * livingMemberStay.test.ts — Stage G.2C1 persistent stay-response foundation.
 *
 * These tests pin response dynamics only. G.2B remains the service-derived
 * signal; this layer adds confirmation, persistence, recovery hysteresis, and
 * the narrow GDD-backed type response without deleting a member.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import type {
  LivingMemberRetentionPressure,
  LivingMemberRetentionReasonKind,
} from './livingMemberRetention';
import {
  advanceLivingMemberStay,
  createLivingMemberStayState,
  type LivingMemberStayState,
} from './livingMemberStay';
import type { MemberType } from './members';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'livingMemberStay.ts'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const CONFIRMATIONS_PER_STEP = Math.floor(EMPIRE_TUNING.LIVING_MEMBER_SERVICE_HISTORY_WINDOW / 2) + 1;

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

function applyRepeated(
  initial: LivingMemberStayState,
  type: MemberType,
  retention: LivingMemberRetentionPressure,
  count: number,
  firstTick: number = 1,
): LivingMemberStayState {
  let state = initial;
  for (let offset = 0; offset < count; offset += 1) {
    state = advanceLivingMemberStay(state, type, retention, firstTick + offset);
  }
  return state;
}

describe('Stage G.2C1 — persistent stay-response vocabulary', () => {
  it('opens forming with no armed direction', () => {
    const state = createLivingMemberStayState();
    expect(state).toEqual({
      status: 'forming',
      lastEvaluatedVisitTick: null,
      lastCause: 'forming',
      pendingDirection: null,
      confirmations: 0,
    });
    expect(CONFIRMATIONS_PER_STEP).toBe(3);
  });

  it('preserves forming uncertainty until G.2B is formed', () => {
    const first = advanceLivingMemberStay(createLivingMemberStayState(), 'casual', FORMING, 1);
    expect(first.status).toBe('forming');
    const second = advanceLivingMemberStay(first, 'casual', formed('Stable', 0.1), 2);
    expect(second.status).toBe('staying');
    expect(second.lastCause).toBe('recovery');
    expect(second.confirmations).toBe(0);
  });

  it('refuses a formed label outside the accepted G.2B vocabulary', () => {
    expect(() =>
      advanceLivingMemberStay(createLivingMemberStayState(), 'casual', formed('Unknown', 0.5), 1),
    ).toThrow(/unknown label/);
  });
});

describe('Stage G.2C1 — narrow GDD-backed type response', () => {
  it('lets Casual Watching+wait accumulate strain without changing the G.2B signal', () => {
    const base = formed('Watching', 0.3, 'wait');
    const one = advanceLivingMemberStay(createLivingMemberStayState(), 'casual', base, 1);
    expect(one.status).toBe('staying');
    expect(one.pendingDirection).toBe('strain');
    expect(one.confirmations).toBe(1);
    expect(one.lastCause).toBe('wait');
    expect(base.label).toBe('Watching');
    expect(base.pressure).toBe(0.3);

    const three = applyRepeated(one, 'casual', base, 2, 2);
    expect(three.status).toBe('unsettled');
    expect(three.confirmations).toBe(0);
  });

  it('does not give Casual an unrelated Watching penalty and neutral evidence breaks a streak', () => {
    const waitWatching = formed('Watching', 0.3, 'wait');
    let state = advanceLivingMemberStay(createLivingMemberStayState(), 'casual', waitWatching, 1);
    expect(state.confirmations).toBe(1);

    state = advanceLivingMemberStay(state, 'casual', formed('Watching', 0.3, 'service'), 2);
    expect(state.status).toBe('staying');
    expect(state.pendingDirection).toBeNull();
    expect(state.confirmations).toBe(0);
  });

  it('keeps Bodybuilder, Powerlifter, and Athlete on the common service path', () => {
    const types: readonly MemberType[] = ['bodybuilder', 'powerlifter', 'athlete'];
    for (const type of types) {
      const watching = applyRepeated(
        createLivingMemberStayState(),
        type,
        formed('Watching', 0.3, 'wait'),
        CONFIRMATIONS_PER_STEP,
      );
      expect(watching.status, type).toBe('staying');
      expect(watching.confirmations, type).toBe(0);

      const strained = applyRepeated(
        createLivingMemberStayState(),
        type,
        formed('Strained', 0.5, 'service'),
        CONFIRMATIONS_PER_STEP,
      );
      expect(strained.status, type).toBe('unsettled');
    }
  });

  it('makes Serious Lifter tolerant of Strained but responsive to sustained At risk service', () => {
    const strained = applyRepeated(
      createLivingMemberStayState(),
      'serious-lifter',
      formed('Strained', 0.5, 'service'),
      CONFIRMATIONS_PER_STEP,
    );
    expect(strained.status).toBe('staying');
    expect(strained.confirmations).toBe(0);

    const atRisk = applyRepeated(
      createLivingMemberStayState(),
      'serious-lifter',
      formed('At risk', 0.7, 'service'),
      CONFIRMATIONS_PER_STEP,
    );
    expect(atRisk.status).toBe('unsettled');
  });
});

describe('Stage G.2C1 — sustained strain and recovery hysteresis', () => {
  it('does not move a stay status on one or two adverse observations', () => {
    const atRisk = formed('At risk', 0.7, 'service');
    const one = advanceLivingMemberStay(createLivingMemberStayState(), 'powerlifter', atRisk, 1);
    const two = advanceLivingMemberStay(one, 'powerlifter', atRisk, 2);

    expect(one.status).toBe('staying');
    expect(one.confirmations).toBe(1);
    expect(two.status).toBe('staying');
    expect(two.confirmations).toBe(2);
  });

  it('requires nine consecutive qualifying observations for the shortest path to eligibility', () => {
    const atRisk = formed('At risk', 0.7, 'service');
    let state = createLivingMemberStayState();

    state = applyRepeated(state, 'powerlifter', atRisk, 3, 1);
    expect(state.status).toBe('unsettled');
    expect(state.confirmations).toBe(0);

    state = applyRepeated(state, 'powerlifter', atRisk, 3, 4);
    expect(state.status).toBe('considering-exit');

    state = applyRepeated(state, 'powerlifter', atRisk, 3, 7);
    expect(state.status).toBe('departure-eligible');
  });

  it('requires sustained Stable service to recover one state at a time and never returns to forming', () => {
    const atRisk = formed('At risk', 0.7, 'service');
    const stable = formed('Stable', 0.1);
    let state = applyRepeated(createLivingMemberStayState(), 'powerlifter', atRisk, 9, 1);
    expect(state.status).toBe('departure-eligible');

    state = applyRepeated(state, 'powerlifter', stable, 2, 10);
    expect(state.status).toBe('departure-eligible');
    expect(state.confirmations).toBe(2);
    state = advanceLivingMemberStay(state, 'powerlifter', stable, 12);
    expect(state.status).toBe('considering-exit');
    expect(state.confirmations).toBe(0);

    state = applyRepeated(state, 'powerlifter', stable, 6, 13);
    expect(state.status).toBe('staying');
    expect(state.confirmations).toBe(0);
    expect(state.pendingDirection).toBeNull();
  });

  it('switching direction resets pending confirmations instead of carrying hidden debt', () => {
    const strained = formed('Strained', 0.5, 'service');
    const stable = formed('Stable', 0.1);
    let state = advanceLivingMemberStay(createLivingMemberStayState(), 'powerlifter', strained, 1);
    state = advanceLivingMemberStay(state, 'powerlifter', strained, 2);
    expect(state.confirmations).toBe(2);
    expect(state.pendingDirection).toBe('strain');

    state = advanceLivingMemberStay(state, 'powerlifter', stable, 3);
    expect(state.status).toBe('staying');
    expect(state.confirmations).toBe(0);
    expect(state.pendingDirection).toBeNull();
  });

  it('replaying the same observation tick is idempotent and an older tick is refused', () => {
    const atRisk = formed('At risk', 0.7, 'service');
    const first = advanceLivingMemberStay(createLivingMemberStayState(), 'powerlifter', atRisk, 10);
    const replay = advanceLivingMemberStay(first, 'powerlifter', atRisk, 10);
    expect(replay).toBe(first);
    expect(replay.status).toBe('staying');
    expect(replay.confirmations).toBe(1);
    expect(() => advanceLivingMemberStay(first, 'powerlifter', atRisk, 9)).toThrow(/older/);
  });
});

describe('Stage G.2C1 — source fences', () => {
  it('contains no random, wall-clock, probability, dues, reputation, roster deletion, or UI API', () => {
    expect(CODE).not.toMatch(/Math\.random/);
    expect(CODE).not.toMatch(/Date\.now/);
    expect(CODE).not.toMatch(/leaveProbability|churnChance|dailyRisk/);
    expect(CODE).not.toMatch(/memberDuesGymBucks|reputationFromMembers/);
    expect(CODE).not.toMatch(/splice|filter\s*\(/);
    expect(CODE).not.toMatch(/playerFacing|isLivingMemberDepartureEligible/);
    expect(CODE).not.toMatch(/from ['"]\.\/livingMembers['"]/);
  });
});
