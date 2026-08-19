/**
 * careerSurface.test.ts — the Career surface's read models, the beta lock, the
 * optimistic `choose-federation` path end to end, and the day-scale
 * measurement Sprint 1b was briefed to settle.
 */

import { describe, expect, it } from 'vitest';

import {
  CAREER_BETA,
  CAREER_COPY,
  CAREER_FEDERATIONS,
  CAREER_TUNING,
  MEET_TIER_ORDER,
} from '../career/careerTuning';
import { nextMeetOfTier, seasonAnchorDay, upcomingMeets } from '../career/calendar';
import { rulesetLabel } from '../career/federation';
import { federationFromCache } from '../game/careerClient';
import { applyMeetResult } from '../game/meetServer';
import { MEET_ENTRY, MEET_LOCAL } from '../game/meetTuning';
import {
  asMeetId,
  asProposalId,
  emptyProgressionCache,
  type ProposalOfKind,
} from '../game/progression';
import { newServerRecord, type ServerRecord } from '../game/sessionServer';
import { openingCache } from '../game/sessionClient';
import { SESSION_BOUNDARY } from '../game/sessionTuning';
import { addDays, asStreakDay, streakDayFromLocalWallClock } from '../game/streak';
import { localSessionServer } from '../session/localSessionServer';
import {
  cacheAfterChoiceResponse,
  cacheWithChoicePending,
  careerCalendarRows,
  careerRecapLines,
  careerSurfacePhase,
  federationChoiceOptions,
  federationChoiceProposal,
  refusalSentence,
} from './careerSurface';

/** A stand-in server that answers on the microtask queue, not a timer. */
const INSTANT = { latencyMs: 0, sleep: () => Promise.resolve() } as const;

/**
 * A fixed day for calendar reads: one year past the season anchor, so every
 * assertion about verdicts is deterministic whatever wall clock runs the
 * suite. 364 is a multiple of every tier's cadence-modulo-week, so this day is
 * itself a local meet day (phase 0) — which the enterable-today claim uses.
 */
const A_YEAR_IN = addDays(seasonAnchorDay(), CAREER_TUNING.HORIZON_DAYS);

describe('the chooser’s options', () => {
  it('are federation.ts’s own data: four federations, labelled by its own rule', () => {
    const options = federationChoiceOptions();
    expect(options.map((option) => option.id)).toEqual(
      CAREER_FEDERATIONS.map((federation) => federation.id),
    );
    expect(options.map((option) => option.name)).toEqual(
      CAREER_FEDERATIONS.map((federation) => federation.name),
    );
    // The ruleset text is `rulesetLabel`'s composition, not a second copy.
    for (const [index, option] of options.entries()) {
      const federation = CAREER_FEDERATIONS[index];
      expect(option.rulesetText).toBe(rulesetLabel(federation!.ruleset));
    }
    // ...and the label really carries both GDD §2.1 axes, so the four cards
    // are distinguishable: four ids, four names, four ruleset texts.
    expect(new Set(options.map((option) => option.rulesetText)).size).toBe(options.length);
  });
});

describe('which screen is up', () => {
  it('gates the calendar on `chosen`, exactly as the 1a handoff states', () => {
    // No snapshot: the chooser (whose taps cannot land — proposeChange
    // refuses empty truth — but the honest screen is still the choice).
    expect(careerSurfacePhase(emptyProgressionCache())).toBe('choosing');
    // A fresh lifter carries the seeded default with `chosen: false`.
    const cache = openingCache(localSessionServer(INSTANT));
    expect(federationFromCache(cache)).toEqual({
      id: CAREER_TUNING.DEFAULT_FEDERATION_ID,
      chosen: false,
    });
    expect(careerSurfacePhase(cache)).toBe('choosing');
  });
});

describe('the calendar rows', () => {
  it('are null before the first snapshot, like every career read model', () => {
    expect(careerCalendarRows(emptyProgressionCache(), A_YEAR_IN)).toBeNull();
  });

  it('draw one row per rung of GDD §6.1’s ladder, in ladder order, soonest of each tier', () => {
    const cache = openingCache(localSessionServer(INSTANT));
    const rows = careerCalendarRows(cache, A_YEAR_IN);
    expect(rows).not.toBeNull();
    expect(rows!.map((row) => row.tier)).toEqual([...MEET_TIER_ORDER]);
    // Each row is the SOONEST meet of its tier — cross-checked against the
    // calendar module's own `nextMeetOfTier`, not re-derived here.
    for (const row of rows!) {
      const soonest = nextMeetOfTier(CAREER_TUNING.DEFAULT_FEDERATION_ID, row.tier, A_YEAR_IN);
      expect(soonest, row.tier).not.toBeNull();
      expect(row.dateIso, row.tier).toBe(soonest!.dateIso);
      expect(row.meetName, row.tier).toBe(soonest!.name);
    }
  });

  it('a fresh lifter: local is OPEN today, the gated rungs carry the server’s sentence', () => {
    const cache = openingCache(localSessionServer(INSTANT));
    const rows = careerCalendarRows(cache, A_YEAR_IN)!;
    const byTier = new Map(rows.map((row) => [row.tier, row]));

    const local = byTier.get('local')!;
    expect(local.enterable).toBe(true);
    expect(local.badge).toBe(CAREER_COPY.OPEN_ENTRY_BADGE);
    expect(local.detail).toBeNull();
    expect(local.qualifyingLine).toBe(CAREER_COPY.NO_QUALIFYING_TOTAL_NEEDED);

    // The three campaign rungs above local: refused, with the sentence the
    // eligibility module keyed to the reason — never re-derived here.
    for (const tier of ['regional', 'nationals', 'campaign-worlds'] as const) {
      const row = byTier.get(tier)!;
      expect(row.enterable, tier).toBe(false);
      expect(row.badge, tier).toBeNull();
      expect(row.detail, tier).toBe(CAREER_COPY.ENTRY_REFUSAL.BELOW_QUALIFYING_TOTAL);
      expect(row.locked, tier).toBe(false);
      // The gate drawn is the MEET's own figure, formatted by the one
      // formatter the result card uses.
      expect(row.qualifyingLine, tier).toBe(
        `${CAREER_COPY.QUALIFYING_LABEL} ${CAREER_TUNING.QUALIFYING_TOTAL_KG[tier]} kg`,
      );
    }

    const ceiling = byTier.get('competitive-worlds')!;
    expect(ceiling.locked).toBe(true);
    expect(ceiling.enterable).toBe(false);
    expect(ceiling.badge).toBe(CAREER_COPY.CEILING_LOCKED_BADGE);
    expect(ceiling.detail).toBe(CAREER_COPY.CEILING_LOCKED_LINE);
  });

  it('GDD §10.0’s lock is presentation over the verdict, NOT eligibility — an open verdict still draws locked', () => {
    // A lifter strong enough that `entryVerdict` answers `open` for the
    // competitive summit, built through the real write path: one banked meet
    // totalling past the 650 gate.
    const signup = SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY;
    const proposal: ProposalOfKind<'record-meet-result'> = {
      kind: 'record-meet-result',
      report: {
        meetId: asMeetId(MEET_LOCAL.id),
        bodyweight: MEET_ENTRY.bodyweight,
        card: {
          unit: 'kg',
          kilogramAttempts: [
            { lift: 'squat', attemptNumber: 1, weight: 200, good: true },
            { lift: 'squat', attemptNumber: 2, weight: 220, good: true },
            { lift: 'squat', attemptNumber: 3, weight: 240, good: true },
            { lift: 'bench', attemptNumber: 1, weight: 130, good: true },
            { lift: 'bench', attemptNumber: 2, weight: 150, good: true },
            { lift: 'bench', attemptNumber: 3, weight: 165, good: true },
            { lift: 'deadlift', attemptNumber: 1, weight: 220, good: true },
            { lift: 'deadlift', attemptNumber: 2, weight: 240, good: true },
            { lift: 'deadlift', attemptNumber: 3, weight: 250, good: true },
          ],
        },
      },
    };
    const applied = applyMeetResult(
      newServerRecord(signup),
      addDays(asStreakDay(signup), 1),
      MEET_LOCAL,
      proposal,
      'career-surface-qualified-lifter',
    );
    expect(applied.ok, applied.ok ? '' : applied.error.message).toBe(true);
    if (!applied.ok) throw new Error('unreachable');
    const record: ServerRecord = applied.value.record;
    expect(record.totalKg).toBe(655);

    const cache = openingCache(localSessionServer({ ...INSTANT, record }));
    const rows = careerCalendarRows(cache, A_YEAR_IN)!;
    const byTier = new Map(rows.map((row) => [row.tier, row]));

    // NON-VACUITY: the lifter really does clear every gate — the campaign
    // summit reads OPEN — so the ceiling's lock below is deciding something.
    expect(byTier.get('campaign-worlds')!.enterable).toBe(true);
    expect(byTier.get('campaign-worlds')!.badge).toBe(CAREER_COPY.OPEN_ENTRY_BADGE);

    const ceiling = byTier.get('competitive-worlds')!;
    expect(ceiling.locked).toBe(true);
    expect(ceiling.enterable, 'GDD §10.0: competitive worlds is never enterable in the beta').toBe(
      false,
    );
    expect(ceiling.badge).toBe(CAREER_COPY.CEILING_LOCKED_BADGE);
    expect(ceiling.detail).toBe(CAREER_COPY.CEILING_LOCKED_LINE);
    // ...and the locked list this presentation reads is exactly the ruled one.
    expect([...CAREER_BETA.LOCKED_TIERS]).toEqual(['competitive-worlds']);
  });
});

describe('the optimistic choose-federation path, end to end', () => {
  it('parks the proposal, sends it, and settles into a chosen federation', async () => {
    const port = localSessionServer(INSTANT);
    const cache = openingCache(port);
    const proposal = federationChoiceProposal('ironline');
    const proposalId = asProposalId('career-surface-choice-1');

    const pending = cacheWithChoicePending(cache, proposal, proposalId);
    expect(pending, 'confirmed truth accepts a choice proposal').not.toBeNull();
    expect(pending!.status).toBe('pending');
    // A second tap during the round trip is refused by the cache itself.
    expect(cacheWithChoicePending(pending!, proposal, asProposalId('career-surface-choice-1b'))).toBeNull();
    // ...and an empty cache refuses outright — the chooser with no snapshot.
    expect(cacheWithChoicePending(emptyProgressionCache(), proposal, proposalId)).toBeNull();

    const response = await port.chooseFederation(proposal, proposalId);
    expect(response.kind).toBe('chosen');
    expect(refusalSentence(response)).toBeNull();

    const settled = cacheAfterChoiceResponse(pending!, proposalId, response, port.openingSnapshot());
    expect(settled.status).toBe('confirmed');
    expect(federationFromCache(settled)).toEqual({ id: 'ironline', chosen: true });
    expect(careerSurfacePhase(settled), 'the calendar gate opens').toBe('calendar');
    // The calendar the chosen federation draws is the chosen federation's.
    const rows = careerCalendarRows(settled, A_YEAR_IN)!;
    expect(rows[0]!.meetName).toContain('Ironline');
  });

  it('a refusal renders the server’s sentence and leaves the chooser retryable — not a dead end', async () => {
    const port = localSessionServer(INSTANT);
    const first = federationChoiceProposal('ironline');
    const firstId = asProposalId('career-surface-refusal-1');
    let cache = cacheWithChoicePending(openingCache(port), first, firstId)!;
    cache = cacheAfterChoiceResponse(cache, firstId, await port.chooseFederation(first, firstId), port.openingSnapshot());
    expect(federationFromCache(cache)).toEqual({ id: 'ironline', chosen: true });

    // The second choice: GDD §2.1 hands the pick out once, so the server
    // refuses it — driven through the same optimistic machinery.
    const second = federationChoiceProposal('meridian');
    const secondId = asProposalId('career-surface-refusal-2');
    const pending = cacheWithChoicePending(cache, second, secondId);
    expect(pending, 'confirmed truth accepts the proposal; the SERVER is what refuses').not.toBeNull();

    const response = await port.chooseFederation(second, secondId);
    expect(response.kind).toBe('refused');
    if (response.kind !== 'refused') throw new Error('unreachable');
    expect(response.error.code).toBe('FEDERATION_ALREADY_CHOSEN');
    // The sentence a screen draws is the server's, verbatim.
    expect(refusalSentence(response)).toBe(response.error.message);
    expect(response.error.message).toContain('already chose');

    const settled = cacheAfterChoiceResponse(pending!, secondId, response, port.openingSnapshot());
    // Truth is untouched — the refusal moved nothing.
    expect(federationFromCache(settled)).toEqual({ id: 'ironline', chosen: true });
    // AND THE CHOOSER IS NOT A DEAD END: the settle path refreshes the cache
    // back to confirmed truth, so a new proposal is accepted. Without the
    // refresh the cache stays stale and `ACCEPT_PROPOSALS_WHILE_STALE: false`
    // refuses every retry — measured by the reddening edit below.
    expect(settled.status).toBe('confirmed');
    expect(
      cacheWithChoicePending(settled, federationChoiceProposal('ironline'), asProposalId('career-surface-refusal-3')),
      'a refusal must leave the chooser able to propose again',
    ).not.toBeNull();
  });
});

describe('the recap career lines (GDD §6.5)', () => {
  it('draw the standing best and the newly qualified tiers from the server outcome', () => {
    const lines = careerRecapLines({
      bestTotalKgBefore: 500,
      bestTotalKgAfter: 612.5,
      isCareerBestTotal: true,
      newlyQualifiedTiers: ['nationals', 'campaign-worlds'],
    });
    expect(lines).toEqual([
      { kind: 'career-best', text: `${CAREER_COPY.RECAP_CAREER_BEST_LABEL} 612.5 kg` },
      {
        kind: 'qualified',
        text: `${CAREER_COPY.RECAP_QUALIFIED_PREFIX} ${CAREER_COPY.TIER_LABEL.nationals} · ${CAREER_COPY.TIER_LABEL['campaign-worlds']}`,
      },
    ]);
  });

  it('an outcome that unlocked nothing draws the best alone; no best draws nothing', () => {
    expect(
      careerRecapLines({
        bestTotalKgBefore: 612.5,
        bestTotalKgAfter: 612.5,
        isCareerBestTotal: false,
        newlyQualifiedTiers: [],
      }),
    ).toEqual([{ kind: 'career-best', text: `${CAREER_COPY.RECAP_CAREER_BEST_LABEL} 612.5 kg` }]);
    expect(
      careerRecapLines({
        bestTotalKgBefore: null,
        bestTotalKgAfter: null,
        isCareerBestTotal: false,
        newlyQualifiedTiers: [],
      }),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The day-scale measurement (Sprint 1b, Piece 0)
// ---------------------------------------------------------------------------

describe('the calendar draws on the day the app actually resolves', () => {
  it('the 1a arithmetic is real: from the SIGNUP day, the default horizon holds nothing', () => {
    // `LOCAL_SERVER_SIGNUP_DAY` (20000, 2024-10-04) sits 456 days before the
    // season anchor (2026-01-03), and the default horizon is 364 — so a
    // calendar wired with the signup day as "today" would draw nothing. This
    // pin keeps that measurement true in the tree so the conclusion below
    // stays legible: the SIGNUP day is not the day a calendar is wired with.
    expect(seasonAnchorDay() - SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY).toBeGreaterThan(
      CAREER_TUNING.HORIZON_DAYS,
    );
    expect(
      upcomingMeets(
        CAREER_TUNING.DEFAULT_FEDERATION_ID,
        asStreakDay(SESSION_BOUNDARY.LOCAL_SERVER_SIGNUP_DAY),
      ),
    ).toEqual([]);
  });

  it('...and the app’s day is the WALL CLOCK’s, which sits at or past the anchor for good', () => {
    // A DELIBERATE REAL-CLOCK READ, flagged as such. The subject of this test
    // is precisely "the shipped season anchor is in the app's past": `useCareer`
    // resolves today with `streakDayFromLocalWallClock`, the same edge
    // `useSession` and `useMeetDay` use, and the anchor is a fixed civil date
    // (2026-01-03) that the wall clock crossed and can never un-cross. If this
    // test is red, the machine's clock is set before 2026 — and the calendar
    // really would draw nothing, which is exactly what it should say.
    const now = new Date();
    const today = streakDayFromLocalWallClock({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
    });
    expect(today).toBeGreaterThanOrEqual(seasonAnchorDay());

    // The consequence a player meets: on the app's own resolved day, every
    // rung of the ladder has a row inside the default horizon — no cadence
    // exceeds `HORIZON_DAYS`, so this holds on EVERY day at or past the
    // anchor, not only today's.
    const rows = careerCalendarRows(openingCache(localSessionServer(INSTANT)), today);
    expect(rows!.map((row) => row.tier)).toEqual([...MEET_TIER_ORDER]);
    for (const tier of MEET_TIER_ORDER) {
      expect(CAREER_TUNING.CADENCE_DAYS[tier], tier).toBeLessThanOrEqual(
        CAREER_TUNING.HORIZON_DAYS,
      );
    }
  });
});
