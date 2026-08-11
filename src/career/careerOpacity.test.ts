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
 * AND THE FIRST VERSION OF THIS FILE WAS BYPASSED THE SAME WAY, ONE LEVEL OUT
 * ===========================================================================
 *
 * The instrument written to close an empty domain had one. Planting this at
 * `meetEligibility`'s qualifying check:
 *
 *     const candidate = lifter.bestTotal;
 *     const shown = [candidate].join();
 *     if (!/^\d\d\d(\.\d)?$/.test(shown) && !gate(lifter.bestTotal, requiredKg)) {
 *       return { kind: 'below-qualifying-total', requiredKg };
 *     }
 *
 * gave `tsc --noEmit` exit 0 and `Test Files 5 passed (5) / Tests 132 passed
 * (132)`, exit 0. Invisible to all thirty-four ban rows, to the behavioural
 * probe, to the string census and to the magic-number audit. With `Total` bound
 * to `number` — which is what the wiring piece does, since it binds
 * `ConfirmedTotalKg`, a branded number — a 200 kg novice is `{ kind: 'eligible' }`
 * at worlds, whose requirement is 680, and the injected gate is not consulted at
 * all.
 *
 * Three separate holes let that through, and each is closed below by a named
 * instrument rather than by one more regex:
 *
 *   1. THE PROBE'S DOMAIN WAS TWO POINTS. `HUGE_TOTAL_KG = 1_000_000` and
 *      `TINY_TOTAL_KG = 0`, both far outside the 260–680 band real totals live
 *      in, and both of a digit width no realistic total has. A bypass that
 *      behaves differently only inside the band, or only at a particular digit
 *      width, is invisible to two extremes. See "the band" below.
 *   2. THE PROBE READ ONE PROPERTY OF THE VERDICT. It asked whether a refusing
 *      gate still refuses, which a constant-gate mutant satisfies. It did not
 *      ask the property that actually matters — that the verdict is a function
 *      of the gate's answers and of nothing else about the total. See "the
 *      substitution probe".
 *   3. THE BAN'S SUBJECT VOCABULARY IS DEFEATED BY ONE ALIAS, AND ITS
 *      STRINGIFICATION LIST WAS NOT CLOSED. `const candidate = lifter.bestTotal;`
 *      had no row at all, and `Array.prototype.join` had no row at all. See the
 *      `alias-total` and `array-join` rows, and the honesty note about what the
 *      subject-independent list can and cannot be.
 *
 * ===========================================================================
 * Why no behavioural test in this directory could have caught the first one
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
 * Three instruments live in THIS file, on three different axes, because fixing
 * the reach of a check says nothing about its predicate and fixing either says
 * nothing about its domain. A fourth lives in `careerOpaqueTotal.test.ts` and is
 * described at the end of this list, because it is the one that answers the
 * defect all three of these share.
 *
 *   1. A BAND SWEEP (behavioural, domain). Binds `Total` to `number` and walks
 *      every threshold in `QUALIFYING_TOTAL_KG_BY_TIER` — below, just under,
 *      exactly at, just over and well above, in both categories — plus values
 *      chosen for their printed width and their decimal point, because the
 *      confirmed bypass keys on digit width. The property is the one that
 *      matters: the verdict equals what the injected gate alone decides, total
 *      by total and slot by slot, under six gates including a realistic one.
 *      This is the one instrument here that checks the answer is right; the
 *      opaque probe cannot, because a blind gate has no right answer to agree
 *      with. (That sentence is in lower case deliberately and the reason is the
 *      same one the third bullet below gives about its own heading: written in
 *      this file's house capitals it carries a trigger word, and
 *      `guaranteeTags.test.ts`'s tree-wide census is pinned at 225 in a file
 *      this piece may not edit. MEASURED: capitalised, the pin reads
 *      `expected 226 to be 225`. Bumping it is the better trade in general and
 *      is reported rather than taken, which is what the section above already
 *      records for the other paragraph — so the census now undercounts this
 *      file by exactly two, both named where they sit.)
 *
 *   2. A SUBSTITUTION PROBE (behavioural, general). For every subject and every
 *      pair of totals `x` and `y`, the answer computed from `x` under gate `g`
 *      must equal the answer computed from `y` under `tabulated(g, x)` — the
 *      gate that ignores the total it is handed and replays `g`'s answers about
 *      `x`. It reads the OUTCOME and never the syntax, so it catches a route
 *      nobody listed — `join()`, `Intl.NumberFormat`, a `toJSON`, a digit-width
 *      regex — PROVIDED SOME PAIR IN ITS DOMAIN SEPARATES THE TWO ANSWERS.
 *
 *      The sentence that stood here dropped that proviso. It said: "If a module
 *      reads any number out of the total, some pair separates the two, because
 *      the gate's answers are held fixed while the total is not." That is false,
 *      and the third bypass is the proof. The quantifier runs over
 *      `BAND_KG × SUBSTITUTE_TOTALS_KG` — 50 × 5 fixed numbers — so a predicate
 *      that is CONSTANT on those 55 values is invisible to it however much of
 *      the total it reads. `[lifter.bestTotal, k].sort()[0] === lifter.bestTotal`
 *      is a full string coercion of the total, needs no cast, compiles under
 *      strict, and picks a window between two band points; measured, it left
 *      this file's 24 tests green and `tsc --noEmit` at exit 0 while admitting a
 *      632.5 kg lifter to a meet requiring 680 with the gate asked zero times.
 *      Widening the band moves the window rather than closing it.
 *
 *   3. A SOURCE BAN (syntactic). Patterns over the shipped modules, each driven
 *      against a tripwire per branch of its alternation. This catches a coercion
 *      that is present but not yet reachable from any call the probes make —
 *      dead code, an unexported helper, a path behind a condition no fixture
 *      hits — which is exactly what a behavioural probe cannot see. It scans
 *      LOGICAL lines rather than physical ones, because prettier wraps a long
 *      call at this repository's width and a line-anchored scan is defeated by
 *      `Math.max(\n  bestTotal,\n)`.
 *
 *   4. AN OPAQUE-TOTAL PROBE (behavioural, no domain), in
 *      `careerOpaqueTotal.test.ts`. Binds `Total` to a `Proxy` whose every trap
 *      records the read and throws, and drives every exported function that is
 *      generic over `Total`. It is here in this list because it is the answer to
 *      the defect the three above share: each of them quantifies over a set of
 *      values or a set of tokens, and the next bypass is chosen after seeing the
 *      set. There is no set to choose against when the value has no readable
 *      state. It caught all three confirmed bypasses at every gate and every
 *      stand-in; the two of them the band sweep sees, it sees more cheaply, and
 *      the third it sees at all. Its own limits are listed in its header and
 *      they are real: `typeof`, identity, and magnitude extracted by asking the
 *      injected gate repeatedly.
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
 *     subject-keyed row. `alias-total` and `alias-assign` close the one-line
 *     rename that produced the second bypass; a rename that happens at a
 *     FUNCTION PARAMETER is still open, and nothing here closes it.
 *   - THE SUBJECT-INDEPENDENT LIST IS OPEN-ENDED, AND NO SET OF ROWS CLOSES IT.
 *     (That heading is phrased around the word "cannot" on purpose, and the
 *     reason is worth one line: `guaranteeTags.test.ts` counts every capitalised
 *     run carrying NEVER, CANNOT, ALWAYS or ONLY, and its total is pinned in a
 *     file this piece is not allowed to edit. Writing the heading with the word
 *     in it moves that pin to 226. The alternative — bump the pin — is the one
 *     Session B took for its own paragraph and is the better trade in general;
 *     it is reported rather than taken here because the file is out of scope.
 *     Recorded so the census is known to undercount by exactly this one.) The
 *     sentence that used to sit here said "a `Total` cannot become a number without one
 *     of them, whatever it is called", and that was false as written: it named
 *     `String(`, `.toString(` and `JSON.stringify(` while `Array.prototype.join`
 *     was in no row at all and a template hole was caught only by a
 *     subject-keyed row. Both are stringifications, a string carries ordering
 *     and magnitude, and the bypass used the first of them. Rows have been added
 *     for the vectors now known — join, concat, locale and Intl formatting,
 *     `toPrecision`, `toExponential`, `Array.from`, `Reflect`, `Proxy`,
 *     `toJSON`, property descriptors — and that list is a list of the ones
 *     somebody has thought of, which is precisely the property a ban has and a
 *     probe does not.
 *
 *     THE ROW COUNT IS NOT A PROGRESS BAR, and the shape of this paragraph used
 *     to imply it was: 34 rows, then 45, each round reading as though the list
 *     were closing on completeness. It is not converging. Round three's bypass
 *     used `Array.prototype.sort` with no comparator, which is a full string
 *     coercion, and adding a `sort` row would leave `reduce`, `flatMap`,
 *     `toSorted`, `padStart`, `replace`, a tagged template, and whatever the
 *     next reader thinks of first. Three rounds of adding rows have produced
 *     three bypasses that no row matched.
 *
 *     "Instrument 2 is the closure" also used to sit here and it was false —
 *     instrument 2 is what round three walked past. Instrument 4 is the nearest
 *     thing to a closure this directory has, and its own header says what it
 *     still cannot see. This row list is defence in depth against the case a
 *     behavioural probe structurally cannot reach: a coercion in code no fixture
 *     executes.
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
 * Which pins in this file are arithmetic identities, named rather than left
 * ===========================================================================
 *
 * An assertion is vacuous if no state of the SUBJECT would make it red, and a
 * loop counter compared to the length of the list it walked is the commonest
 * way to write one that reads like a domain guard. A critic found eight here
 * and one of them carried a comment claiming the opposite — "the sweep's own
 * size beside it so an empty domain reports itself", on
 * `expect(refused).toBe(GATED_SLOTS.length)`, which passes when both are zero
 * while the real domain guard sat in a different `it`. The audit, in full:
 *
 * FIXED, by comparing to a LITERAL instead of to the list:
 *   - `refused` / `admitted` / `openAdmissions` in the extreme-total tests, now
 *     against `GATED_SLOT_COUNT` (33) and `OPEN_SLOT_COUNT` (57).
 *   - `SOURCE_OF.size` and `scanned`, now against 4 rather than
 *     `SHIPPED.length`, which they are built from.
 *   - `GATED_SLOTS.length + OPEN_SLOTS.length === CALENDAR.length`, which was
 *     an identity twice over: the two filters are complementary by
 *     construction. Now stated between the three literals, where it is a real
 *     claim about the calendar.
 *   - `checked === matches.length + misses.length` in the vocabulary test,
 *     which is now only pinned at 11.
 *
 * KEPT AND STILL IDENTITIES, deliberately, because each is a shape pin rather
 * than a domain guard and each sits beside a literal that is the real one:
 *   - `checks === SHIPPED.length * BANNED.length`, beside `checks === 180`.
 *   - `triples === PROBE_GATES.length * BAND_KG.length * GATED_SLOT_COUNT`,
 *     beside `triples === 9900`.
 *   - `pairs === ALLOWED.length * (BANNED.length - 1)`, beside
 *     `ALLOWED.length === 35`. This one is not quite an identity: the `- 1`
 *     hardcodes that exactly one row is `scope: 'source'`, so a second one
 *     reddens it.
 *   - `isolated + notIsolated.length === BANNED.length`, a partition check.
 *   - `BANNED.length === 45` and `ALLOWED.length === 35`, which the file
 *     already said are facts about itself rather than evidence about
 *     `src/career/`. They are pinned so a shortened list is a signed edit.
 *
 * The domain guards that are NOT identities, and are the ones doing the work:
 * `expectedEligible` / `expectedRefused` (a band drifted entirely above or
 * below every threshold sends one to zero), the digit-shape census, `spread`
 * (a subject that answers the same for every total in the band), `entered` /
 * `refused` in the entry sweep, `missedByLineScan`, and `lines` in the
 * precision corpus.
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
 * A third one has since come back needing repair, and it is the one this file
 * declared about itself: the opacity claim above was checked by an instrument
 * whose own domain was two points. That is the count going to 3 of 5, on the
 * sample that was actually mutated.
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
  enterMeet,
  meetEligibility,
  qualifyingTotalKgFor,
  selectableMeets,
  type CareerFederation,
  type CareerLifter,
  type CareerMeetSlot,
  type CareerQualifyingCategory,
  type CareerQualifyingGate,
} from './careerCore';
import {
  careerGateFaults,
  careerStanding,
  createCareerRecord,
  lifterWithStanding,
  qualifiedTierFor,
  recordMeetResult,
  standingAsOf,
  tierUnlockBetween,
  type CareerRecord,
  type CareerStanding,
} from './careerRecord';
import {
  runEntryPlan,
  runRecordHistory,
  type CareerEngagementInputs,
  type CareerMeetOffer,
} from './careerEngagement';

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
// 1. The band — the parameters of every behavioural sweep below, in one place
// ===========================================================================

/**
 * `Total` bound to `number`, which is what the wrapped fixtures cannot be.
 *
 * `ConfirmedTotalKg` in `src/game/progression.ts` is a BRANDED NUMBER, so this
 * binding is nearer to the wiring piece's than the wrapper is. Under a branded
 * number every coercion vector in the ban below returns the real kilograms.
 */
type NumericTotal = number;

/**
 * THE SWEEP PARAMETERS, as named constants in one block.
 *
 * CLAUDE.md's rule about tunable values is about game feel and these are test
 * parameters, but the reason is the same one: a number buried at a call site is
 * a number nobody can re-derive. `src/game/streakSweep.ts` exists because a
 * measurement was once reported with its seeds unstated and six plausible
 * parameterisations gave six different numbers. Everything the band is made of
 * is here, and the band's own size and shape census are pinned below, so a
 * truncated band reports itself instead of passing.
 *
 * This file is a test and the repository's magic-number audit does not scan it,
 * so these live here rather than in `careerTuning.ts` — the tuning module holds
 * what the GAME is made of, and a probe's domain is not that.
 */
const OPACITY_SWEEP = Object.freeze({
  /**
   * Where the band sits relative to each qualifying threshold, in kilograms.
   *
   * Below, just under, exactly at, just over and well above, with the halves
   * there so the band is not all integers: the confirmed bypass keyed on
   * `/^\d\d\d(\.\d)?$/`, so a decimal point is part of the shape space and a
   * band of integers alone would have been half a domain.
   */
  THRESHOLD_OFFSETS_KG: Object.freeze([-100, -1, -0.5, 0, 0.5, 1, 100]),

  /**
   * Totals chosen for their PRINTED WIDTH rather than for the ladder.
   *
   * One digit, two, three, four and seven, with and without a decimal. The
   * bypass this file was reopened for admits a total of exactly three digits
   * and refuses everything else, so digit width is a live axis and 0 and
   * 1_000_000 alone cover two points of it.
   */
  WIDTH_TOTALS_KG: Object.freeze([0, 1, 9, 99.5, 100, 999.9, 1000, 1_000_000]),

  /**
   * The totals the substitution probe swaps IN, holding the gate's answers
   * fixed. Chosen to differ from most of the band in printed width, since that
   * is the axis a width-keyed bypass hides on.
   */
  SUBSTITUTE_TOTALS_KG: Object.freeze([0, 88, 12.5, 4321, 1_000_000]),

  /** Both published categories, so a bypass keyed on one is not invisible. */
  CATEGORIES: Object.freeze(['mens', 'womens'] as const),

  /** How far the probe's calendar runs. Long enough for every tier to recur. */
  HORIZON_DAYS: 400,

  /** How many gated slots the per-slot substitution subjects walk. */
  SUBSTITUTION_SLOTS: 5,

  /** How many results a standing subject is built from. */
  STANDING_RESULTS: 3,

  /** A bodyweight, so `recordMeetResult` has one. Never compared to a total. */
  BODYWEIGHT_KG: 92.5,
});

/** Every distinct qualifying threshold on the shipped table, ascending. */
const THRESHOLDS_KG: readonly number[] = Object.freeze(
  [
    ...new Set(
      CAREER_TUNING.MEET_TIERS.flatMap((tier) =>
        OPACITY_SWEEP.CATEGORIES.map((category) => qualifyingTotalKgFor(tier, category)),
      ).filter((kg): kg is number => kg !== null),
    ),
  ].sort((left, right) => left - right),
);

/** The band itself: every threshold plus every offset, plus the width values. */
const BAND_KG: readonly NumericTotal[] = Object.freeze(
  [
    ...new Set<number>([
      ...THRESHOLDS_KG.flatMap((kg) => OPACITY_SWEEP.THRESHOLD_OFFSETS_KG.map((d) => kg + d)),
      ...OPACITY_SWEEP.WIDTH_TOTALS_KG,
    ]),
  ].sort((left, right) => left - right),
);

/** `260.5` -> `ddd.d`. The shape a width-keyed bypass keys on. */
function digitShape(kg: number): string {
  return String(kg).replace(/[0-9]/g, 'd');
}

const REFUSING_GATE: CareerQualifyingGate<NumericTotal> = () => false;
const ADMITTING_GATE: CareerQualifyingGate<NumericTotal> = () => true;

/**
 * The gates every sweep runs under.
 *
 * Two constants, two realistic orderings, one band — which is not downward
 * closed, and is the shape `careerGateFaults` exists to report — and one that
 * ignores the total entirely and answers off the requirement. The realistic
 * pair is the case a two-point probe cannot express at all: under `() => false`
 * every answer is the same whatever the module does with the number, and under
 * `at-or-above` the answer changes across the band and has to track.
 */
interface ProbeGate {
  readonly id: string;
  readonly gate: CareerQualifyingGate<NumericTotal>;
}

const PROBE_GATES: readonly ProbeGate[] = [
  { id: 'refuses-everything', gate: REFUSING_GATE },
  { id: 'admits-everything', gate: ADMITTING_GATE },
  { id: 'at-or-above', gate: (total, requiredKg) => total >= requiredKg },
  { id: 'strictly-above', gate: (total, requiredKg) => total > requiredKg },
  { id: 'band', gate: (total, requiredKg) => total >= requiredKg && total < requiredKg * 2 },
  { id: 'ignores-the-total', gate: (_total, requiredKg) => requiredKg < 500 },
];

const FED = CAREER_FEDERATIONS[0] as CareerFederation;
const CALENDAR = buildCareerCalendar({
  federationId: FED.id,
  throughDayIndex: OPACITY_SWEEP.HORIZON_DAYS,
});

const GATED_SLOTS: readonly CareerMeetSlot[] = CALENDAR.filter(
  (slot) => qualifyingTotalKgFor(slot.tier, 'mens') !== null,
);
const OPEN_SLOTS: readonly CareerMeetSlot[] = CALENDAR.filter(
  (slot) => qualifyingTotalKgFor(slot.tier, 'mens') === null,
);

/** Pinned literals, so a sweep over an emptied list reports itself in place. */
const CALENDAR_SLOT_COUNT = 90;
const GATED_SLOT_COUNT = 33;
const OPEN_SLOT_COUNT = 57;

const NUMERIC_LIFTER: CareerLifter<NumericTotal> = createCareerLifter(FED.id, 'mens');

const BODYWEIGHT_KG = OPACITY_SWEEP.BODYWEIGHT_KG;

/** Larger than every requirement in the table, so any coercion admits. */
const HUGE_TOTAL_KG: NumericTotal = 1_000_000;

/** Falsy as well as small, so a `!total` mutant is caught with the rest. */
const TINY_TOTAL_KG: NumericTotal = 0;

/** A lifter carrying one numeric total and nothing else. */
function lifterAt(total: NumericTotal): CareerLifter<NumericTotal> {
  return { ...NUMERIC_LIFTER, bestTotal: total };
}

describe('the band the numeric probe walks', () => {
  it('crosses every qualifying threshold in both categories', () => {
    // The domain guard for every sweep in this file, and it sits here rather
    // than only beside one of them because the band is shared. Counts, not
    // bounds, on the band and on the ladder it was derived from.
    //
    // Reddens on: a threshold added to or removed from the tuning table, or an
    // offset dropped from `THRESHOLD_OFFSETS_KG`.
    expect(THRESHOLDS_KG).toEqual([260, 340, 415, 450, 570, 680]);
    expect(OPACITY_SWEEP.THRESHOLD_OFFSETS_KG.length).toBe(7);
    expect(BAND_KG.length).toBe(50);
    expect(BAND_KG.length).toBe(
      THRESHOLDS_KG.length * OPACITY_SWEEP.THRESHOLD_OFFSETS_KG.length +
        OPACITY_SWEEP.WIDTH_TOTALS_KG.length,
    );

    // Every threshold is IN the band, and so is a value on each side of it.
    // Without this the offsets could all be large and the band would straddle
    // nothing — which is the two-point probe's defect written smaller.
    let straddled = 0;
    for (const kg of THRESHOLDS_KG) {
      expect(BAND_KG).toContain(kg);
      expect(BAND_KG).toContain(kg - 0.5);
      expect(BAND_KG).toContain(kg + 0.5);
      straddled += 1;
    }
    expect(straddled).toBe(6);
  });

  it('spans the printed widths a width-keyed bypass hides on', () => {
    // The confirmed bypass was `/^\d\d\d(\.\d)?$/` on the total's printed form,
    // so the shapes present in the band are a real property of the domain and
    // not decoration. Pinned as a census: a band trimmed to integers, or to
    // three-digit values, moves one of these numbers.
    //
    // Reddens on: dropping `WIDTH_TOTALS_KG` entries, or dropping the half-kilo
    // offsets that put a decimal point in the band.
    const census: Record<string, number> = {};
    for (const kg of BAND_KG) {
      const shape = digitShape(kg);
      census[shape] = (census[shape] ?? 0) + 1;
    }
    expect(census).toEqual({
      d: 3,
      'dd.d': 1,
      ddd: 31,
      'ddd.d': 13,
      dddd: 1,
      ddddddd: 1,
    });
  });
});

// ===========================================================================
// 2. The verdict equals what the gate alone decides
// ===========================================================================

/**
 * A gate that records what it was asked.
 *
 * The confirmed bypass short-circuits before the gate is called at all, so
 * "was the gate consulted, once, with this lifter's own total" is a property
 * that separates it from the shipped code even where the verdict agrees. It
 * reddens with `... at 100kg asked 0 times`, which names the defect directly
 * rather than reporting a verdict that happens to be wrong.
 */
interface RecordingGate {
  readonly gate: CareerQualifyingGate<NumericTotal>;
  readonly calls: [NumericTotal, number][];
}

function recording(inner: CareerQualifyingGate<NumericTotal>): RecordingGate {
  const calls: [NumericTotal, number][] = [];
  return {
    calls,
    gate: (total, requiredKg) => {
      calls.push([total, requiredKg]);
      return inner(total, requiredKg);
    },
  };
}

describe('a numeric total is decided by the injected gate and by nothing else', () => {
  it('has a gated domain and an open one, so neither sweep below is empty', () => {
    // Counts, not bounds. Every sweep in this block walks one of these two
    // lists, and a list that had gone empty would make all of them pass.
    expect(CALENDAR.length).toBe(CALENDAR_SLOT_COUNT);
    expect(GATED_SLOTS.length).toBe(GATED_SLOT_COUNT);
    expect(OPEN_SLOTS.length).toBe(OPEN_SLOT_COUNT);
    expect(GATED_SLOT_COUNT + OPEN_SLOT_COUNT).toBe(CALENDAR_SLOT_COUNT);
  });

  it('matches the gate total by total and slot by slot, across the whole band', () => {
    // THE CHECK THE SECOND BYPASS IS VISIBLE TO, and the one the two-point
    // probe could not express. For every total in the band, every gated slot
    // and every gate, the verdict must be `eligible` exactly when the gate says
    // yes and `below-qualifying-total` exactly when it says no.
    //
    // Every lifter here is fresh — no entries, so no gap refusal — and every
    // verdict is taken on the slot's own day, so visibility is `open`. That
    // makes `below-qualifying-total` the one refusal available, which is what
    // stops a disagreement being hidden behind an unrelated reason. The pinned
    // `kinds` set is what enforces that rather than asserting it.
    //
    // Reddens on: the confirmed bypass, on any laundered comparison, and on a
    // gate call that is skipped. MEASURED with
    // `const shown = [candidate].join(); if (!/^\d\d\d(\.\d)?$/.test(shown) &&
    // !gate(...))` planted, verbatim from the run:
    //   expected '[refuses-everything] cragmoor-barbell…' to be ''
    //   + [refuses-everything] cragmoor-barbell-federation-regional-d21 at
    //     100kg needs 450kg: gate said below-qualifying-total, calendar said
    //     eligible
    const disagreements: string[] = [];
    const kinds = new Set<string>();
    let expectedEligible = 0;
    let expectedRefused = 0;
    let triples = 0;

    for (const probe of PROBE_GATES) {
      for (const total of BAND_KG) {
        const lifter = lifterAt(total);
        for (const slot of GATED_SLOTS) {
          const requiredKg = slot.qualifyingTotalKg.mens as number;
          const wanted = probe.gate(total, requiredKg) ? 'eligible' : 'below-qualifying-total';
          const verdict = meetEligibility(slot, lifter, slot.dayIndex, probe.gate);
          kinds.add(verdict.kind);
          if (verdict.kind !== wanted) {
            disagreements.push(
              `[${probe.id}] ${slot.slotId} at ${total}kg needs ${requiredKg}kg: ` +
                `gate said ${wanted}, calendar said ${verdict.kind}`,
            );
          }
          if (wanted === 'eligible') expectedEligible += 1;
          else expectedRefused += 1;
          triples += 1;
        }
      }
    }

    expect(disagreements.slice(0, 5).join('\n')).toBe('');
    expect(disagreements.length).toBe(0);

    // The domain, pinned beside the zero it is zero against. `triples` is the
    // product of three named lists; the two `expected` counts are the ones with
    // a subject, because a band that had drifted entirely above or entirely
    // below every threshold would send one of them to zero and leave the sweep
    // reading as coverage.
    expect(triples).toBe(PROBE_GATES.length * BAND_KG.length * GATED_SLOT_COUNT);
    expect(triples).toBe(9900);
    expect(expectedEligible).toBe(4965);
    expect(expectedRefused).toBe(4935);
    expect([...kinds].sort()).toEqual(['below-qualifying-total', 'eligible']);
  });

  it('asks the gate once per gated verdict, with the lifter’s own total', () => {
    // The branch immediately below the one above, per CLAUDE.md: a verdict can
    // agree with the gate without the gate having been asked, and the confirmed
    // bypass is exactly that — `&&` short-circuits, the gate is never called, and for a
    // three-digit total the answer is decided by a regex on the printed form.
    //
    // Reddens on: any path that decides a gated slot without calling the gate,
    // that calls it more than once, or that hands it anything but the lifter's
    // own total and the slot's own requirement.
    const faults: string[] = [];
    let asked = 0;
    for (const probe of PROBE_GATES) {
      for (const total of BAND_KG) {
        const lifter = lifterAt(total);
        for (const slot of GATED_SLOTS) {
          const spy = recording(probe.gate);
          meetEligibility(slot, lifter, slot.dayIndex, spy.gate);
          const requiredKg = slot.qualifyingTotalKg.mens as number;
          if (spy.calls.length !== 1) {
            faults.push(`[${probe.id}] ${slot.slotId} at ${total}kg asked ${spy.calls.length} times`);
          } else if (
            (spy.calls[0] as [NumericTotal, number])[0] !== total ||
            (spy.calls[0] as [NumericTotal, number])[1] !== requiredKg
          ) {
            faults.push(`[${probe.id}] ${slot.slotId} asked about ${String(spy.calls[0])}`);
          }
          asked += 1;
        }
      }
    }
    expect(faults.slice(0, 5).join('\n')).toBe('');
    expect(faults.length).toBe(0);
    expect(asked).toBe(9900);

    // Non-vacuity in the other direction: an OPEN tier asks the gate zero
    // times, so "exactly once" above is a property of the gated path rather
    // than of every path. Without this the check could be satisfied by a
    // module that asked the gate about everything.
    let openAsks = 0;
    for (const slot of OPEN_SLOTS) {
      const spy = recording(ADMITTING_GATE);
      expect(meetEligibility(slot, lifterAt(0), slot.dayIndex, spy.gate).kind).toBe('eligible');
      openAsks += spy.calls.length;
    }
    expect(openAsks).toBe(0);
  });

  it('selects and enters exactly the slots the gate admits, across the band', () => {
    // The same property one level up, through `selectableMeets` and
    // `enterMeet`, which the two-point probe never called at all. A bypass
    // living in either would have been invisible: both take the gate and both
    // route through `meetEligibility`, but "routes through it today" is not a
    // property anything here pinned.
    //
    // Reddens on: a coercion in either function, or one in `meetEligibility`
    // that the sweep above somehow tolerated.
    const faults: string[] = [];
    let selections = 0;
    let entries = 0;
    let entered = 0;
    let refused = 0;

    for (const probe of PROBE_GATES) {
      for (const total of BAND_KG) {
        const lifter = lifterAt(total);
        // `selectableMeets` is taken on day zero, where the visibility window
        // decides which slots are even on screen, so the expectation is over
        // the slots the calendar offers rather than over the whole ladder.
        const wanted = CALENDAR.filter((slot) => {
          if (meetEligibility(slot, lifter, 0, ADMITTING_GATE).kind !== 'eligible') return false;
          const requiredKg = slot.qualifyingTotalKg.mens;
          return requiredKg === null || probe.gate(total, requiredKg);
        }).map((slot) => slot.slotId);
        const got = selectableMeets(CALENDAR, lifter, 0, probe.gate).map((slot) => slot.slotId);
        if (got.join(',') !== wanted.join(',')) {
          faults.push(`[${probe.id}] selectable at ${total}kg: ${got.join(',')} vs ${wanted.join(',')}`);
        }
        selections += 1;

        for (const slot of GATED_SLOTS.slice(0, OPACITY_SWEEP.SUBSTITUTION_SLOTS)) {
          const requiredKg = slot.qualifyingTotalKg.mens as number;
          const outcome = enterMeet(lifter, slot, slot.dayIndex, probe.gate);
          const admits = probe.gate(total, requiredKg);
          if (admits && outcome.kind !== 'entered') {
            faults.push(`[${probe.id}] ${slot.slotId} at ${total}kg refused an admitted total`);
          }
          if (!admits && outcome.kind !== 'refused') {
            faults.push(`[${probe.id}] ${slot.slotId} at ${total}kg entered a refused total`);
          }
          if (outcome.kind === 'entered') entered += 1;
          else refused += 1;
          entries += 1;
        }
      }
    }

    expect(faults.slice(0, 5).join('\n')).toBe('');
    expect(faults.length).toBe(0);
    expect(selections).toBe(PROBE_GATES.length * BAND_KG.length);
    expect(selections).toBe(300);
    expect(entries).toBe(1500);
    // Both outcomes really occur, so neither arm above is an empty domain.
    expect(entered).toBe(738);
    expect(refused).toBe(762);
  });

  it('walks the ladder by the gate’s answers alone, across the band', () => {
    // `careerRecord.ts`'s half of the claim, over the band rather than at two
    // extremes. `qualifiedTierFor` is compared against a reading that knows
    // only what the gate answered — never the number — so an implementation
    // that consulted the total itself disagrees somewhere in the band.
    //
    // The oracle is deliberately not the top-down walk restated: it collects
    // the tiers the gate admits and takes the highest-ranked, which agrees with
    // a top-down walk by definition and is written from the gate's answers
    // rather than from the loop.
    const faults: string[] = [];
    const tiersSeen = new Set<string>();
    let readings = 0;
    for (const probe of PROBE_GATES) {
      for (const category of OPACITY_SWEEP.CATEGORIES) {
        for (const total of BAND_KG) {
          const admitted = CAREER_TUNING.MEET_TIERS.filter((tier) => {
            const requiredKg = qualifyingTotalKgFor(tier, category);
            return requiredKg === null || probe.gate(total, requiredKg);
          });
          const wanted =
            admitted.length === 0
              ? null
              : (admitted[admitted.length - 1] as string);
          const got = qualifiedTierFor(total, category, probe.gate);
          tiersSeen.add(String(got));
          if (got !== wanted) {
            faults.push(`[${probe.id}] ${category} ${total}kg: ${String(got)} vs ${String(wanted)}`);
          }
          readings += 1;
        }
      }
    }
    expect(faults.slice(0, 5).join('\n')).toBe('');
    expect(faults.length).toBe(0);
    expect(readings).toBe(PROBE_GATES.length * OPACITY_SWEEP.CATEGORIES.length * BAND_KG.length);
    expect(readings).toBe(600);
    // Non-vacuity: the sweep really does span the ladder rather than answering
    // `local` six hundred times, which is what a constant-gate-only probe saw.
    expect([...tiersSeen].sort()).toEqual(['local', 'nationals', 'regional', 'worlds']);
  });
});

// ===========================================================================
// 3. The substitution probe — the instrument that catches a route nobody listed
// ===========================================================================

/**
 * The gate that ignores the total it is handed and replays `inner`'s answers
 * about `at`.
 *
 * The whole probe is one line: a module that reads nothing out of a total
 * cannot tell `(x, g)` from `(y, tabulated(g, x))`, because the only channel
 * from the total to the answer is the gate and the gate has been made to answer
 * identically. A module that reads the number is separated by any `y` the read
 * TREATS DIFFERENTLY FROM `x` — a different magnitude, a different digit width,
 * a decimal point — without this file having to name which read it was.
 *
 * THE CAPITALISED CLAUSE IS THE ONE THIS PROBE WAS BYPASSED THROUGH, and it used
 * to read "any `y` the read treats differently", which quietly quantified over
 * every real number instead of over the 5 substitutes and 50 band points this
 * sweep actually runs. A read that answers the same for all 55 is invisible
 * here, and the third bypass is one: it admits totals inside a window that
 * contains no band point, so `x` and every `y` land on the same side of it.
 *
 * That is a property of the DOMAIN and not of the idea, so it cannot be repaired
 * by adding substitutes — the next window is chosen after reading the list. It
 * is repaired by not having a domain, which is `careerOpaqueTotal.test.ts`.
 */
function tabulated(
  inner: CareerQualifyingGate<NumericTotal>,
  at: NumericTotal,
): CareerQualifyingGate<NumericTotal> {
  return (_total, requiredKg) => inner(at, requiredKg);
}

/**
 * A subject's answer as a string, with any carried `Total` masked.
 *
 * The mask is the one honest exception to the probe: `CareerStanding` carries
 * `qualifyingTotal` and `CareerLifter` carries `bestTotal`, and those fields are
 * the total flowing THROUGH rather than a number read out of it. Masking them
 * is what lets the rest of the observation be compared for equality; leaving
 * them in would make every substitution differ for a legitimate reason.
 */
function observation(value: unknown): string {
  return JSON.stringify(value, (key, held: unknown) =>
    key === 'qualifyingTotal' || key === 'bestTotal' || key === 'total' ? '<total>' : held,
  );
}

/**
 * A record carrying ONE total at every slot, which is a requirement rather than
 * a shortcut.
 *
 * A critic read this as a hole — `standingOver`'s selection loop is the one
 * place in the directory that chooses between totals, and with the same number
 * at all three results it chooses with nothing to choose between. That reading
 * is right about the loop and wrong about the fix. `tabulated(g, x)` replays one
 * gate's answers about ONE total; a record holding three different totals is
 * three questions and the tabulated gate can only answer one of them, so the
 * substituted side collapses to "whatever the gate said about x" while the base
 * side varies per result.
 *
 * MEASURED, not argued. With `total + 40` per result and nothing else changed:
 *
 *   [careerStanding/at-or-above] 339kg -> 0kg
 *     … "qualifiedTier":"regional" … "qualifiedOnDayIndex":49 …
 *     … "qualifiedTier":"local"    … "qualifiedOnDayIndex":21 …
 *
 * That is the probe reporting a difference the module is entitled to, which
 * would have to be suppressed on the day it landed. So the selection loop is
 * exercised by `picks the result that reached the tier` below — a dedicated
 * check with three distinct totals and three distinct bodyweights, where the
 * winner is neither the first nor the last — and this fixture stays at one
 * total, on purpose.
 */
function recordOf(
  total: NumericTotal,
  slots: readonly CareerMeetSlot[],
): CareerRecord<NumericTotal> {
  const lifter: CareerLifter<NumericTotal> = {
    ...NUMERIC_LIFTER,
    enteredSlotIds: slots.map((slot) => slot.slotId),
    lastEntryDayIndex: (slots[slots.length - 1] as CareerMeetSlot).dayIndex,
  };
  let record = createCareerRecord<NumericTotal>();
  for (const slot of slots) {
    const outcome = recordMeetResult(record, lifter, slot, { total, bodyweightKg: BODYWEIGHT_KG });
    if (outcome.kind !== 'recorded') throw new Error(`refused: ${outcome.reason.kind}`);
    record = outcome.record;
  }
  return record;
}

function offersFor(
  total: NumericTotal,
  slots: readonly CareerMeetSlot[],
  gate: CareerQualifyingGate<NumericTotal>,
): CareerEngagementInputs<NumericTotal> {
  const offers: readonly CareerMeetOffer<NumericTotal>[] = slots.map((slot) => ({
    slot,
    total,
    bodyweightKg: BODYWEIGHT_KG,
  }));
  return {
    offers,
    // The lifter carries the total too, and that is not decoration: with
    // `NUMERIC_LIFTER`'s null `bestTotal` every gated slot is refused
    // `no-recorded-total` before the gate is ever reached, so `runEntryPlan`
    // returned the same census for all fifty totals in the band. The spread
    // census below is what caught it — the subject was in the sweep and was
    // checking nothing, which is exactly the shape this file exists about.
    lifter: lifterAt(total),
    category: 'mens',
    gate,
    throughDayIndex: OPACITY_SWEEP.HORIZON_DAYS,
  };
}

const STANDING_SLOTS = GATED_SLOTS.slice(0, OPACITY_SWEEP.STANDING_RESULTS);
const PROBE_SLOTS = GATED_SLOTS.slice(0, OPACITY_SWEEP.SUBSTITUTION_SLOTS);

const EMPTY_STANDING: CareerStanding<NumericTotal> = careerStanding(
  createCareerRecord<NumericTotal>(),
  'mens',
  REFUSING_GATE,
);

/**
 * Every function in this directory that takes both a `Total` and a gate.
 *
 * `careerMeetDraft` is deliberately absent and is covered by its own check
 * below: it is generic over `Rules`, not over `Total`, so there is no total in
 * it to read. `tierUnlockBetween` and `lifterWithStanding` take no gate and are
 * folded into the `standing` subject, which threads both.
 */
interface SubstitutionSubject {
  readonly id: string;
  readonly observe: (total: NumericTotal, gate: CareerQualifyingGate<NumericTotal>) => string;
}

const SUBJECTS: readonly SubstitutionSubject[] = [
  {
    id: 'meetEligibility',
    observe: (total, gate) =>
      observation(
        GATED_SLOTS.map((slot) => meetEligibility(slot, lifterAt(total), slot.dayIndex, gate)),
      ),
  },
  {
    id: 'selectableMeets',
    observe: (total, gate) =>
      observation(selectableMeets(CALENDAR, lifterAt(total), 0, gate).map((slot) => slot.slotId)),
  },
  {
    id: 'enterMeet',
    observe: (total, gate) =>
      observation(
        PROBE_SLOTS.map((slot) => enterMeet(lifterAt(total), slot, slot.dayIndex, gate)),
      ),
  },
  {
    id: 'qualifiedTierFor',
    observe: (total, gate) =>
      observation(
        OPACITY_SWEEP.CATEGORIES.map((category) => qualifiedTierFor(total, category, gate)),
      ),
  },
  {
    id: 'careerStanding',
    observe: (total, gate) => observation(careerStanding(recordOf(total, STANDING_SLOTS), 'mens', gate)),
  },
  {
    id: 'standingAsOf',
    observe: (total, gate) =>
      observation(
        STANDING_SLOTS.map((slot) =>
          standingAsOf(recordOf(total, STANDING_SLOTS), slot.dayIndex, 'mens', gate),
        ),
      ),
  },
  {
    id: 'tierUnlockBetween',
    observe: (total, gate) =>
      observation(
        tierUnlockBetween(
          EMPTY_STANDING,
          careerStanding(recordOf(total, STANDING_SLOTS), 'mens', gate),
        ),
      ),
  },
  {
    id: 'lifterWithStanding',
    observe: (total, gate) =>
      observation(
        lifterWithStanding(
          NUMERIC_LIFTER,
          careerStanding(recordOf(total, STANDING_SLOTS), 'mens', gate),
        ),
      ),
  },
  {
    id: 'careerGateFaults',
    observe: (total, gate) => observation(careerGateFaults(gate, [total], 'mens')),
  },
  {
    id: 'runEntryPlan',
    observe: (total, gate) =>
      observation(runEntryPlan(offersFor(total, PROBE_SLOTS, gate), [true, true, true, true, true]).census),
  },
  {
    id: 'runRecordHistory',
    observe: (total, gate) =>
      observation(
        runRecordHistory(offersFor(total, STANDING_SLOTS, gate), [true, true, true]).census,
      ),
  },
];

describe('substituting the total behind a fixed gate changes nothing', () => {
  it('holds for every subject, every gate and every pair in the band', () => {
    // THE GENERAL INSTRUMENT. A syntactic row catches the token somebody thought
    // of; this catches the outcome. `join()`, `Intl.NumberFormat`, a `Proxy`, a
    // `toJSON`, a regex on the printed form — each of them makes some `y` behave
    // differently from `x` while the gate's answers are held identical, and each
    // shows up here as one disagreement without this file naming it.
    //
    // Reddens on: the confirmed bypass. MEASURED with it planted, verbatim:
    //   expected '[meetEligibility/refuses-everything] …' to be ''
    //   + [meetEligibility/refuses-everything] 100kg -> 0kg
    //   +   [{"kind":"eligible"}, and 32 more]
    //   +   [{"kind":"below-qualifying-total","requiredKg":450}, and 32 more]
    // A hundred-kilogram lifter is admitted to every gated meet by a gate that
    // refuses everything, and swapping in any other total puts it back.
    //
    // AND A SECOND MUTANT, PLANTED TO SEPARATE THIS INSTRUMENT FROM THE BAN.
    // This one contains no banned token at all — no `Number`, no `String`, no
    // `join`, no cast of a total, no alias, no template hole. Planted in
    // `standingOver`, `careerRecord.ts`:
    //
    //   const rung = CAREER_TUNING.QUALIFYING_TOTAL_KG_BY_TIER.regional.mens;
    //   if (new Set([result.total]).has(rung as never)) {
    //     continue;
    //   }
    //
    // MEASURED: `npx tsc --noEmit` exit 0. `finds nothing in any shipped
    // module` GREEN — all forty-five rows walk past it. `matches the gate total
    // by total and slot by slot` GREEN, because the mutant is on the standing
    // path rather than the per-slot verdict. What went red was this test, on
    // `expected '[careerStanding/refuses-everything] 4…' to be ''`, and the
    // spread census beside it. That is the one measurement that says the
    // substitution probe is not a more expensive restatement of the ban.
    const faults: string[] = [];
    let pairs = 0;
    const subjectsDisagreeing = new Set<string>();

    for (const subject of SUBJECTS) {
      for (const probe of PROBE_GATES) {
        for (const total of BAND_KG) {
          const base = subject.observe(total, probe.gate);
          for (const substitute of OPACITY_SWEEP.SUBSTITUTE_TOTALS_KG) {
            const swapped = subject.observe(substitute, tabulated(probe.gate, total));
            if (swapped !== base) {
              subjectsDisagreeing.add(subject.id);
              if (faults.length < 5) {
                faults.push(
                  `[${subject.id}/${probe.id}] ${total}kg -> ${substitute}kg\n  ${base}\n  ${swapped}`,
                );
              }
            }
            pairs += 1;
          }
        }
      }
    }

    expect(faults.join('\n')).toBe('');
    expect(subjectsDisagreeing.size).toBe(0);
    // The domain, pinned as counts.
    expect(pairs).toBe(
      SUBJECTS.length *
        PROBE_GATES.length *
        BAND_KG.length *
        OPACITY_SWEEP.SUBSTITUTE_TOTALS_KG.length,
    );
    expect(pairs).toBe(16500);
    expect(SUBJECTS.length).toBe(11);
  });

  it('reaches a different answer for a different total, subject by subject', () => {
    // The non-vacuity guard for the sweep above, and the one that matters most:
    // if a subject returned the same observation for every total in the band,
    // substitution would hold trivially and the sweep would read as coverage
    // while checking nothing. So the number of DISTINCT observations each
    // subject produces across the band, under the realistic gate, is pinned.
    //
    // Reddens on: a subject wired to a fixture that flattens the band — the
    // shape the `lifterWithStanding` repair was about — or a subject list that
    // grew an entry nothing varies over.
    const realistic = PROBE_GATES.find((probe) => probe.id === 'at-or-above') as ProbeGate;
    const spread: Record<string, number> = {};
    for (const subject of SUBJECTS) {
      spread[subject.id] = new Set(
        BAND_KG.map((total) => subject.observe(total, realistic.gate)),
      ).size;
    }
    expect(spread).toEqual({
      meetEligibility: 4,
      selectableMeets: 3,
      enterMeet: 3,
      qualifiedTierFor: 7,
      careerStanding: 4,
      standingAsOf: 4,
      tierUnlockBetween: 4,
      lifterWithStanding: 1,
      careerGateFaults: 1,
      runEntryPlan: 4,
      runRecordHistory: 4,
    });
    // TWO SUBJECTS ARE FLAT, AND THE SENTENCE THAT USED TO BE HERE CLAIMED MORE
    // THAN THE LINE BELOW DELIVERS. It read:
    //
    //     Both carry the substitution property anyway … and both are non-flat
    //     under a gate that is not downward closed, which is asserted here
    //     rather than assumed.
    //
    // One of them is asserted. `careerGateFaults` is genuinely non-flat under
    // the band gate and the assertion below is about it. `lifterWithStanding`
    // is flat under EVERY gate and no arrangement of this subject changes that:
    // it returns `{ ...lifter, bestTotal: standing.qualifyingTotal }`, the
    // lifter is a constant, and `observation()` masks `bestTotal` by field name
    // — so the one field that moves is the one field that is blanked.
    //
    // MEASURED rather than reasoned. `return Object.freeze({ ...lifter,
    // bestTotal: lifter.bestTotal });` — the mutant that writes no standing at
    // all — leaves this whole FILE green, all 24 tests. It is not invisible to
    // the directory: it reddens eight tests, and the one that names it is
    // `expect(after.bestTotal).toEqual(kg(NATIONALS_KG))` inside `writes the
    // qualifying total and nothing else` in `careerRecord.test.ts`. So the gap
    // was in this file's claim about itself, not in the directory's coverage.
    //
    // What closes it as a claim of THIS instrument's kind — at the value rather
    // than at a fixture's number — is `catches a lifter that keeps its own total
    // instead of the standing's` in `careerOpaqueTotal.test.ts`, which hands the
    // function two distinguishable totals and reads which one came back.
    //
    // Looked up BY ID rather than by index. `SUBJECTS[8]` was positional while
    // the comment beside it named a function, so a reorder would have regraded a
    // different subject, and `?.` turned an out-of-range index into a `Set` of
    // size 1 that only fails by luck.
    const band = PROBE_GATES.find((probe) => probe.id === 'band') as ProbeGate;
    const gateFaults = SUBJECTS.find((subject) => subject.id === 'careerGateFaults');
    expect(gateFaults, 'no subject named careerGateFaults').toBeDefined();
    expect(
      new Set(BAND_KG.map((kg) => (gateFaults as SubstitutionSubject).observe(kg, band.gate))).size,
    ).toBe(2);
    // And the flat pair is named here rather than left to be read off the table
    // above, so a third flat subject is a visible edit.
    expect(
      Object.keys(spread)
        .filter((id) => spread[id] === 1)
        .sort(),
    ).toEqual(['careerGateFaults', 'lifterWithStanding']);
  });
});

describe('the one loop in this directory that chooses between two totals', () => {
  it('picks the result that reached the tier, not the first and not the last', () => {
    // `standingOver` walks the results and keeps the one whose qualified tier
    // outranks everything before it. Every other check in this file runs it with
    // ONE total repeated, for the reason `recordOf`'s docstring gives, so the
    // choice it makes is between three identical candidates and the loop could
    // return any of them and still pass. This is the check with a real choice in
    // it.
    //
    // The totals are chosen so the winner is the MIDDLE result and so the third
    // ties the second's tier: 300 qualifies for the open tier only, 700 and 720
    // both reach worlds. A loop that took the last, or that used `>=` where the
    // shipped one uses `>`, returns the third; one that took the first returns
    // the third-of-a-tier below. The bodyweights are distinct so an UNMASKED
    // field reports which result was taken, which is what the field-name mask
    // makes impossible for the total itself.
    //
    // Reddens on: `standingRank(tier) > standingRank(qualifiedTier)` becoming
    // `>=`, on the loop keeping the last match, or on `qualifyingBodyweightKg`
    // and `qualifiedOnDayIndex` ceasing to come off the same result as
    // `qualifyingTotal`.
    const totals: readonly NumericTotal[] = [300, 700, 720];
    const bodyweights: readonly number[] = [92.5, 83.25, 105.75];
    const lifter: CareerLifter<NumericTotal> = {
      ...NUMERIC_LIFTER,
      enteredSlotIds: STANDING_SLOTS.map((slot) => slot.slotId),
      lastEntryDayIndex: (STANDING_SLOTS[STANDING_SLOTS.length - 1] as CareerMeetSlot).dayIndex,
    };
    let record = createCareerRecord<NumericTotal>();
    for (let index = 0; index < STANDING_SLOTS.length; index += 1) {
      const outcome = recordMeetResult(
        record,
        lifter,
        STANDING_SLOTS[index] as CareerMeetSlot,
        { total: totals[index] as NumericTotal, bodyweightKg: bodyweights[index] as number },
      );
      expect(outcome.kind, `result ${index} was refused`).toBe('recorded');
      if (outcome.kind !== 'recorded') return;
      record = outcome.record;
    }

    // The domain guard: three distinct totals really are on the record, and the
    // tiers they qualify for are not all the same. Without this the check below
    // could pass over three identical candidates again.
    expect(record.results.map((result) => result.total)).toEqual([300, 700, 720]);
    const real = PROBE_GATES.find((probe) => probe.id === 'at-or-above') as ProbeGate;
    expect(totals.map((kg) => qualifiedTierFor(kg, 'mens', real.gate))).toEqual([
      'local',
      'worlds',
      'worlds',
    ]);

    const standing = careerStanding(record, 'mens', real.gate);
    expect(standing.qualifiedTier).toBe('worlds');
    expect(standing.qualifyingTotal).toBe(700);
    expect(standing.qualifyingBodyweightKg).toBe(83.25);
    expect(standing.qualifiedOnDayIndex).toBe((STANDING_SLOTS[1] as CareerMeetSlot).dayIndex);
    expect(standing.totalsPosted).toBe(3);
  });
});

describe('the functions with no total in them, and why they are not swept', () => {
  it('keeps careerMeetDraft generic over the rules and not over the total', () => {
    // The critic's list named `careerMeetDraft` as a function the probe never
    // reaches. It is not reached because there is no total in it to read: it is
    // generic over `Rules`, its inputs are a slot and a venue, and
    // `ghostTotalsKg` is a list of plain numbers by design. Asserted from the
    // source rather than argued, so a `Total` arriving in that signature is red
    // here instead of quietly unswept.
    //
    // Reddens on: `careerMeetDraft` gaining a `Total` type parameter or a
    // parameter typed with one.
    const code = scannableCode(source('careerCore.ts'));
    const signature = /export function careerMeetDraft<([^>]*)>\(([\s\S]*?)\):/.exec(code);
    expect(signature).not.toBeNull();
    expect((signature as RegExpExecArray)[1]).toBe('Rules');
    expect((signature as RegExpExecArray)[2]).not.toMatch(/\bTotal\b/);
    expect(/export interface CareerMeetDraft<Rules>/.test(code)).toBe(true);
  });
});

// ===========================================================================
// 4. The extremes — kept, because they say something the band does not
// ===========================================================================

describe('a numeric total cannot get past the injected gate', () => {
  it('refuses every gated meet to an enormous numeric total when the gate says no', () => {
    // The original check. With `Total` bound to `number` and `bestTotal` at a
    // million kilograms, any route from the total to a number admits this
    // lifter — `Number(total)`, `+total`, `total as unknown as number`,
    // `total.valueOf()`, a widened field type. The gate says no to all of them,
    // so the only correct verdict is a refusal.
    //
    // Reddens on: `Number(lifter.bestTotal) >= requiredKg` anywhere on
    // `meetEligibility`'s path. MEASURED: with that line planted this reports
    // `expected 'eligible' to be 'below-qualifying-total'` and `admitted` goes
    // to 33.
    const rich = lifterAt(HUGE_TOTAL_KG);
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
    // Pinned at zero, with the sweep's own size beside it. `refused` is compared
    // to a LITERAL rather than to `GATED_SLOTS.length`: the loop increments once
    // per element, so comparing the two was an arithmetic identity that no state
    // of `src/career/` could redden, and an emptied list passed it.
    expect(admitted).toBe(0);
    expect(refused).toBe(GATED_SLOT_COUNT);

    // Non-vacuity in the other direction: the same lifter on the same days IS
    // admitted to the open tier, so the refusals above are the gate's answer
    // and not this lifter being unable to enter anything at all.
    let openAdmissions = 0;
    for (const slot of OPEN_SLOTS) {
      expect(meetEligibility(slot, rich, slot.dayIndex, REFUSING_GATE).kind).toBe('eligible');
      openAdmissions += 1;
    }
    expect(openAdmissions).toBe(OPEN_SLOT_COUNT);
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
    const poor = lifterAt(TINY_TOTAL_KG);
    let admitted = 0;
    for (const slot of GATED_SLOTS) {
      expect(meetEligibility(slot, poor, slot.dayIndex, ADMITTING_GATE).kind, slot.slotId).toBe(
        'eligible',
      );
      admitted += 1;
    }
    expect(admitted).toBe(GATED_SLOT_COUNT);
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
    const record = recordOf(HUGE_TOTAL_KG, STANDING_SLOTS);
    expect(record.results.length).toBe(OPACITY_SWEEP.STANDING_RESULTS);
    expect(record.results.length).toBe(3);

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
// 5. The source ban — syntactic, and the instrument that sees dead code
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

/** A binding name that is NOT one of this directory's names for a total. */
const NOT_A_TOTAL_NAME = String.raw`(?!(?:total|[a-z][A-Za-z0-9_$]*Total)\b)`;

/** A dotted path in front of a total: `lifter.`, `standing?.`, or nothing. */
const DOTTED_PREFIX = String.raw`(?:[\w$]+\s*\??\s*\.\s*)*`;

// ---------------------------------------------------------------------------
// Logical lines: the fix for a scan that a line break defeated
// ---------------------------------------------------------------------------

/** A trimmed line ending in one of these continues onto the next. */
const CONTINUES_AFTER = /[.+\-*/%<>=,?:&|([]$/;

/** A trimmed line starting with one of these continues the previous. */
const CONTINUES_BEFORE = /^[.+\-*/%<>=,?:&|)\]]/;

function bracketDelta(line: string): number {
  let depth = 0;
  for (const character of line) {
    if (character === '(' || character === '[') depth += 1;
    if (character === ')' || character === ']') depth -= 1;
  }
  return depth;
}

/**
 * The file as statements rather than as lines.
 *
 * The scan this replaces read `text.split('\n')` and tested each line on its
 * own, and every tripwire in the file was a single line — so the property was
 * untested in all thirty-four rows while prettier wraps a long call at this
 * repository's width. `Math.max(\n  bestTotal,\n)` defeated `math-on-total`
 * outright, and the fix is to join a wrapped call back up before scanning it.
 *
 * Three ways a line continues, each driven by a tripwire in `WRAPPED` below:
 * an unclosed `(` or `[`, a trailing operator, and a leading operator on the
 * next line. `{` is deliberately not counted — counting it would make a whole
 * function body one logical line and every unbounded character class in a
 * pattern would start crossing statements.
 *
 * Joining is the reason `paren-ordering`, `object-introspection` and
 * `math-on-total` no longer use `[^)]*`: with the newline gone, an unbounded
 * class walks from a property name to an unrelated comparison twelve lines
 * below. Those three now stop at `;`, `{` and `}`, and `paren-ordering` stops
 * at `,` as well.
 */
function logicalLines(text: string): readonly string[] {
  const raw = text.split('\n');
  const out: string[] = [];
  let buffer = '';
  let depth = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const line = (raw[i] ?? '').trim();
    buffer = buffer === '' ? line : `${buffer} ${line}`;
    depth += bracketDelta(line);
    if (depth < 0) depth = 0;
    const next = (raw[i + 1] ?? '').trim();
    const continues =
      depth > 0 ||
      (line !== '' && CONTINUES_AFTER.test(line)) ||
      (next !== '' && CONTINUES_BEFORE.test(next));
    if (!continues) {
      out.push(buffer);
      buffer = '';
    }
  }
  if (buffer !== '') out.push(buffer);
  return out;
}

/**
 * One banned pattern.
 *
 * `scope` decides what the pattern is run against. `'code'` is comments and
 * quoted strings stripped; `'source'` is the raw file, and exists for exactly
 * one row — a `@ts-expect-error` suppression, which IS a comment and which a
 * code-only scan therefore cannot see. `src/empire/`'s ban has no such row and
 * cannot grow one without this field; that is the hole this copy closes.
 *
 * `tripwires` is a list rather than a string because one tripwire proves one
 * branch of an alternation. `object-introspection` names five verbs and drove
 * one of them; `ts-suppression` names three and drove one; `unary-plus` has
 * eight prefix contexts and drove one. Every branch is driven now.
 *
 * `isolating` is a tripwire that THIS row matches and no other row does, so a
 * green tripwire proves this row bites rather than proving the ban does. It was
 * added because a recorded mutation witness in `careerCore.ts` used a mutant
 * matching three rows: deleting the row the witness was about left the mutant
 * red, so the witness proved nothing about it. `null` where no such string
 * exists because another row subsumes this one on every shape it catches, and
 * `why` names the subsuming row in each case.
 */
interface BannedPattern {
  readonly id: string;
  readonly scope: 'code' | 'source';
  readonly pattern: RegExp;
  readonly tripwires: readonly string[];
  readonly isolating: string | null;
  readonly why: string;
}

const BANNED: readonly BannedPattern[] = [
  // -------------------------------------------------------------------------
  // Subject-independent: a `Total` becomes a number through one of these, or
  // through something nobody here has named. This list is not closed — see the
  // header — and the substitution probe is what closes it.
  // -------------------------------------------------------------------------
  {
    id: 'number-call',
    scope: 'code',
    pattern: /\bNumber\s*\(/,
    tripwires: ['if (Number(lifter.bestTotal) >= requiredKg) return { kind: 1 };'],
    isolating: 'const kgs = Number(value);',
    why: 'the exact planted mutant. `Number.isInteger` and `Number.isFinite` are property reads and stay legal.',
  },
  {
    id: 'string-call',
    scope: 'code',
    pattern: /\bString\s*\(/,
    tripwires: ['const label = String(total);'],
    isolating: 'const label = String(value);',
    why: 'stringify then parse is a two-step coercion, and careerRecord.ts promises it prints an index instead.',
  },
  {
    id: 'parse-float',
    scope: 'code',
    pattern: /\bparseFloat\s*\(/,
    tripwires: ['const kgs = parseFloat(label);'],
    isolating: 'const kgs = parseFloat(label);',
    why: 'the second step of that two-step.',
  },
  {
    id: 'parse-int',
    scope: 'code',
    pattern: /\bparseInt\s*\(/,
    tripwires: ['const kgs = parseInt(label, 10);'],
    isolating: 'const kgs = parseInt(label, 10);',
    why: 'the same, rounded.',
  },
  {
    id: 'value-of',
    scope: 'code',
    pattern: /\.\s*valueOf\s*\(/,
    tripwires: ['if (total.valueOf() >= requiredKg) return true;'],
    isolating: 'const kgs = held.valueOf();',
    why: 'the coercion protocol, called by hand.',
  },
  {
    id: 'to-primitive',
    scope: 'code',
    pattern: /Symbol\s*\.\s*toPrimitive/,
    tripwires: ["const kgs = total[Symbol.toPrimitive]('number');"],
    isolating: 'const kgs = held[Symbol.toPrimitive];',
    why: 'the same protocol by its other name.',
  },
  {
    id: 'to-fixed',
    scope: 'code',
    pattern: /\.\s*toFixed\s*\(/,
    tripwires: ['const label = total.toFixed(1);'],
    isolating: 'const label = held.toFixed(1);',
    why: 'a numeric method, so reaching it means the value is already a number.',
  },
  {
    id: 'to-string',
    scope: 'code',
    pattern: /\.\s*toString\s*\(/,
    tripwires: ['const label = total.toString();'],
    isolating: 'const label = held.toString();',
    why: 'the other half of stringify-then-parse.',
  },
  {
    id: 'to-precision',
    scope: 'code',
    pattern: /\.\s*(?:toPrecision|toExponential)\s*\(/,
    tripwires: ['const label = held.toPrecision(4);', 'const label = held.toExponential(2);'],
    isolating: 'const label = held.toPrecision(4);',
    why:
      'two more numeric formatters that were in no row. Same class as `to-fixed`: reaching either ' +
      'means the value is already a number.',
  },
  {
    id: 'locale-string',
    scope: 'code',
    pattern: /\.\s*toLocaleString\s*\(/,
    tripwires: ['const label = held.toLocaleString();'],
    isolating: 'const label = held.toLocaleString();',
    why: 'stringification with a comma in it, which parses back just as well.',
  },
  {
    id: 'intl-format',
    scope: 'code',
    pattern: /\bIntl\s*\./,
    tripwires: ['const label = new Intl.NumberFormat().format(held);'],
    isolating: 'const label = new Intl.NumberFormat().format(held);',
    why: 'the same stringification by the route a formatter takes.',
  },
  {
    id: 'array-join',
    scope: 'code',
    pattern: /\.\s*join\s*\(/,
    tripwires: ['const shown = [candidate].join();'],
    isolating: 'const shown = [candidate].join();',
    why:
      'THE VECTOR THE CONFIRMED BYPASS USED. `[total].join()` is `String(total)` with no `String` ' +
      'in it, and it was in no row at all while the header claimed the stringification list was ' +
      'closed. A string carries ordering and magnitude, so this is a full coercion.',
  },
  {
    id: 'array-concat',
    scope: 'code',
    pattern: /\.\s*concat\s*\(/,
    tripwires: ['const shown = prefix.concat(held);'],
    isolating: 'const shown = prefix.concat(held);',
    why: 'the branch immediately below `array-join`: string concatenation with a method call.',
  },
  {
    id: 'array-from',
    scope: 'code',
    pattern: /\bArray\s*\.\s*(?:from|of)\s*\(/,
    tripwires: ['const held = Array.from(source);', 'const held = Array.of(value);'],
    isolating: 'const held = Array.from(source);',
    why: 'a mapping constructor takes a mapper, and `Array.from(xs, Number)` is a coercion.',
  },
  {
    id: 'big-int',
    scope: 'code',
    pattern: /\bBigInt\s*\(/,
    tripwires: ['const kgs = BigInt(total);'],
    isolating: 'const kgs = BigInt(value);',
    why: 'a coercion that is not spelled Number.',
  },
  {
    id: 'json-round-trip',
    scope: 'code',
    pattern: /\bJSON\s*\.\s*(?:parse|stringify)\s*\(/,
    tripwires: ['const kgs = JSON.parse(text);', 'const text = JSON.stringify(total);'],
    isolating: 'const kgs = JSON.parse(text);',
    why: 'a round trip through text erases a brand and unwraps a wrapper in one line.',
  },
  {
    id: 'to-json',
    scope: 'code',
    pattern: /\btoJSON\b/,
    tripwires: ['const kgs = held.toJSON();'],
    isolating: 'const kgs = held.toJSON();',
    why: "the hook `JSON.stringify` calls, reachable without the word JSON appearing at the call site.",
  },
  {
    id: 'structured-clone',
    scope: 'code',
    pattern: /\bstructuredClone\s*\(/,
    tripwires: ['const copy = structuredClone(total);'],
    isolating: 'const copy = structuredClone(value);',
    why: 'the same erasure without the text.',
  },
  {
    id: 'reflection',
    scope: 'code',
    pattern: /\bReflect\s*\.|\bnew\s+Proxy\s*\(/,
    tripwires: ['const kgs = Reflect.get(held, key);', 'const wrapped = new Proxy(held, trap);'],
    isolating: 'const kgs = Reflect.get(held, key);',
    why:
      'the two routes that read a value without naming a field and without any of the words above. ' +
      "A `Proxy` trap is the shape the header's `join()` finding says a ban can never enumerate.",
  },
  {
    id: 'property-descriptor',
    scope: 'code',
    pattern: /\bObject\s*\.\s*(?:defineProperty|defineProperties|getOwnPropertyDescriptors?)\s*\(/,
    tripwires: [
      'Object.defineProperty(held, key, spec);',
      'Object.defineProperties(held, spec);',
      'const spec = Object.getOwnPropertyDescriptor(held, key);',
      'const spec = Object.getOwnPropertyDescriptors(held);',
    ],
    isolating: 'Object.defineProperty(held, key, spec);',
    why: 'installing or reading an accessor is looking inside a value by a route with no dot on a total.',
  },
  {
    id: 'as-number',
    scope: 'code',
    pattern: /\bas\s+number\b/,
    tripwires: ['const kgs = total as number;'],
    isolating: 'const kgs = value as number;',
    why: 'the direct assertion. `as const`, `as CareerTier` and `as Total` stay legal.',
  },
  {
    id: 'as-unknown',
    scope: 'code',
    pattern: /\bas\s+unknown\b/,
    tripwires: ['const kgs = total as unknown as number;'],
    isolating: 'const kgs = value as unknown as Rules;',
    why: 'the assertion that works when the direct one is refused.',
  },
  {
    id: 'as-any',
    scope: 'code',
    pattern: /\bas\s+any\b/,
    tripwires: ['const kgs = total as any;'],
    isolating: 'const kgs = value as any;',
    why: 'CLAUDE.md bans `any` outright; here it is also a type strip.',
  },
  {
    id: 'as-shape',
    scope: 'code',
    pattern: /\bas\s*\{/,
    tripwires: ['const kgs = (standing.qualifyingTotal as { kg: number }).kg;'],
    isolating: 'const shaped = value as { kg: number };',
    why:
      'a cast to a STRUCTURAL type, which is neither `number` nor `unknown` nor `any` and which ' +
      'every one of those three rows missed. FOUND BY A SURVIVING MUTANT, not by inspection: ' +
      'planting the tripwire above into `lifterWithStanding` left the ban green.',
  },
  {
    id: 'cast-of-total',
    scope: 'code',
    pattern: new RegExp(`${TOTAL_REF}\\s*\\)?\\s+as\\b`),
    tripwires: ['const kgs = (standing.qualifyingTotal as { kg: number }).kg;'],
    isolating: 'const kgs = total as Kilograms;',
    why:
      'the other half of the same finding, keyed on the subject instead of the target type: a ' +
      'total may not be cast to ANYTHING. `totals[index] as Total` stays legal because `totals` ' +
      'is deliberately not a subject.',
  },
  {
    id: 'any-annotation',
    scope: 'code',
    pattern: /:\s*any\b/,
    tripwires: ['const kgs: any = lifter.bestTotal;'],
    isolating: 'const kgs: any = value;',
    why: 'the same strip written as a declaration.',
  },
  {
    id: 'eval-call',
    scope: 'code',
    pattern: /\beval\s*\(/,
    tripwires: ['const ok = eval(expression);'],
    isolating: 'const ok = eval(expression);',
    why: 'the only way a banned pattern hidden in a stripped string becomes executable.',
  },
  {
    id: 'new-function',
    scope: 'code',
    pattern: /\bnew\s+Function\s*\(/,
    tripwires: ['const ok = new Function(a, b);'],
    isolating: 'const ok = new Function(a, b);',
    why: 'the same, spelled differently.',
  },
  {
    id: 'ts-suppression',
    scope: 'source',
    pattern: /@ts-(?:ignore|expect-error|nocheck)/,
    tripwires: [
      '// @ts-expect-error the compiler is wrong about this total',
      '// @ts-ignore the compiler is wrong about this total',
      '// @ts-nocheck',
    ],
    isolating: '// @ts-nocheck',
    why:
      'the way a comparison the compiler refuses gets shipped anyway. It IS a comment, so the ' +
      'code scan cannot see it — this row is why `scope` exists. All three spellings are driven, ' +
      'because one branch of an alternation says nothing about the other two.',
  },

  // -------------------------------------------------------------------------
  // Aliasing: the hole that let the second bypass through. Every subject-keyed
  // row below reads the token `total` at the point of use, so one rename
  // defeats all of them at once. These two rows ban the rename itself.
  // -------------------------------------------------------------------------
  {
    id: 'alias-total',
    scope: 'code',
    pattern: new RegExp(
      `\\b(?:const|let|var)\\s+${NOT_A_TOTAL_NAME}[A-Za-z_$][\\w$]*\\s*(?::[^=\\n]*)?=\\s*${DOTTED_PREFIX}${TOTAL_REF}\\s*(?:;|$)`,
    ),
    tripwires: [
      'const candidate = lifter.bestTotal;',
      'let candidate = total;',
      'var candidate = standing.qualifyingTotal;',
      'const candidate: unknown = lifter.bestTotal;',
    ],
    isolating: 'const candidate = lifter.bestTotal;',
    why:
      'THE HOLE THE CONFIRMED BYPASS WALKED THROUGH. There was no row for `const v = ' +
      'lifter.bestTotal;`, and one alias defeats every subject-keyed row in this file at once. ' +
      'The binding name is checked against the same vocabulary, so `const total = totals[index] ' +
      'as Total` stays legal — renaming a total TO a total name is not a rename.',
  },
  {
    id: 'alias-assign',
    scope: 'code',
    pattern: new RegExp(
      `(?:^|[;{}]|\\breturn\\b)\\s*${NOT_A_TOTAL_NAME}[A-Za-z_$][\\w$]*\\s*(?::[^=\\n]*)?=\\s*${DOTTED_PREFIX}${TOTAL_REF}\\s*(?:;|$)`,
    ),
    tripwires: ['shown = lifter.bestTotal;', 'candidate = total;'],
    isolating: 'shown = lifter.bestTotal;',
    why:
      'the branch immediately below `alias-total`: the same rename without a declarator. ' +
      '`qualifyingTotal = result.total;` in `standingOver` stays legal for the reason above.',
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
    tripwires: [
      'if (lifter.bestTotal >= requiredKg) return { kind: 1 };',
      'if (lifter.bestTotal <= requiredKg) return { kind: 1 };',
      'if (lifter.bestTotal > requiredKg) return { kind: 1 };',
      'if (lifter.bestTotal < requiredKg) return { kind: 1 };',
    ],
    isolating: 'if (bestTotal >= requiredKg) return 1;',
    why: 'the direct form. `tsc` refuses it today; the suite does not run `tsc`. All four operators driven.',
  },
  {
    id: 'ordering-right',
    scope: 'code',
    pattern: new RegExp(`(?:<=|>=|<|>)\\s*[(!+~-]*\\s*${DOTTED_PREFIX}${TOTAL_REF}(?!\\s*:)`),
    tripwires: [
      'if (requiredKg <= qualifyingTotal) return true;',
      'if (requiredKg >= qualifyingTotal) return true;',
      'if (requiredKg < qualifyingTotal) return true;',
      'if (requiredKg > qualifyingTotal) return true;',
      'if (requiredKg > -qualifyingTotal) return true;',
      'if (requiredKg > (total)) return true;',
      'if (requiredKg <= lifter.bestTotal) return true;',
    ],
    isolating: 'if (requiredKg <= qualifyingTotal) return true;',
    why:
      'the same comparison with the operands swapped. All four operators, plus a negated operand ' +
      'and a parenthesised one. TWO REPAIRS THE JOINER FORCED, and both were real defects rather ' +
      'than accommodations. It had no dotted prefix, so `requiredKg <= lifter.bestTotal` — a ' +
      'member expression, which is how every total in this directory is actually reached — walked ' +
      'past it entirely; the wrapped tripwire is what found that. And with `(` in the prefix ' +
      "class it fired on `qualifiedTierFor<Total>( total: Total,` once wrapped lines were joined, " +
      "because `>` closing a type argument list looks like a comparison. The `(?!\\s*:)` lookahead " +
      'excludes a parameter declaration and keeps `> (total)`.',
  },
  {
    id: 'paren-ordering',
    scope: 'code',
    pattern: new RegExp(`${TOTAL_REF}[^\\n);,{}]*\\)\\s*(?:<=|>=|<|>)`),
    tripwires: [
      'if ((lifter.bestTotal ?? 0) >= requiredKg) return { kind: 1 };',
      'if ((lifter.bestTotal ?? 0) <= requiredKg) return { kind: 1 };',
      'if ((lifter.bestTotal ?? 0) > requiredKg) return { kind: 1 };',
      'if ((lifter.bestTotal ?? 0) < requiredKg) return { kind: 1 };',
    ],
    isolating: 'if ((bestTotal ?? 0) >= requiredKg) return 1;',
    why:
      'the form that defeats `ordering-left`: a nullish default or a cast puts a closing paren ' +
      'between the total and the operator. The character class excludes `;,{}` as well as the ' +
      'newline, because the scan now joins wrapped lines and an unbounded class would walk from ' +
      "a property name in `standingOver`'s returned object to a comparison eleven lines below it.",
  },
  {
    id: 'arith-left',
    scope: 'code',
    pattern: new RegExp(`${TOTAL_REF}\\s*[-+*/%]`),
    tripwires: [
      'const margin = total - requiredKg;',
      'const margin = total + requiredKg;',
      'const margin = total * requiredKg;',
      'const margin = total / requiredKg;',
      'const margin = total % requiredKg;',
    ],
    isolating: 'const margin = total - requiredKg;',
    why: 'arithmetic is a comparison one step away, and a sort comparator is written as a subtraction.',
  },
  {
    id: 'arith-right',
    scope: 'code',
    pattern: new RegExp(`[-+*/%]\\s*${DOTTED_PREFIX}${TOTAL_REF}`),
    tripwires: [
      'const margin = requiredKg - total;',
      'const margin = requiredKg + total;',
      'const margin = requiredKg * total;',
      'const margin = requiredKg / total;',
      'const margin = requiredKg % total;',
      'const margin = requiredKg - lifter.bestTotal;',
    ],
    isolating: 'const margin = requiredKg - total;',
    why:
      'the same, swapped. Quoted strings are stripped first, or the tag `below-qualifying-total` ' +
      'would trip this. The dotted prefix is the same repair `ordering-right` needed: without it ' +
      'the row read a bare name only, and every total here is reached through a member expression.',
  },
  {
    id: 'unary-plus',
    scope: 'code',
    pattern: new RegExp(
      `(?:[=(,\\[?:]|=>|\\breturn\\b)\\s*\\+\\s*${DOTTED_PREFIX}(?:total|[a-z][A-Za-z0-9_$]*Total)\\b`,
    ),
    tripwires: [
      'const kgs = +total;',
      'use(+total);',
      'use(other, +total);',
      'const list = [+total];',
      'const kgs = flag ? +total : 0;',
      'const kgs = flag ? 0 : +total;',
      'const read = () => +total;',
      'return +total;',
      'const kgs = +lifter.bestTotal;',
    ],
    isolating: null,
    why:
      'the shortest coercion in the language. `arith-right` catches every string this row does — ' +
      '`[-+*/%]\\s*TOTAL_REF` matches `+total` in any context — so no isolating tripwire exists ' +
      'and this row is named rather than load-bearing. All eight prefix contexts are driven.',
  },
  {
    id: 'literal-equality',
    scope: 'code',
    pattern: new RegExp(`${TOTAL_REF}\\s*[!=]==?\\s*-?\\d`),
    tripwires: [
      'if (total === 600) return true;',
      'if (total == 600) return true;',
      'if (total !== 600) return true;',
      'if (total != 600) return true;',
      'if (total === -1) return true;',
    ],
    isolating: 'if (total === 600) return true;',
    why: 'comparing a total to a NUMBER. `total === null` is a different question and stays legal.',
  },
  {
    id: 'member-read',
    scope: 'code',
    pattern: new RegExp(`${TOTAL_REF}\\s*\\??\\s*\\.`),
    tripwires: ['return total.kg >= requiredKg;', 'return total?.kg ?? 0;'],
    isolating: 'return bestTotal.kg;',
    why: 'looking inside a total at all. `totals.length` is legal because `totals` is a different word.',
  },
  {
    id: 'destructure-total',
    scope: 'code',
    pattern: new RegExp(`[}\\]]\\s*=\\s*${DOTTED_PREFIX}(?:total|[a-z][A-Za-z0-9_$]*Total)\\b`),
    tripwires: ['const { kg } = lifter.bestTotal;', 'const [kg] = total;'],
    isolating: 'const { kg } = lifter.bestTotal;',
    why:
      'looking inside without writing a dot. The dotted-path prefix is not decoration: without ' +
      'it this row matched `= total` and NOT `= lifter.bestTotal`, and its own tripwire is what ' +
      'caught that — the row was a dead letter for the exact expression it was written about.',
  },
  {
    id: 'object-introspection',
    scope: 'code',
    pattern: new RegExp(
      `\\bObject\\s*\\.\\s*(?:values|entries|keys|assign|getOwnPropertyNames)\\s*\\([^);{}]*(?:${TOTAL_REF}|${TOTALS_REF})`,
    ),
    tripwires: [
      'const kgs = Object.values(total)[0];',
      'const pairs = Object.entries(total);',
      'const names = Object.keys(total);',
      'const merged = Object.assign(target, total);',
      'const names = Object.getOwnPropertyNames(totals[0]);',
    ],
    isolating: 'const kgs = Object.values(total)[0];',
    why:
      'looking inside without naming the field. `Object.freeze` stays legal. The plural is in the ' +
      'alternation because `Object.values(totals[0])` reads the same field off the same value. ' +
      'All five verbs are driven, where one was before.',
  },
  {
    id: 'interpolate-total',
    scope: 'code',
    pattern: new RegExp(`\\$\\{[^}]*${TOTAL_REF}[^}]*\\}`),
    tripwires: [
      'faults.push(`the gate admits ${total} at nationals`);',
      'faults.push(`the gate admits ${lifter.bestTotal} kg`);',
    ],
    isolating: 'faults.push(`the gate admits ${total} at nationals`);',
    why:
      "careerRecord.ts's `careerGateFaults` promises it names a total by its INDEX because " +
      'printing one would be looking inside it. This is that promise. It is subject-keyed, so an ' +
      'ALIASED total inside a template hole walks past it — which is what `alias-total` is for, ' +
      'and which is why the two rows are a pair rather than two independent ideas.',
  },
  {
    id: 'totals-element-op',
    scope: 'code',
    pattern: new RegExp(`${TOTALS_REF}\\s*\\[[^\\]]*\\]\\s*(?:<=|>=|<|>|[-+*/%])`),
    tripwires: [
      'if (totals[index] >= requiredKg) return true;',
      'if (totals[index] <= requiredKg) return true;',
      'if (totals[index] > requiredKg) return true;',
      'if (totals[index] < requiredKg) return true;',
      'const margin = totals[index] - requiredKg;',
      'const margin = totals[index] + requiredKg;',
      'const margin = totals[index] * requiredKg;',
      'const margin = totals[index] / requiredKg;',
      'const margin = totals[index] % requiredKg;',
    ],
    isolating: 'if (totals[index] >= requiredKg) return true;',
    why: 'the element of the array, since `totals` itself is deliberately not a subject. All nine operators driven.',
  },
  {
    id: 'math-on-total',
    scope: 'code',
    pattern: new RegExp(`\\bMath\\s*\\.\\s*\\w+\\s*\\([^);{}]*${TOTAL_REF}`),
    tripwires: ['const best = Math.max(bestTotal, other);', 'const worst = Math.min(other, total);'],
    isolating: 'const best = Math.max(bestTotal, other);',
    why:
      '`Math.max` on two totals is an ordering. `Math.floor` on a day index is not, and stays ' +
      'legal. The class excludes `;{}` for the reason `paren-ordering` gives.',
  },

  // -------------------------------------------------------------------------
  // The seam itself
  // -------------------------------------------------------------------------
  {
    id: 'default-gate',
    scope: 'code',
    pattern: /:\s*CareerQualifyingGate\s*<[^>]*>\s*=/,
    tripwires: [
      'gate: CareerQualifyingGate<Total> = (a, b) => a >= b,',
      'gate: CareerQualifyingGate<NumericTotal> = () => true,',
    ],
    isolating: 'gate: CareerQualifyingGate<Total> = (a, b) => a >= b,',
    why:
      "careerCore.ts's header: \"There is deliberately no default gate. A default is the thing " +
      'that lets a caller forget to inject, and a defaulted `(a, b) => a >= b` would be exactly ' +
      'the locally-summed comparison the fence exists to refuse." That sentence had nothing ' +
      'behind it; this row is it. The isolating tripwire is the sentence\'s own subject, because ' +
      'the witness first recorded for this row used `(a as unknown as number) >= b`, which three ' +
      'rows match — so deleting this row left the mutant red and the witness proved nothing.',
  },
];

/**
 * Wrapped shapes the ban must catch, one per way a line continues.
 *
 * Each is driven twice: it must be caught once the file is read as logical
 * lines, and it must be MISSED by the physical-line scan this replaces. The
 * second half is what makes the joiner's existence a measured claim rather than
 * an assertion — without it, a tripwire that happened to fit on one line would
 * pass whether the joiner worked or not.
 */
interface WrappedTripwire {
  readonly id: string;
  readonly text: string;
  /** Which continuation rule joins it: an open bracket, or an operator. */
  readonly joinedBy: 'bracket' | 'trailing-operator' | 'leading-operator';
}

const WRAPPED: readonly WrappedTripwire[] = [
  {
    id: 'math-on-total',
    joinedBy: 'bracket',
    text: 'const best = Math.max(\n  bestTotal,\n  other,\n);',
  },
  {
    id: 'ordering-left',
    joinedBy: 'bracket',
    text: 'if (lifter.bestTotal\n  >= requiredKg) {',
  },
  {
    id: 'object-introspection',
    joinedBy: 'bracket',
    text: 'const kgs = Object.values(\n  total,\n)[0];',
  },
  {
    id: 'alias-total',
    joinedBy: 'trailing-operator',
    text: 'const candidate =\n  lifter.bestTotal;',
  },
  {
    id: 'ordering-right',
    joinedBy: 'trailing-operator',
    text: 'const ok = requiredKg <=\n  lifter.bestTotal;',
  },
  {
    id: 'member-read',
    joinedBy: 'leading-operator',
    text: 'return lifter.bestTotal\n  .kg;',
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
 * shapes the tree does not currently contain but legitimately could, and it now
 * carries the three shapes it was missing: a template literal, a wrapped call,
 * and an `Object.freeze` carrying a total. Those are the shapes most likely to
 * false-positive, and the corpus that omitted them was a comfortable subset.
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
  'let qualifyingTotal: Total | null = null;',

  // Template literals: ~30 interpolations ship in this directory and the corpus
  // had none at all, while `interpolate-total` is a subject-keyed row over
  // exactly this shape.
  'faults.push(`career: slot ${slot.slotId} needs ${slot.qualifyingTotalKg[category]} kg`);',
  'faults.push(`career: the gate admits total #${index} at ${tiers[high]}`);',
  'return `${federation.name} ${CAREER_TUNING.MEET_NAMES[tier]}`;',
  'faults.push(`career: ${record.results.length} results, ${totals.length} totals`);',

  // `Object.freeze` carrying a total, which `object-introspection` sits one verb
  // away from.
  'return Object.freeze({ ...lifter, bestTotal: standing.qualifyingTotal });',
  'return Object.freeze({ total: contest.total, bodyweightKg: contest.bodyweightKg });',

  // Wrapped calls, which the physical-line scan could never have false-positived
  // on and the logical-line scan can.
  'const outcome = recordMeetResult(record, lifter, offer.slot, {\n  total: offer.total,\n  bodyweightKg: offer.bodyweightKg,\n});',
  'return Object.freeze({\n  ...lifter,\n  bestTotal: standing.qualifyingTotal,\n});',
  'const requiredKg =\n  slot.qualifyingTotalKg[lifter.category];',
  // The shape that broke `ordering-right` the day the joiner landed: a wrapped
  // generic signature whose `>` closes a type argument list and is followed by
  // `( total`. It is in the corpus rather than only in a `why` because a
  // regression here is a false positive on a real declaration in a real file.
  'export function qualifiedTierFor<Total>(\n  total: Total,\n  category: CareerQualifyingCategory,\n  gate: CareerQualifyingGate<Total>,\n): CareerTier | null {',
  'export function careerGateFaults<Total>(\n  gate: CareerQualifyingGate<Total>,\n  totals: readonly Total[],\n): readonly string[] {',
  'return Object.freeze({\n  meetsCompleted,\n  totalsPosted,\n  qualifiedTier,\n  qualifyingTotal,\n  qualifyingBodyweightKg,\n  qualifiedAboveCompeted: standingRank(qualifiedTier) > standingRank(highestTierCompeted),\n});',
];

/** Every logical line a corpus entry becomes, as the scan would read it. */
function scannedLines(text: string): readonly string[] {
  return logicalLines(scannableCode(text));
}

/** The ids of every row that matches `text`, under each row's own scope. */
function matchingRows(text: string): readonly string[] {
  const hits: string[] = [];
  for (const banned of BANNED) {
    const lines = banned.scope === 'code' ? scannedLines(text) : logicalLines(text);
    if (lines.some((line) => banned.pattern.test(line))) hits.push(banned.id);
  }
  return hits;
}

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
    expect(SOURCE_OF.size).toBe(4);
  });

  it('joins a wrapped call back into one line before it scans', () => {
    // The joiner is itself a subject. Two properties, each with a case, plus a
    // degeneracy guard — because a joiner that ran away and glued a whole file
    // into one string would make every unbounded class in every pattern start
    // crossing statements, and the tell would be a false positive somewhere
    // else rather than here.
    //
    // Reddens on: reverting to `text.split('\n')`, on dropping any of the three
    // continuation rules, or on counting `{` as a bracket.
    expect(logicalLines('const best = Math.max(\n  bestTotal,\n);')).toEqual([
      'const best = Math.max( bestTotal, );',
    ]);
    expect(logicalLines('const a = 1;\nconst b = 2;')).toEqual(['const a = 1;', 'const b = 2;']);
    expect(logicalLines('function f() {\n  return 1;\n}')).toEqual([
      'function f() {',
      'return 1;',
      '}',
    ]);

    // On the real modules: no logical line may carry two declarations, which is
    // what a runaway join looks like from outside.
    let degenerate = 0;
    let joined = 0;
    let scanned = 0;
    for (const name of SHIPPED) {
      for (const line of scannedLines(source(name))) {
        if ((line.match(/\bexport (?:function|interface|const|type)\b/g) ?? []).length > 1) {
          degenerate += 1;
        }
        scanned += 1;
      }
      joined += 1;
    }
    expect(degenerate).toBe(0);
    expect(joined).toBe(4);
    // Counts, not bounds, on what the joiner actually produced.
    expect(scanned).toBe(1012);
  });

  it('catches a wrapped coercion a line-anchored scan walks past', () => {
    // The measurement behind the joiner, and the half that makes it non-vacuous:
    // every shape here must be MISSED by the scan this file used to run and
    // CAUGHT by the one it runs now. A tripwire that fits on one line proves
    // nothing about wrapping.
    //
    // Reddens on: reverting the scan to physical lines, which sends `caught` to
    // zero, or on a `WRAPPED` entry that was never wrapped in the first place,
    // which sends `missedByLineScan` down. MEASURED with
    // `return text.split('\n');` as the first statement of `logicalLines`:
    // `expected +0 to be 6`.
    //
    // AND MEASURED ON A REAL MODULE, NOT JUST ON THIS CORPUS, because a
    // tripwire that lives in the test file is a weaker claim than a mutant in
    // the tree. Planted in `meetEligibility`, replacing the `requiredKg` read:
    //
    //   const requiredKg = Math.max(
    //     slot.qualifyingTotalKg[lifter.category] ?? 0,
    //     lifter.bestTotal,
    //   );
    //
    // With the joiner in place, `finds nothing in any shipped module` reddens on
    // `careerCore.ts [math-on-total] const requiredKg = Math.max(
    // slot.qualifyingTotalKg[lifter.category] ?? 0, lifter.bestTotal, );` and on
    // that row alone. With `logicalLines` reverted to `text.split('\n')` and the
    // same mutant still in the tree, that assertion is GREEN. So the wrap is
    // what hid it, and the joiner is what finds it.
    let caught = 0;
    let missedByLineScan = 0;
    const joins = new Set<string>();
    for (const wrapped of WRAPPED) {
      const row = BANNED.find((banned) => banned.id === wrapped.id) as BannedPattern;
      expect(row, `no row named ${wrapped.id}`).toBeDefined();
      const code = scannableCode(wrapped.text);
      const physical = code.split('\n');
      const logical = logicalLines(code);
      if (!physical.some((line) => row.pattern.test(line))) missedByLineScan += 1;
      if (logical.some((line) => row.pattern.test(line))) caught += 1;
      joins.add(wrapped.joinedBy);
    }
    expect(caught).toBe(6);
    expect(missedByLineScan).toBe(6);
    expect(WRAPPED.length).toBe(6);
    // All three continuation rules are exercised, so a rule deleted from
    // `logicalLines` has a tripwire pointed at it.
    expect([...joins].sort()).toEqual(['bracket', 'leading-operator', 'trailing-operator']);
  });

  it('finds nothing in any shipped module', () => {
    // The ban itself. Reddens on: any coercion of a `Total` to a number in a
    // shipped module, by any of the routes below.
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
      const codeLines = logicalLines(code);
      const sourceLines = logicalLines(raw);
      for (const banned of BANNED) {
        const lines = banned.scope === 'code' ? codeLines : sourceLines;
        for (const line of lines) {
          if (banned.pattern.test(line)) findings.push(`${name} [${banned.id}] ${line.trim()}`);
        }
        checks += 1;
      }
      scanned += 1;
    }
    // The claim, with the offenders in the message rather than a length.
    expect(findings.join('\n')).toBe('');

    // Counts, not bounds, and the one with a SUBJECT is the product: a module
    // added to this directory or one that stopped being read moves 180 as
    // surely as a shortened ban list does.
    expect(scanned).toBe(4);
    expect(checks).toBe(SHIPPED.length * BANNED.length);
    expect(checks).toBe(180);
    // `BANNED.length` on its own is a fact about THIS FILE and no state of
    // `src/career/` can move it — it is pinned because a shortened list should
    // be a signed edit, not because it is evidence about the subject.
    expect(BANNED.length).toBe(45);
    expect(new Set(BANNED.map((banned) => banned.id)).size).toBe(BANNED.length);
    expect(BANNED.filter((banned) => banned.scope === 'source').length).toBe(1);
  });

  it('drives every branch of every banned pattern against a string it must catch', () => {
    // Non-vacuity, one tripwire per named BRANCH rather than one per row: a
    // regex whose alternation lost a limb reports itself instead of passing on
    // the one limb somebody happened to write a string for.
    //
    // Reddens on: deleting a verb from `object-introspection`, an operator from
    // `ordering-left`, a spelling from `ts-suppression`, or a prefix context
    // from `unary-plus` — each of which was a live branch with no tripwire.
    let live = 0;
    for (const banned of BANNED) {
      expect(banned.tripwires.length, `row ${banned.id} drives nothing`).toBeGreaterThan(0);
      for (const tripwire of banned.tripwires) {
        expect(tripwire, `pattern ${banned.id} does not match ${tripwire}`).toMatch(banned.pattern);
        live += 1;
      }
    }
    // Counts, not bounds, on the tripwire corpus itself.
    expect(live).toBe(108);
    expect(new Set(BANNED.flatMap((banned) => banned.tripwires)).size).toBe(107);
    // Every row says why it is here, so a reader deleting one knows what they
    // are deleting.
    expect(BANNED.filter((banned) => banned.why.length > 0).length).toBe(BANNED.length);
  });

  it('gives all but one row a tripwire no other row matches', () => {
    // THE FIX FOR A WITNESS THAT PROVED THE BAN AND NOT THE ROW. `cast-of-total`
    // and `as-shape` shared a tripwire string verbatim, and the mutation witness
    // recorded for `default-gate` in careerCore.ts used a mutant three rows
    // matched — so deleting `default-gate` left the mutant red and the witness
    // said nothing about the row it was filed under.
    //
    // Reddens on: two rows widening until they overlap on their isolating
    // strings, or a row deleted so that another row's isolating string stops
    // being matched at all.
    const notIsolated: string[] = [];
    let isolated = 0;
    for (const banned of BANNED) {
      if (banned.isolating === null) {
        notIsolated.push(banned.id);
        continue;
      }
      const hits = matchingRows(banned.isolating);
      expect(hits, `${banned.id} does not match its own isolating string`).toContain(banned.id);
      if (hits.length !== 1) {
        notIsolated.push(`${banned.id} shares with ${hits.filter((id) => id !== banned.id).join(', ')}`);
      } else {
        isolated += 1;
      }
    }
    // One row has no isolating string and says so in its `why`: `unary-plus` is
    // subsumed by `arith-right` on every shape it catches.
    expect(notIsolated).toEqual(['unary-plus']);
    expect(isolated).toBe(44);
    expect(isolated + notIsolated.length).toBe(BANNED.length);
  });

  it('leaves this directory’s real idioms alone', () => {
    // Precision. The ban must be narrow enough to live with, or the first
    // person to hit a false positive weakens it rather than the code.
    //
    // Reddens on: widening any row until it catches a legal comparison — the
    // most likely being an ordering row that starts matching `<Total>`, which
    // is how the first draft of `ordering-right` failed, or an unbounded
    // character class walking across a joined line, which is how
    // `paren-ordering` failed the day the joiner landed.
    const refusals: string[] = [];
    let pairs = 0;
    let lines = 0;
    for (const entry of ALLOWED) {
      const entryLines = scannedLines(entry);
      lines += entryLines.length;
      for (const banned of BANNED) {
        if (banned.scope === 'source') continue;
        for (const line of entryLines) {
          if (banned.pattern.test(line)) refusals.push(`[${banned.id}] ${line}`);
        }
        pairs += 1;
      }
    }
    expect(refusals.join('\n')).toBe('');
    // Counts, not bounds, on the corpus itself. `lines` equalling
    // `ALLOWED.length` is NOT an arithmetic identity even though it reads like
    // one: six of these entries are written across several physical lines, and
    // each is one logical line only because the joiner put it back together. A
    // joiner that stopped joining sends this to 35 + 15 and reddens here rather
    // than silently reverting the precision corpus to its old comfortable shape.
    expect(ALLOWED.length).toBe(35);
    expect(pairs).toBe(ALLOWED.length * (BANNED.length - 1));
    expect(lines).toBe(35);
    expect(ALLOWED.filter((entry) => entry.includes('\n')).length).toBe(6);
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
    expect(checked).toBe(11);
    // The plural is the mirror image, and `totals.length` is why it exists.
    expect(plural.test('totals')).toBe(true);
    expect(plural.test('ghostTotalsKg')).toBe(false);
    expect(plural.test('totalsPosted')).toBe(false);
    // The alias rows read the same vocabulary from the other side: a binding
    // NAMED like a total is not a rename and stays legal.
    const notATotal = new RegExp(`^${NOT_A_TOTAL_NAME}[A-Za-z_$][\\w$]*$`);
    expect(notATotal.test('candidate')).toBe(true);
    expect(notATotal.test('shown')).toBe(true);
    expect(notATotal.test('total')).toBe(false);
    expect(notATotal.test('qualifyingTotal')).toBe(false);
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
