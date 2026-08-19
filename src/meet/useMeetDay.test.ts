/**
 * useMeetDay.test.ts — MEET DAY IS WIRED TO THE APP'S ROW, and there is no
 * second channel round it. Plus what happens to a refused submission.
 *
 * ===========================================================================
 * WHY THIS FILE GREW A BAN LIST, AND WHY IT IS NOT A NEW IDEA
 * ===========================================================================
 * `src/session/sessionWiring.test.ts` has banned six names from `useSession.ts`
 * since the daily loop's boundary was fixed, and calls them "exactly what the
 * bypass was made of". `useMeetDay.ts` contained FIVE OF THOSE SIX, plus the
 * meet analogue of the sixth, and this file had zero matches for any of them.
 *
 * Same bypass, one hook over, guarded in one place and assumed in the other —
 * which is how it survived six waves and 2603 green tests:
 *
 *     const recordRef = useRef<ServerRecord>(
 *       frozen ? previewServerRecord() : newServerRecord(SIGNUP_DAY));
 *
 * A stored row of its own, built on mount, never told about a training session.
 * So `bestE1rmKg` was the signup seed on day 1 and on day 400, `totalKg` was
 * always `null` (FIRST TOTAL after every meet a player would ever lift),
 * `meets` was always empty (GDD §6.3's `isPrAttempt` permanently false — the
 * document calls that "The Real Tension"), and `MEET_ALREADY_RECORDED` could
 * not fire.
 *
 * ===========================================================================
 * THE BAN LIST IS READ OUT OF ITS SIBLING, NOT COPIED
 * ===========================================================================
 * A hand-copied second list is the same defect one level out: add a seventh
 * name to the session hook's list and the meet hook keeps whatever it had. So
 * `bannedFromUseSession()` parses the array out of `sessionWiring.test.ts` and
 * this file applies it here as well, with its own additions on top. The scan is
 * paired with controls, because a parser that has stopped matching passes every
 * file.
 *
 * ===========================================================================
 * WHAT A SOURCE SCAN IS WORTH HERE
 * ===========================================================================
 * `useMeetDay` is a React hook and this repository has no renderer in its test
 * environment — `vitest.config.ts` is `environment: node`. Standing one up is a
 * different piece of work. SO THIS IS A SOURCE SCAN AND IT SAYS SO: it can show
 * the hook has no way to a row, and it cannot show what the screen draws.
 *
 * THAT HALF IS NOT MISSING ANY MORE, AND IT IS THE DECISIVE ONE.
 * `tools/verify-shell-route.mjs` plays a real session with a mouse on the
 * shipped route, reads the e1RM off the close-out, presses DONE, presses MEET
 * DAY, confirms the weigh-in, and asserts the opener drawn is `suggestOpener` of
 * that number — with a non-vacuity control saying the two candidate answers
 * differ. On the tree before this fix it failed at 124.6 kg trained / 110.0 kg
 * implied / 107.5 kg drawn, 107.5 being 0.9 x the signup seed.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HOOK_PATH = fileURLToPath(new URL('./useMeetDay.ts', import.meta.url));
const SOURCE = readFileSync(HOOK_PATH, 'utf8');

const SERVER_PATH = fileURLToPath(new URL('../game/meetServer.ts', import.meta.url));
const SESSION_WIRING_PATH = fileURLToPath(
  new URL('../session/sessionWiring.test.ts', import.meta.url),
);

/** Strips comments and string literals, so only real code is scanned. */
function codeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

const CODE = codeOnly(SOURCE);

/**
 * The names `sessionWiring.test.ts` forbids `useSession.ts`, read out of that
 * file rather than restated here.
 *
 * Anchored on the `for (const banned of [` that introduces the list, so a
 * different array in the same file cannot answer.
 */
function bannedFromUseSession(): readonly string[] {
  const text = readFileSync(SESSION_WIRING_PATH, 'utf8');
  const at = text.indexOf('for (const banned of [');
  if (at < 0) throw new Error('useMeetDay.test: sessionWiring.test.ts no longer declares its ban list where expected');
  const end = text.indexOf(']', at);
  if (end < 0) throw new Error('useMeetDay.test: sessionWiring.test.ts ban list has no terminator');
  return [...text.slice(at, end).matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1] ?? '');
}

/**
 * Every member of `MeetServerErrorCode`, read out of the module that declares
 * it.
 *
 * A TYPE UNION HAS NO RUNTIME VALUE, so this is a source scan of the union's own
 * declaration rather than an import.
 *
 * COMMENTS ARE STRIPPED BEFORE THE TERMINATOR IS LOOKED FOR, not after: every
 * arm of that union carries a doc comment and several contain a semicolon, so
 * searching the raw text for `;` ends the declaration inside prose and finds
 * half the codes. The control assertion at the call site is what caught that.
 */
function meetServerErrorCodes(): readonly string[] {
  const source = readFileSync(SERVER_PATH, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const start = source.indexOf('export type MeetServerErrorCode =');
  if (start < 0) throw new Error('useMeetDay.test: MeetServerErrorCode is not declared where expected');
  const end = source.indexOf(';', start);
  if (end < 0) throw new Error('useMeetDay.test: MeetServerErrorCode has no terminator');
  return [...source.slice(start, end).matchAll(/'([A-Z_]+)'/g)].map((match) => match[1] ?? '');
}

// ---------------------------------------------------------------------------
// The scans can see what they are looking for
// ---------------------------------------------------------------------------

describe('the scans can see what they are looking for', () => {
  it('strips comments and keeps code', () => {
    expect(codeOnly('// recordRef.current\nconst a = 1;')).not.toMatch(/recordRef/);
    expect(codeOnly('const b = recordRef.current;')).toMatch(/recordRef/);
  });

  it('reads the real hook', () => {
    expect(CODE.length).toBeGreaterThan(1000);
  });

  it('the sibling’s ban list parses, and it is the list this file thinks it is', () => {
    const banned = bannedFromUseSession();
    // The control. A parser that has stopped matching returns [] and every ban
    // below passes vacuously — which is exactly the failure mode this whole
    // file exists to close, so it gets a check of its own.
    expect(banned.length).toBeGreaterThanOrEqual(6);
    expect(banned).toContain('ServerRecord');
    expect(banned).toContain('newServerRecord');
    expect(banned).toContain('recordRef');
  });
});

// ---------------------------------------------------------------------------
// IN: the meet is built from the cache, behind the app's one port
// ---------------------------------------------------------------------------

describe('useMeetDay has one source of truth, and it is not its own', () => {
  it('never names the stored server row — the same six the session hook may not', () => {
    for (const banned of bannedFromUseSession()) {
      expect(CODE, banned).not.toMatch(new RegExp(`\\b${banned}\\b`));
    }
  });

  it('and never names meet day’s own four, which the sibling list cannot know about', () => {
    for (const banned of [
      // The server body. A meet result goes through the PORT; calling this here
      // is the client writing a Total, which CLAUDE.md forbids outright.
      'applyMeetResult',
      // The fabricated debug row. This is the arm of the old ternary that made
      // the preview work and the live path lie.
      'previewServerRecord',
      // The mint of a `ProgressionSnapshot`. `progression.ts` §7.5 pins its
      // callers; the hook goes through `receiveSnapshot` like everything else.
      'receiveProgressionSnapshot',
      'applyServerSnapshot',
    ]) {
      expect(CODE, banned).not.toMatch(new RegExp(`\\b${banned}\\b`));
    }
  });

  it('takes a port and builds the meet from what came back through it', () => {
    for (const required of [
      'MeetServerPort',
      'serverPort',
      'openingCache',
      'meetDayFactsFromCache',
      'meetBrief',
      'recordMeetResult',
      'receiveSnapshot',
    ]) {
      expect(CODE, required).toMatch(new RegExp(`\\b${required}\\b`));
    }
  });

  it('the port is a REQUIRED parameter, so there is no default lifter to fall back to', () => {
    // An optional port with a default would typecheck at every call site and
    // would BE the fabricated record. The signature is the guard.
    expect(CODE).toMatch(/serverPort: MeetServerPort,/);
    expect(CODE).not.toMatch(/serverPort\?: /);
    expect(CODE).not.toMatch(/serverPort: MeetServerPort =/);
  });

  it('the meet is a REQUIRED parameter, so there is no default meet to fall back to', () => {
    // The port guard applied to its sibling parameter, mechanically (the
    // house rule: a guard written for one arm is applied to the arm beside
    // it). A `meet` with a `MEET_LOCAL` default would typecheck at every call
    // site and would BE Sprint 1c's deleted defect — the one ungated door,
    // where every meet a player opened was the one local and the calendar
    // decided nothing. The hook may not even IMPORT the local: the router
    // decides which meet is lifted, nothing in here does.
    expect(CODE).toMatch(/meet: MeetDefinition,/);
    expect(CODE).not.toMatch(/meet\?: /);
    expect(CODE).not.toMatch(/meet: MeetDefinition =/);
    expect(CODE).not.toMatch(/\bMEET_LOCAL\b/);
  });

  it('the response is applied in its own state change, so `pending` is renderable', () => {
    // The twin of the session hook's check. A synchronous propose-and-settle
    // inside one updater is what made the in-flight state — and every
    // `'projected'` reading built on it — a state nothing could ever draw.
    expect(CODE).toMatch(/recordMeetResult/);
    expect(CODE).toMatch(/\.then\(/);
  });
});

// ---------------------------------------------------------------------------
// OUT: what happens to a refused submission
// ---------------------------------------------------------------------------

describe('a refused meet submission is disclosed rather than dropped', () => {
  it('keeps the error instead of returning the cache unchanged and forgetting it', () => {
    expect(SOURCE).toContain('setSubmissionError(response.error)');
    // The exact line that used to be the whole handler.
    expect(SOURCE).not.toMatch(/if \(!result\.ok\) return current;/);
  });

  it('hands the error out of the hook, so a screen has something to read', () => {
    expect(SOURCE).toMatch(/readonly submissionError: MeetServerError \| null;/);
    expect(SOURCE).toMatch(/return \{[^}]*submissionError[^}]*\};/s);
  });

  it('and puts the cache back, so a refused meet does not read `projected` for ever', () => {
    // NEW WITH THE ASYNC ROUND TRIP, and it is a real hazard rather than
    // tidiness: the cache is moved to `pending` BEFORE the request goes out, so
    // a refusal that did not reject the proposal would leave every reading
    // permanently provisional — the screen showing an optimistic Total for a
    // meet the server declined to record.
    expect(SOURCE).toMatch(/rejectProposal\(current, proposalId\)/);
  });

  it('clears it on restart, so a fresh meet does not open holding the last refusal', () => {
    expect(SOURCE).toMatch(/const restart = useCallback\(\(\) => \{[\s\S]*?setSubmissionError\(null\);[\s\S]*?\}/);
  });

  it('does not retry: the meet is marked submitted BEFORE the call, not after', () => {
    const markIndex = SOURCE.indexOf('submittedRef.current = key;');
    const callIndex = SOURCE.indexOf('.recordMeetResult(');
    expect(markIndex).toBeGreaterThan(-1);
    expect(callIndex).toBeGreaterThan(-1);
    expect(markIndex).toBeLessThan(callIndex);
  });

  it('says at the site what the refusals are, so an editor of this file finds them', () => {
    // READ OFF `MeetServerErrorCode` RATHER THAN LISTED. This used to be a
    // hand-written array of six, which was complete on the day it was written
    // and silently incomplete the moment a seventh code was added — and two were
    // added. The union is the source; the disclosure has to cover all of it.
    const codes = meetServerErrorCodes();
    expect(codes.length).toBeGreaterThan(0);
    // The control: the scan must be finding the real union, not an empty match.
    expect(codes).toContain('UNSUPPORTED_MEET_UNIT');
    for (const code of codes) {
      expect(SOURCE, code).toContain(code);
    }
  });

  it('and says which one stopped being theoretical, because one did', () => {
    // `MEET_ALREADY_RECORDED` could not fire while the row was rebuilt per
    // mount. It can now, on the second meet of an app run, and the note at the
    // site has to say what the player sees — otherwise the next reader finds a
    // reachable refusal documented as impossible.
    expect(SOURCE).toMatch(/MEET_ALREADY_RECORDED[\s\S]{0,600}?REACHABLE/);
  });
});
