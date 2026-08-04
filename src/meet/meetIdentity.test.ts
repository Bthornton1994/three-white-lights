/**
 * NO REAL ATHLETE, BRAND OR COMPANY IDENTITY ON MEET DAY (GDD §12.3).
 *
 * ===========================================================================
 * WHY MEET DAY IS THE RISKY SURFACE
 * ===========================================================================
 * The refusal condition is that no real, named athlete, brand or company
 * identity — name, logo, likeness or wordmark — may be hardcoded into any
 * asset, string, config or code path. Meet day is where that would happen
 * first, because every part of it has a real-world counterpart that a
 * "realistic" placeholder would reach for:
 *
 *   - THE BANNER OVER THE PLATFORM. A real meet's backdrop is a wall of
 *     equipment sponsors. Ours is `GYM_BANNER`: a stripe and five solid
 *     patches, checked below to be geometry with no text payload at all.
 *     There is no glyph renderer anywhere in `src/art/`, so the room CANNOT
 *     draw a wordmark — that is a structural property, not a promise.
 *   - THE FEDERATION. `MEET_LOCAL.federation` is invented (GDD §11 leaves
 *     licensing open) and `meetTuning.test.ts` already banned the obvious
 *     real ones. This widens that to brands and athletes and makes it the
 *     formal §12.3 check rather than one file's own judgement call.
 *   - THE LIFTER AND THE FIELD. `MEET_ENTRY.name` reaches the weigh-in, the
 *     recap and the shareable card; `ghostTotalsKg` is the field it places
 *     against. The named failure mode is that nobody does this deliberately —
 *     it arrives as a realistic placeholder because a real athlete came to
 *     mind first. So the ghosts are NUMBERS ONLY and there is no name in that
 *     list to get wrong.
 *
 * ===========================================================================
 * SCOPE, STATED SO IT IS NOT MISTAKEN FOR MORE THAN IT IS
 * ===========================================================================
 * This scans THE FILES THIS PIECE OWNS. `meet.ts` and `resultCard.ts` also
 * mention real federations, as structural references to the sport's rules
 * (plate ladders, loading increments, result-sheet columns); whether each of
 * those is a legitimate rule citation or identity presented as content is
 * another builder's call and is deliberately NOT decided here. Scanning them
 * from this file would pre-empt that judgement with a denylist.
 *
 * The denylist is also not a proof of absence. It catches the names somebody
 * would actually reach for; it cannot catch one nobody thought of. What makes
 * the surface safe is structural — no text in the room, numbers for the field —
 * and the list is the backstop.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { withoutComments } from '../tuning/audit';
import { GYM_BANNER, GYM_CROWD, GYM_PROPS_MEET } from '../art/gymTuning';
import { MEET_ENTRY, MEET_LOCAL, MEET_SOUND_IDS } from '../game/meetTuning';
import { everySoundFileName } from './soundAssets';

const SRC = path.join(__dirname, '..');
const ROOT = path.join(SRC, '..');

/**
 * Files this piece owns and is therefore answerable for.
 *
 * `src/game/meet.ts` and `src/game/resultCard.ts` are deliberately absent —
 * see the header.
 */
function ownedSources(): { readonly file: string; readonly source: string }[] {
  const out: { file: string; source: string }[] = [];
  // COMMENTS ARE STRIPPED, and that is a scoping decision rather than a
  // loophole. §12.3 names "any asset, string, config, or code path"; a comment
  // citing the IPF plate ladder to explain why the 25 kg disc is drawn red is a
  // rule citation, not identity presented as content, and deciding which of
  // those a given citation is belongs to the builder reconciling `meet.ts` and
  // `resultCard.ts` — not to a denylist in this file. Every string literal a
  // player could ever see survives the strip and IS scanned.
  const push = (rel: string): void => {
    out.push({
      file: rel,
      source: withoutComments(readFileSync(path.join(SRC, rel), 'utf8')),
    });
  };
  for (const dir of ['meet', 'audio']) {
    for (const entry of readdirSync(path.join(SRC, dir))) {
      if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue;
      if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue;
      push(path.join(dir, entry));
    }
  }
  push(path.join('game', 'meetTuning.ts'));
  push(path.join('game', 'meetDay.ts'));
  return out;
}

/**
 * Names a "realistic placeholder" would reach for.
 *
 * Federations and equipment brands as single distinctive tokens; athletes as
 * full names, because a surname alone false-positives on ordinary prose (a
 * "green" light, a "brown" belt) and a check that cries wolf gets suppressed.
 */
const FEDERATIONS = ['IPF', 'USAPL', 'USPA', 'NPL', 'IPL', 'WRPF', 'GPC', 'SPF', 'THSPA'];
const BRANDS = [
  'SBD',
  'Inzer',
  'Eleiko',
  'Rogue Fitness',
  'Ivanko',
  'Texas Power Bar',
  'Kabuki',
  'Pioneer Cut',
  'Metal Powerlifting',
];
const ATHLETES = [
  'Ray Williams',
  'Ed Coan',
  'Julius Maddox',
  'Jesus Olivares',
  'Larry Wheels',
  'Taylor Atwood',
  'Amanda Lawrence',
  'Jen Thompson',
  'Blaine Sumner',
  'Dan Green',
  'Kirill Sarychev',
  'Yury Belkin',
  'Jamal Browner',
  'Stefanie Cohen',
  'Sonita Muluh',
  'Hafthor',
  'Eddie Hall',
];
const DENIED = [...FEDERATIONS, ...BRANDS, ...ATHLETES];

/** Case-insensitive whole-token match, so `SBD` does not fire on `sbdx`. */
function mentions(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'i').test(haystack);
}

describe('the denylist scan can actually fire', () => {
  it('catches a name it is meant to catch, and leaves prose alone', () => {
    // Without this, every assertion below could be passing because the matcher
    // is broken rather than because the tree is clean.
    expect(mentions('the IPF rulebook', 'IPF')).toBe(true);
    // ...and it still sees a STRING, which is what §12.3 is actually about.
    expect(mentions(withoutComments("const fed = 'USAPL';"), 'USAPL')).toBe(true);
    expect(mentions(withoutComments('// the USAPL rulebook says'), 'USAPL')).toBe(false);
    expect(mentions('federation: "USAPL Open"', 'USAPL')).toBe(true);
    expect(mentions('a green light came up', 'Dan Green')).toBe(false);
    expect(mentions('SBDX Barbell', 'SBD')).toBe(false);
    expect(mentions('sbd sleeves', 'SBD')).toBe(true);
  });

  it('has something to scan', () => {
    const owned = ownedSources();
    expect(owned.length).toBeGreaterThanOrEqual(12);
    expect(owned.map((o) => o.file)).toContain(path.join('game', 'meetTuning.ts'));
    expect(owned.map((o) => o.file)).toContain(path.join('meet', 'WalkoutView.tsx'));
  });
});

describe('nothing meet day ships is a real identity (GDD §12.3)', () => {
  it('invents the federation and the meet', () => {
    for (const denied of DENIED) {
      expect(mentions(MEET_LOCAL.federation, denied), `federation names ${denied}`).toBe(false);
      expect(mentions(MEET_LOCAL.name, denied), `meet names ${denied}`).toBe(false);
      expect(mentions(MEET_LOCAL.id, denied), `meet id names ${denied}`).toBe(false);
    }
    // ...and it is not empty, which would pass a denylist trivially.
    expect(MEET_LOCAL.federation.length).toBeGreaterThan(0);
    expect(MEET_LOCAL.name.length).toBeGreaterThan(0);
  });

  it('gives the lifter a placeholder nobody could mistake for a person', () => {
    for (const denied of DENIED) {
      expect(mentions(MEET_ENTRY.name, denied), `lifter is named ${denied}`).toBe(false);
    }
    // `A. LIFTER` — an initial and a job title. The point is that it reads as
    // obviously unfilled rather than as a plausible competitor.
    expect(MEET_ENTRY.name).toMatch(/^[A-Z]\.\s+LIFTER$/);
  });

  it('fields the ghosts as numbers, so there is no name to get wrong', () => {
    // GDD §6.6: local meets resolve against ghost data. The named failure mode
    // is a "realistic" placeholder roster; this shape makes one impossible
    // without a type change.
    expect(MEET_LOCAL.ghostTotalsKg.length).toBeGreaterThan(0);
    for (const total of MEET_LOCAL.ghostTotalsKg) {
      expect(typeof total).toBe('number');
      expect(Number.isFinite(total)).toBe(true);
    }
  });

  it('mentions no denied name in any file this piece owns', () => {
    for (const { file, source } of ownedSources()) {
      for (const denied of DENIED) {
        expect(mentions(source, denied), `${file} mentions ${denied}`).toBe(false);
      }
    }
  });

  it('names its own sound assets after what they are, not after anyone', () => {
    for (const id of MEET_SOUND_IDS) {
      for (const denied of DENIED) {
        expect(mentions(id, denied), `cue ${id} names ${denied}`).toBe(false);
      }
    }
    for (const file of everySoundFileName()) {
      for (const denied of DENIED) {
        expect(mentions(file, denied), `asset ${file} names ${denied}`).toBe(false);
      }
    }
  });
});

describe('the meet platform carries no wordmark, structurally', () => {
  it('draws the sponsor banner as geometry with no text payload', () => {
    // A banner that could hold a string is a banner somebody eventually puts a
    // real logo in. Every field is a number: rows, fractions, patch counts.
    for (const [key, value] of Object.entries(GYM_BANNER)) {
      expect(typeof value, `GYM_BANNER.${key} is not a number`).toBe('number');
    }
    for (const [key, value] of Object.entries(GYM_CROWD)) {
      expect(typeof value, `GYM_CROWD.${key} is not a number`).toBe('number');
    }
    expect(GYM_BANNER.PATCH_COUNT).toBeGreaterThan(0);
  });

  it('furnishes the platform only from the closed abstract prop catalogue', () => {
    // `PROP_ART` is a closed union of authored rectangles. None of the meet
    // props is a logo, and none of them can become one without an edit to that
    // union and to the test in `gymScene.test.ts` that pins it.
    const allowed = new Set(['JUDGE_TABLE', 'EQUIPMENT_CASE', 'PLATE_TREE', 'BUMPER_STACK']);
    for (const placement of GYM_PROPS_MEET) {
      expect(allowed.has(placement.ART), `${placement.ART} is not an expected platform prop`).toBe(
        true,
      );
    }
  });

  it('has no glyph renderer in the art layer at all', () => {
    // THE STRUCTURAL CLAIM, checked rather than asserted: `src/card/pixelFont.ts`
    // exists and can draw letters, and nothing under `src/art/` imports it. The
    // room therefore cannot print a wordmark even if somebody wanted it to.
    for (const entry of readdirSync(path.join(SRC, 'art'))) {
      if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue;
      if (entry.endsWith('.test.ts')) continue;
      const source = readFileSync(path.join(SRC, 'art', entry), 'utf8');
      expect(source, `${entry} imports a font`).not.toContain('pixelFont');
    }
    // ...and the font it would have to import really is where this says it is,
    // so the check cannot pass because the path was renamed.
    expect(readFileSync(path.join(ROOT, 'src', 'card', 'pixelFont.ts'), 'utf8').length)
      .toBeGreaterThan(0);
  });
});
