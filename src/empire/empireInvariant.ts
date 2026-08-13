/**
 * empireInvariant.ts — GDD §5 composed over a calendar, and the place the
 * second reading of "structurally unable" is made true.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock reading and no randomness. Every day and
 * every second is a parameter. Its imports are the six §5 modules and the tuning
 * block, so every magnitude it uses is named and in one place and the
 * directory-wide audit in `empireCore.test.ts` covers it.
 *
 * ===========================================================================
 * 1. What this file is for
 * ===========================================================================
 *
 * GDD §4.4 records that "structurally unable" has two readings and that the rule
 * means both:
 *
 *   1. the illegal pairing cannot be CONSTRUCTED — a type error. `empireCore.ts`
 *      is that reading, and it is complete: a purchasable accelerant paired with
 *      a progression-reaching output does not compile, does not narrow, and
 *      throws if it arrives past the compiler as JSON.
 *   2. the output cannot MOVE with the purchase — and no type gives you this.
 *      §4.4 records a builder who believed a check covered it, and mutation
 *      testing found a legal input that "moved 2362 of 34338 purchase-day lists,
 *      produced zero violations, and left every aggregate in the comparison
 *      identical — sweep green, verdict green, claim false".
 *
 * Reading 2 is this file. It is not a rate, a table or a verdict: it is the
 * composition, because every leak found in §5 so far has lived between the
 * modules rather than inside one.
 *
 * ===========================================================================
 * 2. The three chains, and where each one is closed
 * ===========================================================================
 *
 * Chain A — earned, not purchased. Check-ins pay reputation, reputation pays a
 * sponsor line, the sponsor line pays Gym Bucks, Gym Bucks buy the physio level,
 * and `physioDaysSaved` is a Sim quantity. Not a §8.1 breach, because it is not
 * purchasable. It is narrower than it was — the sponsor line is paid into the
 * accelerated book, and the physio ladder is not bought out of that book any
 * more — but the check-in still pays reputation, and reputation still gates a
 * recruit. What this file does not measure is the chain against a gym that
 * CHECKS IN more or a lifter who TRAINS more, at every horizon, because that is
 * a sweep with a different independent variable.
 *
 * That obligation is discharged, and by another file rather than by this one:
 * `engagement.ts` and `engagement.test.ts` hold the check-in schedule as the
 * variable and apply no accelerant. Their shipped reading is 0 violating pairs
 * of 24576 on every calendar of a window of check-in slots, and the zero has
 * chain A re-connected beside it — the `'accelerated-purse'` wiring, this
 * directory as it stood before GDD §5.4's two-books ruling, pinned at 263 pairs
 * where checking in more moved the physio arrival a day LATER. Read that file
 * before concluding anything from this one about engagement: a green run here
 * is evidence about a purchase and about nothing else.
 *
 * Chain B — purchasable, found and measured by piece E4, closed in
 * `empireCore.ts` and `reputation.ts` rather than here. A skip lengthened the
 * idle gap, reputation accrued against the longer gap because reputation is paid
 * into the gym economy, so a tier's milestone was met on an earlier WALL-CLOCK
 * day and the lifter behind it settled earlier at a larger tier multiplier. The
 * fix is that reach as a PAYOUT and reach as a GATE are two different questions:
 * `GATE_TARGET` and `gateElapsedFor` ask the second one.
 *
 * Chain C — purchasable, and the one no rate function can answer, and the one
 * this piece was handed by `empireCore.ts`'s §6 and `expansion.ts`'s §2. A skip
 * pays Gym Bucks sooner on the accelerated clock, so the gym can AFFORD a
 * recruit or a physio level on an earlier wall-clock day. `startExpansion`
 * stamps `settledCompletion` from whatever `clock.unaccelerated` it is handed
 * and `recruitmentSchedule` stamps `settlesAt` the same way; both are correct,
 * and both are stamped on a day the purchase chose.
 *
 * ===========================================================================
 * 3. How chain C is closed: the purse is chosen the way the clock is
 * ===========================================================================
 *
 * `WALL_CLOCK_FUNDED_OUTPUTS` in `empireCore.ts` is the closure and it is
 * derived from the tables that were already there: an output is on it when it
 * reaches Sim progression, or when `GATE_TARGET` says it gates something that
 * does. `axisBook` in `expansion.ts` reads it through `AXIS_OUTPUT`, so the
 * physio, space and spotter rungs are bought out of `settledBooks` — the gym's
 * wall-clock purses — and the equipment and coach rungs out of the accelerated
 * one. `recruitmentRefusals` is on the same side of the split, because a
 * recruit pays Training IQ.
 *
 * GDD §5.4's third-book ruling is the second half of the same derivation and it
 * closes a chain the first half left open. One wall-clock balance was contested
 * by four spenders — the space ladder, the spotter ladder, the physio ladder
 * and a recruit — and a contested balance has a spending ORDER that the
 * player's CHECK-IN SCHEDULE moves. Measured on this engine, a player who
 * checked in more often ended on a lower §5.2 Training IQ series in 2954 of
 * 24576 exhaustively enumerated pairs. So each funded output keeps a purse of
 * its own (`WallClockBooks`) and each purse gets its own slot in step 4 below,
 * and `'single-wall-clock-purse'` is the control that still measures the 2954.
 *
 * Every wall-clock purse accrues at `settledGymBucksRatePerHour`, which reads
 * no state at all: it is the baseline line over the un-accelerated part of a
 * gap. Each purse gets that line in full rather than a share of it, so the
 * split changes where money may go and not how fast it arrives — the cost a
 * player pays is that they cannot pour a saved-up balance into one ladder, not
 * that any ladder fills more slowly than it did.
 * So the day a wall-clock-funded rung becomes affordable is a function of wall
 * time, the cost tables and the gym's own earlier wall-clock-funded purchases —
 * and of nothing a purchase moves. The rungs' levels and their in-flight builds
 * are read on the same clock, which is the half that is easy to leave out: a
 * skip that finished level N early would otherwise let level N+1 start early.
 *
 * Say plainly what this costs, because it is a design decision a human may
 * overturn rather than a transcription. A player who buys skips gets what GDD
 * §8.3B sells — the build finishes now, the lifter is on the floor now, the
 * accelerated economy pays now — and does not get to buy the next rung of a
 * ladder that reaches Sim progression any sooner than the wall clock allows.
 * The surplus the accelerated book carries buys §8.3A's decor, the equipment
 * ladder and the coach ladder. `empireCore.ts`'s header names two alternatives —
 * a flat calendar-keyed trickle with no roster term at all, or narrowing §8.3B
 * so recruit and build timers are not for sale — and both cost more of §5 than
 * this does.
 *
 * ===========================================================================
 * 4. What is measured, on which gym, and what the zero is a zero against
 * ===========================================================================
 *
 * There is ONE gym here, and it is the gym the player has: every accelerant
 * lands on it, its Gym Bucks balance is the accelerated one, its roster fills as
 * fast as the skips it was bought. The two progression-reaching readings —
 * GDD §5.2's Training IQ trickle and §5.4's `physioDaysSaved` hook — are read
 * off that same gym through the shipped accessors, and it is those two series,
 * element by element and by wall-clock day, that `empireInvariant.test.ts`
 * asserts unmoved.
 *
 * A previous version of this file ran a SECOND gym beside it, stepped with no
 * accelerant, and read the progression ledger off that one. The invariant was
 * then true by construction — `g(x)` compared with `g(x)` — and it was: it
 * stayed green with chain B reverted in `empireCore.ts`, which is a leak in a
 * module it imports. That is recorded here rather than deleted, because the
 * shape is the one CLAUDE.md's vacuity section is about: the comparison was
 * carefully written, ran, passed, and no state of the modules under it could
 * have reddened it.
 *
 * `EmpireFunding` is the negative control GDD §4.4 asks for, and it is one
 * parameter rather than a second loop: `'accelerated'` hands the gym its
 * accelerated book and its idle axis view in place of the wall-clock ones, which
 * is the engine as it stood before §3 and is exactly the wiring mistake a later
 * piece would make. Its divergence counts are pinned non-zero. The positive
 * control is the idle half of the same ledger: if a purchase did not move the
 * Gym Bucks balance and the roster size, the sweep would be reporting a zero
 * about an accelerant that was never applied.
 *
 * ===========================================================================
 * 4a. What this sweep kills, and what it is blind to — measured, not argued
 * ===========================================================================
 *
 * CLAUDE.md asks whether harnesses are independent or merely numerous, so every
 * mutant below was actually run against `empireInvariant.test.ts` rather than
 * reasoned about. Killed here, each on the element-wise subject rather than on
 * a count:
 *
 *   - `gateElapsedFor` reverted to `elapsedFor(clock, output)` — chain B, and
 *     the mutation that survived the version of this file that read its ledger
 *     off a second gym: 1266 of 2616 Training IQ elements move;
 *   - `elapsedFor` returning `clock.accelerated` unconditionally: 2592 and 2592;
 *   - `recruitmentSchedule` stamping `settlesAt` from `clock.accelerated`: 2190;
 *   - recruitment gated and debited on the accelerated book: 1036 and 132;
 *   - a wall-clock-funded axis gated and debited on the accelerated book: 204
 *     Training IQ elements and 68 physio elements;
 *   - `settledAxisLevel` reading `idleCompletion`: 84 physio elements;
 *   - `accrueProduction` banking the wall-clock book over the idle gap: 1992
 *     and 260;
 *   - `'roster-slot'` dropped from `GATING_OUTPUTS`: 204 and 132.
 *
 * Two mutants live here and are killed one layer down, and that is a property
 * of the composition rather than a weakness in either file:
 *
 *   - `skipExpansion` moving `settledCompletion` as well as `idleCompletion`
 *     leaves this file's 43 checks green. The reason is measurable: across the
 *     whole grid a grant lands on a build that is still running six times, and
 *     every one of those builds is on the coach ladder, whose settled level no
 *     progression-reaching reading consults. Three checks in `expansion.test.ts`
 *     redden on it.
 *   - `recruitmentRefusals` counting slots off `state.axes` instead of
 *     `state.settledAxes` also leaves this file green, because in this sweep the
 *     wall-clock book binds a recruit before the slots do. One check in
 *     `recruitment.test.ts` reddens on it, and one in `expansion.test.ts`
 *     reddens on the matching read of `buildInFlight`.
 *
 * So a green run of this file alone is not evidence about the leaves, and the
 * two layers are independent for a structural reason rather than by luck.
 *
 * ===========================================================================
 * 5. The Training IQ ceiling is applied HERE, and that is not an accident
 * ===========================================================================
 *
 * `TRAINING_IQ_DAILY_CEILING` is a budget on what one calendar day of idle may
 * pay "however large the gym", and a gym total is the base trickle plus the
 * roster subtotal. `npc.ts` says so and returns `rosterTrainingIqPerDay`
 * UNCAPPED, naming the cap as an obligation handed to whoever adds the two —
 * and `npc.test.ts` pins that the subtotal really does exceed the ceiling for a
 * full legendary roster, so the seam is live rather than theoretical.
 *
 * `composeTrainingIqRate` is where the two are added, so it is where the ceiling
 * goes. It reports three things rather than one — the uncapped total, the capped
 * total and whether the cap bit — so a test can pin that the ceiling was
 * REACHED as well as that it was applied, and an empty domain reports itself.
 *
 * `production.ts` applies the same ceiling on its own path. That is not a
 * duplicate to be removed: the two are reached by different callers, and
 * `EmpireRun.census` counts a comparison between them on every day of every run
 * and pins the disagreements at zero. Dropping the `Math.min` on either side
 * moves that counter.
 *
 * ===========================================================================
 * 6. How an accelerant is modelled, since two mechanisms exist
 * ===========================================================================
 *
 * GDD §8.3B sells "Gym Empire build and recruit timer skips" and
 * `TIMER_SKIP_SECONDS_PER_GRANT` is what one grant removes. Two shipped
 * mechanisms can spend it and they are disjoint here:
 *
 *   - if a build is running on an axis the accelerant is licensed for, the grant
 *     is spent through `skipExpansion`, which moves `idleCompletion` and copies
 *     `settledCompletion` across untouched;
 *   - otherwise the grant advances `EmpireClock.accelerated` through
 *     `createEmpireClock`'s `skippedSeconds`, which is the only route the shipped
 *     modules give to a shortened RECRUIT timer and is the model piece E4 used.
 *
 * A grant is spent on one of the two and not on both, so a second is not skipped
 * twice; `EmpireRunCensus` counts each mechanism and the suite pins that the two
 * counts add up to the number of check-ins the plan granted on. A physio build
 * is never skipped, because `mayAccelerate` refuses every purchasable accelerant
 * against `'physio-days-saved'` and `applyAccelerant` will not build the pairing
 * — that is `empireCore.ts`'s first reading doing its job inside this loop
 * rather than a rule restated here.
 *
 * Only the first mechanism leaves a record on `EmpireState.accelerants`, and
 * the asymmetry is deliberate rather than an oversight: a build skip names the
 * OUTPUT it was aimed at, which is what `mayAccelerate` takes, while a clock
 * skip advances the whole idle clock and names nothing. Inventing an output for
 * the second would be a pairing the type system never checked, dressed as one
 * it had. `empireRunFaults` therefore re-asks the licence about the recorded
 * ones and pins the recorded count against `EmpireRunCensus.buildSkips`; the
 * clock arm is covered by `clockSkips` and by the adding-up check above.
 *
 * ===========================================================================
 * 7. What is deliberately not here
 * ===========================================================================
 *
 *   - No wallet write. Currency and progression are server-authoritative
 *     (CLAUDE.md) and `src/game/progression.ts` is another session's file. An
 *     `EmpireRun` is arithmetic an Edge Function would run.
 *   - No name table. Every recruited lifter is named from a kebab id and the
 *     directory's placeholder token; GDD §12.3 refuses a real, named athlete in
 *     any string or code path.
 *   - No sweep parameters. Horizons, cadences and plans live in
 *     `empireSweep.test.ts`, for the reason `src/game/streakSweep.ts` exists and
 *     with the file suffix `src/tuning/audit.ts` forces — see that file's header.
 */

import {
  IDLE_ONLY_OUTPUTS,
  WALL_CLOCK_FUNDED_OUTPUTS,
  asDisplayName,
  asFaultMessage,
  asGymBucks,
  asGymId,
  asNpcId,
  asUnacceleratedSeconds,
  elapsedFor,
  isProgressionReachingOutput,
  applyAccelerant,
  createEmpireClock,
  createEmpireState,
  mayAccelerate,
  rosterCapacity,
  type AppliedAccelerant,
  type EmpireClock,
  type EmpireOutput,
  type EmpireState,
  type FaultMessage,
  type GymBucks,
  type IdleOnlyOutput,
  type NpcId,
  type NpcLifter,
  type NpcTier,
  type PurchasableAccelerant,
  type UnacceleratedSeconds,
  type WallClockBooks,
  type WallClockFundedOutput,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import {
  ACCELERATED_BOOK,
  EMPIRE_BOOKS,
  POOLED_WALL_CLOCK_BOOK,
  axisBook,
  axisLevel,
  axisOutput,
  expansionContext,
  expansionVerdict,
  idleAxesAt,
  physioDaysSavedAt,
  settledAxesAt,
  settledAxisLevel,
  skipExpansion,
  startExpansion,
  type EmpireBook,
  type ExpansionAxis,
  type ExpansionBuild,
  type ExpansionContext,
} from './expansion';
import { npcGymBucksPerHour, npcTrainingIqPerDay, rosterTrainingIqPerDay } from './npc';
import {
  accrueProduction,
  scrubPrecision,
  trainingIqRatePerDay,
  type RosterRateSource,
} from './production';
import {
  RECRUIT_BOOK,
  beginRecruitment,
  completeRecruitment,
  mayRecruit,
  type RecruitmentSchedule,
} from './recruitment';
import { accrueReputation, accrueSponsorship } from './reputation';
import {
  asCalendarDay,
  compareWithRival,
  encouragementGymBucksOn,
  socialRewardSchedule,
  type CalendarDay,
  type Encouragement,
  type GymSnapshot,
  type LeaderboardMetric,
  type SocialCalendarContext,
} from './social';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * The placeholder every recruited lifter is named with. See §7 of the header.
 *
 * Minted here rather than at the two use sites so the composed run has exactly
 * one place a display name enters it, which is what makes the call-site census
 * in `empireForbiddenOutput.test.ts` a short list instead of a long one.
 */
const RECRUIT_DISPLAY_NAME = asDisplayName('Placeholder');

/** The gym id the composed run reports itself under, for the §5.5 comparison. */
const OWN_GYM_ID = asGymId('composed-gym');

/** A plan may carry no accelerant at all. This is that plan's accelerant. */
export const NO_ACCELERANT: null = null;

/**
 * The FUNDING RULE a composed run is wired with — which books it buys its
 * progression-reaching rungs out of.
 *
 * One of two things "funding" used to mean in this directory, and the other has
 * been renamed: `expansion.ts`'s `axisClockFamily` (was `axisFunding`) answers
 * "which clock is this rung read on", a per-axis fact about the shipped engine.
 * This answers "which of three wirings is this whole run under", a sweep
 * parameter with two of its three values shipped by nothing. They met in the
 * same spending loop under one word.
 *
 * `'wall-clock-earned'` is the shipped rule: the closure §3 of the header
 * describes, with GDD §5.4's third-book ruling on top of it, so each
 * wall-clock-funded output keeps a purse nothing else may spend.
 *
 * The other two are NEGATIVE CONTROLS and nothing the game ships reads either.
 * Both are the engine as it stood at an earlier ruling rather than a synthetic
 * variant, and both are one parameter through the same loop rather than a
 * second loop, because a control assembled separately drifts from the thing it
 * is a control for:
 *
 *   - `'accelerated'` offers the gym its accelerated book and its idle axis
 *     view where the wall-clock ones belong — the engine before the two-books
 *     ruling, and the wiring mistake a later piece would make.
 *   - `'single-wall-clock-purse'` keeps the clock split and the wall-clock
 *     money, and puts every wall-clock spender back on ONE balance — the engine
 *     between the two rulings. Every debit is taken from every purse, which
 *     leaves the purses in lockstep and is therefore arithmetically the single
 *     book it replaces. This is the control the engagement zeros are zeros
 *     against: it is where 2954 of 24576 exhaustively enumerated pairs punished
 *     the more-engaged player.
 */
export const EMPIRE_FUNDINGS = [
  'wall-clock-earned',
  'accelerated',
  'single-wall-clock-purse',
] as const;

export type EmpireFunding = (typeof EMPIRE_FUNDINGS)[number];

/** The rule the shipped engine runs on. */
export const SHIPPED_FUNDING: EmpireFunding = 'wall-clock-earned';

/**
 * True for a funding rule under which every wall-clock purse is one balance, so
 * a purchase from any of them is a purchase from all of them.
 *
 * The two controls answer yes for different reasons — one pools onto the
 * accelerated book, one pools onto the wall-clock line — and every place that
 * has to know "can this money leave by another door" asks this rather than
 * naming a funding, so a third control added later is one row here.
 */
export function poolsWallClockBooks(funding: EmpireFunding): boolean {
  return funding !== SHIPPED_FUNDING;
}

/** How the simulated player spends, per check-in. No magnitude lives here. */
export interface EmpirePolicy {
  /** Check-ins per calendar day. The last one lands on the day boundary. */
  readonly checkInsPerDay: number;
  /** The order axes are offered a level-up in. Rotated one step per check-in. */
  readonly axisOrder: readonly ExpansionAxis[];
  /** Which §5.5 metric the rival comparison ranks on. */
  readonly leaderboardMetric: LeaderboardMetric;
}

// ---------------------------------------------------------------------------
// The simulated player's spending policy
// ---------------------------------------------------------------------------

/**
 * When the simulated player spends what the gym has earned, and in what order.
 *
 * GDD §5 fixes prices, ceilings, timers, gates and outputs. It says nothing
 * about the moment a player chooses to spend or the order they work down their
 * ladders — so a spending order is a MODEL OF A PLAYER rather than a rule of the
 * design, and a count measured under one of them is a fact about that model
 * until the others have been run beside it. Piece E7 measured a
 * punish-engagement count under the first row of this list alone and said so in
 * its own report; this list is what lets the same comparator be re-taken under
 * the rest, driven through `stepGym` itself rather than through a second loop
 * that could drift from it.
 *
 *   - `'rotate-greedy-per-check-in'` — the shipped model. Every check-in is a
 *     spending moment, and each PURSE is offered `EmpirePolicy.axisOrder`
 *     rotated by `EmpireGym.nextAxis`, which advances one step per spending
 *     moment. Greedy: the first rung that the verdict allows takes the money.
 *     (One offer per purse, not one per clock family — that is GDD §5.4's
 *     third-book ruling, and this sentence described the engine before it.)
 *   - `'fixed-order-no-rotation'` — the same greedy spend at the same moments,
 *     against a priority that does not move with the check-in count. This is
 *     the rotation PHASE removed and nothing else.
 *   - `'cheapest-affordable-first'` — in each family, the allowed rung with the
 *     lowest price goes first.
 *   - `'costliest-affordable-first'` — the other end of the same ordering, so
 *     the ordering term is bracketed from both sides rather than sampled once.
 *   - `'save-for-physio-first'` — while the only thing standing between the gym
 *     and its next physio rung is money, nothing else on the wall-clock book is
 *     bought and no recruit is paid for.
 *   - `'spend-once-per-calendar-day'` — money accrues across the day and is
 *     spent at the last check-in the player takes in that calendar day. This is
 *     the spending GRANULARITY removed and nothing else.
 */
export const EMPIRE_SPENDING_POLICIES = [
  'rotate-greedy-per-check-in',
  'fixed-order-no-rotation',
  'cheapest-affordable-first',
  'costliest-affordable-first',
  'save-for-physio-first',
  'spend-once-per-calendar-day',
] as const;

export type EmpireSpendingPolicy = (typeof EMPIRE_SPENDING_POLICIES)[number];

/** The policy the shipped engine runs on. */
export const SHIPPED_SPENDING_POLICY: EmpireSpendingPolicy = 'rotate-greedy-per-check-in';

/** The axis whose ladder `'save-for-physio-first'` holds its money for. */
const PHYSIO_AXIS: ExpansionAxis = 'physio';

/**
 * One check-in as a spending policy sees it.
 *
 * `lastCheckInOfDay` is the caller's fact, not a derived one: under a partial
 * attendance schedule the last check-in a player takes in a day is not the last
 * slot of the grid, and a policy that spends "at the day boundary" means the
 * former. Deriving it from `wallSeconds` here would have been the latter.
 */
export interface SpendingMoment {
  readonly policy: EmpireSpendingPolicy;
  readonly lastCheckInOfDay: boolean;
}

/** A spending moment. Frozen, so a policy cannot be edited under a running gym. */
export function spendingMoment(
  policy: EmpireSpendingPolicy,
  lastCheckInOfDay: boolean,
): SpendingMoment {
  return Object.freeze({ policy, lastCheckInOfDay });
}

/**
 * The moment `stepGym` assumes when a caller names none.
 *
 * `lastCheckInOfDay` is `true` because the shipped policy does not read it —
 * which is asserted rather than asserted-in-prose: `empireInvariant.test.ts`
 * drives one check-in both ways and compares the whole gym.
 */
export const SHIPPED_SPENDING_MOMENT: SpendingMoment = spendingMoment(
  SHIPPED_SPENDING_POLICY,
  true,
);

/** Whether this check-in spends anything at all. */
export function spendsAtMoment(moment: SpendingMoment): boolean {
  if (moment.policy === 'spend-once-per-calendar-day') return moment.lastCheckInOfDay;
  return true;
}

/**
 * Whether `EmpireGym.nextAxis` advances at this moment — and, on the same
 * answer, whether the offer this moment makes is rotated by it.
 *
 * One predicate for the two because they are one decision: a policy whose offer
 * ignores the rotation and whose rotation still advanced would carry a counter
 * that decides nothing, and the phase term this is here to switch off would be
 * off in the offer and on in the state.
 */
export function rotatesAtMoment(moment: SpendingMoment): boolean {
  return (
    moment.policy === 'rotate-greedy-per-check-in' ||
    moment.policy === 'spend-once-per-calendar-day'
  );
}

/**
 * True while the only thing between this gym and its next physio rung is money.
 *
 * Keyed on the shipped verdict's own refusal vocabulary rather than on a second
 * reading of the ladder: a gym that is at the physio ceiling, already building
 * one, or held back by a gate it cannot spend past is not saving, it is done —
 * so the policy stops holding its money and spends normally.
 */
export function savingForPhysio(
  order: readonly ExpansionAxis[],
  context: ExpansionContext,
): boolean {
  if (!order.includes(PHYSIO_AXIS)) return false;
  const verdict = expansionVerdict(context, PHYSIO_AXIS);
  if (verdict.allowed) return true;
  return verdict.refusal === 'not-enough-wall-clock-earnings';
}

/**
 * Whether money in `book` could otherwise leave by a door the physio rung
 * cannot use — i.e. whether a policy saving for physio has to hold this purse.
 *
 * Under the shipped funding the answer is "only the physio purse", and that is
 * not a weakening of the policy: GDD §5.4's third-book ruling means there is no
 * other door. Under either control the wall-clock purses are one balance, so
 * the hold is the whole wall-clock side — which is what the policy did before
 * the ruling and is what makes the control reproduce its own numbers.
 */
function physioHolds(book: EmpireBook, funding: EmpireFunding): boolean {
  if (poolsWallClockBooks(funding)) return book !== ACCELERATED_BOOK;
  return book === axisBook(PHYSIO_AXIS);
}

/**
 * The purse an axis is OFFERED out of under a funding rule.
 *
 * Under the shipped rule it is the purse that pays, full stop. Under a control
 * every wall-clock ladder is offered out of one slot again, because a control
 * has to reproduce the engine it is a control for — a pooled balance with four
 * separate offers would buy four rungs a check-in where the engine it stands in
 * for bought one, and its counts would then be about neither engine.
 */
function offeredBookOf(axis: ExpansionAxis, funding: EmpireFunding): EmpireBook {
  const book = axisBook(axis);
  if (book === ACCELERATED_BOOK) return book;
  return poolsWallClockBooks(funding) ? POOLED_WALL_CLOCK_BOOK : book;
}

/** The price of the rung this axis would start right now, or `null` if none would. */
function offeredCost(context: ExpansionContext, axis: ExpansionAxis): number | null {
  const verdict = expansionVerdict(context, axis);
  return verdict.allowed ? verdict.quote.cost : null;
}

/**
 * The axes bought out of one PURSE, in the order this moment's policy wants
 * them tried. The caller stops at the first one that starts.
 *
 * The unit is the purse rather than the clock family, and that is GDD §5.4's
 * third-book ruling reaching the spending loop. While every wall-clock ladder
 * shared one balance they also shared one slot per check-in, so which of them
 * took it was a second thing the check-in schedule decided — the money was
 * separated and the OFFER was not, which is the same defect one layer out.
 *
 * Every ordering here is a permutation of the purse's slice of
 * `EmpirePolicy.axisOrder`, and nothing here decides whether a rung is
 * affordable — `startExpansion` still takes every verdict. A price is read only
 * to sort by, through `expansionVerdict`, so the ordering cannot hold a second
 * opinion about what a rung costs or whether it is allowed.
 */
export function axisSpendingOrder(
  moment: SpendingMoment,
  order: readonly ExpansionAxis[],
  nextAxis: number,
  book: EmpireBook,
  context: ExpansionContext,
  funding: EmpireFunding = SHIPPED_FUNDING,
): readonly ExpansionAxis[] {
  const length = order.length;
  if (length === 0) return Object.freeze([]);
  const offset = rotatesAtMoment(moment) ? nextAxis : 0;
  const inPurse: ExpansionAxis[] = [];
  for (let step = 0; step < length; step += 1) {
    const axis = order[(offset + step) % length];
    if (axis === undefined) continue;
    if (offeredBookOf(axis, funding) !== book) continue;
    inPurse.push(axis);
  }

  if (
    moment.policy === 'save-for-physio-first' &&
    physioHolds(book, funding) &&
    savingForPhysio(order, context)
  ) {
    // Nothing is bought out of a purse the physio rung's money could otherwise
    // leave by. Under the shipped funding that is the physio purse alone and
    // this offers the physio rung; under a control the whole wall-clock side is
    // one balance, so a purse that holds no physio ladder offers nothing at all.
    return Object.freeze(inPurse.includes(PHYSIO_AXIS) ? [PHYSIO_AXIS] : []);
  }

  const cheapestFirst = moment.policy === 'cheapest-affordable-first';
  if (cheapestFirst || moment.policy === 'costliest-affordable-first') {
    const priced = inPurse.map((axis, index) =>
      Object.freeze({ axis, index, cost: offeredCost(context, axis) }),
    );
    const sorted = [...priced].sort((left, right) => {
      if (left.cost === null || right.cost === null) {
        // An axis with no startable rung sorts last, and two of them keep the
        // order they came in. They are offered anyway, so the verdict — not
        // this comparator — is what refuses them.
        if (left.cost === right.cost) return left.index - right.index;
        return left.cost === null ? 1 : 0 - 1;
      }
      if (left.cost !== right.cost) {
        return cheapestFirst ? left.cost - right.cost : right.cost - left.cost;
      }
      return left.index - right.index;
    });
    return Object.freeze(sorted.map((row) => row.axis));
  }

  return Object.freeze(inPurse);
}

/**
 * Whether a recruit may be paid for at this moment.
 *
 * Asked through `physioHolds` rather than by naming a book: before GDD §5.4's
 * third-book ruling a recruit was bought out of the same balance a physio rung
 * was, so a policy holding that balance had to hold it here too or "saving"
 * would have meant saving from one spender while the money left by the other.
 * Under the shipped funding `RECRUIT_BOOK` is a purse of its own, so a recruit
 * cannot spend a physio rung's money and this stops refusing — which is the
 * ruling doing its work rather than the policy being weakened.
 */
export function maySpendOnRoster(
  moment: SpendingMoment,
  order: readonly ExpansionAxis[],
  context: ExpansionContext,
  funding: EmpireFunding = SHIPPED_FUNDING,
): boolean {
  if (!spendsAtMoment(moment)) return false;
  if (moment.policy !== 'save-for-physio-first') return true;
  if (!physioHolds(recruitOfferedBook(funding), funding)) return true;
  return !savingForPhysio(order, context);
}

/** The purse a recruit is offered out of, pooled the way an axis's is. */
function recruitOfferedBook(funding: EmpireFunding): EmpireBook {
  return poolsWallClockBooks(funding) ? POOLED_WALL_CLOCK_BOOK : RECRUIT_BOOK;
}

/**
 * One purchasable accelerant applied on a schedule, or no accelerant at all.
 *
 * `accelerant: null` is the baseline every comparison is taken against. The
 * schedule is written as three whole numbers rather than a list of days so the
 * generator that produces plans is deterministic and small.
 */
export interface AccelerantPlan {
  readonly accelerant: PurchasableAccelerant | null;
  readonly grantsPerCheckIn: number;
  /** The first check-in a grant is applied on, counted from one. */
  readonly firstCheckIn: number;
  /** A grant lands on every Nth check-in from `firstCheckIn`. */
  readonly everyNthCheckIn: number;
}

/** The §5.5 surroundings a run is given. Nothing here is generated. */
export interface SocialInputs {
  readonly calendar: SocialCalendarContext;
  readonly rival: GymSnapshot | null;
  readonly encouragementsReceived: readonly Encouragement[];
}

/**
 * A recruitment that has been paid for and has not landed yet.
 *
 * `id` IS THE ID THE LIFTER WILL CARRY, so it is the `NpcId` brand and not a
 * bare `string`. `DECLARED_BARE_STRING_FIELDS` used to record the mismatch with
 * `NpcLifter.id` as "an inconsistency in the shipped types… recorded here rather
 * than fixed", and gave as the reason that narrowing "buys nothing this census
 * does not already give, because a new position reddens whatever its type is".
 *
 * The first clause of that reason is true and the second is false, which is why
 * this is now branded. The census reddens on a new POSITION; every bypass this
 * directory has been shown used an EXISTING one. Under the brand, the
 * assignment into this field is refused by the compiler rather than by a domain
 * that happened to contain the branch point.
 */
export interface PendingRecruit {
  readonly schedule: RecruitmentSchedule;
  readonly id: NpcId;
}

/** The gym the player has: its state, its builds, and what it is waiting on. */
export interface EmpireGym {
  readonly state: EmpireState;
  readonly builds: readonly ExpansionBuild[];
  readonly pending: readonly PendingRecruit[];
  /** The clock as it read when this gym last collected. */
  readonly collectedAt: EmpireClock;
  /** Seconds of accelerant folded into this gym's idle clock so far. */
  readonly skippedSeconds: number;
  /** Where the axis rotation is. */
  readonly nextAxis: number;
  readonly recruits: number;
  readonly expansions: number;
  /** Grants spent through `skipExpansion` rather than through the clock. */
  readonly buildSkips: number;
  /** Grants spent by advancing the idle clock. */
  readonly clockSkips: number;
}

/**
 * One day's worth of one output, stamped on the wall clock.
 *
 * `day` and `at` are the same fact twice — `at` is `day + 1` whole days of
 * wall-clock seconds — and both are carried because the invariant is asserted on
 * the LIST, element by element, and a comparison that read amounts alone would
 * have been green against chain B. Chain B moved days.
 */
export interface EmpireDayEntry {
  readonly day: number;
  readonly at: UnacceleratedSeconds;
  readonly output: EmpireOutput;
  readonly amount: number;
}

/** What a run actually did, so a zero cannot be a zero about an empty domain. */
export interface EmpireRunCensus {
  readonly days: number;
  readonly checkIns: number;
  /** Check-ins on which the plan granted anything at all. */
  readonly grantedCheckIns: number;
  /** Seconds of accelerant the plan handed the gym in total. */
  readonly grantedSeconds: number;
  readonly recruits: number;
  readonly expansions: number;
  /** Grants spent through `skipExpansion`. Adds up with the next one. */
  readonly buildSkips: number;
  /** Grants spent by advancing the idle clock. */
  readonly clockSkips: number;
  /** Days on which `TRAINING_IQ_DAILY_CEILING` bit. */
  readonly ceilingBoundDays: number;
  /**
   * Total taken out of each wall-clock purse over the run.
   *
   * Here so that "`'reputation'` has no spender" is a measured fact rather than
   * a sentence. Reputation is earned per check-in, not bought, so no axis feeds
   * it and no recruit is priced in it — but the purse is DERIVED from
   * `WALL_CLOCK_FUNDED_OUTPUTS` rather than special-cased, and a derivation
   * nobody checks is a claim. A later §5.4 axis that fed `'reputation'` would
   * need exactly this purse; until one exists the purse must stay untouched, and
   * the row beside it must not, or the counter is measuring nothing.
   */
  readonly bookDebits: Readonly<Record<WallClockFundedOutput, number>>;
  /** Days the composed rate was compared with `production.ts`'s own. */
  readonly rateComparisons: number;
  readonly rateDisagreements: number;
  /** The physio level the wall clock has reached — what the Sim hook reads. */
  readonly settledPhysioLevel: number;
  /**
   * The physio level the player's own gym shows, on the accelerated clock.
   *
   * The positive control for chain C: a purchased skip on a running physio
   * build is refused, but a skip that advances the idle clock still lands the
   * finished build on the player's gym sooner, so this reading MUST move under
   * a plan that grants enough. If it did not, the zero beside it would be a zero
   * about an axis the accelerant never reached.
   */
  readonly idlePhysioLevel: number;
  readonly socialRewardDays: number;
}

/** Everything one composed calendar produced. */
export interface EmpireRun {
  readonly plan: AccelerantPlan;
  readonly funding: EmpireFunding;
  readonly days: number;
  /** Every entry, both halves, in day order then in output order. */
  readonly ledger: readonly EmpireDayEntry[];
  readonly gym: EmpireGym;
  readonly census: EmpireRunCensus;
}

// ---------------------------------------------------------------------------
// The Training IQ ceiling, applied where the two terms are added
// ---------------------------------------------------------------------------

/** The composed trickle, before and after `TRAINING_IQ_DAILY_CEILING`. */
export interface ComposedTrainingIq {
  /** The base trickle plus the roster subtotal, as `npc.ts` returns it. */
  readonly uncappedPerDay: number;
  /** The same, under the budget. This is what a day pays. */
  readonly perDay: number;
  /** Whether the budget bit. Pinned non-zero somewhere, or it is dead. */
  readonly ceilingBound: boolean;
  /** Roster lifters whose recruitment had settled on the wall clock. */
  readonly contributingLifters: number;
}

/**
 * GDD §5.2's Training IQ trickle for a whole gym, at a clock reading.
 *
 * The composition point §5 of the header is about. Three things happen here and
 * nowhere else in this piece: the base trickle and the roster subtotal are
 * added, the roster is filtered to lifters whose recruitment has SETTLED on the
 * wall clock, and `TRAINING_IQ_DAILY_CEILING` is applied to the sum.
 *
 * The filter is not decoration. `settledTenureDays` floors at zero rather than
 * reporting absence, so a lifter a purchase put on the roster early would read
 * as tenure zero — and a rate at tenure zero is still a positive rate.
 * `trainingIqRatePerDay` applies the same filter on its own path, and the two
 * are compared on every day of every run.
 */
export function composeTrainingIqRate(state: EmpireState, at: EmpireClock): ComposedTrainingIq {
  const now: UnacceleratedSeconds = elapsedFor(at, 'training-iq');
  const settled = state.roster.filter((lifter) => lifter.settledAt <= now);
  const uncappedPerDay = scrubPrecision(
    EMPIRE_TUNING.TRAINING_IQ_BASE_PER_DAY + rosterTrainingIqPerDay(settled, at),
  );
  const perDay = scrubPrecision(Math.min(EMPIRE_TUNING.TRAINING_IQ_DAILY_CEILING, uncappedPerDay));
  return Object.freeze({
    uncappedPerDay,
    perDay,
    ceilingBound: perDay < uncappedPerDay,
    contributingLifters: settled.length,
  });
}

// ---------------------------------------------------------------------------
// The seam with production.ts
// ---------------------------------------------------------------------------

/**
 * The per-lifter rates `production.ts` aggregates, read at one clock.
 *
 * The tenure argument is deliberately unused: `npc.ts` owns the derivation of
 * both tenures from a clock, and handing it the clock rather than a number keeps
 * one statement of that arithmetic instead of two. The clock passed here is the
 * same clock `productionRates` reads its own tenures at, and the agreement pin
 * in `EmpireRunCensus.rateDisagreements` is what says so on every day of every
 * run rather than this sentence.
 */
export function rosterRatesAt(clock: EmpireClock): RosterRateSource {
  return Object.freeze({
    gymBucksPerHour: (lifter: NpcLifter) => npcGymBucksPerHour(lifter, clock),
    trainingIqPerDay: (lifter: NpcLifter) => npcTrainingIqPerDay(lifter, clock),
  });
}

// ---------------------------------------------------------------------------
// Accelerants
// ---------------------------------------------------------------------------

/**
 * `applyAccelerant` for an accelerant that is only known as a union.
 *
 * `empireCore.ts` refuses a union accelerant on purpose — an indexed access over
 * a union key distributes, so a union `A` widened the licence to every output
 * there is. The cost it names is exactly this: a caller iterating accelerants
 * has to write the literals. The switch is exhaustive by the `never` binding, so
 * a purchasable accelerant added later is a compile error here rather than a
 * silent fall-through.
 */
export function applyPurchasableGrant(
  accelerant: PurchasableAccelerant,
  output: IdleOnlyOutput,
  at: UnacceleratedSeconds,
  seconds: number,
): AppliedAccelerant {
  switch (accelerant) {
    case 'gym-empire-timer-skip':
      return applyAccelerant('gym-empire-timer-skip', output, at, seconds);
    case 'rewarded-ad-timer-skip':
      return applyAccelerant('rewarded-ad-timer-skip', output, at, seconds);
    default: {
      const unreached: never = accelerant;
      throw new RangeError(`${String(unreached)} is not a purchasable accelerant`);
    }
  }
}

/** Seconds the plan grants at a check-in, counted from one. */
export function grantSecondsAt(plan: AccelerantPlan, checkIn: number): number {
  if (plan.accelerant === NO_ACCELERANT) return 0;
  if (!Number.isInteger(checkIn) || checkIn < 1) {
    throw new RangeError(`a check-in is counted from one, received ${checkIn}.`);
  }
  if (!Number.isInteger(plan.everyNthCheckIn) || plan.everyNthCheckIn < 1) {
    throw new RangeError(
      `a grant cadence must be a whole number of check-ins at or above one, received ${plan.everyNthCheckIn}.`,
    );
  }
  if (checkIn < plan.firstCheckIn) return 0;
  if ((checkIn - plan.firstCheckIn) % plan.everyNthCheckIn !== 0) return 0;
  return plan.grantsPerCheckIn * EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT;
}

// ---------------------------------------------------------------------------
// The gym
// ---------------------------------------------------------------------------

/** A gym on the day it opens. */
export function createEmpireGym(): EmpireGym {
  return Object.freeze({
    state: createEmpireState(),
    builds: Object.freeze([]),
    pending: Object.freeze([]),
    collectedAt: createEmpireClock(0, 0),
    skippedSeconds: 0,
    nextAxis: 0,
    recruits: 0,
    expansions: 0,
    buildSkips: 0,
    clockSkips: 0,
  });
}

/** The gym as §5.5 compares it: its own reputation and nothing private. */
export function gymSnapshot(gym: EmpireGym): GymSnapshot {
  return Object.freeze({
    gymId: OWN_GYM_ID,
    displayName: RECRUIT_DISPLAY_NAME,
    reputation: gym.state.reputation,
    combinedTotalKg: 0,
  });
}

/** The highest tier this gym may recruit right now, or `null`. */
function bestRecruitableTier(state: EmpireState): NpcTier | null {
  const tiers = EMPIRE_TUNING.NPC_TIERS;
  for (let at = tiers.length - 1; at >= 0; at -= 1) {
    const tier = tiers[at];
    if (tier === undefined) continue;
    if (mayRecruit(state, tier)) return tier;
  }
  return null;
}

/**
 * The state a spending decision is offered, under a funding rule.
 *
 * Under the shipped rule it is the gym's own state. Under the control the
 * wall-clock book and the wall-clock axis view are replaced by the accelerated
 * ones, so every consumer that reads `settledBooks` or `settledAxes` — the
 * expansion verdict and the recruitment verdict alike — takes its decision
 * against money and slots a purchase moved. One substitution covers both
 * consumers, which is the point: a control written per consumer is two
 * judgements about one shape.
 */
function offeredTo(state: EmpireState, funding: EmpireFunding): EmpireState {
  if (funding === SHIPPED_FUNDING) return state;
  if (funding === 'single-wall-clock-purse') {
    // Nothing to substitute. Every wall-clock purse already holds the same
    // balance under this control, because `withBooks` takes every debit off
    // every one of them — so the state the decision is offered is the gym's.
    return state;
  }
  return Object.freeze({
    ...state,
    settledBooks: booksAt(state.settledBooks, state.gymBucks),
    settledAxes: state.axes,
  });
}

/** The same book record with every purse holding one balance. */
function booksAt(books: WallClockBooks, balance: number): WallClockBooks {
  const next: Partial<Record<WallClockFundedOutput, GymBucks>> = {};
  for (const book of WALL_CLOCK_FUNDED_OUTPUTS) next[book] = asGymBucks(balance);
  return Object.freeze({ ...books, ...next });
}

/** The most any one purse was reduced by between two book records. */
function debitedFrom(before: WallClockBooks, after: WallClockBooks): number {
  let taken = 0;
  for (const book of WALL_CLOCK_FUNDED_OUTPUTS) {
    taken = Math.max(taken, before[book] - after[book]);
  }
  return taken;
}

/**
 * Put a decision's books back on the gym's own state.
 *
 * Under the shipped rule the record is the gym's own purses and comes back as
 * it is. Under `'accelerated'` the gym was offered its accelerated balance in
 * every purse, so whichever one came back reduced is the accelerated balance
 * the price was taken from; the untouched wall-clock purses carry on accruing
 * beside it. Under `'single-wall-clock-purse'` exactly one purse was debited
 * and the other three have to follow it down, which is what makes four purses
 * arithmetically one.
 */
function withBooks(
  gymState: EmpireState,
  decided: EmpireState,
  funding: EmpireFunding,
): EmpireState {
  if (funding === SHIPPED_FUNDING) return decided;
  if (funding === 'single-wall-clock-purse') {
    const taken = debitedFrom(gymState.settledBooks, decided.settledBooks);
    return Object.freeze({
      ...decided,
      settledBooks: booksAt(
        decided.settledBooks,
        gymState.settledBooks[POOLED_WALL_CLOCK_BOOK] - taken,
      ),
    });
  }
  let paid: number = decided.gymBucks;
  for (const book of WALL_CLOCK_FUNDED_OUTPUTS) paid = Math.min(paid, decided.settledBooks[book]);
  return Object.freeze({
    ...decided,
    gymBucks: asGymBucks(paid),
    settledBooks: gymState.settledBooks,
    settledAxes: gymState.settledAxes,
  });
}

/**
 * Advance the gym by one check-in.
 *
 * `accelerant` and `grantSeconds` are the plan landing on the gym: this is the
 * gym the player has, so a grant does what §8.3B sells. What it does not do is
 * move any purchase onto the wall-clock book — that is `funding`, and §3 of the
 * header is what it means.
 */
export function stepGym(
  gym: EmpireGym,
  policy: EmpirePolicy,
  wallSeconds: number,
  accelerant: PurchasableAccelerant | null,
  grantSeconds: number,
  funding: EmpireFunding = SHIPPED_FUNDING,
  moment: SpendingMoment = SHIPPED_SPENDING_MOMENT,
): EmpireGym {
  if (!Number.isFinite(wallSeconds) || wallSeconds < 0) {
    throw new RangeError(`a wall-clock reading must be finite and at or above zero, received ${wallSeconds}.`);
  }
  if (!Number.isFinite(grantSeconds) || grantSeconds < 0) {
    throw new RangeError(`a grant must be finite and at or above zero, received ${grantSeconds}.`);
  }

  // 1. The grant is spent on exactly one mechanism. See §6 of the header.
  const at: UnacceleratedSeconds = asUnacceleratedSeconds(wallSeconds);
  const provisionalIdle = wallSeconds + gym.skippedSeconds;
  let builds: readonly ExpansionBuild[] = gym.builds;
  let buildSkips = gym.buildSkips;
  let clockSkips = gym.clockSkips;
  let skippedSeconds = gym.skippedSeconds;
  // What the build-skip arm below records on the gym. `EmpireState.accelerants`
  // was seeded empty by `createEmpireState` and written by nothing, so
  // `empireRunFaults`' §8.1 re-check walked zero elements on every run it has
  // ever taken — the empty-domain shape CLAUDE.md names. The grant is already
  // constructed here as a checked pairing; keeping it is what gives that check
  // a subject.
  let applied: AppliedAccelerant | null = null;
  if (accelerant !== NO_ACCELERANT && grantSeconds > 0) {
    // The licence is asked about the real accelerant, through `mayAccelerate`.
    // There is no stand-in for a missing one — this arm is the only place a
    // grant is spent and it is only reached when there is an accelerant to ask
    // about — and there is no second opinion about the licence either: asking
    // "is this output idle-only" here instead would be a rule this file holds
    // beside the one `empireCore.ts` holds.
    const skippable =
      gym.builds.find(
        (build) =>
          build.idleCompletion > provisionalIdle &&
          mayAccelerate(accelerant, axisOutput(build.axis)),
      ) ?? null;
    if (skippable !== null) {
      const grant = applyPurchasableGrant(
        accelerant,
        axisOutput(skippable.axis) as IdleOnlyOutput,
        at,
        grantSeconds,
      );
      builds = gym.builds.map((build) => (build === skippable ? skipExpansion(build, grant) : build));
      buildSkips += 1;
      applied = grant;
    } else {
      skippedSeconds += grantSeconds;
      clockSkips += 1;
    }
  }

  const clock = createEmpireClock(wallSeconds, skippedSeconds);

  // 2. Both views of the axes, and the recruits that have landed on the idle
  //    clock join the roster.
  let state: EmpireState = Object.freeze({
    ...gym.state,
    clock,
    axes: idleAxesAt(builds, clock.accelerated),
    settledAxes: settledAxesAt(builds, clock.unaccelerated),
    accelerants:
      applied === null
        ? gym.state.accelerants
        : Object.freeze([...gym.state.accelerants, applied]),
  });
  const stillPending: PendingRecruit[] = [];
  let recruits = gym.recruits;
  for (const waiting of gym.pending) {
    if (waiting.schedule.joinsAt > clock.accelerated) {
      stillPending.push(waiting);
      continue;
    }
    state = completeRecruitment(state, waiting.schedule, waiting.id, RECRUIT_DISPLAY_NAME);
    recruits += 1;
  }

  // 3. Collect. Every accrual is read at the mark, which is where the shipped
  //    modules read their rates, and each one is the shipped function rather
  //    than arithmetic restated here. The sponsor line is paid into the
  //    accelerated book only: it is denominated off reputation, which is a
  //    §5.4 axis the gym earns, and the wall-clock book takes the baseline line
  //    and nothing else.
  const rates = rosterRatesAt(gym.collectedAt);
  const production = accrueProduction(state, gym.collectedAt, rates);
  const reputation = accrueReputation(state, gym.collectedAt, 1);
  const sponsor = accrueSponsorship(state, gym.collectedAt);
  // Every wall-clock purse is credited the same line, because
  // `settledGymBucksRatePerHour` reads no state — the split is about where the
  // money may GO, not about how fast it arrives.
  const credited: Partial<Record<WallClockFundedOutput, GymBucks>> = {};
  for (const book of WALL_CLOCK_FUNDED_OUTPUTS) {
    credited[book] = asGymBucks(
      scrubPrecision(state.settledBooks[book] + production.settledGymBucks),
    );
  }
  state = Object.freeze({
    ...state,
    gymBucks: asGymBucks(scrubPrecision(state.gymBucks + production.gymBucks + sponsor.gymBucks)),
    settledBooks: Object.freeze({ ...state.settledBooks, ...credited }),
    reputation: reputation.reputation,
  });

  // 4. Spend on the axes, rotating so no axis starves. Every PURSE is offered a
  //    slot of its own rather than every clock family: if two ladders
  //    competed for a single slot, whether an equipment rung took it would
  //    depend on the accelerated book, and the day a wall-clock-funded rung
  //    starts would be back under the purchase through the competition rather
  //    than through the price — and, since GDD §5.4's third-book ruling, back
  //    under the CHECK-IN SCHEDULE for the same reason.
  //    Which axis is offered first, and whether this check-in offers anything at
  //    all, is `moment` — the simulated player's spending policy. Under
  //    `SHIPPED_SPENDING_MOMENT` both questions answer the way this loop always
  //    answered them, which `empireInvariant.test.ts` holds by comparing whole
  //    gyms rather than by this sentence.
  let expansions = gym.expansions;
  let nextAxis = gym.nextAxis;
  if (policy.axisOrder.length > 0 && spendsAtMoment(moment)) {
    for (const book of EMPIRE_BOOKS) {
      const offers = axisSpendingOrder(
        moment,
        policy.axisOrder,
        nextAxis,
        book,
        expansionContext(offeredTo(state, funding), builds),
        funding,
      );
      for (const axis of offers) {
        const started = startExpansion(expansionContext(offeredTo(state, funding), builds), axis);
        if (!started.started) continue;
        builds = Object.freeze([...builds, started.build]);
        state = withBooks(
          state,
          Object.freeze({
            ...state,
            gymBucks: started.gymBucks,
            settledBooks: started.settledBooks,
          }),
          funding,
        );
        expansions += 1;
        break;
      }
    }
    if (rotatesAtMoment(moment)) {
      nextAxis = (nextAxis + 1) % policy.axisOrder.length;
    }
  }

  // 5. Spend on the roster. The board is a catalogue and this reads the top of
  //    it downwards; nothing here selects, and there is no outcome set. The
  //    slots are counted on the wall clock, because a slot gates the lifter who
  //    fills it and that lifter pays Training IQ.
  const offered = offeredTo(state, funding);
  const capacity = rosterCapacity(offered.settledAxes);
  const rosterAllowed = maySpendOnRoster(
    moment,
    policy.axisOrder,
    expansionContext(offered, builds),
    funding,
  );
  if (rosterAllowed && state.roster.length + stillPending.length < capacity) {
    const tier = bestRecruitableTier(offered);
    if (tier !== null) {
      const decision = beginRecruitment(offered, tier);
      if (decision.kind === 'accepted') {
        state = withBooks(state, decision.state, funding);
        stillPending.push({
          schedule: decision.schedule,
          id: asNpcId(`recruit-${recruits + stillPending.length}`),
        });
      }
    }
  }

  return Object.freeze({
    state,
    builds,
    pending: Object.freeze(stillPending),
    collectedAt: clock,
    skippedSeconds,
    nextAxis,
    recruits,
    expansions,
    buildSkips,
    clockSkips,
  });
}

/** True for an output a purchasable accelerant may be aimed at. */
function isIdleOnly(output: EmpireOutput): boolean {
  return (IDLE_ONLY_OUTPUTS as readonly string[]).includes(output);
}

/** Add Gym Bucks to the accelerated book without going through an accrual. */
function credit(gym: EmpireGym, amount: number): EmpireGym {
  if (amount === 0) return gym;
  return Object.freeze({
    ...gym,
    state: Object.freeze({
      ...gym.state,
      gymBucks: asGymBucks(scrubPrecision(gym.state.gymBucks + amount)),
    }),
  });
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

/**
 * One day's two progression-reaching readings, off the gym the player has.
 *
 * Both go through the shipped accessors — `composeTrainingIqRate` for §5.2's
 * trickle and `physioDaysSavedAt` for §5.4's hook — rather than through a
 * reading assembled here, so what the sweep compares is what a consumer would
 * get.
 */
export function gymProgressionEntries(
  gym: EmpireGym,
  day: number,
  at: UnacceleratedSeconds,
): readonly EmpireDayEntry[] {
  return Object.freeze([
    Object.freeze({
      day,
      at,
      output: 'training-iq' as EmpireOutput,
      amount: composeTrainingIqRate(gym.state, gym.state.clock).perDay,
    }),
    Object.freeze({
      day,
      at,
      output: 'physio-days-saved' as EmpireOutput,
      amount: physioDaysSavedAt(gym.builds, at),
    }),
  ]);
}

function requireWholeAtLeastOne(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${what} must be a whole number at or above one, received ${value}.`);
  }
}

/**
 * Compose GDD §5 over `days` calendar days and report the ledger.
 *
 * One gym, and both halves of the ledger come off it: the progression-reaching
 * half through the shipped accessors, and the idle half — the Gym Bucks balance
 * and the roster size — off the same state. `funding` is §4 of the header: the
 * shipped rule, or the control.
 */
export function runEmpire(
  days: number,
  policy: EmpirePolicy,
  plan: AccelerantPlan,
  social: SocialInputs,
  funding: EmpireFunding = SHIPPED_FUNDING,
): EmpireRun {
  requireWholeAtLeastOne(days, 'a horizon');
  requireWholeAtLeastOne(policy.checkInsPerDay, 'a check-in cadence');

  const closeDays = new Set<number>(
    socialRewardSchedule(social.calendar, days)
      .filter((entry) => entry.event === 'rival-period-close')
      .map((entry) => entry.day),
  );

  let gym = createEmpireGym();
  const ledger: EmpireDayEntry[] = [];
  const secondsPerCheckIn = EMPIRE_TUNING.SECONDS_PER_DAY / policy.checkInsPerDay;

  let checkIns = 0;
  let grantedCheckIns = 0;
  const bookDebits: Record<WallClockFundedOutput, number> = Object.fromEntries(
    WALL_CLOCK_FUNDED_OUTPUTS.map((book) => [book, 0]),
  ) as Record<WallClockFundedOutput, number>;
  let grantedSeconds = 0;
  let ceilingBoundDays = 0;
  let rateComparisons = 0;
  let rateDisagreements = 0;
  let socialRewardDays = 0;

  for (let day = 0; day < days; day += 1) {
    for (let tick = 0; tick < policy.checkInsPerDay; tick += 1) {
      checkIns += 1;
      const wallSeconds = day * EMPIRE_TUNING.SECONDS_PER_DAY + (tick + 1) * secondsPerCheckIn;
      const booksBefore = gym.state.settledBooks;
      const granted = grantSecondsAt(plan, checkIns);
      if (granted > 0) {
        grantedCheckIns += 1;
        grantedSeconds += granted;
      }
      // The moment is stated rather than defaulted, so `lastCheckInOfDay` is
      // true of this loop's own cadence instead of being a field nobody keeps
      // honest because the shipped policy happens not to read it.
      gym = stepGym(
        gym,
        policy,
        wallSeconds,
        plan.accelerant,
        granted,
        funding,
        spendingMoment(SHIPPED_SPENDING_POLICY, tick === policy.checkInsPerDay - 1),
      );
      for (const book of WALL_CLOCK_FUNDED_OUTPUTS) {
        const taken = booksBefore[book] - gym.state.settledBooks[book];
        if (taken > 0) bookDebits[book] += taken;
      }
    }

    // §5.5's calendar-keyed income: an encouragement is paid per distinct
    // sender per CALENDAR day, and a rival period closes on a fixed calendar
    // day. Both are paid into the accelerated book, like every other §5.5 and
    // §5.2 line that is not the baseline one.
    const calendarDay: CalendarDay = asCalendarDay(social.calendar.anchorDay + day);
    let income: number = encouragementGymBucksOn(social.encouragementsReceived, calendarDay);
    if (social.rival !== null && closeDays.has(calendarDay)) {
      socialRewardDays += 1;
      income += compareWithRival(
        gymSnapshot(gym),
        social.rival,
        policy.leaderboardMetric,
        social.calendar.anchorDay,
        calendarDay,
      ).gymBucksOwed;
    }
    gym = credit(gym, income);

    // The day's two progression-reaching readings, off the gym the player has.
    const wallNow: UnacceleratedSeconds = elapsedFor(gym.state.clock, 'training-iq');
    const trickle = composeTrainingIqRate(gym.state, gym.state.clock);
    if (trickle.ceilingBound) ceilingBoundDays += 1;
    // The agreement pin between this composition point and `production.ts`'s own
    // ceiling. Dropping the `Math.min` on either side moves this counter.
    const viaProduction = trainingIqRatePerDay(
      gym.state,
      gym.state.clock,
      rosterRatesAt(gym.state.clock),
    );
    if (viaProduction !== trickle.perDay) rateDisagreements += 1;
    rateComparisons += 1;

    ledger.push(
      ...gymProgressionEntries(gym, day, wallNow),
      // The idle half. It is the positive control: if these do not move under a
      // plan that grants anything, the sweep is measuring an accelerant that was
      // never applied.
      Object.freeze({ day, at: wallNow, output: 'gym-bucks', amount: gym.state.gymBucks }),
      Object.freeze({ day, at: wallNow, output: 'roster-slot', amount: gym.state.roster.length }),
    );
  }

  const lastWall: UnacceleratedSeconds = elapsedFor(gym.state.clock, 'training-iq');
  return Object.freeze({
    plan,
    funding,
    days,
    ledger: Object.freeze(ledger),
    gym,
    census: Object.freeze({
      days,
      checkIns,
      bookDebits: Object.freeze({ ...bookDebits }),
      grantedCheckIns,
      grantedSeconds,
      recruits: gym.recruits,
      expansions: gym.expansions,
      buildSkips: gym.buildSkips,
      clockSkips: gym.clockSkips,
      ceilingBoundDays,
      rateComparisons,
      rateDisagreements,
      settledPhysioLevel: settledAxisLevel(gym.builds, 'physio', lastWall),
      idlePhysioLevel: axisLevel(idleAxesAt(gym.builds, gym.state.clock.accelerated), 'physio'),
      socialRewardDays,
    }),
  });
}

// ---------------------------------------------------------------------------
// The two halves of the ledger, partitioned by `empireCore.ts`'s own predicates
// ---------------------------------------------------------------------------

/**
 * The half of a run's ledger that reaches Sim progression — the list the
 * invariant is asserted on, element by element.
 *
 * Filtered through `isProgressionReachingOutput`, which is `empireCore.ts`'s own
 * predicate over its own two tables, so this cannot hold a second opinion about
 * which outputs those are.
 */
export function progressionDayLedger(
  entries: readonly EmpireDayEntry[],
): readonly EmpireDayEntry[] {
  return entries.filter((entry) => isProgressionReachingOutput(entry.output));
}

/** The other half, through `empireCore.ts`'s derived list of idle-only outputs. */
export function idleDayLedger(entries: readonly EmpireDayEntry[]): readonly EmpireDayEntry[] {
  return entries.filter((entry) => isIdleOnly(entry.output));
}

/** One output's series out of a ledger, in day order. */
export function outputSeries(
  entries: readonly EmpireDayEntry[],
  output: EmpireOutput,
): readonly EmpireDayEntry[] {
  return entries.filter((entry) => entry.output === output);
}

// ---------------------------------------------------------------------------
// The element-wise comparison
// ---------------------------------------------------------------------------

/** What one element-wise comparison of two ledgers found. */
export interface LedgerDivergence {
  /** Elements compared. Zero here makes every count below meaningless. */
  readonly compared: number;
  /** Elements that differ in day, output or amount. */
  readonly moved: number;
  /** Elements whose `day` or `output` differ, so the lists are not aligned. */
  readonly misaligned: number;
  /** Elements whose amount differs while day and output agree. */
  readonly movedAmounts: number;
  /** `true` when the two lists are not even the same length. */
  readonly lengthDiffers: boolean;
}

/**
 * Compare two ledgers element by element, on day, output and amount.
 *
 * Not a sum, not a bound and not a hash: GDD §4.4 records a legal input that
 * moved 2362 of 34338 lists while leaving every aggregate identical. `day` is
 * compared as well as `amount` because chain B moved DAYS and left the amounts a
 * lifter eventually paid alone — an amount-only comparison would have been green
 * on it.
 */
export function compareLedgers(
  baseline: readonly EmpireDayEntry[],
  candidate: readonly EmpireDayEntry[],
): LedgerDivergence {
  const length = Math.min(baseline.length, candidate.length);
  let moved = 0;
  let misaligned = 0;
  let movedAmounts = 0;
  for (let at = 0; at < length; at += 1) {
    const left = baseline[at];
    const right = candidate[at];
    if (left === undefined || right === undefined) continue;
    const aligned = left.day === right.day && left.at === right.at && left.output === right.output;
    if (!aligned) misaligned += 1;
    if (aligned && left.amount !== right.amount) movedAmounts += 1;
    if (!aligned || left.amount !== right.amount) moved += 1;
  }
  return Object.freeze({
    compared: length,
    moved,
    misaligned,
    movedAmounts,
    lengthDiffers: baseline.length !== candidate.length,
  });
}

// ---------------------------------------------------------------------------
// A day-valued subject, because the ledger's own day cannot move
// ---------------------------------------------------------------------------

/**
 * The first calendar day each distinct amount of an output appears on.
 *
 * This exists because of a measured hole in the comparison above, and the hole
 * is worth stating rather than leaving for a reader to find. `EmpireDayEntry.day`
 * is the composition loop's own counter, so it is the same number on both sides
 * by construction — which means `LedgerDivergence.misaligned` is ZERO across the
 * whole sweep, including on the control, and the day half of `compareLedgers` is
 * an empty domain there however carefully it is written. That is the vacuity
 * shape CLAUDE.md names: a check that runs, passes, and had no version of its
 * subject that could redden it.
 *
 * A list of ARRIVAL DAYS is the subject that fixes it, and it is the list both
 * upstream headers commissioned: the wall-clock day each new `physioDaysSaved`
 * reading and each new Training IQ rate first lands. Chain B moved days and left
 * the amounts a lifter eventually paid alone; chain C moves the day a physio
 * level lands. Both show up here and in nothing above.
 */
export function arrivalDays(
  entries: readonly EmpireDayEntry[],
  output: EmpireOutput,
): readonly number[] {
  const days: number[] = [];
  const seen = new Set<number>();
  for (const entry of entries) {
    if (entry.output !== output) continue;
    if (seen.has(entry.amount)) continue;
    seen.add(entry.amount);
    days.push(entry.day);
  }
  return Object.freeze(days);
}

/** What one element-wise comparison of two day lists found. */
export interface DayListDivergence {
  readonly compared: number;
  readonly moved: number;
  /** Elements that arrived EARLIER than the baseline. The direction a purchase pushes. */
  readonly earlier: number;
  readonly lengthDiffers: boolean;
}

/** Compare two arrival-day lists element by element. Not a sum, not a bound. */
export function compareDayLists(
  baseline: readonly number[],
  candidate: readonly number[],
): DayListDivergence {
  const length = Math.min(baseline.length, candidate.length);
  let moved = 0;
  let earlier = 0;
  for (let at = 0; at < length; at += 1) {
    const left = baseline[at];
    const right = candidate[at];
    if (left === undefined || right === undefined) continue;
    if (left !== right) moved += 1;
    if (right < left) earlier += 1;
  }
  return Object.freeze({
    compared: length,
    moved,
    earlier,
    lengthDiffers: baseline.length !== candidate.length,
  });
}

// ---------------------------------------------------------------------------
// The runtime shadow of the claims above
// ---------------------------------------------------------------------------

/**
 * Every invariant a composed run has to satisfy, as a list of messages — the
 * same shape as `empireVocabularyFaults`, and for the same reason: a claim in a
 * header is graded by nothing.
 *
 * It does not re-derive `compareLedgers`. An oracle that recomputes its
 * subject's own comparison cannot disagree with it.
 */
export function empireRunFaults(run: EmpireRun): readonly FaultMessage[] {
  const faults: string[] = [];

  // Every grant landed on exactly one mechanism. Two mechanisms exist and §6 of
  // the header says a grant is spent on one of them, so the two counts have to
  // add up to the number of check-ins that granted anything — a grant spent
  // twice, or spent nowhere, moves this.
  if (run.census.buildSkips + run.census.clockSkips !== run.census.grantedCheckIns) {
    faults.push(
      `the plan granted on ${run.census.grantedCheckIns} check-ins and ${run.census.buildSkips + run.census.clockSkips} grants were spent`,
    );
  }
  if (run.census.rateDisagreements !== 0) {
    faults.push(
      `the composed trickle and production.ts disagreed on ${run.census.rateDisagreements} of ${run.census.rateComparisons} days`,
    );
  }
  if (run.census.rateComparisons === 0) {
    faults.push('the trickle was never compared with production.ts, so the ceiling agrees about nothing');
  }
  if (run.ledger.length === 0) {
    faults.push('the run produced no ledger at all');
  }
  // The wall-clock view of a ladder is never ahead of the idle one, on the gym
  // as it actually ran. `empireStateFaults` says the same thing about a decoded
  // payload; this says it about a composed calendar.
  if (run.census.settledPhysioLevel > run.census.idlePhysioLevel) {
    faults.push(
      `the wall clock has reached physio level ${run.census.settledPhysioLevel} and the player's gym shows ${run.census.idlePhysioLevel}`,
    );
  }
  const progression = progressionDayLedger(run.ledger);
  const idle = idleDayLedger(run.ledger);
  if (progression.length + idle.length !== run.ledger.length) {
    faults.push(
      `the ledger holds ${run.ledger.length} entries and the two halves account for ${progression.length + idle.length}`,
    );
  }
  if (progression.length === 0) {
    faults.push('no entry reaches progression, so the invariant protects nothing');
  }
  if (idle.length === 0) {
    faults.push('no entry is idle-only, so a purchase is asserted to move nothing at all');
  }
  for (const entry of progression) {
    if (entry.amount > EMPIRE_TUNING.TRAINING_IQ_DAILY_CEILING && entry.output === 'training-iq') {
      faults.push(`day ${entry.day} paid ${entry.amount} Training IQ, which is above the daily budget`);
    }
    if (entry.amount > EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED && entry.output === 'physio-days-saved') {
      faults.push(`day ${entry.day} saved ${entry.amount} days, which is above the physio budget`);
    }
  }
  // GDD §8.1's refusal condition, re-asked on the composed gym rather than on a
  // hand-built payload — and asked over a domain that is now populated. Until
  // `stepGym` recorded the grant it spent, this walk had zero elements on every
  // shipped and every control run, which is a check that reads as the refusal
  // condition and is decoration.
  //
  // The counter below is what says so out loud. `EmpireState.accelerants` holds
  // one entry per BUILD skip — the clock-skip mechanism names no output and so
  // has nothing to pair — and `EmpireRunCensus.buildSkips` counts the same
  // events from the other side, so a recording that stopped happening is a
  // fault instead of an empty loop.
  let pairingsChecked = 0;
  for (const applied of run.gym.state.accelerants) {
    pairingsChecked += 1;
    if (!mayAccelerate(applied.accelerant, applied.output)) {
      faults.push(`${applied.accelerant} was applied to ${applied.output} on the player's gym`);
    }
  }
  if (pairingsChecked !== run.census.buildSkips) {
    faults.push(
      `the gym recorded ${pairingsChecked} applied accelerants and ${run.census.buildSkips} builds were skipped`,
    );
  }

  return faults.map((message) => asFaultMessage(message));
}
