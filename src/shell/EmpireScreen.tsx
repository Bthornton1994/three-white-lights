import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { FacilityPort } from '../production/contracts';
import type { LifterServerPort } from '../game/lifterClient';
import { NativeFacility } from '../facility/native/NativeFacility';
import { createPracticeFacility, type PracticeFacilityPort } from '../facility/native/practiceFacility';
import { assertNativeFacilityPair } from '../facility/native/nativePorts';
import type { EmpirePhase } from './shellTuning';

export interface EmpireScreenProps {
  readonly onPhase?: (phase: EmpirePhase) => void;
  readonly active?: boolean;
  readonly facilityPort?: FacilityPort;
  /** Identity must be supplied with the same account facility. */
  readonly facilityLifterPort?: LifterServerPort;
  readonly practiceLifterPort?: LifterServerPort;
  readonly onTrain?: () => void;
  readonly onCareer?: () => void;
}

/** Shared living facility scene; absent production injection opens disposable practice. */
export function EmpireScreen({ onPhase, active = true, facilityPort, facilityLifterPort, practiceLifterPort, onTrain, onCareer }: EmpireScreenProps): React.ReactElement {
  assertNativeFacilityPair(facilityPort, facilityLifterPort);
  const practiceRef = useRef<PracticeFacilityPort | null>(null);
  if (facilityPort === undefined && practiceRef.current === null) practiceRef.current = createPracticeFacility();
  const practicePort = practiceRef.current ?? undefined;
  const port = facilityPort ?? practicePort!;
  const owner = useRef({ port, generation: 0 });
  if (owner.current.port !== port) owner.current = { port, generation: owner.current.generation + 1 };
  useEffect(() => {
    if (!active) return;
    onPhase?.('floor');
  }, [onPhase, active]);
  return <View style={{ flex: 1 }} testID="empire-screen">
    <NativeFacility
      key={owner.current.generation}
      port={port}
      practice={facilityPort === undefined}
      practicePort={facilityPort === undefined ? practicePort : undefined}
      lifterPort={facilityPort === undefined ? practiceLifterPort : facilityLifterPort}
      active={active}
      onTrain={facilityPort === undefined ? onTrain : undefined}
      onCareer={facilityPort === undefined ? onCareer : undefined}
    />
  </View>;
}
