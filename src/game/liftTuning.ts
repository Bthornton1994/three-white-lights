/**
 * LIFT_TUNING — every game-feel number the lift input mechanic uses.
 *
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE TRUSTING A SINGLE NUMBER IN THIS FILE
 * ---------------------------------------------------------------------------
 * NOTHING HERE HAS BEEN PLAYED. Not once, by anyone. GDD §10 Prototype 1 says
 * plainly that the lift mechanic needs "~30 iterations of tweaking timing
 * windows, animation curves, and haptic patterns by feel", and that it "cannot
 * be reasoned into correctness — it has to be played". GDD §12.1 repeats it:
 * a one-shot run cannot tell you whether pressing the screen to grind out a
 * squat feels good.
 *
 * So every value below is an UNTUNED PLACEHOLDER. What they were chosen for is
 * a much weaker property than "good": that the outcome space is not degenerate.
 * A maximal attempt with no drive input misses; the same attempt with a
 * well-timed drive makes it; mistimed drives land in between and produce a
 * grind. `lift.test.ts` measures that spread rather than asserting it, so a
 * hand pass that collapses the mechanic into "always makes" or "always misses"
 * fails a test instead of shipping.
 *
 * That is the whole claim. It is not a claim about feel.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS AT ALL
 * ---------------------------------------------------------------------------
 * CLAUDE.md, "Game Feel Values Must Be Tunable": "Keep every such value as a
 * named constant in one place. Never scatter them as magic numbers across
 * components."
 *
 * This is that place for the lift mechanic. `lift.ts`, `liftFrame.ts` and every
 * component under `src/lift/` read from here and may not contain a bare timing,
 * force, threshold, window width, animation duration or haptic pattern.
 * `liftTuning.test.ts` scans those sources for numeric literals and fails on
 * anything that is not in a small allowlist of structural constants (0, 1, 2,
 * array indices and the like), so this rule is enforced rather than asked for.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS IMPORTED RATHER THAN RESTATED, AND WHY
 * ---------------------------------------------------------------------------
 * Four facts are shared with the sprite system and are imported from
 * `src/art/spriteTuning.ts` instead of being written down twice:
 *
 *   TICK_HZ / TICK_MS      The clock. The sim and the animation must agree on
 *                          what a tick is or the drawn rep and the simulated
 *                          rep drift apart.
 *   LOAD_RANGE / loadT     The shape of the load response. Two different load
 *                          curves would mean "0.88" was a different weight to
 *                          the mechanic than to the drawing.
 *   STICK.HEIGHT_FRAC      WHERE THE STICKING POINT IS. This is the one that
 *                          matters most: the height the bar mechanically
 *                          stalls at must be the height the sprite is drawn
 *                          fighting at, or the grind is drawn in the wrong
 *                          place.
 *   STICK.WIDTH            How wide that region is, for the same reason.
 *
 * This is a `src/game/` module importing from `src/art/`, which is the wrong
 * direction on paper. It is done deliberately: `spriteTuning.ts` is a pure
 * constants module (zero React, zero I/O, zero side effects — it satisfies the
 * purity contract CLAUDE.md sets for game math), and the alternative is
 * duplicating four tunables that must never disagree. Restating them here would
 * be exactly the scattered-magic-number failure this file exists to prevent.
 * `liftTuning.test.ts` pins the import so the coupling is visible.
 *
 * ---------------------------------------------------------------------------
 * UNITS, STATED ONCE
 * ---------------------------------------------------------------------------
 *   depth      0 = standing, 1 = the authored bottom pose. May exceed 1 (buried).
 *   height     h, 0 = bottom of the hole, 1 = lockout. h = 1 - depth on the way up.
 *   velocity   height units per tick. 0.01/tick = 100 ticks = 1.67 s to lock out.
 *   force      Multiples of the lifter's capacity, which is exactly 1.0 by
 *              definition (LIFTER_CAPACITY). A demand of 1.27 means the bar is
 *              27% heavier than the lifter can hold at that point in the range,
 *              so it goes backwards unless the player drives.
 *   ms         Real milliseconds. Timing windows are in ms, not ticks, because
 *              that is the unit `fatigue.ts` modulates them in and the unit a
 *              playtester thinks in.
 *
 * ---------------------------------------------------------------------------
 * `{ LIGHT, MAXIMAL }` PAIRS ARE ENDPOINTS, NOT PRESETS
 * ---------------------------------------------------------------------------
 * Same trap as `spriteTuning.ts`, restated because it catches everybody: every
 * pair below is evaluated at LOAD_RANGE.MIN (0.35) and LOAD_RANGE.MAX (1.05),
 * NOT at LOAD_PRESETS.LIGHT / LOAD_PRESETS.MAXIMAL. A rep at
 * LOAD_PRESETS.MAXIMAL (1.0) sits at loadT ~0.88 and so sees ~88% of the way to
 * the MAXIMAL endpoint. The endpoints are headroom.
 */

import {
  LOAD_PRESETS,
  LOAD_RANGE,
  STICK,
  TICK_HZ,
  TICK_MS,
  byLoad,
  clampLoadRatio,
  loadT,
  type LoadEndpoints,
} from '../art/spriteTuning';
import type { LiftKind } from './meet';

export { LOAD_PRESETS, LOAD_RANGE, TICK_HZ, TICK_MS, byLoad, clampLoadRatio, loadT };
export type { LoadEndpoints };

/**
 * Every lift the mechanic can simulate. ALL THREE, as of deadlift's phase
 * model — this type is now exactly `LiftKind` and the narrowing it used to do
 * is gone.
 *
 * IT IS KEPT AS A NAME RATHER THAN DELETED, and `liftTuning.test.ts` pins it
 * set-equal to `meet.ts`'s `LIFT_ORDER` in BOTH directions. That pin is what
 * replaces the `simKindFor` stopgap this piece deleted: a fourth `LiftKind`
 * added to `meet.ts` reddens a test here until it has been given a mechanic,
 * instead of being quietly mapped onto squat's numbers by a helper nobody
 * re-reads. The old helper's failure mode was that it was CORRECT and
 * INVISIBLE — every deadlift in the game ran squat's beat and nothing said so
 * at the call site.
 */
export type PlayableLiftKind = LiftKind;

export const PLAYABLE_LIFT_KINDS = Object.freeze([
  'squat',
  'bench',
  'deadlift',
] as const satisfies readonly PlayableLiftKind[]);

/**
 * The lifts that LOWER THE BAR FIRST, and so run through `DESCENT` and `HOLE`.
 *
 * ---------------------------------------------------------------------------
 * THIS TYPE IS THE STRUCTURAL FACT THAT MAKES DEADLIFT A THIRD LIFT
 * ---------------------------------------------------------------------------
 * A deadlift has no eccentric. The bar starts on the floor, so there is
 * nothing to lower, no depth to judge, and no reversal to time. Its phases are
 * `BRACE -> ASCENT -> LOCKOUT -> RESOLVED`.
 *
 * Every table below that describes the way down is keyed by THIS type rather
 * than by `PlayableLiftKind`, which means `LIFT_TUNING.DEPTH_LEGAL.deadlift`
 * is a COMPILE ERROR rather than a value somebody has to remember is never
 * read. That is the difference between writing the ruling down in a comment
 * and writing it into the type system: a future builder cannot give deadlift a
 * descent by accident, and cannot give it one on purpose without deleting this
 * type.
 *
 * It also keeps the eccentric tables honest in the other direction. Adding a
 * `deadlift:` row of plausible-looking depth numbers would satisfy every
 * `PerKind` loop in `liftTuning.test.ts` while being read by nothing — an
 * invariant asserted over an unreachable domain, which is the vacuity
 * CLAUDE.md's "An Assertion Is Vacuous If It Cannot Fail" section is about.
 */
export type EccentricLiftKind = Exclude<PlayableLiftKind, 'deadlift'>;

export const ECCENTRIC_LIFT_KINDS = Object.freeze([
  'squat',
  'bench',
] as const satisfies readonly EccentricLiftKind[]);

/** One value per lift the mechanic can simulate. All three. */
type PerKind<T> = Readonly<Record<PlayableLiftKind, T>>;

/**
 * One value per lift that HAS a way down. Two.
 *
 * See `EccentricLiftKind`. A table typed this way cannot be indexed with
 * `'deadlift'`, which is the point.
 */
type PerEccentricKind<T> = Readonly<Record<EccentricLiftKind, T>>;

/**
 * The lifts whose descent is graded on WHEN THE PLAYER RELEASES. One: squat.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS TYPE EXISTS, AND WHY IT IS NOT A SYNONYM FOR `EccentricLiftKind`
 * ---------------------------------------------------------------------------
 * Bench lowers the bar, so it is eccentric. It is no longer DEPTH-TIMED. The
 * 2026-08-25 ruling replaced bench's release-at-a-moment check with a control
 * check — the bar is graded on HOW IT ARRIVES at the chest, not on the tick
 * the finger came up — so the two tables that describe a release window
 * (`DEPTH_LEGAL`, `DEPTH_WINDOW_MS`) have nothing to say about a bench rep any
 * more.
 *
 * The rows were DELETED rather than left in place with a comment saying they
 * are squat's, which is the same decision `EccentricLiftKind` made about
 * deadlift one lift out: a value that is read by nothing is worse than a magic
 * number, because a playtester turns it and nothing happens. Indexing either
 * table with `'bench'` is now a compile error, and `depthTimedKindOf` in
 * `lift.ts` refuses the kind at runtime for a caller that reaches one
 * dynamically.
 *
 * WHAT BENCH KEEPS, so this reads as a narrowing rather than a deletion:
 * `DEPTH_IDEAL.bench` is where the chest is, `DEPTH_COLLAPSE.bench` is how far
 * a crashed bar may sink into it, `DESCENT_DEPTH_PER_TICK.bench` is the
 * CONTROLLED speed it comes down at, and the whole `BENCH_DESCENT_*` block
 * below is the rest.
 */
export type DepthTimedLiftKind = Extract<PlayableLiftKind, 'squat'>;

export const DEPTH_TIMED_LIFT_KINDS = Object.freeze([
  'squat',
] as const satisfies readonly DepthTimedLiftKind[]);

/** One value per lift graded on the tick it releases at. One. */
type PerDepthTimedKind<T> = Readonly<Record<DepthTimedLiftKind, T>>;

/**
 * WHERE THE STICKING POINT IS, and how wide it is — per lift kind.
 *
 * squat's pair is re-exported from the sprite system rather than restated, so
 * the height the bar mechanically stalls at is the height the lifter is drawn
 * fighting at (see `spriteTuning.ts`'s own header). bench has no analogous
 * animation system yet — there is no `benchAnimation.ts` this needs to stay
 * in sync with — so its pair is a local placeholder rather than an import.
 *
 * BENCH'S NUMBERS, REASONED RATHER THAN MEASURED: a bench sticking point is
 * commonly felt low in the press, shortly after the bar leaves the chest —
 * lower than squat's mid-range stall (0.34) — so 0.20. The stall band is kept
 * comparably narrow (0.12 vs squat's 0.14): an "off the chest" grind reads as
 * a sharper, shorter-lived event than a squat's more sustained mid-range
 * fight. Neither number has been played. GDD §10's ~30-iteration expectation
 * applies here exactly as it does to every squat value in this file.
 *
 * DEADLIFT'S NUMBERS, AND WHY THEY ARE EXPLICITLY *NOT* THE THING THAT MAKES
 * IT A THIRD LIFT. GDD §6.2 gives deadlift one line, "lockout grind", so the
 * stall is placed high in the range — 0.62, above squat's 0.34 and well above
 * bench's 0.20. The WIDTH is squat's, unchanged, and that is a correction
 * rather than a default: see below.
 *
 * READ THE POSITION AS FLAVOUR, NOT AS THE MECHANIC. Moving a gaussian up the
 * range is a retune, and a retune is exactly what this piece was told not to
 * build. What makes deadlift a third lift is structural and lives elsewhere:
 * it has no `EccentricLiftKind` row at all (no descent, no depth judgement, no
 * reversal), it is given no velocity by any input off the floor
 * (`FLOOR_BREAK_VELOCITY`), and its `LOCKOUT` asks a question the other two
 * lifts' `LOCKOUT` does not ask (`DOWN_COMMAND_DELAY_TICKS` and the sag
 * constants under it). Delete this row and deadlift is still a third lift;
 * delete those and it is a squat.
 *
 * A GUESS THAT WAS MEASURED AND REFUTED, KEPT BECAUSE THE MEASUREMENT IS WORTH
 * MORE THAN THE TIDY VERSION. The first pass set the width to 0.18 — wider than
 * squat's 0.14 — reasoning that "a deadlift that dies near lockout dies slowly
 * rather than snapping back". That sentence is probably true about deadlifts and
 * was false about this model. Width compounds with the stick's POSITION: a wide
 * gaussian centred at 0.62 keeps demand above ~0.98 from h≈0.45 to h≈0.85,
 * roughly three times the span of squat's notch, and the bar is fighting for so
 * much of the range that `STALL_CAPACITY_DECAY` finishes it off. Measured at the
 * first pass: a maximal deadlift driven with every cue landed perfectly still
 * MISSED — 166 ascent ticks against a 170-tick timeout, 73 of them stalled — and
 * 40 of 120 swept cases never reached lockout at all, so the beat this whole
 * piece is about was unreachable at the top of the load range.
 *
 * That is the degenerate outcome space this file's own header names as the one
 * property a placeholder must have. Two lifts' worth of comments describing a
 * plausible curve did not catch it; playing the rep did.
 */
export const STICK_HEIGHT_FRAC: PerKind<number> = Object.freeze({
  squat: STICK.HEIGHT_FRAC,
  bench: 0.2,
  deadlift: 0.62,
});
/**
 * Half-width of the sticking point's gaussian, per kind, in bar-height units:
 * `gauss(h, STICK_HEIGHT_FRAC[kind], this)`, so at `this` away from the centre
 * the bump is worth 1/e of its peak.
 *
 * ---------------------------------------------------------------------------
 * BENCH WAS WIDENED TO 0.32 ON 2026-08-26 AND PUT BACK THE SAME DAY, AND THE
 * REVERT IS RECORDED RATHER THAN ERASED BECAUSE THE MEASUREMENT IS THE USEFUL
 * PART
 * ---------------------------------------------------------------------------
 * The reasoning for widening it was sound and is still worth reading: the width
 * does NOT move the peak — `gauss` is 1 at the centre whatever this is — so it
 * changes no cell's demand-minus-capacity margin, only how many TICKS the bar
 * spends near that peak. Paired with `DEMAND_BASE.bench` it looked like a clean
 * split: the base decides which rung the bar stops at, the width decides how
 * long the fight lasts.
 *
 * WHAT THAT MISSED IS THAT A LONGER FIGHT IS ALSO A LONGER FIGHT FOR A WARM-UP.
 * Widening moves the margin at which an UNTAPPED bar starts failing DOWNWARD,
 * and GDD §12.3's warm-up protection is exactly a claim about that boundary.
 * Measured, as the total RPE 6/7 reps lost across every quit instant 1..140 at
 * three cadences (`REACHABLE_WARMUP`'s sweep, 12600 reps):
 *
 *     base +0.06 / width 0.32   456 lost   <- shipped for one commit, wrong
 *     base +0.02 / width 0.32    60 lost
 *     base +0.02 / width 0.26    60 lost
 *     base +0.02 / width 0.22     0 lost   <- shipped
 *     base +0.04 / width 0.16    60 lost
 *
 * Narrowing does not buy the base back either, which is the row a reader would
 * otherwise try next. At every width the warm-up wall sits at about +0.02 of
 * base, so the width is not an independent difficulty knob at all — it trades
 * against the same budget the base spends, and it costs more per unit of
 * difficulty bought. It is therefore left where it was.
 *
 * DEADLIFT KEEPS SQUAT'S (0.14) AND MUST. Its header above records a first pass
 * that widened it alongside a raised base and made a perfectly-driven maximal
 * pull unwinnable. Bench has now reproduced the same failure one axis over —
 * not an unwinnable top, but an unwinnable warm-up — which is the second time
 * this constant has punished being widened. Treat a proposal to widen any of
 * these three as a proposal to move a boundary somebody else's guarantee is
 * written about.
 */
export const STICK_WIDTH: PerKind<number> = Object.freeze({
  squat: STICK.WIDTH,
  bench: 0.22,
  deadlift: 0.14,
});

/** One haptic beat. `style` is mapped to the platform API by the UI layer. */
export type HapticStyle =
  | 'selection'
  | 'light'
  | 'medium'
  | 'heavy'
  | 'rigid'
  | 'soft'
  | 'success'
  | 'warning'
  | 'error';

/**
 * A haptic pattern: one or more beats, each with a delay before it fires.
 *
 * Expressed as data rather than as calls so the whole vocabulary is in one
 * table a playtester can rewrite without opening a component. GDD §9.1 budgets
 * "real iteration time" here and calls haptics critical to lift feel.
 */
export interface HapticPattern {
  readonly beats: readonly { readonly style: HapticStyle; readonly delayMs: number }[];
}

function pattern(...beats: readonly { style: HapticStyle; delayMs: number }[]): HapticPattern {
  return Object.freeze({ beats: Object.freeze(beats.map((b) => Object.freeze({ ...b }))) });
}

/**
 * The same constructor, for the other tuning module that holds haptic patterns.
 *
 * `MEET_TUNING.HAPTICS` is built with this rather than with a second local copy
 * so both vocabularies are the same shape and the same frozen data, and so
 * `playHaptic` has exactly one kind of thing to play. Meet day's patterns live
 * in `meetTuning.ts` — with the rest of meet day's feel values — and not here,
 * because a playtester turning the walkout should not be reading descent rates.
 */
export { pattern as hapticPattern };

export const LIFT_TUNING = Object.freeze({
  // -------------------------------------------------------------------------
  // The lifter
  // -------------------------------------------------------------------------

  /**
   * The lifter's force output, by definition. Every demand number below is a
   * multiple of this, so "demand 1.27" reads directly as "27% more than he has".
   *
   * DO NOT TUNE THIS. It is the unit, not a knob. Making the lifter stronger is
   * done by lowering demand; making him weaker is done by raising it. Changing
   * the unit rescales every force in the file at once and means nothing.
   */
  LIFTER_CAPACITY: 1,

  // -------------------------------------------------------------------------
  // Descent
  // -------------------------------------------------------------------------

  /**
   * Depth gained per tick while the player holds, per lift kind. Heavier
   * descends SLOWER, not faster — a limit attempt is controlled down, and a
   * bar that fell faster under load would read as weightless.
   *
   * squat, at the MAXIMAL endpoint: 1.0 depth takes 1/0.0155 = 65 ticks =
   * 1.08 s.
   *
   * BENCH'S ROW IS THE CONTROLLED RATE — THE ONE THE BAR KEEPS UNLESS THE
   * PLAYER LETS GO. Squat's descent is a constant rate and the player picks
   * the tick to reverse. Bench's is a constant rate too, since the 2026-08-25
   * replay steer: the bar comes down at this speed while the finger is down,
   * runs away above it while the finger is up
   * (`BENCH_DESCENT_RUNAWAY_PER_TICK`), and is floored back onto it when the
   * finger comes back (`BENCH_DESCENT_RECOVER_PER_TICK`). What is graded is
   * the speed it carries into the chest, and a bar nobody let go of carries
   * exactly this.
   *
   * SO THE NAME IS TRUE OF BOTH ROWS AGAIN, which it was not between the two
   * bench rounds: for one round bench's row was "the speed it STARTS at" and
   * the bar accelerated away from it by design. MAXIMAL is 1/0.011 ≈ 91 ticks
   * of travel, 1.5s, which is what a limit eccentric looks like; LIGHT is
   * 1/0.026 ≈ 39 ticks. Not played; GDD §10 applies.
   *
   * NO DEADLIFT ROW, AND THAT IS THE TYPE DOING ITS JOB. A deadlift's bar
   * starts on the floor; there is no descent to set a rate for. See
   * `EccentricLiftKind`.
   */
  DESCENT_DEPTH_PER_TICK: {
    squat: { LIGHT: 0.0278, MAXIMAL: 0.0155 },
    bench: { LIGHT: 0.026, MAXIMAL: 0.011 },
  } satisfies PerEccentricKind<{ LIGHT: number; MAXIMAL: number }>,

  /**
   * The brace beat before the descent starts, per lift kind. The player's
   * first press begins the descent; this is how long the "SET" prompt is
   * shown before input is accepted, so a mashed press does not immediately
   * start the rep. bench's pair is shorter than squat's — unracking is
   * quicker than a squat's brace-and-walkout — a placeholder, not measured.
   *
   * DEADLIFT BRACES LONGEST of the three, and it is the one lift where the
   * brace is the whole setup rather than a pause inside a movement: the bar is
   * already loaded on the floor and the lifter has to get down to it, set the
   * back, and take the slack out. On squat and bench this beat ends with a
   * DESCENT; on deadlift the next thing that happens is the bar leaving the
   * ground. A placeholder, not measured.
   */
  BRACE_TICKS: {
    squat: { LIGHT: 14, MAXIMAL: 34 },
    bench: { LIGHT: 10, MAXIMAL: 26 },
    deadlift: { LIGHT: 18, MAXIMAL: 42 },
  } satisfies PerKind<{ LIGHT: number; MAXIMAL: number }>,

  /** Longest the brace will wait for a press before starting the descent itself. */
  BRACE_TIMEOUT_TICKS: 600,

  // -------------------------------------------------------------------------
  // Depth — ECCENTRIC LIFTS ONLY. Every table in this section is keyed by
  // `PerEccentricKind`, so `.deadlift` on any of them does not type-check.
  // A deadlift is judged at lockout, not at a depth.
  //
  // GDD §6.2: "Squat — depth timing check in the hole", "Bench —
  // press-timing / bar-speed check off the chest". Same field names, one
  // reading per kind: for squat this is hip-crease depth in the hole; for
  // bench it is how far the bar has travelled toward the chest, and the
  // "reversal" this section's DESCENT phase asks for is the chest touch.
  // -------------------------------------------------------------------------

  /**
   * Depth at which the lift is legal. Releasing above this misses with reason
   * 'no-depth' — a high squat. Not a difficulty knob so much as the rule.
   *
   * SQUAT ONLY, AND THE BENCH ROW WAS DELETED RATHER THAN LEFT UNREAD. Bench
   * had 0.92 here while its descent was graded on the tick the finger came up.
   * Since the 2026-08-25 ruling a bench rep is not released at a depth at all
   * — the bar comes down on its own and what is graded is the speed it arrives
   * at the chest with. Bench's legality is `depthAchieved`, set by the touch
   * itself, and since the 2026-08-25 REPLAY steer the touch is unconditional:
   * the bar's descent rate is floored at `DESCENT_DEPTH_PER_TICK.bench`, so
   * depth strictly increases every tick and the chest is reached in at most
   * `ceil(DEPTH_IDEAL.bench / that rate)` ticks whatever the player does.
   * There is no depth between "legal" and "not" for this number to name, and
   * there is no longer a way to not arrive.
   */
  DEPTH_LEGAL: { squat: 0.8 } satisfies PerDepthTimedKind<number>,

  /**
   * The depth a good rep reaches, per kind. Same number for both, and it means
   * two different things: for squat it is the centre of the release window,
   * for bench it is WHERE THE CHEST IS — the depth the bar makes contact at.
   */
  DEPTH_IDEAL: { squat: 1.0, bench: 1.0 } satisfies PerEccentricKind<number>,

  /**
   * Past this the lifter is buried and the rep is over — miss, reason
   * 'buried'. A player who never releases gets here on their own, which is
   * the point: doing nothing is a distinct failure with its own texture.
   *
   * BENCH'S MARGIN ABOVE IDEAL IS SMALLER THAN SQUAT'S (1.15 vs 1.3): a chest
   * does not compress nearly as far as a hip can sink into a squat's bottom.
   * Since the 2026-08-25 ruling it is not a foul line on bench, it is HOW FAR
   * A CRASHED BAR MAY SINK: `BENCH_TOUCH_SINK_GAIN` turns the speed at contact
   * into an overshoot past the chest, and this clamps it, because a chest
   * stops compressing. A bench rep is never resolved 'buried' — the crash is
   * charged to the ascent through `BENCH_TOUCH_DEMAND_PENALTY` instead, which
   * is a cost rather than a cliff. Not measured; a placeholder.
   */
  DEPTH_COLLAPSE: { squat: 1.3, bench: 1.15 } satisfies PerEccentricKind<number>,

  /**
   * Full width of the depth window, ms. The player must release inside
   * `ideal ± width/2`. Outside it but still between DEPTH_LEGAL and
   * DEPTH_COLLAPSE is legal-but-sloppy: it grades 'missed' and costs reversal
   * speed, it does not end the rep.
   *
   * `fatigue.ts` scales this (GDD §3.4, tighter when fatigued). The IDEAL does
   * not move when it does — the window shrinks symmetrically about it — so a
   * fatigued player is asked for the same moment, more precisely.
   *
   * SQUAT ONLY SINCE THE 2026-08-25 RULING, and the bench row's history is
   * worth keeping because it is an argument that stopped applying rather than
   * one that was wrong. It read 120ms, and that number was not chosen
   * independently: a first pass set 260ms from "a chest touch is more discrete
   * than a squat's hole", and `liftTuning.test.ts`'s "never lets the late edge
   * of the depth window be an instant bury" caught the interaction with
   * bench's small collapse margin — at the light end the window's late edge
   * landed past DEPTH_COLLAPSE, so releasing inside the cue the game drew was
   * an instant bury. 120ms fixed it. The ruling then deleted the beat that
   * window described: bench no longer asks for a release at a depth, so there
   * is no window to size. The row is gone rather than frozen at 120, and the
   * lesson it earned — a per-lift number is only consistent WITH THAT LIFT'S
   * OTHER NUMBERS — is what `BENCH_TOUCH_CRASH_RATE` is checked against now.
   */
  DEPTH_WINDOW_MS: { squat: 300 } satisfies PerDepthTimedKind<number>,

  // -------------------------------------------------------------------------
  // THE DESCENT TO THE CHEST — BENCH ONLY (GDD §6.2; ruled 2026-08-25, steered
  // 2026-08-25 by the phone replay)
  //
  // THE REPLAY STEER, VERBATIM: "The descent should be less of a question on
  // how far to go down, that should be automated almost in a sense." That
  // answers the beat this block shipped with, which was a rate-steering
  // exercise — the finger fed the bar down and lifting it braked, so the
  // player was making a decision every few ticks about a quantity the screen
  // only half showed them. The steer is not a retune of that; it deletes the
  // steering.
  //
  // THE MODEL NOW. The bar comes down on its own, at a load-paced rate, and
  // the finger's only job is to KEEP IT UNDER CONTROL:
  //
  //     held      rate -= BENCH_DESCENT_RECOVER_PER_TICK[load]
  //                                        (floored at DESCENT_DEPTH_PER_TICK)
  //     released  rate += BENCH_DESCENT_RUNAWAY_PER_TICK[load]
  //                                        (capped at BENCH_DESCENT_MAX_RATE)
  //     always    depth += rate
  //
  // starting at `DESCENT_DEPTH_PER_TICK.bench` — which is now the CONTROLLED
  // rate rather than a starting rate, because a held bar never leaves it.
  //
  // THE SIGN OF THE FINGER IS INVERTED FROM WHAT THIS BLOCK USED TO SAY, AND
  // THAT IS THE WHOLE STEER. It used to be "hold to feed the bar down, let go
  // to resist". It is now "hold to stay tight, let go and the bar runs away".
  // Holding all the way down is the right answer at every load and always
  // arrives quality 1 — that is what "automated almost in a sense" means, and
  // `liftTuning.test.ts` asserts the arithmetic that makes it true
  // (`DESCENT_DEPTH_PER_TICK.bench <= BENCH_TOUCH_SOFT_RATE` at both ends)
  // rather than leaving it as this sentence.
  //
  // WHAT IS LEFT OF THE BEAT, STATED AS THE SMALL THING IT IS. One decision:
  // do not take your finger off early. A player who lifts it — to get ready to
  // tap, most likely, which is exactly the mistake the grind invites — has the
  // bar accelerate away from them, and it arrives hot. That costs the whole
  // ascent through `BENCH_TOUCH_DEMAND_PENALTY` and it costs nothing else. It
  // is legible in one sentence (`LIFT_COPY.SUBTITLE.bench`) and it is not a
  // timing check: there is no instant to hit, only a state to stay in.
  //
  // WHAT WAS DELETED WITH THE STEERING, so a reader does not go looking:
  //
  //   BENCH_DESCENT_PATIENCE_TICKS / _DAWDLE_SPAN_TICKS   The dawdle charge.
  //       It existed because braking early and feathering the bar in was a free
  //       perfect touch. Under an automatic descent the bar cannot be slowed
  //       below the controlled rate at all, so a descent's LENGTH is a constant
  //       per load and the charge had an empty domain.
  //   CHEST_TOUCH_TIMEOUT_TICKS / the 'no-touch' miss                 The bar
  //       always arrives now (rate is floored above zero), so the miss was
  //       unreachable. Deleted rather than left as a reason nothing can
  //       produce — see `MissReason` in `lift.ts`.
  //
  // LOAD-DEPENDENCE IS STILL AN OUTCOME, NOT A DECLARATION. A heavier bar
  // comes down SLOWER (`DESCENT_DEPTH_PER_TICK` — a limit attempt is
  // controlled down) and runs away HARDER when it is let go, so the same slip
  // costs more at the top of the ladder. `lift.test.ts`'s `TOUCH_SWEEP`
  // measures that rather than this comment asserting it.
  //
  // Every value below is bench's only. Squat reads none of them and its
  // DESCENT branch is untouched; `lift.test.ts` pins squat's and deadlift's
  // played histories against digests taken before any of this landed.
  // -------------------------------------------------------------------------

  /**
   * Depth-rate GAINED per tick the finger is UP, by load. The bar running away
   * from a lifter who stopped receiving it.
   *
   * MAXIMAL IS THE BIGGER NUMBER. A limit bar dropped on you is a limit bar;
   * a warm-up drifts. This is the only place in the descent where heavier
   * means faster, and it is what makes a slip cost more at the top of the
   * ladder without a single width being narrowed.
   *
   * IT IS SIZED SO THE TWO LIGHTEST BARS IN THE GAME CANNOT BE CRASHED AT ALL
   * and every load a meet attempt is taken at can be — the same two-sided
   * requirement the previous tuning was held to, restated against the new
   * model and re-derived in `liftTuning.test.ts` from the constants rather
   * than swept. Unplayed placeholders, GDD §10.
   */
  BENCH_DESCENT_RUNAWAY_PER_TICK: { LIGHT: 0.0006, MAXIMAL: 0.0016 },

  /**
   * Depth-rate LOST per tick the finger is back DOWN, by load. Catching it.
   *
   * FLOORED AT THE CONTROLLED RATE, NEVER AT ZERO, and that floor is the whole
   * of "automated almost in a sense": a bar the lifter has caught keeps coming
   * down at the rate it should have been coming down at all along. It cannot
   * be parked, so "how far down" is not a question the player is asked.
   *
   * LIGHT IS THE BIGGER NUMBER — a warm-up is easy to re-catch, a limit bar is
   * not. Together with the runaway rate above this is the whole difficulty
   * curve of what is left of the beat: at MAXIMAL the bar runs away roughly
   * three times as fast and comes back roughly two and a half times as slowly,
   * so a slip late in a limit descent cannot be recovered before the chest and
   * a slip early can. Unplayed placeholders.
   */
  BENCH_DESCENT_RECOVER_PER_TICK: { LIGHT: 0.0020, MAXIMAL: 0.0008 },

  /**
   * Terminal descent rate. A bar cannot gather speed forever, and without a
   * cap a player who lets go and never comes back at a maximal load arrives at
   * a rate the grading curve has no room left to describe.
   */
  BENCH_DESCENT_MAX_RATE: 0.075,

  /**
   * At or below this rate at the chest, the touch is fully controlled —
   * quality 1.
   *
   * ---------------------------------------------------------------------------
   * IT SITS AT OR ABOVE THE CONTROLLED RATE AT BOTH ENDS, WHICH IS THE STEER
   * ---------------------------------------------------------------------------
   * Under the beat this replaces, arriving soft meant the player had BRAKED,
   * and this threshold sat below the rate the bar started at so that braking
   * was the only way in. The 2026-08-25 replay steer inverts that: a bar
   * nobody let go of arrives at exactly `DESCENT_DEPTH_PER_TICK.bench`, and
   * that has to grade 1 or "hold to lower" would be a losing play at every
   * load. `liftTuning.test.ts` asserts the inequality at both ends.
   *
   * STILL LOAD-SCALED, AND THE REASON IS NARROWER THAN IT WAS. It is no longer
   * carrying an open-loop property — there is no rhythm to memorise once the
   * descent has no rhythm — but a limit bar that has been let go still has to
   * read as worse than a warm-up that has been let go by the same amount, and
   * a single threshold cannot do that.
   */
  BENCH_TOUCH_SOFT_RATE: { LIGHT: 0.030, MAXIMAL: 0.014 },

  /**
   * At or above this rate at the chest, the touch is a crash — quality 0.
   *
   * LOAD-SCALED FOR THE REASON `BENCH_TOUCH_SOFT_RATE` ABOVE IS, and kept a
   * fixed multiple of it at both ends (2x) so the graded band between "caught"
   * and "dropped" is the same SHAPE at every load while sitting at a different
   * SPEED.
   *
   * IT HAS TO BE REACHABLE AND IT HAS TO NOT BE THE DEFAULT, which is the same
   * two-sided requirement `DEPTH_WINDOW_MS`'s bench row failed on its first
   * pass. The default is now the OPPOSITE of what it was — a player who does
   * nothing but hold arrives perfectly — so what has to be checked is that a
   * player who lets go can still crash it from a working weight upward, and
   * cannot at the two lightest presets. `liftTuning.test.ts` derives both from
   * the constants; `lift.test.ts` plays them.
   */
  BENCH_TOUCH_CRASH_RATE: { LIGHT: 0.060, MAXIMAL: 0.028 },

  /**
   * How much harder a crashed touch makes the WHOLE bench ascent, at touch
   * quality 0. Scales the demand curve, exactly as `BURIED_DEMAND_PER_DEPTH`
   * does for a buried squat and `PRESS_WEAK_DEMAND_PENALTY` does for a limp
   * burst.
   *
   * A CONSEQUENCE THAT LASTS THE WHOLE ASCENT, NOT A TRANSIENT, and that is
   * the one thing about this beat that is not a guess. The press command's own
   * first version set only the bar's velocity off the chest, and velocity
   * chases net force — an initial value washes out in about
   * `1/VELOCITY_RESPONSE` ticks, so what looked like a decisive input decided
   * a scattering of reps in a pattern indistinguishable from noise. What says
   * the touch is not decorative is a swept count of reps whose OUTCOME it
   * changed — not a velocity written into the state.
   *
   * IT IS THE WHOLE OF WHAT THE DESCENT COSTS NOW, and it carries more weight
   * for it: the replay steer deleted the dawdle charge and the no-touch miss,
   * so a crashed arrival is the only thing a bench descent can be punished
   * for. Retuned alongside the demand curve to keep the touch deciding reps at
   * a rate the sweep can see without making a dropped limit bar unmakeable.
   * Unplayed placeholder.
   * `@guarantee bench-touch-decides-the-rep`
   */
  BENCH_TOUCH_DEMAND_PENALTY: 0.15,

  /**
   * Depth past the chest a crashed bar sinks, per unit of contact rate.
   *
   * DRAWING AND FLAVOUR, NOT A SECOND PENALTY. `BENCH_TOUCH_DEMAND_PENALTY`
   * above is what a crash costs; this is what it looks like. `extraDepth`
   * stays 0 on bench precisely so the sink is not charged a second time
   * through `BURIED_DEMAND_PER_DEPTH`, which is the double-count a reader
   * should check for and `lift.test.ts` pins.
   *
   * Chosen against `DEPTH_COLLAPSE.bench` at the WORST load, which is the
   * light end now that the crash rate is load-scaled: a touch at
   * `BENCH_TOUCH_CRASH_RATE.LIGHT` sinks 0.060 x 2.0 = 0.120, landing at 1.120
   * against a 1.15 clamp, so the clamp is a backstop for a bar that arrives
   * even hotter rather than the usual case. `liftTuning.test.ts` asserts that
   * relationship at both ends rather than trusting this sentence.
   */
  BENCH_TOUCH_SINK_GAIN: 2.0,

  // BENCH_DESCENT_PATIENCE_TICKS, BENCH_DESCENT_DAWDLE_SPAN_TICKS and
  // CHEST_TOUCH_TIMEOUT_TICKS WERE HERE AND ARE DELETED, not frozen. The block
  // header above says why in full; in one line each: the dawdle charge policed
  // a descent that could be slowed down, and one cannot be any more; the
  // timeout policed a descent that could be stopped, and one cannot be either.
  // A value read by nothing is worse than a magic number, because a playtester
  // turns it and nothing happens — the same reason `DEPTH_WINDOW_MS` lost its
  // bench row rather than keeping it at 120.

  /**
   * Extra demand per unit of depth past DEPTH_IDEAL. Being buried makes the
   * ascent harder rather than merely longer, which is the honest consequence.
   */
  BURIED_DEMAND_PER_DEPTH: 0.7,

  // -------------------------------------------------------------------------
  // Reversal out of the hole
  // -------------------------------------------------------------------------

  /**
   * Ticks spent at the bottom before the ascent begins, per kind. bench's
   * pair is slightly longer than squat's — the sport requires a visible
   * command pause at the chest — a placeholder, not measured.
   *
   * NO DEADLIFT ROW. There is no bottom to spend ticks at: the bar is already
   * there, and it is on the floor rather than under a braced lifter.
   */
  HOLE_TICKS: {
    squat: { LIGHT: 4, MAXIMAL: 12 },
    bench: { LIGHT: 5, MAXIMAL: 14 },
  } satisfies PerEccentricKind<{ LIGHT: number; MAXIMAL: number }>,

  // -------------------------------------------------------------------------
  // THE PRESS COMMAND AND THE CONTINUOUS GRIND — BENCH ONLY (GDD §6.2; ruled
  // 2026-08-25, steered 2026-08-25 by the phone replay)
  //
  // THE REPLAY STEER, VERBATIM: "The press command should allow you to
  // continuously tap to grind through." That answers the beat this block
  // shipped with, which was an 850ms burst window capped at 14 taps handing
  // off to a SECOND, separate layer of discrete `DRIVE — TAP` cues on the
  // ascent. Two tap layers with different rules, one after the other. The
  // steer replaces both with one: taps matter from the command until the rep
  // resolves or the bar beats you.
  //
  // WHAT MAKES BENCH A DIFFERENT LIFT AND NOT A RETUNED SQUAT. Still three
  // FACULTIES, and the steer sharpened rather than blurred them:
  //
  //   SQUAT     ANTICIPATION. The bar is moving down at a known rate and the
  //             player predicts the instant it reaches depth. ONE MOMENT.
  //   BENCH     SUSTAINED EXERTION. The bar comes down on its own, a command
  //             arrives at a moment that cannot be predicted, and from there
  //             the player's TAP RATE is the lifter's force for as long as the
  //             bar is moving. A RATE HELD OVER TIME.
  //   DEADLIFT  PERSISTENCE. The bar is locked out and the player must not
  //             stop holding it until the down command. NO INPUT AT ALL.
  //
  // Note what moved: bench used to be "CONTROL, then EXERTION", and the
  // control half was the descent. The replay steer de-skilled the descent, so
  // the faculty that separates bench from squat is now the grind alone. That
  // is a narrower claim than the block used to make and it is the true one.
  //
  // THE MODEL. One rolling quantity, `grindCharge`, and one curve on it:
  //
  //     every tick      charge *= GRIND_CHARGE_DECAY_PER_TICK
  //     counted tap     charge += 1
  //     always          force   = grindForce(charge)      // 0..1, saturating
  //
  // `force` is read TWICE and both readings are the same number seen at
  // different moments: at `PRESS_LAUNCH_MS` after the command it sets the
  // velocity the bar leaves the chest at (`PRESS_VELOCITY`), and on EVERY
  // ascent tick it adds `GRIND_BOOST_FORCE_MAX * force` to what the lifter has
  // (`lift.ts`'s ASCENT branch). There is no window to run out of and no cap on
  // how many taps a rep may contain — the ceiling is on the RATE.
  //
  // WHY THE CEILING IS ON THE RATE AND NOT ON A BUDGET, which is the
  // thumb-fatigue question the steer left open. A budget that runs down is a
  // hidden meter that makes a player weaker for reasons the screen never
  // showed them, which is the shape §12.3 refuses one level out; and it makes
  // "grind through" false, because a stall arriving after the budget is spent
  // could not be rescued at all. So sustained tapping is sustainable, and what
  // stops mashing from scaling is that `grindForce` saturates: past
  // `GRIND_CHARGE.CEILING` an extra tap is worth exactly nothing. The rep gets
  // harder the longer it grinds through `STALL_CAPACITY_DECAY_PER_TICK`, which
  // is the ascent's own existing term and applies to all three lifts.
  //
  // THE SEEDED DELAY SURVIVED BOTH ROUNDS, and that was a decision rather than
  // an omission (recorded in CLAUDE.md's 2026-08-25 entries). Nothing counts a
  // player down to the command, so when it comes is unguessable, and a grind
  // that starts late has less charge behind it when the bar leaves the chest.
  // Reaction is not graded as a separate term; it is folded into the launch.
  //
  // BENCH ARMS NO DRIVE CUE, and that is the half of the steer that deletes
  // rather than replaces. `DRIVE_*` still has bench rows because
  // `cueWindowMs('drive', config)` is a total function over `PlayableLiftKind`
  // and `session.ts`'s fatigue channel queries it per kind — but no bench rep
  // arms a cue, so those rows reach no bench rep's physics. Stated plainly
  // because a value read by nothing is worse than a magic number, and
  // `lift.test.ts` pins the absence at every load rather than leaving it here.
  //
  // Every value below is bench's only. Squat and deadlift read none of them.
  // -------------------------------------------------------------------------

  /**
   * How long the bar sits motionless on the chest before the command, in ticks.
   *
   * DRAWN FROM THE REP'S SEED, NOT FROM A CLOCK AND NOT FROM `Math.random`. The
   * delay has to be unpredictable or the burst degrades into an anticipation
   * check — a fixed pause is learnable in about three reps, and a learnable
   * pause is squat's mechanic wearing bench's name. Seeded means unpredictable
   * to the PLAYER while a rep stays a pure function of (config, seed, inputs),
   * which `lift.test.ts` pins.
   *
   * THIS IS NOT THE ROLLED OUTCOME `lift.ts`'s header refuses, and the
   * distinction is worth stating because a reader will reasonably ask. What is
   * rolled is WHEN THE TEST STARTS, never whether it is passed: at every delay
   * in this range a player who taps hard gets the same force and the same bar
   * speed. GDD §8.1's "100% skill- and consistency-driven" is about the
   * OUTCOME, and the outcome here is decided entirely by the grind. A
   * starter's pistol that fires at an unpredictable moment is not a dice roll
   * on the race.
   *
   * The range's floor is not zero: a command that can arrive on the same tick
   * the bar settles is indistinguishable from no pause at all.
   */
  PRESS_COMMAND_DELAY_TICKS: { MIN: 24, MAX: 96 },

  /**
   * How long the bar stays on the chest after the command before it leaves, ms.
   *
   * NOT A SCORING WINDOW, AND THE DIFFERENCE IS THE WHOLE STEER. The 850ms
   * burst window this replaces was the beat: taps inside it counted, taps
   * outside it did not, and when it shut the answer was final. This is a
   * LAUNCH BEAT — the time the bar spends being pressed into the chest before
   * it moves. Taps land in it and taps land after it, on the same rolling
   * charge, and nothing about it closes the grind. Shortened 850 -> 300 for
   * exactly that reason: there is no longer any need for it to be long enough
   * to hold a whole answer.
   *
   * IT IS STILL WHAT `cueWindowMs('press', config)` RETURNS, so `fatigue.ts`
   * narrows it exactly as it narrows the drive window (GDD §3.4, tighter when
   * fatigued), and it is still the ONLY channel fatigue reaches bench's
   * decisive beat through besides capacity: the charge curve itself is load-
   * and fatigue-independent, because how fast a thumb moves is a fact about
   * the player and not about the bar. A fatigued lifter gets less time on the
   * chest to build the launch, not a smaller ceiling.
   *
   * 300ms at 60Hz is 18 ticks. Against `GRIND_TAP_REFRACTORY_TICKS` that is
   * room for 6 taps, which at `GRIND_CHARGE`'s shipped decay settles at charge
   * **2.654 of a 2.9 ceiling — grind force 0.975**, so a player who mashes the
   * whole launch beat leaves the chest at essentially full speed and a player
   * who answers late leaves it slow, and neither has lost the rep. Not measured
   * by play; GDD §10 applies.
   *
   * THE SENTENCE THIS REPLACES SAID "a little over half of a full charge",
   * WHICH WAS FALSE. It was written against the 12-tick charge half-life this
   * file used to describe — see `GRIND_CHARGE_DECAY_PER_TICK`'s own correction,
   * where the same stale value produced the same class of wrong sentence. The
   * consequence a tuner would draw from the old wording is the opposite of the
   * truth: the launch beat is long enough to reach the ceiling, not half of it,
   * so shortening it is a real difficulty knob and lengthening it buys almost
   * nothing.
   */
  PRESS_LAUNCH_MS: 300,

  /**
   * Ticks that must pass between two counted taps.
   *
   * A FLOOR ON THE RATE THE SIM WILL BELIEVE, not a punishment. `stepLift`
   * accepts one input per tick, so without this a scripted or synthetic player
   * could throw 60 taps a second — and the mechanic would be measuring the
   * harness rather than the hand. 3 ticks is 50ms, or 20 taps a second: above
   * anything a thumb does, so a real player never meets it.
   *
   * Renamed from `PRESS_BURST_TAP_REFRACTORY_TICKS` with the burst it named.
   * Same value, same mechanism, and a name that describes the beat it belongs
   * to rather than the one it replaced.
   */
  GRIND_TAP_REFRACTORY_TICKS: 3,

  /**
   * The rolling charge's decay, per tick.
   *
   * ---------------------------------------------------------------------------
   * THIS IS WHAT MAKES THE GRIND A RATE AND NOT A COUNT
   * ---------------------------------------------------------------------------
   * A count only goes up, so a player who tapped hard once and then stopped
   * would keep the force forever — which is the burst this replaces, and it is
   * exactly what "continuously tap to grind through" is not. A charge that
   * decays every tick is worth what the player is doing NOW: stop and it falls
   * away in about a fifth of a second, which is what turns idle hands into a
   * stall and continued tapping into a rescue.
   *
   * ---------------------------------------------------------------------------
   * THIS PARAGRAPH DESCRIBED A VALUE THIS CONSTANT HAS NOT HELD FOR TWO ROUNDS,
   * AND IT IS CORRECTED HERE RATHER THAN TRIMMED
   * ---------------------------------------------------------------------------
   * It read "0.9439 is a half-life of 12 ticks (200ms) — `0.5 ** (1/12)`".
   * The shipped value is **0.9057**, which is `0.5 ** (1/7)`: a half-life of
   * 6.998 ticks, **116.6 ms**. Every clause of the old sentence was false of the
   * number sitting under it, including the one telling a tuner what arithmetic
   * produced it — and the sentence above it, "falls away in about a fifth of a
   * second", was written for the 200ms value and is nearer three half-lives of
   * the real one. `liftTuning.test.ts` bounds the half-life to 100-400ms, so
   * 116.6 ms is close to the fast end of what that guard allows, which is worth
   * knowing before turning it further down.
   *
   * Written out as the decimal rather than computed, so the file has no
   * arithmetic in it. A SHORTER half-life makes the grind twitchier and
   * compresses the spread between a mash and a jog — so it is a spread dial as
   * much as a responsiveness dial, and the two pull in opposite directions.
   * Unplayed placeholder.
   *
   * IT WAS CONSIDERED AND NOT MOVED IN THE 2026-08-26 DIFFICULTY RETUNE.
   * Shortening it is the obvious way to make a slow tapper's charge collapse
   * between taps, and measured against the guard's own floor the whole
   * available range (7.0 down to 6.0 ticks) is about a 10% change in what a
   * 3/s grind is worth — too small to be the difference the replay asked for,
   * and it would have been a third knob moving with the two that were.
   *
   * IT IS WHAT MAKES A STALL RESCUABLE, WHICH IS THE STEER'S OWN SENTENCE.
   * Force falls away when the player stops and comes back when they start
   * again, so a bar that has already stopped can be moved again — which is
   * impossible on an impulse mechanic by construction, because there is
   * nothing left to apply. `lift.test.ts`'s `RESCUE_SWEEP` measures it as
   * paired reps that differ only in whether the tapping resumed.
   * `@guarantee a-stalled-bench-can-be-ground-through`
   */
  GRIND_CHARGE_DECAY_PER_TICK: 0.9057,

  /**
   * The charge-to-force curve.
   *
   * `grindForce(c) = sat(min(c, CEILING)) / sat(CEILING)`, where
   * `sat(x) = x / (x + HALF_SATURATION)`.
   *
   * DIMINISHING RETURNS ARE THE SHAPE OF THE CURVE, NOT A CAP BOLTED ON TOP,
   * which is unchanged from the burst and is the half of the old beat the
   * steer explicitly keeps. The marginal force per unit of charge falls at
   * every point — **11.8 times** steeper over the first tenth of the charge
   * range than over the last, measured the way `lift.test.ts`'s knee check
   * measures it, or 13.2 taking the continuous derivative at 0 against the one
   * at the ceiling — so a player who cannot mash still gets most of the value
   * of trying and a player who can does not convert thumb speed into unbounded
   * force.
   *
   * ---------------------------------------------------------------------------
   * BOTH NUMBERS ABOVE AND THE WHOLE PARAGRAPH BELOW WERE FALSE OF THE SHIPPED
   * VALUES, AND THEY ARE CORRECTED RATHER THAN TRIMMED
   * ---------------------------------------------------------------------------
   * The first said "sixteen times steeper", which is what `(CEILING +
   * HALF_SATURATION) ** 2` comes to and not a ratio of anything; the real
   * figures are 11.8 and 13.2, and `lift.test.ts` pins only that the ratio
   * clears 8. The second read: "At this decay a tap every 4 ticks (15/s)
   * settles at charge 4.85 and a tap every 6 ticks (10/s) at 3.41, so a ceiling
   * of 4.5 is met by a fast human and beaten by nobody." At the SHIPPED decay
   * the steady charges are **3.057** and **2.232**, and the ceiling is
   * **2.9** — so all three numbers named a tuning that is not in the file, and
   * a tuner reading them would have set a ceiling (4.5) that no tap rate can
   * reach at all, because the refractory floor caps the steady charge at 3.89.
   *
   * CEILING IS A RATE A REAL THUMB CAN REACH, DELIBERATELY, AND THAT CLAIM IS
   * STILL TRUE OF 2.9. A tap every 4 ticks (15/s) settles at 3.057 and clears
   * it; a tap every 8 ticks (7.5/s) settles at 1.827 and does not — which is
   * exactly the two-sided bound `liftTuning.test.ts` asserts. The ceiling is
   * first met at a tap every 4.27 ticks, i.e. **14.1 taps a second**. A ceiling
   * only a machine could reach would put every real player on the steep part of
   * the curve forever, and "mashing caps" would be a sentence about a region
   * nobody visits.
   *
   * NEITHER MEMBER MOVED IN THE 2026-08-26 DIFFICULTY RETUNE, AND THE REASON IS
   * WORTH LEAVING FOR THE NEXT TUNER. Raising `HALF_SATURATION` is the knob
   * that would make a SINGLE isolated tap worth less — it is worth 0.66 of full
   * force today, which is why a bar at a rung whose margin is near zero goes up
   * for almost any tapping at all — but it also straightens the curve, and at
   * `HALF_SATURATION` 1.4 the knee ratio is already down to 8.6 against a pinned
   * floor of 8. There is not enough room in that knob to move the rung the
   * minimum-rate axis starts at.
   *
   * NO FALSE-START FLOOR LIVES HERE ANY MORE — see `GRIND_FALSE_START`. The
   * burst charged early taps against the tap COUNT and needed a floor on that
   * charge so a mashed pause could not kill a rep. A rolling charge has no
   * count to take from, so the rule was re-expressed as a delay with a cap,
   * and the cap is the floor's replacement.
   */
  GRIND_CHARGE: { HALF_SATURATION: 1.1, CEILING: 2.9 },

  /**
   * The false-start rule, as the continuous grind expresses it.
   *
   * ---------------------------------------------------------------------------
   * THE OLD ARITHMETIC HAD NOTHING LEFT TO SUBTRACT FROM
   * ---------------------------------------------------------------------------
   * "Each early tap costs a tap off your burst, down to a floor of three" was
   * a rule about a tap COUNT read at the end of a window. There is no such
   * count now — there is a charge that rises and decays and is read every tick
   * — so the sentence could not survive as arithmetic and was rewritten rather
   * than reinterpreted. `LIFT_COPY.SUBTITLE.bench` carries the new one and
   * `lift.test.ts` drives the sim against each of its clauses separately, the
   * same way it did against the old one.
   *
   * THE RULE NOW: taps thrown before the command count for nothing, and each
   * one delays the tick your taps START counting by `PER_EARLY_TAP_TICKS`,
   * capped at `MAX_LOCKOUT_TICKS`. So a player who mashes the pause leaves the
   * chest with less charge behind them, and their grind starts late.
   *
   * IT COSTS THE LAUNCH AND NEVER THE REP, which is what the old floor bought
   * and what the cap buys now — but it buys it a different way, and the
   * difference is worth naming. The floor guaranteed a MINIMUM FORCE at the
   * launch. The cap guarantees a MAXIMUM DELAY, after which the grind is
   * available for the whole rest of the rep, and the rest of the rep is where
   * a continuous grind is decided. A false-started player at a limit load can
   * still grind the bar through its sticking point; they just leave the chest
   * slowly. `lift.test.ts` sweeps that at every load rather than asserting it.
   *
   * 12 ticks is a fifth of a second at 60Hz, exactly, which is what the copy
   * says in words. Changing this number means changing that sentence.
   *
   * -------------------------------------------------------------------------
   * `MAX_LOCKOUT_TICKS` DROPPED 30 -> 12 ON THE 2026-08-27 RULING, AND THE
   * REASON IS A STRUCTURAL CONFLICT BETWEEN TWO GUARANTEES, NOT A DIFFICULTY
   * PASS
   * -------------------------------------------------------------------------
   * The third phone replay asked that RPE 9 be able to lose a player who is
   * "actually trying" — see `MAX_EFFORT` in `lift.test.ts`. Measured from the
   * source rather than guessed: a maximally false-started rep spends its first
   * `MAX_LOCKOUT_TICKS` of ascent with the grind shut, powered by nothing but
   * `LIFTER_CAPACITY` against the demand curve, and past some effective margin
   * those unpowered ticks alone are enough to start the stall spiral — the
   * false-start rule's own promise, "holds your press back", becomes "ends the
   * rep" there. That gives a FALSE-START WALL: the least effective margin at
   * which a 10-tap false start costs the rep. A separate MAX-EFFORT WALL is the
   * least effective margin at which a REALISTIC max-effort player (a real
   * captured cadence, not the engine's own countable floor) starts losing.
   * `a-false-start-can-never-pay` needs every reachable cell under the first
   * wall; the phone's ask needs some reachable cell at or above the second. At
   * 30 ticks the false-start wall (0.2777) sat BELOW the max-effort wall
   * (0.3764) — no margin threads both needles, because anything hard enough to
   * challenge a maxing-out player was already past where a false start ends
   * the rep outright.
   *
   * Twelve ticks is at or under `PRESS_LAUNCH_MS`'s own 18-tick beat, so a
   * maximally false-started rep still reaches the chest with SOME grind boost
   * already live rather than none. That moves the false-start wall to 0.3990 —
   * PAST the max-effort wall — so a margin exists (RPE 9's) that both walls can
   * agree on. `lift.test.ts`'s `MAX_EFFORT_WALLS` drives both numbers over the
   * shipped tree rather than quoting them, so a future retune that moves either
   * wall reddens there instead of leaving this paragraph quietly wrong.
   *
   * `GRIND_BOOST_FORCE_MAX` is refused as the lever here, per the ruling: it
   * sets the ceiling on what tapping is worth at all, and moving it would blur
   * which lever did the work.
   */
  GRIND_FALSE_START: { PER_EARLY_TAP_TICKS: 4, MAX_LOCKOUT_TICKS: 12 },

  /**
   * Thresholds a 0..1 QUALITY — not an offset — is turned into a `TimingGrade`
   * at. Both of bench's readings are read off this: the grind's force and the
   * touch's control.
   *
   * IT IS ONE TABLE ON PURPOSE, AND THE NAME IS THE SECOND VERSION OF IT. The
   * first was `PRESS_BURST_GRADE`, and the touch was graded against it — an
   * identifier claiming to be about the burst while deciding what a chest
   * touch reads as, which is the failure CLAUDE.md calls worse in a name than
   * in a comment, because nobody re-verifies a name the way they second-guess
   * a docstring. Renamed rather than duplicated: 'perfect' has to mean the
   * same fraction on both readings or the word stops meaning anything inside
   * one rep, and two knobs that must be turned together are one knob with a
   * bug waiting in it. A tuner who wants them apart should split this, and
   * should split the word with it.
   *
   * REUSING THE TIMING VOCABULARY FOR THINGS THAT ARE NOT TIMING, deliberately
   * and with two of its five members left unreachable. 'early' and 'late' name
   * directions neither a grind nor an arrival has — both are amounts, not
   * moments — and a grade that read 'late' for a weak grind would be an
   * identifier asserting something the code does not measure. So both grade
   * 'perfect', 'good', or 'missed', the last meaning the command went
   * unanswered or the bar was dropped, and `lift.test.ts` pins the two
   * unreachable members unreachable rather than leaving that as a claim.
   */
  QUALITY_GRADE_BANDS: { PERFECT: 0.8, GOOD: 0.5 },

  // PRESS_WEAK_DEMAND_PENALTY WAS HERE AND IS DELETED, and it is the deletion
  // a reader is most likely to think was a mistake, so it is written down.
  //
  // It scaled the WHOLE bench ascent's demand by how weak the burst was, and
  // it existed because the burst was a single reading taken at a single
  // moment: without a lasting consequence, a beat that only set the launch
  // velocity washed out in about `1/VELOCITY_RESPONSE` ticks and decided a
  // scattering of reps in a pattern indistinguishable from noise (measured at
  // the time: 40 of 240 outcomes moved on the transient alone, against 160
  // with the penalty).
  //
  // THE CONTINUOUS GRIND MAKES IT A SECOND, STALE CHANNEL. `GRIND_BOOST` is
  // read every ascent tick from a charge that decays, so a player who stops
  // tapping is already losing force this tick — there is nothing left for a
  // whole-ascent multiplier keyed to the FIRST 300ms to do except decide the
  // rep from a moment, which is the beat the replay steer replaced. Keeping
  // both would have meant the launch quietly deciding a rep the grind was
  // supposed to be deciding, and no assertion in the file would have noticed.
  //
  // `ascentDemand`'s `launchShortfall` parameter went with it. `touchShortfall`
  // stays: the descent has no per-tick channel into the ascent, so a crashed
  // arrival needs one or it decides nothing.

  /**
   * Force the grind puts into the bar, at grind force 1, in capacity units.
   *
   * ---------------------------------------------------------------------------
   * THE HALF THAT MAKES "GRIND THROUGH" MEAN FORCE, AND IT IS READ EVERY TICK
   * ---------------------------------------------------------------------------
   * `PRESS_VELOCITY` gives the bar SPEED off the chest and that is a transient.
   * This is the lifter PUSHING, and it is live: `drive += this * grindForce` on
   * every ascent tick, where `grindForce` is what the player's tap rate is
   * worth at that instant. Stop tapping and it falls away with the charge;
   * start again and it comes back. That is the rescue-from-stall property the
   * replay steer asked for, and it is arithmetic rather than a special case.
   *
   * NOT AN IMPULSE THAT DECAYS FROM ITS OWN TICK, which is what
   * `PRESS_BURST_BOOST_FORCE_MAX`/`_TICKS` were and why they are deleted. An
   * impulse pays once for a thing you did; this pays continuously for a thing
   * you are doing, and only the second one can be sustained through a stick.
   *
   * SIZED AGAINST THE STICKING POINT RATHER THAN AGAINST THE DRIVE CUE'S OWN
   * BOOST. At `LOAD_PRESETS.MAXIMAL` bench's peak demand is above the lifter's
   * capacity, so an untapped bar stops there; this has to be enough that a
   * sustained grind clears it and a jog does not. What says whether it is is
   * `lift.test.ts`'s `GRIND_SWEEP` and its reachable rescue table, not this
   * sentence. Unplayed placeholder, GDD §10.
   *
   * ---------------------------------------------------------------------------
   * RAISED TO 0.50 ON 2026-08-26 AND PUT BACK, AND THE SWEEP IS THE USEFUL PART
   * ---------------------------------------------------------------------------
   * It was raised to keep GDD §6.2's "jumping the call costs the launch and
   * never the rep" true after a demand rise that has since been walked back by
   * two thirds. At the shipped demand curve the guarantee holds here at 0.42
   * with room: a maximal false start at the heaviest attempt a meet can call
   * uses 138 of its 170 ascent ticks.
   *
   * THE SWEEP IS KEPT BECAUSE IT MEASURES SOMETHING NO OTHER KNOB DOES. This is
   * the one bench constant that raises the tap rate every rung demands WITHOUT
   * touching the warm-up boundary — a player who quits has no charge either
   * way, so `REACHABLE_WARMUP` reads 0 lost of 16200 at EVERY value below.
   *
   * ---------------------------------------------------------------------------
   * AND IT WAS THEN ASKED THE ONLY QUESTION THAT MATTERED — DOES IT RAISE RPE 8
   * — AND THE ANSWER IS ESSENTIALLY NO
   * ---------------------------------------------------------------------------
   * `DEMAND_BASE.bench`'s wall leaves RPE 8's tap floor low, and this was the
   * remaining candidate for lifting it. Measured at the shipped demand curve,
   * RPE 8's four cells, make floor and GOOD-LIFT floor:
   *
   *     boost   rpe8 make floors             rpe8 clean floors
   *     0.42    0.50 / 1.00 / 0.80 / 0.67    3.00 / 3.00 / 3.00 / 2.50  <- shipped
   *     0.41    0.50 / 1.00 / 0.80 / 0.67    3.00 / 3.33 / 3.00 / 3.00
   *     0.40    0.67 / 1.00 / 0.80 / 0.67    3.00 / 3.33 / 3.00 / 3.00
   *
   * Three of the four make floors do not move at all across that range; the
   * fourth moves ONE rung, from 0.50/s to 0.67/s, which is a tap every two
   * seconds becoming a tap every second and a half. Two clean floors move one
   * rung. AND `REACHABLE_RESCUE`'s RPE 8 ROWS ARE BYTE-IDENTICAL AT ALL THREE
   * VALUES — `[120,40,40] [160,60,60] [120,60,60] [120,40,40]` — so the axis on
   * which RPE 8 actually changed in this round does not respond to this knob at
   * all.
   *
   * WHAT IT COSTS, on the same three values: the false start at the reachable
   * ceiling uses 138 / 145 / 154 of its 170 ascent ticks. Going to 0.40 spends
   * HALF the remaining margin on GDD §6.2's "never fatal" guarantee to move one
   * cell one rung. The wider sweep says where the wall is:
   *
   *     boost   worst meet floor   false start at the ceiling   warm-ups lost
   *     0.50    10/s               100/170                          0
   *     0.42    10/s               138/170                          0  <- shipped
   *     0.41    10/s               145/170                          0
   *     0.40    10/s               154/170                          0
   *     0.38    12/s               170 MISS                         0
   *     0.35    15/s               170 MISS                         0
   *     0.30    unmakeable         170 MISS                         0
   *
   * (The `worst meet floor` column below 0.42 was taken on a coarser tap ladder
   * than the RPE 8 tables above; those three rows are disqualified by the
   * false-start column whatever their floors, so they were not re-taken.)
   *
   * SO 0.42 STAYS, AND THE HONEST READING IS THAT THE HEADROOM THIS CONSTANT
   * OFFERS IS NOT HEADROOM FOR RPE 8. It is real headroom for RPE 9 and 10 —
   * which do not need it — and for the meet, which is already at 10/s. The
   * sentence "the one knob that raises the tap rate without touching warm-ups"
   * is true and was worth finding; what it does NOT say, and this paragraph
   * does, is that the rung the ruling named is the one rung it barely moves.
   *
   * THE GUARANTEE THIS CONSTANT CARRIES IS THE TAP RATE DECIDING THE OUTCOME
   * RATHER THAN DECORATING IT, and `lift.test.ts`'s tap ladder is what measures
   * it, over 120 cases. The sweep figures above are measured elsewhere — in the
   * warm-up sweep and the false-start probe — and are deliberately outside the
   * tagged paragraph rather than excused on `UNPINNED_PROSE_NUMBERS`, because a
   * tag whose numbers must appear in one named body should not be made to reach
   * numbers that body has no business measuring.
   * `@guarantee bench-grind-decides-the-rep`
   */
  GRIND_BOOST_FORCE_MAX: 0.42,

  /**
   * Velocity the bar leaves the chest with, at grind force 0 and 1.
   *
   * THIS IS THE "BAR-SPEED CHECK OFF THE CHEST" HALF OF §6.2's LINE, and the
   * launch reading of the grind is what buys it: more charge behind you when
   * the bar moves is a faster bar off the chest.
   *
   * IT IS A TRANSIENT AND IS MEANT TO BE ONE. Under the burst this was half of
   * what the beat bought and needed a demand penalty beside it to matter at
   * all. Under the grind it is the smaller half by design — what decides the
   * rep is the force being applied while the bar is moving, and the launch is
   * how it starts rather than how it ends.
   *
   * MIN is deliberately below `REVERSAL_VELOCITY.MIN`: a bench that leaves the
   * chest on an unanswered command is slower off the bottom than a scruffy
   * squat reversal, which is the whole texture of a missed bench.
   */
  PRESS_VELOCITY: { MIN: 0.0004, MAX: 0.019 },

  /**
   * Velocity the bar leaves the hole with, at depth timing quality 0 and 1.
   * This is what a well-timed reversal actually buys: not points, speed.
   *
   * MAX is deliberately ABOVE the terminal velocity the force balance gives out
   * of the hole, so a clean reversal is momentum the lifter carries INTO the
   * sticking point and a scruffy one is not. It washes out over about
   * 1/VELOCITY_RESPONSE ticks, which is roughly how long it takes to reach the
   * stick — so depth timing matters exactly as far as the beat it belongs to
   * and no further.
   */
  REVERSAL_VELOCITY: { MIN: 0.001, MAX: 0.018 },

  // -------------------------------------------------------------------------
  // Ascent physics
  // -------------------------------------------------------------------------

  /**
   * THE ASCENT IS A FIRST-ORDER LAG, NOT FREE ACCELERATION.
   *
   *     vTarget = netForce * VELOCITY_PER_NET_FORCE
   *     v      += (vTarget - v) * VELOCITY_RESPONSE
   *
   * Written down because the first draft was free acceleration
   * (`v += net * accel`) and it could not produce a sticking point at all. A
   * bar that accelerates without bound builds so much speed in the easy part
   * below the stick that it coasts straight through the hard part: measured, an
   * UNDRIVEN maximal attempt locked out in 83 ticks with zero stalled ticks,
   * which is a cutscene with a button on it.
   *
   * With a lag the bar has a terminal speed for the force balance it is under,
   * so entering the notch it decays toward a NEGATIVE target and stops. That is
   * the whole mechanic, and it is why these two numbers are the least safe ones
   * in the file to nudge.
   */
  VELOCITY_PER_NET_FORCE: 0.06,

  /**
   * Fraction of the gap to the target velocity closed per tick. 0.08 is a time
   * constant of about 12 ticks — a fifth of a second — which is roughly how
   * long a real bar takes to respond to a change in drive. Higher is twitchier
   * and makes the drive input read as instant; lower makes it read as mush.
   */
  VELOCITY_RESPONSE: 0.08,

  /** Fastest the bar may rise. 0.03/tick = 33 ticks = 0.55 s for a full ascent. */
  MAX_RISE_VELOCITY: 0.03,

  /** Fastest the bar may sink once it has been beaten. */
  MAX_SINK_VELOCITY: 0.02,

  /**
   * Demand away from the sticking point, as a multiple of LIFTER_CAPACITY,
   * per kind. squat's MAXIMAL is 0.86, so even the easy part of a limit squat
   * is most of what the lifter has.
   *
   * ---------------------------------------------------------------------------
   * BENCH SET HIGHEST OF THE THREE (1.25), AND THAT IS THE EXACT REVERSE OF
   * WHAT THIS PARAGRAPH SAID UNTIL A CRITIC MEASURED IT
   * ---------------------------------------------------------------------------
   * It read "BENCH SET SLIGHTLY LOWER (0.80), WITH MORE OF THE LIFT'S
   * DIFFICULTY MOVED INTO THE STICK GAIN BELOW", and by the time it was read
   * the shipped value was 0.95 and the gain had moved DOWN, not up. A tuner
   * following it would have turned both knobs the wrong way — which is why
   * this is corrected rather than trimmed: this is the file GDD §10 expects
   * thirty hand passes over.
   *
   * WHY THE DIFFICULTY LIVES IN THE BASE ON BENCH, MEASURED RATHER THAN
   * REASONED. The 2026-08-25 replay steer made bench's input a SUSTAINED tap
   * rate rather than an impulse at a moment, and a rate can only be asked for
   * over a span. With the difficulty concentrated in a narrow stick, a player
   * who stopped tapping coasted out of the hard region on the charge they had
   * already banked and the bar never stalled anywhere a real session or meet
   * can reach. Moving it into the base makes the WHOLE press work, so stopping
   * costs ground everywhere — which is the only shape "continuously tap to
   * grind through" can have.
   *
   * Bench's base at `LOAD_PRESETS.MAXIMAL` is 1.167, above the lifter's
   * capacity on its own: a limit bench that is not being pressed does not
   * merely slow down, it does not move. Squat's is 0.808 and deadlift's 0.792
   * at the same preset, because both of those keep their difficulty in a
   * notch. Unplayed placeholder, GDD §10.
   *
   * ---------------------------------------------------------------------------
   * RAISED 1.25 -> 1.27 AND 0.38 -> 0.40 ON 2026-08-26: "RPE 8 IS JUST TOO EASY"
   * ---------------------------------------------------------------------------
   * A phone replay confirmed the mechanic and rejected the difficulty, naming
   * RPE 8 and asking for a rise across the board. Both endpoints moved by the
   * SAME +0.02, deliberately: `byLoad` interpolates linearly in `loadT`, so an
   * equal move at both ends is a UNIFORM +0.02 of demand at every load, and a
   * uniform shift is the only shape that raises the whole ladder without
   * re-ordering it. `REACHABLE_COUPLING`'s three pins do not move at all as a
   * result — a uniform shift preserves differences, and that coupling is a
   * difference.
   *
   * ---------------------------------------------------------------------------
   * IT WAS FIRST SHIPPED AT +0.06 AND THAT BROKE GDD §12.3's WARM-UP PROTECTION
   * ---------------------------------------------------------------------------
   * THE NUMBER A TUNER MUST NOT GUESS AT IS THE WALL, NOT THE STEP. At +0.06 a
   * player who tapped twice at RPE 7 and stopped LOST THE REP, in five of the
   * ten cells the two light rungs can prescribe. It shipped anyway, because the
   * table that was supposed to catch it sampled the quit instant no earlier
   * than 18 ticks after the command and every newly-lost rep was at offsets
   * 1-12. `REACHABLE.IDLE_FROM_TICKS` carries that finding; this constant
   * carries what it costs.
   *
   * ---------------------------------------------------------------------------
   * THE TABLE, RE-DERIVED 2026-08-26 AT ONE STATED CONFIGURATION — WHICH IS THE
   * CORRECTION, NOT THE DIGITS
   * ---------------------------------------------------------------------------
   * `STICK_WIDTH.bench = 0.22`, `GRIND_BOOST_FORCE_MAX = 0.42`, the shipped
   * pair. Every row below comes from that one configuration and from one run.
   * The version this replaces had rows taken at DIFFERENT widths and boosts
   * without saying so — its `+0.040` read `120` and its `+0.060` read `456`
   * against `132` and `330` here — so it was a column of numbers that could not
   * be reproduced by any single tuning and read as though it could. A tuner
   * comparing two rows of it was comparing three variables.
   *
   * Domain: `REACHABLE_WARMUP`'s held sweep — every RPE 6/7 cell, every quit
   * instant 1..180, three cadences, three seeds, **16200 reps**. It said 12600,
   * which was the domain before `MAX_QUIT_TICK` went from 140 to 180. Both
   * domains were run for this table and every row is identical across them, so
   * the stale label cost nothing here — it was not the cause of the bad rows,
   * and saying so is the point of having measured it rather than assumed it.
   *
   *     rise     lost (held)   lost (finger off at descent tick 1)
   *     +0.000       0                1218        (the pre-retune curve)
   *     +0.015       0                1674
   *     +0.020       0                1818        <- shipped
   *     +0.025       0                1998
   *     +0.030      60                2214
   *     +0.040      72                2550
   *     +0.060     330                3432        <- shipped for one commit
   *
   * -------------------------------------------------------------------------
   * RE-DERIVED A SECOND TIME AFTER THE WARM-UP FLOOR, AND FIVE OF EIGHT ROWS
   * HAD MOVED. THIS TABLE WAS THE FOURTH PLACE A PRE-FLOOR NUMBER WAS CARRIED
   * ACROSS THE FLOOR
   * -------------------------------------------------------------------------
   * The round that added `BENCH_WARMUP_FLOOR_MARGIN` re-took the crash-penalty
   * table for exactly this reason and wrote the hazard down one docstring away
   * — and then left this table alone. Every row above reproduces with the floor
   * DISABLED and five are wrong with it enabled, which is the signature of a
   * measurement carried across a change rather than re-run on it. The stale
   * readings were `+0.020` finger-off 2154, `+0.025` held 60, `+0.040` held 132
   * and finger-off 2838, `+0.060` finger-off 3654.
   *
   * THE FLOOR MOVED THE WALL, AND IT MOVED IT THE USEFUL WAY. The held wall was
   * between +0.020 and +0.025; it is now between **+0.025 and +0.030**. At
   * +0.025 the held column is **0** where it used to be 60 — so a rise this
   * document spent two rounds calling the first unsafe step now costs nothing,
   * and the floor bought one more step of headroom on precisely the axis the
   * 2026-08-26 ruling was about. Whether to SPEND that step is a human's call
   * and is not taken here.
   *
   * THE SECOND COLUMN IS THE ONE THAT CHANGES WHAT THIS BLOCK MEANS. It is
   * never zero — not even at the pre-retune curve — so the "wall" this table
   * locates is a property of the HELD descent only. See
   * `REACHABLE_WARMUP.SLIP_TICKS` for why that column exists and what it is
   * pinned at.
   *
   * THE HELD WALL IS BETWEEN +0.025 AND +0.030, which is where it was measured
   * rather than the "+0.022" this block used to interpolate to. Widening
   * `STICK_WIDTH.bench` moves it DOWN rather than up (that header has the
   * table); narrowing it does not move it up either.
   *
   * ---------------------------------------------------------------------------
   * AND `GRIND_BOOST_FORCE_MAX` DOES MOVE IT. THE OLD SENTENCE SAID IT "DOES
   * NOT TOUCH IT AT ALL", WHICH WAS TRUE AT THE ONE POINT IT WAS MEASURED AND
   * FALSE AS THE PROPERTY IT WAS WRITTEN AS
   * ---------------------------------------------------------------------------
   * Swept at `STICK_WIDTH.bench = 0.22`, both columns, boost 0.30/0.42/0.50:
   *
   *     rise     held                 finger off
   *     +0.025   60 /  60 /  60       3228 / 2274 / 1974
   *     +0.060  402 / 330 / 312       5412 / 3654 / 3084
   *
   * So it is flat in the immediate neighbourhood of the wall, which is where
   * somebody checked, and it swings the held count by a fifth two steps out and
   * the released count by nearly two fifths everywhere.
   *
   * THE REASON GIVEN WAS THE PART THAT WAS ACTUALLY WRONG, and it is why the
   * claim generalised: "a player who quits has no charge whichever way it is
   * set." Every quit instant in this sweep is at or after the first tap, so
   * every one of these players HAS charge — what they stop doing is adding to
   * it. A mechanism stated confidently is what carried a one-point measurement
   * into a general claim; the measurement was fine and the sentence around it
   * was not.
   *
   * SO THERE IS NO "LAST SAFE STEP" AND THIS BLOCK NO LONGER NAMES ONE. It named
   * +0.02, on the ANSWER-ONCE-AND-STOP axis, at the shipped width and boost —
   * and on the never-answered axis the same sweep turned at +0.010, four steps
   * lower. The fix for that was not a smaller step but
   * `BENCH_WARMUP_FLOOR_MARGIN`, because the reps being lost were ended by a
   * clock rather than by the curve. A wall quoted without its axis is a reading
   * wearing a limit's clothes, and this one sent two rounds looking for a step
   * size that would fix a timeout.
   *
   * AND THE FLOOR THEN MOVED BOTH AXES, WHICH IS WHY EVEN THE AXIS-QUALIFIED
   * VERSION HAD TO BE RE-MEASURED RATHER THAN RE-WORDED. On the held axis the
   * first costing step is now +0.030, not +0.025. On the never-answered axis
   * the turn is gone entirely — `leaves a warm-up alone` pins zero lost at the
   * shipped rise. Naming an axis is necessary and is not sufficient: a wall is
   * a reading of a TREE, and this one has been re-read on every tree that moved
   * it.
   *
   * WHY THE WALL IS THERE, WHICH IS THE PART THAT GENERALISES. The rungs are
   * stacked 0.044-0.060 apart in margin, because the bar-speed cue is worth
   * 0.06 of capacity per band and adjacent RPE choices differ little in load.
   * Measured on the reachable domain at the shipped values, the hardest cell
   * each rung reaches:
   *
   *     rpe6 -0.0923   rpe7 -0.0483   rpe8 -0.0025   rpe9 0.0448   rpe10 0.1048
   *
   * ALL FIVE RE-DERIVED 2026-08-26 AT THE SAME CONFIGURATION AS THE TABLE ABOVE
   * and all five reproduce exactly, which is worth a line because the rows above
   * them did not — a stale number beside a fresh one is the shape this file
   * keeps recording, and "the neighbouring paragraph was wrong" is not evidence
   * either way about this one.
   *
   * WHAT THE RE-DERIVATION DID CATCH IS ONE ROW UP. The old wall paragraph
   * closed "+0.02 ... with about 0.0025 of margin on the hardest warm-up cell",
   * and `-0.0025` is RPE 8's margin on this line, not a warm-up's — the warm-up
   * rungs are `-0.0923` and `-0.0483`, forty times further out. A number was
   * read off the wrong column of a table twelve lines away and given a
   * confident sentence to live in. It is deleted rather than repaired, because
   * the margin it was trying to describe is the one the table already states.
   *
   * The grind begins where a quiet rep starts losing the rep, and that boundary
   * has to sit ABOVE every RPE 7 cell and BELOW every RPE 8 one. The window
   * between the hardest RPE 7 cell and the lightest RPE 8 cell is 0.046 wide
   * here — wider than it looks, because the cells either side of it are the two
   * the rungs happen to place closest — and every one of the knobs above moves
   * BOTH ends of it together.
   *
   * WHAT THE RETUNE THEREFORE BOUGHT, STATED SO NOBODY OVERSELLS IT, on the
   * slowest sustained tap rate that never misses — before against after:
   *
   *     rpe8   0.50 / 0.67 / 0.50 / 0.50   ->   0.50 / 1.00 / 0.80 / 0.67
   *     rpe9   1.00 / 1.43 / 1.20 / 1.00   ->   1.20 / 1.67 / 1.43 / 1.20
   *     rpe10  2.31 / 2.00 / 2.00 / 2.00   ->   3.00 / 2.50 / 2.31 / 2.31
   *
   * and on the rate at which every seed is a GOOD LIFT rather than a GRINDER,
   * RPE 8 went 2.31 / 3.00 / 2.50 / 2.31 to 3.00 / 3.00 / 3.00 / 2.50. On
   * `REACHABLE_RESCUE`, RPE 8 went from two of four cells losing reps to four
   * of four. Three of the four cells rise on each axis; the lightest one does
   * not move on the make floor.
   *
   * THESE NUMBERS REPLACE A COARSER SET THAT WAS WRONG IN THE DETAIL. The first
   * write-up read "RPE 8 went 0.67/s at all four cells to 0.67 / 1 / 1 / 0.67",
   * measured on a tap ladder whose slow end stepped 0.67 -> 1.00 -> 1.43 with
   * nothing between. Rates of 0.50/s and 0.80/s were not on it, so cells sitting
   * there were reported at the nearest rung it had. The direction survived and
   * the detail did not, which is the ordinary way a measurement misleads: not by
   * being false, by being taken at a grain that cannot see the thing it is
   * about. The ladder now steps 0.50 / 0.67 / 0.80 / 1.00 / 1.20 / 1.43 at the
   * bottom.
   *
   * AND WHAT IT COULD NOT BUY. RPE 8 cannot be made to demand a FAST tap rate.
   * Its floor is 1.00/s at its hardest cell and 0.50/s at its lightest, and
   * pushing it further is what the wall above refuses. Lowering
   * `GRIND_BOOST_FORCE_MAX` was measured as the one remaining way to raise it
   * without touching warm-ups, and its own header records the answer: it moves
   * ONE of the four cells by ONE rung and leaves `REACHABLE_RESCUE` byte-
   * identical, for half the false-start margin. So RPE 8's difficulty is
   * "stopping costs the rep, and a slow grind is a GRINDER rather than a GOOD
   * LIFT"; the minimum-tap-rate axis begins at RPE 9.
   *
   * ONE RESIDUE, MEASURED AND NOT HIDDEN. At the shipped +0.02 exactly one of
   * the ten warm-up cells — `session/rpe7/0.8250/as-expected`, the heaviest
   * load the rung can prescribe — misses if the player never touches the screen
   * AT ALL after the command. One tap saves it, which is why
   * `REACHABLE_WARMUP`'s sweep (which starts at one tap) reads 0. The
   * pre-retune curve made that cell at zero taps too, and restoring that costs
   * the whole retune: at +0.0075, the largest step that keeps it, RPE 8's
   * floors are back to 0.67/s at three of four cells. Both numbers are here so
   * the trade is a decision somebody can take rather than a fact they discover.
   *
   * WHAT THIS NUMBER IS ACCOUNTABLE FOR, AND IT IS NOT A PRESET. The value it
   * replaced two rounds ago (0.95) put every stall and every lost rep at
   * `LOAD_PRESETS.MAXIMAL` — a point no producer emits — and left zero of both
   * in every training rep the game can prescribe. `lift.test.ts`'s
   * `REACHABLE_RESCUE` walks the loads `prescribeSession` and the meet's jump
   * ladder actually emit and pins where the grind bites per cell; restoring
   * either 0.95 or the pre-retune 1.25 here reddens that table, which is the
   * mutation recorded against `a-stalled-bench-can-be-ground-through`.
   *
   * NO SEPARATE TAG, AND THE ATTEMPT IS RECORDED. One was declared here and
   * pointed at the ceilings test beside that table; the flattening mutant left
   * that test green, because its stall-location half compares two constants.
   * The tag was deleted rather than re-aimed at a test another tag already
   * names.
   *
   * DEADLIFT SET LOWEST OF THE THREE (0.84), AND THAT IS THE OPPOSITE OF THE
   * FIRST GUESS. The first pass set it HIGHEST (0.90), reasoning that deadlift
   * is the only lift whose ascent starts from a dead stop with no momentum
   * bought by an input, so it should fight the base term from tick one.
   *
   * That double-charged the same idea. The dead start is ALREADY expressed, by
   * `FLOOR_BREAK_VELOCITY` being the lowest starting speed of the three — and
   * raising the base as well is two knobs turning together to look like one,
   * which is the exact antipattern `DRIVE_WINDOW_MS`'s own header warns about a
   * few entries down. Combined with the first pass's over-wide stick it made a
   * perfectly-driven maximal deadlift unwinnable (see `STICK_WIDTH`).
   *
   * So the base is now BELOW squat's 0.86: the deadlift's difficulty is
   * concentrated in a high, narrow stick and a dead start, not spread over the
   * whole pull. The LIGHT endpoint is squat's 0.42 unchanged. Reasoned, then
   * corrected against played reps; still a placeholder, GDD §10 applies.
   */
  DEMAND_BASE: {
    squat: { LIGHT: 0.42, MAXIMAL: 0.86 },
    bench: { LIGHT: 0.4, MAXIMAL: 1.27 },
    deadlift: { LIGHT: 0.42, MAXIMAL: 0.84 },
  } satisfies PerKind<{ LIGHT: number; MAXIMAL: number }>,

  /**
   * Extra demand at the peak of the sticking point, per kind. Added to
   * DEMAND_BASE. squat's MAXIMAL peak: 0.86 + 0.48 = 1.34 — comfortably above
   * capacity, which is why an undriven maximal attempt goes backwards.
   *
   * THIS IS THE NUMBER THAT MAKES THE GRIND EXIST. Set it low enough that
   * base + gain < LIFTER_CAPACITY at every load and the bar never stalls, the
   * drive input never matters, and the mechanic is a cutscene.
   * `liftTuning.test.ts` fails if that happens, for every kind in
   * `PLAYABLE_LIFT_KINDS`, not only squat.
   *
   * ---------------------------------------------------------------------------
   * BENCH'S GAIN IS THE SMALLEST OF THE THREE (0.15), AND THIS PARAGRAPH SAID
   * THE OPPOSITE UNTIL A CRITIC MEASURED IT
   * ---------------------------------------------------------------------------
   * It read "BENCH'S GAIN IS LARGER THAN SQUAT'S (0.55 vs 0.48) … bench's
   * MAXIMAL peak is 0.80 + 0.55 = 1.35, a comparable margin above capacity to
   * squat's, reached by a sharper stick rather than a higher base." Every
   * clause of that was false of the shipped tuning by the time it was read,
   * including the "comparable margin" — measured at `LOAD_PRESETS.MAXIMAL`,
   * bench's peak was 1.153 against squat's 1.238 and deadlift's 1.202, the
   * LOWEST rather than a comparable one.
   *
   * WHAT IS TRUE NOW, RE-MEASURED AT `LOAD_PRESETS.MAXIMAL` AFTER THE
   * 2026-08-26 DIFFICULTY RETUNE: squat 1.238, deadlift 1.202, bench 1.305.
   * Bench's is the largest margin above capacity of the three, and it is
   * reached the opposite way round from the other two — a high floor with a
   * shallow notch on it (endpoint 1.27 + 0.15) rather than an easy run-up into
   * a tall one.
   *
   * THIS PAIR OF NUMBERS WAS WRONG FOR ONE COMMIT AND IS CORRECTED HERE. It
   * read "bench 1.335 … (endpoint 1.30 + 0.15)" against a shipped endpoint of
   * 1.31 and a measured peak of 1.34518 — introduced by the same pass that was
   * correcting four OTHER stale numbers in this file, which is the shape worth
   * noticing: a correction pass is exactly when a new false number gets written,
   * because the numbers are being retyped rather than re-measured. Both figures
   * above are now taken from `byLoad` at the shipped endpoints.
   *
   * THIS GAIN DID NOT MOVE IN THAT RETUNE, AND THAT WAS A DECISION RATHER THAN
   * AN OVERSIGHT. Raising it raises the PEAK, and the peak is where GDD §12.3's
   * warm-up protection binds: RPE 7's hardest reachable cell sits at a LOWER
   * `loadT` than RPE 8's lightest, so any knob weighted toward heavy loads
   * closes the 0.016-wide window between them rather than opening it. The
   * difficulty went into `DEMAND_BASE` (a uniform lift, which preserves the
   * window) and `STICK_WIDTH` (which does not touch the peak at all).
   *
   * THE ASYMMETRY IS THE MECHANIC'S, NOT A DIFFICULTY SETTING. Squat and
   * deadlift are driven by `DRIVE_BOOST_FORCE_MAX` (0.62), an impulse thrown
   * at a cue and decaying from it, so it has to be big enough to carry a bar
   * through a notch on its own. Bench is driven by `GRIND_BOOST_FORCE_MAX`
   * (0.42), smaller but applied EVERY tick the player keeps tapping — so it
   * can hold a bar against a high floor for a whole ascent, which is what the
   * higher peak is asking it to do. Neither number has been played.
   *
   * DEADLIFT'S GAIN IS THE LARGEST (0.46) ON TOP OF THE SMALLEST BASE — peak
   * 0.84 + 0.46 = 1.30 at the endpoint, a comparable margin above capacity to
   * the other two, reached by a taller notch on an easier run-up rather than a
   * higher floor. What differs against the other two is WHERE the peak sits
   * (0.62 against squat's 0.34), not how bad it is; the three peaks themselves
   * are stated once, above.
   *
   * "STATED ONCE, ABOVE" IS THE FIX AND THE DIGIT WAS ONLY THE SYMPTOM. This
   * paragraph used to carry its own copy of the three peaks, ending "bench
   * 1.285" — thirty-four lines under a paragraph in the SAME docstring saying
   * `bench 1.305`. One docstring, one quantity, two numbers, and the retune
   * that re-measured the first copy had no reason to look at the second.
   * Correcting the digit would have left two copies for the next retune to
   * desynchronise, so the second copy is gone instead of fixed.
   *
   * Also the reverse of the first guess (0.42 gain on a 0.90 base), and for the
   * same reason recorded under `DEMAND_BASE`: difficulty spread across the whole
   * pull plus a wide stick left no winnable line at the top load.
   */
  DEMAND_STICK_GAIN: {
    squat: { LIGHT: 0.06, MAXIMAL: 0.48 },
    bench: { LIGHT: 0.05, MAXIMAL: 0.15 },
    deadlift: { LIGHT: 0.05, MAXIMAL: 0.46 },
  } satisfies PerKind<{ LIGHT: number; MAXIMAL: number }>,

  // -------------------------------------------------------------------------
  // The drive input — the beat this whole piece is about
  // -------------------------------------------------------------------------

  /**
   * Bar height at which the drive cue arms, per kind. Below the sticking
   * point, so the cue appears as the bar starts into the hard part rather
   * than after it.
   *
   * Height-anchored rather than time-anchored on purpose: the ascent's timing
   * depends on player input, so there is no tick known in advance at which the
   * bar reaches the stick.
   *
   * BENCH ARMS CLOSER TO ITS OWN (LOWER) STICKING POINT (0.10 vs squat's
   * 0.16, against STICK_HEIGHT_FRAC 0.20 vs squat's 0.34) — proportionally
   * similar lead-in gap to squat's, scaled to bench's shorter run-up to the
   * stick. Not measured.
   *
   * DEADLIFT ARMS LATEST (0.45), because its stick is highest (0.62). The gap
   * is 0.17 of the range against a stick width of 0.14 — 1.2 widths, matching
   * squat's 0.18 gap against its own 0.14 — so the cue appears the same
   * distance out from the fight on all three lifts rather than a fixed number
   * of height units before it. A first pass used 0.38 (1.7 widths), which armed
   * the cue so early that the boost had begun decaying before the bar reached
   * the stick.
   */
  DRIVE_ARM_HEIGHT: {
    squat: 0.16,
    bench: 0.1,
    deadlift: 0.45,
  } satisfies PerKind<number>,

  /**
   * Ms after arming at which the drive is perfectly timed. The window is
   * centred here, so tightening the window (fatigue) does not move the moment
   * being asked for.
   */
  DRIVE_IDEAL_LEAD_MS: 270,

  /**
   * Full width of the drive window, ms, at the light and maximal ends of the
   * load range — `byLoad` interpolates between them (see `descentRate` for
   * the identical pattern on the depth side). Fatigue (GDD §3.4) scales
   * WHATEVER this returns, same as before; load decides the base it scales.
   *
   * DEPTH_WINDOW_MS deliberately stays a single number: a heavier attempt
   * asks for more precision on the drive, not on the release, because the
   * drive is where a heavy rep is actually lost or won (GDD §12.1's phone
   * playtest already found the ascent the harder half). Tightening both
   * halves at once would be two knobs turning together to look like one.
   *
   * MAXIMAL's value is a placeholder for real playtesting, not a derivation:
   * 260ms keeps `DRIVE_IDEAL_LEAD_MS` (270ms) safely above half of it, so the
   * "open after arming, not before" invariant holds at every load without
   * being re-derived per load — `liftTuning.test.ts` checks that at both
   * endpoints, for every kind in `PLAYABLE_LIFT_KINDS`, rather than assuming
   * the middle is fine because the ends are.
   *
   * BENCH REUSES SQUAT'S JUST-PLAYTESTED PAIR RATHER THAN GUESSING A NEW ONE.
   * squat's precision axis (this constant) was the subject of Sprint 3's
   * Finding 1/Finding 2 phone re-tests and is the one piece of this file with
   * real human signal behind it. Bench has none yet, so starting from the
   * verified numbers is a more defensible placeholder than inventing a
   * different pair with no basis — explicitly not a claim that bench's
   * precision axis needs the same width, only that this is where a re-test
   * should start from.
   */
  DRIVE_WINDOW_MS: {
    squat: { LIGHT: 380, MAXIMAL: 260 },
    bench: { LIGHT: 380, MAXIMAL: 260 },
    // DEADLIFT REUSES THE SAME PAIR, for the same reason bench does: squat's
    // is the only pair in this file with human signal behind it, and this
    // piece adds no evidence about deadlift's precision axis. Explicitly not
    // a claim that the three lifts want the same window.
    deadlift: { LIGHT: 380, MAXIMAL: 260 },
  } satisfies PerKind<{ LIGHT: number; MAXIMAL: number }>,

  /**
   * Instant velocity added by a perfectly timed drive, scaled by quality.
   * The "pop" — separate from the sustained boost so the input has a moment as
   * well as a consequence.
   */
  DRIVE_IMPULSE_MAX: 0.005,

  /**
   * Force added by a landed drive, at quality 1, decaying linearly to zero
   * over DRIVE_BOOST_TICKS from the tick it was thrown.
   *
   * NOT GATED ON THE PLAYER CONTINUING TO HOLD. It used to be — "the hold is
   * the drive, not a button press" was this comment's own framing — and that
   * coupling was a defect a phone playtest found: landing a second or third
   * cue (the tap-rate mechanic) can only happen on a real device by releasing
   * and re-touching, and at MAXIMAL load an undriven bar's demand exceeds
   * capacity, so the old gate meant every release — measured down to the
   * fastest physically possible re-tap, 1 tick — killed the rep before a
   * second tap could land. A drive is a committed impulse once thrown, same
   * as a real press: it decays on its own clock, and releasing no longer
   * touches it. `lift.ts`'s ASCENT physics is the one site this reads from.
   *
   * THE STATIC ARITHMETIC IS NOT THE WHOLE STORY, and an earlier version of this
   * comment claimed it was. Instantaneously, the peak deficit is 0.24 at
   * LOAD_PRESETS.MAXIMAL and 0.34 at LOAD_RANGE.MAX, so on paper even a
   * half-quality boost (0.31) clears the limit preset. Measured, it does not: at
   * LOAD_PRESETS.MAXIMAL with an ideal-depth release the winning drive quality
   * starts at about 0.65, because the boost decays over DRIVE_BOOST_TICKS while
   * the bar is still travelling up to the stick and because STALL_CAPACITY_DECAY
   * has already taken a bite out of capacity by the time it arrives. That
   * measurement predates the hold-gate removal and is a claim about DECAY, not
   * about hold state, so it is unaffected by it — re-verified below.
   *
   * So this number and DRIVE_BOOST_TICKS decide the good-lift / grind / miss
   * split TOGETHER, and neither can be read on its own. `lift.test.ts` measures
   * the resulting winning band from played reps rather than deriving it here,
   * because that derivation is exactly what was wrong before.
   */
  DRIVE_BOOST_FORCE_MAX: 0.62,

  /** Ticks over which the sustained boost decays to nothing. */
  DRIVE_BOOST_TICKS: 45,

  /**
   * How many drive cues the ascent offers, light end and maximal end — the
   * tap-RATE half of the two dimensions a heavier attempt now demands more
   * of (the other is `DRIVE_WINDOW_MS`'s per-cue PRECISION). `byLoad`
   * interpolates, rounded to a whole cue count by `driveAttemptsFor`, never
   * below 1.
   *
   * THIS COMMENT USED TO SAY "raise it and the mechanic becomes a masher."
   * That was the design until a phone playtest (Sprint 3's gate) asked for
   * exactly this: heavier attempts should demand a rhythm, not only a single
   * well-placed instant. It is still not a masher in the sense the old
   * comment warned about — a missed cue costs velocity
   * (`MISTIMED_DRIVE_VELOCITY_PENALTY`) rather than ending the rep, and
   * mashing outside an armed cue's window does nothing at all, same as
   * today's single cue. What changed is that a maximal attempt asks for up
   * to `MAXIMAL` well-timed cues in sequence rather than one.
   *
   * RAISED AGAIN, SAME PLACEHOLDER STATUS. A second phone re-test (Finding
   * 2, Sprint 3's gate) confirmed the tap-not-hold shape was right but called
   * 3 cues too sparse to read as a drive — "a couple of isolated cues", not
   * "a run of taps through the sticking point". 3 → 6, paired with
   * `DRIVE_ATTEMPTS_SPACING_MS.MAXIMAL` tightening 380ms → 60ms (see that
   * constant's own header for why spacing had to move too, not cue count
   * alone). Structurally verified rather than assumed: the same
   * `liftTuning.test.ts` check this comment already cites re-measures the
   * worst-case sequence span at the new values — 2700ms against
   * `ASCENT_TIMEOUT_TICKS`'s 2833ms budget, 133ms of real margin, not zero.
   * `DRIVE_IDEAL_LEAD_MS` and `DRIVE_WINDOW_MS` are untouched — the phone
   * re-test's complaint was rate, not per-cue precision, and raising cue
   * count alone pushes against that same 2833ms ceiling regardless: even at
   * spacing 0, `DRIVE_IDEAL_LEAD_MS + DRIVE_WINDOW_MS.MAXIMAL/2`'s ~400ms
   * per-cue floor caps a worst-case sequence at 7 cues, so 6 is close to the
   * structural ceiling this file's other axes leave available, not a number
   * chosen by feel.
   *
   * A FINDING THIS RETUNE SURFACED, WORTH RECORDING RATHER THAN LEFT
   * IMPLICIT: under the OLD tuning, `driveAttemptsFor` returned exactly 2
   * at EVERY RPE `SESSION_TUNING.RPE_CHOICES` offers (measured directly,
   * `percentOf1RM(REPS_PER_SET, rpe)` for rpe 6-10: 81.1%, 83.7%, 86.3%,
   * 89.2%, 92.2% of e1RM, all rounding to 2 cues). So the tap-RATE axis
   * never actually differentiated a real player's RPE choice at all — only
   * `DRIVE_WINDOW_MS`'s per-cue precision did. That is plausibly part of why
   * 3 cues read as "isolated" rather than scaling with load the way the
   * player expected: light and heavy played identically on this axis. At
   * the new values the same five RPEs give 3, 4, 4, 4, 5 — real, if
   * compressed, differentiation across the ladder a player can actually
   * reach, not just between this file's abstract LIGHT/MAXIMAL endpoints.
   *
   * NO LONGER A PLACEHOLDER ON THIS AXIS — CONFIRMED BY A THIRD PHONE
   * RE-TEST, 2026-08-22, against this exact build. This file could not judge
   * whether 6 cues at 60ms spacing reads as "a run of taps" any more than it
   * could judge 3 cues at 380ms; a human tester on a real device, daily
   * session, now has: "reads as a run of taps through the stick", and light
   * versus heavy is now distinguishable on this axis where the old tuning
   * gave literally the same cue count (2) at every RPE the ladder offers —
   * see the finding recorded above. CLAUDE.md's Sprint 3 gate status records
   * the full result. Still a candidate for further tuning like any shipped
   * feel value — GDD §10's ~30-iteration expectation applies to this number
   * same as every other — but the specific complaint this retune answers is
   * closed, not merely built.
   *
   * ALL OF THE ABOVE IS SQUAT'S HISTORY, KEPT AS SQUAT'S HISTORY — it is not
   * evidence about bench. BENCH'S MAXIMAL IS A FRESH, UNTESTED PLACEHOLDER
   * (3, not 6): GDD §6.2 names bench's check as one "press-timing" event off
   * the chest, singular, not the sustained multi-cue rhythm squat's re-tests
   * specifically asked for — so starting bench lower than squat's freshly-
   * tuned 6 is the more defensible first guess, not a derivation. No phone
   * re-test has touched bench's tap-rate axis at all yet.
   */
  DRIVE_ATTEMPTS_PER_REP: {
    squat: { LIGHT: 1, MAXIMAL: 6 },
    bench: { LIGHT: 1, MAXIMAL: 3 },
    // DEADLIFT'S MAXIMAL IS 4, BETWEEN THE OTHER TWO, AND IT IS DELIBERATELY
    // NOT SQUAT'S 6. Deadlift's decisive input is at the TOP of the rep, not
    // in the ascent — a player who spends six taps getting to lockout arrives
    // with their finger mid-rhythm and has to clamp it down, which is the
    // transition the lockout hold is actually testing. Fewer ascent cues
    // leaves that transition legible instead of burying it in a tap run.
    // An untested placeholder, and the one deadlift number most likely to
    // move once the hold is played.
    deadlift: { LIGHT: 1, MAXIMAL: 4 },
  } satisfies PerKind<{ LIGHT: number; MAXIMAL: number }>,

  /**
   * Ms between one drive cue resolving (hit, mistimed, or left unpressed as
   * its window closes) and the next one being allowed to arm, light end and
   * maximal end. Irrelevant at LIGHT — `DRIVE_ATTEMPTS_PER_REP` rounds to 1
   * there, so no second cue ever arms to be spaced from — and is the actual
   * "rate" a maximal attempt is graded on: a player who cannot land cues
   * roughly this close together loses the sustained boost between them
   * (`DRIVE_BOOST_TICKS` decays independently of this).
   *
   * MAXIMAL TIGHTENED 380 → 60 ALONGSIDE `DRIVE_ATTEMPTS_PER_REP.MAXIMAL`'s
   * 3 → 6, not on its own — see that constant's header for the phone
   * re-test finding both moved together for. Cue count and spacing are the
   * same axis seen from two sides here: `ASCENT_TIMEOUT_TICKS`'s budget is
   * fixed, `DRIVE_IDEAL_LEAD_MS` and `DRIVE_WINDOW_MS` are untouched (the
   * re-test's complaint was rate, not precision), so more cues is only
   * reachable by shrinking the dead time between them. Spacing does NOT
   * shrink the player's per-cue reaction window — `DRIVE_IDEAL_LEAD_MS` and
   * `DRIVE_WINDOW_MS` still give every cue its own full telegraph-then-window;
   * this only shrinks how soon after one cue resolves the next is ALLOWED to
   * arm, which is the "gap between taps" half of what made 3 cues at 380ms
   * read as isolated rather than a run.
   *
   * BENCH'S PAIR IS ITS OWN FRESH PLACEHOLDER, LOOSER THAN SQUAT'S RETUNED
   * 60MS. With only 3 cues to fit (`DRIVE_ATTEMPTS_PER_REP.bench.MAXIMAL`)
   * against the same 2833ms `ASCENT_TIMEOUT_TICKS` budget, there is no
   * structural pressure to tighten this the way squat's 6-cue sequence
   * needed — worst case at 150ms spacing is 1500ms, 1333ms of margin. Not
   * measured against a human; a defensible starting point given the budget,
   * nothing more.
   */
  DRIVE_ATTEMPTS_SPACING_MS: {
    squat: { LIGHT: 600, MAXIMAL: 60 },
    bench: { LIGHT: 600, MAXIMAL: 150 },
    // Between the other two, matching deadlift's cue count sitting between
    // them. Worst case at 4 cues and 110ms is well inside the ascent budget;
    // `liftTuning.test.ts`'s span check covers it for every kind.
    deadlift: { LIGHT: 600, MAXIMAL: 110 },
  } satisfies PerKind<{ LIGHT: number; MAXIMAL: number }>,

  /**
   * Velocity lost by driving outside the window — too early, or after it has
   * closed. Costs the attempt as well, so patience is the skill being tested.
   */
  MISTIMED_DRIVE_VELOCITY_PENALTY: 0.004,

  /**
   * How far the bar-speed cue band moves the lifter's output, from the best
   * band to the worst. GDD §3.4 lists bar-speed cues first among the ways
   * fatigue may surface, and this is that surfacing on the mechanic's side.
   *
   * Deliberately small. The player's timing must stay the dominant term, or a
   * tired session stops being a harder version of the same skill test and
   * becomes a different, unwinnable one.
   */
  BAR_SPEED_CAPACITY_SPAN: 0.12,

  /**
   * Fraction of the window half-width inside which timing grades 'perfect'.
   * 0.34 of the half-width means the perfect band is about a third of the
   * window; the rest is 'early' / 'late' but still counts.
   */
  PERFECT_BAND_FRACTION: 0.34,

  // -------------------------------------------------------------------------
  // Ending the rep
  // -------------------------------------------------------------------------

  /**
   * Drop from the rep's highest point that counts as beaten. Once the bar has
   * gone this far backwards it is not coming back, and pretending otherwise
   * drags out a decided rep.
   */
  ASCENT_COLLAPSE_DROP: 0.14,

  /**
   * Hard cap on the ascent, in ticks. Reaching it is a miss, reason 'timeout' —
   * the lifter ran out of air.
   *
   * ALSO THE TERMINATION GUARANTEE. `lift.test.ts` plays 400 randomised input
   * scripts and asserts every one resolves; this is what makes that true even
   * for a force balance that happens to sit at a stable equilibrium.
   *
   * 170 ticks is 2.83 s of concentric, and the trade is two-sided: raise it far
   * and 'timeout' becomes unreachable and its copy becomes dead; drop it far
   * and it starts cutting off grinds that were going to make it, which is the
   * worse failure.
   *
   * -------------------------------------------------------------------------
   * THIS PARAGRAPH USED TO SAY 170 "CLIPS ONLY THE LONGEST CREEPS" AND CITE A
   * MEASURED MAXIMUM OF 201 IN THE SAME BREATH. IT CARRIED THAT CONTRADICTION
   * THROUGH FOUR RETUNE ROUNDS
   * -------------------------------------------------------------------------
   * The sweep was real and the number was right: across every load, depth and
   * drive offset, successful ascents ran to a maximum of **201** ticks, 99th
   * percentile 121. A cap of 170 sits BELOW that maximum, so by its own
   * measurement it was never clipping "only the longest creeps" — it was
   * cutting off ascents the sweep had already watched succeed, which is the
   * failure the sentence above calls the worse one. The reasoning and the
   * evidence were in the same docstring, one line apart, disagreeing.
   *
   * WHAT IT COST: a bench warm-up at `rpe7/0.8250/as-expected` — capacity
   * clearing peak demand by 0.048, bar at 80.8% of the way up — was called a
   * miss on the clock, and for a whole round that read as a DIFFICULTY question
   * about `DEMAND_BASE.bench`. Two rounds of curve sweeps went looking for a
   * step size that would fix a clock.
   *
   * -------------------------------------------------------------------------
   * WHAT 170 DOES AND DOES NOT COVER NOW
   * -------------------------------------------------------------------------
   * It is still the cap for squat, for deadlift, and for every bench bar that
   * is NOT under `BENCH_WARMUP_FLOOR_MARGIN`. Under that margin the ascent runs
   * on `BENCH_WARMUP_FLOOR_ASCENT_TICKS` instead, and this constant never sees
   * those reps.
   *
   * WHY 170 IS STILL RIGHT FOR SQUAT AND DEADLIFT AND WAS NOT FOR A LIGHT BENCH
   * BAR. It is a LOAD-CURVE fact, and the first version of this paragraph got
   * the mechanism wrong in a way worth recording, because the wrong mechanism
   * was reassuring and the right one is a warning.
   *
   * IT SAID squat and deadlift are cue-driven, so a rep that has not made it by
   * 170 ticks "has spent its cues and is not going to get another — there is no
   * channel left through which it could still complete". THAT IS FALSE.
   * `stepLift` opens the ascent with `let drive = capacity - m.stallCapacityLoss`
   * UNCONDITIONALLY, for every kind, before any cue or grind term is added. So
   * squat and deadlift have exactly bench's continuous balance between capacity
   * and demand; what bench adds on top is a maintained boost, not the balance
   * itself. A squat that has not locked out by 170 ticks is still being pushed
   * by the same term a bench is.
   *
   * WHAT ACTUALLY DIFFERS IS THE CEILING OF THE DEMAND CURVE. `DEMAND_BASE`
   * tops out at **0.86** on squat and **0.84** on deadlift against bench's
   * **1.27**. A bench bar can therefore sit far closer to capacity, for far
   * longer, than either of the other two can be made to; squat and deadlift
   * never produce an ascent slow enough to approach this cap, so it never binds
   * on them. Measured longest successful ascents run bench > squat > deadlift
   * on every harness that has driven them, though the digits depend on the
   * drive grammar and are quoted as a range rather than pinned: two independent
   * harnesses got squat 118 and 127, deadlift 51 and 108, bench 163 and 207.
   *
   * WHY THE DISTINCTION IS NOT PEDANTRY: the wrong version told a future tuner
   * that this defect cannot be recreated on squat, because squat has cues and
   * cues run out. It can. Raise `DEMAND_BASE.squat.MAXIMAL` toward bench's and
   * squat gets bench's problem, cues or no cues. `liftTuning.test.ts` pins all
   * three ceilings so that move reddens and asks whoever makes it to re-check
   * this clock.
   *
   * On bench, then, the cap was ending reps that had lost nothing — 193 ticks
   * at the slowest reachable warm-up, against a cap of 170.
   *
   * THE CLOCK IS "RAN OUT OF AIR", NOT A SECOND CRASH PENALTY. Ruled 2026-08-26
   * when the floor was made blind to how the rep was played: a crashed warm-up
   * gets the same floor, because the crash is already taxed through
   * `BENCH_TOUCH_DEMAND_PENALTY` scaling the whole ascent. Making the timeout
   * do that job as well would charge one mistake twice and hand the floor an
   * off switch a player could trip.
   */
  ASCENT_TIMEOUT_TICKS: 170,

  /**
   * -------------------------------------------------------------------------
   * BENCH WARM-UP FLOOR, RULED 2026-08-26: HOW FAR UNDER THE LIFTER A BAR HAS
   * TO SIT BEFORE THE CLOCK STOPS BEING ALLOWED TO DECIDE IT
   * -------------------------------------------------------------------------
   * `peakDemand - capacity` at the sticking point, both known before the rep
   * starts and neither touched by anything the player does. At or below this,
   * a bench bar is a warm-up MECHANICALLY rather than by which rung prescribed
   * it, and its ascent runs on `BENCH_WARMUP_FLOOR_ASCENT_TICKS` instead.
   *
   * THE RULING IT SERVES: "Never answering PRESS! on a held descent must still
   * make every RPE 6 and RPE 7 cell, including rpe7/0.8250. That is §12.3
   * warm-up protection, not a nicety. +0.02 stays on RPE 8 / 9 / 10 and meet."
   * So this floor may not reach a working rung, and the number is chosen to
   * make that structural rather than hoped for.
   *
   * -------------------------------------------------------------------------
   * THIS VALUE IS THE MIDPOINT OF A MEASURED GAP, AND THE GAP IS THE REASON —
   * NOT THE DIGIT
   * -------------------------------------------------------------------------
   * Measured over the reachable cells at the shipped tuning, as
   * `peakDemand - capacity` for the hardest cell each rung can prescribe:
   *
   *     rpe6 -0.0923   rpe7 -0.0483 | rpe8 -0.0025   rpe9 0.0448  rpe10 0.1048
   *
   * THE MEASUREMENT, STATED AS THE TWO EDGES IT RESTS ON:
   *
   *     every RPE 6/7 cell    at or below   -0.048
   *     nearest RPE 8 cell    at or above   -0.032
   *     the gap between them                 0.016
   *     this floor, its midpoint            -0.040
   *
   * So the rungs are separated in this quantity before anything is chosen, and
   * ANY value strictly inside that gap gives the same partition. That is what
   * makes this a boundary rather than a threshold tuned until the tests passed
   * — a distinction worth being able to check, so `lift.test.ts` pins BOTH
   * EDGES rather than only the digit. A retune that narrows the gap reddens
   * there; a retune that closes it means the floor can no longer separate
   * warm-up from working rung and the mechanism needs rethinking, not renumbering.
   *
   * THAT SENTENCE WAS FALSE FROM THE DAY IT WAS WRITTEN UNTIL 2026-08-27, AND
   * IT IS CORRECTED RATHER THAN QUIETLY MADE TRUE. No test anywhere in `src/`
   * mentioned -0.0483 or -0.0323, and nothing compared this constant to
   * anything except the other floor constant — so a retune that closed the gap
   * would have reddened nothing at all. `FLOOR_EDGES` in `lift.test.ts` is the
   * pin now, and it drives the producers rather than restating these digits.
   *
   * THE SECOND USE OF THIS SAME LINE, ADDED 2026-08-27. It now decides two
   * things rather than one: which clock the ascent runs on, and whether the
   * bar carries `BENCH_WORKING_RUNG_DEMAND_ONSET`. `benchWorkingExcess` is
   * `max(0, margin - this)`, so the two readings cannot disagree about a rep
   * by construction, and `lift.test.ts` drives that over all 40 reachable
   * cells rather than trusting the construction.
   *
   * PLACEHOLDER, like every feel value here. Nobody has played it.
   */
  BENCH_WARMUP_FLOOR_MARGIN: -0.04,

  /**
   * The ascent clock for a bar under `BENCH_WARMUP_FLOOR_MARGIN`, in ticks.
   *
   * WHY A SECOND CLOCK RATHER THAN A BIGGER `ASCENT_TIMEOUT_TICKS`: measured,
   * and the global version is refuted. At 220 for every lift the reachable
   * rescue table moves and RPE 8's own non-vacuity control halves from 12 to 6
   * — the unanswered reps the phone replay asked to COST the rep start making
   * again. A shared clock cannot separate the rungs; this one does, because
   * nothing above the floor margin ever reads it.
   *
   * -------------------------------------------------------------------------
   * ALSO THE MIDPOINT OF A MEASURED GAP, ON A SECOND AND INDEPENDENT AXIS
   * -------------------------------------------------------------------------
   * Measured by lifting the clock out of the way entirely and counting ticks of
   * ascent to lockout with ZERO taps after the command:
   *
   *     rpe6  87..129     rpe7 103..**193** | rpe8 **247**, 256, and two that
   *     never make it at all (they collapse at 0.119 and 0.178)
   *
   * THE MEASUREMENT AS IT STOOD, STATED AS THE TWO EDGES IT RESTS ON:
   *
   *     slowest RPE 6/7 unaided ascent        193 ticks
   *     fastest working-rung completion       247 ticks
   *     the gap between them                   54 ticks
   *     this clock, its midpoint              220 ticks
   *
   * -------------------------------------------------------------------------
   * THE WORKING SIDE OF THAT PAIR NO LONGER EXISTS, AND SAYING SO IS THE POINT
   * -------------------------------------------------------------------------
   * The 2026-08-27 working-rung lever puts every working cell's peak demand
   * above the lifter's capacity, so an unaided working rep goes BACKWARDS
   * instead of creeping. Re-measured by the same method — both clocks lifted
   * out of the way — the working side reaches lockout at NONE of its twelve
   * cells, where it used to reach it at two. So "fastest working-rung
   * completion 247 ticks" is now a sentence about a rep that does not happen,
   * and the separation is not 54 ticks wide any more: it is the difference
   * between a rung that always finishes and a rung that never does.
   *
   * THE GAP WIDENED RATHER THAN CLOSING, which is the condition the 2026-08-27
   * ruling attached to this lever ("if the change closes either gap, that means
   * the floor can no longer separate warm-up from working rung"). The warm-up
   * side is byte-identical, 87..193, because the lever adds those cells exactly
   * nothing — see `BENCH_WORKING_RUNG_DEMAND_ONSET`.
   *
   * WHAT IS HONESTLY WEAKER FOR IT: this used to be a SECOND, INDEPENDENT
   * separator agreeing with the margin one at a value it had not borrowed, and
   * that was the strongest thing about the pair. A categorical separator
   * ("finishes" against "never finishes") is easier to satisfy than a numeric
   * one, so it is now confirmation rather than corroboration. The margin edges
   * are what carry the claim, and they are unchanged because the lever reads
   * the base curve and does not write it.
   *
   * BOTH EDGES ARE PINNED IN `lift.test.ts` NOW, WHICH THEY WERE NOT WHEN THIS
   * SENTENCE FIRST CLAIMED THEY WERE. `FLOOR_EDGES` and its test are the pin;
   * before 2026-08-27 no test in `src/` mentioned 193, 247, -0.0483 or -0.0323
   * at all, and the only thing either floor constant was compared against was
   * the other one.
   *
   * AND `ASCENT_TIMEOUT_TICKS`'s OWN HEADER ALREADY CARRIED THIS DEFECT. It
   * records "successful ascents ran to a maximum of 201 ticks" and then caps at
   * 170 — below its own measured maximum — while the sentence beneath it says
   * that cutting off grinds that were going to make it "is the worse failure".
   * The number and the reasoning were both right there and disagreed with each
   * other, which is why the warm-up hole read as a difficulty question for a
   * whole round instead of a clock that was documented too short.
   *
   * PLACEHOLDER. Nobody has felt 3.67 s of concentric on a warm-up.
   */
  BENCH_WARMUP_FLOOR_ASCENT_TICKS: 220,

  /**
   * -------------------------------------------------------------------------
   * THE WORKING-RUNG LEVER, PART 1 OF 2: WHAT A BENCH BAR COSTS FOR BEING A
   * WORKING BAR RATHER THAN A WARM-UP, IN CAPACITY UNITS
   * -------------------------------------------------------------------------
   * PLACEHOLDER. Nobody has played it — GDD §12.1, and this file's own rule.
   *
   * Added to the demand curve for every bench rep whose base margin
   * (`peakDemand - capacity`, both fixed before the rep starts) sits ABOVE
   * `BENCH_WARMUP_FLOOR_MARGIN`, and added to nothing else. A warm-up gets
   * exactly zero of it, structurally: `benchWorkingExcess` is
   * `max(0, margin - BENCH_WARMUP_FLOOR_MARGIN)`, so it is non-zero exactly
   * where `benchClearsTheClock` is false. One classification, two effects — the
   * longer clock below the line, this above it.
   *
   * -------------------------------------------------------------------------
   * WHY THIS EXISTS: THE UNIFORM LEVER IS SPENT, MEASURED
   * -------------------------------------------------------------------------
   * `DEMAND_BASE.bench` was raised a uniform +0.02 on 2026-08-26 and a phone
   * replay rejected it a second time — "Still way too easy for RPE 8, overall
   * difficulty needs to be higher". The remaining uniform headroom is +0.005:
   * at +0.030 the held warm-up wall costs 60 reps of 16200 and at +0.025 it
   * costs 0. Those two readings are the RULING's, quoted from it rather than
   * re-taken here — the round that produced them is recorded in CLAUDE.md
   * under "PHONE REPLAY 2". A uniform rise moves every rung equally, so RPE 8
   * cannot be made to ask for a tap RATE without RPE 7 paying for it.
   *
   * -------------------------------------------------------------------------
   * THE SHAPE CHANGE IS THE STEP AT THE LINE, AND IT IS THE ONLY ONE. A RAMP
   * WAS SHIPPED HERE FOR ONE ROUND AND IS DELETED, WITH THE MEASUREMENT THAT
   * REFUTED IT
   * -------------------------------------------------------------------------
   * What makes this not `DEMAND_BASE` with an `if` in front of it is NOT a
   * slope. It is that the demand curve is no longer a single continuous
   * function of load: it has a DISCONTINUITY at a place `loadRatio` cannot even
   * locate, because the rungs overlap in load (see below). No value of
   * `DEMAND_BASE` produces that, and no value of it can add 0.045 to a working
   * bar and 0.000 to a warm-up. Inside the working band this lever IS uniform,
   * deliberately, and the ladder still compresses there — a fixed demand
   * addition costs more taps at a heavy load than a light one, because the
   * margin-to-tap-rate curve is convex.
   *
   * THE VERSION BEFORE THIS ONE CLAIMED THE COMPRESSION WAS A RAMP'S DOING, IN
   * THREE FILES, AND A CRITIC MEASURED IT THE OTHER WAY. Two more constants
   * stood here — `BENCH_WORKING_RUNG_DEMAND_SPAN: 0.018` and
   * `BENCH_WORKING_RUNG_DEMAND_HALF_MARGIN: 0.03` — making the addition
   * `ONSET + SPAN * excess / (excess + HALF)`, so it ran 0.0397 at the lightest
   * working cell to 0.0521 at the heaviest. Holding the MAGNITUDE constant and
   * removing only the ramp, as the spread of the twelve working cells' tap
   * floors (slowest / fastest):
   *
   *     no lever at all                       5.391
   *     step 0.036 + the ramp (shipped then)  3.471
   *     step 0.045 alone (this)               3.294
   *
   * The flat step compresses the ladder MORE. The ramp's net contribution to
   * the shape was -0.177 of spread — it un-compressed. Its own mutation test
   * was real and confounded: zeroing `SPAN` also removed up to 30% of the
   * addition, so the floors moved for a reason that was not shape.
   *
   * AND IT GAVE THE RUNG THE RULING NAMED THE LEAST HELP, which the deleted
   * comment defending it got backwards by confusing slope with magnitude. The
   * span's share of the total addition was 9-22% at RPE 8, 29% at RPE 10, and
   * 0% at two top meet cells, where the ceiling clipped below the onset.
   *
   * Deleted rather than re-justified: two placeholder knobs a human has to hand
   * tune across roughly thirty passes, worth at most 3 ticks on one cell, in
   * service of a property they measurably did not have.
   *
   * -------------------------------------------------------------------------
   * WHAT THIS BUYS, ON THE SLOWEST SUSTAINED TAP RATE THAT STILL MAKES THE REP
   * AT EVERY SEED — `WORKING_FLOOR` in `lift.test.ts`, which drives it
   * -------------------------------------------------------------------------
   * Per cell in `reachableSessionCells()` order, taps a second, before the
   * 2026-08-27 lever against after:
   *
   *     RPE 8    0.48 0.86 0.67 0.53  ->  1.07 1.58 1.36 1.07
   *     RPE 9    1.05 1.62 1.40 1.18  ->  1.82 2.31 2.07 1.94
   *     RPE 10   2.61 2.40 2.14 2.07  ->  3.53 3.33 3.00 2.86
   *     RPE 6, 7   no cadence makes any difference, before or after: the rep
   *                goes up on zero taps at every one of the ten cells.
   *
   * The ordering survives with room: RPE 8's hardest cell asks 1.58 a second
   * against RPE 9's easiest at 1.82, and RPE 9's hardest 2.31 against RPE 10's
   * easiest 2.86.
   *
   * A LOAD THRESHOLD WAS THE OBVIOUS MECHANISM AND IT IS IMPOSSIBLE HERE, WHICH
   * IS WHY THE GATE IS A MARGIN. The rungs OVERLAP in `loadRatio`: RPE 7 reaches
   * 0.8750 (`popping`) and RPE 8 starts at 0.8000, and 0.8750 is a cell on BOTH
   * rungs. No cut in load separates them. They are separated in
   * `peakDemand - capacity` — every RPE 6/7 cell at or below -0.0483, every
   * working cell at or above -0.0323 — because the check-in that raises the
   * prescribed load raises capacity further. That gap is the gate, it is the
   * same gap `BENCH_WARMUP_FLOOR_MARGIN` sits in the middle of, and
   * `lift.test.ts` pins both its edges.
   *
   * SIZED TO HOLD THE FLOORS THE RAMPED VERSION WAS GRADED ON rather than
   * chosen round: 0.045 is the magnitude the ramped lever averaged across the
   * working band, so the RPE 8 row above moves by at most one tick per cell
   * against the version a critic measured.
   *
   * -------------------------------------------------------------------------
   * RAISING THIS TO 0.100 WAS TRIED AND DELIBERATELY NOT SHIPPED, ON THE
   * 2026-08-27 LOCKOUT RULING'S OWN TERMS
   * -------------------------------------------------------------------------
   * That ruling's item 5 permits 0.100 to "ride" once the lockout change is in
   * and re-measured, "only if it does not reopen either floor-edge gap" — and
   * it does not: at 0.100 (ceiling unchanged, 0.27) the false-start rule still
   * holds with zero violations over all 40 reachable cells, and
   * `MAX_EFFORT_WALLS` is unmoved (both walls are set on the ladder's TOP,
   * past the ceiling, where the lever adds nothing regardless of `ONSET`).
   *
   * BUT THE RULING'S OWN ADMISSION STANDS: 0.100 "does not by itself meet this
   * round's bar (max-effort failure rate was still 0 everywhere under it)" —
   * confirmed again here. `MAX_EFFORT` reads 0 losses at every rung at 0.100,
   * identically to 0.045, because `BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING`
   * (0.27) caps every cell the lever touches well under the 0.3764 max-effort
   * wall regardless of `ONSET`'s value — see that constant's own header.
   *
   * WHAT SHIPPING IT WOULD HAVE COST, MEASURED RATHER THAN ESTIMATED: applying
   * 0.100 alone (ceiling untouched) reddens `TOUCH_SWEEP.SOFT_VS_CRASH_FLIPS`
   * (160 -> 180), `REACHABLE_RESCUE` (roughly a dozen of 40 cells move, in
   * both directions — some warm-side session cells get EASIER as the ceiling
   * absorbs more of the lever, some meet cells get HARDER as they are pushed
   * onto the ceiling), the two `REACHABLE_LADDER` counts derived from it, and
   * both `WORKING_FLOOR` vectors (22 session + 18 meet entries). No named
   * field currently censuses the "clipped but nonzero" population directly —
   * only `FLOOR_EDGES.CELLS_ALREADY_PAST_THE_CEILING` exists, and that names
   * the opposite group (cells the ceiling already zeroes out entirely, not
   * ones it clips to a smaller nonzero addition). A round that moves `ONSET`
   * for real would need to add that census rather than assume one exists.
   * That is a real re-pinning surface, each entry needing independent
   * re-measurement, in service of a change that does not itself close the
   * round's gap.
   *
   * SO IT STAYS AT 0.045. A future round that wants 0.100 should take it
   * together with whatever closes the max-effort gap for real — most likely a
   * higher `BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING`, which this round does
   * not authorise moving — rather than re-deriving this whole surface twice.
   */
  BENCH_WORKING_RUNG_DEMAND_ONSET: 0.045,

  BENCH_WORKING_RUNG_DEMAND_MARGIN_CEILING: 0.27,

  /**
   * Ticks standing at lockout before the rep resolves, per kind. bench
   * reuses squat's pair unchanged — no reasoned basis to differ found while
   * building bench's other constants, so kept equal rather than invented.
   *
   * ECCENTRIC LIFTS ONLY, AND THAT IS THE POINT OF THE RETYPE. On squat and
   * bench `LOCKOUT` is a fixed beat that asks the player for nothing — the
   * rep is already decided and this is the pause before the verdict. On
   * deadlift it is the whole check, and its length is
   * `DOWN_COMMAND_DELAY_TICKS` instead. A `deadlift:` row here would be a
   * number the sim never reads.
   */
  LOCKOUT_TICKS: {
    squat: { LIGHT: 8, MAXIMAL: 16 },
    bench: { LIGHT: 8, MAXIMAL: 16 },
  } satisfies PerEccentricKind<{ LIGHT: number; MAXIMAL: number }>,

  // -------------------------------------------------------------------------
  // THE LOCKOUT HOLD — DEADLIFT ONLY (GDD §6.2, "Deadlift — lockout grind")
  //
  // WHAT MAKES DEADLIFT A THIRD LIFT AND NOT A RETUNED SQUAT. The three checks
  // are three FACULTIES, not three sets of numbers:
  //
  //   SQUAT     ANTICIPATION. The bar is moving down at a known rate and the
  //             player predicts the instant it reaches depth. Failing it means
  //             predicting badly.
  //   BENCH     REACTION. The bar is still, a command arrives at a moment that
  //             cannot be predicted, and the player answers it as fast as they
  //             can. Failing it means being slow.
  //   DEADLIFT  PERSISTENCE. The bar is locked out and the player must simply
  //             not stop holding it, for a length of time they cannot know in
  //             advance, until the down command comes. Failing it means
  //             stopping early.
  //
  // The three are hard to confuse: one asks you to act at a moment, one asks
  // you to act fast, and one asks you to keep doing nothing. Deadlift is the
  // only one where the correct play at the decisive instant is to make NO
  // input at all, and the only one whose decisive beat is at the TOP of the
  // rep rather than the bottom.
  //
  // WHY THE PLAYER CANNOT JUST HOLD THE BUTTON DOWN THE WHOLE REP, which is
  // the obvious objection and the thing that would make this beat free. The
  // ascent asks for up to `DRIVE_ATTEMPTS_PER_REP.deadlift.MAXIMAL` taps, and
  // a tap on a real device is a release and a re-press — `Pressable`'s
  // `onPressIn` does not re-fire under a continuous hold, measured and
  // recorded in `DRIVE_BOOST_FORCE_MAX`'s own header. So a heavy pull arrives
  // at lockout with the player's finger in the middle of a tap rhythm, and
  // what is asked for is to STOP tapping and clamp. That transition is the
  // check. `LOCKOUT_GRIP_GRACE_TICKS` is what keeps it a transition rather
  // than a gotcha.
  //
  // WHY THE DOWN COMMAND'S TIMING IS DRAWN FROM THE SEED, and why that is not
  // GDD §8.1's forbidden dice. Identical argument to
  // `PRESS_COMMAND_DELAY_TICKS` one section up, with the sign flipped: what is
  // drawn is WHEN THE TEST ENDS, never whether it is passed. At every delay in
  // the range a player who keeps holding makes the lift, and at every delay a
  // player who lets go and stays off long enough does not. A fixed delay would
  // be learnable in about three reps, and the hold would silently become an
  // anticipation check — squat's faculty wearing deadlift's name, which is the
  // exact failure this beat exists to avoid.
  //
  // AND NOTHING TELEGRAPHS IT. `cueProgress` returns null for the whole of a
  // deadlift `LOCKOUT` — see `lift.ts` — so there is no shrinking ring
  // counting the player down to the command. A ring here would tell them
  // exactly how long they had left to hold, which is the same defect as a
  // countdown to bench's press command, and `lift.test.ts` pins it the same
  // way.
  //
  // Every value below is deadlift's only. Squat and bench read none of them.
  // -------------------------------------------------------------------------

  /**
   * How long the bar must be held locked out before the down command, ticks.
   * Drawn from the rep's seed, uniformly between MIN and MAX.
   *
   * MIN is a real hold rather than a formality: at 60 Hz, 36 ticks is 600 ms,
   * long enough that a finger already lifting off a drive tap has to come back
   * down deliberately. MAX is 96 ticks, 1.6 s — long enough that the player
   * cannot count it out, short enough that it is not dead air on every rep of
   * every set. The SPREAD is what makes it unguessable; a narrow spread would
   * be a fixed delay with noise on it.
   *
   * MAX IS ALSO HALF OF A §12.3 GUARANTEE, which is why it is not free to
   * raise. The longest possible beat is the longest a player can be off the bar
   * without the down command rescuing them, so `MAX - LOCKOUT_GRIP_GRACE_TICKS`
   * is the worst-case sag budget that `LOCKOUT_SAG_PER_TICK` has to stay under
   * at warm-up loads. It came down from a first-pass 132 partly to buy that
   * margin honestly instead of by shaving the sag rate until a light rep only
   * just survived. `liftTuning.test.ts` asserts the inequality directly.
   *
   * Not played. GDD §10's ~30-iteration expectation applies to both numbers,
   * and this pair is the likeliest in the block to be wrong: how long a player
   * will tolerate holding still is exactly the sort of question only a thumb on
   * a phone can answer.
   */
  DOWN_COMMAND_DELAY_TICKS: { MIN: 36, MAX: 96 },

  /**
   * Ticks between the down command firing and the rep resolving.
   *
   * WITHOUT THIS THE COMMAND IS NOT AN EVENT, IT IS A CUT, and the copy written
   * for it is unreachable. The first version resolved on the command tick
   * itself, which meant the state carrying `phase: 'LOCKOUT'` and
   * `tick >= downCommandTick` — the only state `promptFor` can return
   * `LOCKOUT_DOWN_COMMANDED` from — never existed. `DOWN` was a string in the
   * copy table that no frame could ever show, and the haptic fired on the same
   * tick the verdict replaced the screen.
   *
   * Found by a test looking for the command among the LOCKOUT-phase states and
   * finding none. Recorded because it is the shape this codebase keeps paying
   * for: the mechanism worked perfectly — the event fired, the delay was
   * seeded, the outcome was right — and the thing it was FOR did not happen.
   *
   * 20 ticks is a third of a second: long enough to read one word and feel the
   * two-beat haptic land, short enough that it is not a pause on a rep the
   * player has already won. Squat and bench spend a comparable beat here
   * (`LOCKOUT_TICKS`, 8-16 by load) doing the same job. Unplayed placeholder.
   *
   * THE HOLD IS OVER DURING IT. Letting go after the command costs nothing —
   * that is what the command MEANS — so the sag rules stop applying. A player
   * punished for putting the bar down after being told to would be being
   * punished for obeying.
   */
  DOWN_COMMAND_SETTLE_TICKS: 20,

  /**
   * Ticks at the start of a deadlift `LOCKOUT` during which letting go costs
   * nothing.
   *
   * THIS IS WHAT KEEPS THE HOLD A TRANSITION RATHER THAN A GOTCHA. The player
   * reaches lockout in the middle of a tap rhythm (see the section header), so
   * without a grace period whether the rep survived would be decided by which
   * half of a tap the bar happened to lock out on — a coin flip dressed as a
   * skill check, and one the player could not see coming.
   *
   * 10 ticks is ~167 ms, comfortably longer than the gap in a fast tap rhythm
   * and far shorter than `DOWN_COMMAND_DELAY_TICKS.MIN`. That second inequality
   * is load-bearing and is asserted in `liftTuning.test.ts`: if the grace ever
   * reached the minimum delay, a player could let go the instant they locked
   * out and never be charged for it, and the whole beat would be decoration.
   */
  LOCKOUT_GRIP_GRACE_TICKS: 10,

  /**
   * Height lost per tick that the player is NOT holding during a deadlift
   * lockout, past the grace period.
   *
   * LOAD-SCALED, AND THAT IS HOW GDD §12.3'S "NEVER PUNISH DAILY ENGAGEMENT"
   * IS MET STRUCTURALLY RATHER THAN BY HOPING. A warm-up deadlift CANNOT be
   * dropped however the player behaves, because the most sag the sim can
   * possibly produce at that load is less than the drop threshold:
   *
   *     byLoad(SAG, load) x (DOWN_COMMAND_DELAY_TICKS.MAX - LOCKOUT_GRIP_GRACE_TICKS)
   *         <  LOCKOUT_DROP_HEIGHT_LOSS
   *
   * MEASURED THROUGH `byLoad` AT THE PRESETS, NOT COMPUTED FROM THE ENDPOINTS,
   * because these are endpoints and this file's own header warns that reading
   * them as presets is the trap that catches everybody. The first draft of this
   * paragraph fell into exactly that trap: it quoted the LIGHT endpoint
   * (0.00018) as if a light rep saw it, concluded there was a 2x margin, and
   * the real margin at `LOAD_PRESETS.LIGHT` was HALF A TICK — 122.5 ticks to
   * drop against a 122-tick worst case. A guarantee with half a tick of margin
   * is not a guarantee, it is a coincidence that survived one sweep.
   *
   * The shipped numbers, measured through `byLoad`, with 86 ticks as the worst
   * case (96 - 10):
   *
   *     WARMUP   (0.40)  sag 0.000072  -> 695 ticks to drop   NOT DROPPABLE
   *     LIGHT    (0.55)  sag 0.000282  -> 177 ticks to drop   NOT DROPPABLE
   *     MODERATE (0.75)  sag 0.000803  ->  62 ticks to drop   droppable
   *     HEAVY    (0.88)  sag 0.001265  ->  40 ticks to drop   droppable
   *     MAXIMAL  (1.00)  sag 0.001769  ->  28 ticks (470 ms)  droppable
   *
   * MODERATE AND UP BEING DROPPABLE IS THE MECHANIC, NOT A BREACH. §12.3 is
   * about never punishing a player for showing up; a working set at 75% having
   * a real lockout check is the beat doing its job. What the rule buys is that
   * the warm-ups a daily session opens with are never a test.
   * `liftTuning.test.ts` asserts the inequality at WARMUP and LIGHT, and
   * `lift.test.ts` plays reps at both and pins the miss count at zero — the
   * arithmetic and the played rep, because either alone has been wrong here.
   * Placeholders; GDD §10 applies.
   */
  LOCKOUT_SAG_PER_TICK: { LIGHT: 0.00005, MAXIMAL: 0.002 },

  /**
   * How far the bar may sag below lockout before the rep is a miss, reason
   * 'dropped'.
   *
   * 0.05 of the range. Small, because this is not a second sticking point — the
   * bar is locked out and the only thing lowering it is the player having
   * stopped. Expressed as a height loss rather than as a tick count so that a
   * player who lets go, notices, and re-grips is judged on where the bar
   * ACTUALLY IS, which is what `LOCKOUT_REGRIP_RECOVERY_PER_TICK` makes
   * recoverable.
   */
  LOCKOUT_DROP_HEIGHT_LOSS: 0.05,

  /**
   * Height regained per tick once the player re-grips, until the bar is back at
   * lockout.
   *
   * DELIBERATELY FASTER THAN THE WORST SAG (0.004 against MAXIMAL's 0.0021), so
   * a slip is genuinely recoverable rather than a slow death the player watches
   * happen. A caught slip still costs — it is what `LOCKOUT_SLIP_GRIND_TICKS`
   * reads to call the make a grind — but it does not doom the rep, which is the
   * same rule the drive cue already follows: "A MISSED TAP COSTS VELOCITY. IT
   * NEVER ENDS THE REP ON ITS OWN."
   */
  LOCKOUT_REGRIP_RECOVERY_PER_TICK: 0.004,

  /**
   * Ticks of slipping (not holding, past the grace) at or above which a made
   * deadlift is called a grind rather than a good lift.
   *
   * THE MIDDLE OF THE THREE OUTCOMES, WITHOUT WHICH THE BEAT IS BINARY. Held
   * throughout: good lift. Let go, caught it, held the rest: grinder. Let go
   * and stayed off: no lift. 6 ticks (100 ms) is the same order as
   * `GRIND_STALL_TICKS`, which plays the identical role on the ascent side —
   * kept equal to it rather than invented separately, because "how much wobble
   * before it stops being clean" is one judgement, and two different answers to
   * it in one file would be a knob nobody could tune.
   */
  LOCKOUT_SLIP_GRIND_TICKS: 6,

  /**
   * Velocity the bar leaves the FLOOR with, light end and maximal end.
   *
   * THE ONE PLACE DEADLIFT IS DEFINED BY WHAT IT DOES *NOT* ASK FOR. Squat's
   * ascent velocity is bought by the depth release (`REVERSAL_VELOCITY`) and
   * bench's by the reaction (`PRESS_VELOCITY`). Deadlift's is bought by
   * nothing: it is a function of the load and the load alone, because there is
   * no preceding beat to have played well. A dead lift starts dead.
   *
   * That is a design statement rather than an oversight, and it is why this is
   * a `{LIGHT, MAXIMAL}` pair and not a `{MIN, MAX}` quality range like the
   * other two — there is no input quality to interpolate on. A deadlift's input
   * budget is spent at the top of the rep, not the bottom.
   *
   * MAXIMAL IS NOT ZERO, AND THE REASON IS WORTH STATING SO NOBODY "TIDIES" IT.
   * A maximal deadlift starting at literally zero spends several ticks under
   * `GRIND_STALL_VELOCITY` purely accelerating, and would be called a grind on
   * every single rep for a reason that has nothing to do with how it was
   * played. 0.0016 is above `GRIND_STALL_VELOCITY`'s neighbourhood by enough to
   * avoid that; `lift.test.ts` measures that a cleanly played maximal deadlift
   * can still come back 'good-lift'. LIGHT (0.011) snaps off the floor.
   * Placeholders; GDD §10 applies.
   */
  FLOOR_BREAK_VELOCITY: { LIGHT: 0.011, MAXIMAL: 0.0016 },

  /**
   * The drawing a deadlift borrows, because there is no deadlift sprite.
   *
   * AN EXPLICIT FALLBACK, DECLARED HERE SO IT CANNOT BE SILENT.
   * `LifterFrameSpec` in `src/art/lifterSprite.ts` draws two figures — a
   * front-on back squat and a side-on bench press — and building a third was
   * out of this piece's scope. A deadlift therefore renders as the SQUAT
   * figure.
   *
   * WHAT THAT LOOKS LIKE, STATED PLAINLY RATHER THAN LEFT TO BE DISCOVERED: the
   * pose tracks the bar correctly, because `lift.ts` derives `depth` as
   * `1 - height` through a deadlift's ascent, so the figure is folded over at
   * the floor and stands up as the bar rises — the right silhouette. But the
   * bar is drawn ON THE LIFTER'S BACK rather than in their hands. It is wrong,
   * it is known to be wrong, and it is tracked debt for an art piece, not a
   * claim that a deadlift is drawn.
   *
   * `liftFrame.ts` reads this constant rather than hardcoding `'squat'`, so the
   * day a deadlift figure exists there is one line to change and a test that
   * names it.
   */
  DEADLIFT_ART_FALLBACK_KIND: 'squat',

  // -------------------------------------------------------------------------
  // Grind classification — a make that was ugly
  // -------------------------------------------------------------------------

  /** Ascent velocity below this counts the tick as stalled. */
  GRIND_STALL_VELOCITY: 0.0025,

  /** Stalled ascent ticks at or above which a make is called a grind. */
  GRIND_STALL_TICKS: 6,

  /** Total ascent ticks at or above which a make is called a grind. */
  GRIND_ASCENT_TICKS: 80,

  /**
   * Capacity lost per STALLED tick, and the most that can be lost in one rep.
   *
   * WHAT THIS FIXES, because the bug it fixes is not obvious from the model.
   * Without it the force balance has a stable equilibrium just below the
   * sticking point: the bar sinks until demand falls back to capacity and then
   * HOVERS there — measured, an undriven maximal attempt sat at h 0.26 for 339
   * stalled ticks and only ended on the six-second timeout. Six seconds of a
   * motionless bar is not a failed squat, it is a hung frame.
   *
   * A lifter holding an isometric at their sticking point is losing, every
   * moment, and this is that. It only ever ticks while the bar is stalled, it
   * never recovers inside a rep, and it is what makes a beaten bar come DOWN.
   *
   * It also puts a real clock on a marginal drive: a rep that creeps for long
   * enough can still lose, which is where the tension in a grind comes from.
   *
   * NOT THE FATIGUE STAT. Nothing here reads or writes `fatigue.ts`. It resets
   * to zero on every rep, is never persisted, and is never rendered as a number
   * — the player sees it as the bar sinking. GDD §3.4 / §12.3.
   */
  STALL_CAPACITY_DECAY_PER_TICK: 0.0035,
  STALL_CAPACITY_DECAY_MAX: 0.3,

  /**
   * Rise per tick at or below which the decay accrues.
   *
   * DELIBERATELY LOWER THAN `GRIND_STALL_VELOCITY`, and the two must not be
   * merged. When they were one number, a bar that had been driven well enough
   * to creep through was charged decay during the ~12 ticks the first-order lag
   * took to reach its new target, which pulled capacity down, which lowered the
   * target, which charged more decay. A drive graded 'perfect' at 50 ms off
   * centre died to that spiral. Decay is for a bar that is NOT MOVING; the
   * grind threshold is for a bar that is moving slowly, and those are different
   * facts about a rep.
   */
  STALL_DECAY_VELOCITY: 0.001,

  // -------------------------------------------------------------------------
  // Bar path — the visible half of "heavy"
  //
  // Sagittal (FORWARD) is toward the toes and is NOT drawn as a horizontal
  // offset: the sprite is a front view. It reaches pixels through the sprite's
  // pitch channel. Lateral and tilt are frontal-plane and are drawn directly.
  // Same split, and the same reasoning, as BAR_PATH in `spriteTuning.ts`.
  // -------------------------------------------------------------------------

  /** Forward drift already present at the bottom of the descent, px. */
  BAR_FORWARD_AT_HOLE_PX: { LIGHT: 0.3, MAXIMAL: 1.8 },

  /** Peak extra forward drift during the ascent, px. */
  BAR_FORWARD_PEAK_PX: { LIGHT: 0.6, MAXIMAL: 4.2 },

  /**
   * How much a bar that is LOSING adds to the forward drift, px, at full
   * deficit. This is the term the canned animation cannot have: the drift here
   * responds to how badly this particular rep is going, not to its load alone.
   */
  BAR_FORWARD_STRUGGLE_PX: 1.6,

  /** Peak lateral offset of the bar centre, px. */
  BAR_LATERAL_PX: { LIGHT: 0, MAXIMAL: 1.0 },

  /** Share of BAR_LATERAL_PX that is a steady lean; the rest is the shake. */
  BAR_LATERAL_LEAN_SHARE: 0.5,

  /** Peak bar tilt, degrees. Positive = lifter's right side high. */
  BAR_TILT_DEG: { LIGHT: 0, MAXIMAL: 3.5 },

  /** Period of the grind shake, ticks. */
  WOBBLE_PERIOD_TICKS: 7,

  /**
   * Seeded per-tick jitter on the lateral shake, px. Set to 0 for a perfectly
   * repeatable-looking rep. The randomness is seeded and carried in the lift
   * state, so a rep is still byte-identical given the same seed and inputs.
   */
  WOBBLE_JITTER_PX: 0.35,

  /** Static sleeve droop, px. */
  BAR_BEND_PX: { LIGHT: 0.4, MAXIMAL: 3.4 },

  /** Extra droop per unit of upward acceleration (whip). */
  BAR_BEND_WHIP_GAIN: 220,

  /** Ceiling on droop, so the sleeves stay inside the sprite cell. */
  BAR_BEND_MAX_PX: 4.5,

  /** Load ratio at or above which the drive throws a chalk puff. */
  CHALK_MIN_LOAD_RATIO: 0.7,

  /** Ticks the puff lasts. */
  CHALK_PUFF_TICKS: 9,

  // -------------------------------------------------------------------------
  // How the sprite is strained by a LIVE rep
  //
  // The canned animation derives strain from load and phase alone. A played rep
  // has a third input the canned one cannot: whether it is currently losing.
  // -------------------------------------------------------------------------

  /** Strain from load alone, before phase weighting. */
  STRAIN_FROM_LOAD: { LIGHT: 0.16, MAXIMAL: 1.0 },

  /**
   * How much of that shows at each point in the rep.
   *
   * THESE ARE THE SAME NUMBERS AS `STRAIN.PHASE_WEIGHT` IN `spriteTuning.ts`,
   * restated here for the same reason `BAR_FORWARD_AT_HOLE_PX` and the rest of
   * the bar-path block are: the played rep and the canned animation are two
   * different consumers of one strain model. They may not disagree — the canned
   * rep is the inspection harness the sprite sheet is judged from, so a value
   * that drifts here makes the contact sheet stop describing the app —  and
   * `liftTuning.test.ts` asserts the shared keys are equal. The two keys the
   * canned table has and this one does not (ASCENT_STICK_BONUS / _WIDTH) are
   * the deliberate difference: a played rep gets its ugliest frame from
   * STRAIN_STRUGGLE_BONUS reacting to the bar actually losing, not from a
   * bump authored at a fixed height.
   *
   * BRACE AND DESCENT_TOP ARE THE SAME STANDING BODY and BRACE may not exceed
   * DESCENT_TOP. `spriteTuning.ts` carries the full argument and the rung
   * measurements; the short version is that the brace is the frame the screen
   * opens on and holds, it is the only beat with no motion cue to carry the
   * load, and at 0.25 every load from a 60 kg warm-up to a 220 kg single was
   * drawn with the identical untouched pose. Raising BRACE without raising
   * DESCENT_TOP with it makes the 0.88 default brace strained and then RELAX on
   * the first tick of the descent, which is a worse frame than the flat one.
   */
  STRAIN_PHASE_WEIGHT: Object.freeze({
    BRACE: 0.42,
    DESCENT_TOP: 0.42,
    DESCENT_BOTTOM: 0.75,
    HOLE: 0.88,
    ASCENT_BASE: 0.95,
    ASCENT_FALLOFF: 0.5,
    LOCKOUT: 0.3,
  }),

  /**
   * Extra strain when the bar is at a full force deficit. This is what makes a
   * stalling rep DRAW uglier than a moving one at the same height and load.
   */
  STRAIN_STRUGGLE_BONUS: 0.35,

  /** Force deficit, in capacity units, that counts as a full struggle. */
  STRUGGLE_FULL_DEFICIT: 0.3,

  // -------------------------------------------------------------------------
  // Haptics — GDD §9.1 calls these "critical to lift feel"
  //
  // NONE of these have been felt. They are a starting vocabulary.
  // -------------------------------------------------------------------------

  HAPTICS: Object.freeze({
    /** The press that starts the descent. */
    DESCENT_START: pattern({ style: 'soft', delayMs: 0 }),
    /** Depth reached and released cleanly. */
    DEPTH_PERFECT: pattern({ style: 'rigid', delayMs: 0 }, { style: 'light', delayMs: 60 }),
    /** Depth reached, timing off. */
    DEPTH_LOOSE: pattern({ style: 'soft', delayMs: 0 }),
    /** Came up out of a high squat. Legal-looking, and it is not. */
    DEPTH_HIGH: pattern({ style: 'warning', delayMs: 0 }),
    /** Reversal out of the hole. The thud. */
    REVERSAL: pattern({ style: 'heavy', delayMs: 0 }),

    /**
     * BENCH ONLY: the bar arrived on the chest under control.
     *
     * The descent's payoff beat. Two soft edges rather than `REVERSAL`'s single
     * heavy one, because a controlled bench touch is a settle and a squat's
     * reversal out of the hole is an impact — the hand should be able to tell
     * the two apart without looking.
     */
    CHEST_TOUCH_SOFT: pattern({ style: 'soft', delayMs: 0 }, { style: 'light', delayMs: 70 }),

    /** BENCH ONLY: the bar was dropped onto the chest. Heavy, and one edge. */
    CHEST_TOUCH_CRASH: pattern({ style: 'heavy', delayMs: 0 }),

    /**
     * BENCH ONLY: the press command.
     *
     * A STIMULUS, NOT DECORATION ON ONE. A thumb resting on glass feels a
     * haptic sooner than an eye reads a word, so on a device that has a motor
     * this is the channel the mechanic runs through and
     * `LIFT_COPY.PROMPT.HOLE_COMMANDED` is the confirmation rather than the
     * other way round.
     *
     * IT IS ALSO ABSENT ON THE PLATFORM THE BETA SHIPS TO, and that is written
     * here rather than left to be discovered: `haptics.ts` returns without
     * doing anything on web, because there is no motor behind a browser tab,
     * and GDD §10.0 scopes the beta to web/PWA. Phone playtest 4 was played
     * through a browser, so the command it rejected had no haptic at all. The
     * on-stage stimulus that has to carry the beat on that platform is piece
     * 2's, and it is not this constant.
     *
     * `rigid` and alone: a single sharp edge is what starts a burst. Every
     * multi-beat pattern in this table takes tens of ms to resolve into
     * something recognisable, which would be spent out of the player's window.
     */
    PRESS_COMMAND: pattern({ style: 'rigid', delayMs: 0 }),

    /**
     * BENCH ONLY: one counted tap of the grind.
     *
     * THE LIGHTEST PATTERN IN THE TABLE, AND IT HAS TO BE. This fires at up to
     * one per `GRIND_TAP_REFRACTORY_TICKS` for as long as the bar is moving —
     * the only entry here that repeats faster than `STALL_PULSE`, and since
     * the 2026-08-25 replay steer it can repeat for the whole ascent rather
     * than for one 850ms window — so anything with a second beat in it would
     * overlap itself and smear into a buzz.
     */
    GRIND_TAP: pattern({ style: 'light', delayMs: 0 }),

    /** BENCH ONLY: a launch that put real force into the bar off the chest. */
    PRESS_SHARP: pattern({ style: 'heavy', delayMs: 0 }, { style: 'light', delayMs: 70 }),

    /** BENCH ONLY: the bar moved, and not by much. */
    PRESS_SLOW: pattern({ style: 'medium', delayMs: 0 }),

    /** BENCH ONLY: tapped before the command. */
    PRESS_FALSE_START: pattern({ style: 'warning', delayMs: 0 }),

    /**
     * DEADLIFT ONLY: the grip is going. Fired repeatedly while the bar sags.
     *
     * DELIBERATELY THE SAME SHAPE AS `STALL_PULSE` AND FOR THE SAME REASON —
     * a rep that is being lost has to be FELT being lost, not discovered at the
     * verdict. `soft` rather than `rigid` so the two are not confused: a stall
     * is the bar fighting back, a slip is the lifter letting go, and they are
     * different failures with different fixes.
     */
    LOCKOUT_SLIP: pattern({ style: 'soft', delayMs: 0 }),

    /**
     * DEADLIFT ONLY: the down command. The end of the hold.
     *
     * NOT A STIMULUS THE PLAYER MUST ANSWER, unlike `PRESS_COMMAND`, and the
     * pattern says so. Bench's command is one sharp edge because every
     * millisecond of it comes out of a reaction window. This one asks for
     * nothing — the rep is already over when it fires — so it is allowed to be
     * a two-beat release rather than a single edge. It is a full stop, not a
     * starter's pistol.
     */
    DOWN_COMMAND: pattern({ style: 'medium', delayMs: 0 }, { style: 'soft', delayMs: 90 }),

    /** Drive landed in the window. */
    DRIVE_PERFECT: pattern(
      { style: 'heavy', delayMs: 0 },
      { style: 'medium', delayMs: 70 },
      { style: 'light', delayMs: 140 },
    ),
    DRIVE_LOOSE: pattern({ style: 'medium', delayMs: 0 }),
    /** Drive thrown outside the window. */
    DRIVE_MISTIMED: pattern({ style: 'warning', delayMs: 0 }),
    /**
     * Fired repeatedly while the bar is stalled. THE signature haptic of this
     * mechanic — a heavy squat that has stopped should be felt as a pulse, not
     * as silence.
     */
    STALL_PULSE: pattern({ style: 'rigid', delayMs: 0 }),
    LOCKOUT: pattern({ style: 'success', delayMs: 0 }),
    MISS: pattern({ style: 'error', delayMs: 0 }),
  }),

  /** Ticks between STALL_PULSE beats while the bar is stalled. */
  STALL_PULSE_PERIOD_TICKS: 9,

  // -------------------------------------------------------------------------
  // Presentation feel. Durations and geometry for the renderer, here rather
  // than in components for exactly the reason CLAUDE.md gives.
  // -------------------------------------------------------------------------

  FEEDBACK: Object.freeze({
    /** Cue ring: outer radius when the window opens, inner at the ideal moment. */
    CUE_RING_OUTER_R: 46,
    CUE_RING_INNER_R: 16,
    CUE_RING_STROKE: 3,
    /** Pulse period of the ring, ms. */
    CUE_PULSE_MS: 520,
    /** How long a hit/miss flash is held, ms. */
    HIT_FLASH_MS: 260,
    /** Screen shake amplitude at a full stall, px, and its period. */
    SHAKE_MAX_PX: 3,
    SHAKE_PERIOD_MS: 90,
    /** Outcome lights: how long each takes to come up, and the gap between them. */
    OUTCOME_FADE_MS: 220,
    LIGHT_REVEAL_STAGGER_MS: 180,
    /** How much larger than final a light starts, as a multiple. */
    LIGHT_POP_SCALE: 1.35,
    /** Bar-path trace: how many recent bar positions are drawn. */
    TRACE_MAX_POINTS: 220,
    /** Trace line width and the alpha of its oldest point. */
    TRACE_WIDTH: 2,
    TRACE_MIN_ALPHA: 0.08,
    /**
     * How many alpha bands the trace is drawn in. One path per tick would be
     * two hundred draw calls a frame for a fade that only has to read as one.
     */
    TRACE_FADE_BANDS: 8,
    /** Sprite upscale used by the lift screen. Integer; nearest-neighbour. */
    SPRITE_SCALE: 3,

    /**
     * =========================================================================
     * HOW LONG A FINGER MUST BE DOWN BEFORE THE GAME HEARS IT AT ALL
     * =========================================================================
     * ZERO, AND THAT IS A FIX RATHER THAN A DEFAULT. React Native Web's
     * `Pressable` delays `onPressIn` by `DEFAULT_PRESS_DELAY_MS` — 50 ms — and
     * a press RELEASED before that delay elapses produces NO `onPressIn` at
     * all. Not a late input: no input.
     *
     * MEASURED IN A REAL BROWSER, ON THE PLAYED SESSION SURFACE, DRIVING A
     * BENCH REP TO THE COMMAND AND THEN TAPPING FIVE TIMES:
     *
     *     press held  40 ms  ->  burstTaps 0
     *     press held 120 ms  ->  burstTaps 4
     *     press held 250 ms  ->  burstTaps 3 (and the rep reached LOCKOUT)
     *
     * The rep, the load and the cadence were otherwise identical; the only
     * thing that moved was how long each tap's contact lasted.
     *
     * WHY IT IS A DEFECT AGAINST THE 2026-08-25 RULING AND NOT A TUNING
     * PREFERENCE. The ruling's own words are that the press command "requires
     * rapid tapping to exert as much force as possible", and
     * `PRESS_BURST_TAP_REFRACTORY_TICKS` sets the mechanic's own floor at 3
     * ticks — 50 ms BETWEEN counted taps, which a player reaches with contacts
     * far shorter than 50 ms each. So the beat as shipped asked for a tap rate
     * the screen was structurally unable to hear, and the faster a player
     * mashed the more of their taps vanished. That is the opposite of the
     * mechanic's own saturating curve, which is designed so mashing CAPS
     * rather than fails.
     *
     * IT IS NOT ONLY THE ROBOT'S PROBLEM. `PressResponder`'s delay is applied
     * on `onResponderGrant`, which is the path a TOUCH takes as well as a
     * mouse — the only caller that skips it is the keyboard one. So a thumb on
     * a phone loses the same taps a driver does.
     *
     * HERE RATHER THAN IN `pressGuard.ts` because it is a duration a
     * playtester might want to move — the other three guards are structural
     * declarations with no number in them, and that file says so about itself.
     * `pressGuard.ts` reads this and spreads it; `liftInput.test.ts` requires
     * the spread on every press surface the repository has.
     */
    PRESS_IN_DELAY_MS: 0,

    /**
     * Most sim ticks the render loop will run in one frame.
     *
     * A hitch — a backgrounded tab, a garbage-collection pause — leaves a large
     * gap in the accumulator. Without a cap the loop empties it in one frame
     * and resolves the player's rep while they are not looking. Capping means a
     * hitch SLOWS the rep instead of skipping it, which is the right trade for
     * a timing game: lag is survivable, fast-forward is not.
     *
     * 4 ticks is 67 ms of catch-up per frame.
     */
    MAX_CATCH_UP_TICKS: 4,

    /**
     * =========================================================================
     * THE COMMAND BEAT, ON STAGE — EVERY KNOB IN ONE BLOCK
     * =========================================================================
     * PHONE PLAYTEST 4 (2026-08-24) MEASURED THIS BEAT'S WHOLE STIMULUS
     * INVENTORY AND FOUND ONE CHANNEL. At the press command: the haptic
     * `HAPTICS.PRESS_COMMAND` never fires on web (`haptics.ts` returns without
     * doing anything when the platform is web, and GDD §10.0 scopes the beta to
     * web/PWA); the stage was pixel-static across the command, measured with
     * the renderer's own `frameKey` at command minus 2, minus 1, the command
     * tick, plus 1, plus 3 and plus 6; no audio is wired into the rep loop at
     * all. What was left was a header text COLOUR — the channel this file's own
     * `HAPTICS.PRESS_COMMAND` doc calls the confirmation rather than the
     * stimulus. The 2026-08-25 ruling requires a clear, unmistakable PRESS
     * stimulus on web, not header colour alone.
     *
     * DEADLIFT'S DOWN CALL HAS THE SAME MEASURED GAP — 0 changed lifter pixels
     * — so it is in this block rather than in a second one. The two are the
     * same event shape (a command fires at a tick drawn from the rep's seed)
     * and `commandHit` in `liftFrame.ts` reads them through one predicate, so
     * the beat covers both by construction and cannot drift apart. What they do
     * NOT share is intensity: bench's is a starter's pistol answered inside a
     * reaction window, deadlift's is a full stop on a rep that is already over,
     * so each carries its own duration and peak.
     *
     * NONE OF THESE HAS BEEN PLAYED (GDD §12.1). They are placeholders shaped
     * so a tuner has one place to turn, and the phone replay is the gate.
     */
    STAGE_COMMAND: Object.freeze({
      /**
       * How long the hit is on screen, per command, in ms.
       *
       * BENCH'S IS COMPARABLE TO THE LAUNCH BEAT ON PURPOSE. `PRESS_LAUNCH_MS`
       * is 300; a wash much longer than that would sit on top of the grind
       * readout while the bar is already moving, which is the beat the readout
       * exists to report. The hit announces; the readout reports.
       */
      FLASH_MS: Object.freeze({ press: 260, down: 200 }),
      /**
       * Peak alpha of the full-stage wash, per command, at the command tick.
       *
       * A WASH RATHER THAN A LOCAL GLOW BECAUSE THE FAILURE WAS "I DID NOT SEE
       * IT", NOT "I SAW IT LATE". A local effect has to be looked at; a wash
       * reaches peripheral vision, which is where a player watching the bar
       * reads from. Kept well below 1 so the plate colours and the lifter stay
       * legible through it.
       */
      FLASH_PEAK_ALPHA: Object.freeze({ press: 0.34, down: 0.2 }),
      /**
       * The shock ring: it starts here and expands to `RING_MAX_R` as the wash
       * decays, centred on `LAYOUT.CUE_X` / `CUE_Y` — over the lifter, which is
       * where the eye is during the wait.
       *
       * IT EXPANDS WHERE `cueRing` CONTRACTS, and the opposition is the point:
       * a contracting ring is an anticipation cue (squat's, and bench's own
       * burst ring), and an expanding one is a thing that has just HAPPENED.
       */
      RING_MIN_R: 22,
      RING_MAX_R: 196,
      RING_STROKE: 6,

      /**
       * =====================================================================
       * THE WAIT, WHICH IS ARMED AND IS NOT A COUNTDOWN
       * =====================================================================
       * The seeded delay stays (`PRESS_COMMAND_DELAY_TICKS`) and nothing counts
       * the player down to it — that is the reaction identity, resolved inside
       * the 2026-08-25 ruling. What the ruling does not permit is the wait
       * being a DEAD channel, which is what phone playtest 4 measured it as.
       *
       * So the wait gets a ring at ONE radius that breathes on ONE period, and
       * both are constants here. `stageArmed` reads the tick and the phase and
       * nothing else — in particular it reads `pressCommandTick` and
       * `downCommandTick` only through "has it fired yet", so no amount of
       * watching it tells a player when the command is due.
       * `liftFrame.test.ts` pins that by building two states that differ only
       * in the scheduled command tick and asserting the armed value is
       * identical.
       */
      ARMED_RING_R: 62,
      ARMED_RING_STROKE: 2,
      ARMED_PULSE_MS: 780,
      ARMED_MIN_ALPHA: 0.16,
      ARMED_MAX_ALPHA: 0.66,

      /**
       * =====================================================================
       * THE GRIND READOUT — A ROW OF PIPS LIT BY THE TAP RATE
       * =====================================================================
       * WHAT THE 2026-08-25 REPLAY STEER CHANGED HERE. The row used to be one
       * pip per counted tap out of a per-rep tap cap, and both halves of that
       * are gone: there is no cap to be a denominator, and a running total
       * would rise forever on a continuous grind. `GRIND_READOUT_UNITS` pips
       * light in proportion to `grindForce`, so the row says HOW HARD YOU ARE
       * GRINDING RIGHT NOW and falls back when the player slows down. That is
       * the honest reading of a rolling rate, and it is what makes the row
       * move both ways.
       *
       * EVERY NAME IN THIS SUB-BLOCK SAID `BURST_` UNTIL THE RENDER PIECE, and
       * they named a beat that had already been deleted. `liftFrame.ts`'s
       * header carried that as declared debt with the reason (the names reach
       * three files the mechanic piece was scoped out of); this is it paid.
       *
       * STILL NOT A RATIO OF A FATIGUE-ADJUSTED QUANTITY, which is the §12.3
       * argument and is unchanged in substance. `grindProgress` carries no
       * window width and no denominator that fatigue has touched — the charge
       * curve is fatigue-independent. What it carries is the player's own
       * input rate, in exactly the category `chestApproach` is already in.
       *
       * THE TRAY IS NOT DECORATION. The pips sit over the gym room, which is a
       * rendered scene with its own colours; a dark plate behind them is what
       * makes a lit pip a lit pip against every room the stage can draw, and it
       * is what lets `verify-lift-press.mjs` count lit pixels inside a known
       * rectangle rather than hunting a hue across the whole canvas.
       */
      GRIND_READOUT_UNITS: 14,
      GRIND_PIP_W: 10,
      GRIND_PIP_H: 16,
      GRIND_PIP_GAP: 4,
      /**
       * Top of the pip row, in stage points.
       *
       * Above the sprite cell (`LAYOUT.SPRITE_Y` is 292) and below the top of
       * the stage, so the readout is in the same glance as the lifter without
       * covering him. Left of `LAYOUT.TRACE_X` by construction: the row is
       * centred on `LAYOUT.CUE_X` and `liftFrame.test.ts` asserts it clears the
       * bar-path panel rather than trusting the arithmetic here.
       */
      GRIND_PIPS_Y: 258,
      GRIND_TRAY_PAD: 5,

      /**
       * =====================================================================
       * THE TAP RAIL — ONE FLASH PER COUNTED TAP, WHICH IS WHAT MAKES THE ROW
       * READ AS A RATE RATHER THAN AS A PROGRESS BAR
       * =====================================================================
       * A row of pips that fills toward a full row reads as a COUNTER toward a
       * cap, which is the exact thing the steer deleted — and it reads that way
       * whatever the number behind it means. What a bar filling to the right
       * cannot show is the one fact the grind is made of: that a tap just
       * LANDED. So a thin rail under the tray flashes on every counted tap and
       * decays over `GRIND_KICK_MS`, and the visible rate of that flashing IS
       * the player's tap rate.
       *
       * IT IS DRAWN OUTSIDE THE TRAY, WHICH IS A MEASUREMENT CONSTRAINT AND NOT
       * A LAYOUT PREFERENCE. `verify-lift-press.mjs` counts lit-pip pixels
       * inside the tray rectangle; a flash drawn on top of the pips would move
       * that count and the tool would read the kick as pips.
       * `liftFrame.test.ts` asserts the rail clears the tray, the sprite cell
       * and the bar-path panel rather than trusting this sentence.
       *
       * `GRIND_KICK_MS` IS SHORTER THAN THE REFRACTORY GAP ON PURPOSE — 110ms
       * against `GRIND_TAP_REFRACTORY_TICKS`' 50ms floor is a little over two
       * taps' worth at the fastest legal rate, so a fast player's rail is a
       * bright continuous bar and a jogging player's is a visible blink. A
       * value at or below the refractory would blink at every rate and carry no
       * rate information; a value several times it would saturate at every rate
       * and carry none either. Unplayed placeholder, GDD §12.1.
       */
      GRIND_KICK_MS: 110,
      GRIND_KICK_GAP: 3,
      GRIND_KICK_H: 4,

      /**
       * =====================================================================
       * THE STALL BAND — BENCH'S URGENT BEAT, AND THE ONE THE MECHANIC'S
       * HEADLINE PROPERTY DEPENDS ON BEING LEGIBLE
       * =====================================================================
       * "Stop tapping and the bar stalls; start again and it comes back" is the
       * sentence the whole continuous grind exists for (GDD §6.2), and a rescue
       * a player cannot see the need for is a rescue they will not attempt. The
       * mechanic already counts the stall — `GRIND_STALL_VELOCITY` is the same
       * threshold `stepLift` increments `stallTicks` on — and until this block
       * nothing on the stage said so on a bench rep. What playtest 4 measured
       * about the command was that one channel is not enough; this is the same
       * lesson applied one beat later.
       *
       * A FULL-STAGE EDGE BAND RATHER THAN A LOCAL GLOW, for the reason
       * `FLASH_PEAK_ALPHA` gives about the command: a local effect has to be
       * looked at, and the player is watching the bar. An edge band reaches
       * peripheral vision from wherever the eye happens to be.
       *
       * DISTINCT FROM THE COMMAND'S OWN BEAT IN ALL THREE CHANNELS, which is
       * deliberate and is what keeps two urgent treatments from reading as one
       * event: the command is a WARM full-stage wash that DECAYS ONCE with a
       * ring EXPANDING out of the lifter; this is a COLD band at the stage's
       * EDGES that PULSES for as long as the bar is losing. One is news, the
       * other is a condition.
       *
       * NOT A FATIGUE METER (§12.3). It is on or off by the bar's velocity this
       * tick, it resets every rep, it is never persisted, and no constant
       * behind it comes from `fatigue.ts` — the same argument `chestApproach`
       * and `stallCapacityLoss` already make, restated where the drawing is.
       * `stallCapacityLoss` in particular is NOT what this reads: that scalar
       * is a per-rep accumulator and drawing it would be the meter with the
       * numerals filed off.
       *
       * `STALL_PULSE_FLOOR` KEEPS THE BAND FROM EVER REACHING ZERO ALPHA while
       * the bar is stalled, which is a legibility choice and also what gives
       * `verify-lift-press.mjs` a subject: a band that blinked fully off would
       * have frames indistinguishable from a stage that draws no stall at all.
       * None of these five has been played. GDD §12.1.
       */
      STALL_BAND_PX: 26,
      STALL_MIN_ALPHA: 0.24,
      STALL_MAX_ALPHA: 0.6,
      STALL_PULSE_MS: 300,
      STALL_PULSE_FLOOR: 0.5,

      /**
       * Where the bar glyph stops being drawn as controlled and starts being
       * drawn as running away, for the glyph's colour only.
       *
       * RENAMED FROM `BAR_WARM_AT` / `BAR_HOT_AT` WITH THE PALETTE ENTRIES THEY
       * PICK, and the rename is the honest half of the 2026-08-25 steer landing
       * on the drawing. The quantity behind them is `chestApproach`, which is
       * `1 - touchSpeedQuality` — the RATE the bar is carrying, not how near the
       * chest it is. Under the beat this replaced, "approach" was a fair word
       * for it because the player was steering that rate all the way down.
       * Under hold-to-lower they are not: holding is correct at every load and
       * arrives at quality 1, so the only thing these thresholds can ever
       * describe is a bar somebody LET GO OF. A name that reads as proximity
       * over a number that measures runaway is the identifier-misdescribes-its-
       * measurement failure CLAUDE.md rates above the same error in prose.
       *
       * BANDS ON A DRAWING, NOT A SECOND GRADING CURVE. The mechanic grades the
       * touch through `touchSpeedQuality`; these two numbers decide which of
       * three colours the bar is drawn in on the way down, and moving them
       * cannot change a single outcome. What holds that is STRUCTURAL, and
       * this sentence used to overstate it: it described a driven-rep check —
       * "each band edge moved to either extreme, resolution byte-identical" —
       * that has never existed. The real check is `liftFrame.test.ts`'s
       * source scan: `lift.ts` may not contain `BAR_RUNAWAY_AT`, `BAR_CRASH_AT`
       * or `barGlyphColour` by name, so the mechanic has no path to these
       * values at all — a stronger separation than a two-point sweep, and the
       * one the test can actually redden. (An inherited sentence, corrected
       * under the touch-the-module rule when the constants were renamed.)
       */
      BAR_RUNAWAY_AT: 0.34,
      BAR_CRASH_AT: 0.67,
    }),
  }),

  /**
   * LAYOUT — screen geometry, in logical points at phone scale.
   *
   * These are here rather than in a StyleSheet for the reason GDD §12.2 gives:
   * the bar for this piece is "readability at phone scale, not just fidelity",
   * which makes every one of these a value somebody will move by hand while
   * looking at a phone. Authored against a 390 x 844 viewport (iPhone 14).
   */
  LAYOUT: Object.freeze({
    /** The Skia stage. Everything the mechanic draws lives inside this. */
    STAGE_W: 390,
    STAGE_H: 520,

    /** Top-left of the lifter sprite inside the stage. */
    SPRITE_X: 6,
    SPRITE_Y: 292,

    /** Centre of the cue ring, over the lifter. */
    CUE_X: 150,
    CUE_Y: 374,

    /** The bar-path trace panel, a side-on plot down the right edge. */
    TRACE_X: 300,
    TRACE_W: 78,
    TRACE_TOP: 20,
    TRACE_BOTTOM: 500,
    /** Bar height at the top and bottom of that plot. Below 0 is a sunk bar. */
    TRACE_H_MAX: 1.05,
    TRACE_H_MIN: -0.2,
    /** Screen points per sprite pixel of forward drift. Exaggerated to read. */
    TRACE_PX_PER_DRIFT: 5,
    /** Half-width of the bar glyph drawn on the plot. */
    TRACE_BAR_HALF_W: 13,
    TRACE_GUIDE_DASH: 4,

    /**
     * Three white lights. Laid out by flex, so there is no Y here — an absolute
     * one would be a second source of truth that could disagree with the first.
     */
    LIGHT_R: 13,
    LIGHT_GAP: 42,
    LIGHT_STROKE: 2,

    /** Typography and spacing for the chrome around the stage. */
    SCREEN_PAD: 16,
    PROMPT_FONT: 15,
    HEADLINE_FONT: 26,
    DETAIL_FONT: 13,
    LABEL_FONT: 11,
    GRADE_FONT: 12,
    BUTTON_FONT: 13,
    BUTTON_PAD_V: 8,
    BUTTON_PAD_H: 12,
    BUTTON_RADIUS: 6,
    ROW_GAP: 8,
    LETTER_SPACING: 2,
  }),

  /**
   * DEMO LOAD — placeholder data so the mechanic can be played in isolation
   * (GDD §10 Prototype 1: "no progression, no meta, no backend").
   *
   * NOT PROGRESSION. Nothing here is persisted, nothing derives an e1RM or a
   * Total from it, and when there is a backend these come from the server
   * (CLAUDE.md, "Server-authoritative progression"). They exist so the sprite
   * has plates to draw and the player has something to pick.
   */
  DEMO: Object.freeze({
    /** The lifter's best single, kg. Load ratio is multiplied by this. */
    BEST_SINGLE_KG: 220,
    /** Loads offered on the screen, as a fraction of that best single. */
    LOAD_CHOICES: Object.freeze([0.55, 0.75, 0.88, 1.0]),

    /**
     * Which of those the screen opens on.
     *
     * NOT A DIFFICULTY SETTING — A REACHABILITY ONE, and it is the one value in
     * this block chosen against a measurement rather than a guess.
     *
     * GDD §10 Prototype 1 exists to answer one question: "does grinding a heavy
     * squat out of the hole feel satisfying in complete isolation?" A default
     * that never shows a playtester the grind cannot ask that question, and a
     * default they cannot get out of the hole at cannot either.
     *
     * Index 2 (0.88) is the LIGHTEST choice on the list that has a sticking
     * point at all. Peak demand at the stick, against a capacity of exactly 1:
     *
     *     0.55 -> 0.58    no stall, ever
     *     0.75 -> 0.81    no stall, ever
     *     0.88 -> 1.02    the bar wins unless it is driven
     *     1.00 -> 1.24    the bar wins decisively unless it is driven
     *
     * Below index 2 an undriven rep locks out clean with zero stalled ticks and
     * a net force that never goes negative — the drive input is decoration and
     * the mechanic is a cutscene with a button on it. At index 2 an undriven
     * ideal-depth rep still reaches lockout, but as a GRINDER, after an ascent
     * roughly two and a half times as long as the light one, with the net force
     * negative at the stick. So the first rep shows the grind whether or not the
     * player presses well, and pressing well converts it into a GOOD LIFT.
     *
     * WHY NOT INDEX 3. It is not that 1.00 is too hard — it is meant to be hard,
     * it stays on the screen one tap away, and nothing about it has changed.
     * It is that opening there means a playtester's first rep is a NO LIFT more
     * often than not, and a rep that dies before the ascent never shows them the
     * beat the prototype exists to test. Measured over the space of reps that
     * OBEY BOTH ON-SCREEN CUES — release inside the depth window, press inside
     * the drive window — 1.00 makes 28% of the time and 0.88 makes 89%.
     *
     * NOTHING HERE SAYS 0.88 FEELS RIGHT. It says the question is reachable
     * from it. `lift.test.ts` measures both of the properties above from played
     * reps, so moving this index to a load with no sticking point, or to one a
     * cue-obedient player rarely makes, fails a test instead of shipping.
     */
    DEFAULT_LOAD_INDEX: 2,
    /** Weight is rounded to this before the plates are drawn, kg. */
    ROUND_TO_KG: 2.5,
  }),

  // -------------------------------------------------------------------------
  // Precision
  // -------------------------------------------------------------------------

  /**
   * NOT A FEEL VALUE. Decimal places used to scrub IEEE-754 noise out of state
   * that is compared across ticks. Here only because the brief is that this
   * module has exactly one constants block.
   */
  PRECISION_DECIMALS: 6,
});

/**
 * Player-facing copy. Out of the numeric block so that block stays purely
 * numeric for whoever is turning knobs.
 */
export const LIFT_COPY = Object.freeze({
  PROMPT: Object.freeze({
    // DEADLIFT'S BRACE LINE DOES NOT SAY "HOLD", AND THAT IS DELIBERATE. The
    // other two lifts ask for a hold here because holding is what lowers the
    // bar. A deadlift's brace ends with the bar leaving the floor, and the
    // player's finger has to be free again almost immediately to tap the
    // ascent's drive cues — so the instruction is a pull, not a hold, or the
    // first thing the game teaches a deadlifter is the wrong grip habit for
    // the beat that decides the rep.
    BRACE: {
      squat: 'TAP AND HOLD TO DESCEND',
      // BENCH'S LINE SURVIVED THE 2026-08-25 REPLAY STEER UNCHANGED, AND IT IS
      // WORTH SAYING WHY, because every other bench line moved. "TAP AND HOLD
      // TO LOWER" is still exactly true: the tap starts the descent and the
      // hold is what keeps the bar under control the whole way down. What
      // changed underneath it is which way the hold pushes — it used to FEED
      // the bar down and now it RECEIVES it — and this sentence is true of
      // both, which is the one place in this table that is a coincidence
      // rather than a decision.
      bench: 'TAP AND HOLD TO LOWER',
      deadlift: 'TAP TO PULL',
    } satisfies PerKind<string>,
    // ECCENTRIC LIFTS ONLY — `PerEccentricKind`, not `PerKind`. A deadlift
    // never enters `DESCENT` or `HOLE`, so a `deadlift:` line here would be
    // copy nothing can render. `promptFor` documents what it does if it is
    // somehow handed the impossible state.
    // BENCH'S LINE NAMES THE ONE THING THE PLAYER MUST NOT DO, WHICH IS ALL
    // THE DESCENT ASKS OF THEM NOW. "TOUCH THE CHEST" described the first
    // beat, where the player released at a depth. "EASE IT DOWN" described the
    // second, where the finger fed the bar down and lifting it braked — a verb
    // for a steering job. The 2026-08-25 replay steer deleted the steering:
    // "the descent should be less of a question on how far to go down, that
    // should be automated almost in a sense". The bar comes down on its own
    // and the finger's only job is to stay where it is, so the line is an
    // instruction to keep holding, in two words a player can read while
    // watching the bar. `SUBTITLE.bench` says what letting go costs.
    DESCENT: {
      squat: 'RELEASE AT DEPTH',
      bench: 'STAY TIGHT',
    } satisfies PerEccentricKind<string>,
    // Per kind: "OUT OF THE HOLE" is squat/deadlift jargon for the bottom
    // position and reads as nonsense on a bench rep, which has no hole — it
    // has a chest. BRACE and DESCENT are per-kind for the same reason: "DESCEND"
    // / "DEPTH" are squat instructions, and a phone playtest of the first bench
    // pass reported them as "still a squat". Ascent copy ("RIDE IT", "DRIVE —
    // TAP", "LOCK IT") is generic press language that already applies to both.
    //
    // BENCH'S IS THE WAITING LINE, NOT THE COMMAND. On bench the HOLE beat is
    // the pause on the chest, and what the player is being asked for is to
    // WAIT — so this line has to read as an instruction to hold still, or a
    // player reads "OFF THE CHEST" as "go now" and false-starts every rep. The
    // command itself is `HOLE_COMMANDED` below.
    HOLE: { squat: 'OUT OF THE HOLE', bench: 'WAIT FOR IT' } satisfies PerEccentricKind<string>,
    /**
     * BENCH ONLY: shown in place of `HOLE.bench` once the player has tapped
     * before the command.
     *
     * THE ONE PROMPT IN THIS TABLE THAT EXISTS TO TEACH A RULE AT THE MOMENT
     * IT IS BROKEN. A false start holds the grind back for up to a fifth of a
     * second after the call, and a player who never learns why their presses
     * start flat will read that cost as the game being arbitrary. `SUBTITLE.bench`
     * states the rule up front; this says it happened.
     */
    HOLE_FALSE_START: 'TOO SOON — WAIT FOR THE CALL',
    /**
     * BENCH ONLY: the press command, shown from the tick it fires.
     *
     * IT NAMES THE ACTION THE BEAT ACTUALLY WANTS, which "PRESS!" stopped
     * doing on 2026-08-25. One press is not the answer — the answer is a tap
     * rate held for as long as the bar is moving — and a line that says PRESS
     * to a player whose job is to tap is the copy half of the defect a phone
     * playtest already caught once on the drive cue ("DRIVE — HOLD IT" over a
     * mechanic that wanted taps).
     *
     * Still short, still readable in peripheral vision, and it borrows the
     * em-dash shape `ASCENT_GRINDING` uses for the same reason: the word
     * before the dash is what is happening, the words after it are what to do
     * about it.
     */
    HOLE_COMMANDED: 'PRESS — TAP FAST',
    ASCENT_BEFORE_CUE: 'RIDE IT',
    ASCENT_CUE_OPEN: 'DRIVE — TAP',
    ASCENT_AFTER_CUE: 'RIDE IT',
    /**
     * BENCH ONLY: the whole ascent, from the launch to the verdict.
     *
     * ONE LINE FOR THE WHOLE GRIND, WHICH IS THE COPY HALF OF THE 2026-08-25
     * REPLAY STEER. Squat and deadlift flip between three ascent lines because
     * their ascent is a sequence of discrete cues — ride, drive, ride again.
     * Bench's has no cues to arm, so a line that changed would be announcing
     * something that had not happened. What it says instead is the thing that
     * is true for every tick of a bench ascent: keep tapping.
     *
     * IT IS NOT `ASCENT_CUE_OPEN`. That line means a window is open and will
     * close, which is exactly the read a continuous grind must not give — a
     * player who reads "DRIVE — TAP" as a cue will stop when they think it has
     * passed, and stopping is what loses the rep.
     */
    ASCENT_GRINDING: 'GRIND — KEEP TAPPING',
    /**
     * PER KIND, BECAUSE ON ONE OF THE THREE THIS BEAT IS AN INSTRUCTION AND ON
     * THE OTHER TWO IT IS AN ANNOUNCEMENT.
     *
     * Squat and bench have already resolved by the time they reach `LOCKOUT`;
     * "LOCK IT" is flavour over a fixed beat and asks for nothing. On deadlift
     * this beat is the check, and the line has to be a live instruction the
     * player acts on — "DON'T LET GO" rather than "LOCK IT", because a player
     * who reads "LOCK IT" as "you have locked it" takes their finger off, which
     * is precisely the losing play.
     */
    LOCKOUT: {
      squat: 'LOCK IT',
      bench: 'LOCK IT',
      deadlift: "DON'T LET GO",
    } satisfies PerKind<string>,
    /**
     * DEADLIFT ONLY: the down command, shown from the tick it fires.
     *
     * THE OPPOSITE OF `HOLE_COMMANDED` IN EVERY WAY THAT MATTERS, and the
     * contrast is the point. Bench's is a starter's pistol that has to be read
     * in peripheral vision because the reaction window is running. This one
     * arrives when the rep is already over and asks for nothing at all — so it
     * is permitted to be a word the player reads at leisure, and it is a
     * release rather than a demand.
     */
    LOCKOUT_DOWN_COMMANDED: 'DOWN',
    RESOLVED: 'TAP TO LIFT AGAIN',
  }),
  /**
   * The whole control scheme, in one line, PER LIFT. Prototype 1 is played by
   * people who have never seen it (GDD §10: "10-20 people, roughly half real
   * lifters"), so the rules have to be on the screen rather than in a tutorial
   * nobody built.
   *
   * PER-KIND BECAUSE THE CONTROL SCHEMES GENUINELY DIFFER NOW. A phone playtest
   * of the first bench pass reported the controls reading as "still a squat",
   * and this line was part of why: it is the instructions, and it described
   * squat's two moments on a lift that has three. Squat's wording is unchanged
   * and still exact-pinned in `liftTuning.test.ts`.
   */
  SUBTITLE: {
    squat: 'Two moments, not two motions: release at the bottom, tap every drive cue. Catch the beat.',
    // BENCH'S LINE IS THE ONLY ONE CARRYING A PENALTY RULE, and it carries it
    // because the penalty is otherwise invisible: a grind that starts late
    // because of taps thrown before the call is not something a player can see
    // happening. The last sentence is the false-start rule verbatim, and
    // `lift.test.ts` drives the sim against each of its clauses separately —
    // early taps add nothing to the charge, each one delays the tick taps
    // start counting, and the delay never exceeds the fifth of a second the
    // sentence names in words.
    //
    // REWRITTEN WHOLE FOR THE 2026-08-25 REPLAY STEER, not patched. Every
    // clause of the previous line described a mechanic that no longer exists:
    // "ease the bar down" was the steering the steer deleted, "as fast as you
    // can to press it" described one burst rather than a grind held through
    // the whole ascent, and "costs a tap off your burst — down to a floor of
    // three" was arithmetic over a tap count that is gone. A sentence half
    // true of the code is this repository's oldest defect class, so the rule
    // was re-derived from the new mechanic rather than reworded to fit it.
    //
    // "UP TO HALF A SECOND" BECAME "UP TO A FIFTH OF A SECOND" ON THE
    // 2026-08-27 RULING, WHEN `MAX_LOCKOUT_TICKS` DROPPED 30 -> 12. See that
    // constant's own header in `LIFT_TUNING.GRIND_FALSE_START` for why: the
    // longer cap put the false-start wall below the max-effort wall, so no
    // margin could both honour this sentence and lose a player who was
    // actually trying. The shorter cap is a truer number, not a softer rule —
    // the rule itself (taps before the call count for nothing, never ends the
    // rep) is unchanged.
    bench: 'Hold all the way down and the bar reaches your chest under control; let go and it drops on you. Wait for the call, then tap fast and keep tapping — your tap rate is your press for as long as the bar is moving. Taps before the call count for nothing, and each one holds your press back, up to a fifth of a second.',
    // DEADLIFT'S LINE HAS TO TEACH THE HOLD, because the hold is the only
    // moment in this game where the correct input is no input, and a player
    // who has learned squat and bench has learned the opposite twice. It names
    // the down command explicitly so the wait has a stated end — a hold with
    // no announced finish reads as the game having frozen.
    deadlift: 'No way down: pull off the floor, tap every drive cue, then hold the lockout until the down call.',
  } satisfies PerKind<string>,

  OUTCOME: Object.freeze({
    'good-lift': 'GOOD LIFT',
    grind: 'GRINDER',
    miss: 'NO LIFT',
  }),
  MISS_REASON: Object.freeze({
    'no-depth': 'Came up short of depth.',
    // 'no-touch' WAS HERE AND IS DELETED WITH ITS MECHANIC, 2026-08-25 replay
    // steer. It read "Never touched the chest." and it was reachable only by
    // stopping the bench descent and never restarting it. The steer made the
    // descent automatic — the bar's rate is floored above zero, so depth
    // strictly increases and the chest is always reached — which left the
    // reason unreachable. A miss reason nothing can produce is a sentence the
    // player can never be shown, and the union in `lift.ts` is where the
    // deletion is enforced rather than here.
    buried: 'Buried it. Never got the reversal.',
    stalled: 'The bar beat you at the sticking point.',
    timeout: 'Ran out of air.',
    // DEADLIFT ONLY, AND IT EARNS ITS OWN REASON RATHER THAN REUSING
    // 'stalled'. A dropped lockout and a lost sticking point are different
    // failures with different fixes — one says hold on, the other says drive
    // harder — and handing a player the wrong one of those two sentences is
    // worse than handing them nothing. `lift.ts`'s `MissReason` union is where
    // this is enforced; `meetDay.ts`'s `judgingMargin` already treats every
    // reason but 'no-depth' as unanimous, which is right here: everyone in the
    // room sees a bar go down early.
    dropped: 'Put it down before the call.',
  }),
  GRADE: Object.freeze({
    perfect: 'PERFECT',
    good: 'GOOD',
    early: 'EARLY',
    late: 'LATE',
    missed: 'MISTIMED',
  }),
});
