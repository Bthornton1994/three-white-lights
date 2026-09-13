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
 *   - THE REP. `LIFT_TUNING` owns descent rates, cue windows, forces and the
 *     haptics OF THE REP ITSELF. A meet attempt is the same mechanic (GDD §6.2:
 *     "Lift resolves through the Arcade bar-path mechanic") and this file does
 *     not restate one of its numbers.
 *
 *     `MEET_TUNING.HAPTICS` below is not an exception to that. It holds the
 *     beats AROUND the rep — the bar loading, the walk-out call, the judges'
 *     lights, the verdict, the bomb-out — which `LIFT_TUNING` has no events
 *     for and no business owning. It is built with `liftTuning.ts`'s own
 *     `hapticPattern` constructor, so the two vocabularies are the same frozen
 *     shape and `playHaptic` has exactly one kind of thing to play. What is
 *     imported is the constructor and the `HapticStyle` alphabet; no duration,
 *     no style choice and no pattern crosses over.
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

import {
  DEFAULT_MEET_RULES,
  type LiftKind,
  type MeetLoadingRules,
  type MeetWeightUnit,
  type ProgressiveAttemptStrategy,
} from './meet';
import type { BodyweightReading, DotsSex, KilogramBodyweight } from './dots';
import type { GymVenue } from '../art/gymTuning';
import { hapticPattern } from './liftTuning';
import type { SoundCue } from '../audio/synth';

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
  /**
   * Qualifying Total for the next rung, kg, or null when this meet does not
   * gate anything (a local open). Fixture data — never invented mid-attempt.
   */
  readonly qualifyingTotalKg: number | null;
  /**
   * Pre-meet standing record, or null when this meet does not carry one.
   *
   * NOT the eventual Total of anyone currently competing. A1.1: a record
   * threshold that can move because a fixture NPC will later total more is
   * not a standing record. Local may author one holder who is not on this
   * flight; career tiers may later supply their own.
   */
  readonly standingRecord: StandingMeetRecord | null;
}

/**
 * A record that exists before anyone on this flight has lifted.
 */
export interface StandingMeetRecord {
  readonly totalKg: number;
  readonly holderName: string;
}

/**
 * One named competitor on the flight. Day-max is the load their attempts are
 * planned from; published kg still comes out of `meet.ts`.
 */
export interface FieldLifterSpec {
  readonly id: string;
  readonly name: string;
  readonly bodyweightKg: number;
  /**
   * Competition-order identity for this flight. Lower goes first at equal
   * declared weight. Unique across the player and every fixture NPC.
   */
  readonly lot: number;
  readonly dayMaxKg: Readonly<Record<LiftKind, number>>;
}

/**
 * Five named lifters on the local platform. Day-maxes sit around a first-meet
 * lifter (starting e1RM 180/120/220) so a third deadlift can move a place.
 * Names are fictional.
 */
export const MEET_FIELD_FIXTURE: readonly FieldLifterSpec[] = Object.freeze([
  Object.freeze({
    id: 'ashford',
    name: 'M. ASHFORD',
    bodyweightKg: 93.1,
    lot: 1,
    dayMaxKg: Object.freeze({ squat: 200, bench: 130, deadlift: 240 }),
  }),
  Object.freeze({
    id: 'quill',
    name: 'S. QUILL',
    bodyweightKg: 89.6,
    lot: 2,
    dayMaxKg: Object.freeze({ squat: 190, bench: 125, deadlift: 230 }),
  }),
  Object.freeze({
    id: 'harrow',
    name: 'J. HARROW',
    bodyweightKg: 92.0,
    lot: 4,
    dayMaxKg: Object.freeze({ squat: 180, bench: 120, deadlift: 220 }),
  }),
  Object.freeze({
    id: 'pembroke',
    name: 'R. PEMBROKE',
    bodyweightKg: 87.4,
    lot: 5,
    dayMaxKg: Object.freeze({ squat: 170, bench: 110, deadlift: 205 }),
  }),
  Object.freeze({
    id: 'linn',
    name: 'T. LINN',
    bodyweightKg: 94.8,
    lot: 6,
    dayMaxKg: Object.freeze({ squat: 155, bench: 100, deadlift: 185 }),
  }),
]);

/**
 * The lifter's own entry details.
 *
 * Sex is here and is not optional, for the reason `resultCard.ts` spells out:
 * DOTS takes it as an input and a card that publishes a DOTS score while
 * withholding one of its inputs cannot be checked by the people GDD §6.5 needs
 * to believe it.
 *
 * DETERMINISTIC FIXTURE for tests and the `?meet=` debug preview. A normal
 * Career Meet does not read this as player authority — `kilogramMeetEntryFrom`
 * in `lifterEntry.ts` is that seam. Lot stays meet-local and is passed in
 * from this fixture until an event system owns assignment.
 */
export interface MeetEntry {
  readonly name: string;
  readonly sex: DotsSex;
  /**
   * WITH THE UNIT IT WAS WEIGHED IN, not a bare number named `Kg`.
   *
   * This is the SOURCE of the number that ends up in permanent progression:
   * `meetDay.ts`'s `meetResultProposal` forwards it onto `MeetResultReport` and
   * `meetServer.ts` writes it into `MeetResultWire`. If the unit were invented
   * at any hop along that chain instead of declared here, the check at the far
   * end would be checking a literal somebody typed rather than a fact — which
   * is what "a bare `number` whose name this module cannot verify" meant.
   *
   * `'lb'` IS REPRESENTABLE ON THIS TYPE, deliberately: a lifter who weighed in
   * on a pound scale is a real thing and GDD §11 has not ruled on whether the
   * game supports one. What the game supports today is `KilogramMeetEntry`
   * below, and that is a narrowing rather than a denial.
   */
  readonly bodyweight: BodyweightReading;
  readonly division: string;
  readonly equipment: string;
  /**
   * The player's lot on this flight. Same ordering key as every NPC lot.
   * Not inferred, not "player wins ties."
   */
  readonly lot: number;
}

/**
 * A `MeetEntry` the meet-day loop can actually run.
 *
 * `MeetDayContext.entry` is this, not `MeetEntry`, so a pound-weighed lifter
 * does not COMPILE into a meet rather than being caught by a check somewhere
 * downstream. Every consumer past that point (`weighInFor`, the result card's
 * weight class, `MeetScreen`) reads `entry.bodyweight.kilograms` with no narrow
 * and no fallback, because the narrow already happened in the type.
 *
 * IT DOES NOT RULE ON GDD §11. The code already refused to record a pound meet;
 * this makes the same refusal earlier and typed. Whichever way §11's pound-meet
 * question is answered, this alias is the one line that has to widen, and the
 * conversion boundary option (b) asks for has an obvious place to live.
 */
export interface KilogramMeetEntry extends MeetEntry {
  readonly bodyweight: KilogramBodyweight;
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
   * becomes rows of seated crowd under a sponsor banner, the dumbbells,
   * kettlebells and chalk stand are replaced by a judges' table, a plate tree
   * and an equipment case, and the room goes darker.
   *
   * IT IS READ BY EVERY STAGED BEAT NOW, not just the rep. `src/meet/meetHall.ts`
   * builds `MEET_HALL_SCENE` from it and `MeetHallView` draws that behind the
   * walk-out, the deliberation, the verdict and the attempt choice, in the same
   * box and at the same integer scale `AttemptView` hands `LiftStage`. Until
   * this pass it was read at exactly one site in the tree, so the player saw the
   * crowd during precisely the beat they were pressing the screen.
   */
  VENUE: 'meet-platform' as GymVenue,

  /**
   * How fixture NPCs plan attempts. Cheaper than the player's mechanic; the
   * published kg still comes out of `meet.ts`. Fractions of day-max, rounded
   * onto the declaration grid. A third-attempt miss is a seeded chance so a
   * flight is not a wall of identical makes.
   */
  FIELD: Object.freeze({
    OPENER_FRAC: 0.9,
    SECOND_FRAC: 0.96,
    MISS_THIRD_CHANCE: 0.28,
    MISS_SEED_STRIDE: 17,
  }),

  /**
   * HOW FAR THE HALL IS HELD BACK, per beat — 0 is the room at full strength, 1
   * is the room gone.
   *
   * ---------------------------------------------------------------------------
   * THESE ARE COMPOSITION KNOBS AND NOBODY HAS LOOKED AT THEM ON A PHONE
   * ---------------------------------------------------------------------------
   * Each beat draws its own copy over the room, and a room at full strength
   * under a paragraph of body text is a room competing with the thing the player
   * has to read. The ordering below is the design claim; the values are a
   * starting point in exactly the sense the header of this file describes.
   *
   * The ordering, which is what to preserve if these are turned:
   *
   *   WALKOUT   lightest. The hall IS the beat. There are three short lines over
   *             it and nothing to read carefully.
   *   BOOKEND   paperwork and endings over the emptied hall (`lifter={null}`).
   *             The still has to read — CHOICE would hide it. Untuned.
   *   JUDGING   middle. The three lamps have to be the brightest thing on the
   *             screen, and the room is what they are hanging in.
   *   CHOICE    heaviest. GDD §6.3's screen is a decision with two cards and a
   *             paragraph on each; the hall is there to say the lifter has not
   *             left the building, not to be read.
   *
   * `meetTuning.test.ts` pins the ordering rather than the numbers.
   */
  HALL: Object.freeze({
    WALKOUT_SCRIM: 0.12,
    BOOKEND_SCRIM: 0.4,
    JUDGING_SCRIM: 0.46,
    CHOICE_SCRIM: 0.8,
  }),

  /**
   * WHEN THE HALL COMES UP, AND HOW FAR.
   *
   * ---------------------------------------------------------------------------
   * WHY THIS EXISTS AT ALL
   * ---------------------------------------------------------------------------
   * The crowd band was twenty-four rows of identical stamped silhouettes that
   * never moved — not on a third attempt, not on three white lights. Measured:
   * an opener's walk-out and a third attempt's with nothing banked were
   * BYTE-IDENTICAL below the copy. Every channel by which a third attempt
   * escalated lived in `CROWD_SWELL_BIG` and `WALKOUT_CALL_URGENT` — sound and
   * haptics, the two channels nobody in this environment can check — while the
   * channel that CAN be checked carried a text colour and a different sentence.
   *
   * This is the channel that reaches the picture. `crowdRisePx` on
   * `GymSceneSpec` is how far through the STANDING WAVE the hall is: the front
   * tier of seating comes up by that many scene rows, each tier behind it lags
   * by `GYM_CROWD.ROW_RISE_LAG_PX`, and none may pass `GYM_CROWD.ROW_RISE_MAX_PX`.
   * Heads lift, shoulders stretch, the base of the band stays where it is, and
   * each spectator carries a dark keyline so the tier in front reads as standing
   * IN FRONT OF the tier behind rather than merging with it.
   *
   * ---------------------------------------------------------------------------
   * IT USED TO BE A UNIFORM RISE, AND THAT IS THE BUG THIS BLOCK RECORDS
   * ---------------------------------------------------------------------------
   * Every spectator inflating by the same amount does not read as a hall
   * standing up; past one row it reads as the band dissolving. A spectator is 5
   * rows tall on a 6-row pitch, so at a uniform rise of 2 the tiers land on each
   * other and the staggered rows fill every column between them. Measured on the
   * rendered band under the old mechanism: at rise 4, four rows in six were a
   * full-width slab; at 5, five in six, 84% of the band lit, and the figure and
   * the ground had swapped — a lit field with dark squares punched through it.
   *
   * The wave and the keyline are what fixed it (see `GYM_CROWD`). What that buys,
   * measured the same way, is a bigger change to the picture for LESS lit area:
   *
   *                       differing scene px vs a seated hall   lit share of band
   *   uniform, rise 4                         959                     79.9%
   *   uniform, rise 5                       1,088                     84.4%
   *   wave + keyline, rise 5                1,113                     46.1%
   *   wave + keyline, rise 7                1,484                     47.3%
   *
   * A seated hall is 46.3%, so the band now stays as quiet as the one
   * `gymTuning.ts` says it is held to be, while the escalation got louder.
   *
   * ---------------------------------------------------------------------------
   * IT IS SCARCE ON PURPOSE (GDD §7.2)
   * ---------------------------------------------------------------------------
   * The hall does NOT come up on an ordinary walk-out and does NOT come up on a
   * no-lift. It comes up on exactly two moments: an attempt the meet turns on (a
   * third, a PR, or one with a bomb on it) and a good lift. A room where every
   * silhouette twitches all the time is worse than a still one, and the whole
   * value of this channel is that it is off most of the time.
   *
   * NOBODY HAS WATCHED THIS ON A PHONE. Same status as everything else in this
   * file (GDD §12.1): the rows and the ramps below are structurally sane
   * starting points, not measured values.
   */
  CROWD: Object.freeze({
    /**
     * How far through the standing wave an urgent walk-out takes the hall.
     *
     * NOT A UNIFORM RISE, and the unit needs saying: it is scene rows of the
     * FRONT tier's travel, and the tiers behind lag by `ROW_RISE_LAG_PX` each,
     * so a value past `ROW_RISE_MAX_PX` does not make the front tier taller — it
     * pushes the wave further back through the hall. On the shipped band
     * (`GYM_CROWD`, 24 rows, pitch 6, 4 tiers, lag 2, cap 4) the per-tier rises
     * front-to-back and what the picture does, against a seated hall:
     *
     *   rise 0    0/0/0/0        —                 46.3% of the band lit
     *   rise 4    4/2/0/0      853 px changed      46.1%
     *   rise 5    4/3/1/0    1,113 changed  <- here 46.1%
     *   rise 6    4/4/2/0    1,373 changed        46.1%
     *   rise 7    4/4/3/0    1,484 changed        47.3%
     *   rise 8    4/4/4/0    1,633 changed, and saturating   48.6%
     *
     * The back tier's heads sit on the top row of the band, so it is clamped and
     * never moves: 8 is the ceiling and further rise buys nothing at all.
     *
     * `walkout.test.ts` holds a floor under the change and a floor under the air
     * BETWEEN SPECTATORS — measured inside the rows figures actually occupy, not
     * across the band's whole rectangle — so both failure modes are bounded
     * rather than described.
     *
     * NOBODY HAS LOOKED AT IT ON A PHONE. The measurement says the picture
     * changes and that the band keeps its air; it does not say this reads as a
     * hall getting to its feet.
     */
    WALKOUT_RISE_PX: 5,
    /** How long after the last disc lands the hall starts getting up. */
    WALKOUT_RISE_DELAY_MS: 180,
    /** And how long it takes to finish. A hall rises in a wave, not on a switch. */
    WALKOUT_RISE_MS: 900,

    /**
     * How far through the wave a GOOD LIFT takes it, after the last lamp. Deeper
     * into the hall than the walk-out's: the front rows are already up and the
     * rows behind them are coming.
     */
    CHEER_RISE_PX: 7,

    /**
     * ...and where a lift THE MEET TURNED ON takes it — a third attempt, a PR,
     * or one with a bomb on it, made.
     *
     * THE ONE WAY THE VERDICT ESCALATES, and deliberately not a duration. See
     * `DELIBERATION_STAKES_EXTRA_MS`: a reaction may get louder, it may not get
     * longer, because the player already knows the answer and a longer hold on
     * a screen whose news has broken is dead air by construction.
     *
     * 8 is the ceiling on the shipped band (4/4/4/0 — the back tier is clamped
     * against the top of the seating), so the biggest make in the meet is the
     * one that empties the hall out of its seats and nothing can go past it.
     * Measured: 149 more scene pixels than `CHEER_RISE_PX`, 558 against a
     * seated hall.
     */
    URGENT_CHEER_RISE_PX: 8,

    /** Faster, too — a reaction rather than an anticipation. */
    CHEER_RISE_MS: 380,
  }),

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
   * BAR_LOAD_RATTLE_MERGE_MS — two arrivals closer together than this are one
   * clatter, and are heard once. It is what BOUNDS how deep the rattle stacks.
   *
   * ---------------------------------------------------------------------------
   * WHY THERE IS A CONSTANT HERE AT ALL: NOTHING DELIVERS THE SCHEDULE
   * ---------------------------------------------------------------------------
   * The bar used to load on one `setTimeout` per disc at
   * `BAR_LOAD_PLATE_STAGGER_MS`. The loop was correct and the delivery was not:
   * the main thread is busy through the meet transition, every expired timer
   * drains at once when it frees, and `tools/verify-meet-sound.mjs` measured the
   * result in Chromium — five 180 ms rattles inside 149 ms, two of them
   * byte-identical, for a load that asked for one every 90. The trace is pinned
   * in `meetSound.test.ts`; it is not retyped here.
   *
   * Moving the load onto the animation clock (`platesLandedAt` in `walkout.ts`)
   * fixes the TIMER half: a late look skips to where the bar should be instead
   * of replaying every tick it missed. It does not fix the whole thing, and the
   * measurement of the half-fix is why this number is what it is —
   * `requestAnimationFrame` timestamps CATCH UP after jank, so a run measured in
   * Chromium crossed three 90 ms disc boundaries inside 83 ms of WALL time and
   * fired a hit for each. That trace is pinned in `meetSound.test.ts` too. Level-triggering cannot see that: the
   * boundaries really were crossed, and the discs really did land. The clock is
   * simply not the ear's clock.
   *
   * ---------------------------------------------------------------------------
   * SO IT IS DERIVED FROM THE POOL, NOT CHOSEN
   * ---------------------------------------------------------------------------
   * Hits at least this far apart cannot stack more than `duration / this` deep,
   * so `MEET_SOUND.VOICES_PER_CUE * this >= BAR_RATTLE.durationMs` is exactly
   * the condition that no rattle is ever cut off by another rattle, for ANY
   * delivery whatsoever — janked, coalesced, or caught up. 3 x 60 >= 180.
   * `meetSound.test.ts` holds that relation and measures the bound on
   * adversarial deliveries rather than on a model of a well-behaved one.
   *
   *    @guarantee no-rattle-is-cut-by-another-rattle
   *
   * The other side is the floor: it must stay under
   * `BAR_LOAD_PLATE_STAGGER_MS` minus a display frame, or an on-schedule disc
   * whose frame lands early is silently swallowed. 60 < 90 - 16.7. That is the
   * whole legal range — 60 to 73 at this tuning — and it exists only because the
   * rattle is exactly twice the stagger. Shorten the cue and the range widens.
   *
   * NOT APPLIED TO THE SCHEDULE, deliberately. An earlier attempt pulled every
   * disc boundary this much earlier instead, which shortened the FIRST interval
   * from 90 ms to 66 and made the ordinary unblocked load stack deeper.
   *
   * Nobody has heard it (GDD §12.1): a delivery constant, not a mix decision.
   * What a listener would be judging is whether a merged arrival reads as one
   * plate or as a missing one.
   */
  BAR_LOAD_RATTLE_MERGE_MS: 60,

  /**
   * GDD §6.2 step 1, second half: "brief walk-out beat". The lifter is under
   * the bar and has not started yet. This is the dread beat and it is the
   * single most important number in this file.
   *
   * "Brief" is the GDD's word, so this is short. It is ALSO the beat §12.2
   * judges, so a playtest pass that finds it too short should lengthen it here
   * and nowhere else.
   *
   * THAT INSTRUCTION USED TO BE UNSATISFIABLE, AND `WALKOUT_TAIL` IS WHY IT IS
   * NOT ANY MORE. `WALKOUT_MOTION` below adds up to 1,220 ms of choreography
   * and `BAR_LOAD_MS` is 900, so at 1500 this number bought 280 ms of beat past
   * the last thing that moved — and every millisecond of
   * `THIRD_ATTEMPT_WALKOUT_EXTRA_MS`, `PR_ATTEMPT_WALKOUT_EXTRA_MS` and
   * `BOMB_RISK_WALKOUT_EXTRA_MS`, up to 2,400 of them, landed there too. Turning
   * any of the four lengthened a held frame over a decayed sound cue. What the
   * tail carries now is below.
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

  /**
   * WALKOUT_MOTION — the walk-out itself, as a timing sheet.
   *
   * ---------------------------------------------------------------------------
   * WHAT WAS WRONG, IN NUMBERS
   * ---------------------------------------------------------------------------
   * GDD §6.2 step 1 is "bar loads, brief walk-out beat", and the beat contained
   * no walk-out: `MeetHallView` drew ONE memoised still of
   * `buildSquatRep(loadRatio).frames[0]` and held it for the whole beat. The
   * lifter never unracked, never stepped back, never settled. The only thing in
   * the picture that changed was a clip window widening for about 450 ms.
   *
   * These numbers are that missing motion. `src/meet/walkout.ts` samples them
   * into a small sheet of held drawings, exactly the way `squatAnimation.ts`
   * coalesces the rep — so the walk-out is a finite set of poses on a timing
   * sheet, not a per-frame deformation, which is what a 16-bit game shipped
   * (GDD §7.1).
   *
   * ---------------------------------------------------------------------------
   * THE ORDER IS LOAD -> UNRACK -> STEP -> SETTLE -> SET, AND THE ORDER MATTERS
   * ---------------------------------------------------------------------------
   * The discs land BEFORE he takes the bar off the hooks. That is the fix for a
   * real complaint about the previous pass — the plates were landing on a bar
   * that was already on his back. It is a partial fix and the header of
   * `src/meet/walkout.ts` says exactly how far it goes.
   *
   * ---------------------------------------------------------------------------
   * A FRONT VIEW CAN ONLY SHOW SOME OF A WALK-OUT, AND THESE ARE THAT PART
   * ---------------------------------------------------------------------------
   * The sprite is drawn head-on (`rig.ts`), so stepping BACKWARD is the one
   * component of a walk-out the camera cannot see, and nothing here fakes it
   * with a scale change — a fractional upscale would break §7.1's
   * nearest-neighbour rule for one frame of motion. What the camera can see is
   * the weight transfer: the body plants left, then right, then centre; the bar
   * rocks the other way and tilts; the whip damps out. That is what these are.
   *
   * ---------------------------------------------------------------------------
   * THE ONE NUMBER A HUMAN TUNING PASS SHOULD HOLD AGAINST REAL FOOTAGE
   * ---------------------------------------------------------------------------
   * Written down here so it is not lost, and it is a LEAD RATHER THAN A VERDICT.
   * A critic reading secondary sources — descriptions of competition walk-outs,
   * not footage — found a real one put at three named steps taken over SEVERAL
   * SECONDS, inside the one-minute clock a lifter gets from the bar being loaded.
   * The sheet below is `UNRACK_MS 260 + STEP_COUNT 3 x STEP_MS 220 + SETTLE_MS
   * 300 = 1,220 ms` from the hooks to set: roughly an order of magnitude faster.
   *
   * That is NOT recorded as a defect. A game beat is not a stopwatch transcript,
   * GDD §6.2 calls this beat "brief", and dread is not duration — a walk-out
   * played at real time inside a 60-90 s session would be most of the session.
   * It is recorded because §12.2 judges this beat against broadcast footage and
   * nobody in this environment can watch any, so the first person who CAN should
   * hold these four numbers against a real clip. This block is where they turn.
   *
   * NOBODY HAS WATCHED IT. GDD §12.1. These are a starting shape, not tuned
   * values, and the pacing half of §12.2's bar remains unverifiable here.
   */
  WALKOUT_MOTION: Object.freeze({
    /**
     * NOT A FEEL VALUE. How finely the choreography is sampled before it is
     * quantised and coalesced into held frames. Halving it does not change how
     * the walk-out looks, only how exactly a stage boundary lands on a frame
     * edge — the same relationship `VELOCITY_GRID` has to the rep.
     */
    TICK_MS: 20,

    /**
     * How far under the bar he is sitting while it is loaded, in AUTHORED DEPTH
     * STEPS (`QUANTISE.DEPTH_STEPS`), not in a raw depth. Steps rather than a
     * fraction because the sheet is finite: a dip of half a step is the same
     * drawing as no dip at all.
     */
    RACK_DIP_STEPS: 2,

    /** The drive that takes the bar off the hooks. */
    UNRACK_MS: 260,
    /** How much harder the bar bends on that drive, as a multiple of its rest bend. */
    UNRACK_WHIP: 0.85,
    /** Strain rungs added while he is driving it out. Clamped to the sheet. */
    UNRACK_STRAIN_BUMP: 1,

    /** Steps back, and how long each takes. */
    STEP_COUNT: 3,
    STEP_MS: 220,
    /**
     * Share of a step spent transferring weight. The rest is the plant — the
     * held frame. A walk-out that eased continuously would be a modern tween;
     * a plant that holds is what an animator drew.
     */
    STEP_TRANSFER_FRAC: 0.45,

    /** Whole SPRITE pixels the body shifts on the first step. */
    STEP_BODY_DX_PX: 2,
    /** ...and how far the bar swings the other way, in sprite pixels. */
    STEP_BAR_LATERAL_PX: 2,
    /** ...and how far it tilts, in degrees. */
    STEP_BAR_TILT_DEG: 2,
    /** Each step is smaller than the last by this factor. He is settling. */
    STEP_DECAY: 0.55,

    /** The last of the shake dying out, after the final step. */
    SETTLE_MS: 300,
  }),

  /**
   * WALKOUT_TAIL — what happens AFTER he is set, which is where the escalation
   * actually lands.
   *
   * ---------------------------------------------------------------------------
   * THE DEFECT THIS BLOCK EXISTS TO CLOSE, IN NUMBERS
   * ---------------------------------------------------------------------------
   * `WALKOUT_MOTION` runs LOAD -> SET and then stopped: `useHallStep` cancelled
   * its frame loop at `motionMs` and the sheet held its last drawing. Measured on
   * a third-attempt squat with nothing banked (207.5 kg, six discs a side):
   *
   *   0-900       plates land every 90 ms, one rattle and one haptic each
   *   420         the urgent line fades in; CROWD_SWELL_BIG (2,100 ms) starts
   *   660         the line is fully opaque — the last Reanimated change on screen
   *   1,080-1,980 the hall rises, then SATURATES at CROWD.WALKOUT_RISE_PX
   *   2,120       motionMs. The frame loop is cancelled.
   *   2,520       CROWD_SWELL_BIG has decayed to nothing
   *   2,120-4,100 NOTHING CHANGES IN ANY CHANNEL — 48% of the beat, ~1,580 ms
   *               of it silent as well as still
   *
   * A third attempt at a PR with a bomb on it was 2,680 ms of that, 56%. So all
   * three escalation extras bought held frames, and a playtester told to lengthen
   * `WALKOUT_MS` could only make the held frame longer. THAT is what made the
   * escalation un-tunable rather than merely untuned.
   *
   * ---------------------------------------------------------------------------
   * THE TAIL IS TWO NAMED WINDOWS NOW, NOT A LEFTOVER
   * ---------------------------------------------------------------------------
   *   BRACE   he is set and the bar is working. A loaded bar under a braced
   *           lifter is never perfectly still: it rocks, it whips, and his chest
   *           and hips move under it. One oscillation per `BRACE_CYCLE_MS`, and
   *           a longer beat buys MORE OSCILLATIONS AT THE SAME TEMPO rather
   *           than a slower one — see `walkout.ts`.
   *   HUSH    the last stretch before the lift. Nothing moves, the hall stops
   *           rising and the crowd bed is gone. THE STILLNESS IS THE POINT, and
   *           it is a designed window with a length rather than whatever was
   *           left over.
   *
   * ---------------------------------------------------------------------------
   * WHY THE BRACE'S AMPLITUDE READS NOTHING ABOUT THE LIFTER (GDD §3.4, §12.3)
   * ---------------------------------------------------------------------------
   * §12.3 refuses a visible fatigue meter, and a brace cue that varied with
   * readiness would be one with the numerals filed off — a player would learn to
   * read "how tight he looks" as a readiness bar. So the oscillation's AMPLITUDE
   * is a constant: it does not read fatigue, readiness, load, weight or seed.
   * `walkout.test.ts` measures that rather than promising it — the DRAWN deltas
   * are asserted identical across load ratios and across urgency.
   *
   * THE TEMPO IS NOT A CONSTANT, and this paragraph used to say it was. The
   * brace period derives from the beat, and the beat derives from the attempt
   * number, so `walkout.ts` tabulates 410ms on a third against 620ms on a first
   * above a PR. See that file's header for the full correction; the short
   * version is that tempo tracks the attempt's STAKES, which are printed on the
   * screen the player just left, and not the LIFTER. The rule the amplitude has
   * to meet is §12.3's, and it meets it.
   *
   * NOBODY HAS WATCHED ANY OF IT (GDD §12.1). These are a structurally sane
   * starting shape, exactly like every other number in this file.
   */
  WALKOUT_TAIL: Object.freeze({
    /**
     * Nominal length of one oscillation of the loaded bar under a braced lifter.
     *
     * The ACTUAL period is the brace window divided by the whole number of
     * cycles nearest this, so the oscillation starts and ends at rest whatever
     * the beat is worth (which is what keeps the cut into the rep seamless).
     * A third attempt gets two of them, a third at a PR with a bomb on it gets
     * six, and the tempo barely moves — the escalation is felt as MORE of the
     * same waiting, not as a man who has started moving differently.
     */
    BRACE_CYCLE_MS: 420,

    /**
     * The shortest brace window worth oscillating in.
     *
     * Below this the whole tail is HUSH and the beat holds its last drawing,
     * which is exactly what an opener does today: at the shipped tuning an
     * opener's tail is 280 ms, 12% of its beat, and 280 ms of stillness before
     * a lift is a settle rather than dead air. This is the line between the
     * two, and it is the reason the escalation extras are what buy the live
     * channel — which is the property the defect above was about.
     *
     * IT ALSO GOVERNS THE WAIT FOR THE LIGHTS, WHICH NOTHING HAD MEASURED.
     * `buildHold` runs the same tail plan on `deliberationMs`, and a CLEAR call
     * on an opener or a second attempt is `VERDICT_SILENCE_MS +
     * CLEAR_CALL_DELIBERATION_MS` = 880 ms, offering 520 ms after the hush —
     * under this floor. So two of the sixteen deliberation shapes are ONE HELD
     * DRAWING IN SILENCE for 880 ms, 2.4x the 360 ms budget the walk-out's own
     * tail is held to. Swept and pinned in `walkout.test.ts`'s
     * `HOLD_STILLNESS`, which fails with the new numbers if a tuning pass moves
     * any of the three constants involved.
     *
     * NOT TUNED AWAY HERE, deliberately: closing it means deciding either that
     * 520 ms is long enough to brace in or that a non-close call deserves a
     * longer beat, and both are feel judgements nobody in this environment has
     * watched (GDD §12.1). This paragraph is where a tuner turns the first of
     * them, and `CLEAR_CALL_DELIBERATION_MS` is where they turn the second.
     */
    MIN_BRACE_WINDOW_MS: 600,

    /** How long he is simply still before the bar moves. */
    HUSH_MS: 360,

    /**
     * Peak extra whip in the bar across one cycle, in SPRITE pixels.
     *
     * `QUANTISE.BEND_QUANTUM_PX` is 0.5, so this is one drawn step either way:
     * measured, one bend quantum moves 77 of the composite's 22,490 scene
     * pixels.
     */
    BRACE_BEND_PX: 0.5,

    /**
     * ...and how far it rocks, in degrees. One `TILT_QUANTUM_DEG`; measured at
     * 134 scene pixels.
     */
    BRACE_TILT_DEG: 1,

    /**
     * ...and how many authored PITCH rungs the body takes at the top of a
     * cycle — the chest-and-hip half of a brace (`PITCH.LEVEL_DELTAS`).
     *
     * THE RIG HAS NO BREATH CHANNEL AND THIS IS THE NEAREST ONE, said plainly
     * rather than dressed up. `pitchLevel` models the bar riding forward and
     * the lifter fighting it back — hips up, chest down, head craned — which is
     * what the camera can see of a man taking air under a maximal bar from the
     * front. A dedicated breath channel belongs to `src/art/lifterSprite.ts`,
     * not to this screen. Measured at 127 scene pixels for one rung.
     */
    BRACE_PITCH_STEPS: 1,

    /**
     * How far through the standing wave the hall has travelled by the END of
     * the brace window, on an urgent attempt.
     *
     * `CROWD.WALKOUT_RISE_PX` is where the wave is when he is set; this is
     * where it has reached when he stops moving. On the shipped band 8 is the
     * ceiling (4/4/4/0 — the back tier's heads sit on the top row and are
     * clamped), so this is the wave running out of hall, which is the right
     * shape for a room that has finished getting up. Measured: 298 / 409 / 558
     * scene pixels against the seated-at-5 picture for rows 6 / 7 / 8.
     *
     * The rise is spread over the WHOLE brace window, so a longer beat is a
     * slower hall rather than a hall that gets up sooner and then waits.
     */
    HUSH_CROWD_RISE_PX: 8,
  }),

  // -------------------------------------------------------------------------
  // Judging (GDD §6.2 step 4)
  // -------------------------------------------------------------------------

  /**
   * How long the lifter is left standing under the bar with nothing said.
   *
   * THE SENTENCE HERE USED TO READ "dead air between the bar being racked and
   * anything appearing", AND THE PIXELS SAY OTHERWISE. `VerdictView` draws
   * `MeetHallView` with `hallLifterFrame` — the brace pose, the bar loaded, on
   * his back — for the whole deliberation and the whole verdict, and
   * `.gauntlet/shots/meet/deliberation.png` and `verdict-split.png` both
   * photograph exactly that. Nothing racks anything.
   *
   * The drawing is the honest thing to correct the sentence against rather than
   * the other way round: `renderLifterFrame` has ONE pose family, a figure with
   * a bar across his shoulders, and there is no racked-bar sprite to switch to.
   * Making one is `src/art/lifterSprite.ts`'s job (`walkout.ts`'s header records
   * the same limitation for the loading crew), and inventing a second barbell on
   * this screen is the GDD §7.1 violation an earlier pass removed.
   *
   * "Dead air" is also no longer true of the beat: see
   * `DELIBERATION_STAKES_EXTRA_MS` below and `walkout.ts`'s `buildHold`.
   *
   * The claim this sentence now makes — that the wait for the lights is drawn
   * with the loaded bar still on his back — is checked in
   * `src/meet/meetStage.test.ts` rather than asserted here.
   *
   * @guarantee bar-stays-on-his-back-for-the-call
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

  /**
   * WHAT THE WAIT FOR THE LIGHTS IS WORTH, on top of the two numbers above.
   *
   * ---------------------------------------------------------------------------
   * THE ASYMMETRY THIS CLOSES
   * ---------------------------------------------------------------------------
   * `walkoutMs` escalated three ways — third attempt, PR, bomb risk — and
   * `deliberationMs` and `verdictMs` took no attempt number and no flags at all,
   * so the beat this game is NAMED after was byte-identical in pacing between
   * the first squat of the day and the deadlift that decides the meet. Nothing
   * in the tree defended that; it was an omission.
   *
   * ---------------------------------------------------------------------------
   * ONLY THE WAIT ESCALATES IN DURATION. THE NEWS ESCALATES IN INTENSITY.
   * ---------------------------------------------------------------------------
   * THIS IS THE RULE, and it is the same lesson `WALKOUT_TAIL` records one
   * screen over. A beat may be lengthened only if it has something to spend the
   * length on:
   *
   *   - The walk-out and the deliberation are ANTICIPATION. The player is
   *     waiting for something they know is coming, waiting IS the content, and
   *     both now have a live channel to wait in (`buildHold` in `walkout.ts`).
   *     These escalate in duration.
   *   - `VERDICT_HOLD_MS` is NEWS — it runs after GOOD LIFT / NO LIFT is on
   *     screen and the player already knows. Every millisecond added there is a
   *     frame they are waiting to leave, which is precisely the defect
   *     `WALKOUT_TAIL` exists to remove, reintroduced one screen later. So
   *     `verdictMs()` takes no stakes and MUST NOT: a third attempt is not held
   *     on screen longer than an opener.
   *   - What a reaction may escalate is INTENSITY, and it does:
   *     `CROWD.URGENT_CHEER_RISE_PX` takes the hall further up on a lift the
   *     meet turned on than on an ordinary one.
   *
   * A future pass that wants a longer third-attempt verdict should give that
   * screen a channel first and then add the knob, not the other way round.
   *
   * ---------------------------------------------------------------------------
   * IT CANNOT LEAK THE CALL, AND THAT IS WHY IT IS SAFE
   * ---------------------------------------------------------------------------
   * `VerdictView`'s standing rule is that the deliberation must not tell the
   * player which way it went, which is why `DELIBERATION_MARGIN` is set wider
   * than the band that can actually split. These three extras key on WHICH
   * ATTEMPT THIS IS — a fact printed on the screen the player just came from —
   * and on nothing the judges decided. They also make the close-call signal
   * harder to read rather than easier, by putting a second, louder term into
   * the same duration.
   */
  DELIBERATION_STAKES_EXTRA_MS: Object.freeze({
    /** A third attempt. §12.2's reference beat, one screen later. */
    THIRD_ATTEMPT: 600,
    /** Above the lifter's best competition lift. Stacks. */
    PR_ATTEMPT: 400,
    /** Nothing banked: these lights decide whether the lift bombs. Stacks. */
    BOMB_RISK: 500,
  }),

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
  RECAP_ROW_ORDER: Object.freeze({ TOTAL: 0, LIFTS: 1, DOTS: 2, PLACE: 3, WHY: 4, CARD: 5 }),

  // -------------------------------------------------------------------------
  // Haptics — what meet day FEELS like
  //
  // NONE OF THESE HAVE BEEN FELT. Same status as `LIFT_TUNING.HAPTICS`, whose
  // constructor they are built with: a starting vocabulary, not tuned values.
  // GDD §12.1 is explicit that no critic can judge haptic timing it cannot
  // feel, and web — where every screenshot in this repo is taken — has no
  // haptic engine at all, so nothing here has been verified by anything.
  //
  // WHY THE MEET NEEDS ITS OWN. `useLiftLoop` fires `LIFT_TUNING.HAPTICS`
  // during the rep, so an ordinary training set already vibrates. Before this
  // block the three beats around a competition attempt — the bar loading, the
  // judges' lights, the verdict — fired nothing, which meant the loudest
  // moments in the game were the only silent ones on the phone.
  //
  // THE SHAPE, which is a design claim even though the values are not:
  //
  //   1. The bar LOADS. One thud per plate, staggered by the same constant the
  //      plates are drawn with, so the sleeve filling up is felt and not just
  //      watched. This is the only repeated pattern here.
  //   2. The walkout CALL is a single beat, and a heavier one when the attempt
  //      is a third, a PR or a bomb risk.
  //   3. DELIBERATION is one soft tick and then nothing. The silence is the
  //      beat; a pulse during it would be a metronome telling the lifter to
  //      wait rather than a panel making up its mind.
  //   4. THE LIGHTS CLACK, one per referee, on `lightRevealDelayMs(seat)`. A
  //      white and a red are DIFFERENT patterns — a lifter watching a 2-1 come
  //      up should be able to feel the third one land the wrong way. This is
  //      the game's title moment and it had no physical event at all.
  //   5. The VERDICT lands after the last lamp: success or error.
  //   6. THE BOMB-OUT IS NOT AN ERROR BUZZ. GDD §6.3: "not a generic game-over
  //      screen, and not punitive." An `error` notification is the pattern this
  //      app uses for a missed rep, and using it here would file the worst
  //      moment in the sport under the same feeling as a mistimed press. It is
  //      one low, soft beat after the silence, and nothing else.
  // -------------------------------------------------------------------------

  HAPTICS: Object.freeze({
    /** One plate landing on the sleeve. Fired once per plate, per side. */
    BAR_PLATE: hapticPattern({ style: 'rigid', delayMs: 0 }),
    /** The walk-out line arriving on an ordinary attempt. */
    WALKOUT_CALL: hapticPattern({ style: 'soft', delayMs: 0 }),
    /** ...and on a third attempt, a PR attempt, or one with a bomb on it. */
    WALKOUT_CALL_URGENT: hapticPattern(
      { style: 'heavy', delayMs: 0 },
      { style: 'medium', delayMs: 90 },
    ),
    /** The panel goes dark and the judges take their beat. Then silence. */
    DELIBERATION: hapticPattern({ style: 'soft', delayMs: 0 }),
    /** One referee's lamp coming up white. */
    LIGHT_WHITE: hapticPattern({ style: 'rigid', delayMs: 0 }),
    /** One referee's lamp coming up red. Duller, and it lands twice. */
    LIGHT_RED: hapticPattern({ style: 'heavy', delayMs: 0 }, { style: 'soft', delayMs: 70 }),
    /** GOOD LIFT. */
    VERDICT_GOOD: hapticPattern({ style: 'success', delayMs: 0 }),
    /** NO LIFT. A warning, not an error — the error is reserved for the rep. */
    VERDICT_NO_LIFT: hapticPattern({ style: 'warning', delayMs: 0 }),
    /** The bomb-out's first line, after the silence. See the note above. */
    BOMB_OUT: hapticPattern({ style: 'soft', delayMs: 0 }),
    /**
     * The floor arriving on the attempt-select screen when a miss RAISED it
     * (GDD §6.3's bite). When the floor is merely the weight just made, this
     * screen is silent — the difference is the whole point of the beat.
     */
    FLOOR_RAISED: hapticPattern({ style: 'warning', delayMs: 0 }),
    /**
     * An attempt being declared. Attempts within a lift never decrease, so this
     * is a one-way latch and should feel like one.
     */
    ATTEMPT_DECLARED: hapticPattern({ style: 'rigid', delayMs: 0 }, { style: 'light', delayMs: 80 }),
  }),

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

// ---------------------------------------------------------------------------
// What meet day SOUNDS like
// ---------------------------------------------------------------------------

/**
 * MEET_SOUND — the cue recipes, and the loudest untested thing in this file.
 *
 * ===========================================================================
 * READ THIS BEFORE TRUSTING A NUMBER BELOW
 * ===========================================================================
 * GDD §12.2 grades this piece against "real powerlifting broadcast footage — a
 * third-attempt walkout… judge pacing AND SOUND". Until these existed the sound
 * half of that bar was a NULL ARTIFACT rather than an untuned one: there was no
 * audio of any kind in the project.
 *
 * It is no longer null. It is untuned, and untuned by a wider margin than the
 * timings above, because:
 *
 *   1. NOBODY HAS HEARD THEM. Not a person, not a critic, not a capture. The
 *      screenshot harness photographs pixels; there is no equivalent for
 *      sound in this environment.
 *   2. THEY WERE NOT MEASURED AGAINST THE REFERENCE. Broadcast footage was
 *      unreachable from here as a matter of egress policy — the same refusal
 *      recorded at the top of this file for the timings. So "a plate landing
 *      sounds like this" is a synthesis guess, not a transcription.
 *
 * What CAN be said, and `meetSound.test.ts` says it in numbers rather than
 * adjectives: each cue is audible, each is the length it claims, the crowd
 * swells and decays rather than switching on, the clack is short enough to be
 * a click and not a beep, a white light and a red light are different sounds,
 * and every shipped `.wav` is byte-identical to a fresh render of the recipe.
 *
 * ===========================================================================
 * THE FOUR FAMILIES, AND WHAT EACH IS DOING
 * ===========================================================================
 *   BAR_RATTLE   Steel on steel, damped. Band-limited noise with a very fast
 *                attack and a short curved release, plus a low body tone so it
 *                lands rather than hisses. Fires once per plate as the sleeve
 *                loads, on the same stagger the plates are drawn on.
 *   CROWD_SWELL  Low-passed noise with a slow attack and a slower release —
 *                a room full of people, not a hiss. Under the walk-out call.
 *                The big variant is longer and louder and is what a third
 *                attempt, a PR or a bomb-risk attempt gets.
 *   LIGHT_CLACK  A relay. Two layers: a short high tick and a click body,
 *                both under 120 ms. White and red are DIFFERENT PITCHES —
 *                a lifter should be able to hear a 2-1 assemble.
 *   CROWD_CHEER  The reaction to a good lift. A brighter, faster swell.
 *   BOMB_TONE    GDD §6.3's somber moment. A single low sine that fades in and
 *                dies. NOT a sting and not a buzzer: the hall goes quiet on a
 *                bomb-out, and the silence after this is the beat.
 *
 * ===========================================================================
 * WHAT IS DELIBERATELY SILENT, AND WHY THAT IS A DESIGN AND NOT AN OMISSION
 * ===========================================================================
 *   - THE DELIBERATION BEAT. The judges taking their time is silence; a sound
 *     under it would be a metronome telling the lifter to wait.
 *   - A NO-LIFT. A real hall goes quiet when the lights come up red. Giving it
 *     a sound would be giving the player a fail buzzer, which is the opposite
 *     of what §6.3 asks for. `soundForBeat` returns null and the tests pin it.
 *   - THE ATTEMPT-SELECT SCREEN. It is a menu between platform moments, and
 *     the haptics carry it.
 */
export const MEET_SOUND = Object.freeze({
  /**
   * VOICES PER CUE — how many copies of one sound may sound at once.
   *
   * One player per cue id meant a retrigger did `seekTo(0)` on a player that
   * was still sounding, so the second firing KILLED the first instead of
   * layering. Two cues retrigger inside their own length at this tuning:
   * `CROWD_SWELL_BIG` (2100ms, played twice by the walk-out, the second landing
   * mid-attack) and `BAR_RATTLE` (180ms, fired every 90ms per plate).
   *
   * SIZED OFF WHAT THE BROWSER DELIVERS, NOT OFF WHAT THE SCHEDULE ASKS FOR,
   * AND THE DIFFERENCE IS THE WHOLE STORY OF THIS NUMBER. The first version of
   * this comment said "`meetSound.test.ts` derives the worst overlap the
   * schedule can produce" — a correct derivation of 2 from a schedule the
   * browser does not deliver. `tools/verify-meet-sound.mjs` measured 5.
   *
   * Two facts set it at 3:
   *
   *   - `BAR_RATTLE` is 180 ms every 90 ms, which is two deep with ZERO margin.
   *     Frames arrive on a ~16.7 ms grid, so the observed interval between one
   *     disc and the one after next can be 163 ms rather than 180, and the third
   *     copy is still sounding. `meetSound.test.ts` measures that on 117 of 1890
   *     swept deliveries with the thread never blocked at all.
   *   - `CROWD_SWELL_BIG` is 2100 ms and the walk-out plays it twice, the second
   *     landing mid-attack. That one is two by design.
   *
   * A tuner who wants the design's two-deep rattle back shortens the cue below
   * twice the stagger; raising this number instead would only decide whether the
   * extra copies pile up or cut each other, which is not the same question.
   * NOBODY HAS HEARD IT (GDD §12.1) — this is a resource floor, not a mix
   * decision.
   *
   * READ THIS BEFORE ADDING A CUE THAT CAN SOUND WITH ANOTHER. The browser run
   * has measured the delivered depth **at 3 against a pool of 3** — this number
   * was sized off measured delivery, and delivery has been observed reaching it.
   * Adding a simultaneous cue is how the oldest voice starts being cut, which is
   * a change to what a player hears that no unit test can hear.
   *
   * **THE DEPTH IS NOT STABLE ACROSS RUNS AND THE FIRST VERSION OF THIS
   * PARAGRAPH SAID IT WAS.** It read "exactly 3 … AT CAPACITY, no headroom
   * left", which was a property claim built on the two runs that had been seen.
   * Consecutive runs on one machine measured **3, 3, then 2**: the rattle is
   * fired per plate against a browser that drains blocked timers in a burst, so
   * how deep it piles depends on where the main thread was. So the honest
   * statement is that the depth is **variable and has been observed at the pool
   * size**, not that it sits there.
   *
   * That difference matters for what a green run means: a run reporting 2 is not
   * evidence of headroom, only evidence that this run did not reach the top.
   * `tools/verify-meet-sound.mjs` compares EVERY overlap's depth against this
   * pool on every beat, so exceeding it reddens with the cue, the depth and the
   * timestamps named — it does not depend on the aggregate maximum, which was
   * deleted as dominated.
   */
  VOICES_PER_CUE: 3,
  /**
   * THE ONE VOLUME KNOB. Applied to every cue after its own gain.
   *
   * Set to 0 and the game is silent; `meetSound.test.ts` uses exactly that as
   * its mute mutation, so a build that stops making sound fails the suite
   * rather than shipping quietly.
   */
  MASTER_GAIN: 0.8,

  CUES: Object.freeze({
    /** One plate landing on the sleeve. */
    BAR_RATTLE: Object.freeze({
      durationMs: 180,
      gain: 1,
      layers: Object.freeze([
        // The impact: a wide-band noise burst, rolled off so it is metal in a
        // room rather than static.
        Object.freeze({
          wave: 'noise' as const,
          freqHz: 0,
          gain: 0.9,
          startMs: 0,
          attackMs: 1,
          holdMs: 4,
          releaseMs: 130,
          curve: 4,
          lowPassHz: 2600,
          highPassHz: 240,
          seed: 20260815,
        }),
        // The body: what makes it a loaded plate and not a dropped coin.
        Object.freeze({
          wave: 'sine' as const,
          freqHz: 148,
          freqEndHz: 92,
          gain: 0.55,
          startMs: 0,
          attackMs: 2,
          holdMs: 8,
          releaseMs: 150,
          curve: 3,
          lowPassHz: 0,
          highPassHz: 0,
          seed: 1,
        }),
      ]),
    }),

    /** The hall, under an ordinary walk-out. */
    CROWD_SWELL: Object.freeze({
      durationMs: 1400,
      gain: 0.5,
      layers: Object.freeze([
        Object.freeze({
          wave: 'noise' as const,
          freqHz: 0,
          gain: 1,
          startMs: 0,
          attackMs: 420,
          holdMs: 240,
          releaseMs: 720,
          curve: 2,
          lowPassHz: 900,
          highPassHz: 110,
          seed: 991,
        }),
      ]),
    }),

    /** The hall on a third attempt, a PR, or one with a bomb on it. */
    CROWD_SWELL_BIG: Object.freeze({
      durationMs: 2100,
      gain: 0.78,
      layers: Object.freeze([
        Object.freeze({
          wave: 'noise' as const,
          freqHz: 0,
          gain: 1,
          startMs: 0,
          attackMs: 620,
          holdMs: 420,
          releaseMs: 1050,
          curve: 2,
          lowPassHz: 1300,
          highPassHz: 110,
          seed: 4021,
        }),
        // A low swell under it — the floor of a big room.
        Object.freeze({
          wave: 'noise' as const,
          freqHz: 0,
          gain: 0.5,
          startMs: 0,
          attackMs: 700,
          holdMs: 400,
          releaseMs: 980,
          curve: 2,
          lowPassHz: 260,
          highPassHz: 0,
          seed: 7717,
        }),
      ]),
    }),

    /** One referee's lamp coming up white. */
    LIGHT_CLACK_WHITE: Object.freeze({
      durationMs: 120,
      gain: 0.85,
      layers: Object.freeze([
        Object.freeze({
          wave: 'noise' as const,
          freqHz: 0,
          gain: 0.7,
          startMs: 0,
          attackMs: 0,
          holdMs: 2,
          releaseMs: 40,
          curve: 6,
          lowPassHz: 6000,
          highPassHz: 1400,
          seed: 314159,
        }),
        Object.freeze({
          wave: 'triangle' as const,
          freqHz: 1180,
          freqEndHz: 880,
          gain: 0.45,
          startMs: 0,
          attackMs: 1,
          holdMs: 6,
          releaseMs: 80,
          curve: 4,
          lowPassHz: 0,
          highPassHz: 0,
          seed: 2,
        }),
      ]),
    }),

    /** ...and red. Lower and duller, so a 2-1 can be heard assembling. */
    LIGHT_CLACK_RED: Object.freeze({
      durationMs: 150,
      gain: 0.85,
      layers: Object.freeze([
        Object.freeze({
          wave: 'noise' as const,
          freqHz: 0,
          gain: 0.7,
          startMs: 0,
          attackMs: 0,
          holdMs: 2,
          releaseMs: 52,
          curve: 5,
          lowPassHz: 3400,
          highPassHz: 700,
          seed: 271828,
        }),
        Object.freeze({
          wave: 'triangle' as const,
          freqHz: 620,
          freqEndHz: 430,
          gain: 0.45,
          startMs: 0,
          attackMs: 1,
          holdMs: 8,
          releaseMs: 110,
          curve: 3,
          lowPassHz: 0,
          highPassHz: 0,
          seed: 3,
        }),
      ]),
    }),

    /** Three whites. The hall reacts. */
    CROWD_CHEER: Object.freeze({
      durationMs: 1700,
      gain: 0.9,
      layers: Object.freeze([
        Object.freeze({
          wave: 'noise' as const,
          freqHz: 0,
          gain: 1,
          startMs: 0,
          attackMs: 130,
          holdMs: 320,
          releaseMs: 1150,
          curve: 2,
          lowPassHz: 2400,
          highPassHz: 200,
          seed: 65537,
        }),
        Object.freeze({
          wave: 'noise' as const,
          freqHz: 0,
          gain: 0.45,
          startMs: 60,
          attackMs: 200,
          holdMs: 300,
          releaseMs: 1000,
          curve: 2,
          lowPassHz: 380,
          highPassHz: 0,
          seed: 8191,
        }),
      ]),
    }),

    /** GDD §6.3. One low tone, and then the room is empty. */
    BOMB_TONE: Object.freeze({
      durationMs: 2400,
      gain: 0.6,
      layers: Object.freeze([
        Object.freeze({
          wave: 'sine' as const,
          freqHz: 74,
          freqEndHz: 58,
          gain: 1,
          startMs: 0,
          attackMs: 380,
          holdMs: 260,
          releaseMs: 1700,
          curve: 2,
          lowPassHz: 0,
          highPassHz: 0,
          seed: 4,
        }),
        // A fifth above it, quieter, so it reads as a chord dying rather than
        // as a test tone.
        Object.freeze({
          wave: 'sine' as const,
          freqHz: 111,
          freqEndHz: 87,
          gain: 0.32,
          startMs: 90,
          attackMs: 420,
          holdMs: 200,
          releaseMs: 1600,
          curve: 2,
          lowPassHz: 0,
          highPassHz: 0,
          seed: 5,
        }),
      ]),
    }),
  }) satisfies Readonly<Record<string, SoundCue>>,
});

/** Which cue a moment plays. `null` is silence, and sometimes deliberate. */
export type MeetSoundId = keyof typeof MEET_SOUND.CUES;

/** Every cue id, for the exhaustiveness checks. */
export const MEET_SOUND_IDS = Object.freeze(
  Object.keys(MEET_SOUND.CUES) as MeetSoundId[],
);

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
  qualifyingTotalKg: null,
  /**
   * Authored before this flight exists. Holder is not a current competitor.
   * 500 kg sits below a typical Ashford card and above a first-meet Total, so
   * a record stake can fire without reading anyone's future result.
   */
  standingRecord: Object.freeze({ totalKg: 500, holderName: 'K. VAUGHN' }),
});

/**
 * The lifter's entry. PLACEHOLDER DATA, not progression — with onboarding and a
 * backend, every field arrives from the profile and none of it lives here.
 *
 * Typed `KilogramMeetEntry` rather than `MeetEntry`: this lifter weighed in on a
 * kilogram scale, that is stated rather than assumed by the field's name, and
 * the shipped meet loop takes the number from here.
 */
export const MEET_ENTRY: KilogramMeetEntry = Object.freeze({
  name: 'A. LIFTER',
  sex: 'male',
  bodyweight: Object.freeze({ unit: 'kg', kilograms: 92.4 }),
  division: 'Open',
  equipment: 'Raw',
  lot: 3,
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
  BOARD_PLACE_W: 18,
  BOARD_FLIGHT_GAP: 8,
  BOARD_ROW_PAD: 4,

  BUTTON_HEIGHT: 50,
  BUTTON_RADIUS: 10,
  BUTTON_FONT: 13,

  COMMAND_FONT: 42,
  COMMAND_LIVE_FONT: 52,

  DIVIDER_HEIGHT: 1,

  /**
   * The Career surface (Sprint 1b): the GDD §2.1 chooser's cards and the §6.1
   * calendar's rows. Feel starting points like everything here — nobody has
   * played them. `CAREER_FOOT_CLEARANCE` keeps the calendar's last row clear
   * of the shell's bottom pill band (`SHELL_LAYOUT.NAV_BOTTOM_INSET` plus the
   * pill's height plus its hit slop is about 110 on the shipped chrome); the
   * disjointness is measured on rendered pixels in
   * `tools/verify-shell-route.mjs`, so a playtester who shrinks this finds out
   * by name rather than by overlap.
   */
  CAREER_PAD_TOP: 64,
  CAREER_ROW_PAD_V: 12,
  CAREER_ROW_GAP: 12,
  CAREER_FOOT_CLEARANCE: 120,

  /** Extra scroll pad so the Create action stays reachable above a phone keyboard. */
  LIFTER_KEYBOARD_CLEARANCE: 280,

  /** First-paint pad on Create — CAREER_PAD_TOP is too tall once the gym card wraps the form. */
  LIFTER_CREATE_PAD_TOP: 16,

  /** Two-up federation chooser on a 390-wide phone. Untuned (GDD §12.1). */
  FEDERATION_CARD_MIN_W: 148,

  /**
   * Wash over the Iron & Amber gym still on Create / My Lifter so the form
   * stays readable. Same job as SESSION_LAYOUT.BRIEFING_SCRIM; authored here
   * because this screen lives under meet chrome. Untuned (GDD §12.1).
   */
  LIFTER_ROOM_SCRIM: 0.45,

  /**
   * Iron & Amber Meet Day HUD — same overlay system as the training set.
   * Untuned (GDD §12.1). HALL_WALK_SHIFT is CSS pixels of plate pan per
   * sprite-sheet bodyDxPx so the walk-out still moves after sprites leave.
   */
  HALL_HUD_HEIGHT: 64,
  HALL_HUD_SCRIM: 0.42,
  HALL_HUD_PAD: 12,
  HALL_COMMAND_HEIGHT: 180,
  HALL_COMMAND_SCRIM: 0.5,
  HALL_WALK_SHIFT: 8,
  HALL_RISE_ZOOM: 0.02,
  HALL_LOAD_ZOOM: 0.01,
  ATTEMPT_DETAIL_LINES: 4,

  /**
   * Compact espresso card over the emptied hall on weigh-in, openers,
   * bomb-out and recap. Same job as SESSION_LAYOUT.CHECK_IN_DRAWER_MAX_HEIGHT:
   * the still stays the majority of 390×844. Untuned (GDD §12.1).
   *
   * CARD + FOOT must stay under half of 844 so the emptied hall is the majority.
   * The sport slot (openers' three lifts, recap boards + DOTS/place) is pinned
   * above the gold action so first paint cannot crop the meet off.
   */
  BOOKEND_CARD_MAX_HEIGHT: 340,
  BOOKEND_FOOT_CLEARANCE: 80,
  BOOKEND_CARD_PAD: 12,
  BOOKEND_CARD_GAP: 8,
  /**
   * Scrollable copy when the card has no pinned sport (weigh-in, bomb-out).
   * Untuned. `BUTTON_HEIGHT` plus pad and gap sit below this inside the card.
   */
  BOOKEND_SCROLL_MAX_HEIGHT: 210,
  /**
   * Scrollable copy when sport is pinned (openers, recap). Flavour and
   * "why it matters" may sit under this; the lifts may not. Untuned.
   */
  BOOKEND_COPY_SCROLL_HEIGHT: 56,
  /**
   * Pinned sport band: three opener rows, or recap boards + DOTS/place.
   * Untuned. Must cover `LIFT_ORDER.length` rows of `BOOKEND_OPENER_ROW_HEIGHT`
   * and of `BOARD_CELL_H`.
   */
  BOOKEND_SPORT_MAX_HEIGHT: 214,
  /** Recap total inside the bookend, smaller than the full-screen numeral. Untuned. */
  BOOKEND_TOTAL_FONT: 30,
  /** Recap DOTS/place row inside the sport band. Untuned. */
  BOOKEND_SUMMARY_HEIGHT: 40,
  /** Opener rows inside the bookend card. Untuned. */
  BOOKEND_OPENER_ROW_HEIGHT: 48,

  // THE WALKOUT'S BAR GRAPHIC USED TO BE HERE, and it is gone rather than
  // unused. `BAR_W / BAR_H / PLATE_W / PLATE_GAP / PLATE_MAX_H / PLATE_MIN_H`
  // sized a barbell drawn out of `Animated.View`s with `backgroundColor`,
  // `borderColor` and `borderRadius` — anti-aliased vector rectangles, two
  // seconds before the player squatted a nearest-neighbour pixel bar. GDD §7.1
  // commits to a fixed internal resolution and nearest-neighbour scaling
  // throughout, so the walkout's bar is now `renderLifterFrame`'s bar and the
  // geometry that draws it is the sprite's (`src/art/spriteTuning.ts`'s `BAR`),
  // not a second set of numbers here that could disagree with it.
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

  /**
   * What a weight is printed WITH, per unit the meet can be run in.
   *
   * EXHAUSTIVE OVER `MeetWeightUnit` ON PURPOSE. `AttemptView.tsx` printed a
   * hardcoded `" kg"` after `formatWeight(live.weightKg)`, so on a pound meet —
   * which `POUND_MEET_RULES` makes a configuration the engine supports and runs
   * end to end — the one screen showing the bar was telling the player the wrong
   * number. `satisfies Record<MeetWeightUnit, string>` means a third unit cannot
   * be added to `meet.ts` without a label being decided here, rather than a
   * screen quietly keeping the old suffix.
   *
   * THIS IS A DISPLAY FIX AND NOT A RULING. GDD §11's pound-meet question stays
   * open: the engine still runs a pound meet and progression still refuses to
   * record one. What changes is only that the screen no longer lies about which
   * unit is on the bar while that is true.
   */
  UNIT_LABEL: Object.freeze({ kg: 'kg', lb: 'lb' } as const satisfies Record<MeetWeightUnit, string>),

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
  OPENERS_GET_IN: 'Make these and you are in the meet. The risk is the weight and your lift, not a hidden roll.',
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
  /**
   * Why you would take the big jump — and no longer a claim about a record.
   *
   * It used to read 'A PR on the line. Higher risk.' and it was printed
   * unconditionally, while `AttemptOption.isPrAttempt` — the flag the gold
   * border reads — is `previousBestKg !== null && weightKg > previousBestKg`.
   * On a lifter's first meet `previousBestByLift` returns all-null, so every
   * big card on that meet said "A PR on the line" over a card the app had
   * decided was not a PR attempt: 6 of 6 on a played first meet, measured in
   * `AttemptSelectView.test.ts`. It was false on later meets too, on every
   * opener and second attempt under the lifter's best, which is most of them.
   *
   * The PR claim now lives in `OPTION_PR_NOTE`, which the engine attaches to
   * whichever option actually crosses the lifter's best.
   */
  OPTION_BIG_WHY: 'The biggest jump on offer. Higher risk.',
  /**
   * GDD §6.3's "a PR on the line", printed on the card it is true of.
   *
   * `attemptDecisionFor` puts this on an option exactly when that option's
   * `isPrAttempt` is true, which is the same field `AttemptSelectView` paints
   * `MEET_PALETTE.CARD_PR_EDGE` from — so the sentence and the gold border are
   * one decision rendered twice rather than two that can disagree.
   *
   * `@guarantee pr-sentence-and-pr-border-are-one-decision`
   */
  OPTION_PR_NOTE: 'A PR on the line.',
  OPTION_PUSH_PAST: 'GO PAST IT',
  OPTION_PUSH_PAST_WHY: 'Concede the miss and reach past it. Rescues the lift or spends the last attempt for nothing.',
  OPTION_BOMB_WARNING: 'Miss this and the meet is over with nothing on this lift.',

  BOARD_EYEBROW: 'FLIGHT',
  BOARD_YOU: 'YOU',
  BOARD_UP: 'UP',
  BOARD_ON_DECK: 'ON DECK',
  BOARD_PLACE: 'PLACE',
  BOARD_TOTAL: 'BOARD',
  STAKE_PROJECTED: 'Make this: {total} Total',
  STAKE_PLACE_MAKE: 'Make this: {place} of {field}',
  STAKE_PLACE_MISS: 'Miss and stand: {place} of {field}',
  STAKE_MISS_STANDS: 'Miss and the current result stands.',
  STAKE_QUALIFYING: 'Make this: qualifying Total ({kg})',
  STAKE_MEET_RECORD: 'Make this: meet record ({kg})',
  STAKE_BANKED_TOTAL: 'Banked Total {total}',
  COMMAND_SQUAT: 'SQUAT',
  COMMAND_RACK: 'RACK',
  COMMAND_START: 'START',
  COMMAND_PRESS: 'PRESS',
  COMMAND_DOWN: 'DOWN',
  RECAP_WHY_LABEL: 'WHY IT MATTERS',
  RECAP_WHY_PLACE: 'You placed {place} of {field}.',
  RECAP_WHY_PR: 'A competition best moved.',
  RECAP_WHY_FIRST: 'First Total on the board.',
  RECAP_WHY_QUALIFY: 'This Total qualifies you for the next rung.',
  RECAP_WHY_RECORD: 'Meet record.',
  RECAP_WHY_BOMB: 'No Total. The attempts you made still stand as training.',

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
  /**
   * The word beside a lift that went past a number the lifter already held.
   *
   * `liftCallOutFor` prints it exactly when `beatsPreviousBest` is true of that
   * lift, which is the same predicate GDD §6.3's gold border and PR sentence are
   * painted from. A lift the lifter had no record on gets `RECAP_FIRST_LIFT`
   * instead — the recap used to print this one for both.
   */
  RECAP_PR_LIFT: 'PR',
  /**
   * The word beside a lift the lifter had no competition record on at all.
   *
   * PENDING PLAYTEST, like every string in this block and like §6.3's two
   * wording options. What is settled is that a first-ever lift gets a DIFFERENT
   * word from a beaten record, following the precedent `RECAP_FIRST_TOTAL`
   * already set for the total. Which word is a feel question a playtester
   * answers; 'FIRST' is a placeholder chosen to sit under `RECAP_FIRST_TOTAL`
   * without repeating the lift's own name, which is already on the row.
   * GDD §6.5 records it as pending.
   */
  RECAP_FIRST_LIFT: 'FIRST',
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
  /**
   * How many drive cues a scripted DEADLIFT chases before giving up.
   *
   * Squat and bench's scripted reps tap the first armed cue only, which is
   * enough to make their attempts at meet loads. A deadlift's demand curve
   * peaks high in the range (`STICK_HEIGHT_FRAC.deadlift`), so a single tap
   * decays before the bar gets there and a "perfect" pull would stall.
   *
   * A CEILING ON A SEARCH, NOT A CUE COUNT. `DRIVE_ATTEMPTS_PER_REP` decides
   * how many cues actually arm; this only stops the chase from looping forever
   * if a future retune ever armed cues without consuming them. Comfortably
   * above `DRIVE_ATTEMPTS_PER_REP.deadlift.MAXIMAL`.
   */
  DEADLIFT_CUES_CHASED: 8,
  /**
   * Ticks a 'marginal' scripted deadlift lets go of the lockout before catching
   * it again — the arguable make, which grades a grind rather than a clean lift.
   *
   * Must land past `LOCKOUT_GRIP_GRACE_TICKS` (or the slip costs nothing) and
   * short of the drop, or 'marginal' would be a miss and the style would lie.
   * `meetDay.test.ts`'s "the deadlift's scripted rep styles mean what they say"
   * plays every style rather than trusting this note.
   */
  DEADLIFT_SLIP_TICKS: 18,
  /**
   * Ticks a scripted bench rep lets the bar go for, when it is scripting the
   * one mistake a bench descent still has.
   *
   * `BENCH_HOLD_SCAN_MAX` WAS HERE AND IS DELETED WITH THE SEARCH IT CAPPED.
   * The script used to play the descent at every hold from 1 to 60 and keep
   * whichever arrived softest, because under the beat before the 2026-08-25
   * REPLAY steer the best arrival was bought by letting go at the right
   * moment. The steer made the answer "never let go" at every load — a search
   * whose result is a constant — so the script holds, and this is what the
   * 'marginal' style lets go for instead.
   *
   * ONE TICK, WHICH IS THE WHOLE MISTAKE. The finger comes off immediately
   * after the descent starts and never comes back, so the bar runs away for
   * the entire descent and arrives as hot as this mechanic can make it. That
   * is what 'marginal' asks for on a bench: a rep that made it and should not
   * have. `meetDay.test.ts` plays every style rather than trusting this note.
   */
  BENCH_SLIP_AT_TICKS: 1,
  /**
   * Ticks between the taps a scripted bench grind throws.
   *
   * `GRIND_TAP_REFRACTORY_TICKS` is the floor the mechanic will count, so this
   * is a scripted player tapping as fast as the sim will believe — which is
   * what 'perfect' means on a beat whose input is a rate.
   *
   * RENAMED FROM `BENCH_BURST_TAP_GAP_TICKS` with the beat. Same value, same
   * mechanism, and a name that describes the beat it belongs to rather than
   * the one it replaced.
   */
  BENCH_GRIND_TAP_GAP_TICKS: 3,
  /**
   * How many taps a scripted grind writes.
   *
   * A CEILING ON A SCRIPT, NOT A TAP COUNT. There is no per-rep tap cap since
   * the 2026-08-25 replay steer — taps count until the rep resolves — so this
   * only has to outlast the longest bench rep the mechanic can produce, which
   * is an undriven maximal ascent running to `ASCENT_TIMEOUT_TICKS`. At
   * `BENCH_GRIND_TAP_GAP_TICKS` this is 360 ticks of tapping, comfortably past
   * it.
   *
   * THE VALUE IT REPLACES WOULD HAVE SHIPPED A SILENTLY SHORT GRIND. It was
   * sized against an 850ms burst window and covered 72 ticks, so a scripted
   * "perfect" bench would have tapped for the first fifth of its ascent and
   * then gone quiet — a fixture answering the beat it was written for and not
   * the beat it now runs against. Nothing in the type system notices a script
   * that stops early.
   */
  BENCH_GRIND_TAPS_SCRIPTED: 120,
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

  /**
   * WHICH INSTANTS OF THE WALK-OUT GET PHOTOGRAPHED.
   *
   * DEBUG ONLY, and not a feel value: turning these changes which moment the
   * capture holds, not how the beat plays. They exist because the two settled
   * walk-out frames cannot, on their own, show that anything moves — a critic
   * comparing `walkout.png` and `walkout-third.png` is comparing two still
   * lifters. `walkout-unrack` and `walkout-step` hold the SAME third attempt at
   * two instants inside the motion, so motion is visible in stills.
   *
   * MILLISECONDS FROM THE TOP OF THE BEAT, so they are read the same way every
   * other duration in this file is. That makes them dependent on how long the
   * bar takes to load, which depends on how many discs are on it, so
   * `walkout.test.ts` checks each one still lands in the stage it is named for
   * — on the sequence the preview's own third attempt builds — rather than
   * trusting the arithmetic. A tuning pass that lengthens the unrack cannot
   * silently move a photograph into the wrong stage.
   */
  WALKOUT_HOLD_MS: Object.freeze({
    /** Mid-drive, off the hooks. Deep enough into the stage to be past the dip. */
    UNRACK: 1050,
    /** Mid-step-back, on the first plant, where the body is furthest across. */
    STEP: 1350,
  }),
});
