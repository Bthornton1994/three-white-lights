/**
 * careerTuning.test.ts — the tuning block grades itself on shape, not on feel.
 *
 * Nothing here says a value is right; GDD §12.1 says that takes a playtest.
 * What it says is that the block is classified, ordered and reachable, and
 * every ordering below is DERIVED from `MEET_TIERS`' own order rather than
 * restated as a list of four numbers a reader would have to check by eye.
 *
 * Each check names, in place, the edit to `careerTuning.ts` that reddens it.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  CAREER_TUNING,
  CAREER_TUNING_CLASSES,
  CAREER_TUNING_CLASSIFICATION,
  type CareerTuningClass,
} from './careerTuning';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const TUNING_SOURCE = readFileSync(path.join(HERE, 'careerTuning.ts'), 'utf8');

const TUNING_KEYS = Object.keys(CAREER_TUNING).sort();

/**
 * The `/** ... *\/` block sitting immediately above a top-level key, or ''.
 *
 * "Immediately" is enforced rather than assumed: if anything but whitespace
 * sits between the block's `*\/` and the key, this returns '' rather than
 * handing back the previous key's documentation. Without that, a phrase in one
 * entry's docstring would satisfy the check for the entry below it.
 */
function docBlockAbove(source: string, key: string): string {
  const at = source.search(new RegExp(`^  ${key}:`, 'm'));
  if (at < 0) return '';
  const close = source.lastIndexOf('*/', at);
  if (close < 0) return '';
  if (source.slice(close + 2, at).trim() !== '') return '';
  const open = source.lastIndexOf('/**', close);
  if (open < 0) return '';
  return source.slice(open, close + 2);
}

describe('every entry is classified', () => {
  it('classifies exactly the keys that exist, and only with known classes', () => {
    // WHAT REDDENS THIS, said plainly because the obvious answer is wrong: not
    // deleting a row from `CAREER_TUNING_CLASSIFICATION`, and not adding a key
    // to `CAREER_TUNING` without one. The `satisfies` clause makes both a
    // COMPILE error, so the compiler gets there before this assertion does and
    // the suite never runs.
    //
    // What it does catch is the classification being written for a key that
    // does not exist under a weakened `satisfies` — and, together with the
    // source pin in the test below, the `satisfies` being removed. The pair is
    // the check; neither half is on its own.
    expect(Object.keys(CAREER_TUNING_CLASSIFICATION).sort()).toEqual(TUNING_KEYS);
    for (const [key, value] of Object.entries(CAREER_TUNING_CLASSIFICATION)) {
      expect(CAREER_TUNING_CLASSES, `${key} is classified ${value}`).toContain(
        value as CareerTuningClass,
      );
    }
    // Counts, not bounds: the block has entries and every one was examined.
    expect(TUNING_KEYS.length).toBe(12);
    expect(Object.keys(CAREER_TUNING_CLASSIFICATION).length).toBe(TUNING_KEYS.length);
  });

  it('keeps the compile-time totality clause that makes the check above bite', () => {
    // The other half. Deleting the `satisfies` line turns an unclassified key
    // from a compile error into a silent gap, and the assertion above would
    // still be green until somebody also removed a row.
    //
    // The match COUNT is pinned rather than presence, because a pattern with
    // two witnesses in a file survives the mutation that breaks one of them —
    // CLAUDE.md records the cut-in cap failing exactly that way.
    const clause = /satisfies Readonly<Record<keyof typeof CAREER_TUNING, CareerTuningClass>>/g;
    expect([...TUNING_SOURCE.matchAll(clause)].length).toBe(1);
  });

  it('marks the one table that looks published and is not', () => {
    // GDD §12.3 refuses homebrewed RPE, e1RM and DOTS values. A qualifying
    // total is NOT one of those — it is a difficulty threshold — and the risk
    // is that a later reader cannot tell, because it is denominated in
    // kilograms and printed on an entry screen like a rulebook number.
    //
    // Reddens on: deleting the phrase from `QUALIFYING_TOTAL_KG_BY_TIER`'s
    // docstring, or classifying a second entry `design-table` without writing
    // the same sentence over it.
    const REQUIRED = 'not a published standard';
    const designTables = Object.entries(CAREER_TUNING_CLASSIFICATION)
      .filter(([, value]) => value === 'design-table')
      .map(([key]) => key);
    expect(designTables).toEqual(['QUALIFYING_TOTAL_KG_BY_TIER']);
    for (const key of designTables) {
      expect(docBlockAbove(TUNING_SOURCE, key).toLowerCase(), `${key} is undisclaimed`).toContain(
        REQUIRED,
      );
    }

    // Non-vacuity, three ways, because a whole-file `includes(REQUIRED)` would
    // pass on this file's own header and check nothing.
    //
    //   (a) the extractor finds a real block for every key, counted;
    //   (b) it finds NOTHING for a key that does not exist;
    //   (c) a key that is not a design table does not carry the phrase — so
    //       the positive result above is about the region, not the file.
    let blocks = 0;
    for (const key of TUNING_KEYS) {
      expect(docBlockAbove(TUNING_SOURCE, key).length, `${key} has no docstring`).toBeGreaterThan(
        0,
      );
      blocks += 1;
    }
    expect(blocks).toBe(TUNING_KEYS.length);
    expect(docBlockAbove(TUNING_SOURCE, 'NOT_A_TUNING_KEY')).toBe('');
    expect(docBlockAbove(TUNING_SOURCE, 'CALENDAR_MAX_SLOTS').toLowerCase()).not.toContain(REQUIRED);
  });
});

describe('the tier ladder', () => {
  it('is GDD §6.1’s four tiers in GDD §6.1’s order', () => {
    // Reddens on: reordering `MEET_TIERS`, or adding a fifth tier. Both are
    // real decisions — `careerTierRank` is this array's index and every
    // ordering below is stated against it.
    expect(CAREER_TUNING.MEET_TIERS).toEqual(['local', 'regional', 'nationals', 'worlds']);
  });

  it('gives every tier a row in every per-tier table, and no extra rows', () => {
    // The compiler catches a MISSING row, because every reader indexes these
    // by `CareerTier`. It does not catch an EXTRA one: adding `masters: 30` to
    // `MEET_INTERVAL_DAYS_BY_TIER` type-checks fine and produces a tier with a
    // cadence and no place on the ladder. That is what this reddens on.
    const tiers = [...CAREER_TUNING.MEET_TIERS].sort();
    expect(Object.keys(CAREER_TUNING.MEET_INTERVAL_DAYS_BY_TIER).sort()).toEqual(tiers);
    expect(Object.keys(CAREER_TUNING.FIRST_MEET_DAY_BY_TIER).sort()).toEqual(tiers);
    expect(Object.keys(CAREER_TUNING.QUALIFYING_TOTAL_KG_BY_TIER).sort()).toEqual(tiers);
    expect(Object.keys(CAREER_TUNING.MEET_TITLE_BY_TIER).sort()).toEqual(tiers);
    expect(tiers.length).toBe(4);
  });

  it('asks more of every tier than of the one below it', () => {
    // GDD §6.1's ladder is only a ladder if climbing it costs something.
    //
    // Reddens on: lowering any qualifying total below the tier under it —
    // setting `nationals.mens` to 400, say, which is under `regional`'s 450.
    // Also reddens if a tier above `local` is made open (`null`), which would
    // be an ungated nationals.
    let compared = 0;
    for (const category of CAREER_TUNING.QUALIFYING_CATEGORIES) {
      const ladder = CAREER_TUNING.MEET_TIERS.map(
        (tier) => CAREER_TUNING.QUALIFYING_TOTAL_KG_BY_TIER[tier][category],
      );
      // Exactly one open tier, and it is the entry tier. A second open tier
      // would make the gate skippable; an open tier higher up would make the
      // entry tier gated.
      expect(ladder.filter((kg) => kg === null).length).toBe(1);
      expect(ladder[0]).toBeNull();
      for (let rank = 1; rank < ladder.length; rank += 1) {
        const below = ladder[rank - 1];
        const here = ladder[rank];
        expect(here, `${CAREER_TUNING.MEET_TIERS[rank]} ${category} is open`).not.toBeNull();
        if (typeof below === 'number' && typeof here === 'number') {
          expect(
            here,
            `${CAREER_TUNING.MEET_TIERS[rank]} ${category} asks less than ${CAREER_TUNING.MEET_TIERS[rank - 1]}`,
          ).toBeGreaterThan(below);
          compared += 1;
        }
      }
    }
    // Counts, not bounds: two categories, two gated-over-gated steps each.
    expect(compared).toBe(4);
  });

  it('comes round less often the higher up the ladder it is', () => {
    // GDD §6.6: "Quarterly Nationals, annual Worlds — scarcity keeps them
    // special". Scarcity is the interval, so the interval has to grow.
    //
    // Reddens on: setting `nationals` to 10 days, or `worlds` under
    // `nationals`.
    let steps = 0;
    for (let rank = 1; rank < CAREER_TUNING.MEET_TIERS.length; rank += 1) {
      const here = CAREER_TUNING.MEET_TIERS[rank] as (typeof CAREER_TUNING.MEET_TIERS)[number];
      const below = CAREER_TUNING.MEET_TIERS[rank - 1] as (typeof CAREER_TUNING.MEET_TIERS)[number];
      expect(
        CAREER_TUNING.MEET_INTERVAL_DAYS_BY_TIER[here],
        `${here} comes round at least as often as ${below}`,
      ).toBeGreaterThan(CAREER_TUNING.MEET_INTERVAL_DAYS_BY_TIER[below]);
      expect(
        CAREER_TUNING.FIRST_MEET_DAY_BY_TIER[here],
        `${here} opens no later than ${below}`,
      ).toBeGreaterThan(CAREER_TUNING.FIRST_MEET_DAY_BY_TIER[below]);
      steps += 1;
    }
    expect(steps).toBe(3);
  });

  it('puts every interval on a whole number of weeks', () => {
    // A meet is a weekend. An interval that is not a multiple of seven walks
    // the fixture through the working week, and 91 and 364 are §6.6's
    // "quarterly" and "annual" rounded to the week for that reason.
    //
    // Reddens on: any interval that is not a multiple of the entry tier's.
    const week = CAREER_TUNING.MEET_INTERVAL_DAYS_BY_TIER.local;
    let checked = 0;
    for (const tier of CAREER_TUNING.MEET_TIERS) {
      expect(CAREER_TUNING.MEET_INTERVAL_DAYS_BY_TIER[tier] % week, `${tier}`).toBe(0);
      checked += 1;
    }
    expect(checked).toBe(CAREER_TUNING.MEET_TIERS.length);
  });

  it('never opens a tier on the day the lifter made the account', () => {
    // A calendar whose first entry is today is not a calendar. Every tier's
    // first meet is at least one entry-tier cycle out.
    //
    // Reddens on: setting any `FIRST_MEET_DAY_BY_TIER` entry to 0 or 1.
    const week = CAREER_TUNING.MEET_INTERVAL_DAYS_BY_TIER.local;
    let checked = 0;
    for (const tier of CAREER_TUNING.MEET_TIERS) {
      expect(CAREER_TUNING.FIRST_MEET_DAY_BY_TIER[tier], `${tier}`).toBeGreaterThanOrEqual(week);
      checked += 1;
    }
    expect(checked).toBe(CAREER_TUNING.MEET_TIERS.length);
  });

  it('keeps at least one entry-tier meet inside the visible window', () => {
    // The window has to be wider than the entry tier's cadence or a player
    // opens the calendar to nothing. The higher tiers are deliberately NOT
    // held to this: a worlds meet being off-screen for most of the year is
    // §6.6's scarcity working.
    //
    // Reddens on: dropping `CALENDAR_VISIBLE_DAYS_AHEAD` below the local
    // interval — to 3, say.
    expect(CAREER_TUNING.CALENDAR_VISIBLE_DAYS_AHEAD).toBeGreaterThanOrEqual(
      CAREER_TUNING.MEET_INTERVAL_DAYS_BY_TIER.local,
    );
    // And the entry gap cannot be so wide that the entry tier is unenterable
    // twice running inside one visible window.
    expect(CAREER_TUNING.MIN_DAYS_BETWEEN_ENTERED_MEETS).toBeLessThan(
      CAREER_TUNING.CALENDAR_VISIBLE_DAYS_AHEAD,
    );
  });
});

describe('the federation catalogue', () => {
  it('covers GDD §2.1’s two axes exactly once each way round', () => {
    // "pick a federation (raw / equipped / tested / untested)" is two axes, so
    // the cover is the cartesian product — DERIVED from the two arrays rather
    // than counted to four here.
    //
    // Reddens on: deleting a federation, or duplicating a combination (making
    // two of them raw/tested, which leaves equipped/untested unpickable).
    const wanted = CAREER_TUNING.EQUIPMENT_DIVISIONS.flatMap((equipment) =>
      CAREER_TUNING.TESTING_POLICIES.map((testing) => `${equipment}/${testing}`),
    ).sort();
    const shipped = CAREER_TUNING.FEDERATIONS.map(
      (federation) => `${federation.equipment}/${federation.testing}`,
    ).sort();
    expect(shipped).toEqual(wanted);
    expect(wanted.length).toBe(4);
  });

  it('keeps ids, names and meet prefixes distinct and derivable', () => {
    // Reddens on: two federations sharing an id (which would make
    // `careerFederation` return the wrong one), or an id that is not its own
    // name kebab-cased (which is how a reader checks one against the other
    // without a lookup).
    const ids = CAREER_TUNING.FEDERATIONS.map((federation) => federation.id);
    const names = CAREER_TUNING.FEDERATIONS.map((federation) => federation.name);
    const prefixes = CAREER_TUNING.FEDERATIONS.map((federation) => federation.meetPrefix);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    for (const federation of CAREER_TUNING.FEDERATIONS) {
      expect(federation.id).toBe(federation.name.toLowerCase().replace(/ /g, '-'));
      // A prefix is one token, because a meet name is `${prefix} ${title}`.
      expect(federation.meetPrefix).not.toContain(' ');
      expect(federation.meetPrefix.length).toBeGreaterThan(0);
    }
    expect(ids.length).toBe(4);
  });

  it('carries no abbreviation field, and the omission is the point', () => {
    // Three- and four-letter federation acronyms are the highest-collision
    // namespace in this sport: `src/licensing/realIp.ts` watches ten real
    // federations and half of them are acronyms. An `abbreviation: 'NBF'`
    // added here would be a coin-flip against a real body's initials, and the
    // watchlist would not catch a NEW collision because a denylist only knows
    // the names somebody already thought of.
    //
    // Reddens on: adding any field to a federation row.
    for (const federation of CAREER_TUNING.FEDERATIONS) {
      expect(Object.keys(federation).sort()).toEqual([
        'equipment',
        'id',
        'meetPrefix',
        'name',
        'testing',
      ]);
    }
  });

  it('names every meet after what the event is, not after anybody', () => {
    // Reddens on: a tier title that is not a generic competition descriptor —
    // this pins the four exactly, so any change is a decision somebody signs
    // and a fresh critic sees the diff.
    expect(CAREER_TUNING.MEET_TITLE_BY_TIER).toEqual({
      local: 'Open',
      regional: 'Regional Championships',
      nationals: 'National Championships',
      worlds: 'World Championships',
    });
  });
});
