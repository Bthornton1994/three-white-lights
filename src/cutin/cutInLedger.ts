/**
 * cutInLedger.ts — WHERE ONE SITTING'S CUT-IN COUNT SURVIVES A REMOUNT.
 *
 * ===========================================================================
 * THIS MODULE IS DELIBERATELY NOT PURE, AND IT IS THE ONLY ONE HERE THAT ISN'T
 * ===========================================================================
 *
 * `cutInGate.ts` is pure: it holds nothing between calls, which is what lets a
 * server run the same code over the same inputs. The consequence it names in
 * its own §5 is that it cannot tell a second `openCutInSession` for one sitting
 * apart from the first. Somebody has to remember, and a pure module cannot.
 *
 * So this file holds process-lifetime state and says so at the top rather than
 * hiding a module-level `Map` under a helper. Zero React, zero I/O, no clock and
 * no dice — the state is a map from a caller's `sessionId` to the gate state
 * that belongs to it, and nothing else.
 *
 * ===========================================================================
 * WHY IT EXISTS: THE HOST'S REF IS NOT A SESSION
 * ===========================================================================
 *
 * GDD §12.3 makes "cut-ins firing more than once per session" a refusal
 * condition. Until this file, the count lived in a `useRef` inside
 * `CutInHost.tsx` — so the thing the cap was actually enforced against was the
 * HOST COMPONENT'S MOUNT LIFETIME, not the sitting. Those are different, and
 * the app un-mounts that component in ordinary play:
 *
 *   - `AppShell.tsx` chooses between `MeetScreen` and `SessionScreen` with a
 *     ternary. Leaving a meet and opening meet day again on the same day is a
 *     full un-mount and re-mount, and `cutInSessionId('meet', day)` is the same
 *     string on both sides of it.
 *   - `MeetScreen.tsx` early-returns `ResultCardScreen` ABOVE its `<CutInHost>`,
 *     and `SessionScreen.tsx` early-returns `AlreadyTrained` above its own.
 *     Either flip un-mounts the host and takes the count with it.
 *
 * None of those was a demonstrated double-fire on the day this was written. The
 * point is that nothing prevented one, and a refusal condition should not rest
 * on a reading of which ternaries currently happen to be safe.
 *
 * ===========================================================================
 * WHAT IT STILL DOES NOT SURVIVE, STATED PLAINLY
 * ===========================================================================
 *
 *   - A RELOAD, or a cold start. Module state goes with the process. The fix is
 *     a server-side counter and it belongs with the Edge Function (CLAUDE.md,
 *     GDD §9.2), exactly as `CutInHost.tsx` has said all along — this file
 *     narrows the hole from "any remount" to "a reload", it does not close it.
 *   - MORE THAN `REMEMBERED_SITTINGS` SITTINGS AGO. The map is bounded and
 *     evicts the oldest. Forgetting an old sitting cannot give a CURRENT one a
 *     second cut-in, which is the only thing the cap is about.
 *
 * A SECOND MEET ON ONE DAY SHARES THE FIRST'S SLOT, and that is the intended
 * reading rather than an accident: `cutInSessionId('meet', day)` is the same
 * string for both, and the gate's rule is about whatever the caller calls a
 * sitting. It is the conservative side of a §12.3 refusal condition. If Career
 * mode later puts two distinct meets on one day, the fix is for the id to name
 * the meet, not for this file to forget.
 */

import {
  dismissCutIn,
  openCutInSession,
  type CutInSessionState,
  type OpenCutInSession,
} from './cutInGate';
import { CUT_IN_TUNING } from './cutInTuning';

/**
 * ONE GATE SESSION PER `sessionId`, for the life of the process.
 *
 * A `Map` because it keeps insertion order, which is what makes the eviction
 * below "the oldest" rather than "an arbitrary one".
 */
const SITTINGS = new Map<string, CutInSessionState>();

function evictOldest(): void {
  while (SITTINGS.size > CUT_IN_TUNING.REMEMBERED_SITTINGS) {
    const oldest = SITTINGS.keys().next();
    if (oldest.done === true) return;
    SITTINGS.delete(oldest.value);
  }
}

/**
 * THE SITTING NAMED BY `sessionId`, RESUMED IF IT HAS ALREADY BEGUN.
 *
 * IDEMPOTENT, and that is the whole contract: calling this twice for one
 * sitting returns the state that has already spent its slot, so the second
 * caller gets a session with `firedCount` at 1 and the gate refuses it. Calling
 * it on every render — which `CutInHost.tsx`'s ref initialiser does, because a
 * `useRef` argument is evaluated every time — is free and changes nothing.
 *
 * `seed` is only consulted when the sitting is NEW. A resumed sitting keeps the
 * rates it rolled at the top, because §7.2's "ideally not every session" is a
 * decision made once per sitting; re-rolling on a remount would be the same
 * re-rolling-per-request bug one level up.
 */
export function resumeCutInSession(input: OpenCutInSession): CutInSessionState {
  const existing = SITTINGS.get(input.sessionId);
  if (existing !== undefined) return existing;
  const opened = openCutInSession(input);
  SITTINGS.set(input.sessionId, opened);
  evictOldest();
  return opened;
}

/**
 * WRITE A SITTING'S STATE BACK, so the next resume sees what it spent.
 *
 * Keyed on the state's own `sessionId` rather than on a separate argument — the
 * field the gate has always carried and, until this file, nothing ever read. A
 * caller cannot file one sitting's count under another sitting's name.
 *
 * WHAT IS REMEMBERED IS WHAT THE SITTING SPENT, NOT WHAT IS ON SCREEN. The
 * state is stored DISMISSED, so a resume never hands back a live cut-in. That
 * is §7.2's own framing — the thing being capped is the interruption, and a
 * host that went away took its overlay with it — and it keeps the two halves
 * from disagreeing: what is on screen is React state in `CutInHost`, and it
 * cannot outlive the component that renders it. `firedCount` is untouched, so
 * the slot stays spent.
 */
export function rememberCutInSession(state: CutInSessionState): void {
  SITTINGS.delete(state.sessionId);
  SITTINGS.set(state.sessionId, dismissCutIn(state));
  evictOldest();
}

/** Which sittings are remembered, oldest first. For tests and for debugging. */
export function rememberedSittingIds(): readonly string[] {
  return [...SITTINGS.keys()];
}

/**
 * FORGET EVERYTHING. FOR TESTS ONLY.
 *
 * Nothing in the app calls this and nothing should: a "start over" in the played
 * loop is a new day, which is a new `sessionId`, which is a new sitting without
 * anybody clearing anything. `cutInWiring.test.ts` fails if a component names
 * it, because a screen that could clear the ledger could clear the cap.
 */
export function forgetAllCutInSessions(): void {
  SITTINGS.clear();
}
