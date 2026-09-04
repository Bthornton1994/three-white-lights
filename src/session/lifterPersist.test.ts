/**
 * lifterPersist.test.ts — A2 identity beside the progression row.
 *
 * The server holds profile as a sibling of the record. A corrupt identity
 * fails closed as needs-completion without destroying Total.
 */

import { describe, expect, it } from 'vitest';

import { careerMeetFor, seasonAnchorDay } from '../career/calendar';
import { CAREER_TUNING } from '../career/careerTuning';
import { meetDefinitionFor } from '../game/careerMeet';
import { applyFederationChoice } from '../game/careerServer';
import { kilogramMeetEntryFrom } from '../game/lifterEntry';
import { createLifterProfile, type LifterDraft, type LifterProfile } from '../game/lifterProfile';
import { applyMeetResult } from '../game/meetServer';
import { MEET_ENTRY } from '../game/meetTuning';
import { asMeetId, type MeetAttemptReport } from '../game/progression';
import { decodeSavedGame, encodeSavedGame } from '../game/saveGame';
import { newServerRecord } from '../game/sessionServer';
import { SESSION_BOUNDARY } from '../game/sessionTuning';
import { addDays } from '../game/streak';
import { localSessionServer, type SaveStore } from './localSessionServer';

const SIGNUP_DAY = SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY;
const DRAFT: LifterDraft = { name: 'R. VELLUM', sex: 'male', bodyweightKgText: '83.5' };

function memoryStore(initial: string | null = null): SaveStore & { text: string | null } {
  const holder: { text: string | null } = { text: initial };
  return {
    get text() {
      return holder.text;
    },
    set text(value: string | null) {
      holder.text = value;
    },
    load: () => holder.text,
    save: (text: string) => {
      holder.text = text;
    },
  };
}

function instantServer(store?: SaveStore, profile?: LifterProfile | null) {
  return localSessionServer({
    store,
    profile,
    latencyMs: 0,
    sleep: async () => undefined,
    entropy: () => 'persist-entropy',
    nowIso: () => '2026-09-04T12:00:00.000Z',
    freshSignupDay: SIGNUP_DAY,
  });
}

function v1SaveWithChosenFederation(federationId: 'meridian' | 'ironline'): string {
  const chosen = applyFederationChoice(
    newServerRecord(SIGNUP_DAY),
    { kind: 'choose-federation', report: { federationId } },
    'v1-already-chosen',
  );
  if (!chosen.ok) throw new Error(chosen.error.message);
  const parsed = JSON.parse(encodeSavedGame(chosen.value.record, '2026-08-19T00:00:00.000Z')) as {
    version: number;
    profile?: unknown;
  };
  parsed.version = 1;
  delete parsed.profile;
  return JSON.stringify(parsed);
}

describe('16 save-roundtrip / 17 reload-same-id', () => {
  it('create, persist, reopen: the same id and name come back, not a remint', async () => {
    const store = memoryStore();
    const first = instantServer(store);
    expect(first.openingProfile()).toBeNull();
    const saved = await first.createProfile(DRAFT, 'meridian');
    expect(saved.kind).toBe('saved');
    if (saved.kind !== 'saved') return;
    const id = saved.profile.id;
    expect(store.load()).not.toBeNull();
    const reopened = instantServer(store);
    const loaded = reopened.openingProfile();
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(id);
    expect(loaded?.name).toBe('R. VELLUM');
    expect(loaded?.bodyweight.kilograms).toBe(83.5);
  });
});

describe('18 legacy-save-without-profile', () => {
  it('a v1 save still loads progression and reports identity as missing', () => {
    const record = newServerRecord(SIGNUP_DAY);
    const v1 = encodeSavedGame(record, '2026-08-19T00:00:00.000Z');
    const parsed = JSON.parse(v1) as { version: number; profile?: unknown };
    parsed.version = 1;
    delete parsed.profile;
    const text = JSON.stringify(parsed);
    const store = memoryStore(text);
    const server = instantServer(store);
    expect(server.openingProfile()).toBeNull();
    expect(server.openingSnapshot().totalKg).toBe(record.totalKg);
    expect(server.openingSnapshot().bestE1rmKg).toEqual(record.bestE1rmKg);
  });
});

describe('19 corrupt-profile-fail-closed', () => {
  it('a v2 save with a corrupt profile keeps the wire and asks for completion', () => {
    const record = newServerRecord(SIGNUP_DAY);
    const made = createLifterProfile(DRAFT, 'persist-entropy');
    if (!made.ok) throw new Error(made.detail);
    const good = encodeSavedGame(record, '2026-09-04T12:00:00.000Z', made.profile);
    const parsed = JSON.parse(good) as { profile: unknown; wire: { totalKg: number | null } };
    parsed.profile = { id: 'nope', name: 'R. VELLUM', sex: 'male', bodyweight: { unit: 'kg', kilograms: 83.5 } };
    const decoded = decodeSavedGame(JSON.stringify(parsed));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.profile).toBeNull();
    expect(decoded.record.bestE1rmKg).toEqual(record.bestE1rmKg);
    const store = memoryStore(JSON.stringify(parsed));
    const server = instantServer(store);
    expect(server.openingProfile()).toBeNull();
    expect(server.openingSnapshot().bestE1rmKg).toEqual(record.bestE1rmKg);
  });
});

describe('20 edit-name / 21 edit-bodyweight / 22 historical-results', () => {
  it('editing current identity does not rewrite a stored meet bodyweight or name-at-the-time Total', async () => {
    const store = memoryStore();
    const server = instantServer(store);
    const saved = await server.createProfile(DRAFT, 'meridian');
    expect(saved.kind).toBe('saved');
    if (saved.kind !== 'saved') return;
    const athlete = saved.profile;
    const meetDay = addDays(seasonAnchorDay(), CAREER_TUNING.PHASE_DAYS.local);
    const def = meetDefinitionFor(careerMeetFor('meridian', 'local', meetDay));
    const card: MeetAttemptReport[] = [];
    for (const lift of ['squat', 'bench', 'deadlift'] as const) {
      ([1, 2, 3] as const).forEach((attemptNumber, index) => {
        card.push({ lift, attemptNumber, weight: 100 + index * 5, good: true });
      });
    }
    const applied = applyMeetResult(
      newServerRecord(SIGNUP_DAY),
      meetDay,
      def,
      {
        kind: 'record-meet-result',
        report: {
          meetId: asMeetId(def.id),
          bodyweight: athlete.bodyweight,
          card: { unit: 'kg', kilogramAttempts: card },
        },
      },
      'lifter-hist-1',
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.record.meets[0]?.bodyweightKg).toBe(83.5);

    const withMeet = localSessionServer({
      store,
      record: applied.value.record,
      profile: athlete,
      latencyMs: 0,
      sleep: async () => undefined,
      entropy: () => 'persist-entropy',
      nowIso: () => '2026-09-04T12:00:00.000Z',
    });
    const renamed = await withMeet.editProfileName('S. QUILL');
    expect(renamed.kind).toBe('saved');
    const heavier = await withMeet.editProfileBodyweight('100');
    expect(heavier.kind).toBe('saved');
    if (heavier.kind !== 'saved') return;
    expect(heavier.profile.name).toBe('S. QUILL');
    expect(heavier.profile.bodyweight.kilograms).toBe(100);
    expect(withMeet.openingSnapshot().meets[0]?.bodyweightKg).toBe(83.5);
    expect(withMeet.openingSnapshot().totalKg).toBe(applied.value.record.totalKg);
    const nextEntry = kilogramMeetEntryFrom(heavier.profile, 'meridian', MEET_ENTRY.lot);
    expect(nextEntry.bodyweight.kilograms).toBe(100);
    expect(nextEntry.name).toBe('S. QUILL');
  });
});

describe('v1-already-chosen Create path', () => {
  it('a v1 save with Meridian chosen still needs identity and keeps Meridian after Create', async () => {
    const store = memoryStore(v1SaveWithChosenFederation('meridian'));
    const server = instantServer(store);
    expect(server.openingProfile()).toBeNull();
    expect(server.openingSnapshot().federation).toEqual({ id: 'meridian', chosen: true });

    const saved = await server.createProfile(DRAFT, 'meridian');
    expect(saved.kind).toBe('saved');
    if (saved.kind !== 'saved') return;
    expect(saved.profile.name).toBe('R. VELLUM');
    expect(server.openingProfile()?.id).toBe(saved.profile.id);
    expect(server.openingSnapshot().federation).toEqual({ id: 'meridian', chosen: true });
  });

  it('Create asking Ironline cannot move that v1 Meridian choice — identity still attaches', async () => {
    const store = memoryStore(v1SaveWithChosenFederation('meridian'));
    const server = instantServer(store);
    const saved = await server.createProfile(DRAFT, 'ironline');
    expect(saved.kind).toBe('saved');
    expect(server.openingSnapshot().federation).toEqual({ id: 'meridian', chosen: true });
    expect(server.openingProfile()?.name).toBe('R. VELLUM');
  });
});

describe('create also confirms federation once', () => {
  it('a fresh row comes back chosen as the federation the create asked for', async () => {
    const server = instantServer();
    const saved = await server.createProfile(DRAFT, 'ironline');
    expect(saved.kind).toBe('saved');
    expect(server.openingSnapshot().federation).toEqual({ id: 'ironline', chosen: true });
  });

  it('a second create does not remint the id', async () => {
    const server = instantServer();
    const first = await server.createProfile(DRAFT, 'meridian');
    const second = await server.createProfile({ ...DRAFT, name: 'OTHER NAME' }, 'meridian');
    expect(first.kind).toBe('saved');
    expect(second.kind).toBe('saved');
    if (first.kind !== 'saved' || second.kind !== 'saved') return;
    expect(second.profile.id).toBe(first.profile.id);
    expect(second.profile.name).toBe(first.profile.name);
  });

  it('an unknown federation is refused and no profile is stored', async () => {
    const server = instantServer();
    const refused = await server.createProfile(DRAFT, 'not-a-fed' as 'meridian');
    expect(refused.kind).toBe('refused');
    if (refused.kind !== 'refused') return;
    expect(refused.code).toBe('FEDERATION_UNKNOWN');
    expect(server.openingProfile()).toBeNull();
  });
});
