#!/usr/bin/env node
/**
 * treeIdentity.mjs — "what did this checkout contain", as one comparable value.
 *
 * ===========================================================================
 * WHY THIS EXISTS, AND WHAT IT IS NOT
 * ===========================================================================
 * `tools/evidence.mjs` takes ~710 s to produce a bundle: a narrowed vitest run,
 * the whole suite, and a typecheck, captured verbatim. Every one of those reads
 * the working tree at the moment it runs. If a tracked file moves while that is
 * in flight, the bundle it writes describes a tree that NEVER EXISTED AS A
 * WHOLE — the first command's output came off one tree and the last command's
 * off another, and nothing in the file says so.
 *
 * That is worse than an ordinary stale bundle, and the difference is the reason
 * this module exists rather than a note in a checklist. A stale bundle is
 * catchable after the fact: `evidence.mjs --verify` compares the bundle's stamp
 * against HEAD and says so. A bundle that straddles an edit is not — it stamps
 * the commit it started at, and if the edit was committed afterwards `--verify`
 * may well report it FRESH against the new HEAD, because the stamp comparison
 * cannot see that half the output predates the change.
 *
 * THIS IS NOT A STALENESS CHECK AND MUST NOT BE READ AS ONE. Staleness — the
 * tree moving AFTER a bundle is written — is normal, expected after every
 * ordinary commit, and already reported by `--verify` and by `wave-start.mjs`.
 * This module answers a strictly different question, about a window `--verify`
 * structurally cannot see into: the inside of a single run.
 *
 * ===========================================================================
 * WHAT AN IDENTITY IS MADE OF, AND WHY BOTH HALVES ARE LOAD-BEARING
 * ===========================================================================
 * An identity is `HEAD` plus a digest of every relevant file's CONTENT ON DISK.
 * Neither half subsumes the other, and that was checked symbolically rather
 * than assumed, because CLAUDE.md's standing rule is that a new check which
 * dominates an old one leaves a check that can never speak:
 *
 *   - `git commit` of already-present content moves HEAD and changes NO file's
 *     content. Content alone is blind to it — and a commit landing mid-run is
 *     the exact shape of the first recorded incident.
 *   - An uncommitted edit changes content and moves NO ref. HEAD alone is blind
 *     to it, and this is the more common case by far.
 *
 * So both are compared, and each has a case the other cannot reach.
 *
 * CONTENT, NOT MTIMES, NOT THE INDEX. `git ls-files -s` reports the blob a path
 * had when the index was last refreshed, so an unstaged edit does not move it —
 * a check built on it would have been silent for exactly the case it is for.
 * `mtime` moves when a file is rewritten with identical bytes, which is a
 * false positive on any tool that regenerates output. Reading the bytes is a
 * few hundred milliseconds over this tree and answers the question asked.
 *
 * UNTRACKED-BUT-NOT-IGNORED FILES COUNT. A new `.test.ts` nobody has committed
 * yet is collected and executed by vitest, so it is an input to the bundle
 * whatever git thinks of it. Ignored files are excluded by `--exclude-standard`
 * for the same reason in reverse: `node_modules/`, `.gauntlet/verify/` and the
 * `*.verify.log` files a wrapped run writes are not inputs and would make every
 * run report itself moved.
 *
 * ===========================================================================
 * WHAT IT CANNOT SEE — declared, because a partial mechanism that states its
 * coverage beats one that implies completeness (CLAUDE.md)
 * ===========================================================================
 *   - AN EDIT THAT IS REVERTED BEFORE THE NEXT CHECKPOINT. Identity is compared
 *     against the run's baseline, so a file changed and changed back reads as
 *     unmoved. The run really did straddle two trees; this cannot say so. Taking
 *     a checkpoint after every captured command narrows the window to one
 *     command rather than the whole run, which is why the caller does that — it
 *     does not close it.
 *   - ANYTHING OUTSIDE THE REPOSITORY. `node_modules/`, the node binary, the
 *     environment. A dependency reinstalled mid-run is invisible here.
 *   - A CHANGE THAT IS NOT IN THE BYTES. Permissions, symlink retargeting to a
 *     file with identical content.
 *   - WHETHER THE TREE WAS ALREADY DIRTY when the run started. That is
 *     `evidence.mjs`'s existing `dirty` check and the bundle header reports it.
 *     This module reports MOVEMENT, and a tree that is dirty in exactly the same
 *     way at both ends of a run has not moved.
 *
 * A FAILURE TO MEASURE IS NOT A "NOTHING MOVED". Every git call here throws on
 * a non-zero exit rather than returning an empty list, because a guard that
 * reports silence when it could not look is worse than absent: it reads as a
 * pass. The one exception is `rev-parse HEAD` in a repository with no commits,
 * which is a real state and is represented by a distinct sentinel that still
 * compares unequal to any real SHA.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The knobs, in one place, per CLAUDE.md's "named constant in one place" rule.
 * None of these is a game-feel value; they are here so that a reader who wants
 * to change one does not have to find it inside a message template.
 */
export const TREE_IDENTITY = Object.freeze({
  /**
   * Hex characters kept from each file's SHA-256.
   *
   * 16 hex chars is 64 bits. These digests are compared only against digests of
   * the same path taken minutes apart on the same machine; the adversary is a
   * text editor, not a collision search. Full digests would work identically and
   * make the failure output unreadable.
   */
  DIGEST_CHARS: 16,
  /** How many moved paths a report names before it summarises the remainder. */
  MAX_PATHS_REPORTED: 12,
  /** `HEAD` in a repository that has no commits yet. Never equal to a SHA. */
  NO_COMMIT: '(no commit)',
  /** The pseudo-path a `HEAD` movement is reported under. */
  HEAD_PATH: 'HEAD',
});

/**
 * @typedef {{ head: string, files: Record<string, string> }} TreeIdentity
 * @typedef {'head' | 'appeared' | 'vanished' | 'changed'} MovementKind
 * @typedef {{ path: string, kind: MovementKind, before: string | null, after: string | null }} Movement
 */

/**
 * @param {string} root
 * @param {readonly string[]} args
 * @returns {string[]}
 */
const gitLines = (root, args) => {
  const r = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw new Error(`git ${args.join(' ')} could not run in ${root}: ${r.error.message}`);
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${root} (exit ${r.status}): ${(r.stderr ?? '').trim()}`);
  }
  return (r.stdout ?? '').split('\0').filter((entry) => entry !== '');
};

/**
 * Every repo-relative path whose bytes could change what a run of the suite
 * measures: tracked, plus untracked-and-not-ignored.
 *
 * Deliberately not `git status`: its `-z` output interleaves a second field for
 * renames and copies, and parsing that correctly is a thing to get wrong. Two
 * `ls-files` calls return plain NUL-separated paths and nothing else.
 *
 * @param {string} root
 * @param {readonly string[]} [exclude]
 * @returns {string[]}
 */
export function relevantPaths(root, exclude = []) {
  const tracked = gitLines(root, ['ls-files', '-z']);
  const untracked = gitLines(root, ['ls-files', '-z', '--others', '--exclude-standard']);
  const all = [...new Set([...tracked, ...untracked])].sort();
  return all.filter((p) => !exclude.some((prefix) => p.startsWith(prefix)));
}

/**
 * The identity of `root` right now.
 *
 * `exclude` is a list of repo-relative PATH PREFIXES the caller writes during
 * its own run — without it, a tool that writes into the tree reports itself
 * moved on every single run, which is the "instrument that always fires" failure
 * CLAUDE.md records for three other checks here.
 *
 * A path that cannot be read is omitted rather than recorded as an error value,
 * so deleting a tracked file mid-run reports as `vanished` rather than as a
 * content change into a sentinel.
 *
 * @param {string} root
 * @param {readonly string[]} [exclude]
 * @returns {TreeIdentity}
 */
export function treeIdentity(root, exclude = []) {
  let head;
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (rev.status === 0) head = (rev.stdout ?? '').trim();
  else head = TREE_IDENTITY.NO_COMMIT;

  /** @type {Record<string, string>} */
  const files = {};
  for (const rel of relevantPaths(root, exclude)) {
    let bytes;
    try {
      bytes = readFileSync(path.join(root, rel));
    } catch {
      continue;
    }
    files[rel] = createHash('sha256').update(bytes).digest('hex').slice(0, TREE_IDENTITY.DIGEST_CHARS);
  }
  return { head, files };
}

/**
 * What moved between two identities. Pure — it touches no filesystem, which is
 * what lets it be driven over cases a real repository makes awkward to stage.
 *
 * Sorted by path with the `HEAD` movement first, so two reports of the same
 * movement are byte-identical and a reader comparing runs is comparing the
 * movement rather than a hash-iteration order.
 *
 * @param {TreeIdentity} before
 * @param {TreeIdentity} after
 * @returns {Movement[]}
 */
export function identityDelta(before, after) {
  /** @type {Movement[]} */
  const moved = [];
  if (before.head !== after.head) {
    moved.push({
      path: TREE_IDENTITY.HEAD_PATH,
      kind: 'head',
      before: before.head,
      after: after.head,
    });
  }
  const paths = [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])].sort();
  for (const p of paths) {
    const b = before.files[p];
    const a = after.files[p];
    if (b === a) continue;
    if (b === undefined) moved.push({ path: p, kind: 'appeared', before: null, after: a });
    else if (a === undefined) moved.push({ path: p, kind: 'vanished', before: b, after: null });
    else moved.push({ path: p, kind: 'changed', before: b, after: a });
  }
  return moved;
}

/**
 * One line per movement, in the order `identityDelta` produced them.
 *
 * @param {readonly Movement[]} moved
 * @returns {string[]}
 */
export function describeDelta(moved) {
  const shown = moved.slice(0, TREE_IDENTITY.MAX_PATHS_REPORTED).map((m) => {
    if (m.kind === 'head') return `  HEAD moved ${String(m.before).slice(0, 8)} -> ${String(m.after).slice(0, 8)}`;
    if (m.kind === 'appeared') return `  appeared  ${m.path}`;
    if (m.kind === 'vanished') return `  vanished  ${m.path}`;
    return `  changed   ${m.path} (${m.before} -> ${m.after})`;
  });
  const rest = moved.length - shown.length;
  return rest > 0 ? [...shown, `  ...and ${rest} more`] : shown;
}
