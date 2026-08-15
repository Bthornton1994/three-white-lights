import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { bodyOfTestContaining, testScopeFault, withoutComments } from '../tuning/audit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

/**
 * ---------------------------------------------------------------------------
 * THE `@guarantee` CONVENTION: a comment that asserts behaviour names a test.
 * ---------------------------------------------------------------------------
 *
 * WHY IT EXISTS. Five times in this codebase a comment has asserted something
 * the code did not do, and the fifth was found inside the sentence that fixed
 * the fourth — `settleBrokenStreak`'s docstring justified an app-open-neutrality
 * guarantee with "the doomed burn is the armed amount", which is the exact
 * arithmetic a previous round MEASURED as a GDD §12.3 breach and rejected. Prose
 * cannot be typechecked, and every one of those five was written by someone who
 * believed it.
 *
 * WHAT THE TAG MEANS, EXACTLY, AND IT IS NARROWER THAN IT LOOKS. A comment
 * writing the tag followed by an id asserts that a test whose title contains
 * that id in square brackets exists, runs, and covers the claim. This file
 * mechanically checks the first two: the id resolves to exactly one test in the
 * tree, and that test is not skipped or todo'd. (The id is spelled out in words
 * here rather than shown, because the scan below reads this file too and an
 * example would have to resolve.)
 *
 * IT CANNOT CHECK THE THIRD, AND THAT IS THE HONEST LIMIT OF THE MECHANISM.
 * Nothing here can decide whether the named test would actually FAIL if the
 * guarantee were violated — that is what mutation testing is for, and it is a
 * human or an agent doing it deliberately, not a scanner. What the tag buys is
 * that the author had to go and find a test, that a reader can jump straight to
 * it, and that deleting or renaming the test breaks the build instead of quietly
 * orphaning the sentence. A claim with a dead link is caught; a claim with a
 * live link to a weak test is not.
 *
 * SAME DIALECT AS `@ours` AND `@ref`, deliberately. `spriteMarks.test.ts` and
 * `lifterSprite.test.ts` already scan the tree for a tag, resolve it against
 * something real, ban the untagged form inside a named file scope, and guard the
 * whole thing against vacuity. This is that mechanism with "a measured number"
 * swapped for "a named test". A third dialect would have been a third thing to
 * learn and a third thing to forget.
 */

// ---------------------------------------------------------------------------
// The tag
// ---------------------------------------------------------------------------

/**
 * `@guarantee settling-is-a-recording`.
 *
 * Kebab-case ids only. Not free text: an id has to be greppable, has to survive
 * being pasted into a test title, and must not be temptingly close to an English
 * sentence — a tag whose id is a description invites a second description
 * somewhere else, which is the defect class this file is about.
 */
const GUARANTEE_TAG = /@guarantee\s+([a-z][a-z0-9-]*)/g;

/**
 * How a test declares that it is the one a tag names: `[the-id]` anywhere in its
 * title.
 *
 * IN THE TITLE AND NOT IN A REGISTRY, because a registry is a third place that
 * can drift. Vitest prints the title on failure, so the id is in the output the
 * moment the guarantee breaks — which is the message a reader needs.
 */
const declarationOf = (id: string): string => `[${id}]`;

// ---------------------------------------------------------------------------
// The scoping rule — the honest part
// ---------------------------------------------------------------------------

/**
 * WHICH PROSE THIS FILE CLAIMS IS A GUARANTEE, AND WHAT IT THEREFORE MISSES.
 *
 * THE HARD PART IS THAT NO SCANNER CAN DECIDE THIS. "Asserts a behavioural
 * guarantee" is a judgement about meaning. Any mechanical rule is a proxy, and a
 * proxy that over-fires gets suppressed everywhere within a week, which is worse
 * than no rule at all. So the rule here is deliberately narrow and its shape is
 * written down rather than left to be inferred from the regex.
 *
 * THE RULE: a comment PARAGRAPH triggers if it contains a run of
 * `MIN_CAPS_RUN_WORDS` or more consecutive ALL-CAPS words, one of which is a
 * `GUARANTEE_TRIGGER`.
 *
 * IT IS KEYED TO THIS CODEBASE'S OWN HOUSE STYLE, which is the only reason it
 * works at all. The convention here is that a load-bearing claim opens its
 * paragraph in capitals — "IT CANNOT BE REACHED FROM A GAME EVENT", "THE ONLY
 * PLACE A RECOVERY DAY IS EVER SPENT". The capitals are the author already
 * flagging the sentence as one that matters; this rule just reads the flag.
 *
 * THE PARAGRAPH IS THE UNIT, not the file and not the comment block. A file is
 * far too coarse — `streak.ts`'s header is one 700-line block comment carrying
 * dozens of separate claims, and one tag on it would mean nothing. A sentence is
 * too fine, because the argument for a claim runs on past the sentence that
 * states it.
 *
 * WHAT IT CANNOT CATCH, measured rather than guessed:
 *
 *   - A GUARANTEE WRITTEN IN LOWER CASE. "this function never writes the armed
 *     snapshot" is exactly as load-bearing as the capitalised version and walks
 *     straight past. This is the big hole and it is the price of not
 *     over-firing: a trigger on the lower-case words fires on ordinary
 *     descriptive prose everywhere, including on sentences that are about the
 *     absence of a guarantee.
 *   - A GUARANTEE WITH NO ABSOLUTE IN IT. "the burn is fixed for the whole
 *     absence" asserts behaviour and contains none of the trigger words.
 *   - THE FIFTH DEFECT ITSELF, IF IT HAD BEEN PHRASED ONE WORD DIFFERENTLY. The
 *     false sentence — "the doomed burn is the armed amount rather than a
 *     function of the absence's length" — is lower-case prose. It is caught here
 *     only because the paragraph it sits in opens with a capitalised absolute.
 *     That is luck, and it is written down as luck.
 *   - ANY TRIGGERING PARAGRAPH OUTSIDE `GUARANTEE_PROSE_FILES`, which is most of
 *     them. See `GUARANTEE_COVERAGE` for the measured fraction.
 *   - A TAG POINTING AT A TEST THAT DOES NOT ACTUALLY BITE. This is the big one,
 *     it is not hypothetical, and it is measured. Eight of the nineteen tags
 *     below were mutation-tested when they were written; TWO OF THE EIGHT named
 *     a test that did not fail when the guarantee was broken:
 *
 *       `mid-absence-arrival-cannot-arm` named a test that only ever exercised
 *       the CALENDAR, so pointing a purchase straight at `armedEntitlement` left
 *       it green; and `protection-toggle-is-not-a-refill` named one whose fixture
 *       starts at a FULL window, so clearing the entitlement on the way out of
 *       the toggle was invisible — the refill and the real value were the same
 *       number.
 *
 *     Both tags RESOLVED PERFECTLY. Nothing in this file could have known. Both
 *     tests were strengthened by hand and both now fail on the mutant. A quarter
 *     is the honest error rate on a careful first pass, and the eleven tags that
 *     were not mutation-tested carry no evidence at all — they are a promise
 *     that somebody went and looked, which is worth something and is not worth
 *     what a green suite looks like it is worth.
 *
 *     `MUTATION_WITNESSES` is the answer to this one, and it is PARTIAL BY
 *     CONSTRUCTION: it binds tags declared from the round it was added, and
 *     leaves the rest on `UNWITNESSED_LEGACY_TAGS` as named, tracked debt. The
 *     error rate above is unchanged by it. What changed is that a reader can now
 *     tell which tags carry evidence and which carry a promise, instead of the
 *     two looking identical.
 *
 * WHAT IT DOES NOT DO: police tone. A capitalised run that is not a claim about
 * behaviour still has to carry a tag inside the scoped files, and the honest
 * response to that is to write the sentence in lower case, not to widen the
 * exemptions.
 */
const GUARANTEE_TRIGGERS: readonly string[] = ['NEVER', 'CANNOT', 'ALWAYS', 'ONLY'];

/**
 * Below this, a run of capitals is an acronym or a constant name rather than a
 * sentence. Two words admits `NEVER PUNISH`, which fires on section headings all
 * over the tree; three is where the false-positive rate went to zero on the
 * files below.
 */
const MIN_CAPS_RUN_WORDS = 3;

const CAPS_RUN = /\b[A-Z][A-Z0-9'`_.-]*(?:[ \t]+[A-Z][A-Z0-9'`_.-]*)+\b/g;

/**
 * THE FILES WHERE AN UNTAGGED GUARANTEE IS BANNED.
 *
 * TWO, AND NOT THE TREE, for the same reason `spriteMarks.test.ts` scopes its
 * untagged-integer ban to two files: a ban that fires 181 times on its first run
 * is a ban somebody deletes. These two are where all five of the false claims
 * were found, and they are the modules whose prose a §12.3 argument is actually
 * built on.
 *
 * THE TAG SCAN BELOW RUNS OVER THE WHOLE TREE. Only the REQUIREMENT is scoped —
 * so a `@guarantee` written anywhere in `src` still has to resolve, and adopting
 * the convention in a third module costs nothing but adding it to this list.
 */
const GUARANTEE_PROSE_FILES: readonly string[] = [
  'src/game/streak.ts',
  'src/game/streakEntitlement.ts',
];

/**
 * WHAT FRACTION OF THE CODEBASE'S GUARANTEE-ASSERTING PROSE IS ACTUALLY UNDER
 * THIS RULE — pinned, so the answer is a fact in the repository rather than a
 * claim in a report somebody has to trust.
 *
 * A partial mechanism that is honest about its coverage is worth more than one
 * that implies completeness. These numbers say plainly: about a tenth.
 */
const GUARANTEE_COVERAGE = {
  /** Triggering paragraphs in `GUARANTEE_PROSE_FILES`. All must carry a tag. */
  IN_SCOPE: 23,
  /**
   * Triggering paragraphs anywhere under `src`, the scoped ones included.
   *
   * It counts this file's own prose too, which is correct rather than an
   * artefact: these comments assert behaviour about the scanner and are exactly
   * as capable of being wrong as any other.
   *
   * 195 -> 198 when meet day was wired to the app's one row. The three new
   * triggering paragraphs are in `meetClient.ts`, `appServer.ts` and
   * `useMeetDay.ts`, and all three are the same claim in three places: that the
   * port the meet reads is the object the session writes. It is the ONE claim in
   * that change with a check that fails in a browser rather than only in prose
   * — `tools/verify-shell-route.mjs` reads the e1RM off a played close-out and
   * asserts the opener after it is derived from that number — so it is on the
   * better side of this file's own complaint, whatever the ratio does.
   *
   * 198 -> 205 when the second meet of an app run got a placeholder recap.
   * MEASURED PER FILE by removing each and re-reading this count, rather than
   * apportioned by eye: `careerCalendarPlaceholder.ts` 4,
   * `careerCalendarPlaceholder.test.ts` 3, and — worth recording because the
   * first guess said two — `CareerCalendarPlaceholderView.tsx` and the branch
   * added to `MeetScreen.tsx` contribute ZERO between them. Both of those were
   * written in lower case, which is exactly the blind spot this file's scoping
   * rule already declares: a lower-case guarantee walks past it.
   *
   * All seven are about the SAME claim — that the placeholder is scaffolding
   * that cannot quietly grow into calendar logic. It carries the tag
   * `placeholder-cannot-grow-calendar-authority` and a witness in the table
   * below, so the new prose is on the better side of this file's complaint —
   * but the ratio moved the wrong way and this comment is where that is said.
   *
   * 205 -> 206 when `DayOpening -> streakIfTrainedToday` became one function
   * instead of two disagreeing ternary chains. Measured per file the same way,
   * by restoring each touched file to its pre-fix text and re-reading this
   * count: `streak.ts`, `streakSweep.ts`, `sessionClient.ts`, `sessionServer.ts`
   * and `streak.test.ts` contribute nothing between them, and the single new
   * paragraph is the one in `sessionClient.test.ts` saying that the client and
   * the server now agree because there is one implementation. Its trigger word
   * is the fourth of the four; it is not quoted here, because quoting it made
   * this paragraph trigger too and took the count to 207 — the scan reading its
   * own documentation, which is a fair description of the limit.
   *
   * Worth recording: the much longer prose added to `streak.ts` uses none of the
   * four trigger words and walks straight past this scan. That is the declared
   * blind spot doing exactly what the paragraphs above say it does, and the
   * ratio moved only because a test file happened to phrase a claim in caps.
   *
   * The one paragraph that does trigger sits directly above the assertion that
   * checks it, so it is on the better side of this file's complaint.
   *
   * 206 -> 207 when the cut-in piece wrote down that GDD §7.2's third PR
   * sub-moment — `record: 'tier'` — is reachable by no screen. Measured per
   * file the same way, by restoring each touched file to its pre-change text
   * and re-reading this count: `cutInGate.test.ts`, `cutInWiring.test.ts`,
   * `cutInTuning.ts` and `RecapView.tsx` contribute nothing between them, and
   * the single new paragraph is the bullet added to `cutInGate.ts` §5, the
   * section listing what that module does not do. Worth recording:
   * `RecapView.tsx` carries the same disclosure at similar length and does not
   * trigger, which is the declared lower-case blind spot again — the ratio
   * moved because one of the two happened to open with a capitalised absolute.
   *
   * The §5 heading is deliberately not quoted in capitals here, for the reason
   * the 205 -> 206 note above gives: quoting it makes this paragraph trigger as
   * well, and the scan reading its own documentation is a fair description of
   * the limit rather than a measurement of the tree.
   *
   * That paragraph is TAGGED (`tier-pr-is-reached-by-no-screen`) and carries a
   * witness below, so it arrived on the better side of this file's complaint
   * rather than adding to the untagged 90%.
   *
   * 206 -> 207 when what leaves the server was sealed. Measured the same way and
   * NOT the file a reader would guess: each of the seven touched files was
   * restored to its pre-fix text in turn and this count re-read.
   * `progression.ts` — which is where the round's argument was written, several
   * hundred words of it, including the `@guarantee` — contributes NOTHING,
   * because none of its new headings happens to contain one of the four trigger
   * words. Nor do `sessionServer.ts`, `meetServer.ts`, `meetPreview.ts`,
   * `sessionPreview.ts` or `sessionServer.test.ts`. The single new paragraph is
   * the one in `progression.test.ts` above the seal scan that lists what the
   * scan is blind to. It is not quoted here, for the reason the paragraph above
   * gives: quoting a capitalised run makes this paragraph trigger as well, and
   * the count would go to 208.
   *
   * Two things worth keeping from that. First, the first draft of this comment
   * named `progression.ts` and was wrong — written while it sounded true, which
   * is the exact failure this whole file is about, and it was caught by running
   * the measurement rather than by re-reading the sentence. Second, the one
   * paragraph that did trigger states a limit rather than a guarantee, so a tag
   * on it would have nothing to bite. That is the declared blind spot pointing
   * the other way: this scan reads the shape of a sentence, not its direction.
   *
   * AND 207 -> 208 WHEN THOSE TWO ROUNDS MET IN A MERGE. Both branches above
   * were written against 206 and both correctly measured themselves to 207;
   * git conflicted on the constant and on nothing else, which is the merge
   * saying out loud that two people counted the same thing. The resolution
   * keeps both paragraphs and RE-RAN the measurement rather than adding the
   * two increments together — they did happen to stack, and the point is that
   * arithmetic on two independently-correct counts is a guess until something
   * executes it. This scan exists because sentences that sounded true were not,
   * and "1 + 1 = 2" is a sentence.
   *
   * 208 -> 211 when the seal scan stopped matching its callee by spelling and
   * started resolving it, and the seven routes got runtime freeze witnesses.
   * Measured per file, the way the two notes above were, by restoring each of
   * the six touched files to its pre-fix text in turn and re-reading this count:
   * `meetServer.test.ts`, `sessionPreview.ts`, `sessionPreview.test.ts` and this
   * file contribute NOTHING between them; `progression.ts` contributes one
   * paragraph and `progression.test.ts` two. The three are then named
   * individually by a throwaway re-implementation of the scanner, cross-checked
   * against it on the same two files (18 -> 21) so the per-paragraph attribution
   * is not a guess laid over a correct total.
   *
   * NOT QUOTED HERE, for the reason both notes above give: a quoted capitalised
   * run makes this paragraph trigger too and the count would go to 212. In lower
   * case they are: in `progression.ts`, the list of what the seal scan still
   * cannot see; in `progression.test.ts`, the paragraph saying what the runtime
   * ledger adds that the scan cannot, and the one conceding that a ledger is a
   * pointer and a pointer to a test that cannot fail is the same defect one
   * level out.
   *
   * ALL THREE STATE A LIMIT RATHER THAN A GUARANTEE, which is the 206 -> 207
   * observation repeating: a tag on any of them would have nothing to bite. And
   * the round's actual new guarantee — the one that IS tagged,
   * `every-shipped-route-observes-its-seal` — does not appear in this delta at
   * all, because its paragraph happens to use none of the four trigger words. It
   * was tagged because the author chose to, not because anything demanded it.
   * That is the declared blind spot measured rather than restated: on this round
   * the scan flagged three sentences that state a limit and demanded nothing of
   * the one sentence that states a guarantee.
   * 206 -> 209 when the walk-out's tail stopped being a frozen frame and the
   * wait for the lights started escalating. MEASURED PER FILE the same way, by
   * restoring each touched file to its pre-change text and re-reading this
   * count: `meetTuning.ts` 2, `meetDay.ts` 1, and — worth recording because the
   * first guess said otherwise — `walkout.ts`, `WalkoutView.tsx`,
   * `VerdictView.tsx`, `useMeetDay.ts` and all three touched test files
   * contribute ZERO between them, despite `walkout.ts` gaining fifty lines of
   * header. That is the declared blind spot again: the new prose is capitalised
   * absolutes with none of the four trigger words in them, so the scan walks
   * past it.
   *
   * The three that do trigger are the same claim in two files — that the beats
   * around an attempt may escalate in duration ONLY where there is a live
   * channel to spend the duration on, and that the reaction after the call
   * therefore escalates in intensity instead. It is checked in
   * `meetTuning.test.ts` ("leave the hold AFTER the call flat, which is the rule
   * and not an omission"), so the new prose is on the better side of this file's
   * complaint — but the ratio moved the wrong way again, and this comment is
   * where that is said.
   *
   * 209 -> 210 when the tail got a crowd bed as well as a picture. Measured per
   * file the same way: the single new triggering paragraph is in
   * `walkout.test.ts`, sitting directly above the assertion that the bed reaches
   * the hush, and `meetDay.ts`, `walkout.ts`, `WalkoutView.tsx`,
   * `meetFeel.test.ts` and `meetSound.test.ts` contribute ZERO between them
   * despite carrying most of the new prose. The declared blind spot again.
   *
   * AND 215 ON THE MERGE, WHICH IS NEITHER BRANCH'S NUMBER NOR THEIR SUM.
   * The seal round measured itself to 211 and the walk-out round to 210, both
   * correctly, both from 208. Naive arithmetic gives 213. The tree measures
   * 215, because this constant counts PARAGRAPHS and joining two narratives
   * into one comment block moves the paragraph boundaries — the count is a
   * property of the merged text, not the sum of two deltas taken against
   * different parents.
   *
   * That is the second time a merge has conflicted on this constant and the
   * second time re-running beat adding. The first time the two increments
   * happened to stack and the arithmetic would have been right; this time it
   * would have been wrong by two. Neither outcome is a reason to trust the
   * next one — run it.
   *
   * 215 -> 216 when the §7.5 seal ledger stopped proving a test existed and
   * started reading its body. Measured per file by restoring each touched file
   * to its pre-change text: the one new triggering paragraph is in
   * `sessionPreview.test.ts`, four lines of heading above the four assertions
   * it describes. `progression.ts` (a new table row, a new species of route,
   * and forty lines about the mint that sat outside every instrument),
   * `progression.test.ts` (a whole new syntax-tree audit and its pins),
   * `audit.ts` (the shared scoper), `guaranteeTags.test.ts`,
   * `sessionServer.test.ts` and `meetServer.test.ts` contribute ZERO between
   * them. That is the declared blind spot measured again and it is the sharpest
   * instance yet: the round's actual new guarantees are all in the six files
   * that moved this number by nothing, and the one paragraph it noticed is a
   * heading over assertions a reader can see from the same screen.
   *
   * 216 -> 217 on the same round, when the two textual mint pins in
   * `progression.test.ts` grew a line assertion beside their count. The new
   * paragraph is the heading over the first of those two, and it is not quoted
   * here for the reason the three notes above give: a quoted capitalised run
   * makes this paragraph trigger too, and the count would go to 218. It was
   * measured going to 218 by writing it out, which is the fourth time this
   * file's own prose has moved the number it pins. In lower case it says: and
   * which lines, not merely how many. A heading, directly above the assertion
   * that discharges it, with the trigger word doing no work — the same shape as
   * this round's other increment. Recorded rather than reworded, because
   * rewording to duck the scan is how a count stops meaning anything.
   *
   * AND 217 -> 220 ON THE MERGE OF THE CUT-IN OBSERVER. Measured, not added:
   * A4's branch was built before the seal round landed, so its three new
   * triggering paragraphs — in `cutInObserver.ts`, its test, and the tightened
   * `cutInWiring.test.ts` — arrived together at merge time. This is the third
   * merge in a row to conflict on this constant and the third time re-running
   * beat arithmetic; twice the increments happened to stack and once they did
   * not, which is the whole argument for running it.
   *
   * 220 -> 221 when the §8.3E purchased-day scan stopped reading a hardcoded
   * list of three filenames and started walking the tree. Measured per file the
   * usual way, by restoring each of the two touched files to its pre-change
   * text and re-reading this count: `streakEntitlement.ts` contributes ZERO
   * despite gaining roughly a hundred lines of header and allowlist commentary,
   * and the single new paragraph is in `streakEntitlement.test.ts`.
   *
   * The blind spot again, and pointing the usual way: the round's actual new
   * guarantee — that the scan can no longer be confined to one directory, tagged
   * `the-covered-day-scan-reads-the-whole-tree` — is written in the source
   * file that moved this number by nothing, because its capitalised absolutes
   * happen to contain none of the four trigger words. The tag was added because
   * the author chose to, not because anything demanded it, which is now the
   * third round in a row where that has been true.
   *
   * 221 -> 222 when that same scan widened again, from the word "purchase" to
   * the covered day itself. ATTRIBUTED THE USUAL WAY, one file at a time
   * against base, and the usual way is what it found: `streakEntitlement.ts`,
   * `streakEntitlement.test.ts` and `streak.ts` contribute **ZERO between
   * them** — a rewritten allowlist header, 31 new entries, a fourth candidate
   * predicate and two new tests — and the whole increment is one heading in
   * THIS file, over the fourth mutation witness. So the round's real guarantee
   * moved this number by nothing again, and the thing it noticed was a comment
   * about a comment. Fourth round running.
   *
   * It was also measured going back to 221 by lower-casing that one heading,
   * which is the declared scoping limit demonstrating itself on a live example
   * rather than in the abstract. Restored to capitals and pinned at 222 instead,
   * for the reason the 216 -> 217 note gives: rewording to duck the scan is how
   * a count stops meaning anything.
   *
   * 222 -> 223 when that same scan stopped matching declaration bodies by TEXT
   * ONLY and grew a symbol-resolved pass beside it, closing the aliased-import
   * hole its own comment had pinned as unclosable. ATTRIBUTED THE USUAL WAY,
   * one file at a time against base, and the usual way is what it found again:
   * `streakEntitlement.ts` contributes ZERO — a rewritten allowlist header,
   * nine new entries and the round's actual `@guarantee` — and so does this
   * file, despite gaining a fifth witness. The whole increment is one paragraph
   * in `streakEntitlement.test.ts`.
   *
   * NOT QUOTED HERE, for the reason the four notes above give: a quoted
   * capitalised run makes this paragraph trigger too. In lower case it is the
   * doc comment on `SYMBOL_ONLY_NAMES`, saying which declarations the new pass
   * finds that the textual predicate cannot — and it sits directly above both
   * the pinned list of the nine and the assertion that discharges it.
   *
   * FIFTH ROUND RUNNING THAT THE GUARANTEE MOVED THIS NUMBER BY NOTHING. The
   * round's real claim — that an aliased import no longer hides a granter,
   * tagged `the-covered-day-scan-follows-aliases` — is written in the source
   * file that contributes zero, because its capitalised absolutes happen to
   * contain none of the four trigger words. Worth adding to the pattern the
   * notes above record: the one paragraph the scan DID notice is in a test
   * file, which is not in `GUARANTEE_PROSE_FILES`, so the scan demanded no tag
   * of it either. It counted a sentence it would never have required anything
   * from, and required nothing of the sentence that states the guarantee.
   *
   * 223 -> 224 when GDD §6.3's PR call-out stopped being a static string.
   * Measured the usual way, by removing the round's new file and re-reading
   * this count: `meetDay.ts`, `meetTuning.ts` and `AttemptSelectView.tsx`
   * contribute ZERO between them, and the whole increment is one paragraph in
   * the new `AttemptSelectView.test.ts`. It is not quoted here for the reason
   * the five notes above give; in lower case it is the heading over that file's
   * statement of what a node-environment test can and cannot say about a
   * border, and the two numbered claims under it.
   *
   * SIXTH ROUND RUNNING, and the same shape as the fifth. The round's actual
   * guarantee — `pr-sentence-and-pr-border-are-one-decision`, that the PR
   * sentence and the gold edge are one flag rendered twice — is written in
   * `meetDay.ts`, which moved this number by nothing, because its capitalised
   * run ("ONE FLAG, TWO RENDERINGS, AND NEITHER MAY OUTRUN THE OTHER") contains
   * none of the four trigger words. The paragraph the scan did notice states a
   * limit, in a file the ban does not scope into. That is now five instances
   * out of six of the same asymmetry, which is worth more than the number it is
   * attached to.
   *
   * 224 -> 226 when GDD §6.5's per-lift call-out gained its FIRST state.
   * Measured per file the usual way, by re-running the scan against the base
   * checkout: `meetServer.ts` 7 -> 8 and `localSessionServer.ts` 1 -> 2, and
   * every other file the round touched moved by ZERO —
   * `meetDay.ts` (3), `meetTuning.ts` (3), `RecapView.tsx` (1),
   * `AttemptBoard.tsx` (0), `meetDay.test.ts` (0).
   *
   * SEVENTH ROUND RUNNING, AND SHARPER THAN THE SIXTH. The round's actual
   * guarantee — `the-pr-word-needs-a-record-to-beat` — is declared on
   * `beatsPreviousBest` and `liftCallOutFor` in `meetDay.ts`, and that file's
   * count did not move: the capitalised run over the declaration is "ONE
   * PREDICATE, READ BY EVERY SURFACE THAT PRINTS THE WORD", which carries none
   * of the four trigger words. What the scan DID notice is the two
   * RESTATEMENTS, in files the ban does not scope into. Six instances out of
   * seven now. All three restatements carry the tag anyway, so they expire with
   * the declaration rather than with this number.
   */
  /**
   * 226 -> 227 with GDD §5.3's promotion path. The one paragraph the scan
   * noticed is `stepGym`'s capitalised "at capacity only" heading — quoted in
   * lower case here on purpose, because quoting it as written would add a
   * triggering paragraph to this file and move the number it documents;
   * it states WHEN the arm fires, it is untagged, and it is one more of the
   * majority this number exists to be honest about. Both of that round's
   * load-bearing claims — that a slot holding a tier has paid the same price
   * and carried the same timer by every route, and that the residue left under
   * one spending policy is the simulated player's decision moment — are
   * trigger-free and walk straight past this rule, which is the hole the
   * paragraph above already names.
   */
  /**
   * 227 -> 229 when the tag grew a numeric half. MEASURED PER FILE the usual
   * way, by counting against the base checkout rather than apportioning by eye,
   * and the usual answer: `guaranteeTags.test.ts` contributes ZERO — several
   * hundred words of new prose, a new tag, a new excuse table and two new
   * witnesses — and the whole increment is two paragraphs in `audit.ts`.
   *
   * Not quoted here, for the reason the notes above give. In lower case they
   * are the two halves of the scoper's premise: the one saying the spurious
   * direction is now closed at the source rather than merely reported, and the
   * one saying the other direction is not, and that closing one is not closing
   * the other. Both use the fourth trigger word and neither is a guarantee.
   *
   * EIGHTH ROUND RUNNING that the round's actual claim moved this number by
   * nothing. The paragraphs the scan noticed state a limit, in a file the ban
   * does not scope into; the claim it demanded nothing of is the one that now
   * carries both a tag and two witnesses.
   */
  /**
   * 229 -> 230 when the doomed-burn counterfactual was re-taken and written
   * down. MEASURED PER FILE the usual way: the whole increment is ONE paragraph
   * in `streakSweep.ts`, and every other file the round touched moved by zero —
   * `streak.ts` (unchanged), `streakEntitlement.ts` (unchanged),
   * `streak.test.ts` (16), `streakEntitlement.test.ts` (4), this file (5).
   *
   * Not quoted as written, for the reason the notes above give. In lower case
   * it says the counterfactual's row is not monotone in calendar length and
   * that reading only its first cells would say the opposite of the truth. It
   * uses the fourth trigger word and it is a warning about how to read a table,
   * not a guarantee — one more of the majority this number exists to be honest
   * about.
   *
   * NINTH ROUND RUNNING that the round's actual claim moved this number by
   * nothing. The claim is that dropping the doomed burn measures worse, it now
   * carries a tag and two witnesses, and its own paragraph does not trip the
   * trigger — `WORSE THAN THE DESIGN IT REPLACES` carries no trigger word.
   */
  /**
   * 230 -> 235 with GDD §2.1's career spine, then 236 on the merge: L1's
   * `liftInput.test.ts` landed in parallel and contributes exactly 1. The two
   * rounds compose ADDITIVELY, which is what says each measured its own tree
   * correctly rather than one of them being a guess that happened to fit. MEASURED PER FILE the usual way,
   * by emptying each of the round's nine new files in turn and re-reading this
   * count, and by restoring each of its five edited ones to its text at HEAD:
   * `eligibility.ts` 4, `federation.ts` 1, and `careerTuning.ts`,
   * `calendar.ts`, `careerSweep.ts`, all four new test files, this file,
   * `streakEntitlement.test.ts`, `audit.ts`, `audit.test.ts` and
   * `tuning/index.ts` contribute ZERO between them.
   *
   * AND THE NINE-ROUND PATTERN ABOVE BREAKS HERE, which is worth more than the
   * number. Nine rounds running, the round's real guarantee moved this count by
   * nothing and the paragraphs the scan noticed stated limits. This time two of
   * the five ARE the round's guarantees — both tagged, both witnessed below —
   * because their claims happen to be phrased with the first trigger word. The
   * other three are the usual kind: a quotation of the GDD's own currency table,
   * and two paragraphs saying what a type and a design choice do not reach.
   *
   * That is not the scan getting better. It is the same coin-flip the notes
   * above describe, landing the other way twice, and it is recorded as one.
   *
   * 236 -> 237 WITH A CHANGE THIS ROUND DID NOT MAKE, and the attribution is
   * the reason this paragraph exists rather than a bare number. Session C's
   * career integrity fences added a paragraph to `eligibility.ts` §2 — the one
   * saying that `CAREER_ELIGIBILITY_READS_NO_WALLET` does not see a
   * module-level `let` a graded function closes over, which
   * `careerPurity.test.ts` now grades. Its heading uses the second trigger
   * word, so the scan counts it, and this constant was not moved with it. It
   * is not quoted here, for the reason four of the notes above give: quoting a
   * capitalised run makes this paragraph trigger too, and the count would go
   * to 238. MEASURED RATHER THAN INFERRED: `4be76f9`, the integration tip,
   * fails this assertion on its own with `expected 237 to be 236` before any
   * other branch is merged into it, and `eligibility.ts` goes from 4
   * triggering paragraphs to 5.
   *
   * The C1 worlds-reach round that carried this edit contributes ZERO of its
   * own, checked the same way: every paragraph it added to `careerSweep.ts`,
   * `eligibility.test.ts` and `eligibility.ts` was written to state its limits
   * without a capitalised run of an absolute, and the census over those three
   * files reads 0, 0 and 5 after the merge.
   *
   * 238 -> 245 when the real-IP audit was repaired on both of its axes: the
   * file-type predicate inverted from an extension allowlist onto a content
   * test, and the REACH taken off the bare filesystem walk and reconciled with
   * `git ls-files`. Measured per file the same way, by reading the census over
   * each file's pre-change and post-change text: `realIp.ts` 4 -> 9,
   * `realIp.test.ts` 2 -> 4, and nothing else in that change, which touched two
   * files.
   *
   * Seven in one piece is a lot and the ratio moved the wrong way again. What is
   * worth recording is that all seven have a check behind them, because that
   * piece's whole subject is a scan that declined to look at things without
   * saying so:
   *
   *   - two state what the byte classifier does and which of its two arms this
   *     tree exercises, graded by the assertion that walks every unreadable file
   *     and pins its reason;
   *   - one heads the census of what that audit is blind to, graded by a set
   *     equality against the live tree;
   *   - three state the reach rules — what happens to a tracked file the walk
   *     misses, to a walked file git ignores, and to an untracked one — graded
   *     by `agrees with the repository about which files exist` plus two
   *     synthetic tests that drive the cases a clean checkout cannot produce;
   *   - one heads the plant test whose own assertions are its check.
   *
   * None of the seven is quoted here, for the reason five of the notes above
   * give: quoting a capitalised run makes this paragraph trigger too, and the
   * count would go to 246.
   *
   * 248 -> 254 when the career sweep's totals generator was bounded. Measured
   * per file the same way, by running this census over each file's pre-change
   * and post-change text at `c6e2e31`: `careerSweep.ts` 0 -> 3,
   * `eligibility.test.ts` 0 -> 2, `eligibility.ts` 5 -> 6, and nothing else in
   * that change, which also touched `careerTuning.ts`, `careerTuning.test.ts`,
   * `docs/GDD.md` and this file — all four contributing zero.
   *
   * Six in one piece, and the ratio moved the wrong way again. What is worth
   * recording is that only TWO of the six are claims a check could bear, and
   * both have one:
   *
   *   - the one heading `eligibility.ts`'s account of the qualification axis no
   *     longer being blind to a rule keyed to the annual tier, graded by the
   *     worlds-reset arm that now reports a non-zero with the margin pinned
   *     beside it;
   *   - the one on the constant inequality the generator's bound is proved
   *     from, graded by the assertion sitting in the same test body.
   *
   * The other four are DECLARATIONS OF A LIMIT rather than guarantees, which is
   * a category this scan cannot tell from the other and a reader should: one
   * says a control's zero is only evidence if the fixture can reach the case,
   * one says the band's floor is not merely a midpoint, one says only the range
   * axis was bounded and the rate axis was not, and one records that a control
   * started firing without its rule being edited. None of those is a promise
   * about behaviour, so none of them has a test, and saying so is the point.
   *
   * None of the six is quoted here, for the reason six of the notes above give.
   *
   * 254 -> 253 WHEN THE CAREER SWEEP'S GAIN RATE WENT FROM 70 kg A MEET TO 20,
   * AND IT IS THE FIRST TIME THIS NUMBER HAS GONE DOWN. Measured per file the
   * same way, by running this census over each file's pre-change and
   * post-change text: `careerSweep.ts` 3 -> 2, and nothing else in that change,
   * which also touched `eligibility.ts`, `eligibility.test.ts`,
   * `careerTuning.ts` and this file — all four contributing zero.
   *
   * WHICH PARAGRAPH WENT IS THE WHOLE POINT OF RECORDING IT. It is the one this
   * block's own list above calls "one says only the range axis was bounded and
   * the rate axis was not" — a DECLARATION OF A LIMIT, correctly identified as
   * carrying no test, which stopped being true the moment somebody fixed the
   * limit it declared. The rate axis is bounded now, so the sentence went with
   * it.
   *
   * That is the healthiest possible reason for this census to move, and it is
   * the argument for keeping the "declaration of a limit" category visible
   * rather than merging it into the guarantee count: a guarantee that stops
   * being true is a defect, and a declared limit that stops being true is a
   * limit somebody closed. The scan cannot tell them apart, and this paragraph
   * is what a reader has instead.
   *
   * Not quoted here, for the reason seven of the notes above give: quoting a
   * capitalised run makes this paragraph trigger too.
   */
  TREE_WIDE: 253,
} as const;

// ---------------------------------------------------------------------------
// The NUMBERS a tagged claim cites
// ---------------------------------------------------------------------------

/**
 * A TAG THAT RESOLVES SAYS NOTHING ABOUT THE NUMBERS IN THE SENTENCE AROUND IT,
 * and that is a third way a true-sounding claim survives a green suite.
 *
 * MEASURED TWICE IN `src/empire/`: a comment read "zero of 120 physio arrival
 * days" while its named check pinned a different denominator, and another read
 * "32 of 144" while its own body pinned something else again. The tag as it
 * stood caught neither, because it resolves that a TEST EXISTS and says nothing
 * about what the prose around it claims that test measured. Both sentences kept
 * their confident tone after the number moved, which is this file's whole
 * subject one level in.
 *
 * THE RULE: every numeral a tagged paragraph states as prose must occur in the
 * body of the test the tag names, and it is the BODY and not the file.
 * `@guarantee a-cited-number-resolves-in-the-named-test`
 *
 * Why the body is the load-bearing half, and it was measured rather than
 * reasoned: the number in the second of those two defects did exist in the
 * right file — as a different check's pin — so a file-scoped version of this
 * rule is satisfied while the sentence citing it is still false about the
 * control it is about. The planted check below builds exactly that arrangement,
 * a number in one test and the claim citing it on another twenty lines up, and
 * asserts that the file-scoped reading would have passed it.
 *
 * THIS PARAGRAPH IS WHERE THE RULE MEETS ITSELF, and the meeting is recorded
 * rather than tidied. The sentence above deliberately does not name the number,
 * because naming it here would oblige the test this tag points at to carry a
 * figure that belongs to a planted sample two checks below. That is a legal
 * move and it is also the rule's escape hatch: THE PARAGRAPH IS THE UNIT, so a
 * number one blank comment line away is out of reach. The same limit the
 * trigger scan above already declares, one rule further in.
 *
 * WHAT COUNTS AS "STATED AS PROSE" is `claimedNumbersIn`, and its four
 * exclusions are counted rather than described — see `NUMBER_EXCLUSIONS`.
 *
 * WHAT THIS DOES NOT CATCH, stated at the same length as what it does:
 *
 *   - UNTAGGED PROSE, which is most of it. The scan reads tagged paragraphs
 *     only. `GUARANTEE_COVERAGE` already measures how small that scope is; this
 *     rule sits inside it and `NUMBER_COVERAGE` measures how much smaller again
 *     the numeric part is.
 *   - A NUMBER THAT RESOLVES AGAINST A COMMENT INSIDE THE BODY rather than
 *     against anything executable. That is a real weakness and it is the
 *     majority case in places: `NUMBER_COVERAGE.RESOLVING_IN_CODE` counts how
 *     many resolve with the body's comments blanked, and the gap between it and
 *     `NUMBER_COVERAGE.RESOLVING` is the size of the hole. Requiring code was
 *     tried and measured first: it takes the failures from twelve to eighteen,
 *     including every counterfactual this codebase records in a test's own
 *     header, and a ban that fires on honest prose is a ban somebody deletes.
 *   - A SMALL NUMBER, in practice. Measured over the tag-named bodies in this
 *     tree and pinned in the check below, a bare `0` occurs in
 *     `NAMED_BODIES_HOLDING_ZERO` of `NAMED_BODIES` and a bare `1` in
 *     `NAMED_BODIES_HOLDING_ONE`, so those two resolve almost wherever they are
 *     pointed. The rule still requires them — "0 violating pairs" is the most
 *     load-bearing number in this repository and exempting it would gut the
 *     check — but a small numeral passing is weak evidence, and one entry in
 *     `UNPINNED_PROSE_NUMBERS` records a sentence whose twin passes for exactly
 *     that reason. The figures are named rather than written out because a
 *     percentage in a comment is the thing this file distrusts.
 *   - A NUMBER WRITTEN INTO A QUOTED CODE SPAN. Backticks are how this codebase
 *     quotes an expression, and a numeral inside one is being shown rather than
 *     claimed. A span holding nothing but a numeral is NOT excused, so the
 *     obvious duck — wrapping the number in backticks — does not work.
 *   - WHETHER THE NUMBER MEANS THE SAME THING ON BOTH SIDES. `50` in a sentence
 *     about checks and `50` in an unrelated `toBe` are indistinguishable here.
 *     This is a link check, not a semantic one, and it is the same limit the
 *     tag itself has.
 */
interface ClaimedNumber {
  readonly numeral: string;
  /** Offset in the paragraph flattened to one line, which is what is scanned. */
  readonly index: number;
  readonly context: string;
}

/** The four ways a numeral in a tagged paragraph is not a claim about a number. */
type NumberExclusion =
  | 'section-coordinate'
  | 'inside-an-identifier'
  | 'quoted-code'
  | 'list-ordinal';

type ExclusionCensus = Record<NumberExclusion, number>;

/**
 * WHAT EACH EXCLUSION REMOVES, AS A COUNT AND NOT AN ADJECTIVE. An exclusion
 * list with no number beside it is where a rule like this quietly stops meaning
 * anything, so the census is pinned and moving any of it is a red test.
 *
 * Taken over the tagged paragraphs in `src`. The survivors are
 * `NUMBER_COVERAGE.CLAIMED`; the four counts below are what was dropped; and
 * the raw occurrence count is their sum, deliberately not restated as a third
 * figure — it was, it read forty-nine against a sum of fifty, and it was the
 * one of the three that no test could redden:
 *
 *   - `section-coordinate` — a numeral directly after `§`. A pointer into the
 *     GDD or CLAUDE.md, never a measurement. The largest class by far, and the
 *     one whose removal matters most: `§4.2` and `§7.5` were both RESOLVING
 *     before, against unrelated numbers in the named bodies, which is a green
 *     that means nothing.
 *   - `inside-an-identifier` — a letter or underscore on either side: `e1RM`,
 *     `4a`, `§4c`. A unit suffix from `UNIT_SUFFIXES` does not count as a
 *     letter, so `180ms` is a claim and `e1RM` is not.
 *   - `quoted-code` — inside a backticked span that holds more than the numeral
 *     itself, e.g. `max(0, len - grace)`.
 *   - `list-ordinal` — `N. ` opening a line, which is this codebase's numbered
 *     section style and not a quantity.
 */
const NUMBER_EXCLUSIONS: Readonly<ExclusionCensus> = {
  'section-coordinate': 15,
  'inside-an-identifier': 3,
  'quoted-code': 1,
  'list-ordinal': 1,
};

/**
 * Suffixes that are a unit rather than the rest of an identifier. Deliberately
 * short: this list is the difference between "180ms is a claim" and "e1RM is
 * not", and every entry widens what the rule demands rather than narrowing it.
 */
const UNIT_SUFFIXES: readonly string[] = ['ms', 's', 'kg', 'lb', 'x'];

/**
 * A numeral in a tagged paragraph that is NOT in the named test's body, with
 * the reason it is allowed to stay that way.
 *
 * THE SAME SHAPE AS `UNWITNESSED_LEGACY_TAGS` AND FOR THE SAME REASON: a named
 * list means the exception is a diff somebody wrote on purpose, next to the
 * sentence explaining it. It differs in that this one is checked in BOTH
 * directions — an entry that stops excusing anything is stale and fails, so
 * pinning the number later deletes the entry rather than leaving it behind.
 *
 * `phrase` is a freshness anchor, exactly like `MutationWitness.mutated`: it
 * must occur exactly once across the paragraphs carrying that tag, so editing
 * the sentence expires the excuse instead of silently widening it.
 *
 * ON THE FIRST RUN THIS LIST WAS THE WHOLE RESULT — twelve numerals in five
 * paragraphs, none of them fixed by this piece, and that is worth saying
 * plainly rather than presenting seven exemptions as a clean bill. One of them
 * (`673 at 100`) is a real unpinned measurement and is marked as such.
 */
interface UnpinnedProseNumber {
  /** The tag whose paragraph carries the sentence. */
  readonly guarantee: string;
  /** Verbatim from the paragraph flattened to one line. Must occur once. */
  readonly phrase: string;
  /** What kind of number it is, so the list can be read at a glance. */
  readonly kind: 'history' | 'document-coordinate' | 'illustration' | 'unpinned-measurement';
  readonly why: string;
}

const UNPINNED_PROSE_NUMBERS: readonly UnpinnedProseNumber[] = [
  {
    guarantee: 'section-4a-denominator-is-measured',
    phrase: "It read 49 before §4c's day-anchor block added a check",
    kind: 'history',
    why:
      'The superseded denominator. The live one is 50, and all three of its '
      + 'occurrences in that paragraph resolve; this is the value it moved FROM, '
      + 'recorded so the drift is legible. A sentence about what a number used to '
      + 'be cannot be pinned by a '
      + 'test that measures what it is now. NOTE ALSO that src/empire/** belongs to '
      + 'the other session, so this entry is the only move available here.',
  },
  /*
   * TWO ENTRIES WERE DELETED HERE, AND THE REASON IS THE ONE THIS LIST WANTS.
   *
   * `doomed-absence-takes-what-is-left` carried an `unpinned-measurement` for
   * "and 673 at 100, against 0 with it" — the only entry on this list that was
   * a real evidence gap rather than a category error. The counterfactual was
   * re-taken at `streakSweep.ts`'s declared parameters and REPRODUCED: 1051 at
   * 60 and 673 at 100, on the shipped engine's composition. It is now measured
   * by `[dropping-the-doomed-burn-measures-worse]`, whose tag was added to the
   * same paragraph, so the numerals resolve against the body that produces
   * them instead of against a comment.
   *
   * Its `document-coordinate` sibling — "the half that survived the Option 1
   * rework" — went with it, and NOT because anybody decided it was fine. That
   * entry existed because a bare `1` had nowhere to resolve; the new named body
   * contains one for its own reasons, exactly as that entry's own `why` said
   * happens elsewhere. The excuse stopped excusing anything, and an entry that
   * excuses nothing is stale by this list's own rule. It is a weak resolution
   * and it is recorded as one rather than counted as a second fix.
   */
  {
    guarantee: 'milestones-pay-nothing',
    phrase: 'the 60-day sweep goes to 0',
    kind: 'history',
    why:
      'A retracted diagnosis, kept as history: the counterfactual that emptied '
      + 'STREAK_MILESTONE_DAYS. The paragraph says in its own next sentence that the '
      + 'conclusion did not follow, and streak.test.ts keeps the results in '
      + 'RESIDUE_MEASUREMENT and in a test that exists to say the arms can no longer '
      + 'be run. A number the engine can no longer produce cannot be in a body.',
  },
  {
    guarantee: 'milestones-pay-nothing',
    phrase: 'still gave 81 violating pairs at 60 days',
    kind: 'history',
    why: 'The second retracted counterfactual, same reason as the entry above.',
  },
  {
    guarantee: 'milestones-pay-nothing',
    phrase: 'gave 194, MORE than the 122 the shipped economy gave',
    kind: 'history',
    why: 'The third retracted counterfactual, same reason as the entry above.',
  },
  {
    guarantee: 'every-refusal-sentence-is-true-of-its-screen',
    phrase:
      'reads DOOMED on day 29 and COVERED on day 30, and a client that renders on day 30',
    kind: 'illustration',
    why:
      'An illustration of a window boundary, keyed to RECOVERY_ENTITLEMENT.'
      + 'WINDOW_DAYS = 30 rather than measured; the named test sweeps ten-day '
      + 'calendars and reaches the boundary by construction, so these two day '
      + 'numbers appear nowhere in it. Pinning them would mean writing the window '
      + 'length into the test as a literal, which is worse than this entry.',
  },
];

/**
 * WHAT FRACTION OF THIS FILE'S OWN SCOPE THE NUMERIC RULE REACHES — pinned, for
 * the same reason `GUARANTEE_COVERAGE` is pinned: so the honest reading is a
 * fact in the repository rather than a sentence in a report.
 *
 * THE TWO SCOPES ARE NOT NESTED, and the first draft of this paragraph said
 * they were. `GUARANTEE_COVERAGE.TREE_WIDE` counts paragraphs that trip the
 * capitalised-absolute trigger; this one counts paragraphs that carry a TAG,
 * and a paragraph can do either without the other. Measured and pinned below:
 * only `TAGGED_AND_TRIGGERING` of the tagged paragraphs trip the trigger too,
 * which is well under half of them. Writing "58 of the 229" would have been a
 * subset claim about two overlapping populations — this rule's own defect
 * class, in the comment introducing it, caught by taking the measurement.
 *
 * What they say together, then: the trigger scan and the tag scan are different
 * populations, `TAGGED_AND_TRIGGERING` is their overlap, and the numerals the
 * rule demands anything of are a few per cent of the prose this file can see
 * and none of the prose it cannot. Every figure is pinned below rather than
 * written into this sentence, because this paragraph has now been wrong twice
 * about its own numbers.
 *
 * TWO ROUNDS LANDED ON THIS CENSUS AT ONCE AND THE MERGE IS WHY THESE NUMBERS
 * ARE MEASURED RATHER THAN CHOSEN. Both re-took it, each against a tree without
 * the other's work, and the two answers conflicted textually in five places
 * while being individually correct. Picking either side would have pinned a
 * census that describes neither tree. They were re-run on the merged tree
 * instead — which is the only thing that could have been right, and is worth
 * recording because the conflict LOOKED like a wording clash and was not.
 *
 * What each round did, since the directions matter more than the totals:
 *
 *   - §4a of `empireInvariant.ts` added a tagged paragraph, whose eight prose
 *     mutant summaries became the witness rows below. It keeps ONE figure as
 *     prose — the element count both series checks are stated over — because
 *     that is the only one an assertion in a named body pins. The counts those
 *     summaries carried live in the `observed` column now, quoted from the runs
 *     that produced them.
 *   - The doomed-burn round moved numerals WITHOUT adding any. Three
 *     occurrences crossed from `EXCUSED` to `RESOLVING` — `673` and the `0`
 *     beside it, which were the only real evidence gap on the excuse list, and
 *     the bare `1` of "Option 1", whose excuse then stopped excusing anything —
 *     and figures that had resolved against a COMMENT now resolve against an
 *     assertion. That second move narrows `RESOLVING` minus
 *     `RESOLVING_IN_CODE`, which is the declared weakness, and it is the first
 *     round to narrow it rather than widen it.
 */
const NUMBER_COVERAGE = {
  /** Comment paragraphs under `src` carrying at least one tag. */
  TAGGED_PARAGRAPHS: 66,
  /** ...of which this many state a number as prose. */
  PARAGRAPHS_WITH_A_CLAIMED_NUMBER: 11,
  /** Numerals the rule actually demands something of. */
  CLAIMED: 46,
  /** ...of which this many are found in the named test's body. */
  RESOLVING: 37,
  /**
   * ...and this many survive blanking the body's COMMENTS, which is the
   * stronger reading. The gap is the weakness declared above, as a number.
   */
  RESOLVING_IN_CODE: 33,
  /** ...and this many are excused by name, in `UNPINNED_PROSE_NUMBERS`. */
  EXCUSED: 9,
  /** The entries doing that excusing. Fewer than the occurrences: a phrase may span two. */
  EXCUSE_ENTRIES: 5,
  /**
   * The bodies a tag names, and how many of them hold a bare `0` or a bare `1`
   * for reasons of their own. THIS IS THE WEAKNESS MEASUREMENT, not a coverage
   * one: it says how little a small number resolving is worth.
   */
  NAMED_BODIES: 57,
  NAMED_BODIES_HOLDING_ZERO: 45,
  NAMED_BODIES_HOLDING_ONE: 45,
  /**
   * Tagged paragraphs that ALSO trip the trigger scan. The overlap of the two
   * scopes, pinned because the sentence above about them was wrong once.
   */
  TAGGED_AND_TRIGGERING: 27,
} as const;

// ---------------------------------------------------------------------------
// The raised bar: a tag declared from here carries mutation evidence
// ---------------------------------------------------------------------------

/**
 * WHAT A WITNESS IS, AND WHAT IT COSTS.
 *
 * THE PROBLEM IT ANSWERS, restated because it is measured and not suspected: a
 * quarter of the tags that were mutation-tested on the first careful pass named
 * a test that stayed GREEN when the guarantee was broken. Both resolved
 * perfectly. So "the id resolves to a live test" is not evidence, and a bare
 * pass is not evidence either — the human's words, and the reason this table
 * exists.
 *
 * WHAT IT RECORDS. Three verbatim anchors and one quoted line:
 *
 *   - `mutated` — the exact text the mutant replaced, in `mutatedFile`.
 *   - `mutatedTo` — the exact text it put there, so the pair is a whole patch
 *     and a reader can apply it without guessing. See the block above
 *     `REPLACEMENT_FAULTS` for what is checked about it and for the rows that
 *     predate it.
 *   - `redAssertion` — the exact text of the assertion that went red, in the
 *     body of the test the tag names.
 *   - `observed` — what the red run actually printed.
 *
 * WHAT IS MECHANICALLY CHECKED, AND IT IS LESS THAN IT LOOKS. That both anchors
 * still resolve, uniquely, and that the red assertion sits inside the body of
 * the named test. That is a FRESHNESS property, and it is the one worth having:
 * a witness expires the moment either the mutated code or the assertion that
 * caught it is edited away, so it cannot keep its confident tone after the code
 * moves — which is the exact failure mode this whole file exists for.
 *
 * WHAT IS NOT CHECKED, SAID PLAINLY. Nothing here re-runs the mutation. A
 * determined author can paste two real strings and a plausible sentence and
 * this file cannot tell. It is evidence, not proof: it makes the work visible
 * and cheap to audit, and it makes the lazy version — tag, ship, never mutate —
 * the one that fails.
 *
 * WHAT IT COSTS AT DECLARATION TIME. You broke the code and watched the test go
 * red, because that is the method. Copy the line you broke, copy what you put in
 * its place, copy the assertion vitest named, paste the message. Under a minute
 * on top of work already done. The second of those four is the newest and the
 * one that makes the other three checkable by somebody who is not you.
 * A bar that cost an hour per tag would stop being met, which is the failure
 * mode of most bars.
 */
interface MutationWitness {
  /** The tag id this witnesses. */
  readonly guarantee: string;
  /** Repo-relative path of the file the mutant edited. */
  readonly mutatedFile: string;
  /** Verbatim text the mutant replaced. Must still occur, exactly once. */
  readonly mutated: string;
  /**
   * Verbatim text the mutant put in its place, which is what makes the row a
   * patch a third party can apply rather than a description of one.
   *
   * An empty string is a DELETION and is a legitimate value; absence is a row
   * that predates the field, and `REPLACEMENTS_PREDATING_THE_RULE` counts those
   * per claim. The two are told apart with `=== undefined` and never by
   * truthiness — see the block above `REPLACEMENT_FAULTS`.
   */
  readonly mutatedTo?: string;
  /** Repo-relative path of the test file holding the assertion that reddened. */
  readonly testFile: string;
  /** Verbatim text of that assertion. Must still occur inside the named test. */
  readonly redAssertion: string;
  /**
   * What the red run printed.
   *
   * Was "evidence for a reader; not machine-checked". It is checked now, by
   * `transcriptFaults` — see the paragraph below this interface for what that
   * check reaches and what it does not.
   */
  readonly observed: string;
  /**
   * The domain the transcript's number was measured over, quoted verbatim from
   * the body of the same test `redAssertion` is quoted from.
   *
   * Required on a row the transcript rule grades whose `observed` states a bare
   * measured scalar; see the block above `DOMAIN_FAULTS` for why the number
   * itself cannot be compared and what this anchor buys instead.
   */
  readonly measuredOver?: string;
  /**
   * Set on a row whose `observed` was transcribed before the transcript rule
   * existed and does not satisfy it. Tracked debt in the shape this file
   * already uses: closed by re-running the mutant and pasting a whole
   * transcript, not by loosening the rule. `TRANSCRIPTS_PREDATING_THE_RULE`
   * pins how many carry it, so the set may shrink and may not grow.
   */
  readonly transcriptPredatesTheRule?: true;
}

/**
 * Below this length an anchor is not an anchor. A three-character `mutated`
 * would resolve against half the file and expire against nothing.
 */
const MIN_ANCHOR_LENGTH = 24;

/**
 * The smallest numeral a domain anchor may state and still be a population.
 *
 * A pin holding 0 or 1 is a property, a flag or an emptiness check; none of
 * them moves when a sweep deepens, which is the only movement the anchor below
 * exists to notice.
 */
const SMALLEST_POPULATION = 2;

// ---------------------------------------------------------------------------
// A red file is not a caught mutant, and the colour does not tell them apart
// ---------------------------------------------------------------------------

/**
 * THE GAP THIS CLOSES, and it was filed against this table by name.
 *
 * CLAUDE.md's bar reads "break the guarantee, watch the named test go red,
 * restore, and record the witness". Measured on two mutants in
 * `src/empire/expansion.ts` and `src/empire/recruitment.ts`, that is not
 * sufficient. Both put a purchase's gate on one purse while its debit stayed on
 * another; the balance went negative; `asGymBucks` threw while
 * `empireInvariant.test.ts` was building its grid at module scope. vitest
 * reported `Test Files 1 failed` and `Tests  no tests`. Exit code 1, file red,
 * and the JSON report carries zero assertion results — no check in that file
 * executed, and what killed the mutant was a branded constructor rather than
 * any measurement. An author who reads the colour records it as a catch and
 * writes a witness that looks exactly like the real ones.
 *
 * WHAT IS ENFORCED, stated as the two arms it is actually made of, because
 * neither subsumes the other and a reader has to be able to tell which one is
 * doing the work:
 *
 *   - `names-no-test` — the transcript must contain the title of the test that
 *     declares the tag, read live out of `testFile` rather than transcribed.
 *     This is the arm aimed at the filed defect: a collection error prints the
 *     thrown value and no title, because at that point there is no test to
 *     name. It also expires the row when the test is renamed, and it rejects a
 *     transcript quoting some other test's failure.
 *   - `no-failure-line` — the transcript must carry a line naming a thrown
 *     error, which is what both `expect` (`AssertionError:`) and this
 *     codebase's sweep helpers (`Error: offset 0 armed mask 0 …`) print. This
 *     arm rejects a transcript that is a bare test title, which is what a
 *     PASSING run gives you and is therefore the cheapest wrong thing to
 *     paste. It does not reject a collection error's own text, since that is a
 *     thrown error too — the first arm is what rejects those.
 *
 * WHAT IS NOT ENFORCED, said as plainly as the schema's own docstring says the
 * rest of its limits:
 *
 *   - Nothing re-runs the mutant. `observed` is still author-transcribed, and a
 *     determined author can compose a passing-looking string. What changed is
 *     that the LAZY route is closed: the output of a collection kill does not
 *     have this shape, so it can no longer be copied straight in.
 *   - It cannot tell "the named assertion failed" from "the named test threw
 *     somewhere else in its body before reaching that assertion". Both print
 *     the title and an error line. The only thing in a vitest transcript that
 *     would separate them is the source position, and pinning a line number
 *     expires the row on every unrelated edit above it — a false expiry is its
 *     own defect, so this is left open rather than closed badly.
 *   - It says nothing about the other assertions in the same test, which is the
 *     limit the schema's docstring already declares.
 *
 * WHY THIS IS NOT A REPORT PARSER. The strong version reads a vitest JSON
 * report and asks whether the named test's `status` is `failed` with a
 * non-empty `assertionResults` — the shape `tools/test-budgets.mjs` already
 * walks. That needs the mutant re-applied and the suite re-run per row, inside
 * a suite, against a table with dozens of rows in files that take minutes. It
 * was not built. The honest consequence is written here rather than implied
 * away: this rule grades the TRANSCRIPT, and a transcript is a thing a human
 * pasted.
 *
 * The rule as one sentence, carrying its tag in the same paragraph so a blank
 * comment line cannot quietly take the claim out of the scan's reach: a
 * witness's recorded output must contain the title of the test its tag
 * declares, read live out of the tree, so a mutant that reddens a file without
 * ever running that test is refused rather than recorded as a catch.
 * `@guarantee a-witness-transcript-names-its-test`
 */
const TRANSCRIPT_FAULTS = ['names-no-test', 'no-failure-line'] as const;

/**
 * Derived from the list above rather than written beside it, so the runtime
 * list and the type are one declaration. The anti-vacuity drive reads the list
 * and asserts every member of it was actually produced — an arm added to the
 * rule without a transcript that reaches it is red rather than silent.
 */
type TranscriptFault = (typeof TRANSCRIPT_FAULTS)[number];

/** `AssertionError: …`, `RangeError: …`, or this codebase's thrown `Error: …`. */
const FAILURE_LINE = /\b[A-Za-z]*Error:\s/;

/** Whitespace in a transcript is the terminal's; a title's is the source's. */
const flatten = (text: string): string => text.split(/\s+/).join(' ').trim();

/**
 * The title as vitest prints it, minus the `[tag]` marker.
 *
 * The marker is dropped because every recorded transcript here drops it: an
 * author copying a failure line trims the tag out, and requiring it back would
 * fail every row for a reason that has nothing to do with whether the test ran.
 */
const titleWithoutMarker = (title: string, id: string): string =>
  flatten(title.split(declarationOf(id)).join(' '));

function transcriptFaults(observed: string, title: string, id: string): TranscriptFault[] {
  const faults: TranscriptFault[] = [];
  if (!flatten(observed).includes(titleWithoutMarker(title, id))) faults.push('names-no-test');
  if (!FAILURE_LINE.test(observed)) faults.push('no-failure-line');
  return faults;
}

/**
 * How many times a verbatim anchor occurs in a repo-relative file.
 *
 * One function with two callers on purpose. `MutationWitness.mutated` and
 * `CollectionKillMutant.mutated` are the same kind of anchor asked the same
 * question, and a second copy of the arithmetic is how the two would drift.
 */
function anchorOccurrences(file: string, anchor: string): number {
  const full = path.join(REPO_ROOT, file);
  if (!existsSync(full)) return -1;
  return readFileSync(full, 'utf8').split(anchor).length - 1;
}

/**
 * How a row is named in a finding.
 *
 * One function with three callers, for the reason `anchorOccurrences` has two:
 * the transcript rule, the domain rule and the replacement rule all name a row
 * the same way, and three copies of one expression is how the three would drift
 * into three spellings of the same fact. The format is quoted verbatim inside a
 * recorded transcript below, so changing it expires that row.
 */
function witnessKey(witness: MutationWitness): string {
  return `${witness.guarantee} :: ${(witness.mutated.split('\n')[0] ?? '').trim()}`;
}

/**
 * The transcript rule's own census, pinned as counts rather than bounds.
 *
 * `GRADED` and `PREDATING` move by one when a witness row is added or when a
 * debt row is closed, which is the friction that makes either a diff somebody
 * wrote on purpose. A bound would let the graded set drain to nothing while the
 * rule reported itself satisfied.
 *
 * WHAT FRACTION OF THE TABLE IT ACTUALLY REACHES, said in the same voice
 * `GUARANTEE_COVERAGE` and `NUMBER_COVERAGE` are said in, because a rule that
 * reads as tree-wide and reaches a third of its own table is the thing this
 * file exists to make impossible: `GRADED` of `GRADED + PREDATING`. The
 * majority of the rows recorded a failure line and no test name, which is what
 * an author pastes when they copy the assertion and not the header above it.
 * Those rows are not known-wrong — their mutants were run — they are simply
 * rows whose transcript cannot say so, and that distinction is the one
 * CLAUDE.md draws about the legacy tag list and asks not to blur in either
 * direction.
 *
 * THE GRADED ROWS ARE NOT AN ARBITRARY THIRD, and the split falls exactly
 * where the census was taken: every graded row but the last is an
 * `src/empire/**` row — §4a's eleven, its denominator pin, and the three on the
 * day-spending anchor — and the last is this rule's own. Those were the most
 * recently written rows in the table and their author pasted the header line
 * above the assertion; the older rows pasted the assertion alone. That is the
 * whole of the pattern. Closing a debt row costs one re-run and one paste, on
 * the module you are already inside.
 */
const TRANSCRIPT_BAR = {
  /** Witness rows whose transcript is held to the rule. */
  GRADED: 22,
  /** ...and rows excused because their transcript predates it. */
  PREDATING: 37,
  /**
   * ...of the graded rows, how many quote a bare measured scalar and therefore
   * owe a `measuredOver` anchor. A count rather than a bound, for the reason
   * the two above are counts: a required set that drained to nothing would
   * leave the domain rule below green and checking nobody.
   */
  WITH_A_MEASURED_NUMBER: 16,
} as const;

// ---------------------------------------------------------------------------
// A number in a transcript cannot be compared, so anchor what it was measured
// over instead
// ---------------------------------------------------------------------------

/**
 * THE GAP THIS CLOSES, MEASURED ON THIS TABLE RATHER THAN SUSPECTED.
 *
 * `attending-a-meet-never-removes-one` recorded `expected 24 to be +0`. Its own
 * anchor mutation gives `expected 86 to be +0` at this tree. The row still
 * bites — same named assertion, still red, and the assertion genuinely ran — so
 * both arms of the transcript rule pass it. Neither reads the number. That is
 * this codebase's most-recorded shape, a quantity carried and displayed and
 * never compared, sitting inside the mechanism written to close a neighbouring
 * instance of it.
 *
 * It went stale TWICE. AXIS B's own domain pin reads 2520 at 06fa4ec, 78926 at
 * ba37cd5 and 322947 at e9040d5; the control the mutant collapses onto reads
 * 24, then 74, then 86. The row was written against the first and survived both
 * deepenings green.
 *
 * WHY THE NUMBER ITSELF IS NOT COMPARED, and this was measured before it was
 * decided rather than after:
 *
 *   - IT CANNOT BE RE-DERIVED FROM THIS TREE. The actual side of a witness
 *     transcript is a measurement of the MUTATED tree, which by construction is
 *     a number the shipped code does not produce. Transplanting this file's own
 *     numeric-prose rule — every numeral must occur in the named test's body —
 *     flags most of the rows that state one, and it is inverted rather than
 *     merely strict: a mutant's count belongs in no assertion here. The
 *     transplant is kept RUNNABLE beside the rule that replaced it, and its
 *     four counts are `TRANSPLANTED_NUMERIC_RULE`, re-derived on every run
 *     rather than written into this sentence.
 *   - AND IT WOULD HAVE WALKED PAST THE DEFECT THAT PROMPTED IT. `24` still
 *     occurs in AXIS B's body today, as `expect(shipped.seasons).toBe(24)`. A
 *     body-scoped resolution check was green through both deepenings, on a
 *     coincidence with an unrelated pin — the same one-level-in failure the
 *     numeric rule's own grant records about `144`.
 *   - THE ONLY ORACLE IS A RE-RUN, AND IT DOES NOT FIT IN A SUITE.
 *     `src/career/eligibility.test.ts` takes 170s whole and 83s narrowed to one
 *     test, measured on this tree; a table of this size is half an hour of
 *     runtime per pass. The re-run a reader has to do by hand is at least
 *     POSSIBLE now: `mutatedTo` records what the mutant put in place of what it
 *     removed, so a row is a patch rather than a description of one. It used to
 *     record neither, and this bullet used to end by saying the number was
 *     unfalsifiable by anybody but its author. It is falsifiable now and it is
 *     still not falsified here — a suite that re-runs a mutant is the thing
 *     priced above, and this rule anchors the domain instead.
 *
 * WHAT IS ENFORCED INSTEAD. A number is a measurement OVER a population, and
 * the population is a thing this codebase pins in the test body as a literal.
 * So the row quotes that pin, and the pin is held exactly as the other two
 * anchors are: it must still occur, once, inside the body of the test the tag
 * names. A sweep that deepens moves its own domain pin, the anchor stops
 * resolving, and the row goes red at the moment its number stopped being true —
 * which is what would have happened at `2520` becoming `78926`, one deepening
 * before anyone noticed.
 *
 * The four faults are separate because each excludes a different way of writing
 * an anchor that cannot expire:
 *
 *   - `no-domain-anchor` — a graded row whose transcript quotes a bare scalar
 *     and anchors no domain at all.
 *   - `domain-anchor-not-in-the-body` — the anchor does not occur exactly once
 *     inside the named test's body. This is the arm that fires on a deepening,
 *     and it is scoped to the body for the reason `redAssertion` is: the same
 *     pin exists in the sibling series test one screen down, and a file-scoped
 *     version would keep resolving against that one.
 *   - `domain-anchor-is-the-property` — the anchor overlaps `redAssertion` in
 *     either direction. WITHOUT THIS ARM THE WHOLE RULE IS A SECOND COPY OF THE
 *     FRESHNESS CHECK: a row could anchor the property assertion it already
 *     anchors, and the two would be red in exactly the same states.
 *   - `domain-anchor-states-no-population` — the anchor states no numeral of
 *     two or more, so it pins a flag or a property's zero rather than a
 *     population, and a deepening would not move it.
 *
 * WHAT IT DOES NOT REACH, said as plainly as the transcript rule says its own
 * limits:
 *
 *   - A number that moved because the MODULE UNDER TEST changed while the
 *     domain held. The anchor still resolves and the row stays green. No static
 *     oracle exists for that; only the re-run priced above does.
 *   - A number that was wrong when it was written. Nothing here runs anything.
 *   - The rows the transcript rule excuses. This does not open a second debt
 *     list — it holds the set that rule already grades, and nothing else.
 *   - A domain change that leaves the mutant's count where it was. The row
 *     expires anyway and costs one re-run to re-anchor. That is churn without
 *     information, and it is the price of the arm above it.
 *
 * NEITHER ARM OF THE TRANSCRIPT RULE SUBSUMES THIS AND IT SUBSUMES NEITHER,
 * compared on inputs rather than on intuition: `transcriptFaults` reads
 * `observed` and the live title and nothing else; this reads `measuredOver`,
 * `redAssertion` and the body and never the transcript's words. Disjoint
 * inputs, so no state of one decides the other. It is kept out of
 * `TRANSCRIPT_FAULTS` for a second reason as well, and that one is the standing
 * rule about a new check killing an old one: the excused rows are held by
 * `expect(faults.length).toBeGreaterThan(0)`, so folding a fault kind those
 * rows can trip into that list would let a stale excuse pass on the new arm's
 * finding.
 *
 * The rule as one sentence, carrying its tag in the same paragraph for the
 * reason the transcript rule's does — a blank comment line between a claim and
 * its tag has taken a claim out of a scan's reach in this repository already: a
 * witness that quotes a measured number must also quote, verbatim from the body
 * of the test its tag names, the population pin that number was measured over,
 * so a sweep that deepens expires the row instead of leaving a stale figure
 * standing as evidence. `@guarantee a-measured-transcript-anchors-its-domain`
 */
const DOMAIN_FAULTS = [
  'no-domain-anchor',
  'domain-anchor-not-in-the-body',
  'domain-anchor-is-the-property',
  'domain-anchor-states-no-population',
] as const;

/** Derived from the list, for the reason `TranscriptFault` is derived from its own. */
type DomainFault = (typeof DOMAIN_FAULTS)[number];

/**
 * Vitest prints the actual side bare when it is a number — `expected 86 to be
 * +0`, `expected 43 to be 50`. An array or a string on that side prints its own
 * shape instead, and a row quoting one owes no domain because there is no
 * measured quantity to be stale.
 */
const MEASURED_SCALAR = /expected\s[+-]?\d+(?:\.\d+)?\sto\s/;

/**
 * What the obvious rule measures on this table, pinned so the argument against
 * it is a fact in the repository rather than a sentence in a report.
 *
 * `rows` is the transcripts that state a numeral at all, `flagged` the ones
 * holding at least one the named test's body does not carry, and the two
 * numeral counts the same population one grain down. It is re-derived in the
 * test rather than transcribed here, so it moves when the table does.
 */
const TRANSPLANTED_NUMERIC_RULE = {
  rows: 51,
  flagged: 39,
  numerals: 136,
  unresolved: 74,
} as const;

/** Whether an anchor states a population rather than a property's 0 or 1. */
function statesAPopulation(anchor: string): boolean {
  for (const match of anchor.matchAll(/\d+(?:\.\d+)?/g)) {
    if (Number(match[0]) >= SMALLEST_POPULATION) return true;
  }
  return false;
}

/**
 * What is wrong with one row's domain anchor, or an empty list.
 *
 * `body` is the body of the test the tag declares — `null` when no test
 * declares it, which the freshness check reports on its own and this one then
 * reads as "not in the body" rather than crashing.
 */
function domainAnchorFaults(
  witness: MutationWitness,
  body: string | null,
  graded: boolean,
): DomainFault[] {
  const anchor = witness.measuredOver;
  if (anchor === undefined) {
    return graded && MEASURED_SCALAR.test(flatten(witness.observed)) ? ['no-domain-anchor'] : [];
  }
  const faults: DomainFault[] = [];
  const occurrences = anchor.length > MIN_ANCHOR_LENGTH ? (body ?? '').split(anchor).length - 1 : 0;
  if (occurrences !== 1) faults.push('domain-anchor-not-in-the-body');
  if (anchor.includes(witness.redAssertion) || witness.redAssertion.includes(anchor)) {
    faults.push('domain-anchor-is-the-property');
  }
  if (!statesAPopulation(anchor)) faults.push('domain-anchor-states-no-population');
  return faults;
}

// ---------------------------------------------------------------------------
// A row records what its mutant replaced; without what it replaced it WITH,
// nobody but its author can apply it
// ---------------------------------------------------------------------------

/**
 * THE GAP THIS CLOSES, FOUND BY A ROUND THAT TRIPPED OVER IT DOING SOMETHING
 * ELSE.
 *
 * `mutated` is the verbatim text a mutant replaced. A row said nothing about
 * what it put there, so a reader who wanted to check one had to GUESS the edit
 * — and a round did exactly that, inferring a mutant from the name of a control
 * in a neighbouring comment, and recording that it had guessed. Every row in
 * this table was an unfalsifiable claim by anybody except its author, which is
 * the property this whole file spends its length arguing against. "Apply it and
 * re-run" is not something a reader can do with a patch they do not have.
 *
 * `mutatedTo` is the other half of the patch, and with it a row IS the edit:
 *
 *   readFileSync(mutatedFile).split(mutated).join(mutatedTo)
 *
 * `mutated` has to resolve exactly once in that file — the freshness loop holds
 * it to that — so the split is unambiguous, and the pair is a whole edit with no
 * line numbers in it. Apply it, run the named test, and the recorded assertion
 * is either red or the row is wrong. That is the whole of what the field buys.
 *
 * AN EMPTY STRING IS A DELETION AND IS A LEGITIMATE VALUE. Several mutants in
 * this table delete a line or drop a branch, and `mutatedTo: ''` records that
 * exactly. The rule reads the field with `=== undefined` and never for
 * truthiness, so a deletion is graded like any other replacement rather than
 * read as a row that forgot to carry one. The planted drive below contains a
 * deletion for that reason: it is the case an `if (!mutatedTo)` implementation
 * gets wrong, and it would get it wrong silently.
 *
 * AN INSERTION IS THE SAME OPERATION FROM THE OTHER SIDE. The rows here whose
 * mutant APPENDS a declaration had nothing to anchor on but the declaration
 * above the insertion point, and they say so in their own comments; with this
 * field they record that anchor followed by what was appended, and an append
 * becomes an edit a reader can make rather than one they have to compose.
 * Insert, delete and substitute are one replacement against one anchor, which is
 * the argument for this shape over the two that were rejected:
 *
 *   - A UNIFIED DIFF carries line numbers and context lines. Both go stale on an
 *     unrelated edit above the hunk — the transcript rule refuses to pin a
 *     source position for exactly that reason — and applying one by hand needs a
 *     parser rather than a text editor.
 *   - A SELF-APPLYING FUNCTION can do anything: a regex, several sites, a
 *     condition. A reader would have to run code to learn what the mutation was,
 *     and the expiry this table is built on is a property of a STRING anchor,
 *     not of a callback.
 *   - ONE ARROW-JOINED STRING, which is what the browser witness table in
 *     `tools/verify-cutin-cap.mjs` already uses — `BROWSER_MUTATION_WITNESSES`
 *     writes its one row's mutant as `before -> after`, so the class of witness
 *     this schema is documented as unable to hold is the class that recorded
 *     both sides, and the sibling asymmetry is worth reading twice: the table
 *     with the machine checks around it is the one that was missing the field.
 *     The arrow form is not copied here for
 *     two reasons: the separator has to be a sequence neither side contains and
 *     no such sequence can be guaranteed of arbitrary source, and a deletion
 *     comes out as a string ending in the separator, which is exactly the
 *     "empty is a value, not an absence" distinction this field is careful
 *     about. Two fields need no separator and no parse.
 *
 * WHAT IS CHECKED WITHOUT RUNNING ANYTHING, and it is much less than a re-run:
 * that applying the patch to the tree as it stands changes it, and that a mutant
 * living in the same file as its own red assertion does not delete that
 * assertion. Those are the two arms below.
 *
 * WHAT IS NOT CHECKED, said as plainly as the two rules above say their own
 * limits. Nothing re-runs the mutant, so a row still does not prove its test
 * went red — it proves a reader can find out in one command. A replacement that
 * does not compile, or that is simply not the edit whose transcript sits beside
 * it, is accepted here and refused by the first person who applies it. The rule
 * moves a row from unfalsifiable to falsifiable and leaves the falsifying to
 * whoever cares. That is a smaller claim than it sounds, and it is the whole of
 * it.
 *
 * AND THE SHARPEST HOLE, WHICH IS IN THE SHAPE AND NOT IN THE CHECKING. One
 * anchor and one replacement is ONE SITE. A mutant made of two edits in two
 * places — and this table holds rows describing exactly that, §4a's recruit row
 * says so in its own comment and names the second edit in prose — cannot be
 * written down here. A row could record one of the two edits, satisfy both arms,
 * and hand a reader a patch that does not reproduce the transcript beside it.
 * Nothing detects that, because nothing here knows how many edits a mutant was
 * made of. Those rows are on the debt list below rather than closed, so no such
 * claim is shipped today; what is shipped is a schema that would accept one. The
 * honest treatment when a two-site mutant is next witnessed is to say in that
 * row's own comment that the recorded patch is one half and to name the other,
 * which is what the recruit row already does in prose — the field does not make
 * that unnecessary, it makes the half it holds mechanical. Recording the two
 * halves as two rows would be worse than the prose: each row would look like a
 * whole patch and neither would reproduce anything on its own. A field taking a
 * LIST of patches was considered and left unbuilt, because every row in this
 * table today is one site and the cost of the general case is paid at
 * declaration time by everybody who is not in it.
 *
 * WHY THIS RULE CARRIES NO `@guarantee` TAG WHERE THE TWO ABOVE DO, which is a
 * decision and not an oversight. A tag has to carry a witness, and a witness has
 * to anchor its mutant in a file that is not the one holding the anchor — so the
 * mutant would have to live outside this file. The external edits that redden
 * this rule redden it by making a recorded anchor stop occurring or its file
 * vanish, and the freshness loop is red on both of those first: the witness
 * would resolve, pass, and be evidence about a check other than this one. That is the "pin on a fact
 * adjacent to the claim" shape, and it reads exactly like a pin on the claim.
 * The edits that DO separate this rule from everything else in the file — a
 * replacement equal to what it replaced, a mutant deleting its own red
 * assertion, presence read by truthiness — are all edits to this file, which the
 * schema cannot anchor for the reason the numeric rule's own row records. So the
 * mutation evidence for this rule is in the paragraph below and in the commit
 * that added it, in the shape CLAUDE.md prescribes for a witness that cannot
 * bind to the schema: the verbatim mutant and the verbatim assertion that
 * reddened, just not machine-resolvable.
 *
 * THE MUTANTS, EACH RUN AT DECLARATION AND EACH RESTORED, on
 * `src/game/guaranteeTags.test.ts` itself:
 *
 *   - A row appended to the table carrying every other field and no
 *     `mutatedTo`. Red: `the claims whose witness rows still record no
 *     replacement`, naming the claim it planted. The transcript rule's own
 *     graded count moves with it, which is why the finding names the claim
 *     rather than a total.
 *   - `mutatedTo: 'expect(shipped.pairs).toBe(80602);'` rewritten to `…80601);`,
 *     which is the text that row replaced. Red, and alone: `witness rows whose
 *     recorded replacement is not an edit to this tree`, naming the row and the
 *     arm.
 *   - `if (applied === source) faults.push(…)` disabled. Red on the planted row
 *     `a replacement identical to the text it replaced`.
 *   - The `witness.mutatedFile === witness.testFile` guard forced false. Red on
 *     the planted row `a mutant that deletes its own red assertion`.
 *   - A deletion planted on a live row — `mutatedTo: ''` — with the loop's
 *     `=== undefined` reading rewritten to `!witness.mutatedTo`. Red: `witness
 *     rows a third party can apply and re-run: expected 5 to be 6`. With the
 *     `=== undefined` reading in place the same deletion is green, which is the
 *     pair that says an empty replacement is a value and not an absence.
 */
const REPLACEMENT_FAULTS = [
  'replacement-does-not-change-the-file',
  'replacement-removes-the-red-assertion',
] as const;

/** Derived from the list, for the reason `TranscriptFault` is derived from its own. */
type ReplacementFault = (typeof REPLACEMENT_FAULTS)[number];

/**
 * The two arms, separate because each excludes a different way a recorded
 * replacement is not a patch:
 *
 *   - `replacement-does-not-change-the-file` — applying it to `mutatedFile` as
 *     it stands leaves the file byte-identical. One arm covering the two ways
 *     that happens: the replacement is the text it replaced, and the anchor does
 *     not occur so there is nothing to replace.
 *   - `replacement-removes-the-red-assertion` — the mutant edits the same file
 *     the row's red assertion lives in, and applying it takes that assertion out
 *     of the body of the test the tag names. A row claiming an assertion
 *     reddened under a mutant that deletes the assertion is incoherent, and this
 *     is the only thing in the file that reads the MUTATED text at all.
 *
 * WHY THE OCCURRENCE CHECK IS NOT REPEATED HERE, compared symbolically rather
 * than by intuition, because a new rule killing an old one is a standing check
 * and two have died that way in this file's neighbourhood. The freshness loop
 * asserts `anchorOccurrences(mutatedFile, mutated) === 1`. At zero occurrences
 * both it and the first arm are red; at two the freshness loop is red and the
 * arm is green, since a replacement still changes the file; at one occurrence
 * with the replacement equal to what it replaced, the arm is red and the
 * freshness loop is green. Neither implies the other, so both stay and neither
 * is restated here.
 *
 * AND NEITHER OF THE OTHER TWO RULES REACHES THIS ONE, compared on inputs the
 * way the domain rule compares itself with the transcript rule. `transcriptFaults`
 * reads `observed` and the live title; `domainAnchorFaults` reads `measuredOver`,
 * `redAssertion` and the body of the test as the tree holds it. Neither reads
 * `mutatedTo`, and this reads neither `observed` nor `measuredOver`. The one
 * field two of them share is `redAssertion`, and they ask different questions of
 * it: the domain rule asks what the anchor overlaps in the tree as it stands,
 * this one asks whether the assertion survives the patch. Disjoint inputs, so no
 * state of one decides another.
 *
 * WHY A WHITESPACE-ONLY REPLACEMENT IS ACCEPTED, which was the obvious third arm
 * and was refused on this repository's own history. Flattening both sides and
 * calling them equal would ban the mutant that inserts a blank comment line
 * between a claim and its tag — an edit that has silently removed a check here
 * once already, and therefore precisely the mutant somebody ought to be
 * recording a witness for. It would also strictly contain the first arm, which
 * is the domination shape the standing check exists to catch.
 *
 * `source` is the current text of `mutatedFile`, or an empty string when that
 * file is gone — which the freshness loop reports on its own and this one then
 * reads as "applying it changes nothing", because a patch to a file that is not
 * there is not a patch.
 *
 * A row carrying no replacement at all is not this function's business. The
 * census below holds presence, in both directions, and an arm here would be
 * dominated by it: no state of the table reddens one while the other passes.
 */
function replacementFaults(witness: MutationWitness, source: string): ReplacementFault[] {
  const replacement = witness.mutatedTo;
  if (replacement === undefined) return [];
  const faults: ReplacementFault[] = [];
  const applied = source.split(witness.mutated).join(replacement);
  if (applied === source) faults.push('replacement-does-not-change-the-file');
  if (
    witness.mutatedFile === witness.testFile &&
    !(bodyOfTestDeclaring(applied, witness.guarantee) ?? '').includes(witness.redAssertion)
  ) {
    faults.push('replacement-removes-the-red-assertion');
  }
  return faults;
}

/** The rows carrying no replacement, counted per claim. */
function replacementDebt(
  rows: readonly MutationWitness[],
): Array<readonly [string, number]> {
  const counts = new Map<string, number>();
  for (const witness of rows) {
    if (witness.mutatedTo !== undefined) continue;
    counts.set(witness.guarantee, (counts.get(witness.guarantee) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * THE ROWS THAT PREDATE THE FIELD, COUNTED PER CLAIM RATHER THAN IN TOTAL.
 *
 * RETROFITTING THE WHOLE TABLE WAS REFUSED, and the refusal is the interesting
 * part. Fifty-odd replacements, most of which this round would be GUESSING out
 * of a sentence beside the row — and a guessed patch reads as evidence while
 * being invention, which is worse than an absent one. So the rows that were here
 * keep their debt, the rows that arrive from now on carry the field, and the
 * ones already closed were closed by applying the patch and watching the named
 * assertion redden rather than by reading the comment above the row. Each one
 * carries a note saying so, and `REPLACEMENT_BAR.REPRODUCIBLE` counts them.
 *
 * PER CLAIM AND NOT A TOTAL, because a total lets a new row slip in under a
 * bumped number without naming what was excused — the argument
 * `UNWITNESSED_LEGACY_TAGS` already makes against a count, one grain finer. A
 * bare total is also strictly dominated by this one, being its sum, and a
 * dominated check is a check that can never speak.
 *
 * THE KEY IS THE CLAIM AND NOT THE ROW, and that is forced rather than chosen:
 * two rows in this table share `guarantee`, `mutatedFile` and `mutated`
 * verbatim, because both APPEND at the same anchor. No key built out of a row's
 * own fields identifies a row uniquely, so a per-row list would be a multiset
 * whose failure message could not say which of the two moved.
 *
 * IT IS VISIBLY MONOTONE AND NOT ENFORCEABLY SO, written down because the
 * difference is the whole honesty of the mechanism. Nothing in this repository
 * stops a future author editing a number upward. What the pin buys is that they
 * have to, in a diff that names the claim being excused, with this paragraph
 * next to it. The direction is a convention with friction behind it rather than
 * an invariant, and a report that called it enforced would be wrong.
 */
const REPLACEMENTS_PREDATING_THE_RULE: readonly (readonly [string, number])[] = [
  ['a-filled-slot-is-not-a-one-way-door', 1],
  ['a-meet-total-reaches-the-session-half', 1],
  ['a-preview-server-cannot-reach-a-played-meet', 1],
  ['a-purse-shops-once-a-calendar-day', 1],
  ['a-remount-resumes-rather-than-opens', 1],
  ['a-sale-never-follows-a-settle', 1],
  ['a-slot-costs-the-same-by-every-route', 2],
  ['a-wire-in-flight-refuses-a-write', 1],
  ['bar-stays-on-his-back-for-the-call', 1],
  ['completion-revalidates-against-settled-state', 1],
  ['dropping-the-doomed-burn-measures-worse', 2],
  ['every-refusal-sentence-is-true-of-its-screen', 1],
  ['every-shipped-route-is-sealed', 2],
  ['every-shipped-route-observes-its-seal', 1],
  ['no-accelerant-moves-a-physio-element', 4],
  ['no-accelerant-moves-a-training-iq-element', 7],
  ['no-rattle-is-cut-by-another-rattle', 1],
  ['one-row-behind-one-port', 1],
  ['one-streak-mapping', 1],
  ['pr-sentence-and-pr-border-are-one-decision', 1],
  ['section-4a-denominator-is-measured', 1],
  ['settling-is-terminal', 1],
  ['the-copy-reads-the-clients-screen', 1],
  ['the-covered-day-scan-follows-aliases', 1],
  ['the-covered-day-scan-reads-the-whole-tree', 3],
  ['the-day-granularity-residue-is-the-decision-moment', 1],
  ['the-day-shops-purse-by-purse', 1],
  ['the-decision-ignores-the-rendered-offer', 1],
  ['the-opener-follows-the-lifter', 1],
  ['the-pr-word-needs-a-record-to-beat', 4],
  ['tier-pr-is-reached-by-no-screen', 1],
];

/**
 * The rule's own census, pinned as counts rather than bounds for the reason
 * `TRANSCRIPT_BAR`'s are: an emptied set satisfies a loop of `expect`s over the
 * rows in it, and the loop would report itself green while grading nobody.
 */
const REPLACEMENT_BAR = {
  /** Rows carrying a replacement, so a third party can apply the patch. */
  REPRODUCIBLE: 11,
  /**
   * ...of those, the ones whose mutant edits the very file their red assertion
   * lives in, which is the second arm's live domain. At zero that arm would be
   * driven by planted rows alone, and this number is here to say so out loud
   * rather than leave it to be discovered.
   */
  IN_THEIR_OWN_TEST_FILE: 1,
} as const;

/**
 * Mutants that turn a test file red WITHOUT running a test — the shape the
 * TRANSCRIPT rule exists to refuse, kept as real records rather than as a
 * description. It is two sections up rather than immediately above, since the
 * replacement rule was written in between.
 *
 * Each was applied to the source named, the file was run alone with
 * `--reporter=json`, and the report came back with `numTotalTests` at zero and
 * one failed suite. `observed` is that run's message. They are held here for
 * two reasons: a reader can re-apply them, and the rule is driven against them
 * below, so loosening it until one of these would be accepted is a red test
 * rather than a quiet widening.
 *
 * `mutated` is a freshness anchor exactly like a witness's: it must still occur
 * once in its file, so a record whose subject has been edited away expires
 * instead of standing as evidence about code that is gone.
 */
interface CollectionKillMutant {
  readonly mutatedFile: string;
  /** Verbatim text the mutant replaced. Must still occur, exactly once. */
  readonly mutated: string;
  /** The tag whose test the mutant was run against. */
  readonly wouldHaveWitnessed: string;
  /** What the red run printed. */
  readonly observed: string;
  readonly why: string;
}

const COLLECTION_KILL_MUTANTS: readonly CollectionKillMutant[] = [
  {
    mutatedFile: 'src/empire/recruitment.ts',
    mutated: 'shared wall-clock balance, which is §4 of the header.\n  if (state.settledBooks[RECRUIT_BOOK] < quote.costGymBucks) {',
    wouldHaveWitnessed: 'no-accelerant-moves-a-training-iq-element',
    observed:
      'Test Files  1 failed | Tests  no tests\n' +
      'RangeError: gymBucks must be a finite number at or above zero, received -40.',
    why:
      "the recruit gate reads the accelerated purse while `beginRecruitment`'s debit " +
      'stays on `RECRUIT_BOOK`, so the wall-clock book goes negative as the grid is built',
  },
  {
    mutatedFile: 'src/empire/expansion.ts',
    mutated: '  if (bookBalance(context, book) < quote.cost) {',
    wouldHaveWitnessed: 'no-accelerant-moves-a-physio-element',
    observed:
      'Test Files  1 failed | Tests  no tests\n' +
      'RangeError: gymBucks must be a finite number at or above zero, received -600.',
    why:
      'the same shape one module over, and the reason this list has two entries rather ' +
      'than one: the defect sat in both arms of the same pair of checks, and only one ' +
      'arm had been looked at',
  },
];

/**
 * TAGS THAT PREDATE THE WITNESS BAR — tracked debt, closed opportunistically
 * when the module around them is next touched, NOT in a mass audit.
 *
 * IT IS AN EXPLICIT LIST AND NOT A DATE OR A COUNT. A cutoff by date needs a
 * clock; a cutoff by count lets a new tag slip in under it. A named list means
 * adding a tag without a witness is a diff somebody has to write on purpose,
 * with this comment next to it.
 *
 * TWO OF THESE WERE THE MEASURED FAILURES — `mid-absence-arrival-cannot-arm`
 * and `protection-toggle-is-not-a-refill`. Both tests were strengthened and both
 * now fail on their mutant; they are still listed because the witness was not
 * RECORDED at the time, and an unrecorded mutation is exactly the thing this
 * table replaces. Re-taking them is a minute each, next time either module is
 * open.
 *
 * IT MAY ONLY SHRINK. `streak.test.ts` and this file both fail if an entry here
 * names no tag in the tree, so a stale entry is caught; and the test below fails
 * if a tag is neither witnessed nor listed, so a new one cannot arrive unwitnessed.
 */
const UNWITNESSED_LEGACY_TAGS: readonly string[] = [
  'absence-reads-the-armed-snapshot',
  'coverage-protects-never-adds',
  'doomed-absence-takes-what-is-left',
  'export-surface-exhaustive',
  'grace-is-recomputed-not-banked',
  'mid-absence-arrival-cannot-arm',
  'milestones-pay-nothing',
  'monotonicity-exhaustive',
  'never-reads-a-clock',
  'no-accept-decline-path',
  'no-tender-arrives-by-training',
  'nothing-in-game-awards-a-purchased-day',
  'one-source-credits-a-purchased-day',
  'protection-toggle-is-not-a-refill',
  'purchase-cannot-rescue-a-doomed-run',
  'settling-is-a-recording',
  'training-is-the-only-debit',
];

/**
 * The witnesses. Every tag not in the list above must have one.
 *
 * Each was taken by hand on the run that added it: break it, watch it fail,
 * read the message, restore, confirm green.
 *
 * ONE TAG MAY HAVE SEVERAL, and the §6.5 block below is the first to use it.
 * The checks are per-entry — anchors resolve, the assertion sits in the test
 * that declares the tag — so four entries are four independent expiries rather
 * than one restated. A claim that spans two modules is not witnessed by a
 * mutant in one of them.
 */
/**
 * §4a's kill list, as a pair of counts rather than as a sentence.
 *
 * The list was eight prose summaries. Converting it to witnesses closes the
 * half a reader could not re-derive and leaves a different half open: nothing
 * stops a NINTH bullet arriving with no mutant behind it, because the witness
 * bar only asks that a tag have at least one row. These two numbers are what
 * the check below compares the bullets against.
 *
 * It also catches the paragraph-break defect this repository has already paid
 * for once — a blank comment line inserted between a claim and its tag, which
 * silently takes the claim out of the numeric rule's reach. The check reads the
 * paragraph that carries BOTH tags and counts the bullets inside it, so a break
 * between the bullets and the tags reports zero bullets rather than passing.
 */
const SECTION_4A_TAGS: readonly string[] = [
  'no-accelerant-moves-a-training-iq-element',
  'no-accelerant-moves-a-physio-element',
];

const SECTION_4A_KILL_LIST = {
  /** Bullets in §4a's "killed here" list. */
  MUTANTS: 8,
  /** Rows below carrying one of the two tags — three mutants move both series. */
  ROWS: 11,
} as const;

const MUTATION_WITNESSES: readonly MutationWitness[] = [
  // -------------------------------------------------------------------------
  // The lift press guard — the fix a human playtest asked for, on the screens a
  // player can actually press.
  //
  // THE MUTANT IS THE STATE THAT SHIPPED, not an invented one. `PRESS_NOT_TAKEN`
  // was declared inside `LiftScreen.tsx` — the replay harness, which `AppShell`
  // mounts only behind `route.surface === 'replay'` — so `SetView` and
  // `AttemptView` had exactly this deletion in them for a wave while the guard
  // that named `LiftScreen.tsx` stayed green. Deleting it again from `SetView`
  // reproduces that state, and the assertion that reddens names the screen and
  // its testID rather than reporting a count.
  //
  // The browser half of the same mutant is not recordable here — this table
  // binds to an `it(` body and `tools/verify-lift-press.mjs` has none. It was
  // measured anyway and written into the merge commit, as the paragraph on the
  // browser class asks: with this deletion applied that tool reports 5 red of 23
  // on the session arm, including `pointercancel=1` at both pan scales where the
  // fixed surface reads 0.
  {
    guarantee: 'press-guard-on-every-played-surface',
    mutatedFile: 'src/session/SetView.tsx',
    mutated:
      '    // manipulation` and 20px of finger drift hands the descent to the browser.\n'
      + '    ...PRESS_NOT_TAKEN,',
    mutatedTo: '',
    testFile: 'src/lift/liftInput.test.ts',
    redAssertion:
      "          'the browser will claim a drifting press and the app will not hear the rest of the gesture',\n"
      + '      );\n'
      + "    expect(bare, bare.join('\\n')).toEqual([]);",
    observed:
      'FAIL  src/lift/liftInput.test.ts > every lift press surface in the repository carries the '
      + 'press guard > the pressed element declares the property that does NOT inherit '
      + '[press-guard-on-every-played-surface]\n'
      + 'AssertionError: src/session/SetView.tsx presses <LiftStage> through a <Pressable> (testID '
      + '"session-touch") whose style does not spread PRESS_NOT_TAKEN from src/lift/pressGuard.ts. '
      + 'touch-action does not inherit, so no ancestor can supply it: the browser will claim a '
      + 'drifting press and the app will not hear the rest of the gesture: expected [ Array(1) ] to '
      + 'deeply equal []',
  },
  // -------------------------------------------------------------------------
  // GDD §2.1's career spine — which meets a lifter may enter, and the two ways
  // "a player who did more must not end up worse off" can be asked of it.
  //
  // TWO TAGS AND TWO MUTANTS, because the axes are two claims: one is about a
  // bigger Total, the other about one more meet on the record, and a mutant on
  // either leaves the other's test green. Both mutants were chosen so that the
  // assertion that reddens is the PROPERTY rather than one of the sweep's
  // domain pins — the first attempt at the strength mutant reported "expected
  // 1200 to be 55301", which is true, is about the population, and would have
  // recorded a pin on a fact adjacent to the claim as evidence for the claim.
  // The test now asserts the property first for exactly that reason.
  {
    guarantee: 'strength-never-removes-a-meet',
    mutatedFile: 'src/career/eligibility.ts',
    mutated: '  return meetsQualifyingTotal(lifter.bestTotalKg, meet.qualifyingTotalKg);',
    mutatedTo: '  return !meetsQualifyingTotal(lifter.bestTotalKg, meet.qualifyingTotalKg);',
    testFile: 'src/career/eligibility.test.ts',
    redAssertion:
      'expect(shipped.violatingPairs).toBe(0);\n'
      + '    expect(shipped.worstDeficit).toBe(0);\n'
      + '\n'
      + '    // The domain, pinned as counts rather than as bounds.',
    measuredOver: 'expect(shipped.pairs).toBe(80601);',
    observed:
      'FAIL src/career/eligibility.test.ts > AXIS A — a higher best Total never qualifies for '
      + 'fewer meets > [strength-never-removes-a-meet] every ordered pair on the grid, and the '
      + 'control beside it\n'
      + 'AssertionError: expected 55701 to be +0 // Object.is equality',
  },
  {
    guarantee: 'attending-a-meet-never-removes-one',
    mutatedFile: 'src/career/eligibility.ts',
    mutated:
      '    bestTotalKg: lifter.bestTotalKg === null ? totalKg : Math.max(lifter.bestTotalKg, totalKg),',
    mutatedTo: '    bestTotalKg: totalKg,',
    testFile: 'src/career/eligibility.test.ts',
    redAssertion:
      'expect(shipped.violatingPairs).toBe(0);\n'
      + '    expect(shipped.worstDeficit).toBe(0);\n'
      + '\n'
      + '    // The domain. `badDays` is the count that matters most',
    // RE-RUN AT `MAX_GAIN_KG` 20, NOT CARRIED OVER. The sweep's gain rate moved,
    // so both this row's anchor and its transcript moved with it: the domain is
    // 332012 pairs where it was 343577, and the mutant reports 283 where it
    // reported 173. The mutation itself is unchanged, the named assertion is
    // unchanged, and it still reddens — which is what a witness is for and is
    // exactly what re-running it establishes. The sibling row above was re-run
    // in the same pass and did NOT move: axis A sweeps a total grid rather than
    // simulated careers, so no gain rate can reach it, and 55701 is the same
    // number it always was.
    measuredOver: 'expect(shipped.pairs).toBe(332012);',
    observed:
      'FAIL src/career/eligibility.test.ts > AXIS B — competing at one more meet never qualifies '
      + 'for fewer > [attending-a-meet-never-removes-one] every skipped meet in every seeded '
      + 'season, and the control beside it\n'
      + 'AssertionError: expected 283 to be +0 // Object.is equality',
  },
  // -------------------------------------------------------------------------
  // The numeric half of the tag, witnessed from BOTH sides of its set equality,
  // because the two halves fail on opposite edits and one says nothing about
  // the other.
  {
    // (1) THE FILE-SCOPED READING, WHICH IS THE VERSION THE GRANT REFUSED. The
    // mutant hands the whole test FILE back where the shared scoper hands back
    // the body of the named test. It is not a hypothetical weakening: six of
    // the seven excuses immediately go stale, meaning six numbers this rule
    // holds unpinned would have been accepted by a file-scoped version because
    // the figure exists in that file for some other check's reasons.
    //
    // THE MUTANT IS IN `audit.ts` AND NOT AT THIS FILE'S OWN CALL SITE, and
    // that is forced rather than chosen: `mutated` must resolve exactly once in
    // `mutatedFile`, so a mutant inside THIS file can never be witnessed here —
    // quoting the anchor puts a second copy of it in the same file. Same shape
    // as CLAUDE.md's note that the schema cannot hold a browser check. The
    // scoper is the honest subject anyway; this file only chooses the marker.
    //
    // REPLACEMENT TAKEN BY RE-RUNNING IT, not by reading the paragraph above.
    // Applying it reddens the named assertion exactly as recorded, with one
    // difference the field is worth having for: `observed` says `…(6)` stale
    // excuses and this tree gives five. The transcript predates the transcript
    // rule and is excused by it; what the replacement adds is that a reader can
    // discover that for themselves in one command instead of taking the row's
    // word for it.
    guarantee: 'a-cited-number-resolves-in-the-named-test',
    mutatedFile: 'src/tuning/audit.ts',
    mutated: '    if (body.includes(marker)) return body;',
    mutatedTo: '    if (body.includes(marker)) return text;',
    testFile: 'src/game/guaranteeTags.test.ts',
    redAssertion:
      "      audit.staleExcuses,\n      'an entry on UNPINNED_PROSE_NUMBERS anchors nowhere or excuses nothing',\n    ).toEqual([]);",
    observed:
      'AssertionError: an entry on UNPINNED_PROSE_NUMBERS anchors nowhere or excuses nothing: '
      + 'expected [ …(6) ] to deeply equal [] — received "section-4a-denominator-is-measured: '
      + '\\"It read 49 before §4c\'s day-anchor block added a check\\" excuses nothing any more", '
      + 'and five more naming the Option 1 rework, both milestone counterfactuals and the '
      + 'window-boundary illustration',
    transcriptPredatesTheRule: true,
  },
  {
    // (2) THE DEFECT ITSELF, PUT INTO PROSE. The mutant moves one digit of a
    // measurement in a tagged paragraph — `785` to `786` — which is exactly how
    // the two `src/empire/` instances happened: the sentence stayed confident
    // and the number stopped being the one the check pins. The anchor is the
    // prose line, so this witness expires when that sentence is rewritten,
    // which is the correct coupling for a claim about a sentence.
    //
    // REPLACEMENT TAKEN BY RE-RUNNING IT. The finding reproduces word for word
    // except for the source line the scan reports the sentence on, which has
    // moved down the file since the transcript was pasted.
    guarantee: 'a-cited-number-resolves-in-the-named-test',
    mutatedFile: 'src/game/streak.ts',
    mutated: " * lifter's training moved — measured at 105 / 305 / 733 / 785 violating pairs",
    mutatedTo: " * lifter's training moved — measured at 105 / 305 / 733 / 786 violating pairs",
    testFile: 'src/game/guaranteeTags.test.ts',
    redAssertion:
      "      audit.unpinned,\n      'a tagged claim states a number that the test it names does not carry — pin it in that '",
    observed:
      'AssertionError: a tagged claim states a number that the test it names does not carry — '
      + 'pin it in that test, or say why it cannot be, on UNPINNED_PROSE_NUMBERS: expected '
      + '[ Array(1) ] to deeply equal [] — received [ "src/game/streak.ts:2567 '
      + '[no-tender-arrives-by-training] cites 786, which is not in the body of the test the tag '
      + 'names — \\"…measured at 105 / 305 / 733 / [786] violating pairs against 0 for…\\"" ]',
    transcriptPredatesTheRule: true,
  },
  // -------------------------------------------------------------------------
  // GDD §5.3 — the roster's one-way door, which was a §12.3 breach.
  //
  // FOUR MUTANTS ACROSS THREE FILES for three tags, because the repair is three
  // separate claims and a mutant in one of them witnesses none of the others:
  // that a filled slot can move at all, that reaching a tier costs the same by
  // every route (price AND timer, which are two mutants because the timer half
  // was found only after the price half was already in), and that what the
  // repair does not remove is the simulated player's decision moment.
  {
    guarantee: 'a-filled-slot-is-not-a-one-way-door',
    mutatedFile: 'src/empire/empireInvariant.ts',
    mutated: '  if (upgrades === SHIPPED_ROSTER_UPGRADE && rosterAllowed && !recruitedNow) {',
    testFile: 'src/empire/engagement.test.ts',
    redAssertion: 'expect(keepsMomentViolating).toBe(0);',
    observed:
      'splits that arm by whether the extra check-in moved the day it spends at\n' +
      'AssertionError: expected 5 to be +0 // Object.is equality',
    transcriptPredatesTheRule: true,
  },
  {
    // The timer half. Price telescoping alone left a slot that reached `club`
    // by promotion carrying the `novice` timer, so it held 240 seconds more
    // permanent tenure than one that recruited `club` outright — 2318 violating
    // pairs of 16512 at a worst deficit of 0.000032 Training IQ per day.
    guarantee: 'a-slot-costs-the-same-by-every-route',
    mutatedFile: 'src/empire/recruitment.ts',
    mutated: '    addedSeconds: recruitSeconds(to) - recruitSeconds(from),',
    testFile: 'src/empire/engagement.test.ts',
    redAssertion: 'expect(keepsMomentViolating).toBe(0);',
    observed:
      'splits that arm by whether the extra check-in moved the day it spends at\n' +
      'AssertionError: expected 2318 to be +0 // Object.is equality',
    transcriptPredatesTheRule: true,
  },
  {
    // The price half, charged in full rather than as the difference — which is
    // the version where an early cheap lifter really is a sunk cost.
    guarantee: 'a-slot-costs-the-same-by-every-route',
    mutatedFile: 'src/empire/recruitment.ts',
    mutated: '  const difference: number = recruitCost(to) - recruitCost(from);',
    testFile: 'src/empire/engagement.test.ts',
    redAssertion: 'expect(keepsMomentViolating).toBe(0);',
    observed:
      'splits that arm by whether the extra check-in moved the day it spends at\n' +
      'AssertionError: expected 6 to be +0 // Object.is equality',
    transcriptPredatesTheRule: true,
  },
  {
    // The counterfactual's own knob. With `spendsOn` ignored, the held-anchor
    // reading collapses into the free-anchor one and reports the residue it was
    // written to explain — which is what says the zero beside it is a fact
    // about the decision moment rather than a comparison of identical runs.
    //
    // RE-TAKEN, because the line this pinned no longer exists: the day loop
    // reads `spendsOn` once for the day's first AND last attended check-in now
    // that `EMPIRE_DAY_SPENDING_ANCHORS` has more than one anchor in it. The
    // witness expired exactly as the schema intends, the mutant was re-run
    // against the current source, and this is the new anchor and the new
    // message. The count did not move: the check is taken at the
    // `'last-attended-check-in'` control anchor, which is where it was measured.
    guarantee: 'the-day-granularity-residue-is-the-decision-moment',
    mutatedFile: 'src/empire/engagement.ts',
    mutated:
      '      if (spendsOn.attended[day * policy.checkInsPerDay + tick] !== true) continue;',
    testFile: 'src/empire/engagement.test.ts',
    redAssertion: 'expect(heldAnchorViolating).toBe(0);',
    measuredOver: 'expect(movesMoment).toBe(8064);',
    observed:
      'holds the decision moment and the other arm goes to zero too\n' +
      'AssertionError: expected 6459 to be +0 // Object.is equality',
  },
  // -------------------------------------------------------------------------
  // GDD §5 — the day anchor, which is the half of "spends once a calendar day"
  // that was never written down and was carrying the whole residue.
  //
  // TWO MUTANTS FOR TWO CLAIMS, because "which check-in" and "how many times"
  // are different sentences and a mutant on one witnesses nothing about the
  // other. The second is the one that shows the pair are not the same claim:
  // opening every purse at every check-in leaves the anchor table at 0 —
  // measured, the day policy then behaves like the per-check-in one — and only
  // the census check reddens.
  {
    guarantee: 'the-day-shops-purse-by-purse',
    mutatedFile: 'src/empire/empireInvariant.ts',
    mutated:
      '  return Object.freeze(EMPIRE_BOOKS.filter((book) => !spentToday.includes(book)));',
    testFile: 'src/empire/engagement.test.ts',
    redAssertion:
      'expect(tally.violatingPairs, anchor).toBe(MEASURED_ANCHOR.WINDOWED[anchor].violatingPairs);',
    measuredOver: 'expect(tally.pairs, anchor).toBe(24576);',
    observed:
      'pins every day anchor on the shipped wiring, and only one of the four is zero\n' +
      'AssertionError: first-affordable-check-in-per-purse: expected 31 to be +0' +
      ' // Object.is equality',
  },
  {
    guarantee: 'a-purse-shops-once-a-calendar-day',
    mutatedFile: 'src/empire/engagement.ts',
    mutated: '            booksUnspentToday(spentBooksToday),',
    testFile: 'src/empire/engagement.test.ts',
    redAssertion: "expect(engagementRunFaults(run).join(' | '), spending).toBe('');",
    observed:
      'reports what each policy actually bought, so no tally is a zero about nothing\n' +
      "AssertionError: spend-once-per-calendar-day: expected 'a purse bought twice in one calendar …'" +
      " to be '' // Object.is equality\n" +
      '+ a purse bought twice in one calendar day 4 times',
  },
  {
    // GDD §5 — the first `src/empire/**` entry in this table, which until now
    // held 23 declared guarantees and no witnesses at all.
    //
    // The claim is not about the empire's arithmetic: it is about §4a's
    // BLIND-SPOT MAP, the paragraph that tells a reader which mutants
    // `empireInvariant.test.ts` kills and which die one layer down. That map is
    // stated over a denominator — "leaves this file's N checks green" — and the
    // denominator is the one number in §4a that no assertion pinned. It read 43
    // while the file declared 48, for the waves in which five checks were added
    // and the mutant was not re-run. The mutant below is that drift replayed.
    guarantee: 'section-4a-denominator-is-measured',
    mutatedFile: 'src/empire/empireInvariant.ts',
    mutated: "leaves this file's 50 checks green",
    testFile: 'src/empire/empireInvariant.test.ts',
    redAssertion: 'expect(declared).toBe(declarations.length);',
    measuredOver: 'expect(declared).toBe(50);',
    observed:
      "§4a's denominator is this file's own check count" +
      ' [section-4a-denominator-is-measured]\n' +
      'AssertionError: expected 43 to be 50 // Object.is equality',
  },
  // -------------------------------------------------------------------------
  // GDD §5 — §4a's KILL LIST, which was eight prose summaries with element
  // counts and is now eleven rows here.
  //
  // WHY ELEVEN ROWS FOR EIGHT MUTANTS. §4a's list is stated over two checks —
  // the Training IQ series and the physio series — and three of the eight redden
  // both. A row binds ONE assertion in ONE test body, so a mutant that moves
  // both series is recorded from each side, the way the numeric tag above is
  // witnessed from both halves of its set equality. The two arms are not the
  // same claim: `settledAxisLevel` reading `idleCompletion` moves the physio
  // series and leaves the Training IQ one untouched, and `'roster-slot'` off
  // `GATING_OUTPUTS` does the reverse.
  //
  // EVERY ROW BELOW WAS TAKEN BY RUNNING THE MUTANT, not by transcribing §4a.
  // That matters, because the prose counts did not survive it: seven of the
  // eight cited at least one figure the engine no longer produces — 1266 read
  // 282, 2190 read 1272, 1036 / 132 read 732 / nothing, 84 read 188, 1992 / 260
  // read 1020 / 136, and both 204s read 180 — and only `elapsedFor` returning
  // the accelerated clock came back at its published 2592 and 2592, which
  // saturates. The old figures are NOT re-pinned in §4a: they are superseded by
  // the `observed` column here, which is quoted from the run that produced it
  // and expires with its anchors.
  //
  // The reddened assertion is the same line in both bodies — the element-wise
  // `moved` counter each check is stated on — so the rows differ in `mutated`
  // and in `observed` rather than in `redAssertion`. That is what a list of
  // mutants against one check looks like; the body scoping is what keeps the
  // two tags apart.
  // -------------------------------------------------------------------------
  {
    // (1) CHAIN B, the mutation that survived the version of `empireInvariant.ts`
    // that read its ledger off a second gym. A gate asked about the thing it is
    // paid into rather than the thing it opens.
    guarantee: 'no-accelerant-moves-a-training-iq-element',
    mutatedFile: 'src/empire/empireCore.ts',
    mutated: '  return elapsedFor(clock, gateTarget(output));',
    testFile: 'src/empire/empireInvariant.test.ts',
    redAssertion: 'expect(totals.moved).toBe(0);',
    measuredOver: 'expect(totals.elements).toBe(2616);',
    observed:
      'compares the TRAINING IQ series by wall-clock day, and finds nothing moved\n' +
      'AssertionError: expected 282 to be +0 // Object.is equality',
  },
  {
    // (2) The clock split itself, removed. The only mutant of the eight whose
    // published figures still reproduce, and the reason is that it saturates:
    // 2592 of 2616 elements on each series is very nearly every element there
    // is, so no repair to the grid moves it.
    guarantee: 'no-accelerant-moves-a-training-iq-element',
    mutatedFile: 'src/empire/empireCore.ts',
    mutated:
      '  const seconds =\n' +
      "    outputReach(output) === 'progression-reaching' ? clock.unaccelerated : clock.accelerated;",
    testFile: 'src/empire/empireInvariant.test.ts',
    redAssertion: 'expect(totals.moved).toBe(0);',
    measuredOver: 'expect(totals.elements).toBe(2616);',
    observed:
      'compares the TRAINING IQ series by wall-clock day, and finds nothing moved\n' +
      'AssertionError: expected 2592 to be +0 // Object.is equality',
  },
  {
    // (2b) ...and the same run's physio arm, which is a different assertion in a
    // different body and would not have been shown by the row above.
    guarantee: 'no-accelerant-moves-a-physio-element',
    mutatedFile: 'src/empire/empireCore.ts',
    mutated:
      '  const seconds =\n' +
      "    outputReach(output) === 'progression-reaching' ? clock.unaccelerated : clock.accelerated;",
    testFile: 'src/empire/empireInvariant.test.ts',
    redAssertion: 'expect(totals.moved).toBe(0);',
    measuredOver: 'expect(totals.elements).toBe(2616);',
    observed:
      'compares the PHYSIO series by wall-clock day, and finds nothing moved\n' +
      'AssertionError: expected 2592 to be +0 // Object.is equality',
  },
  {
    // (3) The origin the Training IQ trickle measures tenure from, stamped off
    // the clock a purchase moves.
    guarantee: 'no-accelerant-moves-a-training-iq-element',
    mutatedFile: 'src/empire/recruitment.ts',
    mutated: '  const settlesAt: number = clock.unaccelerated + duration;',
    testFile: 'src/empire/empireInvariant.test.ts',
    redAssertion: 'expect(totals.moved).toBe(0);',
    measuredOver: 'expect(totals.elements).toBe(2616);',
    observed:
      'compares the TRAINING IQ series by wall-clock day, and finds nothing moved\n' +
      'AssertionError: expected 1272 to be +0 // Object.is equality',
  },
  {
    // (4) A recruit gated AND debited on the accelerated book. TWO EDITS, and
    // the anchor is the debit half; the gate half is
    //
    //   if (state.settledBooks[RECRUIT_BOOK] < quote.costGymBucks) {
    //
    // in `recruitmentRefusals`, rewritten to read `state.gymBucks`. Recorded as
    // one mutant rather than two because NEITHER HALF ALONE REACHES AN
    // ASSERTION: with the gate on one purse and the debit on the other the run
    // throws `RangeError: gymBucks must be a finite number at or above zero,
    // received -40` inside `beginRecruitment`, and the whole file collects zero
    // tests. That is a kill by `empireCore.ts`'s constructors rather than by a
    // check here, which is worth knowing about the pair and is why the witness
    // is on the coherent version.
    //
    // Its physio arm is NOT recorded, for the same reason row (8)'s is not: the
    // physio check stays green under it, where §4a's prose said it moved 132
    // elements. Two bullets lost their physio half and both say so here rather
    // than one of them saying so and the other reading as an omission.
    guarantee: 'no-accelerant-moves-a-training-iq-element',
    mutatedFile: 'src/empire/recruitment.ts',
    mutated:
      '  const remaining: number = state.settledBooks[RECRUIT_BOOK] - recruitmentQuote(tier).costGymBucks;',
    testFile: 'src/empire/empireInvariant.test.ts',
    redAssertion: 'expect(totals.moved).toBe(0);',
    measuredOver: 'expect(totals.elements).toBe(2616);',
    observed:
      'compares the TRAINING IQ series by wall-clock day, and finds nothing moved\n' +
      'AssertionError: expected 732 to be +0 // Object.is equality',
  },
  {
    // (5) Every axis bought and read on the accelerated book — one line, because
    // `axisBook` is where the purse and the clock are chosen together.
    guarantee: 'no-accelerant-moves-a-training-iq-element',
    mutatedFile: 'src/empire/expansion.ts',
    mutated: '  return wallClockBookFor(axisOutput(axis)) ?? ACCELERATED_BOOK;',
    testFile: 'src/empire/empireInvariant.test.ts',
    redAssertion: 'expect(totals.moved).toBe(0);',
    measuredOver: 'expect(totals.elements).toBe(2616);',
    observed:
      'compares the TRAINING IQ series by wall-clock day, and finds nothing moved\n' +
      'AssertionError: expected 180 to be +0 // Object.is equality',
  },
  {
    // (5b) The physio arm of the same run.
    guarantee: 'no-accelerant-moves-a-physio-element',
    mutatedFile: 'src/empire/expansion.ts',
    mutated: '  return wallClockBookFor(axisOutput(axis)) ?? ACCELERATED_BOOK;',
    testFile: 'src/empire/empireInvariant.test.ts',
    redAssertion: 'expect(totals.moved).toBe(0);',
    measuredOver: 'expect(totals.elements).toBe(2616);',
    observed:
      'compares the PHYSIO series by wall-clock day, and finds nothing moved\n' +
      'AssertionError: expected 68 to be +0 // Object.is equality',
  },
  {
    // (6) GDD §5.4's cross-mode hook read off the clock a skip moves. The one
    // mutant of the eight that reddens the physio check and leaves the Training
    // IQ check green, which is why that check is its own test and its own tag.
    guarantee: 'no-accelerant-moves-a-physio-element',
    mutatedFile: 'src/empire/expansion.ts',
    mutated: '    if (build.axis === axis) completions.push(build.settledCompletion);',
    testFile: 'src/empire/empireInvariant.test.ts',
    redAssertion: 'expect(totals.moved).toBe(0);',
    measuredOver: 'expect(totals.elements).toBe(2616);',
    observed:
      'compares the PHYSIO series by wall-clock day, and finds nothing moved\n' +
      'AssertionError: expected 188 to be +0 // Object.is equality',
  },
  {
    // (7) The wall-clock purse banked over the idle gap, so a skip pays it.
    guarantee: 'no-accelerant-moves-a-training-iq-element',
    mutatedFile: 'src/empire/production.ts',
    mutated: '  const settledSecondsBanked = bankableOfflineSeconds(wallGap, policy);',
    testFile: 'src/empire/empireInvariant.test.ts',
    redAssertion: 'expect(totals.moved).toBe(0);',
    measuredOver: 'expect(totals.elements).toBe(2616);',
    observed:
      'compares the TRAINING IQ series by wall-clock day, and finds nothing moved\n' +
      'AssertionError: expected 1020 to be +0 // Object.is equality',
  },
  {
    // (7b) The physio arm of the same run.
    guarantee: 'no-accelerant-moves-a-physio-element',
    mutatedFile: 'src/empire/production.ts',
    mutated: '  const settledSecondsBanked = bankableOfflineSeconds(wallGap, policy);',
    testFile: 'src/empire/empireInvariant.test.ts',
    redAssertion: 'expect(totals.moved).toBe(0);',
    measuredOver: 'expect(totals.elements).toBe(2616);',
    observed:
      'compares the PHYSIO series by wall-clock day, and finds nothing moved\n' +
      'AssertionError: expected 136 to be +0 // Object.is equality',
  },
  {
    // (8) The second `GATE_TARGET` row deleted, so a slot is read on the clock
    // it is paid into again. Its physio arm is NOT recorded, and that is a
    // measurement rather than an omission: the physio check stays green under
    // this mutant, where §4a's prose said it moved 132 elements.
    guarantee: 'no-accelerant-moves-a-training-iq-element',
    mutatedFile: 'src/empire/empireCore.ts',
    mutated:
      'export const GATING_OUTPUTS = [\n' +
      "  'reputation',\n" +
      "  'roster-slot',\n" +
      '] as const satisfies readonly EmpireOutput[];',
    testFile: 'src/empire/empireInvariant.test.ts',
    redAssertion: 'expect(totals.moved).toBe(0);',
    measuredOver: 'expect(totals.elements).toBe(2616);',
    observed:
      'compares the TRAINING IQ series by wall-clock day, and finds nothing moved\n' +
      'AssertionError: expected 180 to be +0 // Object.is equality',
  },
  // -------------------------------------------------------------------------
  // GDD §6.5 — "PR" means one thing. FOUR MUTANTS FOR ONE TAG, deliberately.
  //
  // The claim spans two modules and a rendering decision, so a single mutant
  // would witness only one third of it. Each of the four below removes a
  // different limb, and each was run against `src/game/meetDay.test.ts` alone,
  // restored, and confirmed green afterwards. Their failure messages are kept
  // verbatim because they differ from each other — three PRs, three nothings,
  // and a FIRST where a record was beaten — which is the evidence that they are
  // reaching different parts of the same sentence rather than one shared guard.
  // -------------------------------------------------------------------------
  {
    // (1) THE SINGLE-STATE CALL-OUT, RESTORED — the shipped defect exactly.
    // Every lift the server calls a best gets the word "PR", so a first meet
    // prints it three times over a §6.3 screen that flagged nothing.
    guarantee: 'the-pr-word-needs-a-record-to-beat',
    mutatedFile: 'src/game/meetDay.ts',
    mutated:
      "  if (bestKg !== null && beatsPreviousBest(bestKg, previousBestKg)) {\n" +
      "    return { kind: 'pr', text: MEET_COPY.RECAP_PR_LIFT };\n" +
      '  }\n' +
      "  return { kind: 'first', text: MEET_COPY.RECAP_FIRST_LIFT };",
    testFile: 'src/game/meetDay.test.ts',
    redAssertion:
      "expect(firstWords, 'the three words a first meet prints beside its lifts').toEqual([",
    observed:
      "AssertionError: the three words a first meet prints beside its lifts: expected [ 'PR', 'PR', 'PR' ]" +
      " to deeply equal [ 'FIRST', 'FIRST', 'FIRST' ]",
    transcriptPredatesTheRule: true,
  },
  {
    // (2) `liftPrs` REFUSES A NULL PREVIOUS BEST — the other candidate fix,
    // executed rather than argued about. It makes the two readings agree by
    // deleting one of them, and a lifter's first competition squat stops being
    // the best competition squat they hold. The recap then says nothing at all
    // beside three lifts that were all records, which is why this arm is a
    // separate witness: it reddens the SAME assertion from the opposite side.
    guarantee: 'the-pr-word-needs-a-record-to-beat',
    mutatedFile: 'src/game/meetServer.ts',
    mutated: '    liftPrs[lift] = made !== null && (held === null || made > held);',
    testFile: 'src/game/meetDay.test.ts',
    redAssertion:
      "expect(firstWords, 'the three words a first meet prints beside its lifts').toEqual([",
    observed:
      'AssertionError: the three words a first meet prints beside its lifts: expected [ null, null, null ]' +
      " to deeply equal [ 'FIRST', 'FIRST', 'FIRST' ]",
    transcriptPredatesTheRule: true,
  },
  {
    // (3) THE PREDICATE ITSELF, INVERTED ON THE NULL. `beatsPreviousBest` is
    // what §6.3's gold border, its PR sentence, the walk-out's extra hold and
    // the recap's call-out all read; counting a null as beaten is the shape of
    // the disagreement this piece removed. It reddens the recap's words AND the
    // predicate's own sweep, which is the link being witnessed.
    guarantee: 'the-pr-word-needs-a-record-to-beat',
    mutatedFile: 'src/game/meetDay.ts',
    mutated: '  return previousBestKg !== null && weightKg > previousBestKg;',
    testFile: 'src/game/meetDay.test.ts',
    redAssertion:
      "expect(firstWords, 'the three words a first meet prints beside its lifts').toEqual([",
    observed:
      "AssertionError: the three words a first meet prints beside its lifts: expected [ 'PR', 'PR', 'PR' ]" +
      " to deeply equal [ 'FIRST', 'FIRST', 'FIRST' ] (and, in the same run, 'AssertionError: 0 vs null:" +
      " expected true to be false' on the predicate's own sweep)",
      transcriptPredatesTheRule: true,
  },
  {
    // (4) THE RECAP IGNORES THE HISTORY IT IS HANDED, comparing this meet's
    // best against itself. Nothing ever beats anything, so every record a
    // lifter DOES beat is announced as their first. This is the arm the other
    // three miss: they all move the first-meet case, and this one is only
    // visible on a lifter who walked in holding numbers.
    guarantee: 'the-pr-word-needs-a-record-to-beat',
    mutatedFile: 'src/game/meetDay.ts',
    mutated:
      '      callOut: liftCallOutFor(isPr, confirmed.bestByLiftKg[lift], confirmed.previousBestByLiftKg[lift]),',
    testFile: 'src/game/meetDay.test.ts',
    redAssertion:
      'expect(secondWords, `made ${JSON.stringify(made)} against held ${JSON.stringify(held)}`).toEqual([',
    observed:
      'AssertionError: made {"squat":217.5,"bench":140,"deadlift":255} against held' +
      ' {"squat":212.5,"bench":140,"deadlift":260}: expected [ \'FIRST\', null, null ] to deeply equal' +
      " [ 'PR', null, null ]",
    transcriptPredatesTheRule: true,
  },
  {
    // The mutant handed every option GDD §6.3's PR sentence, which is the
    // defect the tag is about seen from the engine side rather than the copy
    // side: the gold border still reads `isPrAttempt`, so the two renderings of
    // one flag come apart. It reddened on the FIRST card of the played arm's
    // first meet — `small @212.5`, a card no version of the app has ever
    // flagged — and took the first-meet count from 0 to 12.
    guarantee: 'pr-sentence-and-pr-border-are-one-decision',
    mutatedFile: 'src/game/meetDay.ts',
    mutated: '    prNote: isPrAttempt ? MEET_COPY.OPTION_PR_NOTE : null,',
    testFile: 'src/meet/AttemptSelectView.test.ts',
    redAssertion: '`${JSON.stringify(MEET_COPY.OPTION_PR_NOTE)}=${says} with isPrAttempt=${option.isPrAttempt}`,',
    observed:
      'AssertionError: first meet, safest cards (the played arm): squat #2 small @212.5 says "A PR on the line."=true with isPrAttempt=false: expected true to be false',
    transcriptPredatesTheRule: true,
  },
  {
    // THE ALIASED-IMPORT HOLE, EXECUTED BEFORE IT WAS CLOSED. The covered-day
    // scan matched declaration BODIES textually; an import sits above the first
    // declaration and is in no body, so aliasing both ends hid a granter
    // outright. Appended to `appServer.ts` beside the anchored import line:
    //
    //     import {
    //       creditCoveredDays as credit,
    //       COVERAGE_SOURCES as SOURCES,
    //       RECOVERY_ENTITLEMENT,
    //       type EntitlementState,
    //     } from '../game/streakEntitlement';
    //
    //     export function widenForTenSessions(
    //       state: EntitlementState, w: number, sessions: number,
    //     ): EntitlementState {
    //       return credit(RECOVERY_ENTITLEMENT, state, w, sessions, SOURCES[0]).state;
    //     }
    //
    // That grants a covered day PER SESSION — CLAUDE.md's 1156-violating-pair
    // shape. Before the symbol pass it ran 105 GREEN TESTS across
    // `streakEntitlement.test.ts`, `tuning/audit.test.ts` and this file, with
    // `tsc --noEmit` at exit 0.
    //
    // BOTH ENDS HAVE TO BE ALIASED, and that correction is the reason this
    // entry exists rather than a narrower one. The version that keeps the
    // literal `'window-entitlement'` in the body IS caught by the shipped
    // predicate's third alternative — planting it reddened three tests — and so
    // is a local `const SRC = 'window-entitlement'`, because that const is a
    // declaration carrying the literal in its own body. The source has to be
    // imported.
    guarantee: 'the-covered-day-scan-follows-aliases',
    mutatedFile: 'src/shell/appServer.ts',
    mutated: "import type { SessionServerPort } from '../game/sessionClient';",
    testFile: 'src/game/streakEntitlement.test.ts',
    redAssertion:
      "      'a declaration reaches the covered-day machinery through an identifier the textual scan cannot see, and is not on COVERED_DAY_TOUCHING_FUNCTIONS',\n    ).toEqual([]);",
    observed:
      'AssertionError: a declaration reaches the covered-day machinery through an identifier the textual scan cannot see, and is not on COVERED_DAY_TOUCHING_FUNCTIONS: expected [ Array(1) ] to deeply equal [] — received [ "shell/appServer.ts::widenForTenSessions" ]',
    transcriptPredatesTheRule: true,
  },
  {
    // The mutant unwrapped the seal at the ONE producer of a wire, which is the
    // state the tree was in when a pound e1RM was written into `response.wire`
    // on the app's close-out route with `tsc --noEmit` clean and the suite at
    // exactly 63 files / 2654 tests.
    //
    // WORTH RECORDING BESIDE IT, because it is the failure this fix was warned
    // about: a mutant that sealed a SHALLOW SPREAD of the wire and returned the
    // original left THIS test green — a spread shares its nested objects, so
    // `bestE1rmKg` was still frozen and the write still threw. It was caught one
    // assertion over, by `seals every level of the wire, not only its shell`, on
    // `Object.isFrozen(wire)`. A deep copy sealed and discarded reddens this one.
    guarantee: 'a-wire-in-flight-refuses-a-write',
    mutatedFile: 'src/game/sessionServer.ts',
    mutated: '  return sealServerValue({\n    revision: record.revision,',
    testFile: 'src/game/sessionServer.test.ts',
    redAssertion:
      '      bests.deadlift = (trueKg ?? 0) / KILOGRAMS_PER_POUND;\n    }).toThrow(TypeError);',
    observed:
      'AssertionError: expected function to throw an error, but it didn’t — src/game/sessionServer.test.ts:1321',
    transcriptPredatesTheRule: true,
  },
  {
    // The mutant unwrapped the seal at one of the six `record` rows, in the file
    // furthest from where the fix was written. The check is the §7.5 route scan
    // asking its own derived set a third question, so the red names the site
    // rather than a count somebody has to go and look up.
    guarantee: 'every-shipped-route-is-sealed',
    mutatedFile: 'src/game/meetPreview.ts',
    mutated:
      '  return sealServerValue({\n    ...newServerRecord(SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY),',
    testFile: 'src/game/progression.test.ts',
    redAssertion:
      "      'a record or wire is built in shipped code and not sealed — pass it to sealServerValue',",
    observed:
      'AssertionError: a record or wire is built in shipped code and not sealed — pass it to sealServerValue: expected [ Array(1) ] to deeply equal [] — received [ "record src/game/meetPreview.ts previewServerRecord" ]',
    transcriptPredatesTheRule: true,
  },
  {
    // A SECOND WITNESS FOR THE SAME TAG, AND THE ONE THAT MATTERS. The entry
    // above mutates by DELETING the seal wrapper, which is name-ABSENCE — the
    // check it reddens is the one that was already known to work. SUBSTITUTION
    // was never mutated and, on the tree before this run, could not have
    // reddened anything: `isSealedAt` matched the callee by identifier TEXT, so
    // an aliased real import plus a local no-op shim spelled the same name left
    // `tsc --noEmit` at exit 0 and progression.test.ts + sessionServer.test.ts
    // + guaranteeTags.test.ts green at 202 tests. The mutant below is that,
    // verbatim, re-run after the callee was resolved through the checker.
    //
    // The whole mutant is two lines, of which the anchor is the first:
    //
    //   import { sealServerValue as realSealServerValue } from './progression';
    //   const sealServerValue = <T,>(value: T): T => { void realSealServerValue; return value; };
    //
    // WORTH RECORDING BESIDE IT: `scan.sealCalleeSources` also reddens on this
    // mutant, and it does so even with `isSealedAt`'s declaring-file filter
    // deleted as well — measured, `expected [ 'src/game/meetPreview.ts', …(1) ]
    // to deeply equal [ 'src/game/progression.ts' ]`. Two oracles that do not
    // share a blind spot, which is the thing CLAUDE.md's seventh instance says
    // to check for rather than counting harnesses.
    guarantee: 'every-shipped-route-is-sealed',
    mutatedFile: 'src/game/meetPreview.ts',
    mutated: "import { sealServerValue } from './progression';",
    testFile: 'src/game/progression.test.ts',
    redAssertion:
      "      'a record or wire is built in shipped code and not sealed — pass it to sealServerValue',",
    observed:
      'AssertionError: a record or wire is built in shipped code and not sealed — pass it to ' +
      'sealServerValue: expected [ Array(1) ] to deeply equal [] — received [ "record ' +
      'src/game/meetPreview.ts previewServerRecord" ]',
    transcriptPredatesTheRule: true,
  },
  {
    // The mutant SKIPPED one of the seven runtime freeze checks the ledger
    // names. That is the shape the gap actually had — four of the seven routes
    // had no runtime evidence at all and nothing said so — rather than a
    // deletion, which a reader would notice. It also exercises the ledger's own
    // claim that `it.skip('…')` fails the check rather than satisfying it.
    guarantee: 'every-shipped-route-observes-its-seal',
    mutatedFile: 'src/game/meetServer.test.ts',
    mutated: "  it('freezes the debug preview record too, one meet deep', () => {",
    testFile: 'src/game/progression.test.ts',
    redAssertion:
      '        `${witness.route}: ${witness.testFile} does not declare exactly one running test called "${witness.title}"`,',
    observed:
      'AssertionError: record src/game/meetPreview.ts previewServerRecord: ' +
      'src/game/meetServer.test.ts does not declare exactly one running test called ' +
      '"freezes the debug preview record too, one meet deep": expected +0 to be 1',
    transcriptPredatesTheRule: true,
  },
  {
    // Declared with the tag, on the round that corrected the sentence it
    // guards. `VERDICT_SILENCE_MS` had said the beat was "dead air between the
    // bar being racked and anything appearing"; the pixels have always drawn a
    // man standing under a fully loaded bar. The mutant hands the hall the BAR's
    // own weight instead of the attempt's, which is the drawing that sentence
    // described, and the check names it.
    guarantee: 'bar-stays-on-his-back-for-the-call',
    mutatedFile: 'src/meet/VerdictView.tsx',
    mutated: 'lifter={{ totalKg: attempt.weightKg, barAndCollarsKg, loadRatio, pose }}',
    testFile: 'src/meet/meetStage.test.ts',
    redAssertion: "'the bar the wait is drawn with is not the attempt\u2019s bar',",
    observed:
      'AssertionError: the bar the wait is drawn with is not the attempt\u2019s bar: expected \'<MeetHallView\\n        lifter={{ tota…\' to contain \'totalKg: attempt.weightKg\'',
    transcriptPredatesTheRule: true,
  },
  {
    // RETAKEN. The previous witness anchored on
    // `revalidated.runRecordedAsEndedOn === null ? rendered : ...`, which is
    // gone: `rendered` was a re-derivation of the client's verdict and the
    // client now reports it. The witness expired exactly as designed, and this
    // is the same mutation against the line that replaced it.
    guarantee: 'completion-revalidates-against-settled-state',
    mutatedFile: 'src/game/streak.ts',
    mutated: '  const authoritative = saleAuthorisedOn(state, day);',
    testFile: 'src/game/streak.test.ts',
    redAssertion: "expect(never.refusedPurchases, 'the client that never opens').toBe(4)",
    observed: 'AssertionError: the client that never opens: expected 3 to be 4',
    transcriptPredatesTheRule: true,
  },
  {
    // The mutant let a client that claimed its screen had shown the offer buy
    // into a doomed absence — the field moving the DECISION rather than the
    // sentence, which is the §12.3 line it must never cross.
    guarantee: 'the-decision-ignores-the-rendered-offer',
    mutatedFile: 'src/game/streak.ts',
    // Two lines, because the one that was mutated — `if (!authoritative) {` —
    // is under `MIN_ANCHOR_LENGTH` on its own, which is the anchor rule doing
    // its job rather than an exception to it.
    mutated: '  const authoritative = saleAuthorisedOn(state, day);\n  if (!authoritative) {',
    testFile: 'src/game/streak.test.ts',
    redAssertion: 'the rendered offer moved the decision',
    observed: 'Error: offset 0 armed mask 0 day +0: the rendered offer moved the decision',
    transcriptPredatesTheRule: true,
  },
  {
    // The mutant swapped the two ordering branches, so a client whose screen was
    // right was told its screen was wrong and vice versa. It reddened on the
    // de-mirrored oracle at a probe with a render-day LAG OF 2 — a probe the
    // sweep could not produce before this round, which is the axis earning its
    // keep rather than being asserted to.
    guarantee: 'every-refusal-sentence-is-true-of-its-screen',
    mutatedFile: 'src/game/streak.ts',
    mutated: "      ? fail('ABSENCE_ENDED_AFTER_OFFER', DOOMED_SALE_REFUSAL_MESSAGE.endedAfterOffer)",
    testFile: 'src/game/streak.test.ts',
    redAssertion: 'refused as ${code}, expected ${expectedCode} (lag ${lag})',
    observed:
      'Error: offset 0 armed mask 5 day +0: refused as ABSENCE_ENDED_BEFORE_OFFER, expected ABSENCE_ENDED_AFTER_OFFER (lag 2)',
    transcriptPredatesTheRule: true,
  },
  {
    // The mutant asked the authorisation question at the COMPLETION day where
    // the code asks it at the day the client says its screen was drawn for —
    // which is the whole content of the claim, and is the exact defect the 03:00
    // rollover produced in the shipped code.
    guarantee: 'the-copy-reads-the-clients-screen',
    mutatedFile: 'src/game/streak.ts',
    mutated: 'const authorisedWhenTheScreenWasDrawn = saleAuthorisedOn(state, renderedOffer.day);',
    testFile: 'src/game/streak.test.ts',
    redAssertion: "expect(errorCodeOf(lateSale)).toBe('ABSENCE_ENDED_AFTER_OFFER')",
    observed:
      "AssertionError: expected 'ABSENCE_ENDED_BEFORE_OFFER' to be 'ABSENCE_ENDED_AFTER_OFFER'",
    transcriptPredatesTheRule: true,
  },
  {
    // THE MUTANT IS THE SHIPPED DEFECT, PUT BACK. `streakIfTrainedToday` was two
    // ternary chains — one in `sessionServer.ts`, one in `sessionClient.ts` —
    // and the client's named one fewer kind, so `'gap-covered-by-recovery-days'`
    // fell through it to 1. This mutant makes the one function return
    // `FIRST_DAY_OF_A_NEW_RUN` for that kind, which is character-for-character
    // what the client used to do, and the sweep names the kind and the day.
    //
    // The same mutant also reddens both covered-gap tests in
    // `sessionClient.test.ts` with `expected 1 to be 11` — the number a lifter
    // on a ten-day run was actually shown under DAY STREAK.
    guarantee: 'one-streak-mapping',
    mutatedFile: 'src/game/streak.ts',
    mutated: "    case 'gap-covered-by-recovery-days':\n      return opening.streakIfTrainedToday;",
    testFile: 'src/game/streak.test.ts',
    redAssertion: 'expect(streakIfTrainedToday(opening), `${opening.kind} on day ${i}`).toBe(',
    observed:
      'AssertionError: gap-covered-by-recovery-days on day 4: expected 1 to be 2 // Object.is equality',
    transcriptPredatesTheRule: true,
  },
  {
    // The mutant turned the placeholder's one type-only import into a VALUE
    // import — the exact move by which a "temporary" scaffold acquires a clock,
    // a row or a meet history, and the thing the bound exists to make loud.
    // Taken with three others on the same run: adding an export (`nextMeetDay`)
    // reddens the export-surface equality, giving the placeholder a prop reddens
    // the empty-parameter-list check, and broadening the gate to any refusal
    // reddens the per-error-code loop in the sibling test.
    //
    // REPLACEMENT TAKEN BY RE-RUNNING IT, and this is the row where the
    // transcript had already given it away: `observed` quotes the mutated import
    // line in full, so recording the field cost a copy from one part of the row
    // into another. Re-applied at this tree it reproduces that message verbatim.
    // The other three mutants named above are NOT recorded — they were run
    // together and only this one has a row here, so only this one has a patch.
    guarantee: 'placeholder-cannot-grow-calendar-authority',
    mutatedFile: 'src/meet/careerCalendarPlaceholder.ts',
    mutated: "import type { MeetDayPhaseId } from '../game/meetDay';",
    mutatedTo: "import { type MeetDayPhaseId, meetIdFor } from '../game/meetDay';",
    testFile: 'src/meet/careerCalendarPlaceholder.test.ts',
    redAssertion: 'imports a value, which is how a placeholder acquires a clock, a row or a meet history',
    observed:
      'AssertionError: careerCalendarPlaceholder.ts may only "import type" — "import { type ' +
      "MeetDayPhaseId, meetIdFor } from '../game/meetDay'\" imports a value, which is how a " +
      'placeholder acquires a clock, a row or a meet history: expected false to be true',
    transcriptPredatesTheRule: true,
  },
  {
    guarantee: 'settling-is-terminal',
    mutatedFile: 'src/game/streak.ts',
    mutated: "return fail('NOTHING_TO_SETTLE', 'There is no streak running, so there is nothing to settle.');",
    testFile: 'src/game/streak.test.ts',
    redAssertion: "expect(secondSettles, 'a settled run was settled again').toBe(0)",
    observed: 'AssertionError: a settled run was settled again: expected 500544 to be +0',
    transcriptPredatesTheRule: true,
  },
  {
    guarantee: 'a-sale-never-follows-a-settle',
    mutatedFile: 'src/game/streak.ts',
    mutated: '    lastTrainedDay: null,\n  };\n}',
    testFile: 'src/game/streak.test.ts',
    redAssertion: 'sold on a day whose run had already ended',
    observed: 'Error: offset 16 armed mask 512 day +5: sold on a day whose run had already ended',
    transcriptPredatesTheRule: true,
  },
  // -------------------------------------------------------------------------
  // ONE LIFTER. The three below were taken on the run that wired meet day to
  // the app's row, by hand, in the order they appear: break it, watch it fail,
  // read the message, restore, confirm green.
  //
  // NOTE ON THE FIRST ONE'S MESSAGE. The mutation is what showed that the bare
  // `expect(a).toBe(b)` form printed `expected { …(5) } to be { …(5) }`, which
  // names nothing a reader could act on. The assertion was rewritten to carry
  // its own sentence and the mutation re-run against the new form; the
  // `observed` below is from the second run. That is the witness bar doing the
  // job it was written for — a check that fails uselessly is halfway to a check
  // nobody reads.
  // -------------------------------------------------------------------------
  {
    // The mutant gave meet day a connection of its own — the defect, in one
    // line, and the shape the app actually shipped for six waves.
    guarantee: 'one-row-behind-one-port',
    mutatedFile: 'src/shell/appServer.ts',
    mutated: 'export function appMeetPort(): MeetServerPort {\n  return appConnection();\n}',
    testFile: 'src/shell/shellWiring.test.ts',
    redAssertion:
      "'meet day and the daily session are holding two different servers, so they are two different lifters',",
    observed:
      'AssertionError: meet day and the daily session are holding two different servers,' +
      ' so they are two different lifters: expected false to be true',
    transcriptPredatesTheRule: true,
  },
  {
    // THE SAME MUTANT, A SECOND TEST, and the pair is the point rather than a
    // duplicate. The witness above records that the mutant reddens the
    // STRUCTURAL claim — two accessors, one object. This one records that it
    // also reddens the BEHAVIOURAL one, which is a separate guarantee: object
    // identity would still hold over a server that kept a second row, and the
    // test that used to carry this claim recorded no meet at all. It read the
    // total once, named it `before`, asserted it was null and stopped — so this
    // exact mutant left it green while the sentence above it said "this is the
    // consequence, measured".
    //
    // The `mutated` anchor is deliberately the same text: it is the one edit
    // that breaks both claims, so both witnesses expire together if that
    // function is rewritten, which is the correct coupling.
    guarantee: 'a-meet-total-reaches-the-session-half',
    mutatedFile: 'src/shell/appServer.ts',
    mutated: 'export function appMeetPort(): MeetServerPort {\n  return appConnection();\n}',
    testFile: 'src/shell/shellWiring.test.ts',
    redAssertion:
      "'the session half cannot see the total the meet endpoint banked, so meet day and the daily loop are two lifters',",
    observed:
      'AssertionError: the session half cannot see the total the meet endpoint banked, so meet' +
      ' day and the daily loop are two lifters: expected null to be 490',
    transcriptPredatesTheRule: true,
  },
  {
    // The mutant stopped the crossing reading the lifter's trained e1RM, so
    // every opener fell back to the signup seed — which is exactly what the
    // browser measured on the tree before the fix (107.5 kg drawn against
    // 110.0 kg implied).
    guarantee: 'the-opener-follows-the-lifter',
    mutatedFile: 'src/game/meetClient.ts',
    mutated: '    bestE1rmKg[lift] = readingValue(readBestE1rmKg(cache, lift));',
    testFile: 'src/game/meetClient.test.ts',
    redAssertion: 'expect(a.value, lift).toBeGreaterThan(b.value);',
    observed: 'AssertionError: squat: expected 160 to be greater than 160',
    transcriptPredatesTheRule: true,
  },
  {
    // The mutant handed `?meet=live` — the debug route to the PLAYED loop — the
    // preview's stand-in lifter. That is the fabricated record reaching a played
    // meet, which is the thing the biconditional exists to make impossible.
    guarantee: 'a-preview-server-cannot-reach-a-played-meet',
    mutatedFile: 'src/shell/shellRoute.ts',
    mutated:
      '    return { state: undefined, card: false, holdWalkoutAtMs: null, serverPort: undefined };',
    testFile: 'src/shell/shellRoute.test.ts',
    redAssertion: '(entry?.state !== undefined) === (entry?.serverPort !== undefined),',
    observed:
      'AssertionError: ?meet=live: state absent, serverPort present: expected false to be true',
    transcriptPredatesTheRule: true,
  },
  {
    // THE MUTANT IS ONE ROW OF GDD §5's FLOOR, HARDCODED TO THE STRING IT
    // DRAWS AT THE INSTANT THE SCREEN OPENS. That is the whole point of it, and
    // it survived the floor learning to move: the row reads `0.000` on arrival
    // either way, so the mutated screen is byte-identical for the first
    // `EMPIRE_FLOOR.CHECK_IN_SECONDS` and a photograph taken then cannot tell
    // them apart.
    //
    // RE-TAKEN, RATHER THAN DELETED, WHEN THE ROW'S EXPRESSION CHANGED. The old
    // anchor was `value={String(state.gymBucks)}` against a floor that called
    // `createEmpireState()` once and never stepped it; the row now reads
    // `readings.gymBucks` off a gym `stepGym` advances. Both fields were
    // re-measured by applying the mutant below and reading the failure, not by
    // editing the strings to match.
    //
    // WHAT THAT MAKES INVISIBLE, measured on this tree rather than reasoned
    // about. `npx tsc --noEmit` exits 0 (`value` is `string` either way). And
    // the assertion everybody reaches for first — read the testID, compare it to
    // the opening reading — PASSES, which is why this row is the witness and not
    // a value pin: on arrival the number is the same and only where it came from
    // differs. The browser tool now reads the rows TWICE, seconds apart, which
    // catches this particular mutant at the second read — and would not catch a
    // mutant that hardcoded a rising local counter, which is the shape the
    // provenance scan exists for.
    //
    // The critic's own wider variant reddens two assertions rather than one: it
    // deleted the import outright, leaving `src/shell/` with no edge into
    // `src/empire/` at all, and the census beside this one goes red as well
    // (`0 of the shell's mounted screens import from src/empire/: none`). The
    // narrower mutant is recorded here because it is the harder catch — it keeps
    // the import, keeps the hook, and breaks one row.
    guarantee: 'every-drawn-empire-reading-comes-from-the-pure-state',
    mutatedFile: 'src/shell/EmpireScreen.tsx',
    mutated:
      '        <Stat label={C.EMPIRE_STAT_BUCKS} value={readings.gymBucks} testID="empire-stat-bucks" />',
    mutatedTo:
      '        <Stat label={C.EMPIRE_STAT_BUCKS} value="0.000" testID="empire-stat-bucks" />',
    testFile: 'src/shell/shellWiring.test.ts',
    redAssertion: "expect(unbound, unbound.join('\\n')).toEqual([]);",
    observed:
      'FAIL  src/shell/shellWiring.test.ts > the numbers on GDD §5’s floor come from GDD §5’s own' +
      ' module > EVERY reading the floor draws traces to the pure constructor, not to chrome copy' +
      ' [every-drawn-empire-reading-comes-from-the-pure-state]\n' +
      'AssertionError: src/shell/EmpireScreen.tsx draws "empire-stat-bucks" from "0.000", which does' +
      ' not trace to createEmpireState() imported from src/empire/ — so that row is a hardcoded' +
      ' mock-up of GDD §5 and every value assertion in the tree would still pass:' +
      ' expected [ Array(1) ] to deeply equal []',
  },
  {
    // THE MUTANT MAKES THE FLOOR A FUNCTION OF WHEN SOMEBODY LOOKED, which is
    // the §12.3 defect the whole module is shaped to avoid, reached by changing
    // one argument. Every check-in still happens and the cadence is untouched;
    // what moves is the READING each one is taken at — the caller's own instant
    // instead of the schedule's — so the collection mark lands wherever the
    // refresh timer happened to fire and `production.ts` quantises the fragment
    // away.
    //
    // IT IS THE NAIVE WIRING, PUT BACK. `empireFloor.test.ts` keeps that wiring
    // runnable as `naiveGymAfter` and measures it at 65 of 192 pairs losing
    // money; this mutant is the same thing done to the shipped path, and it
    // reddens 48 of the 64 swept schedules. `npx tsc --noEmit` is clean on it.
    guarantee: 'the-floor-is-a-function-of-elapsed-time-and-nothing-else',
    mutatedFile: 'src/shell/empireFloor.ts',
    mutated:
      '    gym = stepGym(gym, EMPIRE_FLOOR_POLICY, checkInReadingAt(checkIn), null, 0);',
    mutatedTo: '    gym = stepGym(gym, EMPIRE_FLOOR_POLICY, openSeconds, null, 0);',
    testFile: 'src/shell/empireFloor.test.ts',
    redAssertion: "expect(mismatches, mismatches.join('\\n')).toEqual([]);",
    observed:
      'FAIL  src/shell/empireFloor.test.ts > the floor is a function of elapsed time and of nothing' +
      ' else > any schedule of calls lands on the value one call would have produced' +
      ' [the-floor-is-a-function-of-elapsed-time-and-nothing-else]\n' +
      'AssertionError: schedule 0 ending at 299760ms\nschedule 1 ending at 299447ms\n' +
      'schedule 2 ending at 293949ms\n...\n' +
      'schedule 62 ending at 298401ms: expected [ …(48) ] to deeply equal []',
  },
  {
    // The mutant swapped the `useRef` initialiser's resume for a fresh
    // `openCutInSession`, which is the §12.3 refusal condition reached by a
    // component lifetime: `AppShell` un-mounts this host in ordinary play, so
    // every re-mount inside one sitting would come back with a new slot.
    //
    // WORTH RECORDING BESIDE IT, because it is the finding this round was sent
    // back for. The two pins that used to hold this line — `toMatch(
    // /resumeCutInSession/)` and a BYTE-EXACT `toMatch` including the argument
    // object — were both GREEN on this mutant, measured, because the identical
    // call appears a second time in the effect below at a site the mutant does
    // not touch. Both are now match COUNTS, and the two sites are matched by the
    // code around them so they are distinguishable at all.
    guarantee: 'a-remount-resumes-rather-than-opens',
    mutatedFile: 'src/cutin/CutInHost.tsx',
    mutated:
      '  const session = React.useRef<CutInSessionState>(\n' +
      '    resumeCutInSession({ sessionId: activeSessionId, seed: activeSeed }),\n' +
      '  );',
    testFile: 'src/cutin/cutInWiring.test.ts',
    redAssertion:
      "'the mount does not resume the sitting it is already in — a re-mount inside one sitting would get a fresh slot',",
    observed:
      'AssertionError: the mount does not resume the sitting it is already in — a re-mount' +
      ' inside one sitting would get a fresh slot: expected +0 to be 1',
    transcriptPredatesTheRule: true,
  },
  {
    // The mutant taught the ONE screen that already reports a PR in the daily
    // loop to report the tier kind instead. That is precisely the change the
    // claim says has not happened — and it is the change the check that used to
    // live here could not see, because it iterated `kind:` and any `record`
    // beat satisfied the `record` row whichever sub-kind it carried.
    guarantee: 'tier-pr-is-reached-by-no-screen',
    mutatedFile: 'src/session/CloseOutView.tsx',
    mutated: "useOfferCutIn([{ kind: 'record', record: 'e1rm', achieved: isPr }]);",
    testFile: 'src/cutin/cutInWiring.test.ts',
    redAssertion:
      "if 'tier' has arrived here, a screen has learnt to report tier qualification — delete this ",
    observed:
      "AssertionError: if 'tier' has arrived here, a screen has learnt to report tier " +
      'qualification — delete this test and the paragraphs it points at in cutInGate.ts §5 and ' +
      "RecapView.tsx: expected 'e1rm, tier, total' to be 'e1rm, total'",
    transcriptPredatesTheRule: true,
  },
  {
    // The mutant turned the bar load's merge window off, which is the state the
    // tree was in the round `tools/verify-meet-sound.mjs` measured FIVE 180ms
    // rattles inside 149ms of one walk-out. The tag's claim is arithmetic —
    // hits at least `merge` apart cannot stack more than `duration / merge`
    // deep — so a zero window makes the product zero and the guarantee false.
    //
    // WORTH RECORDING BESIDE IT: the same mutant reddens three other assertions
    // in that file, one of them on the recorded Chromium trace. The one named
    // here is the only one that is the GUARANTEE rather than a consequence of
    // it — a sweep can be widened until it stops finding the case, and this
    // product cannot.
    guarantee: 'no-rattle-is-cut-by-another-rattle',
    mutatedFile: 'src/game/meetTuning.ts',
    mutated: '  BAR_LOAD_RATTLE_MERGE_MS: 60,',
    testFile: 'src/meet/meetSound.test.ts',
    redAssertion:
      'expect(voices * merge, `${voices} voices x ${merge}ms against a ${rattle}ms cue`)\n' +
      '      .toBeGreaterThanOrEqual(rattle);',
    observed:
      'AssertionError: 3 voices x 0ms against a 180ms cue: expected 0 to be greater than or ' +
      'equal to 180 — src/meet/meetSound.test.ts:542',
    transcriptPredatesTheRule: true,
  },
  {
    // THE MUTANT IS A PLANTED VIOLATION RATHER THAN A BROKEN GUARD, because the
    // guarantee is about REACH: the claim is that a declaration awarding a
    // purchased covered day is found wherever under `src` it is written, and the
    // only way to test reach is to write one somewhere the old scan could not
    // look. It was appended to `appServer.ts` — one directory outside
    // `src/game/`, which is where the previous scan's reader was nailed down:
    //
    //   export function awardCoveredDayForTenSessions(
    //     entitlement: EntitlementState,
    //     windowNow: number,
    //     amount: number,
    //   ): EntitlementState {
    //     return creditCoveredDays(RECOVERY_ENTITLEMENT, entitlement, windowNow, amount, 'purchase').state;
    //   }
    //
    // `mutated` anchors the insertion point — the declaration it was appended
    // after — because the mutation adds text rather than replacing any.
    //
    // WHAT MAKES THIS WITNESS WORTH THE TWO COPY-PASTES: the counterfactual was
    // run, not assumed. The scan as it stood — three hardcoded filenames joined
    // against `__dirname` — was executed against the MUTATED tree and returned
    // the same 25 names it returns against a clean one, so it was green on a
    // violation of the rule it exists to enforce. `npx tsc --noEmit` was also
    // clean with the mutant in place, so nothing else in the toolchain would
    // have stopped it either. This is a defect that would have shipped.
    // RE-TAKEN WHEN THE PREDICATE WIDENED TO COVERAGE, not merely re-pointed at
    // the renamed constant. The old `observed` said `…(57)` against `…(56)`; the
    // allowlist is 88 long now, so leaving the message and only fixing the
    // identifier would have produced a witness that RESOLVES and lies — which is
    // the exact defect this table exists to make impossible. The mutation was
    // re-run and the message below is from that run.
    guarantee: 'the-covered-day-scan-reads-the-whole-tree',
    mutatedFile: 'src/shell/appServer.ts',
    mutated: 'export function appMeetPort(): MeetServerPort {\n  return appConnection();\n}',
    testFile: 'src/game/streakEntitlement.test.ts',
    redAssertion:
      'expect(found.names, drift).toEqual([...COVERED_DAY_TOUCHING_FUNCTIONS].sort());',
    observed:
      'AssertionError: declarations naming a covered day that COVERED_DAY_TOUCHING_FUNCTIONS ' +
      'does not list: shell/appServer.ts::awardCoveredDayForTenSessions: expected ' +
      "[ 'ACCELERANT_ARRIVAL', …(88) ] to deeply equal [ 'ACCELERANT_ARRIVAL', …(87) ]",
    transcriptPredatesTheRule: true,
  },
  {
    // THE WITNESS FOR THIS ROUND'S ACTUAL FIX, and the one the other two could
    // not have produced. Both of those grant through the `'purchase'` source, so
    // both were caught by the word `purchas` alone — they say nothing about the
    // FREE side of `COVERAGE_SOURCES`, which is where the hole was.
    //
    // The mutant grants coverage every ten sessions through
    // `'window-entitlement'`, appended to `appServer.ts`:
    //
    //   export function widenWindowForTenSessions(
    //     state: EntitlementState,
    //     windowNow: number,
    //     sessionsDone: number,
    //   ): EntitlementState {
    //     const earned = Math.floor(sessionsDone / 10);
    //     if (earned < 1) return state;
    //     return creditCoveredDays(RECOVERY_ENTITLEMENT, state, windowNow, earned, 'window-entitlement').state;
    //   }
    //
    // THE COUNTERFACTUAL WAS RUN, TWICE, AND IT IS WHY THIS IS EVIDENCE RATHER
    // THAN A CLAIM. Against the tree-wide scan keyed on `/purchas/i` — the scan
    // the PREVIOUS round had just fixed and witnessed — this file ran
    // **43 tests, 43 passed, exit 0**, with `npx tsc --noEmit` clean beside it.
    // A covered day awarded for training, which CLAUDE.md measures at 1156
    // violating pairs, was invisible to the guard that exists to forbid it.
    //
    // `mutated` anchors the insertion point, the same declaration the two
    // witnesses either side of it anchor on, because all three mutations APPEND
    // and there is nothing else to point at. That is a real weakness of the
    // anchor — it expires when `appMeetPort` is edited, not when the mutant's
    // own subject moves — and it is recorded rather than papered over.
    guarantee: 'the-covered-day-scan-reads-the-whole-tree',
    mutatedFile: 'src/shell/appServer.ts',
    mutated: 'export function appMeetPort(): MeetServerPort {\n  return appConnection();\n}',
    testFile: 'src/game/streakEntitlement.test.ts',
    redAssertion:
      'expect(found.names, drift).toEqual([...COVERED_DAY_TOUCHING_FUNCTIONS].sort());',
    observed:
      'AssertionError: declarations naming a covered day that COVERED_DAY_TOUCHING_FUNCTIONS ' +
      'does not list: shell/appServer.ts::widenWindowForTenSessions: expected ' +
      "[ 'ACCELERANT_ARRIVAL', …(88) ] to deeply equal [ 'ACCELERANT_ARRIVAL', …(87) ]",
    transcriptPredatesTheRule: true,
  },
  {
    // A FOURTH WITNESS, AND THE ONLY ONE WHOSE MUTANT IS THE GUARD ITSELF. The
    // three above all add or rename a DECLARATION. This one narrows the
    // PREDICATE back to `/purchas/i` — the single edit that would undo this
    // round — and it is the one a future reader is most likely to make, because
    // 31 of the 88 entries look like noise until you know why they are there.
    //
    // It reddens through the staleness half with all 31 named:
    // `AbsenceOutcome, CoveredDayCreditOutcome, …, tenderGating`. Recorded
    // because a witness for "somebody added a granter" says nothing about
    // "somebody deleted the reason the granter is visible".
    //
    // REPLACEMENT TAKEN BY RE-RUNNING IT, and it is the one row in this table
    // whose mutant edits the file its own red assertion lives in — the second
    // arm of the replacement rule has this row and nothing else as its live
    // domain. The named assertion reddens through the staleness half as
    // recorded; the counts in `observed` do not reproduce, because the
    // allowlist has grown since — twenty stale entries against the thirty-one
    // written below, and 107 declarations against 87. The transcript predates
    // the transcript rule and is excused by it. What the replacement adds is
    // that the drift is one command away from anybody rather than a thing only
    // its author could have found.
    guarantee: 'the-covered-day-scan-reads-the-whole-tree',
    mutatedFile: 'src/game/streakEntitlement.test.ts',
    mutated:
      '  NAMES_A_COVERED_DAY_OR_A_PURCHASE: /purchas|covered.?day|window-entitlement/i,',
    mutatedTo: '  NAMES_A_COVERED_DAY_OR_A_PURCHASE: /purchas/i,',
    testFile: 'src/game/streakEntitlement.test.ts',
    redAssertion:
      'expect(found.names, drift).toEqual([...COVERED_DAY_TOUCHING_FUNCTIONS].sort());',
    observed:
      'AssertionError: allowlist entries no declaration matches any more: AbsenceOutcome, ' +
      'CoveredDayCreditOutcome, CoveredDayTender, DOOMED_SALE_REFUSAL_MESSAGE, DOOMED_SALE_SWEEP, ' +
      'DayOpening, EMPIRE_FORBIDDEN_OUTPUTS, EntitlementTuning, GatingOfTender, ' +
      'LONGEST_REPAIRABLE_ABSENCE_DAYS, MAX_COVERED_DAYS_ONE_ABSENCE_MAY_DRAW, … 31 in all: ' +
      "expected [ 'ACCELERANT_ARRIVAL', …(56) ] to deeply equal [ 'ACCELERANT_ARRIVAL', …(87) ]",
    transcriptPredatesTheRule: true,
  },
  {
    // A SECOND WITNESS FOR THE SAME TAG, IN THE OTHER DIRECTION, because the
    // assertion is a set equality and the staleness half is the half that rots
    // quietly: an allowlist that can only grow is one nobody prunes.
    //
    // The mutant misspells one live entry — `'purchaseArrivalOf'` ->
    // `'purchaseArrivalOfX'` — which trips BOTH directions at once from a single
    // edit, and the message says both: the real declaration becomes unlisted and
    // the invented name becomes stale. Recorded separately from the witness
    // above because a mutant that only ADDS a declaration leaves the staleness
    // branch of that same `toEqual` untested, and CLAUDE.md's point about
    // `MUTATION_WITNESSES` is exactly that one witness proves one assertion
    // bites and says nothing about anything else in the same test.
    //
    // RE-TAKEN ON THE WIDENED PREDICATE, same reason as the first: the counts in
    // the old message were from a 57-entry allowlist.
    guarantee: 'the-covered-day-scan-reads-the-whole-tree',
    mutatedFile: 'src/game/streakEntitlement.ts',
    mutated: "  'coveredDayPurchaseDays',\n  'purchaseArrivalOf',",
    testFile: 'src/game/streakEntitlement.test.ts',
    redAssertion:
      'expect(found.names, drift).toEqual([...COVERED_DAY_TOUCHING_FUNCTIONS].sort());',
    observed:
      'AssertionError: declarations naming a covered day that COVERED_DAY_TOUCHING_FUNCTIONS ' +
      'does not list: game/streakSweep.ts::purchaseArrivalOf | allowlist entries no declaration ' +
      "matches any more: purchaseArrivalOfX: expected [ 'ACCELERANT_ARRIVAL', …(87) ] to deeply " +
      "equal [ 'ACCELERANT_ARRIVAL', …(87) ]",
    transcriptPredatesTheRule: true,
  },
  {
    // THE COUNTERFACTUAL'S OWN WITNESS: the pinned row really is measured off
    // the entitlement module and is not a constant compared with itself.
    //
    // The mutant is an off-by-one in the coverage rule — `<=` to `<` — which is
    // the classic shape for that line and is the edit a reader is most likely
    // to make by accident. It moves every cell of the row at once.
    //
    // A DIFFERENT MUTANT WAS TRIED FIRST AND STAYED GREEN, recorded because a
    // green mutant is evidence about the mutant and not about the test:
    // dropping the `Math.min` from `drawableByThisAbsence` is a NO-OP at the
    // shipped tuning, since `COVERED_DAYS_PER_WINDOW` and
    // `MAX_COVERED_DAYS_PER_ABSENCE` are both 2 and this sweep buys nothing, so
    // the ceiling never binds. It looked like the obvious coverage mutation.
    guarantee: 'dropping-the-doomed-burn-measures-worse',
    mutatedFile: 'src/game/streakEntitlement.ts',
    mutated: '  const covers = chargeableDays <= drawableByThisAbsence;',
    testFile: 'src/game/streakEntitlement.test.ts',
    redAssertion: ').toEqual([...DOOMED_BURN_COUNTERFACTUAL.VIOLATING_PAIRS_BY_LENGTH]);',
    observed:
      'AssertionError: GDD §4.4 doomed-burn control row, currentStreak inversions: ' +
      'expected [ 290, 517, 472, 375 ] to deeply equal [ 561, 1051, 710, 673 ]',
    transcriptPredatesTheRule: true,
  },
  {
    // A SECOND WITNESS FOR THE SAME TAG, ON THE OTHER ASSERTION, because the
    // two halves of that test fail on disjoint edits and neither says anything
    // about the other — CLAUDE.md's point that a witness proves ONE assertion
    // bites, applied deliberately rather than discovered later.
    //
    // The measurement pin above catches an ENGINE change. This one catches the
    // drift that produced the whole piece: somebody re-takes the measurement,
    // edits the shared constant, and leaves the sentences quoting the old
    // figure. The mutant is one digit of the published row.
    //
    // IT IS THE WEAKER OF THE TWO AND IS LABELLED SO. The assertion it
    // witnesses cannot fail without an edit to `streakSweep.ts` — it is a link
    // between a constant and the prose quoting it, not a measurement — and it
    // sits FIRST in the test body so this mutant reddens there rather than
    // being masked by the measurement pin below it.
    guarantee: 'dropping-the-doomed-burn-measures-worse',
    mutatedFile: 'src/game/streakSweep.ts',
    mutated: '  VIOLATING_PAIRS_BY_LENGTH: Object.freeze([561, 1051, 710, 673]),',
    testFile: 'src/game/streakEntitlement.test.ts',
    redAssertion: ').toEqual([561, 1051, 710, 673]);',
    observed:
      'AssertionError: the sentence in streak.ts, streakEntitlement.ts and GDD §4.4 says 1051 at ' +
      '60 and 673 at 100: expected [ 561, 1051, 710, 674 ] to deeply equal [ 561, 1051, 710, 673 ]',
    transcriptPredatesTheRule: true,
  },
  // -------------------------------------------------------------------------
  // The transcript rule witnessing itself, and the mutant had to come from
  // another file for the reason row (1) of this table already gives: `mutated`
  // must resolve exactly once in `mutatedFile`, so quoting an anchor that lives
  // in this file puts a second copy of it here and the row expires on itself.
  //
  // THE RUN THAT MOTIVATED THE RULE IS THEREFORE NOT THE ONE RECORDED. That run
  // pasted the real collection-kill output — `Tests  no tests` and the
  // `RangeError` from `asGymBucks` — into row (3) of the §4a block, in place of
  // its true transcript, which is exactly the mistake an author reading the
  // colour would make. The rule refused it and named the row. It is unanchorable
  // here, so the two edits are held instead as `COLLECTION_KILL_MUTANTS`, whose
  // anchors do live in another file and do expire.
  //
  // The recorded mutant reaches the other half of the same rule: the title is
  // read out of the tree rather than transcribed, so renaming the test the
  // transcripts name expires all four of its rows at once.
  // -------------------------------------------------------------------------
  {
    // THE REPLACEMENT IS ONE OF MANY AND THE ROW STATES WHICH ONE. Any rename
    // that keeps the marker reddens this, so the recorded edit is the rename
    // that was actually run rather than the class it belongs to — a reader
    // applying this one gets the four rows below, in this order.
    guarantee: 'a-witness-transcript-names-its-test',
    mutatedFile: 'src/empire/empireInvariant.test.ts',
    mutated:
      'compares the PHYSIO series by wall-clock day, and finds nothing moved ' +
      '[no-accelerant-moves-a-physio-element]',
    mutatedTo:
      'compares the PHYSIO series by wall-clock day, and finds nothing shifted ' +
      '[no-accelerant-moves-a-physio-element]',
    testFile: 'src/game/guaranteeTags.test.ts',
    redAssertion:
      "expect(faulty, 'witness transcripts that do not show the named test running').toEqual([]);",
    observed:
      'requires a witness transcript to name the test it says reddened\n' +
      'AssertionError: witness transcripts that do not show the named test running: ' +
      'expected [ …(4) ] to deeply equal [] — received all four physio rows, each ending ' +
      "'— names-no-test', naming the mutants on `elapsedFor`, `axisBook`, `settledAxisLevel` " +
      'and `accrueProduction`',
  },
  // -------------------------------------------------------------------------
  // ...and the domain half of the same field, witnessed on the movement it
  // exists to notice rather than on a synthetic edit.
  //
  // THE MUTANT IS A SWEEP DEEPENING, which is what a domain pin is for: one
  // digit of AXIS A's population moved, the way `2520` became `78926` became
  // `322947` on the axis below it, and the `strength-never-removes-a-meet`
  // row's anchor stopped resolving against that body while its property
  // assertion still did. The mutant sits in a TEST file rather than in shipped
  // source for the same reason the mutant above does: the subject of this rule
  // is a pin in a test body, and there is nowhere else for it to be.
  //
  // BOTH DIRECTIONS WERE DRIVEN, because a check that is red whatever you do is
  // not a check. With the pin at 80602 and this row's anchor left at 80601 the
  // named assertion reddens as recorded; with the anchor moved to 80602 beside
  // it, the same run is `Test Files 1 passed`, one test, no findings.
  // -------------------------------------------------------------------------
  {
    // The replacement is the deepening the paragraph above describes, recorded
    // rather than left to be inferred from the sentence: re-applied at this
    // tree it reproduces the message below verbatim, received array included.
    guarantee: 'a-measured-transcript-anchors-its-domain',
    mutatedFile: 'src/career/eligibility.test.ts',
    mutated: 'expect(shipped.pairs).toBe(80601);',
    mutatedTo: 'expect(shipped.pairs).toBe(80602);',
    testFile: 'src/game/guaranteeTags.test.ts',
    redAssertion:
      "expect(faulty, 'witness rows whose domain anchor does not hold').toEqual([]);",
    observed:
      'requires a transcript that quotes a measured number to anchor its domain ' +
      '[a-measured-transcript-anchors-its-domain]\n' +
      'AssertionError: witness rows whose domain anchor does not hold: ' +
      'expected [ Array(1) ] to deeply equal []\n' +
      '- Expected\n+ Received\n- []\n+ [\n+   "strength-never-removes-a-meet :: return ' +
      'meetsQualifyingTotal(lifter.bestTotalKg, meet.qualifyingTotalKg); — ' +
      'domain-anchor-not-in-the-body",\n+ ]',
  },
];

/**
 * The source of the test whose title declares `id`, from `\`it(\`` to the next
 * `\`it(\`` — enough to say whether an assertion is inside it rather than
 * somewhere else in a six-thousand-line file.
 *
 * THE SLICING ITSELF IS `src/tuning/audit.ts`'S, and that is the point rather
 * than tidiness. `progression.test.ts`'s seal ledger does the same job for a
 * different marker and used to do it with a weaker check; one implementation
 * with two callers is what stops the two drifting apart again. This wrapper is
 * only the choice of marker.
 */
function bodyOfTestDeclaring(text: string, id: string): string | null {
  return bodyOfTestContaining(text, declarationOf(id));
}

// ---------------------------------------------------------------------------
// Reading comments out of source
// ---------------------------------------------------------------------------

interface CommentParagraph {
  /** 1-based line the paragraph starts on. */
  readonly startLine: number;
  readonly text: string;
}

/**
 * The COMMENT PARAGRAPHS of a TypeScript source.
 *
 * A paragraph is a run of consecutive comment lines carrying prose, bounded by a
 * blank comment line, a rule of dashes, or any line that is not a comment.
 * Leading ` * ` and `// ` decoration is stripped so a capitalised run can span a
 * line break — which it usually does, since these comments are hard-wrapped.
 *
 * COMMENTS ONLY. Code, string literals and identifiers are invisible to it, so
 * a constant named `ONLY_EVER_ONE` is not prose and cannot trigger the ban.
 * Exercised on a sample below rather than trusted: a scanner that read the wrong
 * half of the file would be silently green, which is the failure mode this whole
 * file exists to make impossible.
 */
function commentParagraphs(text: string): CommentParagraph[] {
  const lines = text.split('\n');
  const paragraphs: CommentParagraph[] = [];
  let current: { startLine: number; lines: string[] } | null = null;
  let insideBlock = false;

  const flush = (): void => {
    if (current !== null && current.lines.join(' ').trim() !== '') {
      paragraphs.push({ startLine: current.startLine, text: current.lines.join('\n') });
    }
    current = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();
    let isComment = false;
    if (insideBlock) {
      isComment = true;
      if (trimmed.includes('*/')) insideBlock = false;
    } else if (trimmed.startsWith('/*')) {
      isComment = true;
      if (!trimmed.includes('*/')) insideBlock = true;
    } else if (trimmed.startsWith('//')) {
      isComment = true;
    }
    if (!isComment) {
      flush();
      continue;
    }
    const bare = raw
      .replace(/^\s*(\/\*\*?|\*\/|\*|\/\/)\s?/, '')
      .replace(/\*\/\s*$/, '')
      .trim();
    // A blank comment line, or a rule of dashes, ends the paragraph.
    if (bare === '' || /^-+$/.test(bare)) {
      flush();
      continue;
    }
    if (current === null) current = { startLine: i + 1, lines: [] };
    current.lines.push(bare);
  }
  flush();
  return paragraphs;
}

/** The capitalised absolute runs in a paragraph, if any. */
function triggeringRuns(paragraph: string): string[] {
  const flat = paragraph.split('\n').join(' ');
  const runs: string[] = [];
  for (const match of flat.matchAll(CAPS_RUN)) {
    const run = match[0] ?? '';
    const words = run.split(/\s+/);
    if (words.length < MIN_CAPS_RUN_WORDS) continue;
    if (!words.some((word) => GUARANTEE_TRIGGERS.includes(word.replace(/[^A-Z]/g, '')))) continue;
    runs.push(run);
  }
  return runs;
}

// ---------------------------------------------------------------------------
// Reading the numbers out of a tagged paragraph
// ---------------------------------------------------------------------------

/**
 * A numeral in prose. Decimals and thousands separators included, because both
 * appear in this codebase's measurements and neither is an identifier.
 */
const PROSE_NUMERAL = /\d+(?:,\d{3})*(?:\.\d+)?/g;

/** A numeral in a paragraph is a claim about a number unless it is one of these. */
function excludedAs(
  flat: string,
  index: number,
  numeral: string,
  codeSpans: readonly (readonly [number, number])[],
  lineStarts: ReadonlySet<number>,
): NumberExclusion | null {
  const before = index > 0 ? flat.charAt(index - 1) : '';
  const after = flat.slice(index + numeral.length);
  if (before === '§') return 'section-coordinate';
  if (/[A-Za-z_]/.test(before)) return 'inside-an-identifier';
  const suffix = /^[A-Za-z_]+/.exec(after)?.[0] ?? '';
  if (suffix !== '' && !UNIT_SUFFIXES.includes(suffix)) return 'inside-an-identifier';
  // A span holding NOTHING BUT the numeral is not quoted code — otherwise
  // wrapping a number in backticks would be a one-character way out of the rule.
  const quoting = codeSpans.find(([from, to]) => index >= from && index < to);
  if (quoting !== undefined) {
    const inner = flat.slice(quoting[0] + 1, quoting[1] - 1).trim();
    if (inner !== numeral) return 'quoted-code';
  }
  if (lineStarts.has(index) && /^\.\s/.test(after)) return 'list-ordinal';
  return null;
}

/**
 * The numbers a paragraph states as prose, and a census of what was dropped.
 *
 * THE PARAGRAPH IS FLATTENED TO ONE LINE FIRST, the same way `triggeringRuns`
 * flattens it, because these comments are hard-wrapped and a measurement runs
 * across the break as often as not.
 */
function claimedNumbersIn(paragraph: string): {
  readonly claimed: readonly ClaimedNumber[];
  readonly excluded: ExclusionCensus;
} {
  const lines = paragraph.split('\n');
  const flat = lines.join(' ');
  const codeSpans: (readonly [number, number])[] = [];
  for (const span of flat.matchAll(/`[^`]*`/g)) {
    const at = span.index ?? 0;
    codeSpans.push([at, at + span[0].length]);
  }
  const lineStarts = new Set<number>();
  let offset = 0;
  for (const line of lines) {
    lineStarts.add(offset);
    offset += line.length + 1;
  }

  const claimed: ClaimedNumber[] = [];
  const excluded: ExclusionCensus = {
    'section-coordinate': 0,
    'inside-an-identifier': 0,
    'quoted-code': 0,
    'list-ordinal': 0,
  };
  // Reset for the reason `taggedParagraphsIn` resets: a shared /g regex carries
  // its `lastIndex` into `matchAll`, and that cost this scan 19 paragraphs once
  // already. Nothing calls `.test()` on this one today, which is exactly the
  // condition under which the next person adds one.
  PROSE_NUMERAL.lastIndex = 0;
  for (const match of flat.matchAll(PROSE_NUMERAL)) {
    const numeral = match[0];
    const index = match.index ?? 0;
    const kind = excludedAs(flat, index, numeral, codeSpans, lineStarts);
    if (kind !== null) {
      excluded[kind] += 1;
      continue;
    }
    claimed.push({
      numeral,
      index,
      context: `${flat.slice(Math.max(0, index - 30), index)}[${numeral}]${flat.slice(index + numeral.length, index + numeral.length + 30)}`,
    });
  }
  return { claimed, excluded };
}

/** Whether `body` states `numeral` as a number rather than as part of one. */
function numeralOccursIn(body: string, numeral: string): boolean {
  const bare = numeral.replace(/,/g, '');
  return new RegExp(`(?<![\\d.])${bare.replace('.', '\\.')}(?![\\d.])`).test(body);
}

interface TaggedParagraph {
  /** `file:line`, for the failure message. */
  readonly where: string;
  readonly guarantees: readonly string[];
  /**
   * The paragraph AS WRITTEN, hard wraps and all.
   *
   * Not pre-flattened, which was a live defect for one run of this code: every
   * index below is in flattened coordinates, so storing the flat form threw
   * away the line boundaries and the `list-ordinal` exclusion could only ever
   * fire on the first character of a paragraph. It went green on the tree and
   * silently reclassified a numbered section heading as a claim.
   */
  readonly text: string;
}

/** Flattened the same way `triggeringRuns` flattens: hard wraps become spaces. */
function flattenParagraph(text: string): string {
  return text.split('\n').join(' ');
}

function taggedParagraphsIn(rel: string, text: string): TaggedParagraph[] {
  const found: TaggedParagraph[] = [];
  for (const paragraph of commentParagraphs(text)) {
    const guarantees: string[] = [];
    // `GUARANTEE_TAG` is a /g regex shared with a `.test()` caller, and
    // `matchAll` STARTS FROM ITS `lastIndex`. Without this reset the scan found
    // 38 of the 57 tagged paragraphs and reported a coverage number that was
    // wrong in the flattering direction. Measured, not guessed.
    GUARANTEE_TAG.lastIndex = 0;
    for (const match of paragraph.text.matchAll(GUARANTEE_TAG)) guarantees.push(match[1] ?? '');
    if (guarantees.length === 0) continue;
    found.push({ where: `${rel}:${paragraph.startLine}`, guarantees, text: paragraph.text });
  }
  return found;
}

interface NumberClaimAudit {
  readonly claimed: number;
  readonly paragraphsWithNumbers: number;
  readonly resolving: number;
  readonly resolvingInCode: number;
  readonly excusedOccurrences: number;
  readonly excluded: ExclusionCensus;
  /** A cited number that is in no named body and on no excuse. */
  readonly unpinned: readonly string[];
  /** An excuse that anchors nowhere, or excuses nothing any more. */
  readonly staleExcuses: readonly string[];
}

/**
 * THE WHOLE CHECK AS ONE FUNCTION, taking its resolver and its excuse list as
 * arguments so the planted sample below drives THE SAME CODE the tree does.
 * Two implementations is how the sibling guards in this repository diverged.
 */
function auditClaimedNumbers(
  paragraphs: readonly TaggedParagraph[],
  bodyOf: (id: string) => string | null,
  excuses: readonly UnpinnedProseNumber[],
): NumberClaimAudit {
  const excluded: ExclusionCensus = {
    'section-coordinate': 0,
    'inside-an-identifier': 0,
    'quoted-code': 0,
    'list-ordinal': 0,
  };

  // Where each excuse anchors: exactly one site, or it is stale.
  const staleExcuses: string[] = [];
  const sites = new Map<UnpinnedProseNumber, { paragraph: number; from: number; to: number }>();
  const used = new Map<UnpinnedProseNumber, number>();
  for (const excuse of excuses) {
    used.set(excuse, 0);
    if (excuse.phrase.length < MIN_ANCHOR_LENGTH) {
      staleExcuses.push(`${excuse.guarantee}: "${excuse.phrase}" is too short to anchor a sentence`);
      continue;
    }
    const hits: { paragraph: number; from: number; to: number }[] = [];
    paragraphs.forEach((paragraph, i) => {
      if (!paragraph.guarantees.includes(excuse.guarantee)) return;
      const flat = flattenParagraph(paragraph.text);
      let at = flat.indexOf(excuse.phrase);
      while (at !== -1) {
        hits.push({ paragraph: i, from: at, to: at + excuse.phrase.length });
        at = flat.indexOf(excuse.phrase, at + 1);
      }
    });
    if (hits.length !== 1) {
      staleExcuses.push(
        `${excuse.guarantee}: "${excuse.phrase}" occurs ${hits.length} times in the paragraphs `
        + 'that tag it, and an excuse anchors exactly once',
      );
      continue;
    }
    sites.set(excuse, hits[0] as { paragraph: number; from: number; to: number });
  }

  let claimed = 0;
  let paragraphsWithNumbers = 0;
  let resolving = 0;
  let resolvingInCode = 0;
  let excusedOccurrences = 0;
  const unpinned: string[] = [];

  paragraphs.forEach((paragraph, i) => {
    const numbers = claimedNumbersIn(paragraph.text);
    for (const kind of Object.keys(excluded) as NumberExclusion[]) {
      excluded[kind] += numbers.excluded[kind];
    }
    if (numbers.claimed.length > 0) paragraphsWithNumbers += 1;
    claimed += numbers.claimed.length;

    const bodies = paragraph.guarantees.map((id) => bodyOf(id));
    for (const number of numbers.claimed) {
      const inBody = bodies.some((body) => body !== null && numeralOccursIn(body, number.numeral));
      const inCode = bodies.some(
        (body) => body !== null && numeralOccursIn(withoutComments(body), number.numeral),
      );
      if (inBody) resolving += 1;
      if (inCode) resolvingInCode += 1;
      if (inBody) continue;

      let excusedBy: UnpinnedProseNumber | null = null;
      for (const excuse of excuses) {
        const site = sites.get(excuse);
        if (site === undefined) continue;
        if (site.paragraph !== i) continue;
        if (number.index < site.from || number.index >= site.to) continue;
        excusedBy = excuse;
        break;
      }
      if (excusedBy !== null) {
        excusedOccurrences += 1;
        used.set(excusedBy, (used.get(excusedBy) ?? 0) + 1);
        continue;
      }
      unpinned.push(
        `${paragraph.where} [${paragraph.guarantees.join('][')}] cites ${number.numeral}, which is `
        + `not in the body of the test the tag names — "…${number.context}…"`,
      );
    }
  });

  // AN EXCUSE THAT EXCUSES NOTHING IS STALE, which is the direction an
  // allowlist rots in: somebody pins the number, and the entry saying it is
  // unpinnable stays behind reading like a live exception.
  for (const excuse of excuses) {
    if (sites.has(excuse) && (used.get(excuse) ?? 0) === 0) {
      staleExcuses.push(
        `${excuse.guarantee}: "${excuse.phrase}" excuses nothing any more — either the number is `
        + 'pinned now, or the sentence moved. Delete the entry.',
      );
    }
  }

  return {
    claimed,
    paragraphsWithNumbers,
    resolving,
    resolvingInCode,
    excusedOccurrences,
    excluded,
    unpinned,
    staleExcuses,
  };
}

/**
 * Every paragraph in `text` that asserts a guarantee and carries no tag.
 *
 * Returned rather than asserted, so the same function can be shown to FIRE on a
 * planted sample in the test that shows it silent on the tree.
 */
function untaggedGuarantees(rel: string, text: string): string[] {
  const findings: string[] = [];
  for (const paragraph of commentParagraphs(text)) {
    const runs = triggeringRuns(paragraph.text);
    if (runs.length === 0) continue;
    GUARANTEE_TAG.lastIndex = 0;
    if (GUARANTEE_TAG.test(paragraph.text)) continue;
    // THE MESSAGE DELIBERATELY DOES NOT SPELL THE TAG. The tree-wide scan reads
    // whole files rather than only their comments, so a literal here would be a
    // tag this file had to resolve — found by writing it the obvious way and
    // watching the scan demand a test called `[tag]`.
    findings.push(`${rel}:${paragraph.startLine} asserts "${runs[0]}" with no guarantee tag`);
  }
  return findings;
}

function sourceFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...sourceFilesUnder(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** Every `it(...)` title in the tree, with the file it came from. */
const TEST_TITLE = /\bit\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
/** ...and the forms that declare a test without running it. */
const SKIPPED_TEST_TITLE = /\bit\s*\.\s*(?:skip|todo|fails)\s*\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;

interface TestTitle {
  readonly title: string;
  readonly file: string;
  readonly skipped: boolean;
}

/**
 * The body of the test declaring `id`, found anywhere in the tree.
 *
 * THE SINGLE LINE BELOW IS THE WHOLE OF THE BODY SCOPING, and it is the
 * mutation site the witness for this rule anchors on: returning `text` instead
 * is the file-scoped reading, which passes a number that is in the right file
 * for a different check's reasons.
 */
function bodyOfDeclaredTest(id: string, titles: readonly TestTitle[]): string | null {
  const declaring = titles.find((title) => title.title.includes(declarationOf(id)));
  if (declaring === undefined) return null;
  const text = readFileSync(path.join(REPO_ROOT, declaring.file), 'utf8');
  return bodyOfTestDeclaring(text, id);
}

/**
 * The TITLE of that same test, which is what a transcript would have printed.
 *
 * TREE-WIDE RATHER THAN SCOPED TO THE WITNESS'S `testFile`, and that is
 * measured rather than casual: the scoped version was written first, and
 * deleting its file filter left the suite green. `resolves every tag in the
 * tree to exactly one live test` pins the declaring count at one and the
 * freshness loop pins the declaring test into `testFile`, so the filter had no
 * state of the tree that could make it fire. A second copy of a guard that
 * cannot fire is how two siblings in this repository drifted apart before.
 */
function titleDeclaring(id: string, titles: readonly TestTitle[]): string | null {
  return titles.find((title) => title.title.includes(declarationOf(id)))?.title ?? null;
}

function testTitlesUnder(dir: string): TestTitle[] {
  const found: TestTitle[] = [];
  for (const file of sourceFilesUnder(dir)) {
    if (!file.endsWith('.test.ts') && !file.endsWith('.test.tsx')) continue;
    const text = readFileSync(file, 'utf8');
    const rel = path.relative(REPO_ROOT, file);
    const skipped = new Set<string>();
    for (const match of text.matchAll(SKIPPED_TEST_TITLE)) skipped.add(match[2] ?? '');
    for (const match of text.matchAll(TEST_TITLE)) {
      const title = match[2] ?? '';
      found.push({ title, file: rel, skipped: skipped.has(title) });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------

// The describe name deliberately avoids spelling the tag, for the same reason
// the finding message does: the scan reads whole files.
describe('the guarantee-tag convention', () => {
  it('resolves every tag in the tree to exactly one live test', () => {
    // THE TAG SCAN, TREE-WIDE — the half that is not scoped. A `@guarantee`
    // written anywhere under `src` names a test, and this is what makes the
    // naming mean something: an id nothing declares fails, an id two tests
    // declare fails, and an id whose test is skipped fails.
    const titles = testTitlesUnder(path.join(REPO_ROOT, 'src'));
    const tagged = new Set<string>();
    let tags = 0;

    for (const file of sourceFilesUnder(path.join(REPO_ROOT, 'src'))) {
      const text = readFileSync(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);
      for (const match of text.matchAll(GUARANTEE_TAG)) {
        const id = match[1] ?? '';
        const where = `${rel}: @guarantee ${id}`;
        const declaring = titles.filter((t) => t.title.includes(declarationOf(id)));
        expect(declaring.length, `${where} names no test titled "${declarationOf(id)}"`).toBe(1);
        expect(declaring[0]?.skipped, `${where} names a test that does not run`).toBe(false);
        tagged.add(id);
        tags += 1;
      }
    }

    // NON-VACUITY. A convention nobody used would pass every line above.
    expect(tags, 'guarantee tags found in the tree').toBeGreaterThan(15);
    expect(tagged.size, 'distinct guarantees named').toBeGreaterThan(10);

    // AND THE OTHER DIRECTION: a test that declares an id no comment references
    // is a test claiming to serve a sentence that is gone. Same exactness
    // `@ours` holds its figure table to.
    const declared = new Set<string>();
    for (const { title } of titles) {
      for (const match of title.matchAll(/\[([a-z][a-z0-9-]*)\]/g)) declared.add(match[1] ?? '');
    }
    expect([...declared].sort(), 'ids declared by a test but referenced by no comment').toEqual(
      [...tagged].sort(),
    );
  });

  it('makes every tag declared from here carry mutation evidence that is still fresh', () => {
    // THE RAISED BAR. A tag that resolves is not a tag that bites, and a quarter
    // of the first careful pass proved it. From here a tag either carries a
    // witness or is on the named legacy list, and there is no third option.
    const titles = testTitlesUnder(path.join(REPO_ROOT, 'src'));
    const tags = new Set<string>();
    for (const file of sourceFilesUnder(path.join(REPO_ROOT, 'src'))) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(GUARANTEE_TAG)) tags.add(match[1] ?? '');
    }

    const witnessed = new Set(MUTATION_WITNESSES.map((w) => w.guarantee));
    const legacy = new Set(UNWITNESSED_LEGACY_TAGS);

    // NEITHER SET MAY NAME A TAG THAT IS GONE. A witness for a deleted claim, or
    // a debt entry for one, is bookkeeping about nothing.
    expect([...witnessed].filter((id) => !tags.has(id)), 'witnesses for tags that no longer exist').toEqual([]);
    expect([...legacy].filter((id) => !tags.has(id)), 'debt entries for tags that no longer exist').toEqual([]);
    // AND NO TAG MAY BE IN BOTH, which would let a witnessed tag be quietly
    // demoted back to debt without the witness being deleted.
    expect([...witnessed].filter((id) => legacy.has(id)), 'tags both witnessed and excused').toEqual([]);

    // THE BAR ITSELF.
    const unaccounted = [...tags].filter((id) => !witnessed.has(id) && !legacy.has(id)).sort();
    expect(
      unaccounted,
      'a tag was declared with no mutation witness and no entry on the legacy list',
    ).toEqual([]);

    // AND EVERY WITNESS STILL RESOLVES — the freshness half, which is the half
    // worth having. Either anchor being edited away expires the witness.
    for (const witness of MUTATION_WITNESSES) {
      const where = `witness for ${witness.guarantee}`;
      // WHERE THIS FLOOR STILL DOES WORK, since the transcript rule arrived
      // after it and the two read the same field. On a GRADED row it is
      // subsumed — that row's `observed` has to contain the declaring test's
      // title, and no title in the tree is shorter than this. On a row carrying
      // `transcriptPredatesTheRule` nothing else reads `observed` at all, and
      // there are more of those than of the graded ones, so the floor is live
      // rather than dominated. It stops being live when the debt list empties,
      // and that is the moment to delete it.
      expect(witness.observed.length, `${where}: records no failure message`).toBeGreaterThan(
        MIN_ANCHOR_LENGTH,
      );

      expect(witness.mutated.length, `${where}: the mutated anchor is too short to anchor`).toBeGreaterThan(
        MIN_ANCHOR_LENGTH,
      );
      const mutatedPath = path.join(REPO_ROOT, witness.mutatedFile);
      expect(existsSync(mutatedPath), `${where}: ${witness.mutatedFile}`).toBe(true);
      // THROUGH `anchorOccurrences`, which `COLLECTION_KILL_MUTANTS` also goes
      // through. Its records carry the same kind of anchor for the same reason,
      // and CLAUDE.md's rule about a guard written for one arm is that the twin
      // must read the sibling rather than copy it. One function, two callers.
      expect(
        anchorOccurrences(witness.mutatedFile, witness.mutated),
        `${where}: the mutated text does not occur exactly once in ${witness.mutatedFile}`,
      ).toBe(1);

      expect(
        witness.redAssertion.length,
        `${where}: the red assertion is too short to anchor`,
      ).toBeGreaterThan(MIN_ANCHOR_LENGTH);
      const testPath = path.join(REPO_ROOT, witness.testFile);
      expect(existsSync(testPath), `${where}: ${witness.testFile}`).toBe(true);
      const testText = readFileSync(testPath, 'utf8');

      // THE ASSERTION IS INSIDE THE TEST THE TAG NAMES, not merely somewhere in
      // the file. Without this a witness could point at a live assertion in an
      // unrelated test and expire against nothing the guarantee depends on.
      const body = bodyOfTestDeclaring(testText, witness.guarantee);
      expect(body, `${where}: no test declares [${witness.guarantee}]`).not.toBe(null);
      expect(
        (body ?? '').includes(witness.redAssertion),
        `${where}: the red assertion is not inside the test that declares the tag`,
      ).toBe(true);
    }

    // THE SCOPER'S OWN PREMISE, PINNED AS A COUNT RATHER THAN TRUSTED.
    //
    // `bodyOfTestDeclaring` slices on `/\bit\s*\(/` over raw text, so it
    // assumes every occurrence of those characters IS a test declaration. Two
    // ways that breaks, and they fail in opposite directions:
    //
    //   - A SPURIOUS match — the sequence inside a string or a comment — cuts a
    //     real body short. That fails CLOSED: the red assertion drops out of
    //     the slice and the witness stops resolving. Found live in
    //     `streak.test.ts`, where a comment read "armed against it (§5"; it
    //     truncated a test that carries a tag but no witness, so nothing broke,
    //     and the phrase has been reworded.
    //   - A MISSING match — `it.each(`, `it.skip(`, `it.only(`, none of which
    //     this pattern matches — merges two tests into one slice. That fails
    //     OPEN, and it is the dangerous one: a witness would resolve against an
    //     assertion living in a DIFFERENT test, which is precisely the failure
    //     the "inside the test the tag names" check above exists to prevent.
    //
    // Neither is hypothetical enough to leave unmeasured, and neither is
    // visible in a green suite. So: for every file a witness names, the number
    // of split points must equal the number of line-anchored `it(`
    // declarations. A bound would not do — the whole point is that the two
    // numbers agree exactly.
    //
    // THE COUNTING AND THE WORDING ARE `audit.ts`'S, shared with the seal
    // ledger in `progression.test.ts`, which scopes into three test files this
    // table never names. Two lists, one guard: neither ledger can strengthen or
    // weaken the premise check without the other moving with it.
    const censused: string[] = [];
    for (const file of [...new Set(MUTATION_WITNESSES.map((w) => w.testFile))].sort()) {
      const text = readFileSync(path.join(REPO_ROOT, file), 'utf8');
      expect(testScopeFault(text, file), 'the witness scoper cannot slice this file').toBe(null);
      censused.push(file);
    }
    // NON-VACUITY AS A NAMED SET RATHER THAN A BOUND. A witness table that
    // emptied, or a `testFile` column that stopped resolving, censuses nothing
    // and the loop above is a green no-op. Counting the loop's own iterations
    // could not catch that — it would restate the set it walked — so the set
    // itself is written down. Adding a witness in a new file is a one-line
    // diff here, on purpose.
    expect(censused, 'the files the witness table scopes into').toEqual([
      // GDD §2.1's career spine, and the first row in this table from it.
      'src/career/eligibility.test.ts',
      'src/cutin/cutInWiring.test.ts',
      // The first `src/empire/**` rows. GDD §5's directory carried 23 declared
      // guarantees and no witnesses at all until these.
      'src/empire/empireInvariant.test.ts',
      'src/empire/engagement.test.ts',
      // The numeric half of the tag witnesses itself: the mutant is in this
      // file, and so is the test it reddens.
      'src/game/guaranteeTags.test.ts',
      'src/game/meetClient.test.ts',
      'src/game/meetDay.test.ts',
      'src/game/progression.test.ts',
      'src/game/sessionServer.test.ts',
      'src/game/streak.test.ts',
      'src/game/streakEntitlement.test.ts',
      // The lift press guard. Its subject list is DISCOVERED from the tree, and
      // the mutant that witnesses it is the state that shipped: the fix present
      // on the replay harness and absent from the two screens a player presses.
      'src/lift/liftInput.test.ts',
      'src/meet/AttemptSelectView.test.ts',
      'src/meet/careerCalendarPlaceholder.test.ts',
      'src/meet/meetSound.test.ts',
      'src/meet/meetStage.test.ts',
      // GDD §5's floor learning to advance: the §12.3 property that the gym a
      // player sees is a function of elapsed time and of nothing they did.
      'src/shell/empireFloor.test.ts',
      'src/shell/shellRoute.test.ts',
      'src/shell/shellWiring.test.ts',
    ]);

    // NON-VACUITY. An empty witness table satisfies every loop above. The real
    // guard is the pair of set equalities — an empty table would force every tag
    // onto the legacy list, which is an explicit diff with a comment next to it —
    // but a bare count catches the emptiest version outright.
    expect(MUTATION_WITNESSES.length, 'no witnesses recorded').toBeGreaterThan(2);
    // And the bar is measured rather than asserted: it covers the tags added
    // since it existed, which is a minority, and says so.
    expect(witnessed.size + legacy.size).toBe(tags.size);
    expect(titles.length, 'the tree has tests to point at').toBeGreaterThan(100);
  });

  it('requires a witness transcript to name the test it says reddened [a-witness-transcript-names-its-test]', () => {
    // The arm aimed at the filed gap: a mutant that stops the file collecting
    // is red, exits 1, and runs nothing. Its output names no test, so a
    // transcript that names none is not evidence the guarantee was measured.
    // The long comment on `TranscriptFault` says what this reaches and what it
    // leaves open; this is only the loop.
    const titles = testTitlesUnder(path.join(REPO_ROOT, 'src'));
    const faulty: string[] = [];
    const excused: string[] = [];
    let graded = 0;

    for (const witness of MUTATION_WITNESSES) {
      const title = titleDeclaring(witness.guarantee, titles);
      expect(title, `witness for ${witness.guarantee}: no test declares it`).not.toBe(null);
      const faults = transcriptFaults(witness.observed, title ?? '', witness.guarantee);
      const key = witnessKey(witness);

      if (witness.transcriptPredatesTheRule === true) {
        // BOTH DIRECTIONS, the way `UNPINNED_PROSE_NUMBERS` is checked: an
        // excuse that has stopped excusing anything is stale, and leaving it
        // behind is how a debt list turns into decoration. Re-take the
        // transcript and the flag has to come off in the same diff.
        expect(
          faults.length,
          `${key}: excused as predating the rule, but its transcript satisfies it now`,
        ).toBeGreaterThan(0);
        excused.push(key);
        continue;
      }
      graded += 1;
      if (faults.length > 0) faulty.push(`${key} — ${faults.join(', ')}`);
    }

    expect(faulty, 'witness transcripts that do not show the named test running').toEqual([]);
    // Counts, not bounds. An empty graded set satisfies the loop above.
    expect(graded, 'witness rows held to the transcript rule').toBe(TRANSCRIPT_BAR.GRADED);
    expect(excused.length, 'witness rows excused from it').toBe(TRANSCRIPT_BAR.PREDATING);
  });

  it('refuses the two measured collection kills, and each arm of the rule fires alone', () => {
    // ANTI-VACUITY FOR THE RULE ABOVE. That loop is a set of `expect`s over rows
    // that all satisfy it; if either arm were deleted it would stay green. So
    // each arm is driven on its own, and the exact fault list is pinned rather
    // than "at least one fault" — a bound here would let one arm die silently.
    const titles = testTitlesUnder(path.join(REPO_ROOT, 'src'));
    const titleFor = (id: string): string => {
      const found = titleDeclaring(id, titles);
      expect(found, `no test declares [${id}]`).not.toBe(null);
      return found ?? '';
    };

    // 1. THE REAL RECORDS. Their anchors resolve through the same
    //    `anchorOccurrences` the witness loop uses, so a record whose subject
    //    was edited away expires exactly as a witness does.
    const refusedBy: string[] = [];
    for (const kill of COLLECTION_KILL_MUTANTS) {
      expect(
        anchorOccurrences(kill.mutatedFile, kill.mutated),
        `collection kill in ${kill.mutatedFile}: its anchor does not resolve exactly once`,
      ).toBe(1);
      refusedBy.push(
        transcriptFaults(
          kill.observed,
          titleFor(kill.wouldHaveWitnessed),
          kill.wouldHaveWitnessed,
        ).join(','),
      );
    }
    // Both are refused by `names-no-test` ALONE — they carry a `RangeError:`
    // line, so the failure-line arm is satisfied and says nothing. That is the
    // measurement behind "neither arm subsumes the other": delete the first arm
    // and both of these become admissible witnesses.
    //
    // AND IT IS THE COUNT PIN TOO. `refusedBy` gets one entry per record, so
    // this equality fails on a third record and on an emptied list alike. A
    // separate `COLLECTION_KILL_MUTANTS.length` assertion was written here
    // first and deleted: it is the same fact one step out, and no state of the
    // list makes it fire while this one passes. That is the shape
    // `tools/test-budgets.mjs` had to delete a check for.
    expect(refusedBy, 'how each measured collection kill is refused').toEqual([
      'names-no-test',
      'names-no-test',
    ]);

    // 2. EACH ARM ON ITS OWN, on planted transcripts built to trip one and not
    //    the other. Planted rather than real for the same reason the freshness
    //    check plants its witnesses: a real transcript that trips exactly one
    //    arm is not something the tree happens to contain.
    const id = 'no-accelerant-moves-a-physio-element';
    const title = titleFor(id);
    const planted: Array<{ what: string; observed: string; faults: TranscriptFault[] }> = [
      {
        what: 'the shape a real catch has',
        observed: `${title}\nAssertionError: expected 188 to be +0`,
        faults: [],
      },
      {
        // The test ran, and the transcript says nothing about how it failed —
        // which is also what a PASSING run's output looks like.
        what: 'names the test, records no failure',
        observed: title,
        faults: ['no-failure-line'],
      },
      {
        // An assertion really failed, in some other test. The tag's own test
        // may have passed, or never run at all; this transcript cannot say.
        what: "another test's failure",
        observed: 'somebody else\nAssertionError: expected 1 to be 2',
        faults: ['names-no-test'],
      },
      { what: 'neither', observed: 'it went red', faults: ['names-no-test', 'no-failure-line'] },
    ];
    // ONE ASSERTION PER PLANTED CASE, and that is about the failure MESSAGE
    // rather than about coverage. Mapping all four into one array and comparing
    // the arrays reddens correctly and prints `expected [ …(4) ] to deeply
    // equal [ …(4) ]`, which names neither the case that moved nor the arm that
    // moved it. CLAUDE.md's note that a check which bites but fails uselessly
    // is half a check, applied to a check written in this same round.
    for (const one of planted) {
      expect(
        transcriptFaults(one.observed, title, id),
        `planted transcript "${one.what}" — the faults the rule finds in it`,
      ).toEqual(one.faults);
    }
    // The loop is a green no-op on an empty list, and dropping a case is not
    // caught by the fault-coverage check below: two of these four already
    // produce both faults between them.
    expect(planted.length, 'planted transcripts driven').toBe(4);
    // 3. AND EVERY DECLARED FAULT WAS REACHED, against the runtime list the
    //    type is derived from rather than against the four lines above.
    //
    //    Written the other way first and it was strictly dominated: comparing
    //    the produced set with a literal pair restates what the four exact
    //    lists already say, so no state of `transcriptFaults` reddens it while
    //    they pass. Read from `TRANSCRIPT_FAULTS` it is independent — a third
    //    arm added to the rule and to that list, with no planted transcript
    //    reaching it, moves this and leaves the four alone.
    const produced = new Set(
      planted.flatMap((one) => transcriptFaults(one.observed, title, id)),
    );
    expect([...produced].sort(), 'declared faults this drive never reached').toEqual(
      [...TRANSCRIPT_FAULTS].sort(),
    );
  });

  it('requires a transcript that quotes a measured number to anchor its domain [a-measured-transcript-anchors-its-domain]', () => {
    // The block above `DOMAIN_FAULTS` says why the number itself is not
    // compared and what this buys instead; this is the loop and its drive.
    const faulty: string[] = [];
    let needing = 0;

    for (const witness of MUTATION_WITNESSES) {
      const graded = witness.transcriptPredatesTheRule !== true;
      const testText = readFileSync(path.join(REPO_ROOT, witness.testFile), 'utf8');
      const body = bodyOfTestDeclaring(testText, witness.guarantee);
      if (graded && MEASURED_SCALAR.test(flatten(witness.observed))) needing += 1;
      const faults = domainAnchorFaults(witness, body, graded);
      if (faults.length > 0) {
        faulty.push(`${witnessKey(witness)} — ${faults.join(', ')}`);
      }
    }

    expect(faulty, 'witness rows whose domain anchor does not hold').toEqual([]);
    // A COUNT, NOT A BOUND, and not the same fact as the loop above it: the
    // loop is a set of `expect`s over rows that satisfy it and stays green on
    // an emptied table or on every scalar transcript being reworded into an
    // array one. This is the population the rule is about.
    //
    // A second pin counting the rows that CARRY an anchor was written here and
    // deleted: the loop already refuses a required row without one, so no state
    // of the table moves that count while this one holds. Same domination
    // `COLLECTION_KILL_MUTANTS.length` was deleted for.
    expect(needing, 'graded rows whose transcript quotes a measured number').toBe(
      TRANSCRIPT_BAR.WITH_A_MEASURED_NUMBER,
    );

    // THE REJECTED ALTERNATIVE, KEPT RUNNABLE AND MEASURED HERE RATHER THAN
    // ASSERTED IN THE COMMENT ABOVE. The obvious rule is this file's own
    // numeric-prose rule pointed at the transcript: every numeral it states
    // must occur in the named test's body. Driven through the same
    // `claimedNumbersIn` and `numeralOccursIn` the real rule uses, so this is
    // that rule rather than a re-description of it.
    const transplanted = { rows: 0, flagged: 0, numerals: 0, unresolved: 0 };
    for (const witness of MUTATION_WITNESSES) {
      const body =
        bodyOfTestDeclaring(
          readFileSync(path.join(REPO_ROOT, witness.testFile), 'utf8'),
          witness.guarantee,
        ) ?? '';
      const cited = claimedNumbersIn(witness.observed).claimed;
      if (cited.length === 0) continue;
      const missing = cited.filter((one) => !numeralOccursIn(body, one.numeral));
      transplanted.rows += 1;
      transplanted.numerals += cited.length;
      transplanted.unresolved += missing.length;
      if (missing.length > 0) transplanted.flagged += 1;
    }
    // Counts on both sides, so it cannot drain quietly. What they say is that
    // the transplant is not merely strict but INVERTED: a mutant's count is by
    // construction a number no assertion in the shipped body pins.
    expect(transplanted, 'the numeric-prose rule transplanted onto transcripts').toEqual(
      TRANSPLANTED_NUMERIC_RULE,
    );

    // AND IT WOULD HAVE BEEN GREEN ON THE ROW THAT PROMPTED THIS RULE, which is
    // the sharper half. `attending-a-meet-never-removes-one` recorded 24 while
    // its own mutant gave 74 and then 86 — and 24 occurs in that body, as the
    // SEASON COUNT. The transplant resolves on a coincidence with an unrelated
    // pin, one level in from the `144` its own grant records.
    const axisB =
      bodyOfTestDeclaring(
        readFileSync(path.join(REPO_ROOT, 'src/career/eligibility.test.ts'), 'utf8'),
        'attending-a-meet-never-removes-one',
      ) ?? '';
    expect(
      numeralOccursIn(axisB, '24'),
      'the stale figure the transplant would have resolved rather than caught',
    ).toBe(true);
    expect(axisB, 'the unrelated pin that coincidence runs through').toContain(
      'expect(shipped.seasons).toBe(24);',
    );

    // EACH FAULT ON ITS OWN, on planted rows against a real body — the same
    // shape the transcript rule's arms are driven in, and for the same reason:
    // a real row tripping exactly one of these is not something the table
    // happens to contain, and a loop over rows that all pass cannot show which
    // arm is doing the work.
    const axisA = bodyOfTestDeclaring(
      readFileSync(path.join(REPO_ROOT, 'src/career/eligibility.test.ts'), 'utf8'),
      'strength-never-removes-a-meet',
    );
    expect(axisA, 'the body the planted rows are driven against').not.toBe(null);
    const scalar = 'AssertionError: expected 55301 to be +0 // Object.is equality';
    const row = (over: string | undefined, red: string, observed = scalar): MutationWitness => ({
      guarantee: 'planted',
      mutatedFile: 'src/career/eligibility.ts',
      mutated: 'planted',
      testFile: 'src/career/eligibility.test.ts',
      redAssertion: red,
      observed,
      ...(over === undefined ? {} : { measuredOver: over }),
    });
    const property = 'expect(shipped.violatingPairs).toBe(0);';
    const domain = 'expect(shipped.pairs).toBe(80601);';
    const planted: Array<{ what: string; witness: MutationWitness; graded: boolean; faults: DomainFault[] }> = [
      { what: 'the shape a live row has', witness: row(domain, property), graded: true, faults: [] },
      {
        what: 'quotes a number, anchors nothing',
        witness: row(undefined, property),
        graded: true,
        faults: ['no-domain-anchor'],
      },
      {
        // THE DEEPENING, WHICH IS THE WHOLE POINT. One digit of the pin moved,
        // exactly as `2520` became `78926` became `322947`, and the anchor
        // stops resolving against the body while the property assertion it
        // sits beside still does.
        what: 'a pin the body no longer holds',
        witness: row('expect(shipped.pairs).toBe(80602);', property),
        graded: true,
        faults: ['domain-anchor-not-in-the-body'],
      },
      {
        // Anchoring the assertion the row already anchors. Without this arm
        // the rule is a second copy of the freshness check.
        what: 'the property assertion, anchored twice',
        witness: row(domain, domain),
        graded: true,
        faults: ['domain-anchor-is-the-property'],
      },
      {
        what: "a pin holding a property's zero",
        witness: row(property, 'expect(shipped.worstDeficit).toBe(0);'),
        graded: true,
        faults: ['domain-anchor-states-no-population'],
      },
      {
        // A row whose transcript has no scalar on the actual side owes nothing,
        // because there is no measured quantity in it to go stale.
        what: 'an array-shaped transcript',
        witness: row(undefined, property, 'AssertionError: expected [ Array(1) ] to deeply equal []'),
        graded: true,
        faults: [],
      },
      {
        // THE BOUNDARY. A row the transcript rule excuses is excused here too,
        // and that is what says this opens no second debt list.
        what: 'a row the transcript rule excuses',
        witness: row(undefined, property),
        graded: false,
        faults: [],
      },
    ];
    // One assertion per case, naming the case — a single array comparison
    // reddens with `expected [ …(7) ] to deeply equal [ …(7) ]` and names
    // neither the case nor the arm.
    for (const one of planted) {
      expect(
        domainAnchorFaults(one.witness, axisA, one.graded),
        `planted row "${one.what}" — the faults the rule finds in it`,
      ).toEqual(one.faults);
    }
    expect(planted.length, 'planted rows driven').toBe(7);
    // AND EVERY DECLARED FAULT WAS REACHED, read from the runtime list the type
    // is derived from rather than from the seven lines above — so a fifth arm
    // added to the rule with no planted row reaching it moves this and leaves
    // the seven alone.
    const produced = new Set(
      planted.flatMap((one) => domainAnchorFaults(one.witness, axisA, one.graded)),
    );
    expect([...produced].sort(), 'declared domain faults this drive never reached').toEqual(
      [...DOMAIN_FAULTS].sort(),
    );
  });

  it('makes a witness reproducible by recording what its mutant put in place of what it removed', () => {
    // The block above `REPLACEMENT_FAULTS` says why a verbatim replacement was
    // chosen over a diff and over a callback, and what a static rule can and
    // cannot say about one. This is the live table; the drive is below.
    const faulty: string[] = [];
    let reproducible = 0;
    let inTheirOwnTestFile = 0;

    for (const witness of MUTATION_WITNESSES) {
      if (witness.mutatedTo === undefined) continue;
      reproducible += 1;
      if (witness.mutatedFile === witness.testFile) inTheirOwnTestFile += 1;
      const full = path.join(REPO_ROOT, witness.mutatedFile);
      const faults = replacementFaults(
        witness,
        existsSync(full) ? readFileSync(full, 'utf8') : '',
      );
      if (faults.length > 0) faulty.push(`${witnessKey(witness)} — ${faults.join(', ')}`);
    }

    expect(faulty, 'witness rows whose recorded replacement is not an edit to this tree').toEqual(
      [],
    );
    // COUNTS, NOT BOUNDS, and neither of these is the loop restated: the loop is
    // a set of `expect`s over the rows that carry a replacement and stays green
    // when every one of them stops carrying it.
    expect(reproducible, 'witness rows a third party can apply and re-run').toBe(
      REPLACEMENT_BAR.REPRODUCIBLE,
    );
    expect(
      inTheirOwnTestFile,
      'of those, the rows whose mutant edits the file their red assertion lives in',
    ).toBe(REPLACEMENT_BAR.IN_THEIR_OWN_TEST_FILE);

    // THE DEBT, IN BOTH DIRECTIONS. This is where presence is enforced: a new
    // row carrying no replacement puts its claim into the left-hand side and
    // reddens, and a row whose debt is closed without the pin being edited
    // reddens the other way as an excuse that excuses nothing. The same shape
    // `UNPINNED_PROSE_NUMBERS` is held to, one table over.
    expect(
      replacementDebt(MUTATION_WITNESSES),
      'the claims whose witness rows still record no replacement',
    ).toEqual(REPLACEMENTS_PREDATING_THE_RULE);
  });

  it('drives each arm of the replacement rule alone, on planted rows including a deletion', () => {
    // ANTI-VACUITY FOR THE RULE ABOVE, in the shape the transcript and domain
    // rules are driven in: a loop over rows that all satisfy a rule cannot show
    // which arm is doing the work, and a real row tripping exactly one arm is
    // not something the table happens to contain.
    //
    // The source is synthetic rather than a file from the tree, because these
    // rows have to be applied to something and applying a planted patch to a
    // real module would either do nothing or describe an edit nobody made. The
    // declaration is assembled rather than written out so that no line of this
    // file begins with a test declaration inside a string — the scoper's census
    // counts those, and it is the premise the witness loop pins.
    const declaration = `${'it'}('a planted claim [a-planted-claim]', () => {`;
    const subject = '  const shipped = measure(subject);';
    const property = '  expect(shipped.violatingPairs).toBe(0);';
    const source = [declaration, subject, property, '});'].join('\n');

    const row = (mutated: string, mutatedTo: string | undefined, sameFile = true): MutationWitness => ({
      guarantee: 'a-planted-claim',
      mutatedFile: 'src/planted/subject.test.ts',
      mutated,
      ...(mutatedTo === undefined ? {} : { mutatedTo }),
      testFile: sameFile ? 'src/planted/subject.test.ts' : 'src/planted/other.test.ts',
      redAssertion: property.trim(),
      observed: 'AssertionError: expected 55301 to be +0 // Object.is equality',
    });

    const planted: Array<{ what: string; witness: MutationWitness; faults: ReplacementFault[] }> = [
      {
        what: 'the shape a reproducible row has',
        witness: row(subject, '  const shipped = measure(broken);'),
        faults: [],
      },
      {
        // THE DELETION, WHICH IS THE CASE A TRUTHINESS TEST GETS WRONG. Several
        // mutants in the real table delete a line, and an empty replacement is
        // how that is written down.
        what: 'a deletion, recorded as an empty replacement',
        witness: row(subject, ''),
        faults: [],
      },
      {
        what: 'a replacement identical to the text it replaced',
        witness: row(subject, subject),
        faults: ['replacement-does-not-change-the-file'],
      },
      {
        // The other half of the same arm: the patch is a real edit and there is
        // nowhere in the file to apply it.
        what: 'an anchor that is not in the file',
        witness: row('  const shipped = measure(somethingElse);', '  const shipped = null;'),
        faults: ['replacement-does-not-change-the-file'],
      },
      {
        // A mutant that deletes the assertion the row says caught it. The patch
        // applies cleanly, so the first arm says nothing.
        what: 'a mutant that deletes its own red assertion',
        witness: row(property, ''),
        faults: ['replacement-removes-the-red-assertion'],
      },
      {
        // THE BOUNDARY. The same deletion in a file that is not the one holding
        // the assertion is silent, which is what scopes the second arm: for a
        // cross-file row the assertion sits in an unmutated file and the
        // freshness loop already reads it there.
        what: 'the same deletion, in a file that is not the test file',
        witness: row(property, '', false),
        faults: [],
      },
      {
        // A row from before the field. Presence is the census's business and
        // an arm here would be dominated by it, so this produces nothing.
        what: 'a row that predates the field',
        witness: row(subject, undefined),
        faults: [],
      },
    ];

    // One assertion per planted row, naming the row — a single array comparison
    // reddens with `expected [ …(7) ] to deeply equal [ …(7) ]` and names
    // neither the case that moved nor the arm that moved it.
    for (const one of planted) {
      expect(
        replacementFaults(one.witness, source),
        `planted row "${one.what}" — the faults the rule finds in it`,
      ).toEqual(one.faults);
    }
    expect(planted.length, 'planted rows driven').toBe(7);
    // AND EVERY DECLARED FAULT WAS REACHED, read from the runtime list the type
    // is derived from rather than from the seven cases above, so a third arm
    // added to the rule with no planted row reaching it moves this and leaves
    // the seven alone.
    const produced = new Set(planted.flatMap((one) => replacementFaults(one.witness, source)));
    expect([...produced].sort(), 'declared replacement faults this drive never reached').toEqual(
      [...REPLACEMENT_FAULTS].sort(),
    );
  });

  it("counts §4a's kill-list bullets against the mutants witnessed for it", () => {
    // WHAT THIS CATCHES THAT THE WITNESS LOOP ABOVE DOES NOT. That loop asks
    // whether each row still resolves. It never asks whether the LIST is whole,
    // so a ninth bullet added to §4a with no mutant behind it — which is exactly
    // how the first eight came to be prose with a stale count each — passes
    // everything above. This is the same self-counting shape as §4a's own
    // denominator pin: read the claim's own list, count it, compare with the
    // thing it is a claim about.
    const source = readFileSync(
      path.join(REPO_ROOT, 'src/empire/empireInvariant.ts'),
      'utf8',
    );
    const carrying = commentParagraphs(source).filter((paragraph) =>
      SECTION_4A_TAGS.every((id) => paragraph.text.includes(`@guarantee ${id}`)),
    );
    // MATCH COUNT, NOT PRESENCE — and this is the assertion that also catches a
    // blank comment line inserted between the bullets and the tags, because the
    // paragraph carrying both tags would then be the tag lines alone and the
    // bullet count below would read zero.
    expect(carrying.length, 'paragraphs carrying both of §4a tags').toBe(1);
    const bullets = (carrying[0] as CommentParagraph).text
      .split('\n')
      .filter((line) => line.startsWith('- '));
    expect(bullets.length, "§4a's killed-here bullets").toBe(SECTION_4A_KILL_LIST.MUTANTS);

    const rows = MUTATION_WITNESSES.filter((witness) =>
      SECTION_4A_TAGS.includes(witness.guarantee),
    );
    expect(rows.length, 'witness rows under those two tags').toBe(SECTION_4A_KILL_LIST.ROWS);
    // ONE ROW PER MUTANT PER SERIES, so the distinct anchors are the mutants and
    // the rows are the arms. A bullet with no mutant, or a mutant with no
    // bullet, moves one side of this and not the other.
    const mutants = new Set(rows.map((witness) => `${witness.mutatedFile}::${witness.mutated}`));
    expect(mutants.size, 'distinct mutants witnessed under those tags').toBe(bullets.length);
    // AND BOTH ARMS ARE STOCKED. A tag with no row of its own would leave the
    // set equality above satisfied by the other tag alone, which is the failure
    // shape CLAUDE.md records for a guard written for one arm and not its
    // sibling. Counts, because a bound would let one arm empty out to one row.
    const perTag = SECTION_4A_TAGS.map(
      (id) => rows.filter((witness) => witness.guarantee === id).length,
    );
    expect(perTag, 'rows per tag, Training IQ then physio').toEqual([7, 4]);
  });

  it('expires a witness whose anchor has moved, on a planted one', () => {
    // ANTI-VACUITY FOR THE FRESHNESS CHECK, which is the only thing the witness
    // table actually enforces. The loop above is a set of `expect`s over real
    // data; if `mutated` were matched loosely, or the body scope were the whole
    // file, every one of them would still be green. So the same three checks are
    // driven over planted witnesses built to fail each one.
    const realFile = readFileSync(path.join(REPO_ROOT, 'src/game/streak.ts'), 'utf8');
    const realTest = readFileSync(path.join(REPO_ROOT, 'src/game/streak.test.ts'), 'utf8');

    // 1. An anchor that has been edited away resolves zero times.
    expect(realFile.split('const authoritative = renderedVerdictOnly;').length - 1).toBe(0);
    // 2. An anchor so short it matches everywhere is caught by length, and would
    //    also resolve many times.
    expect(realFile.split('const ').length - 1).toBeGreaterThan(1);
    expect('const '.length).toBeLessThan(MIN_ANCHOR_LENGTH);
    // 3. The body scope really is a scope: an assertion from a DIFFERENT test in
    //    the same file is not inside this one.
    const body = bodyOfTestDeclaring(realTest, 'completion-revalidates-against-settled-state');
    expect(body, 'the tag names no test').not.toBe(null);
    expect((body ?? '').length, 'the body scope swallowed the file').toBeLessThan(realTest.length / 2);
    expect(
      (body ?? '').includes("expect(secondSettles, 'a settled run was settled again').toBe(0)"),
      'the body scope leaked into a neighbouring test',
    ).toBe(false);
    // ...and the assertion that IS in it is found.
    expect(
      (body ?? '').includes("expect(never.refusedPurchases, 'the client that never opens').toBe(4)"),
    ).toBe(true);
  });

  it('reads comments and not code, on a sample written to break it', () => {
    // `commentParagraphs` is the entire scope of the ban below. If it leaked
    // code, an identifier would trip the ban; if it swallowed comments, the ban
    // would be silent and look green. Both are invisible from outside, so it is
    // exercised rather than trusted.
    const sample = [
      'const NEVER_EVER_ONE = 1;',
      '/**',
      ' * IT CANNOT DO THAT, and here is why.',
      ' *',
      ' * A second paragraph.',
      ' */',
      'function f() {}',
      '// IT ONLY EVER RETURNS ONE',
    ].join('\n');

    const paragraphs = commentParagraphs(sample);
    expect(paragraphs.map((p) => [p.startLine, p.text])).toEqual([
      [3, 'IT CANNOT DO THAT, and here is why.'],
      [5, 'A second paragraph.'],
      [8, 'IT ONLY EVER RETURNS ONE'],
    ]);

    // The code line is not prose, so the constant name cannot trigger anything.
    expect(paragraphs.some((p) => p.text.includes('NEVER_EVER_ONE'))).toBe(false);
    // Two of the three paragraphs assert something; the middle one does not.
    expect(paragraphs.map((p) => triggeringRuns(p.text).length > 0)).toEqual([true, false, true]);
  });

  it('bans an untagged guarantee inside the scoped files, and FIRES on a planted one', () => {
    // THE SCOPE IS PINNED, NOT DEFAULTED. Emptying the list would leave this
    // test green while scanning nothing, which is the shape of vacuous guard
    // GDD §12.2 spends a page on.
    expect([...GUARANTEE_PROSE_FILES].sort()).toEqual([
      'src/game/streak.ts',
      'src/game/streakEntitlement.ts',
    ]);

    let inScope = 0;
    for (const rel of GUARANTEE_PROSE_FILES) {
      const full = path.join(REPO_ROOT, rel);
      expect(existsSync(full), rel).toBe(true);
      const text = readFileSync(full, 'utf8');
      expect(untaggedGuarantees(rel, text), `untagged guarantees in ${rel}`).toEqual([]);

      // AND EACH FILE IS A FILE THIS CAN CATCH SOMETHING IN. Strip the tags and
      // the ban must light up — a listed file where it does not is a file with
      // no guarantee prose in it, which means the green above measured nothing.
      const detagged = text.replace(GUARANTEE_TAG, 'REMOVED');
      const wouldFire = untaggedGuarantees(rel, detagged);
      expect(
        wouldFire.length,
        `${rel} asserts no guarantee at all, so the check above is vacuous`,
      ).toBeGreaterThan(0);
      inScope += wouldFire.length;
    }

    // THE MEASURED SCOPE, PINNED EXACTLY. Moving it is a red test and a number
    // somebody reads, which is the only way the coverage claim below stays true.
    expect(inScope, 'triggering paragraphs inside the scope').toBe(GUARANTEE_COVERAGE.IN_SCOPE);

    // AND IT FIRES ON EXACTLY THE UNTAGGED PARAGRAPH, not on its tagged
    // neighbour and not on the one that asserts nothing.
    const planted = [
      '/**',
      ' * IT CAN ONLY BE CALLED ONCE, and nothing checks that.',
      ' *',
      ' * IT IS ONLY EVER CALLED TWICE. `@guarantee settling-is-a-recording`',
      ' *',
      ' * An ordinary sentence about an ordinary thing.',
      ' */',
    ].join('\n');
    const fired = untaggedGuarantees('planted.ts', planted);
    expect(fired.length, 'the ban catches the untagged paragraph and only that one').toBe(1);
    expect(fired[0]).toContain('planted.ts:2');
  });

  it('states what fraction of the tree it actually covers, and the number is real', () => {
    // THE HONESTY CHECK. The mechanism covers about a tenth of the prose a
    // scanner can see, and this is what stops that being a sentence in a report
    // nobody can re-derive. If somebody widens the scope, this number moves and
    // the comment on `GUARANTEE_COVERAGE` has to move with it.
    let treeWide = 0;
    for (const file of sourceFilesUnder(path.join(REPO_ROOT, 'src'))) {
      const text = readFileSync(file, 'utf8');
      for (const paragraph of commentParagraphs(text)) {
        if (triggeringRuns(paragraph.text).length > 0) treeWide += 1;
      }
    }
    expect(treeWide, 'triggering paragraphs under src').toBe(GUARANTEE_COVERAGE.TREE_WIDE);
    // Stated as a fraction so the honest reading is unavoidable: this catches a
    // minority of what it can see, and a minority of what it cannot see at all.
    expect(GUARANTEE_COVERAGE.IN_SCOPE / GUARANTEE_COVERAGE.TREE_WIDE).toBeLessThan(0.2);
    expect(GUARANTEE_COVERAGE.IN_SCOPE).toBeLessThan(GUARANTEE_COVERAGE.TREE_WIDE);
  });

  it('[a-cited-number-resolves-in-the-named-test] resolves the NUMBERS in a tagged claim against the body of the test it names, with the excuse list exact in both directions', () => {
    const titles = testTitlesUnder(path.join(REPO_ROOT, 'src'));
    const paragraphs: TaggedParagraph[] = [];
    for (const file of sourceFilesUnder(path.join(REPO_ROOT, 'src'))) {
      paragraphs.push(
        ...taggedParagraphsIn(path.relative(REPO_ROOT, file), readFileSync(file, 'utf8')),
      );
    }
    const audit = auditClaimedNumbers(
      paragraphs,
      (id) => bodyOfDeclaredTest(id, titles),
      UNPINNED_PROSE_NUMBERS,
    );

    // THE RULE.
    expect(
      audit.unpinned,
      'a tagged claim states a number that the test it names does not carry — pin it in that '
      + 'test, or say why it cannot be, on UNPINNED_PROSE_NUMBERS',
    ).toEqual([]);
    // AND THE OTHER DIRECTION, which is the one an allowlist rots in.
    expect(
      audit.staleExcuses,
      'an entry on UNPINNED_PROSE_NUMBERS anchors nowhere or excuses nothing',
    ).toEqual([]);

    // THE CENSUS, PINNED AS COUNTS AND NOT BOUNDS. Every one of these moves the
    // moment somebody writes a number into a tagged paragraph, which is the
    // point: the coverage claim in `NUMBER_COVERAGE` stays true or goes red.
    expect(paragraphs.length, 'tagged paragraphs under src').toBe(
      NUMBER_COVERAGE.TAGGED_PARAGRAPHS,
    );
    expect(audit.paragraphsWithNumbers, 'tagged paragraphs stating a number').toBe(
      NUMBER_COVERAGE.PARAGRAPHS_WITH_A_CLAIMED_NUMBER,
    );
    expect(audit.claimed, 'numbers this rule demands something of').toBe(NUMBER_COVERAGE.CLAIMED);
    expect(audit.resolving, 'numbers found in the named body').toBe(NUMBER_COVERAGE.RESOLVING);
    expect(
      audit.resolvingInCode,
      'numbers found in the named body with its comments blanked — the stronger reading, and '
      + 'the gap to RESOLVING is the declared weakness',
    ).toBe(NUMBER_COVERAGE.RESOLVING_IN_CODE);
    expect(audit.excusedOccurrences, 'numbers excused by name').toBe(NUMBER_COVERAGE.EXCUSED);
    expect(UNPINNED_PROSE_NUMBERS.length, 'entries doing that excusing').toBe(
      NUMBER_COVERAGE.EXCUSE_ENTRIES,
    );
    expect(audit.excluded, 'what each of the four exclusions removed').toEqual(NUMBER_EXCLUSIONS);

    // NON-VACUITY, AND IT IS NOT THE PIN ABOVE RESTATED. `resolving +
    // excusedOccurrences === claimed` holds by construction once `unpinned` is
    // empty, so writing it would have been an assertion nothing could redden;
    // it was written, noticed and deleted. What these two catch is the OTHER
    // repair — the one `empireCore.test.ts` had to be rescued from, where a
    // guard goes red and somebody re-pins it at whatever it reports now. A scan
    // that stopped seeing paragraphs reports zero, and zero is a number a
    // constant can be edited to.
    expect(
      audit.claimed,
      'no tagged paragraph states a number, so this whole check measured nothing',
    ).toBeGreaterThan(20);
    expect(paragraphs.length, 'no paragraph carries a tag').toBeGreaterThan(20);

    // THE DECLARED WEAKNESS, TAKEN RATHER THAN ASSERTED. A one-digit numeral
    // resolves against almost any body of this size, so a small number PASSING
    // this rule is weak evidence — which is a sentence on the doc comment above
    // and would otherwise be exactly the kind of unpinned figure this whole
    // file exists to distrust. Pinned here so it is re-derivable.
    const named = [...new Set(paragraphs.flatMap((paragraph) => paragraph.guarantees))]
      .map((id) => bodyOfDeclaredTest(id, titles))
      .filter((body): body is string => body !== null);
    expect(named.length, 'tag-named bodies').toBe(NUMBER_COVERAGE.NAMED_BODIES);
    expect(
      named.filter((body) => numeralOccursIn(body, '0')).length,
      'bodies holding a bare 0 — if this moved, the sentence about it moved too',
    ).toBe(NUMBER_COVERAGE.NAMED_BODIES_HOLDING_ZERO);
    expect(
      named.filter((body) => numeralOccursIn(body, '1')).length,
      'bodies holding a bare 1 — if this moved, the sentence about it moved too',
    ).toBe(NUMBER_COVERAGE.NAMED_BODIES_HOLDING_ONE);

    // AND THE OVERLAP OF THE TWO SCOPES, for the same reason: the doc comment
    // above used to describe the tagged paragraphs as a subset of the
    // triggering ones, which they are not.
    expect(
      paragraphs.filter((paragraph) => triggeringRuns(paragraph.text).length > 0).length,
      'tagged paragraphs that also trip the trigger scan',
    ).toBe(NUMBER_COVERAGE.TAGGED_AND_TRIGGERING);

    // THE SCOPER'S PREMISE, ON THE FILES THIS LEDGER SLICES — the sibling of the
    // census the witness table runs, and NOT a copy of its list: this ledger
    // reaches whatever file happens to declare a numbered tag, which is a
    // different set. Same shared `testScopeFault`, so neither can be weakened
    // without the other moving.
    const sliced = new Set<string>();
    for (const paragraph of paragraphs) {
      if (claimedNumbersIn(paragraph.text).claimed.length === 0) continue;
      for (const id of paragraph.guarantees) {
        const declaring = titles.find((title) => title.title.includes(declarationOf(id)));
        if (declaring !== undefined) sliced.add(declaring.file);
      }
    }
    for (const file of [...sliced].sort()) {
      const text = readFileSync(path.join(REPO_ROOT, file), 'utf8');
      expect(testScopeFault(text, file), 'the number ledger cannot slice this file').toBe(null);
    }
    // NON-VACUITY AS A NAMED SET RATHER THAN A BOUND, for the reason the witness
    // census gives: counting the loop's own iterations would restate the set it
    // walked. Writing a number into a tagged paragraph in a new file is a
    // one-line diff here, on purpose.
    expect([...sliced].sort(), 'the test files the number ledger slices').toEqual([
      // GDD §2.1's career spine: two tagged paragraphs, both citing the counts
      // its two monotonicity sweeps produce.
      'src/career/eligibility.test.ts',
      'src/empire/empireInvariant.test.ts',
      'src/empire/engagement.test.ts',
      'src/game/streak.test.ts',
      'src/game/streakEntitlement.test.ts',
    ]);
  });

  it('fires when a cited number is only elsewhere in the named test FILE, and stays silent when it is in the body', () => {
    // BOTH DIRECTIONS ON PLANTED DATA, through the same function the tree runs
    // through. The arrangement is the one the grant was argued from: the number
    // exists in the right file, as a DIFFERENT check's pin, twenty lines below.
    //
    // The tag is assembled rather than spelt, because the tree-wide scan reads
    // this file's whole text and a spelt id here would have to name a real test.
    const tag = `@${'guarantee'} planted-claim`;
    const violating: TaggedParagraph = {
      where: 'planted.ts:1',
      guarantees: ['planted-claim'],
      text: `THE CONTROL THIS IS ABOUT MEASURES 144 ARRIVALS. ${tag}`,
    };
    const conforming: TaggedParagraph = {
      where: 'planted.ts:9',
      guarantees: ['planted-claim'],
      text: `THE CONTROL THIS IS ABOUT MEASURES 128 ARRIVALS. ${tag}`,
    };
    // The declaration is COMPOSED rather than spelt, for the same reason the tag
    // is: three scans in this file read raw source, and a spelt declaration
    // inside a string literal is a test that does not exist as far as vitest is
    // concerned and does exist as far as they are. That is the spurious match
    // `testScopeFault` was written for, and writing it out here reddened the
    // tree-wide id equality on the first run.
    const declare = (title: string): string => `  ${'it'}('${title}', () => {`;
    const planted = [
      declare('[planted-claim] the claim the tag names'),
      '    expect(measured).toBe(128);',
      '  });',
      '',
      declare('a different check entirely, twenty lines below'),
      '    expect(somethingElse).toBe(144);',
      '  });',
    ].join('\n');
    const bodyOf = (id: string): string | null => bodyOfTestDeclaring(planted, id);

    // THE FILE-SCOPED READING WOULD HAVE PASSED THIS, asserted rather than
    // described: 144 is in the file and is not in the body.
    expect(numeralOccursIn(planted, '144'), 'the planted file does hold 144').toBe(true);
    expect(
      numeralOccursIn(bodyOf('planted-claim') ?? '', '144'),
      'the planted body does not hold 144',
    ).toBe(false);

    const fired = auditClaimedNumbers([violating], bodyOf, []);
    expect(fired.claimed, 'the violating paragraph states one number').toBe(1);
    expect(fired.unpinned.length, 'and it fires exactly once — a count, not a presence').toBe(1);
    expect(fired.unpinned[0]).toContain('cites 144');
    expect(fired.resolving, 'nothing resolved').toBe(0);

    const silent = auditClaimedNumbers([conforming], bodyOf, []);
    expect(silent.unpinned, 'the conforming paragraph does not fire').toEqual([]);
    expect(silent.claimed, 'and it is silent by resolving, not by finding nothing').toBe(1);
    expect(silent.resolving).toBe(1);
    expect(silent.resolvingInCode, 'it resolves against an assertion rather than a comment').toBe(1);

    // AND THE EXCUSE LIST IS NOT A BLANKET. An entry excuses the sentence it
    // quotes and nothing else, and an entry whose sentence is gone is stale.
    const excuse: UnpinnedProseNumber = {
      guarantee: 'planted-claim',
      phrase: 'THE CONTROL THIS IS ABOUT MEASURES 144 ARRIVALS',
      kind: 'history',
      why: 'planted',
    };
    const excused = auditClaimedNumbers([violating], bodyOf, [excuse]);
    expect(excused.unpinned, 'the quoted sentence is excused').toEqual([]);
    expect(excused.excusedOccurrences).toBe(1);
    expect(excused.staleExcuses).toEqual([]);

    const stale = auditClaimedNumbers([conforming], bodyOf, [excuse]);
    expect(stale.staleExcuses.length, 'an excuse whose sentence no longer exists is stale').toBe(1);
    expect(stale.staleExcuses[0]).toContain('occurs 0 times');

    // AND THE ARM DIRECTLY BESIDE IT, which is the one this codebase keeps
    // finding written and undriven: the same guard fails for an AMBIGUOUS
    // anchor as for a missing one, and only one of the two had been exercised.
    const twice = auditClaimedNumbers([violating, { ...violating, where: 'planted.ts:20' }], bodyOf, [
      excuse,
    ]);
    expect(twice.staleExcuses.length, 'an excuse that could be about either of two sentences').toBe(
      1,
    );
    expect(twice.staleExcuses[0]).toContain('occurs 2 times');
    expect(twice.unpinned.length, 'and while it is ambiguous it excuses neither').toBe(2);

    const tooShort = auditClaimedNumbers([violating], bodyOf, [{ ...excuse, phrase: 'MEASURES 144' }]);
    expect(tooShort.staleExcuses.length, 'an anchor too short to be a sentence').toBe(1);
    expect(tooShort.unpinned.length, 'and it excuses nothing while it is short').toBe(1);
  });

  it('counts a number stated as prose, and not one in a section coordinate, an identifier, quoted code or a list ordinal', () => {
    // THE EXCLUSIONS, DRIVEN. Each of the four is written into one sample line
    // beside a number that must survive it, so an exclusion that widened to
    // swallow real prose shows up as a missing entry rather than as a quieter
    // tree-wide count.
    const sample = [
      '3. GDD §12.3 says an e1RM of 4a is not a thing.',
      'It waits 180ms and charges `max(0, len - grace)`, which is 1 thing.',
      'The span `673` holds a number and not code.',
    ].join('\n');
    const numbers = claimedNumbersIn(sample);
    expect(numbers.claimed.map((claim) => claim.numeral)).toEqual(['180', '1', '673']);
    expect(numbers.excluded).toEqual({
      'section-coordinate': 1,
      'inside-an-identifier': 2,
      'quoted-code': 1,
      'list-ordinal': 1,
    });

    // A NUMBER IS NOT A SUBSTRING OF ANOTHER NUMBER, which is how a loose
    // `includes` would report a claim as pinned by an unrelated decimal.
    expect(numeralOccursIn('expect(kg).toBe(212.5);', '212')).toBe(false);
    expect(numeralOccursIn('expect(kg).toBe(212.5);', '212.5')).toBe(true);
    expect(numeralOccursIn('expect(pairs).toBe(24576);', '24,576')).toBe(true);
    expect(numeralOccursIn('expect(pairs).toBe(1051);', '105')).toBe(false);
  });
});
