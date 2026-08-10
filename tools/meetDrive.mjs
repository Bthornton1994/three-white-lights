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
 *   `shouldStop`        verify-meet-sound leaves after the beat it came for
 *                       rather than playing eighteen more attempts for nothing.
 *
 * Putting any of those in here would make this module know about screenshots,
 * audio probes and PNG diffing, which is how a shared driver becomes a second
 * copy of both its callers.
 */

import { SESSION_DRIVE, SESSION_PROMPTS, adaptDepthSearch } from './sessionDrive.mjs';

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
   */
  SAFEST_OPTIONS: Object.freeze(['repeat', 'small', 'big']),

  /** How often the driver re-reads which beat the meet is on. */
  POLL_MS: 25,

  /** How long the finger stays down after the drive press, through lockout. */
  DRIVE_HOLD_EXTRA_MS: SESSION_DRIVE.DRIVE_HOLD_EXTRA_MS,

  /**
   * Deadlines. Generous on purpose: every one of these means "the meet has
   * stopped advancing", not "the meet was slow". A meet beat that runs longer
   * than its own tuning says is the app's business, not the harness's.
   */
  BRACE_TIMEOUT_MS: 15000,
  DESCENT_TIMEOUT_MS: 15000,
  ASCENT_TIMEOUT_MS: 20000,
  /** One whole beat-to-beat transition: bar load, walk-out, judges, cards. */
  BEAT_TIMEOUT_MS: 40000,
  /** The whole meet. Nine attempts measured at ~112 s, so this is ~3x. */
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
      /** GDD §6.1's scaffolding, drawn INSTEAD of the recap on a second meet. */
      placeholder: has('meet-recap-placeholder'),
      bombed: has('meet-bombed'),
      prompt: text('attempt-prompt'),
      attemptLabel: text('attempt-label'),
      /** GDD §6.2 step 1's eyebrow and its line — which attempt, and what it is worth. */
      walkoutEyebrow: text('walkout-attempt'),
      walkoutLine: text('walkout-line'),
      /** The judges' one line. See MEET_DRIVE.FEEDBACK_HIGH for why not `attempt-detail`. */
      feedback: text('verdict-feedback'),
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
export const meetIsOver = (state) => state.recap || state.waiting || state.placeholder || state.bombed;

/**
 * Play ONE attempt on the platform: brace, descend, release, drive.
 *
 * The same mechanic and the same prompts as a training rep — `AttemptView`
 * mounts the same `useLiftLoop` `SetView` does — so `SESSION_PROMPTS` is what
 * it reads. What differs is the testIDs (`attempt-touch` rather than
 * `session-touch`) and that THERE IS NO SECOND CHANCE: a meet attempt resolves
 * once and goes to the judges. See `src/meet/AttemptView.tsx`.
 *
 * Returns what happened. Nothing here throws on a missed rep: a no-lift is a
 * legal thing for the app to do, and a harness that crashed on one would be
 * reporting its own opinion.
 */
export async function playOneMeetAttempt(page, holdMs, hooks = {}) {
  const { walkoutLine = null, attemptLabel = null, beforeFirstPress } = hooks;
  const braced = await untilMeet(
    page,
    (s) => meetSaying(s, SESSION_PROMPTS.BRACE) || !s.attempt,
    MEET_DRIVE.BRACE_TIMEOUT_MS,
  );
  if (!braced.ok || !meetSaying(braced.state, SESSION_PROMPTS.BRACE)) {
    return { played: false, why: `no brace to press — prompt was ${JSON.stringify(braced.state.prompt)}` };
  }

  const box = await page.getByTestId('attempt-touch').boundingBox().catch(() => null);
  if (box === null) return { played: false, why: 'the attempt has no touch stage' };
  // BEFORE THE FIRST PRESS, so the rep is at the pose it mounted in and any
  // shots the caller collects here are comparable.
  if (beforeFirstPress !== undefined) await beforeFirstPress(box, walkoutLine, attemptLabel);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  await page.mouse.down();
  const descending = await untilMeet(
    page,
    (s) => meetSaying(s, SESSION_PROMPTS.DESCENT) || !s.attempt,
    MEET_DRIVE.DESCENT_TIMEOUT_MS,
  );
  if (!meetSaying(descending.state, SESSION_PROMPTS.DESCENT)) {
    await page.mouse.up();
    return {
      played: false,
      why: `holding never started a descent — prompt was ${JSON.stringify(descending.state.prompt)}`,
    };
  }

  await page.waitForTimeout(holdMs);
  await page.mouse.up();

  const drive = await untilMeet(
    page,
    (s) => meetSaying(s, SESSION_PROMPTS.DRIVE) || !s.attempt,
    MEET_DRIVE.ASCENT_TIMEOUT_MS,
  );
  let drove = false;
  if (meetSaying(drive.state, SESSION_PROMPTS.DRIVE)) {
    drove = true;
    await page.mouse.down();
    await untilMeet(page, (s) => !s.attempt, MEET_DRIVE.ASCENT_TIMEOUT_MS);
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
  return { played: true, holdMs, drove, feedback: judged.state.feedback };
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
 * Drive whatever meet is currently on screen from wherever it is to whatever it
 * ends on, and report which of the five endings that was.
 *
 * IT NEVER TOUCHES THE URL. That is the whole point of the thing — see the
 * header — so this function takes no search string, does no `goto`, and works on
 * the meet the caller already navigated to with a press.
 *
 * `search` is the depth search carried IN and OUT, so a second meet starts from
 * the hold the first one converged on instead of re-learning the mechanic.
 *
 * `'stopped'` is the ending a caller asked for with `shouldStop`. It is a
 * separate word from the four the APP can produce, so a tool that leaves early
 * can never report that as a recap.
 */
export async function driveMeetToItsEnd(page, options = {}) {
  const {
    search: searchIn,
    recapSettleMs = null,
    onWalkoutSeen,
    onWalkoutEnded,
    beforeFirstPress,
    shouldStop,
  } = options;
  const startedAt = Date.now();
  const attempts = [];
  let search = searchIn;
  /** The line the walk-out just before the current rep was showing. */
  let lastWalkoutLine = null;
  for (;;) {
    const state = await readMeetLoop(page);

    if (shouldStop !== undefined && shouldStop(state)) {
      return {
        ended: 'stopped',
        attempts,
        search,
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
          : await untilMeet(page, (s) => s.recap || s.placeholder || s.bombed, recapSettleMs);
      const end = settled.state;
      return {
        ended: end.bombed
          ? 'bombed'
          : end.recap
            ? 'recap'
            : end.placeholder
              ? 'placeholder'
              : 'waiting',
        attempts,
        search,
        ms: Date.now() - startedAt,
        why:
          recapSettleMs === null
            ? 'the recap deadline could not be derived from sessionTuning.ts, so the round trip was never waited for'
            : `settled after ${settled.ms ?? 0}ms`,
      };
    }

    if (Date.now() - startedAt >= MEET_DRIVE.MEET_TIMEOUT_MS) {
      return { ended: 'timeout', attempts, search, ms: Date.now() - startedAt, why: 'the meet ran past its deadline' };
    }
    if (attempts.length > MEET_DRIVE.MAX_ATTEMPTS) {
      return {
        ended: 'overrun',
        attempts,
        search,
        ms: Date.now() - startedAt,
        why: `played ${attempts.length} attempts, and GDD §6.2 has ${MEET_DRIVE.MAX_ATTEMPTS}`,
      };
    }

    if (state.weighIn) {
      const pressed = await waitUntilDrawn(page, 'weigh-in-action', MEET_DRIVE.BEAT_TIMEOUT_MS);
      if (!pressed.drawn) {
        return { ended: 'stuck', attempts, search, ms: Date.now() - startedAt, why: `the weigh-in never drew its action — ${pressed.why}` };
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
        return { ended: 'stuck', attempts, search, ms: Date.now() - startedAt, why: `the openers never drew an action — ${pressed.why}` };
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
      const want = MEET_DRIVE.SAFEST_OPTIONS.find((id) =>
        offered.state.options.includes(`attempt-option-${id}`),
      );
      if (want === undefined) {
        return {
          ended: 'stuck',
          attempts,
          search,
          ms: Date.now() - startedAt,
          why: `GDD §6.3's choice offered none of ${MEET_DRIVE.SAFEST_OPTIONS.join('/')} — on screen: ${JSON.stringify(offered.state.options)}`,
        };
      }
      const drawn = await waitUntilDrawn(page, `attempt-option-${want}`, MEET_DRIVE.BEAT_TIMEOUT_MS);
      if (!drawn.drawn) {
        return { ended: 'stuck', attempts, search, ms: Date.now() - startedAt, why: `the ${want} option never finished fading in — ${drawn.why}` };
      }
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
        return { ended: 'stuck', attempts, search, ms: Date.now() - startedAt, why: 'a timed beat never handed on' };
      }
      continue;
    }

    if (state.attempt) {
      const label = state.attemptLabel;
      const rep = await playOneMeetAttempt(page, search.holdMs, {
        walkoutLine: lastWalkoutLine,
        attemptLabel: label,
        beforeFirstPress,
      });
      attempts.push({ attempt: label, ...rep });
      if (!rep.played) {
        return { ended: 'stuck', attempts, search, ms: Date.now() - startedAt, why: rep.why };
      }
      search = adaptFromMeetFeedback(search, rep.feedback);
      continue;
    }

    await page.waitForTimeout(MEET_DRIVE.POLL_MS);
  }
}
