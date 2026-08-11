/**
 * careerOpacity.test.ts — the one thing this directory claims hardest, and the
 * thing that was enforced by nothing.
 *
 * ===========================================================================
 * The claim, and the measurement that showed it false
 * ===========================================================================
 *
 * `careerCore.ts` and `careerRecord.ts` both say, in their headers, that a
 * `Total` is opaque here: this directory never looks inside one, never compares
 * one to a number, and cannot admit a projected total by accident. The
 * eligibility gate is injected for exactly that reason.
 *
 * The version of that sentence this file replaces read:
 *
 *     Nothing in this directory can compare a total to a number — there is no
 *     `>=` on a `Total` anywhere in this file, because `Total` is opaque and
 *     such a comparison would not compile.
 *
 * MEASURED FALSE, TWICE, RATHER THAN ARGUED. Planting this in
 * `meetEligibility`:
 *
 *     if (requiredKg !== null && Number(lifter.bestTotal) >= requiredKg) {
 *       return { kind: 'eligible' };
 *     }
 *
 * gave `npx tsc --noEmit` exit 0 — it compiles — and `npx vitest run src/career`
 * red on exactly ONE test: `has no watchlist name in any string a screen could
 * draw`, on `expected 186 to be 185`. That is the directory's string census
 * reacting to one more `'eligible'` literal. Nothing about comparing a total
 * fired. A different check noticing by accident is not that check working.
 *
 * And the accident is thinner than it looks. Rewriting the same laundered
 * comparison so it adds no new string:
 *
 *     if (requiredKg === null || Number(lifter.bestTotal) >= requiredKg) return { kind: 'eligible' };
 *
 * gave `Test Files 4 passed (4) / Tests 118 passed (118)`, exit 0, and
 * `tsc --noEmit` exit 0. Entirely invisible.
 *
 * ===========================================================================
 * Why no behavioural test in this directory could have caught it
 * ===========================================================================
 *
 * Because of the fixture, and the fixture is right. `careerCore.test.ts` and
 * `careerRecord.test.ts` both bind `Total` to `interface TestTotal { kg: number }`
 * — a wrapper, so that a direct `total >= requiredKg` in a shipped module is a
 * type error. `Number({ kg: 600 })` is `NaN`, `NaN >= 450` is `false`, so under
 * a wrapped total every laundered comparison silently evaluates to "no" and the
 * function falls through to the injected gate. Identical behaviour, on every
 * input those files can construct.
 *
 * That is CLAUDE.md's "empty domain reproduced across every harness" in a new
 * place: two independent test files, blind for one shared reason. So this file
 * binds `Total` to `number` instead — which is legal, the modules are generic —
 * and asks the questions those files cannot.
 *
 * ===========================================================================
 * What is enforced here, by what, and what is NOT
 * ===========================================================================
 *
 * Two instruments, on two different axes, because fixing the reach of a check
 * says nothing about its predicate:
 *
 *   1. A NUMERIC-TOTAL PROBE (behavioural). Binds `Total` to `number`, hands the
 *      modules a gate that refuses everything and a total large enough that any
 *      coercion admits, and asserts every gated verdict is still a refusal —
 *      then the same in reverse. This catches ANY route from a `Total` to a
 *      number, including routes nobody has thought of, because it reads the
 *      OUTCOME rather than the syntax. It is the stronger of the two.
 *
 *   2. A SOURCE BAN (syntactic). Thirty-four patterns over the shipped modules,
 *      each driven against a tripwire it must match. This catches a coercion
 *      that is present but not yet reachable from any call the probe makes —
 *      dead code, an unexported helper, a path behind a condition no fixture
 *      hits — which is exactly what a behavioural probe cannot see.
 *
 * WHAT IS NOT ENFORCED, said plainly rather than left to be discovered:
 *
 *   - `tsc --noEmit` IS A SEPARATE COMMAND FROM THE SUITE. vitest strips types
 *     without checking them, so the "it would not compile" half of the original
 *     claim is enforced by a command a reader has to remember to run. That is
 *     why the direct `total >= n` form is in the ban below even though the
 *     compiler already refuses it.
 *   - The ban reads text, not types. It cannot tell a `Total` from a number that
 *     happens to be named `total`, so its subject vocabulary is a naming
 *     convention (see `TOTAL_REF`), and a total renamed to `t` walks past every
 *     subject-keyed row. The subject-INDEPENDENT rows — `Number(`, `parseFloat`,
 *     `valueOf`, `as number`, `as unknown`, `JSON.parse` and the rest — are the
 *     load-bearing ones for that reason: a `Total` cannot become a number
 *     without one of them, whatever it is called.
 *   - Neither instrument covers `src/career/`'s TEST files, and that is
 *     deliberate: a test constructs a gate, and a gate's whole job is to compare
 *     a total to a number. `careerCore.test.ts`'s `GATE` is the reference
 *     implementation of exactly the line this file bans in shipped code.
 *   - Comments are stripped before the code scan, and quoted strings with them,
 *     so a banned pattern written inside a `'...'` literal is invisible. Strings
 *     are not executable; the two ways they become executable, `eval` and
 *     `new Function`, are banned outright. Template literals are NOT stripped,
 *     because `${...}` holds real code.
 *
 * ===========================================================================
 * The guarantee census for this directory, and what fraction it covers
 * ===========================================================================
 *
 * The tree-wide `@guarantee` scan keys on a run of three or more capitalised
 * absolutes, which is this repository's house style for a load-bearing sentence.
 * `src/career/` has exactly ONE paragraph that scan can see and `src/empire/`
 * has zero: both directories write their guarantees in lower case. So the
 * mechanism built for this class is blind to essentially all of it, and the pass
 * that produced this file was done by hand instead.
 *
 * 38 guarantee-shaped claims were enumerated across the four shipped modules —
 * sentences asserting that the code cannot, never, always or only ever does
 * something. Of those:
 *
 *   - 6 were rewritten, because they claimed more than any mechanism delivers.
 *     Four are named where they live: the two "cannot compare a total" sentences
 *     (`careerCore.ts` section 3, `careerRecord.ts` section 3), "byte for byte
 *     on every device" and "fails immediately instead of building for a long
 *     time first" (`buildCareerCalendar`). The other two are the sentences those
 *     rewrites replaced in `CareerLifter` and `CareerStanding`.
 *   - 4 had NO check that could redden and now have one: the opacity claim
 *     (this file), the no-default-gate claim (the `default-gate` row), the
 *     one-visibility-window claim (`keeps the visibility window in one place`),
 *     and `asAsked`'s "changes nothing else" (`changes nothing but the entry gap
 *     when it runs the control`).
 *   - 11 already had a check and it was mutation-tested here rather than
 *     assumed. Each carries its witness — the verbatim mutant and the verbatim
 *     assertion that reddened — in the comment beside the claim.
 *   - 2 were found to have a check that could NOT redden and were repaired: the
 *     `lifterWithStanding` fixture whose two fields were the same number by
 *     construction, and `refuses a horizon longer than CALENDAR_MAX_SLOTS before
 *     it builds it`, whose own name was about an ordering nothing observed.
 *   - The remaining 17 are claims whose check was read and judged adequate
 *     WITHOUT running a mutation. THAT IS NOT EVIDENCE, and CLAUDE.md is
 *     explicit that an unverified pointer is not a known defect either. They are
 *     tracked debt, to be closed when their module is next touched. Two of the
 *     four that were mutation-tested for the first time in this pass came back
 *     needing repair, so the honest expectation for the other 17 is that some of
 *     them do too.
 *
 * No `@guarantee` tags were added. `MUTATION_WITNESSES` lives in
 * `src/game/guaranteeTags.test.ts`, which is another session's file, and a tag
 * with no registry row is exactly the unbacked pointer that file exists to
 * refuse. The witnesses are therefore in prose beside their claims, which is
 * durable but not machine-resolvable: nothing expires one when its subject is
 * edited away. That is a real weakness of this form and it is stated rather than
 * left for a reader to discover.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { CAREER_TUNING } from './careerTuning';
import {
  CAREER_FEDERATIONS,
  buildCareerCalendar,
  createCareerLifter,
  meetEligibility,
  qualifyingTotalKgFor,
  type CareerFederation,
  type CareerLifter,
  type CareerMeetSlot,
  type CareerQualifyingGate,
} from './careerCore';
import {
  careerGateFaults,
  careerStanding,
  createCareerRecord,
  qualifiedTierFor,
  recordMeetResult,
  type CareerRecord,
} from './careerRecord';

const HERE = path.dirname(new URL(import.meta.url).pathname);

const SHIPPED = readdirSync(HERE)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .sort();

const SOURCE_OF = new Map<string, string>(
  SHIPPED.map((name) => [name, readFileSync(path.join(HERE, name), 'utf8')]),
);

const source = (name: string): string => SOURCE_OF.get(name) ?? '';

/**
 * Source as the code scan reads it: comments gone, then quoted strings gone.
 *
 * Comments first, so an apostrophe inside prose ("the career's day zero") is
 * already removed and cannot open a phantom string literal. Template literals
 * survive on purpose — `${...}` is code.
 */
function scannableCode(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

// ===========================================================================
// 1. The numeric-total probe — behavioural, and the stronger instrument
// ===========================================================================

/**
 * `Total` bound to `number`, which is what the wrapped fixtures cannot be.
 *
 * `ConfirmedTotalKg` in `src/game/progression.ts` is a BRANDED NUMBER, so this
 * binding is nearer to the wiring piece's than the wrapper is. Under a branded
 * number every coercion vector in the ban below returns the real kilograms.
 */
type NumericTotal = number;

/** Larger than every requirement in the table, so any coercion admits. */
const HUGE_TOTAL_KG: NumericTotal = 1_000_000;

/** Falsy as well as small, so a `!total` mutant is caught with the rest. */
const TINY_TOTAL_KG: NumericTotal = 0;

const REFUSING_GATE: CareerQualifyingGate<NumericTotal> = () => false;
const ADMITTING_GATE: CareerQualifyingGate<NumericTotal> = () => true;

const FED = CAREER_FEDERATIONS[0] as CareerFederation;
const HORIZON = 400;
const CALENDAR = buildCareerCalendar({ federationId: FED.id, throughDayIndex: HORIZON });

const GATED_SLOTS: readonly CareerMeetSlot[] = CALENDAR.filter(
  (slot) => qualifyingTotalKgFor(slot.tier, 'mens') !== null,
);
const OPEN_SLOTS: readonly CareerMeetSlot[] = CALENDAR.filter(
  (slot) => qualifyingTotalKgFor(slot.tier, 'mens') === null,
);

const NUMERIC_LIFTER: CareerLifter<NumericTotal> = createCareerLifter(FED.id, 'mens');

const BODYWEIGHT_KG = 92.5;

describe('a numeric total cannot get past the injected gate', () => {
  it('has a gated domain and an open one, so neither sweep below is empty', () => {
    // Counts, not bounds. Every sweep in this block walks one of these two
    // lists, and a list that had gone empty would make all of them pass.
    expect(CALENDAR.length).toBe(90);
    expect(GATED_SLOTS.length).toBe(33);
    expect(OPEN_SLOTS.length).toBe(57);
    expect(GATED_SLOTS.length + OPEN_SLOTS.length).toBe(CALENDAR.length);
  });

  it('refuses every gated meet to an enormous numeric total when the gate says no', () => {
    // THE CHECK THE PLANTED MUTANT WAS INVISIBLE TO. With `Total` bound to
    // `number` and `bestTotal` at a million kilograms, ANY route from the total
    // to a number admits this lifter — `Number(total)`, `+total`,
    // `total as unknown as number`, `total.valueOf()`, a widened field type, or
    // a coercion nobody has thought of yet. The gate says no to all of them, so
    // the only correct verdict is a refusal.
    //
    // Reddens on: `Number(lifter.bestTotal) >= requiredKg` anywhere on
    // `meetEligibility`'s path. MEASURED: with that line planted this reports
    // `expected 'eligible' to be 'below-qualifying-total'` and `admitted` goes
    // to 33.
    //
    // Every lifter here is fresh — no entries, so no gap refusal — and every
    // verdict is taken on the slot's own day, so visibility is `open`. That
    // makes `below-qualifying-total` the ONLY refusal available, which is what
    // stops this passing for an unrelated reason.
    const rich: CareerLifter<NumericTotal> = { ...NUMERIC_LIFTER, bestTotal: HUGE_TOTAL_KG };
    let refused = 0;
    let admitted = 0;
    for (const slot of GATED_SLOTS) {
      const verdict = meetEligibility(slot, rich, slot.dayIndex, REFUSING_GATE);
      expect(verdict.kind, `${slot.slotId} admitted a total the gate refused`).toBe(
        'below-qualifying-total',
      );
      if (verdict.kind === 'eligible') admitted += 1;
      else refused += 1;
    }
    // Pinned at zero, with the sweep's own size beside it so an empty domain
    // reports itself rather than passing.
    expect(admitted).toBe(0);
    expect(refused).toBe(GATED_SLOTS.length);

    // Non-vacuity in the other direction: the same lifter on the same days IS
    // admitted to the open tier, so the refusals above are the gate's answer
    // and not this lifter being unable to enter anything at all.
    let openAdmissions = 0;
    for (const slot of OPEN_SLOTS) {
      expect(meetEligibility(slot, rich, slot.dayIndex, REFUSING_GATE).kind).toBe('eligible');
      openAdmissions += 1;
    }
    expect(openAdmissions).toBe(OPEN_SLOTS.length);
  });

  it('admits every gated meet to a zero numeric total when the gate says yes', () => {
    // The other arm of the same conditional, written because CLAUDE.md's
    // "the branch immediately below the one you just fixed" rule has paid out
    // three times this session. A laundered comparison can be used to REFUSE as
    // easily as to admit — `if (Number(total) < requiredKg) return
    // { kind: 'below-qualifying-total', requiredKg }` — and the check above
    // cannot see that one, because its lifter is over every threshold.
    //
    // Reddens on: that refusing form. MEASURED: with it planted this reports
    // `expected 'below-qualifying-total' to be 'eligible'` and `admitted` goes
    // to 0.
    //
    // `TINY_TOTAL_KG` is zero rather than one so that a `!lifter.bestTotal`
    // mutant — which would read a legitimate zero-kilogram total as "no total
    // recorded" — is caught here too.
    const poor: CareerLifter<NumericTotal> = { ...NUMERIC_LIFTER, bestTotal: TINY_TOTAL_KG };
    let admitted = 0;
    for (const slot of GATED_SLOTS) {
      expect(meetEligibility(slot, poor, slot.dayIndex, ADMITTING_GATE).kind, slot.slotId).toBe(
        'eligible',
      );
      admitted += 1;
    }
    expect(admitted).toBe(GATED_SLOTS.length);
  });

  it('reads no number out of a numeric total when it walks the ladder', () => {
    // `careerRecord.ts`'s half of the same claim: "No `>` on a `Total` appears
    // here and none would compile." `qualifiedTierFor` walks the ladder top
    // down and asks the gate at each rung, so under a refusing gate the only
    // tier it may return is the open one.
    //
    // Reddens on: `qualifiedTierFor` comparing the total itself. MEASURED with
    // `if (Number(total) >= requiredKg) return tier;` planted above the gate
    // call: `expected 'worlds' to be 'local'`.
    expect(qualifiedTierFor(HUGE_TOTAL_KG, 'mens', REFUSING_GATE)).toBe('local');
    expect(qualifiedTierFor(HUGE_TOTAL_KG, 'womens', REFUSING_GATE)).toBe('local');
    // And the reverse arm: a zero total the gate admits reaches the top.
    expect(qualifiedTierFor(TINY_TOTAL_KG, 'mens', ADMITTING_GATE)).toBe('worlds');
    // Non-vacuity: a gate that actually reads the number gives a middle answer,
    // so 'local' and 'worlds' are two ends of a range this function can span
    // rather than the only two values it ever returns.
    const real: CareerQualifyingGate<NumericTotal> = (total, requiredKg) => total >= requiredKg;
    const regionalKg = qualifyingTotalKgFor('regional', 'mens') as number;
    expect(qualifiedTierFor(regionalKg, 'mens', real)).toBe('regional');
  });

  it('reads no number out of a numeric total when it computes standing', () => {
    // The same question one level up, through the write path, so a coercion in
    // `standingOver` rather than in `qualifiedTierFor` is covered too.
    //
    // Reddens on: `standingOver` comparing `result.total` to anything.
    const slots = GATED_SLOTS.slice(0, 3);
    const lifter: CareerLifter<NumericTotal> = {
      ...NUMERIC_LIFTER,
      enteredSlotIds: slots.map((slot) => slot.slotId),
      lastEntryDayIndex: (slots[slots.length - 1] as CareerMeetSlot).dayIndex,
    };
    let record: CareerRecord<NumericTotal> = createCareerRecord<NumericTotal>();
    let recorded = 0;
    for (const slot of slots) {
      const outcome = recordMeetResult(record, lifter, slot, {
        total: HUGE_TOTAL_KG,
        bodyweightKg: BODYWEIGHT_KG,
      });
      if (outcome.kind !== 'recorded') throw new Error(`refused: ${outcome.reason.kind}`);
      record = outcome.record;
      recorded += 1;
    }
    expect(recorded).toBe(3);

    const refused = careerStanding(record, 'mens', REFUSING_GATE);
    expect(refused.qualifiedTier).toBe('local');
    expect(refused.totalsPosted).toBe(3);
    // Non-vacuity: the same record under an admitting gate reaches the top, so
    // 'local' above is this gate's answer rather than the only answer available.
    expect(careerStanding(record, 'mens', ADMITTING_GATE).qualifiedTier).toBe('worlds');
  });

  it('asks the gate about a numeric total rather than ordering totals itself', () => {
    // `careerGateFaults` is the one function here that takes a LIST of totals,
    // and its docstring says a total is named by its index "because a `Total` is
    // opaque here and stringifying one would be this module looking inside it".
    //
    // Reddens on: `careerGateFaults` sorting, comparing or printing the totals
    // it was handed. Under a refusing gate every total's pass-set is
    // {open tier} — downward closed — so the honest answer is no faults, and
    // under a band gate it is not.
    const totals: readonly NumericTotal[] = [TINY_TOTAL_KG, HUGE_TOTAL_KG];
    expect(careerGateFaults(REFUSING_GATE, totals, 'mens')).toEqual([]);
    expect(careerGateFaults(ADMITTING_GATE, totals, 'mens')).toEqual([]);
    // Non-vacuity: a gate whose pass-set is a band is reported, so the empty
    // lists above are an answer rather than a function that returns nothing.
    const band: CareerQualifyingGate<NumericTotal> = (_total, requiredKg) =>
      requiredKg >= (qualifyingTotalKgFor('nationals', 'mens') as number);
    const faults = careerGateFaults(band, totals, 'mens');
    expect(faults.length).toBeGreaterThan(0);
    expect(faults.join('\n')).toMatch(/not a rung on a ladder/);
    // And no fault sentence carries a total's VALUE, only its index — which is
    // the docstring's claim, checked rather than asserted.
    expect(faults.join('\n')).not.toMatch(new RegExp(String(HUGE_TOTAL_KG)));
    expect(faults.join('\n')).toMatch(/total #\d/);
  });
});

// ===========================================================================
// 2. The source ban — syntactic, and the instrument that sees dead code
// ===========================================================================

/**
 * A VALUE that holds an opaque total, by this directory's naming convention.
 *
 * Matches `total`, `bestTotal`, `qualifyingTotal`. Deliberately does NOT match:
 *
 *   - `Total` — the type parameter. Every generic in this directory is spelled
 *     `<Total>`, so including it would make `CareerRecord<Total>` fire the
 *     ordering rows on the closing angle bracket. Excluding it costs nothing:
 *     a type never appears in a value position.
 *   - `qualifyingTotalKg`, `ghostTotalsKg`, `QUALIFYING_TOTAL_KG_BY_TIER` — these
 *     are NUMBERS, the requirement side of the comparison, and comparing them
 *     is the whole point of a qualifying table.
 *   - `totalsPosted` — a count.
 *
 * The exclusions are the reason this can be a ban rather than a warning: every
 * one of them is a shape the shipped modules already contain, so a rule that
 * caught them would have to be suppressed on the day it landed.
 */
const TOTAL_REF = String.raw`\b(?:total|[a-z][A-Za-z0-9_$]*Total)\b`;

/** The plural: an ARRAY of opaque totals. `totals.length` is legitimate. */
const TOTALS_REF = String.raw`\b(?:totals|[a-z][A-Za-z0-9_$]*Totals)\b`;

/**
 * One banned pattern.
 *
 * `scope` decides what the pattern is run against. `'code'` is comments and
 * quoted strings stripped; `'source'` is the raw file, and exists for exactly
 * one row — a `@ts-expect-error` suppression, which IS a comment and which a
 * code-only scan therefore cannot see. `src/empire/`'s ban has no such row and
 * cannot grow one without this field; that is the hole this copy closes.
 */
interface BannedPattern {
  readonly id: string;
  readonly scope: 'code' | 'source';
  readonly pattern: RegExp;
  /** A string this pattern MUST match, so a dead regex reports itself. */
  readonly tripwire: string;
  readonly why: string;
}

const BANNED: readonly BannedPattern[] = [
  // -------------------------------------------------------------------------
  // Subject-independent: a `Total` cannot become a number without one of these,
  // whatever it is named. These are the load-bearing rows.
  // -------------------------------------------------------------------------
  {
    id: 'number-call',
    scope: 'code',
    pattern: /\bNumber\s*\(/,
    tripwire: 'if (Number(lifter.bestTotal) >= requiredKg) return { kind: 1 };',
    why: 'the exact planted mutant. `Number.isInteger` and `Number.isFinite` are property reads and stay legal.',
  },
  {
    id: 'string-call',
    scope: 'code',
    pattern: /\bString\s*\(/,
    tripwire: 'const label = String(total);',
    why: 'stringify then parse is a two-step coercion, and careerRecord.ts promises it prints an index instead.',
  },
  {
    id: 'parse-float',
    scope: 'code',
    pattern: /\bparseFloat\s*\(/,
    tripwire: 'const kgs = parseFloat(label);',
    why: 'the second step of that two-step.',
  },
  {
    id: 'parse-int',
    scope: 'code',
    pattern: /\bparseInt\s*\(/,
    tripwire: 'const kgs = parseInt(label, 10);',
    why: 'the same, rounded.',
  },
  {
    id: 'value-of',
    scope: 'code',
    pattern: /\.\s*valueOf\s*\(/,
    tripwire: 'if (total.valueOf() >= requiredKg) return true;',
    why: 'the coercion protocol, called by hand.',
  },
  {
    id: 'to-primitive',
    scope: 'code',
    pattern: /Symbol\s*\.\s*toPrimitive/,
    tripwire: "const kgs = total[Symbol.toPrimitive]('number');",
    why: 'the same protocol by its other name.',
  },
  {
    id: 'to-fixed',
    scope: 'code',
    pattern: /\.\s*toFixed\s*\(/,
    tripwire: 'const label = total.toFixed(1);',
    why: 'a numeric method, so reaching it means the value is already a number.',
  },
  {
    id: 'to-string',
    scope: 'code',
    pattern: /\.\s*toString\s*\(/,
    tripwire: 'const label = total.toString();',
    why: 'the other half of stringify-then-parse.',
  },
  {
    id: 'big-int',
    scope: 'code',
    pattern: /\bBigInt\s*\(/,
    tripwire: 'const kgs = BigInt(total);',
    why: 'a coercion that is not spelled Number.',
  },
  {
    id: 'json-round-trip',
    scope: 'code',
    pattern: /\bJSON\s*\.\s*(?:parse|stringify)\s*\(/,
    tripwire: 'const kgs = JSON.parse(JSON.stringify(total));',
    why: 'a round trip through text erases a brand and unwraps a wrapper in one line.',
  },
  {
    id: 'structured-clone',
    scope: 'code',
    pattern: /\bstructuredClone\s*\(/,
    tripwire: 'const copy = structuredClone(total);',
    why: 'the same erasure without the text.',
  },
  {
    id: 'as-number',
    scope: 'code',
    pattern: /\bas\s+number\b/,
    tripwire: 'const kgs = total as number;',
    why: 'the direct assertion. `as const`, `as CareerTier` and `as Total` stay legal.',
  },
  {
    id: 'as-unknown',
    scope: 'code',
    pattern: /\bas\s+unknown\b/,
    tripwire: 'const kgs = total as unknown as number;',
    why: 'the assertion that works when the direct one is refused.',
  },
  {
    id: 'as-any',
    scope: 'code',
    pattern: /\bas\s+any\b/,
    tripwire: 'const kgs = total as any;',
    why: 'CLAUDE.md bans `any` outright; here it is also a type strip.',
  },
  {
    id: 'as-shape',
    scope: 'code',
    pattern: /\bas\s*\{/,
    tripwire: 'const kgs = (standing.qualifyingTotal as { kg: number }).kg;',
    why:
      'a cast to a STRUCTURAL type, which is neither `number` nor `unknown` nor `any` and which ' +
      'every one of those three rows missed. FOUND BY A SURVIVING MUTANT, not by inspection: ' +
      'planting the tripwire above into `lifterWithStanding` left the ban green.',
  },
  {
    id: 'cast-of-total',
    scope: 'code',
    pattern: new RegExp(`${TOTAL_REF}\\s*\\)?\\s+as\\b`),
    tripwire: 'const kgs = (standing.qualifyingTotal as { kg: number }).kg;',
    why:
      'the other half of the same finding, keyed on the subject instead of the target type: a ' +
      'total may not be cast to ANYTHING. `totals[index] as Total` stays legal because `totals` ' +
      'is deliberately not a subject.',
  },
  {
    id: 'any-annotation',
    scope: 'code',
    pattern: /:\s*any\b/,
    tripwire: 'const kgs: any = lifter.bestTotal;',
    why: 'the same strip written as a declaration.',
  },
  {
    id: 'eval-call',
    scope: 'code',
    pattern: /\beval\s*\(/,
    tripwire: 'const ok = eval(expression);',
    why: 'the only way a banned pattern hidden in a stripped string becomes executable.',
  },
  {
    id: 'new-function',
    scope: 'code',
    pattern: /\bnew\s+Function\s*\(/,
    tripwire: 'const ok = new Function(a, b);',
    why: 'the same, spelled differently.',
  },
  {
    id: 'ts-suppression',
    scope: 'source',
    pattern: /@ts-(?:ignore|expect-error|nocheck)/,
    tripwire: '// @ts-expect-error the compiler is wrong about this total',
    why:
      'the way a comparison the compiler refuses gets shipped anyway. It IS a comment, so the ' +
      'code scan cannot see it — this row is why `scope` exists.',
  },

  // -------------------------------------------------------------------------
  // Subject-keyed: an operator applied to something this directory names like a
  // total. These catch the case where the TYPE was widened to `number` and no
  // coercion was needed at all.
  // -------------------------------------------------------------------------
  {
    id: 'ordering-left',
    scope: 'code',
    pattern: new RegExp(`${TOTAL_REF}\\s*\\)?\\s*(?:<=|>=|<|>)`),
    tripwire: 'if (lifter.bestTotal >= requiredKg) return { kind: 1 };',
    why: 'the direct form. `tsc` refuses it today; the suite does not run `tsc`.',
  },
  {
    id: 'ordering-right',
    scope: 'code',
    pattern: new RegExp(`(?:<=|>=|<|>)\\s*[(!+~-]*\\s*${TOTAL_REF}`),
    tripwire: 'if (requiredKg <= qualifyingTotal) return true;',
    why: 'the same comparison with the operands swapped.',
  },
  {
    id: 'paren-ordering',
    scope: 'code',
    pattern: new RegExp(`${TOTAL_REF}[^\\n)]*\\)\\s*(?:<=|>=|<|>)`),
    tripwire: 'if ((lifter.bestTotal ?? 0) >= requiredKg) return { kind: 1 };',
    why:
      'the form that defeats `ordering-left`: a nullish default or a cast puts a closing paren ' +
      'between the total and the operator.',
  },
  {
    id: 'arith-left',
    scope: 'code',
    pattern: new RegExp(`${TOTAL_REF}\\s*[-+*/%]`),
    tripwire: 'const margin = total - requiredKg;',
    why: 'arithmetic is a comparison one step away, and a sort comparator is written as a subtraction.',
  },
  {
    id: 'arith-right',
    scope: 'code',
    pattern: new RegExp(`[-+*/%]\\s*${TOTAL_REF}`),
    tripwire: 'const margin = requiredKg - total;',
    why: 'the same, swapped. Quoted strings are stripped first, or the tag `below-qualifying-total` would trip this.',
  },
  {
    id: 'unary-plus',
    scope: 'code',
    pattern: new RegExp(`(?:[=(,\\[?:]|=>|\\breturn\\b)\\s*\\+\\s*(?:total|[a-z][A-Za-z0-9_$]*Total)\\b`),
    tripwire: 'const kgs = +total;',
    why: 'the shortest coercion in the language. `arith-right` also catches it; this row names it.',
  },
  {
    id: 'literal-equality',
    scope: 'code',
    pattern: new RegExp(`${TOTAL_REF}\\s*[!=]==?\\s*-?\\d`),
    tripwire: 'if (total === 600) return true;',
    why: 'comparing a total to a NUMBER. `total === null` is a different question and stays legal.',
  },
  {
    id: 'member-read',
    scope: 'code',
    pattern: new RegExp(`${TOTAL_REF}\\s*\\??\\s*\\.`),
    tripwire: 'return total.kg >= requiredKg;',
    why: 'looking inside a total at all. `totals.length` is legal because `totals` is a different word.',
  },
  {
    id: 'destructure-total',
    scope: 'code',
    pattern: new RegExp(
      `[}\\]]\\s*=\\s*(?:[\\w$]+\\s*\\.\\s*)*(?:total|[a-z][A-Za-z0-9_$]*Total)\\b`,
    ),
    tripwire: 'const { kg } = lifter.bestTotal;',
    why:
      'looking inside without writing a dot. The dotted-path prefix is not decoration: without ' +
      'it this row matched `= total` and NOT `= lifter.bestTotal`, and its own tripwire is what ' +
      'caught that — the row was a dead letter for the exact expression it was written about.',
  },
  {
    id: 'object-introspection',
    scope: 'code',
    pattern: new RegExp(
      `\\bObject\\s*\\.\\s*(?:values|entries|keys|assign|getOwnPropertyNames)\\s*\\([^)]*(?:${TOTAL_REF}|${TOTALS_REF})`,
    ),
    tripwire: 'const kgs = Object.values(total)[0];',
    why:
      'looking inside without naming the field. `Object.freeze` stays legal. The plural is in the ' +
      'alternation because `Object.values(totals[0])` reads the same field off the same value.',
  },
  {
    id: 'interpolate-total',
    scope: 'code',
    pattern: new RegExp(`\\$\\{[^}]*${TOTAL_REF}[^}]*\\}`),
    tripwire: 'faults.push(`the gate admits ${total} at nationals`);',
    why:
      "careerRecord.ts's `careerGateFaults` promises it names a total by its INDEX because " +
      'printing one would be looking inside it. This is that promise.',
  },
  {
    id: 'totals-element-op',
    scope: 'code',
    pattern: new RegExp(`${TOTALS_REF}\\s*\\[[^\\]]*\\]\\s*(?:<=|>=|<|>|[-+*/%])`),
    tripwire: 'if (totals[index] >= requiredKg) return true;',
    why: 'the element of the array, since `totals` itself is deliberately not a subject.',
  },
  {
    id: 'math-on-total',
    scope: 'code',
    pattern: new RegExp(`\\bMath\\s*\\.\\s*\\w+\\s*\\([^)]*${TOTAL_REF}`),
    tripwire: 'const best = Math.max(bestTotal, other);',
    why: '`Math.max` on two totals is an ordering. `Math.floor` on a day index is not, and stays legal.',
  },

  // -------------------------------------------------------------------------
  // The seam itself
  // -------------------------------------------------------------------------
  {
    id: 'default-gate',
    scope: 'code',
    pattern: /:\s*CareerQualifyingGate\s*<[^>]*>\s*=/,
    tripwire: 'gate: CareerQualifyingGate<Total> = (a, b) => a >= b,',
    why:
      "careerCore.ts's header: \"There is deliberately no default gate. A default is the thing " +
      'that lets a caller forget to inject, and a defaulted `(a, b) => a >= b` would be exactly ' +
      'the locally-summed comparison the fence exists to refuse." That sentence had nothing ' +
      'behind it; this row is it.',
  },
];

/**
 * Shapes the ban must NOT refuse.
 *
 * Every line here is a real idiom from `src/career/`'s shipped modules or a
 * near neighbour of one. A ban that catches these is a ban somebody has to
 * suppress on the day it lands, and CLAUDE.md is explicit that a narrow honest
 * ban beats a broad one that has to be suppressed everywhere.
 *
 * The primary precision check is still `finds nothing in any shipped module` —
 * that one runs over the real files and cannot go stale. This corpus adds the
 * shapes the tree does not currently contain but legitimately could.
 */
const ALLOWED: readonly string[] = [
  'if (!Number.isInteger(slot.dayIndex) || slot.dayIndex < 0) {',
  'if (!Number.isFinite(contest.bodyweightKg) || contest.bodyweightKg <= 0) {',
  'if (latest === null || result.dayIndex > latest) latest = result.dayIndex;',
  'const requiredKg = slot.qualifyingTotalKg[lifter.category];',
  'if (slot.qualifyingTotalKg[category] !== expected[category]) {',
  'if (result.total === null) { bombOuts += 1; continue; }',
  'if (lifter.bestTotal === null) return { kind: 1, requiredKg };',
  'totalsPosted += 1;',
  'for (let index = 0; index < totals.length; index += 1) {',
  'const total = totals[index] as Total;',
  'export function careerStanding<Total>(record: CareerRecord<Total>): CareerStanding<Total> {',
  'readonly total: Total | null;',
  'readonly ghostTotalsKg: readonly number[];',
  'return Math.floor((throughDayIndex - first) / interval) + 1;',
  'worstDeficit: Math.max(left.worstDeficit, right.worstDeficit),',
  'const tier = qualifiedTierFor(result.total, category, gate);',
  'if (!gate(lifter.bestTotal, requiredKg)) {',
  'qualifyingTotal = result.total;',
  'if (standingRank(tier) > standingRank(qualifiedTier)) {',
  'gate: CareerQualifyingGate<Total>,',
  'wiring: CareerStandingWiring = shippedCareerStandingWiring(),',
  'const requirement: Record<CareerQualifyingCategory, number | null> = {',
];

describe('no shipped module can strip an opaque total', () => {
  it('has the modules the ban walks', () => {
    // Counts, not bounds. The scan below iterates this list and an empty list
    // would make it pass. Pinned by name, so a fifth shipped module is a line
    // somebody adds here on purpose.
    expect(SHIPPED).toEqual([
      'careerCore.ts',
      'careerEngagement.ts',
      'careerRecord.ts',
      'careerTuning.ts',
    ]);
    expect(SOURCE_OF.size).toBe(SHIPPED.length);
  });

  it('finds nothing in any shipped module', () => {
    // The ban itself. Reddens on: any coercion of a `Total` to a number in a
    // shipped module, by any of the thirty-four routes below.
    const findings: string[] = [];
    let scanned = 0;
    let checks = 0;
    for (const name of SHIPPED) {
      const raw = source(name);
      const code = scannableCode(raw);
      // The strips are checked rather than assumed, so a scan over an empty
      // string cannot pass silently.
      expect(code.length, `${name} stripped to nothing`).toBeGreaterThan(0);
      expect(code, `${name} lost its declarations to the strip`).toMatch(/export /);
      for (const banned of BANNED) {
        const text = banned.scope === 'code' ? code : raw;
        for (const line of text.split('\n')) {
          if (banned.pattern.test(line)) findings.push(`${name} [${banned.id}] ${line.trim()}`);
        }
        checks += 1;
      }
      scanned += 1;
    }
    // The claim, with the offenders in the message rather than a length.
    expect(findings.join('\n')).toBe('');

    // Counts, not bounds, and the one with a SUBJECT is the product: a module
    // added to this directory or one that stopped being read moves 136 as
    // surely as a shortened ban list does.
    expect(scanned).toBe(SHIPPED.length);
    expect(checks).toBe(SHIPPED.length * BANNED.length);
    expect(checks).toBe(136);
    // `BANNED.length` on its own is a fact about THIS FILE and no state of
    // `src/career/` can move it — it is pinned because a shortened list should
    // be a signed edit, not because it is evidence about the subject.
    expect(BANNED.length).toBe(34);
    expect(new Set(BANNED.map((banned) => banned.id)).size).toBe(BANNED.length);
    expect(BANNED.filter((banned) => banned.scope === 'source').length).toBe(1);
  });

  it('drives every banned pattern against a string it must catch', () => {
    // Non-vacuity, one tripwire per row: a regex that stopped matching anything
    // reports itself instead of passing quietly forever.
    //
    // The tripwires live on the rows rather than in a parallel array, because
    // `src/empire/`'s ban keeps them in a second array and had to delete an
    // `expect(tripwires.length).toBe(banned.length)` line that compared two
    // arrays declared eight lines apart. Pairing them structurally removes the
    // question.
    let live = 0;
    for (const banned of BANNED) {
      expect(banned.tripwire, `pattern ${banned.id} matches nothing`).toMatch(banned.pattern);
      live += 1;
    }
    expect(live).toBe(BANNED.length);
    // Every row says why it is here, so a reader deleting one knows what they
    // are deleting.
    expect(BANNED.filter((banned) => banned.why.length > 0).length).toBe(BANNED.length);
  });

  it('leaves this directory’s real idioms alone', () => {
    // Precision. The ban must be narrow enough to live with, or the first
    // person to hit a false positive weakens it rather than the code.
    //
    // Reddens on: widening any row until it catches a legal comparison — the
    // most likely being an ordering row that starts matching `<Total>`, which
    // is how the first draft of `ordering-right` failed.
    const refusals: string[] = [];
    let pairs = 0;
    for (const line of ALLOWED) {
      for (const banned of BANNED) {
        if (banned.scope === 'source') continue;
        if (banned.pattern.test(scannableCode(line))) {
          refusals.push(`[${banned.id}] ${line}`);
        }
        pairs += 1;
      }
    }
    expect(refusals.join('\n')).toBe('');
    // Counts, not bounds, on the corpus itself.
    expect(ALLOWED.length).toBe(22);
    expect(pairs).toBe(ALLOWED.length * (BANNED.length - 1));
  });

  it('reads the subject vocabulary the way its docstring says', () => {
    // `TOTAL_REF` is the whole precision story of the subject-keyed rows, and
    // its exclusions are load-bearing rather than incidental. Asserted directly
    // so a widening is red here, at the definition, rather than fifty lines
    // down as a mystery false positive.
    //
    // Reddens on: adding `Total` to `TOTAL_REF`, or dropping the `\b` that
    // keeps `qualifyingTotalKg` out.
    const subject = new RegExp(TOTAL_REF);
    const plural = new RegExp(TOTALS_REF);
    const matches: readonly string[] = ['total', 'bestTotal', 'qualifyingTotal', 'lifter.bestTotal'];
    const misses: readonly string[] = [
      'Total',
      'CareerRecord<Total>',
      'qualifyingTotalKg',
      'ghostTotalsKg',
      'QUALIFYING_TOTAL_KG_BY_TIER',
      'totalsPosted',
      'totals',
    ];
    let checked = 0;
    for (const value of matches) {
      expect(subject.test(value), `${value} should be a subject`).toBe(true);
      checked += 1;
    }
    for (const value of misses) {
      expect(subject.test(value), `${value} should not be a subject`).toBe(false);
      checked += 1;
    }
    expect(checked).toBe(matches.length + misses.length);
    expect(checked).toBe(11);
    // The plural is the mirror image, and `totals.length` is why it exists.
    expect(plural.test('totals')).toBe(true);
    expect(plural.test('ghostTotalsKg')).toBe(false);
    expect(plural.test('totalsPosted')).toBe(false);
  });

  it('strips comments and quoted strings but not template holes', () => {
    // The strip is itself a subject, and a strip that ate too much would make
    // every scan above vacuous. Three properties, each with a case.
    //
    // Reddens on: stripping template literals, which would blind
    // `interpolate-total`; or failing to strip quoted strings, which would make
    // `arith-right` fire on the tag `'below-qualifying-total'`.
    expect(scannableCode("const x = 'below-qualifying-total';")).toBe("const x = '';");
    expect(scannableCode('/* Number(total) */ const y = 1;')).toBe(' const y = 1;');
    expect(scannableCode('const z = 1; // Number(total)')).toBe('const z = 1; ');
    // A template hole survives, so code inside one is still scanned.
    expect(scannableCode('const w = `${Number(total)}`;')).toContain('Number(total)');
    // And the shipped modules really do contain quoted strings the strip
    // removed, so the strip did something rather than nothing.
    expect(source('careerCore.ts')).toContain("'below-qualifying-total'");
    expect(scannableCode(source('careerCore.ts'))).not.toContain("'below-qualifying-total'");
  });
});
