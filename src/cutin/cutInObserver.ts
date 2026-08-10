/**
 * cutInObserver.ts — WHAT THE GATE WAS ASKED FOR, AND WHAT IT ANSWERED.
 *
 * ===========================================================================
 * WHY THIS EXISTS: "REFUSED" AND "NOBODY ASKED" LOOK IDENTICAL FROM OUTSIDE
 * ===========================================================================
 * GDD §12.3 refuses "cut-ins firing more than once per session", and the
 * artifact that EXECUTES that refusal is `tools/verify-cutin-cap.mjs`: it plays
 * three legs of one meet-day sitting and counts the overlays that reach the
 * screen.
 *
 * COUNTING OVERLAYS CANNOT TELL THE TWO INTERESTING BUILDS APART.
 *
 *   - A build whose GATE REFUSES the second and third qualifying beats shows
 *     one overlay.
 *   - A build where `BombOutView` stopped offering its beat at all — the
 *     `useOfferCutIn` line deleted, or `bombedOut` arriving `false` — ALSO
 *     shows one overlay, because legs 2 and 3 only ever have to reach the
 *     bomb-out SCREEN for every other line in that tool to stay green.
 *
 * The tool's own guard says so in place: "this sees the screen, not the offer".
 * The committed record shows leg 1 firing, which is precisely the day on which
 * the two-sided `fired === THE_CAP` pin does not rescue it. A gate that happens
 * to fire once because no caller asked twice has not met the bar, and until
 * this module the artifact could not tell the difference.
 *
 * So the gate says out loud what it was asked and what it answered, and the
 * instrument READS THE REFUSAL instead of inferring it from pixels.
 *
 * ===========================================================================
 * THIS MODULE IS DELIBERATELY NOT PURE, AND IT IS THE SECOND ONE HERE THAT ISN'T
 * ===========================================================================
 * `cutInLedger.ts` holds process-lifetime state and says so at the top rather
 * than hiding a module-level `Map` under a helper. This file is the same shape
 * and the same disclosure: a bounded module-level array, zero React, zero I/O,
 * no clock and no dice.
 *
 * IT DECIDES NOTHING. `observeCutInDecision` returns `void`, takes the decision
 * the gate has ALREADY made, and re-derives none of it — no `momentsFor` call,
 * no second qualification pass. An oracle that recomputed the verdict could
 * disagree with the gate; this one can only quote it. What it costs is that it
 * cannot catch a gate that is wrong in the same way twice, and that is what
 * `cutInGate.test.ts` is for.
 *
 * ===========================================================================
 * WHAT IT PUBLISHES, AND WHY A GLOBAL
 * ===========================================================================
 * `requestCutIn` runs inside the app's bundle. A Playwright driver cannot reach
 * a module-level array, so the log is published on `globalThis` under
 * `CUT_IN_OBSERVER_GLOBAL` as a FUNCTION returning a copy. Three properties,
 * all of them checked in `cutInObserver.test.ts`:
 *
 *   - it is a READ. Nothing exported here changes a gate decision, and the
 *     published value is a getter rather than the array itself, so a page
 *     script cannot append a refusal that never happened.
 *   - the copy is shallow-fresh: mutating the returned array does not reach
 *     the log.
 *   - it is inert where there is no global scope to publish onto.
 *
 * `forgetCutInObservations` is FOR TESTS ONLY and `cutInWiring.test.ts` bans a
 * screen from naming it, exactly as it bans `forgetAllCutInSessions` — a screen
 * that could erase the record could erase the evidence that it was refused.
 *
 * ===========================================================================
 * WHAT IT DOES NOT COVER, STATED RATHER THAN IMPLIED
 * ===========================================================================
 *   - IT SEES `CutInHost.offer` AND NOTHING ELSE. A caller that reached
 *     `requestCutIn` directly would be invisible here. That route is closed by
 *     `cutInWiring.test.ts`'s symbol scan, not by this file.
 *   - IT IS BOUNDED at `CUT_IN_TUNING.OBSERVED_DECISIONS` and drops the OLDEST
 *     first. A run long enough to overflow loses its opening offers, so a
 *     reader that needs "the first grant" must check `dropped` is 0 rather than
 *     assume it.
 *   - IT DOES NOT SURVIVE A RELOAD, for the same reason `cutInLedger.ts` does
 *     not: module state goes with the process.
 */

import type {
  CutInBeat,
  CutInDecision,
  CutInMoment,
  CutInRefusal,
  CutInSessionState,
} from './cutInGate';
import { CUT_IN_TUNING } from './cutInTuning';

/**
 * The name the published getter takes on `globalThis`.
 *
 * DECLARED TO THE COMPILER RATHER THAN CAST PAST IT, and that is not tidiness:
 * `progression.test.ts` sweeps every non-test file the project compiles for
 * reflective assembly — `as unknown as`, `Object.assign`, `structuredClone` —
 * because that is how a forged `ServerRecord` got into the cache with `tsc`
 * clean and 2437 tests green. A diagnostic channel is not worth an exemption
 * row in that table. The index below is the constant itself, so renaming it
 * without renaming the declaration is a type error rather than a channel the
 * instrument can no longer find.
 */
export const CUT_IN_OBSERVER_GLOBAL = '__cutInGateLog';

declare global {
  // eslint-disable-next-line no-var
  var __cutInGateLog: (() => CutInObservationLog) | undefined;
}

/**
 * ONE TRIP THROUGH THE GATE, QUOTED.
 *
 * Every field is copied off the decision or off the state either side of it.
 * Nothing here is derived a second time — see the header.
 */
export interface CutInGateObservation {
  /** Monotonic across the process, so a reader can drain "everything new". */
  readonly seq: number;
  readonly sessionId: string;
  /** What the screen reported, by kind. The beat payloads are not recorded. */
  readonly beatKinds: readonly CutInBeat['kind'][];
  readonly outcome: CutInDecision['outcome']['kind'];
  /**
   * On a fire, the moment that took the slot. On a refusal, the highest-priority
   * moment that QUALIFIED — `null` when nothing did.
   */
  readonly moment: CutInMoment | null;
  /** `null` on a fire. Which of §7.2's three rules said no. */
  readonly refusal: CutInRefusal | null;
  readonly firedCountBefore: number;
  readonly firedCountAfter: number;
}

/** The log itself. Bounded; see the header. */
const OBSERVED: CutInGateObservation[] = [];
let nextSeq = 0;
let droppedCount = 0;

/**
 * WHAT THE READER GETS: a copy, plus how many entries fell off the front.
 *
 * `dropped` is here rather than left implicit because a bounded buffer that
 * silently loses its oldest entries is the "empty domain" shape — a reader
 * asserting "the first grant was on leg 1" against a log whose first grant has
 * been evicted is asserting nothing.
 */
export interface CutInObservationLog {
  readonly observations: readonly CutInGateObservation[];
  readonly dropped: number;
}

/** Everything the gate has been asked so far, oldest first. */
export function cutInGateObservations(): CutInObservationLog {
  return { observations: [...OBSERVED], dropped: droppedCount };
}

/**
 * RECORD ONE DECISION. Called by `CutInHost` on every offer, fire or refusal.
 *
 * `before` is the session state the gate was handed; `decision.state` is what it
 * handed back. On a refusal the two are the same object, which is what makes
 * `firedCountBefore === firedCountAfter` the signature of a refusal in the log.
 */
export function observeCutInDecision(
  before: CutInSessionState,
  beats: readonly CutInBeat[],
  decision: CutInDecision,
): void {
  const outcome = decision.outcome;
  OBSERVED.push(
    Object.freeze({
      seq: nextSeq,
      sessionId: before.sessionId,
      beatKinds: Object.freeze(beats.map((beat) => beat.kind)),
      outcome: outcome.kind,
      moment: outcome.kind === 'fire' ? outcome.live.moment : outcome.moment,
      refusal: outcome.kind === 'fire' ? null : outcome.reason,
      firedCountBefore: before.firedCount,
      firedCountAfter: decision.state.firedCount,
    }),
  );
  nextSeq += 1;
  while (OBSERVED.length > CUT_IN_TUNING.OBSERVED_DECISIONS) {
    OBSERVED.shift();
    droppedCount += 1;
  }
  publishCutInObservations();
}

/**
 * FORGET EVERYTHING. FOR TESTS ONLY.
 *
 * `cutInWiring.test.ts` fails if a screen names this, for the reason
 * `forgetAllCutInSessions` is banned there: a screen that could erase the record
 * could erase the evidence that it was refused.
 */
export function forgetCutInObservations(): void {
  OBSERVED.length = 0;
  nextSeq = 0;
  droppedCount = 0;
}

/**
 * Put the getter on `globalThis`, once. Idempotent, and it publishes a FUNCTION
 * rather than the array — see the header for the three properties that buys.
 */
function publishCutInObservations(): void {
  if (globalThis[CUT_IN_OBSERVER_GLOBAL] !== undefined) return;
  globalThis[CUT_IN_OBSERVER_GLOBAL] = (): CutInObservationLog => cutInGateObservations();
}

/**
 * PUBLISHED AT IMPORT, NOT AT THE FIRST OFFER, AND THAT IS THE POINT.
 *
 * An instrument has to be able to tell "the channel is there and nobody asked
 * the gate anything" apart from "the channel is not there" — the first is a
 * build where a screen stopped offering, which is the defect this module was
 * added for, and the second is a build where this module never loaded. If the
 * getter only appeared on the first offer, those two would be the same
 * observation and the fix would have reintroduced its own bug one level out.
 *
 * The cost is a module-level side effect on import, disclosed here rather than
 * hidden: it writes one function onto `globalThis` and nothing else.
 */
publishCutInObservations();
