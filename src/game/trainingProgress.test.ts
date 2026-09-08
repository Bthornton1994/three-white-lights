import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { SESSION_TUNING, SESSION_PROGRESSION_GUARD, TRAINING_PROGRESS_TUNING } from './sessionTuning';
import { FATIGUE_TUNING } from './fatigue';
import { rawLoadForRpeTarget, roundLoad } from './rpe';
import {
  EMPTY_TRAINING_PROGRESS_CREDIT,
  copyTrainingProgressCredit,
  creditForLift,
  progressionOffer,
  settleTrainingProgress,
  stimulusCreditFor,
} from './trainingProgress';

const CREDIT_FOR_A_PLATE =
  TRAINING_PROGRESS_TUNING.CREDIT_PER_PROGRESSION_STEP *
  TRAINING_PROGRESS_TUNING.MAX_APPLIED_STEPS_PER_SESSION;

function snap(e1rmKg: number, rpe: number, percent: number): number {
  const chart = rawLoadForRpeTarget(e1rmKg, SESSION_TUNING.REPS_PER_SET, rpe);
  const nudged = chart * (1 + percent / SESSION_TUNING.PERCENT_TO_FRACTION);
  return roundLoad(nudged, {
    unit: SESSION_TUNING.LOAD_UNIT,
    mode: SESSION_TUNING.LOAD_ROUNDING_MODE,
  });
}

describe('purity contract', () => {
  const source = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'trainingProgress.ts'),
    'utf8',
  );
  function codeOnly(text: string): string {
    return text
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
      .replace(/'(?:\\.|[^'\\])*'/g, "''")
      .replace(/"(?:\\.|[^"\\])*"/g, '""');
  }
  it('is a pure module', () => {
    const code = codeOnly(source);
    expect(code).not.toContain('Date.now');
    expect(code).not.toContain('Math.random');
    expect(code).not.toContain('fetch(');
    expect(code).not.toMatch(/from\s*''react/);
  });
});

describe('TRAINING_PROGRESS_TUNING — GDD §3.4 pacing knobs', () => {
  it('a full reference session needs four same-lift sessions for one step', () => {
    expect(TRAINING_PROGRESS_TUNING.CREDIT_PER_PROGRESSION_STEP).toBe(4);
    expect(TRAINING_PROGRESS_TUNING.PROGRESSION_STEP_PERCENT).toBe(0.5);
    expect(TRAINING_PROGRESS_TUNING.MAX_APPLIED_STEPS_PER_SESSION).toBe(3);
  });

  it('the honest max step sits below the per-session e1RM guard', () => {
    const honestMax =
      TRAINING_PROGRESS_TUNING.PROGRESSION_STEP_PERCENT *
      TRAINING_PROGRESS_TUNING.MAX_APPLIED_STEPS_PER_SESSION;
    expect(honestMax / SESSION_TUNING.PERCENT_TO_FRACTION).toBeLessThan(
      SESSION_PROGRESSION_GUARD.MAX_E1RM_GAIN_FRACTION_PER_SESSION,
    );
  });
});

describe('sessionStimulusCredit, via stimulusCreditFor', () => {
  const full = {
    day: 0,
    lift: 'squat' as const,
    topRpe: 8,
    workSets: SESSION_TUNING.WORK_SETS,
    repsPerSet: SESSION_TUNING.REPS_PER_SET,
  };

  it('a completed 5×3 @ RPE 8 is 1.0 of a template', () => {
    expect(stimulusCreditFor(full)).toBe(1);
  });

  it('RPE 8, 9 and 10 of the same volume earn the same unit; RPE 6 earns 0', () => {
    expect(stimulusCreditFor({ ...full, topRpe: 6 })).toBe(0);
    expect(stimulusCreditFor({ ...full, topRpe: 7 })).toBe(FATIGUE_TUNING.STIMULUS_EFFORT_WEIGHTS.find((row) => row.rpe === 7)!.weight);
    expect(stimulusCreditFor({ ...full, topRpe: 9 })).toBe(stimulusCreditFor(full));
    expect(stimulusCreditFor({ ...full, topRpe: 10 })).toBe(stimulusCreditFor(full));
  });

  it('failure-only earns 0; last-set-miss volume earns a fraction', () => {
    expect(
      stimulusCreditFor({ ...full, topRpe: 10, repsPerSet: 2 }),
    ).toBe(0);
    const fourSets = stimulusCreditFor({ ...full, workSets: 4 });
    expect(fourSets).toBeGreaterThan(0);
    expect(fourSets).toBeLessThan(1);
    expect(fourSets).toBeCloseTo(4 / 5, 9);
  });
});

describe('progressionOffer — prior credit, plate-aware', () => {
  it('empty credit cannot mint a bar', () => {
    const offer = progressionOffer({ credit: 0, e1rmKg: 200, targetRpe: 8 });
    expect(offer.availableSteps).toBe(0);
    expect(offer.appliedSteps).toBe(0);
    expect(offer.loadAdjustmentPercent).toBe(0);
    expect(offer.nudgedWeightKg).toBe(offer.unNudgedWeightKg);
  });

  it('today’s stimulus is not an input — the offer cannot see it', () => {
    const source = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'trainingProgress.ts'),
      'utf8',
    );
    const start = source.indexOf('export function progressionOffer(');
    const body = source.slice(start, source.indexOf('\nexport interface ProgressSettlement', start));
    expect(body).toContain('credit');
    expect(body).not.toMatch(/sessionStimulus|fatigue|checkIn|readiness/);
  });

  it('at 200 kg @ RPE 8, one and two 0.5% steps snap identical; three clear a plate', () => {
    const unNudged = snap(200, 8, 0);
    expect(snap(200, 8, 0.5)).toBe(unNudged);
    expect(snap(200, 8, 1)).toBe(unNudged);
    expect(snap(200, 8, 1.5)).toBeGreaterThan(unNudged);

    const oneStep = progressionOffer({
      credit: TRAINING_PROGRESS_TUNING.CREDIT_PER_PROGRESSION_STEP,
      e1rmKg: 200,
      targetRpe: 8,
    });
    expect(oneStep.availableSteps).toBe(1);
    expect(oneStep.appliedSteps).toBe(0);

    const twoSteps = progressionOffer({
      credit: TRAINING_PROGRESS_TUNING.CREDIT_PER_PROGRESSION_STEP * 2,
      e1rmKg: 200,
      targetRpe: 8,
    });
    expect(twoSteps.availableSteps).toBe(2);
    expect(twoSteps.appliedSteps).toBe(0);

    const threeSteps = progressionOffer({
      credit: CREDIT_FOR_A_PLATE,
      e1rmKg: 200,
      targetRpe: 8,
    });
    expect(threeSteps.availableSteps).toBe(3);
    expect(threeSteps.appliedSteps).toBe(3);
    expect(threeSteps.nudgedWeightKg).toBeGreaterThan(threeSteps.unNudgedWeightKg);
  });

  it('applies the smallest n that actually moves the snapped bar, not all available', () => {
    // Bank enough for the cap. At 200 kg @ RPE 8 the smallest moving n is 3.
    const offer = progressionOffer({
      credit: CREDIT_FOR_A_PLATE + TRAINING_PROGRESS_TUNING.CREDIT_PER_PROGRESSION_STEP,
      e1rmKg: 200,
      targetRpe: 8,
    });
    expect(offer.availableSteps).toBe(TRAINING_PROGRESS_TUNING.MAX_APPLIED_STEPS_PER_SESSION);
    expect(offer.appliedSteps).toBe(3);
  });
});

describe('settleTrainingProgress — consume only on realization', () => {
  it('a failed opportunity does not burn the bank', () => {
    const prior = { squat: CREDIT_FOR_A_PLATE, bench: 2, deadlift: 3 };
    const settled = settleTrainingProgress({
      prior,
      lift: 'squat',
      appliedSteps: 3,
      realized: false,
      sessionStimulus: 0.8,
    });
    expect(settled.consumed).toBe(0);
    expect(settled.earned).toBe(0.8);
    expect(settled.pending).toBe(CREDIT_FOR_A_PLATE + 0.8);
    expect(settled.next.bench).toBe(2);
    expect(settled.next.deadlift).toBe(3);
  });

  it('a successful realization consumes exactly the applied steps, once', () => {
    const prior = { squat: CREDIT_FOR_A_PLATE, bench: 0, deadlift: 0 };
    const settled = settleTrainingProgress({
      prior,
      lift: 'squat',
      appliedSteps: 3,
      realized: true,
      sessionStimulus: 1,
    });
    expect(settled.consumed).toBe(CREDIT_FOR_A_PLATE);
    expect(settled.earned).toBe(1);
    expect(settled.pending).toBe(1);
    expect(settled.next.squat).toBe(1);
  });

  it('appliedSteps 0 never consumes, even if realized is true', () => {
    const settled = settleTrainingProgress({
      prior: { squat: 5, bench: 0, deadlift: 0 },
      lift: 'squat',
      appliedSteps: 0,
      realized: true,
      sessionStimulus: 1,
    });
    expect(settled.consumed).toBe(0);
    expect(settled.pending).toBe(6);
  });

  it('never goes negative, and copy never mutates the prior', () => {
    const prior = { squat: 1, bench: 2, deadlift: 3 };
    const frozen = copyTrainingProgressCredit(prior);
    settleTrainingProgress({
      prior: frozen,
      lift: 'bench',
      appliedSteps: 3,
      realized: true,
      sessionStimulus: 1,
    });
    expect(frozen).toEqual({ squat: 1, bench: 2, deadlift: 3 });
    expect(creditForLift(EMPTY_TRAINING_PROGRESS_CREDIT, 'squat')).toBe(0);
    expect(creditForLift({ squat: -4, bench: 0, deadlift: 0 }, 'squat')).toBe(0);
  });

  it('refuses a lift that is not a competition lift', () => {
    expect(() =>
      settleTrainingProgress({
        prior: EMPTY_TRAINING_PROGRESS_CREDIT,
        lift: 'press' as 'squat',
        appliedSteps: 0,
        realized: false,
        sessionStimulus: 0,
      }),
    ).toThrow(RangeError);
  });
});
