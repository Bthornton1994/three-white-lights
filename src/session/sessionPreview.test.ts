import { describe, expect, it } from 'vitest';

import {
  SESSION_MOMENTS,
  cacheBeforeSession,
  isSessionMoment,
  previewFrameFor,
  sessionPreviewFrom,
} from './sessionPreview';
import {
  SESSION_BOUNDARY_PREVIEW,
  SESSION_COPY,
  SESSION_PREVIEW,
  SESSION_TUNING,
} from '../game/sessionTuning';
import { liftForDay } from '../game/session';
import { closeOutReadings } from '../game/sessionClient';
import { readBestE1rmKg, readStreakDays, readingValue } from '../game/progression';

describe('the ?session= debug route', () => {
  it('parses a beat this module can build, and nothing else', () => {
    expect(sessionPreviewFrom('?session=briefing')).toEqual({ moment: 'briefing' });
    expect(sessionPreviewFrom('?session=close-out-pr&other=1')).toEqual({
      moment: 'close-out-pr',
    });
    expect(sessionPreviewFrom('?session=not-a-beat')).toBeNull();
    expect(sessionPreviewFrom('?replay=1.0&moment=hole')).toBeNull();
    expect(sessionPreviewFrom('')).toBeNull();
  });

  it('names every beat it can build', () => {
    for (const moment of SESSION_MOMENTS) {
      expect(isSessionMoment(moment)).toBe(true);
    }
    expect(isSessionMoment('close-out')).toBe(false);
    // Hand-written, not read back off the list being checked.
    expect([...SESSION_MOMENTS]).toEqual([
      'check-in',
      'check-in-partial',
      'briefing',
      'set',
      'rest',
      'close-out-pr',
      'close-out-held',
      'close-out-empty',
      'close-out-saving',
      'close-out-server-wins',
      'close-out-unsynced',
      'close-out-accessory',
    ]);
  });
});

describe('the beats a preview can be frozen on', () => {
  it('each one reaches the phase it names', () => {
    const expected: Record<string, string> = {
      'check-in': 'check-in',
      'check-in-partial': 'check-in',
      briefing: 'briefing',
      set: 'set',
      rest: 'rest',
      'close-out-pr': 'close-out',
      'close-out-held': 'close-out',
      'close-out-empty': 'close-out',
      'close-out-saving': 'close-out',
      'close-out-server-wins': 'close-out',
      'close-out-unsynced': 'close-out',
      'close-out-accessory': 'close-out',
    };
    for (const moment of SESSION_MOMENTS) {
      expect(previewFrameFor({ moment }).state.phase, moment).toBe(expected[moment]);
    }
  });

  it('is deterministic — the same beat is the same screen every time', () => {
    for (const moment of SESSION_MOMENTS) {
      const a = previewFrameFor({ moment });
      const b = previewFrameFor({ moment });
      expect(JSON.stringify({ ...a.state, feel: null }), moment).toBe(
        JSON.stringify({ ...b.state, feel: null }),
      );
      expect(a.cache.status, moment).toBe(b.cache.status);
    }
  });

  it('opens on a blank check-in and shows two of three when partial', () => {
    const blank = previewFrameFor({ moment: 'check-in' }).state;
    expect(blank.answers).toEqual({ sleep: null, soreness: null, motivation: null });
    const partial = previewFrameFor({ moment: 'check-in-partial' }).state;
    expect(partial.answers.sleep).toBe('good');
    expect(partial.answers.soreness).toBe('fresh');
    expect(partial.answers.motivation).toBeNull();
  });

  it('the briefing beat has a surfaced modifier and no plan yet', () => {
    const state = previewFrameFor({ moment: 'briefing' }).state;
    expect(state.readiness?.label).toBe('Feeling primed +5%');
    expect(state.plan).toBeNull();
    expect(state.context.lift).toBe(liftForDay(SESSION_PREVIEW.DAY));
  });

  it('the rest beat is between the first and second set', () => {
    const state = previewFrameFor({ moment: 'rest' }).state;
    expect(state.setIndex).toBe(1);
    expect(state.completedSets).toHaveLength(1);
    expect(state.plan?.workSets).toBe(SESSION_TUNING.WORK_SETS);
  });

  it('the three original close-outs really are three different close-outs', () => {
    const pr = previewFrameFor({ moment: 'close-out-pr' }).state.closeOut;
    const held = previewFrameFor({ moment: 'close-out-held' }).state.closeOut;
    const empty = previewFrameFor({ moment: 'close-out-empty' }).state.closeOut;
    expect(pr?.isPr).toBe(true);
    expect(pr?.canPropose).toBe(true);
    expect(held?.isPr).toBe(false);
    expect(held?.canPropose).toBe(true);
    expect(empty?.canPropose).toBe(false);
    expect(empty?.sessionE1rmKg).toBeNull();
    // And the PR is a bigger number than the held estimate, or the two
    // screenshots would show the same thing with different words on them.
    expect(pr?.newBestE1rmKg ?? 0).toBeGreaterThan(held?.newBestE1rmKg ?? 0);
  });

  it('no preview shows a Total — GDD §3.2', () => {
    for (const moment of SESSION_MOMENTS) {
      expect(JSON.stringify(previewFrameFor({ moment }).state.closeOut), moment).not.toMatch(
        /total/i,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// The frames exist to photograph the boundary, so they have to BE the boundary
// ---------------------------------------------------------------------------

describe('a preview frame carries the cache its numbers are read out of', () => {
  it('the pre-session cache holds the numbers the session started from', () => {
    const cache = cacheBeforeSession();
    const lift = liftForDay(SESSION_PREVIEW.DAY);
    expect(readingValue(readBestE1rmKg(cache, lift))).toBe(SESSION_PREVIEW.BEST_E1RM_KG);
    expect(readingValue(readStreakDays(cache))).toBe(SESSION_PREVIEW.STREAK_BEFORE);
  });

  it('the settled beats are CONFIRMED and agree with the client', () => {
    for (const moment of ['close-out-pr', 'close-out-held'] as const) {
      const { state, cache } = previewFrameFor({ moment });
      expect(cache.status, moment).toBe('confirmed');
      const readings = closeOutReadings(cache, state.closeOut!);
      expect(readings.payoff.kind, moment).toBe('e1rm');
      if (readings.payoff.kind !== 'e1rm') throw new Error('unreachable');
      expect(readings.payoff.reading.kind, moment).toBe('confirmed');
      // The server stand-in and the client run the same `nextBestE1rm`, so on an
      // undrifted beat the two agree — which is what makes the DRIFTED beat below
      // a real disagreement rather than noise.
      expect(readings.payoff.valueKg, moment).toBeCloseTo(state.closeOut!.newBestE1rmKg!, 6);
      expect(readings.streakValue, moment).toBe(state.closeOut!.streakAfter);
    }
  });

  it('the saving beat is PROJECTED and carries the client’s own guess', () => {
    const { state, cache } = previewFrameFor({ moment: 'close-out-saving' });
    expect(cache.status).toBe('pending');
    const readings = closeOutReadings(cache, state.closeOut!);
    if (readings.payoff.kind !== 'e1rm') throw new Error('unreachable');
    expect(readings.payoff.reading.kind).toBe('projected');
    expect(readings.streakDays.kind).toBe('projected');
    expect(readings.payoff.valueKg).toBeCloseTo(state.closeOut!.newBestE1rmKg!, 6);
  });

  it('THE SERVER WINS: the drifted beat renders the server’s number, not the client’s', () => {
    const { state, cache } = previewFrameFor({ moment: 'close-out-server-wins' });
    const closeOut = state.closeOut!;
    const readings = closeOutReadings(cache, closeOut);
    if (readings.payoff.kind !== 'e1rm') throw new Error('unreachable');

    expect(readings.payoff.reading.kind).toBe('confirmed');
    // The whole point. The close-out computed one number; the server answered
    // with another; the screen shows the server's.
    const clientSaid = closeOut.newBestE1rmKg!;
    const serverSaid = clientSaid + SESSION_BOUNDARY_PREVIEW.SERVER_DRIFT_KG;
    expect(SESSION_BOUNDARY_PREVIEW.SERVER_DRIFT_KG).not.toBe(0);
    expect(readings.payoff.valueKg).toBeCloseTo(serverSaid, 6);
    expect(readings.payoff.valueKg).not.toBeCloseTo(clientSaid, 6);
    // And the PR call follows the server too: the drift takes the number back
    // under the previous best, so the gold has to go.
    expect(closeOut.isPr).toBe(true);
    expect(readings.payoff.isPr).toBe(false);
  });

  it('the unsynced beat is STALE and still shows the last confirmed truth', () => {
    const { state, cache } = previewFrameFor({ moment: 'close-out-unsynced' });
    expect(cache.status).toBe('stale');
    const readings = closeOutReadings(cache, state.closeOut!);
    if (readings.payoff.kind !== 'e1rm') throw new Error('unreachable');
    expect(readings.payoff.reading.kind).toBe('stale');
    // Last known truth is the PRE-session number: the proposal was refused.
    expect(readings.payoff.valueKg).toBe(SESSION_PREVIEW.BEST_E1RM_KG);
    expect(readings.streakValue).toBe(SESSION_PREVIEW.STREAK_BEFORE);
  });

  it('the accessory beat has NO e1RM payoff at all — GDD §3.2, ruled', () => {
    const { state, cache } = previewFrameFor({ moment: 'close-out-accessory' });
    const readings = closeOutReadings(cache, state.closeOut!);
    expect(readings.payoff.kind).toBe('training-iq');
    if (readings.payoff.kind !== 'training-iq') throw new Error('unreachable');
    // Not a zero, and not the previous best dressed up as today's.
    expect(readings.payoff.pointsGained).toBeNull();
    // The streak still moves: an accessory day is a trained day.
    expect(readings.streakValue).toBe(SESSION_PREVIEW.STREAK_BEFORE + 1);
  });

  it('AND IS NOT HEADED "NEW e1RM" — the words, not only the numbers', () => {
    // WHAT THIS CAUGHT. The numbers on this beat always honoured §3.2 and the
    // WORDS never did: `closeOutFrom` picked the headline from the client's PR
    // prediction alone, so an accessory day rendered a screen headed "NEW e1RM",
    // subheaded "You beat your best estimate on this lift", over a Training IQ
    // row with no number in it. A screen headed "NEW e1RM" is an e1RM close-out
    // whatever the digits do.
    const closeOut = previewFrameFor({ moment: 'close-out-accessory' }).state.closeOut!;
    expect(closeOut.payoff).toBe('training-iq');
    expect(closeOut.headline).toBe(SESSION_COPY.CLOSE_OUT_ACCESSORY_HEADLINE);
    expect(closeOut.subhead).toBe(SESSION_COPY.CLOSE_OUT_ACCESSORY_SUBHEAD);
    // Named individually rather than "is not one of the other three", so a
    // fourth e1RM headline appearing later does not slip past this.
    expect(closeOut.headline).not.toBe(SESSION_COPY.CLOSE_OUT_PR_HEADLINE);
    expect(closeOut.headline).not.toBe(SESSION_COPY.CLOSE_OUT_HELD_HEADLINE);
    expect(closeOut.subhead).not.toBe(SESSION_COPY.CLOSE_OUT_PR_SUBHEAD);
    expect(closeOut.subhead).not.toBe(SESSION_COPY.CLOSE_OUT_HELD_SUBHEAD);
    expect(closeOut.headline).not.toMatch(/e1RM/i);
    expect(closeOut.subhead).not.toMatch(/e1RM|estimate/i);
  });

  it('IS BUILT ON A READINESS THAT WOULD HAVE PRODUCED A PR', () => {
    // THE NON-VACUITY GUARD, AND THE REASON THE DEFECT SURVIVED.
    //
    // This beat used to be scripted on `STEADY` — the one readiness band that
    // arithmetically cannot produce a PR — while `close-out-pr`,
    // `close-out-saving`, `close-out-server-wins` and `close-out-unsynced` all
    // used `PRIMED`. So the single demonstration of accessory day was pointed
    // away from the case where it fails: on `STEADY` the headline came out
    // "SESSION LOGGED", which is merely wrong, and the "NEW e1RM" screen the
    // ruling forbids was never rendered by anything anybody looked at.
    //
    // Checked by construction rather than by reading the source: the SAME
    // readiness, played on a competition lift, has to reach a PR. If somebody
    // quietly puts the accessory fixture back on a calm day, this fails.
    const accessory = previewFrameFor({ moment: 'close-out-accessory' }).state.closeOut!;
    const pr = previewFrameFor({ moment: 'close-out-pr' }).state.closeOut!;
    expect(pr.isPr).toBe(true);
    expect(pr.headline).toBe(SESSION_COPY.CLOSE_OUT_PR_HEADLINE);
    // Same day, same RPE, same scripted reps, same prescription. The only
    // difference between the two close-outs is the payoff.
    expect(accessory.weightKg).toBe(pr.weightKg);
    expect(accessory.goodReps).toBe(pr.goodReps);
    expect(accessory.prescribedReps).toBe(pr.prescribedReps);
    expect(accessory.barSpeedText).toBe(pr.barSpeedText);
    // ...and the accessory one reports no PR and no e1RM, because it has none.
    expect(accessory.isPr).toBe(false);
    expect(accessory.newBestE1rmKg).toBeNull();
    expect(accessory.sessionE1rmKg).toBeNull();
    expect(accessory.prGainKg).toBeNull();
  });
});
