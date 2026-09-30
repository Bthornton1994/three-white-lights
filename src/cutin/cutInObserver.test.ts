/**
 * cutInObserver.test.ts — the log quotes the gate, and cannot be written to.
 *
 * WHAT EACH CHECK BELOW WOULD GO RED FOR is stated on it, because the module is
 * an instrument and an instrument that cannot fail is worse than none — the
 * whole reason it exists is that `tools/verify-cutin-cap.mjs` was counting
 * pixels and calling that a refusal.
 */

import { describe, expect, it, beforeEach } from 'vitest';

import {
  CUT_IN_OBSERVER_GLOBAL,
  cutInGateObservations,
  forgetCutInObservations,
  observeCutInDecision,
} from './cutInObserver';
import { CUT_IN_TUNING } from './cutInTuning';
import {
  cutInSessionId,
  cutInSessionSeed,
  openCutInSession,
  requestCutIn,
  type CutInBeat,
} from './cutInGate';

/** GDD §6.3's bomb-out, which `SESSION_ALLOWANCE` allows in every sitting. */
const BOMB_OUT: readonly CutInBeat[] = [{ kind: 'meet-over', bombedOut: true }];
/** A meet that finished cleanly. Qualifies as nothing at all. */
const CLEAN_FINISH: readonly CutInBeat[] = [{ kind: 'meet-over', bombedOut: false }];

const A_MEET_DAY = 12;

function aSitting() {
  return openCutInSession({
    sessionId: cutInSessionId('meet', A_MEET_DAY),
    seed: cutInSessionSeed('meet', A_MEET_DAY),
  });
}

/** Offer `beats` to a real gate and record the real decision, as the host does. */
function offer(state: ReturnType<typeof aSitting>, beats: readonly CutInBeat[]) {
  const decision = requestCutIn(state, beats);
  observeCutInDecision(state, beats, decision);
  return decision.state;
}

beforeEach(() => {
  forgetCutInObservations();
});

describe('the log records what the gate answered', () => {
  it('a FIRE and the REFUSAL that follows it are both recorded, and they differ', () => {
    // THE WHOLE POINT, IN ONE TEST. Two offers of the same qualifying beat into
    // one sitting: the first takes the slot, the second meets §7.2's hard gate.
    // Delete the second `observeCutInDecision` call — i.e. observe only fires —
    // and the log has one entry instead of two.
    let state = aSitting();
    state = offer(state, BOMB_OUT);
    offer(state, BOMB_OUT);

    const { observations, dropped } = cutInGateObservations();
    expect(dropped, 'the buffer overflowed and the first entry is gone').toBe(0);
    expect(observations).toHaveLength(2);

    expect(observations[0]?.outcome).toBe('fire');
    expect(observations[0]?.moment).toBe('bomb-out');
    expect(observations[0]?.refusal).toBeNull();
    expect(observations[0]?.firedCountBefore).toBe(0);
    expect(observations[0]?.firedCountAfter).toBe(1);

    expect(observations[1]?.outcome).toBe('refused');
    // §12.3's refusal condition, named. Not 'held-back-for-scarcity', which is
    // the soft rule, and not 'no-qualifying-moment', which would mean the beat
    // never qualified in the first place.
    expect(observations[1]?.refusal).toBe('session-cap-reached');
    expect(observations[1]?.moment).toBe('bomb-out');
    expect(observations[1]?.firedCountBefore).toBe(1);
    expect(observations[1]?.firedCountAfter).toBe(1);
  });

  it('A BEAT THAT QUALIFIES AS NOTHING IS DISTINGUISHABLE FROM ONE THE CAP REFUSED', () => {
    // The distinction the browser tool needs: "the gate said no because the slot
    // was gone" versus "the gate said no because this was not a §7.2 moment".
    // Collapsing `CUT_IN_REFUSALS` to one reason reddens this.
    const state = aSitting();
    offer(state, CLEAN_FINISH);

    const only = cutInGateObservations().observations[0];
    expect(only?.outcome).toBe('refused');
    expect(only?.refusal).toBe('no-qualifying-moment');
    expect(only?.moment).toBeNull();
    expect(only?.firedCountBefore).toBe(only?.firedCountAfter);
  });

  it('the beat KINDS are recorded, so "nobody asked" is visible as an absence', () => {
    // A build where `BombOutView` stopped calling `useOfferCutIn` produces a log
    // with no `meet-over` entry in it at all. Dropping `beatKinds` from the
    // observation makes that build indistinguishable from one that was refused.
    const state = aSitting();
    offer(state, BOMB_OUT);
    expect(cutInGateObservations().observations[0]?.beatKinds).toEqual(['meet-over']);
    expect(
      cutInGateObservations().observations.filter((o) => o.beatKinds.includes('meet-over')),
    ).toHaveLength(1);
  });

  it('seq is monotonic and the sitting is named on every entry', () => {
    let state = aSitting();
    for (let i = 0; i < 3; i += 1) state = offer(state, BOMB_OUT);
    const { observations } = cutInGateObservations();
    expect(observations.map((o) => o.seq)).toEqual([0, 1, 2]);
    expect(new Set(observations.map((o) => o.sessionId))).toEqual(
      new Set([cutInSessionId('meet', A_MEET_DAY)]),
    );
  });
});

describe('the log cannot be written to from outside', () => {
  it('the published global is a GETTER, and the copy it returns is not the log', () => {
    const state = aSitting();
    offer(state, BOMB_OUT);

    const scope = globalThis as unknown as Record<string, unknown>;
    const published = scope[CUT_IN_OBSERVER_GLOBAL];
    expect(typeof published, `${CUT_IN_OBSERVER_GLOBAL} is not published`).toBe('function');

    const read = published as () => ReturnType<typeof cutInGateObservations>;
    const taken = read();
    expect(taken.observations).toHaveLength(1);

    // A page script appending to what it was handed must not reach the log. If
    // `cutInGateObservations` returned `OBSERVED` itself this goes red — and a
    // browser check that could be fed a refusal it never saw is not a check.
    (taken.observations as unknown as unknown[]).push({ forged: true });
    expect(read().observations).toHaveLength(1);
  });

  it('a single entry is frozen', () => {
    const state = aSitting();
    offer(state, BOMB_OUT);
    const entry = cutInGateObservations().observations[0];
    expect(entry).toBeDefined();
    expect(Object.isFrozen(entry)).toBe(true);
  });
});

describe('the bound reports itself rather than shortening the record silently', () => {
  it('overflowing drops the OLDEST and counts what it dropped', () => {
    // An "empty domain reproduced" in miniature: a reader asking "was the first
    // grant on leg 1" against a log whose first grant has been evicted is
    // asserting nothing. `dropped` is what lets the tool pin that at zero.
    const state = aSitting();
    const over = CUT_IN_TUNING.OBSERVED_DECISIONS + 2;
    for (let i = 0; i < over; i += 1) offer(state, BOMB_OUT);

    const { observations, dropped } = cutInGateObservations();
    expect(observations).toHaveLength(CUT_IN_TUNING.OBSERVED_DECISIONS);
    expect(dropped).toBe(2);
    // The oldest went, not the newest: seq 0 and 1 are the ones missing.
    expect(observations[0]?.seq).toBe(2);
    expect(observations[observations.length - 1]?.seq).toBe(over - 1);
  });

  it('a run the size of the browser tool does NOT overflow', () => {
    // Non-vacuity for the pin above, and the reason the bound is what it is:
    // `verify-cutin-cap.mjs` drives three meets in one process. Nine walk-outs,
    // two recap record beats and a bomb-out is ~12 offers per meet.
    const state = aSitting();
    const threeMeets = 12 * 3;
    for (let i = 0; i < threeMeets; i += 1) offer(state, BOMB_OUT);
    expect(cutInGateObservations().dropped).toBe(0);
    expect(cutInGateObservations().observations).toHaveLength(threeMeets);
  });
});
