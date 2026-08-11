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
 *   UNDECLARED  a test ran longer than SWEEP_BUDGET.DECLARE_ABOVE_MS and its
 *               `it(` carries no `budgetFrom`. Below that threshold the 30s
 *               global already gives HEADROOM_FACTOR of margin; above it, the
 *               test is running on a budget nobody derived from anything.
 *   THIN        a declared test used more than REPORT_FRACTION of its budget.
 *               The basis at its call site is lower than what the suite now
 *               does, so re-take it.
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
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { SWEEP_BUDGET, unscaledBudgetFrom } from './testBudget.mjs';

/** A declared budget is a finding when the run used more of it than this. */
const REPORT_FRACTION = 0.5;

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
    } else if (row.used !== null && row.used >= REPORT_FRACTION) {
      findings.push({ kind: 'THIN', row });
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
    console.log(`[budgets] no findings — every test over ${SWEEP_BUDGET.DECLARE_ABOVE_MS}ms ` +
      `declares a budget and none used ${REPORT_FRACTION * 100}% of it`);
    return 0;
  }
  console.log('');
  for (const finding of findings) {
    if (finding.kind === 'EMPTY') {
      console.log(`EMPTY       ${finding.reason}`);
      continue;
    }
    const row = finding.row;
    const detail =
      finding.kind === 'THIN'
        ? `used ${Math.round((row.used ?? 0) * 100)}% of ${Math.round(row.budgetMs ?? 0)}ms; ` +
          `re-take the basis (now ${row.basisMs})`
        : `ran ${Math.round(row.durationMs)}ms`;
    console.log(`${finding.kind.padEnd(11)} ${row.file} > ${row.title.slice(0, 60)} — ${detail}`);
  }
  console.log(`[budgets] ${findings.length} finding(s)`);
  console.log(
    '[budgets] a THIN or UNDECLARED row read from a SHARED box is partly a reading of\n' +
      '          the sharing: durations here inflate about twofold at load average 8 on\n' +
      '          four cores. The basis a call site records is the work, and the factor is\n' +
      '          what covers the load — so re-take on an idle box before raising one.',
  );
  return 1;
}

export { grade, declarationsIn, REPORT_FRACTION };

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  process.exit(main(process.argv.slice(2)));
}
