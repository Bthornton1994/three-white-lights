/**
 * careerCore.test.ts — the Career calendar, and the three seams around it.
 *
 * Three of the blocks below are about the directory rather than about a
 * function, and they are here rather than in a lint config because each one is
 * a property this piece was built to have and would lose silently:
 *
 *   - it imports nothing outside itself, so `src/game/progression.ts` — the
 *     most-edited file in the repository — is unreachable from here;
 *   - `CareerMeetDraft` still has the same field names as the real
 *     `MeetDefinition` it deliberately mirrors;
 *   - no string this directory ships is a real federation, athlete or brand,
 *     checked against `src/licensing/realIp.ts`'s own watchlist.
 *
 * Every check names, in place, the edit to a SUBJECT module that reddens it.
 * Where a check cannot be reddened by any edit to its subject it has been
 * deleted rather than kept as decoration; where the compiler gets there first,
 * the comment says so instead of implying the assertion is the guard.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { SOURCE_RULES, auditSource, formatFindings } from '../tuning/audit';
import { REAL_IP_WATCHLIST, findWatchedNames } from '../licensing/realIp';
import { CAREER_TUNING } from './careerTuning';
import {
  CAREER_ELIGIBILITY_KINDS,
  CAREER_FEDERATIONS,
  type CareerEligibility,
  type CareerFederation,
  type CareerLifter,
  type CareerMeetSlot,
  type CareerQualifyingGate,
  type CareerTier,
  buildCareerCalendar,
  careerCalendarFaults,
  careerFederation,
  careerLifterFaults,
  careerMeetDraft,
  careerMeetName,
  careerTierRank,
  createCareerLifter,
  earliestNextEntryDay,
  enterMeet,
  isCareerTier,
  meetEligibility,
  meetVisibilityOn,
  qualifyingTotalKgFor,
  selectableMeets,
  visibleMeets,
} from './careerCore';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const MEET_TUNING_PATH = path.join(HERE, '..', 'game', 'meetTuning.ts');

const SHIPPED = readdirSync(HERE)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .sort();

const SOURCE_OF = new Map<string, string>(
  SHIPPED.map((name) => [name, readFileSync(path.join(HERE, name), 'utf8')]),
);

const source = (name: string): string => SOURCE_OF.get(name) ?? '';

/** Source with block and line comments removed, so a scan reads code only. */
function codeOf(name: string): string {
  return source(name)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

// ---------------------------------------------------------------------------
// A total this module cannot look inside, and the gate that can
// ---------------------------------------------------------------------------

/**
 * The stand-in for `progression.ts`'s `ConfirmedTotalKg`.
 *
 * A wrapper rather than a bare number on purpose: if `Total` were `number`,
 * every accidental `total >= requiredKg` inside `careerCore.ts` would compile,
 * and the "this module cannot compare a total" claim in its header would rest
 * on nobody having written one. Wrapped, such a line is a type error.
 */
interface TestTotal {
  readonly kg: number;
}

const kg = (value: number): TestTotal => ({ kg: value });

const GATE: CareerQualifyingGate<TestTotal> = (total, requiredKg) => total.kg >= requiredKg;

/** A gate that records every question asked of it. */
function countingGate(): { gate: CareerQualifyingGate<TestTotal>; asked: number[] } {
  const asked: number[] = [];
  return {
    asked,
    gate: (total, requiredKg) => {
      asked.push(requiredKg);
      return GATE(total, requiredKg);
    },
  };
}

const FED_A = CAREER_FEDERATIONS[0] as CareerFederation;
const FED_B = CAREER_FEDERATIONS[1] as CareerFederation;

const HORIZON = 400;
const CALENDAR = buildCareerCalendar({ federationId: FED_A.id, throughDayIndex: HORIZON });

function slotOf(tier: CareerTier, dayIndex: number): CareerMeetSlot {
  const found = CALENDAR.find((slot) => slot.tier === tier && slot.dayIndex === dayIndex);
  if (found === undefined) throw new Error(`no ${tier} slot on day ${dayIndex}`);
  return found;
}

const NOVICE: CareerLifter<TestTotal> = createCareerLifter(FED_A.id, 'mens');

// ===========================================================================
// The directory
// ===========================================================================

describe('the directory is pure, closed and numerically clean', () => {
  it('has the modules the scans below walk', () => {
    // Counts, not bounds. Every check in this block iterates this list, and a
    // list that had gone empty would make all of them pass.
    expect(SHIPPED).toEqual([
      'careerCore.ts',
      'careerEngagement.ts',
      'careerRecord.ts',
      'careerTuning.ts',
    ]);
    expect(SOURCE_OF.size).toBe(SHIPPED.length);
  });

  it('imports nothing outside this directory', () => {
    // The seam. `src/career/` may reach its own tuning module and nothing
    // else — in particular not `src/game/progression.ts`, whose
    // `meetsQualifyingTotal` this piece takes as an injected argument instead.
    //
    // Reddens on: any module specifier in either file that is not
    // `./careerTuning`. Adding `import { meetsQualifyingTotal } from
    // '../game/progression'` is the exact edit this exists for.
    //
    // THREE SPELLINGS AND THREE QUOTE STYLES, and they are two axes.
    //
    // The FORM axis: a `from '...'` scan — which is what this was first
    // written as, and what `src/empire/empireCore.test.ts` used — misses
    // `import '../game/progression';` entirely, because a side-effect import
    // has no `from` in it. It also misses `await import('...')`.
    //
    // The QUOTE axis, and this one was missed here after the form axis was
    // fixed. The pattern was `'([^']+)'` — single quotes only — so
    // `import { meetsQualifyingTotal } from "../game/progression";` was
    // invisible to it. MEASURED, not reasoned: with that line in
    // `careerCore.ts`, the `EXPECTED` equality below still held, `specifiers`
    // was still 5, and **this test stayed green**. What went red was
    // `has no watchlist name in any string a screen could draw`, on
    // `expected 186 to be 185` — the directory's string census counting the
    // specifier as one more double-quoted literal. That is verbatim what
    // CLAUDE.md records about the empire fence one axis over: *"A different
    // check noticing by accident is not that check working."*
    //
    // Prettier writes single quotes here, so the double-quoted mutant is not
    // something the repo produces by habit — which is exactly why a fence must
    // catch it. A fence that holds only while everyone follows the style guide
    // is a style guide, not a fence.
    //
    // The lesson this file was built on and then repeated: fixing the reach of
    // a scan says nothing about its predicate, and fixing its predicate says
    // nothing about its reach. Both axes, every time.
    //
    // MUTANTS RUN AGAINST THE FIXED PATTERN, and what each produced:
    //
    //   from "../game/progression"   -> RED here, "expected [ './careerTuning',
    //                                   …(1) ] to deeply equal [ './careerTuning' ]"
    //   await import(`../game/…`)    -> RED here, same assertion
    //   from `../game/progression`   -> not runnable: a template literal is not
    //                                   a legal specifier for a STATIC import,
    //                                   so this mutant is a syntax error rather
    //                                   than a bypass. Recorded as untestable
    //                                   rather than left looking covered — the
    //                                   backtick axis is real only on the
    //                                   dynamic form, and that one is red above.
    //
    // The probe grid below still drives all nine (form x quote) pairs, because
    // it feeds the regex synthetic TEXT rather than compiling it, and the point
    // there is that the pattern generalises rather than that the code is legal.
    const SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*(['"`])([^'"`]+)\1/g;
    const imports = (text: string): readonly string[] =>
      [...text.matchAll(SPECIFIER)].map((match) => match[2] as string);

    // Pinned per file, and pinned rather than merely constrained: a module
    // reaching a sibling it did not reach before is a change to this
    // directory's shape and it should be read, not inferred.
    const EXPECTED: Readonly<Record<string, readonly string[]>> = {
      'careerTuning.ts': [],
      'careerCore.ts': ['./careerTuning'],
      'careerRecord.ts': ['./careerCore', './careerTuning'],
      'careerEngagement.ts': ['./careerCore', './careerRecord'],
    };
    let fenced = 0;
    for (const name of SHIPPED) {
      expect(imports(codeOf(name)), name).toEqual(EXPECTED[name] ?? ['NO EXPECTATION PINNED']);
      fenced += 1;
    }
    // Counts, not bounds: every shipped module was fenced, and a module added
    // without a row above fails on the sentinel rather than passing unchecked.
    expect(fenced).toBe(SHIPPED.length);
    expect(Object.keys(EXPECTED).sort()).toEqual([...SHIPPED].sort());

    // And the fence is a property, not just a list: every specifier anywhere in
    // the directory resolves to a module that is in this directory.
    let specifiers = 0;
    for (const name of SHIPPED) {
      for (const specifier of imports(codeOf(name))) {
        expect(SHIPPED, `${name} imports ${specifier}`).toContain(
          `${specifier.replace('./', '')}.ts`,
        );
        specifiers += 1;
      }
    }
    expect(specifiers).toBe(5);

    // Non-vacuity, over BOTH axes rather than one. The finder works on a file
    // that does have edges, and it catches every (form x quote) pair on a
    // synthetic source — so an empty answer above is an answer rather than a
    // dead regex. Nine cases, driven from the two axes rather than listed, so
    // adding a form or a quote style to the pattern without adding its probes
    // is not possible: the counts below are pinned.
    expect(imports(readFileSync(MEET_TUNING_PATH, 'utf8')).length).toBeGreaterThan(0);
    const FORMS: readonly ((quoted: string) => string)[] = [
      (quoted) => `import { meetsQualifyingTotal } from ${quoted};`,
      (quoted) => `import ${quoted};`,
      (quoted) => `const m = await import(${quoted});`,
    ];
    const QUOTES: readonly string[] = ["'", '"', '`'];
    let probes = 0;
    for (const form of FORMS) {
      for (const quote of QUOTES) {
        expect(imports(form(`${quote}../game/progression${quote}`)), form(quote)).toEqual([
          '../game/progression',
        ]);
        probes += 1;
      }
    }
    // Counts, not bounds, on the probe grid itself.
    expect(probes).toBe(FORMS.length * QUOTES.length);
    expect(probes).toBe(9);
  });

  it('reads no clock and rolls no dice', () => {
    // GDD §6.1 is a calendar and the first instinct for a calendar is `new
    // Date()`. Time is a parameter here — a whole-day index — and this is what
    // keeps it one. Randomness is banned for the reason `meetTuning.ts` gives
    // about its own ghost field: a result that moved between two runs of the
    // same meet would be unreproducible for a screenshot.
    //
    // Reddens on: a `Date`, a `Math.random`, a seed or a host API anywhere in
    // a shipped module's CODE (comments are stripped first, so this file's own
    // prose about not reading a clock does not trip it).
    const banned: readonly RegExp[] = [
      /\bDate\b/,
      /Math\s*\.\s*random/,
      /\brandom\b/i,
      /\bshuffle\b/i,
      /\bseed\b/i,
      /\bperformance\s*\./,
      /\bprocess\b/,
      /\bfetch\s*\(/,
      /\blocalStorage\b/,
      /\brequire\s*\(/,
    ];
    // One probe per pattern, in the same order, so a pattern that can no
    // longer match anything reports itself instead of passing quietly.
    const probes: readonly string[] = [
      'const at = new Date();',
      'const r = Math.random();',
      'const r = random(a, b);',
      'shuffle(list);',
      'const s = seed;',
      'performance.now();',
      'process.env.HOME;',
      'fetch(url);',
      'localStorage.getItem(key);',
      'require("fs");',
    ];
    expect(probes.length).toBe(banned.length);
    expect(banned.length).toBe(10);

    let scans = 0;
    for (const name of SHIPPED) {
      const code = codeOf(name);
      for (const pattern of banned) {
        expect(pattern.test(code), `${name} matches ${pattern}`).toBe(false);
        scans += 1;
      }
    }
    expect(scans).toBe(SHIPPED.length * banned.length);

    // Non-vacuity: every pattern still catches the thing it is named for.
    let live = 0;
    for (let i = 0; i < banned.length; i += 1) {
      const pattern = banned[i] as RegExp;
      expect(pattern.test(probes[i] as string), `${pattern} matches nothing`).toBe(true);
      live += 1;
    }
    expect(live).toBe(banned.length);
  });

  it('holds every number in the tuning module and none anywhere else', () => {
    // The repository's own audit, run from inside this piece so a bare literal
    // here is red before it is red in the tree-wide pass.
    //
    // This has to be right in TWO WORLDS. `src/career/careerTuning.ts` needs a
    // `SOURCE_RULES` row and that row lands in `src/tuning/`, which is another
    // session's file. Until it does, the audit reports every literal in the
    // tuning block; the moment it does, it reports none. A guard pinned at one
    // of those numbers goes red on a correct change, so it reads `SOURCE_RULES`
    // and asserts the right thing on each side. `src/empire/empireCore.test.ts`
    // learned this the expensive way and this is the same shape.
    const REGISTERED_PATH = 'src/career/careerTuning.ts';
    const registered = Object.prototype.hasOwnProperty.call(SOURCE_RULES, REGISTERED_PATH);

    const findings = new Map(
      SHIPPED.map((name) => [name, auditSource(`src/career/${name}`, source(name))]),
    );
    const report = (name: string): string => `\n${formatFindings(findings.get(name) ?? [])}\n`;

    // Every file except the tuning module is a `renderer` in both worlds and
    // must be numerically clean. This half does not branch.
    //
    // Reddens on: any bare literal in `careerCore.ts` outside the structural
    // idioms — writing `dayIndex + 14` instead of reading
    // `MIN_DAYS_BETWEEN_ENTERED_MEETS`.
    let renderers = 0;
    for (const name of SHIPPED) {
      if (name === 'careerTuning.ts') continue;
      expect(findings.get(name)?.length, `${name}${report(name)}`).toBe(0);
      renderers += 1;
    }
    expect(renderers).toBe(SHIPPED.length - 1);

    if (registered) {
      expect(SOURCE_RULES[REGISTERED_PATH]?.role).toBe('constants');
      expect(findings.get('careerTuning.ts')?.length, report('careerTuning.ts')).toBe(0);
    } else {
      expect(findings.get('careerTuning.ts')?.length, report('careerTuning.ts')).toBe(17);
      // And the row would fix it rather than hide it: audited under a path
      // that already carries the rule it is asking for, the same bytes report
      // nothing, because every literal sits inside one frozen, named,
      // top-level constant block.
      const asRegistered = auditSource('src/game/sessionTuning.ts', source('careerTuning.ts'));
      expect(asRegistered.length, `\n${formatFindings(asRegistered)}\n`).toBe(0);
    }

    // The content pin, taken under a path unregistered in BOTH worlds, so the
    // number survives the row landing. This is the line that says the
    // instrument still sees the tuning block at all.
    //
    // Reddens on: adding or removing a tuned value. That is a decision, not a
    // tuning pass — changing 120 to 90 leaves this at 17.
    const asRenderer = auditSource('src/career/__unregistered.ts', source('careerTuning.ts'));
    expect(
      asRenderer.length,
      'the count of literals the audit finds in careerTuning.ts moved: an entry was added or ' +
        `removed, or the instrument stopped reporting. First finding: ${formatFindings(
          asRenderer.slice(0, 1),
        ).trim()}`,
    ).toBe(17);
    // And the instrument is live on a file it has never seen, in both worlds.
    expect(auditSource('src/career/probe.ts', 'export const RATE = 42;\n').length).toBe(1);
  });

  it('leaves no tuned value without a reader', () => {
    // `src/empire/empireTuning.test.ts`'s `AWAITING_CONSUMER`, same shape and
    // same reason: a knob nothing reads is a knob a playtester turns to no
    // effect, and it is indistinguishable from a live one by looking.
    //
    // Reddens on: adding an entry to `CAREER_TUNING` that no shipped module
    // reads, or deleting the last read of an existing one.
    //
    // Every shipped module rather than `careerCore.ts` alone: a key read only
    // by `careerRecord.ts` is read, and a scan that looked at one file would
    // have reported it as awaiting a consumer.
    const AWAITING_CONSUMER: readonly string[] = [];
    const code = SHIPPED.filter((name) => name !== 'careerTuning.ts')
      .map((name) => codeOf(name))
      .join('\n');
    const isRead = (key: string): boolean => code.includes(`CAREER_TUNING.${key}`);

    const unread = Object.keys(CAREER_TUNING).filter((key) => !isRead(key)).sort();
    expect(unread).toEqual([...AWAITING_CONSUMER].sort());
    // Counts, not bounds: every key was examined and every one is read.
    expect(Object.keys(CAREER_TUNING).length).toBe(12);
    expect(Object.keys(CAREER_TUNING).filter(isRead).length).toBe(12);
    // The detector can report a negative, so the empty list above is an
    // answer rather than a broken `includes`.
    expect(isRead('NOT_A_TUNING_KEY')).toBe(false);
  });
});

// ===========================================================================
// Real identity — GDD §12.3's condition, checked on this piece's own strings
// ===========================================================================

describe('nothing this directory ships names anybody real', () => {
  /** Every single-quoted, double-quoted and template chunk in the code. */
  function stringsIn(name: string): readonly string[] {
    const code = codeOf(name);
    const found: string[] = [];
    for (const match of code.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) found.push(match[1] as string);
    for (const match of code.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) found.push(match[1] as string);
    for (const match of code.matchAll(/`((?:[^`\\]|\\.)*)`/g)) found.push(match[1] as string);
    return found;
  }

  it('has no watchlist name in any string a screen could draw', () => {
    // GDD §2.1 asks the player to pick a federation, and a real federation
    // name is the first thing a builder reaches for — §12.3 says so in as many
    // words. `realIp.ts`'s own ruling: a body whose published rule is being
    // implemented is a structural citation and is pinned; a name a PLAYER SEES
    // is category (A) and default-denied. A Career federation is the second
    // kind, so all four are invented.
    //
    // Reddens on: putting a watched name in any literal here — renaming
    // `Tarnwick Powerlifting Union` to a real federation's name is the edit.
    let strings = 0;
    for (const name of SHIPPED) {
      for (const value of stringsIn(name)) {
        expect(findWatchedNames(value), `${name}: ${value}`).toEqual([]);
        strings += 1;
      }
    }
    // Counts, not bounds: the collectors really found the directory's strings.
    expect(strings).toBe(185);

    // Non-vacuity, and the probe is DERIVED from the watchlist rather than
    // transcribed, so this file adds no citation of its own and the probe
    // cannot go stale against a list it is about.
    const watched = REAL_IP_WATCHLIST[0]?.name as string;
    expect(findWatchedNames(`the ${watched} open`).length).toBe(1);
  });

  it('has no watchlist name in its prose either', () => {
    // Wider than the check above and deliberately so: a citation in a comment
    // is how a real name most often arrives, per `realIp.ts`'s own account of
    // how its list was extended. This piece implements no published rule, so
    // it has no structural citation to make and the honest setting is zero.
    //
    // Reddens on: naming a real federation in a docstring — including as a
    // "for comparison, the such-and-such federation does X" aside, which is
    // exactly the shape that reads harmless.
    //
    // Writing that sentence with a real acronym in it turned this file red on
    // the FIRST run, in `realIp.test.ts` rather than here: `REVIEWABLE_CITATIONS`
    // pins an exact per-file mention count tree-wide, and a builder's own
    // example of what not to write is a mention. Kept as a note because it is
    // the cheapest possible demonstration that the tree-wide guard is live.
    let scanned = 0;
    for (const name of SHIPPED) {
      expect(findWatchedNames(source(name)), name).toEqual([]);
      scanned += 1;
    }
    expect(scanned).toBe(SHIPPED.length);
  });

  it('pins every invented proper noun, so a fifth is a signed decision', () => {
    // A watchlist is a floor, not a net — `realIp.ts` says so about itself. It
    // cannot tell a real name from an invented one, so the human, name-by-name
    // pass §12.3 asks for is the actual check and this is what makes a new
    // name visible to it.
    //
    // Reddens on: adding, removing or renaming a federation or a meet title.
    expect(CAREER_FEDERATIONS.map((federation) => federation.name)).toEqual([
      'Cragmoor Barbell Federation',
      'Tarnwick Powerlifting Union',
      'Sablecoast Strength Alliance',
      'Orrenford Barbell League',
    ]);
    expect(Object.values(CAREER_TUNING.MEET_TITLE_BY_TIER)).toEqual([
      'Open',
      'Regional Championships',
      'National Championships',
      'World Championships',
    ]);
  });
});

// ===========================================================================
// The two seams into src/game/
// ===========================================================================

/**
 * The `readonly` field names declared directly inside a named interface.
 *
 * Reads source as text on purpose: importing `MeetDefinition` is the edge this
 * piece exists without.
 */
function interfaceFieldNames(text: string, name: string): readonly string[] {
  const start = text.indexOf(`export interface ${name}`);
  if (start < 0) return [];
  const open = text.indexOf('{', start);
  if (open < 0) return [];
  let depth = 0;
  let end = -1;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return [];
  const body = text
    .slice(open + 1, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  return [...body.matchAll(/readonly\s+([A-Za-z_$][\w$]*)\s*\??\s*:/g)].map(
    (match) => match[1] as string,
  );
}

describe('the seams into src/game/', () => {
  it('mirrors MeetDefinition field for field', () => {
    // `MeetDefinition`'s own header says "Whoever builds the calendar produces
    // a list of these and gates it" — a contract written for this module. The
    // mirror is by NAME, not by type: `rules` is a type parameter here because
    // `MeetLoadingRules` is `src/game/meet.ts`'s.
    //
    // Reddens on: a field added to or removed from `CareerMeetDraft` here, or
    // from `MeetDefinition` there. The second direction is the one that
    // matters — it is the drift a mirror cannot notice by itself.
    const theirs = interfaceFieldNames(readFileSync(MEET_TUNING_PATH, 'utf8'), 'MeetDefinition');
    const ours = interfaceFieldNames(source('careerCore.ts'), 'CareerMeetDraft');
    expect([...ours].sort()).toEqual([...theirs].sort());
    // Counts, not presence: an extractor that returned nothing would make the
    // equality above trivially true on both sides.
    expect(theirs.length).toBe(9);
    expect(ours.length).toBe(9);
    // And the extractor can come back empty, so nine is an answer.
    expect(interfaceFieldNames(source('careerCore.ts'), 'NotAnInterface')).toEqual([]);
  });

  it('splits those nine into three the calendar owns and six it passes through', () => {
    // Reddens on: `careerMeetDraft` deriving a field it should have passed
    // through, or passing through one it should own — writing `name:
    // venue.town`, say, which type-checks perfectly.
    const OWNED = ['id', 'federation', 'name'];
    const venue = {
      dateIso: '2026-08-15',
      town: 'PLACEHOLDER TOWN',
      state: '',
      country: 'PLACEHOLDER COUNTRY',
      rules: { unit: 'kg' },
      ghostTotalsKg: Object.freeze([500, 480]),
    };
    const slot = slotOf('local', CAREER_TUNING.FIRST_MEET_DAY_BY_TIER.local);
    const draft = careerMeetDraft(slot, venue);

    expect(draft.id).toBe(slot.slotId);
    expect(draft.federation).toBe(FED_A.name);
    expect(draft.name).toBe(careerMeetName(FED_A.id, 'local'));

    let passed = 0;
    for (const [key, value] of Object.entries(venue)) {
      expect(draft[key as keyof typeof venue], key).toBe(value);
      passed += 1;
    }
    expect(passed).toBe(6);
    expect(OWNED.length + passed).toBe(
      interfaceFieldNames(source('careerCore.ts'), 'CareerMeetDraft').length,
    );
  });

  it('keeps the one shipped meet on the ladder it belongs to', () => {
    // `MEET_LOCAL` in `meetTuning.ts` runs under an invented
    // `federation:` string and has an invented `name:`. This catalogue ships
    // the same two strings so the prototype's one meet is not run by a body
    // the Career screen has never heard of.
    //
    // Reddens on: renaming the federation or the meet on EITHER side. The
    // failure is the useful part — a rename there should be a rename here, and
    // this is the only thing that says so, since nothing imports across.
    const meetTuning = readFileSync(MEET_TUNING_PATH, 'utf8');
    expect([...meetTuning.matchAll(/federation: 'Cragmoor Barbell Federation'/g)].length).toBe(1);
    expect([...meetTuning.matchAll(/name: 'Cragmoor Open'/g)].length).toBe(1);
    expect(FED_A.name).toBe('Cragmoor Barbell Federation');
    expect(careerMeetName(FED_A.id, 'local')).toBe('Cragmoor Open');
  });

  it('keeps the lifter free of anything a player does daily', () => {
    // `MIN_DAYS_BETWEEN_ENTERED_MEETS` is the one restriction in this piece
    // that could have been keyed to training. GDD §4.4 measured that shape: a
    // covered day granted every N sessions gives 1156 violating pairs at 100
    // days; granted on a fixed calendar day, 0. The gap here reads
    // `lastEntryDayIndex` and there is nothing else on the record to read.
    //
    // Reddens on: adding any field to `CareerLifter` — `sessionsThisWeek`,
    // `currentStreak`, `checkInsSinceLastMeet`. The point is that the addition
    // is visible, not that the name is guessed: a field list pinned exactly
    // catches a name nobody predicted.
    expect(interfaceFieldNames(source('careerCore.ts'), 'CareerLifter')).toEqual([
      'federationId',
      'category',
      'bestTotal',
      'enteredSlotIds',
      'lastEntryDayIndex',
    ]);
  });
});

// ===========================================================================
// Vocabulary
// ===========================================================================

describe('tier and federation lookups', () => {
  it('recognises the four tiers and nothing else', () => {
    for (const tier of CAREER_TUNING.MEET_TIERS) expect(isCareerTier(tier)).toBe(true);
    expect(isCareerTier('masters')).toBe(false);
    expect(isCareerTier('')).toBe(false);
    expect(isCareerTier('Local')).toBe(false);
  });

  it('ranks the ladder in the tuning block’s own order', () => {
    // Reddens on: `careerTierRank` returning anything but the array index —
    // a hand-written `switch` that drifts from `MEET_TIERS` is the edit.
    expect(careerTierRank('local')).toBe(0);
    expect(careerTierRank('worlds')).toBe(CAREER_TUNING.MEET_TIERS.length - 1);
    let ascending = 0;
    for (let i = 1; i < CAREER_TUNING.MEET_TIERS.length; i += 1) {
      expect(careerTierRank(CAREER_TUNING.MEET_TIERS[i] as CareerTier)).toBeGreaterThan(
        careerTierRank(CAREER_TUNING.MEET_TIERS[i - 1] as CareerTier),
      );
      ascending += 1;
    }
    expect(ascending).toBe(3);
  });

  it('finds a federation by id and refuses one that does not exist', () => {
    for (const federation of CAREER_FEDERATIONS) {
      expect(careerFederation(federation.id)).toBe(federation);
    }
    expect(careerFederation('no-such-federation')).toBeNull();
    expect(careerFederation('')).toBeNull();
  });

  it('names a meet after the federation and the tier', () => {
    expect(careerMeetName(FED_B.id, 'nationals')).toBe(
      `${FED_B.meetPrefix} ${CAREER_TUNING.MEET_TITLE_BY_TIER.nationals}`,
    );
    // Reddens on: `careerMeetName` returning a name for a federation that does
    // not exist, which would put an unattributed meet on the calendar.
    expect(() => careerMeetName('no-such-federation', 'local')).toThrow(RangeError);
  });

  it('reads the qualifying table, including its one open tier', () => {
    expect(qualifyingTotalKgFor('local', 'mens')).toBeNull();
    expect(qualifyingTotalKgFor('local', 'womens')).toBeNull();
    let read = 0;
    for (const tier of CAREER_TUNING.MEET_TIERS) {
      for (const category of CAREER_TUNING.QUALIFYING_CATEGORIES) {
        expect(qualifyingTotalKgFor(tier, category)).toBe(
          CAREER_TUNING.QUALIFYING_TOTAL_KG_BY_TIER[tier][category],
        );
        read += 1;
      }
    }
    expect(read).toBe(8);
  });
});

// ===========================================================================
// Building the calendar
// ===========================================================================

describe('buildCareerCalendar', () => {
  it('produces every tier’s meets on its own cadence', () => {
    // Reddens on: `slotCountFor`'s arithmetic or the build loop drifting from
    // `FIRST_MEET_DAY_BY_TIER` + k * `MEET_INTERVAL_DAYS_BY_TIER`.
    let counted = 0;
    for (const tier of CAREER_TUNING.MEET_TIERS) {
      const days = CALENDAR.filter((slot) => slot.tier === tier).map((slot) => slot.dayIndex);
      const first = CAREER_TUNING.FIRST_MEET_DAY_BY_TIER[tier];
      const interval = CAREER_TUNING.MEET_INTERVAL_DAYS_BY_TIER[tier];
      const expected: number[] = [];
      for (let day = first; day <= HORIZON; day += interval) expected.push(day);
      expect(days, tier).toEqual(expected);
      counted += days.length;
    }
    // Counts, not bounds: 57 local + 28 regional + 4 nationals + 1 worlds.
    expect(counted).toBe(CALENDAR.length);
    expect(CALENDAR.length).toBe(90);
  });

  it('sorts by day, then by tier rank, then by id', () => {
    // Reddens on: dropping the comparator, or comparing `tier` as a string —
    // alphabetically `local` < `nationals` < `regional` < `worlds`, which is
    // not the ladder.
    let pairs = 0;
    for (let i = 1; i < CALENDAR.length; i += 1) {
      const previous = CALENDAR[i - 1] as CareerMeetSlot;
      const here = CALENDAR[i] as CareerMeetSlot;
      expect(here.dayIndex).toBeGreaterThanOrEqual(previous.dayIndex);
      if (here.dayIndex === previous.dayIndex) {
        expect(careerTierRank(here.tier)).toBeGreaterThan(careerTierRank(previous.tier));
      }
      pairs += 1;
    }
    expect(pairs).toBe(CALENDAR.length - 1);
    // The same-day case is reached rather than assumed: day 49 carries local,
    // regional and nationals at once.
    expect(CALENDAR.filter((slot) => slot.dayIndex === 49).map((slot) => slot.tier)).toEqual([
      'local',
      'regional',
      'nationals',
    ]);
  });

  it('gives every slot a distinct id built from federation, tier and day', () => {
    const ids = CALENDAR.map((slot) => slot.slotId);
    expect(new Set(ids).size).toBe(ids.length);
    const slot = slotOf('nationals', CAREER_TUNING.FIRST_MEET_DAY_BY_TIER.nationals);
    expect(slot.slotId).toBe(`${FED_A.id}-nationals-d49`);
  });

  it('copies the tier’s qualifying requirement onto every slot', () => {
    let checked = 0;
    for (const slot of CALENDAR) {
      for (const category of CAREER_TUNING.QUALIFYING_CATEGORIES) {
        expect(slot.qualifyingTotalKg[category]).toBe(qualifyingTotalKgFor(slot.tier, category));
        checked += 1;
      }
    }
    expect(checked).toBe(CALENDAR.length * CAREER_TUNING.QUALIFYING_CATEGORIES.length);
  });

  it('is deterministic', () => {
    // No clock, no seed: the same spec twice is the same list.
    const again = buildCareerCalendar({ federationId: FED_A.id, throughDayIndex: HORIZON });
    expect(again).toEqual(CALENDAR);
  });

  it('refuses a spec it cannot build', () => {
    // Reddens on: dropping any of the three guards. Each returns a partial or
    // absurd calendar instead of an error if it goes.
    expect(() =>
      buildCareerCalendar({
        federationId: 'no-such-federation' as CareerFederation['id'],
        throughDayIndex: HORIZON,
      }),
    ).toThrow(RangeError);
    expect(() => buildCareerCalendar({ federationId: FED_A.id, throughDayIndex: -1 })).toThrow(
      RangeError,
    );
    expect(() => buildCareerCalendar({ federationId: FED_A.id, throughDayIndex: 7.5 })).toThrow(
      RangeError,
    );
    expect(() =>
      buildCareerCalendar({ federationId: FED_A.id, throughDayIndex: Number.NaN }),
    ).toThrow(RangeError);
  });

  it('refuses a horizon longer than CALENDAR_MAX_SLOTS before it builds it', () => {
    // The count is computed analytically first, so an absurd horizon fails at
    // once rather than after allocating for a long time.
    //
    // Reddens on: removing the cap, or computing it after the loop.
    const week = CAREER_TUNING.MEET_INTERVAL_DAYS_BY_TIER.local;
    const tooFar = CAREER_TUNING.CALENDAR_MAX_SLOTS * week;
    expect(() =>
      buildCareerCalendar({ federationId: FED_A.id, throughDayIndex: tooFar }),
    ).toThrow(/CALENDAR_MAX_SLOTS/);
    // The domain is not empty on the other side either: a horizon just under
    // the cap builds, so the cap is a boundary rather than a blanket refusal.
    const justUnder = buildCareerCalendar({
      federationId: FED_A.id,
      throughDayIndex: HORIZON,
    });
    expect(justUnder.length).toBeLessThanOrEqual(CAREER_TUNING.CALENDAR_MAX_SLOTS);
    expect(justUnder.length).toBe(90);
  });

  it('builds an empty calendar for a horizon before the first meet', () => {
    // A list-walking check passes trivially on an empty list, so the empty
    // case is asserted rather than left to be produced by accident.
    const first = CAREER_TUNING.FIRST_MEET_DAY_BY_TIER.local;
    expect(buildCareerCalendar({ federationId: FED_A.id, throughDayIndex: first - 1 })).toEqual([]);
    expect(
      buildCareerCalendar({ federationId: FED_A.id, throughDayIndex: first }).length,
    ).toBe(1);
  });
});

// ===========================================================================
// Visibility and selection
// ===========================================================================

describe('visibility', () => {
  it('calls a slot passed, open or not-yet-visible against today', () => {
    const slot = slotOf('nationals', 49);
    const ahead = CAREER_TUNING.CALENDAR_VISIBLE_DAYS_AHEAD;
    expect(meetVisibilityOn(slot, slot.dayIndex + 1)).toBe('passed');
    expect(meetVisibilityOn(slot, slot.dayIndex)).toBe('open');
    expect(meetVisibilityOn(slot, slot.dayIndex - ahead)).toBe('open');
    expect(meetVisibilityOn(slot, slot.dayIndex - ahead - 1)).toBe('not-yet-visible');
  });

  it('shows the calendar as a window, not the whole horizon', () => {
    // Reddens on: `visibleMeets` dropping the window and returning everything.
    const today = 0;
    const shown = visibleMeets(CALENDAR, today);
    expect(shown.length).toBeLessThan(CALENDAR.length);
    for (const slot of shown) {
      expect(slot.dayIndex).toBeGreaterThanOrEqual(today);
      expect(slot.dayIndex).toBeLessThanOrEqual(today + CAREER_TUNING.CALENDAR_VISIBLE_DAYS_AHEAD);
    }
    expect(shown.length).toBe(26);
  });
});

describe('eligibility', () => {
  it('lets a lifter with no total into an open tier without asking the gate', () => {
    // The `local` tier asks for no qualifying total, so a brand-new lifter is
    // eligible and the injected predicate is never consulted.
    //
    // Reddens on: `meetEligibility` calling the gate before checking for an
    // open tier — which would refuse every new lifter their first meet.
    const { gate, asked } = countingGate();
    expect(meetEligibility(slotOf('local', 7), NOVICE, 0, gate)).toEqual({ kind: 'eligible' });
    expect(asked).toEqual([]);
  });

  it('asks the injected gate, and only the injected gate, on a gated tier', () => {
    // The whole seam in one assertion: this module cannot compare a total, so
    // the answer is whatever the caller's predicate says. A gate that always
    // refuses refuses; a gate that always admits admits; the totals are the
    // same in both.
    //
    // Reddens on: `careerCore.ts` comparing `bestTotal` itself. It could not
    // today — `Total` is opaque — so this is the check that would notice the
    // type being widened to `number` and a `>=` appearing.
    const qualified: CareerLifter<TestTotal> = { ...NOVICE, bestTotal: kg(600) };
    const slot = slotOf('regional', 21);
    const required = qualifyingTotalKgFor('regional', 'mens');

    const { gate, asked } = countingGate();
    expect(meetEligibility(slot, qualified, 0, gate)).toEqual({ kind: 'eligible' });
    expect(asked).toEqual([required]);

    expect(meetEligibility(slot, qualified, 0, () => false)).toEqual({
      kind: 'below-qualifying-total',
      requiredKg: required,
    });
    expect(meetEligibility(slot, { ...qualified, bestTotal: kg(0) }, 0, () => true)).toEqual({
      kind: 'eligible',
    });
  });

  it('reaches every refusal it declares', () => {
    // A tagged union whose tags are not all reachable is a union with dead
    // arms in it. Each case below is constructed to produce exactly one kind,
    // and the set of kinds observed is asserted to be the whole declared set.
    const entered: CareerLifter<TestTotal> = {
      ...NOVICE,
      bestTotal: kg(600),
      enteredSlotIds: [slotOf('local', 7).slotId],
      lastEntryDayIndex: 7,
    };
    const cases: readonly { readonly verdict: CareerEligibility }[] = [
      { verdict: meetEligibility(slotOf('local', 7), NOVICE, 0, GATE) },
      {
        verdict: meetEligibility(
          { ...slotOf('local', 7), federationId: FED_B.id },
          NOVICE,
          0,
          GATE,
        ),
      },
      { verdict: meetEligibility(slotOf('local', 7), entered, 7, GATE) },
      { verdict: meetEligibility(slotOf('local', 14), NOVICE, 21, GATE) },
      { verdict: meetEligibility(slotOf('worlds', 168), NOVICE, 0, GATE) },
      { verdict: meetEligibility(slotOf('local', 14), entered, 7, GATE) },
      { verdict: meetEligibility(slotOf('regional', 21), NOVICE, 0, GATE) },
      {
        verdict: meetEligibility(
          slotOf('regional', 21),
          { ...NOVICE, bestTotal: kg(1) },
          0,
          GATE,
        ),
      },
    ];
    const observed = cases.map((entry) => entry.verdict.kind);
    expect([...observed].sort()).toEqual([...CAREER_ELIGIBILITY_KINDS].sort());
    expect(new Set(observed).size).toBe(CAREER_ELIGIBILITY_KINDS.length);
    expect(CAREER_ELIGIBILITY_KINDS.length).toBe(8);
  });

  it('carries the number a screen would need with each refusal', () => {
    expect(meetEligibility(slotOf('local', 14), NOVICE, 21, GATE)).toEqual({
      kind: 'meet-has-passed',
      dayIndex: 14,
    });
    expect(meetEligibility(slotOf('worlds', 168), NOVICE, 0, GATE)).toEqual({
      kind: 'not-yet-visible',
      opensOnDayIndex: 168 - CAREER_TUNING.CALENDAR_VISIBLE_DAYS_AHEAD,
    });
    expect(meetEligibility(slotOf('regional', 21), NOVICE, 0, GATE)).toEqual({
      kind: 'no-recorded-total',
      requiredKg: qualifyingTotalKgFor('regional', 'mens'),
    });
  });

  it('holds the refusal precedence it documents', () => {
    // Which sentence a player reads when two things are wrong at once. Every
    // pair below has BOTH conditions true, so each assertion is a real
    // discriminator rather than a case where only one arm could fire.
    //
    // Reddens on: reordering the `if`s in `meetEligibility`.
    const otherFedSlot = { ...slotOf('local', 7), federationId: FED_B.id };
    const alsoEntered: CareerLifter<TestTotal> = {
      ...NOVICE,
      enteredSlotIds: [otherFedSlot.slotId],
      lastEntryDayIndex: 7,
    };
    // other-federation over already-entered
    expect(meetEligibility(otherFedSlot, alsoEntered, 7, GATE).kind).toBe('other-federation');

    // already-entered over meet-has-passed
    const pastEntered: CareerLifter<TestTotal> = {
      ...NOVICE,
      enteredSlotIds: [slotOf('local', 7).slotId],
      lastEntryDayIndex: 7,
    };
    expect(meetEligibility(slotOf('local', 7), pastEntered, 200, GATE).kind).toBe('already-entered');

    // meet-has-passed over too-soon-after-last-meet
    const justCompeted: CareerLifter<TestTotal> = {
      ...NOVICE,
      enteredSlotIds: [slotOf('local', 28).slotId],
      lastEntryDayIndex: 28,
    };
    expect(meetEligibility(slotOf('local', 21), justCompeted, 30, GATE).kind).toBe(
      'meet-has-passed',
    );

    // not-yet-visible over below-qualifying-total
    expect(meetEligibility(slotOf('worlds', 168), { ...NOVICE, bestTotal: kg(1) }, 0, GATE).kind)
      .toBe('not-yet-visible');

    // too-soon-after-last-meet over below-qualifying-total
    expect(
      meetEligibility(
        slotOf('regional', 35),
        { ...justCompeted, bestTotal: kg(1) },
        28,
        GATE,
      ).kind,
    ).toBe('too-soon-after-last-meet');

    // no-recorded-total over below-qualifying-total: a lifter with no total is
    // told they have none, not that theirs is too small.
    expect(meetEligibility(slotOf('regional', 21), NOVICE, 0, GATE).kind).toBe('no-recorded-total');
  });

  it('measures the gap from the last meet and from nothing else', () => {
    expect(earliestNextEntryDay(NOVICE)).toBeNull();
    expect(
      earliestNextEntryDay({ ...NOVICE, enteredSlotIds: ['x'], lastEntryDayIndex: 30 }),
    ).toBe(30 + CAREER_TUNING.MIN_DAYS_BETWEEN_ENTERED_MEETS);
  });

  it('selects the subset of the visible window the lifter may actually enter', () => {
    // Reddens on: `selectableMeets` returning slots it has not gated, or
    // returning slots outside the visible window.
    const qualified: CareerLifter<TestTotal> = { ...NOVICE, bestTotal: kg(600) };
    const shown = visibleMeets(CALENDAR, 0);
    const pick = selectableMeets(CALENDAR, qualified, 0, GATE);
    for (const slot of pick) expect(shown).toContain(slot);
    expect(pick.length).toBeLessThanOrEqual(shown.length);
    expect(selectableMeets(CALENDAR, NOVICE, 0, GATE).length).toBe(17);
    expect(pick.length).toBe(26);
  });
});

// ===========================================================================
// Entering
// ===========================================================================

describe('enterMeet', () => {
  it('starts a lifter with nothing entered', () => {
    expect(createCareerLifter(FED_B.id, 'womens')).toEqual({
      federationId: FED_B.id,
      category: 'womens',
      bestTotal: null,
      enteredSlotIds: [],
      lastEntryDayIndex: null,
    });
    expect(() =>
      createCareerLifter('no-such-federation' as CareerFederation['id'], 'mens'),
    ).toThrow(RangeError);
  });

  it('records the entry and leaves the lifter it was given alone', () => {
    const slot = slotOf('local', 7);
    const outcome = enterMeet(NOVICE, slot, 0, GATE);
    expect(outcome.kind).toBe('entered');
    if (outcome.kind !== 'entered') throw new Error('unreachable');
    expect(outcome.lifter.enteredSlotIds).toEqual([slot.slotId]);
    expect(outcome.lifter.lastEntryDayIndex).toBe(slot.dayIndex);
    // Purity: the input value is unchanged.
    expect(NOVICE.enteredSlotIds).toEqual([]);
    expect(NOVICE.lastEntryDayIndex).toBeNull();
  });

  it('refuses with the same verdict the screen would have rendered', () => {
    // One decision, one place it is made. `src/game/streak.ts`'s store shipped
    // the other arrangement for a round — a completed sale re-deciding down a
    // different path from the one that rendered the offer.
    //
    // Reddens on: `enterMeet` re-deriving a reason instead of returning the
    // verdict, which is the edit that lets the two disagree.
    const slot = slotOf('regional', 21);
    const verdict = meetEligibility(slot, NOVICE, 0, GATE);
    const outcome = enterMeet(NOVICE, slot, 0, GATE);
    expect(outcome).toEqual({ kind: 'refused', reason: verdict });
  });

  it('never moves the last entry day backwards, over every slot and every prior entry', () => {
    // THIS TEST IS A REPLACEMENT FOR ONE THAT COULD NOT FAIL, and the history
    // is the useful part. `enterMeet` first wrote
    // `Math.max(previous, slot.dayIndex)`, guarded so that entering an earlier
    // meet could not lower the day. Mutating that to a plain assignment left
    // the suite entirely green: `meetEligibility` already refuses any slot
    // earlier than `lastEntryDayIndex + MIN_DAYS_BETWEEN_ENTERED_MEETS`, so
    // the guard's own case is unreachable through the API. The `max` was
    // removed rather than kept with a test bolted on.
    //
    // What is asserted instead is the property the `max` was pretending to
    // provide, over a domain wide enough to contain the failing case: every
    // slot on the calendar against every prior entry day, accepted or refused.
    //
    // Reddens on: removing the `too-soon-after-last-meet` branch from
    // `meetEligibility`, which is what actually holds the property.
    const qualified: CareerLifter<TestTotal> = { ...NOVICE, bestTotal: kg(700) };
    let accepted = 0;
    let refused = 0;
    let backwards = 0;
    for (const slot of CALENDAR) {
      for (let previous = 0; previous <= HORIZON; previous += 1) {
        const before: CareerLifter<TestTotal> = {
          ...qualified,
          enteredSlotIds: ['some-earlier-meet'],
          lastEntryDayIndex: previous,
        };
        const outcome = enterMeet(before, slot, slot.dayIndex, GATE);
        if (outcome.kind !== 'entered') {
          refused += 1;
          continue;
        }
        accepted += 1;
        if ((outcome.lifter.lastEntryDayIndex as number) < previous) backwards += 1;
      }
    }
    // Pinned at zero, with the sweep's own size beside it so an empty domain
    // reports itself. Both arms are non-empty: the refusals are the ones the
    // gap rule turned away, and they are the reason zero is zero.
    expect(backwards).toBe(0);
    expect(accepted).toBe(17197);
    expect(refused).toBe(18893);
    expect(accepted + refused).toBe(CALENDAR.length * (HORIZON + 1));
  });

  it('holds a lifter to the gap between meets', () => {
    const qualified: CareerLifter<TestTotal> = { ...NOVICE, bestTotal: kg(600) };
    const first = enterMeet(qualified, slotOf('local', 7), 0, GATE);
    if (first.kind !== 'entered') throw new Error('unreachable');
    const gap = CAREER_TUNING.MIN_DAYS_BETWEEN_ENTERED_MEETS;
    expect(enterMeet(first.lifter, slotOf('local', 7 + gap - 7), 0, GATE).kind).toBe('refused');
    expect(enterMeet(first.lifter, slotOf('local', 7 + gap), 0, GATE).kind).toBe('entered');
  });
});

// ===========================================================================
// Faults — the JSON path, where the types above are not a check
// ===========================================================================

describe('careerCalendarFaults', () => {
  it('says nothing about a calendar this module built', () => {
    expect(careerCalendarFaults(CALENDAR)).toEqual([]);
    expect(CALENDAR.length).toBeGreaterThan(0);
  });

  it('catches every way a calendar can arrive wrong', () => {
    // Reddens on: deleting any branch of `careerCalendarFaults`. Each case
    // below is a payload no constructor here can produce and JSON can.
    const good = slotOf('local', 7);
    const cases: readonly (readonly [string, readonly CareerMeetSlot[], RegExp])[] = [
      ['duplicate id', [good, good], /share the id/],
      [
        'unknown tier',
        [{ ...good, tier: 'masters' as CareerTier }],
        /not on the ladder/,
      ],
      [
        'unknown federation',
        [{ ...good, federationId: 'nope' as CareerFederation['id'] }],
        /does not exist/,
      ],
      ['fractional day', [{ ...good, dayIndex: 7.5 }], /whole number of days/],
      ['negative day', [{ ...good, dayIndex: -1 }], /whole number of days/],
      [
        'out of order',
        [slotOf('local', 14), slotOf('local', 7)],
        /before the slot ahead of it/,
      ],
      [
        'wrong requirement',
        [{ ...good, qualifyingTotalKg: { mens: 1, womens: null } }],
        /asks 1 kg of mens/,
      ],
    ];
    let covered = 0;
    for (const [label, calendar, pattern] of cases) {
      const faults = careerCalendarFaults(calendar);
      expect(faults.join('\n'), label).toMatch(pattern);
      covered += 1;
    }
    expect(covered).toBe(7);
  });
});

describe('careerLifterFaults', () => {
  it('says nothing about a lifter this module built', () => {
    expect(careerLifterFaults(NOVICE)).toEqual([]);
    const entered = enterMeet(NOVICE, slotOf('local', 7), 0, GATE);
    if (entered.kind !== 'entered') throw new Error('unreachable');
    expect(careerLifterFaults(entered.lifter)).toEqual([]);
  });

  it('catches every way a lifter can arrive wrong', () => {
    const cases: readonly (readonly [string, CareerLifter<TestTotal>, RegExp])[] = [
      [
        'unknown federation',
        { ...NOVICE, federationId: 'nope' as CareerFederation['id'] },
        /federation nope, which does not exist/,
      ],
      [
        'unknown category',
        { ...NOVICE, category: 'mixed' as CareerLifter<TestTotal>['category'] },
        /not a qualifying category/,
      ],
      [
        'duplicate entry',
        { ...NOVICE, enteredSlotIds: ['a', 'a'], lastEntryDayIndex: 7 },
        /entered a more than once/,
      ],
      [
        'entry with no day',
        { ...NOVICE, enteredSlotIds: ['a'], lastEntryDayIndex: null },
        /records no day for it/,
      ],
      [
        'day with no entry',
        { ...NOVICE, enteredSlotIds: [], lastEntryDayIndex: 7 },
        /has entered nothing/,
      ],
      [
        'fractional day',
        { ...NOVICE, enteredSlotIds: ['a'], lastEntryDayIndex: 7.5 },
        /whole number of days/,
      ],
    ];
    let covered = 0;
    for (const [label, lifter, pattern] of cases) {
      expect(careerLifterFaults(lifter).join('\n'), label).toMatch(pattern);
      covered += 1;
    }
    expect(covered).toBe(6);
  });
});

// ===========================================================================
// Sweeps — the whole calendar, every day, counts pinned
// ===========================================================================

describe('sweeps over the whole calendar', () => {
  /** Every day a calendar of `HORIZON` can be read from without falling off. */
  const SWEEP_DAYS = HORIZON - CAREER_TUNING.CALENDAR_VISIBLE_DAYS_AHEAD;

  it('never shows a player an empty calendar', () => {
    // The property `CALENDAR_VISIBLE_DAYS_AHEAD` exists to have: on every day
    // of the sweep there is at least one meet on screen.
    //
    // Reddens on: dropping `CALENDAR_VISIBLE_DAYS_AHEAD` below the entry
    // tier's interval, or `meetVisibilityOn` inverting either bound.
    let emptyDays = 0;
    let pairs = 0;
    let days = 0;
    for (let today = 0; today <= SWEEP_DAYS; today += 1) {
      const shown = visibleMeets(CALENDAR, today);
      if (shown.length === 0) emptyDays += 1;
      pairs += shown.length;
      days += 1;
    }
    // Pinned at zero, with the sweep's own size pinned beside it so an empty
    // domain reports itself instead of passing.
    expect(emptyDays).toBe(0);
    expect(days).toBe(281);
    expect(pairs).toBe(7770);
  });

  it('offers a brand-new lifter a meet on every day of the sweep', () => {
    // The entry tier is open, so a lifter with no recorded total is never
    // locked out of the calendar entirely.
    //
    // Reddens on: giving `local` a qualifying total, or `meetEligibility`
    // consulting the gate on an open tier.
    let lockedOutDays = 0;
    let offered = 0;
    for (let today = 0; today <= SWEEP_DAYS; today += 1) {
      const pick = selectableMeets(CALENDAR, NOVICE, today, GATE);
      if (pick.length === 0) lockedOutDays += 1;
      offered += pick.length;
    }
    expect(lockedOutDays).toBe(0);
    expect(offered).toBe(4857);
  });

  it('walks a qualified lifter up the ladder, one meet at a time', () => {
    // A day-by-day run of the whole loop: on each day, take the highest tier
    // this lifter may enter TODAY, enter it, and carry the state forward. It
    // exercises `buildCareerCalendar`, `meetEligibility`, `enterMeet` and the
    // between-meets gap together, which none of the unit tests above does.
    //
    // Reddens on: the gap rule going (entries jump to 57), the ladder's
    // qualifying totals inverting (the tier mix changes), or `enterMeet`
    // failing to carry `lastEntryDayIndex` forward.
    let lifter: CareerLifter<TestTotal> = { ...NOVICE, bestTotal: kg(700) };
    const enteredOn: number[] = [];
    const byTier = new Map<CareerTier, number>();
    for (let today = 0; today <= HORIZON; today += 1) {
      const todays = selectableMeets(CALENDAR, lifter, today, GATE).filter(
        (slot) => slot.dayIndex === today,
      );
      const best = todays[todays.length - 1];
      if (best === undefined) continue;
      const outcome = enterMeet(lifter, best, today, GATE);
      expect(outcome.kind).toBe('entered');
      if (outcome.kind !== 'entered') throw new Error('unreachable');
      lifter = outcome.lifter;
      enteredOn.push(best.dayIndex);
      byTier.set(best.tier, (byTier.get(best.tier) ?? 0) + 1);
    }

    // Counts, not bounds.
    expect(enteredOn.length).toBe(29);
    expect(lifter.enteredSlotIds.length).toBe(enteredOn.length);
    expect(lifter.lastEntryDayIndex).toBe(enteredOn[enteredOn.length - 1]);
    expect(careerLifterFaults(lifter)).toEqual([]);

    // Every gap is at least the tuned minimum, and the tightest one is exactly
    // it — so the bound is reached rather than merely satisfied.
    const gaps: number[] = [];
    for (let i = 1; i < enteredOn.length; i += 1) {
      gaps.push((enteredOn[i] as number) - (enteredOn[i - 1] as number));
    }
    expect(Math.min(...gaps)).toBe(CAREER_TUNING.MIN_DAYS_BETWEEN_ENTERED_MEETS);
    expect(gaps.filter((gap) => gap < CAREER_TUNING.MIN_DAYS_BETWEEN_ENTERED_MEETS).length).toBe(0);
    expect(gaps.length).toBe(28);

    // The tier mix, pinned — and it is a finding rather than a decoration.
    //
    // This walk enters no worlds meet, and the count below is what says so.
    //
    // That sentence was first written as a capitalised absolute claiming that
    // a greedy lifter never reaches worlds on this tuning, and it is weakened
    // here on purpose rather than to duck a
    // scan. The measurement is one strategy, at one horizon, under one set of
    // tuned values; the capitalised version claimed a universal about every
    // greedy lifter, which nothing here establishes and which is false for a
    // horizon that happens to align differently. A sentence that outruns its
    // own measurement is the exact defect CLAUDE.md's guarantee-prose section
    // is about, and it does not stop being one because it is written in a test.
    //
    // Entries land on 7 + 14k; the one worlds slot in the
    // horizon is day 168, which is not on that sequence, so on worlds day this
    // lifter competed seven days ago and is inside the gap. Nothing here is
    // broken — the calendar offered it and the lifter had spent their window —
    // but "take every meet you can" is a strategy that costs the top of the
    // ladder, and whether that is tension or frustration is a playtest
    // question, not one this file can answer. It is pinned rather than
    // smoothed over so that a tuning pass sees the number move.
    //
    // Reachability itself is asserted separately, below, so this zero is a
    // fact about the greedy strategy and not about the calendar.
    expect(byTier.get('worlds')).toBeUndefined();
    expect(byTier.get('nationals')).toBe(2);
    expect(byTier.get('regional')).toBe(26);
    expect(byTier.get('local')).toBe(1);
    expect([...byTier.keys()].sort()).toEqual(['local', 'nationals', 'regional']);
  });

  it('leaves the top of the ladder reachable by a lifter who saves themselves', () => {
    // The companion to the pin above: worlds is enterable, by a qualified
    // lifter who has not spent their entry gap on a local meet the week
    // before. Without this the zero above would read as "worlds is dead".
    //
    // Reddens on: a worlds slot that never becomes visible, or a qualifying
    // total no lifter can meet.
    const worlds = slotOf('worlds', CAREER_TUNING.FIRST_MEET_DAY_BY_TIER.worlds);
    const qualified: CareerLifter<TestTotal> = { ...NOVICE, bestTotal: kg(700) };
    const firstVisible = worlds.dayIndex - CAREER_TUNING.CALENDAR_VISIBLE_DAYS_AHEAD;
    expect(meetEligibility(worlds, qualified, firstVisible, GATE)).toEqual({ kind: 'eligible' });
    const rested: CareerLifter<TestTotal> = {
      ...qualified,
      enteredSlotIds: [slotOf('local', 154).slotId],
      lastEntryDayIndex: 154,
    };
    expect(meetEligibility(worlds, rested, worlds.dayIndex, GATE)).toEqual({ kind: 'eligible' });
    // And one week later on the same calendar, they are not.
    const greedy: CareerLifter<TestTotal> = {
      ...qualified,
      enteredSlotIds: [slotOf('local', 161).slotId],
      lastEntryDayIndex: 161,
    };
    expect(meetEligibility(worlds, greedy, worlds.dayIndex, GATE).kind).toBe(
      'too-soon-after-last-meet',
    );
  });

  it('never lets an unqualified lifter past a gated tier, on any day', () => {
    // The refusal half of the sweep above. A lifter one kilogram under every
    // requirement is offered `local` and nothing else, on every day.
    //
    // Reddens on: `meetEligibility` treating a refused gate as eligible, or
    // the slot's requirement not being consulted.
    const under: CareerLifter<TestTotal> = { ...NOVICE, bestTotal: kg(1) };
    let gatedOffers = 0;
    let localOffers = 0;
    for (let today = 0; today <= SWEEP_DAYS; today += 1) {
      for (const slot of selectableMeets(CALENDAR, under, today, GATE)) {
        if (slot.tier === 'local') localOffers += 1;
        else gatedOffers += 1;
      }
    }
    expect(gatedOffers).toBe(0);
    // Non-vacuity: the sweep really did offer this lifter meets, so the zero
    // above is a zero about a non-empty domain.
    expect(localOffers).toBe(4857);
  });
});
