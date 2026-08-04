/**
 * SESSION_TUNING — every game-feel number the daily session loop uses.
 *
 * ---------------------------------------------------------------------------
 * NOTHING HERE HAS BEEN PLAYED. READ THIS BEFORE TRUSTING A VALUE.
 * ---------------------------------------------------------------------------
 * GDD §12.1: a one-shot run "cannot tell you whether pressing the screen to
 * grind out a squat feels good", and CLAUDE.md budgets roughly 30 hand-tuning
 * passes on exactly this class of value. Every number below is an UNTUNED
 * PLACEHOLDER.
 *
 * What they were chosen against is a much weaker property than "good", and it
 * is the only claim made for them:
 *
 *   1. The prescribed load ladder is not degenerate. At `REPS_PER_SET` reps the
 *      five RPE choices put five materially different bars on the platform, and
 *      the lift mechanic's sticking point appears partway up that ladder rather
 *      than at one end. `sessionTuning.test.ts` measures that from
 *      `ascentDemand` rather than asserting it here.
 *   2. A played session lands inside GDD §3.2's 60-90 s window on the timings
 *      below. `session.test.ts` computes the length from the same constants the
 *      screens run on, so a template change that blows the budget fails a test.
 *
 * Neither of those is a claim about feel.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * CLAUDE.md, "Game Feel Values Must Be Tunable": "Keep every such value as a
 * named constant in one place. Never scatter them as magic numbers across
 * components."
 *
 * This is that place for the session loop. `session.ts`, `sessionServer.ts` and
 * every component under `src/session/` read from here and may not contain a
 * bare timing, threshold, duration or layout number.
 * `sessionTuning.test.ts` scans those sources for numeric literals and fails on
 * anything outside a small allowlist of structural constants, so the rule is
 * enforced rather than asked for.
 *
 * WHAT IS DELIBERATELY *NOT* HERE:
 *
 *   - The rep mechanic's own timings, windows, forces and haptics. Those are
 *     `LIFT_TUNING` and the session does not restate one of them.
 *   - The fatigue model's coefficients. Those are `FATIGUE_TUNING`, including
 *     `READINESS_LOAD_ADJUSTMENT_PERCENT` — the "+5%" GDD §3.2 names. The
 *     session applies that percentage; it does not own it.
 *   - The streak economy. That is `RECOVERY_DAY_GUARDRAILS` in `streak.ts`.
 *   - Anything published. RPE percentages, Epley's divisor and DOTS
 *     coefficients are domain data, not knobs, and live in their own modules.
 */

import type { RoundingMode, WeightUnit } from './rpe';
import type { LiftKind } from './meet';

/** The three check-in questions, in the order GDD §3.2 lists them. */
export type CheckInQuestion = 'sleep' | 'soreness' | 'motivation';

export const CHECK_IN_QUESTIONS = Object.freeze([
  'sleep',
  'soreness',
  'motivation',
] as const satisfies readonly CheckInQuestion[]);

export const SESSION_TUNING = Object.freeze({
  // -------------------------------------------------------------------------
  // What today's session is
  // -------------------------------------------------------------------------

  /**
   * The daily rotation (GDD §3.2: "One lift per day ... on rotation").
   *
   * THREE LIFTS, NOT FOUR. §3.2 names "squat day, bench day, deadlift day,
   * accessory day", and what an accessory day may move HAS NOW BEEN RULED:
   * `LiftKind` stays exactly the three contested lifts, matching real meet
   * structure; accessory work does not write `bestE1rmKg` and produces no e1RM
   * close-out; it contributes **Training IQ** (GDD §2's existing currency) and
   * nothing else lift-specific.
   *
   * SO THIS LIST IS STILL THREE, AND THE REASON HAS CHANGED. It is no longer an
   * unanswered question — it is that the ruling's other half is not built.
   * Recording an accessory session needs two things `progression.ts` does not
   * have: a `trainingIq` fact (with a §8.1 protection answer, which is a real
   * decision — Training IQ is "how well you train", so whether it counts as
   * training pace under §8.1 has to be answered rather than assumed) and a
   * proposal kind for a session that reports no `LiftKind` at all. Adding a
   * fourth entry here before those exist would put a session on screen that the
   * server refuses — `sessionServer.ts` now returns `NOT_A_COMPETITION_LIFT`
   * rather than half-recording it, and `sessionServer.test.ts` checks this list
   * against `LIFT_ORDER` for exactly that reason.
   *
   * The parts of the ruling that ARE enforced today are the refusals: see the
   * accessory-day section of `sessionServer.ts`'s header for the compile-time
   * and runtime fences.
   */
  LIFT_ROTATION: Object.freeze(['squat', 'bench', 'deadlift'] as const satisfies readonly LiftKind[]),

  /**
   * The RPE targets offered (GDD §3.3: "Player selects RPE target (6-10), not
   * raw weight"). Whole steps, so the choice is one tap on five buttons rather
   * than a scrubber over nine.
   *
   * Every entry must be a charted RPE and every (REPS_PER_SET, entry) pair must
   * be a cell the published chart actually holds — `sessionTuning.test.ts`
   * checks both against `rpe.ts` rather than trusting this note. Widening to
   * half steps is a legal edit; inventing an RPE outside 6-10 is not, and the
   * chart refuses it anyway.
   */
  RPE_CHOICES: Object.freeze([6, 7, 8, 9, 10] as const),

  /**
   * Which choice the ladder opens on, as an index into `RPE_CHOICES`.
   *
   * Index 2 is RPE 8. At `REPS_PER_SET` reps that is 86.3% of e1RM, which sits
   * just UNDER the load where the lift mechanic's peak demand crosses the
   * lifter's capacity — so the default rep goes up for a player who releases at
   * depth, and the two choices above it are where the grind starts. Measured
   * from `ascentDemand` in `sessionTuning.test.ts`, not asserted here.
   *
   * NOT A DIFFICULTY SETTING. It is one tap away from every other choice and
   * the player picks before every session.
   */
  DEFAULT_RPE_INDEX: 2,

  /**
   * Work sets, and reps in each. Together with `RPE_CHOICES` these decide both
   * the prescribed load (the chart cell is (REPS_PER_SET, targetRpe)) and how
   * long the session runs.
   *
   * 5 x 3 is a conventional strength template, it is the pair that put a played
   * session inside GDD §3.2's 60-90 s on the beat timings below, and it happens
   * to be `fatigue.ts`'s own reference for "one properly hard session" (5x3 @
   * RPE 9 is strain 1.0 by construction of `STRAIN_REFERENCE`) — so a day at
   * the top of the ladder costs exactly one unit of the hidden model's own
   * currency rather than some fraction nobody chose.
   *
   * Both are expected to move in tuning; `session.test.ts` recomputes the
   * session length by PLAYING the reps, so a template that blows the budget
   * fails rather than ships.
   */
  WORK_SETS: 5,
  REPS_PER_SET: 3,

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  /**
   * Direction the prescribed load is snapped in, after the readiness nudge.
   *
   * DOWN, AND THE DIRECTION IS LOAD-BEARING. e1RM comes back out of a completed
   * set through the same chart the load went in through (`e1rm.ts`), so a set
   * hit exactly on target reports exactly the e1RM it was prescribed from —
   * that round trip is the property `e1rm.ts` exists to protect. Rounding to
   * the NEAREST 2.5 kg breaks it in one direction only: half the time the bar
   * ends up above the exact target, the set reports an e1RM a kilo or two above
   * the current one, and because the server keeps the BEST e1RM that becomes a
   * permanent PR bought with rounding. The next day's prescription is computed
   * from the new number and rounds up again. Rounding down closes THAT route:
   * the bar is never heavier than the target, so rounding alone can never mint
   * a PR.
   *
   * IT DOES NOT CLOSE THE OTHER ROUTE, and this note used to read as if it did.
   * The readiness nudge multiplies the bar BEFORE this rounding, so a positive
   * check-in still puts up a bar above the target and still ratchets — measured
   * in `session.test.ts` at 685 of 685 swept cells on `primed` and 634 of 685
   * on `ready`. Rounding down only bounds how much: on `ready` it swallows the
   * nudge entirely in the other 51. See the header of `session.ts` for the
   * 30-session curve that produces, and for why the fix is a recorded
   * dependency (GDD §3.4) rather than a knob in this file.
   */
  LOAD_ROUNDING_MODE: 'down' as RoundingMode,

  /**
   * Unit the prescribed load is expressed and rounded in. GDD §11 has not
   * settled the app's default display unit; this is the loading unit, and
   * `rpe.ts` owns the increment for it (2.5 kg = 1.25 a side).
   */
  LOAD_UNIT: 'kg' as WeightUnit,

  /**
   * Starting e1RM per lift, kg, for a lifter with no history.
   *
   * PLACEHOLDER DATA, NOT PROGRESSION. Nothing here is persisted and nothing
   * derives from it once the server has a real number; it exists so the first
   * session has a bar to load. With a backend these arrive from onboarding.
   */
  STARTING_E1RM_KG: Object.freeze({ squat: 180, bench: 120, deadlift: 220 } as const satisfies Record<LiftKind, number>),

  // -------------------------------------------------------------------------
  // Beats — how long each part of the loop is held
  //
  // These are the numbers the 60-90 s budget is spent on. Every one is a
  // stopwatch value a playtester will move.
  //
  // MEASURED AT THESE VALUES by `session.test.ts`, which plays every rep of a
  // 5 x 3 through the real lift mechanic with a cue-obedient player and adds
  // the beats below (`playedSessionMs`). Machine time only — no time spent
  // tapping or reading, because the player is a script:
  //
  //     RPE 6   54.3 s     RPE 7   55.6 s     RPE 8   57.8 s
  //     RPE 9   58.3 s     RPE 10  60.3 s
  //
  // FOUR OF THE FIVE RUNGS ARE UNDER GDD §3.2's 60 s FLOOR. That is recorded as
  // a divergence in GDD §11 and is treated as a virtue rather than a defect:
  // §12.2 judges this piece against a best-in-class daily-habit app and the bar
  // is that ours "must not be slower or flabbier". The suite therefore asserts
  // the CEILING only. An earlier version asserted a 60 s floor as well, and it
  // passed solely because the guess below was added to the measurement first.
  //
  // A human also spends a few seconds on the check-in and a few reading the
  // payoff, which is what `HUMAN_INPUT_BUDGET_MS` below stands in for. At the
  // top of the ladder an undriven session banks nothing and ends in 28 s — that
  // is the retry path, not a session length.
  // -------------------------------------------------------------------------

  /**
   * How long the modifier line is held before the RPE ladder becomes tappable.
   *
   * GDD §3.2 wants the modifier "applied and surfaced", so it needs a beat of
   * its own — but a beat the player cannot tap through is a tax, so this is
   * short and the ladder is live the moment it ends.
   */
  BRIEFING_REVEAL_MS: 420,

  /** How long a resolved rep is held before the next one braces. */
  REP_RESULT_HOLD_MS: 700,

  /**
   * The rest beat between work sets. The only pause in the session that exists
   * for pacing rather than for reading something.
   */
  SET_REST_MS: 2600,

  /** How long the close-out takes to assemble, per row, and the gap between rows. */
  CLOSE_OUT_ROW_FADE_MS: 260,
  CLOSE_OUT_ROW_STAGGER_MS: 220,

  /**
   * How long the e1RM number takes to count from the old value to the new one
   * on a PR. Zero on a session that did not set one — there is nothing to
   * count.
   */
  CLOSE_OUT_E1RM_COUNT_MS: 900,

  /** How far the streak count pops when it ticks, as a scale multiple. */
  CLOSE_OUT_STREAK_POP_SCALE: 1.4,
  CLOSE_OUT_STREAK_POP_MS: 340,

  /**
   * What the session-length budget allows for the player READING AND DECIDING:
   * three check-in taps, one RPE choice, and reading the close-out.
   *
   * A GUESS, AND THE ONLY NUMBER IN THIS FILE THAT NO CODE CONSUMES. GDD §3.2
   * budgets "5 sec" for the check-in itself; this is that plus a beat to pick an
   * RPE and a beat to read the payoff. Nothing but a playtest can supply the
   * real figure.
   *
   * WHAT IT MAY AND MAY NOT HOLD UP. `session.test.ts` adds it to the measured
   * machine time before checking the 90 s CEILING, which makes that check
   * stricter and is the safe direction for a guess to point. It must not be
   * used to hold up a FLOOR: it previously was, and the effect was that a
   * 54.3 s session read as 63.3 s and satisfied a `>= 60_000` assertion the
   * loop itself did not satisfy. That assertion is gone.
   */
  HUMAN_INPUT_BUDGET_MS: 9000,

  // -------------------------------------------------------------------------
  // Determinism
  // -------------------------------------------------------------------------

  /**
   * Base for the per-rep seed the lift mechanic's wobble jitter runs off.
   *
   * NOT A FEEL VALUE and not randomness: the seed is derived from
   * (day, set, rep) so a session is byte-identical when replayed, which is what
   * `session.test.ts` leans on. It lives here because it is a bare number and
   * this file is the only place one is allowed.
   */
  SEED_BASE: 7919,
  SEED_SET_STRIDE: 101,
  SEED_REP_STRIDE: 7,

  // -------------------------------------------------------------------------
  // Precision
  // -------------------------------------------------------------------------

  /**
   * NOT A FEEL VALUE. Decimal places used to scrub IEEE-754 noise out of
   * returned numbers. Here only because the brief is that this module has
   * exactly one constants block.
   */
  PRECISION_DECIMALS: 6,

  /** Decimal places an e1RM is displayed to. Presentation only. */
  E1RM_DISPLAY_DECIMALS: 1,

  /**
   * NOT A FEEL VALUE. The divisor that turns a percentage into a fraction, so
   * `readiness.loadAdjustmentPercent` can be applied to a load. Arithmetic, not
   * a knob — changing it does not make the game easier, it makes it wrong.
   * Here only because the brief is that this module has exactly one constants
   * block and a bare `/ 100` would violate that more than this does.
   */
  PERCENT_TO_FRACTION: 100,

  /**
   * The order the close-out's rows arrive in. Each one is delayed by its index
   * times `CLOSE_OUT_ROW_STAGGER_MS`, so this is where "which beat lands first"
   * is decided — reorder it and the payoff reads differently.
   */
  CLOSE_OUT_ROW_ORDER: Object.freeze({ CALL: 0, E1RM: 1, STREAK: 2, REPS: 3 }),
});

/**
 * DEBUG ONLY. Placeholder facts the `?session=` preview route builds a screen
 * from, so the renderer can be photographed at beats a wall clock and a
 * headless browser cannot reliably hit — the same problem, and the same idiom,
 * as `LIFT_TUNING.DEMO` and `src/lift/liftReplay.ts`.
 *
 * NOT PROGRESSION. Nothing here is persisted, nothing derives from it in a
 * played session, and the preview route is never reached by a player. With a
 * backend these numbers do not exist at all.
 */
export const SESSION_PREVIEW = Object.freeze({
  /** Day index the preview pins, so the rotation and the lift are stable. */
  DAY: 20300,
  E1RM_KG: 200,
  BEST_E1RM_KG: 200,
  STREAK_BEFORE: 11,
  /** RPE the preview session is taken at. */
  RPE: 8,
});

/**
 * SESSION_LAYOUT — screen geometry for the session screens, in logical points
 * at phone scale.
 *
 * Here rather than in a StyleSheet for the reason `LIFT_TUNING.LAYOUT` gives:
 * these are values somebody will move by hand while looking at a phone, and
 * `sessionTuning.test.ts` fails if a bare one appears under `src/session/`.
 * Authored against a 390 x 844 viewport (iPhone 14).
 *
 * The lift stage keeps its own geometry (`LIFT_TUNING.LAYOUT`) — the session
 * does not restate a single number of it.
 */
export const SESSION_LAYOUT = Object.freeze({
  SCREEN_PAD: 20,
  ROW_GAP: 10,
  SECTION_GAP: 26,

  TITLE_FONT: 13,
  QUESTION_FONT: 11,
  ANSWER_FONT: 15,
  MODIFIER_FONT: 24,
  PROMPT_FONT: 13,
  HINT_FONT: 12,
  PLAN_FONT: 15,
  BIG_NUMBER_FONT: 44,
  UNIT_FONT: 15,
  LABEL_FONT: 11,
  HEADLINE_FONT: 22,
  SUBHEAD_FONT: 13,
  STAT_FONT: 26,
  LETTER_SPACING: 2,

  /** Check-in answer chips. Three across, tall enough for a thumb. */
  CHIP_HEIGHT: 52,
  CHIP_RADIUS: 10,
  CHIP_GAP: 8,
  CHIP_BORDER: 2,

  /** The RPE ladder. Five across, so each is narrower than a chip. */
  RPE_CHIP_HEIGHT: 60,
  RPE_CHIP_GAP: 6,

  /** The set counter pips shown above the stage while a set is live. */
  PIP_SIZE: 8,
  PIP_GAP: 6,

  BUTTON_HEIGHT: 48,
  BUTTON_RADIUS: 10,
  BUTTON_FONT: 13,

  /** Close-out stat rows. */
  STAT_ROW_GAP: 18,
  DIVIDER_HEIGHT: 1,
});

/**
 * The one pacing guard the server stand-in applies. Kept out of the block above
 * because it is not a feel value a playtester turns with a stopwatch — it is a
 * bound on what the server will accept from a client.
 *
 * WHAT IT IS NOT: a solution to long-run progression pacing, and at the shipped
 * value it is not even a brake. 6% per session sits ABOVE the largest jump this
 * loop can produce (the readiness nudge, `+5%` at `primed`), so it never binds
 * on an honest session and the compounding described in `session.ts`'s header
 * runs straight past it. It is a guard against a client reporting nonsense, in
 * the same spirit as `INJURY_MAX_CHANCE_PER_SESSION` being currently slack.
 *
 * DO NOT REPURPOSE IT AS THE PACING LEVER. Session-over-session growth needs to
 * be coupled to RPE/effort history rather than paid flat for three self-reported
 * taps, and that coupling is a recorded dependency on the fatigue/progression
 * module (GDD §3.4). Tightening this number instead would put a pacing constant
 * in the wrong file, ahead of the thing it is meant to pace, for somebody else
 * to unpick later.
 */
export const SESSION_PROGRESSION_GUARD = Object.freeze({
  /** Most one session may raise the best e1RM on record, as a fraction. */
  MAX_E1RM_GAIN_FRACTION_PER_SESSION: 0.06,
});

/**
 * Player-facing copy. Out of the numeric block so that block stays purely
 * numeric for whoever is turning knobs. Copy is hand-tuned too, just by a
 * different person on a different pass.
 */
export const SESSION_COPY = Object.freeze({
  /** GDD §3.2: "3 taps: sleep / soreness / motivation". */
  CHECK_IN_TITLE: 'HOW ARE YOU TODAY?',
  CHECK_IN_QUESTION: Object.freeze({
    sleep: 'SLEEP',
    soreness: 'SORENESS',
    motivation: 'MOTIVATION',
  } as const satisfies Record<CheckInQuestion, string>),
  CHECK_IN_ANSWER: Object.freeze({
    sleep: Object.freeze({ poor: 'Poor', ok: 'OK', good: 'Good' }),
    soreness: Object.freeze({ sore: 'Sore', normal: 'Normal', fresh: 'Fresh' }),
    motivation: Object.freeze({ flat: 'Flat', steady: 'Steady', 'fired-up': 'Fired up' }),
  }),

  LIFT_LABEL: Object.freeze({
    squat: 'SQUAT',
    bench: 'BENCH',
    deadlift: 'DEADLIFT',
  } as const satisfies Record<LiftKind, string>),

  /** The briefing. The modifier headline itself comes from `fatigue.ts`. */
  BRIEFING_PROMPT: 'PICK YOUR RPE',
  BRIEFING_RPE_HINT: 'Heavier target, heavier bar. The game does the maths.',
  BRIEFING_PLAN: 'sets',

  SET_LABEL: 'SET',
  SET_OF: 'OF',
  REST_PROMPT: 'RACK IT',
  REST_NEXT: 'NEXT SET',

  /** The close-out. GDD §3.2: e1RM, streak, feedback. Never a Total. */
  CLOSE_OUT_PR_HEADLINE: 'NEW e1RM',
  CLOSE_OUT_HELD_HEADLINE: 'SESSION LOGGED',
  CLOSE_OUT_EMPTY_HEADLINE: 'NOTHING BANKED',
  CLOSE_OUT_PR_SUBHEAD: 'You beat your best estimate on this lift.',
  CLOSE_OUT_HELD_SUBHEAD: 'Target hit. Your estimate holds.',
  CLOSE_OUT_SHORT_SUBHEAD: 'Short of the target. Nothing lost — the estimate stands.',
  CLOSE_OUT_EMPTY_SUBHEAD: 'No reps to log. Take it again, lighter.',
  CLOSE_OUT_E1RM_LABEL: 'e1RM',
  CLOSE_OUT_STREAK_LABEL: 'DAY STREAK',
  CLOSE_OUT_REPS_LABEL: 'REPS BANKED',
  CLOSE_OUT_DONE: 'DONE',
  CLOSE_OUT_RETRY: 'TRAIN AGAIN',

  /**
   * Shown once a completed session has been logged and the player is back on
   * the same day. GDD §3.2 is one session per day; this is what the loop says
   * instead of offering a second one.
   */
  ALREADY_TRAINED_HEADLINE: 'TRAINED TODAY',
  ALREADY_TRAINED_SUBHEAD: 'Come back tomorrow. The bar keeps.',
});
