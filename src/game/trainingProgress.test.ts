import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { SESSION_TUNING, SESSION_PROGRESSION_GUARD, TRAINING_PROGRESS_TUNING } from './sessionTuning';
import { FATIGUE_TUNING } from './fatigue';
import { rawLoadForRpeTarget, roundLoad, RPE_LOADING_TUNING } from './rpe';
import {
  EMPTY_TRAINING_PROGRESS_CREDIT,
  copyTrainingProgressCredit,
  creditForLift,
  progressionOffer,
  settleTrainingProgress,
  stimulusCreditFor,
} from './trainingProgress';

const CREDIT_FOR_A_PLATE = TRAINING_PROGRESS_TUNING.CREDIT_PER_PROGRESSION_OPPORTUNITY;

function ordinaryBar(e1rmKg: number, rpe: number): number {
  const chart = rawLoadForRpeTarget(e1rmKg, SESSION_TUNING.REPS_PER_SET, rpe);
  return roundLoad(chart, {
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

  it('does not reconstruct the increment as a percent', () => {
    const code = codeOnly(source);
    expect(code).not.toMatch(/PROGRESSION_STEP_PERCENT/);
    expect(code).not.toMatch(/CREDIT_PER_PROGRESSION_STEP/);
    expect(code).not.toMatch(/MAX_APPLIED_STEPS/);
    expect(source).toContain('nudgedWeightKg');
    expect(source).toContain('oneIncrementHeavier');
  });
});

describe('TRAINING_PROGRESS_TUNING — GDD §3.4 pacing knobs', () => {
  it('a full reference session needs twelve same-lift sessions for one opportunity', () => {
    expect(TRAINING_PROGRESS_TUNING.CREDIT_PER_PROGRESSION_OPPORTUNITY).toBe(12);
    expect(Object.keys(TRAINING_PROGRESS_TUNING)).toEqual(['CREDIT_PER_PROGRESSION_OPPORTUNITY']);
  });

  it('at the 200 kg fixture one increment sits below the per-session e1RM guard', () => {
    const increment = RPE_LOADING_TUNING.ROUNDING_INCREMENT[SESSION_TUNING.LOAD_UNIT];
    const chart = rawLoadForRpeTarget(200, SESSION_TUNING.REPS_PER_SET, 8);
    expect(increment / chart).toBeLessThan(
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

describe('progressionOffer — prior credit, physical increment', () => {
  it('empty credit cannot mint a bar', () => {
    const offer = progressionOffer({ credit: 0, e1rmKg: 200, targetRpe: 8 });
    expect(offer.availableSteps).toBe(0);
    expect(offer.appliedSteps).toBe(0);
    expect(offer.loadAdjustmentPercent).toBe(0);
    expect(offer.nudgedWeightKg).toBe(offer.unNudgedWeightKg);
    expect(offer.unNudgedWeightKg).toBe(ordinaryBar(200, 8));
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

  it('at 200 kg @ RPE 8, twelve credit puts exactly one increment on the bar', () => {
    const unNudged = ordinaryBar(200, 8);
    const increment = RPE_LOADING_TUNING.ROUNDING_INCREMENT[SESSION_TUNING.LOAD_UNIT];
    const short = progressionOffer({
      credit: CREDIT_FOR_A_PLATE - 1,
      e1rmKg: 200,
      targetRpe: 8,
    });
    expect(short.availableSteps).toBe(0);
    expect(short.appliedSteps).toBe(0);
    expect(short.nudgedWeightKg).toBe(unNudged);

    const offer = progressionOffer({
      credit: CREDIT_FOR_A_PLATE,
      e1rmKg: 200,
      targetRpe: 8,
    });
    expect(offer.availableSteps).toBe(1);
    expect(offer.appliedSteps).toBe(1);
    expect(offer.loadAdjustmentPercent).toBe(0);
    expect(offer.unNudgedWeightKg).toBe(unNudged);
    expect(offer.nudgedWeightKg).toBe(unNudged + increment);
  });

  it('surplus credit still spends exactly one opportunity', () => {
    const offer = progressionOffer({
      credit: CREDIT_FOR_A_PLATE * 4,
      e1rmKg: 200,
      targetRpe: 8,
    });
    expect(offer.availableSteps).toBe(1);
    expect(offer.appliedSteps).toBe(1);
  });

  it('RPE 6 is recovery: credit does not cash, bar does not move', () => {
    expect(SESSION_TUNING.RPE_CHOICES[0]).toBe(6);
    const recoveryWeight = FATIGUE_TUNING.STIMULUS_EFFORT_WEIGHTS.find((row) => row.rpe === 6)?.weight;
    expect(recoveryWeight).toBe(0);
    const offer = progressionOffer({
      credit: CREDIT_FOR_A_PLATE,
      e1rmKg: 200,
      targetRpe: 6,
    });
    expect(offer.availableSteps).toBe(1);
    expect(offer.appliedSteps).toBe(0);
    expect(offer.nudgedWeightKg).toBe(offer.unNudgedWeightKg);
  });

  it('RPE 7-10 are eligible', () => {
    for (const rpe of [7, 8, 9, 10]) {
      const offer = progressionOffer({ credit: CREDIT_FOR_A_PLATE, e1rmKg: 200, targetRpe: rpe });
      expect(offer.appliedSteps, `rpe ${rpe}`).toBe(1);
      expect(offer.nudgedWeightKg, `rpe ${rpe}`).toBeGreaterThan(offer.unNudgedWeightKg);
    }
  });

  it('lb unit adds the lb increment, not a different architecture', () => {
    const offer = progressionOffer({
      credit: CREDIT_FOR_A_PLATE,
      e1rmKg: 200,
      targetRpe: 8,
      unit: 'lb',
    });
    expect(offer.appliedSteps).toBe(1);
    expect(offer.nudgedWeightKg - offer.unNudgedWeightKg).toBe(RPE_LOADING_TUNING.ROUNDING_INCREMENT.lb);
  });
});

describe('settleTrainingProgress — consume only on realization', () => {
  it('a failed opportunity does not burn the bank', () => {
    const prior = { squat: CREDIT_FOR_A_PLATE, bench: 2, deadlift: 3 };
    const settled = settleTrainingProgress({
      prior,
      lift: 'squat',
      appliedSteps: 1,
      realized: false,
      sessionStimulus: 0.8,
    });
    expect(settled.consumed).toBe(0);
    expect(settled.earned).toBe(0.8);
    expect(settled.pending).toBe(CREDIT_FOR_A_PLATE + 0.8);
    expect(settled.next.bench).toBe(2);
    expect(settled.next.deadlift).toBe(3);
  });

  it('a successful realization consumes exactly one opportunity, once', () => {
    const prior = { squat: CREDIT_FOR_A_PLATE, bench: 0, deadlift: 0 };
    const settled = settleTrainingProgress({
      prior,
      lift: 'squat',
      appliedSteps: 1,
      realized: true,
      sessionStimulus: 1,
    });
    expect(settled.consumed).toBe(CREDIT_FOR_A_PLATE);
    expect(settled.earned).toBe(1);
    expect(settled.pending).toBe(1);
    expect(settled.next.squat).toBe(1);
  });

  it('a caller cannot consume more than one opportunity per session', () => {
    const settled = settleTrainingProgress({
      prior: { squat: 40, bench: 0, deadlift: 0 },
      lift: 'squat',
      appliedSteps: 3,
      realized: true,
      sessionStimulus: 1,
    });
    expect(settled.consumed).toBe(CREDIT_FOR_A_PLATE);
    expect(settled.pending).toBe(40 - CREDIT_FOR_A_PLATE + 1);
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
      appliedSteps: 1,
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

  it('other-lift credit is untouched — a squat settlement cannot steal bench', () => {
    const prior = { squat: CREDIT_FOR_A_PLATE, bench: 9, deadlift: 4 };
    const settled = settleTrainingProgress({
      prior,
      lift: 'squat',
      appliedSteps: 1,
      realized: true,
      sessionStimulus: 1,
    });
    expect(settled.next.bench).toBe(9);
    expect(settled.next.deadlift).toBe(4);
    expect(settled.next.squat).toBe(1);
  });
});
