/**
 * sessionWiring.test.ts — the check that the app is wired to the boundary, and
 * that there is no second channel round it.
 *
 * WHY A SOURCE SCAN. The gap this suite exists to keep closed was not a wrong
 * number: every pure module was correct and every unit test was green. It was
 * that the SCREEN read from somewhere else. `progression.ts`'s read accessors had
 * zero non-test callers while `useSession` built the session out of the stored
 * server row and `CloseOutView` rendered figures the client had computed. No test
 * over pure functions can see that, because the functions were never wrong — they
 * were never called.
 *
 * This project has no DOM test runner (`vitest.config.ts` is `environment: node`
 * and the suite is `src/**\/*.test.ts`), so the same idiom
 * `sessionTuning.test.ts` uses for magic numbers is used here for wiring: read
 * the real sources and fail on the shapes that would put the bypass back. It is
 * WEAKER THAN RENDERING and this file does not pretend otherwise — what actually
 * renders is checked by `tools/verify-session-boundary.mjs`, which drives the
 * built app in a browser and reads the DOM.
 *
 * Every scan below is paired with a positive control, because a scan that has
 * stopped matching passes every file.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function source(file: string): string {
  return readFileSync(path.join(HERE, file), 'utf8');
}

/** Strips comments and string literals, so only real code is scanned. */
function codeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

const USE_SESSION = codeOnly(source('useSession.ts'));
const CLOSE_OUT = codeOnly(source('CloseOutView.tsx'));
const SCREEN = codeOnly(source('SessionScreen.tsx'));

describe('the scans can see what they are looking for', () => {
  it('strips comments and keeps code', () => {
    expect(codeOnly('// recordRef.current\nconst a = 1;')).not.toMatch(/recordRef/);
    expect(codeOnly('const b = recordRef.current;')).toMatch(/recordRef/);
    expect(codeOnly("const c = 'closeOut.newBestE1rmKg';")).not.toMatch(/newBestE1rmKg/);
  });

  it('the files it reads are the real ones', () => {
    expect(USE_SESSION.length).toBeGreaterThan(500);
    expect(CLOSE_OUT.length).toBeGreaterThan(500);
    expect(SCREEN.length).toBeGreaterThan(500);
  });
});

// ---------------------------------------------------------------------------
// IN: the session starts from the cache
// ---------------------------------------------------------------------------

describe('useSession has one source of truth', () => {
  it('never names the stored server row', () => {
    // These are exactly what the bypass was made of. The row lives behind
    // `SessionServerPort` now and the hook has no way to it.
    for (const banned of [
      'ServerRecord',
      'newServerRecord',
      'todayForLifter',
      'applyTrainingSession',
      'snapshotWireFor',
      'recordRef',
    ]) {
      expect(USE_SESSION, banned).not.toMatch(new RegExp(`\\b${banned}\\b`));
    }
  });

  it('builds the session from the cache, through sessionClient', () => {
    for (const required of [
      'openingCache',
      'sessionContextFrom',
      'todayFromCache',
      'submitCloseOut',
      'receiveSnapshot',
      'closeOutReadings',
    ]) {
      expect(USE_SESSION, required).toMatch(new RegExp(`\\b${required}\\b`));
    }
  });

  it('the response is applied in its own state change, so `pending` is renderable', () => {
    // A synchronous propose-and-settle inside one updater is what made the
    // in-flight state — and every `'projected'` reading built on it — a state
    // nothing could ever draw.
    expect(USE_SESSION).toMatch(/recordTrainingSession/);
    expect(USE_SESSION).toMatch(/\.then\(/);
  });
});

// ---------------------------------------------------------------------------
// OUT: the close-out prints what came back
// ---------------------------------------------------------------------------

describe('CloseOutView prints readings, not the client’s arithmetic', () => {
  it('never renders the close-out’s own numbers', () => {
    // The two fields the screen used to show. Both are still on
    // `SessionCloseOut` — the session machine computes them and the projection
    // is built from them — but this screen may not read either.
    expect(CLOSE_OUT).not.toMatch(/\bnewBestE1rmKg\b/);
    expect(CLOSE_OUT).not.toMatch(/\bstreakAfter\b/);
    expect(CLOSE_OUT).not.toMatch(/\bsessionE1rmKg\b/);
    expect(CLOSE_OUT).not.toMatch(/\bpreviousBestE1rmKg\b/);
  });

  it('reads the certainty and draws the four branches differently', () => {
    expect(CLOSE_OUT).toMatch(/\breadings\b/);
    expect(CLOSE_OUT).toMatch(/reading\.kind/);
    expect(CLOSE_OUT).toMatch(/streakDays\.kind/);
    expect(CLOSE_OUT).toMatch(/PROJECTED_OPACITY/);
    expect(CLOSE_OUT).toMatch(/PROJECTED_TAG/);
    expect(CLOSE_OUT).toMatch(/STALE_TAG/);
    // An absent number is an em dash, never a zero.
    expect(CLOSE_OUT).toMatch(/UNKNOWN_VALUE/);
  });

  it('has a first-class accessory branch (GDD §3.2, ruled)', () => {
    // The discriminant is a string literal, which `codeOnly` strips, so this one
    // reads the raw source. The rest of the branch is code.
    expect(source('CloseOutView.tsx')).toMatch(/'training-iq'/);
    expect(CLOSE_OUT).toMatch(/payoff\.kind/);
    expect(CLOSE_OUT).toMatch(/ACCESSORY_LABEL/);
    expect(CLOSE_OUT).toMatch(/pointsGained/);
  });

  it('shows no Total — GDD §3.2', () => {
    expect(CLOSE_OUT).not.toMatch(/[Tt]otal/);
    expect(CLOSE_OUT).not.toMatch(/readTotalKg/);
  });

  it('the PR call is the reading’s, not the close-out’s', () => {
    // `closeOut.isPr` is the client's prediction. The gold follows the record.
    expect(CLOSE_OUT).not.toMatch(/closeOut\.isPr/);
    expect(CLOSE_OUT).toMatch(/e1rm\.isPr/);
  });
});

describe('SessionScreen hands the readings down and computes nothing', () => {
  it('passes the loop’s readings to the close-out', () => {
    expect(SCREEN).toMatch(/readings=\{loop\.closeOutReadings\}/);
  });

  it('does not read the boundary itself', () => {
    for (const banned of ['readBestE1rmKg', 'readStreakDays', 'readTotalKg', 'snapshotFacts']) {
      expect(SCREEN, banned).not.toMatch(new RegExp(`\\b${banned}\\b`));
    }
  });
});

// ---------------------------------------------------------------------------
// The fatigue ledger (GDD §3.4, §12.3)
// ---------------------------------------------------------------------------

describe('no screen can reach the hidden ledger', () => {
  const SCREENS = [
    'BriefingView.tsx',
    'CheckInView.tsx',
    'CloseOutView.tsx',
    'RestView.tsx',
    'SessionScreen.tsx',
    'SetView.tsx',
  ];

  it('finds the screens at all', () => {
    // Without this the scan below passes vacuously on an empty list, which is
    // the shape of blind check this suite is meant not to have.
    for (const file of SCREENS) {
      expect(source(file).length, file).toBeGreaterThan(200);
    }
  });

  it('no .tsx names FatigueState or reads a `.fatigue`', () => {
    // §12.3 forbids a visible fatigue meter. A screen that can reach the ledger
    // can compute one; a screen that cannot, cannot. What screens get instead is
    // `SessionFeel`, which is qualitative and keeps its one number behind a
    // module-private symbol.
    for (const file of SCREENS) {
      const code = codeOnly(source(file));
      expect(code, file).not.toMatch(/\bFatigueState\b/);
      expect(code, file).not.toMatch(/\.fatigue\b/);
    }
  });

  it('exactly one module under src/session reads the ledger, and it is the port', () => {
    // `localSessionServer.ts` is where the row is, so it is the one place a
    // ledger is taken out of one — and it hands over `briefFatigueFor(...)`,
    // narrowed to the horizon, rather than the field.
    expect(codeOnly(source('localSessionServer.ts'))).toMatch(/briefFatigueFor\(record\.fatigue/);
    for (const file of ['useSession.ts', 'sessionPreview.ts', 'sessionPalette.ts']) {
      expect(codeOnly(source(file)), file).not.toMatch(/\.fatigue\b/);
    }
  });

  it('the ledger scan can see a ledger', () => {
    expect(codeOnly('const n = state.context.fatigue.sessions.length;')).toMatch(/\.fatigue\b/);
    expect(codeOnly('const f: FatigueState = x;')).toMatch(/\bFatigueState\b/);
  });
});
