/**
 * cutInLedger.test.ts — that the cap survives a remount.
 *
 * WHY THIS FILE IS NOT A SOURCE SCAN. `cutInWiring.test.ts` exists because
 * `vitest.config.ts` is `environment: node` and a `.tsx` cannot be rendered
 * here, so the wiring is checked by reading text. The DURABILITY of the cap did
 * not have to be checked that way: the state is plain TypeScript, so the thing
 * a remount does — throw away the component and ask for the session again — is
 * two function calls, and this file makes them.
 *
 * The standard is `cutInGate.test.ts`'s: no expectation is derived from the
 * constant the code reads. The cap is spelled `1`.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  dismissCutIn,
  openCutInSession,
  requestCutIn,
  type CutInBeat,
  type CutInSessionState,
} from './cutInGate';
import {
  forgetAllCutInSessions,
  rememberCutInSession,
  rememberedSittingIds,
  resumeCutInSession,
} from './cutInLedger';
import { CUT_IN_TUNING } from './cutInTuning';

/** A meet that ended with a bomb-out. Rate 1 today, so it always qualifies. */
const BOMBED_OUT: CutInBeat = { kind: 'meet-over', bombedOut: true };
const NEW_E1RM: CutInBeat = { kind: 'record', record: 'e1rm', achieved: true };

const SEED_SEARCH_LIMIT = 5000;

/** A seed whose §7.2 roll allows every named moment, found by searching. */
function seedAllowing(sessionId: string, moments: readonly ('bomb-out' | 'personal-record')[]): number {
  for (let seed = 0; seed < SEED_SEARCH_LIMIT; seed += 1) {
    const state = openCutInSession({ sessionId, seed });
    if (moments.every((moment) => state.allowed[moment])) return seed;
  }
  throw new Error(`no seed under ${SEED_SEARCH_LIMIT} allows ${moments.join(', ')}`);
}

/**
 * WHAT `CutInHost` DOES, WITH THE COMPONENT TAKEN AWAY.
 *
 * Mount: resume the sitting. Offer: ask the gate and write the answer back.
 * Un-mount: drop everything the component was holding — which is exactly what
 * `AppShell`'s surface ternary does when a player leaves a meet.
 */
function mount(sessionId: string, seed: number): {
  offer: (beats: readonly CutInBeat[]) => boolean;
  state: () => CutInSessionState;
} {
  let session = resumeCutInSession({ sessionId, seed });
  return {
    offer: (beats) => {
      const decision = requestCutIn(session, beats);
      session = decision.state;
      rememberCutInSession(session);
      return decision.outcome.kind === 'fire';
    },
    state: () => session,
  };
}

beforeEach(() => {
  forgetAllCutInSessions();
});

describe('THE CAP IS PER SITTING, NOT PER MOUNT (GDD §7.2, §12.3)', () => {
  it('A REMOUNT INSIDE ONE SITTING DOES NOT HAND OUT A SECOND CUT-IN', () => {
    // The failure this file exists for. `AppShell.tsx` swaps `MeetScreen` and
    // `SessionScreen` with a ternary, so leaving a meet and opening one again
    // on the same day is a full un-mount and re-mount under the SAME
    // `cutInSessionId('meet', day)`. With the count in a `useRef` it came back
    // at zero and the sitting fired twice, which §12.3 refuses outright.
    const sessionId = 'meet-7';
    const seed = seedAllowing(sessionId, ['bomb-out']);

    const first = mount(sessionId, seed);
    expect(first.offer([BOMBED_OUT])).toBe(true);

    // ...the host goes away. Nothing is carried across but the id and the seed.
    const second = mount(sessionId, seed);
    expect(second.offer([BOMBED_OUT])).toBe(false);
    expect(second.state().firedCount).toBe(1);
  });

  it('AND NOT A THIRD, OR A TENTH', () => {
    const sessionId = 'meet-8';
    const seed = seedAllowing(sessionId, ['bomb-out', 'personal-record']);
    const REMOUNTS = 10;
    let fires = 0;
    for (let i = 0; i < REMOUNTS; i += 1) {
      const host = mount(sessionId, seed);
      if (host.offer([BOMBED_OUT])) fires += 1;
      if (host.offer([NEW_E1RM])) fires += 1;
    }
    // Spelled `1`, against GDD §7.2's sentence, not read off MAX_PER_SESSION.
    expect(fires).toBe(1);
  });

  it('a resumed sitting keeps the rates it rolled, rather than re-rolling', () => {
    // Otherwise a remount would be a fresh draw on "ideally not every session",
    // and a player who navigated back and forth would eventually shake a
    // permissive session out of it.
    const sessionId = 'training-3';
    const state = resumeCutInSession({ sessionId, seed: 1 });
    const again = resumeCutInSession({ sessionId, seed: 999 });
    expect(again.allowed).toEqual(state.allowed);
    expect(again).toBe(state);
  });

  it('A NEW SITTING GETS ITS OWN SLOT', () => {
    // The other bound. A ledger that never forgot anything and keyed on nothing
    // would pass every test above by refusing every cut-in for ever.
    const meet = 'meet-9';
    const meetSeed = seedAllowing(meet, ['bomb-out']);
    expect(mount(meet, meetSeed).offer([BOMBED_OUT])).toBe(true);

    const nextDay = 'meet-10';
    const nextSeed = seedAllowing(nextDay, ['bomb-out']);
    expect(mount(nextDay, nextSeed).offer([BOMBED_OUT])).toBe(true);
  });

  it('remembers what a sitting SPENT, not what is on screen', () => {
    // A cut-in that was up when the host went away does not come back: the
    // screen it was interrupting is gone. The slot stays spent either way.
    const sessionId = 'meet-11';
    const seed = seedAllowing(sessionId, ['bomb-out']);
    const host = mount(sessionId, seed);
    expect(host.offer([BOMBED_OUT])).toBe(true);
    expect(host.state().live).not.toBeNull();

    const resumed = resumeCutInSession({ sessionId, seed });
    expect(resumed.live).toBeNull();
    expect(resumed.firedCount).toBe(1);
  });

  it('files a sitting under its own name and not under a caller’s', () => {
    const state = openCutInSession({ sessionId: 'training-42', seed: 3 });
    rememberCutInSession(dismissCutIn(state));
    expect(rememberedSittingIds()).toEqual(['training-42']);
  });
});

describe('the ledger is bounded, and forgetting an old sitting is safe', () => {
  it('keeps the most recent sittings and drops the oldest', () => {
    const KEPT = CUT_IN_TUNING.REMEMBERED_SITTINGS;
    const OVERSHOOT = 3;
    for (let day = 0; day < KEPT + OVERSHOOT; day += 1) {
      resumeCutInSession({ sessionId: `training-${day}`, seed: day });
    }
    const remembered = rememberedSittingIds();
    expect(remembered.length).toBe(KEPT);
    // The oldest are gone and the newest are not.
    expect(remembered).not.toContain('training-0');
    expect(remembered).toContain(`training-${KEPT + OVERSHOOT - 1}`);
  });

  it('re-remembering a sitting keeps it warm', () => {
    // Otherwise a long sitting could be evicted by newer ones while it was
    // still on screen, which is the one eviction that WOULD hand out a second
    // cut-in.
    const KEPT = CUT_IN_TUNING.REMEMBERED_SITTINGS;
    const live = 'meet-live';
    const seed = seedAllowing(live, ['bomb-out']);
    const host = mount(live, seed);
    expect(host.offer([BOMBED_OUT])).toBe(true);

    for (let day = 0; day < KEPT - 1; day += 1) {
      resumeCutInSession({ sessionId: `training-${day}`, seed: day });
      rememberCutInSession(resumeCutInSession({ sessionId: live, seed }));
    }
    expect(rememberedSittingIds()).toContain(live);
    expect(mount(live, seed).offer([BOMBED_OUT])).toBe(false);
  });

  it('the bound is at least two, so a day’s training and meet cannot evict each other', () => {
    // Two sittings exist per day (`CUT_IN_SESSION_KINDS`). A bound of one would
    // make a player who trained and then competed lose the training day's count
    // the moment the meet opened — harmless today, because they are different
    // sittings with different slots, but it is the shape of thing that stops
    // being harmless quietly.
    expect(CUT_IN_TUNING.REMEMBERED_SITTINGS).toBeGreaterThanOrEqual(2);
  });
});
