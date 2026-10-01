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
 * against 0**, and 1051 at 60 days. Both are cells of
 * `streakSweep.DOOMED_BURN_COUNTERFACTUAL`, re-derived on every run by
 * `[dropping-the-doomed-burn-measures-worse]`; the 100-day half used to be
 * restated in four places and asserted in none, and it was re-taken rather than
 * trusted when that was noticed.
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
 * `creditCoveredDays` widens the CURRENT window's entitlement. It expires with
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
 * WHAT THE EXPIRY IS AND IS NOT DOING, corrected TWICE and the second
 * correction is a retraction. A purchased day expiring with its window is a
 * PRODUCT decision, not a safety property — that much stands.
 *
 * WHAT DOES NOT STAND is the sentence this paragraph used to carry: "a bankable
 * purchased day is monotone-safe too, at 0 violating pairs across three
 * purchase schedules". That zero was measured on FIXED CALENDAR purchase days
 * only, which is the arm where the EXPIRING product is also zero — so it was
 * never evidence about banking. Re-measured with the purchase funded the way a
 * real player funds it, a bankable day violates on exactly the arm the expiring
 * one violates on: 77 / 275 / 696 / 681 violating pairs at 40 / 60 / 80 / 100
 * when the funding is training-keyed, against 54 as the expiring product's
 * worst deficit and 14 as bankable's. A difference in severity, not in kind.
 *
 * SO NEITHER PRODUCT IS SAFE AGAINST TRAINING-KEYED FUNDING, and the funding is
 * what §3b and `currencyProvenance.ts` close. What survives is the comparison:
 * bankable is clean exactly where expiring is clean and violates exactly where
 * expiring violates, so switching the product buys no safety and costs none,
 * and the choice stays a pricing and feel decision.
 *
 * THE BURN IS WHAT KEEPS A CALENDAR-FUNDED PURCHASE SAFE, NOT THE EXPIRY. A
 * doomed absence takes everything available including whatever was banked, so
 * two lifters holding different amounts are both left on zero, and the
 * entitlement refreshes them identically at the next boundary.
 *
 * THIS MODULE PRICES NOTHING and knows nothing about currency. It receives an
 * already-decided credit, exactly as the Recovery Day grant path did.
 *
 * ===========================================================================
 * 3b. PROVENANCE: WHY THERE IS A SOURCE NOW, AND WHY IT IS NOT THE BRANCH THE
 *     PAY-TO-WIN ARGUMENT BANS
 * ===========================================================================
 *
 * GDD §8.3E is RULED IN. `purchasedDaysLeft` is live, and a covered day now
 * arrives from one of exactly two places — `COVERAGE_SOURCES`:
 *
 *   - `'window-entitlement'`: the rolling window every account has on identical
 *     terms, plus any CALENDAR-KEYED grant that widens it (GDD §8.3C's season
 *     pass paying in week 3). Free. Never bought.
 *   - `'purchase'`: bought, for money or for Chalk. Never granted, never earned,
 *     never awarded by anything the lifter does.
 *
 * THE OLD ARGUMENT SAID "NO PROVENANCE TO BRANCH ON", AND THAT ARGUMENT IS
 * INTACT — because it was about the SPEND path, and this is the CREDIT path.
 * `resolveEntitlement` still takes no source, cannot see the split, and cannot
 * be given one: `coveredDaysAvailable` SUMS the two counters and every decision
 * downstream reads the sum. What a purchased covered day *does* is therefore
 * identical to what an entitlement covered day does, which is the property the
 * no-pay-to-win rule actually requires.
 *
 * AND FOR THE SHIPPED (EXPIRING) PRODUCT THE SPLIT IS NOT MERELY UNUSED, IT IS
 * UNOBSERVABLE. Every read is of `b + p`; `afterSession` subtracts the same
 * total whichever counter it comes out of; and a window turnover resets `b` to
 * the full entitlement and `p` to zero regardless of either. So the state
 * `(b, p)` and the state `(b + p, 0)` behave identically forever.
 * `streakEntitlement.test.ts` proves that over every split at every sum rather
 * than asserting it, which is what lets the provenance be REPORTED without it
 * being a mechanic. Under a BANKABLE purchased day the split would become
 * observable — that is the one thing switching the product would change about
 * this paragraph, and it is flagged rather than glossed.
 *
 * THE SOURCE IS MANDATORY, and that is the point of it. There is no way to
 * credit a covered day without naming where it came from, so "an in-game action
 * awarded a purchased day" is not something that can happen by omission.
 * `COVERED_DAY_TOUCHING_FUNCTIONS` below is the enforcement, and it is scoped to
 * COVERAGE rather than to purchases — see its header for why the purchase-only
 * scope was a measured hole rather than a wording choice.
 *
 * ===========================================================================
 * 3c. AND THE SOURCE IS NOT ENOUGH, BECAUSE THE MONEY HAS A PROVENANCE TOO
 * ===========================================================================
 *
 * `'purchase'` says a covered day was bought. It says nothing about where the
 * money came from, and that is where the defect walked back in: an achievement
 * pays Chalk, Chalk buys a covered day, and the arrival day of a `'purchase'`
 * is back under the lifter's own training with a currency in between. Measured
 * on the shipped engine with matched purse and price: 105 / 305 / 733 / 785
 * violating pairs at 40 / 60 / 80 / 100 days, worst deficit 54, against 0 for
 * the same purse funded on the calendar and 0 for no purchase at all. The
 * purchase does not worsen those violations, it creates them.
 *
 * `currencyProvenance.ts` closes it, and closes it in the TYPE:
 * `SettledCoveredDayPurchase.tender` is `NonTrainingGatedTender`, so
 * achievement Chalk and season-pass-tier Chalk cannot be written into a
 * purchase at all. THIS MODULE IS UNCHANGED BY THAT and deliberately: it still
 * prices nothing, still knows nothing about currency, and still takes an
 * already-decided credit. The gate is at the door, not in the room.
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
   * splitting a doomed absence free.
   *
   * THE FIGURE THAT USED TO SIT HERE SAID "673 VIOLATING PAIRS IF IT TAKES
   * ANYTHING LESS", AND THAT OVERSTATED WHAT WAS MEASURED. The counterfactual
   * behind it is the doomed branch taking NOTHING, which is one point, not the
   * whole family of smaller consumptions; no intermediate rule has ever been
   * run. The measured row is in `streakSweep.DOOMED_BURN_COUNTERFACTUAL`.
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

// ---------------------------------------------------------------------------
// Provenance (GDD §8.2, §8.3E). See §3b of the header.
// ---------------------------------------------------------------------------

/**
 * THE COMPLETE SET OF PLACES A COVERED DAY MAY COME FROM.
 *
 * Two, and they are not interchangeable. `'window-entitlement'` is the free
 * side — the rolling window plus any calendar-keyed grant widening it.
 * `'purchase'` is the bought side and is the ONLY thing that may ever credit
 * `purchasedDaysLeft`.
 *
 * Adding a third fails `tsc` at `COVERAGE_SOURCE_COUNTER` until it declares
 * which counter it lands in, which is the edit that has to be argued for: a
 * source that lands in `purchasedDaysLeft` without being a purchase is
 * precisely the defect GDD §8.3E's condition 3 forbids.
 */
export const COVERAGE_SOURCES = ['window-entitlement', 'purchase'] as const;

export type CoverageSource = (typeof COVERAGE_SOURCES)[number];

/**
 * Which counter each source credits — exhaustive by `satisfies`, so a new
 * source cannot ship without an answer and a renamed counter cannot leave a
 * stale one behind.
 *
 * IT IS A CREDIT-SIDE MAP AND NOTHING READS IT ON THE SPEND SIDE. See §3b:
 * `resolveEntitlement` has no source parameter and `coveredDaysAvailable` sums
 * both counters, so this decides where a day is *written*, never what it *does*.
 */
export const COVERAGE_SOURCE_COUNTER = {
  'window-entitlement': 'coveredDaysLeft',
  purchase: 'purchasedDaysLeft',
} as const satisfies Readonly<Record<CoverageSource, EntitlementFactKey>>;

/**
 * THE ONLY SOURCE THAT MAY CREDIT `purchasedDaysLeft`, derived from the map
 * above rather than written beside it.
 * `@guarantee one-source-credits-a-purchased-day`
 *
 * GDD §8.3E condition 3, as a value a test can read: a purchased covered day is
 * never grantable, earnable or awarded by an in-game action. Re-point
 * `COVERAGE_SOURCE_COUNTER['window-entitlement']` at `purchasedDaysLeft` and
 * this stops being a single source, which `streakEntitlement.test.ts` fails on.
 */
export const SOURCES_THAT_CREDIT_A_PURCHASED_DAY: readonly CoverageSource[] = COVERAGE_SOURCES.filter(
  (source) => COVERAGE_SOURCE_COUNTER[source] === 'purchasedDaysLeft',
);

/**
 * EVERY TOP-LEVEL DECLARATION ANYWHERE UNDER `src/` ALLOWED TO NAME A COVERED
 * DAY — the enforcement half of CLAUDE.md's "no grant of covered days may be
 * keyed to anything the lifter does" and of GDD §8.3E's condition 3, that a
 * purchased day is never grantable, earnable or awarded.
 *
 * THE SCOPE IS COVERAGE, NOT PURCHASES, AND THAT IS THE CORRECTION THIS ROUND
 * MADE. The list used to be called `PURCHASED_DAY_TOUCHING_FUNCTIONS` and the
 * scan behind it keyed on the single word `purchas`. The rule it stands in
 * front of has never been about purchased days — CLAUDE.md says *covered*
 * days, and `COVERAGE_SOURCES` above declares TWO sources, of which
 * `'window-entitlement'` is the free side. A declaration that widens the window
 * through that source contains no form of the word "purchase" and was
 * therefore INVISIBLE, exactly the way a module outside `src/game/` used to be.
 * `@guarantee the-covered-day-scan-reads-the-whole-tree`
 *
 * THAT HOLE WAS EXECUTED, NOT REASONED ABOUT. A function awarding coverage
 * every ten sessions through `creditCoveredDays(..., 'window-entitlement')` was
 * appended to `src/shell/appServer.ts`; `streakEntitlement.test.ts` ran 43
 * tests, all green, and `tsc --noEmit` was clean beside it. That is the shape
 * CLAUDE.md measures at **1156 violating pairs** when a covered day is granted
 * every N sessions, against 0 on a fixed calendar day. It would have shipped.
 *
 * THE FILE SET IS DERIVED FROM THE TREE, NOT LISTED HERE, and that replaced a
 * hardcoded three-filename list. The old list's own comment argued that a THIRD
 * file had to be scanned because the laundered path — an achievement pays
 * Chalk, Chalk buys a covered day — was invisible to the other two. That
 * argument reaches a fourth file and nothing derived it; and the reader it used
 * resolved names against `src/game/`, so a module in any other directory was
 * unreachable BY CONSTRUCTION rather than by omission. The scanned set had
 * already come apart from the set that matters: `progression.ts` named the
 * purchased counter and was not scanned, while `currencyProvenance.ts` was
 * scanned and named neither the counter nor the `'purchase'` source.
 *
 * WHY A LIST OF DECLARATION NAMES AND NOT A RULE ABOUT NAMING. The obvious
 * guard is a blocklist on words like `grant`, `credit`, `buy`, `award` — and
 * `streak.test.ts` used to carry exactly that. It cannot catch
 * `markStreakMilestone` handing out a purchased day, because the mutant simply
 * does not use any of those words. This keys on THE THING instead of on the
 * VOCABULARY: any declaration whose body says `purchas` OR names a covered day
 * (`/purchas|covered.?day/i`), under any name and in any directory, has to
 * appear here, and `streakEntitlement.test.ts` asserts the set is exact in BOTH
 * directions — a stale entry fails too, because an allowlist that can only grow
 * is one nobody prunes.
 *
 * SO ADDING AN IN-GAME ACTION THAT AWARDS COVERAGE IS A RED TEST, not a silent
 * success, whatever it is called and whichever source it credits. The visible
 * edit it forces is an entry in this list, sitting under this paragraph, where
 * a reviewer will see it.
 *
 * TYPES AND CONSTANTS ARE IN IT, NOT JUST FUNCTIONS, and deliberately: a `const`
 * holding an arrow function is a function, and a guard that only looked for the
 * `function` keyword would be walked around by one line of syntax.
 *
 * AN ALIASED IMPORT USED TO DEFEAT ALL OF IT, AND NO LONGER DOES.
 * `@guarantee the-covered-day-scan-follows-aliases`
 * Every predicate above is a textual match on a declaration BODY, and an import
 * sits above the first declaration — so it is in no body at all. A granter
 * written as
 *
 *     import { creditCoveredDays as credit, COVERAGE_SOURCES as SOURCES } from './streakEntitlement';
 *     export function widenForTenSessions(state, w, sessions) {
 *       return credit(RECOVERY_ENTITLEMENT, state, w, sessions, SOURCES[0]).state;
 *     }
 *
 * grants a covered day PER TRAINING SESSION — the shape CLAUDE.md measures at
 * 1156 violating pairs — and contains no matchable word. Planted in
 * `src/shell/appServer.ts` it ran **105 green tests** across this file,
 * `tuning/audit.test.ts` and `guaranteeTags.test.ts` with `tsc --noEmit` at
 * exit 0.
 *
 * BOTH ENDS HAVE TO BE ALIASED, which the limit as previously recorded did not
 * say: a body still spelling `'window-entitlement'` is caught by the third
 * alternative, and planting that version reddened three tests. Nor does a local
 * `const SRC = 'window-entitlement'` help a mutant — that const is itself a
 * declaration carrying the literal in its own body.
 *
 * `streakEntitlement.test.ts` now runs a SECOND, SYMBOL-RESOLVED pass beside the
 * textual one, asking the TypeScript checker what each identifier resolves to
 * and following import aliases and re-export chains. The allowlist is the UNION
 * of both, because neither contains the other: 88 textual, 32 symbol, 97 union.
 * The nine the symbol pass adds are marked in their own section below.
 *
 * IT IS A FLOOR AND NOT A CEILING, stated rather than glossed: a mutant that
 * awards a covered day from INSIDE a declaration already listed passes this,
 * and is caught by the behavioural drive in `streak.test.ts` — which runs every
 * other entry point over a long fuzzed history and asserts the field never
 * moves. Two guards, because neither one covers the other's blind spot. The
 * symbol pass has its own declared limit, pinned in its test: an identifier the
 * checker cannot follow to an export — a dynamic `import()`, an index read off
 * a namespace object — resolves to nothing and is invisible to it.
 *
 * MOST OF THIS LIST IS NOT ABOUT GRANTING A COVERED DAY, and that is the
 * deliberate cost of keying on two WORDS instead of on the identifiers that
 * carry one. Three predicates were measured on this tree and
 * `streakEntitlement.test.ts` pins all three:
 *
 *   - the narrow one (`purchasedDaysLeft` or `'purchase'`): 18 declarations, 3
 *     files. Rejected in a previous round — `applySettledCoveredDayPurchase` is
 *     the entry point money arrives on and its name contains neither token, so
 *     a declaration that merely CALLS it would match neither.
 *   - purchase-word-only (`/purchas/i`): 57 declarations, 7 files. What
 *     shipped, and what the probe above walked straight past.
 *   - the credit-token option (`creditCoveredDays`, `'window-entitlement'` and
 *     `coveredDaysLeft` added to the purchase word): 58 declarations, 7 files.
 *     THE TEMPTING ONE, and measurably not enough: it catches the probe and is
 *     blind to its SIBLING, a widener that keys `COVERED_DAYS_PER_WINDOW` to a
 *     session count and never calls the credit path at all. Naming the tokens
 *     you thought of is how the narrow predicate got rejected the first time.
 *   - this one (`/purchas|covered.?day/i`): 88 declarations, the SAME 7 files.
 *
 * The per-file sections below say which entries are load-bearing and which are
 * vocabulary the scan is honest about picking up.
 */
export const COVERED_DAY_TOUCHING_FUNCTIONS: readonly string[] = [
  // ---- streakEntitlement.ts -----------------------------------------------
  // THE TUNING, and it is on this list only since the predicate widened to
  // coverage. `COVERED_DAYS_PER_WINDOW` lives in `EntitlementTuning`, so a
  // widener that fabricates a tuning keyed to a session count never touches
  // `creditCoveredDays` and never says `purchas`. That is the sibling mutant
  // the credit-token predicate was blind to; these three are what see it.
  'EntitlementTuning',
  'RECOVERY_ENTITLEMENT',
  'MAX_COVERED_DAYS_ONE_ABSENCE_MAY_DRAW',
  // The provenance vocabulary itself.
  'COVERAGE_SOURCES',
  'COVERAGE_SOURCE_COUNTER',
  'SOURCES_THAT_CREDIT_A_PURCHASED_DAY',
  'COVERED_DAY_TOUCHING_FUNCTIONS',
  // The field allowlist and the state that carries the counter.
  'ENTITLEMENT_FACT_KEYS',
  'EntitlementState',
  // Reads: the sum, the window reset, the spend order.
  'freshEntitlement',
  'coveredDaysAvailable',
  'resolveEntitlement',
  'afterSession',
  // THE ONE WRITER, and what it reports. `CoveredDayCreditOutcome` used to be
  // deliberately ABSENT here, with a comment saying so: it reports a
  // `CoverageSource` without naming either counter, so the purchase-word scan
  // could not see it and listing it would have failed the staleness half. The
  // widened predicate does see it — it is the outcome of a COVERED-DAY credit
  // and says so in its name — so the entry is now required and that comment
  // would have become false if it had been left standing.
  'creditCoveredDays',
  'CoveredDayCreditOutcome',
  // ---- streak.ts -----------------------------------------------------------
  // Reads: the snapshot figure a screen shows, and the disarmed-branch zero.
  'coveredDaysLeftInWindow',
  'absenceOutcome',
  // THE ONE ENTRY POINT MONEY ARRIVES ON, and the shapes it needs.
  'StreakErrorCode',
  'COVERED_DAY_PURCHASE_KEYS',
  'CoveredDayPurchaseKey',
  'SettledCoveredDayPurchase',
  'COVERED_DAY_PURCHASE_IS_EXACTLY_ITS_ALLOWLIST',
  'COVERED_DAY_PURCHASE_OUTCOME_KEYS',
  'CoveredDayPurchaseOutcomeKey',
  'CoveredDayPurchaseOutcome',
  'COVERED_DAY_PURCHASE_OUTCOME_IS_COVERAGE_ONLY',
  'applySettledCoveredDayPurchase',
  // THE COVERAGE ENGINE ITSELF, which the purchase-word predicate never
  // reached. These are the arming, spending and settling paths — `openDay` and
  // `recordTrainingDay` are where a session's own count is in scope, which is
  // precisely where a training-keyed grant is cheapest to write.
  'LONGEST_REPAIRABLE_ABSENCE_DAYS',
  'coveredDaysArmed',
  'armedGapDays',
  'AbsenceOutcome',
  'breakReasonFor',
  'DayOpening',
  'openDay',
  'RECOVERY_DAY_OUTCOME_KEYS',
  'RecoveryDaySave',
  'recordTrainingDay',
  'DOOMED_SALE_REFUSAL_MESSAGE',
  'settleBrokenStreak',
  'setRecoveryDayProtection',
  'migrateFromRecoveryDayBalance',
  // ---- reached by the symbol-resolved pass, and not by the textual one -----
  // Nine declarations that say nothing a regex can match. Not one of these
  // contains `purchas`, `covered day` or `window-entitlement` anywhere in its
  // body; each reaches the entitlement through an IDENTIFIER instead, and the
  // textual scan is blind to every one of them. They are here because
  // `streakEntitlement.test.ts` now resolves identifiers through the TypeScript
  // checker as well as matching words, and the allowlist is the union.
  //
  // The first five are this module's own exports; the last four are `streak.ts`
  // reaching them across a module boundary, which is the direction that only
  // resolves because `getAliasedSymbol` follows the import.
  'CoverageSource',
  'EntitlementFactKey',
  'EntitlementOutcome',
  'ENTITLEMENT_REACH_IS_COVERAGE_ONLY',
  'windowIndexOf',
  'windowStartDay',
  'StreakState',
  'createStreakState',
  'entitlementWindowFor',
  // ---- currencyProvenance.ts ----------------------------------------------
  // WHO MAY BUY ONE, which is where the laundered path went — an achievement
  // pays Chalk, Chalk buys a covered day, and neither of the two files above
  // ever sees an achievement. A new tender is exactly the edit this allowlist
  // exists to make visible.
  //
  // NOTE FOR ANYONE TEMPTED TO NARROW THE PREDICATE: not one declaration in
  // this file names `purchasedDaysLeft` or the `'purchase'` source. Every entry
  // below is here because the scan keys on WORDS. Narrowing it drops this file
  // out of coverage entirely and undoes the round that added it;
  // `THE PREDICATE WAS CHOSEN BY MEASUREMENT` fails if anyone does.
  'COVERED_DAY_TENDERS',
  'CoveredDayTender',
  'TENDER_CURRENCY',
  'TENDER_ARRIVAL',
  'GatingOfTender',
  'NonTrainingGatedTender',
  'TrainingGatedTender',
  'TendersArePartitioned',
  'tenderGating',
  'isCoveredDayTender',
  'isNonTrainingGatedTender',
  'NON_TRAINING_GATED_TENDERS',
  'TRAINING_GATED_TENDERS',

  // ---- progression.ts ------------------------------------------------------
  // THE FILE THE OLD THREE-FILE SCAN WAS ALREADY MISSING, and the reason the
  // set had to be derived rather than extended by hand: nothing about a
  // hardcoded list of three names would ever have prompted somebody to add it.
  //
  // EXACTLY TWO OF THE ENTRIES BELOW NAME `purchasedDaysLeft`, and they are
  // these two — the wire shape and its decoder, which carry the counter across
  // the server boundary. Counted rather than estimated, because the first draft
  // of this comment said six and six is the number of declarations here that
  // match the NARROW predicate, which is a different thing: the other four match
  // on the string `'purchase'`, and in this module that is a PROPOSAL ORIGIN
  // KIND rather than the `CoverageSource` of the same spelling. A token
  // collision, and worth naming as one so a reader does not take those four for
  // covered-day code.
  'StreakStateWire',
  'decodeStreak',
  // The §8.1 no-pay-to-win reach model — the four collisions above, plus the
  // declarations that only say the word. About what a purchase may TOUCH rather
  // than about covered days, but it is the module that answers that question,
  // so a new purchasable concern showing up here should be looked at.
  'OPEN_FACTS_ARE_EXACTLY_WHAT_A_PURCHASE_MAY_REACH',
  'PROPOSAL_ORIGIN_KINDS',
  'PROPOSAL_ORIGIN_BY_KIND',
  'PurchasableProposalKind',
  'isPurchaseOriginated',
  'PURCHASABLE_PROPOSAL_KINDS',
  'PURCHASE_EVIDENCE_KEYS',
  'PurchaseEvidenceKey',
  'MoneyCarryingProposalKind',
  'MONEY_ON_THE_WIRE_IS_DECLARED_A_PURCHASE',
  'AnyPurchaseReach',
  'PURCHASES_CANNOT_REACH_PROTECTED_CONCERNS',
  'PURCHASE_REACH_IS_NOT_VACUOUS',
  'PURCHASABLE_KINDS_ARE_NOT_VACUOUS',

  // ---- streakSweep.ts ------------------------------------------------------
  // THE PURCHASE-DAY GENERATOR ITSELF, which the three-file scan never saw.
  // `coveredDayPurchaseDays` and `purchaseArrivalOf` DECIDE WHICH DAYS A
  // COVERED DAY LANDS ON in the §8.3E measurement — the exact quantity GDD
  // §8.3E's day-list assertion is about — so they belong under this guard more
  // obviously than most of the entries above.
  'MONOTONICITY_SWEEP',
  'ENTITLEMENT_VERIFICATION',
  'COVERED_DAY_PURCHASE_SWEEP',
  'DOOMED_SALE_SWEEP',
  'coveredDayPurchaseDays',
  'purchaseArrivalOf',

  // ---- facility/sessions.ts -----------------------------------------------
  // These describe equipment purchases and the pure facility schedule's
  // report. Reviewed currency vocabulary: their module imports the facility
  // ladder and accrual helpers, not the covered-day credit machinery.
  'GymPurchase',
  'GymRun',
  'runGym',

  // ---- empire/empireCore.ts ------------------------------------------------
  // MOSTLY NOT ABOUT COVERED DAYS. `src/empire/` is GDD §5's idle layer, built
  // by a parallel session, and it carries its own purchasable-versus-earned
  // partition for accelerants. These entries are DATA in this allowlist, not a
  // claim about that module and not a change to it — CLAUDE.md's Session
  // Coordination section rules on exactly that: the scan reads the whole tree,
  // these declarations say `purchas` or name a covered day, so they are listed.
  // The value of listing them is that the day an empire declaration starts
  // handing out coverage rather than an accelerant, this list is where it
  // surfaces.
  //
  // `EMPIRE_FORBIDDEN_OUTPUTS` is the one that IS about covered days, and it
  // joined with this round's widening: it names `'covered-day'` as a thing the
  // idle layer must not be able to produce. An empire whose income is
  // check-in-keyed is training-gated in GDD §4.4's sense, so that row and this
  // allowlist are the same rule seen from two directions. It is also the entry
  // that would go stale first if §5 ever renamed it, which is the point.
  'EMPIRE_FORBIDDEN_OUTPUTS',
  'ACCELERANT_ARRIVALS',
  'ACCELERANT_ARRIVAL',
  'ARRIVAL_LICENCE',
  'PurchasableAccelerant',
  'EarnedAccelerant',
  'AccelerantsArePartitioned',
  'isPurchasableAccelerant',
  'PURCHASABLE_ACCELERANTS',
  'EARNED_ACCELERANTS',
  'empireVocabularyFaults',

  // ---- empire/empireInvariant.ts, expansion.ts, reputation.ts -------------
  // The rest of GDD §5, arriving with the merge that brought its loop. Same
  // ruling as the block above: DATA in this allowlist, not a change to those
  // modules, and added by §5's owner under the standing permission in the
  // Session Coordination section.
  //
  // Four of the six match on `purchas` — they are the composed engine's
  // purchasable-accelerant path, which is the §8.1 hazard §5 spent nine pieces
  // measuring and closing. The remaining two match on the COVERED-DAY half of
  // the widened predicate and neither hands one out:
  // `expansionVocabularyFaults` states the ban it enforces, and
  // `FORBIDDEN_UNLOCK_KEYS` names `'currency-purchase'` as an unlock §5.3
  // refuses. Both are the guard describing itself, which is exactly the shape
  // the widening was built to stop hiding.
  'AccelerantPlan',
  'applyPurchasableGrant',
  'stepGym',
  'empireRunFaults',
  'expansionVocabularyFaults',
  'FORBIDDEN_UNLOCK_KEYS',

  // ---- empire/empireInvariant.ts and empire/engagement.ts, the day anchor --
  // Five more from the same directory, arriving with the piece that wrote
  // `EMPIRE_DAY_SPENDING_ANCHORS` — WHICH check-in of a calendar day a §5
  // player who shops once a day shops at. Data in this allowlist, added under
  // the standing permission in the Session Coordination section, and none of
  // them hands out a covered day.
  //
  // All five match on `purchas` and every one of them is about a GYM BUCKS
  // purchase in the idle layer: `purchasesMade` counts expansions, promotions
  // and recruitments begun so a day anchor can tell whether its shopping trip
  // happened; `anchorConsumesDayOnlyOnPurchase` says which anchor lets an
  // empty-handed trip leave the day still to spend; and the three in
  // `engagement.ts` are the sweep's census fields, its driver and its fault
  // list, which report the same purchases back.
  'purchasesMade',
  'anchorConsumesDayOnlyOnPurchase',
  'EngagementCensus',
  'runEngagement',
  'engagementRunFaults',

  // ---- tuning/audit.ts -----------------------------------------------------
  // NOT ABOUT COVERED DAYS EITHER, and the clearest illustration of what the
  // wide predicate costs: `SOURCE_RULES` is the magic-number audit's file
  // table, and it matches because one row's PROSE says "purchasable". Listing
  // one name for a whole frozen record is the honest price of a predicate that
  // cannot be talked out of looking.
  'SOURCE_RULES',
];

/** What a credit of covered days did. Reported, never silent. */
export interface CoveredDayCreditOutcome {
  readonly state: EntitlementState;
  /** Where the day came from. Reported; never read by the spend path. */
  readonly source: CoverageSource;
  /** Covered days that actually landed. */
  readonly credited: number;
  /** The window they expire at the end of, so a UI can say when. */
  readonly expiresAfterWindowIndex: number;
  /** Covered days available in this window once the credit has landed. */
  readonly availableAfter: number;
}

/**
 * Widens the CURRENT window's entitlement by `amount` covered days, from
 * `source`.
 *
 * THIS IS THE ENTIRE CREDIT SURFACE and it is deliberately the only one. It
 * cannot bank anything for a later window, so nothing accumulates and there is
 * no wealth for a doomed absence to be proportional to — which is what makes a
 * purchased covered day monotone-safe where a purchased Recovery Day was not.
 *
 * IT TAKES A SOURCE, AND THAT REVERSES A LINE THAT USED TO BE HERE. The
 * previous revision said "it takes no source, so no code path can make a bought
 * covered day behave differently from a granted one". The no-source version
 * bought that property by making the two INDISTINGUISHABLE, which also made
 * "nothing may award a purchased day" unstatable — there was no such thing as a
 * purchased day to forbid awarding. §3b of the header has the resolution: the
 * source is mandatory on the CREDIT and absent from the SPEND, so the two are
 * told apart where they are written and are provably identical where they are
 * used.
 *
 * WHAT A CALLER MUST NOT DO, and the measurement that says so is in §3 of the
 * header: do not call this on a day the lifter's own training decides. A credit
 * keyed to the streak or to a session count reintroduces the defect this whole
 * module exists to remove. Calendar days only — and for `'purchase'`, see GDD
 * §8.3E on the Chalk path, where the same rule reaches one hop further out.
 *
 * @throws {RangeError} if `amount` is not a whole number of at least 1, or the
 * source is not one of `COVERAGE_SOURCES`.
 */
export function creditCoveredDays(
  tuning: EntitlementTuning,
  state: EntitlementState,
  windowNow: number,
  amount: number,
  source: CoverageSource,
): CoveredDayCreditOutcome {
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new RangeError(
      `streakEntitlement: a covered-day credit must be a whole number of at least 1, received ${amount}`,
    );
  }
  if (!COVERAGE_SOURCES.includes(source)) {
    throw new RangeError(`streakEntitlement: ${String(source)} is not a covered-day source`);
  }
  const turnedOver = windowNow > state.windowIndex;
  const base = turnedOver ? tuning.COVERED_DAYS_PER_WINDOW : Math.max(0, state.coveredDaysLeft);
  const purchased = turnedOver ? 0 : Math.max(0, state.purchasedDaysLeft);
  const intoPurchased = COVERAGE_SOURCE_COUNTER[source] === 'purchasedDaysLeft';
  const next: EntitlementState = {
    windowIndex: windowNow,
    coveredDaysLeft: intoPurchased ? base : base + amount,
    purchasedDaysLeft: intoPurchased ? purchased + amount : purchased,
  };
  return {
    state: next,
    source,
    credited: amount,
    expiresAfterWindowIndex: windowNow,
    availableAfter: next.coveredDaysLeft + next.purchasedDaysLeft,
  };
}
