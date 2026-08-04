/**
 * cutInPreview.test.ts — the debug route, and the two things it must never be.
 *
 * It must not be reachable by accident, and it must not be a bypass. Both are
 * checked as behaviour: an unrecognised query string returns `null`, and every
 * beat the route can produce is run through the REAL gate here and has to fire.
 */

import { describe, expect, it } from 'vitest';

import {
  isCutInMoment,
  momentFor,
  openCutInSession,
  requestCutIn,
  type CutInMoment,
} from './cutInGate';
import {
  CUT_IN_LIVE_PARAM,
  CUT_IN_PARAM,
  CUT_IN_PREVIEW_MOMENTS,
  cutInPreviewFrom,
  cutInPreviewSeedFor,
  cutInPreviewSessionFor,
  cutInPreviewSessionId,
  previewBeatsFor,
} from './cutInPreview';

/** GDD §7.2's four, transcribed rather than read off the module. */
const THE_FOUR: readonly CutInMoment[] = [
  'third-attempt-walkout',
  'personal-record',
  'bomb-out',
  'coach-heavy-set',
];

describe('the route refuses everything it does not recognise', () => {
  it('a query string with no cutin key is not a preview request', () => {
    expect(cutInPreviewFrom(null)).toBeNull();
    expect(cutInPreviewFrom('')).toBeNull();
    expect(cutInPreviewFrom('?meet=walkout-third')).toBeNull();
    expect(cutInPreviewFrom('?session=close-out')).toBeNull();
    expect(cutInPreviewFrom('?replay=0.95&moment=hole')).toBeNull();
  });

  it('AN UNKNOWN MOMENT BOOTS THE APP NORMALLY RATHER THAN A BROKEN SCREEN', () => {
    // The same promise `?meet=nonsense` keeps.
    expect(cutInPreviewFrom('?cutin=nonsense')).toBeNull();
    expect(cutInPreviewFrom('?cutin=')).toBeNull();
    expect(cutInPreviewFrom('?cutin=BOMB-OUT')).toBeNull();
    expect(cutInPreviewFrom('?cutin=warm-up')).toBeNull();
  });

  it('names each of the four moments, and the key the harness uses', () => {
    expect(CUT_IN_PARAM).toBe('cutin');
    expect(CUT_IN_LIVE_PARAM).toBe('live');
    for (const moment of THE_FOUR) {
      expect(cutInPreviewFrom(`?cutin=${moment}`)?.moment, moment).toBe(moment);
    }
  });

  it('is frozen by default, and runs its clock only when asked', () => {
    expect(cutInPreviewFrom('?cutin=bomb-out')?.frozen).toBe(true);
    expect(cutInPreviewFrom('?cutin=bomb-out&live=1')?.frozen).toBe(false);
    // Anything other than the exact value stays frozen, so a typo photographs
    // a beat that holds still rather than one that vanished.
    expect(cutInPreviewFrom('?cutin=bomb-out&live=yes')?.frozen).toBe(true);
  });

  it('every previewable moment is one of GDD §7.2’s four', () => {
    expect([...CUT_IN_PREVIEW_MOMENTS].sort()).toEqual([...THE_FOUR].sort());
    for (const moment of CUT_IN_PREVIEW_MOMENTS) {
      expect(isCutInMoment(moment), moment).toBe(true);
    }
  });
});

describe('THE PREVIEW GOES THROUGH THE GATE, IT DOES NOT GO ROUND IT', () => {
  it('EVERY MOMENT THE ROUTE OFFERS REALLY FIRES, THROUGH `requestCutIn`', () => {
    // The check that stops the route being a picture of nothing. A beat that
    // stopped qualifying — the walk-out's `bombRisk` disqualifier is exactly
    // that kind of change — would photograph an empty screen, and this says so
    // in the suite first.
    for (const moment of THE_FOUR) {
      const preview = cutInPreviewSessionFor({ moment, frozen: true });
      const state = openCutInSession({ sessionId: preview.sessionId, seed: preview.seed });
      const decision = requestCutIn(state, preview.beats);
      expect(decision.outcome.kind, moment).toBe('fire');
      if (decision.outcome.kind === 'fire') {
        expect(decision.outcome.live.moment, moment).toBe(moment);
      }
    }
  });

  it('the walk-out preview uses an attempt that CAN still take the slot', () => {
    // Not a special case: `cutInGate.ts` §4 refuses a third attempt with
    // nothing banked, so the preview reports one with something banked. If this
    // regressed to `bombRisk: true` the route would silently show nothing.
    const beats = previewBeatsFor('third-attempt-walkout');
    expect(beats.length).toBe(1);
    const beat = beats[0];
    if (beat === undefined) throw new Error('the walk-out preview reports no beat');
    expect(beat.kind).toBe('meet-walkout');
    if (beat.kind === 'meet-walkout') expect(beat.bombRisk).toBe(false);
    expect(momentFor(beat)).toBe('third-attempt-walkout');
  });

  it('the seed it picks is one the rate ALLOWS, not a forced fire', () => {
    for (const moment of THE_FOUR) {
      const seed = cutInPreviewSeedFor(moment);
      const state = openCutInSession({ sessionId: cutInPreviewSessionId(moment), seed });
      expect(state.allowed[moment], moment).toBe(true);
    }
  });

  it('a preview sitting cannot collide with a played one', () => {
    // `cutInSessionId` spells `training-<day>` and `meet-<day>`. A preview that
    // shared an id would spend a real sitting's slot.
    for (const moment of THE_FOUR) {
      const id = cutInPreviewSessionId(moment);
      expect(id.startsWith('training-'), id).toBe(false);
      expect(id.startsWith('meet-'), id).toBe(false);
    }
    expect(new Set(THE_FOUR.map(cutInPreviewSessionId)).size).toBe(THE_FOUR.length);
  });

  it('THE CAP APPLIES TO A PREVIEW TOO', () => {
    const preview = cutInPreviewSessionFor({ moment: 'bomb-out', frozen: true });
    let state = openCutInSession({ sessionId: preview.sessionId, seed: preview.seed });
    state = requestCutIn(state, preview.beats).state;
    const second = requestCutIn(state, preview.beats);
    expect(second.outcome.kind).toBe('refused');
    if (second.outcome.kind === 'refused') expect(second.outcome.reason).toBe('session-cap-reached');
  });

  it('carries no game state — a preview is still just a picture', () => {
    for (const moment of THE_FOUR) {
      const serialised = JSON.stringify(cutInPreviewSessionFor({ moment, frozen: true }));
      for (const forbidden of ['total', 'e1rmKg', 'streak', 'currency', 'weightKg']) {
        expect(serialised.toLowerCase(), `${moment}/${forbidden}`).not.toContain(
          forbidden.toLowerCase(),
        );
      }
    }
  });
});
