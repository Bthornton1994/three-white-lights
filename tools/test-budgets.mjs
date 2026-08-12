#!/usr/bin/env node
/**
 * test-budgets.mjs — grade every test's real duration against its declared
 * budget, from a real run.
 *
 * ===========================================================================
 * WHAT IT IS FOR
 * ===========================================================================
 * `tools/testBudget.mjs` derives a per-test timeout from a measured duration.
 * The measurement is a number a human typed at a call site, and a number a
 * human typed at a call site goes stale — `vitest.config.ts` carried a list of
 * "the heavy ones" that was wrong twice, and each time it sent the next reader
 * to the wrong file. This is that list made re-runnable, so nobody has to
 * transcribe it again:
 *
 *   npx vitest run --reporter=json --outputFile.json=/tmp/suite.json
 *   node tools/test-budgets.mjs /tmp/suite.json
 *
 * Take it on an idle box. On a loaded one it measures the load too, which is a
 * real reading and a different one from what the call sites record.
 *
 * ===========================================================================
 * WHAT IT REPORTS, AND WHAT MAKES EACH ONE A FINDING
 * ===========================================================================
 *   STALE       a declared test ran more than STALE_RATIO times its recorded
 *               basis. The basis claims how long the work takes; if the work
 *               takes longer, the number the budget is derived FROM is wrong,
 *               whatever the budget currently happens to be.
 *   UNDECLARED  a test ran longer than SWEEP_BUDGET.DECLARE_ABOVE_MS and its
 *               `it(` carries no `budgetFrom`. Below that threshold the 30s
 *               global already gives HEADROOM_FACTOR of margin; above it, the
 *               test is running on a budget nobody derived from anything.
 * There used to be a fourth, `THIN` — "used more than half its budget" — and
 * removing it is worth explaining, because it was the only check this tool
 * shipped with and it was the reason the missing one went unnoticed.
 *
 * It graded the run against the BUDGET, and the budget is
 * `max(GLOBAL, roundUp(basis x 4))`, so it was blind to the basis itself: while
 * the floor dominates, which it does for every basis under DECLARE_ABOVE_MS,
 * understating a basis does not move the budget at all. That is the hole STALE
 * closes.
 *
 * Once STALE existed, THIN could not fire at all. `Math.ceil` rounds up and the
 * floor only raises, so `budget >= basis x 4` always; `duration >= 0.5 x budget`
 * therefore implies `duration >= 2 x basis`, and STALE has already fired at
 * 1.5x. It was strictly dominated — an arm that runs, passes, and has no state
 * of the subject that reaches it. It was kept for one commit on the belief that
 * the two were independent; the fixture that proved otherwise is in
 * `testBudget.test.ts`, where the THIN case reclassified itself to STALE the
 * moment STALE was added.
 *   UNMATCHED   a slow test whose `it(` this tool could not find in the source.
 *               Reported rather than skipped: an instrument that quietly drops
 *               its subject is the defect this repository keeps finding.
 *   EMPTY       no declarations parsed, or no tests read. A green run over an
 *               empty domain is not evidence of anything.
 *
 * ===========================================================================
 * WHAT IT CANNOT DO
 * ===========================================================================
 * It reads `budgetFrom(<literal>)`. Where a call site passes a variable —
 * `engagement.test.ts` generates one test per row of a table and passes
 * `domain.measuredMs` — the basis is not in the text of the call, so the row is
 * reported as `basis: from a table` and graded on UNDECLARED only. Those rows
 * are pinned separately, inside the file, by a test that asserts every row's
 * budget exceeds its own recorded measurement.
 *
 * It also cannot tell a slow test from a hung one, which is the whole reason
 * budgets exist rather than being infinite.
 *
 * AND IT SEES ONE EXECUTION ORDER, which matters more than it sounds.
 * `engagement.test.ts` memoises its sweep helpers, so whichever test reaches a
 * sweep first pays for it and the rest read the cache: on the idle run used to
 * calibrate this, six declared rows measured under 200 ms and five of them
 * measured 0-1 ms. A basis taken from a report is therefore a basis for THAT
 * order, and a reordering could move the cost onto a row whose recorded number
 * was taken while it was free.
 *
 * Checked rather than left as a worry: all six of those rows carry a COLD
 * basis — the five table-generated ones are declared cold by
 * `AnchorDomain.measuredMs`, and `reproduces the headline exactly under the
 * shipped policy` carries 22000 ms while measuring 0 ms. So every row that can
 * be a memo consumer today is budgeted as if it were the payer. What keeps
 * that true is the rule in `testBudget.mjs` that re-taking never LOWERS a
 * basis; that rule is a human discipline and nothing here enforces it, because
 * a tool that only ever observes one order cannot tell a warm reading from a
 * cold one.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { SWEEP_BUDGET, unscaledBudgetFrom } from './testBudget.mjs';

/**
 * A basis is a finding when the run measured more than this multiple of it.
 *
 * ONE-DIRECTIONAL ON PURPOSE, and here is the argument for not making it two.
 * A basis that is too LOW cuts the budget by up to the full factor and can put
 * it under the test's own in-suite duration, which is the defect this whole
 * file exists to prevent. A basis that is too HIGH costs a longer wait before a
 * hang is reported and nothing else. Reporting the second would also fire on
 * every memo-warm row — four of `engagement.test.ts`'s table-generated tests
 * measure 0-3 ms in a suite because an earlier test already paid for the sweep
 * — so it would be noise on rows that are correct. The table prints `ran` and
 * `basis` side by side, so an over-large basis is visible without being a
 * failure.
 *
 * 1.5 rather than 1.0, because a basis is a measurement and measurements move.
 * MEASURED on two idle whole-suite runs, over all 42 declared rows each: the
 * largest `ran / basis` was 0.90 and 0.91, and every row sat below its basis,
 * which is what a basis taken as `max(isolated, in-suite)` should do. So 1.5 clears the real
 * spread with room, and it still catches the 3.64x that the retyped-digit
 * mutation produced. Re-derive it the same way if the suite's shape changes:
 * run the suite idle, print `ran / basis` for every declared row, and put this
 * above the largest.
 *
 * It is a threshold on a ratio and it therefore cannot catch a basis that is
 * understated by less than half. That is not a hole worth closing with a
 * tighter number — at 1.5x the budget is still 2.6x the work — and a ratio at
 * 1.05 would fire on ordinary run-to-run noise until somebody stopped reading
 * the output, which is the failure mode this repository has recorded for three
 * other instruments.
 */
const STALE_RATIO = 1.5;

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

/**
 * Every `it(` in a source file, with the basis it declares if that basis is a
 * literal. Titles are matched as regexes so a template literal's `${…}` can
 * stand for anything, which is how the table-generated tests are found.
 */
function declarationsIn(source) {
  const found = [];
  const pattern = /\bit(?:\.skip|\.only)?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1\s*(,\s*\{[^}]*\})?/g;
  for (const match of source.matchAll(pattern)) {
    const quote = match[1];
    const rawTitle = match[2] ?? '';
    const options = match[3] ?? '';
    const basis = /budgetFrom\(\s*([0-9_]+)\s*\)/.exec(options);
    const declared = options.includes('budgetFrom(');
    const title =
      quote === '`'
        ? new RegExp(`^${escapeButPlaceholders(rawTitle)}$`)
        : new RegExp(`^${escapeRegExp(unescapeLiteral(rawTitle))}$`);
    found.push({
      title,
      declared,
      basisMs: basis ? Number(basis[1].replace(/_/g, '')) : null,
    });
  }
  return found;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unescapeLiteral = (text) => text.replace(/\\(['"`\\])/g, '$1');
/** A template literal's fixed text is exact; each `${…}` matches anything. */
const escapeButPlaceholders = (text) =>
  text
    .split(/\$\{[^}]*\}/)
    .map((chunk) => escapeRegExp(unescapeLiteral(chunk)))
    .join('.*');

/** Every test in a vitest JSON report, repo-relative. */
function testsIn(report) {
  const tests = [];
  for (const file of report.testResults ?? []) {
    const relative = path.relative(REPO_ROOT, file.name);
    for (const assertion of file.assertionResults ?? []) {
      tests.push({
        file: relative,
        title: assertion.title ?? '',
        status: assertion.status,
        durationMs: assertion.duration ?? 0,
      });
    }
  }
  return tests;
}

function grade(report) {
  const tests = testsIn(report);
  const sources = new Map();
  const sourceFor = (file) => {
    if (!sources.has(file)) {
      try {
        sources.set(file, declarationsIn(readFileSync(path.join(REPO_ROOT, file), 'utf8')));
      } catch {
        sources.set(file, null);
      }
    }
    return sources.get(file);
  };

  const rows = [];
  const findings = [];
  let declarationsSeen = 0;

  for (const test of tests) {
    const declarations = sourceFor(test.file);
    const matches = (declarations ?? []).filter((entry) => entry.title.test(test.title));
    const declaration = matches.find((entry) => entry.declared) ?? matches[0] ?? null;
    if (declaration?.declared) declarationsSeen += 1;

    // Graded at MIN_SCALE, deliberately. The budget vitest enforced may have
    // been larger because the box was shared; what this tool asks is whether
    // the recorded basis is still true of the work, which is a question about
    // the rule and not about who else was running.
    const budgetMs =
      declaration?.declared && declaration.basisMs !== null
        ? unscaledBudgetFrom(declaration.basisMs)
        : null;
    const row = {
      ...test,
      declared: Boolean(declaration?.declared),
      basisMs: declaration?.basisMs ?? null,
      budgetMs,
      used: budgetMs === null ? null : test.durationMs / budgetMs,
    };
    rows.push(row);

    if (test.durationMs < SWEEP_BUDGET.DECLARE_ABOVE_MS) continue;
    if (declarations === null || matches.length === 0) {
      findings.push({ kind: 'UNMATCHED', row });
    } else if (!row.declared) {
      findings.push({ kind: 'UNDECLARED', row });
    } else if (row.basisMs !== null && test.durationMs > row.basisMs * STALE_RATIO) {
      // THE COMPARATOR THAT WAS MISSING. `basisMs` was read, carried into the
      // row and printed, and never compared against anything. The only check
      // this tool had graded the run against the BUDGET, and the budget is
      // `max(GLOBAL, basis x factor)` — so while the floor dominates, which it
      // does for every basis under DECLARE_ABOVE_MS, understating a basis does
      // not move the budget at all and nothing could see it. The blind spot was
      // the default case rather than a corner.
      //
      // Measured on the mutation that found it: `budgetFrom(32_464)` retyped as
      // `budgetFrom(3_246)` cuts that test's budget from 129856 ms to the 30000
      // ms floor — 4.3x — and puts it BELOW the 32464 ms the same test measures
      // in a suite, which is the original defect restored. The tool printed the
      // row and exited 0.
      findings.push({ kind: 'STALE', row });
    }
  }

  if (rows.length === 0) findings.push({ kind: 'EMPTY', reason: 'the report holds no tests' });
  if (declarationsSeen === 0) {
    findings.push({ kind: 'EMPTY', reason: 'no test in the report declares a budget' });
  }
  return { rows, findings, declarationsSeen };
}

const ms = (value) => (value === null ? '     —' : String(Math.round(value)).padStart(6));

function main(argv) {
  const reportPath = argv[0];
  if (!reportPath) {
    console.error('usage: node tools/test-budgets.mjs <vitest-json-report> [--all]');
    console.error('  npx vitest run --reporter=json --outputFile.json=/tmp/suite.json');
    return 2;
  }
  const showAll = argv.includes('--all');
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const { rows, findings, declarationsSeen } = grade(report);

  const listed = rows
    .filter((row) => showAll || row.durationMs >= SWEEP_BUDGET.DECLARE_ABOVE_MS || row.declared)
    .sort((left, right) => right.durationMs - left.durationMs);

  console.log(
    `[budgets] ${rows.length} tests read, ${declarationsSeen} declaring a budget, ` +
      `threshold ${SWEEP_BUDGET.DECLARE_ABOVE_MS}ms, factor x${SWEEP_BUDGET.HEADROOM_FACTOR}`,
  );
  console.log('  ran  basis budget used  test');
  for (const row of listed) {
    const used = row.used === null ? '   —' : `${Math.round(row.used * 100)}%`.padStart(4);
    const basis = row.declared && row.basisMs === null ? ' table' : ms(row.basisMs);
    console.log(
      `${ms(row.durationMs)} ${basis} ${ms(row.budgetMs)} ${used}  ${row.file} > ${row.title.slice(0, 70)}`,
    );
  }

  if (findings.length === 0) {
    console.log(
      `[budgets] no findings — every test over ${SWEEP_BUDGET.DECLARE_ABOVE_MS}ms declares a ` +
        `budget and none ran past ${STALE_RATIO}x the basis it declares`,
    );
    return 0;
  }
  console.log('');
  for (const finding of findings) {
    if (finding.kind === 'EMPTY') {
      console.log(`EMPTY       ${finding.reason}`);
      continue;
    }
    const row = finding.row;
    let detail = `ran ${Math.round(row.durationMs)}ms`;
    if (finding.kind === 'STALE') {
      // The two numbers the reader needs are the ratio and what the budget
      // WOULD be if the basis were re-taken from this run, because the gap
      // between that and `budgetMs` is the harm.
      const ratio = row.basisMs ? row.durationMs / row.basisMs : Number.POSITIVE_INFINITY;
      detail =
        `ran ${Math.round(row.durationMs)}ms against a basis of ${row.basisMs} — ` +
        `${ratio.toFixed(2)}x. Budget is ${Math.round(row.budgetMs ?? 0)}ms and this run ` +
        `asks for ${unscaledBudgetFrom(row.durationMs)}ms; re-take the basis`;
    }
    console.log(`${finding.kind.padEnd(11)} ${row.file} > ${row.title.slice(0, 60)} — ${detail}`);
  }
  console.log(`[budgets] ${findings.length} finding(s)`);
  console.log(
    '[budgets] a STALE or UNDECLARED row read from a SHARED box is partly a reading of\n' +
      '          the sharing: durations here inflate about twofold at load average 8 on\n' +
      '          four cores. The basis a call site records is the work, and the factor is\n' +
      '          what covers the load — so re-take on an idle box before raising one.',
  );
  return 1;
}

export { grade, declarationsIn, STALE_RATIO };

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  process.exit(main(process.argv.slice(2)));
}
