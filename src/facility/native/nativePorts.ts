import type { LifterServerPort } from '../../game/lifterClient';
import type { FacilityPort } from '../../production/contracts';

export type NativeFacilityPorts =
  | { readonly facilityPort?: undefined; readonly facilityLifterPort?: undefined }
  | { readonly facilityPort: FacilityPort; readonly facilityLifterPort: LifterServerPort };

export function assertNativeFacilityPair(facilityPort: FacilityPort | undefined, facilityLifterPort: LifterServerPort | undefined): void {
  if ((facilityPort === undefined) !== (facilityLifterPort === undefined)) {
    throw new Error('A saved native gym requires both its facility port and the same account’s lifter port.');
  }
}
