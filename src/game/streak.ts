/**
 * streak.ts — Daily streak tracking and Recovery Days (GDD §4).
 *
 * PURE MODULE (CLAUDE.md "Pure logic is separate from UI"):
 * zero React imports, zero side effects, zero I/O, explicit return types on
 * every export. In particular there is **no clock read anywhere in this file** —
 * no `Date`, no `Date.now`, no `performance.now` — and no randomness. The
 * current day is always a parameter. `streak.test.ts` asserts that by scanning
 * this file's own source, so the claim is checked rather than asserted.
 *
 * Every transition returns a new state; no input is mutated.
 *
 * ===========================================================================
 * 1. WHAT A "DAY" IS — STATE THE ASSUMPTION, DO NOT LEAVE IT IMPLICIT
 * ===========================================================================
 *
 * A day here is a **local civil day in the player's home timezone**, and the
 * boundary sits at `STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL` (03:00 by default)
 * rather than at midnight, so a lifter who finishes a late session at 00:40
 * still gets credit for the training day they think they are in.
 *
 * It is represented as `StreakDay`: a branded integer count of civil days since
 * 1970-01-01, computed with the standard `days_from_civil` algorithm. Civil-day
 * arithmetic rather than `Math.floor(ms / 86_400_000)` is deliberate — a day
 * that is 23 or 25 hours long because of a daylight-saving transition is still
 * exactly one day, and epoch-millisecond division gets that wrong twice a year.
 *
 * THE TIMEZONE ITSELF IS NOT THIS MODULE'S BUSINESS AND IT NEVER LEARNS IT.
 * The caller resolves "now" to a local wall-clock date-time and converts:
 *
 *     streakDayFromLocalWallClock({ year, month, day, hour })
 *
 * WHAT THAT DOES NOT SOLVE, said plainly because it is a real hole and nothing
 * here closes it: which timezone is "local" must be an account property that
 * the *server* resolves, not the device's current zone. If the device decides,
 * a player flying east loses a day and a player who changes their phone's
 * timezone by hand can manufacture an extra one. This module cannot see any of
 * that and does not pretend to — it is stated here so the caller owns it
 * knowingly. There is no anti-abuse check in this file.
 *
 * ===========================================================================
 * 2. THE STREAK
 * ===========================================================================
 *
 * Strict daily (GDD §4.1). Miss a day and the run ends, unless a Recovery Day
 * is spent on the missed day.
 *
 * `currentStreak` counts **trained days** in the live run. A Recovery Day keeps
 * the run alive across a gap; it does not add to the count. That is a design
 * decision with a reason, and the reason is the pay-to-win line:
 * `RECOVERY_DAY_ECONOMY.STREAK_MILESTONE_GRANT` pays out at 7 / 30 / 100 days,
 * so if bought days counted, Recovery Days would buy the currency that buys
 * Recovery Days. They do not count, so reaching a milestone always costs the
 * full number of real training days. `streak.test.ts` checks that.
 *
 * ===========================================================================
 * 3. RECOVERY DAYS, NOT "STREAK TOKENS" (GDD §4.2)
 * ===========================================================================
 *
 * The flavour is load-bearing and the naming in this file follows it
 * throughout: a missed day is reframed as legitimate training wisdom, not as
 * failure. The audience this is aimed at often misses a day *because* they are
 * training intelligently — deloading, sleeping off a bad week, letting a tweak
 * settle. There is no type, field, constant, error code or message in this
 * module called a token, a freeze, a save or a shield.
 *
 * MANUAL USE, NOT AUTO-APPLY. This is enforced by the shape of the API, not by
 * a comment:
 *
 *   - `openDay` is a pure read model. It can *report* a `RecoveryDayOffer`. It
 *     changes nothing.
 *   - Nothing spends a Recovery Day except `acceptRecoveryDayOffer`, which the
 *     player's "yes" calls.
 *   - `declineRecoveryDayOffer` really ends the run and really leaves the
 *     balance alone.
 *   - `recordTrainingDay` REFUSES with `RECOVERY_DECISION_PENDING` when an
 *     offer is outstanding, so a caller cannot skip past the decision by
 *     recording a session and letting the engine quietly do the generous thing.
 *
 * There is deliberately no `autoApplyRecoveryDay`, and no option flag that
 * turns one on. The small "phew" moment is the point (GDD §4.2).
 *
 * FIRST-BREAK TUTORIAL (GDD §4.3). The first offer a player ever *resolves*
 * carries `isFirstBreakTutorial: true` so the UI can show the explanation. It
 * is still an offer — it is not applied for them. The flag is consumed on
 * accept **or** decline, never merely by being displayed, so:
 *   - closing the app mid-decision re-shows the tutorial (correct: they have
 *     not seen the outcome yet);
 *   - a first break that cannot be repaired at all (no Recovery Days, gap too
 *     long) does NOT burn the tutorial — it fires at the first break the player
 *     can actually be saved from, which is the only version of the moment worth
 *     having.
 *
 * ===========================================================================
 * 4. THE PAY-TO-WIN LINE, EXPRESSED IN THE TYPES (GDD §8.1, §12.3)
 * ===========================================================================
 *
 * Recovery Days are purchasable (GDD §4.2, §8.2). That makes this module the
 * one place in the codebase where a purchasable item has a functional effect,
 * so "it only protects a streak" has to be checkable rather than promised.
 * Four mechanisms, all of them mechanical:
 *
 *  (a) THE STATE ALLOWLIST. `STREAK_FACT_KEYS` is the complete list of fields
 *      `StreakState` may have. `RECOVERY_DAY_REACH_IS_STREAK_ONLY` is a
 *      compile-time assertion that `keyof StreakState` is *exactly* that list.
 *      Adding a field — `totalBonusKg`, `e1rmMultiplier`, `extraSessions`,
 *      anything, under any name — fails `tsc` until it is added to the
 *      allowlist, which is a visible edit sitting directly under this
 *      paragraph. A blocklist of forbidden names would be guessable around; an
 *      allowlist is not.
 *
 *  (b) THE OUTCOME ALLOWLIST. `RECOVERY_DAY_OUTCOME_KEYS` does the same for
 *      `RecoveryDayOutcome`, the only thing `acceptRecoveryDayOffer` returns.
 *      Every field on it is a streak fact or a description of the spend itself.
 *
 *  (c) NO PROVENANCE TO BRANCH ON. `RecoveryDaySource` exists on the *grant*
 *      (`grantRecoveryDays`) for receipts and analytics and is thrown away
 *      immediately: the ledger is a single integer. `acceptRecoveryDayOffer`
 *      has no source parameter and no way to obtain one, so no code path can
 *      ever make a bought Recovery Day behave differently from an earned one.
 *      The test suite asserts state-level equality across every source.
 *
 *  (d) NOTHING TO SELL. This module exports no streak multiplier, no
 *      streak-derived load bonus, no "training pace" figure and no session
 *      allowance. `recordTrainingDay` takes a day and nothing else — it cannot
 *      be handed a Recovery Day, and there is no argument by which one could
 *      influence what a session is worth. A streak here is a count of days and
 *      the milestone schedule that pays out Recovery Days. It feeds nothing
 *      else in this file.
 *
 * WHAT (a)-(d) DO NOT PROVE, stated rather than glossed: they constrain this
 * module. They cannot stop a *consumer* reading `currentStreak` and multiplying
 * a load by it. That would be the consumer's violation, and no type in this
 * file can prevent it — only a critic reading that consumer can.
 *
 * Currency prices are also not here. GDD §8.2 sells Recovery Days for Chalk or
 * Gym Bucks; those ledgers and their prices live in the purchase path, and this
 * module only ever receives an already-paid-for grant. Putting a price in this
 * file would put a currency balance in the same module as the streak, which is
 * the coupling worth avoiding.
 *
 * ===========================================================================
 * 5. GUARDRAILS (GDD §4.2)
 * ===========================================================================
 *
 *   - `RECOVERY_DAY_GUARDRAILS.HOLD_CAP` — how many may be held at once. Grants
 *     above it are clipped, and the clipped amount is *reported*
 *     (`wastedToHoldCap`) so the UI can say "you are at your cap" rather than
 *     silently swallowing a milestone reward.
 *   - `RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES` — how many missed days in
 *     a row may be covered before a real training day has to happen.
 *     `consecutiveRecoveryDaysUsed` resets to 0 on any trained day.
 *
 * A LONG ABSENCE CANNOT BE REPAIRED, and the binding constraint is the
 * consecutive limit rather than the hold cap. An offer only ever appears when
 * it can cover the **entire** gap:
 *
 *     an offer exists  <=>  1 <= daysMissed <= min(balance,
 *                                                  MAX_CONSECUTIVE_USES
 *                                                    - consecutiveRecoveryDaysUsed)
 *
 * Covering four days out of seven leaves three uncovered days, which breaks the
 * run anyway — so a partial offer would take the player's Recovery Days and
 * give them nothing. There is no partial coverage anywhere in this module.
 *
 * WHAT IS *NOT* GUARDED, said plainly because the opposite would be a claim
 * this file cannot back: there is no cooldown between uses. A player who
 * alternates train / miss / train / miss can spend a Recovery Day on every
 * missed day for as long as their balance lasts, because each trained day
 * resets `consecutiveRecoveryDaysUsed` to 0. `streak.test.ts` demonstrates that
 * pattern draining a full bank rather than leaving it as prose. The only thing
 * bounding it is the economy — the hold cap plus the earn rate — not a rule in
 * this file. If playtesting says the pattern needs stopping, the fix is a new
 * named guardrail, not a tweak buried in a call site.
 *
 * ===========================================================================
 * 6. NEVER PUNISH DAILY ENGAGEMENT (CLAUDE.md, GDD §3.5, §12.3)
 * ===========================================================================
 *
 * WHAT HOLDS, and is tested:
 *
 *   - LOCALLY. Across a grid of run lengths and balances, training today
 *     dominates skipping today on every field that matters: streak up by one,
 *     longest streak no lower, balance no lower, consecutive-use headroom no
 *     worse. (A grid, not a proof — the exhaustive result is the next bullet.)
 *   - GLOBALLY, WITH NO SPENDING. Over ALL 2^10 ten-day histories, turning any
 *     skipped day into a trained day never lowers `currentStreak`,
 *     `longestStreak` or `recoveryDayBalance`. Exhaustive, not sampled. Also
 *     checked over long randomised histories with grants landing mid-run.
 *   - EVERYWHERE. `recordTrainingDay` cannot reduce `recoveryDayBalance`.
 *     Showing up never costs a Recovery Day, in any state.
 *   - AGAINST A COMPARATOR WHO SPENT NOTHING. A player who has used any number
 *     of Recovery Days, up to the hold cap, never ends on a lower streak than a
 *     player who trained a subset of the same days and used none. This is
 *     structural rather than lucky: `acceptRecoveryDayOffer` never touches
 *     `currentStreak` — it only sets `recoveredThroughDay` — so a Recovery Day
 *     can only ever EXTEND a run backwards across a gap. The comparator's run
 *     is its own trailing block of trained days, and the other player trained
 *     all of those too, so their run contains it.
 *   - ON YOUR OWN CALENDAR, SAYING YES IS NEVER WORSE THAN SAYING NO. For a
 *     FIXED history, accepting every offer never ends on a lower current or
 *     longest streak than declining every offer. Exhaustive over every 13-day
 *     calendar under both app-opening models, plus long randomised ones. This
 *     is the guarantee that matters at the prompt: the player cannot be
 *     punished for taking the save GDD §4.2 offers them.
 *
 * WHAT DOES NOT HOLD, and is pinned by tests rather than glossed over:
 *
 *     A player who accepts EVERY offer can end on a shorter streak — the live
 *     one on the home screen, and their lifetime best — than the same player
 *     who trained one day fewer.
 *
 * HOW MUCH SHORTER: THERE IS NO CEILING, and this paragraph exists because the
 * smallest instance of it (best streak 2 against 1, over an eleven-day history)
 * reads like a rounding artifact and is not one. The deficit is exactly the
 * length of the run the diligent player loses, so it scales with how long they
 * have been training:
 *
 *     lazy trains 37 days   -> streak 37     diligent trains 38   -> streak 18
 *     lazy trains 101 days  -> streak 101    diligent trains 102  -> streak 51
 *     lazy trains 2001 days -> streak 2001   diligent trains 2002 -> streak 1001
 *
 * In every row both players accept every offer and spend the SAME number of
 * Recovery Days — never more than five, which is every Recovery Day those
 * histories generate — and the diligent player trained on strictly more days.
 * `streak.test.ts` builds that family at an arbitrary run length and pins the
 * deficit at each one, and separately MAXIMISES the deficit by exhaustive
 * search over every history up to fourteen days, where the worst case climbs
 * from 3 to 8 as the history lengthens instead of settling on a constant.
 *
 * ROOT CAUSE, and it is one asymmetry rather than a pile of edge cases. Idle
 * days BEFORE a run exists are free: `lastCoveredDay` is null, so
 * `daysMissedBefore` returns 0, no offer is made and nothing is spent. Idle
 * days INSIDE a live run cost Recovery Days. An extra training day converts the
 * free kind into the paid kind, drains a finite pool, and leaves a later gap
 * uncoverable — so a run dies that would otherwise have been saved. It is the
 * accepting that spends, not the training, and no threshold removes it: raise
 * the bar for making an offer and the same construction reappears with the
 * divergent day moved to wherever the new bar sits. (That last sentence is
 * argued, not measured — no threshold is implemented, so no test covers it.)
 *
 * WHY THIS MODULE DOES NOT FIX IT, as an argument and not a shrug. The property
 * "one more trained day never lowers the final streak" requires that the
 * divergent spend never leaves the diligent player short at a later gap. Three
 * ways to arrange that, and each one fails or costs more than it buys:
 *
 *   - CHARGE PER GAP INSTEAD OF PER MISSED DAY. Does nothing here. Every gap in
 *     the family above is a single day, so it already costs exactly one either
 *     way. Checked, not assumed.
 *   - REFUND WHEN THE PROTECTED RUN DIES. The refund arrives after the death.
 *     It restores the balance, not the run, and the deficit above is measured
 *     in streak days, not Recovery Days.
 *   - REFUND WHEN THE PLAYER COMES BACK. Closes the family above, and opens
 *     another: a run that dies mid-gap never triggers the return, so the
 *     diligent player still ends poorer than a lazier player who had no run to
 *     lose. Closing that one too means refunding on death AND on return, which
 *     is to say never consuming a Recovery Day at all — and a Recovery Day that
 *     is never consumed has no hold cap worth having (GDD §4.2), nothing to
 *     earn on the free-path table (§4.2) and nothing to sell (§8.2).
 *
 * So the property is not compatible with Recovery Days being a finite
 * consumable that is spent to keep a live run alive. That is a design question
 * — whether they should remain one — and it is above this module's pay grade.
 * GDD §4.4 records it as open. What is implemented here is the design the GDD
 * currently specifies, with the cost measured rather than hidden.
 *
 * THE DECISION THAT COSTS IS NOT AN OBVIOUS MISTAKE, which is why this wants a
 * human ruling rather than a shrug. In every row above, the spend that does the
 * damage is a yes to an offer protecting a ONE-day streak — a streak that then
 * runs for weeks or years before it dies. Declining a live run is the
 * counterintuitive correct play, and GDD §4.3 puts the tutorial on the very
 * first offer precisely to teach the player to say yes. What GDD §4.2 puts
 * against it is agency: `RecoveryDayOffer` carries `streakProtected` and
 * `balanceAfter` so the prompt can state what a yes is worth today. Nothing on
 * it states what a yes costs later, because no state here can know that.
 *
 * A TRAP FOR ANYONE MEASURING THIS. `currentStreak` is only true as of the last
 * day someone called `openDay` on the state. A run that has already died sits
 * there at full length until `settleBrokenStreak` records the fact, so a state
 * nobody has opened since the last session reports a streak the player does not
 * have. Comparing two states settled to different days manufactures violations
 * that are not there — `streak.test.ts` pins one such pair, which reads as a
 * player losing two streak days for training an extra one and is really two
 * equally dead runs, one of which has been told. Settle both, then compare.
 *
 * ===========================================================================
 * 7. DELIBERATE NON-GOALS
 * ===========================================================================
 *
 *   - Persistence, serialisation and the server round-trip. `StreakState` is a
 *     plain JSON-safe object on purpose (the `StreakDay` brand is erased at
 *     runtime), so an Edge Function can store and rehydrate it, but no storage
 *     code lives here. CLAUDE.md: streak mutations are server-authoritative;
 *     this module is the pure transition function that server runs.
 *   - Achievement bookkeeping. `grantRecoveryDays({ source: 'achievement' })`
 *     credits the reward; knowing whether "first meet" has already fired is the
 *     achievement system's job and there is NO de-duplication for it here.
 *     Streak milestones are the exception — those this module owns, and it pays
 *     each one once per lifetime off `longestStreak`.
 *   - The Gym Empire passive drop (GDD §4.2). This module is deterministic and
 *     never rolls; see `RECOVERY_DAY_ECONOMY.GYM_EMPIRE_DROP_CHANCE_PER_COLLECTION`.
 *   - Reminders, notifications, copy and localisation. `DayOpening` is the read
 *     model a UI renders; the words are the UI's.
 *   - Anything to do with what the player actually lifted. `recordTrainingDay`
 *     does not know or care.
 */

// ---------------------------------------------------------------------------
// Tunable constants
//
// CLAUDE.md "Game Feel Values Must Be Tunable": every hand-tuned number lives
// here, named, in one place. NONE of these are playtested. They are plausible
// starting values inside the ranges GDD §4.2 gives, and they are expected to
// move.
// ---------------------------------------------------------------------------

/** Where the day boundary sits. See §1 of the header. */
export const STREAK_DAY_BOUNDARY = {
  /**
   * Local hour at which a new streak day begins, 0-23. Whole hours only — a
   * half-past boundary would need this to be minutes and every caller to pass
   * them.
   *
   * 3 rather than 0 so a session finished at 00:40 counts for the day the
   * lifter believes they are in. UNTUNED.
   */
  ROLLOVER_HOUR_LOCAL: 3,
} as const;

/** GDD §4.2 "Guardrails". */
export const RECOVERY_DAY_GUARDRAILS = {
  /**
   * Most Recovery Days a player may hold. GDD §4.2 specifies 3-5. Grants beyond
   * this are clipped and the clipping is reported, never silent.
   */
  HOLD_CAP: 5,

  /**
   * Most consecutive missed days that may be covered before a real training day
   * has to happen. Resets to 0 on any trained day.
   *
   * This, not the hold cap, is what actually stops a 50-day streak surviving a
   * week away — with a cap of 5 a five-day gap would otherwise be affordable.
   * UNTUNED; 2 means "you may miss a weekend and still be saved".
   */
  MAX_CONSECUTIVE_USES: 2,
} as const;

/**
 * Free-path earning (GDD §4.2 table) plus the two purchase sources.
 *
 * These are AMOUNTS ONLY. Prices are not here — see §4 of the header.
 */
export const RECOVERY_DAY_ECONOMY = {
  /** Signup grant. GDD §4.2 specifies 2-3. */
  SIGNUP_GRANT: 3,

  /** Paid once per milestone per run, at `STREAK_MILESTONE_DAYS`. GDD: 1 each. */
  STREAK_MILESTONE_GRANT: 1,

  /** First meet, first PR, first block, etc. GDD: 1 each. */
  ACHIEVEMENT_GRANT: 1,

  /** Size of a Gym Empire passive drop when one lands. GDD §4.2: "small". */
  GYM_EMPIRE_DROP_GRANT: 1,

  /**
   * GDD §4.2 gives the Gym Empire passive reward a "small chance".
   *
   * THIS MODULE NEVER ROLLS IT AND NEVER READS THIS VALUE. It is a
   * deterministic module (see the purity contract at the top), so the roll
   * belongs wherever a Gym Empire collection is resolved — server-side, with
   * the result arriving here as `grantRecoveryDays({ source: 'gym-empire' })`.
   * The number lives here anyway because CLAUDE.md wants one home for tuned
   * values, and a probability scattered into a collection handler is exactly
   * the magic number that rule exists to prevent.
   *
   * Chance per Gym Empire collection, in [0, 1]. UNTUNED. That this file does
   * not consume it is an unenforced convention: nothing stops a future edit
   * from reading it here, and no test can catch that.
   */
  GYM_EMPIRE_DROP_CHANCE_PER_COLLECTION: 0.05,
} as const;

/**
 * Streak lengths that pay out `RECOVERY_DAY_ECONOMY.STREAK_MILESTONE_GRANT`
 * (GDD §4.2: "Milestone streaks (7 / 30 / 100 days)").
 *
 * ONCE PER LIFETIME, NOT ONCE PER RUN, and that is load-bearing rather than
 * incidental. A milestone is awarded exactly when `currentStreak` first reaches
 * it, which is exactly when `longestStreak` first reaches it — so eligibility
 * is READ OFF `longestStreak` and there is no ledger of paid milestones to keep
 * in sync. Paying a second time is not prevented by bookkeeping; it is not
 * expressible.
 *
 * WHY NOT ONCE PER RUN. An earlier revision re-armed milestones when a run
 * ended, on the reasoning that a player who breaks a streak should not be cut
 * off from the free earning path. It made deliberately breaking the best free
 * income in the game: reach 7, break, repeat pays one Recovery Day per seven
 * sessions, while an unbroken run pays nothing between day 7 and day 30. The
 * exhaustive sweep in `streak.test.ts` caught it as a balance regression — the
 * player who trained MORE days ended with FEWER Recovery Days — which is the
 * "punishes you for showing up" failure GDD §12.3 refuses, arriving through the
 * economy rather than through the streak.
 *
 * WHAT ONCE-PER-LIFETIME COSTS, stated rather than glossed: a player who has
 * already banked all three milestones has no streak-based free income left.
 * Their free path is the other rows of the GDD §4.2 table — achievements and
 * the Gym Empire drop — and if those turn out to be too thin in playtesting the
 * fix belongs there, not in re-arming this.
 */
export const STREAK_MILESTONE_DAYS: readonly number[] = [7, 30, 100];

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

declare const STREAK_DAY_BRAND: unique symbol;

/**
 * A local civil day, as an integer count of days since 1970-01-01.
 *
 * Branded so a raw `number` cannot be passed where a day is expected: the only
 * ways in are `streakDayFromCivilDate`, `streakDayFromLocalWallClock` and the
 * explicit `asStreakDay`. That is how "this module never reads a clock" is kept
 * true — resolving *when now is* happens outside, deliberately, in code that
 * knows which timezone the account is anchored to.
 *
 * The brand is a type-level fiction; at runtime a `StreakDay` is a plain
 * integer and serialises as one.
 */
export type StreakDay = number & { readonly [STREAK_DAY_BRAND]: 'streak-day' };

/** A calendar date, with `month` 1-12 and `day` 1-31. */
export interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** A local calendar date plus the local hour, 0-23. */
export interface LocalWallClock extends CivilDate {
  readonly hour: number;
}

/**
 * Wraps an integer as a `StreakDay`.
 *
 * @throws {RangeError} if it is not a safe integer.
 */
export function asStreakDay(value: number): StreakDay {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`streak: a day must be a safe integer day index, received ${value}`);
  }
  return value as StreakDay;
}

/** Day arithmetic that keeps the brand. */
export function addDays(day: StreakDay, delta: number): StreakDay {
  if (!Number.isSafeInteger(delta)) {
    throw new RangeError(`streak: day offset must be a safe integer, received ${delta}`);
  }
  return asStreakDay(day + delta);
}

/** `later - earlier`, in whole civil days. Negative if the order is reversed. */
export function daysBetween(earlier: StreakDay, later: StreakDay): number {
  return later - earlier;
}

/**
 * `days_from_civil` (Howard Hinnant's civil-calendar algorithm), proleptic
 * Gregorian, 1970-01-01 => 0. Pure integer arithmetic — no `Date`, so no
 * chance of a host timezone leaking in.
 */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** Inverse of `daysFromCivil`. */
function civilFromDays(index: number): CivilDate {
  const z = index + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365,
  );
  const y = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: y + (month <= 2 ? 1 : 0), month, day };
}

/**
 * Converts a local calendar date to a `StreakDay`. Rejects dates that do not
 * exist (2026-02-30, month 13) by round-tripping the result.
 *
 * Applies NO rollover-hour adjustment — this is "which civil day is this
 * date". Use `streakDayFromLocalWallClock` for "which streak day is this
 * moment in".
 *
 * @throws {RangeError} on a non-integer or non-existent date.
 */
export function streakDayFromCivilDate(date: CivilDate): StreakDay {
  const { year, month, day } = date;
  if (!Number.isSafeInteger(year) || !Number.isSafeInteger(month) || !Number.isSafeInteger(day)) {
    throw new RangeError(
      `streak: a civil date must have whole-number year, month and day, received ${year}-${month}-${day}`,
    );
  }
  const index = daysFromCivil(year, month, day);
  const roundTrip = civilFromDays(index);
  if (roundTrip.year !== year || roundTrip.month !== month || roundTrip.day !== day) {
    throw new RangeError(`streak: ${year}-${month}-${day} is not a real calendar date`);
  }
  return asStreakDay(index);
}

/** The calendar date a `StreakDay` refers to. */
export function civilDateFromStreakDay(day: StreakDay): CivilDate {
  return civilFromDays(day);
}

/**
 * THE ENTRY POINT A RUNNING APP OR SERVER SHOULD USE. Converts a local
 * wall-clock moment to the streak day it falls in, applying
 * `STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL`: anything before that hour belongs
 * to the previous streak day.
 *
 * The caller supplies the local date and hour, which is where the timezone
 * decision lives. See §1 of the header for what that does and does not solve.
 *
 * @throws {RangeError} on a non-existent date or an hour outside 0-23.
 */
export function streakDayFromLocalWallClock(now: LocalWallClock): StreakDay {
  if (!Number.isSafeInteger(now.hour) || now.hour < 0 || now.hour > 23) {
    throw new RangeError(`streak: local hour must be a whole number 0-23, received ${now.hour}`);
  }
  const civilDay = streakDayFromCivilDate(now);
  return now.hour < STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL ? addDays(civilDay, -1) : civilDay;
}

// ---------------------------------------------------------------------------
// State — and the allowlist that fences in what a Recovery Day can reach
// ---------------------------------------------------------------------------

/**
 * THE COMPLETE SET OF FIELDS `StreakState` MAY HAVE.
 *
 * This is the pay-to-win boundary, mechanised. See §4 of the header. If a
 * Recovery Day — earned, granted or bought — could touch Total, e1RM, training
 * pace or meet performance, that effect would have to be persisted somewhere,
 * and the only thing this module persists is a `StreakState`. Extending it
 * requires extending this list, in this file, under this comment.
 *
 * Exported as a runtime array so a critic can check the live object's keys
 * against it without reading a single line of logic; `streak.test.ts` does
 * exactly that.
 */
export const STREAK_FACT_KEYS = [
  'currentStreak',
  'longestStreak',
  'lastTrainedDay',
  'recoveredThroughDay',
  'consecutiveRecoveryDaysUsed',
  'recoveryDayBalance',
  'hasResolvedFirstBreakOffer',
] as const;

export type StreakFactKey = (typeof STREAK_FACT_KEYS)[number];

/**
 * `true` when `keyof T` is EXACTLY `Keys` — neither a field missing from the
 * allowlist nor a stale allowlist entry. Tuple-wrapped so the unions do not
 * distribute.
 */
type KeysAreExactly<T, Keys extends string> = [Exclude<keyof T, Keys>] extends [never]
  ? [Exclude<Keys, keyof T>] extends [never]
    ? true
    : never
  : never;

/** Everything the streak system knows about one lifter. JSON-safe. */
export interface StreakState {
  /**
   * TRAINED days in the live run. Recovery Days keep a run alive but never add
   * to this — see §2 of the header for why that is the pay-to-win-safe choice.
   */
  readonly currentStreak: number;
  /**
   * Best `currentStreak` ever reached. Survives a break, and doubles as the
   * milestone ledger: milestone `m` has been paid iff `longestStreak >= m`.
   */
  readonly longestStreak: number;
  /** Last day the player trained. Null when there is no live run. */
  readonly lastTrainedDay: StreakDay | null;
  /**
   * Last day covered by a Recovery Day. Non-null only while Recovery Days
   * extend the run past `lastTrainedDay`; any trained day clears it.
   */
  readonly recoveredThroughDay: StreakDay | null;
  /**
   * Recovery Days spent since the last trained day. Checked against
   * `RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES`; reset to 0 by training.
   */
  readonly consecutiveRecoveryDaysUsed: number;
  /** Recovery Days held. Capped at `RECOVERY_DAY_GUARDRAILS.HOLD_CAP`. */
  readonly recoveryDayBalance: number;
  /** Set once the first-break tutorial offer (GDD §4.3) has been resolved. */
  readonly hasResolvedFirstBreakOffer: boolean;
}

/**
 * COMPILE-TIME ASSERTION, not documentation: `StreakState`'s fields are exactly
 * `STREAK_FACT_KEYS`. Add `e1rmBonus` (or anything else, under any name) to the
 * state and `tsc --noEmit` fails here until the allowlist above is widened.
 */
export const RECOVERY_DAY_REACH_IS_STREAK_ONLY: KeysAreExactly<StreakState, StreakFactKey> = true;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type StreakErrorCode =
  /** The day given is before a day already accounted for. Clock skew or a bug. */
  | 'DAY_IN_PAST'
  /** A training day was already recorded for this day. */
  | 'ALREADY_TRAINED_TODAY'
  /**
   * A Recovery Day offer is outstanding. The player has to answer it — that is
   * GDD §4.2's "manual use, not auto-apply", enforced rather than described.
   */
  | 'RECOVERY_DECISION_PENDING'
  /** There is no offer to accept or decline in this state, on that day. */
  | 'NO_RECOVERY_DAY_OFFER'
  /**
   * The offer handed in does not match the offer this state actually produces.
   * Offers are re-derived and compared rather than trusted, so a stale or
   * fabricated one cannot spend a different number of Recovery Days or protect
   * a run that is not there.
   */
  | 'OFFER_DOES_NOT_MATCH_STATE'
  /** The run is intact; there is nothing to settle. */
  | 'NOTHING_TO_SETTLE'
  /** Grant amount was not a positive whole number. */
  | 'INVALID_GRANT';

export interface StreakError {
  readonly code: StreakErrorCode;
  /** Plain language. Some of these are developer errors; none leak internals. */
  readonly message: string;
}

export type StreakResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: StreakError };

function ok<T>(value: T): StreakResult<T> {
  return { ok: true, value };
}

function fail<T>(code: StreakErrorCode, message: string): StreakResult<T> {
  return { ok: false, error: { code, message } };
}

// ---------------------------------------------------------------------------
// Reading a streak
// ---------------------------------------------------------------------------

/** A fresh lifter: no run, and the GDD §4.2 signup grant already credited. */
export function createStreakState(): StreakState {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastTrainedDay: null,
    recoveredThroughDay: null,
    consecutiveRecoveryDaysUsed: 0,
    recoveryDayBalance: Math.min(RECOVERY_DAY_ECONOMY.SIGNUP_GRANT, RECOVERY_DAY_GUARDRAILS.HOLD_CAP),
    hasResolvedFirstBreakOffer: false,
  };
}

/**
 * The last day the run accounts for: the last trained day, or the last day a
 * Recovery Day covered if that is later. Null when there is no live run.
 */
export function lastCoveredDay(state: StreakState): StreakDay | null {
  return state.recoveredThroughDay ?? state.lastTrainedDay;
}

/**
 * Days between the end of the run and `today` that nothing covers. 0 when the
 * run is intact (trained today, or today is the very next day), and 0 when
 * there is no live run at all — there is nothing to miss.
 */
export function daysMissedBefore(state: StreakState, today: StreakDay): number {
  const covered = lastCoveredDay(state);
  if (covered === null) return 0;
  return Math.max(0, daysBetween(covered, today) - 1);
}

/**
 * How many consecutive missed days this state could still cover, right now.
 * The min of what is held and what the consecutive-use guardrail still allows.
 */
export function coverableGapDays(state: StreakState): number {
  const consecutiveAllowance =
    RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES - state.consecutiveRecoveryDaysUsed;
  return Math.max(0, Math.min(state.recoveryDayBalance, consecutiveAllowance));
}

/** Last day the player can train without missing anything. Null with no run. */
export function streakDeadlineDay(state: StreakState): StreakDay | null {
  const covered = lastCoveredDay(state);
  return covered === null ? null : addDays(covered, 1);
}

/**
 * Last day on which a Recovery Day could still rescue this run. Equals
 * `streakDeadlineDay` when nothing is coverable. Null with no run.
 *
 * Depends on the current balance and consecutive-use count, so it moves as
 * those move. It is a projection for reminder copy, not a promise.
 */
export function lastDayStreakCanBeSaved(state: StreakState): StreakDay | null {
  const deadline = streakDeadlineDay(state);
  return deadline === null ? null : addDays(deadline, coverableGapDays(state));
}

/** Room left under the hold cap. */
export function recoveryDayCapacity(state: StreakState): number {
  return Math.max(0, RECOVERY_DAY_GUARDRAILS.HOLD_CAP - state.recoveryDayBalance);
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

/**
 * A Recovery Day offer: what the player is being asked, in full, before they
 * answer. Everything the prompt needs is here so the UI never recomputes a cost
 * and never shows a number the engine disagrees with.
 *
 * IT IS NOT A GRANT OF ANYTHING. Holding one changes nothing;
 * `acceptRecoveryDayOffer` is the only thing that spends, and
 * `declineRecoveryDayOffer` really lets the run end.
 */
export interface RecoveryDayOffer {
  /** The day the player opened the app and was asked. */
  readonly offeredOnDay: StreakDay;
  /** The exact missed days this would cover, ascending. Never partial. */
  readonly missedDays: readonly StreakDay[];
  /** Recovery Days it costs — always `missedDays.length`. */
  readonly cost: number;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
  /** The run that survives if accepted. Unchanged by accepting — see §2. */
  readonly streakProtected: number;
  /** `consecutiveRecoveryDaysUsed` after accepting, against the guardrail. */
  readonly consecutiveRecoveryDaysUsedAfter: number;
  /**
   * GDD §4.3. True on the first offer the player ever resolves; the UI shows
   * the explanation. It is still a question, not an auto-save.
   */
  readonly isFirstBreakTutorial: boolean;
}

/** Why a run is ending with no offer on the table. */
export type StreakBreakReason =
  /** More missed days than `MAX_CONSECUTIVE_USES` could ever cover. */
  | 'gap-longer-than-consecutive-limit'
  /** Within the overall limit, but too many already used since training. */
  | 'consecutive-use-limit-reached'
  /** Simply not enough Recovery Days held to cover the whole gap. */
  | 'not-enough-recovery-days';

/**
 * The offer this state and day produce, or null if there is none.
 *
 * PURE READ MODEL — it changes nothing, and in particular it does not consume
 * the first-break tutorial. That is consumed by resolving the offer, so a
 * player who closes the app mid-decision sees the tutorial again.
 *
 * An offer exists only when it covers the WHOLE gap. See §5 of the header.
 */
export function currentRecoveryDayOffer(state: StreakState, today: StreakDay): RecoveryDayOffer | null {
  const covered = lastCoveredDay(state);
  if (covered === null) return null;
  const missed = daysMissedBefore(state, today);
  if (missed < 1) return null;
  if (missed > coverableGapDays(state)) return null;

  const missedDays: StreakDay[] = [];
  for (let offset = 1; offset <= missed; offset += 1) {
    missedDays.push(addDays(covered, offset));
  }

  return {
    offeredOnDay: today,
    missedDays,
    cost: missed,
    balanceBefore: state.recoveryDayBalance,
    balanceAfter: state.recoveryDayBalance - missed,
    streakProtected: state.currentStreak,
    consecutiveRecoveryDaysUsedAfter: state.consecutiveRecoveryDaysUsed + missed,
    isFirstBreakTutorial: !state.hasResolvedFirstBreakOffer,
  };
}

/** Why no offer can be made for a gap this state cannot cover. */
function breakReason(state: StreakState, missed: number): StreakBreakReason {
  if (missed > RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES) {
    return 'gap-longer-than-consecutive-limit';
  }
  const consecutiveAllowance =
    RECOVERY_DAY_GUARDRAILS.MAX_CONSECUTIVE_USES - state.consecutiveRecoveryDaysUsed;
  if (missed > consecutiveAllowance) return 'consecutive-use-limit-reached';
  return 'not-enough-recovery-days';
}

function sameOffer(a: RecoveryDayOffer, b: RecoveryDayOffer): boolean {
  return (
    a.offeredOnDay === b.offeredOnDay &&
    a.cost === b.cost &&
    a.balanceBefore === b.balanceBefore &&
    a.balanceAfter === b.balanceAfter &&
    a.streakProtected === b.streakProtected &&
    a.consecutiveRecoveryDaysUsedAfter === b.consecutiveRecoveryDaysUsedAfter &&
    a.isFirstBreakTutorial === b.isFirstBreakTutorial &&
    a.missedDays.length === b.missedDays.length &&
    a.missedDays.every((day, i) => day === b.missedDays[i])
  );
}

// ---------------------------------------------------------------------------
// The read model a screen renders
// ---------------------------------------------------------------------------

/**
 * What the player should be shown when they open the app on `today`.
 *
 * A PURE READ MODEL: `openDay` mutates nothing and returns nothing that has
 * been applied. `'streak-broken'` means "this run is over as of today", and the
 * state still holds the finished run until `recordTrainingDay` or
 * `settleBrokenStreak` records it.
 */
export type DayOpening =
  /** No live run: a brand-new lifter, or one whose last run has ended. */
  | { readonly kind: 'no-active-streak'; readonly longestStreak: number }
  /** Already trained today. Nothing to do; nothing at risk. */
  | { readonly kind: 'already-trained-today'; readonly currentStreak: number }
  /** The run is intact and today extends it. */
  | {
      readonly kind: 'streak-alive';
      readonly currentStreak: number;
      readonly streakIfTrainedToday: number;
      readonly lastDayStreakCanBeSaved: StreakDay;
    }
  /** A day was missed and it can be covered. The player must answer. */
  | { readonly kind: 'recovery-day-offered'; readonly offer: RecoveryDayOffer }
  /** A day was missed and nothing can cover it. */
  | {
      readonly kind: 'streak-broken';
      readonly brokenRunLength: number;
      readonly daysMissed: number;
      readonly reason: StreakBreakReason;
    }
  /**
   * `today` is earlier than a day already accounted for. Only reachable through
   * clock skew or a bad caller; surfaced rather than silently absorbed.
   */
  | { readonly kind: 'day-in-past'; readonly requestedDay: StreakDay; readonly lastCoveredDay: StreakDay };

export function openDay(state: StreakState, today: StreakDay): DayOpening {
  if (state.lastTrainedDay === null) {
    return { kind: 'no-active-streak', longestStreak: state.longestStreak };
  }
  if (today === state.lastTrainedDay) {
    return { kind: 'already-trained-today', currentStreak: state.currentStreak };
  }
  const covered = state.recoveredThroughDay ?? state.lastTrainedDay;
  if (today <= covered) {
    return { kind: 'day-in-past', requestedDay: today, lastCoveredDay: covered };
  }

  const missed = daysMissedBefore(state, today);
  if (missed === 0) {
    return {
      kind: 'streak-alive',
      currentStreak: state.currentStreak,
      streakIfTrainedToday: state.currentStreak + 1,
      lastDayStreakCanBeSaved: lastDayStreakCanBeSaved(state) ?? today,
    };
  }

  const offer = currentRecoveryDayOffer(state, today);
  if (offer !== null) {
    return { kind: 'recovery-day-offered', offer };
  }
  return {
    kind: 'streak-broken',
    brokenRunLength: state.currentStreak,
    daysMissed: missed,
    reason: breakReason(state, missed),
  };
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/** A run that has ended, reset to "no live run". `longestStreak` survives. */
function endRun(state: StreakState): StreakState {
  return {
    ...state,
    currentStreak: 0,
    lastTrainedDay: null,
    recoveredThroughDay: null,
    consecutiveRecoveryDaysUsed: 0,
  };
}

/** Credits a grant, clipped at the hold cap. Returns what actually landed. */
function credit(balance: number, amount: number): { readonly credited: number; readonly wasted: number } {
  const room = Math.max(0, RECOVERY_DAY_GUARDRAILS.HOLD_CAP - balance);
  const credited = Math.min(amount, room);
  return { credited, wasted: amount - credited };
}

/** What a recorded training day did. */
export interface TrainingDayOutcome {
  readonly state: StreakState;
  readonly day: StreakDay;
  readonly streakBefore: number;
  readonly streakAfter: number;
  /** True when a previous run ended before today, unsaved. */
  readonly previousRunEnded: boolean;
  /** Length of that ended run, 0 if none ended. */
  readonly endedRunLength: number;
  /** Milestones reached today for the first time ever (GDD §4.2), ascending. */
  readonly milestonesReached: readonly number[];
  /** Recovery Days actually credited by those milestones. */
  readonly recoveryDaysGranted: number;
  /** Milestone reward lost to the hold cap. Reported, never silent. */
  readonly recoveryDaysWastedToHoldCap: number;
  readonly isNewLongestStreak: boolean;
}

/**
 * Records that the player trained on `day`. THE ONLY WAY `currentStreak`
 * INCREASES.
 *
 * Takes a day and nothing else: there is no parameter for a Recovery Day, a
 * purchase, a boost or a session quality, so nothing bought can change what
 * showing up is worth (§4 of the header).
 *
 * Refuses with `RECOVERY_DECISION_PENDING` when an offer is outstanding. That
 * is GDD §4.2's "manual use, not auto-apply" made structural: a caller cannot
 * bypass the player's decision by recording the session first. When the gap
 * cannot be covered there is no decision to make, so this settles the broken
 * run and starts a new one at 1 — training is never blocked, and it never
 * spends a Recovery Day.
 */
export function recordTrainingDay(state: StreakState, day: StreakDay): StreakResult<TrainingDayOutcome> {
  if (day === state.lastTrainedDay) {
    return fail('ALREADY_TRAINED_TODAY', 'Today is already logged. Your streak is safe.');
  }
  const covered = lastCoveredDay(state);
  if (covered !== null && day <= covered) {
    return fail(
      'DAY_IN_PAST',
      'That day has already been accounted for, so it cannot be recorded again.',
    );
  }

  const missed = daysMissedBefore(state, day);
  if (missed > 0 && currentRecoveryDayOffer(state, day) !== null) {
    return fail(
      'RECOVERY_DECISION_PENDING',
      'Answer the Recovery Day offer first — using one is your call, not ours.',
    );
  }

  const previousRunEnded = missed > 0;
  const base = previousRunEnded ? endRun(state) : state;
  const streakAfter = base.currentStreak + 1;

  // Once per lifetime: a milestone is due exactly when this session pushes the
  // streak to it for the first time ever, which `longestStreak` already
  // records. There is no second ledger that could disagree with it.
  const milestonesReached = STREAK_MILESTONE_DAYS.filter(
    (milestone) => streakAfter >= milestone && base.longestStreak < milestone,
  );
  const reward = milestonesReached.length * RECOVERY_DAY_ECONOMY.STREAK_MILESTONE_GRANT;
  const { credited, wasted } = credit(base.recoveryDayBalance, reward);

  return ok({
    state: {
      currentStreak: streakAfter,
      longestStreak: Math.max(base.longestStreak, streakAfter),
      lastTrainedDay: day,
      recoveredThroughDay: null,
      consecutiveRecoveryDaysUsed: 0,
      recoveryDayBalance: base.recoveryDayBalance + credited,
      hasResolvedFirstBreakOffer: base.hasResolvedFirstBreakOffer,
    },
    day,
    streakBefore: state.currentStreak,
    streakAfter,
    previousRunEnded,
    endedRunLength: previousRunEnded ? state.currentStreak : 0,
    milestonesReached,
    recoveryDaysGranted: credited,
    recoveryDaysWastedToHoldCap: wasted,
    isNewLongestStreak: streakAfter > state.longestStreak,
  });
}

/**
 * THE COMPLETE SET OF FIELDS `RecoveryDayOutcome` MAY HAVE — the second half of
 * the allowlist described in §4 of the header. This is everything spending a
 * Recovery Day reports, and every entry is a streak fact or a description of
 * the spend itself. Adding one fails `tsc` until it is listed here.
 */
export const RECOVERY_DAY_OUTCOME_KEYS = [
  'state',
  'coveredDays',
  'recoveryDaysSpent',
  'balanceAfter',
  'streakProtected',
  'wasFirstBreakTutorial',
] as const;

export type RecoveryDayOutcomeKey = (typeof RECOVERY_DAY_OUTCOME_KEYS)[number];

/** Everything that happens when a Recovery Day is spent. Nothing else does. */
export interface RecoveryDayOutcome {
  readonly state: StreakState;
  /** The missed days now covered, ascending. */
  readonly coveredDays: readonly StreakDay[];
  readonly recoveryDaysSpent: number;
  readonly balanceAfter: number;
  /** The run that survived. Unchanged by the save — Recovery Days do not count. */
  readonly streakProtected: number;
  /** True if this was the GDD §4.3 tutorial offer. */
  readonly wasFirstBreakTutorial: boolean;
}

/** Compile-time assertion, same mechanism as `RECOVERY_DAY_REACH_IS_STREAK_ONLY`. */
export const RECOVERY_DAY_OUTCOME_IS_STREAK_ONLY: KeysAreExactly<
  RecoveryDayOutcome,
  RecoveryDayOutcomeKey
> = true;

/**
 * The player said yes. Spends `offer.cost` Recovery Days and keeps the run
 * alive across the missed days.
 *
 * The offer is RE-DERIVED from the state and compared field by field rather
 * than trusted, so a stale or fabricated offer cannot spend a different amount
 * or protect a run that has already ended.
 *
 * Note what does NOT change: `currentStreak`. A Recovery Day protects the run;
 * it is not a training day and never counts as one (§2 of the header).
 */
export function acceptRecoveryDayOffer(
  state: StreakState,
  offer: RecoveryDayOffer,
): StreakResult<RecoveryDayOutcome> {
  const live = currentRecoveryDayOffer(state, offer.offeredOnDay);
  if (live === null) {
    return fail('NO_RECOVERY_DAY_OFFER', 'There is no Recovery Day offer to accept right now.');
  }
  if (!sameOffer(live, offer)) {
    return fail(
      'OFFER_DOES_NOT_MATCH_STATE',
      'That Recovery Day offer is out of date. Reopen the day and check the new one.',
    );
  }

  const lastMissedDay = live.missedDays[live.missedDays.length - 1];
  if (lastMissedDay === undefined) {
    // Unreachable: `currentRecoveryDayOffer` only returns offers with cost >= 1.
    return fail('NO_RECOVERY_DAY_OFFER', 'There is no Recovery Day offer to accept right now.');
  }

  return ok({
    state: {
      ...state,
      recoveredThroughDay: lastMissedDay,
      consecutiveRecoveryDaysUsed: live.consecutiveRecoveryDaysUsedAfter,
      recoveryDayBalance: live.balanceAfter,
      hasResolvedFirstBreakOffer: true,
    },
    coveredDays: live.missedDays,
    recoveryDaysSpent: live.cost,
    balanceAfter: live.balanceAfter,
    streakProtected: state.currentStreak,
    wasFirstBreakTutorial: live.isFirstBreakTutorial,
  });
}

/** What declining an offer, or settling an uncoverable gap, did. */
export interface StreakBreakOutcome {
  readonly state: StreakState;
  /** The run that ended. */
  readonly endedRunLength: number;
  readonly daysMissed: number;
  /** Recovery Days held afterwards. Declining costs nothing. */
  readonly balanceAfter: number;
  /** True if the declined offer was the GDD §4.3 tutorial one. */
  readonly wasFirstBreakTutorial: boolean;
}

/**
 * The player said no. THE RUN REALLY ENDS — this is not a soft no, and the
 * balance is untouched. Without that, "manual use" would be theatre.
 *
 * Resolving the offer either way consumes the first-break tutorial, so the
 * explanation does not reappear on the next break.
 */
export function declineRecoveryDayOffer(
  state: StreakState,
  offer: RecoveryDayOffer,
): StreakResult<StreakBreakOutcome> {
  const live = currentRecoveryDayOffer(state, offer.offeredOnDay);
  if (live === null) {
    return fail('NO_RECOVERY_DAY_OFFER', 'There is no Recovery Day offer to decline right now.');
  }
  if (!sameOffer(live, offer)) {
    return fail(
      'OFFER_DOES_NOT_MATCH_STATE',
      'That Recovery Day offer is out of date. Reopen the day and check the new one.',
    );
  }

  return ok({
    state: { ...endRun(state), hasResolvedFirstBreakOffer: true },
    endedRunLength: state.currentStreak,
    daysMissed: live.cost,
    balanceAfter: state.recoveryDayBalance,
    wasFirstBreakTutorial: live.isFirstBreakTutorial,
  });
}

/**
 * Records a run ending where nothing could have saved it — the gap is longer
 * than the guardrails allow, or the player holds too few Recovery Days.
 *
 * Optional: `recordTrainingDay` settles the same break on its own. This exists
 * so a "your streak ended" screen, or a server-side nightly job, can write the
 * fact down without waiting for the next session.
 *
 * REFUSES while an offer is outstanding. A break the player could still be
 * saved from is theirs to settle, and settling it here would be an auto-decline
 * — the mirror image of the auto-apply GDD §4.2 rules out.
 *
 * Does NOT consume the first-break tutorial: a break with no possible save is
 * not the moment §4.3 describes, so the explanation still fires at the first
 * break the player can actually be saved from.
 */
export function settleBrokenStreak(state: StreakState, today: StreakDay): StreakResult<StreakBreakOutcome> {
  const missed = daysMissedBefore(state, today);
  if (missed === 0) {
    return fail('NOTHING_TO_SETTLE', 'Your streak is intact — there is nothing to settle.');
  }
  if (currentRecoveryDayOffer(state, today) !== null) {
    return fail(
      'RECOVERY_DECISION_PENDING',
      'Answer the Recovery Day offer first — using one is your call, not ours.',
    );
  }
  return ok({
    state: endRun(state),
    endedRunLength: state.currentStreak,
    daysMissed: missed,
    balanceAfter: state.recoveryDayBalance,
    wasFirstBreakTutorial: false,
  });
}

// ---------------------------------------------------------------------------
// Earning and buying
// ---------------------------------------------------------------------------

/**
 * Free paths whose size is a game rule, so the amount is not the caller's to
 * choose (GDD §4.2's earning table).
 */
export type FixedRecoveryDaySource = 'signup' | 'streak-milestone' | 'achievement' | 'gym-empire';

/**
 * Sources whose size is a store or season decision rather than a game rule: a
 * bundle is however many the store sold (GDD §8.2), and a pass tier pays out
 * whatever that tier pays out (GDD §8.3C).
 */
export type VariableRecoveryDaySource = 'season-pass' | 'purchase-chalk' | 'purchase-gym-bucks';

/**
 * Where a granted Recovery Day came from.
 *
 * RECORDED ON THE EVENT, NEVER ON THE BALANCE. `grantRecoveryDays` echoes it
 * back for receipts and analytics and stores nothing; the ledger is one
 * integer. `acceptRecoveryDayOffer` has no source parameter and no way to reach
 * one, so no code path in this module can make a bought Recovery Day behave
 * differently from an earned one. `streak.test.ts` asserts state-level equality
 * across every member of this union.
 *
 * All this union changes is the SIZE of a grant, and only for the variable
 * members. It cannot change what a Recovery Day DOES, because the thing that
 * spends one never sees it.
 */
export type RecoveryDaySource = FixedRecoveryDaySource | VariableRecoveryDaySource;

/** Every source, in one array, so tests can sweep the whole union. */
export const RECOVERY_DAY_SOURCES = [
  'signup',
  'streak-milestone',
  'achievement',
  'gym-empire',
  'season-pass',
  'purchase-chalk',
  'purchase-gym-bucks',
] as const satisfies readonly RecoveryDaySource[];

/**
 * How many a fixed-amount source pays. The GDD §4.2 free path in one table.
 *
 * The point of splitting fixed from variable is that a caller CANNOT inflate a
 * free-path reward: `{ source: 'achievement' }` takes no amount, so the only
 * number it can ever credit is the one on this table.
 */
export const RECOVERY_DAY_GRANT_AMOUNT: Readonly<Record<FixedRecoveryDaySource, number>> = {
  signup: RECOVERY_DAY_ECONOMY.SIGNUP_GRANT,
  'streak-milestone': RECOVERY_DAY_ECONOMY.STREAK_MILESTONE_GRANT,
  achievement: RECOVERY_DAY_ECONOMY.ACHIEVEMENT_GRANT,
  'gym-empire': RECOVERY_DAY_ECONOMY.GYM_EMPIRE_DROP_GRANT,
};

export type RecoveryDayGrant =
  /** Amount comes from `RECOVERY_DAY_GRANT_AMOUNT`; there is no field to set. */
  | { readonly source: FixedRecoveryDaySource }
  /** Bundle or pass payout. The size is the store's decision, not a game rule. */
  | { readonly source: VariableRecoveryDaySource; readonly amount: number };

/** The amount a grant credits before the hold cap is applied. */
export function recoveryDayGrantAmount(grant: RecoveryDayGrant): number {
  return 'amount' in grant ? grant.amount : RECOVERY_DAY_GRANT_AMOUNT[grant.source];
}

export interface RecoveryDayGrantOutcome {
  readonly state: StreakState;
  /** Echoed back for the receipt. Not stored — see `RecoveryDaySource`. */
  readonly source: RecoveryDaySource;
  readonly credited: number;
  /** Lost to `RECOVERY_DAY_GUARDRAILS.HOLD_CAP`. Reported, never silent. */
  readonly wastedToHoldCap: number;
  readonly balanceAfter: number;
}

/**
 * Credits Recovery Days, clipped at the hold cap.
 *
 * The grant has already been decided elsewhere: this does not price anything,
 * does not touch Chalk or Gym Bucks, and does not roll for the Gym Empire drop
 * — all three live outside this module (§4 and §7 of the header). Free-path
 * amounts come from `RECOVERY_DAY_GRANT_AMOUNT` and cannot be overridden by the
 * caller; only store and season payouts carry an `amount`.
 */
export function grantRecoveryDays(
  state: StreakState,
  grant: RecoveryDayGrant,
): StreakResult<RecoveryDayGrantOutcome> {
  const amount = recoveryDayGrantAmount(grant);
  if (!Number.isSafeInteger(amount) || amount < 1) {
    return fail('INVALID_GRANT', `A Recovery Day grant must be a whole number of at least 1, received ${amount}.`);
  }
  const { credited, wasted } = credit(state.recoveryDayBalance, amount);
  return ok({
    state: { ...state, recoveryDayBalance: state.recoveryDayBalance + credited },
    source: grant.source,
    credited,
    wastedToHoldCap: wasted,
    balanceAfter: state.recoveryDayBalance + credited,
  });
}
