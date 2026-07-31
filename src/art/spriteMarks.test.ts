/**
 * Guards on the hand-placed marks.
 *
 * The question this file exists to answer is NOT "does the mark table contain a
 * buckle" — anyone can read that off the source. It is "did the buckle survive
 * the pipeline and reach the rendered grid", because the failure this whole
 * module was written in response to was a set of authored pixels that existed
 * in the source, were drawn, and were then silently removed by `despeckle`
 * before anything wrote a PNG. The sprite's two eye pixels, its mouth pixel and
 * its chalked knuckles were all in the code and none of them were in the image.
 *
 * So every assertion below reads the FINAL grid — after despeckle, after the
 * outline pass — and never the stamper's own report of what it did.
 */

import { describe, expect, it } from 'vitest';
import {
  MARKS,
  MARK_BLANK,
  MARK_INK,
  MARK_SURFACES,
  anchorPoint,
  authoredPixelBudget,
  markPixelCount,
  markTargets,
  type Mark,
  type MarkAnchorKey,
} from './spriteMarks';
import { renderLifterFrame, type LifterFrameSpec } from './lifterSprite';
import { BANK_SIZE, PAL, isAllocatedIndex } from './palette';
import { cloneGrid, despeckle, getPx, type IndexGrid } from './raster';
import { POSES, RIG_GEOMETRY, deformPose, poseAtDepth, strainForLevel } from './rig';
import { PITCH, RESOLUTION, STRAIN } from './spriteTuning';

const BASE: LifterFrameSpec = {
  depth: 0,
  direction: 'ASCENT',
  strainLevel: 0,
  pitchLevel: 0,
  barLateralPx: 0,
  barTiltDeg: 0,
  barBendPx: 0,
  chalkMotes: 0,
  totalKg: 250,
};

const spec = (over: Partial<LifterFrameSpec> = {}): LifterFrameSpec => ({ ...BASE, ...over });

/** Every (depth, direction, strain, pitch) the renderer can be asked for. */
function poseSpace(): LifterFrameSpec[] {
  const out: LifterFrameSpec[] = [];
  for (let step = 0; step <= 12; step += 1) {
    for (const direction of ['DESCENT', 'ASCENT'] as const) {
      for (let s = 0; s < STRAIN.LEVELS; s += 1) {
        for (let p = 0; p < PITCH.LEVELS; p += 1) {
          out.push(spec({ depth: step / 12, direction, strainLevel: s, pitchLevel: p }));
        }
      }
    }
  }
  return out;
}

/** Pixels of a mark that are present in the finished grid, with the right ink. */
function markPixelsInGrid(grid: IndexGrid, mark: Mark, frame: ReturnType<typeof renderLifterFrame>): number {
  const strained = frame.strain > STRAIN.FLUSH_THRESHOLD;
  let found = 0;
  for (const t of markTargets(mark, frame.pose, strained)) {
    if (getPx(grid, t.x, t.y) === t.ink) found += 1;
  }
  return found;
}

// ---------------------------------------------------------------------------
// The table is well formed
// ---------------------------------------------------------------------------

describe('the mark table', () => {
  it('uses only legend characters', () => {
    for (const mark of MARKS) {
      for (const row of mark.map) {
        for (const ch of row) {
          expect(ch === MARK_BLANK || MARK_INK[ch] !== undefined, `${mark.name}: '${ch}'`).toBe(
            true,
          );
        }
      }
    }
  });

  it('keeps every map rectangular, so a row cannot silently shift', () => {
    for (const mark of MARKS) {
      const width = mark.map[0]?.length ?? 0;
      expect(width, mark.name).toBeGreaterThan(0);
      for (const row of mark.map) expect(row.length, mark.name).toBe(width);
    }
  });

  it('names every mark uniquely', () => {
    expect(new Set(MARKS.map((m) => m.name)).size).toBe(MARKS.length);
  });

  it('paints only allocated LIFTER-bank colours', () => {
    // A mark in the EQUIPMENT bank would be counted as barbell by
    // `isBodyIndex`, and the load-response measurement would stop seeing it.
    for (const ink of Object.values(MARK_INK)) {
      expect(isAllocatedIndex(ink)).toBe(true);
      expect(Math.floor(ink / BANK_SIZE)).toBe(0);
    }
  });

  it('never lets a mark paint over an interior outline', () => {
    // The outlines between masses are what keep the arm off the chest. A
    // surface class that admitted PAL.OUTLINE would let a trim mark weld two
    // parts together, and the weld would be invisible in the table.
    for (const [name, allowed] of Object.entries(MARK_SURFACES)) {
      expect(allowed, name).not.toContain(PAL.OUTLINE);
      expect(allowed, name).not.toContain(PAL.EQ_OUTLINE);
    }
  });

  it('resolves every anchor it names to a finite integer point', () => {
    const used = new Set<MarkAnchorKey>(MARKS.map((m) => m.anchor));
    expect(used.size).toBeGreaterThan(8);
    for (const pose of Object.values(POSES)) {
      for (const s of [0, 3]) {
        const deformed = deformPose(pose, strainForLevel(s), 1);
        for (const key of used) {
          for (const sign of [-1, 0, 1]) {
            const p = anchorPoint(key, deformed, sign);
            expect(Number.isInteger(p.x), `${key} x`).toBe(true);
            expect(Number.isInteger(p.y), `${key} y`).toBe(true);
            expect(p.x, `${key} x`).toBeGreaterThan(0);
            expect(p.x, `${key} x`).toBeLessThan(RESOLUTION.CELL_W);
            expect(p.y, `${key} y`).toBeGreaterThan(0);
            expect(p.y, `${key} y`).toBeLessThan(RESOLUTION.CELL_H);
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The marks reach the rendered grid
// ---------------------------------------------------------------------------

/**
 * Floor on hand-placed pixels present in a finished frame.
 *
 * Measured at this authoring: the worst frame in the whole pose space lands 260
 * of a 346-cell budget (the shortfall is marks the body covers at that pose,
 * chiefly the quad sweep once the singlet hem and the knee sleeve meet over the
 * thigh and there is no bare thigh left to draw on). The number to compare it
 * against is what the sprite had before this file existed: SIX marks were
 * written in the source — two eyes, a mouth, a sternum notch and one chalked
 * knuckle per hand — and `despeckle` ate every isolated one of them, so the
 * count that actually reached a PNG was effectively zero.
 */
const FLOOR_MARK_PIXELS_PER_FRAME = 210;

/**
 * Floor on hand-placed pixels that are on BARE FLESH rather than on worn kit.
 *
 * The reason this is a separate number: the previous authoring pass cleared the
 * floor above comfortably while roughly 80% of its authored pixels were objects
 * — shoes, sleeves, belt, wraps, trim, patch, hair — on a bare-armed,
 * bare-legged figure whose largest surface is skin. "Lots of authored pixels"
 * and "the flesh is drawn" turned out to be different claims, so both are
 * floored. Measured at this authoring: anatomy is 49% of all painted authored
 * pixels, and the worst frame lands 108.
 */
const FLOOR_ANATOMY_PIXELS_PER_FRAME = 90;

/**
 * The marks that draw bare flesh, taken from the table's own `depicts` field.
 *
 * The names are ALSO written out here, and that duplication is on purpose: the
 * field is what the tool and the floors read, and this list is what stops a
 * future pass from quietly reclassifying a shoe as flesh to make a floor go
 * green. If the two ever disagree, one of them is wrong and the test says so.
 */
const ANATOMY_MARKS: readonly string[] = MARKS.filter((m) => m.depicts === 'FLESH').map(
  (m) => m.name,
);

const EXPECTED_FLESH_MARKS: readonly string[] = [
  'FACE_CALM',
  'FACE_STRAINED',
  'TRAP_RIDGE_NEAR',
  'TRAP_RIDGE_FAR',
  'TRAP_BAR_SHADOW',
  'PEC_SHELF',
  'STRAP_SHADOW',
  'DELTOID_MASS_NEAR',
  'DELTOID_MASS_FAR',
  'BICEPS_MASS_NEAR',
  'BICEPS_MASS_FAR',
  'ELBOW_CREASE',
  'FOREARM_BELLY_NEAR',
  'FOREARM_BELLY_FAR',
  'QUAD_SWEEP_NEAR',
  'QUAD_SWEEP_FAR',
  'SHIN_CREST_NEAR',
  'SHIN_CREST_FAR',
  'CALF_TAPER',
  'ANKLE_SHADOW',
];

describe('marks reach the pixels', () => {
  it('puts a large, counted number of authored pixels into every frame', () => {
    for (const s of poseSpace()) {
      const frame = renderLifterFrame(s);
      let found = 0;
      for (const mark of MARKS) found += markPixelsInGrid(frame.grid, mark, frame);
      expect(
        found,
        `depth ${s.depth.toFixed(2)} ${s.direction} strain ${s.strainLevel} pitch ${s.pitchLevel}`,
      ).toBeGreaterThan(FLOOR_MARK_PIXELS_PER_FRAME);
    }
  });

  it('puts most of those pixels on FLESH, not on worn kit', () => {
    // The finding this exists for, in the critic's words: "the kit got drawn,
    // the flesh did not". Shoes, sleeves, belt, wraps, trim, patch and hair
    // landed at 90-100% and accounted for four fifths of every authored pixel,
    // while the marks meant to break the ramp at anatomy landed 31-68% of the
    // time. A budget test cannot see that; this one can.
    expect([...ANATOMY_MARKS].sort()).toEqual([...EXPECTED_FLESH_MARKS].sort());

    for (const s of poseSpace()) {
      const frame = renderLifterFrame(s);
      let anatomy = 0;
      let total = 0;
      for (const mark of MARKS) {
        const found = markPixelsInGrid(frame.grid, mark, frame);
        total += found;
        if (ANATOMY_MARKS.includes(mark.name)) anatomy += found;
      }
      const where = `depth ${s.depth.toFixed(2)} ${s.direction} s${s.strainLevel} p${s.pitchLevel}`;
      expect(anatomy, where).toBeGreaterThan(FLOOR_ANATOMY_PIXELS_PER_FRAME);
      expect(anatomy / total, `anatomy share, ${where}`).toBeGreaterThan(0.4);
    }
  });

  it('lands every anatomy mark on most of the pixels it asks for', () => {
    // "A mark that lands a third of the time is not doing its job." Measured
    // over the whole pose space at this authoring, every anatomy mark clears
    // 75% except the two quad sweeps, which cannot: below about half depth the
    // singlet hem and the knee sleeve meet over the thigh and there is no bare
    // thigh anywhere in the frame to paint on. That is a coverage fact about
    // the drawing, not a misplaced mark, so they get their own lower floor
    // rather than a fudged shared one.
    const LOW_BY_COVERAGE = new Set(['QUAD_SWEEP_NEAR', 'QUAD_SWEEP_FAR']);
    const req = new Map<string, number>();
    const got = new Map<string, number>();
    for (const s of poseSpace()) {
      const frame = renderLifterFrame(s);
      const strained = frame.strain > STRAIN.FLUSH_THRESHOLD;
      for (const mark of MARKS) {
        if (!ANATOMY_MARKS.includes(mark.name)) continue;
        req.set(mark.name, (req.get(mark.name) ?? 0) + markTargets(mark, frame.pose, strained).length);
        got.set(mark.name, (got.get(mark.name) ?? 0) + markPixelsInGrid(frame.grid, mark, frame));
      }
    }
    for (const name of ANATOMY_MARKS) {
      const asked = req.get(name) ?? 0;
      expect(asked, name).toBeGreaterThan(0);
      const rate = (got.get(name) ?? 0) / asked;
      expect(rate, `${name} landed ${(rate * 100).toFixed(0)}%`).toBeGreaterThan(
        LOW_BY_COVERAGE.has(name) ? 0.35 : 0.7,
      );
    }
  });

  it('has no dead mark: every one lands somewhere in the pose space', () => {
    const best = new Map<string, number>();
    for (const s of poseSpace()) {
      const frame = renderLifterFrame(s);
      for (const mark of MARKS) {
        const found = markPixelsInGrid(frame.grid, mark, frame);
        best.set(mark.name, Math.max(best.get(mark.name) ?? 0, found));
      }
    }
    for (const mark of MARKS) {
      expect(best.get(mark.name) ?? 0, `${mark.name} never landed`).toBeGreaterThan(0);
    }
  });

  it('lands the always-on objects on EVERY frame, not just somewhere', () => {
    // These are worn kit and anatomy that never leaves the silhouette. A pose
    // where the buckle or the sole vanishes is a bug, not a coverage effect —
    // unlike the quad marks, which are supposed to disappear under the singlet.
    const alwaysOn = [
      'BELT_LEVER',
      'SHOE_SOLE',
      'SHOE_LACES',
      'KNEE_SLEEVE_TOP_BAND',
      'KNEE_SLEEVE_HEM',
      'WRIST_WRAP',
      'SINGLET_HEM_TRIM',
      'HAIR_FRINGE',
      'DELTOID_MASS_NEAR',
      'DELTOID_MASS_FAR',
      'ELBOW_CREASE',
      'CALF_TAPER',
      'ANKLE_SHADOW',
    ];
    for (const s of poseSpace()) {
      const frame = renderLifterFrame(s);
      for (const name of alwaysOn) {
        const mark = MARKS.find((m) => m.name === name);
        expect(mark, name).toBeDefined();
        if (mark === undefined) continue;
        expect(
          markPixelsInGrid(frame.grid, mark, frame),
          `${name} at depth ${s.depth.toFixed(2)} ${s.direction} s${s.strainLevel} p${s.pitchLevel}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('gives the face a mouth and both eyes at every depth', () => {
    // The specific pixels that were being eaten. One of them is a lone pixel
    // with no like-coloured neighbour anywhere, which is exactly the shape
    // `despeckle` removes, so this is the sharpest version of the check.
    for (const s of poseSpace()) {
      const frame = renderLifterFrame(s);
      const strained = frame.strain > STRAIN.FLUSH_THRESHOLD;
      const face = MARKS.find((m) => m.name === (strained ? 'FACE_STRAINED' : 'FACE_CALM'));
      expect(face).toBeDefined();
      if (face === undefined) continue;
      expect(
        markPixelsInGrid(frame.grid, face, frame),
        `face at depth ${s.depth.toFixed(2)} ${s.direction} s${s.strainLevel}`,
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// The pipeline order is load-bearing
// ---------------------------------------------------------------------------

describe('marks are stamped after despeckle, and that matters', () => {
  it('would lose authored pixels if despeckle ran after them', () => {
    // Not a hypothetical. Run the pass the marks currently escape and count
    // what it takes: if this number is ever 0, the ordering constraint has
    // stopped being load-bearing and the comment explaining it is stale.
    const frame = renderLifterFrame(spec({ depth: 0 }));
    const after = cloneGrid(frame.grid);
    despeckle(after);

    let eaten = 0;
    for (const mark of MARKS) {
      for (const t of markTargets(mark, frame.pose, frame.strain > STRAIN.FLUSH_THRESHOLD)) {
        if (getPx(frame.grid, t.x, t.y) === t.ink && getPx(after, t.x, t.y) !== t.ink) eaten += 1;
      }
    }
    expect(eaten).toBeGreaterThan(0);
  });

  it('reports placements that agree with the finished grid', () => {
    // `RenderedFrame.marks` is what the inspection tool prints. If it ever
    // over-reports, the tool becomes a way to claim marks that are not there.
    //
    // Marks may legitimately overwrite each other — the table is applied head
    // to foot and a later mark wins, which is how the far deltoid takes back
    // the pixels the far strap's shadow claimed on the arm. So the check is on
    // the pixels NO later mark also asks for: those must survive exactly, since
    // nothing else downstream of the mark layer is allowed to touch them.
    for (const s of poseSpace()) {
      const frame = renderLifterFrame(s);
      const strained = frame.strain > STRAIN.FLUSH_THRESHOLD;
      const claimedLater = new Set<string>();
      const uncontested: { name: string; keys: string[] }[] = [];
      for (let i = MARKS.length - 1; i >= 0; i -= 1) {
        const mark = MARKS[i];
        if (mark === undefined) continue;
        const keys: string[] = [];
        for (const t of markTargets(mark, frame.pose, strained)) {
          const key = `${t.x},${t.y}`;
          if (!claimedLater.has(key)) keys.push(key);
        }
        uncontested.push({ name: mark.name, keys });
        for (const t of markTargets(mark, frame.pose, strained)) {
          claimedLater.add(`${t.x},${t.y}`);
        }
      }

      for (const placement of frame.marks) {
        const mark = MARKS.find((m) => m.name === placement.name);
        const own = uncontested.find((u) => u.name === placement.name);
        expect(mark).toBeDefined();
        expect(own).toBeDefined();
        if (mark === undefined || own === undefined) continue;
        const keys = new Set(own.keys);
        const allowed = MARK_SURFACES[mark.over];
        for (const t of markTargets(mark, frame.pose, strained)) {
          if (!keys.has(`${t.x},${t.y}`)) continue;
          const got = getPx(frame.grid, t.x, t.y);
          // Either the mark's ink is there, or the pixel was never eligible for
          // it in the first place. There is no third case: nothing downstream
          // of the mark layer may repaint an eligible pixel.
          expect(
            got === t.ink || !allowed.includes(got),
            `${placement.name} at ${t.x},${t.y} depth ${s.depth.toFixed(2)} ${s.direction}`,
          ).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Specific objects, at specific pixels
// ---------------------------------------------------------------------------

describe('the objects the critique named', () => {
  it('draws a belt with a buckle on it, not a plain band', () => {
    const frame = renderLifterFrame(spec({ depth: 0 }));
    const belt = anchorPoint('BELT', frame.pose, 0);
    // The lever arm: two lit pixels stacked in the middle of a dark plate.
    expect(getPx(frame.grid, belt.x, belt.y)).toBe(PAL.GEAR_LIGHT);
    expect(getPx(frame.grid, belt.x, belt.y + 1)).toBe(PAL.GEAR_LIGHT);
    // ...framed left and right by the plate.
    expect(getPx(frame.grid, belt.x - 1, belt.y)).toBe(PAL.OUTLINE);
    expect(getPx(frame.grid, belt.x + 1, belt.y)).toBe(PAL.OUTLINE);
  });

  it('draws a shoe with a sole line under a dark upper', () => {
    const frame = renderLifterFrame(spec({ depth: 0 }));
    for (const sign of [-1, 1]) {
      const shoe = anchorPoint('SHOE', frame.pose, sign);
      let sole = 0;
      let upper = 0;
      for (let dx = -4; dx <= 4; dx += 1) {
        if (getPx(frame.grid, shoe.x + dx, shoe.y + 2) === PAL.GEAR_LIGHT) sole += 1;
        if (getPx(frame.grid, shoe.x + dx, shoe.y + 1) === PAL.GEAR_DARK) upper += 1;
      }
      expect(sole, `sole, sign ${sign}`).toBeGreaterThanOrEqual(6);
      expect(upper, `upper, sign ${sign}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('gives the shoe the three rows FOOT_H claims, so the sole is its own row', () => {
    const frame = renderLifterFrame(spec({ depth: 0 }));
    const shoe = anchorPoint('SHOE', frame.pose, -1);
    const gear = new Set([PAL.GEAR_DARK, PAL.GEAR_MID, PAL.GEAR_LIGHT]);
    let rows = 0;
    for (let dy = 0; dy < 6; dy += 1) {
      let any = false;
      for (let dx = -4; dx <= 4; dx += 1) {
        if (gear.has(getPx(frame.grid, shoe.x + dx, shoe.y + dy))) any = true;
      }
      if (any) rows += 1;
    }
    expect(rows).toBe(RIG_GEOMETRY.FOOT_H);
  });

  it('breaks the arm ramp between the deltoid and the biceps', () => {
    // The critique: "an arm highlight that is BROKEN into a deltoid mass and a
    // separate biceps mass rather than running continuously down the limb."
    // Read the near arm's lit column down the rows and require a dark step
    // between two lighter ones, rather than one uninterrupted run.
    const frame = renderLifterFrame(spec({ depth: 0 }));
    const delt = anchorPoint('DELTOID', frame.pose, -1);
    const ramp = [PAL.SKIN_SHADOW, PAL.SKIN_MID, PAL.SKIN_LIGHT, PAL.SKIN_HI];
    const stepAt = (y: number): number => {
      let best = -1;
      for (let dx = -4; dx <= 1; dx += 1) best = Math.max(best, ramp.indexOf(getPx(frame.grid, delt.x + dx, y)));
      return best;
    };
    const above = Math.max(stepAt(delt.y - 2), stepAt(delt.y - 1));
    const crease = stepAt(delt.y + 1);
    const below = Math.max(stepAt(delt.y + 2), stepAt(delt.y + 3));
    expect(crease).toBeLessThan(above);
    expect(crease).toBeLessThan(below);
  });

  it('bands the knee sleeve instead of leaving it a plain shaded tube', () => {
    const frame = renderLifterFrame(spec({ depth: 0.5 }));
    for (const sign of [-1, 1]) {
      const top = anchorPoint('SLEEVE_TOP', frame.pose, sign);
      let band = 0;
      for (let dx = -4; dx <= 3; dx += 1) {
        for (const dy of [-2, -1]) {
          if (getPx(frame.grid, top.x + dx, top.y + dy) === PAL.GEAR_DARK) band += 1;
        }
      }
      expect(band, `sleeve band, sign ${sign}`).toBeGreaterThanOrEqual(4);
    }
  });

  it('puts a strap shadow on the bare chest', () => {
    const frame = renderLifterFrame(spec({ depth: 0 }));
    for (const sign of [-1, 1]) {
      const strap = anchorPoint('STRAP', frame.pose, sign);
      let shade = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        if (getPx(frame.grid, strap.x + 2, strap.y + dy) === PAL.SKIN_SHADOW) shade += 1;
      }
      expect(shade, `strap shadow, sign ${sign}`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// The marks do not undo what was already right
// ---------------------------------------------------------------------------

describe('marks respect the shading the underpainting establishes', () => {
  it('never paints the far deltoid as light as the near one', () => {
    // FAR_LIMB_STEP_BIAS is what separates the two arms in depth. A single
    // mirrored highlight map applied to both sides would erase it, which is why
    // the deltoid is authored twice.
    const near = MARKS.find((m) => m.name === 'DELTOID_MASS_NEAR');
    const far = MARKS.find((m) => m.name === 'DELTOID_MASS_FAR');
    expect(near).toBeDefined();
    expect(far).toBeDefined();
    if (near === undefined || far === undefined) return;
    const ramp = [PAL.SKIN_SHADOW, PAL.SKIN_MID, PAL.SKIN_LIGHT, PAL.SKIN_HI];
    const brightest = (mark: Mark): number => {
      let best = -1;
      for (const row of mark.map) {
        for (const ch of row) {
          const ink = MARK_INK[ch];
          if (ink !== undefined) best = Math.max(best, ramp.indexOf(ink));
        }
      }
      return best;
    };
    expect(brightest(far)).toBeLessThan(brightest(near));
  });

  it('leaves the sprite mirror-asymmetric', () => {
    const { grid } = renderLifterFrame(spec({ depth: 0.5, strainLevel: 2 }));
    let mirrored = 0;
    let total = 0;
    for (let y = 0; y < grid.h; y += 1) {
      for (let x = 0; x < grid.w; x += 1) {
        const a = getPx(grid, x, y);
        const b = getPx(grid, grid.w - 1 - x, y);
        if (a === 0 && b === 0) continue;
        total += 1;
        if (a === b) mirrored += 1;
      }
    }
    expect(mirrored / total).toBeLessThan(0.9);
  });
});

// ---------------------------------------------------------------------------
// Budget arithmetic
// ---------------------------------------------------------------------------

describe('authored pixel budget', () => {
  it('counts map cells times sides', () => {
    const single = MARKS.find((m) => m.side === 'CENTER');
    const paired = MARKS.find((m) => m.side === 'BOTH');
    expect(single).toBeDefined();
    expect(paired).toBeDefined();
    if (single === undefined || paired === undefined) return;
    const cells = (m: Mark): number =>
      m.map.reduce((n, row) => n + [...row].filter((c) => c !== MARK_BLANK).length, 0);
    expect(markPixelCount(single)).toBe(cells(single));
    expect(markPixelCount(paired)).toBe(cells(paired) * 2);
    expect(authoredPixelBudget()).toBe(MARKS.reduce((n, m) => n + markPixelCount(m), 0));
  });

  it('is worth more than the six marks the sprite had before', () => {
    expect(authoredPixelBudget()).toBeGreaterThan(200);
  });

  it('does not move when the pose does — the table is data, not a generator', () => {
    // The budget is a property of the table. If it ever varied with the pose,
    // something would be synthesising marks from geometry, which is the exact
    // failure this module was written to avoid.
    for (const depth of [0, 0.5, 1]) {
      poseAtDepth(depth, 'ASCENT');
      expect(authoredPixelBudget()).toBe(346);
    }
  });
});
