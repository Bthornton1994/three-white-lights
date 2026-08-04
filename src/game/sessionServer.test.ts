import { describe, expect, it } from 'vitest';

import {
  applyTrainingSession,
  bestE1rmFromSets,
  fatigueRecordFor,
  newServerRecord,
  serverE1rmForSet,
  snapshotWireFor,
  todayForLifter,
  type ServerRecord,
} from './sessionServer';
import { SESSION_PROGRESSION_GUARD, SESSION_TUNING } from './sessionTuning';
import {
  applyServerSnapshot,
  asProposalId,
  emptyProgressionCache,
  isConfirmedReading,
  proposeChange,
  readBestE1rmKg,
  readStreakDays,
  readTotalKg,
  readingValue,
  receiveProgressionSnapshot,
  type ProposalOfKind,
  type TrainingSetReport,
} from './progression';
import { LIFT_ORDER, type LiftKind } from './meet';
import { UNLUCKIEST_ROLLS, LUCKIEST_ROLLS } from './fatigue';
import {
  createSession,
  liftForDay,
  nextBestE1rm,
  sessionE1rmFrom,
  sessionProjection,
  sessionProposal,
  stepSession,
  type SessionState,
} from './session';
import type { ReadinessCheckIn } from './fatigue';

const WALL_CLOCK = { year: 2026, month: 8, day: 3, hour: 19 };
const NEUTRAL: ReadinessCheckIn = { sleep: 'ok', soreness: 'normal', motivation: 'steady' };
const PRIMED: ReadinessCheckIn = { sleep: 'good', soreness: 'fresh', motivation: 'fired-up' };

function proposalOf(sets: readonly TrainingSetReport[]): ProposalOfKind<'record-training-session'> {
  return { kind: 'record-training-session', report: { deviceWallClock: WALL_CLOCK, sets } };
}

function set(
  lift: LiftKind,
  weightKg: number,
  reps: number,
  rpe: number,
): TrainingSetReport {
  return { lift, weightKg, reps, rpe };
}

/** A session played end to end against a stored record, all reps made. */
function playAgainst(
  record: ServerRecord,
  day: number,
  answers: ReadinessCheckIn,
  rpe: number,
): { readonly state: SessionState; readonly lift: LiftKind } {
  const lift = liftForDay(day);
  const today = todayForLifter(record, day, lift);
  let state = createSession({
    day,
    lift,
    e1rmKg: today.e1rmKg,
    bestE1rmKg: today.bestE1rmKg,
    streakBefore: today.streakBefore,
    streakIfTrainedToday: today.streakIfTrainedToday,
    fatigue: today.fatigue,
  });
  state = stepSession(state, { kind: 'check-in-tap', tap: { question: 'sleep', answer: answers.sleep } });
  state = stepSession(state, {
    kind: 'check-in-tap',
    tap: { question: 'soreness', answer: answers.soreness },
  });
  state = stepSession(state, {
    kind: 'check-in-tap',
    tap: { question: 'motivation', answer: answers.motivation },
  });
  state = stepSession(state, { kind: 'choose-rpe', rpe });
  let guard = 0;
  while (state.phase !== 'close-out' && guard < 200) {
    guard += 1;
    state =
      state.phase === 'rest'
        ? stepSession(state, { kind: 'begin-set' })
        : stepSession(state, { kind: 'rep-resolved', outcome: 'good-lift' });
  }
  return { state, lift };
}

// ---------------------------------------------------------------------------

describe('a new lifter', () => {
  it('starts with the onboarding placeholders, no meets and no Total', () => {
    const record = newServerRecord();
    expect(record.totalKg).toBeNull();
    expect(record.meets).toEqual([]);
    expect(record.streak.currentStreak).toBe(0);
    // Hand-written from SESSION_TUNING's own note, not read back off it.
    expect(record.bestE1rmKg.squat).toBe(180);
    expect(record.bestE1rmKg.bench).toBe(120);
    expect(record.bestE1rmKg.deadlift).toBe(220);
    expect(record.streak.recoveryDayBalance).toBe(3);
  });

  it('produces a wire the one door in progression.ts accepts', () => {
    const received = receiveProgressionSnapshot(snapshotWireFor(newServerRecord(), null));
    expect(received.ok).toBe(true);
  });

  it('does not put the hidden fatigue ledger on the wire — GDD §3.4, §12.3', () => {
    const injured = applyTrainingSession(
      newServerRecord(),
      1,
      proposalOf([set('bench', 200, 3, 10), set('bench', 200, 3, 10), set('bench', 200, 3, 10)]),
      'p',
      UNLUCKIEST_ROLLS,
    );
    expect(injured.ok).toBe(true);
    if (!injured.ok) return;
    expect(injured.value.record.fatigue.sessions.length).toBeGreaterThan(0);
    const json = JSON.stringify(injured.value.wire);
    expect(json).not.toMatch(/fatigue|strain|burden|injur/i);
  });
});

describe('deriving e1RM from what was reported', () => {
  it('reads it off the published chart, per lift, best ESTIMATE wins', () => {
    const best = bestE1rmFromSets([
      set('squat', 180, 3, 8),
      set('squat', 190, 3, 10),
      set('bench', 100, 5, 9),
    ]);
    // Hand-written from the chart: 3@8 = 86.3%, 3@10 = 92.2%, 5@9 = 83.7%.
    // The HEAVIER squat set is the WORSE estimate — 190/0.922 = 206.07 against
    // 180/0.863 = 208.57 — so this also shows the best set is chosen by what it
    // implies rather than by what was on the bar.
    expect(best.squat).toBeCloseTo(208.5747, 4);
    expect(best.squat).toBeCloseTo(180 / 0.863, 8);
    expect(190 / 0.922).toBeLessThan(180 / 0.863);
    expect(best.bench).toBeCloseTo(100 / 0.837, 8);
    expect(best.deadlift).toBeNull();
  });

  it('SKIPS a set the published chart refuses rather than inventing one', () => {
    // 13 reps @ RPE 6 is an effective rep max of 17. `e1rm.ts` refuses past 16
    // and will not join a second formula onto the top of the chart.
    const best = bestE1rmFromSets([set('squat', 100, 13, 6)]);
    expect(best.squat).toBeNull();
    // And a session made only of such sets moves nothing.
    const applied = applyTrainingSession(
      newServerRecord(),
      0,
      proposalOf([set('squat', 100, 13, 6)]),
      'p',
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.record.bestE1rmKg.squat).toBe(180);
    expect(applied.value.isPr).toBe(false);
    // But the day still counts. Showing up is never punished (GDD §12.3).
    expect(applied.value.streakAfter).toBe(1);
  });

  it('is the SAME call into e1rm.ts the client makes — one curve, not two', () => {
    const sets = [set('squat', 172.5, 3, 8), set('squat', 172.5, 1, 10)];
    const client = sessionE1rmFrom(sets);
    const server = bestE1rmFromSets(sets).squat;
    expect(client).not.toBeNull();
    expect(server).not.toBeNull();
    expect(client).toBeCloseTo(server ?? Number.NaN, 6);
    expect(serverE1rmForSet(sets[0]!)).toBeCloseTo(172.5 / 0.863, 8);
  });
});

describe('nextBestE1rm', () => {
  it('never falls, so a bad day cannot cost a lifter their number', () => {
    expect(nextBestE1rm(200, 150)).toBe(200);
    expect(nextBestE1rm(200, null)).toBe(200);
    expect(nextBestE1rm(200, 200)).toBe(200);
  });

  it('takes the first estimate when there is nothing on record', () => {
    expect(nextBestE1rm(null, 150)).toBe(150);
    expect(nextBestE1rm(null, null)).toBeNull();
  });

  it('caps one session’s gain', () => {
    // Hand-written: 6% of 200 is 12, so 212 is the ceiling.
    expect(SESSION_PROGRESSION_GUARD.MAX_E1RM_GAIN_FRACTION_PER_SESSION).toBe(0.06);
    expect(nextBestE1rm(200, 500)).toBe(212);
    expect(nextBestE1rm(200, 205)).toBe(205);
  });

  it('the cap does not bind on anything this loop can produce', () => {
    // The largest honest jump is the readiness nudge at `primed`, +5%. If the
    // cap ever starts biting on a real session the close-out would show a
    // number the maths does not support, so this is a real check and not a
    // restatement of the constant.
    const record = newServerRecord();
    const played = playAgainst(record, 0, PRIMED, 10);
    const closeOut = played.state.closeOut!;
    const held = record.bestE1rmKg[played.lift]!;
    expect(closeOut.sessionE1rmKg).not.toBeNull();
    expect(nextBestE1rm(held, closeOut.sessionE1rmKg)).toBe(closeOut.sessionE1rmKg);
  });
});

describe('applying a training session', () => {
  it('moves the streak and the trained lift’s e1RM', () => {
    const record = newServerRecord();
    const applied = applyTrainingSession(
      record,
      10,
      // 160 x 3 @ RPE 8 implies 160 / 0.863 = 185.3998, a 3.0% gain on the
      // starting 180 — inside the guard, so this measures the e1RM path rather
      // than the cap.
      proposalOf([set('squat', 160, 3, 8)]),
      'p-1',
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.streakAfter).toBe(1);
    expect(applied.value.isPr).toBe(true);
    expect(applied.value.record.bestE1rmKg.squat).toBeCloseTo(185.3998, 4);
    expect(applied.value.record.bestE1rmKg.bench).toBe(120);
    expect(applied.value.record.revision).toBe(1);
  });

  it('holds the gain at the guard when a session claims an absurd jump', () => {
    // 200 x 3 @ RPE 8 implies 231.75, a 28.7% gain on the starting 180. The
    // guard holds it at 180 x 1.06.
    const applied = applyTrainingSession(
      newServerRecord(),
      10,
      proposalOf([set('squat', 200, 3, 8)]),
      'p-1',
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.record.bestE1rmKg.squat).toBeCloseTo(190.8, 6);
  });

  it('NEVER MOVES THE TOTAL — GDD §2, §3.2, §6.4', () => {
    // Swept over every lift, every rung, and both a fresh lifter and one who
    // already has a Total on record from a meet.
    const withMeet: ServerRecord = { ...newServerRecord(), totalKg: 500 };
    let day = 0;
    for (const record of [newServerRecord(), withMeet]) {
      for (const lift of LIFT_ORDER) {
        for (const rpe of SESSION_TUNING.RPE_CHOICES) {
          day += 1;
          const applied = applyTrainingSession(
            record,
            day,
            proposalOf([set(lift, 150, 3, rpe)]),
            `p-${day}`,
          );
          expect(applied.ok).toBe(true);
          if (!applied.ok) continue;
          expect(applied.value.record.totalKg).toBe(record.totalKg);
          expect(applied.value.wire.totalKg).toBe(record.totalKg);
        }
      }
    }
    expect(day).toBe(30);
  });

  it('refuses a second session on the same day — GDD §3.2, one a day', () => {
    const first = applyTrainingSession(
      newServerRecord(),
      5,
      proposalOf([set('squat', 150, 3, 8)]),
      'p-1',
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyTrainingSession(
      first.value.record,
      5,
      proposalOf([set('squat', 150, 3, 8)]),
      'p-2',
    );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('STREAK_REFUSED');
  });

  it('refuses a session that trains more than one lift', () => {
    const mixed = applyTrainingSession(
      newServerRecord(),
      5,
      proposalOf([set('squat', 150, 3, 8), set('bench', 100, 3, 8)]),
      'p-1',
    );
    expect(mixed.ok).toBe(false);
    if (mixed.ok) return;
    expect(mixed.error.code).toBe('MIXED_LIFTS');
  });

  it('refuses a day that is not a day', () => {
    const bad = applyTrainingSession(
      newServerRecord(),
      0.5,
      proposalOf([set('squat', 150, 3, 8)]),
      'p-1',
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.error.code).toBe('BAD_DAY');
  });

  it('ignores what the client believed and recomputes from the sets', () => {
    // The property server-authority exists for. The client sends inputs only,
    // and `TrainingSetReport`'s allowlist has no field for an answer — so the
    // strongest form of this check is that the wire's e1RM tracks the SETS and
    // nothing the client could have added.
    const applied = applyTrainingSession(
      newServerRecord(),
      3,
      proposalOf([set('deadlift', 230, 1, 10)]),
      'p-1',
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    // 1 rep @ RPE 10 is 100% of 1RM, and 230 is a 4.5% gain on the starting
    // 220, inside the guard.
    expect(applied.value.wire.bestE1rmKg.deadlift).toBe(230);
  });

  it('pays a milestone from streak.ts rather than a second ledger', () => {
    let record = newServerRecord();
    for (let day = 0; day < 7; day += 1) {
      const applied = applyTrainingSession(
        record,
        day,
        proposalOf([set(liftForDay(day), 100, 3, 8)]),
        `p-${day}`,
      );
      expect(applied.ok).toBe(true);
      if (!applied.ok) return;
      record = applied.value.record;
      // GDD §4.2: 7 / 30 / 100. The seventh trained day is the first milestone.
      expect(applied.value.milestonesReached).toEqual(day === 6 ? [7] : []);
    }
    expect(record.streak.currentStreak).toBe(7);
    // Signup grant 3 plus one milestone.
    expect(record.streak.recoveryDayBalance).toBe(4);
  });

  it('starts a setback only from the roll it is handed — no Math.random here', () => {
    const brutal = [
      set('squat', 200, 3, 10),
      set('squat', 200, 3, 10),
      set('squat', 200, 3, 10),
      set('squat', 200, 3, 10),
      set('squat', 200, 3, 10),
    ];
    const lucky = applyTrainingSession(newServerRecord(), 0, proposalOf(brutal), 'p', LUCKIEST_ROLLS);
    const unlucky = applyTrainingSession(
      newServerRecord(),
      0,
      proposalOf(brutal),
      'p',
      UNLUCKIEST_ROLLS,
    );
    expect(lucky.ok && lucky.value.injuryOnset).toBeNull();
    expect(unlucky.ok && unlucky.value.injuryOnset).not.toBeNull();
    // GDD §3.5: soft, and never a stat loss. Same e1RM either way.
    if (lucky.ok && unlucky.ok) {
      expect(unlucky.value.record.bestE1rmKg.squat).toBe(lucky.value.record.bestE1rmKg.squat);
      expect(unlucky.value.streakAfter).toBe(lucky.value.streakAfter);
    }
  });

  it('an ordinary session at the shipped template cannot injure at any frequency', () => {
    // GDD §3.5 / §12.3: showing up must never be what hurts you. 5x3 at the
    // default rung, thirty days running, with the unluckiest possible roll.
    let record = newServerRecord();
    for (let day = 0; day < 30; day += 1) {
      const lift = liftForDay(day);
      const sets = Array.from({ length: SESSION_TUNING.WORK_SETS }, () =>
        set(lift, 150, SESSION_TUNING.REPS_PER_SET, 8),
      );
      const applied = applyTrainingSession(
        record,
        day,
        proposalOf(sets),
        `p-${day}`,
        UNLUCKIEST_ROLLS,
      );
      expect(applied.ok).toBe(true);
      if (!applied.ok) return;
      expect(applied.value.injuryOnset).toBeNull();
      record = applied.value.record;
    }
    expect(record.streak.currentStreak).toBe(30);
  });
});

describe('the ledger entry a session leaves', () => {
  it('takes the hardest RPE and rounds the ragged session up to a rectangle', () => {
    const record = fatigueRecordFor(4, 'squat', [
      set('squat', 150, 3, 8),
      set('squat', 150, 2, 10),
      set('squat', 150, 3, 8),
    ]);
    expect(record).toEqual({
      day: 4,
      lift: 'squat',
      topRpe: 10,
      workSets: 3,
      // 8 reps over 3 sets rounds UP, so the ledger cannot understate the cost.
      repsPerSet: 3,
    });
  });

  it('is nothing at all for a session with no sets', () => {
    expect(fatigueRecordFor(4, 'squat', [])).toBeNull();
  });
});

describe('today, for the client to prescribe from', () => {
  it('reads the streak’s own answer to what today does', () => {
    const fresh = todayForLifter(newServerRecord(), 100, 'squat');
    expect(fresh.streakBefore).toBe(0);
    expect(fresh.streakIfTrainedToday).toBe(1);
    expect(fresh.alreadyTrainedToday).toBe(false);
    expect(fresh.e1rmKg).toBe(180);

    const trained = applyTrainingSession(
      newServerRecord(),
      100,
      proposalOf([set('squat', 150, 3, 8)]),
      'p',
    );
    expect(trained.ok).toBe(true);
    if (!trained.ok) return;
    const sameDay = todayForLifter(trained.value.record, 100, 'squat');
    expect(sameDay.alreadyTrainedToday).toBe(true);
    expect(sameDay.streakIfTrainedToday).toBe(1);
    const nextDay = todayForLifter(trained.value.record, 101, 'bench');
    expect(nextDay.alreadyTrainedToday).toBe(false);
    expect(nextDay.streakIfTrainedToday).toBe(2);
  });

  it('prescribes from the best e1RM once there is one', () => {
    const trained = applyTrainingSession(
      newServerRecord(),
      100,
      proposalOf([set('squat', 185, 1, 10)]),
      'p',
    );
    expect(trained.ok).toBe(true);
    if (!trained.ok) return;
    expect(todayForLifter(trained.value.record, 101, 'squat').e1rmKg).toBe(185);
  });

  it('a two-day gap is covered by the free grace and the run survives', () => {
    // GDD §4.4 / §12.3. `streak.ts` owns the rule; this checks the session path
    // does not undo it.
    let record = newServerRecord();
    const first = applyTrainingSession(record, 0, proposalOf([set('squat', 150, 3, 8)]), 'a');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    record = first.value.record;
    const afterGap = applyTrainingSession(record, 3, proposalOf([set('squat', 150, 3, 8)]), 'b');
    expect(afterGap.ok).toBe(true);
    if (!afterGap.ok) return;
    expect(afterGap.value.streakAfter).toBe(2);
  });
});

describe('the whole round trip — client proposes, server publishes, client reads', () => {
  it('ends with a CONFIRMED e1RM and streak, and an unmoved Total', () => {
    const record = newServerRecord();
    const seed = receiveProgressionSnapshot(snapshotWireFor(record, null));
    expect(seed.ok).toBe(true);
    if (!seed.ok) return;
    const seeded = applyServerSnapshot(emptyProgressionCache(), seed.value);
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;

    const played = playAgainst(record, 0, PRIMED, 8);
    const closeOut = played.state.closeOut!;
    const proposal = sessionProposal(closeOut, WALL_CLOCK)!;
    const proposed = proposeChange(
      seeded.value,
      asProposalId('p-1'),
      proposal,
      sessionProjection(closeOut),
    );
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(readBestE1rmKg(proposed.value, played.lift).kind).toBe('projected');

    const applied = applyTrainingSession(record, 0, proposal, 'p-1');
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const settled = receiveProgressionSnapshot(applied.value.wire);
    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    const done = applyServerSnapshot(proposed.value, settled.value);
    expect(done.ok).toBe(true);
    if (!done.ok) return;

    const e1rm = readBestE1rmKg(done.value, played.lift);
    expect(isConfirmedReading(e1rm)).toBe(true);
    expect(readingValue(e1rm)).toBeCloseTo(closeOut.sessionE1rmKg ?? Number.NaN, 6);
    const streak = readStreakDays(done.value);
    expect(isConfirmedReading(streak)).toBe(true);
    expect(readingValue(streak)).toBe(1);
    const total = readTotalKg(done.value);
    expect(isConfirmedReading(total)).toBe(true);
    expect(readingValue(total)).toBeNull();
  });

  it('the server’s published e1RM agrees with what the close-out showed', () => {
    // The property CLAUDE.md's one-formula rule exists for: two parts of the
    // app cannot report different numbers for the same set. Checked over the
    // whole ladder, both readiness ends, on a lifter with history.
    let record = newServerRecord();
    let day = 0;
    for (const answers of [NEUTRAL, PRIMED]) {
      for (const rpe of SESSION_TUNING.RPE_CHOICES) {
        const played = playAgainst(record, day, answers, rpe);
        const closeOut = played.state.closeOut!;
        const applied = applyTrainingSession(
          record,
          day,
          sessionProposal(closeOut, WALL_CLOCK)!,
          `p-${day}`,
        );
        expect(applied.ok).toBe(true);
        if (!applied.ok) return;
        if (closeOut.isPr) {
          expect(applied.value.bestE1rmKg).toBeCloseTo(closeOut.sessionE1rmKg ?? Number.NaN, 6);
        } else {
          expect(applied.value.bestE1rmKg).toBe(closeOut.previousBestE1rmKg);
        }
        record = applied.value.record;
        day += 1;
      }
    }
    expect(day).toBe(10);
  });
});
