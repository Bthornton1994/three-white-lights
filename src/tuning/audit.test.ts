/**
 * The magic-number audit, run against the real repository.
 *
 * ---------------------------------------------------------------------------
 * WHY HALF THIS FILE IS MUTATIONS
 * ---------------------------------------------------------------------------
 * A scan whose regex never matches passes every file in the world. That failure
 * mode is invisible in a green suite and it is the specific way this piece
 * would be worthless, so the guard is not "the tree is clean" — the tree being
 * clean is the *last* assertion here, not the first.
 *
 * Before it, `describe('the audit bites')` takes the ACTUAL SOURCE of real
 * files, plants a real magic number in it, asserts THE PLANT APPLIED (a
 * find-and-replace that silently matched nothing would otherwise report a
 * false pass), and asserts the audit reports it. Then
 * `describe('the allowlist is not a sieve')` does the reverse, planting the
 * things the allowlist is supposed to swallow and asserting silence.
 *
 * These mutations run on every `vitest run`. If someone later loosens a
 * pattern until it stops matching, this file goes red rather than green.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import {
  RENDERER_RULE,
  SOURCE_RULES,
  STRUCTURAL_IDIOMS,
  auditSource,
  auditTree,
  blankLiteralTypeUnions,
  codeOnly,
  commentRanges,
  declarationRegions,
  formatFindings,
  isAudited,
  isStructuralIdiom,
  onlyComments,
  ruleFor,
  withoutComments,
} from './audit';
import { PALETTES, PALETTE_MODULES, TUNING, TUNING_MODULES } from './index';
import { LIFT_TUNING } from '../game/liftTuning';
import { SESSION_TUNING } from '../game/sessionTuning';
import { FATIGUE_TUNING } from '../game/fatigue';
import { RECOVERY_DAY_GUARDRAILS } from '../game/streak';
import { CARD_SCREEN } from '../card/cardTuning';
import { STRAIN } from '../art/spriteTuning';
import { LIFT_PALETTE } from '../lift/liftPalette';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

// ---------------------------------------------------------------------------
// Reading the tree
// ---------------------------------------------------------------------------

/**
 * Directories the walk does not descend into.
 *
 * Everything else in the repository is walked, including the root, so a new
 * top-level directory — an `app/` for expo-router, say — is audited the day it
 * appears rather than the day someone remembers to add it here. Nothing on
 * this list contains TypeScript that ships.
 *
 * `.claude` is on the list for a different and sharper reason than the rest.
 * It holds `worktrees/`, and a git worktree is a COMPLETE SECOND CHECKOUT of
 * this same repository — so walking into it audits another agent's in-progress
 * copy of the very files being audited here. That made this test fail on merge
 * with 24 findings, every one of them a path under an agent worktree's own
 * `src/art` directory: real violations, in code that had already been fixed on
 * this branch, reported against a stale parallel tree.
 *
 * The failure mode is worse than a false positive. It makes the audit's result
 * depend on WHO ELSE IS BUILDING RIGHT NOW — green when no worktree exists,
 * red when one does, and red with different findings depending on what that
 * other agent has half-finished. A check whose verdict moves with unrelated
 * state is not a check. Anyone with a worktree, agent or human, hits this.
 */
const NOT_WALKED: readonly string[] = ['node_modules', '.git', '.expo', 'dist', 'coverage', '.claude'];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (NOT_WALKED.includes(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Every audited source file, repository-relative POSIX, sorted. */
function auditedFiles(): string[] {
  return walk(ROOT)
    .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
    .filter(isAudited)
    .sort();
}

function read(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8');
}

/** Every `.ts`/`.tsx` file the walk reaches, tests included. */
function everyTypeScriptFileUnder(): readonly string[] {
  return walk(ROOT)
    .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
    .filter((f) => /\.tsx?$/.test(f))
    .sort();
}

/**
 * WHICH CHARACTERS ARE INSIDE A COMMENT, according to the TypeScript parser.
 *
 * Every comment is in the LEADING trivia of exactly one token, except one at
 * the end of a line, which is in the TRAILING trivia of the token before it.
 * Both are collected, over every token including the end-of-file one, so a
 * comment at the bottom of a file is covered.
 */
function parserCommentMask(sourceFile: ts.SourceFile, source: string): readonly boolean[] {
  const mask = new Array<boolean>(source.length).fill(false);
  const mark = (from: number, to: number): void => {
    for (let i = from; i < to; i += 1) mask[i] = true;
  };
  const visit = (node: ts.Node): void => {
    const children = node.getChildren(sourceFile);
    if (children.length === 0) {
      ts.forEachLeadingCommentRange(source, node.getFullStart(), (from, to) => mark(from, to));
      ts.forEachTrailingCommentRange(source, node.getEnd(), (from, to) => mark(from, to));
      return;
    }
    for (const child of children) visit(child);
  };
  visit(sourceFile);
  return mask;
}

/** The kind of the innermost token covering `pos`. */
function tokenKindAt(sourceFile: ts.SourceFile, pos: number): ts.SyntaxKind {
  let found: ts.SyntaxKind = sourceFile.kind;
  const visit = (node: ts.Node): void => {
    if (pos < node.getStart(sourceFile) || pos >= node.getEnd()) return;
    const children = node.getChildren(sourceFile);
    if (children.length === 0) {
      found = node.kind;
      return;
    }
    for (const child of children) visit(child);
  };
  visit(sourceFile);
  return found;
}

const FILES = auditedFiles();

/**
 * A file that stands in for "a component" in the mutation tests. Named
 * explicitly so that deleting it breaks this file loudly instead of quietly
 * reducing what is checked.
 */
const A_SESSION_COMPONENT = 'src/session/SetView.tsx';
const A_LIFT_COMPONENT = 'src/lift/LiftStage.tsx';

/** Replace exactly once, and fail loudly if the pattern did not match. */
function mutate(source: string, find: string, replaceWith: string): string {
  const occurrences = source.split(find).length - 1;
  expect(occurrences, `mutation target "${find}" appears ${occurrences} times`).toBe(1);
  const mutated = source.replace(find, replaceWith);
  expect(mutated, 'mutation produced no change').not.toBe(source);
  expect(mutated).toContain(replaceWith);
  return mutated;
}

// ---------------------------------------------------------------------------
// The scan can see the tree at all
// ---------------------------------------------------------------------------

describe('the audit has something to audit', () => {
  it('finds the real source tree, including components', () => {
    // Without this, every assertion below passes vacuously on an empty list.
    expect(FILES.length).toBeGreaterThan(40);
    expect(FILES.filter((f) => f.endsWith('.tsx')).length).toBeGreaterThan(5);
    for (const anchor of [
      A_SESSION_COMPONENT,
      A_LIFT_COMPONENT,
      'src/card/ResultCardScreen.tsx',
      'src/art/LifterSpriteView.tsx',
      'src/game/lift.ts',
      'App.tsx',
      'index.ts',
      'vitest.config.ts',
    ]) {
      expect(FILES, `${anchor} is missing from the audited set`).toContain(anchor);
    }
  });

  it('walks the whole repository, not just src/', () => {
    // The walk starts at the root and skips only NOT_WALKED, so a new
    // top-level directory is covered the day it appears. `vitest.config.ts`
    // above is the proof: it is outside `src/` and nothing added it by hand.
    expect(FILES.some((f) => !f.startsWith('src/'))).toBe(true);
    expect(FILES.every((f) => !f.includes('node_modules'))).toBe(true);
  });

  it('does not reach the offline tools, and says so', () => {
    // `tools/` is `.mjs`, so `isAudited` skips it by extension. That is a real
    // limit, not a claim of coverage: an offline capture script could hold a
    // bare number and this would not see it. Shipped game code is `.ts`/`.tsx`.
    expect(isAudited('tools/sprites.mjs')).toBe(false);
    expect(FILES.filter((f) => f.startsWith('tools/'))).toEqual([]);
    // ...but a TypeScript file added there WOULD be audited.
    expect(isAudited('tools/shoot.ts')).toBe(true);
  });

  it('never walks into a sibling git worktree, whoever is building in one', () => {
    // A worktree under `.claude/` is a COMPLETE SECOND CHECKOUT of this repo,
    // so descending into it audits another agent's in-progress copy of these
    // same files. On merge that produced 24 findings, all under
    // `.claude/worktrees/agent-*/src/art/` — real violations in code already
    // fixed here, reported against a stale parallel tree.
    //
    // The point is not the false positives. It is that the audit's verdict
    // would depend on who else happens to be building right now: green with no
    // worktree, red with one, and red DIFFERENTLY depending on what that agent
    // has half-written. Pinned as an exact-prefix check rather than a substring
    // one so a legitimate `src/claude*.ts` could never be silently skipped.
    expect(NOT_WALKED).toContain('.claude');
    expect(FILES.every((f) => !f.startsWith('.claude/'))).toBe(true);
    expect(isAudited('.claude/worktrees/agent-x/src/art/palette.ts')).toBe(true);
  });

  it('audits the auditor, with no self-exemption', () => {
    expect(FILES).toContain('src/tuning/audit.ts');
    expect(ruleFor('src/tuning/audit.ts')).toBe(RENDERER_RULE);
    expect(ruleFor('src/tuning/index.ts')).toBe(RENDERER_RULE);
  });

  it('skips tests and non-source, and nothing else', () => {
    expect(isAudited('src/session/SetView.tsx')).toBe(true);
    expect(isAudited('src/game/lift.ts')).toBe(true);
    expect(isAudited('src/game/lift.test.ts')).toBe(false);
    expect(isAudited('src/art/palette.test.ts')).toBe(false);
    expect(isAudited('docs/GDD.md')).toBe(false);
    expect(isAudited('node_modules/x/index.ts')).toBe(false);
    // A brand new file nobody has classified is audited, at the strictest
    // rule. That is what stops the next component from being a fresh hole.
    expect(isAudited('src/meet/MeetScreen.tsx')).toBe(true);
    expect(ruleFor('src/meet/MeetScreen.tsx')).toBe(RENDERER_RULE);
  });
});

// ---------------------------------------------------------------------------
// The stripper
// ---------------------------------------------------------------------------

describe('codeOnly', () => {
  it('preserves every offset in every real file', () => {
    // The single strongest guard on the stripper. A scanner bug that ate a
    // chunk of code would make the audit quietly blind to it, and nothing else
    // here would notice.
    for (const relPath of FILES) {
      const source = read(relPath);
      const stripped = codeOnly(source);
      expect(stripped.length, `${relPath} length`).toBe(source.length);
      expect(stripped.split('\n').length, `${relPath} lines`).toBe(source.split('\n').length);
    }
  });

  it('leaves real code alone', () => {
    const stripped = codeOnly(read(A_SESSION_COMPONENT));
    expect(stripped).toContain('SESSION_TUNING.REP_RESULT_HOLD_MS');
    expect(stripped).toContain('L.ROW_GAP');
    expect(stripped).toContain('StyleSheet.create');
  });

  it('blanks comments, strings, templates and regexes', () => {
    expect(codeOnly('const a = 1; // 240 ms')).not.toContain('240');
    expect(codeOnly('/* 240 */ const a = 1;')).not.toContain('240');
    expect(codeOnly("const s = 'padding: 240px';")).not.toContain('240');
    expect(codeOnly('const s = `padding: 240px`;')).not.toContain('240');
    expect(codeOnly('const m = /^(\\d{4})-(\\d{2})$/.exec(s);')).not.toContain('4');
  });

  it('keeps template interpolations live', () => {
    // Blanking the whole template — which the older regex-chained strippers do
    // — makes `` `${16}` `` a way to smuggle a number past the scan.
    expect(codeOnly('const s = `pad ${16}px`;')).toContain('16');
    expect(codeOnly('const s = `pad ${16}px`;')).not.toContain('pad');
    expect(codeOnly('const s = `a ${x * 3} b ${y} c`;')).toContain('3');
  });

  it('does not mistake JSX self-closing tags for regex literals', () => {
    // `<A x={0} /> <B y={17} />` on one line: the `/` of the first `/>` is
    // preceded by `}`, and a naive stripper eats everything up to the second
    // `/` as a regex body — taking the 17 with it.
    const jsx = 'const v = <><A x={0} /> <B y={17} /></>;';
    expect(codeOnly(jsx)).toContain('17');
  });

  it('still recognises a genuine regex after a keyword or a bracket', () => {
    expect(codeOnly('return /\\d{5}/.test(s);')).not.toContain('5');
    expect(codeOnly('const parts = s.split(/[,;]{3}/);')).not.toContain('3');
    // ...and a division is not a regex.
    expect(codeOnly('const half = width / 2; const q = height / 4;')).toContain('4');
  });
});

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

describe('declarationRegions', () => {
  it('names the block a literal sits in', () => {
    const regions = declarationRegions(
      ['export const FOO = {', '  a: 3,', '};', '', 'function helper() {', '  return 4;', '}'].join(
        '\n',
      ),
    );
    const names = regions.map((r) => r.name);
    expect(names).toContain('FOO');
    expect(names).toContain('helper');
    expect(regions.find((r) => r.name === 'FOO')?.isNamedConstant).toBe(true);
    expect(regions.find((r) => r.name === 'helper')?.isNamedConstant).toBe(false);
  });

  it('refuses to treat a shouty function as a constants block', () => {
    const arrow = declarationRegions('export const CLAMP = (x: number) => x * 3;');
    expect(arrow.find((r) => r.name === 'CLAMP')?.isNamedConstant).toBe(false);
  });

  it('does not open a region on a `const` inside a comment or a string', () => {
    const names = declarationRegions(codeOnly('// const SNEAKY = 3;\nconst real = 1;')).map(
      (r) => r.name,
    );
    expect(names).not.toContain('SNEAKY');
  });
});

// ---------------------------------------------------------------------------
// THE AUDIT BITES — mutations on real files
// ---------------------------------------------------------------------------

describe('the audit bites', () => {
  it('is clean on the unmutated originals, so a finding is the mutation', () => {
    expect(auditSource(A_SESSION_COMPONENT, read(A_SESSION_COMPONENT))).toEqual([]);
    expect(auditSource(A_LIFT_COMPONENT, read(A_LIFT_COMPONENT))).toEqual([]);
  });

  it('catches a timing window hardcoded in a component', () => {
    const mutated = mutate(read(A_SESSION_COMPONENT), 'SESSION_TUNING.REP_RESULT_HOLD_MS', '240');
    const found = auditSource(A_SESSION_COMPONENT, mutated);
    expect(found.map((f) => f.text)).toEqual(['240']);
    expect(found[0]?.kind).toBe('numeric');
    expect(found[0]?.region).toBe('SetView');
    expect(formatFindings(found)).toContain('SetView.tsx');
  });

  it('catches an animation duration hardcoded in the renderer', () => {
    const mutated = mutate(
      read(A_LIFT_COMPONENT),
      'const shake = stageShake(state);',
      'const shake = stageShake(state);\n  const fadeMs = 180;',
    );
    expect(auditSource(A_LIFT_COMPONENT, mutated).map((f) => f.text)).toEqual(['180']);
  });

  it('catches a feel value smuggled in as a property value', () => {
    const mutated = mutate(
      read(A_LIFT_COMPONENT),
      'strokeWidth={F.CUE_RING_STROKE}\n          opacity={flash}',
      'strokeWidth={2.5}\n          opacity={flash}',
    );
    expect(auditSource(A_LIFT_COMPONENT, mutated).map((f) => f.text)).toEqual(['2.5']);
  });

  it('catches a bare 2 in a property-value position', () => {
    // The one the older scans walk past: `2` is structural nearly everywhere,
    // and `letterSpacing: 2` is a design decision.
    const mutated = mutate(
      read(A_SESSION_COMPONENT),
      'letterSpacing: L.LETTER_SPACING,\n  },\n  weight:',
      'letterSpacing: 2,\n  },\n  weight:',
    );
    expect(auditSource(A_SESSION_COMPONENT, mutated).map((f) => f.text)).toEqual(['2']);
  });

  it('catches a leading-dot fraction', () => {
    const mutated = mutate(
      read(A_LIFT_COMPONENT),
      'opacity={segment.alpha}',
      'opacity={segment.alpha * .85}',
    );
    expect(auditSource(A_LIFT_COMPONENT, mutated).map((f) => f.text)).toEqual(['.85']);
  });

  it('catches a colour literal where a palette entry belongs', () => {
    const mutated = mutate(read(A_SESSION_COMPONENT), 'SESSION_PALETTE.GOOD', "'#3ad16b'");
    const found = auditSource(A_SESSION_COMPONENT, mutated);
    expect(found.map((f) => f.kind)).toEqual(['colour']);
    expect(found[0]?.text).toBe('#3ad16b');
  });

  it('catches a colour written as rgba()', () => {
    const mutated = mutate(
      read(A_SESSION_COMPONENT),
      'SESSION_PALETTE.PIP_DONE',
      "'rgba(125, 220, 143, 1)'",
    );
    expect(auditSource(A_SESSION_COMPONENT, mutated).map((f) => f.kind)).toEqual(['colour']);
  });

  it('catches a colour literal in a tuning module too', () => {
    // A palette entry is not allowed to migrate into a tuning block just
    // because that block is allowed to hold numbers.
    const found = auditSource('src/game/liftTuning.ts', "export const X = { EDGE: '#1c2230' };");
    expect(found.map((f) => f.kind)).toEqual(['colour']);
  });

  it('catches a named constant declared in a component — "named" is not enough', () => {
    // THE OTHER HALF OF "ONE PLACE". This is a perfectly good named constant.
    // It is still a scattering, because it is not in a registered home.
    const mutated = mutate(
      read(A_SESSION_COMPONENT),
      'const L = SESSION_LAYOUT;',
      'const L = SESSION_LAYOUT;\nconst REP_HOLD_MS = 240;',
    );
    expect(auditSource(A_SESSION_COMPONENT, mutated).map((f) => f.text)).toEqual(['240']);
  });

  it('catches a bare number in a function body of a registered constants file', () => {
    // Registration buys named blocks, not a blanket pardon.
    const found = auditSource(
      'src/game/fatigue.ts',
      'export function decay(x: number): number {\n  return x * 0.93;\n}\n',
    );
    expect(found.map((f) => f.text)).toEqual(['0.93']);
  });

  it('catches a number in a file nobody has registered', () => {
    const found = auditSource('src/meet/MeetScreen.tsx', 'export const WALKOUT_MS = 4200;\n');
    expect(found.map((f) => f.text)).toEqual(['4200']);
  });

  it('catches a number hidden in a template interpolation', () => {
    const found = auditSource('src/session/Fake.tsx', 'const s = `pad ${17}px`;\n');
    expect(found.map((f) => f.text)).toEqual(['17']);
  });

  it('reports the file, the line and the literal, so the failure is actionable', () => {
    const found = auditSource('src/session/Fake.tsx', 'const a = 1;\nconst b = 240;\n');
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(2);
    expect(found[0]?.file).toBe('src/session/Fake.tsx');
    expect(formatFindings(found)).toMatch(/src\/session\/Fake\.tsx:2:\d+ {2}240/);
  });
});

// ---------------------------------------------------------------------------
// ...AND THE ALLOWLIST IS NOT A SIEVE
// ---------------------------------------------------------------------------

describe('the allowlist is not a sieve', () => {
  const clean = (code: string): readonly string[] =>
    auditSource('src/session/Fake.tsx', code).map((f) => f.text);

  it('swallows exactly the idioms it documents, and no more', () => {
    expect(clean('const first = list[0]; const next = i + 1;')).toEqual([]);
    expect(clean('const s = { flex: 1, opacity: 1, strokeWidth: 1 };')).toEqual([]);
    expect(clean('const mid = L.ROW_GAP / 2; const d = r * 2; const v = 2 * f;')).toEqual([]);
    expect(clean('const third = rgb[2]; const alt = index % 2 === 0;')).toEqual([]);
    expect(clean('const frac = percentOf1RM(r, e) / 100;')).toEqual([]);
    expect(clean('const factor = 10 ** DECIMALS;')).toEqual([]);
    expect(clean('const c = ((v << 3) | (v >> 2)) & 0xff;')).toEqual([]);
    expect(clean('type Attempt = 1 | 2 | 3;')).toEqual([]);
  });

  it('does not swallow the planted values', () => {
    // The reverse of the mutation block: each literal the audit is supposed to
    // catch, checked against the same allowlist that clears the idioms above.
    expect(clean('const windowMs = 240;')).toEqual(['240']);
    expect(clean('const scale = 0.85;')).toEqual(['0.85']);
    expect(clean('const scale = .85;')).toEqual(['.85']);
    expect(clean('const s = { letterSpacing: 2 };')).toEqual(['2']);
    expect(clean('const s = { padding: 100 };')).toEqual(['100']);
    expect(clean('const s = { count: 10 };')).toEqual(['10']);
    expect(clean('const seconds = ms / 1000;')).toEqual(['1000']);
    expect(clean('const lights = 3;')).toEqual(['3']);
    expect(clean('const a = 1.5;')).toEqual(['1.5']);
    expect(clean('const a = 10.25e-3;')).toEqual(['10.25e-3']);
    expect(clean('const a = 1e-6;')).toEqual(['1e-6']);
  });

  it('does not report a literal twice or split a decimal in half', () => {
    expect(clean('const a = 1.5;')).toEqual(['1.5']);
    expect(clean('const o = { gain: 0.35, drop: 0.1 };')).toEqual(['0.35', '0.1']);
  });

  it('does not fire on member access or identifiers containing digits', () => {
    expect(clean('const y = pose.hipY - state.barForwardPx;')).toEqual([]);
    expect(clean('const p = chart.rpe10; const q = LIFT_TUNING.DEPTH_WINDOW_MS;')).toEqual([]);
  });

  it('turns the conditional idioms off in a property-value position', () => {
    expect(isStructuralIdiom('x / 2', 'x / '.length, '2')).toBe(true);
    expect(isStructuralIdiom('{ a: 2 }', '{ a: '.length, '2')).toBe(false);
    expect(isStructuralIdiom('x / 100', 'x / '.length, '100')).toBe(true);
    expect(isStructuralIdiom('{ a: 100 }', '{ a: '.length, '100')).toBe(false);
    // ...but 0 and 1 stay structural everywhere, or `flex: 1` breaks.
    expect(isStructuralIdiom('{ flex: 1 }', '{ flex: '.length, '1')).toBe(true);
    expect(isStructuralIdiom('{ x: 0 }', '{ x: '.length, '0')).toBe(true);
  });

  it('documents every idiom it applies', () => {
    expect(STRUCTURAL_IDIOMS.length).toBeGreaterThan(0);
    for (const line of STRUCTURAL_IDIOMS) expect(line.length).toBeGreaterThan(0);
  });

  it('blanks a literal type union without eating arithmetic', () => {
    expect(blankLiteralTypeUnions('type A = 1 | 2 | 3;')).not.toMatch(/3/);
    expect(blankLiteralTypeUnions('const a = 3;')).toContain('3');
  });

  it('keeps strings when looking for colours, and drops comments', () => {
    expect(withoutComments("const c = '#1c2230';")).toContain('#1c2230');
    expect(withoutComments('// #1c2230 is the chip colour')).not.toContain('#1c2230');
    expect(auditSource('src/session/Fake.tsx', '// try #1c2230 here\n')).toEqual([]);
    // A URL fragment or an id selector is not a colour: three-to-eight hex
    // digits and nothing else. `#section` and `#1` are left alone.
    expect(auditSource('src/session/Fake.tsx', "const u = 'docs.md#section';")).toEqual([]);
  });

  /**
   * Every character of `source` is in exactly one of the two halves. Returns
   * the positions where that fails, with enough context to read the failure.
   */
  const partitionFailures = (label: string, source: string): readonly string[] => {
    const code = withoutComments(source);
    const comments = onlyComments(source);
    const out: string[] = [];
    if (code.length !== source.length) out.push(`${label}: withoutComments changed the length`);
    if (comments.length !== source.length) out.push(`${label}: onlyComments changed the length`);
    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === undefined || ch === '\n' || ch === ' ') continue;
      const inCode = code[i] === ch;
      const inComments = comments[i] === ch;
      if (inCode !== inComments) continue;
      out.push(
        `${label}@${i} (${JSON.stringify(ch)}) is in ${inCode ? 'BOTH halves' : 'NEITHER half'}: ` +
          JSON.stringify(source.slice(Math.max(0, i - 50), i + 30)),
      );
    }
    return out;
  };

  it('`commentRanges` reports each comment once, in order, delimiters included', () => {
    // THE PRIMITIVE BOTH HALVES READ, checked on its own rather than only
    // through them. `withoutComments` and `onlyComments` agree with each other
    // no matter what this returns — they are the same list read two ways — so a
    // wrong list is invisible from either of them alone.
    const text = ['const a = 1; // trailing', '/* block', ' * over lines', ' */', 'const b = 2;'].join(
      '\n',
    );
    const ranges = commentRanges(text);
    expect(ranges.map((r) => text.slice(r.from, r.to))).toEqual([
      '// trailing',
      '/* block\n * over lines\n */',
    ]);
    // Ordered, non-overlapping, and inside the string.
    let previousEnd = 0;
    for (const { from, to } of ranges) {
      expect(from).toBeGreaterThanOrEqual(previousEnd);
      expect(to).toBeGreaterThan(from);
      expect(to).toBeLessThanOrEqual(text.length);
      previousEnd = to;
    }
    // A line comment stops BEFORE its newline, so the line structure survives.
    expect(text.charAt(ranges[0]?.to ?? 0)).toBe('\n');
    // And nothing that only looks like a comment gets a range.
    expect(commentRanges("const u = 'https://x/y'; const d = a / b / c;")).toEqual([]);
    expect(commentRanges('// a glob `**/*.ts` is one comment, not two')).toHaveLength(1);
  });

  it('`onlyComments` and `withoutComments` PARTITION EVERY REAL FILE, character for character', () => {
    // THE TREE, NOT A SAMPLE, and that change is the point. This used to run on
    // six hand-written lines and it said so: both functions applied the SAME two
    // regular expressions in the SAME order, so "exactly one half holds each
    // character" was nearly true by construction on anything the author thought
    // to write down. It was FALSE on two real files in this repository, and a
    // sample could never have found them — the shape that breaks a substitution
    // is ordinary technical prose (a glob, a path) that nobody writes into a
    // fixture because nobody thinks of it as a hard case.
    //
    // It is now true by construction for a different and much stronger reason:
    // both functions read the same `commentRanges` from one scan, one keeping
    // what the other blanks. Running it over the whole tree anyway is what
    // proves the scan terminates and stays in range on every file that exists,
    // which construction does not give you.
    const files = everyTypeScriptFileUnder();
    expect(files.length, 'the walk found almost nothing').toBeGreaterThan(50);
    let charactersChecked = 0;
    const failures: string[] = [];
    for (const rel of files) {
      const source = read(rel);
      charactersChecked += source.length;
      failures.push(...partitionFailures(rel, source));
    }
    // Non-vacuity: a walk that returned empty files would report no failures.
    expect(charactersChecked, 'the files read were empty').toBeGreaterThan(1_000_000);
    expect(failures.slice(0, 20)).toEqual([]);
  });

  /**
   * THE SHAPE THAT BROKE THE OLD PAIR, kept as a fixture that cannot go stale.
   *
   * Lines 2, 4 and 5 are the two real cases, reduced: a LINE comment containing
   * `` `**\/*` `` and one containing `` `src/shell/**` ``. Both contain a `/*`,
   * both are prose about a path, and neither opens anything. A substitution
   * cannot know that — its block pass runs first, opens a comment inside the
   * line comment, and the line pass afterwards has no `//` left to work from.
   *
   * THE BACKSLASH IN THAT FIRST GLOB IS NOT DECORATION. Written plainly it
   * contains a `*` followed by a `/`, which really does end this block comment —
   * that one is the language, not a scanner defect, and it is why the fixture
   * itself is a STRING and not prose.
   *
   * The rest is the other half of the same question: a `//` inside a string, a
   * regex made of slashes, a `//` inside a template's text, and a real block
   * comment whose `*` + `/` is what the fake block above latches onto.
   */
  const THE_SHAPE_THAT_BROKE_IT: string = [
    'const before = 1;',
    '// A glob in prose: `**/*` — a path pattern, not a comment opener.',
    'const between = 2;',
    '// And `**/*.ts` again, where the tail of this line used to go missing.',
    '// A second one: `src/shell/**` belonged to another builder in the wave.',
    '/* A real block comment. */',
    "const url = 'https://example.invalid/x'; // a real trailing note",
    "const slashy = 'a // b'; // and a slash pair inside a string is not one",
    'const rx = /[/]+/; // a regex made of slashes',
    'const t = `a ${before} // not a comment`; // but this one is',
    'const after = 3;',
  ].join('\n');

  it('A LINE COMMENT CONTAINING `/*` KEEPS ALL ITS PROSE — the bug this pair was rewritten for', () => {
    expect(partitionFailures('the shape', THE_SHAPE_THAT_BROKE_IT)).toEqual([]);

    // Not just partitioned — the prose is really in the prose half, all of it.
    const comments = onlyComments(THE_SHAPE_THAT_BROKE_IT);
    for (const phrase of [
      'A glob in prose: `**/*` — a path pattern, not a comment opener.',
      'And `**/*.ts` again, where the tail of this line used to go missing.',
      'A second one: `src/shell/**` belonged to another builder in the wave.',
      'A real block comment.',
      'a real trailing note',
      'and a slash pair inside a string is not one',
      'a regex made of slashes',
      'but this one is',
    ]) {
      expect(comments, `the prose half lost: ${phrase}`).toContain(phrase);
    }

    // ...and the code is really in the code half, none of it in the prose half.
    const code = withoutComments(THE_SHAPE_THAT_BROKE_IT);
    for (const fragment of [
      'const before = 1;',
      'const between = 2;',
      "const url = 'https://example.invalid/x';",
      "const slashy = 'a // b';",
      'const rx = /[/]+/;',
      'const t = `a ${before} // not a comment`;',
      'const after = 3;',
    ]) {
      expect(code, `the code half lost: ${fragment}`).toContain(fragment);
      expect(comments, `the prose half claimed code: ${fragment}`).not.toContain(fragment);
    }
  });

  /**
   * THE CORRECTNESS HALF: A REAL PARSER SAYS WHERE THE COMMENTS ARE.
   *
   * The partition check above compares the pair against itself, and after the
   * rewrite it can only ever pass — both halves read one scan. This one compares
   * the scan against `typescript`'s own parser: a different implementation, by
   * different people, that has to be right for the compiler to work. It is the
   * only check in this file that can tell the pair being WRONG from the pair
   * being CONSISTENT, and it found the bug the pair was rewritten for.
   *
   * WHY `audit.ts` MUST NOT USE THE PARSER ITSELF. It would be less code, and it
   * would make this check worthless: the oracle would be comparing the parser to
   * the parser, and the strongest assertion in this file would quietly become
   * `expect(x).toEqual(x)`. The implementation is deliberately a hand-written
   * scan so that this stays a comparison of two independent answers.
   *
   * WHY THE PARSER AND NOT THE SCANNER, on this side. `ts.createScanner` is
   * context-free and desynchronises on `${}` inside a template literal, after
   * which it reports six kilobytes of one file as a single template token and
   * every comment inside that range disappears. Measured, not assumed: 92 of 169
   * files "diverged" against the scanner and every one of those divergences was
   * the oracle's fault. The parser handles JSX text and template substitution
   * because it must.
   *
   * EVERY COMMENT IS IN THE LEADING TRIVIA OF EXACTLY ONE TOKEN — or, for one
   * sitting at the end of a line, the TRAILING trivia of the token before it.
   * Walking every token and asking for both is how the whole set is collected;
   * `forEachLeadingCommentRange` alone silently drops end-of-line comments,
   * which is worth 44 false divergences.
   */
  interface Divergence {
    readonly filesRead: number;
    /** Characters the parser calls comment and the stream does not, per file. */
    readonly missedPerFile: ReadonlyMap<string, number>;
    /** Characters the stream calls comment and the parser does not, per file. */
    readonly overClaimedPerFile: ReadonlyMap<string, number>;
    /** Characters both call comment. The number that makes the rest mean something. */
    readonly agreed: number;
    /** One readable line per over-claimed RUN, for the failure message. */
    readonly overClaims: readonly string[];
  }

  /**
   * Compare a comment stream against the parser, over a list of real files.
   *
   * LIFTED OUT OF THE TEST ON PURPOSE. The list of known divergences below is
   * now EMPTY, and a check that iterates a list of problems passes trivially
   * when the list is empty — this run has been bitten by exactly that three
   * times. Making the comparison a function means it can be pointed at a stream
   * that is KNOWN to be wrong, and the test can assert that it says so. That is
   * the only way an empty list is evidence rather than silence.
   *
   * COUNTED IN CHARACTERS AS WELL AS RUNS, which the version this replaces did
   * not do, and the difference was hiding most of the defect. Runs merge: a run
   * whose first character follows a newline that was itself over-claimed never
   * gets counted at all, because the newline is skipped as whitespace before the
   * run test runs. The old pair scored 54 RUNS in this tree and 26,734
   * CHARACTERS, 20,612 of them in one file — real code, handed to the cut-in
   * prose ban as prose, by a counter that reported everything was accounted for.
   */
  function compareToParser(
    commentStream: (source: string) => string,
    files: readonly string[],
  ): Divergence {
    const missedPerFile = new Map<string, number>();
    const overClaimedPerFile = new Map<string, number>();
    const overClaims: string[] = [];
    let agreed = 0;

    for (const rel of files) {
      const source = read(rel);
      const sourceFile = ts.createSourceFile(
        rel.endsWith('.tsx') ? 'probe.tsx' : 'probe.ts',
        source,
        ts.ScriptTarget.Latest,
        true,
      );
      const isComment = parserCommentMask(sourceFile, source);
      const comments = commentStream(source);
      for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === undefined || ch === '\n' || ch === ' ') continue;
        const mineSaysComment = comments[i] === ch;
        if (isComment[i] === true && mineSaysComment) agreed += 1;
        if (isComment[i] === true && !mineSaysComment) {
          missedPerFile.set(rel, (missedPerFile.get(rel) ?? 0) + 1);
        }
        if (isComment[i] !== true && mineSaysComment) {
          overClaimedPerFile.set(rel, (overClaimedPerFile.get(rel) ?? 0) + 1);
          const previous = source[i - 1];
          const continues =
            previous !== undefined && comments[i - 1] === previous && isComment[i - 1] !== true;
          if (continues) continue;
          const kind = ts.SyntaxKind[tokenKindAt(sourceFile, i)];
          overClaims.push(
            `${rel}@${i}: code read as prose, starting in a ${kind}: ` +
              JSON.stringify(source.slice(Math.max(0, i - 60), i + 30)),
          );
        }
      }
    }
    return { filesRead: files.length, missedPerFile, overClaimedPerFile, agreed, overClaims };
  }

  /**
   * THE SUBSTITUTION THIS PAIR REPLACED, kept as a KNOWN-WRONG STREAM.
   *
   * Verbatim off the commit that carried it — the block-comment pass, then the
   * line-comment pass over its output. It is here for one job: to be fed to
   * `compareToParser` so that the empty divergence list below is a measurement
   * and not an empty loop. Deleting it silently makes two assertions vacuous,
   * which is why they name it.
   */
  const OLD_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
  const OLD_LINE_COMMENT = /(^|[^:])\/\/[^\n]*/g;
  const OLD_NON_NEWLINE = /[^\n]/g;

  function theSubstitutionThisReplaced(source: string): string {
    const out = [...source.replace(OLD_NON_NEWLINE, ' ')];
    const paste = (text: string, at: number): void => {
      for (let i = 0; i < text.length; i += 1) out[at + i] = text[i] ?? ' ';
    };
    for (const match of source.matchAll(OLD_BLOCK_COMMENT)) paste(match[0], match.index);
    const blocksGone = source.replace(OLD_BLOCK_COMMENT, (m) => m.replace(OLD_NON_NEWLINE, ' '));
    for (const match of blocksGone.matchAll(OLD_LINE_COMMENT)) {
      const skip = (match[1] ?? '').length;
      paste(match[0].slice(skip), match.index + skip);
    }
    return out.join('');
  }

  /**
   * FILES WHERE THE PARSER AND THIS SCAN DISAGREE. EMPTY, AND IT HAS TO STAY SO.
   *
   * It held two rows, both the same defect found twice by two authors who were
   * not looking for it: `src/game/progression.test.ts` lost 58 characters of
   * real prose out of BOTH halves to a line comment containing `` `**\/*` ``,
   * and `src/shell/shellWiring.test.ts` lost 37 to one containing
   * `` `src/shell/**` ``. They were rows in a debt list rather than a fix, and
   * the debt list said so: "the substitution approach cannot be made right by
   * adding rows here".
   *
   * It was not made right by adding rows. `audit.ts` scans now, and a `/*`
   * inside a line comment is prose, because the scan knows it is already inside
   * a comment when it gets there.
   *
   * AN EMPTY LIST MUST NOT MAKE THE CHECK VACUOUS. The test below reads it in
   * both directions AND re-runs the same comparison against
   * `theSubstitutionThisReplaced`, which must still be caught. If the oracle
   * ever stops working, that second run is what goes red.
   */
  const THE_PARSER_DISAGREES_HERE: readonly (readonly [string, number, string])[] = [];

  it('AND A REAL PARSER AGREES ABOUT WHERE THE COMMENTS ARE — everywhere in the tree', () => {
    const files = everyTypeScriptFileUnder();
    const found = compareToParser(onlyComments, files);

    // Non-vacuity: the walk found files, and the oracle found a great deal of
    // comment to agree about. Without this, a walk that returned nothing — or a
    // parser mask that came back all-false — would report a spotless tree.
    expect(found.filesRead, 'the walk found almost nothing').toBeGreaterThan(50);
    expect(found.agreed, 'the parser found no comments at all — the oracle is broken').toBeGreaterThan(
      100_000,
    );

    // OVER-CLAIMING IS GONE, and this is the assertion that says so. It used to
    // read `toBeGreaterThan(0)` with a note pinning 54 runs, "every one starting
    // inside a string, a regular expression or a template head" — the price of
    // doing this with regular expressions. A scan pays no such price: it knows
    // it is inside a string, so it does not look for a comment there.
    expect(found.overClaims.slice(0, 10)).toEqual([]);
    expect([...found.overClaimedPerFile]).toEqual([]);

    // MISSED COMMENTS, PINNED BOTH WAYS. An unlisted file that loses prose is
    // red; a listed file that stops losing it is also red, so a row goes when
    // its defect does rather than outliving it.
    const pinned = new Map(THE_PARSER_DISAGREES_HERE.map(([file, count]) => [file, count]));
    for (const [file, count] of found.missedPerFile) {
      expect(
        pinned.get(file),
        `${file} drops ${count} characters of real comment out of BOTH halves, and is not in ` +
          'THE_PARSER_DISAGREES_HERE. A prose scan built on this cannot see what it has lost.',
      ).toBe(count);
    }
    for (const [file, count] of pinned) {
      expect(found.missedPerFile.get(file) ?? 0, `${file} no longer diverges — delete its row`).toBe(
        count,
      );
    }
  });

  it('...AND THE EMPTY LIST IS A MEASUREMENT: the same check still catches the old substitution', () => {
    // THE NON-VACUITY GUARD FOR AN EMPTY LIST. Everything above passes if the
    // comparison has stopped comparing. So the comparison is pointed at the
    // implementation that was really here until this commit, and must convict
    // it — in both directions, on real files, with the same oracle.
    const files = everyTypeScriptFileUnder();
    const broken = compareToParser(theSubstitutionThisReplaced, files);

    expect(
      [...broken.missedPerFile.keys()].length,
      'the old substitution lost no prose — the detector has stopped detecting',
    ).toBeGreaterThan(0);
    expect(
      [...broken.overClaimedPerFile.values()].reduce((a, b) => a + b, 0),
      'the old substitution over-claimed nothing — the detector has stopped detecting',
    ).toBeGreaterThan(1000);

    // And on the fixture, where the numbers cannot go stale because the input is
    // right here: the old pair loses 122 characters of prose and hands back 35
    // characters of code as prose. The new one does neither.
    const oldStream = theSubstitutionThisReplaced(THE_SHAPE_THAT_BROKE_IT);
    const newStream = onlyComments(THE_SHAPE_THAT_BROKE_IT);
    const sourceFile = ts.createSourceFile(
      'probe.ts',
      THE_SHAPE_THAT_BROKE_IT,
      ts.ScriptTarget.Latest,
      true,
    );
    const isComment = parserCommentMask(sourceFile, THE_SHAPE_THAT_BROKE_IT);
    const score = (stream: string): { missed: number; over: number } => {
      let missed = 0;
      let over = 0;
      for (let i = 0; i < THE_SHAPE_THAT_BROKE_IT.length; i += 1) {
        const ch = THE_SHAPE_THAT_BROKE_IT[i];
        if (ch === undefined || ch === '\n' || ch === ' ') continue;
        const mine = stream[i] === ch;
        if (isComment[i] === true && !mine) missed += 1;
        if (isComment[i] !== true && mine) over += 1;
      }
      return { missed, over };
    };
    expect(score(oldStream)).toEqual({ missed: 122, over: 35 });
    expect(score(newStream)).toEqual({ missed: 0, over: 0 });
  });

  it('`onlyComments` keeps prose and drops code, both ways round', () => {
    expect(onlyComments('// a trailing note\n')).toContain('a trailing note');
    expect(onlyComments('const a = 1; // note')).not.toContain('const');
    expect(onlyComments('/* a block note */ const a = 1;')).toContain('a block note');
    expect(onlyComments('/* a block note */ const a = 1;')).not.toContain('const');
    // A URL inside code is not a comment, and the REASON has changed. The
    // substitution this replaced got here by refusing a `//` with a colon in
    // front of it — a rule that works on `https://` and on nothing else. The
    // scan is already inside a string when it reaches the slashes, so it does
    // not look for a comment there, and the same holds for a URL with no scheme,
    // a path, or any other pair of slashes a string might contain.
    expect(onlyComments("const u = 'https://example.invalid/x';")).not.toContain('example');
    expect(onlyComments("const p = 'a // b';")).not.toContain('b');
    expect(withoutComments("const p = 'a // b';")).toContain("'a // b'");
    // Line numbers survive, so a match index in the output is a real one.
    expect(onlyComments('const a = 1;\n// second line\n').split('\n')[1]).toContain('second line');
    expect(onlyComments('const a = 1;\n// second line\n').split('\n')[0]?.trim()).toBe('');
  });
});

// ---------------------------------------------------------------------------
// The allowlist itself
// ---------------------------------------------------------------------------

describe('the registered allowlist', () => {
  const REGISTERED = Object.keys(SOURCE_RULES).sort();

  it('is exactly this list — widening it is an edit to this test', () => {
    // Pinned, not counted. A new entry has to be argued for in review rather
    // than arriving as a quiet default, which is the only thing that stops an
    // allowlist becoming a way to make the audit pass.
    expect(REGISTERED).toEqual(
      [
        // The environment layer (GDD §12.2 "Gym / environment art"): a feel
        // home, a colour home and an authored-drawing home, split on exactly
        // the line spriteTuning / palette / rig already draw.
        'src/art/gymPalette.ts',
        'src/art/gymProps.ts',
        'src/art/gymTuning.ts',
        // GDD §5's idle layer, arriving from the parallel session. A `feel`
        // home: an idle economy is nothing but rates, and §5.1's "rewards
        // check-ins without punishing a 10-hour gap" is a balance point
        // somebody settles by playing.
        'src/empire/empireTuning.ts',
        'src/art/lifterSprite.ts',
        'src/art/palette.ts',
        'src/art/plates.ts',
        'src/art/raster.ts',
        'src/art/rig.ts',
        'src/art/benchPress.ts',
        'src/art/deadliftPull.ts',
        'src/art/spriteMarks.ts',
        'src/art/spriteTuning.ts',
        'src/art/squatAnimation.ts',
        'src/art/craftMetrics.ts',
        // The dev-only Rive runtime spike's own numbers — `local`, registered
        // so its consumers are audited like any other, never a knob.
        'src/dev/riveRuntimeSpike/spikeTuning.ts',
        // The synthesised meet-day audio (GDD §12.2 judges the walkout on
        // "pacing AND sound"). Both are `local`: the FORMAT and the arithmetic
        // live with the encoder — nobody playtests a RIFF byte offset — and
        // what the cues actually sound like is `MEET_SOUND` in meetTuning.ts,
        // which is already registered as `feel` and reachable from the index.
        'src/audio/wav.ts',
        'src/audio/synth.ts',
        'src/card/cardTuning.ts',
        'src/card/pixelFont.ts',
        // GDD §2.1's Career spine and §6.1's meet calendar. A `feel` home: the
        // qualifying totals are the least evidenced numbers in the game — the
        // document says meets are gated by them and names no figure — so where
        // the four tiers sit is settled by playing a career.
        'src/career/careerTuning.ts',
        // ...and the parameters of the measurement that keeps that tuning
        // honest. `data`, like streakSweep.ts and for the same reason: a seed
        // is not a knob, so it is registered here and absent from the index.
        'src/career/careerSweep.ts',
        // The cut-in gate (GDD §7.2). A `feel` home: §7.2 says scarcity "is
        // the entire mechanic" and then says only "ideally not every session",
        // which is a rate somebody has to settle by playing. The one-per-
        // session CAP lives in the same block and is flagged there as a §12.3
        // refusal condition rather than a knob.
        'src/cutin/cutInTuning.ts',
        'src/card/sampleCards.ts',
        'src/card/sheetPalette.ts',
        'src/game/dots.ts',
        'src/game/e1rm.ts',
        'src/game/fatigue.ts',
        'src/game/liftTuning.ts',
        'src/game/meet.ts',
        'src/game/meetTuning.ts',
        'src/game/prng.ts',
        'src/game/resultCard.ts',
        'src/game/rpe.ts',
        'src/game/sessionTuning.ts',
        'src/game/streak.ts',
        // The streak monotonicity fixture: seeds, calendar lengths and the
        // attendance distribution GDD §4.4's counts were measured on. `data`,
        // not `feel` — nobody playtests a seed — so it is registered here and
        // deliberately absent from the tuning index.
        // The rolling entitlement that funds a streak save (GDD §4.2 Option
        // 1). `feel` — how forgiving a streak is needs playing to settle — so
        // it is re-exported from the tuning index like every other feel home.
        'src/game/streakEntitlement.ts',
        'src/game/streakSweep.ts',
        'src/licensing/licensingTuning.ts',
        'src/licensing/realIp.ts',
        'src/lift/liftPalette.ts',
        'src/meet/meetPalette.ts',
        'src/session/sessionPalette.ts',
        // The app shell (GDD §3.2 -> §6 navigation). A `feel` home: which beats
        // a navigation control may be drawn over is a judgement about when a
        // control is in the way, and it needs a thumb on a phone to settle.
        'src/shell/shellTuning.ts',
        // Build config, classified `local`. Registered rather than exempted:
        // the walk starting at the repository root is what makes this audit
        // hard to escape, and a carve-out for "config" invites the next one.
        'vitest.config.ts',
      ].sort(),
    );
  });

  it('names only files that exist and are audited', () => {
    for (const relPath of REGISTERED) {
      expect(FILES, `${relPath} is registered but not in the tree`).toContain(relPath);
    }
  });

  it('never registers a component', () => {
    // A `.tsx` file is a renderer by definition. If one ever needs a constant,
    // the constant belongs in a tuning module, not in the component.
    for (const relPath of REGISTERED) {
      expect(relPath.endsWith('.tsx'), `${relPath} is a component`).toBe(false);
    }
  });

  it('gives every entry a reason', () => {
    for (const [relPath, rule] of Object.entries(SOURCE_RULES)) {
      expect(rule.why.length, `${relPath} has no reason`).toBeGreaterThan(0);
      expect(rule.kind, `${relPath} has no kind`).toBeDefined();
    }
  });

  it('keeps the function-body escape hatch to exactly one file', () => {
    const hatches = Object.entries(SOURCE_RULES)
      .filter(([, rule]) => rule.allowLiteralsIn !== undefined)
      .map(([relPath, rule]) => [relPath, [...(rule.allowLiteralsIn ?? [])]]);
    expect(hatches).toEqual([['src/game/streak.ts', ['daysFromCivil', 'civilFromDays']]]);
    // ...and the functions it names really are in that file, so the hatch
    // cannot outlive the code it was opened for.
    const streak = codeOnly(read('src/game/streak.ts'));
    expect(streak).toContain('function daysFromCivil');
    expect(streak).toContain('function civilFromDays');
  });

  it('separates the knobs from the published data', () => {
    const feel = Object.entries(SOURCE_RULES).filter(([, r]) => r.kind === 'feel');
    const data = Object.entries(SOURCE_RULES).filter(([, r]) => r.kind === 'data');
    expect(feel.length).toBeGreaterThan(0);
    expect(data.length).toBeGreaterThan(0);
    // GDD §12.3 refuses homebrewed RPE, e1RM and DOTS values. They are
    // registered as `data` precisely so nothing invites a playtester to turn
    // them, and the tuning index below does not re-export them.
    for (const relPath of ['src/game/rpe.ts', 'src/game/dots.ts', 'src/game/e1rm.ts']) {
      expect(SOURCE_RULES[relPath]?.kind, relPath).toBe('data');
    }
  });
});

// ---------------------------------------------------------------------------
// The index and the allowlist cannot drift apart
// ---------------------------------------------------------------------------

describe('src/tuning/index.ts is the one place', () => {
  it('re-exports a non-empty block for every group', () => {
    for (const [group, blocks] of Object.entries(TUNING)) {
      expect(Object.keys(blocks).length, `TUNING.${group} is empty`).toBeGreaterThan(0);
    }
    for (const [group, blocks] of Object.entries(PALETTES)) {
      expect(Object.keys(blocks).length, `PALETTES.${group} is empty`).toBeGreaterThan(0);
    }
  });

  it('lists a module path for every group, and no others', () => {
    expect(Object.keys(TUNING_MODULES).sort()).toEqual(Object.keys(TUNING).sort());
    expect(Object.keys(PALETTE_MODULES).sort()).toEqual(Object.keys(PALETTES).sort());
  });

  it('points at files the allowlist registers, and at real files', () => {
    for (const relPath of Object.values(TUNING_MODULES)) {
      expect(FILES, `${relPath} does not exist`).toContain(relPath);
      expect(SOURCE_RULES[relPath]?.kind, `${relPath} is not a registered feel home`).toBe('feel');
    }
    for (const relPath of Object.values(PALETTE_MODULES)) {
      expect(FILES, `${relPath} does not exist`).toContain(relPath);
      expect(SOURCE_RULES[relPath]?.role, `${relPath} is not a registered palette`).toBe('palette');
    }
  });

  it('reaches every feel home and every palette — nothing tuned is unreachable', () => {
    // The other direction. A tuning module registered in `audit.ts` but not
    // re-exported here would be a knob a playtester cannot find from the one
    // place, which is the failure this whole file exists to prevent.
    const feelHomes = Object.entries(SOURCE_RULES)
      .filter(([, rule]) => rule.kind === 'feel')
      .map(([relPath]) => relPath)
      .sort();
    expect(Object.values(TUNING_MODULES).sort()).toEqual(feelHomes);

    const palettes = Object.entries(SOURCE_RULES)
      .filter(([, rule]) => rule.role === 'palette')
      .map(([relPath]) => relPath)
      .sort();
    expect(Object.values(PALETTE_MODULES).sort()).toEqual(palettes);
  });

  it('re-exports the live blocks rather than copies of them', () => {
    // IDENTITY against the module's own export, not deep equality. A
    // hand-copied snapshot in the index would satisfy a value check and then
    // drift silently the first time either side was tuned — which is exactly
    // the failure a central index is supposed to remove, not introduce.
    expect(TUNING.rep.LIFT_TUNING).toBe(LIFT_TUNING);
    expect(TUNING.session.SESSION_TUNING).toBe(SESSION_TUNING);
    expect(TUNING.fatigue.FATIGUE_TUNING).toBe(FATIGUE_TUNING);
    expect(TUNING.streak.RECOVERY_DAY_GUARDRAILS).toBe(RECOVERY_DAY_GUARDRAILS);
    expect(TUNING.card.CARD_SCREEN).toBe(CARD_SCREEN);
    expect(TUNING.sprite.STRAIN).toBe(STRAIN);
    expect(PALETTES.liftScreen).toBe(LIFT_PALETTE);
    expect(Object.isFrozen(TUNING)).toBe(true);
    expect(Object.isFrozen(TUNING.rep)).toBe(true);
    expect(Object.isFrozen(PALETTES)).toBe(true);
  });

  it('reaches the block the audit just made a home for', () => {
    // CARD_SCREEN did not exist before this piece: `ResultCardScreen.tsx`
    // carried its StyleSheet as bare numbers. It is here because the audit
    // found them, which is the loop this file is meant to close.
    expect(Object.keys(TUNING.card.CARD_SCREEN).length).toBeGreaterThan(0);
    expect(codeOnly(read('src/card/ResultCardScreen.tsx'))).toContain('CARD_SCREEN.PAD_Y');
  });
});

// ---------------------------------------------------------------------------
// ...and only now, the tree itself
// ---------------------------------------------------------------------------

describe('no game-feel value lives outside a tuning module', () => {
  it('finds nothing anywhere in the repository', () => {
    const findings = auditTree(FILES.map((relPath) => [relPath, read(relPath)] as const));
    expect(findings.length, `\n${formatFindings(findings)}\n`).toBe(0);
  });
});
