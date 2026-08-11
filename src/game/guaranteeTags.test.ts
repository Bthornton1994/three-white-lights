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
  TREE_WIDE: 229,
} as const;

// ---------------------------------------------------------------------------
// The NUMBERS a tagged claim cites
// ---------------------------------------------------------------------------

/**
 * A TAG THAT RESOLVES SAYS NOTHING ABOUT THE NUMBERS IN THE SENTENCE AROUND IT,
 * and that is a third way a true-sounding claim survives a green suite.
 *
 * MEASURED TWICE IN `src/empire/`, both on prose that carried a tag: a comment
 * read "zero of 120 physio arrival days" while its named check pinned a
 * different denominator, and another read "32 of 144" while its own body pinned
 * something else again. Both tags resolved. Both sentences kept their confident
 * tone after the number moved, which is this file's whole subject one level in.
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
 *     tree, `0` occurs in 78% of them and `1` in 87%, so those two resolve
 *     almost wherever they are pointed. The rule still requires them — "0
 *     violating pairs" is the most load-bearing number in this repository and
 *     exempting it would gut the check — but a small numeral passing is weak
 *     evidence and one of the entries in `UNPINNED_PROSE_NUMBERS` records a
 *     sentence whose twin passes for exactly that reason.
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
 * Taken over the tagged paragraphs in `src`, where the raw numeral scan finds
 * forty-nine occurrences and thirty survive these four:
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
  'section-coordinate': 14,
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
      'The superseded denominator. The live one (50) resolves three times in the '
      + 'named body; this is the value it moved FROM, recorded so the drift is '
      + 'legible. A sentence about what a number used to be cannot be pinned by a '
      + 'test that measures what it is now. NOTE ALSO that src/empire/** belongs to '
      + 'the other session, so this entry is the only move available here.',
  },
  {
    guarantee: 'doomed-absence-takes-what-is-left',
    phrase: 'the half that survived the Option 1 rework',
    kind: 'document-coordinate',
    why:
      "GDD §4.2's Option 1 — a pointer into the design document, spelt without the "
      + 'section mark, so the `section-coordinate` exclusion does not see it. Worth '
      + 'recording rather than generalising into a vocabulary: the SAME phrase in '
      + "`mid-absence-arrival-cannot-arm`'s paragraph resolves and needs no entry, "
      + 'because a `1` happens to appear in that test body. Two identical claims, '
      + 'one listed and one not, is what the 87% figure above looks like in the wild.',
  },
  {
    guarantee: 'doomed-absence-takes-what-is-left',
    phrase: 'and 673 at 100, against 0 with it',
    kind: 'unpinned-measurement',
    why:
      'THE ONE ENTRY HERE THAT IS A REAL GAP RATHER THAN A CATEGORY ERROR. The '
      + 'named test carries the 60-day half of this counterfactual in its own '
      + 'comment and not the 100-day half; 673 is pinned by no assertion anywhere '
      + 'in src, only re-stated in streakEntitlement.ts, streakEntitlement.test.ts '
      + 'and GDD §4.4. Listed rather than fixed because re-taking a counterfactual '
      + 'sweep is not this piece, and marked so it reads as debt.',
  },
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
 * Read together they say: the tag scan sees 227 triggering paragraphs, 58 of
 * them carry a tag, 8 of those state a number in prose, and 30 numerals are
 * therefore checked at all. That is about 3% of the prose this file can see and
 * none of the prose it cannot.
 */
const NUMBER_COVERAGE = {
  /** Comment paragraphs under `src` carrying at least one tag. */
  TAGGED_PARAGRAPHS: 58,
  /** ...of which this many state a number as prose. */
  PARAGRAPHS_WITH_A_CLAIMED_NUMBER: 8,
  /** Numerals the rule actually demands something of. */
  CLAIMED: 30,
  /** ...of which this many are found in the named test's body. */
  RESOLVING: 18,
  /**
   * ...and this many survive blanking the body's COMMENTS, which is the
   * stronger reading. The gap is the weakness declared above, as a number.
   */
  RESOLVING_IN_CODE: 12,
  /** ...and this many are excused by name, in `UNPINNED_PROSE_NUMBERS`. */
  EXCUSED: 12,
  /** The entries doing that excusing. Fewer than the occurrences: a phrase may span two. */
  EXCUSE_ENTRIES: 7,
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
 * WHAT IT RECORDS. Two verbatim anchors and one quoted line:
 *
 *   - `mutated` — the exact text the mutant replaced, in `mutatedFile`.
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
 * red, because that is the method. Copy the line you broke, copy the assertion
 * vitest named, paste the message. Under a minute on top of work already done.
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
  /** Repo-relative path of the test file holding the assertion that reddened. */
  readonly testFile: string;
  /** Verbatim text of that assertion. Must still occur inside the named test. */
  readonly redAssertion: string;
  /** What the red run printed. Evidence for a reader; not machine-checked. */
  readonly observed: string;
}

/**
 * Below this length an anchor is not an anchor. A three-character `mutated`
 * would resolve against half the file and expire against nothing.
 */
const MIN_ANCHOR_LENGTH = 24;

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
const MUTATION_WITNESSES: readonly MutationWitness[] = [
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
    guarantee: 'a-cited-number-resolves-in-the-named-test',
    mutatedFile: 'src/tuning/audit.ts',
    mutated: '    if (body.includes(marker)) return body;',
    testFile: 'src/game/guaranteeTags.test.ts',
    redAssertion:
      "      audit.staleExcuses,\n      'an entry on UNPINNED_PROSE_NUMBERS anchors nowhere or excuses nothing',\n    ).toEqual([]);",
    observed:
      'AssertionError: an entry on UNPINNED_PROSE_NUMBERS anchors nowhere or excuses nothing: '
      + 'expected [ …(6) ] to deeply equal [] — received "section-4a-denominator-is-measured: '
      + '\\"It read 49 before §4c\'s day-anchor block added a check\\" excuses nothing any more", '
      + 'and five more naming the Option 1 rework, both milestone counterfactuals and the '
      + 'window-boundary illustration',
  },
  {
    // (2) THE DEFECT ITSELF, PUT INTO PROSE. The mutant moves one digit of a
    // measurement in a tagged paragraph — `785` to `786` — which is exactly how
    // the two `src/empire/` instances happened: the sentence stayed confident
    // and the number stopped being the one the check pins. The anchor is the
    // prose line, so this witness expires when that sentence is rewritten,
    // which is the correct coupling for a claim about a sentence.
    guarantee: 'a-cited-number-resolves-in-the-named-test',
    mutatedFile: 'src/game/streak.ts',
    mutated: " * lifter's training moved — measured at 105 / 305 / 733 / 785 violating pairs",
    testFile: 'src/game/guaranteeTags.test.ts',
    redAssertion:
      "      audit.unpinned,\n      'a tagged claim states a number that the test it names does not carry — pin it in that '",
    observed:
      'AssertionError: a tagged claim states a number that the test it names does not carry — '
      + 'pin it in that test, or say why it cannot be, on UNPINNED_PROSE_NUMBERS: expected '
      + '[ Array(1) ] to deeply equal [] — received [ "src/game/streak.ts:2567 '
      + '[no-tender-arrives-by-training] cites 786, which is not in the body of the test the tag '
      + 'names — \\"…measured at 105 / 305 / 733 / [786] violating pairs against 0 for…\\"" ]',
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
    observed:
      "§4a's denominator is this file's own check count" +
      ' [section-4a-denominator-is-measured]\n' +
      'AssertionError: expected 43 to be 50 // Object.is equality',
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
  },
  {
    // The mutant turned the placeholder's one type-only import into a VALUE
    // import — the exact move by which a "temporary" scaffold acquires a clock,
    // a row or a meet history, and the thing the bound exists to make loud.
    // Taken with three others on the same run: adding an export (`nextMeetDay`)
    // reddens the export-surface equality, giving the placeholder a prop reddens
    // the empty-parameter-list check, and broadening the gate to any refusal
    // reddens the per-error-code loop in the sibling test.
    guarantee: 'placeholder-cannot-grow-calendar-authority',
    mutatedFile: 'src/meet/careerCalendarPlaceholder.ts',
    mutated: "import type { MeetDayPhaseId } from '../game/meetDay';",
    testFile: 'src/meet/careerCalendarPlaceholder.test.ts',
    redAssertion: 'imports a value, which is how a placeholder acquires a clock, a row or a meet history',
    observed:
      'AssertionError: careerCalendarPlaceholder.ts may only "import type" — "import { type ' +
      "MeetDayPhaseId, meetIdFor } from '../game/meetDay'\" imports a value, which is how a " +
      'placeholder acquires a clock, a row or a meet history: expected false to be true',
  },
  {
    guarantee: 'settling-is-terminal',
    mutatedFile: 'src/game/streak.ts',
    mutated: "return fail('NOTHING_TO_SETTLE', 'There is no streak running, so there is nothing to settle.');",
    testFile: 'src/game/streak.test.ts',
    redAssertion: "expect(secondSettles, 'a settled run was settled again').toBe(0)",
    observed: 'AssertionError: a settled run was settled again: expected 500544 to be +0',
  },
  {
    guarantee: 'a-sale-never-follows-a-settle',
    mutatedFile: 'src/game/streak.ts',
    mutated: '    lastTrainedDay: null,\n  };\n}',
    testFile: 'src/game/streak.test.ts',
    redAssertion: 'sold on a day whose run had already ended',
    observed: 'Error: offset 16 armed mask 512 day +5: sold on a day whose run had already ended',
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
    guarantee: 'the-covered-day-scan-reads-the-whole-tree',
    mutatedFile: 'src/game/streakEntitlement.test.ts',
    mutated:
      '  NAMES_A_COVERED_DAY_OR_A_PURCHASE: /purchas|covered.?day|window-entitlement/i,',
    testFile: 'src/game/streakEntitlement.test.ts',
    redAssertion:
      'expect(found.names, drift).toEqual([...COVERED_DAY_TOUCHING_FUNCTIONS].sort());',
    observed:
      'AssertionError: allowlist entries no declaration matches any more: AbsenceOutcome, ' +
      'CoveredDayCreditOutcome, CoveredDayTender, DOOMED_SALE_REFUSAL_MESSAGE, DOOMED_SALE_SWEEP, ' +
      'DayOpening, EMPIRE_FORBIDDEN_OUTPUTS, EntitlementTuning, GatingOfTender, ' +
      'LONGEST_REPAIRABLE_ABSENCE_DAYS, MAX_COVERED_DAYS_ONE_ABSENCE_MAY_DRAW, … 31 in all: ' +
      "expected [ 'ACCELERANT_ARRIVAL', …(56) ] to deeply equal [ 'ACCELERANT_ARRIVAL', …(87) ]",
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
      expect(witness.observed.length, `${where}: records no failure message`).toBeGreaterThan(
        MIN_ANCHOR_LENGTH,
      );

      expect(witness.mutated.length, `${where}: the mutated anchor is too short to anchor`).toBeGreaterThan(
        MIN_ANCHOR_LENGTH,
      );
      const mutatedPath = path.join(REPO_ROOT, witness.mutatedFile);
      expect(existsSync(mutatedPath), `${where}: ${witness.mutatedFile}`).toBe(true);
      const mutatedText = readFileSync(mutatedPath, 'utf8');
      expect(
        mutatedText.split(witness.mutated).length - 1,
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
      'src/meet/AttemptSelectView.test.ts',
      'src/meet/careerCalendarPlaceholder.test.ts',
      'src/meet/meetSound.test.ts',
      'src/meet/meetStage.test.ts',
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
    // Nothing falls between the two: a number is in a body or it is on the list.
    expect(audit.resolving + audit.excusedOccurrences, 'every claimed number is accounted for').toBe(
      audit.claimed,
    );

    // NON-VACUITY, AS A COUNT OF WHAT WAS ACTUALLY SEEN. A scan that found no
    // tagged paragraph, or found them and read no numeral out of them, passes
    // every assertion above by having nothing to disagree with.
    expect(
      audit.claimed,
      'no tagged paragraph states a number, so this whole check measured nothing',
    ).toBeGreaterThan(20);
    expect(paragraphs.length, 'no paragraph carries a tag').toBeGreaterThan(20);

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
      'src/empire/empireInvariant.test.ts',
      'src/empire/engagement.test.ts',
      'src/game/streak.test.ts',
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
