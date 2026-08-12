/**
 * testBudget.mjs — the one place a per-test wall-clock budget is derived.
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS AND WHY IT IS NOT IN `src/`
 * ===========================================================================
 * `budgetFrom` used to be a private function in `src/empire/engagement.test.ts`.
 * Three other files need it — `streak.test.ts`, `streakEntitlement.test.ts`,
 * `cutInWiring.test.ts`, `progression.test.ts` and `lifterSprite.test.ts` each
 * hold a sweep that runs long enough to be decided by contention — and the
 * alternative to a shared home was five copies of one rule, which is the shape
 * CLAUDE.md bans for every other tuned value in this repository.
 *
 * It lives in `tools/` as a `.mjs` beside a `.d.mts`, the way `png.mjs` and
 * `png.d.mts` already do, for two mechanical reasons rather than taste:
 * `src/tuning/audit.test.ts` pins `FILES.filter(f => f.startsWith('tools/'))`
 * empty, so a `tools/*.ts` would need a `SOURCE_RULES` row — an edit to the
 * three-file surface two sessions share; and a module under `src/` would enter
 * `progression.test.ts`'s reflective sweep as shipped app code, which it is not.
 *
 * ===========================================================================
 * THE DEFECT THIS REPLACES: A MARGIN CALIBRATED AGAINST CONDITIONS THE TESTS
 * DO NOT RUN IN
 * ===========================================================================
 * The rule was "two times measured", and the measurements were taken by running
 * a test alone. Tests do not run alone; vitest runs `availableParallelism() - 1`
 * worker processes at once. Measured on this repository at commit 0155150, four
 * cores, otherwise idle, every heavy test timed both ways — alone in its own
 * file and in a full `npx vitest run` — the same test can take over twice as
 * long in the suite as it does by itself:
 *
 *   ratio  alone   in-suite  test
 *   2.33x  11081   25795     streak > DOES IT TERMINATE: the residue at 80 and 100 days
 *   2.20x  14757   32464     streakEntitlement > DROPPING THE DOOMED BURN, RE-TAKEN
 *   1.95x  13728   26719     engagement > measures chain A re-connected
 *   1.39x  10712   14881     engagement > measures the SINGLE-PURSE engine
 *   1.00x  18443   18484     engagement > pins the four anchors on a seeded domain
 *   0.78x  17784   13862     cutInWiring > THE SET OF FILES THAT TALK TO THE GATE
 *
 * Two facts in that table decided the design. The inflation is over 2x, which
 * is the whole of the old margin, so the old rule had none left. And it is not
 * uniform: it lands on a different test each run, while its neighbours in the
 * same file finish in their usual time, so no test is safe because it was fast
 * last time. The two reds this run produced were in different files.
 *
 * WHAT IT IS NOT, MEASURED RATHER THAN ASSUMED, because the obvious answer is
 * wrong and would have sent the fix the wrong way. It is not the machine being
 * busy in the ordinary sense. `streakEntitlement.test.ts` run alone against two
 * spinning CPU burners came in at 147.5s versus 148.5s idle — no inflation at
 * all — and run alone against a rolling three-file vitest load heavy enough to
 * put the box at load average 10.6 it inflated 1.07x to 1.18x, nowhere near the
 * 2.20x the plain suite produced on an idle machine. So a run-time probe that
 * samples how starved the box is would have read "not starved" on the exact run
 * that failed, and scaling budgets by it would have bought nothing. What is
 * left as the likely cause is a neighbour effect inside the run — vitest reuses
 * a worker process across files, four test files build whole-project
 * TypeScript programs, and an allocation-heavy sweep that lands in a process
 * behind one of those pays for it. That is a hypothesis; the ratios above are
 * the measurement, and the margin is set from the ratios.
 *
 * ===========================================================================
 * THE RULE
 * ===========================================================================
 *   budget = max(GLOBAL_MS, roundUp(basis x HEADROOM_FACTOR, ROUND_UP_TO_MS))
 *
 * The basis at a call site is the LARGER of that test's isolated and in-suite
 * durations, taken on an otherwise idle machine. Both, because either can be
 * the bigger one: the sweeps run longer in the suite, and the four tests that
 * build a TypeScript program run longer alone (0.65x to 0.88x in the suite,
 * warm filesystem cache being the likely reason).
 *
 * Seven of the bases here are larger than that, and it is worth knowing which
 * way that error runs. They were taken from a suite run that had another
 * session's work on the box, so they carry some load inside the number the
 * factor is meant to cover — 12052 ms for the doomed-sale door against 7459 ms
 * on a quiet run. A basis that is too HIGH costs a longer wait before a hang is
 * reported and nothing else; a basis that is too LOW fails a healthy run, which
 * is the failure this file exists to stop. Where the two readings disagree the
 * larger one is kept for that reason, and re-taking never lowers a basis.
 *
 * HOW TO RE-TAKE IT, which is the part that has gone stale twice:
 *
 *   npx vitest run --reporter=json --outputFile.json=/tmp/suite.json
 *   node tools/test-budgets.mjs /tmp/suite.json
 *
 * That prints every test's observed duration against its declared budget,
 * names the rows that have grown into their margin, and names any test over
 * DECLARE_ABOVE_MS with no declared budget at all. It exits non-zero on a
 * finding, so it is a check rather than a report. Run it on an idle box: on a
 * loaded one it measures the load as well, which is a real reading but not the
 * one the call sites record.
 *
 * ===========================================================================
 * THE SECOND MECHANISM: HOW MUCH OF A CORE THIS PROCESS IS ACTUALLY GETTING
 * ===========================================================================
 * A fixed factor answers "how much longer than measured can this legitimately
 * take", and it cannot answer "how many other agents are running suites on this
 * box right now", because that number is not bounded by anything. Three
 * sessions have run here at once: the same suite took 427s, 453s and then 655s,
 * with six timeouts and zero assertion failures.
 *
 * So the factor is multiplied by a measured quantity rather than by a guess.
 * `contentionScale()` spins for a fixed slice and compares the CPU time the
 * process actually accrued to the wall time it took to accrue it. Alone that
 * ratio is 1. With nine runnable processes on four cores it is about 0.44, and
 * the budget needs to be about 2.3x longer for exactly the same work. That is
 * the arithmetic of a fair-share scheduler, not an estimate.
 *
 * WHERE IT IS SAMPLED, AND THE HOLE THAT LEAVES. `@vitest/runner` bakes a
 * test's timeout into the wrapped function when `it()` is called
 * (`chunk-artifact.js`, `const timeout = options.timeout ?? config.testTimeout`
 * then `setFn(task, withTimeout(handler, timeout, …))`), so a hook cannot
 * change it later and per-test re-sampling is not available. The scale is
 * therefore read once per worker process, when the file is collected. A load
 * that arrives after that is not seen — for `engagement.test.ts`, whose tests
 * run for about seven minutes after collection, that is a real hole and it is
 * why the fixed factor stays rather than being replaced by the scale.
 *
 * THAT IT FIRES AT ALL IS MEASURED, and so is the direction it is wrong in.
 * Driven from a process aged four seconds first — a fresh task gets a
 * scheduler boost a minutes-old vitest worker does not — the probe reads a
 * share of 1.000 on an idle box, and 0.566 to 0.641 against eight spinning
 * burners on four cores, taking a 50000 ms budget to 135000-145000. Fair share
 * at nine runnable processes on four cores is 0.44, so the probe UNDER-reads
 * starvation by roughly a third and the scale it returns is smaller than the
 * inflation it is scaling for. It is a floor on the correction rather than the
 * correction, which is why the fixed factor carries the load and this is on
 * top of it.
 *
 * WHAT IT WOULD NOT HAVE CAUGHT, measured rather than assumed. Not every
 * inflation here is starvation. `streakEntitlement.test.ts` run alone against
 * two spinning CPU burners came in at 147.5s versus 148.5s idle, and against a
 * rolling three-file vitest load that put the box at load average 10.6 it
 * inflated 1.07x to 1.18x — while the plain suite, on an idle machine, inflated
 * one of its tests 2.20x. On that run the probe would have read "not starved"
 * and been right, and the test still took twice as long. The likely cause is a
 * neighbour effect inside the run rather than a shortage of CPU. So the scale
 * covers the between-sessions case and the factor covers the within-run case,
 * and neither one covers both.
 *
 * ===========================================================================
 * WHAT THE FACTOR IS, AND WHAT IT COSTS
 * ===========================================================================
 * Four. Not a prediction of contention — a price for being wrong about it, and
 * the two directions cost very different things:
 *
 *   - Too small, and a healthy run goes red on a busy machine. That is the
 *     failure this repository has actually had, three times in three runs, and
 *     its real damage is that it teaches everyone to re-run instead of reading
 *     the failure.
 *   - Too large, and a genuinely hung test is reported later. Bounded and
 *     small: the largest budget this rule produces here is 145s, against a
 *     suite that takes about 440s and a `tools/watchdog.mjs --budget` around
 *     the whole command.
 *
 * The evidence for four rather than three: 2.33x is the worst in-suite
 * inflation measured here, 1.18x the worst added by outside load at load
 * average 10.6, and 2.33 x 1.18 = 2.75. A parallel builder on this repository
 * reported `cutInWiring.test.ts`'s gate-callers test at 51s while several
 * agents ran suites at once, which is 3.7x the 13.9s that test takes in a quiet
 * suite; that number is secondhand and is not the basis for anything, but it is
 * the largest inflation anyone here has reported and four covers it.
 *
 * A sweep is never shrunk to fit a clock. Every one of them carries a GDD §12.3
 * measurement, and trading that for a timeout would be trading evidence for
 * speed.
 *
 * ===========================================================================
 * WHAT THIS WAS VERIFIED AGAINST, AND HOW CLOSE IT CAME
 * ===========================================================================
 * Three whole-suite runs at `4d7686b`, 78 files / 3205 tests, all green, zero
 * timeouts. The percentages are of the UNSCALED budget — what the rule gives
 * with the contention scale pinned at 1 — so they are the margin the fixed
 * factor holds on its own, and the scale is on top of that:
 *
 *   idle, load avg 1.4          430s wall   worst test 26% of its budget
 *   one other session, avg 3.8  503s wall   worst test 43%
 *   two burners + a rolling
 *   suite, load avg 9.5         714s wall   worst test 66%
 *
 * The two closest under load are `streakEntitlement`'s window-boundary sweep
 * (52493 ms of 80000) and its every-fundable-tender sweep (45826 of 70000).
 * The largest test in the tree, `engagement`'s rotation-phase sweep, went
 * 35698 -> 90510 ms across those three runs, which is the 2.5x this is for.
 *
 * FOUR IS CHOSEN, NOT TUNED, and the idle numbers are the reason to say so
 * plainly rather than let a later reader infer otherwise. On a quiet box the
 * worst budget usage in the whole suite is 14-22% depending on the run, so
 * three quarters of the margin is never touched there. It is sized for the
 * loaded case and for the 2.33x a neighbour inside the run can add, not for
 * the idle one, and nobody has tuned it against a distribution — one number
 * was picked to cover the worst compound observation with room. If a
 * playtester or a later builder wants it smaller, the evidence to beat is the
 * loaded column above, not the idle one.
 *
 * The wall-time cost of all this is nothing: 430s idle against 440s before it.
 * The other repair that was considered — serialising the suite so durations
 * stop depending on neighbours — costs the difference between the wall clock
 * and the sum of the test times, which those runs measure at 430s versus 740s
 * idle and 714s versus 1462s loaded. It also does not touch the between-session
 * case, because the load that matters then is not this suite's.
 */

export const SWEEP_BUDGET = Object.freeze({
  /**
   * `TEST_TIMEOUT_MS` in `vitest.config.ts`, mirrored.
   *
   * Mirrored rather than imported: importing a vite config into a node test
   * drags the whole config loader in. `tools/testBudget.test.ts` reads that
   * file's source and fails if the two disagree, so this copy cannot go stale
   * quietly.
   */
  GLOBAL_MS: 30_000,

  /** Multiplies the basis. See the header for why it is 4 and not 2. */
  HEADROOM_FACTOR: 4,

  /** Budgets are rounded up to this, so they read as round numbers. */
  ROUND_UP_TO_MS: 5_000,

  /**
   * Above this, a test needs a declared budget; below it the global already
   * gives at least HEADROOM_FACTOR of margin, so a declaration would be the
   * same number it already has.
   *
   * Derived rather than chosen: it is exactly the basis at which the rule's
   * product reaches the global. `tools/test-budgets.mjs` reports any test that
   * runs longer than this without one.
   */
  DECLARE_ABOVE_MS: 30_000 / 4,

  /** How long `contentionScale` spins to read this process's CPU share. */
  SCALE_SAMPLE_MS: 60,

  /** Samples taken; the median is used, so one scheduling hiccup cannot decide it. */
  SCALE_SAMPLES: 3,

  /**
   * The scale is clamped here.
   *
   * Never below 1, so a fast machine cannot make a budget tighter than the rule
   * says. Never above 3, because the budget is a hang guard and 3 x 4 = 12
   * times the measured duration is already a long time to wait to be told a
   * test is stuck — 435s for the largest sweep here. Past that the guard that
   * matters is `tools/watchdog.mjs --budget`, which caps the whole command.
   */
  MIN_SCALE: 1,
  MAX_SCALE: 3,
});

/**
 * The share of one core this process is getting, in [0, 1], measured by
 * spinning and comparing accrued CPU time to elapsed wall time.
 *
 * Exported so `tools/testBudget.test.ts` can drive it directly. It is a
 * measurement of the machine at the moment it is called, so a test may assert
 * its range and its arithmetic but not a particular value.
 */
export function cpuShareSample(sampleMs = SWEEP_BUDGET.SCALE_SAMPLE_MS) {
  const cpuAt = process.cpuUsage();
  const wallAt = performance.now();
  let spun = 0;
  while (performance.now() - wallAt < sampleMs) spun += 1;
  const wallMs = performance.now() - wallAt;
  const used = process.cpuUsage(cpuAt);
  const cpuMs = (used.user + used.system) / 1000;
  if (spun <= 0 || wallMs <= 0) return 1;
  return Math.min(1, cpuMs / wallMs);
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/**
 * The clamped scale a given CPU share implies, as a pure function.
 *
 * Separate from `contentionScale` so the clamps can be graded against literals
 * rather than against the constants they are made of: an assertion that reads
 * `MAX_SCALE` on both sides cannot fail when `MAX_SCALE` moves, which is the
 * one-sided-by-construction shape CLAUDE.md names, and this one did.
 */
export function scaleFromShare(share) {
  const raw = share > 0 ? 1 / share : SWEEP_BUDGET.MAX_SCALE;
  return Math.min(SWEEP_BUDGET.MAX_SCALE, Math.max(SWEEP_BUDGET.MIN_SCALE, raw));
}

let cachedScale = null;

/**
 * How much longer the same work takes here than it would on an unshared box,
 * clamped to [MIN_SCALE, MAX_SCALE].
 *
 * Cached: it is read once per worker process, at the collection of the first
 * file that declares a budget. See the header for what that sampling point
 * cannot see.
 */
export function contentionScale() {
  if (cachedScale !== null) return cachedScale;
  const samples = [];
  for (let index = 0; index < SWEEP_BUDGET.SCALE_SAMPLES; index += 1) {
    samples.push(cpuShareSample());
  }
  cachedScale = scaleFromShare(median(samples));
  return cachedScale;
}

/** Forgets the cached scale. For tests only. */
export function resetContentionScale() {
  cachedScale = null;
}

/**
 * A declared budget from a measured duration, in milliseconds.
 *
 * @param {number} basisMs the larger of the test's isolated and in-suite
 *   durations, measured on an idle machine. See the header.
 * @param {number} [scale] how much longer the same work takes on this machine
 *   right now. Defaults to the measured `contentionScale()`; pass a number to
 *   grade a budget at a stated scale, which is what `tools/test-budgets.mjs`
 *   does when it compares a run against the rule rather than against the box.
 * @returns {number}
 */
export function budgetFrom(basisMs, scale = contentionScale()) {
  if (!Number.isFinite(basisMs) || basisMs <= 0) {
    throw new RangeError(`a budget must come from a real measurement, received ${basisMs}`);
  }
  if (!Number.isFinite(scale) || scale < SWEEP_BUDGET.MIN_SCALE) {
    throw new RangeError(`a scale below ${SWEEP_BUDGET.MIN_SCALE} would tighten a budget, received ${scale}`);
  }
  const padded = basisMs * SWEEP_BUDGET.HEADROOM_FACTOR * scale;
  const rounded = Math.ceil(padded / SWEEP_BUDGET.ROUND_UP_TO_MS) * SWEEP_BUDGET.ROUND_UP_TO_MS;
  return Math.max(SWEEP_BUDGET.GLOBAL_MS, rounded);
}

/** The budget the rule gives on an unshared machine — the number a call site is graded against. */
export function unscaledBudgetFrom(basisMs) {
  return budgetFrom(basisMs, SWEEP_BUDGET.MIN_SCALE);
}
