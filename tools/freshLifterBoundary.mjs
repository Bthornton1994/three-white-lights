/**
 * freshLifterBoundary.mjs — what "a goto is a new lifter" costs since Sprint 2.
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY BROWSER TOOL NEEDS THIS, DATED SO THE REASON DOES NOT READ AS LORE
 * ---------------------------------------------------------------------------
 * Until Sprint 2 (f768161), `appServer.ts`'s own header said "NOTHING IS
 * PERSISTED. A reload still starts a fresh lifter", and every browser tool in
 * this directory was written on top of that sentence: `verify-shell-route.mjs`
 * counts app runs on the premise that each `goto` starts one, and
 * `verify-cutin-cap.mjs`'s second leg chooses its meet as if the first leg's
 * results do not exist. Sprint 2 made the sentence false — the server now
 * writes a save into `localStorage` after every accepted mutation and reads it
 * back on boot — so WITHOUT this module every second `goto` in the same
 * browser context resumes the previous boot's lifter: entered meets refuse
 * re-entry, the check-in becomes the already-trained surface, and 387 green
 * checks quietly change subject.
 *
 * The boundary the tools assumed must now be MADE, not assumed. That is all
 * this module does.
 *
 * ---------------------------------------------------------------------------
 * TWO ARMS OF ONE RULE, AND WHICH TOOL TAKES WHICH
 * ---------------------------------------------------------------------------
 * - `armFreshLifterPerBoot(context)` — every document load in the context
 *   clears the app's namespace BEFORE the app can read it. For tools where
 *   every boot means a fresh lifter, with no exceptions — which is every tool
 *   except the one below. Arm it once, right after `newContext`, and a future
 *   `goto` added to the tool inherits the boundary instead of the leak.
 * - `clearSavedLifter(page)` — the imperative arm, for the ONE tool that owns
 *   a deliberate persistence check: `verify-shell-route.mjs` clears at its own
 *   `open()` boundary and leaves `page.reload()` untouched, because "the save
 *   survives a reload" is a section there and an init script that clears on
 *   every load would delete the subject before reading it.
 *
 * Do not arm both in one tool: the init script would silently win, and the
 * reload section would photograph a fresh lifter while its prose claims a
 * resumed one.
 *
 * ---------------------------------------------------------------------------
 * THE PREFIX IS A COPY OF A LITERAL IN `src/shell/appServer.ts`, AND A TEST
 * PINS THE TWO TOGETHER
 * ---------------------------------------------------------------------------
 * `SAVE_KEY` is `'three-white-lights.save'` and the quarantine keys extend it,
 * so clearing everything under `'three-white-lights.'` removes the save and
 * every quarantined refusal without touching the dev server's own storage.
 * If the app's key ever moves off this prefix, this module stops clearing
 * anything and every tool above silently measures resumed lifters again —
 * `shellWiring.test.ts` ('the tools' fresh-lifter boundary clears the key the
 * app saves under') reads both sources and goes red before that can happen.
 */

export const SAVE_NAMESPACE_PREFIX = 'three-white-lights.';

/** Serialisable body shared by both arms — runs inside the page. */
const CLEAR_SNIPPET = `(() => {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key !== null && key.startsWith(${JSON.stringify(SAVE_NAMESPACE_PREFIX)})) doomed.push(key);
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    // An opaque origin (about:blank) has no storage to clear.
  }
})()`;

/**
 * Clear the app's saved lifter on EVERY document load in the context, before
 * the app boots. For tools where a goto always means a fresh lifter.
 */
export async function armFreshLifterPerBoot(context) {
  await context.addInitScript(CLEAR_SNIPPET);
}

/**
 * Clear the app's saved lifter NOW, on the page's current origin. For
 * `verify-shell-route.mjs`'s `open()`, immediately before its `goto`, so a
 * deliberate `page.reload()` elsewhere in that tool still resumes the save.
 *
 * A page still on `about:blank` has nothing to clear and the snippet's catch
 * covers its opaque-origin storage access throwing.
 */
export async function clearSavedLifter(page) {
  await page.evaluate(CLEAR_SNIPPET);
}
