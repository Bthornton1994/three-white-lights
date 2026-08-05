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

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
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
import { inCapsule } from './craftMetrics';
import { BANK_SIZE, PAL, isAllocatedIndex } from './palette';
import { cloneGrid, despeckle, getPx, type IndexGrid } from './raster';
import {
  POSES,
  RIG_GEOMETRY,
  deformPose,
  poseAtDepth,
  strainForLevel,
  upperArmSpan,
} from './rig';
import { BRACE_SETTLE_DEPTH, CENTER_X, PITCH, RESOLUTION, STRAIN } from './spriteTuning';

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

/**
 * Frames the sweep above actually contains.
 *
 * OURS, and DERIVED rather than typed: it is `poseSpace().length`, so it moves
 * the day `STRAIN.LEVELS` or `PITCH.LEVELS` does and every sentence tagged
 * `@ours POSE_SPACE_FRAMES` goes red with it. It is the denominator of every
 * "n of all frames" sentence in this file and in `rig.ts`.
 */
const POSE_SPACE_FRAMES = poseSpace().length;

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
 * Measured at this authoring: the worst frame in the whole pose space lands 256
 * of a 342-cell budget (the shortfall is marks the body covers at that pose,
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
 * floored. Measured at this authoring: flesh is 50% of every painted authored
 * pixel over the whole pose space, against 24% before this pass.
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

/**
 * How much of what a mark asks for has to actually reach the finished grid.
 *
 * ONE FLOOR FOR EVERY MARK, KIT AND FLESH ALIKE. It used to be flesh only: the
 * landing test below opened with `if (!ANATOMY_MARKS.includes(mark.name))
 * continue`, so no KIT mark was measured by it at all — and the one kit mark an
 * arm can eat, the singlet's shoulder strap, was the lowest-landing mark on the
 * whole sheet at 46% while three separate guards looked straight past it. (That
 * 46% is HISTORICAL — it describes the rig of the round that found it and is not
 * reproducible against the drawing this file renders today, which lands the
 * aggregate at `@ours STRAP_SEAM|ALL = 63.7%`. Every rate that IS current is
 * pinned in `MARK_LANDING_MEASURED`; this one is left as a note on why the floor changed
 * shape, and should not be read as a measurement of anything shipping.) The
 * `alwaysOn` list two tests down carries `SINGLET_HEM_TRIM` (the waist) and not
 * `STRAP_SEAM` (the shoulder); "no dead mark" only needs a mark to land SOMEWHERE
 * in the pose space; and the one test with "strap" in its name reads chest
 * shading two px inboard of the strap and stays green with the strap's own pixels
 * entirely gone.
 *
 * AND IT IS MEASURED PER SIDE, not just in aggregate. The straps are the case
 * that forces it: at the shipped rig the NEAR strap seam lands
 * `@ours STRAP_SEAM|NEAR = 99.8%` of its pixels and the FAR one
 * `@ours STRAP_SEAM|FAR = 27.5%`. The aggregate of those two is
 * `@ours STRAP_SEAM|ALL = 63.7%`, which is a number that looks like a coverage
 * fact and is actually one side at full
 * strength and one side nearly gone. Every `side: 'BOTH'` mark is now floored on
 * each side separately AND on the aggregate, so nothing gets weaker and
 * asymmetric loss stops hiding.
 *
 * (The `@ours` tags are not decoration. Every rate in this file's prose used to
 * be a THIRD copy of a number — the pair in `MARK_LANDING_MEASURED`, the string
 * it prints, and then the sentence quoting it — and only the first two were
 * compared. A tag is scanned and compared to the pinned pair by 'agrees with
 * every landing rate any comment states', the same way `@ref` handles reference
 * figures in `lifterSprite.test.ts`.)
 *
 * ---------------------------------------------------------------------------
 * WHY ONE SIDE AND NOT THE OTHER, ON A RIG WHERE EVERYTHING IS MIRRORED
 * ---------------------------------------------------------------------------
 *
 * THIS PARAGRAPH USED TO SAY "the far deltoid sits over the far strap's outer
 * flank", and `MARK_LANDING_EXCEPTIONS` forty lines down said the opposite in
 * the same file — that the deltoid is drawn BEFORE the straps and therefore
 * cannot cover them. The second one was right, and a builder who acted on this
 * one would have gone to `ATTACH.DELTOID` / `ATTACH.DELTOID_R` and found nothing
 * to move: at the shipped rig a deltoid cap's painted disc contains
 * `@ours SEAM_PIXELS_UNDER_DELTOID = 3` seam pixels in the whole
 * `@ours POSE_SPACE_FRAMES = 416`-frame pose space, and the strap capsule — laid
 * down by
 * the same `drawTorso` call, after the caps — covers all three. Two comments in
 * one file carrying contradictory measured claims, both surviving because a
 * sentence has no way to fail, is the exact defect `lifterSprite.test.ts` calls
 * THE DEFECT CLASS THIS WHOLE PIECE HAS BEEN FIGHTING, one category over: this
 * pair is ours-prose rather than a reference figure, so the `@ref` convention
 * that kills it for references never looked at it. So the cause is named once,
 * here, and every
 * step of it is asserted by 'the far strap seam is eaten by the far ARM' below
 * rather than argued.
 *
 * The cause is that the seam column is placed UNMIRRORED against a MIRRORED
 * anchor. `anchorPoint('STRAP')` is `CENTER_X + sign * ...`, so the two strap
 * anchors are exact mirror images. `markTargets` then adds the origin as plain
 * screen x — `x: anchor.x + ox + col` — and `STRAP_SEAM`'s origin is `[1, 1]`.
 * So the seam column lands one px screen-RIGHT of the strap axis on both sides,
 * which is INBOARD on the near side and OUTBOARD on the far side.
 *
 * WHAT IS ASSERTED ABOUT THE SYMMETRY, AND WHAT IS ONLY READ OFF THE SOURCE.
 * This paragraph used to say "the strap capsule, the deltoid disc and `drawArm`'s
 * upper-arm capsule are all `CENTER_X + sign * ...` ... this one asymmetry is the
 * whole of it", and offered `mirroredAnchors` at all
 * `@ours POSE_SPACE_FRAMES = 416` frames below as the proof of it.
 * That pin covers the strap ANCHOR alone. Three of the four things the sentence
 * named were not asserted anywhere — on a rig whose own header advertises three
 * deliberate asymmetries, one of them on the arm. So, exactly:
 *
 *   - the strap ANCHOR is asserted mirror-symmetric at every pose
 *     (`mirroredAnchors`);
 *   - the UPPER ARM is asserted mirror-symmetric at every pose, all three points
 *     `drawArm` draws between (`mirroredArms`, added because
 *     `RIG_GEOMETRY.GRIP_ASYMMETRY_PX` already breaks the arm's symmetry at
 *     `handX` and extending it to `elbowX` would have moved this whole split
 *     while the suite stayed green);
 *   - the strap CAPSULE and the DELTOID DISC are NOT asserted symmetric. They are
 *     `CENTER_X + sign * ...` with sign-independent radii in `drawTorso`, which is
 *     read off the source and is not a measurement. Neither can produce the split
 *     anyway: the strap capsule is what the seam is drawn ON, and the deltoid is
 *     bounded at THREE seam pixels in the whole pose space, asserted below;
 *   - the two sides otherwise differ only in lighting
 *     (`SHADING.FAR_LIMB_LIGHT_SCALE`), which moves no pixel.
 *
 * So the seam origin is the only asymmetry in the neighbourhood that is BOTH
 * asserted and able to move a pixel, and it accounts for
 * `@ours FAR_SEAM_MISSES_INSIDE_ARM = 904` of the `@ours FAR_SEAM_MISSES = 905`
 * far misses. One does not fall inside the arm at all and is not diagnosed; see
 * `FAR_SEAM_ARM_JOIN`. "This one asymmetry is the whole of it" was the old
 * sentence and it was one pixel too strong.
 *
 * What that costs: the far seam sits on the arm's side of the strap and the near
 * seam on the chest's. `renderLifterFrame` draws the torso before both arms, so
 * the far arm paints over its seam and the near arm never reaches its own.
 * Measured over the pose space and asserted below: the far seam is inside the far
 * upper arm's drawn outline in `@ours FAR_SEAM_PIXELS_INSIDE_ARM = 906` of the
 * `@ours SEAM_ROWS_MEASURED = 1248` (frame, row) pairs a side has, and the near
 * seam is inside the near one in ZERO of them; every far-side miss is a SKIN
 * pixel in the finished grid; AND THOSE ARE THE SAME PIXELS —
 * `@ours FAR_SEAM_MISSES_INSIDE_ARM = 904` of the
 * `@ours FAR_SEAM_MISSES = 905` misses are inside the arm,
 * `@ours FAR_SEAM_ARM_JOIN.missInFill = 55` in its fill and
 * `@ours FAR_SEAM_ARM_JOIN.missInRing = 849` in its one-px contour ring, with
 * `@ours FAR_SEAM_ARM_JOIN.landedInRing = 2`
 * covered pixels landing anyway and `@ours FAR_SEAM_ARM_JOIN.missOutside = 1`
 * miss outside the arm entirely
 * (`FAR_SEAM_ARM_JOIN`, which is the join those two counts never made). The
 * deltoid disc touches three seam pixels in the whole pose space and the strap
 * capsule, which `drawTorso` draws after it, covers all three.
 *
 * SO THE LEVER IS THE PAIR (`STRAP_SEAM.origin`, `ATTACH.ARM_ROOT` /
 * `UPPER_ARM_R[0]`) — which side of the axis the seam is authored on, and where
 * the arm's inboard flank runs. It is NOT the deltoid. And the half of the pair
 * that does the work is the RADIUS, because
 * `@ours FAR_SEAM_ARM_JOIN.missInRing = 849` of the
 * `@ours FAR_SEAM_MISSES_INSIDE_ARM = 904` seam pixels the arm
 * eats are eaten by its one-px CONTOUR RING and only
 * `@ours FAR_SEAM_ARM_JOIN.missInFill = 55` by its body. Whoever
 * moves either half owns this number and has to come back and re-measure it.
 */
const MARK_LANDING_FLOOR = 0.7;

/**
 * Marks that cannot meet `MARK_LANDING_FLOOR`, each with the floor it gets and
 * the reason, keyed `NAME|ALL`, `NAME|NEAR` or `NAME|FAR`.
 *
 * Every number here is OURS, measured over the whole pose space at this
 * authoring, and none of them is a target.
 *
 * THE RATCHET IS `MARK_LANDING_MEASURED`, NOT THIS BLOCK. This doc used to claim
 * that each floor "sits just under what the drawing currently does, so the next
 * change that eats one of these goes red" — which is true of the floors, and is
 * NOT the ratchet it was being read as. A floor only fires downward: the rates
 * quoted in the comments below could all improve, or drift up by a few points,
 * and every quoted percentage would silently become false prose while the suite
 * stayed green. Eight numbers, unfalsifiable, in the block whose whole job is to
 * be the honest record of what the drawing does.
 *
 * So the eight rates are pinned separately and in BOTH directions, in
 * `MARK_LANDING_MEASURED`, and the floors below are left as floors.
 */
const MARK_LANDING_EXCEPTIONS: Readonly<Record<string, number>> = {
  // `@ours QUAD_SWEEP_NEAR|ALL = 58.8%` and `@ours QUAD_SWEEP_FAR|ALL = 59.1%`.
  // Past about two thirds depth the singlet hem and the knee sleeve meet over the
  // thigh and there is no bare thigh anywhere in the frame to paint on. That is a coverage fact about a squat seen from the front, not
  // a misplaced mark. Was 0.35 before the sleeve was shortened and the hem put
  // on the thigh; 0.5 is what stops that being given back quietly.
  'QUAD_SWEEP_NEAR|ALL': 0.5,
  'QUAD_SWEEP_FAR|ALL': 0.5,
  // `@ours SHOE_UPPER|ALL = 56.0%`, both sides equally
  // (`@ours SHOE_UPPER|NEAR = 56.0%`, `@ours SHOE_UPPER|FAR = 56.0%`), and NOT a
  // defect: the laces are stamped on top of it. All three shoe bands are nine-px
  // maps at the same anchor, and the shoe is drawn about seven px wide (`FOOT_W` 9
  // less `EDGE_INSET_PX` at each end), so SHOE_COLLAR and SHOE_SOLE both land
  // `@ours SHOE_COLLAR|ALL = 78.2%` and `@ours SHOE_SOLE|ALL = 78.2%` — the outer
  // columns fall off the shoe. SHOE_UPPER shares its row with SHOE_LACES, two px of chalk applied
  // AFTER it, and `@ours SHOE_COLLAR|ALL = 78.2%` less 2/9 is
  // `@ours SHOE_UPPER|ALL = 56.0%` exactly. `markPixelsInGrid` counts a pixel
  // a later mark legitimately won as not landed; the 'reports placements that
  // agree with the finished grid' test below is the one that handles contested
  // pixels properly. Pinned here so the band cannot quietly lose more than the
  // laces take.
  'SHOE_UPPER|ALL': 0.5,
  'SHOE_UPPER|NEAR': 0.5,
  'SHOE_UPPER|FAR': 0.5,
  // `@ours STRAP_SEAM|ALL = 63.7%` aggregate, `@ours STRAP_SEAM|NEAR = 99.8%`
  // near, `@ours STRAP_SEAM|FAR = 27.5%` far. THE FAR STRAP IS THE ONE THAT
  // MATTERS, and what eats it is the far ARM — not the deltoid, which
  // `drawTorso` draws BEFORE the straps and therefore cannot cover them.
  // `renderLifterFrame` draws the whole torso, then `drawArm(sign +1)`, and the
  // far seam column sits OUTBOARD of the far strap axis where the near one sits
  // inboard of the near axis, so the far arm's inboard flank runs across it and
  // the near arm never reaches its own. That asymmetry is `STRAP_SEAM.origin`
  // being applied unmirrored against a mirrored anchor; the full derivation is on
  // `MARK_LANDING_FLOOR`, which now also says which steps are asserted and which
  // are read off the source rather than measured. The join between "the arm
  // covers it" and "it fails to land" — the step that makes this a cause and not
  // two coincidences — is `FAR_SEAM_ARM_JOIN`:
  // `@ours FAR_SEAM_MISSES_INSIDE_ARM = 904` of the `@ours FAR_SEAM_MISSES = 905`
  // far misses, with
  // one left over that the arm does not cover and nothing here explains. So the
  // seam survives in `@ours FAR_SEAM_FRAMES_SURVIVING = 210` of
  // `@ours POSE_SPACE_FRAMES = 416` frames, partially. That much is anatomy — from
  // the front an arm does cross a singlet strap — and it is why this gets a
  // floor rather than a place in `alwaysOn`, which it could not meet.
  //
  // What the floor is FOR is the other direction: every px of upper arm added
  // inboard comes straight off this number, and nothing else in the suite can
  // see it. Re-bellying `UPPER_ARM_R` at 3.0 takes the far seam to 10.4% and the
  // aggregate to 55.1%; at 3.4, 2.7% and 49.6%. Both fire here, on both keys.
  // THOSE FOUR BELLY FIGURES ARE A RECORD, NOT A CHECKED NUMBER: they describe a
  // three-radius chain that `drawArm` no longer builds, and nothing in the tree
  // can reproduce them without splicing the belly back in. The three CONE rates
  // beside them are pinned in `MARK_LANDING_MEASURED` and cannot go stale.
  'STRAP_SEAM|ALL': 0.6,
  'STRAP_SEAM|FAR': 0.25,
  // `@ours TRAP_BAR_SHADOW|FAR = 64.1%` far against
  // `@ours TRAP_BAR_SHADOW|NEAR = 92.3%` near, and THE CAUSE IS NOT DIAGNOSED —
  // said plainly rather than guessed at, because the exception beside it (SHOE_UPPER) had a
  // plausible-sounding mechanism written for it that the arithmetic then refuted.
  // What is measured is the asymmetry and nothing else.
  //
  // It was found by turning the per-side floor on, and it is the second thing
  // that found: the aggregate is `@ours TRAP_BAR_SHADOW|ALL = 78.2%` and cleared
  // the general floor comfortably, which is exactly the blindness that hid the strap. Recorded and
  // pinned rather than fixed — a bar-contact cue that lands on two thirds of the
  // far trap is a mark-placement question for whoever owns the trap, and this
  // round is a revert.
  'TRAP_BAR_SHADOW|FAR': 0.6,
};

/**
 * EVERY LANDING RATE ANY COMMENT IN THE TREE STATES, as exact pixel counts.
 *
 * `[landed, requested]` over the whole pose space, and the string is what
 * `(landed / requested * 100).toFixed(1)` prints. All OURS.
 *
 * This exists because the exceptions block described itself as a ratchet and was
 * not one. A floor fires downward only; these fire in BOTH directions, which is
 * the doctrine `lifterSprite.test.ts` settles on for ours-only figures. If the
 * drawing gets better these go red too, and whoever improved it comes here and
 * says so. That is the cost of the sentences above being true.
 *
 * THE COMMENTS WERE STILL A THIRD COPY. This doc used to say the printed string
 * is "the form the comments above quote, so the quoted number is the asserted
 * number rather than a transcription of it", and that was half true: the pair and
 * the string it prints were compared to each other, and the SENTENCE quoting the
 * string was compared to nothing. Three copies, two checked — which is the same
 * shape as the contradiction `lifterSprite.test.ts` built the `@ref` convention
 * for, one category over, on ours-figures instead of reference figures.
 *
 * So prose states a rate as `@ours STRAP_SEAM|ALL = 63.7%`, and 'agrees with
 * every landing rate any comment in the tree states' scans the tree for those
 * tags and compares
 * each to the pair here. Same idea as `@ref`, different table, and the two are
 * deliberately different words: `@ref` means "measured off the reference image",
 * `@ours` means "measured off our own frames".
 */
const MARK_LANDING_MEASURED: Readonly<Record<string, readonly [number, number, string]>> = {
  'QUAD_SWEEP_NEAR|ALL': [2202, 3744, '58.8%'],
  'QUAD_SWEEP_FAR|ALL': [2213, 3744, '59.1%'],
  'SHOE_UPPER|ALL': [4192, 7488, '56.0%'],
  'SHOE_UPPER|NEAR': [2096, 3744, '56.0%'],
  'SHOE_UPPER|FAR': [2096, 3744, '56.0%'],
  // Not exceptions — they clear the floor — but SHOE_UPPER's comment does its
  // arithmetic off them, so they are pinned with the rest.
  'SHOE_COLLAR|ALL': [5856, 7488, '78.2%'],
  'SHOE_SOLE|ALL': [5856, 7488, '78.2%'],
  'STRAP_SEAM|ALL': [1589, 2496, '63.7%'],
  'STRAP_SEAM|NEAR': [1246, 1248, '99.8%'],
  'STRAP_SEAM|FAR': [343, 1248, '27.5%'],
  'TRAP_BAR_SHADOW|ALL': [1952, 2496, '78.2%'],
  'TRAP_BAR_SHADOW|NEAR': [1152, 1248, '92.3%'],
  'TRAP_BAR_SHADOW|FAR': [800, 1248, '64.1%'],
};

/**
 * Frames in which the FAR strap seam loses every one of its three pixels.
 *
 * OURS. The `alwaysOn` comment below quotes it, and the exception above quotes
 * its complement — `@ours FAR_SEAM_FRAMES_SURVIVING = 210` of
 * `@ours POSE_SPACE_FRAMES = 416` — so one number is pinned and the other is
 * arithmetic on it, in `FAR_SEAM_FRAMES_SURVIVING` below.
 */
const FAR_SEAM_FRAMES_FULLY_GONE = 206;

/**
 * The complement of `FAR_SEAM_FRAMES_FULLY_GONE`, DERIVED and not typed.
 *
 * OURS. Both halves are quoted in prose, so both need a tag, and the arithmetic
 * between them is done here once rather than in a sentence.
 */
const FAR_SEAM_FRAMES_SURVIVING = POSE_SPACE_FRAMES - FAR_SEAM_FRAMES_FULLY_GONE;

/**
 * (frame, seam row) pairs on one side: `@ours POSE_SPACE_FRAMES = 416` frames
 * times a three-row map.
 *
 * OURS. It is the denominator of every per-side seam figure in this file.
 */
const SEAM_ROWS_MEASURED = 1248;

/**
 * Far seam pixels that LAND, and the misses that are the other half of the join.
 *
 * OURS, both DERIVED from `MARK_LANDING_MEASURED` rather than typed, so the
 * landing rate and the miss count can never disagree. Every sentence naming how
 * many far seam pixels land, or how many fail to, is tagged against these.
 */
const STRAP_SEAM_FAR_LANDED = MARK_LANDING_MEASURED['STRAP_SEAM|FAR']?.[0] ?? 0;
const FAR_SEAM_MISSES = SEAM_ROWS_MEASURED - STRAP_SEAM_FAR_LANDED;

/**
 * Far seam pixels that fall inside the far upper arm's drawn outline.
 *
 * OURS, `@ours FAR_SEAM_PIXELS_INSIDE_ARM = 906` of `SEAM_ROWS_MEASURED`,
 * against ZERO on the near side.
 *
 * THIS NUMBER AND THE `@ours FAR_SEAM_MISSES = 905` BESIDE IT WERE TWO BUCKETS,
 * NOT A JOIN, for three
 * rounds. "inside the arm" and "fails to land" are
 * consistent with the arm having eaten its own seam and do not entail it: no
 * assertion in this file ever asked whether a LOST pixel was an INSIDE pixel,
 * and the one integer that decides it — how many misses fall outside the arm
 * entirely — was stated in prose here as "`despeckle` rescues a lone contour
 * pixel now and then", which nothing could check. If that had been sixty rather
 * than one, fifty-nine far misses would have had nothing to do with the arm and
 * the lever named on `MARK_LANDING_FLOOR` would have been partly wrong.
 *
 * `FAR_SEAM_ARM_JOIN` below is that join, measured. The phrase is now the
 * integer `@ours FAR_SEAM_ARM_JOIN.landedInRing = 2` and the gap between the two
 * counts above is arithmetic on two pinned counts.
 */
const FAR_SEAM_PIXELS_INSIDE_ARM = 906;

/**
 * THE JOIN: is a far seam pixel that fails to land a pixel the far arm covers?
 *
 * All OURS, all measured this round over the whole pose space, all pinned so
 * they fire whether they rise or fall. `inCapsule` pad 1 is the arm's whole
 * painted footprint
 * (`raster.limbPass` stamps the contour ring at `grow` 1 and fills at `grow` 0),
 * and pad 0 is the FILL alone, so pad1-minus-pad0 is the one-px contour RING.
 *
 *   inside the arm, pad 1 ..... `@ours FAR_SEAM_PIXELS_INSIDE_ARM = 906`
 *     of which in the FILL .... `@ours FAR_SEAM_ARM_JOIN.insideFill = 55`
 *     of which in the RING .... `@ours FAR_SEAM_PIXELS_INSIDE_ARM_RING = 851`
 *   fail to land .............. `@ours FAR_SEAM_MISSES = 905`
 *     inside, in the fill ..... `@ours FAR_SEAM_ARM_JOIN.missInFill = 55`
 *     inside, in the ring ..... `@ours FAR_SEAM_ARM_JOIN.missInRing = 849`
 *     OUTSIDE THE ARM ......... `@ours FAR_SEAM_ARM_JOIN.missOutside = 1`
 *   land anyway despite inside  `landedInFill` + `landedInRing`
 *     in the fill ............. `@ours FAR_SEAM_ARM_JOIN.landedInFill = 0`
 *     in the ring ............. `@ours FAR_SEAM_ARM_JOIN.landedInRing = 2`
 *
 * So the arm accounts for `@ours FAR_SEAM_MISSES_INSIDE_ARM = 904` of the
 * misses, and `FAR_SEAM_PIXELS_INSIDE_ARM` less `FAR_SEAM_MISSES` is
 * `landedInRing` less `missOutside` — asserted below as arithmetic on the pins
 * rather than written out here as four more integers.
 *
 * THE RING IS THE MECHANISM, and it is why `UPPER_ARM_R` moves this number so
 * hard: `@ours FAR_SEAM_ARM_JOIN.missInRing = 849` of the
 * `@ours FAR_SEAM_MISSES_INSIDE_ARM = 904` seam pixels the arm eats are eaten by
 * its one-pixel
 * CONTOUR, and only `@ours FAR_SEAM_ARM_JOIN.missInFill = 55` by its body. A
 * radius change moves the ring, and the ring
 * is where the seam is. That split existed only in a builder's report until now
 * — neither count appeared anywhere in the tree, and a critic grepping for them
 * found
 * nothing — and re-measuring this round reproduced both exactly.
 *
 * `missOutside` IS ONE, NOT ZERO, AND ITS CAUSE IS NOT DIAGNOSED — said plainly,
 * in the shape `TRAP_BAR_SHADOW|FAR` above already uses, rather than guessed at.
 * It is a single (frame, row) pair of `@ours SEAM_ROWS_MEASURED = 1248`: depth
 * 0.750 ASCENT, strain 2, pitch
 * 3, seam row 2, at (53, 36). What IS measured about it: the finished pixel is
 * skin, it is not inside the far upper arm at pad 1, it is not inside either far
 * FOREARM capsule at pad 1, and it is not inside the far deltoid disc. It is
 * inside the strap capsule, so the strap did reach it. Nothing here explains it
 * and nothing here pretends to; it is one of `@ours FAR_SEAM_MISSES = 905` and
 * it is pinned so it cannot
 * grow quietly.
 *
 * `landedInRing` IS THE COUNT THE OLD PROSE CALLED "rescued by despeckle". Two,
 * both in the contour ring, none in the fill — which is the signature that
 * sentence described, and is as far as this file goes. WHY those two survive is
 * NOT ASSERTED: nothing in the tree exposes the grid between `drawArm` and
 * `applyMarks`, so despeckle eating an isolated contour pixel is a deduction
 * from the pipeline order in `renderLifterFrame`, not an observation. Named as a
 * deduction on purpose.
 */
const FAR_SEAM_ARM_JOIN = {
  insideFill: 55,
  missInFill: 55,
  missInRing: 849,
  missOutside: 1,
  landedInFill: 0,
  landedInRing: 2,
} as const;

/**
 * The two rows of the table above that are ARITHMETIC on it, not separate pins.
 *
 * OURS, DERIVED. They exist because prose quotes them — the ring's share of the
 * misses, and the ring's share of what the arm covers — and a quoted number with
 * no owner is the defect this whole
 * block is about. Deriving them means a change to `FAR_SEAM_ARM_JOIN` or to
 * `FAR_SEAM_PIXELS_INSIDE_ARM` reddens the sentences too.
 */
const FAR_SEAM_MISSES_INSIDE_ARM = FAR_SEAM_ARM_JOIN.missInFill + FAR_SEAM_ARM_JOIN.missInRing;
const FAR_SEAM_PIXELS_INSIDE_ARM_RING = FAR_SEAM_PIXELS_INSIDE_ARM - FAR_SEAM_ARM_JOIN.insideFill;

/**
 * Seam pixels inside a deltoid cap's painted disc, both sides, whole pose space.
 *
 * OURS. `drawTorso` draws the caps with `drawEllipsoid` and no `edge` option, so
 * the disc of `ATTACH.DELTOID_R` is exactly what a cap can touch — the ceiling on
 * how much of the far seam's loss the DELTOID could explain, before even
 * accounting for the straps being drawn after the caps.
 * `@ours SEAM_PIXELS_UNDER_DELTOID = 3` pixels out of
 * `@ours FAR_SEAM_MISSES = 905`.
 *
 * The number is here because a comment in this file used to name the deltoid as
 * the cause. It is not a fact anybody needs; it is the fact that closes off a
 * direction a builder was pointed in.
 */
const SEAM_PIXELS_UNDER_DELTOID = 3;

/**
 * Near seam pixels that fail to land, over the whole pose space.
 *
 * OURS. `@ours NEAR_SEAM_MISSES = 2`, and both are `PAL.GEAR_DARK` in the
 * finished grid — worn kit, which
 * is asserted below. Whatever piece of kit that is, it is NOT skin, and that is
 * the load-bearing half: the near arm is inside its own seam at zero poses, so
 * the near side has no arm loss at all to compare against the far side's
 * `@ours FAR_SEAM_MISSES = 905`.
 */
const NEAR_SEAM_MISSES = 2;

/**
 * Singlet pixels DRAWN in a finished frame, at the poses `rig.ts` quotes — and
 * at the other DIRECTION of each, which is the field `rig.ts` used to leave out.
 *
 * OURS, measured this round, and it lives here because the surface a seam lands
 * ON is this file's business — `MARK_SURFACES.SINGLET` is the gate every strap
 * figure above is measured through.
 *
 * `RIG_GEOMETRY.UPPER_ARM_R` states two shipped counts and, beside each, a pair
 * of figures for a re-bellied arm: the middle and right-hand figures are a
 * record of a shape `drawArm` no longer builds, like the belly landing rates
 * beside them. The two SHIPPED ones are reproducible, and
 * were the only current ours-figure in that block with no pin — in a paragraph
 * headed "WHICH OF THOSE ROWS IS CHECKABLE, said plainly". Disclosure is not the
 * same as a check: prose that says "this is unguarded" still goes stale silently,
 * it just apologises first.
 *
 * THE SPEC IS PART OF THE FIGURE, AND THE DIRECTION IS PART OF THE SPEC.
 * `rig.ts` quoted these at "strain 0, pitch 0, 250 kg" and left the direction
 * out; BRACE is an anchor on the DESCENT ladder only, and the ASCENT ladder at
 * the same depth draws a different pose. So every spec is written out in full
 * here and rendered rather than quoted, and the table carries FOUR rows — both
 * depths on both ladders — so that "in both directions" is a fact about this
 * table rather than a hope. Measured this round:
 *
 *   - at BRACE the ladder MATTERS. DESCENT draws
 *     `@ours SINGLET_PX_DRAWN.BRACE_DESCENT = 153` and ASCENT at the same depth
 *     draws `@ours SINGLET_PX_DRAWN.BRACE_ASCENT = 135`, an eighteen-pixel gap
 *     that a count quoted at BRACE with no ladder named hides completely;
 *   - in the HOLE it does not. `@ours SINGLET_PX_DRAWN.HOLE_DESCENT = 112` and
 *     `@ours SINGLET_PX_DRAWN.HOLE_ASCENT = 112` are the same count, which is
 *     what the two ladders meeting at the bottom of the lift looks like from
 *     the singlet's side. That is measured here, not assumed: it is the row
 *     that makes the BRACE gap a fact about the ladders rather than about
 *     rendering noise.
 */
const SINGLET_PX_DRAWN: Readonly<Record<string, readonly [LifterFrameSpec, number]>> = {
  BRACE_DESCENT: [spec({ depth: BRACE_SETTLE_DEPTH, direction: 'DESCENT' }), 153],
  BRACE_ASCENT: [spec({ depth: BRACE_SETTLE_DEPTH, direction: 'ASCENT' }), 135],
  HOLE_DESCENT: [spec({ depth: 1, direction: 'DESCENT' }), 112],
  HOLE_ASCENT: [spec({ depth: 1, direction: 'ASCENT' }), 112],
};

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

  it('lands EVERY mark, kit and flesh, on most of the pixels it asks for — per side', () => {
    // "A mark that lands a third of the time is not doing its job." See
    // `MARK_LANDING_FLOOR` for why this now covers KIT as well as FLESH and why
    // it counts the two sides of a BOTH mark separately: the strap seam was the
    // lowest-landing mark on the sheet and this test used to skip it outright.
    //
    // A BOTH mark is measured three ways — aggregate, near, far — and each one
    // has to clear the floor or its own documented exception. The near and far
    // maps are identical, so the aggregate is the mean of the two sides and
    // adding the per-side keys cannot weaken anything.
    const req = new Map<string, number>();
    const got = new Map<string, number>();
    const buckets = (mark: Mark): readonly ('ALL' | 'NEAR' | 'FAR')[] =>
      mark.side === 'BOTH' ? ['ALL', 'NEAR', 'FAR'] : ['ALL'];
    for (const s of poseSpace()) {
      const frame = renderLifterFrame(s);
      for (const mark of MARKS) {
        for (const bucket of buckets(mark)) {
          // `sidesFor` maps NEAR to sign -1 and FAR to +1, so asking the table
          // for a one-sided copy of the mark is the module's own vocabulary
          // rather than a screen-x comparison invented here.
          const oneSide: Mark = bucket === 'ALL' ? mark : { ...mark, side: bucket };
          const key = `${mark.name}|${bucket}`;
          req.set(
            key,
            (req.get(key) ?? 0) +
              markTargets(oneSide, frame.pose, frame.strain > STRAIN.FLUSH_THRESHOLD).length,
          );
          got.set(key, (got.get(key) ?? 0) + markPixelsInGrid(frame.grid, oneSide, frame));
        }
      }
    }

    // Every exception must name a mark that exists and a bucket it is measured
    // in, so a rename cannot quietly leave a mark unfloored.
    for (const key of Object.keys(MARK_LANDING_EXCEPTIONS)) {
      expect(req.has(key), `${key} is an exception for a bucket nothing measures`).toBe(true);
    }

    // THE RATCHET, MADE REAL. Every rate the comments above state is pinned as an
    // exact pair of pixel counts, in both directions, and the percentage they
    // print is compared as the string the comment quotes. See
    // `MARK_LANDING_MEASURED` for why a floor was not this.
    for (const key of Object.keys(MARK_LANDING_EXCEPTIONS)) {
      expect(
        MARK_LANDING_MEASURED[key],
        `${key} is floored but its measured rate is not pinned`,
      ).toBeDefined();
    }
    for (const [key, [landed, asked, printed]] of Object.entries(MARK_LANDING_MEASURED)) {
      expect(req.get(key), `${key} is pinned for a bucket nothing measures`).toBe(asked);
      expect(got.get(key), `${key} landed pixels`).toBe(landed);
      expect(`${((landed / asked) * 100).toFixed(1)}%`, `${key} printed rate`).toBe(printed);
    }

    for (const mark of MARKS) {
      for (const bucket of buckets(mark)) {
        const key = `${mark.name}|${bucket}`;
        const asked = req.get(key) ?? 0;
        expect(asked, key).toBeGreaterThan(0);
        const rate = (got.get(key) ?? 0) / asked;
        expect(rate, `${key} landed ${(rate * 100).toFixed(1)}%`).toBeGreaterThan(
          MARK_LANDING_EXCEPTIONS[key] ?? MARK_LANDING_FLOOR,
        );
      }
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
    //
    // STRAP_SEAM IS DELIBERATELY NOT IN THIS LIST, and that is worth writing
    // down because "the waist trim is here and the shoulder strap is not" looks
    // like an oversight and was reported as one. It is not a list this mark can
    // join. The check is per MARK, over both sides at once, and the NEAR seam
    // lands `@ours STRAP_SEAM|NEAR = 99.8%` of its pixels at every pose — so a
    // strap already gone from the far shoulder in
    // `@ours FAR_SEAM_FRAMES_FULLY_GONE = 206` of `@ours POSE_SPACE_FRAMES = 416`
    // frames passes this
    // test today, passes it with
    // `UPPER_ARM_R` re-bellied at 3.0, and only fails at 3.4, where the near
    // side finally drops out in 13 frames. A guard that green with the thing it
    // names half-eaten is worse than no guard, because it reads as coverage.
    //
    // The strap is floored by landing RATE instead, per side, at
    // `MARK_LANDING_EXCEPTIONS`. That fires at 3.0 and at 3.4. (The fully-gone
    // count is pinned below; the belly figures are a record of a shape `drawArm`
    // no longer builds — see the note on the exception itself.)
    //
    // WHAT PER-SIDE ACTUALLY BUYS IS SENSITIVITY, not reach, and that is worth
    // saying exactly because it is easy to overstate. An aggregate-only floor
    // would ALSO have fired at a 3.0 belly — 55.1% against 0.6 — so per-side is
    // not what makes that mutation visible. What it is, is roughly three times
    // sharper: the FAR key trips on 2.5 points of far-side loss
    // (`@ours STRAP_SEAM|FAR = 27.5%` against 0.25) where the ALL key needs 7.4,
    // since the aggregate is the mean of two sides and only one of them is moving.
    // The proof that per-side sees things aggregate cannot is `TRAP_BAR_SHADOW`,
    // found at `@ours TRAP_BAR_SHADOW|FAR = 64.1%` on the far side behind a
    // `@ours TRAP_BAR_SHADOW|ALL = 78.2%` aggregate that cleared the general 0.7
    // floor.
    let seamFullyGone = 0;
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
    const seam = MARKS.find((m) => m.name === 'STRAP_SEAM');
    expect(seam, 'STRAP_SEAM').toBeDefined();
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
      if (seam !== undefined && markPixelsInGrid(frame.grid, { ...seam, side: 'FAR' }, frame) === 0) {
        seamFullyGone += 1;
      }
    }
    // "Gone from the far shoulder in `@ours FAR_SEAM_FRAMES_FULLY_GONE = 206` of
    // `@ours POSE_SPACE_FRAMES = 416` frames" and "survives in
    // `@ours FAR_SEAM_FRAMES_SURVIVING = 210`", both pinned, and both fire
    // whether the count rises or falls. See `FAR_SEAM_FRAMES_FULLY_GONE`.
    expect(seamFullyGone, 'frames with no far seam pixel at all').toBe(FAR_SEAM_FRAMES_FULLY_GONE);
    expect(poseSpace().length, 'frames in the sweep').toBe(POSE_SPACE_FRAMES);
    expect(poseSpace().length - seamFullyGone, 'frames the far seam survives in').toBe(
      FAR_SEAM_FRAMES_SURVIVING,
    );
  });

  it('is eaten on the far side by the ARM, because the seam is authored unmirrored', () => {
    // THE CAUSE OF `@ours STRAP_SEAM|NEAR = 99.8%` AGAINST
    // `@ours STRAP_SEAM|FAR = 27.5%`, ASSERTED RATHER THAN NARRATED. See
    // `MARK_LANDING_FLOOR` for the prose; this is the same claim as numbers, and
    // the two live together so neither can rot without the other going red.
    //
    // Every step is measured on the shipped rig over the whole pose space:
    //
    //   1. the strap ANCHOR is exactly mirror-symmetric at every pose;
    //   2. the seam COLUMN is one px screen-right of it on both sides, which is
    //      inboard on the near side and outboard on the far side, because
    //      `markTargets` adds `origin` as plain screen x;
    //   3. so the far seam falls inside the far upper arm's DRAWN outline in most
    //      (frame, row) pairs and the near seam falls inside the near one in NONE;
    //   4. and every far-side pixel that fails to land is SKIN in the finished
    //      grid, while the near side's two failures are GEAR;
    //   5. AND THE TWO ARE THE SAME PIXELS. Steps 3 and 4 used to be counted into
    //      separate buckets and never joined, which made them consistent with the
    //      arm eating the seam without entailing it. `FAR_SEAM_ARM_JOIN` is the
    //      intersection: of the `@ours FAR_SEAM_MISSES = 905` that fail,
    //      `@ours FAR_SEAM_MISSES_INSIDE_ARM = 904` are inside the arm and ONE is
    //      not, split `@ours FAR_SEAM_ARM_JOIN.missInFill = 55` in the arm's fill
    //      and `@ours FAR_SEAM_ARM_JOIN.missInRing = 849` in its one-px contour
    //      ring.
    //
    // Step 3 uses `craftMetrics.inCapsule` with a pad of 1, which is the contour
    // pass's own `grow` — the same rule the renderer rasterises with, and
    // `lifterSprite.test.ts` compares it to the drawn pixels capsule for capsule.
    // Nothing here is a fourth copy of it. Pad 0 is the same rule with `grow` 0,
    // which is the fill pass, so pad1-minus-pad0 is exactly the contour ring.
    //
    // The arm's own mirror symmetry is asserted here too. `mirroredAnchors`
    // covers the strap ANCHOR only, and the paragraph on `MARK_LANDING_FLOOR`
    // that cites it claims the arm capsule is symmetric as well — on a rig whose
    // header advertises three deliberate asymmetries, one of them on the arm
    // (`GRIP_ASYMMETRY_PX`, applied to `handX` on the far side). Extending that
    // constant to `elbowX` would move this whole split and, until now, leave
    // every test in the file green.
    const seam = MARKS.find((m) => m.name === 'STRAP_SEAM');
    expect(seam, 'STRAP_SEAM').toBeDefined();
    if (seam === undefined) return;
    const G = RIG_GEOMETRY;
    const skin = new Set<number>(MARK_SURFACES.SKIN);
    let pairs = 0;
    let mirroredAnchors = 0;
    let farOutboard = 0;
    let nearInboard = 0;
    let farInsideArm = 0;
    let farInsideArmFill = 0;
    let nearInsideArm = 0;
    let farMisses = 0;
    let farMissesOnSkin = 0;
    let farMissesOutsideArm = 0;
    let farMissesInArmFill = 0;
    let farMissesInArmRing = 0;
    let farLandedInsideArmFill = 0;
    let farLandedInsideArmRing = 0;
    let mirroredArms = 0;
    let nearMisses = 0;
    let nearMissesOnGear = 0;
    let seamPixelsUnderDeltoid = 0;
    let thoseCoveredByTheStrap = 0;
    for (const s of poseSpace()) {
      const frame = renderLifterFrame(s);
      const pose = frame.pose;
      const strained = frame.strain > STRAIN.FLUSH_THRESHOLD;
      const nearAnchor = anchorPoint('STRAP', pose, -1);
      const farAnchor = anchorPoint('STRAP', pose, 1);
      // 1.
      if (farAnchor.x - CENTER_X === -(nearAnchor.x - CENTER_X) && farAnchor.y === nearAnchor.y) {
        mirroredAnchors += 1;
      }
      // 1b. And so is the ARM the seam lands on — every point `drawArm` draws the
      //     upper-arm capsule between, not just the anchor beside it.
      const nearArm = upperArmSpan(pose, -1);
      const farArm = upperArmSpan(pose, 1);
      if (
        farArm.shoulderX - CENTER_X === -(nearArm.shoulderX - CENTER_X) &&
        farArm.bellyX - CENTER_X === -(nearArm.bellyX - CENTER_X) &&
        farArm.elbowX - CENTER_X === -(nearArm.elbowX - CENTER_X) &&
        farArm.shoulderY === nearArm.shoulderY &&
        farArm.bellyY === nearArm.bellyY &&
        farArm.elbowY === nearArm.elbowY
      ) {
        mirroredArms += 1;
      }
      const near = markTargets({ ...seam, side: 'NEAR' }, pose, strained);
      const far = markTargets({ ...seam, side: 'FAR' }, pose, strained);
      expect(near.length, 'the two sides ask for the same pixels').toBe(far.length);
      for (const [sign, anchor, targets, arm] of [
        [-1, nearAnchor, near, nearArm],
        [1, farAnchor, far, farArm],
      ] as const) {
        // The deltoid cap's painted extent, exactly. `drawTorso` calls
        // `drawEllipsoid` for it with `lightScale` and nothing else — no `edge` —
        // so `drawEllipsoid` runs the fill pass alone at `grow` 0 and the pixels
        // it can touch are precisely `(dx/r)^2 + (dy/r)^2 <= 1` on equal radii,
        // which is this disc. No slack is needed and none is added.
        const dcx = CENTER_X + sign * pose.shoulderHalfW * G.ATTACH.DELTOID;
        const dcy = pose.shoulderY + G.NUDGE.DELTOID_DROP;
        for (const t of targets) {
          const inside = inCapsule(
            t.x,
            t.y,
            arm.shoulderX,
            arm.shoulderY,
            arm.elbowX,
            arm.elbowY,
            G.UPPER_ARM_R[0],
            G.UPPER_ARM_R[1],
            1,
          );
          // The FILL alone, same rule at the fill pass's `grow` of 0. Inside at
          // pad 1 and not at pad 0 is the one-px contour ring.
          const insideFill = inCapsule(
            t.x,
            t.y,
            arm.shoulderX,
            arm.shoulderY,
            arm.elbowX,
            arm.elbowY,
            G.UPPER_ARM_R[0],
            G.UPPER_ARM_R[1],
            0,
          );
          const px = getPx(frame.grid, t.x, t.y);
          const landed = px === t.ink;
          if (sign > 0) {
            pairs += 1;
            if (t.x - anchor.x > 0) farOutboard += 1;
            if (inside) farInsideArm += 1;
            if (insideFill) farInsideArmFill += 1;
            if (!landed) {
              farMisses += 1;
              if (skin.has(px)) farMissesOnSkin += 1;
              // 5. THE JOIN. Both operands were already on this line for three
              //    rounds and went into separate buckets.
              if (!inside) farMissesOutsideArm += 1;
              else if (insideFill) farMissesInArmFill += 1;
              else farMissesInArmRing += 1;
            } else if (inside) {
              if (insideFill) farLandedInsideArmFill += 1;
              else farLandedInsideArmRing += 1;
            }
          } else {
            // Screen-right of the near axis is toward the centre line.
            if (t.x - anchor.x > 0) nearInboard += 1;
            if (inside) nearInsideArm += 1;
            if (!landed) {
              nearMisses += 1;
              if (px === PAL.GEAR_DARK) nearMissesOnGear += 1;
            }
          }
          if (Math.hypot(t.x - dcx, t.y - dcy) <= G.ATTACH.DELTOID_R) {
            seamPixelsUnderDeltoid += 1;
            const covered = inCapsule(
              t.x,
              t.y,
              CENTER_X + sign * pose.shoulderHalfW * G.ATTACH.STRAP_TOP,
              pose.shoulderY - G.NUDGE.STRAP_LIFT,
              CENTER_X + sign * pose.shoulderHalfW * G.ATTACH.STRAP_BOTTOM,
              pose.chestY,
              G.ATTACH.STRAP_R[0],
              G.ATTACH.STRAP_R[1],
              0,
            );
            if (covered) thoseCoveredByTheStrap += 1;
          }
        }
      }
    }

    // 1. The rig either side of the seam is mirror-symmetric, so nothing about
    //    the DRAWING can produce the split on its own.
    expect(mirroredAnchors, 'strap anchors are mirror images at every pose').toBe(
      poseSpace().length,
    );
    // 1b. Including the arm. `GRIP_ASYMMETRY_PX` reaches `handX` and stops there;
    //     the day it reaches `elbowX` this goes red and the split below is a
    //     different number for a different reason.
    expect(mirroredArms, 'upper-arm spans are mirror images at every pose').toBe(
      poseSpace().length,
    );
    // 2. The seam column is not.
    expect(pairs, '(frame, row) pairs').toBe(SEAM_ROWS_MEASURED);
    expect(farOutboard, 'far seam is OUTBOARD of its strap axis').toBe(pairs);
    expect(nearInboard, 'near seam is INBOARD of its strap axis').toBe(pairs);
    // 3. Which puts one of them on the arm and the other nowhere near it.
    expect(farInsideArm, 'far seam pixels inside the far upper arm').toBe(
      FAR_SEAM_PIXELS_INSIDE_ARM,
    );
    expect(nearInsideArm, 'near seam pixels inside the near upper arm').toBe(0);
    // 4. And the pixel that won is skin, in the finished grid, every time.
    expect(farMisses, 'far seam pixels that did not land').toBe(
      pairs - (MARK_LANDING_MEASURED['STRAP_SEAM|FAR']?.[0] ?? 0),
    );
    // Same quantity, spelled as the constant the prose is tagged against, so a
    // tagged sentence and this assertion cannot come apart.
    expect(farMisses, 'far misses against FAR_SEAM_MISSES').toBe(FAR_SEAM_MISSES);
    expect(farMissesOnSkin, 'every far miss is SKIN').toBe(farMisses);
    expect(nearMisses, 'near seam pixels that did not land').toBe(NEAR_SEAM_MISSES);
    expect(nearMissesOnGear, 'and both near misses are GEAR, not skin').toBe(nearMisses);
    // 5. THE JOIN, which is the step 3 and 4 above never made: a lost pixel and a
    //    covered pixel are THE SAME PIXEL,
    //    `@ours FAR_SEAM_MISSES_INSIDE_ARM = 904` times out of
    //    `@ours FAR_SEAM_MISSES = 905`. See
    //    `FAR_SEAM_ARM_JOIN` for every count here and for the one that is not
    //    explained.
    expect(farMissesOutsideArm, 'far misses the arm does NOT cover — undiagnosed').toBe(
      FAR_SEAM_ARM_JOIN.missOutside,
    );
    expect(farMissesInArmFill, "far misses inside the arm's FILL").toBe(
      FAR_SEAM_ARM_JOIN.missInFill,
    );
    expect(farMissesInArmRing, "far misses inside the arm's one-px contour RING").toBe(
      FAR_SEAM_ARM_JOIN.missInRing,
    );
    expect(farLandedInsideArmFill, 'far pixels that land inside the FILL').toBe(
      FAR_SEAM_ARM_JOIN.landedInFill,
    );
    expect(farLandedInsideArmRing, 'far pixels that land inside the RING anyway').toBe(
      FAR_SEAM_ARM_JOIN.landedInRing,
    );
    expect(farInsideArmFill, "far seam pixels inside the arm's FILL").toBe(
      FAR_SEAM_ARM_JOIN.insideFill,
    );
    //    And the two DERIVED counts the prose quotes, measured here rather than
    //    only computed, so a tag on either is backed by a rendered frame.
    expect(farMissesInArmFill + farMissesInArmRing, 'far misses the arm DOES cover').toBe(
      FAR_SEAM_MISSES_INSIDE_ARM,
    );
    expect(farInsideArm - farInsideArmFill, "far seam pixels in the arm's RING").toBe(
      FAR_SEAM_PIXELS_INSIDE_ARM_RING,
    );
    //    And the arithmetic that ties inside-the-arm to failed-to-land, so
    //    neither can drift alone.
    expect(farMissesInArmFill + farMissesInArmRing + farMissesOutsideArm, 'the misses add up').toBe(
      farMisses,
    );
    expect(
      farMissesInArmFill + farMissesInArmRing + farLandedInsideArmFill + farLandedInsideArmRing,
      'and the covered pixels add up',
    ).toBe(farInsideArm);
    // NOT THE DELTOID. A cap's painted disc contains
    // `@ours SEAM_PIXELS_UNDER_DELTOID = 3` seam pixels in the
    // whole pose space, and the strap capsule — which `drawTorso` lays down AFTER
    // the deltoid caps — covers all three. Three cannot explain
    // `@ours FAR_SEAM_MISSES = 905`.
    expect(seamPixelsUnderDeltoid, 'seam pixels within reach of a deltoid cap').toBe(
      SEAM_PIXELS_UNDER_DELTOID,
    );
    expect(thoseCoveredByTheStrap, 'and the strap, drawn later, covers them').toBe(
      seamPixelsUnderDeltoid,
    );
  });

  it('draws the singlet area RIG_GEOMETRY quotes, at the spec it quotes it for', () => {
    // See `SINGLET_PX_DRAWN`. The only current ours-figure in `UPPER_ARM_R`'s
    // block that nothing checked, in the paragraph headed "WHICH OF THOSE ROWS IS
    // CHECKABLE, said plainly" — disclosed as unguarded, which is honest, and
    // still a number that could go stale in silence. Pinned so it fires whether
    // the count rises or falls, at both depths on BOTH LADDERS.
    //
    // The table's DESCENT and ASCENT rows are the reason this is four renders and
    // not two: `rig.ts` quoted a count for BRACE without saying which ladder, and
    // the two ladders do not agree there.
    const singlet = new Set<number>(MARK_SURFACES.SINGLET);
    const seen = new Set<string>();
    for (const [where, [at, expected]] of Object.entries(SINGLET_PX_DRAWN)) {
      const frame = renderLifterFrame(at);
      let drawn = 0;
      for (let y = 0; y < frame.grid.h; y += 1) {
        for (let x = 0; x < frame.grid.w; x += 1) {
          if (singlet.has(getPx(frame.grid, x, y))) drawn += 1;
        }
      }
      expect(drawn, `singlet px at ${where}, ${at.direction} depth ${at.depth}`).toBe(expected);
      seen.add(at.direction);
    }
    // "In both directions" is checked, not asserted in a comment: the table used
    // to hold two rows and both were DESCENT, while the doc beside it said the
    // ladder mattered.
    expect([...seen].sort(), 'ladders the table actually renders').toEqual(['ASCENT', 'DESCENT']);
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
    // what it takes, over the whole pose space rather than one frame: a single
    // frame can drift down to one or two casualties as maps get fatter, and at
    // that point "the ordering is load-bearing" is being asserted by an
    // accident rather than demonstrated.
    //
    // Measured at this authoring: 389 of `@ours POSE_SPACE_FRAMES = 416` frames would lose at least one
    // authored pixel and 1188 would go in total, the worst hit being the pec
    // shelf's one-pixel sternum notch and both drawings of the face.
    let eaten = 0;
    let framesHit = 0;
    const byMark = new Map<string, number>();
    for (const s of poseSpace()) {
      const frame = renderLifterFrame(s);
      const after = cloneGrid(frame.grid);
      despeckle(after);
      let here = 0;
      for (const mark of MARKS) {
        for (const t of markTargets(mark, frame.pose, frame.strain > STRAIN.FLUSH_THRESHOLD)) {
          if (getPx(frame.grid, t.x, t.y) === t.ink && getPx(after, t.x, t.y) !== t.ink) {
            here += 1;
            byMark.set(mark.name, (byMark.get(mark.name) ?? 0) + 1);
          }
        }
      }
      eaten += here;
      if (here > 0) framesHit += 1;
    }
    expect(eaten).toBeGreaterThan(400);
    expect(framesHit / poseSpace().length).toBeGreaterThan(0.5);
    // And the face specifically, because that is the failure this ordering was
    // introduced for: eyes and a mouth that existed in the source and in no
    // rendered PNG.
    expect((byMark.get('FACE_CALM') ?? 0) + (byMark.get('FACE_STRAINED') ?? 0)).toBeGreaterThan(0);
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
    // THIS TEST IS ABOUT THE CHEST, NOT ABOUT THE STRAP, and the name has misled
    // at least one reader. It reads `strap.x + 2` — two px INBOARD of the seam,
    // on skin — at depth 0 only, and it would stay green with every pixel of the
    // strap itself painted over by an arm. The strap's own survival is measured
    // by landing rate, per side, over the whole pose space: see
    // `MARK_LANDING_EXCEPTIONS`.
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
    // The far-side lamp falloff is what separates the two arms in depth. A single
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
      expect(authoredPixelBudget()).toBe(342);
    }
  });
});

// ---------------------------------------------------------------------------
// The prose quoting these figures is checked too — rates AND counts
// ---------------------------------------------------------------------------

/**
 * The NUMBER half of a prose tag, shared with `@ref` CHARACTER FOR CHARACTER.
 *
 * `@ours` was built as a narrower copy of `lifterSprite.test.ts`'s `@ref`: same
 * idea, same job, but its value grammar was percent-only, with a mandatory
 * percent sign. So the round that measured the seam produced eleven INTEGERS the
 * convention could not express, and every one of them went back to being a third
 * copy restated in prose. Two dialects, one narrower than the other, is how that
 * happens.
 *
 * This is that grammar, lifted verbatim from `@ref`, and
 * 'writes the same number grammar `@ref` does' below reads the other file and
 * fails if the two drift apart. The two tags still resolve against DIFFERENT
 * TABLES and that is deliberate, not an oversight:
 *
 *   - `@ref` names a figure decoded off the reference PNG and is compared with a
 *     tolerance of half a unit in the last decimal the comment printed, because
 *     a decoded mean is a real number quoted at whatever precision the sentence
 *     wanted.
 *   - `@ours` names a figure counted off our own rendered frames and is compared
 *     EXACTLY, because a pixel count and a `.toFixed(1)` rate both have one
 *     correct spelling and a tolerance would only let a stale one through.
 *
 * Sharing the resolution would mean merging a decoder's output with a
 * rasteriser's, which is the one thing the two words exist to keep apart.
 */
const TAG_NUMBER = String.raw`(-?\d+(?:\.\d+)?)(%?)`;

/**
 * `@ours STRAP_SEAM|FAR = 27.5%`, `@ours FAR_SEAM_ARM_JOIN.missInRing = 849`.
 *
 * The NAME half is a superset of `@ref`'s: it admits the `NAME|BUCKET` keys the
 * landing table is keyed by as well as the dotted `CONST.field` names `@ref`
 * already uses.
 */
const OURS_TAG = new RegExp(String.raw`@ours\s+([A-Z][\w.|]*)\s*=\s*` + TAG_NUMBER, 'g');

/** The same shape for `@ref`, used only to strip those tags before a ban runs. */
const REF_TAG = new RegExp(String.raw`@ref\s+([A-Za-z][\w.]*)\s*=\s*` + TAG_NUMBER, 'g');

/**
 * EVERY OURS-FIGURE A COMMENT MAY STATE, name to the one spelling that is right.
 *
 * Rates come from `MARK_LANDING_MEASURED`. Counts come from the pins above and
 * from the arithmetic on them, and NONE of them is typed twice: the derived
 * entries are computed, so moving `FAR_SEAM_ARM_JOIN.missInRing` moves
 * `FAR_SEAM_MISSES_INSIDE_ARM` and reddens every sentence tagged with either.
 *
 * A name that is not a key here fails the scan, so a tag cannot be invented for
 * something nothing measures; and every key here must be quoted somewhere, so a
 * figure cannot be pinned for prose that no longer exists.
 */
const OURS_FIGURES: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    Object.entries(MARK_LANDING_MEASURED).map(([key, [, , printed]]) => [key, printed]),
  ),
  POSE_SPACE_FRAMES: String(POSE_SPACE_FRAMES),
  SEAM_ROWS_MEASURED: String(SEAM_ROWS_MEASURED),
  STRAP_SEAM_FAR_LANDED: String(STRAP_SEAM_FAR_LANDED),
  FAR_SEAM_MISSES: String(FAR_SEAM_MISSES),
  FAR_SEAM_MISSES_INSIDE_ARM: String(FAR_SEAM_MISSES_INSIDE_ARM),
  FAR_SEAM_PIXELS_INSIDE_ARM: String(FAR_SEAM_PIXELS_INSIDE_ARM),
  FAR_SEAM_PIXELS_INSIDE_ARM_RING: String(FAR_SEAM_PIXELS_INSIDE_ARM_RING),
  'FAR_SEAM_ARM_JOIN.insideFill': String(FAR_SEAM_ARM_JOIN.insideFill),
  'FAR_SEAM_ARM_JOIN.missInFill': String(FAR_SEAM_ARM_JOIN.missInFill),
  'FAR_SEAM_ARM_JOIN.missInRing': String(FAR_SEAM_ARM_JOIN.missInRing),
  'FAR_SEAM_ARM_JOIN.missOutside': String(FAR_SEAM_ARM_JOIN.missOutside),
  'FAR_SEAM_ARM_JOIN.landedInFill': String(FAR_SEAM_ARM_JOIN.landedInFill),
  'FAR_SEAM_ARM_JOIN.landedInRing': String(FAR_SEAM_ARM_JOIN.landedInRing),
  FAR_SEAM_FRAMES_FULLY_GONE: String(FAR_SEAM_FRAMES_FULLY_GONE),
  FAR_SEAM_FRAMES_SURVIVING: String(FAR_SEAM_FRAMES_SURVIVING),
  SEAM_PIXELS_UNDER_DELTOID: String(SEAM_PIXELS_UNDER_DELTOID),
  NEAR_SEAM_MISSES: String(NEAR_SEAM_MISSES),
  ...Object.fromEntries(
    Object.entries(SINGLET_PX_DRAWN).map(([key, [, px]]) => [`SINGLET_PX_DRAWN.${key}`, String(px)]),
  ),
};

/**
 * The files whose prose is allowed to state a landing rate at all.
 *
 * NOT the whole tree, and the reason is a real collision rather than caution:
 * `gymTuning.ts` prints two crowd-row percentages that happen to be character for
 * character the same strings as two of the rates pinned above, and mean nothing
 * to do with a mark. A tree-wide ban on the bare strings would be a false
 * positive generator. The tag SCAN below runs over everything under `src`; the
 * ban on untagged quotes runs over these three, which are the only files that
 * discuss where a mark lands. (Which is also why this comment describes those two
 * strings instead of quoting them — the rule catches its own doc otherwise, and
 * it did.)
 */
const RATE_PROSE_FILES: readonly string[] = [
  'src/art/spriteMarks.test.ts',
  'src/art/rig.ts',
  'src/art/lifterSprite.test.ts',
];

/**
 * WHERE THE UNTAGGED-INTEGER BAN LOOKS, AND WHAT IT THEREFORE CANNOT CATCH.
 *
 * TWO FILES, NOT THE THREE ABOVE. `lifterSprite.test.ts` quotes seam RATES —
 * that is why it is in `RATE_PROSE_FILES` — but it states no seam COUNT, and it
 * carries integers of its own that collide by value: its far-arm sweep table
 * prints a frame count that equals `SINGLET_PX_DRAWN.HOLE_DESCENT`, and a
 * sentence about a pose sweep prints the same number again. Both are honest
 * numbers about something else. Adding the file would make the ban a
 * false-positive generator on its first run, which is the failure mode that gets
 * a guard suppressed.
 *
 * COMMENTS ONLY. The scan runs over `commentProse`, so the pins themselves —
 * every `const` above holding one of these counts — the assertions, the table
 * rows and every string literal are invisible to it. A number is only policed
 * where it is being ASSERTED BY A SENTENCE, which is the only place a sentence
 * can be wrong.
 *
 * INTEGERS OF `OURS_BAN_MIN_INTEGER` AND UP, AND THAT IS A REAL HOLE. Four of
 * the join's counts are 0, 1, 2 and 3, and in this file's own comments those
 * digits appear as "pitch 3", "step 3", "row 2", "pad 0", "sign 1" and "two px"
 * — measured, not guessed: a value-based ban on 3 alone would fire on four lines
 * of correct prose. So `FAR_SEAM_ARM_JOIN.missOutside`, `.landedInFill`,
 * `.landedInRing`, `SEAM_PIXELS_UNDER_DELTOID` and `NEAR_SEAM_MISSES` can be
 * restated untagged and this will not notice. What still protects the sentence
 * that matters is that its OTHER halves are above the line: the ring's count and
 * the fill's, the two numbers that say which half of the lever does the work,
 * cannot be written untagged, and a wrong small integer beside a right big one
 * is a much narrower hole than the one this closes.
 *
 * NOT A GENERAL MAGIC-NUMBER RULE. It bans exactly the values in `OURS_FIGURES`.
 * The frame counts the despeckle block quotes, the authored-pixel budget and the
 * belly-radius record in `rig.ts` are untagged integers in these same comments
 * and stay legal, because nothing pins them. `src/tuning/audit.ts` is the general
 * rule and it deliberately does not read test files.
 *
 * DECIMAL DIGITS ONLY. A count written with a thousands separator, or spelled
 * out in words, walks straight past.
 */
const SEAM_INTEGER_PROSE_FILES: readonly string[] = [
  'src/art/spriteMarks.test.ts',
  'src/art/rig.ts',
];

/** Below this, an integer in prose is structure, not a measurement. */
const OURS_BAN_MIN_INTEGER = 10;

/**
 * The COMMENT text of a TypeScript source, one entry per line of the original.
 *
 * Code, string literals and regex literals are dropped; line comments and block
 * comments are kept. Line numbers are preserved so a finding can be pointed at.
 * `commentProse` is exercised on a hand-written sample below rather than
 * trusted, because a ban that reads the wrong half of the file is worse than no
 * ban.
 */
function commentProse(text: string): string[] {
  const REGEX_PRECEDERS = '(,=:[!&|?{};+-*%<>~^';
  const out: string[] = [];
  let line = '';
  let state: 'code' | 'line' | 'block' | 'string' | 'regex' = 'code';
  let quote = '';
  let prev = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i] ?? '';
    const d = text[i + 1] ?? '';
    if (c === '\n') {
      if (state === 'line' || state === 'string' || state === 'regex') state = 'code';
      out.push(line);
      line = '';
      i += 1;
      continue;
    }
    if (state === 'code') {
      if (c === '/' && d === '/') {
        state = 'line';
        i += 2;
        continue;
      }
      if (c === '/' && d === '*') {
        state = 'block';
        i += 2;
        continue;
      }
      if (c === '/' && (prev === '' || REGEX_PRECEDERS.includes(prev))) {
        state = 'regex';
        i += 1;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') {
        state = 'string';
        quote = c;
        i += 1;
        continue;
      }
      if (c.trim() !== '') prev = c;
      i += 1;
      continue;
    }
    if (state === 'string' || state === 'regex') {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (state === 'string' ? c === quote : c === '/') {
        state = 'code';
        prev = 'x';
      }
      i += 1;
      continue;
    }
    if (state === 'block' && c === '*' && d === '/') {
      state = 'code';
      i += 2;
      continue;
    }
    line += c;
    i += 1;
  }
  out.push(line);
  return out;
}

/**
 * Every line of `prose` that states a policed integer with no `@ours` tag on it.
 *
 * Returned rather than asserted so the check can be shown to FIRE, on a sample
 * written for the purpose, in the same test that shows it silent on the tree.
 */
function untaggedOursIntegers(
  rel: string,
  prose: readonly string[],
  banned: ReadonlyMap<string, readonly string[]>,
): string[] {
  const hits: string[] = [];
  prose.forEach((raw, index) => {
    const bare = raw.replace(OURS_TAG, '').replace(REF_TAG, '');
    for (const [value, names] of banned) {
      // Not part of a longer number, not the digits after a decimal point, and
      // not the integer part of one either.
      if (!new RegExp(String.raw`(?<![\w.])${value}(?![\w])(?!\.\d)`).test(bare)) continue;
      hits.push(
        `${rel}:${index + 1} states the measured integer ${value} ` +
          `(${names.join(' / ')}) with no @ours tag: "${raw.trim()}"`,
      );
    }
  });
  return hits;
}

function sourceFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...sourceFilesUnder(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('the prose that quotes an ours-figure', () => {
  it('agrees with every ours-figure any comment in the tree states', () => {
    // THE DEFECT CLASS THIS WHOLE PIECE HAS BEEN FIGHTING, one category over from
    // where `lifterSprite.test.ts` closed it. Its `@ref` check exists because two
    // comments in one file carried reference figures 17% apart, both labelled
    // MEASURED, and neither could fail. The same thing was true here of OUR
    // figures: the pair and the string it prints were compared to each other, and
    // the sentences quoting that string — in this file, in `rig.ts`, in
    // `lifterSprite.test.ts` — were compared to nothing.
    //
    // Same mechanism, different table: a comment stating one of our figures
    // writes `@ours NAME = VALUE`, and this compares it to `OURS_FIGURES`
    // exactly. A name nothing pins fails, so a tag cannot be invented.
    //
    // AND THE FIGURES INCLUDE COUNTS NOW. The round before this one measured the
    // far seam's join with the arm and produced eleven integers; the tag could
    // only express a percentage, so all eleven went straight back into prose as a
    // third copy, including the sentence that names which half of the lever does
    // the work.
    const root = path.resolve(__dirname, '..');
    let checked = 0;
    let integers = 0;
    const tagged = new Set<string>();
    for (const file of sourceFilesUnder(root)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(OURS_TAG)) {
        const key = m[1] ?? '';
        const quoted = `${m[2] ?? ''}${m[3] ?? ''}`;
        const where = `${path.relative(process.cwd(), file)}: @ours ${key} = ${quoted}`;
        const pinned = OURS_FIGURES[key];
        expect(pinned, `${where} names nothing OURS_FIGURES pins`).toBeTypeOf('string');
        expect(quoted, where).toBe(pinned);
        checked += 1;
        if (!quoted.endsWith('%')) integers += 1;
        tagged.add(key);
      }
    }
    // A convention nobody used would pass vacuously, and one that quietly went
    // back to percentages only would pass the line above.
    expect(checked, 'tagged ours-figures found in the tree').toBeGreaterThan(15);
    expect(integers, 'tagged ours-INTEGERS found in the tree').toBeGreaterThan(15);
    // And every pinned figure is quoted somewhere, or it is a pin with no prose
    // behind it and the block above is claiming to serve a sentence that is gone.
    expect([...tagged].sort()).toEqual(Object.keys(OURS_FIGURES).sort());
  });

  it('writes the same number grammar `@ref` does, character for character', () => {
    // `@ours` is a copy of `@ref` and the copy was made narrower than the
    // original, which is the whole reason this round exists: `@ref` had always
    // handled integers and `@ours` had not, so eleven measured counts had no
    // convention to live in. This reads the other file and fails if the two
    // number grammars drift apart again, in either direction.
    //
    // It compares the NUMBER half only. The name halves are deliberately
    // different — ours admits `NAME|BUCKET` — and pinning those together would
    // redden this for a change that is none of its business.
    const refText = readFileSync(path.resolve(__dirname, 'lifterSprite.test.ts'), 'utf8');
    const literal = /\/@ref[^\n]*?\/g;/.exec(refText)?.[0] ?? '';
    expect(literal, 'the @ref tag regex, read out of lifterSprite.test.ts').not.toBe('');
    expect(literal, 'the @ref number grammar and TAG_NUMBER must stay one dialect').toContain(
      TAG_NUMBER,
    );
  });

  it('never states one of the RATES untagged, so a fourth copy cannot start', () => {
    // The tag only helps if prose CANNOT quote a rate without it. Strip the tags
    // and no printed rate string may survive anywhere in the files that discuss
    // mark landing. See `RATE_PROSE_FILES` for why that is three files and not
    // the tree.
    const printed = new Set(Object.values(MARK_LANDING_MEASURED).map(([, , s]) => s));
    for (const rel of RATE_PROSE_FILES) {
      const text = readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');
      // The table itself states each rate once, as data. That is the pin.
      const prose = text
        .replace(OURS_TAG, '')
        .replace(/\[\s*\d+,\s*\d+,\s*'\d+(?:\.\d+)?%'\s*\]/g, '');
      for (const rate of printed) {
        expect(prose.includes(rate), `${rel} states ${rate} without an @ours tag`).toBe(false);
      }
    }
    // And the list names files that exist and includes the one holding the table.
    expect(RATE_PROSE_FILES).toContain('src/art/spriteMarks.test.ts');
    for (const rel of RATE_PROSE_FILES) {
      expect(existsSync(path.resolve(__dirname, '../..', rel)), rel).toBe(true);
    }
  });

  it('reads comments and not code, on a sample written to break it', () => {
    // `commentProse` is the whole scope of the ban below. If it leaked code, the
    // pins themselves would trip it; if it swallowed comments, the ban would be
    // silent and look green. Both failure modes are invisible from the outside,
    // so the parser is exercised on a sample containing the two constructs that
    // actually break naive versions: a string holding comment punctuation, and a
    // regex literal holding a quote.
    const sample = [
      'const A = 906; // note 906',
      "/* block 906 */ const s = '// not a comment 906';",
      "const r = /'/; // after regex 906",
      '',
    ].join('\n');
    expect(commentProse(sample)).toEqual([' note 906', ' block 906 ', ' after regex 906', '']);
  });

  it('never states one of the seam COUNTS untagged either', () => {
    // The gap this closes: `@ours` was built for percentages, so the eleven
    // integers the join was measured in had no tag to wear and went back to being
    // restated prose at seven separated sites. Tagging them is half the job; this
    // is the half that stops an eighth site appearing.
    //
    // Read `SEAM_INTEGER_PROSE_FILES` before widening this. It is two files,
    // comments only, and integers of `OURS_BAN_MIN_INTEGER` and up, and each of
    // those three limits is there because the alternative was measured and
    // produced false positives on correct prose.
    const banned = new Map<string, string[]>();
    for (const [name, printed] of Object.entries(OURS_FIGURES)) {
      if (printed.endsWith('%')) continue;
      if (Number(printed) < OURS_BAN_MIN_INTEGER) continue;
      banned.set(printed, [...(banned.get(printed) ?? []), name]);
    }
    // The set is not empty and is not one lonely number.
    expect(banned.size, 'distinct seam integers this ban polices').toBeGreaterThan(8);

    for (const rel of SEAM_INTEGER_PROSE_FILES) {
      const full = path.resolve(__dirname, '../..', rel);
      expect(existsSync(full), rel).toBe(true);
      const hits = untaggedOursIntegers(rel, commentProse(readFileSync(full, 'utf8')), banned);
      expect(hits, `untagged seam integers in ${rel}`).toEqual([]);
    }

    // AND IT FIRES. A ban that has never been seen to catch anything is
    // indistinguishable from a ban whose scan is pointed at an empty set, which
    // is a mistake this file has made before in another form.
    const ring = OURS_FIGURES['FAR_SEAM_ARM_JOIN.missInRing'] ?? '';
    const sample = [
      ` * the arm eats ${ring} of them in its contour ring`,
      ` * but \`@ours FAR_SEAM_ARM_JOIN.missInRing = ${ring}\` is fine`,
    ];
    const fired = untaggedOursIntegers('sample.ts', sample, banned);
    expect(fired.length, 'the ban catches the untagged line and only that line').toBe(1);
    expect(fired[0]).toContain('sample.ts:1');
    expect(fired[0]).toContain('FAR_SEAM_ARM_JOIN.missInRing');
  });
});
