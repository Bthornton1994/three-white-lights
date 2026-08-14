/**
 * empireForbiddenOutput.test.ts — can anything in `src/empire/` hand out a
 * forbidden name?
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS, AND WHAT IT IS NOT
 * ===========================================================================
 *
 * GDD §12.3 forbids the idle layer paying a covered day, and CLAUDE.md records
 * the tree-wide guard for that rule — `NAMES_A_COVERED_DAY_OR_A_PURCHASE` in
 * `src/game/streakEntitlement.ts` — being wrong on REACH, fixed, wrong on
 * PREDICATE, fixed, and wrong on reach again. All three fixes widened a scan
 * over source TEXT. The third axis, reported in CLAUDE.md and reproduced by the
 * lead agent, is that a source scan is the wrong instrument: the words are
 * chosen by the author, so a scan for words is a scan for authors who
 * cooperate. The reproduction reads the string out of `EMPIRE_FORBIDDEN_OUTPUTS`
 * itself, spells no forbidden word anywhere, adds no import edge and uses no
 * bare number — and `tsc --noEmit` exits 0 with the whole suite green.
 *
 * This file is the behavioural-and-type-level answer for this directory only.
 * It does not touch `src/game/`, it does not widen any regex, and it makes no
 * claim about any directory but this one.
 *
 * ===========================================================================
 * THE THREE INSTRUMENTS, EACH WITH ITS PROPERTY, ITS LIMIT, AND ANOTHER NAMED
 * AS THE CATCHER FOR THAT LIMIT
 * ===========================================================================
 *
 * IT WAS TWO FOR EIGHT ROUNDS, AND THE THIRD ARRIVED WITH A CHANGE TO THE
 * SHIPPED TYPES RATHER THAN TO THIS FILE. Every bypass this file has been shown
 * had one shape: a forbidden name read out of the ban list and ASSIGNED into a
 * field declared as a bare `string`, behind a numeric branch point. Each of the
 * eight rounds closed one branch point and declared the next; the ninth was
 * declared open above `OVERFLOW_ALLOCATION_CEILINGS.ROSTER_SHAPE` and no domain
 * could have reached it, because the author picks the number after seeing the
 * domain. THE TENTH CAME OUT OF THAT SAME REGION AND HAD A DIFFERENT SHAPE:
 * `completeRecruitment` throwing the ban list's first member on a roster of
 * `REPUTATION_MAX`, which no brand can see because a thrown Error's message is
 * not a declared position anywhere. It is M25, and what closed it was driving
 * the region rather than typing it — the two are not alternatives. AND THE
 * ELEVENTH CAME OUT OF ASKING WHY THE TENTH HAD BEEN INVISIBLE, WHICH IS THE
 * CHANNEL CENSUS BELOW: `historyFrom` hands its caller's own predicate the ban
 * list's first member as a second argument, and no instrument here moved at
 * all. It is M27. The five bare-string fields are branded now, so that assignment does
 * not compile — at every branch point at once. `DECLARED_BARE_STRING_FIELDS` is
 * empty, `CLOSED_BARE_STRING_FIELDS` records what it held and what closed each
 * row, and M15-M18 in `PLANTED_ROUTES` are the measurement.
 *
 * WHAT THAT DID NOT CLOSE, AND WHAT INSTRUMENT C IS FOR. A brand is a
 * constructor discipline, not an enumeration, so `asGymId(<the name>)` compiles
 * and always will. Instrument C is the named catcher for exactly that: a census
 * of every brand-constructor call site in the shipped directory, resolved
 * through the checker, set-equal in both directions with a per-site count; plus
 * a runtime refusal inside every string brand constructor. The first is
 * detection and does not need a drive; the second is containment and needs the
 * path to run. Its own section below says which is which and does not blur
 * them.
 *
 * The shape is CLAUDE.md's "The Form That Survived": a bounded claim, a
 * declared limit, and a named catcher — with the route run against the check
 * rather than asserted about it. The mutation results are in this file's
 * `PLANTED_ROUTES` table and in the piece's report.
 *
 * INSTRUMENT A — THE TYPE-LEVEL POSITION CENSUS (`stringSurface`).
 *
 *   What it guarantees, in the mechanism's own terms: for every one of this
 *   directory's exports, every `string`-valued position reachable from that
 *   export's TYPE — through unions, intersections, arrays, tuples, object
 *   properties, index signatures and the return types of function-valued
 *   properties — is classified by the TypeScript checker as one of
 *   (a) a closed string-literal union, (b) a branded string, or (c) a bare
 *   `string`; the (a) members are asserted to contain no banned name, and the
 *   (b) and (c) POSITION LISTS are pinned as set equalities in both directions.
 *
 *   So the bite is not that bare strings are absent — twenty-three of them are
 *   legitimate, and they are five FIELDS reached through eighteen exports,
 *   listed in `DECLARED_BARE_STRING_FIELDS` with a reason per field. The bite
 *   is that a NEW one cannot arrive unnoticed. The reproduced defect returns
 *   `{ readonly kind: string; readonly days: number }`, which is a
 *   twenty-fourth position, and that is what reddens — verbatim, as
 *   `+ "production.ts#idleMilestoneGrant#return.kind"`.
 *
 *   Its limit, stated because no type reaches past it: it cannot see a value
 *   that is legitimately typed as a string. `NpcLifter.displayName` is a bare
 *   `string` on purpose, and nothing in a signature says whether the string in
 *   it is a player's chosen name or `'covered-day'`. Instrument B is the
 *   catcher for that limit, and it is pointed at those positions by `SENTINELS`,
 *   one benign sentinel per caller-supplied position, twelve in all.
 *
 *   Its second limit: it reads DECLARED types, so `as string`, `as unknown as
 *   T` and a `JSON.parse` round trip all erase what it reads. That is attack
 *   shape 18 and it is also covered by instrument B, which reads values.
 *
 * INSTRUMENT B — THE BEHAVIOURAL DRIVE AND DEEP SCAN (`observeEverything`).
 *
 *   What it guarantees, in the mechanism's own terms: every export of this
 *   directory is driven or read; every value reachable from what comes back —
 *   through own enumerable AND non-enumerable keys, through property KEYS as
 *   well as values, through getters (invoked), arrays, `Map` keys and values,
 *   `Set` members, frozen structures, thrown payloads and every argument
 *   re-read after the call — is compared against `BANNED_VOCABULARY` under the
 *   named folds in `NORMALISATION_FOLDS`, by equality for every value and by
 *   containment for every value outside the declared diagnostic channel.
 *
 *   Its limit: it samples inputs. A branch no point of the domain reaches
 *   produces nothing to scan. So every domain in `NUMERIC_DOMAINS` is derived
 *   from `EMPIRE_TUNING`'s own numbers and is asserted to straddle them —
 *   CLAUDE.md's "a domain that samples only extremes is empty where it
 *   matters", which was earned on a probe that sampled `0` and `1_000_000`
 *   while every threshold sat between 260 and 680. The reproduced defect has
 *   this property exactly: `Math.floor(checkIns / 12)` is `0` for every
 *   `checkIns` below twelve.
 *
 *   THAT SENTENCE USED TO BE TRUE OF ONE DOMAIN AND FALSE OF ITS NEIGHBOUR, AND
 *   THE SIXTH BYPASS RODE THE DIFFERENCE. There was a ten-point
 *   `SMALL_NUMBER_DOMAIN` derived from the OFFLINE_EARNINGS *hour* caps, handed
 *   to eight axes that are not hours, and the assertion that checks straddling
 *   looped `NUMBER_DOMAIN` and pinned its neighbour by LENGTH alone. A
 *   `recordFriendVisit` returning a forbidden name on exactly
 *   `RIVAL_COMPARISON_PERIOD_DAYS` was invisible: `tsc` exit 0, 484 tests green.
 *   The assertion loops the registry now, and `DOMAIN_CENSUS.DOMAINS` and
 *   `CONTAINMENT_CHECKS` are both pinned, so a seventh domain cannot be
 *   unasserted and a domain that obliges itself to nothing cannot pass.
 *
 *   AND THAT FIX MADE EVERY DOMAIN PROVE IT CONTAINED THE THRESHOLDS OF ITS OWN
 *   UNITS, WHILE NOTHING MADE THE UNIT REGISTRY PROVE IT CONTAINED ANYTHING.
 *   That is the seventh bypass, and it arrived twice. `FRIEND_VISITS_PER_DAY`
 *   is 10 and was filed under `count` because its name says visits; the value
 *   it gates in a mutant is a DAY, and `day` filed three thresholds, so
 *   `DAY_DOMAIN` was thirteen points and 10 was not one of them. Worse:
 *   `EMPIRE_TUNING` has 100 numeric leaves and the registry filed 40, so
 *   `NPC_RECRUIT_COST_GYM_BUCKS.novice` — 500 — was in no unit, in no narrow
 *   domain, and NOT IN `NUMBER_DOMAIN` EITHER, because that domain was the
 *   union of the filed thresholds rather than of the tuning block. Both mutants:
 *   `tsc` exit 0, 13 files and 489 tests green.
 *
 *   Two things close it, and the second is the one that matters. The registry
 *   is now JOINED to `EMPIRE_TUNING` by a walk — every numeric leaf is filed
 *   under a unit or carries a reason on `NOT_A_BRANCH_POINT`, set-equal both
 *   ways — so a knob cannot be absent from the population. And a domain now
 *   carries every branch point at or below its `foreignCeiling` REGARDLESS OF
 *   UNIT, so which unit a number was filed under stops deciding whether any
 *   domain has it. Filing is what makes a threshold unconditional above a
 *   ceiling; it is no longer what makes it present.
 *
 *   THAT ROUTE WAS OPEN AND IS NOW MOSTLY CLOSED, and this paragraph is the
 *   before and the after rather than only the after. A ceiling is a real
 *   concession: a subject that keys a ceilinged axis on a branch point ABOVE
 *   that ceiling was invisible, `DOMAIN_CENSUS.OMITTED_ABOVE_CEILING` counted
 *   the route per domain — 39, 39 and 56 against 0, 0 and 0 — and the file said
 *   plainly that nothing here caught it. The eighth bypass was exactly that:
 *   `recordFriendVisit` returning the ban list's first member on day 2 000,
 *   which is `NPC_RECRUIT_COST_GYM_BUCKS.club` and is above the DAY ceiling of
 *   600. `tsc` exit 0, 13 files and 495 tests green.
 *
 *   THE OVERFLOW PASS is the catcher. The ceilings buy back a CROSS-PRODUCT and
 *   a dropped point does not need one, so each of the 134 dropped points gets
 *   its axis's subjects called once at that single value against a minimal
 *   fixture, scanned by the same `deepScan` through the same `scanRow`. The
 *   ceilings did not move. What it does NOT cover is written as numbers rather
 *   than a sentence: `OVERFLOW_CENSUS.POINTS_DRIVEN` is 134 of 134, and
 *   `OVERFLOW_RESIDUAL` names the 330 (subject, point) pairs an allocation
 *   budget declines outright and the 690 more it drives with the re-read
 *   ARGUMENT left unscanned, per subject, with the reason.
 *
 *   THOSE NUMBERS WERE 104 AND 1 020, AND THE THIRTY POINTS THE FIRST ONE WAS
 *   SHORT ARE WHERE THE TENTH BYPASS LIVED. This paragraph used to say the
 *   ROSTER_SHAPE points above 2 000 had no drive at all "because that axis has
 *   no subject whose cost is flat in the roster size". True, and it was
 *   answering the wrong question: `scanRow` has two regions, and on that axis
 *   the linear one is the argument handed IN, not what comes back. All 690 of
 *   those pairs drive in 7.9 s with the return region scanned. `OverflowCost`
 *   has three classes now and `residual`'s rows say which region they decline.
 *
 *   Its second limit, and the one the domain fix alone did not close: a domain
 *   decides which NUMBERS an axis is driven at and says nothing about whether
 *   the subject's own guards let the interesting branch run. Every gym the
 *   social loop offered `recordFriendVisit` was refused on every day, so its
 *   VISITED arm — the arm the bypass plants its name in — was produced zero
 *   times at every point of every domain this file has ever had. 'produced
 *   every arm of every discriminated return' compares the arms instrument A
 *   declares against the arms instrument B reached, in both directions.
 *
 *   Its second limit: it is a value check, so it has a decode horizon. A
 *   function returning an INDEX that a later wiring piece uses to select a
 *   forbidden name (attack shape 15) carries no string and is invisible here.
 *   Instrument A is the catcher for the branded-string half of that shape
 *   (`asNpcId(...)` widens a new branded position and reddens the census); the
 *   plain-number half has no catcher in this file and is declared below.
 *
 * ===========================================================================
 * THE CHANNEL CENSUS AND THE CALLBACK PASS — NOT A FOURTH INSTRUMENT, AND THE
 * DIFFERENCE IS THE POINT
 * ===========================================================================
 *
 * The three instruments above ask WHERE a name sits and WHICH NUMBER a branch
 * is keyed on. Ten bypasses were found by enumerating those two things. The
 * eleventh was found by asking a question none of them asks: WHAT ARE THE
 * ROUTES A STRING CAN LEAVE BY?
 *
 * `channelCensus` enumerates them — eleven, from the language rather than from
 * this directory, and the SITES per channel per module scanned off the shipped
 * source with the checker. It is a census of routes and not a detector of
 * payloads: what it guarantees is that a new escape site, or a channel this
 * directory does not currently use, moves a pinned number. Six of the eleven
 * channels have zero sites and those are the rows it is most for.
 *
 * Its reading, which is what the section is worth — AND THE FIRST HALF OF IT IS
 * NOW STALE, so it is corrected here rather than left standing. It read:
 * "`throw` is covered BY THE DRIVE ALONE, at 54 sites — a sampling instrument,
 * on the one channel that has no type and no constructor." That was true at
 * E18 and is the measurement that got the wrap built. E19 routed 53 of those 54
 * sites through `refuseWith`, so the throw channel now has the two-part shape
 * the brand constructors have: CONTAINMENT at runtime, from the wrap refusing a
 * message that equals a forbidden output, and DETECTION with no drive at all,
 * from `THROW_GATE_SITES` set-equalling the channel's whole site list at two.
 * Neither is the other and neither makes the drive redundant — the drive is
 * still what reads a message that merely CONTAINS a banned name.
 *
 * And `callback-invocation` was covered by NOTHING, in any of the three, which
 * is M27 and is the eleventh bypass. THE CALLBACK PASS is the catcher written
 * for it: every exported function that calls a parameter is driven with a
 * callback that records what it is handed, and the scan is `deepScan`, the same
 * walker instrument B uses. E19 widened that pass from one fixture to the same
 * COUNT branch-point domain the main drive walks, which is what closes the
 * limit its own header declared.
 *
 * A NOTE ON THE WORD, because this file already uses it: the DIAGNOSTIC channel
 * is an exemption class over eight `*Faults` exports, and a CHANNEL in this
 * section is an escape route. They are unrelated and the collision is the
 * English rather than the design.
 *
 * ===========================================================================
 * WHAT NEITHER INSTRUMENT CATCHES — NAMED CONCRETELY, BECAUSE AN UNDECLARED
 * LIMIT IS THE DEFECT THIS CODEBASE HAS RECORDED EIGHT TIMES
 * ===========================================================================
 *
 * ATTACK SHAPE 16, THE EFFECT WITH NO NAME ANYWHERE. An export
 * `idleProtectionDays(checkIns: number): number` returning
 * `Math.floor(checkIns / OFFLINE_EARNINGS_CAP_HOURS)` contains no forbidden
 * name in its source, its return value, a key, a throw, at any depth, under any
 * fold. NO NAME-BASED GUARD CAN CATCH IT, because the hazard is a quantity and
 * both instruments here are about a word. It was planted as M8 and both
 * instruments stayed green; the run is recorded in `PLANTED_ROUTES`.
 *
 * What DOES fire on it, and it is worth being exact about how much that is
 * worth: 'drives every export the census knows about' is a set equality over
 * the directory's whole export list in both directions, so the new export
 * reddens THIS file until somebody adds a row for it. Measured: mutant M8 in
 * `PLANTED_ROUTES` is that function, and it reddened exactly two assertions,
 * both of them counts of the export list, and nothing else in the repository. That is not detection — it is CLAUDE.md's stated purpose
 * for the covered-day guard, *"a new way to hand out a covered day forces a
 * visible edit where a reviewer sees it"*. The reviewer is the mechanism. Do
 * not read the export census as a semantic check; it is a tripwire on the
 * surface's shape.
 *
 * The semantic catcher for shape 16 is a monotonicity sweep on the day list, in
 * `src/game/streakSweep.ts`'s shape, which this directory already has three of
 * — `ENGAGEMENT_SWEEP`, `REPUTATION_SWEEP` and `EMPIRE_SWEEP`. It covers such a
 * function only ONCE IT IS WIRED into `runEngagement`. An unwired export is
 * covered by nothing in this repository, and that is the honest state of it.
 *
 * A RETURNED FUNCTION IS NOT INVOKED. If an export returns a closure that would
 * yield a forbidden name when called, instrument B walks the closure's own
 * properties and not its result — invoking arbitrary returned functions with
 * invented arguments is not something this walker can do safely. A getter is
 * invoked; a method is not. `DRIVE_CENSUS.GETTERS_INVOKED` is zero on the
 * subject and `TRIPWIRE_CENSUS.GETTERS_INVOKED` is one, so the getter branch is
 * pinned as live by the tripwire and by nothing in the directory.
 *
 * A FOLD NOT IN `NORMALISATION_FOLDS` IS NOT APPLIED. `'coveredx-day'` and a
 * translation of the word are outside every fold here and are not caught. Each
 * fold that IS applied carries its own tripwire in `fold survives its own
 * tripwire`, so the fold list is measured rather than asserted.
 *
 * AN `Error.stack` DISGUISED AS FRAMES. The walker skips the `stack` key
 * because a real stack carries this checkout's absolute paths, so a census over
 * it would be a census over the machine. That used to be a limit with no
 * catcher at all — `Object.defineProperty(err, 'stack', { value: <read out of
 * the ban list> })` in a shipped refusal path moved no count. The stack is now
 * read with its `at` frames stripped and what remains is checked;
 * `DRIVE_CENSUS.STACKS` is non-zero so the branch is pinned as live. What is
 * still not caught is a planted value whose EVERY line matches a frame pattern,
 * and that residual is planted and asserted in 'reads a redefined Error.stack'
 * rather than described.
 *
 * AN AXIS LITERAL PASSED TO `.map()`. Two checks cover where a domain may be
 * declared — 'defines every numeric domain inside the registry' scans for a
 * module-level `readonly number[]`, and 'declares every literal for-of axis'
 * scans for `for (const x of [ … ])`. Neither sees an array literal handed
 * straight to `.map()`, which is how `axisReadings` writes its axes. What
 * covers those is `AXIS_CENSUS`, which pins each axis's POINT COUNT as well as
 * its disagreements, so a truncated axis moves a number. That is a weaker
 * guarantee than the two scans and it is stated rather than implied.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { types as nodeTypes } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import * as core from './empireCore';
import * as invariant from './empireInvariant';
import * as tuningModule from './empireTuning';
import * as engagementModule from './engagement';
import * as expansionModule from './expansion';
import * as npcModule from './npc';
import * as productionModule from './production';
import * as recruitmentModule from './recruitment';
import * as reputationModule from './reputation';
import * as socialModule from './social';

import { EMPIRE_TUNING } from './empireTuning';
import type {
  AccelerableOutput,
  AppliedAccelerant,
  EmpireAccelerant,
  EmpireClock,
  EmpireOutput,
  EmpireState,
  EquipmentTier,
  GymAxes,
  GymId,
  NpcLifter,
  NpcTier,
  StaffRole,
  UnacceleratedSeconds,
  WallClockBooks,
  WallClockFundedOutput,
} from './empireCore';
import type { EmpirePolicy, EmpireDayEntry, EmpireGym, SocialInputs } from './empireInvariant';
import type { ExpansionAxis, ExpansionBuild, ExpansionContext } from './expansion';
import type { EngagementHistory } from './engagement';
import type {
  CalendarDay,
  Encouragement,
  GymSnapshot,
  SocialCalendarContext,
  SocialContext,
} from './social';
import type { RosterRateSource } from './production';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
/** This file, read as text by the two checks that scan for a domain the registry never saw. */
const THIS_FILE = fileURLToPath(import.meta.url);

/**
 * This file's source with every comment removed.
 *
 * The two scans below look for code shapes, and this file describes those
 * shapes in prose. Without the strip, writing down what the scan looks for
 * makes the scan find it — which happened twice while this was being written
 * and is the reason the strip exists rather than a rephrasing. A rephrasing
 * would have made the sentence agree with the scan by making it harder to
 * read, which is the evasion CLAUDE.md records twice.
 *
 * Its limit: it also strips a `//` inside a string literal. No scan here reads
 * a string literal's contents, so that costs nothing today, and it is named so
 * that a scan which does can see the price.
 */
function sourceWithoutComments(): string {
  return readFileSync(THIS_FILE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

// ---------------------------------------------------------------------------
// The banned vocabulary, and the two exports that legitimately are it
// ---------------------------------------------------------------------------

/**
 * The names no export of this directory may produce.
 *
 * READ out of the directory's own two ban lists rather than retyped, so a name
 * added to either is swept without this file being edited — and the content
 * pins in 'names no forbidden output in any closed literal union' and in
 * 'produces no banned name from any export but the two that ARE the ban lists'
 * are what say one arrived.
 *
 * THAT SENTENCE USED TO BE FALSE AND IS RECORDED HERE RATHER THAN QUIETLY
 * CORRECTED. This was seven hardcoded literals under a comment claiming they
 * were taken from the ban lists, which is the exact defect CLAUDE.md records
 * eight times: a sentence that was true of an intention rather than of the
 * code. Adding a name to `EMPIRE_FORBIDDEN_OUTPUTS` would have left this list
 * short and swept the tree for six names while claiming seven.
 *
 * The vacuity risk the derivation introduces, and its catcher: an emptied ban
 * list would empty this and every zero below would become vacuous. `BANNED`
 * in `SURFACE_CENSUS` pins the length, and the two content pins name every
 * member, so an emptied or shortened list reddens before the zeros do.
 */
const BANNED_VOCABULARY: readonly string[] = Object.freeze([
  ...core.EMPIRE_FORBIDDEN_OUTPUTS,
  ...reputationModule.FORBIDDEN_UNLOCK_KEYS,
]);

/**
 * The two exports that ARE the ban lists.
 *
 * Exempted by export identity and by nothing else. Anything that READS one of
 * these is not exempt — which matters, because reading the ban list is exactly
 * where the reproduced defect gets its string. Their contents are pinned by
 * count and by content below rather than skipped, so an exemption cannot grow
 * a member quietly.
 */
const BAN_LIST_EXPORTS: readonly string[] = Object.freeze([
  'EMPIRE_FORBIDDEN_OUTPUTS',
  'FORBIDDEN_UNLOCK_KEYS',
]);

/**
 * The exports whose channel is diagnostic prose rather than a payable value.
 *
 * Every one returns `readonly string[]` and every message in it is a sentence.
 * A sentence that NAMES a forbidden output ('covered-day is named as forbidden
 * and is also payable') is the module reporting a fault, not paying one — so
 * these are exempt from the CONTAINMENT half of the check and are NOT exempt
 * from the EQUALITY half. A fault list whose element IS a forbidden name, with
 * no sentence around it, is a grant wearing a diagnostic's coat and reddens.
 *
 * Attack shape 19 is aimed precisely at this exemption. It is scoped to seven
 * named exports, by name, and `DIAGNOSTIC_CHANNEL_CENSUS` pins what they
 * actually produced under the drive rather than passing over them in silence.
 */
const DIAGNOSTIC_CHANNEL_EXPORTS: readonly string[] = Object.freeze([
  'empireVocabularyFaults',
  'empireStateFaults',
  'empireRunFaults',
  'engagementRunFaults',
  'expansionVocabularyFaults',
  'reputationVocabularyFaults',
  'socialVocabularyFaults',
  'socialContextFaults',
]);

// ---------------------------------------------------------------------------
// Normalisation — the folds, named, each with a tripwire
// ---------------------------------------------------------------------------

/**
 * The folds a candidate string is put through before it is compared.
 *
 * Named individually rather than composed into one regex because CLAUDE.md's
 * rule is that the normalisation a guard chooses is itself a declared limit:
 * it must state which folds it applies and pin a tripwire per fold. The test
 * 'every declared fold survives its own tripwire' does exactly that.
 *
 * `separators` collapses any run of non-alphanumeric characters to a single
 * hyphen, which is what folds `'covered--day'`, `'covered day'`,
 * `'covered_day'` and the U+2011 non-breaking hyphen back onto the name. The
 * tree-wide scan in `src/game/` catches the first of those and not the others.
 */
const NORMALISATION_FOLDS = Object.freeze({
  case: (value: string): string => value.toLowerCase(),
  trim: (value: string): string => value.trim(),
  separators: (value: string): string =>
    value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, ''),
} as const);

const FOLD_NAMES: readonly string[] = Object.freeze(Object.keys(NORMALISATION_FOLDS).sort());

/** Every fold, applied in a fixed order. The order is stated, not implied. */
function normalise(value: string): string {
  return NORMALISATION_FOLDS.separators(
    NORMALISATION_FOLDS.case(NORMALISATION_FOLDS.trim(value)),
  );
}

const BANNED_NORMALISED: ReadonlySet<string> = new Set(BANNED_VOCABULARY.map(normalise));

/** Every banned name, as a fold-tripwire pair: the variant and the name it folds onto. */
const FOLD_TRIPWIRES: readonly (readonly [string, string, string])[] = Object.freeze([
  ['case', 'COVERED-DAY', 'covered-day'],
  ['case', 'Covered-Day', 'covered-day'],
  ['trim', '  chalk  ', 'chalk'],
  ['separators', 'covered--day', 'covered-day'],
  ['separators', 'covered day', 'covered-day'],
  ['separators', 'covered_day', 'covered-day'],
  ['separators', 'covered‑day', 'covered-day'],
  ['separators', '-covered-day-', 'covered-day'],
]);

/** Strings that must NOT fold onto a banned name. The other half of the fold check. */
const FOLD_NON_MATCHES: readonly string[] = Object.freeze([
  'coveredx-day',
  'covered',
  'day',
  'gym-bucks',
  'training-iq',
  'physio-days-saved',
  'e1rmx',
]);

// ===========================================================================
// INSTRUMENT A — the type-level string-position census
// ===========================================================================

/**
 * How deep the type walk goes before it gives up.
 *
 * Twelve rather than a smaller number because the deepest real chain in this
 * directory is `EmpireRun -> gym -> state -> roster -> [] -> id`, and a walker
 * that truncates reports a false negative in the reassuring direction.
 * `depthCuts` is pinned at zero, so a type arriving that is deeper than this
 * reports itself instead of being silently shortened.
 */
const TYPE_WALK_MAX_DEPTH = 12;

type StringPositionKind = 'literal' | 'branded' | 'bare';

interface StringPosition {
  readonly module: string;
  readonly export: string;
  /** Where in the type the string sits, e.g. `return.kind` or `value[].entry.gymId`. */
  readonly path: string;
  readonly kind: StringPositionKind;
  /** The members, for a `literal` position. Empty otherwise. */
  readonly members: readonly string[];
}

interface StringSurface {
  readonly modules: readonly string[];
  readonly exports: readonly string[];
  readonly positions: readonly StringPosition[];
  /** Non-zero means the walk truncated and the census below is a prefix. */
  readonly depthCuts: number;
  /** Diagnostics from the directory's own sources. Must be empty. */
  readonly sourceDiagnostics: readonly string[];
}

function compilerOptions(): ts.CompilerOptions {
  const configPath = path.join(REPO_ROOT, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile).config as unknown;
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, REPO_ROOT);
  return { ...parsed.options, noEmit: true, skipLibCheck: true };
}

/** The shipped modules, read off the directory rather than listed. */
function shippedModulePaths(): readonly string[] {
  return readdirSync(HERE)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort()
    .map((name) => path.join(HERE, name));
}

/**
 * The probe module path, served from memory and never written to disk.
 *
 * It exists so instrument A can be shown to SEE a bare-string return and a
 * banned literal without any shipped file being edited. `programWith` swaps
 * the compiler host's reader for this one path only, which is the technique
 * `empireCore.test.ts`'s `brandCensus` already uses.
 */
const PROBE_PATH = path.join(HERE, '__forbiddenOutputProbe.ts');

function programWith(
  options: ts.CompilerOptions,
  roots: readonly string[],
  probeText: string | null,
  probePath: string = PROBE_PATH,
): ts.Program {
  const host = ts.createCompilerHost(options, true);
  if (probeText !== null) {
    const readSource = host.getSourceFile.bind(host);
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) =>
      path.normalize(fileName) === probePath
        ? ts.createSourceFile(fileName, probeText, languageVersion, true, ts.ScriptKind.TS)
        : readSource(fileName, languageVersion, onError, shouldCreate);
    const exists = host.fileExists.bind(host);
    host.fileExists = (fileName) =>
      path.normalize(fileName) === probePath ? true : exists(fileName);
    const read = host.readFile.bind(host);
    host.readFile = (fileName) =>
      path.normalize(fileName) === probePath ? probeText : read(fileName);
  }
  return ts.createProgram([...roots], options, host);
}

/**
 * Walk every export's type and classify every reachable string position.
 *
 * The three classifications are decided by the CHECKER, not by the text: a
 * position is `literal` when its type is a string-literal type, `branded` when
 * it is an intersection carrying both `string` and this directory's brand
 * symbol, and `bare` when it is the `string` keyword. Asking the compiler is
 * the load-bearing choice — `EMPIRE_FORBIDDEN_OUTPUTS[0] as string` is a bare
 * string to the checker whatever the source looks like.
 */
function surfaceOf(
  roots: readonly string[],
  probeText: string | null,
  probePath: string = PROBE_PATH,
): StringSurface {
  const options = compilerOptions();
  const program = programWith(options, roots, probeText, probePath);
  const checker = program.getTypeChecker();

  const corePath = path.join(HERE, 'empireCore.ts');
  const core = program.getSourceFile(corePath);
  if (core === undefined) throw new Error(`${corePath} is not in the program`);

  // The brand symbol, taken from its declaration rather than from its spelling.
  let brandSymbol: ts.Symbol | undefined;
  core.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'EMPIRE_BRAND') {
        brandSymbol = checker.getSymbolAtLocation(declaration.name);
      }
    }
  });
  if (brandSymbol === undefined) throw new Error('no EMPIRE_BRAND declaration in empireCore.ts');

  const resolved = (symbol: ts.Symbol | undefined): ts.Symbol | undefined =>
    symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
      ? checker.getAliasedSymbol(symbol)
      : symbol;

  const carriesBrand = (type: ts.Type): boolean =>
    type.getProperties().some((property) => {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      const name = declaration === undefined ? undefined : (declaration as ts.NamedDeclaration).name;
      if (name === undefined || !ts.isComputedPropertyName(name)) return false;
      return resolved(checker.getSymbolAtLocation(name.expression)) === brandSymbol;
    });

  const positions: StringPosition[] = [];
  const modules: string[] = [];
  const exportNames: string[] = [];
  let depthCuts = 0;

  const PRIMITIVE_FLAGS =
    ts.TypeFlags.Number |
    ts.TypeFlags.NumberLiteral |
    ts.TypeFlags.Boolean |
    ts.TypeFlags.BooleanLiteral |
    ts.TypeFlags.BigInt |
    ts.TypeFlags.BigIntLiteral |
    ts.TypeFlags.ESSymbolLike |
    ts.TypeFlags.Void |
    ts.TypeFlags.Undefined |
    ts.TypeFlags.Null |
    ts.TypeFlags.Never |
    ts.TypeFlags.Unknown |
    ts.TypeFlags.Any;

  for (const root of roots) {
    const source = program.getSourceFile(root);
    if (source === undefined) throw new Error(`${root} is not in the program`);
    const moduleSymbol = checker.getSymbolAtLocation(source);
    if (moduleSymbol === undefined) continue;
    const moduleName = path.basename(root);
    modules.push(moduleName);

    for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
      const declaration = symbol.declarations?.[0];
      if (declaration === undefined) continue;
      if (ts.isTypeAliasDeclaration(declaration) || ts.isInterfaceDeclaration(declaration)) continue;
      const exportName = symbol.getName();
      exportNames.push(`${moduleName}#${exportName}`);

      const isFunction = ts.isFunctionDeclaration(declaration);
      let entry: ts.Type;
      let entryPath: string;
      if (isFunction) {
        const signature = checker.getSignatureFromDeclaration(declaration);
        if (signature === undefined) throw new Error(`no signature for ${exportName}`);
        entry = checker.getReturnTypeOfSignature(signature);
        entryPath = 'return';
      } else {
        entry = checker.getTypeOfSymbolAtLocation(symbol, declaration);
        entryPath = 'value';
      }

      const push = (kind: StringPositionKind, at: string, members: readonly string[]): void => {
        positions.push({ module: moduleName, export: exportName, path: at, kind, members });
      };

      /**
       * Cycle detection is scoped to the CURRENT PATH, not to the whole export.
       *
       * This was wrong once, in the direction that under-reports. A single
       * `Set<ts.Type>` per export made the walk report the FIRST bare string it
       * reached and silently drop every later one, because the checker hands
       * back one `string` type object for all of them: `createEmpireGym`
       * reported `state.roster[].displayName` and lost `pending[].id`
       * altogether. A missing position is a hole in the census that reads
       * exactly like a clean surface.
       */
      const walk = (type: ts.Type, at: string, depth: number, ancestors: readonly ts.Type[]): void => {
        if (depth > TYPE_WALK_MAX_DEPTH) {
          depthCuts += 1;
          return;
        }
        if (ancestors.includes(type)) return;
        const below = [...ancestors, type];

        if ((type.flags & ts.TypeFlags.StringLiteral) !== 0) {
          push('literal', at, [(type as ts.StringLiteralType).value]);
          return;
        }
        if ((type.flags & ts.TypeFlags.String) !== 0) {
          push('bare', at, []);
          return;
        }
        if (type.isIntersection()) {
          const stringy = type.types.some(
            (part) => (part.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral)) !== 0,
          );
          if (stringy && carriesBrand(type)) {
            push('branded', at, []);
            return;
          }
          for (const part of type.types) walk(part, at, depth + 1, below);
          return;
        }
        // A branded PRIMITIVE (a branded number, say) resolves its apparent
        // members off `Number`, whose `toString` returns a string. Walking those
        // would invent a string position in every numeric brand in the
        // directory, so primitives stop here.
        if ((type.flags & PRIMITIVE_FLAGS) !== 0) return;
        if (type.isUnion()) {
          for (const part of type.types) walk(part, at, depth + 1, below);
          return;
        }
        if ((type.flags & (ts.TypeFlags.Conditional | ts.TypeFlags.TypeParameter)) !== 0) {
          const constraint = checker.getBaseConstraintOfType(type);
          if (constraint !== undefined && constraint !== type) walk(constraint, at, depth + 1, below);
          return;
        }
        if (checker.isArrayType(type) || checker.isTupleType(type)) {
          for (const argument of checker.getTypeArguments(type as ts.TypeReference)) {
            walk(argument, `${at}[]`, depth + 1, below);
          }
          return;
        }
        if ((type.flags & ts.TypeFlags.Object) !== 0) {
          for (const index of checker.getIndexInfosOfType(type)) {
            walk(index.type, `${at}[key]`, depth + 1, below);
          }
          for (const call of type.getCallSignatures()) {
            walk(checker.getReturnTypeOfSignature(call), `${at}()`, depth + 1, below);
          }
          for (const property of type.getProperties()) {
            const site = property.valueDeclaration ?? property.declarations?.[0] ?? declaration;
            walk(
              checker.getTypeOfSymbolAtLocation(property, site),
              `${at}.${property.getName()}`,
              depth + 1,
              below,
            );
          }
        }
      };

      walk(entry, entryPath, 0, []);
    }
  }

  const sourceDiagnostics: string[] = [];
  for (const root of roots) {
    const source = program.getSourceFile(root);
    if (source === undefined) continue;
    for (const diagnostic of [
      ...program.getSyntacticDiagnostics(source),
      ...program.getSemanticDiagnostics(source),
    ]) {
      sourceDiagnostics.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '));
    }
  }

  return {
    modules: Object.freeze(modules),
    exports: Object.freeze(exportNames.sort()),
    positions: Object.freeze(positions),
    depthCuts,
    sourceDiagnostics: Object.freeze(sourceDiagnostics),
  };
}

let surfaceMemo: StringSurface | null = null;

/** The census of the shipped directory. Memoised; the program build is the cost. */
function stringSurface(): StringSurface {
  if (surfaceMemo !== null) return surfaceMemo;
  surfaceMemo = surfaceOf(shippedModulePaths(), null);
  return surfaceMemo;
}

/** A position, as one sortable line, for a set equality that names its members. */
const positionKey = (position: StringPosition): string =>
  `${position.module}#${position.export}#${position.path}`;

const distinct = (values: readonly string[]): readonly string[] => [...new Set(values)].sort();

const bareKeys = (surface: StringSurface): readonly string[] =>
  distinct(surface.positions.filter((p) => p.kind === 'bare').map(positionKey));

const brandedKeys = (surface: StringSurface): readonly string[] =>
  distinct(surface.positions.filter((p) => p.kind === 'branded').map(positionKey));

/**
 * Every bare-`string` position in the directory, grouped by the FIELD it is.
 *
 * IT IS EMPTY, AND THE EMPTINESS IS THE ROUND'S RESULT RATHER THAN A DELETION.
 * There were five fields and twenty-three positions. All twenty-three are
 * branded now and sit in `DECLARED_BRANDED_STRING_POSITIONS`; the join in
 * 'every field that used to be a bare string is branded now' asserts that,
 * position by position, so this list going empty and that list growing are one
 * fact checked from both ends rather than two edits that happen to agree.
 *
 * WHAT THE EQUALITY IS WORTH NOW, STATED EXACTLY, BECAUSE AN EMPTY LIST IS THE
 * SHAPE CLAUDE.MD NAMES AS VACUOUS. Two of the three assertions in
 * 'pins every bare-string position' change character:
 *
 *   - `expect(bareKeys(surface)).toEqual(declared)` is STRONGER empty than it
 *     was full. It now reddens on the arrival of ANY bare-string position
 *     anywhere in the directory, which is the strictest state it can be in.
 *   - the per-group loop that requires a reason over 80 characters now walks
 *     nothing. It is vacuous, in the strict sense: no state of the shipped
 *     directory makes it red. It is kept because it becomes non-vacuous again
 *     the moment a row is added, and it is named here so nobody reads it as
 *     coverage.
 *
 * THE NON-VACUITY GUARD FOR THE WALKER ITSELF IS THE PROBE MODULE, and it is
 * what stops the zero being a zero about a broken walker: 'sees the reproduced
 * defect' drives the same census over an eleventh module whose
 * `{ readonly kind: string }` return must be reported as exactly one bare
 * position. If the walker stopped classifying bare strings, that test is red
 * and this equality would still be green.
 */
const DECLARED_BARE_STRING_FIELDS: readonly {
  readonly field: string;
  readonly why: string;
  readonly positions: readonly string[];
}[] = Object.freeze([]);

/**
 * The five fields that WERE bare strings, why each was, and what closed it.
 *
 * Kept as a live check rather than as history. Every position here is asserted
 * to be a branded position now, so reverting any one field to `string` is red
 * twice — here, and on the bare equality above.
 *
 * ONE ROW CARRIED A CLAIM THE PROBE FALSIFIES, AND IT IS CORRECTED RATHER THAN
 * DELETED. `PendingRecruit.id` said narrowing it "buys nothing this census does
 * not already give, because a new position reddens whatever its type is". The
 * first clause is true. The second is FALSE, and every bypass this directory
 * has been shown is the counter-example: the census reddens on a new POSITION,
 * and all nine used an EXISTING one. What narrowing buys is measured, not
 * argued — this probe, run at `dcc65bb` and replicated before the change:
 *
 *     export const direct: NpcId = EMPIRE_FORBIDDEN_OUTPUTS[0];         // 3
 *     export const laundered: NpcId = asNpcId(EMPIRE_FORBIDDEN_OUTPUTS[0]); // 5
 *
 *     src/empire/__probe.ts(3,14): error TS2322: Type 'string' is not
 *       assignable to type 'NpcId'.
 *       Type 'string' is not assignable to type
 *       '{ readonly [EMPIRE_BRAND]: "npc-id"; }'.
 *
 * `tsc --noEmit` exit 2, exactly one error, on line 3 and not on line 5. So a
 * brand refuses the assignment route at every branch point at once and does not
 * refuse the constructor route — which is why the constructor-call-site census
 * below exists and why `refuseForbiddenName` exists beside it.
 *
 * THE OBJECTION THE `GymSnapshot` ROW RAISED IS ANSWERED RATHER THAN IGNORED.
 * It said another gym's identity "arrives from outside this directory entirely.
 * There is no closed set of them to narrow to." That is true and it is not an
 * argument against a brand, because a brand is not an enumeration — it is a
 * constructor discipline. `asGymId` narrows nothing about which gyms exist; it
 * makes the assignment a compile error and makes the one remaining route a
 * named function whose call sites are counted. What `asGymId` accepts, and why
 * it accepts that much, is written at the function.
 */
const CLOSED_BARE_STRING_FIELDS = Object.freeze([
  Object.freeze({
    field: 'the eight `readonly string[]` fault lists',
    closedBy: 'FaultMessage',
    why:
      'Diagnostic prose. Every element is a sentence, and a sentence naming a ' +
      'forbidden output is the module REPORTING a fault rather than paying ' +
      'one. Instrument B checks these by equality and not by containment, and ' +
      'pins what they produced in DIAGNOSTIC_CHANNEL_CENSUS. The brand is ' +
      'minted at the return rather than at each of the 123 push sites, and ' +
      '`asFaultMessage` says why that is the same fence and what it costs.',
    positions: Object.freeze([
      'empireCore.ts#empireStateFaults#return[]',
      'empireCore.ts#empireVocabularyFaults#return[]',
      'empireInvariant.ts#empireRunFaults#return[]',
      'engagement.ts#engagementRunFaults#return[]',
      'expansion.ts#expansionVocabularyFaults#return[]',
      'reputation.ts#reputationVocabularyFaults#return[]',
      'social.ts#socialContextFaults#return[]',
      'social.ts#socialVocabularyFaults#return[]',
    ]),
  }),
  Object.freeze({
    field: 'NpcLifter.displayName',
    closedBy: 'DisplayName',
    why:
      "An NPC's shown name. Caller-chosen free text, checked only for " +
      'non-emptiness by `createNpcLifter` — which is now the check inside ' +
      '`asDisplayName`, so both display-name fields get it instead of one. ' +
      'Still covered by instrument B, which drives it with a sentinel so the ' +
      'position is measured as REACHED rather than assumed non-empty.',
    positions: Object.freeze([
      'empireCore.ts#createEmpireState#return.roster[].displayName',
      'empireCore.ts#createNpcLifter#return.displayName',
      'empireInvariant.ts#createEmpireGym#return.state.roster[].displayName',
      'empireInvariant.ts#runEmpire#return.gym.state.roster[].displayName',
      'empireInvariant.ts#stepGym#return.state.roster[].displayName',
      'recruitment.ts#beginRecruitment#return.state.roster[].displayName',
      'recruitment.ts#completeRecruitment#return.roster[].displayName',
    ]),
  }),
  Object.freeze({
    field: 'GymSnapshot.gymId and GymSnapshot.displayName',
    closedBy: 'GymId and DisplayName',
    why:
      "Another gym's identity, which arrives from outside this directory " +
      'entirely. There is no closed set of them to narrow to — and that was ' +
      'given as the reason no brand was possible, which confuses an ' +
      'enumeration with a constructor discipline. The constructor accepts any ' +
      'non-empty non-forbidden string on purpose; see `asGymId`.',
    positions: Object.freeze([
      'empireInvariant.ts#gymSnapshot#return.displayName',
      'empireInvariant.ts#gymSnapshot#return.gymId',
      'social.ts#rankLeaderboard#return[].entry.displayName',
      'social.ts#rankLeaderboard#return[].entry.gymId',
    ]),
  }),
  Object.freeze({
    field: 'PendingRecruit.id',
    closedBy: 'NpcId',
    why:
      'The id a recruitment will mint, and it is the SAME id the lifter ends ' +
      'up carrying, so it is now the same brand `NpcLifter.id` is. Its old ' +
      'row called that an inconsistency and declined to fix it on the ground ' +
      'that narrowing buys nothing the census does not already give. The ' +
      'probe above is what falsified that: the census reddens on a new ' +
      'position and every bypass used an existing one.',
    positions: Object.freeze([
      'empireInvariant.ts#createEmpireGym#return.pending[].id',
      'empireInvariant.ts#runEmpire#return.gym.pending[].id',
      'empireInvariant.ts#stepGym#return.pending[].id',
    ]),
  }),
  Object.freeze({
    field: 'FriendVisit.gymId',
    closedBy: 'GymId',
    why:
      "The visited gym's id, which the caller passes in and " +
      '`recordFriendVisit` logs verbatim. Same class as GymSnapshot.gymId, ' +
      'and closed harder than it: the PARAMETER is branded too, so the ' +
      'function mints nothing and a forbidden name cannot be introduced ' +
      'inside it without a constructor call the site census would report.',
    positions: Object.freeze(['social.ts#recordFriendVisit#return.visits[].gymId']),
  }),
]);

/**
 * Every branded-string position in the directory.
 *
 * Listed separately from the bare ones because a brand is erased at runtime, so
 * `asNpcId('covered-day')` returns the forbidden name. A scan for the `string`
 * keyword misses this whole class; the checker does not.
 *
 * It was eight — `NpcId` alone. It is thirty-four, because the twenty-three
 * positions that used to be bare are here now, plus the three new constructors'
 * own returns. THAT IS A MOVE OF A POSITION FROM ONE LIST TO THE OTHER AND NOT
 * A LOSS OF COVERAGE: both lists are set equalities in both directions, so a
 * position that vanished from the surface entirely would redden the branded
 * equality just as a new one would.
 *
 * WHAT BRANDING THESE BUYS, AND WHAT IT DOES NOT. It buys the assignment route:
 * `gymId: EMPIRE_FORBIDDEN_OUTPUTS[0]` is a compile error at every branch point
 * at once, with no domain and no drive. It does NOT buy the constructor route —
 * `asGymId(EMPIRE_FORBIDDEN_OUTPUTS[0])` compiles, and that is measured in the
 * probe quoted at `CLOSED_BARE_STRING_FIELDS`. The constructor route's catchers
 * are `DECLARED_BRAND_CONSTRUCTOR_CALLS` below and `refuseForbiddenName` in
 * `empireCore.ts`, and they cover different halves of it: one detects a new
 * site whether or not it runs, the other refuses a value only when it does.
 */
const DECLARED_BRANDED_STRING_POSITIONS: readonly string[] = Object.freeze([
  'empireCore.ts#asDisplayName#return',
  'empireCore.ts#asFaultMessage#return',
  'empireCore.ts#asGymId#return',
  'empireCore.ts#asNpcId#return',
  'empireCore.ts#createEmpireState#return.roster[].displayName',
  'empireCore.ts#createEmpireState#return.roster[].id',
  'empireCore.ts#createNpcLifter#return.displayName',
  'empireCore.ts#createNpcLifter#return.id',
  'empireCore.ts#empireStateFaults#return[]',
  'empireCore.ts#empireVocabularyFaults#return[]',
  'empireInvariant.ts#createEmpireGym#return.pending[].id',
  'empireInvariant.ts#createEmpireGym#return.state.roster[].displayName',
  'empireInvariant.ts#createEmpireGym#return.state.roster[].id',
  'empireInvariant.ts#empireRunFaults#return[]',
  'empireInvariant.ts#gymSnapshot#return.displayName',
  'empireInvariant.ts#gymSnapshot#return.gymId',
  'empireInvariant.ts#runEmpire#return.gym.pending[].id',
  'empireInvariant.ts#runEmpire#return.gym.state.roster[].displayName',
  'empireInvariant.ts#runEmpire#return.gym.state.roster[].id',
  'empireInvariant.ts#stepGym#return.pending[].id',
  'empireInvariant.ts#stepGym#return.state.roster[].displayName',
  'empireInvariant.ts#stepGym#return.state.roster[].id',
  'engagement.ts#engagementRunFaults#return[]',
  'expansion.ts#expansionVocabularyFaults#return[]',
  'recruitment.ts#beginRecruitment#return.state.roster[].displayName',
  'recruitment.ts#beginRecruitment#return.state.roster[].id',
  'recruitment.ts#completeRecruitment#return.roster[].displayName',
  'recruitment.ts#completeRecruitment#return.roster[].id',
  'reputation.ts#reputationVocabularyFaults#return[]',
  'social.ts#rankLeaderboard#return[].entry.displayName',
  'social.ts#rankLeaderboard#return[].entry.gymId',
  'social.ts#recordFriendVisit#return.visits[].gymId',
  'social.ts#socialContextFaults#return[]',
  'social.ts#socialVocabularyFaults#return[]',
]);

/**
 * Every method this directory calls on a value its caller handed it, by name.
 *
 * the enumeration behind the `member-of-parameter` arm. Every one of these is a
 * read — `includes`, `slice`, `map` — and none of them hands the callee
 * anything this directory chose. The list is what makes that checkable instead
 * of asserted: `sink.report(<a banned name>)` lands here too, under a name that
 * is not on this list, so it is red by file, by enclosing function, by member
 * and by argument count.
 *
 * Its limit, in the mechanism's own terms: this is a census of SITES, so an
 * existing site starting to pass a banned name at an argument position it
 * already had moves nothing here. The argument count in each key covers the
 * widening case only, exactly as `DECLARED_CALLBACK_SITES`'s `x1` does; what
 * covers the other half for the exported-callback channel is the callback pass,
 * and this arm has no equivalent because nothing here is a caller-supplied
 * FUNCTION as far as any type in the directory says.
 */
const DECLARED_MEMBER_CALLS_ON_PARAMETERS: readonly string[] = Object.freeze([
  'empireCore.ts#idleLedger#ledger.filter x1',
  'empireCore.ts#progressionLedger#ledger.filter x1',
  'empireInvariant.ts#composeTrainingIqRate#state.filter x1',
  'empireInvariant.ts#idleDayLedger#entries.filter x1',
  'empireInvariant.ts#outputSeries#entries.filter x1',
  'empireInvariant.ts#progressionDayLedger#entries.filter x1',
  'empireInvariant.ts#savingForPhysio#order.includes x1',
  'empireInvariant.ts#stepGym#gym.find x1',
  'empireInvariant.ts#stepGym#gym.map x1',
  'engagement.ts#moreEngagedByTrainedDay#history.includes x1',
  'social.ts#rankLeaderboard#entries.map x1',
  'social.ts#visitRefusals#context.some x1',
  'social.ts#visitRefusals#context.some x1',
]);

/** What the census measured on the shipped tree. Counts, not bounds. */
const SURFACE_CENSUS = Object.freeze({
  MODULES: 10,
  EXPORTS: 230,
  BARE_POSITIONS: 0,
  BARE_FIELDS: 0,
  BRANDED_POSITIONS: 34,
  /** The banned vocabulary's own length, so an emptied ban list is not a clean sweep. */
  BANNED: 7,
  LITERAL_POSITIONS: 1175,
  DISTINCT_LITERAL_MEMBERS: 93,
  DEPTH_CUTS: 0,
});

describe('the domains are derived from the subject and are not empty', () => {
  it('files or exempts every numeric leaf of EMPIRE_TUNING, in both directions', () => {
    // THE JOIN THE SEVENTH BYPASS EXISTED IN THE ABSENCE OF. The old registry
    // was checked against itself — forty labels asserted to be forty distinct
    // labels — and against no population, so sixty-two knobs were in no unit,
    // in no domain, and in nothing that could notice. This walks
    // `EMPIRE_TUNING` and requires every numeric leaf to be either filed under
    // a unit or carrying a reason on `NOT_A_BRANCH_POINT`.
    const leaves = TUNING_LEAVES.numbers.map((leaf) => leaf.path);
    expect(leaves.length).toBe(DOMAIN_CENSUS.TUNING_NUMERIC_LEAVES);
    expect(distinct(leaves).length).toBe(DOMAIN_CENSUS.TUNING_NUMERIC_LEAVES);
    // A string leaf is counted rather than dropped, so a vocabulary token
    // becoming a number moves a number here.
    expect(TUNING_LEAVES.strings.length).toBe(DOMAIN_CENSUS.TUNING_STRING_LEAVES);

    const labels = AXIS_UNITS.flatMap((unit) => Object.keys(UNIT_THRESHOLDS[unit]));
    expect(labels.length).toBe(DOMAIN_CENSUS.THRESHOLDS);
    // Filed exactly once, so a threshold cannot be counted twice into the
    // census while being missing from the unit that needed it.
    expect(distinct(labels).length).toBe(DOMAIN_CENSUS.THRESHOLDS);

    // Every label is a real leaf path, or one of exactly two derived entries.
    const derived = DERIVED_THRESHOLDS.map(([label]) => label);
    const filed = labels.filter((label) => !derived.includes(label));
    expect(labels.filter((label) => derived.includes(label)).sort()).toEqual([...derived].sort());
    for (const label of filed) {
      expect(leaves, `${label} is filed but is not a leaf of EMPIRE_TUNING`).toContain(label);
    }
    for (const [label, why] of DERIVED_THRESHOLDS) {
      expect(leaves, `${label} is listed as derived but IS a leaf`).not.toContain(label);
      expect(why.length, label).toBeGreaterThan(80);
    }

    const exempt = NOT_A_BRANCH_POINT.map((row) => row.path);
    expect(exempt.length).toBe(DOMAIN_CENSUS.EXEMPT);
    expect(distinct(exempt).length).toBe(DOMAIN_CENSUS.EXEMPT);
    expect(distinct(filed).length).toBe(DOMAIN_CENSUS.FILED);
    // Disjoint. A leaf that is both filed and exempt would make the set
    // equality below pass while the two lists disagreed about it.
    for (const path of exempt) {
      expect(filed, `${path} is both filed and exempt`).not.toContain(path);
    }
    // The equality itself, both directions.
    expect([...distinct(filed), ...exempt].sort()).toEqual([...leaves].sort());

    // Every exemption carries a reason, and the reason is not the claim
    // restated: the ban below is on a row whose whole content is that it is not
    // a branch point.
    for (const row of NOT_A_BRANCH_POINT) {
      expect(row.why.length, row.path).toBeGreaterThan(120);
      expect(row.why.toLowerCase(), row.path).not.toContain('not a branch point');
    }

    expect(Object.keys(EVERY_BRANCH_POINT).length).toBe(DOMAIN_CENSUS.BRANCH_POINTS);
    // And no unit is empty, which is what stops a domain declaring a unit and
    // thereby declaring no obligation at all.
    for (const unit of AXIS_UNITS) {
      expect(Object.keys(UNIT_THRESHOLDS[unit]).length, unit).toBeGreaterThan(0);
    }
    expect(AXIS_UNITS.length).toBe(DOMAIN_CENSUS.UNITS);
    expect(Object.keys(UNIT_THRESHOLDS).sort()).toEqual([...AXIS_UNITS].sort());
  });

  it('re-runs the unconsumed scan, so an exemption that says NO CONSUMER expires by itself', () => {
    // The one exemption class whose reason is a claim about the shipped code
    // rather than about the number. `empireTuning.test.ts` owns the pin; this
    // re-derives it here, because a row in THIS file that says "nothing reads
    // it" has to fail in THIS file when something starts reading it.
    const shipped = readdirSync(HERE)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .filter((name) => name !== 'empireTuning.ts')
      .map((name) => readFileSync(path.join(HERE, name), 'utf8'))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    // The empty-domain guard: if the read found no source, every key would look
    // unconsumed and the loop below would be a sweep over nothing.
    expect(shipped.length).toBeGreaterThan(0);
    expect(shipped).toContain(`EMPIRE_TUNING.${'RIVAL_COMPARISON_PERIOD_DAYS'}`);

    const unconsumed = NOT_A_BRANCH_POINT.filter((row) => row.why.startsWith('NO CONSUMER'));
    expect(unconsumed.length).toBeGreaterThan(0);
    for (const row of unconsumed) {
      expect(shipped, `${row.path} is exempted as unread and is read`).not.toContain(
        `EMPIRE_TUNING.${row.path}`,
      );
    }
  });

  it('pins how many domains exist and how many points each came out at', () => {
    // The census that says a truncated or reshaped domain reports itself. A
    // threshold dropped from `UNIT_THRESHOLDS` shrinks a point count here
    // before it shrinks anything downstream, where it would look like a clean
    // sweep.
    expect(Object.keys(NUMERIC_DOMAINS).length).toBe(DOMAIN_CENSUS.DOMAINS);
    expect(NUMBER_DOMAIN.length).toBe(DOMAIN_CENSUS.NUMBER_POINTS);
    expect(SECONDS_DOMAIN.length).toBe(DOMAIN_CENSUS.SECONDS_POINTS);
    expect(DAY_DOMAIN.length).toBe(DOMAIN_CENSUS.DAY_POINTS);
    expect(COUNT_DOMAIN.length).toBe(DOMAIN_CENSUS.COUNT_POINTS);
    expect(LEVEL_DOMAIN.length).toBe(DOMAIN_CENSUS.LEVEL_POINTS);
    expect(ROSTER_SHAPES.length).toBe(DOMAIN_CENSUS.ROSTER_SHAPE_POINTS);
  });

  it('straddles every branch point it is obliged to, IN EVERY DOMAIN AND NOT ONLY THE FIRST', () => {
    // This is the assertion the sixth bypass got past, and the way it got past
    // was not that it was wrong — it was that it looped `NUMBER_DOMAIN` and
    // left the domain declared one line below it pinned by LENGTH alone. So it
    // loops `NUMERIC_DOMAINS`, which is discovered at runtime: a seventh domain
    // added to the registry is checked without this assertion being edited, and
    // `DOMAINS` below reddens if one is added and `CONTAINMENT_CHECKS` reddens
    // if a domain is added that obliges itself to nothing.
    //
    // WHAT THE SEVENTH BYPASS CHANGED HERE. The obligation used to be the
    // thresholds of the domain's own units and nothing else, so a domain's
    // coverage was only ever as good as somebody's judgement about which unit a
    // number was measured in. The obligation now includes every branch point at
    // or below `foreignCeiling` regardless of unit, and `omitted` counts the
    // rest per domain instead of leaving them unnamed.
    let domainsChecked = 0;
    let checks = 0;
    const omitted: Record<string, number> = {};
    for (const [name, domain] of Object.entries(NUMERIC_DOMAINS)) {
      const required: Record<string, number> = { ...domain.alsoContains };
      for (const unit of domain.units) Object.assign(required, UNIT_THRESHOLDS[unit]);
      let skipped = 0;
      for (const [label, value] of Object.entries(EVERY_BRANCH_POINT)) {
        if (label in required) continue;
        if (value <= domain.foreignCeiling) required[label] = value;
        else skipped += 1;
      }
      omitted[name] = skipped;
      // A domain that obliges itself to nothing would pass every check below
      // vacuously, which is the shape of the defect one level out.
      expect(Object.keys(required).length, name).toBeGreaterThan(0);
      expect(domain.why.length, name).toBeGreaterThan(200);

      for (const [label, threshold] of Object.entries(required)) {
        const at = `${name}/${label}=${String(threshold)}`;
        if (Number.isInteger(threshold)) {
          expect(domain.points, at).toContain(threshold);
        } else {
          // The obligation for a fractional branch point, stated rather than
          // dropped: every axis in this file is integral, so the domain carries
          // the whole numbers on both sides instead of a value no integral axis
          // can take. See `integralPoints`.
          expect(domain.points, `${at} floor`).toContain(Math.floor(threshold));
          expect(domain.points, `${at} ceil`).toContain(Math.ceil(threshold));
        }
        expect(domain.points.some((point) => point > threshold), at).toBe(true);
        // Zero has nothing below it. Every other threshold is straddled on
        // both sides; a one-sided sample cannot see a `< threshold` branch.
        if (threshold > 0) {
          expect(domain.points.some((point) => point < threshold), at).toBe(true);
        }
        checks += 1;
      }

      // The shape points, which change an input's SHAPE rather than its size.
      expect(domain.points[0], name).toBe(0);
      expect(domain.points, name).toContain(1);
      domainsChecked += 1;
    }
    expect(domainsChecked).toBe(DOMAIN_CENSUS.DOMAINS);
    expect(checks).toBe(DOMAIN_CENSUS.CONTAINMENT_CHECKS);
    // The declared limit as a number rather than a sentence: exactly which
    // domains give up how many branch points to their ceiling.
    expect(omitted).toEqual({ ...DOMAIN_CENSUS.OMITTED_ABOVE_CEILING });
  });

  it('carries every exempt leaf in every domain but one, and NAMES the ones that domain drops', () => {
    // The named catcher for `NOT_A_BRANCH_POINT`'s declared limit. An exemption
    // decides only whether a leaf is carried ABOVE a ceiling; it does not by
    // itself remove the leaf from any domain, because `EVERY_BRANCH_POINT`
    // includes the exempt ones and a domain carries every member of that union
    // up to its ceiling.
    //
    // AND THE FIRST VERSION OF THIS CHECK ASSERTED THE STRONGER THING AND WAS
    // TRUE ONLY WHILE A COST MEASUREMENT SAID SO. Every ceiling was above 120,
    // the largest exempt value, so every exempt leaf really was in every
    // domain. Then ROSTER_SHAPE's ceiling was measured: at 120 its 35 points
    // cost 126 s against 4.8 s on the drive alone, because each point builds a
    // whole state and crosses it with the reputation ladder, the tiers and the
    // clocks. It is `ROSTER_SLOTS_MAX + 1` now — one past the largest roster
    // `rosterCapacity` will admit — and four exempt leaves fall outside it.
    //
    // They are named rather than counted, because a count would let one leaf be
    // swapped for another silently, and this is the list a reader has to be
    // able to disagree with.
    let pairs = 0;
    const dropped: string[] = [];
    for (const [name, domain] of Object.entries(NUMERIC_DOMAINS)) {
      for (const row of NOT_A_BRANCH_POINT) {
        for (const [path, value] of Object.entries(tuningTable(row.path))) {
          const at = `${name}/${path}=${String(value)}`;
          if (value > domain.foreignCeiling) {
            dropped.push(at);
            continue;
          }
          expect(domain.points, `${at} floor`).toContain(Math.floor(value));
          expect(domain.points, `${at} ceil`).toContain(Math.ceil(value));
          pairs += 1;
        }
      }
    }
    expect(dropped.sort()).toEqual([...EXEMPT_LEAVES_ABOVE_A_CEILING].sort());
    expect(pairs).toBe(DOMAIN_CENSUS.DOMAINS * DOMAIN_CENSUS.EXEMPT - dropped.length);
  });

  it('keeps every domain inside NUMBER, INCLUDING the points no unit derived', () => {
    // THIS LOOP USED TO BE VACUOUS ON EVERY ITERATION AND IS RECORDED AS SUCH.
    // It read `if (domain.units.length === 0) continue;` — which skipped
    // ROSTER_SHAPE, the only domain whose points are not `domainOf(subset of
    // AXIS_UNITS)`. For every domain it did visit, the points were a straddle
    // of a subset of what NUMBER straddles, so containment was arithmetic and
    // no state of the registry could have reddened it.
    //
    // What makes it bite now is the `extra` argument. `domainOf` takes points
    // that are derived from no threshold at all, ROSTER_SHAPE passes
    // `ROSTER_SLOTS_MAX + 1` through it, and nothing structural says a value
    // invented at a call site is a point NUMBER has. Planting
    // `EMPIRE_TUNING.ROSTER_SLOTS_MAX * 2` in that argument reddens this with
    // `ROSTER_SHAPE/32: expected [...] to include 32`.
    //
    // AND THE FIRST MUTANT WRITTEN FOR THIS COMMENT DID NOT REDDEN IT. It was
    // `* 3`, chosen for looking obviously outside a roster's range, and 48 is
    // in NUMBER by accident: `OFFLINE_EARNINGS_CAP_HOURS` is 12 and its
    // straddle carries `12 * 4`. What went red was the POINT COUNT one test
    // above — a different check noticing, which this codebase has now recorded
    // five times as not being this check working. `* 2` is 32, which nothing
    // in the tuning block reaches, and it fails on the containment itself.
    let pairs = 0;
    for (const [name, domain] of Object.entries(NUMERIC_DOMAINS)) {
      for (const point of domain.points) {
        expect(NUMBER_DOMAIN, `${name}/${String(point)}`).toContain(point);
        pairs += 1;
      }
    }
    expect(pairs).toBe(DOMAIN_CENSUS.NUMBER_CONTAINMENT_CHECKS);
  });

  it('defines every numeric domain inside the registry, and nowhere else', () => {
    // The catcher for the registry's declared limit. Runtime discovery cannot
    // see a domain that was never put in the registry, so this reads the file's
    // own source and asserts that every module-level `readonly number[]` is an
    // alias of a registry entry — no literal, no ad-hoc `numeric([...])`.
    //
    // ONE EXCEPTION EXISTS AND IT IS A LIST RATHER THAN A LOOSENING, which is
    // the difference between this and rewriting the declaration until the scan
    // walked past it. E19's tripwire needs a point list that is deliberately
    // NOT a subject's domain, and spelling it inline at the call site is
    // exactly the evasion the sibling scan below was written to catch.
    const source = sourceWithoutComments();
    const declarations = [...source.matchAll(/^const (\w+): readonly number\[\] = (.+)$/gm)];
    expect(declarations.length).toBe(DOMAIN_CENSUS.ALIASES);
    const aliased: string[] = [];
    const exempt: string[] = [];
    for (const declaration of declarations) {
      const name = declaration[1] ?? '';
      const initialiser = declaration[2] ?? '';
      if (NON_DOMAIN_NUMBER_LISTS.some(([exemptName]) => exemptName === name)) {
        exempt.push(name);
        continue;
      }
      const key = /^NUMERIC_DOMAINS\.(\w+)\.points;$/.exec(initialiser);
      expect(key, `${name} = ${initialiser}`).not.toBeNull();
      if (key !== null) aliased.push(key[1] ?? '');
    }
    // Set equality both ways: an unaliased registry entry is as much a defect
    // as an alias of something that is not in the registry.
    expect(aliased.sort()).toEqual(Object.keys(NUMERIC_DOMAINS).sort());
    // And the exception list is a partition rather than an allowance: a name on
    // it that no longer exists is red, and every row has to say why.
    expect(exempt.sort()).toEqual([...NON_DOMAIN_NUMBER_LISTS.map(([name]) => name)].sort());
    expect(NON_DOMAIN_NUMBER_LISTS.length).toBe(DOMAIN_CENSUS.NON_DOMAIN_LISTS);
    for (const [name, why] of NON_DOMAIN_NUMBER_LISTS) expect(why.length, name).toBeGreaterThan(60);
  });

  it('declares every literal for-of axis, so an axis outside the registry is not silently an axis', () => {
    // The branch immediately below the check above. A domain can also be
    // written as an array literal at the call site, where no `readonly
    // number[]` declaration exists to scan for — and two axes in this file
    // were, one of them a threshold axis sampled at its two extremes.
    const source = sourceWithoutComments();
    const found = distinct([...source.matchAll(/for \(const (\w+) of \[/g)].map((hit) => hit[1] ?? ''));
    expect(found).toEqual([...LITERAL_AXES.map(([name]) => name)].sort());
    expect(LITERAL_AXES.length).toBe(DOMAIN_CENSUS.LITERAL_AXES);
    for (const [name, why] of LITERAL_AXES) expect(why.length, name).toBeGreaterThan(60);
  });

  it('declares every labelled fixture list, and pins the size of each one it drives', () => {
    // The branch immediately below the two scans above. Those cover an axis
    // written as a `readonly number[]` and an axis written as a `for (const x
    // of [ … ])`. A `[label, value]` list is neither, and there are six of them
    // driving this file.
    const source = sourceWithoutComments();
    const declared = distinct(
      [...source.matchAll(/^const (\w+): readonly \(readonly \[string, /gm)].map(
        (hit) => hit[1] ?? '',
      ),
    );
    const registered = [...FIXTURE_LISTS.map((list) => list.name), ...CENSUS_LISTS];
    // A PARTITION, not a union: a fixture filed as a census would escape the
    // size pin below, so being in both is as much a defect as being in neither.
    expect([...registered].sort()).toEqual(declared);
    expect(distinct(registered).length).toBe(registered.length);
    expect(declared.length).toBe(DOMAIN_CENSUS.LABELLED_LISTS);

    const actual: Readonly<Record<string, readonly unknown[]>> = {
      STATES,
      CLOCKS,
      COLLECTION_CLOCKS,
      CLOCK_SHAPES,
      CONTEXTS,
      SOCIAL_SHAPES,
    };
    for (const list of FIXTURE_LISTS) {
      // The size pin. A truncated fixture is the shape of an empty domain that
      // still reports honest counts everywhere downstream.
      expect(actual[list.name]?.length, list.name).toBe(list.size);
      expect(list.why.length, list.name).toBeGreaterThan(150);
      if (list.derivedFrom !== null) {
        expect(Object.keys(NUMERIC_DOMAINS), list.name).toContain(list.derivedFrom);
      } else {
        // A hand-picked list has to say what it is a list OF and what it
        // therefore misses, in those words, because "hand-picked" with no
        // residual beside it is the concession-without-a-price shape.
        expect(list.why, list.name).toContain('HAND-PICKED');
        expect(list.why.toLowerCase(), list.name).toMatch(/residual|not reached|not affordable/);
      }
    }
    // Two derived and four hand-picked, pinned so a list quietly changing
    // class moves a number.
    expect(FIXTURE_LISTS.filter((list) => list.derivedFrom === null).length).toBe(
      DOMAIN_CENSUS.HAND_PICKED_LISTS,
    );
  });

  it('joins a measured price to every domain that carries a ceiling, in both directions', () => {
    // A cost concession with no measurement beside it is how a ten-point
    // hour-derived domain stayed on six axes that never needed to be cheap.
    //
    // AND THE OLD VERSION OF THIS CHECK NEVER JOINED A ROW TO A DOMAIN. Its
    // rows were axis names, its assertion was that exactly two of them cost
    // more than twice a baseline, and a domain could have carried any ceiling
    // at all without a row existing — which is the shape of a check that reads
    // as coverage. The set equality below is what it should have been.
    expect(DOMAIN_COST_SECONDS.length).toBe(DOMAIN_CENSUS.COST_ROWS);
    const priced = DOMAIN_COST_SECONDS.map((row) => row.domain);
    const bounded = Object.entries(NUMERIC_DOMAINS)
      .filter(([, domain]) => Number.isFinite(domain.foreignCeiling))
      .map(([name]) => name);
    // Both directions: a ceiling with no measurement is as much a defect as a
    // measurement for a domain that does not exist or does not have a ceiling.
    expect([...priced].sort()).toEqual([...bounded].sort());
    for (const row of DOMAIN_COST_SECONDS) {
      expect(Object.keys(NUMERIC_DOMAINS), row.domain).toContain(row.domain);
      // THE LINE THAT DELETED TWO CEILINGS. A concession has to show a real
      // saving, or the ceiling is buying nothing and is charging the coverage
      // for it. SECONDS measured 31.2 s raised against 38.8 s shipped and LEVEL
      // 29.9 s — both faster than shipping the ceiling — so both went to
      // NO_CEILING rather than getting a row that said 31.2 and read as a
      // price.
      expect(row.raisedSeconds, row.domain).toBeGreaterThan(row.shippedSeconds * 1.5);
      // A row raised above the domain's own ceiling, or the raise measured
      // nothing.
      const ceiling = Object.entries(NUMERIC_DOMAINS).find(([name]) => name === row.domain)?.[1]
        .foreignCeiling;
      expect(ceiling, row.domain).toBeDefined();
      expect(row.raisedTo, row.domain).toBeGreaterThan(ceiling ?? 0);
      // An incomplete run's number is a bound. Saying so is the whole reason
      // the field exists, so it is asserted rather than left in a comment.
      if (!row.completed) expect(row.raisedTo, row.domain).toBe(Number.POSITIVE_INFINITY);
      expect(row.axes.length, row.domain).toBeGreaterThan(60);
    }
    // At least one row is a bound rather than a duration, which is what says
    // the honest-reporting branch above is live rather than decorative.
    expect(DOMAIN_COST_SECONDS.filter((row) => !row.completed).length).toBe(
      DOMAIN_CENSUS.COST_ROWS_THAT_DID_NOT_FINISH,
    );
  });
});

describe('instrument A — no export type admits a forbidden literal, and no new string position arrives unseen', () => {
  it('walks the whole directory without truncating, and the compiler is happy with it', () => {
    // The non-vacuity guard for the derived ban list: every zero in this file
    // is zero against these seven names, and an emptied ban list would make
    // all of them vacuously true.
    expect(BANNED_VOCABULARY.length).toBe(SURFACE_CENSUS.BANNED);
    expect(distinct([...BANNED_VOCABULARY]).length).toBe(SURFACE_CENSUS.BANNED);
    const surface = stringSurface();
    // A depth cut means the census below is a prefix of the surface rather than
    // the surface. Pinned at zero so a deeper type reports itself.
    expect(surface.depthCuts).toBe(SURFACE_CENSUS.DEPTH_CUTS);
    // Named in the message rather than left as `[ Array(1) ]`. CLAUDE.md's
    // "a check that bites but fails uselessly is half a check": this is the
    // line that reddens in VITEST when a brand refuses an assignment, so the
    // compiler's sentence has to reach the reader of the vitest output.
    expect(surface.sourceDiagnostics, surface.sourceDiagnostics.join(' | ')).toEqual([]);
    expect(surface.modules.length).toBe(SURFACE_CENSUS.MODULES);
    expect(surface.exports.length).toBe(SURFACE_CENSUS.EXPORTS);
  });

  it('pins every bare-string position, in both directions, grouped by the field it is', () => {
    const surface = stringSurface();
    const declared = distinct(DECLARED_BARE_STRING_FIELDS.flatMap((group) => group.positions));
    // Set equality both ways. A new bare-string return type is an unexpected
    // member; a removed one is a stale row. Either reddens.
    expect(bareKeys(surface)).toEqual(declared);
    expect(declared.length).toBe(SURFACE_CENSUS.BARE_POSITIONS);
    expect(DECLARED_BARE_STRING_FIELDS.length).toBe(SURFACE_CENSUS.BARE_FIELDS);
    // Every group carries a reason, so a position cannot be added to this list
    // by pasting a line.
    for (const group of DECLARED_BARE_STRING_FIELDS) {
      expect(group.positions.length, group.field).toBeGreaterThan(0);
      expect(group.why.length, group.field).toBeGreaterThan(80);
    }
  });

  it('pins every branded-string position, in both directions', () => {
    const surface = stringSurface();
    expect(brandedKeys(surface)).toEqual([...DECLARED_BRANDED_STRING_POSITIONS].sort());
    expect(DECLARED_BRANDED_STRING_POSITIONS.length).toBe(SURFACE_CENSUS.BRANDED_POSITIONS);
  });

  it('names no forbidden output in any closed literal union, outside the two lists that ARE the ban', () => {
    const surface = stringSurface();
    const literals = surface.positions.filter((position) => position.kind === 'literal');
    expect(literals.length).toBe(SURFACE_CENSUS.LITERAL_POSITIONS);
    expect(distinct(literals.flatMap((position) => position.members)).length).toBe(
      SURFACE_CENSUS.DISTINCT_LITERAL_MEMBERS,
    );

    // The exemption is scoped to the two exports that ARE the ban lists and to
    // nothing else. Anything that READS one of them is checked in full, which
    // matters because reading the list is where the reproduced defect gets its
    // string.
    const offenders = literals
      .filter((position) => !BAN_LIST_EXPORTS.includes(position.export))
      .filter((position) => position.members.some((member) => BANNED_NORMALISED.has(normalise(member))))
      .map((position) => `${positionKey(position)}=${position.members.join('|')}`);
    expect(distinct(offenders)).toEqual([]);

    // And the exempted pair is pinned by content, not skipped. An exemption
    // that can grow a member quietly is a hiding place (attack shape 19).
    const exempted = literals.filter((position) => BAN_LIST_EXPORTS.includes(position.export));
    expect(distinct(exempted.map((position) => `${position.export}=${position.members.join('|')}`))).toEqual([
      'EMPIRE_FORBIDDEN_OUTPUTS=chalk',
      'EMPIRE_FORBIDDEN_OUTPUTS=competition-total',
      'EMPIRE_FORBIDDEN_OUTPUTS=covered-day',
      'EMPIRE_FORBIDDEN_OUTPUTS=e1rm',
      'FORBIDDEN_UNLOCK_KEYS=chance-draw',
      'FORBIDDEN_UNLOCK_KEYS=currency-purchase',
      'FORBIDDEN_UNLOCK_KEYS=paid-pull',
    ]);
    // Every banned name is accounted for by that pair, so the ban list this
    // file sweeps under and the ones the directory declares are the same list.
    expect(distinct(exempted.flatMap((position) => position.members))).toEqual(
      distinct([...BANNED_VOCABULARY]),
    );
  });
});

/**
 * The probe module, served from memory and never written to disk.
 *
 * It is instrument A's non-vacuity guard. Every check above is a set equality
 * that passes on a clean tree, and a set equality passes just as happily when
 * the walker is broken — the walker WAS broken once, in exactly that way, and
 * reported eighteen positions where there are twenty-three. So the census is
 * re-run over an eleventh module carrying four routes and the classification of
 * each is asserted. Nothing shipped is edited to do it.
 *
 * `probeProtectionDays` is here for the opposite reason: it is attack shape 16
 * and it must produce NO position. That zero is the declared limit, measured
 * rather than argued.
 */
const PROBE_SOURCE = `import { EMPIRE_FORBIDDEN_OUTPUTS, asNpcId, type NpcId } from './empireCore';

export function probeMilestoneGrant(checkIns: number): { readonly kind: string; readonly days: number } {
  return Object.freeze({ kind: EMPIRE_FORBIDDEN_OUTPUTS[0] as string, days: checkIns });
}

export const PROBE_GRANT_DATA = Object.freeze({ kind: EMPIRE_FORBIDDEN_OUTPUTS[0] });

export function probeMilestoneId(checkIns: number): NpcId {
  return asNpcId(\`\${EMPIRE_FORBIDDEN_OUTPUTS[0]}-\${String(checkIns)}\`);
}

export function probeProtectionDays(checkIns: number): number {
  return Math.floor(checkIns / EMPIRE_FORBIDDEN_OUTPUTS.length);
}
`;

const PROBE_MODULE = path.basename(PROBE_PATH);

let probeSurfaceMemo: StringSurface | null = null;

function probeSurface(): StringSurface {
  if (probeSurfaceMemo !== null) return probeSurfaceMemo;
  probeSurfaceMemo = surfaceOf([...shippedModulePaths(), PROBE_PATH], PROBE_SOURCE);
  return probeSurfaceMemo;
}

describe('instrument A bites — the census is re-run over a probe carrying four routes', () => {
  it('compiles the probe cleanly, so a refusal below is a classification and not an error', () => {
    const surface = probeSurface();
    expect(surface.sourceDiagnostics, surface.sourceDiagnostics.join(' | ')).toEqual([]);
    expect(surface.depthCuts).toBe(SURFACE_CENSUS.DEPTH_CUTS);
    expect(surface.modules.length).toBe(SURFACE_CENSUS.MODULES + 1);
  });

  it('sees the reproduced defect: `{ kind: string }` is a new bare position', () => {
    const probeBare = bareKeys(probeSurface()).filter((key) => key.startsWith(PROBE_MODULE));
    expect(probeBare).toEqual([`${PROBE_MODULE}#probeMilestoneGrant#return.kind`]);
    // And it is a position the shipped census does not have, which is the whole
    // mechanism: the set equality above goes red on arrival.
    expect(bareKeys(stringSurface())).not.toContain(`${PROBE_MODULE}#probeMilestoneGrant#return.kind`);
  });

  it('sees a banned name that survives as a literal type in exported DATA', () => {
    const offenders = probeSurface()
      .positions.filter((position) => position.kind === 'literal')
      .filter((position) => !BAN_LIST_EXPORTS.includes(position.export))
      .filter((position) => position.members.some((member) => BANNED_NORMALISED.has(normalise(member))))
      .map((position) => `${positionKey(position)}=${position.members.join('|')}`);
    expect(distinct(offenders)).toEqual([`${PROBE_MODULE}#PROBE_GRANT_DATA#value.kind=covered-day`]);
  });

  it('sees the branded-string channel, which a scan for the `string` keyword misses', () => {
    const probeBranded = brandedKeys(probeSurface()).filter((key) => key.startsWith(PROBE_MODULE));
    expect(probeBranded).toEqual([`${PROBE_MODULE}#probeMilestoneId#return`]);
  });

  it('is BLIND to attack shape 16, and the blindness is the measurement', () => {
    // `probeProtectionDays(checkIns): number` is a check-in-keyed day count with
    // no forbidden name anywhere in it. It contributes zero positions of any
    // kind. This assertion is not a pass — it is the declared limit taken as a
    // number, and it reddens if somebody later claims this instrument covers
    // the shape.
    const fromShape16 = probeSurface().positions.filter(
      (position) => position.export === 'probeProtectionDays',
    );
    expect(fromShape16).toEqual([]);
    // What DOES move is the export list, and only that.
    expect(probeSurface().exports).toContain(`${PROBE_MODULE}#probeProtectionDays`);
  });
});

// ===========================================================================
// INSTRUMENT C — the brand-constructor call sites, and the runtime refusal
// ===========================================================================

/**
 * WHY A THIRD INSTRUMENT EXISTS, AND WHAT IT IS FOR.
 *
 * Instrument A reads DECLARED TYPES and instrument B DRIVES INPUTS. Branding
 * the directory's string fields closed the assignment route — a forbidden name
 * read out of the ban list can no longer be assigned into any of them, at every
 * branch point at once, because a `string` is not a `GymId`. That is measured
 * at `CLOSED_BARE_STRING_FIELDS` and it is exactly half the story.
 *
 * The other half is the constructor route: `asGymId(EMPIRE_FORBIDDEN_OUTPUTS[0])`
 * compiles and always will, because a brand is a constructor discipline rather
 * than an enumeration. Instrument B can only catch that where its domain
 * reaches the branch, and eight rounds have each closed one branch point and
 * declared the next — a ninth was declared open above
 * `OVERFLOW_ALLOCATION_CEILINGS.ROSTER_SHAPE`. A sampling instrument does not
 * close a route the author picks a number for.
 *
 * AND THIS INSTRUMENT DOES NOT CLOSE EVERY ROUTE THE BRANDS LEFT, WHICH M25
 * MEASURED. It counts brand-constructor CALL SITES, so it sees a route that
 * mints. `throw new RangeError(EMPIRE_FORBIDDEN_OUTPUTS[0])` mints nothing,
 * declares nothing, and is invisible to A and C alike; only the drive can see
 * it, and only where the drive reaches. That is why the overflow pass's
 * argument-region split is part of the same answer rather than a tidy-up.
 *
 * WHAT MAKES THE PROBLEM ENUMERABLE IS THE CHANGE OF SUBJECT. An unbounded
 * numeric input is not a finite set. A list of call sites is. So this instrument
 * asks a question neither of the other two can: WHERE, in the shipped
 * directory's source, does a raw string acquire one of these brands?
 *
 * TWO HALVES, AND THEY COVER DIFFERENT THINGS. Do not read either as the other.
 *
 *   - `the brand constructor call sites are exactly the declared ones` is
 *     DETECTION. It resolves every call through the checker and set-equals the
 *     sites against `DECLARED_BRAND_CONSTRUCTOR_CALLS` in both directions, with
 *     a per-site count, so a NEW mint is red whether or not anything ever drives
 *     it. Its limit: it detects a SITE and says nothing about what the site
 *     does. `asGymId(context.friends[0].displayName)` would be an existing site
 *     doing something new, and nothing here would move.
 *   - `refuses every banned name at every string brand constructor` is
 *     CONTAINMENT. `refuseForbiddenName` in `empireCore.ts` throws on a value
 *     equal to a member of `EMPIRE_FORBIDDEN_OUTPUTS`, so such a value cannot be
 *     handed to a caller. Its limit: it fires only when the path RUNS. A
 *     constructor call behind a branch nothing reaches throws nothing, which is
 *     the sampling limit this instrument exists not to depend on.
 *
 * The constructor set is DERIVED, not listed: it is every exported function of
 * `empireCore.ts` whose return type is a branded string. So a fifth string brand
 * cannot arrive without both halves picking it up — the site census starts
 * counting its calls, and the refusal test starts requiring it to throw.
 *
 * WHAT IT DOES NOT COVER, said as a scope rather than a hedge. It reads the
 * SHIPPED modules only. A test file may mint whatever it likes, and this file
 * does; that is a fixture, not a shipped route. And it cannot see a cast:
 * `'covered-day' as GymId` needs no constructor and is invisible here. The
 * catcher for a cast is instrument B, which reads the VALUE that comes back and
 * has no opinion about how it was typed.
 */

interface ConstructorCallSite {
  /** `module.ts#enclosingDeclaration#constructorName`, or `#module` at top level. */
  readonly site: string;
  readonly calls: number;
}

interface ConstructorCensus {
  /** Exported functions of `empireCore.ts` returning a branded string. */
  readonly constructors: readonly string[];
  readonly sites: readonly ConstructorCallSite[];
  /** Call expressions examined, so an empty walk reports itself. */
  readonly callsExamined: number;
  readonly modules: number;
  /**
   * `module.ts#name` for every exported function of the shipped directory whose
   * return type is a read-only array of branded strings — the fault-list
   * producers, derived from the checker rather than from their names.
   *
   * Here because `asFaultMessage`'s note leans on a claim this file could not
   * previously redden: that the fault channel is CONTAINED, because every
   * message goes through the constructor on the way out. The `x1` rows in
   * `DECLARED_BRAND_CONSTRUCTOR_CALLS` say that of the eight producers that
   * exist; nothing said those were all of them. A ninth arriving with a cast
   * instead of a mint added no site, so the set equality below it would have
   * stayed green.
   */
  readonly faultListExports: readonly string[];
}

/**
 * Find every call to a string brand constructor, resolving the CALLEE through
 * the checker rather than matching its name.
 *
 * The resolution is the load-bearing part and it is not a style choice.
 * CLAUDE.md records `progression.test.ts`'s seal check matching a callee by
 * identifier TEXT while the check twelve lines below resolved symbols through
 * the checker — a local shim spelled `sealServerValue` type-checked clean past
 * 202 green guard tests. A local `const asGymId = (v: string) => v as GymId` in
 * one of these modules would be invisible to a text match and is not a call to
 * the exported symbol here.
 */
function constructorCensusOf(
  roots: readonly string[],
  probeText: string | null,
  probePath: string = PROBE_PATH,
): ConstructorCensus {
  const options = compilerOptions();
  const program = programWith(options, roots, probeText, probePath);
  const checker = program.getTypeChecker();

  const corePath = path.join(HERE, 'empireCore.ts');
  const coreSource = program.getSourceFile(corePath);
  if (coreSource === undefined) throw new Error(`${corePath} is not in the program`);

  let brandSymbol: ts.Symbol | undefined;
  coreSource.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'EMPIRE_BRAND') {
        brandSymbol = checker.getSymbolAtLocation(declaration.name);
      }
    }
  });
  if (brandSymbol === undefined) throw new Error('no EMPIRE_BRAND declaration in empireCore.ts');

  const resolved = (symbol: ts.Symbol | undefined): ts.Symbol | undefined =>
    symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
      ? checker.getAliasedSymbol(symbol)
      : symbol;

  const carriesBrand = (type: ts.Type): boolean =>
    type.getProperties().some((property) => {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      const name = declaration === undefined ? undefined : (declaration as ts.NamedDeclaration).name;
      if (name === undefined || !ts.isComputedPropertyName(name)) return false;
      return resolved(checker.getSymbolAtLocation(name.expression)) === brandSymbol;
    });

  /** A branded STRING, and not a branded number and not an array of either. */
  const isBrandedString = (type: ts.Type): boolean =>
    type.isIntersection() &&
    type.types.some((part) => (part.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral)) !== 0) &&
    carriesBrand(type);

  const moduleSymbol = checker.getSymbolAtLocation(coreSource);
  if (moduleSymbol === undefined) throw new Error('empireCore.ts resolved to no module symbol');

  const constructorSymbols = new Set<ts.Symbol>();
  const constructors: string[] = [];
  for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
    const declaration = symbol.declarations?.[0];
    if (declaration === undefined || !ts.isFunctionDeclaration(declaration)) continue;
    const signature = checker.getSignatureFromDeclaration(declaration);
    if (signature === undefined) continue;
    if (!isBrandedString(checker.getReturnTypeOfSignature(signature))) continue;
    constructorSymbols.add(symbol);
    constructors.push(symbol.getName());
  }
  constructors.sort();

  /**
   * The named thing a call sits inside, for a site a reader can find.
   *
   * The enclosing FUNCTION wins over a nearer variable, which is a correction
   * rather than a preference: a mint inside `const visit = { gymId: asGymId(x) }`
   * within `recordFriendVisit` first reported itself as `social.ts#visit`, and
   * a site named after a local is a site a reader has to go looking for. A
   * top-level constant has no enclosing function and keeps its own name.
   */
  const enclosing = (node: ts.Node): string => {
    let variable: string | null = null;
    for (let at: ts.Node | undefined = node.parent; at !== undefined; at = at.parent) {
      if (ts.isFunctionDeclaration(at) && at.name !== undefined) return at.name.text;
      if (ts.isMethodDeclaration(at) && ts.isIdentifier(at.name)) return at.name.text;
      if (variable === null && ts.isVariableDeclaration(at) && ts.isIdentifier(at.name)) {
        variable = at.name.text;
      }
    }
    return variable ?? '#module';
  };

  /** A read-only array (or array) whose element type is a branded string. */
  const isBrandedStringList = (type: ts.Type): boolean => {
    const args = checker.getTypeArguments(type as ts.TypeReference);
    return (
      args.length === 1 && args[0] !== undefined && isBrandedString(args[0] as ts.Type)
    );
  };

  const faultListExports: string[] = [];
  const counts = new Map<string, number>();
  let callsExamined = 0;
  let modules = 0;
  for (const root of roots) {
    const source = program.getSourceFile(root);
    if (source === undefined) throw new Error(`${root} is not in the program`);
    modules += 1;
    const rootModule = checker.getSymbolAtLocation(source);
    if (rootModule !== undefined) {
      for (const symbol of checker.getExportsOfModule(rootModule)) {
        const declaration = symbol.declarations?.[0];
        if (declaration === undefined || !ts.isFunctionDeclaration(declaration)) continue;
        const signature = checker.getSignatureFromDeclaration(declaration);
        if (signature === undefined) continue;
        if (!isBrandedStringList(checker.getReturnTypeOfSignature(signature))) continue;
        faultListExports.push(`${path.basename(root)}#${symbol.getName()}`);
      }
    }
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        callsExamined += 1;
        const callee = resolved(checker.getSymbolAtLocation(node.expression));
        if (callee !== undefined && constructorSymbols.has(callee)) {
          const key = `${path.basename(root)}#${enclosing(node)}#${callee.getName()}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
  }

  return {
    constructors: Object.freeze(constructors),
    sites: Object.freeze(
      [...counts.entries()]
        .map(([site, calls]) => Object.freeze({ site, calls }))
        .sort((left, right) => (left.site < right.site ? -1 : 1)),
    ),
    callsExamined,
    modules,
    faultListExports: Object.freeze(faultListExports.sort()),
  };
}

let constructorCensusMemo: ConstructorCensus | null = null;

function constructorCensus(): ConstructorCensus {
  if (constructorCensusMemo !== null) return constructorCensusMemo;
  constructorCensusMemo = constructorCensusOf(shippedModulePaths(), null);
  return constructorCensusMemo;
}

/**
 * Every place in the SHIPPED directory where a raw string becomes a brand.
 *
 * Thirteen sites across six modules, with the call count per site, so a second
 * mint added inside a function that already has one is red as well as a mint in
 * a function that has none. `x1` is not decoration: the eight fault-list rows
 * each mint exactly once, at the return, and a second call appearing inside one
 * of those bodies is exactly the shape `asFaultMessage`'s own note says is not
 * fenced at compile time.
 */
const DECLARED_BRAND_CONSTRUCTOR_CALLS: readonly string[] = Object.freeze([
  'empireCore.ts#createNpcLifter#asDisplayName x1',
  'empireCore.ts#createNpcLifter#asNpcId x1',
  'empireCore.ts#empireStateFaults#asFaultMessage x1',
  'empireCore.ts#empireVocabularyFaults#asFaultMessage x1',
  'empireInvariant.ts#OWN_GYM_ID#asGymId x1',
  'empireInvariant.ts#RECRUIT_DISPLAY_NAME#asDisplayName x1',
  'empireInvariant.ts#empireRunFaults#asFaultMessage x1',
  'empireInvariant.ts#stepGym#asNpcId x1',
  'engagement.ts#engagementRunFaults#asFaultMessage x1',
  'expansion.ts#expansionVocabularyFaults#asFaultMessage x1',
  'reputation.ts#reputationVocabularyFaults#asFaultMessage x1',
  'social.ts#socialContextFaults#asFaultMessage x1',
  'social.ts#socialVocabularyFaults#asFaultMessage x1',
]);

/** What instrument C measured on the shipped tree. Counts, not bounds. */
const CONSTRUCTOR_CENSUS = Object.freeze({
  CONSTRUCTORS: 4,
  SITES: 13,
  MINTS: 13,
  MODULES: 10,
  /**
   * Call expressions the walk examined across the directory.
   *
   * Pinned because a walker that stopped descending would find no sites and
   * report a clean census, which is the reassuring direction. A four-figure
   * number here says the walk really covered the directory's code.
   */
  CALLS_EXAMINED: 1018,
  /**
   * Exported functions returning a read-only array of branded strings.
   *
   * Eight, and the number is here rather than only in the set equality so that
   * a producer disappearing from BOTH sides at once — which the equality alone
   * would call a pass — moves something.
   */
  FAULT_LIST_PRODUCERS: 8,
});

const siteKey = (site: ConstructorCallSite): string => `${site.site} x${String(site.calls)}`;

describe('instrument C — a raw string becomes a brand in a countable number of places', () => {
  it('the brand constructor set is derived from the module, not listed here', () => {
    const census = constructorCensus();
    expect(census.modules).toBe(CONSTRUCTOR_CENSUS.MODULES);
    expect(census.callsExamined).toBe(CONSTRUCTOR_CENSUS.CALLS_EXAMINED);
    // The set itself, by name. It is what the checker says returns a branded
    // string, so a fifth constructor joins both halves of this instrument
    // without either being edited — and a constructor that stopped returning a
    // brand drops out of it, which is red here first.
    expect([...census.constructors]).toEqual([
      'asDisplayName',
      'asFaultMessage',
      'asGymId',
      'asNpcId',
    ]);
    expect(census.constructors.length).toBe(CONSTRUCTOR_CENSUS.CONSTRUCTORS);
  });

  it('every fault-list producer mints on the way out, joined in both directions', () => {
    // THE CHECK BEHIND THE CONTAINMENT HALF OF `asFaultMessage`'s NOTE. That
    // note now says the fault channel is contained rather than open, because
    // every message reaches the constructor at the return of every `*Faults`
    // function. It is a guarantee, so it needs something that goes red when it
    // stops holding, and the `x1` rows above are not it: they say the eight
    // producers that exist each mint once, and say nothing about a ninth.
    //
    // Both sides are DERIVED. The left is every exported function in the
    // shipped directory whose return type the checker says is a read-only array
    // of branded strings; the right is every site instrument C saw call
    // `asFaultMessage`. A producer that returned a cast instead of a mint is on
    // the left and not on the right, which is the shape that used to be
    // invisible.
    //
    // Its limit, and it is the same one the whole instrument has: this says a
    // constructor RUNS on the way out, which makes a forbidden message
    // unshippable. It says nothing about the message being forbidden in the
    // first place — `faults.push(EMPIRE_FORBIDDEN_OUTPUTS[0])` still compiles,
    // which is M26, and what catches it is the drive, not this.
    const census = constructorCensus();
    const minting = distinct(
      census.sites
        .filter((site) => site.site.endsWith('#asFaultMessage'))
        .map((site) => site.site.split('#').slice(0, 2).join('#')),
    );
    expect([...census.faultListExports]).toEqual(minting);
    expect(census.faultListExports.length).toBe(CONSTRUCTOR_CENSUS.FAULT_LIST_PRODUCERS);
  });

  it('the brand constructor call sites are exactly the declared ones', () => {
    const census = constructorCensus();
    // Set equality, both directions. A new mint is an unexpected member; a mint
    // that moved or vanished is a stale row.
    expect(census.sites.map(siteKey)).toEqual([...DECLARED_BRAND_CONSTRUCTOR_CALLS].sort());
    expect(census.sites.length).toBe(CONSTRUCTOR_CENSUS.SITES);
    expect(census.sites.reduce((total, site) => total + site.calls, 0)).toBe(
      CONSTRUCTOR_CENSUS.MINTS,
    );
    // Every declared row names a constructor the checker actually found, so a
    // row cannot survive its constructor being renamed away.
    for (const row of DECLARED_BRAND_CONSTRUCTOR_CALLS) {
      const name = row.split('#')[2]?.split(' ')[0] as string;
      expect(census.constructors, row).toContain(name);
    }
  });

  it('sees a call site that is not on the list — the walker is not asleep', () => {
    // THE NON-VACUITY GUARD, and it is a probe rather than an argument. The
    // census above is a set equality, and a set equality passes just as happily
    // when the walker finds nothing at all. `probeMilestoneId` in the probe
    // module calls `asNpcId`, so the same walk over an eleventh module must
    // report exactly one site the shipped census does not have.
    const probed = constructorCensusOf([...shippedModulePaths(), PROBE_PATH], PROBE_SOURCE);
    const extra = probed.sites
      .map(siteKey)
      .filter((site) => !DECLARED_BRAND_CONSTRUCTOR_CALLS.includes(site));
    expect(extra).toEqual([`${PROBE_MODULE}#probeMilestoneId#asNpcId x1`]);
    expect(probed.modules).toBe(CONSTRUCTOR_CENSUS.MODULES + 1);
    // And the shipped list is unchanged by the probe being in the program, so
    // the extra row is the probe's and not a shift in what the walk sees.
    expect(
      probed.sites.map(siteKey).filter((site) => DECLARED_BRAND_CONSTRUCTOR_CALLS.includes(site)),
    ).toEqual([...DECLARED_BRAND_CONSTRUCTOR_CALLS].sort());
  });

  it('refuses every banned name at every string brand constructor', () => {
    // THE CONTAINMENT HALF, driven over the DERIVED constructor set rather than
    // a list written here — so a fifth string brand that forgot
    // `refuseForbiddenName` is red on this line.
    const census = constructorCensus();
    const module = core as unknown as Record<string, (value: string) => string>;
    let refusals = 0;
    for (const name of census.constructors) {
      const constructor = module[name];
      expect(typeof constructor, `${name} is not callable off the module`).toBe('function');
      for (const forbidden of core.EMPIRE_FORBIDDEN_OUTPUTS) {
        expect(() => (constructor as (value: string) => string)(forbidden), `${name}(${forbidden})`).toThrow(
          new RegExp(`must not be a forbidden empire output.*${forbidden}`),
        );
        refusals += 1;
      }
    }
    // Counts, not bounds: four constructors times four forbidden outputs. A
    // constructor dropping out of the derived set, or a name dropping out of
    // the ban list, moves this rather than leaving a shorter loop green.
    expect(refusals).toBe(
      CONSTRUCTOR_CENSUS.CONSTRUCTORS * core.EMPIRE_FORBIDDEN_OUTPUTS.length,
    );
    expect(refusals).toBe(16);

    // The complement, so the refusal is not refusing everything. A benign
    // identifier is accepted by all four, which is what makes the sixteen
    // throws above a discrimination rather than a constructor that never works.
    let accepted = 0;
    for (const name of census.constructors) {
      const constructor = module[name] as (value: string) => string;
      expect(constructor(SENTINELS.NPC_ID)).toBe(SENTINELS.NPC_ID);
      accepted += 1;
    }
    expect(accepted).toBe(CONSTRUCTOR_CENSUS.CONSTRUCTORS);
  });

  it('does NOT refuse the second ban list, and that limit is a number rather than a sentence', () => {
    // `BANNED_VOCABULARY` is the union of two lists. `refuseForbiddenName` reads
    // one of them: `FORBIDDEN_UNLOCK_KEYS` lives in `reputation.ts`, which
    // imports `empireCore.ts`, so reading it there would be an import cycle —
    // and the directory's own import fence in `empireCore.test.ts` is what makes
    // that a real constraint rather than a preference.
    //
    // So this is the declared limit, taken as a measurement. It is not a pass.
    // The catcher is instrument B, which compares every value it reaches against
    // `BANNED_VOCABULARY` — both lists — by equality AND by containment.
    const unlockKeys = reputationModule.FORBIDDEN_UNLOCK_KEYS;
    let accepted = 0;
    for (const key of unlockKeys) {
      expect(core.asGymId(key)).toBe(key);
      accepted += 1;
    }
    expect(accepted).toBe(unlockKeys.length);
    expect(accepted).toBe(BANNED_VOCABULARY.length - core.EMPIRE_FORBIDDEN_OUTPUTS.length);
    // And the two lists are disjoint, so `accepted` is really the whole of the
    // second one rather than an overlap the first list happened to cover.
    for (const key of unlockKeys) {
      expect(core.EMPIRE_FORBIDDEN_OUTPUTS as readonly string[], key).not.toContain(key);
    }
  });

  it('every field that used to be a bare string is branded now', () => {
    // The join that makes `DECLARED_BARE_STRING_FIELDS` going empty and
    // `DECLARED_BRANDED_STRING_POSITIONS` growing one fact rather than two
    // edits that agree. Reverting any one field to `string` is red here AND on
    // the bare equality, in the same run.
    const branded = new Set(brandedKeys(stringSurface()));
    let checked = 0;
    for (const group of CLOSED_BARE_STRING_FIELDS) {
      expect(group.positions.length, group.field).toBeGreaterThan(0);
      expect(group.why.length, group.field).toBeGreaterThan(80);
      expect(group.closedBy.length, group.field).toBeGreaterThan(0);
      for (const position of group.positions) {
        expect(branded.has(position), `${position} is no longer a branded position`).toBe(true);
        checked += 1;
      }
    }
    // The count the old census pinned, moved from one list to the other and
    // pinned in its new home rather than dropped.
    expect(checked).toBe(23);
    expect(CLOSED_BARE_STRING_FIELDS.length).toBe(5);
    // And the live bare list really is empty, said here as well as in its own
    // test so the two halves of the move are asserted together.
    expect(DECLARED_BARE_STRING_FIELDS.length).toBe(SURFACE_CENSUS.BARE_FIELDS);
    expect(SURFACE_CENSUS.BARE_POSITIONS).toBe(0);
  });
});

// ===========================================================================
// INSTRUMENT B — the behavioural drive and the deep scan
// ===========================================================================

/**
 * How deep the VALUE walk goes, and how many nodes it will visit per driven
 * call before it gives up.
 *
 * Both are pinned as zero-cut counts below rather than trusted. A walker that
 * truncates reports a clean scan, which is the reassuring direction.
 */
const VALUE_WALK_MAX_DEPTH = 16;

interface ScannedString {
  /** Where the string sat, e.g. `[0].visits[0].gymId` or `[0].{key}kind`. */
  readonly path: string;
  readonly value: string;
  /** True when the string was a property KEY rather than a property value. */
  readonly viaKey: boolean;
}

/**
 * One frame of an engine-produced stack.
 *
 * Everything matching this is removed before a stack is compared, because a
 * real frame carries this checkout's absolute path and a line number, and a
 * census over those is a census over the machine.
 */
const STACK_FRAME_LINE = /^[ \t]*at\s.*$/gm;

interface ScanResult {
  readonly strings: readonly ScannedString[];
  readonly nodes: number;
  readonly depthCuts: number;
  readonly gettersInvoked: number;
  readonly getterThrows: number;
  readonly revisits: number;
  /** Objects the runtime reports as a `Proxy`. A trap can lie about its keys. */
  readonly proxies: number;
  /** Error `stack` own-properties encountered. The branch below is skipped, so this is what says it is live. */
  readonly stacks: number;
  /** Banned names found in a stack once its engine frames are stripped. The zero the skip is allowed to be. */
  readonly stackFindings: readonly string[];
  /** Strings and finite numbers in visit order, for the axis fingerprint. */
  readonly trace: readonly string[];
}

/**
 * Walk a value and report every string reachable from it.
 *
 * WHAT IT REACHES, in its own terms: own enumerable AND non-enumerable
 * properties via `Reflect.ownKeys`; property KEYS as well as property values,
 * because attack shape 8 carries the name as a computed key; accessors, which
 * are INVOKED, because `Object.freeze` does not neutralise a getter and
 * `Object.keys` / `Object.entries` / spread / `JSON.stringify` all skip a
 * non-enumerable one; symbol keys, by their description; array elements; `Map`
 * keys and values; `Set` members; and a thrown payload, which is scanned like
 * any other object.
 *
 * WHAT IT DOES NOT REACH, stated because a walker's gaps are its verdict:
 *
 *  - A returned FUNCTION is walked for its own properties and is not called.
 *    Calling an arbitrary returned closure with invented arguments is not
 *    something this can do safely, so a name produced only by invoking one is
 *    outside it. A getter is called; a method is not.
 *  - `Error.stack` is skipped deliberately. It is the runtime's text about file
 *    paths rather than a value the module produced, and scanning it would make
 *    the verdict depend on where the repository is checked out.
 *  - A `Proxy` whose `ownKeys` trap lies is walked as the trap describes it.
 *    `Reflect.ownKeys` is the widest enumeration available and a trap can still
 *    return nothing while `get` answers. Nothing in this directory constructs a
 *    Proxy — `DRIVE_CENSUS.PROXIES` is zero across the whole drive, and the
 *    tripwire's is one, so the branch is measured rather than assumed.
 */
function deepScan(root: unknown, label: string): ScanResult {
  const strings: ScannedString[] = [];
  const trace: string[] = [];
  const visited = new Set<object>();
  let nodes = 0;
  let depthCuts = 0;
  let gettersInvoked = 0;
  let getterThrows = 0;
  let revisits = 0;
  let proxies = 0;
  let stacks = 0;
  const stackFindings: string[] = [];

  const isIndexKey = (key: string): boolean => /^(?:0|[1-9][0-9]*)$/.test(key);

  const scan = (value: unknown, at: string, depth: number): void => {
    if (depth > VALUE_WALK_MAX_DEPTH) {
      depthCuts += 1;
      return;
    }
    if (typeof value === 'string') {
      strings.push({ path: at, value, viaKey: false });
      trace.push(`${at}=${value}`);
      return;
    }
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
      trace.push(`${at}=${String(value)}`);
      return;
    }
    if (typeof value === 'symbol') {
      const description = value.description;
      if (description !== undefined) strings.push({ path: `${at}@@`, value: description, viaKey: false });
      return;
    }
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return;

    const node = value as object;
    if (visited.has(node)) {
      revisits += 1;
      return;
    }
    visited.add(node);
    nodes += 1;
    if (nodeTypes.isProxy(node)) proxies += 1;

    if (node instanceof Map) {
      let index = 0;
      for (const [key, entry] of node) {
        scan(key, `${at}{mapKey${String(index)}}`, depth + 1);
        scan(entry, `${at}{mapVal${String(index)}}`, depth + 1);
        index += 1;
      }
    }
    if (node instanceof Set) {
      let index = 0;
      for (const member of node) {
        scan(member, `${at}{setMember${String(index)}}`, depth + 1);
        index += 1;
      }
    }

    const isArray = Array.isArray(node);
    const isError = node instanceof Error;
    for (const key of Reflect.ownKeys(node)) {
      if (typeof key === 'symbol') {
        const description = key.description;
        if (description !== undefined) {
          strings.push({ path: `${at}[@@key]`, value: description, viaKey: true });
        }
      } else {
        if (isError && key === 'stack') {
          // THE SKIP, AND ITS CATCHER. The key and the value are both left out
          // of `strings`, because an engine stack carries absolute paths and
          // line numbers and pinning a count over them would pin a fact about
          // the machine. That was a declared limit with NOTHING behind it: an
          // `Object.defineProperty(err, 'stack', { value: <a forbidden name> })`
          // in a shipped refusal path moved no count at all.
          //
          // So the value is read here, its `at` frames are stripped, and what
          // is left is checked by equality AND containment. An engine stack
          // strips to its `Error: message` header, which is already scanned as
          // the `message` property; a planted one has no frames and survives
          // whole. `reads a redefined Error.stack` plants exactly that and pins
          // the finding count at one against a clean twin at zero.
          //
          // What this still does not catch, named rather than implied: a
          // planted stack that DISGUISES itself as a frame — a value whose
          // every line matches /^\s*at\s/ — is stripped to nothing and is
          // invisible. Nothing in this file covers that.
          stacks += 1;
          const stackDescriptor = Object.getOwnPropertyDescriptor(node, key);
          // BOTH SHAPES, AND THE SECOND ONE IS WHY THIS COMMENT EXISTS. The
          // first version of this read only `descriptor.value`, which is the
          // shape `Object.defineProperty(err, 'stack', { value })` produces.
          // On this engine `new Error()` installs `stack` as an ACCESSOR, so
          // the plainer `err.stack = <name>` goes through the setter and leaves
          // no `value` at all — and it walked past a catcher written one branch
          // above it, measured at 489 of 489 passing. Invoking the getter is
          // what the walker already does for every other accessor.
          let raw: unknown;
          if (stackDescriptor !== undefined) {
            if (stackDescriptor.get !== undefined) {
              try {
                raw = stackDescriptor.get.call(node);
              } catch {
                raw = undefined;
              }
            } else {
              raw = stackDescriptor.value;
            }
          }
          if (typeof raw === 'string') {
            const stripped = normalise(raw.replace(STACK_FRAME_LINE, ' '));
            for (const name of BANNED_VOCABULARY) {
              if (stripped.includes(normalise(name))) stackFindings.push(`${at}.stack=${name}`);
            }
          }
          continue;
        }
        if (!(isArray && (isIndexKey(key) || key === 'length'))) {
          // The KEY itself is a reachable string. Attack shape 8 puts the name
          // here rather than in a value.
          strings.push({ path: `${at}[key]`, value: key, viaKey: true });
        }
      }
      const descriptor = Object.getOwnPropertyDescriptor(node, key);
      if (descriptor === undefined) continue;
      const path = `${at}.${String(key)}`;
      if (descriptor.get !== undefined) {
        gettersInvoked += 1;
        try {
          scan(descriptor.get.call(node), path, depth + 1);
        } catch {
          getterThrows += 1;
        }
      } else {
        scan(descriptor.value, path, depth + 1);
      }
    }
  };

  scan(root, label, 0);
  return {
    strings: Object.freeze(strings),
    nodes,
    depthCuts,
    gettersInvoked,
    getterThrows,
    revisits,
    proxies,
    stacks,
    stackFindings: Object.freeze(stackFindings),
    trace: Object.freeze(trace),
  };
}

/** The ten shipped namespaces, keyed by the file name the census reports. */
const MODULE_NAMESPACES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = Object.freeze({
  'empireCore.ts': core as unknown as Readonly<Record<string, unknown>>,
  'empireInvariant.ts': invariant as unknown as Readonly<Record<string, unknown>>,
  'empireTuning.ts': tuningModule as unknown as Readonly<Record<string, unknown>>,
  'engagement.ts': engagementModule as unknown as Readonly<Record<string, unknown>>,
  'expansion.ts': expansionModule as unknown as Readonly<Record<string, unknown>>,
  'npc.ts': npcModule as unknown as Readonly<Record<string, unknown>>,
  'production.ts': productionModule as unknown as Readonly<Record<string, unknown>>,
  'recruitment.ts': recruitmentModule as unknown as Readonly<Record<string, unknown>>,
  'reputation.ts': reputationModule as unknown as Readonly<Record<string, unknown>>,
  'social.ts': socialModule as unknown as Readonly<Record<string, unknown>>,
});

// ---------------------------------------------------------------------------
// The domains — one per UNIT, each derived from the branch points of the
// quantity it is a domain OF, and every one of them asserted
// ---------------------------------------------------------------------------

/**
 * The quantity a numeric driver axis is measured in.
 *
 * WHY A UNIT EXISTS AT ALL, MEASURED RATHER THAN ARGUED. An earlier version of
 * this file had one `NUMBER_DOMAIN` derived from every threshold, and beside it
 * a `SMALL_NUMBER_DOMAIN` of ten points — `{0,1,8,9,10,11,12,13,40,48}` —
 * derived from the two OFFLINE_EARNINGS *hour* thresholds and captioned "a
 * cheap subset, for the calls whose cost is a whole simulated calendar". It was
 * then handed to eight axes that are not hours: calendar days, expansion
 * levels, check-ins, grant seconds, upkeep Gym Bucks and history slots.
 * `RIVAL_COMPARISON_PERIOD_DAYS` is 7, it was already in the threshold table,
 * and the file's own header claimed the domain was "derived from the subject's
 * own branch points" — but the axis that branches on 7 was never handed 7. A
 * `recordFriendVisit` that returned a forbidden name on exactly day 7 was
 * invisible to both instruments: `tsc --noEmit` exit 0, 13 files and 484 tests
 * green.
 *
 * So a domain is not "big" or "small". It is a domain OF something, and the
 * thing it is of is what decides which branch points it has to contain. Every
 * threshold below is filed under its unit, every domain declares the units it
 * is a domain of, and 'every domain straddles every threshold of its own units'
 * loops the REGISTRY rather than one hand-picked member of it.
 */
const AXIS_UNITS = [
  'second',
  'hour',
  'day',
  'level',
  'count',
  'reputation',
  'gymBucks',
  'trainingIq',
] as const;

type AxisUnit = (typeof AXIS_UNITS)[number];

/**
 * Every numeric leaf of `EMPIRE_TUNING`, discovered by walking the frozen block
 * rather than by listing what somebody remembered to list.
 *
 * WHY A WALK AND NOT A LIST, MEASURED. The registry below used to be a hand-
 * written table checked against nothing but itself: `no unit is empty and every
 * threshold is filed exactly once` asserted that the forty labels somebody typed
 * were forty distinct labels. It said nothing about the sixty-two knobs nobody
 * typed. `NPC_RECRUIT_COST_GYM_BUCKS.novice` is 500, it was in no unit, it was
 * therefore in no domain — not even `NUMBER`, which is the union of the FILED
 * thresholds and not of the tuning block — and a `recordFriendVisit` returning a
 * forbidden name on exactly day 500 was invisible: `tsc --noEmit` exit 0, 13
 * files and 489 tests green. Filing that one number by hand would have closed
 * that one number.
 *
 * So the population is read off `EMPIRE_TUNING` itself. Adding a knob to that
 * file now reddens this one until the knob is filed under a unit or exempted
 * with a reason, and renaming a knob reddens it as a stale row.
 *
 * A string leaf is counted rather than dropped, so a vocabulary token turning
 * into a number is a moved count rather than a silent new branch point.
 */
interface TuningLeaf {
  readonly path: string;
  readonly value: number;
}

function tuningLeaves(): {
  readonly numbers: readonly TuningLeaf[];
  readonly strings: readonly string[];
} {
  const numbers: TuningLeaf[] = [];
  const strings: string[] = [];
  const walk = (node: unknown, at: string): void => {
    if (typeof node === 'number') {
      numbers.push(Object.freeze({ path: at, value: node }));
      return;
    }
    if (typeof node === 'string') {
      strings.push(at);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((child, index) => {
        walk(child, `${at}[${String(index)}]`);
      });
      return;
    }
    if (typeof node === 'object' && node !== null) {
      for (const [key, child] of Object.entries(node)) walk(child, at === '' ? key : `${at}.${key}`);
      return;
    }
    // Not a silent skip. A boolean, a null or a function inside the tuning block
    // is a shape this walk has never seen, and a walk that shrugs at one would
    // under-report the population it exists to enumerate.
    throw new Error(`EMPIRE_TUNING carries a leaf this walk has no case for, at ${at}`);
  };
  walk(EMPIRE_TUNING, '');
  return { numbers: Object.freeze(numbers), strings: Object.freeze(strings) };
}

const TUNING_LEAVES = tuningLeaves();

/**
 * Every numeric leaf at or under one `EMPIRE_TUNING` path, keyed by its full
 * path, so a scalar, an object table and a ladder are all filed the same way.
 *
 * It throws on a path with no leaf under it, which is what makes a renamed knob
 * a loud failure here rather than a quietly shorter threshold list — the failure
 * mode `rungs()` had, since it took the ladder's NAME as a string and its VALUES
 * as a separate argument and never checked that the two were about each other.
 */
function tuningTable(prefix: string): Readonly<Record<string, number>> {
  const found = TUNING_LEAVES.numbers.filter(
    (leaf) =>
      leaf.path === prefix || leaf.path.startsWith(`${prefix}.`) || leaf.path.startsWith(`${prefix}[`),
  );
  if (found.length === 0) {
    throw new Error(`no numeric leaf of EMPIRE_TUNING is at or under ${prefix}`);
  }
  return Object.freeze(Object.fromEntries(found.map((leaf) => [leaf.path, leaf.value])));
}

/**
 * Every number this directory branches on, keyed by its `EMPIRE_TUNING` PATH and
 * filed under the unit it is measured in.
 *
 * The keys are paths and not labels on purpose. They used to be labels —
 * `COACH_LEVEL_MAX`, `REGIONAL_BRACKET` — which read fine and joined to nothing,
 * so no check could ask whether the tuning block had knobs this table had never
 * heard of. `tuningTable` generates the key from the walk, so the join in
 * 'files or exempts every numeric leaf of EMPIRE_TUNING' is a set equality
 * against the real population.
 *
 * Two entries are DERIVED rather than read — the offline-earnings caps in
 * SECONDS — because the code divides seconds by `SECONDS_PER_HOUR` and compares
 * the result against the hour caps, so both the hour and the second are real
 * branch points and they are different numbers. A derived entry has no leaf
 * path, so it is listed in `DERIVED_THRESHOLDS` with the reason, and the join
 * subtracts exactly those two labels rather than accepting any unrecognised key.
 *
 * WHAT FILING A THRESHOLD UNDER A UNIT NOW BUYS, in the mechanism's own terms,
 * because the answer changed this round and is smaller than it sounds: it makes
 * the threshold **unconditionally** present in the domain of every axis of that
 * unit, however large the value is. It is no longer what decides whether the
 * threshold is present at all — `foreignCeiling` decides that, for every domain,
 * out of the whole branch-point population regardless of unit. That is what
 * makes a misfiling survivable: `FRIEND_VISITS_PER_DAY` is 10 and is filed under
 * `count` because its name says visits, and the value it gates in the bypass is
 * a DAY. Under the old rule `DAY_DOMAIN` never saw 10. Under this one it does,
 * because 10 is under every ceiling in the file.
 */
const UNIT_THRESHOLDS: Readonly<Record<AxisUnit, Readonly<Record<string, number>>>> = Object.freeze({
  second: Object.freeze({
    ...tuningTable('SECONDS_PER_HOUR'),
    ...tuningTable('SECONDS_PER_DAY'),
    ...tuningTable('BUILD_SECONDS_BASE'),
    ...tuningTable('BUILD_SECONDS_MAX'),
    ...tuningTable('TIMER_SKIP_SECONDS_PER_GRANT'),
    // The five recruit timers. `completeRecruitment` compares elapsed seconds
    // against the rung for the tier being recruited, so each is a real branch
    // point on a seconds axis; none of them was filed anywhere before this
    // round.
    ...tuningTable('NPC_RECRUIT_SECONDS'),
    OFFLINE_EARNINGS_NO_PUNISH_SECONDS:
      EMPIRE_TUNING.OFFLINE_EARNINGS_NO_PUNISH_HOURS * EMPIRE_TUNING.SECONDS_PER_HOUR,
    OFFLINE_EARNINGS_CAP_SECONDS:
      EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS * EMPIRE_TUNING.SECONDS_PER_HOUR,
  }),
  hour: Object.freeze({
    ...tuningTable('OFFLINE_EARNINGS_NO_PUNISH_HOURS'),
    ...tuningTable('OFFLINE_EARNINGS_CAP_HOURS'),
  }),
  day: Object.freeze({
    ...tuningTable('NPC_TENURE_DAYS_TO_FULL_LOYALTY'),
    ...tuningTable('PHYSIO_MAX_DAYS_SAVED'),
    ...tuningTable('RIVAL_COMPARISON_PERIOD_DAYS'),
  }),
  level: Object.freeze({
    ...tuningTable('SPACE_LEVEL_MAX'),
    // All three staff ceilings, which is CLAUDE.md's rule that a guard written
    // for one arm is applied to its siblings mechanically. `tuningTable` reaches
    // them by walking the table rather than by three hand-written lines, so a
    // fourth role cannot be added without appearing here.
    ...tuningTable('STAFF_LEVEL_MAX'),
  }),
  count: Object.freeze({
    ...tuningTable('ROSTER_SLOTS_BASE'),
    ...tuningTable('ROSTER_SLOTS_MAX'),
    ...tuningTable('FRIEND_VISITS_PER_DAY'),
    ...tuningTable('LEADERBOARD_BRACKET_SIZE'),
  }),
  reputation: Object.freeze({
    ...tuningTable('REPUTATION_MAX'),
    ...tuningTable('REPUTATION_TIER_THRESHOLDS'),
    // The five recruitment gates. `recruitmentRefusals` compares a gym's
    // reputation against the rung for the tier, which is the same shape as the
    // tier ladder above and was filed nowhere.
    ...tuningTable('NPC_RECRUIT_REPUTATION_THRESHOLD'),
  }),
  gymBucks: Object.freeze({
    ...tuningTable('SPACE_LEVEL_COST_GYM_BUCKS'),
    ...tuningTable('SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER'),
    // The two payouts the upkeep axis is denominated in.
    ...tuningTable('RIVAL_REWARD_GYM_BUCKS'),
    ...tuningTable('ENCOURAGEMENT_REWARD_GYM_BUCKS'),
    // Eighteen prices, every one of them a `balance < price` branch and none of
    // them filed before this round. `NPC_RECRUIT_COST_GYM_BUCKS.novice` is the
    // 500 the seventh bypass keyed on.
    ...tuningTable('NPC_RECRUIT_COST_GYM_BUCKS'),
    ...tuningTable('EQUIPMENT_TIER_COST_GYM_BUCKS'),
    ...tuningTable('STAFF_LEVEL_COST_GYM_BUCKS'),
  }),
  trainingIq: Object.freeze({
    ...tuningTable('TRAINING_IQ_DAILY_CEILING'),
  }),
});

/**
 * The threshold labels in the table above that are NOT `EMPIRE_TUNING` paths,
 * with the reason each is a branch point the tuning block does not spell.
 *
 * The join treats this list as the whole of the exception. An unrecognised key
 * that is neither a leaf path nor on this list fails, so a future hand-written
 * label cannot re-open the hole this round closed.
 */
const DERIVED_THRESHOLDS: readonly (readonly [string, string])[] = Object.freeze([
  [
    'OFFLINE_EARNINGS_NO_PUNISH_SECONDS',
    'the no-punish gap expressed in seconds. `OFFLINE_EARNINGS_NO_PUNISH_HOURS` times `SECONDS_PER_HOUR`: the accrual takes seconds and compares hours, so both numbers are branch points and they are 10 and 36000.',
  ],
  [
    'OFFLINE_EARNINGS_CAP_SECONDS',
    'the banking horizon expressed in seconds, for the same reason as the row above. 12 hours and 43200 seconds are two different comparands on two different axes.',
  ],
]);

/**
 * The numeric leaves of `EMPIRE_TUNING` that are filed under no unit, each with
 * what the number IS instead of a restatement that it is not a branch point.
 *
 * WHAT AN EXEMPTION DECIDES, AND — SAID FIRST, BECAUSE IT IS THE HALF A READER
 * WILL ASSUME WRONG — WHAT IT DOES NOT. It decides only whether the leaf is
 * guaranteed present in a domain whose `foreignCeiling` does not reach it. It
 * does not remove the leaf from any domain: `EVERY_BRANCH_POINT` is the union of
 * the filed thresholds and this list, and every domain contains a straddle of
 * every member of that union at or below its ceiling. The largest value on this
 * list is `GYM_BUCKS_BASE_PER_HOUR` at 120 and the lowest ceiling in the file is
 * above it, so on this tree an exempt leaf is in EVERY domain — which is
 * asserted by 'contains every exempt leaf in every domain, so an exemption is
 * not a hole', not assumed. Exempting a large value is what would make this list
 * load-bearing, and that assertion is what reddens when somebody does.
 *
 * So the reasons below are the second line, not the first. They exist so that a
 * knob is classified by a person rather than pasted in, and the classes are
 * three: a RATE (a quantity per unit of something else, multiplied by a span), a
 * MULTIPLIER or exponent (dimensionless, applied to an output), and an entry
 * with no consumer at all.
 */
interface ExemptLeaf {
  readonly path: string;
  readonly why: string;
}

/** One exemption row per numeric leaf under a path, sharing the table's reason. */
function exemptTable(prefix: string, why: string): readonly ExemptLeaf[] {
  return Object.keys(tuningTable(prefix)).map((path) => Object.freeze({ path, why }));
}

const NOT_A_BRANCH_POINT: readonly ExemptLeaf[] = Object.freeze([
  ...exemptTable(
    'PRECISION_DECIMALS',
    'A DIGIT COUNT. It is handed to the rounding helper that scrubs IEEE-754 noise out of an accrual, so it sizes the arithmetic rather than naming a place on any axis. No quantity in this directory is denominated in decimal places.',
  ),
  ...exemptTable(
    'TICK_SECONDS',
    'A DIVISOR. Elapsed seconds are floored to this quantum before anything else happens, so it appears as `seconds / TICK_SECONDS` and never as `seconds === TICK_SECONDS`. Its value is 1, which is a shape point every domain in the file carries anyway.',
  ),
  ...exemptTable(
    'CHECK_IN_TARGET_SECONDS_MIN',
    'NO CONSUMER. `empireTuning.test.ts`\'s `AWAITING_CONSUMER` pins, in both directions, that no shipped module in this directory reads it — nothing in `src/empire/` models how long a check-in takes. A value nothing reads is a value nothing can branch on. This exemption expires by itself: the check below re-runs that scan and fails if a shipped module starts reading the name.',
  ),
  ...exemptTable(
    'CHECK_IN_TARGET_SECONDS_MAX',
    'NO CONSUMER, the sibling of the row above and the one the lead agent\'s first attempt at the seventh bypass keyed on. That attempt went red — not on this guard, but on `AWAITING_CONSUMER`, because the mutant BECAME the consumer. A different check noticing is not this check working, and it is the reason this row carries a scan rather than a sentence.',
  ),
  ...exemptTable(
    'OFFLINE_EARNINGS_FRACTION',
    'A MULTIPLIER. The share of the online rate that accrues while away, multiplied into an amount. Dimensionless, and between 0 and 1 by design.',
  ),
  ...exemptTable(
    'GYM_BUCKS_BASE_PER_HOUR',
    'A RATE, in Gym Bucks per hour. It is multiplied by an elapsed span; the axis it would have to be a threshold ON is denominated in Bucks-per-hour, and no driver in this file is.',
  ),
  ...exemptTable(
    'NPC_GYM_BUCKS_PER_HOUR_BASE',
    'A RATE, in Gym Bucks per hour per roster lifter. Same class as the row above, one factor further in: it is multiplied by a tier multiplier, a loyalty multiplier and an elapsed span before anything looks at the result.',
  ),
  ...exemptTable(
    'TRAINING_IQ_BASE_PER_DAY',
    'A RATE, in Training IQ per calendar day. The CEILING that rate accumulates against is `TRAINING_IQ_DAILY_CEILING`, and that one is filed, under `trainingIq`.',
  ),
  ...exemptTable(
    'NPC_TRAINING_IQ_PER_DAY_BASE',
    'A RATE, in Training IQ per day per roster lifter. Same class and same filed ceiling as the row above; the roster size it is multiplied by is the ROSTER_SHAPE axis, whose two ends are filed under `count`.',
  ),
  ...exemptTable(
    'REPUTATION_PER_CHECK_IN',
    'A RATE, in reputation per check-in. The reputation THRESHOLDS it accumulates towards are filed under `reputation`; the rate is not one of them.',
  ),
  ...exemptTable(
    'REPUTATION_PER_NPC_TENURE_DAY',
    'A RATE, in reputation per lifter per day of tenure. Same class as the row above, and the second of the two terms `accrueReputation` sums before comparing the result against a filed tier threshold.',
  ),
  ...exemptTable(
    'ROSTER_SLOTS_PER_SPACE_LEVEL',
    'A RATE, in roster slots per level of the space axis. What is compared is the capacity it produces, and both ends of that — `ROSTER_SLOTS_BASE` and `ROSTER_SLOTS_MAX` — are filed under `count`.',
  ),
  ...exemptTable(
    'ROSTER_SLOTS_PER_SPOTTER_LEVEL',
    'A RATE, in roster slots per spotter level. The sibling of the row above, listed because this file\'s own rule is that a decision taken for one arm is taken for the arm beside it.',
  ),
  ...exemptTable(
    'PHYSIO_DAYS_SAVED_PER_STAFF_LEVEL',
    'A RATE, in days of setback removed per physio level. The ceiling it accumulates to is `PHYSIO_MAX_DAYS_SAVED`, which is filed under `day` because the fatigue seam compares against it.',
  ),
  ...exemptTable(
    'NPC_LOYALTY_MIN_MULTIPLIER',
    'A MULTIPLIER ENDPOINT. The loyalty curve\'s value on day zero of tenure, in multiplier space. The tenure axis it is a function OF has its threshold filed: `NPC_TENURE_DAYS_TO_FULL_LOYALTY`, under `day`.',
  ),
  ...exemptTable(
    'NPC_LOYALTY_MAX_MULTIPLIER',
    'A MULTIPLIER ENDPOINT, the other end of the curve named in the row above. It bounds an output in multiplier space rather than gating an input.',
  ),
  ...exemptTable(
    'NPC_LOYALTY_CURVE_EXPONENT',
    'AN EXPONENT, applied to normalised tenure to shape the curve between the two endpoints above. Dimensionless and never compared.',
  ),
  ...exemptTable(
    'NPC_TIER_OUTPUT_MULTIPLIER',
    'FIVE MULTIPLIERS, one per recruitment tier, applied to the Bucks and IQ bases. The tier is selected by name from `NPC_TIERS`, so nothing compares a number against a rung of this table. Decided as a table rather than per rung, because every rung is the same kind of number and a per-rung reason would be the same sentence five times.',
  ),
  ...exemptTable(
    'EQUIPMENT_TIER_BUCKS_MULTIPLIER',
    'FOUR MULTIPLIERS, one per equipment tier, selected by tier name. The PRICES of the same four tiers are filed under `gymBucks`, which is the split this list is about: what you pay is compared, what it multiplies is not.',
  ),
  ...exemptTable(
    'SPACE_PASSIVE_CEILING_MULTIPLIER',
    'SIX MULTIPLIERS, indexed by space level. The index is the branch point and `SPACE_LEVEL_MAX` is filed under `level`; the multiplier read out at that index is not.',
  ),
  ...exemptTable(
    'STAFF_COACH_BUCKS_MULTIPLIER_PER_LEVEL',
    'A MULTIPLIER per coach level, added into a Bucks multiplier. The level ceiling it is applied up to, `STAFF_LEVEL_MAX.coach`, is filed under `level`, and the level index is the thing anything compares.',
  ),
  ...exemptTable(
    'BUILD_SECONDS_GROWTH_PER_LEVEL',
    'A MULTIPLIER on the previous level\'s build time. The two seconds values it moves between — `BUILD_SECONDS_BASE` and `BUILD_SECONDS_MAX` — are both filed under `second`, and they are the numbers a timer is compared against.',
  ),
]);

/**
 * Every branch point this file knows about, filed or exempt, label to value.
 *
 * This is the population a domain's ceiling is applied to. The distinction the
 * old registry drew — a threshold is in the domain if and only if it is filed
 * under one of the domain's units — is what the seventh bypass rode, from both
 * directions at once: `FRIEND_VISITS_PER_DAY` filed under the wrong unit, and
 * `NPC_RECRUIT_COST_GYM_BUCKS.novice` filed under none.
 */
const EVERY_BRANCH_POINT: Readonly<Record<string, number>> = Object.freeze(
  ((): Record<string, number> => {
    const all: Record<string, number> = {};
    for (const unit of AXIS_UNITS) Object.assign(all, UNIT_THRESHOLDS[unit]);
    for (const row of NOT_A_BRANCH_POINT) Object.assign(all, tuningTable(row.path));
    return all;
  })(),
);

/** Below, just below, at, just above, far above. Negatives dropped, not clamped. */
function straddle(threshold: number): readonly number[] {
  return [threshold - 2, threshold - 1, threshold, threshold + 1, threshold * 4].filter(
    (point) => Number.isFinite(point) && point >= 0,
  );
}

/**
 * Just below, at, just above. What a domain gets for a branch point that belongs
 * to a unit it is not a domain of.
 *
 * Three points and not five, and the difference is a measured cost rather than a
 * shrug. The `threshold - 2` point is redundant with `threshold - 1` for every
 * comparison a single number can be on the left of, and the `threshold * 4`
 * point is the expensive one: the day axis is linear in its own value, so the
 * ×4 of `SPACE_LEVEL_COST_GYM_BUCKS[4]` is 480 000 iterations of a subject that
 * allocates per day. Dropping it costs the "an order of magnitude above" probe,
 * which every domain still has from the ×4 of its OWN largest threshold.
 *
 * What this does not weaken: the containment assertion requires a point strictly
 * below and a point strictly above every obligation, and `threshold ± 1`
 * supplies both.
 */
function nearStraddle(threshold: number): readonly number[] {
  return [threshold - 1, threshold, threshold + 1].filter(
    (point) => Number.isFinite(point) && point >= 0,
  );
}

/**
 * EVERY DRIVER AXIS IN THIS FILE IS INTEGRAL, AND SEVENTEEN BRANCH POINTS ARE
 * NOT — so this is where the two meet, stated rather than dropped silently.
 *
 * Until this round every filed threshold happened to be a whole number, so the
 * question never came up. Filing the whole tuning block brings in seventeen
 * fractional leaves — `STAFF_COACH_BUCKS_MULTIPLIER_PER_LEVEL` is 0.12,
 * `NPC_TRAINING_IQ_PER_DAY_BASE` is 0.25 — and handing 1.12 to an axis that
 * counts history slots is not a weaker probe, it is a `RangeError`:
 * `historyFrom` refuses a non-integer outright, which is a REFUSAL rather than a
 * branch and produces nothing to scan.
 *
 * So a fractional branch point contributes the integers on both sides of it, and
 * the claim that this loses nothing is bounded to integral axes, where it is
 * exact rather than approximate: an integral `x` can never satisfy
 * `x === 0.12`, and `x < 0.12` against `x >= 0.12` is discriminated by 0 and 1,
 * both of which every domain in this file carries as shape points anyway.
 *
 * The route that gets past it: an axis that is NOT integral. There is none in
 * this file, and the named catcher for one arriving is that `AXIS_CENSUS` pins
 * each axis's point count — a new fractional axis reading a domain would be
 * driven at whole numbers only, which is a coverage gap this paragraph would
 * then be wrong about. The containment assertion states the obligation in these
 * terms, so a reader sees `floor` and `ceil` rather than an exact hit that is
 * not happening.
 */
function integralPoints(points: readonly number[]): readonly number[] {
  return points.flatMap((point) =>
    Number.isInteger(point) ? [point] : [Math.floor(point), Math.ceil(point)],
  );
}

const numeric = (values: readonly number[]): readonly number[] =>
  [...new Set(values)].sort((left, right) => left - right);

/**
 * A domain: every threshold of its own units straddled in full, every OTHER
 * branch point at or below `foreignCeiling` straddled near, and the two shape
 * points.
 */
function domainOf(
  units: readonly AxisUnit[],
  foreignCeiling: number,
  extra: readonly number[] = [],
): readonly number[] {
  const own = units.flatMap((unit) => Object.values(UNIT_THRESHOLDS[unit]));
  const foreign = Object.values(EVERY_BRANCH_POINT).filter(
    (value) => !own.includes(value) && value <= foreignCeiling,
  );
  return numeric(
    integralPoints([0, 1, ...own.flatMap(straddle), ...foreign.flatMap(nearStraddle), ...extra]),
  );
}

/**
 * A numeric driver axis's domain: the units it is a domain OF, and how far it
 * reaches into the branch points of every other unit.
 *
 * `units` names the thresholds it carries unconditionally. `foreignCeiling` is
 * the new field and is the one that does the work — every branch point in
 * `EVERY_BRANCH_POINT` at or below it is in the domain whatever unit it was
 * filed under, or whether it was filed at all. `alsoContains` names individual
 * thresholds for a domain narrower than any whole unit, so a domain can never
 * declare zero obligations and pass. `why` is required and required to be long,
 * because every one of these that is not `NUMBER` is a cost concession and a
 * concession without a stated price is how the ten-point domain survived six
 * rounds.
 *
 * THE ROUTE THAT USED TO GET PAST THIS, named concretely because it was
 * planted: a subject that compares a narrow-domain axis against a branch point
 * ABOVE that domain's ceiling. `omits` on the census below is that route
 * counted rather than described — per domain, exactly how many of the 66 branch
 * points it does not carry — and `OMITTED_ABOVE_CEILING` pins those counts.
 *
 * THE PARAGRAPH THAT USED TO SIT HERE SAID THE CATCHER WAS NOTHING, and argued
 * that the dropped points were the large ones and a `day === 45000` mutant
 * would have had to allocate 45 000 objects to be caught. The argument was
 * sound and the conclusion was wrong, because it was an argument about the
 * ALLOCATING subjects and the DAY axis has ten that allocate nothing.
 * `recordFriendVisit` is one of them, and returning the ban list's first member
 * on day 2 000 cost it a comparison and no allocation at all. It is kept here
 * rather than deleted because it is a worked example of a limit whose stated
 * reason covers less than the limit does.
 *
 * The catcher is the overflow pass, below `driveEverything`. It leaves every
 * ceiling exactly where it is and drives each dropped point once, on its own,
 * without the cross-product the ceiling was bought to avoid. What it still does
 * not reach is `OVERFLOW_RESIDUAL`, which is per subject and per point rather
 * than three numbers.
 */
interface NumericDomain {
  readonly units: readonly AxisUnit[];
  readonly foreignCeiling: number;
  readonly alsoContains: Readonly<Record<string, number>>;
  readonly points: readonly number[];
  readonly why: string;
}

/** Freeze one registry entry at the interface, so its key stays concrete. */
function domainSpec(spec: NumericDomain): NumericDomain {
  return Object.freeze(spec);
}

/**
 * How far each domain reaches into the branch points of units it is not a domain
 * of, and what that reach was MEASURED to cost.
 *
 * These are the only free parameters this round adds, so they are named
 * constants in one place rather than magnitudes inside the registry — which is
 * CLAUDE.md's rule for a tunable value, applied to a harness knob because the
 * knob is a cost/coverage trade a later reader will want to move.
 *
 * `NO_CEILING` is `Infinity` and is what a domain that pays for everything
 * declares. The others are the value that showed up in the measurement below.
 *
 * ARE THESE THE RIGHT NUMBERS? GRADED RATHER THAN ASSUMED, and the answer
 * changed this round.
 *
 * When they were chosen the honest statement was that 600 clears the two known
 * bypass values with headroom — the measurement supported "unbounded is much
 * worse" and never "600 is where the curve bends". That mattered, because
 * anything above the ceiling was invisible to the whole file, so an
 * unprincipled number was deciding correctness. The eighth bypass then keyed
 * on 2 000 and proved the point.
 *
 * IT IS A COST KNOB NOW, and that is what the overflow pass changed. A branch
 * point above a ceiling is dropped from the CROSS-PRODUCT and picked up
 * one-at-a-time by the overflow pass, so moving 600 up or down changes what the
 * drive costs and — for the 104 of 134 points the overflow pass reaches —
 * changes nothing about what is caught. `covers exactly the branch points the
 * ceilings drop, in both directions` is what keeps that true: lower a ceiling
 * and the points it sheds arrive in `overflowPoints` by construction, with
 * `OMITTED_ABOVE_CEILING` and `OVERFLOW_RESIDUAL` moving to say so.
 *
 * THE PART WHERE IT IS STILL NOT PURELY A COST KNOB, stated because the
 * sentence above is bounded and not absolute — AND CORRECTED, because the
 * paragraph it replaces was true when written and stopped being true one round
 * later. It read: "for the 30 ROSTER_SHAPE points above
 * `OVERFLOW_ALLOCATION_CEILINGS.ROSTER_SHAPE`, nothing drives them at all."
 * Something does now. All 690 of that axis's (subject, point) pairs above the
 * ceiling are called and their returns scanned; what the ceiling still buys is
 * that the state handed in is not walked a second time. Raising the ceiling to
 * get that back is still priced: `DOMAIN_COST_SECONDS` measured this axis at
 * 138.1 s against 38.8 s for a ceiling of 120, and `OVERFLOW_COST_SECONDS` at
 * 301.7 s against 11.8 s.
 *
 * The DAY ceiling has no such correction and was re-measured rather than
 * assumed to share one: `runEmpire` at the smallest dropped DAY point, 2 500
 * days, is 908 ms and returns 10 051 nodes, so there is no cheap region to take
 * on that axis and its rows stay undriven.
 *
 * THE SENTENCE THAT USED TO END THAT PARAGRAPH IS NOW FALSE AND IS CORRECTED
 * RATHER THAN DELETED, because it was a correct prediction and the round it
 * predicted is the one that answered it. It read: `FOREIGN_CEILINGS.ROSTER_SHAPE`
 * "is still the only thing standing between a roster-size branch point and no
 * coverage". Two things stand there now, and neither is a domain:
 *
 *   - a roster-size branch point that ASSIGNS a forbidden name into one of this
 *     directory's string fields does not compile, at any roster size. That is
 *     M15 in `PLANTED_ROUTES`, planted above this very ceiling: `tsc --noEmit`
 *     exit 2, and `vitest run src/empire` 2 failed of 463 with both failures
 *     being that same diagnostic read through instrument A.
 *   - one that MINTS one through a brand constructor still compiles, and is
 *     caught by instrument C's call-site census — which counts calls in source
 *     and never drives anything, so the ceiling does not reach it either. That
 *     is M21: 3 failed of 463, all three in instrument C, with instrument B and
 *     the overflow pass green.
 *
 * WHAT IS STILL UNCOVERED ABOVE THIS CEILING, so this is not read as closure:
 * anything that is not a forbidden NAME in a branded field. Attack shape 16 —
 * a quantity with no name anywhere — is untouched by all of it, above the
 * ceiling and below it alike.
 */
const FOREIGN_CEILINGS = Object.freeze({
  NO_CEILING: Number.POSITIVE_INFINITY,
  DAY: 600,
  COUNT: 600,
  ROSTER_SHAPE: EMPIRE_TUNING.ROSTER_SLOTS_MAX + 1,
});

/**
 * MEASURED on this tree, in this session, one domain at a time: from the shipped
 * configuration, that domain's ceiling raised and every other left alone, then
 * `npx vitest run src/empire/empireForbiddenOutput.test.ts -t 'drives every
 * export'`, reading vitest's own `Duration`. The drive is the subject rather
 * than the whole file because every other cost in the file is downstream of how
 * many values the drive produced.
 *
 * WHY THE ROWS ARE KEYED BY DOMAIN AND NOT BY AXIS, which is a defect this round
 * closes rather than a preference: the old rows were axis names —
 * `historyFrom and four siblings / history slots` — and the check beside them
 * asserted only that exactly two rows cost more than twice a baseline. Nothing
 * joined a row to a domain, so a domain could carry a ceiling with no
 * measurement behind it and a row could price a domain that does not exist. The
 * join is a set equality now, in both directions.
 *
 * WHAT THE MEASUREMENT ACTUALLY SAID, INCLUDING THE TWO CEILINGS IT DELETED.
 * Five domains were given a ceiling when this round started, on the assumption
 * that a wider domain is a slower one. Against 38.8 s shipped, raising SECONDS
 * to no ceiling measured **31.2 s** and LEVEL **29.9 s** — both FASTER than the
 * shipped configuration, which is noise and is the finding: those two ceilings
 * bought nothing and were charging the coverage for it. They are gone, and the
 * check below is what deleted them, because it requires a ceiling's measurement
 * to show a real saving rather than merely to exist.
 *
 * The three that remain: COUNT **61.4 s**, ROSTER_SHAPE **138.1 s** at a ceiling
 * of 120 rather than at no ceiling, and DAY **killed by the watchdog at 700 s
 * having not finished**. `completed` is false on that row and its number is a
 * lower bound rather than a duration, which is said in the field's name and
 * asserted rather than left to this paragraph.
 */
interface DomainCostRow {
  /** The key in `NUMERIC_DOMAINS` this row prices. */
  readonly domain: string;
  /** The ceiling the raised measurement ran at. */
  readonly raisedTo: number;
  /**
   * Drive-test seconds at `raisedTo`. A LOWER BOUND, not a duration, where
   * `completed` is false: the run was killed by `tools/watchdog.mjs` at its
   * budget and the real number is larger by an unknown amount.
   */
  readonly raisedSeconds: number;
  readonly completed: boolean;
  /** Drive-test seconds at the shipped ceilings, same session, same machine. */
  readonly shippedSeconds: number;
  readonly axes: string;
}

const DOMAIN_COST_SECONDS: readonly DomainCostRow[] = Object.freeze([
  Object.freeze({
    domain: 'DAY',
    raisedTo: Number.POSITIVE_INFINITY,
    raisedSeconds: 700,
    completed: false,
    shippedSeconds: 38.8,
    axes: 'fifteen social exports, calendar day. socialRewardSchedule and rivalPeriodCloseDays allocate one frozen object per day, and the largest branch point in the block is 480 000.',
  }),
  Object.freeze({
    domain: 'COUNT',
    raisedTo: Number.POSITIVE_INFINITY,
    raisedSeconds: 61.4,
    completed: true,
    shippedSeconds: 38.8,
    axes: 'historyFrom and four siblings, history slots. One entry allocated per slot, then four more exports walk the result the deep scan then walks again.',
  }),
  Object.freeze({
    domain: 'ROSTER_SHAPE',
    raisedTo: 120,
    raisedSeconds: 138.1,
    completed: true,
    shippedSeconds: 38.8,
    axes: 'the STATES fixture, roster size. Every point multiplies the reputation ladder and the product is crossed with tiers, clocks and the whole NUMBER domain. Raised to 120 rather than to no ceiling, because 120 is the largest exempt leaf and is what the stronger version of the exemption claim would have cost.',
  }),
]);

const NUMERIC_DOMAINS = Object.freeze({
  NUMBER: domainSpec({
    units: [...AXIS_UNITS],
    foreignCeiling: FOREIGN_CEILINGS.NO_CEILING,
    alsoContains: Object.freeze({}),
    points: domainOf([...AXIS_UNITS], FOREIGN_CEILINGS.NO_CEILING),
    why:
      'The default, and the one every axis uses unless a measurement in ' +
      'DOMAIN_COST_SECONDS says it cannot afford to. It is every unit plus no ' +
      'ceiling, so it contains every branch point this directory has, and the ' +
      'containment assertion below is therefore trivially satisfiable for it — ' +
      'which is fine, because for this domain the interesting property is that ' +
      'nothing was left out rather than that anything was put in.',
  }),
  SECONDS: domainSpec({
    units: ['second'],
    foreignCeiling: FOREIGN_CEILINGS.NO_CEILING,
    alsoContains: Object.freeze({}),
    points: domainOf(['second'], FOREIGN_CEILINGS.NO_CEILING),
    why:
      'Elapsed-seconds axes: build timers, clocks, recruitment schedules and ' +
      'the offline banking horizon. It carries no ceiling, so it differs from ' +
      'NUMBER only in that the seconds thresholds get the five-point straddle ' +
      'and everything else gets the three-point one. It is kept as its own ' +
      'entry because the seconds thresholds are the large ones and a seconds ' +
      'axis that never reaches SECONDS_PER_DAY tests nothing about a timer.',
  }),
  DAY: domainSpec({
    units: ['day'],
    foreignCeiling: FOREIGN_CEILINGS.DAY,
    alsoContains: Object.freeze({}),
    points: domainOf(['day'], FOREIGN_CEILINGS.DAY),
    why:
      'Calendar days, and the axis both halves of the seventh bypass rode in ' +
      'on. socialRewardSchedule and rivalPeriodCloseDays are linear in the day ' +
      'and every value they return is deep-scanned, so no ceiling did not ' +
      'finish inside a 700 s watchdog budget against 38.8 s shipped — the ' +
      'largest branch point is 480 000 and each of those is 480 000 frozen ' +
      'objects. The ceiling is what makes 10 and 500 reachable ' +
      'on a DAY axis at all: both are filed under a unit that is not day, one ' +
      'by a misfiling and one by not being filed, and neither is now something ' +
      'this domain depends on getting right.',
  }),
  COUNT: domainSpec({
    units: ['count'],
    foreignCeiling: FOREIGN_CEILINGS.COUNT,
    alsoContains: Object.freeze({}),
    points: domainOf(['count'], FOREIGN_CEILINGS.COUNT),
    why:
      'Slot counts and roster-sized quantities. historyFrom allocates one ' +
      'entry per slot and four more exports then walk the result, so no ' +
      'ceiling measured 61.4 s against 38.8 s on the drive, for the same ' +
      'reason the day axis is expensive. It carries the count thresholds ' +
      'unconditionally, which reach 400, and every other branch point up to ' +
      '600 — which is past every slot count, past both leaderboard brackets, ' +
      'and past the two values the seventh bypass keyed on.',
  }),
  LEVEL: domainSpec({
    units: ['level'],
    foreignCeiling: FOREIGN_CEILINGS.NO_CEILING,
    alsoContains: Object.freeze({}),
    points: domainOf(['level'], FOREIGN_CEILINGS.NO_CEILING),
    why:
      'Expansion and staff levels, for the axes that build a GymAxes per point ' +
      'and cross it with every equipment tier and every expansion axis. This ' +
      'one replaces an inline [0, SPACE_LEVEL_MAX] literal, which is CLAUDE.md ' +
      'sampling only the extremes exactly: the space ceiling was sampled at ' +
      'its two ends and never at a level in between, and the staff ceilings ' +
      'were never sampled at all. It carries no ceiling, so it is a superset ' +
      'of what it was.',
  }),
  ROSTER_SHAPE: domainSpec({
    units: [],
    foreignCeiling: FOREIGN_CEILINGS.ROSTER_SHAPE,
    alsoContains: Object.freeze({
      ...tuningTable('ROSTER_SLOTS_BASE'),
      ...tuningTable('ROSTER_SLOTS_MAX'),
    }),
    points: domainOf([], FOREIGN_CEILINGS.ROSTER_SHAPE, [EMPIRE_TUNING.ROSTER_SLOTS_MAX + 1]),
    why:
      'The roster sizes STATES is built at, which is the most expensive axis ' +
      'in the file: every point here multiplies the reputation ladder and the ' +
      'product is then crossed with tiers, clocks and the whole NUMBER domain. ' +
      'A ceiling of 120 measured 138.1 s against 38.8 s on the drive, the ' +
      'worst ratio of the three, so its ceiling is the lowest — one past the ' +
      'largest roster rosterCapacity will admit — and the four exempt leaves ' +
      'that leaves outside it are named in EXEMPT_LEAVES_ABOVE_A_CEILING ' +
      'rather than counted. It was [0, 1, ROSTER_SLOTS_MAX] and so never sampled base ' +
      'capacity or a roster over capacity, which are both real branches in ' +
      'rosterCapacity and in the recruitment refusals that read it; the ' +
      'over-capacity point is the one `extra` argument in the file, and it is ' +
      'what the NUMBER-containment loop below is a check ON.',
  }),
});

/**
 * The module-level number lists in this file that are NOT a subject's domain.
 *
 * The exception list for `defines every numeric domain inside the registry`.
 * One row, and it exists so that the one legitimate non-domain list is a name a
 * reviewer signs rather than a declaration spelled to slip past a regex — which
 * is the evasion the sibling scan one test below was written for.
 *
 * A row here is a claim that nothing is DRIVEN over this list, so adding one
 * for a real driver axis would put that axis outside the registry entirely.
 * That is the cost of the mechanism and it is why the list is short.
 */
const NON_DOMAIN_NUMBER_LISTS: readonly (readonly [string, string])[] = Object.freeze([
  Object.freeze([
    'CALLBACK_TRIPWIRE_POINTS',
    'The callback tripwire drives a function that is not shipped and never exported, so it has no axis in the registry to be a domain of. Three points, chosen small so its own pinned counts are hand-checkable and do not move when the tuning block does.',
  ] as const),
]);

const NUMBER_DOMAIN: readonly number[] = NUMERIC_DOMAINS.NUMBER.points;
const SECONDS_DOMAIN: readonly number[] = NUMERIC_DOMAINS.SECONDS.points;
const DAY_DOMAIN: readonly number[] = NUMERIC_DOMAINS.DAY.points;
const COUNT_DOMAIN: readonly number[] = NUMERIC_DOMAINS.COUNT.points;
const LEVEL_DOMAIN: readonly number[] = NUMERIC_DOMAINS.LEVEL.points;
const ROSTER_SHAPES: readonly number[] = NUMERIC_DOMAINS.ROSTER_SHAPE.points;

/**
 * The horizon the composed-loop drivers run to.
 *
 * A named constant rather than `RUN_DAY_DOMAIN[1]`, which is what it used to
 * be: a positional read out of a domain is a silent dependency on that domain's
 * sort order, and this round changes the domain.
 */
const RUN_HORIZON_DAYS = EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS;

/**
 * The horizon the injected-axis census runs to, and it is longer on purpose.
 *
 * MEASURED: at `RUN_HORIZON_DAYS`, `policy.axisOrder` moved 0 of 6 points and
 * `policy.leaderboardMetric` moved 0 of 2 — both structurally, not by accident.
 * The metric is read only when a rival period CLOSES, and no period closes
 * inside its own length; the order is read only when a spending moment can
 * afford a rung, and seven days of a fresh gym cannot afford one. Both are
 * CLAUDE.md's "a variation that leaves the subject's own domain is the same
 * defect wearing the costume of the fix" — the axis existed, the points
 * existed, and the subject never engaged. Four periods plus a day is past both.
 */
const AXIS_PROBE_DAYS = EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS * 4 + 1;

/**
 * The loop axes in this file that are written as an array literal at their
 * call site rather than as a domain, each with the reason it is not a domain.
 *
 * This is the catcher for the registry's declared limit. `NUMERIC_DOMAINS` is
 * discovered at runtime, so a domain inside it cannot escape the containment
 * assertion — but an axis written as a bare array literal at its call site was
 * never in the registry to be discovered. Two of the eight axes in this file
 * were exactly that, and one of them (`[0, SPACE_LEVEL_MAX]`) was a threshold
 * axis sampled at its two extremes. It is `LEVEL_DOMAIN` now; these seven are
 * what is left, and the check below pins the set in both directions so an
 * eighth cannot arrive quietly.
 *
 * Its own limit, and the branch immediately below it: the scan matches
 * `for (const x of [ … ])` and nothing else, so an array literal handed to
 * `.map()` is invisible — which is exactly how `axisReadings` writes its axes.
 * The named catcher for those is `AXIS_CENSUS`, which pins every axis's point
 * count beside its disagreement count.
 */
const LITERAL_AXES: readonly (readonly [string, string])[] = Object.freeze([
  ['accelerant', 'null and one purchasable accelerant: the presence of a plan, not a magnitude.'],
  ['diagnostic', 'the fixed list of TypeScript diagnostic categories the surface walk reports.'],
  ['encourage', 'the boolean argument to recordFriendVisit. Two points is the whole domain.'],
  ['everyNth', 'a divisor selecting which slots are check-ins. A shape parameter — every slot, or every other — and not a magnitude with thresholds.'],
  ['gymId', 'four caller-supplied identifiers: two friends, the player, and one that is not on the friend list. The second friend is what makes the VISITED arm reachable. Strings, not numbers.'],
  ['identifier', 'the three sentinels fed to the four string brand constructors, one per caller-supplied identifier position. Strings, not numbers.'],
  ['kind', 'NOT A DRIVER AXIS, and registered rather than rephrased. It is the channel census walking the distinct syntax kinds found at one internal callback position, so it drives nothing and has no domain. The scan cannot tell that apart from an axis and it should not try — this row is the visible edit it exists to force, which is the same answer M8 gets from the export census.'],
  ['last', 'the boolean telling spendingMoment whether this is the final moment. Two points is the whole domain.'],
]);

/**
 * Every LABELLED FIXTURE LIST this file drives, and where its points come from.
 *
 * WHY THIS EXISTS. `NUMERIC_DOMAINS` governs the axes that are numbers, and two
 * scans stop an axis being written outside it — one for a module-level `readonly
 * number[]`, one for `for (const x of [ … ])`. Neither sees a list of `[label,
 * value]` pairs, and this file drives six of those. They were governed by
 * nothing: a fixture list could be truncated to one member, or hand-picked at
 * three points on an axis with sixty-six branch points, and no count would move.
 *
 * WHAT THIS BUYS AND WHAT IT DOES NOT, because the gap is the honest part.
 * It makes every such list declared, classified as derived-from-a-domain or
 * hand-picked, and PINNED BY SIZE — so a truncation reports itself and a new
 * list has to be classified by a person. It does NOT make a hand-picked list
 * derived. FOUR of the six are hand-picked and their residual is written into
 * their own rows in the terms that matter: `CONTEXTS` samples a Gym Bucks
 * balance at three points while `gymBucks` files eighteen prices that balance
 * is compared against, so a mutant keyed on the fifteen it misses is invisible
 * and nothing in this file catches it.
 *
 * The census tables are listed separately because they are EXPECTATIONS rather
 * than inputs — pinning the size of a table of expected values would be pinning
 * the same thing twice — and the scan requires every declaration to be in
 * exactly one of the two lists, so a fixture cannot be filed as a census to
 * escape the size pin.
 */
interface FixtureList {
  readonly name: string;
  /** The `NUMERIC_DOMAINS` key its points come from, or null if hand-picked. */
  readonly derivedFrom: string | null;
  readonly size: number;
  readonly why: string;
}

const FIXTURE_LISTS: readonly FixtureList[] = Object.freeze([
  Object.freeze({
    name: 'STATES',
    derivedFrom: 'ROSTER_SHAPE',
    size: 85,
    why: 'One state per roster size in ROSTER_SHAPE crossed with every reputation tier boundary. Both axes are read out of the registry, so widening either widens this by construction rather than by an edit here.',
  }),
  Object.freeze({
    name: 'CLOCKS',
    derivedFrom: 'SECONDS',
    size: 166,
    why: 'One clock per point of the seconds domain, at a fixed skip. Derived, so the seconds domain losing its ceiling this round widened this list without anybody touching it.',
  }),
  Object.freeze({
    name: 'COLLECTION_CLOCKS',
    derivedFrom: null,
    size: 3,
    why: 'HAND-PICKED, three marks: at zero, half a day, and half a day with a purchased skip. It is a SHAPE list rather than a magnitude list — accrueProduction refuses a mark ahead of the gym clock, so what is being varied is which side of that refusal the mark falls on, and the magnitude axis beside it is CLOCKS, which is derived. The residual: a subject keyed on a specific collection mark is only reached if that mark is one of these three.',
  }),
  Object.freeze({
    name: 'CLOCK_SHAPES',
    derivedFrom: null,
    size: 3,
    why: 'HAND-PICKED, three clocks: zero, a day with no skip, and a day skewed by a build-timer ceiling of skip. Shapes rather than magnitudes, for the calls that take a clock and are otherwise cheap. The residual is the same as COLLECTION_CLOCKS and the magnitude cover is again CLOCKS.',
  }),
  Object.freeze({
    name: 'CONTEXTS',
    derivedFrom: null,
    size: 3,
    why: 'HAND-PICKED, AND THE WEAKEST LIST IN THE FILE. Three expansion contexts: broke, rich at the top space price, and mid-balance with builds running. Its Gym Bucks balance is 3 points against the 18 prices `gymBucks` files, every one of which is a `balance < price` branch, so a refusal keyed on the other fifteen is not reached and nothing here catches it. Making it a domain axis would multiply the drive by the Bucks domain and was not affordable this round; it is stated rather than fixed.',
  }),
  Object.freeze({
    name: 'SOCIAL_SHAPES',
    derivedFrom: null,
    size: 4,
    why: 'HAND-PICKED, four SHAPES of social input: shipped, no rival, no encouragements, and a later anchor day. Every one of them changes the STRUCTURE handed in — a null, an empty list, a moved anchor — rather than a magnitude, and the day magnitude axis it is crossed with is DAY_DOMAIN, which is derived. The residual: a fifth structural shape nobody thought of is not reached, and no scan can enumerate the shapes of an input the way a domain enumerates its magnitudes.',
  }),
]);

/**
 * The labelled lists that are expectations rather than inputs.
 *
 * Listed so the scan can require every declaration to be in exactly one of the
 * two registries. A fixture filed here would escape its size pin, which is why
 * the scan checks the partition rather than only the union.
 */
const CENSUS_LISTS: readonly string[] = Object.freeze([
  'AXIS_CENSUS',
  'DERIVED_THRESHOLDS',
  'DIAGNOSTIC_CHANNEL_CENSUS',
  'FOLD_TRIPWIRES',
  'KINDED_RETURN_CENSUS',
  'LITERAL_AXES',
  // The exception list for the numeric-domain scan. A declaration and not an
  // input: nothing is driven over it, which is what a row on it asserts.
  'NON_DOMAIN_NUMBER_LISTS',
  // The overflow pass's arm census. Registered here rather than in
  // FIXTURE_LISTS because it is what the pass PRODUCED and not what it was fed
  // — the same distinction KINDED_RETURN_CENSUS is on the strength of, one
  // pass over.
  'OVERFLOW_ARM_CENSUS',
]);

/**
 * Every (domain, exempt leaf) pair the ceilings drop, by name.
 *
 * Four pairs, all in ROSTER_SHAPE, all of them a value larger than any roster
 * this directory will admit. A count would let one be swapped for another; the
 * names are what a reader can disagree with.
 */
const EXEMPT_LEAVES_ABOVE_A_CEILING: readonly string[] = Object.freeze([
  'ROSTER_SHAPE/CHECK_IN_TARGET_SECONDS_MAX=60',
  'ROSTER_SHAPE/CHECK_IN_TARGET_SECONDS_MIN=30',
  'ROSTER_SHAPE/GYM_BUCKS_BASE_PER_HOUR=120',
  'ROSTER_SHAPE/NPC_GYM_BUCKS_PER_HOUR_BASE=40',
]);

/**
 * What the registry measured on this tree. Counts, not bounds.
 *
 * `CONTAINMENT_CHECKS` is the one that says the assertion below is not looping
 * over an empty registry or an empty obligation list — it is the number of
 * (domain, threshold) pairs actually checked, and a domain that declares no
 * units, no ceiling reach and no `alsoContains` would leave it short rather than
 * pass.
 *
 * `TUNING_NUMERIC_LEAVES` and `TUNING_STRING_LEAVES` are the population the
 * registry is joined against, so a knob added to `empireTuning.ts` moves a
 * number here before it moves anything downstream. `FILED` plus `EXEMPT` is
 * asserted to equal `TUNING_NUMERIC_LEAVES` in both directions; the three are
 * pinned separately so a leaf moving from one side to the other is visible
 * rather than netting out.
 */
const DOMAIN_CENSUS = Object.freeze({
  UNITS: 8,
  /** Labels in `UNIT_THRESHOLDS`, including the two derived seconds entries. */
  THRESHOLDS: 68,
  /** Numeric leaves of EMPIRE_TUNING filed under a unit. */
  FILED: 66,
  /** Numeric leaves on `NOT_A_BRANCH_POINT`. */
  EXEMPT: 34,
  TUNING_NUMERIC_LEAVES: 100,
  TUNING_STRING_LEAVES: 14,
  /** Distinct labels in `EVERY_BRANCH_POINT`: filed plus derived plus exempt. */
  BRANCH_POINTS: 102,
  DOMAINS: 6,
  CONTAINMENT_CHECKS: 478,
  /** Per domain, branch points above its ceiling and outside its units. */
  OMITTED_ABOVE_CEILING: Object.freeze({
    NUMBER: 0,
    SECONDS: 0,
    DAY: 39,
    COUNT: 39,
    LEVEL: 0,
    ROSTER_SHAPE: 56,
  }),
  /**
   * Module-level `readonly number[]` declarations in this file.
   *
   * Six registry aliases and one named exception — the tripwire's own point
   * list, which is not a subject's domain. `NON_DOMAIN_LISTS` is the second
   * number so the two cannot be traded off against each other silently.
   */
  ALIASES: 7,
  NON_DOMAIN_LISTS: 1,
  LITERAL_AXES: 8,
  LABELLED_LISTS: 14,
  HAND_PICKED_LISTS: 4,
  COST_ROWS: 3,
  COST_ROWS_THAT_DID_NOT_FINISH: 1,
  /** (domain, point) pairs the NUMBER-containment loop actually compares. */
  NUMBER_CONTAINMENT_CHECKS: 660,
  NUMBER_POINTS: 221,
  SECONDS_POINTS: 166,
  DAY_POINTS: 51,
  COUNT_POINTS: 55,
  LEVEL_POINTS: 150,
  ROSTER_SHAPE_POINTS: 17,
});

// ---------------------------------------------------------------------------
// Sentinels — the strings that prove a position was REACHED
// ---------------------------------------------------------------------------

/**
 * A unique, benign string per caller-supplied string position.
 *
 * These exist because every one of instrument A's five bare-string fields is
 * EMPTY on the obvious fixture: `createEmpireState()` returns
 * `roster: Object.freeze([])`, `createEmpireGym()` returns an empty `pending`,
 * and all eight fault functions are pinned at `[]` on healthy input. A driver
 * built on those would sample an empty string domain, pin an honest count of
 * zero banned names, and be vacuous in the exact shape CLAUDE.md names — "a
 * sweep whose generator never produces the failing case".
 *
 * So each position is fed a sentinel and `SENTINELS_OBSERVED` asserts, as a set
 * equality, that the walk found every one of them. A position that stops being
 * reachable reddens instead of quietly emptying.
 *
 * NO BANNED NAME IS EVER PASSED IN AS AN ARGUMENT, anywhere in this file. A
 * driver that feeds poison and then finds poison has measured its own fixture.
 * Every banned name the check reports was therefore produced by the subject.
 * The check that goes red if this stops holding is 'produces no banned name
 * from any export but the two that ARE the ban lists' — a re-read argument is
 * inside its domain, so poison handed in comes back out at it.
 *
 * That sentence is a guarantee and the tree-wide census in
 * `src/game/guaranteeTags.test.ts` does not count it, which is disclosed here
 * rather than acted on. Its trigger list is NEVER / CANNOT / ALWAYS / ONLY, and
 * this says "NO … EVER". Measured: this file contributes ZERO triggering runs
 * and twenty-seven capitalised runs of three words or more, so the pin at 225
 * is correct for what that scan measures and wrong about this paragraph.
 * Nothing here was rephrased in either direction to reach that number —
 * `guaranteeTags.test.ts` is outside this piece's scope and a synonym swap in
 * either direction is the evasion CLAUDE.md records twice already.
 */
const SENTINELS = Object.freeze({
  NPC_ID: 'sentinel-npc-id',
  NPC_DISPLAY_NAME: 'sentinel-npc-display-name',
  RECRUIT_ID: 'sentinel-recruit-id',
  RECRUIT_DISPLAY_NAME: 'sentinel-recruit-display-name',
  OWN_GYM_ID: 'sentinel-own-gym-id',
  OWN_GYM_DISPLAY_NAME: 'sentinel-own-gym-display-name',
  FRIEND_GYM_ID: 'sentinel-friend-gym-id',
  FRIEND_GYM_DISPLAY_NAME: 'sentinel-friend-gym-display-name',
  RIVAL_GYM_ID: 'sentinel-rival-gym-id',
  ENCOURAGEMENT_FROM: 'sentinel-encouragement-from-gym',
  FAULT_EQUIPMENT: 'sentinel-not-an-equipment-tier',
  FAULT_VISIT_GYM_ID: 'sentinel-unfriended-gym-id',
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ZERO_SECONDS: UnacceleratedSeconds = core.asUnacceleratedSeconds(0);

function booksAt(balance: number): WallClockBooks {
  const books: Partial<Record<WallClockFundedOutput, core.GymBucks>> = {};
  for (const output of core.WALL_CLOCK_FUNDED_OUTPUTS) books[output] = core.asGymBucks(balance);
  return Object.freeze(books as Record<WallClockFundedOutput, core.GymBucks>);
}

function axesAt(equipment: EquipmentTier, spaceLevel: number, staff: Record<StaffRole, number>): GymAxes {
  return Object.freeze({ equipment, spaceLevel, staffLevel: Object.freeze({ ...staff }) });
}

/**
 * Axes wide enough to hold the largest LEGAL roster.
 *
 * Not the largest roster the sweep builds: `ROSTER_SHAPE` straddles
 * `ROSTER_SLOTS_MAX` on both sides on purpose, so one of its points is one
 * lifter OVER capacity and `empireStateFaults` has something to say about it.
 * That is the branch a domain sampling only `[0, 1, ROSTER_SLOTS_MAX]` could
 * not reach, and it is why the diagnostic-channel census moved.
 */
const WIDE_AXES: GymAxes = axesAt(
  EMPIRE_TUNING.EQUIPMENT_TIERS[EMPIRE_TUNING.EQUIPMENT_TIERS.length - 1] as EquipmentTier,
  EMPIRE_TUNING.SPACE_LEVEL_MAX,
  {
    coach: EMPIRE_TUNING.STAFF_LEVEL_MAX.coach,
    spotter: EMPIRE_TUNING.STAFF_LEVEL_MAX.spotter,
    physio: EMPIRE_TUNING.STAFF_LEVEL_MAX.physio,
  },
);

const OPENING_AXES: GymAxes = axesAt(EMPIRE_TUNING.EQUIPMENT_TIERS[0] as EquipmentTier, 0, {
  coach: 0,
  spotter: 0,
  physio: 0,
});

function lifterAt(tier: NpcTier, index: number, joinedAt: number, settledAt: number): NpcLifter {
  return core.createNpcLifter(
    `${SENTINELS.NPC_ID}-${String(index)}`,
    tier,
    `${SENTINELS.NPC_DISPLAY_NAME}-${String(index)}`,
    joinedAt,
    settledAt,
  );
}

function rosterOf(size: number, joinedAt: number, settledAt: number): readonly NpcLifter[] {
  return Object.freeze(
    Array.from({ length: size }, (_unused, index) =>
      lifterAt(
        EMPIRE_TUNING.NPC_TIERS[index % EMPIRE_TUNING.NPC_TIERS.length] as NpcTier,
        index,
        joinedAt,
        settledAt,
      ),
    ),
  );
}

interface StateOptions {
  readonly reputation?: number;
  readonly gymBucks?: number;
  readonly settledGymBucks?: number;
  readonly rosterSize?: number;
  readonly elapsed?: number;
  readonly skipped?: number;
  readonly wide?: boolean;
}

function stateAt(options: StateOptions): EmpireState {
  const axes = options.wide === true ? WIDE_AXES : OPENING_AXES;
  const gymBucks = options.gymBucks ?? 0;
  return Object.freeze({
    clock: core.createEmpireClock(options.elapsed ?? 0, options.skipped ?? 0),
    axes,
    settledAxes: axes,
    roster: rosterOf(options.rosterSize ?? 0, 0, 0),
    reputation: core.asReputation(options.reputation ?? 0),
    gymBucks: core.asGymBucks(gymBucks),
    settledBooks: booksAt(options.settledGymBucks ?? gymBucks),
    ledger: Object.freeze([]),
    accelerants: Object.freeze([]),
  });
}

function snapshotAt(gymId: string, displayName: string, reputation: number, totalKg: number): GymSnapshot {
  return Object.freeze({
    gymId: core.asGymId(gymId),
    displayName: core.asDisplayName(displayName),
    reputation,
    combinedTotalKg: totalKg,
  });
}

function completedBuild(axis: ExpansionAxis, toLevel: number): ExpansionBuild {
  return Object.freeze({
    axis,
    toLevel,
    paid: core.asGymBucks(0),
    startedAt: ZERO_SECONDS,
    settledCompletion: ZERO_SECONDS,
    idleCompletion: core.asAcceleratedSeconds(0),
  });
}

function contextAt(gymBucks: number, reputation: number, builds: readonly ExpansionBuild[]): ExpansionContext {
  return Object.freeze({
    clock: core.createEmpireClock(0, 0),
    gymBucks: core.asGymBucks(gymBucks),
    settledBooks: booksAt(gymBucks),
    reputation: core.asReputation(reputation),
    builds,
  });
}

/**
 * An `AppliedAccelerant` for an accelerant known only at runtime.
 *
 * `applyAccelerant` refuses a widened accelerant type on purpose, so a loop
 * cannot call it. The switch re-narrows per arm; the same shape exists in
 * `expansion.test.ts` and is reproduced rather than imported because that file
 * does not export it.
 */
function appliedFor(
  accelerant: EmpireAccelerant,
  output: EmpireOutput,
  at: UnacceleratedSeconds,
  seconds: number,
): AppliedAccelerant {
  switch (accelerant) {
    case 'gym-empire-timer-skip':
      return core.applyAccelerant('gym-empire-timer-skip', output as AccelerableOutput<'gym-empire-timer-skip'>, at, seconds);
    case 'rewarded-ad-timer-skip':
      return core.applyAccelerant('rewarded-ad-timer-skip', output as AccelerableOutput<'rewarded-ad-timer-skip'>, at, seconds);
    case 'coach-staff-level':
      return core.applyAccelerant('coach-staff-level', output as AccelerableOutput<'coach-staff-level'>, at, seconds);
    case 'space-level':
      return core.applyAccelerant('space-level', output as AccelerableOutput<'space-level'>, at, seconds);
    case 'reputation-tier':
      return core.applyAccelerant('reputation-tier', output as AccelerableOutput<'reputation-tier'>, at, seconds);
  }
}

function acceleratedFor(accelerant: EmpireAccelerant, output: EmpireOutput): core.AcceleratedOutput {
  switch (accelerant) {
    case 'gym-empire-timer-skip':
      return core.acceleratedOutput('gym-empire-timer-skip', output as AccelerableOutput<'gym-empire-timer-skip'>);
    case 'rewarded-ad-timer-skip':
      return core.acceleratedOutput('rewarded-ad-timer-skip', output as AccelerableOutput<'rewarded-ad-timer-skip'>);
    case 'coach-staff-level':
      return core.acceleratedOutput('coach-staff-level', output as AccelerableOutput<'coach-staff-level'>);
    case 'space-level':
      return core.acceleratedOutput('space-level', output as AccelerableOutput<'space-level'>);
    case 'reputation-tier':
      return core.acceleratedOutput('reputation-tier', output as AccelerableOutput<'reputation-tier'>);
  }
}

const CALENDAR_ANCHOR = 0;

function calendarAt(anchorDay: number): SocialCalendarContext {
  return Object.freeze({
    anchorDay: socialModule.asCalendarDay(anchorDay),
    trainedDays: Object.freeze(
      [1, 3, 4, 8, 13, 21].map((day) => socialModule.asCalendarDay(anchorDay + day)),
    ),
    sessionCount: EMPIRE_TUNING.ROSTER_SLOTS_MAX,
    streakDays: EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS,
    passTiersUnlocked: EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED,
  });
}

function encouragementsAt(anchorDay: number): readonly Encouragement[] {
  return Object.freeze(
    [2, 5, 5, 11].map((day, at) =>
      Object.freeze({
        day: socialModule.asCalendarDay(anchorDay + day),
        fromGymId: core.asGymId(`${SENTINELS.ENCOURAGEMENT_FROM}-${String(Math.floor(at / 2))}`),
      }),
    ),
  );
}

const FRIENDS: readonly GymSnapshot[] = Object.freeze([
  snapshotAt(`${SENTINELS.FRIEND_GYM_ID}-0`, `${SENTINELS.FRIEND_GYM_DISPLAY_NAME}-0`, 0, 0),
  snapshotAt(
    `${SENTINELS.FRIEND_GYM_ID}-1`,
    `${SENTINELS.FRIEND_GYM_DISPLAY_NAME}-1`,
    EMPIRE_TUNING.REPUTATION_MAX,
    EMPIRE_TUNING.RIVAL_REWARD_GYM_BUCKS,
  ),
]);

const OWN_GYM: GymSnapshot = snapshotAt(
  SENTINELS.OWN_GYM_ID,
  SENTINELS.OWN_GYM_DISPLAY_NAME,
  EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS[1] as number,
  0,
);

const RIVAL_GYM: GymSnapshot = snapshotAt(
  SENTINELS.RIVAL_GYM_ID,
  `${SENTINELS.FRIEND_GYM_DISPLAY_NAME}-rival`,
  EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS[2] as number,
  0,
);

function socialContextAt(visitDays: readonly number[]): SocialContext {
  return Object.freeze({
    ownGym: OWN_GYM,
    calendar: calendarAt(CALENDAR_ANCHOR),
    friends: FRIENDS,
    visits: Object.freeze(
      visitDays.map((day, index) =>
        Object.freeze({
          day: socialModule.asCalendarDay(day),
          gymId: core.asGymId(`${SENTINELS.FRIEND_GYM_ID}-${String(index % FRIENDS.length)}`),
          encouraged: index % 2 === 0,
        }),
      ),
    ),
    encouragementsReceived: encouragementsAt(CALENDAR_ANCHOR),
    rival: RIVAL_GYM,
  });
}

function socialInputsAt(): SocialInputs {
  return Object.freeze({
    calendar: calendarAt(CALENDAR_ANCHOR),
    rival: RIVAL_GYM,
    encouragementsReceived: encouragementsAt(CALENDAR_ANCHOR),
  });
}

function policyAt(checkInsPerDay: number): EmpirePolicy {
  return Object.freeze({
    checkInsPerDay,
    axisOrder: Object.freeze([...expansionModule.EXPANSION_AXES]),
    leaderboardMetric: 'reputation',
  });
}

function planAt(accelerant: core.PurchasableAccelerant | null, grantsPerCheckIn: number): invariant.AccelerantPlan {
  return Object.freeze({ accelerant, grantsPerCheckIn, firstCheckIn: 1, everyNthCheckIn: 1 });
}

function historyAt(slots: number, everyNth: number): EngagementHistory {
  return engagementModule.historyFrom(
    slots,
    (slot) => slot % everyNth === 0,
    [1, 3, 4, 8, 13],
  );
}

function entryAt(day: number, output: EmpireOutput, amount: number): EmpireDayEntry {
  return Object.freeze({ day, at: core.asUnacceleratedSeconds(day * EMPIRE_TUNING.SECONDS_PER_DAY), output, amount });
}

// ---------------------------------------------------------------------------
// The drive
// ---------------------------------------------------------------------------

interface DrivenRow {
  readonly export: string;
  readonly point: string;
  /** The return (or the thrown payload), then every argument, re-read AFTER the call. */
  readonly values: readonly unknown[];
  /**
   * The `NUMERIC_DOMAINS` key whose points this row was driven at, for the
   * domains that carry a ceiling — or null.
   *
   * This is the field the overflow pass joins on, and it exists because the
   * alternative was a hand-written list. A subject added to a ceilinged
   * domain's loop below stamps itself here, and the overflow pass's subject
   * list is asserted set-equal to what is stamped, in both directions. A
   * source scan for the loop's text would have been the other option and is
   * the instrument this file already records losing on the axis it was not
   * written about.
   */
  readonly axis: string | null;
}

const DRIVEN_ROWS: DrivenRow[] = [];

/**
 * The ceilinged domain whose points the drive is currently walking.
 *
 * Written by `driveEverything` immediately around the loops that read a
 * ceilinged domain, and read by `drive` and `read`. Only the domains that
 * carry a ceiling are stamped: the other three omit nothing, so an overflow
 * subject list for them would be a list with no points to drive. 'stamps
 * exactly the domains that carry a ceiling' pins that correspondence in both
 * directions, so a domain gaining a ceiling reddens until its loop is stamped.
 */
let drivingAxis: string | null = null;

/**
 * Call one export at one domain point and keep everything it could have
 * written to.
 *
 * The arguments are pushed AFTER the call rather than copied before it, so a
 * value delivered by mutating a caller-supplied sink — attack shape 13's second
 * half — is inside the scan. Nothing passed in ever contains a banned name, so
 * a banned name found in an argument was written there by the subject.
 *
 * A THROWN PAYLOAD LANDS IN `values[0]`, WHICH IS WHY THE CHANNEL CENSUS BELOW
 * CAN CALL THE DRIVE THE THROW CHANNEL'S ONE CATCHER. Normal completion and
 * abrupt completion arrive at the same slot and are scanned by the same walker,
 * so the region label says `return` for both. `THROWN_ROWS` in
 * `CHANNEL_REACH_CENSUS` is what says the abrupt half is not empty.
 *
 * SPLIT OUT OF `drive` SO THE PROBE ROWS ARE NOT A SECOND PRODUCER. The channel
 * coverage matrix builds rows for probes that must never enter `DRIVEN_ROWS`,
 * and a hand-rolled row beside this one is CLAUDE.md's sibling defect exactly:
 * two arms of one decision written twice, differing in the way nobody looks at.
 */
function rowFor(
  exportName: string,
  point: string,
  thunk: () => unknown,
  args: readonly unknown[] = [],
): DrivenRow {
  const values: unknown[] = [];
  try {
    values.push(thunk());
  } catch (error) {
    values.push(error);
  }
  values.push(...args);
  return { export: exportName, point, values, axis: drivingAxis };
}

/** The same row, kept for the census. The only writer of `DRIVEN_ROWS` but one. */
function drive(exportName: string, point: string, thunk: () => unknown, args: readonly unknown[] = []): void {
  DRIVEN_ROWS.push(rowFor(exportName, point, thunk, args));
}

/** Read an exported constant and keep it, so exported DATA is a subject too. */
function read(exportName: string, value: unknown): void {
  DRIVEN_ROWS.push({ export: exportName, point: 'read', values: [value], axis: drivingAxis });
}

/**
 * The values fed to the `unknown`-taking decoders.
 *
 * Deliberately WITHOUT any banned name. Feeding a decoder its own poison and
 * then finding the poison in the re-read argument measures the fixture, not the
 * subject.
 */
const DECODER_PROBES: readonly unknown[] = Object.freeze([
  ...core.EMPIRE_OUTPUTS,
  ...core.EMPIRE_ACCELERANTS,
  ...socialModule.SOCIAL_SURFACES,
  ...expansionModule.EXPANSION_AXES,
  ...socialModule.LEADERBOARD_METRICS,
  SENTINELS.FAULT_EQUIPMENT,
  '',
  0,
  1,
  true,
  null,
  undefined,
  Object.freeze({ kind: SENTINELS.NPC_ID }),
  Object.freeze([SENTINELS.NPC_ID]),
]);

/** A ledger with one entry per payable output, so the splitters see both reaches. */
const LEDGER: readonly core.EmpireLedgerEntry[] = Object.freeze(
  core.EMPIRE_OUTPUTS.map((output, index) =>
    Object.freeze({ at: core.asUnacceleratedSeconds(index), output, amount: index }),
  ),
);

const DAY_LEDGER: readonly EmpireDayEntry[] = Object.freeze(
  core.EMPIRE_OUTPUTS.map((output, index) => entryAt(index, output, index)),
);

/** The states the sweep drives, shaped on the roster axis and the reputation axis. */
const STATES: readonly (readonly [string, EmpireState])[] = Object.freeze(
  ROSTER_SHAPES.flatMap((rosterSize) =>
    EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS.map(
      (reputation) =>
        [
          `roster=${String(rosterSize)}/rep=${String(reputation)}`,
          stateAt({
            rosterSize,
            reputation,
            gymBucks: EMPIRE_TUNING.RIVAL_REWARD_GYM_BUCKS,
            wide: true,
            elapsed: EMPIRE_TUNING.SECONDS_PER_DAY,
            skipped: EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
          }),
        ] as const,
    ),
  ),
);

/**
 * A state that is deliberately faulted, so the diagnostic channel is not empty.
 *
 * `empireStateFaults` is pinned at `[]` on every legal state, so a driver that
 * only ever handed it legal states would sample an empty string domain. The
 * equipment tier carries a sentinel, which lands in a fault message verbatim —
 * that is how `SENTINELS_OBSERVED` measures the channel as REACHED rather than
 * assuming it.
 */
const FAULTED_STATE: EmpireState = Object.freeze({
  ...stateAt({ rosterSize: 1, wide: true }),
  axes: Object.freeze({
    equipment: SENTINELS.FAULT_EQUIPMENT as unknown as EquipmentTier,
    spaceLevel: WIDE_AXES.spaceLevel,
    staffLevel: WIDE_AXES.staffLevel,
  }),
});

const CLOCKS: readonly (readonly [string, EmpireClock])[] = Object.freeze(
  SECONDS_DOMAIN.map(
    (elapsed) =>
      [`elapsed=${String(elapsed)}`, core.createEmpireClock(elapsed, EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT)] as const,
  ),
);

/**
 * Collection marks that sit at or behind every state in `STATES`.
 *
 * `accrueProduction` refuses a mark ahead of the gym's own idle clock, so the
 * axis measurement needs points it will actually answer at. The driver above
 * uses the wider `CLOCK_SHAPES` on purpose and keeps the refusals.
 */
const COLLECTION_CLOCKS: readonly (readonly [string, EmpireClock])[] = Object.freeze([
  ['at-zero', core.createEmpireClock(0, 0)],
  ['half-day', core.createEmpireClock(EMPIRE_TUNING.SECONDS_PER_DAY / 2, 0)],
  [
    'half-day-skipped',
    core.createEmpireClock(EMPIRE_TUNING.SECONDS_PER_DAY / 2, EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT),
  ],
]);

/** One clock per shape, for the calls that take a clock and are otherwise cheap. */
const CLOCK_SHAPES: readonly (readonly [string, EmpireClock])[] = Object.freeze([
  ['zero', core.createEmpireClock(0, 0)],
  ['no-skip', core.createEmpireClock(EMPIRE_TUNING.SECONDS_PER_DAY, 0)],
  ['skewed', core.createEmpireClock(EMPIRE_TUNING.SECONDS_PER_DAY, EMPIRE_TUNING.BUILD_SECONDS_MAX)],
]);

const BUILDS: readonly ExpansionBuild[] = Object.freeze(
  expansionModule.EXPANSION_AXES.map((axis) => completedBuild(axis, 1)),
);

const CONTEXTS: readonly (readonly [string, ExpansionContext])[] = Object.freeze([
  ['broke', contextAt(0, 0, [])],
  ['rich', contextAt(EMPIRE_TUNING.SPACE_LEVEL_COST_GYM_BUCKS[EMPIRE_TUNING.SPACE_LEVEL_COST_GYM_BUCKS.length - 1] as number, EMPIRE_TUNING.REPUTATION_MAX, [])],
  ['building', contextAt(EMPIRE_TUNING.RIVAL_REWARD_GYM_BUCKS, EMPIRE_TUNING.REPUTATION_MAX, BUILDS)],
]);

/**
 * Check-ins per calendar day the composed drivers run at.
 *
 * Six is a four-hour gap, which is inside GDD §5.1's offline horizon and is the
 * cadence `empireSweep.test.ts` already parameterises its own runs at. Named
 * here rather than shared because that file's constant is a sweep parameter for
 * a different measurement and this one should be tunable on its own.
 */
const EMPIRE_SWEEP_CHECK_INS_PER_DAY = 6;

/** How many check-ins `stepGym` is walked for, so a recruit can start and land. */
const STEP_COUNT = EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS * EMPIRE_SWEEP_CHECK_INS_PER_DAY;

/**
 * Runs and a context that are deliberately faulted, so the diagnostic channel
 * has a non-empty domain.
 *
 * Every fault function is pinned at `[]` on healthy input by the tests that
 * already exist, so without these three the whole diagnostic channel would be
 * swept at zero strings and its exemption from the containment check would be
 * an exemption from nothing.
 */
/*
 * BUILT LAZILY, AND THE REASON IS A MEASURED FAILURE OF THIS FILE RATHER THAN A
 * STYLE PREFERENCE.
 *
 * Both of these run the whole engine. While they were module-level `const`s, a
 * planted mutant that made `runEmpire` throw took the file down at IMPORT time
 * — vitest reported `Test Files 1 failed / Tests no tests` and a stack in
 * `assertEmpireState`, with not one of this file's twenty-two checks named.
 * The mutant WAS caught, and the output said nothing about which guarantee had
 * broken. CLAUDE.md's rule is that a check which bites but fails uselessly is
 * half a check, so the engine calls happen inside `driveEverything`, where a
 * throw fails a named test instead of a whole suite.
 */
let faultedRunMemo: invariant.EmpireRun | null = null;

function faultedRun(): invariant.EmpireRun {
  if (faultedRunMemo === null) {
    faultedRunMemo = Object.freeze({
      ...invariant.runEmpire(1, policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY), planAt(null, 0), socialInputsAt()),
      ledger: Object.freeze([]),
    });
  }
  return faultedRunMemo;
}

let faultedEngagementRunMemo: engagementModule.EngagementRun | null = null;

function faultedEngagementRun(): engagementModule.EngagementRun {
  if (faultedEngagementRunMemo === null) {
    faultedEngagementRunMemo = Object.freeze({
      ...engagementModule.runEngagement(
        1,
        policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY),
        historyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY, 1),
        socialInputsAt(),
      ),
      ledger: Object.freeze([]),
    });
  }
  return faultedEngagementRunMemo;
}

const FAULTED_SOCIAL_CONTEXT: SocialContext = Object.freeze({
  ...socialContextAt([]),
  visits: Object.freeze([
    Object.freeze({
      day: socialModule.asCalendarDay(CALENDAR_ANCHOR),
      gymId: core.asGymId(SENTINELS.FAULT_VISIT_GYM_ID),
      encouraged: false,
    }),
  ]),
});

let drivenMemo = false;

function driveEverything(): readonly DrivenRow[] {
  if (drivenMemo) return DRIVEN_ROWS;
  drivenMemo = true;

  // --- every exported CONSTANT, read directly. Attack shape 12 lives here.
  for (const namespace of Object.values(MODULE_NAMESPACES)) {
    for (const [name, value] of Object.entries(namespace)) {
      if (typeof value === 'function') continue;
      read(name, value);
    }
  }

  // --- empireCore.ts
  for (const output of core.EMPIRE_OUTPUTS) drive('outputReach', output, () => core.outputReach(output));
  for (const accelerant of core.EMPIRE_ACCELERANTS) {
    drive('accelerantLicence', accelerant, () => core.accelerantLicence(accelerant));
    for (const output of core.EMPIRE_OUTPUTS) {
      drive('mayAccelerate', `${accelerant}/${output}`, () => core.mayAccelerate(accelerant, output));
      drive('acceleratedOutput', `${accelerant}/${output}`, () => acceleratedFor(accelerant, output));
      for (const seconds of NUMBER_DOMAIN) {
        drive('applyAccelerant', `${accelerant}/${output}/${String(seconds)}`, () =>
          appliedFor(accelerant, output, ZERO_SECONDS, seconds),
        );
      }
    }
  }
  for (const probe of DECODER_PROBES) {
    const label = String(typeof probe === 'object' ? JSON.stringify(probe) : probe);
    drive('isEmpireOutput', label, () => core.isEmpireOutput(probe), [probe]);
    drive('isEmpireAccelerant', label, () => core.isEmpireAccelerant(probe), [probe]);
    drive('isPurchasableAccelerant', label, () => core.isPurchasableAccelerant(probe), [probe]);
    drive('isProgressionReachingOutput', label, () => core.isProgressionReachingOutput(probe), [probe]);
    drive('isExpansionAxis', label, () => expansionModule.isExpansionAxis(probe), [probe]);
    drive('isSocialSurface', label, () => socialModule.isSocialSurface(probe), [probe]);
    drive('isLeaderboardMetric', label, () => socialModule.isLeaderboardMetric(probe), [probe]);
  }
  drive('empireVocabularyFaults', 'zero-arg', () => core.empireVocabularyFaults());
  drive('expansionVocabularyFaults', 'zero-arg', () => expansionModule.expansionVocabularyFaults());
  drive('reputationVocabularyFaults', 'zero-arg', () => reputationModule.reputationVocabularyFaults());
  drive('socialVocabularyFaults', 'zero-arg', () => socialModule.socialVocabularyFaults());
  for (const point of NUMBER_DOMAIN) {
    const label = String(point);
    drive('asGymBucks', label, () => core.asGymBucks(point));
    drive('asReputation', label, () => core.asReputation(point));
    drive('asTrainingIq', label, () => core.asTrainingIq(point));
    drive('asInjuryDaysSaved', label, () => core.asInjuryDaysSaved(point));
    drive('asUnacceleratedSeconds', label, () => core.asUnacceleratedSeconds(point));
    drive('asAcceleratedSeconds', label, () => core.asAcceleratedSeconds(point));
    drive('asIdleTenureDays', label, () => core.asIdleTenureDays(point));
    drive('asCalendarDay', label, () => socialModule.asCalendarDay(point));
    drive('reputationTierFloor', label, () => reputationModule.reputationTierFloor(point));
    drive('spaceLevelCost', label, () => core.spaceLevelCost(point));
    drive('buildSeconds', label, () => core.buildSeconds(point));
    drive('scrubPrecision', label, () => productionModule.scrubPrecision(point));
    drive('quantiseElapsedSeconds', label, () => productionModule.quantiseElapsedSeconds(point));
    drive('bankableOfflineSeconds', label, () => productionModule.bankableOfflineSeconds(point));
    for (const role of EMPIRE_TUNING.STAFF_ROLES) {
      drive('staffLevelCost', `${role}/${label}`, () => core.staffLevelCost(role, point));
    }
  }
  for (const identifier of [SENTINELS.NPC_ID, SENTINELS.RECRUIT_ID, SENTINELS.OWN_GYM_ID]) {
    drive('asNpcId', identifier, () => core.asNpcId(identifier), [identifier]);
    // The three string brands added this round, driven on the same axis as
    // their sibling rather than on one of their own. They are the constructor
    // route the brands cannot type away, so instrument B is what reads what
    // they hand back — and `refuseForbiddenName` is what makes them throw
    // instead of handing anything back at all when the argument is a banned
    // name. `refuses every banned name at every string brand constructor` is
    // where that is driven; this is the benign half.
    drive('asGymId', identifier, () => core.asGymId(identifier), [identifier]);
    drive('asDisplayName', identifier, () => core.asDisplayName(identifier), [identifier]);
    drive('asFaultMessage', identifier, () => core.asFaultMessage(identifier), [identifier]);
    // The throw wrap, driven on the same axis. It always completes abruptly, so
    // every row it produces is a thrown payload — which `drive` keeps in
    // `values[0]` exactly as it keeps a return, and which is why the sentinel
    // has to come back out through the scan for the row to be worth anything.
    drive('refuseWith', identifier, () => core.refuseWith(identifier), [identifier]);
  }
  for (const now of SECONDS_DOMAIN) {
    const times = SECONDS_DOMAIN.slice(0, 4).map((seconds) => core.asUnacceleratedSeconds(seconds));
    drive('settledLevel', String(now), () => core.settledLevel(times, core.asUnacceleratedSeconds(now)), [times]);
    drive('physioDaysSavedFor', String(now), () =>
      core.physioDaysSavedFor(core.settledLevel(times, core.asUnacceleratedSeconds(now))),
    );
  }
  for (const elapsed of SECONDS_DOMAIN) {
    drive('createEmpireClock', String(elapsed), () => core.createEmpireClock(elapsed, elapsed));
  }
  for (const [label, clock] of CLOCK_SHAPES) {
    for (const output of core.EMPIRE_OUTPUTS) {
      drive('elapsedFor', `${label}/${output}`, () => core.elapsedFor(clock, output));
    }
    for (const output of core.GATING_OUTPUTS) {
      drive('gateTarget', output, () => core.gateTarget(output));
      drive('gateElapsedFor', `${label}/${output}`, () => core.gateElapsedFor(clock, output));
    }
    drive('rosterRatesAt', label, () => invariant.rosterRatesAt(clock));
  }
  for (const tier of EMPIRE_TUNING.NPC_TIERS) {
    for (const seconds of SECONDS_DOMAIN.slice(0, 6)) {
      drive('createNpcLifter', `${tier}/${String(seconds)}`, () => lifterAt(tier, 0, seconds, seconds));
    }
    drive('recruitCost', tier, () => core.recruitCost(tier));
    drive('recruitReputationThreshold', tier, () => core.recruitReputationThreshold(tier));
    drive('recruitSeconds', tier, () => core.recruitSeconds(tier));
    drive('npcTierOutputMultiplier', tier, () => npcModule.npcTierOutputMultiplier(tier));
    drive('recruitmentQuote', tier, () => recruitmentModule.recruitmentQuote(tier));
    drive('npcTierUnlockKey', tier, () => reputationModule.npcTierUnlockKey(tier));
    for (const [label, clock] of CLOCK_SHAPES) {
      drive('recruitmentSchedule', `${tier}/${label}`, () => recruitmentModule.recruitmentSchedule(tier, clock));
    }
  }
  {
    const lifter = lifterAt('legendary', 0, 0, 0);
    for (const [label, clock] of CLOCKS) {
      drive('idleTenureDays', label, () => core.idleTenureDays(lifter, clock.accelerated));
      drive('settledTenureDays', label, () => core.settledTenureDays(lifter, clock.unaccelerated));
      drive('npcGymBucksPerHour', label, () => npcModule.npcGymBucksPerHour(lifter, clock));
      drive('npcTrainingIqPerDay', label, () => npcModule.npcTrainingIqPerDay(lifter, clock));
      drive('npcOutputRates', label, () => npcModule.npcOutputRates(lifter, clock));
      drivingAxis = 'ROSTER_SHAPE';
      for (const size of ROSTER_SHAPES) {
        const roster = rosterOf(size, 0, 0);
        drive('rosterGymBucksPerHour', `${label}/${String(size)}`, () => npcModule.rosterGymBucksPerHour(roster, clock), [roster]);
        drive('rosterTrainingIqPerDay', `${label}/${String(size)}`, () => npcModule.rosterTrainingIqPerDay(roster, clock), [roster]);
        drive('rosterOutputRates', `${label}/${String(size)}`, () => npcModule.rosterOutputRates(roster, clock), [roster]);
      }
      drivingAxis = null;
      drive('settledLoyaltyMultiplier', label, () =>
        npcModule.settledLoyaltyMultiplier(core.settledTenureDays(lifter, clock.unaccelerated)),
      );
    }
    for (const days of NUMBER_DOMAIN) {
      drive('idleLoyaltyMultiplier', String(days), () => npcModule.idleLoyaltyMultiplier(core.asIdleTenureDays(days)));
    }
  }
  for (const equipment of EMPIRE_TUNING.EQUIPMENT_TIERS) {
    drive('equipmentTierCost', equipment, () => core.equipmentTierCost(equipment));
    for (const spaceLevel of LEVEL_DOMAIN) {
      const axes = axesAt(equipment, spaceLevel, { coach: 0, spotter: 1, physio: 1 });
      drive('rosterCapacity', `${equipment}/${String(spaceLevel)}`, () => core.rosterCapacity(axes), [axes]);
      for (const axis of expansionModule.EXPANSION_AXES) {
        drive('axisLevel', `${equipment}/${axis}`, () => expansionModule.axisLevel(axes, axis), [axes]);
        drive('quoteExpansion', `${equipment}/${axis}`, () => expansionModule.quoteExpansion(axes, axis), [axes]);
      }
    }
  }
  for (const reputation of NUMBER_DOMAIN) {
    let points: core.ReputationPoints;
    try {
      points = core.asReputation(reputation);
    } catch {
      continue;
    }
    drive('reputationTierIndex', String(reputation), () => core.reputationTierIndex(points));
    drive('milestonesReached', String(reputation), () => reputationModule.milestonesReached(points));
    drive('nextMilestone', String(reputation), () => reputationModule.nextMilestone(points));
    drive('sponsorGymBucksPerDay', String(reputation), () => reputationModule.sponsorGymBucksPerDay(points));
  }
  drive('progressionLedger', 'full', () => core.progressionLedger(LEDGER), [LEDGER]);
  drive('idleLedger', 'full', () => core.idleLedger(LEDGER), [LEDGER]);
  drive('createEmpireState', 'zero-arg', () => core.createEmpireState());
  drivingAxis = 'ROSTER_SHAPE';
  for (const [label, state] of STATES) {
    drive('empireStateFaults', label, () => core.empireStateFaults(state), [state]);
    drive('assertEmpireState', label, () => core.assertEmpireState(state), [state]);
    drive('composeTrainingIqRate', label, () => invariant.composeTrainingIqRate(state, state.clock), [state]);
    drive('expansionContext', label, () => expansionModule.expansionContext(state, BUILDS), [state]);
    drive('recruitmentBoard', label, () => recruitmentModule.recruitmentBoard(state), [state]);
    drive('npcTierUnlocks', label, () => reputationModule.npcTierUnlocks(state), [state]);
    drive('unlockedNpcTiers', label, () => reputationModule.unlockedNpcTiers(state), [state]);
    drive('topNpcTierUnlocked', label, () => reputationModule.topNpcTierUnlocked(state), [state]);
    drive('reputationRates', label, () => reputationModule.reputationRates(state, state.clock), [state]);
    for (const tier of EMPIRE_TUNING.NPC_TIERS) {
      drive('recruitmentRefusals', `${label}/${tier}`, () => recruitmentModule.recruitmentRefusals(state, tier), [state]);
      drive('mayRecruit', `${label}/${tier}`, () => recruitmentModule.mayRecruit(state, tier), [state]);
      drive('recruitmentOffer', `${label}/${tier}`, () => recruitmentModule.recruitmentOffer(state, tier), [state]);
      drive('beginRecruitment', `${label}/${tier}`, () => recruitmentModule.beginRecruitment(state, tier), [state]);
      const schedule = recruitmentModule.recruitmentSchedule(tier, state.clock);
      drive('completeRecruitment', `${label}/${tier}`, () =>
        recruitmentModule.completeRecruitment(state, schedule, SENTINELS.RECRUIT_ID, SENTINELS.RECRUIT_DISPLAY_NAME),
        [state, schedule, SENTINELS.RECRUIT_ID, SENTINELS.RECRUIT_DISPLAY_NAME],
      );
    }
    for (const [clockLabel, clock] of CLOCK_SHAPES) {
      const rates = invariant.rosterRatesAt(clock);
      drive('gymBucksRatePerHour', `${label}/${clockLabel}`, () => productionModule.gymBucksRatePerHour(state, clock, rates), [state, rates]);
      drive('trainingIqRatePerDay', `${label}/${clockLabel}`, () => productionModule.trainingIqRatePerDay(state, clock, rates), [state, rates]);
      drive('productionRates', `${label}/${clockLabel}`, () => productionModule.productionRates(state, clock, rates), [state, rates]);
      drive('accrueProduction', `${label}/${clockLabel}`, () => productionModule.accrueProduction(state, clock, rates), [state, rates]);
      drive('accrueSponsorship', `${label}/${clockLabel}`, () => reputationModule.accrueSponsorship(state, clock), [state]);
      for (const checkIns of NUMBER_DOMAIN) {
        drive('accrueReputation', `${label}/${clockLabel}/${String(checkIns)}`, () =>
          reputationModule.accrueReputation(state, clock, checkIns), [state],
        );
      }
    }
  }
  drivingAxis = null;
  drive('empireStateFaults', 'faulted', () => core.empireStateFaults(FAULTED_STATE), [FAULTED_STATE]);
  drive('assertEmpireState', 'faulted', () => core.assertEmpireState(FAULTED_STATE), [FAULTED_STATE]);
  drive('offlineBankingHorizonSeconds', 'zero-arg', () => productionModule.offlineBankingHorizonSeconds());
  drive('settledGymBucksRatePerHour', 'zero-arg', () => productionModule.settledGymBucksRatePerHour());
  drive('reputationTierCount', 'zero-arg', () => reputationModule.reputationTierCount());
  drive('highestReputationTierIndex', 'zero-arg', () => reputationModule.highestReputationTierIndex());
  drive('reputationMilestones', 'zero-arg', () => reputationModule.reputationMilestones());
  drive('topNpcTier', 'zero-arg', () => reputationModule.topNpcTier());
  drive('reputationCensus', 'zero-arg', () => reputationModule.reputationCensus());
  drive('emptyEngagementTally', 'zero-arg', () => engagementModule.emptyEngagementTally());
  drive('shippedEngagementWiring', 'zero-arg', () => engagementModule.shippedEngagementWiring());
  drive('createEmpireGym', 'zero-arg', () => invariant.createEmpireGym());

  // --- expansion.ts
  for (const axis of expansionModule.EXPANSION_AXES) {
    drive('isStaffAxis', axis, () => expansionModule.isStaffAxis(axis));
    drive('axisOutput', axis, () => expansionModule.axisOutput(axis));
    drive('axisBook', axis, () => expansionModule.axisBook(axis));
    drive('axisClockFamily', axis, () => expansionModule.axisClockFamily(axis));
    drive('axisCeiling', axis, () => expansionModule.axisCeiling(axis));
    for (const level of NUMBER_DOMAIN) {
      const label = `${axis}/${String(level)}`;
      drive('axisLevelCost', label, () => expansionModule.axisLevelCost(axis, level));
      drive('axisReputationRule', label, () => expansionModule.axisReputationRule(axis, level));
      drive('axisReputationRequirement', label, () => expansionModule.axisReputationRequirement(axis, level));
      drive('axisBuildSeconds', label, () => expansionModule.axisBuildSeconds(axis, level));
    }
    for (const [label, context] of CONTEXTS) {
      drive('expansionVerdict', `${label}/${axis}`, () => expansionModule.expansionVerdict(context, axis), [context]);
      drive('startExpansion', `${label}/${axis}`, () => expansionModule.startExpansion(context, axis), [context]);
      drive('savingForPhysio', `${label}/${axis}`, () =>
        invariant.savingForPhysio(expansionModule.EXPANSION_AXES, context), [context],
      );
    }
    for (const seconds of SECONDS_DOMAIN) {
      drive('buildInFlight', `${axis}/${String(seconds)}`, () =>
        expansionModule.buildInFlight(BUILDS, axis, core.asAcceleratedSeconds(seconds)), [BUILDS],
      );
      drive('settledBuildInFlight', `${axis}/${String(seconds)}`, () =>
        expansionModule.settledBuildInFlight(BUILDS, axis, core.asUnacceleratedSeconds(seconds)), [BUILDS],
      );
      drive('settledAxisLevel', `${axis}/${String(seconds)}`, () =>
        expansionModule.settledAxisLevel(BUILDS, axis, core.asUnacceleratedSeconds(seconds)), [BUILDS],
      );
    }
  }
  for (const seconds of SECONDS_DOMAIN) {
    drive('idleAxesAt', String(seconds), () => expansionModule.idleAxesAt(BUILDS, core.asAcceleratedSeconds(seconds)), [BUILDS]);
    drive('settledAxesAt', String(seconds), () => expansionModule.settledAxesAt(BUILDS, core.asUnacceleratedSeconds(seconds)), [BUILDS]);
    drive('physioDaysSavedAt', String(seconds), () => expansionModule.physioDaysSavedAt(BUILDS, core.asUnacceleratedSeconds(seconds)), [BUILDS]);
  }
  for (const [label, context] of CONTEXTS) {
    for (const book of expansionModule.EMPIRE_BOOKS) {
      drive('bookBalance', `${label}/${book}`, () => expansionModule.bookBalance(context, book), [context]);
    }
  }
  for (const build of BUILDS) {
    for (const accelerant of core.PURCHASABLE_ACCELERANTS) {
      const applied = invariant.applyPurchasableGrant(
        accelerant,
        core.IDLE_ONLY_OUTPUTS[0] as core.IdleOnlyOutput,
        ZERO_SECONDS,
        EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
      );
      drive('skipExpansion', `${build.axis}/${accelerant}`, () => expansionModule.skipExpansion(build, applied), [build, applied]);
    }
  }
  for (const accelerant of core.PURCHASABLE_ACCELERANTS) {
    for (const output of core.IDLE_ONLY_OUTPUTS) {
      for (const seconds of NUMBER_DOMAIN) {
        drive('applyPurchasableGrant', `${accelerant}/${output}/${String(seconds)}`, () =>
          invariant.applyPurchasableGrant(accelerant, output, ZERO_SECONDS, seconds),
        );
      }
    }
  }

  // --- empireInvariant.ts, the loop
  for (const funding of invariant.EMPIRE_FUNDINGS) {
    drive('poolsWallClockBooks', funding, () => invariant.poolsWallClockBooks(funding));
  }
  for (const policy of invariant.EMPIRE_SPENDING_POLICIES) {
    for (const last of [false, true]) {
      const moment = invariant.spendingMoment(policy, last);
      drive('spendingMoment', `${policy}/${String(last)}`, () => invariant.spendingMoment(policy, last));
      drive('spendsAtMoment', `${policy}/${String(last)}`, () => invariant.spendsAtMoment(moment), [moment]);
      drive('rotatesAtMoment', `${policy}/${String(last)}`, () => invariant.rotatesAtMoment(moment), [moment]);
      for (const [label, context] of CONTEXTS) {
        for (const funding of invariant.EMPIRE_FUNDINGS) {
          drive('maySpendOnRoster', `${policy}/${label}/${funding}`, () =>
            invariant.maySpendOnRoster(moment, expansionModule.EXPANSION_AXES, context, funding), [context],
          );
          for (const book of expansionModule.EMPIRE_BOOKS) {
            drive('axisSpendingOrder', `${policy}/${label}/${funding}/${book}`, () =>
              invariant.axisSpendingOrder(moment, expansionModule.EXPANSION_AXES, 0, book, context, funding), [context],
            );
          }
        }
      }
    }
  }
  for (const accelerant of core.PURCHASABLE_ACCELERANTS) {
    for (const grants of NUMBER_DOMAIN) {
      const plan = planAt(accelerant, grants);
      for (const checkIn of NUMBER_DOMAIN) {
        drive('grantSecondsAt', `${accelerant}/${String(grants)}/${String(checkIn)}`, () =>
          invariant.grantSecondsAt(plan, checkIn), [plan],
        );
      }
    }
  }
  {
    // The gym, stepped rather than only constructed: `pending[].id` and the
    // roster's display names are minted INSIDE the loop, so a driver that only
    // read `createEmpireGym()` would sample two frozen empty arrays.
    let gym: EmpireGym = invariant.createEmpireGym();
    drive('gymSnapshot', 'opening', () => invariant.gymSnapshot(gym), [gym]);
    const stepSeconds = EMPIRE_TUNING.SECONDS_PER_DAY / EMPIRE_SWEEP_CHECK_INS_PER_DAY;
    for (let step = 0; step < STEP_COUNT; step += 1) {
      const accelerant = step % 3 === 0 ? (core.PURCHASABLE_ACCELERANTS[0] as core.PurchasableAccelerant) : null;
      const grantSeconds = accelerant === null ? 0 : EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT;
      const before = gym;
      drive('stepGym', `step=${String(step)}`, () => {
        gym = invariant.stepGym(before, policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY), stepSeconds, accelerant, grantSeconds);
        return gym;
      }, [before]);
      drive('gymSnapshot', `step=${String(step)}`, () => invariant.gymSnapshot(gym), [gym]);
      drive('gymProgressionEntries', `step=${String(step)}`, () =>
        invariant.gymProgressionEntries(gym, step, core.asUnacceleratedSeconds(step * stepSeconds)), [gym],
      );
    }
  }
  drivingAxis = 'DAY';
  for (const days of DAY_DOMAIN) {
    for (const funding of invariant.EMPIRE_FUNDINGS) {
      for (const accelerant of [null, core.PURCHASABLE_ACCELERANTS[0] as core.PurchasableAccelerant]) {
        const plan = planAt(accelerant, accelerant === null ? 0 : 1);
        const social = socialInputsAt();
        const policy = policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY);
        const label = `${String(days)}/${funding}/${String(accelerant)}`;
        let run: invariant.EmpireRun | null = null;
        drive('runEmpire', label, () => {
          run = invariant.runEmpire(days, policy, plan, social, funding);
          return run;
        }, [policy, plan, social]);
        if (run !== null) {
          const settled: invariant.EmpireRun = run;
          drive('empireRunFaults', label, () => invariant.empireRunFaults(settled), [settled]);
          drive('progressionDayLedger', label, () => invariant.progressionDayLedger(settled.ledger));
          drive('idleDayLedger', label, () => invariant.idleDayLedger(settled.ledger));
          for (const output of core.EMPIRE_OUTPUTS) {
            drive('outputSeries', `${label}/${output}`, () => invariant.outputSeries(settled.ledger, output));
            drive('arrivalDays', `${label}/${output}`, () => invariant.arrivalDays(settled.ledger, output));
            drive('amountSeries', `${label}/${output}`, () => engagementModule.amountSeries(settled.ledger, output));
          }
          drive('compareLedgers', label, () => invariant.compareLedgers(DAY_LEDGER, settled.ledger), [DAY_LEDGER]);
          drive('compareDayLists', label, () =>
            invariant.compareDayLists(
              invariant.arrivalDays(DAY_LEDGER, core.EMPIRE_OUTPUTS[0]),
              invariant.arrivalDays(settled.ledger, core.EMPIRE_OUTPUTS[0]),
            ),
          );
        }
      }
    }
  }
  drivingAxis = null;
  drive('empireRunFaults', 'faulted', () => invariant.empireRunFaults(faultedRun()), [faultedRun()]);

  // --- engagement.ts
  for (const key of engagementModule.ENGAGEMENT_WIRINGS) {
    drive('chargesUpkeep', key, () => engagementModule.chargesUpkeep(key));
    drive('wiringFunding', key, () => engagementModule.wiringFunding(key));
    for (const upkeep of NUMBER_DOMAIN) {
      drive('engagementWiring', `${key}/${String(upkeep)}`, () => engagementModule.engagementWiring(key, upkeep));
    }
  }
  drivingAxis = 'COUNT';
  for (const slots of COUNT_DOMAIN) {
    for (const everyNth of [1, 2]) {
      const label = `${String(slots)}/${String(everyNth)}`;
      // Driven at every point including the ones that refuse, so the RangeError
      // payload is scanned like any other value. The rows below need a real
      // history, so a refused point stops after the throw has been kept.
      drive('historyFrom', label, () => historyAt(slots, everyNth));
      if (slots < 1) continue;
      const history = historyAt(slots, everyNth);
      drive('checkInCount', label, () => engagementModule.checkInCount(history), [history]);
      drive('moreEngagedBy', label, () => engagementModule.moreEngagedBy(history, 0), [history]);
      drive('moreEngagedByTrainedDay', label, () => engagementModule.moreEngagedByTrainedDay(history, 0), [history]);
      drive('slotWallSeconds', label, () => engagementModule.slotWallSeconds(slots, EMPIRE_SWEEP_CHECK_INS_PER_DAY));
    }
  }
  drivingAxis = null;
  {
    let tally = engagementModule.emptyEngagementTally();
    for (const spending of invariant.EMPIRE_SPENDING_POLICIES) {
      for (const key of engagementModule.ENGAGEMENT_WIRINGS) {
        const days = RUN_HORIZON_DAYS;
        const slots = days * EMPIRE_SWEEP_CHECK_INS_PER_DAY;
        const history = historyAt(slots, 1);
        // The upkeep argument is what the wiring itself admits: a wiring that
        // charges none refuses a non-zero one, and vice versa.
        const wiring = engagementModule.engagementWiring(
          key,
          engagementModule.chargesUpkeep(key) ? EMPIRE_TUNING.ENCOURAGEMENT_REWARD_GYM_BUCKS : 0,
        );
        const policy = policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY);
        const social = socialInputsAt();
        const label = `${spending}/${key}`;
        let run: engagementModule.EngagementRun | null = null;
        drive('runEngagement', label, () => {
          run = engagementModule.runEngagement(days, policy, history, social, wiring, spending);
          return run;
        }, [policy, history, social, wiring]);
        if (run !== null) {
          const settled: engagementModule.EngagementRun = run;
          drive('engagementRunFaults', label, () => engagementModule.engagementRunFaults(settled), [settled]);
          const other = engagementModule.runEngagement(
            days,
            policy,
            engagementModule.moreEngagedByTrainedDay(history, 0),
            social,
            wiring,
            spending,
          );
          const divergence = engagementModule.compareEngagement(settled, other);
          drive('compareEngagement', label, () => engagementModule.compareEngagement(settled, other), [settled, other]);
          const carried = tally;
          drive('addEngagement', label, () => {
            tally = engagementModule.addEngagement(carried, divergence);
            return tally;
          }, [carried, divergence]);
        }
      }
    }
  }
  drive('engagementRunFaults', 'faulted', () =>
    engagementModule.engagementRunFaults(faultedEngagementRun()), [faultedEngagementRun()],
  );

  // --- social.ts
  for (const payout of reputationModule.REPUTATION_PAYOUTS) {
    drive('reputationPayoutOutput', payout, () => reputationModule.reputationPayoutOutput(payout));
    drive('reputationPayoutReach', payout, () => reputationModule.reputationPayoutReach(payout));
  }
  for (const surface of socialModule.SOCIAL_SURFACES) {
    drive('socialOutput', surface, () => socialModule.socialOutput(surface));
    drive('socialReach', surface, () => socialModule.socialReach(surface));
  }
  for (const scope of EMPIRE_TUNING.LEADERBOARD_SCOPES) {
    drive('leaderboardBracketSize', scope, () => socialModule.leaderboardBracketSize(scope));
    for (const metric of socialModule.LEADERBOARD_METRICS) {
      const entries = Object.freeze([OWN_GYM, ...FRIENDS, RIVAL_GYM]);
      drive('rankLeaderboard', `${scope}/${metric}`, () => socialModule.rankLeaderboard(entries, metric, scope), [entries]);
      const rows = socialModule.rankLeaderboard(entries, metric, scope);
      drive('leaderboardRankOf', `${scope}/${metric}`, () => socialModule.leaderboardRankOf(rows, core.asGymId(SENTINELS.OWN_GYM_ID)), [rows]);
      for (const entry of entries) {
        drive('leaderboardScore', `${metric}/${entry.gymId}`, () => socialModule.leaderboardScore(entry, metric), [entry]);
      }
      drive('compareWithRival', `${scope}/${metric}`, () =>
        socialModule.compareWithRival(
          OWN_GYM,
          RIVAL_GYM,
          metric,
          socialModule.asCalendarDay(CALENDAR_ANCHOR),
          socialModule.asCalendarDay(EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS),
        ),
      );
    }
  }
  drivingAxis = 'DAY';
  for (const day of DAY_DOMAIN) {
    const calendarDay = socialModule.asCalendarDay(day);
    const context = socialContextAt([0, 1, day]);
    const label = String(day);
    drive('visitsUsedOn', label, () => socialModule.visitsUsedOn(context.visits, calendarDay), [context]);
    drive('visitsLeftOn', label, () => socialModule.visitsLeftOn(context.visits, calendarDay), [context]);
    drive('socialContextFaults', label, () => socialModule.socialContextFaults(context), [context]);
    drive('encouragementGymBucksOn', label, () =>
      socialModule.encouragementGymBucksOn(context.encouragementsReceived, calendarDay), [context],
    );
    // `friend-1` is here because of a measured hole, and it is the reason the
    // domain fix alone was not enough. `socialContextAt([0, 1, day])` puts a
    // visit to `friend-0` on the day being driven, so `visitRefusals` returned
    // 'already-visited-today' for it, 'own-gym' for the player and
    // 'not-a-friend-gym' for the third — and `recordFriendVisit`'s VISITED arm
    // was never produced at any point of any domain. The bypass this round is
    // about plants its name inside that arm, so widening the day domain to
    // contain day 7 left it green: the branch was unreachable for a reason that
    // had nothing to do with numbers. 'produced every arm of every
    // discriminated return' is the check that says so.
    for (const gymId of [
      core.asGymId(`${SENTINELS.FRIEND_GYM_ID}-0`),
      core.asGymId(`${SENTINELS.FRIEND_GYM_ID}-1`),
      core.asGymId(SENTINELS.OWN_GYM_ID),
      core.asGymId(SENTINELS.FAULT_VISIT_GYM_ID),
    ]) {
      drive('visitRefusals', `${label}/${gymId}`, () => socialModule.visitRefusals(context, gymId, calendarDay), [context, gymId]);
      drive('mayVisitFriendGym', `${label}/${gymId}`, () => socialModule.mayVisitFriendGym(context, gymId, calendarDay), [context, gymId]);
      for (const encourage of [false, true]) {
        drive('recordFriendVisit', `${label}/${gymId}/${String(encourage)}`, () =>
          socialModule.recordFriendVisit(context, gymId, calendarDay, encourage), [context, gymId],
        );
      }
    }
    drive('rivalPeriodIndex', label, () =>
      socialModule.rivalPeriodIndex(socialModule.asCalendarDay(CALENDAR_ANCHOR), calendarDay),
    );
    drive('rivalPeriodStartDay', label, () =>
      socialModule.rivalPeriodStartDay(socialModule.asCalendarDay(CALENDAR_ANCHOR), day),
    );
    drive('rivalPeriodCloseDay', label, () =>
      socialModule.rivalPeriodCloseDay(socialModule.asCalendarDay(CALENDAR_ANCHOR), day),
    );
    drive('rivalPeriodCloseDays', label, () =>
      socialModule.rivalPeriodCloseDays(socialModule.asCalendarDay(CALENDAR_ANCHOR), day),
    );
    drive('socialRewardSchedule', label, () => socialModule.socialRewardSchedule(calendarAt(CALENDAR_ANCHOR), day));
  }
  drivingAxis = null;
  drive('socialContextFaults', 'faulted', () => socialModule.socialContextFaults(FAULTED_SOCIAL_CONTEXT), [FAULTED_SOCIAL_CONTEXT]);

  return DRIVEN_ROWS;
}

// ---------------------------------------------------------------------------
// The overflow pass — the catcher for the ceilings' declared limit
// ---------------------------------------------------------------------------

/**
 * WHAT THIS IS FOR, in one sentence: `DOMAIN_CENSUS.OMITTED_ABOVE_CEILING` was
 * a declared limit with no catcher, and this is the catcher.
 *
 * The registry above gives three domains a `foreignCeiling` because the drive
 * cannot afford to cross their points with tiers, clocks, ladders and states —
 * DAY unbounded did not finish inside a 700 s watchdog budget, and those
 * measurements are in `DOMAIN_COST_SECONDS`. The price was 39, 39 and 56 branch
 * points dropped from those three domains, and the eighth bypass was a subject
 * keyed on one of them: `recordFriendVisit` returning the ban list's first
 * member on day `NPC_RECRUIT_COST_GYM_BUCKS.club`, which is 2000 and is above
 * the DAY ceiling of 600. `tsc` exit 0 and 13 files / 495 tests green.
 *
 * THE OBSERVATION THIS PASS IS BUILT ON: the ceilings buy back a CROSS-PRODUCT,
 * and an omitted point does not need one. Each dropped point needs the axis's
 * own subjects called ONCE at that single value, against a minimal fixture,
 * scanned by the same `deepScan` the main drive uses. So the ceilings stay
 * exactly where they are and the coverage they were paying for comes back at a
 * fraction of the price.
 *
 * HOW IT KNOWS WHAT TO DRIVE, which is the part that had to be structural. The
 * subject list below is not read from the loops above by eye. `DrivenRow.axis`
 * stamps every row the main drive produces under a ceilinged domain, and
 * 'drives every export the main drive drives on a ceilinged axis' is a set
 * equality between that stamp and `OVERFLOW_SUBJECTS`, in both directions. An
 * export added to the DAY loop reddens this file until it has an overflow row,
 * and an overflow row for an export the DAY loop does not drive reddens it the
 * other way.
 *
 * WHAT IT DOES NOT CLOSE, named here and counted in `OVERFLOW_RESIDUAL` rather
 * than described. A subject whose cost grows with the axis value cannot be
 * driven at 120 000 for free: `historyFrom` allocates one entry per slot, and a
 * 120 000-slot grid crossed with the four exports that then walk it is not a
 * test, it is the measurement that produced the ceilings in the first place.
 * `OVERFLOW_ALLOCATION_CEILING` is where that stops, every (subject, point)
 * pair above it is named in `OVERFLOW_RESIDUAL` with its reason, and the
 * residual is a set equality in both directions so a pair cannot be dropped
 * from the list without being dropped from the skip. The flat subjects — which
 * is where the eighth bypass lived — are driven at every dropped point with no
 * budget at all.
 */

/** One branch point a ceiling drops, as the pair the census counts. */
interface OverflowPoint {
  /** The `NUMERIC_DOMAINS` key whose ceiling dropped it. */
  readonly domain: string;
  /** The `EVERY_BRANCH_POINT` label, so a reader can disagree with the point. */
  readonly label: string;
  readonly value: number;
}

/**
 * The points one domain's ceiling drops.
 *
 * The same arithmetic 'straddles every branch point it is obliged to' does when
 * it counts `omitted`, and deliberately so: the two are joined by a set
 * equality below, and a join between two DIFFERENT arithmetics would be a join
 * that can disagree for a reason that is nobody's defect. What the join buys is
 * that the pinned numbers in `OMITTED_ABOVE_CEILING` describe a set that was
 * actually driven, rather than a set that was counted.
 */
function overflowPointsFor(name: string, domain: NumericDomain): readonly OverflowPoint[] {
  const required = new Set<string>(Object.keys(domain.alsoContains));
  for (const unit of domain.units) {
    for (const label of Object.keys(UNIT_THRESHOLDS[unit])) required.add(label);
  }
  const points: OverflowPoint[] = [];
  for (const [label, value] of Object.entries(EVERY_BRANCH_POINT)) {
    if (required.has(label)) continue;
    if (value <= domain.foreignCeiling) continue;
    points.push(Object.freeze({ domain: name, label, value }));
  }
  return Object.freeze(points);
}

function overflowPoints(): readonly OverflowPoint[] {
  return Object.freeze(
    Object.entries(NUMERIC_DOMAINS).flatMap(([name, domain]) => overflowPointsFor(name, domain)),
  );
}

/**
 * How a subject's cost scales with the value of the axis it is driven on.
 *
 * THREE CLASSES AND NOT TWO, AND THE THIRD IS WHAT E17 ADDED. The pair that was
 * here — `flat` and `allocating` — asked one question, "does this subject cost
 * more at a larger point", and answered it for the whole call. That is one
 * question too few, because `scanRow` has TWO regions and the budget was being
 * set by whichever of them is expensive:
 *
 *   - `flat` — the call, the return and the re-read argument are all the same
 *     size at every point. Driven at every dropped point with no budget.
 *   - `argument-heavy` — the RETURN stays small at every point and only the
 *     re-read ARGUMENT is linear in the axis. The call is driven at every
 *     dropped point and its return is scanned; above the ceiling the argument
 *     region is not re-scanned, and that omission is what
 *     `OVERFLOW_RESIDUAL` counts for these rows.
 *   - `return-heavy` — the call itself, or what it returns, grows with the
 *     axis. Nothing cheap is available, so above the ceiling the pair is not
 *     driven at all.
 *
 * WHY THE SPLIT EXISTS, MEASURED RATHER THAN ARGUED. All twenty-three
 * ROSTER_SHAPE subjects were `allocating`, so all 690 of their pairs above the
 * ceiling were undriven — and driving every one of them with the ARGUMENT
 * region skipped costs **7.9 s and 1 710 return nodes**, against the 301.7 s in
 * `OVERFLOW_COST_SECONDS` for raising the ceiling outright. The ceiling on that
 * axis was buying back the argument re-scan and being charged for the call. The
 * DAY rows are not the same shape and were re-measured rather than assumed:
 * `runEmpire` at the SMALLEST dropped point, 2 500 days, is 908 ms and returns
 * 10 051 nodes, and every other DAY row reads the run it memoises, so that axis
 * is genuinely `return-heavy` and keeps its budget.
 *
 * The classification is a judgement, so both halves are MEASURED rather than
 * trusted: 'measures the cost class of every subject rather than asserting it'
 * requires a `flat` subject's WHOLE scan to stay under
 * `OVERFLOW_FLAT_NODE_CEILING` and an `argument-heavy` subject's RETURN scan to
 * stay under `OVERFLOW_RETURN_NODE_CEILING`. `socialRewardSchedule` refiled as
 * `argument-heavy` produces 2 858 return nodes at 2 500 days and reddens there.
 */
type OverflowCost = 'flat' | 'argument-heavy' | 'return-heavy';

interface OverflowSubject {
  /** The `NUMERIC_DOMAINS` key this subject is an axis of. */
  readonly domain: string;
  readonly export: string;
  readonly cost: OverflowCost;
  /**
   * What the call allocates per unit of the axis, for a row that is not `flat`.
   * Required and required to be specific, because `OVERFLOW_RESIDUAL` is only
   * as honest as the reason beside each skipped pair.
   */
  readonly why: string;
  /**
   * One call group per row: the return (or the thrown payload) first, then
   * every argument re-read AFTER the call, exactly as `drive` keeps them.
   */
  readonly at: (value: number) => readonly (readonly unknown[])[];
}

/**
 * The largest axis value an `allocating` subject of each domain is driven at.
 *
 * PER DOMAIN AND NOT ONE NUMBER, because the three axes are not the same price
 * and a single number would be set by the worst of them. One roster point costs
 * twenty-three subjects each scanning one `NpcLifter` per member, twice; one
 * day point costs eleven subjects, most of them reading a ledger. The
 * measurements are in `OVERFLOW_COST_SECONDS`, taken the way
 * `DOMAIN_COST_SECONDS` was — one configuration at a time, reading vitest's own
 * `Duration` for the overflow block.
 *
 * These are the only free parameters this pass adds. They are cost knobs and
 * NOT a correctness boundary for the flat subjects, which are driven at every
 * dropped point with no budget at all — and the flat set is where the eighth
 * bypass lived. Every pair a budget skips is named in `OVERFLOW_RESIDUAL`.
 */
const OVERFLOW_ALLOCATION_CEILINGS: Readonly<Record<string, number>> = Object.freeze({
  DAY: 2000,
  /**
   * NO CEILING, AND THE MEASUREMENT IS WHY. COUNT started this round with one,
   * on the assumption that a slot grid is the expensive thing —
   * `historyFrom` allocating one entry per slot is the example CLAUDE.md gives
   * for an axis that cannot be driven large. Measured at the other two axes'
   * shipped ceilings: 11.81 s with no COUNT ceiling against 9.59 s with one, a
   * ratio of 1.23 against a bar of 1.5. So the check below deleted it — a
   * concession has to show a real saving or it is buying nothing and charging
   * the coverage for it, which is the rule that deleted two of E14's five
   * domain ceilings. One hundred and twenty (subject, point) pairs — the four
   * allocating COUNT subjects at the thirty points above 2 000 — came back for
   * 2.2 s.
   */
  COUNT: Number.POSITIVE_INFINITY,
  ROSTER_SHAPE: 2000,
});

/**
 * The most nodes a `flat` subject may produce at any point it is driven at.
 *
 * The catcher for the cost classification above. `visitRefusals` at day 120 000
 * scans the same handful of nodes it scans at day 800; `socialRewardSchedule`
 * scans 120 000. Anything between the two is a subject whose row is wrong.
 */
const OVERFLOW_FLAT_NODE_CEILING = 400;

/**
 * The most nodes an `argument-heavy` subject's RETURN may produce at any point
 * it is driven at.
 *
 * The catcher for the third cost class, and the reason that class is not a free
 * assertion. `argument-heavy` claims exactly one thing — that what comes BACK
 * stays small however large the axis gets — so a subject filed there whose
 * return grows is a row that is wrong, and this is where it shows.
 *
 * MEASURED rather than picked: over all 690 ROSTER_SHAPE pairs above the
 * ceiling the whole return region is 1 710 nodes, and the largest single return
 * is `recruitmentBoard`'s five-row catalogue. Sixty is comfortably above that
 * and two orders below `socialRewardSchedule` at the SMALLEST dropped DAY
 * point, which is 2 858 — so the misfiling this is written about reddens by a
 * factor of forty-seven rather than by one node.
 */
const OVERFLOW_RETURN_NODE_CEILING = 60;

/**
 * The horizon the roster-ceiling pin runs the composed loop to.
 *
 * Long enough that the loop fills every slot it can — the pin asserts the
 * smallest stamp is 0 and the largest is `ROSTER_SLOTS_MAX`, so a horizon that
 * never got there would redden rather than read as a ceiling.
 */
const ROSTER_CEILING_RUN_DAYS = 400;

/**
 * How many distinct roster sizes that run passes through, MEASURED on this tree.
 *
 * The non-vacuity number beside the ceiling: a loop that never recruits, and a
 * loop that begins full, both read 1 here. Eight and not seventeen because the
 * ledger is stamped once a day and the loop recruits faster than that early on,
 * so the sizes it is READ at are a subset of the sizes it passes through — which
 * is a fact about the stamp rather than about the ceiling, and is written here
 * rather than left to look like a shortfall.
 */
const ROSTER_CEILING_SIZES_SEEN = 8;

/** The gyms every overflow visit driver asks about, in the main drive's order. */
const OVERFLOW_VISIT_GYM_IDS: readonly GymId[] = Object.freeze([
  core.asGymId(`${SENTINELS.FRIEND_GYM_ID}-0`),
  core.asGymId(`${SENTINELS.FRIEND_GYM_ID}-1`),
  core.asGymId(SENTINELS.OWN_GYM_ID),
  core.asGymId(SENTINELS.FAULT_VISIT_GYM_ID),
]);

/**
 * The per-value fixtures, built once and handed to every subject of their axis.
 *
 * Memoised on the LAST value only rather than on all of them. A roster of
 * 2 000 lifters is cheap to build and expensive to keep, and the pass walks one
 * value at a time, so a one-entry memo shares the fixture across a domain's
 * twenty-three subjects without holding forty-four rosters alive at once.
 */
let overflowContextAt = -1;
let overflowContextMemo: SocialContext | null = null;

function overflowSocialContext(day: number): SocialContext {
  if (overflowContextAt !== day || overflowContextMemo === null) {
    overflowContextAt = day;
    // The same shape the main drive's day loop uses: a visit to `friend-0` on
    // the day being driven, so `friend-1` is what reaches the VISITED arm.
    overflowContextMemo = socialContextAt([0, 1, day]);
  }
  return overflowContextMemo;
}

let overflowRunAt = -1;
let overflowRunMemo: invariant.EmpireRun | null = null;

function overflowRun(days: number): invariant.EmpireRun {
  if (overflowRunAt !== days || overflowRunMemo === null) {
    overflowRunAt = days;
    overflowRunMemo = invariant.runEmpire(
      days,
      policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY),
      planAt(null, 0),
      socialInputsAt(),
    );
  }
  return overflowRunMemo;
}

let overflowHistoryAt = -1;
let overflowHistoryMemo: EngagementHistory | null = null;

function overflowHistory(slots: number): EngagementHistory {
  if (overflowHistoryAt !== slots || overflowHistoryMemo === null) {
    overflowHistoryAt = slots;
    overflowHistoryMemo = historyAt(slots, 1);
  }
  return overflowHistoryMemo;
}

let overflowStateAt = -1;
let overflowStateMemo: EmpireState | null = null;

function overflowState(rosterSize: number): EmpireState {
  if (overflowStateAt !== rosterSize || overflowStateMemo === null) {
    overflowStateAt = rosterSize;
    overflowStateMemo = stateAt({
      rosterSize,
      reputation: EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS[0],
      gymBucks: EMPIRE_TUNING.RIVAL_REWARD_GYM_BUCKS,
      wide: true,
      elapsed: EMPIRE_TUNING.SECONDS_PER_DAY,
      skipped: EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
    });
  }
  return overflowStateMemo;
}

let overflowRosterAt = -1;
let overflowRosterMemo: readonly NpcLifter[] | null = null;

function overflowRoster(size: number): readonly NpcLifter[] {
  if (overflowRosterAt !== size || overflowRosterMemo === null) {
    overflowRosterAt = size;
    overflowRosterMemo = rosterOf(size, 0, 0);
  }
  return overflowRosterMemo;
}

/** The one clock, tier and output the overflow fixtures use. Named, not indexed inline. */
const OVERFLOW_CLOCK: EmpireClock = core.createEmpireClock(
  EMPIRE_TUNING.SECONDS_PER_DAY,
  EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
);
const OVERFLOW_TIER: NpcTier = EMPIRE_TUNING.NPC_TIERS[0] as NpcTier;
const OVERFLOW_OUTPUT: EmpireOutput = core.EMPIRE_OUTPUTS[0];
const OVERFLOW_ANCHOR: CalendarDay = socialModule.asCalendarDay(CALENDAR_ANCHOR);

/**
 * One call, kept the way `drive` keeps one: the return or the thrown payload
 * first, then every argument re-read AFTER the call.
 *
 * The re-read is not decoration here either. Attack shape 13's second half is a
 * value delivered by mutating a caller-supplied sink, and nothing this pass
 * hands in ever carries a banned name, so a banned name found in an argument
 * was written there by the subject.
 */
function attempt(thunk: () => unknown, ...args: readonly unknown[]): readonly unknown[] {
  try {
    return [thunk(), ...args];
  } catch (error) {
    return [error, ...args];
  }
}

/**
 * The twenty subjects the main drive reaches through `STATES`, which is the
 * fixture list `ROSTER_SHAPE` is the axis of.
 *
 * All twenty share one `why`, and that is a statement about the mechanism
 * rather than a shortcut: every one of them takes an `EmpireState` holding the
 * roster, so every one of them allocates and scans one `NpcLifter` per member
 * for the same reason. A row here whose cost came from somewhere else would
 * need its own sentence.
 */
const ROSTER_STATE_WHY =
  'takes an EmpireState whose roster holds one NpcLifter per member and is handed that state as a re-read argument, so the ARGUMENT region is linear in the roster size. What comes back is not: measured over all 690 pairs above the ceiling, the whole return region is 1 710 nodes.';

function rosterStateSubject(
  exportName: string,
  call: (state: EmpireState) => unknown,
): OverflowSubject {
  return Object.freeze({
    domain: 'ROSTER_SHAPE',
    export: exportName,
    cost: 'argument-heavy',
    why: ROSTER_STATE_WHY,
    at: (size: number) => [attempt(() => call(overflowState(size)), overflowState(size))],
  });
}

const OVERFLOW_RATES: RosterRateSource = invariant.rosterRatesAt(OVERFLOW_CLOCK);

const ROSTER_STATE_SUBJECTS: readonly OverflowSubject[] = Object.freeze([
  rosterStateSubject('empireStateFaults', (state) => core.empireStateFaults(state)),
  rosterStateSubject('assertEmpireState', (state) => core.assertEmpireState(state)),
  rosterStateSubject('composeTrainingIqRate', (state) =>
    invariant.composeTrainingIqRate(state, state.clock),
  ),
  rosterStateSubject('expansionContext', (state) => expansionModule.expansionContext(state, BUILDS)),
  rosterStateSubject('recruitmentBoard', (state) => recruitmentModule.recruitmentBoard(state)),
  rosterStateSubject('npcTierUnlocks', (state) => reputationModule.npcTierUnlocks(state)),
  rosterStateSubject('unlockedNpcTiers', (state) => reputationModule.unlockedNpcTiers(state)),
  rosterStateSubject('topNpcTierUnlocked', (state) => reputationModule.topNpcTierUnlocked(state)),
  rosterStateSubject('reputationRates', (state) =>
    reputationModule.reputationRates(state, state.clock),
  ),
  rosterStateSubject('recruitmentRefusals', (state) =>
    recruitmentModule.recruitmentRefusals(state, OVERFLOW_TIER),
  ),
  rosterStateSubject('mayRecruit', (state) => recruitmentModule.mayRecruit(state, OVERFLOW_TIER)),
  rosterStateSubject('recruitmentOffer', (state) =>
    recruitmentModule.recruitmentOffer(state, OVERFLOW_TIER),
  ),
  rosterStateSubject('beginRecruitment', (state) =>
    recruitmentModule.beginRecruitment(state, OVERFLOW_TIER),
  ),
  rosterStateSubject('completeRecruitment', (state) =>
    recruitmentModule.completeRecruitment(
      state,
      recruitmentModule.recruitmentSchedule(OVERFLOW_TIER, state.clock),
      SENTINELS.RECRUIT_ID,
      SENTINELS.RECRUIT_DISPLAY_NAME,
    ),
  ),
  rosterStateSubject('gymBucksRatePerHour', (state) =>
    productionModule.gymBucksRatePerHour(state, OVERFLOW_CLOCK, OVERFLOW_RATES),
  ),
  rosterStateSubject('trainingIqRatePerDay', (state) =>
    productionModule.trainingIqRatePerDay(state, OVERFLOW_CLOCK, OVERFLOW_RATES),
  ),
  rosterStateSubject('productionRates', (state) =>
    productionModule.productionRates(state, OVERFLOW_CLOCK, OVERFLOW_RATES),
  ),
  rosterStateSubject('accrueProduction', (state) =>
    productionModule.accrueProduction(state, OVERFLOW_CLOCK, OVERFLOW_RATES),
  ),
  rosterStateSubject('accrueSponsorship', (state) =>
    reputationModule.accrueSponsorship(state, OVERFLOW_CLOCK),
  ),
  rosterStateSubject('accrueReputation', (state) =>
    reputationModule.accrueReputation(state, OVERFLOW_CLOCK, EMPIRE_SWEEP_CHECK_INS_PER_DAY),
  ),
]);

const OVERFLOW_SUBJECTS: readonly OverflowSubject[] = Object.freeze([
  // --- DAY: the calendar axis, and the one the eighth bypass was keyed on.
  Object.freeze({
    domain: 'DAY',
    export: 'visitsUsedOn',
    cost: 'flat',
    why: '',
    at: (day: number) => [
      attempt(
        () => socialModule.visitsUsedOn(overflowSocialContext(day).visits, socialModule.asCalendarDay(day)),
        overflowSocialContext(day).visits,
      ),
    ],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'visitsLeftOn',
    cost: 'flat',
    why: '',
    at: (day: number) => [
      attempt(
        () => socialModule.visitsLeftOn(overflowSocialContext(day).visits, socialModule.asCalendarDay(day)),
        overflowSocialContext(day).visits,
      ),
    ],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'socialContextFaults',
    cost: 'flat',
    why: '',
    at: (day: number) => [
      attempt(() => socialModule.socialContextFaults(overflowSocialContext(day)), overflowSocialContext(day)),
    ],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'encouragementGymBucksOn',
    cost: 'flat',
    why: '',
    at: (day: number) => [
      attempt(
        () =>
          socialModule.encouragementGymBucksOn(
            overflowSocialContext(day).encouragementsReceived,
            socialModule.asCalendarDay(day),
          ),
        overflowSocialContext(day).encouragementsReceived,
      ),
    ],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'visitRefusals',
    cost: 'flat',
    why: '',
    at: (day: number) =>
      OVERFLOW_VISIT_GYM_IDS.map((gymId) =>
        attempt(
          () =>
            socialModule.visitRefusals(
              overflowSocialContext(day),
              gymId,
              socialModule.asCalendarDay(day),
            ),
          overflowSocialContext(day),
          gymId,
        ),
      ),
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'mayVisitFriendGym',
    cost: 'flat',
    why: '',
    at: (day: number) =>
      OVERFLOW_VISIT_GYM_IDS.map((gymId) =>
        attempt(
          () =>
            socialModule.mayVisitFriendGym(
              overflowSocialContext(day),
              gymId,
              socialModule.asCalendarDay(day),
            ),
          overflowSocialContext(day),
          gymId,
        ),
      ),
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'recordFriendVisit',
    cost: 'flat',
    why: '',
    // THE SUBJECT THE EIGHTH BYPASS WAS PLANTED IN, driven at both values of
    // the encourage flag and at all four gyms, because the VISITED arm is
    // reachable for exactly one of them and the arm is where the name went.
    at: (day: number) =>
      OVERFLOW_VISIT_GYM_IDS.flatMap((gymId) =>
        [false, true].map((encourage) =>
          attempt(
            () =>
              socialModule.recordFriendVisit(
                overflowSocialContext(day),
                gymId,
                socialModule.asCalendarDay(day),
                encourage,
              ),
            overflowSocialContext(day),
            gymId,
          ),
        ),
      ),
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'rivalPeriodIndex',
    cost: 'flat',
    why: '',
    at: (day: number) => [
      attempt(() => socialModule.rivalPeriodIndex(OVERFLOW_ANCHOR, socialModule.asCalendarDay(day))),
    ],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'rivalPeriodStartDay',
    cost: 'flat',
    why: '',
    at: (day: number) => [attempt(() => socialModule.rivalPeriodStartDay(OVERFLOW_ANCHOR, day))],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'rivalPeriodCloseDay',
    cost: 'flat',
    why: '',
    at: (day: number) => [attempt(() => socialModule.rivalPeriodCloseDay(OVERFLOW_ANCHOR, day))],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'rivalPeriodCloseDays',
    cost: 'return-heavy',
    why: 'one frozen CalendarDay per rival period inside the horizon, so a horizon of 120 000 days is 17 142 objects and the scan walks every one of them.',
    at: (day: number) => [attempt(() => socialModule.rivalPeriodCloseDays(OVERFLOW_ANCHOR, day))],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'socialRewardSchedule',
    cost: 'return-heavy',
    why: 'one frozen SocialRewardDay per calendar day inside the horizon, plus one more per period close, so a horizon of 120 000 days is over 137 000 objects.',
    at: (day: number) => [
      attempt(() => socialModule.socialRewardSchedule(calendarAt(CALENDAR_ANCHOR), day)),
    ],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'runEmpire',
    cost: 'return-heavy',
    why: 'the whole loop, stepped six times a calendar day, with one ledger entry per payout, so a 120 000-day run is 720 000 steps before the ledger it returns is scanned.',
    at: (day: number) => [
      attempt(
        () => overflowRun(day),
        policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY),
        planAt(null, 0),
        socialInputsAt(),
      ),
    ],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'empireRunFaults',
    cost: 'return-heavy',
    why: 'reads the run above, whose ledger is linear in the number of days, and is handed that run as a re-read argument.',
    at: (day: number) => [
      attempt(() => invariant.empireRunFaults(overflowRun(day)), overflowRun(day)),
    ],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'progressionDayLedger',
    cost: 'return-heavy',
    why: 'splits the run ledger, which holds one entry per payout per day, so its own return is linear in the day count.',
    at: (day: number) => [attempt(() => invariant.progressionDayLedger(overflowRun(day).ledger))],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'idleDayLedger',
    cost: 'return-heavy',
    why: 'the other half of the same split, and linear in the day count for the same reason.',
    at: (day: number) => [attempt(() => invariant.idleDayLedger(overflowRun(day).ledger))],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'outputSeries',
    cost: 'return-heavy',
    why: 'one entry per day the named output was paid on, read out of a ledger that is linear in the day count.',
    at: (day: number) => [
      attempt(() => invariant.outputSeries(overflowRun(day).ledger, OVERFLOW_OUTPUT)),
    ],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'arrivalDays',
    cost: 'return-heavy',
    why: 'one day number per arrival of the named output, read out of the same linear ledger.',
    at: (day: number) => [
      attempt(() => invariant.arrivalDays(overflowRun(day).ledger, OVERFLOW_OUTPUT)),
    ],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'amountSeries',
    cost: 'return-heavy',
    why: 'one amount per arrival of the named output, read out of the same linear ledger.',
    at: (day: number) => [
      attempt(() => engagementModule.amountSeries(overflowRun(day).ledger, OVERFLOW_OUTPUT)),
    ],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'compareLedgers',
    cost: 'return-heavy',
    why: 'walks the run ledger element-wise against a reference, so both the walk and the divergence list it returns are linear in the day count.',
    at: (day: number) => [
      attempt(() => invariant.compareLedgers(DAY_LEDGER, overflowRun(day).ledger), DAY_LEDGER),
    ],
  }),
  Object.freeze({
    domain: 'DAY',
    export: 'compareDayLists',
    cost: 'return-heavy',
    why: 'compares two arrival-day lists element-wise, and the second of them is read out of the linear run ledger.',
    at: (day: number) => [
      attempt(() =>
        invariant.compareDayLists(
          invariant.arrivalDays(DAY_LEDGER, OVERFLOW_OUTPUT),
          invariant.arrivalDays(overflowRun(day).ledger, OVERFLOW_OUTPUT),
        ),
      ),
    ],
  }),

  // --- COUNT: history slots.
  Object.freeze({
    domain: 'COUNT',
    export: 'historyFrom',
    cost: 'return-heavy',
    why: 'one attendance entry per slot, which is the example CLAUDE.md itself gives: a 90 000-slot roster is not a test.',
    at: (slots: number) => [attempt(() => overflowHistory(slots))],
  }),
  Object.freeze({
    domain: 'COUNT',
    export: 'checkInCount',
    cost: 'return-heavy',
    why: 'walks the whole slot grid, and is handed it as a re-read argument, so the scan is linear in the slot count.',
    at: (slots: number) => [
      attempt(() => engagementModule.checkInCount(overflowHistory(slots)), overflowHistory(slots)),
    ],
  }),
  Object.freeze({
    domain: 'COUNT',
    export: 'moreEngagedBy',
    cost: 'return-heavy',
    why: 'returns a whole second slot grid with one slot flipped, so it allocates the grid a second time.',
    at: (slots: number) => [
      attempt(
        () => engagementModule.moreEngagedBy(overflowHistory(slots), 0),
        overflowHistory(slots),
      ),
    ],
  }),
  Object.freeze({
    domain: 'COUNT',
    export: 'moreEngagedByTrainedDay',
    cost: 'return-heavy',
    why: 'returns a whole second slot grid with one trained day added, so it allocates the grid a second time.',
    at: (slots: number) => [
      attempt(
        () => engagementModule.moreEngagedByTrainedDay(overflowHistory(slots), 0),
        overflowHistory(slots),
      ),
    ],
  }),
  Object.freeze({
    domain: 'COUNT',
    export: 'slotWallSeconds',
    cost: 'flat',
    why: '',
    at: (slots: number) => [
      attempt(() => engagementModule.slotWallSeconds(slots, EMPIRE_SWEEP_CHECK_INS_PER_DAY)),
    ],
  }),

  // --- ROSTER_SHAPE: the roster size the STATES fixture is built at. Every
  // subject here takes a roster or a state holding one, so the axis has no flat
  // member at all — which is stated as a number in `OVERFLOW_CENSUS` rather
  // than left for a reader to notice.
  Object.freeze({
    domain: 'ROSTER_SHAPE',
    export: 'rosterGymBucksPerHour',
    cost: 'argument-heavy',
    why: 'takes the roster itself, which is one NpcLifter per member, and is handed it as a re-read argument. It returns a number, so only the argument region is linear in the axis.',
    at: (size: number) => [
      attempt(
        () => npcModule.rosterGymBucksPerHour(overflowRoster(size), OVERFLOW_CLOCK),
        overflowRoster(size),
      ),
    ],
  }),
  Object.freeze({
    domain: 'ROSTER_SHAPE',
    export: 'rosterTrainingIqPerDay',
    cost: 'argument-heavy',
    why: 'takes the roster itself, which is one NpcLifter per member, and is handed it as a re-read argument. It returns a number, so only the argument region is linear in the axis.',
    at: (size: number) => [
      attempt(
        () => npcModule.rosterTrainingIqPerDay(overflowRoster(size), OVERFLOW_CLOCK),
        overflowRoster(size),
      ),
    ],
  }),
  Object.freeze({
    domain: 'ROSTER_SHAPE',
    export: 'rosterOutputRates',
    cost: 'argument-heavy',
    why: 'takes the roster itself, which is one NpcLifter per member, and is handed it as a re-read argument. It returns a number, so only the argument region is linear in the axis.',
    at: (size: number) => [
      attempt(
        () => npcModule.rosterOutputRates(overflowRoster(size), OVERFLOW_CLOCK),
        overflowRoster(size),
      ),
    ],
  }),
  ...ROSTER_STATE_SUBJECTS,
]);

/**
 * How many of the main drive's rows each ceilinged axis produced.
 *
 * DERIVED BY HAND FROM THE DOMAIN SIZES RATHER THAN READ OFF A FAILURE, which
 * is the point of it. `DRIVE_CENSUS.ROWS` is 206 718 and there is no second way
 * to get that number except to run the drive again — the same expression, which
 * is the oracle-mirrors-its-subject shape. The stamp makes a third of it
 * arithmetic instead:
 *
 *   DAY   = 51 day points × 3 fundings × 2 accelerants, one runEmpire row each
 *           and twenty-three more wherever the run came back, plus 51 × 25 for
 *           the social loop.
 *   COUNT = 55 slot points × 2 everyNth, one historyFrom row each and four
 *           more wherever the grid was legal.
 *   ROSTER_SHAPE = 166 clocks × 17 roster sizes × 3, plus 85 states × (9 + 5
 *           tiers × 5 + 3 clock shapes × (5 + 221 NUMBER points)).
 *
 * A domain that quietly loses points moves a number here that a reader can
 * check against the multiplication, which `DRIVE_CENSUS.ROWS` on its own cannot
 * be.
 */
const MAIN_DRIVE_ROWS_BY_AXIS: Readonly<Record<string, number>> = Object.freeze({
  COUNT: 542,
  DAY: 8481,
  ROSTER_SHAPE: 68986,
});

/**
 * A (subject, point) pair the allocation budget declined to drive.
 *
 * Declared as data rather than as a sentence, and joined to what the run
 * actually skipped by a set equality in both directions, so a pair cannot
 * disappear from the list without disappearing from the skip and a pair cannot
 * be listed that nothing skipped.
 */
interface OverflowResidualRow {
  readonly domain: string;
  readonly export: string;
  /**
   * WHICH OF THE TWO THINGS A BUDGET CAN DECLINE, and the reason this field
   * exists is that E17 found the file had been counting them as one.
   *
   *   - `'the pair'` — the subject was not called at these points at all, so
   *     nothing was produced and nothing was scanned. This is a coverage hole.
   *   - `'the argument re-read'` — the subject WAS called at these points and
   *     what it returned or threw was scanned in full; only the arguments
   *     handed in were not walked a second time afterwards.
   *
   * A row of the second kind is a far weaker concession than one of the first,
   * and the file used to have no way to say so — thirty-four rows all reading
   * `skipped: 30`, of which twenty-three were the undriven kind and eleven the
   * unre-read kind, or so a reader would have had to guess. They were in fact
   * all of the first kind, and twenty-three of them did not need to be.
   */
  readonly region: 'the pair' | 'the argument re-read';
  /** Points of this domain above `OVERFLOW_ALLOCATION_CEILING`. */
  readonly skipped: number;
  readonly largestSkipped: number;
}

/** One scanned row of the overflow pass, before it is thrown away. */
interface OverflowMeasurement {
  readonly rows: number;
  readonly nodes: number;
  readonly strings: number;
  readonly distinctStrings: number;
  readonly depthCuts: number;
  readonly getterThrows: number;
  /** `${domain}/${label}=${value}` for every point at least one subject was driven at. */
  readonly points: readonly string[];
  /** `${domain}/${export}@${label}` for every pair actually driven. */
  readonly pairs: readonly string[];
  /** The same key, for every `return-heavy` pair the budget did not drive at all. */
  readonly skipped: readonly string[];
  /**
   * The same key, for every `argument-heavy` pair that WAS driven above the
   * ceiling with its re-read argument left unscanned.
   *
   * A different quantity from `skipped` and kept apart from it deliberately. A
   * pair on this list produced a value and that value was scanned; a pair on
   * `skipped` produced nothing. Folding the two together is what would let the
   * residual read smaller than it is.
   */
  readonly argumentSkipped: readonly string[];
  /** The most nodes any single scan produced, per `${domain}/${export}`. */
  readonly worstNodes: ReadonlyMap<string, number>;
  /** The most nodes any single RETURN scan produced, per `${domain}/${export}`. */
  readonly worstReturnNodes: ReadonlyMap<string, number>;
  /**
   * Every arm of every discriminated return this pass PRODUCED, by count.
   *
   * Here for the reason CLAUDE.md gives one level out: a domain decides which
   * numbers an axis is offered and says nothing about whether the subject's own
   * guards let the interesting branch run. `recordFriendVisit` refuses three of
   * its four gyms on every day, and the eighth bypass plants its name in the
   * arm the fourth reaches — so an overflow pass that drove every dropped point
   * and produced only the REFUSED arm would report 39 honest points and see
   * nothing.
   */
  readonly arms: ReadonlyMap<string, number>;
  /** Banned by EQUALITY, anywhere, with no exemption. */
  readonly bannedEqual: readonly string[];
  /** Banned by CONTAINMENT, outside the diagnostic channel. */
  readonly bannedContained: readonly string[];
}

let overflowMemo: OverflowMeasurement | null = null;

/**
 * Drive every dropped point and scan what comes back.
 *
 * SCANNED AS IT GOES RATHER THAN COLLECTED FIRST, which is a memory decision
 * with a coverage consequence worth stating: the main drive keeps all 206 718
 * rows and pins a string census over them, and doing that here would hold a
 * 2 000-day run ledger alive once per label. So this keeps counts, the distinct
 * string set, and the findings — and does NOT keep the strings themselves, so
 * there is no per-path census of the overflow pass to pin. The counts below are
 * what stands in for it.
 */
function measureOverflow(): OverflowMeasurement {
  if (overflowMemo !== null) return overflowMemo;
  const bannedNormalised = BANNED_VOCABULARY.map(normalise);
  const distinct1 = new Set<string>();
  const points = new Set<string>();
  const pairs: string[] = [];
  const skipped: string[] = [];
  const argumentSkipped: string[] = [];
  const worstNodes = new Map<string, number>();
  const worstReturnNodes = new Map<string, number>();
  const arms = new Map<string, number>();
  const bannedEqual: string[] = [];
  const bannedContained: string[] = [];
  let rows = 0;
  let nodes = 0;
  let strings = 0;
  let depthCuts = 0;
  let getterThrows = 0;

  for (const point of overflowPoints()) {
    const at = `${point.domain}/${point.label}=${String(point.value)}`;
    for (const subject of OVERFLOW_SUBJECTS) {
      if (subject.domain !== point.domain) continue;
      const key = `${point.domain}/${subject.export}`;
      const ceiling = OVERFLOW_ALLOCATION_CEILINGS[point.domain] ?? 0;
      const budgeted = subject.cost !== 'flat' && point.value > ceiling;
      // A `return-heavy` subject has nothing cheap to offer above the ceiling,
      // so the whole pair is skipped and counted. An `argument-heavy` one is
      // driven and its return is scanned; only the re-read argument is skipped.
      if (budgeted && subject.cost === 'return-heavy') {
        skipped.push(`${key}@${point.label}`);
        continue;
      }
      if (budgeted) argumentSkipped.push(`${key}@${point.label}`);
      pairs.push(`${key}@${point.label}`);
      points.add(at);
      for (const values of subject.at(point.value)) {
        const row: DrivenRow = {
          export: subject.export,
          point: at,
          values,
          axis: point.domain,
        };
        rows += 1;
        const returned = values[0];
        if (typeof returned === 'object' && returned !== null) {
          const kind = (returned as { readonly kind?: unknown }).kind;
          if (typeof kind === 'string') {
            const arm = `${subject.export}#${kind}`;
            arms.set(arm, (arms.get(arm) ?? 0) + 1);
          }
        }
        for (const [region, scan] of scanRow(row, budgeted ? ['return'] : undefined)) {
          if (region === 'return') {
            worstReturnNodes.set(key, Math.max(worstReturnNodes.get(key) ?? 0, scan.nodes));
          }
          nodes += scan.nodes;
          depthCuts += scan.depthCuts;
          getterThrows += scan.getterThrows;
          strings += scan.strings.length;
          worstNodes.set(key, Math.max(worstNodes.get(key) ?? 0, scan.nodes));
          for (const found of scan.strings) {
            distinct1.add(found.value);
            const folded = normalise(found.value);
            // `found.path` already opens with `${export}@${point}#${region}`,
            // because that is the root label `scanRow` hands the walker. The
            // main drive's own message prefixes it a second time and reads
            // `recordFriendVisitrecordFriendVisit@7/…`; this does not, because
            // a check that bites and fails unreadably is half a check.
            const site = `${found.path}=${found.value}${found.viaKey ? ' (as a KEY)' : ''}`;
            if (BANNED_NORMALISED.has(folded)) bannedEqual.push(site);
            else if (
              !DIAGNOSTIC_CHANNEL_EXPORTS.includes(subject.export) &&
              bannedNormalised.some((name) => folded.includes(name))
            ) {
              bannedContained.push(site);
            }
          }
        }
      }
    }
  }

  overflowMemo = {
    rows,
    nodes,
    strings,
    distinctStrings: distinct1.size,
    depthCuts,
    getterThrows,
    points: Object.freeze([...points].sort()),
    pairs: Object.freeze([...pairs].sort()),
    skipped: Object.freeze([...skipped].sort()),
    argumentSkipped: Object.freeze([...argumentSkipped].sort()),
    worstNodes,
    worstReturnNodes,
    arms,
    bannedEqual: Object.freeze(bannedEqual),
    bannedContained: Object.freeze(bannedContained),
  };
  return overflowMemo;
}

/**
 * What each domain's allocation ceiling was MEASURED to cost.
 *
 * Taken one domain at a time from the shipped configuration, that domain's
 * ceiling raised and the other two left alone, reading vitest's own `Duration`
 * for `-t 'the overflow pass'`. The shipped figure is the same block at the
 * three ceilings below, in the same session on the same machine.
 *
 * A row is required for every domain that has an `allocating` subject, in both
 * directions, and a raise has to show a real cost or the ceiling is buying
 * nothing — the same rule `DOMAIN_COST_SECONDS` applies, and the same rule that
 * deleted two of E14's five ceilings.
 */
interface OverflowCostRow {
  readonly domain: string;
  readonly raisedTo: number;
  readonly raisedSeconds: number;
  readonly completed: boolean;
  readonly shippedSeconds: number;
  readonly why: string;
}

const OVERFLOW_COST_SECONDS: readonly OverflowCostRow[] = Object.freeze([
  Object.freeze({
    domain: 'DAY',
    raisedTo: Number.POSITIVE_INFINITY,
    raisedSeconds: 342.4,
    completed: true,
    shippedSeconds: 11.8,
    why: 'runEmpire steps the whole loop six times a calendar day and eight more exports then read the ledger it returns, so the thirty dropped points above 2 000 are 700 000 simulated days. socialRewardSchedule allocates one frozen day beside it.',
  }),
  Object.freeze({
    domain: 'ROSTER_SHAPE',
    raisedTo: Number.POSITIVE_INFINITY,
    raisedSeconds: 301.7,
    completed: true,
    shippedSeconds: 11.8,
    why: 'twenty-three subjects each take a state holding one NpcLifter per member and each is scanned in two regions, so the thirty dropped points above 2 000 are 700 000 lifters walked forty-six times over.',
  }),
]);

/**
 * Every (subject, point) pair a ceiling above declined to drive.
 *
 * THE HONEST HALF OF THIS PASS. E14's residual was three numbers — 39, 39 and
 * 56 — with no catcher; this one is a per-subject count with a reason, and it
 * is smaller, but it is still a residual and it is written down as one rather
 * than folded into the pass. What changed is that the DROPPED POINTS are now
 * driven by every subject whose cost does not grow with the axis, and that a
 * pair which stops being skipped, or starts being skipped, moves a number here.
 */
function residual(
  domain: string,
  exportName: string,
  region: OverflowResidualRow['region'],
  skipped: number,
  largestSkipped: number,
): OverflowResidualRow {
  return Object.freeze({ domain, export: exportName, region, skipped, largestSkipped });
}

/**
 * Thirty-four rows, written out rather than counted, for the reason
 * `EXEMPT_LEAVES_ABOVE_A_CEILING` gives one section above: a count lets one
 * member be swapped for another silently, and the names are what a reader can
 * disagree with.
 *
 * Thirty skipped points per row, both times, and the thirty is a different
 * thirty on each axis: DAY drops thirty-nine points and nine of them are at or
 * under 2 000; ROSTER_SHAPE drops fifty-six and twenty-six are.
 *
 * E17 SPLIT THIS LIST IN TWO AND THE SPLIT IS THE FINDING. Every row used to
 * mean the same thing — the pair was not driven — and the two halves are not
 * the same concession:
 *
 *   - The eleven DAY rows still mean it. `runEmpire` at the SMALLEST dropped
 *     point, 2 500 days, measures 908 ms and returns 10 051 nodes, and the
 *     other ten read the run it memoises, so there is no cheap region to take.
 *   - The twenty-three ROSTER_SHAPE rows do not. Those subjects return a
 *     number, a boolean, a five-row board or a one-line fault list at every
 *     roster size; only the state handed IN is linear. Driving all 690 of
 *     their pairs with the return region scanned and the argument region
 *     skipped measures **7.9 s and 1 710 return nodes total**, against the
 *     301.7 s `OVERFLOW_COST_SECONDS` prices raising that ceiling at. So they
 *     are driven now, and what they still decline is one region rather than
 *     the call.
 *
 * WHY IT MATTERED RATHER THAN BEING TIDIER. The tenth bypass —
 * `completeRecruitment` throwing `EMPIRE_FORBIDDEN_OUTPUTS[0]` on a roster of
 * `REPUTATION_MAX` — is `tsc` exit 0 and 13 files / 509 tests green against the
 * old shape, because the pair it lives on was one of the twenty-three. It is
 * M25 in `PLANTED_ROUTES`. The pair being undriven was the whole of its cover.
 */
const OVERFLOW_RESIDUAL: readonly OverflowResidualRow[] = Object.freeze([
  // COUNT has no rows. Its ceiling was deleted by the measurement, so all four
  // of its return-heavy subjects are driven at all thirty-nine dropped points.
  //
  // The eleven DAY rows: the pair is not driven at all, and the price of
  // driving it is in `OVERFLOW_COST_SECONDS`.
  residual('DAY', 'amountSeries', 'the pair', 30, 120000),
  residual('DAY', 'arrivalDays', 'the pair', 30, 120000),
  residual('DAY', 'compareDayLists', 'the pair', 30, 120000),
  residual('DAY', 'compareLedgers', 'the pair', 30, 120000),
  residual('DAY', 'empireRunFaults', 'the pair', 30, 120000),
  residual('DAY', 'idleDayLedger', 'the pair', 30, 120000),
  residual('DAY', 'outputSeries', 'the pair', 30, 120000),
  residual('DAY', 'progressionDayLedger', 'the pair', 30, 120000),
  residual('DAY', 'rivalPeriodCloseDays', 'the pair', 30, 120000),
  residual('DAY', 'runEmpire', 'the pair', 30, 120000),
  residual('DAY', 'socialRewardSchedule', 'the pair', 30, 120000),
  // The twenty-three ROSTER_SHAPE rows: the pair IS driven at all thirty of
  // these points and its return is scanned; the state handed in is not walked a
  // second time afterwards. See `FROZEN_ARGUMENT_WITNESS` for what covers that.
  residual('ROSTER_SHAPE', 'accrueProduction', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'accrueReputation', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'accrueSponsorship', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'assertEmpireState', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'beginRecruitment', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'completeRecruitment', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'composeTrainingIqRate', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'empireStateFaults', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'expansionContext', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'gymBucksRatePerHour', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'mayRecruit', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'npcTierUnlocks', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'productionRates', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'recruitmentBoard', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'recruitmentOffer', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'recruitmentRefusals', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'reputationRates', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'rosterGymBucksPerHour', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'rosterOutputRates', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'rosterTrainingIqPerDay', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'topNpcTierUnlocked', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'trainingIqRatePerDay', 'the argument re-read', 30, 120000),
  residual('ROSTER_SHAPE', 'unlockedNpcTiers', 'the argument re-read', 30, 120000),
]);

/**
 * What the overflow pass measured on this tree. Counts, not bounds.
 *
 * `POINTS` and `POINTS_DRIVEN` are the pair that says how much of the declared
 * limit this closes and how much it does not: 134 points are dropped by the
 * three ceilings, and every one of them now has at least one subject driven at
 * it.
 *
 * THAT SECOND NUMBER WAS 104 AND THE 30 IT WAS MISSING WERE THE HOLE THE TENTH
 * BYPASS LIVED IN. The paragraph here used to say the ROSTER_SHAPE points above
 * 2 000 had no subject driven at them "because that axis has NO flat subject —
 * every one of its twenty-three exports takes a roster or a state holding one,
 * so there is nothing on it that can be called at 120 000 without allocating
 * 120 000 lifters." Every clause of that is true and the conclusion does not
 * follow: allocating 120 000 lifters is what the FIXTURE costs, and the fixture
 * is built once per point and memoised. What those exports return is a number,
 * a boolean, a five-row board or a one-line fault list. Measured, all 690 of
 * those pairs drive in 7.9 s.
 *
 * `PAIRS_DRIVEN` and `PAIRS_SKIPPED` are the same question one level finer, and
 * `PAIRS_ARGUMENT_SKIPPED` is the third number the split made necessary: 2 302
 * (subject, point) pairs exist across the three axes, 1 972 are driven, and the
 * 330 that are not are the eleven DAY rows of `OVERFLOW_RESIDUAL`. Of the
 * driven, 690 were driven with the re-read argument left unscanned, and those
 * are its twenty-three ROSTER_SHAPE rows.
 */
const OVERFLOW_CENSUS = Object.freeze({
  /** (domain, label) pairs the ceilings drop. Equals the sum of OMITTED_ABOVE_CEILING. */
  POINTS: 134,
  /** Of those, how many at least one subject was driven at. */
  POINTS_DRIVEN: 134,
  SUBJECTS: 49,
  FLAT_SUBJECTS: 11,
  ARGUMENT_HEAVY_SUBJECTS: 23,
  RETURN_HEAVY_SUBJECTS: 15,
  /** (subject, point) pairs driven, and pairs the budgets did not drive at all. */
  PAIRS_DRIVEN: 1972,
  PAIRS_SKIPPED: 330,
  /** Of the driven, how many had the re-read argument region left unscanned. */
  PAIRS_ARGUMENT_SKIPPED: 690,
  /**
   * ROSTER_SHAPE points above its allocation ceiling.
   *
   * The number the tenth bypass hid in, kept as its own row because the pin
   * below drives all thirty of them one at a time and a shrunken list would
   * otherwise pass quietly.
   */
  ROSTER_POINTS_ABOVE_THE_CEILING: 30,
  /**
   * DERIVED INDEPENDENTLY RATHER THAN READ OFF A FAILURE, for the four that
   * can be. The old values were 1 789 rows, 521 418 nodes and 3 538 100
   * strings; the return-only drive of the 690 newly reached pairs was measured
   * on its own, before this change was made, at 690 calls, 1 710 nodes and
   * 6 330 strings. So 1 789 + 690, 521 418 + 1 710 and 3 538 100 + 6 330 are
   * the three numbers below, and all three agreed with the run. The fourth,
   * `DISTINCT_STRINGS`, moved 4 229 -> 4 307 and is transcribed: a distinct-set
   * size is not additive and there is no second way to get it.
   */
  ROWS: 2479,
  NODES: 523128,
  STRINGS: 3544430,
  DISTINCT_STRINGS: 4307,
  DEPTH_CUTS: 0,
  GETTER_THROWS: 0,
  /** The zero this pass exists for, and the tripwire below is what it is zero against. */
  BANNED_EQUAL: 0,
  BANNED_CONTAINED: 0,
  /** Dropped points whose value is not a whole number. The drivers are integral. */
  FRACTIONAL_POINTS: 0,
});

/**
 * Every arm the overflow pass PRODUCED, by count.
 *
 * `recordFriendVisit#visited` is the row that matters and is why this table
 * exists: it is the arm the eighth bypass planted its name in, and an overflow
 * pass that reached the dropped points without reaching that arm would be the
 * defect one level out — the shape CLAUDE.md records as "a domain says which
 * inputs you offered, not which branches ran".
 */
const OVERFLOW_ARM_CENSUS: readonly (readonly [string, number])[] = Object.freeze([
  // Every roster this pass builds is over `rosterCapacity` — the smallest
  // dropped ROSTER_SHAPE point is 30 against a ceiling of sixteen slots — so
  // the ACCEPTED arm is not reachable here and is absent rather than pinned at
  // zero. The main drive is what produces it, 135 times.
  // 26 before E17 and 56 after: one more refusal per ROSTER_SHAPE point the
  // budget used to decline, which is thirty. The arm is the same arm.
  ['beginRecruitment#refused', 56],
  // Six of the eight visit rows per day are refused by construction: the
  // player's own gym, a gym that is not a friend, and a friend already visited
  // on the day being driven. The other two are the arm that matters.
  ['recordFriendVisit#refused', 234],
  ['recordFriendVisit#visited', 78],
]);

// ---------------------------------------------------------------------------
// The tripwire — the non-zero number the zeros below are zero against
// ---------------------------------------------------------------------------

/**
 * A synthetic value carrying one banned name per attack shape the scanner
 * claims to reach.
 *
 * This is the house standard of proof, taken from `src/game/streakSweep.ts`:
 * counts pinned at zero, with the unfixed variant's non-zero numbers kept in
 * the file as the thing the zeros are zero against. A scan reporting zero
 * banned names is exactly what a scan reporting nothing at all reports, and the
 * two are indistinguishable in a green suite.
 *
 * Every name here is read out of `EMPIRE_FORBIDDEN_OUTPUTS` and
 * `FORBIDDEN_UNLOCK_KEYS` rather than typed, so a name added to either is
 * tripwired without this function being edited.
 *
 * `TRIPWIRE_SHAPES` names each shape and `benignTwin` builds the identical
 * structure with a harmless string in every slot. The twin measuring zero is
 * what says the tripwire's count is about the NAMES and not about the shape.
 */
const TRIPWIRE_SHAPES: readonly string[] = Object.freeze([
  'a plain property value',
  'nested five deep through arrays and objects',
  'a computed property KEY',
  'a non-enumerable accessor, invoked',
  'a Map key',
  'a Map value',
  'a Set member',
  'an own property on a thrown Error',
  'a frozen structure',
  'a symbol description',
  'a Proxy whose ownKeys trap is honest',
  'the case fold: COVERED-DAY',
  'the separator fold: a doubled hyphen',
  'the separator fold: a space',
  'the separator fold: a non-breaking hyphen',
  'the trim fold: surrounding whitespace',
]);

function tripwireSubject(name: string, other: string): unknown {
  const target: Record<string, unknown> = {};
  Object.defineProperty(target, 'hidden', { enumerable: false, get: () => name });
  const thrown = new RangeError('a refusal that carries a payload');
  Object.defineProperty(thrown, 'output', { enumerable: true, value: name });
  return [
    Object.freeze({ kind: name }),
    Object.freeze({ a: Object.freeze({ b: Object.freeze([Object.freeze({ c: Object.freeze([name]) })]) }) }),
    Object.freeze({ [name]: 1 }),
    target,
    new Map<unknown, unknown>([
      [name, 1],
      ['key', name],
    ]),
    new Set<unknown>([name]),
    thrown,
    Object.freeze(Object.freeze({ frozen: Object.freeze([Object.freeze({ deep: name })]) })),
    Object.freeze({ [Symbol(name)]: 1 }),
    new Proxy(Object.freeze({ proxied: other }), {}),
    Object.freeze({ shouted: name.toUpperCase() }),
    Object.freeze({ doubled: name.replace('-', '--') }),
    Object.freeze({ spaced: name.replace('-', ' ') }),
    Object.freeze({ nonBreaking: name.replace('-', '‑') }),
    Object.freeze({ padded: `  ${name}  ` }),
  ];
}

/** The same structure with a harmless string in every slot. */
const BENIGN_TWIN = tripwireSubject(SENTINELS.NPC_ID, SENTINELS.OWN_GYM_ID);

const TRIPWIRE_CENSUS = Object.freeze({
  /** Distinct banned-name-equal strings the walker found in the loaded subject. */
  HITS: 16,
  /** The same walk over the benign twin. */
  BENIGN_HITS: 0,
  /** Accessors invoked. Non-zero here and zero on the real drive. */
  GETTERS_INVOKED: 1,
  PROXIES_SEEN: 1,
  SHAPES: 16,
});

// ---------------------------------------------------------------------------
// The measurement
// ---------------------------------------------------------------------------

/** Where a scanned string sat: the call's RETURN (or throw), or a re-read argument. */
type Region = 'return' | 'argument';

interface Found {
  readonly export: string;
  readonly region: Region;
  readonly found: ScannedString;
}

interface DriveMeasurement {
  readonly rows: number;
  readonly exports: readonly string[];
  readonly strings: readonly Found[];
  readonly nodes: number;
  readonly depthCuts: number;
  readonly gettersInvoked: number;
  readonly getterThrows: number;
  readonly proxies: number;
  readonly stacks: number;
  readonly stackFindings: readonly string[];
}

/**
 * Scan one driven row, in both regions.
 *
 * The return and the re-read arguments are scanned separately, because a string
 * that came back OUT is a different claim from one that was handed IN and is
 * still there. Both are checked; only the first is what a diagnostic channel's
 * contents mean.
 *
 * FACTORED OUT RATHER THAN COPIED, and the reason is CLAUDE.md's sharpest
 * recorded defect: a guard written for one loop and re-typed for its sibling
 * differs in exactly the way nobody looks at. The overflow pass calls this, so
 * its reach IS the main drive's reach — the same walker, the same two regions,
 * the same paths — rather than a second implementation that agrees today.
 */
function scanRow(
  row: DrivenRow,
  only?: readonly Region[],
): readonly (readonly [Region, ScanResult])[] {
  const label = `${row.export}@${row.point}`;
  const wanted = (region: Region): boolean => only === undefined || only.includes(region);
  const scans: (readonly [Region, ScanResult])[] = [];
  // Built by filtering rather than by a second expression per caller: the whole
  // reason this function exists is that the overflow pass and the main drive
  // must not be two walkers, and a caller that composed its own subset would be
  // exactly that again. `only` says WHICH of these two regions to walk and can
  // never say how.
  if (wanted('return')) scans.push(['return', deepScan(row.values[0], `${label}#return`)]);
  if (wanted('argument')) {
    scans.push(['argument', deepScan(row.values.slice(1), `${label}#argument`)]);
  }
  return scans;
}

let measurementMemo: DriveMeasurement | null = null;

function measureDrive(): DriveMeasurement {
  if (measurementMemo !== null) return measurementMemo;
  const rows = driveEverything();
  const strings: Found[] = [];
  let nodes = 0;
  let depthCuts = 0;
  let gettersInvoked = 0;
  let getterThrows = 0;
  let proxies = 0;
  let stacks = 0;
  const stackFindings: string[] = [];
  for (const row of rows) {
    for (const [region, scan] of scanRow(row)) {
      nodes += scan.nodes;
      depthCuts += scan.depthCuts;
      gettersInvoked += scan.gettersInvoked;
      getterThrows += scan.getterThrows;
      proxies += scan.proxies;
      stacks += scan.stacks;
      for (const finding of scan.stackFindings) stackFindings.push(`${row.export}${finding}`);
      for (const found of scan.strings) strings.push({ export: row.export, region, found });
    }
  }
  measurementMemo = {
    rows: rows.length,
    exports: distinct(rows.map((row) => row.export)),
    strings: Object.freeze(strings),
    nodes,
    depthCuts,
    gettersInvoked,
    getterThrows,
    proxies,
    stacks,
    stackFindings: Object.freeze(stackFindings),
  };
  return measurementMemo;
}

const DRIVE_CENSUS = Object.freeze({
  ROWS: 206730,
  EXPORTS_DRIVEN: 230,
  NODES: 2393060,
  STRINGS: 11205010,
  DISTINCT_STRINGS: 1611,
  DEPTH_CUTS: 0,
  /**
   * Accessors invoked across the whole drive, and PROXIES seen.
   *
   * Both zero, and both pinned rather than omitted: this directory constructs
   * neither, so the two branches of the walker that exist for attack shape 9
   * are exercised by the tripwire and by nothing in the subject. A non-zero
   * number here means one arrived, which is worth a look on its own.
   */
  GETTERS_INVOKED: 0,
  PROXIES: 0,
  /**
   * Error `stack` own-properties the walk met, and banned names found in them.
   *
   * The first is NOT zero and must not be: the walk deliberately skips the
   * `stack` key, and a skip whose branch is never taken is a limit nobody can
   * tell from an absence. This is the number that says the branch is live, in
   * the same role `TRIPWIRE_CENSUS.GETTERS_INVOKED` plays for the getter arm.
   */
  STACKS: 2876,
  STACK_FINDINGS: 0,
  /** Banned-name-equal strings, and every one of them from a ban-list export. */
  BANNED_EQUAL: 7,
  BANNED_EQUAL_OUTSIDE_THE_BAN_LISTS: 0,
  BANNED_CONTAINED_OUTSIDE_THE_BAN_LISTS: 0,
  /**
   * How many strings the diagnostic-channel exemption actually excluded.
   *
   * ZERO, on this tree, and that is worth stating plainly rather than letting
   * the exemption read as load-bearing: no fault message produced under this
   * drive contains a banned name, because no banned name is ever passed in.
   * The exemption is therefore declared, measured, and currently excluding
   * nothing — and if it ever starts excluding something, this number moves.
   */
  EXCLUDED_BY_THE_DIAGNOSTIC_EXEMPTION: 0,
});

// ---------------------------------------------------------------------------
// The injected axes, and the disagreement between their points
// ---------------------------------------------------------------------------

/**
 * A stable digest of every string and number a value reaches, in visit order.
 *
 * Used only to answer "did varying this axis change anything at all". CLAUDE.md
 * is explicit that richness on one axis is not evidence about an axis nobody
 * varied: these functions take injected clocks, policies, fundings and wirings,
 * and a sweep that holds one of those fixed has ONE POINT on it however many
 * points it has elsewhere. So each axis is varied on its own, the number of
 * points that disagree with the first is counted, and a control that holds the
 * axis fixed is measured beside it at zero.
 */
function fingerprint(value: unknown): string {
  const { trace } = deepScan(value, 'fp');
  let hash = 2166136261;
  for (const item of trace) {
    for (let index = 0; index < item.length; index += 1) {
      hash ^= item.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${String(trace.length)}:${(hash >>> 0).toString(16)}`;
}

interface AxisReading {
  readonly axis: string;
  readonly points: number;
  /** Points whose fingerprint differs from the first point's. */
  readonly disagreements: number;
}

function disagreementsAmong(prints: readonly string[]): number {
  const first = prints[0];
  return prints.filter((print) => print !== first).length;
}

function readingFor(axis: string, prints: readonly string[]): AxisReading {
  return { axis, points: prints.length, disagreements: disagreementsAmong(prints) };
}

/**
 * The injected orders, social inputs and histories the census varies.
 *
 * Written as named lists rather than inline so the variations are readable and
 * so a variation that does NOT disagree shows up as a zero next to a control
 * that is also zero — which is the only way to tell "the axis is inert" from
 * "the axis was never varied".
 */
const AXIS_ORDERS: readonly (readonly ExpansionAxis[])[] = Object.freeze([
  ...expansionModule.EXPANSION_AXES.map((_unused, index) =>
    Object.freeze([
      ...expansionModule.EXPANSION_AXES.slice(index),
      ...expansionModule.EXPANSION_AXES.slice(0, index),
    ]),
  ),
  Object.freeze([...expansionModule.EXPANSION_AXES].reverse()),
]);

/**
 * A rival the two leaderboard metrics DISAGREE about.
 *
 * The shipped `RIVAL_GYM` has a combined total of zero and so does the gym the
 * loop grows, so both sides are level on that metric and the payout is the same
 * number whichever metric is chosen — the axis had two points and the subject
 * could not tell them apart. This rival is behind on reputation and ahead on
 * total, so the metric decides the outcome and therefore the income.
 */
const METRIC_PROBE_SOCIAL: SocialInputs = Object.freeze({
  ...socialInputsAt(),
  rival: snapshotAt(
    SENTINELS.RIVAL_GYM_ID,
    `${SENTINELS.FRIEND_GYM_DISPLAY_NAME}-rival`,
    0,
    EMPIRE_TUNING.RIVAL_REWARD_GYM_BUCKS,
  ),
});

const SOCIAL_SHAPES: readonly (readonly [string, SocialInputs])[] = Object.freeze([
  ['shipped', socialInputsAt()],
  ['no rival', Object.freeze({ ...socialInputsAt(), rival: null })],
  ['no encouragements', Object.freeze({ ...socialInputsAt(), encouragementsReceived: Object.freeze([]) })],
  [
    'a later anchor day',
    Object.freeze({
      ...socialInputsAt(),
      calendar: calendarAt(CALENDAR_ANCHOR + EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS),
    }),
  ],
]);

let axisMemo: readonly AxisReading[] | null = null;

function axisReadings(): readonly AxisReading[] {
  if (axisMemo !== null) return axisMemo;
  const policy = policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY);
  const social = socialInputsAt();
  const days = RUN_HORIZON_DAYS;
  const slots = days * EMPIRE_SWEEP_CHECK_INS_PER_DAY;
  const history = historyAt(slots, 1);
  const HISTORY_SHAPES: readonly (readonly [string, EngagementHistory])[] = Object.freeze([
    ['every slot', history],
    ['every other slot', historyAt(slots, 2)],
    ['every third slot', historyAt(slots, 3)],
    // Same length — runEngagement refuses a history that does not fit the
    // horizon — but a different attendance pattern and no trained days at all.
    ['one check-in, no trained day', engagementModule.historyFrom(slots, (slot) => slot === 0, [])],
  ]);
  const readings: AxisReading[] = [
    readingFor(
      'runEmpire / funding',
      invariant.EMPIRE_FUNDINGS.map((funding) =>
        fingerprint(invariant.runEmpire(days, policy, planAt(null, 0), social, funding)),
      ),
    ),
    readingFor(
      'runEmpire / funding held fixed (control)',
      invariant.EMPIRE_FUNDINGS.map(() =>
        fingerprint(invariant.runEmpire(days, policy, planAt(null, 0), social, invariant.SHIPPED_FUNDING)),
      ),
    ),
    readingFor(
      'runEmpire / accelerant plan',
      [null, ...core.PURCHASABLE_ACCELERANTS].map((accelerant) =>
        fingerprint(
          invariant.runEmpire(
            days,
            policy,
            planAt(accelerant, accelerant === null ? 0 : 1),
            social,
          ),
        ),
      ),
    ),
    readingFor(
      'runEmpire / accelerant plan held fixed (control)',
      [null, ...core.PURCHASABLE_ACCELERANTS].map(() =>
        fingerprint(invariant.runEmpire(days, policy, planAt(null, 0), social)),
      ),
    ),
    readingFor(
      'runEngagement / spending policy',
      invariant.EMPIRE_SPENDING_POLICIES.map((spending) =>
        fingerprint(
          engagementModule.runEngagement(
            days,
            policy,
            history,
            social,
            engagementModule.shippedEngagementWiring(),
            spending,
          ),
        ),
      ),
    ),
    readingFor(
      'runEngagement / spending policy held fixed (control)',
      invariant.EMPIRE_SPENDING_POLICIES.map(() =>
        fingerprint(
          engagementModule.runEngagement(
            days,
            policy,
            history,
            social,
            engagementModule.shippedEngagementWiring(),
            invariant.SHIPPED_SPENDING_POLICY,
          ),
        ),
      ),
    ),
    readingFor(
      'runEngagement / wiring',
      engagementModule.ENGAGEMENT_WIRINGS.map((key) =>
        fingerprint(
          engagementModule.runEngagement(
            days,
            policy,
            history,
            social,
            engagementModule.engagementWiring(
              key,
              engagementModule.chargesUpkeep(key) ? EMPIRE_TUNING.ENCOURAGEMENT_REWARD_GYM_BUCKS : 0,
            ),
          ),
        ),
      ),
    ),
    readingFor(
      'runEngagement / wiring held fixed (control)',
      engagementModule.ENGAGEMENT_WIRINGS.map(() =>
        fingerprint(
          engagementModule.runEngagement(
            days,
            policy,
            history,
            social,
            engagementModule.shippedEngagementWiring(),
          ),
        ),
      ),
    ),
    readingFor(
      'accrueProduction / clock shape',
      COLLECTION_CLOCKS.map(([, clock]) =>
        fingerprint(
          productionModule.accrueProduction(
            STATES[STATES.length - 1]?.[1] as EmpireState,
            clock,
            invariant.rosterRatesAt(clock),
          ),
        ),
      ),
    ),
    readingFor(
      'accrueProduction / clock held fixed (control)',
      COLLECTION_CLOCKS.map(() =>
        fingerprint(
          productionModule.accrueProduction(
            STATES[STATES.length - 1]?.[1] as EmpireState,
            COLLECTION_CLOCKS[0]?.[1] as EmpireClock,
            invariant.rosterRatesAt(COLLECTION_CLOCKS[0]?.[1] as EmpireClock),
          ),
        ),
      ),
    ),
    // --- The three injected dependencies the census used to omit entirely.
    // `EmpirePolicy` was constructed exactly once in this whole file, so all
    // three of its fields were one-point axes; `SocialInputs` and
    // `EngagementHistory` were each a single fixture handed to every run. An
    // injected dependency that appears once is an axis with one point however
    // many points the other axes have.
    readingFor(
      'runEmpire / policy check-ins per day',
      [1, 2, EMPIRE_SWEEP_CHECK_INS_PER_DAY].map((checkIns) =>
        fingerprint(invariant.runEmpire(AXIS_PROBE_DAYS, policyAt(checkIns), planAt(null, 0), social)),
      ),
    ),
    readingFor(
      'runEmpire / policy check-ins held fixed (control)',
      [1, 2, EMPIRE_SWEEP_CHECK_INS_PER_DAY].map(() =>
        fingerprint(invariant.runEmpire(AXIS_PROBE_DAYS, policy, planAt(null, 0), social)),
      ),
    ),
    readingFor(
      // The axis this is really about: `axisOrder` is an injected SPENDING
      // ORDER, which is structurally the same object that gave `src/career/` a
      // one-point comparator axis. Every rotation, so the variations disagree
      // with each other rather than merely existing.
      'runEmpire / policy axis order',
      AXIS_ORDERS.map((axisOrder) =>
        fingerprint(
          invariant.runEmpire(
            AXIS_PROBE_DAYS,
            Object.freeze({ ...policy, axisOrder }),
            planAt(null, 0),
            social,
          ),
        ),
      ),
    ),
    readingFor(
      'runEmpire / policy axis order held fixed (control)',
      AXIS_ORDERS.map(() => fingerprint(invariant.runEmpire(AXIS_PROBE_DAYS, policy, planAt(null, 0), social))),
    ),
    readingFor(
      'runEmpire / policy leaderboard metric',
      socialModule.LEADERBOARD_METRICS.map((leaderboardMetric) =>
        fingerprint(
          invariant.runEmpire(
            AXIS_PROBE_DAYS,
            Object.freeze({ ...policy, leaderboardMetric }),
            planAt(null, 0),
            METRIC_PROBE_SOCIAL,
          ),
        ),
      ),
    ),
    readingFor(
      'runEmpire / policy leaderboard metric held fixed (control)',
      socialModule.LEADERBOARD_METRICS.map(() =>
        fingerprint(invariant.runEmpire(AXIS_PROBE_DAYS, policy, planAt(null, 0), METRIC_PROBE_SOCIAL)),
      ),
    ),
    readingFor(
      'runEmpire / social inputs',
      SOCIAL_SHAPES.map(([, inputs]) =>
        fingerprint(invariant.runEmpire(AXIS_PROBE_DAYS, policy, planAt(null, 0), inputs)),
      ),
    ),
    readingFor(
      'runEmpire / social inputs held fixed (control)',
      SOCIAL_SHAPES.map(() => fingerprint(invariant.runEmpire(AXIS_PROBE_DAYS, policy, planAt(null, 0), social))),
    ),
    readingFor(
      'runEngagement / engagement history',
      HISTORY_SHAPES.map(([, shaped]) =>
        fingerprint(engagementModule.runEngagement(days, policy, shaped, social)),
      ),
    ),
    readingFor(
      'runEngagement / engagement history held fixed (control)',
      HISTORY_SHAPES.map(() => fingerprint(engagementModule.runEngagement(days, policy, history, social))),
    ),
    readingFor(
      'productionRates / gym state shape',
      STATES.map(([, state]) =>
        fingerprint(
          productionModule.productionRates(
            state,
            COLLECTION_CLOCKS[2]?.[1] as EmpireClock,
            invariant.rosterRatesAt(COLLECTION_CLOCKS[2]?.[1] as EmpireClock),
          ),
        ),
      ),
    ),
    readingFor(
      'productionRates / gym state held fixed (control)',
      STATES.map(() =>
        fingerprint(
          productionModule.productionRates(
            STATES[0]?.[1] as EmpireState,
            COLLECTION_CLOCKS[2]?.[1] as EmpireClock,
            invariant.rosterRatesAt(COLLECTION_CLOCKS[2]?.[1] as EmpireClock),
          ),
        ),
      ),
    ),
  ];
  axisMemo = Object.freeze(readings);
  return axisMemo;
}

/**
 * What each injected axis was measured to move.
 *
 * A zero on a NON-control row means the axis is inert under this driver, so
 * every other point in the sweep is one point on it. That is the failure this
 * table exists to make visible, and it is the reason these are counts rather
 * than a `toBeGreaterThan(0)`.
 */
/**
 * How many rows are controls, which is also how many are varied axes.
 *
 * Pinned as an equality in both directions rather than as a count of controls
 * alone: a varied axis with no control beside it is an axis whose zero nobody
 * could interpret, and a control with no axis is a row measuring nothing.
 */
const AXIS_CENSUS_CONTROLS = 11;

const AXIS_CENSUS: readonly (readonly [string, number, number])[] = Object.freeze([
  ['runEmpire / funding', 3, 2],
  ['runEmpire / funding held fixed (control)', 3, 0],
  ['runEmpire / accelerant plan', 3, 2],
  ['runEmpire / accelerant plan held fixed (control)', 3, 0],
  ['runEngagement / spending policy', 6, 5],
  ['runEngagement / spending policy held fixed (control)', 6, 0],
  ['runEngagement / wiring', 5, 4],
  ['runEngagement / wiring held fixed (control)', 5, 0],
  ['accrueProduction / clock shape', 3, 2],
  ['accrueProduction / clock held fixed (control)', 3, 0],
  // --- The three injected dependencies this table used to omit. `EmpirePolicy`
  // was constructed once in the whole file, so all three of its fields were
  // one-point axes; `SocialInputs` and `EngagementHistory` were one fixture
  // each. `axisOrder` is the one that matters most — it is an injected
  // SPENDING ORDER, structurally the same object that gave `src/career/` a
  // one-point comparator axis.
  ['runEmpire / policy check-ins per day', 3, 2],
  ['runEmpire / policy check-ins held fixed (control)', 3, 0],
  // Four of six rather than five: the rotations are of a four-axis list plus
  // its reverse, and two of the six coincide as spending orders once the gym
  // can only afford the same rung under both.
  ['runEmpire / policy axis order', 6, 4],
  ['runEmpire / policy axis order held fixed (control)', 6, 0],
  // One of two, which is the ceiling: the metric has exactly two values, so a
  // varying axis can disagree with the first point at most once.
  ['runEmpire / policy leaderboard metric', 2, 1],
  ['runEmpire / policy leaderboard metric held fixed (control)', 2, 0],
  // Three of four. The fourth is 'no encouragements', and it agrees with the
  // shipped inputs because the encouragement fixture pays on days the horizon
  // does reach but the payout lands in the same book at the same moment as
  // nothing — recorded rather than tuned away, because a variation that does
  // not move the subject is the finding this table exists for.
  ['runEmpire / social inputs', 4, 3],
  ['runEmpire / social inputs held fixed (control)', 4, 0],
  ['runEngagement / engagement history', 4, 3],
  ['runEngagement / engagement history held fixed (control)', 4, 0],
  // Eighty rather than eighty-four, and the gap is the finding rather than a
  // shortfall: reputation is one of the two axes `STATES` crosses and
  // production rates do not read it, so the four other reputations at an empty
  // roster fingerprint identically to the first point. Roster size is what
  // moves this, and it moves it eighty times out of eighty-five. The point
  // count went from 25 to 85 this round because ROSTER_SHAPE stopped being a
  // five-point axis derived from two named thresholds and became a domain of
  // every branch point up to `ROSTER_SLOTS_MAX + 1`.
  ['productionRates / gym state shape', 85, 80],
  ['productionRates / gym state held fixed (control)', 85, 0],
]);

/**
 * What each of the eight fault functions actually produced under the drive.
 *
 * Four of them take no argument and check frozen vocabulary tables, so their
 * string domain is EMPTY on a healthy tree and cannot be made non-empty from a
 * test file. Those four are absent from this table, which is the honest way to
 * say the behavioural half covers them not at all — instrument A's
 * literal-member pass is what covers their subject.
 */
const DIAGNOSTIC_CHANNEL_CENSUS: readonly (readonly [string, number])[] = Object.freeze([
  ['empireRunFaults', 3],
  ['empireStateFaults', 7],
  ['engagementRunFaults', 1],
  ['socialContextFaults', 1],
]);

/**
 * Every arm of every discriminated return the drive actually PRODUCED, by count.
 *
 * This exists because of a hole the numeric-domain fix could not close, and the
 * distinction is the whole reason it is a separate check. A domain decides
 * which NUMBERS an axis is driven at. It says nothing about whether the
 * subject's own guards let the interesting branch run at all — and here they
 * did not: every gym the social loop offered `recordFriendVisit` was refused on
 * every day, so the VISITED arm was produced zero times, at every point of
 * every domain this file has ever had. Instrument A knew the arm existed the
 * whole time; it is a literal member of the return's `kind`.
 *
 * So the check below is a set equality between the arms instrument A DECLARES
 * and the arms instrument B REACHED, discovered from the type rather than
 * listed — and the counts are pinned beside it so an arm that survives on one
 * lucky point reports how thin it is.
 *
 * Its limit, and the named catcher for it: this only sees a union discriminated
 * by a property literally called `kind`. A return that branches on the presence
 * of a field, on an empty array, or on a discriminant with another name is
 * invisible here, and what covers those is `SENTINELS_OBSERVED` for the
 * caller-supplied positions and nothing at all for the rest. That is the honest
 * state of it; the four arms below are the whole population this instrument has.
 */
const KINDED_RETURN_CENSUS: readonly (readonly [string, number])[] = Object.freeze([
  ['beginRecruitment#accepted', 135],
  ['beginRecruitment#refused', 290],
  ['recordFriendVisit#refused', 308],
  ['recordFriendVisit#visited', 100],
]);

/**
 * The two strings the composed loop mints for its own snapshot.
 *
 * Pinned by content because `gymSnapshot`'s two bare-string positions carry
 * module-private constants rather than caller text, so no sentinel can reach
 * them. Content is the same guarantee by a different route.
 */
const GYM_SNAPSHOT_STRINGS: readonly string[] = Object.freeze(['Placeholder', 'composed-gym']);

/**
 * A wall-clock budget for the two blocks in this file that outgrew the global
 * one, applied per BLOCK and not per test, in the shape `engagement.test.ts`
 * already uses in this directory.
 *
 * TWO BLOCKS AND NOT ONE, WHICH IS THIS ROUND'S EDIT TO THIS SENTENCE. The
 * overflow pass shares the budget: its own measurement is 11.0 s on a quiet
 * machine and 20.2 s on a loaded one, against a shipped-configuration cost of
 * 11.8 s measured on its own, so it is nowhere near 90 s — but it is a second
 * scan of a second drive and it sits in the same risk class as the block below.
 * The two together took this file from ~46 s to between 40 s and 78 s
 * depending on the run, which is a spread wide enough to be worth writing down
 * rather than averaging: the same commit measured both.
 *
 * WHY IT IS NEEDED NOW AND WAS NOT BEFORE. The registry used to file 40 of
 * `EMPIRE_TUNING`'s 100 numeric leaves; it files 66 and exempts 34, and every
 * domain carries every branch point under its ceiling. That took the drive from
 * 53 162 rows to 206 718, and this file from 17.4 s to 43.7 s.
 *
 * MEASURED solo, in the shipped configuration, every test in this file over 1 s,
 * slowest first:
 *
 *   34223 ms  [instrument B]  drives every export the census knows about
 *    5416 ms  [instrument B]  CONTAINS no banned name either, outside the…
 *    4547 ms  [instrument B]  produces no banned name from any export…
 *    1978 ms  [instrument A]  walks the whole directory without truncating
 *    1386 ms  [A bites]       compiles the probe cleanly
 *    1160 ms  [instrument B]  walked a domain that is not empty
 *
 * IT WAS FOUND BY A RED RUN, NOT BY THIS TABLE. Solo, the 34 s test passes
 * against the 30 s global budget — it does not, because 34 > 30, and yet the
 * solo run is green. Under a whole-suite run it went red once and passed twice
 * on the same tree, which is `vitest.config.ts`'s recorded flakiness exactly:
 * a margin that is thin solo is gone under parallel load. So the number that
 * decided this is 34 223 against 30 000, and the direction of the flake was the
 * reassuring one — the run that reported it also reported the two genuine
 * catches, so a reader could have filed the timeout as part of the finding.
 *
 * THE BLOCK AND NOT THE ONE TEST, for the reason `engagement.test.ts` gives:
 * the 5.4 s and 4.5 s tests beside it are the same drive read twice more, so
 * under load they are the same risk as the 34 s one. `engagement.test.ts`'s
 * stated threshold is a third of the global budget, which all three clear.
 * Every other block in this file tops out at 1978 ms and keeps the global 30 s.
 *
 * VERIFIED TO PROPAGATE, BOTH DIRECTIONS, rather than assumed, because a budget
 * vitest quietly ignored would be a decoration reading as a fix:
 *
 *   - Set to `1_000`, FOUR tests in this block fail with the BLOCK's number —
 *     `Error: Test timed out in 1000ms.`, four times — so the third argument
 *     reaches the tests inside it. Four and not three: `walked a domain that is
 *     not empty` is 1160 ms and crosses a 1 s line that 90 s is nowhere near,
 *     which is what a scoped budget looks like when it is really scoped.
 *   - Under the same `1_000`, `walks the whole directory without truncating`
 *     (1978 ms, a different block) still passes, which it can only do on the
 *     global 30 s budget. So the value is scoped to its own block rather than
 *     leaking file-wide.
 */
const DRIVE_BLOCK_TIMEOUT_MS = 90_000;

describe('instrument B — nothing this directory produces is a forbidden name', () => {
  it('drives every export the census knows about, in both directions', () => {
    const census = distinct(stringSurface().exports.map((key) => key.split('#')[1] as string));
    const driven = measureDrive().exports;
    // Set equality. A new export is an undriven member and reddens here until
    // somebody writes a row for it — which is the ONLY thing that fires on
    // attack shape 16, and is a demand for a reviewer rather than a detection.
    expect(driven).toEqual(census);
    expect(driven.length).toBe(DRIVE_CENSUS.EXPORTS_DRIVEN);
    expect(census.length).toBe(SURFACE_CENSUS.EXPORTS);
  });

  it('walked a domain that is not empty, and did not truncate', () => {
    const measurement = measureDrive();
    expect(measurement.rows).toBe(DRIVE_CENSUS.ROWS);
    expect(measurement.nodes).toBe(DRIVE_CENSUS.NODES);
    expect(measurement.strings.length).toBe(DRIVE_CENSUS.STRINGS);
    expect(distinct(measurement.strings.map((entry) => entry.found.value)).length).toBe(
      DRIVE_CENSUS.DISTINCT_STRINGS,
    );
    // A truncated walk reports a clean scan, which is the reassuring direction.
    expect(measurement.depthCuts).toBe(DRIVE_CENSUS.DEPTH_CUTS);
    expect(measurement.gettersInvoked).toBe(DRIVE_CENSUS.GETTERS_INVOKED);
    expect(measurement.proxies).toBe(DRIVE_CENSUS.PROXIES);
    expect(measurement.getterThrows).toBe(0);
    // The `stack` skip: how many were met, and how many carried a banned name
    // once their engine frames were stripped. The first is non-zero, which is
    // what says the skipped branch is real rather than a limit on a branch
    // nothing reaches.
    expect(measurement.stacks).toBe(DRIVE_CENSUS.STACKS);
    expect(measurement.stackFindings).toEqual([]);
    expect(measurement.stackFindings.length).toBe(DRIVE_CENSUS.STACK_FINDINGS);
  });

  it('reached every caller-supplied string position, by sentinel', () => {
    const values = new Set(measureDrive().strings.map((entry) => entry.found.value));
    const reached = Object.entries(SENTINELS)
      .filter(([, sentinel]) => [...values].some((value) => value.includes(sentinel)))
      .map(([name]) => name)
      .sort();
    // Set equality both ways. Every one of instrument A's five bare-string
    // fields is EMPTY on the obvious fixture, so this is the assertion that
    // says the domain is non-empty where it matters rather than merely large.
    expect(reached).toEqual([...Object.keys(SENTINELS)].sort());
  });

  it('produces no banned name from any export but the two that ARE the ban lists', () => {
    const measurement = measureDrive();
    const banned = measurement.strings.filter((entry) => BANNED_NORMALISED.has(normalise(entry.found.value)));
    expect(banned.length).toBe(DRIVE_CENSUS.BANNED_EQUAL);

    const offenders = banned
      .filter((entry) => !BAN_LIST_EXPORTS.includes(entry.export))
      .map((entry) => `${entry.export}${entry.found.path}=${entry.found.value}`);
    // THE ZERO THIS WHOLE FILE IS ABOUT. The tripwire below is the non-zero
    // number it is zero against.
    expect(distinct(offenders)).toEqual([]);
    expect(offenders.length).toBe(DRIVE_CENSUS.BANNED_EQUAL_OUTSIDE_THE_BAN_LISTS);

    // The exempted pair is pinned by content and by count, not skipped.
    expect(
      distinct(banned.map((entry) => `${entry.export}=${entry.found.value}`)),
    ).toEqual([
      'EMPIRE_FORBIDDEN_OUTPUTS=chalk',
      'EMPIRE_FORBIDDEN_OUTPUTS=competition-total',
      'EMPIRE_FORBIDDEN_OUTPUTS=covered-day',
      'EMPIRE_FORBIDDEN_OUTPUTS=e1rm',
      'FORBIDDEN_UNLOCK_KEYS=chance-draw',
      'FORBIDDEN_UNLOCK_KEYS=currency-purchase',
      'FORBIDDEN_UNLOCK_KEYS=paid-pull',
    ]);
  });

  it('CONTAINS no banned name either, outside the diagnostic channel, and the exemption is measured', () => {
    const measurement = measureDrive();
    // `normalise` is hoisted out of the inner loop rather than recomputed once
    // per banned name. Same predicate, seven times less of it: this file's
    // string population went from 53 162 to 194 760 when the registry started
    // filing the whole tuning block, and this one line was 62 s of the 103 s
    // the file takes.
    const bannedNormalised = BANNED_VOCABULARY.map(normalise);
    const contained = measurement.strings.filter((entry) => {
      const value = normalise(entry.found.value);
      return bannedNormalised.some((name) => value.includes(name));
    });
    const exempted = contained.filter((entry) => DIAGNOSTIC_CHANNEL_EXPORTS.includes(entry.export));
    const offenders = contained
      .filter((entry) => !BAN_LIST_EXPORTS.includes(entry.export))
      .filter((entry) => !DIAGNOSTIC_CHANNEL_EXPORTS.includes(entry.export))
      .map((entry) => `${entry.export}${entry.found.path}=${entry.found.value}`);
    expect(distinct(offenders)).toEqual([]);
    expect(offenders.length).toBe(DRIVE_CENSUS.BANNED_CONTAINED_OUTSIDE_THE_BAN_LISTS);
    // The exemption's own size. Attack shape 19 hides in whatever the exemption
    // turns out to be, so the exemption is a number rather than a silence.
    expect(exempted.length).toBe(DRIVE_CENSUS.EXCLUDED_BY_THE_DIAGNOSTIC_EXEMPTION);
  });

  it('pins what the diagnostic channel actually said, rather than passing over it', () => {
    const byExport = new Map<string, number>();
    for (const entry of measureDrive().strings) {
      if (entry.region !== 'return') continue;
      if (!DIAGNOSTIC_CHANNEL_EXPORTS.includes(entry.export)) continue;
      if (entry.found.viaKey) continue;
      byExport.set(entry.export, (byExport.get(entry.export) ?? 0) + 1);
    }
    // Four of the eight are zero-argument vocabulary checks over frozen tables,
    // so their string domain is EMPTY on a healthy tree and cannot be made
    // non-empty without editing a shipped module. That is stated as a number,
    // not hidden: those four are checked by instrument A's literal-member pass
    // and by nothing here.
    expect([...byExport.entries()].sort()).toEqual(DIAGNOSTIC_CHANNEL_CENSUS);
  });

  it('produced every arm of every discriminated return, and not merely some of them', () => {
    // Declared by instrument A, reached by instrument B, compared in both
    // directions. An arm the type has and the drive never produced is a branch
    // no point of any domain can reach, which is a domain that is empty where
    // it matters no matter how many points it has.
    const declared = distinct(
      stringSurface()
        .positions.filter((position) => position.kind === 'literal')
        .filter((position) => positionKey(position).endsWith('#return.kind'))
        .flatMap((position) => position.members.map((member) => `${position.export}#${member}`)),
    );
    const arms = new Map<string, number>();
    for (const row of driveEverything()) {
      const returned = row.values[0];
      if (typeof returned !== 'object' || returned === null) continue;
      const kind = (returned as { readonly kind?: unknown }).kind;
      if (typeof kind !== 'string') continue;
      const at = `${row.export}#${kind}`;
      arms.set(at, (arms.get(at) ?? 0) + 1);
    }
    expect([...arms.keys()].sort()).toEqual([...declared]);
    expect([...arms.entries()].sort()).toEqual(KINDED_RETURN_CENSUS);
  });

  it('pins the two strings the composed loop mints for itself', () => {
    // `gymSnapshot` returns module-private constants rather than caller text,
    // so its two bare-string positions carry no sentinel. They are pinned by
    // content instead, which is the same guarantee by a different route.
    const measurement = measureDrive();
    const fromSnapshot = distinct(
      measurement.strings
        .filter((entry) => entry.export === 'gymSnapshot' && entry.region === 'return')
        .filter((entry) => !entry.found.viaKey)
        .map((entry) => entry.found.value),
    );
    expect(fromSnapshot).toEqual(GYM_SNAPSHOT_STRINGS);
  });
}, DRIVE_BLOCK_TIMEOUT_MS);

describe('the overflow pass — the catcher for what the ceilings drop', () => {
  it('covers exactly the branch points the ceilings drop, in both directions', () => {
    // THE JOIN. `OMITTED_ABOVE_CEILING` was three numbers with no catcher; this
    // is the set those numbers count, driven. Both directions: a point the
    // census says is dropped and the pass does not know about is as much a
    // defect as a point the pass drives that no ceiling dropped.
    const points = overflowPoints();
    const byDomain: Record<string, number> = {};
    for (const name of Object.keys(NUMERIC_DOMAINS)) byDomain[name] = 0;
    for (const point of points) byDomain[point.domain] = (byDomain[point.domain] ?? 0) + 1;
    expect(byDomain).toEqual({ ...DOMAIN_CENSUS.OMITTED_ABOVE_CEILING });
    expect(points.length).toBe(OVERFLOW_CENSUS.POINTS);

    // Every dropped point is a real branch point, at its real value, and above
    // the ceiling of the domain that dropped it. Without this the pass could
    // drive 134 invented numbers and count them honestly.
    for (const point of points) {
      const domain = Object.entries(NUMERIC_DOMAINS).find(([name]) => name === point.domain)?.[1];
      expect(domain, point.domain).toBeDefined();
      expect(EVERY_BRANCH_POINT[point.label], point.label).toBe(point.value);
      expect(point.value, `${point.domain}/${point.label}`).toBeGreaterThan(
        domain?.foreignCeiling ?? Number.POSITIVE_INFINITY,
      );
      // …and it really is absent from the domain, which is the whole reason it
      // needs a drive of its own.
      expect(domain?.points, `${point.domain}/${point.label}`).not.toContain(point.value);
    }

    // The drivers are integral, so a fractional dropped point would be handed
    // to an axis that refuses it. There are none; the count is pinned rather
    // than the property assumed, so one arriving is a red line rather than a
    // silent `RangeError` inside a try.
    expect(points.filter((point) => !Number.isInteger(point.value)).length).toBe(
      OVERFLOW_CENSUS.FRACTIONAL_POINTS,
    );
  });

  it('stamps exactly the domains that carry a ceiling, and drives every export stamped under one', () => {
    // The structural half, and the reason the subject list is not a hand-copied
    // reading of the loops above. `DrivenRow.axis` is stamped by the main drive
    // itself; this reads it back.
    const stamped = distinct(
      driveEverything()
        .map((row) => row.axis)
        .filter((axis): axis is string => axis !== null),
    );
    const ceilinged = Object.entries(NUMERIC_DOMAINS)
      .filter(([, domain]) => Number.isFinite(domain.foreignCeiling))
      .map(([name]) => name)
      .sort();
    // A domain that gains a ceiling and no stamp reddens here, and so does a
    // stamp on a domain that has no ceiling.
    expect(stamped).toEqual(ceilinged);

    // The row count per axis, which is the one part of `DRIVE_CENSUS.ROWS` a
    // reader can re-derive from the domain sizes by multiplication.
    const rowsByAxis: Record<string, number> = {};
    for (const row of driveEverything()) {
      if (row.axis === null) continue;
      rowsByAxis[row.axis] = (rowsByAxis[row.axis] ?? 0) + 1;
    }
    expect(rowsByAxis).toEqual({ ...MAIN_DRIVE_ROWS_BY_AXIS });

    for (const domain of ceilinged) {
      const drivenByTheMainPass = distinct(
        driveEverything()
          .filter((row) => row.axis === domain)
          .map((row) => row.export),
      );
      const drivenHere = distinct(
        OVERFLOW_SUBJECTS.filter((subject) => subject.domain === domain).map(
          (subject) => subject.export,
        ),
      );
      // SET EQUALITY IN BOTH DIRECTIONS. An export added to the DAY loop above
      // is an undriven member here; a subject row for an export that loop does
      // not drive is a row measuring an axis it is not on.
      expect(drivenHere, domain).toEqual(drivenByTheMainPass);
    }
    expect(OVERFLOW_SUBJECTS.length).toBe(OVERFLOW_CENSUS.SUBJECTS);
    expect(OVERFLOW_SUBJECTS.filter((subject) => subject.cost === 'flat').length).toBe(
      OVERFLOW_CENSUS.FLAT_SUBJECTS,
    );
    expect(OVERFLOW_SUBJECTS.filter((subject) => subject.cost === 'argument-heavy').length).toBe(
      OVERFLOW_CENSUS.ARGUMENT_HEAVY_SUBJECTS,
    );
    expect(OVERFLOW_SUBJECTS.filter((subject) => subject.cost === 'return-heavy').length).toBe(
      OVERFLOW_CENSUS.RETURN_HEAVY_SUBJECTS,
    );
    // Every subject names a domain that carries a ceiling. A row for NUMBER
    // would drive nothing, because NUMBER drops nothing.
    for (const subject of OVERFLOW_SUBJECTS) {
      expect(ceilinged, subject.export).toContain(subject.domain);
      if (subject.cost !== 'flat') {
        expect(subject.why.length, `${subject.domain}/${subject.export}`).toBeGreaterThan(60);
      } else {
        expect(subject.why, `${subject.domain}/${subject.export}`).toBe('');
      }
    }
  });

  it('walked a domain that is not empty at the dropped points, and did not truncate', () => {
    const measurement = measureOverflow();
    expect(measurement.rows).toBe(OVERFLOW_CENSUS.ROWS);
    expect(measurement.pairs.length).toBe(OVERFLOW_CENSUS.PAIRS_DRIVEN);
    expect(measurement.skipped.length).toBe(OVERFLOW_CENSUS.PAIRS_SKIPPED);
    expect(measurement.argumentSkipped.length).toBe(OVERFLOW_CENSUS.PAIRS_ARGUMENT_SKIPPED);
    expect(measurement.points.length).toBe(OVERFLOW_CENSUS.POINTS_DRIVEN);
    expect(measurement.nodes).toBe(OVERFLOW_CENSUS.NODES);
    expect(measurement.strings).toBe(OVERFLOW_CENSUS.STRINGS);
    expect(measurement.distinctStrings).toBe(OVERFLOW_CENSUS.DISTINCT_STRINGS);
    // A truncated walk reports a clean scan, which is the reassuring direction.
    expect(measurement.depthCuts).toBe(OVERFLOW_CENSUS.DEPTH_CUTS);
    expect(measurement.getterThrows).toBe(OVERFLOW_CENSUS.GETTER_THROWS);
    // Every driven pair belongs to a dropped point, and no pair is both driven
    // and skipped.
    const dropped = new Set(
      overflowPoints().map((point) => `${point.domain}/${point.label}=${String(point.value)}`),
    );
    for (const at of measurement.points) expect(dropped, at).toContain(at);
    for (const pair of measurement.pairs) {
      expect(measurement.skipped, pair).not.toContain(pair);
    }
  });

  it('produced the arm the eighth bypass was planted in, and not merely the points', () => {
    // A domain says which inputs you offered, not which branches ran. The
    // eighth bypass sat inside `recordFriendVisit`'s VISITED arm, which three
    // of the four gyms this pass asks about are refused on; a pass that drove
    // every dropped day and produced only REFUSED would report thirty-nine
    // honest points and see nothing at all.
    const arms = [...measureOverflow().arms.entries()].sort();
    expect(arms).toEqual(OVERFLOW_ARM_CENSUS);
    const visited = measureOverflow().arms.get('recordFriendVisit#visited') ?? 0;
    expect(visited).toBeGreaterThan(0);
  });

  it('produces no banned name at any point a ceiling drops', () => {
    // THE ZERO THIS PASS IS ABOUT. It is zero against the same tripwire the
    // main drive's zero is zero against, because it is the same scanner and the
    // same fold list — `scanRow` is shared rather than re-implemented.
    const measurement = measureOverflow();
    expect(measurement.bannedEqual).toEqual([]);
    expect(measurement.bannedEqual.length).toBe(OVERFLOW_CENSUS.BANNED_EQUAL);
    expect(measurement.bannedContained).toEqual([]);
    expect(measurement.bannedContained.length).toBe(OVERFLOW_CENSUS.BANNED_CONTAINED);
    // …and the pass looked at something. A zero over an empty scan is what the
    // ceilings already gave for free.
    expect(measurement.strings).toBeGreaterThan(0);
  });

  it('measures the cost class of every subject rather than asserting it', () => {
    // The catcher for the two judgements in the table. A subject misfiled as
    // `flat` is driven at 120 000 with no budget at all, so its worst WHOLE
    // scan is tens of thousands of nodes rather than a handful. A subject
    // misfiled as `argument-heavy` is driven there too — the claim that class
    // makes is only that what comes BACK stays small, so its worst RETURN scan
    // is what says whether the claim is true.
    //
    // The second half is what E17 added, and it is the check that keeps the
    // new class from being a free assertion: without it, filing every
    // `return-heavy` row as `argument-heavy` would drive `runEmpire` at 120 000
    // days and report a green pass some minutes later.
    const worst = measureOverflow().worstNodes;
    const worstReturn = measureOverflow().worstReturnNodes;
    let flat = 0;
    let argumentHeavy = 0;
    for (const subject of OVERFLOW_SUBJECTS) {
      const key = `${subject.domain}/${subject.export}`;
      const seen = worst.get(key);
      // Every subject was driven at least once, or its row is decoration.
      expect(seen, key).toBeDefined();
      if (subject.cost === 'flat') {
        expect(seen ?? 0, key).toBeLessThanOrEqual(OVERFLOW_FLAT_NODE_CEILING);
        flat += 1;
      }
      if (subject.cost === 'argument-heavy') {
        expect(worstReturn.get(key), key).toBeDefined();
        expect(worstReturn.get(key) ?? 0, key).toBeLessThanOrEqual(OVERFLOW_RETURN_NODE_CEILING);
        argumentHeavy += 1;
      }
    }
    expect(flat).toBe(OVERFLOW_CENSUS.FLAT_SUBJECTS);
    expect(argumentHeavy).toBe(OVERFLOW_CENSUS.ARGUMENT_HEAVY_SUBJECTS);
  });

  it('declares every pair the allocation budgets skipped, in both directions', () => {
    // The residual, as data rather than as a sentence. A pair that stops being
    // skipped moves a number here before it moves anything downstream, and a
    // row for a pair nothing skips is a row that reads as a concession the pass
    // is not actually making.
    //
    // TWO LISTS AND NOT ONE, WHICH IS THE JOIN E17 ADDED. `skipped` holds the
    // pairs nothing called; `argumentSkipped` holds the pairs that were called
    // and whose arguments were not walked again afterwards. Each row declares
    // which of the two it is, and the row is compared against the matching
    // list — so re-labelling a `'the pair'` row as `'the argument re-read'` to
    // make it read weaker does not pass, because the counts come from
    // different measurements.
    const countBy = (keys: readonly string[]): Map<string, number> => {
      const counted = new Map<string, number>();
      for (const key of keys) {
        const subject = key.split('@')[0] ?? '';
        counted.set(subject, (counted.get(subject) ?? 0) + 1);
      }
      return counted;
    };
    const byRegion: Readonly<Record<OverflowResidualRow['region'], Map<string, number>>> =
      Object.freeze({
        'the pair': countBy(measureOverflow().skipped),
        'the argument re-read': countBy(measureOverflow().argumentSkipped),
      });
    const largest = new Map<string, number>();
    for (const point of overflowPoints()) {
      const ceiling = OVERFLOW_ALLOCATION_CEILINGS[point.domain] ?? 0;
      if (point.value <= ceiling) continue;
      for (const subject of OVERFLOW_SUBJECTS) {
        if (subject.domain !== point.domain || subject.cost === 'flat') continue;
        const key = `${point.domain}/${subject.export}`;
        largest.set(key, Math.max(largest.get(key) ?? 0, point.value));
      }
    }
    const measured = Object.entries(byRegion)
      .flatMap(([region, counted]) =>
        [...counted.entries()].map(([key, skipped]) => {
          const [domain, exportName] = key.split('/');
          return {
            domain: domain ?? '',
            export: exportName ?? '',
            region: region as OverflowResidualRow['region'],
            skipped,
            largestSkipped: largest.get(key) ?? 0,
          };
        }),
      )
      .sort((left, right) =>
        `${left.domain}/${left.export}`.localeCompare(`${right.domain}/${right.export}`),
      );
    expect(measured).toEqual([...OVERFLOW_RESIDUAL]);
    expect(
      OVERFLOW_RESIDUAL.filter((row) => row.region === 'the pair').reduce(
        (total, row) => total + row.skipped,
        0,
      ),
    ).toBe(OVERFLOW_CENSUS.PAIRS_SKIPPED);
    expect(
      OVERFLOW_RESIDUAL.filter((row) => row.region === 'the argument re-read').reduce(
        (total, row) => total + row.skipped,
        0,
      ),
    ).toBe(OVERFLOW_CENSUS.PAIRS_ARGUMENT_SKIPPED);
    // Every residual row is a budgeted subject, and its cost class decides
    // which region it may be declining. A `flat` subject on this list would
    // mean a budget was applied where the file says none is; an
    // `argument-heavy` row declaring `'the pair'` would claim a hole the pass
    // does not have, and a `return-heavy` row declaring `'the argument
    // re-read'` would claim it has one it does.
    const REGION_OF: Readonly<Record<string, OverflowResidualRow['region']>> = Object.freeze({
      'argument-heavy': 'the argument re-read',
      'return-heavy': 'the pair',
    });
    for (const row of OVERFLOW_RESIDUAL) {
      const subject = OVERFLOW_SUBJECTS.find(
        (candidate) => candidate.domain === row.domain && candidate.export === row.export,
      );
      expect(subject?.cost, `${row.domain}/${row.export}`).not.toBe('flat');
      expect(REGION_OF[subject?.cost ?? ''], `${row.domain}/${row.export}`).toBe(row.region);
      expect(row.largestSkipped, `${row.domain}/${row.export}`).toBeGreaterThan(
        OVERFLOW_ALLOCATION_CEILINGS[row.domain] ?? 0,
      );
    }
  });

  it('leaves nothing writable in the argument it stops re-reading, and counts what it walked', () => {
    // THE NAMED CATCHER FOR THE ARGUMENT-REGION SKIP, and the shape is
    // CLAUDE.md's "a bounded claim, a declared limit, and a named catcher"
    // rather than an absolute.
    //
    //   WHAT THE SKIP GUARANTEES, in the mechanism's own terms: for the 690
    //   ROSTER_SHAPE pairs above the ceiling, the call runs and everything it
    //   RETURNS or THROWS is scanned in full, by the same walker and the same
    //   fold list the main drive uses.
    //
    //   THE ROUTE THAT GETS PAST IT, named concretely enough to plant: attack
    //   shape 13's second half — a value delivered not by returning it but by
    //   WRITING it into a caller-supplied sink. The `argument` region is what
    //   reads that back, and above the ceiling it is not read.
    //
    //   THE CHECK THAT COVERS THAT ROUTE: this one. Every object reachable
    //   from the fixture those calls are handed is frozen, so the write throws
    //   a TypeError — and a throw lands in the RETURN position, which is
    //   scanned at every point. The route does not become invisible; it
    //   becomes loud somewhere else.
    //
    // Its own residual, stated rather than implied: freezing stops a write to
    // an own property. It does not stop a subject handing back a value it
    // derived from the argument, which is the return region's job and is
    // scanned.
    const smallest = overflowPoints()
      .filter(
        (point) =>
          point.domain === 'ROSTER_SHAPE' &&
          point.value > (OVERFLOW_ALLOCATION_CEILINGS.ROSTER_SHAPE ?? 0),
      )
      .reduce(
        (best, point) => (best === null || point.value < best.value ? point : best),
        null as OverflowPoint | null,
      );
    expect(smallest?.value, 'the axis has a point above its ceiling').toBeGreaterThan(0);
    const fixture = overflowState(smallest?.value ?? 0);

    // Walked rather than spot-checked at three properties, because a fixture
    // that grows an unfrozen field is exactly the thing this would stop
    // noticing. Counts, not bounds.
    let objects = 0;
    let unfrozen: string[] = [];
    const walk = (value: unknown, path: string, depth: number): void => {
      if (typeof value !== 'object' || value === null || depth > 6) return;
      objects += 1;
      if (!Object.isFrozen(value)) unfrozen.push(path);
      for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`, depth + 1);
    };
    walk(fixture, 'state', 0);
    expect(unfrozen).toEqual([]);
    unfrozen = [];
    expect(objects).toBeGreaterThan(smallest?.value ?? 0);

    // …and the freeze is what makes the write loud, measured rather than
    // asserted. A frozen own property assigned to in a module — every file
    // here is one — throws rather than failing silently.
    const sink = fixture as unknown as Record<string, unknown>;
    expect(() => {
      sink[SENTINELS.OWN_GYM_ID] = core.EMPIRE_FORBIDDEN_OUTPUTS[0];
    }).toThrow(TypeError);
    expect(Object.hasOwn(fixture, SENTINELS.OWN_GYM_ID)).toBe(false);
  });

  it('pins what bounds a roster, because the two arms of that comparison are different questions', () => {
    // WHY THIS SITS HERE AT ALL. The residual above used to be argued away
    // rather than driven: nothing in this directory can BUILD a roster over
    // `ROSTER_SLOTS_MAX`, so a roster-size branch point above the ceiling was
    // taken to be unreachable. Half of that is true and it is the half that
    // does not matter.
    //
    // The composed loop cannot reach one. Measured, not read: a 400-day run
    // stamps `state.roster.length` into its own ledger on every day, and the
    // largest it ever reads is `ROSTER_SLOTS_MAX`. So a branch point above the
    // ceiling planted INSIDE `stepGym`'s capacity-gated block is dead code,
    // which is why that mutant is recorded as inert.
    //
    // The exports are not the loop. `rosterCapacity` capping at
    // `ROSTER_SLOTS_MAX` is what CREATES the over-capacity arm, and that arm is
    // where five exports do their work: a decoded payload holding more lifters
    // than slots is the case `empireStateFaults` exists for. Every one of them
    // runs at every one of the thirty points the ceiling used to drop, which is
    // what the tenth bypass rode and what the pass above now covers.
    //
    // Raising `ROSTER_SLOTS_MAX` past a dropped point reddens the first half
    // here, which is the whole reason it is a pin and not a paragraph.
    const run = invariant.runEmpire(
      ROSTER_CEILING_RUN_DAYS,
      policyAt(EMPIRE_SWEEP_CHECK_INS_PER_DAY),
      planAt(null, 0),
      socialInputsAt(),
    );
    const rosterStamps = run.ledger.filter((entry) => entry.output === 'roster-slot');
    expect(rosterStamps.length).toBe(ROSTER_CEILING_RUN_DAYS);
    const worstInTheLoop = Math.max(...rosterStamps.map((entry) => entry.amount));
    expect(worstInTheLoop).toBe(EMPIRE_TUNING.ROSTER_SLOTS_MAX);
    // The loop GREW to it rather than starting there, which is what would make
    // the number above a ceiling nothing ever pushed against. A run that never
    // recruited reads one distinct size and fails both of these; a run that
    // began full reads one distinct size and fails the second.
    const sizesSeen = distinct(rosterStamps.map((entry) => String(entry.amount)));
    expect(sizesSeen.length).toBe(ROSTER_CEILING_SIZES_SEEN);
    expect(Math.min(...rosterStamps.map((entry) => entry.amount))).toBeLessThan(worstInTheLoop);

    // And the second half: at every dropped point, the over-capacity arm of
    // both comparisons produced a value. Per point, not in aggregate.
    let refused = 0;
    let threw = 0;
    let faulted = 0;
    const dropped = overflowPoints().filter(
      (point) =>
        point.domain === 'ROSTER_SHAPE' &&
        point.value > (OVERFLOW_ALLOCATION_CEILINGS.ROSTER_SHAPE ?? 0),
    );
    for (const point of dropped) {
      const state = overflowState(point.value);
      if (recruitmentModule.recruitmentRefusals(state, OVERFLOW_TIER).includes('roster-at-capacity')) {
        refused += 1;
      }
      if (core.empireStateFaults(state).length > 0) faulted += 1;
      try {
        recruitmentModule.completeRecruitment(
          state,
          recruitmentModule.recruitmentSchedule(OVERFLOW_TIER, state.clock),
          SENTINELS.RECRUIT_ID,
          SENTINELS.RECRUIT_DISPLAY_NAME,
        );
      } catch {
        threw += 1;
      }
    }
    expect(dropped.length).toBe(OVERFLOW_CENSUS.ROSTER_POINTS_ABOVE_THE_CEILING);
    expect(refused).toBe(dropped.length);
    expect(faulted).toBe(dropped.length);
    expect(threw).toBe(dropped.length);
  });

  it('joins a measured price to every domain whose budget skips a pair, in both directions', () => {
    // The same rule `DOMAIN_COST_SECONDS` is held to, and the same rule that
    // deleted two of E14's five ceilings: a concession has to show a real
    // saving, or it is buying nothing and charging the coverage for it.
    const budgeted = distinct(
      OVERFLOW_RESIDUAL.map((row) => row.domain),
    );
    const priced = distinct(OVERFLOW_COST_SECONDS.map((row) => row.domain));
    expect(priced).toEqual(budgeted);
    for (const row of OVERFLOW_COST_SECONDS) {
      expect(row.raisedTo, row.domain).toBeGreaterThan(
        OVERFLOW_ALLOCATION_CEILINGS[row.domain] ?? 0,
      );
      expect(row.raisedSeconds, row.domain).toBeGreaterThan(row.shippedSeconds * 1.5);
      expect(row.why.length, row.domain).toBeGreaterThan(60);
      if (!row.completed) expect(row.raisedTo, row.domain).toBe(Number.POSITIVE_INFINITY);
    }
  });
}, DRIVE_BLOCK_TIMEOUT_MS);

describe('instrument B bites — the tripwire the zeros are zero against', () => {
  it('finds a banned name in every shape the scanner claims to reach', () => {
    const loaded = deepScan(
      tripwireSubject(core.EMPIRE_FORBIDDEN_OUTPUTS[0], reputationModule.FORBIDDEN_UNLOCK_KEYS[0]),
      'tripwire',
    );
    const hits = loaded.strings.filter((found) => BANNED_NORMALISED.has(normalise(found.value)));
    expect(hits.length).toBe(TRIPWIRE_CENSUS.HITS);
    // Sixteen hits at sixteen distinct paths, one per declared shape. Without
    // this the count could be sixteen because one shape fired sixteen times.
    expect(distinct(hits.map((found) => found.path)).length).toBe(TRIPWIRE_CENSUS.HITS);
    expect(loaded.gettersInvoked).toBe(TRIPWIRE_CENSUS.GETTERS_INVOKED);
    expect(loaded.proxies).toBe(TRIPWIRE_CENSUS.PROXIES_SEEN);
    expect(TRIPWIRE_SHAPES.length).toBe(TRIPWIRE_CENSUS.SHAPES);
  });

  it('reads a redefined Error.stack, which the walker skips as a key and a value', () => {
    // The catcher for a limit that had none, and it is the Proxy shape: a
    // count on the subject pinned at zero, with a planted twin measured
    // non-zero beside it so the zero is zero against something.
    const clean = new Error(SENTINELS.NPC_ID);
    const cleanScan = deepScan(clean, 'clean-error');
    expect(cleanScan.stacks).toBe(1);
    expect(cleanScan.stackFindings).toEqual([]);

    // Exactly the shipped-refusal-path exploit: the name is read out of the ban
    // list, no forbidden word is spelled here, and `defineProperty` writes past
    // the enumerable/own-key distinction the walker was relying on.
    const planted = new Error(SENTINELS.NPC_ID);
    Object.defineProperty(planted, 'stack', {
      value: core.EMPIRE_FORBIDDEN_OUTPUTS[0],
      configurable: true,
    });
    const plantedScan = deepScan(planted, 'planted-error');
    expect(plantedScan.stacks).toBe(1);
    expect(plantedScan.stackFindings.length).toBe(1);

    // The plainer route, and the one a real author would reach for first. On
    // this engine `new Error()` installs `stack` as an ACCESSOR, so this leaves
    // no `value` on the descriptor at all — the first version of the catcher
    // read `descriptor.value` only and this walked straight past it, 489 of 489
    // green. Both shapes, because one branch above the other is not coverage.
    const assigned = new Error(SENTINELS.NPC_ID);
    assigned.stack = core.EMPIRE_FORBIDDEN_OUTPUTS[0];
    expect(deepScan(assigned, 'assigned-error').stackFindings.length).toBe(1);
    expect(plantedScan.stackFindings[0]).toContain(core.EMPIRE_FORBIDDEN_OUTPUTS[0]);
    // And the value is still absent from `strings`, so the census stays a
    // census of the machine-independent surface.
    expect(
      plantedScan.strings.some((found) => found.value === core.EMPIRE_FORBIDDEN_OUTPUTS[0]),
    ).toBe(false);

    // The declared blind spot, planted so it is a measurement rather than a
    // worry: a stack whose every line looks like a frame strips to nothing.
    const disguised = new Error(SENTINELS.NPC_ID);
    Object.defineProperty(disguised, 'stack', {
      value: `    at ${core.EMPIRE_FORBIDDEN_OUTPUTS[0]} (x)`,
      configurable: true,
    });
    expect(deepScan(disguised, 'disguised-error').stackFindings).toEqual([]);
  });

  it('finds nothing in the identically shaped benign twin', () => {
    // Without this the count above would be a count about the SHAPE rather than
    // about the names, and would stay green if `normalise` matched everything.
    const twin = deepScan(BENIGN_TWIN, 'benign');
    const hits = twin.strings.filter((found) => BANNED_NORMALISED.has(normalise(found.value)));
    expect(hits.length).toBe(TRIPWIRE_CENSUS.BENIGN_HITS);
    // …and the twin is the same walk, not a smaller one.
    expect(twin.gettersInvoked).toBe(TRIPWIRE_CENSUS.GETTERS_INVOKED);
    expect(twin.proxies).toBe(TRIPWIRE_CENSUS.PROXIES_SEEN);
  });

  it('gives every declared fold its own tripwire, in both directions', () => {
    expect(FOLD_NAMES).toEqual(['case', 'separators', 'trim']);
    let checked = 0;
    for (const [fold, variant, name] of FOLD_TRIPWIRES) {
      expect(FOLD_NAMES, fold).toContain(fold);
      expect(normalise(variant), `${fold}: ${variant}`).toBe(name);
      expect(BANNED_NORMALISED.has(normalise(variant)), `${fold}: ${variant}`).toBe(true);
      checked += 1;
    }
    expect(checked).toBe(FOLD_TRIPWIRES.length);
    // The other direction. A fold that matched everything would pass every line
    // above and be worthless.
    let refused = 0;
    for (const value of FOLD_NON_MATCHES) {
      expect(BANNED_NORMALISED.has(normalise(value)), value).toBe(false);
      refused += 1;
    }
    expect(refused).toBe(FOLD_NON_MATCHES.length);
  });
});

describe('the injected axes were varied, and the variation was measured', () => {
  it('pins the disagreement on every axis, with a held-fixed control beside it', () => {
    const readings = axisReadings().map(
      (reading) => [reading.axis, reading.points, reading.disagreements] as const,
    );
    // Counts rather than bounds. A zero on a non-control row says the axis is
    // inert under this driver, which makes every other point in the sweep one
    // point on that axis — CLAUDE.md's "richness on one axis is not evidence
    // about an axis nobody varied".
    expect(readings).toEqual(AXIS_CENSUS);
    const controls = readings.filter(([axis]) => axis.includes('(control)'));
    // One control per varied axis, and the equality below is what says the
    // pairing is complete rather than that some axes happen to have one.
    expect(controls.length).toBe(AXIS_CENSUS_CONTROLS);
    expect(readings.length - controls.length).toBe(AXIS_CENSUS_CONTROLS);
    for (const [axis, , disagreements] of controls) expect(disagreements, axis).toBe(0);
    for (const [axis, , disagreements] of readings.filter(([name]) => !name.includes('(control)'))) {
      expect(disagreements, axis).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// THE CHANNEL CENSUS — the routes a string can LEAVE this directory BY, and
// which instrument covers each of them
// ===========================================================================

/**
 * WHY THIS EXISTS, AND WHAT IT IS NOT.
 *
 * Eleven bypasses have been found here. Ten of them were found by enumerating
 * one of two things: WHERE the name sits (a declared position, a brand, a
 * constructor call site) or WHICH NUMBER the branch is keyed on (a unit, a
 * domain, a ceiling, an allocation budget). The eleventh — M25 — sat in a
 * thrown `Error` message, and what made it survive nine rounds was neither its
 * position nor its number. It was that **nobody had enumerated the ways a
 * string can get out**. A thrown payload is not a declared position, so
 * instrument A had nothing to classify; it calls no constructor, so instrument C
 * had no site; only the drive could ever have seen it, and the pair it lived on
 * was one of the 690 an allocation budget declined.
 *
 * So this section asks a question the other three do not: WHAT ARE THE ROUTES?
 * It is a census of CHANNELS, and it is deliberately not a fourth detector.
 *
 * TWO HALVES, AND THE FIRST IS WHERE THE LIST COMES FROM.
 *
 *   1. THE LANGUAGE'S LIST, WHICH IS CLOSED AND SHORT. A value computed inside a
 *      module reaches a caller by exactly one of: normal completion (a return),
 *      abrupt completion (a throw), a write into memory the caller already holds
 *      (an argument, a module-level binding, or an ambient object), a call into
 *      something the caller supplied (a callback), or a value the caller reads
 *      LATER through machinery the module handed it (a getter, a coercion
 *      method, a returned closure, a thenable). That enumeration is a property
 *      of JavaScript, not of this directory, which is why it can be closed at
 *      all — and it is the reformulation CLAUDE.md's newest rule asks for: an
 *      unbounded space (which numbers can a branch be keyed on) traded for a
 *      finite one (which syntactic shapes hand a value out).
 *
 *   2. WHICH OF THEM THIS DIRECTORY USES, WHICH IS SCANNED AND NOT REMEMBERED.
 *      `channelCensus` walks the shipped modules with the checker and counts
 *      SITES per channel per module. `CHANNEL_SITE_COUNTS` pins that table, deep
 *      equal, in both directions. Nothing here is a list somebody typed from
 *      memory: the numbers came off the tree and a new site of any channel moves
 *      one of them.
 *
 * WHAT IT CATCHES AND WHAT IT DOES NOT, in the shape CLAUDE.md's "form that
 * survived" asks for — a bounded claim, a named limit, and a named catcher for
 * the limit:
 *
 *   - THE CLAIM: a new escape SITE, of any of the eleven channels, in any
 *     shipped module of this directory, moves a pinned number here. That covers
 *     the arrival of a channel this directory does not currently use — the four
 *     zero rows are the ones that matter, and a getter, a `toJSON`, an `async`,
 *     a write into a caller's object or a write to `globalThis` all redden on
 *     arrival.
 *
 *   - THE LIMIT: it counts SITES, not payloads. An EXISTING site emitting
 *     something new is invisible to it — the same limit instrument C states for
 *     `asGymId(context.friends[0].displayName)`. And it is a source scan, so it
 *     sees the shapes it was told to look for; a channel spelled some way this
 *     scan does not classify is outside it, exactly as CLAUDE.md says of every
 *     scan for words.
 *
 *   - THE CATCHERS FOR THE LIMIT, per channel and by name, are the point of the
 *     matrix below. Each cell was MEASURED by emitting `EMPIRE_FORBIDDEN_OUTPUTS[0]`
 *     down that channel and running the real instrument at it, rather than
 *     reasoned about. `CHANNEL_COVERAGE` is the result and `channels the drive
 *     alone covers` is the reading of it that matters.
 *
 * THE READING, STATED HERE SO IT IS NOT BURIED IN A TABLE, AND CORRECTED WHERE
 * E19 MOVED IT: of the channels this directory actually uses, `throw` used to
 * be covered by the drive and nothing else — a sampling instrument, which is
 * the thing CLAUDE.md's newest rule says cannot close an unbounded input space.
 * That reading is what got the wrap built, and the wrap is what changed it:
 * every throw is a `refuseWith` call now, so the channel carries a runtime
 * refusal AND a two-site enumeration, and `every throw in this directory is
 * written as a call to the wrap` is the check that holds the second. The
 * coverage matrix below still reports `movesA/B/C` for the throw row exactly as
 * it did, because the wrap is neither a declared position, nor a brand
 * constructor, nor the drive — that row is a measurement of those three
 * instruments and is not a scoreboard for the channel.
 *
 * And `callback-invocation` was covered by NOTHING AT ALL, in any of the three
 * instruments, until the callback pass below was written. M27 in
 * `PLANTED_ROUTES` is that route, planted, run, and printed.
 */

type ChannelId =
  | 'return'
  | 'throw'
  | 'exported-binding'
  | 'argument-mutation'
  | 'callback-invocation'
  | 'internal-callback-invocation'
  | 'module-mutable-state'
  | 'ambient-global'
  | 'lazy-member'
  | 'returned-closure'
  | 'deferred-completion';

interface EscapeChannel {
  readonly id: ChannelId;
  /** How a value leaves by this route, in the language's terms. */
  readonly what: string;
  /** The syntactic shape `channelCensus` counts for it. Stated so the scan's reach is readable. */
  readonly scannedFor: string;
  /**
   * Whether anything outside this directory can put a value into this route.
   *
   * True for ten of the eleven. The one `false` is the internal callback, and
   * it is not taken on the `export` modifier alone —
   * `DECLARED_INTERNAL_CALLBACK_ARGUMENTS` is the measurement that backs it,
   * because an exported function forwarding its own callback parameter would
   * make the answer true with no modifier moving.
   */
  readonly reachableFromOutside: boolean;
}

/**
 * The eleven channels, each with the shape the scan counts for it.
 *
 * `internal-callback-invocation` is separated from `callback-invocation` on ONE
 * axis and it is the axis that decides whether the channel is reachable from
 * outside: whether the function whose parameter is being called is EXPORTED. A
 * caller can hand `historyFrom` any predicate it likes; nothing outside this
 * directory can hand `axesWhere` anything, because both of its callers pass a
 * closure written here. That is a syntactic fact the scan reads off the
 * `export` modifier rather than a judgement.
 */
const ESCAPE_CHANNELS: readonly EscapeChannel[] = Object.freeze([
  Object.freeze({
    id: 'return',
    what: 'normal completion — the value a call evaluates to, at every nested position inside it',
    scannedFor: 'every `return` statement in a shipped module',
    reachableFromOutside: true,
  }),
  Object.freeze({
    id: 'throw',
    what: 'abrupt completion — the payload a `throw` hands the caller, including `message`, `name` and anything hung on the error',
    scannedFor: 'every `throw` statement in a shipped module',
    reachableFromOutside: true,
  }),
  Object.freeze({
    id: 'exported-binding',
    what: 'exported DATA, which a caller reads with no call at all and which is built at import time',
    scannedFor: 'every exported `const` declaration',
    reachableFromOutside: true,
  }),
  Object.freeze({
    id: 'argument-mutation',
    what: "a write into memory the caller already holds — a parameter's property, element, or a mutating method on it",
    scannedFor: 'a member assignment or a mutating call whose receiver resolves, through the checker, to a PARAMETER',
    reachableFromOutside: true,
  }),
  Object.freeze({
    id: 'callback-invocation',
    what: 'a call into a function the caller supplied, which carries its arguments out of the directory',
    scannedFor: 'a call of an identifier that resolves to a parameter of an EXPORTED function, keyed by its argument count',
    reachableFromOutside: true,
  }),
  Object.freeze({
    id: 'internal-callback-invocation',
    what: 'the same shape inside a module-private function, where every caller is in this directory',
    scannedFor: 'the same, in a function without the `export` modifier',
    reachableFromOutside: false,
  }),
  Object.freeze({
    id: 'module-mutable-state',
    what: 'a write into a module-level binding a later read can see',
    scannedFor: 'a member assignment or a mutating call whose receiver resolves to a MODULE-SCOPE variable',
    reachableFromOutside: true,
  }),
  Object.freeze({
    id: 'ambient-global',
    what: 'a write into something neither party owns — `globalThis`, a console, a prototype, a defined property',
    scannedFor: '`globalThis` / `console` / `process`, and `Object.defineProperty|defineProperties|assign|setPrototypeOf`',
    reachableFromOutside: true,
  }),
  Object.freeze({
    id: 'lazy-member',
    what: 'a value computed when the CALLER reads it — an accessor, `toString`, `toJSON`, `valueOf`, `Symbol.toPrimitive`',
    scannedFor: 'a get/set accessor declaration, or a member named for one of the coercion protocols',
    reachableFromOutside: true,
  }),
  Object.freeze({
    id: 'returned-closure',
    what: 'a function handed back, whose RESULT is the payload and which only the caller can invoke',
    scannedFor: 'a function expression, arrow or method reachable from a `return` through object/array literals, spreads, casts, `?:`, `??` and `Object.freeze`, or a declared function-typed return',
    reachableFromOutside: true,
  }),
  Object.freeze({
    id: 'deferred-completion',
    what: 'a value delivered after the call returns — `async`, a generator, a thenable',
    scannedFor: 'an `async` modifier, a generator asterisk, `new Promise`, or a `then` member',
    reachableFromOutside: true,
  }),
]);

const CHANNEL_IDS: readonly ChannelId[] = Object.freeze(ESCAPE_CHANNELS.map((channel) => channel.id));

interface ChannelCensus {
  /** Site keys per channel, `module.ts#enclosing#detail`. */
  readonly sites: Readonly<Record<ChannelId, readonly string[]>>;
  /** The same, counted per module, which is what the pin below is over. */
  readonly byModule: Readonly<Record<ChannelId, Readonly<Record<string, number>>>>;
  /**
   * Mutating calls whose receiver is a fresh expression rather than a binding.
   *
   * `[...list].sort()` sorts a copy and hands nothing to anybody. They are
   * counted and NAMED rather than dropped, because "the scan found something it
   * could not classify" is the one outcome a census must not swallow: an
   * unclassified escape-shaped node is exactly where the next channel arrives.
   */
  readonly freshReceivers: readonly string[];
  /**
   * Every CALL in the directory, by what its callee resolves to.
   *
   * The arm census CLAUDE.md's "a domain says which inputs you offered, not
   * which branches ran" asks for, applied to a scan rather than to a drive: the
   * arms the resolver DECLARES are `OWNER_KINDS` and the arms the walk REACHED
   * are the non-zero entries here, and both are pinned. An arm that stops being
   * produced is red, an arm that starts being produced is red, and nothing
   * lands outside the table.
   */
  readonly callTargets: Readonly<Record<OwnerKind, number>>;
  /** The same for every write, by whose memory the receiver resolves to. */
  readonly writeOwners: Readonly<Record<OwnerKind, number>>;
  /**
   * Every method called ON a caller-supplied value, named individually.
   *
   * The `member-of-parameter` arm is not empty and pinning it as a count alone
   * would be the weaker half. `sink.report(<a banned name>)` is a call into a
   * function the caller supplied, reached through a property rather than
   * through a parameter binding, and it sits in this arm beside fifteen
   * ordinary reads like `trainedDays.includes(day)`. This walk cannot tell
   * those apart — the method was on the object before the call — so the arm is
   * enumerated by name instead, the way `DECLARED_FRESH_RECEIVERS` is, and a
   * sixteenth is a line somebody signs rather than a number that drifts.
   */
  readonly memberCallsOnParameters: readonly string[];
  /**
   * What is actually passed at every internal callback parameter, by syntax.
   *
   * THE CHECK BEHIND THE ONE JUDGEMENT IN THIS SECTION, and it was very nearly
   * left as a sentence. `internal-callback-invocation` is classified as not
   * reachable from outside because the function whose parameter is called is
   * not exported — but a non-exported function can still receive a
   * CALLER-SUPPLIED function, if an exported one passes its own parameter
   * through. `export function f(cb) { return axesWhere(builds, cb); }` is that
   * shape exactly, and it would make the internal channel an escape route while
   * every `export` modifier stayed where it is.
   *
   * So the classification is checked rather than asserted: every argument at an
   * internal callback's parameter position is resolved and its SYNTAX recorded.
   * A function literal is written here and cannot have come from a caller; an
   * identifier might have, and reddens the pin below until somebody looks.
   */
  readonly internalCallbackArguments: readonly string[];
  /**
   * Every call to the throw wrap, resolved through the checker.
   *
   * The other side of the raw-throw pin, and it is here rather than in a
   * separate walk for the reason instrument C gives about matching a callee by
   * TEXT: a local shim spelled `refuseWith` is a different symbol, and this
   * follows the symbol rather than the spelling. So a module that stopped
   * importing the wrap and grew its own does not keep its rows here — it loses
   * them, and gains a raw `throw` in the channel above at the same time.
   *
   * Counted per module, because the zero this pin is about is per module: a
   * module with no wrap calls and no throws hands nothing out abruptly, and a
   * module with throws and no wrap calls is the thing being ruled out.
   */
  readonly wrapCalls: Readonly<Record<string, number>>;
  readonly nodesExamined: number;
  readonly modules: readonly string[];
}

const emptyChannelTable = <T>(make: () => T): Record<ChannelId, T> => {
  const table = {} as Record<ChannelId, T>;
  for (const id of CHANNEL_IDS) table[id] = make();
  return table;
};

/**
 * The wrap every abrupt completion in this directory is written as a call to.
 *
 * Named here rather than spelled at the three sites that use it, and split into
 * a function name and a module so the census can require BOTH — a shim spelled
 * `refuseWith` in another module resolves to a declaration in that module and
 * is not this one.
 */
const THROW_WRAP_NAME = 'refuseWith';
const THROW_WRAP_MODULE = 'empireCore.ts';

/** The mutating methods whose receiver is written through. */
const MUTATING_METHODS: readonly string[] = Object.freeze([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
  'set',
  'add',
  'delete',
  'clear',
]);

/** The `Object` statics that write into, or hang machinery off, something else. */
const AMBIENT_STATICS: readonly string[] = Object.freeze([
  'defineProperty',
  'defineProperties',
  'setPrototypeOf',
  'assign',
]);

/** The identifiers that are somebody else's memory by definition. */
const AMBIENT_OBJECTS: readonly string[] = Object.freeze(['globalThis', 'console', 'process']);

/** The member names a caller's coercion reaches without ever writing a call. */
const COERCION_MEMBERS: readonly string[] = Object.freeze(['toString', 'toJSON', 'valueOf']);

/** The member `await` calls. A thenable is a deferred completion with no `Promise` in it. */
const THENABLE_MEMBER = 'then';

/**
 * How many alias hops the resolver follows before it gives up and says so.
 *
 * A cost knob and a termination guard, not a coverage one: `const a = b; const
 * b2 = a;` is a chain, and a cycle the checker admits would otherwise spin.
 * Giving up is recorded as `unclassified` and named, never as "no channel".
 */
const ALIAS_HOPS_MAX = 64;

/**
 * The arms a receiver or a callee can resolve to, enumerated.
 *
 * Every write and every call in the directory lands in exactly one of these,
 * and the census pins the count per arm. That is what replaces the silent
 * `else`: before this round the mutation arm had three branches and the
 * callback arm one, and anything matching none of them was recorded under no
 * channel and in no list. Two arms are impossible for a write, because
 * `receiverRoot` strips member access before resolving; they are pinned at zero
 * rather than omitted, so a walk that started producing them is red.
 */
type OwnerKind =
  | 'parameter'
  | 'module-variable'
  | 'local'
  | 'function'
  | 'member'
  | 'member-callback'
  | 'member-of-parameter'
  | 'fresh'
  | 'unclassified';

const OWNER_KINDS: readonly OwnerKind[] = Object.freeze([
  'parameter',
  'module-variable',
  'local',
  'function',
  'member',
  'member-callback',
  'member-of-parameter',
  'fresh',
  'unclassified',
]);

interface ResolvedOwner {
  readonly kind: OwnerKind;
  /** The declaration the chain ended at, for the joins that need identity. */
  readonly declaration: ts.Node | null;
  /** Enough to name the site in a failure message. */
  readonly detail: string;
}

const emptyOwnerTable = (): Record<OwnerKind, number> => {
  const table = {} as Record<OwnerKind, number>;
  for (const kind of OWNER_KINDS) table[kind] = 0;
  return table;
};

/**
 * Walk the shipped modules and count every escape site, by channel.
 *
 * The receiver of a write is resolved THROUGH THE CHECKER, not by its text, for
 * the reason instrument C states at `constructorCensusOf`: a name match cannot
 * tell a parameter from a local that shadows one, and this scan's whole verdict
 * is "whose memory is this".
 */
function channelCensusOf(
  roots: readonly string[],
  probeText: string | null,
  probePath: string = PROBE_PATH,
): ChannelCensus {
  const options = compilerOptions();
  const program = programWith(options, roots, probeText, probePath);
  const checker = program.getTypeChecker();

  const sites = emptyChannelTable<string[]>(() => []);
  const byModule = emptyChannelTable<Record<string, number>>(() => ({}));
  const freshReceivers: string[] = [];
  const callTargets = emptyOwnerTable();
  const writeOwners = emptyOwnerTable();
  const memberCallsOnParameters: string[] = [];
  const internalCallbackArguments: string[] = [];
  const wrapCalls: Record<string, number> = {};
  const modules: string[] = [];
  let nodesExamined = 0;

  const record = (id: ChannelId, moduleName: string, key: string): void => {
    sites[id].push(key);
    byModule[id][moduleName] = (byModule[id][moduleName] ?? 0) + 1;
  };

  const resolvedDeclaration = (node: ts.Node): ts.Declaration | null => {
    if (!ts.isIdentifier(node)) return null;
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol === undefined) return null;
    if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) symbol = checker.getAliasedSymbol(symbol);
    // THE VALUE DECLARATION FIRST, and the reason is measured rather than
    // tidy. `declarations[0]` for `String` is `interface String` — the type
    // half of a merged declaration — so 26 calls in this directory resolved to
    // an `InterfaceDeclaration` and would have been filed as unclassifiable.
    // A call invokes a VALUE, so the value declaration is the one to follow.
    return symbol.valueDeclaration ?? symbol.declarations?.[0] ?? null;
  };

  /**
   * Past every cast, parenthesis and non-null assertion — and nothing else.
   *
   * Split out of `receiverRoot` because a callee is not a receiver: in `a.b()`
   * the thing CALLED is `b` and the thing WRITTEN is `a`, and a single stripper
   * that removed member access as well could not tell those two apart. The
   * twelfth bypass lived in exactly that confusion, one level up.
   */
  const past = (expression: ts.Expression): ts.Expression => {
    let at: ts.Expression = expression;
    for (;;) {
      if (
        ts.isNonNullExpression(at) ||
        ts.isParenthesizedExpression(at) ||
        ts.isAsExpression(at) ||
        ts.isSatisfiesExpression(at) ||
        ts.isTypeAssertionExpression(at)
      ) {
        at = at.expression;
        continue;
      }
      return at;
    }
  };

  /** The root of a member chain: `a.b[c].d` is `a`, past any cast or parenthesis. */
  const receiverRoot = (expression: ts.Expression): ts.Expression => {
    let at: ts.Expression = past(expression);
    for (;;) {
      if (ts.isPropertyAccessExpression(at) || ts.isElementAccessExpression(at)) {
        at = past(at.expression);
        continue;
      }
      return at;
    }
  };

  const atModuleScope = (declaration: ts.Declaration): boolean => {
    for (let at: ts.Node | undefined = declaration.parent; at !== undefined; at = at.parent) {
      if (ts.isSourceFile(at)) return true;
      if (ts.isFunctionLike(at)) return false;
    }
    return false;
  };

  /** The named thing a node sits inside. Same rule instrument C uses. */
  const enclosing = (node: ts.Node): string => {
    let variable: string | null = null;
    for (let at: ts.Node | undefined = node.parent; at !== undefined; at = at.parent) {
      if (ts.isFunctionDeclaration(at) && at.name !== undefined) return at.name.text;
      if (ts.isMethodDeclaration(at) && ts.isIdentifier(at.name)) return at.name.text;
      if (variable === null && ts.isVariableDeclaration(at) && ts.isIdentifier(at.name)) {
        variable = at.name.text;
      }
    }
    return variable ?? '#module';
  };

  const isExported = (declaration: ts.Node): boolean =>
    ts.canHaveModifiers(declaration) &&
    (ts.getModifiers(declaration) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

  /** A destructured binding stands for whatever the pattern was destructured FROM. */
  const bindingHost = (declaration: ts.Declaration): ts.Node => {
    let at: ts.Node = declaration;
    while (ts.isBindingElement(at) || ts.isObjectBindingPattern(at) || ts.isArrayBindingPattern(at)) {
      at = at.parent;
    }
    return at;
  };

  const nameOf = (node: ts.Node): string => {
    if (
      (ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) &&
      node.name !== undefined
    ) {
      return node.name.getText(node.getSourceFile());
    }
    return ts.SyntaxKind[node.kind];
  };

  /**
   * Whose binding an expression resolves to, FOLLOWING ALIASES.
   *
   * This is the reformulation the twelfth bypass forced, and the whole of it is
   * that "which spelling did the author use" becomes "which symbol is invoked".
   * The walk already resolved symbols one channel over — the throw wrap is
   * matched by declaration and not by text — and the callback arm matched a
   * bare `Identifier` whose declaration happened to be a `Parameter`. A local
   * alias of that parameter, cast or not, is a `VariableDeclaration`, so the
   * arm missed it and there was no `else` to notice.
   *
   * Its limit, stated because no resolution reaches past it: a callee that is
   * the RESULT of a call — `pick()(slot, name)` — has no declaration to
   * resolve, and this returns `fresh` for it. That is not silence: `fresh` and
   * `unclassified` are both named into `freshReceivers` and counted in the arm
   * census, so the outcome is "somebody look at this line" rather than "no
   * channel". The named catcher for that route is `DECLARED_FRESH_RECEIVERS`,
   * which is a set equality in both directions.
   */
  const ownerOf = (expression: ts.Expression): ResolvedOwner => {
    const seen = new Set<ts.Node>();
    let at: ts.Expression = receiverRoot(expression);
    for (let guard = 0; guard < ALIAS_HOPS_MAX; guard += 1) {
      if (!ts.isIdentifier(at)) {
        return { kind: 'fresh', declaration: null, detail: ts.SyntaxKind[at.kind] };
      }
      const resolved = resolvedDeclaration(at);
      if (resolved === null) {
        return { kind: 'unclassified', declaration: null, detail: `unresolved:${at.text}` };
      }
      const host = bindingHost(resolved);
      if (ts.isParameter(host)) {
        return { kind: 'parameter', declaration: host, detail: nameOf(host) };
      }
      if (
        ts.isFunctionDeclaration(host) ||
        ts.isMethodDeclaration(host) ||
        ts.isFunctionExpression(host) ||
        ts.isArrowFunction(host) ||
        ts.isClassDeclaration(host)
      ) {
        return { kind: 'function', declaration: host, detail: nameOf(host) };
      }
      if (ts.isVariableDeclaration(host)) {
        const initial = host.initializer === undefined ? null : receiverRoot(host.initializer);
        if (initial !== null && ts.isIdentifier(initial) && !seen.has(initial)) {
          seen.add(initial);
          at = initial;
          continue;
        }
        if (initial !== null && (ts.isArrowFunction(initial) || ts.isFunctionExpression(initial))) {
          return { kind: 'function', declaration: host, detail: nameOf(host) };
        }
        return {
          kind: atModuleScope(host) ? 'module-variable' : 'local',
          declaration: host,
          detail: nameOf(host),
        };
      }
      return { kind: 'unclassified', declaration: host, detail: ts.SyntaxKind[host.kind] };
    }
    return { kind: 'unclassified', declaration: null, detail: 'alias-cycle' };
  };

  /**
   * What a CALL invokes, which is a different question from whose memory a
   * write lands in.
   *
   * `a.b()` is a `member` call and its holder is resolved separately, because
   * calling a method on a value the caller handed in is a route this walk can
   * SEE but cannot classify — a method that was already on the object is the
   * caller's own code only if the caller supplied the object AND the function.
   * It is counted as its own arm, `member-of-parameter`, and pinned at whatever
   * the directory really has rather than folded into the callback channel.
   */
  const callTargetOf = (expression: ts.Expression): ResolvedOwner => {
    const at = past(expression);
    if (ts.isPropertyAccessExpression(at) || ts.isElementAccessExpression(at)) {
      const holder = ownerOf(at.expression);
      if (holder.kind !== 'parameter') {
        return {
          kind: 'member',
          declaration: holder.declaration,
          detail: `member-of-${holder.kind}:${holder.detail}`,
        };
      }
      const member = ts.isPropertyAccessExpression(at) ? at.name : null;
      const declared = member === null ? null : resolvedDeclaration(member);
      // THE ONE THING THAT SEPARATES A CALLBACK FROM A READ, and it is a
      // syntactic fact rather than a judgement: `filter` is a MethodSignature
      // that lib.d.ts put on the array type, and `gymBucksPerHour` is a
      // PROPERTY whose declared type is a function type — a slot the CALLER
      // filled. Both are `a.b()` and only the second is a call into code the
      // caller supplied.
      const callerSupplied =
        declared !== null &&
        (ts.isPropertySignature(declared) || ts.isPropertyDeclaration(declared)) &&
        declared.type !== undefined &&
        ts.isFunctionTypeNode(declared.type);
      return {
        kind: callerSupplied ? 'member-callback' : 'member-of-parameter',
        declaration: holder.declaration,
        detail: `${holder.detail}.${member === null ? ts.SyntaxKind[at.kind] : member.text}`,
      };
    }
    return ownerOf(at);
  };

  /**
   * Every function value reachable from a returned expression, by member path.
   *
   * Its limit, in the mechanism's own terms: it follows SYNTAX, so a function
   * assembled elsewhere and returned through a plain identifier — `const shape
   * = { peek }; return shape;` — is not found here. What covers that route is
   * the `local` arm of the write census plus instrument A's declared-position
   * walk, and the honest statement is that this closes the LITERAL nesting the
   * plant used and not every route to a returned function.
   */
  const returnedFunctions = (expression: ts.Expression, at: string = ''): readonly string[] => {
    const found: string[] = [];
    const walk = (node: ts.Expression, path_: string): void => {
      if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        found.push(path_ === '' ? 'return' : path_);
        return;
      }
      if (
        ts.isParenthesizedExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isNonNullExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isTypeAssertionExpression(node)
      ) {
        walk(node.expression, path_);
        return;
      }
      if (ts.isConditionalExpression(node)) {
        walk(node.whenTrue, path_);
        walk(node.whenFalse, path_);
        return;
      }
      if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
          node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
      ) {
        walk(node.left, path_);
        walk(node.right, path_);
        return;
      }
      if (ts.isObjectLiteralExpression(node)) {
        for (const property of node.properties) {
          const name = property.name === undefined ? '?' : property.name.getText(property.getSourceFile());
          if (ts.isPropertyAssignment(property)) walk(property.initializer, `${path_}.${name}`);
          else if (ts.isSpreadAssignment(property)) walk(property.expression, path_);
          else if (ts.isMethodDeclaration(property)) found.push(`${path_}.${name}`);
        }
        return;
      }
      if (ts.isArrayLiteralExpression(node)) {
        for (const [index, element] of node.elements.entries()) {
          if (ts.isSpreadElement(element)) walk(element.expression, `${path_}[]`);
          else walk(element, `${path_}[${String(index)}]`);
        }
        return;
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(node.getSourceFile()) === 'Object' &&
        node.expression.name.text === 'freeze'
      ) {
        for (const argument of node.arguments) walk(argument, path_);
      }
    };
    walk(expression, at);
    return found;
  };

  for (const root of roots) {
    const source = program.getSourceFile(root);
    if (source === undefined) throw new Error(`${root} is not in the program`);
    const moduleName = path.basename(root);
    modules.push(moduleName);
    const lineOf = (node: ts.Node): number =>
      source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const key = (node: ts.Node, detail: string): string =>
      `${moduleName}#${enclosing(node)}#${detail}`;

    /**
     * The internal callback parameters this module calls: owner declaration,
     * parameter name and index. Filled by the walk, read by the pass below it.
     *
     * A non-exported function can only be called from its own module, which is
     * what makes a single-module join sound here rather than a shortcut.
     */
    const internalOwners = new Map<ts.FunctionDeclaration, Map<number, string>>();
    const callsInModule: ts.CallExpression[] = [];

    const visit = (node: ts.Node): void => {
      nodesExamined += 1;

      if (ts.isReturnStatement(node)) record('return', moduleName, key(node, 'return'));
      if (ts.isThrowStatement(node)) record('throw', moduleName, key(node, 'throw'));

      if (ts.isVariableStatement(node) && isExported(node)) {
        for (const declaration of node.declarationList.declarations) {
          record('exported-binding', moduleName, `${moduleName}#${declaration.name.getText(source)}`);
        }
      }

      // A write into memory somebody else may hold: an assignment to a member,
      // a compound assignment, an increment, a `delete`, or a mutating method
      // call. Every one is classified by WHOSE binding the receiver resolves
      // to, which is the only question that matters here.
      //
      // THE OPERATOR RANGE RATHER THAN `EqualsToken`: until this round the
      // predicate was the one token, so `sink.kind += name` was outside the
      // scan entirely. `FirstAssignment`..`LastAssignment` is every assignment
      // operator TypeScript has, so a seventeenth one added to the language
      // arrives inside the range rather than outside it.
      const writtenMember = (expression: ts.Expression): ts.Expression | null =>
        ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)
          ? expression
          : null;
      const written: ts.Expression | null = ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
        ? writtenMember(node.left)
        : ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)
          ? (node.operator === ts.SyntaxKind.PlusPlusToken ||
            node.operator === ts.SyntaxKind.MinusMinusToken
              ? writtenMember(node.operand)
              : null)
          : ts.isDeleteExpression(node)
            ? writtenMember(node.expression)
            : ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                MUTATING_METHODS.includes(node.expression.name.text)
              ? node.expression.expression
              : null;
      if (written !== null) {
        const owner = ownerOf(written);
        writeOwners[owner.kind] += 1;
        if (owner.kind === 'parameter') {
          record('argument-mutation', moduleName, key(node, 'write'));
        } else if (owner.kind === 'module-variable') {
          record('module-mutable-state', moduleName, key(node, 'write'));
        } else if (owner.kind === 'fresh' || owner.kind === 'unclassified') {
          // The one outcome a census must not swallow. `fresh` keeps the shape
          // it has always had — `[...list].sort()` names its receiver by node
          // kind — and `unclassified` is the arm that did not exist before.
          freshReceivers.push(
            `${moduleName}:${String(lineOf(node))} receiver=${owner.kind === 'fresh' ? owner.detail : owner.kind + ':' + owner.detail}`,
          );
        }
      }

      // A call of a parameter is the module handing a value OUT through
      // machinery the caller supplied. The argument count is part of the key,
      // because that is what moves when a site starts carrying a payload it did
      // not carry before — which is exactly M27.
      if (ts.isCallExpression(node)) {
        callsInModule.push(node);
        // ONE RESOLUTION, READ BY BOTH ARMS. The wrap census and the callback
        // census used to ask the same question twice with two predicates, and
        // only one of them followed the symbol. They now share `callTargetOf`,
        // so a wrap reached through an alias counts and a parameter reached
        // through an alias is a callback — which is the twelfth bypass.
        const target = callTargetOf(node.expression);
        callTargets[target.kind] += 1;

        const declaration = target.declaration;
        if (
          target.kind === 'function' &&
          declaration !== null &&
          ts.isFunctionDeclaration(declaration) &&
          declaration.name?.text === THROW_WRAP_NAME &&
          path.basename(declaration.getSourceFile().fileName) === THROW_WRAP_MODULE
        ) {
          wrapCalls[moduleName] = (wrapCalls[moduleName] ?? 0) + 1;
        }

        if (
          (target.kind === 'parameter' || target.kind === 'member-callback') &&
          declaration !== null &&
          ts.isParameter(declaration)
        ) {
          const owner = declaration.parent;
          const ownerName =
            ts.isFunctionDeclaration(owner) && owner.name !== undefined ? owner.name.text : '#anonymous';
          const exported = isExported(owner);
          const channel: ChannelId = exported
            ? 'callback-invocation'
            : 'internal-callback-invocation';
          // KEYED BY THE PARAMETER, NOT BY THE SPELLING AT THE CALL SITE. On
          // the shipped tree the two are the same string; under an alias they
          // are not, and the key that survives a rename is the symbol's. A
          // `member-callback` keys as `roster.gymBucksPerHour`, which is the
          // parameter and the slot on it the caller filled.
          const parameterName = target.kind === 'member-callback' ? target.detail : nameOf(declaration);
          record(
            channel,
            moduleName,
            `${moduleName}#${ownerName}#${parameterName} x${String(node.arguments.length)}`,
          );
          if (!exported && ts.isFunctionDeclaration(owner)) {
            const index = owner.parameters.indexOf(declaration);
            const seen = internalOwners.get(owner) ?? new Map<number, string>();
            seen.set(index, parameterName);
            internalOwners.set(owner, seen);
          }
        } else if (target.kind === 'member-of-parameter') {
          // Enumerated rather than counted, for the reason the field's own
          // docstring gives: every one of these is a READ of a caller-supplied
          // value through a method the caller did not write, and the list is
          // what makes that checkable rather than asserted.
          memberCallsOnParameters.push(
            `${key(node, target.detail)} x${String(node.arguments.length)}`,
          );
        } else if (target.kind === 'fresh' || target.kind === 'unclassified') {
          // THE `ELSE` THAT DID NOT EXIST. A call whose callee resolves to
          // nothing this walk can name is the shape the next channel arrives
          // in, and it is named here rather than recorded under no channel at
          // all. `DECLARED_FRESH_RECEIVERS` is set-equal in both directions, so
          // one arriving is a decision somebody signs.
          freshReceivers.push(
            `${moduleName}:${String(lineOf(node))} callee=${target.kind}:${target.detail}`,
          );
        }
      }

      if (ts.isIdentifier(node) && AMBIENT_OBJECTS.includes(node.text)) {
        record('ambient-global', moduleName, key(node, node.text));
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(source) === 'Object' &&
        AMBIENT_STATICS.includes(node.expression.name.text)
      ) {
        record('ambient-global', moduleName, key(node, `Object.${node.expression.name.text}`));
      }

      if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
        record('lazy-member', moduleName, key(node, 'accessor'));
      }
      if (
        (ts.isMethodDeclaration(node) ||
          ts.isMethodSignature(node) ||
          ts.isPropertyAssignment(node) ||
          ts.isPropertySignature(node)) &&
        node.name !== undefined
      ) {
        const name = node.name.getText(source);
        if (COERCION_MEMBERS.includes(name) || /Symbol\.(toPrimitive|iterator|asyncIterator)/.test(name)) {
          record('lazy-member', moduleName, key(node, name));
        }
      }

      // A FUNCTION HANDED BACK, AT ANY DEPTH OF THE RETURNED STRUCTURE.
      //
      // This used to require the return's expression to be LITERALLY an arrow
      // or a function expression, so `return Object.freeze({ ...fields, peek:
      // () => <a banned name> }) as T` was outside it. Planted into
      // `accrueProduction` and driven: the caller gets a `peek` member and
      // calling it yields the name, `tsc --noEmit` exit 0, and the only things
      // that reddened in the whole directory were three node- and string-count
      // truncation guards — which this file has recorded four times as not the
      // check working.
      //
      // The descent goes through VALUE-CONSTRUCTION positions only — object and
      // array literals, spreads, casts, `?:`, `??`/`||`/`&&`, and the arguments
      // of `Object.freeze` — and deliberately NOT through arbitrary call
      // arguments, because `return list.map((x) => …)` hands the caller a list
      // and not the arrow.
      if (ts.isReturnStatement(node) && node.expression !== undefined) {
        for (const found of returnedFunctions(node.expression)) {
          record('returned-closure', moduleName, key(node, `closure:${found}`));
        }
      }
      if (ts.isFunctionDeclaration(node) && node.type !== undefined && ts.isFunctionTypeNode(node.type)) {
        record('returned-closure', moduleName, key(node, 'closure-type'));
      }

      if (
        ts.isFunctionLike(node) &&
        ts.canHaveModifiers(node) &&
        (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
      ) {
        record('deferred-completion', moduleName, key(node, 'async'));
      }
      if (
        (ts.isFunctionDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isMethodDeclaration(node)) &&
        node.asteriskToken !== undefined
      ) {
        record('deferred-completion', moduleName, key(node, 'generator'));
      }
      if (ts.isNewExpression(node) && node.expression.getText(source) === 'Promise') {
        record('deferred-completion', moduleName, key(node, 'promise'));
      }
      // A `then` MEMBER, which is the fourth shape and the one the probe for
      // this channel actually has. Measured rather than reasoned: the
      // `movesCensus` column below was added to find out whether each row's
      // probe is visible to the census, and this row's was not — the scan read
      // `async`, `*` and `new Promise`, and a hand-written thenable is none of
      // those while `await` reaches it exactly as it reaches a promise.
      if (
        (ts.isMethodDeclaration(node) ||
          ts.isMethodSignature(node) ||
          ts.isPropertyAssignment(node) ||
          ts.isPropertySignature(node)) &&
        node.name !== undefined &&
        node.name.getText(source) === THENABLE_MEMBER
      ) {
        record('deferred-completion', moduleName, key(node, THENABLE_MEMBER));
      }

      node.forEachChild(visit);
    };
    source.forEachChild(visit);

    // The join that checks the one judgement: for every internal callback
    // parameter, what does each caller actually pass at that position? A
    // literal was written here; an identifier could have come from anywhere,
    // including from an exported function's own parameter.
    for (const [owner, parameters] of internalOwners) {
      const ownerName = owner.name === undefined ? '#anonymous' : owner.name.text;
      for (const [index, parameterName] of parameters) {
        const kinds: string[] = [];
        for (const call of callsInModule) {
          // Through the same resolver as everything else, so a call of the
          // owner made through a local alias is joined rather than skipped.
          if (callTargetOf(call.expression).declaration !== owner) continue;
          const argument = call.arguments[index];
          kinds.push(argument === undefined ? 'missing' : ts.SyntaxKind[argument.kind]);
        }
        for (const kind of [...new Set(kinds)].sort()) {
          internalCallbackArguments.push(
            `${moduleName}#${ownerName}#${parameterName}@${String(index)} <- ${kind} x${String(
              kinds.filter((seen) => seen === kind).length,
            )}`,
          );
        }
      }
    }
  }

  const frozenSites = emptyChannelTable<readonly string[]>(() => Object.freeze([]));
  const frozenByModule = emptyChannelTable<Readonly<Record<string, number>>>(() => Object.freeze({}));
  for (const id of CHANNEL_IDS) {
    frozenSites[id] = Object.freeze([...sites[id]].sort());
    frozenByModule[id] = Object.freeze({ ...byModule[id] });
  }

  return {
    sites: Object.freeze(frozenSites),
    byModule: Object.freeze(frozenByModule),
    freshReceivers: Object.freeze([...freshReceivers].sort()),
    callTargets: Object.freeze({ ...callTargets }),
    writeOwners: Object.freeze({ ...writeOwners }),
    memberCallsOnParameters: Object.freeze([...memberCallsOnParameters].sort()),
    internalCallbackArguments: Object.freeze([...internalCallbackArguments].sort()),
    wrapCalls: Object.freeze({ ...wrapCalls }),
    nodesExamined,
    modules: Object.freeze(modules),
  };
}

let channelCensusMemo: ChannelCensus | null = null;

function channelCensus(): ChannelCensus {
  if (channelCensusMemo !== null) return channelCensusMemo;
  channelCensusMemo = channelCensusOf(shippedModulePaths(), null);
  return channelCensusMemo;
}

/**
 * Every escape site in the shipped directory, per channel per module.
 *
 * Deep-equal in both directions, so a site arriving and a site leaving are both
 * red. FOUR CHANNELS ARE EMPTY AND THEY ARE THE ONES THIS TABLE IS MOST FOR:
 * this directory writes into nobody's memory, hangs nothing off `globalThis`,
 * computes nothing lazily and defers nothing. Each of those is a channel a
 * later edit could open, and the empty object is what makes opening it red.
 *
 * The four zeros were measured, not assumed. `argument-mutation` is zero
 * because every write in the directory lands in a local: the nearest thing to a
 * counterexample is `engagement.ts`'s `grid`, whose initialiser mentions a
 * parameter and is a spread COPY of it, and the scan resolves the receiver to
 * the local rather than to the parameter, which is the right answer for the
 * question "whose memory is this".
 */
const CHANNEL_SITE_COUNTS: Readonly<Record<ChannelId, Readonly<Record<string, number>>>> =
  Object.freeze({
    return: Object.freeze({
      'empireCore.ts': 49,
      'empireInvariant.ts': 59,
      'engagement.ts': 23,
      'expansion.ts': 47,
      'npc.ts': 12,
      'production.ts': 11,
      'recruitment.ts': 9,
      'reputation.ts': 24,
      'social.ts': 31,
    }),
    /**
     * TWO, AND THE TWO ARE THE WRAP'S OWN GATES.
     *
     * It was 54 across eight modules until E19 routed every one of them through
     * `refuseWith`. What is left is `refuseForbiddenName`'s refusal and the
     * wrap's own last line, both in `empireCore.ts`, and both named in
     * `THROW_GATE_SITES` so a third is a decision somebody signs.
     */
    throw: Object.freeze({
      'empireCore.ts': 2,
    }),
    'exported-binding': Object.freeze({
      'empireCore.ts': 20,
      'empireInvariant.ts': 6,
      'empireTuning.ts': 3,
      'engagement.ts': 2,
      'expansion.ts': 7,
      'production.ts': 1,
      'recruitment.ts': 2,
      'reputation.ts': 7,
      'social.ts': 7,
    }),
    'argument-mutation': Object.freeze({}),
    'callback-invocation': Object.freeze({ 'engagement.ts': 1, 'production.ts': 2 }),
    'internal-callback-invocation': Object.freeze({ 'expansion.ts': 1 }),
    'module-mutable-state': Object.freeze({}),
    'ambient-global': Object.freeze({}),
    'lazy-member': Object.freeze({}),
    /**
     * TWO, AND THE CHANNEL WAS DECLARED EMPTY UNTIL THIS ROUND.
     *
     * `rosterRatesAt` returns a frozen object holding two arrows, which is a
     * returned closure by any reading — and the scan required the return's
     * expression to be LITERALLY an arrow, so it counted zero. The zero was a
     * fact about the scan. Both sites are named in
     * `DECLARED_RETURNED_CLOSURE_SITES`.
     */
    'returned-closure': Object.freeze({ 'empireInvariant.ts': 2 }),
    'deferred-completion': Object.freeze({}),
  });

/**
 * The two `throw` statements this directory is allowed to contain, by name.
 *
 * THE ENUMERATION THAT TURNS A WRAP INTO A FENCE. `refuseWith` contains what
 * goes through it and nothing else, so a raw `throw new RangeError(<a banned
 * name>)` written beside it would walk straight past — which is the tenth
 * bypass's shape, and it is the reason this list exists rather than the wrap
 * alone. The `throw` channel's site list is set-equal to this in both
 * directions, so a 55th raw throw is red by file and by enclosing function
 * whether or not any domain drives it, and deleting a gate is red the other way.
 *
 * WHY TWO, and both in `empireCore.ts`: `refuseForbiddenName` quotes the value
 * it refuses, so routing its own refusal through the wrap would make the two
 * mutually recursive, and the wrap's last line is the `throw` the whole
 * directory now shares. The reasoning is at `refuseWith` in `empireCore.ts`.
 *
 * ITS LIMIT, in the mechanism's own terms: this counts SITES. An existing site
 * emitting a new payload is invisible to it — the same limit instrument C
 * states for a brand constructor call — and what covers THAT for this channel is
 * `refuseWith` refusing at runtime, which is containment rather than detection
 * and fires only when the path runs. The two halves are named separately here
 * because neither is the other.
 */
const THROW_GATE_SITES: readonly string[] = Object.freeze([
  'empireCore.ts#refuseForbiddenName#throw',
  'empireCore.ts#refuseWith#throw',
]);

/**
 * Where the wrap is actually called, per module.
 *
 * The other direction of the same fence, and it is not decoration: a module
 * could satisfy `THROW_GATE_SITES` by having no `throw` at all, which is what a
 * module whose refusals were quietly deleted looks like. These counts sum to
 * the 53 sites E19 converted, and they are pinned per module so a refusal
 * leaving one module cannot be hidden by one arriving in another.
 */
const WRAP_CALL_COUNTS: Readonly<Record<string, number>> = Object.freeze({
  'empireCore.ts': 9,
  'empireInvariant.ts': 6,
  'engagement.ts': 13,
  'expansion.ts': 3,
  'production.ts': 9,
  'recruitment.ts': 1,
  'reputation.ts': 6,
  'social.ts': 6,
});

/**
 * The two callback sites, by name and with their ARGUMENT COUNT in the key.
 *
 * The count is the load-bearing part and it is there for the same reason
 * instrument C puts `x1` in a site key: the site already exists, so a set
 * equality over site NAMES would be green while the site starts carrying a
 * payload. M27 is `attended(slot, EMPIRE_FORBIDDEN_OUTPUTS[0])` — the same
 * site, one argument wider — and `x1` going to `x2` is what reddens here.
 */
const DECLARED_CALLBACK_SITES: readonly string[] = Object.freeze([
  'engagement.ts#historyFrom#attended x1',
  'production.ts#gymBucksRatePerHour#roster.gymBucksPerHour x2',
  'production.ts#trainingIqRatePerDay#roster.trainingIqPerDay x2',
]);

const DECLARED_INTERNAL_CALLBACK_SITES: readonly string[] = Object.freeze([
  'expansion.ts#axesWhere#finished x1',
]);

/**
 * What every caller passes at an internal callback's parameter position.
 *
 * TWO ARROWS AND NOTHING ELSE, which is what makes `axesWhere`'s parameter
 * unreachable from outside this directory. Both callers write the predicate at
 * the call site, so no caller-supplied function can arrive there.
 *
 * THIS PIN EXISTS BECAUSE THE MATRIX NEARLY SHIPPED AN OVER-CLAIM. The
 * `internal-callback-invocation` row reads `movesPass: true` — measured against
 * the same runtime twin as its exported sibling — and the callback pass does
 * NOT drive `axesWhere`, because nothing outside can hand it anything. That
 * reasoning is only as good as the `export` modifier being the whole story, and
 * it is not: an exported function that forwards its own callback parameter
 * would make this channel an escape route with every modifier where it is. So
 * the argument syntax is pinned rather than the conclusion asserted, and an
 * identifier appearing here reddens.
 */
const DECLARED_INTERNAL_CALLBACK_ARGUMENTS: readonly string[] = Object.freeze([
  'expansion.ts#axesWhere#finished@1 <- ArrowFunction x2',
]);

/**
 * The mutating calls whose receiver is a fresh expression, named individually.
 *
 * All three are `[...list].sort()`, which sorts a copy nobody else holds. They
 * are the scan's one unclassified outcome and they are pinned by name so a
 * fourth — which might not be a copy — is a decision somebody signs rather than
 * a number that moves.
 */
/**
 * The functions this directory hands its caller back, by member path.
 *
 * Both are `rosterRatesAt`'s two arrows, and both are the PRODUCER side of the
 * two `callback-invocation` sites `production.ts` has: this module builds the
 * closures, `production.ts` calls them, and until this round the census saw
 * neither end. The member path is in the key, so a third arrow arriving in the
 * same returned object is red rather than absorbed into a count.
 */
const DECLARED_RETURNED_CLOSURE_SITES: readonly string[] = Object.freeze([
  'empireInvariant.ts#rosterRatesAt#closure:.gymBucksPerHour',
  'empireInvariant.ts#rosterRatesAt#closure:.trainingIqPerDay',
]);

const DECLARED_FRESH_RECEIVERS: readonly string[] = Object.freeze([
  'empireInvariant.ts:637 receiver=ArrayLiteralExpression',
  'engagement.ts:355 receiver=ArrayLiteralExpression',
  'social.ts:345 receiver=ArrayLiteralExpression',
]);

/**
 * Every call in the directory, by what its callee resolves to.
 *
 * the arm census for the scan, and the reason it is here rather than in a
 * comment is that the twelfth bypass was a call recorded under NO arm. Three
 * arms are zero and they are the ones this table is most for:
 *
 *   `parameter` is the callback channel — every call of a caller-supplied
 *     function, however it is spelled, after the resolver follows aliases.
 *   `member-of-parameter` is a method called ON a caller-supplied value. Zero
 *     here, and it is a route this walk can see and deliberately does not
 *     classify as a channel: a method that was already on the object is the
 *     caller's own code only if the caller supplied both. One arriving is a
 *     decision somebody signs rather than a number that drifts.
 *   `fresh` and `unclassified` are the callee this walk could not name —
 *     `pick()(slot)`, or an identifier the checker does not resolve. Both are
 *     named individually in `DECLARED_FRESH_RECEIVERS` as well as counted.
 */
const DECLARED_CALL_TARGETS: Readonly<Record<OwnerKind, number>> = Object.freeze({
  parameter: 2,
  'module-variable': 26,
  local: 0,
  function: 501,
  member: 474,
  'member-callback': 2,
  'member-of-parameter': 13,
  fresh: 0,
  unclassified: 0,
});

/**
 * Every write in the directory, by whose memory the receiver resolves to.
 *
 * The other half of the same census, and the two zeros that matter are
 * `parameter` and `module-variable` — those are the `argument-mutation` and
 * `module-mutable-state` channels, which `CHANNEL_SITE_COUNTS` also pins empty.
 * `member` and `member-of-parameter` cannot occur here by construction, because
 * a write's receiver is resolved past its member chain; they are pinned at zero
 * rather than left off the table, so a walk that started producing one is red.
 */
const DECLARED_WRITE_OWNERS: Readonly<Record<OwnerKind, number>> = Object.freeze({
  parameter: 0,
  'module-variable': 0,
  local: 153,
  function: 0,
  member: 0,
  'member-callback': 0,
  'member-of-parameter': 0,
  fresh: 3,
  unclassified: 0,
});

/** What the census measured on the shipped tree. Counts, not bounds. */
const CHANNEL_CENSUS_TOTALS = Object.freeze({
  MODULES: 10,
  /** 376 until the wrap: 54 `throw` sites became 2, and nothing else moved. */
  SITES: 328,
  /** Nodes the walk examined. A truncated walk would report a clean directory. */
  NODES_EXAMINED: 21_789,
  /** Calls to the throw wrap, summed over `WRAP_CALL_COUNTS`. */
  WRAP_CALLS: 53,
  CHANNELS: 11,
  /** Channels with at least one site. The other five are open routes nobody uses. */
  CHANNELS_IN_USE: 6,
});

// ---------------------------------------------------------------------------
// The coverage matrix — measured per channel, not declared
// ---------------------------------------------------------------------------

/**
 * The probe module, served from memory and never written to disk.
 *
 * One export per channel, each emitting `EMPIRE_FORBIDDEN_OUTPUTS[0]` down that
 * channel in the plainest way available — a bare read of the ban list, which is
 * the shape all eleven bypasses actually used. Instruments A and C are measured
 * against THIS SOURCE, compiled beside the real directory; instrument B is
 * measured against the runtime twins below, because B reads values and a value
 * needs code that runs.
 *
 * `probeReturnMinted` is the one row that is not a channel of its own: it is the
 * return channel emitted THROUGH a brand constructor, and it is here because it
 * is the only form any probe has that instrument C can see. Without it the C
 * column would be false everywhere and would read as an instrument that does
 * nothing, when what is true is narrower and more useful — C sees mints, and no
 * channel but a branded return needs one.
 */
const CHANNEL_PROBE_SOURCE = `import { EMPIRE_FORBIDDEN_OUTPUTS, asNpcId, type NpcId } from './empireCore';

export function probeReturn(): { readonly kind: string } {
  return Object.freeze({ kind: EMPIRE_FORBIDDEN_OUTPUTS[0] as string });
}

export function probeReturnMinted(): NpcId {
  return asNpcId(EMPIRE_FORBIDDEN_OUTPUTS[0]);
}

export function probeThrow(): number {
  throw new RangeError(EMPIRE_FORBIDDEN_OUTPUTS[0]);
}

export const PROBE_BINDING: { readonly kind: string } = Object.freeze({
  kind: EMPIRE_FORBIDDEN_OUTPUTS[0] as string,
});

export function probeArgumentMutation(sink: { kind: string }): void {
  sink.kind = EMPIRE_FORBIDDEN_OUTPUTS[0];
}

export function probeCallback(report: (slot: number, label?: string) => boolean): boolean {
  return report(0, EMPIRE_FORBIDDEN_OUTPUTS[0]);
}

export const PROBE_MUTABLE: string[] = [];

export function probeModuleMutableState(): void {
  PROBE_MUTABLE.push(EMPIRE_FORBIDDEN_OUTPUTS[0]);
}

export function probeAmbientGlobal(): void {
  (globalThis as unknown as Record<string, unknown>).probeAmbientSink = EMPIRE_FORBIDDEN_OUTPUTS[0];
}

export function probeLazyMember(): { readonly slots: number; readonly toString: () => string } {
  return Object.freeze({ slots: 1, toString: (): string => EMPIRE_FORBIDDEN_OUTPUTS[0] });
}

export function probeReturnedClosure(): () => string {
  return (): string => EMPIRE_FORBIDDEN_OUTPUTS[0];
}

export interface ProbeThenable {
  readonly then: (resolve: (value: string) => void) => void;
}

export function probeDeferredCompletion(): ProbeThenable {
  return Object.freeze({ then: (resolve: (value: string) => void): void => { resolve(EMPIRE_FORBIDDEN_OUTPUTS[0]); } });
}
`;

const CHANNEL_PROBE_PATH = path.join(HERE, '__channelProbe.ts');
const CHANNEL_PROBE_MODULE = path.basename(CHANNEL_PROBE_PATH);

let channelProbeSurfaceMemo: StringSurface | null = null;

function channelProbeSurface(): StringSurface {
  if (channelProbeSurfaceMemo !== null) return channelProbeSurfaceMemo;
  channelProbeSurfaceMemo = surfaceOf(
    [...shippedModulePaths(), CHANNEL_PROBE_PATH],
    CHANNEL_PROBE_SOURCE,
    CHANNEL_PROBE_PATH,
  );
  return channelProbeSurfaceMemo;
}

let channelProbeCensusMemo: ChannelCensus | null = null;

/**
 * The channel census run over the probe module beside the shipped directory.
 *
 * The fourth column's subject. Until this round the matrix measured A, B and C
 * against the probes and never ran the CENSUS against them — so three rows
 * whose `why` named the census as their only catcher had never been measured
 * against it, and one of the three was wrong.
 */
function channelProbeCensus(): ChannelCensus {
  if (channelProbeCensusMemo !== null) return channelProbeCensusMemo;
  channelProbeCensusMemo = channelCensusOf(
    [...shippedModulePaths(), CHANNEL_PROBE_PATH],
    CHANNEL_PROBE_SOURCE,
    CHANNEL_PROBE_PATH,
  );
  return channelProbeCensusMemo;
}

let channelProbeConstructorsMemo: ConstructorCensus | null = null;

function channelProbeConstructors(): ConstructorCensus {
  if (channelProbeConstructorsMemo !== null) return channelProbeConstructorsMemo;
  channelProbeConstructorsMemo = constructorCensusOf(
    [...shippedModulePaths(), CHANNEL_PROBE_PATH],
    CHANNEL_PROBE_SOURCE,
    CHANNEL_PROBE_PATH,
  );
  return channelProbeConstructorsMemo;
}

// ---------------------------------------------------------------------------
// The runtime twins — the same eleven emissions, as code that runs
// ---------------------------------------------------------------------------

/** The name every twin emits. Read out of the ban list, never spelled. */
const PROBE_NAME: string = BANNED_VOCABULARY[0] ?? '';

/** The module-level sink the `module-mutable-state` twin writes into. */
const PROBE_MUTABLE_SINK: string[] = [];

/** The key the ambient twin writes on `globalThis`, and then removes. */
const PROBE_AMBIENT_KEY = 'empireChannelProbeSink';

interface TwinResult {
  /** The row the drive would have built for this call. Never entered in `DRIVEN_ROWS`. */
  readonly row: DrivenRow;
  /** What a caller who reads the channel the way it is MEANT to be read sees. */
  readonly observed: readonly string[];
}

/**
 * Build a probe row and read the channel as a cooperating caller would.
 *
 * THE SECOND HALF IS THE NON-VACUITY GUARD AND IT IS NOT DECORATION. Every
 * `false` in the matrix below is a claim about an instrument, and it is only
 * that if the probe really emitted. A twin that quietly stopped emitting would
 * turn every cell in its row false and the matrix would still pass. So each twin
 * also reports what a caller who USES the channel gets — the value handed to the
 * callback, the result of calling the closure, the string a coercion produces —
 * and every row is asserted to have seen the name that way.
 */
function twinFor(
  build: () => DrivenRow,
  observe: () => readonly string[],
): TwinResult {
  const row = build();
  return { row, observed: observe() };
}

/**
 * The callback twin, written once and used by both callback rows.
 *
 * The row is built with the INDIFFERENT predicate — the shape the drive really
 * hands `historyFrom`, which reads the argument it expects and ignores anything
 * else. Using a recording predicate here would measure the fix rather than the
 * instrument, and the `false` in that row is the whole finding. The recording
 * one appears only in `observed`, which is the non-vacuity half.
 */
function callbackTwin(): TwinResult {
  const indifferent = (slot: number): boolean => slot === 0;
  const widened = indifferent as (slot: number, label?: string) => boolean;
  return twinFor(
    () => rowFor('probeCallback', 'probe', () => widened(0, PROBE_NAME), [indifferent]),
    () => {
      const handed: unknown[][] = [];
      const recording = (...args: readonly unknown[]): boolean => {
        handed.push([...args]);
        return true;
      };
      recording(0, PROBE_NAME);
      return handed.flat().filter((value): value is string => typeof value === 'string');
    },
  );
}

const CHANNEL_TWINS: Readonly<Record<string, () => TwinResult>> = Object.freeze({
  return: () =>
    twinFor(
      () => rowFor('probeReturn', 'probe', () => Object.freeze({ kind: PROBE_NAME })),
      () => [Object.freeze({ kind: PROBE_NAME }).kind],
    ),
  'return-minted': () =>
    twinFor(
      () => rowFor('probeReturnMinted', 'probe', () => PROBE_NAME),
      () => [PROBE_NAME],
    ),
  throw: () =>
    twinFor(
      () =>
        rowFor('probeThrow', 'probe', () => {
          throw new RangeError(PROBE_NAME);
        }),
      () => {
        try {
          throw new RangeError(PROBE_NAME);
        } catch (error) {
          return [error instanceof Error ? error.message : ''];
        }
      },
    ),
  'exported-binding': () => {
    const binding = Object.freeze({ kind: PROBE_NAME });
    return twinFor(
      () => rowFor('PROBE_BINDING', 'probe', () => binding),
      () => [binding.kind],
    );
  },
  'argument-mutation': () => {
    const sink: { kind: string } = { kind: '' };
    return twinFor(
      () =>
        rowFor(
          'probeArgumentMutation',
          'probe',
          () => {
            sink.kind = PROBE_NAME;
            return undefined;
          },
          [sink],
        ),
      () => [sink.kind],
    );
  },
  'callback-invocation': () => callbackTwin(),
  'internal-callback-invocation': () => callbackTwin(),
  'module-mutable-state': () => {
    PROBE_MUTABLE_SINK.length = 0;
    return twinFor(
      () =>
        rowFor('probeModuleMutableState', 'probe', () => {
          PROBE_MUTABLE_SINK.push(PROBE_NAME);
          return undefined;
        }),
      () => [...PROBE_MUTABLE_SINK],
    );
  },
  'module-mutable-state-read-after': () => {
    PROBE_MUTABLE_SINK.length = 0;
    return twinFor(
      () => {
        PROBE_MUTABLE_SINK.push(PROBE_NAME);
        return rowFor('PROBE_MUTABLE', 'read', () => PROBE_MUTABLE_SINK);
      },
      () => [...PROBE_MUTABLE_SINK],
    );
  },
  'ambient-global': () => {
    const ambient = globalThis as unknown as Record<string, unknown>;
    return twinFor(
      () =>
        rowFor('probeAmbientGlobal', 'probe', () => {
          ambient[PROBE_AMBIENT_KEY] = PROBE_NAME;
          return undefined;
        }),
      () => {
        const seen = ambient[PROBE_AMBIENT_KEY];
        delete ambient[PROBE_AMBIENT_KEY];
        return typeof seen === 'string' ? [seen] : [];
      },
    );
  },
  'lazy-member': () => {
    const lazy = Object.freeze({ slots: 1, toString: (): string => PROBE_NAME });
    return twinFor(
      () => rowFor('probeLazyMember', 'probe', () => lazy),
      () => [String(lazy)],
    );
  },
  'returned-closure': () => {
    const closure = (): string => PROBE_NAME;
    return twinFor(
      () => rowFor('probeReturnedClosure', 'probe', () => closure),
      () => [closure()],
    );
  },
  'deferred-completion': () => {
    const thenable = Object.freeze({
      then: (resolve: (value: string) => void): void => {
        resolve(PROBE_NAME);
      },
    });
    return twinFor(
      () => rowFor('probeDeferredCompletion', 'probe', () => thenable),
      () => {
        const captured: string[] = [];
        thenable.then((value) => captured.push(value));
        return captured;
      },
    );
  },
});

/** Banned names a deep scan of one probe row finds, by equality under the folds. */
function bannedInRow(row: DrivenRow): readonly string[] {
  const found: string[] = [];
  for (const [, scan] of scanRow(row)) {
    for (const string of scan.strings) {
      if (BANNED_NORMALISED.has(normalise(string.value))) found.push(`${string.path}=${string.value}`);
    }
    for (const finding of scan.stackFindings) found.push(finding);
  }
  return Object.freeze(found);
}

/**
 * Which probe export, and which runtime twin, each matrix row is measured
 * against.
 *
 * Keyed by `channel|form` rather than by channel, because three channels have
 * two rows — a channel measured in two emission forms is two measurements, and
 * collapsing them onto one key is how the second form would quietly become the
 * first. A row whose key is missing from either map fails the matrix test by
 * name rather than being skipped.
 */
const PROBE_EXPORTS: Readonly<Record<string, string>> = Object.freeze({
  'return|a bare read of the ban list, returned in an object field': 'probeReturn',
  'return|the same name, minted through `asNpcId` on the way out': 'probeReturnMinted',
  'throw|a bare read of the ban list as the `RangeError` message': 'probeThrow',
  'exported-binding|a frozen exported const carrying the name': 'PROBE_BINDING',
  "argument-mutation|the name written into a caller-supplied sink's field": 'probeArgumentMutation',
  'callback-invocation|the name passed as an extra argument to a caller-supplied predicate':
    'probeCallback',
  'internal-callback-invocation|the same, in a module-private function whose callers are all in this directory':
    'probeCallback',
  'module-mutable-state|a module-level array pushed to during a call, read as the call returns':
    'probeModuleMutableState',
  'module-mutable-state|the same binding, read AFTER the write, the way `read` takes an exported const':
    'PROBE_MUTABLE',
  'ambient-global|the name written onto a `globalThis` key': 'probeAmbientGlobal',
  'lazy-member|a returned object whose `toString` yields the name': 'probeLazyMember',
  'returned-closure|a returned arrow that yields the name when called': 'probeReturnedClosure',
  'deferred-completion|a thenable that hands the name to a resolver': 'probeDeferredCompletion',
});

const TWIN_KEYS: Readonly<Record<string, string>> = Object.freeze({
  'return|the same name, minted through `asNpcId` on the way out': 'return-minted',
  'module-mutable-state|the same binding, read AFTER the write, the way `read` takes an exported const':
    'module-mutable-state-read-after',
});

interface CoverageRow {
  readonly channel: ChannelId;
  /** Which emission form of that channel this row measures. */
  readonly form: string;
  readonly movesA: boolean;
  readonly movesB: boolean;
  readonly movesC: boolean;
  /** The callback pass below. `null` where the channel has no callback to record. */
  readonly movesPass: boolean;
  /**
   * The CENSUS sees this probe's export contribute a site in this row's own
   * channel.
   *
   * A separate question from the other four, and it is the one three rows were
   * asserting about themselves in prose: "the census is the catcher" is a claim
   * that the probe's SHAPE is a shape the scan counts, and nothing measured it.
   */
  readonly movesCensus: boolean;
  readonly why: string;
}

/**
 * WHAT EACH COLUMN MEANS, because three of them mean different things and a
 * table that blurs them is worse than no table.
 *
 *   `movesA` — the probe's export contributes at least one STRING POSITION to
 *     instrument A's census. It deliberately does NOT count the export list
 *     moving: every probe export moves that, and M8 is the row that says an
 *     export count is a demand that a reviewer look, not a detection.
 *   `movesB` — a deep scan of the row the drive would have built finds the name.
 *   `movesC` — the probe's export adds a brand-constructor call site.
 *   `movesPass` — the callback pass below records the name.
 *   `movesCensus` — the CHANNEL CENSUS, run over the probe module beside the
 *     shipped directory, counts a site for that probe export IN THIS ROW'S OWN
 *     CHANNEL. It is the column that grades the sentence "the census is the
 *     catcher", which three rows made about themselves with nothing measuring
 *     it; one of the three was wrong.
 *
 * A `true` in A is not the same guarantee as a `true` in B: A sees that a
 * position of that shape EXISTS and, for a literal type, what is in it; it
 * cannot see the value in a bare or branded one. Both are worth having and
 * neither substitutes for the other, which is what the two `return` rows show —
 * the same channel, one form seen by A and B, the other seen by A, B and C.
 */
const CHANNEL_COVERAGE: readonly CoverageRow[] = Object.freeze([
  Object.freeze({
    channel: 'return',
    form: 'a bare read of the ban list, returned in an object field',
    movesA: true,
    movesB: true,
    movesC: false,
    movesPass: false,
    movesCensus: true,
    why: 'The best-covered channel in the directory, and the one every instrument was built around.',
  }),
  Object.freeze({
    channel: 'return',
    form: 'the same name, minted through `asNpcId` on the way out',
    movesA: true,
    movesB: true,
    movesC: true,
    movesPass: false,
    movesCensus: true,
    why: 'The only emission any probe here has that instrument C can see. C is a census of mints and nothing but a branded return needs one.',
  }),
  Object.freeze({
    channel: 'throw',
    form: 'a bare read of the ban list as the `RangeError` message',
    movesA: false,
    movesB: true,
    movesC: false,
    movesPass: false,
    movesCensus: true,
    why: 'M25, the tenth bypass. A thrown payload has no declared position and calls no constructor, so A and C have nothing to look at. THE DRIVE IS ITS ONLY CATCHER.',
  }),
  Object.freeze({
    channel: 'exported-binding',
    form: 'a frozen exported const carrying the name',
    movesA: true,
    movesB: true,
    movesC: false,
    movesPass: false,
    movesCensus: true,
    why: 'M7. Exported data is read rather than called, and both A and B reach it.',
  }),
  Object.freeze({
    channel: 'argument-mutation',
    form: "the name written into a caller-supplied sink's field",
    movesA: false,
    movesB: true,
    movesC: false,
    movesPass: false,
    movesCensus: true,
    why: "A walks RETURN types only — a parameter's positions are outside its census entirely. The drive re-reads every argument after the call, which is why B sees it.",
  }),
  Object.freeze({
    channel: 'callback-invocation',
    form: 'the name passed as an extra argument to a caller-supplied predicate',
    movesA: false,
    movesB: false,
    movesC: false,
    movesPass: true,
    movesCensus: true,
    why: 'M27, THE ELEVENTH BYPASS. Nothing in the three instruments sees it: no declared position, no constructor, and the drive keeps the callback it passed IN rather than what the callback was handed. The callback pass is the catcher and it was written this round.',
  }),
  Object.freeze({
    channel: 'internal-callback-invocation',
    form: 'the same, in a module-private function whose callers are all in this directory',
    movesA: false,
    movesB: false,
    movesC: false,
    movesPass: true,
    movesCensus: false,
    why: 'Measured against the same twin, because who supplies the function is a fact about the SOURCE and not about the value — the census separates the two and the runtime cannot. `movesPass` is TRUE OF THE SHAPE AND NOT OF THIS SITE: the pass does not drive `axesWhere` and never will, because both of its callers write the predicate at the call site. What accounts for this row is that nothing outside can put a value into it, pinned at DECLARED_INTERNAL_CALLBACK_ARGUMENTS rather than read off the `export` modifier. `movesCensus` is FALSE and the reason is a property of the probe rather than of the scan: this row shares `probeCallback` with the row above it, `probeCallback` carries the `export` modifier, and that modifier is exactly what the census reads to decide which of the two channels a call lands in — so one probe export cannot be measured in both. Stated rather than repaired, because a second probe export would make the A and C columns of this row measure a different subject from the row above.',
  }),
  Object.freeze({
    channel: 'module-mutable-state',
    form: 'a module-level array pushed to during a call, read as the call returns',
    movesA: false,
    movesB: false,
    movesC: false,
    movesPass: false,
    movesCensus: true,
    why: "The write happens during a call whose own return carries nothing, so the row the drive builds is empty. Order-dependent, and the row below is the other order.",
  }),
  Object.freeze({
    channel: 'module-mutable-state',
    form: 'the same binding, read AFTER the write, the way `read` takes an exported const',
    movesA: true,
    movesB: true,
    movesC: false,
    movesPass: false,
    movesCensus: false,
    why: '`movesCensus` is FALSE here and TRUE on the row above, and the two rows are the same channel: the census keys a write site by the function that PERFORMS it, so the site sits under `probeModuleMutableState` and this row is measured against the BINDING. That is the same arrival-versus-write split the rest of this sentence is about, seen by a fourth instrument. THE SAME CHANNEL ANSWERS DIFFERENTLY IN THE TWO ORDERS, which is why both rows are here. B covers it only when something reads the binding after the write, and nothing orders those two events. A moves on this row and not on the one above because the two rows are measured against different probe exports — the BINDING has a declared string position and the writer returns `void`, which is the same split as `lazy-member`: the arrival is seen and the write is not.',
  }),
  Object.freeze({
    channel: 'ambient-global',
    form: 'the name written onto a `globalThis` key',
    movesA: false,
    movesB: false,
    movesC: false,
    movesPass: false,
    movesCensus: true,
    why: 'Covered by no instrument here. The census is the whole catcher: this directory has zero ambient sites and one arriving is red.',
  }),
  Object.freeze({
    channel: 'lazy-member',
    form: 'a returned object whose `toString` yields the name',
    movesA: true,
    movesB: false,
    movesC: false,
    movesPass: false,
    movesCensus: true,
    why: "A sees the POSITION — `return.toString()` is a string position in the declared type. B does not: the walker invokes getters and never methods, which its own header states. So the arrival is caught and the payload is not.",
  }),
  Object.freeze({
    channel: 'returned-closure',
    form: 'a returned arrow that yields the name when called',
    movesA: true,
    movesB: false,
    movesC: false,
    movesPass: false,
    movesCensus: true,
    why: "Same split as the row above, and the walker's header names it: a returned function is walked for its own properties and is never called.",
  }),
  Object.freeze({
    channel: 'deferred-completion',
    form: 'a thenable that hands the name to a resolver',
    movesA: false,
    movesB: false,
    movesC: false,
    movesPass: false,
    movesCensus: true,
    why: 'The payload is an ARGUMENT to a function the caller supplies, one `then` away from the callback channel, and it is invisible for the same reason. The census is the catcher — AND THAT SENTENCE WAS FALSE UNTIL THIS ROUND, which is what the `movesCensus` column was added to find out. The scan read `async`, a generator asterisk and `new Promise`; this row\'s probe is a hand-written thenable and is none of those, so the row named as its only catcher an instrument that could not see it. Measured both ways: with the `then` member out of the scan `movesCensus` is false, with it in, true. What a planted thenable used to redden was its inner `resolve(...)` landing in `internal-callback-invocation`, which is a different check noticing by accident and in the one channel this file marks unreachable from outside.',
  }),
]);

// ---------------------------------------------------------------------------
// The callback pass — the catcher for the channel that had none
// ---------------------------------------------------------------------------

/**
 * Drive every exported function that takes a callback, with a callback that
 * RECORDS what it is handed.
 *
 * WHY IT IS A SEPARATE PASS AND NOT A WIDENING OF THE DRIVE. The main drive
 * keeps `values[0]` and the arguments it passed IN. A callback is one of those
 * arguments, and what the drive keeps is the FUNCTION, whose own properties
 * carry nothing. Making the drive's fixtures record would move every count in
 * `DRIVE_CENSUS` — 206 727 rows and 11 205 001 strings — for a channel with one
 * site, so the pass is a few extra calls beside the drive rather than a change
 * to it. Its subject list is DERIVED from the same checker walk the census uses,
 * and joined to it in both directions, so a second callback-taking export
 * reddens here until somebody drives it.
 *
 * ITS LIMIT AT E18, DECLARED BY ITS OWN BUILDER AND CLOSED BY E19: "it drives
 * the subject at one small fixture, so it is a sampling instrument like the
 * drive, and a callback payload behind a numeric branch point is outside it
 * exactly as M10 through M14 were outside the drive's domains." That is the
 * defect this codebase has recorded most often, declared in advance, and the
 * sentence is kept because the repair is only legible beside it.
 *
 * WHAT E19 CHANGED: the pass drives each subject over the same branch-point
 * domain the main drive walks its axis on — `NUMERIC_DOMAINS[subject.domain]`,
 * plus the points that domain's foreign ceiling drops, taken from the same
 * `overflowPointsFor` the overflow pass uses. It is not a second dialect: the
 * points are the registry's, the arithmetic is the registry's, and a knob added
 * to `EMPIRE_TUNING` widens this pass by construction. M29 in `PLANTED_ROUTES`
 * is the payload keyed on a branch point outside E18's three slots, measured
 * green before and red after.
 *
 * WHAT IT STILL DOES NOT CLOSE, counted rather than described:
 *
 *   - ONE AXIS PER SUBJECT. `historyFrom` takes `slots` and `trainedDays`, and
 *     the pass varies `slots`. A payload keyed on the CONTENT of `trainedDays`
 *     — its length, or a particular day in it — is outside this domain, and the
 *     honest reading of CLAUDE.md's "richness on one axis" rule is that the
 *     second axis has one point. `CALLBACK_PASS_CENSUS.AXES_VARIED` is that
 *     number rather than a silence.
 *   - THE ARITY KEY IS A DIFFERENT HALF, and E18's asymmetry is unchanged: the
 *     census's `x1` in `DECLARED_CALLBACK_SITES` catches a payload delivered as
 *     an EXTRA argument with no drive at all, at every branch point at once.
 *     This pass catches a payload smuggled into an argument the site already
 *     passes — which no site census can see — and only at points it drives.
 */
interface CallbackAxis {
  /** `subjectKey#axisName`, which is what the per-axis census is keyed by. */
  readonly name: string;
  /**
   * The `NUMERIC_DOMAINS` key whose points this axis is driven over.
   *
   * A key rather than a point list, so the domain cannot be forked here: the
   * pass reads the registry, and `NUMERIC_DOMAINS` is what the main drive and
   * the overflow pass read too.
   */
  readonly domain: keyof typeof NUMERIC_DOMAINS;
  /** What one point MEANS on this axis, so a reader can disagree with it. */
  readonly means: string;
  /** Calls the subject at one domain point with a recording callback. */
  readonly drive: (record: (args: readonly unknown[]) => void, point: number) => void;
  /**
   * How many calls the subject's own contract says it makes at one point.
   *
   * AN ORACLE OVER THE SUBJECT RATHER THAN OVER THE DOMAIN, per axis. The
   * domain appears on both sides of the comparison, so what is graded is the
   * SUBJECT: a `historyFrom` that skipped slot 0 or stopped early, or a rate
   * reader that quietly stopped asking about half the roster, is red here while
   * the literal counts stay green.
   */
  readonly callsAt: (point: number) => number;
  /** Values handed per call, so RECORDED grades the arity and not only the count. */
  readonly argumentsPerCall: number;
}

interface CallbackSubject {
  /** `module.ts#export#parameter`, derived from the checker and joined below. */
  readonly key: string;
  readonly axes: readonly CallbackAxis[];
}

/**
 * The slot count the `trainedDays` axis holds fixed while it varies the other
 * argument.
 *
 * ONE AXIS AT A TIME, WHICH IS A CHOICE WITH A PRICE AND THE PRICE IS STATED.
 * Crossing the two axes would multiply 726 813 calls by 88 points; driving them
 * separately costs 88 x 3 extra calls. What that buys is that a payload keyed
 * on `trainedDays.length` alone is inside the pass at every point of the COUNT
 * domain. What it does NOT buy is a payload keyed on a CONJUNCTION —
 * `slots === 7 && trainedDays.length === 5000` — which is outside this pass at
 * every point of both axes. That residual is real and is
 * `CALLBACK_AXIS_RESIDUAL` rather than a silence.
 *
 * Three rather than one so a subject that stopped calling its predicate on
 * later slots is still visible on this axis.
 */
const TRAINED_DAYS_AXIS_SLOTS = 3;

/** A trained-day list of a given length, ascending. The axis's own generator. */
const trainedDaysOfLength = (length: number): readonly number[] =>
  length <= 0 ? [] : Array.from({ length }, (_, index) => index);

/**
 * A `RosterRateSource` whose two members record what they were handed.
 *
 * `requireRate` refuses anything that is not a finite number at or above zero,
 * so the recorder returns zero — the pass is about what goes OUT through the
 * member, not about what comes back.
 */
const recordingRates = (record: (args: readonly unknown[]) => void): RosterRateSource =>
  Object.freeze({
    gymBucksPerHour: (...args: readonly unknown[]): number => {
      record(args);
      return 0;
    },
    trainingIqPerDay: (...args: readonly unknown[]): number => {
      record(args);
      return 0;
    },
  } as unknown as RosterRateSource);

const CALLBACK_SUBJECTS: readonly CallbackSubject[] = Object.freeze([
  Object.freeze({
    key: 'engagement.ts#historyFrom#attended',
    axes: Object.freeze([
      Object.freeze({
        name: 'engagement.ts#historyFrom#attended#slots',
        domain: 'COUNT',
        means:
          'the slot count, which is what `historyFrom` allocates one attendance entry per and calls its predicate once per',
        drive: (record: (args: readonly unknown[]) => void, point: number): void => {
          engagementModule.historyFrom(
            point,
            (...args: readonly unknown[]): boolean => {
              record(args);
              return args[0] === 0;
            },
            [point],
          );
        },
        callsAt: (point: number): number => (point >= 1 ? point : 0),
        argumentsPerCall: 1,
      }),
      Object.freeze({
        name: 'engagement.ts#historyFrom#attended#trainedDays',
        domain: 'COUNT',
        means:
          'the LENGTH of the trained-day list, which is the second injected argument and the one the twelfth bypass keyed its payload on',
        drive: (record: (args: readonly unknown[]) => void, point: number): void => {
          engagementModule.historyFrom(
            TRAINED_DAYS_AXIS_SLOTS,
            (...args: readonly unknown[]): boolean => {
              record(args);
              return args[0] === 0;
            },
            trainedDaysOfLength(point),
          );
        },
        callsAt: (): number => TRAINED_DAYS_AXIS_SLOTS,
        argumentsPerCall: 1,
      }),
    ]),
  }),
  Object.freeze({
    key: 'production.ts#gymBucksRatePerHour#roster.gymBucksPerHour',
    axes: Object.freeze([
      Object.freeze({
        name: 'production.ts#gymBucksRatePerHour#roster.gymBucksPerHour#rosterSize',
        domain: 'ROSTER_SHAPE',
        means:
          'the roster size, which is what `gymBucksRatePerHour` asks the caller-supplied rate source about once per lifter who has joined',
        drive: (record: (args: readonly unknown[]) => void, point: number): void => {
          productionModule.gymBucksRatePerHour(
            overflowState(point),
            OVERFLOW_CLOCK,
            recordingRates(record),
          );
        },
        callsAt: (point: number): number => (point >= 1 ? point : 0),
        argumentsPerCall: 2,
      }),
    ]),
  }),
  Object.freeze({
    key: 'production.ts#trainingIqRatePerDay#roster.trainingIqPerDay',
    axes: Object.freeze([
      Object.freeze({
        name: 'production.ts#trainingIqRatePerDay#roster.trainingIqPerDay#rosterSize',
        domain: 'ROSTER_SHAPE',
        means:
          'the roster size, which is what `trainingIqRatePerDay` asks the caller-supplied rate source about once per lifter whose recruitment has settled',
        drive: (record: (args: readonly unknown[]) => void, point: number): void => {
          productionModule.trainingIqRatePerDay(
            overflowState(point),
            OVERFLOW_CLOCK,
            recordingRates(record),
          );
        },
        callsAt: (point: number): number => (point >= 1 ? point : 0),
        argumentsPerCall: 2,
      }),
    ]),
  }),
]);

/**
 * How many recorded calls the pass buffers before it scans them.
 *
 * A COST KNOB AND NOT A COVERAGE ONE, which is the only reason it is allowed to
 * exist: every recorded call is scanned, and this decides how many are scanned
 * at once. A buffer of one would run `deepScan`'s setup 1.9 million times; no
 * buffer at all would hold every argument of every point in memory, which is
 * what the E18 shape did at three calls and does not survive a domain whose
 * largest point is six figures.
 *
 * `CALLBACK_PASS_CENSUS.RECORDED` is the count that keeps it honest: it is the
 * number of values that went THROUGH the buffer, so a buffer that dropped a
 * batch reports a smaller number rather than a clean scan.
 */
const CALLBACK_SCAN_BATCH = 4096;

/**
 * How many findings the pass keeps by name, per subject.
 *
 * EVERY finding is COUNTED — `CallbackPassResult.findingCount` is exact and is
 * what the zero is pinned on. This caps only the NAMED list, because a payload
 * handed to every call at a 5 000-slot point produces 5 000 identical-shaped
 * findings and a failure message with 5 000 lines in it is the "fails uselessly"
 * half of CLAUDE.md's rule wearing the costume of thoroughness. Eight is enough
 * to show the point, the argument index and the value.
 */
const CALLBACK_FINDING_SAMPLE = 8;

/**
 * The tripwire subject: a function that hands its callback a banned name.
 *
 * Not shipped and never exported — it is the pass's non-vacuity guard, in the
 * same role `instrument B bites` plays for the drive. Without it a zero here
 * would be a zero about a pass that records nothing.
 */
function callbackTripwire(record: (args: readonly unknown[]) => void, point: number): void {
  const hand = (report: (slot: number, label: string) => boolean): void => {
    for (let slot = 0; slot < point; slot += 1) report(slot, PROBE_NAME);
  };
  hand((slot, label) => {
    record([slot, label]);
    return true;
  });
}

interface CallbackPassResult {
  readonly calls: number;
  readonly recorded: number;
  /** Domain points the subject accepted, and points its own guard refused. */
  readonly points: number;
  readonly refusedPoints: number;
  /** Up to `CALLBACK_FINDING_SAMPLE` findings by name, for the failure message. */
  readonly findings: readonly string[];
  /** Every finding, counted. This is the number the zero is pinned on. */
  readonly findingCount: number;
}

/**
 * The points one callback subject is driven at.
 *
 * The domain's own points plus the ones its foreign ceiling drops, deduplicated
 * and ascending. Read off `NUMERIC_DOMAINS` and `overflowPointsFor` rather than
 * listed, which is what makes a knob added to `EMPIRE_TUNING` widen this pass
 * with nobody remembering to.
 */
function callbackPointsFor(name: keyof typeof NUMERIC_DOMAINS): readonly number[] {
  const domain = NUMERIC_DOMAINS[name];
  return numeric([...domain.points, ...overflowPointsFor(name, domain).map((point) => point.value)]);
}

/**
 * Run one callback-taking subject over a domain and scan everything its
 * callback was handed.
 *
 * A REFUSED POINT IS COUNTED RATHER THAN SKIPPED, for the reason CLAUDE.md's
 * "a domain says which inputs you offered, not which branches ran" gives:
 * `historyFrom` refuses a slot count under one, so a domain containing 0 offers
 * a point the subject never calls its callback at. That is a fact about the
 * subject's guard and it belongs in the census beside the calls.
 */
function callbackPass(
  drive: (record: (args: readonly unknown[]) => void, point: number) => void,
  label: string,
  points: readonly number[],
): CallbackPassResult {
  const findings: string[] = [];
  let findingCount = 0;
  let calls = 0;
  let recorded = 0;
  let refusedPoints = 0;
  let buffer: unknown[][] = [];
  let at = '';
  const flush = (): void => {
    if (buffer.length === 0) return;
    const scan = deepScan(buffer, `${label}#callback`);
    for (const string of scan.strings) {
      // The POINT is in the finding, not only the batch offset. A failure that
      // says `@45000` names the branch point the payload was keyed on, which is
      // the whole subject of this widening; `[7].1=covered-day` would say only
      // that something arrived.
      if (BANNED_NORMALISED.has(normalise(string.value))) {
        findingCount += 1;
        if (findings.length < CALLBACK_FINDING_SAMPLE) {
          findings.push(`${at}${string.path}=${string.value}`);
        }
      }
    }
    buffer = [];
  };
  for (const point of points) {
    at = `@${String(point)}`;
    try {
      drive((args) => {
        calls += 1;
        recorded += args.length;
        buffer.push([...args]);
        if (buffer.length >= CALLBACK_SCAN_BATCH) flush();
      }, point);
    } catch {
      // The subject's own refusal. Counted, never swallowed silently: a domain
      // every point of which is refused would otherwise read as a clean pass.
      refusedPoints += 1;
    }
    flush();
  }
  return {
    calls,
    recorded,
    points: points.length,
    refusedPoints,
    findings: Object.freeze(findings),
    findingCount,
  };
}

/**
 * Every exported function parameter this directory ever CALLS, derived.
 *
 * Read off the census's own site keys rather than listed, so the pass's subject
 * list and the census's site list cannot drift apart: the join below is what
 * says every caller-supplied callback the directory invokes has a driver.
 */
const callbackSubjectKeys = (census: ChannelCensus): readonly string[] =>
  distinct(census.sites['callback-invocation'].map((site) => site.replace(/ x\d+$/, '')));

/**
 * The tripwire's own domain: three points, so its numbers stay small and are
 * hand-checkable — 1 + 2 + 3 calls, two values each.
 *
 * DELIBERATELY NOT THE SUBJECT'S DOMAIN. The tripwire answers "does the pass see
 * a name handed to a callback at all", which one point would settle; running it
 * over a six-figure domain would make its own pins move whenever the registry
 * moves, for no extra evidence about the pass.
 */
const CALLBACK_TRIPWIRE_POINTS: readonly number[] = Object.freeze([1, 2, 3]);

/**
 * What each axis measured, per axis rather than summed.
 *
 * SUMS HIDE AN AXIS GOING QUIET, which is the failure this table exists to
 * make red: a single CALLS total would stay honest-looking if one axis stopped
 * driving and another grew. Every axis reports its own points, refusals, calls
 * and recorded values, deep-equal in both directions.
 *
 * The `trainedDays` axis is the one this round added, and its numbers are
 * hand-checkable on purpose: 88 points x 3 slots = 264 calls, none refused,
 * because the slot count it holds fixed is admissible at every point.
 */
interface CallbackAxisCensus {
  readonly points: number;
  readonly refusedPoints: number;
  readonly calls: number;
  readonly recorded: number;
}

const DECLARED_CALLBACK_AXES: Readonly<Record<string, CallbackAxisCensus>> = Object.freeze({
  'engagement.ts#historyFrom#attended#slots': Object.freeze({
    points: 88,
    refusedPoints: 1,
    calls: 726813,
    recorded: 726813,
  }),
  'engagement.ts#historyFrom#attended#trainedDays': Object.freeze({
    points: 88,
    refusedPoints: 0,
    calls: 264,
    recorded: 264,
  }),
  'production.ts#gymBucksRatePerHour#roster.gymBucksPerHour#rosterSize': Object.freeze({
    points: 61,
    refusedPoints: 0,
    calls: 721689,
    recorded: 1443378,
  }),
  'production.ts#trainingIqRatePerDay#roster.trainingIqPerDay#rosterSize': Object.freeze({
    points: 61,
    refusedPoints: 0,
    calls: 721689,
    recorded: 1443378,
  }),
});

/**
 * What this pass still does not reach, counted rather than described.
 *
 * One entry per axis pair that is NOT crossed. The pass drives one axis at a
 * time, so a payload keyed on a conjunction of two of them is outside it, and
 * that is a residual of the shape E15 and E17 established rather than a
 * sentence at the bottom of a docstring.
 */
const CALLBACK_AXIS_RESIDUAL: readonly string[] = Object.freeze([
  'engagement.ts#historyFrom#attended: slots x trainedDays is not crossed — 88 x 88 = 7744 pairs offered as 176 points, so a payload keyed on BOTH is outside this pass',
]);

const CALLBACK_PASS_CENSUS = Object.freeze({
  SUBJECTS: 3,
  /**
   * Axes driven, summed over subjects.
   *
   * The number CLAUDE.md's "richness on one axis" rule asks for, and it was 1
   * when the twelfth bypass was planted: `historyFrom` takes `slots` and
   * `trainedDays`, the pass varied `slots`, and the bypass keyed its payload on
   * `trainedDays.length`. Four now — two on `historyFrom` and one on each rate
   * reader — with `CALLBACK_AXIS_RESIDUAL` naming what a per-axis drive still
   * cannot express.
   */
  AXES_VARIED: 4,
  /**
   * Points, refusals, calls and values, summed across every axis.
   *
   * Kept beside the per-axis table rather than instead of it: the sum is what a
   * reader checks at a glance and the table is what cannot be gamed by one axis
   * growing while another dies.
   */
  POINTS: 298,
  REFUSED_POINTS: 1,
  CALLS: 2170455,
  RECORDED: 3613833,
  FINDINGS: 0,
  /** The tripwire's own numbers, which are what the zeros above are zero against. */
  TRIPWIRE_CALLS: 6,
  TRIPWIRE_RECORDED: 12,
  TRIPWIRE_FINDINGS: 6,
});

const CHANNEL_BLOCK_TIMEOUT_MS = 90_000;

describe('the channel census — the routes a string can leave this directory by', () => {
  it(
    'derives every escape site from the shipped source, per channel per module, in both directions',
    () => {
      const census = channelCensus();
      expect(census.modules.length).toBe(CHANNEL_CENSUS_TOTALS.MODULES);
      // The table itself, deep equal. A site arriving in any channel in any
      // module moves a number; a site leaving moves one the other way.
      //
      // BEFORE THE NODE COUNT, AND THAT ORDER WAS EARNED. The node pin below is
      // a guard against a TRUNCATED WALK and it moves on any edit at all, so
      // running it first meant a planted getter reported itself as
      // `expected 21769 to be 21758` — a different check noticing, which this
      // codebase has recorded four times as not the check working. The table is
      // what says WHICH channel arrived, so it goes first.
      expect(census.byModule).toEqual(CHANNEL_SITE_COUNTS);
      let sites = 0;
      let inUse = 0;
      for (const id of CHANNEL_IDS) {
        const perModule = Object.values(CHANNEL_SITE_COUNTS[id]);
        const total = perModule.reduce((sum, count) => sum + count, 0);
        // The two halves of the census agree: the site LIST and the per-module
        // COUNTS are produced by the same walk and are checked against each
        // other, so a walk that recorded a key without counting it is red.
        expect(census.sites[id].length, id).toBe(total);
        sites += total;
        if (total > 0) inUse += 1;
      }
      expect(sites).toBe(CHANNEL_CENSUS_TOTALS.SITES);
      expect(inUse).toBe(CHANNEL_CENSUS_TOTALS.CHANNELS_IN_USE);
      // The arm censuses, deep equal in both directions. A call or a write that
      // starts resolving to a different arm moves a number here whether or not
      // it moves a channel, which is the half the twelfth bypass walked past:
      // it changed `attended x1` into a call recorded under nothing at all.
      expect(census.callTargets).toEqual(DECLARED_CALL_TARGETS);
      expect(census.writeOwners).toEqual(DECLARED_WRITE_OWNERS);
      // Every arm the type declares is a key of both tables, both directions,
      // so a ninth arm cannot be counted without a row describing it.
      expect([...Object.keys(DECLARED_CALL_TARGETS)].sort()).toEqual([...OWNER_KINDS].sort());
      expect([...Object.keys(DECLARED_WRITE_OWNERS)].sort()).toEqual([...OWNER_KINDS].sort());
      // The truncation guard, last. A walk that gave up early would report a
      // directory with fewer escape routes than it has, which is the reassuring
      // direction and the one a census must not fail in quietly.
      expect(census.nodesExamined).toBe(CHANNEL_CENSUS_TOTALS.NODES_EXAMINED);
      expect(CHANNEL_IDS.length).toBe(CHANNEL_CENSUS_TOTALS.CHANNELS);
      // Every declared channel is scanned for, and nothing is scanned for that
      // is not declared. The set equality is over the table's OWN keys, so a
      // twelfth channel cannot be counted without a row describing it.
      expect(distinct([...Object.keys(CHANNEL_SITE_COUNTS)])).toEqual(distinct([...CHANNEL_IDS]));
      expect(distinct(ESCAPE_CHANNELS.map((channel) => channel.id))).toEqual(distinct([...CHANNEL_IDS]));
      for (const channel of ESCAPE_CHANNELS) {
        expect(channel.what.length, channel.id).toBeGreaterThan(40);
        expect(channel.scannedFor.length, channel.id).toBeGreaterThan(30);
      }
    },
    CHANNEL_BLOCK_TIMEOUT_MS,
  );

  it(
    'every throw in this directory is written as a call to the wrap',
    () => {
      const census = channelCensus();
      // THE SITES FIRST, because this is the assertion that names the file and
      // the enclosing function when a raw throw arrives. `expected 3 to be 2`
      // says a throw appeared; `+ "production.ts#offlineSeconds#throw"` says
      // where. Same ordering argument the site table above records.
      const raw = census.sites.throw.filter((site) => !THROW_GATE_SITES.includes(site));
      expect(raw).toEqual([]);
      // Set equality in both directions, so deleting a gate is red as well.
      expect(census.sites.throw).toEqual(THROW_GATE_SITES);
      // And the other direction of the fence: the wrap is really called, per
      // module, so the zero above cannot be satisfied by a directory that
      // stopped refusing anything at all.
      expect(census.wrapCalls).toEqual(WRAP_CALL_COUNTS);
      const wrapCalls = Object.values(census.wrapCalls).reduce((sum, count) => sum + count, 0);
      expect(wrapCalls).toBe(CHANNEL_CENSUS_TOTALS.WRAP_CALLS);
      // Every module that hands anything out abruptly does it through the wrap:
      // the modules with wrap calls are exactly the modules that had throws
      // before E19, and `empireCore.ts` is on both lists because it holds the
      // gates. Stated as a set rather than a count so a module going silent is
      // red rather than compensated for by another getting louder.
      expect(Object.keys(census.wrapCalls).sort()).toEqual([...Object.keys(WRAP_CALL_COUNTS)].sort());
    },
    CHANNEL_BLOCK_TIMEOUT_MS,
  );

  it(
    'pins the two callback sites with their ARGUMENT COUNT, which is what M27 moves',
    () => {
      const census = channelCensus();
      expect(census.sites['callback-invocation']).toEqual(DECLARED_CALLBACK_SITES);
      expect(census.sites['internal-callback-invocation']).toEqual(DECLARED_INTERNAL_CALLBACK_SITES);
      // The four empty channels, by name and in both directions. These are the
      // routes this directory does not use, and the emptiness is the check.
      expect(
        CHANNEL_IDS.filter((id) => census.sites[id].length === 0),
      ).toEqual([
        'argument-mutation',
        'module-mutable-state',
        'ambient-global',
        'lazy-member',
        'deferred-completion',
      ]);
      // The returned closures, by name. A third is a decision somebody signs.
      expect(census.sites['returned-closure']).toEqual(DECLARED_RETURNED_CLOSURE_SITES);
      // And the scan's one unclassified outcome, named rather than dropped.
      expect(census.freshReceivers).toEqual(DECLARED_FRESH_RECEIVERS);
      // The populated arm the census cannot classify, enumerated rather than
      // counted. A call into a caller-supplied function reached through a
      // property lands here and is red by name.
      expect(census.memberCallsOnParameters).toEqual(DECLARED_MEMBER_CALLS_ON_PARAMETERS);
      // The check behind the one judgement: nothing caller-supplied can reach
      // the internal callback, and that is measured off the argument syntax
      // rather than inferred from the `export` modifier.
      expect(census.internalCallbackArguments).toEqual(DECLARED_INTERNAL_CALLBACK_ARGUMENTS);
      for (const argument of census.internalCallbackArguments) {
        expect(argument, 'an internal callback is handed something written elsewhere').toMatch(
          /<- (?:ArrowFunction|FunctionExpression) x\d+$/,
        );
      }
    },
    CHANNEL_BLOCK_TIMEOUT_MS,
  );

  it(
    'measures every cell of the coverage matrix rather than declaring it',
    () => {
      const surface = channelProbeSurface();
      // A refusal below has to be a classification and not a compile error.
      expect(surface.sourceDiagnostics, surface.sourceDiagnostics.join(' | ')).toEqual([]);
      expect(surface.depthCuts).toBe(SURFACE_CENSUS.DEPTH_CUTS);
      const constructors = channelProbeConstructors();
      const probeCensus = channelProbeCensus();

      const probeExportFor = (row: CoverageRow): string => PROBE_EXPORTS[`${row.channel}|${row.form}`] ?? '';
      const twinFor_ = (row: CoverageRow): TwinResult => {
        const twin = CHANNEL_TWINS[TWIN_KEYS[`${row.channel}|${row.form}`] ?? row.channel];
        if (twin === undefined) throw new Error(`no runtime twin for ${row.channel}/${row.form}`);
        return twin();
      };

      for (const row of CHANNEL_COVERAGE) {
        const probeExport = probeExportFor(row);
        expect(probeExport, `${row.channel}/${row.form} has no probe export`).not.toBe('');

        // A: string POSITIONS contributed by the probe's export. The export
        // list moving is not counted, on purpose — see the column note above.
        const positions = surface.positions.filter(
          (position) => position.module === CHANNEL_PROBE_MODULE && position.export === probeExport,
        );
        expect(positions.length > 0, `${row.channel}/${row.form} movesA`).toBe(row.movesA);

        // C: a brand-constructor call site inside the probe's export.
        const sites = constructors.sites.filter((site) =>
          site.site.startsWith(`${CHANNEL_PROBE_MODULE}#${probeExport}#`),
        );
        expect(sites.length > 0, `${row.channel}/${row.form} movesC`).toBe(row.movesC);

        // B: the row the drive would have built, through the drive's own walker.
        const twin = twinFor_(row);
        expect(bannedInRow(twin.row).length > 0, `${row.channel}/${row.form} movesB`).toBe(row.movesB);

        // THE CENSUS: does the probe's export contribute a site in this row's
        // OWN channel? Measured rather than declared, which is the whole
        // addition — three rows named the census as their only catcher and it
        // had never been pointed at their probes.
        const probeSites = probeCensus.sites[row.channel].filter(
          (site) =>
            site.startsWith(`${CHANNEL_PROBE_MODULE}#${probeExport}#`) ||
            site === `${CHANNEL_PROBE_MODULE}#${probeExport}`,
        );
        expect(probeSites.length > 0, `${row.channel}/${row.form} movesCensus`).toBe(
          row.movesCensus,
        );

        // The non-vacuity guard: a caller who uses the channel as intended sees
        // the name. Without this every `false` above could be a dud probe.
        expect(
          twin.observed.some((value) => BANNED_NORMALISED.has(normalise(value))),
          `${row.channel}/${row.form} emitted nothing — every false in its row is meaningless`,
        ).toBe(true);
      }

      // Every channel has at least one measured row, and no row names a channel
      // the census does not scan for. Both directions.
      expect(distinct(CHANNEL_COVERAGE.map((row) => row.channel))).toEqual(distinct([...CHANNEL_IDS]));
      expect(CHANNEL_COVERAGE.length).toBe(13);
      for (const row of CHANNEL_COVERAGE) expect(row.why.length, row.channel).toBeGreaterThan(60);
    },
    CHANNEL_BLOCK_TIMEOUT_MS,
  );

  it('names the channels the drive alone covers, and the ones nothing covered', () => {
    const only = (row: CoverageRow, a: boolean, b: boolean, c: boolean): boolean =>
      row.movesA === a && row.movesB === b && row.movesC === c;
    // THE READING THIS WHOLE SECTION EXISTS FOR, and it is a reading of the
    // three INSTRUMENTS rather than of everything standing on a channel. A row
    // here has exactly as much guarantee behind it from A, B and C as a
    // sampling budget, which is what CLAUDE.md's newest rule says is not enough
    // on an unbounded input space.
    const driveAlone = CHANNEL_COVERAGE.filter((row) => only(row, false, true, false));
    expect(driveAlone.map((row) => `${row.channel}: ${row.form}`)).toEqual([
      'throw: a bare read of the ban list as the `RangeError` message',
      "argument-mutation: the name written into a caller-supplied sink's field",
    ]);
    // Of those two, ONE is a channel this directory actually uses: `throw`. The
    // other has zero sites, so what covers it today is the census saying so.
    const census = channelCensus();
    expect(
      driveAlone.filter((row) => census.sites[row.channel].length > 0).map((row) => row.channel),
    ).toEqual(['throw']);
    // AND THE SENTENCE THAT USED TO END HERE — "a sampling instrument is the
    // whole of what stands on the one channel in use" — IS THE ONE E19 MADE
    // FALSE, so it is replaced by the check that says what stands there now.
    // Every remaining `throw` site is a gate of the wrap, which is a fact about
    // the tree and not about a budget: it holds at branch points no domain
    // samples, because it is not a drive.
    expect(census.sites.throw).toEqual(THROW_GATE_SITES);
    expect(census.sites.throw.length).toBe(THROW_GATE_SITES.length);

    // And the rows no instrument moved on. Every one of them is either covered
    // by the callback pass or has zero sites and is covered by the census —
    // there is no row here that is both in use and uncovered.
    const nothing = CHANNEL_COVERAGE.filter((row) => only(row, false, false, false));
    expect(nothing.map((row) => row.channel)).toEqual([
      'callback-invocation',
      'internal-callback-invocation',
      'module-mutable-state',
      'ambient-global',
      'deferred-completion',
    ]);
    // THREE WAYS A ROW HERE CAN BE ACCOUNTED FOR, AND THEY ARE NOT THE SAME
    // THING. The pass DRIVES a channel only if the pass's subjects come from
    // it, which is the exported callback channel and nothing else; a channel
    // with no sites is covered by the census saying so; and a channel nothing
    // outside can put a value into is not an escape route at all.
    //
    // The middle and the last are weaker than a catcher and are named as such.
    // An earlier draft of this test let `movesPass` alone account for the
    // INTERNAL callback row, which was an over-claim: the pass does not drive
    // `axesWhere` and never will, because nothing can hand it anything.
    const passSubjectChannels: readonly ChannelId[] = Object.freeze(['callback-invocation']);
    const reachable = (id: ChannelId): boolean =>
      ESCAPE_CHANNELS.find((channel) => channel.id === id)?.reachableFromOutside === true;
    for (const row of nothing) {
      const driven = row.movesPass && passSubjectChannels.includes(row.channel);
      // AND THE MIDDLE ACCOUNT NOW HAS TO EARN ITSELF. "This channel has zero
      // sites and one arriving is red" is a claim that the scan can SEE the
      // shape, and until this round nothing checked that: the
      // `deferred-completion` row made exactly this claim while its own probe —
      // a hand-written thenable — was invisible to the scan. So the zero-sites
      // account requires `movesCensus`, measured against that row's probe.
      const covered =
        driven ||
        (census.sites[row.channel].length === 0 && row.movesCensus) ||
        !reachable(row.channel);
      expect(covered, `${row.channel}/${row.form} is in use and no instrument covers it`).toBe(true);
    }
    // Exactly one channel is declared unreachable from outside, by name, and
    // the pin on its argument syntax above is what stands behind that word.
    expect(CHANNEL_IDS.filter((id) => !reachable(id))).toEqual(['internal-callback-invocation']);
    // The pass covers exactly the callback channels and nothing else, in both
    // directions, so a row cannot claim it without being one.
    expect(CHANNEL_COVERAGE.filter((row) => row.movesPass).map((row) => row.channel)).toEqual([
      'callback-invocation',
      'internal-callback-invocation',
    ]);
  });

  it(
    'drives every caller-supplied callback and scans what it was handed',
    () => {
      const census = channelCensus();
      // The subject list is DERIVED from the census and joined both ways. A
      // second callback-taking export reddens here until it has a driver, and
      // that is not hypothetical: the symbol resolver found two more sites this
      // round — `RosterRateSource`'s two function-typed properties — and this
      // line is what forced them to be driven rather than noted.
      expect(CALLBACK_SUBJECTS.map((subject) => subject.key)).toEqual(callbackSubjectKeys(census));
      expect(CALLBACK_SUBJECTS.length).toBe(CALLBACK_PASS_CENSUS.SUBJECTS);

      let calls = 0;
      let recorded = 0;
      let points = 0;
      let refusedPoints = 0;
      let findingCount = 0;
      let axes = 0;
      const findings: string[] = [];
      const measured: Record<string, CallbackAxisCensus> = {};
      const contracts: {
        name: string;
        calls: number;
        contract: number;
        recorded: number;
        arity: number;
      }[] = [];
      for (const subject of CALLBACK_SUBJECTS) {
        for (const axis of subject.axes) {
          // The domain is the registry's, not this pass's: an axis names a
          // `NUMERIC_DOMAINS` key and the points come from there and from the
          // same overflow arithmetic the overflow pass uses.
          expect(axis.means.length, axis.name).toBeGreaterThan(30);
          expect(axis.name.startsWith(`${subject.key}#`), axis.name).toBe(true);
          const domainPoints = callbackPointsFor(axis.domain);
          const result = callbackPass(axis.drive, axis.name, domainPoints);
          axes += 1;
          measured[axis.name] = {
            points: result.points,
            refusedPoints: result.refusedPoints,
            calls: result.calls,
            recorded: result.recorded,
          };
          calls += result.calls;
          recorded += result.recorded;
          points += result.points;
          refusedPoints += result.refusedPoints;
          findingCount += result.findingCount;
          findings.push(...result.findings);
          // AN ORACLE OVER THE SUBJECT RATHER THAN OVER THE DOMAIN, per axis,
          // which is the half a literal cannot give. The domain appears on both
          // sides, so what is graded is the SUBJECT: a `historyFrom` that
          // skipped slot 0, stopped early or called its predicate twice is red
          // here while every literal below stays green, and so is a rate reader
          // that quietly stopped asking about part of the roster.
          //
          // COLLECTED AND ASSERTED BELOW THE FINDINGS, not here. Measured: with
          // the twelfth bypass planted, this oracle fires on the SAME axis the
          // payload arrives on, and asserting it inside the loop made a reader
          // meet `expected 267 to be 264` instead of the line naming
          // `covered-day`. That is the file's own ordering rule — the check
          // that says WHAT arrived goes before the check that says something
          // did — and it had to be applied one more time here.
          contracts.push({
            name: axis.name,
            calls: result.calls,
            contract: domainPoints.reduce((sum, point) => sum + axis.callsAt(point), 0),
            recorded: result.recorded,
            arity: result.calls * axis.argumentsPerCall,
          });
        }
      }
      // THE FINDINGS FIRST, AND THE ORDER IS DELIBERATE. Both this and the
      // counts below redden under M27, and the one a reader should meet first
      // is the one that names the value: `+ "…[0].1=covered-day"` says what
      // arrived, where `expected 6 to be 3` says only that something did.
      // CLAUDE.md's "a check that bites but fails uselessly is half a check".
      expect(findings).toEqual([]);
      // The NAMED list above is capped; this is the exact count, which is what
      // the zero is pinned on. A cap on the message must not become a cap on
      // the measurement, and these two lines are what keeps them apart.
      expect(findingCount).toBe(CALLBACK_PASS_CENSUS.FINDINGS);
      // The per-axis oracle, after the findings and before the literals.
      for (const seen of contracts) {
        expect(seen.calls, `${seen.name} against its own contract`).toBe(seen.contract);
        expect(seen.recorded, `${seen.name} arity`).toBe(seen.arity);
      }
      // PER AXIS, deep equal in both directions, BEFORE the sums. An axis that
      // stopped driving is invisible in a total and named here.
      expect(measured).toEqual(DECLARED_CALLBACK_AXES);
      expect(axes).toBe(CALLBACK_PASS_CENSUS.AXES_VARIED);
      // Counts, not bounds. A pass whose subject stopped calling its callback
      // would report zero findings and pass, so the calls are pinned too.
      expect(calls).toBe(CALLBACK_PASS_CENSUS.CALLS);
      expect(recorded).toBe(CALLBACK_PASS_CENSUS.RECORDED);
      // The domains' own sizes, and the points the subjects' guards refused.
      // The second is what says the first is a domain the subjects actually ran
      // on: `historyFrom` refuses a slot count under one, so a domain of
      // nothing but zeroes would show every point and no calls at all.
      expect(points).toBe(CALLBACK_PASS_CENSUS.POINTS);
      expect(refusedPoints).toBe(CALLBACK_PASS_CENSUS.REFUSED_POINTS);
      // And the residual, as a list rather than as a sentence. One row per
      // uncrossed axis pair.
      expect(CALLBACK_AXIS_RESIDUAL.length).toBe(1);
      for (const row of CALLBACK_AXIS_RESIDUAL) expect(row.length).toBeGreaterThan(60);
    },
    CHANNEL_BLOCK_TIMEOUT_MS,
  );

  it('drives the callback subjects over the registry domain, not a fixture of its own', () => {
    // THE JOIN THAT MAKES THE WIDENING STRUCTURAL RATHER THAN REMEMBERED. Every
    // axis's points are the ones `NUMERIC_DOMAINS` gives it plus the ones that
    // domain's ceiling drops — the same two halves the main drive and the
    // overflow pass split between them. A knob added to `EMPIRE_TUNING` widens
    // this pass with nobody editing it, and a domain that shrank is red here on
    // the per-axis table above.
    const axes = CALLBACK_SUBJECTS.flatMap((subject) => subject.axes);
    for (const axis of axes) {
      const registry = NUMERIC_DOMAINS[axis.domain];
      const points = callbackPointsFor(axis.domain);
      // Containment in both halves, so a point list that quietly dropped the
      // ceiling's overflow — which is where the eighth and tenth bypasses lived
      // on the drive's side — reports itself.
      for (const point of registry.points) expect(points, axis.name).toContain(point);
      const dropped = overflowPointsFor(axis.domain, registry);
      expect(dropped.length, `${axis.name} has no points above its ceiling`).toBeGreaterThan(0);
      for (const point of dropped) expect(points, `${axis.name} ${point.label}`).toContain(point.value);
      // And it is not merely the two lists concatenated: it straddles branch
      // points the E18 fixture could not express. Two named ones, each a real
      // branch point of this directory rather than a round number.
      expect(points).toContain(EMPIRE_TUNING.ROSTER_SLOTS_MAX);
      expect(points).toContain(EMPIRE_TUNING.REPUTATION_MAX);
    }
    // The COUNT axes, whose arithmetic is derived rather than read off a
    // failure. THIRTY-FOUR AND NOT THIRTY-THREE, and the gap is the honest
    // part: the 39 rows `overflowPointsFor` yields collapse to 33 distinct
    // VALUES — two labels can hold the same number — and a domain also carries
    // its own unit's thresholds unconditionally, straddled, wherever they sit,
    // so one more point above the ceiling arrives from there rather than from
    // the overflow.
    const count = NUMERIC_DOMAINS.COUNT;
    const countPoints = callbackPointsFor('COUNT');
    const countDropped = overflowPointsFor('COUNT', count);
    expect(distinct(countDropped.map((point) => String(point.value))).length).toBe(33);
    expect(countPoints.filter((point) => point > FOREIGN_CEILINGS.COUNT).length).toBe(34);
    expect(count.points.length).toBe(DOMAIN_CENSUS.COUNT_POINTS);
    expect(countPoints.length).toBe(DOMAIN_CENSUS.COUNT_POINTS + 33);
    // Every axis names a domain the registry has, and every axis name is
    // distinct — a duplicate would let two axes share one census row.
    expect(distinct(axes.map((axis) => axis.name)).length).toBe(axes.length);
    expect([...distinct([...Object.keys(DECLARED_CALLBACK_AXES)])].sort()).toEqual(
      [...distinct(axes.map((axis) => axis.name))].sort(),
    );
    // The number of injected axes, stated as the number it is rather than as a
    // silence. It was 1 when the twelfth bypass was planted, and the bypass
    // keyed its payload on the axis that had no points.
    expect(CALLBACK_PASS_CENSUS.AXES_VARIED).toBe(axes.length);
  });

  it('the callback pass bites — the tripwire the zero is zero against', () => {
    const result = callbackPass(callbackTripwire, 'tripwire', CALLBACK_TRIPWIRE_POINTS);
    expect(result.calls).toBe(CALLBACK_PASS_CENSUS.TRIPWIRE_CALLS);
    expect(result.recorded).toBe(CALLBACK_PASS_CENSUS.TRIPWIRE_RECORDED);
    expect(result.findingCount).toBe(CALLBACK_PASS_CENSUS.TRIPWIRE_FINDINGS);
    // Six findings and six of them named, which is under the sample cap — so
    // the tripwire also shows that the cap is not what is producing the zero.
    expect(result.findings.length).toBe(CALLBACK_PASS_CENSUS.TRIPWIRE_FINDINGS);
    expect(CALLBACK_PASS_CENSUS.TRIPWIRE_FINDINGS).toBeLessThanOrEqual(CALLBACK_FINDING_SAMPLE);
    expect(result.refusedPoints).toBe(0);
    // Named, not counted only: the failure message has to say what arrived, and
    // at which point — the two things a domain widening is about.
    for (const finding of result.findings) expect(finding).toContain(PROBE_NAME);
    expect(result.findings.some((finding) => finding.includes('@3'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PLANTED_ROUTES — what was actually run against this file, and what survived
// ---------------------------------------------------------------------------

/**
 * Thirty routes, planted into shipped modules one at a time, each run
 * against `tsc --noEmit`, against this file, and against the three accidental
 * catchers
 * the piece was told not to build on: `empireCore.test.ts`'s magic-number
 * audit, its tree-wide string census, and its import fence.
 *
 * THE COUNT IN THIS SENTENCE SAID ELEVEN WHILE THE TEST BELOW ASSERTED
 * THIRTEEN, for a round, which is this codebase's most-recorded defect wearing
 * its smallest clothes: a number written while it was true. It is fourteen in
 * both places now and the test is what keeps them together.
 *
 * M12 AND M13 WERE RE-PLANTED AND RE-RUN THIS ROUND rather than taken on
 * trust, because a fix for M14 could have reopened either — they are the two
 * routes about the same subject one axis over. Both still redden with the
 * messages recorded in their rows: `expected 9 to be 7` and the two `@10/` and
 * `@500/` offenders.
 *
 * THE ISOLATION RULE, AND IT COST FIVE EXTRA ATTEMPTS. A mutant that only trips
 * an accidental catcher has not been caught by this guard. The first attempt at
 * M3 used `?? ''` as a fallback and the empty-string literal moved
 * `singleQuoted.size`; the first attempt at M4 named its hidden property
 * `'settlement'` and did the same; the first attempts at M2 and M5 REPLACED the
 * `'Placeholder'` literal rather than keeping it, which moved the census the
 * other way. Eleven mutants took eighteen attempts. Every row below is the
 * attempt that reached isolation.
 *
 * THE CENSUS NUMBERS QUOTED IN M1–M9 ARE FROM THE RUN THAT PLANTED THEM AND NO
 * LONGER MATCH THIS FILE'S PINS. E12 moved every count in `DRIVE_CENSUS` when
 * it widened the domains, so 'expected 227 to be 226' and 'expected 53748 to be
 * 53688 nodes' are records of what reddened at the time rather than of what
 * would redden today. They are left verbatim because a re-run is the only
 * honest way to update them and none was taken; what is claimed is that each
 * route was caught, not that these exact numbers are current.
 *
 * `caughtBy` is what reddened in THIS file. `alsoRed` is every other test that
 * went red, named rather than omitted — a co-catcher is not this guard working,
 * and hiding one would let a row claim credit it has not earned.
 */
interface PlantedRoute {
  readonly id: string;
  /** The attack shape from the survey this route is an instance of. */
  readonly shape: string;
  readonly where: string;
  readonly attempts: number;
  readonly tscExit: number;
  /** Assertions in THIS file that went red. Empty means this file was blind. */
  readonly caughtBy: readonly string[];
  /** The three accidental catchers. `true` means all three stayed green. */
  readonly accidentalCatchersGreen: boolean;
  /** Other tests that also reddened, named so no row over-claims. */
  readonly alsoRed: readonly string[];
}

const PLANTED_ROUTES: readonly PlantedRoute[] = Object.freeze([
  Object.freeze({
    id: 'M1',
    shape: '1 — read the name out of the ban list; the reproduced defect, verbatim',
    where: "production.ts, a new export returning `{ readonly kind: string; readonly days: number }`",
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument A / walks the whole directory: expected 227 to be 226',
      'instrument A / pins every bare-string position: + "production.ts#idleMilestoneGrant#return.kind"',
      'instrument B / drives every export the census knows about: - "idleMilestoneGrant"',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M2',
    shape: '2 + 3 + 4 — derived selection, into an EXISTING bare-string position, inside a declaration already on COVERED_DAY_TOUCHING_FUNCTIONS',
    where: "empireInvariant.ts, `RECRUIT_DISPLAY_NAME`, with the 'Placeholder' literal kept in the file",
    attempts: 3,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / produces no banned name: expected 256 to be 7',
      'instrument B / CONTAINS no banned name: 145 offenders',
      "instrument B / pins the two strings the composed loop mints: [ 'composed-gym', 'covered-day' ]",
      'instrument B / walked a domain that is not empty: expected 636 to be 637 distinct strings',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'empireInvariant.test.ts > would catch a person-shaped name arriving in this module',
      'empireInvariant.test.ts > names every lifter it creates from a placeholder and a kebab id',
    ]),
  }),
  Object.freeze({
    id: 'M3',
    shape: '8 — the name as a computed property KEY, nested inside a returned structure, past a cast',
    where: 'production.ts, `accrueProduction`, one extra key on the returned accrual',
    attempts: 2,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / produces no banned name: expected 37 to be 7',
      'instrument B / CONTAINS no banned name: 30 offenders',
      'instrument B / walked a domain that is not empty: expected 53748 to be 53688 nodes',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M4',
    shape: '9 — a NON-ENUMERABLE accessor, on a frozen object',
    where: 'empireInvariant.ts, `gymSnapshot`, `Object.defineProperty` with an existing literal as the key',
    attempts: 2,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / produces no banned name: expected 50 to be 7',
      'instrument B / CONTAINS no banned name: 43 offenders',
      "instrument B / pins the two strings the composed loop mints: a third arrived",
      'instrument B / walked a domain that is not empty: expected 206781 to be 206695 strings',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M5',
    shape: '17 — a normalisation variant a wire decoder folds back: `COVERED-DAY`',
    where: 'empireInvariant.ts, `RECRUIT_DISPLAY_NAME`, uppercased',
    attempts: 3,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / produces no banned name: expected 256 to be 7 — the case fold, on a real subject',
      'instrument B / CONTAINS no banned name: 145 offenders',
      "instrument B / pins the two strings the composed loop mints: [ 'COVERED-DAY', 'composed-gym' ]",
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'empireInvariant.test.ts > would catch a person-shaped name arriving in this module',
      'empireInvariant.test.ts > names every lifter it creates from a placeholder and a kebab id',
    ]),
  }),
  Object.freeze({
    id: 'M6',
    shape: '19 — hide in the diagnostic channel the guard has to exempt',
    where: 'empireCore.ts, `empireStateFaults`, pushing the bare name rather than a sentence',
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / produces no banned name: expected 12 to be 7 — the EQUALITY half, which the diagnostic exemption does not cover',
      'instrument B / pins what the diagnostic channel actually said',
      'instrument B / CONTAINS no banned name: 5 offenders, via the thrown assertEmpireState message',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'empireCore.test.ts > opens a gym that satisfies every invariant',
      'empireCore.test.ts > catches every invariant it claims to catch',
      'empireCore.test.ts > refuses a purchased accelerant that arrived past the compiler',
      'empireCore.test.ts > stamps and sizes an applied accelerant, and refuses a negative size',
    ]),
  }),
  Object.freeze({
    id: 'M7',
    shape: '12 — exported DATA rather than a function return',
    where: 'production.ts, a new frozen exported const carrying the name and a per-check-in rate',
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument A / names no forbidden output in any closed literal union: expected 1176 to be 1175',
      'instrument A / walks the whole directory: expected 227 to be 226',
      'instrument B / produces no banned name: expected 8 to be 7',
      'instrument B / CONTAINS no banned name: 1 offender',
      'instrument B / drives every export the census knows about',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M8',
    shape: '16 — THE DECLARED LIMIT: a check-in-keyed day count with no name anywhere',
    where: 'production.ts, `idleProtectionDays(checkIns: number): number`',
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument A / walks the whole directory: expected 227 to be 226 — a COUNT of the export list',
      'instrument B / drives every export the census knows about: - "idleProtectionDays"',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M9',
    shape: '15 — the branded-string channel: `asNpcId(<the name>)`',
    where: 'empireCore.ts, a new export returning `NpcId`',
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument A / pins every branded-string position: expected 9 to be 8',
      'instrument A / walks the whole directory: expected 227 to be 226',
      'instrument B / drives every export the census knows about',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'empireCore.test.ts > finds every exported producer of a brand, and says how much it looked at',
    ]),
  }),
  Object.freeze({
    id: 'M10',
    shape: '20 — a forbidden name on a branch the numeric domain never reached, and then on an ARM the fixture never produced',
    where: "social.ts, `recordFriendVisit`, gymId replaced by the ban list's first member on day RIVAL_COMPARISON_PERIOD_DAYS",
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / produces no banned name: expected 9 to be 7',
      'instrument B / CONTAINS no banned name: + "recordFriendVisitrecordFriendVisit@7/sentinel-friend-gym-id-1/false#return.visits.3.gymId=covered-day"',
      'instrument B / CONTAINS no banned name: + "recordFriendVisitrecordFriendVisit@7/sentinel-friend-gym-id-1/true#return.visits.3.gymId=covered-day"',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M11',
    shape: '21 — a forbidden name written onto Error.stack in a shipped refusal path, which the walker skipped as a key AND a value',
    where: 'engagement.ts, `historyFrom`, `refusal.stack = <the ban list\'s first member>` before the throw',
    attempts: 2,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / walked a domain that is not empty: + "historyFromhistoryFrom@0/1#return.stack=covered-day"',
      'instrument B / walked a domain that is not empty: + "historyFromhistoryFrom@0/2#return.stack=covered-day"',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M12',
    shape: '22 — a threshold filed under the WRONG unit: a count used as a day, so the day domain never carried it',
    where: "social.ts, `recordFriendVisit`, gymId replaced by the ban list's first member on day FRIEND_VISITS_PER_DAY",
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / produces no banned name: expected 9 to be 7',
      'instrument B / CONTAINS no banned name: + "recordFriendVisitrecordFriendVisit@10/sentinel-friend-gym-id-1/false#return.visits.3.gymId=covered-day"',
      'instrument B / CONTAINS no banned name: + "recordFriendVisitrecordFriendVisit@10/sentinel-friend-gym-id-1/true#return.visits.3.gymId=covered-day"',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M13',
    shape: '23 — a threshold filed under NO unit, which survived the FULL domain too, because NUMBER was the union of the filed thresholds rather than of the tuning block',
    where: "social.ts, `recordFriendVisit`, gymId replaced by the ban list's first member on day NPC_RECRUIT_COST_GYM_BUCKS.novice",
    attempts: 2,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument B / produces no banned name: expected 9 to be 7',
      'instrument B / CONTAINS no banned name: + "recordFriendVisitrecordFriendVisit@500/sentinel-friend-gym-id-1/false#return.visits.3.gymId=covered-day"',
      'instrument B / CONTAINS no banned name: + "recordFriendVisitrecordFriendVisit@500/sentinel-friend-gym-id-1/true#return.visits.3.gymId=covered-day"',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      "attempt 1 keyed on CHECK_IN_TARGET_SECONDS_MAX and was caught by empireTuning.test.ts > pins the not-yet-consumed list exactly — a census of UNCONSUMED tuning entries noticing a new consumer, which has nothing to do with forbidden outputs. A FOURTH accidental catcher, and the reason attempt 2 moved to an already-consumed threshold.",
    ]),
  }),
  Object.freeze({
    id: 'M14',
    shape: "24 — THE EIGHTH BYPASS: a filed branch point ABOVE a domain's foreignCeiling, which the previous round declared as a limit with no catcher",
    where: "social.ts, `recordFriendVisit`, gymId replaced by the ban list's first member on day NPC_RECRUIT_COST_GYM_BUCKS.club — 2000, against a DAY ceiling of 600",
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'the overflow pass / produces no banned name at any point a ceiling drops: + "recordFriendVisit@DAY/NPC_RECRUIT_COST_GYM_BUCKS.club=2000#return.visits.3.gymId=covered-day", twice',
      'the overflow pass / walked a domain that is not empty at the dropped points: expected 4230 to be 4229 distinct strings',
    ]),
    accidentalCatchersGreen: true,
    // Measured on the whole of `src/empire` plus `streakEntitlement.test.ts`,
    // with the mutant in place: 2 failed of 503, and both are the two lines
    // above. Nothing else in the suite noticed, which is the whole reason this
    // pass exists — before it, nothing noticed at all.
    alsoRed: Object.freeze([]),
  }),
  // -------------------------------------------------------------------------
  // M15-M23 — THIS ROUND. The first four have `tscExit: 2`, which no earlier
  // row does, and that is the round's result rather than a change of standard.
  // A route the compiler refuses needs no domain, no drive and no allocation
  // budget, so the branch point it is keyed on stops mattering — which is
  // exactly what M15-M18 show by being keyed on four different ones and
  // producing the same refusal.
  // -------------------------------------------------------------------------
  Object.freeze({
    id: 'M15',
    shape: '25 — THE NINTH BYPASS, declared open by the previous round: a ROSTER-SIZE branch point above OVERFLOW_ALLOCATION_CEILINGS.ROSTER_SHAPE, where FOREIGN_CEILINGS said nothing is driven at all',
    where: "empireInvariant.ts, `stepGym`, PendingRecruit.id set to the ban list's first member when state.roster.length > NPC_RECRUIT_COST_GYM_BUCKS.club — 2000, the ROSTER_SHAPE ceiling",
    attempts: 1,
    tscExit: 2,
    caughtBy: Object.freeze([
      "tsc --noEmit: src/empire/empireInvariant.ts(1236,11): error TS2322: Type 'NpcId | \"covered-day\"' is not assignable to type 'NpcId'.",
      "instrument A / walks the whole directory: Type 'NpcId | \"covered-day\"' is not assignable to type 'NpcId'. … Type 'string' is not assignable to type '{ readonly [EMPIRE_BRAND]: \"npc-id\"; }'.: expected [ Array(1) ] to deeply equal []",
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'instrument A bites / compiles the probe cleanly — the same diagnostic read through the probe program. Named rather than omitted: it is one fact reported twice, not two catchers.',
      'THE MEASUREMENT THAT MAKES THIS THE HEADLINE: with the mutant in place, `npx vitest run src/empire` is 2 failed of 463 and BOTH are the diagnostic above. Instrument B is green, the overflow pass is green, and instrument C is green — nothing drives a roster of 2 001, exactly as FOREIGN_CEILINGS said. The type is the only catcher, and it did not need to be pointed at the number.',
      'THE LAST CLAUSE OF THAT IS NOW STALE AND IS ANNOTATED RATHER THAN REWRITTEN, because it is a record of what was measured on the day. Something does drive a roster of 2 001 now: the argument-region split reaches all thirty of the dropped ROSTER_SHAPE points. What the row is evidence for is unchanged — the compiler caught this route with no drive at all — and M25 is the row that shows why the drive still had to come back.',
    ]),
  }),
  Object.freeze({
    id: 'M16',
    shape: '22 replanted — the seventh bypass, first form: a threshold filed under the WRONG unit',
    where: "social.ts, `recordFriendVisit`, FriendVisit.gymId set to the ban list's first member on day FRIEND_VISITS_PER_DAY",
    attempts: 1,
    tscExit: 2,
    caughtBy: Object.freeze([
      "tsc --noEmit: src/empire/social.ts(532,9): error TS2322: Type 'GymId | \"covered-day\"' is not assignable to type 'GymId'.",
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([]),
  }),
  Object.freeze({
    id: 'M17',
    shape: '23 replanted — the seventh bypass, second form: a threshold filed under NO unit',
    where: "social.ts, `recordFriendVisit`, FriendVisit.gymId set to the ban list's first member on day NPC_RECRUIT_COST_GYM_BUCKS.novice",
    attempts: 1,
    tscExit: 2,
    caughtBy: Object.freeze([
      "tsc --noEmit: src/empire/social.ts(532,9): error TS2322: Type 'GymId | \"covered-day\"' is not assignable to type 'GymId'.",
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'BYTE-IDENTICAL DIAGNOSTIC TO M16 AND M18, AND THAT IS THE RESULT. Three different branch points — 10, 500 and 2 000 — one refusal, because the compiler is not looking at the number.',
    ]),
  }),
  Object.freeze({
    id: 'M18',
    shape: "24 replanted — the eighth bypass: a filed branch point ABOVE a domain's foreignCeiling",
    where: "social.ts, `recordFriendVisit`, FriendVisit.gymId set to the ban list's first member on day NPC_RECRUIT_COST_GYM_BUCKS.club — 2000, against a DAY ceiling of 600",
    attempts: 1,
    tscExit: 2,
    caughtBy: Object.freeze([
      "tsc --noEmit: src/empire/social.ts(532,9): error TS2322: Type 'GymId | \"covered-day\"' is not assignable to type 'GymId'.",
      "instrument A / walks the whole directory: the same diagnostic, as a vitest line",
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'the overflow pass / produces no banned name at any point a ceiling drops: + two rows, and / walked a domain that is not empty: expected 4230 to be 4229. E15 STILL CATCHES IT, which is the check that coverage did not shrink: 4 failed of 463 with the mutant in, two from the type and two from the drive.',
    ]),
  }),
  Object.freeze({
    id: 'M19',
    shape: '26 — the fault channel, where the mint is at the boundary rather than at the push, so route 1 is NOT fenced inside a `*Faults` body',
    where: "social.ts, `socialVocabularyFaults`, `faults.push(EMPIRE_FORBIDDEN_OUTPUTS[0])` as the first statement",
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument C / refuseForbiddenName, reached through asFaultMessage: RangeError: faultMessage must not be a forbidden empire output; the idle layer may not produce covered-day.',
      'instrument B / CONTAINS no banned name either, outside the diagnostic channel: expected 1 to be +0',
      'instrument B / pins what the diagnostic channel actually said: an extra row',
      'instrument B / walked a domain that is not empty: expected 11205003 to be 11205001',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'social.test.ts / reports no fault against the shipped tuning — the RangeError propagating out of a shipped-behaviour test, which is what CONTAINMENT looks like from the outside: the value never reaches a caller.',
      "instrument C / the brand constructor set is derived: expected 965 to be 964. That is CALLS_EXAMINED counting the added call expression, not the site census. Recorded as an accidental catcher inside the new instrument rather than as the new instrument working.",
      "THIS ROW IS THE PRICE OF THE BOUNDARY MINT, stated at `asFaultMessage` and measured here. `tscExit: 0` — the compiler does not refuse this, and no arrangement of 123 push-site wrappers would change that, because a template literal is a plain string either way.",
    ]),
  }),
  Object.freeze({
    id: 'M20',
    shape: '27 — ROUTE 2, the constructor route the brands cannot type away, at a branch point a domain DOES reach',
    where: "social.ts, `recordFriendVisit`, `asGymId(EMPIRE_FORBIDDEN_OUTPUTS[0])` on day NPC_RECRUIT_COST_GYM_BUCKS.club",
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument C / the brand constructor call sites are exactly the declared ones: + "social.ts#recordFriendVisit#asGymId x1"',
      'instrument C / sees a call site that is not on the list: the same row',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'the overflow pass / produces no banned name at any point a ceiling drops: + two rows carrying the refusal message. E15 catches this one too, because 2 000 is a point its allocation budget reaches.',
      "THE INSTRUMENT WAS CORRECTED BY THIS MUTANT RATHER THAN THE MUTANT BY THE INSTRUMENT. Its first run reported the site as `social.ts#visit#asGymId` — the nearest enclosing VariableDeclaration, which is a local. A site named after a local is a site a reader has to go looking for, so `enclosing` now prefers the enclosing function and a top-level constant keeps its own name.",
    ]),
  }),
  Object.freeze({
    id: 'M21',
    shape: '28 — ROUTE 2 IN THE REGION NOTHING DRIVES: the constructor route at a roster size above OVERFLOW_ALLOCATION_CEILINGS.ROSTER_SHAPE',
    where: "empireInvariant.ts, `stepGym`, `asNpcId(EMPIRE_FORBIDDEN_OUTPUTS[0])` when state.roster.length > NPC_RECRUIT_COST_GYM_BUCKS.club",
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument C / the brand constructor call sites are exactly the declared ones: - "empireInvariant.ts#stepGym#asNpcId x1", + "empireInvariant.ts#stepGym#asNpcId x2"',
      'instrument C / sees a call site that is not on the list: + "empireInvariant.ts#stepGym#asNpcId x2"',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      "instrument C / the brand constructor set is derived: expected 965 to be 964, which is CALLS_EXAMINED and not the census.",
      'THE PER-SITE COUNT IS WHAT CAUGHT IT, and that is why the count is in the key rather than beside it. The site already existed — `stepGym` already mints an `NpcId` — so a set equality over site NAMES would have been green. x1 -> x2 is the whole bite.',
      "AND NOTHING ELSE IN THE DIRECTORY NOTICED: 3 failed of 463, all three in instrument C. Instrument B green, the overflow pass green, tsc exit 0. This is the pair to M15 — same undriven region, the other route — and it is the argument for detection that does not depend on a drive.",
    ]),
  }),
  Object.freeze({
    id: 'M22',
    shape: '29 — the containment half removed: a string brand constructor that stops refusing',
    where: "empireCore.ts, `asGymId`, the `refuseForbiddenName(value, 'gymId')` line deleted",
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument C / refuses every banned name at every string brand constructor: asGymId(covered-day): expected [Function] to throw an error',
    ]),
    accidentalCatchersGreen: false,
    alsoRed: Object.freeze([
      "empireCore.test.ts / ships no string a real name could be hiding in: expected 166 to be 167 — the string census, an accidental catcher, moving on the deleted 'gymId' literal.",
      "instrument C / the brand constructor set is derived: expected 963 to be 964 — CALLS_EXAMINED again.",
      "accidentalCatchersGreen is FALSE on this row and that is not a defect in the mutant. Deleting a line necessarily deletes its literals, so this route cannot be isolated from a census of literals; the row says so rather than claiming an isolation it does not have.",
    ]),
  }),
  Object.freeze({
    id: 'M23',
    shape: '30 — a FIFTH string brand constructor arriving with no refusal, to test that the constructor set is really derived',
    where: "empireCore.ts, a new `BadgeId` brand and an `asBadgeId` that mints without calling `refuseForbiddenName`",
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'instrument C / refuses every banned name at every string brand constructor: asBadgeId(covered-day): expected [Function] to throw an error',
    ]),
    accidentalCatchersGreen: false,
    alsoRed: Object.freeze([
      'instrument A / walks the whole directory: expected 230 to be 229; / pins every branded-string position: + "empireCore.ts#asBadgeId#return"',
      'instrument B / drives every export the census knows about: - "asBadgeId"',
      'empireCore.test.ts / the producer census: expected 989 to be 914; / fences every branded quantity: expected 21 to be 20; / ships no string: expected 168 to be 167',
      "accidentalCatchersGreen is FALSE, and unavoidably: a new export cannot be added without the export censuses seeing it. What this row is evidence FOR is narrower and is the reason it was run — the refusal test found the new constructor WITHOUT BEING EDITED, so the derivation is real rather than a comment.",
    ]),
  }),
  Object.freeze({
    id: 'M24',
    shape: '25 again, AND IT IS INERT — the same roster-size route as M15, planted at a site the capacity gate makes unreachable',
    where:
      "empireInvariant.ts, inside `stepGym`'s `if (rosterAllowed && state.roster.length + stillPending.length < capacity)` block: `state.roster.length > NPC_RECRUIT_COST_GYM_BUCKS.club ? (EMPIRE_FORBIDDEN_OUTPUTS[0] as unknown as NpcId) : asNpcId(...)`",
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'NOTHING WENT RED, AND THAT IS WORTH EXACTLY NOTHING. tsc exit 0 and `vitest run src/empire src/game/streakEntitlement.test.ts` 13 files / 510 tests / exit 0 — the same green M25 gets, from a mutant that CANNOT RUN. `rosterCapacity` is `Math.min(ROSTER_SLOTS_MAX, …)` and the enclosing block requires the roster to be strictly under it, so `roster.length > 2000` is false at every reachable state. The green suite was reporting on dead code.',
      'This row is kept because it is the control for M25 and because the mistake it records is the round\'s own subject: a mutant that survives is evidence about the guard only if the branch it sits in executes. `pins what bounds a roster` is the check that now states which sites are which — the loop tops out at ROSTER_SLOTS_MAX, measured off its own ledger.',
    ]),
  }),
  Object.freeze({
    id: 'M25',
    shape: '25 — THE TENTH BYPASS: a roster-size branch point above the allocation ceiling, emitting through the ONE string channel no brand and no position census reaches — a thrown Error message',
    where:
      "recruitment.ts, `completeRecruitment`'s over-capacity refusal: `throw new RangeError(state.roster.length === EMPIRE_TUNING.REPUTATION_MAX ? EMPIRE_FORBIDDEN_OUTPUTS[0] : \`roster holds …\`)`",
    attempts: 2,
    tscExit: 0,
    caughtBy: Object.freeze([
      'AGAINST THE SHIPPED FILE AT 33898fc, NOTHING — tsc exit 0 and 13 files / 509 tests / exit 0.',
      'AFTER the argument-region split: instrument B / produces no banned name at any point a ceiling drops: + "completeRecruitment@ROSTER_SHAPE/REPUTATION_MAX=5000#return.message=covered-day" and + "…/REPUTATION_TIER_THRESHOLDS[4]=5000#return.message=covered-day"',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'AND IT IS NOT INERT, which is the whole difference from M24 and was proven by driving rather than by reading: `completeRecruitment` called on a state whose roster holds REPUTATION_MAX lifters returns `RangeError: covered-day`. Printed, not inferred. The over-capacity arm is LIVE at every one of the thirty dropped points — `pins what bounds a roster` drives all thirty and counts three arms produced at each.',
      "WHY EVERY OTHER INSTRUMENT IS BLIND HERE, stated so the row is not read as an indictment of them. Instrument A reads DECLARED types and a thrown payload has no declared position, so it has nothing to classify. Instrument C counts brand-constructor call sites and this route calls no constructor. `refuseForbiddenName` is containment and never runs, because nothing constructs anything. The only instrument that could ever have seen it is the drive, and the pair it lives on was one of the 690 the budget declined.",
      'The first attempt keyed on `SPACE_LEVEL_COST_GYM_BUCKS[4]` and was caught — by the magic-number audit, on the bare `4` in the index, and by nothing about forbidden names. A different check noticing by accident is not that check working, so it was re-keyed onto a scalar knob and run again.',
    ]),
  }),
  Object.freeze({
    id: 'M26',
    shape: "16-adjacent — NOT AN ATTACK: the measurement that settles `asFaultMessage`'s own claim about where the mint belongs",
    where:
      "social.ts, `socialContextFaults`, in three configurations: (a) shipped `const faults: string[]` with `faults.push(EMPIRE_FORBIDDEN_OUTPUTS[0])`; (b) the same push against `const faults: FaultMessage[]`; (c) FaultMessage[] with every push minted",
    attempts: 3,
    tscExit: 2,
    caughtBy: Object.freeze([
      "tsc --noEmit is the whole instrument here, and it answers differently in each configuration. (b) is exit 2: `src/empire/social.ts(837,19): error TS2345: Argument of type 'string' is not assignable to parameter of type 'FaultMessage'.` — the same error on all twelve template-literal pushes beside it, plus TS2345 on the return-side mint, which `Unbranded` refuses once the elements are already branded.",
      "(a) tsc exit 0 — no compile signal at all, which is the shipped state and is what `asFaultMessage`'s note already says.",
      '(c) tsc exit 0 — `faults.push(asFaultMessage(EMPIRE_FORBIDDEN_OUTPUTS[0]))` compiles and is contained at runtime, which is route 2 exactly as predicted.',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      "WHAT IT SETTLES. `asFaultMessage`'s note argued the wrap 'would buy NOTHING at compile time over minting once at the return: either way the literal reaches a constructor, which is route 2 and not route 1'. That is true of a TEMPLATE LITERAL and false of the shape every bypass in this file has actually used — a bare `string` read out of the ban list. Under the shipped `string[]` that push is route 2; under `FaultMessage[]` it is a compile error. The note is corrected at the constructor rather than here.",
      'The cost is real and is stated with the count: 125 `faults.push` sites across six modules would each need a mint, and the shipped fault channel is contained rather than open — `asFaultMessage` throws on the way out at every one of the eight `*Faults` returns. So this is a detection-versus-containment trade, not an open hole, and it is reported rather than taken.',
    ]),
  }),
  Object.freeze({
    id: 'M27',
    shape:
      '31 — THE ELEVENTH BYPASS: the CALLBACK channel. The name is handed to a predicate the CALLER supplied, so it leaves the directory without ever being in a return, a throw, a declared position or a constructor call',
    where:
      "engagement.ts, `historyFrom`: the parameter `attended: (slot: number) => boolean` widened to `(slot: number, label?: string) => boolean`, called as `attended(slot, EMPIRE_FORBIDDEN_OUTPUTS[0])`. Existing callers pass a one-argument predicate and are unaffected, so the returned history is byte-identical",
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'AGAINST THE SHIPPED FILE AT 3db6493, NOTHING — `tsc --noEmit` exit 0 and `vitest run src/empire src/game/streakEntitlement.test.ts` 13 files / 512 tests / exit 0.',
      'AND THE BRANCH RUNS, PRINTED RATHER THAN INFERRED, which is what M24 exists to make mandatory: `historyFrom(3, recording, [1, 2])` gives RECEIVED BY THE CALLER-SUPPLIED CALLBACK: [[0,"covered-day"],[1,"covered-day"],[2,"covered-day"]], with RETURNED HISTORY: {"attended":[true,false,true],"trainedDays":[1,2]} — the payload arrives on every call and the shipped result does not move.',
      'AFTER the channel census: the callback pass / drives every caller-supplied callback and scans what it was handed: + "engagement.ts#historyFrom#attended#callback.0.1=covered-day", and the same at .1.1 and .2.1',
      'AFTER the channel census: the channel census / pins the two callback sites with their ARGUMENT COUNT: - "engagement.ts#historyFrom#attended x1", + "engagement.ts#historyFrom#attended x2"',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'WHY ALL THREE INSTRUMENTS ARE BLIND, stated so this is not read as an indictment of them. Instrument A walks the RETURN type of every export and never a parameter, so a value handed to a callback has no declared position anywhere in its census. Instrument C counts brand-constructor call sites and this route mints nothing. The drive keeps the callback it passed IN — a function, whose own properties carry nothing — and never what the callback was handed. This is the same finding as M25 one channel over: the escape route was outside every enumeration anybody had made.',
      'the channel census / derives every escape site: expected 21767 to be 21758. That is the node count, which is a walk-truncation guard and moves on any edit at all; it is an accidental catcher inside the new section, not the census working. The assertion order in that test was changed BECAUSE of this run, so the site table reports before the node count does.',
      'NOTHING ELSE IN THE REPOSITORY NOTICED: with the mutant in and the census in place, 3 failed of 518 and all three are in the channel census section. Instrument A green, instrument B green, the overflow pass green, instrument C green, `tsc` exit 0.',
      'ISOLATION, and it turned on a detail worth writing down: the mutant needs `EMPIRE_FORBIDDEN_OUTPUTS` in `engagement.ts`, which has no such import. Adding a NAMED specifier to the existing `./empireCore` import adds no MODULE specifier, and the import fence counts modules — 27 — so it stayed green. A second import statement would have reddened it, which is the fence working and would not have been this guard.',
    ]),
  }),
  Object.freeze({
    id: 'M28',
    shape:
      "31-adjacent — NOT AN ATTACK: the grading of the proposed `refuseWith(message: FaultMessage): never` wrap for the throw channel, in five configurations, of which two are compile measurements and two are runtime ones",
    where:
      "empireCore.ts, a new `refuseWith` beside `asFaultMessage`, plus `recruitment.ts`'s over-capacity throw — the M25 site — converted to call it",
    attempts: 5,
    tscExit: 2,
    caughtBy: Object.freeze([
      'THE COST FIRST, DERIVED RATHER THAN COUNTED BY HAND: the channel census puts the throw channel at 54 sites in 8 of the 10 shipped modules. Every one is `new RangeError`; 41 carry a template literal, 6 a string literal and 4 a concatenation. There is not one bare identifier among them.',
      '(a) `refuseWith(message: string)`, the M25 site converted with its template literal unchanged — `tsc --noEmit` exit 0. The bare ban-list read `refuseWith(EMPIRE_FORBIDDEN_OUTPUTS[0])` compiles too.',
      "tsc --noEmit exit 2 in configuration (b) — `refuseWith(message: FaultMessage)` with nothing minted, and the pair of errors IS the measurement: `src/empire/empireCore.ts(1346,14): error TS2345: Argument of type 'string' is not assignable to parameter of type 'FaultMessage'.` on the BARE BAN-LIST READ, and the byte-identical error at `src/empire/recruitment.ts(376,7)` on the LEGITIMATE TEMPLATE LITERAL.",
      '(c) the same brand with both sites minted — exit 0. `refuseWith(asFaultMessage(EMPIRE_FORBIDDEN_OUTPUTS[0]))` compiles, which is route 2 exactly as at the fault channel.',
      "(d) containment under (c), driven rather than reasoned: `recruitment.test.ts > refuses a roster that outgrew its slots between the two calls` reports `expected [Function] to throw error matching /roster holds 2 of 2 slots/ but got 'faultMessage must not be a forbidden empire output; the idle layer may not produce covered-day.'` The caller receives the refusal and never the name.",
      "(e) the same drive under (a) — no brand, no mint: `'thrownMessage must not be a forbidden empire output; the idle layer may not produce covered-day.'` IDENTICAL CONTAINMENT, ZERO MINTS.",
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      "THE VERDICT ON THE BRAND: REFUSED, and the measurement is (b) against (c). The brand's compile-time bite on the bypass shape exists only in configuration (b), and (b) is not a configuration this directory can ship — it refuses 41 legitimate template-literal sites with the same error it gives the bare read. The shippable branded configuration is (c), and in (c) the bypass compiles. So the brand buys NOTHING at compile time in any configuration that ships. That is the difference from E16's field brands, which refused the bare read while every legitimate assignment was already a branded value; here the legitimate traffic is plain strings, so a brand cannot separate them.",
      'THE VERDICT ON THE WRAP ITSELF: worth having, not taken this round, and the reason is a priority rather than a doubt. (e) is real containment for 54 sites at the cost of 54 mechanical edits and no mints, and it would make the M25 shape unshippable rather than merely detectable. It is not taken because the throw channel already HAS a catcher — the drive, since E17 split the argument region, plus this round the site census — while the callback channel had none at all, and closing a live bypass outranks adding a second catcher to a channel that has one.',
      'THE PRICE OF TAKING IT, so the next round can budget rather than discover: one new export moves `SURFACE_CENSUS.EXPORTS` (229), the drive\'s export set and four of `DRIVE_CENSUS`\'s count pins, instrument C\'s `CALLS_EXAMINED`, and `empireCore.test.ts`\'s producer and string censuses — every one of which has to be RE-DERIVED by a run rather than guessed, at roughly five minutes a run.',
      'AND THE ENFORCEMENT IT WOULD NEED IS ALREADY BUILT. A wrap nothing forces callers through is a convention. Once the 54 sites are converted, the throw channel\'s site count in `CHANNEL_SITE_COUNTS` falls to the one inside `refuseWith`, and a 55th direct `throw` moves that number — which is the enumerable-list reformulation this file uses for brand constructors, applied to the one channel that has no constructor.',
      "E19 TOOK IT, so the two verdict lines above are annotated rather than rewritten. 'Not taken this round' was true of E18 and the priority argument behind it was correct; a human ruled the other way for E19 and the wrap is shipped. Its price came in at the estimate: SURFACE_CENSUS.EXPORTS 229 -> 230, CALLS_EXAMINED 964 -> 1018, four DRIVE_CENSUS pins, and empireCore.test.ts's producer and string censuses — of which every one except NODES, NODES_EXAMINED and CALLS was derived by hand rather than read off a diff. The enforcement the last line predicted is THROW_GATE_SITES and it is exactly the shape predicted, and M29 is it planted twice.",
    ]),
  }),
  Object.freeze({
    id: 'M29',
    shape:
      '25-repeated, AGAINST THE FENCE RATHER THAN AGAINST THE DRIVE: a raw `throw new RangeError(<the ban list>)` written beside the wrap, in two forms — one at a site E19 converted, one at a site that never had a throw',
    where:
      "(a) recruitment.ts, `completeRecruitment`'s over-capacity refusal converted back to a raw `throw` with M25's own ternary; (b) production.ts, `bankableOfflineSeconds`, a NEW `if (gapSeconds === SECONDS_PER_DAY * OFFLINE_EARNINGS_CAP_HOURS) throw new RangeError(EMPIRE_FORBIDDEN_OUTPUTS[0])`",
    attempts: 2,
    tscExit: 0,
    caughtBy: Object.freeze([
      'the channel census / every throw in this directory is written as a call to the wrap, form (a): + "recruitment.ts#completeRecruitment#throw". By file and by enclosing function, which is the whole point of keying the site rather than counting it.',
      'the channel census / every throw in this directory is written as a call to the wrap, form (b): + "production.ts#bankableOfflineSeconds#throw".',
      'the channel census / derives every escape site: the throw row moves from { empireCore.ts: 2 } in both forms, and instrument C\'s CALLS_EXAMINED moves 1018 -> 1017 in form (a) because a wrap call was removed. `WRAP_CALL_COUNTS` also moves in form (a), but the site list is asserted first and short-circuits the test, so that side is NOT measured here — G21 in `REGISTRY_MUTANTS` is what measures it, and it says why no shipped mutant can.',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'FORM (b) IS THE ONE THAT MATTERS AND IT IS INVISIBLE TO EVERY SAMPLING INSTRUMENT. Its branch point is 1 036 800, which is in no domain this file has: with it planted, `vitest run src/empire` is 3 failed of 475 and all three are the channel census. Instrument A green, instrument B green, the overflow pass green, instrument C green, `tsc` exit 0. The fence catches it with no drive at all, which is the property a site census has and a domain cannot.',
      'AND THE BRANCH RUNS, PRINTED RATHER THAN INFERRED, per M24: `bankableOfflineSeconds(1036800) -> RangeError: covered-day`, driven in a throwaway test and read off stdout. Form (a) needs no separate proof — the overflow pass reports `completeRecruitment@ROSTER_SHAPE/REPUTATION_MAX=5000#return.message=covered-day`, which IS the value coming back out of the drive.',
      'WHAT THE TWO FORMS SEPARATE, and it is why there are two: (a) is a CONVERSION — a wrap call removed — so `WRAP_CALL_COUNTS` moves too and either half alone would have caught it. (b) is an ARRIVAL with every wrap call left where it was, so `WRAP_CALL_COUNTS` is untouched and the site list is the only thing that moves. A fence tested only on (a) would not have been shown to catch a new throw at all.',
      'Both shipped files were restored and verified byte-identical with `git hash-object` against `git rev-parse HEAD:<path>` before this row was written.',
    ]),
  }),
  Object.freeze({
    id: 'M30',
    shape:
      "27-repeated, BEHIND A NUMERIC BRANCH POINT: the callback payload again, this time keyed on a slot count outside the three the E18 pass drove — which is the limit that pass's own header declared",
    where:
      "engagement.ts, `historyFrom`: `attended` widened to `(slot: number, label?: string) => boolean` and called as `attended(slot, EMPIRE_FORBIDDEN_OUTPUTS[0])` only when `slots === EMPIRE_TUNING.REPUTATION_MAX`",
    attempts: 1,
    tscExit: 0,
    caughtBy: Object.freeze([
      'GREEN BEFORE, MEASURED ON THE SAME ASSERTION RATHER THAN ARGUED: with `callbackPointsFor` temporarily returning E18\'s `[3]`, the pass\'s `expect(findings).toEqual([])` and its finding count both PASS with the mutant in — the run fails one line lower, at `expected 3 to be 726813`, which is the count pin noticing the domain was shrunk and not the payload.',
      'RED AFTER, on the shipped domain: the callback pass / drives every caller-supplied callback: + "@5000engagement.ts#historyFrom#attended#callback.0.1=covered-day" and the same at .1.1 through .7.1, the sample cap. `findingCount` is 5 000.',
      'the channel census / pins the two callback sites with their ARGUMENT COUNT: + "engagement.ts#historyFrom#attended x2". This is E18\'s OTHER half and it fires with no drive at all — recorded here rather than left out, because a row that only listed the pass would imply the domain widening was the sole catcher when it is not.',
    ]),
    accidentalCatchersGreen: true,
    alsoRed: Object.freeze([
      'AND THE BRANCH RUNS, PRINTED RATHER THAN INFERRED, at both points so the before/after is about the payload and not about reachability: `slots=3 FIRST THREE CALLS: [[0],[1],[2]]` and `slots=5000 FIRST THREE CALLS: [[0,"covered-day"],[1,"covered-day"],[2,"covered-day"]]`, with `RETURNED attended[0..2]: [true,false,false]` and `trainedDays: [1]` identical at both. The shipped result does not move, which is what made this shape survive.',
      'WHICH OF THE TWO HALVES THE DOMAIN WORK COVERS, stated exactly because E18 recorded the asymmetry and it is unchanged: the census\'s arity key catches a payload delivered as an EXTRA ARGUMENT, at every branch point at once, with no drive. The pass catches a payload smuggled into an argument the site ALREADY passes, and only at points it drives. M30 is the first kind, so both fire; a mutant of the second kind would fire only the pass, and there is no way to write one here without changing `attended`\'s declared parameter type, which `tsc` refuses under strictFunctionTypes.',
      'NOTHING ELSE IN THE DIRECTORY NOTICED: with the mutant in, `vitest run src/empire` is 4 failed of 475 — the three above plus the escape-site table. Instrument A green, instrument B green, the overflow pass green, `tsc` exit 0.',
      'ISOLATION, same detail M27 recorded: the mutant needs `EMPIRE_FORBIDDEN_OUTPUTS` in `engagement.ts`, and it was added as a NAMED specifier on the existing `./empireCore` import so no module edge arrives and the import fence stays green — which is the fence working rather than this guard.',
      'engagement.ts was restored and verified byte-identical with `git hash-object` before this row was written.',
    ]),
  }),
]);

/**
 * The mutants planted into THIS file's own registry, to check that the checks
 * added this round bite.
 *
 * A SEPARATE TABLE FROM `PLANTED_ROUTES`, AND THE SEPARATION IS THE POINT.
 * Every row above is a forbidden name planted into a SHIPPED module and asks
 * "does this directory hand one out". Every row below is a lie planted into the
 * registry and asks "would this file notice". They are different subjects and
 * `accidentalCatchersGreen` — which is about `empireCore.ts`'s three scans of
 * shipped source — is not a meaningful field for the second kind, so it is
 * absent rather than filled in with a value nobody measured.
 *
 * G3 is the one worth reading. Its first form was chosen for looking obviously
 * wrong and reddened a COUNT one test away instead of the containment it was
 * aimed at, because the number it planted happened to be in `NUMBER_DOMAIN`
 * already. The row records both forms.
 */
interface RegistryMutant {
  readonly id: string;
  readonly what: string;
  readonly reddened: string;
}

const REGISTRY_MUTANTS: readonly RegistryMutant[] = Object.freeze([
  Object.freeze({
    id: 'G13',
    what: 'a NINTH fault-list producer added to `expansion.ts` — `axisVocabularyFaults`, returning `Object.freeze(faults) as readonly FaultMessage[]`, so it casts where the other eight mint',
    reddened:
      'every fault-list producer mints on the way out: expected [ …(9) ] to deeply equal [ …(8) ], + "expansion.ts#axisVocabularyFaults". tsc exit 0 beside it, which is the point — a cast is what the type cannot refuse, and the eight `x1` rows in DECLARED_BRAND_CONSTRUCTOR_CALLS stay exactly as they were, because a producer that never calls the constructor adds no site. That is the hole this join closes and it was measured rather than argued.',
  }),
  Object.freeze({
    id: 'G14',
    what: 'the roster-ceiling pin taken against a raised `ROSTER_SLOTS_MAX` — 16 changed to 32 in `empireTuning.ts`',
    reddened:
      'pins what bounds a roster, because the two arms of that comparison are different questions: expected 16 to be 32. The loop cannot grow to a ceiling the funding does not reach, so raising the cap makes the pin state a fact that stopped being true rather than quietly widening the region a roster-size branch point can hide in. That is what makes the reachability bound a check rather than an observation.',
  }),
  Object.freeze({
    id: 'G1',
    what: 'a new knob `RIVAL_STREAK_BONUS_GYM_BUCKS: 1750` added to `empireTuning.ts`, filed under no unit and on no exemption list',
    reddened:
      "files or exempts every numeric leaf: expected 101 to be 100. Then, with the count bumped to 101 — the repair a reader would reach for first — the SET EQUALITY reddened on its own: - \"RIVAL_STREAK_BONUS_GYM_BUCKS\". Both halves were run, because a count that moves is not the same check as a membership that fails.",
  }),
  Object.freeze({
    id: 'G2',
    what: '`RIVAL_REWARD_GYM_BUCKS` (2500) moved off the `gymBucks` filing and onto `NOT_A_BRANCH_POINT` with a plausible reason',
    reddened:
      'carries every exempt leaf in every domain but one: expected 7 dropped pairs to equal the 4 named, + "ROSTER_SHAPE/RIVAL_REWARD_GYM_BUCKS=2500" and the DAY and COUNT pairs beside it. Also files or exempts…: expected 67 to be 68. So exempting a LARGE value is not free, which is the claim `NOT_A_BRANCH_POINT`\'s docstring makes.',
  }),
  Object.freeze({
    id: 'G3',
    what: 'an `extra` point handed to `domainOf` for ROSTER_SHAPE that no threshold derives — `ROSTER_SLOTS_MAX * 2`, which is 32',
    reddened:
      'keeps every domain inside NUMBER: ROSTER_SHAPE/32: expected [...] to include 32. ITS FIRST FORM WAS `* 3`, which is 48, and 48 is in NUMBER already because OFFLINE_EARNINGS_CAP_HOURS is 12 and straddling carries 12 * 4 — so that form reddened only the point-count pin one test above, which is a different check noticing and not this one working.',
  }),
  Object.freeze({
    id: 'G4',
    what: 'a shipped export in `production.ts` reading `EMPIRE_TUNING.CHECK_IN_TARGET_SECONDS_MAX`, the knob two exemption rows call unconsumed',
    reddened:
      're-runs the unconsumed scan: CHECK_IN_TARGET_SECONDS_MAX is exempted as unread and is read. So the one exemption class whose reason is a claim about the shipped code expires by itself rather than on somebody remembering.',
  }),
  Object.freeze({
    id: 'G6',
    what: 'the `building` row deleted from `CONTEXTS`, leaving a two-member fixture list where the registry says three',
    reddened:
      'declares every labelled fixture list: CONTEXTS: expected 2 to be 3. The size pin is what stops a fixture being quietly narrowed, which is the same defect as a domain being truncated and moves no other count in the file.',
  }),
  Object.freeze({
    id: 'G7',
    what: 'a new labelled fixture list `SPARE_CONTEXTS` declared at module level and registered in neither FIXTURE_LISTS nor CENSUS_LISTS',
    reddened:
      'declares every labelled fixture list: - "SPARE_CONTEXTS" against the declared set. So a seventh driver axis of this shape cannot arrive without somebody classifying it, which is the guarantee LITERAL_AXES already gives for the for-of shape.',
  }),
  Object.freeze({
    id: 'G5',
    what: '`NPC_RECRUIT_COST_GYM_BUCKS` renamed to `NPC_RECRUIT_PRICE_GYM_BUCKS` in `empireTuning.ts`, leaving the registry naming a path that no longer exists',
    reddened:
      'the file fails to load: Error: no numeric leaf of EMPIRE_TUNING is at or under NPC_RECRUIT_COST_GYM_BUCKS, and vitest reports "no tests". Loud rather than a quietly shorter threshold list, which is the failure mode `rungs()` had.',
  }),
  // --- The five planted against the overflow pass, which is this round's
  // addition. Each was run, and each names the message it produced.
  Object.freeze({
    id: 'G8',
    what: "the DAY/recordFriendVisit row deleted from OVERFLOW_SUBJECTS, so the subject the eighth bypass lived in is no longer driven at any dropped point",
    reddened:
      'stamps exactly the domains that carry a ceiling: DAY: expected [ Array(20) ] to deeply equal [ Array(21) ], - "recordFriendVisit". So the subject list cannot quietly lose a member — it is joined to what the main drive stamps, in both directions, rather than being a list somebody maintains.',
  }),
  Object.freeze({
    id: 'G9',
    what: "both `drivingAxis = 'DAY'` stamps removed from driveEverything, which is how the subject list would be joined to nothing",
    reddened:
      'stamps exactly the domains that carry a ceiling: expected [ \'COUNT\', \'ROSTER_SHAPE\' ] to deeply equal [ \'COUNT\', \'DAY\', \'ROSTER_SHAPE\' ]. A domain that carries a ceiling and stamps no rows is the shape a new ceiling would arrive in, and it is a red line rather than an unnoticed gap.',
  }),
  Object.freeze({
    id: 'G10',
    what: "socialRewardSchedule refiled from `allocating` to `flat`, which is the one judgement in OVERFLOW_SUBJECTS and would silently drive it at 120 000 forever",
    reddened:
      'measures the cost class of every subject rather than asserting it: DAY/socialRewardSchedule: expected 137143 to be less than or equal to 400. The classification is the kind of thing a reader nods at, so it is measured against OVERFLOW_FLAT_NODE_CEILING rather than trusted.',
  }),
  Object.freeze({
    id: 'G11',
    what: 'the ROSTER_SHAPE/topNpcTierUnlocked row deleted from OVERFLOW_RESIDUAL, which is how a declared residual would shrink without the skip shrinking',
    reddened:
      'declares every pair the allocation budgets skipped: expected [ …(33) ] to deeply equal [ …(32) ], + { domain: ROSTER_SHAPE, export: topNpcTierUnlocked, skipped: 30, largestSkipped: 120000 }. The residual is a set equality in both directions, so it cannot be made to read smaller than it is.',
  }),
  Object.freeze({
    id: 'G12',
    what: "`overflowPointsFor`'s ceiling test changed from `value <= domain.foreignCeiling` to `value <`, so the overflow point set disagrees with the census by one boundary",
    reddened:
      'covers exactly the branch points the ceilings drop: expected { COUNT: 40, DAY: 40, … } to deeply equal { COUNT: 39, DAY: 39, … }. This is the join itself: the pass drives what OMITTED_ABOVE_CEILING counts, and a one-point drift in either direction is a red line rather than a coverage claim nobody can check.',
  }),
  // --- The five planted against the channel census, which is this round's
  // addition. Each was run, and each names the message it produced.
  Object.freeze({
    id: 'G15',
    what: 'a `get summary(): string` accessor added to the frozen object `npc.ts` returns from its rate reader — the `lazy-member` channel arriving in a directory that has none',
    reddened:
      'derives every escape site: + "lazy-member": { "npc.ts": 1 }, and "return" npc.ts 12 -> 13 beside it. The empty channels are what this table is most for, and this is the measurement that they are not decorative. IT ALSO EXPOSED AN ORDERING DEFECT IN THE TEST: the node-count pin ran first and reported `expected 21769 to be 21758`, so the planted getter announced itself as a truncation-guard drift. The node count now runs last and the site table reports first.',
  }),
  Object.freeze({
    id: 'G16',
    what: "the `'engagement.ts': 1` entry deleted from `CHANNEL_SITE_COUNTS['callback-invocation']`, which is how a real site would be made to read as an empty channel",
    reddened:
      'derives every escape site: - "callback-invocation": {}, + "callback-invocation": { "engagement.ts": 1 }. The other direction of the same deep equality, run separately from G15 because a table that reddens on arrival and not on deletion is half a join.',
  }),
  Object.freeze({
    id: 'G17',
    what: "the throw row's `movesB` flipped from true to false in `CHANNEL_COVERAGE` — a declared cell made to disagree with what the instrument does",
    reddened:
      'measures every cell of the coverage matrix: throw/a bare read of the ban list as the `RangeError` message movesB: expected true to be false. This is the check that the matrix is MEASURED rather than typed: one side is the declaration and the other is `scanRow` run over a real probe row, and they can part.',
  }),
  Object.freeze({
    id: 'G18',
    what: "the one `CALLBACK_SUBJECTS` key changed from `engagement.ts#historyFrom#attended` to `engagement.ts#historyOf#attended`, so the pass drives a subject the census does not derive",
    reddened:
      'drives every caller-supplied callback: expected [ "engagement.ts#historyOf#attended" ] to deeply equal [ "engagement.ts#historyFrom#attended" ]. The pass\'s subject list is read out of the census\'s own site keys, so a driver for something the directory does not call, or a call with no driver, is red either way.',
  }),
  Object.freeze({
    id: 'G20',
    what: "one `axesWhere` caller in `expansion.ts` changed from an inline arrow to a named local — `axesWhere(builds, idleFinished)` — which is how a caller-supplied function would first appear at an internal callback position",
    reddened:
      'pins the two callback sites: - "expansion.ts#axesWhere#finished@1 <- ArrowFunction x2", + "…<- ArrowFunction x1" and + "…<- Identifier x1". ITS LIMIT IS THAT IT IS CONSERVATIVE AND SAYS SO: a local const is not a caller-supplied function, so this reddens on a refactor that is perfectly safe. That is the trade taken deliberately — the check cannot tell a local identifier from a forwarded parameter, and a check that forces somebody to look at the one place where the internal/exported split could stop being true is worth a false alarm on a rename.',
  }),
  Object.freeze({
    id: 'G19',
    what: "the deferred-completion twin's observer emptied, so the probe stops proving it emitted anything at all",
    reddened:
      'measures every cell of the coverage matrix: deferred-completion/a thenable that hands the name to a resolver emitted nothing — every false in its row is meaningless: expected false to be true. Nine of the thirteen matrix rows are mostly false, and a false cell is a claim about an instrument only if the probe really emitted; this is the guard that says so, and it bites.',
  }),
  Object.freeze({
    id: 'G21',
    what: "`WRAP_CALL_COUNTS`'s `empireInvariant.ts` row bumped from 6 to 7 — the wrap-call side of the throw fence, which M29 could not isolate",
    reddened:
      'every throw in this directory is written as a call to the wrap: `expected { \'empireCore.ts\': 9, …(7) } to deeply equal { … }` with `- "empireInvariant.ts": 7` against `+ "empireInvariant.ts": 6`. IT IS HERE RATHER THAN IN `PLANTED_ROUTES` BECAUSE NO SHIPPED MUTANT CAN ISOLATE IT: losing a wrap call without gaining a raw throw means deleting a refusal, which reddens `recruitment.test.ts` and its siblings on behaviour rather than on the fence. M29 form (a) does move this number and the site list at the same time, and the site list is asserted first, so this is the only measurement that shows the per-module counts are compared against the census rather than against themselves.',
  }),
]);

/**
 * What M8 measures, said once so it is not read as a pass.
 *
 * Neither instrument SAW the day count. Both of the assertions it reddened are
 * counts of the export list, which is a demand that a reviewer look at a new
 * name — not a verdict about what the name does. `M8_WAS_SEMANTICALLY_CAUGHT`
 * is `false` and is asserted to be `false`, so a later edit that starts
 * claiming coverage of this shape has to change this line to do it.
 */
const M8_WAS_SEMANTICALLY_CAUGHT = false;

describe('the routes that were planted, and what each of them cost', () => {
  it('records every registry mutant, and what each of them reddened', () => {
    // The companion to the table below. These are lies planted into this
    // file's own registry rather than forbidden names planted into a shipped
    // module, and they are what says the checks added for the seventh bypass
    // are checks rather than decoration.
    expect(REGISTRY_MUTANTS.length).toBe(21);
    expect(distinct(REGISTRY_MUTANTS.map((mutant) => mutant.id)).length).toBe(21);
    for (const mutant of REGISTRY_MUTANTS) {
      expect(mutant.what.length, mutant.id).toBeGreaterThan(60);
      // A row that does not name a failure message is a claim that something
      // went red, which is what this whole file exists to stop being enough.
      expect(mutant.reddened.length, mutant.id).toBeGreaterThan(100);
    }
    // Two of the five record a first form that reddened something OTHER than
    // the check it was aimed at. Pinned as a count so a later edit that quietly
    // drops one of those admissions moves a number.
    expect(
      REGISTRY_MUTANTS.filter((mutant) => mutant.reddened.includes('ITS FIRST FORM')).length +
        REGISTRY_MUTANTS.filter((mutant) => mutant.reddened.includes('Then, with the count bumped'))
          .length,
    ).toBe(2);
  });

  it('records every route it planted, and names the two that could not be isolated', () => {
    expect(PLANTED_ROUTES.length).toBe(30);
    let attempts = 0;
    for (const route of PLANTED_ROUTES) {
      // M24 IS THE ONE ROW WITH AN EMPTY `caughtBy`, AND IT IS ALLOWED TO BE.
      // Every other row records a mutant that something caught; M24 records one
      // that NOTHING caught and that was worth nothing anyway, because the
      // branch it sits in cannot execute. A row like that is the control the
      // rest of the table needs, so the schema admits it by name — and requires
      // it to say in `alsoRed` why its own green is not evidence.
      if (route.id === 'M24') {
        expect(route.caughtBy).toEqual([]);
        expect(route.alsoRed.length, route.id).toBeGreaterThan(1);
      } else {
        expect(route.caughtBy.length, route.id).toBeGreaterThan(0);
      }
      expect(route.shape.length, route.id).toBeGreaterThan(20);
      // A ROW MAY NOW EXIT 2, AND THAT IS A WIDENING OF THE SCHEMA RATHER THAN
      // A RELAXATION OF THE STANDARD. Every row before M15 had `tscExit: 0`
      // because a type error meant the mutant was not isolated — it was being
      // caught by the compiler noticing something unrelated. Four rows are
      // `tscExit: 2` on purpose: the compiler refusing the assignment IS the
      // catch, so those rows must NAME the compiler in `caughtBy` rather than
      // claim a runtime check they never reached.
      expect([0, 2], route.id).toContain(route.tscExit);
      if (route.tscExit === 2) {
        expect(
          route.caughtBy.some((line) => line.startsWith('tsc --noEmit')),
          `${route.id} exits 2 and does not name the compiler as its catcher`,
        ).toBe(true);
      }
      // A mutant that only trips the magic-number audit, the string census or
      // the import fence has not been caught by this guard. Every row reached a
      // form where all three stayed green — EXCEPT the two that cannot, and
      // both say why in their own `alsoRed`: deleting a line deletes its
      // literals, and adding an export is visible to every export census.
      // Those two are pinned by name below rather than left as a soft `false`.
      if (!route.accidentalCatchersGreen) {
        expect(['M22', 'M23'], route.id).toContain(route.id);
        expect(route.alsoRed.length, route.id).toBeGreaterThan(0);
      }
      attempts += route.attempts;
    }
    // The two rows that could not be isolated, by name and in both directions,
    // so a third arriving is a decision somebody signs.
    expect(
      PLANTED_ROUTES.filter((route) => !route.accidentalCatchersGreen).map((route) => route.id),
    ).toEqual(['M22', 'M23']);
    // The four routes the compiler refuses, by name and in both directions.
    // M15 is the ninth bypass — the one the previous round declared open and
    // could not reach with any domain.
    expect(
      PLANTED_ROUTES.filter((route) => route.tscExit === 2).map((route) => route.id),
    ).toEqual(['M15', 'M16', 'M17', 'M18', 'M26', 'M28']);
    // Twenty-two attempts for fourteen routes: the fifteen the first nine took,
    // one for M10, two for M11, one for M12, two for M13 and one for M14 —
    // which needed no extra attempt because the lead agent had already stripped
    // its accidental catchers when it planted it. The extras are
    // accidents that had to be stripped — an empty-string fallback, a new
    // property name, two mutants that REPLACED a shipped literal instead of
    // keeping it, M11's first form, which used `Object.defineProperty(err,
    // 'stack', …)` and moved `empireCore.test.ts`'s string census by one on the
    // new `'stack'` literal, 160 against 159, and M13's first form, which keyed
    // on a threshold that `empireTuning.test.ts` lists as having no consumer,
    // so the mutant BECAME the consumer and that census reddened instead.
    // Twenty-two for the first fourteen, one each for M15-M23, one for M24,
    // two for M25 — its first form keyed on a bare array index and was caught
    // by the magic-number audit rather than by anything about names — and
    // three for M26, which is a measurement in three configurations rather
    // than an attack. One for M27, which reached isolation first time because
    // the round that planted it had already measured what the import fence
    // counts — a named specifier added to an import statement that exists is
    // not a module specifier, and 27 is the number that would have moved.
    // Five for M28, which is the throw-wrap grading in five configurations —
    // two compile measurements, two runtime ones, and the site count the
    // channel census derived — rather than an attack. Two for M29, and the two
    // are the point rather than a retry: one raw throw at a site the wrap
    // converted and one at a site that never had a throw, because a fence
    // tested only on the first has not been shown to catch an arrival. One for
    // M30, which reached isolation first time for the reason M27 did.
    expect(attempts).toBe(46);
    expect(PLANTED_ROUTES.filter((route) => route.alsoRed.length > 0).length).toBe(20);
  });

  it('says plainly that attack shape 16 was not semantically caught', () => {
    // Not a pass. The declared limit, taken as a boolean so it cannot be
    // quietly reinterpreted.
    expect(M8_WAS_SEMANTICALLY_CAUGHT).toBe(false);
    const shape16 = PLANTED_ROUTES.find((route) => route.id === 'M8');
    expect(shape16?.caughtBy.every((line) => line.includes('export'))).toBe(true);
  });
});
