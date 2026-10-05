#!/usr/bin/env node
/**
 * wave-start.mjs — the first thing a wave runs, before any agent is dispatched.
 *
 * ===========================================================================
 * WHY A WAVE NEEDS A START-OF-WAVE CHECK AT ALL
 * ===========================================================================
 * Two failures in this run are invisible at the moment they happen and only
 * become visible much later, by which time they have cost something:
 *
 *   1. THE CHECKOUT REWINDS. Six times now. `HEAD` comes back at an older
 *      commit, sometimes taking the reflog and files on disk with it. It has
 *      never announced itself; it has been caught by a command failing oddly,
 *      or by a push being rejected, or by a file simply not being there.
 *   2. AN AGENT IS KILLED WITH ITS CONTAINER. Five times. The agent's task list
 *      freezes mid-step and reads exactly like slow work, so the natural
 *      diagnosis is a hang. On the fifth occurrence there was no process
 *      running at all and the container was sixteen minutes old.
 *
 * Both are cheap to detect and expensive to discover late. Both are detected by
 * asking the same three questions, which is what this file does.
 *
 * ===========================================================================
 * WHAT IT ASKS
 * ===========================================================================
 *   1. IS LOCAL AHEAD OF, BEHIND, OR DIVERGED FROM ORIGIN?
 *      Read with `ls-remote`, which asks the remote rather than a local
 *      tracking ref — a rewind can take the tracking ref with it, so
 *      `origin/<branch>` is not independent evidence. Behind or diverged is the
 *      rewind's signature and is reported loudly.
 *   2. IS ANY UNMERGED `claude/*` BRANCH STALE? (`watchdog.mjs --branches`)
 *      Commit age is the one signal that outlives the agent, the container and
 *      the notification.
 *   3. DOES THE COMMITTED BROWSER EVIDENCE STILL DESCRIBE THIS TREE?
 *      (`evidence.mjs --verify`) Stale evidence is what a critic grades if
 *      nobody looks, and it has reached one before.
 *
 * ===========================================================================
 * WHAT IT DOES NOT DO — declared, because a partial mechanism that states its
 * coverage beats one that implies completeness (CLAUDE.md)
 * ===========================================================================
 *   - It cannot detect a rewind that happens AFTER it runs. It is a start-of-
 *     wave snapshot, not a monitor. The sixth rewind landed mid-wave and was
 *     caught by a push probe, which remains the right habit before any push
 *     that carries work worth keeping.
 *   - It cannot tell a dead agent from a slow one, only silent from stale.
 *   - A non-zero exit means "look at this", not "the wave cannot start". Two of
 *     the three questions have legitimate non-zero answers — an in-flight agent
 *     is unmerged and young, evidence is stale right after a code change — so
 *     the output names which, and the reader decides.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const run = (args) => spawnSync('node', args, { cwd: ROOT, encoding: 'utf8' });
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const problems = [];
const line = '='.repeat(72);

console.log(`${line}\nWAVE START\n${line}`);

// ---------------------------------------------------------------------------
// 1. Local against the REMOTE, not against a tracking ref.
// ---------------------------------------------------------------------------
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const local = git(['rev-parse', 'HEAD']);
let remote = null;
try {
  const out = git(['ls-remote', 'origin', `refs/heads/${branch}`]);
  remote = out === '' ? null : out.split('\t')[0];
} catch (error) {
  problems.push(`could not reach origin to compare ${branch}: ${String(error).slice(0, 120)}`);
}

console.log(`\n[1] HEAD vs origin — asked of the remote, not of origin/${branch}`);
console.log(`    branch  ${branch}`);
console.log(`    local   ${local.slice(0, 7)}`);
console.log(`    remote  ${remote === null ? '(absent)' : remote.slice(0, 7)}`);

if (remote === null) {
  console.log('    NOT ON ORIGIN YET — nothing here is durable. Push before dispatching.');
  problems.push(`${branch} does not exist on origin`);
} else if (local === remote) {
  console.log('    in sync.');
} else {
  // `--is-ancestor` exits 1 for "no" and something else for a real failure. A
  // catch-all here would turn "I could not tell" into a definite answer, which
  // is the bug the watchdog's own first draft shipped.
  const ancestor = (a, b) => {
    const r = spawnSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: ROOT });
    if (r.status === 0) return true;
    if (r.status === 1) return false;
    throw new Error(`git merge-base --is-ancestor ${a} ${b} failed with status ${r.status}`);
  };
  const localInRemote = ancestor(local, remote);
  const remoteInLocal = ancestor(remote, local);
  if (localInRemote && !remoteInLocal) {
    console.log('    !! LOCAL IS BEHIND ORIGIN. This is the rewind signature: origin holds');
    console.log('       commits this checkout has lost. Recover with `git reset --hard`');
    console.log('       to the remote SHA before doing anything else.');
    problems.push(`${branch} is BEHIND origin — likely a rewind`);
  } else if (remoteInLocal && !localInRemote) {
    console.log('    local is ahead — unpushed work. Push it; a local commit is not durable here.');
    problems.push(`${branch} has unpushed commits`);
  } else {
    console.log('    !! DIVERGED. Neither is an ancestor of the other. Do not force-push;');
    console.log('       work out which side holds what before touching either.');
    problems.push(`${branch} has DIVERGED from origin`);
  }
}

// ---------------------------------------------------------------------------
// 2. Stale unmerged branches — a dead agent, or a finished one nobody merged.
// ---------------------------------------------------------------------------
console.log(`\n[2] Unmerged claude/* branches by commit age`);
const wd = run([path.join(ROOT, 'tools', 'watchdog.mjs'), '--branches']);
process.stdout.write((wd.stdout ?? '').split('\n').map((l) => (l === '' ? '' : `    ${l}`)).join('\n'));
if (wd.status !== 0) problems.push('stale unmerged branch(es) — see [2]');

// ---------------------------------------------------------------------------
// 3. Does the committed evidence still describe this tree?
// ---------------------------------------------------------------------------
console.log(`\n[3] Committed browser evidence vs this tree`);
const ev = run([path.join(ROOT, 'tools', 'evidence.mjs'), 'suite', '--verify']);
const evText = `${ev.stdout ?? ''}${ev.stderr ?? ''}`.trim();
console.log(evText === '' ? '    (no output)' : evText.split('\n').map((l) => `    ${l}`).join('\n'));
if (ev.status !== 0) problems.push('evidence is stale — re-capture before dispatching a critic');

// ---------------------------------------------------------------------------
console.log(`\n${line}`);
if (problems.length === 0) {
  console.log('WAVE START CLEAN — in sync with origin, nothing stale, evidence current.');
  process.exit(0);
}
console.log(`WAVE START: ${problems.length} thing(s) to look at before dispatching`);
for (const p of problems) console.log(`  - ${p}`);
console.log('\nNone of these blocks a wave by itself. Each is something that has cost');
console.log('this run a round when it was noticed late instead of early.');
process.exit(1);
