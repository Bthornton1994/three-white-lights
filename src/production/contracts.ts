import type { GymViewAction, GymViewState } from '../facility/ladderView';
import type { FatigueState } from '../game/fatigue';
import type { LifterProfile } from '../game/lifterProfile';
import type { ProgressionSnapshotWire } from '../game/progression';

export type FacilityAction = Exclude<GymViewAction, {
  kind: 'advance-clock' | 'advance-to-next-week' | 'reset-gym' |
    'apply-living-member-observations' | 'set-gym-surface';
}> | { kind: 'check-in' };
export type FacilityResponse = { kind: 'saved'; state: GymViewState } |
  { kind: 'refused'; message: string; state?: GymViewState };
export interface FacilityPort {
  openingFacility(): GymViewState;
  facilityAction(action: FacilityAction, requestId: string): Promise<FacilityResponse>;
}

/** Read model returned only after authenticated server bootstrap. */
export interface ProductionOpening {
  readonly wire: ProgressionSnapshotWire;
  readonly fatigue: FatigueState;
  readonly profile: LifterProfile | null;
  readonly facility: GymViewState;
  readonly serverDay: number;
  readonly serverNowMs: number;
  readonly revision: number;
}

export interface ProductionEnvelope<T = unknown> {
  readonly opening: ProductionOpening;
  readonly response: T;
}
