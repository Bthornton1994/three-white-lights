/**
 * cutInWiring.test.ts — that the gate is actually WIRED, and that no screen can
 * route around it.
 *
 * ---------------------------------------------------------------------------
 * WHY A SOURCE SCAN
 * ---------------------------------------------------------------------------
 * This project has no DOM test runner: `vitest.config.ts` is `environment:
 * node` and the suite is `src/**\/*.test.ts`, so a `.tsx` cannot be rendered
 * here at all. `sessionWiring.test.ts` established the idiom for exactly this
 * problem and this file follows it — read the real sources and fail on the
 * shapes that would break the rule.
 *
 * IT IS WEAKER THAN RENDERING AND THIS FILE DOES NOT PRETEND OTHERWISE. What a
 * scan can prove is that the call is present and the handler is the right one.
 * What it cannot prove is that a tap on a phone reaches it, or that the
 * interrupt feels like an interrupt. GDD §12.1 is explicit that the second of
 * those was never automatable.
 *
 * EVERY SCAN BELOW IS PAIRED WITH A POSITIVE CONTROL, because a scan that has
 * stopped matching passes every file.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { withoutComments } from '../tuning/audit';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..');

function source(relPath: string): string {
  return readFileSync(path.join(SRC, relPath), 'utf8');
}

/** Comments blanked, string contents kept — a testID and a JSX prop are code. */
function code(relPath: string): string {
  return withoutComments(source(relPath));
}

const VIEW = code('cutin/CutInView.tsx');
const HOST = code('cutin/CutInHost.tsx');

/**
 * THE FOUR FIRING MOMENTS OF GDD §7.2, AND THE SCREEN THAT REPORTS EACH.
 *
 * Spelled out here rather than derived, so deleting a `useOfferCutIn` call from
 * any one of these screens turns this file red by name. A gate with no callers
 * is the same failure as an empty firing-moment list, one layer out.
 */
const CALLERS: readonly (readonly [string, string, string])[] = [
  ['third-attempt walk-out', 'meet/WalkoutView.tsx', "kind: 'meet-walkout'"],
  ['a PR at a meet', 'meet/RecapView.tsx', "kind: 'record'"],
  ['a PR in the daily loop', 'session/CloseOutView.tsx', "kind: 'record'"],
  ['bombing out', 'meet/BombOutView.tsx', "kind: 'meet-over'"],
  ['a coach reaction on a heavy set', 'session/RestView.tsx', "kind: 'work-set'"],
];

// ---------------------------------------------------------------------------
// The scans can see what they are looking for
// ---------------------------------------------------------------------------

describe('the scans are not blind', () => {
  it('strips comments and keeps code', () => {
    expect(withoutComments('// onPress={onDismiss}\n')).not.toMatch(/onDismiss/);
    expect(withoutComments('<X onPress={onDismiss} />')).toMatch(/onDismiss/);
  });

  it('reads the real files', () => {
    expect(VIEW.length).toBeGreaterThan(500);
    expect(HOST.length).toBeGreaterThan(500);
    for (const [, file] of CALLERS) {
      expect(source(file).length, file).toBeGreaterThan(500);
    }
  });
});

// ---------------------------------------------------------------------------
// SKIPPABILITY, at the view layer — GDD §7.2
// ---------------------------------------------------------------------------

describe('the cut-in is dismissed by tapping it — GDD §7.2', () => {
  it('THE PRESS HANDLER IS THE DISMISS HANDLER', () => {
    // The mutation this exists to catch is `onPress={() => {}}`, which type-
    // checks, renders identically, and makes the cut-in un-skippable.
    expect(VIEW).toMatch(/onPress=\{onDismiss\}/);
    // ...and there is no second, conditional press handler that could shadow it.
    expect(VIEW).not.toMatch(/onPress=\{\(\)\s*=>\s*\{\s*\}\}/);
    expect(VIEW).not.toMatch(/onPress=\{[^}]*\?[^}]*:[^}]*\}/);
  });

  it('THE WHOLE SCREEN IS THE TARGET, not a button in a corner', () => {
    expect(VIEW).toMatch(/<Pressable/);
    expect(VIEW).toMatch(/StyleSheet\.absoluteFill/);
  });

  it('says it is skippable, because a player has to know', () => {
    expect(VIEW).toMatch(/SKIP_HINT/);
    expect(VIEW).toMatch(/cut-in-skip-hint/);
  });

  it('the host really calls the gate’s dismiss, not just setLive(null)', () => {
    // `setLive(null)` alone would take the picture off screen and leave the
    // gate session holding a live cut-in for ever, which is a different bug
    // wearing the same appearance.
    expect(HOST).toMatch(/dismissCutIn\(session\.current\)/);
    expect(HOST).toMatch(/cutInAutoDismissMs\(\)/);
  });

  it('THE SCRIM IS ITS OWN LAYER, so its opacity is not overridden by the arrival', () => {
    // The defect this catches, which shipped: `styles.root` carried both the
    // backdrop AND `opacity: L.SCRIM_OPACITY`, and the arrival animation's
    // `{ opacity: arrived.value }` was applied after it on the same node — so
    // once the enter timing completed the overlay sat at opacity 1 and the
    // registered, documented tunable reached no pixel at all.
    //
    // The pixel proof is `tools/capture-cutin.mjs`, which measures blended
    // pixels behind the overlay on real frames. This is the cheap statement of
    // the same thing: the two must not be on one node.
    expect(VIEW).toMatch(/SCRIM_OPACITY/);
    expect(VIEW).toMatch(/scrim: \{/);
    expect(VIEW).toMatch(/StyleSheet\.absoluteFill, styles\.scrim/);
    const root = /root: \{[^}]*\}/.exec(VIEW)?.[0] ?? '';
    expect(root.length).toBeGreaterThan(0);
    expect(root, 'the arrival node still carries a static opacity').not.toMatch(/opacity/);
    expect(root, 'the arrival node still carries the backdrop').not.toMatch(/backgroundColor/);
  });
});

// ---------------------------------------------------------------------------
// THE CAP LIVES IN THE GATE, AND NO SCREEN CAN GET ROUND IT
// ---------------------------------------------------------------------------

describe('only the host talks to the gate — GDD §7.2, §12.3', () => {
  it('the host is the only file that opens a session or requests a cut-in', () => {
    expect(HOST).toMatch(/resumeCutInSession/);
    expect(HOST).toMatch(/requestCutIn/);
    for (const [moment, file] of CALLERS) {
      const text = code(file);
      // A screen that could call these could give itself a second slot, and
      // §12.3's refusal condition would then be a convention rather than a rule.
      expect(text, `${moment} (${file})`).not.toMatch(/\bopenCutInSession\b/);
      expect(text, `${moment} (${file})`).not.toMatch(/\brequestCutIn\b/);
      expect(text, `${moment} (${file})`).not.toMatch(/\bCUT_IN_TUNING\b/);
      expect(text, `${moment} (${file})`).not.toMatch(/\bCutInView\b/);
      // ...nor reach the ledger, which is where the count lives now. A screen
      // that could forget a sitting could refund its slot.
      expect(text, `${moment} (${file})`).not.toMatch(/\bresumeCutInSession\b/);
      expect(text, `${moment} (${file})`).not.toMatch(/\brememberCutInSession\b/);
      expect(text, `${moment} (${file})`).not.toMatch(/\bforgetAllCutInSessions\b/);
    }
  });

  it('ONE GATE SESSION PER SITTING, GUARDED ON ITS ID', () => {
    // The one hole `cutInGate.ts` §5 names: a caller that re-opens mid-sitting
    // hands itself a second slot — or, as this file actually did before a
    // browser caught it, throws away a cut-in that had just been granted,
    // because React runs child effects before parent ones.
    //
    // The GUARD is what closes both, not the dependency list, so the guard is
    // what this reads.
    expect(HOST).toMatch(/if \(session\.current\.sessionId === activeSessionId\) return;/);
    expect(HOST).toMatch(/resumeCutInSession\(\{ sessionId: activeSessionId, seed: activeSeed \}\)/);
    // ...and the count is never touched anywhere else.
    expect(HOST).not.toMatch(/firedCount/);
  });

  it('THE COUNT OUTLIVES THE COMPONENT — the cap is per sitting, not per mount', () => {
    // A `useRef` is about a MOUNT and §12.3's refusal condition is about a
    // SESSION. `AppShell.tsx` swaps the two screens with a ternary and both
    // screens early-return above their own `<CutInHost>`, so the component
    // really does go away inside a sitting.
    //
    // THE BEHAVIOUR IS TESTED FOR REAL IN `cutInLedger.test.ts` — this only
    // checks that the host is the thing wired to it, which is the half a node
    // environment cannot execute.
    expect(HOST).toMatch(/from '\.\/cutInLedger'/);
    expect(HOST).toMatch(/rememberCutInSession\(decision\.state\)/);
    expect(HOST).toMatch(/rememberCutInSession\(session\.current\)/);
    // The ledger is not cleared by anything that renders. A component that
    // could forget a sitting could hand it a second slot.
    expect(HOST).not.toMatch(/forgetAllCutInSessions/);
    expect(VIEW).not.toMatch(/cutInLedger/);
  });

  it('THE DEBUG ROUTE IS NOT REACHABLE IN PLAY', () => {
    // `?cutin=<moment>` stages one cut-in for the capture harness. It is a
    // query string and nothing else: no control navigates to it, and the parser
    // returns null for anything it does not recognise (`cutInPreview.test.ts`).
    expect(HOST).toMatch(/cutInPreviewFrom/);
    expect(HOST).toMatch(/window\.location\.search/);
    // The preview's beats go through the same `offer`, so the cap, the rate and
    // the qualification all still apply. A preview that called `setLive`
    // directly would be photographing a component the app cannot reach.
    expect(HOST).toMatch(/offer\(preview\.beats\)/);
    expect(HOST).not.toMatch(/setLive\(preview/);
    // No screen may reach the route either.
    for (const [moment, file] of CALLERS) {
      expect(code(file), `${moment} (${file})`).not.toMatch(/cutInPreview/);
    }
  });

  it('both loops mount exactly one host, above the whole loop', () => {
    for (const file of ['session/SessionScreen.tsx', 'meet/MeetScreen.tsx']) {
      const text = code(file);
      expect(text, file).toMatch(/<CutInHost/);
      expect(text, file).toMatch(/<\/CutInHost>/);
      expect(text.match(/<CutInHost/g)?.length, `${file} mounts one host`).toBe(1);
      expect(text, file).toMatch(/cutInSessionId\(/);
      expect(text, file).toMatch(/cutInSessionSeed\(/);
    }
  });

  it('A MEET IS ONE SESSION, AND A TRAINING DAY IS ANOTHER', () => {
    // GDD §7.2 as read in `cutInGate.ts` §3, at the two call sites. The meet's
    // host is above the phase router, so all nine attempts, the recap and the
    // bomb-out share one slot.
    expect(code('meet/MeetScreen.tsx')).toMatch(/cutInSessionId\('meet'/);
    expect(code('session/SessionScreen.tsx')).toMatch(/cutInSessionId\('training'/);
  });
});

// ---------------------------------------------------------------------------
// ALL FOUR MOMENTS HAVE A CALLER
// ---------------------------------------------------------------------------

describe('every firing moment of GDD §7.2 is wired to a screen', () => {
  it('EACH OF THE FOUR IS OFFERED BY THE SCREEN THAT KNOWS ABOUT IT', () => {
    expect(CALLERS.length).toBe(5); // four moments; PRs have two screens
    for (const [moment, file, beat] of CALLERS) {
      const text = code(file);
      expect(text, `${moment} (${file}) offers nothing`).toMatch(/useOfferCutIn\(/);
      expect(text, `${moment} (${file}) reports the wrong beat`).toContain(beat);
    }
  });

  it('covers all four of the gate’s beat kinds between them', () => {
    // The union of what the app can report. A beat kind the gate understands
    // but no screen sends is a firing moment that exists only in the tests.
    const offered = new Set(
      CALLERS.flatMap(([, file]) => [...code(file).matchAll(/kind: '([a-z-]+)'/g)].map((m) => m[1])),
    );
    for (const kind of ['meet-walkout', 'record', 'meet-over', 'work-set']) {
      expect(offered.has(kind), `nothing reports a ${kind} beat`).toBe(true);
    }
  });

  it('no screen qualifies the beat itself — it reports facts', () => {
    // The walk-out reports which attempt it is; it does not check for a third
    // and offer nothing otherwise. If it did, "the gate does not fire on a
    // non-qualifying beat" would be a property of five screens instead of one
    // module, and `cutInGate.test.ts` could not see any of them.
    expect(code('meet/WalkoutView.tsx')).toMatch(/attemptNumber: attempt\.attemptNumber/);
    expect(code('session/CloseOutView.tsx')).toMatch(/achieved: isPr/);
    expect(code('meet/RecapView.tsx')).toMatch(/achieved: recap\.isTotalPr/);
    expect(code('session/RestView.tsx')).toMatch(/loadRatio,/);
  });

  it('THE WALK-OUT REPORTS WHETHER ITS LIFT CAN STILL BOMB', () => {
    // The fact that stops a third attempt with nothing banked spending the slot
    // §7.2's "somber counterpart" is about to need. It is REPORTED, not acted
    // on: the screen must not check it and withhold the beat, or the rule would
    // move out of the gate and `cutInGate.test.ts` could not see it.
    const walkout = code('meet/WalkoutView.tsx');
    expect(walkout).toMatch(/bombRisk: attempt\.bombRisk/);
    // The shapes that would move the decision into the screen.
    expect(walkout).not.toMatch(/attempt\.bombRisk \?\s*\[\]/);
    expect(walkout).not.toMatch(/useOfferCutIn\(attempt\.bombRisk/);
  });
});

// ---------------------------------------------------------------------------
// THE PRIORITY ORDER, AND THE READING THAT SAYS IT DECIDES NOTHING
// ---------------------------------------------------------------------------

describe('CUT_IN_MOMENT_PRIORITY is a declared invariant, not a live tie-break', () => {
  /**
   * The text of a file's one `useOfferCutIn(...)` call, parentheses balanced.
   *
   * Read off the real source rather than restated, because the claim being
   * checked is about what the CALL SITES can produce and a restatement would
   * agree with itself for ever.
   */
  function offerCallIn(file: string): string {
    const text = code(file);
    const marker = 'useOfferCutIn(';
    const start = text.indexOf(marker);
    if (start === -1) return '';
    let depth = 0;
    for (let i = start + marker.length - 1; i < text.length; i += 1) {
      if (text[i] === '(') depth += 1;
      else if (text[i] === ')') {
        depth -= 1;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return '';
  }

  function beatKindsOffered(file: string): readonly string[] {
    const call = offerCallIn(file);
    return [...new Set([...call.matchAll(/kind: '([a-z-]+)'/g)].map((m) => m[1] ?? ''))];
  }

  it('the reader can see a two-kind call when there is one', () => {
    // Positive control. A scan that had stopped matching would report every
    // file as single-kind and the assertion below would pass on anything.
    const twoKinds = "useOfferCutIn([{ kind: 'record' }, { kind: 'meet-over' }]);";
    expect([...new Set([...twoKinds.matchAll(/kind: '([a-z-]+)'/g)].map((m) => m[1]))]).toEqual([
      'record',
      'meet-over',
    ]);
    // ...and it really is reading the call, not the whole file.
    expect(offerCallIn('meet/RecapView.tsx')).toMatch(/^useOfferCutIn\(/);
    expect(offerCallIn('meet/RecapView.tsx')).not.toMatch(/ScrollView/);
  });

  it('THE PRIORITY ORDER DECIDES NOTHING TODAY, AND HERE IS THE READING THAT SAYS SO', () => {
    // Each of the four beat KINDS maps to exactly one moment (`momentFor` is a
    // switch on `kind`), so the number of distinct moments one request can
    // produce is the number of distinct kinds at that call site. Every site
    // offers one kind, so `momentsFor` returns at most one moment on every
    // request the app can make and `CUT_IN_MOMENT_PRIORITY` never breaks a tie.
    //
    // THIS IS THE TEST THAT GOES RED THE DAY THAT STOPS BEING TRUE. When it
    // does, the ranking starts deciding real beats and somebody should look at
    // it on purpose rather than discover it — which is the whole reason the
    // constant is kept rather than deleted.
    for (const [moment, file] of CALLERS) {
      const kinds = beatKindsOffered(file);
      expect(kinds.length, `${moment} (${file}) offers no beat`).toBeGreaterThan(0);
      expect(
        kinds.length,
        `${moment} (${file}) now offers ${kinds.join(' + ')} at once — the priority ` +
          'order has started deciding something. See CUT_IN_MOMENT_PRIORITY.',
      ).toBe(1);
    }
  });

  it('and the ranking is still declared, so the invariant has an implementation', () => {
    // GDD §7.2 states the order in prose. Deleting the constant would leave the
    // document with no implementation and make `momentsFor` return the caller's
    // order instead of a defined one.
    const GATE = source('cutin/cutInGate.ts');
    expect(GATE).toMatch(/CUT_IN_MOMENT_PRIORITY/);
    expect(GATE).toMatch(/CUT_IN_MOMENT_PRIORITY\.filter/);
  });
});

// ---------------------------------------------------------------------------
// The three deferrals are gone
// ---------------------------------------------------------------------------

describe('the three "the gate belongs to somebody else" comments are gone', () => {
  const DEFERRALS: readonly (readonly [string, RegExp])[] = [
    ['meet/WalkoutView.tsx', /NO CUT-IN\./],
    ['meet/RecapView.tsx', /NO CUT-IN FIRES HERE/],
    ['session/CloseOutView.tsx', /NO CUT-IN FIRES HERE/],
  ];

  it('the scan can see the sentence it is looking for', () => {
    expect('NO CUT-IN FIRES HERE. GDD §7.2 lists PR moments').toMatch(/NO CUT-IN FIRES HERE/);
  });

  it('replaced by wiring, not by a different comment', () => {
    for (const [file, deferral] of DEFERRALS) {
      const raw = source(file);
      expect(raw, `${file} still defers`).not.toMatch(deferral);
      expect(raw, `${file} still says the gate is somebody else's`).not.toMatch(
        /gate belongs to/i,
      );
      expect(code(file), `${file} has no wiring`).toMatch(/useOfferCutIn\(/);
    }
  });
});

// ---------------------------------------------------------------------------
// A cut-in is cosmetic — GDD §8.1, §12.3
// ---------------------------------------------------------------------------

describe('nothing in the cut-in path can touch a number the player earns', () => {
  it('the view and the host read no progression, no total and no e1RM', () => {
    for (const [name, text] of [
      ['CutInView.tsx', VIEW],
      ['CutInHost.tsx', HOST],
    ] as const) {
      for (const banned of [
        'readTotalKg',
        'readBestE1rmKg',
        'proposeChange',
        'ProgressionCache',
        'applyMeetResult',
        'recordTrainingSession',
      ]) {
        expect(text, `${name} names ${banned}`).not.toMatch(new RegExp(`\\b${banned}\\b`));
      }
    }
  });

  it('the cut-in path never reaches the fatigue ledger either — GDD §3.4, §12.3', () => {
    for (const [name, text] of [
      ['CutInView.tsx', VIEW],
      ['CutInHost.tsx', HOST],
    ] as const) {
      expect(text, name).not.toMatch(/\bFatigueState\b/);
      expect(text, name).not.toMatch(/\.fatigue\b/);
    }
  });
});
