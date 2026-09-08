/**
 * careerPresentation.ts — renderer-independent Career presentation state.
 *
 * Claude owns how Career looks. This module is the only Career data a
 * renderer should bind to: the day, the federation, the competition Total,
 * qualification, the in-progress entry, history, upcoming meets, and the
 * next decision. It does not draw. It does not name colours, layout, or
 * copy. Refusal reasons are codes, not sentences.
 *
 * Facts already held authoritatively elsewhere are passed in, never
 * recomputed: `CareerLifter` from the server fold, history from stored
 * meets, `enteredMeetId` from the save-envelope sibling. e1RM is not a
 * field — GDD §2 / §6.4: qualification reads competition Total, never the
 * training estimate.
 */

import { asStreakDay, type StreakDay } from '../game/streak';
import {
  CAREER_BETA,
  MEET_TIER_ORDER,
  type CareerFederationId,
  type CareerMeetTier,
} from './careerTuning';
import {
  isoDateOf,
  qualifyingTotalKgFor,
  upcomingMeets,
} from './calendar';
import {
  entryVerdict,
  meetsQualifyingTotal,
  type CareerLifter,
  type EntryRefusalReason,
} from './eligibility';

export type CareerNextDecision =
  | { readonly kind: 'choose-federation' }
  | { readonly kind: 'complete-meet'; readonly meetId: string }
  | { readonly kind: 'enter-meet'; readonly meetId: string }
  | { readonly kind: 'train' };

export interface CareerQualifyingRow {
  readonly tier: CareerMeetTier;
  readonly qualifyingTotalKg: number | null;
  readonly qualifies: boolean;
  readonly locked: boolean;
}

export interface CareerHistoryEntry {
  readonly meetId: string;
  readonly totalKg: number | null;
}

export interface CareerUpcomingEntry {
  readonly meetId: string;
  readonly tier: CareerMeetTier;
  readonly day: StreakDay;
  readonly dateIso: string;
  readonly enterable: boolean;
  readonly locked: boolean;
  readonly refusalReason: EntryRefusalReason | null;
}

export interface CareerPresentationState {
  readonly day: StreakDay;
  readonly dateIso: string;
  readonly federationId: CareerFederationId | null;
  readonly federationChosen: boolean;
  readonly bestCompetitionTotalKg: number | null;
  readonly enteredMeetId: string | null;
  readonly qualifying: readonly CareerQualifyingRow[];
  readonly history: readonly CareerHistoryEntry[];
  readonly upcoming: readonly CareerUpcomingEntry[];
  readonly nextDecision: CareerNextDecision;
}

export interface CareerPresentationInput {
  readonly today: number;
  readonly federationChosen: boolean;
  readonly enteredMeetId: string | null;
  readonly lifter: CareerLifter | null;
  readonly history: readonly CareerHistoryEntry[];
}

function tierIsLocked(tier: CareerMeetTier): boolean {
  return (CAREER_BETA.LOCKED_TIERS as readonly CareerMeetTier[]).includes(tier);
}

function qualifyingRows(bestTotalKg: number | null): readonly CareerQualifyingRow[] {
  return MEET_TIER_ORDER.map((tier) => {
    const bar = qualifyingTotalKgFor(tier);
    return {
      tier,
      qualifyingTotalKg: bar,
      qualifies: meetsQualifyingTotal(bestTotalKg, bar),
      locked: tierIsLocked(tier),
    };
  });
}

function upcomingRows(lifter: CareerLifter, today: StreakDay): readonly CareerUpcomingEntry[] {
  return upcomingMeets(lifter.federationId, today).map((meet) => {
    const locked = tierIsLocked(meet.tier);
    const verdict = entryVerdict(lifter, meet, today);
    const open = verdict.kind === 'open';
    return {
      meetId: meet.id,
      tier: meet.tier,
      day: meet.day,
      dateIso: meet.dateIso,
      enterable: open && !locked,
      locked,
      refusalReason: verdict.kind === 'refused' ? verdict.reason : null,
    };
  });
}

function nextDecisionFor(
  federationChosen: boolean,
  lifter: CareerLifter | null,
  enteredMeetId: string | null,
  upcoming: readonly CareerUpcomingEntry[],
): CareerNextDecision {
  if (!federationChosen || lifter === null) return { kind: 'choose-federation' };
  if (enteredMeetId !== null) return { kind: 'complete-meet', meetId: enteredMeetId };
  const enterable = upcoming.find((row) => row.enterable);
  if (enterable !== undefined) return { kind: 'enter-meet', meetId: enterable.meetId };
  return { kind: 'train' };
}

/**
 * The Career facts a renderer may bind to, derived from facts the caller
 * already holds. Does not read a clock, a wallet, or an e1RM.
 */
export function careerPresentationFor(input: CareerPresentationInput): CareerPresentationState {
  const today = asStreakDay(input.today);
  const lifter = input.lifter;
  const upcoming = lifter === null ? [] : upcomingRows(lifter, today);
  return {
    day: today,
    dateIso: isoDateOf(today),
    federationId: lifter === null ? null : lifter.federationId,
    federationChosen: input.federationChosen,
    bestCompetitionTotalKg: lifter === null ? null : lifter.bestTotalKg,
    enteredMeetId: input.enteredMeetId,
    qualifying: qualifyingRows(lifter === null ? null : lifter.bestTotalKg),
    history: input.history,
    upcoming,
    nextDecision: nextDecisionFor(input.federationChosen, lifter, input.enteredMeetId, upcoming),
  };
}
