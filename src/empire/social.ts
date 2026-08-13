/**
 * social.ts — GDD §5.5's three rows: gym leaderboards, friend visits, and the
 * weekly rival comparison.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock and no randomness. Every day this file reads
 * is a `CalendarDay` parameter and every rival, friend and board row is a
 * SUPPLIED SNAPSHOT — nothing here generates an opponent. Its only imports are
 * `./empireCore` and `./empireTuning`, so every number it uses is named in one
 * place and the directory-wide scans in `empireCore.test.ts` cover it.
 *
 * ===========================================================================
 * 1. The constraint that decides this piece: everything is keyed to the
 *    calendar, and nothing is keyed to what the player did
 * ===========================================================================
 *
 * `RIVAL_COMPARISON_PERIOD_DAYS` is classified `refusal` rather than `knob` in
 * `EMPIRE_TUNING_CLASSIFICATION`, and the refusal is about its UNIT. GDD §8.3C
 * records the measurement on the shipped streak engine at 100 days: a reward
 * keyed to session count gives 1156 violating pairs, worst deficit 54; keyed to
 * the streak, 54 pairs and 239 lifetime-best inversions; landed on a fixed
 * calendar day, 0. GDD §4.4 gives the reason — both members of a monotonicity
 * pair reach a calendar day on the same day whatever their training did, and a
 * quantity the player's own activity moves does not have that property.
 *
 * So the rule this file is built around, in lower case because it is a design
 * constraint rather than a capitalised claim: no reward day in this module may
 * be a function of sessions, streak length, unlocked tiers, or any other
 * quantity the player's activity moves. "Week 3 since signup" is safe. "Every
 * fifth check-in" is GDD §12.3's fifth refusal condition.
 *
 * Two things carry that, and the second is the one that matters:
 *
 *   - `SocialCalendarContext` carries the training-shaped fields — the trained
 *     days, the session count, the streak length, the unlocked pass tiers —
 *     THROUGH the API, and `socialRewardSchedule` reads none of them. Plumbing
 *     them through is deliberate: a future edit that keys a reward off one of
 *     them is then a change to a function whose output is swept, rather than a
 *     new parameter nobody measured. A context that carried only the anchor day
 *     would make the sweep below a check on a domain that cannot reach the
 *     case, which is the vacuity shape CLAUDE.md names.
 *   - `social.test.ts` measures it. For two histories identical except that one
 *     has an extra trained day, at every horizon in `SOCIAL_SWEEP`, the
 *     reward-day list is compared ELEMENT-WISE and pinned at zero divergences,
 *     with a negative control beside it — the same schedule keyed to session
 *     count — whose divergence count is pinned non-zero. GDD §8.2 records a
 *     builder whose aggregate-shaped check moved 2362 of 34338 purchase-day
 *     lists while every aggregate stayed identical, so an aggregate will not do
 *     and a zero with nothing beside it is an empty domain.
 *
 * What no type here gives you, said plainly rather than implied: `CalendarDay`
 * refuses a bare number, so `rivalPeriodIndex(anchor, sessionCount)` does not
 * compile — but `asCalendarDay(sessionCount)` does, and GDD §4.4 is explicit
 * that "a perfectly legal tender could acquire a training sensitivity without a
 * single type changing". The brand is the cheap half. The sweep is the half
 * that would catch it.
 *
 * ===========================================================================
 * 2. A leaderboard does not pay a stat, and the verdict is inherited
 * ===========================================================================
 *
 * GDD §8.1 and §12.3 refuse anything purchasable that affects Total, e1RM,
 * training pace or meet performance, and a social standing that paid one would
 * be that line crossed by a screen nobody thought of as monetised.
 *
 * `SOCIAL_OUTPUT` is this module's copy of the pattern `expansion.ts` uses for
 * `AXIS_OUTPUT`: every social surface declares the `EmpireOutput` it feeds, and
 * the reach comes from `empireCore.ts`'s `OUTPUT_SINK` / `SINK_REACH` tables
 * rather than from an opinion written here. Re-pointing the `'rival-week'` row
 * at `'training-iq'` is the single edit that would open it; it stops compiling
 * against `SocialSurfacesAreIdleOnly` and `socialVocabularyFaults` reports it at
 * runtime, so the two graders fail on the same edit.
 *
 * The rows, and why each is what it is:
 *
 *   - `'leaderboard-placement'` feeds `'cosmetic-unlock'`. GDD §5.5 gives the
 *     board no payout at all, and `rankLeaderboard` returns positions rather
 *     than currency. The row exists so the board carries a reach verdict rather
 *     than an exemption — GDD §8.3E's condition 3 rules out "true by the
 *     current absence of a code path", and §8.2's history is the argument: the
 *     old tender list kept achievement Chalk out by having no word for it.
 *   - `'friend-encouragement'` and `'rival-week'` feed `'gym-bucks'`, which
 *     `OUTPUT_SINK` sends to `'gym-economy'` and `SINK_REACH` calls
 *     `'idle-only'`. `empireTuning.ts` says why the rival payout in particular
 *     may not be denominated in Chalk: it is keyed to an outcome rather than to
 *     a date, so a Chalk payout here would be a player-moved arrival day for a
 *     GDD §8.3E covered day. Gym Bucks reach cosmetics, decor and the §5.4
 *     axes, and `empireCore.ts` makes Chalk a word the empire does not have.
 *
 * ===========================================================================
 * 3. No real identity, and no invented one either
 * ===========================================================================
 *
 * GDD §12.3 refuses a real, named athlete, brand, company, gym or federation in
 * any string, asset, config or code path. This piece is full of name-shaped
 * surfaces — rival gyms, friend gyms, leaderboard rows — and it holds no name
 * table of any kind. Every `displayName` and every `gymId` arrives on a
 * `GymSnapshot` supplied by the caller, and the vocabulary tokens below are
 * kebab nouns taken from GDD §5.5's own sentence. `empireCore.test.ts` pins
 * every space-free literal in this directory exactly and bans a
 * `Capitalised Capitalised` pair from every string, including the template
 * literals this module's fault messages are made of.
 *
 * ===========================================================================
 * 4. What this file deliberately does not do
 * ===========================================================================
 *
 *   - It does not write a wallet. `ENCOURAGEMENT_REWARD_GYM_BUCKS` and
 *     `RIVAL_REWARD_GYM_BUCKS` are RETURNED as amounts owed, not applied.
 *     Currency is server-authoritative (CLAUDE.md) and `src/game/progression.ts`
 *     is another session's file.
 *   - It does not fetch, poll or subscribe. GDD §5.5 says "no real-time infra
 *     needed" and this module takes that literally: a friend list, a board and
 *     a rival are three snapshots handed in.
 *   - It does not decide who the rival is. A matchmaker that picked one would
 *     need a selection over a population, which is the operation GDD §12.3's
 *     second refusal condition is about; the rival arrives already chosen, and
 *     `empireCore.test.ts` bans the language of chance from this whole
 *     directory.
 *   - It does not cap how many encouragements a gym may be paid for in a day
 *     beyond one per distinct sender. `EMPIRE_TUNING` has no such entry and
 *     this piece does not add one; it is named in this piece's report as a knob
 *     a designer may want.
 */

import {
  IDLE_ONLY_OUTPUTS,
  PROGRESSION_REACHING_OUTPUTS,
  asDisplayName,
  asFaultMessage,
  asGymBucks,
  asGymId,
  isEmpireOutput,
  outputReach,
  refuseWith,
  type DisplayName,
  type EmpireOutput,
  type FaultMessage,
  type GymBucks,
  type GymId,
  type LeaderboardScope,
  type OutputReach,
  type ReachOfOutput,
  type Unbranded,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// The calendar day
// ---------------------------------------------------------------------------

declare const SOCIAL_BRAND: unique symbol;

/**
 * A whole calendar day counted from account creation.
 *
 * Type-only: the symbol is `declare`d and erased, so a `CalendarDay` is a plain
 * number on the wire. One brand and no sibling, so there is nothing here for it
 * to be confused with — what it is for is the other direction. A session count,
 * a streak length and a pass tier are all bare `number`s, so
 * `rivalPeriodIndex(anchor, sessionCount)` does not typecheck, and §1 of the
 * header says what that is and is not worth.
 */
export type CalendarDay = number & { readonly [SOCIAL_BRAND]: 'calendar-day' };

/**
 * The one place a raw number becomes a day.
 *
 * `Unbranded<N>` is `empireCore.ts`'s house guard and it is here for the reason
 * that module gives: every brand in this codebase IS its primitive at the type
 * level, so a constructor taking a bare `number` accepts a clock reading. A day
 * index is not a seconds reading, and an `AcceleratedSeconds` reaching this
 * argument would be a purchase-moved quantity wearing a calendar's clothes.
 */
export function asCalendarDay<N extends number>(value: N & Unbranded<N>): CalendarDay {
  const raw: number = value;
  if (!Number.isInteger(raw) || raw < 0) {
    refuseWith(`a calendar day must be a whole number at or above zero, received ${raw}.`);
  }
  return raw as CalendarDay;
}

// ---------------------------------------------------------------------------
// Surfaces, outputs and reach
// ---------------------------------------------------------------------------

/**
 * GDD §5.5's three rows, as the things that can pay.
 *
 * A new entry costs a row in `SOCIAL_OUTPUT`, which is exhaustive by
 * `satisfies`, so a social surface with no declared destination does not
 * compile — the same shape `EMPIRE_OUTPUTS` and `AXIS_OUTPUT` use.
 */
export const SOCIAL_SURFACES = [
  /** §5.5 row 1. A position on a board, which pays no currency. */
  'leaderboard-placement',
  /** §5.5 row 2. The visited gym's owner is paid for an encouragement. */
  'friend-encouragement',
  /** §5.5 row 3. "Small reward for beating them." */
  'rival-week',
] as const;

export type SocialSurface = (typeof SOCIAL_SURFACES)[number];

/**
 * The `EmpireOutput` each social surface feeds, so a surface inherits a reach
 * verdict instead of carrying an opinion of its own. See §2 of the header.
 */
export const SOCIAL_OUTPUT = {
  'leaderboard-placement': 'cosmetic-unlock',
  'friend-encouragement': 'gym-bucks',
  'rival-week': 'gym-bucks',
} as const satisfies Readonly<Record<SocialSurface, EmpireOutput>>;

/** The output a surface feeds. */
export function socialOutput(surface: SocialSurface): EmpireOutput {
  return SOCIAL_OUTPUT[surface];
}

/** A surface's reach, looked up through `empireCore.ts`'s two tables. */
export function socialReach(surface: SocialSurface): OutputReach {
  return outputReach(socialOutput(surface));
}

/** `true` when two types are mutually assignable, `false` otherwise. */
type Same<X, Y> = [X] extends [Y] ? ([Y] extends [X] ? true : false) : false;

/**
 * Compile-time assertion that no social surface reaches Sim progression, and
 * that the reach set is the one word it is supposed to be.
 *
 * The `Extract` half alone is the tautology `empireCore.ts` records: with the
 * reach derived from the tables, an author could satisfy it by emptying the
 * social surface list. The membership line is what bites — re-pointing any row
 * at `'training-iq'` or `'physio-days-saved'` puts `'progression-reaching'`
 * into the union, `Same<...>` is `false`, and the declaration below stops
 * compiling.
 *
 * Graded by `tsc --noEmit` and by nothing vitest can redden: the value is the
 * literal `true`. `socialVocabularyFaults` is the runtime twin.
 */
export type SocialSurfacesAreIdleOnly = [
  Extract<{ [S in SocialSurface]: ReachOfOutput<(typeof SOCIAL_OUTPUT)[S]> }[SocialSurface], 'progression-reaching'>,
] extends [never]
  ? Same<
      { [S in SocialSurface]: ReachOfOutput<(typeof SOCIAL_OUTPUT)[S]> }[SocialSurface],
      'idle-only'
    > extends true
    ? true
    : never
  : never;

export const SOCIAL_LAYER_PAYS_NO_STAT: SocialSurfacesAreIdleOnly = true;

/** Narrows an unknown wire value to a social surface. */
export function isSocialSurface(value: unknown): value is SocialSurface {
  return (SOCIAL_SURFACES as readonly unknown[]).includes(value);
}

// ---------------------------------------------------------------------------
// The snapshot every row in this module is built out of
// ---------------------------------------------------------------------------

/**
 * One gym as it arrives from the server: a board row, a friend, or the rival.
 *
 * One shape for all three rather than three that drift. `reputation` and
 * `combinedTotalKg` are plain numbers rather than `ReputationPoints`, and that
 * is a decision rather than an oversight: the brands in this directory exist to
 * keep a purchase-moved clock reading out of a progression-reaching argument,
 * and a score reported about another player's gym is neither. Both are
 * validated by `socialContextFaults`.
 *
 * No name table ships here. `gymId` and `displayName` are the caller's — see §3
 * of the header.
 *
 * Both are branded, and the brand narrows nothing about WHICH gyms exist. What
 * it does is make `gymId: EMPIRE_FORBIDDEN_OUTPUTS[0]` a compile error at every
 * branch point at once, rather than at the branch points a sampling domain
 * happened to reach. `asGymId` and `asDisplayName` in `empireCore.ts` carry the
 * argument and the two limits.
 */
export interface GymSnapshot {
  readonly gymId: GymId;
  readonly displayName: DisplayName;
  readonly reputation: number;
  readonly combinedTotalKg: number;
}

// ---------------------------------------------------------------------------
// §5.5 row 1 — leaderboards
// ---------------------------------------------------------------------------

/**
 * The two things GDD §5.5 ranks by: "by reputation or combined lifter totals".
 *
 * Transcribed rather than invented. A third metric is a design change.
 */
export const LEADERBOARD_METRICS = ['reputation', 'combined-total'] as const;

export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];

/** Narrows an unknown wire value to a metric. */
export function isLeaderboardMetric(value: unknown): value is LeaderboardMetric {
  return (LEADERBOARD_METRICS as readonly unknown[]).includes(value);
}

/** How many gyms a bracket of this scope holds. */
export function leaderboardBracketSize(scope: LeaderboardScope): number {
  return EMPIRE_TUNING.LEADERBOARD_BRACKET_SIZE[scope];
}

/** The number a metric ranks a gym by. */
export function leaderboardScore(entry: GymSnapshot, metric: LeaderboardMetric): number {
  return metric === 'reputation' ? entry.reputation : entry.combinedTotalKg;
}

/** One placed gym. `rank` is 1-based; tied gyms share a rank. */
export interface LeaderboardRow {
  readonly entry: GymSnapshot;
  readonly score: number;
  readonly rank: number;
}

/**
 * The bracket, ranked, truncated to `LEADERBOARD_BRACKET_SIZE[scope]`.
 *
 * Total order and no tie-break left to the engine: highest score first, and
 * gyms on the same score ordered by `gymId` ascending. Sorting by score alone
 * would leave the order of a tie up to whatever `Array.prototype.sort` happens
 * to do with the input order, which makes two clients holding the same snapshot
 * disagree about who is 4th.
 *
 * Ranks are competition ranks — 1, 2, 2, 4 — computed before truncation is
 * applied to the rows, so a gym's rank does not change when the bracket size
 * does. The input array is copied rather than sorted in place, because a
 * caller's snapshot is not this function's to reorder.
 */
export function rankLeaderboard(
  entries: readonly GymSnapshot[],
  metric: LeaderboardMetric,
  scope: LeaderboardScope,
): readonly LeaderboardRow[] {
  const scored = entries.map((entry) => ({ entry, score: leaderboardScore(entry, metric) }));
  const ordered = [...scored].sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    if (left.entry.gymId < right.entry.gymId) return -1;
    if (left.entry.gymId > right.entry.gymId) return 1;
    return 0;
  });
  const ranked: LeaderboardRow[] = [];
  let rank = 0;
  let previousScore = Number.NaN;
  ordered.forEach((row, at) => {
    if (row.score !== previousScore) {
      rank = at + 1;
      previousScore = row.score;
    }
    ranked.push(Object.freeze({ entry: row.entry, score: row.score, rank }));
  });
  return Object.freeze(ranked.slice(0, Math.max(0, leaderboardBracketSize(scope))));
}

/** Where a gym sits on a ranked bracket, or `null` if it is not on it. */
export function leaderboardRankOf(
  rows: readonly LeaderboardRow[],
  gymId: GymId,
): number | null {
  for (const row of rows) {
    if (row.entry.gymId === gymId) return row.rank;
  }
  return null;
}

// ---------------------------------------------------------------------------
// §5.5 row 2 — visiting friends' gyms
// ---------------------------------------------------------------------------

/** One recorded visit. `encouraged` is §5.5's "leave encouragement". */
export interface FriendVisit {
  readonly day: CalendarDay;
  readonly gymId: GymId;
  readonly encouraged: boolean;
}

/**
 * One encouragement this gym received.
 *
 * `fromGymId` is branded for the same reason `FriendVisit.gymId` is, and it is
 * branded IN THE SAME COMMIT for a different one: CLAUDE.md's rule that when
 * you fix a check the next thing to look at is the branch immediately below it.
 * This interface is the one directly below `FriendVisit`, it holds the same
 * kind of value, and it was NOT in `DECLARED_BARE_STRING_FIELDS` — no export
 * returns an `Encouragement`, so the census never saw the field and a bypass
 * planted here would have been invisible to instrument A the moment a wiring
 * piece returned one.
 */
export interface Encouragement {
  readonly day: CalendarDay;
  readonly fromGymId: GymId;
}

/**
 * Why a visit was refused, in the order they are reported.
 *
 * The order is part of the published contract rather than an accident, the way
 * `RECRUITMENT_REFUSALS` is: a screen listing reasons reads them in this order.
 */
export const VISIT_REFUSALS = [
  /** The gym is not on the supplied friend list. */
  'not-a-friend-gym',
  /** A gym cannot visit itself. */
  'own-gym',
  /** Already visited this gym today. */
  'already-visited-today',
  /** `FRIEND_VISITS_PER_DAY` visits are already recorded on this day. */
  'daily-allowance-spent',
] as const;

export type VisitRefusal = (typeof VISIT_REFUSALS)[number];

/**
 * Everything the social layer reads about one player.
 *
 * `calendar` carries the training-shaped fields and no function in this module
 * reads them — see §1 of the header for why they are here anyway.
 */
export interface SocialContext {
  readonly ownGym: GymSnapshot;
  readonly calendar: SocialCalendarContext;
  readonly friends: readonly GymSnapshot[];
  readonly visits: readonly FriendVisit[];
  readonly encouragementsReceived: readonly Encouragement[];
  readonly rival: GymSnapshot | null;
}

/**
 * The player's own history, as the social layer is allowed to see it.
 *
 * `anchorDay` is account creation and is the only field anything here reads.
 * The other four are the quantities GDD §8.3C measured as unsafe to key a
 * reward to, carried through the API on purpose so that a future edit which
 * reads one is caught by the sweep in `social.test.ts` rather than shipping as
 * a parameter nobody measured.
 */
export interface SocialCalendarContext {
  /** Account creation. Anchors every period boundary. */
  readonly anchorDay: CalendarDay;
  /** The days the player trained. GDD §8.3C: 1156 violating pairs at 100 days. */
  readonly trainedDays: readonly CalendarDay[];
  /** Sessions completed. Same row as the line above. */
  readonly sessionCount: number;
  /** Current streak length. GDD §8.3C: 54 pairs, 239 lifetime-best inversions. */
  readonly streakDays: number;
  /** GDD §8.3C season-pass tiers. A tier every N sessions is an achievement. */
  readonly passTiersUnlocked: number;
}

/** How many visits are recorded on a day. */
export function visitsUsedOn(visits: readonly FriendVisit[], day: CalendarDay): number {
  let used = 0;
  for (const visit of visits) {
    if (visit.day === day) used += 1;
  }
  return used;
}

/**
 * How many visits a day has left.
 *
 * `FRIEND_VISITS_PER_DAY` per CALENDAR day, resetting at the day boundary and
 * carrying nothing over — the shape GDD §4.2 Option 1 uses for coverage and
 * §8.3C measured at zero violating pairs. A budget earned per check-in, or one
 * that accumulated while the player was away, would be the same allowance keyed
 * to the player's own activity.
 */
export function visitsLeftOn(visits: readonly FriendVisit[], day: CalendarDay): number {
  return Math.max(0, EMPIRE_TUNING.FRIEND_VISITS_PER_DAY - visitsUsedOn(visits, day));
}

/** Every reason this gym may not be visited today, in `VISIT_REFUSALS` order. */
export function visitRefusals(
  context: SocialContext,
  gymId: GymId,
  day: CalendarDay,
): readonly VisitRefusal[] {
  const refusals: VisitRefusal[] = [];
  const isFriend = context.friends.some((friend) => friend.gymId === gymId);
  if (!isFriend) refusals.push('not-a-friend-gym');
  if (gymId === context.ownGym.gymId) refusals.push('own-gym');
  if (context.visits.some((visit) => visit.day === day && visit.gymId === gymId)) {
    refusals.push('already-visited-today');
  }
  if (visitsLeftOn(context.visits, day) === 0) refusals.push('daily-allowance-spent');
  return Object.freeze(refusals);
}

/** Whether this gym may be visited today. */
export function mayVisitFriendGym(
  context: SocialContext,
  gymId: GymId,
  day: CalendarDay,
): boolean {
  return visitRefusals(context, gymId, day).length === 0;
}

/** The outcome of asking to visit. Refused or visited; there is no third arm. */
export type FriendVisitDecision =
  | { readonly kind: 'refused'; readonly refusals: readonly VisitRefusal[] }
  | {
      readonly kind: 'visited';
      readonly visits: readonly FriendVisit[];
      /** What the VISITED gym's owner is owed. Not written here — see §4. */
      readonly gymBucksOwedToVisitedGym: GymBucks;
    };

/**
 * Record a visit, optionally leaving an encouragement.
 *
 * Returns the visit log that results rather than mutating the one it was given.
 * The payout is what the visited gym's owner is owed, in Gym Bucks; the visitor
 * is paid nothing, so there is no self-directed loop for a player to farm.
 */
export function recordFriendVisit(
  context: SocialContext,
  gymId: GymId,
  day: CalendarDay,
  encourage: boolean,
): FriendVisitDecision {
  const refusals = visitRefusals(context, gymId, day);
  if (refusals.length > 0) return Object.freeze({ kind: 'refused', refusals });
  const visit: FriendVisit = Object.freeze({ day, gymId, encouraged: encourage });
  return Object.freeze({
    kind: 'visited',
    visits: Object.freeze([...context.visits, visit]),
    gymBucksOwedToVisitedGym: asGymBucks(
      encourage ? EMPIRE_TUNING.ENCOURAGEMENT_REWARD_GYM_BUCKS : 0,
    ),
  });
}

/**
 * What a gym is owed for the encouragements it received on a day.
 *
 * One payout per distinct sender per day. Two encouragements from the same
 * friend on the same day pay once, so a pair of players cannot trade taps for
 * an unbounded balance; there is no tuning entry for a per-day ceiling and this
 * piece does not invent one.
 */
export function encouragementGymBucksOn(
  received: readonly Encouragement[],
  day: CalendarDay,
): GymBucks {
  const senders = new Set<string>();
  for (const encouragement of received) {
    if (encouragement.day === day) senders.add(encouragement.fromGymId);
  }
  return asGymBucks(senders.size * EMPIRE_TUNING.ENCOURAGEMENT_REWARD_GYM_BUCKS);
}

// ---------------------------------------------------------------------------
// §5.5 row 3 — the weekly rival comparison
// ---------------------------------------------------------------------------

/** The rival period, in calendar days. Read once, so the unit has one home. */
function periodDays(): number {
  const days = EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS;
  if (!Number.isInteger(days) || days < 1) {
    refuseWith(
      `the rival comparison period must be a whole number of calendar days at or above one, received ${days}.`,
    );
  }
  return days;
}

/**
 * Which period a day falls in, counted from the anchor.
 *
 * Integer division of a day difference by a day count, and that is the whole
 * mechanism: two players who signed up on the same day are in the same period
 * on the same day, whatever either of them trained. Refuses a day before the
 * anchor rather than clamping, because a clamp would silently make period 0
 * longer than every other period.
 */
export function rivalPeriodIndex(anchorDay: CalendarDay, day: CalendarDay): number {
  if (day < anchorDay) {
    refuseWith(
      `day ${day} is before the anchor day ${anchorDay}, so it is in no comparison period.`,
    );
  }
  return Math.floor((day - anchorDay) / periodDays());
}

/** The first day of a period. */
export function rivalPeriodStartDay(anchorDay: CalendarDay, periodIndex: number): CalendarDay {
  if (!Number.isInteger(periodIndex) || periodIndex < 0) {
    refuseWith(`a period index must be a whole number at or above zero, received ${periodIndex}.`);
  }
  const raw: number = anchorDay + periodIndex * periodDays();
  return asCalendarDay(raw);
}

/**
 * The day a period closes and its reward, if any, lands.
 *
 * The day after the period's last day, which is the first day of the next one.
 * A close day is `anchorDay + (index + 1) * RIVAL_COMPARISON_PERIOD_DAYS` and
 * is therefore a fixed calendar day.
 */
export function rivalPeriodCloseDay(anchorDay: CalendarDay, periodIndex: number): CalendarDay {
  return rivalPeriodStartDay(anchorDay, periodIndex + 1);
}

/**
 * Every close day inside the first `horizonDays` days from the anchor.
 *
 * The list the monotonicity sweep compares element-wise.
 */
export function rivalPeriodCloseDays(
  anchorDay: CalendarDay,
  horizonDays: number,
): readonly CalendarDay[] {
  if (!Number.isInteger(horizonDays) || horizonDays < 0) {
    refuseWith(`a horizon must be a whole number of days at or above zero, received ${horizonDays}.`);
  }
  const days: CalendarDay[] = [];
  const period = periodDays();
  for (let offset = period; offset < horizonDays; offset += period) {
    days.push(asCalendarDay(anchorDay + offset));
  }
  return Object.freeze(days);
}

/** How a gym finished a period against its rival. */
export const RIVAL_OUTCOMES = ['ahead', 'level', 'behind'] as const;

export type RivalOutcome = (typeof RIVAL_OUTCOMES)[number];

/** One period's comparison, as a screen and a payout both read it. */
export interface RivalComparison {
  readonly periodIndex: number;
  readonly closesOnDay: CalendarDay;
  readonly metric: LeaderboardMetric;
  readonly ownScore: number;
  readonly rivalScore: number;
  readonly outcome: RivalOutcome;
  /** GDD §5.5's "small reward for beating them". Zero unless `'ahead'`. */
  readonly gymBucksOwed: GymBucks;
}

/**
 * Compare a gym with the rival it was given, for the period a day falls in.
 *
 * The rival is a supplied `GymSnapshot` and is never chosen here — GDD §5.5
 * allows an AI or a real player and this module cannot tell the difference,
 * which is the point.
 *
 * A tie pays nothing: §5.5 says "for beating them", and paying a draw would
 * make the reward land on a day the player did not win, which is a payout with
 * a softer key than the sentence has.
 */
export function compareWithRival(
  own: GymSnapshot,
  rival: GymSnapshot,
  metric: LeaderboardMetric,
  anchorDay: CalendarDay,
  day: CalendarDay,
): RivalComparison {
  const periodIndex = rivalPeriodIndex(anchorDay, day);
  const ownScore = leaderboardScore(own, metric);
  const rivalScore = leaderboardScore(rival, metric);
  const outcome: RivalOutcome =
    ownScore > rivalScore ? 'ahead' : ownScore === rivalScore ? 'level' : 'behind';
  return Object.freeze({
    periodIndex,
    closesOnDay: rivalPeriodCloseDay(anchorDay, periodIndex),
    metric,
    ownScore,
    rivalScore,
    outcome,
    gymBucksOwed: asGymBucks(outcome === 'ahead' ? EMPIRE_TUNING.RIVAL_REWARD_GYM_BUCKS : 0),
  });
}

// ---------------------------------------------------------------------------
// The reward schedule — the list §8.3C is about
// ---------------------------------------------------------------------------

/** The two things this module schedules on the calendar. */
export const SOCIAL_REWARD_EVENTS = [
  /** `FRIEND_VISITS_PER_DAY` becomes available again. */
  'friend-visit-allowance-reset',
  /** A rival period closes and its reward, if it was won, lands. */
  'rival-period-close',
] as const;

export type SocialRewardEvent = (typeof SOCIAL_REWARD_EVENTS)[number];

/** One scheduled day. */
export interface SocialRewardDay {
  readonly day: CalendarDay;
  readonly event: SocialRewardEvent;
}

/**
 * Every day inside the horizon on which this module's rewards move, in day
 * order and then in `SOCIAL_REWARD_EVENTS` order.
 *
 * Reads `calendar.anchorDay` and nothing else. `social.test.ts` measures that
 * rather than trusting this sentence: for two histories identical except that
 * one has an extra trained day, this list is compared element-wise at every
 * horizon in `SOCIAL_SWEEP` and the divergence count is pinned at zero, with a
 * session-keyed control beside it whose count is pinned non-zero.
 */
export function socialRewardSchedule(
  calendar: SocialCalendarContext,
  horizonDays: number,
): readonly SocialRewardDay[] {
  if (!Number.isInteger(horizonDays) || horizonDays < 0) {
    refuseWith(`a horizon must be a whole number of days at or above zero, received ${horizonDays}.`);
  }
  const anchor = calendar.anchorDay;
  const closes = new Set<number>(rivalPeriodCloseDays(anchor, horizonDays));
  const schedule: SocialRewardDay[] = [];
  for (let offset = 0; offset < horizonDays; offset += 1) {
    const day = asCalendarDay(anchor + offset);
    schedule.push(Object.freeze({ day, event: 'friend-visit-allowance-reset' }));
    if (closes.has(day)) {
      schedule.push(Object.freeze({ day, event: 'rival-period-close' }));
    }
  }
  return Object.freeze(schedule);
}

// ---------------------------------------------------------------------------
// The runtime shadow of the tables above
// ---------------------------------------------------------------------------

/**
 * Every invariant this module's own tables have to satisfy, as a list of
 * messages — the same shape as `expansionVocabularyFaults`, and for the same
 * reason: a compile-time `satisfies` is graded by `tsc` and by nothing vitest
 * can redden.
 *
 * It does not re-derive `outputReach`. An oracle that recomputes its subject's
 * own lookup cannot disagree with it.
 */
export function socialVocabularyFaults(): readonly FaultMessage[] {
  const faults: string[] = [];

  // Read through a widened alias rather than off the frozen tuple directly:
  // `as const` gives the list a literal length, which makes `.length === 0` a
  // comparison TypeScript rejects as impossible — and rejecting it would leave
  // the row unchecked at runtime for the state where it stops being impossible.
  // `empireVocabularyFaults` records the same thing about `ARRIVAL_LICENCE`.
  const surfaces: readonly string[] = SOCIAL_SURFACES;
  if (surfaces.length === 0) {
    faults.push('no social surface exists, so the reach check below gates nothing');
  }
  if (PROGRESSION_REACHING_OUTPUTS.length === 0) {
    faults.push('no output reaches progression, so the ban protects nothing');
  }
  if (IDLE_ONLY_OUTPUTS.length === 0) {
    faults.push('no output is idle-only, so a social surface may feed nothing at all');
  }

  for (const surface of SOCIAL_SURFACES) {
    const output = socialOutput(surface);
    if (!isEmpireOutput(output)) {
      faults.push(`${surface} feeds ${String(output)}, which is not an empire output`);
      continue;
    }
    if (socialReach(surface) !== 'idle-only') {
      faults.push(`${surface} feeds ${output}, which reaches Sim progression`);
    }
    if ((PROGRESSION_REACHING_OUTPUTS as readonly string[]).includes(output)) {
      faults.push(`${surface} feeds ${output}, which is on the progression-reaching list`);
    }
  }

  // The period's unit is the refusal. A period counted in anything but whole
  // calendar days is GDD §8.3C's measured defect wearing this constant's name.
  const period = EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS;
  if (!Number.isInteger(period) || period < 1) {
    faults.push(`the rival comparison period is ${period}, which is not a whole number of days`);
  }
  if (!Number.isInteger(EMPIRE_TUNING.FRIEND_VISITS_PER_DAY) || EMPIRE_TUNING.FRIEND_VISITS_PER_DAY < 1) {
    faults.push(
      `the daily visit allowance is ${EMPIRE_TUNING.FRIEND_VISITS_PER_DAY}, so no friend gym can be visited`,
    );
  }
  if (EMPIRE_TUNING.ENCOURAGEMENT_REWARD_GYM_BUCKS < 0) {
    faults.push('an encouragement pays a negative amount');
  }
  if (EMPIRE_TUNING.RIVAL_REWARD_GYM_BUCKS < 0) {
    faults.push('beating the rival pays a negative amount');
  }

  const scopes: readonly LeaderboardScope[] = EMPIRE_TUNING.LEADERBOARD_SCOPES;
  if (scopes.length === 0) {
    faults.push('no leaderboard scope exists, so no bracket has a size');
  }
  for (const scope of scopes) {
    const size = leaderboardBracketSize(scope);
    if (!Number.isInteger(size) || size < 2) {
      faults.push(`the ${scope} bracket holds ${size} gyms, which is a mirror rather than a board`);
    }
  }

  return faults.map((message) => asFaultMessage(message));
}

/**
 * Every invariant a supplied `SocialContext` has to satisfy.
 *
 * A list rather than a throw, for the reason `empireStateFaults` gives: a
 * caller validating a decoded wire payload wants all of them at once.
 */
export function socialContextFaults(context: SocialContext): readonly FaultMessage[] {
  const faults: string[] = [];

  faults.push(...gymSnapshotFaults(context.ownGym, 'own gym'));

  const seen = new Set<string>();
  for (const friend of context.friends) {
    faults.push(...gymSnapshotFaults(friend, 'friend'));
    if (seen.has(friend.gymId)) faults.push(`friends: duplicate gym id ${friend.gymId}`);
    seen.add(friend.gymId);
    if (friend.gymId === context.ownGym.gymId) {
      faults.push('friends: the player own gym is on the friend list');
    }
  }

  if (context.rival !== null) {
    faults.push(...gymSnapshotFaults(context.rival, 'rival'));
    if (context.rival.gymId === context.ownGym.gymId) {
      faults.push('rival: a gym cannot be its own rival');
    }
  }

  if (!Number.isInteger(context.calendar.anchorDay) || context.calendar.anchorDay < 0) {
    faults.push(`calendar: the anchor day ${context.calendar.anchorDay} is not a calendar day`);
  }
  for (const day of context.calendar.trainedDays) {
    if (!Number.isInteger(day) || day < 0) {
      faults.push(`calendar: ${day} is not a calendar day`);
    }
  }

  for (const visit of context.visits) {
    if (!Number.isInteger(visit.day) || visit.day < 0) {
      faults.push(`visits: ${String(visit.gymId)} was visited on ${visit.day}, which is not a day`);
    }
    if (!seen.has(visit.gymId)) {
      faults.push(`visits: ${String(visit.gymId)} is not on the friend list`);
    }
  }

  for (const encouragement of context.encouragementsReceived) {
    if (!Number.isInteger(encouragement.day) || encouragement.day < 0) {
      faults.push(
        `encouragements: one arrived on ${encouragement.day}, which is not a calendar day`,
      );
    }
    if (encouragement.fromGymId.length === 0) {
      faults.push('encouragements: one arrived from a gym with no id');
    }
  }

  return faults.map((message) => asFaultMessage(message));
}

/** The per-snapshot half of the check above, so the three callers share it. */
function gymSnapshotFaults(snapshot: GymSnapshot, role: string): readonly string[] {
  const faults: string[] = [];
  if (typeof snapshot.gymId !== 'string' || snapshot.gymId.length === 0) {
    faults.push(`${role}: a gym arrived with no id`);
  }
  if (typeof snapshot.displayName !== 'string' || snapshot.displayName.length === 0) {
    faults.push(`${role}: ${String(snapshot.gymId)} arrived with no display name`);
  }
  if (!Number.isFinite(snapshot.reputation) || snapshot.reputation < 0) {
    faults.push(`${role}: ${String(snapshot.gymId)} reports ${snapshot.reputation} reputation`);
  }
  if (!Number.isFinite(snapshot.combinedTotalKg) || snapshot.combinedTotalKg < 0) {
    faults.push(
      `${role}: ${String(snapshot.gymId)} reports a combined total of ${snapshot.combinedTotalKg}`,
    );
  }
  return faults;
}
