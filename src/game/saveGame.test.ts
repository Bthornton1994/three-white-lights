import { describe, expect, it } from 'vitest';

import { careerMeetFor, seasonAnchorDay } from '../career/calendar';
import { CAREER_TUNING } from '../career/careerTuning';
import { meetDefinitionFor } from './careerMeet';
import { applyFederationChoice } from './careerServer';
import type { LiftKind } from './meet';
import { applyMeetResult } from './meetServer';
import { MEET_ENTRY } from './meetTuning';
import {
  asMeetId,
  type MeetAttemptReport,
  type ProposalOfKind,
  type TrainingSetReport,
} from './progression';
import {
  SAVE_FORMAT,
  SAVE_REFUSAL_CODES,
  SAVE_VERSION,
  decodeSavedGame,
  encodeSavedGame,
} from './saveGame';
import { applyTrainingSession, newServerRecord, type ServerRecord } from './sessionServer';
import { SESSION_BOUNDARY } from './sessionTuning';
import { addDays, streakDayFromLocalWallClock } from './streak';

const SIGNUP_DAY = SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY;
const WALL_CLOCK = { year: 2026, month: 8, day: 3, hour: 19 };
const SAVED_AT = '2026-08-19T12:00:00.000Z';

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

/**
 * THE LADDER OF REAL RECORDS, built through the shipped write path — never
 * hand-rolled — so every round-trip below is of a record the server actually
 * produces. Each rung adds one subsystem's state to the save's burden:
 * training moves streak + e1RM + fatigue.sessions, the unluckiest rolls add an
 * injury, a meet (through Sprint 1c's own adapter) adds totalKg + meets[], and
 * the choice adds a chosen federation.
 */
function recordLadder(): ReadonlyArray<{ name: string; record: ServerRecord }> {
  const trainedDay = streakDayFromLocalWallClock(WALL_CLOCK);
  const fresh = newServerRecord(SIGNUP_DAY);

  const heavy = [
    set('bench', 200, 3, 10),
    set('bench', 200, 3, 10),
    set('bench', 200, 3, 10),
  ];
  const trained = applyTrainingSession(fresh, trainedDay, trainingProposal(heavy), 'save-t1');
  if (!trained.ok) throw new Error(`fixture: training refused — ${trained.error.message}`);

  // The injured rung is a LEGAL VALUE, not a played outcome: one session on a
  // fresh lifter carries no injury probability even under the unluckiest
  // rolls, and this test's subject is the CODEC's domain — every ServerRecord
  // the type admits — not the injury engine's reachability (fatigue.test.ts
  // owns that). The record is a real trained record with a well-formed
  // InjuryRecord placed on it.
  const injured: ServerRecord = {
    ...trained.value.record,
    fatigue: {
      sessions: trained.value.record.fatigue.sessions,
      injury: { kind: 'shoulder-niggle', lift: 'bench', startDay: trainedDay + 1, endDay: trainedDay + 3 },
    },
  };

  const meetDay = addDays(seasonAnchorDay(), CAREER_TUNING.PHASE_DAYS.local);
  const def = meetDefinitionFor(careerMeetFor('meridian', 'local', meetDay));
  const card: MeetAttemptReport[] = [];
  for (const lift of ['squat', 'bench', 'deadlift'] as const) {
    ([1, 2, 3] as const).forEach((attemptNumber, index) => {
      card.push({ lift, attemptNumber, weight: 100 + index * 5, good: true });
    });
  }
  const met = applyMeetResult(
    trained.value.record,
    meetDay,
    def,
    {
      kind: 'record-meet-result',
      report: { meetId: asMeetId(def.id), bodyweight: MEET_ENTRY.bodyweight, card: { unit: 'kg', kilogramAttempts: card } },
    },
    'save-m1',
  );
  if (!met.ok) throw new Error(`fixture: meet refused — ${met.error.message}`);

  const chosen = applyFederationChoice(
    met.value.record,
    { kind: 'choose-federation', report: { federationId: 'meridian' } },
    'save-f1',
  );
  if (!chosen.ok) throw new Error(`fixture: choice refused — ${chosen.error.message}`);

  return [
    { name: 'fresh', record: fresh },
    { name: 'trained', record: trained.value.record },
    { name: 'injured', record: injured },
    { name: 'met', record: met.value.record },
    { name: 'chosen', record: chosen.value.record },
  ];
}

describe('the save round-trips every record the server can hold', () => {
  it('decode(encode(record)) IS the record, at every rung of the ladder', () => {
    const ladder = recordLadder();
    // The domain, pinned as a count: five rungs, and the ladder really moved —
    // a fixture whose apply calls all silently no-oped would round-trip five
    // copies of the fresh record and prove nothing.
    expect(ladder.length).toBe(5);
    expect(ladder[2]?.record.fatigue.injury, 'the injured rung carries an injury').not.toBeNull();
    expect(ladder[3]?.record.totalKg, 'the met rung carries a total').not.toBeNull();
    expect(ladder[3]?.record.meets.length).toBe(1);
    expect(ladder[4]?.record.federation.chosen).toBe(true);

    for (const { name, record } of ladder) {
      const decoded = decodeSavedGame(encodeSavedGame(record, SAVED_AT));
      expect(decoded.ok, `${name}: ${decoded.ok ? '' : decoded.detail}`).toBe(true);
      if (!decoded.ok) continue;
      expect(decoded.record, name).toEqual(record);
      expect(decoded.savedAtIso).toBe(SAVED_AT);
      expect(decoded.profile, name).toBeNull();
    }
  });

  it('writes the envelope it says it writes', () => {
    const text = encodeSavedGame(newServerRecord(SIGNUP_DAY), SAVED_AT);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed.format).toBe(SAVE_FORMAT);
    expect(parsed.version).toBe(SAVE_VERSION);
    expect(parsed.savedAtIso).toBe(SAVED_AT);
    expect(Object.keys(parsed).sort()).toEqual([
      'fatigue',
      'format',
      'profile',
      'savedAtIso',
      'trainingProgressCredit',
      'version',
      'wire',
    ]);
    expect(parsed.profile).toBeNull();
  });
});

describe('a save is untrusted input, and every refusal is driven', () => {
  /** A known-good save, tampered one field at a time. The control decodes ok
   *  in every test, so a broken control cannot pass as a caught tamper. */
  const goodText = () => {
    const chosen = recordLadder()[4];
    if (chosen === undefined) throw new Error('fixture: the ladder lost its chosen rung');
    return encodeSavedGame(chosen.record, SAVED_AT);
  };
  const tampered = (mutate: (save: Record<string, unknown>) => void): string => {
    const save = JSON.parse(goodText()) as Record<string, unknown>;
    mutate(save);
    return JSON.stringify(save);
  };
  const expectRefusal = (text: string, code: string) => {
    const control = decodeSavedGame(goodText());
    expect(control.ok, 'CONTROL: the untampered save decodes').toBe(true);
    const decoded = decodeSavedGame(text);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.code, decoded.detail).toBe(code);
  };

  it('refuses text that is not JSON, and JSON that is not a save', () => {
    expectRefusal('not json at all', 'NOT_JSON');
    expectRefusal('[]', 'NOT_A_SAVE');
    expectRefusal(JSON.stringify({ format: 'somebody-elses-save', version: 1 }), 'NOT_A_SAVE');
  });

  it('REFUSES A SAVE FROM THE FUTURE rather than guessing at a shape this build never saw', () => {
    expectRefusal(tampered((s) => { s.version = SAVE_VERSION + 1; }), 'FUTURE_VERSION');
    expectRefusal(tampered((s) => { s.version = 0; }), 'UNKNOWN_VERSION');
  });

  it('inherits every refusal the progression boundary can make — one decoder, not a sibling', () => {
    // The load-bearing reuse claim, driven rather than described: these two
    // tampers are inside the WIRE, where this module wrote no validation of
    // its own, and both are refused because `receiveProgressionSnapshot` — the
    // same function that guards the client — runs on load.
    expectRefusal(
      tampered((s) => { (s.wire as { revision: number }).revision = -1; }),
      'BAD_WIRE',
    );
    expectRefusal(
      tampered((s) => { ((s.wire as { streak: { currentStreak: number } }).streak).currentStreak = -3; }),
      'BAD_WIRE',
    );
    expectRefusal(
      tampered((s) => { ((s.wire as { federation: { id: string } }).federation).id = 'not-a-federation'; }),
      'BAD_WIRE',
    );
  });

  it('validates the fatigue half field by field — the one half the wire does not carry', () => {
    expectRefusal(
      tampered((s) => { (s.fatigue as { sessions: unknown[] }).sessions.push({ day: 1, lift: 'curls', topRpe: 8, workSets: 3, repsPerSet: 5 }); }),
      'BAD_FATIGUE',
    );
    expectRefusal(
      tampered((s) => { (s.fatigue as { injury: unknown }).injury = { kind: 'lower-back-tweak', lift: 'squat', startDay: 9, endDay: 4 }; }),
      'BAD_FATIGUE',
    );
    expectRefusal(tampered((s) => { s.fatigue = 'tired'; }), 'BAD_FATIGUE');
  });

  it('validates training-progress credit field by field — the other half the wire does not carry', () => {
    expectRefusal(
      tampered((s) => {
        s.trainingProgressCredit = { squat: -1, bench: 0, deadlift: 0 };
      }),
      'BAD_TRAINING_PROGRESS',
    );
    expectRefusal(
      tampered((s) => {
        s.trainingProgressCredit = 'earned';
      }),
      'BAD_TRAINING_PROGRESS',
    );
    expectRefusal(
      tampered((s) => {
        delete s.trainingProgressCredit;
      }),
      'BAD_TRAINING_PROGRESS',
    );
  });

  it('the refusal codes are the closed set the shell will key copy to', () => {
    expect([...SAVE_REFUSAL_CODES].sort()).toEqual([
      'BAD_FATIGUE',
      'BAD_TRAINING_PROGRESS',
      'BAD_WIRE',
      'FUTURE_VERSION',
      'NOT_A_SAVE',
      'NOT_JSON',
      'UNKNOWN_VERSION',
    ]);
  });
});

describe('schema stability', () => {
  /**
   * WRITTEN BY `encodeSavedGame` AT THE SCHEMA'S BIRTH (2026-08-19, version 1)
   * AND PINNED AS A LITERAL — never regenerated. A round-trip test cannot
   * catch schema drift, because the encoder and decoder move together; this
   * string cannot move with them. It is the player's actual save file: the
   * day it stops decoding, every existing player's lifter stops loading, and
   * the fix is a version bump plus a migration arm in `decodeSavedGame` — the
   * one edit this test exists to force. NEVER edit the string to make it
   * pass.
   */
  const GOLDEN_V1 =
    '{"format":"three-white-lights-save","version":1,"savedAtIso":"2026-08-19T00:00:00.000Z",' +
    '"wire":{"revision":0,"totalKg":null,"bestE1rmKg":{"squat":180,"bench":120,"deadlift":220},' +
    '"streak":{"signupDay":20000,"currentStreak":0,"longestStreak":0,"lastTrainedDay":null,' +
    '"entitlement":{"windowIndex":0,"coveredDaysLeft":2,"purchasedDaysLeft":0},' +
    '"armedEntitlement":{"windowIndex":0,"coveredDaysLeft":2,"purchasedDaysLeft":0},' +
    '"entitlementArmed":true,"recoveryDayProtectionEnabled":true,"hasBankedFirstRecoveryDaySave":false},' +
    '"meets":[],"wallet":{"gymBucks":0,"chalk":0},"federation":{"id":"meridian","chosen":false},' +
    '"acknowledgedProposalId":null},"fatigue":{"sessions":[],"injury":null}}';

  const GOLDEN_V2 =
    '{"format":"three-white-lights-save","version":2,"savedAtIso":"2026-08-19T00:00:00.000Z",' +
    '"wire":{"revision":0,"totalKg":null,"bestE1rmKg":{"squat":180,"bench":120,"deadlift":220},' +
    '"streak":{"signupDay":20000,"currentStreak":0,"longestStreak":0,"lastTrainedDay":null,' +
    '"entitlement":{"windowIndex":0,"coveredDaysLeft":2,"purchasedDaysLeft":0},' +
    '"armedEntitlement":{"windowIndex":0,"coveredDaysLeft":2,"purchasedDaysLeft":0},' +
    '"entitlementArmed":true,"recoveryDayProtectionEnabled":true,"hasBankedFirstRecoveryDaySave":false},' +
    '"meets":[],"wallet":{"gymBucks":0,"chalk":0},"federation":{"id":"meridian","chosen":false},' +
    '"acknowledgedProposalId":null},"fatigue":{"sessions":[],"injury":null},"profile":null}';

  const GOLDEN_V3 =
    '{"format":"three-white-lights-save","version":3,"savedAtIso":"2026-08-19T00:00:00.000Z",' +
    '"wire":{"revision":0,"totalKg":null,"bestE1rmKg":{"squat":180,"bench":120,"deadlift":220},' +
    '"streak":{"signupDay":20000,"currentStreak":0,"longestStreak":0,"lastTrainedDay":null,' +
    '"entitlement":{"windowIndex":0,"coveredDaysLeft":2,"purchasedDaysLeft":0},' +
    '"armedEntitlement":{"windowIndex":0,"coveredDaysLeft":2,"purchasedDaysLeft":0},' +
    '"entitlementArmed":true,"recoveryDayProtectionEnabled":true,"hasBankedFirstRecoveryDaySave":false},' +
    '"meets":[],"wallet":{"gymBucks":0,"chalk":0},"federation":{"id":"meridian","chosen":false},' +
    '"acknowledgedProposalId":null},"fatigue":{"sessions":[],"injury":null},"profile":null,' +
    '"trainingProgressCredit":{"squat":0,"bench":0,"deadlift":0}}';

  it('A GOLDEN SAVE FROM VERSION 1 STAYS READABLE — identity is missing, credit is empty, progression is intact', () => {
    const decoded = decodeSavedGame(GOLDEN_V1);
    expect(decoded.ok, decoded.ok ? '' : decoded.detail).toBe(true);
    if (decoded.ok) {
      expect(decoded.record).toEqual(newServerRecord(SIGNUP_DAY));
      expect(decoded.savedAtIso).toBe('2026-08-19T00:00:00.000Z');
      expect(decoded.profile).toBeNull();
    }
  });

  it('A GOLDEN SAVE FROM VERSION 2 STAYS READABLE — credit migrates empty, identity and progression intact', () => {
    const decoded = decodeSavedGame(GOLDEN_V2);
    expect(decoded.ok, decoded.ok ? '' : decoded.detail).toBe(true);
    if (decoded.ok) {
      expect(decoded.record).toEqual(newServerRecord(SIGNUP_DAY));
      expect(decoded.profile).toBeNull();
    }
  });

  it('the current encoder writes version 3 with a training-progress sibling, and that golden stays readable', () => {
    expect(encodeSavedGame(newServerRecord(SIGNUP_DAY), '2026-08-19T00:00:00.000Z')).toBe(GOLDEN_V3);
    const decoded = decodeSavedGame(GOLDEN_V3);
    expect(decoded.ok, decoded.ok ? '' : decoded.detail).toBe(true);
    if (decoded.ok) {
      expect(decoded.record).toEqual(newServerRecord(SIGNUP_DAY));
      expect(decoded.profile).toBeNull();
    }
  });
});

describe('the save loader is a §7.5 route, and behaves like one', () => {
  it('seals the record a save decodes into, every nested object included', () => {
    // §7.5's `record` row for this module — the runtime half of the route
    // table's seal claim, in the shape every other row's witness takes. The
    // nested reads matter MORE here than at the other producers: the parsed
    // wire's arrays arrive from JSON.parse thawed, so a shallow freeze would
    // leave `meets` and its rows writable — the exact half a shell-only check
    // misses, and the half the deep seal is doing real work on.
    const ladder = recordLadder();
    const met = ladder[3];
    if (met === undefined) throw new Error('fixture: the ladder lost its met rung');
    const decoded = decodeSavedGame(encodeSavedGame(met.record, SAVED_AT));
    expect(decoded.ok, decoded.ok ? '' : decoded.detail).toBe(true);
    if (!decoded.ok) return;
    const record = decoded.record;
    expect(Object.isFrozen(record), 'the record itself').toBe(true);
    expect(Object.isFrozen(record.bestE1rmKg), 'bestE1rmKg').toBe(true);
    expect(Object.isFrozen(record.streak), 'streak').toBe(true);
    expect(Object.isFrozen(record.streak.entitlement), 'the live entitlement').toBe(true);
    expect(Object.isFrozen(record.wallet), 'wallet').toBe(true);
    expect(Object.isFrozen(record.meets), 'the meets array').toBe(true);
    // Guarded locals rather than direct `[0]` reads, for two reasons that are
    // really one: `Object.isFrozen(undefined)` is TRUE, so an indexed read on
    // an empty array would pass vacuously — and the narrowed type is what lets
    // the §7.5 ledger's audit see this as an element-depth read at all.
    const storedMeet = record.meets[0];
    if (storedMeet === undefined) throw new Error('fixture: the met rung decoded with no meet row');
    expect(Object.isFrozen(storedMeet), 'the meet row that carries totalKg').toBe(true);
    expect(Object.isFrozen(record.fatigue), 'fatigue').toBe(true);
    expect(Object.isFrozen(record.fatigue.sessions), 'the fatigue ledger').toBe(true);
    const fatigueRow = record.fatigue.sessions[0];
    if (fatigueRow === undefined) throw new Error('fixture: the met rung decoded with no fatigue row');
    expect(Object.isFrozen(fatigueRow), 'a fatigue row').toBe(true);
    expect(Object.isFrozen(record.trainingProgressCredit), 'trainingProgressCredit').toBe(true);
    expect(Object.isFrozen(record.federation), 'federation').toBe(true);
    const loose: { totalKg: number | null } = record;
    expect(() => {
      loose.totalKg = 9999;
    }).toThrow(TypeError);
    expect(record.totalKg, 'the write did not land').toBe(met.record.totalKg);
  });
});
