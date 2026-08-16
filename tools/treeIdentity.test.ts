/**
 * treeIdentity.test.ts — the mid-run tree-movement guard, driven both ways.
 *
 * ===========================================================================
 * WHAT THIS FILE IS FOR, AND WHAT IT DELIBERATELY IS NOT
 * ===========================================================================
 * `tools/evidence.mjs` refuses to write a bundle if the tree moved while its
 * ~710 s run was in flight. That guard has two halves, and only one of them can
 * be driven from a suite:
 *
 *   - The MEASUREMENT — `treeIdentity` / `identityDelta` — is driven here, over
 *     real throwaway git repositories and over synthetic identities. Every case
 *     below is a mutation of the subject that a green run would have to catch.
 *   - The CONSEQUENCE — that a non-empty delta reaches `process.exit` and never
 *     reaches `writeFileSync` — cannot be driven here, because `evidence.mjs`
 *     hardcodes a twelve-minute vitest-and-tsc run and there is no seam to feed
 *     it a cheap one. It was driven by hand instead, once, by editing a tracked
 *     file during a real run; the verbatim output is in the commit that
 *     introduced this file, which is where CLAUDE.md says a witness goes when
 *     `MUTATION_WITNESSES` has no `it(` to bind it to.
 *     What stands here in its place is a STRUCTURAL pin on that control flow —
 *     weaker than executing it, stated as weaker, and still enough to redden if
 *     someone routes a captured command around the checkpoint or adds a second
 *     write path.
 *
 * THIS FILE MUST NEVER GO RED BECAUSE EVIDENCE IS STALE. Staleness is normal
 * after every ordinary commit; a check that fires on it would be red almost
 * always and would be suppressed within a wave, which is the crying-wolf
 * failure CLAUDE.md records for three separate instruments here. Nothing below
 * reads `.gauntlet/`, and nothing below compares a bundle to a tree.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { TREE_IDENTITY, describeDelta, identityDelta, relevantPaths, treeIdentity } from './treeIdentity.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

/** Every sandbox this file makes, removed together at the end of the run. */
const sandboxes: string[] = [];

function gitIn(repo: string, args: readonly string[]): string {
  return execFileSync('git', [...args], {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  });
}

/**
 * A repository shaped like the one the guard runs in: a tracked source file, a
 * tracked file under a directory the caller excludes, and a gitignored file.
 */
function sandbox(prefix: string): string {
  const repo = mkdtempSync(path.join(os.tmpdir(), prefix));
  sandboxes.push(repo);
  gitIn(repo, ['init', '--quiet']);
  mkdirSync(path.join(repo, 'src'), { recursive: true });
  mkdirSync(path.join(repo, 'out'), { recursive: true });
  writeFileSync(path.join(repo, '.gitignore'), 'ignored/\n');
  writeFileSync(path.join(repo, 'src', 'a.ts'), 'export const a = 1;\n');
  writeFileSync(path.join(repo, 'out', 'bundle.txt'), 'first\n');
  mkdirSync(path.join(repo, 'ignored'), { recursive: true });
  writeFileSync(path.join(repo, 'ignored', 'noise.log'), 'noise\n');
  gitIn(repo, ['add', '-A']);
  gitIn(repo, ['commit', '--quiet', '-m', 'base']);
  return repo;
}

/** Synthetic identities, for the cases a real repository makes fiddly to stage. */
const idOf = (head: string, files: Record<string, string>) => ({ head, files });

describe('what an identity covers', () => {
  it('sees tracked and untracked-but-not-ignored files, and not ignored ones', () => {
    const repo = sandbox('tree-identity-scope-');
    writeFileSync(path.join(repo, 'src', 'brand-new.ts'), 'export const b = 2;\n');

    const paths = relevantPaths(repo);

    // Non-vacuity: pinned as a set, not a bound. An empty domain here would
    // pass every "does not contain" below without anything being true.
    expect(paths).toEqual(['.gitignore', 'out/bundle.txt', 'src/a.ts', 'src/brand-new.ts']);
    // The untracked one is in, because vitest would collect it. The ignored one
    // is out, because `.gauntlet/verify/*` and `*.verify.log` are written by a
    // wrapped run and would make every run report itself moved.
    expect(paths).toContain('src/brand-new.ts');
    expect(paths).not.toContain('ignored/noise.log');
  });

  it('drops exactly the prefixes the caller excludes', () => {
    const repo = sandbox('tree-identity-exclude-');
    const all = relevantPaths(repo);
    const kept = relevantPaths(repo, ['out/']);

    expect(all).toContain('out/bundle.txt');
    expect(kept).not.toContain('out/bundle.txt');
    // And nothing else went with it — an over-broad exclusion is the failure
    // that would make the guard silent about the files it exists to watch.
    expect(kept).toEqual(all.filter((p) => p !== 'out/bundle.txt'));
  });

  it('reports a file it cannot read as gone rather than as an error value', () => {
    const repo = sandbox('tree-identity-unreadable-');
    const before = treeIdentity(repo);
    rmSync(path.join(repo, 'src', 'a.ts'));
    const after = treeIdentity(repo);

    expect(identityDelta(before, after)).toEqual([
      { path: 'src/a.ts', kind: 'vanished', before: before.files['src/a.ts'], after: null },
    ]);
  });
});

describe('the two halves of an identity, neither of which subsumes the other', () => {
  /**
   * CLAUDE.md's standing check: a new rule that dominates an old one leaves a
   * check that can never speak. These two tests are that comparison made
   * executable rather than reasoned — each half is the ONLY thing that reddens
   * for its case, so deleting either from `identityDelta` loses a real case.
   */
  it('catches a commit that lands mid-run and changes no file on disk', () => {
    const repo = sandbox('tree-identity-commit-');
    writeFileSync(path.join(repo, 'src', 'a.ts'), 'export const a = 2;\n');
    gitIn(repo, ['add', '-A']);
    const before = treeIdentity(repo);
    // Committing already-present content: HEAD moves, every byte on disk stays.
    gitIn(repo, ['commit', '--quiet', '-m', 'landed mid-run']);
    const after = treeIdentity(repo);

    expect(before.files).toEqual(after.files);
    expect(identityDelta(before, after)).toEqual([
      { path: 'HEAD', kind: 'head', before: before.head, after: after.head },
    ]);
  });

  it('catches an uncommitted edit that moves no ref', () => {
    const repo = sandbox('tree-identity-edit-');
    const before = treeIdentity(repo);
    writeFileSync(path.join(repo, 'src', 'a.ts'), 'export const a = 99;\n');
    const after = treeIdentity(repo);

    expect(before.head).toBe(after.head);
    expect(identityDelta(before, after)).toEqual([
      {
        path: 'src/a.ts',
        kind: 'changed',
        before: before.files['src/a.ts'],
        after: after.files['src/a.ts'],
      },
    ]);
  });

  it('is silent when nothing moved, including a rewrite with identical bytes', () => {
    const repo = sandbox('tree-identity-quiet-');
    const before = treeIdentity(repo);
    // The reason this reads CONTENT rather than mtime: a tool that regenerates
    // its own output byte-for-byte has not moved the tree, and a check that
    // fired here would fire on every run that touches a file.
    writeFileSync(path.join(repo, 'src', 'a.ts'), readFileSync(path.join(repo, 'src', 'a.ts')));
    const after = treeIdentity(repo);

    expect(identityDelta(before, after)).toEqual([]);
  });
});

describe('identityDelta, over identities nobody had to stage', () => {
  it('reports an appearance, a disappearance and a change together, sorted', () => {
    const before = idOf('aaaa', { 'src/gone.ts': '1111', 'src/same.ts': '2222', 'src/moved.ts': '3333' });
    const after = idOf('aaaa', { 'src/new.ts': '4444', 'src/same.ts': '2222', 'src/moved.ts': '5555' });

    expect(identityDelta(before, after)).toEqual([
      { path: 'src/gone.ts', kind: 'vanished', before: '1111', after: null },
      { path: 'src/moved.ts', kind: 'changed', before: '3333', after: '5555' },
      { path: 'src/new.ts', kind: 'appeared', before: null, after: '4444' },
    ]);
  });

  it('puts the HEAD movement first, so two reports of one movement read alike', () => {
    const before = idOf('aaaaaaaaaaaa', { 'src/a.ts': '1111' });
    const after = idOf('bbbbbbbbbbbb', { 'src/a.ts': '2222' });

    expect(identityDelta(before, after).map((m) => m.path)).toEqual(['HEAD', 'src/a.ts']);
  });

  it('is empty for identical identities', () => {
    const one = idOf('aaaa', { 'src/a.ts': '1111' });
    expect(identityDelta(one, { head: 'aaaa', files: { 'src/a.ts': '1111' } })).toEqual([]);
    expect(identityDelta(one, one)).toEqual([]);
  });
});

describe('describeDelta', () => {
  it('names every movement up to the cap and then counts the rest', () => {
    const many = Array.from({ length: TREE_IDENTITY.MAX_PATHS_REPORTED + 3 }, (_, i) => ({
      path: `src/f${String(i).padStart(2, '0')}.ts`,
      kind: 'changed' as const,
      before: '1111',
      after: '2222',
    }));

    const lines = describeDelta(many);

    expect(lines).toHaveLength(TREE_IDENTITY.MAX_PATHS_REPORTED + 1);
    expect(lines[0]).toBe('  changed   src/f00.ts (1111 -> 2222)');
    expect(lines[lines.length - 1]).toBe('  ...and 3 more');
  });

  it('spells each kind differently, so the reader knows which happened', () => {
    const lines = describeDelta([
      { path: 'HEAD', kind: 'head', before: 'abcdef1234', after: '9876543210' },
      { path: 'src/a.ts', kind: 'appeared', before: null, after: '2222' },
      { path: 'src/b.ts', kind: 'vanished', before: '3333', after: null },
    ]);

    expect(lines).toEqual([
      '  HEAD moved abcdef12 -> 98765432',
      '  appeared  src/a.ts',
      '  vanished  src/b.ts',
    ]);
  });
});

/**
 * ===========================================================================
 * THE CONSEQUENCE, PINNED STRUCTURALLY BECAUSE IT CANNOT BE EXECUTED HERE
 * ===========================================================================
 * Stated as the weaker thing it is. These read `evidence.mjs`'s source, which
 * CLAUDE.md is right to distrust: a textual pin whose pattern has more than one
 * witness in the file is vacuous, and the fix it demands is to pin the MATCH
 * COUNT rather than presence. That is what these do — every one of them is a
 * count or an ordering between counted sites, and none is an `includes`.
 *
 * What they cannot say: that the exit is REACHED. `evidence.mjs` could compute
 * an empty delta for the wrong reason and these would stay green. That half is
 * what the sandbox tests above are for, and between them the two halves cover
 * the guard — separately, and neither alone.
 */
describe('evidence.mjs cannot write a bundle that straddles an edit', () => {
  const source = readFileSync(path.join(REPO_ROOT, 'tools', 'evidence.mjs'), 'utf8');
  const sitesOf = (needle: string): readonly number[] => {
    const found: number[] = [];
    for (let at = source.indexOf(needle); at !== -1; at = source.indexOf(needle, at + 1)) found.push(at);
    return found;
  };
  const onlySiteOf = (needle: string): number => {
    const found = sitesOf(needle);
    expect(found, `sites of ${needle} in tools/evidence.mjs`).toHaveLength(1);
    return found[0] as number;
  };

  it('writes the bundle at exactly one site', () => {
    // Presence would be satisfied by a second write path added beside the first,
    // which is precisely how this guard would be routed around.
    expect(sitesOf('writeFileSync(')).toHaveLength(1);
  });

  it('appends captured output at exactly one site, inside the checkpoint helper', () => {
    // TWO NEEDLES SINCE `run` STARTED RETURNING ITS RESULT RATHER THAN ITS
    // TEXT. It used to be one — `parts.push(run(` — which said in a single
    // string both "the runner is called here" and "its output is appended
    // here". The filter check needs the run's BODY as well as its transcript,
    // so the call and the append are two statements now and the guard reads
    // both. That is a strengthening rather than a translation: a bare
    // `run(...)` whose output was never appended used to be invisible here and
    // is a second site now.
    const call = onlySiteOf('run(label, cmd, args)');
    const push = onlySiteOf('parts.push(');
    const helper = onlySiteOf('const capture = (');
    const exit = onlySiteOf('process.exit(TREE_MOVED_EXIT_CODE)');

    // The one place output is appended sits between the helper's declaration
    // and its refusal, so it is inside the body that re-measures afterwards. A
    // command pushed straight onto `parts` would be a second site and would
    // redden the count in `onlySiteOf` above.
    expect(call).toBeGreaterThan(helper);
    expect(push).toBeGreaterThan(call);
    expect(push).toBeLessThan(exit);
  });

  it('reaches the write only after the last checkpoint', () => {
    const calls = sitesOf('capture(');
    // THE LAST WRITE SITE, NOT "THE ONLY ONE", AND THAT IS A DOMINATION FIX.
    // Written first as `onlySiteOf`, this test re-asserted the count the test
    // above pins — so every state that reddened that one reddened this one too,
    // and the count check could never speak alone. Reading the last site
    // instead leaves the two disjoint: a second write reddens only the count
    // test, a write moved above the captures reddens only this one.
    const write = Math.max(...sitesOf('writeFileSync('));

    // Non-vacuity: the run really does capture several commands, so "after the
    // last one" is a statement about a sequence and not about a single call
    // that happens to precede the write. Three: the narrowed run, the whole
    // suite, the typecheck. The helper's own `const capture = (` does not match
    // this needle, which is why the count is three and not four.
    expect(calls).toHaveLength(3);
    expect(write).toBeGreaterThan(Math.max(...calls));
  });
});

afterAll(() => {
  for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true });
});
