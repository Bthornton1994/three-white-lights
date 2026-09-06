/**
 * fatigue.ts — hidden fatigue, readiness check-in and injury setbacks for Sim
 * mode (GDD §3.1, §3.2, §3.4, §3.5).
 *
 * PURITY CONTRACT (CLAUDE.md "Pure logic is separate from UI", GDD §9.2):
 *   - Zero React imports, zero I/O, zero side effects.
 *   - No `Date.now()`. The current day is an integer the caller supplies.
 *   - No `Math.random()`. Injury chance is resolved against caller-supplied
 *     rolls, so a test can pin the unluckiest possible outcome by passing 0.
 *   - Every transition returns a new state; inputs are never mutated and every
 *     record the caller hands in is copied before it is stored.
 *   - The one thing evaluated at module load is `Symbol('fatigue.feel')` (see
 *     WHY `SessionFeel` HAS A HIDDEN HALF). No function's output depends on
 *     which symbol it got.
 *
 * NOT DOMAIN-CORRECTNESS TERRITORY. CLAUDE.md puts fatigue and injury
 * deliberately outside the checkable-by-real-powerlifters category, and GDD
 * §3.1 calls them "a game-feel abstraction that behaves plausibly, not a
 * rigorous sports-science model". Nothing below is sourced from a publication
 * and nothing below claims to be. Every number in `FATIGUE_TUNING` is an
 * untuned placeholder chosen to be plausible; GDD §12.1 budgets roughly 30
 * hand-tuning passes on exactly this class of value.
 *
 * ---------------------------------------------------------------------------
 * REFUSAL CONDITION 1 — "A VISIBLE FATIGUE METER" (GDD §3.4, §12.3)
 * ---------------------------------------------------------------------------
 * GDD §3.4: "Hidden stat. Never display a fatigue bar."
 *
 * The public API is where that is won or lost, so it is designed around it:
 *
 *   - NO EXPORT RETURNS A FATIGUE LEVEL. `sessionStrain`, `residualAtStartOfDay`
 *     and `burden` — the three internal scalars this model actually runs on —
 *     are module-private and are not re-exported under any name.
 *     `fatigue.test.ts` pins the complete list of runtime exports, so adding one
 *     is a deliberate edit that fails a test until the list is updated.
 *   - THE PERSISTED STATE IS A LEDGER, NOT A LEVEL. `FatigueState` holds the raw
 *     sessions the player actually did (day, lift, top RPE, sets, reps) plus an
 *     injury record. Nothing in it is interpreted, so there is no field a UI
 *     could bind a bar to. It is plain JSON and survives a round trip, which a
 *     server-authoritative store (CLAUDE.md) needs.
 *   - THE INTERPRETED HALF IS OPAQUE. `sessionFeel` returns a `SessionFeel`
 *     whose readable fields are qualitative only — a bar-speed cue band, its
 *     copy, the readiness report, an injury notice. The single number the
 *     mechanic needs lives under a module-private symbol, so it has no property
 *     a caller can name, spread over, or serialise. Same device, and the same
 *     disclosed limits, as `MeetRules` in `meet.ts`.
 *   - WHAT COMES OUT IS ALREADY INTERPRETED. The four channels GDD §3.4 names
 *     are the four things exported: a bar-speed cue (`SessionFeel.barSpeed`), a
 *     shifted sense of what an RPE feels like (`perceivedRpe`), miss likelihood
 *     (`adjustedMissChance`), and input-window width (`adjustedTimingWindowMs`).
 *
 * WHAT THIS DOES NOT CLAIM, said plainly rather than left to be discovered:
 * a determined caller can still infer a level. `adjustedTimingWindowMs` is
 * continuous and monotone in the hidden burden, so calling it twice with two
 * base windows, or once per day and diffing, recovers a monotone transform of
 * the hidden state; `perceivedRpe` leaks a coarser version of the same thing.
 * That is unavoidable in a module whose entire job is to modulate the mechanic —
 * any signal fatigue is *felt* through can be plotted by someone determined to
 * plot it. What is enforced here is that the module never *offers* a level, and
 * that the natural thing to render is a phrase.
 *
 * ---------------------------------------------------------------------------
 * REFUSAL CONDITION 2 — "AN INJURY OR SETBACK THAT PUNISHES A PLAYER FOR
 * SHOWING UP DAILY" (GDD §3.5, §4, §12.3)
 * ---------------------------------------------------------------------------
 * GDD §3.5: injuries are rare, short (2-3 days), always framed as recoverable,
 * a soft consequence rather than stat loss, and must "never punish daily
 * engagement itself".
 *
 * The distinction that makes this encodable: SHOWING UP IS NOT THE SAME AS
 * TRAINING HARD. The player picks an RPE target (GDD §3.3), so every day offers
 * a session that costs nothing. This module makes that literal and testable:
 *
 *   (G1) THERE IS ALWAYS A FREE SESSION. `sessionStrain` subtracts
 *        `STRAIN_FREE_ALLOWANCE` before counting anything, so any session at or
 *        under that allowance contributes exactly zero strain.
 *        `recoverySessionFor` builds one. `fatigue.test.ts` asserts the recovery
 *        template is under the allowance, so a tuner who raises its volume
 *        without raising the allowance breaks a test rather than the guarantee.
 *
 *   (G2) TAKING THAT SESSION IS NEVER WORSE THAN SKIPPING. A day that includes
 *        any session applies `ACTIVE_RECOVERY_FLUSH` (< 1) to the residual
 *        carried in, on top of the ordinary `DAILY_DECAY` a rest day gets. So a
 *        free session decays yesterday harder than doing nothing does and adds
 *        nothing back. Equality holds only at zero residual, where there is
 *        nothing left to flush. Property-tested over randomised histories and
 *        long tails, on every surfaced signal, not on the hidden scalar.
 *
 *   (G3) A FREE SESSION CANNOT INJURE YOU, EVER. Injury chance is a function of
 *        TODAY'S SESSION ALONE (plus an Arcade technique rating that can only
 *        reduce it). A free session's strain is exactly zero, and zero is below
 *        `INJURY_STRAIN_THRESHOLD`, which the suite asserts is positive. No
 *        history, however brutal, can change that — because no history is read.
 *
 *   (G4) TRAINING TODAY NEVER RAISES THE RISK OF ANY LATER SESSION. Two players
 *        who perform the same session face exactly the same chance, whatever
 *        either of them did on any previous day. Property-tested by measuring
 *        that chance — bisecting the `onset` roll, which the module resolves
 *        against — over randomised dense and sparse histories, and asserting
 *        equality rather than an inequality.
 *
 *        History reaches the injury path in exactly ONE place: the immunity
 *        window after a setback, which can only force the chance to zero. It is
 *        named here because "risk reads no history" would otherwise be a claim
 *        with an exception hiding behind it.
 *
 *   (G5) NEITHER ATTENDANCE NOR ACCUMULATED FATIGUE IS AN INPUT TO RISK.
 *        `injuryProbability` takes a session and a technique rating. It has no
 *        parameter for the ledger, the day, a streak, or residual fatigue, so
 *        there is no term for a later retune to put weight on.
 *
 *        THIS IS WHERE THE PREVIOUS DRAFT WAS WRONG, and the shape of the
 *        mistake is worth recording because it recurs. Risk used to read
 *        `strain + INJURY_RESIDUAL_WEIGHT x residual`. Nothing in that
 *        expression names a streak — the header said so, and it was literally
 *        true — but residual is a proxy for days since a rest day, so the player
 *        who trained yesterday carried a strictly higher chance for an identical
 *        session. Raising the threshold from 1.2 to 1.5 only slid the break-even
 *        strain from 0.921 to 1.151 and left the failure intact one half-RPE
 *        step above it: 5x3 @ RPE 9.5 (strain 1.333) was a chance of exactly
 *        zero forever every other day, and about 1.2% per session from the
 *        SECOND consecutive day. Measured with the unluckiest possible roll over
 *        40 sessions: 6 setbacks training daily, 0 training every other day,
 *        identical session content. That case is now a named regression test
 *        (`regression: 5x3 @ RPE 9.5 is injury-free on both schedules`), and the
 *        residual term is deleted rather than zeroed so no retune restores it.
 *
 *   (G5b) CONSISTENCY ALONE NEVER ACCRUES RISK. Unconditionally: at every
 *        strain, at every frequency, forever. Repeating ANY session every day
 *        carries exactly the chance that session carries on its own, on day one,
 *        to a completely fresh lifter. There is no strain at which repetition
 *        turns a safe session unsafe, because repetition is not an input. This
 *        headline is unconditional because the guarantee now is; the one place
 *        history still touches risk is named in (G4) and only ever removes it.
 *
 *        WHAT A HARD DAY STILL COSTS: tomorrow's session starts harder (GDD
 *        §3.4, "Push too hard today -> tomorrow's session starts harder"). That
 *        is the fatigue model working and it is deliberately kept. What changed
 *        is that a tighter window and a slower bar are the WHOLE of the cost.
 *
 *        AND WHY GETTING STRONGER NEVER CATCHES UP WITH YOU: strain is computed
 *        from RPE, sets and reps. `SessionRecord` has no weight field at all, so
 *        a lifter whose e1RM has doubled and who still trains 5x3 @ RPE 9 sits
 *        at exactly the strain, and exactly the risk, they did on day one. The
 *        player's norm rises with them in load without ever meeting a threshold.
 *
 *   (G6) AN INJURY NEVER COSTS A DAY. `cappedSession` reduces work sets on the
 *        affected lift only and leaves other lifts untouched. It never cuts a
 *        plan below `MIN_WORK_SETS_WHILE_INJURED` (1) and never raises one, so
 *        any plan that was a session before the setback is still a session after
 *        it — an injured player can always train, and a streak can never be
 *        broken by one. (A caller who plans zero sets still gets zero; the cap
 *        only ever reduces, and there is nothing there to protect.)
 *
 *   (G7) AN INJURY IS NEVER A STAT LOSS. `InjuryRecord` and `InjuryNotice` carry
 *        a kind, a lift, a duration and copy. There is no field for an e1RM,
 *        Total, streak or currency delta, and this module exports no function
 *        that returns one. The suite pins both key sets.
 *
 *   (G8) AN INJURY IS SHORT AND CANNOT BE EXTENDED. Duration is fixed at onset
 *        from `INJURY_DURATION_DAYS_MIN`..`_MAX` (GDD §3.5's 2-3 days), only
 *        ever shortened, by Gym Empire physio staff (GDD §5.4). No later call
 *        can move `endDay`. Re-injury is blocked for the debuff plus
 *        `INJURY_IMMUNITY_DAYS_AFTER`, so setbacks cannot chain.
 *
 * NOT ENFORCED, and worth knowing:
 *
 *   - (G2) compares taking the FREE session against skipping. Training genuinely
 *     hard every day does leave you more fatigued than resting would — that is
 *     the model working (GDD §3.4). The guarantee is that engagement always has
 *     a costless form, not that every choice is costless.
 *
 *   - A session ABOVE `INJURY_STRAIN_THRESHOLD` carries its chance every time it
 *     is performed. PER SESSION that chance is identical for everybody (G4). PER
 *     CALENDAR WEEK, a player who picks such a session seven days running meets
 *     it more often than one who picks it twice. Said plainly because it is the
 *     one place frequency still shows up anywhere near injury.
 *
 *     That is repeatedly choosing to overreach, not showing up. Every session at
 *     or below the threshold — an ordinary hard day and everything easier — is
 *     provably free at any frequency, forever, and (G1)'s free session is always
 *     on offer. Two things also bound it: `INJURY_IMMUNITY_DAYS_AFTER` is counted
 *     in DAYS, so no amount of extra training compresses the gap between two
 *     setbacks; and per session the daily trainer comes off BETTER, because more
 *     of their sessions land inside that window. At the shipped placeholders,
 *     40 sessions of identical overreaching content under the unluckiest
 *     possible roll: 6 setbacks training daily, 10 every other day, 14 every
 *     third day. The suite asserts that direction across a strain sweep; the
 *     three counts are a measurement, not a pinned expectation.
 *
 *     Closing the per-week gap entirely would mean making the Nth repeat of an
 *     overreaching session cheaper than the first — risk falling as volume rises
 *     — which is a worse lie than admitting this one.
 *
 * ---------------------------------------------------------------------------
 * HORIZON — SAME-DAY / NEXT-DAY, NOT MULTI-WEEK (GDD §3.4)
 * ---------------------------------------------------------------------------
 * Two timescales, both short, and nothing longer:
 *
 *   WITHIN A SESSION: `LiftMoment` lets the mechanic say how deep into the
 *   session a rep is. Later sets and later reps carry more burden. Resets to
 *   nothing at the end of the session; never persisted.
 *
 *   DAY TO DAY: residual is a fold with `DAILY_DECAY` per day. At the shipped
 *   placeholder (0.4) a hard session is 40% present tomorrow, 16% the day after,
 *   and clamped to exactly zero by `RESIDUAL_FLOOR` within a few days. The
 *   ledger is pruned to `FATIGUE_MEMORY_DAYS`, which the suite checks is long
 *   enough that the worst possible truncation error is under the floor — so the
 *   horizon has no visible cliff at its edge.
 *
 * Multi-week accumulation, block periodisation and taper belong to Career mode
 * (GDD §3.4) and are a deliberate NON-GOAL here.
 *
 * ---------------------------------------------------------------------------
 * WHY `SessionFeel` HAS A HIDDEN HALF
 * ---------------------------------------------------------------------------
 * `SessionFeel` carries one internal number, `burden`, under a `unique symbol`
 * this file does not export. A caller cannot name the property, cannot spread
 * over it, and `Object.keys` / `JSON.stringify` do not see it — so the object
 * that reaches a component has qualitative fields and nothing else.
 *
 * WHAT THIS IS NOT: tamper-resistance. `Object.getOwnPropertySymbols` or a cast
 * gets through, and nothing here tries to stop that. Authority over progression
 * belongs on the server (CLAUDE.md). What it closes is the accident — the
 * `<FatigueBar value={feel.fatigue} />` that type-checks, looks innocent in a
 * diff, and ships.
 *
 * WHAT IT COSTS: a `SessionFeel` does not survive `JSON.stringify`, so it cannot
 * be sent over a wire or cached. That is correct rather than merely tolerable —
 * it is a per-session read model, recomputed from `FatigueState` (which is plain
 * JSON and does round trip) whenever it is needed.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE READINESS CHECK-IN SURFACES, AND WHY IT LEAKS NOTHING
 * ---------------------------------------------------------------------------
 * GDD §3.2 wants three taps and a surfaced modifier ("Feeling primed +5%" /
 * "Grinding today"). `readinessCheckIn` takes ONLY the three answers — no state,
 * no day — so the number shown to the player is a readout of what they just
 * tapped and cannot carry hidden fatigue out with it. `SessionFeel.readiness` is
 * that same report verbatim; the suite asserts it is identical across wildly
 * different fatigue histories.
 *
 * The two are combined only *behind* the symbol, into `burden`, which is what
 * moves the window, the miss odds, the perceived RPE and the bar-speed cue.
 *
 * KNOWN OPEN QUESTION, NOT SOLVED HERE: the check-in is self-reported, and
 * reporting "primed" both widens the window (`READINESS_RELIEF_WEIGHT`) and adds
 * load (`READINESS_LOAD_ADJUSTMENT_PERCENT`). Whether always claiming to be
 * primed is a net win depends on how the lift mechanic trades window width
 * against bar weight, which cannot be settled without playtesting. Both knobs
 * are exposed so the balance can be tuned; this module does not assert it is
 * already balanced.
 *
 * ---------------------------------------------------------------------------
 * DELIBERATE NON-GOALS
 * ---------------------------------------------------------------------------
 *   - Multi-week / block fatigue arcs. Career mode (GDD §3.4).
 *   - Per-lift or per-muscle fatigue. Residual here is systemic and global: a
 *     hard squat day makes tomorrow's bench start harder. Only INJURY is
 *     lift-specific.
 *   - Load prescription. `readinessCheckIn` reports a percentage nudge; the
 *     caller applies it to whatever `rpe.ts` prescribes. This module does no
 *     load math and imports no chart values beyond the RPE grid's own step.
 *   - Streaks and Recovery Days (GDD §4). Separate module.
 *   - Any mutation of Total, e1RM or currency. Server-authoritative (CLAUDE.md).
 */

import { RPE_CHART_COVERAGE } from './rpe';

// ---------------------------------------------------------------------------
// Domain vocabulary (declared before the tuning block, which is typed against it)
// ---------------------------------------------------------------------------

/**
 * The Sim-mode daily rotation (GDD §3.2: "squat day, bench day, deadlift day,
 * accessory day on rotation").
 *
 * Deliberately NOT `meet.ts`'s `LiftKind`. That type is the three contested
 * lifts of a meet and must never grow a fourth member; this one has to include
 * accessory days. They are different vocabularies that happen to overlap.
 */
export type SimLift = 'squat' | 'bench' | 'deadlift' | 'accessory';

export const SIM_LIFTS = Object.freeze([
  'squat',
  'bench',
  'deadlift',
  'accessory',
] as const satisfies readonly SimLift[]);

/** One tap each (GDD §3.2). Three options per question keeps the read coarse. */
export type SleepAnswer = 'poor' | 'ok' | 'good';
export type SorenessAnswer = 'sore' | 'normal' | 'fresh';
export type MotivationAnswer = 'flat' | 'steady' | 'fired-up';

export interface ReadinessCheckIn {
  readonly sleep: SleepAnswer;
  readonly soreness: SorenessAnswer;
  readonly motivation: MotivationAnswer;
}

/**
 * The band the check-in lands in. Surfaced to the player as copy plus a
 * percentage — GDD §3.2 names 'primed' ("Feeling primed +5%") and 'grinding'
 * ("Grinding today") by example; the two in between exist so the readout is not
 * binary.
 */
export type ReadinessBand = 'primed' | 'ready' | 'steady' | 'grinding';

/**
 * History-derived readiness kind. Separate from the old tap bands so "no
 * history" is not mislabelled recovered, and so RPE 8 vs 9/10 can land in
 * different copy without exporting a residual.
 */
export type HistoryReadinessKind = 'forming' | 'recovered' | 'ready' | 'heavy' | 'grinding';

export const HISTORY_READINESS_KIND_ORDER = Object.freeze([
  'forming',
  'recovered',
  'ready',
  'heavy',
  'grinding',
] as const satisfies readonly HistoryReadinessKind[]);

/** Best to worst. Exported so a UI can render all bands exhaustively. */
export const READINESS_BAND_ORDER = Object.freeze([
  'primed',
  'ready',
  'steady',
  'grinding',
] as const satisfies readonly ReadinessBand[]);

/**
 * How the bar is expected to move today (GDD §3.4: "Bar-speed cues — 'that rep
 * looked slower than expected'").
 *
 * THIS IS A PREDICTION, NOT A MEASUREMENT. It is what the fatigue model expects
 * the bar to look like; it does not observe rep timing. The lift mechanic owns
 * actual bar speed. The cue exists so the copy the player reads after a rep can
 * be honest about the hidden state without printing it.
 */
export type BarSpeedCue =
  | 'popping'
  | 'crisp'
  | 'as-expected'
  | 'slower-than-expected'
  | 'grinding';

/** Best to worst. The suite uses this ordering to assert monotonicity. */
export const BAR_SPEED_CUE_ORDER = Object.freeze([
  'popping',
  'crisp',
  'as-expected',
  'slower-than-expected',
  'grinding',
] as const satisfies readonly BarSpeedCue[]);

/**
 * What got tweaked. Chosen DETERMINISTICALLY from the lift that caused it — no
 * second random roll, and no rarity tiers (GDD §5.3's no-gacha reasoning applies
 * to anything that could read as a pull).
 */
export type InjuryKind = 'lower-back-tweak' | 'shoulder-niggle' | 'elbow-niggle';

export const INJURY_KINDS = Object.freeze([
  'lower-back-tweak',
  'shoulder-niggle',
  'elbow-niggle',
] as const satisfies readonly InjuryKind[]);

/** One entry of the RPE -> per-rep strain weight curve. */
export interface RpeStrainWeight {
  readonly rpe: number;
  readonly weight: number;
}

/** One band edge of the bar-speed cue ladder. */
export interface BarSpeedBand {
  /** Burden strictly below `maxBurden` and not caught by an earlier entry. */
  readonly cue: BarSpeedCue;
  readonly maxBurden: number;
}

/** One band edge of the readiness ladder. */
export interface ReadinessBandEdge {
  readonly band: ReadinessBand;
  /** Readiness score at or above this lands in `band`. */
  readonly minScore: number;
}

// ---------------------------------------------------------------------------
// FATIGUE_TUNING — the one place every number in this module lives
//
// CLAUDE.md "Game Feel Values Must Be Tunable": "Keep every such value as a
// named constant in one place. Never scatter them as magic numbers across
// components." Nothing below this block contains a bare coefficient, decay rate,
// threshold, window scale or injury probability.
//
// EVERY NUMBER HERE IS AN UNTUNED PLACEHOLDER. None has been played. They were
// chosen so the model behaves plausibly on paper — a hard session is roughly
// gone in three days, a genuinely stupid session carries a few percent injury
// chance, a free session costs nothing — and they are expected to move.
//
// Frozen, including the nested tables. `readonly` is a compile-time claim; a
// caller who could write `FATIGUE_TUNING.DAILY_DECAY = 1` would freeze every
// player's fatigue permanently, at runtime, with no error.
// ---------------------------------------------------------------------------

export const FATIGUE_TUNING = Object.freeze({
  // --- Session strain -------------------------------------------------------

  /**
   * Per-rep strain cost by top RPE, interpolated linearly between entries and
   * clamped at the ends. Superlinear on purpose: reps near failure cost
   * disproportionately more than easy ones, which is the shape that makes an
   * RPE choice (GDD §3.3) a real decision rather than a label.
   *
   * Units are arbitrary and only meaningful relative to
   * `STRAIN_FREE_ALLOWANCE` and `STRAIN_REFERENCE`.
   */
  RPE_STRAIN_WEIGHTS: Object.freeze([
    Object.freeze({ rpe: 6, weight: 0.35 }),
    Object.freeze({ rpe: 6.5, weight: 0.45 }),
    Object.freeze({ rpe: 7, weight: 0.6 }),
    Object.freeze({ rpe: 7.5, weight: 0.75 }),
    Object.freeze({ rpe: 8, weight: 1.0 }),
    Object.freeze({ rpe: 8.5, weight: 1.25 }),
    Object.freeze({ rpe: 9, weight: 1.6 }),
    Object.freeze({ rpe: 9.5, weight: 2.0 }),
    Object.freeze({ rpe: 10, weight: 2.5 }),
  ] as const satisfies readonly RpeStrainWeight[]),

  /**
   * THE DAILY-ENGAGEMENT CONSTANT. Raw session index below this costs exactly
   * zero strain — there is always a session a player can do that leaves them no
   * worse off than not opening the app (G1 in the header).
   *
   * At the shipped weights, 2 x 5 @ RPE 6 indexes 3.5, comfortably under. Raise
   * `RECOVERY_SESSION_*` past this and `fatigue.test.ts` fails.
   */
  STRAIN_FREE_ALLOWANCE: 6,

  /**
   * Divisor that puts strain on a ~1.0 = "one properly hard session" scale, so
   * every burden coefficient below reads against a familiar unit. At the shipped
   * weights, 5 x 3 @ RPE 9 indexes 24, which is (24 - 6) / 18 = 1.0.
   */
  STRAIN_REFERENCE: 18,

  /**
   * Hard ceiling on one session's strain. Not cosmetic: it is what bounds the
   * model's steady state, and the injury guarantee (G3) and the memory-horizon
   * check are both derived from that bound in `fatigue.test.ts`. A caller
   * passing 50 work sets cannot walk the model somewhere its guarantees stop
   * holding.
   */
  MAX_SESSION_STRAIN: 2.5,

  // --- Day-to-day horizon (GDD §3.4) ---------------------------------------

  /**
   * Fraction of residual that survives to the next morning. Steep on purpose:
   * GDD §3.4 puts fatigue on a same-day / next-day horizon and gives multi-week
   * arcs to Career mode.
   */
  DAILY_DECAY: 0.4,

  /**
   * Extra decay applied to the residual carried in on a day the player TRAINED,
   * on top of `DAILY_DECAY`. Below 1, so moving flushes yesterday harder than
   * resting does. This is the term that makes showing up dominate skipping (G2).
   * Setting it to 1 removes the strict part of that guarantee and fails a test.
   */
  ACTIVE_RECOVERY_FLUSH: 0.85,

  /**
   * Residual below this is clamped to exactly zero, so "washed out" is a real
   * state and not an asymptote. Also what makes the ledger horizon invisible.
   */
  RESIDUAL_FLOOR: 0.02,

  /**
   * How many days of sessions the ledger keeps and the fold reads.
   *
   * Must be long enough that the worst possible truncation error is under
   * `RESIDUAL_FLOOR`, or the horizon becomes a visible cliff. `fatigue.test.ts`
   * derives the requirement from `MAX_SESSION_STRAIN`, `DAILY_DECAY` and
   * `ACTIVE_RECOVERY_FLUSH` and fails if this is too small.
   */
  FATIGUE_MEMORY_DAYS: 6,

  // --- Readiness check-in (GDD §3.2) ---------------------------------------

  /**
   * How much each question moves the readiness score. Sums to 1, so the score
   * lands in [-1, +1]. Sleep is weighted heaviest because it is the answer a
   * player is least able to fake to themselves.
   */
  READINESS_QUESTION_WEIGHT: Object.freeze({
    sleep: 0.4,
    soreness: 0.35,
    motivation: 0.25,
  }),

  /** Per-answer contribution, before the question weight above. */
  READINESS_ANSWER_SCORE: Object.freeze({
    sleep: Object.freeze({ poor: -1, ok: 0, good: 1 }),
    soreness: Object.freeze({ sore: -1, normal: 0, fresh: 1 }),
    motivation: Object.freeze({ flat: -1, steady: 0, 'fired-up': 1 }),
  }),

  /** Band edges, best first. Walked top-down; the last entry must catch all. */
  READINESS_BAND_MIN_SCORE: Object.freeze([
    Object.freeze({ band: 'primed', minScore: 0.55 }),
    Object.freeze({ band: 'ready', minScore: 0.15 }),
    Object.freeze({ band: 'steady', minScore: -0.35 }),
    Object.freeze({ band: 'grinding', minScore: Number.NEGATIVE_INFINITY }),
  ] as const satisfies readonly ReadinessBandEdge[]),

  /**
   * History-derived readiness (SF-TWL-SESSION-A-TRAINING-FIT-01). Residual at
   * the start of today, walked top-down: first edge whose `maxResidual` is
   * strictly above the hidden residual wins. Empty history is a separate
   * override (`forming`) and does not use this table.
   *
   * NOT A METER. These edges pick copy. They are not exported, not shown, and
   * load adjustment from history is independently pinned at 0 so the player's
   * RPE choice still owns the bar (owner: do not retune load values).
   */
  HISTORY_READINESS_MAX_RESIDUAL: Object.freeze([
    Object.freeze({ band: 'ready' as const, maxResidual: 0.08 }),
    Object.freeze({ band: 'steady' as const, maxResidual: 0.28 }),
    Object.freeze({ band: 'grinding' as const, maxResidual: Number.POSITIVE_INFINITY }),
  ]),

  /**
   * History never applies the old tap-style percentage bonus to the bar.
   * Load stays the published-chart RPE prescription at a 0% nudge — the
   * previous `steady` check-in path — so RPE difficulty is unchanged.
   */
  HISTORY_READINESS_LOAD_ADJUSTMENT_PERCENT: 0,

  /**
   * The surfaced number in GDD §3.2's "Feeling primed +5%". A percentage nudge
   * to today's prescribed load, applied by the caller — autoregulation, not a
   * stat bonus, and it moves in both directions.
   *
   * SELF-REPORT EXPLOIT IS OPEN, not solved: see the header. This knob and
   * `READINESS_RELIEF_WEIGHT` are the two sides of that balance.
   */
  READINESS_LOAD_ADJUSTMENT_PERCENT: Object.freeze({
    primed: 5,
    ready: 2,
    steady: 0,
    grinding: -5,
  }),

  // --- Burden: how the hidden state reaches the mechanic --------------------

  /** Weight on day-to-day residual. 1.0 keeps burden on the same scale as strain. */
  FATIGUE_BURDEN_WEIGHT: 1.0,

  /**
   * How far a good check-in pulls burden NEGATIVE (i.e. below neutral, which is
   * where "more forgiving when primed" in GDD §3.4 comes from). At the shipped
   * value a perfect check-in on a fully fresh lifter sits at burden -0.35.
   */
  READINESS_RELIEF_WEIGHT: 0.35,

  // --- Within-session accumulation (the "same-day" half of GDD §3.4) --------

  /** Burden added per work set already completed in this session. */
  WITHIN_SESSION_BURDEN_PER_SET: 0.08,

  /** Burden added per rep already completed inside the current set. */
  WITHIN_SESSION_BURDEN_PER_REP: 0.03,

  /** Ceiling on the within-session term, so a long session cannot run away. */
  WITHIN_SESSION_BURDEN_MAX: 0.5,

  // --- Timing window (GDD §3.4: tighter when fatigued, forgiving when primed) -

  /** Fraction of the base window lost per 1.0 of burden. */
  TIMING_WINDOW_SCALE_PER_BURDEN: 0.22,

  /** Tightest the window may ever get, as a fraction of the mechanic's base. */
  TIMING_WINDOW_SCALE_MIN: 0.65,

  /** Widest it may ever get. Above 1 so being primed is felt, not just absent. */
  TIMING_WINDOW_SCALE_MAX: 1.15,

  // --- Miss likelihood (GDD §3.4) ------------------------------------------

  /**
   * Multiplier applied to the ODDS of a miss, per 1.0 of burden. Odds rather
   * than probability so the result can never leave (0, 1) however the knob is
   * turned, and so a rep the mechanic calls certain stays certain.
   */
  MISS_ODDS_MULTIPLIER_PER_BURDEN: 0.6,

  /** Floor on that multiplier. Must stay above 0. */
  MISS_ODDS_MULTIPLIER_MIN: 0.5,

  /** Ceiling on that multiplier. */
  MISS_ODDS_MULTIPLIER_MAX: 2.5,

  // --- Perceived RPE (GDD §3.4: readiness shifts what an RPE feels like) ----

  /** RPE points the target feels shifted by, per 1.0 of burden. */
  PERCEIVED_RPE_SHIFT_PER_BURDEN: 1.0,

  /** Cap on that shift in either direction. */
  PERCEIVED_RPE_SHIFT_MAX: 1.5,

  // --- Bar-speed cue bands --------------------------------------------------

  /** Cue ladder, best first. Walked top-down; the last entry must catch all. */
  BAR_SPEED_BAND_MAX_BURDEN: Object.freeze([
    Object.freeze({ cue: 'popping', maxBurden: -0.2 }),
    Object.freeze({ cue: 'crisp', maxBurden: -0.05 }),
    Object.freeze({ cue: 'as-expected', maxBurden: 0.2 }),
    Object.freeze({ cue: 'slower-than-expected', maxBurden: 0.55 }),
    Object.freeze({ cue: 'grinding', maxBurden: Number.POSITIVE_INFINITY }),
  ] as const satisfies readonly BarSpeedBand[]),

  // --- Injury (GDD §3.5) ----------------------------------------------------

  /**
   * Strain ONE SESSION has to exceed before it carries ANY injury chance. Below
   * it the probability is exactly zero, not merely small.
   *
   * THIS IS THE WHOLE OF THE INJURY GATE. Nothing is added to today's strain
   * before the comparison — no residual, no attendance, no streak — so the
   * threshold means one plain thing: how much harder than an ordinary hard day
   * (strain 1.0, by construction of `STRAIN_REFERENCE`) a session has to be
   * before it can hurt you. There is deliberately no companion coefficient for
   * carried-in fatigue; the previous draft had one, and it made risk accrue from
   * training frequency (see G5 in the header).
   *
   * THREE BOUNDS, all derived from the other constants and asserted in
   * `fatigue.test.ts` rather than left to this comment:
   *
   *   1. Strictly above 0, or a free session could injure (G3).
   *   2. Strictly above the ordinary-hard reference strain of 1.0, or a normal
   *      hard day carries a chance and GDD §3.5's "rare" is gone.
   *   3. Strictly below `MAX_SESSION_STRAIN`, or nothing can ever injure and
   *      GDD §3.5's setbacks are dead code.
   *
   * AT THE SHIPPED PLACEHOLDER: 5x3 @ RPE 9 (strain 1.0) and 5x3 @ RPE 9.5
   * (1.333) are free forever at any frequency; 5x3 @ RPE 10 (1.75) and 5x5 @
   * RPE 9 (1.889) are not. Where exactly that line belongs is a feel question
   * and has not been played. Note that dropping the residual term made the model
   * strictly less injurious at a fixed threshold, so this number is a candidate
   * to come DOWN in tuning, not up.
   */
  INJURY_STRAIN_THRESHOLD: 1.5,

  /** Injury probability per 1.0 of strain above the threshold. */
  INJURY_CHANCE_PER_OVERREACH: 0.05,

  /**
   * Hard cap on one session's injury chance. GDD §3.5: "Rare".
   *
   * CURRENTLY SLACK, said rather than left to be discovered. With no residual
   * term the largest reachable chance is
   * `(MAX_SESSION_STRAIN - INJURY_STRAIN_THRESHOLD) x
   * INJURY_CHANCE_PER_OVERREACH` = 5% as shipped, so this never binds today. It
   * stays as a guard: a tuner who lowers the threshold or raises the per-
   * overreach slope should not be able to walk past "rare" by accident.
   */
  INJURY_MAX_CHANCE_PER_SESSION: 0.06,

  /** GDD §3.5: "short (2-3 day debuffs)". */
  INJURY_DURATION_DAYS_MIN: 2,
  INJURY_DURATION_DAYS_MAX: 3,

  /**
   * Floor a Gym Empire physio (GDD §5.4) can shorten a setback to. Never 0 — a
   * setback that vanishes entirely is not a setback, and the cross-mode hook
   * needs something left to shorten.
   */
  INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO: 1,

  /**
   * Days after a setback ends during which another cannot start. Stops
   * back-to-back setbacks chaining into something that reads as a punishment
   * streak (G8).
   */
  INJURY_IMMUNITY_DAYS_AFTER: 3,

  /**
   * Work sets that survive on the affected lift, as a fraction. 0.6 is GDD
   * §3.5's worked example ("squat volume reduced 40% for 3 days").
   */
  INJURY_VOLUME_CAP_FRACTION: 0.6,

  /**
   * Never cap below this. THE STREAK GUARANTEE (G6): an injured player can
   * always complete a session, so a setback can never cost a day.
   */
  MIN_WORK_SETS_WHILE_INJURED: 1,

  /**
   * Most of the injury risk that Arcade technique points can remove (GDD §2.3:
   * technique points are "spent on bar-path efficiency, which reduces injury
   * risk in Sim"). Below 1 so technique never makes a player invulnerable.
   *
   * NOT PURCHASABLE. Technique points are earned in Arcade. Nothing in this
   * module takes a currency, and wiring one to `techniqueRating` would be
   * pay-to-win (GDD §8.1) and must be refused.
   */
  TECHNIQUE_MAX_RISK_REDUCTION: 0.5,

  // --- The free session template -------------------------------------------
  //
  // Must index at or under STRAIN_FREE_ALLOWANCE. Enforced by the suite, not by
  // this comment.

  RECOVERY_SESSION_RPE: 6,
  RECOVERY_SESSION_WORK_SETS: 2,
  RECOVERY_SESSION_REPS_PER_SET: 5,

  // --- Precision ------------------------------------------------------------

  /**
   * NOT A FEEL VALUE. Decimal places used to scrub IEEE-754 noise out of
   * returned numbers (e.g. 0.30000000000000004 -> 0.3). It lives here only
   * because the brief is that this module has exactly one constants block, and
   * a stray `toFixed(3)` in the logic would violate that more than this does.
   * Do not tune it to change how the game feels; it cannot.
   */
  PRECISION_DECIMALS: 6,
});

/**
 * Player-facing copy, kept out of `FATIGUE_TUNING` so that block stays purely
 * numeric for whoever is turning knobs. Strings are hand-tuned too, just by a
 * different person on a different pass.
 *
 * `fatigue.test.ts` asserts these tables cover exactly the same key sets as
 * their numeric counterparts, so a new band cannot ship without its copy.
 */
export const FATIGUE_COPY = Object.freeze({
  /** Tap-scored headlines. Kept for the unused self-report helper. */
  READINESS_HEADLINE: Object.freeze({
    primed: 'Feeling primed',
    ready: 'Ready to work',
    steady: 'Steady',
    grinding: 'Grinding today',
  }),

  /**
   * Player-facing history readiness (GDD §3.2 as corrected, §3.4). Qualitative
   * only — no residual, no percentage, no session count. `forming` is the empty
   * ledger, not a fabricated "fresh" claim.
   */
  HISTORY_READINESS_HEADLINE: Object.freeze({
    forming: 'Readiness forming',
    recovered: 'Recovered and ready to push',
    ready: 'Ready to work',
    heavy: 'Recent heavy work is still affecting readiness',
    grinding: 'Grinding today',
  }),

  HISTORY_READINESS_DETAIL: Object.freeze({
    forming: 'Train to give the next session something to read.',
    recovered: 'Yesterday has washed out. You can push.',
    ready: 'Carry is light. A hard day is still a choice.',
    heavy: 'You can still train — the window is tighter.',
    grinding: 'You can still train — expect a slower bar.',
  }),

  BAR_SPEED_TEXT: Object.freeze({
    popping: 'The bar is jumping off you today.',
    crisp: 'Bar speed looks sharp.',
    'as-expected': 'Bar speed looks about where it should be.',
    'slower-than-expected': 'That looked slower than expected.',
    grinding: 'Every rep is a grind today.',
  }),

  INJURY_HEADLINE: Object.freeze({
    'lower-back-tweak': 'Tweaked lower back',
    'shoulder-niggle': 'Cranky shoulder',
    'elbow-niggle': 'Sore elbow',
  }),

  LIFT_LABEL: Object.freeze({
    squat: 'squat',
    bench: 'bench',
    deadlift: 'deadlift',
    accessory: 'accessory',
  }),

  /**
   * GDD §3.5: "always framed as recoverable". This line is the framing, and it
   * is the only thing a setback screen needs beyond the volume note.
   */
  INJURY_REASSURANCE: 'Nothing is torn. Keep training around it and it settles.',
});

/**
 * Which niggle a lift produces. Deterministic — the same lift always produces
 * the same kind, so no second roll is needed and there is nothing here that
 * could be mistaken for a random pull (GDD §5.3).
 */
const INJURY_KIND_FOR_LIFT: Readonly<Record<SimLift, InjuryKind>> = Object.freeze({
  squat: 'lower-back-tweak',
  bench: 'shoulder-niggle',
  deadlift: 'lower-back-tweak',
  accessory: 'elbow-niggle',
});

// ---------------------------------------------------------------------------
// State — the persisted ledger
// ---------------------------------------------------------------------------

/**
 * One completed Sim-mode session, as raw inputs only.
 *
 * NOTHING HERE IS INTERPRETED. Every field is something the player literally
 * did, which is what makes `FatigueState` unmeterable: there is no derived
 * number in it to bind a bar to, and a server can store it as-is.
 */
export interface SessionRecord {
  /** Integer day index, caller-supplied. This module never reads a clock. */
  readonly day: number;
  readonly lift: SimLift;
  /**
   * Stimulus RPE folded into strain. Prefer ACHIEVED: a set that hit failure
   * is reported at RPE 10 (`session.ts` `playedSetFrom`). When every prescribed
   * rep is made, only the DECLARED / target RPE exists — that value is used as
   * a bounded stimulus and must not be labelled "achieved". `fatigueRecordFor`
   * in `sessionServer.ts` is the single writer; this module does not invent a
   * second reading.
   */
  readonly topRpe: number;
  readonly workSets: number;
  readonly repsPerSet: number;
}

/**
 * An active setback. Fixed at onset and never edited afterwards (G8).
 *
 * NO STAT DELTA FIELD, and none may be added (G7). GDD §3.5: "Soft consequence,
 * not stat loss." A setback caps volume on one lift and says something kind; it
 * does not touch e1RM, Total, streak or any currency, and this module has no way
 * to.
 */
export interface InjuryRecord {
  readonly kind: InjuryKind;
  readonly lift: SimLift;
  /** First capped day. Always the day AFTER the session that caused it. */
  readonly startDay: number;
  /** Last capped day, inclusive. */
  readonly endDay: number;
}

/** Everything this module persists. Plain JSON; round-trips exactly. */
export interface FatigueState {
  readonly sessions: readonly SessionRecord[];
  readonly injury: InjuryRecord | null;
}

export const EMPTY_FATIGUE_STATE: FatigueState = Object.freeze({
  sessions: Object.freeze([]),
  injury: null,
});

/** The neutral answer to every question — what an un-taken check-in means. */
export const NEUTRAL_CHECK_IN: ReadinessCheckIn = Object.freeze({
  sleep: 'ok',
  soreness: 'normal',
  motivation: 'steady',
});

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Strip IEEE-754 noise from a returned number. */
function scrub(value: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** FATIGUE_TUNING.PRECISION_DECIMALS;
  return Math.round(value * factor) / factor;
}

function assertFiniteNonNegative(value: number, what: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${what} must be a finite number >= 0, received ${value}.`);
  }
}

function assertDayIndex(day: number, what: string): void {
  if (!Number.isSafeInteger(day)) {
    throw new RangeError(`${what} must be a safe integer day index, received ${day}.`);
  }
}

function copySession(session: SessionRecord): SessionRecord {
  return {
    day: session.day,
    lift: session.lift,
    topRpe: session.topRpe,
    workSets: session.workSets,
    repsPerSet: session.repsPerSet,
  };
}

function copyInjury(injury: InjuryRecord): InjuryRecord {
  return {
    kind: injury.kind,
    lift: injury.lift,
    startDay: injury.startDay,
    endDay: injury.endDay,
  };
}

/**
 * Validates a session the caller is handing in. Throws rather than clamping:
 * a negative rep count is a bug upstream, and silently reading it as zero would
 * hide the bug behind a plausible-looking fatigue curve.
 */
function assertValidSession(session: SessionRecord): void {
  assertDayIndex(session.day, 'session.day');
  if (!SIM_LIFTS.includes(session.lift)) {
    throw new RangeError(
      `session.lift must be one of ${SIM_LIFTS.join(', ')}, received ${String(session.lift)}.`,
    );
  }
  if (!Number.isFinite(session.topRpe)) {
    throw new RangeError(`session.topRpe must be a finite number, received ${session.topRpe}.`);
  }
  assertFiniteNonNegative(session.workSets, 'session.workSets');
  assertFiniteNonNegative(session.repsPerSet, 'session.repsPerSet');
}

// ---------------------------------------------------------------------------
// Strain — MODULE-PRIVATE. This is the fatigue scalar and it does not leave.
// ---------------------------------------------------------------------------

/**
 * Per-rep strain weight for a top RPE, linearly interpolated across
 * `RPE_STRAIN_WEIGHTS` and clamped at both ends.
 *
 * Interpolating rather than requiring a charted RPE on purpose: this curve is a
 * game-feel abstraction (GDD §3.1), not the published chart, and refusing an
 * off-grid RPE here would imply a rigour the curve does not have. The published
 * chart's own refusal behaviour lives in `rpe.ts` and is untouched by this.
 */
function rpeStrainWeight(rpe: number): number {
  const table = FATIGUE_TUNING.RPE_STRAIN_WEIGHTS;
  const first = table[0];
  const last = table[table.length - 1];
  // Unreachable while the table is non-empty; the suite pins its length.
  if (first === undefined || last === undefined) return 0;
  if (!Number.isFinite(rpe) || rpe <= first.rpe) return first.weight;
  if (rpe >= last.rpe) return last.weight;
  for (let i = 1; i < table.length; i += 1) {
    const lo = table[i - 1];
    const hi = table[i];
    if (lo === undefined || hi === undefined) continue;
    if (rpe <= hi.rpe) {
      const span = hi.rpe - lo.rpe;
      if (span <= 0) return hi.weight;
      const t = (rpe - lo.rpe) / span;
      return lo.weight + t * (hi.weight - lo.weight);
    }
  }
  return last.weight;
}

/** Raw, un-thresholded work index for a session. Module-private. */
function rawSessionIndex(session: SessionRecord): number {
  const sets = Math.max(0, session.workSets);
  const reps = Math.max(0, session.repsPerSet);
  return sets * reps * rpeStrainWeight(session.topRpe);
}

/**
 * What a session costs, after the free allowance and under the ceiling.
 * MODULE-PRIVATE: this is the fatigue number, and exporting it would be the
 * meter GDD §3.4 forbids.
 */
function sessionStrain(session: SessionRecord): number {
  const above = Math.max(0, rawSessionIndex(session) - FATIGUE_TUNING.STRAIN_FREE_ALLOWANCE);
  return Math.min(FATIGUE_TUNING.MAX_SESSION_STRAIN, above / FATIGUE_TUNING.STRAIN_REFERENCE);
}

/**
 * Does this session cost nothing? True for anything at or under
 * `STRAIN_FREE_ALLOWANCE`.
 *
 * A boolean, and a function of the SESSION alone — it never reads state, so it
 * carries no information about the player's hidden fatigue. It exists so a UI
 * can mark the free option in a session picker (G1) without computing strain
 * itself, which CLAUDE.md forbids components from doing.
 */
export function isFreeSession(session: SessionRecord): boolean {
  assertValidSession(session);
  return sessionStrain(session) === 0;
}

/**
 * The session that is always free (G1). GDD §3.3 has the player choose an RPE
 * target, so this is a real in-fiction choice — a light technique day — not an
 * exemption bolted on to satisfy a constraint.
 */
export function recoverySessionFor(day: number, lift: SimLift): SessionRecord {
  assertDayIndex(day, 'day');
  if (!SIM_LIFTS.includes(lift)) {
    throw new RangeError(`lift must be one of ${SIM_LIFTS.join(', ')}, received ${String(lift)}.`);
  }
  return {
    day,
    lift,
    topRpe: FATIGUE_TUNING.RECOVERY_SESSION_RPE,
    workSets: FATIGUE_TUNING.RECOVERY_SESSION_WORK_SETS,
    repsPerSet: FATIGUE_TUNING.RECOVERY_SESSION_REPS_PER_SET,
  };
}

// ---------------------------------------------------------------------------
// The day-to-day fold — MODULE-PRIVATE
// ---------------------------------------------------------------------------

function sessionOnDay(state: FatigueState, day: number): SessionRecord | null {
  for (let i = 0; i < state.sessions.length; i += 1) {
    const session = state.sessions[i];
    if (session !== undefined && session.day === day) return session;
  }
  return null;
}

/**
 * Residual fatigue at the START of `day`, before that day's session.
 *
 * Today's work does not affect today's feel — GDD §3.4's "Push too hard today ->
 * tomorrow's session starts harder". Within-session accumulation is a separate
 * term (`LiftMoment`) and is not persisted.
 *
 * The recurrence, once per day walked:
 *
 *     trained:  F <- (F * ACTIVE_RECOVERY_FLUSH + strain) * DAILY_DECAY
 *     rested:   F <-  F                                   * DAILY_DECAY
 *     then:     F <- 0 if F < RESIDUAL_FLOOR
 *
 * Both branches are non-decreasing in F, and the floor clamp is a monotone step,
 * so a lower residual today implies a lower-or-equal residual on every later day
 * given the same subsequent sessions. That is what makes G2 propagate rather
 * than hold only for one day.
 *
 * The flush on the trained branch is the whole of G2: a free session adds zero
 * and multiplies the carry by 0.85, where resting multiplies by 1.
 *
 * MODULE-PRIVATE. This is the hidden stat, and `sessionFeel` is its ONLY caller.
 * It moves the timing window, the miss odds, the perceived RPE and the bar-speed
 * cue — how today feels — and it deliberately has no route to injury risk, which
 * reads today's session and nothing else (G5). A future edit that passes this
 * into `injuryProbability` is the exact regression the daily-vs-intermittent
 * property tests exist to catch.
 */
function residualAtStartOfDay(state: FatigueState, day: number): number {
  let residual = 0;
  const from = day - FATIGUE_TUNING.FATIGUE_MEMORY_DAYS;
  for (let t = from; t < day; t += 1) {
    const session = sessionOnDay(state, t);
    if (session === null) {
      residual *= FATIGUE_TUNING.DAILY_DECAY;
    } else {
      residual =
        (residual * FATIGUE_TUNING.ACTIVE_RECOVERY_FLUSH + sessionStrain(session)) *
        FATIGUE_TUNING.DAILY_DECAY;
    }
    if (residual < FATIGUE_TUNING.RESIDUAL_FLOOR) residual = 0;
  }
  return residual;
}

// ---------------------------------------------------------------------------
// Readiness check-in (GDD §3.2)
// ---------------------------------------------------------------------------

/**
 * The surfaced modifier. GDD §3.2: "Modifier applied and surfaced ('Feeling
 * primed +5%' / 'Grinding today')".
 *
 * NO RAW SCORE FIELD. The continuous readiness score stays internal; a band, a
 * headline and a load percentage is everything a screen needs, and a 0-1 number
 * here would be a bar waiting to happen.
 */
export interface ReadinessReport {
  readonly band: ReadinessBand;
  /** "Feeling primed" / "Readiness forming" / "Recovered and ready to push". */
  readonly headline: string;
  /** Percentage nudge to today's prescribed load. Signed; may be 0. History path is 0. */
  readonly loadAdjustmentPercent: number;
  /** Headline plus the signed percentage when non-zero: "Feeling primed +5%". */
  readonly label: string;
  /**
   * Supporting line. Qualitative; no residual, no count, no percent. Empty on
   * the unused tap-scored helper.
   */
  readonly detail: string;
  /**
   * What the player tapped, echoed back — or `NEUTRAL_CHECK_IN` when readiness
   * was inferred from history and no subjective check-in was taken.
   */
  readonly answers: ReadinessCheckIn;
}

/**
 * Readiness score in [-1, +1] from the three answers. MODULE-PRIVATE, because a
 * normalised readiness scalar invites the same bar a fatigue scalar would.
 */
function readinessScore(answers: ReadinessCheckIn): number {
  const weight = FATIGUE_TUNING.READINESS_QUESTION_WEIGHT;
  const score = FATIGUE_TUNING.READINESS_ANSWER_SCORE;
  // UNTRUSTED KEY: `ReadinessCheckIn` is a compile-time claim about the caller,
  // and a JS caller can pass `{ sleep: 'great' }`. Without these guards the
  // lookups read `undefined` and every downstream signal became NaN silently.
  const sleep: number | undefined = score.sleep[answers.sleep];
  const soreness: number | undefined = score.soreness[answers.soreness];
  const motivation: number | undefined = score.motivation[answers.motivation];
  if (sleep === undefined || soreness === undefined || motivation === undefined) {
    throw new RangeError(
      `Unknown readiness answer in ${JSON.stringify(answers)}. ` +
        `sleep must be poor|ok|good, soreness sore|normal|fresh, motivation flat|steady|fired-up.`,
    );
  }
  return clamp(
    sleep * weight.sleep + soreness * weight.soreness + motivation * weight.motivation,
    -1,
    1,
  );
}

function bandForReadinessScore(score: number): ReadinessBand {
  const edges = FATIGUE_TUNING.READINESS_BAND_MIN_SCORE;
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i];
    if (edge !== undefined && score >= edge.minScore) return edge.band;
  }
  // Unreachable while the last edge is -Infinity; the suite pins that.
  return 'grinding';
}

function formatSignedPercent(percent: number): string {
  return percent > 0 ? `+${percent}%` : `${percent}%`;
}

/**
 * The three taps, turned into the thing the player reads (GDD §3.2).
 *
 * TAKES NO STATE AND NO DAY, deliberately. That signature is the guarantee that
 * the surfaced modifier cannot carry hidden fatigue out to the screen: it is a
 * readout of what was just tapped and nothing else. `SessionFeel.readiness` is
 * this report verbatim, and the suite asserts it is identical, field for field,
 * across wildly different fatigue histories.
 */
export function readinessCheckIn(answers: ReadinessCheckIn): ReadinessReport {
  const score = readinessScore(answers);
  const band = bandForReadinessScore(score);
  // UNTRUSTED KEY: `band` came from a table walk, not from the compiler.
  const headline: string | undefined = FATIGUE_COPY.READINESS_HEADLINE[band];
  const percent: number | undefined = FATIGUE_TUNING.READINESS_LOAD_ADJUSTMENT_PERCENT[band];
  if (headline === undefined || percent === undefined) {
    throw new RangeError(`Readiness band ${band} has no copy or no load adjustment.`);
  }
  return {
    band,
    headline,
    loadAdjustmentPercent: percent,
    label: percent === 0 ? headline : `${headline} ${formatSignedPercent(percent)}`,
    detail: '',
    answers: {
      sleep: answers.sleep,
      soreness: answers.soreness,
      motivation: answers.motivation,
    },
  };
}

function hasRememberedSession(state: FatigueState, day: number): boolean {
  const oldest = day - FATIGUE_TUNING.FATIGUE_MEMORY_DAYS;
  for (let i = 0; i < state.sessions.length; i += 1) {
    const session = state.sessions[i];
    if (session !== undefined && session.day >= oldest && session.day < day) return true;
  }
  return false;
}

function bandForHistoryResidual(residual: number): ReadinessBand {
  const edges = FATIGUE_TUNING.HISTORY_READINESS_MAX_RESIDUAL;
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i];
    if (edge !== undefined && residual < edge.maxResidual) return edge.band;
  }
  return 'grinding';
}

function historyKindFor(residual: number, remembered: boolean): HistoryReadinessKind {
  if (!remembered && residual <= 0) return 'forming';
  if (residual <= 0) return 'recovered';
  const band = bandForHistoryResidual(residual);
  if (band === 'ready') return 'ready';
  if (band === 'steady') return 'heavy';
  return 'grinding';
}

/**
 * Readiness inferred from the training-history ledger (GDD §3.2 as corrected,
 * §3.4). Single source of truth: `FatigueState.sessions`, the same fold
 * `sessionFeel` already uses. No clock, no second ledger, no invented rows.
 *
 * Empty history → `forming`, not a fabricated fresh/fatigued claim.
 * History never writes a load percentage other than
 * `HISTORY_READINESS_LOAD_ADJUSTMENT_PERCENT` (0).
 */
export function historyReadiness(state: FatigueState, day: number): ReadinessReport {
  assertDayIndex(day, 'day');
  const residual = residualAtStartOfDay(state, day);
  const kind = historyKindFor(residual, hasRememberedSession(state, day));
  const headline: string | undefined = FATIGUE_COPY.HISTORY_READINESS_HEADLINE[kind];
  const detail: string | undefined = FATIGUE_COPY.HISTORY_READINESS_DETAIL[kind];
  if (headline === undefined || detail === undefined) {
    throw new RangeError(`History readiness kind ${kind} has no copy.`);
  }
  const band: ReadinessBand =
    kind === 'forming' ? 'steady' : kind === 'recovered' || kind === 'ready' ? 'ready' : 'grinding';
  const percent = FATIGUE_TUNING.HISTORY_READINESS_LOAD_ADJUSTMENT_PERCENT;
  return {
    band,
    headline,
    loadAdjustmentPercent: percent,
    label: percent === 0 ? headline : `${headline} ${formatSignedPercent(percent)}`,
    detail,
    answers: {
      sleep: NEUTRAL_CHECK_IN.sleep,
      soreness: NEUTRAL_CHECK_IN.soreness,
      motivation: NEUTRAL_CHECK_IN.motivation,
    },
  };
}

// ---------------------------------------------------------------------------
// Injury (GDD §3.5)
// ---------------------------------------------------------------------------

/**
 * A setback as the player reads it. Copy, a duration and a volume cap — nothing
 * else, and nothing that reduces a stat (G7).
 */
export interface InjuryNotice {
  readonly kind: InjuryKind;
  readonly lift: SimLift;
  /** Capped days left, counting today. Always >= 1 while a notice exists. */
  readonly daysRemaining: number;
  /** 40, for GDD §3.5's "squat volume reduced 40% for 3 days". */
  readonly volumeReductionPercent: number;
  /** "Tweaked lower back". */
  readonly headline: string;
  /** "squat volume reduced 40% for 3 days". */
  readonly detail: string;
  /** GDD §3.5: "always framed as recoverable". */
  readonly reassurance: string;
}

function volumeReductionPercent(): number {
  return Math.round((1 - FATIGUE_TUNING.INJURY_VOLUME_CAP_FRACTION) * 100);
}

function noticeFor(injury: InjuryRecord, day: number): InjuryNotice {
  const daysRemaining = injury.endDay - day + 1;
  const percent = volumeReductionPercent();
  // UNTRUSTED KEY: `kind` and `lift` reach here off a stored record, which a
  // server or a hand-edited save can populate with anything.
  const headline: string | undefined = FATIGUE_COPY.INJURY_HEADLINE[injury.kind];
  const liftLabel: string | undefined = FATIGUE_COPY.LIFT_LABEL[injury.lift];
  if (headline === undefined || liftLabel === undefined) {
    throw new RangeError(
      `Injury record has no copy: kind ${String(injury.kind)}, lift ${String(injury.lift)}.`,
    );
  }
  return {
    kind: injury.kind,
    lift: injury.lift,
    daysRemaining,
    volumeReductionPercent: percent,
    headline,
    detail: `${liftLabel} volume reduced ${percent}% for ${daysRemaining} day${
      daysRemaining === 1 ? '' : 's'
    }`,
    reassurance: FATIGUE_COPY.INJURY_REASSURANCE,
  };
}

function activeInjuryRecord(state: FatigueState, day: number): InjuryRecord | null {
  const injury = state.injury;
  if (injury === null) return null;
  if (day < injury.startDay || day > injury.endDay) return null;
  return injury;
}

/**
 * The setback in force on `day`, or null. Never throws on a healthy state.
 *
 * `daysRemaining` counts down and the notice disappears the day after `endDay`,
 * so "for 3 days" is literally true rather than a rounded description.
 */
export function activeInjury(state: FatigueState, day: number): InjuryNotice | null {
  assertDayIndex(day, 'day');
  const record = activeInjuryRecord(state, day);
  return record === null ? null : noticeFor(record, day);
}

/**
 * Apply a setback's soft consequence to a planned session (GDD §3.5: "Soft
 * consequence, not stat loss").
 *
 * Cuts work sets on the AFFECTED LIFT ONLY. Other lifts pass through untouched —
 * GDD's own example is squat-specific.
 *
 * TWO BOUNDS, and they are separate things. The `max` stops the cap cutting a
 * plan below `MIN_WORK_SETS_WHILE_INJURED`; the `min` stops it ever RAISING one,
 * so a caller who planned a single set gets a single set back rather than being
 * rounded up to the floor. Neither can turn a session into a bigger session.
 *
 * THE STREAK GUARANTEE (G6): any plan that was a session before the setback is
 * still a session after it, so a setback can never cost a day. The capped
 * session is also lighter, so it feeds back as a forced deload rather than as a
 * penalty.
 *
 * Top RPE is deliberately NOT capped. GDD §3.5's worked consequence is volume;
 * adding an intensity cap on top would make a setback bite twice.
 */
export function cappedSession(planned: SessionRecord, state: FatigueState): SessionRecord {
  assertValidSession(planned);
  const injury = activeInjuryRecord(state, planned.day);
  if (injury === null || injury.lift !== planned.lift) return copySession(planned);
  const scaled = Math.round(planned.workSets * FATIGUE_TUNING.INJURY_VOLUME_CAP_FRACTION);
  const floored = Math.max(FATIGUE_TUNING.MIN_WORK_SETS_WHILE_INJURED, scaled);
  return {
    ...copySession(planned),
    // `min` so the cap can only ever reduce: a 1-set plan stays 1 set rather
    // than being rounded up to the floor.
    workSets: Math.min(planned.workSets, floored),
  };
}

// ---------------------------------------------------------------------------
// Recording a session
// ---------------------------------------------------------------------------

/**
 * Caller-supplied randomness. GDD §12.3 and the purity contract: this module
 * never reaches for `Math.random`, so a test can pin the unluckiest possible
 * outcome by passing `onset: 0` (which injures whenever the probability is
 * anything above zero) and the longest possible setback with `duration: 1`.
 */
export interface InjuryRolls {
  /** In [0, 1). A setback starts when this is strictly below the probability. */
  readonly onset: number;
  /** In [0, 1). Picks the duration inside the 2-3 day band. */
  readonly duration: number;
}

/** The roll pair that produces the worst outcome the model allows. */
export const UNLUCKIEST_ROLLS: InjuryRolls = Object.freeze({ onset: 0, duration: 1 });

/** The roll pair that can never produce a setback. */
export const LUCKIEST_ROLLS: InjuryRolls = Object.freeze({ onset: 1, duration: 0 });

export interface RecordSessionOptions {
  /**
   * Arcade technique points, normalised to [0, 1] by the caller. Scales injury
   * risk down by at most `TECHNIQUE_MAX_RISK_REDUCTION` (GDD §2.3).
   * EARNED, NEVER BOUGHT — see that constant's note.
   */
  readonly techniqueRating?: number;
  /**
   * Days a Gym Empire physio takes off a setback (GDD §5.4). Whole days, >= 0.
   * Can only shorten, never below `INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO`.
   */
  readonly physioDaysSaved?: number;
}

export interface RecordSessionResult {
  readonly state: FatigueState;
  /**
   * The setback this session started, as it will read on its first capped day,
   * or null. A setback always starts the day AFTER the session that caused it,
   * so `activeInjury(result.state, session.day)` is still null here — the
   * session just completed is never retroactively capped.
   */
  readonly injuryOnset: InjuryNotice | null;
}

function latestRecordedDay(state: FatigueState): number | null {
  let latest: number | null = null;
  for (let i = 0; i < state.sessions.length; i += 1) {
    const session = state.sessions[i];
    if (session === undefined) continue;
    if (latest === null || session.day > latest) latest = session.day;
  }
  return latest;
}

/**
 * Drop what `day` can no longer be affected by: sessions older than
 * `FATIGUE_MEMORY_DAYS` and a setback whose immunity window has also expired.
 *
 * Keeps persisted state bounded — this is what a server stores, and it must not
 * grow with career length. Pruning cannot change any signal, because the fold
 * does not read outside the window either; the suite checks that.
 */
export function pruneFatigueState(state: FatigueState, day: number): FatigueState {
  assertDayIndex(day, 'day');
  const oldest = day - FATIGUE_TUNING.FATIGUE_MEMORY_DAYS;
  const sessions: SessionRecord[] = [];
  for (let i = 0; i < state.sessions.length; i += 1) {
    const session = state.sessions[i];
    if (session === undefined) continue;
    if (session.day >= oldest) sessions.push(copySession(session));
  }
  sessions.sort((a, b) => a.day - b.day);
  const injury = state.injury;
  const keepInjury =
    injury !== null && day <= injury.endDay + FATIGUE_TUNING.INJURY_IMMUNITY_DAYS_AFTER;
  return {
    sessions,
    injury: keepInjury && injury !== null ? copyInjury(injury) : null,
  };
}

/**
 * Probability that this session starts a setback. MODULE-PRIVATE, and it stays
 * that way on purpose: an exported "injury risk" number is a fatigue meter
 * wearing a different label, and a screen showing "risk: 4%" would be exactly
 * the readout GDD §3.4 forbids. Tests reach it by passing `onset: 0`, which
 * injures if and only if this is above zero, or by bisecting `onset` to recover
 * the value exactly.
 *
 * TAKES A SESSION AND A TECHNIQUE RATING, AND NOTHING ELSE. No state, no day, no
 * residual — the same signature discipline `readinessCheckIn` uses, for the same
 * reason. It is what makes G4, G5 and G5b structural rather than numeric: there
 * is no history parameter for a later retune to put weight on, so "the player
 * who trained yesterday is at higher risk" is not a value that can drift back,
 * it is an expression that cannot be written here without changing the
 * signature, deleting a property test, and arguing for both in a diff.
 *
 * Zero unless TODAY'S strain exceeds `INJURY_STRAIN_THRESHOLD`. Accumulated
 * fatigue is not added to it, and neither is anything else (G5).
 */
function injuryProbability(session: SessionRecord, techniqueRating: number): number {
  const overreach = sessionStrain(session) - FATIGUE_TUNING.INJURY_STRAIN_THRESHOLD;
  if (overreach <= 0) return 0;
  const raw = clamp(
    overreach * FATIGUE_TUNING.INJURY_CHANCE_PER_OVERREACH,
    0,
    FATIGUE_TUNING.INJURY_MAX_CHANCE_PER_SESSION,
  );
  const relief = clamp(techniqueRating, 0, 1) * FATIGUE_TUNING.TECHNIQUE_MAX_RISK_REDUCTION;
  return raw * (1 - relief);
}

function injuryDurationDays(roll: number, physioDaysSaved: number): number {
  const min = FATIGUE_TUNING.INJURY_DURATION_DAYS_MIN;
  const max = FATIGUE_TUNING.INJURY_DURATION_DAYS_MAX;
  const span = Math.max(1, max - min + 1);
  const index = clamp(Math.floor(clamp(roll, 0, 1) * span), 0, span - 1);
  const rolled = min + index;
  return Math.max(FATIGUE_TUNING.INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO, rolled - physioDaysSaved);
}

/**
 * Log a completed session and resolve whether it started a setback.
 *
 * Sessions must arrive in strictly increasing day order — one session per day
 * (GDD §3.2), and out-of-order arrival would silently corrupt the fold. A
 * replay or a correction rebuilds from `EMPTY_FATIGUE_STATE` rather than
 * back-dating into a live ledger.
 *
 * WHAT CANNOT HAPPEN HERE:
 *   - A free session cannot start a setback, for any roll (G3).
 *   - The same session cannot carry a different chance for two players because
 *     one of them trained yesterday. Only `session` and `techniqueRating` reach
 *     `injuryProbability` (G4, G5, G5b).
 *   - A setback cannot start while one is running or inside its immunity
 *     window (G8).
 *   - An existing setback's `endDay` is never moved (G8).
 *   - Nothing is decremented. There is no stat to decrement (G7).
 */
export function recordSession(
  state: FatigueState,
  session: SessionRecord,
  rolls: InjuryRolls,
  options?: RecordSessionOptions,
): RecordSessionResult {
  assertValidSession(session);
  if (!Number.isFinite(rolls.onset) || !Number.isFinite(rolls.duration)) {
    throw new RangeError(`Injury rolls must be finite numbers, received ${JSON.stringify(rolls)}.`);
  }
  const latest = latestRecordedDay(state);
  if (latest !== null && session.day <= latest) {
    throw new RangeError(
      `Sessions must be recorded in strictly increasing day order. ` +
        `Latest recorded day is ${latest}, received ${session.day}.`,
    );
  }
  const physioDaysSaved = options?.physioDaysSaved ?? 0;
  if (!Number.isInteger(physioDaysSaved) || physioDaysSaved < 0) {
    throw new RangeError(
      `physioDaysSaved must be a whole number >= 0, received ${physioDaysSaved}.`,
    );
  }
  const techniqueRating = options?.techniqueRating ?? 0;
  if (!Number.isFinite(techniqueRating)) {
    throw new RangeError(`techniqueRating must be a finite number, received ${techniqueRating}.`);
  }

  const existing = state.injury;
  const immune =
    existing !== null && session.day <= existing.endDay + FATIGUE_TUNING.INJURY_IMMUNITY_DAYS_AFTER;

  // THE ONLY READ OF HISTORY ON THE INJURY PATH is `immune`, immediately above,
  // and it can only ever force the chance DOWN to zero (G4). `residual` is not
  // computed here at all: `residualAtStartOfDay` is reachable from `sessionFeel`
  // and nowhere else, so the hidden scalar drives how today FEELS and has no
  // route to whether today hurts you.
  const probability = immune ? 0 : injuryProbability(session, techniqueRating);
  const injured = rolls.onset < probability;

  const withSession: FatigueState = {
    sessions: [...state.sessions.map(copySession), copySession(session)],
    injury: existing === null ? null : copyInjury(existing),
  };
  const pruned = pruneFatigueState(withSession, session.day);

  if (!injured) {
    return { state: pruned, injuryOnset: null };
  }

  const startDay = session.day + 1;
  const duration = injuryDurationDays(rolls.duration, physioDaysSaved);
  // UNTRUSTED KEY: `lift` is validated above, so this is the compiler's proof
  // rather than ours — but the table is hand-maintained and a missing entry
  // would otherwise produce an `undefined` kind stored in persisted state.
  const kind: InjuryKind | undefined = INJURY_KIND_FOR_LIFT[session.lift];
  if (kind === undefined) {
    throw new RangeError(`No injury kind mapped for lift ${String(session.lift)}.`);
  }
  const record: InjuryRecord = {
    kind,
    lift: session.lift,
    startDay,
    endDay: startDay + duration - 1,
  };
  return {
    state: { sessions: pruned.sessions, injury: record },
    injuryOnset: noticeFor(record, startDay),
  };
}

// ---------------------------------------------------------------------------
// SessionFeel — the interpreted read model, with its numeric half hidden
// ---------------------------------------------------------------------------

/**
 * The key the one internal number lives under. Module-private and a symbol, so
 * `SessionFeel` has no numeric property a caller can name, spread over,
 * enumerate or serialise. See WHY `SessionFeel` HAS A HIDDEN HALF at the top of
 * this file for what that closes and what it deliberately does not.
 */
const FEEL_INTERNALS: unique symbol = Symbol('fatigue.feel');

interface FeelInternals {
  /**
   * Hidden fatigue and readiness, combined. Signed: negative is primed,
   * positive is burdened, zero is neutral-and-fresh. Everything the mechanic
   * reads is a function of this.
   */
  readonly burden: number;
}

/**
 * Everything the game needs to know about how today should feel.
 *
 * THE READABLE FIELDS ARE QUALITATIVE. `barSpeed` is one of five bands and
 * `barSpeedText` is its copy — between them they contain no number at all, which
 * the suite checks by serialising the object and matching for digits.
 *
 * Two readable fields DO carry numbers, and neither is a fatigue level:
 *   - `readiness.loadAdjustmentPercent` is a readout of the player's own three
 *     taps. The suite asserts the whole `readiness` object is identical across
 *     wildly different fatigue histories, so it leaks nothing.
 *   - `injury.daysRemaining` is a countdown on a rare discrete event, not a
 *     continuous readout. It says a setback is running and for how much longer,
 *     which is exactly what GDD §3.5 wants surfaced.
 */
export interface SessionFeel {
  /** History-derived readiness copy. Qualitative; load percent is 0. */
  readonly readiness: ReadinessReport;
  /** How the bar is expected to move (GDD §3.4). A prediction, not a reading. */
  readonly barSpeed: BarSpeedCue;
  readonly barSpeedText: string;
  readonly injury: InjuryNotice | null;
  /** Not enumerable by name. See FEEL_INTERNALS. */
  readonly [FEEL_INTERNALS]: FeelInternals;
}

/**
 * How deep into the session a rep is — the "same-day" half of GDD §3.4's
 * horizon. Optional everywhere; omitting it means "start of the session".
 * Never persisted, so it cannot leak into tomorrow.
 */
export interface LiftMoment {
  /** Work sets finished in this session before the current one. */
  readonly workSetsCompleted: number;
  /** Reps finished inside the current set before this rep. */
  readonly repsCompletedInSet: number;
}

function withinSessionBurden(moment: LiftMoment | undefined): number {
  if (moment === undefined) return 0;
  const sets = Math.max(0, moment.workSetsCompleted);
  const reps = Math.max(0, moment.repsCompletedInSet);
  if (!Number.isFinite(sets) || !Number.isFinite(reps)) return 0;
  const raw =
    sets * FATIGUE_TUNING.WITHIN_SESSION_BURDEN_PER_SET +
    reps * FATIGUE_TUNING.WITHIN_SESSION_BURDEN_PER_REP;
  return Math.min(FATIGUE_TUNING.WITHIN_SESSION_BURDEN_MAX, raw);
}

function barSpeedForBurden(burden: number): BarSpeedCue {
  const bands = FATIGUE_TUNING.BAR_SPEED_BAND_MAX_BURDEN;
  for (let i = 0; i < bands.length; i += 1) {
    const band = bands[i];
    if (band !== undefined && burden < band.maxBurden) return band.cue;
  }
  // Unreachable while the last band is +Infinity; the suite pins that.
  return 'grinding';
}

/**
 * Read today's feel. This is the only entry point that touches hidden state,
 * and everything it hands back is either qualitative or behind the symbol.
 *
 * `checkIn` defaults to `NEUTRAL_CHECK_IN` so a session can be read before the
 * player has tapped anything.
 */
export function sessionFeel(
  state: FatigueState,
  day: number,
  checkIn: ReadinessCheckIn = NEUTRAL_CHECK_IN,
): SessionFeel {
  assertDayIndex(day, 'day');
  // Copy is history. Burden still accepts an optional check-in so existing
  // mechanic unit tests of tap-relief keep a path; the player loop always
  // passes `NEUTRAL_CHECK_IN` (zero relief).
  const readiness = historyReadiness(state, day);
  const residual = residualAtStartOfDay(state, day);
  const burden =
    FATIGUE_TUNING.FATIGUE_BURDEN_WEIGHT * residual -
    FATIGUE_TUNING.READINESS_RELIEF_WEIGHT * readinessScore(checkIn);
  const cue = barSpeedForBurden(burden);
  // UNTRUSTED KEY: `cue` came from a table walk, not from the compiler.
  const text: string | undefined = FATIGUE_COPY.BAR_SPEED_TEXT[cue];
  if (text === undefined) {
    throw new RangeError(`Bar speed cue ${cue} has no copy.`);
  }
  return {
    readiness,
    barSpeed: cue,
    barSpeedText: text,
    injury: activeInjury(state, day),
    [FEEL_INTERNALS]: { burden: scrub(burden) },
  };
}

function burdenOf(feel: SessionFeel, moment: LiftMoment | undefined): number {
  const internals: FeelInternals | undefined = feel[FEEL_INTERNALS];
  if (internals === undefined || !Number.isFinite(internals.burden)) {
    throw new TypeError(
      'Expected a SessionFeel produced by sessionFeel(). ' +
        'Object literals cannot be used here — the internal half is not nameable.',
    );
  }
  return internals.burden + withinSessionBurden(moment);
}

// ---------------------------------------------------------------------------
// The four channels fatigue is FELT through (GDD §3.4)
// ---------------------------------------------------------------------------

/**
 * GDD §3.4: "Tighter input timing windows when fatigued; more forgiving when
 * primed."
 *
 * Takes the lift mechanic's own base window in milliseconds and returns the
 * window to actually use. It returns MILLISECONDS, not a normalised scale, so
 * what comes back is a mechanic parameter rather than a level: 240 ms means
 * 240 ms, and there is no denominator to render a bar against.
 *
 * Bounded by `TIMING_WINDOW_SCALE_MIN`/`_MAX`, so no amount of fatigue can make
 * the mechanic unplayable and no amount of priming can trivialise it.
 */
export function adjustedTimingWindowMs(
  baseWindowMs: number,
  feel: SessionFeel,
  moment?: LiftMoment,
): number {
  if (!Number.isFinite(baseWindowMs) || baseWindowMs <= 0) {
    throw new RangeError(
      `baseWindowMs must be a positive finite number, received ${baseWindowMs}.`,
    );
  }
  const burden = burdenOf(feel, moment);
  const scale = clamp(
    1 - FATIGUE_TUNING.TIMING_WINDOW_SCALE_PER_BURDEN * burden,
    FATIGUE_TUNING.TIMING_WINDOW_SCALE_MIN,
    FATIGUE_TUNING.TIMING_WINDOW_SCALE_MAX,
  );
  return scrub(baseWindowMs * scale);
}

/**
 * GDD §3.4: "Missed reps becoming more likely as fatigue accumulates."
 *
 * Takes the mechanic's own miss probability for this rep and shifts it. The
 * shift is applied to the ODDS, so the result is always in [0, 1] whatever the
 * knobs are set to, and a rep the mechanic calls certain (0 or 1) stays certain.
 *
 * The number that comes back is dominated by the attempt's own difficulty, not
 * by fatigue, which is what keeps it from being a readable fatigue level.
 */
export function adjustedMissChance(
  baseMissChance: number,
  feel: SessionFeel,
  moment?: LiftMoment,
): number {
  if (!Number.isFinite(baseMissChance)) {
    throw new RangeError(`baseMissChance must be a finite number, received ${baseMissChance}.`);
  }
  const base = clamp(baseMissChance, 0, 1);
  if (base <= 0) return 0;
  if (base >= 1) return 1;
  const burden = burdenOf(feel, moment);
  const multiplier = clamp(
    1 + FATIGUE_TUNING.MISS_ODDS_MULTIPLIER_PER_BURDEN * burden,
    FATIGUE_TUNING.MISS_ODDS_MULTIPLIER_MIN,
    FATIGUE_TUNING.MISS_ODDS_MULTIPLIER_MAX,
  );
  const odds = (base / (1 - base)) * multiplier;
  return scrub(odds / (1 + odds));
}

export type RepOutcome = 'made' | 'missed';

/**
 * Resolve one rep against a caller-supplied roll in [0, 1). Exists so callers
 * have a deterministic path and never need to reach for `Math.random` — the
 * randomness stays outside the pure module (and, per CLAUDE.md, outside the
 * client for anything that mutates progression).
 */
export function resolveRepAttempt(
  baseMissChance: number,
  feel: SessionFeel,
  roll: number,
  moment?: LiftMoment,
): RepOutcome {
  if (!Number.isFinite(roll)) {
    throw new RangeError(`roll must be a finite number, received ${roll}.`);
  }
  return roll < adjustedMissChance(baseMissChance, feel, moment) ? 'missed' : 'made';
}

/**
 * GDD §3.4: "Readiness check-in shifting what a given RPE actually feels like."
 *
 * Given the RPE the session prescribes, returns the RPE it will feel like
 * today. Snapped to the published chart's own 0.5 step and clamped to its range
 * (`rpe.ts`'s `RPE_CHART_COVERAGE`) so the answer is always a number a lifter
 * recognises, and so the readout is coarse: across the entire reachable burden
 * range the shift takes FIVE distinct values as shipped, which is a sentence
 * ("your 8 is going to feel like a 9") rather than a gauge. `fatigue.test.ts`
 * measures that count rather than trusting this comment.
 *
 * Coarse is not the same as leak-proof. Five states is still five states, and a
 * caller determined to plot them can. See the no-meter discussion in the header.
 *
 * The step and bounds come from `rpe.ts` rather than being restated here, so
 * this cannot drift from the chart. Nothing else about the chart is used: this
 * is a feel abstraction (GDD §3.1) and is not a load calculation.
 */
export function perceivedRpe(prescribedRpe: number, feel: SessionFeel, moment?: LiftMoment): number {
  if (!Number.isFinite(prescribedRpe)) {
    throw new RangeError(`prescribedRpe must be a finite number, received ${prescribedRpe}.`);
  }
  const burden = burdenOf(feel, moment);
  const rawShift = FATIGUE_TUNING.PERCEIVED_RPE_SHIFT_PER_BURDEN * burden;
  const cappedShift = clamp(
    rawShift,
    -FATIGUE_TUNING.PERCEIVED_RPE_SHIFT_MAX,
    FATIGUE_TUNING.PERCEIVED_RPE_SHIFT_MAX,
  );
  const step = RPE_CHART_COVERAGE.RPE_STEP;
  const snappedShift = Math.round(cappedShift / step) * step;
  return scrub(
    clamp(
      prescribedRpe + snappedShift,
      RPE_CHART_COVERAGE.MIN_RPE,
      RPE_CHART_COVERAGE.MAX_RPE,
    ),
  );
}
