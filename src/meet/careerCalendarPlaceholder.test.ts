/**
 * careerCalendarPlaceholder.test.ts — THE PLACEHOLDER IS TEMPORARY, AND THIS IS
 * WHAT MAKES THAT A CHECKED CLAIM RATHER THAN A WORD IN A COMMENT.
 *
 * ===========================================================================
 * TWO DIFFERENT FAILURES, AND THEY NEED DIFFERENT CHECKS
 * ===========================================================================
 *
 *   1. FORGOTTEN. The placeholder outlives the reason for it and nobody can
 *      find it from the document that owes it. Answered by the TWO-WAY PIN:
 *      `CAREER_CALENDAR_GATE` must occur in `docs/GDD.md` §6.1 AND in
 *      `careerCalendarPlaceholder.ts`. Delete either end and this file reddens.
 *      The idiom is `src/licensing/realIp.ts`'s `REVIEWABLE_CITATIONS` — a
 *      pinned row naming a file and what must be found in it — not a third
 *      dialect invented here.
 *
 *   2. QUIETLY EXPANDED. A later pass grows the stopgap into real calendar
 *      logic and leaves the "temporary" label on. Answered by THE BOUND below.
 *
 * ===========================================================================
 * THE BOUND: WHAT IT CATCHES
 * ===========================================================================
 * Three structural properties of the two placeholder files, each chosen because
 * it can actually be enforced rather than because it sounds complete:
 *
 *   (a) EVERY IMPORT IN THE MODULE IS `import type`. A file that imports no
 *       values can call nothing: no clock, no `ServerRecord`, no meet history,
 *       no port. This is the strongest of the three and the cheapest to check.
 *
 *   (b) THE EXPORT SURFACE IS EXACTLY THE PINNED LIST. (a) alone does not stop
 *       scheduling, and that is worth saying plainly: pure date arithmetic
 *       needs no imports at all, so `nextMeetDay(day: number): number` would
 *       walk straight past (a). It does not walk past this — a new export is a
 *       new entry point and the list is exact in both directions.
 *
 *   (c) A CODE-LINE CEILING on both files, comments and blanks excluded. (b)
 *       bounds new entry points; this bounds growth inside the ones that exist.
 *
 *   (d) THE VIEW TAKES NO PROPS — an empty `()` parameter list, checked
 *       textually. Nothing can be handed to it, so no caller can feed it a
 *       date, an eligibility verdict or a meet history to draw. Textual and not
 *       type-level on purpose: an OPTIONAL prop does not break assignability to
 *       `(props: Record<string, never>) => ...`, so a type check alone would
 *       pass one.
 *
 * ===========================================================================
 * THE BOUND: WHAT IT CANNOT CATCH
 * ===========================================================================
 * Stated because a bound that implies completeness is worse than a narrow one
 * that declares its edges.
 *
 *   - IT DOES NOT REACH `MeetScreen.tsx`. The gate is called from there with
 *     arguments that file computes. Scheduling logic written in `MeetScreen`
 *     and funnelled into the `hasRecap` boolean is invisible to every check
 *     here. Bounding `MeetScreen` was rejected: it is a 300-line router that
 *     legitimately touches meet state, so any ban wide enough to catch calendar
 *     logic there would be suppressed within a wave.
 *   - IT CANNOT STOP DELETION. Anyone may delete this file along with the thing
 *     it guards. The pin makes that a diff across two files with the reason
 *     written next to it, which is the most a test can do about it.
 *   - IT DOES NOT READ MEANING. Comments, identifiers and string contents are
 *     unchecked. A constant named `NEXT_MEET_DATE` holding a string passes (b)
 *     if it is not exported and (c) if it fits.
 *   - IT SAYS NOTHING ABOUT WHETHER THE COPY IS TRUE. The line was ruled by a
 *     human and is shipped verbatim; `careerCalendarPlaceholder.ts` records the
 *     one reservation about it. A test cannot settle copy.
 *
 * NON-VACUITY IS CHECKED, NOT ASSUMED. Every parser here is run against a
 * planted fixture that it must REJECT, and against the real file that it must
 * ACCEPT. A parser that has quietly stopped matching passes every file, which is
 * a failure mode this repository has hit three times.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { finalMeetTotal } from '../game/meet';
import { meetResultProposal } from '../game/meetDay';
import { playMeet } from '../game/meetPreview';
import { applyMeetResult } from '../game/meetServer';
import { newServerRecord } from '../game/sessionServer';
import { MEET_LOCAL } from '../game/meetTuning';
import {
  CAREER_CALENDAR_GATE,
  CAREER_CALENDAR_PLACEHOLDER_COPY,
  PLACEHOLDER_PHASE,
  PLACEHOLDER_REFUSAL,
  showsCareerCalendarPlaceholder,
} from './careerCalendarPlaceholder';

const MODULE_PATH = fileURLToPath(new URL('./careerCalendarPlaceholder.ts', import.meta.url));
const VIEW_PATH = fileURLToPath(new URL('./CareerCalendarPlaceholderView.tsx', import.meta.url));
const SCREEN_PATH = fileURLToPath(new URL('./MeetScreen.tsx', import.meta.url));
const GDD_PATH = fileURLToPath(new URL('../../docs/GDD.md', import.meta.url));

const MODULE_SOURCE = readFileSync(MODULE_PATH, 'utf8');
const VIEW_SOURCE = readFileSync(VIEW_PATH, 'utf8');
const SCREEN_SOURCE = readFileSync(SCREEN_PATH, 'utf8');
const GDD_SOURCE = readFileSync(GDD_PATH, 'utf8');

// ---------------------------------------------------------------------------
// The bound's constants — one place, as CLAUDE.md asks of every tuned value.
// ---------------------------------------------------------------------------

/**
 * THE EXACT EXPORT SURFACE of the placeholder module. Exact in both directions:
 * a new export fails, and so does deleting one without editing this list.
 */
const ALLOWED_MODULE_EXPORTS: readonly string[] = [
  'CAREER_CALENDAR_GATE',
  'CAREER_CALENDAR_PLACEHOLDER_COPY',
  'PLACEHOLDER_PHASE',
  'PLACEHOLDER_REFUSAL',
  'showsCareerCalendarPlaceholder',
];

/** The view exports the component and nothing else. */
const ALLOWED_VIEW_EXPORTS: readonly string[] = ['CareerCalendarPlaceholderView'];

/**
 * Code lines (comments and blanks excluded) each placeholder file may hold.
 *
 * SET WITH LITTLE HEADROOM ON PURPOSE. Measured at declaration: 21 and 30. A
 * ceiling generous enough never to be inconvenient is a ceiling that never
 * catches the growth it exists to catch — so raising it is meant to be a diff
 * somebody writes deliberately, next to this sentence.
 */
const CODE_LINE_CEILING = Object.freeze({ MODULE: 28, VIEW: 36 });

/** Below this, a "check" for a substring is matching noise rather than a pin. */
const MIN_PIN_LENGTH = 12;

// ---------------------------------------------------------------------------
// Parsers, each paired with a fixture below
// ---------------------------------------------------------------------------

/** Source with comments and string/template literals removed. */
function codeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

/** Every `import ... from '...'` statement, as written, comments stripped. */
function importStatements(text: string): readonly string[] {
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');
  return [...withoutComments.matchAll(/^\s*import\b[\s\S]*?from\s*['"][^'"]+['"]/gm)].map((m) => m[0].trim());
}

/** The module specifier of an import statement. */
function specifierOf(statement: string): string {
  return /from\s*['"]([^'"]+)['"]/.exec(statement)?.[1] ?? '';
}

/** Top-level `export`ed names: `export const X`, `export function X`. */
function exportedNames(text: string): readonly string[] {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');
  return [
    ...code.matchAll(/^export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/gm),
  ]
    .map((m) => m[1] ?? '')
    .sort();
}

/** Lines that are neither blank nor comment-only, and outside block comments. */
function codeLineCount(text: string): number {
  let inBlock = false;
  let count = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (inBlock) {
      if (line.includes('*/')) inBlock = false;
      continue;
    }
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlock = true;
      continue;
    }
    if (line === '' || line.startsWith('//')) continue;
    count += 1;
  }
  return count;
}

/** The `### 6.1 ...` section of the GDD, up to the next `### `. */
function gddSection61(text: string): string | null {
  const from = text.indexOf('### 6.1');
  if (from < 0) return null;
  const rest = text.slice(from + 1);
  const to = rest.indexOf('\n### ');
  return to < 0 ? rest : rest.slice(0, to);
}

// ---------------------------------------------------------------------------

describe('the placeholder recap stands in for a calendar that does not exist', () => {
  it('reproduces the refusal it exists for: the second meet of an app run', () => {
    // THE DEFECT, END TO END, ON THE REAL SERVER. Not a hand-built fixture —
    // two meets are actually played through the engine against ONE row, which
    // is what one `ServerRecord` behind one port made reachable.
    const played1 = playMeet(() => 'perfect');
    const proposal1 = meetResultProposal(played1);
    expect(proposal1, 'a played meet proposes a result').not.toBeNull();
    if (proposal1 === null) throw new Error('unreachable');

    const first = applyMeetResult(newServerRecord(1), 10, MEET_LOCAL, proposal1, 'p-1');
    expect(first.ok, 'the FIRST meet of an app run is recorded').toBe(true);
    if (!first.ok) throw new Error(first.error.message);
    expect(first.value.totalKg, 'and it banks the total the engine played').toBe(
      finalMeetTotal(played1.meet),
    );

    const played2 = playMeet(() => 'perfect');
    const proposal2 = meetResultProposal(played2);
    if (proposal2 === null) throw new Error('unreachable');
    // The two meets report the SAME id, which is the whole cause: `meetIdFor`
    // reads the definition and `MEET_LOCAL` is a single dated event.
    expect(proposal2.report.meetId, 'the second meet reports the same meet id').toBe(
      proposal1.report.meetId,
    );

    const second = applyMeetResult(first.value.record, 11, MEET_LOCAL, proposal2, 'p-2');
    expect(second.ok, 'the SECOND meet of an app run is refused').toBe(false);
    if (second.ok) throw new Error('unreachable');
    expect(second.error.code, 'and refused as already recorded').toBe('MEET_ALREADY_RECORDED');

    // AND THAT IS EXACTLY THE STATE THE PLACEHOLDER CLAIMS. `useMeetDay` sets
    // `applied` only on success and derives `recap` from it, so a refusal leaves
    // the beat on `'recap'` with no recap object at all.
    expect(
      showsCareerCalendarPlaceholder('recap', false, second.error.code),
      'so the placeholder is the screen for it',
    ).toBe(true);
  });

  it('shows on that refusal and on nothing else', () => {
    expect(showsCareerCalendarPlaceholder(PLACEHOLDER_PHASE, false, PLACEHOLDER_REFUSAL)).toBe(true);

    // A recap that BUILT is the real recap, refusal or not.
    expect(
      showsCareerCalendarPlaceholder(PLACEHOLDER_PHASE, true, PLACEHOLDER_REFUSAL),
      'a built recap wins over the placeholder',
    ).toBe(false);

    // The request still in flight is not a missing calendar.
    expect(
      showsCareerCalendarPlaceholder(PLACEHOLDER_PHASE, false, null),
      'an in-flight submission keeps the eyebrow',
    ).toBe(false);

    // EVERY OTHER REFUSAL IS A BUG, AND THIS SENTENCE WOULD BE A LIE ON IT.
    for (const other of [
      'MEET_REPLAY_REFUSED',
      'MEET_INCOMPLETE',
      'MEET_OVERRUN',
      'MEET_ID_MISMATCH',
      'UNSUPPORTED_MEET_UNIT',
      'MALFORMED_READING',
      'BAD_DAY',
    ] as const) {
      expect(
        showsCareerCalendarPlaceholder(PLACEHOLDER_PHASE, false, other),
        `${other} is a bug, not a missing calendar — it must not claim the meet was recorded`,
      ).toBe(false);
    }

    // And not on any beat but the one the shell draws a way out over.
    for (const beat of ['weigh-in', 'openers', 'walkout', 'lift', 'verdict', 'bombed'] as const) {
      expect(
        showsCareerCalendarPlaceholder(beat, false, PLACEHOLDER_REFUSAL),
        `the placeholder must not appear on the ${beat} beat`,
      ).toBe(false);
    }
  });

  it('says the one line it was ruled to say, and is reachable from the screen', () => {
    expect(CAREER_CALENDAR_PLACEHOLDER_COPY.LINE).toBe(
      'Meet complete — results saved to your last recorded meet. Career calendar coming soon.',
    );

    // REACHABLE. A placeholder nothing renders is not a fix.
    expect(
      SCREEN_SOURCE.includes('<CareerCalendarPlaceholderView />'),
      'MeetScreen.tsx must actually render the placeholder',
    ).toBe(true);
    expect(
      SCREEN_SOURCE.includes('showsCareerCalendarPlaceholder('),
      'MeetScreen.tsx must gate it on the placeholder module’s own predicate',
    ).toBe(true);
    // And the view carries the id a browser check can find it by.
    expect(VIEW_SOURCE.includes("testID=\"meet-recap-placeholder\""), 'the view carries a testID').toBe(
      true,
    );
  });
});

describe('the placeholder is pinned to the document that owes it', () => {
  it('names the same gate id in the module and in GDD §6.1, in both directions', () => {
    expect(CAREER_CALENDAR_GATE.length, 'the pin is long enough to be a pin').toBeGreaterThan(
      MIN_PIN_LENGTH,
    );

    // DIRECTION 1 — THE CODE POINTS AT THE DOCUMENT.
    //
    // NOT `MODULE_SOURCE.includes(CAREER_CALENDAR_GATE)`. That was the first
    // version of this line and it is a NO-OP: the constant is declared in that
    // file from a literal, so the file necessarily contains its own value and
    // the assertion cannot fail. Mutation-tested and confirmed — renaming the id
    // reddened Direction 2 below and left that line green, which is the whole
    // reason it is gone.
    //
    // What has content is that the code cites the SECTION that owes it, so a
    // reader who opens the module lands on the document. Delete the citation and
    // this reddens.
    for (const cite of ['GDD §6.1', 'TEMPORARY SCAFFOLDING']) {
      expect(
        MODULE_SOURCE.includes(cite),
        `careerCalendarPlaceholder.ts must say "${cite}" — a scaffold that does not name the ` +
          'section that replaces it is a scaffold nobody finds from the document',
      ).toBe(true);
      expect(
        VIEW_SOURCE.includes(cite),
        `CareerCalendarPlaceholderView.tsx must say "${cite}"`,
      ).toBe(true);
    }

    // DIRECTION 2 — the document end, and in §6.1 specifically rather than
    // anywhere in a 2500-line file. Delete the TODO and this reddens.
    const section = gddSection61(GDD_SOURCE);
    expect(section, 'docs/GDD.md still has a §6.1 section to pin to').not.toBe(null);
    expect(
      (section ?? '').includes(CAREER_CALENDAR_GATE),
      `docs/GDD.md §6.1 must carry the TODO naming "${CAREER_CALENDAR_GATE}" — the placeholder is ` +
        'scaffolding and the section that replaces it has to point at it',
    ).toBe(true);

    // The document must also name the files, so the TODO leads somewhere.
    for (const named of [
      'src/meet/careerCalendarPlaceholder.ts',
      'src/meet/CareerCalendarPlaceholderView.tsx',
      'src/meet/careerCalendarPlaceholder.test.ts',
    ]) {
      expect((section ?? '').includes(named), `GDD §6.1's TODO must name ${named}`).toBe(true);
    }

    // NON-VACUITY FOR THE SECTION PARSER. It must find a real §6.1 with real
    // content, and must report a document that has none as having none — the
    // "parser read a real value as missing" failure, in the other direction.
    expect((section ?? '').length, 'the §6.1 parser found real content').toBeGreaterThan(200);
    expect((section ?? '').includes('### 6.2'), 'and stopped before the next section').toBe(false);
    expect(gddSection61('# A document with no meet-day section\n\nnothing here.\n')).toBe(null);
  });
});

describe('the placeholder cannot quietly grow into calendar logic', () => {
  // ONE `it` CARRIES THE TAG, because `guaranteeTags.test.ts` resolves a
  // `@guarantee` to exactly one test and requires a witness's red assertion to
  // sit inside that test's body. The four parts of the bound are therefore one
  // test rather than four; the parsers' non-vacuity fixtures are the test below,
  // which deliberately does NOT carry the tag.
  it('bounds the placeholder to a line and a predicate [placeholder-cannot-grow-calendar-authority]', () => {
    // --- (a) IMPORTS ONLY TYPES, so it can call nothing ---------------------
    const imports = importStatements(MODULE_SOURCE);
    expect(imports.length, 'imports found in the placeholder module').toBeGreaterThan(1);
    expect(
      imports.map(specifierOf).sort(),
      'the placeholder module reaches for a module it did not before',
    ).toEqual(['../game/meetDay', '../game/meetServer']);

    for (const statement of imports) {
      expect(
        /^import\s+type\b/.test(statement),
        `careerCalendarPlaceholder.ts may only "import type" — "${statement.replace(/\s+/g, ' ')}" ` +
          'imports a value, which is how a placeholder acquires a clock, a row or a meet history',
      ).toBe(true);
    }

    // --- (b) EXPORTS EXACTLY THE PINNED SURFACE -----------------------------
    // Exact both ways. A new export is a new entry point, and this is the check
    // that actually catches scheduling: `nextMeetDay(day: number): number` needs
    // no import at all and would sail past (a).
    expect(
      exportedNames(MODULE_SOURCE),
      'the placeholder module grew or lost an export — if it grew one, that is the thing ' +
        'this bound exists to catch',
    ).toEqual([...ALLOWED_MODULE_EXPORTS].sort());
    expect(exportedNames(VIEW_SOURCE), 'the placeholder view grew or lost an export').toEqual(
      [...ALLOWED_VIEW_EXPORTS].sort(),
    );

    // --- (c) THE VIEW TAKES NO PROPS ---------------------------------------
    expect(
      VIEW_SOURCE.includes('export function CareerCalendarPlaceholderView(): React.ReactElement {'),
      'the view must take an EMPTY parameter list — a prop is how a caller feeds a placeholder ' +
        'a date, an eligibility verdict or a meet history',
    ).toBe(true);

    // --- (d) CODE-LINE CEILING ---------------------------------------------
    const moduleLines = codeLineCount(MODULE_SOURCE);
    const viewLines = codeLineCount(VIEW_SOURCE);
    expect(
      moduleLines,
      `careerCalendarPlaceholder.ts is ${moduleLines} code lines, ceiling ${CODE_LINE_CEILING.MODULE} — ` +
        'a stopgap that needs more code than this is not a stopgap',
    ).toBeLessThanOrEqual(CODE_LINE_CEILING.MODULE);
    expect(
      viewLines,
      `CareerCalendarPlaceholderView.tsx is ${viewLines} code lines, ceiling ${CODE_LINE_CEILING.VIEW}`,
    ).toBeLessThanOrEqual(CODE_LINE_CEILING.VIEW);
    expect(moduleLines, 'the counter found real code in the module').toBeGreaterThan(5);
    expect(viewLines, 'the counter found real code in the view').toBeGreaterThan(5);
  });

  it('has parsers that reject a planted violation rather than matching nothing', () => {
    // NON-VACUITY FOR ALL THREE PARSERS. A regex that has quietly stopped
    // matching passes every file it is pointed at, which is how a check becomes
    // decoration. Each fixture is the violation the real check is looking for.

    // A value import among type imports is SEEN and is not type-only.
    const planted = importStatements(
      "import type { A } from './a';\nimport { readFileSync } from 'node:fs';\n",
    );
    expect(planted.length, 'the import parser sees both statements').toBe(2);
    expect(
      planted.filter((s) => /^import\s+type\b/.test(s)).length,
      'and classifies exactly one of them as type-only',
    ).toBe(1);

    // An added export is FOUND, and a non-exported declaration is not.
    expect(
      exportedNames('export const A = 1;\nexport function nextMeetDay() {}\nconst B = 2;\n'),
      'the export parser finds an added entry point and ignores a private one',
    ).toEqual(['A', 'nextMeetDay']);

    // The line counter counts code and not prose, in both directions — so a
    // file cannot bust the ceiling by being well documented, nor slip under it
    // by hiding logic in a comment.
    expect(
      codeLineCount('/**\n * all\n * comment\n */\n\n// and a line comment\nconst a = 1;\n'),
      'the line counter ignores comments and blanks',
    ).toBe(1);
  });
});
