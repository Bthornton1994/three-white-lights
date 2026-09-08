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
 * spends it on a physical progression opportunity: the next loadable
 * increment on the bar. The opportunity is a future prescription, not an
 * automatic e1RM PR, and not a visible meter.
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT
 * ---------------------------------------------------------------------------
 *   - Zero React, zero I/O, zero side effects, no clock, no randomness.
 *   - Every transition returns a new object; inputs are never mutated.
 *   - Settlement is a pure function of prior credit, whether an opportunity
 *     was on the bar, whether the heavier bar was realized, and today's
 *     stimulus. Replay is deterministic.
 *
 * ---------------------------------------------------------------------------
 * THE RULING THIS FILE ENCODES (GDD §3.4, Session A progression v3)
 * ---------------------------------------------------------------------------
 * Do not compound a percentage of current best every session. Do not try to
 * hide a fractional percent inside plate snap either: a 1.5% cap deadlocks
 * light bars and accelerates heavy ones. Instead:
 *
 *   1. Successful work earns CREDIT, not a load percent.
 *   2. Credit sits in a per-lift bank until it pays for one OPPORTUNITY.
 *   3. An opportunity is the ordinary snapped prescription PLUS ONE
 *      existing physical rounding increment (kg 2.5, lb 5). Not a percent.
 *   4. Today's work does not finance today's bar.
 *   5. RPE 6 is recovery: ineligible. RPE 7-10 may realize.
 *   6. Credit is consumed only when the heavier bar is actually realized
 *      as a new best e1RM. A miss does not burn the bank. Recovery does
 *      not cash a bank earned by productive work.
 *
 * Values below are beta GAME-PACING parameters, not sports-science claims.
 * Career mode still owns true multi-week training arcs.
 *
 * ---------------------------------------------------------------------------
 * NOT A METER (GDD §3.4, §12.3)
 * ---------------------------------------------------------------------------
 * The public surface returns credit units, a 0/1 opportunity, and the two
 * bars. Nothing here is a fatigue level, a progress bar, or a field
 * `SessionFeel` / close-out copy can bind. The persisted object is a raw
 * per-lift number the server stores, the same standing as the hidden
 * fatigue ledger: JSON, round-trippable, never rendered as a gauge.
 *
 * NEVER reconstruct the +increment as a percent into `prescribeSession`.
 * IEEE-754 can turn 174.999 into a snap-down to 172.5. The player path
 * writes `nudgedWeightKg` onto the plan.
 */

import { LIFT_ORDER, type LiftKind } from './meet';
import { rawLoadForRpeTarget, roundLoad, RPE_LOADING_TUNING, type WeightUnit } from './rpe';
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
  /**
   * 1 when prior credit can pay for an opportunity, else 0.
   * What COULD be spent. Recovery does not spend even when this is 1.
   */
  readonly availableSteps: number;
  /**
   * 1 when today's RPE is eligible AND an opportunity is paid for.
   * 0 on recovery, on empty credit, or when the increment would not
   * actually move the bar (should not happen with a real increment).
   */
  readonly appliedSteps: number;
  /**
   * Always 0. The player path must not reconstruct the +increment as a
   * percent into `prescribeSession` (IEEE snap-down). Use `nudgedWeightKg`.
   */
  readonly loadAdjustmentPercent: number;
  readonly unNudgedWeightKg: number;
  readonly nudgedWeightKg: number;
}

function ordinaryBarKg(
  e1rmKg: number,
  reps: number,
  rpe: number,
  unit: WeightUnit,
): number {
  const chart = rawLoadForRpeTarget(e1rmKg, reps, rpe);
  return roundLoad(chart, {
    unit,
    mode: SESSION_TUNING.LOAD_ROUNDING_MODE,
  });
}

/**
 * Put the next loadable increment on an already-snapped bar.
 *
 * Integer-step arithmetic, not `ordinary + increment` then snap-down:
 * IEEE-754 can make the sum look like 174.999 and snap to 172.5.
 */
function oneIncrementHeavier(ordinaryKg: number, unit: WeightUnit): number {
  const increment = RPE_LOADING_TUNING.ROUNDING_INCREMENT[unit];
  if (increment === undefined) {
    throw new RangeError(
      `trainingProgress: no rounding increment for unit ${String(unit)}.`,
    );
  }
  const steps = Math.round(ordinaryKg / increment);
  return Number(((steps + 1) * increment).toFixed(SESSION_TUNING.PRECISION_DECIMALS));
}

/**
 * RPE 6 is recovery (`SESSION_TUNING.RPE_CHOICES[0]`, stimulus weight 0).
 * RPE 7-10 may realize a physical opportunity.
 */
function isProgressionEligibleRpe(rpe: number): boolean {
  const recovery = SESSION_TUNING.RPE_CHOICES[0];
  return Number.isFinite(rpe) && rpe > recovery;
}

/**
 * Whether today's PRIOR credit may put one extra increment on the bar.
 *
 * Does not read today's session. Today's work cannot finance today's load.
 * Does not reconstruct the increment as a percent.
 */
export function progressionOffer(args: {
  readonly credit: number;
  readonly e1rmKg: number;
  readonly targetRpe: number;
  readonly repsPerSet?: number;
  readonly unit?: WeightUnit;
}): ProgressionOffer {
  const credit = Math.max(0, args.credit);
  const cost = TRAINING_PROGRESS_TUNING.CREDIT_PER_PROGRESSION_OPPORTUNITY;
  const available = cost > 0 && credit >= cost ? 1 : 0;
  const reps = args.repsPerSet ?? SESSION_TUNING.REPS_PER_SET;
  const unit = args.unit ?? SESSION_TUNING.LOAD_UNIT;
  const unNudgedWeightKg = ordinaryBarKg(args.e1rmKg, reps, args.targetRpe, unit);
  let appliedSteps = 0;
  let nudgedWeightKg = unNudgedWeightKg;
  if (available > 0 && isProgressionEligibleRpe(args.targetRpe)) {
    const heavier = oneIncrementHeavier(unNudgedWeightKg, unit);
    if (heavier > unNudgedWeightKg) {
      appliedSteps = 1;
      nudgedWeightKg = heavier;
    }
  }
  return {
    availableSteps: available,
    appliedSteps,
    loadAdjustmentPercent: 0,
    unNudgedWeightKg,
    nudgedWeightKg,
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
 *   4. if realized, consume exactly one `CREDIT_PER_PROGRESSION_OPPORTUNITY`
 *   5. add today's stimulus credit
 *
 * A failed opportunity (`realized === false`) consumes 0. Recovery and empty
 * credit are appliedSteps === 0, so also consume 0. Today's stimulus is added
 * either way, except that `sessionStimulusCredit` of a failure-only rectangle
 * is already 0.
 *
 * Never negative. Other lifts are untouched. Check-in is not a parameter.
 * One session realizes at most one opportunity, even if a caller passes a
 * larger `appliedSteps`.
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
  const opportunity = Math.max(0, Math.floor(args.appliedSteps)) > 0 ? 1 : 0;
  const earned = Math.max(0, args.sessionStimulus);
  const consumed = args.realized
    ? Math.min(
        held,
        opportunity * TRAINING_PROGRESS_TUNING.CREDIT_PER_PROGRESSION_OPPORTUNITY,
      )
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
