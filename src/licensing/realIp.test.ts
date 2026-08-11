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

/**
 * Read one repository file, memoised.
 *
 * Memoised because this suite now reads the whole tree more than once — the
 * citation inventory walks it, and so does the check that every name on
 * `DELIBERATELY_NOT_WATCHED` is really in here. Strings are immutable, so the
 * mutation helpers below cannot poison the cache by editing what they are given.
 */
const FILE_CACHE = new Map<string, string>();
function read(relPath: string): string {
  const cached = FILE_CACHE.get(relPath);
  if (cached !== undefined) return cached;
  const text = readFileSync(path.join(ROOT, relPath), 'utf8');
  FILE_CACHE.set(relPath, text);
  return text;
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

/**
 * A real open-source project or software platform. The category the first draft
 * of the watchlist had no slot for, which is why it is drawn out separately: the
 * URL tests below are about how THESE names arrive, and a plant drawn from
 * `kind: 'brand'` would have proved nothing about them.
 */
const A_REAL_PROJECT = watched('project');

/**
 * The one watched name that is a DOMAIN rather than a word, and the reason it is
 * one. Its bare form is also this codebase's own term for a passed attempt, so
 * the entry carries the dotted suffix deliberately. Found by shape rather than
 * spelled, like every other plant here.
 */
const A_WATCHED_DOMAIN = REAL_IP_WATCHLIST.find(
  (e) => e.kind === 'project' && e.name.includes('.'),
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
    // `app.json` is CONTENT, not just config. `expo.name` is the string under
    // the icon on a phone's home screen and `expo.slug` goes into a store URL —
    // both are as renderable as anything in a copy block, and neither is
    // reachable from `TUNING`. Added after a mutation run showed a real brand
    // planted there was only caught by the LISTED half; a name on a home screen
    // belongs in the half that refuses outright.
    ...walkStrings('app-config', JSON.parse(read('app.json')) as unknown),
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
    expect(values).toContain('Cragmoor Barbell Federation');
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
  it('is non-empty and covers all six categories', () => {
    expect(REAL_IP_WATCHLIST.length).toBeGreaterThan(30);
    // `project` and `game-industry` were added last, after the list was found to
    // be blind twice over: to the open-results project and meet software this
    // repository cites more than anything else, and to the console, franchise
    // and character marks a 16-bit art project reaches for whenever it argues
    // about era. Named in this loop rather than left to a general "every kind is
    // used" check so that deleting a category fails HERE, with its name in the
    // message.
    for (const kind of [
      'brand',
      'athlete',
      'federation',
      'meet-series',
      'project',
      'game-industry',
    ] as const) {
      expect(
        REAL_IP_WATCHLIST.some((e) => e.kind === kind),
        `no ${kind} on the watchlist`,
      ).toBe(true);
    }
  });

  it('finds a project name inside a URL — host, path segment and slug', () => {
    // A URL IS HOW A NAME MOST OFTEN SURVIVES A TEXT SCAN, and every mention of
    // this category in the tree arrived as one. Nothing here parses URLs; what
    // makes it work is that `patternFor`'s word edges are alphanumeric-only, so
    // `/`, `.` and `-` are all boundaries. That is a property worth pinning
    // rather than assuming, because tightening the edges to `\b`-like rules or
    // to whitespace would silently un-catch all three of these.
    const forms = [
      `https://www.${A_REAL_PROJECT.toLowerCase()}.org/`,
      `https://gitlab.com/${A_REAL_PROJECT.toLowerCase()}/data/-/raw/main/x.csv`,
      `see ${A_REAL_PROJECT}-derived formats`,
      `(${A_REAL_PROJECT}),`,
    ];
    for (const form of forms) {
      expect(findWatchedNames(form).map((h) => h.name), form).toContain(A_REAL_PROJECT);
    }
    // ...and the paired direction: glued to a letter it is a different token and
    // is NOT a mention, which is what keeps the lockfile quiet.
    expect(findWatchedNames(`x${A_REAL_PROJECT}`)).toEqual([]);
    expect(findWatchedNames(`${A_REAL_PROJECT}x`)).toEqual([]);
  });

  it('watches a platform by its DOMAIN, and that entry cannot fire on our verdict term', () => {
    // THE ONE ENTRY THAT IS DELIBERATELY NARROWER THAN THE NAME IT WATCHES, and
    // the reason is worth pinning because it is easy to "fix" by widening.
    //
    // The bare word is a real federation results platform. It is also, as two
    // words and as a camel-cased identifier, this codebase's own term for a
    // passed attempt — `isGoodLift`, `heaviestGoodLift`, their call sites in
    // meet.ts, meetDay.ts and renderResultCard.ts. Word boundaries mean the bare
    // form would not fire on THOSE (a letter precedes it in each), so the real
    // arithmetic is: the bare form matches nothing in the tree today, and the
    // first `const goodLift = ...` anybody writes would put a false positive on
    // the game's own vocabulary. Dead now, noisy later. The domain form is what
    // is actually cited and it can be neither.
    const domain = A_WATCHED_DOMAIN;
    if (domain === undefined) throw new Error('no dotted project entry on the watchlist');
    expect(findWatchedNames(domain.name).length).toBeGreaterThan(0);

    const bare = domain.name.slice(0, domain.name.indexOf('.'));
    expect(bare.length).toBeGreaterThan(3);
    // The narrowing, stated as an assertion rather than as a comment: the bare
    // word is NOT watched, so nobody has to wonder whether it was meant to be.
    expect(findWatchedNames(bare)).toEqual([]);
    // ...and neither identifier form is a mention, whichever way the entry is
    // later rewritten.
    expect(findWatchedNames(`export function is${bare}(lights: JudgePanel): boolean {`)).toEqual([]);
    expect(findWatchedNames(`expect(heaviest${bare}(CARD)).toBeNull();`)).toEqual([]);
  });

  it('has no dead entry in the two derived categories', () => {
    // The rest of the list is PREVENTIVE — a famous brand nobody has typed yet is
    // exactly what it is for, and an entry that never fires is correct there. The
    // `project` and `game-industry` blocks are different by construction: both
    // were built by asking what this repository ACTUALLY CITES, so an entry that
    // fires on nothing is an entry somebody padded the list with, and a watchlist
    // row that can never fire is its own kind of dead check.
    const pinned = new Set(REVIEWABLE_CITATIONS.map((r) => r.name));
    const derived = REAL_IP_WATCHLIST.filter(
      (e) => e.kind === 'project' || e.kind === 'game-industry',
    );
    expect(derived.length).toBeGreaterThan(8);
    for (const entry of derived) {
      expect(pinned.has(entry.name), `${entry.name} is watched but cites nothing`).toBe(true);
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

  it('lists as deliberately-unwatched only names that are really in this tree', () => {
    // THE OMISSION LIST HAS TO BE A LIST OF RULINGS, NOT OF GUESSES.
    //
    // Its whole value is that a reader can see which real names were found and
    // waved through. A name nobody ever typed into this repository looks exactly
    // like a name that was considered and cleared, and padding it that way makes
    // the list read as more thorough than the sweep behind it actually was. So
    // each entry has to point at something: this fails if one stops appearing,
    // and the fix is to delete the row, not to widen the search.
    //
    // It is also the guard on the other side of the `project` additions. Those
    // were chosen by asking what the tree cites; this asks the same question of
    // everything the same sweep decided NOT to watch.
    //
    // THE WATCHLIST FILE IS EXCLUDED FROM THE SEARCH, and that exclusion is the
    // only thing that makes this test worth running: every one of these names is
    // spelled in `DELIBERATELY_NOT_WATCHED` itself, so searching the whole tree
    // would find each entry in its own declaration and pass on anything.
    const elsewhere = TEXT_FILES.filter((f) => f !== WATCHLIST_FILE);
    expect(elsewhere.length).toBe(TEXT_FILES.length - 1);
    for (const entry of DELIBERATELY_NOT_WATCHED) {
      const found = elsewhere.some(
        (relPath) => findWatchedNames(read(relPath), [entry]).length > 0,
      );
      expect(
        found,
        `${entry.name} is listed as deliberately not watched but appears nowhere in the tree — delete the row`,
      ).toBe(true);
    }
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

  it('catches a real brand planted into app.json, in BOTH halves', () => {
    const source = read('app.json');
    const mutated = mutate(source, '"name": "app"', `"name": "${A_REAL_BRAND}"`);

    // (B) the listed half: a JSON file has no comments, so a hit in one is
    // `code` — the higher-severity position, and unpinned, so the suite reds.
    const mentions = scanSourceText('app.json', mutated);
    expect(mentions.map((m) => m.name)).toContain(A_REAL_BRAND);
    expect(mentions[0]?.where).toBe('code');

    // (A) the default-deny half. `expo.name` is the string under the icon on a
    // phone's home screen, so it is content and gets refused rather than
    // listed. This assertion is why `app.json` is in `renderableInventory`.
    const config = scanRenderable(
      walkStrings('app-config', JSON.parse(mutated) as unknown),
    );
    expect(config.map((f) => f.name)).toContain(A_REAL_BRAND);
    expect(config.map((f) => f.path)).toContain('expo.name');
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

  it('does not exempt the watchlist file for the NEWLY watched names either', () => {
    // Adding names to `REAL_IP_WATCHLIST` puts new real names into the one file
    // that is allowed to hold them, which is exactly the move that could widen
    // the self-exemption without anybody noticing — the block grew, so more of
    // the file is exempt. The exemption is by DECLARATION REGION rather than by
    // file, so growing the list cannot spill: this plants a project name in the
    // header, where the argument for the whole exemption is written, and it is
    // still reported.
    const source = read(WATCHLIST_FILE);
    const mutated = mutate(
      source,
      ' * PURE MODULE: zero React imports, zero I/O, zero side effects.',
      ` * Provenance: ${A_REAL_PROJECT}. PURE MODULE: zero React imports, zero I/O, zero side effects.`,
    );
    const found = scanSourceText(WATCHLIST_FILE, mutated);
    expect(found.map((m) => m.name), formatMentions(found)).toContain(A_REAL_PROJECT);
    expect(found.map((m) => m.where)).toContain('comment');
  });

  it('exempts each region only as far as its own closing bracket', () => {
    // THE HOLE THIS CLOSED, pinned so it cannot reopen.
    //
    // `declarationRegions` runs a declaration up to the NEXT declaration, so the
    // region named after the watchlist used to include the doc comment
    // introducing the block below it — twenty-odd lines of ordinary prose,
    // inside an exempt window, growing every time somebody wrote a longer
    // paragraph. Nothing was hiding in there. The point is that nothing COULD
    // have been found if it were.
    //
    // The plant goes in the sentence that introduces the second block, which is
    // after the first block's closing bracket and before the second block's
    // `export const`: exempt under the old rule, reported under the new one.
    const source = read(WATCHLIST_FILE);
    const mutated = mutate(
      source,
      ' * An omission from a denylist is invisible; this makes these ones visible.',
      ` * An omission from a denylist is invisible; unlike ${A_REAL_BRAND}. `,
    );
    const found = scanSourceText(WATCHLIST_FILE, mutated);
    expect(found.map((m) => m.name), formatMentions(found)).toContain(A_REAL_BRAND);

    // ...and the paired direction, without which the assertion above would also
    // pass if the exemption had stopped working altogether: the real file, with
    // dozens of watched names inside the three literals, still reports nothing.
    expect(scanSourceText(WATCHLIST_FILE, source)).toEqual([]);
  });

  it('leaves the watchlist file with no pinned citations of its own', () => {
    // THE SHARPEST STATEMENT OF THE SELF-SCAN, and the reason this module's prose
    // describes real names instead of spelling them ("a three-letter brand
    // acronym", "the open-results project"). If one leaked out of the three
    // exempt blocks — into the header, a helper, a group description — it would
    // become a mention, the mention would become a row, and the pin above would
    // go red. So this file having ZERO rows is not a coincidence to be preserved
    // by care; it is the invariant the pin enforces, and stating it here means a
    // reader does not have to infer it from an absence.
    expect(REVIEWABLE_CITATIONS.filter((r) => r.file === WATCHLIST_FILE)).toEqual([]);
    const live = scanSourceText(WATCHLIST_FILE, read(WATCHLIST_FILE));
    expect(live, formatMentions(live)).toEqual([]);
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
      [
        '',
        'THE REAL-NAME INVENTORY CHANGED.',
        '',
        'If a row was ADDED: read it. A real athlete, brand or federation name is',
        'now somewhere it was not. If it is a published-record citation, keep it and',
        'paste the block below. If it is anything else, delete the name instead.',
        '',
        'If a row was REMOVED: a citation went away. That is fine after a deliberate',
        'edit and is a problem if nobody meant it — deleting provenance is the',
        'cheapest way to make this test green and the most expensive way to fail the',
        'codebase.',
        '',
        'IF THIS FIRED ON A MERGE and you did not touch the file named, it is the',
        'other branch: this list is computed from the whole tree, so another',
        "builder's edit to a comment moves it. Paste the block and read the diff.",
        '',
        formatCitations(INVENTORY_ROWS),
        '',
        'With locations:',
        formatMentions(MENTIONS),
        '',
      ].join('\n'),
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

  it('counts the open-source project citations, which is what it used to miss', () => {
    // THE REGRESSION GUARD FOR THE HOLE THIS BLOCK EXISTS BECAUSE OF.
    //
    // Before the `project` category, this inventory ran green while more than a
    // hundred mentions of a real organisation sat in the tree unseen, across the
    // result-card modules, the DOTS module, the meet module and a view. The pin
    // above now covers them exactly. This is the FLOOR underneath the pin: it
    // fails if somebody regenerates the block after deleting the category, which
    // is the one edit that would make the pin agree with a blind scan again.
    //
    // A floor rather than an exact number on purpose — the exact number is the
    // pin's job, and duplicating it here would mean two places to update on
    // every unrelated comment edit.
    const projectNames = new Set(
      REAL_IP_WATCHLIST.filter((e) => e.kind === 'project').map((e) => e.name),
    );
    const rows = INVENTORY_ROWS.filter((r) => projectNames.has(r.name));
    const mentions = rows.reduce((sum, r) => sum + r.count, 0);
    const files = new Set(rows.map((r) => r.file));
    expect(rows.length, 'project citations vanished from the inventory').toBeGreaterThan(20);
    expect(mentions).toBeGreaterThan(80);
    expect(files.size).toBeGreaterThan(10);
    // ...and almost all of them are provenance rather than content: comments and
    // one line of the design document. The exceptions are pinned BY FILE — the
    // names stay out of this file, per the header — because a real
    // organisation's name at `code` position is one edit from a screen, and a
    // new file appearing in this list is the event worth a human's eye.
    const codeFiles = [...new Set(rows.filter((r) => r.where === 'code').map((r) => r.file))].sort();
    expect(codeFiles, 'a project name moved into code position in a new file').toEqual([
      // The last bespoke real-IP ban in the tree; its names are its own operands.
      'src/art/gymScene.test.ts',
      // Identifiers naming the export format a meet fixture is checked against.
      'src/game/meet.test.ts',
      // `CHART_SOURCES` — retrieval URLs in `url:` fields rather than comments,
      // which is `code` position by this module's rule and the reason the RPE
      // transcription sources are worth a human's eye rather than a shrug: a
      // string is one edit from a screen, even a string nothing renders today.
      'src/game/rpe.test.ts',
      'src/game/rpe.ts',
    ]);
    expect(rows.filter((r) => r.where === 'prose').map((r) => r.file)).toEqual(['docs/GDD.md']);
  });

  it('counts the game-industry citations, the second blind spot of the same shape', () => {
    // FOUND INDEPENDENTLY, BY A CRITIC GRADING THE FIGURE RIG RATHER THAN BY
    // THIS MODULE, and that is the part worth keeping: one miss is an oversight,
    // two of the same shape is a property of how the list was built. Both
    // categories are things this repository CITES — a results database, a
    // console's colour depth, how tall a fighting-game lead stood — rather than
    // things a builder might invent a fake version of, and the original four
    // kinds were chosen entirely from the second question.
    //
    // A floor, for the same reason as the project group above: the exact numbers
    // are the pin's job.
    const eraNames = new Set(
      REAL_IP_WATCHLIST.filter((e) => e.kind === 'game-industry').map((e) => e.name),
    );
    const rows = INVENTORY_ROWS.filter((r) => eraNames.has(r.name));
    const mentions = rows.reduce((sum, r) => sum + r.count, 0);
    expect(rows.length, 'game-industry citations vanished from the inventory').toBeGreaterThan(15);
    expect(mentions).toBeGreaterThan(45);
    expect(new Set(rows.map((r) => r.file)).size).toBeGreaterThan(10);

    // The `code` positions are pinned by file, names kept out of this file. All
    // three are art modules whose named constants encode an era measurement, so
    // the mark is in an identifier rather than in a comment.
    const codeFiles = [...new Set(rows.filter((r) => r.where === 'code').map((r) => r.file))].sort();
    expect(codeFiles, 'an era mark moved into code position in a new file').toEqual([
      'src/art/craftMetrics.test.ts',
      'src/art/craftMetrics.ts',
      'src/art/lifterSprite.test.ts',
    ]);

    // AND THE ONE THIS AUDIT CANNOT READ. A committed reference image is named
    // after the console whose craft it is there to demonstrate, so the filename
    // scan catches it; the PIXELS of the other reference image carry a real
    // league's logo and a currently-competing player's likeness, and no text
    // scan will ever see those. Pinned here so the residual has a test next to
    // it rather than only a paragraph in the header.
    expect(rows.some((r) => r.where === 'filename')).toBe(true);
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
    // `gymScene.test.ts` is the remaining bespoke real-IP ban, and its names sit
    // in `code` position because they are the check's own operands. It used to
    // be `meetTuning.test.ts` here as well; that ban was retired by its owner,
    // exactly as this module's header asked for, so naming it now would pin a
    // file to a citation it is supposed to have stopped having.
    expect(code.some((r) => r.file === 'src/art/gymScene.test.ts')).toBe(true);
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
