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
import type { StartingE1rmSeed } from './progression';

/**
 * THE SEED'S TYPE LIVES IN `progression.ts`, WITH ITS THREE SIBLINGS.
 *
 * `StartingE1rmSeed` and `KilogramStartingE1rm` were declared here, on the
 * argument that a unit should be declared at the authoring site. THE VALUE IS
 * STILL AUTHORED HERE and still carries that argument — see `STARTING_E1RM`
 * below, which is `satisfies StartingE1rmSeed` with the whole paragraph on what
 * it reaches. Only the TYPE moved, and it moved for one reason: `progression.ts`
 * asserts `ArmsAreTellableApart` over each unit-tagged pair on the progression
 * wire, the helper is module-private there, and the seed was the one pair of the
 * four with no such assertion — the property called "the guarantee" in
 * `sessionServer.ts`, held by convention. It has one now.
 *
 * This module therefore imports a type from `progression.ts` and nothing else.
 * The import is `import type`, so it is erased and no runtime edge exists.
 */

/** The three check-in questions, in the order GDD §3.2 lists them. */
export type CheckInQuestion = 'sleep' | 'soreness' | 'motivation';

export const CHECK_IN_QUESTIONS = Object.freeze([
  'sleep',
  'soreness',
  'motivation',
] as const satisfies readonly CheckInQuestion[]);

/**
 * The two facts about the streak clock a first-run lifter is told rather than
 * left to discover (GDD §4.2).
 *
 * Both are already implemented and both are already correct. What was missing
 * is that nothing said either one out loud, so the way a player found out was
 * by losing something. The GDD asks for the disclosure in as many words in
 * both places — "Onboarding copy has to say so" under §4.2's no-free-absences
 * ruling, and "store and onboarding copy have to say it plainly" under §4.2's
 * rolling-entitlement ruling.
 *
 * Declared here beside the copy, the way `CheckInQuestion` is, so the id set
 * and the sentence table are one edit rather than two that can drift apart.
 * `src/game/onboardingDisclosure.ts` decides which of them a given screen
 * shows and is the module that pairs each id with its sentence.
 */
export type OnboardingDisclosureId = 'signup-grant-loss' | 'entitlement-non-carryover';

export const ONBOARDING_DISCLOSURE_IDS = Object.freeze([
  'signup-grant-loss',
  'entitlement-non-carryover',
] as const satisfies readonly OnboardingDisclosureId[]);

export const SESSION_TUNING = Object.freeze({
  // -------------------------------------------------------------------------
  // What today's session is
  // -------------------------------------------------------------------------

  /**
   * The day's programmed lift (GDD §3.2). The session opens on
   * `liftForDay(today)`; the player may pick a different member of this list
   * on the check-in. This is still the chooser list, not only a calendar.
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
   * Starting e1RM per lift for a lifter with no history, with the unit it is
   * expressed in as a FIELD rather than as part of a name. See
   * `StartingE1rmSeed` in `progression.ts` for why the shape is this and not
   * three bare numbers, and for the edit it exists to catch.
   *
   * PLACEHOLDER MAGNITUDES — AND PROGRESSION. Say both halves, because the
   * comment this replaced said only the first and got the second backwards.
   * The three numbers are stand-ins a real sign-up flow replaces, and nobody
   * has playtested them. What they are NOT is inert: `newServerRecord()` writes
   * them into `bestE1rmKg` — protected, on the wire, and monotone via
   * `nextBestE1rm` — so on every brand-new account this is the permanent FLOOR
   * under a lifter's e1RM, and it goes on deriving for as long as the account
   * exists. Changing a magnitude here changes what every future account can
   * never drop below; changing the unit without converting them is a build
   * error.
   *
   * WHY THE SEED IS A FLOOR RATHER THAN A GUESS THAT WASHES OUT, since that is
   * the surprising half: `nextBestE1rm` never returns below what is held, by
   * design (GDD §3.4 — a bad day must not cost a lifter their number), so no
   * honest session can lower it. That is a deliberate property of the
   * progression rule, not a defect of this constant, and it is why this
   * constant is progression.
   */
  STARTING_E1RM: Object.freeze({
    unit: 'kg',
    kilograms: Object.freeze({ squat: 180, bench: 120, deadlift: 220 }),
  } as const satisfies StartingE1rmSeed),

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
 * THREE CLAUSES USED TO STAND HERE AND ONE OF THEM WAS FALSE, in the identical
 * technical sense that the same sentence was false over `STARTING_E1RM_KG` a
 * round earlier. It read: "NOT PROGRESSION. Nothing here is persisted, nothing
 * derives from it in a played session, and the preview route is never reached by
 * a player."
 *
 *   - "Nothing here is persisted" — TRUE. A preview cache is rebuilt on every
 *     call and dies with the tab; nothing writes a row.
 *   - "Nothing derives from it in a played session" — TRUE. `previewFrameFor` is
 *     reached from `?session=` and from nowhere the played loop runs.
 *   - "NOT PROGRESSION" — FALSE. `sessionPreview.ts`'s `recordBeforeSession()`
 *     writes `BEST_E1RM_KG` into `ServerRecord.bestE1rmKg`, which goes out on
 *     `snapshotWireFor` and arrives as `ConfirmedFacts.bestE1rmKg`: a
 *     `ConfirmedKg`, a `PROGRESSION_FACT_KEYS` member, `'protected'` in
 *     `FACT_PROTECTION`. The same field, brand and protection as the seed and
 *     the training card. It is a progression number on a debug route, which is a
 *     smaller thing than the seed and is NOT the same thing as "not
 *     progression".
 *
 * WHY THE DISTINCTION IS WORTH THE PARAGRAPH rather than a shorter denial: the
 * previous version of this sentence is what let the route go unnamed in
 * `progression.ts` §7 for a round. §7.3(c)(iii) now names the site, states why
 * it is not fenced, and says plainly that its exemption is weaker than the other
 * two previews'. If these magnitudes ever stop being debug-only, they are a seed
 * and take the seed's shape — a `StartingE1rmSeed`, not a `_KG` suffix.
 *
 * With a backend these numbers do not exist at all.
 */
export const SESSION_PREVIEW = Object.freeze({
  /** Day index the preview pins, so the rotation and the lift are stable. */
  DAY: 20300,
  E1RM_KG: 200,
  /**
   * The e1RM the preview's stand-in row holds BEFORE the scripted session.
   *
   * THE ONE VALUE IN THIS BLOCK THAT REACHES A PROTECTED FACT (see above, and
   * `progression.ts` §7.3(c)(iii)). Its unit is in the identifier rather than in
   * a field, which is the shape the seed was moved off; it keeps that shape
   * because it is debug-only and reaches no stored row, and the ruling is
   * recorded in §7.3(c) rather than left to be inferred from the name.
   */
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
  LIFT_CHIP_HEIGHT: 36,

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

  /**
   * The first-run disclosure block on the check-in (GDD §4.2).
   *
   * Smaller than a question row and set below all three of them on purpose:
   * GDD §12.2 measures this screen on time-to-first-input, so the disclosure
   * has to be readable without pushing the first tap off the first paint. Both
   * of these are placeholders in the sense the file header describes, and the
   * line height in particular is the one to turn first — two sentences of body
   * text set at the same tight leading as a chip label is the shape that reads
   * as a wall.
   */
  DISCLOSURE_FONT: 11,
  DISCLOSURE_LINE_HEIGHT: 16,
  DISCLOSURE_GAP: 8,

  /**
   * Dark wash over the Iron & Amber briefing gym so the readiness card stays
   * readable. Not a second palette — the gym is the room; this is type contrast.
   */
  BRIEFING_SCRIM: 0.32,
  BRIEFING_CARD_PAD: 18,
  BRIEFING_CARD_RADIUS: 14,
  BRIEFING_CARD_BORDER: 1,

  /** Compact HUD over the live-set plate. The gym is the room; this is type. */
  SET_HUD_PAD: 10,
  SET_HUD_HEIGHT: 56,
  SET_HUD_SCRIM: 0.42,
  SET_COMMAND_HEIGHT: 92,
  SET_COMMAND_SCRIM: 0.55,
});

/**
 * Height cuts for Iron & Amber training plates. Authored here so `src/session/`
 * does not grow bare literals. Deadlift cuts must never select a squat plate.
 */
export const IRON_AMBER = Object.freeze({
  SQUAT_HOLE_MAX: 0.42,
  BENCH_CHEST_MAX: 0.4,
  DEADLIFT_FLOOR_MAX: 0.34,
  DEADLIFT_LOCKOUT_MIN: 0.78,
  /** Cue overlay, as a fraction of the plate box — not sprite-era CUE_X/CUE_Y. */
  CUE_X_RATIO: 0.5,
  CUE_Y_RATIO: 0.58,
  PLATE_SCALE: 1.14,
  SQUAT_CROP_Y: 0,
  BENCH_CROP_Y: 18,
  DEADLIFT_CROP_Y: -42,
  GRIND_BELOW_CUE: 36,
});

/**
 * Continuous squat scene. Ratios of the live stage box, authored here so
 * `src/session/` does not grow bare literals. This is a renderer, not a
 * retune of `lift.ts`.
 */
export const SQUAT_VISUAL = Object.freeze({
  FLOOR_Y: 0.9,
  STAND_BAR_Y: 0.3,
  HOLE_BAR_Y: 0.58,
  MID_X: 0.5,
  STANCE: 0.13,
  KNEE_OUT: 0.035,
  HIP_DROP: 0.16,
  KNEE_DROP: 0.08,
  KNEE_ALONG: 0.5,
  HEAD_R: 0.03,
  LIMB_W: 0.03,
  TORSO_W: 0.07,
  TORSO_H: 0.16,
  BAR_THICK: 0.012,
  SLEEVE_FRAC: 0.22,
  COLLAR_W: 0.012,
  RACK_X_INSET: 0.12,
  RACK_W: 0.022,
  J_CUP_W: 0.05,
  J_CUP_H: 0.012,
  TREMOR_MAX: 0.007,
  TREMOR_FREQ: 0.62,
  BREATH_AMP: 0.005,
  BREATH_FREQ: 0.08,
  CHALK_COUNT: 7,
  CHALK_DRIFT: 0.0015,
  CHALK_SPREAD: 2,
  CHALK_R_MIN: 0.2,
  CHALK_R_SPAN: 0.4,
  CHALK_A: 4,
  CHALK_RISE: 0.08,
  GLOW_MIN: 0.12,
  CAMERA_VEL: 0.05,
  PLATE_SCALE: 0.42,
  PLATE_GAP: 0.01,
  PLATE_MAX_R: 0.11,
  PLATE_REF_MM: 450,
  SHAFT_OPACITY: 0.08,
  DUST_OPACITY: 0.1,
  LATERAL_SCALE: 0.0004,
  BEND_SCALE: 0.0008,
  HASH_A: 12.9898,
  HASH_B: 78.233,
  HASH_C: 43758.5453,
  HASH_HALF: 0.5,
  BREATH_TORSO: 2,
  SHAFT_X: 0.34,
  SHAFT_W: 0.28,
  DUST_COUNT: 5,
  DUST_R: 0.004,
  FOOT_W: 0.045,
  FOOT_H: 0.014,
  GLOW_PAD: 0.01,
  ARM_DROP: 0.015,
});

/**
 * The pacing guard the server stand-in applies. Kept out of the block above
 * because it is not a feel value a playtester turns with a stopwatch — it is a
 * bound on what the server will accept from a client.
 *
 * WHAT IT IS NOT: a solution to long-run progression pacing. 6% per session
 * sits ABOVE a typical honest physical opportunity at fixture loads (one
 * 2.5 kg plate on a ~172.5 kg RPE-8 bar is well under 6% of e1RM). At
 * implausible light loads a single increment can exceed 6% of current
 * best; the guard then binds. That is accepted. It is a guard against a
 * client reporting nonsense, in the same spirit as
 * `INJURY_MAX_CHANCE_PER_SESSION` being currently slack.
 *
 * DO NOT REPURPOSE EITHER END AS THE SESSION-OVER-SESSION PACING LEVER.
 * Growth ACROSS sessions is a physical progression opportunity in
 * `trainingProgress.ts` (GDD §3.4) paid for with thresholded credit.
 * The range below is about ONE session's own execution, not the sequence of
 * sessions. Tightening MAX instead would put a pacing constant in the wrong
 * file. Do not retune 6% to paper over plate geometry.

 *
 * MIN is Sprint 3's addition: `nextBestE1rm` scales the fraction it actually
 * grants, LINEARLY, between MIN (a set graded `executionQuality` 0 — the
 * worst reading `session.ts`'s `executionQualityFrom` can produce) and MAX (a
 * flawless one). Both ends are playtesting placeholders, same status as
 * `DRIVE_WINDOW_MS.MAXIMAL` and `DRIVE_ATTEMPTS_PER_REP.MAXIMAL` in
 * `liftTuning.ts` — 0.02 is a third of MAX rather than a derivation, chosen so
 * a grindy PR still banks SOMETHING (GDD §12.3's "never punish showing up"
 * spirit, extended here by taste rather than by the rule itself, which is
 * about attendance and says nothing about execution quality) without making
 * the ceiling meaningless. MIN must stay below MAX or the scaling in
 * `qualityScaledGainFraction` runs backwards; `session.test.ts` pins the
 * ordering, not just the values.
 */
export const SESSION_PROGRESSION_GUARD = Object.freeze({
  /** Most one session may raise the best e1RM on record, as a fraction. */
  MAX_E1RM_GAIN_FRACTION_PER_SESSION: 0.06,
  /** Least a session with a made rep still banks, at the worst execution quality. */
  MIN_E1RM_GAIN_FRACTION_PER_SESSION: 0.02,
});

/**
 * Per-lift progression credit (GDD §3.4, Session A v3).
 *
 * THIS IS PROGRESSION PACING, NOT FATIGUE AND NOT A METER. Fatigue stays
 * same-day / next-day feel. These knobs turn successful work into a scarce
 * physical right to put the next loadable increment on the bar, instead of
 * compounding a percent of current best every session, and instead of
 * hiding a fractional percent inside plate snap.
 *
 * CREDIT_PER_PROGRESSION_OPPORTUNITY = 12: a full successful 5×3 @ RPE 8
 * (stimulus 1.0) needs twelve same-lift sessions to bank one opportunity.
 * Realization is ordinary snapped bar + ONE existing rounding increment
 * (kg 2.5, lb 5). RPE 6 is recovery and cannot cash. Consume 12 only when
 * the heavier bar is realized as a new best e1RM.
 *
 * Beta game-pacing parameters, not sports-science claims. Career still
 * owns true multi-week arcs.
 */
export const TRAINING_PROGRESS_TUNING = Object.freeze({
  CREDIT_PER_PROGRESSION_OPPORTUNITY: 12,
});

/**
 * Player-facing copy. Out of the numeric block so that block stays purely
 * numeric for whoever is turning knobs. Copy is hand-tuned too, just by a
 * different person on a different pass.
 */
export const SESSION_COPY = Object.freeze({
  /** GDD §3.2: "3 taps: sleep / soreness / motivation". */
  CHECK_IN_TITLE: 'HOW ARE YOU TODAY?',
  CHECK_IN_LIFT_QUESTION: 'TODAY',
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

  /**
   * ACCESSORY DAY'S CALL (GDD §3.2, ruled). THE FOURTH HEADLINE, AND IT HAD TO
   * EXIST.
   *
   * There were three, none of them accessory, and the NUMBERS on an accessory
   * close-out already honoured the ruling — no `bestE1rmKg` write and no e1RM
   * node on the screen. The WORDS did not. `closeOutFrom` picked the headline
   * from the client's PR prediction and nothing else, so on a primed readiness
   * an accessory day rendered a screen headed "NEW e1RM", subheaded "You beat
   * your best estimate on this lift", over a Training IQ row with no number in
   * it. §3.2 says accessory day does not get an e1RM close-out, and a screen
   * headed "NEW e1RM" is one whatever the digits do.
   *
   * SAYS WHAT WAS PAID, NOT WHAT WAS NOT. "No e1RM today" would make the beat
   * about the thing that did not happen; the payoff is Training IQ, §2's
   * currency for how WELL you train, so the call is about the work.
   *
   * NEITHER LINE HAS BEEN PLAYED. Every string in this block is a starting point
   * for the hand-tuning pass GDD §12.1 budgets, and this pair more than most: it
   * is the one close-out nobody has watched land, and whether "ACCESSORY BANKED"
   * reads as a payoff or as a consolation prize is exactly the question a
   * playtest answers and a builder cannot.
   */
  CLOSE_OUT_ACCESSORY_HEADLINE: 'ACCESSORY BANKED',
  CLOSE_OUT_ACCESSORY_SUBHEAD: 'This is the work that makes the lifts move later.',
  /** Same beat, reps short of the prescription. Never a scold (GDD §3.5). */
  CLOSE_OUT_ACCESSORY_SHORT_SUBHEAD: 'Short of the target. The work still counts.',

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

  /**
   * The first-run disclosures (GDD §4.2). See `OnboardingDisclosureId` above
   * for what they are and why they exist; this is the sentence table.
   *
   * Keyed by id and never re-derived. That is the same shape the store's
   * refusal copy uses — it is keyed to `renderedOffer`, an input, so that what
   * a test asserts is the sentence the screen actually rendered rather than a
   * sentence something else re-derived later.
   * `firstRunDisclosuresFor` carries the line out beside the id for the same
   * reason, and `onboardingDisclosure.test.ts` asserts the pairing.
   *
   * Each sentence is pinned against the behaviour it describes, not merely
   * against itself: `onboardingDisclosure.test.ts` drives `streak.ts` and
   * `streakEntitlement.ts` and goes red when the engine stops matching the
   * words. Editing a sentence without editing the engine is a lie the suite
   * has no way to catch, so the tests are written against the engine and the
   * sentence is checked to still describe it.
   *
   * No quantity appears in either line, and that is a choice rather than a
   * restriction worked around. The digits ban a few tests down would refuse a
   * numeral anyway (a number in this table is how a fatigue meter ships by
   * accident, GDD §3.4 and §12.3) — but the words "two a month" were dropped
   * as well, because neither fact needs the rate to be understood and a rate
   * printed here is a second place for the tuning to drift out of.
   *
   * Untuned, like every string in this block, and more than most: whether
   * either line reads as clear or as a wall of text on the screen a brand-new
   * player opens is a playtest question and nothing here answers it.
   */
  FIRST_RUN_TITLE: 'BEFORE YOUR FIRST SESSION',
  FIRST_RUN_DISCLOSURE: Object.freeze({
    'signup-grant-loss':
      'Your streak clock started the day you signed up, not today. Days off before your first session count like any other days off.',
    'entitlement-non-carryover':
      'Recovery Days cover a missed day for you. They refresh every month, and unused ones do not carry over — there is nothing to save up.',
  } as const satisfies Record<OnboardingDisclosureId, string>),
});

/**
 * SESSION_BOUNDARY — the knobs and the copy for HOW SURE a number on the
 * close-out is.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS A BLOCK FOR THIS AT ALL
 * ---------------------------------------------------------------------------
 * `progression.ts` hands a screen a discriminated `ProgressionReading`: a number
 * is `confirmed` (the server sent it), `projected` (the client's optimistic
 * guess while a proposal is in flight), `stale` (best known, possibly behind) or
 * `unknown` (nothing read yet). GDD §3.2's payoff beat is the one screen in the
 * daily loop that prints a progression number, so it is the one screen that has
 * to say which of those it is showing. A provisional number rendered identically
 * to a settled one is the screen lying about certainty.
 *
 * These are UNTUNED PLACEHOLDERS like everything else in this file. What a
 * "still saving" number should look like is a feel question and nobody has
 * played it.
 *
 * A SEPARATE EXPORT RATHER THAN KEYS ON `SESSION_TUNING`/`SESSION_COPY` because
 * this block was added while another builder held those two objects; keeping it
 * whole and at the end of the file is what made the two edits merge without
 * either being rewritten. If that reason has expired, folding it in is a
 * mechanical move.
 */
export const SESSION_BOUNDARY = Object.freeze({
  /**
   * How long the local stand-in server takes to answer `record-training-session`.
   *
   * NOT A REAL LATENCY AND NOT A DELAY IMPOSED ON THE PLAYER. `sessionServer.ts`
   * runs in the same process and answers instantly, which would make the
   * in-flight state a state that exists for zero frames — so the one branch the
   * close-out most needs to render honestly could never be seen, and a renderer
   * that handled it would be untestable decoration. This is the stand-in for a
   * network round trip, and the day there is a real Edge Function it is deleted
   * rather than tuned.
   *
   * NOTHING IS BLOCKED WHILE IT RUNS: the close-out is fully on screen, the DONE
   * button works, and GDD §12.2's session-length budget is untouched. What
   * changes during the window is only how the two numbers are drawn.
   */
  LOCAL_SERVER_LATENCY_MS: 550,

  /**
   * The day the local stand-in server pretends its one account was created on
   * (GDD §4.2's signup day; `streak.ts` §1b).
   *
   * NOT A FEEL VALUE AND NOT TUNABLE IN THE PLAYTESTING SENSE. It exists
   * because `newServerRecord` requires a real signup day and the local server
   * has no account table to read one from. It sits here rather than as a
   * literal at the call site so that the day the fixtures start on is one
   * number in one place.
   *
   * THE ONE CONSTRAINT IT HAS TO SATISFY, stated because the value itself is
   * arbitrary and the constraint is not: it must be **no later than any day a
   * fixture records a session on**, which today means no later than
   * `SESSION_PREVIEW.DAY`. An account cannot have been created after a session
   * was recorded on it, and both `adoptSignupDay` and `decodeStreak` refuse that
   * pair. Anything satisfying that works; 20000 is early 2024 and was picked for
   * no other reason.
   *
   * With a real backend this is deleted along with the local server.
   */
  LOCAL_SERVER_SIGNUP_DAY: 20000,

  /**
   * Opacity of a number that is still in flight, against 1 for a settled one.
   *
   * The whole distinction, as one number. Low enough to read as unfinished at
   * arm's length, high enough that the count-up is still legible — which is the
   * trade a playtester will actually be making here.
   */
  PROJECTED_OPACITY: 0.45,

  /** How long a number takes to come up to full once the server confirms it. */
  CONFIRM_SETTLE_MS: 260,

  /**
   * How long the caption under a settling number takes to fade out. Slower than
   * the number comes up, so the number arrives first and the tag leaves after —
   * the reverse reads as the label being yanked away.
   */
  TAG_FADE_MS: 320,
});

/**
 * Copy for the same three states. Out of the numeric block above for the reason
 * `SESSION_COPY` is out of `SESSION_TUNING`.
 *
 * NO NUMBER MAY APPEAR IN ANY OF THESE STRINGS, for the reason `sessionTuning
 * .test.ts` enforces it on `SESSION_COPY`: a percentage or a level in a caption
 * is how a fatigue meter ships by accident (GDD §3.4, §12.3).
 * `sessionClient.test.ts` runs the same scan over this object.
 */
export const SESSION_BOUNDARY_COPY = Object.freeze({
  /** Under a number the server has not answered for yet. */
  PROJECTED_TAG: 'SAVING',
  /** Under a number the app knows may be behind — a failed or refused sync. */
  STALE_TAG: 'NOT SYNCED',
  /** Stands in for a number that has no value at all. Never a zero. */
  UNKNOWN_VALUE: '—',

  /**
   * The accessory-day payoff (GDD §3.2, ruled). An accessory session moves no
   * e1RM because there is no fourth lift to have one, so its close-out shows
   * Training IQ instead — and shows NO e1RM row rather than repeating yesterday's
   * number, which would be a figure the lifter did not earn today.
   */
  ACCESSORY_LABEL: 'TRAINING IQ',
  ACCESSORY_NOTE: 'Accessory work. No lift estimate moves today.',
});

/**
 * DEBUG ONLY, and the same standing as `SESSION_PREVIEW` above: numbers the
 * `?session=` route builds a scripted boundary state from, so the close-out can
 * be photographed while a number is in flight and after a server has CORRECTED
 * one. Nothing in a played session reaches these.
 */
export const SESSION_BOUNDARY_PREVIEW = Object.freeze({
  /**
   * Kilos by which the scripted server's answer differs from what the client
   * projected, for the beat that proves the server wins on screen.
   *
   * NEGATIVE ON PURPOSE. A server coming back HIGHER is indistinguishable from a
   * generous rounding bug; one coming back lower can only be the screen having
   * believed the client.
   *
   * AND LARGER THAN ANY REAL DISAGREEMENT WOULD BE, deliberately. It is big
   * enough to take the answer back UNDER the previous best on record, so the beat
   * shows the PR call flipping — the gold going away — and not only the digits
   * changing. A shipped Edge Function running `nextBestE1rm` could not send this,
   * because that rule is monotone; a real disagreement would be a few hundred
   * grams of a stricter pacing guard. The beat is about what the CLIENT does with
   * an answer it did not predict, and the answer is deliberately unmistakable.
   */
  SERVER_DRIFT_KG: -12.5,
});
