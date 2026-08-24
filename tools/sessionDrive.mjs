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
  bench: Object.freeze({
    BRACE: 'TAP AND HOLD TO LOWER',
    DESCENT: 'TOUCH THE CHEST',
    HOLE: 'WAIT FOR IT',
    COMMAND: 'PRESS!',
    LOCKOUT: 'LOCK IT',
    DOWN: null,
    SUBTITLE:
      'Touch the chest, wait for the call, then press the instant it comes. Tap every drive cue on the way up.',
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
   * The two miss reasons that say the RELEASE was mistimed, and in which
   * direction. Restated from `LIFT_COPY.MISS_REASON`. The other two —
   * 'The bar beat you at the sticking point.' and 'Ran out of air.' — say the
   * depth was fine and the ascent lost, so they are not adapted on.
   */
  MISS_TOO_HIGH: 'short of depth',
  MISS_BURIED: 'Buried it',
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
