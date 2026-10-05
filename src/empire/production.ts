/**
 * production.ts — GDD §5.1's "time passes -> resources generate" and §5.2's
 * production table, as pure arithmetic over a clock that is a parameter.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock reading and no randomness. Its two imports
 * are `./empireCore` and `./empireTuning`, so every magnitude it uses is named
 * and lives in one place.
 *
 * ===========================================================================
 * 1. What this piece owns and what it does not
 * ===========================================================================
 *
 * It owns three things:
 *
 *   - the aggregation, GDD §5.2: the gym's base passive line plus each roster
 *     lifter's contribution, per output;
 *   - the accrual, GDD §5.1: how much of each output a gap between two check-ins
 *     pays;
 *   - the offline-earnings cap, GDD §5.1: "standard offline-earnings cap so it
 *     rewards check-ins without punishing a 10-hour gap".
 *
 * It does not own how one lifter's own rate is computed. That is piece E2, and
 * the two meet at `RosterRateSource` rather than at an implementation: this file
 * computes each lifter's tenure — on the clock that lifter's output is entitled
 * to — and hands it over. See §3 for why that direction matters.
 *
 * ===========================================================================
 * 2. The clock split, used rather than restated
 * ===========================================================================
 *
 * `empireCore.ts` §4 splits elapsed time in two: `EmpireClock.accelerated` is
 * wall time plus every purchased skip, `EmpireClock.unaccelerated` is wall time
 * and nothing writes to it. Gym Bucks run on the first, Training IQ on the
 * second, because §8.3B sells "Gym Empire build and recruit timer skips" and §2
 * makes Training IQ the stat that decides growth rate and long-term ceiling —
 * so a purchase that moved Training IQ is §8.1's refusal condition in two hops.
 *
 * Every reading here goes through `elapsedFor(clock, output)`, which returns the
 * brand the output's reach entitles it to. Nothing in this file reaches into
 * `clock.accelerated` or `clock.unaccelerated` by name.
 *
 * The split has a third quantity since piece E6: `ProductionAccrual.
 * settledGymBucks`, the WALL-CLOCK line. Gym Bucks are idle-only as a PAYOUT
 * and a purchase may move them, which is what §8.3B sells — but the same money
 * buys the physio rung and the recruits, and those reach Sim progression. So
 * the gym keeps its wall-clock money apart from its accelerated money, and this
 * file accrues the wall-clock line at `settledGymBucksRatePerHour` over the
 * un-accelerated gap. See that function for why the line it accrues on carries
 * no roster term and no axis multiplier, and `empireCore.ts`'s
 * `WALL_CLOCK_FUNDED_OUTPUTS` for which purchases may draw on it.
 *
 * Since GDD §5.4's third-book ruling the wall-clock side is a purse per funded
 * output rather than one balance, and this number is what ONE gap pays into
 * EACH of them — the rate reads no state, so there is one number rather than a
 * record, and `stepGym` is where it is credited to every purse. What the split
 * changes is where the money may go, not how fast it arrives, which is why
 * nothing in this file had to learn about it.
 *
 * ===========================================================================
 * 3. The roster filter, which is the part the types do not give you
 * ===========================================================================
 *
 * The brands stop an accelerated reading being handed to the Training IQ rate.
 * They do not stop a lifter being on the roster earlier than they would have
 * been, which is precisely what a bought recruit skip does — `NpcLifter.joinedAt`
 * moves and `NpcLifter.settledAt` does not.
 *
 * `settledTenureDays` floors at zero, so a lifter whose recruitment has not
 * settled yet reads as tenure zero rather than as absent, and a rate evaluated
 * at tenure zero is still a positive rate. That is the leak: the purchase would
 * have bought Training IQ from a lifter who has not arrived on the wall clock.
 *
 * So `trainingIqRatePerDay` skips any lifter whose `settledAt` is after the
 * un-accelerated reading, and `gymBucksRatePerHour` skips any lifter whose
 * `joinedAt` is after the accelerated reading. The first of those two is the
 * one carrying the §8.1 load; the second is its sibling and is written the
 * same way deliberately, because this codebase keeps finding the next gap in the
 * branch immediately below a fixed one.
 *
 * `production.test.ts` measures both, and measures them by comparing two states
 * that differ only in how much has been skipped rather than by reading this
 * paragraph.
 *
 * ===========================================================================
 * 4. The offline model, and what it deliberately leaves out
 * ===========================================================================
 *
 * A gap between two check-ins is treated as offline in full. `OFFLINE_EARNINGS_
 * FRACTION` therefore applies to every Gym Bucks accrual this file computes, and
 * a foreground tick at the undiscounted rate is a screen concern no piece owns
 * yet — `ProductionRates` is the undiscounted rate, exposed so that screen can
 * read it. This is a design decision rather than a transcription and is reported
 * as one.
 *
 * The cap has two properties and the second is not the first:
 *
 *   - accrual is non-decreasing in the gap, so a returning player is not worse
 *     off for having been away longer;
 *   - past the horizon it is flat, so the gap stops paying rather than starting
 *     to cost.
 *
 * Both are swept in `production.test.ts` across the horizon and well past it,
 * with the pair counts pinned and a negative control beside them.
 *
 * The horizon is `Math.max(OFFLINE_EARNINGS_CAP_HOURS, OFFLINE_EARNINGS_NO_
 * PUNISH_HOURS)` rather than the cap alone. GDD §5.1 names the ten-hour gap as
 * the thing the cap must not punish, and reading the floor here makes that
 * survive a tuning pass that lowers the cap under it instead of depending on a
 * separate test noticing. `empireTuning.test.ts` pins the ordering as well; the
 * two are belt and braces on a value a playtester will move.
 *
 * The offline cap touches the Gym Bucks line and does not touch Training IQ.
 * `OFFLINE_EARNINGS_FRACTION`'s own docstring says the fraction does not apply
 * to the trickle; the cap is left off for the same reason one step further on. A
 * cap on the trickle would make Training IQ a function of how often the player
 * checks in, and Training IQ reaches Sim training pace. The trickle's ceiling is
 * `TRAINING_IQ_DAILY_CEILING`, which is a ceiling on the RATE and not on the gap,
 * so it binds a large gym rather than a long absence.
 *
 * ===========================================================================
 * 5. Rates are evaluated at the collection mark, not at now
 * ===========================================================================
 *
 * `accrueProduction` reads the gym's rate as of `collectedAt` and applies it
 * across the whole gap. The alternative — integrating a rate that grows with
 * tenure — is more faithful and costs the plateau: past the horizon the banked
 * seconds stop growing but a rate read at `now` keeps growing, so the accrual
 * creeps up forever and "the cap flattens it" stops being true.
 *
 * The cost is that a roster which crossed a loyalty step during the gap is paid
 * at its pre-gap rate. For a 30-60 second check-in loop against a 30-day loyalty
 * ramp that is small, and it is stated here rather than left to be discovered.
 *
 * ===========================================================================
 * 6. Optional parameters that default to the shipped tuning
 * ===========================================================================
 *
 * `quantiseElapsedSeconds`, `offlineBankingHorizonSeconds` and
 * `bankableOfflineSeconds` each take the tuning value they use as an optional
 * argument, defaulted from `EMPIRE_TUNING`. That is not a second home for a
 * knob — the shipped value is still the only one any caller supplies — it is so
 * the arithmetic can be driven at values the shipped tuning does not currently
 * reach. Without it the `Math.max` in the horizon is unreddenable: at the shipped
 * cap of twelve hours against a floor of ten, deleting it changes nothing, and a
 * check that no edit can fail is the shape CLAUDE.md's vacuity section is about.
 */

import {
  type AcceleratedSeconds,
  type EmpireClock,
  type EmpireLedgerEntry,
  type EmpireState,
  type GymBucks,
  type IdleTenureDays,
  type NpcLifter,
  type SettledTenureDays,
  type TrainingIqPoints,
  type UnacceleratedSeconds,
  asGymBucks,
  asTrainingIq,
  elapsedFor,
  idleTenureDays,
  settledTenureDays,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// Arithmetic shared by every rate below
// ---------------------------------------------------------------------------

const PRECISION_SCALE = 10 ** EMPIRE_TUNING.PRECISION_DECIMALS;

/**
 * Round to `EMPIRE_TUNING.PRECISION_DECIMALS`, so IEEE-754 noise does not make
 * two accruals that should be equal compare unequal.
 *
 * Non-decreasing, which the offline sweep depends on: rounding a monotone series
 * keeps it monotone.
 */
export function scrubPrecision(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`a production quantity must be finite, received ${value}.`);
  }
  return Math.round(value * PRECISION_SCALE) / PRECISION_SCALE;
}

/**
 * Drop the part of an elapsed span that does not fill a whole tick.
 *
 * `EMPIRE_TUNING.TICK_SECONDS` is the quantum production accrues in; quantising
 * is what makes two clients that ask at slightly different moments agree.
 * `tickSeconds` is an argument so the divisor can be driven at a value the
 * shipped tuning does not use — see §6 of the header.
 */
export function quantiseElapsedSeconds(
  seconds: number,
  tickSeconds: number = EMPIRE_TUNING.TICK_SECONDS,
): number {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError(`elapsed seconds must be finite and at or above zero, received ${seconds}.`);
  }
  if (!Number.isFinite(tickSeconds) || tickSeconds <= 0) {
    throw new RangeError(`tick seconds must be finite and above zero, received ${tickSeconds}.`);
  }
  return Math.floor(seconds / tickSeconds) * tickSeconds;
}

// ---------------------------------------------------------------------------
// The offline-earnings cap
// ---------------------------------------------------------------------------

/**
 * The two hours GDD §5.1's cap is made of.
 *
 * `capHours` is how much offline time banks; `noPunishHours` is the gap the
 * design promises not to charge for. Both are read, and the horizon is the
 * larger — see §4 of the header.
 */
export interface OfflineBankingPolicy {
  readonly capHours: number;
  readonly noPunishHours: number;
}

/** The shipped policy, straight off the tuning block. The only one any caller supplies. */
export const SHIPPED_OFFLINE_BANKING_POLICY: OfflineBankingPolicy = Object.freeze({
  capHours: EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS,
  noPunishHours: EMPIRE_TUNING.OFFLINE_EARNINGS_NO_PUNISH_HOURS,
});

/**
 * How many seconds of a gap can bank at all.
 *
 * The larger of the two hours in the policy, in seconds. A tuning pass that
 * drops the cap under the no-punish floor leaves the floor standing rather than
 * shortening the horizon under it.
 */
export function offlineBankingHorizonSeconds(
  policy: OfflineBankingPolicy = SHIPPED_OFFLINE_BANKING_POLICY,
): number {
  const { capHours, noPunishHours } = policy;
  if (!Number.isFinite(capHours) || capHours < 0) {
    throw new RangeError(`the offline cap must be a finite hour count, received ${capHours}.`);
  }
  if (!Number.isFinite(noPunishHours) || noPunishHours < 0) {
    throw new RangeError(
      `the no-punish floor must be a finite hour count, received ${noPunishHours}.`,
    );
  }
  return Math.max(capHours, noPunishHours) * EMPIRE_TUNING.SECONDS_PER_HOUR;
}

/**
 * The part of a gap that pays.
 *
 * Non-decreasing in `gapSeconds` and flat at the horizon: a longer absence is
 * never worth less than a shorter one, and past the horizon the extra time is
 * discarded rather than deducted.
 */
export function bankableOfflineSeconds(
  gapSeconds: number,
  policy: OfflineBankingPolicy = SHIPPED_OFFLINE_BANKING_POLICY,
): number {
  return Math.min(quantiseElapsedSeconds(gapSeconds), offlineBankingHorizonSeconds(policy));
}

// ---------------------------------------------------------------------------
// The seam with piece E2
// ---------------------------------------------------------------------------

/**
 * One roster lifter's own output, which piece E2 owns.
 *
 * Two functions rather than one, each taking the tenure brand its output is
 * entitled to. `SettledTenureDays` has no exported constructor — `empireCore`'s
 * `settledTenureDays` is the only route to one, and it takes the un-accelerated
 * clock — so an implementation of this interface cannot manufacture a settled
 * tenure from an accelerated reading. It can only be handed one, and this file
 * is what hands it over.
 *
 * Both return a plain number: Gym Bucks per hour, Training IQ per calendar day,
 * before the gym-wide multipliers and before the daily ceiling.
 */
export interface RosterRateSource {
  readonly gymBucksPerHour: (lifter: NpcLifter, tenure: IdleTenureDays) => number;
  readonly trainingIqPerDay: (lifter: NpcLifter, tenure: SettledTenureDays) => number;
}

/** The two rates a gym produces at, undiscounted by the offline fraction. */
export interface ProductionRates {
  readonly gymBucksPerHour: number;
  readonly trainingIqPerDay: number;
}

/** A rate arriving from piece E2 is validated at the seam, where the message can name it. */
function requireRate(value: number, lifter: NpcLifter, what: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(
      `roster rate source returned ${value} ${what} for lifter id ${String(lifter.id)}, ` +
        `which is not a rate`,
    );
  }
  return value;
}

/** GDD §5.4's "raises passive ceiling", by space level. Loud on a level off the ladder. */
function spacePassiveMultiplier(spaceLevel: number): number {
  const multiplier = EMPIRE_TUNING.SPACE_PASSIVE_CEILING_MULTIPLIER[spaceLevel];
  if (multiplier === undefined) {
    throw new RangeError(`space level ${spaceLevel} is off the passive-ceiling ladder`);
  }
  return multiplier;
}

// ---------------------------------------------------------------------------
// Aggregation — GDD §5.2
// ---------------------------------------------------------------------------

/**
 * Gym Bucks per hour at the clock reading `at`.
 *
 * The base passive line plus every lifter who has joined by then, all of it
 * multiplied by the three §5.4 axes that raise Gym Bucks: equipment tier, space
 * level and coach staff level. Each of those is bought with Gym Bucks and each
 * of their build timers is skippable, which is exactly why none of them appears
 * in the trickle below.
 */
export function gymBucksRatePerHour(
  state: EmpireState,
  at: EmpireClock,
  roster: RosterRateSource,
): number {
  const now: AcceleratedSeconds = elapsedFor(at, 'gym-bucks');
  let fromRoster = 0;
  for (const lifter of state.roster) {
    if (lifter.joinedAt > now) continue;
    fromRoster += requireRate(
      roster.gymBucksPerHour(lifter, idleTenureDays(lifter, now)),
      lifter,
      'gym bucks per hour',
    );
  }
  const axisMultiplier =
    EMPIRE_TUNING.EQUIPMENT_TIER_BUCKS_MULTIPLIER[state.axes.equipment] *
    spacePassiveMultiplier(state.axes.spaceLevel) *
    (1 + EMPIRE_TUNING.STAFF_COACH_BUCKS_MULTIPLIER_PER_LEVEL * state.axes.staffLevel.coach);
  return scrubPrecision((EMPIRE_TUNING.GYM_BUCKS_BASE_PER_HOUR + fromRoster) * axisMultiplier);
}

/**
 * The GDD §5.2 Training IQ trickle, per calendar day, at the clock reading `at`.
 *
 * The base trickle plus every lifter whose recruitment has settled on the wall
 * clock, capped by `TRAINING_IQ_DAILY_CEILING`. No §5.4 axis multiplies this
 * line; see §3 and §4 of the header for both halves of the reason.
 */
export function trainingIqRatePerDay(
  state: EmpireState,
  at: EmpireClock,
  roster: RosterRateSource,
): number {
  const now: UnacceleratedSeconds = elapsedFor(at, 'training-iq');
  let fromRoster = 0;
  for (const lifter of state.roster) {
    // A lifter a purchased skip put on the roster early has not settled yet, and
    // an unsettled lifter pays no trickle. `settledTenureDays` floors at zero
    // rather than reporting absence, so without this the rate at tenure zero
    // would be paid from the moment the skip landed.
    if (lifter.settledAt > now) continue;
    fromRoster += requireRate(
      roster.trainingIqPerDay(lifter, settledTenureDays(lifter, now)),
      lifter,
      'training iq per day',
    );
  }
  const raw = EMPIRE_TUNING.TRAINING_IQ_BASE_PER_DAY + fromRoster;
  return scrubPrecision(Math.min(EMPIRE_TUNING.TRAINING_IQ_DAILY_CEILING, raw));
}

/**
 * The gym's baseline takings, per hour — the line the WALL-CLOCK book accrues
 * on.
 *
 * It is `GYM_BUCKS_BASE_PER_HOUR` and nothing else, and every term the rate
 * above adds to it is left out for a stated reason rather than an oversight:
 *
 *   - the roster term, because `NpcLifter.joinedAt` moves with a purchased
 *     recruit skip, so a rate that read it would carry the purchase;
 *   - the equipment, space and coach multipliers, because each of those rungs
 *     is bought and each of their build timers is skippable, so a rate that
 *     read them would carry the purchase one rung further out.
 *
 * That is the same argument `trainingIqRatePerDay` makes for taking no axis
 * multiplier, applied to the money that buys the rungs rather than to the
 * trickle they would have multiplied. What is left is a function of wall time
 * and one tuning constant, which is what makes every purse in `settledBooks`
 * a quantity no purchase can move — and it is why this takes no state at all.
 */
export function settledGymBucksRatePerHour(): number {
  return EMPIRE_TUNING.GYM_BUCKS_BASE_PER_HOUR;
}

/** Both rates at one clock reading. */
export function productionRates(
  state: EmpireState,
  at: EmpireClock,
  roster: RosterRateSource,
): ProductionRates {
  return Object.freeze({
    gymBucksPerHour: gymBucksRatePerHour(state, at, roster),
    trainingIqPerDay: trainingIqRatePerDay(state, at, roster),
  });
}

// ---------------------------------------------------------------------------
// Accrual — GDD §5.1
// ---------------------------------------------------------------------------

/**
 * What one gap paid, and what it cost to be away.
 *
 * The three second counts are the announcement half: the cap's bite is reported
 * rather than silent, so a screen can say "you were away for X and Y of it
 * banked" instead of a player finding out by arithmetic.
 */
export interface ProductionAccrual {
  readonly gymBucks: GymBucks;
  /**
   * What the gap paid into EACH wall-clock book: the baseline line, over the
   * wall-clock part of the gap, under the same offline model.
   *
   * Both halves are the wall clock on purpose. The rate is
   * `settledGymBucksRatePerHour`, which reads no state; the span is the
   * un-accelerated gap, which a skip does not lengthen. A skip lengthens the
   * accelerated gap only, so it moves the line above and not this one.
   */
  readonly settledGymBucks: GymBucks;
  readonly trainingIq: TrainingIqPoints;
  /** Whole ticks of accelerated time between the mark and now. */
  readonly offlineSecondsElapsed: number;
  /** How much of that paid. */
  readonly offlineSecondsBanked: number;
  /** How much of it the cap discarded. Zero inside the horizon. */
  readonly offlineSecondsDiscarded: number;
  /** Whole ticks of wall-clock time between the mark and now. Uncapped. */
  readonly trainingIqSecondsElapsed: number;
  /** The undiscounted rates the gap was paid at, read at the mark. */
  readonly rates: ProductionRates;
  /** One entry per output, stamped on the wall clock, in `EMPIRE_OUTPUTS` order. */
  readonly ledger: readonly EmpireLedgerEntry[];
}

/**
 * Accrue everything a gap between two check-ins produced.
 *
 * `collectedAt` is the clock as it read when the player last collected; the gap
 * is from there to `state.clock`. A mark ahead of the state's own clock on
 * either reading throws rather than clamping, because a silently clamped
 * backwards gap is a lost payout nothing reports.
 */
export function accrueProduction(
  state: EmpireState,
  collectedAt: EmpireClock,
  roster: RosterRateSource,
  policy: OfflineBankingPolicy = SHIPPED_OFFLINE_BANKING_POLICY,
): ProductionAccrual {
  const idleGap = elapsedFor(state.clock, 'gym-bucks') - elapsedFor(collectedAt, 'gym-bucks');
  if (!Number.isFinite(idleGap) || idleGap < 0) {
    throw new RangeError(
      `the collection mark is ${-idleGap} seconds ahead of the gym's own idle clock`,
    );
  }
  const wallGap =
    elapsedFor(state.clock, 'training-iq') - elapsedFor(collectedAt, 'training-iq');
  if (!Number.isFinite(wallGap) || wallGap < 0) {
    throw new RangeError(
      `the collection mark is ${-wallGap} seconds ahead of the gym's own wall clock`,
    );
  }

  const rates = productionRates(state, collectedAt, roster);

  const offlineSecondsElapsed = quantiseElapsedSeconds(idleGap);
  const offlineSecondsBanked = bankableOfflineSeconds(idleGap, policy);
  const offlineSecondsDiscarded = offlineSecondsElapsed - offlineSecondsBanked;
  const gymBucks = scrubPrecision(
    rates.gymBucksPerHour *
      EMPIRE_TUNING.OFFLINE_EARNINGS_FRACTION *
      (offlineSecondsBanked / EMPIRE_TUNING.SECONDS_PER_HOUR),
  );

  const settledSecondsBanked = bankableOfflineSeconds(wallGap, policy);
  const settledGymBucks = scrubPrecision(
    settledGymBucksRatePerHour() *
      EMPIRE_TUNING.OFFLINE_EARNINGS_FRACTION *
      (settledSecondsBanked / EMPIRE_TUNING.SECONDS_PER_HOUR),
  );

  const trainingIqSecondsElapsed = quantiseElapsedSeconds(wallGap);
  const trainingIq = scrubPrecision(
    rates.trainingIqPerDay * (trainingIqSecondsElapsed / EMPIRE_TUNING.SECONDS_PER_DAY),
  );

  const at: UnacceleratedSeconds = elapsedFor(state.clock, 'training-iq');
  const gymBucksEntry: EmpireLedgerEntry = Object.freeze({
    at,
    output: 'gym-bucks',
    amount: gymBucks,
  });
  const trainingIqEntry: EmpireLedgerEntry = Object.freeze({
    at,
    output: 'training-iq',
    amount: trainingIq,
  });

  return Object.freeze({
    gymBucks: asGymBucks(gymBucks),
    settledGymBucks: asGymBucks(settledGymBucks),
    trainingIq: asTrainingIq(trainingIq),
    offlineSecondsElapsed,
    offlineSecondsBanked,
    offlineSecondsDiscarded,
    trainingIqSecondsElapsed,
    rates,
    ledger: Object.freeze([gymBucksEntry, trainingIqEntry]),
  });
}
