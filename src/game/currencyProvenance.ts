/**
 * currencyProvenance.ts — WHERE THE MONEY CAME FROM, as a type.
 *
 * PURE MODULE (CLAUDE.md "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock, no randomness, no imports at all. It is a
 * leaf, deliberately, so that `streak.ts` and `streakSweep.ts` can both read the
 * same vocabulary without either importing the other.
 *
 * ===========================================================================
 * 1. THE RULE THIS FILE EXISTS TO MAKE UNREPRESENTABLE
 * ===========================================================================
 *
 * CLAUDE.md, GDD §4.4, GDD §8.2:
 *
 *   > No grant of covered days may be keyed to anything the lifter does — and
 *   > that covers INDIRECT paths, not only direct grants.
 *
 * The direct form was closed first: nothing in the game awards a covered day.
 * The indirect form walked straight past that guard, because it does not award
 * a covered day at all — it awards a CURRENCY, and the currency buys one:
 *
 *   an achievement pays Chalk  ->  Chalk buys an Extra Covered Day (GDD §8.3E)
 *   ->  the covered day's arrival day is back under the lifter's own training,
 *       with a currency in between.
 *
 * A season-pass tier is the same shape one hop further out. A tier every N
 * sessions is an achievement every N sessions.
 *
 * MEASURED, NOT ARGUED. On the shipped engine, matched purse and price, with
 * only the diligent lifter's buying schedule recomputed from their own
 * training: a covered day funded by achievement-earned Chalk gives
 * **105 / 305 / 733 / 785** violating pairs at 40 / 60 / 80 / 100 days, worst
 * deficit 54, against **0** for the same purse funded on the calendar, and 0
 * for no purchase at all. The purchase does not worsen the violations. It
 * CREATES them.
 *
 * ===========================================================================
 * 2. THE RESTRICTION IS SCOPED TO THE MECHANISM, NOT TO THE CURRENCY
 * ===========================================================================
 *
 * The first fix for this deleted the achievement row from GDD §8.2's Chalk
 * earning table, and a human rejected it as too broad. Achievement-earned and
 * pass-tier-earned Chalk are perfectly good money for cosmetics, timer skips,
 * gym decor and everything else Chalk buys. What they may not do is fund the
 * ONE purchase whose arrival day feeds back into the streak mechanic.
 *
 * So this module does not classify CURRENCIES. It classifies TENDERS: a
 * currency together with the way the units of it arrived. `'chalk-achievement'`
 * and `'chalk-calendar-event'` are both Chalk, and only one of them may be
 * tendered for a covered day.
 *
 * ===========================================================================
 * 3. WHY GATING HANGS OFF THE ARRIVAL AND NOT OFF THE TENDER
 * ===========================================================================
 *
 * The obvious shape is one map, tender -> gating. It works and it drifts: two
 * training-keyed tenders are two separate rows, and the day somebody adds a
 * third they get to decide its row on its own merits. That is how the
 * achievement path got closed while the season-pass-tier path stayed open — two
 * parallel judgements about the same shape.
 *
 * Here a tender declares an ARRIVAL — how its units reach a player's hands —
 * and the gating is looked up from the arrival. `'chalk-achievement'` and
 * `'chalk-season-pass-tier'` both arrive by `'session-count'`, so they are the
 * same row, and closing one closes both BY CONSTRUCTION rather than by two
 * checks that can disagree.
 *
 * Adding a tender therefore costs an arrival, and adding an ARRIVAL costs a
 * gating verdict, written in `ARRIVAL_GATING` under the paragraph saying what
 * makes an arrival safe. There is no path that adds a training-keyed tender
 * without a human writing `'training-gated'` next to something.
 *
 * ===========================================================================
 * 4. THE TYPE IS THE ENFORCEMENT; THE PREDICATE IS THE SECOND LINE
 * ===========================================================================
 *
 * `NonTrainingGatedTender` is DERIVED from `ARRIVAL_GATING` by a mapped type,
 * so `SettledCoveredDayPurchase.tender` — which is declared as that type —
 * rejects a training-gated tender at COMPILE TIME. Re-tagging
 * `'session-count'` as non-training-gated is the only edit that widens it, and
 * that edit is one word in a table with the measurement printed above it.
 *
 * `isNonTrainingGatedTender` exists anyway, because a wire payload is not
 * type-checked. A settled order arrives as JSON from an Edge Function; TypeScript
 * has no opinion about JSON. So the runtime refuses what the compiler already
 * refused, and `streak.test.ts` drives a cast training-gated tender through the
 * real entry point to prove the second line is load-bearing rather than
 * decorative.
 */

/**
 * WHAT A TENDER IS DENOMINATED IN.
 *
 * Deliberately NOT `progression.WALLET_CURRENCIES`: that list is the wallet the
 * server keeps (`gymBucks`, `chalk`), and real money is not in a wallet. This
 * is the payment side, and it has one member the wallet does not.
 */
export const TENDER_CURRENCIES = ['chalk', 'real-money'] as const;

export type TenderCurrency = (typeof TENDER_CURRENCIES)[number];

/**
 * THE COMPLETE SET OF WAYS UNITS OF A CURRENCY REACH A PLAYER'S HANDS.
 *
 * This is the axis the whole restriction turns on, so the members are described
 * by what MOVES them rather than by what they are called:
 *
 *   - `'player-chosen'` — the player decides when, and nothing in the game
 *     decides for them. Buying Chalk, watching a rewarded ad, paying cash at
 *     the till. One extra trained day does not move the day a player chooses to
 *     open their wallet.
 *   - `'calendar'` — a fixed date. "The first of the month", "week 3 of the
 *     season". Both members of a monotonicity pair reach it on the same day by
 *     construction, because neither one's training can move a date.
 *   - `'session-count'` — counted in things the lifter does: sessions,
 *     achievements, streak days, unlocked tiers. Training moves it. This is the
 *     banned shape, and it is banned for the ONE purchase in §3 of
 *     `streakEntitlement.ts`, not for the currency as a whole.
 */
export const TENDER_ARRIVALS = ['player-chosen', 'calendar', 'session-count'] as const;

export type TenderArrival = (typeof TENDER_ARRIVALS)[number];

/** The two verdicts. There is no third, and no "probably fine". */
export const CURRENCY_GATINGS = ['non-training-gated', 'training-gated'] as const;

export type CurrencyGating = (typeof CURRENCY_GATINGS)[number];

/**
 * THE ONE PLACE GATING IS DECIDED, and it is decided per ARRIVAL.
 *
 * Read §3 of the header before editing a row. Re-tagging `'session-count'` as
 * `'non-training-gated'` is the single edit that would let achievement Chalk
 * buy a covered day again; it is one word, it sits under a measurement of what
 * that costs, and `currencyProvenance.test.ts` fails on it — the negative
 * control in `streakEntitlement.test.ts` measures 105 / 305 / 733 / 785
 * violating pairs for exactly that configuration.
 *
 * Exhaustive by `satisfies`: a new arrival cannot ship without a verdict.
 */
export const ARRIVAL_GATING = {
  'player-chosen': 'non-training-gated',
  calendar: 'non-training-gated',
  'session-count': 'training-gated',
} as const satisfies Readonly<Record<TenderArrival, CurrencyGating>>;

/**
 * THE COMPLETE SET OF THINGS A COVERED DAY MIGHT BE PAID FOR WITH — including
 * the ones that may not pay for one.
 *
 * THE TRAINING-GATED MEMBERS ARE IN THIS LIST ON PURPOSE, and that reverses
 * what the previous revision did. The old list was `['chalk', 'real-money']`
 * and it kept achievement Chalk out by not having a word for it — which is the
 * same "true by the current absence of a code path" that GDD §8.3E's condition
 * 3 rules out, and it is why the hazard shipped: `'chalk'` was a legal tender,
 * achievement Chalk IS Chalk, and nothing anywhere could tell the difference.
 *
 * Naming them is what makes them refusable. `'chalk-achievement'` is a real
 * tender that really exists in a real player's wallet and really buys cosmetics
 * (GDD §8.2, restored); what it cannot do is appear in a
 * `SettledCoveredDayPurchase`, because that field's type is the derived subset
 * below and this member is not in it.
 */
export const COVERED_DAY_TENDERS = [
  /** Cash, card, store credit. The player picks the moment. */
  'real-money',
  /** Chalk bought with money. Same moment, one hop later. */
  'chalk-purchased',
  /** Chalk from a rewarded ad — opt-in, GDD §8.3D. The player picks the moment. */
  'chalk-rewarded-ad',
  /** Chalk from a dated event: "the first of the month". A date, not a deed. */
  'chalk-calendar-event',
  /** Chalk from the season pass paid BY WEEK — GDD §8.3C's safe shape. */
  'chalk-season-pass-week',
  /** Chalk for an achievement. TRAINING-GATED. Valid money, invalid tender here. */
  'chalk-achievement',
  /** Chalk from a pass TIER, which unlocks by playing. TRAINING-GATED. */
  'chalk-season-pass-tier',
] as const;

export type CoveredDayTender = (typeof COVERED_DAY_TENDERS)[number];

/** What each tender is denominated in. Exhaustive by `satisfies`. */
export const TENDER_CURRENCY = {
  'real-money': 'real-money',
  'chalk-purchased': 'chalk',
  'chalk-rewarded-ad': 'chalk',
  'chalk-calendar-event': 'chalk',
  'chalk-season-pass-week': 'chalk',
  'chalk-achievement': 'chalk',
  'chalk-season-pass-tier': 'chalk',
} as const satisfies Readonly<Record<CoveredDayTender, TenderCurrency>>;

/**
 * HOW EACH TENDER ARRIVES. The declaration a new tender cannot ship without.
 *
 * Note that five of the seven are Chalk. That is the point: the gating is not a
 * property of Chalk, it is a property of how these particular units of Chalk
 * got there.
 *
 * Exhaustive by `satisfies`.
 */
export const TENDER_ARRIVAL = {
  'real-money': 'player-chosen',
  'chalk-purchased': 'player-chosen',
  'chalk-rewarded-ad': 'player-chosen',
  'chalk-calendar-event': 'calendar',
  'chalk-season-pass-week': 'calendar',
  'chalk-achievement': 'session-count',
  'chalk-season-pass-tier': 'session-count',
} as const satisfies Readonly<Record<CoveredDayTender, TenderArrival>>;

/**
 * The gating of a tender, AT THE TYPE LEVEL: its arrival's verdict, looked up
 * through the two tables above. Nothing states a tender's gating directly.
 */
export type GatingOfTender<T extends CoveredDayTender> =
  (typeof ARRIVAL_GATING)[(typeof TENDER_ARRIVAL)[T]];

/**
 * THE TYPE `applySettledCoveredDayPurchase` ACCEPTS, and the whole of the
 * structural half of the fix.
 *
 * It is a MAPPED FILTER over `COVERED_DAY_TENDERS`, not a second hand-written
 * list. `'chalk-achievement'` is absent from it because `TENDER_ARRIVAL` says
 * `'session-count'` and `ARRIVAL_GATING` says that is training-gated — so
 * writing `tender: 'chalk-achievement'` is a COMPILE ERROR, not a runtime
 * branch, and the only way to make it compile is to edit a verdict in a table
 * that has the measurement printed above it.
 */
export type NonTrainingGatedTender = {
  [T in CoveredDayTender]: GatingOfTender<T> extends 'non-training-gated' ? T : never;
}[CoveredDayTender];

/** The complement, derived rather than written, so the two cannot overlap. */
export type TrainingGatedTender = Exclude<CoveredDayTender, NonTrainingGatedTender>;

/**
 * Compile-time proof that the two halves PARTITION the whole: every tender is
 * in exactly one of them, and nothing is in neither.
 *
 * It cannot fail as written — `TrainingGatedTender` is an `Exclude` — and that
 * is the point of writing it down: if a later edit replaces either type with a
 * hand-written list, this stops being a tautology and starts being a test.
 */
export type TendersArePartitioned = [
  Exclude<CoveredDayTender, NonTrainingGatedTender | TrainingGatedTender>,
] extends [never]
  ? [Extract<NonTrainingGatedTender, TrainingGatedTender>] extends [never]
    ? true
    : never
  : never;

export const TENDER_GATING_IS_A_PARTITION: TendersArePartitioned = true;

/** The gating of a tender at runtime, by the same two-hop lookup as the type. */
export function tenderGating(tender: CoveredDayTender): CurrencyGating {
  return ARRIVAL_GATING[TENDER_ARRIVAL[tender]];
}

/** True for anything in `COVERED_DAY_TENDERS`. Narrows an unknown wire value. */
export function isCoveredDayTender(value: unknown): value is CoveredDayTender {
  return (COVERED_DAY_TENDERS as readonly unknown[]).includes(value);
}

/**
 * THE RUNTIME HALF OF THE REFUSAL. True only for a tender whose arrival is not
 * training-gated.
 *
 * The compiler already refuses a training-gated tender at every call site that
 * is written in TypeScript. This is for the call sites that are not: a settled
 * order decoded from an Edge Function response is JSON, and JSON has no types.
 */
export function isNonTrainingGatedTender(value: unknown): value is NonTrainingGatedTender {
  return isCoveredDayTender(value) && tenderGating(value) === 'non-training-gated';
}

/**
 * The tenders that MAY fund an Extra Covered Day, as a value.
 *
 * Filtered from the one list through the one predicate, so it can never name a
 * tender the type would reject — a second literal list here is exactly the
 * drift §3 of the header is about.
 */
export const NON_TRAINING_GATED_TENDERS: readonly NonTrainingGatedTender[] =
  COVERED_DAY_TENDERS.filter(isNonTrainingGatedTender);

/**
 * The tenders that MAY NOT. Also derived, and asserted non-empty by
 * `currencyProvenance.test.ts`: a partition with an empty side is a restriction
 * that restricts nothing, and it would pass every other test in this file.
 */
export const TRAINING_GATED_TENDERS: readonly TrainingGatedTender[] = COVERED_DAY_TENDERS.filter(
  (tender): tender is TrainingGatedTender => !isNonTrainingGatedTender(tender),
);
