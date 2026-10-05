import { describe, expect, it } from 'vitest';
import type { LifterServerPort } from '../../game/lifterClient';
import { assertNativeFacilityPair } from './nativePorts';
import { createPracticeFacility } from './practiceFacility';

describe('native account facility boundary', () => {
  it('accepts explicit practice and a complete facility/lifter pair', () => {
    const facility = createPracticeFacility(() => 0);
    const identity = {} as LifterServerPort;
    expect(() => assertNativeFacilityPair(undefined, undefined)).not.toThrow();
    expect(() => assertNativeFacilityPair(facility, identity)).not.toThrow();
  });

  it('rejects both forms of partial account injection before a gym is opened', () => {
    const facility = createPracticeFacility(() => 0);
    const identity = {} as LifterServerPort;
    expect(() => assertNativeFacilityPair(facility, undefined)).toThrow(/both its facility port/);
    expect(() => assertNativeFacilityPair(undefined, identity)).toThrow(/same account/);
  });
});
