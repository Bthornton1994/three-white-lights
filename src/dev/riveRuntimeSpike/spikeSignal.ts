/**
 * spikeSignal — synthetic continuous values for the Rive runtime spike.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS NOT
 * ---------------------------------------------------------------------------
 * This is NOT gameplay. It does not import `LiftState`, `liftPresentationFrom`,
 * or anything from `src/game/**`. The spike's purpose is to prove the RUNTIME
 * — can a Rive view accept a continuous 60fps write stream without dropping
 * frames or leaking — not to prove the athlete or the mechanic. Feeding it
 * real `LiftState` would blur those two questions together, which is exactly
 * the trap the ownership ruling draws a line around: "prove the runtime, not
 * prove the artwork."
 *
 * The field NAMES below echo `LiftPresentation` on purpose (`repProgress` ~
 * `stand`, `barVelocity` ~ `barSpeed`, `strain` and `grindIntensity` ~
 * `strain` and `grind`) so the spike exercises values with the SHAPE a real
 * feed will have — a 0..1 ramp, a signed velocity, a magnitude that spikes —
 * without being fed by one.
 *
 * Pure, deterministic, framework-free. No React, no Rive import here.
 */

export interface SpikeSignal {
  /** 0..1, sawtooth — stands in for `LiftPresentation.stand`. */
  readonly repProgress: number;
  /** 0..1, tracks `repProgress` through one authored curve — a fake "bar height". */
  readonly barHeight: number;
  /** -1..1, signed — stands in for `LiftPresentation.barSpeed`. */
  readonly barVelocity: number;
  /** 0..1 — stands in for `LiftPresentation.strain`. */
  readonly strain: number;
  /** 0..1, spikes near the top of the rep — stands in for `LiftPresentation.grind`. */
  readonly grindIntensity: number;
}

import { SPIKE_SIGNAL as S } from './spikeTuning';

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * One synthetic frame at wall-clock `nowMs`. Pure function of time, so the
 * same instant always produces the same frame — exercised directly by
 * `spikeSignal.test.ts` without touching React or Rive.
 */
export function spikeSignalAt(nowMs: number): SpikeSignal {
  const repPhase = (nowMs % S.REP_PERIOD_MS) / S.REP_PERIOD_MS; // 0..1 sawtooth
  const repProgress = repPhase;

  // Ease-in-out so barHeight isn't a straight ramp — closer in SHAPE to a
  // real rep's height curve without deriving from one.
  const eased =
    repPhase < S.EASE_SPLIT
      ? 2 * repPhase * repPhase
      : 1 - Math.pow(-2 * repPhase + 2, 2) / 2;
  const barHeight = eased;

  // Signed velocity: the derivative's sign of the ease curve above, scaled to
  // -1..1. Fast in the middle of each half, near-zero at the turnarounds.
  const velocityPhase = Math.sin(repPhase * Math.PI * 2);
  const barVelocity = velocityPhase;

  const strainPhase = (nowMs % S.STRAIN_PERIOD_MS) / S.STRAIN_PERIOD_MS;
  const strain = clamp01(S.STRAIN_FLOOR + S.STRAIN_SPAN * Math.sin(strainPhase * Math.PI));

  // Grind: zero except a short spike near the top of each rep — mirrors
  // `LiftPresentation.grind`'s "non-zero only near the sticking point" shape.
  const distanceFromTop = Math.abs(repPhase - S.GRIND_PEAK_PHASE);
  const grindIntensity =
    distanceFromTop < S.GRIND_WINDOW
      ? clamp01(1 - distanceFromTop / S.GRIND_WINDOW) * strain
      : 0;

  return { repProgress, barHeight, barVelocity, strain, grindIntensity };
}

/** Every field this module produces, in the order a caller should bind them. */
export const SPIKE_SIGNAL_FIELDS = Object.freeze([
  'repProgress',
  'barHeight',
  'barVelocity',
  'strain',
  'grindIntensity',
] as const satisfies readonly (keyof SpikeSignal)[]);
