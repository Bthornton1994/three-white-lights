/**
 * streakEntitlement.ts — what funds a streak save, since GDD §4.2's Option 1
 * ruling: a ROLLING ENTITLEMENT, not a balance the lifter holds.
 *
 * PURE MODULE (CLAUDE.md "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock, no randomness, explicit return types on
 * every export. It never sees a day directly — it takes WINDOW INDICES, which
 * `streak.ts` computes from the civil-day arithmetic that lives there, so there
 * is exactly one place in the codebase that knows what a day is.
 *
 * ===========================================================================
 * 1. WHY THIS EXISTS — THE DEFECT IT REPLACES, IN ONE PARAGRAPH
 * ===========================================================================
 *
 * Coverage used to be funded by `recoveryDayBalance`, a stock the lifter held.
 * GDD §4.2 RULE 2 debits a DOOMED absence the whole armed holding, which is
 * what makes splitting a doomed absence cost the same as leaving it whole — and
 * that is exactly why the exhaustive 8-to-16-day sweep is clean. The same rule
 * makes the debit PROPORTIONAL TO WEALTH, and training one more day is a way of
 * being wealthy at the wrong moment: a spared save leaves a Recovery Day in the
 * bank, an earlier milestone puts one there. So the lifter who trained more
 * walked into a doomed absence richer, lost more, and died at a later absence
 * the lazier lifter survived. Measured at 13 / 122 / 142 / 74 violating pairs at
 * 40 / 60 / 80 / 100 days, with lifetime-best inversions of 14 / 150 / 276 /
 * 221 and a worst deficit that reached 189 at 400 days. GDD §4.4 has the trace.
 *
 * THE FIX IS TO DELETE THE WEALTH, NOT THE RULE. An entitlement of
 * `COVERED_DAYS_PER_WINDOW` days per window of `WINDOW_DAYS` days is not a
 * holding: it is the same number for everybody at the start of every window, so
 * there is no wealth for a debit to be proportional to. Two lifters who differ
 * inside a window RE-CONVERGE at its boundary, which a stock never did.
 *
 * ===========================================================================
 * 2. THE BURN RULE IS KEPT, AND KEEPING IT IS LOAD-BEARING
 * ===========================================================================
 *
 * A doomed absence still consumes everything left in the window
 * (`resolveEntitlement` returns `consumed = availableBefore` when it does not
 * hold). It is tempting to drop it — the rule reads as harsh and it is the rule
 * whose wealth-dependence caused the defect — and dropping it is measurably
 * much worse than the design it replaces: **673 violating pairs at 100 days
 * against 0**, and 1051 at 60 days.
 *
 * The reason is the same subadditivity argument GDD §4.2 makes and is worth
 * restating in the new terms. Adding a trained day SPLITS one absence into two
 * shorter ones. On the covered branch the consumption is `max(0, len - grace)`,
 * which is subadditive, so splitting can only consume less. On the doomed
 * branch there is no such arithmetic — so the consumption has to be IDEMPOTENT
 * UNDER SPLITTING instead, and "take everything that is left" is idempotent
 * because the second piece finds nothing. Take less than everything and two
 * doomed pieces cost more than one doomed whole, which is the free-lunch shape
 * again.
 *
 * WHAT IS DIFFERENT FROM THE STOCK, and it is the whole of the fix: "everything
 * that is left" is bounded by `COVERED_DAYS_PER_WINDOW` and is restored at the
 * next window boundary regardless of what happened. Two lifters who are burned
 * for different amounts are both left on zero and are identical again at the
 * boundary. Under a stock the same burn left a permanent difference, because
 * the income that refilled it was paid once per lifetime.
 *
 * ===========================================================================
 * 3. WHAT MAY AND MAY NOT ADD COVERED DAYS (GDD §8.2, §8.3)
 * ===========================================================================
 *
 * `grantCoveredDays` widens the CURRENT window's entitlement. It expires with
 * the window; nothing accumulates. That is the shape a purchase or a season
 * reward has to take, and the constraint on it is measured rather than
 * asserted:
 *
 *   - A grant that lands on a FIXED CALENDAR DAY — one neither lifter's
 *     training can move — is monotone-safe. 0 violating pairs at 100 days
 *     across six grant schedules, including grants landing exactly on a window
 *     boundary.
 *   - A grant keyed to the STREAK reaching a length reintroduces the defect:
 *     54 violating pairs and 239 lifetime-best inversions at 100 days.
 *   - A grant keyed to the NUMBER OF SESSIONS — the shape a season-pass tier
 *     normally has — is the worst of the three: **1156 violating pairs, worst
 *     deficit 54**, at one tier per ten sessions.
 *
 * SO THE RULE IS: pay covered days on the CALENDAR, never on progress. A season
 * pass may pay them in week 3 of the season; it may not pay them at tier 4.
 * `streakEntitlement.test.ts` measures all three and pins them, so a future
 * earning table that keys off progress fails a test rather than a playtest.
 *
 * THIS MODULE PRICES NOTHING and knows nothing about currency. It receives an
 * already-decided grant, exactly as the Recovery Day grant path did.
 */

/**
 * The tunables. CLAUDE.md "Game Feel Values Must Be Tunable": one home, named,
 * and NONE of these are playtested — they are plausible starting values that
 * keep GDD §4.2's promise that a week away ends a run.
 */
export interface EntitlementTuning {
  readonly COVERED_DAYS_PER_WINDOW: number;
  readonly WINDOW_DAYS: number;
  readonly MAX_COVERED_DAYS_PER_ABSENCE: number;
}

export const RECOVERY_ENTITLEMENT: EntitlementTuning = {
  /**
   * Covered days granted at the start of every window. The replacement for the
   * hold cap and the earning table at once: everybody has this many, always.
   *
   * 2 so that `LONGEST_REPAIRABLE_ABSENCE_DAYS` — grace plus this — stays at
   * four days, which is the ceiling GDD §4.2 already promises. UNTUNED.
   */
  COVERED_DAYS_PER_WINDOW: 2,

  /**
   * How long a window is, in civil days.
   *
   * 30 because GDD §4.2's old milestone schedule paid at 7 / 30 / 100 and a
   * month is the unit a lifter already thinks in — a training block. It is NOT
   * load-bearing for the monotonicity property: measured clean at 1, 2, 3, 4, 5,
   * 7, 13, 29, 30, 31, 60 and 365 days. It is load-bearing for how forgiving
   * the game feels, which is a playtesting question. UNTUNED.
   */
  WINDOW_DAYS: 30,

  /**
   * Most covered days one absence may use, even when the window has more left.
   *
   * The direct heir of `MAX_CONSECUTIVE_USES`, and it is kept as a separate
   * number for the same reason that one was: the window entitlement is a RATE
   * and this is a per-absence CEILING. They are 2 and 2 today by coincidence of
   * tuning. Raise `COVERED_DAYS_PER_WINDOW` to 5 without raising this and a
   * lifter still cannot buy their way through a week away. UNTUNED.
   */
  MAX_COVERED_DAYS_PER_ABSENCE: 2,
};

/**
 * The longest absence a live run can survive, given a full window entitlement:
 * the free grace plus what one absence may draw.
 *
 * DERIVED, NOT TUNED. `streak.ts` owns the grace, so it composes this; the
 * value here is the entitlement half.
 */
export const MAX_COVERED_DAYS_ONE_ABSENCE_MAY_DRAW: number = Math.min(
  RECOVERY_ENTITLEMENT.COVERED_DAYS_PER_WINDOW,
  RECOVERY_ENTITLEMENT.MAX_COVERED_DAYS_PER_ABSENCE,
);

/**
 * THE COMPLETE SET OF FIELDS `EntitlementState` MAY HAVE.
 *
 * Same mechanism, and same reason, as `STREAK_FACT_KEYS` in `streak.ts`: this
 * is the only thing a purchased covered day can reach, so what it can reach is
 * an allowlist rather than a promise. Nothing here is a streak, a load, or a
 * pace. Adding a field fails `tsc` until it is listed under this comment.
 */
export const ENTITLEMENT_FACT_KEYS = ['windowIndex', 'coveredDaysLeft', 'purchasedDaysLeft'] as const;

export type EntitlementFactKey = (typeof ENTITLEMENT_FACT_KEYS)[number];

type KeysAreExactly<T, Keys extends string> = [Exclude<keyof T, Keys>] extends [never]
  ? [Exclude<Keys, keyof T>] extends [never]
    ? true
    : never
  : never;

/**
 * The entitlement as of a lifter's last session. JSON-safe.
 *
 * IT IS A SNAPSHOT, NOT A LEDGER. There is no history of past absences here and
 * no list of days. Everything an absence needs is these three numbers and the
 * window the absence ENDS in, which is what keeps the outcome a pure function
 * of the calendar.
 */
export interface EntitlementState {
  /** Window the lifter's last session fell in. */
  readonly windowIndex: number;
  /** Entitlement left in THAT window. Meaningless once the window has passed. */
  readonly coveredDaysLeft: number;
  /**
   * Extra covered days added to that same window by a grant (GDD §8.2's
   * purchase path). EXPIRES WITH THE WINDOW — it is a widening of a rate, not a
   * balance, and that is the property that keeps it monotone-safe.
   */
  readonly purchasedDaysLeft: number;
}

/** Compile-time assertion that the allowlist above is exact in both directions. */
export const ENTITLEMENT_REACH_IS_COVERAGE_ONLY: KeysAreExactly<EntitlementState, EntitlementFactKey> = true;

/**
 * The window a day falls in, counted from the account's signup day.
 *
 * ANCHORED AT SIGNUP, not at a calendar month, so it is a fixed grid that
 * nothing the lifter does can shift. Two possible futures from the same state
 * share the same grid, which is what the monotonicity property needs.
 *
 * Negative for days before signup, which cannot happen in a well-formed state
 * but is defined rather than clamped so the function is total.
 */
export function windowIndexOf(tuning: EntitlementTuning, signupDay: number, day: number): number {
  return Math.floor((day - signupDay) / tuning.WINDOW_DAYS);
}

/** First day of the window a day falls in. */
export function windowStartDay(tuning: EntitlementTuning, signupDay: number, day: number): number {
  return signupDay + windowIndexOf(tuning, signupDay, day) * tuning.WINDOW_DAYS;
}

/** The entitlement a brand-new account starts on: a full window, nothing bought. */
export function freshEntitlement(tuning: EntitlementTuning, windowIndex: number): EntitlementState {
  return {
    windowIndex,
    coveredDaysLeft: tuning.COVERED_DAYS_PER_WINDOW,
    purchasedDaysLeft: 0,
  };
}

/**
 * Covered days this state has available in `windowNow` — the whole entitlement
 * again if the window has turned over, and what is left of it if it has not.
 *
 * A WINDOW THAT HAS TURNED OVER RESETS BOTH PARTS. Unused entitlement does not
 * carry, and neither does an unused purchased day: both are a rate for that
 * window. That is stated rather than left to be discovered, because a player who
 * buys a covered day and does not miss a day has spent money on nothing, and
 * the store copy has to say so.
 */
export function coveredDaysAvailable(
  tuning: EntitlementTuning,
  state: EntitlementState,
  windowNow: number,
): number {
  if (windowNow > state.windowIndex) return tuning.COVERED_DAYS_PER_WINDOW;
  return Math.max(0, state.coveredDaysLeft) + Math.max(0, state.purchasedDaysLeft);
}

/** What an absence needing `chargeableDays` does to the entitlement. */
export interface EntitlementOutcome {
  /** True when the entitlement can hold the absence open. */
  readonly covers: boolean;
  /** Covered days available before the absence resolved. */
  readonly availableBefore: number;
  /**
   * Covered days this absence consumes: the chargeable days when it holds, and
   * EVERYTHING LEFT IN THE WINDOW when it does not. See §2 of the header for
   * why the doomed branch takes the lot — it is the idempotence that makes
   * splitting a doomed absence free, and it is measured at 673 violating pairs
   * if it takes anything less.
   */
  readonly consumed: number;
  /** What is left in the window afterwards. */
  readonly availableAfter: number;
  /** Most this absence was allowed to draw, ceiling included. */
  readonly drawableByThisAbsence: number;
}

/**
 * Resolves an absence against the entitlement.
 *
 * PURE IN `(state, windowNow, chargeableDays)` AND NOTHING ELSE. The day the
 * player opened the app is not a parameter and cannot become one, which is the
 * invariant GDD §4.2 exists for, carried over intact.
 *
 * @throws {RangeError} if `chargeableDays` is not a whole number of at least 0.
 */
export function resolveEntitlement(
  tuning: EntitlementTuning,
  state: EntitlementState,
  windowNow: number,
  chargeableDays: number,
): EntitlementOutcome {
  if (!Number.isSafeInteger(chargeableDays) || chargeableDays < 0) {
    throw new RangeError(
      `streakEntitlement: chargeable days must be a whole number of at least 0, received ${chargeableDays}`,
    );
  }
  const availableBefore = coveredDaysAvailable(tuning, state, windowNow);
  const drawableByThisAbsence = Math.min(availableBefore, tuning.MAX_COVERED_DAYS_PER_ABSENCE);
  const covers = chargeableDays <= drawableByThisAbsence;
  const consumed = covers ? chargeableDays : availableBefore;
  return {
    covers,
    availableBefore,
    consumed,
    availableAfter: availableBefore - consumed,
    drawableByThisAbsence,
  };
}

/**
 * The entitlement after a session on `windowNow` that consumed `consumed`
 * covered days.
 *
 * THE GRANTED ENTITLEMENT IS SPENT BEFORE THE PURCHASED ONE, deliberately: a
 * purchased day then survives as long as it can inside its window rather than
 * being burned first for something the free entitlement would have covered.
 * Both orders were measured monotone-safe, so this is the kinder of two equally
 * correct choices rather than a constraint.
 *
 * @throws {RangeError} if `consumed` is not a whole number of at least 0.
 */
export function afterSession(
  tuning: EntitlementTuning,
  state: EntitlementState,
  windowNow: number,
  consumed: number,
): EntitlementState {
  if (!Number.isSafeInteger(consumed) || consumed < 0) {
    throw new RangeError(
      `streakEntitlement: consumed days must be a whole number of at least 0, received ${consumed}`,
    );
  }
  const turnedOver = windowNow > state.windowIndex;
  const baseBefore = turnedOver ? tuning.COVERED_DAYS_PER_WINDOW : Math.max(0, state.coveredDaysLeft);
  const purchasedBefore = turnedOver ? 0 : Math.max(0, state.purchasedDaysLeft);
  const fromBase = Math.min(baseBefore, consumed);
  const fromPurchased = Math.min(purchasedBefore, consumed - fromBase);
  return {
    windowIndex: windowNow,
    coveredDaysLeft: baseBefore - fromBase,
    purchasedDaysLeft: purchasedBefore - fromPurchased,
  };
}

/** What a grant of covered days did. Reported, never silent. */
export interface CoveredDayGrantOutcome {
  readonly state: EntitlementState;
  /** Covered days that actually landed. */
  readonly credited: number;
  /** The window they expire at the end of, so a UI can say when. */
  readonly expiresAfterWindowIndex: number;
  /** Covered days available in this window once the grant has landed. */
  readonly availableAfter: number;
}

/**
 * Widens the CURRENT window's entitlement by `amount` covered days.
 *
 * THIS IS THE ENTIRE PURCHASE SURFACE and it is deliberately the only one. It
 * cannot bank anything for a later window, so nothing accumulates and there is
 * no wealth for a doomed absence to be proportional to — which is what makes a
 * purchased covered day monotone-safe where a purchased Recovery Day was not.
 *
 * IT TAKES NO SOURCE, for the reason `recordTrainingDay` took none: with no
 * provenance stored, no code path can make a bought covered day behave
 * differently from a granted one.
 *
 * WHAT A CALLER MUST NOT DO, and the measurement that says so is in §3 of the
 * header: do not call this on a day the lifter's own training decides. A grant
 * keyed to the streak or to a session count reintroduces the defect this whole
 * module exists to remove. Calendar days only.
 *
 * @throws {RangeError} if `amount` is not a whole number of at least 1.
 */
export function grantCoveredDays(
  tuning: EntitlementTuning,
  state: EntitlementState,
  windowNow: number,
  amount: number,
): CoveredDayGrantOutcome {
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new RangeError(
      `streakEntitlement: a covered-day grant must be a whole number of at least 1, received ${amount}`,
    );
  }
  const turnedOver = windowNow > state.windowIndex;
  const base = turnedOver ? tuning.COVERED_DAYS_PER_WINDOW : Math.max(0, state.coveredDaysLeft);
  const purchased = (turnedOver ? 0 : Math.max(0, state.purchasedDaysLeft)) + amount;
  const next: EntitlementState = {
    windowIndex: windowNow,
    coveredDaysLeft: base,
    purchasedDaysLeft: purchased,
  };
  return {
    state: next,
    credited: amount,
    expiresAfterWindowIndex: windowNow,
    availableAfter: base + purchased,
  };
}
