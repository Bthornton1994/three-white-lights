/**
 * meetClient.test.ts — the crossing, measured.
 *
 * The claim under test is the one the whole change is about: what meet day reads
 * about a lifter is what the training half of the game wrote about that lifter,
 * and the two halves compute it with the same function rather than with two
 * copies that happen to agree today.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { EMPTY_FATIGUE_STATE } from './fatigue';
import { LIFT_ORDER, suggestOpener, type LiftKind } from './meet';
import {
  meetDayFactsFromCache,
  meetDayHistoryFromCache,
  MEET_BRIEF_KEYS,
  type MeetBrief,
} from './meetClient';
import { meetDayFacts } from './meetServer';
import { MEET_LOCAL } from './meetTuning';
import {
  applyServerSnapshot,
  emptyProgressionCache,
  receiveProgressionSnapshot,
  type ProgressionCache,
} from './progression';
import {
  newServerRecord,
  snapshotWireFor,
  type ServerRecord,
} from './sessionServer';
import { SESSION_BOUNDARY, SESSION_TUNING } from './sessionTuning';

const DAY = 40;
const SEED = SESSION_TUNING.STARTING_E1RM;

/** The cache a client would hold after being told about `record`. */
function cacheOf(record: ServerRecord): ProgressionCache {
  const received = receiveProgressionSnapshot(snapshotWireFor(record, null));
  if (!received.ok) throw new Error('meetClient.test: the wire did not decode');
  const applied = applyServerSnapshot(emptyProgressionCache(), received.value);
  if (!applied.ok) throw new Error('meetClient.test: the snapshot did not apply');
  return applied.value;
}

function fresh(): ServerRecord {
  return newServerRecord(SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY);
}

/** A lifter who has trained past the seed and competed once. */
function experienced(): ServerRecord {
  return {
    ...fresh(),
    totalKg: 480,
    bestE1rmKg: { squat: 232.5, bench: 141, deadlift: 265 },
    meets: [
      {
        meetId: `${MEET_LOCAL.id}-previous`,
        meetDayIndex: DAY - 90,
        totalKg: 480,
        bestByLift: { squat: 190, bench: 110, deadlift: 180 },
        bodyweightKg: 93,
      },
      {
        meetId: `${MEET_LOCAL.id}-older`,
        meetDayIndex: DAY - 200,
        totalKg: 430,
        bestByLift: { squat: 175, bench: 115, deadlift: 175 },
        bodyweightKg: 93,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// The purity contract, the same scan `sessionClient.test.ts` runs on its own
// ---------------------------------------------------------------------------

describe('purity contract — CLAUDE.md, GDD §9.2', () => {
  const SOURCE = readFileSync(fileURLToPath(new URL('./meetClient.ts', import.meta.url)), 'utf8');
  const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");

  it('the scan reads the real file', () => {
    expect(code.length).toBeGreaterThan(500);
  });

  it('has no clock, no randomness, no I/O and no React', () => {
    expect(code).not.toMatch(/\bnew Date\b|\bDate\.now\b/);
    expect(code).not.toMatch(/\bMath\.random\b/);
    expect(code).not.toMatch(/\bfetch\b|\blocalStorage\b|\bAsyncStorage\b/);
    expect(code).not.toMatch(/\bfrom "react"|\bfrom 'react'|useState|useEffect/);
  });

  it('the scan can see what it is looking for', () => {
    // Without this the four assertions above pass on any file whose comments
    // have eaten the code.
    expect(code).toMatch(/\bmeetDayFactsFromCache\b/);
    expect(code).toMatch(/\bMeetServerPort\b/);
  });

  it('does not name the stored row', () => {
    // The discipline `sessionClient.ts` states and this file inherits: the app
    // cannot hold a `ServerRecord`, so the module the app reads through must not
    // hand one back.
    expect(code).not.toMatch(/\bServerRecord\b/);
    expect(code).not.toMatch(/\bnewServerRecord\b/);
  });
});

// ---------------------------------------------------------------------------
// The brief carries one thing (GDD §3.4, §12.3)
// ---------------------------------------------------------------------------

describe('the meet brief is exactly its allowlist', () => {
  it('is one field, and it is the ledger', () => {
    expect([...MEET_BRIEF_KEYS]).toEqual(['fatigue']);
    // Structural, so a widened `MeetBrief` fails here as well as at `tsc`.
    const brief: MeetBrief = { fatigue: EMPTY_FATIGUE_STATE };
    expect(Object.keys(brief)).toEqual([...MEET_BRIEF_KEYS]);
  });
});

// ---------------------------------------------------------------------------
// THE CROSSING
// ---------------------------------------------------------------------------

describe('the client and the server cross the same number', () => {
  it('agree exactly, on a lifter with a history', () => {
    // THE ANTI-DIVERGENCE PIN. `meetDayFacts` is one function over
    // `MeetDayHistory`; the server passes its row and the client passes what it
    // read out of the cache. If those two ever became separate implementations,
    // "two parts of the app can never report different numbers for the same
    // set" would stop being true one mode over from where CLAUDE.md says it.
    const record = experienced();
    expect(meetDayFactsFromCache(cacheOf(record), DAY, SEED)).toEqual(
      meetDayFacts(record, DAY, SEED),
    );
  });

  it('agree on a lifter with no history at all', () => {
    const record = fresh();
    expect(meetDayFactsFromCache(cacheOf(record), DAY, SEED)).toEqual(
      meetDayFacts(record, DAY, SEED),
    );
  });

  it('and the fixtures are actually different, so the agreement is not one case twice', () => {
    // Non-vacuity. Two identical inputs agree under any implementation.
    expect(meetDayFacts(experienced(), DAY, SEED)).not.toEqual(meetDayFacts(fresh(), DAY, SEED));
  });
});

describe('what the client reads out of the cache', () => {
  it('carries the trained e1RM, the best total and the per-lift competition bests', () => {
    const history = meetDayHistoryFromCache(cacheOf(experienced()));
    expect(history.bestE1rmKg).toEqual({ squat: 232.5, bench: 141, deadlift: 265 });
    expect(history.totalKg).toBe(480);
    expect(history.meets).toHaveLength(2);
  });

  it('takes the BEST of two stored meets per lift, not the latest', () => {
    // The bench went DOWN between the two meets in the fixture, which is the
    // case that separates "best" from "most recent".
    const facts = meetDayFactsFromCache(cacheOf(experienced()), DAY, SEED);
    expect(facts.previousBestByLiftKg).toEqual({ squat: 190, bench: 115, deadlift: 180 });
  });

  it('reports an empty lifter honestly, and falls back to the seed for the opener', () => {
    const facts = meetDayFactsFromCache(cacheOf(fresh()), DAY, SEED);
    expect(facts.previousBestTotalKg).toBeNull();
    expect(facts.previousBestByLiftKg).toEqual({ squat: null, bench: null, deadlift: null });
    for (const lift of LIFT_ORDER) {
      expect(facts.bestE1rmKg[lift], lift).toBe(SEED.kilograms[lift]);
    }
  });

  it('a cache that has heard nothing reports a lifter with no history', () => {
    // The loading state, and it is honest rather than a zero dressed up as a
    // fact: before the first snapshot the readings are `'unknown'`.
    const facts = meetDayFactsFromCache(emptyProgressionCache(), DAY, SEED);
    expect(facts.previousBestTotalKg).toBeNull();
    for (const lift of LIFT_ORDER) {
      expect(facts.bestE1rmKg[lift], lift).toBe(SEED.kilograms[lift]);
    }
  });
});

// ---------------------------------------------------------------------------
// The consequence the player sees (GDD §6.1)
// ---------------------------------------------------------------------------

describe('the opener follows the lifter’s own e1RM', () => {
  it('a trained lifter opens heavier than a brand-new one, on every lift', () => {
    // THE DEFECT, AS AN ASSERTION. Before this change meet day built its own
    // empty record, so both sides of this comparison were the seed's opener and
    // every meet in the game opened at the same three weights for ever.
    const trained = meetDayFactsFromCache(cacheOf(experienced()), DAY, SEED);
    const brandNew = meetDayFactsFromCache(cacheOf(fresh()), DAY, SEED);
    for (const lift of LIFT_ORDER) {
      const a = suggestOpener(lift, trained.bestE1rmKg[lift], MEET_LOCAL.rules);
      const b = suggestOpener(lift, brandNew.bestE1rmKg[lift], MEET_LOCAL.rules);
      expect(a.ok && b.ok, lift).toBe(true);
      if (!a.ok || !b.ok) continue;
      expect(a.value, lift).toBeGreaterThan(b.value);
    }
  });

  it('and the opener is a function of the e1RM, at the value the browser check uses', () => {
    // The same arithmetic `tools/verify-shell-route.mjs` restates, checked here
    // against the real `suggestOpener` so the tool's restatement has something
    // to be wrong against. 124.6 x 0.9 = 112.14, floored onto the 2.5 kg
    // declaration grid = 110.0 — the numbers in that tool's failure message on
    // the tree before this fix.
    const opener = suggestOpener('bench', 124.6, MEET_LOCAL.rules);
    expect(opener.ok).toBe(true);
    if (opener.ok) expect(opener.value).toBe(110);
    const fromSeed = suggestOpener('bench', SEED.kilograms.bench, MEET_LOCAL.rules);
    expect(fromSeed.ok).toBe(true);
    if (fromSeed.ok) expect(fromSeed.value).toBe(107.5);
  });
});

// ---------------------------------------------------------------------------
// What the client is NOT given
// ---------------------------------------------------------------------------

describe('the crossing is narrow', () => {
  it('a history has three fields and none of them is the ledger, the wallet or the streak', () => {
    const history: Record<string, unknown> = { ...meetDayHistoryFromCache(cacheOf(experienced())) };
    expect(Object.keys(history).sort()).toEqual(['bestE1rmKg', 'meets', 'totalKg']);
    expect(history.fatigue).toBeUndefined();
    expect(history.wallet).toBeUndefined();
    expect(history.streak).toBeUndefined();
    expect(history.revision).toBeUndefined();
  });

  it('and a stored meet crosses only its per-lift bests', () => {
    // Not the meet id, not the day index, not the bodyweight. What
    // `previousBestByLift` reads and nothing else.
    const [first] = meetDayHistoryFromCache(cacheOf(experienced())).meets;
    expect(first).toBeDefined();
    expect(Object.keys(first as object)).toEqual(['bestByLift']);
    expect(Object.keys((first as { bestByLift: Record<LiftKind, unknown> }).bestByLift).sort()).toEqual(
      [...LIFT_ORDER].sort(),
    );
  });
});
