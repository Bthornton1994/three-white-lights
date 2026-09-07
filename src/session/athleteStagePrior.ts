import type { LiftState } from '../game/lift';

/**
 * The contract's `prior`, from the loop's history.
 *
 * `useLiftLoop` pushes every stepped state INCLUDING the current one, so the
 * previous tick is the second-from-last entry. On a catch-up frame several
 * ticks land at once and the stage draws only the last — `prior` is still
 * that tick's true predecessor, so `barVelocity` stays per-tick truth. If
 * history is empty or holds only the current state there is no adjacent
 * sample, and `null` lets the contract say so (`motionSampleValid: false`)
 * rather than this file guessing.
 */
export function priorFromHistory(
  history: readonly LiftState[],
  state: LiftState,
): LiftState | null {
  const last = history[history.length - 1];
  if (last === undefined) return null;
  if (last === state || last.tick === state.tick) return history[history.length - 2] ?? null;
  return last;
}
