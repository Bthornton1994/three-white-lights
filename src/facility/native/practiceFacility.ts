import { EMPIRE_TUNING } from '../empireTuning';
import { createGymViewState, gymViewReduce, type GymViewState } from '../ladderView';
import type { EarningsMode } from '../ladder';
import type { FacilityPort, FacilityResponse } from '../../production/contracts';
import { NATIVE_FACILITY_TUNING as T } from './nativeTuning';

export interface PracticeFacilityClock {
  readonly state: GymViewState;
  readonly atMs: number;
}

/** Consume aligned wall time through the existing facility reducer. */
export function advancePracticeFacilityClock(
  clock: PracticeFacilityClock,
  nowMs: number,
  mode: EarningsMode,
): PracticeFacilityClock {
  const quantum = EMPIRE_TUNING.TICK_SECONDS * EMPIRE_TUNING.MILLISECONDS_PER_SECOND;
  const gapMs = Math.max(0, nowMs - clock.atMs);
  const elapsedMs = Math.floor(gapMs / quantum) * quantum;
  if (elapsedMs === 0) return clock;
  return {
    state: gymViewReduce(clock.state, {
      kind: 'advance-clock',
      gapSeconds: elapsedMs / EMPIRE_TUNING.MILLISECONDS_PER_SECOND,
      mode: mode === 'online' && gapMs > T.CLOCK_FOREGROUND_GAP_MS ? 'offline' : mode,
    }),
    atMs: clock.atMs + elapsedMs,
  };
}

export interface PracticeFacilityPort extends FacilityPort {
  setForeground(active: boolean): void;
}

/** Disposable practice for this app run; no save store or account mutation. */
export function createPracticeFacility(now: () => number = Date.now): PracticeFacilityPort {
  let clock: PracticeFacilityClock = { state: createGymViewState(), atMs: now() };
  let foreground = true;
  const responses = new Map<string, { action: string; response: FacilityResponse }>();
  function advance(): void {
    clock = advancePracticeFacilityClock(clock, now(), foreground ? 'online' : 'offline');
  }
  return {
    openingFacility: () => clock.state,
    setForeground(active) {
      advance();
      foreground = active;
    },
    async facilityAction(action, requestId) {
      const prior = responses.get(requestId);
      const fingerprint = JSON.stringify(action);
      if (prior) {
        if (prior.action !== fingerprint) return { kind: 'refused', message: 'Request id already used for another action.' };
        return prior.response;
      }
      advance();
      if (action.kind !== 'check-in') clock = { ...clock, state: gymViewReduce(clock.state, action) };
      else if (clock.state.lastRefusal !== null) clock = { ...clock, state: gymViewReduce(clock.state, { kind: 'advance-clock', gapSeconds: 0, mode: foreground ? 'online' : 'offline' }) };
      const response: FacilityResponse = clock.state.lastRefusal
        ? { kind: 'refused', message: clock.state.lastRefusal.replaceAll('-', ' '), state: clock.state }
        : { kind: 'saved', state: clock.state };
      responses.set(requestId, { action: fingerprint, response });
      return response;
    },
  };
}
