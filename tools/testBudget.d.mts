export interface SweepBudget {
  readonly GLOBAL_MS: number;
  readonly HEADROOM_FACTOR: number;
  readonly ROUND_UP_TO_MS: number;
  readonly DECLARE_ABOVE_MS: number;
  readonly SCALE_SAMPLE_MS: number;
  readonly SCALE_SAMPLES: number;
  readonly MIN_SCALE: number;
  readonly MAX_SCALE: number;
}
export const SWEEP_BUDGET: SweepBudget;
export function cpuShareSample(sampleMs?: number): number;
export function scaleFromShare(share: number): number;
export function contentionScale(): number;
export function resetContentionScale(): void;
export function budgetFrom(basisMs: number, scale?: number): number;
export function unscaledBudgetFrom(basisMs: number): number;
