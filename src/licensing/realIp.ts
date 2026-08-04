/**
 * realIp.ts — THE REAL-IP AUDIT.
 *
 * GDD §12.3, the refusal condition this file enforces:
 *
 *   > **Any real, named athlete, brand, or company identity** — name, logo,
 *   > likeness, or wordmark — hardcoded into any asset, string, config, or code
 *   > path (§7.3, §8.1)
 *
 * and the two properties §12.3 gives for why it is checked constantly rather
 * than once: it is LEGAL EXPOSURE rather than taste, and it ARRIVES BY ACCIDENT
 * — "a 'realistic' placeholder name a builder reached for because a real one was
 * the first thing that came to mind".
 *
 * An audit nobody invokes is worth nothing, so this one is not a script. It runs
 * inside `npx vitest run` from `realIp.test.ts`, over the whole repository
 * — source, strings, config, data files, docs and asset filenames — and it turns
 * the suite red. Same shape as `src/tuning/audit.ts`, deliberately: that piece
 * established the pattern and a second idiom for "scan the tree and fail" would
 * be a second thing to keep working.
 *
 * PURE MODULE: zero React imports, zero I/O, zero side effects. The caller
 * supplies paths and contents; `realIp.test.ts` reads disk.
 *
 * ===========================================================================
 * 1. WHY THERE ARE REAL BRAND NAMES IN THIS FILE, AND WHY THAT IS NOT THE
 *    THING §12.3 FORBIDS
 * ===========================================================================
 *
 * `REAL_IP_WATCHLIST` below contains real company and athlete names. That is
 * unavoidable — a denylist has to name what it denies — and it deserves the
 * argument rather than a shrug, because at a glance it looks like the exact
 * thing this file exists to prevent.
 *
 * §12.3 forbids a real identity "hardcoded into any asset, string, config, or
 * code path". The operative word is what the name IS THERE TO DO. Every name
 * here exists to be REFUSED:
 *
 *   - It is never rendered. `scanRenderable` walks the strings a screen can
 *     draw, and `realIp.test.ts` asserts none of them contains a watchlist name
 *     — including, specifically, that no watchlist name reaches the licensing
 *     catalogue.
 *   - It never populates the licensing system. `partners.ts` does not import
 *     this module, and `NO_ENTRY_MATCHES_THE_WATCHLIST` is a test over the real
 *     catalogue rather than a convention.
 *   - It is not an asset. There is no image, no font, no manifest.
 *
 * The house precedent is already there: `meetTuning.test.ts` bans five real
 * federation names from the invented federation by spelling all five out, and
 * `progression.ts`'s `PERFORMANCE_FACT_VOCABULARY` is a blocklist of words a
 * fact may not be named. This is the same instrument one category over.
 *
 * AND IT IS HELD TO ONE REGION OF ONE FILE. Nothing else here spells a watched
 * name — not this header, not the tests, not the pinned list's prose — and the
 * scan enforces that on itself: `WATCHLIST_FILE` plus `WATCHLIST_REGIONS` is the
 * only exemption, and `realIp.test.ts` plants a real brand in this very comment
 * and asserts it is reported. Everything below that would naturally have quoted
 * a real acronym describes it instead ("a three-letter brand acronym"), which
 * reads slightly worse and keeps the count at one place.
 *
 * THE ALTERNATIVE WAS CONSIDERED AND IS WORSE. Hashing or encoding the list
 * would remove the names from the file and remove a human's ability to review
 * what is on it — and a watchlist nobody can read is a watchlist nobody can
 * correct, on the one check in this codebase whose failure cannot be patched
 * after release.
 *
 * The residual is stated plainly in §5.
 *
 * ===========================================================================
 * 2. TWO CATEGORIES, AND THE LINE BETWEEN THEM IS "CAN IT REACH A SCREEN"
 * ===========================================================================
 *
 * A baseline scan of this repository found real names already present, and they
 * were all one kind: VERIFICATION PROVENANCE. `dots.test.ts` cites a published
 * all-time total to anchor a plausibility test; `resultCard.test.ts` transcribes
 * real federation CSV rows to prove the export format matches. Those citations
 * are the practice CLAUDE.md demands elsewhere — "use the published
 * coefficients; do not homebrew" — and deleting them would make those tests'
 * provenance unverifiable.
 *
 * So the audit splits, and the split is by WHAT THE STRING CAN DO, not by which
 * file it is in:
 *
 *   (A) IDENTITY AS CONTENT — `scanRenderable`. A value that can reach a
 *       screen, ship in an asset, or populate the licensing system. DEFAULT
 *       DENY. There is no allowlist and no pin; a finding here fails the suite
 *       and the only fix is to remove the name. This is the category §12.3 is
 *       actually about.
 *
 *   (B) DOCUMENTED REFERENCE — `scanSourceText`. A mention in the source text
 *       of the repository: a comment, a doc block, a test title, an identifier,
 *       a markdown paragraph. LISTED, not silently allowed and not silently
 *       deleted. Every one is pinned in `REVIEWABLE_CITATIONS` below with its
 *       file, its name and where in the file it sits, so a NEW mention fails the
 *       suite until a human looks at it and either removes it or writes it into
 *       the list. A human rules; the machine makes sure the ruling happens.
 *
 * The two are not the same strength and should not be described as if they
 * were. (A) is a prohibition. (B) is a tripwire on a reviewed inventory.
 *
 * ===========================================================================
 * 3. THE FEDERATION RULING
 * ===========================================================================
 *
 * Federation names are the messy case and the reason this file has a ruling
 * section at all. The five acronyms in the `federation` block of the watchlist
 * are real organisations, and they already appear across `meet.ts`,
 * `resultCard.ts`, `sampleCards.ts`, `plates.ts`, `palette.ts`, the
 * magic-number audit's own rationale strings and the GDD. They are not all the
 * same thing, and treating them as one category produces either a suite that
 * cannot go green or a check that means nothing.
 *
 * THE RULING, applied by the code below:
 *
 *   STRUCTURAL REFERENCE — LEGITIMATE. Naming the body that publishes a rule
 *   being implemented: the meet structure a `why:` string attributes, the
 *   rulebook `plates.ts` says it could not download, the plate-colour ladder
 *   `meetPalette.ts` sources. CLAUDE.md's domain-correctness section REQUIRES
 *   this — meet structure, plate ladder and weight classes have to be the real
 *   sport's, and a citation with its source struck out is not a citation. These
 *   land in category (B) and are pinned.
 *
 *   IDENTITY AS CONTENT — NOT LEGITIMATE. A federation name a player SEES: the
 *   `federation` field of a meet, the masthead of a result card, a shop entry, a
 *   sprite decal. Those are (A), default-denied — and they are already fictional
 *   in this tree, which is why (A) is green today rather than being green
 *   because it looks at nothing.
 *
 * THE TEST OF THE RULING IS THAT IT IS NOT A FILE-BY-FILE PARDON. The same
 * acronym is category (B) in `meet.ts`'s header and would be category (A) if it
 * were assigned to `MEET_LOCAL.federation` in the same file. What decides is
 * whether a screen can draw it.
 *
 * `meetTuning.test.ts` already bans five real federation names from
 * `MEET_LOCAL.federation`, unprompted, citing §11. This module GENERALISES that
 * check rather than duplicating it: `MEET_LOCAL` is pulled into the renderable
 * inventory in `realIp.test.ts` through the whole `TUNING` registry, and scanned
 * against the entire watchlist rather than five hand-typed names — as is every
 * other tuned string in the game. The bespoke check there is now a special case
 * of this one and could be deleted by whoever owns that file; it is not deleted
 * here because `src/game/meetTuning.ts` and its test belong to another builder
 * in this run.
 *
 * ===========================================================================
 * 4. WHAT IS DELIBERATELY NOT WATCHED
 * ===========================================================================
 *
 * `DELIBERATELY_NOT_WATCHED` is the list of real people's names this audit does
 * NOT look for, with the reason. It exists because an omission from a denylist
 * is invisible, and an invisible omission is how a denylist quietly stops
 * covering the thing everyone assumed it covered.
 *
 * All of them are FORMULA EPONYMS that CLAUDE.md's domain-correctness section
 * requires by name. `Epley` is mandated — "Epley, and only Epley" — and
 * `Brzycki` is mandated by its PROHIBITION, which cannot be written without
 * writing the name. A person whose surname is attached to a published formula
 * is not a licensable identity in the sense §12.3 means; there is no agreement
 * to sign and no mark to infringe, and watching them would bury the reviewable
 * list under dozens of entries that can never be actioned.
 *
 * ===========================================================================
 * 5. WHAT THIS DOES NOT CLOSE — stated plainly, because an audit that
 *    overstates its coverage is worse than no audit
 * ===========================================================================
 *
 *  - A WATCHLIST IS A FLOOR, NOT A NET. It catches the names somebody thought
 *    of. A real brand nobody listed sails through, and there is no version of
 *    this check that does not have that property. `progression.ts` says the same
 *    thing about `PERFORMANCE_FACT_VOCABULARY` and it is just as true here.
 *    What the list buys is the §12.3 ACCIDENT — the first real name that comes
 *    to mind is, by construction, a famous one.
 *  - IT READS TEXT. A real logo drawn pixel by pixel into `partners.ts`, or
 *    pasted into a PNG under `assets/`, is invisible to it. Filenames are
 *    scanned; image contents are not.
 *  - CASE AND SPELLING. Matching is case-insensitive with word boundaries, so a
 *    lower-cased brand is caught and a digit-substituted one is not. Deliberate
 *    obfuscation defeats it.
 *  - THE PINNED LIST IS A JUDGEMENT SOMEBODY MADE. Category (B) is only worth
 *    something if a human actually reads `REVIEWABLE_CITATIONS` when it changes.
 *    The machine can force the reading to happen; it cannot do the reading.
 *  - IT CANNOT SEE INTENT. A fictional name that happens to be a small real
 *    company's is exactly as invisible to this as it was to the person who typed
 *    it. Every name in `partners.ts` was searched by hand for that reason, and
 *    one candidate was rejected at that step.
 */

import { codeOnly, declarationRegions, withoutComments } from '../tuning/audit';
import type { IdentityEntry } from './tiers';
import { TIER_3_SLOTS, tier3Of } from './tiers';

// ---------------------------------------------------------------------------
// The watchlist
// ---------------------------------------------------------------------------

export type WatchKind = 'brand' | 'athlete' | 'federation' | 'meet-series';

export interface WatchEntry {
  /** The literal to look for. Matched case-insensitively, on word boundaries. */
  readonly name: string;
  readonly kind: WatchKind;
  /** Why it is on the list. One line, so the list stays reviewable. */
  readonly note: string;
}

/**
 * THE NAMES THIS AUDIT REFUSES.
 *
 * Read §1 of the header before adding to or removing from this list — in
 * particular, this is the ONE region of the ONE file where these strings are
 * allowed to appear, and the scan enforces that on itself.
 *
 * Chosen for the §12.3 accident rather than for completeness: the first real
 * name a builder reaches for is a famous one, so the list is the famous ones in
 * the four categories a powerlifting game would plausibly touch. Multi-word
 * entries are used wherever the brand's single distinctive word is also ordinary
 * English — several entries below are two words for exactly that reason —
 * because a check that fires on prose gets suppressed and a suppressed check is
 * worse than none.
 */
export const REAL_IP_WATCHLIST: readonly WatchEntry[] = Object.freeze([
  // --- federations and governing bodies ------------------------------------
  { name: 'IPF', kind: 'federation', note: 'International Powerlifting Federation' },
  { name: 'USAPL', kind: 'federation', note: 'USA Powerlifting' },
  { name: 'USPA', kind: 'federation', note: 'United States Powerlifting Association' },
  { name: 'WRPF', kind: 'federation', note: 'World Raw Powerlifting Federation' },
  { name: 'NPL', kind: 'federation', note: 'National Powerlifting League' },
  { name: 'GPC', kind: 'federation', note: 'Global Powerlifting Committee' },
  { name: 'WPC', kind: 'federation', note: 'World Powerlifting Congress' },
  { name: 'BVDK', kind: 'federation', note: 'Bundesverband Deutscher Kraftdreikampf' },
  { name: 'Powerlifting America', kind: 'federation', note: 'IPF North American affiliate' },
  { name: 'British Powerlifting', kind: 'federation', note: 'IPF British affiliate' },

  // --- equipment and apparel brands ----------------------------------------
  { name: 'SBD', kind: 'brand', note: 'SBD Apparel — belts, sleeves, wraps' },
  { name: 'Eleiko', kind: 'brand', note: 'Swedish barbell and plate manufacturer' },
  { name: 'Rogue Fitness', kind: 'brand', note: 'US equipment manufacturer' },
  { name: 'Inzer', kind: 'brand', note: 'Inzer Advance Designs — belts and suits' },
  { name: 'Titan Support', kind: 'brand', note: 'Titan Support Systems — supportive gear' },
  { name: 'Rehband', kind: 'brand', note: 'Knee sleeve manufacturer' },
  { name: 'Pioneer Fit', kind: 'brand', note: 'General Leathercraft — belts' },
  { name: 'Kabuki Strength', kind: 'brand', note: 'US bar and coaching brand' },
  { name: 'Texas Power Bar', kind: 'brand', note: 'Buddy Capps barbell' },
  { name: 'Ivanko', kind: 'brand', note: 'Plate and dumbbell manufacturer' },
  { name: 'Gymshark', kind: 'brand', note: 'Apparel' },
  { name: 'Virus International', kind: 'brand', note: 'Apparel' },
  { name: 'Nike', kind: 'brand', note: 'Sportswear' },
  { name: 'Adidas', kind: 'brand', note: 'Sportswear' },
  { name: 'Reebok', kind: 'brand', note: 'Sportswear' },
  { name: 'Under Armour', kind: 'brand', note: 'Sportswear' },
  { name: 'Puma', kind: 'brand', note: 'Sportswear' },
  { name: 'New Balance', kind: 'brand', note: 'Sportswear' },
  { name: 'Lululemon', kind: 'brand', note: 'Apparel' },
  { name: 'Asics', kind: 'brand', note: 'Sportswear' },
  { name: 'Gatorade', kind: 'brand', note: 'Sports drink' },
  { name: 'Red Bull', kind: 'brand', note: 'Energy drink' },
  { name: 'Monster Energy', kind: 'brand', note: 'Energy drink' },
  { name: 'Optimum Nutrition', kind: 'brand', note: 'Supplements' },
  { name: 'MyProtein', kind: 'brand', note: 'Supplements' },
  { name: 'Ghost Energy', kind: 'brand', note: 'Energy drink' },
  { name: 'Bang Energy', kind: 'brand', note: 'Energy drink' },

  // --- meet series ---------------------------------------------------------
  { name: 'SBD Sheffield', kind: 'meet-series', note: 'Invitational meet' },
  { name: 'Sheffield Powerlifting Championships', kind: 'meet-series', note: 'Invitational meet' },
  { name: 'Arnold Sports Festival', kind: 'meet-series', note: 'Expo and meet' },
  { name: 'Arnold Classic', kind: 'meet-series', note: 'Expo and meet' },

  // --- athletes ------------------------------------------------------------
  { name: 'Jesus Olivares', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Ray Williams', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Amanda Lawrence', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Jennifer Thompson', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Kimberly Walford', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Taylor Atwood', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Russel Orhii', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Ashton Rouska', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Agata Sitko', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Prescillia Bavoil', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Sonita Muluh', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Tiffany Chapon', kind: 'athlete', note: 'Powerlifter' },
  // Both spellings. Matching is literal, so an accent is a different string —
  // and the accented form is the one that appears in a real federation export.
  { name: 'Corentin Clement', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Corentin Clément', kind: 'athlete', note: 'Powerlifter, accented spelling' },
  { name: 'John Haack', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Austin Perkins', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Brett Gibbs', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Hunter Henderson', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Jamal Browner', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Julius Maddox', kind: 'athlete', note: 'Bench presser' },
  { name: 'Larry Wheels', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Ed Coan', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Dan Green', kind: 'athlete', note: 'Powerlifter' },
  { name: 'Eddie Hall', kind: 'athlete', note: 'Strongman' },
  { name: 'Brian Shaw', kind: 'athlete', note: 'Strongman' },
  { name: 'Mitchell Hooper', kind: 'athlete', note: 'Strongman' },
]);

/**
 * REAL PEOPLE THIS AUDIT DOES NOT LOOK FOR, AND WHY.
 *
 * An omission from a denylist is invisible; this makes these ones visible. Every
 * entry is a FORMULA EPONYM that CLAUDE.md's domain-correctness section requires
 * by name — `Brzycki` is required by its prohibition, which cannot be written
 * without writing the name. A surname attached to a published formula is not a
 * licensable identity in §12.3's sense: there is no agreement to sign and no
 * mark to infringe, and watching them would bury `REVIEWABLE_CITATIONS` under
 * entries no human can ever action.
 *
 * `realIp.test.ts` asserts this list and the watchlist are disjoint, so a name
 * cannot be quietly on both.
 */
export const DELIBERATELY_NOT_WATCHED: readonly WatchEntry[] = Object.freeze([
  { name: 'Epley', kind: 'athlete', note: 'e1RM formula. CLAUDE.md mandates it by name.' },
  { name: 'Brzycki', kind: 'athlete', note: 'e1RM formula. CLAUDE.md bans it by name.' },
  { name: 'Wilks', kind: 'athlete', note: 'Scoring coefficient. CLAUDE.md names it.' },
  { name: 'Tuchscherer', kind: 'athlete', note: 'RPE chart. CLAUDE.md names it.' },
  { name: 'Konertz', kind: 'athlete', note: 'DOTS author, credited in dots.ts.' },
  { name: 'Hinnant', kind: 'athlete', note: 'Civil-date algorithm, transcribed in streak.ts.' },
]);

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const WORD_EDGE_BEFORE = '(?<![A-Za-z0-9])';
const WORD_EDGE_AFTER = '(?![A-Za-z0-9])';

/**
 * A watch entry as a regex.
 *
 * WORD BOUNDARIES ARE LOAD-BEARING, and not for tidiness. One of the
 * three-letter brand acronyms on the watchlist occurs inside a base64 integrity
 * hash in `package-lock.json`; without the edges this audit would report a
 * dependency checksum as a brand mention on every run, and an audit that cries
 * wolf on a lockfile is an audit somebody excludes the lockfile from — after
 * which the lockfile is a hole. `realIp.test.ts` pins that exact string.
 *
 * `\b` is not used because it treats `.` as a boundary character in both
 * directions, which would make a name ending in `Co.` match inside a longer
 * token. The explicit alphanumeric lookarounds say what is meant.
 */
export function patternFor(entry: WatchEntry): RegExp {
  const escaped = entry.name.replace(REGEX_SPECIAL, '\\$&');
  return new RegExp(`${WORD_EDGE_BEFORE}${escaped}${WORD_EDGE_AFTER}`, 'gi');
}

export interface TextHit {
  readonly name: string;
  readonly kind: WatchKind;
  /** Byte offset into the text scanned. */
  readonly index: number;
  /** The text as it was actually written, which may differ in case. */
  readonly matched: string;
}

/** Every watchlist hit in a piece of text, in document order. */
export function findWatchedNames(
  text: string,
  watchlist: readonly WatchEntry[] = REAL_IP_WATCHLIST,
): readonly TextHit[] {
  const hits: TextHit[] = [];
  for (const entry of watchlist) {
    for (const match of text.matchAll(patternFor(entry))) {
      hits.push({ name: entry.name, kind: entry.kind, index: match.index, matched: match[0] });
    }
  }
  return hits.sort((a, b) => a.index - b.index || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// (A) IDENTITY AS CONTENT — the default-deny half
// ---------------------------------------------------------------------------

/** One string a screen could draw, with enough context to find it again. */
export interface RenderableString {
  /** Which surface family it belongs to: `licensing-entry`, `sample-card`, ... */
  readonly surface: string;
  /** Dotted path within that surface. */
  readonly path: string;
  readonly value: string;
}

export interface ContentFinding {
  readonly surface: string;
  readonly path: string;
  readonly name: string;
  readonly kind: WatchKind;
  readonly value: string;
}

/**
 * Deep-walk any plain value, collecting every string with its path.
 *
 * SYMBOL-KEYED PROPERTIES ARE INVISIBLE TO THIS, and that is not an oversight to
 * fix here — it is why `identityStrings` below exists. `Tier3Asset` hides its
 * content under a module-private symbol, so a walk of an `IdentityEntry` would
 * silently skip every caption and every piece of alt text, i.e. exactly the
 * high-fidelity strings a licensed surface renders. Anything with an opaque
 * field needs its own collector, and `realIp.test.ts` has a non-vacuity check
 * that would fail if the Tier 3 strings stopped arriving.
 */
export function walkStrings(surface: string, root: unknown, prefix: string = ''): readonly RenderableString[] {
  const out: RenderableString[] = [];
  const visit = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      out.push({ surface, path, value });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => visit(item, `${path}[${i}]`));
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        visit(child, path === '' ? key : `${path}.${key}`);
      }
    }
  };
  visit(root, prefix);
  return out;
}

/**
 * Every renderable string of one identity entry, INCLUDING the Tier 3 content
 * behind the symbol.
 *
 * Reads through `tier3Of` with a real Tier 3 surface, so this collector is also
 * a live exercise of the §7.3 reveal path: if the witness mechanism broke, this
 * would throw rather than quietly returning fewer strings.
 *
 * The art rows are NOT collected — they are palette characters, not text, and
 * `partners.test.ts` checks separately that an icon-mark carries no letterform.
 * Stated because "we scanned the entry" would otherwise imply the drawings too.
 */
export function identityStrings(entry: IdentityEntry): readonly RenderableString[] {
  const surface = 'licensing-entry';
  const out: RenderableString[] = [
    { surface, path: `${entry.id}.id`, value: entry.id },
    { surface, path: `${entry.id}.tier1.colorway.id`, value: entry.tier1.colorway.id },
    { surface, path: `${entry.id}.tier1.iconMark.id`, value: entry.tier1.iconMark.id },
    { surface, path: `${entry.id}.tier2.displayName`, value: entry.tier2.displayName },
    { surface, path: `${entry.id}.tier2.shortName`, value: entry.tier2.shortName },
  ];
  for (const slot of TIER_3_SLOTS) {
    const content = tier3Of(entry, slot, 'shop');
    out.push({ surface, path: `${entry.id}.tier3.${slot}.alt`, value: content.alt });
    out.push({ surface, path: `${entry.id}.tier3.${slot}.caption`, value: content.caption });
  }
  return out;
}

/**
 * THE DEFAULT-DENY SCAN. Any watchlist name in any string a screen can draw.
 *
 * There is no allowlist here and there must never be one. A pin on this half
 * would be a way to ship a real mark with a comment next to it, which is the one
 * outcome §12.3 says cannot be walked back after release.
 */
export function scanRenderable(
  strings: readonly RenderableString[],
  watchlist: readonly WatchEntry[] = REAL_IP_WATCHLIST,
): readonly ContentFinding[] {
  const findings: ContentFinding[] = [];
  for (const entry of strings) {
    for (const hit of findWatchedNames(entry.value, watchlist)) {
      findings.push({
        surface: entry.surface,
        path: entry.path,
        name: hit.name,
        kind: hit.kind,
        value: entry.value,
      });
    }
  }
  return findings;
}

export function formatContentFindings(findings: readonly ContentFinding[]): string {
  return findings
    .map((f) => `${f.surface} ${f.path}  [${f.kind}] ${f.name}  in: ${JSON.stringify(f.value)}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// (B) DOCUMENTED REFERENCE — the listed half
// ---------------------------------------------------------------------------

/**
 * Where in a file a mention sits.
 *
 * - `comment`  — inside a `//` or a block comment. Provenance lives here.
 * - `code`     — an identifier, a string literal, a JSON value, an HTML
 *                attribute. Higher severity: a string is one edit from a screen.
 * - `prose`    — a markdown or plain-text file. The GDD, the READMEs.
 * - `filename` — the path itself, which is how a logo actually arrives:
 *                `assets/<brand>-logo.png` far more often than as a string.
 *                Under a shipped asset root this is category (A) and fails;
 *                anywhere else — a downloaded research photograph in
 *                `docs/reference/`, named after its subject — it is category (B)
 *                and is pinned. See `SHIPPED_ASSET_ROOTS`.
 */
export type MentionWhere = 'comment' | 'code' | 'prose' | 'filename';

export interface SourceMention {
  readonly file: string;
  /** 1-based. */
  readonly line: number;
  readonly name: string;
  readonly kind: WatchKind;
  readonly where: MentionWhere;
  /** The whole line, trimmed, so the list is readable without opening the file. */
  readonly text: string;
}

const TS_LIKE = /\.(?:tsx?|m?js|cjs)$/;
const PROSE_LIKE = /\.(?:md|markdown|txt)$/;

/**
 * Text files this audit reads in full.
 *
 * Everything textual, including tests, configs, HTML, shell and JSON —
 * §12.3 names "any asset, string, config, or code path", and it names a test
 * fixture as one of the two examples of how a real mark actually arrives.
 * `src/tuning/audit.ts` skips tests because a test is SUPPOSED to hold a
 * literal number; no test is supposed to hold a real athlete's name, so this one
 * does not skip them.
 */
const TEXT_FILE = /\.(?:tsx?|m?js|cjs|json|md|markdown|txt|html|css|sh|ya?ml|xml|svg)$/;

/** Binary and generated files, checked by FILENAME only. */
export function isTextFile(relPath: string): boolean {
  return TEXT_FILE.test(relPath);
}

/**
 * Directories the tree walk does not descend into.
 *
 * `.claude` is on the list for the reason `audit.test.ts` records at length: it
 * holds `worktrees/`, each of which is a COMPLETE SECOND CHECKOUT of this
 * repository, so descending would make this audit's verdict depend on what some
 * other agent has half-written. `node_modules` is vendored code nobody here
 * authored and is full of real company names by definition.
 */
export const NOT_WALKED: readonly string[] = Object.freeze([
  'node_modules',
  '.git',
  '.expo',
  'dist',
  'coverage',
  '.claude',
  '.gauntlet',
]);

/**
 * WHY `.gauntlet` IS ON THAT LIST, since it is the one entry that is this
 * repository's own content rather than somebody else's.
 *
 * It holds `evidence/`, which is CAPTURED STDOUT from `npx vitest run` — the
 * transcripts a critic reads. Every one of them contains the printed titles of
 * the tests that ran, so a test named after a real federation's published
 * results row appears in nine transcripts as a copy of a string this audit
 * already scans at its source in `resultCard.test.ts`.
 *
 * Pinning those copies would make the citation list churn on every capture, and
 * would make this audit's verdict depend on WHEN SOMEBODY LAST RAN THE SUITE —
 * the same "verdict moves with unrelated state" failure `audit.test.ts` records
 * for sibling worktrees. Nothing under `.gauntlet` ships, nothing there is
 * authored, and its shots are gitignored.
 *
 * THE HOLE THIS LEAVES, stated rather than glossed: a real name typed by hand
 * into `.gauntlet/state.json` would not be seen. That file is run bookkeeping
 * for the loop itself and never reaches a build.
 */
export const NOT_WALKED_REASONS: Readonly<Record<string, string>> = Object.freeze({
  node_modules: 'vendored code nobody here authored; full of real company names by definition',
  '.git': 'object database',
  '.expo': 'build cache',
  dist: 'build output',
  coverage: 'generated report',
  '.claude': 'holds worktrees/, each a complete second checkout of this repository',
  '.gauntlet': 'captured run transcripts; copies of strings scanned at their source',
});

/**
 * Where a file NAME reaching a real brand is category (A) rather than (B).
 *
 * These are the roots whose contents get bundled: Expo reads `assets/` from
 * `app.json` and serves `public/` verbatim. `src/` is included because a source
 * file named after a partner is the licensing system growing a hard-coded
 * dependency on one, which is the thing §7.3 exists to prevent.
 *
 * `docs/` is deliberately absent. It holds downloaded reference photographs
 * named after what is in them, which is what a reference folder is for.
 */
export const SHIPPED_ASSET_ROOTS: readonly string[] = Object.freeze(['assets/', 'public/', 'src/']);

/** True when a path's own NAME carrying a real brand would be shipped content. */
export function isShippedPath(relPath: string): boolean {
  return SHIPPED_ASSET_ROOTS.some((root) => relPath.startsWith(root));
}

/**
 * THE ONE FILE ALLOWED TO SPELL A WATCHED NAME, and the only regions of it that
 * are allowed to.
 *
 * The self-exemption is the same instrument as `SourceRule.allowLiteralsIn` in
 * `src/tuning/audit.ts`: narrow, named, and pinned by a test so it cannot widen
 * quietly. A mention anywhere else in this file — a new helper, a comment, a
 * doc block — is reported like any other.
 */
export const WATCHLIST_FILE = 'src/licensing/realIp.ts';

export const WATCHLIST_REGIONS: readonly string[] = Object.freeze([
  'REAL_IP_WATCHLIST',
  'DELIBERATELY_NOT_WATCHED',
  'REVIEWABLE_CITATIONS',
]);

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text[i] === '\n') line += 1;
  return line;
}

function lineTextAt(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index - 1) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end === -1 ? text.length : end).trim();
}

/**
 * Is the character at `index` inside a comment?
 *
 * Decided by asking `withoutComments` — `src/tuning/audit.ts`'s stripper, which
 * preserves every offset and is checked against every real file in the tree on
 * every run. If the character survived the strip it was code; if it was blanked
 * it was a comment. Reusing that function rather than writing a second stripper
 * is the point: a second one is a second thing to get subtly wrong, and the
 * first one already has an offset-preservation test with the whole repository
 * behind it.
 */
function isInComment(source: string, stripped: string, index: number): boolean {
  return stripped[index] !== source[index];
}

/** Scan one file's text. `relPath` is repository-relative POSIX. */
export function scanSourceText(
  relPath: string,
  source: string,
  watchlist: readonly WatchEntry[] = REAL_IP_WATCHLIST,
): readonly SourceMention[] {
  const tsLike = TS_LIKE.test(relPath);
  const prose = PROSE_LIKE.test(relPath);
  const stripped = tsLike ? withoutComments(source) : source;

  const exemptRanges: { from: number; to: number }[] = [];
  if (relPath === WATCHLIST_FILE) {
    for (const region of declarationRegions(codeOnly(source))) {
      if (WATCHLIST_REGIONS.includes(region.name)) {
        exemptRanges.push({ from: region.fromLine + 1, to: region.toLine });
      }
    }
  }

  const mentions: SourceMention[] = [];
  for (const hit of findWatchedNames(source, watchlist)) {
    const line = lineOf(source, hit.index);
    if (exemptRanges.some((r) => line >= r.from && line <= r.to)) continue;
    const where: MentionWhere = prose
      ? 'prose'
      : tsLike && isInComment(source, stripped, hit.index)
        ? 'comment'
        : 'code';
    mentions.push({
      file: relPath,
      line,
      name: hit.name,
      kind: hit.kind,
      where,
      text: lineTextAt(source, hit.index),
    });
  }
  return mentions;
}

/**
 * Scan a filename — for assets and anything else this audit cannot read.
 *
 * The only check that reaches a binary. A logo pasted into a PNG is invisible
 * here; a logo pasted into a PNG somebody named after the brand is not, and
 * that is how it actually arrives.
 */
export function scanFileName(
  relPath: string,
  watchlist: readonly WatchEntry[] = REAL_IP_WATCHLIST,
): readonly SourceMention[] {
  return findWatchedNames(relPath, watchlist).map((hit) => ({
    file: relPath,
    line: 1,
    name: hit.name,
    kind: hit.kind,
    where: 'filename' as const,
    text: relPath,
  }));
}

// ---------------------------------------------------------------------------
// The reviewable inventory
// ---------------------------------------------------------------------------

/**
 * One row of the human-reviewable list: a file, a name, and where it sits.
 *
 * DELIBERATELY NOT LINE-PINNED. A line number moves every time somebody edits an
 * unrelated paragraph higher up the same file, and this run has several builders
 * working in parallel worktrees — a list pinned to line numbers would go red on
 * merges that changed nothing this audit cares about, and a check that goes red
 * for unrelated reasons is a check people learn to re-run rather than read. The
 * lines are in the FORMATTED report, which is what a human actually opens.
 */
export interface CitationRow {
  readonly file: string;
  readonly name: string;
  readonly where: MentionWhere;
  readonly count: number;
}

/** Fold mentions into the pinnable inventory. Sorted, so the pin is stable. */
export function citationInventory(mentions: readonly SourceMention[]): readonly CitationRow[] {
  const counts = new Map<string, CitationRow>();
  for (const m of mentions) {
    const key = `${m.file}|${m.name}|${m.where}`;
    const existing = counts.get(key);
    counts.set(
      key,
      existing === undefined
        ? { file: m.file, name: m.name, where: m.where, count: 1 }
        : { ...existing, count: existing.count + 1 },
    );
  }
  return [...counts.values()].sort(
    (a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name) || a.where.localeCompare(b.where),
  );
}

export function formatMentions(mentions: readonly SourceMention[]): string {
  return mentions
    .map((m) => `${m.file}:${m.line}  [${m.where}] ${m.name}  ${m.text}`)
    .join('\n');
}

/** The pinned rows, as a diffable block a human can read in a review. */
export function formatCitations(rows: readonly CitationRow[]): string {
  return rows.map((r) => `${r.file}  ${r.name}  ${r.where}  x${r.count}`).join('\n');
}

/**
 * THE REVIEWABLE LIST. Every real name currently present in this repository's
 * SOURCE TEXT, with the file it is in and what kind of position it occupies.
 *
 * ===========================================================================
 * A HUMAN RULES ON THIS LIST. THE MACHINE ONLY MAKES SURE THE RULING HAPPENS.
 * ===========================================================================
 *
 * Nothing here is silently allowed and nothing here has been silently deleted.
 * `realIp.test.ts` compares this list to what is actually in the tree, EXACTLY,
 * in both directions:
 *
 *   - A NEW MENTION fails the suite until somebody looks at it and either
 *     removes the name or writes the row here.
 *   - A REMOVED MENTION fails too, so a citation cannot be quietly deleted to
 *     make the check go green — which matters, because deleting the provenance
 *     is the cheapest way to pass this test and the most expensive way to fail
 *     the codebase.
 *
 * WHAT IS ON IT TODAY, and the judgement for each group:
 *
 *   - `dots.test.ts` / `resultCard.test.ts` — PUBLISHED RECORDS AND REAL
 *     FEDERATION CSV ROWS, cited to anchor tests. `dots.test.ts` checks the DOTS
 *     polynomial against a real all-time total; `resultCard.test.ts` transcribes
 *     real result rows to prove the export format matches a real sheet. Deleting
 *     either makes those tests unverifiable. KEEP unless a human decides
 *     otherwise.
 *   - `meet.ts`, `plates.ts`, `palette.ts`, `resultCard.ts`, `meetPalette.ts`,
 *     `spriteTuning.ts`, `gymPalette.ts` — STRUCTURAL RULE REFERENCES. Naming
 *     the body that publishes a rule being implemented (bar weights, plate
 *     ladder, plate colours, knurl spacing). §3 of this header is the ruling.
 *     KEEP.
 *   - `audit.ts` — the same, inside a `why:` rationale string rather than a
 *     comment. `where: 'code'` for that reason, and worth a human's eye
 *     precisely because a string is one edit from a screen: it is a REASON given
 *     for an allowlist entry, and nothing renders it.
 *   - `docs/GDD.md`, `docs/reference/README.md` — DESIGN DOCUMENT AND REFERENCE
 *     INDEX. The GDD line is §11's open question about federation licensing,
 *     which names the candidates it is asking about; the README describes what
 *     is in a downloaded reference photograph. Both are prose about the real
 *     world, neither ships.
 *   - `CLAUDE.md` — the rules themselves.
 *   - `sampleCards.ts`, `meetTuning.ts`, `tuning/index.ts` — COMMENTS SAYING
 *     "we did not use these names", which is the correct thing for a comment to
 *     say and would be lost by deleting the names from it.
 *   - `meetTuning.test.ts` — the bespoke five-name federation ban this module
 *     generalises. Its names are in `code` position because they are the check's
 *     own operands. KEEP until whoever owns that file removes the now-redundant
 *     test.
 *   - `pixelFont.test.ts` — a real lifter's ACCENTED name, used as the
 *     diacritic-folding fixture for the card font. `code` position, and the one
 *     row on this list that is a real name being used as ordinary test DATA
 *     rather than cited as provenance. It is the clearest candidate for a human
 *     to replace with an invented accented name; it is not replaced here because
 *     `src/card/` belongs to another piece of this run and the substitution
 *     would need the glyph coverage re-checked.
 *   - `docs/reference/…webp` — a downloaded reference PHOTOGRAPH whose FILENAME
 *     names its subject. The only `filename` row, and it is outside every
 *     shipped asset root (`SHIPPED_ASSET_ROOTS`), so it is listed rather than
 *     refused. The same name under `assets/` would fail the suite.
 *
 * REGENERATE, DO NOT HAND-EDIT: `realIp.test.ts` prints the exact block on
 * failure. Paste it, then read every changed line.
 *
 * ---------------------------------------------------------------------------
 * THE COST OF PINNING COUNTS, AND WHY IT IS PAID
 * ---------------------------------------------------------------------------
 * This list is computed from THE WHOLE TREE, so an unrelated builder editing a
 * comment in `palette.ts` moves it. That is a real cost on a run with several
 * parallel worktrees, and it is paid on purpose: dropping the counts would make
 * a SECOND mention in an already-listed file invisible, and "this file already
 * cites one real name" is exactly the place a second one would be added without
 * anyone looking.
 *
 * KNOWN DIVERGENCE AT THE TIME OF WRITING, so whoever merges does not have to
 * work it out: this branch was cut before `src/art/gymPalette.ts` lost its
 * federation reference on the integration branch. On merge, the
 * `src/art/gymPalette.ts` row below will be one row too many and the suite will
 * say so. Delete that line. Every other file with a row here is byte-identical
 * on both branches — checked, not assumed.
 */
export const REVIEWABLE_CITATIONS: readonly CitationRow[] = Object.freeze([
  { file: 'docs/GDD.md', name: 'NPL', where: 'prose', count: 1 },
  { file: 'docs/GDD.md', name: 'USAPL', where: 'prose', count: 1 },
  { file: 'docs/GDD.md', name: 'USPA', where: 'prose', count: 1 },
  { file: 'docs/reference/meet-photo-ref-1-ipf-squat-bottom.webp', name: 'IPF', where: 'filename', count: 1 },
  { file: 'docs/reference/README.md', name: 'IPF', where: 'prose', count: 2 },
  { file: 'src/art/gymPalette.ts', name: 'IPF', where: 'comment', count: 1 },
  { file: 'src/art/palette.ts', name: 'IPF', where: 'comment', count: 2 },
  { file: 'src/art/plates.ts', name: 'IPF', where: 'comment', count: 2 },
  { file: 'src/art/spriteMarks.ts', name: 'IPF', where: 'comment', count: 1 },
  { file: 'src/art/spriteTuning.ts', name: 'IPF', where: 'comment', count: 1 },
  { file: 'src/card/pixelFont.test.ts', name: 'Corentin Clément', where: 'code', count: 1 },
  { file: 'src/card/renderResultCard.test.ts', name: 'IPF', where: 'comment', count: 1 },
  { file: 'src/card/sampleCards.ts', name: 'NPL', where: 'comment', count: 1 },
  { file: 'src/card/sampleCards.ts', name: 'USAPL', where: 'comment', count: 1 },
  { file: 'src/card/sampleCards.ts', name: 'USPA', where: 'comment', count: 1 },
  { file: 'src/game/dots.test.ts', name: 'Amanda Lawrence', where: 'comment', count: 1 },
  { file: 'src/game/dots.test.ts', name: 'IPF', where: 'comment', count: 1 },
  { file: 'src/game/dots.test.ts', name: 'Jesus Olivares', where: 'comment', count: 1 },
  { file: 'src/game/dots.test.ts', name: 'SBD', where: 'comment', count: 1 },
  { file: 'src/game/dots.test.ts', name: 'SBD Sheffield', where: 'comment', count: 1 },
  { file: 'src/game/dots.ts', name: 'BVDK', where: 'comment', count: 2 },
  { file: 'src/game/dots.ts', name: 'IPF', where: 'comment', count: 2 },
  { file: 'src/game/meet.ts', name: 'IPF', where: 'comment', count: 4 },
  { file: 'src/game/meet.ts', name: 'USAPL', where: 'comment', count: 1 },
  { file: 'src/game/meet.ts', name: 'USPA', where: 'comment', count: 1 },
  { file: 'src/game/meetTuning.test.ts', name: 'IPF', where: 'code', count: 1 },
  { file: 'src/game/meetTuning.test.ts', name: 'NPL', where: 'code', count: 1 },
  { file: 'src/game/meetTuning.test.ts', name: 'SBD', where: 'code', count: 1 },
  { file: 'src/game/meetTuning.test.ts', name: 'USAPL', where: 'code', count: 1 },
  { file: 'src/game/meetTuning.test.ts', name: 'USPA', where: 'code', count: 1 },
  { file: 'src/game/meetTuning.ts', name: 'NPL', where: 'comment', count: 1 },
  { file: 'src/game/meetTuning.ts', name: 'USAPL', where: 'comment', count: 1 },
  { file: 'src/game/meetTuning.ts', name: 'USPA', where: 'comment', count: 1 },
  { file: 'src/game/resultCard.test.ts', name: 'Corentin Clément', where: 'code', count: 2 },
  { file: 'src/game/resultCard.test.ts', name: 'Corentin Clément', where: 'comment', count: 1 },
  { file: 'src/game/resultCard.test.ts', name: 'IPF', where: 'code', count: 7 },
  { file: 'src/game/resultCard.test.ts', name: 'IPF', where: 'comment', count: 4 },
  { file: 'src/game/resultCard.test.ts', name: 'SBD', where: 'comment', count: 2 },
  { file: 'src/game/resultCard.test.ts', name: 'Tiffany Chapon', where: 'code', count: 4 },
  { file: 'src/game/resultCard.test.ts', name: 'Tiffany Chapon', where: 'comment', count: 1 },
  { file: 'src/game/resultCard.ts', name: 'IPF', where: 'comment', count: 3 },
  { file: 'src/game/resultCard.ts', name: 'NPL', where: 'comment', count: 1 },
  { file: 'src/game/resultCard.ts', name: 'SBD', where: 'comment', count: 2 },
  { file: 'src/game/resultCard.ts', name: 'Tiffany Chapon', where: 'comment', count: 1 },
  { file: 'src/game/resultCard.ts', name: 'USAPL', where: 'comment', count: 3 },
  { file: 'src/game/resultCard.ts', name: 'USPA', where: 'comment', count: 1 },
  { file: 'src/meet/meetPalette.ts', name: 'IPF', where: 'comment', count: 1 },
  { file: 'src/tuning/audit.ts', name: 'IPF', where: 'code', count: 2 },
  { file: 'src/tuning/index.ts', name: 'IPF', where: 'comment', count: 1 },
]);
