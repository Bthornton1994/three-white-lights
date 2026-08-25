/**
 * sessionDrive.mjs — PLAYS THE DAILY LOOP WITH A REAL MOUSE, from launch to the
 * close-out, so a check can look at the screens that only exist on the far side
 * of a finished session.
 *
 * ===========================================================================
 * WHY THIS IS A SHARED MODULE AND NOT TWO COPIES
 * ===========================================================================
 * `capture-session.mjs --live` already drove the first half of this — three
 * check-in taps, an RPE choice, and a couple of crude holds on the stage — to
 * prove the touch path reaches the mechanic. `verify-shell-route.mjs` needs the
 * SAME driving, carried further: the "already trained today" surface is only
 * reachable by finishing a real session and pressing DONE, and it is the
 * terminal screen of GDD §3.2's daily loop, so every player lands on it every
 * day. Two hand-rolled copies of a mouse-driven mechanic would drift, and the
 * one that drifted would be the one nobody ran.
 *
 * ===========================================================================
 * THIS FILE DRIVES. IT ASSERTS NOTHING.
 * ===========================================================================
 * Every function here returns what happened and lets the caller decide whether
 * that was acceptable. Nothing throws on a game outcome, because "the rep was
 * missed" is a legal thing for the app to do and a check that crashed on it
 * would be reporting the harness's opinion rather than the app's behaviour.
 *
 * ===========================================================================
 * THE TIMING IS NOT GOOD, AND DOES NOT NEED TO BE
 * ===========================================================================
 * `capture-session.mjs` says this about its own reps and it is still true. What
 * IS needed is that the session reliably completes, because a check that only
 * sometimes reaches its screen is worse than no check. So the driver does not
 * press on a stopwatch: it READS THE MECHANIC'S OWN PROMPT out of the DOM and
 * acts on the beat it is actually on. The one number it has to guess is how
 * long to stay down during the descent, and the legal band for that is wide:
 *
 *   descent depth grows at DESCENT_DEPTH_PER_TICK, interpolated by load. At the
 *   RPE-8 triple this driver asks for (~0.86 of e1RM) that is ~0.0188/tick at
 *   60 Hz, so
 *       DEPTH_LEGAL     0.8  is reached at ~710 ms of hold
 *       DEPTH_IDEAL     1.0  at ~890 ms
 *       DEPTH_COLLAPSE  1.3  (buried, an instant miss) at ~1155 ms
 *   so anything in roughly 710-1150 ms is a legal rep.
 *
 *   DEPTH_HOLD_MS IS 1000: ABOVE THE IDEAL, NOT THE MIDDLE OF THE BAND, AND ON
 *   PURPOSE. This paragraph used to say "sits in the middle of it", which the
 *   shipped 1000 is not — the middle is 930 — and a derivation that disagrees
 *   with its own constant is the drift CLAUDE.md's tunable-values rule exists
 *   to stop, so the DERIVATION is what was wrong and this is it corrected.
 *
 *   The three figures above are SIM TICKS converted to wall clock AT A FULL
 *   60 Hz, and the sim does not get 60 Hz here. `useLiftLoop` takes at most
 *   `FEEDBACK.MAX_CATCH_UP_TICKS` (4) ticks per animation frame, deliberately,
 *   so on a loaded software-rendered browser a wall-clock millisecond buys LESS
 *   depth than this arithmetic says and the legal band slides UP in wall-clock
 *   terms. A hold at the ideal is therefore biased toward the "came up short of
 *   depth" miss — the failure that has actually been observed, five reps out of
 *   five — while the other end of the band only ever moves away. 1000 keeps
 *   155 ms of headroom to DEPTH_COLLAPSE at a perfect 60 Hz and more than that
 *   whenever the machine is slower, which is the only direction it goes.
 *
 *   Those numbers are `liftTuning.ts`'s and are restated here as a derivation,
 *   not imported: this is a starting point for a hold, not an expectation about
 *   the app. NONE OF IT HAS BEEN PLAYED BY A HUMAN.
 *
 * A re-tune of the mechanic can move that band out from under this constant.
 * That shows up as reps that miss, which `playSessionToCloseOut` reports as
 * exactly that — not as a timeout.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  blockInSource,
  numberInBlock,
  numberInDeclaration,
  numberInSource,
  parserSelfTest,
} from './readTuning.mjs';

/**
 * ===========================================================================
 * WHAT THE MECHANIC SAYS ON EACH BEAT
 * ===========================================================================
 * Restated from `LIFT_COPY.PROMPT` (`src/game/liftTuning.ts`) rather than
 * imported: these are a `.ts` module's values and this is a `.mjs` tool, and in
 * any case a driver that read the copy out of the app would happily drive a
 * broken app in circles.
 *
 * IF THIS COPY IS RE-WRITTEN, THIS DRIVER STOPS RECOGNISING THE MECHANIC. That
 * is caught immediately and by name rather than as a wall of timeouts:
 * `openSessionToFirstSet` checks the very first prompt it sees against
 * `BRACE_PROMPT` and reports `unrecognisedPrompt` if it does not match, so the
 * caller can say "the driver no longer knows this screen" instead of "something
 * took too long".
 */
/**
 * ===========================================================================
 * THE WHOLE PROMPT LADDER, PER LIFT — THE TABLE THIS DRIVER STEERS BY
 * ===========================================================================
 * `SESSION_PROMPTS` below is SQUAT'S ladder and nothing else, which was fine
 * while squat was the only lift with a phase model and is now a statement
 * about one third of the game. `LIFT_COPY.PROMPT` in `src/game/liftTuning.ts`
 * is keyed per `LiftKind`, and the three ladders are genuinely different
 * shapes rather than three spellings of one shape (see `lift.ts`'s "THREE
 * LIFTS, THREE PHASE PATHS, THREE FACULTIES"):
 *
 *   squat     BRACE -> DESCENT -> HOLE -> ASCENT -> LOCKOUT
 *   bench     BRACE -> DESCENT -> HOLE (which fires a COMMAND) -> ASCENT -> LOCKOUT
 *   deadlift  BRACE ->                    ASCENT -> LOCKOUT (which fires a DOWN command)
 *
 * `null` MEANS "THIS LIFT HAS NO SUCH BEAT", not "the copy has not been
 * transcribed yet", and the difference is load-bearing: a deadlift's DESCENT
 * and HOLE entries are null because `stepLift` REFUSES a (deadlift, DESCENT)
 * state outright — `DEPTH_LEGAL.deadlift` does not compile — so a driver that
 * waits for one is waiting for a state the type system has ruled out. A caller
 * reading a null here must skip the beat, never wait on it.
 *
 * RESTATED FROM `LIFT_COPY`, NOT IMPORTED, for the reason the header above
 * already gives for `SESSION_PROMPTS`: a `.mjs` tool cannot import a `.ts`
 * module without a loader this tree does not run, AND a driver that read its
 * copy out of the app would happily drive a broken app in circles. A re-write
 * of the real copy therefore reddens the checks that compare against these,
 * which is the intended behaviour and not an oversight.
 */
export const LIFT_PROMPTS = Object.freeze({
  squat: Object.freeze({
    BRACE: 'TAP AND HOLD TO DESCEND',
    DESCENT: 'RELEASE AT DEPTH',
    HOLE: 'OUT OF THE HOLE',
    /** BENCH ONLY — the press command. Squat's HOLE beat asks for nothing. */
    COMMAND: null,
    LOCKOUT: 'LOCK IT',
    /** DEADLIFT ONLY — the down command. */
    DOWN: null,
    SUBTITLE:
      'Two moments, not two motions: release at the bottom, tap every drive cue. Catch the beat.',
  }),
  /**
   * RE-TRANSCRIBED FOR THE 2026-08-25 RULING, WHICH REPLACED BENCH'S IDENTITY
   * RATHER THAN ITS NUMBERS.
   *
   * Three of these five lines moved and the mechanic behind them moved further:
   * `DESCENT` used to say TOUCH THE CHEST, which described a beat where the
   * player held and released at a depth. The bar is now fed down and CAUGHT,
   * `COMMAND` asks for a burst of taps rather than one press, and the subtitle
   * carries the false-start rule that pays for it. A driver holding the old
   * three would time out on the first and the third and press once at the
   * second, which is why this table is the thing that had to change first.
   *
   * STILL TRANSCRIBED AND STILL NOT IMPORTED, per this block's own header: a
   * driver that read its copy out of the app would drive a broken app in
   * circles, and the point of the re-transcription is that somebody had to
   * read the new copy and agree with it.
   */
  bench: Object.freeze({
    BRACE: 'TAP AND HOLD TO LOWER',
    DESCENT: 'EASE IT DOWN',
    HOLE: 'WAIT FOR IT',
    COMMAND: 'PRESS — TAP FAST',
    LOCKOUT: 'LOCK IT',
    DOWN: null,
    SUBTITLE:
      'Ease the bar to the chest under control, wait for the call, then tap as fast as you can to press it. Taps before the call count for nothing, and each one costs a tap off your burst — down to a floor of three.',
  }),
  deadlift: Object.freeze({
    BRACE: 'TAP TO PULL',
    /** NO ECCENTRIC. See the block header — these two nulls are the lift. */
    DESCENT: null,
    HOLE: null,
    COMMAND: null,
    LOCKOUT: "DON'T LET GO",
    DOWN: 'DOWN',
    SUBTITLE:
      'No way down: pull off the floor, tap every drive cue, then hold the lockout until the down call.',
  }),
});

/** The ascent lines, which are generic press language shared by all three. */
export const ASCENT_PROMPTS = Object.freeze({
  /** `ASCENT_BEFORE_CUE` and `ASCENT_AFTER_CUE` currently render the same. */
  RIDE: 'RIDE IT',
  /** `ASCENT_CUE_OPEN`. `SESSION_PROMPTS.DRIVE` is the substring of this. */
  CUE_OPEN: 'DRIVE — TAP',
});

/**
 * EVERY LINE IN THE GAME THAT CAN ONLY BE PRINTED FROM A `DESCENT` OR `HOLE`
 * STATE, across all three lifts — the set a deadlift's prompt ladder must
 * never contain.
 *
 * Built by reading `LIFT_PROMPTS` rather than typed out a second time, so a
 * kind added to that table cannot be forgotten here. The `null`s drop out,
 * which is exactly right: deadlift contributes nothing to this list because it
 * has no eccentric, and that is the fact under test.
 *
 * WHY THIS IS A LIST AND NOT `LIFT_PROMPTS.squat.DESCENT`: the failure this
 * guards against is a deadlift silently falling back to ANOTHER LIFT'S phase
 * model — the shape `repConfigFor` shipped for a round as
 * `simKindFor(state.context.lift)`, which mapped a deadlift day onto squat's
 * beat. A check written against squat's two lines alone would be blind to a
 * fallback onto bench's, so the ban is over every eccentric line there is.
 */
export const ECCENTRIC_ONLY_PROMPTS = Object.freeze(
  Object.values(LIFT_PROMPTS)
    .flatMap((ladder) => [ladder.DESCENT, ladder.HOLE, ladder.COMMAND])
    .filter((line) => line !== null),
);

/** The check-in chip that retargets today's session onto `kind` (GDD §3.2). */
export function checkInLiftTestId(kind) {
  return `check-in-lift-${kind}`;
}

// ---------------------------------------------------------------------------
// BENCH'S BEAT, STEERED BY NUMBERS READ OUT OF THE MECHANIC
// ---------------------------------------------------------------------------
/**
 * ===========================================================================
 * WHY THIS IS READ FROM SOURCE AND `LIFT_PROMPTS` IS NOT
 * ===========================================================================
 * `readTuning.mjs`'s rule, and this beat is the sharpest case for it in the
 * directory. A NAME a check identifies the app by stays transcribed — that is
 * the table above, and re-transcribing it is how a copy change becomes a
 * visible edit. A NUMBER a driver STEERS BY is the same fact typed twice, and
 * the second copy stops being true silently.
 *
 * Bench's numbers are going to move. `liftTuning.ts` says so about its own
 * descent pair in as many words — "a tuner turning this knob should re-run
 * that search rather than trust the feel of one rep" — and GDD §12.1 is open
 * on every one of them pending a phone replay. A driver holding `hold 183ms,
 * then release 433ms` as literals would keep driving a beat the game had
 * stopped having, and would report the resulting misses as the app's fault.
 *
 * ===========================================================================
 * WHAT IT COMPUTES, AND WHY A SEARCH RATHER THAN A FORMULA
 * ===========================================================================
 * The descent has no closed form worth writing: rate is fed by gravity while
 * the finger is down, resisted by the brake while it is up, capped, and the
 * graded quantity is the rate at the instant depth crosses the chest, multiplied
 * by what a slow descent has left of it. So the duty cycle is chosen by
 * simulating the real recurrence — `benchDescentRate`'s, restated here — over
 * every (feed, ease) pair inside `SEARCH` and keeping the one whose WORST touch
 * across a spread of loads is best.
 *
 * WORST-CASE AND NOT AVERAGE, BECAUSE THE DRIVER CANNOT SEE THE LOAD. Nothing
 * in the DOM says what fraction of e1RM this rep is at; the ladder probe knows
 * its RPE and the meet's opener arithmetic is a different table again. A cycle
 * that is excellent at 0.86 and crashes at 1.0 would work in one arm and fail
 * in the other, so the objective is the minimum.
 *
 * AND IT WILL NOT BE PERFECT ANYWHERE, BY DESIGN. GDD §6.2 records that an
 * independent critic searched this exact space and that the number of fixed
 * rhythms grading PERFECT at every load is pinned at zero — that is the point
 * of the beat. What the search buys is a rhythm that is CONTROLLED enough
 * everywhere to get a rep to lockout, which is what a driver needs; the
 * measured worst case is carried in `worstTouch` so a caller can report it
 * rather than assume it.
 */
const HERE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(HERE_DIR, '..');

/**
 * The search's own bounds and sample points. Not game feel — these are the
 * robot's, in the shape `SESSION_DRIVE` keeps its own.
 */
const BENCH_SEARCH = Object.freeze({
  /** Feed and ease phases, in sim ticks, are searched over these ranges. */
  MAX_FEED_TICKS: 24,
  MAX_EASE_TICKS: 48,
  /**
   * The loads the worst case is taken over.
   *
   * SPANS BOTH ARMS THIS MODULE DRIVES rather than sampling evenly: the ladder
   * probe's RPE 8 rung sits near 0.86 and a meet attempt runs at roughly
   * 0.90-0.97 of e1RM off `OPENER_FRACTION_OF_1RM` and its jump table, and the
   * warm-up end is here because the session's first sets are lighter than
   * either. A grid that missed the top would choose a rhythm that crashes
   * exactly where the meet plays.
   */
  LOADS: Object.freeze([0.4, 0.55, 0.7, 0.8, 0.863, 0.9, 0.95, 1.0]),
  /** Give the sim this many ticks to reach the chest before a pair is rejected. */
  MAX_TICKS: 400,
});

/** Restated from `spriteTuning.ts`'s `byLoad`/`loadT`, over values read from it. */
function interpolate(pair, load, range, exponent) {
  const clamped = Math.min(range.max, Math.max(range.min, load));
  const linear = (clamped - range.min) / (range.max - range.min);
  const t = Math.pow(linear, exponent);
  return pair.light + (pair.maximal - pair.light) * t;
}

/**
 * Simulate one descent at one load with one duty cycle.
 *
 * THE RECURRENCE IS `benchDescentRate`'S AND `stepLift`'S, RESTATED. That is a
 * second implementation of game math in a tool, which this repository normally
 * refuses — and it is the exception `readTuning.mjs` names, because what comes
 * out is an INPUT the robot moves on rather than an expectation it compares
 * against. Nothing here grades the app: if this simulation is wrong the driver
 * plays a worse rep and the checks that read the app report a worse outcome,
 * which is the failure mode that shows up rather than the one that hides.
 */
function simulateTouch(t, load, feedTicks, easeTicks) {
  const gravity = interpolate(t.gravity, load, t.loadRange, t.loadExponent);
  const brake = interpolate(t.brake, load, t.loadRange, t.loadExponent);
  const soft = interpolate(t.soft, load, t.loadRange, t.loadExponent);
  const crash = interpolate(t.crash, load, t.loadRange, t.loadExponent);
  const patience = interpolate(t.patience, load, t.loadRange, t.loadExponent);
  let rate = interpolate(t.startRate, load, t.loadRange, t.loadExponent);
  let depth = 0;
  let held = true;
  let inPhase = 0;
  let ticks = 0;
  for (; ticks < BENCH_SEARCH.MAX_TICKS; ticks += 1) {
    rate = held ? Math.min(t.maxRate, rate + gravity) : Math.max(0, rate - brake);
    depth += rate;
    inPhase += 1;
    if (depth >= t.idealDepth) break;
    if (inPhase >= (held ? feedTicks : easeTicks)) {
      held = !held;
      inPhase = 0;
    }
  }
  if (depth < t.idealDepth) return null;
  const speed = crash <= soft ? (rate <= soft ? 1 : 0) : Math.max(0, Math.min(1, (crash - rate) / (crash - soft)));
  const kept =
    ticks + 1 <= patience
      ? 1
      : Math.max(0, Math.min(1, 1 - (ticks + 1 - patience) / t.dawdleSpan));
  return { quality: speed * kept, ticks: ticks + 1, rate };
}

/** The (feed, ease) pair whose WORST touch across `LOADS` is best. */
function bestDutyCycle(t) {
  let best = null;
  for (let feed = 1; feed <= BENCH_SEARCH.MAX_FEED_TICKS; feed += 1) {
    for (let ease = 1; ease <= BENCH_SEARCH.MAX_EASE_TICKS; ease += 1) {
      const runs = BENCH_SEARCH.LOADS.map((load) => simulateTouch(t, load, feed, ease));
      if (runs.some((run) => run === null)) continue;
      const worst = Math.min(...runs.map((run) => run.quality));
      const mean = runs.reduce((sum, run) => sum + run.quality, 0) / runs.length;
      if (best === null || worst > best.worst || (worst === best.worst && mean > best.mean)) {
        best = { feedTicks: feed, easeTicks: ease, worst, mean, runs };
      }
    }
  }
  return best;
}

/**
 * Everything the bench beat is driven by, read out of `src/` on module load.
 *
 * `missing` and `parserComplaints` are the two ways this can be silently wrong
 * and both are reported rather than defaulted, because a `null` read as "not
 * configured" is a check that has quietly stopped asking anything. Every caller
 * asserts both are empty.
 */
function readBenchBeatTuning() {
  const liftTuning = readFileSync(path.join(SRC_ROOT, 'src/game/liftTuning.ts'), 'utf8');
  const spriteTuning = readFileSync(path.join(SRC_ROOT, 'src/art/spriteTuning.ts'), 'utf8');
  const benchStart = blockInSource(liftTuning, 'DESCENT_DEPTH_PER_TICK') ?? '';
  const read = {
    tickHz: numberInDeclaration(spriteTuning, 'TICK_HZ'),
    loadMin: numberInBlock(spriteTuning, 'LOAD_RANGE', 'MIN'),
    loadMax: numberInBlock(spriteTuning, 'LOAD_RANGE', 'MAX'),
    loadExponent: numberInSource(spriteTuning, 'LOAD_CURVE_EXPONENT'),
    gravityLight: numberInBlock(liftTuning, 'BENCH_DESCENT_GRAVITY', 'LIGHT'),
    gravityMaximal: numberInBlock(liftTuning, 'BENCH_DESCENT_GRAVITY', 'MAXIMAL'),
    brakeLight: numberInBlock(liftTuning, 'BENCH_DESCENT_BRAKE', 'LIGHT'),
    brakeMaximal: numberInBlock(liftTuning, 'BENCH_DESCENT_BRAKE', 'MAXIMAL'),
    maxRate: numberInSource(liftTuning, 'BENCH_DESCENT_MAX_RATE'),
    // SLICED FIRST, BECAUSE `bench` IS NOT A UNIQUE KEY. It is a per-kind copy
    // row, a prompt row and a prose word all over `liftTuning.ts`, so asking
    // the whole file for it answers about whichever comes first. See
    // `blockInSource`.
    startLight: numberInBlock(benchStart, 'bench', 'LIGHT'),
    startMaximal: numberInBlock(benchStart, 'bench', 'MAXIMAL'),
    idealDepth: numberInBlock(liftTuning, 'DEPTH_IDEAL', 'bench'),
    softLight: numberInBlock(liftTuning, 'BENCH_TOUCH_SOFT_RATE', 'LIGHT'),
    softMaximal: numberInBlock(liftTuning, 'BENCH_TOUCH_SOFT_RATE', 'MAXIMAL'),
    crashLight: numberInBlock(liftTuning, 'BENCH_TOUCH_CRASH_RATE', 'LIGHT'),
    crashMaximal: numberInBlock(liftTuning, 'BENCH_TOUCH_CRASH_RATE', 'MAXIMAL'),
    patienceLight: numberInBlock(liftTuning, 'BENCH_DESCENT_PATIENCE_TICKS', 'LIGHT'),
    patienceMaximal: numberInBlock(liftTuning, 'BENCH_DESCENT_PATIENCE_TICKS', 'MAXIMAL'),
    dawdleSpan: numberInSource(liftTuning, 'BENCH_DESCENT_DAWDLE_SPAN_TICKS'),
    chestTimeoutTicks: numberInSource(liftTuning, 'CHEST_TOUCH_TIMEOUT_TICKS'),
    burstWindowMs: numberInSource(liftTuning, 'PRESS_BURST_WINDOW_MS'),
    refractoryTicks: numberInSource(liftTuning, 'PRESS_BURST_TAP_REFRACTORY_TICKS'),
    maxCountedTaps: numberInBlock(liftTuning, 'PRESS_BURST_FORCE', 'MAX_COUNTED_TAPS'),
  };
  const missing = Object.entries(read)
    .filter(([, value]) => typeof value !== 'number' || !Number.isFinite(value))
    .map(([key]) => key);
  const parserComplaints = parserSelfTest();
  const tickMs = typeof read.tickHz === 'number' && read.tickHz > 0 ? 1000 / read.tickHz : null;
  if (missing.length > 0 || parserComplaints.length > 0 || tickMs === null) {
    return { ...read, tickMs, missing, parserComplaints, cycle: null };
  }
  const t = {
    gravity: { light: read.gravityLight, maximal: read.gravityMaximal },
    brake: { light: read.brakeLight, maximal: read.brakeMaximal },
    startRate: { light: read.startLight, maximal: read.startMaximal },
    soft: { light: read.softLight, maximal: read.softMaximal },
    crash: { light: read.crashLight, maximal: read.crashMaximal },
    patience: { light: read.patienceLight, maximal: read.patienceMaximal },
    loadRange: { min: read.loadMin, max: read.loadMax },
    loadExponent: read.loadExponent,
    maxRate: read.maxRate,
    idealDepth: read.idealDepth,
    dawdleSpan: read.dawdleSpan,
  };
  const cycle = bestDutyCycle(t);
  // THE CONTROL THE CHOSEN CYCLE IS CHOSEN AGAINST, taken by the same
  // simulation in the same call: a SINGLE COMMITTED HOLD, which is what the old
  // driver did and what a driver written without reading the ruling would do.
  // Without it, "the search picked feed 11 / ease 26" is a pair of numbers with
  // nothing behind it — the measured-carried-displayed-never-compared shape.
  const committed = BENCH_SEARCH.LOADS.map((load) =>
    simulateTouch(t, load, BENCH_SEARCH.MAX_TICKS, 1),
  );
  const committedWorst = committed.some((run) => run === null)
    ? null
    : Math.min(...committed.map((run) => run.quality));
  return {
    ...read,
    tickMs,
    missing,
    parserComplaints,
    cycle,
    /** What a single committed hold grades at its worst, over the same loads. */
    committedWorstTouch: committedWorst,
    /** The duty cycle, in wall clock, which is the unit a mouse moves in. */
    feedMs: cycle === null ? null : Math.round(cycle.feedTicks * tickMs),
    easeMs: cycle === null ? null : Math.round(cycle.easeTicks * tickMs),
    /** What the search says the worst touch across `LOADS` grades, 0..1. */
    worstTouch: cycle === null ? null : cycle.worst,
    /**
     * How long a descent may run before `stepLift` calls it 'no-touch'. The
     * driver clamps down and commits well inside this rather than discovering
     * it — see `BENCH_DRIVE.DESCENT_COMMIT_FRACTION`.
     */
    chestTimeoutMs: Math.round(read.chestTimeoutTicks * tickMs),
    /**
     * The floor a tap has to clear to be COUNTED, in wall clock.
     *
     * `stepLift` ignores a press inside `PRESS_BURST_TAP_REFRACTORY_TICKS` of
     * the last counted one — it does not penalise it, it simply does not count
     * it — so tapping faster than this wastes dispatches and costs nothing,
     * and tapping slower than it wastes WINDOW, which is the expensive
     * mistake. The driver aims just inside it (`BURST_TAP_PERIOD_FRACTION`) so
     * a sim running below 60 Hz — which `FEEDBACK.MAX_CATCH_UP_TICKS` makes
     * routine on a software-rendered browser — still gets one counted tap per
     * refractory rather than one per one-and-a-bit.
     */
    refractoryMs: read.refractoryTicks * tickMs,
  };
}

export const BENCH_BEAT = readBenchBeatTuning();

/** Every number the bench driver moves on that is NOT read from the game. */
export const BENCH_DRIVE = Object.freeze({
  /**
   * Aim this fraction of the refractory between taps.
   *
   * Below 1 on purpose — see `refractoryMs`. A wasted tap is free and a wasted
   * window tick is not, so the error is taken on the safe side.
   */
  BURST_TAP_PERIOD_FRACTION: 0.8,
  /**
   * How many dispatches the burst may spend to land `maxCountedTaps` counted
   * ones. Above 1 because a dispatch inside the refractory does not count, and
   * a browser under load does not hit a 40 ms period exactly.
   */
  BURST_TAP_ATTEMPT_MULTIPLE: 3,
  /**
   * A hang guard on the burst loop, as a multiple of the declared window.
   *
   * NOT A TIMING TARGET. The loop stops on the command line leaving the screen,
   * which is the real end of the burst; this is "the app has stopped
   * responding", and it is a multiple rather than a constant because the
   * window is declared in ms and consumed in TICKS, so a sim running slow makes
   * the real window longer in wall clock.
   */
  BURST_DEADLINE_MULTIPLE: 4,
  /**
   * Commit — hold the finger down and drive the bar in — once the descent has
   * spent this much of its `no-touch` budget.
   *
   * A FAILSAFE, NOT THE PLAY. A duty cycle whose ease phase has taken the rate
   * to zero at a load the search did not model would otherwise creep to the
   * timeout and take a 'no-touch' miss, which is the one descent failure that
   * costs the whole rep. Committing arrives fast and grades badly, which is a
   * worse rep and not a lost one.
   */
  DESCENT_COMMIT_FRACTION: 0.5,
  /**
   * How much the descent search moves the feed after a miss it can attribute.
   *
   * Same shape as `adaptDepthSearch` above and for the same reason: the sim
   * does not run at wall-clock speed on a loaded machine, so a cycle derived
   * in TICKS lands somewhere else in MS and the driver has to be able to walk
   * back to it. Halves on a reversal, for the reason `DEPTH_HOLD_STEP_MS`
   * records: a fixed step overshoots.
   */
  FEED_STEP_MS: 40,
  FEED_STEP_MIN_MS: 10,
  FEED_MIN_MS: 40,
  FEED_MAX_MS: 700,
  /** How often the descent loop re-reads whether the bar has reached the chest. */
  POLL_MS: 20,
});

export const SESSION_PROMPTS = Object.freeze({
  /**
   * BRACE. Nothing is asked for yet; the first press starts the descent.
   *
   * SQUAT'S, AND THE NAME DOES NOT SAY SO — read `LIFT_PROMPTS` above for the
   * other two. Left spelled this way rather than renamed because
   * `verify-shell-route.mjs` and `meetDrive.mjs` both import it by this name to
   * drive a SQUAT-shaped rep, which is what they mean; derived from the table
   * rather than typed twice so the two cannot drift.
   */
  BRACE: LIFT_PROMPTS.squat.BRACE,
  /** DESCENT. Depth is growing while the finger is down. Squat's, as above. */
  DESCENT: LIFT_PROMPTS.squat.DESCENT,
  /** ASCENT, with the drive cue open. The one press that matters. */
  DRIVE: 'DRIVE',
  /** The three things a resolved rep can say. */
  OUTCOMES: Object.freeze(['GOOD LIFT', 'GRINDER', 'NO LIFT']),
  /**
   * The two miss reasons that say a SQUAT'S RELEASE was mistimed, and in which
   * direction. Restated from `LIFT_COPY.MISS_REASON`.
   *
   * THE SENTENCE THAT USED TO FOLLOW THIS WAS TRUE OF SQUAT AND IS NOT TRUE OF
   * BENCH, so it is corrected rather than left standing. It said the other two
   * reasons "say the depth was fine and the ascent lost, so they are not
   * adapted on". On a squat that holds. On a bench there is no depth to be
   * fine: the descent's mistake is a bar that arrived too fast, which charges
   * `BENCH_TOUCH_DEMAND_PENALTY` against the ascent and shows up as the ascent
   * losing. So `adaptBenchDescent` DOES read them, in the other direction, and
   * says in its own header that the evidence is circumstantial rather than
   * naming the beat the way 'no-touch' does.
   */
  MISS_TOO_HIGH: 'short of depth',
  MISS_BURIED: 'Buried it',
  /**
   * BENCH ONLY, AND IT IS THE ONE MISS THE DESCENT CAN PRODUCE ON ITS OWN.
   * `LIFT_COPY.MISS_REASON['no-touch']` — the bar never reached the chest,
   * which needs the feed to stop and never restart. Three red lights in the
   * real sport, and the only failure a bench descent has that is not paid for
   * through the ascent.
   */
  MISS_NO_TOUCH: 'Never touched the chest.',
  /** The two the ascent loses, which bench's descent can CAUSE without naming. */
  MISS_STALLED: 'The bar beat you at the sticking point.',
  MISS_TIMEOUT: 'Ran out of air.',
});

/**
 * Every number the driver moves on, in one place.
 *
 * None of these are game feel — the game's feel values live in
 * `src/game/liftTuning.ts` and `src/game/sessionTuning.ts`. These are a
 * ROBOT'S REACTION TIMES, and they are here rather than inline for the same
 * reason: somebody re-tuning the mechanic has one place to look when the robot
 * stops keeping up with it.
 */
export const SESSION_DRIVE = Object.freeze({
  /** The three readiness answers, in the order GDD §3.2's check-in asks them. */
  CHECK_IN_TAPS: Object.freeze([
    'check-in-sleep-ok',
    'check-in-soreness-normal',
    'check-in-motivation-steady',
  ]),
  /**
   * ===========================================================================
   * THE SAME CHECK-IN, ANSWERED AT THE TOP OF THE LADDER — AND WHY A CALLER
   * WOULD WANT THAT
   * ===========================================================================
   * A caller that needs the played session to actually MOVE the lifter's e1RM
   * has to use these, because at the mid answers above it does not. MEASURED, on
   * the shipped tuning, playing every rep perfectly through the real mechanic on
   * a day-1 lifter — `sessionE1rmKg` against `STARTING_E1RM`:
   *
   *              seed    ok/normal/steady        good/fresh/fired-up
   *   squat      180     178.8 – 179.6  (no)     187.1 – 188.3  (PR)
   *   bench      120     117.1 – 119.5  (no)     123.3 – 125.4  (PR)
   *   deadlift   220     217.3 – 219.6  (no)     228.1 – 230.5  (PR)
   *
   * Across RPE 6, 7, 8, 9 and 10 — every RPE the briefing offers. So at the mid
   * answers there is NO RPE and NO LIFT on which a perfectly played first
   * session beats the signup seed, and `bestE1rmKg` is monotone, so the record
   * still reads exactly `STARTING_E1RM` afterwards.
   *
   * That matters to a check, not just to a playtester: `verify-shell-route.mjs`
   * asks whether meet day's openers follow the session that was just played, and
   * a lifter whose e1RM is still the seed is INDISTINGUISHABLE from the empty
   * record the defect fabricated. The comparison has nothing to bite on. Hence
   * the option, and hence these numbers written down rather than an adjective.
   *
   * NOT MADE THE DEFAULT, deliberately. The mid answers are what an ordinary
   * player's ordinary day looks like, and they are what the capture tools should
   * go on photographing.
   */
  BEST_CHECK_IN_TAPS: Object.freeze([
    'check-in-sleep-good',
    'check-in-soreness-fresh',
    'check-in-motivation-fired-up',
  ]),
  /** The RPE the driver picks. Mid-ladder: heavy enough to be a real session. */
  RPE_CHOICE: 'session-rpe-8',
  /**
   * The same ladder, answered near its top — the same pattern as
   * `BEST_CHECK_IN_TAPS` above, for the same reason: a caller that needs a
   * heavier load an ordinary player can choose has to ask for it explicitly.
   * `SESSION_TUNING.RPE_CHOICES` is `[6, 7, 8, 9, 10]`; this is the second
   * from the top, pressed through the briefing's own ladder button — a real
   * player decision offered on every session, not a debug override.
   * `driveAttemptsFor` (lift.ts) is 2 here, same as at every other choice on
   * the ladder including RPE 10 itself — never the 3 a `LOAD_PRESETS.MAXIMAL`
   * config reaches in tests, measured: percentOf1RM(REPS_PER_SET, 9) is
   * 89.2%, short of the ~100% loadRatio the third cue needs. So this reaches
   * the multi-cue ascent for real, and does not claim to reach every cue
   * count the mechanic has.
   *
   * RPE 9, NOT RPE 10 — chosen over the top choice for margin, not caution.
   * `driveAttemptsFor` is identical at both, but the SINGLE-TAP forgiveness
   * is not: measured via the pure sim, a press anywhere from dead-on-ideal to
   * +90ms late still grades a clean `good-lift` at every seed tried, +120ms
   * still wins as a `grind`, and only beyond +140ms (of a ~151ms half-window)
   * does it actually miss. At RPE 10 that same sweep started failing at
   * +100ms of a narrower ~147ms half-window — a real, load-scaled difference
   * (GDD's RPE-scaled precision axis working as designed), not noise. A
   * browser-driven tap is real wall-clock latency a fixed `waitForTimeout`
   * cannot fully account for (measured elsewhere in this file's own callers);
   * RPE 9's wider margin absorbs that without needing to land the delay
   * exactly, where RPE 10's did not.
   *
   * NOT MADE THE DEFAULT, for the same reason `BEST_CHECK_IN_TAPS` is not:
   * the mid-ladder choice is the ordinary day the capture tools should keep
   * photographing.
   */
  RPE_CHOICE_HEAVY: 'session-rpe-9',

  /** Let the briefing's reveal beat finish before choosing an RPE. */
  BRIEFING_SETTLE_MS: 600,
  /** Let the first set draw before touching it. */
  SET_SETTLE_MS: 400,

  /**
   * How long the finger stays down after the descent starts. See the header for
   * the band this sits in AND for why it sits above the ideal rather than in
   * the middle. A STARTING POINT, not a fixed value — see `DEPTH_HOLD_STEP_MS`.
   */
  DEPTH_HOLD_MS: 1000,
  /**
   * ===========================================================================
   * HOW MUCH THE DRIVER MOVES THE HOLD AFTER A MISTIMED RELEASE, AND WHY IT HAS
   * TO MOVE IT AT ALL
   * ===========================================================================
   * The band the hold has to land in is measured in SIM TICKS, and the sim does
   * not run at wall-clock speed on a loaded machine. `useLiftLoop` takes at most
   * `LIFT_TUNING.FEEDBACK.MAX_CATCH_UP_TICKS` (4) ticks per animation frame — a
   * deliberate choice, so a hitch slows a rep down instead of fast-forwarding
   * through the player's input. Below 15 fps the sim therefore falls behind the
   * clock, and a hold fixed ANYWHERE buys less depth than the header's 60 Hz
   * arithmetic says it should. (That is why `DEPTH_HOLD_MS` starts above the
   * ideal; this is why starting anywhere is not on its own enough.)
   *
   * That is not hypothetical either: a software-rendered browser under load
   * missed all five reps of a session on "came up short of depth", which is
   * precisely that failure, and left the close-out with nothing banked.
   *
   * So the driver reads WHY a rep missed and moves the hold in the direction the
   * miss names, HALVING THE STEP EACH TIME THE DIRECTION REVERSES — an ordinary
   * bisection, because a fixed step overshoots: a search stepping
   * 900 -> 1080 -> 1260 -> 1440 found a legal rep and then buried the next two
   * at the same hold. It does not need the machine to be fast, only consistent
   * for a few seconds at a time.
   */
  DEPTH_HOLD_STEP_MS: 180,
  /** The step stops halving here, so the search cannot stall on a rounding. */
  DEPTH_HOLD_STEP_MIN_MS: 40,
  DEPTH_HOLD_MIN_MS: 480,
  DEPTH_HOLD_MAX_MS: 1900,
  /** How long the finger stays down after the drive press, through lockout. */
  DRIVE_HOLD_EXTRA_MS: 150,
  /** Between one rep resolving and pressing for the next. */
  BETWEEN_REPS_MS: 200,
  /**
   * How long to wait, after a rep resolves, for the loop to move off the
   * result beat. `SESSION_TUNING.REP_RESULT_HOLD_MS` holds the outcome on
   * screen before the session state advances, so the beat after a rep is
   * neither the next rep nor the rest — it is the same set, still saying
   * "GOOD LIFT". Pressing into it is what gets a press swallowed.
   */
  AFTER_REP_TIMEOUT_MS: 8000,

  /** How often the driver re-reads which beat the mechanic is on. */
  POLL_MS: 25,

  /**
   * Deadlines. Each one is generous: this is a software-rendered browser on a
   * loaded machine, and every one of these is "the app has stopped responding",
   * not "the app was slow".
   */
  BRACE_TIMEOUT_MS: 8000,
  DESCENT_TIMEOUT_MS: 8000,
  ASCENT_TIMEOUT_MS: 12000,
  REST_TIMEOUT_MS: 20000,
  FIRST_SET_TIMEOUT_MS: 120000,
  CLOSE_OUT_TIMEOUT_MS: 240000,
  /** How long to wait for the surface a pressed close-out lands on. */
  AFTER_DONE_TIMEOUT_MS: 20000,
  /**
   * How long the close-out's numbers get to stop being provisional.
   *
   * `SESSION_BOUNDARY.LOCAL_SERVER_LATENCY_MS` is 550, so this is generous by
   * more than an order of magnitude. It is a deadline rather than a sleep
   * because "the server's answer lands" is a falsifiable claim and a fixed
   * sleep would not make it one.
   */
  CLOSE_OUT_SETTLE_TIMEOUT_MS: 15000,

  /**
   * The close-out's two certainty tags — the elements `waitForCloseOutSettled`
   * watches to know the server's answer landed.
   *
   * NAMED AND EXPORTED, because that function counts an ABSENT tag as settled.
   * That is right (the accessory close-out has no e1RM row, and "no number to
   * be unsure about" is not "unsure") and it is also the shape of a check that
   * cannot fail: rename BOTH of these and the one check written to catch a
   * round trip that never completes returns settled at 0 ms over an empty DOM.
   * So the wait reports which of them it ever saw and the caller asserts it saw
   * one — and the caller can name them in its failure text without a third
   * copy of the strings.
   */
  CLOSE_OUT_TAG_IDS: Object.freeze({
    e1rm: 'close-out-e1rm-tag',
    streak: 'close-out-streak-tag',
  }),

  /**
   * A hard stop on the rep loop. GDD §3.2's session is
   * SESSION_TUNING.WORK_SETS (5) x REPS_PER_SET (3) = 15 reps at the very most,
   * and a missed rep ENDS its set, so the real number is lower. Anything past
   * this means the loop is not advancing and the driver should say so rather
   * than spin.
   */
  MAX_REPS: 25,
});

/** The text of one testID, or null when it is not in the DOM. */
async function textOf(page, id) {
  return page.evaluate((wanted) => {
    const node = document.querySelector(`[data-testid="${wanted}"]`);
    return node === null ? null : node.textContent;
  }, id);
}

/**
 * Which beat of the loop is on screen, and what the mechanic is saying.
 *
 * One `evaluate` per poll rather than several, because the mechanic runs at
 * 60 Hz and four round trips per look is four chances to read a torn frame.
 */
export async function readLoop(page) {
  return page.evaluate(() => {
    const has = (id) => document.querySelector(`[data-testid="${id}"]`) !== null;
    const text = (id) => {
      const node = document.querySelector(`[data-testid="${id}"]`);
      return node === null ? null : node.textContent;
    };
    return {
      set: has('session-set'),
      rest: has('session-rest'),
      closeOut: has('session-close-out'),
      checkIn: has('session-check-in'),
      briefing: has('session-briefing'),
      alreadyTrained: has('session-already-trained'),
      prompt: text('session-prompt'),
      detail: text('session-detail'),
      setLabel: text('session-set-label'),
      weight: text('session-weight'),
      action: text('close-out-action'),
    };
  });
}

/** Poll `readLoop` until `done(state)` is true, or the deadline passes. */
async function until(page, done, timeoutMs) {
  const started = Date.now();
  for (;;) {
    const state = await readLoop(page);
    if (done(state)) return { ok: true, state, ms: Date.now() - started };
    if (Date.now() - started >= timeoutMs) {
      return { ok: false, state, ms: Date.now() - started };
    }
    await page.waitForTimeout(SESSION_DRIVE.POLL_MS);
  }
}

const saying = (state, phrase) => state.prompt !== null && state.prompt.includes(phrase);
const resolved = (state) =>
  SESSION_PROMPTS.OUTCOMES.some((outcome) => saying(state, outcome));

/**
 * Launch the app with NO QUERY STRING and play GDD §3.2's opening beats with a
 * mouse: three readiness answers, then an RPE. Returns when the first work set
 * is on screen.
 *
 * This is the played path, not a scripted one. `?session=` frames cannot be
 * used here: they set `preview`, and everything past the check-in in this
 * function depends on the loop being live.
 */
/**
 * @param checkInTaps which three readiness answers to press. Defaults to
 * `SESSION_DRIVE.CHECK_IN_TAPS` — an ordinary day. Pass
 * `SESSION_DRIVE.BEST_CHECK_IN_TAPS` when the caller needs the session to move
 * the lifter's e1RM; the block above that constant has the measurements.
 * @param rpeChoice which RPE-ladder testID to press. Defaults to
 * `SESSION_DRIVE.RPE_CHOICE` — the mid-ladder choice every other caller of
 * this function keeps getting. Pass `SESSION_DRIVE.RPE_CHOICE_HEAVY` when the
 * caller needs a heavier load an ordinary player can choose; see that
 * constant for what it does and does not reach, and why it is not RPE 10.
 * @param lift which competition lift to train, or `null` to take the day's
 * programmed one.
 *
 * ===========================================================================
 * WHY A CALLER SHOULD ALMOST ALWAYS PASS ONE — MEASURED, NOT A PREFERENCE
 * ===========================================================================
 * The default is NOT squat. It is `liftForDay(streakDayFromLocalWallClock(...))`
 * (`useSession.ts`), which is `SESSION_TUNING.LIFT_ROTATION` indexed by the
 * REAL CALENDAR — so which lift this function lands on changes every midnight.
 * Measured on the machine this was written on: day index 20688 is squat, 20689
 * is bench, 20690 is deadlift. A caller that leaves this null and then drives a
 * squat-shaped rep works one day in three and reports a wall of timeouts on the
 * other two.
 *
 * Passing a `lift` presses `check-in-lift-<kind>` — a chip `CheckInView.tsx`
 * renders for every entry of `LIFT_ROTATION`, one tap, on the first paint of
 * the check-in. It is an ordinary player control (GDD §3.2: "the player may
 * choose a different competition lift on the check-in"), NOT a debug route and
 * NOT a query string, which is what lets a check driven through it still claim
 * the played arm.
 *
 * PRESSED BEFORE THE THREE READINESS TAPS, deliberately: the third tap
 * completes the check-in and the session leaves that screen, and `choose-lift`
 * is only legal while it is still on it.
 */
export async function openSessionToFirstSet(
  page,
  url,
  checkInTaps = SESSION_DRIVE.CHECK_IN_TAPS,
  rpeChoice = SESSION_DRIVE.RPE_CHOICE,
  lift = null,
) {
  await page.goto(url, { waitUntil: 'load' });
  await page
    .getByTestId('check-in-sleep-good')
    .waitFor({ state: 'visible', timeout: SESSION_DRIVE.FIRST_SET_TIMEOUT_MS });

  const startedAt = Date.now();
  // THE LIFT CHOICE, FIRST. See the `lift` parameter's own block above for why
  // it is here rather than after the three answers, and for what the default
  // actually is. Reported, not thrown, the same way the answers below are.
  if (lift !== null) {
    try {
      await page.getByTestId(checkInLiftTestId(lift)).click({ timeout: 20000 });
    } catch {
      return {
        reached: false,
        why: `the check-in offered no ${checkInLiftTestId(lift)} chip to press — GDD §3.2's lift choice is not on this screen`,
      };
    }
  }
  // Reported, not thrown. A check-in answer that cannot be pressed — covered by
  // something, or gone — is a fact about the app, and the caller has to be able
  // to say which one it was rather than die inside the harness.
  for (const id of checkInTaps) {
    try {
      await page.getByTestId(id).click({ timeout: 20000 });
    } catch {
      return { reached: false, why: `the check-in answer ${id} could not be pressed` };
    }
  }

  try {
    await page
      .getByTestId('session-briefing')
      .waitFor({ state: 'visible', timeout: SESSION_DRIVE.BRACE_TIMEOUT_MS });
  } catch {
    return { reached: false, why: 'the three check-in answers never produced a briefing' };
  }
  await page.waitForTimeout(SESSION_DRIVE.BRIEFING_SETTLE_MS);

  try {
    await page.getByTestId(rpeChoice).click();
  } catch {
    return { reached: false, why: `the briefing had no ${rpeChoice} to press` };
  }
  try {
    await page
      .getByTestId('session-set')
      .waitFor({ state: 'visible', timeout: SESSION_DRIVE.BRACE_TIMEOUT_MS });
  } catch {
    return { reached: false, why: 'choosing an RPE never produced a work set' };
  }
  await page.waitForTimeout(SESSION_DRIVE.SET_SETTLE_MS);

  // THE POSITIVE CONTROL ON THE PROMPT TABLE. If the mechanic's copy has moved,
  // say so HERE — where it is one legible sentence — rather than letting every
  // rep below time out and reporting a wall of deadlines.
  // THE POSITIVE CONTROL, AGAINST THE LADDER OF THE LIFT THAT WAS ASKED FOR.
  // When a `lift` was chosen this is the check that the CHIP TOOK EFFECT — a
  // deadlift session that opens on 'TAP AND HOLD TO DESCEND' has fallen back to
  // squat's phase model, which is a real defect this repository has shipped
  // once (`repConfigFor`'s deleted `simKindFor` stopgap) and is exactly what a
  // silent fallback looks like from here.
  const wantedBrace = lift === null ? SESSION_PROMPTS.BRACE : LIFT_PROMPTS[lift].BRACE;
  const first = await readLoop(page);
  if (!saying(first, wantedBrace)) {
    // WHICH LADDER DID IT MATCH, IF ANY — because the two causes need
    // different fixes and the old message named only one of them. A prompt
    // that is another LIFT'S brace line means the chip did not take (or, with
    // no chip pressed, that the calendar rotated under a squat-shaped caller);
    // a prompt that matches no ladder at all means the copy moved.
    const matched = Object.entries(LIFT_PROMPTS)
      .filter(([, ladder]) => first.prompt !== null && first.prompt.includes(ladder.BRACE))
      .map(([kind]) => kind);
    return {
      reached: false,
      unrecognisedPrompt: first.prompt,
      matchedKinds: matched,
      why:
        matched.length > 0
          ? `the first set says ${JSON.stringify(first.prompt)}, which is ${matched.join('/')}'s brace line and not ${lift === null ? 'squat' : lift}'s — the session is on a different lift than this driver asked for (the default is the CALENDAR'S rotation, see openSessionToFirstSet's \`lift\` parameter)`
          : `the first set says ${JSON.stringify(first.prompt)}, which matches no lift's brace line in LIFT_PROMPTS — the mechanic's copy has moved`,
    };
  }
  return {
    reached: true,
    msFromFirstTapToSet: Date.now() - startedAt,
    state: first,
    lift,
  };
}

/**
 * Play ONE rep on the stage, from the brace to the resolution.
 *
 * Waits for the brace before pressing, deliberately. `useLiftLoop` DROPS input
 * while the previous rep is `RESOLVED`, so a press sent the instant the state
 * machine advances is swallowed and the next rep then sits in its brace until
 * `BRACE_TIMEOUT_TICKS` — ten seconds of nothing, once per rep. Pressing only
 * once the brace prompt is up costs a poll and saves that.
 */
export async function playOneRep(page, holdMs = SESSION_DRIVE.DEPTH_HOLD_MS) {
  const braced = await until(page, (s) => saying(s, SESSION_PROMPTS.BRACE), SESSION_DRIVE.BRACE_TIMEOUT_MS);
  if (!braced.ok) {
    return { played: false, why: `no brace to press — prompt was ${JSON.stringify(braced.state.prompt)}` };
  }

  const box = await page.getByTestId('session-touch').boundingBox().catch(() => null);
  if (box === null) return { played: false, why: 'the set has no touch stage' };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  // Down through the brace. The mechanic counts a finger ALREADY DOWN when the
  // brace ends, so this does not have to be timed.
  await page.mouse.down();
  const descending = await until(
    page,
    (s) => saying(s, SESSION_PROMPTS.DESCENT) || resolved(s) || !s.set,
    SESSION_DRIVE.DESCENT_TIMEOUT_MS,
  );
  if (!descending.ok || !saying(descending.state, SESSION_PROMPTS.DESCENT)) {
    await page.mouse.up();
    return {
      played: false,
      why: `holding never started a descent — prompt was ${JSON.stringify(descending.state.prompt)}`,
    };
  }

  // The one guessed number. See the header for the band it sits in, and
  // `DEPTH_HOLD_STEP_MS` for why the caller is allowed to move it.
  await page.waitForTimeout(holdMs);
  await page.mouse.up();

  const drive = await until(
    page,
    (s) => saying(s, SESSION_PROMPTS.DRIVE) || resolved(s) || !s.set,
    SESSION_DRIVE.ASCENT_TIMEOUT_MS,
  );
  if (saying(drive.state, SESSION_PROMPTS.DRIVE)) {
    await page.mouse.down();
    const ended = await until(page, (s) => resolved(s) || !s.set, SESSION_DRIVE.ASCENT_TIMEOUT_MS);
    await page.waitForTimeout(SESSION_DRIVE.DRIVE_HOLD_EXTRA_MS);
    await page.mouse.up();
    return {
      played: true,
      holdMs,
      outcome: ended.state.prompt,
      detail: ended.state.detail,
      setLabel: ended.state.setLabel,
      drove: true,
    };
  }
  // No drive cue arrived: either the rep was already over (a buried or high
  // release) or the ascent ran out. Both are outcomes, not harness failures.
  return {
    played: true,
    holdMs,
    outcome: drive.state.prompt,
    detail: drive.state.detail,
    setLabel: drive.state.setLabel,
    drove: false,
  };
}

/** The search's whole state: where the hold is, how big a step, which way last. */
export function freshDepthSearch() {
  return {
    holdMs: SESSION_DRIVE.DEPTH_HOLD_MS,
    stepMs: SESSION_DRIVE.DEPTH_HOLD_STEP_MS,
    lastDirection: 0,
  };
}

/**
 * The search state to use for the NEXT rep, given how this one ended.
 *
 * Pure, so the adaptation is one readable rule rather than something buried in
 * the loop. Only the two miss reasons that name the RELEASE move it: a rep the
 * ascent lost, or a rep that was made, says nothing about the depth and must
 * not nudge it.
 */
export function adaptDepthSearch(search, rep) {
  const detail = rep.detail ?? '';
  const direction = detail.includes(SESSION_PROMPTS.MISS_TOO_HIGH)
    ? 1
    : detail.includes(SESSION_PROMPTS.MISS_BURIED)
      ? -1
      : 0;
  if (direction === 0) return search;
  const reversed = search.lastDirection !== 0 && direction !== search.lastDirection;
  const stepMs = reversed
    ? Math.max(SESSION_DRIVE.DEPTH_HOLD_STEP_MIN_MS, Math.round(search.stepMs / 2))
    : search.stepMs;
  const holdMs = Math.min(
    SESSION_DRIVE.DEPTH_HOLD_MAX_MS,
    Math.max(SESSION_DRIVE.DEPTH_HOLD_MIN_MS, search.holdMs + direction * stepMs),
  );
  return { holdMs, stepMs, lastDirection: direction };
}

/**
 * Play reps — and sit through the rest beats, which advance themselves — until
 * GDD §3.2's close-out is on screen.
 *
 * Returns `reachedCloseOut: false` with a reason rather than throwing. The
 * caller turns that into a named failed check; it is not this module's place to
 * decide it was a failure at all.
 */
export async function playSessionToCloseOut(page) {
  const reps = [];
  const startedAt = Date.now();
  let search = freshDepthSearch();

  for (;;) {
    const state = await readLoop(page);
    if (state.closeOut) {
      return {
        reachedCloseOut: true,
        reps,
        holdMs: search.holdMs,
        action: state.action,
        ms: Date.now() - startedAt,
      };
    }
    if (state.rest) {
      // GDD §3.2's rest beat runs itself out (SESSION_TUNING.SET_REST_MS) and
      // hands the next set back. Nothing to press.
      const next = await until(page, (s) => !s.rest, SESSION_DRIVE.REST_TIMEOUT_MS);
      if (!next.ok) {
        return { reachedCloseOut: false, reps, holdMs: search.holdMs, why: 'the rest beat never handed back a set' };
      }
      continue;
    }
    if (!state.set) {
      return {
        reachedCloseOut: false,
        reps,
        holdMs: search.holdMs,
        why: `the loop left the sets without closing out (check-in=${state.checkIn} briefing=${state.briefing})`,
      };
    }
    if (reps.length >= SESSION_DRIVE.MAX_REPS) {
      return {
        reachedCloseOut: false,
        reps,
        holdMs: search.holdMs,
        why: `played ${reps.length} reps without reaching a close-out — the loop is not advancing`,
      };
    }
    if (Date.now() - startedAt >= SESSION_DRIVE.CLOSE_OUT_TIMEOUT_MS) {
      return { reachedCloseOut: false, reps, holdMs: search.holdMs, why: 'the session ran past its deadline' };
    }

    const rep = await playOneRep(page, search.holdMs);
    reps.push(rep);
    if (!rep.played) {
      return { reachedCloseOut: false, reps, holdMs: search.holdMs, why: rep.why };
    }
    search = adaptDepthSearch(search, rep);
    await page.waitForTimeout(SESSION_DRIVE.BETWEEN_REPS_MS);
    // The result beat holds the outcome on screen before the session advances.
    // Wait it out here rather than in `playOneRep`, so the next thing the loop
    // reads is the beat the session is actually on.
    await until(
      page,
      (s) => saying(s, SESSION_PROMPTS.BRACE) || s.rest || s.closeOut || !s.set,
      SESSION_DRIVE.AFTER_REP_TIMEOUT_MS,
    );
  }
}

/**
 * Wait for the close-out to stop showing provisional numbers.
 *
 * ===========================================================================
 * WHY A DRIVER HAS TO WAIT HERE, AND WHY IT IS NOT A SLEEP
 * ===========================================================================
 * GDD §3.2's close-out is the payoff beat: it renders the session's e1RM and
 * streak with a tag saying how sure each one is, blanks the tag when the server
 * confirms, and the confirmed value wins on screen. A driver that pressed DONE
 * the instant the screen appeared would be pressing inside the round trip —
 * which no player reading their numbers does, and which lands somewhere else,
 * because `restartDay` rebuilds the day from whatever the cache says at that
 * moment.
 *
 * This waits for the tags to go blank rather than sleeping for the latency, so
 * "the answer landed" is something the caller can assert and see fail. It is
 * the check that catches a round trip that never completes — which is exactly
 * the defect this driver found on its first real run: the close-out sat on
 * "SAVING" for ever because the effect that submitted it cancelled its own
 * in-flight request.
 *
 * A tag element that is absent counts as settled: the accessory close-out has
 * no e1RM row at all, and "no number to be unsure about" is not "unsure".
 *
 * ===========================================================================
 * WHICH IS WHY IT ALSO REPORTS WHAT IT SAW
 * ===========================================================================
 * "Absent counts as settled" makes `settled: true` reachable WITHOUT LOOKING AT
 * ANYTHING: rename both of `SESSION_DRIVE.CLOSE_OUT_TAG_IDS` and this returns
 * on its first poll, at `ms: 0`, and the caller's check passes green over a DOM
 * it never found. So `tagsSeen` is every tag that was IN THE DOM at any poll —
 * present, not pending, so a screen that had already settled still counts — and
 * `sawAnyTag` is the positive control the caller asserts on. `settled` on its
 * own is not evidence; `settled` with a tag behind it is.
 */
export async function waitForCloseOutSettled(page) {
  const readTags = () =>
    page.evaluate((ids) => {
      const out = {};
      for (const [key, id] of Object.entries(ids)) {
        const node = document.querySelector(`[data-testid="${id}"]`);
        out[key] = node === null ? null : (node.textContent ?? '').trim();
      }
      return out;
    }, SESSION_DRIVE.CLOSE_OUT_TAG_IDS);

  const started = Date.now();
  const seen = new Set();
  for (;;) {
    const tags = await readTags();
    for (const [key, text] of Object.entries(tags)) {
      if (text !== null) seen.add(key);
    }
    const tagsSeen = [...seen].sort();
    const sawAnyTag = tagsSeen.length > 0;
    const pending = Object.entries(tags).filter(([, text]) => text !== null && text !== '');
    if (pending.length === 0) {
      return { settled: true, ms: Date.now() - started, tags, tagsSeen, sawAnyTag };
    }
    if (Date.now() - started >= SESSION_DRIVE.CLOSE_OUT_SETTLE_TIMEOUT_MS) {
      return {
        settled: false,
        ms: Date.now() - started,
        tags,
        tagsSeen,
        sawAnyTag,
        why: `still ${pending.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')} after ${SESSION_DRIVE.CLOSE_OUT_SETTLE_TIMEOUT_MS}ms`,
      };
    }
    await page.waitForTimeout(SESSION_DRIVE.POLL_MS);
  }
}

/**
 * Press the close-out's one action and report WHICH surface came up.
 *
 * Three outcomes and they mean different things, so they are distinguished by
 * testID rather than by reading the button's label:
 *
 *   'already-trained' — the session was banked, `restartDay` rebuilt the day
 *                       against a cache that now records it, and GDD §3.2's one
 *                       session a day says no. THE TERMINAL SCREEN OF THE LOOP.
 *   'check-in'        — a new session was offered, so nothing was banked.
 *   'briefing'        — the close-out's action was the RETRY it shows when a
 *                       session banked no reps at all.
 */
export async function pressCloseOutAction(page) {
  try {
    await page.getByTestId('close-out-action').click({ timeout: 20000 });
  } catch {
    return { landedOn: null, why: 'the close-out had no action to press' };
  }
  const landed = await until(
    page,
    (s) => s.alreadyTrained || s.checkIn || s.briefing,
    SESSION_DRIVE.AFTER_DONE_TIMEOUT_MS,
  );
  if (!landed.ok) {
    return { landedOn: null, why: 'pressing the close-out’s action landed on nothing' };
  }
  const landedOn = landed.state.alreadyTrained
    ? 'already-trained'
    : landed.state.briefing
      ? 'briefing'
      : 'check-in';
  return { landedOn, state: landed.state };
}

/**
 * ===========================================================================
 * THE ASCENT — ONE IMPLEMENTATION, THREE LIFTS, TWO SCREENS
 * ===========================================================================
 * The two functions below were `tools/verify-lift-press.mjs`'s and are MOVED
 * here rather than copied, for the reason that file's own header gives about
 * them: this loop is where four separate real bugs were found and fixed, and a
 * second copy of it would be four bugs waiting to be re-introduced one at a
 * time. `tools/meetDrive.mjs` needs the identical beat on meet day — GDD §6.2's
 * attempt is `AttemptView` mounting the same `useLiftLoop` `SetView` does — so
 * the choice was one shared function or a fifth instance of the defect
 * CLAUDE.md names ("a guard written for one hook must be applied to its
 * sibling, mechanically").
 *
 * TWO THINGS ARE THE CALLER'S, AND BOTH ARE THE REASON THIS IS PARAMETERISED
 * RATHER THAN GLOBAL:
 *
 *   `read`    which testIDs the beat is read off. A training set says
 *             `session-prompt`; a meet attempt says `attempt-prompt`. Same
 *             `promptFor`, two screens.
 *   `timing`  A ROBOT'S REACTION TIMES, which are NOT transferable between the
 *             two arms and must not be pretended to be. `verify-lift-press.mjs`
 *             derived `FULL_CYCLE`'s four numbers against the SESSION's loads
 *             (RPE 9 and RPE 10 ladder rungs), in a header that runs to eighty
 *             lines of measurement; a meet attempt runs at ~0.90-0.97 of e1RM
 *             off `OPENER_FRACTION_OF_1RM` and its own jump table. Hoisting one
 *             arm's constants into a shared module would make one set of
 *             measurements silently claim to describe both. So the SHAPE is
 *             shared and the NUMBERS stay where they were measured.
 */

/**
 * The default `hasLeft`: the screen the rep is on never goes away mid-rep.
 *
 * TRUE OF THE SESSION and false of meet day — see `hasLeft` in the block below.
 * Named rather than written inline as `() => false` at two call sites, so the
 * two defaults cannot drift apart.
 */
const NEVER_LEFT = () => false;

/** The reaction times `tapDriveCuesToLockout` moves on. All four are required. */
/**
 * @typedef {object} AscentTiming
 * @property {number} aimDelayMs        after a cue is seen open, before the tap
 * @property {number} tapMs             how long each tap's mouse.down is held
 * @property {number} settleMs          after a tap, before reading the state
 * @property {number} minCueSpacingMs   the floor below which a still-open cue
 *                                      display cannot be a NEW cue
 * @property {number} driveTimeoutMs    "the ascent has stopped advancing"
 * @property {number} pollMs            how often `read` is re-run
 */

/**
 * Poll `read(page)` until `predicate` holds, returning the reading that
 * satisfied it, or `null` on the deadline.
 *
 * The generic twin of `until` above: that one is hard-wired to `readLoop` and
 * to `done(state)` over the session's own fields; this one takes the reader,
 * because the meet's screen is a different set of testIDs saying the same
 * things. Both return the reading rather than a boolean, for the reason
 * `verify-lift-press.mjs` records: waiting on a cue and then reading state
 * separately races the app's own automatic next-rep reset, and the second read
 * can already belong to a different rep.
 */
export async function untilRead(page, read, predicate, timeoutMs, pollMs) {
  const started = Date.now();
  for (;;) {
    const reading = await read(page);
    if (predicate(reading)) return reading;
    if (Date.now() - started >= timeoutMs) return null;
    await page.waitForTimeout(pollMs);
  }
}

/**
 * TAP EVERY ARMED DRIVE CUE UNTIL THE BAR LOCKS OUT — ONE IMPLEMENTATION,
 * SHARED BY EVERY LIFT THAT HAS AN ASCENT, WHICH IS ALL THREE.
 *
 * ===========================================================================
 * WHY THIS IS A FUNCTION AND NOT A SECOND COPY
 * ===========================================================================
 * CLAUDE.md: "A guard written for one hook — or one FIXTURE, or one ARM OF ONE
 * `if` — must be applied to its sibling, mechanically… proximity is not
 * protection, it is the RISK." This loop is where four separate real bugs were
 * found and fixed (a phantom re-tap that burned one of only a few cue slots; an
 * evidence snapshot eating the aim window's own margin; a win showing GRINDER
 * filed as a miss; a miss reason read late enough to belong to the NEXT rep).
 * A second, deadlift-shaped copy of it would be four bugs waiting to be
 * re-introduced one at a time, and the copy that drifted would be the one
 * nobody re-read.
 *
 * The body below is the SESSION arm's loop VERBATIM, with two things lifted
 * out:
 *
 *   - the three evidence snapshots, which are callbacks now, so PROBE 3 keeps
 *     its `attemptN-6-drive-tap-K-settled` phase labels exactly as they were
 *     and the ladder probe can do something else entirely at the same three
 *     instants — including, on a deadlift, CLAMPING DOWN at `onLockout`, which
 *     is that lift's whole check;
 *   - `'LOCK IT'`, which was hardcoded. IT IS SQUAT AND BENCH COPY —
 *     `LIFT_COPY.PROMPT.LOCKOUT` is per kind and a deadlift's line is
 *     "DON'T LET GO" — so on a deadlift the old literal could never match and
 *     the loop could only ever exit through its outcome arm. Latent rather
 *     than live, because nothing had ever driven a deadlift through here;
 *     parameterised rather than left to be discovered by whoever did first.
 */
/**
 * WAIT UNTIL A DRIVE CUE IS OPEN — `tapDriveCuesToLockout`'S PRECONDITION,
 * EXTRACTED SO BOTH ITS CALLERS ACTUALLY HAVE IT.
 *
 * ===========================================================================
 * WHY THIS IS A FUNCTION AND NOT A COMMENT ON THE LOOP
 * ===========================================================================
 * That loop TAPS AT THE TOP OF ITS FIRST ITERATION, deliberately and for a
 * measured reason (see `AIM_FOR_CENTER_DELAY_MS`). So it is only correct when
 * it is entered with a cue ALREADY open, and `probeFullRepCycle` satisfied that
 * with an inline wait immediately above the call.
 *
 * THE SECOND CALLER DID NOT, AND THE RUN CAUGHT IT. `driveLadderRep` went
 * straight from the deadlift's pull into the loop, so its first tap was
 * dispatched blind — measured in the page's own pointer stream against its own
 * frame stream: `pointerdown@2742` while the live prompt was "RIDE IT", with
 * the first "DRIVE — TAP" frame not painted until 3253. `stepLift` grades a
 * press with `activeCue === null` a full window early, so that tap was a
 * `missed` timing, a velocity penalty, and one of only 3 drive slots the load
 * offers — spent on nothing, on every rep, silently.
 *
 * That is CLAUDE.md's "a guard written for one hook must be applied to its
 * sibling, mechanically" arriving as a PRECONDITION rather than as a guard, and
 * the fix is the same shape: one function both callers call, rather than a
 * sentence in a header the second caller did not read.
 *
 *
 * `hasLeft` IS THE MEET'S, AND IT IS A PARAMETER RATHER THAN A SHARED
 * ASSUMPTION BECAUSE THE TWO SCREENS GENUINELY DIFFER. A training set holds its
 * outcome on screen for `SESSION_TUNING.REP_RESULT_HOLD_MS`, so a poll that
 * arrives late still reads 'GOOD LIFT'. `AttemptView` hands the resolution
 * straight to the judges in the effect that fires the tick it resolves (GDD
 * §6.2 step 4 — "the silence before the lights is the verdict screen's"), so
 * `meet-attempt` can be gone before this loop's next poll and every reading
 * after that is `prompt: null`. Without this the loop would sit out its whole
 * `driveTimeoutMs` on EVERY made attempt and report `finalOutcome: null` about
 * a rep that was won. It defaults to a predicate that is never true, so the
 * session arm's behaviour is byte-for-byte what it was.
 *
 * `lockoutPrompt` is optional and defaults to null, which is
 * `probeFullRepCycle`'s behaviour EXACTLY as it was — that caller must not
 * break on its own 'LOCK IT', because a squat that reaches LOCKOUT resolves
 * within `lockoutTicks` and the outcome is what its miss-handling arm reads. A
 * deadlift's LOCKOUT is the opposite: it is a beat that lasts, and a rep that
 * reached it without ever arming a cue must be recognised there rather than
 * waited out to a timeout.
 */
export async function awaitFirstDriveCue(page, { read, timing, lockoutPrompt = null, hasLeft = NEVER_LEFT }) {
  const ended = await untilRead(
    page,
    read,
    (loop) =>
      hasLeft(loop) ||
      (loop.prompt !== null && loop.prompt.includes(SESSION_PROMPTS.DRIVE)) ||
      (lockoutPrompt !== null && loop.prompt !== null && loop.prompt.includes(lockoutPrompt)) ||
      SESSION_PROMPTS.OUTCOMES.includes(loop.prompt),
    timing.driveTimeoutMs,
    timing.pollMs,
  );
  const said = (line) => ended !== null && ended.prompt !== null && line !== null && ended.prompt.includes(line);
  const left = ended !== null && hasLeft(ended);
  return { cueOpen: !left && said(SESSION_PROMPTS.DRIVE), lockedOut: !left && said(lockoutPrompt), left, loop: ended };
}

export async function tapDriveCuesToLockout(page, { read, timing, lockoutPrompt, onTap, onSettled, onLockout, hasLeft = NEVER_LEFT }) {
  let drivesTapped = 0;
  let lockedOut = false;
  let finalOutcome = null;
  let left = false;
  for (;;) {
    // TAP AS SOON AS THIS LOOP SEES THE CUE — deliberately, not merely
    // convenient. `promptFor` starts showing 'DRIVE — TAP' at
    // `cue.openTick` (lift.ts), the window's LEADING edge, and at this
    // arm's load that edge is ALREADY a winning point (measured via the
    // pure sim; see AIM_FOR_CENTER_DELAY_MS's own header for the numbers
    // and for why that was not true at the RPE this arm tried first).
    // Waiting only spends margin toward the window's one losing edge.
    await page.waitForTimeout(timing.aimDelayMs);
    await page.mouse.down();
    await page.waitForTimeout(timing.tapMs);
    await page.mouse.up();
    drivesTapped += 1;
    // This IS the "cue was open, a tap was dispatched" evidence — taken
    // here, right after dispatch, rather than as a separate call before
    // it. See the comment above this loop for why: a snapshot before the
    // tap is not free, and its cost was eating the aim delay's own budget.
    await onTap(drivesTapped);

    // A beat for the state machine to land on whatever is next before this
    // asks. RIDE IT between cues (ASCENT_AFTER_CUE) is exactly this window
    // — `driveSpacingTicks` guarantees it is non-empty (measured: ~450ms at
    // RPE_CHOICE_HEAVY's loadRatio, comfortably above this settle) — and
    // asking immediately risks a snapshot mid-transition.
    await page.waitForTimeout(timing.settleMs);
    await onSettled(drivesTapped);

    // DO NOT DECIDE WHETHER TO TAP AGAIN FROM THIS READING. Measured: a tap
    // that landed cleanly can still show 'DRIVE — TAP' on screen for a beat
    // after the sim has already accepted it and moved on — display lag, not
    // an unconsumed cue. Acting on that reading re-taps into an
    // ALREADY-RESOLVED cue: the press lands with `activeCue === null`,
    // grades a full window early (a MISS), and silently burns one of
    // `driveAttemptsFor`'s slots — 4 at this arm's load after the Finding
    // 2 retune, so losing one to a phantom re-tap still costs a quarter of
    // the whole ascent's cues.
    // No cue can legitimately arm before `driveSpacingTicks` elapses
    // (`lift.ts`), so waiting out that floor before reading again removes
    // the window where a lingering display could be misread as a new cue.
    // SPEND THE SPACING FLOOR WATCHING FOR LOCKOUT RATHER THAN SLEEPING
    // THROUGH IT — and the reason is a measured 300 ms, not tidiness.
    //
    // This used to be a flat `waitForTimeout`. On a DEADLIFT the tick the bar
    // locks out on is the tick the hold starts, and `LOCKOUT_GRIP_GRACE_TICKS`
    // gives the finger 10 ticks (~167 ms) to come back down before the bar
    // starts sagging. A bar that locked out early in this sleep was therefore
    // not noticed for up to `BETWEEN_CUES_SETTLE_MS + spacingFloorRemaining` —
    // 280 ms — and the clamp landed outside the grace. Measured across five
    // real runs the re-grip came in at 2, 30, 31, 122 and 300 ms, and the
    // 300 ms one cost its rep a clean lift.
    //
    // The obvious alternative was to widen the check that noticed, which
    // CLAUDE.md refuses by name ("a threshold chosen to make a check stop
    // failing is a threshold that will hide the next real failure at the same
    // site"), so the sleep is what changed instead. Both spreads in this
    // paragraph are browser measurements taken against `18ef5b7`.
    //
    // THE PHANTOM-RE-TAP GUARD THIS FLOOR EXISTS FOR IS UNTOUCHED. That guard
    // is about not treating a LINGERING 'DRIVE — TAP' display as a fresh cue,
    // and this wait still refuses to return early on a DRIVE prompt — it breaks
    // only on the LOCKOUT line, which no lingering cue can produce. A timeout
    // here returns null and is exactly the old sleep.
    const spacingFloorRemaining = timing.minCueSpacingMs - timing.settleMs;
    if (spacingFloorRemaining > 0) {
      await untilRead(
        page,
        read,
        (loop) => lockoutPrompt !== null && loop.prompt !== null && loop.prompt.includes(lockoutPrompt),
        spacingFloorRemaining,
        timing.pollMs,
      );
    }

    const next = await untilRead(
      page,
      read,
      (loop) =>
        hasLeft(loop) ||
        (loop.prompt !== null && (loop.prompt.includes(lockoutPrompt) || loop.prompt.includes(SESSION_PROMPTS.DRIVE))) ||
        SESSION_PROMPTS.OUTCOMES.includes(loop.prompt),
      timing.driveTimeoutMs,
      timing.pollMs,
    );
    // WON IS NOT ONLY THE LITERAL `lockoutPrompt` FRAME (squat/bench 'LOCK IT'). `SESSION_PROMPTS.OUTCOMES`
    // is `['GOOD LIFT', 'GRINDER', 'NO LIFT']` — only the last is an actual
    // miss. LOCKOUT_TICKS at this arm's load is short enough (~230ms) that
    // this loop's own poll can land AFTER it, catching RESOLVED with
    // 'GRINDER' or 'GOOD LIFT' already showing, having never separately
    // observed the LOCKOUT line at all. Measured: a run recorded three
    // "misses" whose outcome was 'GRINDER' — a rep that reached lockout and
    // won, filed as a failure because this check required the one frame it
    // happened to skip past. A won rep is the LOCKOUT line OR any OUTCOME that is
    // not specifically 'NO LIFT', not the narrower of the two.
    left = next !== null && hasLeft(next);
    const wonOutright =
      !left &&
      next !== null &&
      next.prompt !== null &&
      (next.prompt.includes(lockoutPrompt) || (SESSION_PROMPTS.OUTCOMES.includes(next.prompt) && next.prompt !== 'NO LIFT'));
    if (wonOutright) {
      lockedOut = true;
      await onLockout(drivesTapped);
      break;
    }
    if (!left && next !== null && next.prompt !== null && next.prompt.includes(SESSION_PROMPTS.DRIVE)) {
      continue; // the spacing floor has passed, so this is a genuinely new cue — tap it
    }
    // Resolved (as a real miss — 'NO LIFT') with no further cue, or this
    // wait timed out — either way, CAPTURE THE READING THAT ENDED THE
    // LOOP, right here, rather than reading again after the wait below.
    // This is the same race the file header already names for the
    // cue-detection wait above, in a spot this loop's own extra taps and
    // settle waits newly reach: a FRESH readLoop() taken 150ms+ after a
    // miss can land after the app's own automatic next-rep reset,
    // returning the NEXT rep's BRACE prompt (or, measured once, a
    // transitional null) as if it were this attempt's miss reason.
    // Measured on this exact loop: outcome recorded as "TAP AND HOLD TO
    // DESCEND" on one attempt and `null` on another, neither a real miss
    // reason, both from re-reading late.
    finalOutcome = next;
    break;
  }
  return { drivesTapped, lockedOut, left, finalOutcome };
}

// ---------------------------------------------------------------------------
// BENCH'S OWN TWO BEATS — ONE IMPLEMENTATION, TWO SCREENS
// ---------------------------------------------------------------------------
/**
 * ===========================================================================
 * WHY THESE ARE FUNCTIONS AND NOT TWO COPIES, WHICH IS THE SAME ARGUMENT
 * `tapDriveCuesToLockout` MAKES ONE BEAT LATER
 * ===========================================================================
 * `verify-lift-press.mjs`'s ladder probe and `meetDrive.mjs`'s attempt loop both
 * have to play bench's descent and bench's burst, and CLAUDE.md's rule about a
 * guard written for one hook applies to a DRIVER identically: two copies drift
 * and the one that drifted is the one nobody re-reads. The ascent below was made
 * shared for exactly this reason after four separate bugs were found in it.
 *
 * WHAT IS THE CALLER'S: the reader (`session-prompt` on a training set,
 * `attempt-prompt` on a meet attempt), the `hasLeft` predicate (a meet screen
 * goes away mid-rep and a training set does not), and the descent plan, which
 * the caller adapts across its own attempts. What is SHARED is the shape of the
 * two beats and the numbers behind them, which come out of `BENCH_BEAT`.
 */

/** Poll `read` until the prompt stops saying `line`, or `ms` elapses. */
async function waitOutOrLeave(page, { read, line, hasLeft, ms }) {
  const until = Date.now() + ms;
  for (;;) {
    const remaining = until - Date.now();
    if (remaining <= 0) return { left: false };
    await page.waitForTimeout(Math.min(BENCH_DRIVE.POLL_MS, remaining));
    const loop = await read(page);
    if (hasLeft(loop)) return { left: true, why: 'screen', loop };
    const saying = loop.prompt !== null && loop.prompt.includes(line);
    if (!saying) return { left: true, why: 'beat', loop };
  }
}

/**
 * FEED THE BAR TO THE CHEST — bench's eccentric under the 2026-08-25 ruling.
 *
 * PRECONDITION: the finger is DOWN and the prompt is saying bench's DESCENT
 * line. Both callers establish that; it is stated here rather than assumed
 * because `awaitFirstDriveCue`'s header records what a missing precondition cost
 * the ascent loop one beat later.
 *
 * POSTCONDITION: the finger is UP. That matters and is not tidiness — the burst
 * counts press EDGES, so a finger left down through the touch would make the
 * first tap of the burst a no-op and cost the player a tap they think they
 * threw.
 *
 * ===========================================================================
 * WHY A DUTY CYCLE AND NOT A HOLD
 * ===========================================================================
 * Under the old beat the descent was one hold and one release at a depth, and
 * `DEPTH_HOLD_MS` was the whole play. It is not a depth check any more: the bar
 * accelerates while the finger is down and decelerates while it is up, contact
 * happens wherever the bar reaches the chest, and what is graded is the RATE it
 * arrives at. Measured through the search in `BENCH_BEAT`: a single committed
 * hold arrives at quality ZERO at every load from 0.8 up — a crash on every
 * working set and every meet attempt — while the chosen cycle's worst case
 * across the same loads is `BENCH_BEAT.worstTouch`. So a driver that held would
 * reach the chest and would be playing the beat's losing line every time, and
 * every ascent behind it would be charged the full `BENCH_TOUCH_DEMAND_PENALTY`.
 *
 * IT COMMITS RATHER THAN CREEPING PAST THE TIMEOUT. The one descent failure that
 * costs the whole rep is 'no-touch', which needs the feed to stop and never
 * restart; `DESCENT_COMMIT_FRACTION` of `CHEST_TOUCH_TIMEOUT_TICKS` is where the
 * driver stops cycling and drives the bar in. A crashed touch is a worse rep; a
 * no-touch is no rep.
 */
export async function feedBenchToTheChest(page, { read, plan, hasLeft = NEVER_LEFT }) {
  const line = LIFT_PROMPTS.bench.DESCENT;
  const startedAt = Date.now();
  const commitAt = startedAt + BENCH_BEAT.chestTimeoutMs * BENCH_DRIVE.DESCENT_COMMIT_FRACTION;
  let down = true;
  let cycles = 0;
  let ended = { left: false };
  for (;;) {
    ended = await waitOutOrLeave(page, { read, line, hasLeft, ms: plan.feedMs });
    if (ended.left) break;
    await page.mouse.up();
    down = false;
    if (Date.now() >= commitAt) break;
    ended = await waitOutOrLeave(page, { read, line, hasLeft, ms: plan.easeMs });
    if (ended.left) break;
    await page.mouse.down();
    down = true;
    cycles += 1;
    if (Date.now() >= commitAt) break;
  }
  // THE COMMIT ARM. Reached only when the cycle has spent half the no-touch
  // budget without the bar arriving, which the search says should not happen at
  // any load it models — so this being taken at all is a finding, and the
  // caller gets `committed` to report rather than a silently different rep.
  const committed = !ended.left;
  if (committed) {
    if (!down) {
      await page.mouse.down();
      down = true;
    }
    ended = await waitOutOrLeave(page, {
      read,
      line,
      hasLeft,
      ms: BENCH_BEAT.chestTimeoutMs - (Date.now() - startedAt),
    });
  }
  if (down) await page.mouse.up();
  return {
    cycles,
    committed,
    ms: Date.now() - startedAt,
    feedMs: plan.feedMs,
    easeMs: plan.easeMs,
    leftBecause: ended.left ? ended.why : 'never left the descent',
    loop: ended.loop ?? null,
  };
}

/**
 * TAP THROUGH THE BURST WINDOW — bench's answer to the press command.
 *
 * PRECONDITION: the command line is on screen and the finger is UP.
 *
 * ===========================================================================
 * IT STOPS ON THE PROMPT, NOT ON A STOPWATCH, AND THAT IS THE WHOLE DESIGN
 * ===========================================================================
 * `PRESS_BURST_WINDOW_MS` is declared in milliseconds and CONSUMED IN TICKS —
 * `stepLift` converts it once at the command and counts down in ticks from
 * there. `useLiftLoop` takes at most `FEEDBACK.MAX_CATCH_UP_TICKS` ticks per
 * animation frame, so on a software-rendered browser under load the window is
 * genuinely LONGER in wall clock than the number it is declared as. A loop that
 * stopped at 850 ms would leave real taps on the table on exactly the machines
 * this runs on.
 *
 * AND OVERRUNNING IS WORSE THAN UNDERRUNNING, WHICH IS WHY IT DOES NOT SIMPLY
 * TAP LONGER. Past the burst the rep is in ASCENT, where a press with no armed
 * cue grades a full window early: a `missed` timing, a velocity penalty, and one
 * of only a few `driveAttemptsFor` slots spent on nothing. That is the phantom
 * re-tap `tapDriveCuesToLockout`'s header records costing a quarter of an
 * ascent's cues. So the loop reads the prompt after every tap and stops the
 * moment the command line is gone, and `BURST_DEADLINE_MULTIPLE` is a hang guard
 * behind that rather than the thing it steers by.
 *
 * THE CADENCE IS THE MECHANIC'S OWN REFRACTORY, READ FROM SOURCE. A press inside
 * `PRESS_BURST_TAP_REFRACTORY_TICKS` of the last counted one is ignored — not
 * penalised, ignored — so tapping a little fast costs nothing and tapping slow
 * costs window. `BURST_TAP_PERIOD_FRACTION` puts the aim just inside the floor.
 */
export async function burstTapTheCommand(page, { read, hasLeft = NEVER_LEFT }) {
  const line = LIFT_PROMPTS.bench.COMMAND;
  const periodMs = BENCH_BEAT.refractoryMs * BENCH_DRIVE.BURST_TAP_PERIOD_FRACTION;
  const attempts = BENCH_BEAT.maxCountedTaps * BENCH_DRIVE.BURST_TAP_ATTEMPT_MULTIPLE;
  const deadline = Date.now() + BENCH_BEAT.burstWindowMs * BENCH_DRIVE.BURST_DEADLINE_MULTIPLE;
  const startedAt = Date.now();
  let dispatched = 0;
  let stoppedBecause = 'the dispatch budget ran out';
  while (dispatched < attempts) {
    const tapAt = Date.now();
    await page.mouse.down();
    await page.mouse.up();
    dispatched += 1;
    const loop = await read(page);
    if (hasLeft(loop)) {
      stoppedBecause = 'the screen left mid-burst';
      break;
    }
    if (loop.prompt === null || !loop.prompt.includes(line)) {
      stoppedBecause = 'the burst closed';
      break;
    }
    if (Date.now() >= deadline) {
      stoppedBecause = 'the hang guard fired — the command line never left';
      break;
    }
    const gap = periodMs - (Date.now() - tapAt);
    if (gap > 0) await page.waitForTimeout(gap);
  }
  return {
    dispatched,
    ms: Date.now() - startedAt,
    periodMs,
    stoppedBecause,
    /**
     * HOW MANY OF THOSE WERE COUNTED IS NOT KNOWABLE FROM HERE, and saying so is
     * the point. Nothing in the DOM reports `burstTaps`; the on-stage pip row is
     * what carries it, and reading that is a PIXEL question, which is
     * `verify-lift-press.mjs`'s. A driver that reported a counted-tap figure it
     * had inferred from its own dispatches would be reporting its own control
     * flow — the self-referential shape this repository's vacuity rules refuse.
     */
    countedTaps: null,
  };
}

/** The bench descent search's whole state: where the cycle is and which way last. */
export function freshBenchDescent() {
  return {
    feedMs: BENCH_BEAT.feedMs,
    easeMs: BENCH_BEAT.easeMs,
    stepMs: BENCH_DRIVE.FEED_STEP_MS,
    lastDirection: 0,
  };
}

/**
 * The descent plan for the NEXT rep, given how this one ended.
 *
 * PURE, like `adaptDepthSearch` above, and it moves on the same two kinds of
 * evidence: a miss reason that names the DESCENT, and nothing else. A rep the
 * ascent lost tells you nothing about the touch — except that it might have been
 * crashed, which is why 'stalled' nudges the other way — and a made rep tells
 * you to leave it alone.
 *
 * TWO DIRECTIONS, AND THEY ARE NOT SYMMETRIC IN WHAT THEY MEAN. 'Never touched
 * the chest.' is unambiguous: the feed was too small for the machine's real tick
 * rate, so feed more. A stall or a timeout on the ascent is CIRCUMSTANTIAL —
 * a crashed touch charges `BENCH_TOUCH_DEMAND_PENALTY` and is a common cause,
 * but a weak burst is another — so it moves the cycle toward a softer arrival by
 * the same step and the caller keeps its own count of attempts.
 */
export function adaptBenchDescent(plan, rep) {
  const detail = rep.detail ?? '';
  const direction = detail.includes(SESSION_PROMPTS.MISS_NO_TOUCH)
    ? 1
    : detail.includes(SESSION_PROMPTS.MISS_STALLED) || detail.includes(SESSION_PROMPTS.MISS_TIMEOUT)
      ? -1
      : 0;
  if (direction === 0) return plan;
  const reversed = plan.lastDirection !== 0 && direction !== plan.lastDirection;
  const stepMs = reversed
    ? Math.max(BENCH_DRIVE.FEED_STEP_MIN_MS, Math.round(plan.stepMs / 2))
    : plan.stepMs;
  const feedMs = Math.min(
    BENCH_DRIVE.FEED_MAX_MS,
    Math.max(BENCH_DRIVE.FEED_MIN_MS, plan.feedMs + direction * stepMs),
  );
  return { feedMs, easeMs: plan.easeMs, stepMs, lastDirection: direction };
}
