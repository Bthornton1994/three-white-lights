/**
 * trainingProgress.ts — per-lift progression credit (GDD §3.4).
 *
 * THIS IS PROGRESSION, NOT FATIGUE.
 *
 * Fatigue (`fatigue.ts`) stays a same-day / next-day feel ledger: windows,
 * bar-speed cues, miss odds, injury. It is not the long-term growth state.
 *
 * Training stimulus (`sessionStimulusCredit` in `fatigue.ts`) is what one
 * completed session is WORTH as successful prescribed work, in [0, 1] of a
 * 5×3 template. This module ACCUMULATES that worth into a per-lift bank and
 * spends it in bounded, plate-aware steps. The step is a future prescription
 * opportunity, not an automatic e1RM PR, and not a visible meter.
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT
 * ---------------------------------------------------------------------------
 *   - Zero React, zero I/O, zero side effects, no clock, no randomness.
 *   - Every transition returns a new object; inputs are never mutated.
 *   - Settlement is a pure function of prior credit, applied steps, whether
 *     the heavier bar was realized, and today's stimulus. Replay is
 *     deterministic.
 *
 * ---------------------------------------------------------------------------
 * THE RULING THIS FILE ENCODES (GDD §3.4, Session A progression v2)
 * ---------------------------------------------------------------------------
 * Do not compound a percentage of current best every session. That loop is
 * multiplicative and is what the 90/180-session stimulus-as-nudge model
 * exploded under. Instead:
 *
 *   1. Successful work earns CREDIT, not a load percent.
 *   2. Credit sits in a per-lift bank until it pays for a STEP.
 *   3. A step is 0.5% of the chart load, applied only from PRIOR credit.
 *   4. Today's work does not finance today's bar.
 *   5. Credit is consumed only when the heavier snapped bar is actually
 *      realized as a new best e1RM. A miss does not burn the bank. A
 *      snap-to-identical bar is not a realization and consumes nothing.
 *   6. The smallest number of steps that actually moves the snapped bar
 *      is what is applied, capped at MAX_APPLIED_STEPS_PER_SESSION.
 *
 * Values below are beta GAME-PACING parameters, not sports-science claims.
 * Career mode still owns true multi-week training arcs.
 *
 * ---------------------------------------------------------------------------
 * NOT A METER (GDD §3.4, §12.3)
 * ---------------------------------------------------------------------------
 * The public surface returns credit units, step counts and a load percent
 * for `prescribeSession`. Nothing here is a fatigue level, a progress bar,
 * or a field `SessionFeel` / close-out copy can bind. The persisted object
 * is a raw per-lift number the server stores, the same standing as the
 * hidden fatigue ledger: JSON, round-trippable, never rendered as a gauge.
 */

import { LIFT_ORDER, type LiftKind } from './meet';
import { rawLoadForRpeTarget, roundLoad } from './rpe';
import { SESSION_TUNING, TRAINING_PROGRESS_TUNING } from './sessionTuning';
import { sessionStimulusCredit, type SessionRecord } from './fatigue';

export { TRAINING_PROGRESS_TUNING };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * Per-lift progression credit. Raw units, never interpreted for display.
 *
 * Accessory is not a competition lift and has no e1RM, so it has no credit.
 * Missing keys are treated as 0. Never negative.
 */
export interface TrainingProgressCredit {
  readonly squat: number;
  readonly bench: number;
  readonly deadlift: number;
}

export const EMPTY_TRAINING_PROGRESS_CREDIT: TrainingProgressCredit = Object.freeze({
  squat: 0,
  bench: 0,
  deadlift: 0,
});

export function copyTrainingProgressCredit(
  state: TrainingProgressCredit,
): TrainingProgressCredit {
  return {
    squat: Math.max(0, state.squat),
    bench: Math.max(0, state.bench),
    deadlift: Math.max(0, state.deadlift),
  };
}

export function creditForLift(state: TrainingProgressCredit, lift: LiftKind): number {
  const value = state[lift];
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

// ---------------------------------------------------------------------------
// Offer — today's prescription uses PRIOR credit only
// ---------------------------------------------------------------------------

export interface ProgressionOffer {
  /** floor(credit / step-cost), capped. What COULD be spent. */
  readonly availableSteps: number;
  /**
   * Smallest n in 1..available that actually moves the snapped bar.
   * 0 when no n does — the plate ate the step, so nothing is offered
   * and nothing will be consumed.
   */
  readonly appliedSteps: number;
  /** `appliedSteps * PROGRESSION_STEP_PERCENT`. What `prescribeSession` gets. */
  readonly loadAdjustmentPercent: number;
  readonly unNudgedWeightKg: number;
  readonly nudgedWeightKg: number;
}

function snapChartLoad(e1rmKg: number, reps: number, rpe: number, percent: number): number {
  const chart = rawLoadForRpeTarget(e1rmKg, reps, rpe);
  const nudged = chart * (1 + percent / SESSION_TUNING.PERCENT_TO_FRACTION);
  return roundLoad(nudged, {
    unit: SESSION_TUNING.LOAD_UNIT,
    mode: SESSION_TUNING.LOAD_ROUNDING_MODE,
  });
}

/**
 * How many steps today's PRIOR credit may spend, and whether any of them
 * actually change the bar after plate snap.
 *
 * Does not read today's session. Today's work cannot finance today's load.
 */
export function progressionOffer(args: {
  readonly credit: number;
  readonly e1rmKg: number;
  readonly targetRpe: number;
  readonly repsPerSet?: number;
}): ProgressionOffer {
  const credit = Math.max(0, args.credit);
  const stepCost = TRAINING_PROGRESS_TUNING.CREDIT_PER_PROGRESSION_STEP;
  const maxSteps = TRAINING_PROGRESS_TUNING.MAX_APPLIED_STEPS_PER_SESSION;
  const available =
    stepCost <= 0 ? 0 : Math.min(maxSteps, Math.floor(credit / stepCost));
  const reps = args.repsPerSet ?? SESSION_TUNING.REPS_PER_SET;
  const unNudgedWeightKg = snapChartLoad(args.e1rmKg, reps, args.targetRpe, 0);
  let appliedSteps = 0;
  for (let n = 1; n <= available; n += 1) {
    const percent = n * TRAINING_PROGRESS_TUNING.PROGRESSION_STEP_PERCENT;
    const nudged = snapChartLoad(args.e1rmKg, reps, args.targetRpe, percent);
    if (nudged > unNudgedWeightKg) {
      appliedSteps = n;
      break;
    }
  }
  const loadAdjustmentPercent = appliedSteps * TRAINING_PROGRESS_TUNING.PROGRESSION_STEP_PERCENT;
  return {
    availableSteps: available,
    appliedSteps,
    loadAdjustmentPercent,
    unNudgedWeightKg,
    nudgedWeightKg: snapChartLoad(args.e1rmKg, reps, args.targetRpe, loadAdjustmentPercent),
  };
}

// ---------------------------------------------------------------------------
// Settlement — consume only on realization, then add today's credit
// ---------------------------------------------------------------------------

export interface ProgressSettlement {
  readonly next: TrainingProgressCredit;
  readonly consumed: number;
  readonly earned: number;
  readonly pending: number;
}

/**
 * One session's effect on the bank.
 *
 * Ordering, fixed:
 *   1. today's prescription used PRIOR credit (already decided as `appliedSteps`)
 *   2. player performed the session
 *   3. `realized` is whether the heavier snapped bar became a new best e1RM
 *   4. if realized, consume `appliedSteps * CREDIT_PER_PROGRESSION_STEP`
 *   5. add today's stimulus credit
 *
 * A failed opportunity (`realized === false`) consumes 0. A snap-to-identical
 * bar is appliedSteps === 0, so also consumes 0. Today's stimulus is added
 * either way, except that `sessionStimulusCredit` of a failure-only rectangle
 * is already 0.
 *
 * Never negative. Other lifts are untouched. Check-in is not a parameter.
 */
export function settleTrainingProgress(args: {
  readonly prior: TrainingProgressCredit;
  readonly lift: LiftKind;
  readonly appliedSteps: number;
  readonly realized: boolean;
  readonly sessionStimulus: number;
}): ProgressSettlement {
  if (!LIFT_ORDER.includes(args.lift)) {
    throw new RangeError(
      `trainingProgress: lift must be a competition lift, received ${String(args.lift)}.`,
    );
  }
  const held = creditForLift(args.prior, args.lift);
  const steps = Math.max(0, Math.floor(args.appliedSteps));
  const earned = Math.max(0, args.sessionStimulus);
  const consumed = args.realized
    ? Math.min(held, steps * TRAINING_PROGRESS_TUNING.CREDIT_PER_PROGRESSION_STEP)
    : 0;
  const pending = Math.max(0, held - consumed + earned);
  const next: TrainingProgressCredit = {
    squat: args.lift === 'squat' ? pending : Math.max(0, args.prior.squat),
    bench: args.lift === 'bench' ? pending : Math.max(0, args.prior.bench),
    deadlift: args.lift === 'deadlift' ? pending : Math.max(0, args.prior.deadlift),
  };
  return { next, consumed, earned, pending };
}

/**
 * Stimulus of one ledger rectangle, for settlement. Thin wrap so callers
 * of this module do not have to know `fatigue.ts`'s name for it.
 */
export function stimulusCreditFor(session: SessionRecord): number {
  return Math.max(0, sessionStimulusCredit(session));
}
