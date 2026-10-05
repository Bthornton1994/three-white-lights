/**
 * processHazardHook.test.ts — the warn-only PreToolUse hook, driven both ways.
 *
 * WHY THIS FILE IS IN `tools/` AND NOT BESIDE ITS SUBJECT: the subject lives
 * in `.claude/hooks/`, which vitest's include globs do not reach — and
 * `tsconfig.json` compiles `**‍/*.ts`, so a `.test.ts` there would be compiled
 * by tsc, run by nothing, and go red on `progression.test.ts`'s "drops from
 * the sweep exactly the files vitest runs". Same reasoning as
 * `claudeIndex.test.ts`'s header.
 *
 * EVERY CHECK DRIVES THE REAL SCRIPT AS A SUBPROCESS with the same stdin JSON
 * Claude Code hands a PreToolUse hook — the argument surface a harness
 * actually uses, not the functions behind it (the `verifyMarker.test.ts`
 * pattern).
 *
 * WHAT THIS FILE CANNOT COVER, declared: that a live Claude Code session
 * actually invokes the hook. Hook configuration is captured at session start,
 * so the session that lands this change cannot observe its own settings edit
 * firing; the wiring is pinned structurally below (settings.json names the
 * script, the script exists) and the first restarted session is the live
 * check. It also covers only Claude Code sessions at all — Sessions C and D
 * run other harnesses; the sentinel gate in `tools/devServerSentinel.mjs` is
 * the half that covers everyone.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(REPO_ROOT, '.claude', 'hooks', 'warn-process-hazards.mjs');
const SETTINGS = path.join(REPO_ROOT, '.claude', 'settings.json');

/** Exit codes the hook contract fixes: 0 silent, 1 warn, 2 would BLOCK and is banned. */
const EXIT_SILENT = 0;
const EXIT_WARN = 1;
const EXIT_BLOCK = 2;

function runHook(stdin: string): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync('node', [HOOK], { input: stdin, encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

function bashPayload(command: string): string {
  return JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
}

describe('commands that must warn', () => {
  // Each case is the harmless form of a real incident: the pkill one is the
  // literal command that killed another session's run, the pgrep one is the
  // brief's own harmless probe, the expo ones are the shapes Session A ran a
  // whole session of re-takes with. Reddens on: a pattern narrowed past the
  // incident it exists for.
  const FIRES: readonly string[] = [
    'pkill -f "evidence.mjs suite"',
    'pgrep -f zz-nonexistent-zz',
    'pkill -9 -f expo',
    'pkill --full "expo start"',
    'npx expo start --web --port 8097',
    'PORT=8097 npx expo start --web',
    'expo start',
    'cd /somewhere && npx expo start',
    'nohup npx expo start --web --port 8081 --offline > /tmp/log 2>&1 &',
  ];

  for (const command of FIRES) {
    it(`warns on: ${command}`, () => {
      const { status, stderr } = runHook(bashPayload(command));
      expect(status).toBe(EXIT_WARN);
      expect(stderr).toContain('WARNING ONLY');
      // Every warning names a supported path, so the warn is a redirect and
      // not a scold. Reddens on: warning text losing the named alternative.
      expect(/kill by PID|tools\/dev-web\.sh/.test(stderr)).toBe(true);
    });
  }

  // The two hazards are distinct warnings, not one blob — reddens on the
  // pkill warning losing the PID path or the expo warning losing the script.
  it('the pkill warning names kill-by-PID and the expo warning names dev-web.sh', () => {
    const pkill = runHook(bashPayload('pkill -f foo')).stderr;
    expect(pkill).toContain('kill by PID');
    expect(pkill).toContain('tools/dev-web.sh');
    const expo = runHook(bashPayload('npx expo start')).stderr;
    expect(expo).toContain('tools/dev-web.sh');
    expect(expo).toContain('--clear');
  });
});

describe('commands that must stay silent (the crying-wolf control)', () => {
  // A hook that fires on unrelated commands gets ignored, which unbuilds the
  // mechanism. Reddens on: a pattern widened until ordinary commands trip it.
  const SILENT: readonly string[] = [
    'ls -la',
    'pgrep vitest', // no -f: matches process names only, the safe form
    'pkill -x expo', // exact-name match, not a command-line pattern
    "grep 'expo start' tools/dev-web.sh", // prose position, not command position
    'PORT=8097 tools/dev-web.sh', // the supported path itself
    'node tools/watchdog.mjs --branches',
    'git log --oneline -1',
  ];

  for (const command of SILENT) {
    it(`stays silent on: ${command}`, () => {
      const { status, stderr } = runHook(bashPayload(command));
      expect(status).toBe(EXIT_SILENT);
      expect(stderr).toBe('');
    });
  }
});

describe('the hook can never block', () => {
  // Exit 2 is Claude Code's BLOCKING arm. The contract is warn-only, so no
  // input — well-formed, torn, or hostile — may produce it. Reddens on: an
  // unhandled throw (node exits 1 with a stack trace on the hazard-free arm,
  // or worse) or someone "promoting" the hook to blocking.
  const NEVER_BLOCKS: readonly string[] = [
    bashPayload('pkill -f everything'),
    bashPayload('ls'),
    'this is not JSON at all',
    '{}',
    JSON.stringify({ tool_name: 'Read', tool_input: { file_path: '/x' } }),
    JSON.stringify({ tool_name: 'Bash', tool_input: {} }),
  ];

  for (const stdin of NEVER_BLOCKS) {
    it(`never exits ${EXIT_BLOCK} on stdin: ${stdin.slice(0, 40)}`, () => {
      const { status } = runHook(stdin);
      expect(status).not.toBe(EXIT_BLOCK);
    });
  }

  // Torn input and non-Bash tools are silence, not noise — reddens on the
  // catch arm turning parse failures into warnings.
  it('torn stdin and non-Bash tools exit silent', () => {
    expect(runHook('not json').status).toBe(EXIT_SILENT);
    expect(runHook(JSON.stringify({ tool_name: 'Read', tool_input: { command: 'pkill -f x' } })).status).toBe(
      EXIT_SILENT,
    );
  });
});

describe('the wiring in .claude/settings.json', () => {
  // Reddens on: the settings file being clobbered, the matcher widening past
  // Bash, or the command drifting away from the script that exists. This pins
  // structure, not live firing — the header declares that limit.
  it('registers exactly this script as a PreToolUse hook on the Bash tool', () => {
    const settings = JSON.parse(readFileSync(SETTINGS, 'utf8')) as {
      hooks?: { PreToolUse?: { matcher?: string; hooks?: { type?: string; command?: string }[] }[] };
    };
    const entries = settings.hooks?.PreToolUse ?? [];
    const bashEntries = entries.filter((entry) => entry.matcher === 'Bash');
    expect(bashEntries.length).toBe(1);
    const commands = (bashEntries[0]?.hooks ?? []).map((hook) => hook.command ?? '');
    expect(commands.some((command) => command.includes('warn-process-hazards.mjs'))).toBe(true);
    expect(existsSync(HOOK)).toBe(true);
  });
});
