/**
 * useLifter — Create Your Lifter and My Lifter sequenced against the app's
 * one connection. This hook stores no Total and mints none.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { CareerFederationId } from '../career/careerTuning';
import type { DotsSex } from '../game/dots';
import type { LifterServerPort } from '../game/lifterClient';
import type { LifterProfile, LifterRefusalCode } from '../game/lifterProfile';
import { openingCache } from '../game/sessionClient';
import type { ProgressionCache } from '../game/progression';
import {
  lifterCardFacts,
  lifterFederationOptions,
  lifterRefusalCopy,
  type LifterCardFacts,
  type LifterFederationOption,
  type LifterSurfacePhase,
} from './lifterSurface';

export interface LifterLoop {
  readonly phase: LifterSurfacePhase;
  readonly profile: LifterProfile | null;
  readonly card: LifterCardFacts | null;
  readonly options: readonly LifterFederationOption[];
  readonly nameDraft: string;
  readonly bodyweightDraft: string;
  readonly sexDraft: DotsSex | null;
  readonly federationDraft: CareerFederationId | null;
  readonly refusal: string | null;
  readonly inFlight: boolean;
  readonly setNameDraft: (value: string) => void;
  readonly setBodyweightDraft: (value: string) => void;
  readonly setSexDraft: (value: DotsSex) => void;
  readonly setFederationDraft: (value: CareerFederationId) => void;
  readonly create: () => void;
  readonly beginEditName: () => void;
  readonly beginEditBodyweight: () => void;
  readonly cancelEdit: () => void;
  readonly saveEdit: () => void;
}

export function useLifter(port: LifterServerPort, active: boolean): LifterLoop {
  const [cache, setCache] = useState<ProgressionCache>(() => openingCache(port));
  const [profile, setProfile] = useState<LifterProfile | null>(() => port.openingProfile());
  const [phase, setPhase] = useState<LifterSurfacePhase>(() =>
    port.openingProfile() === null ? 'creating' : 'card',
  );
  const [nameDraft, setNameDraft] = useState('');
  const [bodyweightDraft, setBodyweightDraft] = useState('');
  const [sexDraft, setSexDraft] = useState<DotsSex | null>(null);
  const [federationDraft, setFederationDraft] = useState<CareerFederationId | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    setCache(openingCache(port));
    const next = port.openingProfile();
    setProfile(next);
    if (next === null) {
      setPhase('creating');
    } else if (phase === 'creating') {
      setPhase('card');
    }
  }, [active, port, phase]);

  const create = useCallback(() => {
    if (inFlightRef.current) return;
    if (sexDraft === null) {
      setRefusal(lifterRefusalCopy('SEX_UNKNOWN'));
      return;
    }
    if (federationDraft === null) {
      setRefusal(lifterRefusalCopy('FEDERATION_UNKNOWN'));
      return;
    }
    inFlightRef.current = true;
    setInFlight(true);
    setRefusal(null);
    void port
      .createProfile(
        { name: nameDraft, sex: sexDraft, bodyweightKgText: bodyweightDraft },
        federationDraft,
      )
      .then((response) => {
        inFlightRef.current = false;
        setInFlight(false);
        if (response.kind === 'refused') {
          setRefusal(lifterRefusalCopy(response.code as LifterRefusalCode));
          return;
        }
        setProfile(response.profile);
        setCache(openingCache(port));
        setPhase('card');
        setRefusal(null);
      });
  }, [bodyweightDraft, federationDraft, nameDraft, port, sexDraft]);

  const beginEditName = useCallback(() => {
    if (profile === null) return;
    setNameDraft(profile.name);
    setRefusal(null);
    setPhase('editing-name');
  }, [profile]);

  const beginEditBodyweight = useCallback(() => {
    if (profile === null) return;
    setBodyweightDraft(String(profile.bodyweight.kilograms));
    setRefusal(null);
    setPhase('editing-bodyweight');
  }, [profile]);

  const cancelEdit = useCallback(() => {
    setRefusal(null);
    setPhase(profile === null ? 'creating' : 'card');
  }, [profile]);

  const saveEdit = useCallback(() => {
    if (inFlightRef.current || profile === null) return;
    inFlightRef.current = true;
    setInFlight(true);
    setRefusal(null);
    const request =
      phase === 'editing-name'
        ? port.editProfileName(nameDraft)
        : port.editProfileBodyweight(bodyweightDraft);
    void request.then((response) => {
      inFlightRef.current = false;
      setInFlight(false);
      if (response.kind === 'refused') {
        setRefusal(lifterRefusalCopy(response.code as LifterRefusalCode));
        return;
      }
      setProfile(response.profile);
      setCache(openingCache(port));
      setPhase('card');
    });
  }, [bodyweightDraft, nameDraft, phase, port, profile]);

  return {
    phase,
    profile,
    card: profile === null ? null : lifterCardFacts(profile, cache),
    options: lifterFederationOptions(),
    nameDraft,
    bodyweightDraft,
    sexDraft,
    federationDraft,
    refusal,
    inFlight,
    setNameDraft,
    setBodyweightDraft,
    setSexDraft,
    setFederationDraft,
    create,
    beginEditName,
    beginEditBodyweight,
    cancelEdit,
    saveEdit,
  };
}
