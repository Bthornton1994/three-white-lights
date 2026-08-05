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

import { readdirSync, readFileSync } from 'node:fs';
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
 *
 * IT IS NOT THE SCOPE OF THE SCANS BELOW, and that distinction is the whole
 * point of `THE SET OF FILES THAT TALK TO THE GATE IS THIS SET` further down.
 * Every scan in this file used to read only these five paths, so a SIXTH screen
 * — one offering two beat kinds at once, or one opening its own gate session —
 * was invisible to all of them and the run's ruled claims about the priority
 * order and the cap would have gone quietly false. The list is now checked to
 * be exhaustive by walking `src/`, which is the difference between a statement
 * and a restatement.
 */
const CALLERS: readonly (readonly [string, string, string])[] = [
  ['third-attempt walk-out', 'meet/WalkoutView.tsx', "kind: 'meet-walkout'"],
  ['a PR at a meet', 'meet/RecapView.tsx', "kind: 'record'"],
  ['a PR in the daily loop', 'session/CloseOutView.tsx', "kind: 'record'"],
  ['bombing out', 'meet/BombOutView.tsx', "kind: 'meet-over'"],
  ['a coach reaction on a heavy set', 'session/RestView.tsx', "kind: 'work-set'"],
];

/** The two screens that own a sitting and mount the host over it. */
const HOST_SCREENS: readonly string[] = ['meet/MeetScreen.tsx', 'session/SessionScreen.tsx'];

/** Every non-test source file under `src/`, as a path relative to `src/`. */
function everySourceFile(dir: string = ''): readonly string[] {
  return readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = dir === '' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) return everySourceFile(rel);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.test\.tsx?$/.test(entry.name)) return [];
    return [rel];
  });
}

/**
 * The piece's own module. Excluded from the walks below BY PREFIX rather than
 * by name, so a file added to `src/cutin/` cannot escape the exclusion and a
 * file added anywhere else cannot fall into it.
 */
const THE_GATE_ITSELF = 'cutin/';

/**
 * NAMING ANY OF THESE IS TALKING TO THE GATE.
 *
 * `useOfferCutIn` is how a screen reports a beat; the other four are the gate
 * and the ledger themselves, which no screen may reach — a screen that opened
 * its own session would mint itself a second slot and §12.3's refusal condition
 * would become a convention.
 */
const GATE_ENTRY_POINTS =
  /\b(?:useOfferCutIn|openCutInSession|resumeCutInSession|requestCutIn|rememberCutInSession|forgetAllCutInSessions)\b/;

/**
 * Naming any of these claims a SITTING, which is what the cap counts.
 *
 * `<CutInHost` and not `CutInHost`: the five beat-reporting screens import
 * `useOfferCutIn` FROM `../cutin/CutInHost`, so the bare name is in their import
 * lines and would put all five in this set. What matters is MOUNTING one.
 */
const SITTING_ENTRY_POINTS = /\b(?:cutInSessionId|cutInSessionSeed)\b|<CutInHost\b/;

/** Files outside `src/cutin/` whose code matches `pattern`. */
function filesNaming(pattern: RegExp): readonly string[] {
  return everySourceFile()
    .filter((rel) => !rel.startsWith(THE_GATE_ITSELF))
    .filter((rel) => pattern.test(code(rel)))
    .sort();
}

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

  it('THE WALK REACHES THE WHOLE TREE, and the patterns match a real caller', () => {
    // Three positive controls for the derivation below, because a walk that
    // returned nothing and a pattern that matched nothing would agree with a
    // hand-written list right up until the day they were needed.
    const all = everySourceFile();
    expect(all.length, 'the walk found almost nothing').toBeGreaterThan(50);
    // It descends into directories rather than reading only the top level...
    expect(all).toContain('cutin/CutInHost.tsx');
    expect(all).toContain('meet/WalkoutView.tsx');
    // ...it skips tests, which are full of these names by design...
    expect(all.filter((f) => f.includes('.test.'))).toEqual([]);
    // ...and both patterns really do match the files that really do call the
    // gate. If either stopped matching, `filesNaming` would return `[]` and the
    // equality below would fail loudly rather than pass silently — but only the
    // FIRST of those is guaranteed by the equality itself, so both are asserted.
    expect(GATE_ENTRY_POINTS.test(code('cutin/CutInHost.tsx'))).toBe(true);
    expect(GATE_ENTRY_POINTS.test(code('meet/WalkoutView.tsx'))).toBe(true);
    expect(SITTING_ENTRY_POINTS.test(code('meet/MeetScreen.tsx'))).toBe(true);
    // The exclusion is a prefix on the walk's own output, not a missing file.
    expect(filesNaming(GATE_ENTRY_POINTS)).not.toContain('cutin/CutInHost.tsx');
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
  it('THE SET OF FILES THAT TALK TO THE GATE IS THIS SET — derived, not restated', () => {
    // WHY THIS EXISTS. `CALLERS` is a hand-written list of five paths and every
    // other scan in this file reads only those five. Nothing asserted that the
    // list was COMPLETE, so:
    //
    //   - a sixth screen offering two beat kinds at once would leave "THE
    //     PRIORITY ORDER DECIDES NOTHING TODAY" green while GDD §7.2's ruled
    //     claim went false, and
    //   - a sixth screen calling `openCutInSession` directly would mint itself a
    //     second slot inside one sitting with no test red at all — which is
    //     §12.3's refusal condition, reached by a route no scan was looking at.
    //
    // Derived by walking `src/` so it cannot agree with itself. `src/cutin/` is
    // the gate's own module and is excluded by prefix; everything else in the
    // tree that so much as names the gate has to be one of the five.
    expect(filesNaming(GATE_ENTRY_POINTS)).toEqual([...CALLERS.map(([, file]) => file)].sort());
  });

  it('AND THE SET OF SCREENS THAT CLAIM A SITTING IS THE TWO LOOPS', () => {
    // The other half of the same hole. The cap is per SITTING (§7.2), and a
    // sitting is whatever a caller names with `cutInSessionId` and mounts a
    // `CutInHost` over. A third screen doing that inside an existing sitting
    // would hand it a second cut-in without ever touching `CALLERS` — so the
    // set of files that can open one is derived too, not listed in a loop.
    expect(filesNaming(SITTING_ENTRY_POINTS)).toEqual([...HOST_SCREENS].sort());
  });

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
   * The text of EVERY `useOfferCutIn(...)` call in a file, parentheses balanced.
   *
   * Read off the real source rather than restated, because the claim being
   * checked is about what the CALL SITES can produce and a restatement would
   * agree with itself for ever.
   *
   * ALL OF THEM, not the first. This used to stop at `indexOf`, so a screen that
   * grew a second `useOfferCutIn` offering two kinds at once kept the assertion
   * below green on the strength of its first call — the same class of blind spot
   * as the five-file `CALLERS` list, one scope in.
   */
  function offerCalls(text: string): readonly string[] {
    const marker = 'useOfferCutIn(';
    const calls: string[] = [];
    let from = 0;
    for (;;) {
      const start = text.indexOf(marker, from);
      if (start === -1) return calls;
      let depth = 0;
      let end = -1;
      for (let i = start + marker.length - 1; i < text.length; i += 1) {
        if (text[i] === '(') depth += 1;
        else if (text[i] === ')') {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) return calls;
      calls.push(text.slice(start, end + 1));
      from = end + 1;
    }
  }

  /**
   * TEXT IN, CALLS OUT — deliberately, so the positive control below can feed
   * the SAME function a two-call string. A reader that only ever took a path
   * could not be shown to find a second call without planting a second call in
   * the tree.
   */
  function offerCallsIn(file: string): readonly string[] {
    return offerCalls(code(file));
  }

  function beatKindsPerCall(file: string): readonly (readonly string[])[] {
    return offerCallsIn(file).map((call) => [
      ...new Set([...call.matchAll(/kind: '([a-z-]+)'/g)].map((m) => m[1] ?? '')),
    ]);
  }

  it('the reader can see a two-kind call when there is one, and sees every call', () => {
    // Positive control. A scan that had stopped matching would report every
    // file as single-kind and the assertion below would pass on anything.
    const twoKinds = "useOfferCutIn([{ kind: 'record' }, { kind: 'meet-over' }]);";
    expect([...new Set([...twoKinds.matchAll(/kind: '([a-z-]+)'/g)].map((m) => m[1]))]).toEqual([
      'record',
      'meet-over',
    ]);
    // ...it really is reading the call, not the whole file...
    expect(offerCallsIn('meet/RecapView.tsx')[0]).toMatch(/^useOfferCutIn\(/);
    expect(offerCallsIn('meet/RecapView.tsx')[0]).not.toMatch(/ScrollView/);
    expect(offerCallsIn('meet/RecapView.tsx').length).toBe(1);
    // ...and it does not stop at the first one, which is what it used to do.
    // The same balancing reader, given a text with two calls — the second of
    // which is the two-kind shape the assertion below is hunting for.
    const twice =
      "useOfferCutIn([{ kind: 'record', achieved: f(1) }]);\nconst x = 1;\n" +
      "useOfferCutIn([{ kind: 'meet-over' }, { kind: 'work-set' }]);";
    const calls = offerCalls(twice);
    expect(calls.length, 'the reader still stops at the first call').toBe(2);
    expect([...new Set([...(calls[1] ?? '').matchAll(/kind: '([a-z-]+)'/g)].map((m) => m[1]))]).toEqual(
      ['meet-over', 'work-set'],
    );
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
    //
    // EVERY CALL IN EVERY FILE THAT TALKS TO THE GATE — and the file set is the
    // derived one, not `CALLERS`, so a sixth screen is inside this loop the day
    // it is written rather than the day somebody remembers to add it.
    const offering = filesNaming(GATE_ENTRY_POINTS);
    expect(offering.length, 'no file offers a beat at all').toBeGreaterThan(0);
    for (const file of offering) {
      const perCall = beatKindsPerCall(file);
      expect(perCall.length, `${file} offers no beat`).toBeGreaterThan(0);
      perCall.forEach((kinds, i) => {
        expect(kinds.length, `${file} call ${i + 1} offers no beat`).toBeGreaterThan(0);
        expect(
          kinds.length,
          `${file} call ${i + 1} now offers ${kinds.join(' + ')} at once — the priority ` +
            'order has started deciding something. See CUT_IN_MOMENT_PRIORITY.',
        ).toBe(1);
      });
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
