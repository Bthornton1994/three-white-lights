/**
 * empireFloor.ts — THE ONE THING THAT MAKES GDD §5's FLOOR ADVANCE.
 *
 * ===========================================================================
 * WHAT THIS IS
 * ===========================================================================
 * A pure adapter between the app's wall clock and `src/empire/`'s own loop. It
 * holds an `EmpireGym`, hands it to §5's `stepGym` on a schedule, and previews
 * what §5's `accrueProduction` says the current gap has produced but not yet
 * paid in. Zero React, zero I/O, zero `Date.now()` — every reading of the clock
 * arrives as an argument, which is what lets the whole thing be swept.
 *
 * It exists because the alternative is arithmetic inside `EmpireScreen.tsx`,
 * and CLAUDE.md forbids that. The screen calls two functions and draws fields.
 *
 * ===========================================================================
 * IT READS `src/empire/`; IT DOES NOT EDIT IT, AND IT MAY NOT
 * ===========================================================================
 * `shell -> empire` is the declared direction and `empireCore.test.ts` pins
 * `src/empire/`'s import list exactly. Nothing here is a re-implementation of a
 * §5 rule: the rates, the offline model, the prices, the ceilings and the
 * spending order are all `src/empire/`'s, reached through its exported
 * functions. What this module owns is the SCHEDULE — when a check-in happens —
 * which §5 deliberately does not specify (§5.1 describes a check-in as
 * something a player does and gives no cadence), and which therefore lives in
 * `shellTuning.ts` as a knob.
 *
 * ===========================================================================
 * §12.3, WHICH IS THE WHOLE REASON THIS FILE HAS A SHAPE AT ALL
 * ===========================================================================
 * "Never punish daily engagement" has no tolerance band, and an idle earner
 * wired to a real clock is exactly where it breaks. THE NAIVE WIRING BREAKS IT
 * OUTRIGHT, measured rather than reasoned about:
 *
 *   `production.ts` quantises a gap down to whole `EMPIRE_TUNING.TICK_SECONDS`
 *   and `stepGym` then advances the collection mark to the exact reading it was
 *   given. So a collection taken at a fractional offset throws the fragment
 *   away. A gym collected 1200 times at half-second offsets across 600 seconds
 *   banks ZERO Gym Bucks; the same 600 seconds collected on whole ticks banks
 *   11.063625. Checking in twice as often costs everything.
 *
 * The repair is structural rather than a pin, and it has two halves, one per
 * domain of the offline cap below:
 *
 * BELOW THE CAP — every gap between two `advanceEmpireFloor` calls at or under
 * `CATCH_UP_CAP_SECONDS` — the number of check-ins, and the reading each is
 * taken at, are functions of elapsed wall time and of nothing else.
 * `advanceEmpireFloor` may be called once, or a thousand times, at any moments
 * whatsoever, and the floor it produces for a given `nowMs` is the same value —
 * so no interaction pattern can make a player worse off, because no interaction
 * pattern can change anything at all.
 * `@guarantee below-the-cap-the-floor-is-a-function-of-elapsed-time`
 *
 * PAST THE CAP that equality is broken ON PURPOSE, in the one §12.3 direction
 * that is allowed: a gap longer than the cap simulates only the cap's worth of
 * check-ins, so the player who came back midway through a whole day away has
 * both halves run in full while the player who did not has the second half
 * forfeited. The extra look earns MORE, and it can never earn less, because
 * every floor is the same fold of `stepGym` over check-ins numbered from one —
 * a schedule with more looks holds the gym of the schedule with fewer, further
 * along the identical trajectory.
 * `@guarantee past-the-cap-more-looks-never-land-behind`
 *
 * Both halves are swept rather than asserted in `empireFloor.test.ts`: random
 * sub-cap call schedules against the one-shot value with mismatches pinned at
 * zero, and seeded past-the-cap pairs with the punishing direction pinned at
 * zero and the strictly-ahead count pinned non-zero beside it — with the
 * fragmenting variant kept runnable as the non-zero control the zeros are zero
 * against.
 *
 * ===========================================================================
 * WHAT IT DELIBERATELY DOES NOT DO
 * ===========================================================================
 *   - NO PERSISTENCE. There is no backend and no savefile in this prototype, so
 *     the floor's clock starts when the floor is opened and a reload opens a new
 *     gym at zero. Reading a stored timestamp and paying out the gap would be
 *     inventing a savefile this architecture does not have. §5.1's offline cap
 *     still reaches a player from here without one — a suspended tab is offline
 *     in §5.1's sense, ruled 2026-08-18, and `advanceEmpireFloor` clamps the
 *     catch-up at `CATCH_UP_CAP_SECONDS` — but it bites at this module's own
 *     clamp, not inside `accrueProduction`: gaps in GYM time stay one
 *     `CHECK_IN_SECONDS` wide, orders of magnitude inside
 *     `OFFLINE_EARNINGS_CAP_HOURS`, whatever the wall clock did.
 *     `pendingWasCapped` reports the inner cap if that ever stops being true;
 *     `catchUpWasCapped` reports the outer one, and the two are different
 *     facts.
 *   - NO WALLET. Nothing here reaches `progression.ts`, Total, e1RM or the
 *     streak. Gym Bucks accrued on this surface stay on this surface; the
 *     empire -> pooled-wallet seam is a separate, deliberately serialised piece.
 *   - NO PURCHASE, NO ACCELERANT, NO GRANT. `stepGym` is always called with a
 *     null accelerant and a zero grant, so GDD §8.3B's timer skips are not
 *     reachable from this surface. That is not an oversight: monetization
 *     surfaces are gated.
 */

import {
  createEmpireGym,
  rosterRatesAt,
  stepGym,
  type EmpireGym,
  type EmpirePolicy,
} from '../empire/empireInvariant';
import { createEmpireClock, type EmpireState } from '../empire/empireCore';
import { EXPANSION_AXES } from '../empire/expansion';
import {
  accrueProduction,
  offlineBankingHorizonSeconds,
  type ProductionAccrual,
} from '../empire/production';
import { EMPIRE_TUNING } from '../empire/empireTuning';
import { EMPIRE_FLOOR } from './shellTuning';

const MS_PER_SECOND = EMPIRE_FLOOR.MILLISECONDS_PER_SECOND;

/**
 * The most wall time one `advanceEmpireFloor` call may simulate, in seconds.
 *
 * NOT A KNOB OF THIS MODULE'S OWN, and not a restatement of one. It is §5.1's
 * offline-earnings horizon read through `src/empire/`'s own arithmetic —
 * `offlineBankingHorizonSeconds()` is `max(OFFLINE_EARNINGS_CAP_HOURS,
 * OFFLINE_EARNINGS_NO_PUNISH_HOURS)` in seconds, and the max is what keeps a
 * tuning pass that drops the cap under the no-punish floor from turning this
 * clamp into a punishment for a gap §5.1 explicitly protects. Turning the cap
 * is done in `empireTuning.ts`, where it already lives; a second number here
 * would be the drift this codebase bans.
 */
export const CATCH_UP_CAP_SECONDS = offlineBankingHorizonSeconds();

/**
 * The simulated player `stepGym` spends for, derived rather than restated.
 *
 * `axisOrder` is `EXPANSION_AXES` itself, so an axis added to §5.4 is offered
 * here without a second list being edited. `checkInsPerDay` is this module's
 * own cadence expressed in §5's units — `stepGym` does not read it, but a
 * policy that disagreed with the schedule it is used on would be a lie waiting
 * for the first reader who does. `leaderboardMetric` is §5.5's rival ranking
 * and no §5.5 surface exists here; it is named rather than left to a default so
 * nothing about this policy is implicit.
 */
export const EMPIRE_FLOOR_POLICY: EmpirePolicy = Object.freeze({
  checkInsPerDay: EMPIRE_TUNING.SECONDS_PER_DAY / EMPIRE_FLOOR.CHECK_IN_SECONDS,
  axisOrder: EXPANSION_AXES,
  leaderboardMetric: 'reputation',
});

/** The gym, the clock it is being read at, and what the current gap has produced. */
export interface EmpireFloor {
  /**
   * The wall-clock instant this floor was opened, in milliseconds.
   *
   * Carried rather than closed over so `advanceEmpireFloor` takes one argument
   * and the whole state is inspectable by a test.
   */
  readonly startedAtMs: number;
  /**
   * Whole seconds of WALL time this floor has been advanced to.
   *
   * Never decreases: a clock that jumps backwards is clamped here rather than
   * allowed to rewind a gym. See `advanceEmpireFloor`. This is the honest wall
   * clock — a capped advance moves it by the whole gap, forfeited span
   * included.
   */
  readonly openSeconds: number;
  /**
   * Whole seconds of wall time this floor has actually SIMULATED — the gym's
   * own elapsed time.
   *
   * At most `openSeconds`, and equal to it on a floor the cap has never bitten.
   * Each advance moves it by `min(wall gap, CATCH_UP_CAP_SECONDS)`, so the
   * difference `openSeconds - gymSeconds` is exactly the wall time acknowledged
   * and not simulated — `forfeitedAwaySeconds` reads it, and the screen draws
   * it as the away summary.
   */
  readonly gymSeconds: number;
  /** How many check-ins `stepGym` has been asked for. A function of `gymSeconds`. */
  readonly checkIns: number;
  /** GDD §5's own gym, advanced by GDD §5's own `stepGym`. */
  readonly gym: EmpireGym;
  /**
   * What GDD §5's `accrueProduction` says the gap since the last check-in has
   * produced and not yet paid in.
   *
   * A PREVIEW, NOT A SECOND ECONOMY. It is the same call `stepGym` makes at its
   * own step 3, against the same mark and the same rate source, asked one gap
   * early. Nothing here adds it to a balance — the next check-in does that, and
   * it does it by calling `stepGym`, so this reading can never disagree with
   * what lands.
   */
  readonly pending: ProductionAccrual;
}

/**
 * Whole seconds of wall time between two instants, floored, never negative.
 *
 * Floored to a whole second because `EMPIRE_TUNING.TICK_SECONDS` is the quantum
 * §5 accrues in and a fraction of one is worth nothing — see the header. A
 * `nowMs` before `startedAtMs` (a clock adjustment) reads as zero rather than
 * as a negative gap `stepGym` would refuse.
 */
export function elapsedSecondsBetween(startedAtMs: number, nowMs: number): number {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) {
    throw new RangeError(
      `an empire floor needs two finite instants, received ${startedAtMs} and ${nowMs}.`,
    );
  }
  return Math.max(0, Math.floor((nowMs - startedAtMs) / MS_PER_SECOND));
}

/** How many check-ins `elapsedSeconds` of wall time is worth. */
export function checkInsBy(elapsedSeconds: number): number {
  return Math.floor(elapsedSeconds / EMPIRE_FLOOR.CHECK_IN_SECONDS);
}

/** The wall-clock reading a check-in count was taken at. */
export function checkInReadingAt(checkIns: number): number {
  return checkIns * EMPIRE_FLOOR.CHECK_IN_SECONDS;
}

/**
 * What the gap between the gym's collection mark and `gymSeconds` has produced.
 *
 * GYM time, not wall time, on purpose: a capped advance forfeits the wall span
 * past the cap, so previewing against the wall clock would draw an accrual over
 * dead time that no check-in will ever bank. The state handed to
 * `accrueProduction` is the gym's own with its clock moved to the reading being
 * asked about — `createEmpireClock` is §5's constructor and `skippedSeconds` is
 * carried rather than assumed, so this stays correct if an accelerant ever does
 * reach this surface.
 */
function pendingAt(gym: EmpireGym, gymSeconds: number): ProductionAccrual {
  const asOf: EmpireState = Object.freeze({
    ...gym.state,
    clock: createEmpireClock(gymSeconds, gym.skippedSeconds),
  });
  return accrueProduction(asOf, gym.collectedAt, rosterRatesAt(gym.collectedAt));
}

/** A floor at the instant it is opened: an opening-day gym, no elapsed time. */
export function openEmpireFloor(startedAtMs: number): EmpireFloor {
  if (!Number.isFinite(startedAtMs)) {
    throw new RangeError(`an empire floor needs a finite opening instant, received ${startedAtMs}.`);
  }
  const gym = createEmpireGym();
  return Object.freeze({
    startedAtMs,
    openSeconds: 0,
    gymSeconds: 0,
    checkIns: 0,
    gym,
    pending: pendingAt(gym, 0),
  });
}

/**
 * The floor as it reads at `nowMs`.
 *
 * ===========================================================================
 * THE PROPERTY, STATED PRECISELY — IN TWO HALVES SINCE THE CAP
 * ===========================================================================
 * BELOW THE CAP the value returned depends on `floor.startedAtMs` and `nowMs`
 * and on nothing else — not on how many times this has been called, not on
 * when, not on whether the surface was on screen for any of it. Concretely,
 * whenever no gap between consecutive calls exceeds `CATCH_UP_CAP_SECONDS`:
 *
 *     advanceEmpireFloor(advanceEmpireFloor(f, t1), t2)
 *       === advanceEmpireFloor(f, t2)          for every t1 <= t2
 *
 * PAST THE CAP the equality is deliberately false and the inequality that
 * replaces it points the one way §12.3 permits: each call simulates at most
 * `CATCH_UP_CAP_SECONDS` of the gap it is owed, so splitting a long absence
 * with an extra look simulates MORE of it, never less —
 * `min(g1, cap) + min(g2, cap) >= min(g1 + g2, cap)` for every split. And
 * because every simulated check-in is numbered from one at a fixed reading,
 * every floor's gym is the same fold of `stepGym` read off at `checkIns`: the
 * player with more looks holds the same trajectory further along, which is what
 * `empireFloor.test.ts`'s capped pairing sweeps against the canonical fold.
 *
 * IT IS ALSO WHY CATCHING UP IS ONE LOOP AND NOT ONE STEP. A gym that has been
 * off screen for a while owes several check-ins, and taking them as a single
 * long `stepGym` would NOT be the same value: §5's reputation line pays
 * `REPUTATION_PER_CHECK_IN` per check-in and its sponsor line is denominated off
 * reputation, so a gym that skipped its check-ins would be permanently behind
 * one that did not. Measured: 600 seconds taken as one step banks 10 Gym Bucks
 * and 2 reputation, taken as its own check-ins banks 11.063625 and 1200. So the
 * loop is the correct arithmetic, not a convenience — and it is cheap, at about
 * 0.05 ms a step.
 *
 * A BACKWARDS CLOCK CANNOT TAKE ANYTHING AWAY. `openSeconds` is clamped to what
 * the floor has already reached, so a system clock that steps back leaves the
 * gym where it was rather than rewinding it — the direction §12.3 requires.
 *
 * ===========================================================================
 * A FORWARD CLOCK IS CAPPED AT §5.1's OWN OFFLINE HORIZON — RULED, OPTION B,
 * 2026-08-18
 * ===========================================================================
 * This used to be the recorded sibling defect of the backwards clamp above:
 * `owed` was a function of elapsed wall time with nothing above it, and the
 * loop below runs synchronously inside a React state updater, so the cost of
 * one call was linear in how far the clock jumped — a suspended tab, a device
 * clock correction, a timezone change on a laptop lid. Measured at ef1a3f2 on
 * an idle box (a phone is roughly three times worse), one jumped `nowMs` handed
 * to a fresh floor:
 *
 *     24 hours      8,640 steps      160 ms      ~2,700 Gym Bucks
 *     72 hours     25,920 steps      505 ms
 *     1 week       60,480 steps    1,310 ms
 *     30 days     259,200 steps    6,700 ms
 *     1 year    3,153,600 steps   97,200 ms     ~141.7M Gym Bucks
 *
 * The ruling that closed it: A SUSPENDED TAB IS "OFFLINE" IN GDD §5.1's SENSE,
 * so the design's own `OFFLINE_EARNINGS_CAP_HOURS` applies to it — the
 * unbounded loop was a §5.1 design violation wearing a performance costume,
 * paying a year's absence 141.7M against a day's ~2,700. Option B was chosen:
 * the catch-up is capped at the cap's worth of check-ins per advance, and time
 * beyond it is acknowledged, not simulated. (Paying the remainder through
 * `OFFLINE_EARNINGS_FRACTION` as one long discounted step was the rejected
 * alternative — that knob is deliberately not part of this path.)
 *
 * HOW THE CLAMP KEEPS THE CLOCKS HONEST. The wall gap since the previous
 * advance moves `openSeconds` in full; at most `CATCH_UP_CAP_SECONDS` of it
 * moves `gymSeconds`, and check-ins are owed off `gymSeconds`. So gym time is
 * contiguous — the gap `accrueProduction` previews never widens past one
 * check-in, and `production.ts`'s inner offline discard stays unreachable from
 * here (see `pendingWasCapped`) — while the difference between the two clocks
 * is exactly the forfeited span the screen reports. Every reading on the screen
 * is gym-time; the away row is the difference itself.
 *
 * Re-measured at the same ladder after the clamp (this module at 2d53ac2),
 * same class of idle box, three runs: every jump from 24 hours to 1 year costs
 * the same 4,320 steps, 70-105 ms — the freeze is bounded at the cap's own
 * cost whatever the jump.
 * The exact step counts and forfeits per rung are pinned in
 * `empireFloor.test.ts` rather than here; the milliseconds are not, because a
 * timing assertion measures the box.
 */
export function advanceEmpireFloor(floor: EmpireFloor, nowMs: number): EmpireFloor {
  const openSeconds = Math.max(
    floor.openSeconds,
    elapsedSecondsBetween(floor.startedAtMs, nowMs),
  );
  const gymSeconds =
    floor.gymSeconds + Math.min(openSeconds - floor.openSeconds, CATCH_UP_CAP_SECONDS);
  const owed = checkInsBy(gymSeconds);
  let gym = floor.gym;
  for (let checkIn = floor.checkIns + 1; checkIn <= owed; checkIn += 1) {
    gym = stepGym(gym, EMPIRE_FLOOR_POLICY, checkInReadingAt(checkIn), null, 0);
  }
  return Object.freeze({
    startedAtMs: floor.startedAtMs,
    openSeconds,
    gymSeconds,
    checkIns: owed,
    gym,
    pending: pendingAt(gym, gymSeconds),
  });
}

/**
 * The wall time this floor has acknowledged and not simulated, in whole
 * seconds.
 *
 * The away summary's number. Zero on a floor the cap has never bitten;
 * otherwise the sum of every capped advance's forfeited span, monotone
 * non-decreasing, because both clocks it is the difference of only move
 * forwards and `gymSeconds` never moves further than `openSeconds` does.
 */
export function forfeitedAwaySeconds(floor: EmpireFloor): number {
  return floor.openSeconds - floor.gymSeconds;
}

/**
 * The away summary's state: has any advance of this floor ever been capped?
 *
 * A DIFFERENT FACT FROM `pendingWasCapped` below. That one reports
 * `production.ts`'s inner discard on the previewed gap, which the clamp keeps
 * structurally quiet; this one reports the clamp itself, which is the §5.1
 * offline cap a player can actually meet on this surface.
 */
export function catchUpWasCapped(floor: EmpireFloor): boolean {
  return forfeitedAwaySeconds(floor) > 0;
}

/**
 * The floor a fresh gym reaches after `elapsedSeconds` of wall time, in ONE
 * advance — so past `CATCH_UP_CAP_SECONDS` this is the floor of a player who
 * was away the whole span, cap applied, not of one who watched it.
 */
export function empireFloorAfter(elapsedSeconds: number): EmpireFloor {
  return advanceEmpireFloor(openEmpireFloor(0), elapsedSeconds * MS_PER_SECOND);
}

/**
 * Did `production.ts`'s own offline discard remove any of the PREVIEWED gap?
 *
 * Always false on this surface, still — and since the catch-up cap the reason
 * changed, so the sentence is re-derived rather than left standing: the gap
 * `accrueProduction` previews is `gymSeconds - checkInReadingAt(checkIns)`,
 * gym time, under one `CHECK_IN_SECONDS` by construction whatever the wall
 * clock jumped, because a capped advance forfeits wall time instead of letting
 * gym time gape. It is REPORTED rather than assumed, because "the inner cap
 * cannot bite here" is a claim about arithmetic nobody would notice going
 * false. `empireFloor.test.ts` pins it at zero on watched walks AND on a floor
 * whose catch-up was capped, and drives the discard the other direction on a
 * raw gap past the horizon. The cap a player can actually meet on this surface
 * is `catchUpWasCapped`, one function up.
 */
export function pendingWasCapped(floor: EmpireFloor): boolean {
  return floor.pending.offlineSecondsDiscarded > 0;
}

/** One row the floor draws: a label's worth of value, already a string. */
export interface EmpireFloorReadings {
  readonly gymBucks: string;
  readonly pendingGymBucks: string;
  readonly reputation: string;
  readonly roster: string;
  readonly equipment: string;
  readonly clockSeconds: string;
  /**
   * The away summary, GDD §5.1: wall seconds past the offline cap, acknowledged
   * and not simulated. A number and a state in one reading — zero is the state
   * where the cap has never bitten this floor, anything else is the forfeited
   * span itself.
   */
  readonly forfeitedSeconds: string;
}

/**
 * A Gym Bucks amount as the floor draws it.
 *
 * `toFixed` is monotone, so a rounded reading cannot appear to go backwards
 * while the real one goes forwards — which matters here, because a reading that
 * flickered downwards would look exactly like the §12.3 defect this module is
 * shaped to avoid.
 */
function drawnBucks(amount: number): string {
  return amount.toFixed(EMPIRE_FLOOR.READING_DECIMALS);
}

/**
 * Every reading the floor draws, out of the gym and the floor's two clocks and
 * out of nothing else.
 *
 * The screen turns these into rows and adds no arithmetic of its own. Note that
 * `clockSeconds` is the GYM's clock (`EmpireClock.unaccelerated`), not the app's
 * uptime: it moves at a check-in and only at a check-in, which is what makes it
 * a reading about §5 rather than about the timer that drew it.
 * `forfeitedSeconds` is the one reading that is not a gym field: it is the
 * difference between the floor's wall clock and its gym clock, which is the
 * away summary the 2026-08-18 ruling asked for — a number and a state, no more.
 *
 * `equipment` IS A RUNG THE GYM CLIMBS, NOT A LABEL IT WEARS. It is
 * `state.axes.equipment`, and `EMPIRE_TUNING.EQUIPMENT_TIERS` puts the rungs in
 * order, so this row may only move UP that order and may never draw a name that
 * is off it. A constant cannot satisfy that claim whichever rung it names,
 * because the rung this gym opens on is not the rung it reaches inside a day.
 * `@guarantee the-equipment-row-is-a-rung-the-gym-climbs`
 */
export function empireFloorReadings(floor: EmpireFloor): EmpireFloorReadings {
  return Object.freeze({
    gymBucks: drawnBucks(floor.gym.state.gymBucks),
    pendingGymBucks: drawnBucks(floor.pending.gymBucks),
    reputation: String(floor.gym.state.reputation),
    roster: String(floor.gym.state.roster.length),
    equipment: floor.gym.state.axes.equipment,
    clockSeconds: String(floor.gym.state.clock.unaccelerated),
    forfeitedSeconds: String(forfeitedAwaySeconds(floor)),
  });
}
