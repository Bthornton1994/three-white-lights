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

import {
  RENDERER_RULE,
  SOURCE_RULES,
  STRUCTURAL_IDIOMS,
  auditSource,
  auditTree,
  blankLiteralTypeUnions,
  codeOnly,
  declarationRegions,
  formatFindings,
  isAudited,
  isStructuralIdiom,
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
 */
const NOT_WALKED: readonly string[] = ['node_modules', '.git', '.expo', 'dist', 'coverage'];

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
        'src/art/lifterSprite.ts',
        'src/art/palette.ts',
        'src/art/plates.ts',
        'src/art/raster.ts',
        'src/art/rig.ts',
        'src/art/spriteMarks.ts',
        'src/art/spriteTuning.ts',
        'src/art/squatAnimation.ts',
        'src/card/cardTuning.ts',
        'src/card/pixelFont.ts',
        'src/card/sampleCards.ts',
        'src/card/sheetPalette.ts',
        'src/game/dots.ts',
        'src/game/e1rm.ts',
        'src/game/fatigue.ts',
        'src/game/liftTuning.ts',
        'src/game/meet.ts',
        'src/game/prng.ts',
        'src/game/resultCard.ts',
        'src/game/rpe.ts',
        'src/game/sessionTuning.ts',
        'src/game/streak.ts',
        'src/lift/liftPalette.ts',
        'src/session/sessionPalette.ts',
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
