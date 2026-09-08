import { describe, expect, it } from 'vitest';

import { careerMeetFor, seasonAnchorDay } from './calendar';
import { CAREER_BETA, CAREER_TUNING, MEET_TIER_ORDER } from './careerTuning';
import { careerPresentationFor, type CareerPresentationState } from './careerPresentation';
import { newCareerLifter } from './eligibility';
import { addDays } from '../game/streak';

const TODAY = seasonAnchorDay();

function keysOf(state: CareerPresentationState): readonly string[] {
  return Object.keys(state).sort();
}

describe('careerPresentationFor is renderer-independent Career truth', () => {
  it('exposes only the facts a renderer needs, and never e1RM, copy, colour, or layout', () => {
    const state = careerPresentationFor({
      today: TODAY,
      federationChosen: false,
      enteredMeetId: null,
      lifter: newCareerLifter('meridian'),
      history: [],
    });
    expect(keysOf(state)).toEqual([
      'bestCompetitionTotalKg',
      'dateIso',
      'day',
      'enteredMeetId',
      'federationChosen',
      'federationId',
      'history',
      'nextDecision',
      'qualifying',
      'upcoming',
    ]);
    expect(state).not.toHaveProperty('bestE1rmKg');
    expect(state).not.toHaveProperty('e1rm');
    expect(JSON.stringify(state)).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(JSON.stringify(state)).not.toMatch(/rgb\(|hsl\(/);
    expect(JSON.stringify(state).toLowerCase()).not.toContain('animation');
    expect(JSON.stringify(state).toLowerCase()).not.toContain('layout');
  });

  it('a new unchosen lifter must pick a federation before anything else', () => {
    const state = careerPresentationFor({
      today: TODAY,
      federationChosen: false,
      enteredMeetId: null,
      lifter: newCareerLifter('meridian'),
      history: [],
    });
    expect(state.nextDecision).toEqual({ kind: 'choose-federation' });
    expect(state.bestCompetitionTotalKg).toBeNull();
    expect(state.qualifying.find((row) => row.tier === 'local')?.qualifies).toBe(true);
    expect(state.qualifying.find((row) => row.tier === 'regional')?.qualifies).toBe(false);
  });

  it('a chosen new lifter is offered the first enterable local meet, not a gated tier', () => {
    const state = careerPresentationFor({
      today: TODAY,
      federationChosen: true,
      enteredMeetId: null,
      lifter: newCareerLifter('meridian'),
      history: [],
    });
    expect(state.nextDecision.kind).toBe('enter-meet');
    if (state.nextDecision.kind !== 'enter-meet') return;
    const local = careerMeetFor('meridian', 'local', TODAY);
    expect(state.nextDecision.meetId).toBe(local.id);
    const regional = state.upcoming.find((row) => row.tier === 'regional');
    expect(regional?.enterable).toBe(false);
    expect(regional?.refusalReason).toBe('BELOW_QUALIFYING_TOTAL');
  });

  it('an in-progress booking is the next decision, even if another meet is open', () => {
    const local = careerMeetFor('meridian', 'local', TODAY);
    const state = careerPresentationFor({
      today: TODAY,
      federationChosen: true,
      enteredMeetId: local.id,
      lifter: newCareerLifter('meridian'),
      history: [],
    });
    expect(state.nextDecision).toEqual({ kind: 'complete-meet', meetId: local.id });
    expect(state.enteredMeetId).toBe(local.id);
  });

  it('qualification follows the competition Total, inclusive at the bar', () => {
    const under = careerPresentationFor({
      today: TODAY,
      federationChosen: true,
      enteredMeetId: null,
      lifter: { federationId: 'meridian', bestTotalKg: 399, enteredMeetIds: [] },
      history: [],
    });
    const exact = careerPresentationFor({
      today: TODAY,
      federationChosen: true,
      enteredMeetId: null,
      lifter: { federationId: 'meridian', bestTotalKg: 400, enteredMeetIds: [] },
      history: [],
    });
    expect(under.qualifying.find((row) => row.tier === 'regional')?.qualifies).toBe(false);
    expect(exact.qualifying.find((row) => row.tier === 'regional')?.qualifies).toBe(true);
    expect(CAREER_TUNING.QUALIFYING_TOTAL_KG.regional).toBe(400);
  });

  it('history order is the caller’s order — this module invents none', () => {
    const first = careerMeetFor('meridian', 'local', TODAY);
    const second = careerMeetFor('meridian', 'local', addDays(TODAY, 7));
    const history = [
      { meetId: first.id, totalKg: 380 },
      { meetId: second.id, totalKg: null },
    ];
    const state = careerPresentationFor({
      today: addDays(TODAY, 7),
      federationChosen: true,
      enteredMeetId: null,
      lifter: {
        federationId: 'meridian',
        bestTotalKg: 380,
        enteredMeetIds: [first.id, second.id],
      },
      history,
    });
    expect(state.history).toBe(history);
    expect(state.history.map((row) => row.meetId)).toEqual([first.id, second.id]);
  });

  it('competitive worlds is locked as presentation scope, not as a fifth eligibility reason', () => {
    expect([...CAREER_BETA.LOCKED_TIERS]).toEqual(['competitive-worlds']);
    const state = careerPresentationFor({
      today: TODAY,
      federationChosen: true,
      enteredMeetId: null,
      lifter: { federationId: 'meridian', bestTotalKg: 700, enteredMeetIds: [] },
      history: [],
    });
    const ceiling = state.upcoming.find((row) => row.tier === 'competitive-worlds');
    expect(ceiling?.locked).toBe(true);
    expect(ceiling?.enterable).toBe(false);
    expect(state.qualifying).toHaveLength(MEET_TIER_ORDER.length);
    expect(state.qualifying.every((row) => row.qualifies)).toBe(true);
  });
});
