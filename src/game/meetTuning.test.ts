import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { LIFT_TUNING } from './liftTuning';
import { JUDGE_COUNT, LIFT_ORDER, DEFAULT_MEET_RULES } from './meet';
import { MEET_COPY, MEET_ENTRY, MEET_LAYOUT, MEET_LOCAL, MEET_PREVIEW, MEET_TUNING } from './meetTuning';
import { deliberates, deliberationMs, dissentChance, verdictMs, walkoutMs } from './meetDay';

const HERE = __dirname;
const MEET_UI_DIR = path.join(HERE, '..', 'meet');

// ---------------------------------------------------------------------------
// The three judging thresholds have to sit in a particular order or the tensest
// beat in the piece becomes a spoiler.
// ---------------------------------------------------------------------------

describe('the judging thresholds', () => {
  it('are ordered split < unanimous < deliberation', () => {
    expect(MEET_TUNING.SPLIT_MARGIN).toBeLessThan(MEET_TUNING.UNANIMOUS_MARGIN);
    expect(MEET_TUNING.UNANIMOUS_MARGIN).toBeLessThan(MEET_TUNING.DELIBERATION_MARGIN);
  });

  it('leave a band where the judges deliberate and CANNOT split', () => {
    // THE POINT OF THE ORDERING. If every deliberation ended in a split panel,
    // the beat would announce the verdict before the lights did — GDD §6.2 asks
    // for it precisely so the lifter does not know. So there must exist a real
    // margin that deliberates and comes back 3-0.
    const between = (MEET_TUNING.UNANIMOUS_MARGIN + MEET_TUNING.DELIBERATION_MARGIN) / 2;
    expect(deliberates(between)).toBe(true);
    expect(dissentChance(between)).toBe(0);

    // ...and the band is not a degenerate point: sample it.
    const samples = [0, 1, 2, 3, 4].map(
      (i) =>
        MEET_TUNING.UNANIMOUS_MARGIN +
        ((MEET_TUNING.DELIBERATION_MARGIN - MEET_TUNING.UNANIMOUS_MARGIN) * (i + 1)) / 6,
    );
    for (const margin of samples) {
      expect(deliberates(margin), `margin ${margin}`).toBe(true);
      expect(dissentChance(margin), `margin ${margin}`).toBe(0);
    }
  });

  it('still deliberate on every margin that can split', () => {
    // The other direction: a split that arrived with no beat in front of it
    // would be the moment landing with nothing built up to it.
    for (const margin of [0, MEET_TUNING.SPLIT_MARGIN, MEET_TUNING.UNANIMOUS_MARGIN - 1e-6]) {
      expect(dissentChance(margin), `margin ${margin}`).toBeGreaterThan(0);
      expect(deliberates(margin), `margin ${margin}`).toBe(true);
    }
  });
});

describe('the high-squat threshold', () => {
  it('exceeds half the depth window, or no miss could ever be a close call', () => {
    // A miss is by definition outside the window, so its offset from the ideal
    // moment is already at least the half-width. A threshold at or below that
    // would score every miss at margin 1 and the "you thought you got it" beat
    // could not exist.
    const halfWindowMs = LIFT_TUNING.DEPTH_WINDOW_MS / 2;
    expect(MEET_TUNING.HIGH_SQUAT_UNANIMOUS_OFFSET_MS).toBeGreaterThan(halfWindowMs);

    // And the gap is wide enough that a just-outside miss lands under the
    // deliberation threshold rather than only just under 1.
    const marginOfClosestPossibleMiss = halfWindowMs / MEET_TUNING.HIGH_SQUAT_UNANIMOUS_OFFSET_MS;
    expect(marginOfClosestPossibleMiss).toBeLessThan(MEET_TUNING.DELIBERATION_MARGIN);
  });
});

// ---------------------------------------------------------------------------
// The beats. Pacing is what GDD §12.2 judges, so the SHAPE of the escalation is
// pinned even though none of the values has been played.
// ---------------------------------------------------------------------------

describe('the walk-out beat escalates (GDD §6.2 step 1, §7.2, §12.2)', () => {
  const OPENER = walkoutMs(1, 200, 250, false);
  const SECOND = walkoutMs(2, 210, 250, false);
  const THIRD = walkoutMs(3, 220, 250, false);
  const THIRD_PR = walkoutMs(3, 260, 250, false);
  const THIRD_PR_BOMB = walkoutMs(3, 260, 250, true);

  it('holds a third attempt longer than an opener', () => {
    expect(SECOND).toBe(OPENER);
    expect(THIRD).toBeGreaterThan(OPENER);
  });

  it('holds a PR attempt longer still, and a bomb-risk attempt longest', () => {
    expect(THIRD_PR).toBeGreaterThan(THIRD);
    expect(THIRD_PR_BOMB).toBeGreaterThan(THIRD_PR);
    // The stacked worst case IS the longest hold the piece can produce.
    const everyShape = [OPENER, SECOND, THIRD, THIRD_PR, THIRD_PR_BOMB, walkoutMs(1, 260, 250, false)];
    expect(Math.max(...everyShape)).toBe(THIRD_PR_BOMB);
  });

  it('does not treat a first attempt above a PR as ordinary', () => {
    expect(walkoutMs(1, 260, 250, false)).toBeGreaterThan(OPENER);
  });

  it('has no PR extra when the lifter has no competition best yet', () => {
    // `null` means "never competed", not "a best of zero" — a first meet must
    // not fire the PR beat on every single attempt.
    expect(walkoutMs(1, 200, null, false)).toBe(OPENER);
    expect(walkoutMs(3, 200, null, false)).toBe(THIRD);
  });
});

describe('the judging beats', () => {
  it('take measurably longer on a close call', () => {
    expect(deliberationMs(true)).toBeGreaterThan(deliberationMs(false));
  });

  it('are each long enough to read as their own moment', () => {
    // GDD §6.2 lists the walkout, the deliberation and the lights as separate
    // steps. A beat under a tenth of a second is a frame, not a beat.
    const READABLE_MS = 100;
    expect(MEET_TUNING.WALKOUT_MS).toBeGreaterThan(READABLE_MS);
    expect(deliberationMs(false)).toBeGreaterThan(READABLE_MS);
    expect(deliberationMs(true)).toBeGreaterThan(READABLE_MS);
    expect(MEET_TUNING.LIGHT_REVEAL_STAGGER_MS).toBeGreaterThan(READABLE_MS);
    expect(MEET_TUNING.BOMB_OUT_SILENCE_MS).toBeGreaterThan(READABLE_MS);
  });

  it('reveal every referee before the verdict beat ends', () => {
    // A verdict hold shorter than the light stagger would cut the third lamp
    // off, which on a 2-1 is the entire moment.
    const lastLampAt =
      MEET_TUNING.LIGHT_REVEAL_FIRST_DELAY_MS +
      (JUDGE_COUNT - 1) * MEET_TUNING.LIGHT_REVEAL_STAGGER_MS +
      MEET_TUNING.LIGHT_FADE_MS;
    expect(verdictMs()).toBeGreaterThan(lastLampAt + MEET_TUNING.FEEDBACK_REVEAL_DELAY_MS);
  });
});

describe('the bomb-out beat (GDD §6.3)', () => {
  it('is slower than the recap, because the pacing is the tone', () => {
    expect(MEET_TUNING.BOMB_OUT_ROW_STAGGER_MS).toBeGreaterThan(MEET_TUNING.RECAP_ROW_STAGGER_MS);
    expect(MEET_TUNING.BOMB_OUT_ROW_FADE_MS).toBeGreaterThan(MEET_TUNING.RECAP_ROW_FADE_MS);
  });

  it('says what was NOT lost before it offers the way out', () => {
    // GDD §12.3 forbids a setback that punishes a player for showing up. The
    // screen has to say so before it asks them to leave.
    expect(MEET_TUNING.BOMB_OUT_ROW_ORDER.KEPT).toBeLessThan(MEET_TUNING.BOMB_OUT_ROW_ORDER.ACTION);
    expect(MEET_TUNING.BOMB_OUT_ROW_ORDER.CALL).toBeLessThan(MEET_TUNING.BOMB_OUT_ROW_ORDER.KEPT);
  });
});

describe('the recap (GDD §6.5)', () => {
  it('lands the Total first — it is the only number meet day exists to move', () => {
    const order = MEET_TUNING.RECAP_ROW_ORDER;
    expect(order.TOTAL).toBe(Math.min(order.TOTAL, order.LIFTS, order.DOTS, order.PLACE, order.CARD));
  });
});

// ---------------------------------------------------------------------------
// The meet and the entry
// ---------------------------------------------------------------------------

describe('MEET_LOCAL', () => {
  it('reuses meet.ts\u2019s rules rather than copying them', () => {
    // A copied rule set is two rule sets that can drift, and the one the engine
    // applies would be the other one.
    expect(MEET_LOCAL.rules).toBe(DEFAULT_MEET_RULES);
  });

  it('carries a ghost field that can actually separate placings', () => {
    // GDD §6.6: async meets resolve against ghost data. A field of one, or a
    // field where every ghost is identical, makes the placing on the recap a
    // constant and the check on it vacuous.
    expect(MEET_LOCAL.ghostTotalsKg.length).toBeGreaterThan(2);
    expect(new Set(MEET_LOCAL.ghostTotalsKg).size).toBe(MEET_LOCAL.ghostTotalsKg.length);
  });

  it('has a date the result card can parse', () => {
    expect(MEET_LOCAL.dateIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('runs in kilograms, or the recap has no card and no DOTS', () => {
    // The unit boundary GDD §11 records: `dots.ts` REFUSES a total it cannot
    // prove is kilograms rather than converting one, and `buildResultCard`
    // refuses a pound meet outright (`UNSUPPORTED_MEET_UNIT`) because every
    // column on the sheet is a kilogram column. So a meet configured in pounds
    // reaches GDD §6.5's recap and cannot produce the card or the score it is
    // built around — and it would do it silently, as a null recap, rather than
    // as a failure. Pinning the unit here makes that a test rather than a
    // discovery.
    expect(MEET_LOCAL.rules.unit).toBe('kg');
  });

  it('leaves the real-federation ban to the one watchlist that owns it', () => {
    // THIS TEST USED TO KEEP ITS OWN FIVE-NAME DENYLIST. `src/licensing/realIp.ts`
    // now owns the watchlist for the whole tree and is the only file allowed to
    // spell a watched name; `src/meet/meetIdentity.test.ts` runs its default-deny
    // scan over every string meet day can draw, including this one. A second
    // hand-written list is a second thing to keep current and a second place a
    // name can be quietly dropped from, so the list is gone and what remains is
    // the pointer to where the check lives.
    //
    // What is still asserted here is the part that is this file's business: the
    // federation is INVENTED and not blank. GDD §11 is still open on licensing.
    expect(MEET_LOCAL.federation.length).toBeGreaterThan(0);
    expect(MEET_LOCAL.federation).not.toBe(MEET_LOCAL.name);
  });
});

describe('MEET_PREVIEW', () => {
  it('is a lifter with a history, so PR call-outs are exercisable', () => {
    // A preview whose lifter has never competed can only ever photograph the
    // "first total" branch, which would leave the PR branch unphotographed.
    expect(MEET_PREVIEW.PREVIOUS_BEST_TOTAL_KG).toBeGreaterThan(0);
    for (const lift of LIFT_ORDER) {
      expect(MEET_PREVIEW.PREVIOUS_BEST_BY_LIFT_KG[lift]).toBeGreaterThan(0);
      expect(MEET_PREVIEW.E1RM_KG[lift]).toBeGreaterThan(0);
    }
  });

  it('pins a fixed day, so a capture is reproducible', () => {
    expect(Number.isSafeInteger(MEET_PREVIEW.DAY)).toBe(true);
  });
});

describe('MEET_ENTRY', () => {
  it('carries the sex DOTS needs as an input', () => {
    // `resultCard.ts` refuses to publish a DOTS score while withholding one of
    // its inputs, so an entry without a sex cannot produce a card at all.
    expect(['male', 'female']).toContain(MEET_ENTRY.sex);
    expect(MEET_ENTRY.bodyweight.unit).toBe('kg');
    expect(MEET_ENTRY.bodyweight.kilograms).toBeGreaterThan(0);
  });
});

describe('the copy', () => {
  it('names the bite GDD §6.3 is built on', () => {
    // Not a spelling check: this string is the one place the screen explains
    // WHY a miss is worse than it looks, and §6.3 calls that the whole source
    // of the tension. A blank here is a screen that merely refuses a lower
    // weight without ever saying so.
    expect(MEET_COPY.SELECT_FLOOR_RAISED.length).toBeGreaterThan(0);
    expect(MEET_COPY.SELECT_FLOOR_RAISED).not.toBe(MEET_COPY.SELECT_FLOOR_AFTER_MAKE);
  });

  it('gives a bomb-out its own language rather than a game-over\u2019s', () => {
    const bombText = [
      MEET_COPY.BOMB_OUT_CALL,
      MEET_COPY.BOMB_OUT_WHAT_HAPPENED,
      MEET_COPY.BOMB_OUT_HONEST,
      MEET_COPY.BOMB_OUT_KEPT,
      MEET_COPY.BOMB_OUT_ACTION,
    ]
      .join(' ')
      .toUpperCase();
    for (const forbidden of ['GAME OVER', 'YOU LOSE', 'FAILED', 'TRY AGAIN', 'RETRY']) {
      expect(bombText, `bomb-out copy says "${forbidden}"`).not.toContain(forbidden);
    }
    // ...and it does carry the sport's own word for it.
    expect(MEET_COPY.BOMB_OUT_CALL.toUpperCase()).toContain('NO TOTAL');
  });

  it('has a slot for the bombed lift rather than naming one', () => {
    expect(MEET_COPY.BOMB_OUT_WHAT_HAPPENED).toContain('{lift}');
    for (const lift of LIFT_ORDER) {
      expect(MEET_COPY.BOMB_OUT_WHAT_HAPPENED.toLowerCase()).not.toContain(lift);
    }
  });
});

// ---------------------------------------------------------------------------
// THE MAGIC-NUMBER SCAN
//
// CLAUDE.md: "Never scatter them as magic numbers across components." This is
// the part of that rule that is enforced rather than requested, for meet day's
// own sources. Same scanner, same allowlist and same positive control as
// `sessionTuning.test.ts` and `liftTuning.test.ts`.
// ---------------------------------------------------------------------------

/** Strip comments and string literals so only real code is scanned. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

const STRUCTURAL = new Set(['0', '1', '2']);
const NUMERIC_LITERAL = /(?<![\w.$])(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/gi;

function magicNumbersIn(source: string): string[] {
  const found: string[] = [];
  for (const match of codeOnly(source).matchAll(NUMERIC_LITERAL)) {
    if (STRUCTURAL.has(match[0])) continue;
    found.push(match[0]);
  }
  return found;
}

function sourcesUnder(dir: string): { file: string; source: string }[] {
  const out: { file: string; source: string }[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue;
    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue;
    out.push({ file: path.join(dir, entry), source: readFileSync(path.join(dir, entry), 'utf8') });
  }
  return out;
}

describe('no feel value lives outside meetTuning.ts', () => {
  const uiSources = sourcesUnder(MEET_UI_DIR);
  const gameSources = ['meetDay.ts', 'meetServer.ts', 'meetPreview.ts'].map((name) => ({
    file: name,
    source: readFileSync(path.join(HERE, name), 'utf8'),
  }));

  it('finds the meet screens at all', () => {
    // Without this the scan below passes vacuously on an empty directory —
    // which is the shape of blind check this suite is meant not to have.
    expect(uiSources.length).toBeGreaterThanOrEqual(8);
    expect(uiSources.filter((s) => s.file.endsWith('.tsx')).length).toBeGreaterThanOrEqual(7);
  });

  it('the scan can actually see a magic number', () => {
    // The positive control. A scan that matched nothing would pass every file.
    expect(magicNumbersIn('const gap = 17;')).toEqual(['17']);
    expect(magicNumbersIn('const half = .5;')).toEqual(['.5']);
    expect(magicNumbersIn('const ok = arr[0] + 1 + 2;')).toEqual([]);
    expect(magicNumbersIn('// const gap = 17;')).toEqual([]);
    expect(magicNumbersIn("const s = 'padding: 17px';")).toEqual([]);
    expect(magicNumbersIn('const a = MEET_TUNING.WALKOUT_MS;')).toEqual([]);
  });

  it('the meet screens contain no bare number', () => {
    for (const { file, source } of uiSources) {
      expect(magicNumbersIn(source), path.basename(file)).toEqual([]);
    }
  });

  it('the pure meet modules contain no bare number', () => {
    for (const { file, source } of gameSources) {
      expect(magicNumbersIn(source), file).toEqual([]);
    }
  });

  it('no meet source can reconstruct a fatigue ratio from a base window', () => {
    // The same ban `liftTuning.test.ts` puts on `src/lift/`, for the same
    // reason: `CueWindow.widthMs` is the ADJUSTED window, and a component that
    // divided it by `LIFT_TUNING.DEPTH_WINDOW_MS` would have a 0..1 fatigue
    // ratio one `<View style={{width}}>` away from the meter GDD §12.3
    // refuses. Meet day has no legitimate use for a base width either.
    const files = [...uiSources, ...gameSources];
    expect(files.length).toBeGreaterThan(0);
    for (const { file, source } of files) {
      const code = codeOnly(source);
      for (const base of ['DEPTH_WINDOW_MS', 'DRIVE_WINDOW_MS']) {
        expect(code, `${path.basename(file)} reads ${base}`).not.toContain(base);
      }
    }
    // ...and the scan is not vacuous: it does find them where they belong.
    expect(codeOnly(readFileSync(path.join(HERE, 'lift.ts'), 'utf8'))).toContain('DEPTH_WINDOW_MS');
  });
});

describe('MEET_LAYOUT', () => {
  it('gives the judging lamps a size a thumb-held phone can read', () => {
    expect(MEET_LAYOUT.LIGHT_SIZE).toBeGreaterThan(MEET_LAYOUT.BOARD_CELL_H);
    // A circle, not a rounded rectangle: the radius is half the size.
    expect(MEET_LAYOUT.LIGHT_RADIUS * 2).toBeGreaterThanOrEqual(MEET_LAYOUT.LIGHT_SIZE);
  });

  it('is authored for a phone rather than a desktop', () => {
    // `BAR_W` used to be checked here. It sized the walkout's own vector
    // barbell, which is gone — the walkout draws the sprite's bar now — so the
    // widest authored row left is the recap's attempt board.
    const PHONE_WIDTH_PT = 390;
    expect(MEET_LAYOUT.BOARD_LABEL_W + MEET_LAYOUT.BOARD_CELL_W * 3).toBeLessThan(
      PHONE_WIDTH_PT - MEET_LAYOUT.SCREEN_PAD * 2,
    );
    // ...and the staged beats hand the room the whole width of that phone, at
    // the integer scale GDD §7.1 requires, so there is no fractional column.
    expect(LIFT_TUNING.LAYOUT.STAGE_W).toBe(PHONE_WIDTH_PT);
  });
});

describe('MEET_TUNING.HALL (GDD §12.2 — the beats happen somewhere)', () => {
  it('holds the room back hardest where there is most to read', () => {
    // The ORDERING is the design claim; the values are a starting point that
    // nobody has looked at on a phone (see the header of `meetTuning.ts`). The
    // walkout is three short lines over the hall and the hall is the beat; the
    // judging screen has to let three lamps be the brightest thing on it; the
    // attempt choice is a decision with a paragraph on each card.
    expect(MEET_TUNING.HALL.WALKOUT_SCRIM).toBeLessThan(MEET_TUNING.HALL.JUDGING_SCRIM);
    expect(MEET_TUNING.HALL.JUDGING_SCRIM).toBeLessThan(MEET_TUNING.HALL.CHOICE_SCRIM);
  });

  it('never removes the room outright, and never leaves it at full strength', () => {
    // A scrim of 1 is the black field this piece was sent back for; a scrim of 0
    // under a paragraph is a room competing with the thing the player must read.
    for (const [name, value] of Object.entries(MEET_TUNING.HALL)) {
      expect(value, name).toBeGreaterThan(0);
      expect(value, name).toBeLessThan(1);
    }
    // ...and the loop is not vacuous.
    expect(Object.keys(MEET_TUNING.HALL).length).toBe(3);
  });
});
