/**
 * WHAT MEET DAY FEELS LIKE IN THE HAND.
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS
 * ===========================================================================
 * `expo-haptics` has been installed and working since the rep mechanic was
 * built. `LIFT_TUNING.HAPTICS` ships a pattern per lift event and `useLiftLoop`
 * fires them, so an ordinary training set already vibrates. Meet day fired
 * nothing: for the ~3.9 s across the bar load, the walk-out call and the
 * three-light reveal — the beats GDD §12.2 grades this piece on — the phone was
 * still, in an app that buzzes on a warm-up single.
 *
 * ===========================================================================
 * WHAT THIS FILE CAN AND CANNOT SAY
 * ===========================================================================
 * IT CANNOT SAY ANY OF THIS FEELS RIGHT. Nothing can, here: GDD §12.1 is
 * explicit that no critic can judge haptic timing it cannot feel, and web —
 * where every screenshot in this repository is taken — has no haptic engine, so
 * the capture harness cannot see it either. The values in `MEET_TUNING.HAPTICS`
 * are a starting vocabulary and are stated as such in that file.
 *
 * WHAT IT CAN SAY, and each of these is a claim that fails if broken:
 *
 *   1. Every pattern in the table is REACHABLE through `hapticForBeat`, and
 *      every beat the screens can produce resolves to one. Deleting any single
 *      entry turns exactly one named test below red.
 *   2. Moments that must not feel the same do not — a white light and a red
 *      one, a good lift and a no-lift, an ordinary walkout and a third attempt.
 *   3. A bomb-out is NOT the rep's miss buzz (GDD §6.3: "not punitive").
 *   4. THE SCREENS ACTUALLY FIRE THEM. Checked by reading the components'
 *      source, because the node suite cannot render a `.tsx`. Without this, a
 *      complete and beautiful table that nothing called would pass everything
 *      above — which is exactly the state the piece was in.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { LIFT_TUNING, type HapticPattern, type HapticStyle } from '../game/liftTuning';
import { MEET_BEAT_KINDS, hapticForBeat, type MeetBeat } from '../game/meetDay';
import { MEET_TUNING } from '../game/meetTuning';

const SRC = path.join(__dirname, '..');

const WALKOUT = 'meet/WalkoutView.tsx';
const VERDICT = 'meet/VerdictView.tsx';
const BOMB_OUT = 'meet/BombOutView.tsx';
const ATTEMPT_SELECT = 'meet/AttemptSelectView.tsx';

function read(relPath: string): string {
  return readFileSync(path.join(SRC, relPath), 'utf8');
}

const STYLES: readonly HapticStyle[] = [
  'selection',
  'light',
  'medium',
  'heavy',
  'rigid',
  'soft',
  'success',
  'warning',
  'error',
];

/**
 * Every pattern in the table, with the beat that must reach it.
 *
 * The mapping is written out rather than derived from `hapticForBeat`, so this
 * is a second, independent statement of the routing. A table derived from the
 * function it is checking would agree with any bug in it.
 */
const ROUTES: readonly { readonly key: keyof typeof MEET_TUNING.HAPTICS; readonly beat: MeetBeat }[] = [
  { key: 'BAR_PLATE', beat: { kind: 'bar-plate' } },
  { key: 'WALKOUT_CALL', beat: { kind: 'walkout-call', urgent: false } },
  { key: 'WALKOUT_CALL_URGENT', beat: { kind: 'walkout-call', urgent: true } },
  { key: 'DELIBERATION', beat: { kind: 'deliberation' } },
  { key: 'LIGHT_WHITE', beat: { kind: 'light', light: 'white' } },
  { key: 'LIGHT_RED', beat: { kind: 'light', light: 'red' } },
  { key: 'VERDICT_GOOD', beat: { kind: 'verdict', good: true } },
  { key: 'VERDICT_NO_LIFT', beat: { kind: 'verdict', good: false } },
  { key: 'BOMB_OUT', beat: { kind: 'bomb-out' } },
  { key: 'FLOOR_RAISED', beat: { kind: 'floor', raisedByMiss: true } },
  { key: 'ATTEMPT_DECLARED', beat: { kind: 'attempt-declared' } },
];

/**
 * Undefined is handled explicitly, not by accident: deleting an entry from
 * `MEET_TUNING.HAPTICS` makes `hapticForBeat` return `undefined`, and
 * `expect(undefined).not.toBeNull()` PASSES. A check that only tested for null
 * would have let exactly the mutation it exists to catch through.
 */
function isPlayable(pattern: HapticPattern | null | undefined): pattern is HapticPattern {
  if (pattern === null || pattern === undefined) return false;
  if (pattern.beats.length === 0) return false;
  return pattern.beats.every(
    (b) => STYLES.includes(b.style) && Number.isFinite(b.delayMs) && b.delayMs >= 0,
  );
}

// ---------------------------------------------------------------------------
// One named test per pattern. Delete any entry and exactly one of these fails.
// ---------------------------------------------------------------------------

describe('every meet-day beat is felt', () => {
  for (const { key, beat } of ROUTES) {
    it(`fires MEET_TUNING.HAPTICS.${key} on the ${JSON.stringify(beat)} beat`, () => {
      const played = hapticForBeat(beat);
      // The table still HAS the entry. Checked separately from the routing,
      // because a deleted key makes both the lookup and the route `undefined`
      // and the identity assertion below would then compare undefined to
      // undefined and pass.
      expect(
        Object.hasOwn(MEET_TUNING.HAPTICS, key),
        `MEET_TUNING.HAPTICS.${key} is gone`,
      ).toBe(true);
      expect(played ?? null, `nothing routes to ${key}`).not.toBeNull();
      expect(isPlayable(played), `${key} is not a playable pattern`).toBe(true);
      // IDENTITY, not deep equality: a hand-copied pattern in `meetDay.ts`
      // would satisfy a value check and then drift the first time the table was
      // tuned, which is the failure a single tuning home exists to prevent.
      expect(played).toBe(MEET_TUNING.HAPTICS[key]);
    });
  }

  it('routes every beat kind the screens can produce', () => {
    // The other direction from the list above: a beat added to `MeetBeat` and
    // forgotten in `hapticForBeat` falls through to `null` and is silent.
    const routed = new Set(ROUTES.map((r) => r.beat.kind));
    for (const kind of MEET_BEAT_KINDS) {
      expect(routed.has(kind), `no route covers the "${kind}" beat`).toBe(true);
    }
  });

  it('leaves no pattern in the table that nothing plays', () => {
    // A dead constant is a knob a playtester would turn to no effect.
    const reachable = new Set(ROUTES.map((r) => r.key));
    for (const key of Object.keys(MEET_TUNING.HAPTICS)) {
      expect(reachable.has(key as keyof typeof MEET_TUNING.HAPTICS), `${key} is unreachable`).toBe(
        true,
      );
    }
  });

  it('is silent on a floor that a miss did not raise, and that is the design', () => {
    // GDD §6.3's bite is that a MISS raises the floor. A beat that fired on
    // both would say nothing; the silence on the good path is what gives the
    // bad one its weight. Asserted so nobody "fixes" it later.
    expect(hapticForBeat({ kind: 'floor', raisedByMiss: false })).toBeNull();
    expect(hapticForBeat({ kind: 'floor', raisedByMiss: true })).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Moments that must not feel alike
// ---------------------------------------------------------------------------

describe('the beats that carry a verdict are distinguishable by feel alone', () => {
  it('does not let a red light feel like a white one', () => {
    // A lifter watching a 2-1 assemble should feel the third one land the wrong
    // way. If these were equal, the reveal would be a light show only.
    expect(hapticForBeat({ kind: 'light', light: 'white' })).not.toEqual(
      hapticForBeat({ kind: 'light', light: 'red' }),
    );
  });

  it('does not let a no-lift feel like a good lift', () => {
    expect(hapticForBeat({ kind: 'verdict', good: true })).not.toEqual(
      hapticForBeat({ kind: 'verdict', good: false })
    );
  });

  it('does not let a third attempt walk out like an opener', () => {
    expect(hapticForBeat({ kind: 'walkout-call', urgent: true })).not.toEqual(
      hapticForBeat({ kind: 'walkout-call', urgent: false }),
    );
  });

  it('does not file a bomb-out under the same feeling as a mistimed rep', () => {
    // GDD §6.3: "not a generic game-over screen, and not punitive." `error` is
    // what a missed rep feels like (`LIFT_TUNING.HAPTICS.MISS`); reusing it for
    // the worst moment in the sport would make it read as a fail state.
    const bomb = hapticForBeat({ kind: 'bomb-out' });
    expect(bomb).not.toEqual(LIFT_TUNING.HAPTICS.MISS);
    expect(bomb?.beats.some((b) => b.style === 'error')).toBe(false);
    // ...and it is one beat, not a burst.
    expect(bomb?.beats.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The screens actually fire them
// ---------------------------------------------------------------------------

/** Every `playBeat({ kind: '…' })` in a source, by beat kind. */
export function beatsFiredIn(source: string): readonly string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/playBeat\(\{\s*kind:\s*'([a-z-]+)'/g)) {
    const kind = match[1];
    if (kind !== undefined) found.push(kind);
  }
  return found;
}

/**
 * True when every `playBeat` in the file is one this scan could read.
 *
 * A call built from a variable — `playBeat(beat)` — would be invisible to the
 * scan above and would make every assertion below weaker without saying so.
 */
export function everyBeatIsReadable(source: string): boolean {
  const calls = source.split('playBeat(').length - 1;
  return calls > 0 && calls === beatsFiredIn(source).length;
}

describe('the source scan this file depends on', () => {
  it('finds a beat, and finds none where there is none', () => {
    expect(beatsFiredIn("playBeat({ kind: 'bomb-out' })")).toEqual(['bomb-out']);
    expect(beatsFiredIn('const x = 1;')).toEqual([]);
  });

  it('notices a call it cannot read', () => {
    expect(everyBeatIsReadable("playBeat({ kind: 'bomb-out' })")).toBe(true);
    expect(everyBeatIsReadable('playBeat(whicheverBeatItIs)')).toBe(false);
    expect(everyBeatIsReadable('nothing at all')).toBe(false);
  });
});

describe('the four meet screens fire the beats they own', () => {
  const EXPECTED: readonly { readonly file: string; readonly kinds: readonly string[] }[] = [
    // The bar loads a plate at a time and then the call arrives (GDD §6.2.1).
    { file: WALKOUT, kinds: ['bar-plate', 'walkout-call'] },
    // Three lamps, the verdict behind them, and the deliberation beat in front
    // (GDD §6.2.4). THE THREE-WHITE-LIGHTS REVEAL IS THE GAME'S TITLE MOMENT.
    { file: VERDICT, kinds: ['light', 'verdict', 'deliberation'] },
    { file: BOMB_OUT, kinds: ['bomb-out'] },
    // The floor, and the declaration that cannot be taken back (GDD §6.3).
    { file: ATTEMPT_SELECT, kinds: ['floor', 'attempt-declared'] },
  ];

  for (const { file, kinds } of EXPECTED) {
    it(`${path.basename(file)} fires ${kinds.join(', ')}`, () => {
      const source = read(file);
      const fired = new Set(beatsFiredIn(source));
      for (const kind of kinds) {
        expect(fired.has(kind), `${path.basename(file)} never fires the "${kind}" beat`).toBe(true);
      }
      expect(source, `${path.basename(file)} does not import the player`).toContain(
        "import { playBeat } from './meetFeedback'",
      );
      expect(
        everyBeatIsReadable(source),
        `${path.basename(file)} fires a beat this scan cannot read`,
      ).toBe(true);
    });
  }

  it('leaves no beat kind unfired by any screen', () => {
    // The whole vocabulary, checked against the whole of `src/meet/`. A beat
    // defined, routed and never triggered is a silent moment with a comment
    // about how it feels.
    const fired = new Set(
      [WALKOUT, VERDICT, BOMB_OUT, ATTEMPT_SELECT].flatMap((f) => beatsFiredIn(read(f))),
    );
    for (const kind of MEET_BEAT_KINDS) {
      expect(fired.has(kind), `nothing on any screen fires the "${kind}" beat`).toBe(true);
    }
  });

  it('fires one thud per plate rather than two', () => {
    // Both sleeves are drawn and both are staggered identically. A haptic from
    // each would make a six-plate bar feel like a twelve-plate one, so the
    // mirrored sleeve is drawn `felt={false}`.
    const source = read(WALKOUT);
    expect(source).toContain('felt={false}');
    expect(source).toContain('if (!felt) return undefined;');
  });
});
