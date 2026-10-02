/**
 * npc.ts — GDD §5.2/§5.3: what one roster lifter produces, by tier and tenure.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock and no randomness. Time arrives as an
 * `EmpireClock` parameter. Its only imports are `./empireCore` and
 * `./empireTuning`, so every number it uses is named and in one place.
 *
 * ===========================================================================
 * 1. The one design decision in this file: which clock each half reads
 * ===========================================================================
 *
 * GDD §5.2 says an NPC lifter "generates Bucks/IQ based on tier and tenure",
 * one sentence covering two outputs. `empireCore.ts` splits the clock those two
 * outputs run on, and this file is where the split becomes arithmetic:
 *
 *   - Gym Bucks reads `IdleTenureDays` — time since the lifter appeared on the
 *     roster, on the accelerated clock. A purchased GDD §8.3B timer skip moves
 *     it, and that is what §8.3B sells: the lifter is on the roster now,
 *     customisable now, earning now.
 *   - Training IQ reads `SettledTenureDays` — time since the recruitment would
 *     have completed unaided, on the wall clock. Training IQ is GDD §2's stat
 *     for how well you train, so it reaches training pace, and §8.1 refuses
 *     anything purchasable that affects training pace.
 *
 * Three things hold the split here rather than the sentence you are reading:
 *
 *   1. Neither rate takes a clock reading. Both take an `EmpireClock` and route
 *      through `elapsedFor(clock, <output>)`, so which reading a rate gets is
 *      decided by `empireCore.ts`'s reach tables under the output's own name,
 *      not by a choice made at this call site. Swapping `'training-iq'` for
 *      `'gym-bucks'` inside `npcTrainingIqPerDay` is a type error, because
 *      `settledTenureDays` refuses an `AcceleratedSeconds`.
 *   2. The two loyalty multipliers are separate exported functions taking the
 *      two tenure brands, so a caller holding an idle tenure has nothing to
 *      pass to the settled one. `loyaltyFromDays` is the shared curve and is
 *      not exported — an exported bare-number version would be the one-call
 *      route between the brands, which is the walk-around `Unbranded` exists to
 *      close on the raw clocks.
 *   3. Neither of those is a measurement, so `npc.test.ts` takes one: for every
 *      tier, at every horizon in `NPC_SWEEP`, the list of `npcTrainingIqPerDay`
 *      readings by wall-clock day is compared element-wise against the same
 *      list with a purchasable skip applied, with a negative control beside it
 *      wired so the skip does move the reading, and both counts pinned. GDD
 *      §4.4 is explicit that no type gives you the second reading of
 *      "structurally unable" and that an aggregate will not do.
 *
 * ===========================================================================
 * 2. The tenure/loyalty curve
 * ===========================================================================
 *
 *   loyalty(d) = MIN + (MAX - MIN) * clamp01(d / DAYS_TO_FULL) ** EXPONENT
 *
 * with `NPC_LOYALTY_MIN_MULTIPLIER`, `NPC_LOYALTY_MAX_MULTIPLIER`,
 * `NPC_TENURE_DAYS_TO_FULL_LOYALTY` and `NPC_LOYALTY_CURVE_EXPONENT` all in
 * `empireTuning.ts`. The exponent is below 1 at the shipped tuning, which
 * front-loads the payoff so a new lifter's first week is felt; the ceiling
 * stops tenure paying forever, so the roster stays a live decision.
 *
 * None of those magnitudes has been played. GDD §12.1 puts feel tuning after
 * the run, by hand; the claim made for the shape is only that it is monotone
 * non-decreasing in tenure, continuous, and bounded by the two multipliers —
 * which `npc.test.ts` re-derives rather than restates.
 *
 * ===========================================================================
 * 3. What this file deliberately does not do
 * ===========================================================================
 *
 *   - It does not apply `TRAINING_IQ_DAILY_CEILING`. That budget is stated as
 *     the most one calendar day of idle may pay "however large the gym", and a
 *     gym total is the base trickle plus this roster subtotal. Capping the
 *     subtotal here would leave the sum above the ceiling anyway, so the cap
 *     belongs where the two are composed. `rosterTrainingIqPerDay` returns an
 *     uncapped subtotal and is named as an obligation handed to the production
 *     piece rather than as a property this file enforces.
 *   - It does not pay reputation. `REPUTATION_PER_NPC_TENURE_DAY` is §5.4's
 *     axis and belongs with the axis piece.
 *   - It holds no name table. GDD §12.3 refuses a real, named athlete in any
 *     string or code path, so whatever piece supplies default display names
 *     supplies fictional placeholders and gets checked name by name. There is
 *     no proper noun anywhere in this module.
 */

import {
  elapsedFor,
  idleTenureDays,
  settledTenureDays,
  type EmpireClock,
  type IdleTenureDays,
  type NpcLifter,
  type NpcTier,
  type SettledTenureDays,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// Arithmetic shared by both halves
// ---------------------------------------------------------------------------

/**
 * Scrub IEEE-754 noise to `PRECISION_DECIMALS`, so two accruals that are equal
 * in the design compare equal in the engine. `10 **` is the round-to-N-decimals
 * idiom the repository's magic-number audit lists as structural.
 */
function scrub(value: number): number {
  const scale = 10 ** EMPIRE_TUNING.PRECISION_DECIMALS;
  return Math.round(value * scale) / scale;
}

/**
 * The §5.3 loyalty curve, on a bare day count.
 *
 * Not exported, and that is the fence rather than the tidiness: the two
 * exported wrappers below take the two tenure brands, and a bare-number version
 * in the public API would let a caller holding an accelerated tenure reach the
 * Training IQ half in one call.
 *
 * A tuning pass that set `NPC_TENURE_DAYS_TO_FULL_LOYALTY` to zero would make
 * `days / 0` produce `Infinity` for a lifter with tenure and `NaN` for one on
 * their first instant, so the degenerate ladder is answered here rather than
 * left to produce a `NaN` rate: with no ramp to climb, everyone is at the
 * ceiling.
 */
function loyaltyFromDays(days: number): number {
  const floor = EMPIRE_TUNING.NPC_LOYALTY_MIN_MULTIPLIER;
  const ceiling = EMPIRE_TUNING.NPC_LOYALTY_MAX_MULTIPLIER;
  const toFull = EMPIRE_TUNING.NPC_TENURE_DAYS_TO_FULL_LOYALTY;
  if (!(toFull > 0)) return ceiling;
  const normalised = Math.min(1, Math.max(0, days) / toFull);
  return scrub(floor + (ceiling - floor) * normalised ** EMPIRE_TUNING.NPC_LOYALTY_CURVE_EXPONENT);
}

// ---------------------------------------------------------------------------
// Tier and loyalty, as the two deterministic multipliers §5.3 asks for
// ---------------------------------------------------------------------------

/**
 * The tier's output multiplier, applied to both halves.
 *
 * A table read by the tier the caller named, and nothing else: no selection, no
 * tier the caller did not ask for, no input that is not the tier. GDD §5.3's
 * "output scales deterministically with gym tier + tenure/loyalty, not luck".
 */
export function npcTierOutputMultiplier(tier: NpcTier): number {
  return EMPIRE_TUNING.NPC_TIER_OUTPUT_MULTIPLIER[tier];
}

/** The loyalty curve on the accelerated clock. The Gym Bucks half reads this. */
export function idleLoyaltyMultiplier(tenure: IdleTenureDays): number {
  return loyaltyFromDays(tenure);
}

/**
 * The loyalty curve on the wall clock. The Training IQ half reads this.
 *
 * Takes `SettledTenureDays`, which `empireCore.ts` gives no exported
 * constructor, so the only route to an argument for this function is
 * `settledTenureDays(lifter, now: UnacceleratedSeconds)`.
 */
export function settledLoyaltyMultiplier(tenure: SettledTenureDays): number {
  return loyaltyFromDays(tenure);
}

// ---------------------------------------------------------------------------
// Per-lifter output
// ---------------------------------------------------------------------------

/** One lifter's two rates, in the units their names give. */
export interface NpcOutputRates {
  readonly gymBucksPerHour: number;
  readonly trainingIqPerDay: number;
}

/**
 * Gym Bucks per hour from one lifter.
 *
 * Reads the accelerated clock, through `elapsedFor(clock, 'gym-bucks')`, so a
 * purchased skip does move it — which is the legal half of GDD §8.3B and is
 * asserted legal rather than merely permitted.
 */
export function npcGymBucksPerHour(lifter: NpcLifter, clock: EmpireClock): number {
  const tenure = idleTenureDays(lifter, elapsedFor(clock, 'gym-bucks'));
  return scrub(
    EMPIRE_TUNING.NPC_GYM_BUCKS_PER_HOUR_BASE *
      npcTierOutputMultiplier(lifter.tier) *
      idleLoyaltyMultiplier(tenure),
  );
}

/**
 * Training IQ per calendar day from one lifter.
 *
 * Reads the wall clock, through `elapsedFor(clock, 'training-iq')` and
 * `settledTenureDays`, so neither the argument nor the origin moves with a
 * purchase. The element-wise sweep in `npc.test.ts` is the measurement; this
 * paragraph is the intent.
 */
export function npcTrainingIqPerDay(lifter: NpcLifter, clock: EmpireClock): number {
  const tenure = settledTenureDays(lifter, elapsedFor(clock, 'training-iq'));
  return scrub(
    EMPIRE_TUNING.NPC_TRAINING_IQ_PER_DAY_BASE *
      npcTierOutputMultiplier(lifter.tier) *
      settledLoyaltyMultiplier(tenure),
  );
}

/** Both rates for one lifter, so a screen reads the roster once. */
export function npcOutputRates(lifter: NpcLifter, clock: EmpireClock): NpcOutputRates {
  return Object.freeze({
    gymBucksPerHour: npcGymBucksPerHour(lifter, clock),
    trainingIqPerDay: npcTrainingIqPerDay(lifter, clock),
  });
}

// ---------------------------------------------------------------------------
// Roster subtotals
// ---------------------------------------------------------------------------

/** The roster's Gym Bucks subtotal, per hour. */
export function rosterGymBucksPerHour(roster: readonly NpcLifter[], clock: EmpireClock): number {
  let total = 0;
  for (const lifter of roster) total += npcGymBucksPerHour(lifter, clock);
  return scrub(total);
}

/**
 * The roster's Training IQ subtotal, per calendar day, uncapped.
 *
 * `TRAINING_IQ_DAILY_CEILING` is a budget on the gym total rather than on this
 * subtotal — see §3 of the header. The piece that adds the base trickle to this
 * number is the one that applies the ceiling.
 */
export function rosterTrainingIqPerDay(roster: readonly NpcLifter[], clock: EmpireClock): number {
  let total = 0;
  for (const lifter of roster) total += npcTrainingIqPerDay(lifter, clock);
  return scrub(total);
}

/** Both subtotals, walked once. */
export function rosterOutputRates(
  roster: readonly NpcLifter[],
  clock: EmpireClock,
): NpcOutputRates {
  return Object.freeze({
    gymBucksPerHour: rosterGymBucksPerHour(roster, clock),
    trainingIqPerDay: rosterTrainingIqPerDay(roster, clock),
  });
}
