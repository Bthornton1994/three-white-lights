/**
 * meetDrive.mjs — PLAYS A WHOLE MEET WITH A REAL MOUSE, so a check can look at
 * screens and beats that only exist on the far side of a meet a PLAYER opened.
 *
 * ===========================================================================
 * WHY THIS IS A SHARED MODULE AND NOT TWO COPIES
 * ===========================================================================
 * `sessionDrive.mjs`'s header makes this argument for the daily loop and it is
 * the same argument here, except that this repository has now paid for it four
 * times. `CLAUDE.md`: "A guard written for one hook — or one FIXTURE, or one ARM
 * OF ONE `if` — must be applied to its sibling, mechanically", and "the distance
 * keeps shrinking". Two hand-rolled meet drivers would be the fifth instance
 * waiting to happen, and the one that drifted would be the one nobody ran.
 *
 * Every line below was `tools/verify-shell-route.mjs`'s, moved rather than
 * rewritten, because `tools/verify-meet-sound.mjs` needs the same drive to reach
 * the walk-out on the played arm and a second copy of it is the defect.
 *
 * ===========================================================================
 * THIS FILE DRIVES. IT ASSERTS NOTHING.
 * ===========================================================================
 * Same contract as `sessionDrive.mjs`: every function returns what happened and
 * lets the caller decide whether that was acceptable. Nothing throws on a game
 * outcome, because "the rep was missed" is a legal thing for the app to do and a
 * harness that crashed on one would be reporting its own opinion.
 *
 * IT ALSO NEVER TOUCHES THE URL. `driveMeetToItsEnd` takes no search string and
 * does no `goto`: it works on the meet the caller already navigated to with a
 * press. That is not a convenience, it is the property the whole thing exists
 * for — `frozenMeetFor` (`src/shell/shellRoute.ts`) returns a frame only when
 * `route.source === 'debug'`, so a meet opened by `?meet=` and a meet opened by
 * a thumb are literally different code, and every genuinely new hazard the shell
 * introduced lives on the second arm.
 *
 * ===========================================================================
 * WHAT A CALLER PLUGS IN, AND WHY THOSE ARE HOOKS RATHER THAN CODE IN HERE
 * ===========================================================================
 * Two tools drive the same meet for different reasons, and the things they do
 * DURING it are their own business:
 *
 *   `onWalkoutSeen`     verify-shell-route samples the hall's timeline through
 *                       the tail; verify-meet-sound marks the audio log.
 *   `onWalkoutEnded`    verify-meet-sound closes that mark.
 *   `beforeFirstPress`  verify-shell-route photographs the room the rep is
 *                       drawn in, before the mouse touches it.
 *   `onSelectSeen`      verify-shell-route reads GDD §6.3's whole screen — the
 *                       floor, the sentence, both cards and their borders —
 *                       while it is up, because it is gone the instant the
 *                       press below lands.
 *   `chooseOption`      and decides which card that press goes to, when it
 *                       wants something other than the cowardly default.
 *   `shouldStop`        verify-meet-sound leaves after the beat it came for
 *                       rather than playing eighteen more attempts for nothing.
 *
 * Putting any of those in here would make this module know about screenshots,
 * audio probes and PNG diffing, which is how a shared driver becomes a second
 * copy of both its callers.
 *
 * ===========================================================================
 * IT KNOWS ALL THREE LIFTS NOW, AND IT KNEW ONE BEFORE
 * ===========================================================================
 * GDD §6.2 runs squat, then bench, then deadlift. This module waited on
 * `SESSION_PROMPTS.BRACE` and `SESSION_PROMPTS.DESCENT`, which are SQUAT'S
 * lines, so it could play the first three attempts of a meet and then sat
 * waiting for a brace line bench never says.
 *
 * MEASURED, NOT INFERRED. At `b38980e`, `tools/verify-shell-route.mjs` reported
 * `358 checks, 22 FAILURES`, and all 22 cascade from that one root: the drive
 * ended `'stuck' (no brace to press — prompt was null)` after **3 attempts** on
 * one meet and **4** on the other — exactly one lift's worth — so §6.5's recap
 * never rendered, `shell-leave-meet` was never drawn, the PR gold-edge
 * agreement was "measured on all-false", and three legs reported SKIPPED for
 * want of a finished meet. The committed record it replaced
 * (`.gauntlet/shots/shell/route.json`, `997a1fa`, 401 checks / 0 failures) was
 * taken before the three lifts landed: at that commit `simKindFor` mapped every
 * meet attempt onto squat's phase model, so squat's grammar was the whole game
 * and this module was right by accident.
 *
 * `LIFT_PROMPTS` (`sessionDrive.mjs`) is the table it steers by now, and
 * `attempt-label` is how it learns which row to read. Its `null`s are the lift,
 * not a gap: a deadlift's DESCENT and HOLE are null because `stepLift` refuses
 * a (deadlift, DESCENT) state outright, so a driver that waits on one is
 * waiting for a state the type system has ruled out.
 */

import {
  ASCENT_PROMPTS,
  LIFT_PROMPTS,
  SESSION_DRIVE,
  SESSION_PROMPTS,
  adaptDepthSearch,
  awaitFirstDriveCue,
  freshDepthSearch,
  tapDriveCuesToLockout,
} from './sessionDrive.mjs';

/**
 * Below this, a control is reported ABSENT however happily the DOM says it is
 * visible. Not a style threshold: a fade that has not finished is a control a
 * thumb cannot find.
 *
 * MOVED HERE FROM `verify-shell-route.mjs` rather than copied, because the
 * driver's three presses (`weigh-in-action`, `openers-action`,
 * `attempt-option-*`) all wait on it and a second threshold would mean two
 * answers to "is it drawn".
 */
export const ON_SCREEN_MIN_OPACITY = 0.9;

/** How often `waitUntilDrawn` re-reads an opacity while a fade is running. */
export const DRAWN_POLL_MS = 100;

/**
 * The element's opacity MULTIPLIED ALL THE WAY UP THE ANCESTOR CHAIN.
 *
 * Playwright's `isVisible()` means "has a non-empty bounding box and is not
 * `visibility: hidden`", and it RETURNS TRUE FOR AN ELEMENT AT `opacity: 0`.
 * `document.elementFromPoint` hits one too, and `click()` will happily press
 * one. Nothing in the toolkit considers opacity, and React Native Web nests the
 * animated wrapper ABOVE the Pressable — so the control's own opacity is 1
 * while its parent is 0. Reading only the element's own opacity is the same bug
 * one level in.
 */
export async function effectiveOpacity(page, id) {
  const handle = await page
    .getByTestId(id)
    .elementHandle({ timeout: 2000 })
    .catch(() => null);
  if (handle === null) return 0;
  const value = await page
    .evaluate((node) => {
      let el = node;
      let acc = 1;
      while (el !== null && el.nodeType === 1) {
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
        const own = Number.parseFloat(cs.opacity);
        acc *= Number.isFinite(own) ? own : 1;
        el = el.parentElement;
      }
      return acc;
    }, handle)
    .catch(() => 0);
  await handle.dispose().catch(() => {});
  return value;
}

/**
 * Wait for a control to finish arriving, up to `timeout`, and report what it
 * was at when the clock ran out.
 *
 * A BOUNDED wait, not an unbounded one: "the exit arrives within the time its
 * own animation says it should" is a falsifiable claim, and an unbounded wait
 * would not be one.
 */
export async function waitUntilDrawn(page, id, timeout) {
  const started = Date.now();
  for (;;) {
    const o = await effectiveOpacity(page, id);
    if (o >= ON_SCREEN_MIN_OPACITY) {
      return { drawn: true, why: `opacity ${o.toFixed(3)} after ${Date.now() - started}ms` };
    }
    if (Date.now() - started >= timeout) {
      return { drawn: false, why: `opacity ${o.toFixed(3)}, still, after ${timeout}ms` };
    }
    await page.waitForTimeout(DRAWN_POLL_MS);
  }
}

/**
 * WHAT THE WALK-OUT SAYS ON SCREEN, and what each line means about the attempt.
 *
 * ONE TABLE, READ BY BOTH TOOLS, WHICH IS THE POINT OF ITS BEING HERE.
 * `verify-shell-route.mjs` sorts its hall photographs by `WALK_IT_OUT` and finds
 * its tail probe's beat by `THIRD_OF_THREE`; `verify-meet-sound.mjs` decides
 * which crowd swell a walk-out must have played by the same four lines. Two
 * copies of this table would be two answers to "is this attempt urgent", and
 * `WalkoutView` has exactly one.
 *
 * Both tools cross-check the entries THEY use against `src/game/meetTuning.ts`
 * separately, so a copy edit reddens in whichever tool depends on it rather than
 * silently un-matching in both.
 */
export const MEET_WALKOUT_SAYS = Object.freeze({
  /** src/game/meetTuning.ts — MEET_COPY.WALKOUT_BOMB_RISK. */
  NOTHING_BANKED: 'NOTHING BANKED. THIS IS THE LIFT.',
  /**
   * Not one constant but the eyebrow `WalkoutView` assembles out of
   * `MEET_COPY.ATTEMPT_LABEL`, `ATTEMPT_OF` and `ATTEMPTS_PER_LIFT`. Written out
   * as the player reads it, because that is what the probe is checking.
   */
  THIRD_OF_THREE: 'ATTEMPT 3 OF 3',
  /** src/game/meetTuning.ts — MEET_COPY.WALKOUT_THIRD. */
  LAST_ONE: 'LAST ONE',
  /** src/game/meetTuning.ts — MEET_COPY.WALKOUT_PR. */
  A_PR: 'NOBODY HAS SEEN YOU DO THIS',
  /**
   * src/game/meetTuning.ts — MEET_COPY.WALKOUT_PROMPT.
   *
   * THE ONE LINE `WalkoutView` PRINTS WHEN `isUrgentAttempt` IS FALSE, which is
   * what makes it usable as a flag: the other three are the bomb-risk, PR and
   * third-attempt lines and every one of them is an urgent beat.
   */
  WALK_IT_OUT: 'WALK IT OUT',
});

/**
 * WHICH LIFT AN ATTEMPT IS, AS THE MEET ITSELF PRINTS IT.
 *
 * `AttemptView` builds `attempt-label` as
 * `${MEET_COPY.LIFT_LABEL[live.lift]} · ${ATTEMPT_LABEL} n ${ATTEMPT_OF} 3`, so
 * the first field is `live.lift` — the MEET ENGINE'S own answer, straight off
 * `MeetDayState.live`, with no phase model in between.
 *
 * Restated from `src/game/meetTuning.ts` rather than imported, for the reason
 * `MEET_WALKOUT_SAYS` above gives about its own four lines: a `.mjs` tool cannot
 * import a `.ts` module without a loader this tree does not run, and a driver
 * that read its copy out of the app would happily drive a broken app in
 * circles. Each caller cross-checks the entries it uses against `meetTuning.ts`.
 *
 * ORDERED SQUAT -> BENCH -> DEADLIFT, which is `LIFT_ORDER` and is the
 * structural rule of the sport (GDD §6.2), not a convenience: a caller counting
 * "how many lifts does a meet have" reads `MEET_LIFT_ORDER.length` rather than
 * some other three-element list that happens to be the same size.
 */
export const MEET_LIFT_LABELS = Object.freeze({
  squat: 'SQUAT',
  bench: 'BENCH',
  deadlift: 'DEADLIFT',
});

/** src/game/meet.ts — `LIFT_ORDER`. Squat -> bench -> deadlift. */
export const MEET_LIFT_ORDER = Object.freeze(['squat', 'bench', 'deadlift']);

/** `AttemptView`'s separator between the lift and the attempt number. */
export const ATTEMPT_LABEL_SEPARATOR = '·';

/**
 * The `LiftKind` an attempt label names, or `null` when the label is absent or
 * names nothing this driver knows.
 *
 * Returns the KIND (`'bench'`) and not the printed word (`'BENCH'`), because
 * every table the driver then indexes — `LIFT_PROMPTS`, the per-lift holds — is
 * keyed by kind. A caller that wants the word has `MEET_LIFT_LABELS`.
 */
export function liftFromAttemptLabel(label) {
  if (label === null || label === undefined) return null;
  const head = String(label).split(ATTEMPT_LABEL_SEPARATOR)[0]?.trim() ?? '';
  const found = Object.entries(MEET_LIFT_LABELS).find(([, word]) => word === head);
  return found === undefined ? null : found[0];
}

/**
 * WHICH LIFT'S LADDER THE MECHANIC IS ACTUALLY WALKING, read off the prompt.
 *
 * The second, independent reading of the same fact. `attempt-label` comes from
 * `MeetDayState.live.lift`; `attempt-prompt` comes from `promptFor(loop.state)`,
 * a pure function of `state.phase` and `state.config.kind`, and
 * `attemptConfigFor` fills that kind from `live.lift`. Two paths, one fact — so
 * a fallback that put one lift's attempt on another's phase model (the shape
 * `repConfigFor` shipped for a round as `simKindFor(state.context.lift)`) shows
 * up as the two disagreeing rather than as a wall of timeouts.
 *
 * The three brace lines are mutually exclusive and each is printable from
 * exactly one (kind, BRACE) pair, which is what makes this a reading rather
 * than a guess.
 */
export function liftFromBracePrompt(prompt) {
  if (prompt === null || prompt === undefined) return null;
  const found = Object.entries(LIFT_PROMPTS).find(([, ladder]) => String(prompt).includes(ladder.BRACE));
  return found === undefined ? null : found[0];
}

/**
 * Everything the meet driver moves on, in one place.
 *
 * NONE OF THESE ARE GAME FEEL. The game's feel values live in
 * `src/game/meetTuning.ts` and `src/game/liftTuning.ts`; these are A ROBOT'S
 * REACTION TIMES, and they are here rather than inline for the reason
 * `SESSION_DRIVE` gives about its own: somebody re-tuning meet day needs one
 * place to look when the robot stops keeping up with it.
 *
 * THE TWO COPY LINES ARE NOT REACTION TIMES and are the load-bearing entries.
 * They are how the driver learns WHICH WAY it mistimed a release, and each
 * caller cross-checks them against `meetTuning.ts`. Without that check a copy
 * edit would stop the driver adapting, every meet would start bombing out, and
 * the failure would read as "the app broke" rather than "this tool stopped
 * recognising it".
 */
export const MEET_DRIVE = Object.freeze({
  /**
   * WHICH OPTION GDD §6.3'S CHOICE IS ANSWERED WITH, in preference order.
   *
   * The lightest legal call every time: `repeat` exists only after a miss and
   * is the same weight again; `small` is the modest increase after a make;
   * `big` is the last resort when the engine offered neither. This is the
   * driver being a coward on purpose — reaching `recap` needs one good lift on
   * EACH of squat, bench and deadlift (three misses on any one of them is a
   * bomb-out, and a bomb-out is a different screen), so the robot takes the
   * lightest thing on offer and does not play §6.3's actual dilemma. It is not
   * a claim about what a player should do.
   *
   * A CALLER THAT WANTS THE DILEMMA PASSES `chooseOption`. This list is the
   * DEFAULT, not the policy: it was the only policy for six waves, which made
   * `attempt-option-big` a control no played run had ever pressed — an empty
   * domain on the exact arm §6.3 is about. `verify-shell-route.mjs` now hands
   * in a policy that takes the big jump where a miss cannot bomb the lift.
   */
  SAFEST_OPTIONS: Object.freeze(['repeat', 'small', 'big']),

  /** How often the driver re-reads which beat the meet is on. */
  POLL_MS: 25,

  /** How long the finger stays down after the drive press, through lockout. */
  DRIVE_HOLD_EXTRA_MS: SESSION_DRIVE.DRIVE_HOLD_EXTRA_MS,

  /**
   * ===========================================================================
   * HOW LONG THE FINGER STAYS DOWN ON THE ECCENTRIC, PER LIFT — AND WHY A MEET
   * NEEDS ITS OWN TABLE RATHER THAN `SESSION_DRIVE.DEPTH_HOLD_MS`
   * ===========================================================================
   * A meet attempt is not a training set's load. `OPENER_FRACTION_OF_1RM` is
   * 0.9 for all three lifts and `ATTEMPT_JUMP_FRACTION` ratchets up from there,
   * so `LiveAttempt.loadRatio` runs about **0.90 to 0.97** across a meet, where
   * a session at `SESSION_DRIVE.RPE_CHOICE` sits at ~0.863. The descent rate is
   * load-interpolated (`DESCENT_DEPTH_PER_TICK` through `byLoad`), so the legal
   * band moves with it, and bench's band is NARROW: about 147 ms wide at 0.90
   * against squat's 420 ms.
   *
   * Derived from `liftTuning.ts` at HEAD (`DESCENT_DEPTH_PER_TICK`,
   * `DEPTH_LEGAL`, `DEPTH_IDEAL`, `DEPTH_COLLAPSE`, `LOAD_RANGE`,
   * `LOAD_CURVE_EXPONENT`), release-to-release in wall clock at a perfect 60 Hz:
   *
   *              r=0.90                r=0.94                r=0.97
   *   squat      683 / 850 / 1103      733 / 900 / 1165      750 / 917 / 1199
   *   bench      650 / 700 /  797      683 / 733 /  841      700 / 750 /  866
   *                (legal / ideal / buried)
   *
   * `SESSION_DRIVE.DEPTH_HOLD_MS` is 1000, which is inside squat's band at
   * every meet load and **203 ms past the point a bench rep is buried at 0.90**.
   * Carrying one search across the lift change is therefore not a tidiness
   * question: a squat hold converged near 1000 buries all three bench attempts
   * and bombs the lift, which ends the meet before the deadlift.
   *
   * ===========================================================================
   * THESE ARE SIM-TICK DURATIONS AT 60 Hz, AND THE DRIVER SCALES THEM BY THE
   * FRAME RATE THE PAGE IS REALLY DELIVERING
   * ===========================================================================
   * `useLiftLoop` advances the sim on ANIMATION FRAMES, taking at most
   * `FEEDBACK.MAX_CATCH_UP_TICKS` per frame — deliberately, so a hitch slows a
   * rep down instead of fast-forwarding through the player's input. So a
   * wall-clock millisecond does not buy a fixed amount of depth: it buys
   * `fps / 60` of what a 60 Hz derivation predicts.
   *
   * MEASURED IN THIS ENVIRONMENT, on a live rep, at `c9443b8`: the page renders
   * at **52.5 fps** with the sim running under swiftshader. A hold derived at
   * 60 Hz therefore buys 12.5% less depth than it is written for, and bench's
   * legal band is only ~147 ms wide — so the first real run of this driver lost
   * a bench attempt to `no-depth` at 720 ms and then, once `adaptDepthSearch`
   * had pushed it to 780, lost a whole lift to three `stalled` releases that
   * were legal but too shallow to reverse from.
   *
   * `sessionDrive.mjs`'s `DEPTH_HOLD_MS` header already names this hazard and
   * answers it by biasing above the ideal. That is a guess about the machine.
   * `pageFrameRate` MEASURES it instead, during the brace wait this driver was
   * already spending, and `scaledHoldMs` converts. The numbers below can then
   * be read straight off a 60 Hz derivation, which is the only place anybody
   * can derive them.
   *
   * CHOSEN BY SWEEP, NOT BY MIDPOINT. Driven against the real `createLift` /
   * `stepLift`, 32 seeds x {0.88, 0.90, 0.92, 0.94, 0.96, 0.97} x four
   * observation lags, with the release timed from the press the way
   * `playOneMeetAttempt` times it, at 60 Hz-normalised timing — which is what
   * the scaling delivers. Out of 768 driven reps per hold:
   *
   *   squat   760-920 all make 768/768. 720 makes 384/768, losing every rep at
   *           r>=0.94 to `no-depth`. 840 and 880 are pure `good-lift` with no
   *           grinds. 840 is the middle of the perfect band.
   *   bench   760 is the ONLY value that makes 768/768. 720 loses r=0.97
   *           (640/768), 800 loses r=0.88 outright and part of 0.94/0.96
   *           (576/768), 840 makes 320/768 and 880 makes 32/768 — buried.
   *
   * MEASURED AT `c9443b8`, off a throwaway harness that is NOT in this tree, so
   * nothing here goes red when `liftTuning.ts` moves underneath these numbers.
   * They are labelled measurements rather than guarantees for exactly that
   * reason, and a re-tune of the mechanic should expect to re-take them.
   * `git merge-base --is-ancestor c9443b8 HEAD` checks the stamp.
   *
   * ===========================================================================
   * WHERE THE SWEEP AND THE BROWSER STILL DISAGREE, AND WHY IT MATTERS TO
   * WHOEVER RE-TUNES THIS
   * ===========================================================================
   * The sweep drove `createLift({ kind, loadRatio, seed })` and passed NO
   * `feel` and NO `moment`. `attemptConfigFor` passes both: `sessionFeel(...)`
   * narrows the timing window, and `moment.workSetsCompleted` is the meet's own
   * attempt count, so the window narrows further with every attempt taken. So
   * the reps the sweep scored ran against a WIDER drive window than a real meet
   * attempt gets, and 768/768 is an upper bound rather than a prediction.
   *
   * The residue is visible in the shipped record and is not hidden here: across
   * 27 attempts the misses are almost all `MEET_COPY.FEEDBACK_STALLED` ("The
   * bar won that one."), which names the ascent, and one meet banked only 1 of
   * 3 squats — one make away from a bomb-out, which ends the meet and takes
   * §6.5's recap with it. THIS DRIVER IS NOT GUARANTEED TO FINISH A MEET, and a
   * run that ends `'bombed'` is reported as exactly that rather than dressed as
   * something else.
   *
   * Closing it means re-taking the sweep with `feel` and `moment` threaded, at
   * the fatigue a meet actually reaches. That is a measurement somebody should
   * make before moving these two numbers on a hunch.
   *
   * `deadlift: null` IS THE LIFT, NOT AN OMISSION. There is no eccentric to
   * hold through, so there is no hold to start anywhere — the same `null` that
   * `LIFT_PROMPTS.deadlift.DESCENT` carries and for the same reason.
   */
  START_HOLD_MS: Object.freeze({ squat: 840, bench: 760, deadlift: null }),

  /** The frame rate `START_HOLD_MS` and `ASCENT_TIMING` are derived at. */
  DERIVED_AT_FPS: 60,
  /**
   * The band a measured frame rate is believed inside.
   *
   * NOT A TOLERANCE, A SANITY GUARD: a reading outside this is a broken
   * measurement (a backgrounded tab, a paused rAF, a torn sample), not a slow
   * machine, and the safe answer is to fall back to `DERIVED_AT_FPS` rather
   * than to multiply a hold by an arbitrary number. The floor is well under the
   * 52.5 fps this environment measures and the ceiling is one frame above the
   * display's own rate.
   */
  FRAME_RATE_BAND: Object.freeze({ MIN: 20, MAX: 61 }),

  /**
   * HOW FAR `adaptDepthSearch` MOVES THE HOLD AFTER A MISTIMED RELEASE, PER
   * LIFT — and bench's is small because bench's band is small.
   *
   * `SESSION_DRIVE.DEPTH_HOLD_STEP_MS` is 180 ms. Bench's whole legal band at a
   * meet's opener load is ~147 ms wide (see the table above), so a 180 ms step
   * is guaranteed BY CONSTRUCTION to jump from one side of it to the other
   * without landing inside — the bisection only recovers on the reversal after
   * that, and a lift has three attempts. 60 ms is under half the band, so a
   * single correction can land.
   *
   * Squat keeps the shared 180: its band is 420 ms wide and a smaller step
   * would spend attempts crawling.
   */
  DEPTH_STEP_MS: Object.freeze({ squat: SESSION_DRIVE.DEPTH_HOLD_STEP_MS, bench: 60, deadlift: null }),

  /**
   * ===========================================================================
   * HOW LONG THE DRIVER WAITS ON A DRAWN BRACE BEFORE IT PRESSES, AND WHY
   * PRESSING EARLY IS THE SUBTLE FAILURE RATHER THAN THE OBVIOUS ONE
   * ===========================================================================
   * `stepLift`'s BRACE branch leaves for DESCENT (or, on a deadlift, straight
   * for ASCENT) only once `phaseTick >= braceTicks(load, kind)` AND the finger
   * is down. So a press dispatched while the brace is still running does not
   * start the descent — the descent starts when the brace ends, some unknown
   * remainder later. `playOneMeetAttempt` times its release from the PRESS, so
   * that remainder comes straight off the hold: the depth accrues for
   * `holdMs - remainingBraceMs`, and the driver has no way to see how much that
   * was.
   *
   * `BRACE_TICKS` maxes at 42 ticks (deadlift, at the maximal end) = 700 ms.
   * Waiting past that makes the descent start AT the press, so the hold above
   * is the descent duration and the sweep those numbers came from describes the
   * rep that actually gets played. `BRACE_TIMEOUT_TICKS` is 600 ticks (10 s), so
   * there is an order of magnitude of room to wait in.
   *
   * SIZED FOR THE SLOWEST FRAME RATE RATHER THAN SCALED, and that is the one
   * duration here that is not scaled by the measured rate — because it is the
   * window the rate is MEASURED IN, so scaling it by its own result would be
   * circular. 42 ticks at 45 fps is 933 ms; 1000 covers that with margin, and
   * `BRACE_TIMEOUT_TICKS` (600 ticks, 10 s) leaves an order of magnitude of
   * room to wait in.
   *
   * A ROBOT'S PATIENCE, NOT GAME FEEL: the beat itself is `liftTuning.ts`'s.
   */
  BRACE_ELAPSE_MS: 1000,

  /**
   * DEADLIFT ONLY — a beat after the bar leaves the floor before the finger
   * comes off it. `verify-lift-press.mjs`'s `PULL_RELEASE_MS`, same value and
   * same reason: the pull is a hold through the brace, not a tap at a guessed
   * instant, and the finger's real job starts a beat later on the drive cues.
   */
  PULL_RELEASE_MS: 80,

  /**
   * BENCH ONLY — how long to wait at the chest for `PRESS!`.
   * `PRESS_COMMAND_DELAY_TICKS`' whole range plus `PRESS_TIMEOUT_TICKS`, so a
   * timeout here means the command never came rather than that the driver was
   * impatient.
   */
  COMMAND_TIMEOUT_MS: 6000,
  /** BENCH ONLY — how long the reaction tap's mouse.down is held. */
  PRESS_TAP_MS: 60,

  /**
   * DEADLIFT ONLY — how long to hold a lockout waiting for the down command.
   * `DOWN_COMMAND_DELAY_TICKS.MAX` is 96 ticks (1600 ms); this is generously
   * past it.
   */
  DOWN_TIMEOUT_MS: 8000,

  /**
   * ===========================================================================
   * THE ASCENT'S REACTION TIMES — THIS ARM'S, NOT `FULL_CYCLE`'S
   * ===========================================================================
   * `awaitFirstDriveCue` and `tapDriveCuesToLockout` are `sessionDrive.mjs`'s
   * and are SHARED with `verify-lift-press.mjs` rather than copied — that loop
   * is where four separate real bugs were found and fixed. What is NOT shared
   * is the numbers: `FULL_CYCLE`'s were measured against the SESSION's RPE 9
   * and RPE 10 ladder rungs, and a meet attempt is a different load. Hoisting
   * one arm's measurements into the shared module would make them silently
   * claim to describe both.
   *
   * These four start at `FULL_CYCLE`'s values because that is the only
   * calibration anyone has driven in a browser, and they are written here so a
   * meet-day re-tune has one place to move them.
   */
  ASCENT_TIMING: Object.freeze({
    /**
     * Zero, for the reason `FULL_CYCLE.AIM_FOR_CENTER_DELAY_MS` gives at
     * length: `promptFor` starts showing 'DRIVE — TAP' at the window's LEADING
     * edge, that edge is already a winning point at these loads, and a
     * deliberate wait only spends margin toward the one edge that loses.
     */
    aimDelayMs: 0,
    /** A real quick tap, several sim ticks, nowhere near the cue spacing. */
    tapMs: 60,
    /** After a tap, before reading the state back. */
    settleMs: 100,
    /**
     * The floor below which a still-'DRIVE — TAP' display cannot be a NEW cue.
     *
     * A SIM-TICK DURATION, SO IT IS SCALED WITH THE HOLDS. `driveSpacingTicks`
     * is what it stands for, and that is counted in ticks: at 52 fps the real
     * gap between two cues is 14% longer in wall clock than a 60 Hz derivation
     * says, so an unscaled floor would start looking for the next cue before
     * one could arm — which is the phantom-re-tap window this floor exists to
     * close. Computed at meet loads: squat 167-233 ms, bench 233-300 ms,
     * deadlift 200-267 ms at 60 Hz, so 280 is at the top of that range and the
     * scaling keeps it there.
     */
    minCueSpacingMs: 280,
    /** "The ascent has stopped advancing", not "the ascent was slow". */
    driveTimeoutMs: 5400,
    /**
     * How often the shared loop re-reads the attempt screen.
     *
     * 15, NOT `MEET_DRIVE.POLL_MS`'s 25, AND THE DIFFERENCE IS MEASURED. A
     * drive cue's whole window is a couple of hundred milliseconds wide and a
     * tap outside it is graded a full window early — so on the ascent the
     * poll's own interval is a systematic detection lag on the one beat that
     * cannot absorb one. `FULL_CYCLE.AIM_FOR_CENTER_DELAY_MS` records the same
     * choice on the session arm and credits 15 over 30 for exactly this.
     *
     * Measured in this environment at `c9443b8`, polling a live rep: the real
     * poll-to-poll gap at `pollMs: 15` is p50 **27 ms**, p90 37 ms, max 41 ms —
     * so the interval is roughly half the cost and the CDP round trip is the
     * other half. At 25 the same gap would run ~10 ms longer on every poll.
     * The beat-to-beat loop keeps 25: nothing there is decided in one frame.
     */
    pollMs: 15,
  }),

  /**
   * Deadlines. Generous on purpose: every one of these means "the meet has
   * stopped advancing", not "the meet was slow". A meet beat that runs longer
   * than its own tuning says is the app's business, not the harness's.
   */
  BRACE_TIMEOUT_MS: 15000,
  /**
   * How long a press has to produce a descent — or, on a deadlift, to take the
   * bar off the floor, which is the same press and the same deadline.
   */
  DESCENT_TIMEOUT_MS: 15000,
  /**
   * `ASCENT_TIMEOUT_MS` USED TO BE HERE AND IS DELETED WITH ITS ONE READER. The
   * old ascent was a single held press waiting on `!s.attempt`; the ascent is
   * `tapDriveCuesToLockout` now and its deadline is
   * `ASCENT_TIMING.driveTimeoutMs`, above. A second answer to "the ascent has
   * stopped advancing" is exactly the drift this module's header refuses.
   */
  /** One whole beat-to-beat transition: bar load, walk-out, judges, cards. */
  BEAT_TIMEOUT_MS: 40000,
  /**
   * The whole meet. Nine attempts measured at ~112 s when every one of them was
   * a squat and the ascent was one held press; the per-lift drive adds
   * `BRACE_ELAPSE_MS` and a tap sequence to each, so this is comfortably more
   * than 3x what a driven meet now costs and still means "stopped advancing".
   */
  MEET_TIMEOUT_MS: 360000,
  /**
   * A hard stop on the attempt loop. GDD §6.2 is three lifts x
   * `ATTEMPTS_PER_LIFT` (3), so nine is the most a meet can contain and
   * anything past it means the loop is not advancing.
   */
  MAX_ATTEMPTS: 9,

  /**
   * MEET_COPY.FEEDBACK_DEPTH_HIGH — the judges' line for a release above depth.
   * The driver holds LONGER after this one.
   *
   * Read off the VERDICT screen rather than off the attempt screen, and that is
   * not a preference: `AttemptView` hands the resolution to the judges in the
   * effect that fires the moment the rep resolves, so `attempt-detail` exists
   * for about one commit and a poll can miss it entirely. `verdict-feedback` is
   * held for `MEET_TUNING.VERDICT_HOLD_MS`, which is a beat a robot can read.
   */
  FEEDBACK_HIGH: 'High. The hips never got under.',
  /** MEET_COPY.FEEDBACK_BURIED. The driver holds SHORTER after this one. */
  FEEDBACK_BURIED: 'Too deep to recover.',
});

/** Which beat of the meet is on screen, and what the mechanic is saying. */
export async function readMeetLoop(page) {
  return page.evaluate(() => {
    const has = (id) => document.querySelector(`[data-testid="${id}"]`) !== null;
    const text = (id) => {
      const node = document.querySelector(`[data-testid="${id}"]`);
      return node === null ? null : node.textContent;
    };
    return {
      weighIn: has('meet-weigh-in'),
      openers: has('meet-openers'),
      walkout: has('meet-walkout'),
      attempt: has('meet-attempt'),
      deliberation: has('meet-deliberation'),
      verdict: has('meet-verdict'),
      select: has('meet-attempt-select'),
      /** GDD §6.5's recap, built. */
      recap: has('meet-recap'),
      /** The bare eyebrow while the server's answer is in flight. */
      waiting: has('meet-recap-waiting'),
      /** A refused submission, DISCLOSED: the server's sentence where the
       *  recap would be. Unreachable through the app's own controls since
       *  Sprint 1c (the calendar refuses a re-entry before a meet opens), so a
       *  drive that ends here has found a defect worth naming. */
      refused: has('meet-refused'),
      bombed: has('meet-bombed'),
      prompt: text('attempt-prompt'),
      attemptLabel: text('attempt-label'),
      /** GDD §6.2 step 1's eyebrow and its line — which attempt, and what it is worth. */
      walkoutEyebrow: text('walkout-attempt'),
      walkoutLine: text('walkout-line'),
      /** The judges' one line. See MEET_DRIVE.FEEDBACK_HIGH for why not `attempt-detail`. */
      feedback: text('verdict-feedback'),
      /**
       * GDD §6.3's banked line, which is what says whether a miss on this lift
       * could still bomb it. Read here rather than by the caller because a
       * `chooseOption` policy needs it BEFORE the press, and this is the read
       * the driver already does on every poll.
       */
      banked: text('attempt-select-banked'),
      /**
       * The option cards on offer, as whole testIDs. Filtered to the three
       * `AttemptOptionId`s so `attempt-option-weight-<id>` — a Text INSIDE each
       * card — is not mistaken for a card.
       */
      options: [...document.querySelectorAll('[data-testid]')]
        .map((node) => node.getAttribute('data-testid'))
        .filter((id) => /^attempt-option-(repeat|small|big)$/.test(id)),
    };
  });
}

/** Poll `readMeetLoop` until `done(state)`, or the deadline passes. */
export async function untilMeet(page, done, timeoutMs) {
  const started = Date.now();
  for (;;) {
    const state = await readMeetLoop(page);
    if (done(state)) return { ok: true, state, ms: Date.now() - started };
    if (Date.now() - started >= timeoutMs) return { ok: false, state, ms: Date.now() - started };
    await page.waitForTimeout(MEET_DRIVE.POLL_MS);
  }
}

export const meetSaying = (state, phrase) => state.prompt !== null && state.prompt.includes(phrase);
/** The meet is over, whichever of the four ways it ended. */
export const meetIsOver = (state) => state.recap || state.waiting || state.refused || state.bombed;

/**
 * ===========================================================================
 * HOW FAST THE PAGE IS ACTUALLY DRAWING, MEASURED RATHER THAN ASSUMED
 * ===========================================================================
 * Every duration in `START_HOLD_MS` and `ASCENT_TIMING` is really a count of
 * SIM TICKS, and `useLiftLoop` advances the sim on animation frames. So the
 * wall-clock wait that buys a given depth is `ticks / fps` seconds, and this
 * environment does not deliver 60: measured on a live rep at `c9443b8`, the
 * page draws at **52.5 fps** under swiftshader, which makes every 60 Hz-derived
 * hold 12.5% short.
 *
 * `sessionDrive.mjs`'s `DEPTH_HOLD_MS` header already names this and answers it
 * by biasing the constant upward — a guess about the machine, baked into a
 * number, that goes stale when the machine changes. This measures instead.
 *
 * ===========================================================================
 * IT COSTS NOTHING, AND THAT IS WHY IT IS TAKEN WHERE IT IS TAKEN
 * ===========================================================================
 * The counter is read either side of `BRACE_ELAPSE_MS` — a wait the driver was
 * already spending on every attempt, on the screen the rep is about to be drawn
 * on, with the same hall and the same Skia canvas rendering. So the reading
 * describes the frames the rep itself will get, not an idle page's.
 *
 * THE RAF LOOP IS INSTALLED ONCE PER PAGE AND NEVER TORN DOWN. A `goto` clears
 * it and the guard reinstalls it; a second install is refused by the same guard.
 * It increments one integer per frame and does nothing else, so it cannot be the
 * reason the page is slow.
 *
 * A reading outside `FRAME_RATE_BAND` is reported and NOT used: see that
 * constant for why a broken measurement must not become a multiplier.
 *
 * ===========================================================================
 * WHAT THE SHIPPED EVIDENCE DOES AND DOES NOT SHOW ABOUT THIS
 * ===========================================================================
 * Stated because the mechanism is verified and the CONSEQUENCE is not, which is
 * a distinction CLAUDE.md keeps a whole section for.
 *
 * VERIFIED: the counter reads back, the arithmetic runs, and every attempt in
 * `.gauntlet/shots/shell/route.json` carries the rate it measured.
 *
 * NOT VERIFIED BY THAT RECORD: that scaling a hold UP rescues a rep. The green
 * run measured **59.4-60.8 fps** on every one of its 27 attempts, so the factor
 * was ~1.00 and the holds it used were within 10 ms of the declared ones. The
 * 52.5 fps that motivated this was measured on the same box while other work
 * was on it, so the rate is real and varies between runs — but the arm where
 * the scaling does something is the arm that record did not take.
 *
 * The evidence for the scaled arm is the sweep in `START_HOLD_MS`: at 50 fps an
 * UNSCALED squat hold of 840 makes 64 of 192 driven reps and bench's 760 makes
 * 0 of 192, against 768/768 and 768/768 for the same values at 60 Hz-normalised
 * timing. That is a pure-sim result and it is not a browser run. Read it as the
 * reason the mechanism exists, not as proof that it works in a browser at a low
 * frame rate.
 */
export async function armFrameRateCounter(page) {
  await page
    .evaluate(() => {
      if (window.__meetDriveFrames !== undefined) return;
      window.__meetDriveFrames = 0;
      const bump = () => {
        window.__meetDriveFrames += 1;
        window.requestAnimationFrame(bump);
      };
      window.requestAnimationFrame(bump);
    })
    .catch(() => {});
}

const readFrameCounter = (page) =>
  page
    .evaluate(() => ({
      frames: window.__meetDriveFrames ?? null,
      at: window.performance.now(),
    }))
    .catch(() => ({ frames: null, at: 0 }));

/**
 * Frames per second across a wait of `duringMs`, or `null` if it could not be
 * measured. Reported as `{ fps, frames, spanMs, usable }` so a caller can print
 * what it saw rather than only what it concluded.
 */
export async function pageFrameRate(page, duringMs) {
  await armFrameRateCounter(page);
  const before = await readFrameCounter(page);
  await page.waitForTimeout(duringMs);
  const after = await readFrameCounter(page);
  if (before.frames === null || after.frames === null || after.at <= before.at) {
    return { fps: null, frames: null, spanMs: null, usable: false, why: 'the frame counter did not read back' };
  }
  const frames = after.frames - before.frames;
  const spanMs = after.at - before.at;
  const fps = (frames * 1000) / spanMs;
  const usable = fps >= MEET_DRIVE.FRAME_RATE_BAND.MIN && fps <= MEET_DRIVE.FRAME_RATE_BAND.MAX;
  return {
    fps,
    frames,
    spanMs,
    usable,
    why: usable
      ? null
      : `${fps.toFixed(1)} fps is outside FRAME_RATE_BAND ${MEET_DRIVE.FRAME_RATE_BAND.MIN}-${MEET_DRIVE.FRAME_RATE_BAND.MAX}, so it is a broken reading rather than a slow machine`,
  };
}

/**
 * A 60 Hz-derived sim-tick duration, in the wall clock this page is running at.
 *
 * Falls back to the declared duration when the rate could not be measured, so a
 * failed measurement leaves the driver exactly where it was rather than
 * multiplying a hold by a number nobody checked.
 */
export function scaledForFrameRate(ms, rate) {
  if (ms === null || ms === undefined) return ms;
  if (rate === null || !rate.usable) return ms;
  return Math.round((ms * MEET_DRIVE.DERIVED_AT_FPS) / rate.fps);
}

/**
 * The reading the shared ascent loop takes off a MEET attempt.
 *
 * `sessionDrive.mjs`'s `tapDriveCuesToLockout` reads `{ prompt }` and nothing
 * else, and on the session that comes from `session-prompt`. Here it comes from
 * `attempt-prompt`, which `AttemptView` fills from the same `promptFor` call —
 * same function, same three ladders, different testID. `attempt` rides along
 * because `meetHasLeftTheRep` needs it.
 *
 * TWO QUERIES, NOT `readMeetLoop`'S SEVENTEEN PLUS A WHOLE-DOCUMENT
 * `querySelectorAll('[data-testid]')`. Measured in this environment at
 * `c9443b8`, evaluating against a LIVE rep with the sim and Skia holding the
 * main thread: the beat-to-beat read costs p50 2 ms but **max 81 ms**, and this
 * one costs p50 2 ms, max 31 ms. The tail is what matters — a poll that lands
 * 81 ms late on a cue window a couple of hundred milliseconds wide is how a tap
 * gets graded early — and it is the tail this closes.
 */
const readMeetAscent = (page) =>
  page.evaluate(() => {
    const stage = document.querySelector('[data-testid="meet-attempt"]');
    const prompt = document.querySelector('[data-testid="attempt-prompt"]');
    return { attempt: stage !== null, prompt: prompt === null ? null : prompt.textContent };
  });

/**
 * The rep's screen is gone — `hasLeft` for the shared ascent loop.
 *
 * `AttemptView`'s resolve effect hands off to the judges on the tick the rep
 * resolves, so `meet-attempt` can unmount between two polls and every reading
 * after that is `prompt: null`. Without this the loop waits out its whole
 * `driveTimeoutMs` on every MADE attempt and reports `finalOutcome: null` about
 * a rep that was won. See `hasLeft`'s block in `sessionDrive.mjs`.
 */
const meetHasLeftTheRep = (reading) => reading.attempt === false;

/**
 * Play ONE attempt on the platform, on the grammar of the lift it is ON.
 *
 * ===========================================================================
 * THREE LIFTS, THREE LADDERS — AND `null` IS A LADDER RUNG THAT DOES NOT EXIST
 * ===========================================================================
 * `AttemptView` mounts the same `useLiftLoop` `SetView` does and hands it
 * `attemptConfigFor(state)`, whose `kind` is `live.lift`. So a meet attempt
 * walks the same phase path a training rep of that lift walks, and
 * `LIFT_PROMPTS[kind]` is the table to steer by:
 *
 *   squat     hold to descend  -> release AT DEPTH -> tap the cues -> lockout
 *   bench     hold to lower    -> release AT THE CHEST -> WAIT for 'PRESS!' and
 *                                 press on it -> tap the cues -> lockout
 *   deadlift  hold through the brace, release once the bar leaves the floor ->
 *             tap the cues -> CLAMP DOWN at lockout and DO NOTHING until the
 *             down command
 *
 * A deadlift has no DESCENT and no HOLE: `stepLift` refuses a (deadlift,
 * DESCENT) state outright and `DEPTH_LEGAL.deadlift` does not compile. The old
 * body waited on 'RELEASE AT DEPTH' for `DESCENT_TIMEOUT_MS` and reported
 * "holding never started a descent" about a lift that cannot have one — and it
 * never got that far, because it waited on squat's BRACE line first and a bench
 * attempt never says it.
 *
 * ===========================================================================
 * THE PRESS WAITS OUT THE BRACE, WHICH IS NOT POLITENESS
 * ===========================================================================
 * See `MEET_DRIVE.BRACE_ELAPSE_MS`. `stepLift`'s BRACE branch will not leave
 * until `phaseTick >= braceTicks`, so a press dispatched early buys nothing and
 * silently shortens the descent by however much brace was left — invisible from
 * here, and the depth sweep the start holds came from would then describe a rep
 * nobody played.
 *
 * ===========================================================================
 * THE HOLD IS TIMED FROM THE PRESS, NOT FROM THE DESCENT BEING SEEN
 * ===========================================================================
 * `driveLadderRep`'s method, and the reason CLAUDE.md records for it: the
 * press-to-DESCENT-confirmed detection lag measured 75-337 ms and is
 * attempt-dependent, so a hold started when the descent is OBSERVED runs that
 * much long every time and no fixed constant absorbs it. Subtracting the
 * measured gap live is what makes `holdMs` the descent's real duration.
 *
 * Returns what happened. Nothing here throws on a missed rep: a no-lift is a
 * legal thing for the app to do, and a harness that crashed on one would be
 * reporting its own opinion. A LIFT THIS DRIVER CANNOT IDENTIFY is a different
 * thing and is reported as `played: false` with both readings in the message —
 * see `liftFromBracePrompt`.
 */
export async function playOneMeetAttempt(page, kind, holdMs, hooks = {}) {
  const { walkoutLine = null, attemptLabel = null, beforeFirstPress } = hooks;
  const ladder = LIFT_PROMPTS[kind];
  if (ladder === undefined) {
    return { played: false, kind, why: `no prompt ladder for lift ${JSON.stringify(kind)}` };
  }

  // ===========================================================================
  // WAIT FOR *ANY* LIFT'S BRACE LINE, NOT FOR THIS LIFT'S — AND THE DIFFERENCE
  // IS THE WHOLE DISAGREEMENT CHECK
  // ===========================================================================
  // This waited on `ladder.BRACE` alone, and under a planted `simKindFor`
  // fallback (`attemptConfigFor` returning `kind: 'squat'` for every attempt)
  // that wait TIMED OUT rather than reporting the mismatch: the bench attempt
  // was drawing squat's line the whole time, `BRACE_TIMEOUT_TICKS` started the
  // rep by itself ten seconds later, and by the time the wait gave up the screen
  // had moved on — so the reading it reported was `prompt: null` and the branch
  // written to name the mismatch was unreachable. MEASURED, not reasoned: the
  // mutant's own failure text read "no bench brace to press — prompt was null,
  // which matches no lift's brace line", which is the WRONG diagnosis of a
  // defect this check exists to name.
  //
  // Waiting on any of the three closes it in one poll: the label says which lift
  // the MEET thinks is on the platform and the brace line says which ladder the
  // MECHANIC is walking, and a driver that stops at the first brace line it sees
  // can compare them while both are still on screen.
  const braced = await untilMeet(
    page,
    (s) => liftFromBracePrompt(s.prompt) !== null || !s.attempt,
    MEET_DRIVE.BRACE_TIMEOUT_MS,
  );
  const bracedAs = liftFromBracePrompt(braced.state.prompt);
  if (bracedAs !== kind) {
    // THREE CAUSES, THREE DIFFERENT FIXES, so they are not one message.
    // ANOTHER lift's brace line means the meet's own label and the mechanic's
    // phase model disagree about which lift is on the platform — the
    // `simKindFor` fallback this repository shipped once. No ladder's line at
    // all means either the copy has moved under this driver or the screen went
    // away before it could be read, and the reading says which.
    return {
      played: false,
      kind,
      bracedAs,
      why:
        bracedAs !== null
          ? `the meet labelled this attempt ${JSON.stringify(attemptLabel)} and the mechanic is walking ${bracedAs}'s ladder — prompt was ${JSON.stringify(braced.state.prompt)}, which is ${bracedAs}'s brace line and not ${kind}'s`
          : `no ${kind} brace to press — prompt was ${JSON.stringify(braced.state.prompt)}, which matches no lift's brace line in LIFT_PROMPTS (the attempt screen was ${braced.state.attempt ? 'still up' : 'gone'})`,
    };
  }

  const box = await page.getByTestId('attempt-touch').boundingBox().catch(() => null);
  if (box === null) return { played: false, kind, why: 'the attempt has no touch stage' };
  // BEFORE THE FIRST PRESS, so the rep is at the pose it mounted in and any
  // shots the caller collects here are comparable.
  if (beforeFirstPress !== undefined) await beforeFirstPress(box, walkoutLine, attemptLabel);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  // THE BRACE BEAT HAS TO BE OVER BEFORE THE PRESS MEANS ANYTHING, and the
  // frame rate is measured across exactly that wait — see `pageFrameRate`. One
  // wait, two jobs, no extra time on the clock.
  const rate = await pageFrameRate(page, MEET_DRIVE.BRACE_ELAPSE_MS);
  const heldForMs = scaledForFrameRate(holdMs, rate);
  const timing = {
    ...MEET_DRIVE.ASCENT_TIMING,
    minCueSpacingMs: scaledForFrameRate(MEET_DRIVE.ASCENT_TIMING.minCueSpacingMs, rate),
  };

  let reachedDescent = false;
  let reachedCommand = false;
  const pressedAt = Date.now();
  await page.mouse.down();

  if (ladder.DESCENT === null) {
    // ---- DEADLIFT: THE PULL. A hold through the brace, not a tap at a guessed
    // instant — `stepLift`'s BRACE branch accepts a finger ALREADY DOWN when the
    // brace ends (`pressed || m.held`), and an edge dispatched before that is
    // consumed with nothing to show for it. The finger comes off once the bar
    // is off the floor, which is what a lifter does and is why
    // `LIFT_COPY.PROMPT.BRACE.deadlift` reads 'TAP TO PULL'.
    const offTheFloor = await untilMeet(
      page,
      (s) => !s.attempt || (s.prompt !== null && !s.prompt.includes(ladder.BRACE)),
      MEET_DRIVE.DESCENT_TIMEOUT_MS,
    );
    await page.waitForTimeout(MEET_DRIVE.PULL_RELEASE_MS);
    await page.mouse.up();
    if (!offTheFloor.ok) {
      return {
        played: false,
        kind,
        why: `the pull press never took the bar off the floor — prompt was ${JSON.stringify(offTheFloor.state.prompt)}`,
      };
    }
  } else {
    // ---- SQUAT AND BENCH: THE ECCENTRIC.
    const descending = await untilMeet(
      page,
      (s) => meetSaying(s, ladder.DESCENT) || !s.attempt,
      MEET_DRIVE.DESCENT_TIMEOUT_MS,
    );
    if (!meetSaying(descending.state, ladder.DESCENT)) {
      await page.mouse.up();
      return {
        played: false,
        kind,
        why: `holding never started ${kind}'s descent (${JSON.stringify(ladder.DESCENT)}) — prompt was ${JSON.stringify(descending.state.prompt)}`,
      };
    }
    reachedDescent = true;
    await page.waitForTimeout(Math.max(0, heldForMs - (Date.now() - pressedAt)));
    await page.mouse.up();

    if (ladder.COMMAND !== null) {
      // ---- BENCH ONLY: THE REACTION. `stepLift`'s HOLE branch reads a press
      // EDGE and consumes it whether or not the command has fired, so a robot
      // that pressed early would false-start and be graded
      // `PRESS_FALSE_START_QUALITY` — the mechanic behaving correctly. This
      // waits for the command's own frame. The finger is already up: the depth
      // release lifted it.
      const commanded = await untilMeet(
        page,
        (s) =>
          !s.attempt ||
          meetSaying(s, ladder.COMMAND) ||
          meetSaying(s, ASCENT_PROMPTS.RIDE) ||
          meetSaying(s, ASCENT_PROMPTS.CUE_OPEN),
        MEET_DRIVE.COMMAND_TIMEOUT_MS,
      );
      if (meetSaying(commanded.state, ladder.COMMAND)) {
        reachedCommand = true;
        await page.mouse.down();
        await page.waitForTimeout(MEET_DRIVE.PRESS_TAP_MS);
        await page.mouse.up();
      }
    }
  }

  // ---- THE ASCENT. One implementation, shared with `verify-lift-press.mjs`'s
  // ladder probe — see `tapDriveCuesToLockout`'s header in `sessionDrive.mjs`
  // for why it is a function and not a second copy — parameterised by this
  // lift's own LOCKOUT line and by this arm's own reaction times.
  let clamped = false;
  const clampAtLockout = async () => {
    // THE DEADLIFT'S CHECK, AND THE ONLY PRESS HERE THAT IS NOT A CUE. The bar
    // is locked and the hold has started; `LOCKOUT_GRIP_GRACE_TICKS` (10 ticks,
    // ~167 ms) is how long the finger has to get back on it, and the sag past
    // that is what costs the rep (GDD §6.2's "lockout grind").
    if (kind === 'deadlift') {
      await page.mouse.down();
      clamped = true;
    }
  };
  const ascentArgs = {
    read: readMeetAscent,
    timing,
    lockoutPrompt: ladder.LOCKOUT,
    hasLeft: meetHasLeftTheRep,
  };
  // THE PRECONDITION `tapDriveCuesToLockout` NEEDS: it taps at the top of its
  // first iteration, so entering it without a cue already open dispatches a
  // blind tap that grades a full window early and burns a drive slot.
  const first = await awaitFirstDriveCue(page, ascentArgs);
  let drive = { drivesTapped: 0, lockedOut: false, finalOutcome: first.loop };
  if (first.cueOpen) {
    drive = await tapDriveCuesToLockout(page, {
      ...ascentArgs,
      onTap: async () => {},
      onSettled: async () => {},
      onLockout: clampAtLockout,
    });
  } else if (first.lockedOut) {
    // The bar reached lockout without a cue ever arming. Legal at a light
    // enough load, and on a deadlift the hold is still the beat under test.
    drive = { drivesTapped: 0, lockedOut: true, finalOutcome: first.loop };
    await clampAtLockout();
  }

  let downCommandSeen = false;
  if (kind === 'deadlift' && drive.lockedOut) {
    // WAIT OUT THE HOLD DOING NOTHING, which is the play. GDD §6.2: "the
    // correct play at the decisive instant is to do nothing and keep doing it."
    const downed = await untilMeet(
      page,
      (s) => !s.attempt || meetSaying(s, ladder.DOWN) || SESSION_PROMPTS.OUTCOMES.includes(s.prompt),
      MEET_DRIVE.DOWN_TIMEOUT_MS,
    );
    downCommandSeen = meetSaying(downed.state, ladder.DOWN);
  }
  if (clamped) {
    await page.waitForTimeout(MEET_DRIVE.DRIVE_HOLD_EXTRA_MS);
    await page.mouse.up();
  }

  // The judges' line is what says whether the release was high or buried, so
  // the attempt is not finished being READ until the verdict is up.
  const judged = await untilMeet(
    page,
    (s) => s.feedback !== null || s.select || meetIsOver(s),
    MEET_DRIVE.BEAT_TIMEOUT_MS,
  );
  return {
    played: true,
    kind,
    /** The 60 Hz-derived hold this attempt was asked for. */
    holdMs,
    /**
     * ...and the wall-clock wait it became at this page's measured frame rate.
     * BOTH are reported because they answer different questions: `holdMs` is
     * what the search is converging on and what a re-tune moves, `heldForMs` is
     * what the finger actually did. A reader comparing a miss reason against a
     * hold wants the second.
     */
    heldForMs,
    fps: rate.fps === null ? null : Number(rate.fps.toFixed(1)),
    fpsUsable: rate.usable,
    fpsWhy: rate.why,
    reachedDescent,
    reachedCommand,
    reachedLockout: drive.lockedOut,
    drivesTapped: drive.drivesTapped,
    downCommandSeen,
    /** Kept for callers that predate the per-lift ascent: a cue was tapped. */
    drove: drive.drivesTapped > 0,
    feedback: judged.state.feedback,
  };
}

/**
 * The depth search after one attempt, given the judges' feedback.
 *
 * THE ARITHMETIC IS `sessionDrive.mjs`'S AND IS NOT COPIED. `adaptDepthSearch`
 * is the bisection that halves its step on a reversal, and duplicating it here
 * is exactly the drift that module's header exists to refuse. What this adds is
 * the TRANSLATION: meet day says the same two things about a mistimed release
 * in `MEET_COPY`'s words rather than `LIFT_COPY`'s, so the direction is read
 * off the meet's line and handed over in the shape the shared function reads.
 * Anything else the judges say — a stall, a grind, a clean lift — says nothing
 * about the release and must not move the hold.
 *
 * ===========================================================================
 * A STALL IS NOT A DEPTH MISS, AND AT MEET LOADS IT CAN STILL BE THE HOLD'S
 * FAULT — WHICH IS A LIMIT OF THIS FUNCTION, STATED RATHER THAN PATCHED
 * ===========================================================================
 * `MEET_COPY.FEEDBACK_STALLED` ('The bar won that one.') names the ascent, and
 * this function correctly does not move the hold on it. But depth past
 * `DEPTH_IDEAL` adds demand for the whole ascent (`lift.ts`), so a release that
 * was LEGAL but deep can stall a rep at a meet's loads — measured on the real
 * `stepLift` at `b38980e`: a squat at r=0.94 held 960ms grades `miss:stalled`
 * at 24 of 24 seeds while the same seeds at 840ms grade a make. The judges' line
 * says 'the ascent', the cause is the hold, and nothing here can tell them apart
 * from one line of copy.
 *
 * WHY THAT IS NOT FIXED HERE. Guessing "a stall means go shallower" would move
 * the hold on the one outcome that genuinely says nothing about depth — a rep
 * the ascent lost at a perfectly good release — and this driver would then walk
 * its way out of a band it was already inside. `MEET_DRIVE.START_HOLD_MS` is
 * the answer instead: the starting points are swept to sit inside the band at
 * every load a meet reaches, so the stall region is not entered in the first
 * place. Recorded so a future reader knows the search has a blind spot rather
 * than discovering it as a bombed lift.
 */
export function adaptFromMeetFeedback(search, feedbackText) {
  const said = feedbackText ?? '';
  const detail = said.includes(MEET_DRIVE.FEEDBACK_HIGH)
    ? SESSION_PROMPTS.MISS_TOO_HIGH
    : said.includes(MEET_DRIVE.FEEDBACK_BURIED)
      ? SESSION_PROMPTS.MISS_BURIED
      : '';
  return adaptDepthSearch(search, { detail });
}

/**
 * ONE DEPTH SEARCH PER LIFT, WHICH IS WHAT THE OLD SINGLE SEARCH GOT WRONG.
 *
 * `driveMeetToItsEnd` used to carry ONE search across a whole meet. Squat and
 * bench have different legal bands at the same load — see
 * `MEET_DRIVE.START_HOLD_MS` for the derivation and the numbers — and squat's
 * converged hold is past the point a bench rep is buried, so a shared search
 * bombs the bench and ends the meet before the deadlift ever comes up.
 *
 * `deadlift: null` IS THE LIFT: there is no eccentric to time, so there is no
 * search to carry. A caller reading these must skip that entry, never treat it
 * as an unset one.
 */
export function freshMeetSearches() {
  const forLift = (kind) =>
    MEET_DRIVE.START_HOLD_MS[kind] === null
      ? null
      : {
          ...freshDepthSearch(),
          holdMs: MEET_DRIVE.START_HOLD_MS[kind],
          stepMs: MEET_DRIVE.DEPTH_STEP_MS[kind],
        };
  return { squat: forLift('squat'), bench: forLift('bench'), deadlift: forLift('deadlift') };
}

/**
 * The holds a set of searches is sitting on, as one readable line.
 *
 * `no eccentric` rather than a number for the deadlift, because that is what
 * the `null` means — see `freshMeetSearches`. Printing `0ms` there would read
 * as a hold of zero and invite somebody to compare it with the other two.
 */
export function holdsIn(searches) {
  return MEET_LIFT_ORDER.map((kind) => {
    const hold = searches?.[kind]?.holdMs;
    return `${kind} ${hold === undefined || hold === null ? 'no eccentric' : `${hold}ms`}`;
  }).join(', ');
}

/**
 * Drive whatever meet is currently on screen from wherever it is to whatever it
 * ends on, and report which of the five endings that was.
 *
 * IT NEVER TOUCHES THE URL. That is the whole point of the thing — see the
 * header — so this function takes no search string, does no `goto`, and works on
 * the meet the caller already navigated to with a press.
 *
 * `searches` is the PER-LIFT depth search carried IN and OUT, so a second meet
 * starts from the holds the first one converged on instead of re-learning the
 * mechanic — and so a squat's hold never decides a bench attempt. See
 * `freshMeetSearches`.
 *
 * `'stopped'` is the ending a caller asked for with `shouldStop`. It is a
 * separate word from the four the APP can produce, so a tool that leaves early
 * can never report that as a recap.
 */
export async function driveMeetToItsEnd(page, options = {}) {
  const {
    searches: searchesIn,
    recapSettleMs = null,
    onWalkoutSeen,
    onWalkoutEnded,
    beforeFirstPress,
    onSelectSeen,
    chooseOption,
    shouldStop,
  } = options;
  const startedAt = Date.now();
  const attempts = [];
  /**
   * Which card GDD §6.3's choice was answered with, in order.
   *
   * Reported rather than asserted, like everything else here. It is what lets a
   * caller say "the big arm was pressed" as a fact about this run instead of a
   * fact about the default preference list.
   */
  const pressedOptions = [];
  /**
   * WHICH LIFTS THIS DRIVE ACTUALLY PLAYED AN ATTEMPT ON, in order, first
   * sighting only.
   *
   * Reported rather than asserted, like everything else here — but it is the
   * fact a caller needs to say "the meet reached the deadlift" as an
   * observation about this run rather than as an inference from the attempt
   * count. Nine attempts is not three lifts: three misses on squat is nine
   * halved and a bomb-out.
   */
  const liftsPlayed = [];
  let searches = searchesIn ?? freshMeetSearches();
  /** The line the walk-out just before the current rep was showing. */
  let lastWalkoutLine = null;
  for (;;) {
    const state = await readMeetLoop(page);

    if (shouldStop !== undefined && shouldStop(state)) {
      return {
        ended: 'stopped',
        attempts,
        pressedOptions,
        liftsPlayed,
        searches,
        ms: Date.now() - startedAt,
        why: 'the caller asked to leave here',
      };
    }

    if (meetIsOver(state)) {
      // `'recap'` the PHASE arrives before the server's answer does, so the
      // ending is not known until the screen stops being the bare eyebrow.
      const settled =
        recapSettleMs === null
          ? { ok: false, state }
          : await untilMeet(page, (s) => s.recap || s.refused || s.bombed, recapSettleMs);
      const end = settled.state;
      return {
        ended: end.bombed
          ? 'bombed'
          : end.recap
            ? 'recap'
            : end.refused
              ? 'refused'
              : 'waiting',
        attempts,
        pressedOptions,
        liftsPlayed,
        searches,
        ms: Date.now() - startedAt,
        why:
          recapSettleMs === null
            ? 'the recap deadline could not be derived from sessionTuning.ts, so the round trip was never waited for'
            : `settled after ${settled.ms ?? 0}ms`,
      };
    }

    if (Date.now() - startedAt >= MEET_DRIVE.MEET_TIMEOUT_MS) {
      return { ended: 'timeout', attempts, pressedOptions, liftsPlayed, searches, ms: Date.now() - startedAt, why: 'the meet ran past its deadline' };
    }
    if (attempts.length > MEET_DRIVE.MAX_ATTEMPTS) {
      return {
        ended: 'overrun',
        attempts,
        pressedOptions,
        liftsPlayed,
        searches,
        ms: Date.now() - startedAt,
        why: `played ${attempts.length} attempts, and GDD §6.2 has ${MEET_DRIVE.MAX_ATTEMPTS}`,
      };
    }

    if (state.weighIn) {
      const pressed = await waitUntilDrawn(page, 'weigh-in-action', MEET_DRIVE.BEAT_TIMEOUT_MS);
      if (!pressed.drawn) {
        return { ended: 'stuck', attempts, pressedOptions, liftsPlayed, searches, ms: Date.now() - startedAt, why: `the weigh-in never drew its action — ${pressed.why}` };
      }
      await page.getByTestId('weigh-in-action').click({ timeout: 20000 }).catch(() => {});
      await untilMeet(page, (s) => !s.weighIn, MEET_DRIVE.BEAT_TIMEOUT_MS);
      continue;
    }

    if (state.openers) {
      // The openers are taken AS SUGGESTED (GDD §6.1's pre-filled safe opener).
      // The driver does not override them: the suggestion is derived from the
      // lifter's own e1RM and is the load the rest of the meet ratchets up from.
      const pressed = await waitUntilDrawn(page, 'openers-action', MEET_DRIVE.BEAT_TIMEOUT_MS);
      if (!pressed.drawn) {
        return { ended: 'stuck', attempts, pressedOptions, liftsPlayed, searches, ms: Date.now() - startedAt, why: `the openers never drew an action — ${pressed.why}` };
      }
      await page.getByTestId('openers-action').click({ timeout: 20000 }).catch(() => {});
      await untilMeet(page, (s) => !s.openers, MEET_DRIVE.BEAT_TIMEOUT_MS);
      continue;
    }

    if (state.select) {
      // The cards stagger in, so the screen exists for a frame or two before
      // they do. Waiting for a card rather than for the screen.
      const offered = await untilMeet(page, (s) => !s.select || s.options.length > 0, MEET_DRIVE.BEAT_TIMEOUT_MS);
      if (!offered.state.select) continue;
      const ids = offered.state.options.map((id) => id.replace('attempt-option-', ''));
      // THE CALLER'S POLICY FIRST, THE COWARD'S SECOND. A policy that names a
      // card not on offer is ignored rather than obeyed — the driver may only
      // press what §6.3 actually put on the screen.
      const asked = chooseOption === undefined ? undefined : await chooseOption(ids, offered.state);
      const want =
        asked !== undefined && asked !== null && ids.includes(asked)
          ? asked
          : MEET_DRIVE.SAFEST_OPTIONS.find((id) => ids.includes(id));
      if (want === undefined) {
        return {
          ended: 'stuck',
          attempts,
          pressedOptions,
          liftsPlayed,
          searches,
          ms: Date.now() - startedAt,
          why: `GDD §6.3's choice offered none of ${MEET_DRIVE.SAFEST_OPTIONS.join('/')} — on screen: ${JSON.stringify(offered.state.options)}`,
        };
      }
      // EVERY CARD DRAWN BEFORE THE READER LOOKS, not just the one about to be
      // pressed. `ATTEMPT_CARD_STAGGER_MS` fades them in one at a time, so a
      // reader that ran off the chosen card's arrival would photograph the
      // other one mid-fade — which is this repository's own "presence is not
      // visibility" defect at the sibling card. Scoped to callers that read,
      // because it makes the press strictly later and nothing else needs it.
      if (onSelectSeen !== undefined) {
        const late = [];
        for (const id of ids) {
          const shown = await waitUntilDrawn(page, `attempt-option-${id}`, MEET_DRIVE.BEAT_TIMEOUT_MS);
          if (!shown.drawn) late.push(`${id} (${shown.why})`);
        }
        await onSelectSeen({ ...offered.state, ids, choosing: want, undrawn: late });
      }
      const drawn = await waitUntilDrawn(page, `attempt-option-${want}`, MEET_DRIVE.BEAT_TIMEOUT_MS);
      if (!drawn.drawn) {
        return { ended: 'stuck', attempts, pressedOptions, liftsPlayed, searches, ms: Date.now() - startedAt, why: `the ${want} option never finished fading in — ${drawn.why}` };
      }
      pressedOptions.push(want);
      await page.getByTestId(`attempt-option-${want}`).click({ timeout: 20000 }).catch(() => {});
      await untilMeet(page, (s) => !s.select, MEET_DRIVE.BEAT_TIMEOUT_MS);
      continue;
    }

    if (state.walkout || state.deliberation || state.verdict) {
      // THE ONE BEAT THIS LOOP DOES MORE THAN WAIT THROUGH, and what it does is
      // the caller's. The walk-out's tail is where every millisecond of §12.2's
      // escalation lands, no unit test can watch a clock run, and the beat only
      // exists on a meet that is running — which a page load reaches only by
      // freezing the meet.
      if (state.walkout && onWalkoutSeen !== undefined) await onWalkoutSeen(state);
      // WHICH BEAT THE REP AFTER THIS ONE IS THE FAR SIDE OF. The walk-out's
      // line is the only thing on screen that says whether the attempt is one
      // the meet turns on, and it is gone by the time the rep is drawn — so it
      // is remembered here.
      if (state.walkout) lastWalkoutLine = state.walkoutLine;
      // Three TIMED beats that run themselves out. Nothing to press on any of
      // them, and that is a design claim a caller checks rather than an
      // assumption this makes: a pill drawn here would be a mis-tap that costs
      // the attempt.
      const moved = await untilMeet(page, (s) => s.attempt || s.select || meetIsOver(s), MEET_DRIVE.BEAT_TIMEOUT_MS);
      if (state.walkout && onWalkoutEnded !== undefined) await onWalkoutEnded(state, moved.state);
      if (!moved.ok) {
        return { ended: 'stuck', attempts, pressedOptions, liftsPlayed, searches, ms: Date.now() - startedAt, why: 'a timed beat never handed on' };
      }
      continue;
    }

    if (state.attempt) {
      const label = state.attemptLabel;
      // WHICH LIFT, OFF THE MEET'S OWN LABEL. `AttemptView` prints
      // `MEET_COPY.LIFT_LABEL[live.lift]`, so this is `MeetDayState.live.lift`
      // read back with no phase model in between — and it is what decides which
      // ladder `playOneMeetAttempt` steers by and which search it holds to.
      // `playOneMeetAttempt` then cross-checks it against the brace line the
      // mechanic actually draws, which is the same fact down the other path.
      const kind = liftFromAttemptLabel(label);
      if (kind === null) {
        return {
          ended: 'stuck',
          attempts,
          pressedOptions,
          liftsPlayed,
          searches,
          ms: Date.now() - startedAt,
          why: `the attempt on the platform is labelled ${JSON.stringify(label)}, which names none of ${MEET_LIFT_ORDER.map((k) => MEET_LIFT_LABELS[k]).join('/')} — this driver cannot tell which lift it is on`,
        };
      }
      if (!liftsPlayed.includes(kind)) liftsPlayed.push(kind);
      const search = searches[kind];
      const rep = await playOneMeetAttempt(page, kind, search === null ? null : search.holdMs, {
        walkoutLine: lastWalkoutLine,
        attemptLabel: label,
        beforeFirstPress,
      });
      attempts.push({ attempt: label, ...rep });
      if (!rep.played) {
        return { ended: 'stuck', attempts, pressedOptions, liftsPlayed, searches, ms: Date.now() - startedAt, why: rep.why };
      }
      // ONLY THIS LIFT'S SEARCH MOVES. A deadlift has none — its two miss
      // reasons ('no-depth', 'buried') come from a DESCENT it cannot have — so
      // the feedback is not offered to a search that does not exist.
      if (search !== null) {
        searches = { ...searches, [kind]: adaptFromMeetFeedback(search, rep.feedback) };
      }
      continue;
    }

    await page.waitForTimeout(MEET_DRIVE.POLL_MS);
  }
}
