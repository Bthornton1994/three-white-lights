/**
 * Node module-resolution hook used ONLY to read the target's TypeScript
 * sources in a throwaway worktree. Session A files import siblings without an
 * extension (Vite resolves them; Node ESM does not). This hook retries a
 * failed relative resolution with `.ts`, `.tsx`, `.mts` or `/index.ts`.
 *
 * It never rewrites, transpiles beyond Node's own type stripping, or writes
 * anything to disk.
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const RELATIVE = /^(\.\.?\/|\/|file:)/;
const RETRY_CODES = new Set(["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"]);

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (!RETRY_CODES.has(err?.code) || !RELATIVE.test(specifier)) throw err;
    const base = context.parentURL ? new URL(specifier, context.parentURL) : new URL(specifier);
    const p = fileURLToPath(base);
    for (const cand of [`${p}.ts`, `${p}.tsx`, `${p}.mts`, `${p}/index.ts`]) {
      if (existsSync(cand) && statSync(cand).isFile()) {
        return nextResolve(pathToFileURL(cand).href, context);
      }
    }
    throw err;
  }
}
