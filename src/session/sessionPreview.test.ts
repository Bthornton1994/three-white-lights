import { describe, expect, it } from 'vitest';

import {
  SESSION_MOMENTS,
  isSessionMoment,
  previewStateFor,
  sessionPreviewFrom,
} from './sessionPreview';
import { SESSION_PREVIEW, SESSION_TUNING } from '../game/sessionTuning';
import { liftForDay } from '../game/session';

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
    };
    for (const moment of SESSION_MOMENTS) {
      expect(previewStateFor({ moment }).phase, moment).toBe(expected[moment]);
    }
  });

  it('is deterministic — the same beat is the same screen every time', () => {
    for (const moment of SESSION_MOMENTS) {
      const a = previewStateFor({ moment });
      const b = previewStateFor({ moment });
      expect(JSON.stringify({ ...a, feel: null }), moment).toBe(
        JSON.stringify({ ...b, feel: null }),
      );
    }
  });

  it('opens on a blank check-in and shows two of three when partial', () => {
    const blank = previewStateFor({ moment: 'check-in' });
    expect(blank.answers).toEqual({ sleep: null, soreness: null, motivation: null });
    const partial = previewStateFor({ moment: 'check-in-partial' });
    expect(partial.answers.sleep).toBe('good');
    expect(partial.answers.soreness).toBe('fresh');
    expect(partial.answers.motivation).toBeNull();
  });

  it('the briefing beat has a surfaced modifier and no plan yet', () => {
    const state = previewStateFor({ moment: 'briefing' });
    expect(state.readiness?.label).toBe('Feeling primed +5%');
    expect(state.plan).toBeNull();
    expect(state.context.lift).toBe(liftForDay(SESSION_PREVIEW.DAY));
  });

  it('the rest beat is between the first and second set', () => {
    const state = previewStateFor({ moment: 'rest' });
    expect(state.setIndex).toBe(1);
    expect(state.completedSets).toHaveLength(1);
    expect(state.plan?.workSets).toBe(SESSION_TUNING.WORK_SETS);
  });

  it('the three close-outs really are three different close-outs', () => {
    const pr = previewStateFor({ moment: 'close-out-pr' }).closeOut;
    const held = previewStateFor({ moment: 'close-out-held' }).closeOut;
    const empty = previewStateFor({ moment: 'close-out-empty' }).closeOut;
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
      expect(JSON.stringify(previewStateFor({ moment }).closeOut), moment).not.toMatch(/total/i);
    }
  });
});
