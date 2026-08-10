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
 * both: `EmpireState.settledGymBucks`, which `accrueProduction` accrues at the
 * baseline line over the un-accelerated gap, and `EmpireState.settledAxes`,
 * which is the ladder as the wall clock reads it. `empireCore.ts`'s
 * `WALL_CLOCK_FUNDED_OUTPUTS` is where that side is derived: a recruit pays
 * `'training-iq'`, which reaches Sim progression, and fills a `'roster-slot'`,
 * which `GATE_TARGET` says gates it.
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
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';

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
  // The WALL-CLOCK book, and the WALL-CLOCK view of the slots. A recruit pays
  // Training IQ, so `'training-iq'` is on `WALL_CLOCK_FUNDED_OUTPUTS` and this
  // purchase is on the wall-clock side of the split; `'roster-slot'` is on it
  // too, because `GATE_TARGET` says a slot gates the lifter who fills it. See
  // §2 of the header: the clock split alone left the DAY this decision is taken
  // moving with a purchase, and the day is what `settlesAt` is stamped from.
  if (state.settledGymBucks < quote.costGymBucks) {
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
  // The wall-clock book pays, because that is the book the verdict above was
  // taken against. Debiting the accelerated one instead would make the price
  // real and the gate ornamental.
  const remaining: number = state.settledGymBucks - recruitmentQuote(tier).costGymBucks;
  return Object.freeze({
    kind: 'accepted',
    state: Object.freeze({ ...state, settledGymBucks: asGymBucks(remaining) }),
    schedule: recruitmentSchedule(tier, state.clock),
  });
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
