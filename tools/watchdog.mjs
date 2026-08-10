#!/usr/bin/env node
/**
 * watchdog.mjs — make a run that stops producing fail LOUDLY.
 *
 * ===========================================================================
 * WHY THIS EXISTS, AND WHAT ACTUALLY HAPPENED
 * ===========================================================================
 * Three builders were dispatched and reported nothing for 24+ hours. The
 * diagnosis offered was "an infinite loop or deadlock in the test harness".
 * IT WAS NOT. Measured rather than assumed:
 *
 *   - no `vitest`, `node`, `chromium` or `playwright` process was running;
 *   - `/proc/uptime` said the container was 16 MINUTES OLD;
 *   - the three builder branches' last commits were 18:15, 18:22 and 18:09 on
 *     the previous day, then nothing.
 *
 * So there were **24.5 hours with no container at all**. The builders were
 * killed when the previous container was destroyed. Nothing hung, nothing
 * deadlocked, and there was no loop to break.
 *
 * WHAT MADE IT LOOK LIKE A HANG is the thing worth guarding: a killed agent is
 * INDISTINGUISHABLE FROM A WORKING ONE. Its task list keeps whatever step it
 * had reached — "Run mutants M1-M3", "Wait for the mutation batch to finish" —
 * and stays in-progress forever, because nothing is left alive to mark it done.
 * That has now happened to five agents in this run, and CLAUDE.md already
 * carries the lesson in prose: *"a silent agent death looks identical to a slow
 * one, so unmerged branches need checking by commit age rather than waiting for
 * a notification."* Prose is not a check. This is the check.
 *
 * ===========================================================================
 * TWO MODES, FOR TWO DIFFERENT FAILURES
 * ===========================================================================
 *   --budget <seconds> -- <command...>
 *       Runs the command under a hard wall-clock cap. On breach it kills the
 *       whole process group and exits 2 with a message naming the budget, the
 *       command and the elapsed time. This is the guard that was ASKED for. It
 *       is worth having on its own terms — `vitest` has a per-test timeout and
 *       NO global run cap, and this repo's own record says
 *       `streakEntitlement.test.ts` sits near that per-test cap and flakes
 *       under load — but note that it would NOT have caught the failure above,
 *       because there was no process to time out.
 *
 *   --branches [--stale-minutes N]
 *       Lists every `claude/*` branch not merged into HEAD, with the age of its
 *       last commit, and exits 1 if any exceeds the threshold. THIS is the mode
 *       aimed at what actually happened: a branch with commits and no progress
 *       is either a dead agent or a finished one nobody merged, and both need a
 *       human's eye. It reads commit age because that is the one signal that
 *       survives the agent, the container and the notification.
 *
 * ===========================================================================
 * WHAT THIS CANNOT DO — stated, because a partial mechanism that declares its
 * coverage beats one that implies completeness (CLAUDE.md)
 * ===========================================================================
 *   - It cannot tell a DEAD agent from a SLOW one. Nothing here can: the only
 *     difference is in the future. It converts "silent" into "stale", which is
 *     a question a human can answer in one look, and that is the whole claim.
 *   - It cannot see an agent that died before its first commit. Those leave no
 *     branch and no trace; the only guard for that is dispatching agents that
 *     commit early, which is a brief-writing habit and not a tool.
 *   - `--budget` bounds WALL CLOCK, not progress. A command that prints a line
 *     a second forever and finishes inside the budget passes.
 */
import { spawn, execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag, dflt) => {
  const i = argv.indexOf(flag);
  return i === -1 ? dflt : argv[i + 1];
};

/** Minutes after which a branch with no new commit is reported. */
const DEFAULT_STALE_MINUTES = 45;

/**
 * THE BRANCH SCAN ABOVE CANNOT SEE A BUILDER THAT HAS NOT COMMITTED YET, AND
 * THAT IS THE DEAD-AGENT PROBLEM INVERTED.
 *
 * `--branches` ages a branch by its last commit, which is the right signal once
 * a commit exists. It has nothing to age when none does. A builder dispatched
 * and killed in its first minutes leaves a branch sitting exactly at the base
 * commit — an ancestor of HEAD, so `isMerged` filters it out — and the tool
 * prints "0 unmerged branches" and its own vacuous-pass note. Which was
 * literally true and completely uninformative with two builders live.
 *
 * A WORKTREE IS THE TRACE THAT SURVIVES. It is created at dispatch, before any
 * work happens, and it outlives the agent, the container's notification and the
 * task list. So it is available exactly in the window the commit is not.
 *
 * WHAT THIS DELIBERATELY CANNOT TELL YOU, declared rather than implied: a
 * worktree whose branch adds nothing to HEAD is EITHER a dispatched agent that
 * has produced nothing yet OR a finished one whose work was merged and whose
 * directory nobody pruned. Those two are indistinguishable from the refs alone,
 * and this run has ~25 of the second kind lying around. The age is the reader's
 * discriminator, not the tool's: a young one is probably an agent working, an
 * hour-old one with nothing in it is probably dead, and a six-day-old one is
 * almost certainly just litter. It reports the set and says which is which is
 * not its call.
 */
function silentWorktrees(git, head, now) {
  let raw;
  try {
    raw = git(['worktree', 'list', '--porcelain']);
  } catch {
    return []; // not fatal; the branch scan is the primary signal
  }
  const out = [];
  let cur = null;
  for (const line of `${raw}\n`.split('\n')) {
    if (line.startsWith('worktree ')) cur = { path: line.slice('worktree '.length), branch: null, sha: null };
    else if (line.startsWith('HEAD ') && cur) cur.sha = line.slice('HEAD '.length);
    else if (line.startsWith('branch ') && cur) cur.branch = line.slice('branch '.length).replace('refs/heads/', '');
    else if (line === '' && cur) {
      out.push(cur);
      cur = null;
    }
  }
  const main = out[0]?.path ?? null;
  const rows = [];
  for (const w of out) {
    if (w.path === main || w.sha === null) continue;
    // Adds nothing to HEAD => the branch scan above already ignored it.
    let addsNothing = false;
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', w.sha, head], { stdio: 'ignore' });
      addsNothing = true;
    } catch (error) {
      if (!error || error.status !== 1) throw new Error(`--is-ancestor ${w.sha} HEAD failed: ${String(error)}`);
    }
    if (!addsNothing) continue;
    let ageMin = null;
    try {
      ageMin = (now - Math.floor(statSync(w.path).mtimeMs / 1000)) / 60;
    } catch {
      ageMin = null; // directory gone — the rewind does this
    }
    rows.push({ ...w, ageMin });
  }
  return rows.sort((a, b) => (a.ageMin ?? Infinity) - (b.ageMin ?? Infinity));
}

function reportSilentWorktrees(rows, unmergedCount) {
  console.log(`\n[worktrees] ${rows.length} attached worktree(s) whose branch adds nothing to HEAD`);
  if (rows.length === 0) {
    console.log('    none — every attached worktree carries unmerged commits, so the branch');
    console.log('    scan above already covers all of them.');
    return;
  }
  for (const r of rows) {
    const age = r.ageMin === null ? '   gone' : `${String(Math.round(r.ageMin)).padStart(6)} min`;
    console.log(`    ${age}  ${r.branch ?? '(detached)'}  ${r.path}`);
  }
  console.log('    A worktree here is EITHER an agent that has not committed yet OR a merged');
  console.log('    one nobody pruned. This cannot tell them apart — age is your discriminator.');
  console.log('    Young: probably working. Old and empty: probably a builder that died before');
  console.log('    its first commit, which the branch scan above cannot see at all.');
  console.log('    Each is a FULL CHECKOUT and costs real disk — this run has carried 4.5G of');
  console.log('    them against a 20G allowance, and writable disk here is a fixed budget, not');
  console.log('    a filesystem. `git worktree remove <path>` clears a merged one (its work is');
  console.log('    in HEAD by definition of appearing here); `git worktree prune` only clears');
  console.log('    entries whose directory has already vanished, which is not these.');
  if (unmergedCount === 0) {
    console.log('    Do not remove one while its agent is live — check the age column first.');
  }
}

function branches() {
  const staleMinutes = Number(valueOf('--stale-minutes', String(DEFAULT_STALE_MINUTES)));
  if (!Number.isFinite(staleMinutes) || staleMinutes <= 0) {
    console.error(`--stale-minutes must be a positive number, got ${JSON.stringify(valueOf('--stale-minutes'))}`);
    return 2;
  }
  const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const head = git(['rev-parse', 'HEAD']);

  const raw = git([
    'for-each-ref',
    '--format=%(refname:short)%09%(committerdate:unix)%09%(objectname:short)%09%(contents:subject)',
    'refs/heads/claude/',
  ]);
  const rows = raw === '' ? [] : raw.split('\n').map((line) => {
    const [name, unix, sha, subject] = line.split('\t');
    return { name, unix: Number(unix), sha, subject };
  });

  const current = git(['rev-parse', '--abbrev-ref', 'HEAD']);

  /**
   * MERGED BRANCHES ARE FINISHED BUSINESS, NOT A STALLED AGENT.
   *
   * The first version of this asked `git merge-base --is-merged`, which is NOT
   * A GIT OPTION — and wrapped it in a `try/catch` that read any non-zero exit
   * as "not merged". So an invalid command failed OPEN: every branch in the
   * repository, including the one checked out, came back stale. It printed 25
   * findings and looked like a working tool.
   *
   * Recorded rather than quietly fixed, because it is this run's most repeated
   * shape one level up: a catch-all that turns "I could not tell" into a
   * definite answer, in the direction that produces output. `--is-ancestor` is
   * the real option, and the catch now distinguishes its documented exit codes
   * (0 merged, 1 not merged) from a genuine failure, which throws.
   */
  const isMerged = (branch) => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', branch, head], { stdio: 'ignore' });
      return true;
    } catch (error) {
      if (error && error.status === 1) return false;
      throw new Error(`git merge-base --is-ancestor ${branch} HEAD failed: ${String(error)}`);
    }
  };

  const unmerged = rows.filter((r) => r.name !== current && !isMerged(r.name));

  const now = Math.floor(Date.now() / 1000);
  const withAge = unmerged
    .map((r) => ({ ...r, ageMin: (now - r.unix) / 60 }))
    .sort((a, b) => b.ageMin - a.ageMin);

  const stale = withAge.filter((r) => r.ageMin > staleMinutes);

  console.log(`${withAge.length} unmerged claude/* branch(es); stale threshold ${staleMinutes} min\n`);
  for (const r of withAge) {
    const mark = r.ageMin > staleMinutes ? 'STALE' : 'ok   ';
    console.log(`${mark}  ${String(Math.round(r.ageMin)).padStart(6)} min  ${r.sha}  ${r.name}`);
    console.log(`                       ${r.subject}`);
  }

  const silent = silentWorktrees(git, head, now);
  reportSilentWorktrees(silent, withAge.length);

  // NON-VACUITY. An empty branch list satisfies "nothing is stale" and would
  // report success on a repository where every branch had been pruned — the
  // emptiest possible pass. Say so rather than printing a green line.
  if (withAge.length === 0) {
    console.log('\nNo unmerged claude/* branches exist, so this run checked NOTHING against');
    console.log('COMMIT AGE. That is a vacuous pass, not a clean one, and it is reported as');
    console.log('such — see [worktrees] above for the part that is not vacuous.');
    return silent.length > 0 ? 1 : 0;
  }

  if (stale.length > 0) {
    console.log(`\n!! ${stale.length} branch(es) have not moved in over ${staleMinutes} minutes.`);
    console.log('   A branch with commits and no progress is a dead agent or a finished one');
    console.log('   nobody merged. Both need a look; neither announces itself.');
    return 1;
  }
  console.log(`\nAll ${withAge.length} moved within ${staleMinutes} minutes.`);
  return 0;
}

async function budget() {
  const seconds = Number(valueOf('--budget'));
  const sep = argv.indexOf('--');
  const command = sep === -1 ? [] : argv.slice(sep + 1);
  if (!Number.isFinite(seconds) || seconds <= 0 || command.length === 0) {
    console.error('usage: node tools/watchdog.mjs --budget <seconds> -- <command...>');
    return 2;
  }

  const startedAt = Date.now();
  // `detached` so the kill reaches the whole group: vitest and playwright both
  // fork, and killing only the parent leaves the children holding the terminal,
  // which is the silent version of the failure this file is about.
  const child = spawn(command[0], command.slice(1), { stdio: 'inherit', detached: true });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }, seconds * 1000);

  const code = await new Promise((resolve) => {
    child.on('exit', (c, signal) => resolve(signal !== null && timedOut ? 124 : (c ?? 1)));
    child.on('error', (error) => {
      console.error(`watchdog: could not start ${command[0]} — ${String(error)}`);
      resolve(2);
    });
  });
  clearTimeout(timer);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (timedOut) {
    console.error(`\n!! WATCHDOG: killed after ${elapsed}s, budget was ${seconds}s`);
    console.error(`   command: ${command.join(' ')}`);
    console.error('   The process group was SIGKILLed. This is a loud failure on purpose:');
    console.error('   a run that stops producing must not look like a run that is still going.');
    return 124;
  }
  console.error(`watchdog: ${command.join(' ')} finished in ${elapsed}s (budget ${seconds}s)`);
  return code;
}

const mode = has('--branches') ? branches : has('--budget') ? budget : null;
if (mode === null) {
  console.error('usage:');
  console.error('  node tools/watchdog.mjs --branches [--stale-minutes N]');
  console.error('  node tools/watchdog.mjs --budget <seconds> -- <command...>');
  process.exit(2);
}
process.exit(await mode());
