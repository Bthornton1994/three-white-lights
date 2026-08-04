/**
 * MEET_TUNING — every game-feel number meet day uses.
 *
 * ---------------------------------------------------------------------------
 * NOTHING HERE HAS BEEN PLAYED. READ THIS BEFORE TRUSTING A VALUE.
 * ---------------------------------------------------------------------------
 * GDD §12.2 measures this piece against "real powerlifting broadcast footage —
 * a third-attempt walkout. Does our sequence produce comparable dread and
 * anticipation? Judge pacing and sound, not sprite count."
 *
 * PACING IS EXACTLY WHAT THE NUMBERS BELOW ARE, AND NOT ONE OF THEM HAS BEEN
 * CHECKED AGAINST THAT REFERENCE. Broadcast footage was unreachable from the
 * environment this file was written in — `openpowerlifting.org`,
 * `liftingcast.com`, `goodlift.info` and the image hosts all refuse the request
 * as a matter of egress policy, which is a policy refusal and not a transport
 * failure. So the walkout beat, the deliberation delay and the light-reveal
 * stagger below are PLACEHOLDERS chosen to be structurally sane, not values
 * measured off a real platform. CLAUDE.md: "build the tunable version and say so
 * rather than asserting the values are right."
 *
 * What they were chosen against, which is a much weaker property than "right":
 *
 *   1. The three beats GDD §6.2 names are separable on a stopwatch — the
 *      walkout, the deliberation and the lights are each long enough to read as
 *      their own moment rather than as one blur. `meetTuning.test.ts` measures
 *      that from these constants rather than asserting it here.
 *   2. A third attempt is held LONGER than an opener, because §7.2 puts the
 *      third-attempt walkout at the top of its cut-in list and §12.2 makes it
 *      the reference beat. That is a shape, not a duration.
 *   3. A close call takes measurably longer to resolve than a clear one, and
 *      the deliberation beat fires on a band WIDER than the band that actually
 *      produces a split panel — so the beat cannot be read as a tell for the
 *      verdict. See `DELIBERATION_MARGIN` for why that matters more than its
 *      value does.
 *
 * None of those is a claim about dread.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * CLAUDE.md, "Game Feel Values Must Be Tunable": "Keep every such value as a
 * named constant in one place. Never scatter them as magic numbers across
 * components."
 *
 * This is that place for meet day. `meetDay.ts`, `meetServer.ts`,
 * `meetPreview.ts` and every component under `src/meet/` read from here and may
 * not contain a bare timing, threshold, duration or layout number.
 * `meetTuning.test.ts` scans those sources for numeric literals and fails on
 * anything outside a small allowlist of structural constants, so the rule is
 * enforced rather than asked for.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY *NOT* HERE
 * ---------------------------------------------------------------------------
 * The same discipline `sessionTuning.ts` follows: a number owned by another
 * module is READ, never restated, because a restated number is two numbers that
 * can drift.
 *
 *   - THE RULES OF THE SPORT AND THE FEDERATION'S LOADING RULES. `meet.ts`
 *     owns `ATTEMPTS_PER_LIFT`, `JUDGE_COUNT`, `LIFT_ORDER`,
 *     `DEFAULT_MEET_RULES` and the declaration grid. Nothing here restates one,
 *     and `MEET_LOCAL.rules` is a reference to that module's constant rather
 *     than a copy of its fields.
 *
 *   - THE ATTEMPT JUMP TABLE. `meet.ts`'s `ATTEMPT_JUMP_FRACTION` (per lift,
 *     per strategy) and `OPENER_FRACTION_OF_1RM` are the meet ENGINE's tuning,
 *     already exposed as named exports in that module's own constants block,
 *     and `suggestNextAttempt` / `suggestOpener` are the only things that read
 *     them. Copying them here would give the app two jump tables, and the one
 *     the engine actually applies would be the other one.
 *
 *     WHAT IS HERE INSTEAD, and it is genuinely this piece's decision rather
 *     than the engine's: WHICH strategies GDD §6.3's two post-make choices and
 *     its post-miss increase map to — `SMALL_INCREASE_STRATEGY`,
 *     `BIG_INCREASE_STRATEGY`, `AFTER_MISS_INCREASE_STRATEGY`. That is the
 *     "attempt-increment default" this screen owns. The kilos come from the
 *     engine.
 *
 *   - THE REP. `LIFT_TUNING` owns descent rates, cue windows, forces and
 *     haptics. A meet attempt is the same mechanic (GDD §6.2: "Lift resolves
 *     through the Arcade bar-path mechanic") and this file does not restate one
 *     of its numbers.
 *
 *   - FATIGUE. `FATIGUE_TUNING` owns the hidden ledger and the window-width
 *     scaling GDD §6.2 step 3 asks for. Meet day passes a `SessionFeel` into
 *     the mechanic and reads no fatigue number in either direction.
 *
 *   - THE RESULT CARD. `resultCard.ts` owns what the sheet says and
 *     `src/card/cardTuning.ts` owns where it sits. The recap hands off to them.
 *
 *   - ANYTHING PUBLISHED. RPE percentages, Epley's divisor, DOTS coefficients
 *     and weight-class lists are domain data, not knobs.
 */

import { DEFAULT_MEET_RULES, type LiftKind, type MeetLoadingRules, type ProgressiveAttemptStrategy } from './meet';
import type { DotsSex } from './dots';
import type { GymVenue } from '../art/gymTuning';

// ---------------------------------------------------------------------------
// What a meet IS, as configuration
// ---------------------------------------------------------------------------

/**
 * One local meet, as the async path (GDD §6.6) needs it.
 *
 * NOT A CAREER CALENDAR. §6.1's "select a meet from the Career calendar
 * (local -> regional -> nationals -> worlds), gated by qualifying totals" is a
 * Career-mode feature and is explicitly out of this piece's scope; there is one
 * meet here and it is local. Whoever builds the calendar produces a list of
 * these and gates it.
 */
export interface MeetDefinition {
  /** Stable id. Becomes `MeetResultReport.meetId` on the progression wire. */
  readonly id: string;
  readonly federation: string;
  readonly name: string;
  /** ISO-8601 `YYYY-MM-DD`, the format `resultCard.ts` parses. */
  readonly dateIso: string;
  readonly town: string;
  readonly state: string;
  readonly country: string;
  /** Federation loading rules. A reference to `meet.ts`'s, never a copy. */
  readonly rules: MeetLoadingRules;
  /**
   * The field the player is placed against (GDD §6.6: "Attempts resolve
   * against ghost data — past player results or seeded NPCs").
   *
   * A FIXED LIST, NOT A ROLL. There is no randomness anywhere in this piece,
   * and a placing that moved between two runs of the same meet would be
   * unreproducible for a screenshot and unfair to the player. These are totals
   * in kg; the placing is one plus however many of them beat the lifter.
   *
   * PLACEHOLDER DATA. With a backend these are real ghosts — other players'
   * past results — and this list does not exist.
   */
  readonly ghostTotalsKg: readonly number[];
}

/**
 * The lifter's own entry details.
 *
 * Sex is here and is not optional, for the reason `resultCard.ts` spells out:
 * DOTS takes it as an input and a card that publishes a DOTS score while
 * withholding one of its inputs cannot be checked by the people GDD §6.5 needs
 * to believe it.
 *
 * PLACEHOLDER DATA. With onboarding and a backend these arrive from the
 * lifter's profile.
 */
export interface MeetEntry {
  readonly name: string;
  readonly sex: DotsSex;
  readonly bodyweightKg: number;
  readonly division: string;
  readonly equipment: string;
}

export const MEET_TUNING = Object.freeze({
  // -------------------------------------------------------------------------
  // Where the meet happens
  // -------------------------------------------------------------------------

  /**
   * THE ROOM. `gymTuning.ts` ships two venues and this is the one meet day is
   * lifted in.
   *
   * It is here rather than typed into `AttemptView.tsx` because "which building
   * is the emotional centrepiece set in" is an art-direction decision, and
   * because it was previously nowhere at all: `LiftStage` named
   * `'training-gym'` itself, so every competition attempt in the game was drawn
   * in the training gym while `GYM_PROPS_MEET`, the crowd band and the sponsor
   * banner — all built and all tested — went unused.
   *
   * What changes with it (see `GYM_VENUE` and `GYM_VENUE_PROPS`): the block wall
   * becomes 30 rows of seated crowd under a sponsor banner, the dumbbells,
   * kettlebells and chalk stand are replaced by a judges' table, a plate tree
   * and an equipment case, and the room goes darker.
   */
  VENUE: 'meet-platform' as GymVenue,

  // -------------------------------------------------------------------------
  // Pre-meet (GDD §6.1)
  // -------------------------------------------------------------------------

  /**
   * How long the weigh-in card is held before the openers screen is reachable.
   * A beat, not a gate: the screen's button is live the moment it ends.
   */
  WEIGH_IN_REVEAL_MS: 520,

  /**
   * How close to the class limit counts as "cutting it fine", in kg.
   *
   * GDD §6.1: "water-cut flavor text if cutting close. Flavor only — no dieting
   * mechanic." So this threshold decides which SENTENCE is printed and nothing
   * else. It moves no number, gates no attempt and changes no timing window,
   * and `meetDay.test.ts` pins that.
   */
  WATER_CUT_MARGIN_KG: 0.6,

  /**
   * How long each opener row takes to arrive on the openers screen, and the
   * gap between rows. The three openers assemble rather than appear.
   */
  OPENER_ROW_FADE_MS: 240,
  OPENER_ROW_STAGGER_MS: 180,

  // -------------------------------------------------------------------------
  // Attempt selection (GDD §6.3) — where the tension lives
  // -------------------------------------------------------------------------

  /**
   * Which jump the two post-make choices are.
   *
   * GDD §6.3: "After a make: a small increase (lock in a bigger total, low miss
   * risk) vs. a big one (a PR on the line, higher miss risk)." These name rows
   * of `meet.ts`'s `ATTEMPT_JUMP_FRACTION`; the kilos are that table's, per
   * lift, and are not restated here.
   *
   * `'standard'` is deliberately unused by the UI. It exists in the engine and
   * a third button would blunt the choice §6.3 is built around, which is a
   * choice between two things.
   */
  SMALL_INCREASE_STRATEGY: 'conservative' as ProgressiveAttemptStrategy,
  BIG_INCREASE_STRATEGY: 'aggressive' as ProgressiveAttemptStrategy,

  /**
   * The jump offered on the aggressive branch AFTER A MISS.
   *
   * GDD §6.3: "Increasing after a miss is the aggressive one: it concedes the
   * missed weight is not coming back and reaches past it, which either rescues
   * the lift outright or spends the last attempt for nothing."
   *
   * `'conservative'` rather than `'aggressive'`, and the reasoning is the
   * ratchet rather than politeness: the floor is already the weight that just
   * beat the lifter, so the smallest legal jump is ALREADY a bigger ask than
   * the attempt they just missed. Stacking the aggressive fraction on top of a
   * raised floor makes the option a formality nobody takes, which would delete
   * one of the two choices §6.3 names. Expect this to move in tuning.
   */
  AFTER_MISS_INCREASE_STRATEGY: 'conservative' as ProgressiveAttemptStrategy,

  /** How the attempt-choice screen assembles: per-card fade and the stagger. */
  ATTEMPT_CARD_FADE_MS: 260,
  ATTEMPT_CARD_STAGGER_MS: 200,

  // -------------------------------------------------------------------------
  // The attempt loop (GDD §6.2) — the beats a stopwatch sees
  //
  // MEASURED AT THESE VALUES only in the sense that `meetTuning.test.ts` adds
  // them up. Not measured against footage; see the header.
  // -------------------------------------------------------------------------

  /**
   * GDD §6.2 step 1, first half: "Bar loads". How long the plates take to land.
   * The bar is loaded a pair at a time, heaviest first, over this window.
   */
  BAR_LOAD_MS: 900,

  /** Gap between one pair of plates landing and the next. */
  BAR_LOAD_PLATE_STAGGER_MS: 90,

  /**
   * GDD §6.2 step 1, second half: "brief walk-out beat". The lifter is under
   * the bar and has not started yet. This is the dread beat and it is the
   * single most important number in this file.
   *
   * "Brief" is the GDD's word, so this is short. It is ALSO the beat §12.2
   * judges, so a playtest pass that finds it too short should lengthen it here
   * and nowhere else.
   */
  WALKOUT_MS: 1500,

  /**
   * Added to the walkout on a THIRD attempt.
   *
   * GDD §7.2 lists "third-attempt walkout at a meet" first among the moments a
   * cut-in fires on, and §12.2's bar is a third-attempt walkout specifically.
   * The third attempt is the one the meet is about, so it is held longer.
   */
  THIRD_ATTEMPT_WALKOUT_EXTRA_MS: 900,

  /**
   * Added again when the bar is above everything the lifter has ever done in
   * competition on that lift — a PR attempt (GDD §7.2's second cut-in moment).
   * Stacks with the third-attempt extra, because a third-attempt PR is the beat.
   */
  PR_ATTEMPT_WALKOUT_EXTRA_MS: 700,

  /**
   * Added when this is the last attempt of a lift with NOTHING banked on it —
   * the attempt that decides whether the lifter bombs (GDD §6.3).
   *
   * Longest hold in the file by construction: it stacks on the third-attempt
   * extra, and `meetTuning.test.ts` checks the ordering rather than the values.
   */
  BOMB_RISK_WALKOUT_EXTRA_MS: 800,

  /** How long the bar weight is held on screen before the walkout copy fades in. */
  WALKOUT_WEIGHT_HOLD_MS: 420,

  // -------------------------------------------------------------------------
  // Judging (GDD §6.2 step 4)
  // -------------------------------------------------------------------------

  /**
   * Dead air between the bar being racked and anything appearing. The lifter
   * has finished; nobody has said anything yet.
   */
  VERDICT_SILENCE_MS: 500,

  /**
   * GDD §6.2 step 4: "with a brief 'judges deliberating' beat on close calls".
   * How long the panel is held with no lights showing when the call is close.
   */
  DELIBERATION_MS: 1900,

  /**
   * The same beat when the call is NOT close. Short rather than zero: a beat
   * that only exists on close calls IS the verdict, announced early. The whole
   * point of the deliberation beat is that the player cannot read it.
   */
  CLEAR_CALL_DELIBERATION_MS: 380,

  /** Delay before the first light comes up, once deliberation ends. */
  LIGHT_REVEAL_FIRST_DELAY_MS: 240,

  /**
   * Gap between one referee's light and the next. Head referee first, then left,
   * then right — so a 2-1 split can be revealed as a 1-1 tie for one beat.
   */
  LIGHT_REVEAL_STAGGER_MS: 320,

  /** How long a light takes to come up once it starts. */
  LIGHT_FADE_MS: 120,

  /**
   * GDD §6.2 step 5: "Depth cue or bar-speed replay clip as feedback". Delay
   * after the last light before the feedback line appears, and how long the
   * whole verdict is held before the meet moves on.
   */
  FEEDBACK_REVEAL_DELAY_MS: 420,
  FEEDBACK_FADE_MS: 300,
  VERDICT_HOLD_MS: 1600,

  // -------------------------------------------------------------------------
  // How close is close — the judging model's four thresholds
  //
  // These decide when the panel splits and when it deliberates. They are the
  // knobs that make a close call feel like one; the model they feed is in
  // `meetDay.ts` and is documented there.
  // -------------------------------------------------------------------------

  /**
   * At or above this call margin the panel is ALWAYS unanimous. Nothing to
   * argue about.
   */
  UNANIMOUS_MARGIN: 0.55,

  /**
   * At or below this call margin the panel ALWAYS splits 2-1. Between the two
   * the odds interpolate, resolved from the attempt's own seed — never a clock
   * and never `Math.random`.
   */
  SPLIT_MARGIN: 0.18,

  /**
   * Below this the judges deliberate.
   *
   * MUST SIT ABOVE `UNANIMOUS_MARGIN`, and that is the point of it being a
   * separate number rather than reusing one: it makes the deliberation band
   * strictly wider than the band that can actually split, so a deliberation
   * that ends 3-0 is common and the beat carries no information about the
   * verdict. `meetTuning.test.ts` fails if this ordering is broken, because
   * breaking it turns the tensest beat in the game into a spoiler.
   */
  DELIBERATION_MARGIN: 0.72,

  /**
   * How far from the IDEAL depth moment a high squat has to land before every
   * referee agrees it was high, in ms.
   *
   * This is what makes a MISS able to be a close call. The mechanic records a
   * signed offset for the depth cue even when the input landed outside the
   * window (`gradeTiming` grades it 'missed' with quality 0 but keeps
   * `offsetMs`), so "how badly did they miss depth" is a real measurement
   * rather than a guess. A lifter a few ms outside the window gets a
   * deliberation and can get a 2-1; a lifter who never went near depth gets
   * three reds immediately.
   *
   * MUST EXCEED HALF THE DEPTH WINDOW, or no miss can ever be a close call: a
   * miss is by definition outside the window, so its offset is already at least
   * the half-width, and a threshold at or below that would score every miss at
   * margin 1. `meetTuning.test.ts` checks this against `LIFT_TUNING`'s own
   * window rather than trusting the note. Measured from the ideal moment rather
   * than from the window edge because the edge moves with fatigue
   * (`adjustedTimingWindowMs`) and the ideal moment does not — a threshold
   * anchored to a moving edge would make the judges harsher on a tired lifter,
   * which is a punishment nobody designed.
   */
  HIGH_SQUAT_UNANIMOUS_OFFSET_MS: 420,

  /**
   * How much a grind erodes the call margin, as a fraction, at a fully-stalled
   * ascent.
   *
   * Real referees red-light grinders for downward movement, and the mechanic
   * already measures the grind (`stallTicks / ascentTicks`). A lift that went
   * up fast is never questioned; one that stopped twice on the way is.
   */
  GRIND_DOUBT_WEIGHT: 0.45,

  // -------------------------------------------------------------------------
  // Bombing out (GDD §6.3)
  //
  // "Give it a distinct, somber moment — narratively honest, not a generic
  // game-over screen, and not punitive."
  //
  // The beats are longer and emptier than anywhere else in the piece. That is
  // the whole design: silence is what makes it somber, and there is nothing to
  // tap through for the length of `BOMB_OUT_SILENCE_MS`.
  // -------------------------------------------------------------------------

  /** How long the screen sits with nothing on it but the lift that ended it. */
  BOMB_OUT_SILENCE_MS: 1500,

  /** Then the lines arrive, one at a time, slower than the recap's. */
  BOMB_OUT_ROW_FADE_MS: 620,
  BOMB_OUT_ROW_STAGGER_MS: 700,

  /**
   * The order the bomb-out's lines arrive in. `KEPT` — the list of what a
   * bomb-out did NOT cost — arrives before the way out, because GDD §12.3 and
   * CLAUDE.md both forbid a setback that punishes a player for showing up, and
   * the screen has to say so before it asks them to leave.
   */
  BOMB_OUT_ROW_ORDER: Object.freeze({ CALL: 0, WHAT_HAPPENED: 1, KEPT: 2, ACTION: 3 }),

  // -------------------------------------------------------------------------
  // Post-meet recap (GDD §6.5)
  // -------------------------------------------------------------------------

  RECAP_ROW_FADE_MS: 280,
  RECAP_ROW_STAGGER_MS: 240,

  /** How long the Total counts up from the lifter's previous best. */
  RECAP_TOTAL_COUNT_MS: 1100,

  /**
   * The order the recap's blocks arrive in. The TOTAL lands first because it is
   * the number the whole mode exists to move (GDD §2, §3.2: it moves on meet
   * day and on no other day).
   */
  RECAP_ROW_ORDER: Object.freeze({ TOTAL: 0, LIFTS: 1, DOTS: 2, PLACE: 3, CARD: 4 }),

  // -------------------------------------------------------------------------
  // Determinism
  // -------------------------------------------------------------------------

  /**
   * Base for the per-attempt seed the judging model's dissent draw runs off.
   *
   * NOT A FEEL VALUE and not randomness: the seed is derived from
   * (meet seed, lift index, attempt number), so a meet replays byte-identically
   * and a screenshot of a split panel is reproducible. It lives here because it
   * is a bare number and this file is the only place one is allowed.
   */
  JUDGE_SEED_BASE: 104729,
  JUDGE_SEED_LIFT_STRIDE: 811,
  JUDGE_SEED_ATTEMPT_STRIDE: 37,

  /** Base for the per-attempt seed the bar's wobble jitter runs off. */
  ATTEMPT_SEED_BASE: 31337,
  ATTEMPT_SEED_LIFT_STRIDE: 503,
  ATTEMPT_SEED_ATTEMPT_STRIDE: 17,

  // -------------------------------------------------------------------------
  // Precision
  // -------------------------------------------------------------------------

  /**
   * NOT A FEEL VALUE. Decimal places used to scrub IEEE-754 noise out of
   * returned numbers. Here only because the brief is that this module has
   * exactly one constants block.
   */
  PRECISION_DECIMALS: 6,
});

// NOTE ON HOW A WEIGHT IS PRINTED, since there is deliberately no constant for
// it here: every meet screen formats a weight with `resultCard.ts`'s
// `formatWeight`, which is transcribed from real meet software (at most two
// decimals, trailing zeros hidden, no `Intl`). One formatter means the walkout,
// the attempt board and the shareable card cannot print the same bar three
// ways, and it means the in-app number matches the sheet a lifter shares.

/**
 * The one meet the prototype runs (GDD §6.6's async local meet).
 *
 * The federation is invented on purpose: GDD §11 leaves "invented feds, or is
 * there licensing value in real ones (USAPL, USPA, NPL)?" open, and
 * `resultCard.ts` ships no real federation's name or marks for the same reason.
 */
export const MEET_LOCAL: MeetDefinition = Object.freeze({
  id: 'local-open-2026',
  federation: 'Northern Barbell Federation',
  name: 'Northern Open',
  dateIso: '2026-08-15',
  town: 'Sheffield',
  state: '',
  country: 'England',
  rules: DEFAULT_MEET_RULES,
  ghostTotalsKg: Object.freeze([
    632.5, 610, 597.5, 585, 572.5, 555, 540, 522.5, 505, 487.5, 470, 452.5, 430, 405, 380,
  ]),
});

/**
 * The lifter's entry. PLACEHOLDER DATA, not progression — with onboarding and a
 * backend, every field arrives from the profile and none of it lives here.
 */
export const MEET_ENTRY: MeetEntry = Object.freeze({
  name: 'A. LIFTER',
  sex: 'male',
  bodyweightKg: 92.4,
  division: 'Open',
  equipment: 'Raw',
});

/**
 * MEET_LAYOUT — screen geometry for the meet screens, in logical points at
 * phone scale.
 *
 * Here rather than in a StyleSheet for the reason `SESSION_LAYOUT` gives: these
 * are values somebody will move by hand while looking at a phone, and
 * `meetTuning.test.ts` fails if a bare one appears under `src/meet/`.
 * Authored against a 390 x 844 viewport (iPhone 14).
 *
 * The lift stage keeps its own geometry (`LIFT_TUNING.LAYOUT`) and the result
 * card keeps its own (`src/card/cardTuning.ts`); this file restates neither.
 */
export const MEET_LAYOUT = Object.freeze({
  SCREEN_PAD: 20,
  ROW_GAP: 10,
  SECTION_GAP: 24,

  EYEBROW_FONT: 11,
  TITLE_FONT: 13,
  HEADLINE_FONT: 22,
  SUBHEAD_FONT: 13,
  BODY_FONT: 13,
  HINT_FONT: 12,
  LABEL_FONT: 11,
  BIG_NUMBER_FONT: 52,
  MID_NUMBER_FONT: 30,
  UNIT_FONT: 15,
  LETTER_SPACING: 2,
  WIDE_LETTER_SPACING: 4,

  /** The three judging lights. Big enough to read across a room. */
  LIGHT_SIZE: 62,
  LIGHT_GAP: 16,
  LIGHT_BORDER: 3,
  LIGHT_RADIUS: 31,

  /** Attempt-choice cards. Two across on the post-make screen. */
  CARD_HEIGHT: 116,
  CARD_RADIUS: 12,
  CARD_GAP: 10,
  CARD_BORDER: 2,
  CARD_PAD: 14,

  /** The opener rows: lift name, a weight, and a pair of steppers. */
  OPENER_ROW_HEIGHT: 64,
  STEPPER_SIZE: 44,
  STEPPER_RADIUS: 8,

  /** The attempt board down the side of the recap. */
  BOARD_CELL_W: 62,
  BOARD_CELL_H: 34,
  BOARD_GAP: 4,
  BOARD_LABEL_W: 74,

  BUTTON_HEIGHT: 50,
  BUTTON_RADIUS: 10,
  BUTTON_FONT: 13,

  DIVIDER_HEIGHT: 1,

  /** The bar graphic on the walkout beat. */
  BAR_W: 300,
  BAR_H: 8,
  PLATE_W: 13,
  PLATE_GAP: 2,
  PLATE_MAX_H: 84,
  PLATE_MIN_H: 30,
});

/**
 * Player-facing copy. Out of the numeric block so that block stays purely
 * numeric for whoever is turning knobs. Copy is hand-tuned too, just by a
 * different person on a different pass.
 */
export const MEET_COPY = Object.freeze({
  LIFT_LABEL: Object.freeze({
    squat: 'SQUAT',
    bench: 'BENCH',
    deadlift: 'DEADLIFT',
  } as const satisfies Record<LiftKind, string>),

  // --- Pre-meet (GDD §6.1) -------------------------------------------------
  WEIGH_IN_EYEBROW: 'WEIGH-IN',
  WEIGH_IN_CLASS_LABEL: 'CLASS',
  WEIGH_IN_BODYWEIGHT_LABEL: 'BODYWEIGHT',
  /** Flavour only. GDD §6.1: "Flavor only — no dieting mechanic." */
  WEIGH_IN_CUTTING_CLOSE: 'Cutting it fine. You made it with grams to spare.',
  WEIGH_IN_COMFORTABLE: 'Made weight comfortably. Eat something.',
  WEIGH_IN_ACTION: 'DECLARE OPENERS',

  OPENERS_EYEBROW: 'OPENING ATTEMPTS',
  OPENERS_HINT: 'Pre-filled from your training. Change anything you like.',
  OPENERS_SUGGESTED: 'suggested',
  OPENERS_CHANGED: 'your call',
  OPENERS_ACTION: 'TAKE THE PLATFORM',

  // --- The attempt loop (GDD §6.2) ----------------------------------------
  ATTEMPT_LABEL: 'ATTEMPT',
  ATTEMPT_OF: 'OF',
  BAR_LOADING: 'LOADING THE BAR',
  WALKOUT_PROMPT: 'WALK IT OUT',
  WALKOUT_THIRD: 'LAST ONE',
  WALKOUT_BOMB_RISK: 'NOTHING BANKED. THIS IS THE LIFT.',
  WALKOUT_PR: 'NOBODY HAS SEEN YOU DO THIS',

  // --- Judging (GDD §6.2 step 4) ------------------------------------------
  DELIBERATING: 'JUDGES DELIBERATING',
  GOOD_LIFT: 'GOOD LIFT',
  NO_LIFT: 'NO LIFT',
  LIGHTS_UNANIMOUS: 'Three whites.',
  LIGHTS_SPLIT_GOOD: 'Two to one. It counts.',
  LIGHTS_SPLIT_BAD: 'Two to one against.',
  LIGHTS_ALL_RED: 'Three reds.',

  /** GDD §6.2 step 5's feedback cue. One line, no meter, no number. */
  FEEDBACK_DEPTH_CLEAR: 'Depth was never in question.',
  FEEDBACK_DEPTH_MARGINAL: 'You hit depth by a hair.',
  FEEDBACK_DEPTH_HIGH: 'High. The hips never got under.',
  FEEDBACK_GRIND: 'It stopped, and you kept driving.',
  FEEDBACK_FAST: 'That moved like a warm-up.',
  FEEDBACK_STALLED: 'The bar won that one.',
  FEEDBACK_BURIED: 'Too deep to recover.',
  FEEDBACK_TIMEOUT: 'Never got the command.',

  // --- Attempt selection (GDD §6.3) ---------------------------------------
  SELECT_EYEBROW: 'NEXT ATTEMPT',
  SELECT_BANKED: 'BANKED',
  SELECT_NOTHING_BANKED: 'NOTHING BANKED',
  SELECT_FLOOR_LABEL: 'LIGHTEST YOU CAN TAKE',
  /**
   * THE BITE, in one sentence. GDD §6.3: "a miss does not lower the floor — it
   * *raises* it. A lifter who misses their opener cannot retreat to something
   * safe; the lightest thing they can still take is the weight that just beat
   * them."
   */
  SELECT_FLOOR_RAISED: 'A miss does not lower the bar. The lightest thing left is the weight that just beat you.',
  SELECT_FLOOR_OPENER: 'Nothing on the board yet.',
  SELECT_FLOOR_AFTER_MAKE: 'Banked. From here the bar only goes up.',

  /** What a card prints instead of a "+2.5" when the bar does not move. */
  OPTION_SAME_WEIGHT: 'same weight',
  OPTION_REPEAT: 'TAKE IT AGAIN',
  OPTION_REPEAT_WHY: 'Same weight, second chance. Nothing gained beyond what was already on the bar.',
  OPTION_SMALL: 'SMALL JUMP',
  OPTION_SMALL_WHY: 'Lock in a bigger total. Low risk.',
  OPTION_BIG: 'BIG JUMP',
  OPTION_BIG_WHY: 'A PR on the line. Higher risk.',
  OPTION_PUSH_PAST: 'GO PAST IT',
  OPTION_PUSH_PAST_WHY: 'Concede the miss and reach past it. Rescues the lift or spends the last attempt for nothing.',
  OPTION_BOMB_WARNING: 'Miss this and the meet is over with nothing on this lift.',

  // --- Bombing out (GDD §6.3) ---------------------------------------------
  BOMB_OUT_CALL: 'NO TOTAL',
  BOMB_OUT_WHAT_HAPPENED: 'Three attempts on the {lift}. None of them stood.',
  BOMB_OUT_HONEST: 'It happens to everyone who lifts long enough. It is the risk the sport is built on.',
  /**
   * WHAT A BOMB-OUT DOES NOT COST, on screen, in as many words.
   *
   * GDD §12.3 and CLAUDE.md make "an injury or setback that punishes a player
   * for showing up daily" a refusal condition. A bomb-out takes nothing: the
   * lifter's e1RM, their streak, their best total on record and their balances
   * are all exactly where they were. `meetServer.test.ts` proves each clause of
   * this sentence against the server rather than trusting the copy.
   */
  BOMB_OUT_KEPT: 'Your training stands. Your e1RM, your streak and your best total are untouched.',
  BOMB_OUT_ACTION: 'BACK TO TRAINING',

  // --- Post-meet (GDD §6.5) ------------------------------------------------
  RECAP_EYEBROW: 'MEET COMPLETE',
  RECAP_TOTAL_LABEL: 'TOTAL',
  RECAP_DOTS_LABEL: 'DOTS',
  RECAP_PLACE_LABEL: 'PLACE',
  RECAP_OF_FIELD: 'of',
  RECAP_PR_TOTAL: 'COMPETITION PR',
  RECAP_PR_LIFT: 'PR',
  RECAP_FIRST_TOTAL: 'FIRST TOTAL',
  RECAP_NO_PR: 'Short of your best. The board keeps it either way.',
  RECAP_ATTEMPTS_LABEL: 'ATTEMPTS',
  RECAP_ACTION: 'SEE YOUR CARD',
  RECAP_CARD_BACK: 'BACK TO THE RECAP',
});

/**
 * DEBUG ONLY. Placeholder facts the `?meet=` preview route builds a screen
 * from, so the renderer can be photographed at beats a wall clock and a
 * headless browser cannot reliably hit — the same problem, and the same idiom,
 * as `SESSION_PREVIEW` and `src/lift/liftReplay.ts`.
 *
 * NOT PROGRESSION. Nothing here is persisted, nothing derives from it in a
 * played meet, and the preview route is never reached by a player.
 */
export const MEET_PREVIEW = Object.freeze({
  /** Day index the preview pins, so every number below it is stable. */
  DAY: 20320,
  /** e1RM per lift the openers are suggested from. */
  E1RM_KG: Object.freeze({ squat: 232.5, bench: 152.5, deadlift: 272.5 } as const satisfies Record<LiftKind, number>),
  /** The lifter's best competition total before this meet, kg, or null. */
  PREVIOUS_BEST_TOTAL_KG: 605,
  /** How long ago that meet was, in days. Only orders the stored history. */
  PREVIOUS_MEET_DAYS_AGO: 90,
  /**
   * Their best competition lift on record, per lift, kg.
   *
   * CHOSEN SO THE PREVIEW EXERCISES BOTH BRANCHES. A meet played perfectly on
   * `E1RM_KG` totals 612.5 with 217.5 / 140 / 255, so against these the squat
   * and the deadlift are competition PRs and the bench is not — which is the
   * screen worth photographing, rather than one where every row says PR or none
   * does. These also SUM to `PREVIOUS_BEST_TOTAL_KG`, so the stored prior meet
   * is internally consistent; `meetServer.test.ts` checks that rather than
   * trusting this note.
   */
  PREVIOUS_BEST_BY_LIFT_KG: Object.freeze({
    squat: 215,
    bench: 145,
    deadlift: 245,
  } as const satisfies Record<LiftKind, number>),
});
