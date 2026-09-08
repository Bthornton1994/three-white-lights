import { describe, expect, it } from 'vitest';

import * as fatigueModule from './fatigue';
import {
  BAR_SPEED_CUE_ORDER,
  EMPTY_FATIGUE_STATE,
  FATIGUE_COPY,
  FATIGUE_TUNING,
  INJURY_KINDS,
  LUCKIEST_ROLLS,
  NEUTRAL_CHECK_IN,
  READINESS_BAND_ORDER,
  SIM_LIFTS,
  UNLUCKIEST_ROLLS,
  activeInjury,
  adjustedMissChance,
  adjustedTimingWindowMs,
  cappedSession,
  isFreeSession,
  perceivedRpe,
  pruneFatigueState,
  readinessCheckIn,
  recordSession,
  recoverySessionFor,
  resolveRepAttempt,
  sessionFeel,
  sessionStimulusCredit,
  type FatigueState,
  type InjuryRolls,
  type ReadinessCheckIn,
  type RecordSessionOptions,
  type SessionRecord,
  type SimLift,
} from './fatigue';
import { SESSION_TUNING } from './sessionTuning';

/**
 * Fatigue is explicitly NOT domain-correctness territory (CLAUDE.md; GDD §3.1),
 * so there are no published reference values to check against and this file
 * asserts none. What it checks instead:
 *
 *   1. THE TWO REFUSAL CONDITIONS (GDD §12.3), as properties rather than
 *      examples — no fatigue level anywhere in the public API, and no way for
 *      showing up daily to leave a player worse off than skipping.
 *   2. That the module's own load-bearing claims survive retuning. Several
 *      tests DERIVE a requirement from `FATIGUE_TUNING` rather than restating a
 *      number, so a hand-tuning pass that breaks a guarantee fails here instead
 *      of shipping. Those are marked TUNING INVARIANT.
 *   3. Direction and shape: fatigue tightens, priming loosens, everything
 *      washes out on the GDD §3.4 horizon.
 *
 * Nothing here asserts a value FEELS right. That needs playtesting (GDD §12.1).
 */

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Seeded PRNG (mulberry32). Property tests must be reproducible. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[], fallback: T): T {
  const chosen = items[Math.floor(rng() * items.length)];
  return chosen === undefined ? fallback : chosen;
}

const LIFTS: readonly SimLift[] = SIM_LIFTS;
const SLEEP_ANSWERS = ['poor', 'ok', 'good'] as const;
const SORENESS_ANSWERS = ['sore', 'normal', 'fresh'] as const;
const MOTIVATION_ANSWERS = ['flat', 'steady', 'fired-up'] as const;

const BEST_CHECK_IN: ReadinessCheckIn = { sleep: 'good', soreness: 'fresh', motivation: 'fired-up' };
const WORST_CHECK_IN: ReadinessCheckIn = { sleep: 'poor', soreness: 'sore', motivation: 'flat' };

function randomCheckIn(rng: () => number): ReadinessCheckIn {
  return {
    sleep: pick(rng, SLEEP_ANSWERS, 'ok'),
    soreness: pick(rng, SORENESS_ANSWERS, 'normal'),
    motivation: pick(rng, MOTIVATION_ANSWERS, 'steady'),
  };
}

function session(
  day: number,
  overrides?: Partial<Omit<SessionRecord, 'day'>>,
): SessionRecord {
  return {
    day,
    lift: overrides?.lift ?? 'squat',
    topRpe: overrides?.topRpe ?? 8,
    workSets: overrides?.workSets ?? 4,
    repsPerSet: overrides?.repsPerSet ?? 5,
  };
}

/** Comfortably past `MAX_SESSION_STRAIN`, so the model is at its ceiling. */
function maximalSession(day: number, lift: SimLift = 'squat'): SessionRecord {
  return { day, lift, topRpe: 10, workSets: 10, repsPerSet: 5 };
}

/** A hard but ordinary day: 5 x 3 @ RPE 9 indexes to strain 1.0 as shipped. */
function hardSession(day: number, lift: SimLift = 'squat'): SessionRecord {
  return { day, lift, topRpe: 9, workSets: 5, repsPerSet: 3 };
}

function randomSession(rng: () => number, day: number): SessionRecord {
  return {
    day,
    lift: pick(rng, LIFTS, 'squat'),
    topRpe: 6 + Math.floor(rng() * 9) * 0.5,
    workSets: 1 + Math.floor(rng() * 7),
    repsPerSet: 1 + Math.floor(rng() * 8),
  };
}

// ---------------------------------------------------------------------------
// Sweeping the strain axis
//
// The module does not export strain, and must not — that scalar IS the fatigue
// level GDD §3.4 forbids surfacing. So a suite that wants to check a guarantee
// across the whole strain band rather than at one convenient point has to derive
// strain itself, from `FATIGUE_TUNING` alone. `strainOf` does that, and
// `the derived strain formula tracks the module` pins it against the two places
// strain is observable through the public API, so it cannot drift silently.
// ---------------------------------------------------------------------------

/** A session minus its day, so the same content can be replayed on any schedule. */
type SessionTemplate = Omit<SessionRecord, 'day'>;

/** `rpeStrainWeight`, rebuilt from the tuning table. */
function strainWeightOf(rpe: number): number {
  const table = FATIGUE_TUNING.RPE_STRAIN_WEIGHTS;
  const first = table[0];
  const last = table[table.length - 1];
  if (first === undefined || last === undefined) throw new Error('empty strain-weight table');
  if (rpe <= first.rpe) return first.weight;
  if (rpe >= last.rpe) return last.weight;
  for (let i = 1; i < table.length; i += 1) {
    const lo = table[i - 1];
    const hi = table[i];
    if (lo === undefined || hi === undefined) continue;
    if (rpe <= hi.rpe) {
      const t = (rpe - lo.rpe) / (hi.rpe - lo.rpe);
      return lo.weight + t * (hi.weight - lo.weight);
    }
  }
  return last.weight;
}

/** `sessionStrain`, rebuilt from the tuning constants. Test-only. */
function strainOf(record: SessionRecord): number {
  const raw = record.workSets * record.repsPerSet * strainWeightOf(record.topRpe);
  return Math.min(
    FATIGUE_TUNING.MAX_SESSION_STRAIN,
    Math.max(0, raw - FATIGUE_TUNING.STRAIN_FREE_ALLOWANCE) / FATIGUE_TUNING.STRAIN_REFERENCE,
  );
}

function templateOf(record: SessionRecord): SessionTemplate {
  return {
    lift: record.lift,
    topRpe: record.topRpe,
    workSets: record.workSets,
    repsPerSet: record.repsPerSet,
  };
}

function describeTemplate(template: SessionTemplate): string {
  return (
    `${template.workSets}x${template.repsPerSet} @ RPE ${template.topRpe} ` +
    `(strain ${strainOf({ day: 1, ...template }).toFixed(4)})`
  );
}

/** 5x3 @ RPE 9 — strain 1.0 by construction of `STRAIN_REFERENCE`. */
const REFERENCE_HARD_TEMPLATE: SessionTemplate = {
  lift: 'squat',
  topRpe: 9,
  workSets: 5,
  repsPerSet: 3,
};

const REFERENCE_HARD_STRAIN = strainOf({ day: 1, ...REFERENCE_HARD_TEMPLATE });

/**
 * Real, plausible sessions spanning the whole reachable strain axis: free, easy,
 * moderate, the reference hard day, the band that used to be safe-alone and
 * unsafe-repeated, the threshold crossing, and the model's ceiling.
 *
 * Deliberately integer sets and reps at charted RPEs — these are sessions a
 * player could actually pick from the GDD §3.3 RPE selector, not synthetic
 * strain values, so a failure here names a session rather than a number.
 */
const STRAIN_SWEEP: readonly SessionTemplate[] = Object.freeze([
  { lift: 'squat', topRpe: 6, workSets: 2, repsPerSet: 5 }, //   free
  { lift: 'bench', topRpe: 7, workSets: 3, repsPerSet: 5 }, //   ~0.17
  { lift: 'deadlift', topRpe: 8, workSets: 4, repsPerSet: 5 }, // ~0.78
  REFERENCE_HARD_TEMPLATE, //                                    1.00
  { lift: 'squat', topRpe: 9, workSets: 6, repsPerSet: 3 }, //   ~1.27
  { lift: 'bench', topRpe: 9.5, workSets: 5, repsPerSet: 3 }, // ~1.33  the send-back case
  { lift: 'squat', topRpe: 8, workSets: 6, repsPerSet: 5 }, //   ~1.33  same strain, different shape
  { lift: 'deadlift', topRpe: 10, workSets: 4, repsPerSet: 3 }, // ~1.33
  { lift: 'squat', topRpe: 9.5, workSets: 4, repsPerSet: 4 }, // ~1.44  just under the threshold
  { lift: 'bench', topRpe: 9, workSets: 7, repsPerSet: 3 }, //   ~1.53  just over it
  { lift: 'squat', topRpe: 10, workSets: 5, repsPerSet: 3 }, //  1.75
  { lift: 'deadlift', topRpe: 9, workSets: 5, repsPerSet: 5 }, // ~1.89
  { lift: 'squat', topRpe: 10, workSets: 10, repsPerSet: 5 }, //  2.50, at the ceiling
]);

/**
 * Residual that a session of strain `s` settles at when repeated every single
 * day forever, per unit of `s`. The fixed point of the module's own recurrence.
 */
const SETTLED_RESIDUAL_PER_STRAIN =
  FATIGUE_TUNING.DAILY_DECAY /
  (1 - FATIGUE_TUNING.ACTIVE_RECOVERY_FLUSH * FATIGUE_TUNING.DAILY_DECAY);

/**
 * THE BAND THE SEND-BACK WAS ABOUT: sessions that are individually safe, but
 * that any model adding carried-in residual to today's strain — at any weight up
 * to 1 — would turn unsafe once they were repeated daily.
 *
 * Derived, not listed, so it stays meaningful across a retune. Asserted
 * non-empty wherever it is used, because a vacuous property test is exactly how
 * the previous draft passed while broken.
 */
const DANGEROUS_BAND: readonly SessionTemplate[] = STRAIN_SWEEP.filter((template) => {
  const strain = strainOf({ day: 1, ...template });
  return (
    strain < FATIGUE_TUNING.INJURY_STRAIN_THRESHOLD &&
    strain * (1 + SETTLED_RESIDUAL_PER_STRAIN) > FATIGUE_TUNING.INJURY_STRAIN_THRESHOLD
  );
});

interface ScheduleRun {
  readonly injuries: number;
  readonly firstInjuryDay: number | null;
}

/**
 * Train the same session every `everyNDays` days, `count` times, against the
 * UNLUCKIEST possible roll — so a setback appears the instant the probability
 * leaves zero, and the counts are deterministic rather than sampled.
 */
function runSchedule(
  template: SessionTemplate,
  everyNDays: number,
  count: number,
): ScheduleRun {
  let state = EMPTY_FATIGUE_STATE;
  let injuries = 0;
  let firstInjuryDay: number | null = null;
  for (let i = 0; i < count; i += 1) {
    const day = 1 + i * everyNDays;
    const result = recordSession(state, { day, ...template }, UNLUCKIEST_ROLLS);
    if (result.injuryOnset !== null) {
      injuries += 1;
      if (firstInjuryDay === null) firstInjuryDay = day;
    }
    state = result.state;
  }
  return { injuries, firstInjuryDay };
}

/**
 * The probability `recordSession` resolves against, recovered exactly.
 *
 * The module deliberately does not export it, and must not — "injury risk: 4%"
 * on a screen is the readout GDD §3.4 forbids wearing a different label. But
 * `InjuryRolls` documents that a setback starts when `onset` is strictly below
 * the probability, so a TEST can invert that by bisection and measure the model
 * from outside instead of reaching into it. Test-only, and the reason the module
 * needs no new export to be checkable here.
 *
 * TAKES THE SAME OPTIONS `recordSession` DOES, so the effect of a technique
 * rating can be measured as a NUMBER rather than as "did the unluckiest roll
 * still injure" — which is the same answer for every rating below total
 * invulnerability and therefore measures nothing.
 */
function measuredInjuryChance(
  state: FatigueState,
  session: SessionRecord,
  options?: RecordSessionOptions,
): number {
  const injures = (onset: number): boolean =>
    recordSession(state, session, { onset, duration: 0.5 }, options).injuryOnset !== null;
  if (!injures(0)) return 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (injures(mid)) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * The surfaced signals, as a comparable bundle. The daily-engagement property
 * is asserted on THESE — the things a player experiences — and never on an
 * internal scalar, because the module deliberately does not expose one.
 */
interface Signals {
  readonly windowMs: number;
  readonly missChance: number;
  readonly perceived: number;
  readonly barSpeedRank: number;
  readonly injured: boolean;
}

const BASE_WINDOW_MS = 240;
const BASE_MISS_CHANCE = 0.2;
const PRESCRIBED_RPE = 8;

function signalsFor(state: FatigueState, day: number, checkIn: ReadinessCheckIn): Signals {
  const feel = sessionFeel(state, day, checkIn);
  return {
    windowMs: adjustedTimingWindowMs(BASE_WINDOW_MS, feel),
    missChance: adjustedMissChance(BASE_MISS_CHANCE, feel),
    perceived: perceivedRpe(PRESCRIBED_RPE, feel),
    barSpeedRank: BAR_SPEED_CUE_ORDER.indexOf(feel.barSpeed),
    injured: feel.injury !== null,
  };
}

/** `a` is at least as good for the player as `b`, on every surfaced channel. */
function expectAtLeastAsGood(a: Signals, b: Signals, context: string): void {
  expect(a.windowMs, `${context}: timing window`).toBeGreaterThanOrEqual(b.windowMs);
  expect(a.missChance, `${context}: miss chance`).toBeLessThanOrEqual(b.missChance);
  expect(a.perceived, `${context}: perceived RPE`).toBeLessThanOrEqual(b.perceived);
  expect(a.barSpeedRank, `${context}: bar speed cue`).toBeLessThanOrEqual(b.barSpeedRank);
}

function recordAll(
  state: FatigueState,
  sessions: readonly SessionRecord[],
  rolls: InjuryRolls = LUCKIEST_ROLLS,
): FatigueState {
  let current = state;
  for (const next of sessions) {
    current = recordSession(current, next, rolls).state;
  }
  return current;
}

/**
 * The recurrence in `residualAtStartOfDay`, reimplemented here from the tuning
 * constants alone. Used only to DERIVE bounds for the tuning invariants below —
 * never to assert an expected signal, since the module exposes no residual to
 * compare against and asserting one would be asserting a meter into existence.
 */
function steadyStateResidualBound(): number {
  const { MAX_SESSION_STRAIN, DAILY_DECAY, ACTIVE_RECOVERY_FLUSH } = FATIGUE_TUNING;
  return (MAX_SESSION_STRAIN * DAILY_DECAY) / (1 - ACTIVE_RECOVERY_FLUSH * DAILY_DECAY);
}

// ---------------------------------------------------------------------------
// REFUSAL CONDITION 1 — no visible fatigue meter (GDD §3.4, §12.3)
// ---------------------------------------------------------------------------

describe('no fatigue meter: the public API offers no fatigue level', () => {
  /**
   * THE LOAD-BEARING TEST OF THIS FILE. A critic reads the exports as the
   * artifact, so the export list is pinned. Adding `fatigueLevel`,
   * `currentFatigue`, `residual`, `injuryRisk` or anything else that reads as a
   * level fails here and has to be argued for in a diff rather than slipped in.
   *
   * Type-only exports do not appear at runtime and are not listed.
   */
  it('exports exactly the agreed runtime surface, and nothing that names a level', () => {
    expect(Object.keys(fatigueModule).sort()).toEqual(
      [
        // Tunables and vocabulary.
        'BAR_SPEED_CUE_ORDER',
        'EMPTY_FATIGUE_STATE',
        'FATIGUE_COPY',
        'FATIGUE_TUNING',
        'INJURY_KINDS',
        'LUCKIEST_ROLLS',
        'NEUTRAL_CHECK_IN',
        'READINESS_BAND_ORDER',
        'SIM_LIFTS',
        'UNLUCKIEST_ROLLS',
        // Behaviour.
        'activeInjury',
        'adjustedMissChance',
        'adjustedTimingWindowMs',
        'cappedSession',
        'isFreeSession',
        'perceivedRpe',
        'pruneFatigueState',
        'readinessCheckIn',
        'recordSession',
        'recoverySessionFor',
        'resolveRepAttempt',
        'sessionFeel',
        'sessionStimulusCredit',
      ].sort(),
    );
  });

  it('exports no identifier whose name suggests a readable fatigue level', () => {
    const forbidden =
      /(fatigue(level|value|score|amount|percent|pct|ratio|meter|bar)|residual|strain|burden|injuryrisk|injurychance)/i;
    const offenders = Object.keys(fatigueModule).filter((name) => forbidden.test(name));
    expect(offenders).toEqual([]);
  });

  /**
   * The three exports that return a bare `number` each return something
   * ANCHORED TO A CALLER-SUPPLIED QUANTITY rather than a state readout. That is
   * the property that distinguishes a mechanic parameter from a meter, and it
   * is asserted rather than asserted-about-in-a-comment.
   */
  it('every number-returning export is anchored to a caller-supplied quantity', () => {
    const state = recordAll(EMPTY_FATIGUE_STATE, [
      maximalSession(1),
      maximalSession(2),
      maximalSession(3),
    ]);
    const feel = sessionFeel(state, 4, WORST_CHECK_IN);

    // adjustedTimingWindowMs is in the caller's milliseconds: doubling the base
    // doubles the answer. A normalised level could not do that.
    expect(adjustedTimingWindowMs(500, feel)).toBeCloseTo(
      2 * adjustedTimingWindowMs(250, feel),
      6,
    );

    // adjustedMissChance is dominated by the caller's own probability: a rep the
    // mechanic calls certain stays certain whatever the hidden state is.
    expect(adjustedMissChance(0, feel)).toBe(0);
    expect(adjustedMissChance(1, feel)).toBe(1);

    // perceivedRpe tracks the prescribed RPE one-for-one inside the chart range.
    const shiftAt7 = perceivedRpe(7, feel) - 7;
    const shiftAt8 = perceivedRpe(8, feel) - 8;
    expect(shiftAt7).toBeCloseTo(shiftAt8, 6);
  });

  it('SessionFeel exposes only qualitative fields; the numeric half is not nameable', () => {
    const state = recordAll(EMPTY_FATIGUE_STATE, [hardSession(1), hardSession(2)]);
    const feel = sessionFeel(state, 3, WORST_CHECK_IN);

    expect(Object.keys(feel).sort()).toEqual(
      ['barSpeed', 'barSpeedText', 'injury', 'readiness'].sort(),
    );
    // The internal half exists, and is reachable only through a symbol this
    // module does not export. That is the accident it closes, not tamper-proofing.
    expect(Object.getOwnPropertySymbols(feel)).toHaveLength(1);

    // It does not survive serialisation, so it cannot reach a screen by accident.
    const roundTripped: unknown = JSON.parse(JSON.stringify(feel));
    expect(Object.keys(roundTripped as Record<string, unknown>).sort()).toEqual(
      ['barSpeed', 'barSpeedText', 'injury', 'readiness'].sort(),
    );
  });

  /**
   * With injury and the check-in readout set aside, a serialised `SessionFeel`
   * contains no numbers at all — only band names and copy. So there is nothing
   * left to bind a bar to.
   */
  it('a serialised SessionFeel carries no fatigue-derived number', () => {
    const rng = makeRng(20260801);
    for (let trial = 0; trial < 200; trial += 1) {
      let state = EMPTY_FATIGUE_STATE;
      for (let day = 1; day <= 6; day += 1) {
        if (rng() < 0.75) state = recordSession(state, randomSession(rng, day), LUCKIEST_ROLLS).state;
      }
      const feel = sessionFeel(state, 7, randomCheckIn(rng));
      const serialised: unknown = JSON.parse(JSON.stringify(feel));
      const record = serialised as Record<string, unknown>;
      delete record.readiness; // the player's own taps, echoed back
      delete record.injury; // a countdown plus copy, tested separately
      const numbers = JSON.stringify(record).match(/-?\d+(\.\d+)?/g);
      expect(numbers, `trial ${trial}: ${JSON.stringify(record)}`).toBeNull();
    }
  });

  /**
   * The persisted state is a ledger of what the player did, not a level. Every
   * field of every stored session is a raw input, so a UI binding directly to
   * saved state still cannot draw a fatigue bar without doing the game math
   * itself — which CLAUDE.md forbids components from doing.
   */
  it('FatigueState is a raw-input ledger and round-trips through JSON', () => {
    const state = recordAll(EMPTY_FATIGUE_STATE, [hardSession(1), session(2), hardSession(3)]);
    expect(Object.keys(state).sort()).toEqual(['injury', 'sessions'].sort());
    for (const stored of state.sessions) {
      expect(Object.keys(stored).sort()).toEqual(
        ['day', 'lift', 'repsPerSet', 'topRpe', 'workSets'].sort(),
      );
    }
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('the readiness readout is identical across wildly different fatigue histories', () => {
    const fresh = EMPTY_FATIGUE_STATE;
    const wrecked = recordAll(EMPTY_FATIGUE_STATE, [
      maximalSession(1),
      maximalSession(2),
      maximalSession(3),
      maximalSession(4),
    ]);
    for (const sleep of SLEEP_ANSWERS) {
      for (const soreness of SORENESS_ANSWERS) {
        for (const motivation of MOTIVATION_ANSWERS) {
          const checkIn: ReadinessCheckIn = { sleep, soreness, motivation };
          expect(sessionFeel(fresh, 5, checkIn).readiness).toEqual(
            sessionFeel(wrecked, 5, checkIn).readiness,
          );
          expect(sessionFeel(wrecked, 5, checkIn).readiness).toEqual(readinessCheckIn(checkIn));
        }
      }
    }
  });

  it('rejects a hand-built SessionFeel, so the hidden half cannot be forged in a literal', () => {
    const forged = {
      readiness: readinessCheckIn(NEUTRAL_CHECK_IN),
      barSpeed: 'popping' as const,
      barSpeedText: 'x',
      injury: null,
    };
    expect(() =>
      adjustedTimingWindowMs(240, forged as unknown as ReturnType<typeof sessionFeel>),
    ).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// REFUSAL CONDITION 2 — daily engagement is never punished (GDD §3.5, §4, §12.3)
// ---------------------------------------------------------------------------

describe('daily engagement is never punished', () => {
  /**
   * G1. There is always a session that costs nothing, on every lift, on every
   * day. This is what makes "showing up" separable from "training hard".
   */
  it('offers a free session on every lift', () => {
    for (const lift of LIFTS) {
      expect(isFreeSession(recoverySessionFor(10, lift))).toBe(true);
    }
  });

  /**
   * G2, AS A PROPERTY OVER MANY DAYS. Two players with identical histories and
   * identical futures; one takes the free session on day d, the other skips it
   * entirely. The one who showed up is never worse off on ANY surfaced channel,
   * on day d+1 and on every day after, across a random tail of shared sessions.
   *
   * Rolls are pinned lucky so neither player is injured and the two histories
   * differ ONLY by the recovery day. The injury half of the guarantee is its own
   * property below.
   */
  it('property: taking the free session is never worse than skipping, over a long tail', () => {
    const rng = makeRng(0xfa716e);
    const TRIALS = 300;
    const TAIL_DAYS = 8;

    for (let trial = 0; trial < TRIALS; trial += 1) {
      // A random shared past.
      let shared = EMPTY_FATIGUE_STATE;
      const historyDays = 1 + Math.floor(rng() * 5);
      for (let day = 1; day <= historyDays; day += 1) {
        if (rng() < 0.7) {
          shared = recordSession(shared, randomSession(rng, day), LUCKIEST_ROLLS).state;
        }
      }

      const decisionDay = historyDays + 1;
      const lift = pick(rng, LIFTS, 'squat');

      // Branch A: showed up and took the free session. Branch B: skipped.
      let showedUp = recordSession(
        shared,
        recoverySessionFor(decisionDay, lift),
        UNLUCKIEST_ROLLS,
      ).state;
      let skipped = shared;

      // Identical future for both.
      const checkIn = randomCheckIn(rng);
      for (let offset = 1; offset <= TAIL_DAYS; offset += 1) {
        const day = decisionDay + offset;
        expectAtLeastAsGood(
          signalsFor(showedUp, day, checkIn),
          signalsFor(skipped, day, checkIn),
          `trial ${trial}, day +${offset}`,
        );
        if (rng() < 0.6) {
          const tail = randomSession(rng, day);
          showedUp = recordSession(showedUp, tail, LUCKIEST_ROLLS).state;
          skipped = recordSession(skipped, tail, LUCKIEST_ROLLS).state;
        }
      }
    }
  });

  /** G2, strictly: with fatigue actually present, showing up is a real gain. */
  it('the free session is strictly better than skipping when there is fatigue to flush', () => {
    const shared = recordAll(EMPTY_FATIGUE_STATE, [hardSession(1), hardSession(2)]);
    const showedUp = recordSession(shared, recoverySessionFor(3, 'bench'), UNLUCKIEST_ROLLS).state;
    const a = signalsFor(showedUp, 4, NEUTRAL_CHECK_IN);
    const b = signalsFor(shared, 4, NEUTRAL_CHECK_IN);
    expect(a.windowMs).toBeGreaterThan(b.windowMs);
    expect(a.missChance).toBeLessThan(b.missChance);
  });

  /**
   * G3, AS A PROPERTY. A free session cannot start a setback for ANY roll —
   * `UNLUCKIEST_ROLLS.onset` is 0, which injures whenever the probability is
   * above zero, so this is a check that the probability is exactly zero. Swept
   * over randomised histories including maximal ones.
   */
  it('property: a free session can never cause an injury, however fatigued the player is', () => {
    const rng = makeRng(1_000_003);
    for (let trial = 0; trial < 300; trial += 1) {
      let state = EMPTY_FATIGUE_STATE;
      const days = 1 + Math.floor(rng() * 8);
      for (let day = 1; day <= days; day += 1) {
        // Deliberately brutal histories: mostly maximal sessions.
        const next = rng() < 0.7 ? maximalSession(day, pick(rng, LIFTS, 'squat')) : randomSession(rng, day);
        state = recordSession(state, next, LUCKIEST_ROLLS).state;
      }
      const result = recordSession(
        state,
        recoverySessionFor(days + 1, pick(rng, LIFTS, 'squat')),
        UNLUCKIEST_ROLLS,
      );
      expect(result.injuryOnset, `trial ${trial}`).toBeNull();
    }
  });

  /** The same guarantee at the model's ceiling, reached by brute force. */
  it('a free session cannot injure even after a long run of maximal sessions', () => {
    let state = EMPTY_FATIGUE_STATE;
    for (let day = 1; day <= 40; day += 1) {
      state = recordSession(state, maximalSession(day), LUCKIEST_ROLLS).state;
    }
    for (const lift of LIFTS) {
      const result = recordSession(state, recoverySessionFor(41, lift), UNLUCKIEST_ROLLS);
      expect(result.injuryOnset).toBeNull();
    }
  });

  /**
   * G4, AS A PROPERTY. Showing up cannot CAUSE a setback that skipping would
   * have avoided: with the same later session and the same roll, the player who
   * showed up is injured only if the player who skipped would have been too.
   */
  it('property: showing up never causes an injury that skipping would have avoided', () => {
    const rng = makeRng(2_000_003);
    for (let trial = 0; trial < 400; trial += 1) {
      let shared = EMPTY_FATIGUE_STATE;
      const historyDays = 1 + Math.floor(rng() * 5);
      for (let day = 1; day <= historyDays; day += 1) {
        if (rng() < 0.8) {
          shared = recordSession(shared, maximalSession(day, pick(rng, LIFTS, 'squat')), LUCKIEST_ROLLS).state;
        }
      }
      const decisionDay = historyDays + 1;
      const showedUp = recordSession(
        shared,
        recoverySessionFor(decisionDay, pick(rng, LIFTS, 'squat')),
        LUCKIEST_ROLLS,
      ).state;

      const nextDay = decisionDay + 1;
      const risky = maximalSession(nextDay, pick(rng, LIFTS, 'squat'));
      const roll: InjuryRolls = { onset: rng() * 0.1, duration: rng() };

      const afterShowingUp = recordSession(showedUp, risky, roll);
      const afterSkipping = recordSession(shared, risky, roll);
      if (afterShowingUp.injuryOnset !== null) {
        expect(afterSkipping.injuryOnset, `trial ${trial}`).not.toBeNull();
      }
    }
  });

  /**
   * G5, on the SURFACED SIGNALS. Turnout that carries no work must be inert: a
   * player thirty days into an unbroken run feels exactly what a player one day
   * into one feels, given the same work. The model reads work, never turnout.
   *
   * WHY IT IS BUILT THIS WAY. The obvious phrasing — same sessions, different
   * numbers of intervening days on which the player "opened the app" — cannot be
   * written, because opening the app records nothing and the two ledgers are
   * then the same object. The earlier draft of this test wrote it anyway and
   * compared a state to itself, which can only fail on non-determinism. The
   * version below separates the two players on the axis that actually exists:
   * how many days of the ledger carry a session at all. Free sessions cost
   * exactly zero strain (G1), so any streak counter, consecutive-day multiplier
   * or days-since-signup term would show up here as a difference and there is
   * nothing else left that could.
   *
   * The injury half of G5 is a separate and much stronger property, because
   * signals legitimately do respond to yesterday's work (GDD §3.4) and risk must
   * not: see `consistency never accrues injury risk (G5, G5b)`.
   */
  it('reads work, never attendance: no streak or consecutive-day term exists', () => {
    const readDay = 31;
    let longRun = EMPTY_FATIGUE_STATE;
    for (let day = 1; day < readDay; day += 1) {
      longRun = recordSession(longRun, recoverySessionFor(day, 'squat'), UNLUCKIEST_ROLLS).state;
    }
    const oneDay = recordSession(
      EMPTY_FATIGUE_STATE,
      recoverySessionFor(readDay - 1, 'squat'),
      UNLUCKIEST_ROLLS,
    ).state;
    // Non-vacuity: the two ledgers really are different, so `toEqual` below is
    // comparing two things and not one thing twice.
    expect(longRun.sessions.length).toBeGreaterThan(oneDay.sessions.length);
    for (const checkIn of [BEST_CHECK_IN, NEUTRAL_CHECK_IN, WORST_CHECK_IN]) {
      expect(
        signalsFor(longRun, readDay, checkIn),
        `check-in ${JSON.stringify(checkIn)}`,
      ).toEqual(signalsFor(oneDay, readDay, checkIn));
    }

    // And a longer unbroken run of free sessions never degrades anything.
    let free = EMPTY_FATIGUE_STATE;
    let previous = signalsFor(free, 1, NEUTRAL_CHECK_IN);
    for (let day = 1; day <= 30; day += 1) {
      free = recordSession(free, recoverySessionFor(day, 'squat'), UNLUCKIEST_ROLLS).state;
      const now = signalsFor(free, day + 1, NEUTRAL_CHECK_IN);
      expectAtLeastAsGood(now, previous, `free-session run day ${day}`);
      previous = now;
    }
    expect(activeInjury(free, 31)).toBeNull();
  });

  /**
   * G6. A setback never costs a day. Whatever the plan and whatever the
   * setback, the capped session is still a session the player can complete.
   */
  it('property: an injury can never make a session impossible, so it cannot break a streak', () => {
    const rng = makeRng(3_000_017);
    const injured = injuredState();
    for (let trial = 0; trial < 200; trial += 1) {
      const day = injured.injury === null ? 0 : injured.injury.startDay;
      const planned = { ...randomSession(rng, day), workSets: 1 + Math.floor(rng() * 8) };
      const capped = cappedSession(planned, injured);
      expect(capped.workSets).toBeGreaterThanOrEqual(
        Math.min(planned.workSets, FATIGUE_TUNING.MIN_WORK_SETS_WHILE_INJURED),
      );
      expect(capped.workSets).toBeGreaterThanOrEqual(1);
      expect(capped.repsPerSet).toBe(planned.repsPerSet);
    }
  });

  /**
   * G7. A setback is copy, a countdown and a volume cap. There is no field for a
   * stat delta and this pins both key sets so one cannot be added quietly.
   */
  it('an injury carries no stat-loss field', () => {
    const state = injuredState();
    const injury = state.injury;
    expect(injury).not.toBeNull();
    if (injury === null) return;
    expect(Object.keys(injury).sort()).toEqual(['endDay', 'kind', 'lift', 'startDay'].sort());

    const notice = activeInjury(state, injury.startDay);
    expect(notice).not.toBeNull();
    if (notice === null) return;
    expect(Object.keys(notice).sort()).toEqual(
      [
        'daysRemaining',
        'detail',
        'headline',
        'kind',
        'lift',
        'reassurance',
        'volumeReductionPercent',
      ].sort(),
    );
  });
});

/** A state carrying a setback, built through the public API only. */
function injuredState(): FatigueState {
  let state = EMPTY_FATIGUE_STATE;
  for (let day = 1; day <= 3; day += 1) {
    state = recordSession(state, maximalSession(day), LUCKIEST_ROLLS).state;
  }
  const result = recordSession(state, maximalSession(4), UNLUCKIEST_ROLLS);
  expect(result.injuryOnset).not.toBeNull();
  return result.state;
}

// ---------------------------------------------------------------------------
// Injury shape (GDD §3.5)
// ---------------------------------------------------------------------------

/**
 * How long the setback started by one maximal day runs, on a PINNED duration
 * roll, with `physioDaysSaved` days of Gym Empire physio applied (GDD §5.4).
 *
 * PINNING THE ROLL IS THE WHOLE POINT. A physio'd setback is only meaningfully
 * shorter than the same setback unaided; compared against the 2-3 day band as a
 * whole, a physio'd 2-day setback and an unaided 2-day setback are
 * indistinguishable, which is how the earlier draft of these tests passed with
 * `physioDaysSaved` wired to nothing. Two calls that differ only in the physio
 * argument differ in their answer only because of the physio.
 */
function setbackDurationFor(durationRoll: number, physioDaysSaved: number): number {
  let state = EMPTY_FATIGUE_STATE;
  for (let day = 1; day <= 3; day += 1) {
    state = recordSession(state, maximalSession(day), LUCKIEST_ROLLS).state;
  }
  const result = recordSession(
    state,
    maximalSession(4),
    { onset: 0, duration: durationRoll },
    { physioDaysSaved },
  );
  const injury = result.state.injury;
  if (injury === null) {
    throw new Error('expected a setback: a maximal day on the unluckiest onset roll must injure');
  }
  return injury.endDay - injury.startDay + 1;
}

/** One roll per rollable setback length, so a sweep covers the whole band. */
const DURATION_ROLL_COUNT = Math.max(
  1,
  FATIGUE_TUNING.INJURY_DURATION_DAYS_MAX - FATIGUE_TUNING.INJURY_DURATION_DAYS_MIN + 1,
);
const PINNED_DURATION_ROLLS: readonly number[] = Object.freeze(
  Array.from({ length: DURATION_ROLL_COUNT }, (_unused, i) => (i + 0.5) / DURATION_ROLL_COUNT),
);

describe('injury setbacks are rare, short and soft (GDD §3.5)', () => {
  it('property: a setback is always inside the 2-3 day band, or shorter with physio', () => {
    const rng = makeRng(0xd0c);
    const floor = FATIGUE_TUNING.INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO;
    for (let trial = 0; trial < 300; trial += 1) {
      const physio = Math.floor(rng() * 4);
      const durationRoll = rng();
      const duration = setbackDurationFor(durationRoll, physio);
      const where = `trial ${trial}, physio ${physio}, roll ${durationRoll}`;
      expect(duration, where).toBeGreaterThanOrEqual(floor);
      expect(duration, where).toBeLessThanOrEqual(FATIGUE_TUNING.INJURY_DURATION_DAYS_MAX);
      // Physio only ever shortens — measured against the SAME roll unaided,
      // which is the only comparison that can tell the difference. Asserting it
      // against the band again, as this test once did, restates the two lines
      // above and holds whether or not physio does anything at all.
      const unaided = setbackDurationFor(durationRoll, 0);
      expect(unaided, where).toBeGreaterThanOrEqual(FATIGUE_TUNING.INJURY_DURATION_DAYS_MIN);
      expect(duration, where).toBe(Math.max(floor, unaided - physio));
    }
  });

  /**
   * GDD §5.4: "Physio reduces Sim injury duration". The cross-mode hook, as a
   * numeric relationship on a fixed roll rather than a band check.
   */
  it('physio takes a whole day off the same setback, down to the floor and no further (GDD §5.4)', () => {
    const floor = FATIGUE_TUNING.INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO;
    const expectedBand: number[] = [];
    for (
      let days = FATIGUE_TUNING.INJURY_DURATION_DAYS_MIN;
      days <= FATIGUE_TUNING.INJURY_DURATION_DAYS_MAX;
      days += 1
    ) {
      expectedBand.push(days);
    }

    // The sweep must actually reach every setback length the module can roll,
    // or "physio shortens it" gets checked at one convenient length and misses
    // the rest.
    const unaidedLengths = PINNED_DURATION_ROLLS.map((roll) => setbackDurationFor(roll, 0));
    expect([...new Set(unaidedLengths)].sort((a, b) => a - b)).toEqual(expectedBand);

    let strictlyShortened = 0;
    for (const roll of PINNED_DURATION_ROLLS) {
      const unaided = setbackDurationFor(roll, 0);
      const withPhysio = setbackDurationFor(roll, 1);
      const where = `duration roll ${roll} (unaided ${unaided} days)`;

      // STRICTLY SHORTER than the same setback unaided, wherever there is a day
      // left above the floor to take off. Not "no longer than", which a model
      // ignoring `physioDaysSaved` satisfies exactly.
      if (unaided > floor) {
        expect(withPhysio, where).toBeLessThan(unaided);
        strictlyShortened += 1;
      }
      // And shorter by exactly one day, floored — the relationship, not just
      // its direction.
      expect(withPhysio, where).toBe(Math.max(floor, unaided - 1));
      expect(withPhysio, where).toBeGreaterThanOrEqual(floor);
    }
    // Non-vacuity: at least one rollable setback is long enough for a single
    // physio day to shorten it. Without this the loop above would still pass if
    // every setback already sat on the floor with nothing left to take off.
    expect(strictlyShortened).toBeGreaterThan(0);

    // More physio never lengthens a setback and never digs below the floor —
    // GDD §3.5 keeps it a setback, so it cannot be bought away entirely.
    for (const roll of PINNED_DURATION_ROLLS) {
      let previous = setbackDurationFor(roll, 0);
      for (let physio = 1; physio <= FATIGUE_TUNING.INJURY_DURATION_DAYS_MAX + 2; physio += 1) {
        const duration = setbackDurationFor(roll, physio);
        const where = `duration roll ${roll}, physio ${physio}`;
        expect(duration, where).toBeLessThanOrEqual(previous);
        expect(duration, where).toBeGreaterThanOrEqual(floor);
        previous = duration;
      }
      expect(previous, `duration roll ${roll} at saturating physio`).toBe(floor);
    }
  });

  it('is at most INJURY_MAX_CHANCE_PER_SESSION even on the worst possible day', () => {
    // Swept as a frequency: the roll is the probability threshold, so counting
    // how many uniform rolls injure measures the probability without exposing it.
    let state = EMPTY_FATIGUE_STATE;
    for (let day = 1; day <= 5; day += 1) {
      state = recordSession(state, maximalSession(day), LUCKIEST_ROLLS).state;
    }
    const SAMPLES = 2000;
    let injuries = 0;
    for (let i = 0; i < SAMPLES; i += 1) {
      const onset = i / SAMPLES;
      if (recordSession(state, maximalSession(6), { onset, duration: 0.5 }).injuryOnset !== null) {
        injuries += 1;
      }
    }
    const observed = injuries / SAMPLES;
    expect(observed).toBeGreaterThan(0);
    expect(observed).toBeLessThanOrEqual(FATIGUE_TUNING.INJURY_MAX_CHANCE_PER_SESSION + 1 / SAMPLES);
  });

  /**
   * G5b at the reference session. This test caught the first draft's threshold
   * and then, at 1.5, became the only point anyone checked — which is how the
   * second draft shipped the same failure 15% up the strain axis. It stays,
   * because the reference session is worth pinning by name, but the guarantee
   * it stands for is now proved across the whole band by
   * `consistency never accrues injury risk (G5, G5b)` above.
   *
   * `UNLUCKIEST_ROLLS.onset` is 0, so this fires the moment the probability
   * leaves zero at any point in the run.
   */
  it('an ordinary hard session carries no injury chance, however many days in a row', () => {
    let state = EMPTY_FATIGUE_STATE;
    for (let day = 1; day <= 60; day += 1) {
      const result = recordSession(state, hardSession(day), UNLUCKIEST_ROLLS);
      expect(result.injuryOnset, `day ${day}`).toBeNull();
      state = result.state;
      expect(activeInjury(state, day + 1)).toBeNull();
    }
  });

  /**
   * GDD §2.3: Arcade technique points buy bar-path efficiency, "which reduces
   * injury risk in Sim".
   *
   * BOTH HALVES ARE MEASURED. The earlier draft of this test resolved both
   * branches against `UNLUCKIEST_ROLLS` (`onset: 0`), which injures whenever the
   * chance is above zero — so both assertions collapsed into "the chance is
   * still positive" and the *reduction* went unobserved entirely. The chance is
   * recovered as a number here instead, by bisecting `onset`, and compared to
   * what `TECHNIQUE_MAX_RISK_REDUCTION` says it should be.
   */
  it('technique points reduce risk but never remove it entirely (GDD §2.3)', () => {
    const maxReduction = FATIGUE_TUNING.TECHNIQUE_MAX_RISK_REDUCTION;
    // Non-vacuity: at zero, every assertion below is satisfied by a model that
    // ignores `techniqueRating` completely, and GDD §2.3's cross-mode hook does
    // not exist. Above 1 would make technique add risk; at 1 it would buy
    // invulnerability.
    expect(maxReduction).toBeGreaterThan(0);
    expect(maxReduction).toBeLessThan(1);

    let state = EMPTY_FATIGUE_STATE;
    for (let day = 1; day <= 3; day += 1) {
      state = recordSession(state, maximalSession(day), LUCKIEST_ROLLS).state;
    }
    const risky = maximalSession(4);

    const bare = measuredInjuryChance(state, risky);
    expect(bare).toBeGreaterThan(0);

    // THE NUMERIC RELATIONSHIP. A normalised rating `r` scales the chance by
    // exactly `1 - r * TECHNIQUE_MAX_RISK_REDUCTION`. Stated as an equality
    // because every inequality available here ("lower", "not zero") is also
    // true of a model in which technique does nothing.
    for (const rating of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      const measured = measuredInjuryChance(state, risky, { techniqueRating: rating });
      expect(measured, `technique rating ${rating}`).toBeCloseTo(
        bare * (1 - rating * maxReduction),
        12,
      );
    }

    // Ratings arrive normalised to [0, 1] (GDD §2.3), and a caller that hands
    // over a raw point total or a negative buys neither invulnerability nor
    // extra risk.
    expect(measuredInjuryChance(state, risky, { techniqueRating: 12 })).toBeCloseTo(
      measuredInjuryChance(state, risky, { techniqueRating: 1 }),
      12,
    );
    expect(measuredInjuryChance(state, risky, { techniqueRating: -3 })).toBeCloseTo(bare, 12);

    // A rating never raises the chance, at any point on the ramp.
    let previous = bare;
    for (const rating of [0.2, 0.4, 0.6, 0.8, 1]) {
      const measured = measuredInjuryChance(state, risky, { techniqueRating: rating });
      expect(measured, `technique rating ${rating}`).toBeLessThan(previous);
      previous = measured;
    }

    // ...and the half this test already had: at full technique the chance is
    // smaller but still strictly above zero, so the unluckiest roll still
    // injures. `TECHNIQUE_MAX_RISK_REDUCTION` below 1 is what guarantees it.
    const fullTechnique = measuredInjuryChance(state, risky, { techniqueRating: 1 });
    expect(fullTechnique).toBeGreaterThan(0);
    expect(fullTechnique).toBeLessThan(bare);

    const withoutTechnique = recordSession(state, risky, UNLUCKIEST_ROLLS);
    const withTechnique = recordSession(state, risky, UNLUCKIEST_ROLLS, {
      techniqueRating: 1,
    });
    expect(withoutTechnique.injuryOnset).not.toBeNull();
    expect(withTechnique.injuryOnset).not.toBeNull();
  });

  it('starts the day after the session, so the completed session is never retro-capped', () => {
    const state = injuredState();
    const injury = state.injury;
    expect(injury).not.toBeNull();
    if (injury === null) return;
    expect(injury.startDay).toBe(5);
    expect(activeInjury(state, 4)).toBeNull();
    expect(activeInjury(state, 5)).not.toBeNull();
  });

  it('counts down and then disappears', () => {
    const state = injuredState();
    const injury = state.injury;
    if (injury === null) throw new Error('expected an injury');
    for (let day = injury.startDay; day <= injury.endDay; day += 1) {
      const notice = activeInjury(state, day);
      expect(notice).not.toBeNull();
      expect(notice?.daysRemaining).toBe(injury.endDay - day + 1);
    }
    expect(activeInjury(state, injury.endDay + 1)).toBeNull();
  });

  it('caps volume on the affected lift only, and leaves other lifts alone', () => {
    const state = injuredState();
    const injury = state.injury;
    if (injury === null) throw new Error('expected an injury');
    const day = injury.startDay;

    const affected = cappedSession(session(day, { lift: injury.lift, workSets: 10 }), state);
    expect(affected.workSets).toBe(
      Math.round(10 * FATIGUE_TUNING.INJURY_VOLUME_CAP_FRACTION),
    );

    const otherLift = LIFTS.find((lift) => lift !== injury.lift) ?? 'accessory';
    const untouched = cappedSession(session(day, { lift: otherLift, workSets: 10 }), state);
    expect(untouched.workSets).toBe(10);
  });

  it('surfaces GDD §3.5-shaped copy, framed as recoverable', () => {
    const state = injuredState();
    const injury = state.injury;
    if (injury === null) throw new Error('expected an injury');
    const notice = activeInjury(state, injury.startDay);
    if (notice === null) throw new Error('expected a notice');
    expect(notice.headline).toBe('Tweaked lower back');
    expect(notice.volumeReductionPercent).toBe(40);
    expect(notice.detail).toMatch(/^squat volume reduced 40% for \d day(s)?$/);
    expect(notice.reassurance).toBe(FATIGUE_COPY.INJURY_REASSURANCE);
  });

  it('cannot chain: no second setback while one runs or during its immunity window', () => {
    const state = injuredState();
    const injury = state.injury;
    if (injury === null) throw new Error('expected an injury');
    let current = state;
    const lastImmuneDay = injury.endDay + FATIGUE_TUNING.INJURY_IMMUNITY_DAYS_AFTER;
    for (let day = injury.startDay; day <= lastImmuneDay; day += 1) {
      const result = recordSession(current, maximalSession(day), UNLUCKIEST_ROLLS);
      expect(result.injuryOnset, `day ${day}`).toBeNull();
      // And the original setback is never extended (G8).
      expect(result.state.injury?.endDay, `day ${day}`).toBe(injury.endDay);
      current = result.state;
    }
  });

  it('assigns kinds deterministically from the lift — no random pull (GDD §5.3)', () => {
    for (const lift of LIFTS) {
      let state = EMPTY_FATIGUE_STATE;
      for (let day = 1; day <= 3; day += 1) {
        state = recordSession(state, maximalSession(day, lift), LUCKIEST_ROLLS).state;
      }
      // Same lift, two very different duration rolls: the kind must not move.
      const first = recordSession(state, maximalSession(4, lift), { onset: 0, duration: 0 });
      const second = recordSession(state, maximalSession(4, lift), { onset: 0, duration: 0.99 });
      const kind = first.injuryOnset?.kind;
      expect(kind, `lift ${lift}`).toBeDefined();
      expect(second.injuryOnset?.kind).toBe(kind);
      expect(INJURY_KINDS).toContain(kind);
    }
  });
});

// ---------------------------------------------------------------------------
// Horizon (GDD §3.4)
// ---------------------------------------------------------------------------

describe('fatigue washes out on the same-day / next-day horizon (GDD §3.4)', () => {
  it('a hard session is felt tomorrow', () => {
    const rested = EMPTY_FATIGUE_STATE;
    const trained = recordAll(EMPTY_FATIGUE_STATE, [hardSession(1)]);
    const a = signalsFor(trained, 2, NEUTRAL_CHECK_IN);
    const b = signalsFor(rested, 2, NEUTRAL_CHECK_IN);
    expect(a.windowMs).toBeLessThan(b.windowMs);
    expect(a.missChance).toBeGreaterThan(b.missChance);
  });

  it('decays monotonically and reaches baseline exactly, well inside the ledger horizon', () => {
    const trained = recordAll(EMPTY_FATIGUE_STATE, [
      maximalSession(1),
      maximalSession(2),
      maximalSession(3),
    ]);
    const baseline = signalsFor(EMPTY_FATIGUE_STATE, 100, NEUTRAL_CHECK_IN);

    let previous = signalsFor(trained, 4, NEUTRAL_CHECK_IN);
    expect(previous.windowMs).toBeLessThan(baseline.windowMs);

    let recoveredOnDay: number | null = null;
    for (let day = 5; day <= 4 + FATIGUE_TUNING.FATIGUE_MEMORY_DAYS; day += 1) {
      const now = signalsFor(trained, day, NEUTRAL_CHECK_IN);
      expectAtLeastAsGood(now, previous, `washout day ${day}`);
      if (recoveredOnDay === null && now.windowMs === baseline.windowMs) recoveredOnDay = day;
      previous = now;
    }
    expect(recoveredOnDay).not.toBeNull();
    expect(signalsFor(trained, 4 + FATIGUE_TUNING.FATIGUE_MEMORY_DAYS, NEUTRAL_CHECK_IN)).toEqual(
      baseline,
    );
  });

  it('carries no multi-week arc: a session outside the ledger horizon is invisible', () => {
    const ancient = recordAll(EMPTY_FATIGUE_STATE, [maximalSession(1)]);
    const day = 1 + FATIGUE_TUNING.FATIGUE_MEMORY_DAYS + 1;
    expect(signalsFor(ancient, day, NEUTRAL_CHECK_IN)).toEqual(
      signalsFor(EMPTY_FATIGUE_STATE, day, NEUTRAL_CHECK_IN),
    );
  });

  it('accumulates within a session too, and resets between sessions', () => {
    const feel = sessionFeel(EMPTY_FATIGUE_STATE, 1, NEUTRAL_CHECK_IN);
    const first = adjustedTimingWindowMs(BASE_WINDOW_MS, feel, {
      workSetsCompleted: 0,
      repsCompletedInSet: 0,
    });
    const deep = adjustedTimingWindowMs(BASE_WINDOW_MS, feel, {
      workSetsCompleted: 4,
      repsCompletedInSet: 4,
    });
    expect(deep).toBeLessThan(first);
    // Same feel object, no moment: back to the start of the session.
    expect(adjustedTimingWindowMs(BASE_WINDOW_MS, feel)).toBe(first);
    // And it is capped, so a marathon session cannot run away.
    const absurd = adjustedTimingWindowMs(BASE_WINDOW_MS, feel, {
      workSetsCompleted: 500,
      repsCompletedInSet: 500,
    });
    const atCap = adjustedTimingWindowMs(BASE_WINDOW_MS, feel, {
      workSetsCompleted: 100,
      repsCompletedInSet: 100,
    });
    expect(absurd).toBe(atCap);
  });
});

// ---------------------------------------------------------------------------
// Readiness (GDD §3.2)
// ---------------------------------------------------------------------------

describe('readiness check-in (GDD §3.2)', () => {
  it('produces GDD §3.2’s worked examples', () => {
    expect(readinessCheckIn(BEST_CHECK_IN).label).toBe('Feeling primed +5%');
    expect(readinessCheckIn(WORST_CHECK_IN).label).toBe('Grinding today -5%');
    expect(readinessCheckIn(NEUTRAL_CHECK_IN).label).toBe('Steady');
    expect(readinessCheckIn(NEUTRAL_CHECK_IN).loadAdjustmentPercent).toBe(0);
  });

  it('exposes no raw score, only a band, a headline and a signed percentage', () => {
    expect(Object.keys(readinessCheckIn(BEST_CHECK_IN)).sort()).toEqual(
      ['answers', 'band', 'headline', 'label', 'loadAdjustmentPercent'].sort(),
    );
  });

  it('is monotone: better answers never produce a worse band', () => {
    const ladder: readonly ReadinessCheckIn[] = [
      WORST_CHECK_IN,
      { sleep: 'poor', soreness: 'sore', motivation: 'steady' },
      { sleep: 'ok', soreness: 'normal', motivation: 'steady' },
      { sleep: 'good', soreness: 'normal', motivation: 'steady' },
      { sleep: 'good', soreness: 'fresh', motivation: 'steady' },
      BEST_CHECK_IN,
    ];
    let previousRank: number = READINESS_BAND_ORDER.length;
    for (const checkIn of ladder) {
      const rank = READINESS_BAND_ORDER.indexOf(readinessCheckIn(checkIn).band);
      expect(rank).toBeLessThanOrEqual(previousRank);
      previousRank = rank;
    }
  });

  /**
   * THE DIRECTION TEST GDD §3.4 ASKS FOR: "Tighter input timing windows when
   * fatigued; more forgiving when primed."
   */
  it('shifts the timing window in the right direction', () => {
    const fresh = EMPTY_FATIGUE_STATE;
    const primedWindow = adjustedTimingWindowMs(
      BASE_WINDOW_MS,
      sessionFeel(fresh, 1, BEST_CHECK_IN),
    );
    const neutralWindow = adjustedTimingWindowMs(
      BASE_WINDOW_MS,
      sessionFeel(fresh, 1, NEUTRAL_CHECK_IN),
    );
    const roughWindow = adjustedTimingWindowMs(
      BASE_WINDOW_MS,
      sessionFeel(fresh, 1, WORST_CHECK_IN),
    );
    expect(primedWindow).toBeGreaterThan(neutralWindow);
    expect(neutralWindow).toBeGreaterThan(roughWindow);
    // "More forgiving when primed" means wider than the mechanic's own base.
    expect(primedWindow).toBeGreaterThan(BASE_WINDOW_MS);

    // And the same direction on the other three channels.
    const primed = signalsFor(fresh, 1, BEST_CHECK_IN);
    const rough = signalsFor(fresh, 1, WORST_CHECK_IN);
    expect(primed.missChance).toBeLessThan(rough.missChance);
    expect(primed.perceived).toBeLessThan(rough.perceived);
    expect(primed.barSpeedRank).toBeLessThan(rough.barSpeedRank);
  });

  it('property: every signal is monotone in readiness at any fatigue history', () => {
    const rng = makeRng(0xdead10cc);
    for (let trial = 0; trial < 200; trial += 1) {
      let state = EMPTY_FATIGUE_STATE;
      for (let day = 1; day <= 5; day += 1) {
        if (rng() < 0.7) state = recordSession(state, randomSession(rng, day), LUCKIEST_ROLLS).state;
      }
      expectAtLeastAsGood(
        signalsFor(state, 6, BEST_CHECK_IN),
        signalsFor(state, 6, NEUTRAL_CHECK_IN),
        `trial ${trial}: primed vs neutral`,
      );
      expectAtLeastAsGood(
        signalsFor(state, 6, NEUTRAL_CHECK_IN),
        signalsFor(state, 6, WORST_CHECK_IN),
        `trial ${trial}: neutral vs rough`,
      );
    }
  });

  it('rejects an answer outside the three options', () => {
    expect(() =>
      readinessCheckIn({ ...NEUTRAL_CHECK_IN, sleep: 'great' as never }),
    ).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// The four channels
// ---------------------------------------------------------------------------

describe('the channels fatigue is felt through (GDD §3.4)', () => {
  it('keeps the window inside its configured bounds however extreme the state gets', () => {
    const wrecked = recordAll(EMPTY_FATIGUE_STATE, [
      maximalSession(1),
      maximalSession(2),
      maximalSession(3),
      maximalSession(4),
      maximalSession(5),
    ]);
    const worst = adjustedTimingWindowMs(BASE_WINDOW_MS, sessionFeel(wrecked, 6, WORST_CHECK_IN), {
      workSetsCompleted: 100,
      repsCompletedInSet: 100,
    });
    const best = adjustedTimingWindowMs(
      BASE_WINDOW_MS,
      sessionFeel(EMPTY_FATIGUE_STATE, 1, BEST_CHECK_IN),
    );
    expect(worst).toBeGreaterThanOrEqual(
      BASE_WINDOW_MS * FATIGUE_TUNING.TIMING_WINDOW_SCALE_MIN - 1e-6,
    );
    expect(best).toBeLessThanOrEqual(BASE_WINDOW_MS * FATIGUE_TUNING.TIMING_WINDOW_SCALE_MAX + 1e-6);
  });

  it('keeps miss chance a probability whatever the burden', () => {
    const rng = makeRng(4_000_037);
    const wrecked = recordAll(EMPTY_FATIGUE_STATE, [maximalSession(1), maximalSession(2)]);
    for (let i = 0; i < 200; i += 1) {
      const base = rng();
      const feel = sessionFeel(rng() < 0.5 ? wrecked : EMPTY_FATIGUE_STATE, 3, randomCheckIn(rng));
      const adjusted = adjustedMissChance(base, feel);
      expect(adjusted).toBeGreaterThanOrEqual(0);
      expect(adjusted).toBeLessThanOrEqual(1);
    }
  });

  it('resolves a rep deterministically from a caller-supplied roll', () => {
    const feel = sessionFeel(EMPTY_FATIGUE_STATE, 1, NEUTRAL_CHECK_IN);
    const chance = adjustedMissChance(0.3, feel);
    expect(resolveRepAttempt(0.3, feel, 0)).toBe('missed');
    expect(resolveRepAttempt(0.3, feel, 0.999999)).toBe('made');
    expect(resolveRepAttempt(0.3, feel, chance)).toBe('made');
    expect(resolveRepAttempt(0.3, feel, chance - 1e-9)).toBe('missed');
  });

  it('snaps perceived RPE onto the published chart grid and stays inside its range', () => {
    const rng = makeRng(5_000_011);
    const wrecked = recordAll(EMPTY_FATIGUE_STATE, [maximalSession(1), maximalSession(2)]);
    for (let i = 0; i < 200; i += 1) {
      const feel = sessionFeel(rng() < 0.5 ? wrecked : EMPTY_FATIGUE_STATE, 3, randomCheckIn(rng));
      const value = perceivedRpe(6 + Math.floor(rng() * 9) * 0.5, feel);
      expect(value).toBeGreaterThanOrEqual(6);
      expect(value).toBeLessThanOrEqual(10);
      expect(Math.round(value * 2) / 2).toBeCloseTo(value, 9);
    }
  });

  /**
   * The coarseness claim in `perceivedRpe`'s docstring, measured rather than
   * asserted. Sweeps the whole reachable burden range — every fatigue history
   * shape crossed with every check-in and a deep within-session moment — and
   * counts how many distinct shifts come out the other side.
   *
   * Five is not a guarantee of anything; it is the number, and it is here so
   * that a retune which turns this channel into a fine-grained readout shows up
   * as a diff rather than as a slowly-worsening leak.
   */
  it('exposes only a handful of distinct perceived-RPE shifts', () => {
    const states: FatigueState[] = [EMPTY_FATIGUE_STATE];
    let building = EMPTY_FATIGUE_STATE;
    for (let day = 1; day <= 12; day += 1) {
      building = recordSession(
        building,
        day % 2 === 0 ? maximalSession(day) : hardSession(day),
        LUCKIEST_ROLLS,
      ).state;
      states.push(building);
    }
    const shifts = new Set<number>();
    for (const state of states) {
      for (const sleep of SLEEP_ANSWERS) {
        for (const soreness of SORENESS_ANSWERS) {
          for (const motivation of MOTIVATION_ANSWERS) {
            const feel = sessionFeel(state, 13, { sleep, soreness, motivation });
            for (const sets of [0, 2, 6, 100]) {
              const shift =
                perceivedRpe(8, feel, { workSetsCompleted: sets, repsCompletedInSet: sets }) - 8;
              shifts.add(shift);
            }
          }
        }
      }
    }
    expect([...shifts].sort((a, b) => a - b)).toEqual([-0.5, 0, 0.5, 1, 1.5]);
  });

  it('reports a grinding bar-speed cue when wrecked and a fast one when primed', () => {
    const wrecked = recordAll(EMPTY_FATIGUE_STATE, [
      maximalSession(1),
      maximalSession(2),
      maximalSession(3),
    ]);
    expect(sessionFeel(wrecked, 4, WORST_CHECK_IN).barSpeed).toBe('grinding');
    expect(sessionFeel(EMPTY_FATIGUE_STATE, 1, BEST_CHECK_IN).barSpeed).toBe('popping');
    expect(sessionFeel(EMPTY_FATIGUE_STATE, 1, NEUTRAL_CHECK_IN).barSpeed).toBe('as-expected');
  });

  it('gives every cue and band its copy', () => {
    for (const cue of BAR_SPEED_CUE_ORDER) {
      expect(FATIGUE_COPY.BAR_SPEED_TEXT[cue]).toBeTypeOf('string');
    }
    for (const band of READINESS_BAND_ORDER) {
      expect(FATIGUE_COPY.READINESS_HEADLINE[band]).toBeTypeOf('string');
    }
    for (const kind of INJURY_KINDS) {
      expect(FATIGUE_COPY.INJURY_HEADLINE[kind]).toBeTypeOf('string');
    }
    for (const lift of SIM_LIFTS) {
      expect(FATIGUE_COPY.LIFT_LABEL[lift]).toBeTypeOf('string');
    }
  });
});

// ---------------------------------------------------------------------------
// TUNING INVARIANTS — derived from FATIGUE_TUNING, so retuning cannot quietly
// break a guarantee.
// ---------------------------------------------------------------------------

describe('tuning invariants: the guarantees survive a hand-tuning pass', () => {
  /** G1: the free session must actually be free at whatever weights are set. */
  it('the recovery template stays under the free allowance', () => {
    const weights = FATIGUE_TUNING.RPE_STRAIN_WEIGHTS;
    const entry = weights.find((w) => w.rpe === FATIGUE_TUNING.RECOVERY_SESSION_RPE);
    expect(entry, 'RECOVERY_SESSION_RPE must be on the strain-weight curve').toBeDefined();
    const rawIndex =
      FATIGUE_TUNING.RECOVERY_SESSION_WORK_SETS *
      FATIGUE_TUNING.RECOVERY_SESSION_REPS_PER_SET *
      (entry?.weight ?? Number.POSITIVE_INFINITY);
    expect(rawIndex).toBeLessThanOrEqual(FATIGUE_TUNING.STRAIN_FREE_ALLOWANCE);
    // And the module agrees, through the public API.
    expect(isFreeSession(recoverySessionFor(1, 'squat'))).toBe(true);
  });

  /** G2: the flush must be a real discount, or showing up stops dominating. */
  it('the active-recovery flush is strictly below 1', () => {
    expect(FATIGUE_TUNING.ACTIVE_RECOVERY_FLUSH).toBeLessThan(1);
    expect(FATIGUE_TUNING.ACTIVE_RECOVERY_FLUSH).toBeGreaterThan(0);
  });

  /**
   * G3, and the reason it needs no derivation any more. Injury reads today's
   * strain against the threshold and nothing else, and a free session's strain
   * is exactly zero — so a positive threshold is the entire proof, at any
   * fatigue history, forever.
   */
  it('the injury threshold is positive, so a free session can never injure', () => {
    expect(FATIGUE_TUNING.INJURY_STRAIN_THRESHOLD).toBeGreaterThan(0);
  });

  /**
   * G5b, derived rather than simulated, and this time derived from the SESSION
   * rather than from a hardcoded 1. An ordinary hard day must not carry a
   * chance; if the threshold were ever tuned below the reference session, a
   * normal hard day would become risky and GDD §3.5's "rare" would be gone.
   *
   * Note what this test can no longer be fooled by: there is no residual term to
   * settle, so this is not "the plateau of daily training stays under the line",
   * it is "an ordinary hard day is under the line", and repetition cannot move
   * it because repetition is not an input.
   */
  it('the reference hard session sits below the injury threshold', () => {
    expect(REFERENCE_HARD_STRAIN).toBeCloseTo(1, 9);
    expect(REFERENCE_HARD_STRAIN).toBeLessThan(FATIGUE_TUNING.INJURY_STRAIN_THRESHOLD);
  });

  /**
   * The other side of it: a session materially harder than an ordinary hard day
   * must still be able to injure, or GDD §3.5's setbacks become dead code. The
   * ceiling is what makes this reachable at all, so it is checked against the
   * threshold directly as well as through the model.
   */
  it('a genuinely overreaching session can still injure', () => {
    expect(FATIGUE_TUNING.INJURY_STRAIN_THRESHOLD).toBeLessThan(
      FATIGUE_TUNING.MAX_SESSION_STRAIN,
    );
    let state = EMPTY_FATIGUE_STATE;
    for (let day = 1; day <= 4; day += 1) {
      state = recordSession(state, hardSession(day), LUCKIEST_ROLLS).state;
    }
    expect(recordSession(state, maximalSession(5), UNLUCKIEST_ROLLS).injuryOnset).not.toBeNull();
  });

  /**
   * `strainOf` is a reimplementation, so it is pinned against the two places the
   * public API makes strain observable: `isFreeSession` is true exactly at
   * strain zero, and — since injury now reads today's strain and nothing else —
   * a session injures a fresh lifter under the unluckiest roll exactly when its
   * strain is above the threshold. If the module's curve and this one ever
   * diverge, the strain sweep above stops meaning what it says and this fails.
   */
  it('the derived strain formula tracks the module', () => {
    const rng = makeRng(0x57241e);
    for (let trial = 0; trial < 400; trial += 1) {
      const candidate = randomSession(rng, 1);
      const strain = strainOf(candidate);
      expect(isFreeSession(candidate), describeTemplate(candidate)).toBe(strain === 0);
      expect(
        recordSession(EMPTY_FATIGUE_STATE, candidate, UNLUCKIEST_ROLLS).injuryOnset !== null,
        describeTemplate(candidate),
      ).toBe(strain > FATIGUE_TUNING.INJURY_STRAIN_THRESHOLD);
    }
    for (const template of STRAIN_SWEEP) {
      const candidate: SessionRecord = { day: 1, ...template };
      expect(isFreeSession(candidate), describeTemplate(template)).toBe(strainOf(candidate) === 0);
    }
  });

  /**
   * The ledger horizon must be long enough that truncating it cannot move a
   * signal — otherwise the memory window is a visible cliff rather than an
   * implementation detail.
   */
  it('the ledger horizon is long enough to hide its own edge', () => {
    const worstTruncationError =
      steadyStateResidualBound() *
      FATIGUE_TUNING.DAILY_DECAY ** FATIGUE_TUNING.FATIGUE_MEMORY_DAYS;
    expect(worstTruncationError).toBeLessThan(FATIGUE_TUNING.RESIDUAL_FLOOR);
  });

  it('decay is steep enough to be a next-day horizon, not a multi-week one', () => {
    expect(FATIGUE_TUNING.DAILY_DECAY).toBeGreaterThan(0);
    expect(FATIGUE_TUNING.DAILY_DECAY).toBeLessThan(1);
    // Half of a hard session must be gone by the following morning, or this is
    // no longer the horizon GDD §3.4 describes.
    expect(FATIGUE_TUNING.DAILY_DECAY).toBeLessThanOrEqual(0.5);
  });

  it('technique reduces some injury risk, and can never remove all of it', () => {
    // Strictly above zero, or GDD §2.3's "technique points ... reduce injury
    // risk in Sim" is not a thing the model does — and every technique test
    // becomes satisfiable by ignoring the rating.
    expect(FATIGUE_TUNING.TECHNIQUE_MAX_RISK_REDUCTION).toBeGreaterThan(0);
    // Strictly below one, or maximum technique is invulnerability.
    expect(FATIGUE_TUNING.TECHNIQUE_MAX_RISK_REDUCTION).toBeLessThan(1);
  });

  it('the injury duration band matches GDD §3.5 (2-3 days) and can only shorten', () => {
    expect(FATIGUE_TUNING.INJURY_DURATION_DAYS_MIN).toBe(2);
    expect(FATIGUE_TUNING.INJURY_DURATION_DAYS_MAX).toBe(3);
    expect(FATIGUE_TUNING.INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO).toBeGreaterThanOrEqual(1);
    expect(FATIGUE_TUNING.INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO).toBeLessThanOrEqual(
      FATIGUE_TUNING.INJURY_DURATION_DAYS_MIN,
    );
  });

  it('the volume cap always leaves a session that can be completed', () => {
    expect(FATIGUE_TUNING.MIN_WORK_SETS_WHILE_INJURED).toBeGreaterThanOrEqual(1);
    expect(FATIGUE_TUNING.INJURY_VOLUME_CAP_FRACTION).toBeGreaterThan(0);
    expect(FATIGUE_TUNING.INJURY_VOLUME_CAP_FRACTION).toBeLessThan(1);
  });

  it('the miss-odds multiplier can never reach zero or invert', () => {
    expect(FATIGUE_TUNING.MISS_ODDS_MULTIPLIER_MIN).toBeGreaterThan(0);
    expect(FATIGUE_TUNING.MISS_ODDS_MULTIPLIER_MAX).toBeGreaterThan(
      FATIGUE_TUNING.MISS_ODDS_MULTIPLIER_MIN,
    );
  });

  it('the window scale band brackets 1, so priming is felt and fatigue is survivable', () => {
    expect(FATIGUE_TUNING.TIMING_WINDOW_SCALE_MIN).toBeGreaterThan(0);
    expect(FATIGUE_TUNING.TIMING_WINDOW_SCALE_MIN).toBeLessThan(1);
    expect(FATIGUE_TUNING.TIMING_WINDOW_SCALE_MAX).toBeGreaterThan(1);
  });

  it('the band ladders are ordered, complete, and end in a catch-all', () => {
    const readinessEdges = FATIGUE_TUNING.READINESS_BAND_MIN_SCORE;
    expect(readinessEdges.map((edge) => edge.band)).toEqual([...READINESS_BAND_ORDER]);
    for (let i = 1; i < readinessEdges.length; i += 1) {
      expect(readinessEdges[i]?.minScore).toBeLessThan(readinessEdges[i - 1]?.minScore ?? 0);
    }
    expect(readinessEdges[readinessEdges.length - 1]?.minScore).toBe(Number.NEGATIVE_INFINITY);

    const cueEdges = FATIGUE_TUNING.BAR_SPEED_BAND_MAX_BURDEN;
    expect(cueEdges.map((edge) => edge.cue)).toEqual([...BAR_SPEED_CUE_ORDER]);
    for (let i = 1; i < cueEdges.length; i += 1) {
      expect(cueEdges[i]?.maxBurden).toBeGreaterThan(cueEdges[i - 1]?.maxBurden ?? 0);
    }
    expect(cueEdges[cueEdges.length - 1]?.maxBurden).toBe(Number.POSITIVE_INFINITY);
  });

  it('the strain-weight curve rises with RPE and is stepped on the chart grid', () => {
    const weights = FATIGUE_TUNING.RPE_STRAIN_WEIGHTS;
    expect(weights.length).toBeGreaterThan(1);
    for (let i = 1; i < weights.length; i += 1) {
      const lo = weights[i - 1];
      const hi = weights[i];
      expect(hi?.rpe).toBeGreaterThan(lo?.rpe ?? 0);
      expect(hi?.weight).toBeGreaterThan(lo?.weight ?? 0);
    }
    expect(weights[0]?.rpe).toBe(6);
    expect(weights[weights.length - 1]?.rpe).toBe(10);
  });

  it('the tuning and copy objects are frozen against runtime edits', () => {
    expect(Object.isFrozen(FATIGUE_TUNING)).toBe(true);
    expect(Object.isFrozen(FATIGUE_COPY)).toBe(true);
    expect(Object.isFrozen(FATIGUE_TUNING.RPE_STRAIN_WEIGHTS)).toBe(true);
    expect(Object.isFrozen(FATIGUE_TUNING.READINESS_ANSWER_SCORE)).toBe(true);
    expect(Object.isFrozen(FATIGUE_COPY.BAR_SPEED_TEXT)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Purity and hygiene
// ---------------------------------------------------------------------------

describe('purity, determinism and input handling', () => {
  it('is deterministic: identical inputs give identical outputs', () => {
    const state = recordAll(EMPTY_FATIGUE_STATE, [hardSession(1), session(2), maximalSession(3)]);
    expect(signalsFor(state, 4, BEST_CHECK_IN)).toEqual(signalsFor(state, 4, BEST_CHECK_IN));
    expect(recordSession(state, hardSession(4), UNLUCKIEST_ROLLS)).toEqual(
      recordSession(state, hardSession(4), UNLUCKIEST_ROLLS),
    );
  });

  it('never mutates the state or the records it is handed', () => {
    const original = recordAll(EMPTY_FATIGUE_STATE, [hardSession(1)]);
    const snapshot = JSON.parse(JSON.stringify(original)) as unknown;
    const incoming = hardSession(2);
    const incomingSnapshot = { ...incoming };
    recordSession(original, incoming, UNLUCKIEST_ROLLS);
    sessionFeel(original, 3, BEST_CHECK_IN);
    cappedSession(incoming, original);
    pruneFatigueState(original, 99);
    expect(JSON.parse(JSON.stringify(original))).toEqual(snapshot);
    expect(incoming).toEqual(incomingSnapshot);
  });

  it('copies records in, so a caller mutating its own object cannot reach into state', () => {
    const mutable: SessionRecord = { day: 1, lift: 'squat', topRpe: 9, workSets: 5, repsPerSet: 3 };
    const state = recordSession(EMPTY_FATIGUE_STATE, mutable, LUCKIEST_ROLLS).state;
    const before = signalsFor(state, 2, NEUTRAL_CHECK_IN);
    (mutable as { workSets: number }).workSets = 500;
    expect(signalsFor(state, 2, NEUTRAL_CHECK_IN)).toEqual(before);
  });

  it('requires sessions in strictly increasing day order', () => {
    const state = recordSession(EMPTY_FATIGUE_STATE, hardSession(5), LUCKIEST_ROLLS).state;
    expect(() => recordSession(state, hardSession(5), LUCKIEST_ROLLS)).toThrow(RangeError);
    expect(() => recordSession(state, hardSession(4), LUCKIEST_ROLLS)).toThrow(RangeError);
    expect(() => recordSession(state, hardSession(6), LUCKIEST_ROLLS)).not.toThrow();
  });

  it('rejects non-integer days, negative volumes and non-finite inputs', () => {
    expect(() => sessionFeel(EMPTY_FATIGUE_STATE, 1.5)).toThrow(RangeError);
    expect(() => activeInjury(EMPTY_FATIGUE_STATE, Number.NaN)).toThrow(RangeError);
    expect(() =>
      recordSession(EMPTY_FATIGUE_STATE, session(1, { workSets: -1 }), LUCKIEST_ROLLS),
    ).toThrow(RangeError);
    expect(() =>
      recordSession(EMPTY_FATIGUE_STATE, session(1, { topRpe: Number.NaN }), LUCKIEST_ROLLS),
    ).toThrow(RangeError);
    expect(() =>
      recordSession(EMPTY_FATIGUE_STATE, session(1), { onset: Number.NaN, duration: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      recordSession(EMPTY_FATIGUE_STATE, session(1), LUCKIEST_ROLLS, { physioDaysSaved: 0.5 }),
    ).toThrow(RangeError);
    expect(() =>
      adjustedTimingWindowMs(0, sessionFeel(EMPTY_FATIGUE_STATE, 1)),
    ).toThrow(RangeError);
    expect(() => recoverySessionFor(1, 'bicep-curl' as never)).toThrow(RangeError);
  });

  it('treats an off-grid RPE by interpolating rather than refusing (it is a feel curve)', () => {
    const odd = recordAll(EMPTY_FATIGUE_STATE, [session(1, { topRpe: 8.3, workSets: 5, repsPerSet: 5 })]);
    const low = recordAll(EMPTY_FATIGUE_STATE, [session(1, { topRpe: 8, workSets: 5, repsPerSet: 5 })]);
    const high = recordAll(EMPTY_FATIGUE_STATE, [session(1, { topRpe: 8.5, workSets: 5, repsPerSet: 5 })]);
    const oddWindow = signalsFor(odd, 2, NEUTRAL_CHECK_IN).windowMs;
    expect(oddWindow).toBeLessThanOrEqual(signalsFor(low, 2, NEUTRAL_CHECK_IN).windowMs);
    expect(oddWindow).toBeGreaterThanOrEqual(signalsFor(high, 2, NEUTRAL_CHECK_IN).windowMs);
  });

  it('pruning cannot change any signal', () => {
    const rng = makeRng(6_000_023);
    for (let trial = 0; trial < 100; trial += 1) {
      let state = EMPTY_FATIGUE_STATE;
      for (let day = 1; day <= 10; day += 1) {
        if (rng() < 0.8) state = recordSession(state, randomSession(rng, day), LUCKIEST_ROLLS).state;
      }
      const day = 11;
      expect(signalsFor(pruneFatigueState(state, day), day, NEUTRAL_CHECK_IN)).toEqual(
        signalsFor(state, day, NEUTRAL_CHECK_IN),
      );
    }
  });

  it('keeps persisted state bounded no matter how long the career runs', () => {
    let state = EMPTY_FATIGUE_STATE;
    for (let day = 1; day <= 400; day += 1) {
      state = recordSession(state, hardSession(day), LUCKIEST_ROLLS).state;
    }
    expect(state.sessions.length).toBeLessThanOrEqual(FATIGUE_TUNING.FATIGUE_MEMORY_DAYS + 1);
  });
});

// ---------------------------------------------------------------------------
// CONSISTENCY NEVER ACCRUES INJURY RISK (G5, G5b) — the regression suite
//
// The previous draft failed here and its tests did not look. They pinned
// ORDINARY_HARD_STRAIN = 1, which was precisely and only the point the shipped
// threshold cleared, and both daily-engagement property tests put a FREE session
// on the decision day — so the band of sessions that were individually safe but
// unsafe when repeated was never generated at all.
//
// Everything below puts a REAL session on the decision day and sweeps the band.
// ---------------------------------------------------------------------------

describe('consistency never accrues injury risk (G5, G5b)', () => {
  /**
   * THE CASE THAT SENT THE PREVIOUS DRAFT BACK, kept as a regression test with
   * its numbers. 5x3 @ RPE 9.5 is the suite's own reference hard session with
   * the RPE nudged by the smallest step the published chart allows — strain
   * 1.3333, individually safe at the shipped threshold.
   *
   * Before the fix, with the unluckiest possible roll: 6 setbacks over 40 daily
   * sessions, the first on day 2, against 0 over 40 every-other-day sessions.
   * Identical content, identical per-session choice; the only variable was
   * whether the player showed up the day before.
   */
  it('regression: 5x3 @ RPE 9.5 is injury-free on both schedules, not just the sparse one', () => {
    const template: SessionTemplate = {
      lift: 'squat',
      topRpe: 9.5,
      workSets: 5,
      repsPerSet: 3,
    };
    // The session the critic's case is built on must actually sit below the
    // threshold, or this test passes for the wrong reason after a retune.
    expect(strainOf({ day: 1, ...template })).toBeLessThan(
      FATIGUE_TUNING.INJURY_STRAIN_THRESHOLD,
    );
    expect(strainOf({ day: 1, ...template })).toBeGreaterThan(REFERENCE_HARD_STRAIN);

    const daily = runSchedule(template, 1, 40);
    const everyOtherDay = runSchedule(template, 2, 40);

    expect(daily.injuries, 'training every day').toBe(0);
    expect(everyOtherDay.injuries, 'training every other day').toBe(0);
    expect(daily.firstInjuryDay).toBeNull();
  });

  /**
   * THE BAND THE OLD TESTS NEVER GENERATED, as a property.
   *
   * `DANGEROUS_BAND` is every real session whose strain is individually safe but
   * large enough that a model reading carried-in residual would have made it
   * unsafe once repeated. The bound is derived from the tuning constants, not
   * restated: `k` is the residual a session of strain s settles at when repeated
   * daily forever, so a residual-reading model with any weight up to 1 turns s
   * dangerous once `s (1 + k) > threshold`.
   *
   * The band is asserted non-empty first. A vacuous property test is how the
   * previous draft passed while broken.
   */
  it('property: every session in the dangerous band stays injury-free repeated daily forever', () => {
    expect(DANGEROUS_BAND.length, 'the band must not be empty or this proves nothing').toBeGreaterThan(
      0,
    );
    for (const template of DANGEROUS_BAND) {
      const label = describeTemplate(template);
      // 60 days is well past the point residual has settled, and onset 0 injures
      // the instant the probability leaves zero.
      const run = runSchedule(template, 1, 60);
      expect(run.injuries, `${label}: repeated daily for 60 days`).toBe(0);
    }
  });

  /**
   * THE TWO-SCHEDULE COMPARISON, swept across the whole strain axis rather than
   * at one point: below the threshold, inside the dangerous band, at the
   * threshold, and well above it.
   *
   * Below the threshold both schedules must be exactly zero. Above it, both
   * schedules injure — that is GDD §3.5 working — and the daily schedule must
   * never come off worse than the sparse one, which is the guarantee GDD §3.5
   * and §4 actually draw.
   */
  it('property: training daily never yields more setbacks than training every other day', () => {
    // The sweep has to actually span the threshold, or the branches below are
    // decoration. Both sides are asserted non-empty before anything is measured.
    const strains = STRAIN_SWEEP.map((template) => strainOf({ day: 1, ...template }));
    expect(strains.filter((s) => s === 0).length, 'free sessions in the sweep').toBeGreaterThan(0);
    expect(
      strains.filter((s) => s > 0 && s <= FATIGUE_TUNING.INJURY_STRAIN_THRESHOLD).length,
      'sessions below the threshold',
    ).toBeGreaterThan(0);
    expect(
      strains.filter((s) => s > FATIGUE_TUNING.INJURY_STRAIN_THRESHOLD).length,
      'sessions above the threshold',
    ).toBeGreaterThan(0);
    expect(Math.max(...strains), 'the sweep reaches the model ceiling').toBe(
      FATIGUE_TUNING.MAX_SESSION_STRAIN,
    );

    for (const template of STRAIN_SWEEP) {
      const label = describeTemplate(template);
      const strain = strainOf({ day: 1, ...template });
      const daily = runSchedule(template, 1, 40);
      const everyOtherDay = runSchedule(template, 2, 40);
      const everyThirdDay = runSchedule(template, 3, 40);

      if (strain <= FATIGUE_TUNING.INJURY_STRAIN_THRESHOLD) {
        expect(daily.injuries, `${label}: below threshold, daily`).toBe(0);
        expect(everyOtherDay.injuries, `${label}: below threshold, every other day`).toBe(0);
        expect(everyThirdDay.injuries, `${label}: below threshold, every third day`).toBe(0);
      } else {
        expect(daily.injuries, `${label}: above threshold, daily`).toBeGreaterThan(0);
        expect(daily.injuries, `${label}: daily vs every other day`).toBeLessThanOrEqual(
          everyOtherDay.injuries,
        );
        expect(daily.injuries, `${label}: daily vs every third day`).toBeLessThanOrEqual(
          everyThirdDay.injuries,
        );
      }
    }
  });

  /**
   * G4/G5 AT THE CAUSE. The chance itself — recovered exactly by bisecting the
   * onset roll, which `recordSession` resolves against — must not move with
   * history. Randomised histories, dense and sparse, brutal and light, against
   * the same decision-day session.
   *
   * This is the test that fails the moment anyone passes residual, a day index
   * or an attendance count back into `injuryProbability`.
   */
  it('property: the chance a session carries is identical whatever the history before it', () => {
    const rng = makeRng(0x7a11ed);
    for (let trial = 0; trial < 300; trial += 1) {
      const decisionDay = 30;
      // Half from the curated sweep so the named strain landmarks are covered,
      // half fully random so "ANY session" in G5b is not just "any of thirteen".
      const today =
        rng() < 0.5
          ? pick(rng, STRAIN_SWEEP, REFERENCE_HARD_TEMPLATE)
          : templateOf(randomSession(rng, 1));
      const decision: SessionRecord = { day: decisionDay, ...today };

      // Fresh: never trained at all.
      const fresh = EMPTY_FATIGUE_STATE;
      // Daily: trained every single day up to yesterday.
      let daily = EMPTY_FATIGUE_STATE;
      // Sparse: trained the same content, but only every third day.
      let sparse = EMPTY_FATIGUE_STATE;
      // Brutal: maximal sessions every day up to yesterday.
      let brutal = EMPTY_FATIGUE_STATE;
      const historyContent =
        rng() < 0.5
          ? pick(rng, STRAIN_SWEEP, REFERENCE_HARD_TEMPLATE)
          : templateOf(randomSession(rng, 1));
      for (let day = 1; day < decisionDay; day += 1) {
        daily = recordSession(daily, { day, ...historyContent }, LUCKIEST_ROLLS).state;
        if (day % 3 === 0) {
          sparse = recordSession(sparse, { day, ...historyContent }, LUCKIEST_ROLLS).state;
        }
        brutal = recordSession(brutal, maximalSession(day), LUCKIEST_ROLLS).state;
      }

      // G5b's exact wording: "the chance that session carries on its own, on day
      // one, to a completely fresh lifter". Both readings of "fresh" are pinned.
      const reference = measuredInjuryChance(EMPTY_FATIGUE_STATE, { day: 1, ...today });
      expect(measuredInjuryChance(fresh, decision), `trial ${trial}: fresh on day ${decisionDay}`).toBe(
        reference,
      );

      for (const [name, state] of [
        ['daily', daily],
        ['sparse', sparse],
        ['brutal', brutal],
      ] as const) {
        // Vacuity guard: if a history had picked up a setback, its chance would
        // be zeroed by the immunity window and equality would mean nothing.
        expect(state.injury, `trial ${trial}: ${name} history must be injury-free`).toBeNull();
        expect(
          measuredInjuryChance(state, decision),
          `trial ${trial}: ${describeTemplate(today)} after a ${name} history`,
        ).toBe(reference);
      }
    }
  });

  /**
   * G4 WITH A REAL SESSION ON THE DECISION DAY. The old version of this property
   * put a FREE session there, which is the easy half. Here the player who shows
   * up does genuine work — drawn from the dangerous band and above — and must
   * still never be injured on a later session that the player who skipped
   * survives, with the same roll.
   */
  it('property: a real session today never causes an injury that resting today would have avoided', () => {
    const rng = makeRng(0x5c1ed);
    for (let trial = 0; trial < 400; trial += 1) {
      let shared = EMPTY_FATIGUE_STATE;
      const historyDays = 1 + Math.floor(rng() * 5);
      for (let day = 1; day <= historyDays; day += 1) {
        if (rng() < 0.8) {
          shared = recordSession(shared, randomSession(rng, day), LUCKIEST_ROLLS).state;
        }
      }
      const decisionDay = historyDays + 1;
      const todaysWork = pick(rng, STRAIN_SWEEP, REFERENCE_HARD_TEMPLATE);
      const trained = recordSession(
        shared,
        { day: decisionDay, ...todaysWork },
        LUCKIEST_ROLLS,
      ).state;

      const laterDay = decisionDay + 1;
      const later: SessionRecord = {
        day: laterDay,
        ...pick(rng, STRAIN_SWEEP, REFERENCE_HARD_TEMPLATE),
      };
      const roll: InjuryRolls = { onset: rng() * 0.1, duration: rng() };

      const afterTraining = recordSession(trained, later, roll);
      const afterResting = recordSession(shared, later, roll);
      if (afterTraining.injuryOnset !== null) {
        expect(afterResting.injuryOnset, `trial ${trial}`).not.toBeNull();
      }
    }
  });

  /**
   * The counter-check, so the guarantee is not passing because injury is
   * unreachable. A session materially harder than an ordinary hard day still
   * carries a chance, on day one, to a completely fresh lifter — no fatigue
   * history required to unlock it.
   */
  it('an overreaching session injures a completely fresh lifter on day one', () => {
    const overreaching = STRAIN_SWEEP.filter(
      (template) =>
        strainOf({ day: 1, ...template }) > FATIGUE_TUNING.INJURY_STRAIN_THRESHOLD,
    );
    expect(overreaching.length).toBeGreaterThan(0);
    for (const template of overreaching) {
      const result = recordSession(
        EMPTY_FATIGUE_STATE,
        { day: 1, ...template },
        UNLUCKIEST_ROLLS,
      );
      expect(result.injuryOnset, describeTemplate(template)).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// GDD §3.4 — successful work is a credit unit, not a load percent
// ---------------------------------------------------------------------------

describe('sessionStimulusCredit — GDD §3.4, earned not tapped', () => {
  it('pins the reference rectangle against the shipped 5×3 template', () => {
    expect(FATIGUE_TUNING.STIMULUS_PRESCRIBED_REPS).toBe(SESSION_TUNING.REPS_PER_SET);
    expect(FATIGUE_TUNING.STIMULUS_REFERENCE_VOLUME).toBe(
      SESSION_TUNING.WORK_SETS * SESSION_TUNING.REPS_PER_SET,
    );
    const effort = FATIGUE_TUNING.STIMULUS_EFFORT_WEIGHTS;
    const weightAt = (rpe: number): number => {
      const row = effort.find((entry) => entry.rpe === rpe);
      if (row === undefined) throw new Error(`missing effort weight for RPE ${rpe}`);
      return row.weight;
    };
    expect(weightAt(6)).toBe(0);
    expect(weightAt(7)).toBeGreaterThan(0);
    expect(weightAt(7)).toBeLessThan(1);
    expect(weightAt(8)).toBe(1);
    expect(weightAt(9)).toBe(1);
    expect(weightAt(10)).toBe(1);
  });

  it('empty / recovery / failure-only is 0', () => {
    expect(
      sessionStimulusCredit({
        day: 0,
        lift: 'squat',
        topRpe: 6,
        workSets: 5,
        repsPerSet: 3,
      }),
    ).toBe(0);
    expect(
      sessionStimulusCredit({
        day: 0,
        lift: 'squat',
        topRpe: 10,
        workSets: 5,
        repsPerSet: 2,
      }),
    ).toBe(0);
  });

  it('a completed productive session of this lift is 1.0 of a template', () => {
    expect(sessionStimulusCredit(hardSession(0, 'squat'))).toBe(1);
  });

  it('completed RPE 8, 9 and 10 of the same volume earn the same unit — the menu pick is not the reward', () => {
    const template = { lift: 'squat' as const, workSets: 5, repsPerSet: 3, day: 0 };
    const creditAt = (rpe: number): number => sessionStimulusCredit({ ...template, topRpe: rpe });
    expect(creditAt(6)).toBe(0);
    expect(creditAt(7)).toBeGreaterThan(0);
    expect(creditAt(7)).toBeLessThan(creditAt(8));
    expect(creditAt(8)).toBe(1);
    expect(creditAt(9)).toBe(creditAt(8));
    expect(creditAt(10)).toBe(creditAt(8));
  });

  it('short completed volume earns a fraction; last-set-miss volume earns less than a full template', () => {
    const full = sessionStimulusCredit({
      day: 0,
      lift: 'squat',
      topRpe: 8,
      workSets: 5,
      repsPerSet: 3,
    });
    const four = sessionStimulusCredit({
      day: 0,
      lift: 'squat',
      topRpe: 8,
      workSets: 4,
      repsPerSet: 3,
    });
    expect(four).toBeGreaterThan(0);
    expect(four).toBeLessThan(full);
    expect(
      sessionStimulusCredit({ day: 0, lift: 'squat', topRpe: 10, workSets: 3, repsPerSet: 3 }),
    ).toBe(sessionStimulusCredit({ day: 0, lift: 'squat', topRpe: 8, workSets: 3, repsPerSet: 3 }));
  });

  it('is not a function of check-in — the self-report exploit on load is closed', () => {
    const credit = sessionStimulusCredit(hardSession(0, 'squat'));
    expect(sessionFeel(EMPTY_FATIGUE_STATE, 0, BEST_CHECK_IN).readiness.loadAdjustmentPercent).toBe(
      FATIGUE_TUNING.READINESS_LOAD_ADJUSTMENT_PERCENT.primed,
    );
    expect(sessionFeel(EMPTY_FATIGUE_STATE, 0, WORST_CHECK_IN).readiness.loadAdjustmentPercent).toBe(
      FATIGUE_TUNING.READINESS_LOAD_ADJUSTMENT_PERCENT.grinding,
    );
    expect(credit).not.toBe(
      sessionFeel(EMPTY_FATIGUE_STATE, 0, BEST_CHECK_IN).readiness.loadAdjustmentPercent,
    );
  });
});
