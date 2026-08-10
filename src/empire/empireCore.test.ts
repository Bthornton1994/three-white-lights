/**
 * empireCore.test.ts — the tests for the §5 vocabulary, and for the claim in
 * this piece that vitest cannot grade.
 *
 * ===========================================================================
 * What is graded by what, because part of this file is not a runtime test
 * ===========================================================================
 *
 * GDD §4.4's bar on this shape is that the hazard be STRUCTURALLY unable to
 * occur, not merely observed not to occur at the horizons somebody happened to
 * sweep — and it records that "structurally unable" has two readings and means
 * both. This file is the first reading: the accelerated path is not
 * constructible.
 *
 * So the load-bearing assertions in the first section are `@ts-expect-error`
 * directives, and they are graded by `npx tsc --noEmit` rather than by vitest.
 * Vitest strips types without checking them, so under vitest alone those lines
 * are comments. If `AccelerableOutput` ever widens to admit a
 * progression-reaching output for a purchased accelerant, `tsc` reports TS2578
 * "Unused '@ts-expect-error' directive" and the build fails. That is the
 * compiler's verdict rather than a claim about it.
 *
 * EVERY DIRECTIVE IN THIS FILE NEEDS A LINE VITEST CAN ALSO REDDEN, and that is
 * a rule this file broke twice, in two different ways, and the second time it
 * broke it in the sentence written to fix the first.
 *
 * The first break was on the licence directives: the hazard tests ended
 * `expect(bought.accelerant).toBe('gym-empire-timer-skip')` — reading back the
 * argument that had just been passed in, from a constructor that validated
 * nothing. Under vitest they were two green ticks for hazard 1 and hazard 2
 * that were ticks for nothing at all. Both constructors now ask
 * `mayAccelerate` and throw, so each of those directives sits beside a
 * `toThrow` whose message names the arrival, the output and the reach.
 *
 * The second break was on the BRAND directives, and the rule above was already
 * written when they shipped without one. Five of them sat over
 * `expect(typeof wrong).toBe('number')` — twice — and over three assertions
 * that the constructors still mint the same value. A brand is erased at
 * runtime, so those were not weak lines, they were lines no state of
 * `empireCore.ts` could redden: the subject returns a number and mints the same
 * value whether the parameter says `SettledLevel` or `number`.
 *
 * A brand's reddenable line is therefore the DECLARATION, and that is what
 * 'fences every branded quantity in its own declaration' pins — the constructor
 * list read out of the source with `Unbranded<N>` asserted on each, and one row
 * per branded parameter and return type, so widening any of them to a primitive
 * is red in vitest at the same moment it makes a directive unused in `tsc`.
 * 'gives every type-only directive in this file a covering test, by census'
 * counts the directives and pins which tests carry them. Be exact about what
 * that census is worth: it stops a directive arriving with no signed-for home,
 * and it does not prove the covering assertions bite. That evidence is the
 * mutation run in the report.
 *
 * A DIRECTIVE'S DOMAIN IS THE SPELLING IT WAS WRITTEN IN. Both original
 * directives passed the accelerant as a bare string literal, which is the one
 * shape where `A` infers as a singleton and the licence filter bites. The
 * spellings that widen `A` to the declared union — a parameter, a `for...of`
 * over `EMPIRE_ACCELERANTS`, an `isEmpireAccelerant` narrowing — compiled, and
 * a green `tsc` said nothing about them because nothing asked. They are asked
 * now, all three, on both constructors.
 *
 * To check the directives still bite, change `ARRIVAL_LICENCE['store-purchase']`
 * in `empireCore.ts` to `['idle-only', 'progression-reaching']`. `tsc --noEmit`
 * then reports TS2578 on the directives below, and `vitest run src/empire`
 * fails the licence tests in this file. Both were run; see the report for the
 * verbatim output.
 *
 * The second reading — that the output does not MOVE with the purchase — is not
 * in this file and is not claimed by it. It belongs to piece E6 and §6 of
 * `empireCore.ts`'s header states what it has to assert.
 *
 * ===========================================================================
 * Three exported constants this file deliberately does not assert on
 * ===========================================================================
 *
 * `EMPIRE_OUTPUT_REACH_IS_A_PARTITION`, `EMPIRE_ACCELERANT_ARRIVAL_IS_A_PARTITION`
 * and `EMPIRE_PAYS_NO_FORBIDDEN_OUTPUT` are each `const x: T = true`. Their
 * value is a literal, so `expect(x).toBe(true)` is a line no state of the
 * tables can redden — and all three of those assertions were in this file,
 * reading as independent checks. They are graded by `tsc --noEmit`; the runtime
 * statement of the same three claims is `empireVocabularyFaults`, and the
 * membership of the four derived lists is pinned by name below.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { auditSource, formatFindings } from '../tuning/audit';
import { EMPIRE_TUNING } from './empireTuning';
import {
  ACCELERANT_ARRIVAL,
  ACCELERANT_ARRIVALS,
  ARRIVAL_LICENCE,
  EARNED_ACCELERANTS,
  EMPIRE_ACCELERANTS,
  EMPIRE_FORBIDDEN_OUTPUTS,
  EMPIRE_OUTPUTS,
  IDLE_ONLY_OUTPUTS,
  OUTPUT_REACHES,
  OUTPUT_SINK,
  OUTPUT_SINKS,
  PROGRESSION_REACHING_OUTPUTS,
  PURCHASABLE_ACCELERANTS,
  SINK_REACH,
  asAcceleratedSeconds,
  asGymBucks,
  asIdleTenureDays,
  asInjuryDaysSaved,
  asNpcId,
  asReputation,
  asTrainingIq,
  asUnacceleratedSeconds,
  accelerantLicence,
  acceleratedOutput,
  applyAccelerant,
  assertEmpireState,
  buildSeconds,
  createEmpireClock,
  createEmpireState,
  createNpcLifter,
  elapsedFor,
  empireStateFaults,
  empireVocabularyFaults,
  equipmentTierCost,
  idleLedger,
  idleTenureDays,
  isEmpireAccelerant,
  isEmpireOutput,
  isProgressionReachingOutput,
  isPurchasableAccelerant,
  mayAccelerate,
  outputReach,
  physioDaysSavedFor,
  progressionLedger,
  recruitCost,
  recruitReputationThreshold,
  recruitSeconds,
  reputationTierIndex,
  rosterCapacity,
  settledLevel,
  settledTenureDays,
  spaceLevelCost,
  staffLevelCost,
  type AcceleratedOutput,
  type AppliedAccelerant,
  type EmpireAccelerant,
  type EmpireLedgerEntry,
  type EmpireState,
  type EquipmentTier,
  type GymAxes,
  type IdleTenureDays,
  type NpcTier,
  type SettledTenureDays,
  type StaffRole,
  type UnacceleratedSeconds,
} from './empireCore';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// The structural half — graded by `tsc --noEmit`, not by vitest
// ---------------------------------------------------------------------------

describe('a purchased accelerant does not typecheck onto a progression-reaching output', () => {
  it('accepts every legal pairing for a purchased skip, spelled out', () => {
    // The positive control for the directives below. If `AccelerableOutput`
    // resolved to `never` — which would also make the `@ts-expect-error`s pass
    // — these lines would not compile either. They do, so the licensed subset
    // is a real subset rather than an empty one.
    const legal: readonly AcceleratedOutput[] = [
      acceleratedOutput('gym-empire-timer-skip', 'gym-bucks'),
      acceleratedOutput('gym-empire-timer-skip', 'reputation'),
      acceleratedOutput('gym-empire-timer-skip', 'roster-slot'),
      acceleratedOutput('gym-empire-timer-skip', 'cosmetic-unlock'),
    ];
    // And the list is the whole list, cross-checked against the derived value
    // so it cannot go stale when an output is added.
    expect(legal.map((pairing) => pairing.output).sort()).toEqual([...IDLE_ONLY_OUTPUTS].sort());
  });

  it('refuses the Training IQ path, in both graders — GDD §8.3B into §5.2, hazard 1', () => {
    // Two graders on one call, and it needed both. The directive is `tsc`'s: a
    // widened `AccelerableOutput` makes it unused and the build fails. The
    // `toThrow` is vitest's, and it is what this test did not have — the line
    // here used to be `expect(bought.accelerant).toBe('gym-empire-timer-skip')`,
    // which reads back the argument that was just passed in and which no state
    // of the licence tables could change.
    expect(() =>
      acceleratedOutput(
        'gym-empire-timer-skip',
        // @ts-expect-error — 'training-iq' feeds 'training-pace', which is
        // progression-reaching; a store-purchase accelerant is licensed for
        // 'idle-only' and nothing else. GDD §8.1, §8.3B, §12.3.
        'training-iq',
      ),
    ).toThrow(
      /gym-empire-timer-skip arrives by store-purchase and may not accelerate training-iq, which reaches progression-reaching/,
    );
  });

  it('refuses the physio path, in both graders — GDD §5.4 into §3.5, hazard 2', () => {
    // The second path, closed by the same edit rather than by a second check.
    // 'training-iq' and 'physio-days-saved' both declare the 'training-pace'
    // sink, so they are one row in `SINK_REACH`. There is no configuration in
    // which one compiles and the other does not, which is the property the
    // currencyProvenance precedent exists to deliver.
    expect(() =>
      acceleratedOutput(
        'rewarded-ad-timer-skip',
        // @ts-expect-error — a shorter setback is training pace by another name,
        // and a rewarded ad is the same arrival row as a purchase.
        'physio-days-saved',
      ),
    ).toThrow(
      /rewarded-ad-timer-skip arrives by store-purchase and may not accelerate physio-days-saved, which reaches progression-reaching/,
    );
  });

  it('refuses the same two on `applyAccelerant`, which is the branch below', () => {
    // `acceleratedOutput` and `applyAccelerant` are two arms of one decision
    // and were written as two. Both now funnel through one non-generic callee
    // so the runtime refusal cannot be present on one and absent on the other,
    // and both are driven here rather than one being trusted to imply the
    // other.
    expect(() =>
      applyAccelerant(
        'gym-empire-timer-skip',
        // @ts-expect-error — hazard 1 through the stamped constructor.
        'training-iq',
        asUnacceleratedSeconds(0),
        EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
      ),
    ).toThrow(/may not accelerate training-iq/);
    expect(() =>
      applyAccelerant(
        'rewarded-ad-timer-skip',
        // @ts-expect-error — hazard 2 through the stamped constructor.
        'physio-days-saved',
        asUnacceleratedSeconds(0),
        EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
      ),
    ).toThrow(/may not accelerate physio-days-saved/);
  });

  it('refuses an accelerant whose type has widened to the union, in all three spellings', () => {
    // The defect the two directives above could not see. `AccelerableOutput<A>`
    // is only as narrow as `A`, `A` is inferred at the CALL SITE, and
    // `LicenceOfAccelerant<A>` is an indexed access that DISTRIBUTES over a
    // union key — so for `A = EmpireAccelerant` the licence is every licence
    // and the accelerable set is every output. All three spellings below
    // compiled, with no cast and only exported API. Their domain is exactly
    // the one the bare-literal directives never produce.
    const viaAParameter = (accelerant: EmpireAccelerant): AppliedAccelerant =>
      // @ts-expect-error — a union accelerant widens the licence to every
      // output; `OneAccelerant` refuses it at the first argument.
      applyAccelerant(accelerant, 'training-iq', asUnacceleratedSeconds(0), 1);

    const viaTheModulesOwnList = (): void => {
      for (const accelerant of EMPIRE_ACCELERANTS) {
        // @ts-expect-error — the element type of the exported list IS the union.
        applyAccelerant(accelerant, 'physio-days-saved', asUnacceleratedSeconds(0), 1);
      }
    };

    const viaTheDecodePath = (wire: unknown): void => {
      if (isEmpireAccelerant(wire)) {
        // @ts-expect-error — the narrowing lands on the union and goes no
        // further, and this is the exact path the runtime shadow exists for.
        acceleratedOutput(wire, 'training-iq');
      }
    };

    // And the runtime half, so vitest reports something for each spelling
    // rather than three comments.
    expect(() => viaAParameter('gym-empire-timer-skip')).toThrow(
      /gym-empire-timer-skip arrives by store-purchase and may not accelerate training-iq/,
    );
    expect(viaTheModulesOwnList).toThrow(/may not accelerate physio-days-saved/);
    expect(() => viaTheDecodePath('rewarded-ad-timer-skip')).toThrow(
      /rewarded-ad-timer-skip arrives by store-purchase and may not accelerate training-iq/,
    );

    // Discriminating rather than firing on everything: the same widened
    // parameter with an EARNED accelerant is legal and does not throw, and a
    // wire value that is not an accelerant never reaches the constructor.
    expect(() => viaAParameter('coach-staff-level')).not.toThrow();
    expect(() => viaTheDecodePath('not-an-accelerant')).not.toThrow();
  });

  it('refuses the illegal pairing as an object literal — the fence inference cannot move', () => {
    // `AcceleratedOutput` is the union `AppliedAccelerant` is built on. It is
    // checked against a VALUE rather than resolved from a call site's
    // inference, so union widening never reached it — it was the strongest
    // fence in `empireCore.ts` and the one thing with no test at all.
    const anyAccelerant = (index: number): EmpireAccelerant =>
      EMPIRE_ACCELERANTS[index % EMPIRE_ACCELERANTS.length] ?? 'coach-staff-level';

    // @ts-expect-error — the skip's member of the union types `output` as the
    // idle-only subset, and no other member accepts this accelerant.
    const boughtIq: AcceleratedOutput = {
      accelerant: 'gym-empire-timer-skip',
      output: 'training-iq',
    };
    // @ts-expect-error — and with the accelerant field typed as the whole
    // union: TypeScript checks a union-discriminated source against every
    // member, and the sold skip's member refuses this output.
    const widenedIq: AcceleratedOutput = { accelerant: anyAccelerant(0), output: 'training-iq' };

    // Two positive controls, so the refusals above are about the OUTPUT
    // reaching progression rather than about object literals or unions being
    // refused generally. Both of these compile.
    const legal: readonly AcceleratedOutput[] = [
      { accelerant: 'gym-empire-timer-skip', output: 'gym-bucks' },
      { accelerant: 'coach-staff-level', output: 'training-iq' },
      { accelerant: anyAccelerant(0), output: 'gym-bucks' },
    ];

    // The runtime half of the same three claims, so a licence widening is red
    // here as well as in the typecheck.
    expect(mayAccelerate(boughtIq.accelerant, boughtIq.output)).toBe(false);
    expect(mayAccelerate(widenedIq.accelerant, widenedIq.output)).toBe(false);
    let evaluated = 0;
    for (const pairing of legal) {
      expect(
        mayAccelerate(pairing.accelerant, pairing.output),
        `${pairing.accelerant} -> ${pairing.output}`,
      ).toBe(true);
      evaluated += 1;
    }
    // The line here was `expect(legal.length).toBe(3)`, guarding the `.every`
    // above against an empty list — but `legal` is three object literals eight
    // lines up, so no state of `empireCore.ts` moved it. It guarded the test
    // against being edited, which is not the same thing.
    //
    // What the list is for is two REASONS, so the reasons are what is counted,
    // read through the tables: two of these pairings are legal because the
    // output is idle-only, one because the accelerant is earned. Re-tagging the
    // sold skip as `'gym-progress'` — how §12.3's first refusal condition would
    // ship — moves those counts to 0 and 3.
    expect(evaluated).toBe(legal.length);
    expect(legal.filter((pairing) => isPurchasableAccelerant(pairing.accelerant)).length).toBe(2);
    expect(legal.filter((pairing) => !isPurchasableAccelerant(pairing.accelerant)).length).toBe(1);
    expect(legal.filter((pairing) => isProgressionReachingOutput(pairing.output)).length).toBe(1);
  });

  it('lets an earned accelerant reach the trickle, because §5.2 asks for that', () => {
    // The other positive control, and the one that stops the fix being the
    // too-broad one. §5.2 wants the empire connected to Sim progression; what
    // §8.1 refuses is a PURCHASE reaching it. A coach built with Gym Bucks is
    // not a purchase, so this compiles.
    const earned: readonly AcceleratedOutput[] = [
      acceleratedOutput('coach-staff-level', 'training-iq'),
      acceleratedOutput('space-level', 'physio-days-saved'),
      acceleratedOutput('reputation-tier', 'gym-bucks'),
    ];
    // The branch immediately below the one above, and its `expect(earned.length)
    // .toBe(3)` was the same guard against editing the test. Derived instead:
    // the list covers every earned accelerant, and it reaches both hazards. An
    // accelerant added to `EMPIRE_ACCELERANTS` on the `'gym-progress'` row
    // reddens the first line; re-tagging `'training-pace'` as `'idle-only'`,
    // the one-word edit that opens both hazards, reddens the second.
    expect(earned.map((pairing) => pairing.accelerant).sort()).toEqual(
      [...EARNED_ACCELERANTS].sort(),
    );
    expect(earned.filter((pairing) => isProgressionReachingOutput(pairing.output)).length).toBe(2);
    expect(earned.filter((pairing) => isPurchasableAccelerant(pairing.accelerant)).length).toBe(0);
  });

  it('refuses an accelerated clock where a wall clock is required, on every arm', () => {
    const clock = createEmpireClock(1000, 500);
    const lifter = createNpcLifter('a', 'novice', 'Placeholder', 0, 0);
    // @ts-expect-error — `settledTenureDays` takes UnacceleratedSeconds. The
    // physio and Training IQ halves run on the wall clock, so handing them the
    // accelerated one is a type error rather than a silent two-hop sale.
    const wrong = settledTenureDays(lifter, clock.accelerated);
    // @ts-expect-error — the sibling arm, written because the arm above was:
    // the idle half takes AcceleratedSeconds and the wall clock is not one.
    // This direction carried no directive for a round.
    const alsoWrong = idleTenureDays(lifter, clock.unaccelerated);
    // @ts-expect-error — and the level counter, whose `now` is the same seam.
    const wrongLevel = settledLevel([], clock.accelerated);
    // @ts-expect-error — including its first argument, which is the parameter
    // immediately beside the one above and had no directive either.
    const alsoWrongLevel = settledLevel([clock.accelerated], clock.unaccelerated);

    // The vitest half, and it is a quantity rather than a `typeof`. The line
    // here used to be `expect(typeof wrong).toBe('number')`, which is true of
    // every version of the subject — `settledTenureDays` returns a division
    // whatever it is declared to take, so no edit to `empireCore.ts` could
    // redden it. What the directives are worth is a NUMBER: routing the
    // accelerated clock into the settled tenure adds the whole purchased skip
    // to the term §5.2 pays Training IQ on, and this measures exactly that gap.
    const honest = settledTenureDays(lifter, clock.unaccelerated);
    expect(Number(wrong) - Number(honest)).toBeCloseTo(500 / EMPIRE_TUNING.SECONDS_PER_DAY, 9);
    expect(Number(wrong)).toBeGreaterThan(Number(honest));
    // And the sibling arm's gap, measured the same way rather than assumed.
    const idleHonest = idleTenureDays(lifter, clock.accelerated);
    expect(Number(idleHonest) - Number(alsoWrong)).toBeCloseTo(
      500 / EMPIRE_TUNING.SECONDS_PER_DAY,
      9,
    );
    // The level counter's two arms, driven so the directives above are about
    // values the subject really computes.
    expect(Number(wrongLevel)).toBe(0);
    expect(Number(alsoWrongLevel)).toBe(0);
    expect(settledLevel([asUnacceleratedSeconds(1000)], clock.unaccelerated)).toBe(1);
    // The two readings differ, so the refusals above are about a brand rather
    // than about two names for one number.
    expect(Number(clock.accelerated)).not.toBe(Number(clock.unaccelerated));
    // The directives themselves are graded by `tsc --noEmit`. What vitest can
    // redden for them is the DECLARATION, and that is the signature scan in
    // 'fences every branded quantity in its own declaration' below — it pins
    // `now: UnacceleratedSeconds` and the return brand for each function named
    // here, so widening either to `number` is red in vitest as well as in tsc.
  });

  it('refuses one tenure brand where the other is required — hazard 1’s derived quantity', () => {
    // The fence that was missing, and the one §5.2 actually needs. Tenure is
    // the word §5.2 uses for the Training IQ input, and it shipped as ONE brand
    // for both clocks — so the expression below compiled, with no cast, no `as`
    // and only exported API, carrying the purchased skip twice over: through
    // `now` and through `NpcLifter.joinedAt`. Hazard 2's derived quantity had
    // its own brand (`SettledLevel`) twelve lines away in the same file.
    //
    // The fixture is a lifter whose recruitment was skipped by a day: three
    // days of wall time, one day of purchased skip, so the lifter has been on
    // the roster four days and would have settled after one.
    const day = EMPIRE_TUNING.SECONDS_PER_DAY;
    const clock = createEmpireClock(day * 3, day);
    const lifter = createNpcLifter('a', 'novice', 'Placeholder', 0, day);

    // @ts-expect-error — an idle tenure is not what the trickle reads.
    const iqInput: SettledTenureDays = idleTenureDays(lifter, clock.accelerated);
    // @ts-expect-error — the sibling direction, applied mechanically.
    const bucksInput: IdleTenureDays = settledTenureDays(lifter, clock.unaccelerated);
    // @ts-expect-error — and the re-brand, which is how the raw-clock fence was
    // walked around before `Unbranded` landed. There is no `asSettledTenureDays`
    // to write the other direction with, which the constructor pin below
    // enforces by naming every `as*` this module exports.
    const rebranded = asIdleTenureDays(settledTenureDays(lifter, clock.unaccelerated));

    // The vitest half, and it is the decomposition rather than an inequality:
    // the gap between the two tenures is TWO days on a one-day purchase, one
    // from the clock the argument came off and one from the origin it was
    // measured against. That is what "carries the purchased skip twice" means,
    // in a number, and an engine that measured both from `joinedAt` or both on
    // one clock collapses it to one day or to zero.
    expect(Number(iqInput)).toBeCloseTo(4, 9);
    expect(Number(bucksInput)).toBeCloseTo(2, 9);
    const fromTheClock = Number(idleTenureDays(lifter, clock.accelerated)) -
      Number(idleTenureDays(lifter, asAcceleratedSeconds(day * 3)));
    const fromTheOrigin = Number(idleTenureDays(lifter, asAcceleratedSeconds(day * 3))) -
      Number(bucksInput);
    expect(fromTheClock).toBeCloseTo(1, 9);
    expect(fromTheOrigin).toBeCloseTo(1, 9);
    expect(fromTheClock + fromTheOrigin).toBeCloseTo(Number(iqInput) - Number(bucksInput), 9);
    expect(Number(rebranded)).toBe(Number(bucksInput));

    // And the seam itself, written out. E0 exports no Training IQ rate — that
    // is E1's — so the consumer is declared here in the shape E1 has to write
    // it, and the question the bar asks is put to the compiler directly: can a
    // legal expression built only from exported API let a purchasable
    // accelerant change Training IQ? The two lines below are the two ways it
    // could, and both are type errors.
    const trainingIqFor = (tenure: SettledTenureDays): number =>
      Number(tenure) * EMPIRE_TUNING.NPC_TRAINING_IQ_PER_DAY_BASE;
    // @ts-expect-error — the accelerated clock into the trickle, in one call.
    trainingIqFor(idleTenureDays(lifter, clock.accelerated));
    // @ts-expect-error — and a bare number, so the fence is not one spelling
    // wide.
    trainingIqFor(day * 4);
    // The legal call, so the refusals above are about the brand rather than
    // about the function refusing everything.
    expect(trainingIqFor(settledTenureDays(lifter, clock.unaccelerated))).toBeCloseTo(
      2 * EMPIRE_TUNING.NPC_TRAINING_IQ_PER_DAY_BASE,
      9,
    );
  });

  it('refuses a re-brand, which is how the argument list above was walked around', () => {
    // Every brand here IS its primitive, so `AcceleratedSeconds` is a `number`
    // and `asUnacceleratedSeconds` took a `number`. That made the fence in the
    // test above one call wide:
    //
    //     settledTenureDays(lifter, asUnacceleratedSeconds(clock.accelerated))
    //
    // compiled clean and fed the purchase-moved clock straight into the
    // Training IQ tenure term. It is a type error now, and so is every sibling
    // of it — the guard is one `Unbranded<N>` applied to every `as*`
    // constructor rather than to the one that was noticed.
    //
    // How many that is, is not asserted in a sentence here either. It was
    // asserted in one, in this comment and in `empireCore.ts`, and the sentence
    // said nine when there were eight. The constructor list is read out of the
    // source and pinned by name in 'fences every branded quantity in its own
    // declaration' below, which is also the line vitest reddens when
    // `Unbranded<N>` is dropped from one of them — the three assertions at the
    // bottom of this test are NOT that line. They state that the constructors
    // still mint the same value, which is true with the guard and without it.
    const clock = createEmpireClock(1000, 500);
    const lifter = createNpcLifter('a', 'novice', 'Placeholder', 0, 0);

    // @ts-expect-error — hazard 2 in one expression: an accelerated reading
    // re-branded as wall time.
    const laundered = asUnacceleratedSeconds(clock.accelerated);
    // @ts-expect-error — the sibling direction, applied mechanically.
    const alsoLaundered = asAcceleratedSeconds(clock.unaccelerated);
    // @ts-expect-error — and the string brand, so the ban is not numeric-only.
    const reIded = asNpcId(lifter.id);

    // Runtime: the constructors still mint, so these are the same numbers. The
    // refusal is entirely at the argument list, which is what makes it worth
    // asserting that they ARE the same numbers — a reader should not think the
    // ban is doing arithmetic. Read these three as documentation of what the
    // ban is not; the guard's own reddenable line is the constructor pin named
    // above.
    expect(Number(laundered)).toBe(Number(clock.accelerated));
    expect(Number(alsoLaundered)).toBe(Number(clock.unaccelerated));
    expect(String(reIded)).toBe(String(lifter.id));

    // The stated limit, driven rather than described: arithmetic launders, and
    // no signature can see it. This compiles, deliberately, and E6's
    // element-wise ledger comparison is what covers it.
    const throughArithmetic = asUnacceleratedSeconds(Number(clock.accelerated) + 0);
    expect(Number(throughArithmetic)).toBe(Number(clock.accelerated));
    expect(Number(throughArithmetic)).not.toBe(Number(clock.unaccelerated));
  });

  it('refuses a bare number where a settled level is required', () => {
    // Whole days, because `asInjuryDaysSaved` refuses a fraction at the seam —
    // the sibling probe below really is evaluated rather than short-circuited
    // by a throw.
    const day = EMPIRE_TUNING.SECONDS_PER_DAY;
    const clock = createEmpireClock(day * 2, day);
    const lifter = createNpcLifter('a', 'novice', 'Placeholder', 0, 0);
    // @ts-expect-error — `physioDaysSavedFor` takes a SettledLevel, which only
    // `settledLevel` produces and which only UnacceleratedSeconds reach.
    const wrong = physioDaysSavedFor(1);
    // @ts-expect-error — the sibling quantity, checked rather than trusted to
    // follow: the two derived brands are not interchangeable with each other
    // either, so an idle tenure cannot stand in for a settled level.
    const alsoWrong = physioDaysSavedFor(idleTenureDays(lifter, clock.accelerated));

    // This line used to be `expect(typeof wrong).toBe('number')`, which is true
    // of every version of `physioDaysSavedFor` — it returns a number whether it
    // is declared to take a `SettledLevel` or a `number`, so the named subject
    // edit could not redden it. What vitest can grade here is the VALUE the
    // brand carries: a level of 1 buys exactly the table's per-level saving,
    // capped, and that is a fact about the tuning the fence protects.
    const oneLevel = settledLevel([asUnacceleratedSeconds(0)], asUnacceleratedSeconds(1));
    expect(Number(wrong)).toBe(
      Math.min(
        EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED,
        EMPIRE_TUNING.PHYSIO_DAYS_SAVED_PER_STAFF_LEVEL,
      ),
    );
    expect(Number(wrong)).toBe(Number(physioDaysSavedFor(oneLevel)));
    expect(Number(alsoWrong)).toBe(EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED);
    // The declaration itself — `level: SettledLevel`, not `level: number` — is
    // pinned by the signature scan in 'fences every branded quantity in its own
    // declaration', which is the line vitest reddens when this directive stops
    // being a directive.
  });
});

// ---------------------------------------------------------------------------
// The four tables
// ---------------------------------------------------------------------------

describe('the reach and licence tables are exhaustive and cannot disagree', () => {
  it('gives every output a sink and every sink a reach', () => {
    expect(Object.keys(OUTPUT_SINK).sort()).toEqual([...EMPIRE_OUTPUTS].sort());
    expect(Object.keys(SINK_REACH).sort()).toEqual([...OUTPUT_SINKS].sort());
    for (const output of EMPIRE_OUTPUTS) {
      expect(OUTPUT_SINKS).toContain(OUTPUT_SINK[output]);
    }
    for (const sink of OUTPUT_SINKS) {
      expect(OUTPUT_REACHES).toContain(SINK_REACH[sink]);
    }
    // This line was `expect(EMPIRE_OUTPUT_REACH_IS_A_PARTITION).toBe(true)`.
    // That constant is the literal `true` and its type is a tautology by
    // construction — `ProgressionReachingOutput` is defined as an `Exclude`, so
    // both `extends [never]` branches resolve whatever the tables say. Flipping
    // `SINK_REACH['training-pace']` to `'idle-only'`, the single edit
    // `empireCore.ts` itself calls out as the one that opens both hazards, left
    // it green in vitest AND in tsc.
    //
    // What reddens on that edit is membership, so membership is what is pinned.
    // It is the derived lists that are pinned, not a second source of truth:
    // `IdleOnlyOutput` is still the mapped filter and nothing reads these.
    expect([...PROGRESSION_REACHING_OUTPUTS].sort()).toEqual([
      'physio-days-saved',
      'training-iq',
    ]);
    expect([...IDLE_ONLY_OUTPUTS].sort()).toEqual([
      'cosmetic-unlock',
      'gym-bucks',
      'reputation',
      'roster-slot',
    ]);
    expect(empireVocabularyFaults()).toEqual([]);
  });

  it('gives every accelerant an arrival and every arrival a licence', () => {
    expect(Object.keys(ACCELERANT_ARRIVAL).sort()).toEqual([...EMPIRE_ACCELERANTS].sort());
    expect(Object.keys(ARRIVAL_LICENCE).sort()).toEqual([...ACCELERANT_ARRIVALS].sort());
    for (const accelerant of EMPIRE_ACCELERANTS) {
      expect(ACCELERANT_ARRIVALS).toContain(ACCELERANT_ARRIVAL[accelerant]);
    }
    for (const arrival of ACCELERANT_ARRIVALS) {
      const licence = ARRIVAL_LICENCE[arrival];
      expect(licence.length, `${arrival} licenses nothing`).toBeGreaterThan(0);
      for (const reach of licence) expect(OUTPUT_REACHES).toContain(reach);
    }
    // The branch immediately below the one above, and it was written the same
    // way and was vacuous for the same reason. `EarnedAccelerant` is an
    // `Exclude`, so re-tagging the sold skip as `'gym-progress'` — which is
    // precisely how §12.3's first refusal condition would ship — moved a member
    // from one half to the other and left the partition, and the assertion that
    // used to be here, perfectly green.
    expect([...PURCHASABLE_ACCELERANTS].sort()).toEqual([
      'gym-empire-timer-skip',
      'rewarded-ad-timer-skip',
    ]);
    expect([...EARNED_ACCELERANTS].sort()).toEqual([
      'coach-staff-level',
      'reputation-tier',
      'space-level',
    ]);
  });

  it('publishes what each arrival is licensed to touch, by name', () => {
    // The licence table read through the helper the runtime uses. Adding
    // `'progression-reaching'` to the `'store-purchase'` row — the one-word
    // edit `empireCore.ts` is arranged around — reddens the first two lines.
    expect([...accelerantLicence('gym-empire-timer-skip')]).toEqual(['idle-only']);
    expect([...accelerantLicence('rewarded-ad-timer-skip')]).toEqual(['idle-only']);
    expect([...accelerantLicence('coach-staff-level')].sort()).toEqual([
      'idle-only',
      'progression-reaching',
    ]);
  });

  it('makes hazard 1 and hazard 2 one row, not two', () => {
    // The runtime shadow of the header's §2. Both progression-reaching outputs
    // share a sink, so re-tagging that sink is the single edit that opens or
    // closes both, and there is no per-output verdict anywhere for two people
    // to decide differently.
    expect(OUTPUT_SINK['training-iq']).toBe(OUTPUT_SINK['physio-days-saved']);
    const onTrainingPace = EMPIRE_OUTPUTS.filter(
      (output) => OUTPUT_SINK[output] === 'training-pace',
    );
    // Counts, not bounds — this file's own rule, applied to the two lines that
    // were written as bounds. "Closing one closes both" is about exactly two
    // things on each axis, and a third arriving is a decision somebody signs.
    expect(onTrainingPace.length).toBe(2);
    expect(onTrainingPace).toContain('training-iq');
    expect(onTrainingPace).toContain('physio-days-saved');
    // And the same for the two purchased accelerants.
    expect(ACCELERANT_ARRIVAL['gym-empire-timer-skip']).toBe(
      ACCELERANT_ARRIVAL['rewarded-ad-timer-skip'],
    );
    expect(PURCHASABLE_ACCELERANTS.length).toBe(2);
  });

  it('partitions both axes, and no half is empty', () => {
    // The anti-vacuity that matters most here. A licence whose banned side is
    // empty bans nothing and passes every other test in this file; one whose
    // allowed side is empty is the over-broad fix that deletes §5.2's whole
    // connection to Sim progression. Both are failures.
    expect(PROGRESSION_REACHING_OUTPUTS.length, 'nothing is protected').toBeGreaterThan(0);
    expect(IDLE_ONLY_OUTPUTS.length, 'a purchase may touch nothing at all').toBeGreaterThan(0);
    expect([...IDLE_ONLY_OUTPUTS, ...PROGRESSION_REACHING_OUTPUTS].sort()).toEqual(
      [...EMPIRE_OUTPUTS].sort(),
    );
    expect(PURCHASABLE_ACCELERANTS.length, 'nothing is sold, so nothing is gated').toBeGreaterThan(
      0,
    );
    expect(EARNED_ACCELERANTS.length, 'nothing is earned, so §5.2 pays nothing').toBeGreaterThan(0);
    expect([...PURCHASABLE_ACCELERANTS, ...EARNED_ACCELERANTS].sort()).toEqual(
      [...EMPIRE_ACCELERANTS].sort(),
    );
    for (const accelerant of PURCHASABLE_ACCELERANTS) {
      expect(EARNED_ACCELERANTS).not.toContain(accelerant);
    }
  });

  it('walks the whole cross product rather than the pairs somebody thought of', () => {
    // The oracle here used to be
    //
    //     accelerantLicence(accelerant).includes(outputReach(output))
    //
    // which is `mayAccelerate`'s body character for character. No edit to any
    // of the four tables could make the two sides disagree, because both sides
    // were the same two lookups; only an edit to `mayAccelerate` itself
    // reddened it, and `mayAccelerate` is not the subject the §12.3 guarantee
    // is about. The whole test was carried by the count pins at the bottom.
    //
    // The oracle below states the RULE instead: a purchase may not touch
    // anything that reaches Sim progression. It reads `ACCELERANT_ARRIVAL` and
    // the sink tables and does NOT read `ARRIVAL_LICENCE`, so widening the
    // store-purchase licence — the §12.3 edit — makes the two sides disagree
    // on four pairs and this goes red.
    //
    // What it is blind to, stated rather than left for the next reader: an
    // edit to `SINK_REACH` moves both sides together, because both ask what an
    // output reaches. That edit is caught by the membership pin two tests
    // above, and by nothing here.
    let refused = 0;
    let allowed = 0;
    for (const accelerant of EMPIRE_ACCELERANTS) {
      for (const output of EMPIRE_OUTPUTS) {
        const banned = isPurchasableAccelerant(accelerant) && isProgressionReachingOutput(output);
        expect(mayAccelerate(accelerant, output), `${accelerant} -> ${output}`).toBe(!banned);
        if (banned) refused += 1;
        else allowed += 1;
      }
    }
    // Counts, not bounds, so an empty domain reports itself. Five accelerants
    // by six outputs is thirty pairs; two purchased accelerants against two
    // progression-reaching outputs is the four that are refused.
    expect(allowed + refused).toBe(EMPIRE_ACCELERANTS.length * EMPIRE_OUTPUTS.length);
    expect(refused).toBe(4);
    expect(allowed).toBe(26);
  });

  it('refuses every purchased accelerant on every progression-reaching output', () => {
    // The branch immediately below the one whose oracle was just rewritten,
    // and it had the same shape of hole: two nested loops with no count on
    // either, so emptying `PROGRESSION_REACHING_OUTPUTS` would have made the
    // inner one walk nothing and pass.
    let bannedPairs = 0;
    let stillSellable = 0;
    for (const accelerant of PURCHASABLE_ACCELERANTS) {
      for (const output of PROGRESSION_REACHING_OUTPUTS) {
        expect(mayAccelerate(accelerant, output), `${accelerant} -> ${output}`).toBe(false);
        bannedPairs += 1;
      }
      // And it may still touch the idle economy, so the sale is a real sale.
      expect(
        IDLE_ONLY_OUTPUTS.every((output) => mayAccelerate(accelerant, output)),
        `${accelerant} may accelerate nothing at all`,
      ).toBe(true);
      stillSellable += 1;
    }
    expect(bannedPairs).toBe(4);
    expect(stillSellable).toBe(2);
  });

  it('names no forbidden output among the payable ones', () => {
    // This line was `expect(EMPIRE_PAYS_NO_FORBIDDEN_OUTPUT).toBe(true)`. That
    // constant is declared FROM the literal `true`, so under vitest no state of
    // the tables changed what it read — it does bite under `tsc --noEmit`, and
    // it reads here as a fourth independent runtime check that it never was.
    // `empireVocabularyFaults` walks the same claim off the tables, and the
    // loop below is the other honest half.
    expect(empireVocabularyFaults()).toEqual([]);
    // Named rather than absent: GDD §8.3E's condition 3 rules out "true by the
    // current absence of a code path", and §8.2's own history is that a tender
    // list kept achievement Chalk out by having no word for it.
    expect(EMPIRE_FORBIDDEN_OUTPUTS).toContain('covered-day');
    expect(EMPIRE_FORBIDDEN_OUTPUTS).toContain('chalk');
    // Counts, not bounds — the sibling correction, applied to the line that
    // guarded this loop's domain with `toBeGreaterThan(0)`.
    expect([...EMPIRE_FORBIDDEN_OUTPUTS].sort()).toEqual([
      'chalk',
      'competition-total',
      'covered-day',
      'e1rm',
    ]);
    let walked = 0;
    for (const forbidden of EMPIRE_FORBIDDEN_OUTPUTS) {
      expect(EMPIRE_OUTPUTS as readonly string[], forbidden).not.toContain(forbidden);
      expect(isEmpireOutput(forbidden), `${forbidden} decoded as a payable output`).toBe(false);
      walked += 1;
    }
    expect(walked).toBe(4);
  });

  it('lets a name mislead nobody — the sink is what decides it', () => {
    // A floor under the tables, and stated as a floor. An output called
    // `'gym-sparkles'` that secretly wrote Training IQ satisfies this, and the
    // thing that catches THAT is having to write a sink next to it. What this
    // catches is the copy-paste: adding `'training-iq-bonus'` and leaving the
    // sink on `'gym-economy'` because the line above said so.
    for (const output of EMPIRE_OUTPUTS) {
      if (/iq|physio|injury|e1rm|total|pace/i.test(output)) {
        expect(OUTPUT_SINK[output], `${output} names something Sim progression reads`).toBe(
          'training-pace',
        );
      }
    }
    // And the scan is not matching nothing.
    expect(
      EMPIRE_OUTPUTS.some((output) => /iq|physio/i.test(output)),
      'no output name trips the scan, so the loop above proves nothing',
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The runtime guards, for callers the compiler never sees
// ---------------------------------------------------------------------------

describe('the runtime predicates refuse what the types refuse', () => {
  it('agrees with the tables on every member', () => {
    // The oracles here were `outputReach(output) === 'progression-reaching'`
    // and `ACCELERANT_ARRIVAL[accelerant] === 'store-purchase'` — which are the
    // two predicates' own bodies, character for character. No edit to any of
    // the four tables could make either side disagree with the other, because
    // both sides performed the identical lookup. That is the defect
    // `empireCore.ts` says was removed from the cross product, left standing in
    // the describe block immediately below it.
    //
    // The oracle is the PIN instead — the same two membership lists the four
    // tables are pinned against above, restated as a predicate. Re-tagging
    // `'training-pace'` as `'idle-only'`, or the sold skip as
    // `'gym-progress'`, now makes the two sides disagree instead of moving
    // them together.
    let outputsWalked = 0;
    let reaching = 0;
    for (const output of EMPIRE_OUTPUTS) {
      expect(isEmpireOutput(output)).toBe(true);
      const pinned = output === 'training-iq' || output === 'physio-days-saved';
      expect(isProgressionReachingOutput(output), output).toBe(pinned);
      if (pinned) reaching += 1;
      outputsWalked += 1;
    }
    let accelerantsWalked = 0;
    let purchasable = 0;
    for (const accelerant of EMPIRE_ACCELERANTS) {
      expect(isEmpireAccelerant(accelerant)).toBe(true);
      const pinned =
        accelerant === 'gym-empire-timer-skip' || accelerant === 'rewarded-ad-timer-skip';
      expect(isPurchasableAccelerant(accelerant), accelerant).toBe(pinned);
      if (pinned) purchasable += 1;
      accelerantsWalked += 1;
    }
    // Counts, not bounds, on both halves of the domain and on both verdicts.
    expect(outputsWalked).toBe(6);
    expect(reaching).toBe(2);
    expect(accelerantsWalked).toBe(5);
    expect(purchasable).toBe(2);
  });

  it('refuses wire garbage, including the words the empire may not pay in', () => {
    const garbage: readonly unknown[] = [
      'covered-day',
      'chalk',
      'e1rm',
      'competition-total',
      'timer-skip',
      '',
      null,
      undefined,
      42,
      { output: 'gym-bucks' },
      ['gym-bucks'],
      'GYM-BUCKS',
    ];
    for (const value of garbage) {
      expect(isEmpireOutput(value), `${String(value)} is not an output`).toBe(false);
      expect(isEmpireAccelerant(value), `${String(value)} is not an accelerant`).toBe(false);
      expect(isPurchasableAccelerant(value), `${String(value)} is not purchasable`).toBe(false);
      expect(isProgressionReachingOutput(value), `${String(value)} reaches nothing`).toBe(false);
    }
  });

  it('derives its published lists rather than re-listing them', () => {
    // Four loops with no count of their own: if all four lists went empty,
    // every loop below would walk nothing and this test would pass. The counts
    // are pinned in a different `it(` two describes up, which is exactly the
    // "a witness proves one assertion, not the others in the same test" gap —
    // so each loop counts what it actually walked, here, beside itself.
    let idle = 0;
    let reaching = 0;
    let purchasable = 0;
    let earned = 0;
    for (const output of IDLE_ONLY_OUTPUTS) {
      expect(isProgressionReachingOutput(output), output).toBe(false);
      idle += 1;
    }
    for (const output of PROGRESSION_REACHING_OUTPUTS) {
      expect(isProgressionReachingOutput(output), output).toBe(true);
      reaching += 1;
    }
    for (const accelerant of PURCHASABLE_ACCELERANTS) {
      expect(isPurchasableAccelerant(accelerant), accelerant).toBe(true);
      purchasable += 1;
    }
    for (const accelerant of EARNED_ACCELERANTS) {
      expect(isPurchasableAccelerant(accelerant), accelerant).toBe(false);
      earned += 1;
    }
    expect(idle).toBe(4);
    expect(reaching).toBe(2);
    expect(purchasable).toBe(2);
    expect(earned).toBe(3);
    // And the two axes are covered exactly once each, so a list that had gone
    // empty is red on the count above and on the total here.
    expect(idle + reaching).toBe(EMPIRE_OUTPUTS.length);
    expect(purchasable + earned).toBe(EMPIRE_ACCELERANTS.length);
  });
});

// ---------------------------------------------------------------------------
// The clock split
// ---------------------------------------------------------------------------

describe('the clock split', () => {
  it('leaves the wall clock a function of wall time alone', () => {
    // The property piece E6's sweep is the horizon-wide version of. Here it is
    // the local statement: whatever is skipped, the un-accelerated reading is
    // the elapsed seconds it was given.
    let pairsWithASkip = 0;
    let pairsWhereTheClocksDiffer = 0;
    for (const elapsed of [0, 1, 60, 3600, 86400, 604800]) {
      for (const skipped of [0, 1, 3600, 86400]) {
        const clock = createEmpireClock(elapsed, skipped);
        expect(clock.unaccelerated, `elapsed ${elapsed}, skipped ${skipped}`).toBe(elapsed);
        expect(clock.accelerated).toBe(elapsed + skipped);
        if (skipped > 0) pairsWithASkip += 1;
        if (Number(clock.accelerated) !== Number(clock.unaccelerated)) {
          pairsWhereTheClocksDiffer += 1;
        }
      }
    }
    // Counts rather than bounds. A generator that produced no skip at all
    // would leave every assertion above trivially true, which is the empty
    // domain this file's header is about.
    expect(pairsWithASkip).toBe(18);
    expect(pairsWhereTheClocksDiffer).toBe(18);
  });

  it('hands each output the clock its reach entitles it to, on both arms', () => {
    const clock = createEmpireClock(1000, 500);
    // The two readings differ, so an implementation that returned the same one
    // for both arms is visible. Without this the check below is one number
    // compared with itself.
    expect(Number(clock.accelerated)).not.toBe(Number(clock.unaccelerated));

    let progressionArm = 0;
    let idleArm = 0;
    for (const output of EMPIRE_OUTPUTS) {
      const elapsed = elapsedFor(clock, output);
      if (outputReach(output) === 'progression-reaching') {
        expect(elapsed, `${output} read the accelerated clock`).toBe(clock.unaccelerated);
        progressionArm += 1;
      } else {
        expect(elapsed, `${output} read the wall clock`).toBe(clock.accelerated);
        idleArm += 1;
      }
    }
    // Both arms were driven, and by how many outputs each.
    expect(progressionArm).toBe(2);
    expect(idleArm).toBe(4);
  });

  it('counts settled levels on the wall clock and nothing else', () => {
    const completions: readonly UnacceleratedSeconds[] = [100, 200, 300].map(
      asUnacceleratedSeconds,
    );
    expect(settledLevel(completions, asUnacceleratedSeconds(0))).toBe(0);
    expect(settledLevel(completions, asUnacceleratedSeconds(100))).toBe(1);
    expect(settledLevel(completions, asUnacceleratedSeconds(250))).toBe(2);
    expect(settledLevel(completions, asUnacceleratedSeconds(10000))).toBe(3);
    expect(settledLevel([], asUnacceleratedSeconds(10000))).toBe(0);
  });

  it('measures a lifter’s two tenures from its two arrival times', () => {
    const day = EMPIRE_TUNING.SECONDS_PER_DAY;
    // A lifter whose recruitment was skipped: on the roster a day early.
    const lifter = createNpcLifter('a', 'club', 'Placeholder', 0, day);
    expect(idleTenureDays(lifter, asAcceleratedSeconds(day))).toBeCloseTo(1, 9);
    expect(settledTenureDays(lifter, asUnacceleratedSeconds(day))).toBeCloseTo(0, 9);
    expect(settledTenureDays(lifter, asUnacceleratedSeconds(day * 2))).toBeCloseTo(1, 9);
    // And neither goes negative before the lifter exists.
    expect(settledTenureDays(lifter, asUnacceleratedSeconds(0))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

describe('the branded constructors', () => {
  it('accepts ordinary values', () => {
    expect(asGymBucks(0)).toBe(0);
    expect(asGymBucks(1234.5)).toBe(1234.5);
    expect(asReputation(EMPIRE_TUNING.REPUTATION_MAX)).toBe(EMPIRE_TUNING.REPUTATION_MAX);
    expect(asTrainingIq(3)).toBe(3);
    expect(asIdleTenureDays(0.5)).toBe(0.5);
    expect(asUnacceleratedSeconds(0)).toBe(0);
    expect(asAcceleratedSeconds(7)).toBe(7);
    expect(asNpcId('lifter-1')).toBe('lifter-1');
  });

  it('refuses what is not a quantity', () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => asGymBucks(bad), `gymBucks ${bad}`).toThrow(RangeError);
      expect(() => asReputation(bad), `reputation ${bad}`).toThrow(RangeError);
      expect(() => asTrainingIq(bad), `trainingIq ${bad}`).toThrow(RangeError);
      expect(() => asUnacceleratedSeconds(bad), `seconds ${bad}`).toThrow(RangeError);
      expect(() => asAcceleratedSeconds(bad), `seconds ${bad}`).toThrow(RangeError);
      expect(() => asIdleTenureDays(bad), `tenure ${bad}`).toThrow(RangeError);
    }
    expect(() => asReputation(EMPIRE_TUNING.REPUTATION_MAX + 1)).toThrow(/REPUTATION_MAX/);
    expect(() => asNpcId('')).toThrow(RangeError);
    expect(() => createNpcLifter('a', 'novice', '', 0, 0)).toThrow(RangeError);
  });

  it('bounds the physio hook at the seam rather than at the far end of it', () => {
    // `recordSession` refuses a fractional or negative `physioDaysSaved`, and
    // it clamps at its own floor. Both refusals are repeated here so the
    // message names the empire table that produced the value.
    expect(asInjuryDaysSaved(0)).toBe(0);
    expect(asInjuryDaysSaved(EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED)).toBe(
      EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED,
    );
    expect(() => asInjuryDaysSaved(0.5)).toThrow(/whole number/);
    expect(() => asInjuryDaysSaved(-1)).toThrow(RangeError);
    expect(() => asInjuryDaysSaved(EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED + 1)).toThrow(
      /PHYSIO_MAX_DAYS_SAVED/,
    );
  });

  it('turns a settled level into days saved, and clamps rather than throwing', () => {
    expect(physioDaysSavedFor(settledLevel([], asUnacceleratedSeconds(0)))).toBe(0);
    const oneLevel = settledLevel([asUnacceleratedSeconds(0)], asUnacceleratedSeconds(1));
    expect(physioDaysSavedFor(oneLevel)).toBe(
      Math.min(
        EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED,
        EMPIRE_TUNING.PHYSIO_DAYS_SAVED_PER_STAFF_LEVEL,
      ),
    );
    // A level list longer than the ladder saturates instead of exceeding the
    // ceiling, so a wiring mistake upstream is a capped value rather than a
    // throw at the fatigue seam.
    const manyLevels = settledLevel(
      [0, 1, 2, 3, 4, 5, 6].map(asUnacceleratedSeconds),
      asUnacceleratedSeconds(100),
    );
    expect(manyLevels).toBe(7);
    expect(physioDaysSavedFor(manyLevels)).toBe(EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED);
  });
});

// ---------------------------------------------------------------------------
// The ladders, read through the core
// ---------------------------------------------------------------------------

describe('the ladder lookups', () => {
  it('prices every recruit tier deterministically, with no seed anywhere', () => {
    for (const tier of EMPIRE_TUNING.NPC_TIERS) {
      const first = recruitCost(tier);
      // Called twice, because determinism is the §12.3 refusal condition here
      // and a function that consulted a generator would differ between calls.
      expect(recruitCost(tier)).toBe(first);
      expect(first).toBe(EMPIRE_TUNING.NPC_RECRUIT_COST_GYM_BUCKS[tier]);
      expect(recruitReputationThreshold(tier)).toBe(
        EMPIRE_TUNING.NPC_RECRUIT_REPUTATION_THRESHOLD[tier],
      );
      expect(recruitSeconds(tier)).toBe(EMPIRE_TUNING.NPC_RECRUIT_SECONDS[tier]);
    }
  });

  it('prices the axes and returns null off the ladder', () => {
    for (const tier of EMPIRE_TUNING.EQUIPMENT_TIERS) {
      expect(equipmentTierCost(tier)).toBe(EMPIRE_TUNING.EQUIPMENT_TIER_COST_GYM_BUCKS[tier]);
    }
    expect(spaceLevelCost(0)).toBeNull();
    expect(spaceLevelCost(1)).toBe(EMPIRE_TUNING.SPACE_LEVEL_COST_GYM_BUCKS[0]);
    expect(spaceLevelCost(EMPIRE_TUNING.SPACE_LEVEL_MAX)).not.toBeNull();
    expect(spaceLevelCost(EMPIRE_TUNING.SPACE_LEVEL_MAX + 1)).toBeNull();
    for (const role of EMPIRE_TUNING.STAFF_ROLES) {
      expect(staffLevelCost(role, 0)).toBeNull();
      expect(staffLevelCost(role, 1)).toBe(EMPIRE_TUNING.STAFF_LEVEL_COST_GYM_BUCKS[role][0]);
      expect(staffLevelCost(role, EMPIRE_TUNING.STAFF_LEVEL_MAX[role])).not.toBeNull();
      expect(staffLevelCost(role, EMPIRE_TUNING.STAFF_LEVEL_MAX[role] + 1)).toBeNull();
    }
  });

  it('grows a build timer with the level and caps it', () => {
    let previous = 0;
    for (let level = 1; level <= EMPIRE_TUNING.SPACE_LEVEL_MAX; level += 1) {
      const seconds = buildSeconds(level);
      expect(seconds, `level ${level}`).toBeGreaterThan(previous);
      previous = seconds;
    }
    // The cap is slack today, so it is exercised by asking past the ladder.
    expect(buildSeconds(100)).toBe(EMPIRE_TUNING.BUILD_SECONDS_MAX);
  });

  it('places a gym in a reputation tier, monotonically', () => {
    expect(reputationTierIndex(asReputation(0))).toBe(0);
    expect(reputationTierIndex(asReputation(EMPIRE_TUNING.REPUTATION_MAX))).toBe(
      EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS.length - 1,
    );
    let previous = 0;
    let increases = 0;
    for (let points = 0; points <= EMPIRE_TUNING.REPUTATION_MAX; points += 50) {
      const index = reputationTierIndex(asReputation(points));
      expect(index, `${points} points`).toBeGreaterThanOrEqual(previous);
      if (index > previous) increases += 1;
      previous = index;
    }
    // Counts, not bounds: the sweep really does cross every boundary.
    expect(increases).toBe(EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS.length - 1);
  });

  it('grows roster capacity with the two axes that pay it, and caps it', () => {
    const axes = (spaceLevel: number, spotter: number): GymAxes => ({
      equipment: EMPIRE_TUNING.EQUIPMENT_TIERS[0],
      spaceLevel,
      staffLevel: { coach: 0, spotter, physio: 0 },
    });
    expect(rosterCapacity(axes(0, 0))).toBe(EMPIRE_TUNING.ROSTER_SLOTS_BASE);
    expect(rosterCapacity(axes(1, 0))).toBe(
      EMPIRE_TUNING.ROSTER_SLOTS_BASE + EMPIRE_TUNING.ROSTER_SLOTS_PER_SPACE_LEVEL,
    );
    expect(
      rosterCapacity(axes(EMPIRE_TUNING.SPACE_LEVEL_MAX, EMPIRE_TUNING.STAFF_LEVEL_MAX.spotter)),
    ).toBe(EMPIRE_TUNING.ROSTER_SLOTS_MAX);
    // And the cap holds against a state that overshot it.
    expect(rosterCapacity(axes(99, 99))).toBe(EMPIRE_TUNING.ROSTER_SLOTS_MAX);
  });
});

// ---------------------------------------------------------------------------
// Ledgers
// ---------------------------------------------------------------------------

describe('the ledger halves', () => {
  const at = asUnacceleratedSeconds(1);
  const ledger: readonly EmpireLedgerEntry[] = [
    { at, output: 'gym-bucks', amount: 10 },
    { at, output: 'training-iq', amount: 1 },
    { at, output: 'cosmetic-unlock', amount: 1 },
    { at, output: 'physio-days-saved', amount: 1 },
    { at, output: 'reputation', amount: 2 },
  ];

  it('splits a ledger into two halves that cover it exactly once', () => {
    const progression = progressionLedger(ledger);
    const idle = idleLedger(ledger);
    // Non-vacuity first: both halves have members, so neither loop below is
    // walking an empty list.
    expect(progression.length).toBe(2);
    expect(idle.length).toBe(3);
    expect(progression.length + idle.length).toBe(ledger.length);
    for (const entry of progression) expect(idle).not.toContain(entry);
    for (const entry of ledger) {
      const inProgression = progression.includes(entry);
      const inIdle = idle.includes(entry);
      expect(inProgression !== inIdle, `${entry.output} is in both halves or neither`).toBe(true);
    }
  });

  it('puts both hazards in the half piece E6 compares', () => {
    const outputs = progressionLedger(ledger).map((entry) => entry.output);
    expect(outputs).toContain('training-iq');
    expect(outputs).toContain('physio-days-saved');
  });

  it('returns empty halves for an empty ledger without claiming anything', () => {
    expect(progressionLedger([])).toEqual([]);
    expect(idleLedger([])).toEqual([]);
  });
});

describe('the pairing constructors', () => {
  it('builds a frozen pairing that the runtime guard agrees with', () => {
    const pairing = acceleratedOutput('gym-empire-timer-skip', 'gym-bucks');
    expect(pairing).toEqual({ accelerant: 'gym-empire-timer-skip', output: 'gym-bucks' });
    expect(Object.isFrozen(pairing)).toBe(true);
    expect(mayAccelerate(pairing.accelerant, pairing.output)).toBe(true);
  });

  it('stamps and sizes an applied accelerant, and refuses a negative size', () => {
    const applied = applyAccelerant(
      'coach-staff-level',
      'training-iq',
      asUnacceleratedSeconds(120),
      EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT,
    );
    expect(applied.at).toBe(120);
    expect(applied.seconds).toBe(EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT);
    expect(Object.isFrozen(applied)).toBe(true);
    expect(empireStateFaults({ ...createEmpireState(), accelerants: [applied] })).toEqual([]);
    expect(() =>
      applyAccelerant('space-level', 'gym-bucks', asUnacceleratedSeconds(0), -1),
    ).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// State and invariants
// ---------------------------------------------------------------------------

describe('the state constructor and its invariants', () => {
  it('opens a gym that satisfies every invariant', () => {
    const state = createEmpireState();
    expect(empireStateFaults(state)).toEqual([]);
    expect(() => assertEmpireState(state)).not.toThrow();
    expect(Object.isFrozen(state)).toBe(true);
    expect(state.axes.equipment).toBe(EMPIRE_TUNING.EQUIPMENT_TIERS[0]);
    expect(state.roster).toEqual([]);
    expect(state.gymBucks).toBe(0);
    expect(state.reputation).toBe(0);
    expect(state.clock.unaccelerated).toBe(0);
    expect(state.clock.accelerated).toBe(0);
  });

  const base = createEmpireState();
  const lifter = (id: string, tier: NpcTier = 'novice'): ReturnType<typeof createNpcLifter> =>
    createNpcLifter(id, tier, 'Placeholder', 0, 0);

  const broken: readonly (readonly [string, EmpireState, RegExp])[] = [
    [
      'a clock running backwards',
      {
        ...base,
        clock: {
          unaccelerated: asUnacceleratedSeconds(10),
          accelerated: asAcceleratedSeconds(5),
        },
      },
      /accelerated reading is behind/,
    ],
    [
      'an equipment tier off the ladder',
      { ...base, axes: { ...base.axes, equipment: 'gold-bar' as EquipmentTier } },
      /is not an equipment tier/,
    ],
    [
      'a space level off the ladder',
      { ...base, axes: { ...base.axes, spaceLevel: EMPIRE_TUNING.SPACE_LEVEL_MAX + 1 } },
      /space level .* is off the ladder/,
    ],
    [
      'a fractional space level',
      { ...base, axes: { ...base.axes, spaceLevel: 1.5 } },
      /space level .* is off the ladder/,
    ],
    [
      'a staff level off the ladder',
      {
        ...base,
        axes: { ...base.axes, staffLevel: { coach: 99, spotter: 0, physio: 0 } },
      },
      /coach level .* is off the ladder/,
    ],
    [
      'reputation above the scale',
      { ...base, reputation: (EMPIRE_TUNING.REPUTATION_MAX + 1) as never },
      /above REPUTATION_MAX/,
    ],
    ['negative reputation', { ...base, reputation: -1 as never }, /is not a reputation/],
    ['a negative balance', { ...base, gymBucks: -1 as never }, /is not a balance/],
    [
      'more lifters than slots',
      { ...base, roster: [lifter('a'), lifter('b'), lifter('c')] },
      /lifters in .* slots/,
    ],
    ['two lifters with one id', { ...base, roster: [lifter('a'), lifter('a')] }, /duplicate/],
    [
      'a lifter on a tier that is not a tier',
      { ...base, roster: [createNpcLifter('a', 'olympian' as NpcTier, 'Placeholder', 0, 0)] },
      /which is not a tier/,
    ],
    [
      'a ledger entry with no number in it',
      {
        ...base,
        ledger: [{ at: asUnacceleratedSeconds(0), output: 'gym-bucks', amount: Number.NaN }],
      },
      /non-finite amount/,
    ],
    [
      'a ledger entry paying something the empire may not pay',
      {
        ...base,
        ledger: [
          { at: asUnacceleratedSeconds(0), output: 'covered-day' as never, amount: 1 },
        ],
      },
      /is not an empire output/,
    ],
    [
      'an accelerant applied for a negative time',
      {
        ...base,
        accelerants: [
          {
            accelerant: 'gym-empire-timer-skip',
            output: 'gym-bucks',
            at: asUnacceleratedSeconds(0),
            seconds: -1,
          },
        ],
      },
      /applied for -1 seconds/,
    ],
    [
      'a purchased accelerant on a progression-reaching output, cast past the type',
      {
        ...base,
        accelerants: [
          {
            accelerant: 'gym-empire-timer-skip',
            output: 'training-iq',
            at: asUnacceleratedSeconds(0),
            seconds: 1,
          } as unknown as AppliedAccelerant,
        ],
      },
      /may not accelerate training-iq/,
    ],
  ];

  it('catches every invariant it claims to catch', () => {
    for (const [what, state, message] of broken) {
      const faults = empireStateFaults(state);
      expect(faults.length, `${what} produced no fault`).toBeGreaterThan(0);
      expect(faults.join('\n'), what).toMatch(message);
      expect(() => assertEmpireState(state), what).toThrow(RangeError);
    }
    // Counts, not bounds: the table really does cover this many distinct
    // failures, so shrinking it is visible rather than quiet.
    expect(broken.length).toBe(15);
  });

  it('refuses a purchased accelerant that arrived past the compiler', () => {
    // The runtime second line, stated on its own because it is the one that
    // catches a decoded Edge Function payload. TypeScript never sees JSON.
    const state: EmpireState = {
      ...base,
      accelerants: [
        {
          accelerant: 'rewarded-ad-timer-skip',
          output: 'physio-days-saved',
          at: asUnacceleratedSeconds(0),
          seconds: 1,
        } as unknown as AppliedAccelerant,
      ],
    };
    const faults = empireStateFaults(state);
    expect(faults.length).toBe(1);
    expect(faults[0]).toContain('arrives by store-purchase');
    expect(faults[0]).toContain('may not accelerate physio-days-saved');
    expect(faults[0]).toContain('progression-reaching');
    // And the legal sibling produces no fault at all, so the check above is
    // discriminating rather than firing on everything.
    const legal: EmpireState = {
      ...base,
      accelerants: [
        {
          accelerant: 'coach-staff-level',
          output: 'physio-days-saved',
          at: asUnacceleratedSeconds(0),
          seconds: 1,
        },
      ],
    };
    expect(empireStateFaults(legal)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Purity, and the magic-number audit run from inside this piece
// ---------------------------------------------------------------------------

describe('the directory is pure, numerically clean and free of dice', () => {
  const shipped = readdirSync(HERE)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort();

  it('has shipped modules to scan, so the scans below are not empty', () => {
    // Counts, not bounds. Every check in this block walks this list, and a
    // list that had gone empty would make all of them pass.
    expect(shipped).toEqual(['empireCore.ts', 'empireTuning.ts']);
  });

  it('reads no clock, rolls no dice and touches no host API', () => {
    // Randomness in particular is GDD §12.3's second refusal condition: §5.3's
    // recruitment is deterministic, so the language of chance is banned from
    // the whole directory rather than reviewed per function.
    //
    // `seed`, `weight` and `distribution` are here because `empireTuning.ts`
    // says in prose that "there is no seed, no weight and no distribution
    // anywhere in this file" and only `weightedPick` was banned — two thirds of
    // that sentence had nothing behind it.
    const banned: readonly RegExp[] = [
      /\bDate\b/,
      /\bperformance\s*\./,
      /Math\s*\.\s*random/,
      /\brandom\b/i,
      /\bshuffle\b/i,
      /\bweightedPick\b/i,
      /\bweight/i,
      /\bseed\b/i,
      /\bdistribution\b/i,
      /\bprobability\b/i,
      /\brarity\b/i,
      /\bgacha\b/i,
      /\bfetch\s*\(/,
      /\bprocess\b/,
      /\bwindow\b/,
      /\bdocument\b/,
      /\blocalStorage\b/,
      /from ['"]react/,
    ];
    let scanned = 0;
    for (const name of shipped) {
      const source = readFileSync(path.join(HERE, name), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      // The strip is checked rather than assumed, so a scan over an empty
      // string cannot pass silently.
      expect(code.length, `${name} stripped to nothing`).toBeGreaterThan(0);
      expect(code, `${name} lost its declarations to the comment strip`).toMatch(/export /);
      for (const pattern of banned) {
        expect(code, `${name} must not reach ${String(pattern)}`).not.toMatch(pattern);
      }
      scanned += 1;
    }
    // Counts, not bounds: how many files and how many patterns actually ran.
    expect(scanned).toBe(2);
    expect(banned.length).toBe(18);
    // And the patterns are not all dead letters: each one is driven against a
    // string that should trip it, derived from the pattern's own purpose, so a
    // regex that stopped matching anything is red rather than quietly green.
    const tripwires: readonly string[] = [
      'const now = Date.now();',
      'performance . now()',
      'Math.random()',
      'const r = random();',
      'shuffle(list)',
      'weightedPick(list)',
      'const w = weights[0];',
      'const seed = 7;',
      'const distribution = [];',
      'const probability = 0.5;',
      'const rarity = 3;',
      'gacha()',
      'fetch (url)',
      'process.env',
      'window.alert',
      'document.body',
      'localStorage.getItem',
      "import x from 'react';",
    ];
    expect(tripwires.length).toBe(banned.length);
    for (const [index, pattern] of banned.entries()) {
      expect(tripwires[index], `pattern ${String(pattern)} matches nothing`).toMatch(pattern);
    }
  });

  it('fences every branded quantity in its own declaration', () => {
    // The vitest half of the `@ts-expect-error` directives at the top of this
    // file, and the thing five of them did not have. A brand is erased at
    // runtime, so no value this module produces can tell whether a parameter
    // was declared `UnacceleratedSeconds` or `number` — which is exactly why
    // `expect(typeof wrong).toBe('number')` sat under three directives and
    // could not have gone red under any of them. What vitest CAN read is the
    // declaration, so the declaration is what is pinned here.
    //
    // Plainly: this is a companion, not the grader. `tsc --noEmit` grades the
    // directives. This reddens on the same edits that make them unused —
    // widening a branded parameter or return type to its primitive — so the two
    // go red together instead of one going quiet while the other stays green.
    const code = readFileSync(path.join(HERE, 'empireCore.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(code.length, 'empireCore.ts stripped to nothing').toBeGreaterThan(0);
    expect(code).toMatch(/export function /);

    // Part 1 — `Unbranded<N>`, enumerated from the source rather than counted
    // in a sentence. `empireCore.ts` said "all nine constructors" when there
    // were eight, and a sentence that counts cannot be reddened. Dropping the
    // guard from any one of them is red on the loop; adding a constructor
    // without it, or adding an `asSettledTenureDays` that would hand a caller a
    // one-call route into the wall-clock brand, is red on the name pin.
    const constructors = [...code.matchAll(/export function (as[A-Z]\w*)<[^{]*\{/g)];
    const names = constructors.map((match) => match[1] as string).sort();
    expect(names).toEqual([
      'asAcceleratedSeconds',
      'asGymBucks',
      'asIdleTenureDays',
      'asInjuryDaysSaved',
      'asNpcId',
      'asReputation',
      'asTrainingIq',
      'asUnacceleratedSeconds',
    ]);
    let guarded = 0;
    for (const match of constructors) {
      expect(match[0], `${String(match[1])} takes a bare primitive`).toMatch(/&\s*Unbranded</);
      guarded += 1;
    }
    expect(guarded).toBe(names.length);
    expect(guarded).toBe(8);

    // Part 2 — the derived quantities. One row per function whose argument list
    // or return type IS the fence, including both arms of the tenure pair,
    // which shipped returning one brand between them.
    const fences: readonly {
      readonly symbol: string;
      readonly parameters: readonly string[];
      readonly returns: string;
      readonly brands: readonly string[];
    }[] = [
      {
        symbol: 'idleTenureDays',
        parameters: ['lifter: NpcLifter', 'now: AcceleratedSeconds'],
        returns: 'IdleTenureDays',
        brands: ['AcceleratedSeconds', 'IdleTenureDays'],
      },
      {
        symbol: 'settledTenureDays',
        parameters: ['lifter: NpcLifter', 'now: UnacceleratedSeconds'],
        returns: 'SettledTenureDays',
        brands: ['UnacceleratedSeconds', 'SettledTenureDays'],
      },
      {
        symbol: 'settledLevel',
        parameters: [
          'completionTimes: readonly UnacceleratedSeconds[]',
          'now: UnacceleratedSeconds',
        ],
        returns: 'SettledLevel',
        brands: ['UnacceleratedSeconds', 'SettledLevel'],
      },
      {
        symbol: 'physioDaysSavedFor',
        parameters: ['level: SettledLevel'],
        returns: 'InjuryDaysSaved',
        brands: ['SettledLevel', 'InjuryDaysSaved'],
      },
    ];
    let fenced = 0;
    let parametersPinned = 0;
    for (const fence of fences) {
      const found = [
        ...code.matchAll(new RegExp(`export function ${fence.symbol}\\(([^)]*)\\):\\s*(\\w+)`, 'g')),
      ];
      // Counts, not presence: a pattern with a second witness in the file is
      // the textual pin that survives its own mutation.
      expect(found.length, `${fence.symbol} is declared ${found.length} times, not once`).toBe(1);
      const declaration = found[0] as RegExpMatchArray;
      for (const parameter of fence.parameters) {
        expect(
          declaration[1] ?? '',
          `${fence.symbol} no longer takes \`${parameter}\` — the brand fence widened`,
        ).toContain(parameter);
        parametersPinned += 1;
      }
      expect(
        declaration[2] ?? '',
        `${fence.symbol} no longer returns ${fence.returns}`,
      ).toBe(fence.returns);
      // A row may not name a type that is not a brand in this module, so a
      // fence written against a widened or invented alias is red rather than
      // trivially satisfied by whatever text happens to be there.
      for (const brand of fence.brands) {
        expect(code, `${brand} is not a branded type in this module`).toMatch(
          new RegExp(`export type ${brand} = Branded<`),
        );
      }
      fenced += 1;
    }
    expect(fenced).toBe(4);
    expect(parametersPinned).toBe(7);
    // The two tenure arms return DIFFERENT brands. One brand between them is
    // the state this shipped in, and it is the state this line refuses.
    expect(new Set(fences.map((fence) => fence.returns)).size).toBe(fences.length);
  });

  it('gives every type-only directive in this file a covering test, by census', () => {
    // The header of this file makes a behavioural claim about the file, and it
    // was false five times over: directives sat above
    // `expect(typeof x).toBe('number')` twice and above three assertions that
    // the constructors still mint the same number, none of which any state of
    // `empireCore.ts` could have reddened.
    //
    // What this check is, exactly. It is a CENSUS: it counts the directives,
    // attributes each to the test it sits in, and pins both. It cannot prove
    // the covering test bites — CLAUDE.md's own note is that a pointer to a
    // test that cannot fail is the same defect one level out, and the mutation
    // evidence for these lives in the report rather than here. What it does
    // stop is a directive arriving in a test nobody signed for, which is how
    // the five got in.
    //
    // The token is built rather than written: a pattern containing it matches
    // itself, which is the self-referential vacuity shape this file's own
    // header warns about.
    const token = ['@ts', 'expect', 'error'].join('-');
    const source = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    const directiveLine = new RegExp(`^\\s*//\\s*${token}`);
    const itLine = /^\s+it\((['"`])(.*?)\1,\s/;

    let current: string | null = null;
    let directives = 0;
    const carriers = new Map<string, number>();
    for (const line of source.split('\n')) {
      const title = itLine.exec(line);
      if (title !== null) current = title[2] as string;
      if (!directiveLine.test(line)) continue;
      directives += 1;
      expect(current, `a directive outside any it() block: ${line.trim()}`).not.toBeNull();
      const key = current as string;
      carriers.set(key, (carriers.get(key) ?? 0) + 1);
    }

    expect(directives).toBe(23);
    expect(carriers.size).toBe(9);
    expect([...carriers.values()].reduce((total, n) => total + n, 0)).toBe(directives);
    // The tests that carry them, pinned by title. A directive added to a test
    // not on this list is red, and a title edited without touching the list is
    // red too — which is the point, because the title is what a reader uses to
    // find the covering assertions.
    expect([...carriers.keys()].sort()).toEqual([
      'refuses a bare number where a settled level is required',
      'refuses a re-brand, which is how the argument list above was walked around',
      'refuses an accelerant whose type has widened to the union, in all three spellings',
      'refuses an accelerated clock where a wall clock is required, on every arm',
      'refuses one tenure brand where the other is required — hazard 1’s derived quantity',
      'refuses the Training IQ path, in both graders — GDD §8.3B into §5.2, hazard 1',
      'refuses the illegal pairing as an object literal — the fence inference cannot move',
      'refuses the physio path, in both graders — GDD §5.4 into §3.5, hazard 2',
      'refuses the same two on `applyAccelerant`, which is the branch below',
    ]);
  });

  it('ships no string a real name could be hiding in, and pins the ones it does ship', () => {
    // GDD §12.3 refuses a real, named athlete, brand or company in any string
    // or code path, and `empireTuning.ts` claims in prose that no lifter, gym,
    // sponsor, federation or equipment-brand name appears in it. That sentence
    // had no scan behind it, which is the condition CLAUDE.md says produces the
    // next defect.
    //
    // What this catches, and what it does not. No scan can tell a real name from
    // an invented one — that is the human, name-by-name pass §12.3 asks for on
    // every piece. What these two halves do is make a name ARRIVING visible:
    // the first pins every space-free literal in the shipped modules exactly,
    // so a new vocabulary token is a decision somebody signs rather than a diff
    // nobody reads; the second bans a `Capitalised Capitalised` pair anywhere,
    // which is the shape a person's name takes inside a message, where the
    // first half does not look. Neither half adjudicates. Both make the
    // adjudication happen.
    // THE SECOND HALF READ NO MESSAGE THIS MODULE WRITES. `literals` was built
    // from `/'...'/` alone, so it held vocabulary tokens and nothing else —
    // every runtime message in `empireCore.ts` is a TEMPLATE literal, and every
    // one of them was invisible. Appending `, already used by Placeholder
    // Lifter` to the duplicate-id fault — a person-shaped name, invented, of
    // exactly the shape a real one would take — left both halves green and left
    // the count pin at 64, so the sentence claiming this half "looks inside a
    // message, where the first half does not look" was describing a scan of an
    // empty domain. The three collectors below are the domain, and the counts
    // are pinned per collector so one going quiet is red on its own line.
    //
    // The name used to run that mutation is invented, and that is not a style
    // choice: a real lifter's name written into a comment here is GDD §12.3's
    // last refusal condition in a code path, which `src/licensing/realIp.ts`
    // scans the whole tree for. It caught one on the way in.
    const singleQuoted = new Set<string>();
    const doubleQuoted = new Set<string>();
    const templateChunks = new Set<string>();
    let filesRead = 0;
    for (const name of shipped) {
      const source = readFileSync(path.join(HERE, name), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const match of code.matchAll(/'([^'\\\n]*)'/g)) singleQuoted.add(match[1] as string);
      for (const match of code.matchAll(/"([^"\\\n]*)"/g)) doubleQuoted.add(match[1] as string);
      // The static text of a template, with each `${...}` replaced by a space
      // so two words either side of a substitution are not run together into a
      // false match.
      for (const match of code.matchAll(/`((?:[^`\\]|\\[\s\S])*)`/g)) {
        templateChunks.add((match[1] as string).replace(/\$\{[^}]*\}/g, ' '));
      }
      filesRead += 1;
    }
    expect(filesRead).toBe(2);
    // Counts before contents, so an empty domain reports itself rather than
    // making the pin below a comparison of two empty lists.
    expect(singleQuoted.size).toBe(66);
    expect(doubleQuoted.size).toBe(0);
    expect(templateChunks.size).toBe(28);
    // And the template collector really reaches the messages, named from the
    // real source in both directions: these counts drop to zero if the
    // collector stops reading templates AND if the module stops writing the
    // message. Match counts rather than presence, because a pattern with more
    // than one witness is the textual pin this codebase has been bitten by.
    const chunks = [...templateChunks];
    expect(chunks.filter((chunk) => chunk.includes('may not accelerate')).length).toBe(2);
    expect(chunks.filter((chunk) => chunk.includes('duplicate lifter id')).length).toBe(1);

    const spaceFree = [...singleQuoted].filter((literal) => !literal.includes(' ')).sort();
    expect(spaceFree).toEqual([
      './empireTuning',
      'accelerated-seconds',
      'acceleratedSeconds',
      'bare-bar',
      'budget',
      'chalk',
      'club',
      'coach',
      'coach-staff-level',
      'comp-plates',
      'competition-total',
      'cosmetic-unlock',
      'cosmetics',
      'covered-day',
      'e1rm',
      'elapsedSeconds',
      'global',
      'gym-bucks',
      'gym-economy',
      'gym-empire-timer-skip',
      'gym-progress',
      'gymBucks',
      'idle-only',
      'idle-tenure-days',
      'idleTenureDays',
      'injury-days-saved',
      'injuryDaysSaved',
      'knob',
      'legendary',
      'monolift',
      'national',
      'novice',
      'npc-id',
      'physio',
      'physio-days-saved',
      'progression-reaching',
      'refusal',
      'regional',
      'reputation',
      'reputation-tier',
      'rewarded-ad-timer-skip',
      'roster-slot',
      'settled-level',
      'settled-tenure-days',
      'settledTenureDays',
      'skippedSeconds',
      'space-level',
      'specialty-bars',
      'spotter',
      'store-purchase',
      'structural',
      'training-iq',
      'training-pace',
      'trainingIq',
      'unaccelerated-seconds',
      'unacceleratedSeconds',
    ]);

    // The half the pin does not reach: a multi-word name inside a message. Run
    // over all three collectors, not just the one it used to see.
    const personShaped = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;
    const everyString = [...singleQuoted, ...doubleQuoted, ...templateChunks];
    let stringsChecked = 0;
    for (const value of everyString) {
      expect(personShaped.test(value), `${value} is shaped like a person's name`).toBe(false);
      stringsChecked += 1;
    }
    expect(stringsChecked).toBe(singleQuoted.size + doubleQuoted.size + templateChunks.size);
    expect(stringsChecked).toBe(94);

    // The pattern is not a dead letter, and the probe is DERIVED from the
    // shipped vocabulary. The two lines here were
    // `personShaped.test('lifted by Placeholder Lifter')` and
    // `personShaped.test('bare-bar')` — both operands string literals written
    // four lines from the pattern, so nothing kept them in step with the file
    // they claimed to be about. That is verbatim the shape the sibling scan in
    // `empireTuning.test.ts` says it removed, kept here in the same directory.
    // Every shipped token, title-cased and doubled, is a person-shaped name.
    //
    // What this reddens on, said exactly rather than implied: a weakening of
    // `personShaped` itself — it is a tripwire against the CHECK going quiet,
    // which is the same job the sibling's `${key}_PER_SESSION` probe does, and
    // it is not a second bite on `empireCore.ts`. The subject-edit bites in
    // this test are the three count pins, the exact `spaceFree` pin, and the
    // loop over all 94 strings above. What the derivation buys is that the
    // probes cannot go stale: rename the vocabulary and the probes rename with
    // it, instead of two literals still passing about tokens that are gone.
    let probes = 0;
    for (const literal of spaceFree) {
      const word = literal.replace(/[^A-Za-z]/g, '');
      if (word.length < 2) continue;
      const titled = `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`;
      expect(personShaped.test(`${titled} ${titled}`), `${titled} is not person-shaped`).toBe(true);
      probes += 1;
    }
    expect(probes).toBe(56);
    // Nothing was silently skipped by the `< 2` guard above — a one-letter
    // token would leave a shipped literal unprobed and this is what says so.
    expect(probes).toBe(spaceFree.length);
  });

  it('imports nothing outside this directory', () => {
    // The tuning module is a leaf and the core imports it and nothing else.
    // An import edge into another session's territory is how a pure module
    // acquires a side effect it did not ask for.
    const imports = (name: string): readonly string[] => {
      const source = readFileSync(path.join(HERE, name), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      return [...code.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] as string);
    };
    expect(imports('empireTuning.ts')).toEqual([]);
    expect(imports('empireCore.ts')).toEqual(['./empireTuning']);
  });

  it('holds every number in the tuning module and none anywhere else', () => {
    // The repository's own audit, run from inside this piece rather than only
    // in the tree-wide pass, so a bare literal here is red before it is red
    // there. `empireCore.ts` is audited under its real path and therefore
    // under the default `renderer` rule: zero bare numbers.
    const core = readFileSync(path.join(HERE, 'empireCore.ts'), 'utf8');
    const coreFindings = auditSource('src/empire/empireCore.ts', core);
    expect(coreFindings.length, `\n${formatFindings(coreFindings)}\n`).toBe(0);

    // `empireTuning.ts` is registered in `SOURCE_RULES` now — the one registry
    // line this piece needed, which landed in the other session's file when
    // §5 merged. Audited under its real path it is clean, and that is the
    // tree-wide pass this block used to be waiting for.
    const tuning = readFileSync(path.join(HERE, 'empireTuning.ts'), 'utf8');
    const asShipped = auditSource('src/empire/empireTuning.ts', tuning);
    expect(asShipped.length, `\n${formatFindings(asShipped)}\n`).toBe(0);

    // THE COUNT IS MEASURED UNDER AN UNREGISTERED PATH ON PURPOSE, and this is
    // the line the registration would otherwise have quietly gutted.
    //
    // It was `auditSource('src/empire/empireTuning.ts', …)` pinned at 87 — the
    // findings the audit reported while this file had no row. That pin did its
    // job the moment the row landed: it went red, and its own message named
    // this as one of the two possibilities ("or the instrument stopped
    // reporting"). But the obvious repair — re-pinning it at 0 — swaps a real
    // guard for a vacuous one, because a registered file reports 0 findings
    // whatever it contains, so every future edit would leave it green.
    //
    // Under a path with no `SOURCE_RULES` row, the audit reports one finding
    // per bare literal, so the number is a census of the tuned values
    // THEMSELVES and moves only when a knob is added or removed. That is what
    // the 87 was always measuring; it was reading it through an instrument
    // that also happened to be reporting the missing row.
    const asCensus = auditSource('src/empire/unregistered-census.ts', tuning);
    expect(
      asCensus.length,
      'the number of tuned values in empireTuning.ts moved: an entry was added or removed. ' +
        'That is a decision about the idle economy, not a tuning pass, so it is acknowledged ' +
        `here rather than absorbed. First: ${formatFindings(asCensus.slice(0, 1)).trim()}`,
    ).toBe(87);

    // And the instrument is not blind: an unregistered path with one bare
    // literal reports exactly one. Without this, the census above would be
    // satisfied by an audit that had stopped working entirely.
    expect(auditSource('src/empire/probe.ts', 'export const RATE = 42;\n').length).toBe(1);
  });
});
