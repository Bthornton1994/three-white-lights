/**
 * recruitment.ts — GDD §5.3: how a lifter joins the roster, and the shape that
 * makes "no gacha" a property rather than a promise.
 *
 * Pure module: zero React, zero side effects, zero I/O, no clock and no
 * randomness. Time arrives on the `EmpireState`'s own `EmpireClock`. Its only
 * imports are `./empireCore` and `./empireTuning`.
 *
 * ===========================================================================
 * 1. What GDD §12.3's second refusal condition actually asks of this file
 * ===========================================================================
 *
 * §5.3 is one of the document's few explicit design decisions: "no gacha. No
 * random pulls, no rarity chasing." Recruitment is by flat Gym Bucks cost or
 * reputation threshold, what you see is what you get, and the legendary tier
 * unlocks via reputation milestones and never by paying.
 *
 * A module can satisfy the letter of that and miss it entirely, so the shape is
 * pinned in four places rather than argued for once:
 *
 *   1. `recruitmentQuote` takes a tier and returns that tier, and so do
 *      `recruitmentOffer`, `recruitmentSchedule`, `beginRecruitment` and
 *      `completeRecruitment` — each is checked by name over the sweep, and the
 *      exported surface of both modules is pinned exactly, so a sixth producer
 *      of a tier is a diff somebody signs rather than one nothing looks at.
 *      With `recruitmentBoard` handled by (2), there is nothing here that
 *      yields a tier it was not given, so there is no outcome set for anything
 *      to select from — the operation gacha needs does not exist to be seeded.
 *   2. `recruitmentBoard` publishes every tier, always, in `NPC_TIERS` order,
 *      whatever the gym can afford. A board that filtered by purse would be a
 *      set of outcomes wearing a catalogue's clothes, and `NPC_TIERS` is read
 *      in exactly one place in these two modules, which is that function.
 *   3. The quote is a function of the tier alone. Reputation, Gym Bucks, roster
 *      size, the axes and both clock readings move the REFUSALS and move
 *      nothing else — so no amount of currency changes what a tier is, costs,
 *      or pays.
 *   4. No entropy is reachable. The transitive import closure of these two
 *      modules is walked and pinned by name — it is these two plus
 *      `empireCore.ts` and `empireTuning.ts` — so `src/game/prng.ts`,
 *      `Math.random` and every clock are outside it, and an edge into one is
 *      red on the walk rather than on a reading of this paragraph.
 *
 * Determinism alone would be a weak claim — a generator seeded from its own
 * arguments is deterministic and is still a pull. What (1) and (2) say is
 * stronger and is the thing §5.3 is about: there is no draw.
 *
 * ===========================================================================
 * 2. The two clocks, and where a purchased skip is allowed to land
 * ===========================================================================
 *
 * `NPC_RECRUIT_SECONDS` is one of the two timers GDD §8.3B sells a skip for,
 * and a recruited lifter pays Training IQ, so this is the exact two-hop hazard
 * §8.1 refuses. `empireCore.ts` answers it by splitting the clock rather than
 * by narrowing the sale, and `recruitmentSchedule` is where that lands:
 *
 *   joinsAt   = clock.accelerated   + NPC_RECRUIT_SECONDS[tier]
 *   settlesAt = clock.unaccelerated + NPC_RECRUIT_SECONDS[tier]
 *
 * A skip pushes `clock.accelerated` forward, so `joinsAt` arrives at an earlier
 * wall-clock moment and the buyer gets what they paid for. `clock.unaccelerated`
 * is wall time and nothing writes to it, so `settlesAt` — the origin the
 * Training IQ half measures tenure from — is the same number it would have been
 * with no purchase at all.
 *
 * Both lines are plain arithmetic on a branded reading, and GDD §4.4 is
 * explicit that no type sees past arithmetic: "a perfectly legal tender could
 * acquire a training sensitivity without a single type changing". So the fence
 * is a measurement, not this paragraph. `recruitment.test.ts` compares the
 * `settlesAt` list element-wise across every purchasable accelerant at every
 * horizon in `RECRUITMENT_SWEEP`, with a negative control wired so the skip
 * does move it, and pins both counts.
 *
 * The clock split alone was not enough, and the half it left open is the DAY
 * this decision is taken on. A skip pays Gym Bucks sooner on the accelerated
 * clock and finishes a space build sooner, so the gym could afford a recruit —
 * and have a slot for one — on an earlier wall-clock day, and `settlesAt` is
 * stamped from that day. So the verdict is taken against the wall-clock side of
 * both: `EmpireState.settledBooks`, which `accrueProduction` accrues at the
 * baseline line over the un-accelerated gap, and `EmpireState.settledAxes`,
 * which is the ladder as the wall clock reads it. `empireCore.ts`'s
 * `WALL_CLOCK_FUNDED_OUTPUTS` is where that side is derived: a recruit pays
 * `'training-iq'`, which reaches Sim progression, and fills a `'roster-slot'`,
 * which `GATE_TARGET` says gates it.
 *
 * ===========================================================================
 * 2a. A recruit has a purse of its own, and it is not a §5.4 rung's purse
 * ===========================================================================
 *
 * One wall-clock balance closed the PURCHASE chain and left an engagement one
 * open, measured rather than argued: while a recruit and §5.4's space, spotter
 * and physio rungs all drew on the same money, the order they were offered in
 * decided which of them got it, and that order moves with the player's check-in
 * schedule. A player who opened the app more often could end on a lower §5.2
 * Training IQ series than one who opened it less.
 *
 * GDD §5.4's third-book ruling is the fix and `RECRUIT_BOOK` is this module's
 * whole share of it: a recruit is priced against the `'training-iq'` purse,
 * which nothing on §5.4's ladders can spend. Nothing else here changes — the
 * quote, the board, the refusal order and the two clocks are what they were.
 *
 * ===========================================================================
 * 3. Charging, and why the sale is re-validated at completion
 * ===========================================================================
 *
 * `beginRecruitment` charges the flat cost and hands back the debited state
 * with a schedule; `completeRecruitment` puts the lifter on the roster. The
 * second one re-checks capacity and runs the whole `assertEmpireState` battery
 * on the result rather than trusting the verdict the first one gave, which is
 * CLAUDE.md's "a store verdict may render stale; a completed sale may not"
 * applied one subsystem over: a roster slot can disappear between the two calls
 * if the space or spotter axis is torn down, and the timer runs for hours.
 *
 * `EmpireState.gymBucks` is the empire's own local balance and not a wallet.
 * Writing `src/game/progression.ts` is a progression intent and is another
 * session's file; the wiring is a later, serialised piece.
 */

import {
  asAcceleratedSeconds,
  asGymBucks,
  asUnacceleratedSeconds,
  assertEmpireState,
  createNpcLifter,
  recruitCost,
  recruitReputationThreshold,
  recruitSeconds,
  rosterCapacity,
  type AcceleratedSeconds,
  type EmpireClock,
  type EmpireState,
  type GymBucks,
  type NpcLifter,
  type NpcTier,
  type ReputationPoints,
  type UnacceleratedSeconds,
  type WallClockFundedOutput,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';

/**
 * The output a recruit pays, and therefore the purse a recruit is bought from.
 *
 * §5.3's lifter pays GDD §5.2's Training IQ trickle. `WALL_CLOCK_FUNDED_OUTPUTS`
 * puts `'training-iq'` on the wall-clock side because it reaches Sim
 * progression, and GDD §5.4's third-book ruling gives it a purse of its own —
 * so a recruit is not competing with a §5.4 rung for one balance, which is what
 * let a check-in schedule decide which of them the money reached first.
 *
 * The type is the fence rather than the name: a value here that is not on
 * `WALL_CLOCK_FUNDED_OUTPUTS` does not compile, so this cannot quietly become
 * an idle-only purse.
 */
export const RECRUIT_BOOK: WallClockFundedOutput = 'training-iq';

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

/**
 * Why a gym may not recruit a tier right now, in the order they are reported.
 *
 * The order is part of the published contract rather than an implementation
 * detail: a screen listing reasons reads them in this order, and a test that
 * compared two refusal lists would otherwise be comparing an accident.
 */
export const RECRUITMENT_REFUSALS = [
  /** §5.3's reputation gate. The legendary tier's milestone is this row. */
  'reputation-below-threshold',
  /** §5.3's flat Gym Bucks price. */
  'gym-bucks-below-cost',
  /** §5.4's roster capacity, from the space and spotter axes. */
  'roster-at-capacity',
] as const;

export type RecruitmentRefusal = (typeof RECRUITMENT_REFUSALS)[number];

// ---------------------------------------------------------------------------
// The quote — what you see is what you get
// ---------------------------------------------------------------------------

/**
 * Everything §5.3 publishes about recruiting a tier.
 *
 * A function of the tier and of nothing else. Same tier, same four numbers, on
 * every day, for every player, at every purse.
 */
export interface RecruitmentQuote {
  readonly tier: NpcTier;
  readonly costGymBucks: GymBucks;
  readonly reputationThreshold: ReputationPoints;
  readonly durationSeconds: number;
}

/** The quote for a tier. Takes a tier, returns that tier. */
export function recruitmentQuote(tier: NpcTier): RecruitmentQuote {
  return Object.freeze({
    tier,
    costGymBucks: recruitCost(tier),
    reputationThreshold: recruitReputationThreshold(tier),
    durationSeconds: recruitSeconds(tier),
  });
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/**
 * Every reason this gym may not recruit this tier, in `RECRUITMENT_REFUSALS`
 * order. Empty means it may.
 */
export function recruitmentRefusals(
  state: EmpireState,
  tier: NpcTier,
): readonly RecruitmentRefusal[] {
  const quote = recruitmentQuote(tier);
  const refusals: RecruitmentRefusal[] = [];
  if (state.reputation < quote.reputationThreshold) {
    refusals.push('reputation-below-threshold');
  }
  // The recruit's own WALL-CLOCK book, and the WALL-CLOCK view of the slots. A
  // recruit pays Training IQ, so `'training-iq'` is on
  // `WALL_CLOCK_FUNDED_OUTPUTS` and this purchase is on the wall-clock side of
  // the split; `'roster-slot'` is on it too, because `GATE_TARGET` says a slot
  // gates the lifter who fills it. See §2 of the header: the clock split alone
  // left the DAY this decision is taken moving with a purchase, and the day is
  // what `settlesAt` is stamped from. The book is `RECRUIT_BOOK` rather than a
  // shared wall-clock balance, which is §4 of the header.
  if (state.settledBooks[RECRUIT_BOOK] < quote.costGymBucks) {
    refusals.push('gym-bucks-below-cost');
  }
  if (state.roster.length >= rosterCapacity(state.settledAxes)) {
    refusals.push('roster-at-capacity');
  }
  return Object.freeze(refusals);
}

/** Whether this gym may recruit this tier right now. */
export function mayRecruit(state: EmpireState, tier: NpcTier): boolean {
  return recruitmentRefusals(state, tier).length === 0;
}

/** One row of the recruitment board: the published quote and this gym's verdict. */
export interface RecruitmentOffer {
  readonly quote: RecruitmentQuote;
  readonly refusals: readonly RecruitmentRefusal[];
  readonly available: boolean;
}

/** The offer for one tier. */
export function recruitmentOffer(state: EmpireState, tier: NpcTier): RecruitmentOffer {
  const refusals = recruitmentRefusals(state, tier);
  return Object.freeze({
    quote: recruitmentQuote(tier),
    refusals,
    available: refusals.length === 0,
  });
}

/**
 * Every tier, always, in `NPC_TIERS` order, with this gym's verdict on each.
 *
 * The board does not filter. A tier a gym cannot afford is shown priced and
 * refused, which is what makes §5.3's "what you see is what you get" legible —
 * and what keeps the board a catalogue rather than an outcome set.
 */
export function recruitmentBoard(state: EmpireState): readonly RecruitmentOffer[] {
  return Object.freeze(EMPIRE_TUNING.NPC_TIERS.map((tier) => recruitmentOffer(state, tier)));
}

// ---------------------------------------------------------------------------
// The schedule
// ---------------------------------------------------------------------------

/**
 * When a started recruitment lands, on both clocks. See §2 of the header.
 *
 * `joinsAt` feeds `NpcLifter.joinedAt` and `settlesAt` feeds
 * `NpcLifter.settledAt`, which is what the Training IQ half measures tenure
 * from.
 */
export interface RecruitmentSchedule {
  readonly tier: NpcTier;
  readonly joinsAt: AcceleratedSeconds;
  readonly settlesAt: UnacceleratedSeconds;
}

/**
 * The schedule a recruit started at this clock would keep.
 *
 * Exported so the timing is inspectable without spending anything — the sweep
 * that compares `settlesAt` across accelerants drives this directly.
 */
export function recruitmentSchedule(tier: NpcTier, clock: EmpireClock): RecruitmentSchedule {
  const duration = recruitSeconds(tier);
  const joinsAt: number = clock.accelerated + duration;
  const settlesAt: number = clock.unaccelerated + duration;
  return Object.freeze({
    tier,
    joinsAt: asAcceleratedSeconds(joinsAt),
    settlesAt: asUnacceleratedSeconds(settlesAt),
  });
}

// ---------------------------------------------------------------------------
// Starting and completing a recruitment
// ---------------------------------------------------------------------------

/** The outcome of asking to recruit. Refused or accepted; there is no third arm. */
export type RecruitmentDecision =
  | {
      readonly kind: 'refused';
      readonly refusals: readonly RecruitmentRefusal[];
    }
  | {
      readonly kind: 'accepted';
      readonly state: EmpireState;
      readonly schedule: RecruitmentSchedule;
    };

/**
 * Charge the flat cost and start the timer.
 *
 * The debit is `RecruitmentQuote.costGymBucks` and nothing else, so what a
 * recruitment costs is the number the board published to the player before they
 * pressed anything.
 */
export function beginRecruitment(state: EmpireState, tier: NpcTier): RecruitmentDecision {
  const refusals = recruitmentRefusals(state, tier);
  if (refusals.length > 0) {
    return Object.freeze({ kind: 'refused', refusals });
  }
  // `RECRUIT_BOOK` pays, because that is the book the verdict above was taken
  // against. Debiting the accelerated one instead would make the price real and
  // the gate ornamental; debiting a different wall-clock purse would put a §5.4
  // rung's money back inside a §5.3 decision, which is the contention GDD
  // §5.4's third-book ruling removed.
  const remaining: number = state.settledBooks[RECRUIT_BOOK] - recruitmentQuote(tier).costGymBucks;
  return Object.freeze({
    kind: 'accepted',
    state: Object.freeze({
      ...state,
      settledBooks: Object.freeze({ ...state.settledBooks, [RECRUIT_BOOK]: asGymBucks(remaining) }),
    }),
    schedule: recruitmentSchedule(tier, state.clock),
  });
}

// ---------------------------------------------------------------------------
// Promotion — the same ladder without the one-way door
// ---------------------------------------------------------------------------

/**
 * WHY THIS EXISTS, and it is a measurement rather than a feature request.
 *
 * §5.4's roster is a fixed number of slots, and until this section a slot, once
 * filled, was filled forever. §5.3's tier ladder is gated on reputation, which
 * rises with wall time and with the player's own check-ins. Put those two
 * together and being EARLY is a trap: the gym that reaches its last free slot
 * sooner fills it with the best tier its reputation has unlocked SO FAR, and
 * then holds that lifter for the rest of the run while a slower gym reaches the
 * same slot after the next threshold opens and holds a better one.
 *
 * That is not a hypothesis. On the shipped engine, under
 * `'spend-once-per-calendar-day'`, five of the 24576 enumerated pairs punish
 * the more-engaged gym and every one of them is this: the diligent gym fills
 * its fifth slot at reputation 48.8 — `club` opens at 50 — and takes a
 * `novice`, and the idle gym fills the same slot six check-ins later at
 * reputation 59.2 and takes a `club`. Both then hold what they took. The
 * diligent gym is behind on Training IQ for the rest of the horizon.
 *
 * `empireInvariant.ts` §4b carries the trace and `engagement.test.ts` pins it.
 *
 * WHAT THE FIX IS, AND WHY IT IS THE PRICE DIFFERENCE. A slot's occupant may be
 * moved up to a tier the gym has since unlocked, for
 * `recruitCost(to) - recruitCost(from)`. That number is the whole of it: the
 * total a gym pays to hold tier T in a slot is `recruitCost(T)`, by whatever
 * route it got there and in however many steps. So an early cheap lifter is
 * never a sunk cost and a late expensive one is never a discount — the price of
 * a tier stops depending on WHEN the gym committed, which is the thing that was
 * punishing engagement.
 *
 * WHAT IT DOES NOT CHANGE, said plainly because each was a candidate:
 *
 *   - The reputation gate. A promotion asks `recruitReputationThreshold` for the
 *     tier it moves to, exactly as a recruitment does. §5.3's legendary rung
 *     still unlocks on a milestone and never on money.
 *   - The price table. `NPC_RECRUIT_COST_GYM_BUCKS` is untouched, and so is
 *     `NPC_TIER_OUTPUT_MULTIPLIER`. This is not a re-tune.
 *   - The purse. A promotion is paid out of `RECRUIT_BOOK`, the wall-clock
 *     Training IQ purse a recruit is paid out of, so GDD §5.4's third-book
 *     ruling holds: no sponsor money and no accelerated money reaches it.
 *   - Tenure. `joinedAt` and `settledAt` come across untouched, so a promotion
 *     is the same lifter on a better rung rather than a new hire. That is what
 *     §5.3's "output scales with gym tier + tenure/loyalty" already describes,
 *     and it is also load-bearing: resetting tenure would make a promotion a
 *     short-term LOSS, and a gym that promoted sooner would read lower for a
 *     week — the same punishment one level down.
 *
 * NO TIMER, AND THAT IS A REFUSAL RATHER THAN A SIMPLIFICATION. GDD §8.3B sells
 * skips for the build timer and the recruit timer, and §8.1 refuses anything
 * bought that moves Sim progression. A promotion raises the Training IQ trickle,
 * so a promotion timer would be a third sellable timer sitting directly on a
 * progression-reaching output — the two-hop hazard `empireCore.ts` splits the
 * clock for, with a shorter hop. An instant promotion has no timer to sell.
 */

/** Why a gym may not move a lifter up a rung, in the order they are reported. */
export const PROMOTION_REFUSALS = [
  /** The target is the lifter's own rung or below it. There is no demotion. */
  'not-a-higher-tier',
  /** §5.3's reputation gate, asked about the tier being moved TO. */
  'reputation-below-threshold',
  /** The price difference, against `RECRUIT_BOOK`. */
  'gym-bucks-below-cost',
] as const;

export type PromotionRefusal = (typeof PROMOTION_REFUSALS)[number];

/** Everything §5.3 publishes about moving a lifter from one rung to a higher one. */
export interface PromotionQuote {
  readonly from: NpcTier;
  readonly to: NpcTier;
  readonly costGymBucks: GymBucks;
  readonly reputationThreshold: ReputationPoints;
  /**
   * Seconds the promotion adds to both of the lifter's clock stamps: the
   * difference between the two rungs' recruit timers.
   *
   * THE PRICE ALONE WAS NOT ENOUGH, AND THIS IS THE MEASUREMENT THAT SAID SO.
   * With the money telescoping and the timer not, a slot that reached `club` by
   * promotion carried the `novice` timer — `settlesAt` 240 seconds earlier than
   * a slot that recruited `club` outright — and that difference is permanent
   * tenure. It reappeared as 2318 violating pairs of 16512 at a worst deficit of
   * 0.000032 Training IQ per day: tiny, real, and in the punishing direction,
   * because the diligent gym is the one that reaches a rung early enough to
   * recruit it outright while the idle one arrives by promotion.
   *
   * With both telescoping, a slot holding tier T has paid `recruitCost(T)` and
   * carries `recruitSeconds(T)` from the moment it was first committed, by every
   * route and in any number of steps — `60 + 240 + 1500` is `regional`'s 1800,
   * and `500 + 1500 + 6000` is its 8000. Path-independence is the property; the
   * two differences are how it is obtained.
   */
  readonly addedSeconds: number;
}

/** Where a tier sits on `NPC_TIERS`. The ladder's order is the ladder. */
function tierIndex(tier: NpcTier): number {
  return EMPIRE_TUNING.NPC_TIERS.indexOf(tier);
}

/**
 * The quote for moving a lifter up to `to`.
 *
 * A function of the two tiers and of nothing else, like `recruitmentQuote`.
 * Throws on a pair that is not a step up, because that is a caller that skipped
 * `promotionRefusals` rather than a gym that cannot afford something.
 */
export function promotionQuote(from: NpcTier, to: NpcTier): PromotionQuote {
  if (tierIndex(to) <= tierIndex(from)) {
    throw new RangeError(`${to} is not above ${from} on the recruitment ladder`);
  }
  const difference: number = recruitCost(to) - recruitCost(from);
  return Object.freeze({
    from,
    to,
    costGymBucks: asGymBucks(difference),
    reputationThreshold: recruitReputationThreshold(to),
    addedSeconds: recruitSeconds(to) - recruitSeconds(from),
  });
}

/**
 * Every reason this gym may not move this lifter to this tier, in
 * `PROMOTION_REFUSALS` order. Empty means it may.
 */
export function promotionRefusals(
  state: EmpireState,
  lifter: NpcLifter,
  to: NpcTier,
): readonly PromotionRefusal[] {
  if (tierIndex(to) <= tierIndex(lifter.tier)) {
    return Object.freeze(['not-a-higher-tier' as PromotionRefusal]);
  }
  const quote = promotionQuote(lifter.tier, to);
  const refusals: PromotionRefusal[] = [];
  if (state.reputation < quote.reputationThreshold) {
    refusals.push('reputation-below-threshold');
  }
  // The same book the recruitment verdict is taken against, for the same
  // reason: this is roster money, it buys Training IQ, and `RECRUIT_BOOK` is
  // the purse GDD §5.4's third-book ruling gave that output.
  if (state.settledBooks[RECRUIT_BOOK] < quote.costGymBucks) {
    refusals.push('gym-bucks-below-cost');
  }
  return Object.freeze(refusals);
}

/** Whether this gym may move this lifter to this tier right now. */
export function mayPromote(state: EmpireState, lifter: NpcLifter, to: NpcTier): boolean {
  return promotionRefusals(state, lifter, to).length === 0;
}

/** The outcome of asking to move a lifter up. Refused or accepted; no third arm. */
export type PromotionDecision =
  | {
      readonly kind: 'refused';
      readonly refusals: readonly PromotionRefusal[];
    }
  | {
      readonly kind: 'accepted';
      readonly state: EmpireState;
      readonly quote: PromotionQuote;
    };

/**
 * Charge the difference and put the lifter on the higher rung.
 *
 * The roster is rebuilt with the same lifter at the same index, carrying its own
 * id, name and both clock stamps. Nothing else on the state moves, and the whole
 * `assertEmpireState` battery runs on the result — the same re-validation
 * `completeRecruitment` does, for the same reason.
 */
export function promoteLifter(
  state: EmpireState,
  lifterId: string,
  to: NpcTier,
): PromotionDecision {
  const at = state.roster.findIndex((entry) => entry.id === lifterId);
  const lifter = state.roster[at];
  if (lifter === undefined) {
    throw new RangeError(`no lifter on this roster is called ${lifterId}`);
  }
  const refusals = promotionRefusals(state, lifter, to);
  if (refusals.length > 0) {
    return Object.freeze({ kind: 'refused', refusals });
  }
  const quote = promotionQuote(lifter.tier, to);
  // Widened to bare values for the same reason `completeRecruitment` widens
  // them: `createNpcLifter` re-brands what it is given and refuses an
  // already-branded argument. The four are in the constructor's own order.
  const id: string = lifter.id;
  const displayName: string = lifter.displayName;
  // Both stamps move by the timer difference, which is what makes the tenure a
  // slot carries a function of the tier it holds rather than of the route it
  // took. See `PromotionQuote.addedSeconds`.
  const joinedAt: number = lifter.joinedAt + quote.addedSeconds;
  const settledAt: number = lifter.settledAt + quote.addedSeconds;
  const promoted: NpcLifter = createNpcLifter(id, to, displayName, joinedAt, settledAt);
  const remaining: number = state.settledBooks[RECRUIT_BOOK] - quote.costGymBucks;
  const next: EmpireState = Object.freeze({
    ...state,
    roster: Object.freeze(state.roster.map((entry, index) => (index === at ? promoted : entry))),
    settledBooks: Object.freeze({
      ...state.settledBooks,
      [RECRUIT_BOOK]: asGymBucks(remaining),
    }),
  });
  assertEmpireState(next);
  return Object.freeze({ kind: 'accepted', state: next, quote });
}

/**
 * The promotion a gym would take if it took one: the lowest-tier lifter on the
 * roster, moved to the highest tier the gym may move them to.
 *
 * The mirror of `bestRecruitableTier` in `empireInvariant.ts`, and deliberately
 * the same shape of greedy rule — the composed loop models a player who spends
 * what they have on the best thing in front of them, and the §12.3 property has
 * to hold for that player rather than for a player chosen to make it hold.
 *
 * Ties are broken by roster order, which is join order, so the answer is a
 * function of the state and nothing else.
 */
export function bestPromotion(state: EmpireState): { lifterId: string; tier: NpcTier } | null {
  let chosen: NpcLifter | null = null;
  for (const lifter of state.roster) {
    if (chosen === null || tierIndex(lifter.tier) < tierIndex(chosen.tier)) chosen = lifter;
  }
  if (chosen === null) return null;
  const tiers = EMPIRE_TUNING.NPC_TIERS;
  for (let index = tiers.length - 1; index >= 0; index -= 1) {
    const tier = tiers[index];
    if (tier === undefined) continue;
    if (mayPromote(state, chosen, tier)) return Object.freeze({ lifterId: chosen.id, tier });
  }
  return null;
}

/**
 * Put the finished recruit on the roster.
 *
 * `id` and `displayName` are the caller's — §5.3 makes customisation the
 * collection hook, and no name table ships in this piece. Both are validated by
 * `createNpcLifter`, and the assembled state is run through the whole
 * `assertEmpireState` battery, which is what catches a duplicate id and a
 * roster that outgrew its slots between the two calls.
 *
 * Throws rather than returning a decision: `beginRecruitment` is the arm a
 * player's tap reaches and it refuses in data, whereas arriving here with a
 * schedule the gym cannot honour is a caller that skipped a step.
 */
export function completeRecruitment(
  state: EmpireState,
  schedule: RecruitmentSchedule,
  id: string,
  displayName: string,
): EmpireState {
  // The same view of the slots the verdict was taken against, rather than the
  // idle one. The idle view is never behind the settled view, so reading it
  // here would make this re-check strictly weaker than the gate it re-checks —
  // which is the shape of a guard applied to one arm and not to its sibling.
  const capacity = rosterCapacity(state.settledAxes);
  if (state.roster.length >= capacity) {
    throw new RangeError(
      `roster holds ${state.roster.length} of ${capacity} slots, so a ${schedule.tier} recruit cannot join`,
    );
  }
  // Widened to bare numbers because `createNpcLifter` re-brands what it is
  // given and refuses an already-branded argument. The two lines are adjacent
  // and in the same order as the constructor's own parameters, and the sweep in
  // `recruitment.test.ts` is what would catch them being crossed.
  const joinedAt: number = schedule.joinsAt;
  const settledAt: number = schedule.settlesAt;
  const lifter: NpcLifter = createNpcLifter(id, schedule.tier, displayName, joinedAt, settledAt);
  const next: EmpireState = Object.freeze({
    ...state,
    roster: Object.freeze([...state.roster, lifter]),
  });
  assertEmpireState(next);
  return next;
}
