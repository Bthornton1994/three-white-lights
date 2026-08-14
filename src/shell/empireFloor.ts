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
 * The repair is structural rather than a pin: **the number of check-ins, and
 * the reading each is taken at, are functions of elapsed wall time and of
 * nothing else.** `advanceEmpireFloor` may be called once, or a thousand times,
 * at any moments whatsoever, and the floor it produces for a given `nowMs` is
 * the same value — so no interaction pattern can make a player worse off,
 * because no interaction pattern can change anything at all.
 * `@guarantee the-floor-is-a-function-of-elapsed-time-and-nothing-else`
 *
 * That is a stronger statement than "more is never less" and it is what
 * `empireFloor.test.ts` sweeps: random call schedules against the one-shot
 * value, counts pinned at zero mismatches, with the fragmenting variant kept
 * runnable beside it as the non-zero control the zero is zero against.
 *
 * ===========================================================================
 * WHAT IT DELIBERATELY DOES NOT DO
 * ===========================================================================
 *   - NO PERSISTENCE. There is no backend and no savefile in this prototype, so
 *     the floor's clock starts when the floor is opened and a reload opens a new
 *     gym at zero. Reading a stored timestamp and paying out the gap would be
 *     inventing a savefile this architecture does not have, and it is the one
 *     route by which §5.1's offline cap could reach a player from here.
 *     `accrueProduction`'s cap therefore never bites: every gap is one
 *     `CHECK_IN_SECONDS`, orders of magnitude inside
 *     `OFFLINE_EARNINGS_CAP_HOURS`. `pendingWasCapped` reports it if that ever
 *     stops being true rather than leaving it to be discovered.
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
import { accrueProduction, type ProductionAccrual } from '../empire/production';
import { EMPIRE_TUNING } from '../empire/empireTuning';
import { EMPIRE_FLOOR } from './shellTuning';

const MS_PER_SECOND = EMPIRE_FLOOR.MILLISECONDS_PER_SECOND;

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
   * Whole seconds of wall time this floor has been advanced to.
   *
   * Never decreases: a clock that jumps backwards is clamped here rather than
   * allowed to rewind a gym. See `advanceEmpireFloor`.
   */
  readonly openSeconds: number;
  /** How many check-ins `stepGym` has been asked for. A function of `openSeconds`. */
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
 * What the gap between the gym's collection mark and `openSeconds` has produced.
 *
 * The state handed to `accrueProduction` is the gym's own with its clock moved
 * to the reading being asked about — `createEmpireClock` is §5's constructor
 * and `skippedSeconds` is carried rather than assumed, so this stays correct if
 * an accelerant ever does reach this surface.
 */
function pendingAt(gym: EmpireGym, openSeconds: number): ProductionAccrual {
  const asOf: EmpireState = Object.freeze({
    ...gym.state,
    clock: createEmpireClock(openSeconds, gym.skippedSeconds),
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
    checkIns: 0,
    gym,
    pending: pendingAt(gym, 0),
  });
}

/**
 * The floor as it reads at `nowMs`.
 *
 * ===========================================================================
 * THE PROPERTY, STATED PRECISELY
 * ===========================================================================
 * The value returned depends on `floor.startedAtMs` and `nowMs` and on nothing
 * else — not on how many times this has been called, not on when, not on
 * whether the surface was on screen for any of it. Concretely:
 *
 *     advanceEmpireFloor(advanceEmpireFloor(f, t1), t2)
 *       === advanceEmpireFloor(f, t2)          for every t1 <= t2
 *
 * That is the §12.3 property for this surface, and it is swept rather than
 * asserted: `empireFloor.test.ts` drives random call schedules against the
 * one-shot value and pins the mismatch count at zero.
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
 */
export function advanceEmpireFloor(floor: EmpireFloor, nowMs: number): EmpireFloor {
  const openSeconds = Math.max(
    floor.openSeconds,
    elapsedSecondsBetween(floor.startedAtMs, nowMs),
  );
  const owed = checkInsBy(openSeconds);
  let gym = floor.gym;
  for (let checkIn = floor.checkIns + 1; checkIn <= owed; checkIn += 1) {
    gym = stepGym(gym, EMPIRE_FLOOR_POLICY, checkInReadingAt(checkIn), null, 0);
  }
  return Object.freeze({
    startedAtMs: floor.startedAtMs,
    openSeconds,
    checkIns: Math.max(floor.checkIns, owed),
    gym,
    pending: pendingAt(gym, openSeconds),
  });
}

/** The floor a fresh gym reaches after `elapsedSeconds` of wall time. */
export function empireFloorAfter(elapsedSeconds: number): EmpireFloor {
  return advanceEmpireFloor(openEmpireFloor(0), elapsedSeconds * MS_PER_SECOND);
}

/**
 * Did the offline cap discard any of the current gap?
 *
 * Always false on this surface — every gap is one `CHECK_IN_SECONDS` and the
 * cap is hours away — and it is REPORTED rather than assumed, because "the cap
 * cannot bite here" is a claim about arithmetic nobody would notice going
 * false. `empireFloor.test.ts` pins it at zero and drives the other direction
 * on a floor left open past the horizon.
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
 * Every reading the floor draws, out of the gym and out of nothing else.
 *
 * The screen turns these into rows and adds no arithmetic of its own. Note that
 * `clockSeconds` is the GYM's clock (`EmpireClock.unaccelerated`), not the app's
 * uptime: it moves at a check-in and only at a check-in, which is what makes it
 * a reading about §5 rather than about the timer that drew it.
 */
export function empireFloorReadings(floor: EmpireFloor): EmpireFloorReadings {
  return Object.freeze({
    gymBucks: drawnBucks(floor.gym.state.gymBucks),
    pendingGymBucks: drawnBucks(floor.pending.gymBucks),
    reputation: String(floor.gym.state.reputation),
    roster: String(floor.gym.state.roster.length),
    equipment: floor.gym.state.axes.equipment,
    clockSeconds: String(floor.gym.state.clock.unaccelerated),
  });
}
