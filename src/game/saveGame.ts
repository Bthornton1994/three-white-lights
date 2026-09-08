/**
 * saveGame.ts — the save file: GDD §10.0's "Nothing Is Lost", as a schema.
 *
 * ---------------------------------------------------------------------------
 * WHAT A SAVE IS, AND WHOSE JOB IT IS
 * ---------------------------------------------------------------------------
 * The one `ServerRecord` behind `appServer.ts`'s port, as versioned JSON.
 * Persistence is the SERVER's job — `localSessionServer.ts` has said so in its
 * header since before saves existed — so this module is server-side vocabulary:
 * the client above the port never sees a save, never writes one, and could not
 * forge one into truth if it did, because loading re-validates everything
 * through the same decoder that already refuses a bad snapshot.
 *
 * ---------------------------------------------------------------------------
 * ONE DECODER, DELIBERATELY
 * ---------------------------------------------------------------------------
 * The save's progression half IS a `ProgressionSnapshotWire`, produced by the
 * exported `snapshotWireFor` and re-validated on load by
 * `receiveProgressionSnapshot` — the identical function that guards the
 * client's boundary. A second decoder here would be the sibling-drift defect
 * this repository keeps measuring: two validators, one wire, and the day one
 * learns a new refusal the other keeps admitting the case. What this module
 * adds is only what the wire deliberately omits:
 *
 *   - FATIGUE. `ProgressionSnapshotWire` carries no fatigue BY DESIGN — GDD
 *     §3.4/§12.3 let only the narrowed brief cross to the client. A save that
 *     dropped it would make reloading the page a fatigue reset — a farmable
 *     freshness exploit — so the envelope carries `FatigueState` beside the
 *     wire, validated field by field on the way back in (`fatigue.ts` calls
 *     the shape "plain JSON; round-trips exactly", and this is where that
 *     sentence is made checkable).
 *   - TRAINING-PROGRESS CREDIT. Same class as fatigue: per-lift, server
 *     authoritative, not a ConfirmedFact, not a meter. A save that dropped
 *     it would make reloading a progression reset. Version 1 and 2 migrate
 *     as empty credit.
 *   - THE ENVELOPE. A format name, a schema version, and when it was saved.
 *
 * ---------------------------------------------------------------------------
 * VERSIONING: REFUSE FORWARD, MIGRATE BACKWARD, NEVER GUESS
 * ---------------------------------------------------------------------------
 * `version` is this build's schema number. A save from a NEWER build is
 * refused as `FUTURE_VERSION` — deleting a player's future is worse than
 * asking them to update — and the caller keeps the bytes (see `appServer.ts`'s
 * quarantine) rather than overwriting them. A save from an OLDER version gets
 * a migration arm here: version 1 loads as the current schema with
 * `profile: null` and empty training-progress credit; version 2 loads with
 * its profile and empty credit. An unknown lower version is refused as
 * `UNKNOWN_VERSION`.
 *
 * BACKEND-LIFTABLE is a property of this shape, not a promise: the payload is
 * the boundary's own wire plus one JSON-safe state, so lifting the store to
 * the hosted backend GDD §10.0 names moves WHERE the string lives and changes
 * nothing about what it says. (Worded without naming the vendor, for
 * `appServer.ts`'s reason: `realIp.ts` pins the real-name inventory per file,
 * and adding a mention is a human's call.)
 *
 * ---------------------------------------------------------------------------
 * EMPIRE IS DELIBERATELY ABSENT, AND THE ABSENCE HAS AN OWNER
 * ---------------------------------------------------------------------------
 * GDD §5's Gym Empire persists nothing here. Not an oversight: Session B is
 * mid-replacement of the whole §5 specification (its branch carries "§5.0 Why
 * this replaces rather than extends" and a rewritten data model), so freezing
 * today's empire shape into a schema would persist the exact model v2 exists
 * to delete — the category of mismatch this schema's own redesign started
 * from. When Empire v2's data model lands, its state gets a sibling field in
 * this envelope under a version bump, owned by whichever session wires the
 * Sprint-4 wallet seam. Until then, the empire floor remains per-run, which is
 * today's shipped behavior — a reload has always started a fresh gym.
 */

import { EMPTY_FATIGUE_STATE, INJURY_KINDS, SIM_LIFTS, type FatigueState, type InjuryKind, type SessionRecord, type SimLift } from './fatigue';
import {
  receiveProgressionSnapshot,
  sealServerValue,
  snapshotFacts,
  type ProgressionSnapshotWire,
} from './progression';
import { snapshotWireFor, type ServerRecord } from './sessionServer';
import { decodeLifterProfile, type LifterProfile } from './lifterProfile';
import {
  EMPTY_TRAINING_PROGRESS_CREDIT,
  copyTrainingProgressCredit,
  type TrainingProgressCredit,
} from './trainingProgress';
import { LIFT_ORDER, type LiftKind } from './meet';

/** The envelope's format tag — what says "this string is ours" before any
 *  version question is asked of it. */
export const SAVE_FORMAT = 'three-white-lights-save';

/** Schema version that first carried a profile sibling. */
export const SAVE_VERSION_V2 = 2 as const;

/**
 * Schema version that first carried per-lift training-progress credit.
 * Migrations: v1 and v2 load as empty credit. Bump `SAVE_VERSION` WITH a
 * migration arm in `decodeSavedGame`, never alone.
 */
export const SAVE_VERSION_TRAINING_PROGRESS = 3 as const;

/** This build's schema version. */
export const SAVE_VERSION = SAVE_VERSION_TRAINING_PROGRESS;

/** The envelope, as written. `wire` is the progression boundary's own shape. */
export interface SavedGameV1 {
  readonly format: typeof SAVE_FORMAT;
  readonly version: 1;
  /** ISO-8601, caller-supplied — this module never reads a clock. */
  readonly savedAtIso: string;
  readonly wire: ProgressionSnapshotWire;
  readonly fatigue: FatigueState;
}

/** Version 2 adds persistent athlete identity beside the progression wire. */
export interface SavedGameV2 {
  readonly format: typeof SAVE_FORMAT;
  readonly version: typeof SAVE_VERSION_V2;
  readonly savedAtIso: string;
  readonly wire: ProgressionSnapshotWire;
  readonly fatigue: FatigueState;
  readonly profile: LifterProfile | null;
}

/**
 * Version 3 adds per-lift training-progress credit beside the fatigue ledger.
 * Same standing as fatigue: JSON, round-trippable, never a ConfirmedFact,
 * never a player-facing meter.
 */
export interface SavedGameV3 {
  readonly format: typeof SAVE_FORMAT;
  readonly version: typeof SAVE_VERSION;
  readonly savedAtIso: string;
  readonly wire: ProgressionSnapshotWire;
  readonly fatigue: FatigueState;
  readonly profile: LifterProfile | null;
  readonly trainingProgressCredit: TrainingProgressCredit;
}

/**
 * Why a save was refused. A CLOSED SET, so the shell can key player-facing
 * copy to it later without parsing prose; `detail` is for logs and reports.
 */
export const SAVE_REFUSAL_CODES = [
  'NOT_JSON',
  'NOT_A_SAVE',
  'FUTURE_VERSION',
  'UNKNOWN_VERSION',
  'BAD_WIRE',
  'BAD_FATIGUE',
  'BAD_TRAINING_PROGRESS',
] as const;
export type SaveRefusalCode = (typeof SAVE_REFUSAL_CODES)[number];

export type SaveDecodeResult =
  | { readonly ok: true; readonly record: ServerRecord; readonly savedAtIso: string; readonly profile: LifterProfile | null }
  | { readonly ok: false; readonly code: SaveRefusalCode; readonly detail: string };

function refused(code: SaveRefusalCode, detail: string): SaveDecodeResult {
  return { ok: false, code, detail };
}

/** The record as a save string. `savedAtIso` is caller-supplied — the server
 *  owns the clock the way it owns the row. */
export function encodeSavedGame(
  record: ServerRecord,
  savedAtIso: string,
  profile: LifterProfile | null = null,
): string {
  const save: SavedGameV3 = {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAtIso,
    wire: snapshotWireFor(record, null),
    fatigue: record.fatigue,
    profile,
    trainingProgressCredit: copyTrainingProgressCredit(
      record.trainingProgressCredit ?? EMPTY_TRAINING_PROGRESS_CREDIT,
    ),
  };
  return JSON.stringify(save);
}

/** A finite integer, the way every day index and count in a save must be. */
function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * The fatigue half's validator. Field-by-field over untrusted JSON, in the
 * trust class of `readKilogramSets`: a save file is a client-writable string
 * whatever wrote it, and every claim in it is re-proved here or refused.
 */
function decodeFatigue(value: unknown): { ok: true; state: FatigueState } | { ok: false; detail: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, detail: `fatigue must be an object, received a ${Array.isArray(value) ? 'array' : typeof value}` };
  }
  const shape = value as { sessions?: unknown; injury?: unknown };
  if (!Array.isArray(shape.sessions)) {
    return { ok: false, detail: 'fatigue.sessions must be an array' };
  }
  const sessions: SessionRecord[] = [];
  for (let index = 0; index < shape.sessions.length; index += 1) {
    const row = shape.sessions[index] as Partial<SessionRecord> | null;
    if (typeof row !== 'object' || row === null) {
      return { ok: false, detail: `fatigue.sessions[${index}] must be an object` };
    }
    if (!isCount(row.day)) return { ok: false, detail: `fatigue.sessions[${index}].day must be a whole day index` };
    if (!(SIM_LIFTS as readonly string[]).includes(row.lift as string)) {
      return { ok: false, detail: `fatigue.sessions[${index}].lift is not a lift this build knows: ${String(row.lift)}` };
    }
    if (typeof row.topRpe !== 'number' || !Number.isFinite(row.topRpe)) {
      return { ok: false, detail: `fatigue.sessions[${index}].topRpe must be a finite number` };
    }
    if (!isCount(row.workSets) || !isCount(row.repsPerSet)) {
      return { ok: false, detail: `fatigue.sessions[${index}] set/rep counts must be whole numbers` };
    }
    sessions.push({
      day: row.day,
      lift: row.lift as SimLift,
      topRpe: row.topRpe,
      workSets: row.workSets,
      repsPerSet: row.repsPerSet,
    });
  }
  let injury: FatigueState['injury'] = null;
  if (shape.injury !== null && shape.injury !== undefined) {
    const row = shape.injury as Partial<NonNullable<FatigueState['injury']>>;
    if (typeof row !== 'object') return { ok: false, detail: 'fatigue.injury must be an object or null' };
    if (!(INJURY_KINDS as readonly string[]).includes(row.kind as string)) {
      return { ok: false, detail: `fatigue.injury.kind is not a kind this build knows: ${String(row.kind)}` };
    }
    if (!(SIM_LIFTS as readonly string[]).includes(row.lift as string)) {
      return { ok: false, detail: `fatigue.injury.lift is not a lift this build knows: ${String(row.lift)}` };
    }
    if (!isCount(row.startDay) || !isCount(row.endDay) || row.endDay < row.startDay) {
      return { ok: false, detail: 'fatigue.injury days must be whole and ordered startDay <= endDay' };
    }
    injury = {
      kind: row.kind as InjuryKind,
      lift: row.lift as SimLift,
      startDay: row.startDay,
      endDay: row.endDay,
    };
  }
  if (sessions.length === 0 && injury === null) return { ok: true, state: EMPTY_FATIGUE_STATE };
  return { ok: true, state: { sessions, injury } };
}

function isCredit(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function decodeTrainingProgress(
  value: unknown,
): { ok: true; state: TrainingProgressCredit } | { ok: false; detail: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      ok: false,
      detail: `trainingProgressCredit must be an object, received a ${Array.isArray(value) ? 'array' : typeof value}`,
    };
  }
  const shape = value as Partial<Record<LiftKind, unknown>>;
  const next: { squat: number; bench: number; deadlift: number } = {
    squat: 0,
    bench: 0,
    deadlift: 0,
  };
  for (const lift of LIFT_ORDER) {
    const raw = shape[lift];
    if (!isCredit(raw)) {
      return {
        ok: false,
        detail: `trainingProgressCredit.${lift} must be a finite non-negative number`,
      };
    }
    next[lift] = raw;
  }
  return { ok: true, state: next };
}

/**
 * A save string back into a `ServerRecord`, or a refusal that says why.
 *
 * THE PROGRESSION HALF IS VALIDATED BY THE BOUNDARY'S OWN DECODER — every
 * refusal `receiveProgressionSnapshot` can make, a save inherits verbatim —
 * and the streak and federation come out of the DECODED snapshot
 * (`snapshotFacts`), so a value the decoder rebuilt is the value the record
 * carries: the same one-path rule the career record lives by. The plain
 * numeric fields are taken off the wire the decoder just proved.
 */
export function decodeSavedGame(text: string): SaveDecodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return refused('NOT_JSON', `save is not JSON — ${String(error)}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return refused('NOT_A_SAVE', 'save is JSON but not an object');
  }
  const envelope = parsed as Partial<SavedGameV1> & { version?: unknown; format?: unknown };
  if (envelope.format !== SAVE_FORMAT) {
    return refused('NOT_A_SAVE', `format is ${JSON.stringify(envelope.format)}, not ${JSON.stringify(SAVE_FORMAT)}`);
  }
  if (typeof envelope.version !== 'number' || !Number.isSafeInteger(envelope.version)) {
    return refused('NOT_A_SAVE', `version is ${JSON.stringify(envelope.version)}, not a whole number`);
  }
  if (envelope.version > SAVE_VERSION) {
    return refused(
      'FUTURE_VERSION',
      `save is schema version ${envelope.version} and this build reads up to ${SAVE_VERSION} — refusing rather than guessing at a future shape`,
    );
  }
  if (envelope.version < 1) {
    // Nothing older than version 1 ever existed.
    return refused('UNKNOWN_VERSION', `save claims schema version ${envelope.version}, and no version below 1 ever existed`);
  }
  if (typeof envelope.savedAtIso !== 'string' || envelope.savedAtIso.length === 0) {
    return refused('NOT_A_SAVE', 'savedAtIso must be a non-empty string');
  }
  if (typeof envelope.wire !== 'object' || envelope.wire === null) {
    return refused('BAD_WIRE', 'the save carries no progression wire');
  }

  const received = receiveProgressionSnapshot(envelope.wire as ProgressionSnapshotWire);
  if (!received.ok) {
    return refused('BAD_WIRE', `${received.error.code}: ${received.error.message}`);
  }
  const facts = snapshotFacts(received.value);
  const wire = envelope.wire as ProgressionSnapshotWire;

  const fatigue = decodeFatigue(envelope.fatigue);
  if (!fatigue.ok) return refused('BAD_FATIGUE', fatigue.detail);

  let trainingProgressCredit = copyTrainingProgressCredit(EMPTY_TRAINING_PROGRESS_CREDIT);
  if (envelope.version >= SAVE_VERSION_TRAINING_PROGRESS) {
    const decodedCredit = decodeTrainingProgress(
      (envelope as { trainingProgressCredit?: unknown }).trainingProgressCredit,
    );
    if (!decodedCredit.ok) return refused('BAD_TRAINING_PROGRESS', decodedCredit.detail);
    trainingProgressCredit = decodedCredit.state;
  }

  const envelopeProfile = (envelope as { profile?: unknown }).profile;
  let profile: LifterProfile | null = null;
  if (envelope.version >= SAVE_VERSION_V2 && envelopeProfile !== undefined && envelopeProfile !== null) {
    const decodedProfile = decodeLifterProfile(envelopeProfile);
    // Corrupt identity fails closed as "needs completion". The progression
    // wire already proved; refusing the whole save would reset Total.
    profile = decodedProfile.ok ? decodedProfile.profile : null;
  }

  return {
    ok: true,
    savedAtIso: envelope.savedAtIso,
    profile,
    // SEALED LIKE EVERY OTHER §7.5 PRODUCER — this is a route into permanent
    // progression (the row a whole career resumes from), and the parsed wire's
    // arrays arrive from JSON.parse thawed, so the deep seal here is doing
    // real work on `meets` and `wallet` rather than re-freezing frozen things.
    record: sealServerValue({
      revision: wire.revision,
      totalKg: wire.totalKg,
      bestE1rmKg: wire.bestE1rmKg,
      streak: facts.streak,
      meets: wire.meets,
      wallet: wire.wallet,
      fatigue: fatigue.state,
      trainingProgressCredit,
      federation: facts.federation,
    }),
  };
}
