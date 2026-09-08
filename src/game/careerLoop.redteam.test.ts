/**
 * careerLoop.redteam.test.ts — Career Loop V1 witnesses A–J.
 *
 * One player-equivalent path through the app's one local server: create,
 * train, qualify, enter, settle existing Meet Day, reload, see the next
 * decision. No parallel meet simulator. Forgery is a Career-calendar id
 * recorded without a booking, or a client definition the server must ignore.
 */

import { describe, expect, it } from 'vitest';

import { careerMeetFor, nextMeetOfTier, seasonAnchorDay } from '../career/calendar';
import { CAREER_TUNING } from '../career/careerTuning';
import { careerPresentationFor } from '../career/careerPresentation';
import { careerLifterFor } from './careerServer';
import { careerPresentationFromCache } from './careerClient';
import { isCareerMeetId } from './careerLoop';
import type { LiftKind } from './meet';
import { MEET_ENTRY, MEET_LOCAL, type MeetDefinition } from './meetTuning';
import {
  asMeetId,
  asProposalId,
  readBestE1rmKg,
  readMeets,
  readTotalKg,
  readingValue,
  type MeetAttemptReport,
  type ProposalOfKind,
  type TrainingSetReport,
} from './progression';
import { applyTrainingSession, newServerRecord } from './sessionServer';
import { openingCache } from './sessionClient';
import { addDays } from './streak';
import { localSessionServer, type SaveStore } from '../session/localSessionServer';

const MEET_DAY = seasonAnchorDay();
const SIGNUP_DAY = addDays(MEET_DAY, -40);
const TRAIN_DAY = addDays(MEET_DAY, -1);
const WALL_CLOCK = { year: 2026, month: 1, day: 2, hour: 19 } as const;
const LOCAL = careerMeetFor('meridian', 'local', MEET_DAY);
const REGIONAL = careerMeetFor(
  'meridian',
  'regional',
  addDays(MEET_DAY, CAREER_TUNING.PHASE_DAYS.regional),
);

const instantly = (): Promise<void> => Promise.resolve();

function fakeStore(initial: string | null = null): SaveStore & { text: string | null } {
  const box = {
    text: initial,
    load: () => box.text,
    save: (text: string) => {
      box.text = text;
    },
  };
  return box;
}

function portOn(store: SaveStore = fakeStore()) {
  return localSessionServer({
    store,
    sleep: instantly,
    latencyMs: 0,
    freshSignupDay: SIGNUP_DAY,
    nowIso: () => '2026-01-03T12:00:00.000Z',
  });
}

function trainingProposal(sets: readonly TrainingSetReport[]): ProposalOfKind<'record-training-session'> {
  return {
    kind: 'record-training-session',
    report: { deviceWallClock: WALL_CLOCK, card: { unit: 'kg', kilogramSets: sets } },
  };
}

const set = (lift: LiftKind, weight: number, reps: number, rpe: number): TrainingSetReport => ({
  lift,
  weight,
  reps,
  rpe,
  executionQuality: 1,
});

function attemptsAt(squat: number, bench: number, deadlift: number): MeetAttemptReport[] {
  const out: MeetAttemptReport[] = [];
  const loads: ReadonlyArray<readonly [LiftKind, number]> = [
    ['squat', squat],
    ['bench', bench],
    ['deadlift', deadlift],
  ];
  for (const [lift, weight] of loads) {
    out.push({ lift, attemptNumber: 1, weight, good: true });
    out.push({ lift, attemptNumber: 2, weight: weight + 2.5, good: false });
    out.push({ lift, attemptNumber: 3, weight: weight + 2.5, good: false });
  }
  return out;
}

function meetProposal(meetId: string, attempts: MeetAttemptReport[]): ProposalOfKind<'record-meet-result'> {
  return {
    kind: 'record-meet-result',
    report: {
      meetId: asMeetId(meetId),
      bodyweight: MEET_ENTRY.bodyweight,
      card: { unit: 'kg', kilogramAttempts: attempts },
    },
  };
}

function bombOutProposal(meetId: string): ProposalOfKind<'record-meet-result'> {
  return meetProposal(meetId, [
    { lift: 'squat', attemptNumber: 1, weight: 100, good: false },
    { lift: 'squat', attemptNumber: 2, weight: 100, good: false },
    { lift: 'squat', attemptNumber: 3, weight: 100, good: false },
  ]);
}

function forgedDefinition(id: string): MeetDefinition {
  return { ...MEET_LOCAL, id, qualifyingTotalKg: null };
}

async function chooseMeridian(port: ReturnType<typeof portOn>): Promise<void> {
  const chosen = await port.chooseFederation(
    { kind: 'choose-federation', report: { federationId: 'meridian' } },
    asProposalId('loop-choose'),
  );
  expect(chosen.kind).toBe('chosen');
}

describe('Career Loop V1 red team A–J', () => {
  it('A. a new lifter sees the first local meet and cannot enter a gated tier', async () => {
    const port = portOn();
    await chooseMeridian(port);
    const view = careerPresentationFromCache(openingCache(port), MEET_DAY, port.openingEnteredMeetId());
    expect(view).not.toBeNull();
    if (view === null) return;
    expect(view.nextDecision).toEqual({ kind: 'enter-meet', meetId: LOCAL.id });
    expect(view.upcoming.some((row) => row.meetId === LOCAL.id && row.enterable)).toBe(true);
    const regional = await port.enterMeet(REGIONAL.id, MEET_DAY);
    expect(regional.kind).toBe('refused');
    if (regional.kind === 'refused') expect(regional.error.code).toBe('BELOW_QUALIFYING_TOTAL');
    const nationals = nextMeetOfTier('meridian', 'nationals', MEET_DAY);
    expect(nationals).not.toBeNull();
    if (nationals === null) return;
    const gated = await port.enterMeet(nationals.id, MEET_DAY);
    expect(gated.kind).toBe('refused');
    if (gated.kind === 'refused') expect(gated.error.code).toBe('BELOW_QUALIFYING_TOTAL');
  });

  it('B / I. training moves e1RM and does not mint a competition Total', async () => {
    const port = portOn();
    const before = openingCache(port);
    expect(readingValue(readTotalKg(before))).toBeNull();
    const trained = await port.recordTrainingSession(
      TRAIN_DAY,
      trainingProposal([set('bench', 200, 3, 10), set('bench', 200, 3, 10), set('bench', 200, 3, 10)]),
      asProposalId('loop-train'),
    );
    expect(trained.kind).toBe('snapshot');
    const after = openingCache(port);
    expect(readingValue(readTotalKg(after))).toBeNull();
    const e1rmAfter = readingValue(readBestE1rmKg(after, 'bench'));
    const e1rmBefore = readingValue(readBestE1rmKg(before, 'bench'));
    expect(e1rmAfter ?? 0).toBeGreaterThan(e1rmBefore ?? 0);
    const view = careerPresentationFromCache(after, MEET_DAY, port.openingEnteredMeetId());
    expect(view?.bestCompetitionTotalKg).toBeNull();
    expect(view).not.toHaveProperty('bestE1rmKg');
  });

  it('C / G. a 400 kg local Total settles once, unlocks regional, and 399 does not', async () => {
    const underStore = fakeStore();
    const underPort = portOn(underStore);
    await chooseMeridian(underPort);
    const underEnter = await underPort.enterMeet(LOCAL.id, MEET_DAY);
    expect(underEnter.kind).toBe('entered');
    const underSettle = await underPort.recordMeetResult(
      MEET_DAY,
      forgedDefinition(LOCAL.id),
      meetProposal(LOCAL.id, attemptsAt(132.5, 132.5, 132.5)),
      asProposalId('loop-399'),
    );
    expect(underSettle.kind).toBe('recorded');
    if (underSettle.kind === 'recorded') expect(underSettle.result.totalKg).toBe(397.5);
    expect(readingValue(readTotalKg(openingCache(underPort)))).toBe(397.5);
    const stillGated = await underPort.enterMeet(REGIONAL.id, MEET_DAY);
    expect(stillGated.kind).toBe('refused');
    if (stillGated.kind === 'refused') expect(stillGated.error.code).toBe('BELOW_QUALIFYING_TOTAL');

    const store = fakeStore();
    const port = portOn(store);
    await chooseMeridian(port);
    const entered = await port.enterMeet(LOCAL.id, MEET_DAY);
    expect(entered.kind).toBe('entered');
    if (entered.kind !== 'entered') return;
    expect(entered.definition.qualifyingTotalKg).toBeNull();
    expect(entered.definition.id).toBe(LOCAL.id);
    const recorded = await port.recordMeetResult(
      MEET_DAY,
      forgedDefinition(LOCAL.id),
      meetProposal(LOCAL.id, attemptsAt(135, 132.5, 132.5)),
      asProposalId('loop-400'),
    );
    expect(recorded.kind).toBe('recorded');
    if (recorded.kind !== 'recorded') return;
    expect(recorded.result.totalKg).toBe(400);
    expect(readingValue(readTotalKg(openingCache(port)))).toBe(400);
    expect(port.openingEnteredMeetId()).toBeNull();
    const view = careerPresentationFromCache(openingCache(port), MEET_DAY, port.openingEnteredMeetId());
    expect(view?.bestCompetitionTotalKg).toBe(400);
    expect(view?.qualifying.find((row) => row.tier === 'regional')?.qualifies).toBe(true);
    expect(view?.nextDecision).toEqual({ kind: 'enter-meet', meetId: REGIONAL.id });
    const regional = await port.enterMeet(REGIONAL.id, MEET_DAY);
    expect(regional.kind).toBe('entered');
  });

  it('D. the same meet result cannot settle twice', async () => {
    const port = portOn();
    await chooseMeridian(port);
    await port.enterMeet(LOCAL.id, MEET_DAY);
    const first = await port.recordMeetResult(
      MEET_DAY,
      forgedDefinition(LOCAL.id),
      meetProposal(LOCAL.id, attemptsAt(135, 132.5, 132.5)),
      asProposalId('loop-d1'),
    );
    expect(first.kind).toBe('recorded');
    const replay = await port.recordMeetResult(
      MEET_DAY,
      forgedDefinition(LOCAL.id),
      meetProposal(LOCAL.id, attemptsAt(200, 200, 200)),
      asProposalId('loop-d2'),
    );
    expect(replay.kind).toBe('refused');
    if (replay.kind === 'refused') expect(replay.error.code).toBe('MEET_ALREADY_RECORDED');
    expect(readingValue(readTotalKg(openingCache(port)))).toBe(400);
  });

  it('E. entered and completed meet state survive reload', async () => {
    const store = fakeStore();
    const first = portOn(store);
    await chooseMeridian(first);
    const booked = await first.enterMeet(LOCAL.id, MEET_DAY);
    expect(booked.kind).toBe('entered');
    expect(first.openingEnteredMeetId()).toBe(LOCAL.id);

    const mid = portOn(store);
    expect(mid.openingEnteredMeetId()).toBe(LOCAL.id);
    expect(readingValue(readTotalKg(openingCache(mid)))).toBeNull();

    const settled = await mid.recordMeetResult(
      MEET_DAY,
      forgedDefinition('ignore-me'),
      meetProposal(LOCAL.id, attemptsAt(135, 132.5, 132.5)),
      asProposalId('loop-e1'),
    );
    expect(settled.kind).toBe('recorded');

    const reloaded = portOn(store);
    expect(reloaded.openingEnteredMeetId()).toBeNull();
    expect(readingValue(readTotalKg(openingCache(reloaded)))).toBe(400);
    const meets = readingValue(readMeets(openingCache(reloaded)));
    expect(meets?.map((meet) => meet.meetId)).toEqual([LOCAL.id]);
    const view = careerPresentationFromCache(
      openingCache(reloaded),
      MEET_DAY,
      reloaded.openingEnteredMeetId(),
    );
    expect(view?.history).toEqual([{ meetId: LOCAL.id, totalKg: 400 }]);
    expect(view?.nextDecision.kind).toBe('enter-meet');
  });

  it('F. a client cannot promote itself to nationals or worlds, and cannot bank a Career meet it never entered', async () => {
    const port = portOn();
    await chooseMeridian(port);
    const nationals = nextMeetOfTier('meridian', 'nationals', MEET_DAY);
    const worlds = nextMeetOfTier('meridian', 'competitive-worlds', MEET_DAY);
    expect(nationals).not.toBeNull();
    expect(worlds).not.toBeNull();
    if (nationals === null || worlds === null) return;
    const forgedNationals = await port.enterMeet(nationals.id, MEET_DAY);
    expect(forgedNationals.kind).toBe('refused');
    if (forgedNationals.kind === 'refused') expect(forgedNationals.error.code).toBe('BELOW_QUALIFYING_TOTAL');
    const forgedWorlds = await port.enterMeet(worlds.id, MEET_DAY);
    expect(forgedWorlds.kind).toBe('refused');
    if (forgedWorlds.kind === 'refused') expect(forgedWorlds.error.code).toBe('BELOW_QUALIFYING_TOTAL');

    const sneak = await port.recordMeetResult(
      MEET_DAY,
      forgedDefinition(nationals.id),
      meetProposal(nationals.id, attemptsAt(200, 200, 200)),
      asProposalId('loop-forge'),
    );
    expect(sneak.kind).toBe('refused');
    if (sneak.kind === 'refused') expect(sneak.error.code).toBe('NOT_ENTERED');
    expect(readingValue(readTotalKg(openingCache(port)))).toBeNull();
  });

  it('H. a bomb-out spends the entry and does not lower the best Total', async () => {
    const port = portOn();
    await chooseMeridian(port);
    await port.enterMeet(LOCAL.id, MEET_DAY);
    const good = await port.recordMeetResult(
      MEET_DAY,
      forgedDefinition(LOCAL.id),
      meetProposal(LOCAL.id, attemptsAt(135, 132.5, 132.5)),
      asProposalId('loop-h1'),
    );
    expect(good.kind).toBe('recorded');
    const nextLocal = careerMeetFor('meridian', 'local', addDays(MEET_DAY, 7));
    const booked = await port.enterMeet(nextLocal.id, addDays(MEET_DAY, 7));
    expect(booked.kind).toBe('entered');
    const bombed = await port.recordMeetResult(
      addDays(MEET_DAY, 7),
      forgedDefinition(nextLocal.id),
      bombOutProposal(nextLocal.id),
      asProposalId('loop-h2'),
    );
    expect(bombed.kind).toBe('recorded');
    if (bombed.kind === 'recorded') {
      expect(bombed.result.totalKg).toBeNull();
      expect(bombed.result.career.bestTotalKgAfter).toBe(400);
    }
    expect(readingValue(readTotalKg(openingCache(port)))).toBe(400);
    const lifter = careerLifterFor({
      federation: { id: 'meridian' },
      meets: readingValue(readMeets(openingCache(port))) ?? [],
    });
    expect(lifter.bestTotalKg).toBe(400);
    expect(lifter.enteredMeetIds).toEqual([LOCAL.id, nextLocal.id]);
    const replay = await port.enterMeet(nextLocal.id, addDays(MEET_DAY, 7));
    expect(replay.kind).toBe('refused');
    if (replay.kind === 'refused') expect(replay.error.code).toBe('ALREADY_ENTERED');
  });

  it('J. multiple meets keep history order and one persistent lifter', async () => {
    const store = fakeStore();
    const port = portOn(store);
    await chooseMeridian(port);
    await port.enterMeet(LOCAL.id, MEET_DAY);
    await port.recordMeetResult(
      MEET_DAY,
      forgedDefinition(LOCAL.id),
      meetProposal(LOCAL.id, attemptsAt(135, 132.5, 132.5)),
      asProposalId('loop-j1'),
    );
    const regionalEnter = await port.enterMeet(REGIONAL.id, MEET_DAY);
    expect(regionalEnter.kind).toBe('entered');
    const regionalSettle = await port.recordMeetResult(
      MEET_DAY,
      forgedDefinition(REGIONAL.id),
      meetProposal(REGIONAL.id, attemptsAt(200, 180, 220)),
      asProposalId('loop-j2'),
    );
    expect(regionalSettle.kind).toBe('recorded');
    if (regionalSettle.kind === 'recorded') expect(regionalSettle.result.totalKg).toBe(600);

    const reloaded = portOn(store);
    const meets = readingValue(readMeets(openingCache(reloaded)));
    expect(meets?.map((meet) => meet.meetId)).toEqual([LOCAL.id, REGIONAL.id]);
    expect(meets?.map((meet) => meet.totalKg)).toEqual([400, 600]);
    expect(readingValue(readTotalKg(openingCache(reloaded)))).toBe(600);
    const view = careerPresentationFromCache(
      openingCache(reloaded),
      MEET_DAY,
      reloaded.openingEnteredMeetId(),
    );
    expect(view?.federationId).toBe('meridian');
    expect(view?.history.map((row) => row.meetId)).toEqual([LOCAL.id, REGIONAL.id]);
    expect(view?.bestCompetitionTotalKg).toBe(600);
    expect(view?.qualifying.find((row) => row.tier === 'campaign-worlds')?.qualifies).toBe(true);
    expect(view?.qualifying.find((row) => row.tier === 'competitive-worlds')?.qualifies).toBe(false);
  });

  it('the debug MEET_LOCAL path still banks without a Career booking (sweep / local-open)', async () => {
    const port = portOn();
    const recorded = await port.recordMeetResult(
      MEET_DAY,
      MEET_LOCAL,
      meetProposal(MEET_LOCAL.id, attemptsAt(100, 100, 100)),
      asProposalId('loop-local-open'),
    );
    expect(recorded.kind).toBe('recorded');
    expect(isCareerMeetId(MEET_LOCAL.id)).toBe(false);
  });
});

describe('applyTrainingSession still cannot write Total (pin against a quiet coupling)', () => {
  it('a trained record’s totalKg stays null', () => {
    const trained = applyTrainingSession(
      newServerRecord(SIGNUP_DAY),
      TRAIN_DAY,
      trainingProposal([set('squat', 200, 3, 10)]),
      'loop-train-pin',
    );
    expect(trained.ok).toBe(true);
    if (!trained.ok) return;
    expect(trained.value.record.totalKg).toBeNull();
    expect(careerPresentationFor({
      today: MEET_DAY,
      federationChosen: true,
      enteredMeetId: null,
      lifter: careerLifterFor(trained.value.record),
      history: [],
    }).bestCompetitionTotalKg).toBeNull();
  });
});
