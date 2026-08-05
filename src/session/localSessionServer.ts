/**
 * localSessionServer.ts — the stand-in for the `record-training-session` Edge
 * Function, as a `SessionServerPort`.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT IS
 * ---------------------------------------------------------------------------
 * The one impure thing in the session loop's data path: it holds the stored row
 * in a closure and answers on a timer. `sessionServer.ts` is the DECISION
 * PROCEDURE — pure, portable, no state — and this is the storage and the wire
 * around it. Porting to Supabase replaces this file and nothing else: the app
 * above it only ever sees a `ProgressionSnapshotWire` and a `SessionBrief`.
 *
 * ---------------------------------------------------------------------------
 * WHY IT HOLDS THE RECORD AND NOBODY ELSE DOES
 * ---------------------------------------------------------------------------
 * `useSession` used to hold the `ServerRecord` in a ref, next to the
 * `ProgressionCache`, and build the session out of whichever it reached for
 * first. It reached for the row. That is how the progression boundary ended up
 * with a sealed write half and a read half nobody called.
 *
 * `SessionServerPort` has no accessor for the row, so the app cannot reach for
 * it — not "must not". The row is in the closure below and there is no getter.
 *
 * ---------------------------------------------------------------------------
 * NOTHING IS PERSISTED
 * ---------------------------------------------------------------------------
 * The record dies with the tab, because persistence is the server's job and
 * inventing a client-side store now is exactly the code CLAUDE.md says would
 * have to be unwound. A reload starts a fresh lifter. Stated rather than hidden.
 */

import {
  briefFatigueFor,
  type SessionBrief,
  type SessionServerPort,
  type SessionServerResponse,
} from '../game/sessionClient';
import type { LiftKind } from '../game/meet';
import type { ProposalId, ProposalOfKind, ProgressionSnapshotWire } from '../game/progression';
import {
  applyTrainingSession,
  newServerRecord,
  snapshotWireFor,
  type ServerRecord,
} from '../game/sessionServer';
import { SESSION_BOUNDARY } from '../game/sessionTuning';

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

export interface LocalSessionServerOptions {
  /** The row to start from. Defaults to a lifter who has never trained. */
  readonly record?: ServerRecord;
  /** Round-trip stand-in. Defaults to `SESSION_BOUNDARY.LOCAL_SERVER_LATENCY_MS`. */
  readonly latencyMs?: number;
  readonly sleep?: Sleep;
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
export function localSessionServer(options: LocalSessionServerOptions = {}): SessionServerPort {
  let record: ServerRecord = options.record ?? newServerRecord(SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY);
  const latencyMs = options.latencyMs ?? SESSION_BOUNDARY.LOCAL_SERVER_LATENCY_MS;
  const sleep = options.sleep ?? realSleep;

  return {
    openingSnapshot(): ProgressionSnapshotWire {
      return snapshotWireFor(record, null);
    },

    /**
     * The feel inputs for one session, and nothing else (GDD §3.4, §12.3).
     *
     * `briefFatigueFor` is the single named narrowing: what crosses is the days
     * that can still affect `day`, not the lifter's training history. Every
     * progression number `todayForLifter` also computes is deliberately absent —
     * those come back through `progression.ts`'s read accessors.
     */
    sessionBrief(day: number, _lift: LiftKind): SessionBrief {
      return { fatigue: briefFatigueFor(record.fatigue, day) };
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
      return { kind: 'snapshot', wire: applied.value.wire };
    },
  };
}
