/**
 * engagement.ts — GDD §5 composed over a calendar the PLAYER'S OWN ENGAGEMENT
 * varies, which is the independent variable no other sweep in this directory
 * moves.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock reading and no randomness. Every day, every
 * second and every check-in is a parameter. Its imports are the §5 modules, the
 * composition in `empireInvariant.ts` and the tuning block, so every magnitude
 * it uses is named in one place and the directory-wide audit in
 * `empireCore.test.ts` covers it.
 *
 * ===========================================================================
 * 1. Why this file exists: the sweep the other sweeps are not
 * ===========================================================================
 *
 * `empireInvariant.ts` varies the PURCHASE and holds the check-in cadence
 * fixed. `expansion.test.ts`, `reputation.test.ts` and `production.test.ts` vary
 * a skip. GDD §5.4 records what that leaves open, in its own words:
 *
 *   "Still unmeasured, and named rather than assumed benign: the earned path —
 *   check-ins -> reputation -> sponsor Gym Bucks -> the wall-clock day a physio
 *   level arrives. It is not purchasable, so it is not §8.1, and 'more
 *   engagement only ever helps' is the argument §4.4 records as a reason to
 *   measure rather than a substitute for measuring. The composed sweep varies
 *   the purchase and never the training schedule, so it is no evidence either
 *   way."
 *
 * `reputation.ts` §3 writes the rule the chain would break down as: "a quantity
 * the player's own activity moves may not decide when something that reaches
 * Sim training pace arrives". That rule is enforced against the reputation GATE
 * and left open on the money.
 *
 * The property this file measures is CLAUDE.md's "never punish daily
 * engagement", transposed from the streak system to the empire:
 *
 *   for two check-in histories identical except that one has an extra
 *   check-in, the more-engaged gym must never end with a later physio arrival
 *   day, a lower `physioDaysSaved` series, or a lower Training IQ series, at
 *   any horizon.
 *
 * and the same sentence with "an extra trained day" in place of "an extra
 * check-in", which is the form CLAUDE.md states it in.
 *
 * ===========================================================================
 * 2. The subject is one gym, and engagement is a slot grid
 * ===========================================================================
 *
 * A history is a boolean per CHECK-IN SLOT on a fixed grid of `days` days by
 * `checkInsPerDay` slots, plus the calendar days the player trained. "One extra
 * check-in" is one `false` turned `true`, and `moreEngagedBy` refuses to build
 * the pair any other way — so a comparison whose two sides did not actually
 * differ in engagement by exactly one is a throw rather than a quietly
 * uninteresting row.
 *
 * The grid matters because of a measured fact rather than a preference. Adding
 * a whole DAY of six check-ins never produced a violation at any horizon
 * measured here; adding ONE check-in does. A sweep at day granularity would
 * have reported zero and been an empty domain for the mechanism, which is the
 * vacuity shape CLAUDE.md names. `engagement.test.ts` keeps the day-granularity
 * reading beside the slot-granularity one and pins both.
 *
 * ===========================================================================
 * 3. Both progression readings are taken at the DAY'S OWN WALL CLOCK
 * ===========================================================================
 *
 * `runEmpire` reads its ledger off `gym.state.clock`, which is the moment of the
 * last check-in. At a fixed cadence the last check-in of a day lands exactly on
 * the day boundary, so the two readings agree — and `engagement.test.ts` pins
 * that this file reproduces `runEmpire`'s ledger byte for byte under full
 * attendance, so the duplication cannot drift.
 *
 * Under partial attendance they do not agree, and the difference is not
 * cosmetic. A player who checks in at noon and not again has a gym whose state
 * clock stops at noon; reading the physio hook there would report a build that
 * finished at 6pm as unfinished, purely because nobody looked. The Sim asks
 * `physioDaysSavedFor` when a session is recorded, not when the empire was last
 * collected, so the honest reading is the day's own wall clock — and reading it
 * at the last check-in instead would have manufactured a monotonicity result
 * out of staleness: the less-engaged player would read a staler, smaller value
 * on every quiet day, and every one of those would have counted as engagement
 * helping.
 *
 * What still lags a quiet player, deliberately, because it is the shipped
 * model rather than an artefact of the reading: a recruit whose timer has
 * finished joins the roster at the next check-in, and money accrues into the
 * books at a check-in. Those are `stepGym`'s, not this file's.
 *
 * ===========================================================================
 * 4. The wirings, and why three of the four are controls
 * ===========================================================================
 *
 * A zero has to be a zero against something, so the same loop runs under four
 * wirings and one parameter chooses:
 *
 *   - `'shipped'` — the engine as it stands. Physio, space, spotter and every
 *     recruit come out of `EmpireState.settledGymBucks`, the wall-clock book,
 *     which `settledGymBucksRatePerHour` accrues at the baseline line and which
 *     no sponsor money reaches.
 *
 *   - `'accelerated-purse'` — `stepGym`'s own `funding: 'accelerated'`, which
 *     offers the gym its accelerated book where the wall-clock one belongs.
 *     This is not a synthetic control. It is the engine as it stood before GDD
 *     §5.4's two-books ruling, and under it the sponsor line — denominated off
 *     reputation, and reputation is `REPUTATION_PER_CHECK_IN` — is money the
 *     physio rung is bought with. It is chain A itself, re-connected, and its
 *     counts are pinned non-zero.
 *
 *   - `'check-in-upkeep'` — the wall-clock book is charged `upkeepGymBucks` per
 *     check-in, an income term keyed directly to the player's own activity with
 *     the punishing sign. The magnitude is a parameter rather than a constant
 *     here, because it is a control's dial and not a game-feel value; its value
 *     lives with the rest of the sweep's parameters.
 *
 *   - `'trained-day-upkeep'` — the same charge keyed to a TRAINED DAY instead
 *     of a check-in, so the extra-trained-day half of the property has a
 *     control of its own rather than borrowing the check-in one.
 *
 * Nothing in the game reads the last three. They exist so the shipped wiring's
 * numbers are numbers against something.
 *
 * ===========================================================================
 * 5. What this file does not do
 * ===========================================================================
 *
 *   - No wallet write, no clock read, no name table. Same three as
 *     `empireInvariant.ts` §7, for the same three reasons.
 *   - No accelerant. Chain A is the earned path; a purchase is `empireSweep`'s
 *     independent variable and mixing the two would leave a violation
 *     attributable to either.
 *   - No sweep parameters. Horizons, cadences, seeds, densities and the
 *     upkeep magnitude live in `engagement.test.ts`, for the reason
 *     `src/game/streakSweep.ts` exists and with the file suffix
 *     `src/tuning/audit.ts` forces — see `empireSweep.test.ts`'s header.
 */

import {
  asGymBucks,
  createEmpireClock,
  elapsedFor,
  type EmpireClock,
  type EmpireOutput,
  type UnacceleratedSeconds,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import {
  NO_ACCELERANT,
  SHIPPED_FUNDING,
  composeTrainingIqRate,
  createEmpireGym,
  gymProgressionEntries,
  gymSnapshot,
  stepGym,
  type EmpireDayEntry,
  type EmpireFunding,
  type EmpireGym,
  type EmpirePolicy,
  type SocialInputs,
} from './empireInvariant';
import {
  asCalendarDay,
  compareWithRival,
  encouragementGymBucksOn,
  socialRewardSchedule,
  type CalendarDay,
} from './social';

// ---------------------------------------------------------------------------
// The wirings
// ---------------------------------------------------------------------------

/** The engine under test, and the three controls its zeros are zeros against. */
export const ENGAGEMENT_WIRINGS = [
  'shipped',
  'accelerated-purse',
  'check-in-upkeep',
  'trained-day-upkeep',
] as const;

export type EngagementWiringKey = (typeof ENGAGEMENT_WIRINGS)[number];

/** The one wiring the game ships. See §4 of the header for the other three. */
export const SHIPPED_ENGAGEMENT_WIRING: EngagementWiringKey = 'shipped';

/**
 * A wiring and the one magnitude a control needs.
 *
 * `upkeepGymBucks` is a control's dial, so it arrives as a parameter and is
 * required to be zero on every wiring that does not spend it — a control whose
 * dial is set on the shipped wiring would be a subject quietly under a control's
 * arithmetic.
 */
export interface EngagementWiring {
  readonly key: EngagementWiringKey;
  readonly upkeepGymBucks: number;
}

/** True for a wiring that charges the wall-clock book per keyed event. */
export function chargesUpkeep(key: EngagementWiringKey): boolean {
  return key === 'check-in-upkeep' || key === 'trained-day-upkeep';
}

/** Which of `stepGym`'s two funding rules a wiring runs on. */
export function wiringFunding(key: EngagementWiringKey): EmpireFunding {
  return key === 'accelerated-purse' ? 'accelerated' : SHIPPED_FUNDING;
}

/** Build a wiring, refusing a dial on a wiring that has nothing to turn. */
export function engagementWiring(
  key: EngagementWiringKey,
  upkeepGymBucks: number,
): EngagementWiring {
  if (!Number.isFinite(upkeepGymBucks) || upkeepGymBucks < 0) {
    throw new RangeError(
      `an upkeep charge must be finite and at or above zero, received ${upkeepGymBucks}.`,
    );
  }
  if (!chargesUpkeep(key) && upkeepGymBucks !== 0) {
    throw new RangeError(`the ${key} wiring charges no upkeep, so ${upkeepGymBucks} has no meaning`);
  }
  if (chargesUpkeep(key) && upkeepGymBucks === 0) {
    throw new RangeError(`the ${key} wiring charges nothing at zero, so it controls for nothing`);
  }
  return Object.freeze({ key, upkeepGymBucks });
}

/** The shipped wiring, which has no dial. */
export function shippedEngagementWiring(): EngagementWiring {
  return engagementWiring(SHIPPED_ENGAGEMENT_WIRING, 0);
}

// ---------------------------------------------------------------------------
// A history
// ---------------------------------------------------------------------------

/**
 * One player's engagement over a calendar: which check-in slots they attended
 * and which calendar days they trained.
 *
 * `attended` is indexed `day * checkInsPerDay + tick`. `trainedDays` is offsets
 * from the social anchor day, ascending and distinct; nothing in §5 reads it
 * today, which is precisely what the extra-trained-day half measures.
 */
export interface EngagementHistory {
  readonly attended: readonly boolean[];
  readonly trainedDays: readonly number[];
}

/** Attended slots in a history. The non-vacuity denominator for a sweep. */
export function checkInCount(history: EngagementHistory): number {
  let count = 0;
  for (const slot of history.attended) {
    if (slot) count += 1;
  }
  return count;
}

/** A history from a slot predicate, so a generator writes no array by hand. */
export function historyFrom(
  slots: number,
  attended: (slot: number) => boolean,
  trainedDays: readonly number[],
): EngagementHistory {
  if (!Number.isInteger(slots) || slots < 1) {
    throw new RangeError(`a slot grid must hold at least one slot, received ${slots}.`);
  }
  const grid: boolean[] = [];
  for (let slot = 0; slot < slots; slot += 1) grid.push(attended(slot) === true);
  return Object.freeze({ attended: Object.freeze(grid), trainedDays: Object.freeze([...trainedDays]) });
}

/**
 * The same history with one more check-in, at a slot it did not attend.
 *
 * Throws on a slot that is already attended or off the grid. That refusal is
 * the precondition of the whole measurement — "identical except that one has an
 * extra check-in" — held by the constructor rather than by the caller
 * remembering, so a pair that does not differ in engagement cannot be counted
 * as evidence about engagement.
 */
export function moreEngagedBy(history: EngagementHistory, slot: number): EngagementHistory {
  const current = history.attended[slot];
  if (current === undefined) {
    throw new RangeError(`slot ${slot} is off a grid of ${history.attended.length} slots`);
  }
  if (current) {
    throw new RangeError(`slot ${slot} is already attended, so this pair differs in nothing`);
  }
  const grid = [...history.attended];
  grid[slot] = true;
  return Object.freeze({ attended: Object.freeze(grid), trainedDays: history.trainedDays });
}

/** The same history with one more trained day. Refuses a day already trained. */
export function moreEngagedByTrainedDay(
  history: EngagementHistory,
  day: number,
): EngagementHistory {
  if (!Number.isInteger(day) || day < 0) {
    throw new RangeError(`a trained day must be a whole number at or above zero, received ${day}.`);
  }
  if (history.trainedDays.includes(day)) {
    throw new RangeError(`day ${day} is already trained, so this pair differs in nothing`);
  }
  const days = [...history.trainedDays, day].sort((left, right) => left - right);
  return Object.freeze({ attended: history.attended, trainedDays: Object.freeze(days) });
}

// ---------------------------------------------------------------------------
// A run
// ---------------------------------------------------------------------------

/** What one engagement run actually did, so a zero reports its own domain. */
export interface EngagementCensus {
  readonly days: number;
  readonly slots: number;
  /** Slots the player attended. Zero makes every reading below the empty gym. */
  readonly checkIns: number;
  readonly trainedDays: number;
  readonly recruits: number;
  readonly expansions: number;
  /** Gym Bucks a control took off the wall-clock book. Zero on the shipped wiring. */
  readonly upkeepCharged: number;
  /** Events a control charged on. Zero on the shipped wiring. */
  readonly upkeepEvents: number;
  /** Days on which `TRAINING_IQ_DAILY_CEILING` bit. */
  readonly ceilingBoundDays: number;
  /** The first day the physio hook paid anything, or `null` inside this horizon. */
  readonly physioArrivalDay: number | null;
  readonly socialRewardDays: number;
}

/** One composed calendar at one engagement history. */
export interface EngagementRun {
  readonly days: number;
  readonly wiring: EngagementWiring;
  /** Every entry, in day order then in output order, as `EmpireDayEntry`. */
  readonly ledger: readonly EmpireDayEntry[];
  readonly census: EngagementCensus;
}

/** The wall seconds a slot's check-in lands on. */
export function slotWallSeconds(slot: number, checkInsPerDay: number): number {
  if (!Number.isInteger(slot) || slot < 0) {
    throw new RangeError(`a slot is counted from zero, received ${slot}.`);
  }
  if (!Number.isInteger(checkInsPerDay) || checkInsPerDay < 1) {
    throw new RangeError(
      `a check-in cadence must be a whole number at or above one, received ${checkInsPerDay}.`,
    );
  }
  const day = Math.floor(slot / checkInsPerDay);
  const tick = slot - day * checkInsPerDay;
  const secondsPerCheckIn = EMPIRE_TUNING.SECONDS_PER_DAY / checkInsPerDay;
  return day * EMPIRE_TUNING.SECONDS_PER_DAY + (tick + 1) * secondsPerCheckIn;
}

/** Take an upkeep charge off the wall-clock book, floored at zero. */
function chargeUpkeep(gym: EmpireGym, amount: number): EmpireGym {
  return Object.freeze({
    ...gym,
    state: Object.freeze({
      ...gym.state,
      settledGymBucks: asGymBucks(Math.max(0, gym.state.settledGymBucks - amount)),
    }),
  });
}

/** Add Gym Bucks to the accelerated book, the way `runEmpire` credits §5.5 income. */
function credit(gym: EmpireGym, amount: number): EmpireGym {
  if (amount === 0) return gym;
  return Object.freeze({
    ...gym,
    state: Object.freeze({ ...gym.state, gymBucks: asGymBucks(gym.state.gymBucks + amount) }),
  });
}

/**
 * Compose GDD §5 over `days` calendar days at one engagement history.
 *
 * The same day loop `runEmpire` runs, with two differences and no others: a
 * check-in happens only on an attended slot, and the day's readings are taken
 * at the day's own wall clock rather than at the last check-in (§3 of the
 * header). Under full attendance the two produce identical ledgers, which
 * `engagement.test.ts` asserts entry by entry.
 */
export function runEngagement(
  days: number,
  policy: EmpirePolicy,
  history: EngagementHistory,
  social: SocialInputs,
  wiring: EngagementWiring = shippedEngagementWiring(),
): EngagementRun {
  if (!Number.isInteger(days) || days < 1) {
    throw new RangeError(`a horizon must be a whole number of days at or above one, received ${days}.`);
  }
  if (!Number.isInteger(policy.checkInsPerDay) || policy.checkInsPerDay < 1) {
    throw new RangeError(
      `a check-in cadence must be a whole number at or above one, received ${policy.checkInsPerDay}.`,
    );
  }
  const slots = days * policy.checkInsPerDay;
  if (history.attended.length !== slots) {
    throw new RangeError(
      `a history of ${history.attended.length} slots does not fit ${days} days at ${policy.checkInsPerDay} check-ins`,
    );
  }

  const funding = wiringFunding(wiring.key);
  const trained = new Set<number>(history.trainedDays);
  const closeDays = new Set<number>(
    socialRewardSchedule(social.calendar, days)
      .filter((entry) => entry.event === 'rival-period-close')
      .map((entry) => entry.day),
  );

  let gym: EmpireGym = createEmpireGym();
  const ledger: EmpireDayEntry[] = [];
  let checkIns = 0;
  let upkeepCharged = 0;
  let upkeepEvents = 0;
  let ceilingBoundDays = 0;
  let socialRewardDays = 0;
  let physioArrivalDay: number | null = null;

  for (let day = 0; day < days; day += 1) {
    for (let tick = 0; tick < policy.checkInsPerDay; tick += 1) {
      const slot = day * policy.checkInsPerDay + tick;
      if (history.attended[slot] !== true) continue;
      checkIns += 1;
      gym = stepGym(
        gym,
        policy,
        slotWallSeconds(slot, policy.checkInsPerDay),
        NO_ACCELERANT,
        0,
        funding,
      );
      if (wiring.key === 'check-in-upkeep') {
        const before = gym.state.settledGymBucks;
        gym = chargeUpkeep(gym, wiring.upkeepGymBucks);
        upkeepCharged += before - gym.state.settledGymBucks;
        upkeepEvents += 1;
      }
    }

    if (wiring.key === 'trained-day-upkeep' && trained.has(day)) {
      const before = gym.state.settledGymBucks;
      gym = chargeUpkeep(gym, wiring.upkeepGymBucks);
      upkeepCharged += before - gym.state.settledGymBucks;
      upkeepEvents += 1;
    }

    // §5.5's calendar-keyed income, exactly as `runEmpire` pays it: an
    // encouragement per distinct sender per calendar day, and a rival period
    // that closes on a fixed calendar day. Both into the accelerated book.
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

    // The day's readings, at the day's own wall clock. See §3 of the header.
    const clock: EmpireClock = createEmpireClock(
      (day + 1) * EMPIRE_TUNING.SECONDS_PER_DAY,
      gym.skippedSeconds,
    );
    const at: UnacceleratedSeconds = elapsedFor(clock, 'training-iq');
    if (composeTrainingIqRate(gym.state, clock).ceilingBound) ceilingBoundDays += 1;
    const dayEntries = gymProgressionEntries(
      Object.freeze({ ...gym, state: Object.freeze({ ...gym.state, clock }) }),
      day,
      at,
    );
    for (const entry of dayEntries) {
      if (entry.output === 'physio-days-saved' && entry.amount > 0 && physioArrivalDay === null) {
        physioArrivalDay = day;
      }
    }
    ledger.push(
      ...dayEntries,
      // The idle half, which is the positive control: if these never move under
      // a changed check-in schedule, the sweep is reporting zeros about a gym
      // nothing reached.
      Object.freeze({ day, at, output: 'gym-bucks' as EmpireOutput, amount: gym.state.gymBucks }),
      Object.freeze({
        day,
        at,
        output: 'roster-slot' as EmpireOutput,
        amount: gym.state.roster.length,
      }),
    );
  }

  return Object.freeze({
    days,
    wiring,
    ledger: Object.freeze(ledger),
    census: Object.freeze({
      days,
      slots,
      checkIns,
      trainedDays: history.trainedDays.length,
      recruits: gym.recruits,
      expansions: gym.expansions,
      upkeepCharged,
      upkeepEvents,
      ceilingBoundDays,
      physioArrivalDay,
      socialRewardDays,
    }),
  });
}

// ---------------------------------------------------------------------------
// The comparison
// ---------------------------------------------------------------------------

/** One output's amounts out of a ledger, in day order. */
export function amountSeries(
  entries: readonly EmpireDayEntry[],
  output: EmpireOutput,
): readonly number[] {
  const amounts: number[] = [];
  for (const entry of entries) {
    if (entry.output === output) amounts.push(entry.amount);
  }
  return Object.freeze(amounts);
}

/**
 * What one element-wise comparison of a less-engaged run against a more-engaged
 * one found.
 *
 * Element by element and by wall-clock day, never a sum and never a bound: GDD
 * §4.4 records a legal input that moved 2362 of 34338 lists while leaving every
 * aggregate identical. Both directions are counted, because a sweep that
 * counted only violations could not tell a clean engine from an inert one.
 */
export interface EngagementDivergence {
  /** Elements compared across both series. Zero makes every count below empty. */
  readonly comparedElements: number;
  readonly movedElements: number;
  /** Days the more-engaged gym paid LESS Training IQ. The violating direction. */
  readonly trainingIqLower: number;
  readonly trainingIqHigher: number;
  /** Days the more-engaged gym saved FEWER injury days. Also violating. */
  readonly physioLower: number;
  readonly physioHigher: number;
  readonly worstTrainingIqDeficit: number;
  readonly worstPhysioDeficit: number;
  /** 1 when the more-engaged gym's physio arrived later, else 0. */
  readonly physioArrivalLater: number;
  readonly physioArrivalEarlier: number;
  /** Days later, when it was later. Zero otherwise. */
  readonly physioArrivalDeficitDays: number;
  /** Whether either side saw physio arrive at all, inside this horizon. */
  readonly physioArrived: boolean;
  /** `true` when the two ledgers are not even the same shape. */
  readonly lengthDiffers: boolean;
  readonly violating: boolean;
}

/** The arrival day out of a series, or `null` when it never arrived. */
function arrivalOf(series: readonly number[]): number | null {
  for (let at = 0; at < series.length; at += 1) {
    const amount = series[at];
    if (amount !== undefined && amount > 0) return at;
  }
  return null;
}

/**
 * Compare a less-engaged run against a more-engaged one, element by element.
 *
 * A run that never reached physio is treated as arriving one day past the
 * horizon rather than as absent, so "the diligent lifter's physio never came
 * and the idle one's did" counts as later by a real number of days instead of
 * falling out of the comparison. That case is reachable: the check-in upkeep
 * control produces it.
 */
export function compareEngagement(
  baseline: EngagementRun,
  moreEngaged: EngagementRun,
): EngagementDivergence {
  const leftIq = amountSeries(baseline.ledger, 'training-iq');
  const rightIq = amountSeries(moreEngaged.ledger, 'training-iq');
  const leftPhysio = amountSeries(baseline.ledger, 'physio-days-saved');
  const rightPhysio = amountSeries(moreEngaged.ledger, 'physio-days-saved');

  let comparedElements = 0;
  let movedElements = 0;
  let trainingIqLower = 0;
  let trainingIqHigher = 0;
  let physioLower = 0;
  let physioHigher = 0;
  let worstTrainingIqDeficit = 0;
  let worstPhysioDeficit = 0;

  const iqLength = Math.min(leftIq.length, rightIq.length);
  for (let at = 0; at < iqLength; at += 1) {
    const left = leftIq[at];
    const right = rightIq[at];
    if (left === undefined || right === undefined) continue;
    comparedElements += 1;
    if (left !== right) movedElements += 1;
    if (right < left) {
      trainingIqLower += 1;
      worstTrainingIqDeficit = Math.max(worstTrainingIqDeficit, left - right);
    }
    if (right > left) trainingIqHigher += 1;
  }
  const physioLength = Math.min(leftPhysio.length, rightPhysio.length);
  for (let at = 0; at < physioLength; at += 1) {
    const left = leftPhysio[at];
    const right = rightPhysio[at];
    if (left === undefined || right === undefined) continue;
    comparedElements += 1;
    if (left !== right) movedElements += 1;
    if (right < left) {
      physioLower += 1;
      worstPhysioDeficit = Math.max(worstPhysioDeficit, left - right);
    }
    if (right > left) physioHigher += 1;
  }

  const horizon = Math.max(leftPhysio.length, rightPhysio.length);
  const leftArrival = arrivalOf(leftPhysio);
  const rightArrival = arrivalOf(rightPhysio);
  const leftDay = leftArrival ?? horizon;
  const rightDay = rightArrival ?? horizon;
  const later = rightDay > leftDay ? 1 : 0;
  const earlier = rightDay < leftDay ? 1 : 0;

  const violating = trainingIqLower > 0 || physioLower > 0 || later > 0;
  return Object.freeze({
    comparedElements,
    movedElements,
    trainingIqLower,
    trainingIqHigher,
    physioLower,
    physioHigher,
    worstTrainingIqDeficit,
    worstPhysioDeficit,
    physioArrivalLater: later,
    physioArrivalEarlier: earlier,
    physioArrivalDeficitDays: later === 1 ? rightDay - leftDay : 0,
    physioArrived: leftArrival !== null || rightArrival !== null,
    lengthDiffers: baseline.ledger.length !== moreEngaged.ledger.length,
    violating,
  });
}

// ---------------------------------------------------------------------------
// The tally
// ---------------------------------------------------------------------------

/**
 * Every comparison a sweep took, folded.
 *
 * The counts a violation needs are here, and so are the counts that say the
 * sweep looked at anything: `pairs`, `comparedElements`, `movedPairs` and
 * `pairsWherePhysioArrived`. CLAUDE.md asks every sweep for a non-vacuity guard
 * that pins what it actually saw, in counts rather than bounds, and the physio
 * one is load-bearing here — measured, a coarse enough grid never reaches a
 * physio level at all, and a zero taken there would be a zero about a hook that
 * never fired.
 */
export interface EngagementTally {
  readonly pairs: number;
  readonly comparedElements: number;
  readonly movedPairs: number;
  readonly movedElements: number;
  readonly violatingPairs: number;
  readonly trainingIqLower: number;
  readonly trainingIqHigher: number;
  readonly physioLower: number;
  readonly physioHigher: number;
  readonly physioArrivalLater: number;
  readonly physioArrivalEarlier: number;
  readonly pairsWherePhysioArrived: number;
  readonly worstTrainingIqDeficit: number;
  readonly worstPhysioDeficit: number;
  readonly worstArrivalDeficitDays: number;
  readonly lengthMismatches: number;
}

/** An empty tally. Every count zero, which is the state a dead sweep reports. */
export function emptyEngagementTally(): EngagementTally {
  return Object.freeze({
    pairs: 0,
    comparedElements: 0,
    movedPairs: 0,
    movedElements: 0,
    violatingPairs: 0,
    trainingIqLower: 0,
    trainingIqHigher: 0,
    physioLower: 0,
    physioHigher: 0,
    physioArrivalLater: 0,
    physioArrivalEarlier: 0,
    pairsWherePhysioArrived: 0,
    worstTrainingIqDeficit: 0,
    worstPhysioDeficit: 0,
    worstArrivalDeficitDays: 0,
    lengthMismatches: 0,
  });
}

/** Fold one comparison into a tally. */
export function addEngagement(
  tally: EngagementTally,
  divergence: EngagementDivergence,
): EngagementTally {
  return Object.freeze({
    pairs: tally.pairs + 1,
    comparedElements: tally.comparedElements + divergence.comparedElements,
    movedPairs: tally.movedPairs + (divergence.movedElements > 0 ? 1 : 0),
    movedElements: tally.movedElements + divergence.movedElements,
    violatingPairs: tally.violatingPairs + (divergence.violating ? 1 : 0),
    trainingIqLower: tally.trainingIqLower + divergence.trainingIqLower,
    trainingIqHigher: tally.trainingIqHigher + divergence.trainingIqHigher,
    physioLower: tally.physioLower + divergence.physioLower,
    physioHigher: tally.physioHigher + divergence.physioHigher,
    physioArrivalLater: tally.physioArrivalLater + divergence.physioArrivalLater,
    physioArrivalEarlier: tally.physioArrivalEarlier + divergence.physioArrivalEarlier,
    pairsWherePhysioArrived: tally.pairsWherePhysioArrived + (divergence.physioArrived ? 1 : 0),
    worstTrainingIqDeficit: Math.max(
      tally.worstTrainingIqDeficit,
      divergence.worstTrainingIqDeficit,
    ),
    worstPhysioDeficit: Math.max(tally.worstPhysioDeficit, divergence.worstPhysioDeficit),
    worstArrivalDeficitDays: Math.max(
      tally.worstArrivalDeficitDays,
      divergence.physioArrivalDeficitDays,
    ),
    lengthMismatches: tally.lengthMismatches + (divergence.lengthDiffers ? 1 : 0),
  });
}

// ---------------------------------------------------------------------------
// The runtime shadow of the claims above
// ---------------------------------------------------------------------------

/**
 * Every invariant a run and its census have to satisfy, as a list of messages —
 * the same shape as `empireRunFaults`, and for the same reason: a claim in a
 * header is graded by nothing.
 *
 * It does not re-derive `compareEngagement`. An oracle that recomputes its
 * subject's own comparison cannot disagree with it.
 */
export function engagementRunFaults(run: EngagementRun): readonly string[] {
  const faults: string[] = [];
  if (run.ledger.length === 0) {
    faults.push('the run produced no ledger at all');
  }
  if (run.census.checkIns > run.census.slots) {
    faults.push(`${run.census.checkIns} check-ins were taken on a grid of ${run.census.slots} slots`);
  }
  if (!chargesUpkeep(run.wiring.key) && run.census.upkeepEvents !== 0) {
    faults.push(`the ${run.wiring.key} wiring charged upkeep on ${run.census.upkeepEvents} events`);
  }
  if (run.wiring.key === 'check-in-upkeep' && run.census.upkeepEvents !== run.census.checkIns) {
    faults.push(
      `the check-in upkeep charged on ${run.census.upkeepEvents} events across ${run.census.checkIns} check-ins`,
    );
  }
  const physio = amountSeries(run.ledger, 'physio-days-saved');
  const arrival = arrivalOf(physio);
  if (arrival !== run.census.physioArrivalDay) {
    faults.push(
      `the census reports physio arriving on day ${String(run.census.physioArrivalDay)} and the ledger says ${String(arrival)}`,
    );
  }
  for (const amount of physio) {
    if (amount > EMPIRE_TUNING.PHYSIO_MAX_DAYS_SAVED) {
      faults.push(`a day saved ${amount} days, which is above the physio budget`);
    }
  }
  for (const amount of amountSeries(run.ledger, 'training-iq')) {
    if (amount > EMPIRE_TUNING.TRAINING_IQ_DAILY_CEILING) {
      faults.push(`a day paid ${amount} Training IQ, which is above the daily budget`);
    }
  }
  return faults;
}
