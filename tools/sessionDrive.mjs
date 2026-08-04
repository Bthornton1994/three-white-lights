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
 *   so anything in roughly 710-1150 ms is a legal rep and DEPTH_HOLD_MS sits in
 *   the middle of it. Those numbers are `liftTuning.ts`'s and are restated here
 *   as a derivation, not imported: this is a starting point for a hold, not an
 *   expectation about the app.
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
export const SESSION_PROMPTS = Object.freeze({
  /** BRACE. Nothing is asked for yet; the first press starts the descent. */
  BRACE: 'TAP AND HOLD TO DESCEND',
  /** DESCENT. Depth is growing while the finger is down. */
  DESCENT: 'RELEASE AT DEPTH',
  /** ASCENT, with the drive cue open. The one press that matters. */
  DRIVE: 'DRIVE',
  /** The three things a resolved rep can say. */
  OUTCOMES: Object.freeze(['GOOD LIFT', 'GRINDER', 'NO LIFT']),
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
  /** The RPE the driver picks. Mid-ladder: heavy enough to be a real session. */
  RPE_CHOICE: 'session-rpe-8',

  /** Let the briefing's reveal beat finish before choosing an RPE. */
  BRIEFING_SETTLE_MS: 600,
  /** Let the first set draw before touching it. */
  SET_SETTLE_MS: 400,

  /** How long the finger stays down after the descent starts. See the header. */
  DEPTH_HOLD_MS: 900,
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
export async function openSessionToFirstSet(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page
    .getByTestId('check-in-sleep-good')
    .waitFor({ state: 'visible', timeout: SESSION_DRIVE.FIRST_SET_TIMEOUT_MS });

  const startedAt = Date.now();
  for (const id of SESSION_DRIVE.CHECK_IN_TAPS) await page.getByTestId(id).click();

  try {
    await page
      .getByTestId('session-briefing')
      .waitFor({ state: 'visible', timeout: SESSION_DRIVE.BRACE_TIMEOUT_MS });
  } catch {
    return { reached: false, why: 'the three check-in answers never produced a briefing' };
  }
  await page.waitForTimeout(SESSION_DRIVE.BRIEFING_SETTLE_MS);

  try {
    await page.getByTestId(SESSION_DRIVE.RPE_CHOICE).click();
  } catch {
    return { reached: false, why: `the briefing had no ${SESSION_DRIVE.RPE_CHOICE} to press` };
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
  const first = await readLoop(page);
  if (!saying(first, SESSION_PROMPTS.BRACE)) {
    return {
      reached: false,
      unrecognisedPrompt: first.prompt,
      why: `the first set says ${JSON.stringify(first.prompt)}, which this driver does not recognise — SESSION_PROMPTS is out of date with LIFT_COPY`,
    };
  }
  return { reached: true, msFromFirstTapToSet: Date.now() - startedAt, state: first };
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
export async function playOneRep(page) {
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

  // The one guessed number. See the header for the band it sits in.
  await page.waitForTimeout(SESSION_DRIVE.DEPTH_HOLD_MS);
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
      outcome: ended.state.prompt,
      setLabel: ended.state.setLabel,
      drove: true,
    };
  }
  // No drive cue arrived: either the rep was already over (a buried or high
  // release) or the ascent ran out. Both are outcomes, not harness failures.
  return {
    played: true,
    outcome: drive.state.prompt,
    setLabel: drive.state.setLabel,
    drove: false,
  };
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

  for (;;) {
    const state = await readLoop(page);
    if (state.closeOut) {
      return {
        reachedCloseOut: true,
        reps,
        action: state.action,
        ms: Date.now() - startedAt,
      };
    }
    if (state.rest) {
      // GDD §3.2's rest beat runs itself out (SESSION_TUNING.SET_REST_MS) and
      // hands the next set back. Nothing to press.
      const next = await until(page, (s) => !s.rest, SESSION_DRIVE.REST_TIMEOUT_MS);
      if (!next.ok) {
        return { reachedCloseOut: false, reps, why: 'the rest beat never handed back a set' };
      }
      continue;
    }
    if (!state.set) {
      return {
        reachedCloseOut: false,
        reps,
        why: `the loop left the sets without closing out (check-in=${state.checkIn} briefing=${state.briefing})`,
      };
    }
    if (reps.length >= SESSION_DRIVE.MAX_REPS) {
      return {
        reachedCloseOut: false,
        reps,
        why: `played ${reps.length} reps without reaching a close-out — the loop is not advancing`,
      };
    }
    if (Date.now() - startedAt >= SESSION_DRIVE.CLOSE_OUT_TIMEOUT_MS) {
      return { reachedCloseOut: false, reps, why: 'the session ran past its deadline' };
    }

    const rep = await playOneRep(page);
    reps.push(rep);
    if (!rep.played) {
      return { reachedCloseOut: false, reps, why: rep.why };
    }
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
 */
export async function waitForCloseOutSettled(page) {
  const readTags = () =>
    page.evaluate(() => {
      const tag = (id) => {
        const node = document.querySelector(`[data-testid="${id}"]`);
        return node === null ? null : (node.textContent ?? '').trim();
      };
      return { e1rm: tag('close-out-e1rm-tag'), streak: tag('close-out-streak-tag') };
    });

  const started = Date.now();
  for (;;) {
    const tags = await readTags();
    const pending = Object.entries(tags).filter(([, text]) => text !== null && text !== '');
    if (pending.length === 0) {
      return { settled: true, ms: Date.now() - started, tags };
    }
    if (Date.now() - started >= SESSION_DRIVE.CLOSE_OUT_SETTLE_TIMEOUT_MS) {
      return {
        settled: false,
        ms: Date.now() - started,
        tags,
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
