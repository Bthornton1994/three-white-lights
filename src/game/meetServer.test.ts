import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MEET_RULES,
  LIFT_ORDER,
  POUND_MEET_RULES,
  createMeet,
  currentAttemptContext,
  declareAttempt,
  finalMeetTotal,
  readTotal,
  resolveAttempt,
  type JudgePanel,
  type LiftKind,
  type MeetLoadingRules,
  type MeetState,
} from './meet';
import type { MeetAttemptReport, ProposalOfKind } from './progression';
import { asMeetId, asProposalId, receiveProgressionSnapshot } from './progression';
import { newServerRecord, type ServerRecord } from './sessionServer';
import {
  applyMeetResult,
  meetDayFacts,
  placingFor,
  previousBestByLift,
  replayMeetCard,
} from './meetServer';
import { meetAttemptReports, meetResultProposal } from './meetDay';
import { MEET_ENTRY, MEET_LOCAL, MEET_PREVIEW, type MeetDefinition } from './meetTuning';
import { playMeet, previewServerRecord, previewStateFor, type RepStyle } from './meetPreview';
import { SESSION_TUNING } from './sessionTuning';

const DAY = MEET_PREVIEW.DAY;
const PROPOSAL_ID = 'meet-test-1';

function proposalFrom(attempts: readonly MeetAttemptReport[]): ProposalOfKind<'record-meet-result'> {
  return {
    kind: 'record-meet-result',
    report: {
      meetId: asMeetId(MEET_LOCAL.id),
      bodyweightKg: MEET_ENTRY.bodyweightKg,
      attempts,
    },
  };
}

/** A legal, complete card: three made attempts on each lift. */
function cleanCard(
  weights: Readonly<Record<LiftKind, readonly [number, number, number]>> = {
    squat: [200, 210, 220],
    bench: [130, 135, 140],
    deadlift: [240, 250, 260],
  },
  good: (lift: LiftKind, attemptNumber: number) => boolean = () => true,
): MeetAttemptReport[] {
  const out: MeetAttemptReport[] = [];
  for (const lift of LIFT_ORDER) {
    const row = weights[lift];
    ([1, 2, 3] as const).forEach((attemptNumber, index) => {
      out.push({
        lift,
        attemptNumber,
        weightKg: row[index] ?? 0,
        good: good(lift, attemptNumber),
      });
    });
  }
  return out;
}

function applyClean(
  record: ServerRecord = newServerRecord(),
  attempts: readonly MeetAttemptReport[] = cleanCard(),
) {
  return applyMeetResult(record, DAY, MEET_LOCAL, proposalFrom(attempts), PROPOSAL_ID);
}

/** A record with a total already on the board, without going through a meet. */
function recordWithTotal(totalKg: number, meets: ServerRecord['meets'] = []): ServerRecord {
  return { ...newServerRecord(), totalKg, meets };
}

// ---------------------------------------------------------------------------
// The total is RECOMPUTED, not taken from the client
// ---------------------------------------------------------------------------

describe('the total is the server’s arithmetic (GDD §6.4)', () => {
  it('is the sum of the best SUCCESSFUL attempt per lift', () => {
    // The best is deliberately attempt 2 on every lift, so summing the last
    // attempt, the heaviest declared, or all of them each gives a different
    // (wrong) number.
    const attempts = cleanCard(
      { squat: [200, 210, 220], bench: [130, 135, 140], deadlift: [240, 250, 260] },
      (_lift, attemptNumber) => attemptNumber !== 3,
    );
    const applied = applyClean(newServerRecord(), attempts);
    expect(applied.ok).toBe(true);
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.value.totalKg).toBe(210 + 135 + 250);
    expect(applied.value.bestByLiftKg).toEqual({ squat: 210, bench: 135, deadlift: 250 });

    // ...and the numbers a naive implementation would have produced are all
    // different from it, so the assertion above is not a bound three formulas
    // satisfy at once.
    expect(applied.value.totalKg).not.toBe(220 + 140 + 260); // heaviest declared
    expect(applied.value.totalKg).not.toBe(200 + 130 + 240); // openers
  });

  it('equals what the engine says the meet totalled', () => {
    const applied = applyClean();
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.value.totalKg).toBe(finalMeetTotal(applied.value.meet));
  });

  it('matches the total of a meet actually played on screen', () => {
    // End to end: the client plays a meet, reports its attempts, and the server
    // independently reaches the same number by replaying them.
    const played = playMeet((): RepStyle => 'perfect');
    const proposal = meetResultProposal(played);
    expect(proposal).not.toBeNull();
    if (proposal === null) throw new Error('unreachable');
    const applied = applyMeetResult(newServerRecord(), DAY, MEET_LOCAL, proposal, PROPOSAL_ID);
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.value.totalKg).toBe(finalMeetTotal(played.meet));
    expect(applied.value.totalKg).toBeGreaterThan(0);
  });
});

describe('an illegal card is refused, not scored', () => {
  const cases: [string, MeetAttemptReport[]][] = [
    [
      'a weight that goes down within a lift',
      cleanCard({ squat: [200, 190, 220], bench: [130, 135, 140], deadlift: [240, 250, 260] }),
    ],
    [
      'a repeat after a good lift',
      cleanCard({ squat: [200, 200, 220], bench: [130, 135, 140], deadlift: [240, 250, 260] }),
    ],
    [
      'a weight off the declaration grid',
      cleanCard({ squat: [200, 201, 220], bench: [130, 135, 140], deadlift: [240, 250, 260] }),
    ],
    [
      'a weight below the bar',
      cleanCard({ squat: [10, 210, 220], bench: [130, 135, 140], deadlift: [240, 250, 260] }),
    ],
  ];

  for (const [name, attempts] of cases) {
    it(`refuses ${name}`, () => {
      const applied = applyClean(newServerRecord(), attempts);
      expect(applied.ok, name).toBe(false);
      if (applied.ok) throw new Error('unreachable');
      expect(applied.error.code).toBe('MEET_REPLAY_REFUSED');
    });
  }

  it('refuses attempts out of order', () => {
    const ordered = cleanCard();
    const shuffled = [...ordered.slice(3, 6), ...ordered.slice(0, 3), ...ordered.slice(6)];
    const applied = applyClean(newServerRecord(), shuffled);
    expect(applied.ok).toBe(false);
    if (applied.ok) throw new Error('unreachable');
    expect(applied.error.code).toBe('MEET_REPLAY_REFUSED');
  });

  it('refuses a fourth attempt on a lift', () => {
    const attempts = [
      ...cleanCard(),
      { lift: 'deadlift' as const, attemptNumber: 3 as const, weightKg: 270, good: true },
    ];
    const applied = applyClean(newServerRecord(), attempts);
    expect(applied.ok).toBe(false);
    if (applied.ok) throw new Error('unreachable');
    expect(applied.error.code).toBe('MEET_OVERRUN');
  });

  it('refuses attempts reported after a bomb-out', () => {
    const attempts = cleanCard(
      { squat: [200, 200, 200], bench: [130, 135, 140], deadlift: [240, 250, 260] },
      () => false,
    );
    // A bomb-out ends the meet on the squat, so the bench rows have nowhere to
    // go. `meet.ts` decides that, not this module.
    const applied = applyClean(newServerRecord(), attempts);
    expect(applied.ok).toBe(false);
    if (applied.ok) throw new Error('unreachable');
    expect(applied.error.code).toBe('MEET_OVERRUN');
  });

  it('refuses an unfinished card', () => {
    const applied = applyClean(newServerRecord(), cleanCard().slice(0, 5));
    expect(applied.ok).toBe(false);
    if (applied.ok) throw new Error('unreachable');
    expect(applied.error.code).toBe('MEET_INCOMPLETE');
  });

  it('refuses a second result for the same meet', () => {
    const first = applyClean();
    if (!first.ok) throw new Error(first.error.message);
    const second = applyMeetResult(
      first.value.record,
      DAY,
      MEET_LOCAL,
      proposalFrom(cleanCard()),
      PROPOSAL_ID,
    );
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error('unreachable');
    expect(second.error.code).toBe('MEET_ALREADY_RECORDED');
  });

  it('refuses a day that is not a day index', () => {
    const applied = applyMeetResult(
      newServerRecord(),
      Number.NaN,
      MEET_LOCAL,
      proposalFrom(cleanCard()),
      PROPOSAL_ID,
    );
    expect(applied.ok).toBe(false);
    if (applied.ok) throw new Error('unreachable');
    expect(applied.error.code).toBe('BAD_DAY');
  });

  it('accepts the legal card the illegal ones were built from', () => {
    // The positive control. Without it every refusal above could be produced by
    // a function that refused everything.
    expect(applyClean().ok).toBe(true);
    expect(replayMeetCard(MEET_LOCAL, cleanCard()).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Total moves HERE and only here — and nothing else moves with it
// ---------------------------------------------------------------------------

describe('what a meet moves', () => {
  it('raises the total from null on a lifter’s first meet', () => {
    const before = newServerRecord();
    expect(before.totalKg).toBeNull();
    const applied = applyClean(before);
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.value.record.totalKg).toBe(applied.value.totalKg);
    expect(applied.value.isTotalPr).toBe(true);
    expect(applied.value.previousBestTotalKg).toBeNull();
  });

  it('keeps the better total when a later meet is worse', () => {
    const applied = applyClean(recordWithTotal(900));
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.value.totalKg).toBeLessThan(900);
    expect(applied.value.record.totalKg).toBe(900);
    expect(applied.value.isTotalPr).toBe(false);
  });

  it('raises it when a later meet is better', () => {
    const applied = applyClean(recordWithTotal(100));
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.value.record.totalKg).toBe(applied.value.totalKg);
    expect(applied.value.isTotalPr).toBe(true);
  });

  it('leaves e1RM EXACTLY where it was — a meet is not a training session', () => {
    // GDD §2's table grows e1RM from Sim mode, session by session; §6.4 gives a
    // meet a Total, a DOTS score, Career progression and reputation. A meet
    // that moved an e1RM would be the daily loop's payoff arriving on the wrong
    // day. Swept over an enormous meet as well as an ordinary one, because the
    // tempting bug is "a made single IS a 1RM".
    for (const card of [
      cleanCard(),
      cleanCard({ squat: [400, 410, 420], bench: [300, 305, 310], deadlift: [450, 460, 470] }),
    ]) {
      const before = newServerRecord();
      const applied = applyClean(before, card);
      if (!applied.ok) throw new Error(applied.error.message);
      expect(applied.value.record.bestE1rmKg).toEqual(before.bestE1rmKg);
      expect(applied.value.wire.bestE1rmKg).toEqual(before.bestE1rmKg);
    }
  });

  it('leaves the streak, the wallet and the hidden ledger exactly where they were', () => {
    const before = newServerRecord();
    const applied = applyClean(before);
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.value.record.streak).toEqual(before.streak);
    expect(applied.value.record.wallet).toEqual(before.wallet);
    expect(applied.value.record.fatigue).toEqual(before.fatigue);
  });

  it('cannot be changed by a balance — nothing purchasable reaches a total', () => {
    // GDD §8.1 / §12.3: nothing purchasable may affect Total. `applyMeetResult`
    // has no parameter for a purchase, so the behavioural form of that is: two
    // lifters with wildly different balances get the identical result from the
    // identical card.
    const poor = { ...newServerRecord(), wallet: { gymBucks: 0, chalk: 0 } };
    const rich = { ...newServerRecord(), wallet: { gymBucks: 999999, chalk: 999999 } };
    const a = applyClean(poor);
    const b = applyClean(rich);
    if (!a.ok || !b.ok) throw new Error('unreachable');
    expect(a.value.totalKg).toBe(b.value.totalKg);
    expect(a.value.bestByLiftKg).toEqual(b.value.bestByLiftKg);
    expect(a.value.placing).toEqual(b.value.placing);
    expect(a.value.record.wallet).toEqual(poor.wallet);
    expect(b.value.record.wallet).toEqual(rich.wallet);
  });

  it('bumps the revision and appends exactly one meet', () => {
    const before = newServerRecord();
    const applied = applyClean(before);
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.value.record.revision).toBe(before.revision + 1);
    expect(applied.value.record.meets.length).toBe(before.meets.length + 1);
    const stored = applied.value.record.meets[applied.value.record.meets.length - 1];
    expect(stored?.meetId).toBe(MEET_LOCAL.id);
    expect(stored?.meetDayIndex).toBe(DAY);
    expect(stored?.bodyweightKg).toBe(MEET_ENTRY.bodyweightKg);
  });

  it('produces a wire the one door actually accepts', () => {
    const applied = applyClean();
    if (!applied.ok) throw new Error(applied.error.message);
    const received = receiveProgressionSnapshot(applied.value.wire);
    expect(received.ok, received.ok ? '' : received.error.message).toBe(true);
    expect(asProposalId(PROPOSAL_ID)).toBe(applied.value.wire.acknowledgedProposalId);
  });
});

// ---------------------------------------------------------------------------
// Bombing out is not punitive (GDD §6.3, §12.3)
// ---------------------------------------------------------------------------

describe('a bomb-out takes nothing (GDD §12.3)', () => {
  const BOMBED = cleanCard(
    { squat: [200, 200, 200], bench: [130, 135, 140], deadlift: [240, 250, 260] },
    () => false,
  ).slice(0, 3);

  function bombed(record: ServerRecord = newServerRecord()) {
    const applied = applyMeetResult(record, DAY, MEET_LOCAL, proposalFrom(BOMBED), PROPOSAL_ID);
    if (!applied.ok) throw new Error(applied.error.message);
    return applied.value;
  }

  it('records NO total, which is not a total of zero', () => {
    const result = bombed();
    expect(result.totalKg).toBeNull();
    expect(result.bombedLift).toBe('squat');
    const stored = result.record.meets[result.record.meets.length - 1];
    expect(stored?.totalKg).toBeNull();
    expect(stored?.totalKg).not.toBe(0);
    expect(stored?.bestByLift).toEqual({ squat: null, bench: null, deadlift: null });
  });

  it('cannot erase a total the lifter already had', () => {
    // The punitive version of this function sets `totalKg` to this meet's
    // result unconditionally, which on a bomb-out is `null` — a lifter loses
    // their best total by turning up and having a bad day.
    const result = bombed(recordWithTotal(600));
    expect(result.record.totalKg).toBe(600);
    expect(result.isTotalPr).toBe(false);
  });

  it('leaves e1RM, the streak, the wallet and the ledger untouched', () => {
    // This is the sentence `MEET_COPY.BOMB_OUT_KEPT` puts on screen, checked
    // clause by clause against the server rather than trusted as copy.
    const before = recordWithTotal(600);
    const result = bombed(before);
    expect(result.record.bestE1rmKg).toEqual(before.bestE1rmKg);
    expect(result.record.streak).toEqual(before.streak);
    expect(result.record.wallet).toEqual(before.wallet);
    expect(result.record.fatigue).toEqual(before.fatigue);
    expect(result.record.totalKg).toBe(before.totalKg);
  });

  it('does not place the lifter', () => {
    const result = bombed();
    expect(result.placing.place).toBeNull();
    expect(result.placing.fieldSize).toBe(MEET_LOCAL.ghostTotalsKg.length + 1);
  });

  it('is still recorded — the meet happened', () => {
    const result = bombed();
    expect(result.record.meets.length).toBe(1);
    expect(receiveProgressionSnapshot(result.wire).ok).toBe(true);
  });

  it('is what a meet played to a bomb-out on screen produces', () => {
    const played = previewStateFor({ moment: 'bombed' });
    const proposal = meetResultProposal(played);
    if (proposal === null) throw new Error('unreachable');
    const applied = applyMeetResult(newServerRecord(), DAY, MEET_LOCAL, proposal, PROPOSAL_ID);
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.value.totalKg).toBeNull();
    expect(applied.value.bombedLift).toBe('squat');
    expect(applied.value.record.bestE1rmKg).toEqual(newServerRecord().bestE1rmKg);
  });
});

// ---------------------------------------------------------------------------
// PR call-outs and placing (GDD §6.5)
// ---------------------------------------------------------------------------

describe('per-lift competition PRs', () => {
  it('are measured against the lifter’s stored meets, not their e1RM', () => {
    const first = applyClean(newServerRecord(), cleanCard());
    if (!first.ok) throw new Error(first.error.message);
    expect(first.value.liftPrs).toEqual({ squat: true, bench: true, deadlift: true });

    // A second meet, better on the squat only.
    const second = applyMeetResult(
      first.value.record,
      DAY + 1,
      { ...MEET_LOCAL, id: 'local-open-2026-b' },
      {
        kind: 'record-meet-result',
        report: {
          meetId: asMeetId('local-open-2026-b'),
          bodyweightKg: MEET_ENTRY.bodyweightKg,
          attempts: cleanCard({
            squat: [225, 230, 235],
            bench: [125, 130, 135],
            deadlift: [235, 245, 255],
          }),
        },
      },
      'meet-test-2',
    );
    if (!second.ok) throw new Error(second.error.message);
    expect(second.value.liftPrs).toEqual({ squat: true, bench: false, deadlift: false });
  });

  it('read every stored meet, not just the last one', () => {
    const record: ServerRecord = {
      ...newServerRecord(),
      meets: [
        {
          meetId: 'a',
          meetDayIndex: 1,
          totalKg: 600,
          bestByLift: { squat: 250, bench: 130, deadlift: 220 },
          bodyweightKg: 90,
        },
        {
          meetId: 'b',
          meetDayIndex: 2,
          totalKg: 590,
          bestByLift: { squat: 200, bench: 150, deadlift: 240 },
          bodyweightKg: 90,
        },
      ],
    };
    expect(previousBestByLift(record)).toEqual({ squat: 250, bench: 150, deadlift: 240 });
  });

  it('are null-safe on a lifter who has bombed a lift before', () => {
    const record: ServerRecord = {
      ...newServerRecord(),
      meets: [
        {
          meetId: 'a',
          meetDayIndex: 1,
          totalKg: null,
          bestByLift: { squat: null, bench: 130, deadlift: null },
          bodyweightKg: 90,
        },
      ],
    };
    expect(previousBestByLift(record)).toEqual({ squat: null, bench: 130, deadlift: null });
  });
});

describe('placing in the field (GDD §6.5, §6.6)', () => {
  const GHOSTS = [600, 550, 500];

  it('is first above every ghost and last below every ghost', () => {
    expect(placingFor(700, GHOSTS)).toEqual({ place: 1, fieldSize: 4 });
    expect(placingFor(400, GHOSTS)).toEqual({ place: 4, fieldSize: 4 });
  });

  it('counts only the ghosts that actually beat the lifter', () => {
    expect(placingFor(575, GHOSTS).place).toBe(2);
    expect(placingFor(525, GHOSTS).place).toBe(3);
  });

  it('places a tie ahead of the ghost it tied with', () => {
    expect(placingFor(600, GHOSTS).place).toBe(1);
    expect(placingFor(500, GHOSTS).place).toBe(3);
  });

  it('gives a lifter with no total no place at all', () => {
    expect(placingFor(null, GHOSTS)).toEqual({ place: null, fieldSize: 4 });
  });

  it('separates real results on the shipped field', () => {
    // Non-vacuity on the real ghost list: if every ghost were identical, or the
    // list were empty, every meet would place the same and the recap's place
    // cell would be a constant.
    const places = new Set(
      [900, 620, 560, 500, 300].map((total) => placingFor(total, MEET_LOCAL.ghostTotalsKg).place),
    );
    expect(places.size).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// What the client is handed before a meet
// ---------------------------------------------------------------------------

describe('meetDayFacts', () => {
  it('hands over the lifter’s best e1RM, which is what the opener is built from', () => {
    const record: ServerRecord = {
      ...newServerRecord(),
      bestE1rmKg: { squat: 240, bench: 150, deadlift: 280 },
    };
    const facts = meetDayFacts(record, DAY, SESSION_TUNING.STARTING_E1RM_KG);
    expect(facts.bestE1rmKg).toEqual({ squat: 240, bench: 150, deadlift: 280 });
    expect(facts.day).toBe(DAY);
  });

  it('falls back to the onboarding placeholder for a lift with no e1RM yet', () => {
    const record: ServerRecord = {
      ...newServerRecord(),
      bestE1rmKg: { squat: null, bench: 150, deadlift: null },
    };
    const facts = meetDayFacts(record, DAY, SESSION_TUNING.STARTING_E1RM_KG);
    expect(facts.bestE1rmKg.squat).toBe(SESSION_TUNING.STARTING_E1RM_KG.squat);
    expect(facts.bestE1rmKg.bench).toBe(150);
    expect(facts.bestE1rmKg.deadlift).toBe(SESSION_TUNING.STARTING_E1RM_KG.deadlift);
  });

  it('carries the previous best total and the previous per-lift bests', () => {
    const applied = applyClean();
    if (!applied.ok) throw new Error(applied.error.message);
    const facts = meetDayFacts(applied.value.record, DAY + 1, SESSION_TUNING.STARTING_E1RM_KG);
    expect(facts.previousBestTotalKg).toBe(applied.value.totalKg);
    expect(facts.previousBestByLiftKg).toEqual(applied.value.bestByLiftKg);
  });
});

// ---------------------------------------------------------------------------
// The preview lifter is the lifter the preview says they are
// ---------------------------------------------------------------------------

describe('previewServerRecord (DEBUG)', () => {
  it('holds the history previewContext() describes', () => {
    // Without this the preview's stand-in server starts empty, every captured
    // recap reads FIRST TOTAL, and the PR branch — a real screen a player
    // reaches — is unphotographable. The screenshots would be of a lifter the
    // preview data says does not exist.
    const record = previewServerRecord();
    expect(record.totalKg).toBe(MEET_PREVIEW.PREVIOUS_BEST_TOTAL_KG);
    expect(previousBestByLift(record)).toEqual(MEET_PREVIEW.PREVIOUS_BEST_BY_LIFT_KG);
  });

  it('does not collide with the meet about to be recorded', () => {
    // `applyMeetResult` refuses a second result for the same meet, so a prior
    // meet stored under MEET_LOCAL's own id would make every preview recap a
    // null recap — a blank screen, captured as though it were the design.
    const record = previewServerRecord();
    expect(record.meets.every((meet) => meet.meetId !== MEET_LOCAL.id)).toBe(true);
    const played = previewStateFor({ moment: 'recap' });
    const proposal = meetResultProposal(played);
    if (proposal === null) throw new Error('unreachable');
    const applied = applyMeetResult(record, DAY, MEET_LOCAL, proposal, PROPOSAL_ID);
    expect(applied.ok, applied.ok ? '' : applied.error.message).toBe(true);
    if (!applied.ok) throw new Error('unreachable');
    // ...and the meet really is measured against that history rather than
    // against nothing.
    expect(applied.value.previousBestTotalKg).toBe(MEET_PREVIEW.PREVIOUS_BEST_TOTAL_KG);
    expect(applied.value.isTotalPr).toBe(true);
    // Some lifts PR and some do not, which is the point of the numbers being
    // where they are: a preview where every row said PR would photograph a
    // branch that never varies.
    const prs = Object.values(applied.value.liftPrs);
    expect(prs.filter(Boolean).length).toBeGreaterThan(0);
    expect(prs.filter((pr) => !pr).length).toBeGreaterThan(0);
  });

  it('stores a prior meet whose total is the sum of its own bests', () => {
    // A stored meet whose total does not equal its bests is not a meet result,
    // it is two unrelated numbers — and it would make every PR comparison on
    // the preview's recap incoherent.
    const record = previewServerRecord();
    for (const meet of record.meets) {
      const sum = LIFT_ORDER.reduce((total, lift) => total + (meet.bestByLift[lift] ?? 0), 0);
      expect(meet.totalKg, meet.meetId).toBe(sum);
    }
    expect(record.meets.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The client's report cannot carry a total
// ---------------------------------------------------------------------------

describe('the client never sends a total', () => {
  it('has no field for one on any meet the loop can play', () => {
    for (const moment of ['recap', 'bombed'] as const) {
      const state = previewStateFor({ moment });
      const proposal = meetResultProposal(state);
      if (proposal === null) throw new Error('unreachable');
      const keys = new Set(Object.keys(proposal.report));
      expect(keys.has('totalKg')).toBe(false);
      expect([...keys].sort()).toEqual(['attempts', 'bodyweightKg', 'meetId']);
      for (const attempt of meetAttemptReports(state)) {
        expect(Object.keys(attempt).sort()).toEqual([
          'attemptNumber',
          'good',
          'lift',
          'weightKg',
        ]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// THE UNIT BOUNDARY ON THE WRITE PATH
//
// `dots.ts` and `resultCard.ts` both refuse a total they cannot prove is
// kilograms. Both of those run AFTER `applyMeetResult`, so until this section
// existed a pound meet was RECORDED first and refused second: the number was
// already in `record.totalKg`, already in `MeetResultWire.totalKg` (which has no
// unit field to recover it from), and already ranked against a kilogram ghost
// list. A refusal downstream of the write is not a defence of the write.
//
// Nothing below hand-rolls a reading or a card. `POUND_MEET_RULES` is `meet.ts`'s
// own export, it validates, and the attempts are played through `createMeet` ->
// `declareAttempt` -> `resolveAttempt` before they are reported — the same
// real-meet pattern `dots.test.ts` uses, because a boundary test is only worth
// something if the thing on the other side of the boundary is genuine.
// ---------------------------------------------------------------------------

const ALL_WHITE: JudgePanel = ['white', 'white', 'white'];
const ALL_RED: JudgePanel = ['red', 'red', 'red'];

/**
 * The same nine numbers, run under two different sets of rules.
 *
 * DELIBERATELY THE SAME NUMBERS. 442.5 + 280 + 545 = 1267.5 is a legal pound
 * meet on a 45 lb bar AND a legal (enormous) kilogram meet on the 2.5 kg
 * declaration grid, so the pair below differs in exactly one respect: what
 * `rules.unit` says. Nothing about the numbers gives the unit away — that is the
 * whole reason the unit has to travel — and a check that passed one and refused
 * the other on magnitude would be caught by this.
 */
const NINE_ATTEMPTS = [405, 425, 442.5, 265, 275, 280, 500, 525, 545] as const;
const NINE_ATTEMPTS_TOTAL = 442.5 + 280 + 545;

/**
 * Play a real meet and return both the engine's state and the card to report.
 *
 * The reports are built from `currentAttemptContext`, so the lift and attempt
 * number on each row are the ones the engine actually had on deck rather than
 * numbers the test assumed.
 *
 * `MeetAttemptReport.weightKg` holds whatever unit the meet is run in — the
 * field name is the client's claim, not a checked fact, and that mislabelling is
 * exactly what the write path has to refuse rather than believe.
 */
function playCard(
  rules: MeetLoadingRules,
  weights: readonly number[] = NINE_ATTEMPTS,
  good: (index: number) => boolean = () => true,
): { readonly state: MeetState; readonly reports: MeetAttemptReport[] } {
  let state = createMeet(rules);
  const reports: MeetAttemptReport[] = [];
  weights.forEach((weight, index) => {
    const context = currentAttemptContext(state);
    if (context === null) throw new Error(`nothing on deck for ${weight}`);
    const { lift, attemptNumber } = context;
    const declared = declareAttempt(state, { lift, attemptNumber, weight });
    if (!declared.ok) throw new Error(`declare ${weight}: ${declared.error.message}`);
    const made = good(index);
    const resolved = resolveAttempt(declared.value, {
      lift,
      attemptNumber,
      lights: made ? ALL_WHITE : ALL_RED,
    });
    if (!resolved.ok) throw new Error(`resolve ${weight}: ${resolved.error.message}`);
    state = resolved.value;
    reports.push({ lift, attemptNumber, weightKg: weight, good: made });
  });
  return { state, reports };
}

/**
 * The meet a federation running in pounds would ship: `MEET_LOCAL` with
 * `meet.ts`'s own pound rules dropped into `MeetDefinition.rules`.
 *
 * NO CAST, NO PRIVATE SYMBOL, NO HAND-BUILT STATE. `MeetDefinition.rules` is
 * `MeetLoadingRules` and `POUND_MEET_RULES` is an exported, validated one, so
 * this is the second meet definition anyone adds, not an abuse of the type.
 *
 * `ghostTotalsKg` is left exactly as it is, in kilograms, because that is the
 * shape of the real hazard: the definition's own field names stay kg while its
 * rules quietly do not.
 */
const MEET_POUND: MeetDefinition = {
  ...MEET_LOCAL,
  id: 'pound-open-2026',
  rules: POUND_MEET_RULES,
};

function poundProposal(attempts: readonly MeetAttemptReport[]): ProposalOfKind<'record-meet-result'> {
  return {
    kind: 'record-meet-result',
    report: {
      meetId: asMeetId(MEET_POUND.id),
      bodyweightKg: MEET_ENTRY.bodyweightKg,
      attempts,
    },
  };
}

describe('a total that is not in kilograms is refused, not recorded', () => {
  it('is a legal, complete, replayable meet — the refusal is about the UNIT and nothing else', () => {
    // THE NON-VACUITY CONTROL, and it is the one that matters here. Without it,
    // every assertion below could be produced by a card the replay rejected as
    // illegal, and the unit check could be absent.
    const { state, reports } = playCard(POUND_MEET_RULES);
    const replayed = replayMeetCard(MEET_POUND, reports);
    expect(replayed.ok, replayed.ok ? '' : replayed.error.message).toBe(true);
    if (!replayed.ok) throw new Error('unreachable');
    expect(readTotal(replayed.value).kind).toBe('final');
    expect(readTotal(replayed.value).unit).toBe('lb');
    expect(finalMeetTotal(replayed.value)).toBe(NINE_ATTEMPTS_TOTAL);
    expect(finalMeetTotal(state)).toBe(NINE_ATTEMPTS_TOTAL);
  });

  it('refuses to write it', () => {
    const { reports } = playCard(POUND_MEET_RULES);
    const applied = applyMeetResult(newServerRecord(), DAY, MEET_POUND, poundProposal(reports), PROPOSAL_ID);
    expect(applied.ok).toBe(false);
    if (applied.ok) throw new Error('unreachable');
    expect(applied.error.code).toBe('UNSUPPORTED_MEET_UNIT');
    // Not any of the refusals that would mean the card was the problem.
    expect(applied.error.code).not.toBe('MEET_REPLAY_REFUSED');
    expect(applied.error.code).not.toBe('MEET_INCOMPLETE');
  });

  it('leaves the lifter’s record exactly as it found it', () => {
    // A refusal carries no `value`, so there is structurally nothing to write
    // through — but the input must not have been mutated on the way to the
    // refusal either.
    const before = newServerRecord();
    const snapshot = structuredClone(before);
    const { reports } = playCard(POUND_MEET_RULES);
    applyMeetResult(before, DAY, MEET_POUND, poundProposal(reports), PROPOSAL_ID);
    expect(before).toEqual(snapshot);
    expect(before.totalKg).toBeNull();
    expect(before.meets).toEqual([]);
  });

  it('does not convert — the refusal is the whole answer', () => {
    // Converting the total while trusting `bodyweightKg` would be a different
    // wrong number written permanently. If a future version ever starts
    // converting, this fails: a converted 1267.5 lb is 574.9 kg, and there is no
    // result object for it to arrive in.
    const { reports } = playCard(POUND_MEET_RULES);
    const applied = applyMeetResult(newServerRecord(), DAY, MEET_POUND, poundProposal(reports), PROPOSAL_ID);
    expect(applied).not.toHaveProperty('value');
    expect(applied.ok).toBe(false);
  });

  it('refuses a bombed pound meet too, where there is no total at all', () => {
    // `dots.ts`'s posture, applied to the write: the check runs on every reading
    // kind, so a caller wired to a pound meet finds out on the first meet it
    // records rather than on the first one that finishes with a total. A defect
    // that only fires on success is the worst kind to ship.
    const { reports } = playCard(POUND_MEET_RULES, [405, 425, 425], () => false);
    const applied = applyMeetResult(newServerRecord(), DAY, MEET_POUND, poundProposal(reports), PROPOSAL_ID);
    expect(applied.ok).toBe(false);
    if (applied.ok) throw new Error('unreachable');
    expect(applied.error.code).toBe('UNSUPPORTED_MEET_UNIT');
  });

  it('would have placed the lb total first in a kg field, which is the harm', () => {
    // Stated as a number so the refusal is not abstract: 1267.5 beats every
    // ghost in `MEET_LOCAL.ghostTotalsKg` (top ghost 632.5) and would have
    // written a world-record-shaped total onto a lifter who squatted 442.5 lb.
    expect(NINE_ATTEMPTS_TOTAL).toBeGreaterThan(Math.max(...MEET_LOCAL.ghostTotalsKg));
    expect(placingFor(NINE_ATTEMPTS_TOTAL, MEET_LOCAL.ghostTotalsKg).place).toBe(1);
  });

  it('names the unit, and names the remedy rather than just saying no', () => {
    const { reports } = playCard(POUND_MEET_RULES);
    const applied = applyMeetResult(newServerRecord(), DAY, MEET_POUND, poundProposal(reports), PROPOSAL_ID);
    if (applied.ok) throw new Error('unreachable');
    expect(applied.error.message).toContain('lb');
    expect(applied.error.message).toContain('kilogramsFromPounds');
  });
});

describe('the kilogram write path is untouched by the unit check', () => {
  it('records the SAME NINE NUMBERS when the meet is run in kg', () => {
    // THE POSITIVE CONTROL FOR THE REFUSAL ABOVE. Identical weights, identical
    // reported card, identical everything except `rules.unit` — so a check that
    // refused on the magnitude, on the decimal, or on anything other than the
    // unit would fail here.
    const kgMeet: MeetDefinition = { ...MEET_LOCAL, id: 'kg-twin-2026', rules: DEFAULT_MEET_RULES };
    const { reports } = playCard(DEFAULT_MEET_RULES);
    const applied = applyMeetResult(
      newServerRecord(),
      DAY,
      kgMeet,
      {
        kind: 'record-meet-result',
        report: {
          meetId: asMeetId(kgMeet.id),
          bodyweightKg: MEET_ENTRY.bodyweightKg,
          attempts: reports,
        },
      },
      PROPOSAL_ID,
    );
    expect(applied.ok, applied.ok ? '' : applied.error.message).toBe(true);
    if (!applied.ok) throw new Error('unreachable');
    expect(applied.value.totalKg).toBe(NINE_ATTEMPTS_TOTAL);
    expect(applied.value.record.totalKg).toBe(NINE_ATTEMPTS_TOTAL);
    const stored = applied.value.record.meets[applied.value.record.meets.length - 1];
    expect(stored?.totalKg).toBe(NINE_ATTEMPTS_TOTAL);
    expect(receiveProgressionSnapshot(applied.value.wire).ok).toBe(true);
  });

  it('still records the shipped meet, which is the one the game actually plays', () => {
    expect(MEET_LOCAL.rules.unit).toBe('kg');
    const applied = applyClean();
    expect(applied.ok, applied.ok ? '' : applied.error.message).toBe(true);
    if (!applied.ok) throw new Error('unreachable');
    expect(applied.value.record.totalKg).toBe(applied.value.totalKg);
    expect(applied.value.totalKg).toBeGreaterThan(0);
  });

  it('still records a kilogram bomb-out, which has no total to check the unit of', () => {
    // The 'no-total' reading carries a unit too, so the check runs on it. A
    // kilogram bomb-out must still pass it and still be recorded — GDD §12.3:
    // a bomb-out is not punitive, and a unit check that swallowed it would be.
    const bombed = cleanCard(
      { squat: [200, 200, 200], bench: [130, 135, 140], deadlift: [240, 250, 260] },
      () => false,
    ).slice(0, 3);
    const applied = applyMeetResult(newServerRecord(), DAY, MEET_LOCAL, proposalFrom(bombed), PROPOSAL_ID);
    expect(applied.ok, applied.ok ? '' : applied.error.message).toBe(true);
    if (!applied.ok) throw new Error('unreachable');
    expect(applied.value.totalKg).toBeNull();
    expect(applied.value.record.meets.length).toBe(1);
  });
});
