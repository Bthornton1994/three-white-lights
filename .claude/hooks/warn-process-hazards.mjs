#!/usr/bin/env node
/**
 * warn-process-hazards.mjs — a PreToolUse hook on the Bash tool that WARNS,
 * and never blocks, when a command reaches for one of two familiar-but-wrong
 * process shortcuts this box has already been burned by:
 *
 *   1. `pkill -f` / `pgrep -f` — name patterns match WHOLE COMMAND LINES, and
 *      four sessions on this host run the same command lines. A measured
 *      incident: `pkill -f "evidence.mjs suite"` killed another session's
 *      twelve-minute run along with its own. `pgrep -f` has twice matched the
 *      invoking shell itself (pgrep excludes its own pid, not its parent's).
 *   2. bare `expo start` — skips `tools/dev-web.sh`, which copies
 *      canvaskit.wasm (a bare server fails loudly in a fresh worktree) and
 *      passes `--clear` (without it Metro serves the PREVIOUS build, which
 *      fails silently into wrong evidence).
 *
 * WHY WARN-ONLY IS DELIBERATE AND NOT TIMIDITY: a blocking hook with any
 * false positive trains bypass, which is the same defect one level out. So
 * this script exits 1 (Claude Code's non-blocking arm: stderr is shown, the
 * command still runs) on a match, 0 otherwise, and NEVER 2 (the blocking
 * arm). Any internal error — unreadable stdin, unexpected payload shape —
 * exits 0, so a bug here can never accidentally block anything.
 *
 * COVERAGE, declared: this fires only in Claude Code sessions that load
 * `.claude/settings.json` (Sessions C and D run other harnesses and never see
 * it). The sentinel gate in `tools/devServerSentinel.mjs` is the half that
 * covers everyone, because it lives in the tools themselves. This hook is
 * cheap insurance in front of it, not the mechanism.
 *
 * PATTERNS ARE KEPT NARROW ON PURPOSE: a hook that fires on unrelated
 * commands gets ignored, which is the crying-wolf failure CLAUDE.md records
 * for three instruments. Known accepted misses (warn-only makes them cheap):
 * a short-flag cluster like `pkill -ef`, and an `expo start` reached through
 * an interpreter (`sh -c "npx expo start"`). Known accepted fire: `pgrep -f
 * vitest` before a full suite — CLAUDE.md recommends that command, and the
 * warning's self-match caveat is true of it too.
 *
 * This file is driven both ways by `tools/processHazardHook.test.ts`.
 */
import { readFileSync } from 'node:fs';

const EXIT = Object.freeze({
  /** No hazard, or any internal error: stay silent, never block. */
  SILENT: 0,
  /** Claude Code's non-blocking arm: stderr shown, command still runs. */
  WARN: 1,
});

const WARNING_HEADER = '[warn-process-hazards hook — WARNING ONLY, the command still runs]';

const HAZARDS = Object.freeze([
  Object.freeze({
    name: 'name-pattern-process-match',
    // `pkill`/`pgrep` with `-f`/`--full`, allowing flags in between
    // (`pkill -9 -f x`). Does not match `pgrep vitest` or `pkill -x expo`.
    pattern: /\b(?:pkill|pgrep)\s+(?:-[A-Za-z0-9]+\s+)*-{1,2}f(?:ull)?\b/,
    warning:
      `${WARNING_HEADER}\n`
      + '`pkill -f` / `pgrep -f` match WHOLE COMMAND LINES. Four sessions share this\n'
      + "box and run the same command lines, so the match set can include another\n"
      + "session's processes and your own invoking shell (CLAUDE.md: \"pkill -f IS A\n"
      + 'CROSS-SESSION WEAPON\"). Supported paths: kill by PID, or tools/dev-web.sh,\n'
      + 'which kills its dev server by listening port.',
  }),
  Object.freeze({
    name: 'bare-expo-start',
    // `expo start` in command position — start of command, or after ; & | (,
    // through optional `nohup`, env assignments, and `npx` — so prose like
    // `grep 'expo start' file` does not fire.
    pattern:
      /(?:^|[;&|(]\s*)(?:nohup\s+)?(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*(?:npx\s+(?:-\S+\s+)*)?expo\s+start\b/m,
    warning:
      `${WARNING_HEADER}\n`
      + 'Bare `expo start` skips the canvaskit.wasm copy (loud failure in a fresh\n'
      + "worktree) and Metro's --clear (silent one: captures photograph the PREVIOUS\n"
      + 'build). Supported path: PORT=<port> tools/dev-web.sh (CLAUDE.md: "START THE\n'
      + 'DEV SERVER WITH tools/dev-web.sh").',
  }),
]);

let exitCode = EXIT.SILENT;
try {
  const payload = JSON.parse(readFileSync(0, 'utf8'));
  const toolName = payload?.tool_name;
  const command = payload?.tool_input?.command;
  if ((toolName === undefined || toolName === 'Bash') && typeof command === 'string') {
    for (const hazard of HAZARDS) {
      if (hazard.pattern.test(command)) {
        console.error(hazard.warning);
        exitCode = EXIT.WARN;
      }
    }
  }
} catch {
  exitCode = EXIT.SILENT;
}
process.exit(exitCode);
