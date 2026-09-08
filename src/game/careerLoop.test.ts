import { describe, expect, it } from 'vitest';

import { careerMeetFor, careerMeetFromId, seasonAnchorDay } from '../career/calendar';
import { CAREER_TUNING } from '../career/careerTuning';
import { newCareerLifter } from '../career/eligibility';
import { meetDefinitionFor } from './careerMeet';
import {
  applyEnterMeet,
  authorizeCareerMeetRecord,
  CAREER_LOOP_ERROR_CODES,
  isCareerMeetId,
} from './careerLoop';
import { addDays } from './streak';

const TODAY = seasonAnchorDay();
const LOCAL = careerMeetFor('meridian', 'local', TODAY);
const REGIONAL = careerMeetFor(
  'meridian',
  'regional',
  addDays(TODAY, CAREER_TUNING.PHASE_DAYS.regional),
);

describe('applyEnterMeet gates Career booking on the calendar and eligibility', () => {
  it('a new lifter can book the open local meet and receives the reconstructed definition', () => {
    const applied = applyEnterMeet(newCareerLifter('meridian'), null, LOCAL.id, TODAY);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.enteredMeetId).toBe(LOCAL.id);
    expect(applied.value.meet).toEqual(LOCAL);
    expect(applied.value.definition).toEqual(meetDefinitionFor(LOCAL));
    expect(applied.value.definition.id).toBe(LOCAL.id);
  });

  it('re-entering the same booked meet is idempotent', () => {
    const first = applyEnterMeet(newCareerLifter('meridian'), null, LOCAL.id, TODAY);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = applyEnterMeet(newCareerLifter('meridian'), first.value.enteredMeetId, LOCAL.id, TODAY);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.enteredMeetId).toBe(LOCAL.id);
    expect(again.value.definition).toEqual(first.value.definition);
  });

  it('a different meet while one is already entered is ALREADY_IN_A_MEET', () => {
    const nextLocal = careerMeetFor('meridian', 'local', addDays(TODAY, 7));
    const refused = applyEnterMeet(newCareerLifter('meridian'), LOCAL.id, nextLocal.id, TODAY);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.code).toBe('ALREADY_IN_A_MEET');
  });

  it('an unknown id is UNKNOWN_MEET, including the debug local-open fixture', () => {
    const unknown = applyEnterMeet(newCareerLifter('meridian'), null, 'local-open-2026', TODAY);
    expect(unknown.ok).toBe(false);
    if (unknown.ok) return;
    expect(unknown.error.code).toBe('UNKNOWN_MEET');
    expect(isCareerMeetId('local-open-2026')).toBe(false);
    expect(isCareerMeetId(LOCAL.id)).toBe(true);
  });

  it('wraps eligibility refusals rather than adding a fifth ENTRY_REFUSAL_REASON', () => {
    const below = applyEnterMeet(newCareerLifter('meridian'), null, REGIONAL.id, TODAY);
    expect(below.ok).toBe(false);
    if (below.ok) return;
    expect(below.error.code).toBe('BELOW_QUALIFYING_TOTAL');

    const passed = applyEnterMeet(newCareerLifter('meridian'), null, LOCAL.id, addDays(TODAY, 1));
    expect(passed.ok).toBe(false);
    if (passed.ok) return;
    expect(passed.error.code).toBe('MEET_HAS_PASSED');

    const foreign = careerMeetFor('ironline', 'local', TODAY);
    const wrong = applyEnterMeet(newCareerLifter('meridian'), null, foreign.id, TODAY);
    expect(wrong.ok).toBe(false);
    if (wrong.ok) return;
    expect(wrong.error.code).toBe('WRONG_FEDERATION');

    const already = applyEnterMeet(
      { federationId: 'meridian', bestTotalKg: null, enteredMeetIds: [LOCAL.id] },
      null,
      LOCAL.id,
      TODAY,
    );
    expect(already.ok).toBe(false);
    if (already.ok) return;
    expect(already.error.code).toBe('ALREADY_ENTERED');
  });

  it('a 400 kg Total books regional; 399 does not', () => {
    const under = applyEnterMeet(
      { federationId: 'meridian', bestTotalKg: 399, enteredMeetIds: [] },
      null,
      REGIONAL.id,
      TODAY,
    );
    const exact = applyEnterMeet(
      { federationId: 'meridian', bestTotalKg: 400, enteredMeetIds: [] },
      null,
      REGIONAL.id,
      TODAY,
    );
    expect(under.ok).toBe(false);
    if (!under.ok) expect(under.error.code).toBe('BELOW_QUALIFYING_TOTAL');
    expect(exact.ok).toBe(true);
  });
});

describe('authorizeCareerMeetRecord reconstructs the booked meet and ignores a client definition', () => {
  it('returns the calendar’s own definition for the booked id', () => {
    const authorized = authorizeCareerMeetRecord(LOCAL.id, LOCAL.id);
    expect(authorized.ok).toBe(true);
    if (!authorized.ok) return;
    expect(authorized.value.definition).toEqual(meetDefinitionFor(LOCAL));
    expect(careerMeetFromId(LOCAL.id)).toEqual(LOCAL);
  });

  it('a result for a different meet than the booking is MEET_MISMATCH', () => {
    const mismatch = authorizeCareerMeetRecord(LOCAL.id, REGIONAL.id);
    expect(mismatch.ok).toBe(false);
    if (mismatch.ok) return;
    expect(mismatch.error.code).toBe('MEET_MISMATCH');
  });

  it('the loop-specific codes are the closed set, including wrapped eligibility reasons', () => {
    expect([...CAREER_LOOP_ERROR_CODES]).toEqual([
      'UNKNOWN_MEET',
      'ALREADY_IN_A_MEET',
      'NOT_ENTERED',
      'MEET_MISMATCH',
      'WRONG_FEDERATION',
      'ALREADY_ENTERED',
      'MEET_HAS_PASSED',
      'BELOW_QUALIFYING_TOTAL',
    ]);
  });
});
