/**
 * NO REAL ATHLETE, BRAND OR COMPANY IDENTITY ON THE MEET SURFACE (GDD §12.3).
 *
 * ===========================================================================
 * THIS FILE DOES NOT KEEP ITS OWN LIST OF NAMES
 * ===========================================================================
 * `src/licensing/realIp.ts` owns the watchlist, and it is the only file in the
 * tree allowed to spell a watched name. An earlier draft of this file carried a
 * denylist of its own; that made it the THIRD bespoke watchlist in the
 * repository, and `realIp.test.ts` correctly reported every name in it as a
 * fresh citation to review. A second list is a second thing to keep current and
 * a second place for a name to be quietly dropped from.
 *
 * So what this file adds is not names. It is THE MEET-SPECIFIC SURFACES —
 * the strings meet day can draw, and the structural reasons the platform cannot
 * carry a mark at all — checked against `REAL_IP_WATCHLIST` through
 * `scanRenderable`, the same default-deny scan the licensing piece applies to
 * its own catalogue.
 *
 * ===========================================================================
 * WHY MEET DAY IS THE RISKY SURFACE
 * ===========================================================================
 *   - THE BANNER OVER THE PLATFORM. A real meet's backdrop is a wall of
 *     equipment sponsors. Ours is `GYM_BANNER`: a stripe and five solid
 *     patches, checked below to be geometry with no text payload at all.
 *     There is no glyph renderer anywhere in `src/art/`, so the room CANNOT
 *     draw a wordmark — a structural property, checked, not a promise.
 *   - THE FEDERATION AND THE MEET NAME. Both invented (GDD §11 leaves
 *     licensing open), and both are strings the weigh-in and the result card
 *     print.
 *   - THE LIFTER AND THE FIELD. `MEET_ENTRY.name` reaches the weigh-in and
 *     in-meet debug beats. GDD §6.5's recap and shareable card preview print
 *     `SHAREABLE_PREVIEW_NAME` (same spelling Create Lifter tests use) so
 *     the published table is not a job-title row. A1's named flight
 *     (`MEET_FIELD_FIXTURE`) is scanned here too — invented initials and
 *     surnames, not a real athlete roster. `ghostTotalsKg` remains a
 *     kilogram list for the residual placing helper; live placing is the
 *     fixture replayed through `meet.ts`.
 *   - THE SOUND CUES. New in this piece, and named after what they are.
 *
 * ===========================================================================
 * WHAT IT IS NOT
 * ===========================================================================
 * Not a proof of absence: `scanRenderable` catches what is on the watchlist.
 * What makes the surface safe is structural — no text in the room, invented
 * names on the flight, numbers for residual ghosts — and the scan is the backstop.
 *
 * `meet.ts` and `resultCard.ts` also mention real federations, as structural
 * references to the sport's rules. `realIp.ts` rules on those in one place for
 * the whole tree; nothing here second-guesses it.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  REAL_IP_WATCHLIST,
  formatContentFindings,
  scanRenderable,
  type RenderableString,
} from '../licensing/realIp';
import { GYM_BANNER, GYM_CROWD, GYM_PROPS_MEET } from '../art/gymTuning';
import { SHAREABLE_PREVIEW_NAME } from '../game/meetPreview';
import { MEET_COPY, MEET_ENTRY, MEET_FIELD_FIXTURE, MEET_LOCAL, MEET_SOUND_IDS } from '../game/meetTuning';
import { everySoundFileName, fileNameForCue } from './soundAssets';

/**
 * A real federation's name, TAKEN FROM THE WATCHLIST AT RUNTIME rather than
 * typed here.
 *
 * `realIp.ts` is the one file in the tree allowed to spell a watched name, and
 * that rule is worth more than the convenience of a literal in a positive
 * control. Reading one back out means this file plants a genuine name without
 * containing one.
 */
const PLANTED_FEDERATION: string =
  REAL_IP_WATCHLIST.find((entry) => entry.kind === 'federation')?.name ?? '';

const SRC = path.join(__dirname, '..');
const ROOT = path.join(SRC, '..');

/**
 * Every string meet day can put on a screen, as `RenderableString`s.
 *
 * `surface`/`path` are what a failure prints, so a hit names the field rather
 * than just the file. The list is written out rather than deep-walked, because
 * the point is to enumerate WHAT THIS PIECE DRAWS — a walk of the module would
 * also sweep up numbers and internal ids and would not notice a new screen
 * reading from somewhere else.
 */
function meetRenderableStrings(): readonly RenderableString[] {
  const out: RenderableString[] = [
    { surface: 'meet', path: 'MEET_LOCAL.federation', value: MEET_LOCAL.federation },
    { surface: 'meet', path: 'MEET_LOCAL.name', value: MEET_LOCAL.name },
    { surface: 'meet', path: 'MEET_LOCAL.id', value: MEET_LOCAL.id },
    { surface: 'meet', path: 'MEET_LOCAL.town', value: MEET_LOCAL.town },
    { surface: 'meet', path: 'MEET_LOCAL.state', value: MEET_LOCAL.state },
    { surface: 'meet', path: 'MEET_LOCAL.country', value: MEET_LOCAL.country },
    { surface: 'meet', path: 'MEET_ENTRY.name', value: MEET_ENTRY.name },
    { surface: 'meet', path: 'SHAREABLE_PREVIEW_NAME', value: SHAREABLE_PREVIEW_NAME },
    { surface: 'meet', path: 'MEET_ENTRY.division', value: MEET_ENTRY.division },
    { surface: 'meet', path: 'MEET_ENTRY.equipment', value: MEET_ENTRY.equipment },
  ];
  if (MEET_LOCAL.standingRecord !== null) {
    out.push({
      surface: 'meet',
      path: 'MEET_LOCAL.standingRecord.holderName',
      value: MEET_LOCAL.standingRecord.holderName,
    });
  }
  for (const spec of MEET_FIELD_FIXTURE) {
    out.push({ surface: 'meet-flight', path: `MEET_FIELD_FIXTURE.${spec.id}.name`, value: spec.name });
  }
  // Every line of copy the meet screens print.
  for (const [key, value] of Object.entries(MEET_COPY)) {
    if (typeof value === 'string') out.push({ surface: 'meet-copy', path: key, value });
    else {
      for (const [inner, text] of Object.entries(value)) {
        if (typeof text === 'string') out.push({ surface: 'meet-copy', path: `${key}.${inner}`, value: text });
      }
    }
  }
  // The generated audio: cue ids and the asset file names they become.
  for (const id of MEET_SOUND_IDS) {
    out.push({ surface: 'meet-sound', path: `MEET_SOUND.CUES.${id}`, value: id });
    out.push({ surface: 'meet-sound', path: `assets/sound/${id}`, value: fileNameForCue(id) });
  }
  return out;
}

describe('nothing meet day can draw is a real identity (GDD §12.3)', () => {
  it('has strings to scan, including the ones a card prints', () => {
    // Without this the scan below passes vacuously on an empty list — which is
    // exactly the shape of blind check this suite is meant not to have.
    const strings = meetRenderableStrings();
    expect(strings.length).toBeGreaterThanOrEqual(30);
    const paths = strings.map((s) => s.path);
    expect(paths).toContain('MEET_LOCAL.federation');
    expect(paths).toContain('MEET_ENTRY.name');
    expect(paths).toContain('SHAREABLE_PREVIEW_NAME');
    expect(paths).toContain(`MEET_FIELD_FIXTURE.${MEET_FIELD_FIXTURE[0]!.id}.name`);
    expect(strings.every((s) => s.value.length >= 0)).toBe(true);
  });

  it('draws no watched name on any meet surface', () => {
    // DEFAULT-DENY, through the licensing piece's own scan and its own
    // watchlist. There is deliberately no allowlist on this half.
    const findings = scanRenderable(meetRenderableStrings());
    expect(findings.length, `\n${formatContentFindings(findings)}\n`).toBe(0);
  });

  it('proves the scan would fire on this surface if a name arrived', () => {
    // The positive control. `scanRenderable` returning nothing is only good
    // news if it CAN return something for a string shaped like ours.
    const planted = [
      ...meetRenderableStrings(),
      { surface: 'meet', path: 'MEET_LOCAL.federation', value: `${MEET_LOCAL.federation} / ${PLANTED_FEDERATION}` },
    ];
    const findings = scanRenderable(planted);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.path).toBe('MEET_LOCAL.federation');
  });

  it('names the lifter with a placeholder nobody could mistake for a person', () => {
    // `A. LIFTER` — an initial and a job title. The point is that it reads as
    // obviously unfilled rather than as a plausible competitor, which is the
    // failure mode §12.3 names: a "realistic" placeholder.
    expect(MEET_ENTRY.name).toMatch(/^[A-Z]\.\s+LIFTER$/);
  });

  it('prints the shareable sheet as a produced identity, not that job title', () => {
    // A2 freeze: the fixture constant stays the placeholder. The GDD §6.5
    // photograph uses the Create Lifter spelling so a weekly reader is not
    // asked to believe a job title won the flight.
    expect(SHAREABLE_PREVIEW_NAME).not.toBe(MEET_ENTRY.name);
    expect(SHAREABLE_PREVIEW_NAME).not.toMatch(/LIFTER/);
    expect(SHAREABLE_PREVIEW_NAME).toMatch(/^[A-Z]\.\s+[A-Z][A-Z-]*$/);
  });

  it('invents a federation and a meet, and does not leave them blank', () => {
    // A denylist passes trivially on an empty string; these are real invented
    // names and the scan above is what says they are not real ones.
    expect(MEET_LOCAL.federation.length).toBeGreaterThan(0);
    expect(MEET_LOCAL.name.length).toBeGreaterThan(0);
  });

  it('fields the ghosts as numbers, and the live flight as invented names', () => {
    // GDD §6.6: local meets resolve against ghost data. The residual helper
    // still takes numbers. A1's live board is a named flight, scanned above
    // so a realistic athlete placeholder cannot land without this file going
    // red.
    expect(MEET_LOCAL.ghostTotalsKg.length).toBeGreaterThan(0);
    for (const total of MEET_LOCAL.ghostTotalsKg) {
      expect(typeof total).toBe('number');
      expect(Number.isFinite(total)).toBe(true);
    }
    expect(MEET_FIELD_FIXTURE.length).toBeGreaterThan(2);
    for (const spec of MEET_FIELD_FIXTURE) {
      expect(spec.name).toMatch(/^[A-Z]\.\s+[A-Z][A-Z-]*$/);
    }
  });

  it('names its sound assets after what they are', () => {
    for (const file of everySoundFileName()) {
      expect(file).toMatch(/^[a-z][a-z-]*\.wav$/);
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
