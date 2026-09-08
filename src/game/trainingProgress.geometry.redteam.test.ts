/**
 * Cross-strength / plate-geometry pins for the physical-opportunity offer.
 *
 * The percent-step model (1.5% / 3-step cap) deadlocked light bars and
 * accelerated heavy ones. This file pins that the replacement does not.
 */
import { describe, expect, it } from 'vitest';

import { RPE_LOADING_TUNING, type WeightUnit } from './rpe';
import { SESSION_TUNING, TRAINING_PROGRESS_TUNING } from './sessionTuning';
import {
  applyTrainingSession,
  newServerRecord,
  type ServerRecord,
} from './sessionServer';
import {
  createSession,
  sessionProposal,
  stepSession,
  type SessionContext,
  type SessionEvent,
  type SessionState,
} from './session';
import { EMPTY_FATIGUE_STATE, type ReadinessCheckIn } from './fatigue';
import type { LiftOutcome } from './lift';
import {
  creditForLift,
  EMPTY_TRAINING_PROGRESS_CREDIT,
  progressionOffer,
} from './trainingProgress';

const SIGNUP_DAY = 0;
const CLOCK = { year: 2026, month: 8, day: 3, hour: 19 };
const NEUTRAL: ReadinessCheckIn = { sleep: 'ok', soreness: 'normal', motivation: 'steady' };
const ALL_GOOD = (): LiftOutcome => 'good-lift';
const STARTS_KG = [40, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500] as const;
const OPPORTUNITY = TRAINING_PROGRESS_TUNING.CREDIT_PER_PROGRESSION_OPPORTUNITY;

function context(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    day: 0,
    lift: 'squat',
    e1rmKg: 200,
    bestE1rmKg: 200,
    streakBefore: 4,
    streakIfTrainedToday: 5,
    fatigue: EMPTY_FATIGUE_STATE,
    trainingProgressCredit: 0,
    ...overrides,
  };
}

function runSession(
  ctx: SessionContext,
  rpe: number,
  outcomeFor: (set: number, rep: number) => LiftOutcome = ALL_GOOD,
): SessionState {
  let state = createSession(ctx);
  state = stepSession(state, { kind: 'check-in-tap', tap: { question: 'sleep', answer: NEUTRAL.sleep } });
  state = stepSession(state, {
    kind: 'check-in-tap',
    tap: { question: 'soreness', answer: NEUTRAL.soreness },
  });
  state = stepSession(state, {
    kind: 'check-in-tap',
    tap: { question: 'motivation', answer: NEUTRAL.motivation },
  });
  state = stepSession(state, { kind: 'choose-rpe', rpe });
  let guard = 0;
  while (state.phase !== 'close-out' && guard < 200) {
    guard += 1;
    if (state.phase === 'rest') {
      state = stepSession(state, { kind: 'begin-set' });
      continue;
    }
    const event: SessionEvent = {
      kind: 'rep-resolved',
      outcome: outcomeFor(state.setIndex, state.repIndex),
      executionQuality: 1,
    };
    state = stepSession(state, event);
  }
  return state;
}

interface Horizon {
  readonly end: number;
  readonly prs: number;
}

interface RunStats {
  readonly start: number;
  readonly end: number;
  readonly prs: number;
  readonly firstPr: number | null;
  readonly meanGap: number | null;
  readonly minGap: number | null;
  readonly maxGap: number | null;
  readonly maxBank: number;
  readonly creditOver12WithZeroSteps: boolean;
  readonly deadlocked: boolean;
  readonly earned: number;
  readonly consumed: number;
  readonly pending: number;
  readonly at30: Horizon;
  readonly at90: Horizon;
  readonly at180: Horizon;
}

function playStrength(
  start: number,
  sessions: number,
  rpeFor: (sessionIndex: number, credit: number) => number,
  outcomeFor: (set: number, rep: number) => LiftOutcome = ALL_GOOD,
): RunStats {
  let record: ServerRecord = {
    ...newServerRecord(SIGNUP_DAY),
    bestE1rmKg: { squat: start, bench: start, deadlift: start },
  };
  const prDays: number[] = [];
  let maxBank = 0;
  let over12Zero = false;
  let earned = 0;
  let consumed = 0;
  let at30: Horizon = { end: start, prs: 0 };
  let at90: Horizon = { end: start, prs: 0 };
  for (let i = 0; i < sessions; i += 1) {
    const credit = creditForLift(record.trainingProgressCredit ?? EMPTY_TRAINING_PROGRESS_CREDIT, 'squat');
    if (credit > maxBank) maxBank = credit;
    const rpe = rpeFor(i, credit);
    const offer = progressionOffer({
      credit,
      e1rmKg: record.bestE1rmKg.squat ?? start,
      targetRpe: rpe,
    });
    if (credit >= OPPORTUNITY && offer.appliedSteps === 0) over12Zero = true;
    const state = runSession(
      context({
        day: i,
        e1rmKg: record.bestE1rmKg.squat ?? start,
        bestE1rmKg: record.bestE1rmKg.squat ?? start,
        fatigue: record.fatigue,
        trainingProgressCredit: credit,
      }),
      rpe,
      outcomeFor,
    );
    const proposal = sessionProposal(state.closeOut!, CLOCK);
    if (proposal === null) continue;
    const applied = applyTrainingSession(record, i, proposal, `geo-${start}-${i}`);
    if (!applied.ok) throw new Error(applied.error.message);
    record = applied.value.record;
    earned += applied.value.trainingProgress.earned;
    consumed += applied.value.trainingProgress.consumed;
    if (applied.value.isPr) prDays.push(i);
    if (i === 29) at30 = { end: record.bestE1rmKg.squat ?? start, prs: prDays.length };
    if (i === 89) at90 = { end: record.bestE1rmKg.squat ?? start, prs: prDays.length };
  }
  const gaps: number[] = [];
  for (let i = 1; i < prDays.length; i += 1) gaps.push(prDays[i]! - prDays[i - 1]!);
  const end = record.bestE1rmKg.squat ?? start;
  const pending = creditForLift(record.trainingProgressCredit ?? EMPTY_TRAINING_PROGRESS_CREDIT, 'squat');
  return {
    start,
    end,
    prs: prDays.length,
    firstPr: prDays[0] ?? null,
    meanGap: gaps.length === 0 ? null : gaps.reduce((a, b) => a + b, 0) / gaps.length,
    minGap: gaps.length === 0 ? null : Math.min(...gaps),
    maxGap: gaps.length === 0 ? null : Math.max(...gaps),
    maxBank,
    creditOver12WithZeroSteps: over12Zero,
    deadlocked: prDays.length === 0 && pending >= OPPORTUNITY,
    earned,
    consumed,
    pending,
    at30,
    at90,
    at180: { end, prs: prDays.length },
  };
}

describe('physical-opportunity plate geometry — GDD §3.4', () => {
  it('eligible RPE never dead-zones across 40–500 kg and the lb grid', () => {
    const witnesses: string[] = [];
    for (const unit of ['kg', 'lb'] as const satisfies readonly WeightUnit[]) {
      const increment = RPE_LOADING_TUNING.ROUNDING_INCREMENT[unit];
      for (const rpe of SESSION_TUNING.RPE_CHOICES) {
        for (let e1rm = 40; e1rm <= 500; e1rm += 0.05) {
          const offer = progressionOffer({
            credit: OPPORTUNITY,
            e1rmKg: e1rm,
            targetRpe: rpe,
            unit,
          });
          if (rpe === SESSION_TUNING.RPE_CHOICES[0]) {
            if (offer.appliedSteps !== 0 || offer.nudgedWeightKg !== offer.unNudgedWeightKg) {
              witnesses.push(`${unit} rpe6 cashed e1rm=${e1rm}`);
            }
            continue;
          }
          if (
            offer.appliedSteps !== 1 ||
            offer.nudgedWeightKg - offer.unNudgedWeightKg !== increment
          ) {
            witnesses.push(
              `${unit} e1rm=${e1rm.toFixed(2)} rpe=${rpe} applied=${offer.appliedSteps} ` +
                `delta=${offer.nudgedWeightKg - offer.unNudgedWeightKg}`,
            );
            break;
          }
        }
      }
    }
    expect(witnesses).toEqual([]);
  });

  it('180-session always-8 cadence is strength-independent', { timeout: 120_000 }, () => {
    const rows = STARTS_KG.map((start) => playStrength(start, 180, () => 8));
    for (const row of rows) {
      expect(row.deadlocked, `${row.start} deadlocked`).toBe(false);
      expect(row.creditOver12WithZeroSteps, `${row.start} over12zero`).toBe(false);
      expect(row.firstPr, `${row.start} first PR`).toBe(12);
      expect(row.meanGap, `${row.start} meanGap`).toBeCloseTo(12, 5);
      expect(row.minGap, `${row.start} minGap`).toBe(12);
      expect(row.maxGap, `${row.start} maxGap`).toBe(12);
      expect(row.prs, `${row.start} prs`).toBe(14);
      expect(row.at30.prs, `${row.start} 30 prs`).toBe(2);
      expect(row.at90.prs, `${row.start} 90 prs`).toBe(7);
      expect(row.maxBank, `${row.start} maxBank`).toBeLessThanOrEqual(OPPORTUNITY);
      expect(row.end, `${row.start} end`).toBeGreaterThan(row.start);
    }
    const meanGaps = rows.map((r) => r.meanGap as number);
    const spread = Math.max(...meanGaps) / Math.min(...meanGaps);
    expect(spread).toBeCloseTo(1, 5);

    const signupBench = rows.find((r) => r.start === 120);
    expect(signupBench).toBeDefined();
    expect(signupBench!.deadlocked).toBe(false);
  });

  it('bank-hard / spend-easy: RPE 6 cannot cash; always-10 does not dominate', { timeout: 60_000 }, () => {
    const lastSetMiss: (set: number, rep: number) => LiftOutcome = (set, rep) =>
      set === SESSION_TUNING.WORK_SETS - 1 && rep === 0 ? 'miss' : 'good-lift';
    const lastRepMiss: (set: number, rep: number) => LiftOutcome = (_set, rep) =>
      rep === SESSION_TUNING.REPS_PER_SET - 1 ? 'miss' : 'good-lift';

    const always8 = playStrength(200, 180, () => 8);
    const always6 = playStrength(200, 180, () => 6);
    const always7 = playStrength(200, 180, () => 7);
    const always10 = playStrength(200, 180, () => 10);
    const miss = playStrength(200, 180, () => 8, lastSetMiss);
    const failHigh = playStrength(200, 180, () => 10, lastRepMiss);
    const spend6 = playStrength(200, 180, (_i, credit) => (credit >= OPPORTUNITY ? 6 : 8));
    const spend7 = playStrength(200, 180, (_i, credit) => (credit >= OPPORTUNITY ? 7 : 8));
    const mixed = playStrength(200, 180, (i) => ([7, 8, 9] as const)[i % 3]!);

    expect(always6.prs).toBe(0);
    expect(always6.end).toBe(200);
    expect(always6.consumed).toBe(0);

    expect(failHigh.prs).toBe(0);
    expect(failHigh.end).toBe(200);
    expect(failHigh.earned).toBe(0);
    expect(failHigh.consumed).toBe(0);

    expect(spend6.prs).toBe(0);
    expect(spend6.end).toBe(200);
    expect(spend6.consumed).toBe(0);
    expect(spend6.pending).toBeGreaterThanOrEqual(OPPORTUNITY);
    expect(spend6.end).toBeLessThan(always8.end);

    expect(always8.prs).toBe(14);
    expect(always10.end).toBeLessThanOrEqual(always8.end + 5);
    expect(always7.end).toBeLessThan(always8.end);
    expect(miss.end).toBeLessThan(always8.end);
    expect(miss.earned).toBeLessThan(always8.earned);
    expect(spend7.consumed).toBeGreaterThan(0);
    expect(spend7.end).toBeGreaterThan(200);
    expect(mixed.end).toBeGreaterThan(200);
  });
});
