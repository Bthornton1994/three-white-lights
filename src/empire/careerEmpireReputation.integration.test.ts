/**
 * careerEmpireReputation.integration.test.ts — CAREER-EMPIRE-REP-01
 * through gymViewReduce: credit, replay identity, fail-closed unknown
 * meet, clock carry, relocation, reset, G.2E gate isolation, and the
 * Crossing 9 / Crossing 6-extended wiring pins.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import type { FloorSimServiceObservation } from './floorSim';
import { institutionalReputation } from './institutionalReputation';
import { gymViewReduce, createGymViewState, type GymViewState } from './ladderView';
import { withUpdatedGym } from './management';
import {
  meetDayFactsFromCache,
  type MeetServerPort,
  type MeetServerResponse,
  type RecordedMeet,
} from '../game/meetClient';
import { meetResultProposal } from '../game/meetDay';
import { MEET_MOMENTS, playMeet } from '../game/meetPreview';
import { MEET_ENTRY, MEET_LOCAL } from '../game/meetTuning';
import { asProposalId } from '../game/progression';
import { SESSION_BOUNDARY, SESSION_TUNING } from '../game/sessionTuning';
import { livingMemberById, type LivingGymMember } from './livingMembers';
import { equipmentBiasedMemberTypes } from './members';
import type { SessionEquipmentItem } from './sessions';
import { localSessionServer } from '../session/localSessionServer';
import { openingCache } from '../game/sessionClient';
import { meetScreenPort, withSportingCreditOnRecord } from '../shell/appServer';
import { frozenMeetFor, resolveEntry } from '../shell/shellRoute';
import type { PlayedMeetFacts } from './sportingReputationLedger';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SHELL = readFileSync(join(HERE, '..', 'shell', 'AppShell.tsx'), 'utf8');
const MEET_SCREEN = readFileSync(join(HERE, '..', 'meet', 'MeetScreen.tsx'), 'utf8');
const USE_MEET_DAY = readFileSync(join(HERE, '..', 'meet', 'useMeetDay.ts'), 'utf8');

const T = EMPIRE_TUNING;
const DAY = T.SECONDS_PER_DAY;
const GATE = T.HIGH_PAYING_MEMBER_ARRIVAL_REPUTATION_THRESHOLD;

const FIRST_OF_SIXTEEN_PR: PlayedMeetFacts = Object.freeze({
  totalKg: 600,
  isTotalPr: true,
  placing: Object.freeze({ place: 1, fieldSize: 16 }),
});

function creditLocal(state: GymViewState, facts: PlayedMeetFacts = FIRST_OF_SIXTEEN_PR) {
  return gymViewReduce(state, {
    kind: 'credit-sporting-result',
    meetId: MEET_LOCAL.id,
    facts,
  });
}

function observation(
  member: LivingGymMember,
  tick: number,
  facts: Partial<FloorSimServiceObservation> = {},
): FloorSimServiceObservation {
  return Object.freeze({
    memberId: member.id,
    memberIndex: 0,
    memberType: member.type,
    stationKind: 'training',
    stationKey: 'training:competition-bench-bay',
    queueWaitTicks: 200,
    trainingExperience: T.STATION_STOCK_TRAINING_EXPERIENCE,
    outcome: 'interrupted',
    observedAtTick: tick,
    ...facts,
  });
}

function adverse(member: LivingGymMember, tick: number): FloorSimServiceObservation {
  return observation(member, tick);
}

function stable(member: LivingGymMember, tick: number): FloorSimServiceObservation {
  return observation(member, tick, {
    queueWaitTicks: 0,
    trainingExperience: T.STATION_QUALITY_TRAINING_EXPERIENCE,
    outcome: 'completed',
  });
}

function requireMember(state: GymViewState, index: number): LivingGymMember {
  const member = state.livingMembers.members[index];
  if (member === undefined) throw new Error(`missing member at ${index}`);
  return member;
}

const ATHLETE_OWNED: readonly SessionEquipmentItem[] = Object.freeze([
  'sled',
  'bike',
  'treadmill',
  'rower',
]);

const SERIOUS_OWNED: readonly SessionEquipmentItem[] = Object.freeze([
  'foam-rollers',
  'sauna',
  'belts',
  'sleeves',
  'wrist-wraps',
  'machines',
]);

const HIGH_PAYING_KITS = Object.freeze([
  Object.freeze({ type: 'athlete' as const, owned: ATHLETE_OWNED, label: 'Athlete' }),
  Object.freeze({
    type: 'serious-lifter' as const,
    owned: SERIOUS_OWNED,
    label: 'Serious Lifter',
  }),
]);

function sessionOwnedOnGym(
  owned: readonly SessionEquipmentItem[],
): readonly SessionEquipmentItem[] {
  return Object.freeze(T.SESSION_EQUIPMENT_ITEMS.filter((item) => owned.includes(item)));
}

function withSessionOwned(
  state: GymViewState,
  owned: readonly SessionEquipmentItem[],
): GymViewState {
  return Object.freeze({
    ...state,
    managed: withUpdatedGym(
      state.managed,
      Object.freeze({
        ...state.managed.gym,
        sessionEquipment: sessionOwnedOnGym(owned),
      }),
    ),
  });
}

function departInteriorOnGym(state: GymViewState): {
  readonly state: GymViewState;
  readonly leftover: LivingGymMember;
} {
  const gone = requireMember(state, 1);
  const leftoverId = requireMember(state, 0).id;
  let next = state;
  for (let tick = 1; tick <= 10; tick += 1) {
    const current = livingMemberById(next.livingMembers, gone.id) ?? gone;
    next = gymViewReduce(next, {
      kind: 'apply-living-member-observations',
      observations: [adverse(current, tick)],
    });
  }
  const leftover = livingMemberById(next.livingMembers, leftoverId);
  if (leftover === null) throw new Error(`lost leftover ${leftoverId}`);
  return { state: next, leftover };
}

describe('CAREER-EMPIRE-REP-01 — credit through gymViewReduce', () => {
  it('credits first-of-16 plus PR as +40 stamped on the gym clock', () => {
    const opened = createGymViewState();
    const credited = creditLocal(opened);
    expect(credited.sportingReputation.creditedReputation).toBe(40);
    expect(credited.sportingReputation.entries[0]?.atSeconds).toBe(
      opened.managed.gym.ladder.collectedAt,
    );
    expect(credited.lastSportingCredit?.kind).toBe('credited');
    expect(credited.lastSportingCredit && credited.lastSportingCredit.kind === 'credited'
      ? credited.lastSportingCredit.reasons.map((row) => row.kind)
      : []).toEqual(['placing', 'total-pr']);
  });

  it('replays the same credit as a state identity no-op', () => {
    const credited = creditLocal(createGymViewState());
    const replay = creditLocal(credited);
    expect(replay).toBe(credited);
  });

  it('fails closed on an unknown meetId and leaves the ledger identical', () => {
    const opened = createGymViewState();
    const refused = gymViewReduce(opened, {
      kind: 'credit-sporting-result',
      meetId: 'not-a-meet',
      facts: FIRST_OF_SIXTEEN_PR,
    });
    expect(refused.lastSportingCredit).toEqual({
      kind: 'not-creditable',
      meetId: 'not-a-meet',
      reason: 'unknown-meet',
    });
    expect(refused.sportingReputation).toBe(opened.sportingReputation);
  });

  it('keeps the sporting ledger across advance-clock and composes with the member half', () => {
    const credited = creditLocal(createGymViewState());
    const advanced = gymViewReduce(credited, {
      kind: 'advance-clock',
      gapSeconds: DAY,
      mode: 'online',
    });
    expect(advanced.sportingReputation).toBe(credited.sportingReputation);
    const reading = institutionalReputation(
      advanced.livingMembers.reputation,
      advanced.sportingReputation,
    );
    expect(reading.fromSporting).toBe(40);
    expect(reading.fromMembers).toBe(advanced.livingMembers.reputation.creditedReputation);
    expect(reading.points).toBe(reading.fromMembers + reading.fromSporting);
    expect(reading.asOfSeconds).toBe(advanced.livingMembers.reputation.settledAtSeconds);
  });

  it('carries the sporting ledger on move-up and clears it on reset-gym', () => {
    const credited = creditLocal(createGymViewState());
    const moved = gymViewReduce(credited, { kind: 'move-up' });
    expect(moved.sportingReputation).toBe(credited.sportingReputation);
    const reset = gymViewReduce(moved, { kind: 'reset-gym' });
    expect(reset.sportingReputation).toEqual(createGymViewState().sportingReputation);
    expect(reset.lastSportingCredit).toBeNull();
  });
});

describe('CAREER-EMPIRE-REP-01 — G.2E gate stays member-only', () => {
  for (const spec of HIGH_PAYING_KITS) {
    it(`does not mint a ${spec.label} from sporting credit alone`, () => {
      const opened = withSessionOwned(createGymViewState(), spec.owned);
      expect(equipmentBiasedMemberTypes(opened.managed.gym.sessionEquipment)).toEqual([spec.type]);
      expect(opened.livingMembers.reputation.creditedReputation).toBe(0);
      const credited = creditLocal(opened);
      expect(credited.sportingReputation.creditedReputation).toBeGreaterThanOrEqual(1);
      expect(credited.livingMembers.reputation.creditedReputation).toBe(0);
      const { state: departed, leftover } = departInteriorOnGym(credited);
      const held = gymViewReduce(departed, {
        kind: 'apply-living-member-observations',
        observations: [stable(leftover, 11)],
      });
      expect(held.livingMembers.members.length).toBe(departed.livingMembers.members.length);
      expect(held.livingMembers.arrivals).toEqual([]);
      expect(held.livingMembers.members.some((member) => member.type === spec.type)).toBe(false);
    });

    it(`still mints a ${spec.label} once member credit meets the gate`, () => {
      let state = withSessionOwned(createGymViewState(), spec.owned);
      state = gymViewReduce(state, { kind: 'advance-clock', gapSeconds: DAY * 3, mode: 'online' });
      expect(state.livingMembers.reputation.creditedReputation).toBeGreaterThanOrEqual(GATE);
      const { state: departed, leftover } = departInteriorOnGym(state);
      const arrived = gymViewReduce(departed, {
        kind: 'apply-living-member-observations',
        observations: [stable(leftover, 11)],
      });
      expect(arrived.livingMembers.members.length).toBe(departed.livingMembers.members.length + 1);
      expect(arrived.livingMembers.members[arrived.livingMembers.members.length - 1]?.type).toBe(
        spec.type,
      );
    });
  }
});

describe('CAREER-EMPIRE-REP-01 — Crossing 9 / Crossing 6-extended wiring', () => {
  it('lifts the gym reducer onto AppShell and credits only the played route', () => {
    expect(APP_SHELL).toMatch(/useReducer\(gymViewReduce, undefined, createGymViewState\)/);
    expect(APP_SHELL).toMatch(/<GymHost[\s\S]*state=\{gymState\}[\s\S]*dispatch=\{dispatch\}/);
    expect(APP_SHELL).toMatch(
      /onRecorded=\{meetFrame === undefined \? creditSportingResult : undefined\}/,
    );
    expect(APP_SHELL).toMatch(/kind: 'credit-sporting-result'/);
    expect(APP_SHELL).toMatch(/facts: recorded/);
    expect(APP_SHELL).toMatch(/withSportingCreditOnRecord\(appMeetPort\(\), creditSportingResult\)/);
    expect(APP_SHELL).toMatch(/serverPort=\{meetScreenPort\(meetFrame, playedMeetPort, appMeetPort\(\)\)\}/);
    expect(APP_SHELL).not.toMatch(/meetFrame\?\.serverPort \?\? playedMeetPort/);
    expect(APP_SHELL).not.toMatch(/dispatchRef/);
  });

  it('MeetScreen reports an applied result through one optional onRecorded', () => {
    expect(MEET_SCREEN).toMatch(
      /readonly onRecorded\?: \(\(meetId: string, recorded: RecordedMeet\) => void\) \| undefined;/,
    );
    expect(MEET_SCREEN).toMatch(/onRecorded\?\.\(state\.context\.meet\.id, loop\.applied\)/);
    expect(MEET_SCREEN).toMatch(/useMeetDay\(serverPort, preview, preview !== undefined\)/);
    expect(MEET_SCREEN).not.toMatch(/useMeetDay\(serverPort, preview, preview !== undefined, onRecorded\)/);
  });

  it('useMeetDay does not take Crossing 9 onRecorded', () => {
    expect(USE_MEET_DAY).not.toMatch(/\bonRecorded\b/);
    expect(USE_MEET_DAY).not.toMatch(/onRecordedRef/);
  });
});

describe('CAREER-EMPIRE-REP-01 P1 — leave-before-response / unmount-before-onRecorded', () => {
  const DAY = SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY;

  function playAMeet(port: ReturnType<typeof localSessionServer>) {
    const facts = meetDayFactsFromCache(openingCache(port), DAY, SESSION_TUNING.STARTING_E1RM);
    const state = playMeet(
      () => 'perfect',
      () => 'small',
      {
        day: DAY,
        meet: MEET_LOCAL,
        entry: MEET_ENTRY,
        bestE1rmKg: facts.bestE1rmKg,
        previousBestTotalKg: facts.previousBestTotalKg,
        previousBestByLiftKg: facts.previousBestByLiftKg,
        fatigue: port.meetBrief(DAY).fatigue,
      },
    );
    const proposal = meetResultProposal(state);
    if (proposal === null) throw new Error('the played meet produced no proposal');
    return proposal;
  }

  it('Crossing 9 stays the MeetScreen report; AppShell owns the unmount-safe credit', () => {
    expect(MEET_SCREEN).toMatch(/onRecorded\?\.\(state\.context\.meet\.id, loop\.applied\)/);
    expect(USE_MEET_DAY).not.toMatch(/\bonRecorded\b/);
    expect(APP_SHELL).toMatch(/withSportingCreditOnRecord\(appMeetPort\(\), creditSportingResult\)/);
    expect(APP_SHELL).toMatch(/serverPort=\{meetScreenPort\(meetFrame, playedMeetPort, appMeetPort\(\)\)\}/);
  });

  it('credits sporting reputation when the screen unmounts before onRecorded', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const inner = localSessionServer({ sleep: () => held });
    const proposal = playAMeet(inner);

    let gym = createGymViewState();
    const creditSportingResult = (
      meetId: string,
      recorded: {
        readonly totalKg: number | null;
        readonly isTotalPr: boolean;
        readonly placing: PlayedMeetFacts['placing'];
      },
    ): void => {
      gym = gymViewReduce(gym, {
        kind: 'credit-sporting-result',
        meetId,
        facts: recorded,
      });
    };

    let screenMounted = true;
    const screenOnRecorded = (
      meetId: string,
      recorded: Parameters<typeof creditSportingResult>[1],
    ): void => {
      if (!screenMounted) return;
      creditSportingResult(meetId, recorded);
    };

    const playedPort = withSportingCreditOnRecord(inner, creditSportingResult);
    const pending = playedPort.recordMeetResult(
      DAY,
      MEET_LOCAL,
      proposal,
      asProposalId('meet-leave'),
    );

    // Player leaves during the in-flight save. MeetScreen unmounts; Crossing 9
    // cannot run. AppShell's played-port view still outlives the screen.
    screenMounted = false;

    release();
    const response = await pending;
    expect(response.kind).toBe('recorded');
    if (response.kind !== 'recorded') throw new Error('unreachable');
    expect(response.result.totalKg).not.toBeNull();

    screenOnRecorded(MEET_LOCAL.id, response.result);
    expect(gym.lastSportingCredit?.kind).toBe('credited');
    expect(gym.sportingReputation.creditedReputation).toBeGreaterThan(0);

    const replay = await inner.recordMeetResult(
      DAY,
      MEET_LOCAL,
      playAMeet(inner),
      asProposalId('meet-replay'),
    );
    expect(replay.kind).toBe('refused');
    if (replay.kind !== 'refused') throw new Error('unreachable');
    expect(replay.error.code).toBe('MEET_ALREADY_RECORDED');
    expect(gym.sportingReputation.creditedReputation).toBeGreaterThan(0);
  });

  it('a recorded Total that cannot credit fails closed with a visible report', async () => {
    const recorded: RecordedMeet = Object.freeze({
      totalKg: 600,
      previousBestTotalKg: null,
      isTotalPr: true,
      liftPrs: Object.freeze({ squat: false, bench: false, deadlift: false }),
      placing: Object.freeze({ place: 1, fieldSize: 16 }),
      bestByLiftKg: Object.freeze({ squat: 210, bench: 135, deadlift: 255 }),
      bombedLift: null,
    });
    const stub: MeetServerPort = {
      openingSnapshot: () => {
        throw new Error('unused');
      },
      meetBrief: () => {
        throw new Error('unused');
      },
      recordMeetResult: async (): Promise<MeetServerResponse> => ({
        kind: 'recorded',
        wire: recorded as never,
        result: recorded,
      }),
    };
    let gym = createGymViewState();
    const playedPort = withSportingCreditOnRecord(stub, (meetId, facts) => {
      gym = gymViewReduce(gym, { kind: 'credit-sporting-result', meetId, facts });
    });
    const response = await playedPort.recordMeetResult(
      DAY,
      { ...MEET_LOCAL, id: 'not-a-meet' },
      playAMeet(localSessionServer({ sleep: () => Promise.resolve() })),
      asProposalId('meet-unknown-view'),
    );
    expect(response.kind).toBe('recorded');
    expect(gym.lastSportingCredit).toEqual({
      kind: 'not-creditable',
      meetId: 'not-a-meet',
      reason: 'unknown-meet',
    });
    expect(gym.sportingReputation.creditedReputation).toBe(0);
  });
});

describe('CAREER-EMPIRE-REP-01 P2 — ?meet= frames do not credit', () => {
  const DAY = SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY;

  function playAMeet(port: MeetServerPort) {
    const facts = meetDayFactsFromCache(openingCache(port), DAY, SESSION_TUNING.STARTING_E1RM);
    const state = playMeet(
      () => 'perfect',
      () => 'small',
      {
        day: DAY,
        meet: MEET_LOCAL,
        entry: MEET_ENTRY,
        bestE1rmKg: facts.bestE1rmKg,
        previousBestTotalKg: facts.previousBestTotalKg,
        previousBestByLiftKg: facts.previousBestByLiftKg,
        fatigue: port.meetBrief(DAY).fatigue,
      },
    );
    const proposal = meetResultProposal(state);
    if (proposal === null) throw new Error('the played meet produced no proposal');
    return proposal;
  }

  function creditOnto(
    gym: GymViewState,
  ): {
    readonly gym: { current: GymViewState };
    readonly credit: (meetId: string, recorded: RecordedMeet) => void;
  } {
    const box = { current: gym };
    return {
      gym: box,
      credit: (meetId, recorded) => {
        box.current = gymViewReduce(box.current, {
          kind: 'credit-sporting-result',
          meetId,
          facts: recorded,
        });
      },
    };
  }

  it('?meet=live is a defined frame; the old ?? fallback would have selected the crediting view', () => {
    const entry = resolveEntry('?meet=live');
    const frame = frozenMeetFor(entry, entry.route);
    expect(frame).toBeDefined();
    expect(frame?.serverPort).toBeUndefined();

    const inner = localSessionServer({ sleep: () => Promise.resolve() });
    const played = withSportingCreditOnRecord(inner, () => undefined);
    // The P1 selection. Live's undefined stand-in coalesces onto the view.
    expect(frame?.serverPort ?? played).toBe(played);
    expect(meetScreenPort(frame, played, inner)).toBe(inner);
    expect(meetScreenPort(frame, played, inner)).not.toBe(played);
  });

  it('no ?meet= frame — including live — credits sporting reputation', async () => {
    const searches = [...MEET_MOMENTS.map((moment) => `?meet=${moment}`), '?meet=live'];
    expect(searches.length).toBe(MEET_MOMENTS.length + 1);

    for (const [index, search] of searches.entries()) {
      const entry = resolveEntry(search);
      const frame = frozenMeetFor(entry, entry.route);
      expect(frame, search).toBeDefined();

      const inner = localSessionServer({ sleep: () => Promise.resolve() });
      const box = creditOnto(createGymViewState());
      const played = withSportingCreditOnRecord(inner, box.credit);
      const port = meetScreenPort(frame, played, inner);
      expect(port, search).not.toBe(played);

      const proposal = playAMeet(port);
      const response = await port.recordMeetResult(
        DAY,
        MEET_LOCAL,
        proposal,
        asProposalId(`p2-debug-${String(index)}`),
      );
      expect(response.kind, search).toBe('recorded');
      if (response.kind !== 'recorded') throw new Error('unreachable');
      expect(response.result.totalKg, search).not.toBeNull();
      expect(box.gym.current.lastSportingCredit, search).toBeNull();
      expect(box.gym.current.sportingReputation.creditedReputation, search).toBe(0);
    }
  });

  it('the production path (no meetFrame) still credits through the AppShell-owned view', async () => {
    const inner = localSessionServer({ sleep: () => Promise.resolve() });
    const box = creditOnto(createGymViewState());
    const played = withSportingCreditOnRecord(inner, box.credit);
    const port = meetScreenPort(undefined, played, inner);
    expect(port).toBe(played);

    const response = await port.recordMeetResult(
      DAY,
      MEET_LOCAL,
      playAMeet(inner),
      asProposalId('p2-played'),
    );
    expect(response.kind).toBe('recorded');
    expect(box.gym.current.lastSportingCredit?.kind).toBe('credited');
    expect(box.gym.current.sportingReputation.creditedReputation).toBeGreaterThan(0);
  });
});
