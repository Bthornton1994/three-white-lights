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
 * The house precedent is already there: `gymScene.test.ts` bans a list of real
 * federation, brand and athlete names from the environment art by spelling them
 * out, and `progression.ts`'s `PERFORMANCE_FACT_VOCABULARY` is a blocklist of
 * words a fact may not be named. This is the same instrument one category over.
 * (`meetTuning.test.ts` was the other example and is no longer one: its owner
 * retired the five-name ban after this module generalised it, and that file now
 * carries a test named for leaving the ban to the watchlist that owns it. Named
 * in the past tense here rather than left standing, because a header that cites
 * a check which no longer exists is the drift the citation list warns about.)
 *
 * AND IT IS HELD TO ONE REGION OF ONE FILE. Nothing else here spells a watched
 * name — not this header, not the tests, not the pinned list's prose — and the
 * scan enforces that on itself: `WATCHLIST_FILE` plus `WATCHLIST_REGIONS` is the
 * only exemption, each cut at its declaration's own closing bracket, and
 * `realIp.test.ts` plants a real brand in this very comment and asserts it is
 * reported. Everything below that would naturally have quoted a real acronym or
 * a real project describes it instead ("a three-letter brand acronym", "the
 * open-results project"), which reads slightly worse and keeps the count at one
 * place. `realIp.test.ts` asserts the consequence directly: this file has ZERO
 * rows on the citation list, and a leak out of the three literals would put one
 * there.
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
 * `meetTuning.test.ts` USED TO ban five real federation names from
 * `MEET_LOCAL.federation`, unprompted, citing §11. This module GENERALISED that
 * check rather than duplicating it: `MEET_LOCAL` is pulled into the renderable
 * inventory in `realIp.test.ts` through the whole `TUNING` registry, and scanned
 * against the entire watchlist rather than five hand-typed names — as is every
 * other tuned string in the game. Its owner has since retired the bespoke ban;
 * the file now carries a test named for leaving the ban to the watchlist that
 * owns it, and the five rows it used to contribute are gone from the citation
 * list. `gymScene.test.ts` is the last hand-written one still standing.
 *
 * ===========================================================================
 * 4. WHAT IS DELIBERATELY NOT WATCHED
 * ===========================================================================
 *
 * `DELIBERATELY_NOT_WATCHED` is the list of real names this audit does NOT look
 * for, with the reason for each. It exists because an omission from a denylist
 * is invisible, and an invisible omission is how a denylist quietly stops
 * covering the thing everyone assumed it covered.
 *
 * EVERY NAME ON IT IS ACTUALLY IN THIS TREE. It is a list of rulings, not of
 * hypotheticals: the repository was swept for real-world proper nouns and each
 * of these was found and then ruled out, so a reader sees the ruling instead of
 * inferring it from a silence. Three groups, and they are not equally safe:
 *
 *   - FORMULA AND ALGORITHM EPONYMS. `Epley` is mandated — "Epley, and only
 *     Epley" — and `Brzycki` is mandated by its PROHIBITION, which cannot be
 *     written without writing the name. A person whose surname is attached to a
 *     published formula is not a licensable identity in the sense §12.3 means;
 *     there is no agreement to sign and no mark to infringe.
 *   - CODE HOSTS AND THE DEPENDENCY GRAPH. `package.json` and its lockfile are
 *     lists of vendor names by construction. Watching the category would make
 *     the pinned inventory churn on `npm install` and go red for reasons that
 *     have nothing to do with §12.3. A category exclusion, said out loud,
 *     rather than an enumeration — it is the one part of the omission list that
 *     is not exhaustive.
 *   - NAMES THAT ARE ALSO ORDINARY ENGLISH IN THE USE THE TREE MAKES OF THEM.
 *     One studio's name is a plumbing noun, and both mentions in this repository
 *     are the noun.
 *
 * WHAT IS NO LONGER ON IT MATTERS MORE THAN WHAT IS. The console marks, the two
 * named vendors and the cited repository accounts were all parked here on an
 * "unactionable" argument, and that was a RULING wearing a category's clothes.
 * They are watched and pinned now. Declining to count a mention is not a neutral
 * act: it hands a human a number that is quietly wrong on the one question
 * §12.3 says cannot be walked back after release.
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
 *    THIS IS NOT A HYPOTHETICAL AND IT HAS ALREADY HAPPENED TWICE, A WEEK
 *    APART, FOUND BY DIFFERENT READERS. The first version of the list had no
 *    category for open-source projects and data sources, so the single
 *    most-cited real organisation in this repository and its software — 103
 *    mentions across 15 files — was invisible while the suite ran green, and a
 *    fresh mention added mid-run did not move the verdict. The second had no
 *    category for the game industry, so a console mark in 15 files and a
 *    character mark used as a sprite-height comparator were invisible too; that
 *    one was found by a critic grading a different piece, not by anyone looking
 *    at this file. 85 rows were added between them, against 60 that were already
 *    there.
 *    THE PATTERN IN BOTH MISSES IS THE USEFUL PART: the original categories were
 *    chosen by asking what a builder might INVENT a fake version of, and both
 *    holes were things this codebase CITES. Anyone extending this list should
 *    re-derive what the tree points at rather than trusting either list to be
 *    current, and should expect a third category nobody has thought of.
 *  - URL FORMS ARE COVERED ONLY BECAUSE OF THE BOUNDARY RULE, not because
 *    anything parses URLs. `patternFor`'s edges are alphanumeric-only, so `/`,
 *    `.` and `-` are all boundaries and a name inside a host or a path matches
 *    the same literal as the bare name. That is load-bearing — a URL is how a
 *    real name most often survives a text scan — and `realIp.test.ts` pins it
 *    against the actual host, path and dotted-domain forms in this tree. The
 *    residual: a name that only ever appears SPLIT by a URL-encoded or hyphen-
 *    joined form of itself is still missed, and one such abbreviation had to be
 *    added as its own entry for exactly that reason.
 *  - IT READS TEXT. A real logo drawn pixel by pixel into `partners.ts`, or
 *    pasted into a PNG under `assets/`, is invisible to it. Filenames are
 *    scanned; image contents are not.
 *    WHICH FILES COUNT AS TEXT USED TO BE AN EXTENSION ALLOWLIST, AND IT FAILED
 *    OPEN. Fifteen suffixes; anything else was skipped with no finding, no note
 *    and no line of output, so the gap was invisible from the outside — which is
 *    strictly worse than looking and finding nothing. `.py` was not on it, and a
 *    builder on an unrelated piece reached for a Python script first; `.mts` and
 *    `.toml` were not on it either and four such files were already in the tree.
 *    It is a CONTENT test now: everything the walk reaches is read unless its
 *    bytes are not text, and the files that fails on are enumerated by name in
 *    `UNREADABLE_BY_THIS_AUDIT` rather than silently dropped. See the argument at
 *    `classifyBytes` for why the replacement is not a denylist of binary
 *    extensions — that shape fails open one level further out.
 *  - THE DIRECTORY DIMENSION IS STILL AN ALLOWLIST. `NOT_WALKED` names seven
 *    directories this audit never descends into, and a real mark inside one of
 *    them is as invisible as `.py` was. Each has a written reason in
 *    `NOT_WALKED_REASONS`, which is more than the extension rule ever had; it is
 *    still a list somebody has to keep right, and fixing the file-type dimension
 *    said nothing about this one.
 *    THERE IS A LIVE INSTANCE OF THIS, and it is worth naming rather than
 *    leaving as a general caveat: one of the committed reference images under
 *    `docs/reference/` carries a real league's logo and a currently-competing
 *    player's likeness in its PIXELS. This audit knows about it only because a
 *    doc TRANSCRIBED THE CAPTION, which is what put the league, the club and the
 *    player on the citation list. Had nobody written the caption down, the
 *    image would be exactly as unlicensed and this file would report nothing.
 *    Reference material outside a shipped asset root is category (B) by design,
 *    but the human ruling on that row should know it is ruling on a picture and
 *    not only on a sentence.
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

/**
 * WHY THERE ARE SIX KINDS AND NOT THE ORIGINAL FOUR.
 *
 * The first four were the categories a powerlifting game would plausibly touch
 * as CONTENT: a governing body, an equipment brand, a meet, a lifter. Both
 * additions were found the same way — a name already in the tree that nothing
 * was looking for — and the pattern in HOW they were missed is worth more than
 * either category:
 *
 *   `project` — the OPEN-SOURCE PROJECTS AND SOFTWARE PLATFORMS the sport runs
 *   its results on. A results database, the meet-management software a
 *   federation scores on, the repository a coefficient implementation was read
 *   out of. Real organisations with real marks, and forcing them into `brand` or
 *   `federation` would have made the list say something false about what they
 *   are.
 *
 *   `game-industry` — CONSOLES, STUDIOS, FRANCHISES AND CHARACTERS. This is a
 *   16-bit pixel-art project whose art bar is defined by era comparison, so it
 *   reasons about console colour depth, vblank-authored animation and how big a
 *   fighting-game lead stood on a 224-line field. Every one of those sentences
 *   reaches for a real trademark, and none of them is about powerlifting.
 *
 * THE COMMON FAILURE was that the original four were chosen by asking WHAT A
 * BUILDER MIGHT INVENT A FAKE VERSION OF — a sponsor, a federation, a lifter.
 * Both missed categories are things the codebase CITES rather than invents, and
 * both were sitting in the tree while the audit ran green. Ask what a file
 * points at, not only what it might make up.
 */
export type WatchKind =
  | 'brand'
  | 'athlete'
  | 'federation'
  | 'meet-series'
  | 'project'
  | 'game-industry';

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
 * the five categories a powerlifting game would plausibly touch. Multi-word
 * entries are used wherever the brand's single distinctive word is also ordinary
 * English — several entries below are two words for exactly that reason —
 * because a check that fires on prose gets suppressed and a suppressed check is
 * worse than none.
 *
 * ---------------------------------------------------------------------------
 * TWO BLOCKS WERE ADDED AFTER THE LIST WAS FOUND BLIND TWICE, AND THE TWO
 * MISSES HAVE THE SAME SHAPE
 * ---------------------------------------------------------------------------
 * Worth recording, because it is the clearest evidence for what §5 of the header
 * says about a floor and a net. The first four categories were the ones a
 * powerlifting game would touch as CONTENT — a federation, an equipment brand, a
 * meet, a lifter — and they were chosen by asking what a builder would INVENT a
 * fake version of.
 *
 * They therefore missed, twice:
 *
 *   1. The software and data projects the sport's results actually live on,
 *      which this codebase reads its result-card format, its DOTS
 *      implementation, its plate ladder and its meet flow out of — 103 mentions
 *      across 15 files. The audit ran green over all of it for the whole of this
 *      run; a builder added a fresh mention to `src/game/meetServer.ts` in the
 *      wave this block was written and the suite did not move.
 *   2. The console, franchise and character marks a 16-bit project reaches for
 *      every time it argues about era — 57 mentions across 15 files, including a
 *      character used as a sprite-height comparator inside the figure rig's own
 *      tuning file. Found by a critic grading that rig, not by anyone reading
 *      this module.
 *
 * NEITHER WAS SHIPPING; almost every mention is provenance in a comment, and the
 * default-deny half stayed green for the right reason. What was broken was the
 * INSTRUMENT: the run was asking a human to rule on a citation count that was
 * missing more than it contained.
 *
 * THE LESSON IS ABOUT HOW THE LIST IS EXTENDED, not about these fourteen names.
 * Ask what the repository CITES, not what it might invent. A name arrives here
 * far more often as a source URL or an era comparison than as a fake sponsor —
 * and a third category nobody has thought of is the expected case, not the
 * surprising one.
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

  // --- open-source projects, results databases and meet software -----------
  // The category the first draft of this list missed entirely, and the one this
  // repository cites more than any other: it transcribes its result-card
  // format, its DOTS implementation, its plate ladder and its meet flow out of
  // these. See the `project` note on `WatchKind`.
  { name: 'OpenPowerlifting', kind: 'project', note: 'Open results database and archive; also its .org site and its GitLab/GitHub orgs' },
  { name: 'OPL', kind: 'project', note: 'That project abbreviated — used bare, and as the slug of its data repository' },
  { name: 'OpenLifter', kind: 'project', note: 'Meet-management software from the same organisation' },
  { name: 'LiftingCast', kind: 'project', note: 'Third-party meet-management and live-scoring platform; matches liftingcast.com' },
  // DOMAIN FORM ONLY, and the arithmetic behind that is in `realIp.test.ts`
  // rather than left to be guessed. The bare word is a real results platform and
  // also this codebase's own term for a passed attempt. Word boundaries mean the
  // bare form would not fire on `isGoodLift` or `heaviestGoodLift` — a letter
  // precedes it in both — so watching it would add an entry that matches nothing
  // in the tree today and would fire on the first `const goodLift` anybody
  // writes. Dead now, noisy later. The dotted form is the one actually cited.
  { name: 'goodlift.info', kind: 'project', note: 'A federation official results platform. Domain form: the bare word is this repository verdict term' },
  // Cited SOURCES rather than dependencies: the accounts and apps whose files
  // `rpe.ts` and `dots.ts` transcribe, named in pinned-commit retrieval URLs. A
  // handle is a thin kind of identity and these are the entries a human is most
  // likely to strike; they are here so that striking them is a decision rather
  // than an omission. See the code-host exclusion in `DELIBERATELY_NOT_WATCHED`
  // for where the line was drawn and why.
  { name: 'metriclift', kind: 'project', note: 'Third-party app whose RPE table rpe.ts transcribes' },
  { name: 'karolczyz', kind: 'project', note: 'Account owning that app, in its pinned-commit URL' },
  { name: 'Sculpt-AI', kind: 'project', note: 'Account owning the second RPE transcription source' },
  { name: 'sstangl', kind: 'project', note: 'Account owning a cited DOTS implementation' },
  { name: 'Marantesss', kind: 'project', note: 'Account owning a comparison DOTS implementation' },

  // --- consoles, studios, franchises and characters -------------------------
  // The second category the list was blind to, found by a critic grading the
  // figure rig rather than by this module. A 16-bit project argues about era
  // constantly — colour depth, vblank timing, how tall a lead sprite stood — and
  // every one of those arguments names somebody's trademark.
  { name: 'SNES', kind: 'game-industry', note: 'Console hardware mark. GDD §7.1 and §12.2 make it the art bar' },
  // BARE WORD, AND IT IS ALSO ORDINARY ENGLISH. Every mention in the tree today
  // is the console, but "the genesis of" would fire. Watched anyway rather than
  // ruled out, because the alternative — a two-word entry with the maker's name
  // in front — matches nothing this codebase actually writes and would be a dead
  // row. If it starts crying wolf, that is a human's call to make, not a reason
  // to have hidden the mentions in the meantime.
  { name: 'Genesis', kind: 'game-industry', note: 'Console hardware mark, and an ordinary English word. GDD §7.1 names it' },
  { name: 'Game Boy', kind: 'game-industry', note: 'Handheld hardware mark, named in GDD §7.1 as a style to avoid' },
  { name: 'Ryu', kind: 'game-industry', note: 'Fighting-game character, cited as a sprite-height comparator' },

  // --- other sports leagues, clubs and their athletes ------------------------
  // Not powerlifting, and that is exactly how they got in: they arrived through
  // a committed REFERENCE IMAGE whose caption a doc transcribes. §12.3's own
  // words for how a real mark actually arrives.
  { name: 'MLB', kind: 'federation', note: 'US baseball league. Reached the tree via a reference image caption' },
  { name: 'Orioles', kind: 'brand', note: 'Baseball club mark, from the same caption' },
  { name: 'Mullins', kind: 'athlete', note: 'Currently-competing baseball player, captioned in that reference image' },

  // --- named comparators and vendors ----------------------------------------
  // Real companies this project measures itself against or plans to build on.
  // Both are prose only — neither is a dependency, so neither is excluded by the
  // dependency-graph rule in `DELIBERATELY_NOT_WATCHED`.
  { name: 'Duolingo', kind: 'brand', note: 'GDD §12.2 makes it the daily-loop bar by name' },
  { name: 'Supabase', kind: 'brand', note: 'CLAUDE.md names it as the server-authoritative backend' },
  { name: 'NBA 2K', kind: 'game-industry', note: 'Named sports-sim category comparator in VISION.md and GDD §13. The doctrine forbids copying the franchise' },
  { name: 'Madden', kind: 'game-industry', note: 'Named sports-sim category comparator in VISION.md and GDD §13. The doctrine forbids copying the franchise' },

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
 * REAL NAMES THIS AUDIT DOES NOT LOOK FOR, AND WHY — EVERY ONE OF WHICH IS
 * ACTUALLY IN THIS TREE.
 *
 * An omission from a denylist is invisible; this makes these ones visible. It is
 * not a list of names somebody might have watched — every entry below was found
 * by scanning the repository for real-world proper nouns and then RULED OUT, so
 * the reader can see the ruling instead of inferring it from a silence. The
 * counts in the notes were taken at the time of writing and will drift; they are
 * there to say "this is not hypothetical", not to be pinned.
 *
 * A DECISION TO WATCH ANY OF THESE IS A HUMAN ONE, and moving a name from here
 * to `REAL_IP_WATCHLIST` is a one-line edit followed by pasting a regenerated
 * `REVIEWABLE_CITATIONS`. The rulings below are the ones this module's stated
 * selection rule produces; they are not a claim that no other reading exists.
 *
 * THE LIST IS DELIBERATELY SHORT, AND IT USED TO BE LONGER. An earlier pass put
 * the console marks, the two named vendors and the cited repository accounts
 * here, on the argument that they are unactionable. That was a RULING dressed as
 * a category, and ruling is not this module's job: whether a citation may stay
 * is the open question GDD §11 carries, and answering it by declining to count
 * the mentions hands a human a number that is quietly wrong. They are all on the
 * watchlist now and every mention is pinned. What is left here is only the
 * narrow set where WATCHING WOULD BREAK THE CHECK ITSELF:
 *
 *   - a name the governing documents require and that has no mark to infringe
 *     (a formula eponym),
 *   - a name that is generated dependency metadata rather than a citation, so
 *     watching it makes the inventory churn on `npm install`,
 *   - a name that is also ordinary English in the sense the tree actually uses
 *     it, so watching it produces false positives and nothing else.
 *
 * If an entry here cannot be defended on one of those three, it belongs on the
 * watchlist and the count belongs in front of a human.
 *
 * `realIp.test.ts` asserts this list and the watchlist are disjoint, so a name
 * cannot be quietly on both, and asserts none of these matches the watchlist.
 */
export const DELIBERATELY_NOT_WATCHED: readonly WatchEntry[] = Object.freeze([
  // --- formula and algorithm eponyms ---------------------------------------
  // Required BY NAME by CLAUDE.md's domain-correctness section — `Brzycki` by
  // its prohibition, which cannot be written without writing the name. A surname
  // attached to a published formula is not a licensable identity in §12.3's
  // sense: there is no agreement to sign and no mark to infringe.
  { name: 'Epley', kind: 'athlete', note: 'e1RM formula. CLAUDE.md mandates it by name.' },
  { name: 'Brzycki', kind: 'athlete', note: 'e1RM formula. CLAUDE.md bans it by name.' },
  { name: 'Wilks', kind: 'athlete', note: 'Scoring coefficient. CLAUDE.md names it.' },
  { name: 'Tuchscherer', kind: 'athlete', note: 'RPE chart. CLAUDE.md names it.' },
  { name: 'Konertz', kind: 'athlete', note: 'DOTS author, credited in dots.ts.' },
  { name: 'Hinnant', kind: 'athlete', note: 'Civil-date algorithm, transcribed in streak.ts.' },

  // --- code hosts and the dependency graph ----------------------------------
  // A CATEGORY EXCLUSION, NOT AN ENUMERATION. This is the plumbing a citation
  // travels over rather than the thing cited, and it is the one group where
  // watching would break the audit rather than extend it: `package.json` and
  // `package-lock.json` are lists of vendor names by construction, so the pinned
  // inventory would churn on every `npm install` and go red for reasons that
  // have nothing to do with §12.3 — the cry-wolf failure `patternFor` was given
  // word boundaries to avoid, one level up.
  //
  // The two named below are the ones that appear in PROSE as well as in
  // metadata, so a reader would otherwise wonder about them. Every other vendor
  // in `package.json` is excluded by the same reason and is not listed; that is
  // the one place this list is deliberately not exhaustive, and it is said out
  // loud rather than left to be discovered.
  //
  // The line: a company whose SOFTWARE this project runs on is excluded; a
  // company this project CITES, COMPARES ITSELF TO, or transcribes a file from
  // is watched. That is why the two vendors named in prose as architecture and
  // as the daily-loop bar are on the watchlist and these two are not.
  { name: 'GitHub', kind: 'project', note: 'Code host. package-lock.json alone carries it on ~75 lines.' },
  { name: 'GitLab', kind: 'project', note: 'Code host. Excluded with the other for coherence, not for volume.' },

  // --- real names that are also ordinary English ----------------------------
  // Watching this would produce false positives and nothing else: every
  // occurrence in the tree is the common noun, in two comments about one-way and
  // safety valves. A check that fires on English gets suppressed, and a
  // suppressed check is worse than none. Recorded because a reader sweeping for
  // game-industry names will hit it and deserves to know it was considered.
  { name: 'Valve', kind: 'game-industry', note: 'Game studio, and a plumbing noun. Both tree mentions are the noun.' },
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

/**
 * Files whose comments this audit can tell apart from their code.
 *
 * `withoutComments` understands `//` and block comments, so this is the family
 * of languages that spells a comment that way. `[cm]?` covers the module-suffixed
 * spellings — `.mts` and `.cts` were missing here for the same reason `.py` was
 * missing from the reader below, and three `tools/*.d.mts` files were sitting in
 * the tree while this pattern declined to recognise them.
 *
 * A LANGUAGE THAT IS NOT ON THIS LIST IS STILL READ; its mentions are just
 * classified `code` rather than `comment`. That is the safe direction — `code` is
 * the higher-severity bucket, "one edit from a screen" — and it is why a Python
 * script's `#` comments needing a different stripper is not a reason to keep
 * Python out of the scan.
 */
const TS_LIKE = /\.(?:[cm]?tsx?|[cm]?jsx?)$/;
const PROSE_LIKE = /\.(?:md|markdown|txt)$/;

// ---------------------------------------------------------------------------
// WHAT GETS READ — and why this is a DENYLIST on content rather than an
// allowlist on extension
// ---------------------------------------------------------------------------

/**
 * THIS PREDICATE USED TO BE AN EXTENSION ALLOWLIST AND IT FAILED OPEN.
 *
 * The old rule was one regex of fifteen extensions. Everything else in the tree
 * was skipped SILENTLY — no finding, no note, no line in any output — so the gap
 * was invisible from the outside and the suite was exactly as green as it would
 * have been with nothing to find. Three ways that had already gone wrong:
 *
 *   - `.py` matched nothing. A builder working on an unrelated piece reached for
 *     a Python script first and would have written a completely unwatched file;
 *     that is what produced this rewrite. Nothing in this repository is written
 *     in Python TODAY, which is the point — the hole was in the shape of the
 *     check, not in the contents of the tree, and it would have opened on the
 *     first `.py` anybody committed.
 *   - `.mts` matched nothing, and `tools/png.d.mts`, `tools/test-budgets.d.mts`
 *     and `tools/testBudget.d.mts` were already there. `tsx?` does not cover the
 *     module-suffixed spelling and nobody noticed for as long as those files have
 *     existed.
 *   - `.toml` matched nothing, and `netlify.toml` was already there — a build
 *     config, which is one of the four words §12.3 uses.
 *
 * SO THE SHAPE IS INVERTED: everything the tree walk reaches is READ unless its
 * BYTES say it cannot be text. An extension nobody thought of is now watched by
 * default instead of skipped by default, which is the only arrangement where a
 * new file type is a safe default rather than a silent hole.
 *
 * WHY THE TEST IS CONTENT AND NOT A LIST OF BINARY EXTENSIONS. A denylist of
 * extensions fails open one level further out — the first `.pdf`, `.jpg` or
 * `.ttf` nobody enumerated gets read as mojibake and cries wolf, and a check that
 * cries wolf is one somebody suppresses. Bytes need no enumeration and cannot go
 * stale: a NUL byte, or a sequence that is not valid UTF-8, is not text in any
 * language. That also reaches the case an extension rule structurally cannot —
 * `.gitignore` has no extension at all, and it is read now.
 *
 * WHY BINARIES ARE EXCLUDED AT ALL, MEASURED RATHER THAN ASSUMED. Reading this
 * tree's 19 binaries as UTF-8 with replacement produces TWO watchlist hits, both
 * false: a three-letter federation acronym inside the deflate stream of an app
 * icon, and a three-letter brand acronym inside a reference screenshot. That is
 * the same cry-wolf failure `patternFor`'s word edges were added for, one level
 * out, and it is why "read everything" is not the answer either.
 *
 * WHAT THIS STILL DOES NOT CLOSE, and it is two whole dimensions rather than a
 * corner:
 *
 *   - THE DIRECTORY DIMENSION. `NOT_WALKED` is still an unmeasured allowlist of
 *     seven names; a real mark inside `.gauntlet/` or a sibling worktree is as
 *     invisible as `.py` was. Each entry has a written reason in
 *     `NOT_WALKED_REASONS`, which is more than the extension rule ever had, and
 *     it is still a list somebody has to keep right.
 *   - THE PIXELS. A file that cannot be read as text is not read as anything.
 *     Its NAME is still scanned (`scanFileName`), which is how the two reference
 *     photographs reach the citation list — but a logo drawn INSIDE a PNG is
 *     invisible here and always will be. `UNREADABLE_BY_THIS_AUDIT` is the census
 *     of exactly those files, pinned by name, so the invisible half is at least
 *     enumerated instead of merely admitted.
 */
export type TextVerdict = 'text' | 'nul-byte' | 'not-utf8';

/**
 * Why a file's bytes are or are not readable as text.
 *
 * WHOLE FILE, NOT A PREFIX. Git's own heuristic sniffs the first 8000 bytes,
 * which is faster and lets a NUL past the window; this tree is 284 files, so the
 * cheap thing and the correct thing are the same thing and there is no window
 * constant to tune.
 *
 * ON TODAY'S TREE ONLY THE `nul-byte` ARM FIRES — all 19 binaries are PNG, WAV
 * or WEBP and every one of them carries a NUL in its header. `not-utf8` is
 * therefore driven by fixtures in `realIp.test.ts` rather than by the repository,
 * and it is kept because the arms answer different questions: a UTF-16 text file
 * is all NULs and a latin-1 one has none.
 */
export function classifyBytes(bytes: Uint8Array): TextVerdict {
  if (bytes.includes(0)) return 'nul-byte';
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return 'not-utf8';
  }
  return 'text';
}

/** True when this audit reads the file's contents. Binaries are FILENAME only. */
export function isTextFile(bytes: Uint8Array): boolean {
  return classifyBytes(bytes) === 'text';
}

/**
 * THE EXTENSIONS THIS AUDIT ACTUALLY READS IN THIS TREE, pinned.
 *
 * Not an input — nothing consults it to decide anything. It is the ANSWER the
 * content predicate gives when it is pointed at the real repository, written down
 * so the answer is reviewable. `realIp.test.ts` set-equals it against the live
 * walk in both directions, which is what makes the widening self-announcing: the
 * first `.py` anybody commits reddens the suite with `.py` in the message, and
 * the fix is to read this paragraph and add the row rather than to discover six
 * months later that the file was never scanned.
 *
 * `(none)` is `.gitignore`, which has no extension and which the old
 * extension-matching rule could not have reached under any list of suffixes.
 */
export const EXTENSIONS_READ_AS_TEXT: readonly string[] = Object.freeze([
  '(none)',
  '.html',
  // `.js` ARRIVED WITH `metro.config.js`, the first tracked `.js` in the tree.
  // Expo needs a CommonJS `metro.config.js` to register `.riv` and `.wasm` as
  // asset extensions for the Rive runtime spike (ADR-001 §6); every other
  // script here is `.mjs`. Scanned like any other text — a `.js` can carry a
  // name as easily as a `.ts` — which is the fail-closed shape working.
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.mts',
  '.sh',
  '.toml',
  '.ts',
  '.tsx',
  // `.txt` ARRIVED, AND THIS ROW IS WHAT THAT IS SUPPOSED TO COST. The
  // qualifying-totals research module commits a tier-mapping audit as plain
  // text, which is the first `.txt` anybody has put in the walked tree. Nothing
  // about the scan changed to accept it — the content predicate already read it
  // the moment it appeared, which is exactly what inverting this rule onto bytes
  // was for. This list is the pinned ANSWER, so a new kind of readable file
  // reddens the suite once, gets read, and is written down. That happened here.
  '.txt',
  '.yml',
]);

/** One kind of file this audit cannot read the contents of, and how many there are. */
export interface UnreadableGroup {
  readonly extension: string;
  readonly reason: Exclude<TextVerdict, 'text'>;
  readonly count: number;
}

/**
 * EVERYTHING IN THIS TREE WHOSE CONTENTS THIS AUDIT CANNOT READ, COUNTED.
 *
 * The same instrument as `DELIBERATELY_NOT_WATCHED`, pointed at files instead of
 * names, and for the same stated reason: an omission from a scan is invisible,
 * and an invisible omission is how a scan quietly stops covering what everyone
 * assumed it covered. The defect that produced this module's rewrite was exactly
 * that — a file type silently declined, with nothing in any output to say so.
 * The gap IS the output now.
 *
 * BY EXTENSION AND COUNT RATHER THAN BY FILENAME, AND THE REASON IS THIS
 * MODULE'S OWN SELF-SCAN. The first draft of this block listed all nineteen paths
 * — at which point the audit reported two watchlist names in `realIp.ts` outside
 * its three exempt regions, because two of the reference photographs are named
 * after a console and a federation. That was the check working on the hand
 * writing it, and the choice it forced is the right one on its own merits:
 * counting keeps the self-exemption at three regions instead of opening a fourth,
 * and `realIp.test.ts` prints the live filenames in its failure message, where a
 * name in output is not a name in source.
 *
 * THESE FILES ARE NOT UNWATCHED. Every one still goes through `scanFileName`,
 * which is how the two reference photographs earn their `filename` rows on
 * `REVIEWABLE_CITATIONS`. What is unreadable is the CONTENT, and for a picture
 * that is permanent: §5 of the header names the live instance, a reference image
 * carrying a real league's logo and a competing player's likeness in its pixels.
 *
 * SO A MOVED COUNT IS AN EVENT. It means a binary arrived or left, and a binary
 * is the one place a real mark can sit with no text anywhere near it.
 * `realIp.test.ts` set-equals this against the live walk in both directions, so
 * adding an icon or a sound reddens the suite until somebody adjusts the number —
 * the same cost `REVIEWABLE_CITATIONS` already charges, for a stronger reason.
 */
export const UNREADABLE_BY_THIS_AUDIT: readonly UnreadableGroup[] = Object.freeze([
  { extension: '.jpeg', reason: 'nul-byte', count: 1 },
  // 10 -> 11 with the empty side-on room plate
  // `assets/iron-amber/squat-room-side.jpg` (PR #60 athlete intake). Binary,
  // filename only — not a painted lifter scene.
  { extension: '.jpg', reason: 'nul-byte', count: 11 },
  // 10 -> 12 with the Rive runtime spike's two browser screenshots under
  // `docs/design/evidence/rive-spike/` (ADR-001 §7). Binary, filename only.
  // 12 -> 13 with the spike's second frame, `spike-route-later.png` — the
  // same scene 450 ms later, which is how "the graphic moves" is on record.
  // 13 -> 19 with the night-shift evidence (2026-09-08): the acceptance
  // harness's `route.png` and two composition shots
  // (`docs/design/evidence/athlete-acceptance/`) and the host-runtime soak's
  // three frames (`docs/design/evidence/host-runtime-soak/`). Binary,
  // filename only, dev evidence — never an athlete. A count edited under the
  // census ruling for artifacts the visual lane owns, and flagged in CLAUDE.md.
  // 19 -> 20 with `assets/athlete/athlete-01-reference-sheet.png` (owner
  // visual reference for PR #60 authoring; not embedded in the .riv).
  { extension: '.png', reason: 'nul-byte', count: 20 },
  // Editor backup sibling of athlete-01.riv (PR #60). Binary, filename only.
  { extension: '.rev', reason: 'nul-byte', count: 1 },
  // `.riv` ARRIVED WITH THE SPIKE, AS A BINARY ROW ON PURPOSE. The committed
  // `assets/dev/rive-spike.riv` is a deliberately-invalid placeholder — see
  // its README — and carries a NUL so this census classifies it the way a
  // real `.riv` (a binary) would be classified. When a real asset replaces
  // it, this row stays true; had the placeholder been text, the row would
  // have sat in the text census and gone stale the day the real file landed.
  //
  // 1 -> 3 on 2026-09-08: two REAL test assets landed beside the placeholder,
  // `assets/dev/quick_start.riv` and `rewards.riv`, MIT, from the vendor's own
  // runtime repository — provenance, hashes and the licence text are in
  // `assets/dev/THIRD-PARTY-RIVE-ASSETS.md`. Dev-only fixtures for the runtime
  // spike and the `.riv` schema diagnostic; neither is an athlete and neither
  // is on the player path. The placeholder stays as the error-path fixture.
  // 3 -> 4 with `assets/athlete/athlete-01.riv` (PR #60 authored athlete;
  // player mount / TRAINING_STAGE still closed).
  { extension: '.riv', reason: 'nul-byte', count: 4 },
  { extension: '.wav', reason: 'nul-byte', count: 7 },
  { extension: '.webp', reason: 'nul-byte', count: 2 },
]);

/** The extension of a repository-relative path, or `(none)` when it has none. */
export function extensionOf(relPath: string): string {
  const base = relPath.slice(relPath.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot) : '(none)';
}

/** Fold a walked tree into the unreadable census, grouped and sorted. */
export function unreadableCensus(
  files: readonly { readonly file: string; readonly bytes: Uint8Array }[],
): readonly UnreadableGroup[] {
  const groups = new Map<string, UnreadableGroup>();
  for (const { file, bytes } of files) {
    const verdict = classifyBytes(bytes);
    if (verdict === 'text') continue;
    const extension = extensionOf(file);
    const key = `${extension}|${verdict}`;
    const existing = groups.get(key);
    groups.set(
      key,
      existing === undefined
        ? { extension, reason: verdict, count: 1 }
        : { ...existing, count: existing.count + 1 },
    );
  }
  return [...groups.values()].sort(
    (a, b) => a.extension.localeCompare(b.extension) || a.reason.localeCompare(b.reason),
  );
}

// ---------------------------------------------------------------------------
// WHAT GETS REACHED — the second dimension, and the one the first fix said
// nothing about
// ---------------------------------------------------------------------------

/**
 * THE REACH WAS A PROPERTY OF SOMEBODY'S CHECKOUT AND IS NOW A PROPERTY OF THE
 * REPOSITORY.
 *
 * Fixing the file-type predicate said nothing about which FILES the walk hands
 * it, and that is a separate axis with its own failure — the "reach and
 * predicate are two axes" lesson, arriving from the other side.
 *
 * THE INSTANCE, MEASURED IN TWO CHECKOUTS OF THE SAME COMMIT. The census of
 * unreadable files read `.png 10 | .wav 7 | .webp 2` where it was written and
 * `.png 10 | .wasm 1 | .wav 7 | .webp 2` where it was merged. The extra entry is
 * `public/canvaskit.wasm` — 8 MB, gitignored, untracked, copied out of
 * `node_modules` by a dev script, so it exists in any checkout where somebody has
 * run a browser tool and in no fresh worktree. A second builder had already hit
 * the same asymmetry from the other direction. Neither number was right: pinning
 * the larger one reddens every clean worktree and pinning the smaller one reddens
 * every checkout anybody has worked in.
 *
 * A pinned census over a filesystem walk is a pin on WHAT SOMEBODY HAPPENS TO
 * HAVE ON DISK. That is not a fact about this repository, and the same shape hit
 * a second time in the same hour: verification logs written to the repository
 * root by a watchdog put `.log` into the READ set in one checkout and not in
 * another, and one of them was not valid UTF-8, so it landed in the UNREADABLE
 * census too. Any gitignored artifact anybody generates can move a pinned count.
 *
 * SO THE WALK SKIPS WHAT GIT IGNORES, and the two views are asserted to agree
 * rather than assumed to. `realIp.test.ts` runs `git ls-files` and compares:
 *
 *   - A WALKED FILE GIT IGNORES is dropped and pinned at zero. That is the check
 *     `canvaskit.wasm` would have tripped.
 *   - A TRACKED FILE THE WALK CANNOT SEE is a finding unless a named `NOT_WALKED`
 *     entry explains it, and WHICH entries do the explaining is pinned below.
 *   - A WALKED FILE THAT IS NOT TRACKED and not ignored is still SCANNED, on
 *     purpose. That is new uncommitted work, which is where §12.3 says a real
 *     name actually arrives — "the first thing that came to mind" gets typed
 *     before it gets committed. It is reported rather than pinned, because a
 *     builder mid-edit is not a defect.
 *
 * THE TWO PINNED CENSUSES ARE TAKEN OVER TRACKED FILES ONLY, which is what makes
 * them reproducible in any checkout. The SCAN is still the whole walk; only the
 * counts are narrowed, so nothing stops being read in order to make a number
 * stable.
 *
 * AND ONE THING THIS DOES NOT DO. `public/canvaskit.wasm` is untracked and it
 * genuinely ships — the deploy config copies it into the bundle. Excluding it is
 * still right, for the reason `NOT_WALKED` already gives for `node_modules`: it
 * is vendored bytes nobody here authored. Its own filename carries no watched
 * name, and its contents are a binary this audit could not read in any case. If a
 * future untracked-yet-shipped file is AUTHORED here, that reasoning stops
 * applying and this is the paragraph that has to change.
 */

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
 * for sibling worktrees. Nothing under `.gauntlet` ships and nothing there is
 * authored: every string in it is a COPY of one this audit reads at its source.
 *
 * That last clause used to end "and its shots are gitignored", which was true
 * when it was written and is not any more — `.gauntlet/shots/shell/` and
 * `.gauntlet/shots/cutin/` are now tracked, deliberately, so a grader can date
 * browser evidence instead of trusting it. The exclusion survives the change
 * because it never rested on those files being untracked; it rests on them
 * being derived. But a justification that has gone false is worth exactly as
 * much as no justification, so it is corrected here rather than left to read
 * plausibly.
 *
 * THE HOLE THIS LEAVES, stated rather than glossed, and it is now three files
 * wide rather than one:
 *
 *   - `.gauntlet/state.json` — run bookkeeping for the loop, typed by hand.
 *   - `.gauntlet/shots/shell/route.json` and `.../cutin/frames.json` — copy
 *     strings SCRAPED FROM THE RUNNING APP. A real name could only get into
 *     them by first existing in `src/`, where this audit does scan it, so the
 *     derived-copy argument holds; what does not hold is any claim that the
 *     scrape itself is checked.
 *   - the committed PNGs, which are pixels. A real wordmark DRAWN by the
 *     sprite code would be invisible to a string audit in any directory, so
 *     this is not a hole `.gauntlet` opened.
 *
 * None of these reach a build.
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
 * THE `NOT_WALKED` ENTRIES THAT ACTUALLY HIDE TRACKED FILES — pinned, because an
 * exclusion that hides nothing and one that hides committed prose are not the
 * same risk and the list above does not distinguish them.
 *
 * Five of the seven hide NOTHING: `node_modules`, `.git`, `.expo`, `dist` and
 * `coverage` are vendored or generated and nothing under them is committed. If
 * one of them starts hiding a tracked file — somebody commits a build output, or
 * checks in a dependency — that is a real change in this audit's reach and it
 * reddens here rather than passing as a silence.
 *
 * TWO OF THEM DO, AND THAT IS THE HOLE, STATED AS A NUMBER INSTEAD OF A SENTENCE.
 * At the time of writing, 73 tracked files are invisible to this scan: 71 under
 * `.gauntlet` and 2 under `.claude`. Nine of them carry 65 watchlist mentions
 * between them. Read that before treating either exclusion as free:
 *
 *   - `.gauntlet` — 71 files. 64 of the 65 mentions are in captured `vitest`
 *     transcripts and are copies of strings this audit reads at their source,
 *     which is the argument the section above makes and it holds. The exception
 *     is `.gauntlet/state.json`: HAND-TYPED run bookkeeping, 11 mentions, and the
 *     header already names it as the part of this exclusion that is not derived.
 *     It is left out of the scan anyway, because it is rewritten every wave and
 *     pinning its citations would move `REVIEWABLE_CITATIONS` on a schedule that
 *     has nothing to do with the code. That is a JUDGEMENT and not a category,
 *     which is precisely what `DELIBERATELY_NOT_WATCHED` warns about — so it is
 *     written here for a human to overrule rather than left to be inferred.
 *   - `.claude` — 2 files, `agents/builder.md` and `agents/critic.md`, both
 *     hand-written and both carrying ZERO watchlist mentions. THE EXCLUSION IS
 *     WIDER THAN ITS OWN STATED REASON: that reason is `worktrees/`, which is a
 *     complete second checkout, and it does not reach two agent definitions
 *     sitting beside it. Narrowing it means matching a PATH rather than a
 *     basename, which is a change to the walk rather than to this list, so it is
 *     reported here rather than done from this piece.
 *
 * The 73 and the 65 are MEASUREMENTS AND NOT PINS, and the difference is
 * deliberate: both move whenever anybody re-takes an evidence bundle, so pinning
 * them would rebuild the exact "verdict moves with when somebody last ran the
 * suite" failure the `.gauntlet` exclusion exists to avoid. What is pinned is the
 * SET of entries doing the hiding, which does not move on a capture.
 */
export const NOT_WALKED_HIDES_TRACKED: readonly string[] = Object.freeze(['.claude', '.gauntlet']);

/** What the filesystem walk and the repository's own file list disagree about. */
export interface ReachReport {
  /** Tracked files the walk never reached, explained by a `NOT_WALKED` entry. */
  readonly hiddenByNotWalked: readonly string[];
  /** Which `NOT_WALKED` entries did that hiding, sorted. */
  readonly hidingDirectories: readonly string[];
  /** Walked files git does not track. Scanned anyway; reported, never pinned. */
  readonly walkedButUntracked: readonly string[];
  /**
   * Tracked files the walk missed that NO `NOT_WALKED` entry explains.
   *
   * ALWAYS A FINDING. There is no benign reason for one: it means the walk is
   * dropping committed files for a reason nobody wrote down, which is the
   * silent-reach failure in its purest form.
   */
  readonly strays: readonly string[];
}

/**
 * The files a PINNED CENSUS may be counted over: walked and tracked, in walk
 * order.
 *
 * Separate from the scan on purpose, and it is one line so that the narrowing is
 * a thing a test can drive rather than a filter buried at a call site. On a clean
 * checkout this returns its input unchanged, so an assertion about it taken only
 * against the real tree is an empty domain — `realIp.test.ts` drives it with a
 * synthetic untracked file for exactly that reason.
 */
export function censusScope(
  walked: readonly string[],
  tracked: readonly string[],
): readonly string[] {
  const trackedSet = new Set(tracked);
  return walked.filter((file) => trackedSet.has(file));
}

/**
 * Compare the two views of the tree. Pure: the caller does the git and the fs.
 *
 * `notWalked` is matched on any PATH SEGMENT, which is how the walk itself
 * matches it — so this reports the same exclusions the walk actually applied
 * rather than a second interpretation of the same list.
 */
export function reachReport(
  walked: readonly string[],
  tracked: readonly string[],
  notWalked: readonly string[] = NOT_WALKED,
): ReachReport {
  const walkedSet = new Set(walked);
  const trackedSet = new Set(tracked);
  const hiddenByNotWalked: string[] = [];
  const strays: string[] = [];
  const hiding = new Set<string>();
  for (const file of tracked) {
    if (walkedSet.has(file)) continue;
    const excluder = file.split('/').find((segment) => notWalked.includes(segment));
    if (excluder === undefined) strays.push(file);
    else {
      hiddenByNotWalked.push(file);
      hiding.add(excluder);
    }
  }
  return {
    hiddenByNotWalked: hiddenByNotWalked.sort(),
    hidingDirectories: [...hiding].sort(),
    walkedButUntracked: walked.filter((f) => !trackedSet.has(f)).sort(),
    strays: strays.sort(),
  };
}

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
 *
 * "NARROW" MEANS THE LITERAL, NOT THE REGION. `declarationRegions` runs each
 * declaration up to the next one, so a region includes the doc comment of
 * whatever follows it; taken literally that put a long paragraph of prose inside
 * an exempt window, and the window grew every time somebody wrote a longer
 * comment. `declarationLiteralEnd` cuts each range at the declaration's own
 * closing bracket instead. `realIp.test.ts` plants a name in the paragraph that
 * used to be covered and asserts it is reported.
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

const BRACKET_OPEN = '([{';
const BRACKET_CLOSE = ')]}';

/**
 * The last line of a declaration's own LITERAL, given its region.
 *
 * WHY THIS EXISTS AND WHAT IT CLOSES. `declarationRegions` splits a file at
 * top-level declarations, so a region runs from its `export const` line all the
 * way to the line before the NEXT declaration — which means it swallows the doc
 * comment belonging to whatever comes next. Applied to the self-exemption that
 * put the twenty-odd lines of prose introducing `DELIBERATELY_NOT_WATCHED`
 * inside `REAL_IP_WATCHLIST`'s exempt window, where a real brand could have been
 * written into a paragraph and this audit would have said nothing. Nothing had;
 * the widening was found by measuring the ranges rather than by a finding. It
 * grew as the file's prose grew, which is the property that made it worth
 * closing rather than noting: an exemption that widens whenever somebody writes
 * a longer comment is not a narrow exemption.
 *
 * The end is found by balancing brackets over `codeOnly` output, where comments
 * and string CONTENTS are already blanked — so a `(` inside a note, a URL or a
 * prose paragraph cannot move it.
 *
 * FAILS CLOSED. If the brackets never balance inside the region, this returns
 * `null` and the caller exempts NOTHING for that region, so the names in it are
 * reported and the suite goes red. A reformatting that defeats the balance
 * therefore announces itself instead of silently opening the file up.
 */
export function declarationLiteralEnd(
  codeLines: readonly string[],
  fromLine: number,
  toLine: number,
): number | null {
  let depth = 0;
  let opened = false;
  for (let i = fromLine; i < Math.min(toLine, codeLines.length); i += 1) {
    for (const ch of codeLines[i] ?? '') {
      if (BRACKET_OPEN.includes(ch)) {
        depth += 1;
        opened = true;
      } else if (BRACKET_CLOSE.includes(ch)) {
        depth -= 1;
      }
    }
    if (opened && depth <= 0) return i;
  }
  return null;
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

  // The self-exemption, held to the DECLARATION'S OWN LITERAL rather than to the
  // whole region `declarationRegions` returns — see `declarationLiteralEnd` for
  // the difference and why it matters. Both bounds are 1-based, inclusive.
  const exemptRanges: { from: number; to: number }[] = [];
  if (relPath === WATCHLIST_FILE) {
    const code = codeOnly(source);
    const codeLines = code.split('\n');
    for (const region of declarationRegions(code)) {
      if (!WATCHLIST_REGIONS.includes(region.name)) continue;
      const end = declarationLiteralEnd(codeLines, region.fromLine, region.toLine);
      if (end === null) continue;
      exemptRanges.push({ from: region.fromLine + 1, to: end + 1 });
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
 * ===========================================================================
 * THIS LIST WAS 60 ROWS AND WAS WRONG. IT IS 145, AND THE 85 THAT WERE MISSING
 * OUTWEIGH EVERYTHING THAT WAS ON IT
 * ===========================================================================
 *
 * Read this before quoting a number off this list, because the number was quoted
 * before and it was quoted wrong. The count a human is asked to rule on is only
 * as good as the watchlist that produced it, and the watchlist had TWO holes of
 * the same shape, found a week apart by different readers:
 *
 *   was:  60 rows,  84 mentions, 18 files
 *   now: 145 rows, 295 mentions, 42 files
 *
 * WHAT THE 85 NEW ROWS ARE, so the groups can be ruled on separately — they are
 * not obviously the same question:
 *
 *   - 29 rows / 103 mentions / 15 files — THE OPEN-RESULTS PROJECT AND MEET
 *     SOFTWARE this repository transcribes its result-card format, its DOTS
 *     implementation, its plate ladder and its meet flow out of. More than every
 *     federation acronym on the list put together.
 *   - 23 rows /  57 mentions / 15 files — CONSOLE, FRANCHISE AND CHARACTER
 *     MARKS. The art bar is defined by era comparison, so the art modules argue
 *     about colour depth, vblank-authored animation and how tall a fighting-game
 *     lead stood. Found by a critic grading the figure rig, not by this module.
 *   - 15 rows /  23 mentions /  4 files — THE ACCOUNTS AND APPS whose files the
 *     RPE and DOTS transcriptions were read from, in pinned-commit URLs.
 *   - 12 rows /  21 mentions / 11 files — TWO NAMED COMPANIES the governing
 *     documents use as the daily-loop bar and as the backend architecture.
 *   -  6 rows /   7 mentions /  3 files — A BASEBALL LEAGUE, A CLUB AND A
 *     CURRENTLY-COMPETING PLAYER, transcribed from the caption of a committed
 *     reference image. §12.3's own example of how a real mark arrives.
 *
 * NOTHING WAS SHIPPING. Category (A) — the default-deny half over every string a
 * screen can draw — was green throughout and is green now, for the correct
 * reason rather than by luck. Almost every new mention is provenance in a
 * comment; the `code` ones are retrieval URLs in `url:` fields and named
 * constants encoding an era measurement, and none of them renders. What was
 * broken was the INSTRUMENT, and the failure mode is worth naming precisely: a
 * default-deny audit that cannot see a name reports the same green as one that
 * can. A builder added a fresh mention of one of these names in the wave this
 * paragraph was written and the suite did not move.
 *
 * SO THE RULING BELOW IS UNCHANGED AND THE ARITHMETIC IS NOT. Whether these
 * citations may stay is the same open "citation versus content" question GDD §11
 * carries for the federation names, and it is not answered here. What changed is
 * that the question can now be asked about a real number.
 *
 * ===========================================================================
 * ONE ROW OF THIS LIST WAS RULED ON A DESCRIPTION THAT DID NOT MATCH THE CODE
 * ===========================================================================
 *
 * Read this before trusting any sentence below. The bullet on `pixelFont.test.ts`
 * used to say it was "the one row on this list that is a real name being used as
 * ordinary test DATA rather than cited as provenance". That was FALSE when it was
 * written. `resultCard.test.ts` held a real, currently-competing athlete's name
 * at `code` position four times, as that file's GENERAL-PURPOSE LIFTER FIXTURE —
 * driving the blank-division test, the sex-formatting test, and an assertion that
 * the name renders onto a result card — plus a second real name twice more. Both
 * were grouped under "published records cited to anchor tests" and ruled into the
 * pinned-not-refused half on the strength of that grouping.
 *
 * They are gone now (see the two `resultCard.test.ts` entries below), and so is
 * the `pixelFont.test.ts` one. The lesson is worth more than the fix: THE
 * MACHINE PINS THE ROWS, THE PROSE CLASSIFIES THEM, AND ONLY THE ROWS ARE
 * CHECKED. A group description that drifts from what is in the group is
 * invisible to every test in this file, and it is the one part of this module a
 * reader has to verify by opening the files rather than by running the suite.
 *
 * WHAT IS ON IT TODAY, and the judgement for each group:
 *
 *   - `dots.test.ts` — A PUBLISHED RECORD, cited to anchor a plausibility band.
 *     Two real athletes' names in COMMENTS, next to the totals and bodyweights
 *     the DOTS polynomial is checked against. This is the practice CLAUDE.md's
 *     domain-correctness section requires — "use the published coefficients; do
 *     not homebrew" — and deleting the names would leave two magic numbers with
 *     no way to check them. KEEP unless a human decides otherwise.
 *   - `resultCard.test.ts` — A REAL FEDERATION EXPORT'S SHAPE. What is left is
 *     the federation acronym: `code` in the name of the constant holding the
 *     published CSV header and in two test titles, `comment` in the block citing
 *     the source URL and meet. The two rows this file reproduces are still
 *     verbatim in every cell that is a CONVENTION — signs, roundings, blanks,
 *     "DQ" — and INVENTED in the one cell that is an IDENTITY. See the header
 *     above those fixtures for the split and why it falls there. KEEP.
 *   - `meet.ts`, `plates.ts`, `palette.ts`, `resultCard.ts`, `spriteTuning.ts`,
 *     `spriteMarks.ts` — STRUCTURAL RULE REFERENCES. Naming the body that
 *     publishes a rule being implemented (bar weights, plate ladder, plate
 *     colours, knurl spacing). §3 of this header is the ruling. KEEP.
 *     (`meetPalette.ts`, `gymPalette.ts` and `CLAUDE.md` used to be named in
 *     this bullet and have no rows on the list; the first two lost their
 *     citations to rewrites and the third never had one. Corrected rather than
 *     left, because a group description that names files it does not contain is
 *     the exact drift the paragraph above this one is about.)
 *   - `dots.ts`, `dots.test.ts`, `meet.ts`, `meet.test.ts`, `meetServer.ts`,
 *     `meetTuning.ts`, `resultCard.ts`, `resultCard.test.ts`, `plates.ts`,
 *     `plates.test.ts`, `palette.ts`, `palette.test.ts`, `gymScene.test.ts`,
 *     `AttemptBoard.tsx`, `docs/GDD.md` — THE OPEN-RESULTS PROJECT, ITS MEET
 *     SOFTWARE, AND TWO OTHER MEET PLATFORMS. 29 rows, 103 mentions, 15 files:
 *     the largest group on this list and the one that was missing from it
 *     entirely until the `project` block was added to the watchlist. Every one
 *     is a RETRIEVAL CITATION — the URL a format was transcribed from, the
 *     repository a coefficient implementation was read out of, the two platforms
 *     `meetTuning.ts` records as having refused the request when it went looking
 *     for broadcast timings. All in comments; none renders. The judgement is the
 *     same one §3 makes for a federation acronym and it is the same OPEN
 *     question: a citation with its source struck out is not a citation, and a
 *     real organisation's name in a comment is still a real organisation's name.
 *     NOT RULED HERE. Counted, which is what was missing.
 *   - `rpe.ts`, `rpe.test.ts`, `dots.ts`, `resultCard.ts` — THE ACCOUNTS AND
 *     APPS THE TRANSCRIPTIONS CAME FROM. 15 rows, 23 mentions. Half of them are
 *     `code` rather than `comment`, because `CHART_SOURCES` holds its retrieval
 *     URLs in `url:` fields; that is a structural choice `rpe.ts` argues for at
 *     length and not a name leaking toward a screen. Thinner identities than the
 *     rest of this list — an account handle is not a mark this game could be
 *     accused of trading on — and correspondingly the easiest group for a human
 *     to strike in one edit. Listed rather than pre-struck, so striking them is
 *     a decision. NOT RULED HERE.
 *   - `craftMetrics.ts`, `craftMetrics.test.ts`, `lifterSprite.test.ts`,
 *     `palette.ts`, `palette.test.ts`, `gymPalette.ts`, `gymPalette.test.ts`,
 *     `gymTuning.ts`, `spriteTuning.ts`, `spriteMarks.ts`, `cardTuning.ts`,
 *     `docs/GDD.md`, `docs/reference/README.md`, `BUILD_PROMPT_CLAUDE.md`, and
 *     one reference FILENAME — CONSOLE, FRANCHISE AND CHARACTER MARKS. 23 rows,
 *     57 mentions, 15 files. These are ERA MEASUREMENTS: the colour depth a
 *     palette is quantised to, the vblank a frame is held for, the sprite height
 *     a figure is scaled against. GDD §7.1 titles a section with one of them and
 *     §12.2 makes them the art bar, so unlike the citations above these are
 *     named by the design document itself — which is an argument for keeping
 *     them and also the reason there are so many. Six of the rows are `code`:
 *     era numbers live in named constants, so the mark is in an identifier.
 *     A SEPARATE QUESTION FROM THE ONE ABOVE and likely to be ruled differently
 *     — a rulebook citation and "our lifter is shorter than theirs" are not the
 *     same kind of reference. NOT RULED HERE.
 *   - `docs/reference/README.md`, `lifterSprite.test.ts`, `craftMetrics.ts` — A
 *     BASEBALL LEAGUE, A CLUB, AND A CURRENTLY-COMPETING PLAYER. 6 rows, 7
 *     mentions. They arrive through the CAPTION OF A COMMITTED REFERENCE IMAGE,
 *     transcribed into a doc and two art modules to explain why that image is a
 *     NEGATIVE control. §12.3 names this exact route. Worth a human's eye ahead
 *     of the rest of this list, because it is the only group here naming a
 *     living athlete who is not a powerlifter and has no reason to expect to be
 *     in this repository at all — and because the IMAGE ITSELF carries that
 *     league's logo and that player's likeness in pixels, where no text scan
 *     will ever find them. NOT RULED HERE.
 *   - `streak.ts`, `streak.test.ts`, `tuning/index.ts`, `progression.ts`,
 *     `progression.test.ts`, `sessionServer.ts`, `meetServer.ts`,
 *     `appServer.ts`, `localSessionServer.ts`, `CLAUDE.md`, `docs/GDD.md` — TWO
 *     NAMED COMPANIES. 12 rows, 21 mentions. One is the daily-loop bar GDD §12.2
 *     names; the other is the backend CLAUDE.md's architecture section names.
 *     Both are prose and comments about design decisions, and neither is a
 *     dependency — if either becomes one, the code-host reasoning in
 *     `DELIBERATELY_NOT_WATCHED` starts to apply and this group should be
 *     revisited. NOT RULED HERE.
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
 *   - `meetTuning.test.ts` — REMOVED. This was the bespoke five-name federation
 *     ban this module generalises, listed with "KEEP until whoever owns that
 *     file removes the now-redundant test". The meet-day builder did: the test
 *     now asserts only that the federation is invented and not blank, and the
 *     names it used to carry are gone. `src/meet/meetIdentity.test.ts` runs this
 *     module's own `scanRenderable` over every string meet day can draw
 *     instead, and takes the one name it plants as a positive control OUT OF
 *     `REAL_IP_WATCHLIST` at runtime rather than spelling it. Five rows fewer.
 *   - `pixelFont.test.ts` — REMOVED. A real lifter's ACCENTED name, used as the
 *     diacritic-folding fixture for the card font, at `code` position. It was
 *     listed rather than refused, with "the clearest candidate for a human to
 *     replace with an invented accented name" and a note that `src/card/`
 *     belonged to another piece. It is replaced now: `Aurélien Mourcade`, with
 *     the acute-e kept in both its precomposed and decomposed forms, because
 *     those are the two shapes the fold path branches on and the substitution is
 *     only safe if the glyph coverage is re-checked rather than assumed. One row
 *     fewer.
 *   - `resultCard.test.ts` — SIX ROWS REMOVED, and they were the reason the
 *     paragraph at the top of this header exists. Two real athletes' names, at
 *     `code` position six times between them, were this file's general-purpose
 *     lifter fixtures rather than provenance for anything. GDD §12.3 names
 *     exactly this — "a placeholder lifter name in a test fixture" — as one of
 *     the two ways a real mark actually arrives. The invented replacements carry
 *     the identical load and the citation is untouched. (Two rows for an apparel
 *     brand's three-letter acronym went with them — described rather than spelled,
 *     per §1: it appeared only inside the quoted CSV rows, whose name and
 *     federation cells are now redacted to `<lifter>` and `<fed>`. The source URL
 *     and the meet are still named in the block above them, which is what makes
 *     the citation checkable. Watching this paragraph try to spell the acronym
 *     and being refused by this module's own self-scan is, incidentally, the
 *     check working: it fired on the sentence that removed the rows.)
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
 * THAT COST HAS ROUGHLY DOUBLED AND SHOULD BE EXPECTED ON MERGE — say it plainly
 * so nobody debugs it twice. The rows below were regenerated against a branch
 * cut from the integration branch mid-wave, and the list went from 18 files to
 * 42. The new files include most of `src/art/` — the figure rig, the craft
 * metrics, the palettes, the sprite tuning — because the era marks are cited in
 * exactly the modules being reworked hardest, by builders in parallel worktrees,
 * right now. Expect this test to be the first thing that reds on a merge.
 *
 * A count that is off by one on merge is this list WORKING, not this list
 * broken: regenerate from the block the test prints, read the diff, and only
 * worry if a row DISAPPEARED that nobody meant to remove.
 *
 * (The previous note here described a `src/art/gymPalette.ts` row that would be
 * "one row too many" after a merge. There is no such row and there was none when
 * that note was written; the removal it anticipated had already happened. It is
 * replaced rather than kept, on the same principle as the drift paragraph above:
 * an instruction to delete a line that does not exist sends the next reader
 * looking for a bug in the scan.)
 */
export const REVIEWABLE_CITATIONS: readonly CitationRow[] = Object.freeze([
  { file: 'BUILD_PROMPT_CLAUDE.md', name: 'Genesis', where: 'prose', count: 1 },
  { file: 'BUILD_PROMPT_CLAUDE.md', name: 'SNES', where: 'prose', count: 1 },
  { file: 'CLAUDE.md', name: 'Supabase', where: 'prose', count: 2 },
  { file: 'docs/GDD.md', name: 'Duolingo', where: 'prose', count: 5 },  { file: 'docs/GDD.md', name: 'Game Boy', where: 'prose', count: 1 },
  { file: 'docs/GDD.md', name: 'Genesis', where: 'prose', count: 2 },
  { file: 'docs/GDD.md', name: 'Madden', where: 'prose', count: 1 },
  { file: 'docs/GDD.md', name: 'NBA 2K', where: 'prose', count: 1 },
  { file: 'docs/GDD.md', name: 'NPL', where: 'prose', count: 1 },
  { file: 'docs/GDD.md', name: 'OpenPowerlifting', where: 'prose', count: 1 },
  { file: 'docs/GDD.md', name: 'SNES', where: 'prose', count: 2 },
  { file: 'docs/GDD.md', name: 'Supabase', where: 'prose', count: 4 },
  { file: 'docs/GDD.md', name: 'USAPL', where: 'prose', count: 1 },
  { file: 'docs/GDD.md', name: 'USPA', where: 'prose', count: 1 },
  { file: 'docs/reference/meet-photo-ref-1-ipf-squat-bottom.webp', name: 'IPF', where: 'filename', count: 1 },
  { file: 'docs/reference/README.md', name: 'IPF', where: 'prose', count: 2 },
  { file: 'docs/reference/README.md', name: 'MLB', where: 'prose', count: 1 },
  { file: 'docs/reference/README.md', name: 'Mullins', where: 'prose', count: 1 },
  { file: 'docs/reference/README.md', name: 'Orioles', where: 'prose', count: 1 },
  { file: 'docs/reference/README.md', name: 'SNES', where: 'prose', count: 4 },
  { file: 'docs/reference/sprite-ref-1-snes-wrestling.png', name: 'SNES', where: 'filename', count: 1 },
  // ---------------------------------------------------------------------------
  // `docs/research/` — DERIVED-DATA PROVENANCE. 32 rows, 6 names, 7 files.
  //
  // Registered on an explicit human ruling, and the scope of that ruling is
  // worth writing down because the cheap alternative was available and refused:
  // `docs/research/**` is NOT on `NOT_WALKED`, no pattern was widened to stop
  // the directory being read, and no count here is a bound. A new real name
  // arriving in any of these files, or any of these counts moving by one, still
  // reddens `realIp.test.ts`. The ruling was "register them like every other
  // citation", not "exempt them".
  //
  // WHAT THEY ARE. `docs/research/qualifying-totals.md` derives a qualifying
  // total per tier x sex x weight class from a public results database, because
  // every published federation standards page is HTTP 403 from this
  // environment. The names are the database, the two US federations and the
  // international one whose meets the rows come from — i.e. the provenance of
  // every number in the document. Deleting them would leave a table of numbers
  // with no attributable source, which is the failure `dots.ts` and `meet.ts`
  // are already allowed to avoid for the same reason.
  //
  // THE BULK ROWS ARE MACHINE-GENERATED AND THAT IS THE PART TO WATCH. The two
  // `-meets-*.txt` files are the tier-mapping audit — every meet, its assigned
  // tier and its row contribution — and their x275 is one federation acronym
  // arriving inside 275 verbatim third-party meet titles. That is a data dump
  // rather than 275 citations, and the file was already trimmed once (2,992
  // lines to 346, ~2,400 mentions to 275) with both reasons stated in the
  // script. A human may reasonably decide the generated artifacts should not be
  // committed at all; that is a legal-exposure call and it is flagged rather
  // than taken.
  //
  // SIX OF THESE ROWS ARE `SBD` AND NONE OF THEM IS THE APPAREL BRAND. In this
  // sport `SBD` is the standard abbreviation for squat-bench-deadlift and is
  // the dataset's own value for the full-power event; the `code` rows are that
  // enum value and the `prose` ones are the document explaining it. The single
  // genuine brand mention is inside a verbatim meet title in the audit `.txt`.
  // A reader of this list cannot tell those apart from the row alone, which is
  // why it is said here.
  { file: 'docs/research/qualifying-totals-derived-raw.json', name: 'IPF', where: 'code', count: 1 },
  { file: 'docs/research/qualifying-totals-derived-raw.json', name: 'SBD', where: 'code', count: 1 },
  { file: 'docs/research/qualifying-totals-derived-raw.json', name: 'USAPL', where: 'code', count: 3 },
  { file: 'docs/research/qualifying-totals-derived-single-ply.json', name: 'IPF', where: 'code', count: 1 },
  { file: 'docs/research/qualifying-totals-derived-single-ply.json', name: 'SBD', where: 'code', count: 1 },
  { file: 'docs/research/qualifying-totals-derived-single-ply.json', name: 'USAPL', where: 'code', count: 3 },
  { file: 'docs/research/qualifying-totals-meets-raw.txt', name: 'IPF', where: 'prose', count: 11 },
  { file: 'docs/research/qualifying-totals-meets-raw.txt', name: 'SBD', where: 'prose', count: 1 },
  { file: 'docs/research/qualifying-totals-meets-raw.txt', name: 'USAPL', where: 'prose', count: 275 },
  { file: 'docs/research/qualifying-totals-meets-single-ply.txt', name: 'IPF', where: 'prose', count: 11 },
  { file: 'docs/research/qualifying-totals-meets-single-ply.txt', name: 'SBD', where: 'prose', count: 1 },
  { file: 'docs/research/qualifying-totals-meets-single-ply.txt', name: 'USAPL', where: 'prose', count: 275 },
  { file: 'docs/research/qualifying-totals-NOTES.md', name: 'IPF', where: 'prose', count: 1 },
  { file: 'docs/research/qualifying-totals-NOTES.md', name: 'OpenPowerlifting', where: 'prose', count: 1 },
  { file: 'docs/research/qualifying-totals-NOTES.md', name: 'OPL', where: 'prose', count: 2 },
  { file: 'docs/research/qualifying-totals-NOTES.md', name: 'USAPL', where: 'prose', count: 1 },
  // The two federation names below arrive as the HOSTS OF UNREACHABLE
  // STANDARDS PAGES — §6.1 of that document is a list of what a human with an
  // open browser should retrieve, and a retrieval list with the sources struck
  // out is not a retrieval list.
  { file: 'docs/research/qualifying-totals.md', name: 'British Powerlifting', where: 'prose', count: 1 },
  { file: 'docs/research/qualifying-totals.md', name: 'IPF', where: 'prose', count: 1 },
  { file: 'docs/research/qualifying-totals.md', name: 'OpenPowerlifting', where: 'prose', count: 5 },
  { file: 'docs/research/qualifying-totals.md', name: 'OPL', where: 'prose', count: 3 },
  { file: 'docs/research/qualifying-totals.md', name: 'Powerlifting America', where: 'prose', count: 1 },
  { file: 'docs/research/qualifying-totals.md', name: 'SBD', where: 'prose', count: 4 },
  { file: 'docs/research/qualifying-totals.md', name: 'USAPL', where: 'prose', count: 1 },
  { file: 'docs/research/qualifyingTotalsDerive.mjs', name: 'IPF', where: 'code', count: 1 },
  { file: 'docs/research/qualifyingTotalsDerive.mjs', name: 'IPF', where: 'comment', count: 1 },
  { file: 'docs/research/qualifyingTotalsDerive.mjs', name: 'OpenPowerlifting', where: 'comment', count: 2 },
  { file: 'docs/research/qualifyingTotalsDerive.mjs', name: 'OPL', where: 'comment', count: 4 },
  { file: 'docs/research/qualifyingTotalsDerive.mjs', name: 'SBD', where: 'code', count: 1 },
  { file: 'docs/research/qualifyingTotalsDerive.mjs', name: 'USAPL', where: 'code', count: 3 },
  { file: 'docs/research/qualifyingTotalsDerive.mjs', name: 'USAPL', where: 'comment', count: 1 },
  { file: 'src/art/craftMetrics.test.ts', name: 'SNES', where: 'code', count: 6 },
  { file: 'src/art/craftMetrics.ts', name: 'MLB', where: 'comment', count: 1 },
  { file: 'src/art/craftMetrics.ts', name: 'SNES', where: 'code', count: 6 },
  { file: 'src/art/craftMetrics.ts', name: 'SNES', where: 'comment', count: 3 },
  { file: 'src/art/gymPalette.test.ts', name: 'SNES', where: 'comment', count: 2 },
  { file: 'src/art/gymPalette.ts', name: 'SNES', where: 'comment', count: 2 },
  // `gymScene.test.ts` is now the LAST bespoke real-IP ban in the tree; its
  // names are here because they are the check's own operands. The environment
  // builder wrote it independently and before this module existed, which is
  // worth recording rather than tidying away — three builders reached for a
  // hand-written watchlist unprompted (this one, that one, and a first draft of
  // `meetIdentity.test.ts`), which is the argument for this module generalising
  // them rather than the argument against it. `meetTuning.test.ts`'s ban has
  // since been retired by its owner and its five rows are gone from this list.
  // KEEP until whoever owns this one removes the now-redundant test.
  { file: 'src/art/gymScene.test.ts', name: 'Adidas', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Amanda Lawrence', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'BVDK', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Ed Coan', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Eddie Hall', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Eleiko', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'GPC', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Inzer', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'IPF', where: 'code', count: 2 },
  { file: 'src/art/gymScene.test.ts', name: 'Ivanko', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Jesus Olivares', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Julius Maddox', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Larry Wheels', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Nike', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'NPL', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'OpenLifter', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'OpenPowerlifting', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Powerlifting America', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Ray Williams', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Reebok', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'SBD', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Taylor Atwood', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'Under Armour', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'USAPL', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'USPA', where: 'code', count: 1 },
  { file: 'src/art/gymScene.test.ts', name: 'WRPF', where: 'code', count: 1 },
  { file: 'src/art/gymTuning.ts', name: 'SNES', where: 'comment', count: 1 },
  { file: 'src/art/lifterSprite.test.ts', name: 'MLB', where: 'comment', count: 2 },
  { file: 'src/art/lifterSprite.test.ts', name: 'Mullins', where: 'comment', count: 1 },
  { file: 'src/art/lifterSprite.test.ts', name: 'SNES', where: 'code', count: 3 },
  { file: 'src/art/lifterSprite.test.ts', name: 'SNES', where: 'comment', count: 5 },
  { file: 'src/art/palette.test.ts', name: 'OpenLifter', where: 'comment', count: 1 },
  { file: 'src/art/palette.test.ts', name: 'SNES', where: 'comment', count: 1 },
  { file: 'src/art/palette.ts', name: 'Genesis', where: 'comment', count: 3 },
  // `gymPalette.ts` HAD a federation citation for the plate-colour standard and
  // no longer does: its builder rewrote the comment to state the standard without
  // naming the body. That is a removal this list is supposed to notice, and it
  // was noticed — on merge, by this test, exactly as designed.
  { file: 'src/art/palette.ts', name: 'IPF', where: 'comment', count: 2 },
  { file: 'src/art/palette.ts', name: 'OpenLifter', where: 'comment', count: 6 },
  { file: 'src/art/palette.ts', name: 'OpenPowerlifting', where: 'comment', count: 1 },
  { file: 'src/art/palette.ts', name: 'SNES', where: 'comment', count: 6 },
  { file: 'src/art/plates.test.ts', name: 'OpenLifter', where: 'comment', count: 1 },
  { file: 'src/art/plates.ts', name: 'IPF', where: 'comment', count: 2 },
  { file: 'src/art/plates.ts', name: 'OpenLifter', where: 'comment', count: 7 },
  { file: 'src/art/plates.ts', name: 'OpenPowerlifting', where: 'comment', count: 1 },
  { file: 'src/art/spriteMarks.ts', name: 'IPF', where: 'comment', count: 1 },
  { file: 'src/art/spriteMarks.ts', name: 'SNES', where: 'comment', count: 1 },
  { file: 'src/art/spriteTuning.ts', name: 'Genesis', where: 'comment', count: 1 },
  { file: 'src/art/spriteTuning.ts', name: 'IPF', where: 'comment', count: 1 },
  { file: 'src/art/spriteTuning.ts', name: 'Ryu', where: 'comment', count: 1 },
  { file: 'src/art/spriteTuning.ts', name: 'SNES', where: 'comment', count: 3 },
  { file: 'src/card/cardTuning.ts', name: 'SNES', where: 'comment', count: 1 },
  { file: 'src/card/renderResultCard.test.ts', name: 'IPF', where: 'comment', count: 1 },
  { file: 'src/card/sampleCards.ts', name: 'NPL', where: 'comment', count: 1 },
  { file: 'src/card/sampleCards.ts', name: 'USAPL', where: 'comment', count: 1 },
  { file: 'src/card/sampleCards.ts', name: 'USPA', where: 'comment', count: 1 },
  { file: 'src/game/dots.test.ts', name: 'Amanda Lawrence', where: 'comment', count: 1 },
  { file: 'src/game/dots.test.ts', name: 'IPF', where: 'comment', count: 1 },
  { file: 'src/game/dots.test.ts', name: 'Jesus Olivares', where: 'comment', count: 1 },
  // THE EXTERNAL SCORE PIN's provenance block. Two retrieval citations, both in
  // the same comment and both load-bearing: the pinned-commit URL the reference
  // implementation was fetched from, and the sentence recording that that
  // implementation's own header says it was copied from the other project — which
  // is the limit of what the pin establishes and cannot be written without naming
  // the project it was copied from.
  { file: 'src/game/dots.test.ts', name: 'OpenLifter', where: 'comment', count: 2 },
  { file: 'src/game/dots.test.ts', name: 'OpenPowerlifting', where: 'comment', count: 3 },
  { file: 'src/game/dots.test.ts', name: 'SBD', where: 'comment', count: 1 },
  { file: 'src/game/dots.test.ts', name: 'SBD Sheffield', where: 'comment', count: 1 },
  { file: 'src/game/dots.ts', name: 'BVDK', where: 'comment', count: 2 },
  { file: 'src/game/dots.ts', name: 'IPF', where: 'comment', count: 2 },
  { file: 'src/game/dots.ts', name: 'Marantesss', where: 'comment', count: 1 },
  { file: 'src/game/dots.ts', name: 'OpenPowerlifting', where: 'comment', count: 15 },
  { file: 'src/game/dots.ts', name: 'OPL', where: 'comment', count: 2 },
  { file: 'src/game/dots.ts', name: 'sstangl', where: 'comment', count: 1 },
  { file: 'src/game/meet.test.ts', name: 'OpenLifter', where: 'code', count: 5 },
  { file: 'src/game/meet.test.ts', name: 'OpenLifter', where: 'comment', count: 1 },
  { file: 'src/game/meet.test.ts', name: 'OpenPowerlifting', where: 'code', count: 1 },
  { file: 'src/game/meet.test.ts', name: 'OpenPowerlifting', where: 'comment', count: 1 },
  { file: 'src/game/meet.ts', name: 'IPF', where: 'comment', count: 4 },
  { file: 'src/game/meet.ts', name: 'OpenLifter', where: 'comment', count: 10 },
  { file: 'src/game/meet.ts', name: 'OpenPowerlifting', where: 'comment', count: 4 },
  { file: 'src/game/meet.ts', name: 'USAPL', where: 'comment', count: 1 },
  { file: 'src/game/meet.ts', name: 'USPA', where: 'comment', count: 1 },
  { file: 'src/game/meetServer.ts', name: 'OpenPowerlifting', where: 'comment', count: 1 },
  { file: 'src/game/meetServer.ts', name: 'Supabase', where: 'comment', count: 1 },
  { file: 'src/game/meetTuning.ts', name: 'goodlift.info', where: 'comment', count: 1 },
  { file: 'src/game/meetTuning.ts', name: 'LiftingCast', where: 'comment', count: 1 },
  { file: 'src/game/meetTuning.ts', name: 'NPL', where: 'comment', count: 1 },
  { file: 'src/game/meetTuning.ts', name: 'OpenPowerlifting', where: 'comment', count: 1 },
  { file: 'src/game/meetTuning.ts', name: 'USAPL', where: 'comment', count: 1 },
  { file: 'src/game/meetTuning.ts', name: 'USPA', where: 'comment', count: 1 },
  { file: 'src/game/progression.test.ts', name: 'Supabase', where: 'code', count: 1 },
  { file: 'src/game/progression.ts', name: 'Supabase', where: 'comment', count: 1 },
  { file: 'src/game/resultCard.test.ts', name: 'IPF', where: 'code', count: 7 },
  { file: 'src/game/resultCard.test.ts', name: 'IPF', where: 'comment', count: 4 },
  { file: 'src/game/resultCard.test.ts', name: 'OpenPowerlifting', where: 'comment', count: 2 },
  { file: 'src/game/resultCard.test.ts', name: 'OPL', where: 'comment', count: 2 },
  { file: 'src/game/resultCard.ts', name: 'IPF', where: 'comment', count: 3 },
  { file: 'src/game/resultCard.ts', name: 'NPL', where: 'comment', count: 1 },
  { file: 'src/game/resultCard.ts', name: 'OpenLifter', where: 'comment', count: 12 },
  { file: 'src/game/resultCard.ts', name: 'OpenPowerlifting', where: 'comment', count: 16 },
  { file: 'src/game/resultCard.ts', name: 'OPL', where: 'comment', count: 4 },
  { file: 'src/game/resultCard.ts', name: 'SBD', where: 'comment', count: 2 },
  { file: 'src/game/resultCard.ts', name: 'sstangl', where: 'comment', count: 2 },
  { file: 'src/game/resultCard.ts', name: 'Tiffany Chapon', where: 'comment', count: 1 },
  { file: 'src/game/resultCard.ts', name: 'USAPL', where: 'comment', count: 3 },
  { file: 'src/game/resultCard.ts', name: 'USPA', where: 'comment', count: 1 },
  { file: 'src/game/rpe.test.ts', name: 'karolczyz', where: 'code', count: 1 },
  { file: 'src/game/rpe.test.ts', name: 'karolczyz', where: 'comment', count: 1 },
  { file: 'src/game/rpe.test.ts', name: 'metriclift', where: 'code', count: 2 },
  { file: 'src/game/rpe.test.ts', name: 'metriclift', where: 'comment', count: 2 },
  { file: 'src/game/rpe.test.ts', name: 'Sculpt-AI', where: 'code', count: 1 },
  { file: 'src/game/rpe.test.ts', name: 'Sculpt-AI', where: 'comment', count: 2 },
  { file: 'src/game/rpe.ts', name: 'karolczyz', where: 'code', count: 1 },
  { file: 'src/game/rpe.ts', name: 'karolczyz', where: 'comment', count: 1 },
  { file: 'src/game/rpe.ts', name: 'metriclift', where: 'code', count: 2 },
  { file: 'src/game/rpe.ts', name: 'metriclift', where: 'comment', count: 1 },
  { file: 'src/game/rpe.ts', name: 'Sculpt-AI', where: 'code', count: 3 },
  { file: 'src/game/rpe.ts', name: 'Sculpt-AI', where: 'comment', count: 2 },
  { file: 'src/game/sessionServer.ts', name: 'Supabase', where: 'comment', count: 2 },
  { file: 'src/game/streak.test.ts', name: 'Duolingo', where: 'comment', count: 1 },
  { file: 'src/game/streak.ts', name: 'Duolingo', where: 'comment', count: 4 },
  { file: 'src/meet/AttemptBoard.tsx', name: 'OpenLifter', where: 'comment', count: 1 },
  { file: 'src/meet/AttemptBoard.tsx', name: 'OpenPowerlifting', where: 'comment', count: 1 },
  { file: 'src/session/localSessionServer.ts', name: 'Supabase', where: 'comment', count: 1 },
  { file: 'src/shell/appServer.ts', name: 'Supabase', where: 'comment', count: 1 },
  { file: 'src/tuning/audit.ts', name: 'IPF', where: 'code', count: 2 },
  { file: 'src/tuning/index.ts', name: 'Duolingo', where: 'comment', count: 1 },
  { file: 'src/tuning/index.ts', name: 'IPF', where: 'comment', count: 1 },
  { file: 'VISION.md', name: 'Madden', where: 'prose', count: 1 },
  { file: 'VISION.md', name: 'NBA 2K', where: 'prose', count: 1 },
]);
