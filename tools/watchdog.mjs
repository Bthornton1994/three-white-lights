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
 * THREE MODES, FOR THREE DIFFERENT FAILURES
 * ===========================================================================
 *   --budget <seconds> [--label <name>] -- <command...>
 *       Runs the command under a hard wall-clock cap. On breach it kills the
 *       whole process group and exits 2 with a message naming the budget, the
 *       command and the elapsed time. This is the guard that was ASKED for. It
 *       is worth having on its own terms — `vitest` has a per-test timeout and
 *       NO global run cap, and this repo's own record says
 *       `streakEntitlement.test.ts` sits near that per-test cap and flakes
 *       under load — but note that it would NOT have caught the failure above,
 *       because there was no process to time out.
 *
 *       IT ALSO WRITES AN INCOMPLETE MARKER BEFORE THE COMMAND STARTS, and
 *       replaces it with a verdict only when one exists. See
 *       `verifyMarker.mjs`, which holds the ruling and the reasoning; the two
 *       sentences that matter here are that the write happens BEFORE the spawn
 *       and that a timeout, a signal or a spawn failure leaves the marker
 *       standing. A run that stops existing is the failure this pair is about
 *       from two directions: the loud one kills a hang, the quiet one makes an
 *       interrupted run visible after everything that could report it is dead.
 *
 *       AND IT PUSHES THAT MARKER TO ORIGIN EVERY `VERIFY_SYNC.INTERVAL_SECONDS`
 *       WHILE THE COMMAND IS STILL RUNNING. The local marker does not survive a
 *       tree death — `.gauntlet/verify/` reverts with everything else — and tree
 *       death is this environment's dominant failure. Origin is the only thing
 *       that has ever survived one. A completion-time push would repeat the
 *       original defect one level out, because a run that dies mid-flight never
 *       reaches its completion step. A push failure is REPORTED and never
 *       changes the verification's exit code.
 *
 *   --branches [--stale-minutes N]
 *       Lists every `claude/*` branch not merged into HEAD, with the age of its
 *       last commit, and exits 1 if any exceeds the threshold. THIS is the mode
 *       aimed at what actually happened: a branch with commits and no progress
 *       is either a dead agent or a finished one nobody merged, and both need a
 *       human's eye. It reads commit age because that is the one signal that
 *       survives the agent, the container and the notification. It ALSO reports
 *       the marker scan below, because that is the command a wave already runs.
 *
 *   --markers [--clear-stale] [--no-remote]
 *       Reports every verification marker and exits 1 if any is a finding — an
 *       interrupted run, or one this machine cannot resolve. Same scan as the
 *       section inside `--branches`, from the same function, not a second copy.
 *
 *       IT READS ORIGIN AS WELL AS THIS TREE, and that is the case it exists
 *       for: after a rewind the local directory is EMPTY and the only surviving
 *       record is the one that was pushed mid-run. A record on origin nobody
 *       reads is worth nothing, so this is the default rather than a flag
 *       somebody has to remember at exactly the moment nobody remembers
 *       anything. `--no-remote` is for working offline on purpose; an origin
 *       that cannot be reached is reported as a NAMED SKIPPED CHECK and does
 *       not change the exit code, which is stated as a limit in
 *       `scanRemoteMarkers`'s header rather than left for a reader to discover.
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
 *   - THE MARKER SCAN ONLY SEES VERIFICATIONS THAT WERE WRAPPED. A suite run
 *     started by hand writes no marker, so its interruption is as silent as it
 *     ever was. That is a coverage limit of the discipline, not of the scan.
 */
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERIFY_MARKER,
  VERIFY_SYNC,
  beginMarker,
  clearRemoteStale,
  clearStale,
  findingCount,
  finishMarker,
  formatMarkerReport,
  heartbeatMarker,
  scanMarkers,
  syncEnabled,
  syncIntervalSecondsFor,
  syncRemoteFor,
} from './verifyMarker.mjs';

/** This tool is run from anywhere; the marker directory is the repo's. */
const ROOT = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

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
function silentWorktrees(git, head, now, archiveShas) {
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
    // DIRTY IS THE DISCRIMINATOR AGE IS NOT, and it was learned the hard way:
    // 27 of these were about to be swept as litter, and four held uncommitted
    // SOURCE edits from agents killed mid-flight — work that is in no commit,
    // on no branch, and on no remote. Age said nothing about which four; two of
    // them were the same age as neighbours that held nothing.
    let dirty = null;
    let dirtyPaths = [];
    try {
      const status = execFileSync('git', ['-C', w.path, 'status', '--porcelain'], { encoding: 'utf8' });
      const lines = status.trim() === '' ? [] : status.trim().split('\n');
      dirty = lines.length;
      dirtyPaths = lines.map((l) => l.replace(/^\s*\S+\s+/, '').replace(/^.*? -> /, ''));
    } catch {
      dirty = null; // unreadable — say so rather than reporting 0
    }
    /**
     * IS THIS UNCOMMITTED WORK ALREADY THE ONLY COPY, OR IS IT ARCHIVED?
     *
     * The dirty column says "this is in no commit, on no branch, on no remote —
     * the only copy there is", which is what makes it worth stopping for. Once
     * that work has been read, committed to an `archive/rescued-*` ref and
     * pushed, the sentence is false and the row becomes the third permanent
     * false alarm this instrument has grown.
     *
     * DERIVED, BY CONTENT, because there is no ref to compare against — the
     * whole point is that the work is uncommitted. Every dirty path's bytes on
     * disk are compared with the same path inside each archive commit. If some
     * one archive holds all of them identically, this working tree has a
     * durable copy and is labelled ARCHIVED rather than counted.
     *
     * It self-expires: touch the worktree again and the bytes stop matching, so
     * the row goes back to being a warning without anybody maintaining a list.
     */
    let archived = false;
    if ((dirty ?? 0) > 0 && dirtyPaths.length > 0) {
      archived = archiveShas.some((sha) =>
        dirtyPaths.every((rel) => {
          let inArchive;
          try {
            inArchive = execFileSync('git', ['show', `${sha}:${rel}`]);
          } catch (error) {
            // ONLY a git failure means "that archive does not hold this path".
            // The first draft of this block caught everything and returned
            // false, which turned a ReferenceError — it named a binding this
            // file does not define — into a confident "not archived". That is
            // the catch-all defect recorded in `isMerged`'s own header above,
            // committed into the same file by the same hand hours after
            // quoting it. A programming error must reach the surface.
            if (error && typeof error.status === 'number') return false;
            throw error;
          }
          try {
            return inArchive.equals(readFileSync(path.join(w.path, rel)));
          } catch (error) {
            if (error && error.code === 'ENOENT') return false; // deleted on disk
            throw error;
          }
        }),
      );
    }
    rows.push({ ...w, ageMin, dirty, archived });
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
  const carrying = rows.filter((r) => (r.dirty ?? 0) > 0 && !r.archived);
  for (const r of rows) {
    const age = r.ageMin === null ? '   gone' : `${String(Math.round(r.ageMin)).padStart(6)} min`;
    const mark =
      r.dirty === null
        ? ' ?dirty'
        : r.archived
          ? ` ${r.dirty} archived`
          : r.dirty > 0
            ? ` !${r.dirty} UNCOMMITTED`
            : '  clean';
    console.log(`    ${age} ${mark}  ${r.branch ?? '(detached)'}  ${r.path}`);
  }
  console.log('    A worktree here is EITHER an agent that has not committed yet OR a merged');
  console.log('    one nobody pruned, and the refs cannot tell them apart. THE DIRTY COLUMN');
  console.log('    CAN, which is the column age could not supply: a clean one has nothing in');
  console.log('    it that is not already in HEAD, and an UNCOMMITTED one holds work that is');
  console.log('    in no commit, on no branch and on no remote — the only copy there is.');
  if (carrying.length > 0) {
    console.log(`    !! ${carrying.length} worktree(s) are carrying uncommitted work. Look before removing any.`);
  }
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
  // ONE ancestor test, used by both questions below. It was two for about ten
  // minutes — the triage check below was written with a second, differently
  // shaped copy, which referenced a binding this file does not import and would
  // have thrown the first time a genuinely unmerged branch appeared. That is
  // this repository's most-recorded defect committed inside the guard that
  // exists to report on it, and it was caught only by constructing the case
  // rather than reading the code.
  const ancestorOf = (a, b) => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', a, b], { stdio: 'ignore' });
      return true;
    } catch (error) {
      if (error && error.status === 1) return false;
      throw new Error(`git merge-base --is-ancestor ${a} ${b} failed: ${String(error)}`);
    }
  };

  const isMerged = (branch) => ancestorOf(branch, head);

  /**
   * TRIAGED WORK IS NOT STALE WORK, AND A PERMANENT FALSE ALARM IS THE REAL COST.
   *
   * Four branches hold the working trees of agents killed mid-flight. They were
   * read, decided on — two salvaged, two rejected as regressions with the reason
   * recorded — and they cannot be deleted: this environment's GitHub App has no
   * permission to remove a ref (`HTTP 403` on any delete). So they would sit in
   * this report as STALE forever.
   *
   * That is worse than it sounds. A check that always reports the same finding
   * trains its reader to skip the section, and the next REAL stale branch lands
   * in a list that everyone has learned to ignore. This run has already paid for
   * one instrument quietly reporting a permanent false alarm.
   *
   * DERIVED, NOT LISTED. A branch counts as triaged when some ref under
   * `refs/heads/archive/` CONTAINS it — the archive is the durable copy, pushed
   * before the original was abandoned. Deliberately containment rather than SHA
   * equality: a rewind reverts local branch refs, so the local `claude/*` name is
   * routinely BEHIND the archive it was copied from, and an equality test would
   * call a genuinely archived branch untriaged. Containment survives that.
   *
   * A hand-maintained list of triaged names was the alternative and is the
   * failure mode this file has already recorded twice: a list nobody prunes.
   * Move the branch's work into an archive ref and this answers itself; if the
   * branch later grows a commit the archive does not contain, it correctly
   * becomes untriaged again.
   */
  // BOTH local and origin-tracking archive refs. A rewind drops the local ones —
  // it did, an hour after this triage landed, and the four archived rows came
  // back reading UNCOMMITTED with the archives still safe on origin. Reading the
  // remote-tracking copies too means an ordinary `git fetch` restores the signal
  // instead of it needing a hand-typed refspec nobody will remember.
  const archives = git([
    'for-each-ref',
    '--format=%(objectname)',
    'refs/heads/archive/',
    'refs/remotes/origin/archive/',
  ]).split('\n').filter((s) => s !== '');
  const isTriaged = (branch) => archives.some((a) => ancestorOf(branch, a));

  const unmerged = rows.filter((r) => r.name !== current && !isMerged(r.name));

  const now = Math.floor(Date.now() / 1000);
  const withAge = unmerged
    .map((r) => ({ ...r, ageMin: (now - r.unix) / 60, triaged: isTriaged(r.name) }))
    .sort((a, b) => b.ageMin - a.ageMin);

  const stale = withAge.filter((r) => r.ageMin > staleMinutes && !r.triaged);
  const triagedCount = withAge.filter((r) => r.triaged).length;

  console.log(
    `${withAge.length} unmerged claude/* branch(es); stale threshold ${staleMinutes} min` +
      `${triagedCount > 0 ? `; ${triagedCount} archived and therefore not counted stale` : ''}\n`,
  );
  for (const r of withAge) {
    const mark = r.triaged ? 'archived' : r.ageMin > staleMinutes ? 'STALE   ' : 'ok      ';
    console.log(`${mark}  ${String(Math.round(r.ageMin)).padStart(6)} min  ${r.sha}  ${r.name}`);
    console.log(`                          ${r.subject}`);
  }
  if (triagedCount > 0) {
    console.log(`\n  "archived" means a ref under refs/heads/archive/ CONTAINS that branch, so its`);
    console.log('  work is triaged and durable. It is still listed, because this environment');
    console.log('  cannot delete a ref (HTTP 403) and a row silently dropped is a row nobody can');
    console.log('  audit — but it is not counted stale, so the section keeps meaning something.');
  }

  const silent = silentWorktrees(git, head, now, archives);
  reportSilentWorktrees(silent, withAge.length);

  // THE THIRD QUESTION A WAVE ASKS, ANSWERED BY THE SAME COMMAND. A verification
  // that stopped existing is the same class of failure as an agent that stopped
  // existing, one layer down, and this is the command the lead already runs at
  // the end of a wave.
  const markerFindings = findingCount(markerSection());

  // NON-VACUITY. An empty branch list satisfies "nothing is stale" and would
  // report success on a repository where every branch had been pruned — the
  // emptiest possible pass. Say so rather than printing a green line.
  if (withAge.length === 0) {
    console.log('\nNo unmerged claude/* branches exist, so this run checked NOTHING against');
    console.log('COMMIT AGE. That is a vacuous pass, not a clean one, and it is reported as');
    console.log('such — see [worktrees] above for the part that is not vacuous.');
  } else if (stale.length > 0) {
    console.log(`\n!! ${stale.length} branch(es) have not moved in over ${staleMinutes} minutes.`);
    console.log('   A branch with commits and no progress is a dead agent or a finished one');
    console.log('   nobody merged. Both need a look; neither announces itself.');
  } else {
    console.log(`\nAll ${withAge.length} moved within ${staleMinutes} minutes.`);
  }

  // ONE EXIT COMPUTATION FOR THREE FINDINGS, deliberately not three returns.
  // This WAS three returns, and adding a fourth finding to that shape means
  // remembering it on each — the arm that gets forgotten is always the quiet
  // one, which here is the vacuous-pass arm a repository with no unmerged
  // branches takes. Both markers and branches are now decided in one place.
  //
  // Exit on what is ACTIONABLE, not on what is merely listed. 25 worktrees exist
  // because nothing prunes them; that is litter, not a finding, and exiting 1 on
  // it makes the whole check a permanent non-zero nobody reads. A worktree
  // carrying uncommitted work no archive holds IS actionable: it is the only
  // copy of something. So is an interrupted verification.
  //
  // THE `withAge.length === 0` GUARD ON `unarchived` IS THE ORIGINAL BEHAVIOUR
  // AND IS PRESERVED RATHER THAN FIXED. As written, uncommitted-only-copy work
  // is actionable when no branch is unmerged and silently is not when one is,
  // which reads like an asymmetry nobody chose. Changing it is a change to the
  // worktree guard, not to the marker one, and it would turn somebody else's
  // litter into a permanent non-zero on this wave's runs. Noted here rather
  // than altered underneath the piece that noticed it.
  const unarchived = silent.filter((r) => (r.dirty ?? 0) > 0 && !r.archived).length;
  const worktreeFinding = withAge.length === 0 && unarchived > 0;
  return stale.length > 0 || worktreeFinding || markerFindings > 0 ? 1 : 0;
}

/**
 * THE MARKER SCAN, IN ONE FUNCTION WITH TWO CALLERS.
 *
 * `--markers` and the section inside `--branches` are the same question and are
 * therefore the same code. Writing the second one as a copy of the first is the
 * defect this repository has recorded four times — a guard written for one arm
 * and not applied to the sibling immediately below it — and the distance keeps
 * shrinking, so the two callers here read this rather than resembling it.
 */
function markerSection({ nowMs = Date.now() } = {}) {
  const scan = scanMarkers({ root: ROOT, nowMs, remote: !has('--no-remote') });
  console.log(formatMarkerReport(scan));
  return scan;
}

async function markers() {
  const scan = markerSection();
  if (has('--clear-stale')) {
    // Taken BEFORE the delete: after it, the evidence that these were findings
    // is gone from disk, and the remote twins are identified by id.
    const clearedIds = new Set(scan.findings.map((r) => r.marker?.id).filter((id) => typeof id === 'string'));
    const removed = clearStale(scan);
    for (const p of removed) console.log(`     cleared ${p}`);
    // THE SIBLING ARM, WRITTEN AT THE SAME TIME AS THE ONE ABOVE IT. A local
    // clear that leaves the origin copy standing turns the next scan back into
    // the same finding, which is how a permanent false alarm is born and how
    // `--clear-stale` becomes a ritual. The remote ref cannot be deleted here
    // (403, every namespace), so the ENTRY is removed from the host's tree.
    const remote = await clearRemoteStale({ root: ROOT, scan, alsoIds: clearedIds });
    for (const p of remote.removed) console.log(`     cleared ${p}  (on ${syncRemoteFor()})`);
    if (!remote.ok) {
      console.log(`     !! could not clear the origin copy: ${String(remote.error)}`);
      console.log('        The record is still on origin and will be reported again.');
    }
    if (has('--no-remote') && removed.length > 0) {
      console.log('     !! --no-remote: the ORIGIN copy of each record above was left standing,');
      console.log('        so the next scan without --no-remote will report it again.');
    }
    // CLEARING IS NOT RESOLVING, and the exit code says so: the findings were
    // real, they were read, and the record of them is now gone. The next run
    // starts clean; this one still reports what it found.
    console.log(
      `     ${removed.length + remote.removed.length} record(s) removed. A LIVE marker is never among them.`,
    );
  }
  return findingCount(scan) > 0 ? 1 : 0;
}

/**
 * WHAT THE SYNC DID, ON EVERY RUN, WHETHER OR NOT IT WORKED.
 *
 * A network call can fail, and this one is allowed to: it must never fail the
 * verification it is recording. What it may not do is fail quietly, because a
 * run whose record never left this machine is a run whose record dies with the
 * tree — and that is indistinguishable, afterwards, from a run nobody started.
 */
function reportSyncOutcome(syncStatus, markerPath) {
  if (syncStatus.ok > 0) {
    console.error(
      `watchdog: verify record synced ${syncStatus.ok}/${syncStatus.attempts} time(s) to ${syncRemoteFor()}`
        + ` (${VERIFY_SYNC.REF_PREFIX}/<host>) — it survives this tree`,
    );
    return;
  }
  console.error(`\n!! WATCHDOG: this run's verify record NEVER reached ${syncRemoteFor()}.`);
  console.error(`   ${syncStatus.attempts} heartbeat(s) tried; last error: ${String(syncStatus.lastError)}`);
  console.error(`   ${markerPath} is the ONLY copy. A rewind takes .gauntlet/verify/ with it,`);
  console.error('   so if this tree goes back, this verification leaves no trace at all — which');
  console.error('   is the silent absence the marker exists to remove. The verification itself');
  console.error('   is unaffected; its exit code below is the command\'s own.');
}

async function budget() {
  const seconds = Number(valueOf('--budget'));
  const sep = argv.indexOf('--');
  const command = sep === -1 ? [] : argv.slice(sep + 1);
  if (!Number.isFinite(seconds) || seconds <= 0 || command.length === 0) {
    console.error('usage: node tools/watchdog.mjs --budget <seconds> [--label <name>] -- <command...>');
    return 2;
  }

  const startedAt = Date.now();
  // ---------------------------------------------------------------------
  // BEFORE THE SPAWN. Nothing may go between this and the `spawn` below: a
  // marker written after the command returns is exactly the artifact that
  // vanishes when the container does, which is incident 1 in
  // `verifyMarker.mjs`'s header. `tools/verifyMarker.test.ts` proves the
  // ordering by having the WRAPPED COMMAND read the marker directory.
  // ---------------------------------------------------------------------
  const { markerPath } = beginMarker({
    root: ROOT,
    command,
    budgetSeconds: seconds,
    label: valueOf('--label', null),
    nowMs: startedAt,
  });

  // `detached` so the kill reaches the whole group: vitest and playwright both
  // fork, and killing only the parent leaves the children holding the terminal,
  // which is the silent version of the failure this file is about.
  const child = spawn(command[0], command.slice(1), { stdio: 'inherit', detached: true });

  // ---------------------------------------------------------------------
  // DURING THE RUN, NOT AT THE END OF IT.
  //
  // The local marker survives a container restart and does NOT survive a tree
  // death, which is this environment's dominant failure — seventeen against
  // zero. Origin is the only thing that has ever survived one. So the record is
  // pushed on a heartbeat while the command is still running.
  //
  // A COMPLETION-TIME PUSH WOULD BE THE ORIGINAL DEFECT ONE LEVEL OUT: a run
  // that dies mid-flight is exactly the run that never reaches its completion
  // step. That is the same argument that puts `beginMarker` above the spawn
  // rather than below the await, and it is why the first push is fired HERE,
  // one statement after the spawn, instead of being awaited before it — the
  // command must not wait on a network round trip, and the push must not wait
  // on the command.
  // ---------------------------------------------------------------------
  const syncStatus = { attempts: 0, ok: 0, pending: 0, lastError: null, wasOk: null };
  const intervalSeconds = syncIntervalSecondsFor();
  let syncChain = Promise.resolve();
  const queueSync = (reason) => {
    syncStatus.pending += 1;
    syncChain = syncChain.then(async () => {
      const outcome = await heartbeatMarker(markerPath, { root: ROOT, reason });
      syncStatus.attempts += 1;
      if (outcome.ok) syncStatus.ok += 1;
      else syncStatus.lastError = outcome.result?.error ?? outcome.error ?? 'unknown';
      // NOT SILENT, AND NOT SPAM. The first failure is announced when it
      // happens, and so is a recovery, so a reader watching the log learns that
      // this run's durable record stopped arriving at the moment it stopped.
      if (syncStatus.wasOk !== outcome.ok) {
        if (!outcome.ok) {
          console.error(`watchdog: verify record did NOT reach ${syncRemoteFor()} — ${String(syncStatus.lastError)}`);
        } else if (syncStatus.wasOk === false) {
          console.error(`watchdog: verify record reached ${syncRemoteFor()} again`);
        }
        syncStatus.wasOk = outcome.ok;
      }
    }).catch((error) => {
      // A SYNC FAILURE MUST NOT FAIL THE VERIFICATION IT IS RECORDING. Anything
      // that escapes `heartbeatMarker` is a programming error in this file, so
      // it is printed rather than swallowed — but it never reaches the exit code.
      syncStatus.lastError = String(error).slice(0, 200);
      console.error(`watchdog: verify sync threw and was contained — ${syncStatus.lastError}`);
    }).finally(() => {
      syncStatus.pending -= 1;
    });
    return syncChain;
  };
  let syncTimer = null;
  if (syncEnabled()) {
    void queueSync('start');
    syncTimer = setInterval(() => {
      // A heartbeat that queues behind a slow one would stack round trips on a
      // struggling network. It skips instead; the next tick tries again.
      if (syncStatus.pending === 0) void queueSync('heartbeat');
    }, intervalSeconds * 1000);
  }

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }, seconds * 1000);

  const outcome = await new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal, spawnError: null }));
    child.on('error', (error) => resolve({ code: null, signal: null, spawnError: error }));
  });
  clearTimeout(timer);
  if (syncTimer !== null) clearInterval(syncTimer);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  /**
   * FOUR ARMS, ONE WRITER.
   *
   * One arm is a verdict and three are interruptions, and the split is the
   * ruling's: a FAILING run is a completed verification and its FAIL is written
   * into the marker, because a red suite is loud and gets read. A run that was
   * killed — by the budget, by somebody else's signal, or by never starting at
   * all — leaves the status INCOMPLETE, because its result is UNKNOWN and an
   * unknown result must never read as a pass.
   *
   * They are computed as one table and written once rather than as four
   * `finishMarker` calls, so a fifth arm cannot be added with the write
   * forgotten on it. That is this repository's most-repeated defect — a guard
   * written for one arm and not for the sibling immediately below it — removed
   * by construction rather than by remembering.
   */
  const patch = outcome.spawnError !== null
    ? { status: VERIFY_MARKER.STATUS.INCOMPLETE, interruption: VERIFY_MARKER.INTERRUPTION.COULD_NOT_START, detail: String(outcome.spawnError).slice(0, 200) }
    : timedOut && outcome.signal !== null
      ? { status: VERIFY_MARKER.STATUS.INCOMPLETE, interruption: VERIFY_MARKER.INTERRUPTION.BUDGET_EXCEEDED, detail: `SIGKILLed after ${elapsed}s against a ${seconds}s budget` }
      : outcome.signal !== null
        ? { status: VERIFY_MARKER.STATUS.INCOMPLETE, interruption: VERIFY_MARKER.INTERRUPTION.SIGNAL, detail: `killed by ${outcome.signal}` }
        : { status: outcome.code === 0 ? VERIFY_MARKER.STATUS.PASS : VERIFY_MARKER.STATUS.FAIL, exitCode: outcome.code };
  /**
   * A DRAIN OF IN-FLIGHT HEARTBEATS USED TO SIT HERE AND WAS DELETED, RECORDED
   * RATHER THAN QUIETLY REMOVED (CLAUDE.md, "a new rule can make an old one
   * vacuous").
   *
   * It was written to stop a heartbeat that began before the verdict from
   * writing its stale INCOMPLETE snapshot over a real PASS. `heartbeatMarker`
   * now re-reads the record after its push and writes only its own `sync`
   * field, which makes that impossible whatever the call ordering — so the
   * drain could not be reddened by any edit: remove it and the re-read still
   * saves the verdict; remove the re-read and the drain does not, because the
   * heartbeat's own push of the pre-verdict state happens at the same instant
   * either way. It was strictly dominated AND it cost up to
   * `TOTAL_TIMEOUT_SECONDS` of delay before the verdict was written down.
   * Two checks where one can never speak is the shape the standing rule bans.
   */
  finishMarker(markerPath, patch);

  // THE FINAL SYNC IS THE LEAST IMPORTANT ONE, and saying so is the point. It
  // carries the verdict to origin so the record stops being a finding there —
  // but every argument for this mechanism is about the runs that never get
  // here. The heartbeats above are the load-bearing half.
  if (syncEnabled()) {
    await queueSync('final');
    reportSyncOutcome(syncStatus, markerPath);
  } else {
    console.error(
      `watchdog: verify sync OFF (${VERIFY_SYNC.ENV_REMOTE}=${VERIFY_SYNC.DISABLED}) — this record is LOCAL ONLY`,
    );
  }

  if (outcome.spawnError !== null) {
    console.error(`watchdog: could not start ${command[0]} — ${String(outcome.spawnError)}`);
    console.error(`   the verification did not run; its marker stays INCOMPLETE: ${markerPath}`);
    return 2;
  }
  if (timedOut && outcome.signal !== null) {
    console.error(`\n!! WATCHDOG: killed after ${elapsed}s, budget was ${seconds}s`);
    console.error(`   command: ${command.join(' ')}`);
    console.error('   The process group was SIGKILLed. This is a loud failure on purpose:');
    console.error('   a run that stops producing must not look like a run that is still going.');
    console.error(`   marker left INCOMPLETE: ${markerPath}`);
    return 124;
  }
  if (outcome.signal !== null) {
    console.error(`\n!! WATCHDOG: ${command.join(' ')} was killed by ${outcome.signal} after ${elapsed}s`);
    console.error('   That is not this budget — something else killed it. No verdict exists,');
    console.error(`   so the marker stays INCOMPLETE: ${markerPath}`);
    return outcome.code ?? 1;
  }
  console.error(`watchdog: ${command.join(' ')} finished in ${elapsed}s (budget ${seconds}s)`);
  console.error(`watchdog: marker ${patch.status} — ${markerPath}`);
  return outcome.code ?? 1;
}

const mode = has('--branches') ? branches : has('--markers') ? markers : has('--budget') ? budget : null;
if (mode === null) {
  console.error('usage:');
  console.error('  node tools/watchdog.mjs --branches [--stale-minutes N]');
  console.error('  node tools/watchdog.mjs --markers [--clear-stale] [--no-remote]');
  console.error('  node tools/watchdog.mjs --budget <seconds> [--label <name>] -- <command...>');
  process.exit(2);
}
process.exit(await mode());
