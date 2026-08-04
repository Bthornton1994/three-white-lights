/**
 * cutInArt.test.ts — that the cut-in reads from the identity table (GDD §7.3)
 * and does not author art of its own (GDD §7.2).
 *
 * The point of §7.3 is that a licensed portrait later is A DATA CHANGE. That is
 * only true if the cut-in surface is already reading from the table BEFORE any
 * art exists, which is why these checks matter now rather than after the art
 * pass: a cut-in that drew its own placeholder today would have to be rebuilt
 * the day a partner arrived, and the whole tier system would have bought
 * nothing.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { LICENSING_CATALOGUE } from '../licensing/partners';
import { TIER_3_SURFACES } from '../licensing/tiers';
import { withoutComments } from '../tuning/audit';
import { CUT_IN_SURFACE, cutInIdentity, renderCutIn } from './cutInArt';
import { openCutInSession, requestCutIn, type LiveCutIn } from './cutInGate';
import { CUT_IN_ART } from './cutInTuning';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function source(file: string): string {
  return readFileSync(path.join(HERE, file), 'utf8');
}

const A_LIVE_CUT_IN: LiveCutIn = Object.freeze({
  moment: 'personal-record',
  identityId: CUT_IN_ART.DEFAULT_IDENTITY_ID,
  slot: 'portrait',
});

describe('the cut-in is a Tier 3 surface — GDD §7.3', () => {
  it('“cut-in” is one of §7.3’s four Tier 3 surfaces', () => {
    // Spelled out rather than read off the constant the code uses, and the list
    // is §7.3's own sentence: "cut-ins (§7.2), character select, the shop
    // screen, and the result card (§6.5)".
    expect([...TIER_3_SURFACES].sort()).toEqual(
      ['character-select', 'cut-in', 'result-card', 'shop'].sort(),
    );
    expect(CUT_IN_SURFACE).toBe('cut-in');
  });

  it('renders through the existing licensing panel path, not a parallel one', () => {
    const grid = renderCutIn(LICENSING_CATALOGUE, A_LIVE_CUT_IN);
    expect(grid.w).toBeGreaterThan(0);
    expect(grid.h).toBeGreaterThan(0);
    expect(grid.data.length).toBe(grid.w * grid.h);
  });

  it('DRAWS A DIFFERENT PICTURE FOR A DIFFERENT IDENTITY', () => {
    // The check that the table is actually being read. A renderer that ignored
    // the entry and stamped a fixed placeholder would pass every assertion
    // above and fail this one.
    const first = renderCutIn(LICENSING_CATALOGUE, A_LIVE_CUT_IN);
    const second = renderCutIn(LICENSING_CATALOGUE, {
      ...A_LIVE_CUT_IN,
      identityId: CUT_IN_ART.COACH_IDENTITY_ID,
    });
    expect(first.w).toBe(second.w);
    expect([...first.data]).not.toEqual([...second.data]);
  });

  it('refuses an identity that is not in the table', () => {
    // A cut-in that fired and rendered a blank rectangle is what `partners.ts`
    // calls "exactly what nobody notices".
    expect(() => cutInIdentity(LICENSING_CATALOGUE, 'nobody')).toThrow(RangeError);
    expect(() => renderCutIn(LICENSING_CATALOGUE, { ...A_LIVE_CUT_IN, identityId: 'nobody' })).toThrow(
      RangeError,
    );
  });

  it('every identity the gate can name is really in the table', () => {
    // Non-vacuity for the default-identity constants: a typo there would make
    // every fired cut-in throw at render time, in the app, and nowhere else.
    for (const id of [CUT_IN_ART.DEFAULT_IDENTITY_ID, CUT_IN_ART.COACH_IDENTITY_ID]) {
      expect(cutInIdentity(LICENSING_CATALOGUE, id).id, id).toBe(id);
    }
  });

  it('a cut-in the GATE fired renders — the two halves fit together', () => {
    // End to end, so the gate's output really is a valid render input rather
    // than a shape that only the fixtures above satisfy.
    let session = openCutInSession({ sessionId: 'render', seed: 0 });
    for (let seed = 0; seed < 5000; seed += 1) {
      const candidate = openCutInSession({ sessionId: 'render', seed });
      if (candidate.allowed['personal-record']) {
        session = candidate;
        break;
      }
    }
    const decision = requestCutIn(session, [{ kind: 'record', record: 'e1rm', achieved: true }]);
    const outcome = decision.outcome;
    expect(outcome.kind).toBe('fire');
    if (outcome.kind !== 'fire') return;
    expect(() => renderCutIn(LICENSING_CATALOGUE, outcome.live)).not.toThrow();
  });
});

describe('THIS PIECE AUTHORS NO CUT-IN ART — GDD §7.2, §11', () => {
  // Comments blanked, STRING CONTENTS KEPT. An authored drawing in this
  // codebase is a string literal, so `codeOnly` — which erases them — would
  // make this scan look at nothing at all.
  const ART = withoutComments(source('cutInArt.ts'));
  const VIEW = withoutComments(source('CutInView.tsx'));

  /**
   * The three marks of an authored drawing in this codebase — a `rows` field, a
   * `legend`, and a row of blanks-and-ink (`spriteMarks.ts`, `gymProps.ts`,
   * `partners.ts` all use the same idiom).
   *
   * A FLOOR, NOT A PROOF, and it is worth saying which way it is weak: the row
   * pattern only catches drawings written in `.` and CAPITALS, which is how
   * every drawing in the tree is actually written but not the only way one
   * could be. It catches the drawing somebody pastes in from another file,
   * which is how art would really arrive here.
   */
  const DRAWING_MARKS: readonly (readonly [string, RegExp])[] = [
    ['a rows field', /\brows\s*[:=]/],
    ['a legend', /\blegend\b/],
    ['a row of pixels', /'[.A-Z]{6,}'/],
    ['a minted Tier 3 asset', /tier3Asset/],
  ];

  it('the scan can see a drawing when there is one', () => {
    // Positive control. Without it, a scan that stopped matching would pass
    // every file, which is the blindness this whole suite is written against.
    const PLANTED = withoutComments(
      "const drawing = { rows: ['..KKKKKK..', '.KKKKKKKK.'], legend: { K: 1 } };",
    );
    for (const [what, pattern] of DRAWING_MARKS) {
      if (what === 'a minted Tier 3 asset') continue;
      expect(PLANTED, what).toMatch(pattern);
    }
    expect(withoutComments('const a = tier3Asset(c);')).toMatch(/tier3Asset/);
  });

  it('holds no authored pixel rows and no legend of its own', () => {
    for (const [name, text] of [
      ['cutInArt.ts', ART],
      ['CutInView.tsx', VIEW],
    ] as const) {
      for (const [what, pattern] of DRAWING_MARKS) {
        expect(text, `${name} has ${what}`).not.toMatch(pattern);
      }
    }
  });

  it('goes through the licensing renderer rather than importing the drawings', () => {
    expect(ART).toMatch(/renderPanel/);
    expect(ART).toMatch(/licensing\/renderPanels/);
    // It names the catalogue only as a TYPE and takes it as an argument, so the
    // table is data the caller supplies and not a hard-coded dependency.
    expect(ART).not.toMatch(/from '\.\.\/licensing\/partners'/);
  });
});
