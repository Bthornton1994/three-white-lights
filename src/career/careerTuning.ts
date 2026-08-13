/**
 * careerTuning.ts — the one place GDD §2.1's Career spine is tuned from.
 *
 * GDD §2.1: "Create a lifter, pick a federation (raw / equipped / tested /
 * untested), run training blocks, enter meets." GDD §6.1: "Select a meet from
 * the Career calendar (local -> regional -> nationals -> worlds), gated by
 * qualifying totals."
 *
 * Everything in this file is a starting value. Nobody has played any of it, and
 * the two blocks most likely to be wrong are named in place rather than left for
 * a reader to guess: `QUALIFYING_TOTAL_KG` and `PHASE_DAYS`.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE DOCUMENT DECIDED AND WHAT THIS FILE DECIDED
 * ---------------------------------------------------------------------------
 * Written down because a reader cannot otherwise tell the difference, and
 * because the decisions below are the ones a human is being asked to confirm.
 *
 * From the GDD, verbatim:
 *
 *   - four tiers, in this order (§6.1);
 *   - entry gated by a qualifying total earned at earlier meets (§6.1, §6.6);
 *   - local and regional are asynchronous, on a "weekly/biweekly cadence"
 *     (§6.6);
 *   - nationals are quarterly and worlds annual, and they are SCHEDULED LIVE
 *     WINDOWS shared by every entrant (§6.6);
 *   - the ruleset words raw / equipped / tested / untested (§2.1).
 *
 * Decided here, because the document does not say:
 *
 *   1. The qualifying totals themselves. §6.1 says meets are gated by them and
 *      names no number. These four are a guess at a shape — see the block.
 *   2. A single qualifying total per tier, rather than one per weight class and
 *      sex. Real qualifying totals are a table with a row per class; see the
 *      block for why this ships as one number and what replacing it costs.
 *   3. The cadences as day counts, and the phases that keep two tiers off the
 *      same day.
 *   4. One shared season anchor rather than one anchored at each lifter's
 *      signup day. §6.6's synchronous tiers force this: a live window every
 *      entrant is in cannot be measured from a date each account picks for
 *      itself. Local and regional could have gone either way and follow the
 *      same anchor so that there is one calendar rather than two.
 *   5. That a federation IS a ruleset — that §2.1's parenthetical describes
 *      what distinguishes one federation from another, so picking a federation
 *      picks a ruleset. See `federation.ts`, which holds that argument and the
 *      alternative reading it rejects.
 *   6. Four fictional federations, one per ruleset. GDD §11 leaves "invented
 *      feds, or is there licensing value in real ones" open, and §12.3 refuses
 *      a real federation identity in any string a screen can draw, so invented
 *      is the only option available without a human unlocking a partner.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT HERE
 * ---------------------------------------------------------------------------
 *   - Anything purchasable. GDD §12.3's first refusal condition is anything
 *     purchasable that affects meet performance, and a meet a player may enter
 *     is upstream of meet performance. `eligibility.ts` mechanises that as a
 *     type rather than a promise.
 *   - Venue fields — town, state, country — and the ghost field a meet is
 *     placed against. `MeetDefinition` in `src/game/meetTuning.ts` needs both
 *     to run a meet; this module schedules meets and does not run them, and
 *     inventing sixteen towns would be inventing content nobody asked for.
 *     The seam is real and is reported rather than filled.
 *   - Weight classes and divisions. `resultCard.ts` already owns the published
 *     class list; a career profile that picks one is a later piece.
 */

import type { CivilDate } from '../game/streak';

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

/** GDD §6.1's ladder, verbatim and in its order. */
export type CareerMeetTier = 'local' | 'regional' | 'nationals' | 'worlds';

/**
 * The ladder as an array, lowest first.
 *
 * Order is load-bearing rather than cosmetic: `federation.ts` reads it to say
 * which tier is the entry tier, and `careerTuning.test.ts` asserts the
 * qualifying totals rise along it.
 */
export const MEET_TIER_ORDER = [
  'local',
  'regional',
  'nationals',
  'worlds',
] as const satisfies readonly CareerMeetTier[];

/** GDD §6.6 splits the ladder here: local and regional async, the top two live. */
export type MeetSchedulingMode = 'async' | 'sync';

export const TIER_SCHEDULING: Readonly<Record<CareerMeetTier, MeetSchedulingMode>> = Object.freeze({
  local: 'async',
  regional: 'async',
  nationals: 'sync',
  worlds: 'sync',
});

// ---------------------------------------------------------------------------
// CAREER_TUNING — the knobs
// ---------------------------------------------------------------------------

export const CAREER_TUNING = Object.freeze({
  /**
   * THE QUALIFYING TOTALS, IN KILOGRAMS, AND THE LEAST EVIDENCED NUMBERS IN
   * THIS FILE.
   *
   * `null` is an open tier: no total qualifies you because none is asked for.
   * Local is open, which is not a taste decision — GDD §2.1 says Career "is
   * where players start", and a lifter's Total is `null` until their first meet
   * (§2's currency table), so a gated entry tier is a game nobody can enter.
   *
   * The other three are a guess at a shape: a regional total a competent
   * novice reaches, a national total a serious lifter works years for, and a
   * world total that reads as elite. They are not read off any published
   * qualifying table, deliberately — a real one belongs to a real federation
   * and §12.3 refuses the identity that would come with it.
   *
   * ONE NUMBER PER TIER IS A SIMPLIFICATION AND A REAL LIFTER WILL SPOT IT.
   * A published qualifying total is a table: a row per weight class, a column
   * per sex, sometimes per division and per equipment. A single threshold means
   * a 59 kg lifter and a 120 kg lifter are asked for the same total, which is
   * not how the sport works. It ships this way because the alternative is
   * inventing a sixty-cell table nobody has playtested, and because replacing
   * it is a change to one function: `qualifyingTotalKgFor` in `calendar.ts` is
   * the only reader, and a per-class version takes the lifter's class and
   * returns the same shape.
   */
  QUALIFYING_TOTAL_KG: Object.freeze({
    local: null,
    regional: 400,
    nationals: 550,
    worlds: 650,
  }) satisfies Readonly<Record<CareerMeetTier, number | null>>,

  /**
   * How often each tier comes round, in days.
   *
   * GDD §6.6 states three of these in words — local and regional on a
   * "weekly/biweekly cadence", nationals "quarterly", worlds "annual" — and
   * this is that sentence in day counts. Every one is a whole number of weeks,
   * which is what keeps the whole calendar on a stable weekday: 13 weeks for a
   * quarter and 52 for a year, rather than 91.31 and 365.25, so nothing drifts
   * across a leap year and no meet moves because February was short.
   *
   * A tuner turning these should read `PHASE_DAYS` first. The two are one
   * decision in two blocks.
   */
  CADENCE_DAYS: Object.freeze({
    local: 7,
    regional: 14,
    nationals: 91,
    worlds: 364,
  }) satisfies Readonly<Record<CareerMeetTier, number>>,

  /**
   * How far each tier's series sits after the season anchor, in days.
   *
   * These four exist to keep two tiers off the same day. Every cadence above is
   * a multiple of seven, so a tier's meets all fall on one weekday — the
   * weekday its phase picks — and four phases that differ modulo seven put the
   * four tiers on four different weekdays for every year the calendar runs,
   * not merely for the horizon a test happens to sweep.
   *
   * The cost is written down rather than hidden: three of the four tiers land
   * midweek, and real meets are held at weekends. Buying the weekend back means
   * either accepting that a worlds day is also a local day, or moving off whole
   * weeks and accepting weekday drift. That is a tuning judgement with a real
   * trade in it, and `careerTuning.test.ts` counts the collisions the shipped
   * numbers produce so a tuner who takes the other side sees the count move
   * instead of discovering it in a screenshot.
   */
  PHASE_DAYS: Object.freeze({
    local: 0,
    regional: 3,
    nationals: 5,
    worlds: 6,
  }) satisfies Readonly<Record<CareerMeetTier, number>>,

  /**
   * How far ahead the calendar is generated, in days, when a caller does not
   * say. A year, so a lifter can see exactly one worlds ahead of them.
   */
  HORIZON_DAYS: 364,

  /**
   * The day every series is measured from: a civil date, converted through
   * `streak.ts`'s `streakDayFromCivilDate` so career and the streak share one
   * definition of a day rather than two that can drift.
   *
   * It is absolute rather than per-account, and §6.6's live windows are the
   * reason (see the header). A lifter who signs up after this date sees the
   * occurrences ahead of them; nothing is generated before it.
   *
   * 2026-01-03 is a Saturday, which puts the local series — phase zero — on
   * Saturdays.
   */
  SEASON_ANCHOR: Object.freeze({ year: 2026, month: 1, day: 3 }) satisfies CivilDate,
});

// ---------------------------------------------------------------------------
// The federations
// ---------------------------------------------------------------------------

/**
 * The four ruleset axes GDD §2.1 names, as two independent binary choices.
 *
 * The document writes them as one slash-separated list, which reads as a
 * four-way pick; the sport treats them as two axes, because raw/equipped is
 * what a lifter wears and tested/untested is what the federation tests for.
 * `federation.ts` carries that argument in full.
 */
export type LiftingEquipment = 'raw' | 'equipped';
export type DrugTestingPolicy = 'tested' | 'untested';

export interface CareerRuleset {
  readonly equipment: LiftingEquipment;
  readonly testing: DrugTestingPolicy;
}

export type CareerFederationId = 'meridian' | 'ironline' | 'grandhall' | 'anvil-coast';

export interface CareerFederation {
  readonly id: CareerFederationId;
  /** Rendered. Fictional, and it has to stay fictional — GDD §12.3. */
  readonly name: string;
  readonly ruleset: CareerRuleset;
}

/**
 * The four federations a lifter picks between, one per ruleset combination.
 *
 * FICTIONAL PLACEHOLDERS, AND THE RULE IS NOT A STYLE PREFERENCE. GDD §12.3
 * refuses any real federation identity hardcoded into a string a screen can
 * draw, and §11 has not ruled on whether a real one is ever licensed. These
 * names are checked against `realIp.ts`'s watchlist through the tuning
 * registry, like every other rendered string in the game.
 *
 * One federation per ruleset is what makes §2.1's sentence work: picking a
 * federation is picking a ruleset, so the four names below and the four
 * rulesets are the same choice seen from two sides.
 */
export const CAREER_FEDERATIONS = Object.freeze([
  Object.freeze({
    id: 'meridian',
    name: 'Meridian Barbell Union',
    ruleset: Object.freeze({ equipment: 'raw', testing: 'tested' }),
  }),
  Object.freeze({
    id: 'ironline',
    name: 'Ironline Open Alliance',
    ruleset: Object.freeze({ equipment: 'raw', testing: 'untested' }),
  }),
  Object.freeze({
    id: 'grandhall',
    name: 'Grandhall Strength Federation',
    ruleset: Object.freeze({ equipment: 'equipped', testing: 'tested' }),
  }),
  Object.freeze({
    id: 'anvil-coast',
    name: 'Anvil Coast Union',
    ruleset: Object.freeze({ equipment: 'equipped', testing: 'untested' }),
  }),
]) satisfies readonly CareerFederation[];

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/**
 * Every career string a screen would draw, in one block.
 *
 * None of it has been read by a player. The refusal sentences are the ones to
 * look at first: `eligibility.ts` keys them to the verdict a screen was built
 * from, so a sentence is true of the screen the tap came from rather than of
 * whatever the state has become since.
 */
export const CAREER_COPY = Object.freeze({
  TIER_LABEL: Object.freeze({
    local: 'LOCAL',
    regional: 'REGIONAL',
    nationals: 'NATIONALS',
    worlds: 'WORLDS',
  }) satisfies Readonly<Record<CareerMeetTier, string>>,

  /** What each tier's meet is called, after the federation's own name. */
  TIER_MEET_NAME: Object.freeze({
    local: 'Open',
    regional: 'Regional Championships',
    nationals: 'National Championships',
    worlds: 'World Championships',
  }) satisfies Readonly<Record<CareerMeetTier, string>>,

  EQUIPMENT_LABEL: Object.freeze({
    raw: 'RAW',
    equipped: 'EQUIPPED',
  }) satisfies Readonly<Record<LiftingEquipment, string>>,

  TESTING_LABEL: Object.freeze({
    tested: 'TESTED',
    untested: 'UNTESTED',
  }) satisfies Readonly<Record<DrugTestingPolicy, string>>,

  /** One sentence per refusal `eligibility.ts` can return. */
  ENTRY_REFUSAL: Object.freeze({
    WRONG_FEDERATION: 'This meet is run by another federation.',
    BELOW_QUALIFYING_TOTAL: 'You need a qualifying total from an earlier meet to enter.',
    ALREADY_ENTERED: 'You have already competed at this meet.',
    MEET_HAS_PASSED: 'This meet has already been held.',
  }),

  /** The open-tier line, for a lifter with no total yet. */
  NO_QUALIFYING_TOTAL_NEEDED: 'Open entry — no qualifying total.',
});
