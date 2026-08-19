/**
 * careerSurface.ts — the read models and cache transitions behind the Career
 * surface's two screens: GDD §2.1's federation chooser and GDD §6.1's calendar.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS, AND WHAT IT REFUSES TO BE
 * ---------------------------------------------------------------------------
 * The pure half of `CareerScreen.tsx`, the way `careerSurface`'s siblings in
 * this directory split their screens: the component calls functions here and
 * draws fields, because CLAUDE.md forbids game math inside a `.tsx`.
 *
 * Nothing here computes eligibility. `careerCalendarRows` maps the entries
 * `careerCalendarFromCache` hands back — verdicts already decided by the
 * server-side fold in `careerServer.ts`, each carrying the sentence a player
 * reads — into renderable rows. "Which meets can be entered" is
 * `verdict.kind === 'open'`, a filter over precomputed verdicts, exactly as
 * `CareerCalendarView`'s own header instructs.
 *
 * THE ONE PRESENTATION RULE THIS MODULE DOES ADD is GDD §10.0's beta lock:
 * `CAREER_BETA.LOCKED_TIERS` is drawn locked and is not enterable from this
 * surface whatever the verdict says about the lifter's strength. That is beta
 * scope, not eligibility — `entryVerdict` still answers for the tier, and the
 * lock is a row here plus a data row in `careerTuning.ts`.
 *
 * ---------------------------------------------------------------------------
 * THE OPTIMISTIC PATH, AS PURE TRANSITIONS THE HOOK SEQUENCES
 * ---------------------------------------------------------------------------
 * `choose-federation` runs through `progression.ts`'s own machinery:
 * `cacheWithChoicePending` parks the proposal beside truth (with an EMPTY
 * projection — `ProposalReach` gives the kind `'federation'` and the
 * projection type has no federation field, so there is no number a client
 * could legally guess); `cacheAfterChoiceResponse` settles it. On `chosen`
 * the server's snapshot is received and the calendar gates open. On `refused`
 * the proposal is rejected — which correctly marks the cache stale — and then
 * refreshed from the caller-supplied opening snapshot, because
 * `ACCEPT_PROPOSALS_WHILE_STALE` is off and a refusal screen the player cannot
 * retry from would be a dead end. The refusal copy handed back is the server's
 * own sentence, verbatim, never re-derived here (Sprint 1a's contract).
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT
 * ---------------------------------------------------------------------------
 * Zero React, zero I/O, no clock, no randomness. The day is resolved by the
 * caller (GDD §4.1) and the opening snapshot arrives as an argument.
 */

import {
  CAREER_BETA,
  CAREER_COPY,
  CAREER_FEDERATIONS,
  MEET_TIER_ORDER,
  type CareerFederationId,
  type CareerMeetTier,
} from '../career/careerTuning';
import type { CareerMeet } from '../career/calendar';
import { rulesetLabel } from '../career/federation';
import {
  careerCalendarFromCache,
  federationFromCache,
  type CareerServerResponse,
} from '../game/careerClient';
import type { CareerCalendarEntry, CareerMeetOutcome } from '../game/careerServer';
import {
  emptyProjection,
  proposeChange,
  rejectProposal,
  type ProgressionCache,
  type ProgressionSnapshotWire,
  type ProposalId,
  type ProposalOfKind,
} from '../game/progression';
import { formatWeight } from '../game/resultCard';
import { receiveSnapshot } from '../game/sessionClient';

// ---------------------------------------------------------------------------
// Which of the two screens is up
// ---------------------------------------------------------------------------

/**
 * The Career surface's two beats, reported to the shell the way `EmpirePhase`
 * is: the chooser (GDD §2.1, gated on `chosen === false`) and the calendar
 * (GDD §6.1). Both carry the shell's leave chrome — a player must be able to
 * walk away from the chooser without choosing, because the choice gates the
 * calendar, not the app.
 */
export type CareerSurfacePhase = 'choosing' | 'calendar';

/**
 * Which screen the cache says to draw. `chosen === false` — the seeded default
 * — gates the chooser; a `null` federation (no snapshot yet) draws the chooser
 * too, whose buttons cannot land anyway because `proposeChange` refuses an
 * empty cache.
 */
export function careerSurfacePhase(cache: ProgressionCache): CareerSurfacePhase {
  return federationFromCache(cache)?.chosen === true ? 'calendar' : 'choosing';
}

// ---------------------------------------------------------------------------
// The chooser's options — federation.ts's own data, labelled by its own rule
// ---------------------------------------------------------------------------

export interface FederationChoiceOption {
  readonly id: CareerFederationId;
  /** Fictional (GDD §12.3), from `CAREER_FEDERATIONS`. */
  readonly name: string;
  /** `rulesetLabel`'s composition — "RAW / TESTED" — never a second copy. */
  readonly rulesetText: string;
}

/** The four cards the chooser draws, in `CAREER_FEDERATIONS`' own order. */
export function federationChoiceOptions(): readonly FederationChoiceOption[] {
  return CAREER_FEDERATIONS.map((federation) => ({
    id: federation.id,
    name: federation.name,
    rulesetText: rulesetLabel(federation.ruleset),
  }));
}

// ---------------------------------------------------------------------------
// The calendar's rows — one per rung of GDD §6.1's ladder
// ---------------------------------------------------------------------------

export interface CareerCalendarRow {
  readonly tier: CareerMeetTier;
  /** `CAREER_COPY.TIER_LABEL`, copied so the component holds no lookup. */
  readonly tierLabel: string;
  /** The meet's own name — federation and tier, from `careerMeetFor`. */
  readonly meetName: string;
  /** The meet's day as `YYYY-MM-DD`, the server's own field. */
  readonly dateIso: string;
  /** The meet's gate, or the open-entry line. The MEET's datum, not the lifter's. */
  readonly qualifyingLine: string;
  /** `OPEN` / `LOCKED`, or null for a row whose verdict is a refusal sentence. */
  readonly badge: string | null;
  /** The server's refusal sentence, or the locked ceiling's line, or null. */
  readonly detail: string | null;
  /** `verdict.kind === 'open'` AND not beta-locked. The 1c entry seam keys off this. */
  readonly enterable: boolean;
  /** GDD §10.0: drawn, and drawn locked. */
  readonly locked: boolean;
  /**
   * The scheduled meet itself, VERBATIM from the calendar entry — what an
   * enterable row hands the router, which hands it to `careerMeet.ts`'s
   * adapter. Carried whole rather than as an id so the router never has to
   * re-derive a meet the verdict was not taken about.
   */
  readonly meet: CareerMeet;
}

function rowFor(tier: CareerMeetTier, entry: CareerCalendarEntry): CareerCalendarRow {
  const locked = (CAREER_BETA.LOCKED_TIERS as readonly CareerMeetTier[]).includes(tier);
  const open = entry.verdict.kind === 'open';
  return {
    tier,
    tierLabel: CAREER_COPY.TIER_LABEL[tier],
    meetName: entry.meet.name,
    dateIso: entry.meet.dateIso,
    qualifyingLine:
      entry.meet.qualifyingTotalKg === null
        ? CAREER_COPY.NO_QUALIFYING_TOTAL_NEEDED
        : `${CAREER_COPY.QUALIFYING_LABEL} ${formatWeight(entry.meet.qualifyingTotalKg)} kg`,
    badge: locked ? CAREER_COPY.CEILING_LOCKED_BADGE : open ? CAREER_COPY.OPEN_ENTRY_BADGE : null,
    detail: locked
      ? CAREER_COPY.CEILING_LOCKED_LINE
      : entry.verdict.kind === 'refused'
        ? entry.verdict.sentence
        : null,
    enterable: open && !locked,
    locked,
    meet: entry.meet,
  };
}

/**
 * One row per tier: the SOONEST upcoming meet of each rung, in ladder order,
 * lowest first — so the whole ladder is on one screen with the summit at the
 * bottom of it, which is GDD §10.0's "visible, locked harder ceiling" drawn as
 * the thing to strive toward.
 *
 * A FILTER OVER PRECOMPUTED VERDICTS, NOT ELIGIBILITY MATH. The entries come
 * from `careerCalendarFromCache` with their verdicts already on them; this
 * picks each tier's first and shapes it. A tier with no occurrence inside the
 * horizon is simply absent — at the shipped tuning that cannot happen on any
 * day at or after the season anchor, because every cadence is at most
 * `HORIZON_DAYS`, and `careerSurface.test.ts` measures that on the app's own
 * resolved day rather than assuming it.
 *
 * `null` before the first snapshot, like every career read model.
 */
export function careerCalendarRows(
  cache: ProgressionCache,
  today: number,
): readonly CareerCalendarRow[] | null {
  const view = careerCalendarFromCache(cache, today);
  if (view === null) return null;
  const rows: CareerCalendarRow[] = [];
  for (const tier of MEET_TIER_ORDER) {
    const soonest = view.entries.find((entry) => entry.meet.tier === tier);
    if (soonest !== undefined) rows.push(rowFor(tier, soonest));
  }
  return rows;
}

// ---------------------------------------------------------------------------
// The choose-federation transitions the hook sequences
// ---------------------------------------------------------------------------

/** The proposal a tapped federation card sends. Report shape is the wire's. */
export function federationChoiceProposal(
  id: CareerFederationId,
): ProposalOfKind<'choose-federation'> {
  return { kind: 'choose-federation', report: { federationId: id } };
}

/**
 * The cache with the choice in flight, or `null` when it may not be proposed —
 * empty truth, a proposal already pending, or stale truth. The projection is
 * empty: nothing about a federation choice is a number a screen could show
 * provisionally, and the pending status itself is what the chooser renders.
 */
export function cacheWithChoicePending(
  cache: ProgressionCache,
  proposal: ProposalOfKind<'choose-federation'>,
  proposalId: ProposalId,
): ProgressionCache | null {
  const pending = proposeChange(cache, proposalId, proposal, emptyProjection());
  return pending.ok ? pending.value : null;
}

/**
 * The cache after the server answered.
 *
 * On `chosen`, the acknowledging snapshot is received and the reading flips to
 * confirmed truth carrying `chosen: true` — the calendar's gate. On `refused`,
 * the proposal is rejected (truth is untouched but now in question, so the
 * cache goes stale) and then refreshed from `freshWire`, the port's own
 * opening snapshot, so the player can try again — `proposeChange` refuses a
 * stale cache, and a refusal the player cannot retry from is a dead end.
 */
export function cacheAfterChoiceResponse(
  cache: ProgressionCache,
  proposalId: ProposalId,
  response: CareerServerResponse,
  freshWire: ProgressionSnapshotWire,
): ProgressionCache {
  if (response.kind === 'chosen') {
    return receiveSnapshot(cache, response.wire);
  }
  const rejected = rejectProposal(cache, proposalId);
  const base = rejected.ok ? rejected.value : cache;
  return receiveSnapshot(base, freshWire);
}

/**
 * What the chooser says about the answer: the server's refusal sentence,
 * VERBATIM — never re-derived, never keyed to a code and re-worded here — or
 * null on success. Sprint 1a's contract for every career refusal.
 */
export function refusalSentence(response: CareerServerResponse): string | null {
  return response.kind === 'refused' ? response.error.message : null;
}

// ---------------------------------------------------------------------------
// GDD §6.5 — the recap's career lines
// ---------------------------------------------------------------------------

export interface CareerRecapLine {
  /** Which claim the line makes, so a screen can key and style it honestly. */
  readonly kind: 'career-best' | 'qualified';
  readonly text: string;
}

/**
 * What the recap says about the career, from the server's `CareerMeetOutcome`
 * and from nothing computed here: the standing career best, and the tiers this
 * result newly unlocked — the payoff line GDD §6.1's ladder exists for.
 *
 * Empty for an outcome with no total on it (a bomb-out never reaches the
 * recap, so that case is a shape of the type rather than a screen).
 */
export function careerRecapLines(outcome: CareerMeetOutcome): readonly CareerRecapLine[] {
  const lines: CareerRecapLine[] = [];
  if (outcome.bestTotalKgAfter !== null) {
    lines.push({
      kind: 'career-best',
      text: `${CAREER_COPY.RECAP_CAREER_BEST_LABEL} ${formatWeight(outcome.bestTotalKgAfter)} kg`,
    });
  }
  if (outcome.newlyQualifiedTiers.length > 0) {
    const tiers = outcome.newlyQualifiedTiers
      .map((tier) => CAREER_COPY.TIER_LABEL[tier])
      .join(' · ');
    lines.push({ kind: 'qualified', text: `${CAREER_COPY.RECAP_QUALIFIED_PREFIX} ${tiers}` });
  }
  return lines;
}
