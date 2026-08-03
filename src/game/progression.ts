/**
 * progression.ts — the server-authoritative progression boundary (GDD §9.2).
 *
 * PURE MODULE (CLAUDE.md "Pure logic is separate from UI"): zero React imports,
 * zero side effects, zero I/O, no clock, no randomness, explicit return types on
 * every export. `progression.test.ts` scans this file's own source for `Date`,
 * `Math.random` and `fetch` so the claim is checked rather than asserted.
 *
 * THERE IS NO BACKEND AND THIS FILE IS NOT ONE. It contains no network calls, no
 * Supabase client and no promises. What it contains is the *shape* of the seam:
 * the types and transitions that make client-authoritative progression writes
 * fail `tsc`, so the day a real Edge Function lands nothing has to be unwound.
 *
 * ===========================================================================
 * 1. WHAT THIS MODULE CLAIMS, AND THE ONE SENTENCE IT REDUCES TO
 * ===========================================================================
 *
 * **The client proposes inputs. The server publishes outputs. Nothing here lets
 * an output be authored locally.**
 *
 * "Inputs" are what the player did: this set at this weight for these reps at
 * this RPE; this attempt got these lights; this SKU was purchased. "Outputs" are
 * what the numbers became: the Total, the e1RM, the streak, the balance. Every
 * report type below is an allowlist of inputs, and `tsc` fails if an output ever
 * appears on one (§5). Every output type below is either opaque or branded, and
 * `tsc` fails if a locally computed number is used as one (§3, §4).
 *
 * That is the whole design. The rest is mechanism.
 *
 * ===========================================================================
 * 2. WHY OPACITY FOR THE CONTAINER AND BRANDS FOR THE SCALARS
 * ===========================================================================
 *
 * The obvious construction — brand the state object, `ProgressionFacts & { [S]:
 * 'server' }` — DOES NOT WORK, and it is worth writing down why so nobody
 * "simplifies" this file back into it. Object spread preserves a symbol-keyed
 * brand, so:
 *
 *     const forged: ConfirmedFacts = { ...serverTruth, totalKg: 900 };
 *
 * typechecks. That is precisely the optimistic-update idiom, which means an
 * object brand fails at the one line it exists to stop. (`progression.test.ts`
 * pins this: it builds the same spread against the real `ProgressionSnapshot`
 * and shows the tamper is inert.)
 *
 * So server truth is carried by `ProgressionSnapshot`, whose single property
 * lives under a module-private `unique symbol` (the idiom `meet.ts` uses for its
 * loading rules). A caller cannot name the key, so a caller cannot build one,
 * and spreading one and adding fields produces an object whose extra fields no
 * reader ever looks at.
 *
 * Scalars are branded rather than opaque because a renderer has to be able to
 * print them and do arithmetic on them. `Confirmed<T>` is constrained to
 * `T extends number` on purpose — it must never be reached for as an object
 * brand, because of the hole above.
 *
 * ===========================================================================
 * 3. CONFIRMED vs. PROJECTED — THE STRUCTURAL DISTINCTION
 * ===========================================================================
 *
 * Two disjoint brands over `number`:
 *
 *   - `Confirmed<T>`  — came out of a server response. Minted in exactly one
 *     place in this file, inside `receiveProgressionSnapshot`. There is no
 *     exported mint. A plain `number` is not assignable to it.
 *   - `Projected<T>`  — computed locally, optimistically, for display.
 *     `projectedKg` and `projectedCount` are exported, because projecting is
 *     something the client is *supposed* to do.
 *
 * Neither is assignable to the other, and neither is assignable from `number`.
 * Both are assignable *to* `number`, so formatting and comparison still work.
 *
 * `ConfirmedTotalKg` is additionally a `dots.ts` `OfficialTotalKg`, which means a
 * confirmed total can be scored and a projected one cannot: `dotsScore` will not
 * take a `ProjectedKg`. A provisional number cannot reach a leaderboard.
 *
 * ===========================================================================
 * 4. THE CACHE IS A CACHE (CLAUDE.md "Client is a renderer")
 * ===========================================================================
 *
 * `ProgressionCache` has four states and every non-empty one carries the last
 * `ProgressionSnapshot` the server actually sent:
 *
 *   empty      — nothing has been read yet. There is no truth to render and no
 *                change that can be proposed against it.
 *   confirmed  — local state equals the last snapshot.
 *   pending    — a proposal is in flight. The snapshot is unchanged; the
 *                optimistic view sits *beside* it as a `ProgressionProjection`,
 *                never merged into it.
 *   stale      — the transport believes truth has moved on (reconnect, rejected
 *                proposal, revision from elsewhere). The snapshot is still the
 *                best known truth and is still rendered, flagged.
 *
 * The projection is never promoted. There is no `commitProjection`, and there
 * cannot be one: promoting would require minting a `ProgressionSnapshot`, and
 * the only mint takes a wire envelope. A server snapshot *replaces* the
 * projection; it is never merged with it.
 *
 * Reads for rendering go through `readTotalKg` and friends, which return a
 * discriminated `ProgressionReading`. A renderer therefore cannot show a
 * projected number without having handled the `'projected'` branch — the
 * provisionality is in the type, not in a convention about opacity or italics.
 *
 * ===========================================================================
 * 5. THE PAY-TO-WIN LINE, EXPRESSED IN THE TYPES (GDD §8.1, §12.3)
 * ===========================================================================
 *
 * `PROTECTED_CONCERNS` is the §8.1 list: Total, e1RM, meet results, training
 * pace. Four mechanisms keep purchases off it, all of them compile-time:
 *
 *  (a) THE CATALOGUE ALLOWLIST. `ENTITLEMENT_EFFECT_KINDS` is the complete list
 *      of things anything purchasable may do. `ENTITLEMENT_EFFECTS_ARE_EXACTLY_
 *      THE_ALLOWLIST` asserts the `EntitlementEffect` union is exactly that
 *      list, so adding an `'e1rm-boost'` variant fails `tsc` until it is written
 *      into the allowlist directly under this paragraph.
 *
 *  (b) THE REACH MAPS. `ProposalReach` and `EntitlementReach` declare which
 *      facts each proposal kind and each entitlement effect may move.
 *      `PURCHASES_CANNOT_REACH_PROTECTED_CONCERNS` and
 *      `ENTITLEMENTS_CANNOT_REACH_PROTECTED_CONCERNS` assert those reaches are
 *      disjoint from `PROTECTED_CONCERNS`. Widening either map to include
 *      `'bestE1rmKg'` fails at the assertion.
 *
 *      A disjointness assertion over an *empty* reach is vacuously true, which
 *      is exactly the kind of guard that cannot fail if the thing it names is
 *      deleted. So each is paired with a non-vacuity assertion
 *      (`..._REACH_IS_NOT_VACUOUS`) that fails if the reach collapses to
 *      `never`. Both halves are mutation-tested.
 *
 *      WHICH KINDS COUNT AS PURCHASES IS DERIVED, NOT LISTED. The reach check is
 *      only worth what its subject is worth, and its subject used to be a
 *      hand-written union of two kind names — correct for the kinds on it, blind
 *      to every kind added later. `PROPOSAL_ORIGIN_BY_KIND` now tags every
 *      proposal kind `'earned'` or `'purchase'` (exhaustively — a new kind
 *      cannot skip it), `PurchasableProposalKind` is computed from that map, and
 *      `MONEY_ON_THE_WIRE_IS_DECLARED_A_PURCHASE` cross-checks the tag against
 *      the report's own field names via `PURCHASE_EVIDENCE_KEYS`, so a kind
 *      whose payload carries a SKU, a receipt or a currency cannot be tagged
 *      `'earned'` to slip past. A new purchase-originated kind is checked
 *      against `PROTECTED_CONCERNS` whether or not its author read this file.
 *
 *  (c) NO EFFECT TO CLAIM. `RedeemEntitlementReport` carries a SKU and a
 *      receipt. It has no `effect` field and its key allowlist forbids one, so
 *      the client cannot tell the server what a purchase does — the server
 *      resolves the SKU against the catalogue. A client that cannot name an
 *      effect cannot name a forbidden one.
 *
 *  (d) NOTHING TO SELL. This module exports no multiplier, no bonus, no
 *      "training pace" figure and no function that takes an `Entitlement` and
 *      returns anything at all. `NOTHING_MOVES_TRAINING_PACE` asserts that no
 *      proposal kind — bought or earned — reaches training pace: one session per
 *      day is the loop, and there is no lever, priced or free.
 *
 * Recovery Days are the one purchasable thing with a functional effect (GDD
 * §4.2, §8.2), and `'streak'` is deliberately NOT protected here for that
 * reason. Their fence is `streak.ts`'s own allowlist, which this file couples to
 * rather than duplicates: `STREAK_WIRE_MATCHES_THE_STREAK_ALLOWLIST` asserts the
 * wire shape is exactly `STREAK_FACT_KEYS`, so a new streak field cannot slip
 * across this boundary without failing `tsc` here as well as there.
 *
 * The Recovery Day *balance* likewise lives only in `StreakState`. There is no
 * `recoveryDays` in `ConfirmedWallet`, on purpose: two ledgers for one
 * consumable is two truths, and the one in `streak.ts` is the one with the
 * guardrails on it.
 *
 * ===========================================================================
 * 6. WHAT THIS DOES NOT CLOSE — stated plainly, because a comment that
 *    overstates its guarantees is worse than no comment
 * ===========================================================================
 *
 *  - A CAST DEFEATS ALL OF IT. `x as ConfirmedTotalKg` compiles, exactly as a
 *    cast defeats `dots.ts`'s brands and `meet.ts`'s opaque rules. None of this
 *    is tamper resistance. It closes the writes that used to typecheck and look
 *    innocent in a diff.
 *
 *  - THE MINT HAS TO EXIST. `receiveProgressionSnapshot` turns plain JSON into
 *    server truth, and nothing in a type system can check that the JSON came
 *    off the wire rather than out of a literal. What the mint buys is that the
 *    claim is now a single greppable call whose name is the assertion, instead
 *    of an assignment anywhere in the app. Fixtures in tests go through it too,
 *    which is the point: there is one door.
 *
 *  - THERE IS NO SERVER, SO NOTHING IS VERIFIED. `record-meet-result` carries
 *    the judges' lights as *evidence*. With a real Edge Function the lights
 *    should be re-resolved server-side from the input trace, and this report
 *    type will get narrower, not wider. Today it is the client's word.
 *
 *  - A `ConfirmedFacts` VALUE CAN BE ASSEMBLED BY HAND, up to a point. Its
 *    scalars are branded, so a total or an e1RM still cannot be invented, but
 *    `streak` is a plain `StreakState` and object brands do not work (§2). It
 *    goes nowhere: no exported function in this module accepts a
 *    `ConfirmedFacts`, and the only route into the cache is a
 *    `ProgressionSnapshot`. Stated because it is exactly the sort of thing that
 *    looks closed and is not — `progression.test.ts` pins the export surface so
 *    a future function that accepts one has to be added deliberately.
 *
 *  - THE REACH MAPS ARE A DECLARATION, NOT AN ENFORCEMENT. No code here can
 *    stop an Edge Function that does not exist from touching a fact it should
 *    not. Their teeth are that widening one fails the compile, so the
 *    declaration a future function is written against cannot drift quietly.
 *
 *  - A PURCHASE THAT NAMES NO MONEY IS STILL A TAG. `PROPOSAL_ORIGIN_BY_KIND`
 *    forces every kind to declare a provenance, and the payload cross-check
 *    catches the obvious lie — a report with a `sku`, a `receipt` or a
 *    `currency` on it cannot be called `'earned'`. What it does not catch is a
 *    purchase-originated kind whose report names none of those: a
 *    `{ kind: 'redeem-promo-code'; report: { code: string } }` tagged `'earned'`
 *    would escape, because "money caused this" is a fact about the world and the
 *    only evidence in scope is the payload's field names. The residual is one
 *    deliberate mislabel in a diff whose surrounding comment says not to, rather
 *    than the previous residual, which was any addition at all, silently.
 *    Widening `PURCHASE_EVIDENCE_KEYS` is how that net gets tighter.
 *
 *  - THIS MODULE CONSTRAINS ITSELF. It cannot stop a consumer reading a
 *    confirmed e1RM and multiplying it by a cosmetic's price. That would be the
 *    consumer's violation and no type here can see it.
 */

import type { OfficialTotalKg } from './dots';
import type { LiftKind } from './meet';
import { LIFT_ORDER } from './meet';
import type { LocalWallClock, StreakDay, StreakFactKey, StreakState } from './streak';
import { asStreakDay } from './streak';

// ---------------------------------------------------------------------------
// Policy constants. Every knob this module has, in one block, per CLAUDE.md
// "Game Feel Values Must Be Tunable". None of these are feel values — there is
// no animation here — but they are the numbers a human would reach for when the
// sync behaviour is wrong, and they must not be buried in the transitions.
// ---------------------------------------------------------------------------

export const PROGRESSION_CACHE_POLICY = {
  /**
   * How many proposals may be in flight at once. One keeps the state machine
   * honest: a second optimistic projection layered on an unconfirmed first is a
   * local fiction two deep, and unwinding it when the first is rejected is
   * where sync bugs live. Raising this means `pending` has to hold a queue.
   */
  MAX_IN_FLIGHT_PROPOSALS: 1,
  /**
   * Whether a change may be proposed while the cache is `stale`. False: a
   * projection computed against truth we already believe is out of date is
   * worse than a spinner. Flip it if playtesting shows the offline path needs
   * it — the transition is written to read this, not to hard-code it.
   */
  ACCEPT_PROPOSALS_WHILE_STALE: false,
  /**
   * Whether a snapshot carrying the revision we already hold is accepted as a
   * refresh. True: a re-fetch that lands unchanged is normal, and treating it
   * as an error would make retries noisy. A LOWER revision is always refused.
   */
  ACCEPT_REPEATED_REVISION: true,
  /** The revision a freshly created account starts at. */
  FIRST_REVISION: 0,
} as const;

// ---------------------------------------------------------------------------
// Type-level helpers. These carry the boundary; they emit no code.
// ---------------------------------------------------------------------------

/**
 * `true` when `keyof T` is EXACTLY `Keys` — neither a field missing from the
 * allowlist nor a stale allowlist entry. Tuple-wrapped so the unions do not
 * distribute. Same shape as `streak.ts`'s, deliberately: this file adds a
 * fourth idiom to the codebase only where it has to, and key-exactness already
 * has one.
 */
type KeysAreExactly<T, Keys extends string> = [Exclude<keyof T, Keys>] extends [never]
  ? [Exclude<Keys, keyof T>] extends [never]
    ? true
    : never
  : never;

/** `true` when the two unions are the same set. */
type UnionIsExactly<A, B> = [Exclude<A, B>] extends [never]
  ? [Exclude<B, A>] extends [never]
    ? true
    : never
  : never;

/** `true` when `A` is a subset of `B`. */
type IsSubsetOf<A, B> = [Exclude<A, B>] extends [never] ? true : never;

/** `true` when the two unions share no member. Vacuously true for `never`. */
type AreDisjoint<A, B> = [Extract<A, B>] extends [never] ? true : never;

/**
 * `true` when the union has at least one member. Pairs with `AreDisjoint` so a
 * disjointness assertion cannot pass by having nothing left to compare — the
 * failure mode where a guard survives the deletion of the thing it guards.
 */
type IsNonEmptyUnion<A> = [A] extends [never] ? never : true;

// ---------------------------------------------------------------------------
// Marks: confirmed, and projected
// ---------------------------------------------------------------------------

/** Type-level only. Declared, never defined; emits no code. */
declare const SERVER_CONFIRMED: unique symbol;
/** Type-level only. Declared, never defined; emits no code. */
declare const CLIENT_PROJECTED: unique symbol;

/**
 * A number the server sent. Nominal: a plain `number` is not assignable to it,
 * so a locally computed total, e1RM or balance cannot be stored, compared
 * against a qualifying threshold, or scored.
 *
 * CONSTRAINED TO `number` ON PURPOSE. Branding an object is not a boundary —
 * see §2 of the header — and the constraint stops a future edit from reaching
 * for `Confirmed<SomeObject>` and getting a guarantee that is not there.
 *
 * Minted in exactly one place: `receiveProgressionSnapshot`. There is no
 * exported mint, which is the difference between this brand and `dots.ts`'s
 * `officialTotalKg`.
 */
export type Confirmed<T extends number> = T & { readonly [SERVER_CONFIRMED]: 'server-confirmed' };

/**
 * A number the client worked out itself, for optimistic display. Disjoint from
 * `Confirmed`, so it cannot be stored as truth, and — because it is not an
 * `OfficialTotalKg` — cannot be scored by `dots.ts` either.
 */
export type Projected<T extends number> = T & { readonly [CLIENT_PROJECTED]: 'client-projected' };

/** A server-confirmed weight in kilograms. */
export type ConfirmedKg = Confirmed<number>;
/** A server-confirmed whole count: streak days, currency balances. */
export type ConfirmedCount = Confirmed<number>;
/**
 * A server-confirmed competition total. Also a `dots.ts` `OfficialTotalKg`, so
 * it can go straight into `dotsScore` — and a projected total cannot.
 */
export type ConfirmedTotalKg = Confirmed<OfficialTotalKg>;

/** A locally projected weight in kilograms. Provisional. */
export type ProjectedKg = Projected<number>;
/** A locally projected whole count. Provisional. */
export type ProjectedCount = Projected<number>;

/**
 * Wraps a locally computed weight as a projection.
 *
 * @throws {RangeError} if it is not a finite, positive number.
 */
export function projectedKg(value: number): ProjectedKg {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`progression: a projected weight must be finite and positive, received ${value}`);
  }
  return value as ProjectedKg;
}

/**
 * Wraps a locally computed count as a projection.
 *
 * @throws {RangeError} if it is not a safe non-negative integer.
 */
export function projectedCount(value: number): ProjectedCount {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`progression: a projected count must be a non-negative whole number, received ${value}`);
  }
  return value as ProjectedCount;
}

/**
 * The single confirming mint. MODULE-PRIVATE and not exported: every confirmed
 * number in the app traces back through here, and the only caller is the
 * decoder below.
 */
function confirm<T extends number>(value: T): Confirmed<T> {
  return value as Confirmed<T>;
}

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

declare const MEET_ID_BRAND: unique symbol;
declare const PROPOSAL_ID_BRAND: unique symbol;
declare const REVISION_BRAND: unique symbol;

/** Server-assigned identity of a meet. */
export type MeetId = string & { readonly [MEET_ID_BRAND]: 'meet-id' };
/**
 * Client-assigned identity of one proposal, so a response can be matched to the
 * request that caused it. Client-minted deliberately: an id is not truth, it is
 * an idempotency key.
 */
export type ProposalId = string & { readonly [PROPOSAL_ID_BRAND]: 'proposal-id' };
/**
 * The server's version counter for a lifter's progression row. Monotonic. The
 * cache refuses to move backwards over it.
 */
export type ServerRevision = number & { readonly [REVISION_BRAND]: 'server-revision' };

/** @throws {RangeError} on an empty or blank id. */
export function asMeetId(value: string): MeetId {
  if (value.trim().length === 0) {
    throw new RangeError('progression: a meet id must not be blank');
  }
  return value as MeetId;
}

/** @throws {RangeError} on an empty or blank id. */
export function asProposalId(value: string): ProposalId {
  if (value.trim().length === 0) {
    throw new RangeError('progression: a proposal id must not be blank');
  }
  return value as ProposalId;
}

/** @throws {RangeError} unless it is a safe non-negative integer. */
export function asServerRevision(value: number): ServerRevision {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`progression: a server revision must be a non-negative whole number, received ${value}`);
  }
  return value as ServerRevision;
}

// ---------------------------------------------------------------------------
// The facts, and the allowlist that fences them in
// ---------------------------------------------------------------------------

/**
 * THE COMPLETE SET OF FIELDS SERVER-OWNED PROGRESSION MAY HAVE.
 *
 * Same mechanism as `STREAK_FACT_KEYS` in `streak.ts`, one level up: adding a
 * field to `ConfirmedFacts` fails `tsc` until it is added here, under this
 * comment, where the §8.1 question ("can this be bought?") gets asked out loud.
 *
 * Exported as a runtime array so a critic can compare it against a live object's
 * keys without reading a line of logic. `progression.test.ts` does exactly that.
 */
export const PROGRESSION_FACT_KEYS = ['totalKg', 'bestE1rmKg', 'streak', 'meets', 'wallet'] as const;

export type ProgressionFactKey = (typeof PROGRESSION_FACT_KEYS)[number];

/**
 * The §8.1 / §12.3 line, as a set: nothing purchasable may affect Total, e1RM,
 * training pace, or meet performance.
 *
 * `'streak'` and `'wallet'` are deliberately absent. Recovery Days are
 * purchasable and do move a streak (GDD §4.2, §8.2), and buying Chalk moves a
 * balance by definition. Fencing those is `streak.ts`'s job and it does it; the
 * line this module holds is the one about *performance*.
 *
 * `'trainingPace'` is not a stored fact — it is the rate at which sessions
 * count, which nothing here stores because nothing may change it. It is in this
 * list so `NOTHING_MOVES_TRAINING_PACE` has something to assert against.
 */
export const PROTECTED_CONCERNS = ['totalKg', 'bestE1rmKg', 'meets', 'trainingPace'] as const;

export type ProtectedConcern = (typeof PROTECTED_CONCERNS)[number];

/**
 * Every protected concern except training pace must be a real fact key. Renaming
 * `totalKg` to `total` without updating `PROTECTED_CONCERNS` would leave the
 * protection pointing at nothing; this fails `tsc` instead.
 */
export const PROTECTED_CONCERNS_NAME_REAL_FACTS: IsSubsetOf<
  Exclude<ProtectedConcern, 'trainingPace'>,
  ProgressionFactKey
> = true;

/** The currencies a wallet holds (GDD §8.2). */
export const WALLET_CURRENCIES = ['gymBucks', 'chalk'] as const;

export type WalletCurrency = (typeof WALLET_CURRENCIES)[number];

/**
 * Balances, server-confirmed.
 *
 * RECOVERY DAYS ARE NOT HERE. Their ledger is `StreakState.recoveryDayBalance`
 * and duplicating it would create a second truth for one consumable — the one
 * with the hold cap and the consecutive-use limit on it is the real one.
 */
export type ConfirmedWallet = Readonly<Record<WalletCurrency, ConfirmedCount>>;

/**
 * One meet on the record.
 *
 * `totalKg` is `null` for a bomb-out and that is NOT a total of zero — the same
 * distinction `meet.ts` and `dots.ts` hold. A lifter who bombed does not place;
 * they do not place *last*.
 */
export interface ConfirmedMeetResult {
  readonly meetId: MeetId;
  /** Civil-day index of the meet, as the server resolved it. */
  readonly meetDayIndex: number;
  /** The official total, or `null` for a bomb-out. */
  readonly totalKg: ConfirmedTotalKg | null;
  /** Best good lift per lift; `null` where a lift was bombed. */
  readonly bestByLift: Readonly<Record<LiftKind, ConfirmedKg | null>>;
  /** Bodyweight at weigh-in, in kg. Needed to score DOTS off a stored result. */
  readonly bodyweightKg: number;
}

export const CONFIRMED_MEET_RESULT_KEYS = [
  'meetId',
  'meetDayIndex',
  'totalKg',
  'bestByLift',
  'bodyweightKg',
] as const;

export type ConfirmedMeetResultKey = (typeof CONFIRMED_MEET_RESULT_KEYS)[number];

export const MEET_RESULT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  ConfirmedMeetResult,
  ConfirmedMeetResultKey
> = true;

/**
 * Everything the server owns about one lifter's progression, as read out of a
 * snapshot. Deeply frozen; every scalar is branded `Confirmed`.
 */
export interface ConfirmedFacts {
  /** Best competition total on record, or `null` before the first meet. */
  readonly totalKg: ConfirmedTotalKg | null;
  /** Best e1RM per lift, or `null` where the lift has never been trained. */
  readonly bestE1rmKg: Readonly<Record<LiftKind, ConfirmedKg | null>>;
  /** The streak system's state, owned and fenced by `streak.ts`. */
  readonly streak: StreakState;
  /** Meets on the record, oldest first. */
  readonly meets: readonly ConfirmedMeetResult[];
  /** Currency balances. Recovery Days are in `streak`, not here. */
  readonly wallet: ConfirmedWallet;
}

/**
 * COMPILE-TIME ASSERTION, not documentation. Add `e1rmMultiplier` (or anything
 * else, under any name) to `ConfirmedFacts` and `tsc --noEmit` fails here until
 * `PROGRESSION_FACT_KEYS` is widened.
 */
export const PROGRESSION_FACTS_ARE_EXACTLY_THE_ALLOWLIST: KeysAreExactly<
  ConfirmedFacts,
  ProgressionFactKey
> = true;

// ---------------------------------------------------------------------------
// The catalogue: what anything purchasable is allowed to do (GDD §8.1, §8.3)
// ---------------------------------------------------------------------------

/**
 * THE COMPLETE SET OF THINGS A PURCHASE MAY DO. Adding a kind here is the edit
 * that has to be argued for; `ENTITLEMENT_EFFECTS_ARE_EXACTLY_THE_ALLOWLIST`
 * makes it impossible to add one to the union without adding it here.
 */
export const ENTITLEMENT_EFFECT_KINDS = ['cosmetic', 'convenience', 'currency', 'recovery-day'] as const;

export type EntitlementEffectKind = (typeof ENTITLEMENT_EFFECT_KINDS)[number];

/** Cosmetic slots from GDD §8.3A. Pure flavour, zero stat impact. */
export const COSMETIC_SLOTS = [
  'singlet',
  'chalk-vfx',
  'bar-skin',
  'plate-skin',
  'gym-decor',
  'lifter-appearance',
  'coach-voice-pack',
  'meet-entrance',
] as const;

export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];

/**
 * Convenience grants from GDD §8.3B.
 *
 * THERE IS NO SIM-SESSION SKIP AND THERE MUST NEVER BE ONE: "Never speed up
 * Sim-mode training progression. That is the credibility line." Gym Empire build
 * timers are idle-layer scaffolding and are fair game; a training session is
 * not.
 */
export const CONVENIENCE_GRANTS = ['gym-empire-timer-skip', 'extra-save-slot'] as const;

export type ConvenienceGrant = (typeof CONVENIENCE_GRANTS)[number];

/** What one purchasable thing does. */
export type EntitlementEffect =
  | { readonly kind: 'cosmetic'; readonly slot: CosmeticSlot }
  | { readonly kind: 'convenience'; readonly grant: ConvenienceGrant }
  | { readonly kind: 'currency'; readonly currency: WalletCurrency; readonly amount: number }
  /** GDD §4.2 / §8.2 — the one functional purchase, fenced by `streak.ts`. */
  | { readonly kind: 'recovery-day'; readonly count: number };

/**
 * COMPILE-TIME ASSERTION. Adding an `{ kind: 'e1rm-boost' }` variant to
 * `EntitlementEffect` fails here until `'e1rm-boost'` is written into
 * `ENTITLEMENT_EFFECT_KINDS` above — a visible edit in a file whose header
 * explains why it must not happen.
 */
export const ENTITLEMENT_EFFECTS_ARE_EXACTLY_THE_ALLOWLIST: UnionIsExactly<
  EntitlementEffect['kind'],
  EntitlementEffectKind
> = true;

/** A catalogue entry: a SKU and what it grants. */
export interface Entitlement {
  readonly sku: string;
  readonly effect: EntitlementEffect;
}

/**
 * Which progression facts each entitlement effect may move. `never` means "no
 * progression fact at all" — a singlet changes nothing the server owns here.
 */
export interface EntitlementReach {
  readonly cosmetic: never;
  readonly convenience: never;
  readonly currency: 'wallet';
  readonly 'recovery-day': 'streak';
}

/** The union of everything any purchase can reach. */
export type AnyEntitlementReach = EntitlementReach[EntitlementEffectKind];

/**
 * COMPILE-TIME ASSERTION (GDD §8.1, §12.3): nothing purchasable touches Total,
 * e1RM, meet results or training pace.
 */
export const ENTITLEMENTS_CANNOT_REACH_PROTECTED_CONCERNS: AreDisjoint<
  AnyEntitlementReach,
  ProtectedConcern
> = true;

/**
 * The other half of the guard above. A disjointness assertion over an empty
 * union passes for free, so this fails if `EntitlementReach` is ever emptied —
 * which is how a check stops being able to fail without anyone noticing.
 */
export const ENTITLEMENT_REACH_IS_NOT_VACUOUS: IsNonEmptyUnion<AnyEntitlementReach> = true;

// ---------------------------------------------------------------------------
// Proposals: what the client may ask for. Inputs only.
// ---------------------------------------------------------------------------

export const PROGRESSION_PROPOSAL_KINDS = [
  'record-training-session',
  'accept-recovery-day',
  'record-meet-result',
  'redeem-entitlement',
  'spend-currency',
] as const;

export type ProgressionProposalKind = (typeof PROGRESSION_PROPOSAL_KINDS)[number];

/**
 * One set as it was actually performed. INPUTS ONLY: there is no `e1rmKg` here
 * and the key allowlist below forbids one. The server derives e1RM from these
 * four numbers with `e1rm.ts`, which is the only way two parts of the app can
 * be guaranteed to report the same number for the same set.
 *
 * The client may of course *estimate* the same set locally and show it — that is
 * what `ProgressionProjection` is for. What it may not do is send the answer.
 */
export interface TrainingSetReport {
  readonly lift: LiftKind;
  readonly weightKg: number;
  readonly reps: number;
  readonly rpe: number;
}

export const TRAINING_SET_REPORT_KEYS = ['lift', 'weightKg', 'reps', 'rpe'] as const;

export const TRAINING_SET_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  TrainingSetReport,
  (typeof TRAINING_SET_REPORT_KEYS)[number]
> = true;

/**
 * One attempt as the judges called it.
 *
 * See §6 of the header: with a real Edge Function the lights should be
 * re-resolved server-side and this type gets narrower. It is the client's word
 * today because there is nobody else to ask.
 */
export interface MeetAttemptReport {
  readonly lift: LiftKind;
  readonly attemptNumber: 1 | 2 | 3;
  readonly weightKg: number;
  readonly good: boolean;
}

export const MEET_ATTEMPT_REPORT_KEYS = ['lift', 'attemptNumber', 'weightKg', 'good'] as const;

export const MEET_ATTEMPT_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  MeetAttemptReport,
  (typeof MEET_ATTEMPT_REPORT_KEYS)[number]
> = true;

/**
 * A finished daily session.
 *
 * `deviceWallClock` is a HINT, not an authority. GDD §4.1: "'Local' is an
 * account property the server resolves, not the device's current timezone —
 * otherwise a player flying east loses a day and a player who changes their
 * phone clock manufactures one." The server resolves which streak day this is;
 * this field exists so it can notice drift, not so it can be trusted.
 */
export interface TrainingSessionReport {
  readonly deviceWallClock: LocalWallClock;
  readonly sets: readonly TrainingSetReport[];
}

export const TRAINING_SESSION_REPORT_KEYS = ['deviceWallClock', 'sets'] as const;

export const TRAINING_SESSION_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  TrainingSessionReport,
  (typeof TRAINING_SESSION_REPORT_KEYS)[number]
> = true;

/**
 * The player answered "yes" to a Recovery Day offer (GDD §4.2, manual use).
 *
 * `offeredDaysSeen` is the offer the CLIENT rendered, sent so the server can
 * re-derive the offer from its own state and refuse a mismatch — the
 * `OFFER_DOES_NOT_MATCH_STATE` idiom `streak.ts` already uses locally. It is not
 * an instruction to spend that many.
 */
export interface AcceptRecoveryDayReport {
  readonly deviceWallClock: LocalWallClock;
  readonly offeredDaysSeen: number;
}

export const ACCEPT_RECOVERY_DAY_REPORT_KEYS = ['deviceWallClock', 'offeredDaysSeen'] as const;

export const ACCEPT_RECOVERY_DAY_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  AcceptRecoveryDayReport,
  (typeof ACCEPT_RECOVERY_DAY_REPORT_KEYS)[number]
> = true;

/**
 * A finished meet. INPUTS ONLY: the attempts and the bodyweight. There is no
 * `totalKg` and the allowlist forbids one — GDD §6.4's "total = sum of best
 * successful attempt per lift" is a server computation, and a client that could
 * send a total could send any total.
 */
export interface MeetResultReport {
  readonly meetId: MeetId;
  readonly bodyweightKg: number;
  readonly attempts: readonly MeetAttemptReport[];
}

export const MEET_RESULT_REPORT_KEYS = ['meetId', 'bodyweightKg', 'attempts'] as const;

export const MEET_RESULT_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  MeetResultReport,
  (typeof MEET_RESULT_REPORT_KEYS)[number]
> = true;

/**
 * A purchase to credit.
 *
 * NO `effect` FIELD, and the allowlist forbids one — see (c) in §5 of the
 * header. The server resolves the SKU against its own catalogue. A client that
 * cannot name an effect cannot name a forbidden one.
 */
export interface RedeemEntitlementReport {
  readonly sku: string;
  /** Store receipt, verified server-side. Opaque to this module. */
  readonly receipt: string;
}

export const REDEEM_ENTITLEMENT_REPORT_KEYS = ['sku', 'receipt'] as const;

export const REDEEM_ENTITLEMENT_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  RedeemEntitlementReport,
  (typeof REDEEM_ENTITLEMENT_REPORT_KEYS)[number]
> = true;

/** Spending soft or premium currency. */
export interface SpendCurrencyReport {
  readonly currency: WalletCurrency;
  readonly amount: number;
  /** What it is being spent on. A SKU, resolved server-side. */
  readonly sku: string;
}

export const SPEND_CURRENCY_REPORT_KEYS = ['currency', 'amount', 'sku'] as const;

export const SPEND_CURRENCY_REPORT_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  SpendCurrencyReport,
  (typeof SPEND_CURRENCY_REPORT_KEYS)[number]
> = true;

/** Everything the client may ask the server to change. */
export type ProgressionProposal =
  | { readonly kind: 'record-training-session'; readonly report: TrainingSessionReport }
  | { readonly kind: 'accept-recovery-day'; readonly report: AcceptRecoveryDayReport }
  | { readonly kind: 'record-meet-result'; readonly report: MeetResultReport }
  | { readonly kind: 'redeem-entitlement'; readonly report: RedeemEntitlementReport }
  | { readonly kind: 'spend-currency'; readonly report: SpendCurrencyReport };

export const PROPOSAL_KINDS_ARE_EXACTLY_THE_ALLOWLIST: UnionIsExactly<
  ProgressionProposal['kind'],
  ProgressionProposalKind
> = true;

/**
 * WHICH FACTS THE SERVER MAY MOVE IN RESPONSE TO EACH PROPOSAL.
 *
 * A declaration, not an enforcement — see §6 of the header. Its teeth are the
 * assertions below it and the runtime table `factsMovedBy`, which is typed
 * against it: the table cannot list a fact the map does not allow, and widening
 * the map to allow one fails the disjointness assertion.
 */
export interface ProposalReach {
  readonly 'record-training-session': 'bestE1rmKg' | 'streak' | 'wallet' | 'totalKg';
  readonly 'accept-recovery-day': 'streak';
  readonly 'record-meet-result': 'totalKg' | 'meets' | 'bestE1rmKg' | 'wallet';
  readonly 'redeem-entitlement': 'wallet' | 'streak';
  readonly 'spend-currency': 'wallet' | 'streak';
}

export const PROPOSAL_REACH_COVERS_EVERY_KIND: KeysAreExactly<
  ProposalReach,
  ProgressionProposalKind
> = true;

// ---------------------------------------------------------------------------
// Provenance: which proposals money can originate (GDD §8.1, §12.3)
//
// THIS USED TO BE A HAND-WRITTEN LIST — `type PurchasableProposalKind =
// 'redeem-entitlement' | 'spend-currency'` — and that is the bug this block
// exists to close. A list is correct for the kinds someone remembered to write
// on it and blind to every kind added afterwards: a `'buy-total-boost'` proposal
// reaching `'totalKg'` compiled cleanly and passed the whole suite, because
// neither the assertion nor the test derived its subject from anything. It was
// verified to escape before this was written, not assumed to.
//
// So provenance is now DECLARED PER KIND and the purchasable set is DERIVED.
// Adding a proposal kind forces an origin for it (the map is exhaustive over
// `ProgressionProposalKind`); declaring that origin `'purchase'` puts the kind
// into `PurchasableProposalKind` automatically, and its reach is checked from
// then on whether or not anyone remembered this file existed.
// ---------------------------------------------------------------------------

/** Where a proposal comes from. `'purchase'` means money — real or in-app. */
export const PROPOSAL_ORIGIN_KINDS = ['earned', 'purchase'] as const;

export type ProposalOrigin = (typeof PROPOSAL_ORIGIN_KINDS)[number];

/**
 * THE ORIGIN OF EVERY PROPOSAL KIND. The one place provenance is written down.
 *
 * Exhaustive by construction: `satisfies Readonly<Record<ProgressionProposalKind,
 * ProposalOrigin>>` rejects a missing kind and an unknown one, and
 * `PROPOSAL_ORIGIN_COVERS_EVERY_KIND` pins the same thing again in case a future
 * edit drops the `satisfies`. `as const` is load-bearing: without it the values
 * widen to `ProposalOrigin` and the derivation below collapses to `never`, which
 * `PURCHASABLE_KINDS_ARE_NOT_VACUOUS` catches.
 *
 * ANSWER THE §8.1 QUESTION HERE. A new kind is `'earned'` only if no money — not
 * a store purchase, not a currency spend — can be what causes the client to send
 * it. If money can, it is `'purchase'`, and its row in `ProposalReach` above must
 * then stay clear of `PROTECTED_CONCERNS` or the compile fails.
 */
export const PROPOSAL_ORIGIN_BY_KIND = {
  'record-training-session': 'earned',
  'accept-recovery-day': 'earned',
  'record-meet-result': 'earned',
  'redeem-entitlement': 'purchase',
  'spend-currency': 'purchase',
} as const satisfies Readonly<Record<ProgressionProposalKind, ProposalOrigin>>;

export const PROPOSAL_ORIGIN_COVERS_EVERY_KIND: KeysAreExactly<
  typeof PROPOSAL_ORIGIN_BY_KIND,
  ProgressionProposalKind
> = true;

/**
 * The proposal kinds a purchase can originate — DERIVED from the map above, not
 * listed. There is no edit that adds a purchase-originated kind and leaves this
 * union behind, because this union is not a thing anyone can forget to edit.
 */
export type PurchasableProposalKind = {
  [K in ProgressionProposalKind]: (typeof PROPOSAL_ORIGIN_BY_KIND)[K] extends 'purchase' ? K : never;
}[ProgressionProposalKind];

/**
 * The same set, at runtime, for the tests and for any renderer that wants to
 * badge a purchase. Derived by walking `PROGRESSION_PROPOSAL_KINDS` and reading
 * the same map the type reads, so it is total over the kinds by construction.
 *
 * WHAT THE PREDICATE DOES AND DOES NOT PROVE: `tsc` cannot check a type
 * predicate's body against the conditional type it mirrors, so a *deliberately
 * wrong* predicate here would drift from `PurchasableProposalKind`. What it
 * cannot do is miss a new kind — it iterates the allowlist — and
 * `progression.test.ts` cross-checks the array against the map directly, so the
 * drift a compiler cannot see is the one a test does.
 */
function isPurchaseOriginated(kind: ProgressionProposalKind): kind is PurchasableProposalKind {
  return PROPOSAL_ORIGIN_BY_KIND[kind] === 'purchase';
}

export const PURCHASABLE_PROPOSAL_KINDS: readonly PurchasableProposalKind[] =
  PROGRESSION_PROPOSAL_KINDS.filter(isPurchaseOriginated);

/**
 * The other half of the derivation: a tag can be got wrong on purpose, so the
 * shape of the payload gets a vote too.
 *
 * These are the field names that mean a transaction. A report carrying one of
 * them is money on the wire — you cannot buy a thing without naming the thing
 * (`sku`), and you cannot pay for it without a store receipt or a currency. No
 * earned report carries any of them, and `progression.test.ts` checks both
 * directions of that against the real report allowlists.
 */
export const PURCHASE_EVIDENCE_KEYS = ['sku', 'receipt', 'currency'] as const;

type PurchaseEvidenceKey = (typeof PURCHASE_EVIDENCE_KEYS)[number];

type ReportFor<K extends ProgressionProposalKind> = Extract<ProgressionProposal, { readonly kind: K }>['report'];

/** The kinds whose report names money, read off the report types themselves. */
export type MoneyCarryingProposalKind = {
  [K in ProgressionProposalKind]: [Extract<keyof ReportFor<K>, PurchaseEvidenceKey>] extends [never] ? never : K;
}[ProgressionProposalKind];

/**
 * COMPILE-TIME ASSERTION: anything that carries money on the wire is declared a
 * purchase. This is what stops the origin map from being a formality. Tagging a
 * `{ kind: 'buy-total-boost'; report: { sku; receipt } }` as `'earned'` to duck
 * the reach check fails here instead, and the failure names the kind.
 *
 * It is a floor, not a decision procedure — see §6 of the header for the case it
 * does not see.
 */
export const MONEY_ON_THE_WIRE_IS_DECLARED_A_PURCHASE: IsSubsetOf<
  MoneyCarryingProposalKind,
  PurchasableProposalKind
> = true;

/**
 * The non-vacuity half of the assertion above: a subset assertion over an empty
 * set passes for free, so this fails if `PURCHASE_EVIDENCE_KEYS` is ever emptied,
 * renamed past the reports, or the report types stop naming money.
 */
export const MONEY_CARRYING_KINDS_ARE_NOT_VACUOUS: IsNonEmptyUnion<MoneyCarryingProposalKind> = true;

/** Everything any purchase-originated proposal may move. */
export type AnyPurchaseReach = ProposalReach[PurchasableProposalKind];

/**
 * COMPILE-TIME ASSERTION (GDD §8.1, §12.3). Add `'bestE1rmKg'` to
 * `'redeem-entitlement'` above and this line stops compiling — and so does
 * adding a NEW `'purchase'`-origin kind whose reach names a protected concern,
 * which is the part a hand-written union of kinds could not do.
 */
export const PURCHASES_CANNOT_REACH_PROTECTED_CONCERNS: AreDisjoint<
  AnyPurchaseReach,
  ProtectedConcern
> = true;

/** The non-vacuity half. See `ENTITLEMENT_REACH_IS_NOT_VACUOUS`. */
export const PURCHASE_REACH_IS_NOT_VACUOUS: IsNonEmptyUnion<AnyPurchaseReach> = true;

/**
 * And the non-vacuity half one level up, because the reach is now derived from a
 * derived set. If the origin map's values widen, or the conditional above is
 * mistyped, `PurchasableProposalKind` silently becomes `never` and every check
 * built on it passes over nothing. This fails instead.
 */
export const PURCHASABLE_KINDS_ARE_NOT_VACUOUS: IsNonEmptyUnion<PurchasableProposalKind> = true;

/**
 * COMPILE-TIME ASSERTION: nothing at all reaches training pace — not a purchase,
 * not a session, not a meet. GDD §8.1 protects "Sim training pace", and the way
 * this codebase protects it is by having no lever, priced or free. One session
 * per day is the loop.
 */
export const NOTHING_MOVES_TRAINING_PACE: AreDisjoint<
  ProposalReach[ProgressionProposalKind],
  'trainingPace'
> = true;

/**
 * Which facts a proposal of this kind may move. Typed against `ProposalReach`,
 * so this table cannot name a fact the map does not permit.
 */
const PROPOSAL_REACH_TABLE: { readonly [K in ProgressionProposalKind]: readonly ProposalReach[K][] } = {
  'record-training-session': ['bestE1rmKg', 'streak', 'wallet', 'totalKg'],
  'accept-recovery-day': ['streak'],
  'record-meet-result': ['totalKg', 'meets', 'bestE1rmKg', 'wallet'],
  'redeem-entitlement': ['wallet', 'streak'],
  'spend-currency': ['wallet', 'streak'],
};

/** The facts a proposal of this kind is declared to move. */
export function factsMovedBy<K extends ProgressionProposalKind>(kind: K): readonly ProposalReach[K][] {
  return PROPOSAL_REACH_TABLE[kind];
}

// ---------------------------------------------------------------------------
// Errors and results
// ---------------------------------------------------------------------------

export type ProgressionErrorCode =
  /** The wire payload was malformed: wrong shape, bad number, impossible value. */
  | 'INVALID_SNAPSHOT'
  /** A snapshot older than the one already held. Out-of-order response. */
  | 'SNAPSHOT_BEHIND'
  /** Nothing has been read from the server yet; there is no truth to change. */
  | 'NO_CONFIRMED_TRUTH'
  /** `PROGRESSION_CACHE_POLICY.MAX_IN_FLIGHT_PROPOSALS` would be exceeded. */
  | 'PROPOSAL_ALREADY_IN_FLIGHT'
  /** No proposal in flight, or a different one, so there is nothing to resolve. */
  | 'NO_MATCHING_PROPOSAL'
  /** The cache is stale and `ACCEPT_PROPOSALS_WHILE_STALE` is off. */
  | 'CACHE_IS_STALE'
  /** The optimistic projection was malformed. */
  | 'INVALID_PROJECTION'
  /** The proposal's own payload was malformed. */
  | 'INVALID_PROPOSAL';

export interface ProgressionError {
  readonly code: ProgressionErrorCode;
  /** Plain language. Developer-facing; leaks no internals. */
  readonly message: string;
}

export type ProgressionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ProgressionError };

function ok<T>(value: T): ProgressionResult<T> {
  return { ok: true, value };
}

function fail<T>(code: ProgressionErrorCode, message: string): ProgressionResult<T> {
  return { ok: false, error: { code, message } };
}

// ---------------------------------------------------------------------------
// The wire: the decoded JSON body of an Edge Function response
// ---------------------------------------------------------------------------

/**
 * `StreakState` as plain JSON.
 *
 * `STREAK_WIRE_MATCHES_THE_STREAK_ALLOWLIST` asserts these keys are exactly
 * `streak.ts`'s own `STREAK_FACT_KEYS`, so a new streak field cannot cross this
 * boundary without failing `tsc` here as well as passing the allowlist there.
 * That coupling is deliberate: two allowlists that agree are one boundary, and
 * two that drift are none.
 */
export interface StreakStateWire {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly lastTrainedDay: number | null;
  readonly recoveredThroughDay: number | null;
  readonly consecutiveRecoveryDaysUsed: number;
  readonly recoveryDayBalance: number;
  readonly hasResolvedFirstBreakOffer: boolean;
}

export const STREAK_WIRE_MATCHES_THE_STREAK_ALLOWLIST: KeysAreExactly<
  StreakStateWire,
  StreakFactKey
> = true;

/** One stored meet result, as plain JSON. */
export interface MeetResultWire {
  readonly meetId: string;
  readonly meetDayIndex: number;
  readonly totalKg: number | null;
  readonly bestByLift: Readonly<Record<LiftKind, number | null>>;
  readonly bodyweightKg: number;
}

/**
 * The decoded body of a progression response.
 *
 * Plain numbers, because that is what JSON is. Turning them into `Confirmed`
 * ones is what `receiveProgressionSnapshot` is for, and it is the only place in
 * the codebase where that happens.
 */
export interface ProgressionSnapshotWire {
  readonly revision: number;
  readonly totalKg: number | null;
  readonly bestE1rmKg: Readonly<Record<LiftKind, number | null>>;
  readonly streak: StreakStateWire;
  readonly meets: readonly MeetResultWire[];
  readonly wallet: Readonly<Record<WalletCurrency, number>>;
  /**
   * The proposal this response settles, if any. `null` for a plain read or for
   * a change that originated elsewhere (another device, a scheduled job).
   */
  readonly acknowledgedProposalId: string | null;
}

// ---------------------------------------------------------------------------
// Server truth: opaque, and mintable in exactly one place
// ---------------------------------------------------------------------------

/**
 * The key the snapshot's contents actually live under. Module-private and a
 * symbol, so `ProgressionSnapshot` has no property a caller can name, spread
 * over, or overwrite.
 */
const SNAPSHOT_CONTENTS: unique symbol = Symbol('progression.snapshot');

interface SnapshotContents {
  readonly revision: ServerRevision;
  readonly facts: ConfirmedFacts;
  readonly acknowledgedProposalId: ProposalId | null;
}

/**
 * SERVER TRUTH. Opaque: exactly one property, under a key this module does not
 * export, so the only way to obtain one without a cast is `receiveProgression
 * Snapshot`. Read it with `snapshotFacts`, `snapshotRevision` and
 * `snapshotAcknowledges`.
 *
 * Why opaque rather than branded: see §2 of the header. A branded object can be
 * spread-and-overridden back into itself, which is the exact shape of an
 * optimistic update.
 */
export interface ProgressionSnapshot {
  readonly [SNAPSHOT_CONTENTS]: SnapshotContents;
}

/**
 * Recursively freezes a value this module just built. Walks symbol keys as well
 * as string ones — the snapshot's whole payload lives under a symbol, so a
 * string-only walk would freeze the shell and leave the facts writable.
 *
 * Freezing is not a side effect in the sense CLAUDE.md forbids: it touches only
 * objects this function's caller just constructed, never an input.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const keys: readonly (string | symbol)[] = [
    ...Object.getOwnPropertyNames(value),
    ...Object.getOwnPropertySymbols(value),
  ];
  for (const key of keys) {
    deepFreeze((value as Record<string | symbol, unknown>)[key]);
  }
  return Object.freeze(value);
}

function contents(snapshot: ProgressionSnapshot): SnapshotContents {
  return snapshot[SNAPSHOT_CONTENTS];
}

/** The revision this snapshot carries. */
export function snapshotRevision(snapshot: ProgressionSnapshot): ServerRevision {
  return contents(snapshot).revision;
}

/**
 * The facts. Deeply frozen at mint, so the object handed back cannot be edited
 * through — the reason `meet.ts` copies its rules on the way out, achieved once
 * instead of on every read.
 */
export function snapshotFacts(snapshot: ProgressionSnapshot): ConfirmedFacts {
  return contents(snapshot).facts;
}

/** Whether this snapshot settles the given proposal. */
export function snapshotAcknowledges(snapshot: ProgressionSnapshot, proposalId: ProposalId): boolean {
  return contents(snapshot).acknowledgedProposalId === proposalId;
}

function isFiniteWeight(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function decodeStreak(wire: StreakStateWire): ProgressionResult<StreakState> {
  const counts: readonly [string, number][] = [
    ['currentStreak', wire.currentStreak],
    ['longestStreak', wire.longestStreak],
    ['consecutiveRecoveryDaysUsed', wire.consecutiveRecoveryDaysUsed],
    ['recoveryDayBalance', wire.recoveryDayBalance],
  ];
  for (const [name, value] of counts) {
    if (!isCount(value)) {
      return fail('INVALID_SNAPSHOT', `progression: streak.${name} must be a non-negative whole number`);
    }
  }
  if (wire.longestStreak < wire.currentStreak) {
    return fail('INVALID_SNAPSHOT', 'progression: streak.longestStreak cannot be below streak.currentStreak');
  }
  if (typeof wire.hasResolvedFirstBreakOffer !== 'boolean') {
    return fail('INVALID_SNAPSHOT', 'progression: streak.hasResolvedFirstBreakOffer must be a boolean');
  }
  const days: readonly [string, number | null][] = [
    ['lastTrainedDay', wire.lastTrainedDay],
    ['recoveredThroughDay', wire.recoveredThroughDay],
  ];
  for (const [name, value] of days) {
    if (value !== null && !Number.isSafeInteger(value)) {
      return fail('INVALID_SNAPSHOT', `progression: streak.${name} must be a whole day index or null`);
    }
  }
  const lastTrainedDay: StreakDay | null = wire.lastTrainedDay === null ? null : asStreakDay(wire.lastTrainedDay);
  const recoveredThroughDay: StreakDay | null =
    wire.recoveredThroughDay === null ? null : asStreakDay(wire.recoveredThroughDay);
  return ok({
    currentStreak: wire.currentStreak,
    longestStreak: wire.longestStreak,
    lastTrainedDay,
    recoveredThroughDay,
    consecutiveRecoveryDaysUsed: wire.consecutiveRecoveryDaysUsed,
    recoveryDayBalance: wire.recoveryDayBalance,
    hasResolvedFirstBreakOffer: wire.hasResolvedFirstBreakOffer,
  });
}

function decodeBestByLift(
  wire: Readonly<Record<LiftKind, number | null>>,
  where: string,
): ProgressionResult<Readonly<Record<LiftKind, ConfirmedKg | null>>> {
  const out: Partial<Record<LiftKind, ConfirmedKg | null>> = {};
  for (const lift of LIFT_ORDER) {
    const value = wire[lift];
    if (value === null) {
      out[lift] = null;
      continue;
    }
    if (!isFiniteWeight(value)) {
      return fail('INVALID_SNAPSHOT', `progression: ${where}.${lift} must be a positive number or null`);
    }
    out[lift] = confirm(value);
  }
  return ok(out as Record<LiftKind, ConfirmedKg | null>);
}

function decodeMeet(wire: MeetResultWire, index: number): ProgressionResult<ConfirmedMeetResult> {
  if (wire.meetId.trim().length === 0) {
    return fail('INVALID_SNAPSHOT', `progression: meets[${index}].meetId must not be blank`);
  }
  if (!Number.isSafeInteger(wire.meetDayIndex)) {
    return fail('INVALID_SNAPSHOT', `progression: meets[${index}].meetDayIndex must be a whole day index`);
  }
  if (!isFiniteWeight(wire.bodyweightKg)) {
    return fail('INVALID_SNAPSHOT', `progression: meets[${index}].bodyweightKg must be a positive number`);
  }
  if (wire.totalKg !== null && !isFiniteWeight(wire.totalKg)) {
    return fail(
      'INVALID_SNAPSHOT',
      `progression: meets[${index}].totalKg must be a positive number or null — a bomb-out is null, not zero`,
    );
  }
  const bests = decodeBestByLift(wire.bestByLift, `meets[${index}].bestByLift`);
  if (!bests.ok) {
    return bests;
  }
  return ok({
    meetId: asMeetId(wire.meetId),
    meetDayIndex: wire.meetDayIndex,
    totalKg: wire.totalKg === null ? null : (confirm(wire.totalKg) as ConfirmedTotalKg),
    bestByLift: bests.value,
    bodyweightKg: wire.bodyweightKg,
  });
}

/**
 * THE ONE DOOR. Turns a decoded Edge Function response into server truth.
 *
 * This is the only place in the codebase that mints a `Confirmed` number or a
 * `ProgressionSnapshot`. Nothing else can, and that is enforced by the private
 * symbol rather than by convention. Test fixtures go through it too — one door
 * means one door.
 *
 * WHAT IT CANNOT CHECK, per §6 of the header: that the JSON came off a wire.
 * Nothing in a type system can. What it buys is that the claim is a single
 * greppable call whose name is the assertion.
 */
export function receiveProgressionSnapshot(
  wire: ProgressionSnapshotWire,
): ProgressionResult<ProgressionSnapshot> {
  if (!Number.isSafeInteger(wire.revision) || wire.revision < 0) {
    return fail('INVALID_SNAPSHOT', `progression: revision must be a non-negative whole number, received ${wire.revision}`);
  }
  if (wire.totalKg !== null && !isFiniteWeight(wire.totalKg)) {
    return fail('INVALID_SNAPSHOT', 'progression: totalKg must be a positive number or null');
  }
  const bests = decodeBestByLift(wire.bestE1rmKg, 'bestE1rmKg');
  if (!bests.ok) {
    return bests;
  }
  const streak = decodeStreak(wire.streak);
  if (!streak.ok) {
    return streak;
  }
  const meets: ConfirmedMeetResult[] = [];
  for (let index = 0; index < wire.meets.length; index += 1) {
    const meetWire = wire.meets[index];
    if (meetWire === undefined) {
      return fail('INVALID_SNAPSHOT', `progression: meets[${index}] is missing`);
    }
    const decoded = decodeMeet(meetWire, index);
    if (!decoded.ok) {
      return decoded;
    }
    meets.push(decoded.value);
  }
  const wallet: Partial<Record<WalletCurrency, ConfirmedCount>> = {};
  for (const currency of WALLET_CURRENCIES) {
    const balance = wire.wallet[currency];
    if (!isCount(balance)) {
      return fail('INVALID_SNAPSHOT', `progression: wallet.${currency} must be a non-negative whole number`);
    }
    wallet[currency] = confirm(balance);
  }
  if (wire.acknowledgedProposalId !== null && wire.acknowledgedProposalId.trim().length === 0) {
    return fail('INVALID_SNAPSHOT', 'progression: acknowledgedProposalId must be a non-blank id or null');
  }

  const facts: ConfirmedFacts = {
    totalKg: wire.totalKg === null ? null : (confirm(wire.totalKg) as ConfirmedTotalKg),
    bestE1rmKg: bests.value,
    streak: streak.value,
    meets,
    wallet: wallet as ConfirmedWallet,
  };
  const snapshot: ProgressionSnapshot = {
    [SNAPSHOT_CONTENTS]: {
      revision: asServerRevision(wire.revision),
      facts,
      acknowledgedProposalId:
        wire.acknowledgedProposalId === null ? null : asProposalId(wire.acknowledgedProposalId),
    },
  };
  return ok(deepFreeze(snapshot));
}

// ---------------------------------------------------------------------------
// Projections: the optimistic view, kept beside truth and never merged into it
// ---------------------------------------------------------------------------

/** A locally projected streak. Not a `StreakState` and not assignable to one. */
export interface ProjectedStreak {
  readonly currentStreak: ProjectedCount;
}

/**
 * What the client believes a proposal will do, for optimistic display.
 *
 * Every field is nullable, and `null` means "no local projection — render the
 * confirmed value". There is deliberately no `meets` field: a meet result is
 * never optimistic. `PROJECTION_ONLY_MIRRORS_REAL_FACTS` keeps these keys a
 * subset of `PROGRESSION_FACT_KEYS`, so a projection cannot invent a fact the
 * server does not have.
 */
export interface ProgressionProjection {
  readonly totalKg: ProjectedKg | null;
  readonly bestE1rmKg: Readonly<Record<LiftKind, ProjectedKg | null>>;
  readonly streak: ProjectedStreak | null;
  readonly wallet: Readonly<Record<WalletCurrency, ProjectedCount | null>>;
}

export const PROJECTION_KEYS = ['totalKg', 'bestE1rmKg', 'streak', 'wallet'] as const;

export type ProjectionKey = (typeof PROJECTION_KEYS)[number];

export const PROJECTION_IS_EXACTLY_ITS_ALLOWLIST: KeysAreExactly<
  ProgressionProjection,
  ProjectionKey
> = true;

export const PROJECTION_ONLY_MIRRORS_REAL_FACTS: IsSubsetOf<ProjectionKey, ProgressionFactKey> = true;

/** A projection that claims nothing. The base every projection is built from. */
export function emptyProjection(): ProgressionProjection {
  return {
    totalKg: null,
    bestE1rmKg: { squat: null, bench: null, deadlift: null },
    streak: null,
    wallet: { gymBucks: null, chalk: null },
  };
}

function validateProjection(projection: ProgressionProjection): ProgressionError | null {
  if (projection.totalKg !== null && !isFiniteWeight(projection.totalKg)) {
    return { code: 'INVALID_PROJECTION', message: 'progression: a projected total must be finite and positive' };
  }
  for (const lift of LIFT_ORDER) {
    const value = projection.bestE1rmKg[lift];
    if (value !== null && !isFiniteWeight(value)) {
      return {
        code: 'INVALID_PROJECTION',
        message: `progression: a projected e1RM must be finite and positive (${lift})`,
      };
    }
  }
  if (projection.streak !== null && !isCount(projection.streak.currentStreak)) {
    return { code: 'INVALID_PROJECTION', message: 'progression: a projected streak must be a whole day count' };
  }
  for (const currency of WALLET_CURRENCIES) {
    const value = projection.wallet[currency];
    if (value !== null && !isCount(value)) {
      return {
        code: 'INVALID_PROJECTION',
        message: `progression: a projected balance must be a whole number (${currency})`,
      };
    }
  }
  return null;
}

function validateProposal(proposal: ProgressionProposal): ProgressionError | null {
  switch (proposal.kind) {
    case 'record-training-session': {
      if (proposal.report.sets.length === 0) {
        return { code: 'INVALID_PROPOSAL', message: 'progression: a training session must report at least one set' };
      }
      for (const set of proposal.report.sets) {
        if (!isFiniteWeight(set.weightKg)) {
          return { code: 'INVALID_PROPOSAL', message: 'progression: a reported set weight must be finite and positive' };
        }
        if (!Number.isSafeInteger(set.reps) || set.reps < 1) {
          return { code: 'INVALID_PROPOSAL', message: 'progression: a reported set must have at least one rep' };
        }
        if (!Number.isFinite(set.rpe)) {
          return { code: 'INVALID_PROPOSAL', message: 'progression: a reported RPE must be a finite number' };
        }
      }
      return null;
    }
    case 'accept-recovery-day': {
      if (!Number.isSafeInteger(proposal.report.offeredDaysSeen) || proposal.report.offeredDaysSeen < 1) {
        return { code: 'INVALID_PROPOSAL', message: 'progression: an accepted offer must cover at least one day' };
      }
      return null;
    }
    case 'record-meet-result': {
      if (proposal.report.attempts.length === 0) {
        return { code: 'INVALID_PROPOSAL', message: 'progression: a meet result must report at least one attempt' };
      }
      if (!isFiniteWeight(proposal.report.bodyweightKg)) {
        return { code: 'INVALID_PROPOSAL', message: 'progression: a reported bodyweight must be finite and positive' };
      }
      for (const attempt of proposal.report.attempts) {
        if (!isFiniteWeight(attempt.weightKg)) {
          return { code: 'INVALID_PROPOSAL', message: 'progression: a reported attempt weight must be finite and positive' };
        }
      }
      return null;
    }
    case 'redeem-entitlement': {
      if (proposal.report.sku.trim().length === 0 || proposal.report.receipt.trim().length === 0) {
        return { code: 'INVALID_PROPOSAL', message: 'progression: a redemption needs a SKU and a receipt' };
      }
      return null;
    }
    case 'spend-currency': {
      if (!Number.isSafeInteger(proposal.report.amount) || proposal.report.amount < 1) {
        return { code: 'INVALID_PROPOSAL', message: 'progression: a spend must be at least one unit' };
      }
      if (proposal.report.sku.trim().length === 0) {
        return { code: 'INVALID_PROPOSAL', message: 'progression: a spend needs a SKU' };
      }
      return null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// The cache
// ---------------------------------------------------------------------------

/** Why the cache stopped trusting itself. Never computed from a clock. */
export type StaleReason =
  /** The transport reconnected; anything could have happened while it was down. */
  | 'reconnected'
  /** A proposal came back rejected; the projection was discarded. */
  | 'proposal-rejected'
  /** The server reported a revision we have not fetched. */
  | 'server-revision-ahead'
  /** The same account is live on another device. */
  | 'signed-in-elsewhere';

/** One proposal, in flight, with the optimistic view it justifies. */
export interface InFlightProposal {
  readonly proposalId: ProposalId;
  readonly proposal: ProgressionProposal;
  readonly projection: ProgressionProjection;
}

/**
 * Local state, as a cache of server truth.
 *
 * Every non-empty branch carries the snapshot. The projection in `pending` sits
 * beside it, never inside it, so there is no state in which the optimistic
 * number IS the truth — that shape is not expressible.
 */
export type ProgressionCache =
  /** Nothing read yet. Render a loading state; propose nothing. */
  | { readonly status: 'empty' }
  /** Local state equals the last snapshot. */
  | { readonly status: 'confirmed'; readonly snapshot: ProgressionSnapshot }
  /** A proposal is in flight. `snapshot` is still truth. */
  | { readonly status: 'pending'; readonly snapshot: ProgressionSnapshot; readonly inFlight: InFlightProposal }
  /** Truth may have moved on. `snapshot` is still the best we know. */
  | { readonly status: 'stale'; readonly snapshot: ProgressionSnapshot; readonly reason: StaleReason };

/** A cache that has never been filled. */
export function emptyProgressionCache(): ProgressionCache {
  return { status: 'empty' };
}

/** The snapshot behind a cache, or `null` before the first read. */
export function cachedSnapshot(cache: ProgressionCache): ProgressionSnapshot | null {
  return cache.status === 'empty' ? null : cache.snapshot;
}

/** The proposal in flight, or `null`. */
export function inFlightProposal(cache: ProgressionCache): InFlightProposal | null {
  return cache.status === 'pending' ? cache.inFlight : null;
}

/**
 * Applies a snapshot the server sent.
 *
 * The snapshot REPLACES truth; it is never merged with a projection. If a
 * proposal is in flight and this snapshot acknowledges it, the projection is
 * discarded and the cache is confirmed. If it does not acknowledge it — the
 * server moved for some other reason, another device, a scheduled grant — the
 * proposal stays in flight on the new base, which is the honest reading: our
 * request has still not come back.
 *
 * A snapshot older than the one held is refused outright, so an out-of-order
 * response cannot walk progression backwards.
 */
export function applyServerSnapshot(
  cache: ProgressionCache,
  snapshot: ProgressionSnapshot,
): ProgressionResult<ProgressionCache> {
  const current = cachedSnapshot(cache);
  if (current !== null) {
    const held = snapshotRevision(current);
    const incoming = snapshotRevision(snapshot);
    if (incoming < held) {
      return fail(
        'SNAPSHOT_BEHIND',
        `progression: refusing a snapshot at revision ${incoming} while holding ${held}`,
      );
    }
    if (incoming === held && !PROGRESSION_CACHE_POLICY.ACCEPT_REPEATED_REVISION) {
      return fail('SNAPSHOT_BEHIND', `progression: revision ${incoming} is already held`);
    }
  }
  if (cache.status === 'pending' && !snapshotAcknowledges(snapshot, cache.inFlight.proposalId)) {
    return ok({ status: 'pending', snapshot, inFlight: cache.inFlight });
  }
  return ok({ status: 'confirmed', snapshot });
}

/**
 * Records that the client has asked the server for a change, and what it
 * believes will happen while it waits.
 *
 * This is NOT a write. It changes no fact: the snapshot is carried through
 * untouched and the projection is parked beside it. There is no transition in
 * this module that turns a projection into a snapshot.
 */
export function proposeChange(
  cache: ProgressionCache,
  proposalId: ProposalId,
  proposal: ProgressionProposal,
  projection: ProgressionProjection,
): ProgressionResult<ProgressionCache> {
  if (cache.status === 'empty') {
    return fail(
      'NO_CONFIRMED_TRUTH',
      'progression: nothing has been read from the server, so there is nothing to propose a change to',
    );
  }
  if (cache.status === 'pending') {
    return fail(
      'PROPOSAL_ALREADY_IN_FLIGHT',
      `progression: at most ${PROGRESSION_CACHE_POLICY.MAX_IN_FLIGHT_PROPOSALS} proposal may be in flight`,
    );
  }
  if (cache.status === 'stale' && !PROGRESSION_CACHE_POLICY.ACCEPT_PROPOSALS_WHILE_STALE) {
    return fail('CACHE_IS_STALE', 'progression: refresh before proposing a change against stale truth');
  }
  const badProposal = validateProposal(proposal);
  if (badProposal !== null) {
    return { ok: false, error: badProposal };
  }
  const badProjection = validateProjection(projection);
  if (badProjection !== null) {
    return { ok: false, error: badProjection };
  }
  return ok({
    status: 'pending',
    snapshot: cache.snapshot,
    inFlight: { proposalId, proposal, projection },
  });
}

/**
 * The server refused, or the request failed. The projection is discarded whole —
 * never partially kept — and the cache goes stale, because a rejection means our
 * picture of truth is now in question.
 */
export function rejectProposal(
  cache: ProgressionCache,
  proposalId: ProposalId,
): ProgressionResult<ProgressionCache> {
  if (cache.status !== 'pending' || cache.inFlight.proposalId !== proposalId) {
    return fail('NO_MATCHING_PROPOSAL', `progression: no proposal ${proposalId} is in flight`);
  }
  return ok({ status: 'stale', snapshot: cache.snapshot, reason: 'proposal-rejected' });
}

/**
 * The transport says our truth may be behind. Total function: a cache that has
 * never been filled has nothing to go stale.
 */
export function markCacheStale(cache: ProgressionCache, reason: StaleReason): ProgressionCache {
  if (cache.status === 'empty') {
    return cache;
  }
  return { status: 'stale', snapshot: cache.snapshot, reason };
}

// ---------------------------------------------------------------------------
// Reading, for rendering
// ---------------------------------------------------------------------------

/**
 * A value on its way to a screen, carrying how much it can be trusted.
 *
 * A renderer cannot get at the number without narrowing, so it cannot show a
 * projected total as a final one by accident — the provisionality is in the
 * type rather than in a convention about styling it differently.
 */
export type ProgressionReading<C, P> =
  /** Nothing read from the server yet. */
  | { readonly kind: 'unknown' }
  /** Server truth, current. */
  | { readonly kind: 'confirmed'; readonly value: C }
  /** Server truth, possibly behind. Still the best known value. */
  | { readonly kind: 'stale'; readonly value: C; readonly reason: StaleReason }
  /** A local projection, with the truth it was projected from. */
  | { readonly kind: 'projected'; readonly value: P; readonly lastConfirmed: C };

function read<C, P>(
  cache: ProgressionCache,
  fromFacts: (facts: ConfirmedFacts) => C,
  fromProjection: (projection: ProgressionProjection) => P | null,
): ProgressionReading<C, P> {
  if (cache.status === 'empty') {
    return { kind: 'unknown' };
  }
  const confirmed = fromFacts(snapshotFacts(cache.snapshot));
  if (cache.status === 'stale') {
    return { kind: 'stale', value: confirmed, reason: cache.reason };
  }
  if (cache.status === 'pending') {
    const projected = fromProjection(cache.inFlight.projection);
    if (projected !== null) {
      return { kind: 'projected', value: projected, lastConfirmed: confirmed };
    }
  }
  return { kind: 'confirmed', value: confirmed };
}

/** The lifter's best competition total. `null` means no meet has produced one. */
export function readTotalKg(cache: ProgressionCache): ProgressionReading<ConfirmedTotalKg | null, ProjectedKg> {
  return read(
    cache,
    (facts) => facts.totalKg,
    (projection) => projection.totalKg,
  );
}

/** Best e1RM for one lift. */
export function readBestE1rmKg(
  cache: ProgressionCache,
  lift: LiftKind,
): ProgressionReading<ConfirmedKg | null, ProjectedKg> {
  return read(
    cache,
    (facts) => facts.bestE1rmKg[lift],
    (projection) => projection.bestE1rmKg[lift],
  );
}

/** Trained days in the live run. */
export function readStreakDays(cache: ProgressionCache): ProgressionReading<number, ProjectedCount> {
  return read(
    cache,
    (facts) => facts.streak.currentStreak,
    (projection) => (projection.streak === null ? null : projection.streak.currentStreak),
  );
}

/** One currency balance. */
export function readBalance(
  cache: ProgressionCache,
  currency: WalletCurrency,
): ProgressionReading<ConfirmedCount, ProjectedCount> {
  return read(
    cache,
    (facts) => facts.wallet[currency],
    (projection) => projection.wallet[currency],
  );
}

/**
 * Meets on the record.
 *
 * The projected branch is `never` and therefore unconstructible: a meet result
 * is server truth or it is not shown. There is no optimistic placing.
 */
export function readMeets(cache: ProgressionCache): ProgressionReading<readonly ConfirmedMeetResult[], never> {
  return read<readonly ConfirmedMeetResult[], never>(
    cache,
    (facts) => facts.meets,
    () => null,
  );
}

/** The number behind a reading, whatever its provenance. For layout, not logic. */
export function readingValue<C, P>(reading: ProgressionReading<C, P>): C | P | null {
  switch (reading.kind) {
    case 'unknown':
      return null;
    case 'confirmed':
    case 'stale':
      return reading.value;
    case 'projected':
      return reading.value;
    default:
      return null;
  }
}

/** Whether a reading is current server truth. */
export function isConfirmedReading<C, P>(
  reading: ProgressionReading<C, P>,
): reading is { readonly kind: 'confirmed'; readonly value: C } {
  return reading.kind === 'confirmed';
}

// ---------------------------------------------------------------------------
// One consumer that demands server truth, so the brand has somewhere to bite
// ---------------------------------------------------------------------------

/**
 * Whether a lifter has the qualifying total for a meet (GDD §6.1: meets are
 * "gated by qualifying totals").
 *
 * Takes a `ConfirmedTotalKg` and nothing else. A projection, a locally summed
 * board total, or `finalMeetTotal(state) ?? 0` will not typecheck here — which
 * is the point: entry to nationals is not decided by a number the phone made up.
 */
export function meetsQualifyingTotal(total: ConfirmedTotalKg, requiredKg: number): boolean {
  if (!isFiniteWeight(requiredKg)) {
    throw new RangeError(`progression: a qualifying total must be finite and positive, received ${requiredKg}`);
  }
  return total >= requiredKg;
}
