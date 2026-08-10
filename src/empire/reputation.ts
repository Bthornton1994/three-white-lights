/**
 * reputation.ts — GDD §5.4's reputation axis: how reputation accrues, what it
 * unlocks, and what a sponsor pays for it.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock reading and no randomness. Time arrives as an
 * `EmpireClock` parameter. Every magnitude comes from `./empireTuning`, so the
 * directory-wide magic-number audit in `empireCore.test.ts` covers this file.
 *
 * ===========================================================================
 * 1. What §5.4 asks for, and which entries this piece is the first consumer of
 * ===========================================================================
 *
 * §5.4's reputation row reads "attracts higher-tier NPCs, sponsorships" with the
 * cross-mode hook "sponsor money feeds Career economy", and §5.3 adds that the
 * legendary tier "exists but unlocks via reputation milestones, never paid
 * pulls". Three things follow, and this file is the first reader of the tuning
 * entries behind each:
 *
 *   - accrual — `REPUTATION_PER_CHECK_IN` and `REPUTATION_PER_NPC_TENURE_DAY`;
 *   - the milestone ladder — `NPC_RECRUIT_REPUTATION_THRESHOLD`, read through
 *     `empireCore.ts`'s `recruitReputationThreshold` so this module and
 *     `recruitment.ts` cannot hold two opinions about one gate;
 *   - sponsorship — `SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER`, indexed by
 *     `reputationTierIndex` over `REPUTATION_TIER_THRESHOLDS`.
 *
 * ===========================================================================
 * 2. The sponsor payout inherits its reach verdict; it does not carry one
 * ===========================================================================
 *
 * GDD §8.1 and CLAUDE.md: a sponsor does not buy a stat. A branded or sponsored
 * item is cosmetic and flavour-only, mechanically identical to the fictional
 * item it reskins, and placement buys visibility and nothing else.
 *
 * The way that is held here is the way `expansion.ts`'s `AXIS_OUTPUT` holds the
 * physio ban: a thing this module pays declares the `EmpireOutput` it feeds, and
 * the verdict is looked up from `empireCore.ts`'s `OUTPUT_SINK` / `SINK_REACH`
 * tables rather than written down again. `REPUTATION_PAYOUT_OUTPUT` is that
 * declaration and `reputationPayoutReach` is the lookup. Re-pointing the
 * sponsorship row at a progression-reaching output is the single edit that would
 * sell a stat to a partner, and `reputationVocabularyFaults` reports that edit
 * rather than leaving it to a reader.
 *
 * Two further things fall out of the same row rather than being separate rules:
 *
 *   - the row is typed `EmpireOutput`, and `empireCore.ts` keeps `'chalk'` and
 *     `'covered-day'` out of that union and names them in
 *     `EMPIRE_FORBIDDEN_OUTPUTS`. So a sponsor paid in Chalk — which buys GDD
 *     §8.3E Extra Covered Days — is a compile error, not a review note.
 *     `reputation.test.ts` asserts that with a `@ts-expect-error` directive.
 *   - no partner is named anywhere in this piece. The sponsor line is anonymous
 *     and denominated in Gym Bucks; `empireTuning.ts` says why it may not be
 *     denominated in Chalk. Attaching a real partner to a reputation tier is a
 *     GDD §12.3 decision a human takes against an actual agreement, and the
 *     licensing system carries fictional placeholders until then.
 *
 * ===========================================================================
 * 3. Reputation is player-keyed, so it gates the gym economy and nothing else
 * ===========================================================================
 *
 * `REPUTATION_PER_CHECK_IN` makes reputation move with how often the player
 * turns up. GDD §4.4's rule is about the mechanism rather than about the
 * currency: a quantity the player's own activity moves may not decide when
 * something that reaches Sim training pace arrives.
 *
 * `expansion.ts` already exempts the physio ladder from the reputation gate for
 * exactly that reason, and this module agrees with that exemption rather than
 * restating it. `reputationVocabularyFaults` states the general form of it —
 * every axis whose output is not idle-only must be ungated at every level it
 * probes — so the exemption is checked from the reputation side by a rule that
 * names no axis, and an axis that quietly acquired a progression-reaching output
 * while carrying a gate is reported too. The probe deliberately runs past the
 * shipped `STAFF_LEVEL_MAX.physio` of one, for the reason `axisReputationRule`
 * gives: confined to the ladder, the exemption's answer is zero with it and zero
 * without it.
 *
 * The test is `!== 'idle-only'` rather than `=== 'progression-reaching'`, which
 * is the conservative direction: a third reach verdict added later is treated as
 * gate-forbidden until somebody decides otherwise.
 *
 * ===========================================================================
 * 4. Two chains this file does not close, named rather than omitted
 * ===========================================================================
 *
 * Chain A is already written down in `empireCore.ts`'s header as the third sweep
 * it hands to piece E6, and this module is what makes it real rather than
 * hypothetical:
 *
 *   `REPUTATION_PER_CHECK_IN` -> reputation ->
 *   `SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER` -> Gym Bucks ->
 *   `STAFF_LEVEL_COST_GYM_BUCKS.physio` -> the wall-clock day physio arrives.
 *
 * It is earned rather than purchased, so it is not a §8.1 breach; it is §4.4's
 * shape one hop out, and the argument that it is safe — a diligent lifter is
 * only ever helped, so there is no monotonicity inversion available — is a reason
 * to measure it rather than a substitute for measuring it.
 *
 * Chain B is purchasable, and this file is where it becomes reachable, so it is
 * stated here in full rather than left for somebody to find:
 *
 *   `'gym-empire-timer-skip'` -> `EmpireClock.accelerated` -> reputation accrues
 *   against a longer gap (this module reads the idle clock, because reputation's
 *   own sink is `'gym-economy'`) -> `NPC_RECRUIT_REPUTATION_THRESHOLD` for a
 *   higher tier is met on an EARLIER WALL-CLOCK DAY -> that lifter is recruited
 *   earlier and at a larger `NPC_TIER_OUTPUT_MULTIPLIER` ->
 *   `NpcLifter.settledAt` lands earlier and the Training IQ trickle is larger
 *   sooner.
 *
 * Every type on that chain is correct, including the wall-clock brand on
 * `settledAt`. What moves with the purchase is a VALUE, and GDD §4.4 is explicit
 * that no type gives you that — it is the same shape as the fourth sweep in
 * `empireCore.ts`'s header, one subsystem over. Three things about it, stated
 * exactly:
 *
 *   - It is latent rather than live. Nothing writes `EmpireState.reputation`
 *     today; this module returns accruals and the wiring piece decides what
 *     lands in the state.
 *   - The GDD §5.1 offline cap bounds each application of it. A skip lengthens
 *     one gap, and `bankableOfflineSeconds` truncates a gap at the horizon, so a
 *     skip applied to a gap already past the horizon adds nothing at all. What
 *     it does not bound is a skip applied at every short check-in.
 *   - `reputation.test.ts` measures it rather than describing it: the wall-clock
 *     day each tier first unlocks, as a list, compared element-wise against the
 *     same list with no skip applied, with the count of moved lists pinned. That
 *     count is NOT zero at the shipped tuning, and the pin is a measurement of an
 *     open chain rather than an approval of it. A fix that closes the chain makes
 *     it zero and turns that pin red, which is the intended way to find out.
 *
 * The resolution that would close it structurally is the one `empireCore.ts`
 * already uses for tenure: a second reading of reputation on the wall clock, with
 * its own brand and no exported constructor, handed to the gate while the idle
 * reading feeds sponsorship and the screen. That is a change to
 * `EmpireState.reputation`'s shape and to `recruitment.ts`'s gate, both outside
 * this piece, so it is a request in this piece's report rather than an edit made
 * here.
 *
 * ===========================================================================
 * 5. A milestone marks and pays nothing
 * ===========================================================================
 *
 * CLAUDE.md's §4.4 note ends "milestones therefore mark, and pay nothing", and
 * `ReputationMilestone` has no amount field for that reason: reputation is
 * check-in-keyed, so a milestone payout would be a grant whose arrival day the
 * player's own schedule decides. The type carries a threshold and what it
 * unlocks, and `reputation.test.ts` pins its key set exactly so a payout field
 * arriving is a decision somebody signs.
 *
 * That is not a claim that the reputation -> Gym Bucks path is closed. The
 * sponsor line pays continuously against the same check-in-keyed quantity, which
 * is chain A above.
 */

import {
  asGymBucks,
  asReputation,
  elapsedFor,
  outputReach,
  recruitReputationThreshold,
  reputationTierIndex,
  type AcceleratedSeconds,
  type EmpireClock,
  type EmpireLedgerEntry,
  type EmpireOutput,
  type EmpireState,
  type GymBucks,
  type NpcTier,
  type OutputReach,
  type ReputationPoints,
  type UnacceleratedSeconds,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import { EXPANSION_AXES, axisOutput, axisReputationRule } from './expansion';
import {
  SHIPPED_OFFLINE_BANKING_POLICY,
  bankableOfflineSeconds,
  quantiseElapsedSeconds,
  scrubPrecision,
  type OfflineBankingPolicy,
} from './production';

// ---------------------------------------------------------------------------
// What this module pays, and where each payout ends up
// ---------------------------------------------------------------------------

/**
 * The two things GDD §5.4's reputation row produces.
 *
 * A payout is not an output: it is a line item this module computes, and it
 * declares which `EmpireOutput` it feeds in the table below.
 */
export const REPUTATION_PAYOUTS = ['reputation', 'sponsorship'] as const;

export type ReputationPayout = (typeof REPUTATION_PAYOUTS)[number];

/**
 * The `EmpireOutput` each payout feeds, so a payout inherits a reach verdict
 * instead of carrying an opinion of its own. Modelled on `AXIS_OUTPUT` in
 * `expansion.ts`; see §2 of the header.
 *
 * Typed against `EmpireOutput`, which is the half of the §8.1 rule the compiler
 * enforces: `'chalk'` and `'covered-day'` are named in
 * `EMPIRE_FORBIDDEN_OUTPUTS` and are absent from `EmpireOutput`, so a sponsor
 * row denominated in either does not compile.
 */
export const REPUTATION_PAYOUT_OUTPUT = {
  reputation: 'reputation',
  sponsorship: 'gym-bucks',
} as const satisfies Readonly<Record<ReputationPayout, EmpireOutput>>;

/** The output a payout feeds. */
export function reputationPayoutOutput(payout: ReputationPayout): EmpireOutput {
  return REPUTATION_PAYOUT_OUTPUT[payout];
}

/**
 * A payout's reach, looked up through `empireCore.ts`'s two tables.
 *
 * This module writes no reach verdict of its own; it asks. That is the whole
 * difference between a sponsor payout that cannot reach Sim progression and one
 * that is asserted not to.
 */
export function reputationPayoutReach(payout: ReputationPayout): OutputReach {
  return outputReach(reputationPayoutOutput(payout));
}

/**
 * Which payouts the GDD §5.1 offline fraction discounts.
 *
 * `OFFLINE_EARNINGS_FRACTION`'s own docstring scopes it to the Gym Bucks
 * economy, so the sponsor line takes it and the reputation line does not.
 * Written as a signed table rather than as a branch inside the arithmetic, so
 * changing either answer is a diff with a name on it.
 */
export const PAYOUT_TAKES_OFFLINE_FRACTION = {
  reputation: false,
  sponsorship: true,
} as const satisfies Readonly<Record<ReputationPayout, boolean>>;

/** The multiplier a payout's offline accrual carries. */
function offlineFraction(payout: ReputationPayout): number {
  return PAYOUT_TAKES_OFFLINE_FRACTION[payout] ? EMPIRE_TUNING.OFFLINE_EARNINGS_FRACTION : 1;
}

// ---------------------------------------------------------------------------
// How a tier unlocks — GDD §5.3, "never paid pulls"
// ---------------------------------------------------------------------------

/**
 * The one legal way an NPC tier opens.
 *
 * A vocabulary of one, which is the point: §5.3 leaves exactly one route open,
 * so the union has one member and the forbidden list below names the routes it
 * is one member instead of.
 */
export const NPC_TIER_UNLOCK_KEYS = ['reputation-milestone'] as const;

export type NpcTierUnlockKey = (typeof NPC_TIER_UNLOCK_KEYS)[number];

/**
 * The routes §5.3 refuses, named so they are refusable.
 *
 * `empireCore.ts` makes the same argument about `EMPIRE_FORBIDDEN_OUTPUTS`, and
 * GDD §8.3E's condition 3 is the reason: a rule that holds because no code path
 * happens to exist is true until somebody writes one. A word the vocabulary does
 * not contain is a compile error the day somebody reaches for it.
 */
export const FORBIDDEN_UNLOCK_KEYS = ['paid-pull', 'currency-purchase', 'chance-draw'] as const;

export type ForbiddenUnlockKey = (typeof FORBIDDEN_UNLOCK_KEYS)[number];

/** `true` when two types are mutually assignable, `false` otherwise. */
type Same<X, Y> = [X] extends [Y] ? ([Y] extends [X] ? true : false) : false;

/**
 * Compile-time assertion that no forbidden route is also a legal one, and that
 * the legal vocabulary is the single member §5.3 leaves open.
 *
 * The disjointness half alone is close to a tautology — two hand-written lists
 * that do not overlap today. The membership pin is what bites: adding a second
 * legal key, which is how a purchasable route would ship, makes
 * `Same<NpcTierUnlockKey, 'reputation-milestone'>` false and this type `never`,
 * so the declaration below stops compiling.
 *
 * Graded by `tsc --noEmit` and by nothing vitest can read: the value is a
 * literal. `reputationVocabularyFaults` is the runtime statement of the same
 * claim, walked from the lists.
 */
export type UnlockKeysAreDisjoint =
  Same<Extract<NpcTierUnlockKey, ForbiddenUnlockKey>, never> extends true
    ? Same<NpcTierUnlockKey, 'reputation-milestone'> extends true
      ? true
      : never
    : never;

export const NPC_TIERS_UNLOCK_BY_REPUTATION_ALONE: UnlockKeysAreDisjoint = true;

/**
 * How each tier unlocks. Exhaustive by `satisfies`, so a tier added to
 * `NPC_TIERS` without a route does not compile — and the only route it may be
 * given is the one key above.
 */
export const NPC_TIER_UNLOCK = {
  novice: 'reputation-milestone',
  club: 'reputation-milestone',
  regional: 'reputation-milestone',
  national: 'reputation-milestone',
  legendary: 'reputation-milestone',
} as const satisfies Readonly<Record<NpcTier, NpcTierUnlockKey>>;

/** The route a tier unlocks by. */
export function npcTierUnlockKey(tier: NpcTier): NpcTierUnlockKey {
  return NPC_TIER_UNLOCK[tier];
}

// ---------------------------------------------------------------------------
// The reputation scale and its tiers
// ---------------------------------------------------------------------------

/** How many reputation tiers the scale is cut into. */
export function reputationTierCount(): number {
  return EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS.length;
}

/** The reputation a tier index begins at. Loud on an index off the ladder. */
export function reputationTierFloor(index: number): ReputationPoints {
  const threshold = EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS[index];
  if (threshold === undefined) {
    throw new RangeError(`reputation tier ${index} is off the tier ladder`);
  }
  return asReputation(threshold);
}

/** The highest tier index the scale holds. */
export function highestReputationTierIndex(): number {
  return reputationTierCount() - 1;
}

// ---------------------------------------------------------------------------
// Milestones — GDD §5.3's "unlocks via reputation milestones"
// ---------------------------------------------------------------------------

/**
 * One milestone: the reputation it takes, and the tier it opens.
 *
 * No amount field, deliberately. See §5 of the header.
 */
export interface ReputationMilestone {
  readonly reputation: ReputationPoints;
  readonly unlocks: NpcTier;
}

/**
 * The milestone ladder, in `NPC_TIERS` order.
 *
 * Derived from `recruitReputationThreshold` rather than from a second table, so
 * the milestone a screen shows and the gate `recruitment.ts` enforces are the
 * same number by construction.
 */
export function reputationMilestones(): readonly ReputationMilestone[] {
  return Object.freeze(
    EMPIRE_TUNING.NPC_TIERS.map((tier) =>
      Object.freeze({ reputation: recruitReputationThreshold(tier), unlocks: tier }),
    ),
  );
}

/** The milestones a gym at this reputation has passed. */
export function milestonesReached(
  reputation: ReputationPoints,
): readonly ReputationMilestone[] {
  return Object.freeze(
    reputationMilestones().filter((milestone) => reputation >= milestone.reputation),
  );
}

/** The next milestone, or `null` when every one of them has been passed. */
export function nextMilestone(reputation: ReputationPoints): ReputationMilestone | null {
  for (const milestone of reputationMilestones()) {
    if (reputation < milestone.reputation) return milestone;
  }
  return null;
}

/**
 * GDD §5.3's top rung, read off the end of the ladder rather than by name.
 *
 * `NPC_TIERS`'s own docstring makes the order load-bearing and says the top rung
 * is the legendary tier, so deriving it here keeps one statement of that fact.
 */
export function topNpcTier(): NpcTier {
  const tiers = EMPIRE_TUNING.NPC_TIERS;
  const top = tiers[tiers.length - 1];
  if (top === undefined) {
    throw new RangeError('the recruitment ladder is empty, so no tier can unlock');
  }
  return top;
}

// ---------------------------------------------------------------------------
// Unlock state
// ---------------------------------------------------------------------------

/** What a gym may recruit, and how far it is from what it may not. */
export interface NpcTierUnlock {
  readonly tier: NpcTier;
  readonly threshold: ReputationPoints;
  readonly unlockedBy: NpcTierUnlockKey;
  readonly unlocked: boolean;
  /** Reputation still to earn. Zero once the tier is open. */
  readonly shortBy: number;
}

/**
 * Every tier's unlock state, in `NPC_TIERS` order.
 *
 * A function of `state.reputation` and of nothing else on the state. The
 * balance, the roster, the axes, the clock and the applied accelerants are all
 * in scope here and none of them is read, which is §5.3's "never paid pulls" as
 * an arithmetic property rather than as a promise — `reputation.test.ts` sweeps
 * every one of those fields with reputation held fixed and compares the returned
 * list element-wise, with a negative control that does read the balance.
 */
export function npcTierUnlocks(state: EmpireState): readonly NpcTierUnlock[] {
  return Object.freeze(
    EMPIRE_TUNING.NPC_TIERS.map((tier) => {
      const threshold = recruitReputationThreshold(tier);
      const shortBy = scrubPrecision(Math.max(0, threshold - state.reputation));
      return Object.freeze({
        tier,
        threshold,
        unlockedBy: npcTierUnlockKey(tier),
        unlocked: shortBy === 0,
        shortBy,
      });
    }),
  );
}

/** The tiers this gym may recruit, in ladder order. */
export function unlockedNpcTiers(state: EmpireState): readonly NpcTier[] {
  return Object.freeze(
    npcTierUnlocks(state)
      .filter((unlock) => unlock.unlocked)
      .map((unlock) => unlock.tier),
  );
}

/** Whether GDD §5.3's top rung has opened. */
export function topNpcTierUnlocked(state: EmpireState): boolean {
  const top = topNpcTier();
  for (const unlock of npcTierUnlocks(state)) {
    if (unlock.tier === top) return unlock.unlocked;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Accrual — GDD §5.1's loop, on the clock reputation's own reach entitles it to
// ---------------------------------------------------------------------------

/** The two rates §5.4's reputation axis earns at. */
export interface ReputationRates {
  readonly perCheckIn: number;
  readonly perDay: number;
  /** Roster lifters who had joined by the reading the rate was taken at. */
  readonly contributingLifters: number;
}

/**
 * The gym's reputation rates at a clock reading.
 *
 * The reading comes from `elapsedFor(at, 'reputation')`, so which of the two
 * clocks this half runs on is decided by `empireCore.ts`'s reach tables under
 * reputation's own name rather than chosen here. The annotation on `now` is the
 * fence: re-tagging reputation's sink as progression-reaching makes `elapsedFor`
 * return the wall-clock brand and this line a type error, so the two cannot
 * drift apart quietly.
 *
 * A lifter contributes from the moment they are on the roster, which is the
 * accelerated reading — the same filter `gymBucksRatePerHour` applies, written
 * the same way on purpose.
 */
export function reputationRates(state: EmpireState, at: EmpireClock): ReputationRates {
  const now: AcceleratedSeconds = elapsedFor(at, 'reputation');
  let contributingLifters = 0;
  for (const lifter of state.roster) {
    if (lifter.joinedAt > now) continue;
    contributingLifters += 1;
  }
  return Object.freeze({
    perCheckIn: EMPIRE_TUNING.REPUTATION_PER_CHECK_IN,
    perDay: scrubPrecision(EMPIRE_TUNING.REPUTATION_PER_NPC_TENURE_DAY * contributingLifters),
    contributingLifters,
  });
}

/** What one gap and its check-ins added, and what the ceiling and the cap took. */
export interface ReputationAccrual {
  /** The gym's reputation after the accrual, at or below `REPUTATION_MAX`. */
  readonly reputation: ReputationPoints;
  /** What actually landed. */
  readonly gained: number;
  readonly fromCheckIns: number;
  readonly fromTenure: number;
  /** What the `REPUTATION_MAX` ceiling refused. Reported rather than silent. */
  readonly discardedAtCeiling: number;
  /** Whole ticks of idle-clock time between the mark and now. */
  readonly secondsElapsed: number;
  /** How much of that paid. */
  readonly secondsBanked: number;
  /** How much of it the offline cap discarded. Zero inside the horizon. */
  readonly secondsDiscarded: number;
  readonly rates: ReputationRates;
  /** One entry, stamped on the wall clock, for the reputation payout. */
  readonly ledger: readonly EmpireLedgerEntry[];
}

/** A check-in count arriving from a caller is validated where the message can name it. */
function requireCheckIns(checkIns: number): void {
  if (!Number.isInteger(checkIns) || checkIns < 0) {
    throw new RangeError(`check-ins must be a whole count at or above zero, received ${checkIns}.`);
  }
}

/**
 * Accrue the reputation a gap between two check-ins earned.
 *
 * Two terms. `REPUTATION_PER_CHECK_IN` pays per check-in and is not a rate, so
 * the offline cap does not touch it — a check-in is by definition a moment the
 * player was present for. `REPUTATION_PER_NPC_TENURE_DAY` pays per roster lifter
 * per day and is banked through the same `bankableOfflineSeconds` the Gym Bucks
 * line uses, because a second uncapped earner beside a capped one is GDD §5.1's
 * cap walked around by a sibling.
 *
 * The rates are read at `collectedAt` rather than at now, for the reason
 * `production.ts` §5 gives: a rate read at now keeps growing past the horizon
 * and the cap stops flattening anything.
 *
 * Returns the reputation that would result rather than writing one. Currency and
 * progression are server-authoritative (CLAUDE.md); this is the arithmetic an
 * Edge Function would run.
 */
export function accrueReputation(
  state: EmpireState,
  collectedAt: EmpireClock,
  checkIns: number,
  policy: OfflineBankingPolicy = SHIPPED_OFFLINE_BANKING_POLICY,
): ReputationAccrual {
  requireCheckIns(checkIns);
  const gap = elapsedFor(state.clock, 'reputation') - elapsedFor(collectedAt, 'reputation');
  if (!Number.isFinite(gap) || gap < 0) {
    throw new RangeError(
      `the collection mark is ${-gap} seconds ahead of the gym's own idle clock`,
    );
  }

  const rates = reputationRates(state, collectedAt);
  const secondsElapsed = quantiseElapsedSeconds(gap);
  const secondsBanked = bankableOfflineSeconds(gap, policy);
  const secondsDiscarded = secondsElapsed - secondsBanked;

  const fromCheckIns = scrubPrecision(rates.perCheckIn * checkIns);
  const fromTenure = scrubPrecision(
    rates.perDay * offlineFraction('reputation') * (secondsBanked / EMPIRE_TUNING.SECONDS_PER_DAY),
  );
  const earned = scrubPrecision(fromCheckIns + fromTenure);
  const room = scrubPrecision(Math.max(0, EMPIRE_TUNING.REPUTATION_MAX - state.reputation));
  const gained = Math.min(earned, room);
  const discardedAtCeiling = scrubPrecision(earned - gained);
  const reputation = scrubPrecision(state.reputation + gained);

  // Stamped on the wall clock, like every other ledger entry, so a purchased
  // skip moves what a ledger contains and never when it says it happened. The
  // wall-clock reading is reached the way `production.ts` reaches it: through an
  // output whose reach entitles it to one.
  const at: UnacceleratedSeconds = elapsedFor(state.clock, 'training-iq');
  const entry: EmpireLedgerEntry = Object.freeze({
    at,
    output: reputationPayoutOutput('reputation'),
    amount: gained,
  });

  return Object.freeze({
    reputation: asReputation(reputation),
    gained,
    fromCheckIns,
    fromTenure,
    discardedAtCeiling,
    secondsElapsed,
    secondsBanked,
    secondsDiscarded,
    rates,
    ledger: Object.freeze([entry]),
  });
}

// ---------------------------------------------------------------------------
// Sponsorship — GDD §5.4's "sponsor money feeds Career economy"
// ---------------------------------------------------------------------------

/**
 * Gym Bucks a sponsor pays per calendar day at this reputation.
 *
 * A step function of the reputation tier, published per tier, the same for every
 * gym that reaches it. No partner is named and nothing about the payout depends
 * on who is paying, which is CLAUDE.md's "placement buys visibility" as a shape:
 * there is nothing here a sponsor could ask to have turned up.
 */
export function sponsorGymBucksPerDay(reputation: ReputationPoints): number {
  const index = reputationTierIndex(reputation);
  const perDay = EMPIRE_TUNING.SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER[index];
  if (perDay === undefined) {
    throw new RangeError(`reputation tier ${index} is off the sponsor ladder`);
  }
  return perDay;
}

/** What one gap of sponsorship paid. */
export interface SponsorAccrual {
  readonly gymBucks: GymBucks;
  readonly tierIndex: number;
  /** The undiscounted per-day rate the gap was paid at, read at the mark. */
  readonly perDay: number;
  readonly secondsElapsed: number;
  readonly secondsBanked: number;
  readonly secondsDiscarded: number;
  /** One entry, stamped on the wall clock, for the sponsorship payout. */
  readonly ledger: readonly EmpireLedgerEntry[];
}

/**
 * Accrue the sponsor money a gap earned.
 *
 * Runs on the clock `elapsedFor(state.clock, <the sponsorship payout's output>)`
 * hands it, which is the accelerated one because the payout feeds Gym Bucks.
 * That is legal under GDD §8.3B and is asserted legal rather than merely
 * permitted: a bought skip is supposed to make the gym earn sooner.
 *
 * Capped and discounted by the same GDD §5.1 offline model as the rest of the
 * Gym Bucks economy — see `PAYOUT_TAKES_OFFLINE_FRACTION`.
 */
export function accrueSponsorship(
  state: EmpireState,
  collectedAt: EmpireClock,
  policy: OfflineBankingPolicy = SHIPPED_OFFLINE_BANKING_POLICY,
): SponsorAccrual {
  const output = reputationPayoutOutput('sponsorship');
  const gap = elapsedFor(state.clock, output) - elapsedFor(collectedAt, output);
  if (!Number.isFinite(gap) || gap < 0) {
    throw new RangeError(
      `the collection mark is ${-gap} seconds ahead of the gym's own idle clock`,
    );
  }

  const perDay = sponsorGymBucksPerDay(state.reputation);
  const secondsElapsed = quantiseElapsedSeconds(gap);
  const secondsBanked = bankableOfflineSeconds(gap, policy);
  const secondsDiscarded = secondsElapsed - secondsBanked;
  const gymBucks = scrubPrecision(
    perDay * offlineFraction('sponsorship') * (secondsBanked / EMPIRE_TUNING.SECONDS_PER_DAY),
  );

  const at: UnacceleratedSeconds = elapsedFor(state.clock, 'training-iq');
  const entry: EmpireLedgerEntry = Object.freeze({ at, output, amount: gymBucks });

  return Object.freeze({
    gymBucks: asGymBucks(gymBucks),
    tierIndex: reputationTierIndex(state.reputation),
    perDay,
    secondsElapsed,
    secondsBanked,
    secondsDiscarded,
    ledger: Object.freeze([entry]),
  });
}

// ---------------------------------------------------------------------------
// The runtime shadow of the tables above
// ---------------------------------------------------------------------------

/**
 * What the gate probe below actually looked at.
 *
 * Separated from the fault list because a fault list that found nothing and a
 * fault list that looked at nothing read identically. Counts, not bounds.
 */
export interface ReputationCensus {
  readonly payouts: number;
  readonly milestones: number;
  readonly sponsorRungs: number;
  readonly reputationTiers: number;
  /** Axes whose output is not idle-only, so the gate ban applies to them. */
  readonly gatedAxes: number;
  /** (axis, level) pairs the gate ban was actually asked about. */
  readonly gateProbes: number;
}

/** The levels the gate probe runs over: past the top tier, so saturation is covered. */
function gateProbeCeiling(): number {
  return reputationTierCount() + 1;
}

/**
 * Every invariant this module's own tables have to satisfy, as a list of
 * messages — the same shape as `empireVocabularyFaults` in `empireCore.ts`, and
 * for the same reason: `NPC_TIERS_UNLOCK_BY_REPUTATION_ALONE` is a `const x: T =
 * true`, which `tsc --noEmit` grades and no runtime assertion can redden.
 *
 * It does not re-derive `outputReach`, `axisReputationRule` or
 * `recruitReputationThreshold`. An oracle that recomputes its subject's own
 * lookup cannot disagree with it.
 */
export function reputationVocabularyFaults(): readonly string[] {
  const faults: string[] = [];

  // §2 of the header: a payout inherits its verdict, and the verdict has to come
  // back idle-only. Re-pointing the sponsorship row at a progression-reaching
  // output is the one edit that sells a partner a stat, and it is reported here
  // by name.
  //
  // There is deliberately no membership test against `EMPIRE_OUTPUTS` here: the
  // table is typed against `EmpireOutput`, so that test could not fail. The
  // reach can.
  //
  // Read through the widened alias rather than off the tuple: the literal
  // length makes `.length === 0` a comparison TypeScript rejects as impossible,
  // which would leave the empty case unchecked for the state where it stops
  // being impossible. `empireVocabularyFaults` reads its licence rows the same
  // way for the same reason.
  const payouts: readonly ReputationPayout[] = REPUTATION_PAYOUTS;
  for (const payout of payouts) {
    const output = reputationPayoutOutput(payout);
    if (reputationPayoutReach(payout) !== 'idle-only') {
      faults.push(
        `the ${payout} payout feeds ${output}, which reaches ${reputationPayoutReach(payout)}`,
      );
    }
  }
  if (payouts.length === 0) {
    faults.push('this module pays nothing, so the reach check above checks nothing');
  }

  // §5.3: the only route into a tier is a reputation milestone.
  for (const tier of EMPIRE_TUNING.NPC_TIERS) {
    const key: string = npcTierUnlockKey(tier);
    if (!(NPC_TIER_UNLOCK_KEYS as readonly string[]).includes(key)) {
      faults.push(`${tier} unlocks by ${key}, which is not an unlock route`);
    }
    if ((FORBIDDEN_UNLOCK_KEYS as readonly string[]).includes(key)) {
      faults.push(`${tier} unlocks by ${key}, which GDD §5.3 refuses`);
    }
  }
  for (const key of NPC_TIER_UNLOCK_KEYS) {
    if ((FORBIDDEN_UNLOCK_KEYS as readonly string[]).includes(key)) {
      faults.push(`${key} is named as a legal route and as a forbidden one`);
    }
  }

  // The milestone ladder has to ascend and has to be reachable, or a tier is
  // dead content wearing a threshold.
  const milestones = reputationMilestones();
  if (milestones.length !== EMPIRE_TUNING.NPC_TIERS.length) {
    faults.push(`the milestone ladder holds ${milestones.length} rungs for ${EMPIRE_TUNING.NPC_TIERS.length} tiers`);
  }
  let previous = 0;
  for (const milestone of milestones) {
    if (milestone.reputation < previous) {
      faults.push(`the ${milestone.unlocks} milestone is below the rung beneath it`);
    }
    if (milestone.reputation > EMPIRE_TUNING.REPUTATION_MAX) {
      faults.push(`the ${milestone.unlocks} milestone is above REPUTATION_MAX, so the tier is dead content`);
    }
    previous = milestone.reputation;
  }

  // The sponsor ladder is indexed by reputation tier, so a length mismatch is a
  // rung that throws or a tier that pays nothing.
  const rungs = EMPIRE_TUNING.SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER.length;
  if (rungs !== reputationTierCount()) {
    faults.push(`the sponsor ladder holds ${rungs} rungs for ${reputationTierCount()} reputation tiers`);
  }

  // §3 of the header: reputation is check-in-keyed, so it may not gate anything
  // that is not idle-only. Stated over every axis by reach rather than by naming
  // physio, so an axis that acquired a progression-reaching output while keeping
  // a gate is reported by the same rule.
  let gateProbes = 0;
  let gatedAxes = 0;
  for (const axis of EXPANSION_AXES) {
    if (outputReach(axisOutput(axis)) === 'idle-only') continue;
    gatedAxes += 1;
    for (let level = 1; level <= gateProbeCeiling(); level += 1) {
      if (axisReputationRule(axis, level) > 0) {
        faults.push(
          `the ${axis} axis feeds ${axisOutput(axis)} and is gated on reputation at level ${level}`,
        );
      }
      gateProbes += 1;
    }
  }
  if (gatedAxes === 0) {
    faults.push('no axis reaches past the idle layer, so the gate ban above bans nothing');
  }
  if (gateProbes === 0) {
    faults.push('the gate ban probed no level at all');
  }

  return faults;
}

/** What `reputationVocabularyFaults` walked. The non-vacuity guard beside it. */
export function reputationCensus(): ReputationCensus {
  let gatedAxes = 0;
  for (const axis of EXPANSION_AXES) {
    if (outputReach(axisOutput(axis)) === 'idle-only') continue;
    gatedAxes += 1;
  }
  return Object.freeze({
    payouts: REPUTATION_PAYOUTS.length,
    milestones: reputationMilestones().length,
    sponsorRungs: EMPIRE_TUNING.SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER.length,
    reputationTiers: reputationTierCount(),
    gatedAxes,
    gateProbes: gatedAxes * gateProbeCeiling(),
  });
}
