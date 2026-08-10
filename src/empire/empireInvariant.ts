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
 * 2. The three leaks the leaves could not close, and which ones this closes
 * ===========================================================================
 *
 * Chain A — earned, not purchased. Check-ins pay reputation, reputation pays a
 * sponsor line, the sponsor line pays Gym Bucks, Gym Bucks buy the physio level,
 * and `physioDaysSaved` is a Sim quantity. Not a §8.1 breach, because it is not
 * purchasable; named here because it is §4.4's shape one hop out and because the
 * argument that it is safe (a diligent lifter is only ever helped) is a reason to
 * measure it rather than a substitute for measuring it. This file does not
 * measure it; that is stated as an obligation still outstanding.
 *
 * Chain B — purchasable, found and MEASURED by piece E4, closed by piece E6 in
 * `empireCore.ts` and `reputation.ts` rather than here. A skip lengthened the
 * idle gap, reputation accrued against the longer gap because reputation is paid
 * into the gym economy, so a tier's milestone was met on an earlier WALL-CLOCK
 * day and the lifter behind it settled earlier at a larger tier multiplier. The
 * fix is that reach as a PAYOUT and reach as a GATE are two different questions:
 * `GATE_TARGET` and `gateElapsedFor` ask the second one. `reputation.test.ts`
 * measures the closure at zero with the old reading kept beside it as the
 * control at piece E4's own numbers.
 *
 * Chain C — purchasable, and the one no rate function can answer. A skip pays
 * Gym Bucks sooner, so the gym can AFFORD a recruit or a physio level on an
 * earlier wall-clock day. `startExpansion` stamps `settledCompletion` from
 * whatever `clock.unaccelerated` it is handed, and `recruitmentSchedule` stamps
 * `settlesAt` the same way; both are correct, and both are stamped on a day the
 * purchase chose. `settledLevel`'s docstring in `empireCore.ts` states the
 * contract — `completionTimes` is "when each level of that axis would have
 * finished with no accelerant applied" — and says plainly that it is a contract
 * on the CALLER, because nothing checks where a `readonly UnacceleratedSeconds[]`
 * came from. This file is that caller, and §3 is how it keeps the contract.
 *
 * ===========================================================================
 * 3. Two lanes, and the one line that is the whole closure
 * ===========================================================================
 *
 * An `EmpireRun` steps TWO lanes over the same calendar, with the same policy:
 *
 *   - the IDLE lane is the gym the player has. Every accelerant lands on it, so
 *     a bought skip does what GDD §8.3B sells — the build finishes now, the
 *     lifter is on the roster now, the economy pays now.
 *   - the SETTLED lane is the same gym with no accelerant ever applied. It makes
 *     its own decisions with its own money on the wall clock.
 *
 * Everything that reaches Sim progression is read off the SETTLED lane; the Gym
 * Bucks balance, the roster size and everything else a screen shows are read off
 * the IDLE one. `stepLane` is one function and both lanes go through it; the
 * settled lane is stepped with `NO_ACCELERANT` and a zero grant, always, and
 * that call is the whole closure. It is one line, it is named, and
 * `empireInvariant.test.ts` drives the variant where it is not — the settled
 * lane stepped with the plan — and pins that variant's divergence count non-zero.
 *
 * Say plainly what this costs, because it is a design decision a human may
 * overturn rather than a transcription. A player who buys skips watches their
 * empire race ahead while their Training IQ trickle behaves as though they had
 * bought nothing. That is the pay-to-win rule taken literally: the purchase buys
 * the gym, the collection, the cosmetics and the convenience, and it does not buy
 * a single point of a stat GDD §2 says decides growth rate and long-term ceiling.
 * `empireCore.ts`'s header names the two alternatives — a flat calendar-keyed
 * trickle with no roster term at all, or narrowing §8.3B so recruit and build
 * timers are not for sale — and both cost more of §5 than this does.
 *
 * And say plainly what the shape of the check is. With the settled lane wired
 * this way the invariant is true by construction, which is the point rather than
 * a weakness: the thing worth checking is that the construction is the one that
 * shipped. Every mutant `empireInvariant.test.ts` runs is a wiring mistake a
 * later piece could actually make — the progression ledger read off the idle
 * lane, the settled lane handed the plan, the physio series read off
 * `idleAxesAt` — and each one is pinned at a measured non-zero count. The
 * positive control is the other half: the idle ledger MUST move under every plan
 * that grants anything, or the whole sweep is an empty domain reporting a zero
 * about an accelerant that was never applied.
 *
 * ===========================================================================
 * 3a. What this sweep is blind to, measured rather than argued
 * ===========================================================================
 *
 * The two-lane design has a consequence worth stating plainly, because CLAUDE.md
 * asks whether harnesses are independent or merely numerous: **a leak inside the
 * accelerant path itself cannot reach the settled lane, so this sweep cannot
 * see one.** Two mutants were run to find out rather than reasoned about:
 *
 *   - reverting chain B in `reputation.ts` — the accrual back onto
 *     `elapsedFor(at, 'reputation')` and the roster filter back onto `joinedAt`
 *     — leaves all 39 checks in `empireInvariant.test.ts` green on the
 *     invariant, and reddens four exact COUNT pins and the whole of
 *     `reputation.test.ts`'s chain block;
 *   - letting `skipExpansion` move `settledCompletion` as well as
 *     `idleCompletion` leaves this file's suite entirely green, and reddens
 *     three checks in `expansion.test.ts`.
 *
 * Neither is a weak test here. Both are outside this sweep's subject: this file
 * asserts that the COMPOSITION keeps a progression-reaching output off the
 * purchase, and each leaf module asserts that its own arithmetic does. The two
 * layers are independent for a structural reason rather than by luck, and the
 * honest statement is that a green run of this file alone is not evidence about
 * the leaves.
 *
 * ===========================================================================
 * 4. The Training IQ ceiling is applied HERE, and that is not an accident
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
 * 5. How an accelerant is modelled, since two mechanisms exist and neither may
 *    be applied to the same second twice
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
 * Never both, so a second is never skipped twice. A physio build is never
 * skipped, because `mayAccelerate` refuses every purchasable accelerant against
 * `'physio-days-saved'` and `applyAccelerant` will not build the pairing — that
 * is `empireCore.ts`'s first reading doing its job inside this loop rather than
 * a rule restated here.
 *
 * ===========================================================================
 * 6. What is deliberately not here
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
  asGymBucks,
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
  type IdleOnlyOutput,
  type NpcLifter,
  type NpcTier,
  type PurchasableAccelerant,
  type UnacceleratedSeconds,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import {
  axisOutput,
  expansionContext,
  idleAxesAt,
  physioDaysSavedAt,
  settledAxisLevel,
  skipExpansion,
  startExpansion,
  type ExpansionAxis,
  type ExpansionBuild,
} from './expansion';
import { npcGymBucksPerHour, npcTrainingIqPerDay, rosterTrainingIqPerDay } from './npc';
import {
  accrueProduction,
  scrubPrecision,
  trainingIqRatePerDay,
  type RosterRateSource,
} from './production';
import {
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

/** The placeholder every recruited lifter is named with. See §6 of the header. */
const RECRUIT_DISPLAY_NAME = 'Placeholder';

/** The gym id the composed run reports itself under, for the §5.5 comparison. */
const OWN_GYM_ID = 'composed-gym';

/**
 * The plan for a lane that is handed no accelerant, ever.
 *
 * `stepLane` takes an accelerant and a grant size; this is the pair the settled
 * lane is always stepped with, and it is the whole of the closure §3 describes.
 */
export const NO_ACCELERANT: null = null;

/** How the simulated player spends, per check-in. No magnitude lives here. */
export interface EmpirePolicy {
  /** Check-ins per calendar day. The last one lands on the day boundary. */
  readonly checkInsPerDay: number;
  /** The order axes are offered a level-up in. Rotated one step per check-in. */
  readonly axisOrder: readonly ExpansionAxis[];
  /** Which §5.5 metric the rival comparison ranks on. */
  readonly leaderboardMetric: LeaderboardMetric;
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

/** A recruitment that has been paid for and has not landed yet. */
export interface PendingRecruit {
  readonly schedule: RecruitmentSchedule;
  readonly id: string;
}

/** One lane of the simulation: a gym, its builds, and what it is waiting on. */
export interface EmpireLane {
  readonly state: EmpireState;
  readonly builds: readonly ExpansionBuild[];
  readonly pending: readonly PendingRecruit[];
  /** The clock as it read when this lane last collected. */
  readonly collectedAt: EmpireClock;
  /** Seconds of accelerant folded into this lane's idle clock so far. */
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
  /** Seconds of accelerant the plan handed the idle lane in total. */
  readonly grantedSeconds: number;
  readonly idleRecruits: number;
  readonly settledRecruits: number;
  readonly idleExpansions: number;
  readonly settledExpansions: number;
  readonly idleBuildSkips: number;
  readonly idleClockSkips: number;
  /** Seconds the settled lane was ever handed. Zero, or the closure is gone. */
  readonly settledSkippedSeconds: number;
  /** Days on which `TRAINING_IQ_DAILY_CEILING` bit. */
  readonly ceilingBoundDays: number;
  /** Days the composed rate was compared with `production.ts`'s own. */
  readonly rateComparisons: number;
  readonly rateDisagreements: number;
  readonly settledPhysioLevel: number;
  readonly idlePhysioLevel: number;
  readonly socialRewardDays: number;
}

/** Everything one composed calendar produced. */
export interface EmpireRun {
  readonly plan: AccelerantPlan;
  readonly days: number;
  /** Every entry, both halves, in day order then in output order. */
  readonly ledger: readonly EmpireDayEntry[];
  /**
   * THE NEGATIVE CONTROL, and nothing the game ships reads it.
   *
   * The same two progression-reaching readings, on the same days, through the
   * same `composeTrainingIqRate` and `physioDaysSavedAt` calls — taken off the
   * IDLE lane instead of the settled one. It is the deliberately-wired variant
   * GDD §4.4 asks for beside a zero: a run whose progression ledger DOES move
   * with the purchase, with its divergence count pinned non-zero in
   * `empireInvariant.test.ts`.
   *
   * It is produced here rather than reconstructed in a test on purpose. A
   * control assembled by a second loop can drift from the loop it is a control
   * for, and then the zero and the non-zero are about two different simulations.
   * Swapping one identifier — `settled` for `idle` — is exactly the wiring
   * mistake a later piece would make, and it is exactly what this field is.
   *
   * It also covers the mutant "the settled lane is stepped with the plan",
   * because a lane stepped with the plan under this policy and these social
   * inputs IS the idle lane. Two names, one variant; said here rather than
   * shipped twice.
   */
  readonly counterfactualIdleReadings: readonly EmpireDayEntry[];
  readonly idle: EmpireLane;
  readonly settled: EmpireLane;
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
 * The composition point §4 of the header is about. Three things happen here and
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
// A lane
// ---------------------------------------------------------------------------

/** A lane on the day the gym opens. */
export function createEmpireLane(): EmpireLane {
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

/** The gym as §5.5 compares it: this lane's own reputation and nothing private. */
export function laneSnapshot(lane: EmpireLane): GymSnapshot {
  return Object.freeze({
    gymId: OWN_GYM_ID,
    displayName: RECRUIT_DISPLAY_NAME,
    reputation: lane.state.reputation,
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
 * Advance one lane by one check-in.
 *
 * `accelerant` and `grantSeconds` are what §3 of the header is about: the
 * settled lane is stepped with `NO_ACCELERANT` and zero, on every step, and that
 * is what keeps every progression-reaching quantity read off it free of the
 * purchase. Nothing else in this function branches on which lane it is stepping.
 */
export function stepLane(
  lane: EmpireLane,
  policy: EmpirePolicy,
  wallSeconds: number,
  accelerant: PurchasableAccelerant | null,
  grantSeconds: number,
): EmpireLane {
  if (!Number.isFinite(wallSeconds) || wallSeconds < 0) {
    throw new RangeError(`a wall-clock reading must be finite and at or above zero, received ${wallSeconds}.`);
  }
  if (!Number.isFinite(grantSeconds) || grantSeconds < 0) {
    throw new RangeError(`a grant must be finite and at or above zero, received ${grantSeconds}.`);
  }

  // 1. The grant is spent on exactly one mechanism. See §5 of the header.
  const at: UnacceleratedSeconds = asUnacceleratedSeconds(wallSeconds);
  const runningNow = (build: ExpansionBuild, idleNow: number): boolean =>
    build.idleCompletion > idleNow && mayAccelerate(accelerant ?? 'coach-staff-level', axisOutput(build.axis));
  const provisionalIdle = wallSeconds + lane.skippedSeconds;
  const skippable =
    accelerant === NO_ACCELERANT || grantSeconds === 0
      ? null
      : (lane.builds.find((build) => runningNow(build, provisionalIdle)) ?? null);

  let builds: readonly ExpansionBuild[] = lane.builds;
  let buildSkips = lane.buildSkips;
  let clockSkips = lane.clockSkips;
  let skippedSeconds = lane.skippedSeconds;
  if (skippable !== null && accelerant !== NO_ACCELERANT) {
    const output = axisOutput(skippable.axis);
    const applied = applyPurchasableGrant(accelerant, output as IdleOnlyOutput, at, grantSeconds);
    builds = lane.builds.map((build) => (build === skippable ? skipExpansion(build, applied) : build));
    buildSkips += 1;
  } else if (grantSeconds > 0) {
    skippedSeconds += grantSeconds;
    clockSkips += 1;
  }

  const clock = createEmpireClock(wallSeconds, skippedSeconds);

  // 2. Recruits that have landed on this lane's own idle clock join the roster.
  let state: EmpireState = Object.freeze({
    ...lane.state,
    clock,
    axes: idleAxesAt(builds, clock.accelerated),
  });
  const stillPending: PendingRecruit[] = [];
  let recruits = lane.recruits;
  for (const waiting of lane.pending) {
    if (waiting.schedule.joinsAt > clock.accelerated) {
      stillPending.push(waiting);
      continue;
    }
    state = completeRecruitment(state, waiting.schedule, waiting.id, RECRUIT_DISPLAY_NAME);
    recruits += 1;
  }

  // 3. Collect. Every accrual is read at the mark, which is where the shipped
  //    modules read their rates, and each one is the shipped function rather
  //    than arithmetic restated here.
  const rates = rosterRatesAt(lane.collectedAt);
  const production = accrueProduction(state, lane.collectedAt, rates);
  const reputation = accrueReputation(state, lane.collectedAt, 1);
  const sponsor = accrueSponsorship(state, lane.collectedAt);
  state = Object.freeze({
    ...state,
    gymBucks: asGymBucks(scrubPrecision(state.gymBucks + production.gymBucks + sponsor.gymBucks)),
    reputation: reputation.reputation,
  });

  // 4. Spend on the axes, one attempt per check-in, rotating so no axis starves.
  let expansions = lane.expansions;
  let nextAxis = lane.nextAxis;
  if (policy.axisOrder.length > 0) {
    for (let offset = 0; offset < policy.axisOrder.length; offset += 1) {
      const axis = policy.axisOrder[(nextAxis + offset) % policy.axisOrder.length];
      if (axis === undefined) continue;
      const started = startExpansion(expansionContext(state, builds), axis);
      if (!started.started) continue;
      builds = Object.freeze([...builds, started.build]);
      state = Object.freeze({ ...state, gymBucks: started.gymBucks });
      expansions += 1;
      break;
    }
    nextAxis = (nextAxis + 1) % policy.axisOrder.length;
  }

  // 5. Spend on the roster. The board is a catalogue and this reads the top of
  //    it downwards; nothing here selects, and there is no outcome set.
  const capacity = rosterCapacity(state.axes);
  if (state.roster.length + stillPending.length < capacity) {
    const tier = bestRecruitableTier(state);
    if (tier !== null) {
      const decision = beginRecruitment(state, tier);
      if (decision.kind === 'accepted') {
        state = decision.state;
        stillPending.push({ schedule: decision.schedule, id: `recruit-${recruits + stillPending.length}` });
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

/** Add Gym Bucks to a lane without going through an accrual. Social income. */
function credit(lane: EmpireLane, amount: number): EmpireLane {
  if (amount === 0) return lane;
  return Object.freeze({
    ...lane,
    state: Object.freeze({
      ...lane.state,
      gymBucks: asGymBucks(scrubPrecision(lane.state.gymBucks + amount)),
    }),
  });
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

/**
 * One day's two progression-reaching readings, off whichever lane it is given.
 *
 * One function, called twice: once with the settled lane, whose answer is the
 * shipped ledger, and once with the idle lane, whose answer is the negative
 * control. Writing the control's arithmetic a second time would let the two
 * drift, and then the zero and the non-zero would be about different runs.
 */
export function laneProgressionEntries(
  lane: EmpireLane,
  day: number,
  at: UnacceleratedSeconds,
): readonly EmpireDayEntry[] {
  return Object.freeze([
    Object.freeze({
      day,
      at,
      output: 'training-iq' as EmpireOutput,
      amount: composeTrainingIqRate(lane.state, lane.state.clock).perDay,
    }),
    Object.freeze({
      day,
      at,
      output: 'physio-days-saved' as EmpireOutput,
      amount: physioDaysSavedAt(lane.builds, at),
    }),
  ]);
}

function requireWholeAtLeastOne(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${what} must be a whole number at or above one, received ${value}.`);
  }
}

/**
 * Compose GDD §5 over `days` calendar days and report both ledgers.
 *
 * The progression-reaching half of the ledger is read off the settled lane and
 * the idle half off the idle one. That split is §3 of the header, and it is the
 * only place in this file where the two lanes are treated differently after they
 * are stepped.
 */
export function runEmpire(
  days: number,
  policy: EmpirePolicy,
  plan: AccelerantPlan,
  social: SocialInputs,
): EmpireRun {
  requireWholeAtLeastOne(days, 'a horizon');
  requireWholeAtLeastOne(policy.checkInsPerDay, 'a check-in cadence');

  const closeDays = new Set<number>(
    socialRewardSchedule(social.calendar, days)
      .filter((entry) => entry.event === 'rival-period-close')
      .map((entry) => entry.day),
  );

  let idle = createEmpireLane();
  let settled = createEmpireLane();
  const ledger: EmpireDayEntry[] = [];
  const counterfactual: EmpireDayEntry[] = [];
  const secondsPerCheckIn = EMPIRE_TUNING.SECONDS_PER_DAY / policy.checkInsPerDay;

  let checkIns = 0;
  let grantedCheckIns = 0;
  let grantedSeconds = 0;
  let ceilingBoundDays = 0;
  let rateComparisons = 0;
  let rateDisagreements = 0;
  let socialRewardDays = 0;

  for (let day = 0; day < days; day += 1) {
    for (let tick = 0; tick < policy.checkInsPerDay; tick += 1) {
      checkIns += 1;
      const wallSeconds = day * EMPIRE_TUNING.SECONDS_PER_DAY + (tick + 1) * secondsPerCheckIn;
      const granted = grantSecondsAt(plan, checkIns);
      if (granted > 0) {
        grantedCheckIns += 1;
        grantedSeconds += granted;
      }
      idle = stepLane(idle, policy, wallSeconds, plan.accelerant, granted);
      // THE CLOSURE. The settled lane is stepped with no accelerant and no
      // grant, on every step, whatever the plan says.
      settled = stepLane(settled, policy, wallSeconds, NO_ACCELERANT, 0);
    }

    // §5.5's calendar-keyed income, identical on both lanes by construction: an
    // encouragement is paid per distinct sender per CALENDAR day, and a rival
    // period closes on a fixed calendar day.
    const calendarDay: CalendarDay = asCalendarDay(social.calendar.anchorDay + day);
    const encouraged = encouragementGymBucksOn(social.encouragementsReceived, calendarDay);
    let idleSocial: number = encouraged;
    let settledSocial: number = encouraged;
    if (social.rival !== null && closeDays.has(calendarDay)) {
      socialRewardDays += 1;
      idleSocial += compareWithRival(
        laneSnapshot(idle),
        social.rival,
        policy.leaderboardMetric,
        social.calendar.anchorDay,
        calendarDay,
      ).gymBucksOwed;
      settledSocial += compareWithRival(
        laneSnapshot(settled),
        social.rival,
        policy.leaderboardMetric,
        social.calendar.anchorDay,
        calendarDay,
      ).gymBucksOwed;
    }
    idle = credit(idle, idleSocial);
    settled = credit(settled, settledSocial);

    // The day's two progression-reaching readings, both off the settled lane.
    const wallNow: UnacceleratedSeconds = elapsedFor(settled.state.clock, 'training-iq');
    const trickle = composeTrainingIqRate(settled.state, settled.state.clock);
    if (trickle.ceilingBound) ceilingBoundDays += 1;
    // The agreement pin between this composition point and `production.ts`'s own
    // ceiling. Dropping the `Math.min` on either side moves this counter.
    const viaProduction = trainingIqRatePerDay(
      settled.state,
      settled.state.clock,
      rosterRatesAt(settled.state.clock),
    );
    if (viaProduction !== trickle.perDay) rateDisagreements += 1;
    rateComparisons += 1;

    ledger.push(
      ...laneProgressionEntries(settled, day, wallNow),
      // The idle half, read off the lane the purchase does move. It is the
      // positive control: if these do not move under a plan that grants
      // anything, the sweep is measuring an accelerant that was never applied.
      Object.freeze({ day, at: wallNow, output: 'gym-bucks', amount: idle.state.gymBucks }),
      Object.freeze({ day, at: wallNow, output: 'roster-slot', amount: idle.state.roster.length }),
    );
    counterfactual.push(...laneProgressionEntries(idle, day, wallNow));
  }

  const lastWall: UnacceleratedSeconds = elapsedFor(settled.state.clock, 'training-iq');
  return Object.freeze({
    plan,
    days,
    ledger: Object.freeze(ledger),
    counterfactualIdleReadings: Object.freeze(counterfactual),
    idle,
    settled,
    census: Object.freeze({
      days,
      checkIns,
      grantedCheckIns,
      grantedSeconds,
      idleRecruits: idle.recruits,
      settledRecruits: settled.recruits,
      idleExpansions: idle.expansions,
      settledExpansions: settled.expansions,
      idleBuildSkips: idle.buildSkips,
      idleClockSkips: idle.clockSkips,
      settledSkippedSeconds: settled.skippedSeconds,
      ceilingBoundDays,
      rateComparisons,
      rateDisagreements,
      settledPhysioLevel: settledAxisLevel(settled.builds, 'physio', lastWall),
      idlePhysioLevel: settledAxisLevel(idle.builds, 'physio', lastWall),
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
  return entries.filter((entry) => (IDLE_ONLY_OUTPUTS as readonly string[]).includes(entry.output));
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
 * is the composition loop's own counter, so it is the same number on both lanes
 * by construction — which means `LedgerDivergence.misaligned` is ZERO across the
 * whole sweep, including on the counterfactual, and the day half of
 * `compareLedgers` is an empty domain there however carefully it is written.
 * That is the vacuity shape CLAUDE.md names: a check that runs, passes, and had
 * no version of its subject that could redden it.
 *
 * A list of ARRIVAL DAYS is the subject that fixes it. Chain B moved days and
 * left the amounts a lifter eventually paid alone, and chain C moves the day a
 * physio level lands; both show up here as a moved element and in nothing above.
 * It is the same shape `reputation.test.ts` uses for the tier-unlock list, one
 * subsystem over.
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
export function empireRunFaults(run: EmpireRun): readonly string[] {
  const faults: string[] = [];

  if (run.census.settledSkippedSeconds !== 0) {
    faults.push(
      `the settled lane carries ${run.census.settledSkippedSeconds} seconds of accelerant, so nothing on it is a counterfactual`,
    );
  }
  if (run.settled.buildSkips !== 0 || run.settled.clockSkips !== 0) {
    faults.push(
      `the settled lane spent ${run.settled.buildSkips + run.settled.clockSkips} grants, so a purchase reached it`,
    );
  }
  // Widened to bare numbers before comparison: the two brands do not overlap, so
  // TypeScript rejects the comparison as impossible and would leave the check
  // absent at runtime — where a decoded payload is exactly what it is for.
  const settledIdleReading: number = run.settled.state.clock.accelerated;
  const settledWallReading: number = run.settled.state.clock.unaccelerated;
  if (settledIdleReading !== settledWallReading) {
    faults.push('the settled lane two clock readings differ, so an accelerant moved one of them');
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
  const progression = progressionDayLedger(run.ledger);
  const idle = idleDayLedger(run.ledger);
  if (run.counterfactualIdleReadings.length === 0) {
    faults.push('the run produced no counterfactual, so the zero has nothing beside it');
  }
  if (run.counterfactualIdleReadings.length !== progression.length) {
    faults.push(
      `the counterfactual holds ${run.counterfactualIdleReadings.length} readings against ${progression.length} shipped ones, so they cannot be compared element-wise`,
    );
  }
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
  for (const applied of run.idle.state.accelerants) {
    if (!mayAccelerate(applied.accelerant, applied.output)) {
      faults.push(`${applied.accelerant} was applied to ${applied.output} on the idle lane`);
    }
  }

  return faults;
}
