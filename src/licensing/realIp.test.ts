/**
 * THE REAL-IP AUDIT, run against the real repository (GDD §12.3).
 *
 * ---------------------------------------------------------------------------
 * WHY MOST OF THIS FILE IS MUTATIONS
 * ---------------------------------------------------------------------------
 * A denylist whose patterns never match passes everything in the world. That
 * failure mode is invisible in a green suite and it is the single most likely
 * way this piece would be worthless, so "the tree is clean" is the LAST
 * assertion here, not the first.
 *
 * Before it, `describe('the audit bites')` takes REAL DATA AND REAL FILES,
 * plants a real brand or a real athlete's name in them, asserts THE PLANT
 * ACTUALLY APPLIED — a find-and-replace that silently matched nothing reports a
 * false pass, and that has happened twice in this run — and asserts the audit
 * reports it. It plants into all three of the places §12.3 names: a string, a
 * data entry, and a config. Then `describe('the audit is not a sieve')` does the
 * reverse and asserts silence on the fictional names and on ordinary prose.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE NEVER SPELLS A WATCHED NAME
 * ---------------------------------------------------------------------------
 * Every plant below is drawn from `REAL_IP_WATCHLIST` at runtime rather than
 * typed in. Two reasons, and the second is the important one:
 *
 *   1. It keeps the real names in one region of one file (see `WATCHLIST_FILE`).
 *   2. A hand-typed plant can be misspelled, and a misspelled plant that the
 *      scanner then fails to find would look exactly like a passing test.
 *      Drawing the plant from the list makes "the scanner knows this name" true
 *      by construction, so the only thing left for the assertion to prove is
 *      that the scanner REACHED the place it was planted.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DELIBERATELY_NOT_WATCHED,
  NOT_WALKED,
  REAL_IP_WATCHLIST,
  REVIEWABLE_CITATIONS,
  WATCHLIST_FILE,
  WATCHLIST_REGIONS,
  citationInventory,
  findWatchedNames,
  formatCitations,
  formatContentFindings,
  formatMentions,
  identityStrings,
  isShippedPath,
  isTextFile,
  patternFor,
  scanFileName,
  scanRenderable,
  scanSourceText,
  walkStrings,
  type RenderableString,
  type WatchEntry,
} from './realIp';
import { IDENTITY_ENTRIES, BASE_ITEMS, SPONSORED_RESKINS } from './partners';
import { tier3Asset, tier3Of, type IdentityEntry } from './tiers';
import { TUNING } from '../tuning/index';
import { SAMPLE_CARDS } from '../card/sampleCards';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

// ---------------------------------------------------------------------------
// Reading the tree
// ---------------------------------------------------------------------------

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (NOT_WALKED.includes(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Every file in the repository, repository-relative POSIX, sorted. */
const ALL_FILES: readonly string[] = walk(ROOT)
  .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
  .sort();

const TEXT_FILES: readonly string[] = ALL_FILES.filter(isTextFile);

function read(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8');
}

/** Replace exactly once, and fail loudly if the pattern did not match. */
function mutate(source: string, find: string, replaceWith: string): string {
  const occurrences = source.split(find).length - 1;
  expect(occurrences, `mutation target "${find}" appears ${occurrences} times`).toBe(1);
  const mutated = source.replace(find, replaceWith);
  expect(mutated, 'mutation produced no change').not.toBe(source);
  expect(mutated).toContain(replaceWith);
  return mutated;
}

// ---------------------------------------------------------------------------
// The plants, drawn from the watchlist rather than typed
// ---------------------------------------------------------------------------

function watched(kind: WatchEntry['kind']): string {
  const entry = REAL_IP_WATCHLIST.find((e) => e.kind === kind);
  if (entry === undefined) throw new Error(`realIp.test: no watchlist entry of kind ${kind}`);
  return entry.name;
}

/** A real apparel brand. Never typed out here; read from the list. */
const A_REAL_BRAND = watched('brand');
/** A real competitive lifter. Same. */
const A_REAL_ATHLETE = watched('athlete');
/** A real governing body. Same. */
const A_REAL_FEDERATION = watched('federation');

/** The shortest watched name — the one most at risk of matching inside a token. */
const SHORTEST_WATCHED = [...REAL_IP_WATCHLIST].sort((a, b) => a.name.length - b.name.length)[0];

/** A watched name with a space in it, for the "does not fire on prose" pair. */
const A_TWO_WORD_BRAND = REAL_IP_WATCHLIST.find(
  (e) => e.kind === 'brand' && e.name.includes(' '),
);

// ---------------------------------------------------------------------------
// The renderable inventory: every string a screen can draw
// ---------------------------------------------------------------------------

/**
 * WHAT COUNTS AS "CAN REACH A SCREEN".
 *
 * `TUNING` is walked whole rather than block by block, so a copy block added
 * tomorrow is scanned the day it appears rather than the day someone remembers
 * to add it here. That also pulls in `MEET_LOCAL.federation`, which is what
 * generalises `meetTuning.test.ts`'s five-name federation ban: that check tests
 * one field against five hand-typed names, this one tests every tuned string in
 * the game against the whole watchlist.
 */
function renderableInventory(entries: readonly IdentityEntry[]): readonly RenderableString[] {
  return [
    ...walkStrings('tuning', TUNING),
    ...entries.flatMap(identityStrings),
    ...walkStrings('catalogue', { BASE_ITEMS, SPONSORED_RESKINS }),
    ...SAMPLE_CARDS.flatMap((sample) => walkStrings('sample-card', sample.card, sample.id)),
  ];
}

const INVENTORY = renderableInventory(IDENTITY_ENTRIES);

// ---------------------------------------------------------------------------
// The scan can see anything at all
// ---------------------------------------------------------------------------

describe('the real-IP audit has something to audit', () => {
  it('walks the whole repository, not just src/', () => {
    // Without this, every assertion below passes vacuously on an empty list.
    expect(TEXT_FILES.length).toBeGreaterThan(60);
    for (const anchor of [
      'src/licensing/partners.ts',
      'src/card/sampleCards.ts',
      'src/game/meetTuning.ts',
      'docs/GDD.md',
      'CLAUDE.md',
      'app.json',
      'package.json',
      'public/card.html',
    ]) {
      expect(TEXT_FILES, `${anchor} is missing from the scanned set`).toContain(anchor);
    }
    expect(TEXT_FILES.some((f) => !f.startsWith('src/'))).toBe(true);
  });

  it('reaches configs, docs, markup and shell, not only TypeScript', () => {
    // §12.3 names "any asset, string, config, or code path". A scan that read
    // only `.ts` would miss a brand in app.json, in the GDD, or in an HTML
    // harness page — and two of those ship.
    for (const ext of ['.json', '.md', '.html', '.sh']) {
      expect(TEXT_FILES.some((f) => f.endsWith(ext)), `no ${ext} file scanned`).toBe(true);
    }
  });

  it('reads test files too, unlike the magic-number audit', () => {
    // `src/tuning/audit.ts` skips tests because a test is SUPPOSED to contain a
    // literal number. No test is supposed to contain a real athlete's name, and
    // §12.3 names a test fixture as one of the two ways a real mark arrives.
    expect(TEXT_FILES).toContain('src/game/dots.test.ts');
    expect(isTextFile('src/game/dots.test.ts')).toBe(true);
  });

  it('never walks into a sibling git worktree', () => {
    // Same reason `audit.test.ts` records: a worktree under `.claude/` is a
    // complete second checkout, so descending makes this audit's verdict depend
    // on what another agent has half-written.
    expect(NOT_WALKED).toContain('.claude');
    expect(ALL_FILES.every((f) => !f.startsWith('.claude/'))).toBe(true);
    expect(ALL_FILES.every((f) => !f.includes('node_modules'))).toBe(true);
  });

  it('has a renderable inventory with real strings in it', () => {
    // The default-deny half is worthless if the inventory is empty, and an empty
    // inventory is what a broken collector produces.
    expect(INVENTORY.length).toBeGreaterThan(200);
    const values = INVENTORY.map((s) => s.value);
    // A sample card's lifter name — the shape §12.3 calls "a placeholder lifter
    // name in a test fixture".
    expect(values).toContain('Marcus Vale');
    // The invented federation from the meet tuning block — the exact field
    // `meetTuning.test.ts` checks by hand against five names, reached here
    // through the whole registry and checked against the whole watchlist.
    expect(values).toContain('Northern Barbell Federation');
    // A Tier 2 name tag.
    expect(values).toContain('Ninebar Athletic');
    // A Tier 3 caption, which lives BEHIND THE SYMBOL and is only reachable
    // through `revealTier3`. If the reveal path broke, this is what would fail.
    expect(values).toContain('ILSE VONDRAK');
    // A Tier 3 alt string.
    expect(values.some((v) => v.includes('head and shoulders'))).toBe(true);
  });

  it('collects every Tier 3 slot of every entry', () => {
    // Non-vacuity on the collector that has to reach through the opaque type.
    for (const entry of IDENTITY_ENTRIES) {
      const paths = identityStrings(entry).map((s) => s.path);
      for (const slot of ['portrait', 'wordmark', 'product']) {
        expect(paths, `${entry.id} ${slot} caption`).toContain(`${entry.id}.tier3.${slot}.caption`);
        expect(paths, `${entry.id} ${slot} alt`).toContain(`${entry.id}.tier3.${slot}.alt`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The watchlist itself
// ---------------------------------------------------------------------------

describe('the watchlist', () => {
  it('is non-empty and covers all four categories', () => {
    expect(REAL_IP_WATCHLIST.length).toBeGreaterThan(30);
    for (const kind of ['brand', 'athlete', 'federation', 'meet-series'] as const) {
      expect(
        REAL_IP_WATCHLIST.some((e) => e.kind === kind),
        `no ${kind} on the watchlist`,
      ).toBe(true);
    }
  });

  it('gives every entry a reason and never repeats one', () => {
    const names = REAL_IP_WATCHLIST.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    for (const entry of REAL_IP_WATCHLIST) {
      expect(entry.note.length, `${entry.name} has no note`).toBeGreaterThan(0);
      expect(entry.name.trim()).toBe(entry.name);
    }
  });

  it('does not also claim to skip a name it watches', () => {
    // `DELIBERATELY_NOT_WATCHED` is the visible-omission list. A name on both
    // would mean the file argues with itself about whether it is checked.
    const watched = new Set(REAL_IP_WATCHLIST.map((e) => e.name));
    for (const entry of DELIBERATELY_NOT_WATCHED) {
      expect(watched.has(entry.name), `${entry.name} is on both lists`).toBe(false);
      expect(entry.note.length).toBeGreaterThan(0);
    }
    expect(DELIBERATELY_NOT_WATCHED.length).toBeGreaterThan(0);
  });

  it('matches on word boundaries, so a checksum is not a brand', () => {
    // One of the three-letter brand acronyms occurs inside a base64 integrity
    // hash in package-lock.json. Without the boundaries this audit would report
    // a dependency checksum on every run — and an audit that cries wolf on a
    // lockfile is one somebody excludes the lockfile from, after which the
    // lockfile is a hole.
    //
    // PINNED AGAINST THE REAL FILE rather than a quoted fragment, so it stays
    // true as dependencies change and so this test file never has to spell the
    // acronym out.
    const lock = read('package-lock.json');
    expect(lock.length).toBeGreaterThan(1000);
    expect(scanSourceText('package-lock.json', lock), 'lockfile false positives').toEqual([]);

    const shortest = SHORTEST_WATCHED;
    if (shortest === undefined) throw new Error('empty watchlist');
    expect(shortest.name.length).toBeLessThanOrEqual(5);
    expect(findWatchedNames(`Yf${shortest.name}8n6mm8A==`)).toEqual([]);
    // ...but the same string standing alone is found.
    expect(findWatchedNames(shortest.name).length).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    const brand = A_REAL_BRAND.toLowerCase();
    expect(findWatchedNames(brand).length).toBeGreaterThan(0);
    expect(findWatchedNames(A_REAL_BRAND.toUpperCase()).length).toBeGreaterThan(0);
  });

  it('escapes regex metacharacters in a name', () => {
    // `Halberd Grip Co.` style names carry a `.`, which is a regex wildcard.
    // An unescaped one would match `Co!` and `CoX` too.
    const dotted: WatchEntry = { name: 'Acme Co.', kind: 'brand', note: 'test' };
    expect(patternFor(dotted).test('Acme CoX')).toBe(false);
    expect(patternFor(dotted).test('Acme Co.')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// THE AUDIT BITES — a string, a data entry, a config
// ---------------------------------------------------------------------------

describe('the audit bites', () => {
  it('is clean on the unmutated inventory, so a finding is the mutation', () => {
    expect(scanRenderable(INVENTORY)).toEqual([]);
  });

  // --- (1) A STRING ---------------------------------------------------------

  it('catches a real brand in a Tier 2 name tag', () => {
    const original = IDENTITY_ENTRIES[0];
    if (original === undefined) throw new Error('no identity entries');
    const planted: IdentityEntry = {
      ...original,
      tier2: { ...original.tier2, displayName: A_REAL_BRAND },
    };
    expect(planted.tier2.displayName, 'plant did not apply').toBe(A_REAL_BRAND);
    expect(planted.tier2.displayName).not.toBe(original.tier2.displayName);

    const found = scanRenderable(renderableInventory([planted]));
    expect(found.map((f) => f.name)).toContain(A_REAL_BRAND);
    expect(found.map((f) => f.path)).toContain(`${original.id}.tier2.displayName`);
    expect(formatContentFindings(found)).toContain('licensing-entry');
  });

  it('catches a real athlete in a Tier 3 caption, behind the symbol', () => {
    // THE ONE A NAIVE WALK MISSES. Tier 3 content is opaque, so
    // `Object.entries(entry)` cannot see a caption at all. If `identityStrings`
    // ever stopped reading through `revealTier3`, this is what would fail —
    // and the licensing system's most licensed-looking surface would be the one
    // nothing was scanning.
    const original = IDENTITY_ENTRIES.find((e) => e.kind === 'athlete');
    if (original === undefined) throw new Error('no athlete entries');
    const before = tier3Of(original, 'portrait', 'shop');
    const planted: IdentityEntry = {
      ...original,
      tier3: {
        ...original.tier3,
        portrait: tier3Asset({ ...before, caption: A_REAL_ATHLETE }),
      },
    };
    expect(tier3Of(planted, 'portrait', 'shop').caption, 'plant did not apply').toBe(A_REAL_ATHLETE);
    expect(before.caption).not.toBe(A_REAL_ATHLETE);

    const found = scanRenderable(renderableInventory([planted]));
    expect(found.map((f) => f.path)).toContain(`${original.id}.tier3.portrait.caption`);
    expect(found.map((f) => f.name)).toContain(A_REAL_ATHLETE);
  });

  // --- (2) A DATA ENTRY -----------------------------------------------------

  it('catches a real athlete planted into the sample-card fixtures, as data', () => {
    const source = read('src/card/sampleCards.ts');
    const mutated = mutate(source, "name: 'Marcus Vale'", `name: '${A_REAL_ATHLETE}'`);
    const found = scanSourceText('src/card/sampleCards.ts', mutated);
    const names = found.filter((m) => m.where === 'code').map((m) => m.name);
    expect(names, formatMentions(found)).toContain(A_REAL_ATHLETE);
  });

  it('catches the same plant as RENDERABLE CONTENT, not only as source text', () => {
    // The source-text scan reports it; the default-deny scan REFUSES it. Both
    // halves are exercised on the same plant so the categories cannot quietly
    // swap places.
    const planted: RenderableString[] = [
      { surface: 'sample-card', path: 'strong.lifter.name', value: A_REAL_ATHLETE },
    ];
    const found = scanRenderable(planted);
    expect(found).toHaveLength(1);
    expect(found[0]?.kind).toBe('athlete');
  });

  it('catches a real brand planted into a tuned copy string', () => {
    // Copy is the shortest path from a source file to a player's eye.
    const found = scanRenderable([
      { surface: 'tuning', path: 'session.SESSION_COPY.CLOSE_OUT', value: `Chalk up with ${A_REAL_BRAND}.` },
    ]);
    expect(found.map((f) => f.name)).toEqual([A_REAL_BRAND]);
  });

  // --- (3) A CONFIG ---------------------------------------------------------

  it('catches a real brand planted into app.json', () => {
    const source = read('app.json');
    const mutated = mutate(source, '"name": "app"', `"name": "${A_REAL_BRAND}"`);
    const found = scanSourceText('app.json', mutated);
    expect(found.map((m) => m.name)).toContain(A_REAL_BRAND);
    // A JSON file has no comments, so a hit in one is `code` — the higher
    // severity half of the split.
    expect(found[0]?.where).toBe('code');
  });

  it('catches a real federation planted into the Expo web config', () => {
    const source = read('public/card.html');
    const mutated = mutate(source, '<title>Result card harness</title>', `<title>${A_REAL_FEDERATION} harness</title>`);
    expect(scanSourceText('public/card.html', mutated).map((m) => m.name)).toContain(A_REAL_FEDERATION);
  });

  // --- assets ---------------------------------------------------------------

  it('catches a real brand in an asset FILENAME', () => {
    // Image contents are unreadable to a text scan; filenames are not, and a
    // logo arrives as `assets/<brand>-logo.png` far more often than as a string.
    const planted = `assets/${A_REAL_BRAND.toLowerCase().replace(/\s+/g, '-')}-logo.png`;
    const found = scanFileName(planted);
    expect(found.map((m) => m.name)).toContain(A_REAL_BRAND);
    expect(scanFileName('assets/icon.png')).toEqual([]);
  });

  // --- the self-exemption ---------------------------------------------------

  it('does not exempt the watchlist file outside its watchlist regions', () => {
    // The one file allowed to spell these names is allowed to do it in three
    // named blocks and nowhere else. A name in its header comment, or in a new
    // helper, is reported like anywhere else.
    const source = read(WATCHLIST_FILE);
    const mutated = mutate(
      source,
      ' * realIp.ts — THE REAL-IP AUDIT.',
      ` * realIp.ts — THE REAL-IP AUDIT. Sponsored by ${A_REAL_BRAND}.`,
    );
    const found = scanSourceText(WATCHLIST_FILE, mutated);
    expect(found.map((m) => m.name), formatMentions(found)).toContain(A_REAL_BRAND);
  });

  it('exempts exactly one file and exactly three of its regions', () => {
    expect(WATCHLIST_FILE).toBe('src/licensing/realIp.ts');
    expect([...WATCHLIST_REGIONS].sort()).toEqual([
      'DELIBERATELY_NOT_WATCHED',
      'REAL_IP_WATCHLIST',
      'REVIEWABLE_CITATIONS',
    ]);
    // ...and those regions really are in that file, so the exemption cannot
    // outlive the blocks it was opened for.
    const source = read(WATCHLIST_FILE);
    for (const region of WATCHLIST_REGIONS) {
      expect(source, `${region} is exempt but not declared`).toContain(`export const ${region}`);
    }
  });

  it('reports the file, the line and the name, so a failure is actionable', () => {
    const found = scanSourceText('src/fake.ts', `// a comment\nconst x = '${A_REAL_ATHLETE}';\n`);
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(2);
    expect(found[0]?.where).toBe('code');
    expect(formatMentions(found)).toContain('src/fake.ts:2');
  });

  it('tells a comment apart from a string on the same line', () => {
    // The whole category split rests on this. It reuses `withoutComments` from
    // `src/tuning/audit.ts`, which preserves offsets and is checked against
    // every file in the tree on every run.
    const inComment = scanSourceText('src/fake.ts', `const x = 1; // cites ${A_REAL_FEDERATION}\n`);
    expect(inComment.map((m) => m.where)).toEqual(['comment']);
    const inCode = scanSourceText('src/fake.ts', `const x = '${A_REAL_FEDERATION}'; // nothing here\n`);
    expect(inCode.map((m) => m.where)).toEqual(['code']);
    const inProse = scanSourceText('docs/fake.md', `We considered ${A_REAL_FEDERATION}.\n`);
    expect(inProse.map((m) => m.where)).toEqual(['prose']);
  });
});

// ---------------------------------------------------------------------------
// ...AND IT IS NOT A SIEVE
// ---------------------------------------------------------------------------

describe('the audit is not a sieve', () => {
  it('passes the fictional catalogue', () => {
    // Every name in `partners.ts` was searched by hand before it was typed, and
    // one candidate was rejected at that step. This is the machine half.
    for (const entry of IDENTITY_ENTRIES) {
      expect(findWatchedNames(entry.tier2.displayName), entry.id).toEqual([]);
      expect(findWatchedNames(entry.tier2.shortName), entry.id).toEqual([]);
      expect(findWatchedNames(entry.id), entry.id).toEqual([]);
    }
  });

  it('does not fire on ordinary prose that contains a brandish word', () => {
    // Multi-word entries exist precisely so this stays true: a check that fires
    // on English gets suppressed, and a suppressed check is worse than none.
    expect(findWatchedNames('a rogue value slipped through')).toEqual([]);
    expect(findWatchedNames('the titan of the platform')).toEqual([]);
    expect(findWatchedNames('a monster of a third attempt')).toEqual([]);
    expect(findWatchedNames('a ghost total on the board')).toEqual([]);
    // ...and the paired direction, because a check that refuses everything
    // satisfies "does not fire on prose" perfectly and is worth nothing: the
    // FULL two-word brand inside the same kind of sentence IS found.
    const twoWord = A_TWO_WORD_BRAND;
    if (twoWord === undefined) throw new Error('no multi-word brand on the watchlist');
    expect(findWatchedNames(`a shipment of ${twoWord.name} arrived late`).length).toBeGreaterThan(0);
  });

  it('does not fire on the fictional federations already in the tree', () => {
    expect(findWatchedNames('Irongate')).toEqual([]);
    expect(findWatchedNames('Continental Alliance')).toEqual([]);
  });

  it('does not fire on a real town that is not a meet series', () => {
    // `sampleCards.ts` sets meets in Sheffield, which is a city. Only the meet
    // SERIES is watched, and watching the bare city name would refuse a
    // perfectly ordinary invented meet.
    expect(findWatchedNames('Sheffield')).toEqual([]);
    expect(findWatchedNames('Newcastle upon Tyne')).toEqual([]);
  });

  it('leaves the formula eponyms alone', () => {
    for (const entry of DELIBERATELY_NOT_WATCHED) {
      expect(findWatchedNames(entry.name), entry.name).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// (A) IDENTITY AS CONTENT — default deny, no pin, no exceptions
// ---------------------------------------------------------------------------

describe('no real identity reaches a surface', () => {
  it('finds nothing in any string the game can draw', () => {
    const findings = scanRenderable(INVENTORY);
    expect(findings.length, `\n${formatContentFindings(findings)}\n`).toBe(0);
  });

  it('finds nothing in the NAME of any file that ships', () => {
    // `assets/`, `public/` and `src/` are what gets bundled. A logo pasted into
    // a PNG is invisible to a text scan; a logo pasted into a PNG somebody named
    // after the brand is not, and that is how it actually arrives.
    //
    // Names OUTSIDE those roots are category (B) and pinned instead — see the
    // `filename` rows in the citation list, which today are the downloaded
    // reference photographs in `docs/reference/`, named after their subject.
    const shipped = ALL_FILES.filter(isShippedPath);
    expect(shipped.length).toBeGreaterThan(40);
    const findings = shipped.flatMap((f) => scanFileName(f));
    expect(findings.length, `\n${formatMentions(findings)}\n`).toBe(0);
  });

  it('finds no watchlist name anywhere in the licensing catalogue', () => {
    // The narrower, sharper version of the first assertion: whatever else is in
    // the tree, the thing a partner would be ADDED TO is clean.
    const catalogue = [
      ...IDENTITY_ENTRIES.flatMap(identityStrings),
      ...walkStrings('catalogue', { BASE_ITEMS, SPONSORED_RESKINS }),
    ];
    expect(scanRenderable(catalogue)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (B) DOCUMENTED REFERENCE — listed, pinned, reviewable
// ---------------------------------------------------------------------------

describe('the reviewable citation list', () => {
  const MENTIONS = [
    ...TEXT_FILES.flatMap((relPath) => scanSourceText(relPath, read(relPath))),
    // Filenames outside the shipped roots. The ones INSIDE them are refused
    // outright above; these are research material named after its subject, and
    // they get a human's eye rather than a deletion.
    ...ALL_FILES.filter((f) => !isShippedPath(f)).flatMap((f) => scanFileName(f)),
  ];
  const INVENTORY_ROWS = citationInventory(MENTIONS);

  it('is exactly the list in realIp.ts — a new mention is a human decision', () => {
    // BOTH DIRECTIONS ON PURPOSE. A new mention fails until somebody rules on
    // it; a REMOVED one fails too, because deleting a provenance citation is the
    // cheapest way to make this green and the most expensive way to fail the
    // codebase.
    expect(
      INVENTORY_ROWS,
      `\nPaste this into REVIEWABLE_CITATIONS, then read every changed line:\n\n${formatCitations(
        INVENTORY_ROWS,
      )}\n\nWith locations:\n${formatMentions(MENTIONS)}\n`,
    ).toEqual([...REVIEWABLE_CITATIONS]);
  });

  it('is not vacuous — the baseline citations are still found', () => {
    // If the scan stopped matching, the list would go empty and the assertion
    // above would still pass against an emptied pin. This is what fails then.
    expect(INVENTORY_ROWS.length).toBeGreaterThan(20);
    expect(MENTIONS.length).toBeGreaterThan(30);
    expect(INVENTORY_ROWS.some((r) => r.where === 'comment')).toBe(true);
    expect(INVENTORY_ROWS.some((r) => r.where === 'code')).toBe(true);
    expect(INVENTORY_ROWS.some((r) => r.where === 'prose')).toBe(true);
    expect(INVENTORY_ROWS.some((r) => r.file === 'src/game/dots.test.ts')).toBe(true);
  });

  it('keeps the published-record provenance the tests depend on', () => {
    // Named individually, because these are the entries a future round is most
    // likely to "clean up" — and doing so would make the DOTS plausibility test
    // and the result-card format test unverifiable against their sources, which
    // is the practice CLAUDE.md demands elsewhere.
    const dots = INVENTORY_ROWS.filter((r) => r.file === 'src/game/dots.test.ts');
    expect(dots.length).toBeGreaterThan(0);
    expect(dots.every((r) => r.where === 'comment')).toBe(true);
    const card = INVENTORY_ROWS.filter((r) => r.file === 'src/game/resultCard.test.ts');
    expect(card.length).toBeGreaterThan(0);
  });

  it('separates the comment citations from the code ones', () => {
    // The lead's ruling, made checkable: a name in a comment is provenance; a
    // name in code or a string is one edit from a screen and gets a human's eye
    // for that reason. `audit.ts` holds federation names inside `why:` strings,
    // which is why the `code` bucket is not empty and should not be.
    const code = INVENTORY_ROWS.filter((r) => r.where === 'code');
    expect(code.some((r) => r.file === 'src/tuning/audit.ts')).toBe(true);
    expect(code.some((r) => r.file === 'src/game/meetTuning.test.ts')).toBe(true);
  });

  it('lists only files that exist', () => {
    // ALL_FILES, not TEXT_FILES: a `filename` row names a binary the scan
    // cannot read, which is the whole reason that category exists.
    for (const row of REVIEWABLE_CITATIONS) {
      expect(ALL_FILES, `${row.file} is pinned but not in the tree`).toContain(row.file);
      expect(row.count).toBeGreaterThan(0);
    }
  });

  it('carries a filename row, so the binary half is not silently empty', () => {
    // The only check in this module that reaches a file it cannot read. If the
    // filename scan stopped running, this and the shipped-roots refusal above
    // would both go quiet — one by having nothing to list, the other by having
    // nothing to refuse.
    expect(INVENTORY_ROWS.some((r) => r.where === 'filename')).toBe(true);
  });
});
