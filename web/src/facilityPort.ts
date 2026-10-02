import { createGymViewState, gymViewReduce } from '../../src/facility/ladderView';
import { EMPIRE_TUNING } from '../../src/facility/empireTuning';

import type { FacilityPort } from '../../src/production/contracts';
export type { FacilityAction, FacilityResponse, FacilityPort } from '../../src/production/contracts';

/** Explicit, disposable practice. Never writes account data or local storage. */
export function practiceFacility(): FacilityPort {
  let state = createGymViewState();
  let at = Date.now();
  return {
    openingFacility: () => state,
    async facilityAction(action) {
      const now = Date.now();
      const tick = EMPIRE_TUNING.TICK_SECONDS;
      const elapsed = Math.floor(Math.max(0, now - at) / (tick * EMPIRE_TUNING.MILLISECONDS_PER_SECOND)) * tick;
      if (elapsed > 0) {
        state = gymViewReduce(state, { kind: 'advance-clock', gapSeconds: elapsed, mode: 'online' });
        at += elapsed * EMPIRE_TUNING.MILLISECONDS_PER_SECOND;
      }
      if (action.kind !== 'check-in') state = gymViewReduce(state, action);
      if (state.lastRefusal) return { kind: 'refused', message: state.lastRefusal.replaceAll('-', ' '), state };
      return { kind: 'saved', state };
    },
  };
}
