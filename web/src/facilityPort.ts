import { createGymViewState, gymViewReduce, type GymViewAction, type GymViewState } from '../../src/facility/ladderView';
import { EMPIRE_TUNING } from '../../src/facility/empireTuning';

export type FacilityAction = Exclude<GymViewAction, { kind: 'advance-clock' | 'advance-to-next-week' | 'reset-gym' | 'apply-living-member-observations' | 'set-gym-surface' }> | { kind: 'check-in' };
export type FacilityResponse = { kind: 'saved'; state: GymViewState } | { kind: 'refused'; message: string; state?: GymViewState };
export interface FacilityPort {
  openingFacility(): GymViewState;
  facilityAction(action: FacilityAction, requestId: string): Promise<FacilityResponse>;
}

/** Explicit, disposable practice. Never writes account data or local storage. */
export function practiceFacility(): FacilityPort {
  let state = createGymViewState();
  let at = Date.now();
  return {
    openingFacility: () => state,
    async facilityAction(action) {
      const now = Date.now();
      const tick = EMPIRE_TUNING.TICK_SECONDS;
      const elapsed = Math.floor(Math.max(0, now - at) / (tick * 1000)) * tick;
      if (elapsed > 0) {
        state = gymViewReduce(state, { kind: 'advance-clock', gapSeconds: elapsed, mode: 'online' });
        at += elapsed * 1000;
      }
      if (action.kind !== 'check-in') state = gymViewReduce(state, action);
      if (state.lastRefusal) return { kind: 'refused', message: state.lastRefusal.replaceAll('-', ' '), state };
      return { kind: 'saved', state };
    },
  };
}
