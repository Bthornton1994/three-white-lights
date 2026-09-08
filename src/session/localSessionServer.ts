/**
 * localSessionServer.ts — the stand-in for the `record-training-session` AND
 * `record-meet-result` Edge Functions, as one `SessionServerPort &
 * MeetServerPort`.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT IS
 * ---------------------------------------------------------------------------
 * The one impure thing in the app's data path: it holds the stored row in a
 * closure and answers on a timer. `sessionServer.ts` and `meetServer.ts` are the
 * DECISION PROCEDURES — pure, portable, no state — and this is the storage and
 * the wire around them. Porting to Supabase replaces this file and nothing else:
 * the app above it only ever sees a `ProgressionSnapshotWire`, a `SessionBrief`,
 * a `MeetBrief` and a `RecordedMeet`.
 *
 * ---------------------------------------------------------------------------
 * ONE ROW, BOTH MODES, AND THE NAME IS NOW HISTORICAL
 * ---------------------------------------------------------------------------
 * It answers meet day as well as the daily session, and it does so out of THE
 * SAME `record` variable, because a lifter who trains and a lifter who competes
 * have to be one lifter. That is not a convenience: `useMeetDay` used to build a
 * `ServerRecord` of its own on mount, so meet day read a lifter who had never
 * trained a day — same seed e1RM on day 1 and day 400, FIRST TOTAL after every
 * meet, and no PR attempt ever. `meetClient.ts`'s header has the full account.
 *
 * The file is still called `localSessionServer` because renaming it would churn
 * four call sites and two source scans for no behaviour; what it IS is the app's
 * one local server. `appServer.ts` is the module that says so.
 *
 * ---------------------------------------------------------------------------
 * WHY IT HOLDS THE RECORD AND NOBODY ELSE DOES
 * ---------------------------------------------------------------------------
 * `useSession` used to hold the `ServerRecord` in a ref, next to the
 * `ProgressionCache`, and build the session out of whichever it reached for
 * first. It reached for the row. That is how the progression boundary ended up
 * with a sealed write half and a read half nobody called.
 *
 * Neither port has an accessor for the row, so the app cannot reach for it — not
 * "must not". The row is in the closure below and there is no getter.
 *
 * ---------------------------------------------------------------------------
 * PERSISTENCE IS THIS SERVER'S JOB, AND NOW IT DOES IT (Sprint 2)
 * ---------------------------------------------------------------------------
 * This header said "nothing is persisted" for as long as persistence would
 * have been client-side code CLAUDE.md says must be unwound. It is server-side
 * now: the row is written through `saveGame.ts`'s schema after every accepted
 * mutation, into a `SaveStore` the CALLER injects — `appServer.ts` hands in
 * the web store, tests hand in a fake or nothing — so this file still holds
 * the only reference to the row and the app above the port never sees a save.
 *
 * LOADING RE-PROVES EVERYTHING. A stored save is untrusted input whatever
 * wrote it; `decodeSavedGame` re-validates it through the same decoder that
 * guards the client boundary, and a refused save QUARANTINES rather than
 * deletes — the store keeps the refused bytes under a separate key before the
 * fresh lifter's first accepted mutation can overwrite them, because "Nothing
 * Is Lost" applies hardest to the save this build cannot read (a player's
 * future version, most of all).
 *
 * A SAVE FAILURE NEVER TAKES A MUTATION DOWN. The row moved; the answer the
 * client gets is about the row, and a full disk or a private-mode storage
 * refusal is reported to the console rather than converted into a refused
 * session. The next accepted mutation tries again.
 */

import {
  briefFatigueFor,
  type SessionBrief,
  type SessionServerPort,
  type SessionServerResponse,
} from '../game/sessionClient';
import type { CareerServerPort, CareerServerResponse } from '../game/careerClient';
import { applyFederationChoice, careerLifterFor } from '../game/careerServer';
import { applyEnterMeet, authorizeCareerMeetRecord, isCareerMeetId } from '../game/careerLoop';
import type { MeetBrief, MeetServerPort, MeetServerResponse } from '../game/meetClient';
import { applyMeetResult } from '../game/meetServer';
import type { MeetDefinition } from '../game/meetTuning';
import type { LiftKind } from '../game/meet';
import type { ProposalId, ProposalOfKind, ProgressionSnapshotWire } from '../game/progression';
import { decodeSavedGame, encodeSavedGame, type SaveRefusalCode } from '../game/saveGame';
import {
  applyTrainingSession,
  newServerRecord,
  snapshotWireFor,
  type ServerRecord,
} from '../game/sessionServer';
import { SESSION_BOUNDARY } from '../game/sessionTuning';
import type { CareerFederationId } from '../career/careerTuning';
import { CAREER_FEDERATION_IDS } from '../career/federation';
import type { LifterServerPort, LifterServerResponse } from '../game/lifterClient';
import {
  createLifterProfile,
  editLifterBodyweight,
  editLifterName,
  type LifterProfile,
} from '../game/lifterProfile';

/**
 * The app's one connection, as a type.
 *
 * An INTERSECTION rather than a fourth interface, so no mode's port can grow
 * a method the others' implementation does not have to provide. `appServer.ts`
 * hands the same object out under all three halves.
 */
export type LocalAppServerPort = SessionServerPort & MeetServerPort & CareerServerPort & LifterServerPort;

/**
 * How the stand-in waits.
 *
 * Injected so a test can answer immediately or on demand rather than sleeping,
 * and so the whole file has exactly one reference to a timer.
 */
export type Sleep = (ms: number) => Promise<void>;

const realSleep: Sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Where a save string lives. Injected, so this file stays free of platform
 * APIs and a test's store is an object it can read back out of; `appServer.ts`
 * owns the web implementation. `quarantine` is optional because only stores
 * with somewhere to put refused bytes can offer it — a store without one still
 * gets the refusal logged.
 */
export interface SaveStore {
  /** The stored save, or null when there has never been one. */
  load(): string | null;
  save(text: string): void;
  /** Keep refused bytes somewhere the next `save` cannot overwrite. */
  quarantine?(text: string, code: SaveRefusalCode): void;
}

export interface LocalSessionServerOptions {
  /** The row to start from. Wins over the store's save — a test that hands a
   *  record in means THAT record. Defaults to the store's save, then fresh. */
  readonly record?: ServerRecord;
  /** Round-trip stand-in. Defaults to `SESSION_BOUNDARY.LOCAL_SERVER_LATENCY_MS`. */
  readonly latencyMs?: number;
  readonly sleep?: Sleep;
  /** The save's home. Omitted (every existing test), nothing persists. */
  readonly store?: SaveStore;
  /** Signup day for a FRESH lifter — one the store had no readable save for.
   *  `appServer.ts` passes the real wall-clock day, so a new install's
   *  absences are charged from the day the account actually began (GDD §4.2);
   *  the default keeps every fixture on the stable test constant. */
  readonly freshSignupDay?: number;
  /** The save's clock, for `savedAtIso`. The server owns the clock the way it
   *  owns the row; injected so tests are deterministic. */
  readonly nowIso?: () => string;
  /**
   * Persistent identity beside the row. An explicit record wins the row;
   * this wins the profile when a test hands one in. Omitted, the store's
   * save is the source, then null.
   */
  readonly profile?: LifterProfile | null;
  /** In-progress Career booking. An explicit record's tests start at null unless set. */
  readonly enteredMeetId?: string | null;
  /** Entropy for minting a lifter id. Injected so tests are deterministic. */
  readonly entropy?: () => string;
}

/**
 * A port backed by `sessionServer.ts` and a row in memory.
 *
 * THE LATENCY IS NOT A DELAY IMPOSED ON THE PLAYER, and it is not there for
 * realism's sake either. `sessionServer.ts` runs in this process and answers in
 * microseconds; applied synchronously, `ProgressionCache`'s `pending` state — and
 * every `'projected'` reading built on it — would exist for zero frames and no
 * screen could ever render one. The close-out's whole reason for distinguishing
 * a settled number from a provisional one would be untestable decoration. See
 * `SESSION_BOUNDARY.LOCAL_SERVER_LATENCY_MS`.
 */
export function localSessionServer(options: LocalSessionServerOptions = {}): LocalAppServerPort {
  const store = options.store ?? null;
  const nowIso = options.nowIso ?? (() => new Date().toISOString());

  /**
   * The row this server opens on: an explicit record wins, then the store's
   * save (re-proved through the one decoder), then a fresh lifter. A refused
   * save is QUARANTINED FIRST — before any mutation can `save()` over it —
   * and the refusal is loud, because a silently discarded save is the exact
   * loss this sprint is named against.
   *
   * Profile is a sibling of the row. A v1 save, or a v2 save whose identity
   * payload was corrupt, opens with `profile: null` and keeps the progression
   * wire. That is "needs identity completion", not a reset.
   */
  const fresh = () => newServerRecord(options.freshSignupDay ?? SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY);
  let record: ServerRecord;
  let profile: LifterProfile | null;
  let enteredMeetId: string | null = options.enteredMeetId ?? null;
  if (options.record !== undefined) {
    record = options.record;
    profile = options.profile === undefined ? null : options.profile;
  } else if (store === null) {
    record = fresh();
    profile = null;
  } else {
    const text = store.load();
    if (text === null) {
      record = fresh();
      profile = null;
    } else {
      const decoded = decodeSavedGame(text);
      if (!decoded.ok) {
        store.quarantine?.(text, decoded.code);
        console.warn(
          `localSessionServer: the stored save was refused (${decoded.code}: ${decoded.detail}); ` +
            `starting a fresh lifter — the refused bytes are ${store.quarantine ? 'quarantined' : 'NOT preserved (this store cannot quarantine)'}`,
        );
        record = fresh();
        profile = null;
      } else {
        record = decoded.record;
        profile = decoded.profile;
        enteredMeetId = decoded.enteredMeetId;
      }
    }
  }

  const latencyMs = options.latencyMs ?? SESSION_BOUNDARY.LOCAL_SERVER_LATENCY_MS;
  const sleep = options.sleep ?? realSleep;
  const entropy = options.entropy ?? (() => `${nowIso()}`);

  /**
   * ONE persist, called after every site that reassigns `record` — three
   * today, and a fourth mutation gets this line with its reassignment or the
   * sibling rule has failed again. Never throws into the mutation's answer:
   * the row moved, the response describes the row, and a storage refusal is a
   * console fact until the port grows an error channel worth designing.
   */
  const persist = (): void => {
    if (store === null) return;
    try {
      store.save(encodeSavedGame(record, nowIso(), profile, enteredMeetId));
    } catch (error) {
      console.warn(`localSessionServer: persisting the row failed — ${String(error)}`);
    }
  };

  return {
    openingSnapshot(): ProgressionSnapshotWire {
      return snapshotWireFor(record, null);
    },

    /**
     * The feel inputs for one session, and nothing else (GDD §3.4, §12.3).
     *
     * `briefFatigueFor` is the single named narrowing: what crosses is the days
     * that can still affect `day`, not the lifter's training history. This
     * lift's prior training-progress credit crosses by the same door — hidden
     * prescription state, not a ConfirmedFact. Every progression number
     * `todayForLifter` also computes is deliberately absent — those come back
     * through `progression.ts`'s read accessors.
     */
    sessionBrief(day: number, lift: LiftKind): SessionBrief {
      return {
        fatigue: briefFatigueFor(record.fatigue, day),
        trainingProgressCredit: record.trainingProgressCredit?.[lift] ?? 0,
      };
    },

    async recordTrainingSession(
      day: number,
      proposal: ProposalOfKind<'record-training-session'>,
      proposalId: ProposalId,
    ): Promise<SessionServerResponse> {
      await sleep(latencyMs);
      const applied = applyTrainingSession(record, day, proposal, proposalId);
      if (!applied.ok) {
        return { kind: 'refused', message: applied.error.message };
      }
      record = applied.value.record;
      persist();
      return { kind: 'snapshot', wire: applied.value.wire };
    },

    /**
     * The feel inputs for a meet (GDD §3.4, §12.3).
     *
     * The same `briefFatigueFor` narrowing as `sessionBrief`, deliberately: a
     * meet reads the hidden ledger for exactly the reason a session does — GDD
     * §6.2's attempts run on the same mechanic — and there is no argument for
     * meet day being allowed a wider view of it than a Tuesday.
     *
     * NO LIFT PARAMETER, and that is not an oversight: a meet is all three, and
     * `pruneFatigueState` narrows by DAY rather than by lift.
     */
    meetBrief(day: number): MeetBrief {
      return { fatigue: briefFatigueFor(record.fatigue, day) };
    },

    /**
     * `record-meet-result`. THE ONLY WAY A TOTAL MOVES, and it moves the same
     * row `recordTrainingSession` above writes.
     *
     * That sentence is the whole point of this file after this change. It used
     * to be true of `meetServer.ts` in the abstract and false of the app: meet
     * day held a `ServerRecord` of its own, so the total it banked went into an
     * object that was garbage-collected when the screen unmounted, and the
     * e1RM it read had never heard of a training session.
     *
     * `MEET_ALREADY_RECORDED` IS NOW REACHABLE, for the first time. It fires
     * when this row already carries a result for the meet being reported, which
     * with one ungated local meet means the SECOND meet of an app run. See the
     * note in `useMeetDay.ts` for what the player sees and why that is the
     * Career-calendar piece's problem rather than something to paper over here.
     */
    async recordMeetResult(
      day: number,
      meet: MeetDefinition,
      proposal: ProposalOfKind<'record-meet-result'>,
      proposalId: ProposalId,
    ): Promise<MeetServerResponse> {
      await sleep(latencyMs);
      let definition = meet;
      if (enteredMeetId !== null) {
        const authorized = authorizeCareerMeetRecord(enteredMeetId, proposal.report.meetId);
        if (!authorized.ok) return { kind: 'refused', error: authorized.error };
        definition = authorized.value.definition;
      } else if (
        isCareerMeetId(proposal.report.meetId) &&
        !record.meets.some((stored) => stored.meetId === proposal.report.meetId)
      ) {
        return {
          kind: 'refused',
          error: {
            code: 'NOT_ENTERED',
            message: 'Enter this meet from the Career calendar before recording a result.',
          },
        };
      }
      const applied = applyMeetResult(record, day, definition, proposal, proposalId);
      if (!applied.ok) return { kind: 'refused', error: applied.error };
      record = applied.value.record;
      enteredMeetId = null;
      persist();
      return {
        kind: 'recorded',
        wire: applied.value.wire,
        // FIELD BY FIELD, NOT A SPREAD. `AppliedMeetResult` carries the stored
        // row and the wire; spreading it here would hand the client a
        // `ServerRecord` under a name nobody was looking at, which is the exact
        // shape of the defect this change removes.
        result: {
          totalKg: applied.value.totalKg,
          previousBestTotalKg: applied.value.previousBestTotalKg,
          isTotalPr: applied.value.isTotalPr,
          liftPrs: applied.value.liftPrs,
          placing: applied.value.placing,
          bestByLiftKg: applied.value.bestByLiftKg,
          // WITHOUT THIS THE RECAP CANNOT TELL A BEATEN RECORD FROM A FIRST ONE
          // and prints "PR" for both, which is GDD §6.5's defect. Three numbers
          // about the lifter's own past meets, not a stored row.
          // `@guarantee the-pr-word-needs-a-record-to-beat`
          previousBestByLiftKg: applied.value.previousBestByLiftKg,
          bombedLift: applied.value.bombedLift,
          // WHAT THE RESULT DID TO THE CAREER — computed by `careerServer.ts`
          // inside `applyMeetResult`, against the same row, so the recap's
          // career line and the calendar's eligibility read one fold.
          career: applied.value.career,
        },
      };
    },

    /**
     * `choose-federation`. THE ONLY WAY THE FEDERATION MOVES after signup, and
     * it moves the same row everything above reads — a lifter who chooses,
     * trains and competes is one lifter.
     */
    async chooseFederation(
      proposal: ProposalOfKind<'choose-federation'>,
      proposalId: ProposalId,
    ): Promise<CareerServerResponse> {
      await sleep(latencyMs);
      const applied = applyFederationChoice(record, proposal, proposalId);
      if (!applied.ok) return { kind: 'refused', error: applied.error };
      record = applied.value.record;
      persist();
      return { kind: 'chosen', wire: applied.value.wire };
    },

    openingEnteredMeetId(): string | null {
      return enteredMeetId;
    },

    /**
     * Book a Career meet. Sets the in-progress Career booking.
     * Reconstructs the runnable definition from the calendar; the client
     * cannot supply a forged `MeetDefinition`.
     */
    async enterMeet(meetId: string, day: number) {
      await sleep(latencyMs);
      const applied = applyEnterMeet(careerLifterFor(record), enteredMeetId, meetId, day);
      if (!applied.ok) return { kind: 'refused' as const, error: applied.error };
      enteredMeetId = applied.value.enteredMeetId;
      persist();
      return {
        kind: 'entered' as const,
        meetId: applied.value.enteredMeetId,
        definition: applied.value.definition,
      };
    },

    openingProfile(): LifterProfile | null {
      return profile;
    },

    async createProfile(draft, federationId: CareerFederationId): Promise<LifterServerResponse> {
      await sleep(latencyMs);
      if (!(CAREER_FEDERATION_IDS as readonly string[]).includes(federationId)) {
        return {
          kind: 'refused',
          code: 'FEDERATION_UNKNOWN',
          detail: `no federation has the id ${JSON.stringify(federationId)}`,
        };
      }
      if (profile !== null) {
        return { kind: 'saved', profile };
      }
      const created = createLifterProfile(draft, entropy());
      if (!created.ok) {
        return { kind: 'refused', code: created.code, detail: created.detail };
      }
      if (!record.federation.chosen) {
        const applied = applyFederationChoice(
          record,
          { kind: 'choose-federation', report: { federationId } },
          `lifter-create-${created.profile.id}`,
        );
        if (applied.ok) {
          record = applied.value.record;
        } else if (applied.error.code === 'UNKNOWN_FEDERATION') {
          return { kind: 'refused', code: 'FEDERATION_UNKNOWN', detail: applied.error.message };
        }
      }
      // A1 `choose-federation` / v1 save already has chosen: true. Skip
      // apply, attach identity, keep the confirmed federation. Create shows
      // that as read-only — a chooser here was a silent no-op.
      profile = created.profile;
      persist();
      return { kind: 'saved', profile };
    },

    async editProfileName(name: string): Promise<LifterServerResponse> {
      await sleep(latencyMs);
      if (profile === null) {
        return { kind: 'refused', code: 'PROFILE_CORRUPT', detail: 'no profile to edit' };
      }
      const edited = editLifterName(profile, { name });
      if (!edited.ok) {
        return { kind: 'refused', code: edited.code, detail: edited.detail };
      }
      profile = edited.profile;
      persist();
      return { kind: 'saved', profile };
    },

    async editProfileBodyweight(bodyweightKgText: string): Promise<LifterServerResponse> {
      await sleep(latencyMs);
      if (profile === null) {
        return { kind: 'refused', code: 'PROFILE_CORRUPT', detail: 'no profile to edit' };
      }
      const edited = editLifterBodyweight(profile, { bodyweightKgText });
      if (!edited.ok) {
        return { kind: 'refused', code: edited.code, detail: edited.detail };
      }
      profile = edited.profile;
      persist();
      return { kind: 'saved', profile };
    },
  };
}
