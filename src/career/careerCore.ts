/**
 * careerCore.ts — the Career calendar's vocabulary and its scheduling maths.
 *
 * GDD §6.1's sentence is the whole of this piece: "select a meet from the
 * Career calendar (local -> regional -> nationals -> worlds), gated by
 * qualifying totals", plus §2.1's "pick a federation (raw / equipped / tested
 * / untested)". So: the tier ladder, the federation catalogue, the meet slots
 * a calendar is made of, which of them a lifter may enter, and which they
 * already have.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock and no randomness. Time is a parameter, and
 * it is a parameter in a specific form — see "day indices" below. Its one
 * import is `./careerTuning`, so every number it uses is named and in one
 * place; `careerCore.test.ts` runs the repository's own magic-number audit
 * over this directory to keep that true rather than asked for.
 *
 * ===========================================================================
 * 1. `CareerMeetDraft` is a deliberate mirror of a frozen contract
 * ===========================================================================
 *
 * `MeetDefinition` in `src/game/meetTuning.ts` says in its own header:
 *
 *     NOT A CAREER CALENDAR. §6.1's "select a meet from the Career calendar
 *     (local -> regional -> nationals -> worlds), gated by qualifying totals"
 *     is a Career-mode feature and is explicitly out of this piece's scope;
 *     there is one meet here and it is local. Whoever builds the calendar
 *     produces a list of these and gates it.
 *
 * That is a contract written for this module before it existed. `src/career/`
 * still does not import it, for the reason §3 gives about the gate: the seam
 * is what makes this directory safe to build in parallel with work inside
 * `src/game/`. So `CareerMeetDraft` below carries `MeetDefinition`'s nine
 * field names and nothing else, and `careerMeetDraft` is the function that
 * fills them.
 *
 * The cost of a mirror is drift, and it is worth naming the shape drift would
 * take rather than promising it will not happen. If somebody adds a tenth
 * field to `MeetDefinition` — a weight-class list, a flight size, a platform
 * count — the two shapes stop matching, and nothing about a mirror notices
 * that by itself: this file would keep compiling, the calendar would keep
 * producing drafts, and the wiring piece would be the place the missing field
 * surfaced, one directory and some number of waves away.
 *
 * How a reader checks: `careerCore.test.ts`'s "the meet draft mirrors
 * MeetDefinition" reads `src/game/meetTuning.ts` as text, pulls the field
 * names out of the real `interface MeetDefinition` block, pulls them out of
 * `CareerMeetDraft` here the same way, and asserts the two name sets are equal
 * with the count pinned at nine on both sides. A tenth field on either side
 * reddens it. That test reads the file and does not import it, so it does not
 * put an import edge where this header just said there is none.
 *
 * `rules` is a type parameter rather than `MeetLoadingRules`, because
 * `MeetLoadingRules` lives in `src/game/meet.ts` and importing it would be the
 * edge this whole arrangement exists to avoid. The wiring piece binds it. The
 * mirror is therefore over field NAMES and not over field TYPES, which is the
 * honest limit of it: a `MeetDefinition` field that changed type without
 * changing name would not redden anything here.
 *
 * ===========================================================================
 * 2. Day indices, not dates
 * ===========================================================================
 *
 * Every time in this module is an integer day index counted from the career's
 * day zero. There is no `Date`, no epoch and no timezone here, and
 * `careerCore.test.ts` bans the identifier from the whole directory.
 *
 * `MeetDefinition.dateIso` is an ISO `YYYY-MM-DD` string and something has to
 * produce it. That something is the caller: `careerMeetDraft` takes the ISO
 * date as an input alongside the town, the state, the country, the loading
 * rules and the ghost field. A pure module that invents a date invents a
 * timezone with it, and the lifter's own timezone is not a fact this directory
 * has.
 *
 * ===========================================================================
 * 3. Qualification is an injected predicate, and that is a seam not a style
 * ===========================================================================
 *
 * `meetsQualifyingTotal` lives at `src/game/progression.ts:4434`, and its own
 * docstring says why it is worth reaching for: it takes a `ConfirmedTotalKg`
 * and nothing else, so "a projection, a locally summed board total, or
 * `finalMeetTotal(state) ?? 0` will not typecheck here — which is the point:
 * entry to nationals is not decided by a number the phone made up."
 *
 * `src/career/` must not import it. `progression.ts` is the most-edited file
 * in the repository and an import edge from a directory being built in
 * parallel is how two sessions collide. So every function here that needs to
 * know whether a total qualifies takes the predicate as an argument, over a
 * type parameter `Total` this module never constructs, never inspects and
 * never compares:
 *
 *     type CareerQualifyingGate<Total> = (total: Total, requiredKg: number) => boolean;
 *
 * What that buys, and it is more than tidiness: the wiring piece instantiates
 * `Total` as `ConfirmedTotalKg` and passes `meetsQualifyingTotal` itself, so
 * the confirmed-total fence is enforced at the wiring site by the real
 * function rather than re-implemented here by a weaker one. Nothing in this
 * directory can compare a total to a number — there is no `>=` on a `Total`
 * anywhere in this file, because `Total` is opaque and such a comparison would
 * not compile. A module that cannot compare cannot accidentally admit a
 * projected total.
 *
 * There is deliberately no default gate. A default is the thing that lets a
 * caller forget to inject, and a defaulted `(a, b) => a >= b` would be exactly
 * the locally-summed comparison the fence exists to refuse.
 *
 * `careerCore.test.ts`'s "imports nothing outside this directory" pins the
 * import list at `['./careerTuning']` and the tuning module's at `[]`.
 *
 * ===========================================================================
 * 4. What this module does not do
 * ===========================================================================
 *
 *   - It does not score. Total, e1RM and DOTS belong to `src/game/`, and the
 *     meet structure CLAUDE.md calls checkable by real powerlifters — squat,
 *     bench, deadlift, three attempts each, total is the sum of the best
 *     successful attempt per lift, attempts may not go down within a lift — is
 *     `src/game/meet.ts`'s and is not restated here. A calendar decides which
 *     meet, never what happened at it.
 *   - It does not write progression. Entering a meet returns a new
 *     `CareerLifter` value; whether that becomes server truth is a progression
 *     intent and belongs to the wiring piece.
 *   - It does not price anything, and nothing here is purchasable. GDD §12.3
 *     refuses anything purchasable that affects meet performance, and a
 *     purchasable qualification would be exactly that.
 *   - It does not render. There is no copy in this module: an eligibility
 *     verdict is a tagged value with the numbers a screen needs, and the
 *     sentence is the screen's.
 */

import { CAREER_TUNING } from './careerTuning';

// ---------------------------------------------------------------------------
// Vocabulary, derived from the tuning block rather than restated beside it
// ---------------------------------------------------------------------------

/** GDD §6.1's ladder: local -> regional -> nationals -> worlds. */
export type CareerTier = (typeof CAREER_TUNING.MEET_TIERS)[number];

/** GDD §2.1's equipment axis. */
export type EquipmentDivision = (typeof CAREER_TUNING.EQUIPMENT_DIVISIONS)[number];

/** GDD §2.1's drug-testing axis. */
export type TestingPolicy = (typeof CAREER_TUNING.TESTING_POLICIES)[number];

/** The category a qualifying total is published against. */
export type CareerQualifyingCategory = (typeof CAREER_TUNING.QUALIFYING_CATEGORIES)[number];

/** The id of one of the four invented federations. A closed set. */
export type CareerFederationId = (typeof CAREER_TUNING.FEDERATIONS)[number]['id'];

/** One federation a player may pick in GDD §2.1. */
export interface CareerFederation {
  readonly id: CareerFederationId;
  /** The player-facing name. Invented; see `careerTuning.ts`'s header. */
  readonly name: string;
  /** The word this federation's meets are named after. */
  readonly meetPrefix: string;
  readonly equipment: EquipmentDivision;
  readonly testing: TestingPolicy;
}

/** The federation catalogue, typed. The data is `careerTuning.ts`'s. */
export const CAREER_FEDERATIONS: readonly CareerFederation[] = CAREER_TUNING.FEDERATIONS;

/**
 * The qualifying requirement for one meet, per category. `null` is open entry.
 *
 * Carried on the slot rather than looked up at the point of use so that a
 * calendar rendered yesterday and a calendar rendered today disagree loudly
 * instead of quietly: `careerCalendarFaults` compares every slot's copy
 * against the live table.
 */
export type CareerQualifyingRequirement = Readonly<
  Record<CareerQualifyingCategory, number | null>
>;

// ---------------------------------------------------------------------------
// The meet slot, and the draft it becomes
// ---------------------------------------------------------------------------

/**
 * One dated place on the Career calendar.
 *
 * A slot is not a meet. It is the calendar's half of one: which federation,
 * which tier, which day, and what it asks for. The other half — where it is,
 * what the bar loads to, who else is in the field — arrives from the caller at
 * `careerMeetDraft`.
 */
export interface CareerMeetSlot {
  /** Stable and derived: federation, tier and day. Becomes the meet's id. */
  readonly slotId: string;
  readonly tier: CareerTier;
  readonly federationId: CareerFederationId;
  /** Whole days from the career's day zero. Never a date; see the header. */
  readonly dayIndex: number;
  readonly qualifyingTotalKg: CareerQualifyingRequirement;
}

/**
 * The six fields `MeetDefinition` needs that a calendar does not know.
 *
 * `rules` is a type parameter: `MeetLoadingRules` is `src/game/meet.ts`'s and
 * this directory does not import it.
 */
export interface CareerMeetVenue<Rules> {
  /** ISO-8601 `YYYY-MM-DD`, the format `resultCard.ts` parses. */
  readonly dateIso: string;
  readonly town: string;
  readonly state: string;
  readonly country: string;
  readonly rules: Rules;
  readonly ghostTotalsKg: readonly number[];
}

/**
 * A deliberate mirror of `MeetDefinition` (`src/game/meetTuning.ts`), by field
 * name. See this file's header, section 1, for why it is a mirror, what drift
 * would look like, and which test reddens.
 *
 * Three of the nine fields are the calendar's own — `id`, `federation` and
 * `name` — and six pass through from `CareerMeetVenue` untouched. That split
 * is pinned in `careerCore.test.ts` rather than left to this sentence.
 */
export interface CareerMeetDraft<Rules> {
  readonly id: string;
  readonly federation: string;
  readonly name: string;
  readonly dateIso: string;
  readonly town: string;
  readonly state: string;
  readonly country: string;
  readonly rules: Rules;
  readonly ghostTotalsKg: readonly number[];
}

// ---------------------------------------------------------------------------
// The lifter's Career state
// ---------------------------------------------------------------------------

/**
 * What the calendar knows about a lifter.
 *
 * The field list is short on purpose and it is pinned in `careerCore.test.ts`.
 * Nothing here is a training quantity: no session count, no streak length, no
 * check-in history. GDD §4.4 measured what happens when a restriction is keyed
 * to something a player does daily, and `MIN_DAYS_BETWEEN_ENTERED_MEETS` is
 * the one restriction in this piece that could have been. It reads
 * `lastEntryDayIndex` and nothing else, and the pinned field list is what
 * makes that structural instead of observed.
 *
 * `bestTotal` is opaque here — see the header, section 3. This module never
 * compares it to anything; the injected gate does.
 */
export interface CareerLifter<Total> {
  readonly federationId: CareerFederationId;
  readonly category: CareerQualifyingCategory;
  /** The lifter's qualifying total, or `null` before their first meet. */
  readonly bestTotal: Total | null;
  readonly enteredSlotIds: readonly string[];
  /** The day of the latest meet entered, or `null` if none. */
  readonly lastEntryDayIndex: number | null;
}

/**
 * The qualification predicate, injected.
 *
 * The wiring piece passes `meetsQualifyingTotal` from
 * `src/game/progression.ts` with `Total` bound to its `ConfirmedTotalKg`.
 * There is no default; see the header, section 3.
 */
export type CareerQualifyingGate<Total> = (total: Total, requiredKg: number) => boolean;

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/** Where a slot sits relative to today. */
export type CareerMeetVisibility = 'passed' | 'open' | 'not-yet-visible';

/**
 * Why a lifter may or may not enter a slot.
 *
 * A tagged value carrying the numbers a screen would need, and no sentence:
 * copy is the screen's. The precedence between the refusals is fixed and
 * tested — see `meetEligibility`.
 */
export type CareerEligibility =
  | { readonly kind: 'eligible' }
  | { readonly kind: 'other-federation'; readonly federationId: CareerFederationId }
  | { readonly kind: 'already-entered'; readonly slotId: string }
  | { readonly kind: 'meet-has-passed'; readonly dayIndex: number }
  | { readonly kind: 'not-yet-visible'; readonly opensOnDayIndex: number }
  | { readonly kind: 'too-soon-after-last-meet'; readonly earliestDayIndex: number }
  | { readonly kind: 'no-recorded-total'; readonly requiredKg: number }
  | { readonly kind: 'below-qualifying-total'; readonly requiredKg: number };

/** Every `CareerEligibility` tag, for exhaustiveness checks. */
export const CAREER_ELIGIBILITY_KINDS = Object.freeze([
  'eligible',
  'other-federation',
  'already-entered',
  'meet-has-passed',
  'not-yet-visible',
  'too-soon-after-last-meet',
  'no-recorded-total',
  'below-qualifying-total',
] as const);

/** What entering a meet did. A refusal carries the verdict that produced it. */
export type CareerEntryOutcome<Total> =
  | { readonly kind: 'entered'; readonly lifter: CareerLifter<Total> }
  | { readonly kind: 'refused'; readonly reason: CareerEligibility };

// ---------------------------------------------------------------------------
// Tier and federation lookups
// ---------------------------------------------------------------------------

/** Whether a string is one of GDD §6.1's four tiers. */
export function isCareerTier(value: string): value is CareerTier {
  return (CAREER_TUNING.MEET_TIERS as readonly string[]).includes(value);
}

/**
 * Where a tier sits on the ladder: `local` lowest, `worlds` highest.
 *
 * The index into `MEET_TIERS`, so the ladder's order is the array's order and
 * there is no second list to keep in step.
 */
export function careerTierRank(tier: CareerTier): number {
  return CAREER_TUNING.MEET_TIERS.indexOf(tier);
}

/** The federation with this id, or `null`. */
export function careerFederation(id: string): CareerFederation | null {
  return CAREER_FEDERATIONS.find((federation) => federation.id === id) ?? null;
}

/**
 * What a meet at this tier under this federation is called.
 *
 * The federation's `meetPrefix` and the tier's title, so the first federation
 * at `local` is "Cragmoor Open" — the name `MEET_LOCAL` already ships.
 */
export function careerMeetName(federationId: string, tier: CareerTier): string {
  const federation = careerFederation(federationId);
  if (federation === null) {
    throw new RangeError(`career: no federation with id ${federationId}`);
  }
  return `${federation.meetPrefix} ${CAREER_TUNING.MEET_TITLE_BY_TIER[tier]}`;
}

/**
 * The total a tier asks of a category, in kilograms, or `null` for open entry.
 *
 * The one reader of `QUALIFYING_TOTAL_KG_BY_TIER`, which is what makes that
 * table replaceable by a per-weight-class grid without touching anything else.
 */
export function qualifyingTotalKgFor(
  tier: CareerTier,
  category: CareerQualifyingCategory,
): number | null {
  return CAREER_TUNING.QUALIFYING_TOTAL_KG_BY_TIER[tier][category];
}

/** The requirement for a tier across every category, as a slot carries it. */
function requirementFor(tier: CareerTier): CareerQualifyingRequirement {
  const requirement: Record<CareerQualifyingCategory, number | null> = {
    mens: qualifyingTotalKgFor(tier, 'mens'),
    womens: qualifyingTotalKgFor(tier, 'womens'),
  };
  return Object.freeze(requirement);
}

// ---------------------------------------------------------------------------
// Building the calendar
// ---------------------------------------------------------------------------

/** What a calendar is built from. */
export interface CareerCalendarSpec {
  readonly federationId: CareerFederationId;
  /** The last day index a slot may sit on. Whole days from day zero. */
  readonly throughDayIndex: number;
}

/** How many slots a tier contributes to a horizon. Counted before building. */
function slotCountFor(tier: CareerTier, throughDayIndex: number): number {
  const first = CAREER_TUNING.FIRST_MEET_DAY_BY_TIER[tier];
  if (throughDayIndex < first) return 0;
  const interval = CAREER_TUNING.MEET_INTERVAL_DAYS_BY_TIER[tier];
  return Math.floor((throughDayIndex - first) / interval) + 1;
}

/**
 * Every meet slot a federation runs from day zero through `throughDayIndex`.
 *
 * Deterministic and total: the same spec gives the same list, byte for byte,
 * on every call and on every device. There is no seed here and no clock.
 *
 * Sorted by day, then by tier rank, then by id, so two tiers landing on the
 * same day have a settled order rather than an insertion-order one.
 *
 * Throws a `RangeError` rather than returning a partial list when the spec is
 * unusable: an unknown federation, a horizon that is not a non-negative whole
 * number, or a horizon long enough to exceed `CALENDAR_MAX_SLOTS`. The count
 * is computed before the loop runs, so an absurd horizon fails immediately
 * instead of building for a long time first.
 */
export function buildCareerCalendar(spec: CareerCalendarSpec): readonly CareerMeetSlot[] {
  if (careerFederation(spec.federationId) === null) {
    throw new RangeError(`career: no federation with id ${spec.federationId}`);
  }
  if (!Number.isInteger(spec.throughDayIndex) || spec.throughDayIndex < 0) {
    throw new RangeError(
      `career: a calendar horizon must be a whole number of days from day zero, received ${spec.throughDayIndex}`,
    );
  }

  let planned = 0;
  for (const tier of CAREER_TUNING.MEET_TIERS) {
    planned += slotCountFor(tier, spec.throughDayIndex);
  }
  if (planned > CAREER_TUNING.CALENDAR_MAX_SLOTS) {
    throw new RangeError(
      `career: a horizon of ${spec.throughDayIndex} days plans ${planned} slots, over CALENDAR_MAX_SLOTS of ${CAREER_TUNING.CALENDAR_MAX_SLOTS}`,
    );
  }

  const slots: CareerMeetSlot[] = [];
  for (const tier of CAREER_TUNING.MEET_TIERS) {
    const interval = CAREER_TUNING.MEET_INTERVAL_DAYS_BY_TIER[tier];
    const requirement = requirementFor(tier);
    let dayIndex = CAREER_TUNING.FIRST_MEET_DAY_BY_TIER[tier];
    while (dayIndex <= spec.throughDayIndex) {
      slots.push(
        Object.freeze({
          slotId: `${spec.federationId}-${tier}-d${dayIndex}`,
          tier,
          federationId: spec.federationId,
          dayIndex,
          qualifyingTotalKg: requirement,
        }),
      );
      dayIndex += interval;
    }
  }

  slots.sort((left, right) => {
    if (left.dayIndex !== right.dayIndex) return left.dayIndex - right.dayIndex;
    const byRank = careerTierRank(left.tier) - careerTierRank(right.tier);
    if (byRank !== 0) return byRank;
    return left.slotId < right.slotId ? -1 : left.slotId > right.slotId ? 1 : 0;
  });
  return Object.freeze(slots);
}

/**
 * Fill in `MeetDefinition`'s nine fields for a slot.
 *
 * The calendar owns three of them and the caller supplies six. See the header,
 * section 1, for the mirror this shape is a mirror of.
 */
export function careerMeetDraft<Rules>(
  slot: CareerMeetSlot,
  venue: CareerMeetVenue<Rules>,
): CareerMeetDraft<Rules> {
  const federation = careerFederation(slot.federationId);
  if (federation === null) {
    throw new RangeError(`career: no federation with id ${slot.federationId}`);
  }
  return Object.freeze({
    id: slot.slotId,
    federation: federation.name,
    name: careerMeetName(slot.federationId, slot.tier),
    dateIso: venue.dateIso,
    town: venue.town,
    state: venue.state,
    country: venue.country,
    rules: venue.rules,
    ghostTotalsKg: venue.ghostTotalsKg,
  });
}

// ---------------------------------------------------------------------------
// Selecting a meet
// ---------------------------------------------------------------------------

/**
 * Where a slot sits relative to today.
 *
 * The one place the visibility window is arithmetic. `visibleMeets` and
 * `meetEligibility` both route through here rather than each doing the sum,
 * because two arms of one decision written twice is how the second one ends up
 * subtly different from the first.
 */
export function meetVisibilityOn(slot: CareerMeetSlot, todayDayIndex: number): CareerMeetVisibility {
  if (slot.dayIndex < todayDayIndex) return 'passed';
  if (slot.dayIndex > todayDayIndex + CAREER_TUNING.CALENDAR_VISIBLE_DAYS_AHEAD) {
    return 'not-yet-visible';
  }
  return 'open';
}

/** The slots on screen today: today's meet through the visibility horizon. */
export function visibleMeets(
  calendar: readonly CareerMeetSlot[],
  todayDayIndex: number,
): readonly CareerMeetSlot[] {
  return calendar.filter((slot) => meetVisibilityOn(slot, todayDayIndex) === 'open');
}

/**
 * The earliest day a lifter's next meet may sit on, or `null` if they have
 * never entered one.
 *
 * Reads `lastEntryDayIndex` and nothing else — see `CareerLifter`.
 */
export function earliestNextEntryDay<Total>(lifter: CareerLifter<Total>): number | null {
  if (lifter.lastEntryDayIndex === null) return null;
  return lifter.lastEntryDayIndex + CAREER_TUNING.MIN_DAYS_BETWEEN_ENTERED_MEETS;
}

/**
 * Whether this lifter may enter this slot today, and if not, why.
 *
 * The precedence between refusals is fixed, because it decides which sentence
 * a player reads when two things are wrong at once, and an order nobody chose
 * is an order that changes when the `if`s are reordered. It is asserted in
 * `careerCore.test.ts` on cases where two refusals are true together:
 *
 *   1. `other-federation`      — a fact about the account, not the meet.
 *   2. `already-entered`       — the player has done this; say that first.
 *   3. `meet-has-passed`       — the date, before anything about the lifter.
 *   4. `not-yet-visible`       — the other end of the same window.
 *   5. `too-soon-after-last-meet`
 *   6. the qualifying total, last, because it is the one a player can change.
 *
 * The gate is not consulted at all for an open tier — `local` asks for no
 * total — so a lifter with no recorded total is `eligible` there rather than
 * refused for a requirement that does not exist.
 */
export function meetEligibility<Total>(
  slot: CareerMeetSlot,
  lifter: CareerLifter<Total>,
  todayDayIndex: number,
  gate: CareerQualifyingGate<Total>,
): CareerEligibility {
  if (slot.federationId !== lifter.federationId) {
    return { kind: 'other-federation', federationId: slot.federationId };
  }
  if (lifter.enteredSlotIds.includes(slot.slotId)) {
    return { kind: 'already-entered', slotId: slot.slotId };
  }

  const visibility = meetVisibilityOn(slot, todayDayIndex);
  if (visibility === 'passed') {
    return { kind: 'meet-has-passed', dayIndex: slot.dayIndex };
  }
  if (visibility === 'not-yet-visible') {
    return {
      kind: 'not-yet-visible',
      opensOnDayIndex: slot.dayIndex - CAREER_TUNING.CALENDAR_VISIBLE_DAYS_AHEAD,
    };
  }

  const earliest = earliestNextEntryDay(lifter);
  if (earliest !== null && slot.dayIndex < earliest) {
    return { kind: 'too-soon-after-last-meet', earliestDayIndex: earliest };
  }

  const requiredKg = slot.qualifyingTotalKg[lifter.category];
  if (requiredKg === null) return { kind: 'eligible' };
  if (lifter.bestTotal === null) return { kind: 'no-recorded-total', requiredKg };
  if (!gate(lifter.bestTotal, requiredKg)) {
    return { kind: 'below-qualifying-total', requiredKg };
  }
  return { kind: 'eligible' };
}

/** The slots this lifter could enter today, in calendar order. */
export function selectableMeets<Total>(
  calendar: readonly CareerMeetSlot[],
  lifter: CareerLifter<Total>,
  todayDayIndex: number,
  gate: CareerQualifyingGate<Total>,
): readonly CareerMeetSlot[] {
  return calendar.filter(
    (slot) => meetEligibility(slot, lifter, todayDayIndex, gate).kind === 'eligible',
  );
}

// ---------------------------------------------------------------------------
// Entering a meet
// ---------------------------------------------------------------------------

/** A lifter who has just picked a federation and entered nothing yet. */
export function createCareerLifter<Total>(
  federationId: CareerFederationId,
  category: CareerQualifyingCategory,
): CareerLifter<Total> {
  if (careerFederation(federationId) === null) {
    throw new RangeError(`career: no federation with id ${federationId}`);
  }
  return Object.freeze({
    federationId,
    category,
    bestTotal: null,
    enteredSlotIds: Object.freeze([]),
    lastEntryDayIndex: null,
  });
}

/**
 * Enter a meet, or refuse with the reason.
 *
 * The refusal is the verdict `meetEligibility` produced, not a second opinion
 * assembled here: one decision, one place it is made. `src/game/streak.ts`'s
 * store learned that the expensive way — a completed sale re-validating
 * through a different path from the one that rendered the offer is how two
 * answers to one question get shipped.
 *
 * `lastEntryDayIndex` becomes this slot's day, and it only ever moves forward.
 * It is written as a plain assignment rather than as
 * `Math.max(previous, slot.dayIndex)`, and that is a correction rather than a
 * shortcut: the guarded version shipped first, and mutation-testing it found
 * NO INPUT that could tell the two apart. `meetEligibility` refuses any slot
 * sitting earlier than `lastEntryDayIndex + MIN_DAYS_BETWEEN_ENTERED_MEETS`,
 * so an accepted slot is always later than the last entry and the `max` was a
 * branch no caller could reach — a defensive line that read as protection and
 * could not have failed.
 *
 * What replaced it is a claim with a domain: `careerCore.test.ts` sweeps every
 * slot against every prior entry day and asserts that an accepted entry always
 * moves the day forward, with both the accepted and refused counts pinned.
 * Removing the gap check reddens that; nothing reddened the `max`.
 */
export function enterMeet<Total>(
  lifter: CareerLifter<Total>,
  slot: CareerMeetSlot,
  todayDayIndex: number,
  gate: CareerQualifyingGate<Total>,
): CareerEntryOutcome<Total> {
  const verdict = meetEligibility(slot, lifter, todayDayIndex, gate);
  if (verdict.kind !== 'eligible') {
    return { kind: 'refused', reason: verdict };
  }
  return Object.freeze({
    kind: 'entered',
    lifter: Object.freeze({
      ...lifter,
      enteredSlotIds: Object.freeze([...lifter.enteredSlotIds, slot.slotId]),
      lastEntryDayIndex: slot.dayIndex,
    }),
  });
}

// ---------------------------------------------------------------------------
// Invariant checks, for payloads that did not come through a constructor
// ---------------------------------------------------------------------------

/**
 * Everything wrong with a calendar, as sentences, or an empty list.
 *
 * The functions above are total and their outputs satisfy these by
 * construction. This exists for the other path: a calendar that arrived as
 * JSON from an Edge Function, or one a test assembled by hand. JSON has no
 * types, so the types above are not a check on it.
 */
export function careerCalendarFaults(calendar: readonly CareerMeetSlot[]): readonly string[] {
  const faults: string[] = [];
  const seen = new Set<string>();
  let previousDay: number | null = null;

  for (const slot of calendar) {
    if (seen.has(slot.slotId)) {
      faults.push(`career: two slots share the id ${slot.slotId}`);
    }
    seen.add(slot.slotId);

    if (!isCareerTier(slot.tier)) {
      faults.push(`career: slot ${slot.slotId} has tier ${slot.tier}, which is not on the ladder`);
      continue;
    }
    if (careerFederation(slot.federationId) === null) {
      faults.push(`career: slot ${slot.slotId} names federation ${slot.federationId}, which does not exist`);
    }
    if (!Number.isInteger(slot.dayIndex) || slot.dayIndex < 0) {
      faults.push(
        `career: slot ${slot.slotId} sits on day ${slot.dayIndex}, which is not a whole number of days from day zero`,
      );
    } else if (previousDay !== null && slot.dayIndex < previousDay) {
      faults.push(
        `career: slot ${slot.slotId} sits on day ${slot.dayIndex}, before the slot ahead of it on day ${previousDay}`,
      );
    }
    if (Number.isInteger(slot.dayIndex)) previousDay = slot.dayIndex;

    const expected = requirementFor(slot.tier);
    for (const category of CAREER_TUNING.QUALIFYING_CATEGORIES) {
      if (slot.qualifyingTotalKg[category] !== expected[category]) {
        faults.push(
          `career: slot ${slot.slotId} asks ${slot.qualifyingTotalKg[category]} kg of ${category}, but the ${slot.tier} tier asks ${expected[category]}`,
        );
      }
    }
  }
  return faults;
}

/** Everything wrong with a lifter's Career state, as sentences, or none. */
export function careerLifterFaults<Total>(lifter: CareerLifter<Total>): readonly string[] {
  const faults: string[] = [];

  if (careerFederation(lifter.federationId) === null) {
    faults.push(`career: lifter is in federation ${lifter.federationId}, which does not exist`);
  }
  if (!(CAREER_TUNING.QUALIFYING_CATEGORIES as readonly string[]).includes(lifter.category)) {
    faults.push(`career: lifter is in category ${lifter.category}, which is not a qualifying category`);
  }

  const seen = new Set<string>();
  for (const slotId of lifter.enteredSlotIds) {
    if (seen.has(slotId)) {
      faults.push(`career: lifter has entered ${slotId} more than once`);
    }
    seen.add(slotId);
  }

  const hasEntries = lifter.enteredSlotIds.length > 0;
  if (hasEntries && lifter.lastEntryDayIndex === null) {
    faults.push('career: lifter has entered a meet but records no day for it');
  }
  if (!hasEntries && lifter.lastEntryDayIndex !== null) {
    faults.push(
      `career: lifter records a last entry on day ${lifter.lastEntryDayIndex} but has entered nothing`,
    );
  }
  if (
    lifter.lastEntryDayIndex !== null &&
    (!Number.isInteger(lifter.lastEntryDayIndex) || lifter.lastEntryDayIndex < 0)
  ) {
    faults.push(
      `career: lifter's last entry is on day ${lifter.lastEntryDayIndex}, which is not a whole number of days from day zero`,
    );
  }
  return faults;
}
