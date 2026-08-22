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
 * `LiftKind` has three members (`meet.ts`); this build only has one lift's
 * mechanic playable. Deliberately narrower than `LiftKind` rather than a
 * `Partial<Record<LiftKind, ...>>` with a runtime check for the missing
 * third: TypeScript enforces every per-kind table below is complete for
 * every kind this module can actually be asked to simulate, and a call site
 * passing `'deadlift'` is a compile error rather than an unhandled case
 * discovered at runtime. Widens to the full `LiftKind` when deadlift's own
 * phase-model piece lands — one type edit, plus that lift's own table rows.
 */
export type PlayableLiftKind = Extract<LiftKind, 'squat' | 'bench'>;

export const PLAYABLE_LIFT_KINDS = Object.freeze(['squat', 'bench'] as const satisfies readonly PlayableLiftKind[]);

/**
 * Which playable kind a real `LiftKind` day or attempt should be simulated as.
 *
 * CLAUDE.md's Sprint 3 ruling: deadlift's phase model is a serial follow-up,
 * not a parallel build, because it has no eccentric phase and cannot run
 * through squat's BRACE -> DESCENT -> HOLE -> ASCENT shape. `LIFT_ROTATION`
 * and every meet already cycle through deadlift regardless, so until that
 * piece lands, a deadlift rep plays on squat's numbers — the same placeholder
 * fidelity every kind had before `LiftConfig.kind` was required, now written
 * down in one place instead of left for each caller to decide separately.
 * Not a claim that deadlift feels like a squat.
 */
export function simKindFor(lift: LiftKind): PlayableLiftKind {
  return lift === 'deadlift' ? 'squat' : lift;
}

/** A `{LIGHT, MAXIMAL}` pair, one per playable lift kind. */
type PerKind<T> = Readonly<Record<PlayableLiftKind, T>>;

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
 */
export const STICK_HEIGHT_FRAC: PerKind<number> = Object.freeze({
  squat: STICK.HEIGHT_FRAC,
  bench: 0.2,
});
export const STICK_WIDTH: PerKind<number> = Object.freeze({
  squat: STICK.WIDTH,
  bench: 0.12,
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
   * 1.08 s. bench's pair is a placeholder chosen faster than squat's — a
   * bench eccentric is a shorter range of motion — not measured: MAXIMAL
   * takes 1/0.019 ≈ 53 ticks ≈ 0.88 s. Not played; GDD §10 applies.
   */
  DESCENT_DEPTH_PER_TICK: {
    squat: { LIGHT: 0.0278, MAXIMAL: 0.0155 },
    bench: { LIGHT: 0.034, MAXIMAL: 0.019 },
  } satisfies PerKind<{ LIGHT: number; MAXIMAL: number }>,

  /**
   * The brace beat before the descent starts, per lift kind. The player's
   * first press begins the descent; this is how long the "SET" prompt is
   * shown before input is accepted, so a mashed press does not immediately
   * start the rep. bench's pair is shorter than squat's — unracking is
   * quicker than a squat's brace-and-walkout — a placeholder, not measured.
   */
  BRACE_TICKS: {
    squat: { LIGHT: 14, MAXIMAL: 34 },
    bench: { LIGHT: 10, MAXIMAL: 26 },
  } satisfies PerKind<{ LIGHT: number; MAXIMAL: number }>,

  /** Longest the brace will wait for a press before starting the descent itself. */
  BRACE_TIMEOUT_TICKS: 600,

  // -------------------------------------------------------------------------
  // Depth — GDD §6.2: "Squat — depth timing check in the hole", "Bench —
  // press-timing / bar-speed check off the chest". Same field names, one
  // reading per kind: for squat this is hip-crease depth in the hole; for
  // bench it is how far the bar has travelled toward the chest, and the
  // "reversal" this section's DESCENT phase asks for is the chest touch.
  // -------------------------------------------------------------------------

  /**
   * Depth at which the lift is legal, per kind. Releasing above this misses
   * with reason 'no-depth' — a high squat for squat, an incomplete chest
   * touch for bench. Not a difficulty knob so much as the rule.
   *
   * BENCH SET STRICTER THAN SQUAT'S (0.92 vs 0.8, both against the same
   * IDEAL=1.0): a partial bench press is a more binary, more strictly judged
   * foul in the real sport than squat's depth standard, which has more
   * legitimate room to be "close enough". A placeholder reasoned from that,
   * not measured — GDD §10 applies.
   */
  DEPTH_LEGAL: { squat: 0.8, bench: 0.92 } satisfies PerKind<number>,

  /** The depth the timing window is centred on, per kind. Where a good rep reverses. Same for both. */
  DEPTH_IDEAL: { squat: 1.0, bench: 1.0 } satisfies PerKind<number>,

  /**
   * Past this the lifter is buried and the rep is over — miss, reason
   * 'buried'. A player who never releases gets here on their own, which is
   * the point: doing nothing is a distinct failure with its own texture.
   *
   * BENCH'S MARGIN ABOVE IDEAL IS SMALLER THAN SQUAT'S (1.15 vs 1.3): a chest
   * does not compress nearly as far as a hip can sink into a squat's bottom,
   * so bouncing/sinking into the chest reaches its own foul sooner. Not
   * measured; a placeholder reasoned the same way as DEPTH_LEGAL above.
   */
  DEPTH_COLLAPSE: { squat: 1.3, bench: 1.15 } satisfies PerKind<number>,

  /**
   * Full width of the depth window, ms, per kind. The player must release
   * inside `ideal ± width/2`. Outside it but still between DEPTH_LEGAL and
   * DEPTH_COLLAPSE is legal-but-sloppy: it grades 'missed' and costs reversal
   * speed, it does not end the rep.
   *
   * `fatigue.ts` scales this (GDD §3.4, tighter when fatigued). The IDEAL does
   * not move when it does — the window shrinks symmetrically about it — so a
   * fatigued player is asked for the same moment, more precisely.
   *
   * BENCH FAR NARROWER THAN SQUAT'S (120ms vs 300ms) — NOT AN INDEPENDENT
   * CHOICE. A first pass set this at 260ms, reasoned only from "a chest touch
   * is more discrete than a squat's hole" in isolation from bench's other two
   * numbers. `liftTuning.test.ts`'s "never lets the late edge of the depth
   * window be an instant bury" caught the interaction: bench's collapse
   * margin above IDEAL is deliberately small (0.15, vs squat's 0.3, because a
   * chest does not compress as far as a hip) and bench's descent is
   * deliberately fast (DESCENT_DEPTH_PER_TICK), so at 260ms the window's late
   * edge already landed past DEPTH_COLLAPSE at the light end of the load
   * range (measured 1.264 depth against a 1.15 collapse point) — releasing
   * inside the window the game itself drew would have been an instant bury.
   * 120ms keeps the same proportion of the (smaller) collapse budget squat's
   * 300ms uses of its own (~83% at the worst-case load, both measured), which
   * is what makes the two numbers consistent with each other rather than
   * independently plausible-sounding. Still a placeholder, not measured by
   * play — GDD §10 applies — but now one that cannot draw a cue that lies.
   */
  DEPTH_WINDOW_MS: { squat: 300, bench: 120 } satisfies PerKind<number>,

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
   */
  HOLE_TICKS: {
    squat: { LIGHT: 4, MAXIMAL: 12 },
    bench: { LIGHT: 5, MAXIMAL: 14 },
  } satisfies PerKind<{ LIGHT: number; MAXIMAL: number }>,

  // -------------------------------------------------------------------------
  // THE PRESS COMMAND — BENCH ONLY (GDD §6.2, "Bench — press-timing /
  // bar-speed check off the chest")
  //
  // WHAT MAKES BENCH A DIFFERENT LIFT AND NOT A RETUNED SQUAT. Squat's decisive
  // input is an ANTICIPATION check: the bar is moving, the player predicts the
  // moment it reaches depth, and releases. Bench's is a REACTION check: the bar
  // is motionless on the chest and a command arrives at a moment the player
  // cannot predict. Those are different faculties, not different numbers, and
  // it is why `HOLE` — a beat that asks for nothing on squat, by design — is
  // where bench's whole lift is decided.
  //
  // Every value below is bench's only. Squat reads none of them and its HOLE
  // branch is untouched; `lift.test.ts` pins squat's histories byte-identical
  // across this change.
  // -------------------------------------------------------------------------

  /**
   * How long the bar sits motionless on the chest before the command, in ticks.
   *
   * DRAWN FROM THE REP'S SEED, NOT FROM A CLOCK AND NOT FROM `Math.random`. The
   * delay has to be unpredictable or the reaction check degrades into a second
   * anticipation check — a fixed pause is learnable in about three reps, and a
   * learnable pause is squat's mechanic wearing bench's name. Seeded means
   * unpredictable to the PLAYER while a rep stays a pure function of
   * (config, seed, inputs), which `lift.test.ts` pins.
   *
   * THIS IS NOT THE ROLLED OUTCOME `lift.ts`'s header refuses, and the
   * distinction is worth stating because a reader will reasonably ask. What is
   * rolled is WHEN THE TEST STARTS, never whether it is passed: at every delay
   * in this range a player who reacts well gets the same quality and the same
   * bar speed. GDD §8.1's "100% skill- and consistency-driven" is about the
   * OUTCOME, and the outcome here is decided entirely by the reaction. A
   * starter's pistol that fires at an unpredictable moment is not a dice roll
   * on the race.
   *
   * The range's floor is not zero: a command that can arrive on the same tick
   * the bar settles is indistinguishable from no pause at all.
   */
  PRESS_COMMAND_DELAY_TICKS: { MIN: 24, MAX: 96 },

  /**
   * How long the reaction window stays open after the command, ms.
   *
   * Graded ASYMMETRICALLY, unlike every other window in this file — see
   * `gradeReaction` in `lift.ts`. Quality runs from 1 at the command tick down
   * to 0 at the end of this window; there is no early half, because a press
   * before the stimulus is not an early reaction, it is a false start.
   *
   * 420ms is chosen above human visual reaction time (~250ms) with room for a
   * phone's touch latency, so a player who genuinely reacts lands inside it and
   * the grading separates sharp from slow rather than separating "reacted" from
   * "did not". Not measured by play; GDD §10 applies.
   */
  PRESS_REACTION_WINDOW_MS: 420,

  /**
   * Velocity the bar leaves the chest with, at reaction quality 0 and 1.
   *
   * THIS IS THE "BAR-SPEED CHECK OFF THE CHEST" HALF OF §6.2's LINE, and it is
   * why one input covers both halves: the press is the timing check, and what
   * the timing BUYS is bar speed. On bench this replaces the depth-release
   * quality as the thing that sets ascent velocity — the chest touch still
   * decides legality, the reaction decides speed.
   *
   * MIN is deliberately below `REVERSAL_VELOCITY.MIN`: a bench pressed late off
   * the chest is slower off the bottom than a scruffy squat reversal, which is
   * the whole texture of a missed bench.
   */
  PRESS_VELOCITY: { MIN: 0.0004, MAX: 0.019 },

  /**
   * What a false start costs — a press thrown before the command lands.
   *
   * IT DOES NOT END THE REP, deliberately and consistently with the rule
   * `stepLift`'s drive branch already states in capitals: "A MISSED TAP COSTS
   * VELOCITY. IT NEVER ENDS THE REP ON ITS OWN." A competition bench would red
   * light this outright, and that is left on the table rather than taken: a
   * hard fail on a reaction test the player cannot see coming is the shape that
   * reads as the game cheating, and it is exactly the judgement GDD §12.1 puts
   * with a human on a phone. What it costs instead is the reaction: the false
   * start CONSUMES the press, so mashing through the pause is punished with the
   * worst bar speed rather than rewarded with a lucky hit.
   */
  PRESS_FALSE_START_QUALITY: 0,

  /**
   * Ticks after the command before an unpressed bar gives up and rises anyway.
   *
   * Not a miss — the rep proceeds at reaction quality 0, which at bench's
   * demand curve is usually a stall and a 'stalled' miss on its own merits.
   * Failing it HERE instead would invent a fifth `MissReason` for something the
   * existing physics already calls correctly.
   */
  PRESS_TIMEOUT_TICKS: 90,

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
   * BENCH SET SLIGHTLY LOWER (0.80), WITH MORE OF THE LIFT'S DIFFICULTY MOVED
   * INTO THE STICK GAIN BELOW — reasoned rather than measured: a bench grind
   * is commonly described as fine everywhere except right off the chest,
   * more so than a squat's more evenly-distributed grind. GDD §10 applies.
   */
  DEMAND_BASE: {
    squat: { LIGHT: 0.42, MAXIMAL: 0.86 },
    bench: { LIGHT: 0.38, MAXIMAL: 0.8 },
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
   * BENCH'S GAIN IS LARGER THAN SQUAT'S (0.55 vs 0.48) — the flip side of
   * DEMAND_BASE above: bench's MAXIMAL peak is 0.80 + 0.55 = 1.35, a
   * comparable margin above capacity to squat's, reached by a sharper stick
   * rather than a higher base. Reasoned, not measured.
   */
  DEMAND_STICK_GAIN: {
    squat: { LIGHT: 0.06, MAXIMAL: 0.48 },
    bench: { LIGHT: 0.05, MAXIMAL: 0.55 },
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
   */
  DRIVE_ARM_HEIGHT: { squat: 0.16, bench: 0.1 } satisfies PerKind<number>,

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
   * 170 ticks is 2.83 s of concentric. Chosen against a measured distribution
   * rather than picked: across a sweep of every load, depth and drive offset,
   * successful ascents ran to a maximum of 201 ticks with a 99th percentile of
   * 121, so this clips only the longest creeps. Raise it far and 'timeout'
   * becomes unreachable and its copy becomes dead; drop it far and it starts
   * cutting off grinds that were going to make it, which is the worse failure.
   */
  ASCENT_TIMEOUT_TICKS: 170,

  /**
   * Ticks standing at lockout before the rep resolves, per kind. bench
   * reuses squat's pair unchanged — no reasoned basis to differ found while
   * building bench's other constants, so kept equal rather than invented.
   */
  LOCKOUT_TICKS: {
    squat: { LIGHT: 8, MAXIMAL: 16 },
    bench: { LIGHT: 8, MAXIMAL: 16 },
  } satisfies PerKind<{ LIGHT: number; MAXIMAL: number }>,

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
     * BENCH ONLY: the press command.
     *
     * THE STIMULUS ITSELF, not decoration on it. A reaction check on a phone is
     * won or lost on how fast the command registers, and a thumb resting on
     * glass feels a haptic sooner than an eye reads a word — so this is the
     * channel the mechanic actually runs through, and `LIFT_COPY.PROMPT
     * .HOLE_COMMANDED` is the confirmation rather than the other way round.
     *
     * `rigid` and alone: a single sharp edge is what a reaction wants. Every
     * multi-beat pattern in this table takes tens of ms to resolve into
     * something recognisable, which would be spent out of the player's window.
     */
    PRESS_COMMAND: pattern({ style: 'rigid', delayMs: 0 }),

    /** BENCH ONLY: a sharp press off the chest. Distinguishable from a slow one. */
    PRESS_SHARP: pattern({ style: 'heavy', delayMs: 0 }, { style: 'light', delayMs: 70 }),

    /** BENCH ONLY: the bar moved, but late. */
    PRESS_SLOW: pattern({ style: 'medium', delayMs: 0 }),

    /** BENCH ONLY: pressed before the command. */
    PRESS_FALSE_START: pattern({ style: 'warning', delayMs: 0 }),
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
    BRACE: {
      squat: 'TAP AND HOLD TO DESCEND',
      bench: 'TAP AND HOLD TO LOWER',
    } satisfies PerKind<string>,
    DESCENT: {
      squat: 'RELEASE AT DEPTH',
      bench: 'TOUCH THE CHEST',
    } satisfies PerKind<string>,
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
    HOLE: { squat: 'OUT OF THE HOLE', bench: 'WAIT FOR IT' } satisfies PerKind<string>,
    /**
     * BENCH ONLY: the press command, shown from the tick it fires.
     *
     * Deliberately the shortest line in the table and the only one that ends in
     * a mark. It is a starter's pistol rendered as text — every millisecond a
     * player spends parsing it comes out of their reaction, so it has to be one
     * word they can read in peripheral vision. The haptic
     * (`HAPTICS.PRESS_COMMAND`) is the real stimulus on a phone; this is what
     * the eye confirms it against.
     */
    HOLE_COMMANDED: 'PRESS!',
    ASCENT_BEFORE_CUE: 'RIDE IT',
    ASCENT_CUE_OPEN: 'DRIVE — TAP',
    ASCENT_AFTER_CUE: 'RIDE IT',
    LOCKOUT: 'LOCK IT',
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
    bench: 'Touch the chest, wait for the call, then press the instant it comes. Tap every drive cue on the way up.',
  } satisfies PerKind<string>,

  OUTCOME: Object.freeze({
    'good-lift': 'GOOD LIFT',
    grind: 'GRINDER',
    miss: 'NO LIFT',
  }),
  MISS_REASON: Object.freeze({
    'no-depth': 'Came up short of depth.',
    buried: 'Buried it. Never got the reversal.',
    stalled: 'The bar beat you at the sticking point.',
    timeout: 'Ran out of air.',
  }),
  GRADE: Object.freeze({
    perfect: 'PERFECT',
    good: 'GOOD',
    early: 'EARLY',
    late: 'LATE',
    missed: 'MISTIMED',
  }),
});
