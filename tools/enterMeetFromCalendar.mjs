/**
 * enterMeetFromCalendar.mjs — THE ONE PLAYED PATH INTO A MEET, shared by every
 * browser tool (Sprint 1c).
 *
 * `open-meet` is deleted from the shell: a meet is entered from the Career
 * calendar (GDD §6.1), so the drive is three presses where it used to be one —
 * the CAREER pill, the federation card if the chooser is up, then a row's
 * ENTER MEET control. Five tools used to press `shell-open-meet`; if each
 * carried its own copy of the new sequence, the next route change would be
 * five edits and the fifth would be missed — which is this repository's
 * measured sibling-drift failure ("a guard written for one hook must be
 * applied to its sibling, mechanically"). So the sequence lives here once and
 * the tools import it.
 *
 * WHAT THIS DOES NOT DO, so no tool over-reads it: it does not decide the
 * meet is up. Each tool keeps its own "the weigh-in is drawn" (or deeper)
 * wait, with its own opacity discipline, because what counts as "arrived"
 * differs by instrument. This returns once the ENTER MEET press has been
 * delivered, and reports every step it took so a refusal names the beat that
 * refused.
 *
 * THE CHOOSER ARM IS CONDITIONAL ON THE APP'S OWN STATE, not on a flag: a
 * fresh page shows GDD §2.1's federation chooser (nothing chosen), a page
 * that already chose — or already banked a meet — opens the calendar
 * directly. Both are real player states and both are driven, so a tool that
 * enters two meets in one page context exercises each arm once.
 */

/** testIDs, written out by hand for the reason every tool's header gives:
 *  an expectation derived from the constant it checks cannot fail. */
export const CALENDAR_ENTRY = Object.freeze({
  /** The session's CAREER pill — `shell-${intent}` for `open-career`. */
  NAV_OPEN_CAREER: 'shell-open-career',
  /** GDD §2.1's chooser, up only while no federation is chosen. */
  CHOOSING: 'career-choosing',
  /** The default federation's card. The tools choose the same federation the
   *  row was seeded with, so the calendar is the lifter's own. */
  FED_CARD: 'career-fed-meridian',
  /** GDD §6.1's calendar, up once a federation is chosen. */
  CALENDAR: 'career-calendar',
  /** The entry tier's ENTER MEET control — `career-enter-${tier}`. */
  ENTER_LOCAL: 'career-enter-local',
});

/** A2 Create Your Lifter — first-run identity, written out by hand. */
export const CREATE_LIFTER = Object.freeze({
  SCREEN: 'lifter-create',
  CARD: 'lifter-card',
  NAME: 'lifter-name-input',
  SEX_MALE: 'lifter-sex-male',
  SEX_FEMALE: 'lifter-sex-female',
  BODYWEIGHT: 'lifter-bodyweight-input',
  FED: 'lifter-fed-meridian',
  ACTION: 'lifter-create-action',
  LEAVE: 'shell-leave-lifter',
  /** Playwright Career path. Never `A. LIFTER`. */
  NAME_VALUE: 'R. VELLUM',
  BODYWEIGHT_VALUE: '83.5',
});

/**
 * Wait until Create, the card, or the daily session has actually painted.
 *
 * `completeCreateIfNeeded` used to ask `isVisible()` on the same tick as
 * `goto`'s `load` event. On a cold bundle that is still a blank document, so
 * it reported "Create is not showing" and the caller waited two minutes for
 * `session-screen`. Training capture already had this wait; the played-arm
 * verifiers did not.
 */
export async function waitForCreateOrSession(page, timeoutMs = 90000) {
  await page.waitForFunction(
    () => {
      const ids = [
        'lifter-create',
        'lifter-card',
        'session-check-in',
        'session-screen',
        'career-calendar',
        'career-choosing',
      ];
      return ids.some((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (el === null) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    },
    null,
    { timeout: timeoutMs },
  );
}

/**
 * Complete Create Your Lifter when it is the surface on screen.
 *
 * First-run with no profile forces the creating beat, which has no leave
 * chrome. Career Playwright tools that used to boot onto the session now
 * hang there unless this runs first. Debug query strings skip Create
 * (`source === 'debug'`); `?cutin=` is not one of them.
 *
 * @returns `{ created: true }` after the card is up and BACK TO TRAINING
 *   has been pressed, `{ created: false, why: null }` when Create was not
 *   showing, or `{ created: false, why }` naming the step that refused.
 */
export async function completeCreateIfNeeded(page, options = {}) {
  const stepMs = options.stepMs ?? 40000;
  const name = options.name ?? CREATE_LIFTER.NAME_VALUE;
  const bodyweight = options.bodyweight ?? CREATE_LIFTER.BODYWEIGHT_VALUE;
  const sexTestId = options.sexTestId ?? CREATE_LIFTER.SEX_MALE;
  const fedTestId = options.fedTestId ?? CREATE_LIFTER.FED;
  const leaveAfter = options.leaveAfter !== false;

  await waitForCreateOrSession(page, stepMs).catch(() => {});

  const createUp = await page
    .getByTestId(CREATE_LIFTER.SCREEN)
    .isVisible()
    .catch(() => false);
  if (!createUp) return { created: false, why: null };

  try {
    await page.getByTestId(CREATE_LIFTER.NAME).fill(name);
    await page.getByTestId(sexTestId).click({ timeout: stepMs });
    await page.getByTestId(CREATE_LIFTER.BODYWEIGHT).fill(String(bodyweight));
    await page.getByTestId(fedTestId).click({ timeout: stepMs });
    await page.getByTestId(CREATE_LIFTER.ACTION).click({ timeout: stepMs });
    await page.getByTestId(CREATE_LIFTER.CARD).waitFor({ state: 'visible', timeout: stepMs });
  } catch {
    return { created: false, why: 'Create Your Lifter was up but the form refused the press' };
  }
  if (!leaveAfter) return { created: true, why: null };
  try {
    const leave = page.getByTestId(CREATE_LIFTER.LEAVE);
    await leave.waitFor({ state: 'visible', timeout: stepMs });
    await leave.click({ timeout: stepMs });
  } catch {
    return { created: false, why: 'the card drew but BACK TO TRAINING never became pressable' };
  }
  return { created: true, why: null };
}

/**
 * Drive session -> career -> (choose if asked) -> ENTER MEET on the local row.
 *
 * @param page a Playwright page sitting on the daily session.
 * @param options.stepMs per-step wait budget (pill fade-ins, the choose round
 *   trip, the calendar re-draw). One number: the steps are all the same kind
 *   of wait, and a tool that needs a longer meet-arrival wait applies it to
 *   its own arrival check after this returns.
 * @param options.enterTestId which row to enter (default the local tier's).
 * @returns `{ entered: true, chose }` once the enter press was delivered —
 *   `chose` says whether the chooser arm ran — or `{ entered: false, why }`
 *   naming the step that refused.
 */
export async function enterMeetFromCalendar(page, options = {}) {
  const stepMs = options.stepMs ?? 40000;
  const enterTestId = options.enterTestId ?? CALENDAR_ENTRY.ENTER_LOCAL;

  const created = await completeCreateIfNeeded(page, { stepMs });
  if (created.why) return { entered: false, why: created.why };

  // Whichever of the two career beats draws first decides the arm. The
  // chooser is polled alongside the calendar rather than waited on alone, so
  // an already-chosen lifter does not spend a whole timeout learning that.
  let chose = false;
  const calendarUp = async () =>
    await page
      .getByTestId(CALENDAR_ENTRY.CALENDAR)
      .isVisible()
      .catch(() => false);
  const chooserUp = async () =>
    await page
      .getByTestId(CALENDAR_ENTRY.CHOOSING)
      .isVisible()
      .catch(() => false);

  // ALREADY ON THE CAREER SURFACE IS A LEGAL STARTING POINT — a caller
  // retrying a different row after a shut one (verify-cutin-cap's fallback
  // ladder) is standing on the calendar, where the CAREER pill is not drawn
  // and waiting for it would burn the whole step budget learning that.
  if (!(await calendarUp()) && !(await chooserUp())) {
    const pill = page.getByTestId(CALENDAR_ENTRY.NAV_OPEN_CAREER);
    try {
      await pill.waitFor({ state: 'visible', timeout: stepMs });
      await pill.click({ timeout: stepMs });
    } catch {
      return { entered: false, why: 'the CAREER pill never became pressable on the session' };
    }
  }
  const beatDeadline = Date.now() + stepMs;
  while (!(await calendarUp())) {
    if (await chooserUp()) {
      try {
        await page.getByTestId(CALENDAR_ENTRY.FED_CARD).click({ timeout: stepMs });
        chose = true;
      } catch {
        return { entered: false, why: 'the chooser is up but its federation card refused the press' };
      }
      try {
        await page.getByTestId(CALENDAR_ENTRY.CALENDAR).waitFor({ state: 'visible', timeout: stepMs });
      } catch {
        return { entered: false, why: 'the federation was chosen but the calendar never drew' };
      }
      break;
    }
    if (Date.now() > beatDeadline) {
      return { entered: false, why: 'neither career beat drew after the CAREER pill was pressed' };
    }
    await page.waitForTimeout(50);
  }

  try {
    const enter = page.getByTestId(enterTestId);
    await enter.waitFor({ state: 'visible', timeout: stepMs });
    await enter.click({ timeout: stepMs });
  } catch {
    return {
      entered: false,
      why: `the calendar is up but ${enterTestId} never became pressable — the row may not be enterable`,
    };
  }
  return { entered: true, chose };
}
