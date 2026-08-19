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
 *   - the ladder local -> regional -> nationals -> worlds (§6.1), with the
 *     summit split in two by §6.6's second ruling of 2026-08-14 — see the tier
 *     block below, which carries that argument in full;
 *   - entry gated by a qualifying total earned at earlier meets (§6.1, §6.6);
 *   - local is asynchronous with an NPC field, on a "weekly/biweekly cadence";
 *     regional, nationals and competitive worlds are SCHEDULED LIVE WINDOWS
 *     shared by every entrant; campaign worlds is asynchronous with an NPC
 *     field and is required to be "always reachable" (§6.6);
 *   - nationals are quarterly and the competitive summit annual (§6.6);
 *   - competitive worlds asks 650 kg — §6.6's Q1 ruling assigns the existing
 *     figure to that tier by name, because `docs/research/qualifying-totals.md`
 *     derives it as P75 of the real nationals field and that is a
 *     competitive-population number by construction;
 *   - the ruleset words raw / equipped / tested / untested (§2.1).
 *
 * Decided here, because the document does not say:
 *
 *   1. The qualifying totals themselves, except competitive worlds' 650. §6.1
 *      says meets are gated by them and names no other number. See the block.
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

/**
 * GDD §6.1's ladder, with §6.6's summit split into the two tiers that ruling
 * created.
 *
 * ---------------------------------------------------------------------------
 * WHY A FIFTH MEMBER AND NOT A DISCRIMINATOR ON `worlds`
 * ---------------------------------------------------------------------------
 * §6.6's second ruling of 2026-08-14 says the summit is two tiers: a **campaign
 * worlds** (async, NPC field, required to be always reachable) and a
 * **competitive worlds** (synchronous PvP, the harder ceiling), with separate
 * qualifying totals and the campaign one lower. The shape that ruling arrives
 * in has two candidate encodings, and this is the argument for the one taken.
 *
 * The alternative was one `worlds` tier carrying a campaign/competitive
 * discriminator. It was rejected on a count: EVERY per-tier record in this file
 * differs between the two summits, and there are six of them —
 * `QUALIFYING_TOTAL_KG` (the ruling: separate, campaign lower), `CADENCE_DAYS`
 * (semi-annual against annual), `PHASE_DAYS` (late in the season against day
 * six), `TIER_SCHEDULING` (async against sync), `TIER_LABEL` and
 * `TIER_MEET_NAME`. A discriminator would leave every one of those six keyed by
 * a tier that no longer determines its value, so each would need a second
 * lookup hung off the discriminator — and TypeScript would stop checking that
 * the second lookup is total, which is the property the `Record<CareerMeetTier,
 * T>` shape is here for. A fifth member keeps all six exhaustive for free, and
 * a seventh record added later is exhaustive for free as well.
 *
 * It also matches the document: §6.6's own table after both rulings has five
 * rows, not four with a note.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE ORDER MEANS, SINCE TWO SUMMITS DO NOT OBVIOUSLY HAVE ONE
 * ---------------------------------------------------------------------------
 * `federation.ts` exposes `tierIndex` and `tiersLowestFirst`, which assume a
 * total order. So the order has to be stated rather than assumed, because the
 * natural reading of "two summits" is that they are PARALLEL.
 *
 * THE ORDER IS AN ORDER ON THE QUALIFYING GATE, AND ON NOTHING ELSE. Campaign
 * worlds sits below competitive worlds because §6.6 rules its total lower, and
 * `careerTuning.test.ts` pins the gates strictly increasing along this array.
 * That is the whole of what the position claims.
 *
 * It is specifically NOT a prerequisite chain, and the code agrees: `qualifiesFor`
 * compares a lifter's best total against the meet's own bar and reads no history
 * of tiers cleared, so entering a campaign worlds is not required before a
 * competitive one and vice versa. The two live readers of the order are the
 * same-day tie-break in `scheduledMeets` — which the shipped phases make
 * unreachable — and `entryTier()`, which takes index 0. Neither walks the array
 * as a ladder a lifter climbs rung by rung.
 */
export type CareerMeetTier =
  | 'local'
  | 'regional'
  | 'nationals'
  | 'campaign-worlds'
  | 'competitive-worlds';

/**
 * The ladder as an array, lowest first.
 *
 * Order is load-bearing rather than cosmetic: `federation.ts` reads it to say
 * which tier is the entry tier, and `careerTuning.test.ts` asserts the
 * qualifying totals rise along it. See the type above for what "lowest" means
 * once the summit is two tiers.
 */
export const MEET_TIER_ORDER = [
  'local',
  'regional',
  'nationals',
  'campaign-worlds',
  'competitive-worlds',
] as const satisfies readonly CareerMeetTier[];

/**
 * GDD §6.6 splits the ladder by mode, and after both 2026-08-14 rulings the
 * split is not a single cut across the order.
 *
 * The first ruling moved REGIONAL across: "the boundary is now drawn between
 * the entry tier and every tier above it", so local is the one async rung of
 * the original four. The second ruling then put an async tier back at the top —
 * campaign worlds, whose whole purpose is a summit that does not wait on other
 * players being awake. So `async` is local and campaign worlds; `sync` is
 * everything between them, and the modes deliberately do not partition the
 * order into a low half and a high half.
 *
 * REGIONAL'S VALUE HERE WAS STALE AND IS CORRECTED IN THIS PIECE. It read
 * `async` against a document that had ruled it synchronous, and
 * `careerTuning.test.ts` pinned the stale reading as GDD §6.6's own. Nothing
 * branches on this map — `calendar.ts` copies it onto `CareerMeet.scheduling`
 * and no reader tests it — so the correction is a label catching up with a
 * ruling, and it builds none of the synchronous machinery §6.6 still gates
 * behind two open questions.
 */
export type MeetSchedulingMode = 'async' | 'sync';

export const TIER_SCHEDULING: Readonly<Record<CareerMeetTier, MeetSchedulingMode>> = Object.freeze({
  local: 'async',
  regional: 'sync',
  nationals: 'sync',
  'campaign-worlds': 'async',
  'competitive-worlds': 'sync',
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
   *
   * THE TWO SUMMITS ASK FOR DIFFERENT NUMBERS AND THEY ARE DIFFERENT KINDS OF
   * NUMBER. GDD §6.6's Q1 ruling settles which is which:
   *
   *   - `competitive-worlds` at 650 is a POPULATION PERCENTILE. It is P75 of
   *     the real nationals field, derived in `docs/research/qualifying-totals.md`
   *     against real meet data, and the ruling assigns it to this tier by name.
   *     This piece did not derive it and does not move it.
   *   - `campaign-worlds` at 600 is a PACING DECISION, and it is not a
   *     percentile of any real population. The ruling asks for a number
   *     "measured against what the simulation actually produces across a full
   *     career arc — reachable by a solo player who plays the campaign well, on
   *     the campaign's own timeline". `CAMPAIGN_SUMMIT_SWEEP` in
   *     `careerSweep.ts` holds the requirement it was derived to, the
   *     distribution it was read off, and the controls it is measured against.
   *
   * AND THE MEASUREMENT RULED THIS NUMBER OUT AS THE CAUSE RATHER THAN CHOOSING
   * IT, which is the honest account of where 600 came from and is worth more
   * than a claim that the sweep picked it. The admissible band is (550, 650)
   * exclusive — §6.6 rules the campaign total lower than competitive worlds',
   * and `careerTuning.test.ts` pins the gates strictly increasing along the
   * ladder, so it must also sit above nationals'. Candidates across that band
   * were measured on the campaign sweep and reachability barely moved — on the
   * two fixtures that sentence was written against. It moves at the shipped gain
   * rate; see the second re-take below.
   *
   * RE-TAKEN AFTER THE TOTALS GENERATOR WAS BOUNDED, because the old figures
   * were a measurement of a fixture that no longer exists and this block's
   * conclusion had to be shown to survive the change rather than assumed to.
   * 575, 600 and 625 reach a summit inside the first year on 192, 192 and 184 of
   * 192 simulated arcs, at median waits of 131, 154 and 177 days. They used to
   * be 178 / 176 / 175 at medians of 198 / 198 / 221.
   *
   * RE-TAKEN A SECOND TIME AT `MAX_GAIN_KG` 20, and this time the conclusion
   * survives while half of the reasoning behind it does not. Same three
   * candidates, same 192 arcs, same greedy rule:
   *
   *   gate   arcs reaching a summit   inside the first year   median wait
   *   ----   ----------------------   ---------------------   -----------
   *    575                      192                     184      267 days
   *    600                      192                     158      290 days
   *    625                      184                     112      336 days
   *
   * THE GATE IS NOT WHAT MADE THE SUMMIT UNREACHABLE, on any of the three
   * fixtures. The calendar was, and the same sweep separates the two calendar
   * knobs that fixed it. 600 holds GDD §6.6's R1 at 192 of 192, so it does not
   * move.
   *
   * WHAT DOES NOT SURVIVE IS THIS BLOCK'S CLAIM THAT THE MEASUREMENT IS UNABLE
   * TO DISCRIMINATE INSIDE THE BAND, which was a fact about the old gain rate
   * and not about the gate. At gain 70 the three
   * candidates read 192 / 192 / 184 arcs inside the first year — flat enough
   * that the choice had to be made by a stated rule. At gain 20 they read 184 /
   * 158 / 112, which is a real spread, so a tuner picking inside the band now
   * has a measurement to pick on. The midpoint rule below is still a stated rule
   * and the spread is still a pacing preference nobody has playtested; which of
   * the two should decide is a human's call, and it is flagged here rather than
   * taken.
   *
   * ONE INTERACTION THE FIRST RE-TAKE EXPOSED AND THIS ONE SHARPENED, NAMED
   * BECAUSE IT BINDS A FUTURE TUNER. `careerSweep.ts`'s `POTENTIAL_MIN_KG` — the
   * weakest ceiling a simulated career may be drawn — is 625, the midpoint of
   * THIS gate and competitive worlds'. That is why the 625 candidate is the
   * first one to slip: a lifter whose ceiling is 625 cannot reliably clear a
   * 625 gate. At gain 70 the slip showed up as 184 of 192 arcs reaching a summit
   * INSIDE THE FIRST YEAR. At gain 20 it is 184 of 192 reaching one AT ALL, over
   * the whole 728-day run — which is R1 failing rather than R2, and a much
   * harder failure. Raising the campaign gate to or past `POTENTIAL_MIN_KG`
   * breaks GDD §6.6's R1 outright, and `eligibility.test.ts` asserts the
   * ordering so that edit reddens rather than quietly emptying the requirement.
   *
   * So the number inside the band is set by a stated rule rather than by a
   * measurement that cannot discriminate: 600 is the MIDPOINT of nationals' 550
   * and competitive worlds' 650, so the campaign summit sits as far above the
   * rung below it as it sits below the ceiling. `careerTuning.test.ts` asserts
   * the midpoint rather than the literal, so a tuner who moves either neighbour
   * is told that this number has stopped being derived from anything.
   *
   * BOTH ARE GAME-FEEL VALUES AND 600 IS PROVISIONAL. Nobody has played a
   * career. What the measurement establishes is that the shipped triple — this
   * number and the campaign summit's cadence and phase below — satisfies a
   * requirement stated in numbers before the knobs were picked; it does not
   * establish that the requirement is the one a playtester will want, and it
   * cannot. The three knobs move together — a gate raised without the calendar
   * moving is exactly what produced the unreachable summit this piece exists to
   * fix — and the sweep reddens on any of the three moving.
   */
  QUALIFYING_TOTAL_KG: Object.freeze({
    local: null,
    regional: 400,
    nationals: 550,
    'campaign-worlds': 600,
    'competitive-worlds': 650,
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
   *
   * THE CAMPAIGN SUMMIT'S 182 IS THE ONE CADENCE THE DOCUMENT DOES NOT STATE,
   * and it is half of this piece's answer to "always reachable". §6.6 says
   * "annual Worlds" inside its SYNCHRONOUS bullet list, so that word is about
   * the competitive tier; the campaign summit is a tier the same section
   * created and gave no cadence to.
   *
   * Semi-annual, for a reason that is about the worst case rather than the
   * typical one. A tier that comes round every C days means a lifter who clears
   * its gate the day after one is held waits up to C days for the next, and
   * that wait is the sharpest thing "always reachable" can fail on: at C = 364
   * a player who qualifies at the wrong moment has an entire year of campaign
   * with nothing at the top of it. Halving the cadence halves that worst case
   * and leaves the tier scarce — two of the roughly eighty-six meets a year
   * holds. 182 is 26 whole weeks and divides 364, which is what keeps the
   * period arithmetic in `careerSweep.ts` exact: every cadence still divides
   * `HORIZON_DAYS`, so the calendar's pattern still repeats at one year.
   *
   * A FEEL VALUE. Two a year may well read as too many for a world
   * championship; the honest reason it is not annual is written above rather
   * than asserted to be right.
   */
  CADENCE_DAYS: Object.freeze({
    local: 7,
    regional: 14,
    nationals: 91,
    'campaign-worlds': 182,
    'competitive-worlds': 364,
  }) satisfies Readonly<Record<CareerMeetTier, number>>,

  /**
   * How far each tier's series sits after the season anchor, in days.
   *
   * These five exist to keep two tiers off the same day. Every cadence above is
   * a multiple of seven, so a tier's meets all fall on one weekday — the
   * weekday its phase picks — and five phases that differ modulo seven put the
   * five tiers on five different weekdays for every year the calendar runs,
   * not merely for the horizon a test happens to sweep.
   *
   * The cost is written down rather than hidden: four of the five tiers land
   * midweek, and real meets are held at weekends. Buying the weekend back means
   * either accepting that a worlds day is also a local day, or moving off whole
   * weeks and accepting weekday drift. That is a tuning judgement with a real
   * trade in it, and `careerTuning.test.ts` counts the collisions the shipped
   * numbers produce so a tuner who takes the other side sees the count move
   * instead of discovering it in a screenshot.
   *
   * THE FIFTH RESIDUE IS ALMOST OUT OF ROOM, which is worth a tuner knowing
   * before they add a sixth tier: there are seven weekdays, five are taken, and
   * a seventh tier makes the no-collision argument impossible rather than
   * merely tight. `careerTuning.test.ts` pins the residues as a set, so the
   * wall is a red rather than a discovery.
   *
   * THE CAMPAIGN SUMMIT'S 177 IS NOT THE REACHABILITY FIX, AND THIS PARAGRAPH
   * SAID IT WAS UNTIL THE MEASUREMENT WAS DRIVEN PROPERLY. It is worth leaving
   * the correction visible, because the mistake is the ordinary one: two knobs
   * were turned together, the result was good, and each got the other's credit.
   *
   * `CAMPAIGN_SUMMIT_SWEEP` now runs all four corners of the two-knob square.
   * Held apart, THE CADENCE ABOVE IS THE REACHABILITY FIX and this number is
   * very nearly free for that purpose: at the shipped semi-annual cadence, the
   * old day-six phase still takes 192 of 192 simulated arcs to a summit, with a
   * worst signup day of 18 against this phase's 19. The arithmetic behind that
   * is not luck — a series coming round twice a year has an occurrence within
   * 182 days of every day there is, wherever it starts.
   *
   * WHAT 177 IS ACTUALLY FOR, stated smaller and with its own number. The
   * competitive summit's phase of 6 puts a meet on the SIXTH DAY of the season,
   * when a lifter has had at most one meet and is holding around 380 kg. At
   * that phase the first campaign summit the calendar ever shows a new lifter
   * is one that NO seed can enter: `anchorArcsEnteringTheirFirstOfferedSummit`
   * measures 0 of 24 at phase 6, under either cadence, against 18 of 24 here.
   * A top-of-the-ladder meet that is furniture for every player who sees it is
   * a legibility cost, and that is the cost this number buys off — not
   * reachability, which the cadence had already bought.
   *
   * 177 mod 7 is 2, which is the residue the other four leave free. Within the
   * residues that are free, where exactly it sits is a feel decision nobody has
   * playtested.
   */
  PHASE_DAYS: Object.freeze({
    local: 0,
    regional: 3,
    nationals: 5,
    'campaign-worlds': 177,
    'competitive-worlds': 6,
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

  /**
   * The federation a lifter competes under BEFORE the choosing screen exists —
   * the Sprint 1a seeding of GDD §2.1's "pick a federation".
   *
   * This is not a quiet fallback, and the stored row says so itself: a lifter
   * seeded with this id carries `federation.chosen: false`, which is the fact
   * the 1b choosing screen gates on. The choice stays the player's until they
   * either make it or bank a meet result under this default, at which point
   * `careerServer.ts` refuses to move a career's results onto another
   * federation's calendar.
   *
   * Meridian — raw and tested — because the app's one shipped meet is a raw
   * local and the daily loop trains unequipped lifts, so the equipped feds
   * would seed a lifter into a calendar whose ruleset the Sim never simulates.
   * A design default nobody has playtested, like everything in this file.
   */
  DEFAULT_FEDERATION_ID: 'meridian' satisfies CareerFederationId,
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
  /**
   * THE TWO SUMMIT ROWS ARE THE MOST PROVISIONAL COPY IN THIS FILE, and they
   * are deliberately the GDD's own vocabulary rather than fiction invented
   * here. §6.6's table names the tiers "Campaign worlds" and "Competitive
   * worlds"; those are DESIGN-DOCUMENT words for a distinction a player should
   * probably never be shown in those terms, since "campaign" is a word about
   * the product rather than about the sport.
   *
   * Using them anyway is the smaller of two mistakes. Inventing a fictional
   * name for the split would be inventing content nobody asked for, in the one
   * file GDD §12.3 makes legally load-bearing, and it would read as settled.
   * These read as placeholders, which is what they are.
   */
  TIER_LABEL: Object.freeze({
    local: 'LOCAL',
    regional: 'REGIONAL',
    nationals: 'NATIONALS',
    'campaign-worlds': 'CAMPAIGN WORLDS',
    'competitive-worlds': 'COMPETITIVE WORLDS',
  }) satisfies Readonly<Record<CareerMeetTier, string>>,

  /** What each tier's meet is called, after the federation's own name. */
  TIER_MEET_NAME: Object.freeze({
    local: 'Open',
    regional: 'Regional Championships',
    nationals: 'National Championships',
    'campaign-worlds': 'Campaign World Championships',
    'competitive-worlds': 'World Championships',
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

  /**
   * GDD §2.1's choosing screen (Sprint 1b). None of it has been read by a
   * player. The lead names the one fact the choice actually binds — results
   * stay on the calendar they were lifted on, which is `careerServer.ts`'s
   * FEDERATION_LOCKED_BY_RESULTS refusal read forwards — and promises nothing
   * about region or sync play, because neither is built.
   */
  CHOOSE_TITLE: 'PICK A FEDERATION',
  CHOOSE_LEAD:
    'One pick, at the start of a career. A federation is a ruleset and a calendar, and results stay on the calendar they were lifted on.',
  /** Under the cards while a `choose-federation` request is in flight. */
  CHOOSE_PENDING: 'CONFIRMING',

  /**
   * GDD §6.1's calendar screen (Sprint 1b). One row per rung of the ladder —
   * the soonest upcoming meet of each tier, with the server's verdict on it.
   */
  CALENDAR_TITLE: 'CAREER CALENDAR',
  CALENDAR_LEAD: 'The next meet at every rung of the ladder, with today’s verdict on each.',
  /** The badge on a meet `entryVerdict` answered `open` for. */
  OPEN_ENTRY_BADGE: 'OPEN',
  /** Before a meet's qualifying figure, which is the meet's own datum. */
  QUALIFYING_LABEL: 'QUALIFYING TOTAL',

  /**
   * GDD §10.0's beta scope, on the one tier it locks: competitive worlds is
   * drawn — the visible harder ceiling — and never enterable, whatever the
   * verdict says about the lifter's strength. See `CAREER_BETA.LOCKED_TIERS`.
   * The line deliberately says "after the campaign" rather than naming a beta,
   * because the campaign summit is the thing the player can actually strive
   * toward today.
   */
  CEILING_LOCKED_BADGE: 'LOCKED',
  CEILING_LOCKED_LINE: 'The competitive summit. Live fields against other lifters come after the campaign.',

  /**
   * GDD §6.5's recap career lines (Sprint 1b), drawn from
   * `RecordedMeet.career` — the server's own `CareerMeetOutcome` — and from
   * nothing computed on the client.
   */
  RECAP_CAREER_BEST_LABEL: 'CAREER BEST',
  RECAP_QUALIFIED_PREFIX: 'QUALIFIES FOR',
});

// ---------------------------------------------------------------------------
// GDD §10.0 — the beta scope, as data a screen reads
// ---------------------------------------------------------------------------

/**
 * The tiers the beta draws locked: visible on the calendar, never enterable,
 * no sync UI behind them. GDD §10.0, ruled 2026-08-19: "Synchronous PvP
 * (regional / nationals / competitive worlds with real players) is post-beta;
 * competitive worlds appears as the visible, locked harder ceiling."
 *
 * ONE MEMBER, NOT THREE, and the reading is deliberate: §10.0's beta runs "the
 * full career ladder against NPC fields, through the campaign worlds summit",
 * so regional and nationals are played as campaign meets against NPCs and only
 * the competitive summit — the tier above the campaign's own — is the locked
 * ceiling. This is presentation scope, not eligibility: `entryVerdict` still
 * answers for the tier, and a screen draws the lock over whatever it says,
 * so un-locking post-beta is deleting a row here and nothing else.
 */
export const CAREER_BETA = Object.freeze({
  LOCKED_TIERS: Object.freeze(['competitive-worlds']) satisfies readonly CareerMeetTier[],
});
