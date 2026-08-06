import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

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
  IN_SCOPE: 20,
  /**
   * Triggering paragraphs anywhere under `src`, the scoped ones included.
   *
   * It counts this file's own prose too, which is correct rather than an
   * artefact: these comments assert behaviour about the scanner and are exactly
   * as capable of being wrong as any other.
   */
  TREE_WIDE: 189,
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
 * All four below were taken by hand on the run that added them: break it, watch
 * it fail, read the message, restore, confirm green.
 */
const MUTATION_WITNESSES: readonly MutationWitness[] = [
  {
    guarantee: 'completion-revalidates-against-settled-state',
    mutatedFile: 'src/game/streak.ts',
    mutated: 'revalidated.runRecordedAsEndedOn === null ? rendered : absenceOutcome(revalidated.state, day)',
    testFile: 'src/game/streak.test.ts',
    redAssertion: "expect(never.refusedPurchases, 'the client that never opens').toBe(4)",
    observed: 'AssertionError: the client that never opens: expected 3 to be 4',
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
];

/**
 * The source of the test whose title declares `id`, from `\`it(\`` to the next
 * `\`it(\`` — enough to say whether an assertion is inside it rather than
 * somewhere else in a six-thousand-line file.
 */
function bodyOfTestDeclaring(text: string, id: string): string | null {
  const marker = declarationOf(id);
  const starts: number[] = [];
  for (const match of text.matchAll(/\bit\s*\(/g)) starts.push(match.index ?? 0);
  for (let i = 0; i < starts.length; i += 1) {
    const from = starts[i] as number;
    const to = i + 1 < starts.length ? (starts[i + 1] as number) : text.length;
    const body = text.slice(from, to);
    if (body.includes(marker)) return body;
  }
  return null;
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
});
