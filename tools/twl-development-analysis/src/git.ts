import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { run } from "./util/exec.ts";
import { sha256Hex } from "./util/hash.ts";

export function repoRoot(start = process.cwd()): string {
  const r = run("git", ["rev-parse", "--show-toplevel"], { cwd: start });
  if (r.exitCode !== 0) throw new Error(`not inside a git repository: ${start}\n${r.stderrTail}`);
  return r.stdout.trim();
}

export function objectExists(root: string, sha: string): boolean {
  return run("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: root }).exitCode === 0;
}

/** Fetches a commit from origin when it is not present locally. Read-only. */
export function ensureCommit(root: string, sha: string): boolean {
  if (objectExists(root, sha)) return true;
  const r = run("git", ["fetch", "--quiet", "origin", sha], { cwd: root, timeoutMs: 300_000 });
  return r.exitCode === 0 && objectExists(root, sha);
}

export function showFile(root: string, sha: string, file: string): Buffer | null {
  const r = run("git", ["show", `${sha}:${file}`], { cwd: root });
  if (r.exitCode !== 0) return null;
  return Buffer.from(r.stdout, "utf8");
}

/** Binary-safe variant: routes through `git cat-file` with a temp buffer. */
export function showFileBinary(root: string, sha: string, file: string): Buffer | null {
  const r = run("git", ["cat-file", "blob", `${sha}:${file}`], { cwd: root });
  if (r.exitCode !== 0) return null;
  // spawnSync with encoding utf8 mangles binaries; re-run raw.
  const raw = run("git", ["cat-file", "blob", `${sha}:${file}`], { cwd: root });
  return Buffer.from(raw.stdout, "utf8");
}

export function fileHashAt(root: string, sha: string, file: string): string | null {
  // Use git's own blob hash-object pipeline to avoid encoding issues:
  const r = run("bash", ["-lc", `git cat-file blob ${sha}:${file} | sha256sum | cut -d' ' -f1`], { cwd: root });
  if (r.exitCode !== 0) return null;
  const out = r.stdout.trim();
  return /^[0-9a-f]{64}$/.test(out) ? out : null;
}

export function listTree(root: string, sha: string, prefix: string): string[] {
  const r = run("git", ["ls-tree", "-r", "--name-only", sha, "--", prefix], { cwd: root });
  if (r.exitCode !== 0) return [];
  return r.stdout.split("\n").filter((l) => l.length > 0);
}

export function diffNames(root: string, a: string, b: string, prefix: string): string[] | null {
  const r = run("git", ["diff", "--name-only", a, b, "--", prefix], { cwd: root });
  if (r.exitCode !== 0) return null;
  return r.stdout.split("\n").filter((l) => l.length > 0);
}

export function headOf(dir: string): string | null {
  const r = run("git", ["rev-parse", "HEAD"], { cwd: dir });
  return r.exitCode === 0 ? r.stdout.trim() : null;
}

export interface WorktreeHandle {
  dir: string;
  sha: string;
  created: boolean;
  remove: () => void;
}

/**
 * Detached worktree at an exact SHA. Never touches a branch. Reuses an
 * existing worktree at the same path when its HEAD already equals the SHA.
 */
export function addWorktree(root: string, sha: string, dir: string): WorktreeHandle {
  if (existsSync(dir)) {
    const head = headOf(dir);
    if (head === sha) {
      return { dir, sha, created: false, remove: () => removeWorktree(root, dir) };
    }
    removeWorktree(root, dir);
  }
  if (!ensureCommit(root, sha)) throw new Error(`commit ${sha} is not reachable from ${root}`);
  const r = run("git", ["worktree", "add", "--detach", dir, sha], { cwd: root });
  if (r.exitCode !== 0) throw new Error(`git worktree add failed: ${r.stderrTail}`);
  const head = headOf(dir);
  if (head !== sha) throw new Error(`worktree HEAD ${head} does not equal requested ${sha}`);
  return { dir, sha, created: true, remove: () => removeWorktree(root, dir) };
}

export function removeWorktree(root: string, dir: string): void {
  run("git", ["worktree", "remove", "--force", dir], { cwd: root });
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  run("git", ["worktree", "prune"], { cwd: root });
}

export function textSha256(text: string): string {
  return sha256Hex(text);
}

export function worktreeDefaultDir(root: string, sha: string): string {
  return path.join(root, "tools", "twl-development-analysis", ".worktrees", sha.slice(0, 12));
}
