/**
 * liftLadders.test.ts — the guard that a driver's prompt ladder is COMPLETE.
 *
 * ===========================================================================
 * WHY THIS EXISTS AND WHAT IT COST TO NOT HAVE IT
 * ===========================================================================
 * `tools/sessionDrive.mjs`'s `LIFT_PROMPTS` is the table every browser driver
 * steers a rep by, and its stated convention is that EVERY ladder declares
 * EVERY key, `null` where that lift has no such beat. The convention is not
 * decoration: the drivers branch on `ladder.X !== null` to decide which grammar
 * a rep has, so a MISSING key and a `null` one mean opposite things while
 * looking the same to a reader.
 *
 * The 2026-08-25 grind round added a `GRIND` key — bench's one ascent line —
 * to the bench and deadlift ladders and NOT to squat's. `undefined !== null` is
 * true, so both drivers took bench's branch on a squat, skipped the drive-cue
 * loop, and played every squat attempt with ZERO drive taps.
 *
 * IT WAS INVISIBLE WHERE IT WAS DRIVEN MOST. `verify-lift-press.mjs`'s squat
 * ladder stayed green through it — that arm's checks are about which RUNGS
 * rendered and in what order, and every rung still rendered — and it took
 * `verify-shell-route.mjs` bombing two whole meets out on three squat misses
 * apiece, with "x0 drive tap(s)" in its own note, for anybody to see it. That
 * is a nine-minute instrument catching what a set-equality over an object's
 * keys catches in milliseconds.
 *
 * ===========================================================================
 * WHY IN `tools/` AND NOT IN `src/`
 * ===========================================================================
 * `testPathRefs.test.ts`'s argument, one instrument over: the subject is the
 * COMMAND LAYER. `LIFT_PROMPTS` is a transcription of `LIFT_COPY` living in a
 * `.mjs` driver, deliberately not imported from the app (see that table's own
 * header), so no `src/` module owns the question and putting the check under
 * one would make it look like that module's business.
 *
 * WHAT THIS DOES NOT CHECK, said plainly: whether the transcribed STRINGS still
 * match the app's. That is the browser tools' job by design — a driver that
 * read its copy out of the app would happily drive a broken app in circles —
 * and it is why the strings are transcribed rather than imported in the first
 * place. This file is only about the SHAPE of the table.
 */

import { describe, expect, it } from 'vitest';

import { ECCENTRIC_ONLY_PROMPTS, LIFT_PROMPTS } from './sessionDrive.mjs';

/**
 * The keys the drivers actually BRANCH on, as opposed to merely read.
 *
 * Named rather than derived from the table, because deriving them from the
 * thing under test is the self-referential vacuity this repository refuses: a
 * ladder that lost `GRIND` from every row would satisfy a derived list.
 */
const BRANCHED_ON = ['DESCENT', 'HOLE', 'COMMAND', 'GRIND', 'DOWN'] as const;

describe("every lift's prompt ladder declares every key", () => {
  it('has the same key set on all three, so a missing key can never read as a beat', () => {
    const ladders = Object.entries(LIFT_PROMPTS);
    // NON-VACUITY, AS A COUNT: three ladders, and the first one's key set is a
    // real set rather than an empty one. An emptied table passes a set equality
    // trivially, which is exactly the empty domain the rules here name.
    expect(ladders.length, 'lift ladders in the table').toBe(3);
    const [, first] = ladders[0]!;
    const wanted = Object.keys(first).sort();
    expect(wanted.length, "keys on the first ladder").toBeGreaterThan(6);
    for (const [kind, ladder] of ladders) {
      expect(Object.keys(ladder).sort(), `${kind}'s ladder`).toEqual(wanted);
    }
    // ...and the keys the drivers branch on are all in it, so this equality is
    // about the fields that decide a rep's grammar and not only about copy.
    for (const key of BRANCHED_ON) {
      expect(wanted, `no ladder declares ${key}`).toContain(key);
    }
  });

  it('gives exactly one lift a grind line, because exactly one lift has a grind', () => {
    // THE DISCRIMINATOR THE DRIVERS USE, PINNED AS A NAME AND A COUNT. Both
    // browser drivers decide "does this rep have drive cues or a continuous
    // grind" from `ladder.GRIND`, so a second lift acquiring one — or bench
    // losing its — silently reroutes a whole lift's ascent.
    const withGrind = Object.entries(LIFT_PROMPTS)
      .filter(([, ladder]) => ladder.GRIND !== null)
      .map(([kind]) => kind);
    expect(withGrind).toEqual(['bench']);
    // And the other two are `null` rather than absent, which is the whole point.
    expect(LIFT_PROMPTS.squat.GRIND).toBeNull();
    expect(LIFT_PROMPTS.deadlift.GRIND).toBeNull();
  });

  it('keeps the grind line OUT of the eccentric-only census', () => {
    // `ECCENTRIC_ONLY_PROMPTS` is every line only a lift with an eccentric can
    // print, and `verify-lift-press.mjs` asserts a driven deadlift shows none
    // of them. The grind line is an ASCENT line: folding it in would make that
    // census claim something different from what it says, and would move
    // bench's expected count to a rung a correctly driven rep cannot reach.
    expect(ECCENTRIC_ONLY_PROMPTS).not.toContain(LIFT_PROMPTS.bench.GRIND);
    // Non-vacuity: the census is not empty, and it does hold the three lines a
    // bench rep really can print before its ascent.
    expect(ECCENTRIC_ONLY_PROMPTS.length).toBe(5);
    for (const line of [
      LIFT_PROMPTS.bench.DESCENT,
      LIFT_PROMPTS.bench.HOLE,
      LIFT_PROMPTS.bench.COMMAND,
    ]) {
      expect(ECCENTRIC_ONLY_PROMPTS).toContain(line);
    }
  });
});
