import { expectedCaseCount, expectedTraceIds } from "../attempt-plan.ts";
import { buildAttemptCases } from "../attempt-cases.ts";
import { Findings, makeDecision } from "../decision.ts";
import type { Analyzer, AnalyzerContext, Decision } from "../types.ts";

/**
 * Multi-attempt matrix. When `--attempts-per-lift 3` produced (or a bundle
 * claims) the 18 viewport×lift×attempt cases, this analyzer requires every
 * field the hold-pad verification needs and FAILs on a held-state leak.
 * Default-coverage bundles still get the leak / first-press / miss checks
 * on whatever traces exist; they do not fail for not being 18 cases.
 */
export const attemptMatrix: Analyzer = {
  id: "attempt-matrix",
  title: "Multi-attempt hold-pad matrix",
  run: async (ctx: AnalyzerContext): Promise<Decision> => {
    const f = new Findings();
    const { bundle, facts } = ctx;
    const attemptsPerLift = bundle.attemptsPerLift ?? null;
    const cases = Array.isArray(bundle.cases) && bundle.cases.length > 0 ? bundle.cases : buildAttemptCases(bundle, facts);
    f.metric("attemptsPerLift", attemptsPerLift);
    f.metric("caseCount", cases.length);
    f.metric("traceCount", bundle.traces.length);

    if (bundle.traces.length === 0 && cases.length === 0) {
      f.fail("BROWSER_TRACE_MISSING");
    }

    if (attemptsPerLift === 3) {
      const expected = expectedTraceIds(3);
      f.metric("expectedCaseCount", expected.length);
      f.check(expected.length === 18, "EXPECTED_CASE_COUNT_NOT_18");
      f.check(cases.length === 18, "ATTEMPT_MATRIX_NOT_18");
      for (const id of expected) {
        f.check(cases.some((c) => c.id === id), `CASE_MISSING:${id}`);
      }
    }

    let heldLeaks = 0;
    let firstPressRejected = 0;
    let overflow = 0;
    let consoleErrors = 0;
    let ungrounded = 0;
    let parityMismatch = 0;
    let frames = 0;
    let deadliftMissOk = 0;
    let deadliftMissBad = 0;

    for (const c of cases) {
      f.metric(`${c.id}.targetSha`, c.targetSha);
      f.metric(`${c.id}.servedSha`, c.servedSha);
      f.metric(`${c.id}.viewport`, c.viewport);
      f.metric(`${c.id}.lift`, c.lift);
      f.metric(`${c.id}.attempt`, c.attempt);
      f.metric(`${c.id}.heldBeforeFirstInput`, c.heldBeforeFirstInput);
      f.metric(`${c.id}.firstPressAccepted`, c.firstPressAccepted);
      f.metric(`${c.id}.finalJudgment`, c.finalJudgment);
      f.metric(`${c.id}.probeJudgment`, c.probeJudgment);
      f.metric(`${c.id}.mechanicsPhasePath`, c.mechanicsPhasePath.join(">"));
      f.metric(`${c.id}.probePhasePath`, c.probePhasePath.join(">"));
      f.metric(`${c.id}.inputEvents`, c.inputEvents.map((i) => `${i.frame}:${i.kind}`).join(","));
      f.metric(`${c.id}.horizontalOverflow`, c.horizontalOverflow);
      f.metric(`${c.id}.consoleErrors`, c.consoleErrors.length);
      f.metric(`${c.id}.grounded`, c.grounded);
      f.metric(`${c.id}.frameMismatch`, c.frameMismatch);
      f.metric(`${c.id}.framesCompared`, c.framesCompared);
      f.metric(`${c.id}.missMatchesMechanics`, c.missMatchesMechanics);
      f.check(c.targetSha === bundle.targetSha, `CASE_TARGET_SHA_MISMATCH:${c.id}`);
      f.check(c.heldBeforeFirstInput !== true, `INPUT_HELD_STATE_LEAK:${c.id}`);
      if (c.heldBeforeFirstInput === true) heldLeaks += 1;
      if (c.attempt >= 2) f.check(c.heldBeforeFirstInput === false, `HELD_NOT_CLEARED_BEFORE_ATTEMPT:${c.id}`);
      f.check(c.firstPressAccepted === true, `FIRST_PRESS_REJECTED:${c.id}`);
      if (!c.firstPressAccepted) firstPressRejected += 1;
      if (c.horizontalOverflow) {
        overflow += 1;
        f.fail(`HORIZONTAL_OVERFLOW:${c.id}`);
      }
      if (c.consoleErrors.length > 0) {
        consoleErrors += c.consoleErrors.length;
        f.fail(`CONSOLE_ERRORS:${c.id}`);
      }
      if (c.grounded === false) {
        ungrounded += 1;
        f.fail(`ATHLETE_NOT_GROUNDED:${c.id}`);
      }
      frames += c.framesCompared;
      parityMismatch += c.frameMismatch;
      if (c.frameMismatch > 0) f.fail(`FRAME_PARITY_MISMATCH:${c.id}`);
      if (c.lift === "deadlift" && (c.finalJudgment === "failure" || c.probeMade === false)) {
        if (c.missMatchesMechanics === true) {
          deadliftMissOk += 1;
          f.metric(`${c.id}.deadliftMissClassified`, "mechanics");
        } else {
          deadliftMissBad += 1;
          f.fail(`DEADLIFT_MISS_NOT_MECHANICS:${c.id}`);
        }
      }
      f.ref({ kind: "json", ref: `case:${c.id}`, note: `${c.viewport} ${c.lift} a${c.attempt}` });
    }

    f.metric("heldLeaks", heldLeaks);
    f.metric("firstPressRejected", firstPressRejected);
    f.metric("overflowCases", overflow);
    f.metric("consoleErrorEvents", consoleErrors);
    f.metric("ungroundedCases", ungrounded);
    f.metric("framesCompared", frames);
    f.metric("frameMismatchTotal", parityMismatch);
    f.metric("deadliftMissMatchesMechanics", deadliftMissOk);
    f.metric("deadliftMissMisclassified", deadliftMissBad);
    f.check(heldLeaks === 0, "INPUT_HELD_STATE_LEAK");
    f.check(firstPressRejected === 0, "FIRST_PRESS_REJECTED");
    f.check(parityMismatch === 0, "FRAME_PARITY_MISMATCH");

    const wiring = facts.holdPadSource;
    if (wiring) {
      f.metric("holdPad.controllerPresent", wiring.controllerPresent);
      f.metric("holdPad.hasPointerUp", wiring.hasPointerUp);
      f.metric("holdPad.hasPointerCancel", wiring.hasPointerCancel);
      f.metric("holdPad.hasScreenChanged", wiring.hasScreenChanged);
      f.metric("holdPad.hasDispose", wiring.hasDispose);
      f.metric("holdPad.hasResetClear", wiring.hasResetClear);
      if (attemptsPerLift === 3 || heldLeaks > 0) {
        f.check(wiring.controllerPresent, "HOLD_PAD_CONTROLLER_MISSING");
        f.check(wiring.hasPointerUp, "HOLD_PAD_POINTERUP_MISSING");
        f.check(wiring.hasPointerCancel, "HOLD_PAD_POINTERCANCEL_MISSING");
        f.check(wiring.hasScreenChanged, "HOLD_PAD_SCREEN_CHANGE_MISSING");
        f.check(wiring.hasDispose, "HOLD_PAD_UNMOUNT_DISPOSE_MISSING");
        f.check(wiring.hasResetClear, "HOLD_PAD_RESET_CLEAR_MISSING");
      }
    } else if (attemptsPerLift === 3) {
      f.fail("HOLD_PAD_SOURCE_UNINSPECTED");
    }

    const verdict = f.verdict();
    return makeDecision(
      {
        id: attemptMatrix.id,
        title: attemptMatrix.title,
        verdict,
        confidence: cases.length === 0 ? 0.2 : Math.min(0.97, 0.55 + cases.length / 40),
        flags: f.flags,
        metrics: f.metrics,
        evidence: f.evidence,
        humanApprovalRequired: false,
        summary:
          verdict === "PASS"
            ? attemptsPerLift === 3
              ? "All 18 attempt/viewport cases started unheld, accepted the first press, matched the mechanics mirror, and showed no overflow or console errors."
              : "Every captured attempt started unheld and accepted its first press; traces match the mechanics mirror."
            : f.flags.some((x) => x.startsWith("INPUT_HELD_STATE_LEAK") || x.startsWith("HELD_NOT_CLEARED") || x.startsWith("FIRST_PRESS_REJECTED"))
              ? "The hold pad leaked held-state across attempts, so a later first press was swallowed. This is FAIL, not REVIEW."
              : "The multi-attempt matrix did not verify cleanly; see flags.",
      },
      ctx.source,
      ctx.provider,
      ctx.now(),
    );
  },
};

export { expectedCaseCount };
