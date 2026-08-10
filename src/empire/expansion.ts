/**
 * expansion.ts — GDD §5.4's four expansion axes: what a level costs, what
 * gates it, how long it takes to build, and where each axis stops.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock and no randomness. Time arrives as an
 * `EmpireClock`. Its only imports are `./empireCore` and `./empireTuning`, so
 * every number it uses is named in one place and the directory-wide scans in
 * `empireCore.test.ts` cover this file the moment it lands.
 *
 * ===========================================================================
 * 1. What §5.4 asks for, and how each row is served here
 * ===========================================================================
 *
 *   Equipment tiers — bare bar, comp plates, specialty bars, monolift. A
 *     ladder of four, where index 0 is the room a gym opens in and levels 1..3
 *     are purchases. `EQUIPMENT_TIER_COST_GYM_BUCKS` is the price table.
 *
 *   Space — "more racks, platforms, NPC slots", raising the passive ceiling.
 *     Levels 1..`SPACE_LEVEL_MAX`, priced by `SPACE_LEVEL_COST_GYM_BUCKS`, and
 *     read by `rosterCapacity` in `empireCore.ts`.
 *
 *   Staff — coaches, spotters, physio. One ladder per role, priced by
 *     `STAFF_LEVEL_COST_GYM_BUCKS`, capped by `STAFF_LEVEL_MAX`.
 *
 *   Reputation — "attracts higher-tier NPCs, sponsorships". Reputation's own
 *     accrual is piece E4; what lives here is how it GATES a level, which is
 *     `axisReputationRule` below.
 *
 * ===========================================================================
 * 2. The physio axis is a §12.3 surface and is treated as one
 * ===========================================================================
 *
 * §5.4 wants "physio reduces Sim injury duration". §8.1 refuses anything
 * purchasable that affects training pace, and a shorter setback restores
 * training pace — so a purchased accelerant that made a physio level land
 * sooner would sell training pace in two hops. `empireCore.ts` closes that with
 * a clock split, and this file uses that path rather than reasoning around it:
 *
 *   - Every build carries TWO completion times. `idleCompletion` is on
 *     `AcceleratedSeconds` — wall time plus every applied skip — and is what a
 *     screen, the Gym Bucks economy and `rosterCapacity` read through
 *     `idleAxesAt`. `settledCompletion` is on `UnacceleratedSeconds` and is
 *     what the physio hook reads through `settledAxisLevel`.
 *   - `skipExpansion` writes `idleCompletion` and copies `settledCompletion`
 *     across untouched. That holds for every accelerant, purchasable or earned,
 *     rather than only for the ones §8.1 names.
 *   - `physioDaysSavedAt` goes through `settledLevel` and `physioDaysSavedFor`,
 *     both of which take branded wall-clock arguments. There is no cast here
 *     and no bare number on that path.
 *   - `axisReputationRule` exempts the physio ladder from the reputation gate
 *     entirely. Reputation accrues per check-in (`REPUTATION_PER_CHECK_IN`), so
 *     a gate on physio would make the day the hook arrives move with the
 *     player's own training schedule — GDD §4.4's laundered-path shape with a
 *     gate in place of a currency. The exemption is unconditional rather than
 *     true-at-today's-ceiling, and `axisReputationRule` is total (it answers
 *     above the ladder's top) so that the exemption is observable at levels the
 *     shipped `STAFF_LEVEL_MAX.physio` does not reach. Without that, a test of
 *     the exemption would be a check on a single level whose answer is 0 with
 *     the exemption and 0 without it — an assertion that cannot fail.
 *
 * The chain that used to be an outstanding obligation here, and how it is
 * closed now. A purchased skip pays Gym Bucks sooner on the accelerated clock,
 * so the player could AFFORD the physio level on an earlier wall-clock day, and
 * `startExpansion` stamps `settledCompletion` from whatever
 * `clock.unaccelerated` it is handed. Every type on that chain is correct; what
 * moved with the purchase was a value, and GDD §4.4 is explicit that no type
 * gives you that.
 *
 * What closes it is `axisFunding` below: the purse a rung is bought from is
 * chosen the same way `elapsedFor` chooses a clock — from the reach of the
 * output the axis feeds, through `AXIS_OUTPUT` and
 * `WALL_CLOCK_FUNDED_OUTPUTS`. The physio rung is bought out of
 * `EmpireState.settledGymBucks`, which `accrueProduction` accrues at the
 * baseline line over the un-accelerated gap and which therefore no purchase
 * moves; the space and spotter rungs are on the same side because they feed
 * `'roster-slot'`, which `GATE_TARGET` says gates Training IQ. A
 * wall-clock-funded rung is also READ on the wall clock — `settledAxesAt` for
 * its level and `settledBuildInFlight` for the rung it is building — because a
 * skip that cleared level N early would otherwise let level N+1 start early.
 *
 * What is measured, and where, stated exactly rather than as a promise:
 *
 *   - `expansion.test.ts` measures the half in this file's gift — the skip
 *     moving nothing on the settled clock, the physio series byte-identical
 *     under every accelerant that can reach it, and the wall-clock ladder held
 *     to the wall clock while it is building — each with a control beside it.
 *   - `empireInvariant.test.ts` measures the composition: for every purchasable
 *     accelerant, on every application schedule, at every horizon, the
 *     `physioDaysSavedAt` series and its arrival-day list, element by element,
 *     on the gym the accelerant landed on, against the same grid funded from
 *     the accelerated book as the control. That file's header records which
 *     mutants it kills and which two it does not.
 *
 * ===========================================================================
 * 3. Two exported functions take a bare level, and why the house guard is not
 *    on them
 * ===========================================================================
 *
 * `empireCore.ts` puts `Unbranded<N>` on every parameter of a brand-producing
 * function that accepts a raw primitive, so an accelerated clock reading cannot
 * be laundered into a wall-clock argument. `Unbranded` is not exported from
 * that module, so the guard cannot be written here.
 *
 * The two slots it would cover are `axisLevelCost(level)` and
 * `axisReputationRule(level)`, both of which take a ladder level and produce
 * `GymBucks` / `ReputationPoints`. Neither brand is a clock quantity, and
 * nothing on the physio path reaches them. Every function here that produces or
 * consumes a clock brand takes a brand rather than a number, which is the
 * property that matters and which `expansion.test.ts` pins by scanning this
 * file's own signatures. Exporting `Unbranded` from `empireCore.ts` would let
 * the two remaining slots be guarded the same way as their siblings; that is a
 * request in this piece's report, not an edit made here.
 */

import {
  EARNED_ACCELERANTS,
  GATING_OUTPUTS,
  PURCHASABLE_ACCELERANTS,
  WALL_CLOCK_FUNDED_OUTPUTS,
  asAcceleratedSeconds,
  asGymBucks,
  asReputation,
  asUnacceleratedSeconds,
  buildSeconds,
  equipmentTierCost,
  isEmpireOutput,
  mayAccelerate,
  outputReach,
  physioDaysSavedFor,
  settledLevel,
  spaceLevelCost,
  staffLevelCost,
  type AcceleratedSeconds,
  type AppliedAccelerant,
  type EmpireClock,
  type EmpireOutput,
  type EmpireState,
  type EquipmentTier,
  type GymAxes,
  type GymBucks,
  type InjuryDaysSaved,
  type ReputationPoints,
  type SettledLevel,
  type StaffRole,
  type UnacceleratedSeconds,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// The axes
// ---------------------------------------------------------------------------

/**
 * One of GDD §5.4's buildable axes.
 *
 * The staff arm is `StaffRole` itself rather than a wrapper, so a role added to
 * `STAFF_ROLES` is an axis without a second list having to be edited. The two
 * flat members are the axes §5.4 names that are not staff. `EXPANSION_AXES`
 * checks the two halves stay disjoint at runtime, because a role spelled
 * `'space'` would silently shadow the space ladder.
 */
export type ExpansionAxis = 'equipment' | 'space' | StaffRole;

/** Every axis, derived from the staff roles rather than restating them. */
export const EXPANSION_AXES: readonly ExpansionAxis[] = Object.freeze([
  'equipment',
  'space',
  ...EMPIRE_TUNING.STAFF_ROLES,
]);

/** Narrows an unknown wire value to an axis. */
export function isExpansionAxis(value: unknown): value is ExpansionAxis {
  return (EXPANSION_AXES as readonly unknown[]).includes(value);
}

/** True for an axis that is one of §5.4's staff roles. */
export function isStaffAxis(axis: ExpansionAxis): axis is StaffRole {
  return (EMPIRE_TUNING.STAFF_ROLES as readonly string[]).includes(axis);
}

/**
 * The `EmpireOutput` each axis feeds, so an axis inherits a reach verdict
 * instead of carrying an opinion of its own.
 *
 * This is the seam that makes the physio ban structural rather than a branch:
 * `'physio-days-saved'` reaches `'training-pace'` in `empireCore.ts`'s tables,
 * so `mayAccelerate` refuses every purchasable accelerant against it and
 * `applyAccelerant` will not build the pairing. Re-pointing this row at
 * `'gym-bucks'` is the single edit that would open it, and
 * `expansionVocabularyFaults` reports that edit rather than leaving it to a
 * reader.
 *
 * The space row is `'roster-slot'` for §5.4's "more racks, platforms, NPC
 * slots"; the axis also raises the passive Bucks ceiling, and both outputs are
 * idle-only, so the verdict does not turn on which of the two is named.
 */
export const AXIS_OUTPUT = {
  equipment: 'gym-bucks',
  space: 'roster-slot',
  coach: 'gym-bucks',
  spotter: 'roster-slot',
  physio: 'physio-days-saved',
} as const satisfies Readonly<Record<ExpansionAxis, EmpireOutput>>;

/** The output an axis feeds. */
export function axisOutput(axis: ExpansionAxis): EmpireOutput {
  return AXIS_OUTPUT[axis];
}

/** Which of the gym's two books pays for a rung, and which clock reads it. */
export const AXIS_FUNDINGS = ['wall-clock', 'idle-clock'] as const;

export type AxisFunding = (typeof AXIS_FUNDINGS)[number];

/**
 * Which book buys the next level of an axis — the answer to §2 of the header's
 * outstanding obligation, and it is derived rather than declared.
 *
 * `AXIS_OUTPUT` says what an axis feeds; `WALL_CLOCK_FUNDED_OUTPUTS` says which
 * outputs may only be bought with money a purchase cannot have moved. So the
 * physio row is wall-clock funded because it feeds `'physio-days-saved'`, and
 * the space and spotter rows are because they feed `'roster-slot'`, which
 * `GATE_TARGET` says gates Training IQ. There is no list of axes here to fall
 * out of step with the list of outputs: re-pointing `AXIS_OUTPUT.physio` at
 * `'gym-bucks'` moves the physio row to the idle book AND is the edit
 * `expansionVocabularyFaults` already reports.
 *
 * A wall-clock-funded axis is read on the wall clock too — its current level
 * comes from `settledAxesAt` and its in-flight build from
 * `settledBuildInFlight`. Both halves are load-bearing and the second one is
 * the one that is easy to leave out: a purchased skip that finished level N
 * early would otherwise let level N+1 START early, which moves the wall-clock
 * day the next rung lands on even though the purse it is bought from did not
 * move.
 */
export function axisFunding(axis: ExpansionAxis): AxisFunding {
  return WALL_CLOCK_FUNDED_OUTPUTS.includes(axisOutput(axis)) ? 'wall-clock' : 'idle-clock';
}

// ---------------------------------------------------------------------------
// Ladders: level, ceiling, price, gate, timer
// ---------------------------------------------------------------------------

/**
 * The top level of an axis. Level 0 is the state a gym opens in on every axis,
 * so a ceiling of N means N purchases.
 */
export function axisCeiling(axis: ExpansionAxis): number {
  if (axis === 'equipment') return EMPIRE_TUNING.EQUIPMENT_TIERS.length - 1;
  if (axis === 'space') return EMPIRE_TUNING.SPACE_LEVEL_MAX;
  return EMPIRE_TUNING.STAFF_LEVEL_MAX[axis];
}

/** The level an axis currently sits at, read off the idle-clock view. */
export function axisLevel(axes: GymAxes, axis: ExpansionAxis): number {
  if (axis === 'equipment') {
    const at = EMPIRE_TUNING.EQUIPMENT_TIERS.indexOf(axes.equipment);
    return at < 0 ? 0 : at;
  }
  if (axis === 'space') return axes.spaceLevel;
  return axes.staffLevel[axis];
}

/**
 * Gym Bucks price of raising an axis to `level`, or `null` when `level` is off
 * that ladder.
 *
 * Every axis is 1-indexed here: level 0 is what a gym opens with and is not a
 * purchase, so it prices at `null` rather than at zero. That keeps "is this a
 * step somebody can buy" and "what does it cost" one question instead of two,
 * and it is the single predicate the timer and the gate below are derived from.
 */
export function axisLevelCost(axis: ExpansionAxis, level: number): GymBucks | null {
  if (!Number.isInteger(level) || level < 1 || level > axisCeiling(axis)) return null;
  if (axis === 'equipment') {
    const tier: EquipmentTier | undefined = EMPIRE_TUNING.EQUIPMENT_TIERS[level];
    return tier === undefined ? null : equipmentTierCost(tier);
  }
  if (axis === 'space') return spaceLevelCost(level);
  return staffLevelCost(axis, level);
}

/**
 * The reputation gate, as a total function of level — it answers above the
 * ladder's ceiling too.
 *
 * The rule: a level may be started once the gym has reached the reputation tier
 * one below it, so level 1 is ungated, level 2 wants tier 1, and so on, holding
 * at the top tier once the ladder runs past the tier list.
 *
 * Physio is exempt on every level. See §2 of the header: reputation is earned
 * per check-in, so a gate on the physio ladder would tie the day a Sim setback
 * gets shorter to how often the player trained, and GDD §4.4's rule is about
 * the mechanism rather than about which currency it is denominated in.
 *
 * Total rather than nullable so that exemption is observable. At the shipped
 * `STAFF_LEVEL_MAX.physio` of 1 the ladder holds exactly one level, whose
 * ungated answer is 0 anyway — so a check confined to the ladder would pass
 * identically with the exemption deleted. `axisReputationRequirement` is the
 * ladder-aware wrapper for callers.
 */
export function axisReputationRule(axis: ExpansionAxis, level: number): ReputationPoints {
  if (axis === 'physio') return asReputation(0);
  const thresholds = EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS;
  const highest = thresholds.length - 1;
  const at = Math.min(Math.max(0, level - 1), highest);
  const threshold: number | undefined = thresholds[at];
  return asReputation(threshold === undefined ? 0 : threshold);
}

/** The gate for a level that is actually on the ladder, or `null` if it is not. */
export function axisReputationRequirement(
  axis: ExpansionAxis,
  level: number,
): ReputationPoints | null {
  if (axisLevelCost(axis, level) === null) return null;
  return axisReputationRule(axis, level);
}

/**
 * How long the build for `level` takes, or `null` when the level is off the
 * ladder. Derived from `axisLevelCost` so "buildable" has one definition.
 */
export function axisBuildSeconds(axis: ExpansionAxis, level: number): number | null {
  if (axisLevelCost(axis, level) === null) return null;
  return buildSeconds(level);
}

// ---------------------------------------------------------------------------
// Quotes, verdicts and refusals
// ---------------------------------------------------------------------------

/** Everything a screen needs about the next step on an axis. */
export interface ExpansionQuote {
  readonly axis: ExpansionAxis;
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly cost: GymBucks;
  readonly reputationRequired: ReputationPoints;
  readonly seconds: number;
}

/**
 * The next step on an axis, or `null` when the axis is at its ceiling.
 *
 * Reads the level off the idle-clock view, because that is the gym the player
 * is looking at. The physio hook does not come through here — it reads
 * `settledAxisLevel`.
 */
export function quoteExpansion(axes: GymAxes, axis: ExpansionAxis): ExpansionQuote | null {
  const fromLevel = axisLevel(axes, axis);
  const toLevel = fromLevel + 1;
  const cost = axisLevelCost(axis, toLevel);
  const seconds = axisBuildSeconds(axis, toLevel);
  const reputationRequired = axisReputationRequirement(axis, toLevel);
  if (cost === null || seconds === null || reputationRequired === null) return null;
  return Object.freeze({ axis, fromLevel, toLevel, cost, reputationRequired, seconds });
}

/** Why a level-up was refused. There is no "probably not". */
export const EXPANSION_REFUSALS = [
  /** The axis has no level above the one it is on. */
  'at-ceiling',
  /** A build on this axis has not finished. One at a time, per axis. */
  'already-building',
  /** The gym has not reached the reputation tier this level is gated behind. */
  'not-enough-reputation',
  /** The price is above the balance. */
  'not-enough-gym-bucks',
  /**
   * The price is above the WALL-CLOCK book, on an axis that may only be bought
   * out of it.
   *
   * Its own row rather than a second use of the one above, because the two are
   * true of different screens: a gym refused here may be holding ten times the
   * price in Gym Bucks. The refusal a player reads has to be true of the gym
   * they are looking at — CLAUDE.md's rule about `renderedOffer`, one subsystem
   * over.
   */
  'not-enough-wall-clock-earnings',
] as const;

export type ExpansionRefusal = (typeof EXPANSION_REFUSALS)[number];

export type ExpansionVerdict =
  | { readonly allowed: true; readonly quote: ExpansionQuote }
  | { readonly allowed: false; readonly refusal: ExpansionRefusal };

// ---------------------------------------------------------------------------
// Builds and the two clocks
// ---------------------------------------------------------------------------

/**
 * One started build.
 *
 * Two completion times, and the split is the whole point — see §2 of the
 * header. `settledCompletion` is what the physio hook reads and nothing here
 * ever writes it after `startExpansion` stamps it; `idleCompletion` is what the
 * player's gym runs on and is what `skipExpansion` moves.
 */
export interface ExpansionBuild {
  readonly axis: ExpansionAxis;
  readonly toLevel: number;
  readonly paid: GymBucks;
  readonly startedAt: UnacceleratedSeconds;
  readonly settledCompletion: UnacceleratedSeconds;
  readonly idleCompletion: AcceleratedSeconds;
}

/** Everything a level-up decision reads. */
export interface ExpansionContext {
  readonly clock: EmpireClock;
  readonly gymBucks: GymBucks;
  /** The wall-clock book. The only money a wall-clock-funded rung may cost. */
  readonly settledGymBucks: GymBucks;
  readonly reputation: ReputationPoints;
  readonly builds: readonly ExpansionBuild[];
}

/** An `ExpansionContext` from an `EmpireState` and the builds it has started. */
export function expansionContext(
  state: EmpireState,
  builds: readonly ExpansionBuild[],
): ExpansionContext {
  return Object.freeze({
    clock: state.clock,
    gymBucks: state.gymBucks,
    settledGymBucks: state.settledGymBucks,
    reputation: state.reputation,
    builds,
  });
}

/** The unfinished build on this axis at `now`, on the idle clock, or `null`. */
export function buildInFlight(
  builds: readonly ExpansionBuild[],
  axis: ExpansionAxis,
  now: AcceleratedSeconds,
): ExpansionBuild | null {
  for (const build of builds) {
    if (build.axis === axis && build.idleCompletion > now) return build;
  }
  return null;
}

/**
 * The same question on the wall clock: the build on this axis that would not
 * have finished yet with no accelerant applied.
 *
 * The sibling of the function above, and it exists because that one is the
 * wrong question for a wall-clock-funded axis. `skipExpansion` moves
 * `idleCompletion`, so a purchase clears `buildInFlight` early and the next rung
 * of the same ladder becomes startable on an earlier wall-clock day. Reading
 * `settledCompletion` here is what keeps a wall-clock-funded ladder's rungs on
 * the wall clock end to end.
 */
export function settledBuildInFlight(
  builds: readonly ExpansionBuild[],
  axis: ExpansionAxis,
  now: UnacceleratedSeconds,
): ExpansionBuild | null {
  for (const build of builds) {
    if (build.axis === axis && build.settledCompletion > now) return build;
  }
  return null;
}

/**
 * The axis levels as the player's gym reads them: every build whose
 * `idleCompletion` has passed, on the accelerated clock.
 *
 * A level is the highest `toLevel` among completed builds rather than a count
 * of them, so a duplicated or out-of-order build cannot inflate an axis, and it
 * is clamped to the ceiling so a malformed build cannot push one off its
 * ladder.
 */
export function idleAxesAt(builds: readonly ExpansionBuild[], now: AcceleratedSeconds): GymAxes {
  return axesWhere(builds, (build) => build.idleCompletion <= now);
}

/**
 * The same ladders as the wall clock reads them: every build whose
 * `settledCompletion` has passed.
 *
 * One implementation, two predicates — `idleAxesAt` is the same call with the
 * other completion time. Written that way deliberately: this codebase keeps
 * finding its next defect in the sibling of a function that was just fixed, and
 * a clamp or an ordering rule added to one of these two would otherwise have to
 * be remembered into the other.
 *
 * This is the view `rosterCapacity` is asked about when the question is when a
 * Training IQ payer may start arriving, and the view a wall-clock-funded axis
 * reads its own current level from.
 */
export function settledAxesAt(
  builds: readonly ExpansionBuild[],
  now: UnacceleratedSeconds,
): GymAxes {
  return axesWhere(builds, (build) => build.settledCompletion <= now);
}

/** The shared body of the two functions above. `finished` picks the clock. */
function axesWhere(
  builds: readonly ExpansionBuild[],
  finished: (build: ExpansionBuild) => boolean,
): GymAxes {
  const reached = (axis: ExpansionAxis): number => {
    let level = 0;
    for (const build of builds) {
      if (build.axis !== axis) continue;
      if (!finished(build)) continue;
      if (build.toLevel > level) level = build.toLevel;
    }
    return Math.min(Math.max(0, level), axisCeiling(axis));
  };
  const opening: EquipmentTier | undefined = EMPIRE_TUNING.EQUIPMENT_TIERS[0];
  const equipment: EquipmentTier | undefined = EMPIRE_TUNING.EQUIPMENT_TIERS[reached('equipment')];
  const staffLevel: Record<StaffRole, number> = {
    coach: reached('coach'),
    spotter: reached('spotter'),
    physio: reached('physio'),
  };
  return Object.freeze({
    equipment: equipment ?? (opening as EquipmentTier),
    spaceLevel: reached('space'),
    staffLevel: Object.freeze(staffLevel),
  });
}

/**
 * The level of an axis on the wall clock — how many of its builds would have
 * finished with no accelerant applied.
 *
 * Goes through `empireCore.ts`'s `settledLevel`, whose arguments are both
 * `UnacceleratedSeconds`, so a caller holding an accelerated reading has
 * nothing to pass. This is the only route the physio hook takes.
 */
export function settledAxisLevel(
  builds: readonly ExpansionBuild[],
  axis: ExpansionAxis,
  now: UnacceleratedSeconds,
): SettledLevel {
  const completions: UnacceleratedSeconds[] = [];
  for (const build of builds) {
    if (build.axis === axis) completions.push(build.settledCompletion);
  }
  return settledLevel(completions, now);
}

/**
 * GDD §5.4's cross-mode hook: the days of Sim setback the gym's physio takes
 * off, as the argument `recordSession` takes as `physioDaysSaved`.
 *
 * Bounded by `PHYSIO_MAX_DAYS_SAVED` inside `physioDaysSavedFor`, which
 * `empireTuning.test.ts` in turn bounds against the real `FATIGUE_TUNING` so
 * the shortest setback the fatigue model can roll stays at or above
 * `INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO` without the model's own clamp having
 * to catch it. It shortens and never erases.
 */
export function physioDaysSavedAt(
  builds: readonly ExpansionBuild[],
  now: UnacceleratedSeconds,
): InjuryDaysSaved {
  return physioDaysSavedFor(settledAxisLevel(builds, 'physio', now));
}

// ---------------------------------------------------------------------------
// Buying a level
// ---------------------------------------------------------------------------

/**
 * Whether the gym may start the next level of an axis, and what it would cost.
 *
 * The refusal order is fixed and tested: ceiling, then an unfinished build,
 * then reputation, then money. Reputation before money because reputation is
 * the gate a player cannot buy their way past, so it is the more useful thing
 * for a screen to say first.
 */
export function expansionVerdict(
  context: ExpansionContext,
  axis: ExpansionAxis,
): ExpansionVerdict {
  // Which clock this axis is read on, and which book pays, are one decision and
  // it is taken here once. See `axisFunding`.
  const onWallClock = axisFunding(axis) === 'wall-clock';
  const axes = onWallClock
    ? settledAxesAt(context.builds, context.clock.unaccelerated)
    : idleAxesAt(context.builds, context.clock.accelerated);
  const quote = quoteExpansion(axes, axis);
  if (quote === null) return Object.freeze({ allowed: false, refusal: 'at-ceiling' });
  const inFlight = onWallClock
    ? settledBuildInFlight(context.builds, axis, context.clock.unaccelerated)
    : buildInFlight(context.builds, axis, context.clock.accelerated);
  if (inFlight !== null) {
    return Object.freeze({ allowed: false, refusal: 'already-building' });
  }
  if (context.reputation < quote.reputationRequired) {
    return Object.freeze({ allowed: false, refusal: 'not-enough-reputation' });
  }
  if (onWallClock) {
    if (context.settledGymBucks < quote.cost) {
      return Object.freeze({ allowed: false, refusal: 'not-enough-wall-clock-earnings' });
    }
  } else if (context.gymBucks < quote.cost) {
    return Object.freeze({ allowed: false, refusal: 'not-enough-gym-bucks' });
  }
  return Object.freeze({ allowed: true, quote });
}

export type ExpansionStart =
  | {
      readonly started: true;
      readonly build: ExpansionBuild;
      /** The accelerated book after the price has been taken, if it paid. */
      readonly gymBucks: GymBucks;
      /** The wall-clock book after the price has been taken, if it paid. */
      readonly settledGymBucks: GymBucks;
    }
  | { readonly started: false; readonly refusal: ExpansionRefusal };

/**
 * Start the next level of an axis: consume the price from the cost table and
 * stamp both completion times.
 *
 * The two stamps are taken from the two readings of the same clock, so the
 * settled one carries no skip that has already been applied. What it cannot
 * do is know whether a skip moved the DAY this was called on — that chain is
 * §2 of the header and belongs to piece E6's sweep.
 *
 * Returns the balance that remains rather than writing one. Currency is
 * server-authoritative (CLAUDE.md); this is the arithmetic an Edge Function
 * would run, not a wallet write.
 *
 * (The wording of that first sentence is deliberate and is not a style tic.
 * The obvious phrasing — the adjective meaning "not old" in front of the noun
 * "balance" — collides with a real athletic brand, and `src/licensing/realIp.ts`
 * reddened on it. GDD §12.3 refuses a real company name in any code path, and
 * no reviewer skimming a docstring would have caught that one, so the sentence
 * moved rather than the inventory. The colliding phrase is deliberately not
 * written out here either, for the same reason.)
 */
export function startExpansion(context: ExpansionContext, axis: ExpansionAxis): ExpansionStart {
  const verdict = expansionVerdict(context, axis);
  if (!verdict.allowed) {
    return Object.freeze({ started: false, refusal: verdict.refusal });
  }
  const quote = verdict.quote;
  const build: ExpansionBuild = Object.freeze({
    axis,
    toLevel: quote.toLevel,
    paid: quote.cost,
    startedAt: context.clock.unaccelerated,
    settledCompletion: asUnacceleratedSeconds(context.clock.unaccelerated + quote.seconds),
    idleCompletion: asAcceleratedSeconds(context.clock.accelerated + quote.seconds),
  });
  // One book pays, and which one is the same decision the verdict took. The
  // other is handed back untouched rather than left out, so a caller assigns
  // both and cannot quietly keep a stale one.
  const onWallClock = axisFunding(axis) === 'wall-clock';
  return Object.freeze({
    started: true,
    build,
    gymBucks: onWallClock ? context.gymBucks : asGymBucks(context.gymBucks - quote.cost),
    settledGymBucks: onWallClock
      ? asGymBucks(context.settledGymBucks - quote.cost)
      : context.settledGymBucks,
  });
}

/**
 * Apply an accelerant to a running build.
 *
 * Every field is copied by name rather than spread, so `settledCompletion`
 * being carried across untouched is a line a reader can point at instead of an
 * absence they have to notice. That holds for an earned accelerant as much as
 * for a bought one: nothing here moves the wall clock.
 *
 * Two refusals, and both are throws because a pairing this module has no
 * verdict for is a caller error rather than a state:
 *
 *   - the accelerant is aimed at an output this axis does not feed, which is
 *     how a skip bought for the coach queue would end up shortening a physio
 *     build;
 *   - the pairing itself is one `empireCore.ts` refuses. The compiler already
 *     refuses it at every call site written in TypeScript, and `applyAccelerant`
 *     throws on a decoded one, so this is the third statement of the same rule
 *     rather than the first — kept because a caller can always write a cast
 *     past a type, and GDD §12.3's first refusal condition is worth a throw.
 */
export function skipExpansion(build: ExpansionBuild, applied: AppliedAccelerant): ExpansionBuild {
  const wanted = axisOutput(build.axis);
  if (applied.output !== wanted) {
    throw new RangeError(
      `an accelerant aimed at ${String(applied.output)} may not be applied to the ` +
        `${build.axis} axis, which feeds ${wanted}`,
    );
  }
  if (!mayAccelerate(applied.accelerant, applied.output)) {
    throw new RangeError(
      `${String(applied.accelerant)} may not accelerate ${String(applied.output)}, ` +
        `which the ${build.axis} axis feeds`,
    );
  }
  return Object.freeze({
    axis: build.axis,
    toLevel: build.toLevel,
    paid: build.paid,
    startedAt: build.startedAt,
    settledCompletion: build.settledCompletion,
    idleCompletion: asAcceleratedSeconds(Math.max(0, build.idleCompletion - applied.seconds)),
  });
}

// ---------------------------------------------------------------------------
// The runtime shadow of the tables above
// ---------------------------------------------------------------------------

/**
 * Every invariant this module's own tables have to satisfy, as a list of
 * messages — the same shape as `empireVocabularyFaults` in `empireCore.ts`, and
 * for the same reason: a compile-time `satisfies` is graded by `tsc` and by
 * nothing vitest can redden.
 *
 * It does not re-derive `axisLevelCost` or `mayAccelerate`. An oracle that
 * recomputes its subject's own lookup cannot disagree with it.
 */
export function expansionVocabularyFaults(): readonly string[] {
  const faults: string[] = [];

  if (new Set(EXPANSION_AXES).size !== EXPANSION_AXES.length) {
    faults.push('the axis list holds a duplicate: a staff role is shadowing a flat axis');
  }

  for (const axis of EXPANSION_AXES) {
    if (!isEmpireOutput(axisOutput(axis))) {
      faults.push(`${axis} feeds ${String(axisOutput(axis))}, which is not an empire output`);
    }
    const ceiling = axisCeiling(axis);
    if (!Number.isInteger(ceiling) || ceiling < 1) {
      faults.push(`${axis} tops out at ${ceiling}, so it has no level anybody can buy`);
    }
    if (axisLevelCost(axis, ceiling) === null) {
      faults.push(`${axis} prices nothing at its own ceiling of ${ceiling}`);
    }
    if (axisLevelCost(axis, ceiling + 1) !== null) {
      faults.push(`${axis} prices a level above its ceiling of ${ceiling}`);
    }
  }

  // GDD §5.4's physio row is the one axis that reaches Sim progression, and
  // §12.3 refuses a purchasable accelerant on it. Stated as a fault rather than
  // as a comment, because the edit that opens it is one word in `AXIS_OUTPUT`.
  const physioOutput = axisOutput('physio');
  if (outputReach(physioOutput) !== 'progression-reaching') {
    faults.push(
      `the physio axis feeds ${String(physioOutput)}, which no longer reaches Sim progression`,
    );
  }
  for (const accelerant of PURCHASABLE_ACCELERANTS) {
    if (mayAccelerate(accelerant, physioOutput)) {
      faults.push(`${accelerant} is purchasable and may accelerate the physio axis`);
    }
  }
  if (PURCHASABLE_ACCELERANTS.length === 0) {
    faults.push('nothing is purchasable, so the check above gates nothing');
  }
  if (EARNED_ACCELERANTS.length === 0) {
    faults.push('nothing is earned, so no accelerant is legal on any axis');
  }

  // Every other axis is idle-only, so a skip bought for it is a §8.3B sale
  // rather than a §8.1 breach. An axis that quietly acquired a
  // progression-reaching output would be the hazard arriving by the back door.
  for (const axis of EXPANSION_AXES) {
    if (axis === 'physio') continue;
    if (outputReach(axisOutput(axis)) !== 'idle-only') {
      faults.push(`${axis} feeds ${String(axisOutput(axis))}, which reaches Sim progression`);
    }
  }

  // Which book buys which rung, reported rather than described. Each of these
  // is reddened by an edit to a different table: the physio row by
  // `AXIS_OUTPUT` or `SINK_REACH`, the gating rows by `GATING_OUTPUTS`, and the
  // two counts by anything that empties either side of the split.
  if (axisFunding('physio') !== 'wall-clock') {
    faults.push('the physio axis is bought out of the accelerated book');
  }
  for (const axis of EXPANSION_AXES) {
    const gates = (GATING_OUTPUTS as readonly EmpireOutput[]).includes(axisOutput(axis));
    if (gates && axisFunding(axis) !== 'wall-clock') {
      faults.push(
        `${axis} feeds ${String(axisOutput(axis))}, which gates Sim progression, and is bought out of the accelerated book`,
      );
    }
  }
  const wallClockFunded = EXPANSION_AXES.filter((axis) => axisFunding(axis) === 'wall-clock');
  if (wallClockFunded.length === 0) {
    faults.push('no axis is bought out of the wall-clock book, so the split gates nothing');
  }
  if (wallClockFunded.length === EXPANSION_AXES.length) {
    faults.push('every axis is bought out of the wall-clock book, so the split separates nothing');
  }

  return faults;
}
